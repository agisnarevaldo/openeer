# Monorepo Architecture with Bun Workspaces

We adopted a Bun Workspaces monorepo (`apps/api`, `apps/web`, `packages/db`) to co-locate the Elysia backend, SvelteKit frontend, and shared Drizzle database schema. This enables direct type-safe RPC via Eden Treaty without package publishing overhead while isolating framework dependencies.
