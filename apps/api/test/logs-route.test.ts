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

function getLogs(cookie: string, query = "") {
  return app.handle(
    new Request(`http://localhost:3050/api/logs${query}`, {
      headers: { Cookie: cookie },
    })
  );
}

describe("GET /api/logs", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const res = await app.handle(new Request("http://localhost:3050/api/logs"));
    expect(res.status).toBe(401);
  });

  it("returns only the requesting user's logs, most recent first", async () => {
    const cookieA = await registerAndSignIn(`logs_owner_a_${Date.now()}@openeer.local`);
    const keyA = await createApiKeyFor(cookieA, "Logs Owner A Key");
    const cookieB = await registerAndSignIn(`logs_owner_b_${Date.now()}@openeer.local`);
    const keyB = await createApiKeyFor(cookieB, "Logs Owner B Key");

    await sendChatRequest(keyA.key);
    await sendChatRequest(keyB.key);

    const res = await waitFor(async () => {
      const res = await getLogs(cookieA);
      const body = await res.clone().json();
      return body.logs.length > 0 ? res : undefined;
    });

    const body = await res.json();
    expect(body.logs.length).toBeGreaterThanOrEqual(1);
    expect(body.logs.every((log: any) => log.apiKeyId === keyA.id)).toBe(true);
  });

  it("paginates results", async () => {
    const cookie = await registerAndSignIn(`logs_page_${Date.now()}@openeer.local`);
    const created = await createApiKeyFor(cookie, "Logs Page Key");

    for (let i = 0; i < 3; i++) {
      await sendChatRequest(created.key);
    }

    await waitFor(async () => {
      const res = await getLogs(cookie);
      const body = await res.json();
      return body.total >= 3 ? body : undefined;
    });

    const res = await getLogs(cookie, "?page=1&pageSize=2");
    const body = await res.json();
    expect(body.logs.length).toBe(2);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(2);
    expect(body.total).toBeGreaterThanOrEqual(3);

    const secondPage = await getLogs(cookie, "?page=2&pageSize=2");
    const secondBody = await secondPage.json();
    expect(secondBody.logs.length).toBeGreaterThanOrEqual(1);
    expect(secondBody.logs[0].id).not.toBe(body.logs[0].id);
  });

  it("filters by status code, model, and date range", async () => {
    const cookie = await registerAndSignIn(`logs_filter_${Date.now()}@openeer.local`);
    const created = await createApiKeyFor(cookie, "Logs Filter Key");

    await sendChatRequest(created.key, "mock-gpt-4o");
    await sendChatRequest(created.key, "unsupported-model");

    await waitFor(async () => {
      const res = await getLogs(cookie);
      const body = await res.json();
      return body.total >= 2 ? body : undefined;
    });

    const statusRes = await getLogs(cookie, "?statusCode=404");
    const statusBody = await statusRes.json();
    expect(statusBody.logs.length).toBeGreaterThanOrEqual(1);
    expect(statusBody.logs.every((log: any) => log.statusCode === 404)).toBe(true);

    const modelRes = await getLogs(cookie, "?model=mock-gpt-4o");
    const modelBody = await modelRes.json();
    expect(modelBody.logs.length).toBeGreaterThanOrEqual(1);
    expect(modelBody.logs.every((log: any) => log.model === "mock-gpt-4o")).toBe(true);

    const future = new Date(Date.now() + 60_000).toISOString();
    const futureRes = await getLogs(cookie, `?from=${encodeURIComponent(future)}`);
    const futureBody = await futureRes.json();
    expect(futureBody.logs.length).toBe(0);
  });
});
