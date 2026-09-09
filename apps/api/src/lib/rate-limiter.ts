import { redis } from "../redis";

declare module "ioredis" {
  interface RedisCommander<Context> {
    slidingWindowRateLimit(
      key: string,
      now: number,
      window: number,
      limit: number,
      member: string
    ): Promise<[number, number, number]>;
  }
}

const RATE_LIMIT_KEY_PREFIX = "rate-limit:";
const WINDOW_MS = 60_000;

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Unix seconds at which the current window's oldest request falls out of the window. */
  resetAt: number;
}

// Sliding-window log: each request is a zset member scored by its own
// timestamp. Entries older than the window are evicted before counting, so
// the limit always reflects the last WINDOW_MS milliseconds rather than a
// fixed calendar minute. Runs as one EVAL so the evict-count-add sequence is
// atomic under concurrent requests for the same key.
const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)
local count = redis.call('ZCARD', key)

local allowed = 0
if count < limit then
  redis.call('ZADD', key, now, member)
  redis.call('PEXPIRE', key, window)
  count = count + 1
  allowed = 1
end

local remaining = limit - count
if remaining < 0 then remaining = 0 end

local resetAt = now + window
local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
if oldest[2] then
  resetAt = tonumber(oldest[2]) + window
end

return { allowed, remaining, resetAt }
`;

// Registered once at module load; ioredis caches the script server-side via
// EVALSHA and only falls back to sending the full source on a cache miss
// (e.g. after a Redis restart), instead of retransmitting it every call.
redis.defineCommand("slidingWindowRateLimit", {
  numberOfKeys: 1,
  lua: SLIDING_WINDOW_SCRIPT,
});

function rateLimitKey(apiKeyId: string): string {
  return `${RATE_LIMIT_KEY_PREFIX}${apiKeyId}`;
}

export async function checkRateLimit(
  apiKeyId: string,
  limitRpm: number
): Promise<RateLimitResult> {
  const now = Date.now();

  try {
    const [allowed, remaining, resetAtMs] = await redis.slidingWindowRateLimit(
      rateLimitKey(apiKeyId),
      now,
      WINDOW_MS,
      limitRpm,
      `${now}-${crypto.randomUUID()}`
    );

    return {
      allowed: allowed === 1,
      limit: limitRpm,
      remaining,
      resetAt: Math.ceil(resetAtMs / 1000),
    };
  } catch (err) {
    console.error("rate-limiter: checkRateLimit failed, allowing request", err);
    return {
      allowed: true,
      limit: limitRpm,
      remaining: limitRpm,
      resetAt: Math.ceil((now + WINDOW_MS) / 1000),
    };
  }
}
