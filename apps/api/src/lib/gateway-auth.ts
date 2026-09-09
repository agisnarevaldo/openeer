import { and, eq } from "drizzle-orm";
import { db, apiKey } from "@openeer/db";
import { hashApiKey } from "./api-keys";
import { getCachedApiKey, setCachedApiKey } from "./api-key-cache";

const BEARER_PREFIX = "Bearer ";

export interface AuthenticatedApiKey {
  userId: string;
  keyId: string;
  rateLimitRpm: number;
}

function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith(BEARER_PREFIX)) {
    return null;
  }

  const token = header.slice(BEARER_PREFIX.length).trim();
  return token || null;
}

export async function authenticateApiKey(
  request: Request
): Promise<AuthenticatedApiKey | null> {
  const token = extractBearerToken(request);
  if (!token) {
    return null;
  }

  const hash = hashApiKey(token);

  const cached = await getCachedApiKey(hash);
  if (cached) {
    return cached;
  }

  const [record] = await db
    .select({
      id: apiKey.id,
      userId: apiKey.userId,
      rateLimitRpm: apiKey.rateLimitRpm,
    })
    .from(apiKey)
    .where(and(eq(apiKey.keyHash, hash), eq(apiKey.isActive, true)))
    .limit(1);

  if (!record) {
    return null;
  }

  const result: AuthenticatedApiKey = {
    userId: record.userId,
    keyId: record.id,
    rateLimitRpm: record.rateLimitRpm,
  };

  await db
    .update(apiKey)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKey.id, record.id));

  await setCachedApiKey(hash, result);
  return result;
}
