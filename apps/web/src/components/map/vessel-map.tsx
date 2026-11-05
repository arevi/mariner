import { GeolocateControl, Map, NavigationControl, ScaleControl } from 'react-map-gl/mapbox';

export function VesselMap() {
  return (
    <Map
      mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
      initialViewState={{ longitude: 0, latitude: 20, zoom: 2 }}
      mapStyle="mapbox://styles/mapbox/dark-v11"
      projection="mercator"
      style={{ width: '100%', height: '100%' }}
    >
      <NavigationControl position="bottom-right" />
      <GeolocateControl position="bottom-right" />
      <ScaleControl position="bottom-left" />
    </Map>
  );
}
