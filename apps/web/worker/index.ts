import { MANIFEST_KEY, manifestSchema, tileKeysForBbox, tileObjectKey, vesselRecordSchema, type Bbox } from '@mariner/ais';
import { Hono } from 'hono';
import { z } from 'zod';

const bboxSchema = z
  .string()
  .transform((value) => value.split(',').map(Number))
  .pipe(z.tuple([z.number().min(-180), z.number().min(-90), z.number().max(180), z.number().max(90)]))
  .refine(([minLng, minLat, maxLng, maxLat]) => minLng <= maxLng && minLat <= maxLat);

const tileSchema = z.array(vesselRecordSchema);
const CACHE_CONTROL = 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600';

const app = new Hono<{ Bindings: Env }>();

app.get('/api/vessels', async (c) => {
  const parsed = bboxSchema.safeParse(c.req.query('bbox'));
  if (!parsed.success) return c.json({ error: 'bbox must be minLng,minLat,maxLng,maxLat' }, 400);
  const [minLng, minLat, maxLng, maxLat] = parsed.data as unknown as Bbox;

  const manifestObject = await c.env.VESSELS.get(MANIFEST_KEY);
  if (!manifestObject) return c.json({ updatedAt: null, vessels: [] });
  const manifest = manifestSchema.parse(await manifestObject.json());

  const available = new Set(manifest.tiles);
  const tiles = tileKeysForBbox(parsed.data as unknown as Bbox).filter((tile) => available.has(tile));
  const results = await Promise.all(
    tiles.map(async (tile) => {
      const object = await c.env.VESSELS.get(tileObjectKey(tile));
      return object ? tileSchema.parse(await object.json()) : [];
    }),
  );

  const vessels = results.flat().filter(([, lat, lng]) => lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat);
  c.header('Cache-Control', CACHE_CONTROL);
  return c.json({ updatedAt: manifest.updatedAt, vessels });
});

export default app satisfies ExportedHandler<Env>;
