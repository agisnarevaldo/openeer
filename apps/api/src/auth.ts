import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db, schema } from "@openeer/db";
import { ALLOWED_ORIGINS } from "./constants";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  secret:
    process.env.BETTER_AUTH_SECRET ||
    "openeer-dev-secret-key-must-be-at-least-32-characters",
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:8088",
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  trustedOrigins: ALLOWED_ORIGINS,
  advanced: {
    useSecureCookies: false,
  },
});

export type Auth = typeof auth;
