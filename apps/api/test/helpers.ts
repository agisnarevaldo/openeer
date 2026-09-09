import { app } from "../src/index";

export async function registerAndSignIn(email: string): Promise<string> {
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
  return res.headers.get("set-cookie") || "";
}

export async function createApiKeyFor(
  cookie: string,
  name: string,
  rateLimitRpm?: number
): Promise<{ id: string; key: string }> {
  const res = await app.handle(
    new Request("http://localhost:3050/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ name, rateLimitRpm }),
    })
  );
  return res.json();
}

/**
 * Polls `check` until it returns a truthy value or `timeoutMs` elapses.
 * Used to observe fire-and-forget async work (e.g. audit log writes) that
 * completes shortly after an HTTP response is returned.
 */
export async function waitFor<T>(
  check: () => Promise<T | undefined | null>,
  { timeoutMs = 1000, intervalMs = 20 }: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await check();
    if (result) return result;
    if (Date.now() >= deadline) {
      throw new Error(`waitFor: condition not met within ${timeoutMs}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
