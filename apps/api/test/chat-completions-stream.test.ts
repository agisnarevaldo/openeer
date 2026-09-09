import { describe, expect, it } from "bun:test";
import { app } from "../src/index";

async function registerAndSignIn(email: string) {
  const res = await app.handle(
    new Request("http://localhost:3050/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Stream Test Developer",
        email,
        password: "securePassword123!",
      }),
    })
  );
  return res.headers.get("set-cookie") || "";
}

async function createApiKeyFor(cookie: string, name: string) {
  const res = await app.handle(
    new Request("http://localhost:3050/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ name }),
    })
  );
  return res.json();
}

async function readSseEvents(res: Response): Promise<string[]> {
  const text = await res.text();
  return text
    .split("\n\n")
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);
}

describe("POST /v1/chat/completions (stream: true)", () => {
  it("sets Content-Type: text/event-stream", async () => {
    const cookie = await registerAndSignIn(`stream_headers_${Date.now()}@openeer.local`);
    const created = await createApiKeyFor(cookie, "Stream Headers Key");

    const res = await app.handle(
      new Request("http://localhost:3050/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${created.key}`,
        },
        body: JSON.stringify({
          model: "mock-gpt-4o",
          messages: [{ role: "user", content: "Hi" }],
          stream: true,
        }),
      })
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toStartWith("text/event-stream");
  });

  it("streams chunks matching the OpenAI wire protocol and ends with [DONE]", async () => {
    const cookie = await registerAndSignIn(`stream_chunks_${Date.now()}@openeer.local`);
    const created = await createApiKeyFor(cookie, "Stream Chunks Key");

    const res = await app.handle(
      new Request("http://localhost:3050/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${created.key}`,
        },
        body: JSON.stringify({
          model: "mock-gpt-4o",
          messages: [{ role: "user", content: "What is 2+2?" }],
          stream: true,
        }),
      })
    );

    const events = await readSseEvents(res);
    expect(events.length).toBeGreaterThan(1);

    const last = events[events.length - 1];
    expect(last).toBe("data: [DONE]");

    const chunkEvents = events.slice(0, -1);
    expect(chunkEvents.length).toBeGreaterThan(0);

    let assembled = "";
    for (const event of chunkEvents) {
      expect(event.startsWith("data: ")).toBe(true);
      const payload = JSON.parse(event.slice("data: ".length));
      expect(payload.object).toBe("chat.completion.chunk");
      expect(typeof payload.id).toBe("string");
      expect(payload.model).toBe("mock-gpt-4o");
      expect(payload.choices).toHaveLength(1);
      expect(payload.choices[0].index).toBe(0);
      expect(typeof payload.choices[0].delta).toBe("object");
      if (typeof payload.choices[0].delta.content === "string") {
        assembled += payload.choices[0].delta.content;
      }
    }

    expect(assembled).toContain("What is 2+2?");

    const finalChunk = JSON.parse(chunkEvents[chunkEvents.length - 1].slice("data: ".length));
    expect(finalChunk.choices[0].finish_reason).toBe("stop");
  });

  it("rejects an invalid API key with a normal JSON 401, not a stream", async () => {
    const res = await app.handle(
      new Request("http://localhost:3050/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "mock-gpt-4o",
          messages: [{ role: "user", content: "Hi" }],
          stream: true,
        }),
      })
    );

    expect(res.status).toBe(401);
    expect(res.headers.get("content-type")).not.toStartWith("text/event-stream");
    const body = await res.json();
    expect(body.error.code).toBe("invalid_api_key");
  });

  it("rejects an unsupported model with a normal JSON 404, not a stream", async () => {
    const cookie = await registerAndSignIn(`stream_bad_model_${Date.now()}@openeer.local`);
    const created = await createApiKeyFor(cookie, "Stream Bad Model Key");

    const res = await app.handle(
      new Request("http://localhost:3050/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${created.key}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [{ role: "user", content: "Hi" }],
          stream: true,
        }),
      })
    );

    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).not.toStartWith("text/event-stream");
    const body = await res.json();
    expect(body.error.code).toBe("model_not_found");
  });
});
