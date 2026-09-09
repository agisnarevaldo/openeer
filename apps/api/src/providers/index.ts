import { MockProvider } from "./mock-provider";
import type { AIProvider } from "./types";

export type { AIProvider, ChatCompletionRequest, ChatCompletionResult, ChatMessage } from "./types";
export { MockProvider } from "./mock-provider";

const mockProvider = new MockProvider();

export function resolveProvider(model: string): AIProvider | null {
  if (model.startsWith("mock-")) {
    return mockProvider;
  }
  return null;
}
