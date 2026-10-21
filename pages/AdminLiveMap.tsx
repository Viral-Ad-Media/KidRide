/// <reference types="google.maps" />
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapPinOff, RefreshCw } from 'lucide-react';
import { AdminTabs } from './Admin';
import { carIcon } from '../components/LiveMap';
import { useGoogleMaps } from '../services/googleMaps';
import { LiveDriver, LiveMapSnapshot, errorMessage, fetchLiveMap } from '../services/adminApi';

// Admin live map: every online driver (green = free, blue = on a ride) and
// every ride in progress, refreshed every few seconds.

const REFRESH_MS = 5000;
const FREE_COLOR = '#059669';
const BUSY_COLOR = '#1d6fff';
const DEFAULT_CENTER = { lat: 51.5074, lng: -0.1278 };

type Filter = 'all' | 'free' | 'on_ride';

const stopIcon = (maps: typeof google.maps, color: string): google.maps.Symbol => ({
  path: maps.SymbolPath.CIRCLE,
  scale: 8,
  fillColor: color,
  fillOpacity: 1,
  strokeColor: '#ffffff',
  strokeWeight: 2
});

const secondsAgo = (iso: string) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));

export const AdminLiveMap = () => {
  const mapsState = useGoogleMaps();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const driverMarkers = useRef(new Map<string, google.maps.Marker>());
  const rideMarkers = useRef<google.maps.Marker[]>([]);
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
    mapRef.current = new mapsState.maps.Map(containerRef.current, { center: DEFAULT_CENTER, zoom: 12, disableDefaultUI: true, zoomControl: true, clickableIcons: false });
    infoRef.current = new mapsState.maps.InfoWindow();
  }, [mapsState.status]);

  const showDriver = (driver: LiveDriver) => {
    const map = mapRef.current;
    const marker = driverMarkers.current.get(driver.id);
    if (!map || !marker || !infoRef.current) return;
    infoRef.current.setContent(`<div style="font:13px sans-serif;min-width:160px"><strong>${driver.name.replace(/</g, '&lt;')}</strong><br/>${driver.status === 'on_ride' ? 'On a ride' : 'Free'}${driver.vehicle ? `<br/>${driver.vehicle.replace(/</g, '&lt;')}${driver.plate ? ` (${driver.plate.replace(/</g, '&lt;')})` : ''}` : ''}<br/><span style="color:#64748b">Updated ${secondsAgo(driver.updatedAt)}s ago</span></div>`);
    infoRef.current.open({ map, anchor: marker });
  };

  // Draw drivers and ride stops from the latest snapshot.
  useEffect(() => {
    if (mapsState.status !== 'ready' || !mapRef.current || !snapshot) return;
    const maps = mapsState.maps;
    const map = mapRef.current;
    const seen = new Set<string>();
    for (const driver of snapshot.drivers) {
      seen.add(driver.id);
      const icon = carIcon(maps, driver.heading ?? 0, driver.status === 'on_ride' ? BUSY_COLOR : FREE_COLOR);
      const existing = driverMarkers.current.get(driver.id);
      if (existing) {
        existing.setPosition({ lat: driver.lat, lng: driver.lng });
        existing.setIcon(icon);
      } else {
        const marker = new maps.Marker({ map, position: { lat: driver.lat, lng: driver.lng }, icon, title: driver.name, zIndex: 3 });
        marker.addListener('click', () => { setSelected(driver.id); });
        driverMarkers.current.set(driver.id, marker);
      }
    }
    for (const [id, marker] of driverMarkers.current) {
      if (!seen.has(id)) { marker.setMap(null); driverMarkers.current.delete(id); }
    }

    rideMarkers.current.forEach((marker) => marker.setMap(null));
    rideMarkers.current = [];
    for (const ride of snapshot.rides) {
      const searching = !ride.driverId;
      if (ride.pickupCoords) rideMarkers.current.push(new maps.Marker({ map, position: ride.pickupCoords, icon: stopIcon(maps, searching ? '#f59e0b' : BUSY_COLOR), label: { text: 'A', color: '#fff', fontSize: '10px', fontWeight: '700' }, title: `${searching ? 'Waiting for a driver' : `Pickup (${ride.driverName || 'driver'})`}: ${ride.pickup}`, zIndex: 2 }));
      if (ride.dropoffCoords) rideMarkers.current.push(new maps.Marker({ map, position: ride.dropoffCoords, icon: stopIcon(maps, '#64748b'), label: { text: 'B', color: '#fff', fontSize: '10px', fontWeight: '700' }, title: `Drop-off: ${ride.dropoff}`, zIndex: 1 }));
    }

    // Frame everything the first time there is something to show.
    if (!fittedOnce.current && (snapshot.drivers.length || rideMarkers.current.length)) {
      const bounds = new maps.LatLngBounds();
      snapshot.drivers.forEach((driver) => bounds.extend({ lat: driver.lat, lng: driver.lng }));
      rideMarkers.current.forEach((marker) => { const position = marker.getPosition(); if (position) bounds.extend(position); });
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
    showDriver(driver);
  }, [selected]);

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
          <div className="absolute bottom-3 left-3 flex flex-wrap gap-3 rounded-xl bg-white/95 px-3 py-2 text-xs text-slate-600 shadow">
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
                <button type="button" onClick={() => setSelected(driver.id === selected ? null : driver.id)} className={`w-full rounded-2xl border px-3 py-2.5 text-left ${driver.id === selected ? 'border-[#1d6fff] bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>
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
