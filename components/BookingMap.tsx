/// <reference types="google.maps" />
import React, { useEffect, useRef, useState } from 'react';
import { MapPinOff } from 'lucide-react';
import { LatLng, computeRoute, useGoogleMaps } from '../services/googleMaps';
import { BRAND, createKidRideMap, createRouteLine } from '../services/mapStyle';
import { HtmlMarker, createHtmlMarker, stopPinHtml, waitingPinHtml } from './mapMarkers';

// The map behind the parent's home and booking sheets. It centres on the
// parent (browser location) until there is a pickup, then shows the pickup
// pin, the drop-off pin and the route between them as they are chosen. While
// a driver is being found the pickup pulses.

const DEFAULT_CENTER: LatLng = { lat: 51.5074, lng: -0.1278 };
const LOCATION_ZOOM = 14;

interface BookingMapProps {
  pickup?: LatLng | null;
  dropoff?: LatLng | null;
  pickupLabel?: string;
  dropoffLabel?: string;
  /** Pulse the pickup pin (finding a driver). */
  matching?: boolean;
  /** Room to leave for the sheet, in px: { top, right, bottom, left }. */
  padding?: google.maps.Padding;
  className?: string;
  onRoute?: (route: { duration: string; distance: string }) => void;
}

let cachedLocation: LatLng | null = null;

export const BookingMap: React.FC<BookingMapProps> = ({ pickup, dropoff, pickupLabel = 'Pickup', dropoffLabel = 'Drop-off', matching = false, padding = { top: 80, right: 40, bottom: 80, left: 40 }, className = 'h-full', onRoute }) => {
  const mapsState = useGoogleMaps();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const routeRef = useRef<ReturnType<typeof createRouteLine> | null>(null);
  const pinsRef = useRef<{ pickup?: HtmlMarker; dropoff?: HtmlMarker; pulse?: HtmlMarker }>({});
  const [ready, setReady] = useState(false);

  // Map once.
  useEffect(() => {
    if (mapsState.status !== 'ready' || !containerRef.current || mapRef.current) return;
    const maps = mapsState.maps;
    const map = createKidRideMap(maps, containerRef.current, { center: pickup || cachedLocation || DEFAULT_CENTER, zoom: LOCATION_ZOOM });
    mapRef.current = map;
    routeRef.current = createRouteLine(maps, map);
    setReady(true);
    if (!pickup && !cachedLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        cachedLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
        if (!pinsRef.current.pickup) map.panTo(cachedLocation);
      }, () => undefined, { maximumAge: 300000, timeout: 8000 });
    }
    return () => {
      routeRef.current?.remove();
      (Object.values(pinsRef.current) as (HtmlMarker | undefined)[]).forEach((pin) => pin?.remove());
      pinsRef.current = {};
      mapRef.current = null;
    };
  }, [mapsState.status]);

  // Pins, route and framing follow the chosen places.
  useEffect(() => {
    if (!ready || mapsState.status !== 'ready' || !mapRef.current) return;
    const maps = mapsState.maps;
    const map = mapRef.current;
    const pins = pinsRef.current;

    const place = (key: 'pickup' | 'dropoff', point: LatLng | null | undefined, label: string) => {
      pins[key]?.remove();
      pins[key] = undefined;
      if (!point) return;
      pins[key] = createHtmlMarker(maps, { map, position: point, anchor: 'bottom', html: stopPinHtml(label, key === 'pickup' ? BRAND.marigold : BRAND.ink, key), title: label, zIndex: 2 });
    };
    place('pickup', pickup, pickupLabel);
    place('dropoff', dropoff, dropoffLabel);

    pins.pulse?.remove();
    pins.pulse = undefined;
    if (matching && pickup) pins.pulse = createHtmlMarker(maps, { map, position: pickup, html: waitingPinHtml(), zIndex: 1 });

    if (pickup && dropoff) {
      computeRoute(maps, pickup, dropoff).then((route) => {
        if (!mapRef.current) return;
        routeRef.current?.setPath(route.path);
        const bounds = new maps.LatLngBounds();
        route.path.forEach((point) => bounds.extend(point));
        map.fitBounds(bounds, padding);
        onRoute?.({ duration: route.duration, distance: route.distance });
      }).catch(() => {
        routeRef.current?.setPath([]);
        const bounds = new maps.LatLngBounds();
        bounds.extend(pickup); bounds.extend(dropoff);
        map.fitBounds(bounds, padding);
      });
    } else {
      routeRef.current?.setPath([]);
      const only = pickup || dropoff;
      if (only) { map.panTo(only); if ((map.getZoom() || 0) < LOCATION_ZOOM) map.setZoom(LOCATION_ZOOM); }
    }
  }, [ready, mapsState.status, pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, pickupLabel, dropoffLabel, matching]);

  if (mapsState.status === 'unavailable') {
    return (
      <div className={`flex flex-col items-center justify-center gap-2 bg-surface-2 p-6 text-center text-sm text-muted ${className}`}>
        <MapPinOff size={24} />
        <p className="font-semibold text-ink">Map unavailable</p>
        <p className="max-w-xs">{mapsState.reason}</p>
      </div>
    );
  }
  return (
    <div className={`relative bg-surface-2 ${className}`}>
      <div ref={containerRef} className="h-full w-full" aria-label="Map" />
      {mapsState.status === 'loading' && <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">Loading map...</div>}
    </div>
  );
};
