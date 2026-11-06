const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'short' });
const dateTime = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });
const date = new Intl.DateTimeFormat('en', { dateStyle: 'medium' });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
];

/** Epoch seconds -> "5 min. ago". */
export function formatRelativeTime(epochSec: number, nowMs = Date.now()): string {
  const diff = epochSec - Math.floor(nowMs / 1000);
  for (const [unit, seconds] of UNITS) {
    if (Math.abs(diff) >= seconds) return rtf.format(Math.trunc(diff / seconds), unit);
  }
  return 'just now';
}

export function formatDateTime(epochSec: number | null | undefined): string {
  return epochSec ? dateTime.format(new Date(epochSec * 1000)) : '—';
}

export function formatDate(epochSec: number | null | undefined): string {
  return epochSec ? date.format(new Date(epochSec * 1000)) : '—';
}

/** AIS heading 511 means "not available". */
export function resolveHeading(heading: number | null, cog: number | null): number | null {
  if (heading != null && heading >= 0 && heading < 360) return heading;
  if (cog != null && cog >= 0 && cog < 360) return cog;
  return null;
}

export const formatDegrees = (value: number | null) => (value == null || value >= 360 ? '—' : `${Math.round(value)}°`);
export const formatKnots = (value: number | null) => (value == null || value >= 102.3 ? '—' : `${value.toFixed(1)} kn`);
