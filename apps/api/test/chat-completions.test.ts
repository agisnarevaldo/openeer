import { describe, expect, it } from "bun:test";
import { app } from "../src/index";
import { generateApiKey } from "../src/lib/api-keys";
import { registerAndSignIn, createApiKeyFor } from "./helpers";

describe("POST /v1/chat/completions", () => {
  it("rejects requests with no Authorization header", async () => {
    const res = await app.handle(
      new Request("http://localhost:3050/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "mock-gpt-4o",
          messages: [{ role: "user", content: "Hi" }],
        }),
      })
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.type).toBe("invalid_request_error");
    expect(body.error.code).toBe("invalid_api_key");
  });

  it("rejects requests with an invalid API key", async () => {
    const { key } = generateApiKey();
    const res = await app.handle(
      new Request("http://localhost:3050/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: "mock-gpt-4o",
          messages: [{ role: "user", content: "Hi" }],
        }),
      })
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("invalid_api_key");
  });

  it("rejects requests with a revoked API key", async () => {
    const cookie = await registerAndSignIn(`chat_revoked_${Date.now()}@openeer.local`);
    const created = await createApiKeyFor(cookie, "Chat Revoked Key");

    await app.handle(
      new Request(`http://localhost:3050/api/keys/${created.id}`, {
        method: "DELETE",
        headers: { Cookie: cookie },
      })
    );

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
        }),
      })
    );

    expect(res.status).toBe(401);
  });

  it("returns an OpenAI-compliant completion for a valid key", async () => {
    const cookie = await registerAndSignIn(`chat_valid_${Date.now()}@openeer.local`);
    const created = await createApiKeyFor(cookie, "Chat Valid Key");

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
        }),
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.object).toBe("chat.completion");
    expect(body.model).toBe("mock-gpt-4o");
    expect(typeof body.id).toBe("string");
    expect(typeof body.created).toBe("number");
    expect(body.choices).toHaveLength(1);
    expect(body.choices[0].message.role).toBe("assistant");
    expect(body.choices[0].message.content).toContain("What is 2+2?");
    expect(body.choices[0].finish_reason).toBe("stop");
    expect(body.usage.prompt_tokens).toBeGreaterThan(0);
    expect(body.usage.completion_tokens).toBeGreaterThan(0);
    expect(body.usage.total_tokens).toBe(
      body.usage.prompt_tokens + body.usage.completion_tokens
    );
  });

  it("returns a 404 model_not_found error for an unsupported model", async () => {
    const cookie = await registerAndSignIn(`chat_bad_model_${Date.now()}@openeer.local`);
    const created = await createApiKeyFor(cookie, "Chat Bad Model Key");

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
        }),
      })
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("model_not_found");
  });
});
