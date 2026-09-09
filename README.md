# Openeer

Openeer is an AI Gateway that mediates requests between client applications and AI providers, providing unified authentication, rate limiting, and usage tracking. It's an experimental project built to explore Bun, Elysia, and SvelteKit.

## Stack

- **Bun** — runtime and package manager
- **Elysia** — API server (`apps/api`)
- **SvelteKit** — dashboard web app (`apps/web`)
- **Drizzle ORM** + **PostgreSQL** — persistence (`packages/db`)
- **Redis** — API key verification cache
- **Better Auth** — dashboard user authentication
- **Caddy** — local gateway/reverse proxy that fronts the API and web app on one origin

## Project structure

```
apps/
  api/      Elysia API: Better Auth, API key management, /v1/chat/completions gateway
  web/      SvelteKit dashboard: login/register, API key management UI
packages/
  db/       Drizzle schema, migrations, and the shared Postgres client
```

## Prerequisites

- [Bun](https://bun.sh) v1.4+
- [Docker](https://www.docker.com/) (for Postgres, Redis, and Caddy)

## Manual setup

1. **Install dependencies** (from the repo root):

   ```sh
   bun install
   ```

2. **Start the infrastructure containers** (Postgres, Redis, Caddy):

   ```sh
   bun run docker:up
   ```

   This starts:
   - Postgres on `localhost:5435`
   - Redis on `localhost:6385`
   - Caddy on `localhost:8088` (proxies `/api/*` and `/v1/*` to the API on port 3050, and everything else to the web app on port 5173)

3. **Apply the database schema:**

   ```sh
   cd packages/db
   bun run db:push
   cd ../..
   ```

4. **Start the API server** (in one terminal):

   ```sh
   bun run dev:api
   ```

   Runs on `http://localhost:3050`.

5. **Start the web app** (in another terminal):

   ```sh
   bun run dev:web
   ```

   Runs on `http://localhost:5173`.

6. **Open the app through the Caddy gateway:**

   ```
   http://localhost:8088
   ```

   Use this URL, not `localhost:5173` directly — the dashboard's cookies and API calls rely on Caddy routing `/api/*` and `/v1/*` to the API on the same origin.

7. **Try it out:**
   - Register an account and sign in.
   - Go to **Dashboard → API Keys** and create a key. Copy the plaintext secret shown once (`op_live_...`).
   - Call the gateway with the key:

     ```sh
     curl -X POST http://localhost:8088/v1/chat/completions \
       -H "Content-Type: application/json" \
       -H "Authorization: Bearer op_live_..." \
       -d '{
         "model": "mock-gpt-4o",
         "messages": [{ "role": "user", "content": "Hello!" }]
       }'
     ```

### Stopping

```sh
bun run docker:down
```

## Configuration

All services run with sensible localhost defaults out of the box. Override with environment variables if needed:

| Variable              | Used by       | Default                                              |
| ---------------------- | -------------- | ----------------------------------------------------- |
| `DATABASE_URL`        | `packages/db` | `postgres://openeer:openeerpassword@localhost:5435/openeer` |
| `REDIS_URL`           | `apps/api`    | `redis://localhost:6385`                             |
| `BETTER_AUTH_SECRET`  | `apps/api`    | dev-only fallback secret (set your own outside dev)  |
| `BETTER_AUTH_URL`     | `apps/api`    | `http://localhost:8088`                               |
| `PORT`                | `apps/api`    | `3050`                                                |
| `HOST`                | `apps/api`    | `0.0.0.0`                                             |

## Testing & typechecking

Run the full test suite:

```sh
bun test
```

Typecheck an individual package:

```sh
cd apps/api && bun run check
cd apps/web && bun run check
cd packages/db && bun run check
```

## Documentation

- [`CONTEXT.md`](./CONTEXT.md) — domain glossary
- [`docs/adr/`](./docs/adr/) — architecture decision records
- [`docs/references/STACK.md`](./docs/references/STACK.md) — links to framework/library docs
