import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";

export const app = new Elysia()
  .use(cors())
  .get("/health", () => ({ status: "ok" }))
  .get("/api/health", () => ({ status: "ok" }));

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3050;
const HOST = process.env.HOST || "0.0.0.0";

if (import.meta.main) {
  app.listen({ port: PORT, hostname: HOST }, () => {
    console.log(`🦊 Openeer API running on ${HOST}:${PORT}`);
  });
}

export type App = typeof app;
