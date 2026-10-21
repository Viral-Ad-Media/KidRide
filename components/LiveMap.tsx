/// <reference types="google.maps" />
import React, { useEffect, useRef, useState } from 'react';
import { MapPinOff } from 'lucide-react';
import { LatLng, computeRoute, useGoogleMaps } from '../services/googleMaps';
import { BRAND, createDashedLine, createKidRideMap, createRouteLine } from '../services/mapStyle';
import { DriverLocation } from '../types';
import { HtmlMarker, carHtml, createHtmlMarker, stopPinHtml } from './mapMarkers';
import { CarMotion } from '../services/carMotion';
import { MapControls } from './MapControls';

// Trip map in KidRide's own style: pickup and drop-off pins with label chips,
// the driving route in the brand blue, a dashed line from the driver to the
// pickup, and the driver's car. GPS updates arrive every few seconds; CarMotion
// keeps the car rolling between them along the road, facing the way it drives.

const STALE_MS = 30000;
const DEFAULT_CENTER: LatLng = { lat: 51.5074, lng: -0.1278 };
// Extra room at the bottom: the tracking sheet and status card overlap the map edge.
const FIT_PADDING = { top: 72, right: 64, bottom: 110, left: 48 };

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
  /** Chip text on the pins, e.g. "Pickup · Mia". */
  pickupLabel?: string;
  dropoffLabel?: string;
  className?: string;
  /** Where the zoom/recenter controls sit (Tailwind position classes). */
  controlsClassName?: string;
  /** Where the route/GPS notice sits. */
  noticeClassName?: string;
  onRoute?: (info: RouteInfo) => void;
}

export const LiveMap: React.FC<LiveMapProps> = ({ pickup, dropoff, pickupCoords, dropoffCoords, driverLocation, nextStop = 'pickup', pickupLabel = 'Pickup', dropoffLabel = 'Drop-off', className = 'h-full', controlsClassName = 'bottom-24 right-3', noticeClassName = 'bottom-3 left-3 right-16', onRoute }) => {
  const mapsState = useGoogleMaps();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const carRef = useRef<HtmlMarker | null>(null);
  const motionRef = useRef<CarMotion | null>(null);
  const pathsRef = useRef<{ trip: LatLng[]; approach: LatLng[] }>({ trip: [], approach: [] });
  const approachRef = useRef<google.maps.Polyline | null>(null);
  const stopsRef = useRef<{ pickup?: google.maps.LatLng; dropoff?: google.maps.LatLng }>({});
  const boundsRef = useRef<google.maps.LatLngBounds | null>(null);
  const routeInfo = useRef<RouteInfo>({});
  const lastEtaAt = useRef(0);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(timer); }, []);

  // The car snaps to the roads it is expected to drive: to the pickup, then the trip.
  const syncRoutes = () => motionRef.current?.setRoutes([pathsRef.current.approach, pathsRef.current.trip]);

  const publish = (patch: RouteInfo) => {
    routeInfo.current = { ...routeInfo.current, ...patch };
    onRoute?.(routeInfo.current);
  };

  // Map, pins and route.
  useEffect(() => {
    if (mapsState.status !== 'ready' || !containerRef.current) return;
    const maps = mapsState.maps;
    const map = createKidRideMap(maps, containerRef.current, { center: pickupCoords || DEFAULT_CENTER, zoom: 13 });
    mapRef.current = map;
    const routeLine = createRouteLine(maps, map);
    approachRef.current = createDashedLine(maps, map);
    const markers: HtmlMarker[] = [];
    const addStop = (position: LatLng, kind: 'pickup' | 'dropoff', title: string) => {
      markers.push(createHtmlMarker(maps, {
        map,
        position,
        anchor: 'bottom',
        html: stopPinHtml(kind === 'pickup' ? pickupLabel : dropoffLabel, kind === 'pickup' ? BRAND.marigold : BRAND.ink, kind),
        title,
        zIndex: 2
      }));
    };
    const toLatLng = (point: google.maps.LatLng): LatLng => ({ lat: point.lat(), lng: point.lng() });
    pathsRef.current = { trip: [], approach: [] };

    computeRoute(maps, pickupCoords || pickup, dropoffCoords || dropoff).then((route) => {
      routeLine.setPath(route.path);
      pathsRef.current.trip = route.path.map(toLatLng);
      syncRoutes();
      const start = route.path[0];
      const end = route.path[route.path.length - 1];
      stopsRef.current = { pickup: start, dropoff: end };
      addStop(toLatLng(start), 'pickup', `Pickup: ${pickup}`);
      addStop(toLatLng(end), 'dropoff', `Drop-off: ${dropoff}`);
      const bounds = new maps.LatLngBounds();
      route.path.forEach((point) => bounds.extend(point));
      boundsRef.current = bounds;
      map.fitBounds(bounds, FIT_PADDING);
      publish({ tripDuration: route.duration, tripDistance: route.distance });
      setRouteError(null);
    }).catch(() => {
      // No drivable route (or the addresses could not be found): still show what we can.
      setRouteError('The route could not be drawn for these addresses.');
      if (pickupCoords) addStop(pickupCoords, 'pickup', `Pickup: ${pickup}`);
      if (dropoffCoords) addStop(dropoffCoords, 'dropoff', `Drop-off: ${dropoff}`);
      if (pickupCoords) map.setCenter(pickupCoords);
    });

    return () => {
      routeLine.remove();
      approachRef.current?.setMap(null);
      approachRef.current = null;
      markers.forEach((marker) => marker.remove());
      motionRef.current?.stop();
      motionRef.current = null;
      carRef.current?.remove();
      carRef.current = null;
      mapRef.current = null;
    };
    // Rebuild only when the trip itself changes.
  }, [mapsState.status, pickup, dropoff, pickupCoords?.lat, pickupCoords?.lng, dropoffCoords?.lat, dropoffCoords?.lng, pickupLabel, dropoffLabel]);

  // Driver's car: glide to each new GPS fix and face the direction of travel.
  useEffect(() => {
    if (mapsState.status !== 'ready' || !mapRef.current || !driverLocation) return;
    const maps = mapsState.maps;
    const target: LatLng = { lat: driverLocation.latitude, lng: driverLocation.longitude };
    if (!carRef.current || !motionRef.current) {
      const rotation = typeof driverLocation.heading === 'number' ? driverLocation.heading : 0;
      carRef.current = createHtmlMarker(maps, { map: mapRef.current, position: target, html: carHtml(BRAND.sky, rotation), title: 'Driver', zIndex: 3 });
      motionRef.current = new CarMotion(carRef.current);
      syncRoutes();
    }
    const recordedAt = Date.parse(driverLocation.recordedAt);
    motionRef.current.update({ position: target, heading: driverLocation.heading, recordedAt: Number.isFinite(recordedAt) ? recordedAt : undefined });

    // Driver ETA to the next stop (and the dashed approach line), at most once a minute.
    const stop = stopsRef.current[nextStop] || (nextStop === 'pickup' ? pickupCoords : dropoffCoords);
    if (stop && Date.now() - lastEtaAt.current > 60000) {
      lastEtaAt.current = Date.now();
      const stopPoint = stop instanceof maps.LatLng ? { lat: stop.lat(), lng: stop.lng() } : stop;
      computeRoute(maps, target, stopPoint)
        .then((route) => {
          publish({ driverEta: route.duration });
          approachRef.current?.setPath(nextStop === 'pickup' ? route.path : []);
          pathsRef.current.approach = nextStop === 'pickup' ? route.path.map((point) => ({ lat: point.lat(), lng: point.lng() })) : [];
          syncRoutes();
        })
        .catch(() => undefined);
    }
  }, [mapsState.status, driverLocation?.latitude, driverLocation?.longitude, driverLocation?.heading, nextStop]);

  // Once the child is picked up the approach line is no longer relevant.
  useEffect(() => {
    if (nextStop === 'pickup') return;
    approachRef.current?.setPath([]);
    pathsRef.current.approach = [];
    syncRoutes();
  }, [nextStop]);

  const recenter = () => {
    const map = mapRef.current;
    if (!map || mapsState.status !== 'ready') return;
    const bounds = boundsRef.current;
    if (bounds) {
      const framed = new mapsState.maps.LatLngBounds(bounds.getSouthWest(), bounds.getNorthEast());
      const car = motionRef.current?.getPosition();
      if (car) framed.extend(car);
      map.fitBounds(framed, FIT_PADDING);
    } else if (pickupCoords) map.panTo(pickupCoords);
  };

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
      {mapsState.status === 'ready' && <MapControls map={mapRef} onRecenter={recenter} recenterLabel="Show the whole trip" className={controlsClassName} />}
      {(routeError || stale || !driverLocation) && mapsState.status === 'ready' && (
        <div className={`absolute ${noticeClassName} rounded-2xl bg-white/95 px-4 py-3 text-xs font-medium text-slate-600 shadow-[0_10px_24px_rgba(15,23,42,0.12)] backdrop-blur">
          {routeError || (!driverLocation ? 'Waiting for the driver\'s live location.' : `Driver GPS is delayed. Last update ${new Date(recordedAt).toLocaleTimeString()}.`)}
        </div>
      )}
    </div>
  );
};
