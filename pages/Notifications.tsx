import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Car, CheckCircle2, MapPin, UserCheck, XCircle } from 'lucide-react';
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
  cancelled: XCircle
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

  useEffect(() => { void refresh().then(() => markAllRead()); }, []);

  const open = (item: AppNotification) => {
    if (item.rideId) navigate(`/tracking/${item.rideId}`);
  };

  if (loading && notifications.length === 0) {
    return <p className="py-12 text-center text-sm text-muted">Loading...</p>;
  }

  if (notifications.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line bg-white px-6 py-14 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand/10 text-brand-deep"><Bell size={24} /></div>
        <h3 className="mt-4 text-lead font-bold">Nothing yet</h3>
        <p className="mt-1 text-sm text-muted">Ride updates will show up here as they happen.</p>
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
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.label}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{group.label}</h3>
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-white">
            {group.items.map((item) => {
              const Icon = ICONS[item.kind] || Bell;
              const unread = !item.readAt;
              return (
                <li key={item.id}>
                  <button type="button" onClick={() => open(item)} disabled={!item.rideId} className="flex w-full items-start gap-3 px-4 py-4 text-left hover:bg-surface disabled:cursor-default disabled:hover:bg-white">
                    <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${item.kind === 'cancelled' ? 'bg-danger/10 text-danger' : 'bg-brand/10 text-brand-deep'}`}><Icon size={20} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className={`truncate text-[15px] ${unread ? 'font-bold' : 'font-semibold'}`}>{item.title}</span>
                        {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-brand" aria-label="Unread" />}
                      </span>
                      <span className="mt-0.5 block text-sm text-muted">{item.body}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted tabular-nums">{when(item.createdAt)}</span>
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
