import { shipTypeGroup, shipTypeLabel } from '@mariner/ais';
import { ClockIcon, ShipIcon } from 'lucide-react';
import { Popup } from 'react-map-gl/mapbox';
import { useVesselDetail } from '@/hooks/use-vessel-detail';
import { formatRelativeTime } from '@/lib/format';
import { useShipColors } from '@/lib/theme';

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
  const color = useShipColors()[shipTypeGroup(vessel.shipType)];
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
      <div className="bg-background/20 w-52 overflow-hidden rounded-xl border shadow-xl backdrop-blur-xl backdrop-saturate-150">
        <div
          className="flex items-center gap-2.5 p-2.5"
          style={{ backgroundImage: `linear-gradient(135deg, ${color}33, transparent 70%)` }}
        >
          <div className="grid size-8 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: `${color}33`, color }}>
            <ShipIcon className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm leading-tight font-semibold">{callSign ?? '—'}</div>
            <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
              <span className="truncate">{shipTypeLabel(vessel.shipType)}</span>
            </div>
          </div>
        </div>
        <div className="text-muted-foreground flex items-center justify-between gap-3 border-t bg-foreground/5 px-2.5 py-1.5 text-xs tabular-nums">
          <span>{vessel.mmsi}</span>
          <span className="flex items-center gap-1">
            <ClockIcon className="size-3" />
            {formatRelativeTime(vessel.seenAt)}
          </span>
        </div>
      </div>
    </Popup>
  );
}
