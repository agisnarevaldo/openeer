import { describe, expect, it } from "bun:test";
import { app } from "../src/index";

describe("User Authentication with Better Auth", () => {
  const testEmail = `developer_${Date.now()}@openeer.local`;
  const testPassword = "securePassword123!";
  const testName = "Test Developer";
  let sessionCookie = "";

  it("registers a new user and returns a user and session", async () => {
    const res = await app.handle(
      new Request("http://localhost:3050/api/auth/sign-up/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: testName,
          email: testEmail,
          password: testPassword,
        }),
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toBeDefined();
    expect(body.user.email).toBe(testEmail);
    expect(body.user.name).toBe(testName);

    const setCookieHeader = res.headers.get("set-cookie");
    expect(setCookieHeader).toBeTruthy();
    sessionCookie = setCookieHeader || "";
  });

  it("signs in an existing user with valid credentials", async () => {
    const res = await app.handle(
      new Request("http://localhost:3050/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
        }),
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.email).toBe(testEmail);

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    sessionCookie = setCookie || "";
  });

  it("retrieves the active session using the session cookie", async () => {
    const res = await app.handle(
      new Request("http://localhost:3050/api/auth/get-session", {
        headers: {
          Cookie: sessionCookie,
        },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toBeDefined();
    expect(body.user.email).toBe(testEmail);
  });

  it("signs out and clears the session", async () => {
    const res = await app.handle(
      new Request("http://localhost:3050/api/auth/sign-out", {
        method: "POST",
        headers: {
          Cookie: sessionCookie,
        },
      })
    );

    expect(res.status).toBe(200);

    const checkRes = await app.handle(
      new Request("http://localhost:3050/api/auth/get-session", {
        headers: {
          Cookie: sessionCookie,
        },
      })
    );

    const checkBody = await checkRes.json();
    expect(checkBody).toBeNull();
  });
});
