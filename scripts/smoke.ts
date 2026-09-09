/**
 * End-to-end smoke test against a running, seeded Openeer stack.
 *
 * Prerequisites: `bun run docker:up`, `bun run db:seed`, `bun run dev:api`,
 * and `bun run dev:web` must all be running first — this hits the real
 * Caddy gateway at localhost:8088, not an in-process test harness.
 *
 * Cycle: login -> key list -> chat completion -> log verify.
 */

const BASE_URL = process.env.SMOKE_BASE_URL || "http://localhost:8088";
const DEV_EMAIL = "dev@openeer.local";
const DEV_PASSWORD = "openeer123";
const DEMO_API_KEY = "op_live_demo1234567890abcdef1234567890ab";

let passed = 0;
let failed = 0;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function step(name: string, fn: () => Promise<void>): Promise<void> {
  process.stdout.write(`- ${name}... `);
  try {
    await fn();
    console.log("OK");
    passed++;
  } catch (err) {
    console.log("FAILED");
    console.error(`  ${err instanceof Error ? err.message : err}`);
    failed++;
    throw err;
  }
}

async function waitForGateway(): Promise<void> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/health`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    `Gateway not reachable at ${BASE_URL} after 20s. Is \`bun run docker:up\` + the dev servers running?`
  );
}

async function main() {
  console.log(`Running smoke test against ${BASE_URL}\n`);

  await step("gateway is reachable", waitForGateway);

  let sessionCookie = "";
  await step("login as the seeded developer account", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: DEV_EMAIL, password: DEV_PASSWORD }),
    });
    const cookie = res.headers.get("set-cookie");
    if (!res.ok) {
      throw new Error(`sign-in failed with status ${res.status}: ${await res.text()}`);
    }
    assert(cookie, "sign-in response had no set-cookie header");
    sessionCookie = cookie;
  });

  await step("key list includes the seeded demo key", async () => {
    const res = await fetch(`${BASE_URL}/api/keys`, {
      headers: { Cookie: sessionCookie },
    });
    assert(res.ok, `GET /api/keys failed with status ${res.status}`);
    const body = await res.json();
    const demoKey = body.keys.find((k: any) => k.keyPrefix === "op_live_" && k.lastFour === "90ab");
    assert(demoKey, "seeded demo key not found in /api/keys response");
    assert(demoKey.isActive, "seeded demo key is not active");
  });

  await step("chat completion succeeds with the demo API key", async () => {
    const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEMO_API_KEY}`,
      },
      body: JSON.stringify({
        model: "mock-gpt-4o",
        messages: [{ role: "user", content: "Smoke test ping" }],
      }),
    });
    const raw = await res.text();
    assert(res.ok, `chat completion failed with status ${res.status}: ${raw}`);
    const body = JSON.parse(raw);
    assert(body.object === "chat.completion", "unexpected response shape from /v1/chat/completions");
    assert(body.usage.total_tokens > 0, "expected non-zero token usage");
  });

  await step("the chat completion is recorded in request logs", async () => {
    const deadline = Date.now() + 5_000;
    let found = false;
    while (Date.now() < deadline && !found) {
      const res = await fetch(`${BASE_URL}/api/logs?model=mock-gpt-4o&statusCode=200`, {
        headers: { Cookie: sessionCookie },
      });
      assert(res.ok, `GET /api/logs failed with status ${res.status}`);
      const body = await res.json();
      found = body.logs.length > 0;
      if (!found) await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert(found, "no matching request log appeared within 5s of the chat completion");
  });

  console.log(`\n${passed} passed, ${failed} failed.`);
}

main().catch(() => {
  console.log(`\n${passed} passed, ${failed} failed.`);
  process.exitCode = 1;
});
