import { describe, expect, it } from "bun:test";
import { db, requestLog } from "@openeer/db";
import { eq } from "drizzle-orm";
import { app } from "../src/index";
import { registerAndSignIn, createApiKeyFor, waitFor } from "./helpers";

function findLogFor(apiKeyId: string) {
  return waitFor(async () => {
    const [row] = await db
      .select()
      .from(requestLog)
      .where(eq(requestLog.apiKeyId, apiKeyId))
      .orderBy(requestLog.createdAt);
    return row;
  });
}

describe("Audit logging on POST /v1/chat/completions", () => {
  it("logs a successful non-streaming completion without blocking the response", async () => {
    const cookie = await registerAndSignIn(`log_ok_${Date.now()}@openeer.local`);
    const created = await createApiKeyFor(cookie, "Log OK Key");

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
    expect(res.status).toBe(200);
    const body = await res.json();

    const row = await findLogFor(created.id);
    expect(row.model).toBe("mock-gpt-4o");
    expect(row.statusCode).toBe(200);
    expect(row.errorMessage).toBeNull();
    expect(row.promptTokens).toBe(body.usage.prompt_tokens);
    expect(row.completionTokens).toBe(body.usage.completion_tokens);
    expect(row.totalTokens).toBe(body.usage.total_tokens);
    expect(row.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("logs a 429 rate-limited request with zero tokens and the error message", async () => {
    const cookie = await registerAndSignIn(`log_429_${Date.now()}@openeer.local`);
    const created = await createApiKeyFor(cookie, "Log 429 Key", 1);

    await app.handle(
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

    const rejected = await app.handle(
      new Request("http://localhost:3050/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${created.key}`,
        },
        body: JSON.stringify({
          model: "mock-gpt-4o",
          messages: [{ role: "user", content: "Hi again" }],
        }),
      })
    );
    expect(rejected.status).toBe(429);

    const rows = await waitFor(async () => {
      const rows = await db
        .select()
        .from(requestLog)
        .where(eq(requestLog.apiKeyId, created.id));
      return rows.length >= 2 ? rows : undefined;
    });

    const rejectedRow = rows.find((row) => row.statusCode === 429);
    expect(rejectedRow).toBeDefined();
    expect(rejectedRow!.totalTokens).toBe(0);
    expect(rejectedRow!.errorMessage).toBe(
      "Rate limit exceeded. Maximum 1 requests per minute."
    );
  });

  it("logs a 404 model_not_found request", async () => {
    const cookie = await registerAndSignIn(`log_404_${Date.now()}@openeer.local`);
    const created = await createApiKeyFor(cookie, "Log 404 Key");

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

    const row = await findLogFor(created.id);
    expect(row.model).toBe("gpt-4o");
    expect(row.statusCode).toBe(404);
    expect(row.totalTokens).toBe(0);
    expect(row.errorMessage).toBe("The model 'gpt-4o' does not exist.");
  });

  it("logs a streaming completion once the stream finishes", async () => {
    const cookie = await registerAndSignIn(`log_stream_${Date.now()}@openeer.local`);
    const created = await createApiKeyFor(cookie, "Log Stream Key");

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
    await res.text(); // drain the stream so it fully completes

    const row = await findLogFor(created.id);
    expect(row.model).toBe("mock-gpt-4o");
    expect(row.statusCode).toBe(200);
    expect(row.errorMessage).toBeNull();
    expect(row.totalTokens).toBeGreaterThan(0);
  });
});
