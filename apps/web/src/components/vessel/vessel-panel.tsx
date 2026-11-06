import { NAV_STATUS_LABELS, SHIP_GROUP_LABELS, VESSEL_FIELDS as F, shipTypeGroup, shipTypeLabel, type VesselRecord } from '@mariner/ais';
import { AnchorIcon, ClockIcon, MapPinIcon, RulerIcon, ShipIcon, XIcon, type LucideIcon } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useVesselDetail } from '@/hooks/use-vessel-detail';
import { formatDate, formatDateTime, formatDegrees, formatKnots, formatRelativeTime } from '@/lib/format';
import { useShipColors } from '@/lib/theme';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-[13px]">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className="min-w-0 text-right font-medium break-words">{children ?? '—'}</dd>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-(--vessel-color) uppercase">
        <Icon className="size-3.5" />
        {title}
      </h3>
      <dl className="divide-y divide-(--vessel-color)/15">{children}</dl>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-(--vessel-color)/10 px-2 py-1.5 text-center">
      <div className="text-sm font-semibold tabular-nums">{value}</div>
      <div className="text-muted-foreground text-[10px] tracking-wide uppercase">{label}</div>
    </div>
  );
}

interface VesselPanelProps {
  mmsi: number;
  record: VesselRecord | undefined;
  onClose: () => void;
}

export function VesselPanel({ mmsi, record, onClose }: VesselPanelProps) {
  const { data: detail, isPending } = useVesselDetail(mmsi);
  const shipType = detail?.shipType ?? record?.[F.shipType] ?? null;
  const group = shipTypeGroup(shipType);
  const color = useShipColors()[group];
  const name = detail?.name || record?.[F.name] || `MMSI ${mmsi}`;
  const length = detail?.length ?? record?.[F.length];
  const navStatus = record?.[F.navStatus];
  const dimensions = length ? [`${length} m`, detail?.beam ? `${detail.beam} m` : null].filter(Boolean).join(' × ') : null;

  return (
    <aside
      className="bg-background/20 absolute top-6 bottom-24 left-4 z-10 flex w-72 flex-col overflow-hidden rounded-xl border shadow-xl backdrop-blur-xl backdrop-saturate-150"
      style={{ '--vessel-color': color } as CSSProperties}
    >
      <header className="relative p-4 pb-3" style={{ backgroundImage: `linear-gradient(135deg, ${color}33, transparent 70%)` }}>
        <Button variant="ghost" size="icon-sm" className="absolute top-2 right-2" onClick={onClose} aria-label="Close">
          <XIcon />
        </Button>
        <div className="flex items-center gap-3 pr-8">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: `${color}33`, color }}>
            <ShipIcon className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base leading-tight font-semibold">{name}</h2>
            <p className="text-muted-foreground truncate text-xs">{detail?.callSign ?? (isPending ? '…' : 'No call sign')}</p>
          </div>
        </div>
        <Badge variant="outline" className="mt-3 gap-1.5">
          <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
          {shipTypeLabel(shipType)}
          {SHIP_GROUP_LABELS[group] !== shipTypeLabel(shipType) && (
            <span className="text-muted-foreground">· {SHIP_GROUP_LABELS[group]}</span>
          )}
        </Badge>
      </header>
      <Separator />
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-5 p-4">
          {record && (
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Speed" value={formatKnots(record[F.sog])} />
              <Stat label="Course" value={formatDegrees(record[F.cog])} />
              <Stat label="Heading" value={formatDegrees(record[F.heading])} />
            </div>
          )}
          <Section title="Identity" icon={ShipIcon}>
            <Row label="MMSI">{mmsi}</Row>
            <Row label="IMO">{detail?.imo}</Row>
            <Row label="Call sign">{detail?.callSign}</Row>
          </Section>
          <Section title="Voyage" icon={AnchorIcon}>
            <Row label="Destination">{detail?.destination}</Row>
            <Row label="ETA">{detail?.eta ? formatDateTime(detail.eta) : null}</Row>
            <Row label="Status">{navStatus != null ? (NAV_STATUS_LABELS[navStatus] ?? '—') : null}</Row>
          </Section>
          <Section title="Dimensions" icon={RulerIcon}>
            <Row label="Length × beam">{dimensions}</Row>
            <Row label="Draught">{detail?.draught ? `${detail.draught} m` : null}</Row>
          </Section>
          {record && (
            <Section title="Position" icon={MapPinIcon}>
              <Row label="Latitude">{record[F.lat].toFixed(4)}°</Row>
              <Row label="Longitude">{record[F.lng].toFixed(4)}°</Row>
              <Row label="Reported">{formatRelativeTime(record[F.seenAt])}</Row>
            </Section>
          )}
          <Section title="History" icon={ClockIcon}>
            <Row label="First seen">{formatDateTime(detail?.firstSeen)}</Row>
            <Row label="Last seen">{record ? formatDateTime(record[F.seenAt]) : formatDate(detail?.lastSeen)}</Row>
            <Row label="Updated">{formatDateTime(detail?.updatedAt)}</Row>
          </Section>
        </div>
      </ScrollArea>
    </aside>
  );
}
