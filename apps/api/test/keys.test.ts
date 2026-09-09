import { describe, expect, it } from "bun:test";
import { app } from "../src/index";
import { API_KEY_PREFIX } from "../src/lib/api-keys";

async function registerAndSignIn(email: string) {
  const res = await app.handle(
    new Request("http://localhost:3050/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Developer",
        email,
        password: "securePassword123!",
      }),
    })
  );

  const setCookieHeader = res.headers.get("set-cookie");
  return setCookieHeader || "";
}

describe("API Key Generation & Hash-at-Rest Management", () => {
  it("rejects unauthenticated requests to create an API key", async () => {
    const res = await app.handle(
      new Request("http://localhost:3050/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "My Key" }),
      })
    );

    expect(res.status).toBe(401);
  });

  it("rejects unauthenticated requests to list API keys", async () => {
    const res = await app.handle(
      new Request("http://localhost:3050/api/keys")
    );

    expect(res.status).toBe(401);
  });

  it("creates an API key, revealing the plaintext secret only in the creation response", async () => {
    const cookie = await registerAndSignIn(`keys_create_${Date.now()}@openeer.local`);

    const res = await app.handle(
      new Request("http://localhost:3050/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ name: "CI Key", rateLimitRpm: 120 }),
      })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.key.startsWith(API_KEY_PREFIX)).toBe(true);
    expect(body.name).toBe("CI Key");
    expect(body.rateLimitRpm).toBe(120);
    expect(body.isActive).toBe(true);
    expect(body.keyHash).toBeUndefined();
  });

  it("lists active keys for the authenticated user without exposing secrets", async () => {
    const cookie = await registerAndSignIn(`keys_list_${Date.now()}@openeer.local`);

    await app.handle(
      new Request("http://localhost:3050/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ name: "List Key" }),
      })
    );

    const res = await app.handle(
      new Request("http://localhost:3050/api/keys", {
        headers: { Cookie: cookie },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.keys).toHaveLength(1);
    expect(body.keys[0].name).toBe("List Key");
    expect(body.keys[0].keyPrefix).toBe(API_KEY_PREFIX);
    expect(body.keys[0].lastFour).toHaveLength(4);
    expect(body.keys[0].key).toBeUndefined();
    expect(body.keys[0].keyHash).toBeUndefined();
  });

  it("revokes an API key so it no longer appears in the active list", async () => {
    const cookie = await registerAndSignIn(`keys_revoke_${Date.now()}@openeer.local`);

    const createRes = await app.handle(
      new Request("http://localhost:3050/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ name: "Revoke Key" }),
      })
    );
    const created = await createRes.json();

    const deleteRes = await app.handle(
      new Request(`http://localhost:3050/api/keys/${created.id}`, {
        method: "DELETE",
        headers: { Cookie: cookie },
      })
    );
    expect(deleteRes.status).toBe(200);

    const listRes = await app.handle(
      new Request("http://localhost:3050/api/keys", {
        headers: { Cookie: cookie },
      })
    );
    const listBody = await listRes.json();
    expect(listBody.keys).toHaveLength(0);
  });

  it("returns 404 when revoking a key that does not belong to the user", async () => {
    const cookieA = await registerAndSignIn(`keys_owner_${Date.now()}@openeer.local`);
    const cookieB = await registerAndSignIn(`keys_intruder_${Date.now()}@openeer.local`);

    const createRes = await app.handle(
      new Request("http://localhost:3050/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieA },
        body: JSON.stringify({ name: "Owner Key" }),
      })
    );
    const created = await createRes.json();

    const deleteRes = await app.handle(
      new Request(`http://localhost:3050/api/keys/${created.id}`, {
        method: "DELETE",
        headers: { Cookie: cookieB },
      })
    );

    expect(deleteRes.status).toBe(404);
  });

  it("rejects revocation of a malformed key id without a server error", async () => {
    const cookie = await registerAndSignIn(`keys_bad_id_${Date.now()}@openeer.local`);

    const res = await app.handle(
      new Request("http://localhost:3050/api/keys/not-a-uuid", {
        method: "DELETE",
        headers: { Cookie: cookie },
      })
    );

    expect(res.status).toBeLessThan(500);
  });

  it("rejects a non-positive rate limit", async () => {
    const cookie = await registerAndSignIn(`keys_bad_rate_${Date.now()}@openeer.local`);

    const res = await app.handle(
      new Request("http://localhost:3050/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ name: "Bad Rate Key", rateLimitRpm: -5 }),
      })
    );

    expect(res.status).toBe(422);
  });
});
