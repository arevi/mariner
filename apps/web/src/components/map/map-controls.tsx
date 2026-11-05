import { AlertCircleIcon, LoaderCircleIcon, LocateFixedIcon, MinusIcon, Navigation2Icon, PlusIcon } from 'lucide-react';
import type { IControl } from 'mapbox-gl';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useControl, useMap } from 'react-map-gl/mapbox';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const LOCATE_ZOOM = 11;
const ERROR_DISMISS_MS = 5000;
const BUTTON_CLASS = 'map-control-button rounded-md';

class OverlayControl implements IControl {
  container = document.createElement('div');

  onAdd() {
    this.container.className = 'mapboxgl-ctrl';
    return this.container;
  }

  onRemove() {
    this.container.remove();
  }
}

/** Zoom, compass and "my location" buttons, styled like the side panels. */
export function MapControls() {
  const { current: map } = useMap();
  const control = useControl(() => new OverlayControl(), { position: 'bottom-right' });
  const [bearing, setBearing] = useState(0);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  useEffect(() => {
    if (!map) return;
    const onRotate = () => setBearing(map.getBearing());
    map.on('rotate', onRotate);
    return () => void map.off('rotate', onRotate);
  }, [map]);

  useEffect(() => {
    if (!locateError) return;
    const timeout = setTimeout(() => setLocateError(null), ERROR_DISMISS_MS);
    return () => clearTimeout(timeout);
  }, [locateError]);

  const locate = () => {
    if (!navigator.geolocation) return setLocateError('Geolocation is not supported by this browser');
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        map?.flyTo({ center: [coords.longitude, coords.latitude], zoom: Math.max(map.getZoom(), LOCATE_ZOOM), duration: 1500 });
      },
      (error) => {
        setLocating(false);
        setLocateError(error.code === error.PERMISSION_DENIED ? 'Location permission denied' : 'Unable to determine your location');
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  return createPortal(
    <div className="relative">
      {locateError && (
        <p
          role="alert"
          className="bg-background/45 text-destructive absolute right-full bottom-1 mr-2 flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs whitespace-nowrap backdrop-blur-md"
        >
          <AlertCircleIcon className="size-3.5 shrink-0" />
          {locateError}
        </p>
      )}
      <div className="bg-background/45 flex flex-col gap-0.5 rounded-lg p-1 backdrop-blur-md">
        <Button variant="ghost" size="icon" className={BUTTON_CLASS} onClick={() => map?.zoomIn()} aria-label="Zoom in">
          <PlusIcon />
        </Button>
        <Separator />
        <Button variant="ghost" size="icon" className={BUTTON_CLASS} onClick={() => map?.zoomOut()} aria-label="Zoom out">
          <MinusIcon />
        </Button>
        <Separator />
        <Button
          variant="ghost"
          size="icon"
          className={BUTTON_CLASS}
          onClick={() => map?.resetNorthPitch()}
          aria-label="Reset bearing to north"
        >
          <Navigation2Icon style={{ transform: `rotate(${-bearing}deg)` }} />
        </Button>
        <Separator />
        <Button variant="ghost" size="icon" className={BUTTON_CLASS} onClick={locate} disabled={locating} aria-label="Show my location">
          {locating ? <LoaderCircleIcon className="animate-spin" /> : <LocateFixedIcon />}
        </Button>
      </div>
    </div>,
    control.container,
  );
}
