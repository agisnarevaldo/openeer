import { db, requestLog } from "@openeer/db";

export interface RequestLogEntry {
  apiKeyId: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  statusCode: number;
  errorMessage: string | null;
  ipAddress: string | null;
}

/**
 * Fire-and-forget audit log write: callers must not await this so the
 * gateway response is never blocked on it. Failures are swallowed (and
 * logged) here rather than surfaced to the caller.
 */
export function logRequestAsync(entry: RequestLogEntry): void {
  db.insert(requestLog)
    .values(entry)
    .catch((err) => {
      console.error("request-logger: failed to write audit log", err);
    });
}
