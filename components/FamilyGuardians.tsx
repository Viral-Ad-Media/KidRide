import React, { useCallback, useEffect, useState } from 'react';
import { Users, UserPlus, X } from 'lucide-react';
import { Button, Input } from './UIComponents';
import { useAuth } from '../contexts/AuthContext';
import { ApiError, apiRequest, getStoredToken } from '../services/api';
import { UserRole } from '../types';

// Profile section for parents: invite a second guardian who shares the
// children, rides, tracking and ride alerts; accept or decline an invite; leave.
interface GuardianLink { id: string; status: 'pending' | 'active'; email: string; name: string | null; relationship: string | null; invitedAt: string; acceptedAt: string | null }
interface FamilyInvite { id: string; fromName: string; fromEmail: string | null; relationship: string | null; invitedAt: string }
interface FamilyState {
  available: boolean;
  role: 'owner' | 'guardian';
  maxGuardians: number;
  owner: { linkId: string; name: string; email: string; since: string | null } | null;
  guardians: GuardianLink[];
  invites: FamilyInvite[];
}

const call = <T,>(path: string, method: 'GET' | 'POST' | 'DELETE' = 'GET', body?: Record<string, unknown>) =>
  apiRequest<T>(`/family${path}`, { method, body, token: getStoredToken() || undefined });
const messageOf = (error: unknown, fallback: string) => (error instanceof ApiError || error instanceof Error ? error.message : fallback);

export const FamilyGuardians = () => {
  const { user, refreshUser } = useAuth();
  const [family, setFamily] = useState<FamilyState | null>(null);
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setFamily(await call<FamilyState>('')); } catch (err) { setError(messageOf(err, 'Could not load your family.')); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (!user || user.role !== UserRole.PARENT || !family) return null;

  const run = async (key: string, action: () => Promise<unknown>, done?: string, refresh = false) => {
    setBusy(key); setError(null); setNotice(null);
    try {
      await action();
      if (refresh) await refreshUser();
      await load();
      if (done) setNotice(done);
    } catch (err) {
      setError(messageOf(err, 'Something went wrong. Please try again.'));
    } finally {
      setBusy(null); setConfirmRemove(null);
    }
  };

  const sendInvite = () => run('invite', async () => {
    const result = await call<{ emailed: boolean; hasAccount: boolean }>('/guardians', 'POST', { email: email.trim(), name: name.trim(), relationship: relationship.trim() });
    setInviting(false); setEmail(''); setName(''); setRelationship('');
    setNotice(result.hasAccount
      ? 'Invite sent. They will see it under Profile, Family and can accept there.'
      : 'Invite saved. Ask them to sign up as a parent with that email address; the invite will be waiting under Profile, Family.');
  });

  const card = 'rounded-card border border-line bg-white p-5';
  const heading = (
    <div className="flex items-center gap-2">
      <Users size={20} className="text-brand-deep" />
      <h3 className="text-lead font-bold">Family</h3>
    </div>
  );

  const invites = family.invites.length > 0 && (
    <div className="mt-4 space-y-3">
      {family.invites.map((invite) => (
        <div key={invite.id} className="rounded-xl border border-brand/30 bg-brand/5 p-4">
          <p className="font-semibold">{invite.fromName} invited you to be a second guardian</p>
          <p className="mt-1 text-sm text-muted">
            You will see their children, book and follow rides, and get the same ride alerts. While you are in their family, your own children and bookings are hidden.
          </p>
          <div className="mt-3 flex gap-3">
            <Button onClick={() => void run(`accept-${invite.id}`, () => call(`/invites/${invite.id}/accept`, 'POST'), `You joined ${invite.fromName}'s family.`, true)} disabled={!!busy}>
              {busy === `accept-${invite.id}` ? 'Joining...' : 'Accept'}
            </Button>
            <Button variant="secondary" onClick={() => void run(`decline-${invite.id}`, () => call(`/invites/${invite.id}/decline`, 'POST'), 'Invite declined.')} disabled={!!busy}>Decline</Button>
          </div>
        </div>
      ))}
    </div>
  );

  if (!family.available) {
    return (
      <div className={card}>
        {heading}
        <p className="mt-2 text-sm text-muted">Sharing your family with a second guardian is coming soon.</p>
      </div>
    );
  }

  if (family.role === 'guardian' && family.owner) {
    return (
      <div className={card}>
        {heading}
        <p className="mt-2 text-sm text-muted">
          You are a second guardian in <span className="font-semibold text-ink">{family.owner.name}</span>'s family. You share their children, rides and ride alerts.
        </p>
        {confirmRemove === 'leave' ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="text-sm">Leave this family? You will stop seeing their children and rides.</span>
            <Button variant="destructive" onClick={() => void run('leave', () => call('/leave', 'POST'), 'You left the family.', true)} disabled={!!busy}>{busy === 'leave' ? 'Leaving...' : 'Leave'}</Button>
            <Button variant="secondary" onClick={() => setConfirmRemove(null)}>Cancel</Button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmRemove('leave')} className="mt-3 text-sm font-semibold text-danger">Leave family</button>
        )}
        {notice && <p className="mt-3 text-sm text-muted">{notice}</p>}
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </div>
    );
  }

  const canInvite = family.guardians.length < family.maxGuardians;

  return (
    <div className={card}>
      {heading}
      <p className="mt-2 text-sm text-muted">
        Add a second guardian, such as a co-parent. They get their own login and share your children, rides, live tracking and ride alerts. You can remove them at any time.
      </p>

      {family.guardians.length > 0 && (
        <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
          {family.guardians.map((guardian) => (
            <li key={guardian.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{guardian.name || guardian.email}{guardian.relationship ? <span className="font-normal text-muted"> · {guardian.relationship}</span> : null}</p>
                <p className="truncate text-sm text-muted">{guardian.status === 'active' ? guardian.email : `Invite sent to ${guardian.email}`}</p>
              </div>
              {confirmRemove === guardian.id ? (
                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="destructive" onClick={() => void run(`remove-${guardian.id}`, () => call(`/guardians/${guardian.id}`, 'DELETE'), guardian.status === 'active' ? 'Guardian removed. Their access ended straight away.' : 'Invite withdrawn.')} disabled={!!busy}>
                    {busy === `remove-${guardian.id}` ? 'Removing...' : 'Remove'}
                  </Button>
                  <button type="button" aria-label="Keep" onClick={() => setConfirmRemove(null)} className="p-2 text-muted"><X size={18} /></button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmRemove(guardian.id)} className="shrink-0 text-sm font-semibold text-danger">
                  {guardian.status === 'active' ? 'Remove' : 'Withdraw'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canInvite && (inviting ? (
        <div className="mt-4 space-y-4">
          <Input label="Their email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <Input label="Their name (optional)" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
          <Input label="Relationship (optional)" value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder="Co-parent, grandparent, nanny" />
          <div className="flex gap-3">
            <Button onClick={() => void sendInvite()} disabled={!!busy || !email.trim()}>{busy === 'invite' ? 'Sending...' : 'Send invite'}</Button>
            <Button variant="secondary" onClick={() => setInviting(false)} disabled={!!busy}>Cancel</Button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => { setInviting(true); setNotice(null); }} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-brand-deep">
          <UserPlus size={16} /> Invite a second guardian
        </button>
      ))}

      {invites}
      {notice && <p className="mt-3 text-sm text-muted">{notice}</p>}
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </div>
  );
};
