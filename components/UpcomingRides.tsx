import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlarmClock, ArrowRight, CalendarClock } from 'lucide-react';
import { Card, ConfirmModal, Input, Modal } from './UIComponents';
import { Ride } from '../types';
import {
  cancelScheduledRide,
  fetchScheduledRides,
  firstSlot,
  formatScheduledTime,
  latestSlot,
  minutesUntil,
  rescheduleRide,
  scheduleLabels,
  toLocalInputValue,
  validateScheduleInput
} from '../services/scheduledRides';
import { formatRidePrice } from '../utils/rideData';

// "Upcoming" rides booked for later. Parents can change the time (until the
// ride is offered to drivers, 30 minutes before pickup) or cancel. Drivers see
// the scheduled rides they accepted, with a reminder 15 minutes before pickup.

const REFRESH_MS = 30000;
const REMINDER_MINUTES = 15;

const chipTone: Record<string, string> = {
  scheduled: 'bg-indigo-50 text-brand-deep',
  dispatching: 'bg-orange-50 text-orange-700',
  assigned: 'bg-emerald-50 text-emerald-700',
  needs_attention: 'bg-red-50 text-red-700'
};

export const ScheduleChip: React.FC<{ state?: string | null }> = ({ state }) => (state ? (
  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${chipTone[state] || 'bg-slate-100 text-slate-600'}`}>
    <CalendarClock size={12} /> {scheduleLabels[state] || state}
  </span>
) : null);

const useScheduledRides = (refreshKey?: string) => {
  const [rides, setRides] = useState<Ride[]>([]);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);
  const load = useCallback(async () => {
    const request = ++latest.current;
    try {
      const result = await fetchScheduledRides();
      if (request === latest.current) { setRides(result); setError(null); }
    } catch (err) {
      if (request === latest.current) setError(err instanceof Error ? err.message : 'Could not load upcoming rides.');
    }
  }, []);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load, refreshKey]);
  return { rides, error, load };
};

const useNow = (everyMs = 15000) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), everyMs); return () => clearInterval(timer); }, [everyMs]);
  return now;
};

const RideLine: React.FC<{ ride: Ride }> = ({ ride }) => (
  <p className="mt-2 break-words text-sm text-slate-600">
    {ride.pickupLocation} <ArrowRight size={13} className="mx-1 inline" /> {ride.dropoffLocation}
  </p>
);

export const ParentUpcomingRides: React.FC = () => {
  const { rides, error, load } = useScheduledRides();
  const [editing, setEditing] = useState<Ride | null>(null);
  const [editValue, setEditValue] = useState('');
  const [cancelling, setCancelling] = useState<Ride | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const editProblem = editing ? validateScheduleInput(editValue) : null;

  const openEdit = (ride: Ride) => { setActionError(null); setEditValue(toLocalInputValue(new Date(ride.pickupTime))); setEditing(ride); };
  const saveEdit = async () => {
    if (!editing || editProblem) return;
    setBusy(true); setActionError(null);
    try { await rescheduleRide(editing.id, new Date(editValue).toISOString()); setEditing(null); await load(); }
    catch (err) { setActionError(err instanceof Error ? err.message : 'Could not change the time.'); await load(); }
    finally { setBusy(false); }
  };
  const confirmCancel = async () => {
    if (!cancelling) return;
    setBusy(true); setActionError(null);
    try { await cancelScheduledRide(cancelling.id); setCancelling(null); await load(); }
    catch (err) { setActionError(err instanceof Error ? err.message : 'Could not cancel the ride.'); }
    finally { setBusy(false); }
  };

  return (
    <Card>

      <h3 className="text-lead font-bold">Upcoming rides</h3>
      {error && <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">{error}</p>}
      {rides.length === 0 ? (
        <p className="mt-4 rounded-[24px] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center text-sm text-slate-500">
          No upcoming rides. Choose "Schedule" when booking to plan a ride up to 30 days ahead.
        </p>
      ) : (
        <ul className="mt-5 space-y-3" aria-label="Upcoming rides">
          {rides.map((ride) => (
            <li key={ride.id} className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-base font-bold text-slate-950">{formatScheduledTime(ride.pickupTime)}</p>
                <ScheduleChip state={ride.scheduleState} />
              </div>
              <RideLine ride={ride} />
              <p className="mt-1 text-xs text-slate-500">
                {formatRidePrice(ride.price)}
                {ride.driver?.name ? ` · Driver: ${ride.driver.name}` : ride.scheduleState === 'scheduled' ? ' · Offered to drivers 30 min before pickup' : ''}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {ride.scheduleState === 'scheduled' && (
                  <button type="button" onClick={() => openEdit(ride)} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-brand-deep hover:bg-brand/10">Change time</button>
                )}
                <button type="button" onClick={() => { setActionError(null); setCancelling(ride); }} className="rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100">Cancel</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={!!editing} onClose={busy ? undefined : () => setEditing(null)} labelledBy="reschedule-title">
        <h2 id="reschedule-title" className="text-lg font-bold text-slate-950">Change pickup time</h2>
        <p className="mt-2 text-sm text-slate-500">Your local time. Between 30 minutes and 30 days ahead, in 5-minute steps.</p>
        <div className="mt-4">
          <Input type="datetime-local" aria-label="New pickup date and time" value={editValue} min={toLocalInputValue(firstSlot(30))} max={toLocalInputValue(latestSlot())} step={300} onChange={(event) => setEditValue(event.target.value)} />
        </div>
        <p className={`-mt-2 text-sm ${editProblem ? 'text-red-600' : 'text-slate-500'}`}>{editProblem || formatScheduledTime(editValue)}</p>
        {actionError && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{actionError}</p>}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setEditing(null)} disabled={busy} className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Keep time</button>
          <button type="button" onClick={() => void saveEdit()} disabled={busy || !!editProblem} className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-ink hover:brightness-95 disabled:opacity-60">{busy ? 'Saving...' : 'Save new time'}</button>
        </div>
      </Modal>

      <ConfirmModal
        open={!!cancelling}
        title="Cancel this ride?"
        body={cancelling ? <p>{formatScheduledTime(cancelling.pickupTime)} from {cancelling.pickupLocation}.{cancelling.driver?.name ? ' The driver will be told.' : ''}</p> : null}
        confirmLabel="Cancel ride"
        tone="danger"
        busy={busy}
        error={actionError}
        onConfirm={() => void confirmCancel()}
        onClose={() => setCancelling(null)}
      />
    </Card>
  );
};

/** `refreshKey` reloads the list straight away, e.g. after the driver accepts a ride. */
export const DriverUpcomingRides: React.FC<{ refreshKey?: string }> = ({ refreshKey }) => {
  const { rides } = useScheduledRides(refreshKey);
  const now = useNow();
  const soon = rides.find((ride) => { const left = minutesUntil(ride.pickupTime, now); return left <= REMINDER_MINUTES && left >= -10; });

  return (
    <>
      {soon && (
        <div className="flex items-start gap-3 rounded-[24px] border border-amber-200 bg-amber-50 p-4 text-amber-900" role="alert">
          <AlarmClock size={22} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">
              {minutesUntil(soon.pickupTime, now) > 0 ? `Scheduled pickup in ${minutesUntil(soon.pickupTime, now)} min` : 'Scheduled pickup is due now'}
            </p>
            <p className="mt-1 text-sm">{soon.pickupLocation} at {new Date(soon.pickupTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. Head there now; the trip opens on your dashboard.</p>
          </div>
        </div>
      )}
      {rides.length > 0 && (
        <Card>

          <h3 className="text-lead font-bold">Upcoming rides</h3>
          <ul className="mt-4 space-y-3" aria-label="Your upcoming rides">
            {rides.map((ride) => (
              <li key={ride.id} className="rounded-[20px] bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold text-slate-950">{formatScheduledTime(ride.pickupTime)}</p>
                  <span className="text-sm font-semibold text-slate-700">{formatRidePrice(ride.price)}</span>
                </div>
                <RideLine ride={ride} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
};
