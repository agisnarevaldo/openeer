import { describe, expect, it } from "bun:test";
import { handle } from "../src/hooks.server";

describe("Protected Routes Middleware (hooks.server.ts)", () => {
  it("redirects unauthenticated requests to /dashboard with status 303 to /login", async () => {
    const mockEvent: any = {
      url: new URL("http://localhost:5173/dashboard"),
      request: new Request("http://localhost:5173/dashboard"),
    };
    const mockResolve = async () => new Response("ok");

    const response = await handle({ event: mockEvent, resolve: mockResolve });
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/login");
  });

  it("allows requests with session token to proceed to dashboard", async () => {
    const mockEvent: any = {
      url: new URL("http://localhost:5173/dashboard"),
      request: new Request("http://localhost:5173/dashboard", {
        headers: {
          Cookie: "better-auth.session_token=valid_token_sample",
        },
      }),
    };
    const mockResolve = async () =>
      new Response("dashboard content", { status: 200 });

    const response = await handle({ event: mockEvent, resolve: mockResolve });
    expect(response.status).toBe(200);
  });

  it("allows unauthenticated requests to public routes like /login", async () => {
    const mockEvent: any = {
      url: new URL("http://localhost:5173/login"),
      request: new Request("http://localhost:5173/login"),
    };
    const mockResolve = async () =>
      new Response("login page", { status: 200 });

    const response = await handle({ event: mockEvent, resolve: mockResolve });
    expect(response.status).toBe(200);
  });
});
