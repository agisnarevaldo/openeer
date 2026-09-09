import { redis } from "../redis";

const CACHE_KEY_PREFIX = "api-key:";
const CACHE_TTL_SECONDS = 60;

export interface CachedApiKey {
  userId: string;
  keyId: string;
  rateLimitRpm: number;
}

function cacheKey(hash: string): string {
  return `${CACHE_KEY_PREFIX}${hash}`;
}

export async function getCachedApiKey(hash: string): Promise<CachedApiKey | null> {
  const raw = await redis.get(cacheKey(hash));
  return raw ? (JSON.parse(raw) as CachedApiKey) : null;
}

export async function setCachedApiKey(
  hash: string,
  value: CachedApiKey
): Promise<void> {
  await redis.set(cacheKey(hash), JSON.stringify(value), "EX", CACHE_TTL_SECONDS);
}

export async function invalidateCachedApiKey(hash: string): Promise<void> {
  await redis.del(cacheKey(hash));
}
