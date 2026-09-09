import { describe, expect, it } from "bun:test";
import { checkRateLimit } from "../src/lib/rate-limiter";

describe("checkRateLimit", () => {
  it("allows requests while under the limit and decrements remaining", async () => {
    const keyId = `rl_under_${crypto.randomUUID()}`;

    const first = await checkRateLimit(keyId, 3);
    expect(first.allowed).toBe(true);
    expect(first.limit).toBe(3);
    expect(first.remaining).toBe(2);

    const second = await checkRateLimit(keyId, 3);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(1);

    const third = await checkRateLimit(keyId, 3);
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);
  });

  it("rejects requests once the limit is exceeded within the window", async () => {
    const keyId = `rl_exceed_${crypto.randomUUID()}`;

    await checkRateLimit(keyId, 2);
    await checkRateLimit(keyId, 2);

    const third = await checkRateLimit(keyId, 2);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);

    const fourth = await checkRateLimit(keyId, 2);
    expect(fourth.allowed).toBe(false);
  });

  it("returns a resetAt timestamp in the future, in unix seconds", async () => {
    const keyId = `rl_reset_${crypto.randomUUID()}`;
    const before = Math.floor(Date.now() / 1000);

    const result = await checkRateLimit(keyId, 1);

    expect(result.resetAt).toBeGreaterThanOrEqual(before);
    expect(result.resetAt).toBeLessThanOrEqual(before + 61);
  });

  it("tracks separate windows independently per key", async () => {
    const keyA = `rl_a_${crypto.randomUUID()}`;
    const keyB = `rl_b_${crypto.randomUUID()}`;

    await checkRateLimit(keyA, 1);
    const aSecond = await checkRateLimit(keyA, 1);
    expect(aSecond.allowed).toBe(false);

    const bFirst = await checkRateLimit(keyB, 1);
    expect(bFirst.allowed).toBe(true);
  });
});
