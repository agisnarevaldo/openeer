import { Elysia, t } from "elysia";
import { and, count, desc, eq, gte, lte } from "drizzle-orm";
import { db, apiKey, requestLog } from "@openeer/db";
import { requireUser, UnauthorizedError } from "../lib/session";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

class InvalidQueryError extends Error {}

function parseIntParam(value: string, field: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new InvalidQueryError(`Invalid ${field}: '${value}' is not an integer.`);
  }
  return parsed;
}

function parseDateParam(value: string, field: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new InvalidQueryError(`Invalid ${field}: '${value}' is not a valid date.`);
  }
  return parsed;
}

export const logsRoutes = new Elysia({ prefix: "/api/logs" })
  .error({ UNAUTHORIZED: UnauthorizedError, INVALID_QUERY: InvalidQueryError })
  .onError(({ code, set, error }) => {
    if (code === "UNAUTHORIZED") {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    if (code === "INVALID_QUERY") {
      set.status = 400;
      return { error: error.message };
    }
  })
  .get(
    "/",
    async ({ request, query }) => {
      const user = await requireUser(request);

      const page = query.page
        ? Math.max(1, parseIntParam(query.page, "page"))
        : 1;
      const pageSize = query.pageSize
        ? Math.min(MAX_PAGE_SIZE, Math.max(1, parseIntParam(query.pageSize, "pageSize")))
        : DEFAULT_PAGE_SIZE;

      const conditions = [eq(apiKey.userId, user.id)];
      if (query.statusCode) {
        conditions.push(
          eq(requestLog.statusCode, parseIntParam(query.statusCode, "statusCode"))
        );
      }
      if (query.model) {
        conditions.push(eq(requestLog.model, query.model));
      }
      if (query.from) {
        conditions.push(gte(requestLog.createdAt, parseDateParam(query.from, "from")));
      }
      if (query.to) {
        conditions.push(lte(requestLog.createdAt, parseDateParam(query.to, "to")));
      }
      const whereClause = and(...conditions);

      const baseQuery = db
        .select({
          id: requestLog.id,
          apiKeyId: requestLog.apiKeyId,
          model: requestLog.model,
          promptTokens: requestLog.promptTokens,
          completionTokens: requestLog.completionTokens,
          totalTokens: requestLog.totalTokens,
          latencyMs: requestLog.latencyMs,
          statusCode: requestLog.statusCode,
          errorMessage: requestLog.errorMessage,
          ipAddress: requestLog.ipAddress,
          createdAt: requestLog.createdAt,
        })
        .from(requestLog)
        .innerJoin(apiKey, eq(requestLog.apiKeyId, apiKey.id))
        .where(whereClause)
        .orderBy(desc(requestLog.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      const countQuery = db
        .select({ total: count() })
        .from(requestLog)
        .innerJoin(apiKey, eq(requestLog.apiKeyId, apiKey.id))
        .where(whereClause);

      const [logs, [{ total }]] = await Promise.all([baseQuery, countQuery]);

      return { logs, page, pageSize, total };
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
        statusCode: t.Optional(t.String()),
        model: t.Optional(t.String()),
        from: t.Optional(t.String()),
        to: t.Optional(t.String()),
      }),
    }
  );
