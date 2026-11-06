import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { IncidentWithRide, fetchAllIncidents, resolveRideIncidents } from '../services/adminApi';
import { SAFETY_ALERT_LABELS } from '../components/SafetyActions';
import { SafetyAlert } from '../types';
import { AdminTabs } from './Admin';
import { Field, Form, Section } from './AdminPricing';
import { Button } from '../components/UIComponents';
import { apiRequest, getStoredToken } from '../services/api';

// Admin console: thresholds for the automatic ride alerts and the trip code
// lock. Saved values apply to new GPS updates within 30 seconds.

interface SafetySettings {
  tripCodeMaxAttempts: number;
  offRouteMiles: number;
  stalledMinutes: number;
  stalledRadiusMeters: number;
  dropoffQuietMeters: number;
}
const KEYS: (keyof SafetySettings)[] = ['tripCodeMaxAttempts', 'offRouteMiles', 'stalledMinutes', 'stalledRadiusMeters', 'dropoffQuietMeters'];
const toForm = (s: SafetySettings): Form => Object.fromEntries(KEYS.map((key) => [key, String(s[key])]));
const fromForm = (f: Form): SafetySettings => Object.fromEntries(KEYS.map((key) => [key, f[key].trim() === '' ? NaN : Number(f[key])])) as unknown as SafetySettings;

export const AdminSafety = () => {
  const [form, setForm] = useState<Form | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<{ settings: SafetySettings; updatedAt: string | null }>('/admin/safety', { token: getStoredToken() })
      .then((result) => { setForm(toForm(result.settings)); setUpdatedAt(result.updatedAt); })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load safety settings.'));
  }, []);

  const change = (name: string, value: string) => { setFlash(null); setForm((prev) => (prev ? { ...prev, [name]: value } : prev)); };
  const save = async () => {
    if (!form) return;
    setSaving(true); setError(null); setFlash(null);
    try {
      const result = await apiRequest<{ settings: SafetySettings; updatedAt: string }>('/admin/safety', { method: 'PUT', token: getStoredToken(), body: { settings: fromForm(form) } });
      setForm(toForm(result.settings)); setUpdatedAt(result.updatedAt);
      setFlash('Saved. Trips in progress use these thresholds from their next GPS update.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save safety settings.'); }
    finally { setSaving(false); }
  };

  if (!form) {
    return (
      <div>
        <AdminTabs />
        {error ? <p role="alert" className="text-label text-danger">{error}</p> : <p className="flex items-center gap-2 text-label text-muted"><Loader2 size={16} className="animate-spin" /> Loading safety settings...</p>}
      </div>
    );
  }
  const props = { form, onChange: change };

  return (
    <div>
      <AdminTabs />
      <p className="mb-5 text-label text-muted">
        Alerts go to the parent and every admin (inbox and email) and flag the ride in Rides and on the Live map. SOS is always on: it also sounds an alarm on every admin page and emails the parent's trusted contacts a live location link.
        {updatedAt ? ` Last saved ${new Date(updatedAt).toLocaleString()}.` : ' Using the starting thresholds; nothing saved yet.'}
      </p>
      <div className="max-w-3xl space-y-5">
        <Section title="Trip code" note="The driver enters the parent's code before the child gets in. Each wrong code alerts the parent and admins.">
          <Field label="Wrong codes before the pickup locks" name="tripCodeMaxAttempts" hint="Once locked, only an admin can move the ride on" {...props} />
        </Section>
        <Section title="Off route" note="Measured from the straight line between pickup and drop-off while the child is in the car.">
          <Field label="Alert when further than" name="offRouteMiles" suffix="miles" hint="Roads wind; below 1 mile gives false alarms on longer trips" {...props} />
        </Section>
        <Section title="Car stopped" note="While the child is in the car. GPS fixes vaguer than 200 m are ignored.">
          <Field label="Alert after stopped for" name="stalledMinutes" suffix="min" {...props} />
          <Field label="Counts as stopped within" name="stalledRadiusMeters" suffix="m" {...props} />
          <Field label="No alert this close to the drop-off" name="dropoffQuietMeters" suffix="m" hint="The car is parking" {...props} />
        </Section>
        {error && <p role="alert" className="text-label text-danger">{error}</p>}
        {flash && <p className="text-label font-semibold text-success">{flash}</p>}
        <Button onClick={() => void save()} disabled={saving} className="w-auto px-8">{saving ? 'Saving...' : 'Save thresholds'}</Button>
      </div>
      <IncidentHistory />
    </div>
  );
};

// Every safety incident across rides, newest first, with the ride and contacts.
const IncidentHistory: React.FC = () => {
  const [status, setStatus] = useState<'open' | 'all'>('all');
  const [kind, setKind] = useState<SafetyAlert | ''>('');
  const [incidents, setIncidents] = useState<IncidentWithRide[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyRide, setBusyRide] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try { setIncidents(await fetchAllIncidents(status, kind || undefined)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load incidents.'); }
  }, [status, kind]);
  useEffect(() => { setIncidents(null); void load(); }, [load]);

  const resolve = async (rideId: string) => {
    setBusyRide(rideId);
    try { await resolveRideIncidents(rideId); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not update the incident.'); }
    finally { setBusyRide(null); }
  };
  const chip = (active: boolean) => `rounded-full px-4 py-2 text-sm font-semibold transition ${active ? 'bg-ink text-white' : 'bg-white text-muted ring-1 ring-line hover:bg-surface-2'}`;

  return (
    <section className="mt-10 max-w-5xl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-title font-bold text-ink">Incident history</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={chip(status === 'all')} onClick={() => setStatus('all')}>All</button>
          <button type="button" className={chip(status === 'open')} onClick={() => setStatus('open')}>Open</button>
          <select aria-label="Kind" value={kind} onChange={(e) => setKind(e.target.value as SafetyAlert | '')} className="h-10 rounded-full bg-white px-4 text-sm font-semibold text-ink ring-1 ring-line">
            <option value="">Every kind</option>
            {(Object.keys(SAFETY_ALERT_LABELS) as SafetyAlert[]).map((k) => <option key={k} value={k}>{SAFETY_ALERT_LABELS[k]}</option>)}
          </select>
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink"><RefreshCw size={14} /> Refresh</button>
        </div>
      </div>
      {error && <p role="alert" className="mb-3 text-label text-danger">{error}</p>}
      {incidents === null && !error && <p className="flex items-center gap-2 text-label text-muted"><Loader2 size={16} className="animate-spin" /> Loading incidents...</p>}
      {incidents && incidents.length === 0 && <p className="text-label text-muted">No incidents{status === 'open' ? ' open right now' : ' yet'}.</p>}
      {incidents && incidents.length > 0 && (
        <div className="overflow-x-auto rounded-card bg-white ring-1 ring-line">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr><th className="px-4 py-3 font-semibold">When</th><th className="px-4 py-3 font-semibold">What</th><th className="px-4 py-3 font-semibold">Ride</th><th className="px-4 py-3 font-semibold">People</th><th className="px-4 py-3 font-semibold">Status</th></tr>
            </thead>
            <tbody>
              {incidents.map((incident) => {
                const note = typeof incident.details?.note === 'string' ? incident.details.note : '';
                return (
                  <tr key={incident.id} className="border-b border-line last:border-0 align-top">
                    <td className="px-4 py-3 text-ink">{new Date(incident.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${incident.kind === 'sos' ? 'text-danger' : 'text-ink'}`}>{SAFETY_ALERT_LABELS[incident.kind]}</span>
                      <span className="block text-muted">{incident.reporterRole === 'system' ? 'Automatic' : `By the ${incident.reporterRole || 'user'}`}{note ? ` · "${note}"` : ''}</span>
                      {incident.contactsNotified ? <span className="block text-muted">{incident.contactsNotified} trusted contact{incident.contactsNotified === 1 ? '' : 's'} emailed</span> : null}
                      {incident.location && <a href={`https://www.google.com/maps?q=${incident.location.latitude},${incident.location.longitude}`} target="_blank" rel="noreferrer noopener" className="text-ink underline">Map</a>}
                    </td>
                    <td className="px-4 py-3 text-ink">
                      {incident.ride ? <>{incident.ride.child ? `${incident.ride.child.split(' ')[0]} · ` : ''}{incident.ride.status.replace(/_/g, ' ')}<span className="block text-muted">{incident.ride.pickup} to {incident.ride.dropoff}</span></> : 'Ride removed'}
                    </td>
                    <td className="px-4 py-3 text-ink">
                      {incident.ride?.parent && <span className="block">Parent {incident.ride.parent.name}{incident.ride.parent.phone ? <> · <a className="underline" href={`tel:${incident.ride.parent.phone}`}>{incident.ride.parent.phone}</a></> : ''}</span>}
                      {incident.ride?.driver && <span className="block">Driver {incident.ride.driver.name}{incident.ride.driver.phone ? <> · <a className="underline" href={`tel:${incident.ride.driver.phone}`}>{incident.ride.driver.phone}</a></> : ''}</span>}
                    </td>
                    <td className="px-4 py-3">
                      {incident.resolvedAt
                        ? <span className="text-muted">Handled {new Date(incident.resolvedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                        : incident.ride
                          ? <button type="button" disabled={busyRide === incident.ride.id} onClick={() => void resolve(incident.ride!.id)} className="rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">{busyRide === incident.ride.id ? 'Saving...' : 'Mark handled'}</button>
                          : <span className="font-semibold text-danger">Open</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
