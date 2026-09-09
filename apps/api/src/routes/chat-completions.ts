import { Elysia, t } from "elysia";
import { authenticateApiKey } from "../lib/gateway-auth";
import { resolveProvider } from "../providers";

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

    const provider = resolveProvider(body.model);
    if (!provider) {
      set.status = 404;
      return openAiError(
        `The model '${body.model}' does not exist.`,
        "model_not_found"
      );
    }

    const result = await provider.createChatCompletion({
      model: body.model,
      messages: body.messages,
    });

    return {
      id: `chatcmpl-${crypto.randomUUID()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
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
    }),
  }
);
