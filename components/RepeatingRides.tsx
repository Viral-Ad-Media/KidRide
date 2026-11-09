import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Repeat } from 'lucide-react';
import { ConfirmModal, Input } from './UIComponents';
import { formatMoney } from '../utils/rideData';
import {
  MAX_START_AHEAD_DAYS, RideSeries, SeriesPlan, WEEKDAYS, addDays, cancelSeries, describeDays, fetchSeries,
  formatClock, formatDay, planDays, skipSeriesDay, ymd
} from '../services/rideSeries';

// Repeating school-week bookings: the plan picker in the booking sheet, and
// the parent's list of repeating bookings with "skip a day" and "cancel all".

export const RepeatPlanPicker: React.FC<{ plan: SeriesPlan; onChange: (plan: SeriesPlan) => void; problem: string | null }> = ({ plan, onChange, problem }) => {
  const today = ymd(new Date());
  const toggle = (day: number) => onChange({ ...plan, weekdays: plan.weekdays.includes(day) ? plan.weekdays.filter((d) => d !== day) : [...plan.weekdays, day] });
  const count = problem ? 0 : planDays(plan).length;
  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Ride days">
        {WEEKDAYS.map((w) => {
          const on = plan.weekdays.includes(w.day);
          return (
            <button key={w.day} type="button" aria-pressed={on} aria-label={w.long} onClick={() => toggle(w.day)}
              className={`h-10 min-w-[44px] rounded-full border px-3 text-label font-semibold transition-colors ${on ? 'border-brand-deep bg-brand-deep text-white' : 'border-line bg-white text-ink hover:border-ink/30'}`}>
              {w.short}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-3">
        <Input label="Pickup time" type="time" step={300} value={plan.pickupLocalTime} onChange={(event) => onChange({ ...plan, pickupLocalTime: event.target.value })} />
        <Input label="First day" type="date" min={today} max={addDays(today, MAX_START_AHEAD_DAYS)} value={plan.startDate} onChange={(event) => onChange({ ...plan, startDate: event.target.value })} />
        <Input label="Last day" type="date" min={plan.startDate || today} value={plan.endDate} onChange={(event) => onChange({ ...plan, endDate: event.target.value })} />
      </div>
      <p className={`-mt-2 text-label ${problem ? 'text-danger' : 'text-muted'}`}>
        {problem || `${describeDays(plan.weekdays)} at ${formatClock(plan.pickupLocalTime)}: ${count} ride${count === 1 ? '' : 's'}, each booked a week ahead.`}
      </p>
    </div>
  );
};

/** The parent's active repeating bookings. `onChanged` reloads the ride list next to it. */
export const RepeatingRides: React.FC<{ onChanged?: () => void }> = ({ onChanged }) => {
  const [items, setItems] = useState<RideSeries[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [skipping, setSkipping] = useState<{ series: RideSeries; date: string } | null>(null);
  const [cancelling, setCancelling] = useState<RideSeries | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setItems(await fetchSeries()); setError(null); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load repeating rides.'); }
  }, []);
  useEffect(() => { void load().then(() => onChanged?.()); }, [load]);

  const feeText = (fee: number, currency?: string) => (fee > 0 ? ` A ${formatMoney(fee, currency || 'USD')} cancellation fee applies because a driver was already lined up.` : '');
  const currencyOf = (series: RideSeries) => series.rides[0]?.currency;

  const confirmSkip = async () => {
    if (!skipping) return;
    setBusy(true); setActionError(null);
    try {
      const result = await skipSeriesDay(skipping.series.id, skipping.date);
      setNotice(`No ride on ${formatDay(skipping.date)}.${feeText(result.cancellationFee, currencyOf(skipping.series))}`);
      setSkipping(null); await load(); onChanged?.();
    } catch (err) { setActionError(err instanceof Error ? err.message : 'Could not skip that day.'); }
    finally { setBusy(false); }
  };
  const confirmCancel = async () => {
    if (!cancelling) return;
    setBusy(true); setActionError(null);
    try {
      const result = await cancelSeries(cancelling.id);
      setNotice(`Repeating booking cancelled${result.cancelledRides ? ` with its ${result.cancelledRides} upcoming ride${result.cancelledRides === 1 ? '' : 's'}` : ''}.${feeText(result.cancellationFee, currencyOf(cancelling))}`);
      setCancelling(null); await load(); onChanged?.();
    } catch (err) { setActionError(err instanceof Error ? err.message : 'Could not cancel these rides.'); }
    finally { setBusy(false); }
  };

  if (!items.length && !error && !notice) return null;
  return (
    <section aria-labelledby="repeating-title" className="space-y-3">
      <h3 id="repeating-title" className="text-label font-semibold text-muted">Repeating rides</h3>
      {error && <p className="rounded-card bg-danger/10 px-4 py-3 text-label text-danger">{error}</p>}
      {notice && <p role="status" className="rounded-card bg-success/10 px-4 py-3 text-label text-ink">{notice}</p>}
      {items.map((series) => {
        const days = series.nextDays.slice(0, 6);
        return (
          <article key={series.id} className="rounded-card border border-line bg-white p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/20 text-ink"><Repeat size={18} /></span>
              <div className="min-w-0 flex-1">
                <p className="text-body font-bold">{describeDays(series.weekdays)} at {formatClock(series.pickupLocalTime)}</p>
                <p className="text-caption text-muted">{formatDay(series.startDate)} to {formatDay(series.endDate)}</p>
                <p className="mt-1 break-words text-label">{series.pickupLocation} <ArrowRight size={12} className="mx-1 inline" /> {series.dropoffLocation}</p>
              </div>
            </div>
            {days.length > 0 && (
              <div className="mt-3">
                <p className="text-caption text-muted">Next rides. Tap a day to skip it.</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {days.map((date) => (
                    <button key={date} type="button" onClick={() => { setActionError(null); setSkipping({ series, date }); }}
                      className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-caption font-semibold text-ink hover:border-danger/50 hover:text-danger">
                      {formatDay(date)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {series.skippedDates.length > 0 && <p className="mt-2 text-caption text-muted">Skipped: {series.skippedDates.filter((d) => d >= ymd(new Date())).map(formatDay).join(', ') || 'none upcoming'}</p>}
            <button type="button" onClick={() => { setActionError(null); setCancelling(series); }} className="mt-3 rounded-full bg-danger/10 px-4 py-2 text-label font-semibold text-danger hover:bg-danger/15">
              Cancel all
            </button>
          </article>
        );
      })}

      <ConfirmModal
        open={!!skipping}
        title={skipping ? `Skip ${formatDay(skipping.date)}?` : ''}
        body={skipping ? <p>No ride that day. The rest of the week stays booked. If a driver has already accepted that ride, the usual cancellation fee can apply.</p> : null}
        confirmLabel="Skip this day"
        tone="danger"
        busy={busy}
        error={actionError}
        onConfirm={() => void confirmSkip()}
        onClose={() => setSkipping(null)}
      />
      <ConfirmModal
        open={!!cancelling}
        title="Cancel all of these rides?"
        body={cancelling ? <p>{describeDays(cancelling.weekdays)} at {formatClock(cancelling.pickupLocalTime)}. No new rides will be booked and every upcoming ride from this booking is cancelled. Rides a driver has already accepted can carry the usual cancellation fee.</p> : null}
        confirmLabel="Cancel all"
        tone="danger"
        busy={busy}
        error={actionError}
        onConfirm={() => void confirmCancel()}
        onClose={() => setCancelling(null)}
      />
    </section>
  );
};
