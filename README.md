# Mariner

Cloudflare-native maritime vessel tracking using live AIS data.

- `apps/web` — Vite + React map UI and a Hono Worker API (`/api/*`).
- `apps/ingest` — Cron Worker that listens to [AISStream](https://aisstream.io) hourly and writes vessel tiles to R2 and vessel details to D1.
- `packages/ais` — Shared schemas, types and utilities.

## Local development

```sh
pnpm install
cp apps/ingest/.dev.vars.example apps/ingest/.dev.vars   # add AISSTREAM_API_KEY
cp apps/web/.env.example apps/web/.env                   # add VITE_MAPBOX_TOKEN
pnpm --filter ingest run migrate:local                   # create the local D1 tables
pnpm dev
```

Re-run `migrate:local` after pulling new migrations, or after changing `database_id` (local D1 state is stored per id).

Trigger an ingest run locally with `curl "http://localhost:8787/cdn-cgi/handler/scheduled"`.

Before committing: `pnpm typecheck && pnpm lint && pnpm format:check`.

## Deploying

Requires a Cloudflare account on the **Workers Paid** plan: the free plan allows 10 ms of CPU per invocation (the hourly ingest cron gets 15 min on Paid) and 50 subrequests (the API reads up to 64 R2 tiles per request, Paid allows 10,000).

1. Create the resources and put the D1 id printed by the second command in the `database_id` field of **both** `apps/ingest/wrangler.jsonc` and `apps/web/wrangler.jsonc`:

   ```sh
   pnpm --filter ingest exec wrangler r2 bucket create mariner-vessels
   pnpm --filter ingest exec wrangler d1 create mariner
   ```

2. Apply database migrations (the ingest config owns `migrations_dir`; the API returns errors for vessel details until this is done). Deploying does not run migrations, so repeat this whenever a new file appears in `apps/ingest/migrations/`, before deploying:

   ```sh
   pnpm --filter ingest run migrate
   ```

3. Set the AISStream key as a secret (if the `ingest` Worker doesn't exist yet, wrangler offers to create it):

   ```sh
   pnpm --filter ingest exec wrangler secret put AISSTREAM_API_KEY
   ```

4. Put a Mapbox public token in `apps/web/.env.production` as `VITE_MAPBOX_TOKEN=pk...`. It is inlined at build time, so restrict it to the production domain in the Mapbox dashboard.

5. Deploy ingest first, then the web app:

   ```sh
   pnpm --filter ingest run deploy
   pnpm --filter web run deploy
   ```

   Later, `pnpm run deploy` deploys both. Use `run`: plain `pnpm deploy` is a built-in pnpm command, not this script.

   A deployed cron Worker can't be triggered by hand, so the map stays empty until the next top of the hour. To populate it sooner, temporarily set `crons` in `apps/ingest/wrangler.jsonc` to `["*/10 * * * *"]`, deploy ingest, and restore `["0 * * * *"]` and redeploy after the first successful run.

6. Verify: `pnpm --filter ingest exec wrangler tail` during the first cron run (check CPU time and that it logs `ingest complete`), and confirm `updatedAt` in `/api/vessels?bbox=-180,-90,180,90` advances hourly.

If a run receives no AIS messages (for example an invalid API key) it fails without writing, so the previous snapshot stays in place and the error appears in the Worker's logs.
