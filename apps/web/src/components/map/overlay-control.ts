import type { IControl } from 'mapbox-gl';

/** Empty Mapbox control whose container hosts React content via a portal. */
export class OverlayControl implements IControl {
  container = document.createElement('div');

  onAdd() {
    this.container.className = 'mapboxgl-ctrl';
    return this.container;
  }

  onRemove() {
    this.container.remove();
  }
}
