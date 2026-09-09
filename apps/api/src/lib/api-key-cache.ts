import { API_KEY_CACHE_KEY_PREFIX, API_KEY_CACHE_TTL_SECONDS } from "@openeer/db";
import type { CachedApiKey } from "@openeer/db";
import { redis } from "../redis";

export type { CachedApiKey };

const CACHE_KEY_PREFIX = API_KEY_CACHE_KEY_PREFIX;
const REVOKED_KEY_PREFIX = "api-key:revoked:";
const CACHE_TTL_SECONDS = API_KEY_CACHE_TTL_SECONDS;
// Must comfortably exceed the time a concurrent authenticateApiKey() call can
// spend between its DB read and its cache write, so a revoke that lands in
// that window can't be undone by a stale write. See invalidateCachedApiKey.
const REVOKED_TOMBSTONE_TTL_SECONDS = 30;

function cacheKey(hash: string): string {
  return `${CACHE_KEY_PREFIX}${hash}`;
}

function revokedKey(hash: string): string {
  return `${REVOKED_KEY_PREFIX}${hash}`;
}

export async function getCachedApiKey(hash: string): Promise<CachedApiKey | null> {
  try {
    const raw = await redis.get(cacheKey(hash));
    return raw ? (JSON.parse(raw) as CachedApiKey) : null;
  } catch (err) {
    console.error("api-key-cache: getCachedApiKey failed, falling back to DB", err);
    return null;
  }
}

export async function setCachedApiKey(
  hash: string,
  value: CachedApiKey
): Promise<void> {
  try {
    // A revoke that raced with the read producing `value` must win: skip
    // caching so we don't resurrect a key that was just revoked.
    const revoked = await redis.exists(revokedKey(hash));
    if (revoked) {
      return;
    }
    await redis.set(cacheKey(hash), JSON.stringify(value), "EX", CACHE_TTL_SECONDS);
  } catch (err) {
    console.error("api-key-cache: setCachedApiKey failed", err);
  }
}

export async function invalidateCachedApiKey(hash: string): Promise<void> {
  try {
    await redis
      .multi()
      .del(cacheKey(hash))
      .set(revokedKey(hash), "1", "EX", REVOKED_TOMBSTONE_TTL_SECONDS)
      .exec();
  } catch (err) {
    console.error("api-key-cache: invalidateCachedApiKey failed", err);
  }
}
