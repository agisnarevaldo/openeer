// The single source of truth for how API keys are hashed and cached. Lives
// here (rather than in apps/api) so packages/db's seed script can compute a
// matching hash and pre-warm the Redis cache in exactly the same format the
// gateway (apps/api) uses to verify keys at request time — duplicating this
// by hand in two places risks the two silently drifting apart.

export const API_KEY_PREFIX = "op_live_";

export function hashApiKey(key: string): string {
  return new Bun.CryptoHasher("sha256").update(key).digest("hex");
}

export interface CachedApiKey {
  userId: string;
  keyId: string;
  rateLimitRpm: number;
}

export const API_KEY_CACHE_KEY_PREFIX = "api-key:";
export const API_KEY_CACHE_TTL_SECONDS = 60;
