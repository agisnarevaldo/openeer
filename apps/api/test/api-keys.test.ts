import { describe, expect, it } from "bun:test";
import {
  API_KEY_PREFIX,
  generateApiKey,
  hashApiKey,
} from "../src/lib/api-keys";

describe("API Key generation", () => {
  it("generates a plaintext key with the op_live_ prefix", () => {
    const { key } = generateApiKey();

    expect(key.startsWith(API_KEY_PREFIX)).toBe(true);
  });

  it("generates unique keys on each call", () => {
    const first = generateApiKey();
    const second = generateApiKey();

    expect(first.key).not.toBe(second.key);
  });

  it("returns the prefix and last four characters of the plaintext key", () => {
    const { key, prefix, lastFour } = generateApiKey();

    expect(prefix).toBe(API_KEY_PREFIX);
    expect(key.endsWith(lastFour)).toBe(true);
    expect(lastFour).toHaveLength(4);
  });

  it("returns a SHA-256 hash of the plaintext key, not the plaintext itself", () => {
    const { key, hash } = generateApiKey();

    expect(hash).not.toBe(key);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toBe(hashApiKey(key));
  });

  it("hashes the same plaintext key deterministically", () => {
    const { key, hash } = generateApiKey();

    expect(hashApiKey(key)).toBe(hash);
  });
});
