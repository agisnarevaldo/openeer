import { Elysia, t } from "elysia";
import { and, desc, eq } from "drizzle-orm";
import { db, apiKey } from "@openeer/db";
import { auth } from "../auth";
import { DEFAULT_RATE_LIMIT_RPM, generateApiKey } from "../lib/api-keys";

class UnauthorizedError extends Error {}

async function requireUser(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    throw new UnauthorizedError();
  }
  return session.user;
}

export const keysRoutes = new Elysia({ prefix: "/api/keys" })
  .error({ UNAUTHORIZED: UnauthorizedError })
  .onError(({ code, set }) => {
    if (code === "UNAUTHORIZED") {
      set.status = 401;
      return { error: "Unauthorized" };
    }
  })
  .post(
    "/",
    async ({ request, body, set }) => {
      const user = await requireUser(request);

      const name = body.name.trim();
      if (!name) {
        set.status = 400;
        return { error: "Name is required" };
      }

      const generated = generateApiKey();

      const [created] = await db
        .insert(apiKey)
        .values({
          userId: user.id,
          name,
          keyHash: generated.hash,
          keyPrefix: generated.prefix,
          lastFour: generated.lastFour,
          rateLimitRpm: body.rateLimitRpm ?? DEFAULT_RATE_LIMIT_RPM,
        })
        .returning();

      set.status = 201;
      return {
        id: created.id,
        name: created.name,
        key: generated.key,
        keyPrefix: created.keyPrefix,
        lastFour: created.lastFour,
        rateLimitRpm: created.rateLimitRpm,
        isActive: created.isActive,
        createdAt: created.createdAt,
      };
    },
    {
      body: t.Object({
        name: t.String(),
        rateLimitRpm: t.Optional(t.Integer({ minimum: 1 })),
      }),
    }
  )
  .get("/", async ({ request }) => {
    const user = await requireUser(request);

    const keys = await db
      .select({
        id: apiKey.id,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        lastFour: apiKey.lastFour,
        rateLimitRpm: apiKey.rateLimitRpm,
        isActive: apiKey.isActive,
        createdAt: apiKey.createdAt,
        lastUsedAt: apiKey.lastUsedAt,
      })
      .from(apiKey)
      .where(and(eq(apiKey.userId, user.id), eq(apiKey.isActive, true)))
      .orderBy(desc(apiKey.createdAt));

    return { keys };
  })
  .delete(
    "/:id",
    async ({ request, params, set }) => {
      const user = await requireUser(request);

      const [revoked] = await db
        .update(apiKey)
        .set({ isActive: false })
        .where(and(eq(apiKey.id, params.id), eq(apiKey.userId, user.id)))
        .returning({ id: apiKey.id });

      if (!revoked) {
        set.status = 404;
        return { error: "API key not found" };
      }

      return { success: true };
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    }
  );
