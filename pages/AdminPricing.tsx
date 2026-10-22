import React, { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AdminTabs } from './Admin';
import { Button } from '../components/UIComponents';
import { FareBreakdown } from '../components/FareBreakdown';
import { apiRequest, getStoredToken } from '../services/api';
import { FareBreakdown as Fare } from '../types';
import { formatMoney } from '../utils/rideData';

// Admin console: every fare rate in one form, with a live sample quote using
// the unsaved values. Saved rates apply to new quotes within 30 seconds.

interface PricingSettings {
  currency: string;
  timezone: string;
  baseFare: number;
  perMile: number;
  perMinute: number;
  minimumFare: number;
  bookingFee: number;
  peakSurcharge: number;
  peakWindows: string[];
  extraChildFee: number;
  serviceMultipliers: Record<string, number>;
  stayPerMinute: number;
  stayMinimumMinutes: number;
  driverShare: number;
  cancellation: { freeMinutesAfterBooking: number; freeHoursBeforeScheduled: number; driverAssignedFee: number; lateWindowMinutes: number; latePercent: number };
}

const SERVICES: [string, string][] = [
  ['pickup_only', 'Pickup'],
  ['dropoff_only', 'Drop-off'],
  ['pickup_and_dropoff', 'Pickup and drop-off'],
  ['stay_with_child_and_dropoff', 'Stay, then drop-off']
];

type Form = Record<string, string>;
const toForm = (s: PricingSettings): Form => ({
  currency: s.currency, timezone: s.timezone,
  baseFare: String(s.baseFare), perMile: String(s.perMile), perMinute: String(s.perMinute), minimumFare: String(s.minimumFare), bookingFee: String(s.bookingFee),
  peakSurcharge: String(s.peakSurcharge), peakWindows: s.peakWindows.join(', '), extraChildFee: String(s.extraChildFee),
  stayPerMinute: String(s.stayPerMinute), stayMinimumMinutes: String(s.stayMinimumMinutes), driverSharePercent: String(Math.round(s.driverShare * 1000) / 10),
  ...Object.fromEntries(SERVICES.map(([type]) => [`m_${type}`, String(s.serviceMultipliers[type])])),
  ...Object.fromEntries(Object.entries(s.cancellation).map(([key, value]) => [`c_${key}`, String(value)]))
});
const fromForm = (f: Form): PricingSettings => {
  const n = (key: string) => (f[key].trim() === '' ? NaN : Number(f[key]));
  return {
    currency: f.currency.trim().toUpperCase(), timezone: f.timezone.trim(),
    baseFare: n('baseFare'), perMile: n('perMile'), perMinute: n('perMinute'), minimumFare: n('minimumFare'), bookingFee: n('bookingFee'),
    peakSurcharge: n('peakSurcharge'), peakWindows: f.peakWindows.split(',').map((w) => w.replace(/\s/g, '')).filter(Boolean), extraChildFee: n('extraChildFee'),
    stayPerMinute: n('stayPerMinute'), stayMinimumMinutes: n('stayMinimumMinutes'), driverShare: n('driverSharePercent') / 100,
    serviceMultipliers: Object.fromEntries(SERVICES.map(([type]) => [type, n(`m_${type}`)])),
    cancellation: {
      freeMinutesAfterBooking: n('c_freeMinutesAfterBooking'), freeHoursBeforeScheduled: n('c_freeHoursBeforeScheduled'),
      driverAssignedFee: n('c_driverAssignedFee'), lateWindowMinutes: n('c_lateWindowMinutes'), latePercent: n('c_latePercent')
    }
  };
};

const Field: React.FC<{ label: string; name: string; form: Form; onChange: (name: string, value: string) => void; suffix?: string; hint?: string; wide?: boolean }> = ({ label, name, form, onChange, suffix, hint, wide }) => (
  <label className={`block ${wide ? 'sm:col-span-2' : ''}`}>
    <span className="text-label font-semibold">{label}</span>
    <span className="mt-1 flex items-center gap-2">
      <input value={form[name] ?? ''} onChange={(event) => onChange(name, event.target.value)} inputMode={wide || name === 'currency' || name === 'timezone' ? 'text' : 'decimal'}
        className="w-full rounded-xl border border-line bg-white px-3 py-2 text-body tabular-nums focus:border-brand-deep focus:outline-none" />
      {suffix && <span className="shrink-0 text-label text-muted">{suffix}</span>}
    </span>
    {hint && <span className="mt-1 block text-caption text-muted">{hint}</span>}
  </label>
);

const Section: React.FC<{ title: string; note?: string; children: React.ReactNode }> = ({ title, note, children }) => (
  <section className="rounded-card border border-line bg-white p-5">
    <h2 className="text-lead font-extrabold tracking-tight">{title}</h2>
    {note && <p className="mt-0.5 text-label text-muted">{note}</p>}
    <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
  </section>
);

export const AdminPricing = () => {
  const [form, setForm] = useState<Form | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [sample, setSample] = useState({ miles: '4', minutes: '12', time: '08:00', stay: '60' });
  const [preview, setPreview] = useState<Record<string, Fare> | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<{ settings: PricingSettings; updatedAt: string | null }>('/admin/pricing', { token: getStoredToken() })
      .then((result) => { setForm(toForm(result.settings)); setUpdatedAt(result.updatedAt); })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load pricing.'));
  }, []);

  const settings = useMemo(() => (form ? fromForm(form) : null), [form]);

  useEffect(() => {
    if (!settings) return;
    const timer = window.setTimeout(() => {
      apiRequest<{ quotes: Record<string, Fare> }>('/admin/pricing/preview', {
        method: 'POST', token: getStoredToken(),
        body: { settings, miles: Number(sample.miles), minutes: Number(sample.minutes), stayMinutes: Number(sample.stay), localTime: sample.time }
      }).then((result) => { setPreview(result.quotes); setPreviewError(null); })
        .catch((err) => { setPreview(null); setPreviewError(err instanceof Error ? err.message : 'Check the values above.'); });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [settings, sample]);

  const change = (name: string, value: string) => { setFlash(null); setForm((prev) => (prev ? { ...prev, [name]: value } : prev)); };
  const save = async () => {
    if (!settings) return;
    setSaving(true); setError(null); setFlash(null);
    try {
      const result = await apiRequest<{ settings: PricingSettings; updatedAt: string }>('/admin/pricing', { method: 'PUT', token: getStoredToken(), body: { settings } });
      setForm(toForm(result.settings)); setUpdatedAt(result.updatedAt);
      setFlash('Saved. New quotes use these rates; rides already booked keep their price.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save pricing.'); }
    finally { setSaving(false); }
  };

  if (!form) {
    return (
      <div>
        <AdminTabs />
        {error ? <p role="alert" className="text-label text-danger">{error}</p> : <p className="flex items-center gap-2 text-label text-muted"><Loader2 size={16} className="animate-spin" /> Loading pricing...</p>}
      </div>
    );
  }
  const currency = /^[A-Z]{3}$/.test(settings?.currency || '') ? settings!.currency : 'USD';
  const props = { form, onChange: change };

  return (
    <div>
      <AdminTabs />
      <div className="mb-5">
        <p className="text-label text-muted">
          Fare = the larger of the minimum and base + per mile + per minute, times the service multiplier, plus extras and the booking fee.
          {updatedAt ? ` Last saved ${new Date(updatedAt).toLocaleString()}.` : ' Using the starting rates; nothing saved yet.'}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Section title="Distance and time">
            <Field label="Base fare" name="baseFare" suffix={currency} {...props} />
            <Field label="Per mile" name="perMile" suffix={currency} {...props} />
            <Field label="Per minute" name="perMinute" suffix={currency} {...props} />
            <Field label="Minimum fare" name="minimumFare" suffix={currency} hint="Before multiplier, extras and booking fee" {...props} />
            <Field label="Booking fee" name="bookingFee" suffix={currency} hint="KidRide keeps this; not shared with the driver" {...props} />
            <Field label="Driver share" name="driverSharePercent" suffix="%" hint="Of the fare before booking fee; peak fee goes 100% to the driver" {...props} />
          </Section>

          <Section title="Service types" note="Multiplies the distance fare. Pickup and drop-off 1.8 means two legs with 10% off.">
            {SERVICES.map(([type, label]) => <Field key={type} label={label} name={`m_${type}`} suffix="x" {...props} />)}
            <Field label="Stay with child, per minute" name="stayPerMinute" suffix={currency} {...props} />
            <Field label="Stay minimum" name="stayMinimumMinutes" suffix="min" {...props} />
          </Section>

          <Section title="Extras">
            <Field label="School-run peak fee" name="peakSurcharge" suffix={currency} {...props} />
            <Field label="Extra child fee" name="extraChildFee" suffix={currency} hint="Each extra child on the same ride" {...props} />
            <Field label="Peak windows" name="peakWindows" wide hint="24-hour local times, comma separated, e.g. 07:00-09:00, 14:30-16:30" {...props} />
          </Section>

          <Section title="Cancellation" note="Charged when a parent cancels. Drivers and admins cancel free of charge.">
            <Field label="Free right after booking" name="c_freeMinutesAfterBooking" suffix="min" {...props} />
            <Field label="Free when scheduled this far ahead" name="c_freeHoursBeforeScheduled" suffix="hours" {...props} />
            <Field label="Fee once a driver is assigned" name="c_driverAssignedFee" suffix={currency} {...props} />
            <Field label="Late window before a scheduled pickup" name="c_lateWindowMinutes" suffix="min" {...props} />
            <Field label="Late cancellation charge" name="c_latePercent" suffix="% of fare" {...props} />
          </Section>

          <Section title="Region">
            <Field label="Currency" name="currency" hint="3-letter code, e.g. USD, GBP, NGN" {...props} />
            <Field label="Time zone" name="timezone" hint="For peak windows, e.g. America/New_York" {...props} />
          </Section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-card border border-line bg-white p-5">
            <h2 className="text-lead font-extrabold tracking-tight">Sample trip</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 text-label">
              {([['miles', 'Miles'], ['minutes', 'Minutes'], ['time', 'Pickup (local)'], ['stay', 'Stay (min)']] as const).map(([key, label]) => (
                <label key={key} className="block">
                  <span className="text-muted">{label}</span>
                  <input type={key === 'time' ? 'time' : 'text'} inputMode="decimal" value={sample[key]} onChange={(event) => setSample((prev) => ({ ...prev, [key]: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-line px-3 py-2 tabular-nums" />
                </label>
              ))}
            </div>
            {previewError ? <p className="mt-3 text-label text-danger">{previewError}</p> : preview && (
              <>
                <ul className="mt-4 divide-y divide-line">
                  {SERVICES.map(([type, label]) => (
                    <li key={type} className="flex justify-between py-2 text-label">
                      <span>{label}</span>
                      <span className="font-bold tabular-nums">{formatMoney(preview[type].total, currency)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-caption font-semibold uppercase text-muted">Pickup breakdown</p>
                <FareBreakdown fare={preview.pickup_only} currency={currency} className="mt-1" />
                <p className="mt-2 text-caption text-muted">Driver earns {formatMoney((preview.pickup_only as Fare & { driverEarnings: number }).driverEarnings, currency)}</p>
              </>
            )}
          </div>
          {error && <p role="alert" className="text-label text-danger">{error}</p>}
          {flash && <p className="text-label font-semibold text-success">{flash}</p>}
          <Button fullWidth onClick={() => void save()} disabled={saving || !!previewError}>{saving ? 'Saving...' : 'Save rates'}</Button>
        </aside>
      </div>
    </div>
  );
};
