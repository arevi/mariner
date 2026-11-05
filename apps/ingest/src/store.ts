import {
  MANIFEST_KEY,
  manifestSchema,
  tileKeyForPoint,
  tileObjectKey,
  vesselRecordSchema,
  type Manifest,
  type VesselRecord,
} from '@mariner/ais';
import { z } from 'zod';

const tileSchema = z.array(vesselRecordSchema);

async function readJson(bucket: R2Bucket, key: string) {
  const object = await bucket.get(key);
  return object ? object.json() : undefined;
}

export async function loadPrevious(bucket: R2Bucket): Promise<{ manifest?: Manifest; records: VesselRecord[] }> {
  const parsed = manifestSchema.safeParse(await readJson(bucket, MANIFEST_KEY));
  if (!parsed.success) return { records: [] };
  const tiles = await Promise.all(
    parsed.data.tiles.map(async (tile) => {
      const result = tileSchema.safeParse(await readJson(bucket, tileObjectKey(tile)));
      return result.success ? result.data : [];
    }),
  );
  return { manifest: parsed.data, records: tiles.flat() };
}

export async function flush(
  bucket: R2Bucket,
  records: VesselRecord[],
  meta: Pick<Manifest, 'runId' | 'messageCount' | 'windowSec'>,
  previous?: Manifest,
) {
  const byTile = new Map<string, VesselRecord[]>();
  for (const record of records) {
    const tile = tileKeyForPoint(record[1], record[2]);
    const list = byTile.get(tile);
    if (list) list.push(record);
    else byTile.set(tile, [record]);
  }

  await Promise.all(
    [...byTile].map(([tile, list]) =>
      bucket.put(tileObjectKey(tile), JSON.stringify(list), { httpMetadata: { contentType: 'application/json' } }),
    ),
  );

  const manifest: Manifest = {
    ...meta,
    updatedAt: new Date().toISOString(),
    vesselCount: records.length,
    tiles: [...byTile.keys()].sort(),
  };
  // Manifest goes last so readers never see a half-written run.
  await bucket.put(MANIFEST_KEY, JSON.stringify(manifest), { httpMetadata: { contentType: 'application/json' } });

  const stale = previous?.tiles.filter((tile) => !byTile.has(tile)) ?? [];
  if (stale.length) await bucket.delete(stale.map(tileObjectKey));
  return manifest;
}
