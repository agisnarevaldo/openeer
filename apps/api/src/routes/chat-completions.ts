import { Elysia, t } from "elysia";
import { authenticateApiKey } from "../lib/gateway-auth";
import { checkRateLimit } from "../lib/rate-limiter";
import type { RateLimitResult } from "../lib/rate-limiter";
import { resolveProvider } from "../providers";
import type { AIProvider, ChatMessage } from "../providers";

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

function streamChatCompletion(
  provider: AIProvider,
  id: string,
  created: number,
  model: string,
  messages: ChatMessage[]
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const iterator = provider
    .chatCompletionStream({ model, messages })
    [Symbol.asyncIterator]();

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
      try {
        controller.enqueue(encoder.encode(chunkPayload({ role: "assistant" }, null)));
        for (
          let next = await iterator.next();
          !next.done;
          next = await iterator.next()
        ) {
          controller.enqueue(
            encoder.encode(chunkPayload({ content: next.value.content }, null))
          );
        }
        controller.enqueue(encoder.encode(chunkPayload({}, "stop")));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        console.error("chat-completions: streaming failed", err);
        try {
          controller.error(err);
        } catch {
          // stream already closed/errored, e.g. the client disconnected
        }
      }
    },
    cancel() {
      iterator.return?.();
    },
  });
}

export const chatCompletionsRoutes = new Elysia({ prefix: "/v1" }).post(
  "/chat/completions",
  async ({ request, body, set }) => {
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
      return rateLimitExceededError(rateLimit.limit);
    }

    const provider = resolveProvider(body.model);
    if (!provider) {
      set.status = 404;
      return openAiError(
        `The model '${body.model}' does not exist.`,
        "model_not_found"
      );
    }

    const id = `chatcmpl-${crypto.randomUUID()}`;
    const created = Math.floor(Date.now() / 1000);

    if (body.stream) {
      const stream = streamChatCompletion(
        provider,
        id,
        created,
        body.model,
        body.messages
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
