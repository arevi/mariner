import { VESSEL_FIELDS as F, type VesselRecord } from '@mariner/ais';

const EXPIRY_SECONDS = 24 * 60 * 60;

export interface StaticInfo {
  name?: string;
  shipType?: number;
  length?: number;
  beam?: number;
  imo?: number;
  callSign?: string;
  draught?: number;
  destination?: string;
  /** Epoch seconds. */
  eta?: number;
}

const THIRTY_DAYS = 30 * 24 * 60 * 60;
const SIX_MONTHS = 183 * 24 * 60 * 60;
const MAX_LENGTH = 500;
const MAX_BEAM = 80;

const obj = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
/** AISStream sets Valid to false when a decoded message failed validation. */
const validPart = (value: unknown) => {
  const part = obj(value);
  return part?.Valid === false ? undefined : part;
};
const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

function dimensionLength(dimension: unknown) {
  const d = obj(dimension);
  const a = num(d?.A);
  const b = num(d?.B);
  return a !== null && b !== null && a + b > 0 && a + b <= MAX_LENGTH ? a + b : undefined;
}

const positive = (value: unknown) => {
  const n = num(value);
  return n !== null && n > 0 ? n : undefined;
};

/** AIS text fields are padded with '@'. */
function cleanText(value: unknown) {
  if (typeof value !== 'string') return undefined;
  return value.replaceAll('@', ' ').replace(/\s+/g, ' ').trim() || undefined;
}

/** 0 means not available; 1-99 are the defined AIS ship types. */
const validShipType = (value: unknown) => {
  const n = num(value);
  return n !== null && n >= 1 && n <= 99 ? n : undefined;
};

/** IMO numbers are 7 digits with a weighted check digit. */
function validImo(value: unknown) {
  const n = positive(value);
  if (n === undefined || n < 1_000_000 || n > 9_999_999) return undefined;
  const digits = String(n);
  let sum = 0;
  for (let i = 0; i < 6; i++) sum += Number(digits[i]) * (7 - i);
  return sum % 10 === Number(digits[6]) ? n : undefined;
}

function dimensionBeam(dimension: unknown) {
  const d = obj(dimension);
  const c = num(d?.C);
  const dd = num(d?.D);
  return c !== null && dd !== null && c + dd > 0 && c + dd <= MAX_BEAM ? c + dd : undefined;
}

/** AIS ETA has no year. Use this year if not >30 days past, else next year if within 6 months; otherwise treat as stale. */
function etaToEpoch(eta: unknown, now: number) {
  const e = obj(eta);
  const month = num(e?.Month);
  const day = num(e?.Day);
  const hour = num(e?.Hour);
  const minute = num(e?.Minute);
  if (month === null || day === null || hour === null || minute === null) return undefined;
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return undefined;
  const year = new Date(now * 1000).getUTCFullYear();
  for (const y of [year, year + 1]) {
    const date = new Date(Date.UTC(y, month - 1, day, hour, minute));
    if (date.getUTCMonth() !== month - 1) return undefined;
    const seconds = Math.floor(date.getTime() / 1000);
    if (seconds >= now - THIRTY_DAYS) return seconds <= now + SIX_MONTHS ? seconds : undefined;
  }
  return undefined;
}

const defined = <T extends object>(value: T) => Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;

/** Valid MMSIs are 9 digits; anything else is a misconfigured or test transponder. */
export const isValidMmsi = (mmsi: number) => Number.isInteger(mmsi) && mmsi >= 100_000_000 && mmsi <= 999_999_999;

export class VesselState {
  readonly vessels = new Map<number, VesselRecord>();
  readonly statics = new Map<number, StaticInfo>();
  /** First and last message time (epoch s) per MMSI seen this run. */
  readonly seen = new Map<number, { first: number; last: number }>();
  messageCount = 0;

  load(records: Iterable<VesselRecord>) {
    for (const record of records) if (isValidMmsi(record[F.mmsi])) this.vessels.set(record[F.mmsi], record);
  }

  ingest(raw: string) {
    let frame: Record<string, unknown> | undefined;
    try {
      frame = obj(JSON.parse(raw));
    } catch {
      return;
    }
    const type = frame?.MessageType;
    const meta = obj(frame?.MetaData);
    const body = obj(obj(frame?.Message)?.[String(type)]);
    const mmsi = num(meta?.MMSI);
    if (!body || mmsi === null || !isValidMmsi(mmsi) || body.Valid === false) return;
    this.messageCount++;
    const now = Math.floor(Date.now() / 1000);
    const seen = this.seen.get(mmsi);
    if (seen) seen.last = now;
    else this.seen.set(mmsi, { first: now, last: now });

    switch (type) {
      case 'PositionReport':
      case 'StandardClassBPositionReport':
      case 'ExtendedClassBPositionReport': {
        const lat = num(body.Latitude ?? meta?.latitude);
        const lng = num(body.Longitude ?? meta?.longitude);
        if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
        const prev = this.vessels.get(mmsi);
        const heading = num(body.TrueHeading);
        const sog = num(body.Sog);
        const cog = num(body.Cog);
        this.vessels.set(mmsi, [
          mmsi,
          lat,
          lng,
          sog !== null && sog < 102.3 ? sog : null,
          cog !== null && cog < 360 ? cog : null,
          heading !== null && heading < 360 ? heading : null,
          num(body.NavigationalStatus),
          prev?.[F.name] || cleanText(body.Name ?? meta?.ShipName) || '',
          prev?.[F.shipType] ?? (type === 'ExtendedClassBPositionReport' ? (validShipType(body.Type) ?? null) : null),
          prev?.[F.length] ?? (type === 'ExtendedClassBPositionReport' ? (dimensionLength(body.Dimension) ?? null) : null),
          now,
        ]);
        break;
      }
      case 'ShipStaticData':
        this.mergeStatic(mmsi, {
          name: cleanText(body.Name),
          shipType: validShipType(body.Type),
          length: dimensionLength(body.Dimension),
          beam: dimensionBeam(body.Dimension),
          imo: validImo(body.ImoNumber),
          callSign: cleanText(body.CallSign),
          draught: positive(body.MaximumStaticDraught),
          destination: cleanText(body.Destination),
          eta: etaToEpoch(body.Eta, now),
        });
        break;
      case 'StaticDataReport': {
        const a = validPart(body.ReportA);
        const b = validPart(body.ReportB);
        this.mergeStatic(mmsi, {
          name: cleanText(a?.Name),
          shipType: validShipType(b?.ShipType),
          length: dimensionLength(b?.Dimension),
          beam: dimensionBeam(b?.Dimension),
          callSign: cleanText(b?.CallSign),
        });
        break;
      }
    }
  }

  /** Class B reports arrive as separate A/B parts, so merge instead of replacing. */
  private mergeStatic(mmsi: number, info: StaticInfo) {
    this.statics.set(mmsi, { ...this.statics.get(mmsi), ...defined(info) });
  }

  /** Applies static info, drops stale vessels, and returns the final records. */
  finalize(now = Math.floor(Date.now() / 1000)) {
    for (const [mmsi, info] of this.statics) {
      const record = this.vessels.get(mmsi);
      if (!record) continue;
      if (info.name) record[F.name] = info.name;
      if (info.shipType !== undefined) record[F.shipType] = info.shipType;
      if (info.length !== undefined) record[F.length] = info.length;
    }
    for (const [mmsi, record] of this.vessels) {
      if (now - record[F.seenAt] > EXPIRY_SECONDS) this.vessels.delete(mmsi);
    }
    return [...this.vessels.values()];
  }
}
