import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellRing, ShieldAlert, Star, X } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationsContext';
import { useAuth } from '../contexts/AuthContext';
import { AppNotification, UserRole } from '../types';
import { pushPermission, pushSupport, turnPushOn, fetchPushConfig } from '../services/push';

// In-app alerts: a banner slides in at the top when a new ride update arrives
// while KidRide is open (like Uber's in-app heads-up). Safety alerts are red,
// buzz the phone and stay until dismissed; others go away after 7 seconds.

export const URGENT_KINDS = new Set(['sos', 'trip_code', 'off_route', 'stalled', 'rating_low']);
const SAFETY_KINDS = new Set(['sos', 'trip_code', 'off_route', 'stalled']);

/** Where an alert or inbox item takes this user. */
export const notificationLink = (item: Pick<AppNotification, 'kind' | 'rideId'>, role?: UserRole) => {
  if (role === UserRole.ADMIN) return SAFETY_KINDS.has(item.kind) ? '/admin/safety' : item.kind === 'rating_low' ? '/admin/drivers' : '/admin/rides';
  if (role === UserRole.DRIVER && ['completed', 'cancelled', 'no_show', 'compliment'].includes(item.kind)) return '/driver-dashboard';
  if (role === UserRole.PARENT && item.kind === 'completed' && item.rideId) return `/rides?tab=past&rate=${item.rideId}`;
  return item.rideId ? `/tracking/${item.rideId}` : '/notifications';
};

const Banner: React.FC<{ item: AppNotification; onOpen: () => void; onClose: () => void }> = ({ item, onOpen, onClose }) => {
  const urgent = URGENT_KINDS.has(item.kind);
  useEffect(() => {
    if (urgent) { navigator.vibrate?.([300, 100, 300]); return undefined; }
    const timer = setTimeout(onClose, 7000);
    return () => clearTimeout(timer);
  }, [item.id]);
  const Icon = urgent ? ShieldAlert : item.kind === 'compliment' ? Star : Bell;
  return (
    <div role={urgent ? 'alert' : 'status'} className={`pointer-events-auto flex w-full items-start gap-3 rounded-card p-4 shadow-xl ring-1 animate-fade-in ${urgent ? 'bg-danger text-white ring-danger' : 'bg-ink text-white ring-ink'}`}>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${urgent ? 'bg-white/20' : 'bg-brand text-ink'}`}><Icon size={18} /></span>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <span className="block text-label font-bold">{item.title}</span>
        <span className="mt-0.5 block text-caption text-white/80 line-clamp-2">{item.body}</span>
      </button>
      <button type="button" onClick={onClose} aria-label="Dismiss" className="rounded-full p-1 text-white/70 hover:text-white"><X size={16} /></button>
    </div>
  );
};

export const AlertBanners: React.FC = () => {
  const { alerts, dismissAlert, markRead } = useNotifications();
  const { user } = useAuth();
  const navigate = useNavigate();
  if (!alerts.length) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] mx-auto flex w-full max-w-md flex-col gap-2 px-4">
      {alerts.map((item) => (
        <Banner key={item.id} item={item} onClose={() => dismissAlert(item.id)} onOpen={() => { dismissAlert(item.id); void markRead(item.id); navigate(notificationLink(item, user?.role)); }} />
      ))}
    </div>
  );
};

const PROMPT_KEY = 'kidride_push_prompt_dismissed';

/** A one-time card asking to turn on alerts (shown on the home screens). */
export const PushPrompt: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let dismissed = false;
    try { dismissed = localStorage.getItem(PROMPT_KEY) === '1'; } catch { /* storage blocked */ }
    if (dismissed || pushSupport() !== 'supported' || pushPermission() !== 'default') return;
    fetchPushConfig().then((config) => setVisible(config.enabled)).catch(() => undefined);
  }, []);
  const hide = () => { setVisible(false); try { localStorage.setItem(PROMPT_KEY, '1'); } catch { /* storage blocked */ } };
  if (!visible) return null;
  const enable = async () => {
    setBusy(true); setError(null);
    try { await turnPushOn(); hide(); } catch (err) { setError(err instanceof Error ? err.message : 'Could not turn alerts on.'); } finally { setBusy(false); }
  };
  return (
    <div className={`flex items-start gap-3 rounded-card border border-line bg-white p-4 ${className}`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand-deep"><BellRing size={20} /></span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Get ride alerts on this device</p>
        <p className="text-label text-muted">Know the moment a driver accepts, arrives and drops off, even when KidRide is closed.</p>
        {error && <p className="mt-2 text-label text-danger">{error}</p>}
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => void enable()} disabled={busy} className="rounded-full bg-brand px-4 py-2 text-label font-semibold text-ink disabled:opacity-60">{busy ? 'Turning on...' : 'Turn on alerts'}</button>
          <button type="button" onClick={hide} className="rounded-full px-4 py-2 text-label font-semibold text-muted">Not now</button>
        </div>
      </div>
    </div>
  );
};
