import { describe, expect, it } from "bun:test";
import { db, apiKey } from "@openeer/db";
import { eq } from "drizzle-orm";
import { app } from "../src/index";
import { authenticateApiKey } from "../src/lib/gateway-auth";
import { generateApiKey } from "../src/lib/api-keys";
import { getCachedApiKey, setCachedApiKey } from "../src/lib/api-key-cache";

async function registerAndSignIn(email: string) {
  const res = await app.handle(
    new Request("http://localhost:3050/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Gateway Test Developer",
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

describe("authenticateApiKey", () => {
  it("returns null when the Authorization header is missing", async () => {
    const result = await authenticateApiKey(
      new Request("http://localhost:3050/v1/chat/completions")
    );
    expect(result).toBeNull();
  });

  it("returns null for a well-formed but unknown key", async () => {
    const { key } = generateApiKey();
    const result = await authenticateApiKey(
      new Request("http://localhost:3050/v1/chat/completions", {
        headers: { Authorization: `Bearer ${key}` },
      })
    );
    expect(result).toBeNull();
  });

  it("resolves and caches a valid, active key", async () => {
    const cookie = await registerAndSignIn(`gw_auth_${Date.now()}@openeer.local`);
    const created = await createApiKeyFor(cookie, "Gateway Auth Key");

    const result = await authenticateApiKey(
      new Request("http://localhost:3050/v1/chat/completions", {
        headers: { Authorization: `Bearer ${created.key}` },
      })
    );

    expect(result).not.toBeNull();
    expect(result?.userId).toBeTruthy();

    const [row] = await db
      .select({ keyHash: apiKey.keyHash })
      .from(apiKey)
      .where(eq(apiKey.id, created.id));
    const cached = await getCachedApiKey(row.keyHash);
    expect(cached?.userId).toBe(result?.userId);
  });

  it("records lastUsedAt on the first successful authentication", async () => {
    const cookie = await registerAndSignIn(`gw_auth_last_used_${Date.now()}@openeer.local`);
    const created = await createApiKeyFor(cookie, "Gateway Last Used Key");

    await authenticateApiKey(
      new Request("http://localhost:3050/v1/chat/completions", {
        headers: { Authorization: `Bearer ${created.key}` },
      })
    );

    const [row] = await db
      .select({ lastUsedAt: apiKey.lastUsedAt })
      .from(apiKey)
      .where(eq(apiKey.id, created.id));
    expect(row.lastUsedAt).not.toBeNull();
  });

  it("returns null once the key has been revoked", async () => {
    const cookie = await registerAndSignIn(`gw_auth_revoke_${Date.now()}@openeer.local`);
    const created = await createApiKeyFor(cookie, "Gateway Revoke Key");

    await app.handle(
      new Request(`http://localhost:3050/api/keys/${created.id}`, {
        method: "DELETE",
        headers: { Cookie: cookie },
      })
    );

    const result = await authenticateApiKey(
      new Request("http://localhost:3050/v1/chat/completions", {
        headers: { Authorization: `Bearer ${created.key}` },
      })
    );

    expect(result).toBeNull();
  });

  it("stops authenticating a key immediately after it is revoked, even if cached", async () => {
    const cookie = await registerAndSignIn(`gw_auth_cache_revoke_${Date.now()}@openeer.local`);
    const created = await createApiKeyFor(cookie, "Gateway Cache Revoke Key");

    const first = await authenticateApiKey(
      new Request("http://localhost:3050/v1/chat/completions", {
        headers: { Authorization: `Bearer ${created.key}` },
      })
    );
    expect(first).not.toBeNull();

    await app.handle(
      new Request(`http://localhost:3050/api/keys/${created.id}`, {
        method: "DELETE",
        headers: { Cookie: cookie },
      })
    );

    const second = await authenticateApiKey(
      new Request("http://localhost:3050/v1/chat/completions", {
        headers: { Authorization: `Bearer ${created.key}` },
      })
    );
    expect(second).toBeNull();
  });

  it("does not let a stale write re-cache a key as valid right after it is revoked", async () => {
    const cookie = await registerAndSignIn(`gw_auth_race_${Date.now()}@openeer.local`);
    const created = await createApiKeyFor(cookie, "Gateway Race Key");

    const [row] = await db
      .select({ keyHash: apiKey.keyHash })
      .from(apiKey)
      .where(eq(apiKey.id, created.id));

    // Simulate an in-flight authenticateApiKey() call that read the key as
    // valid from Postgres just before the revoke below, and only attempts
    // to populate the cache afterward.
    await app.handle(
      new Request(`http://localhost:3050/api/keys/${created.id}`, {
        method: "DELETE",
        headers: { Cookie: cookie },
      })
    );

    await setCachedApiKey(row.keyHash, {
      userId: "stale-user-id",
      keyId: created.id,
      rateLimitRpm: 60,
    });

    const cached = await getCachedApiKey(row.keyHash);
    expect(cached).toBeNull();

    const result = await authenticateApiKey(
      new Request("http://localhost:3050/v1/chat/completions", {
        headers: { Authorization: `Bearer ${created.key}` },
      })
    );
    expect(result).toBeNull();
  });
});
