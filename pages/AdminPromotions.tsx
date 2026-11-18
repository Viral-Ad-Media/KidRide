import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { AdminTabs } from './Admin';
import { Button, ConfirmModal } from '../components/UIComponents';
import { apiRequest, getStoredToken } from '../services/api';
import { fetchManagedUsers } from '../services/adminApi';
import { formatMoney } from '../utils/rideData';

// Admin console: promo codes and seasonal offers. A promotion takes a
// percentage off the fare for every parent, for new parents or for chosen
// parents, between two dates, and can be switched on and off at any time.
// A discount comes out of KidRide's share: the driver is always paid in full.

type Audience = 'all' | 'new' | 'selected';
type Status = 'off' | 'scheduled' | 'live' | 'ended';

interface PromoUser { id: string; name: string; email: string }
interface Promotion {
  id: string;
  title: string;
  code: string | null;
  percentOff: number;
  maxDiscount: number | null;
  audience: Audience;
  users: PromoUser[];
  startsAt: string;
  endsAt: string | null;
  maxUsesPerUser: number | null;
  maxUsesTotal: number | null;
  active: boolean;
  status: Status;
  uses: number;
  saved: number;
}
interface ListResult { promotions: Promotion[]; unavailable?: boolean; limits: { minPercent: number; maxPercent: number } }

interface Draft {
  id: string | null;
  kind: 'offer' | 'code';
  title: string;
  code: string;
  percentOff: string;
  maxDiscount: string;
  audience: Audience;
  users: PromoUser[];
  startsOn: string;
  endsOn: string;
  maxUsesPerUser: string;
  maxUsesTotal: string;
  active: boolean;
}

const today = () => new Date().toISOString().slice(0, 10);
const dateOnly = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');
const blank = (): Draft => ({ id: null, kind: 'offer', title: '', code: '', percentOff: '10', maxDiscount: '', audience: 'all', users: [], startsOn: today(), endsOn: '', maxUsesPerUser: '', maxUsesTotal: '', active: true });
const toDraft = (promotion: Promotion): Draft => ({
  id: promotion.id,
  kind: promotion.code ? 'code' : 'offer',
  title: promotion.title,
  code: promotion.code || '',
  percentOff: String(promotion.percentOff),
  maxDiscount: promotion.maxDiscount === null ? '' : String(promotion.maxDiscount),
  audience: promotion.audience,
  users: promotion.users,
  startsOn: dateOnly(promotion.startsAt),
  endsOn: dateOnly(promotion.endsAt),
  maxUsesPerUser: promotion.maxUsesPerUser === null ? '' : String(promotion.maxUsesPerUser),
  maxUsesTotal: promotion.maxUsesTotal === null ? '' : String(promotion.maxUsesTotal),
  active: promotion.active
});
// A promotion starts at the beginning of its first day and runs to the end of its last (the admin's own time zone).
const toBody = (draft: Draft) => ({
  title: draft.title,
  code: draft.kind === 'code' ? draft.code : '',
  percentOff: Number(draft.percentOff),
  maxDiscount: draft.maxDiscount.trim() === '' ? null : Number(draft.maxDiscount),
  audience: draft.audience,
  userIds: draft.audience === 'selected' ? draft.users.map((user) => user.id) : [],
  startsAt: draft.startsOn ? new Date(`${draft.startsOn}T00:00:00`).toISOString() : null,
  endsAt: draft.endsOn ? new Date(`${draft.endsOn}T23:59:59`).toISOString() : null,
  maxUsesPerUser: draft.maxUsesPerUser.trim() === '' ? null : Number(draft.maxUsesPerUser),
  maxUsesTotal: draft.maxUsesTotal.trim() === '' ? null : Number(draft.maxUsesTotal),
  active: draft.active
});

const STATUS: Record<Status, { label: string; cls: string }> = {
  live: { label: 'Live', cls: 'bg-success-soft text-success' },
  scheduled: { label: 'Scheduled', cls: 'bg-brand-soft text-brand-deep' },
  ended: { label: 'Ended', cls: 'bg-surface-2 text-muted' },
  off: { label: 'Switched off', cls: 'bg-surface-2 text-muted' }
};
const AUDIENCE: Record<Audience, string> = { all: 'All parents', new: 'Parents with no completed ride yet', selected: 'Chosen parents' };
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const inputCls = 'w-full rounded-xl border border-line bg-white px-3 py-2 text-body focus:border-brand-deep focus:outline-none';

const Labelled: React.FC<{ label: string; hint?: string; wide?: boolean; children: React.ReactNode }> = ({ label, hint, wide, children }) => (
  <label className={`block ${wide ? 'sm:col-span-2' : ''}`}>
    <span className="text-label font-semibold">{label}</span>
    <span className="mt-1 block">{children}</span>
    {hint && <span className="mt-1 block text-caption text-muted">{hint}</span>}
  </label>
);

/** Search parents by name or email and add them to the promotion. */
const ParentPicker: React.FC<{ chosen: PromoUser[]; onChange: (users: PromoUser[]) => void }> = ({ chosen, onChange }) => {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<PromoUser[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const term = search.trim();
    if (term.length < 2) { setResults([]); return undefined; }
    let live = true;
    setBusy(true);
    const timer = setTimeout(() => {
      fetchManagedUsers('parent', { search: term, pageSize: 8 })
        .then((page) => { if (live) setResults(page.users.map((user) => ({ id: user.id, name: user.name, email: user.email }))); })
        .catch(() => { if (live) setResults([]); })
        .finally(() => { if (live) setBusy(false); });
    }, 250);
    return () => { live = false; clearTimeout(timer); };
  }, [search]);

  const add = (user: PromoUser) => { if (!chosen.some((item) => item.id === user.id)) onChange([...chosen, user]); };

  return (
    <div className="sm:col-span-2">
      <span className="text-label font-semibold">Parents this is for</span>
      <div className="mt-1 flex items-center gap-2 rounded-xl border border-line bg-white px-3">
        {busy ? <Loader2 size={16} className="animate-spin text-muted" /> : <Search size={16} className="text-muted" />}
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or email" aria-label="Search parents" className="w-full bg-transparent py-2 text-body focus:outline-none" />
      </div>
      {results.length > 0 && (
        <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-white">
          {results.map((user) => {
            const added = chosen.some((item) => item.id === user.id);
            return (
              <li key={user.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="min-w-0"><span className="block truncate text-label font-semibold">{user.name}</span><span className="block truncate text-caption text-muted">{user.email}</span></span>
                <button type="button" disabled={added} onClick={() => add(user)} className="shrink-0 rounded-full bg-surface-2 px-3 py-1 text-caption font-semibold disabled:opacity-50">{added ? 'Added' : 'Add'}</button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {chosen.length === 0 && <span className="text-caption text-muted">Nobody chosen yet.</span>}
        {chosen.map((user) => (
          <span key={user.id} className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-3 py-1 text-caption font-semibold text-brand-deep">
            {user.name}
            <button type="button" aria-label={`Remove ${user.name}`} onClick={() => onChange(chosen.filter((item) => item.id !== user.id))}><X size={12} /></button>
          </span>
        ))}
      </div>
    </div>
  );
};

export const AdminPromotions = () => {
  const [list, setList] = useState<ListResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Promotion | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const load = useCallback(() => apiRequest<ListResult>('/admin/promotions', { token: getStoredToken() })
    .then((result) => { setList(result); setError(null); })
    .catch((err) => setError(err instanceof Error ? err.message : 'Could not load promotions.')), []);
  useEffect(() => { void load(); }, [load]);

  const change = <K extends keyof Draft>(key: K, value: Draft[K]) => { setFormError(null); setDraft((prev) => (prev ? { ...prev, [key]: value } : prev)); };

  const save = async () => {
    if (!draft) return;
    setSaving(true); setFormError(null); setFlash(null);
    try {
      await apiRequest(draft.id ? `/admin/promotions/${draft.id}` : '/admin/promotions', { method: draft.id ? 'PUT' : 'POST', token: getStoredToken(), body: toBody(draft) });
      setFlash(draft.id ? 'Promotion saved.' : draft.active ? 'Promotion created and switched on.' : 'Promotion created. Switch it on when you are ready.');
      setDraft(null);
      await load();
    } catch (err) { setFormError(err instanceof Error ? err.message : 'Could not save this promotion.'); }
    finally { setSaving(false); }
  };

  const toggle = async (promotion: Promotion) => {
    setBusyId(promotion.id); setFlash(null); setError(null);
    try {
      await apiRequest(`/admin/promotions/${promotion.id}`, { method: 'PUT', token: getStoredToken(), body: { active: !promotion.active } });
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not change this promotion.'); }
    finally { setBusyId(null); }
  };

  const remove = async () => {
    if (!removing) return;
    setBusyId(removing.id); setRemoveError(null);
    try {
      await apiRequest(`/admin/promotions/${removing.id}`, { method: 'DELETE', token: getStoredToken() });
      setRemoving(null);
      setFlash('Promotion removed.');
      await load();
    } catch (err) { setRemoveError(err instanceof Error ? err.message : 'Could not remove this promotion.'); }
    finally { setBusyId(null); }
  };

  if (!list) {
    return (
      <div>
        <AdminTabs />
        {error ? <p role="alert" className="text-label text-danger">{error}</p> : <p className="flex items-center gap-2 text-label text-muted"><Loader2 size={16} className="animate-spin" /> Loading promotions...</p>}
      </div>
    );
  }

  const { minPercent, maxPercent } = list.limits;

  return (
    <div>
      <AdminTabs />
      <p className="mb-5 max-w-3xl text-label text-muted">
        Create a promo code for parents to type when booking, or a seasonal offer that comes off the fare on its own. Choose who it is for, when it runs and how often
        it can be used, and switch it on or off whenever you like. The discount comes out of KidRide's share of the fare, so the driver is always paid in full. A ride
        gets one discount: a parent on a monthly plan gets whichever is larger.
      </p>

      {list.unavailable && (
        <p role="alert" className="mb-5 max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-label text-amber-800">
          Promotions are not switched on yet: their database tables have not been created. Nothing can be saved until they are.
        </p>
      )}
      {error && <p role="alert" className="mb-4 text-label text-danger">{error}</p>}
      {flash && <p className="mb-4 text-label font-semibold text-success">{flash}</p>}

      {draft ? (
        <section className="max-w-3xl rounded-card border border-line bg-white p-5">
          <h2 className="text-lead font-extrabold tracking-tight">{draft.id ? 'Change promotion' : 'New promotion'}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <span className="text-label font-semibold">Kind</span>
              <div className="mt-1 flex flex-wrap gap-2">
                {([['offer', 'Seasonal offer (comes off on its own)'], ['code', 'Promo code (the parent types it)']] as const).map(([kind, label]) => (
                  <button key={kind} type="button" onClick={() => change('kind', kind)} aria-pressed={draft.kind === kind}
                    className={`rounded-full px-4 py-2 text-label font-semibold ${draft.kind === kind ? 'bg-ink text-white' : 'bg-surface-2 text-muted'}`}>{label}</button>
                ))}
              </div>
            </div>
            <Labelled label="Name parents see" hint='Shown on the fare, for example "Summer 10% off".' wide>
              <input value={draft.title} onChange={(event) => change('title', event.target.value)} maxLength={80} className={inputCls} />
            </Labelled>
            {draft.kind === 'code' && (
              <Labelled label="Code" hint="4 to 20 letters and numbers, no spaces. Capitals or not does not matter.">
                <input value={draft.code} onChange={(event) => change('code', event.target.value.toUpperCase())} maxLength={20} placeholder="SUMMER10" className={`${inputCls} uppercase tracking-widest`} />
              </Labelled>
            )}
            <Labelled label="Discount" hint={`Between ${minPercent}% and ${maxPercent}%.`}>
              <span className="flex items-center gap-2"><input value={draft.percentOff} onChange={(event) => change('percentOff', event.target.value)} inputMode="decimal" className={`${inputCls} tabular-nums`} /><span className="text-label text-muted">%</span></span>
            </Labelled>
            <Labelled label="Most off one ride" hint="Leave empty for no limit.">
              <input value={draft.maxDiscount} onChange={(event) => change('maxDiscount', event.target.value)} inputMode="decimal" placeholder="No limit" className={`${inputCls} tabular-nums`} />
            </Labelled>
            <Labelled label="Starts">
              <input type="date" value={draft.startsOn} onChange={(event) => change('startsOn', event.target.value)} className={inputCls} />
            </Labelled>
            <Labelled label="Ends" hint="Last day it applies. Leave empty to run until you switch it off.">
              <input type="date" value={draft.endsOn} min={draft.startsOn || undefined} onChange={(event) => change('endsOn', event.target.value)} className={inputCls} />
            </Labelled>
            <Labelled label="Who it is for" wide>
              <select value={draft.audience} onChange={(event) => change('audience', event.target.value as Audience)} className={inputCls}>
                {(Object.keys(AUDIENCE) as Audience[]).map((audience) => <option key={audience} value={audience}>{AUDIENCE[audience]}</option>)}
              </select>
            </Labelled>
            {draft.audience === 'selected' && <ParentPicker chosen={draft.users} onChange={(users) => change('users', users)} />}
            <Labelled label="Uses per parent" hint="Leave empty for no limit. Cancelled rides do not count.">
              <input value={draft.maxUsesPerUser} onChange={(event) => change('maxUsesPerUser', event.target.value)} inputMode="numeric" placeholder="No limit" className={`${inputCls} tabular-nums`} />
            </Labelled>
            <Labelled label="Uses in total" hint="Leave empty for no limit.">
              <input value={draft.maxUsesTotal} onChange={(event) => change('maxUsesTotal', event.target.value)} inputMode="numeric" placeholder="No limit" className={`${inputCls} tabular-nums`} />
            </Labelled>
            <label className="flex items-center gap-3 sm:col-span-2">
              <input type="checkbox" checked={draft.active} onChange={(event) => change('active', event.target.checked)} className="h-5 w-5 accent-[#0369A1]" />
              <span className="text-label font-semibold">Switched on</span>
              <span className="text-caption text-muted">Off: saved but not applied to any ride.</span>
            </label>
          </div>
          {formError && <p role="alert" className="mt-4 text-label text-danger">{formError}</p>}
          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={() => void save()} disabled={saving || list.unavailable} className="w-auto px-8">{saving ? 'Saving...' : draft.id ? 'Save changes' : 'Create promotion'}</Button>
            <Button variant="secondary" onClick={() => { setDraft(null); setFormError(null); }} disabled={saving} className="w-auto px-8">Cancel</Button>
          </div>
        </section>
      ) : (
        <Button onClick={() => { setDraft(blank()); setFlash(null); }} disabled={list.unavailable} className="w-auto px-8">New promotion</Button>
      )}

      <div className="mt-6 max-w-3xl space-y-4">
        {list.promotions.length === 0 && !draft && <p className="text-label text-muted">No promotions yet.</p>}
        {list.promotions.map((promotion) => (
          <section key={promotion.id} className="rounded-card border border-line bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lead font-extrabold tracking-tight">{promotion.title}</h2>
                <p className="mt-0.5 text-label text-muted">
                  {promotion.percentOff}% off{promotion.maxDiscount !== null ? `, up to ${formatMoney(promotion.maxDiscount)} a ride` : ''} ·{' '}
                  {promotion.code ? <>Code <strong className="tracking-widest text-ink">{promotion.code}</strong></> : 'Comes off on its own'}
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-caption font-bold ${STATUS[promotion.status].cls}`}>{STATUS[promotion.status].label}</span>
            </div>
            <dl className="mt-4 grid gap-x-6 gap-y-2 text-label sm:grid-cols-2">
              <div><dt className="text-caption text-muted">Runs</dt><dd>{day(promotion.startsAt)} to {promotion.endsAt ? day(promotion.endsAt) : 'until switched off'}</dd></div>
              <div><dt className="text-caption text-muted">For</dt><dd>{promotion.audience === 'selected' ? `${promotion.users.length} chosen ${promotion.users.length === 1 ? 'parent' : 'parents'}` : AUDIENCE[promotion.audience]}</dd></div>
              <div><dt className="text-caption text-muted">Limits</dt><dd>{promotion.maxUsesPerUser ? `${promotion.maxUsesPerUser} per parent` : 'No limit per parent'}{promotion.maxUsesTotal ? `, ${promotion.maxUsesTotal} in total` : ''}</dd></div>
              <div><dt className="text-caption text-muted">Used</dt><dd>{promotion.uses} {promotion.uses === 1 ? 'ride' : 'rides'}, {formatMoney(promotion.saved)} off in all</dd></div>
            </dl>
            {promotion.audience === 'selected' && promotion.users.length > 0 && (
              <p className="mt-3 text-caption text-muted">{promotion.users.map((user) => user.name).join(', ')}</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={busyId === promotion.id} onClick={() => void toggle(promotion)}
                className={`rounded-full px-4 py-2 text-label font-semibold disabled:opacity-50 ${promotion.active ? 'bg-surface-2 text-ink' : 'bg-ink text-white'}`}>
                {busyId === promotion.id ? 'Working...' : promotion.active ? 'Switch off' : 'Switch on'}
              </button>
              <button type="button" onClick={() => { setDraft(toDraft(promotion)); setFlash(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="rounded-full bg-surface-2 px-4 py-2 text-label font-semibold">Change</button>
              {promotion.uses === 0 && (
                <button type="button" onClick={() => { setRemoving(promotion); setRemoveError(null); }} className="rounded-full px-4 py-2 text-label font-semibold text-danger">Remove</button>
              )}
            </div>
          </section>
        ))}
      </div>

      <ConfirmModal
        open={!!removing}
        title="Remove this promotion?"
        body={removing ? `"${removing.title}" has not been used. It will be removed for good.` : ''}
        confirmLabel="Remove"
        tone="danger"
        busy={!!removing && busyId === removing.id}
        busyLabel="Removing..."
        error={removeError}
        onConfirm={() => void remove()}
        onClose={() => setRemoving(null)}
      />
    </div>
  );
};
