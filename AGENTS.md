# Agent Guidelines

## Agent skills

## Skills

Use skills when they can improve the quality or reliability of a task.

1. Check `skills/` for an existing relevant skill.
2. If none exists, look for a suitable trusted skill.
3. Install the skill into `skills/` when practical.
4. Read and follow its instructions before implementation.
5. If no suitable skill exists, proceed without one.
6. Avoid installing unnecessary or untrusted skills.

### Issue tracker

GitHub issues via `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical 5-role labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context (`CONTEXT.md` + `docs/adr/` at repo root). See `docs/agents/domain.md`.

# Openeer — Agent Instructions

## Project

Openeer is an experimental AI Gateway built to explore
Bun, Elysia, and SvelteKit.

## Stack

- Bun
- Elysia
- TypeScript
- SvelteKit
- Drizzle
- PostgreSQL
- Redis

## Documentation

When working with a framework or library:

1. Check `docs/references/STACK.md`.
2. Use the official documentation referenced there.
3. Prefer official `llms.txt` documentation when available.
4. Verify APIs against the documentation before implementation.
5. Never invent APIs based solely on model knowledge.
6. Prefer documentation matching the installed package version.
