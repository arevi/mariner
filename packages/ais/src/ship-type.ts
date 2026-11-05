export const SHIP_GROUPS = [
  'wig',
  'fishing',
  'towing',
  'special',
  'hsc',
  'service',
  'passenger',
  'cargo',
  'tanker',
  'other',
  'unknown',
] as const;

export type ShipGroup = (typeof SHIP_GROUPS)[number];

export const SHIP_GROUP_LABELS: Record<ShipGroup, string> = {
  wig: 'Wing in ground',
  fishing: 'Fishing',
  towing: 'Towing & dredging',
  special: 'Military & leisure',
  hsc: 'High-speed craft',
  service: 'Service & rescue',
  passenger: 'Passenger',
  cargo: 'Cargo',
  tanker: 'Tanker',
  other: 'Other',
  unknown: 'Unknown',
};

export const SHIP_GROUP_COLORS: Record<ShipGroup, string> = {
  wig: '#e879f9',
  fishing: '#fb923c',
  towing: '#a16207',
  special: '#a78bfa',
  hsc: '#22d3ee',
  service: '#facc15',
  passenger: '#60a5fa',
  cargo: '#4ade80',
  tanker: '#f87171',
  other: '#cbd5e1',
  unknown: '#64748b',
};

const HAZARD = ['Hazard A', 'Hazard B', 'Hazard C', 'Hazard D'] as const;

const FIXED_NAMES: Record<number, string> = {
  20: 'Wing in ground',
  30: 'Fishing',
  31: 'Towing',
  32: 'Towing (large)',
  33: 'Dredging or underwater ops',
  34: 'Diving ops',
  35: 'Military ops',
  36: 'Sailing',
  37: 'Pleasure craft',
  50: 'Pilot vessel',
  51: 'Search and rescue',
  52: 'Tug',
  53: 'Port tender',
  54: 'Anti-pollution',
  55: 'Law enforcement',
  58: 'Medical transport',
  59: 'Non-combatant',
};

const CATEGORY_NAMES: Record<number, string> = {
  2: 'Wing in ground',
  4: 'High-speed craft',
  6: 'Passenger',
  7: 'Cargo',
  8: 'Tanker',
  9: 'Other',
};

/** Individual AIS ship type name, e.g. 71 -> "Cargo (Hazard A)". */
export function shipTypeLabel(code: number | null | undefined): string {
  if (code == null) return 'Unknown';
  const fixed = FIXED_NAMES[code];
  if (fixed) return fixed;
  const category = CATEGORY_NAMES[Math.floor(code / 10)];
  if (!category || code < 20 || code > 99) return 'Unknown';
  const digit = code % 10;
  if (digit === 0) return category;
  if (digit <= 4) return `${category} (${HAZARD[digit - 1]})`;
  return digit === 9 ? `${category} (no additional info)` : `${category} (reserved)`;
}

/** Broad color-coding group derived from the AIS ship type decade. */
export function shipTypeGroup(code: number | null | undefined): ShipGroup {
  if (code == null) return 'unknown';
  if (code >= 20 && code < 30) return 'wig';
  if (code === 30) return 'fishing';
  if (code === 31 || code === 32 || code === 33 || code === 34) return 'towing';
  if (code >= 35 && code <= 37) return 'special';
  if (code >= 40 && code < 50) return 'hsc';
  if (code >= 50 && code < 60) return 'service';
  if (code >= 60 && code < 70) return 'passenger';
  if (code >= 70 && code < 80) return 'cargo';
  if (code >= 80 && code < 90) return 'tanker';
  if (code >= 90 && code < 100) return 'other';
  return 'unknown';
}

/** AIS navigational status codes. */
export const NAV_STATUS_LABELS: Record<number, string> = {
  0: 'Under way using engine',
  1: 'At anchor',
  2: 'Not under command',
  3: 'Restricted maneuverability',
  4: 'Constrained by draught',
  5: 'Moored',
  6: 'Aground',
  7: 'Engaged in fishing',
  8: 'Under way sailing',
  11: 'Power-driven towing astern',
  12: 'Power-driven pushing ahead',
  14: 'AIS-SART active',
};
