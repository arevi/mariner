import { VESSEL_FIELDS as F, type VesselRecord } from '@mariner/ais';

const EXPIRY_SECONDS = 24 * 60 * 60;

interface StaticInfo {
  name?: string;
  shipType?: number;
  length?: number;
}

const obj = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

function dimensionLength(dimension: unknown) {
  const d = obj(dimension);
  const a = num(d?.A);
  const b = num(d?.B);
  return a !== null && b !== null && a + b > 0 ? a + b : undefined;
}

export class VesselState {
  readonly vessels = new Map<number, VesselRecord>();
  private readonly statics = new Map<number, StaticInfo>();
  messageCount = 0;

  load(records: Iterable<VesselRecord>) {
    for (const record of records) this.vessels.set(record[F.mmsi], record);
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
    if (!body || mmsi === null) return;
    this.messageCount++;

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
          prev?.[F.name] || String(body.Name ?? meta?.ShipName ?? '').trim(),
          prev?.[F.shipType] ?? (type === 'ExtendedClassBPositionReport' ? num(body.Type) : null),
          prev?.[F.length] ?? (type === 'ExtendedClassBPositionReport' ? (dimensionLength(body.Dimension) ?? null) : null),
          Math.floor(Date.now() / 1000),
        ]);
        break;
      }
      case 'ShipStaticData':
        this.statics.set(mmsi, {
          name: typeof body.Name === 'string' ? body.Name.trim() : undefined,
          shipType: num(body.Type) ?? undefined,
          length: dimensionLength(body.Dimension),
        });
        break;
      case 'StaticDataReport': {
        const a = obj(body.ReportA);
        const b = obj(body.ReportB);
        this.statics.set(mmsi, {
          name: typeof a?.Name === 'string' ? a.Name.trim() : undefined,
          shipType: num(b?.ShipType) ?? undefined,
          length: dimensionLength(b?.Dimension),
        });
        break;
      }
    }
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
