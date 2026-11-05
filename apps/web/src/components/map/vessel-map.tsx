import { SHIP_GROUP_COLORS, VESSEL_FIELDS as F, shipTypeGroup, type Bbox, type VesselRecord, type VesselSearchResult } from '@mariner/ais';
import type { FeatureCollection, Point } from 'geojson';
import type { MapMouseEvent } from 'mapbox-gl';
import { useCallback, useMemo, useRef, useState } from 'react';
import { AttributionControl, Layer, Map, Source, type MapRef } from 'react-map-gl/mapbox';
import { VesselPanel } from '@/components/vessel/vessel-panel';
import { VesselSearch } from '@/components/vessel/vessel-search';
import { useVessels } from '@/hooks/use-vessels';
import { resolveHeading } from '@/lib/format';
import { MapControls } from './map-controls';
import { VesselTooltip, type HoveredVessel } from './vessel-tooltip';

type MapInstance = ReturnType<MapRef['getMap']>;

const ICON_ID = 'vessel-triangle';
const LAYER_ID = 'vessels';
const ICON_SIZE = 48;
const SELECT_ZOOM = 14;

// Snap outward so the box always covers the viewport, even when it is smaller than the grid.
const floor = (value: number) => Math.floor(value * 10) / 10;
const ceil = (value: number) => Math.ceil(value * 10) / 10;

function boundsToBbox(map: MapInstance): Bbox {
  const b = map.getBounds()!;
  return [
    Math.max(-180, floor(b.getWest())),
    Math.max(-90, floor(b.getSouth())),
    Math.min(180, ceil(b.getEast())),
    Math.min(90, ceil(b.getNorth())),
  ];
}

/** White (SDF) triangle pointing north; tinted and rotated per vessel by the layer. */
function addTriangleIcon(map: MapInstance) {
  if (map.hasImage(ICON_ID)) return;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = ICON_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.beginPath();
  ctx.moveTo(ICON_SIZE / 2, 4);
  ctx.lineTo(ICON_SIZE - 10, ICON_SIZE - 6);
  ctx.lineTo(ICON_SIZE / 2, ICON_SIZE - 14);
  ctx.lineTo(10, ICON_SIZE - 6);
  ctx.closePath();
  ctx.fillStyle = '#fff';
  ctx.fill();
  map.addImage(ICON_ID, ctx.getImageData(0, 0, ICON_SIZE, ICON_SIZE), { sdf: true });
}

export function VesselMap() {
  const [bbox, setBbox] = useState<Bbox | null>(null);
  const [iconReady, setIconReady] = useState(false);
  const [hovered, setHovered] = useState<HoveredVessel | null>(null);
  const [selectedMmsi, setSelectedMmsi] = useState<number | null>(null);
  const [searched, setSearched] = useState<VesselRecord | null>(null);
  const mapRef = useRef<MapRef>(null);
  const { data } = useVessels(bbox);

  const onViewChange = useCallback((event: { target: MapInstance }) => setBbox(boundsToBbox(event.target)), []);

  const onLoad = useCallback(
    (event: { target: MapInstance }) => {
      addTriangleIcon(event.target);
      setIconReady(true);
      onViewChange(event);
    },
    [onViewChange],
  );

  const geojson = useMemo<FeatureCollection<Point>>(
    () => ({
      type: 'FeatureCollection',
      features: (data?.vessels ?? []).map((vessel) => {
        const shipType = vessel[F.shipType];
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [vessel[F.lng], vessel[F.lat]] },
          properties: {
            mmsi: vessel[F.mmsi],
            name: vessel[F.name],
            shipType,
            seenAt: vessel[F.seenAt],
            heading: resolveHeading(vessel[F.heading], vessel[F.cog]) ?? 0,
            color: SHIP_GROUP_COLORS[shipTypeGroup(shipType)],
          },
        };
      }),
    }),
    [data],
  );

  const selectedRecord = useMemo(
    () => data?.vessels.find((vessel) => vessel[F.mmsi] === selectedMmsi) ?? (searched?.[F.mmsi] === selectedMmsi ? searched : undefined),
    [data, selectedMmsi, searched],
  );

  const onMouseMove = useCallback((event: MapMouseEvent & { features?: GeoJSON.Feature[] }) => {
    const feature = event.features?.[0];
    if (!feature) return setHovered((current) => (current ? null : current));
    const { mmsi, name, shipType, seenAt } = feature.properties as HoveredVessel;
    const [lng, lat] = (feature.geometry as Point).coordinates;
    setHovered((current) =>
      current?.mmsi === mmsi && current.seenAt === seenAt ? current : { mmsi, name, shipType, seenAt, lng: lng!, lat: lat! },
    );
  }, []);

  const flyToVessel = useCallback((lng: number, lat: number) => {
    const map = mapRef.current;
    map?.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), SELECT_ZOOM), duration: 1200 });
  }, []);

  const onClick = useCallback(
    (event: MapMouseEvent & { features?: GeoJSON.Feature[] }) => {
      const feature = event.features?.[0];
      setSelectedMmsi((feature?.properties?.mmsi as number | undefined) ?? null);
      if (!feature) return;
      const [lng, lat] = (feature.geometry as Point).coordinates;
      flyToVessel(lng!, lat!);
    },
    [flyToVessel],
  );

  const onSearchResult = useCallback(
    ({ vessel, position }: VesselSearchResult) => {
      setSearched(position);
      setSelectedMmsi(vessel?.mmsi ?? position![F.mmsi]);
      if (position) flyToVessel(position[F.lng], position[F.lat]);
    },
    [flyToVessel],
  );

  const selectedGeojson = useMemo<FeatureCollection<Point>>(
    () => ({
      type: 'FeatureCollection',
      features: selectedRecord
        ? [{ type: 'Feature', geometry: { type: 'Point', coordinates: [selectedRecord[F.lng], selectedRecord[F.lat]] }, properties: {} }]
        : [],
    }),
    [selectedRecord],
  );

  return (
    <div className="relative size-full">
      <Map
        ref={mapRef}
        mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
        initialViewState={{ longitude: 0, latitude: 20, zoom: 2 }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        projection="mercator"
        attributionControl={false}
        style={{ width: '100%', height: '100%' }}
        interactiveLayerIds={iconReady ? [LAYER_ID] : []}
        cursor={hovered ? 'pointer' : ''}
        onLoad={onLoad}
        onMoveEnd={onViewChange}
        onMouseMove={onMouseMove}
        onMouseOut={() => setHovered(null)}
        onClick={onClick}
      >
        {iconReady && (
          <Source id="vessels" type="geojson" data={geojson} promoteId="mmsi">
            <Layer
              id={LAYER_ID}
              type="symbol"
              layout={{
                'icon-image': ICON_ID,
                'icon-rotate': ['get', 'heading'],
                'icon-rotation-alignment': 'map',
                'icon-pitch-alignment': 'map',
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
                'icon-size': ['interpolate', ['linear'], ['zoom'], 2, 0.2, 8, 0.4, 14, 0.7, 18, 1],
              }}
              paint={{
                'icon-color': ['get', 'color'],
                'icon-opacity': 0.9,
              }}
            />
          </Source>
        )}
        {iconReady && (
          <Source id="selected-vessel" type="geojson" data={selectedGeojson}>
            <Layer
              id="selected-vessel-ring"
              type="circle"
              paint={{
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 8, 8, 12, 14, 22, 18, 30],
                'circle-color': '#ffffff',
                'circle-opacity': 0.06,
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 2,
                'circle-stroke-opacity': 0.9,
              }}
            />
          </Source>
        )}
        {hovered && <VesselTooltip vessel={hovered} />}
        <AttributionControl position="bottom-right" compact />
        <MapControls />
      </Map>
      {selectedMmsi === null ? (
        <VesselSearch onResult={onSearchResult} />
      ) : (
        <VesselPanel mmsi={selectedMmsi} record={selectedRecord} onClose={() => setSelectedMmsi(null)} />
      )}
    </div>
  );
}
