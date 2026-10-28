import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
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
        Alerts go to the parent and every admin (inbox and email) and flag the ride in Rides and on the Live map. SOS is always on.
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
    </div>
  );
};
