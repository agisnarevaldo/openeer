import type {
  AIProvider,
  ChatCompletionChunk,
  ChatCompletionRequest,
  ChatCompletionResult,
  ChatCompletionUsage,
} from "./types";

const CHARS_PER_TOKEN = 4;
const ROLE_OVERHEAD_TOKENS = 1;
export const STREAM_CHUNK_DELAY_MS = 5;

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / CHARS_PER_TOKEN));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function splitIntoWordChunks(text: string): string[] {
  return text.match(/\S+\s*/g) ?? [text];
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

  async *chatCompletionStream(
    request: ChatCompletionRequest
  ): AsyncGenerator<ChatCompletionChunk, ChatCompletionUsage, void> {
    const { content, usage } = this.createChatCompletion(request);

    for (const word of splitIntoWordChunks(content)) {
      await delay(STREAM_CHUNK_DELAY_MS);
      yield { content: word };
    }

    return usage;
  }
}
