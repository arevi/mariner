import { ClockIcon } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useControl } from 'react-map-gl/mapbox';
import { OverlayControl } from '@/components/map/overlay-control';
import { Button } from '@/components/ui/button';
import { useLastUpdated } from '@/hooks/use-data-status';

/** Collapsible data freshness badge in the bottom-right stack, styled like the other map controls. The clock icon toggles it. Must be rendered inside <Map>. */
export function DataStatus() {
  const control = useControl(() => new OverlayControl(), { position: 'bottom-right' });
  const { label, title } = useLastUpdated();
  const [open, setOpen] = useState(true);

  return createPortal(
    <div
      title={title}
      className="bg-background/20 flex items-center rounded-xl border p-1 shadow-xl backdrop-blur-xl backdrop-saturate-150"
    >
      {open && <p className="text-muted-foreground pr-2 pl-2 text-xs whitespace-nowrap tabular-nums">{label}</p>}
      <Button
        variant="ghost"
        size="icon"
        className="map-control-button rounded-md aria-expanded:bg-transparent"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? 'Hide data status' : 'Show data status'}
      >
        <ClockIcon />
      </Button>
    </div>,
    control.container,
  );
}
