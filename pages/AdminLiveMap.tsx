/// <reference types="google.maps" />
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapPinOff, RefreshCw, X } from 'lucide-react';
import { AdminTabs } from './Admin';
import { HtmlMarker, carHtml, createHtmlMarker, dotHtml, waitingPinHtml } from '../components/mapMarkers';
import { MapControls } from '../components/MapControls';
import { useGoogleMaps } from '../services/googleMaps';
import { BRAND, createKidRideMap } from '../services/mapStyle';
import { LiveDriver, LiveMapSnapshot, errorMessage, fetchLiveMap } from '../services/adminApi';

// Admin live map in KidRide's own style: every online driver (green = free,
// blue = on a ride) and every ride in progress, refreshed every few seconds.
// Markers are kept between polls and only moved or recoloured when needed.

const REFRESH_MS = 5000;
const FREE_COLOR = BRAND.leaf;
const BUSY_COLOR = BRAND.sky;
const DEFAULT_CENTER = { lat: 51.5074, lng: -0.1278 };

type Filter = 'all' | 'free' | 'on_ride';

const secondsAgo = (iso: string) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));

export const AdminLiveMap = () => {
  const mapsState = useGoogleMaps();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const driverMarkers = useRef(new Map<string, { marker: HtmlMarker; status: LiveDriver['status'] }>());
  const rideMarkers = useRef(new Map<string, { marker: HtmlMarker; kind: string }>());
  const fittedOnce = useRef(false);
  const [snapshot, setSnapshot] = useState<LiveMapSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<string | null>(null);

  // Poll the server; keep showing the last good snapshot if one poll fails.
  useEffect(() => {
    let active = true;
    const load = () => fetchLiveMap()
      .then((result) => { if (active) { setSnapshot(result); setError(null); } })
      .catch((err) => { if (active) setError(errorMessage(err, 'Could not refresh the live map.')); });
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => { active = false; clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (mapsState.status !== 'ready' || !containerRef.current || mapRef.current) return;
    mapRef.current = createKidRideMap(mapsState.maps, containerRef.current, { center: DEFAULT_CENTER, zoom: 12 });
    mapRef.current.addListener('click', () => setSelected(null));
  }, [mapsState.status]);

  // Draw drivers and ride stops from the latest snapshot, reusing markers.
  useEffect(() => {
    if (mapsState.status !== 'ready' || !mapRef.current || !snapshot) return;
    const maps = mapsState.maps;
    const map = mapRef.current;
    const seen = new Set<string>();
    for (const driver of snapshot.drivers) {
      seen.add(driver.id);
      const color = driver.status === 'on_ride' ? BUSY_COLOR : FREE_COLOR;
      const existing = driverMarkers.current.get(driver.id);
      if (existing) {
        existing.marker.setPosition({ lat: driver.lat, lng: driver.lng });
        if (existing.status !== driver.status) { existing.marker.setHtml(carHtml(color, driver.heading ?? 0)); existing.status = driver.status; }
        existing.marker.setRotation(driver.heading ?? 0);
      } else {
        const marker = createHtmlMarker(maps, { map, position: { lat: driver.lat, lng: driver.lng }, html: carHtml(color, driver.heading ?? 0), title: driver.name, zIndex: 3, onClick: () => setSelected(driver.id) });
        driverMarkers.current.set(driver.id, { marker, status: driver.status });
      }
    }
    for (const [id, entry] of driverMarkers.current) {
      if (!seen.has(id)) { entry.marker.remove(); driverMarkers.current.delete(id); }
    }

    const seenStops = new Set<string>();
    const placeStop = (key: string, position: { lat: number; lng: number }, kind: string, html: string, title: string, zIndex: number) => {
      seenStops.add(key);
      const existing = rideMarkers.current.get(key);
      if (existing && existing.kind === kind) { existing.marker.setPosition(position); return; }
      existing?.marker.remove();
      rideMarkers.current.set(key, { marker: createHtmlMarker(maps, { map, position, html, title, zIndex }), kind });
    };
    for (const ride of snapshot.rides) {
      const searching = !ride.driverId;
      if (ride.pickupCoords) {
        placeStop(`${ride.id}:pickup`, ride.pickupCoords, searching ? 'waiting' : 'pickup',
          searching ? waitingPinHtml() : dotHtml(BUSY_COLOR, 'A'),
          `${searching ? 'Waiting for a driver' : `Pickup (${ride.driverName || 'driver'})`}: ${ride.pickup}`, 2);
      }
      if (ride.dropoffCoords) placeStop(`${ride.id}:dropoff`, ride.dropoffCoords, 'dropoff', dotHtml(BRAND.slate, 'B'), `Drop-off: ${ride.dropoff}`, 1);
    }
    for (const [key, entry] of rideMarkers.current) {
      if (!seenStops.has(key)) { entry.marker.remove(); rideMarkers.current.delete(key); }
    }

    // Frame everything the first time there is something to show.
    if (!fittedOnce.current && (snapshot.drivers.length || rideMarkers.current.size)) {
      const bounds = new maps.LatLngBounds();
      snapshot.drivers.forEach((driver) => bounds.extend({ lat: driver.lat, lng: driver.lng }));
      rideMarkers.current.forEach((entry) => bounds.extend(entry.marker.getPosition()));
      map.fitBounds(bounds, 64);
      fittedOnce.current = true;
    }
  }, [mapsState.status, snapshot]);

  // Selecting a driver (list or marker) centres the map on them.
  useEffect(() => {
    const driver = snapshot?.drivers.find((item) => item.id === selected);
    if (!driver || !mapRef.current) return;
    mapRef.current.panTo({ lat: driver.lat, lng: driver.lng });
    if ((mapRef.current.getZoom() || 0) < 14) mapRef.current.setZoom(15);
  }, [selected]);

  const selectedDriver = snapshot?.drivers.find((item) => item.id === selected) || null;
  const frameAll = () => {
    const map = mapRef.current;
    if (!map || mapsState.status !== 'ready' || !snapshot) return;
    const bounds = new mapsState.maps.LatLngBounds();
    snapshot.drivers.forEach((driver) => bounds.extend({ lat: driver.lat, lng: driver.lng }));
    rideMarkers.current.forEach((entry) => bounds.extend(entry.marker.getPosition()));
    if (bounds.isEmpty()) map.panTo(DEFAULT_CENTER);
    else map.fitBounds(bounds, 64);
  };

  const visibleDrivers = useMemo(() => (snapshot?.drivers || [])
    .filter((driver) => filter === 'all' || driver.status === filter)
    .filter((driver) => !search.trim() || `${driver.name} ${driver.vehicle || ''} ${driver.plate || ''}`.toLowerCase().includes(search.trim().toLowerCase())), [snapshot, filter, search]);

  const counts = snapshot?.counts;

  return (
    <div>
      <AdminTabs />
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        {[
          ['Drivers online', counts?.online],
          ['On a ride', counts?.onRide],
          ['Rides in progress', counts?.ridesInProgress],
          ['Waiting for a driver', counts?.searching]
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{value ?? '--'}</p>
          </div>
        ))}
      </div>
      {error && <p className="mb-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="relative h-[560px] overflow-hidden rounded-3xl bg-slate-100">
          {mapsState.status === 'unavailable' ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-slate-600">
              <MapPinOff size={24} className="text-slate-400" />
              <p className="font-semibold text-slate-700">Map unavailable</p>
              <p>{mapsState.reason}</p>
            </div>
          ) : (
            <div ref={containerRef} className="h-full w-full" aria-label="Live map of drivers and rides" />
          )}
          {mapsState.status === 'ready' && <MapControls map={mapRef} onRecenter={frameAll} recenterLabel="Show all drivers and rides" />}
          {selectedDriver && (
            <div className="absolute left-3 top-3 z-20 w-[260px] rounded-[22px] border border-slate-100 bg-white p-4 shadow-[0_20px_45px_rgba(15,23,42,0.2)]" role="dialog" aria-label="Driver details">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-slate-950">{selectedDriver.name}</p>
                  <span className="mt-1 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white" style={{ background: selectedDriver.status === 'on_ride' ? BUSY_COLOR : FREE_COLOR }}>{selectedDriver.status === 'on_ride' ? 'On a ride' : 'Free'}</span>
                </div>
                <button type="button" onClick={() => setSelected(null)} aria-label="Close" className="rounded-full p-1 text-slate-400 hover:bg-slate-100"><X size={16} /></button>
              </div>
              <p className="mt-3 text-sm text-slate-600">{selectedDriver.vehicle || 'Vehicle not set'}{selectedDriver.plate ? ` · ${selectedDriver.plate}` : ''}</p>
              {selectedDriver.phone && <p className="mt-1 text-sm text-slate-600">{selectedDriver.phone}</p>}
              <p className="mt-2 text-xs text-slate-400">Updated {secondsAgo(selectedDriver.updatedAt)}s ago</p>
            </div>
          )}
          <div className="absolute bottom-3 left-3 flex flex-wrap gap-3 rounded-full bg-white/95 px-4 py-2 text-xs font-medium text-slate-600 shadow-[0_8px_20px_rgba(15,23,42,0.12)] backdrop-blur">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: FREE_COLOR }} />Free driver</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: BUSY_COLOR }} />On a ride</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" />Waiting for a driver</span>
          </div>
        </div>

        <aside className="flex h-[560px] flex-col rounded-3xl border border-slate-200 bg-white p-4">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search drivers" className="rounded-full border border-slate-200 px-4 py-2 text-sm" />
          <div className="mt-3 flex gap-2" role="tablist">
            {([['all', 'All'], ['free', 'Free'], ['on_ride', 'On a ride']] as [Filter, string][]).map(([value, label]) => (
              <button key={value} type="button" role="tab" aria-selected={filter === value} onClick={() => setFilter(value)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filter === value ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{label}</button>
            ))}
          </div>
          <ul className="mt-3 flex-1 space-y-2 overflow-y-auto">
            {visibleDrivers.map((driver) => (
              <li key={driver.id}>
                <button type="button" onClick={() => setSelected(driver.id === selected ? null : driver.id)} className={`w-full rounded-2xl border px-3 py-2.5 text-left ${driver.id === selected ? 'border-brand bg-brand/10' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-slate-900">{driver.name}</span>
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ background: driver.status === 'on_ride' ? BUSY_COLOR : FREE_COLOR }}>{driver.status === 'on_ride' ? 'On a ride' : 'Free'}</span>
                  </span>
                  <span className="mt-1 block truncate text-xs text-slate-500">{driver.vehicle || 'Vehicle not set'}{driver.plate ? ` · ${driver.plate}` : ''} · {secondsAgo(driver.updatedAt)}s ago</span>
                </button>
              </li>
            ))}
            {snapshot && !visibleDrivers.length && <li className="py-8 text-center text-sm text-slate-500">No drivers online{filter !== 'all' || search ? ' match this filter' : ' right now'}.</li>}
          </ul>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400"><RefreshCw size={12} /> Updates every {REFRESH_MS / 1000} s{snapshot ? ` · last ${new Date(snapshot.generatedAt).toLocaleTimeString()}` : ''}</p>
        </aside>
      </div>
    </div>
  );
};
