import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, Car, ExternalLink, Loader2, MapPin, Phone, RefreshCw } from 'lucide-react';
import { ApiError, apiRequest } from '../services/api';
import { BrandLockup } from '../components/brand/BrandLockup';

// Public page behind the live-location link sent with an SOS. Trusted contacts
// open it without an account; the link stops working once support marks the
// alert handled or after 12 hours. It refreshes every 15 seconds and uses a
// plain Google Maps embed so it works without the app's Maps key.

interface Point { latitude: number; longitude: number; accuracy?: number | null; recordedAt?: string | null }
interface SosView {
  active: boolean;
  child: string;
  driver: string | null;
  vehicle: string | null;
  plate: string | null;
  status: string;
  pickup: string;
  dropoff: string;
  raisedBy: 'driver' | 'parent' | 'someone';
  raisedAt: string;
  location: Point | null;
  expiresAt: string;
}

const REFRESH_MS = 15000;
const STATUS_TEXT: Record<string, string> = {
  pending: 'Waiting for a driver',
  driver_assigned: 'Driver on the way to the pickup',
  driver_arrived_at_pickup: 'Driver at the pickup',
  child_picked_up: 'Child in the car, heading to the drop-off',
  completed: 'Trip finished',
  cancelled: 'Trip cancelled'
};

const time = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '');

export const SosLive: React.FC = () => {
  const { token = '' } = useParams();
  const [view, setView] = useState<SosView | null>(null);
  const [gone, setGone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await apiRequest<SosView>(`/sos-live/${encodeURIComponent(token)}`);
      setView(result); setGone(null); setError(null); setCheckedAt(new Date());
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) { setGone(err.message || 'This live location link is no longer active.'); setView(null); }
      else setError(err instanceof Error && err.message ? err.message : 'Could not load the live location.');
    }
  }, [token]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { if (!gone) void load(); }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load, gone]);

  const where = view?.location;
  const q = where ? `${where.latitude.toFixed(6)},${where.longitude.toFixed(6)}` : '';

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <BrandLockup size={40} className="mb-5" />
      <a href="tel:911" className="mb-5 flex h-button w-full items-center justify-center gap-2 rounded-full bg-danger text-body font-bold text-white hover:bg-danger/90">
        <Phone size={18} /> Call 911 if anyone is in danger
      </a>

      {!view && !gone && !error && <p className="flex items-center gap-2 text-label text-muted"><Loader2 size={16} className="animate-spin" /> Loading live location...</p>}
      {gone && (
        <div className="rounded-card bg-surface-2 p-5">
          <p className="text-body font-semibold text-ink">{gone}</p>
          <p className="mt-1 text-label text-muted">If you are still worried, call the parent or 911.</p>
        </div>
      )}
      {error && <p role="alert" className="mb-3 flex items-start gap-2 text-label text-danger"><AlertTriangle size={18} className="mt-0.5 shrink-0" />{error}</p>}

      {view && (
        <>
          <div role="alert" className="mb-4 rounded-card bg-danger/10 p-4">
            <p className="flex items-center gap-2 text-body font-bold text-danger"><AlertTriangle size={18} /> SOS on {view.child}'s KidRide trip</p>
            <p className="mt-1 text-label text-ink">
              {view.raisedBy === 'driver' ? 'The driver' : view.raisedBy === 'parent' ? 'The parent' : 'Someone'} pressed SOS at {time(view.raisedAt)}. KidRide support has been alerted.
            </p>
          </div>

          <div className="overflow-hidden rounded-card ring-1 ring-line">
            {where ? (
              <iframe
                title={`Location of ${view.child}'s car`}
                src={`https://maps.google.com/maps?q=${q}&z=15&output=embed`}
                className="h-80 w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-48 items-center justify-center gap-2 bg-surface-2 text-label text-muted"><MapPin size={18} /> No location shared yet</div>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
            <span>{where?.recordedAt ? `Position from ${time(where.recordedAt)}` : where ? 'Position from when SOS was pressed' : ''}{checkedAt ? ` · checked ${time(checkedAt.toISOString())}` : ''}</span>
            <span className="flex items-center gap-3">
              {where && <a href={`https://www.google.com/maps?q=${q}`} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 font-semibold text-ink underline">Open in Google Maps <ExternalLink size={14} /></a>}
              <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1 font-semibold text-ink"><RefreshCw size={14} /> Refresh</button>
            </span>
          </div>

          <dl className="mt-5 grid gap-3 rounded-card bg-white p-4 text-label ring-1 ring-line sm:grid-cols-2">
            <div><dt className="text-muted">Trip</dt><dd className="font-semibold text-ink">{STATUS_TEXT[view.status] || view.status}</dd></div>
            <div><dt className="text-muted">Driver</dt><dd className="flex items-center gap-1 font-semibold text-ink"><Car size={16} />{view.driver || 'Not assigned'}{view.vehicle ? ` · ${view.vehicle}` : ''}{view.plate ? ` · ${view.plate}` : ''}</dd></div>
            <div><dt className="text-muted">Pickup</dt><dd className="text-ink">{view.pickup}</dd></div>
            <div><dt className="text-muted">Drop-off</dt><dd className="text-ink">{view.dropoff}</dd></div>
          </dl>
          <p className="mt-4 text-sm text-muted">This link works until KidRide support marks the alert handled, or until {new Date(view.expiresAt).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}. Do not forward it.</p>
        </>
      )}
    </div>
  );
};
