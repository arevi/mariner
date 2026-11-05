import { MoonIcon, SunIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { createPortal } from 'react-dom';
import { useControl } from 'react-map-gl/mapbox';
import { OverlayControl } from '@/components/map/overlay-control';
import { Button } from '@/components/ui/button';

/** Map control that sits in the bottom-right stack; must be rendered inside <Map>. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const control = useControl(() => new OverlayControl(), { position: 'bottom-right' });
  const isLight = resolvedTheme === 'light';

  return createPortal(
    <div className="bg-background/20 rounded-xl border p-1 shadow-xl backdrop-blur-xl backdrop-saturate-150">
      <Button
        variant="ghost"
        size="icon"
        className="map-control-button rounded-md"
        onClick={() => setTheme(isLight ? 'dark' : 'light')}
        aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      >
        {isLight ? <MoonIcon /> : <SunIcon />}
      </Button>
    </div>,
    control.container,
  );
}
