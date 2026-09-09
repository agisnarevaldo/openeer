import { describe, expect, it } from "bun:test";
import { db, apiKey, requestLog } from "@openeer/db";
import { eq } from "drizzle-orm";
import { logRequestAsync } from "../src/lib/request-logger";
import { registerAndSignIn, createApiKeyFor, waitFor } from "./helpers";

describe("logRequestAsync", () => {
  it("writes a row without the caller awaiting completion", async () => {
    const cookie = await registerAndSignIn(`log_write_${Date.now()}@openeer.local`);
    const created = await createApiKeyFor(cookie, "Log Write Key");

    logRequestAsync({
      apiKeyId: created.id,
      model: "mock-gpt-4o",
      promptTokens: 5,
      completionTokens: 7,
      totalTokens: 12,
      latencyMs: 42,
      statusCode: 200,
      errorMessage: null,
      ipAddress: "127.0.0.1",
    });

    const row = await waitFor(async () => {
      const [row] = await db
        .select()
        .from(requestLog)
        .where(eq(requestLog.apiKeyId, created.id));
      return row;
    });

    expect(row.model).toBe("mock-gpt-4o");
    expect(row.promptTokens).toBe(5);
    expect(row.completionTokens).toBe(7);
    expect(row.totalTokens).toBe(12);
    expect(row.latencyMs).toBe(42);
    expect(row.statusCode).toBe(200);
    expect(row.errorMessage).toBeNull();
    expect(row.ipAddress).toBe("127.0.0.1");
    expect(row.createdAt).toBeInstanceOf(Date);
  });

  it("records a non-null errorMessage for failed requests", async () => {
    const cookie = await registerAndSignIn(`log_error_${Date.now()}@openeer.local`);
    const created = await createApiKeyFor(cookie, "Log Error Key");

    logRequestAsync({
      apiKeyId: created.id,
      model: "gpt-4o",
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      latencyMs: 3,
      statusCode: 404,
      errorMessage: "The model 'gpt-4o' does not exist.",
      ipAddress: null,
    });

    const row = await waitFor(async () => {
      const [row] = await db
        .select()
        .from(requestLog)
        .where(eq(requestLog.apiKeyId, created.id));
      return row;
    });

    expect(row.statusCode).toBe(404);
    expect(row.errorMessage).toBe("The model 'gpt-4o' does not exist.");
    expect(row.ipAddress).toBeNull();
  });

  it("does not throw when given a nonexistent apiKeyId, and logs the failure", async () => {
    expect(() =>
      logRequestAsync({
        apiKeyId: crypto.randomUUID(),
        model: "mock-gpt-4o",
        promptTokens: 1,
        completionTokens: 1,
        totalTokens: 2,
        latencyMs: 1,
        statusCode: 200,
        errorMessage: null,
        ipAddress: null,
      })
    ).not.toThrow();
  });
});
