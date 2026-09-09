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

export interface AIProvider {
  createChatCompletion(
    request: ChatCompletionRequest
  ): Promise<ChatCompletionResult> | ChatCompletionResult;
}
