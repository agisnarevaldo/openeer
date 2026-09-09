import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";
import { apiKey } from "./api-keys";

export const requestLog = pgTable("request_logs", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  apiKeyId: uuid("api_key_id")
    .notNull()
    .references(() => apiKey.id, { onDelete: "cascade" }),
  model: text("model").notNull(),
  promptTokens: integer("prompt_tokens").notNull().default(0),
  completionTokens: integer("completion_tokens").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  latencyMs: integer("latency_ms").notNull(),
  statusCode: integer("status_code").notNull(),
  errorMessage: text("error_message"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
