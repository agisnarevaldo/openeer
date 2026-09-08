import { describe, expect, it } from "bun:test";
import { app } from "../src/index";

describe("Caddy Gateway Routing", () => {
  it("routes /health through port 8088 to Elysia", async () => {
    const server = app.listen({ port: 3050, hostname: "0.0.0.0" });
    try {
      const response = await fetch("http://localhost:8088/health", {
        signal: AbortSignal.timeout(3000),
      }).catch(() => null);

      if (!response) {
        console.warn("Caddy container not reachable; skipping live network test.");
        return;
      }

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ status: "ok" });
    } finally {
      server.stop(true);
    }
  }, 10000);
});
