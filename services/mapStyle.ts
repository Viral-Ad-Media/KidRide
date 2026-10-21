/// <reference types="google.maps" />

// KidRide's own look for every map in the app: a soft, desaturated slate base
// with sky-tinted water and parks, white roads, and no POI, business or
// transit clutter. Road names only appear once the map is zoomed in.
// Google's logo and attribution stay visible, as the Maps terms require.

export const BRAND = {
  blue: '#1d6fff',
  blueSoft: '#bfdbfe',
  sky: '#38bdf8',
  ink: '#0f172a',
  slate: '#64748b',
  green: '#059669',
  amber: '#f59e0b',
  font: "'Plus Jakarta Sans', system-ui, sans-serif"
};

const base: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#f1f5f9' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f8fafc' }, { weight: 3 }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#cbd5e1' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.neighborhood', elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#eef2f7' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#eaf1f8' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', stylers: [{ visibility: 'on' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#dcefe7' }] },
  { featureType: 'poi.park', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.school', stylers: [{ visibility: 'on' }] },
  { featureType: 'poi.school', elementType: 'geometry', stylers: [{ color: '#e6eefb' }] },
  { featureType: 'poi.school', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e2e8f0' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#e0ecff' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#c7dbff' }] },
  { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#fbfdff' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#cfe8fb' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#7aa7d6' }] }
];

// Zoomed out, only area names: road names would just add noise.
const zoomedOutLabels: google.maps.MapTypeStyle[] = [
  { featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'off' }] }
];
const zoomedInLabels: google.maps.MapTypeStyle[] = [
  { featureType: 'road.local', elementType: 'labels', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'road.highway', elementType: 'labels', stylers: [{ visibility: 'simplified' }] }
];

const LABEL_ZOOM = 14;
export const KIDRIDE_STYLE_ZOOMED_OUT = [...base, ...zoomedOutLabels];
export const KIDRIDE_STYLE_ZOOMED_IN = [...base, ...zoomedInLabels];

/** Options for a new KidRide map: our style, no Google controls (we draw our own). */
export const kidRideMapOptions = (options: google.maps.MapOptions = {}): google.maps.MapOptions => ({
  zoom: 13,
  ...options,
  styles: (options.zoom ?? 13) >= LABEL_ZOOM ? KIDRIDE_STYLE_ZOOMED_IN : KIDRIDE_STYLE_ZOOMED_OUT,
  disableDefaultUI: true,
  clickableIcons: false,
  keyboardShortcuts: false,
  backgroundColor: '#f1f5f9'
});

/** Creates a map with the KidRide style; road labels switch on only when the zoom crosses LABEL_ZOOM. */
export const createKidRideMap = (maps: typeof google.maps, container: HTMLElement, options: google.maps.MapOptions = {}) => {
  const map = new maps.Map(container, kidRideMapOptions(options));
  let zoomedIn = (options.zoom ?? 13) >= LABEL_ZOOM;
  map.addListener('zoom_changed', () => {
    const next = (map.getZoom() ?? 0) >= LABEL_ZOOM;
    if (next !== zoomedIn) {
      zoomedIn = next;
      map.setOptions({ styles: next ? KIDRIDE_STYLE_ZOOMED_IN : KIDRIDE_STYLE_ZOOMED_OUT });
    }
  });
  return map;
};

/** Brand route: a solid blue line with a soft lighter casing underneath. */
export const createRouteLine = (maps: typeof google.maps, map: google.maps.Map) => {
  const casing = new maps.Polyline({ map, strokeColor: BRAND.blueSoft, strokeOpacity: 0.9, strokeWeight: 10, zIndex: 1, clickable: false });
  const line = new maps.Polyline({ map, strokeColor: BRAND.blue, strokeOpacity: 1, strokeWeight: 5, zIndex: 2, clickable: false });
  return {
    setPath: (path: google.maps.LatLng[]) => { casing.setPath(path); line.setPath(path); },
    remove: () => { casing.setMap(null); line.setMap(null); }
  };
};

/** Dashed line, e.g. from the driver to the pickup before the child is collected. */
export const createDashedLine = (maps: typeof google.maps, map: google.maps.Map, color = BRAND.blue) => new maps.Polyline({
  map,
  strokeOpacity: 0,
  clickable: false,
  zIndex: 2,
  icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.9, strokeColor: color, strokeWeight: 4, scale: 2 }, offset: '0', repeat: '12px' }]
});
