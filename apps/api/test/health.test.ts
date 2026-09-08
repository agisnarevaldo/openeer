import { describe, expect, it } from "bun:test";
import { app } from "../src/index";

describe("GET /health", () => {
  it("returns 200 and status ok", async () => {
    const response = await app.handle(
      new Request("http://localhost:3050/health")
    );

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({ status: "ok" });
  });
});
