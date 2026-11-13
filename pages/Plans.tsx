import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { Button } from '../components/UIComponents';
import { formatMoney } from '../services/payments';
import { Plan, PlansOverview, cancelPlan, fetchPlans, resumePlan, startPlanCheckout } from '../services/plans';

const message = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);
const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const perks = (plan: Plan) => [
  `${plan.discountPercent}% off up to ${plan.ridesPerWeek} rides a week`,
  `Up to ${formatMoney(plan.maxDiscountPerRide, plan.currency)} off each ride`,
  plan.maxMiles ? `Trips up to ${plan.maxMiles} miles` : 'Any trip length',
  'School-week repeating rides count too'
];

/** Monthly plans: what each one gives, the parent's current plan and this week's discounted rides. */
export const Plans = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState<PlansOverview | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const returned = new URLSearchParams(location.search).get('checkout');

  const load = useCallback(() => fetchPlans().then(setData).catch((err) => { setData({ enabled: false }); setError(message(err, 'Could not load plans.')); }), []);
  useEffect(() => { void load(); }, [load]);
  // Stripe confirms the plan a moment after checkout; check again shortly.
  useEffect(() => {
    if (returned !== 'done') return undefined;
    const timer = window.setTimeout(() => void load(), 4000);
    return () => window.clearTimeout(timer);
  }, [returned, load]);

  const join = async (planId: string) => {
    setBusy(planId); setError(null);
    try { window.location.href = (await startPlanCheckout(planId)).url; }
    catch (err) { setError(message(err, 'Could not start the plan.')); setBusy(null); }
  };
  const toggleRenewal = async (cancel: boolean) => {
    setBusy('renewal'); setError(null);
    try { await (cancel ? cancelPlan() : resumePlan()); await load(); }
    catch (err) { setError(message(err, 'Could not update the plan.')); }
    finally { setBusy(null); }
  };

  const sub = data?.subscription?.live ? data.subscription : null;

  return (
    <div className="mx-auto max-w-[960px] space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="rounded-full p-2 hover:bg-surface-2" aria-label="Back"><ArrowLeft size={24} /></button>
        <div>
          <h1 className="text-title font-extrabold tracking-tight text-ink">Monthly plans</h1>
          <p className="text-label text-muted">Pay monthly and save on the rides you book every week.</p>
        </div>
      </div>

      {!data && <p className="flex items-center gap-2 text-label text-muted"><Loader2 size={16} className="animate-spin" /> Loading plans...</p>}
      {data && !data.enabled && (
        <div className="rounded-card border border-line bg-white p-6 text-center">
          <p className="font-semibold text-ink">Monthly plans open when card payments go live.</p>
          <p className="mt-1 text-label text-muted">Until then every ride is priced per trip as usual.</p>
        </div>
      )}

      {returned === 'done' && !sub && data?.enabled && <p className="rounded-card border border-line bg-white p-4 text-label text-muted">Thanks. Your plan starts as soon as the payment is confirmed; this page updates in a few seconds.</p>}

      {sub && (
        <section className="rounded-card border border-brand bg-white p-5">
          <p className="text-caption font-semibold uppercase text-muted">Your plan</p>
          <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lead font-extrabold text-ink">{sub.terms.name}</h2>
            <span className="font-bold tabular-nums">{formatMoney(sub.terms.monthlyPrice, sub.terms.currency)} / month</span>
          </div>
          {data?.usage && (
            <div className="mt-4">
              <div className="flex justify-between text-label"><span className="text-muted">Discounted rides this week</span><span className="font-semibold tabular-nums">{data.usage.used} of {data.usage.cap}</span></div>
              <div className="mt-2 h-2 rounded-full bg-surface-2"><div className="h-2 rounded-full bg-brand-deep" style={{ width: `${Math.min(100, (data.usage.used / data.usage.cap) * 100)}%` }} /></div>
              <p className="mt-2 text-caption text-muted">Rides past the weekly limit are charged the normal fare. The count starts again every Monday.</p>
            </div>
          )}
          {sub.currentPeriodEnd && (
            <p className="mt-4 text-label text-muted">{sub.cancelAtPeriodEnd ? `Ends on ${formatDate(sub.currentPeriodEnd)}. You keep the discount until then.` : `Renews on ${formatDate(sub.currentPeriodEnd)}.`}</p>
          )}
          <div className="mt-4">
            {sub.cancelAtPeriodEnd
              ? <Button variant="secondary" onClick={() => void toggleRenewal(false)} disabled={busy === 'renewal'}>{busy === 'renewal' ? 'Saving...' : 'Keep my plan'}</Button>
              : <Button variant="ghost" onClick={() => void toggleRenewal(true)} disabled={busy === 'renewal'}>{busy === 'renewal' ? 'Saving...' : 'Cancel plan'}</Button>}
          </div>
        </section>
      )}

      {data?.enabled && !sub && (
        <ul className="grid gap-4 md:grid-cols-3">
          {(data.plans || []).map((plan) => (
            <li key={plan.id} className="flex flex-col rounded-card border border-line bg-white p-5">
              <h2 className="text-lead font-extrabold text-ink">{plan.name}</h2>
              <p className="mt-1"><span className="text-title font-extrabold tabular-nums">{formatMoney(plan.monthlyPrice, plan.currency)}</span><span className="text-label text-muted"> / month</span></p>
              <ul className="mt-4 flex-1 space-y-2 text-label">
                {perks(plan).map((perk) => <li key={perk} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-brand-deep" />{perk}</li>)}
              </ul>
              <Button className="mt-5" fullWidth onClick={() => void join(plan.id)} disabled={!!busy}>{busy === plan.id ? 'Opening...' : 'Choose plan'}</Button>
            </li>
          ))}
        </ul>
      )}
      {data?.enabled && !sub && <p className="text-caption text-muted">Billed monthly by Stripe. Cancel any time; the discount lasts to the end of the month you paid for. Drivers are always paid their full share.</p>}
      {error && <p role="alert" className="text-label text-danger">{error}</p>}
    </div>
  );
};
