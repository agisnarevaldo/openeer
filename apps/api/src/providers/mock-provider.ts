import type {
  AIProvider,
  ChatCompletionRequest,
  ChatCompletionResult,
} from "./types";

const CHARS_PER_TOKEN = 4;
const ROLE_OVERHEAD_TOKENS = 1;

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / CHARS_PER_TOKEN));
}

export class MockProvider implements AIProvider {
  createChatCompletion({
    model,
    messages,
  }: ChatCompletionRequest): ChatCompletionResult {
    const lastUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === "user");

    const content = `This is a simulated response from ${model} to: "${
      lastUserMessage?.content ?? ""
    }"`;

    const promptTokens = messages.reduce(
      (total, message) =>
        total + estimateTokens(message.content) + ROLE_OVERHEAD_TOKENS,
      0
    );
    const completionTokens = estimateTokens(content);

    return {
      content,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
    };
  }
}
