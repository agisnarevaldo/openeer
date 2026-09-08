import { describe, expect, it } from "bun:test";
import { app } from "../src/index";

describe("Caddy Reverse Proxy", () => {
  it("proxies /api/health through port 8088 to Elysia port 3050", async () => {
    const server = app.listen({ port: 3050, hostname: "0.0.0.0" });
    try {
      const response = await fetch("http://localhost:8088/api/health", {
        signal: AbortSignal.timeout(3000),
      });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ status: "ok" });
    } finally {
      server.stop(true);
    }
  }, 10000);
});
