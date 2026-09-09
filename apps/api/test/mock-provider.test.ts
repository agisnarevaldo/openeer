import { describe, expect, it } from "bun:test";
import { MockProvider } from "../src/providers/mock-provider";

describe("MockProvider", () => {
  const provider = new MockProvider();

  it("generates an assistant response for mock-gpt-4o", async () => {
    const result = await provider.createChatCompletion({
      model: "mock-gpt-4o",
      messages: [{ role: "user", content: "Hello there" }],
    });

    expect(result.content.length).toBeGreaterThan(0);
  });

  it("references the latest user message in the response", async () => {
    const result = await provider.createChatCompletion({
      model: "mock-gpt-4o",
      messages: [
        { role: "system", content: "You are helpful." },
        { role: "user", content: "What is the capital of France?" },
      ],
    });

    expect(result.content).toContain("What is the capital of France?");
  });

  it("calculates prompt and completion token counts from message length", async () => {
    const short = await provider.createChatCompletion({
      model: "mock-gpt-4o",
      messages: [{ role: "user", content: "Hi" }],
    });
    const long = await provider.createChatCompletion({
      model: "mock-gpt-4o",
      messages: [
        {
          role: "user",
          content:
            "This is a much longer message that should produce a larger prompt token count than a short greeting.",
        },
      ],
    });

    expect(long.usage.promptTokens).toBeGreaterThan(short.usage.promptTokens);
    expect(short.usage.promptTokens).toBeGreaterThan(0);
    expect(short.usage.completionTokens).toBeGreaterThan(0);
    expect(short.usage.totalTokens).toBe(
      short.usage.promptTokens + short.usage.completionTokens
    );
  });
});
