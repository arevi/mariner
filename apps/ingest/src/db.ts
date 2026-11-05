import { VESSEL_FIELDS as F, vessels, type NewVesselRow, type VesselRow } from '@mariner/ais';
import { gt, lt, or, sql } from 'drizzle-orm';
import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
import type { VesselState } from './state';

type Db = DrizzleD1Database;

const PRUNE_AFTER_SECONDS = 30 * 24 * 60 * 60;
// last_seen alone is not worth a write on every run; the tiles carry the precise time.
const LAST_SEEN_REFRESH_SECONDS = 6 * 60 * 60;
// D1 allows 100 bound parameters per statement; 13 columns per row.
const ROWS_PER_STATEMENT = 7;
const STATEMENTS_PER_BATCH = 100;
// Reading and writing in chunks keeps memory (128 MB) and D1 result sizes bounded as the table grows.
const READ_PAGE_SIZE = 20_000;
const WRITE_CHUNK_SIZE = 5_000;

const TRACKED = ['imo', 'callSign', 'name', 'shipType', 'length', 'beam', 'draught', 'destination', 'eta'] as const;

/** The subset of a D1 row that `diffVessels` compares against. */
type ExistingRow = Pick<VesselRow, 'mmsi' | 'firstSeen' | 'lastSeen' | (typeof TRACKED)[number]>;

/** Keeps the existing value when the incoming one is null. */
const keep = (column: keyof typeof vessels.$inferSelect) => {
  const col = vessels[column];
  return sql`coalesce(excluded.${sql.raw(col.name)}, ${col})`;
};

/** Reads the table in MMSI order, one page at a time, selecting only the columns the diff needs. */
async function* loadVesselPages(db: Db) {
  let cursor = 0;
  while (true) {
    const page: ExistingRow[] = await db
      .select({
        mmsi: vessels.mmsi,
        imo: vessels.imo,
        callSign: vessels.callSign,
        name: vessels.name,
        shipType: vessels.shipType,
        length: vessels.length,
        beam: vessels.beam,
        draught: vessels.draught,
        destination: vessels.destination,
        eta: vessels.eta,
        firstSeen: vessels.firstSeen,
        lastSeen: vessels.lastSeen,
      })
      .from(vessels)
      .where(gt(vessels.mmsi, cursor))
      .orderBy(vessels.mmsi)
      .limit(READ_PAGE_SIZE);
    if (page.length) yield page;
    if (page.length < READ_PAGE_SIZE) return;
    cursor = page[page.length - 1]!.mmsi;
  }
}

/** Rows for the given MMSIs that are new or differ from what D1 already holds. Call after `state.finalize()`. */
export function diffVessels(state: VesselState, mmsis: Iterable<number>, existing: Map<number, ExistingRow>, now: number) {
  const changed: NewVesselRow[] = [];
  for (const mmsi of mmsis) {
    const seen = state.seen.get(mmsi);
    if (!seen) continue;
    const info = state.statics.get(mmsi);
    const record = state.vessels.get(mmsi);
    const incoming = {
      imo: info?.imo ?? null,
      callSign: info?.callSign ?? null,
      name: info?.name || record?.[F.name] || null,
      shipType: info?.shipType ?? record?.[F.shipType] ?? null,
      length: info?.length ?? record?.[F.length] ?? null,
      beam: info?.beam ?? null,
      draught: info?.draught ?? null,
      destination: info?.destination ?? null,
      eta: info?.eta ?? null,
    };

    const prev = existing.get(mmsi);
    const stale = !prev || seen.last - prev.lastSeen > LAST_SEEN_REFRESH_SECONDS;
    const differs = !prev || TRACKED.some((key) => incoming[key] !== null && incoming[key] !== prev[key]);
    if (!stale && !differs) continue;

    changed.push({
      mmsi,
      ...incoming,
      firstSeen: prev?.firstSeen ?? seen.first,
      lastSeen: Math.max(seen.last, prev?.lastSeen ?? 0),
      updatedAt: now,
    });
  }
  return changed;
}

export async function upsertVessels(db: Db, rows: NewVesselRow[]) {
  const statements = [];
  for (let i = 0; i < rows.length; i += ROWS_PER_STATEMENT) {
    statements.push(
      db
        .insert(vessels)
        .values(rows.slice(i, i + ROWS_PER_STATEMENT))
        .onConflictDoUpdate({
          target: vessels.mmsi,
          set: {
            imo: keep('imo'),
            callSign: keep('callSign'),
            name: keep('name'),
            shipType: keep('shipType'),
            length: keep('length'),
            beam: keep('beam'),
            draught: keep('draught'),
            destination: keep('destination'),
            eta: keep('eta'),
            lastSeen: sql`max(excluded.last_seen, ${vessels.lastSeen})`,
            updatedAt: sql`excluded.updated_at`,
          },
        }),
    );
  }
  for (let i = 0; i < statements.length; i += STATEMENTS_PER_BATCH) {
    const batch = statements.slice(i, i + STATEMENTS_PER_BATCH);
    await db.batch(batch as [(typeof batch)[number], ...typeof batch]);
  }
}

export async function pruneVessels(db: Db, now: number) {
  // Also clears junk MMSIs written before they were filtered at ingest.
  await db
    .delete(vessels)
    .where(or(lt(vessels.lastSeen, now - PRUNE_AFTER_SECONDS), lt(vessels.mmsi, 100_000_000), sql`${vessels.mmsi} > 999999999`));
}

export async function syncVessels(d1: D1Database, state: VesselState, now = Math.floor(Date.now() / 1000)) {
  const db = drizzle(d1);
  const found = new Set<number>();
  let existingCount = 0;
  let written = 0;
  const write = async (rows: NewVesselRow[]) => {
    await upsertVessels(db, rows);
    written += rows.length;
  };

  // Writing behind the cursor does not affect later pages, which only read higher MMSIs.
  for await (const page of loadVesselPages(db)) {
    existingCount += page.length;
    const existing = new Map<number, ExistingRow>();
    for (const row of page) {
      if (!state.seen.has(row.mmsi)) continue;
      existing.set(row.mmsi, row);
      found.add(row.mmsi);
    }
    await write(diffVessels(state, existing.keys(), existing, now));
  }

  const added = [...state.seen.keys()].filter((mmsi) => !found.has(mmsi));
  for (let i = 0; i < added.length; i += WRITE_CHUNK_SIZE) {
    await write(diffVessels(state, added.slice(i, i + WRITE_CHUNK_SIZE), new Map(), now));
  }

  await pruneVessels(db, now);
  return { seen: state.seen.size, existing: existingCount, written };
}
