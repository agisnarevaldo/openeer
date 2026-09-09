import { Elysia, t } from "elysia";
import { authenticateApiKey } from "../lib/gateway-auth";
import { checkRateLimit } from "../lib/rate-limiter";
import type { RateLimitResult } from "../lib/rate-limiter";
import { logRequestAsync } from "../lib/request-logger";
import { resolveProvider } from "../providers";
import type { AIProvider, ChatCompletionUsage, ChatMessage } from "../providers";

function extractIpAddress(request: Request): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip");
}

function rateLimitHeaders(rateLimit: RateLimitResult): Record<string, string> {
  return {
    "x-ratelimit-limit": String(rateLimit.limit),
    "x-ratelimit-remaining": String(rateLimit.remaining),
    "x-ratelimit-reset": String(rateLimit.resetAt),
  };
}

function openAiError(
  message: string,
  code: "invalid_api_key" | "model_not_found"
) {
  return {
    error: {
      message,
      type: "invalid_request_error",
      code,
    },
  };
}

function rateLimitExceededError(limit: number) {
  return {
    error: {
      message: `Rate limit exceeded. Maximum ${limit} requests per minute.`,
      type: "rate_limit_error",
      code: "rate_limit_exceeded",
    },
  };
}

const ZERO_USAGE: ChatCompletionUsage = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
};

interface GatewayLogParams {
  apiKeyId: string;
  model: string;
  ipAddress: string | null;
  requestStart: number;
  statusCode: number;
  errorMessage: string | null;
  usage?: ChatCompletionUsage;
}

function logGatewayRequest(params: GatewayLogParams): void {
  const usage = params.usage ?? ZERO_USAGE;
  logRequestAsync({
    apiKeyId: params.apiKeyId,
    model: params.model,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    totalTokens: usage.totalTokens,
    latencyMs: Math.round(performance.now() - params.requestStart),
    statusCode: params.statusCode,
    errorMessage: params.errorMessage,
    ipAddress: params.ipAddress,
  });
}

interface StreamLogContext {
  apiKeyId: string;
  requestStart: number;
  ipAddress: string | null;
}

function streamChatCompletion(
  provider: AIProvider,
  id: string,
  created: number,
  model: string,
  messages: ChatMessage[],
  logContext: StreamLogContext
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const iterator = provider.chatCompletionStream({ model, messages });

  function chunkPayload(delta: Record<string, unknown>, finishReason: string | null) {
    return `data: ${JSON.stringify({
      id,
      object: "chat.completion.chunk",
      created,
      model,
      choices: [{ index: 0, delta, finish_reason: finishReason }],
    })}\n\n`;
  }

  return new ReadableStream({
    async start(controller) {
      let usage: ChatCompletionUsage = ZERO_USAGE;
      try {
        controller.enqueue(encoder.encode(chunkPayload({ role: "assistant" }, null)));

        let next = await iterator.next();
        while (!next.done) {
          controller.enqueue(
            encoder.encode(chunkPayload({ content: next.value.content }, null))
          );
          next = await iterator.next();
        }
        usage = next.value;

        controller.enqueue(encoder.encode(chunkPayload({}, "stop")));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();

        logGatewayRequest({
          apiKeyId: logContext.apiKeyId,
          model,
          ipAddress: logContext.ipAddress,
          requestStart: logContext.requestStart,
          statusCode: 200,
          errorMessage: null,
          usage,
        });
      } catch (err) {
        console.error("chat-completions: streaming failed", err);
        try {
          controller.error(err);
        } catch {
          // stream already closed/errored, e.g. the client disconnected
        }
        logGatewayRequest({
          apiKeyId: logContext.apiKeyId,
          model,
          ipAddress: logContext.ipAddress,
          requestStart: logContext.requestStart,
          // The client already received a 200 SSE response (headers were
          // sent before the failure), but the request did not actually
          // complete successfully, so the audit log should reflect that
          // rather than showing a false success in the dashboard.
          statusCode: 500,
          errorMessage: err instanceof Error ? err.message : String(err),
          usage,
        });
      }
    },
    cancel() {
      iterator.return?.(ZERO_USAGE);
    },
  });
}

export const chatCompletionsRoutes = new Elysia({ prefix: "/v1" }).post(
  "/chat/completions",
  async ({ request, body, set }) => {
    const requestStart = performance.now();
    const ipAddress = extractIpAddress(request);

    const authenticated = await authenticateApiKey(request);
    if (!authenticated) {
      set.status = 401;
      return openAiError(
        "Incorrect API key provided.",
        "invalid_api_key"
      );
    }

    const rateLimit = await checkRateLimit(
      authenticated.keyId,
      authenticated.rateLimitRpm
    );
    // Set on `set.headers` for every non-streaming outcome below (429, 404,
    // 200 JSON); the streaming success path returns a raw Response, which
    // bypasses `set` entirely, so it merges the same headers itself.
    Object.assign(set.headers, rateLimitHeaders(rateLimit));

    if (!rateLimit.allowed) {
      set.status = 429;
      logGatewayRequest({
        apiKeyId: authenticated.keyId,
        model: body.model,
        ipAddress,
        requestStart,
        statusCode: 429,
        errorMessage: `Rate limit exceeded. Maximum ${rateLimit.limit} requests per minute.`,
      });
      return rateLimitExceededError(rateLimit.limit);
    }

    const provider = resolveProvider(body.model);
    if (!provider) {
      set.status = 404;
      const message = `The model '${body.model}' does not exist.`;
      logGatewayRequest({
        apiKeyId: authenticated.keyId,
        model: body.model,
        ipAddress,
        requestStart,
        statusCode: 404,
        errorMessage: message,
      });
      return openAiError(message, "model_not_found");
    }

    const id = `chatcmpl-${crypto.randomUUID()}`;
    const created = Math.floor(Date.now() / 1000);

    if (body.stream) {
      const stream = streamChatCompletion(
        provider,
        id,
        created,
        body.model,
        body.messages,
        { apiKeyId: authenticated.keyId, requestStart, ipAddress }
      );
      return new Response(stream, {
        status: 200,
        headers: {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          connection: "keep-alive",
          ...rateLimitHeaders(rateLimit),
        },
      });
    }

    const result = await provider.createChatCompletion({
      model: body.model,
      messages: body.messages,
    });

    logGatewayRequest({
      apiKeyId: authenticated.keyId,
      model: body.model,
      ipAddress,
      requestStart,
      statusCode: 200,
      errorMessage: null,
      usage: result.usage,
    });

    return {
      id,
      object: "chat.completion",
      created,
      model: body.model,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: result.content },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: result.usage.promptTokens,
        completion_tokens: result.usage.completionTokens,
        total_tokens: result.usage.totalTokens,
      },
    };
  },
  {
    body: t.Object({
      model: t.String(),
      messages: t.Array(
        t.Object({
          role: t.Union([
            t.Literal("system"),
            t.Literal("user"),
            t.Literal("assistant"),
          ]),
          content: t.String(),
        }),
        { minItems: 1 }
      ),
      stream: t.Optional(t.Boolean()),
    }),
  }
);
