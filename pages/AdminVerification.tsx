import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';
import { AdminTabs } from './Admin';
import { Button, Modal } from '../components/UIComponents';
import { fetchManagedUsers, ManagedUser } from '../services/adminApi';
import { CHECK_LABELS, CheckKind, DriverCheck, fetchAdminCheck, fetchAdminChecks, fetchRules, requestChecks, reviewCheck } from '../services/driverChecks';

// Admin console: driver verification queue (face checks and live photos to
// review next to the driver's reference photos), manual re-check requests, and
// the rules that trigger re-verification automatically.

type Filter = 'submitted' | 'open' | 'all';
const FILTERS: { key: Filter; label: string }[] = [{ key: 'submitted', label: 'To review' }, { key: 'open', label: 'Open' }, { key: 'all', label: 'All' }];
const KINDS: CheckKind[] = ['liveness', 'identity', 'id_document', 'vehicle_photo', 'plate_photo', 'location_photo'];
const SLOT_LABELS: Record<string, string> = { neutral: 'Looking at camera', turn_left: 'Turned left', turn_right: 'Turned right', open_mouth: 'Mouth open', nod: 'Nod', blink: 'Blink', smile: 'Smile', photo: 'Photo', license: 'Licence (application)', photo_front: 'Car front (application)', first_face: 'First face check' };
const STATUS_STYLE: Record<string, string> = { pending: 'bg-warning/15 text-ink', submitted: 'bg-brand/20 text-ink', passed: 'bg-success/10 text-success', failed: 'bg-danger/10 text-danger', cancelled: 'bg-surface-2 text-muted' };

const detailLine = (check: DriverCheck) => {
  const d = check.details as Record<string, unknown>;
  const parts: string[] = [];
  if (d.method === 'manual') parts.push('Photos taken by hand (face tracking did not confirm)');
  if (d.method === 'detected') parts.push('Actions confirmed on device');
  if (typeof d.metersFromLastFix === 'number') parts.push(`${d.metersFromLastFix} m from the last GPS ping`);
  if (d.position && typeof d.position === 'object') { const p = d.position as { lat: number; lng: number }; parts.push(`at ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`); }
  if (typeof d.note === 'string') parts.push(`Note: ${d.note}`);
  if (typeof d.repeatCount === 'number') parts.push(`${d.repeatCount} times in the window`);
  return parts.join(' · ');
};

const Photos: React.FC<{ title: string; photos: Record<string, string | null> }> = ({ title, photos }) => (
  <div>
    <p className="mb-2 text-label font-semibold">{title}</p>
    {Object.keys(photos).length === 0 ? <p className="text-caption text-muted">None</p> : (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {Object.entries(photos).map(([slot, url]) => (
          <figure key={slot} className="overflow-hidden rounded-control border border-line bg-surface-2">
            {url ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={SLOT_LABELS[slot] || slot} className="aspect-square w-full object-cover" /></a> : <div className="aspect-square" />}
            <figcaption className="px-2 py-1 text-caption text-muted">{SLOT_LABELS[slot] || slot}</figcaption>
          </figure>
        ))}
      </div>
    )}
  </div>
);

const CheckReview: React.FC<{ id: string; onClose: () => void; onChanged: () => void }> = ({ id, onClose, onChanged }) => {
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof fetchAdminCheck>> | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { fetchAdminCheck(id).then(setDetail).catch((err) => setError(err instanceof Error ? err.message : 'Could not load the check.')); }, [id]);
  const decide = async (result: 'passed' | 'failed' | 'cancelled') => {
    if (result === 'failed' && !note.trim()) { setError('Add a note for the driver when failing a check.'); return; }
    setBusy(true); setError(null);
    try { await reviewCheck(id, result, note.trim() || undefined); onChanged(); onClose(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save.'); setBusy(false); }
  };
  const check = detail?.check;
  return (
    <Modal open onClose={busy ? undefined : onClose} labelledBy="check-title" maxWidth="max-w-3xl">
      <div className="max-h-[85vh] space-y-5 overflow-y-auto p-6">
        <div>
          <h2 id="check-title" className="text-title font-bold">{check ? CHECK_LABELS[check.kind] : 'Check'}{detail ? ` · ${detail.driver.name}` : ''}</h2>
          {check && <p className="text-label text-muted">{check.reasonLabel} · requested {new Date(check.createdAt).toLocaleString()}</p>}
          {check && detailLine(check) && <p className="mt-1 text-caption text-muted">{detailLine(check)}</p>}
          {detail && <p className="mt-1 text-caption text-muted">Plate {detail.driver.vehicle?.plate || 'unknown'} · {[detail.driver.vehicle?.color, detail.driver.vehicle?.make, detail.driver.vehicle?.model].filter(Boolean).join(' ')} · ID {detail.driver.identity_status}</p>}
        </div>
        {!detail && !error && <p className="flex items-center gap-2 text-label text-muted"><Loader2 size={16} className="animate-spin" />Loading...</p>}
        {detail && (
          <>
            <Photos title="Submitted" photos={detail.evidence} />
            <Photos title="Compare with" photos={detail.reference} />
            <p className="text-caption text-muted">Pass only if the face matches the licence and earlier photos, every prompt was done, and the car and plate match the registration.</p>
            {check && ['pending', 'submitted', 'failed'].includes(check.status) && (
              <>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} placeholder="Note (shown to the driver if failed)" className="w-full rounded-control border border-line p-3 text-label" />
                <div className="flex flex-wrap gap-2">
                  {check.status !== 'failed' && <Button onClick={() => void decide('passed')} disabled={busy}>Pass</Button>}
                  {check.status !== 'failed' && <Button variant="destructive" onClick={() => void decide('failed')} disabled={busy}>Fail</Button>}
                  <Button variant="secondary" onClick={() => void decide('cancelled')} disabled={busy}>Cancel check</Button>
                </div>
              </>
            )}
          </>
        )}
        {error && <p role="alert" className="text-label text-danger">{error}</p>}
        <Button variant="ghost" onClick={onClose} disabled={busy}>Close</Button>
      </div>
    </Modal>
  );
};

const RequestCheck: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [search, setSearch] = useState('');
  const [drivers, setDrivers] = useState<ManagedUser[]>([]);
  const [driverId, setDriverId] = useState('');
  const [kinds, setKinds] = useState<CheckKind[]>(['liveness']);
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => { fetchManagedUsers('driver', { search, pageSize: 10 }).then((page) => setDrivers(page.users)).catch(() => setDrivers([])); }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const send = async () => {
    setMsg(null);
    try { const { checks } = await requestChecks(driverId, kinds, note.trim() || undefined); setMsg(checks.length ? `Requested ${checks.length} check(s).` : 'Those checks are already open for this driver.'); onDone(); }
    catch (err) { setMsg(err instanceof Error ? err.message : 'Could not request the check.'); }
  };
  return (
    <section className="rounded-card border border-line bg-white p-5">
      <h2 className="text-title font-bold">Ask a driver to verify again</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search drivers by name or email" className="h-11 rounded-control border border-line px-3 text-label" />
        <select value={driverId} onChange={(e) => setDriverId(e.target.value)} className="h-11 rounded-control border border-line px-3 text-label">
          <option value="">Choose a driver</option>
          {drivers.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.email}</option>)}
        </select>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {KINDS.map((kind) => (
          <label key={kind} className={`cursor-pointer rounded-full px-3 py-1.5 text-caption font-semibold ring-1 ${kinds.includes(kind) ? 'bg-ink text-white ring-ink' : 'bg-white text-muted ring-line'}`}>
            <input type="checkbox" className="sr-only" checked={kinds.includes(kind)} onChange={() => setKinds((prev) => (prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind]))} />
            {CHECK_LABELS[kind]}
          </label>
        ))}
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Reason (optional)" className="mt-3 h-11 w-full rounded-control border border-line px-3 text-label" />
      <div className="mt-3 flex items-center gap-3">
        <Button onClick={() => void send()} disabled={!driverId || !kinds.length}>Request</Button>
        {msg && <p className="text-label text-muted">{msg}</p>}
      </div>
    </section>
  );
};

export const AdminVerification = () => {
  const [filter, setFilter] = useState<Filter>('submitted');
  const [checks, setChecks] = useState<DriverCheck[] | null>(null);
  const [rules, setRules] = useState<Awaited<ReturnType<typeof fetchRules>>['rules']>([]);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const load = useCallback(() => {
    setChecks(null);
    fetchAdminChecks(filter).then((r) => { setChecks(r.checks); setError(null); }).catch((err) => setError(err instanceof Error ? err.message : 'Could not load checks.'));
  }, [filter]);
  useEffect(load, [load]);
  useEffect(() => { fetchRules().then((r) => setRules(r.rules)).catch(() => undefined); }, []);

  return (
    <div>
      <AdminTabs />
      <div className="mb-5 flex flex-wrap gap-2" role="tablist">
        {FILTERS.map((f) => (
          <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${filter === f.key ? 'bg-brand text-ink' : 'bg-white text-muted ring-1 ring-line hover:bg-surface-2'}`}>{f.label}</button>
        ))}
      </div>
      {error && <p role="alert" className="mb-4 text-label text-danger">{error}</p>}
      {!checks && !error && <p className="flex items-center gap-2 text-label text-muted"><Loader2 size={16} className="animate-spin" />Loading checks...</p>}
      {checks && checks.length === 0 && <p className="text-label text-muted">Nothing here.</p>}
      {checks && checks.length > 0 && (
        <ul className="divide-y divide-line rounded-card border border-line bg-white">
          {checks.map((check) => (
            <li key={check.id}>
              <button type="button" onClick={() => setViewing(check.id)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-surface">
                <span className="min-w-[10rem] font-semibold">{check.driver?.name || 'Driver'}</span>
                <span className="text-label">{CHECK_LABELS[check.kind]}</span>
                <span className="flex-1 text-caption text-muted">{check.reasonLabel} · {new Date(check.createdAt).toLocaleString()}</span>
                {check.blocksDriving && <span className="flex items-center gap-1 text-caption font-semibold text-danger"><ShieldAlert size={14} />Offline</span>}
                <span className={`rounded-full px-3 py-1 text-caption font-semibold capitalize ${STATUS_STYLE[check.status]}`}>{check.status}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-8 space-y-8">
        <RequestCheck onDone={load} />
        {rules.length > 0 && (
          <section>
            <h2 className="mb-2 text-title font-bold">Automatic re-verification</h2>
            <p className="mb-3 text-label text-muted">What sends a driver back to verification. Thresholds for the ride alerts are on the Safety tab. A check never interrupts a ride in progress; it applies before the next one.</p>
            <div className="overflow-x-auto rounded-card border border-line bg-white">
              <table className="w-full text-left text-label">
                <thead className="bg-surface-2 text-caption text-muted"><tr><th className="px-4 py-2">When</th><th className="px-4 py-2">Driver must do</th><th className="px-4 py-2">If it happens again</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {rules.filter((r) => r.reason !== 'admin_request').map((rule) => (
                    <tr key={rule.reason}>
                      <td className="px-4 py-2">{rule.label}</td>
                      <td className="px-4 py-2">{rule.checks.length ? `${rule.checks.map((k) => CHECK_LABELS[k]).join(', ')}${rule.clears === 'submit' ? ' (back online once sent)' : ' (offline until reviewed)'}` : '-'}</td>
                      <td className="px-4 py-2">{rule.repeat ? `${rule.repeat.count}× in ${rule.repeat.days} days: ${rule.repeat.checks.map((k) => CHECK_LABELS[k]).join(', ')}` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
      {viewing && <CheckReview id={viewing} onClose={() => setViewing(null)} onChanged={load} />}
    </div>
  );
};
