import { Elysia } from "elysia";
import { and, avg, count, eq, gte, sum } from "drizzle-orm";
import { db, apiKey, requestLog } from "@openeer/db";
import { requireUser, UnauthorizedError } from "../lib/session";

const WINDOW_HOURS = 24;

export const metricsRoutes = new Elysia({ prefix: "/api/metrics" })
  .error({ UNAUTHORIZED: UnauthorizedError })
  .onError(({ code, set }) => {
    if (code === "UNAUTHORIZED") {
      set.status = 401;
      return { error: "Unauthorized" };
    }
  })
  .get("/summary", async ({ request }) => {
    const user = await requireUser(request);
    const windowStart = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000);

    const [row] = await db
      .select({
        totalRequests: count(),
        totalTokens: sum(requestLog.totalTokens),
        avgLatencyMs: avg(requestLog.latencyMs),
      })
      .from(requestLog)
      .innerJoin(apiKey, eq(requestLog.apiKeyId, apiKey.id))
      .where(
        and(eq(apiKey.userId, user.id), gte(requestLog.createdAt, windowStart))
      );

    return {
      windowHours: WINDOW_HOURS,
      totalRequests: Number(row?.totalRequests ?? 0),
      totalTokens: Number(row?.totalTokens ?? 0),
      avgLatencyMs: row?.avgLatencyMs ? Math.round(Number(row.avgLatencyMs)) : 0,
    };
  });
