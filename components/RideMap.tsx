import React, { useEffect, useState } from 'react';
import { DriverLocation } from '../types';
export const RideMap: React.FC<{ status: string; location?: DriverLocation }> = ({ location }) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(timer); }, []);
  if (!location) return <div className="flex h-full items-center justify-center rounded-2xl bg-slate-100 p-6 text-center text-slate-600">Waiting for driver GPS. No live position is available yet.</div>;
  const { latitude, longitude, recordedAt } = location;
  const bbox = [longitude - 0.01, latitude - 0.01, longitude + 0.01, latitude + 0.01].join(',');
  const stale = !Number.isFinite(Date.parse(recordedAt)) || now - Date.parse(recordedAt) > 30000;
  return <div className="relative h-full overflow-hidden rounded-2xl">
    <iframe title="Driver GPS location" className="h-full w-full border-0" src={`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${latitude},${longitude}`} />
    <div className="absolute bottom-4 left-4 right-4 rounded-xl bg-white p-3 text-xs">{stale ? 'GPS is stale. Last known position' : 'Driver GPS'} · {new Date(recordedAt).toLocaleTimeString()}</div>
  </div>;
};
