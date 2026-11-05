import {
  MANIFEST_KEY,
  manifestSchema,
  tileKeysForBbox,
  tileObjectKey,
  vesselRecordSchema,
  vessels,
  type Bbox,
  type VesselRecord,
  type VesselSearchResult,
} from '@mariner/ais';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { Hono } from 'hono';
import { z } from 'zod';

const bboxSchema = z
  .string()
  .transform((value) => value.split(',').map(Number))
  .pipe(z.tuple([z.number().min(-180), z.number().min(-90), z.number().max(180), z.number().max(90)]))
  .refine(([minLng, minLat, maxLng, maxLat]) => minLng <= maxLng && minLat <= maxLat);

const tileSchema = z.array(vesselRecordSchema);
const CACHE_SECONDS = 300;
const CACHE_CONTROL = `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=3600`;

const app = new Hono<{ Bindings: Env }>();

app.onError((error, c) => {
  console.error(error);
  return c.json({ error: 'internal error' }, 500);
});

app.get('/api/vessels', async (c) => {
  const parsed = bboxSchema.safeParse(c.req.query('bbox'));
  if (!parsed.success) return c.json({ error: 'bbox must be minLng,minLat,maxLng,maxLat' }, 400);
  const [minLng, minLat, maxLng, maxLat] = parsed.data as unknown as Bbox;

  // Cache-Control alone does not engage Cloudflare's cache for Worker responses.
  const cacheKey = new Request(c.req.url);
  const cached = await caches.default.match(cacheKey);
  if (cached) return cached;

  const manifestObject = await c.env.VESSELS.get(MANIFEST_KEY);
  if (!manifestObject) return c.json({ updatedAt: null, vessels: [] });
  const manifest = manifestSchema.parse(await manifestObject.json());

  const available = new Set(manifest.tiles);
  const tiles = tileKeysForBbox(parsed.data as unknown as Bbox).filter((tile) => available.has(tile));
  // Filter per tile so out-of-view records are dropped as soon as each tile is parsed.
  const results = await Promise.all(
    tiles.map(async (tile) => {
      const object = await c.env.VESSELS.get(tileObjectKey(tile));
      if (!object) return [];
      return tileSchema
        .parse(await object.json())
        .filter(([, lat, lng]) => lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat);
    }),
  );

  const vessels = results.flat();
  const response = c.json({ updatedAt: manifest.updatedAt, vessels }, 200, { 'Cache-Control': CACHE_CONTROL });
  c.executionCtx.waitUntil(caches.default.put(cacheKey, response.clone()));
  return response;
});

const searchSchema = z.string().trim().min(1).max(20);

// Workers allow 6 simultaneous outbound connections; more just queue.
const TILE_CONCURRENCY = 6;

/** Scans tiles for the vessel's latest position (tiles are keyed by location, not MMSI). Only a few tiles are held in memory at once, and the scan stops at the first match. */
async function findPosition(env: Env, mmsi: number): Promise<VesselRecord | null> {
  const manifestObject = await env.VESSELS.get(MANIFEST_KEY);
  if (!manifestObject) return null;
  const manifest = manifestSchema.parse(await manifestObject.json());
  for (let i = 0; i < manifest.tiles.length; i += TILE_CONCURRENCY) {
    const matches = await Promise.all(
      manifest.tiles.slice(i, i + TILE_CONCURRENCY).map(async (tile) => {
        const object = await env.VESSELS.get(tileObjectKey(tile));
        const records = object ? ((await object.json()) as VesselRecord[]) : [];
        return records.find((record) => record[0] === mmsi) ?? null;
      }),
    );
    const match = matches.find((record) => record !== null);
    if (match) return match;
  }
  return null;
}

app.get('/api/search', async (c) => {
  const parsed = searchSchema.safeParse(c.req.query('q'));
  if (!parsed.success) return c.json({ error: 'q is required' }, 400);
  const query = parsed.data;

  // Each search scans every tile, so cap the rate per client.
  const { success } = await c.env.SEARCH_LIMITER.limit({ key: c.req.header('cf-connecting-ip') ?? 'unknown' });
  if (!success) return c.json({ error: 'too many requests' }, 429);

  const isMmsi = /^\d{9}$/.test(query);
  // AIS call signs are uppercase by protocol, so a plain equality can use the call_sign index.
  const [vessel] = await drizzle(c.env.DB)
    .select()
    .from(vessels)
    .where(isMmsi ? eq(vessels.mmsi, Number(query)) : eq(vessels.callSign, query.toUpperCase()))
    .limit(1);

  const mmsi = vessel?.mmsi ?? (isMmsi ? Number(query) : null);
  const position = mmsi === null ? null : await findPosition(c.env, mmsi);
  if (!vessel && !position) return c.json({ error: 'not found' }, 404);

  return c.json({ vessel: vessel ?? null, position } satisfies VesselSearchResult);
});

app.get('/api/vessels/:mmsi', async (c) => {
  const mmsi = z.coerce.number().int().positive().safeParse(c.req.param('mmsi'));
  if (!mmsi.success) return c.json({ error: 'invalid mmsi' }, 400);

  const [vessel] = await drizzle(c.env.DB).select().from(vessels).where(eq(vessels.mmsi, mmsi.data)).limit(1);
  if (!vessel) return c.json({ error: 'not found' }, 404);
  c.header('Cache-Control', `public, max-age=${CACHE_SECONDS}`);
  return c.json(vessel);
});

export default app satisfies ExportedHandler<Env>;
