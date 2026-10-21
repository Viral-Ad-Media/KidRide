/// <reference types="google.maps" />
import React, { useEffect, useRef, useState } from 'react';
import { LocateOff, MapPinOff, X } from 'lucide-react';
import { Button } from './UIComponents';
import { CarMotion } from '../services/carMotion';
import { HtmlMarker, carHtml, createHtmlMarker, waitingPinHtml } from './mapMarkers';
import { MapControls } from './MapControls';
import { LatLng, useGoogleMaps } from '../services/googleMaps';
import { BRAND, createKidRideMap } from '../services/mapStyle';
import { apiRequest, getStoredToken, mapRide } from '../services/api';
import { getLastPosition, isLocationSupported, watchSharedPosition } from '../services/sharedPosition';
import { Ride } from '../types';
import { formatPickupTime, formatRidePrice } from '../utils/rideData';

// Map for an online driver with no trip: their own car (gliding and facing the
// direction of travel, as on the trip map) and amber pins for rides waiting
// within 5 km. Tapping a pin shows the trip and an Accept button.

const POLL_MS = 10000;

interface NearbyRide { ride: Ride; distanceMeters: number; declined: boolean }
interface Fix { point: LatLng; heading: number | null; recordedAt: number }

const toFix = (fix: GeolocationPosition): Fix => {
  const heading = fix.coords.heading;
  return { point: { lat: fix.coords.latitude, lng: fix.coords.longitude }, heading: typeof heading === 'number' && Number.isFinite(heading) ? heading : null, recordedAt: fix.timestamp };
};

const formatDistance = (meters: number) => (meters < 1000 ? `${meters} m away` : `${(meters / 1000).toFixed(1)} km away`);

interface DriverIdleMapProps {
  onAccept: (rideId: string) => Promise<void>;
}

export const DriverIdleMap: React.FC<DriverIdleMapProps> = ({ onAccept }) => {
  const mapsState = useGoogleMaps();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const radiusRef = useRef<google.maps.Circle | null>(null);
  const carRef = useRef<HtmlMarker | null>(null);
  const motionRef = useRef<CarMotion | null>(null);
  const pinsRef = useRef<Map<string, { marker: HtmlMarker; selected: boolean }>>(new Map());
  const following = useRef(true);
  const [position, setPosition] = useState<Fix | null>(() => { const last = getLastPosition(); return last ? toFix(last) : null; });
  const [locationState, setLocationState] = useState<'waiting' | 'ok' | 'denied' | 'unsupported'>(() => (getLastPosition() ? 'ok' : 'waiting'));
  const [rides, setRides] = useState<NearbyRide[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const selected = rides.find((item) => item.ride.id === selectedId) || null;

  // The driver's own position, from the watch shared with the presence
  // heartbeat; it hands over the last fix at once (e.g. after declining an offer).
  useEffect(() => {
    if (!isLocationSupported()) { setLocationState('unsupported'); return; }
    return watchSharedPosition(
      (fix) => { setPosition(toFix(fix)); setLocationState('ok'); },
      (error) => { if (error.code === error.PERMISSION_DENIED) setLocationState('denied'); }
    );
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
    const map = createKidRideMap(maps, containerRef.current, { center: start, zoom: 14 });
    mapRef.current = map;
    radiusRef.current = new maps.Circle({ map, center: start, radius: 5000, strokeColor: BRAND.deep, strokeOpacity: 0.3, strokeWeight: 1.5, fillColor: BRAND.sky, fillOpacity: 0.05, clickable: false });
    // Once the driver pans away, stop re-centring until they tap the recenter button.
    map.addListener('dragstart', () => { following.current = false; });
    map.addListener('click', () => setSelectedId(null));
    const pins = pinsRef.current;
    return () => {
      pins.forEach((pin) => pin.marker.remove());
      pins.clear();
      radiusRef.current?.setMap(null);
      motionRef.current?.stop();
      motionRef.current = null;
      carRef.current?.remove();
      carRef.current = null;
      mapRef.current = null;
    };
  }, [mapsState.status, hasPosition]);

  // Car marker: glide to each new fix and face the direction of travel.
  useEffect(() => {
    if (mapsState.status !== 'ready' || !mapRef.current || !position) return;
    const maps = mapsState.maps;
    const target = position.point;
    radiusRef.current?.setCenter(target);
    if (following.current) mapRef.current.panTo(target);

    if (!carRef.current || !motionRef.current) {
      carRef.current = createHtmlMarker(maps, { map: mapRef.current, position: target, html: carHtml(BRAND.sky, position.heading ?? 0), title: 'You', zIndex: 3 });
      motionRef.current = new CarMotion(carRef.current);
    }
    motionRef.current.update({ position: target, heading: position.heading, recordedAt: position.recordedAt });
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
      let pin = pins.get(ride.id);
      if (!pin) {
        const marker = createHtmlMarker(maps, { map: mapRef.current!, position: ride.pickupCoords, html: waitingPinHtml(isSelected), title: `Pickup: ${ride.pickupLocation}`, zIndex: 2, onClick: () => { setAcceptError(null); setSelectedId(ride.id); } });
        pin = { marker, selected: isSelected };
        pins.set(ride.id, pin);
      } else if (pin.selected !== isSelected) {
        // Only redraw a pin when its selection changes, not on every poll.
        pin.marker.setHtml(waitingPinHtml(isSelected));
        pin.selected = isSelected;
      }
      pin.marker.setZIndex(isSelected ? 4 : 2);
    });
    pins.forEach((pin, id) => { if (!keep.has(id)) { pin.marker.remove(); pins.delete(id); } });
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
            <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-white/95 px-3.5 py-2 text-xs font-semibold text-slate-800 shadow-[0_8px_20px_rgba(15,23,42,0.15)] backdrop-blur">
              <span className="relative inline-flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-70" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
              </span>
              {rides.length ? `${rides.length} waiting within 5 km` : 'No rides waiting within 5 km'}
            </div>
            <MapControls map={mapRef} onRecenter={recenter} recenterLabel="Recenter on my location" />
          </>
        )}
        {selected && (
          <div className="absolute bottom-3 left-3 right-3 z-20 rounded-[24px] border border-slate-100 bg-white p-4 shadow-[0_20px_45px_rgba(15,23,42,0.22)] sm:left-auto sm:w-[360px]" role="dialog" aria-label="Waiting ride">
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
