import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import Redis from "ioredis";
import { sql, db } from "./client";
import { user, account, apiKey } from "./schema";
import {
  hashApiKey,
  API_KEY_PREFIX,
  API_KEY_CACHE_KEY_PREFIX,
  API_KEY_CACHE_TTL_SECONDS,
} from "./api-key-format";

const DEV_USER_ID = "dev-seed-user";
const DEV_ACCOUNT_ID = "dev-seed-user";
const DEV_NAME = "Dev Developer";
const DEV_EMAIL = "dev@openeer.local";
const DEV_PASSWORD = "openeer123";

const DEMO_API_KEY_ID = "11111111-1111-1111-1111-111111111111";
const DEMO_API_KEY = "op_live_demo1234567890abcdef1234567890ab";
const DEMO_API_KEY_RATE_LIMIT_RPM = 60;

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6385";

/**
 * Finds-or-creates the seed user by email (not by our fixed DEV_USER_ID),
 * because a developer could have already registered dev@openeer.local
 * manually before ever running this script — user.email is unique, so
 * inserting a second row with a different id would violate that constraint.
 * Reusing whatever id already owns that email keeps this idempotent either
 * way. Returns the user's actual id.
 */
async function seedDeveloperAccount(now: Date): Promise<string> {
  const passwordHash = await hashPassword(DEV_PASSWORD);

  const [existingUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, DEV_EMAIL));

  const userId = existingUser?.id ?? DEV_USER_ID;

  if (existingUser) {
    await db
      .update(user)
      .set({ name: DEV_NAME, emailVerified: true, updatedAt: now })
      .where(eq(user.id, userId));
  } else {
    await db.insert(user).values({
      id: userId,
      name: DEV_NAME,
      email: DEV_EMAIL,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  const [existingAccount] = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "credential")));

  if (existingAccount) {
    await db
      .update(account)
      .set({ password: passwordHash, updatedAt: now })
      .where(eq(account.id, existingAccount.id));
  } else {
    await db.insert(account).values({
      id: userId === DEV_USER_ID ? DEV_ACCOUNT_ID : crypto.randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: passwordHash,
      createdAt: now,
      updatedAt: now,
    });
  }

  console.log(`  User seeded: ${DEV_EMAIL} / ${DEV_PASSWORD}`);
  return userId;
}

async function seedDemoApiKey(userId: string, now: Date): Promise<string> {
  const keyHash = hashApiKey(DEMO_API_KEY);

  await db
    .insert(apiKey)
    .values({
      id: DEMO_API_KEY_ID,
      userId,
      name: "Demo Key",
      keyHash,
      keyPrefix: API_KEY_PREFIX,
      lastFour: DEMO_API_KEY.slice(-4),
      rateLimitRpm: DEMO_API_KEY_RATE_LIMIT_RPM,
      isActive: true,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: apiKey.id,
      set: {
        userId,
        keyHash,
        lastFour: DEMO_API_KEY.slice(-4),
        rateLimitRpm: DEMO_API_KEY_RATE_LIMIT_RPM,
        isActive: true,
      },
    });

  console.log(`  API key seeded: ${DEMO_API_KEY}`);
  return keyHash;
}

async function prewarmApiKeyCache(userId: string, keyHash: string): Promise<void> {
  const redis = new Redis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
  try {
    await redis.connect();
    await redis.set(
      `${API_KEY_CACHE_KEY_PREFIX}${keyHash}`,
      JSON.stringify({
        userId,
        keyId: DEMO_API_KEY_ID,
        rateLimitRpm: DEMO_API_KEY_RATE_LIMIT_RPM,
      }),
      "EX",
      API_KEY_CACHE_TTL_SECONDS
    );
    console.log("  Redis cache pre-warmed for the demo key.");
  } catch (err) {
    console.warn(
      "  Could not pre-warm the Redis cache (is `bun run docker:up` running?). " +
        "The gateway will still work — it just falls back to a DB lookup on the first request.",
      err instanceof Error ? err.message : err
    );
  } finally {
    redis.disconnect();
  }
}

async function seed(): Promise<void> {
  const now = new Date();

  console.log("Seeding default developer account...");
  const userId = await seedDeveloperAccount(now);

  console.log("Seeding demo API key...");
  const keyHash = await seedDemoApiKey(userId, now);

  console.log("Pre-warming Redis cache...");
  await prewarmApiKeyCache(userId, keyHash);

  console.log("Seed complete.");
}

seed()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(() => {
    void sql.end();
  });
