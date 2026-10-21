/// <reference types="google.maps" />
import React, { useEffect, useRef, useState } from 'react';
import { Crosshair, LocateOff, MapPinOff, X } from 'lucide-react';
import { Button } from './UIComponents';
import { GLIDE_MS, carIcon, lerp, lerpAngle } from './LiveMap';
import { LatLng, useGoogleMaps } from '../services/googleMaps';
import { apiRequest, getStoredToken, mapRide } from '../services/api';
import { Ride } from '../types';
import { formatPickupTime, formatRidePrice } from '../utils/rideData';

// Map for an online driver with no trip: their own car (gliding and facing the
// direction of travel, as on the trip map) and amber pins for rides waiting
// within 5 km. Tapping a pin shows the trip and an Accept button.

const POLL_MS = 10000;

interface NearbyRide { ride: Ride; distanceMeters: number; declined: boolean }
interface Fix { point: LatLng; heading: number | null }

let lastFix: Fix | null = null;

const amberPin = (maps: typeof google.maps, selected: boolean): google.maps.Symbol => ({
  path: maps.SymbolPath.CIRCLE,
  scale: selected ? 13 : 10,
  fillColor: '#f59e0b',
  fillOpacity: 1,
  strokeColor: selected ? '#0f172a' : '#ffffff',
  strokeWeight: 3
});

const formatDistance = (meters: number) => (meters < 1000 ? `${meters} m away` : `${(meters / 1000).toFixed(1)} km away`);

interface DriverIdleMapProps {
  onAccept: (rideId: string) => Promise<void>;
}

export const DriverIdleMap: React.FC<DriverIdleMapProps> = ({ onAccept }) => {
  const mapsState = useGoogleMaps();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const radiusRef = useRef<google.maps.Circle | null>(null);
  const carRef = useRef<google.maps.Marker | null>(null);
  const carState = useRef<{ position: LatLng; rotation: number } | null>(null);
  const frameRef = useRef<number | null>(null);
  const pinsRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const following = useRef(true);
  const [position, setPosition] = useState<Fix | null>(lastFix);
  const [locationState, setLocationState] = useState<'waiting' | 'ok' | 'denied' | 'unsupported'>(lastFix ? 'ok' : 'waiting');
  const [rides, setRides] = useState<NearbyRide[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const selected = rides.find((item) => item.ride.id === selectedId) || null;

  // The driver's own position, straight from the device.
  // A new watch can take a while to report, so the map reopens at the last fix
  // (e.g. after declining an offer) and also asks for the current position once.
  useEffect(() => {
    if (!navigator.geolocation) { setLocationState('unsupported'); return; }
    const onFix = (fix: GeolocationPosition) => {
      const heading = fix.coords.heading;
      lastFix = { point: { lat: fix.coords.latitude, lng: fix.coords.longitude }, heading: typeof heading === 'number' && Number.isFinite(heading) ? heading : null };
      setPosition(lastFix);
      setLocationState('ok');
    };
    const onError = (error: GeolocationPositionError) => { if (error.code === error.PERMISSION_DENIED) setLocationState('denied'); };
    const options = { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 };
    navigator.geolocation.getCurrentPosition(onFix, onError, options);
    const watch = navigator.geolocation.watchPosition(onFix, onError, options);
    return () => navigator.geolocation.clearWatch(watch);
  }, []);

  // Waiting rides around the driver, refreshed every 10 seconds.
  const latestPosition = useRef(position);
  latestPosition.current = position;
  const hasPosition = !!position;
  useEffect(() => {
    if (!hasPosition) return;
    let cancelled = false;
    const load = async () => {
      const token = getStoredToken();
      const here = latestPosition.current?.point;
      if (!token || !here) return;
      try {
        const result = await apiRequest<{ rides: Array<Record<string, unknown>> }>(`/drivers/nearby-rides?lat=${here.lat.toFixed(5)}&lng=${here.lng.toFixed(5)}`, { token });
        if (cancelled) return;
        setRides(result.rides.map((raw) => ({ ride: mapRide(raw), distanceMeters: Number(raw.distanceMeters) || 0, declined: raw.declined === true })));
        setLoadError(false);
      } catch {
        if (!cancelled) setLoadError(true);
      }
    };
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [hasPosition]);

  // A pin that disappeared (taken by another driver) closes its card.
  useEffect(() => {
    if (selectedId && !rides.some((item) => item.ride.id === selectedId)) setSelectedId(null);
  }, [rides, selectedId]);

  // The map itself, created once the first fix arrives.
  useEffect(() => {
    if (mapsState.status !== 'ready' || !containerRef.current || !hasPosition || mapRef.current) return;
    const maps = mapsState.maps;
    const start = latestPosition.current!.point;
    const map = new maps.Map(containerRef.current, { center: start, zoom: 14, disableDefaultUI: true, zoomControl: true, clickableIcons: false });
    mapRef.current = map;
    radiusRef.current = new maps.Circle({ map, center: start, radius: 5000, strokeColor: '#1d6fff', strokeOpacity: 0.25, strokeWeight: 1, fillColor: '#1d6fff', fillOpacity: 0.04, clickable: false });
    // Once the driver pans away, stop re-centring until they tap the recenter button.
    map.addListener('dragstart', () => { following.current = false; });
    map.addListener('click', () => setSelectedId(null));
    const pins = pinsRef.current;
    return () => {
      pins.forEach((marker) => marker.setMap(null));
      pins.clear();
      radiusRef.current?.setMap(null);
      carRef.current?.setMap(null);
      carRef.current = null;
      carState.current = null;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      mapRef.current = null;
    };
  }, [mapsState.status, hasPosition]);

  // Car marker: glide to each new fix and face the direction of travel.
  useEffect(() => {
    if (mapsState.status !== 'ready' || !mapRef.current || !position) return;
    const maps = mapsState.maps;
    const target = position.point;
    const from = carState.current;
    radiusRef.current?.setCenter(target);
    if (following.current) mapRef.current.panTo(target);

    if (!carRef.current || !from) {
      const rotation = position.heading ?? 0;
      carRef.current = new maps.Marker({ map: mapRef.current, position: target, icon: carIcon(maps, rotation, '#1d6fff'), title: 'You', zIndex: 3 });
      carState.current = { position: target, rotation };
      return;
    }
    const moved = maps.geometry.spherical.computeDistanceBetween(from.position, target) > 3;
    const targetRotation = position.heading ?? (moved ? maps.geometry.spherical.computeHeading(from.position, target) : from.rotation);
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    const begin = performance.now();
    const step = (time: number) => {
      const t = Math.min(1, (time - begin) / GLIDE_MS);
      const point = { lat: lerp(from.position.lat, target.lat, t), lng: lerp(from.position.lng, target.lng, t) };
      const rotation = lerpAngle(from.rotation, targetRotation, t);
      carRef.current?.setPosition(point);
      carRef.current?.setIcon(carIcon(maps, rotation, '#1d6fff'));
      carState.current = { position: point, rotation };
      if (t < 1) frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
  }, [mapsState.status, position?.point.lat, position?.point.lng, position?.heading]);

  // Amber pins for the waiting rides.
  useEffect(() => {
    if (mapsState.status !== 'ready' || !mapRef.current) return;
    const maps = mapsState.maps;
    const pins = pinsRef.current;
    const keep = new Set<string>();
    rides.forEach(({ ride }) => {
      if (!ride.pickupCoords) return;
      keep.add(ride.id);
      const isSelected = ride.id === selectedId;
      let marker = pins.get(ride.id);
      if (!marker) {
        marker = new maps.Marker({ map: mapRef.current!, position: ride.pickupCoords, title: `Pickup: ${ride.pickupLocation}`, zIndex: 2 });
        marker.addListener('click', () => { setAcceptError(null); setSelectedId(ride.id); });
        pins.set(ride.id, marker);
      }
      marker.setIcon(amberPin(maps, isSelected));
      marker.setZIndex(isSelected ? 4 : 2);
    });
    pins.forEach((marker, id) => { if (!keep.has(id)) { marker.setMap(null); pins.delete(id); } });
  }, [mapsState.status, rides, selectedId, hasPosition]);

  const recenter = () => {
    following.current = true;
    if (position) mapRef.current?.panTo(position.point);
  };

  const accept = async () => {
    if (!selected) return;
    setAccepting(true);
    setAcceptError(null);
    try {
      await onAccept(selected.ride.id);
    } catch (error) {
      setAcceptError(error instanceof Error ? error.message : 'Could not accept this ride.');
    } finally {
      setAccepting(false);
    }
  };

  if (locationState === 'denied' || locationState === 'unsupported') {
    return (
      <div className="mt-6 rounded-[24px] border border-amber-200 bg-amber-50 p-5 text-left">
        <div className="flex items-start gap-3">
          <LocateOff size={22} className="mt-0.5 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold text-slate-950">Allow location to see rides near you</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {locationState === 'unsupported'
                ? 'This browser cannot share your location. Use a phone or a browser with location support.'
                : 'Location is blocked for KidRide. Turn it on in your browser\'s site settings (the icon next to the address bar), then reload the page. Nearby families are matched to the closest driver, so you will get fewer offers without it.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (mapsState.status === 'unavailable') {
    return (
      <div className="mt-6 flex flex-col items-center justify-center gap-2 rounded-2xl bg-slate-100 p-6 text-center text-sm text-slate-600">
        <MapPinOff size={24} className="text-slate-400" />
        <p className="font-semibold text-slate-700">Map unavailable</p>
        <p>{mapsState.reason}</p>
      </div>
    );
  }

  return (
    <div className="mt-6 text-left">
      <div className="relative h-[46vh] min-h-[320px] overflow-hidden rounded-2xl bg-slate-100 md:h-[420px]">
        <div ref={containerRef} className="h-full w-full" aria-label="Map of rides near you" />
        {(mapsState.status === 'loading' || !position) && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">{position ? 'Loading map...' : 'Finding your location...'}</div>
        )}
        {position && mapsState.status === 'ready' && (
          <>
            <div className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow">
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-amber-500" />
              {rides.length ? `${rides.length} waiting within 5 km` : 'No rides waiting within 5 km'}
            </div>
            <button type="button" onClick={recenter} aria-label="Recenter on my location" className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow hover:bg-slate-50">
              <Crosshair size={18} />
            </button>
          </>
        )}
        {selected && (
          <div className="absolute bottom-3 left-3 right-3 rounded-[20px] bg-white p-4 shadow-xl" role="dialog" aria-label="Waiting ride">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600">
                  {selected.declined ? 'You declined this ride' : 'Waiting for a driver'} · {formatDistance(selected.distanceMeters)}
                </p>
                <p className="mt-2 truncate text-sm font-semibold text-slate-950">{selected.ride.pickupLocation}</p>
                <p className="truncate text-xs text-slate-500">to {selected.ride.dropoffLocation}</p>
                <p className="mt-1 text-xs text-slate-500">Pickup {formatPickupTime(selected.ride.pickupTime)}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <button type="button" onClick={() => setSelectedId(null)} aria-label="Close" className="rounded-full p-1 text-slate-400 hover:bg-slate-100"><X size={16} /></button>
                <p className="text-xl font-bold text-slate-950">{formatRidePrice(selected.ride.price)}</p>
              </div>
            </div>
            {acceptError && <p className="mt-2 text-xs text-red-600">{acceptError}</p>}
            <Button fullWidth className="mt-3" onClick={() => void accept()} disabled={accepting}>{accepting ? 'Accepting...' : 'Accept Ride'}</Button>
          </div>
        )}
      </div>
      {loadError && <p className="mt-2 text-xs text-amber-700">Could not refresh nearby rides. Retrying...</p>}
    </div>
  );
};
