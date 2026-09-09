import { describe, expect, it } from "bun:test";
import { MockProvider, STREAM_CHUNK_DELAY_MS } from "../src/providers/mock-provider";

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

  it("streams the same content as the non-streaming response, split into multiple chunks", async () => {
    const request = {
      model: "mock-gpt-4o",
      messages: [{ role: "user" as const, content: "What is the capital of France?" }],
    };

    const full = await provider.createChatCompletion(request);

    const chunks: string[] = [];
    for await (const chunk of provider.chatCompletionStream(request)) {
      chunks.push(chunk.content);
    }

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join("")).toBe(full.content);
  });

  it("waits at least STREAM_CHUNK_DELAY_MS between chunks", async () => {
    const timestamps: number[] = [];

    for await (const _chunk of provider.chatCompletionStream({
      model: "mock-gpt-4o",
      messages: [{ role: "user", content: "Hello there, this is a longer message" }],
    })) {
      timestamps.push(performance.now());
    }

    expect(timestamps.length).toBeGreaterThan(1);
    for (let i = 1; i < timestamps.length; i++) {
      // Allow 1ms of timer jitter below the nominal delay.
      expect(timestamps[i] - timestamps[i - 1]).toBeGreaterThanOrEqual(
        STREAM_CHUNK_DELAY_MS - 1
      );
    }
  });
});
