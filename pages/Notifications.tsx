import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Car, CheckCircle2, KeyRound, MapPin, ShieldAlert, Star, UserCheck, XCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { notificationLink, PushPrompt } from '../components/AlertBanners';
import { useNotifications } from '../contexts/NotificationsContext';
import { AppNotification } from '../types';

// The inbox: every ride update for this account, newest first. Opening the
// page marks everything read; tapping one opens its ride.

const ICONS: Record<string, typeof Bell> = {
  booked: Car,
  driver_assigned: UserCheck,
  driver_arrived_at_pickup: MapPin,
  child_picked_up: Car,
  completed: CheckCircle2,
  cancelled: XCircle,
  no_show: XCircle,
  sos: ShieldAlert,
  off_route: ShieldAlert,
  stalled: ShieldAlert,
  trip_code: KeyRound,
  compliment: Star,
  rating_low: Star
};

const when = (iso: string) => {
  const date = new Date(iso);
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} h ago`;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

const groupLabel = (iso: string) => {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return 'Earlier';
};

export const Notifications = () => {
  const navigate = useNavigate();
  const { notifications, loading, markAllRead, refresh } = useNotifications();
  const { user } = useAuth();

  useEffect(() => { void refresh().then(() => markAllRead()); }, []);

  const open = (item: AppNotification) => {
    navigate(notificationLink(item, user?.role));
  };

  if (loading && notifications.length === 0) {
    return <p className="py-12 text-center text-sm text-muted">Loading...</p>;
  }

  if (notifications.length === 0) {
    return (
      <div className="mx-auto max-w-sm px-6 py-20 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand/15 text-brand-deep"><Bell size={28} strokeWidth={1.75} /></div>
        <h3 className="mt-5 text-title font-extrabold tracking-tight">You're all caught up</h3>
        <p className="mt-2 text-label text-muted">Updates about your rides will appear here as they happen.</p>
        <PushPrompt className="mt-8 text-left" />
      </div>
    );
  }

  const groups: { label: string; items: AppNotification[] }[] = [];
  for (const item of notifications) {
    const label = groupLabel(item.createdAt);
    const group = groups[groups.length - 1];
    if (group && group.label === label) group.items.push(item); else groups.push({ label, items: [item] });
  }

  return (
    // A plain list, the way Uber and Bolt do it: day headings, hairlines between
    // rows, an unread dot, no boxes around boxes.
    <div className="max-w-2xl">
      <PushPrompt className="mb-6" />
      {groups.map((group) => (
        <section key={group.label} className="mb-6">
          <h3 className="mb-1 text-sm font-semibold text-muted">{group.label}</h3>
          <ul className="divide-y divide-line rounded-card bg-white px-2 shadow-[0_1px_2px_rgba(20,33,61,0.06)]">
            {group.items.map((item) => {
              const Icon = ICONS[item.kind] || Bell;
              const unread = !item.readAt;
              return (
                <li key={item.id}>
                  <button type="button" onClick={() => open(item)} className="flex w-full items-start gap-4 px-2 py-4 text-left transition-colors hover:bg-surface/80 ">
                    <span className={`relative mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${['cancelled', 'no_show', 'sos', 'off_route', 'stalled', 'trip_code', 'rating_low'].includes(item.kind) ? 'bg-danger/10 text-danger' : item.kind === 'compliment' ? 'bg-accent/20 text-ink' : item.kind === 'completed' ? 'bg-success/10 text-success' : 'bg-brand/15 text-brand-deep'}`}>
                      <Icon size={22} strokeWidth={1.75} />
                      {unread && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-brand" aria-label="Unread" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className={`truncate text-body ${unread ? 'font-bold text-ink' : 'font-semibold text-ink'}`}>{item.title}</span>
                        <span className="shrink-0 text-caption text-muted tabular-nums">{when(item.createdAt)}</span>
                      </span>
                      <span className={`mt-0.5 block text-label ${unread ? 'text-ink' : 'text-muted'}`}>{item.body}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
};
