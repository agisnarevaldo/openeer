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

   > ⚠️ **Always use `localhost:8088`, never `localhost:5173`.** Vite only serves the SvelteKit app on 5173 — it does not proxy `/api/*`. If you open `localhost:5173` directly, Better Auth's client (which posts to `window.location.origin + /api/auth/...`) will hit a route that doesn't exist on the Vite dev server, and **register/login will silently fail with a 404**. Caddy on 8088 is what routes `/api/*` and `/v1/*` to the API and everything else to the web app on one origin — that's the URL to use in your browser.

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

Stop the API and web dev servers with `Ctrl+C` in their terminals.

> On Windows, if you're running them from **Git Bash**, `Ctrl+C` often doesn't reach `bun.exe` (a known Git Bash/MinTTY limitation with native Windows processes) and the server keeps running. If that happens, run this from any terminal instead:
>
> ```sh
> bun run stop
> ```
>
> This finds and kills whatever is listening on the dev server ports (3050 and 5173). Alternatively, run the dev servers from PowerShell or cmd.exe instead of Git Bash, where `Ctrl+C` works normally.

Stop the Docker infrastructure (Postgres, Redis, Caddy) with:

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

## Troubleshooting

**Register/login fails or hangs.** You're almost certainly on `localhost:5173` instead of `localhost:8088`. Open `http://localhost:8088` — see the warning in step 6 above.

**`Ctrl+C` doesn't stop the dev servers.** Known Git Bash/Windows issue, not a project bug. Run `bun run stop` from any terminal to kill whatever is bound to ports 3050 and 5173, or start the dev servers from PowerShell/cmd.exe instead.

**Port already in use / stale process from a previous run.** Run `bun run stop` first, then restart `bun run dev:api` / `bun run dev:web`.

**Dashboard/API can't reach Postgres or Redis.** Confirm the containers are up and healthy with `docker compose ps`; start them with `bun run docker:up` if not.

## Documentation

- [`CONTEXT.md`](./CONTEXT.md) — domain glossary
- [`docs/adr/`](./docs/adr/) — architecture decision records
- [`docs/references/STACK.md`](./docs/references/STACK.md) — links to framework/library docs
