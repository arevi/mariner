## Project

Mariner is a Cloudflare-native maritime vessel tracking application using AIS data.

## Directories

This is a TypeScript monorepo managed with pnpm.

- `apps/web` — Core application: Vite, React, React Router, Tailwind CSS, shadcn/ui, Mapbox, React Hook Form, TanStack Query, and Hono Worker API.
- `apps/ingest` — Cloudflare Cron Worker for AIS ingestion into D1 and R2. Uses Hono and Drizzle ORM.
- `packages/` — Shared types, schemas, and utilities.

## Guidelines

- Use pnpm exclusively.
- Prefer Cloudflare-native APIs and Workers-compatible dependencies.
- Follow existing patterns and conventions before introducing new abstractions.
- Keep code simple, strongly typed, and maintainable.
- Share types and schemas across applications via `packages/`.
- Only add comments for complex logic or non-obvious decisions. Keep comments concise.
- Avoid unnecessary dependencies and unrelated changes.
- Prefer to import an available shadcn UI component when one is available, rather than create one from scratch.

## Commands

- `pnpm dev` — Start development services.
- `pnpm build` — Build all packages.
- `pnpm typecheck` — TypeScript checks.
- `pnpm lint` — Oxlint.
- `pnpm format` — Prettier formatting.
- `pnpm format:check` — Check formatting.

Before completing changes, run `pnpm typecheck`, `pnpm lint`, and `pnpm format:check`. Fix any issues introduced by your changes.
