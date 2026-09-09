import { auth } from "../auth";

export class UnauthorizedError extends Error {}

export async function requireUser(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    throw new UnauthorizedError();
  }
  return session.user;
}
