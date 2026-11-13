import React, { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from './UIComponents';
import { apiRequest, getStoredToken } from '../services/api';
import { formatMoney } from '../utils/rideData';

// Admin: monthly plan tiers. A discount only ever comes out of KidRide's share,
// and is capped so each ride still leaves at least the minimum profit after the
// card fee. Changes apply to new subscribers; existing ones keep their terms.

interface PlanRow { id: string; name: string; monthlyPrice: number; discountPercent: number; ridesPerWeek: number; maxDiscountPerRide: number; maxMiles: number | null; active: boolean }
interface PlanSettings { minProfitPerRide: number; cardFeePercent: number; cardFeeFixed: number; plans: PlanRow[] }
interface Sample { fare: number; discount: number; parentPays: number; driverEarns: number; kidrideKeeps: number }
interface Summary { active: Record<string, number>; monthlyRevenue: number }
interface PreviewRow { id: string; pickup: Sample; pickupAndDropoff: Sample }

type Draft = Record<string, string | boolean>;
const toDraft = (plan: PlanRow): Draft => ({ id: plan.id, name: plan.name, monthlyPrice: String(plan.monthlyPrice), discountPercent: String(plan.discountPercent), ridesPerWeek: String(plan.ridesPerWeek), maxDiscountPerRide: String(plan.maxDiscountPerRide), maxMiles: plan.maxMiles === null ? '' : String(plan.maxMiles), active: plan.active });
const n = (value: string | boolean) => (String(value).trim() === '' ? NaN : Number(value));
const fromDraft = (d: Draft): PlanRow => ({ id: String(d.id).trim(), name: String(d.name).trim(), monthlyPrice: n(d.monthlyPrice), discountPercent: n(d.discountPercent), ridesPerWeek: n(d.ridesPerWeek), maxDiscountPerRide: n(d.maxDiscountPerRide), maxMiles: String(d.maxMiles).trim() === '' ? null : n(d.maxMiles), active: d.active === true });

const FIELDS: [string, string][] = [['monthlyPrice', 'Monthly price'], ['discountPercent', 'Discount %'], ['ridesPerWeek', 'Rides / week'], ['maxDiscountPerRide', 'Max off per ride'], ['maxMiles', 'Max miles (blank = any)']];
const input = 'w-full rounded-xl border border-line bg-white px-3 py-2 text-body tabular-nums focus:border-brand-deep focus:outline-none';

export const AdminPlans: React.FC<{ currency: string }> = ({ currency }) => {
  const [base, setBase] = useState<PlanSettings | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [minProfit, setMinProfit] = useState('');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [sample, setSample] = useState({ miles: '4', minutes: '12' });
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiRequest<{ settings: PlanSettings; summary: Summary | null }>('/admin/pricing/plans', { token: getStoredToken() })
      .then((result) => { setBase(result.settings); setDrafts(result.settings.plans.map(toDraft)); setMinProfit(String(result.settings.minProfitPerRide)); setSummary(result.summary); })
      .catch((err) => setProblem(err instanceof Error ? err.message : 'Could not load plans. Run subscriptions.sql first.'));
  }, []);

  const settings: PlanSettings | null = base ? { ...base, minProfitPerRide: n(minProfit), plans: drafts.map(fromDraft) } : null;
  const key = JSON.stringify(settings);

  useEffect(() => {
    if (!settings) return undefined;
    const timer = window.setTimeout(() => {
      apiRequest<{ plans: PreviewRow[] }>('/admin/pricing/plans/preview', { method: 'POST', token: getStoredToken(), body: { settings, miles: Number(sample.miles), minutes: Number(sample.minutes) } })
        .then((result) => { setPreview(result.plans); setProblem(null); })
        .catch((err) => { setPreview(null); setProblem(err instanceof Error ? err.message : 'Check the plan values.'); });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [key, sample.miles, sample.minutes]); // eslint-disable-line react-hooks/exhaustive-deps

  const edit = (index: number, field: string, value: string | boolean) => { setFlash(null); setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, [field]: value } : d))); };
  const add = () => setDrafts((prev) => [...prev, { id: `plan_${prev.length + 1}`, name: 'New plan', monthlyPrice: '9.99', discountPercent: '10', ridesPerWeek: '10', maxDiscountPerRide: '4', maxMiles: '20', active: false }]);
  const save = async () => {
    if (!settings) return;
    setSaving(true); setFlash(null);
    try {
      const result = await apiRequest<{ settings: PlanSettings }>('/admin/pricing/plans', { method: 'PUT', token: getStoredToken(), body: { settings } });
      setBase(result.settings); setDrafts(result.settings.plans.map(toDraft)); setMinProfit(String(result.settings.minProfitPerRide));
      setFlash('Saved. New subscribers get these terms; current subscribers keep theirs.');
    } catch (err) { setProblem(err instanceof Error ? err.message : 'Could not save plans.'); }
    finally { setSaving(false); }
  };

  if (!base) {
    return (
      <section className="mt-6 rounded-card border border-line bg-white p-5">
        <h2 className="text-lead font-extrabold tracking-tight">Monthly plans</h2>
        {problem ? <p className="mt-2 text-label text-danger">{problem}</p> : <p className="mt-2 flex items-center gap-2 text-label text-muted"><Loader2 size={16} className="animate-spin" /> Loading plans...</p>}
      </section>
    );
  }

  const previewFor = (id: string) => preview?.find((row) => row.id === id);
  return (
    <section className="mt-6 rounded-card border border-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lead font-extrabold tracking-tight">Monthly plans</h2>
          <p className="mt-0.5 text-label text-muted">Parents pay monthly for a discount on a set number of rides a week. The discount comes from KidRide's share only; drivers keep their full earnings.</p>
        </div>
        {summary && <p className="text-label text-muted">Active subscribers: <span className="font-semibold text-ink">{Object.values(summary.active).reduce((a: number, b: number) => a + b, 0)}</span> · {formatMoney(summary.monthlyRevenue, currency)} / month</p>}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="text-label font-semibold">Minimum KidRide profit per ride</span>
          <input value={minProfit} onChange={(e) => { setFlash(null); setMinProfit(e.target.value); }} inputMode="decimal" className={`mt-1 ${input}`} />
          <span className="mt-1 block text-caption text-muted">A discount is cut back so each ride still leaves this much after the card fee.</span>
        </label>
        <label className="block"><span className="text-label font-semibold">Sample miles</span><input value={sample.miles} onChange={(e) => setSample((s) => ({ ...s, miles: e.target.value }))} inputMode="decimal" className={`mt-1 ${input}`} /></label>
        <label className="block"><span className="text-label font-semibold">Sample minutes</span><input value={sample.minutes} onChange={(e) => setSample((s) => ({ ...s, minutes: e.target.value }))} inputMode="decimal" className={`mt-1 ${input}`} /></label>
      </div>

      <div className="mt-5 space-y-4">
        {drafts.map((draft, index) => {
          const row = previewFor(String(draft.id));
          return (
            <div key={index} className="rounded-card border border-line p-4">
              <div className="flex flex-wrap items-center gap-3">
                <input value={String(draft.name)} onChange={(e) => edit(index, 'name', e.target.value)} aria-label="Plan name" className={`${input} max-w-[220px] font-bold`} />
                <input value={String(draft.id)} onChange={(e) => edit(index, 'id', e.target.value)} aria-label="Plan id" className={`${input} max-w-[160px] text-label text-muted`} />
                <label className="flex items-center gap-2 text-label font-semibold"><input type="checkbox" checked={draft.active === true} onChange={(e) => edit(index, 'active', e.target.checked)} /> Offered to parents</label>
                <button type="button" onClick={() => setDrafts((prev) => prev.filter((_, i) => i !== index))} className="ml-auto rounded-full p-2 text-muted hover:bg-surface-2" aria-label={`Remove ${String(draft.name)}`}><Trash2 size={16} /></button>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-5">
                {FIELDS.map(([field, label]) => (
                  <label key={field} className="block"><span className="text-caption font-semibold text-muted">{label}</span><input value={String(draft[field])} onChange={(e) => edit(index, field, e.target.value)} inputMode="decimal" className={`mt-1 ${input}`} /></label>
                ))}
              </div>
              {row && (
                <table className="mt-3 w-full text-label tabular-nums">
                  <thead><tr className="text-left text-caption text-muted"><th className="font-semibold">Sample trip</th><th>Fare</th><th>Discount</th><th>Parent pays</th><th>Driver earns</th><th>KidRide keeps</th></tr></thead>
                  <tbody>
                    {([['Pickup', row.pickup], ['Pickup and drop-off', row.pickupAndDropoff]] as const).map(([label, s]) => (
                      <tr key={label}><td>{label}</td><td>{formatMoney(s.fare, currency)}</td><td>-{formatMoney(s.discount, currency)}</td><td className="font-semibold">{formatMoney(s.parentPays, currency)}</td><td>{formatMoney(s.driverEarns, currency)}</td><td>{formatMoney(s.kidrideKeeps, currency)}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {drafts.length < 6 && <Button variant="secondary" onClick={add}><Plus size={16} className="mr-1" /> Add plan</Button>}
        <Button onClick={() => void save()} disabled={saving || !!problem}>{saving ? 'Saving...' : 'Save plans'}</Button>
        {flash && <p className="text-label font-semibold text-success">{flash}</p>}
        {problem && <p role="alert" className="text-label text-danger">{problem}</p>}
      </div>
    </section>
  );
};
