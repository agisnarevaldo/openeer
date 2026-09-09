export type ChatMessageRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatMessageRole;
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
}

export interface ChatCompletionUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatCompletionResult {
  content: string;
  usage: ChatCompletionUsage;
}

export interface ChatCompletionChunk {
  content: string;
}

export interface AIProvider {
  createChatCompletion(
    request: ChatCompletionRequest
  ): Promise<ChatCompletionResult> | ChatCompletionResult;
  /**
   * Yields content chunks and, once the stream finishes normally, returns
   * the completion's usage — so callers who need usage for logging/billing
   * don't have to make a second, redundant completion call.
   */
  chatCompletionStream(
    request: ChatCompletionRequest
  ): AsyncGenerator<ChatCompletionChunk, ChatCompletionUsage, void>;
}
