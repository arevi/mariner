import { z } from 'zod';
import type { VesselRow } from './schema.ts';

/** [mmsi, lat, lng, sog, cog, heading, navStatus, name, shipType, lengthM, seenAt (epoch s)] */
export const vesselRecordSchema = z.tuple([
  z.number().int(),
  z.number(),
  z.number(),
  z.number().nullable(),
  z.number().nullable(),
  z.number().nullable(),
  z.number().int().nullable(),
  z.string(),
  z.number().int().nullable(),
  z.number().nullable(),
  z.number().int(),
]);

export type VesselRecord = z.infer<typeof vesselRecordSchema>;

export const manifestSchema = z.object({
  runId: z.string(),
  updatedAt: z.string(),
  vesselCount: z.number().int(),
  messageCount: z.number().int(),
  windowSec: z.number().int(),
  tiles: z.array(z.string()),
});

export type Manifest = z.infer<typeof manifestSchema>;

export const MANIFEST_KEY = 'vessels/v1/manifest.json';
export const tileObjectKey = (tile: string) => `vessels/v1/tiles/${tile}.json`;

export const VESSEL_FIELDS = {
  mmsi: 0,
  lat: 1,
  lng: 2,
  sog: 3,
  cog: 4,
  heading: 5,
  navStatus: 6,
  name: 7,
  shipType: 8,
  length: 9,
  seenAt: 10,
} as const;

/** Result of looking a vessel up by MMSI or call sign. Either half can be missing. */
export interface VesselSearchResult {
  vessel: VesselRow | null;
  position: VesselRecord | null;
}
