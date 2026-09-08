import type { Handle } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
  const { url, request } = event;

  // Server-side protection for dashboard routes
  if (url.pathname.startsWith("/dashboard")) {
    const cookie = request.headers.get("cookie") || "";
    const hasSessionToken =
      cookie.includes("better-auth.session_token") ||
      cookie.includes("__Secure-better-auth.session_token");

    if (!hasSessionToken) {
      return new Response(null, {
        status: 303,
        headers: { Location: "/login" },
      });
    }
  }

  return resolve(event);
};
