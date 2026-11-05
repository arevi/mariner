import { SHIP_GROUP_COLORS, shipTypeGroup, shipTypeLabel } from '@mariner/ais';
import { Popup } from 'react-map-gl/mapbox';
import { useVesselDetail } from '@/hooks/use-vessel-detail';
import { formatRelativeTime } from '@/lib/format';

export interface HoveredVessel {
  mmsi: number;
  name: string;
  shipType: number | null;
  seenAt: number;
  lng: number;
  lat: number;
}

export function VesselTooltip({ vessel }: { vessel: HoveredVessel }) {
  const { data } = useVesselDetail(vessel.mmsi);
  const callSign = data?.callSign ?? (vessel.name || null);

  return (
    <Popup
      longitude={vessel.lng}
      latitude={vessel.lat}
      anchor="bottom"
      offset={14}
      closeButton={false}
      closeOnClick={false}
      focusAfterOpen={false}
      maxWidth="none"
      className="vessel-popup"
    >
      <div className="bg-background/70 text-foreground min-w-36 rounded-md border border-white/10 px-2.5 py-1.5 text-xs backdrop-blur-md">
        <div className="text-sm font-semibold">{callSign ?? '—'}</div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: SHIP_GROUP_COLORS[shipTypeGroup(vessel.shipType)] }} />
          <span>{shipTypeLabel(vessel.shipType)}</span>
        </div>
        <div className="text-muted-foreground mt-0.5 flex justify-between gap-3 tabular-nums">
          <span>{vessel.mmsi}</span>
          <span>{formatRelativeTime(vessel.seenAt)}</span>
        </div>
      </div>
    </Popup>
  );
}
