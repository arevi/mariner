import { VesselMap } from '@/components/map/vessel-map';

export default function App() {
  return (
    <div className="relative h-dvh w-screen overflow-hidden">
      {import.meta.env.VITE_MAPBOX_TOKEN ? (
        <VesselMap />
      ) : (
        <div className="grid size-full place-items-center p-6 text-center">
          <p className="text-muted-foreground max-w-sm text-sm">
            The map is unavailable: <code className="font-mono">VITE_MAPBOX_TOKEN</code> was not set when this app was built.
          </p>
        </div>
      )}
    </div>
  );
}
