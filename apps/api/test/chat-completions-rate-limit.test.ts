import { describe, expect, it } from "bun:test";
import { app } from "../src/index";
import { registerAndSignIn, createApiKeyFor } from "./helpers";

function sendChatRequest(apiKey: string) {
  return app.handle(
    new Request("http://localhost:3050/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "mock-gpt-4o",
        messages: [{ role: "user", content: "Hi" }],
      }),
    })
  );
}

describe("Rate limiting on POST /v1/chat/completions", () => {
  it("includes rate limit headers and decrements Remaining on each request", async () => {
    const cookie = await registerAndSignIn(`rl_headers_${Date.now()}@openeer.local`);
    const created = await createApiKeyFor(cookie, "Rate Limit Headers Key", 5);

    const first = await sendChatRequest(created.key);
    expect(first.status).toBe(200);
    expect(first.headers.get("x-ratelimit-limit")).toBe("5");
    expect(first.headers.get("x-ratelimit-remaining")).toBe("4");
    expect(Number(first.headers.get("x-ratelimit-reset"))).toBeGreaterThan(0);

    const second = await sendChatRequest(created.key);
    expect(second.status).toBe(200);
    expect(second.headers.get("x-ratelimit-remaining")).toBe("3");
  });

  it("allows requests up to the configured limit", async () => {
    const cookie = await registerAndSignIn(`rl_under_${Date.now()}@openeer.local`);
    const created = await createApiKeyFor(cookie, "Rate Limit Under Key", 3);

    for (let i = 0; i < 3; i++) {
      const res = await sendChatRequest(created.key);
      expect(res.status).toBe(200);
    }
  });

  it("rejects requests over the limit with 429 and an OpenAI-compatible error envelope", async () => {
    const cookie = await registerAndSignIn(`rl_over_${Date.now()}@openeer.local`);
    const created = await createApiKeyFor(cookie, "Rate Limit Over Key", 2);

    await sendChatRequest(created.key);
    await sendChatRequest(created.key);

    const res = await sendChatRequest(created.key);
    expect(res.status).toBe(429);
    expect(res.headers.get("x-ratelimit-remaining")).toBe("0");

    const body = await res.json();
    expect(body.error.message).toBe(
      "Rate limit exceeded. Maximum 2 requests per minute."
    );
    expect(body.error.type).toBe("rate_limit_error");
    expect(body.error.code).toBe("rate_limit_exceeded");
  });

  it("rate-limits independently per API key", async () => {
    const cookieA = await registerAndSignIn(`rl_indep_a_${Date.now()}@openeer.local`);
    const keyA = await createApiKeyFor(cookieA, "Rate Limit Key A", 1);
    const cookieB = await registerAndSignIn(`rl_indep_b_${Date.now()}@openeer.local`);
    const keyB = await createApiKeyFor(cookieB, "Rate Limit Key B", 1);

    const aFirst = await sendChatRequest(keyA.key);
    expect(aFirst.status).toBe(200);
    const aSecond = await sendChatRequest(keyA.key);
    expect(aSecond.status).toBe(429);

    const bFirst = await sendChatRequest(keyB.key);
    expect(bFirst.status).toBe(200);
  });
});
