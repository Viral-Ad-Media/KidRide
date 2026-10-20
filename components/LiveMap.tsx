/// <reference types="google.maps" />
import React, { useEffect, useRef, useState } from 'react';
import { MapPinOff } from 'lucide-react';
import { LatLng, useGoogleMaps } from '../services/googleMaps';
import { DriverLocation } from '../types';

// Trip map: pickup (A) and drop-off (B) pins, the driving route, and the
// driver's car marker. GPS updates arrive every few seconds; the marker glides
// between them (linear interpolation over GLIDE_MS) and turns to face the
// direction of travel, so it moves like the Bolt/Uber car instead of jumping.

const GLIDE_MS = 2500;
const STALE_MS = 30000;
const DEFAULT_CENTER: LatLng = { lat: 51.5074, lng: -0.1278 };

export interface RouteInfo {
  /** Whole trip, pickup to drop-off. */
  tripDuration?: string;
  tripDistance?: string;
  /** Driver to their next stop (pickup before the child is collected, drop-off after). */
  driverEta?: string;
}

interface LiveMapProps {
  pickup: string;
  dropoff: string;
  pickupCoords?: LatLng | null;
  dropoffCoords?: LatLng | null;
  driverLocation?: DriverLocation | null;
  /** Where the driver is heading next; used for the driver ETA. */
  nextStop?: 'pickup' | 'dropoff';
  className?: string;
  onRoute?: (info: RouteInfo) => void;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
// Turn the short way round (e.g. 350 deg -> 10 deg goes through 0, not back through 180).
const lerpAngle = (a: number, b: number, t: number) => a + ((((b - a) % 360) + 540) % 360 - 180) * t;

const pin = (maps: typeof google.maps, color: string): google.maps.Symbol => ({
  path: maps.SymbolPath.CIRCLE,
  scale: 11,
  fillColor: color,
  fillOpacity: 1,
  strokeColor: '#ffffff',
  strokeWeight: 3,
  labelOrigin: new maps.Point(0, 0)
});

const carIcon = (maps: typeof google.maps, rotation: number): google.maps.Symbol => ({
  // Arrow-shaped car marker pointing in the direction of travel.
  path: 'M 0,-14 L 9,10 L 0,5 L -9,10 Z',
  scale: 1.3,
  fillColor: '#0f172a',
  fillOpacity: 1,
  strokeColor: '#ffffff',
  strokeWeight: 2,
  rotation,
  anchor: new maps.Point(0, 0)
});

export const LiveMap: React.FC<LiveMapProps> = ({ pickup, dropoff, pickupCoords, dropoffCoords, driverLocation, nextStop = 'pickup', className = 'h-full', onRoute }) => {
  const mapsState = useGoogleMaps();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const carRef = useRef<google.maps.Marker | null>(null);
  const carState = useRef<{ position: LatLng; rotation: number } | null>(null);
  const frameRef = useRef<number | null>(null);
  const stopsRef = useRef<{ pickup?: google.maps.LatLng; dropoff?: google.maps.LatLng }>({});
  const routeInfo = useRef<RouteInfo>({});
  const lastEtaAt = useRef(0);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(timer); }, []);

  const publish = (patch: RouteInfo) => {
    routeInfo.current = { ...routeInfo.current, ...patch };
    onRoute?.(routeInfo.current);
  };

  // Map, pins and route.
  useEffect(() => {
    if (mapsState.status !== 'ready' || !containerRef.current) return;
    const maps = mapsState.maps;
    const map = new maps.Map(containerRef.current, {
      center: pickupCoords || DEFAULT_CENTER,
      zoom: 13,
      disableDefaultUI: true,
      zoomControl: true,
      clickableIcons: false
    });
    mapRef.current = map;
    const renderer = new maps.DirectionsRenderer({ map, suppressMarkers: true, preserveViewport: false, polylineOptions: { strokeColor: '#1d6fff', strokeWeight: 5, strokeOpacity: 0.85 } });
    const markers: google.maps.Marker[] = [];
    const addStop = (position: google.maps.LatLng | LatLng, label: string, color: string, title: string) => {
      const icon = pin(maps, color);
      markers.push(new maps.Marker({ map, position, icon, label: { text: label, color: '#ffffff', fontWeight: '700', fontSize: '12px' }, title, zIndex: 2 }));
    };

    new maps.DirectionsService().route({
      origin: pickupCoords || pickup,
      destination: dropoffCoords || dropoff,
      travelMode: maps.TravelMode.DRIVING
    }).then((result) => {
      renderer.setDirections(result);
      const leg = result.routes[0]?.legs[0];
      if (!leg) return;
      stopsRef.current = { pickup: leg.start_location, dropoff: leg.end_location };
      addStop(leg.start_location, 'A', '#1d6fff', `Pickup: ${pickup}`);
      addStop(leg.end_location, 'B', '#059669', `Drop-off: ${dropoff}`);
      publish({ tripDuration: leg.duration?.text, tripDistance: leg.distance?.text });
      setRouteError(null);
    }).catch(() => {
      // No drivable route (or the addresses could not be found): still show what we can.
      setRouteError('The route could not be drawn for these addresses.');
      if (pickupCoords) addStop(pickupCoords, 'A', '#1d6fff', `Pickup: ${pickup}`);
      if (dropoffCoords) addStop(dropoffCoords, 'B', '#059669', `Drop-off: ${dropoff}`);
      if (pickupCoords) map.setCenter(pickupCoords);
    });

    return () => {
      renderer.setMap(null);
      markers.forEach((marker) => marker.setMap(null));
      carRef.current?.setMap(null);
      carRef.current = null;
      carState.current = null;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      mapRef.current = null;
    };
    // Rebuild only when the trip itself changes.
  }, [mapsState.status, pickup, dropoff, pickupCoords?.lat, pickupCoords?.lng, dropoffCoords?.lat, dropoffCoords?.lng]);

  // Driver marker: glide to each new GPS fix and face the direction of travel.
  useEffect(() => {
    if (mapsState.status !== 'ready' || !mapRef.current || !driverLocation) return;
    const maps = mapsState.maps;
    const target: LatLng = { lat: driverLocation.latitude, lng: driverLocation.longitude };
    const from = carState.current;

    if (!carRef.current || !from) {
      const rotation = typeof driverLocation.heading === 'number' ? driverLocation.heading : 0;
      carRef.current = new maps.Marker({ map: mapRef.current, position: target, icon: carIcon(maps, rotation), title: 'Driver', zIndex: 3 });
      carState.current = { position: target, rotation };
    } else {
      const moved = maps.geometry.spherical.computeDistanceBetween(from.position, target) > 3;
      // Prefer the phone's compass heading; otherwise work it out from the movement.
      const targetRotation = typeof driverLocation.heading === 'number'
        ? driverLocation.heading
        : moved ? maps.geometry.spherical.computeHeading(from.position, target) : from.rotation;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      const start = performance.now();
      const step = (time: number) => {
        const t = Math.min(1, (time - start) / GLIDE_MS);
        const position = { lat: lerp(from.position.lat, target.lat, t), lng: lerp(from.position.lng, target.lng, t) };
        const rotation = lerpAngle(from.rotation, targetRotation, t);
        carRef.current?.setPosition(position);
        carRef.current?.setIcon(carIcon(maps, rotation));
        carState.current = { position, rotation };
        if (t < 1) frameRef.current = requestAnimationFrame(step);
      };
      frameRef.current = requestAnimationFrame(step);
    }

    // Driver ETA to the next stop, at most once a minute.
    const stop = stopsRef.current[nextStop] || (nextStop === 'pickup' ? pickupCoords : dropoffCoords);
    if (stop && Date.now() - lastEtaAt.current > 60000) {
      lastEtaAt.current = Date.now();
      new maps.DirectionsService().route({ origin: target, destination: stop, travelMode: maps.TravelMode.DRIVING })
        .then((result) => publish({ driverEta: result.routes[0]?.legs[0]?.duration?.text }))
        .catch(() => undefined);
    }
  }, [mapsState.status, driverLocation?.latitude, driverLocation?.longitude, driverLocation?.heading, nextStop]);

  if (mapsState.status === 'unavailable') {
    return (
      <div className={`flex flex-col items-center justify-center gap-2 rounded-2xl bg-slate-100 p-6 text-center text-sm text-slate-600 ${className}`}>
        <MapPinOff size={24} className="text-slate-400" />
        <p className="font-semibold text-slate-700">Map unavailable</p>
        <p>{mapsState.reason}</p>
        <p className="text-xs text-slate-500">Pickup: {pickup} · Drop-off: {dropoff}</p>
      </div>
    );
  }

  const recordedAt = driverLocation ? Date.parse(driverLocation.recordedAt) : NaN;
  const stale = driverLocation && (!Number.isFinite(recordedAt) || now - recordedAt > STALE_MS);

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-slate-100 ${className}`}>
      <div ref={containerRef} className="h-full w-full" aria-label="Trip map" />
      {mapsState.status === 'loading' && <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">Loading map...</div>}
      {(routeError || stale || !driverLocation) && mapsState.status === 'ready' && (
        <div className="absolute bottom-3 left-3 right-3 rounded-xl bg-white/95 p-3 text-xs text-slate-600 shadow">
          {routeError || (!driverLocation ? 'Waiting for the driver\'s live location.' : `Driver GPS is delayed. Last update ${new Date(recordedAt).toLocaleTimeString()}.`)}
        </div>
      )}
    </div>
  );
};
