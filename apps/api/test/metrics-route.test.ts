import { describe, expect, it } from "bun:test";
import { app } from "../src/index";
import { registerAndSignIn, createApiKeyFor, waitFor } from "./helpers";

function sendChatRequest(apiKey: string, model = "mock-gpt-4o") {
  return app.handle(
    new Request("http://localhost:3050/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Hi" }],
      }),
    })
  );
}

function getSummary(cookie: string) {
  return app.handle(
    new Request("http://localhost:3050/api/metrics/summary", {
      headers: { Cookie: cookie },
    })
  );
}

describe("GET /api/metrics/summary", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const res = await app.handle(
      new Request("http://localhost:3050/api/metrics/summary")
    );
    expect(res.status).toBe(401);
  });

  it("returns zeroed metrics for a user with no requests yet", async () => {
    const cookie = await registerAndSignIn(`metrics_empty_${Date.now()}@openeer.local`);

    const res = await getSummary(cookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalRequests).toBe(0);
    expect(body.totalTokens).toBe(0);
    expect(body.avgLatencyMs).toBe(0);
    expect(body.windowHours).toBe(24);
  });

  it("aggregates total requests, total tokens, and average latency for the last 24h", async () => {
    const cookie = await registerAndSignIn(`metrics_agg_${Date.now()}@openeer.local`);
    const created = await createApiKeyFor(cookie, "Metrics Agg Key");

    await sendChatRequest(created.key);
    await sendChatRequest(created.key);

    const body = await waitFor(async () => {
      const res = await getSummary(cookie);
      const body = await res.json();
      return body.totalRequests >= 2 ? body : undefined;
    });

    expect(body.totalRequests).toBe(2);
    expect(body.totalTokens).toBeGreaterThan(0);
    expect(body.avgLatencyMs).toBeGreaterThanOrEqual(0);
  });

  it("only counts the requesting user's own requests", async () => {
    const cookieA = await registerAndSignIn(`metrics_owner_a_${Date.now()}@openeer.local`);
    const keyA = await createApiKeyFor(cookieA, "Metrics Owner A Key");
    const cookieB = await registerAndSignIn(`metrics_owner_b_${Date.now()}@openeer.local`);
    const keyB = await createApiKeyFor(cookieB, "Metrics Owner B Key");

    await sendChatRequest(keyA.key);

    await waitFor(async () => {
      const res = await getSummary(cookieA);
      const body = await res.json();
      return body.totalRequests >= 1 ? body : undefined;
    });

    const resB = await getSummary(cookieB);
    const bodyB = await resB.json();
    expect(bodyB.totalRequests).toBe(0);
  });
});
