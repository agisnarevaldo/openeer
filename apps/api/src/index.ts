import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { auth } from "./auth";
import { ALLOWED_ORIGINS } from "./constants";
import { keysRoutes } from "./routes/keys";

export const app = new Elysia()
  .use(
    cors({
      origin: ALLOWED_ORIGINS,
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    })
  )
  .all("/api/auth/*", ({ request }) => auth.handler(request))
  .use(keysRoutes)
  .get("/health", () => ({ status: "ok" }));

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3050;
const HOST = process.env.HOST || "0.0.0.0";

if (import.meta.main) {
  app.listen({ port: PORT, hostname: HOST }, () => {
    console.log(`🦊 Openeer API running on ${HOST}:${PORT}`);
  });
}

export type App = typeof app;
