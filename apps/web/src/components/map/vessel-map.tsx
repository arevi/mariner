import { VESSEL_FIELDS as F, type Bbox } from '@mariner/ais';
import type { FeatureCollection, Point } from 'geojson';
import { useCallback, useMemo, useState } from 'react';
import { GeolocateControl, Layer, Map, NavigationControl, ScaleControl, Source, type MapRef } from 'react-map-gl/mapbox';
import { useVessels } from '@/hooks/use-vessels';

const round = (value: number) => Math.round(value * 10) / 10;

function boundsToBbox(map: ReturnType<MapRef['getMap']>): Bbox {
  const b = map.getBounds()!;
  return [
    Math.max(-180, round(b.getWest())),
    Math.max(-90, round(b.getSouth())),
    Math.min(180, round(b.getEast())),
    Math.min(90, round(b.getNorth())),
  ];
}

export function VesselMap() {
  const [bbox, setBbox] = useState<Bbox | null>(null);
  const { data } = useVessels(bbox);

  const onViewChange = useCallback((event: { target: ReturnType<MapRef['getMap']> }) => setBbox(boundsToBbox(event.target)), []);

  const geojson = useMemo<FeatureCollection<Point>>(
    () => ({
      type: 'FeatureCollection',
      features: (data?.vessels ?? []).map((vessel) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [vessel[F.lng], vessel[F.lat]] },
        properties: { mmsi: vessel[F.mmsi], name: vessel[F.name] },
      })),
    }),
    [data],
  );

  return (
    <Map
      mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
      initialViewState={{ longitude: 0, latitude: 20, zoom: 2 }}
      mapStyle="mapbox://styles/mapbox/dark-v11"
      projection="mercator"
      style={{ width: '100%', height: '100%' }}
      onLoad={onViewChange}
      onMoveEnd={onViewChange}
    >
      <Source id="vessels" type="geojson" data={geojson}>
        <Layer
          id="vessels"
          type="circle"
          paint={{
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 1.5, 10, 5],
            'circle-color': '#38bdf8',
            'circle-opacity': 0.8,
          }}
        />
      </Source>
      <NavigationControl position="bottom-right" />
      <GeolocateControl position="bottom-right" />
      <ScaleControl position="bottom-left" />
    </Map>
  );
}
