export const TILE_ZOOM = 3;

export type Bbox = readonly [minLng: number, minLat: number, maxLng: number, maxLat: number];

const MAX_LAT = 85.0511287798;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function lngToTileX(lng: number, z = TILE_ZOOM) {
  const n = 2 ** z;
  return clamp(Math.floor(((lng + 180) / 360) * n), 0, n - 1);
}

export function latToTileY(lat: number, z = TILE_ZOOM) {
  const n = 2 ** z;
  const rad = (clamp(lat, -MAX_LAT, MAX_LAT) * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  return clamp(Math.floor(y), 0, n - 1);
}

export function tileKey(x: number, y: number, z = TILE_ZOOM) {
  return `${z}/${x}/${y}`;
}

export function tileKeyForPoint(lat: number, lng: number, z = TILE_ZOOM) {
  return tileKey(lngToTileX(lng, z), latToTileY(lat, z), z);
}

export function tileKeysForBbox([minLng, minLat, maxLng, maxLat]: Bbox, z = TILE_ZOOM) {
  const x0 = lngToTileX(minLng, z);
  const x1 = lngToTileX(maxLng, z);
  const y0 = latToTileY(maxLat, z);
  const y1 = latToTileY(minLat, z);
  const keys: string[] = [];
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) keys.push(tileKey(x, y, z));
  }
  return keys;
}
