/// <reference types="google.maps" />

// KidRide's own look for every map in the app: a cool, quiet Cloud base,
// white roads with Pebble edges, soft park and water tints, no building
// footprints and almost no POI labels. Road names only appear once the map is
// zoomed in. Google's logo and attribution stay visible, as the Maps terms
// require. Colours match the brand tokens in tailwind.config.js.

export const BRAND = {
  sky: '#38BDF8',
  deep: '#0369A1',
  ink: '#14213D',
  marigold: '#FFB703',
  cloud: '#F6F9FC',
  mist: '#EAF1F7',
  pebble: '#D5DFE9',
  slate: '#5B6478',
  leaf: '#1B9E5A',
  font: "'Plus Jakarta Sans', system-ui, sans-serif"
};

const base: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#F6F9FC' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#5B6478' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#F6F9FC' }, { weight: 3 }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#D5DFE9' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.neighborhood', elementType: 'labels.text.fill', stylers: [{ color: '#8A93A6' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#F6F9FC' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.stroke', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.fill', stylers: [{ color: '#F6F9FC' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', stylers: [{ visibility: 'on' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#E1EEE3' }] },
  { featureType: 'poi.park', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#D5DFE9' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#5B6478' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#CFE3F3' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#7E9BB5' }] }
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
  backgroundColor: BRAND.cloud
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

/** Brand route: a 5px Night Navy line on a white casing. */
export const createRouteLine = (maps: typeof google.maps, map: google.maps.Map) => {
  const casing = new maps.Polyline({ map, strokeColor: '#FFFFFF', strokeOpacity: 1, strokeWeight: 9, zIndex: 1, clickable: false });
  const line = new maps.Polyline({ map, strokeColor: BRAND.ink, strokeOpacity: 1, strokeWeight: 5, zIndex: 2, clickable: false });
  return {
    setPath: (path: google.maps.LatLng[]) => { casing.setPath(path); line.setPath(path); },
    remove: () => { casing.setMap(null); line.setMap(null); }
  };
};

/** Dashed line, e.g. from the driver to the pickup before the child is collected. */
export const createDashedLine = (maps: typeof google.maps, map: google.maps.Map, color = BRAND.ink) => new maps.Polyline({
  map,
  strokeOpacity: 0,
  clickable: false,
  zIndex: 2,
  icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.9, strokeColor: color, strokeWeight: 4, scale: 2 }, offset: '0', repeat: '12px' }]
});
