import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppNotification } from '../types';
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '../services/notifications';
import { useAuth } from './AuthContext';
import { startPushWorker } from '../services/push';

// Keeps the bell count and the inbox current: polled every POLL_MS while
// signed in, refreshed when the tab comes back into view, when a push alert
// arrives, and by the pages that change rides. New unread items that arrive
// while the app is open become `alerts` (the in-app banners).

const POLL_MS = 30000;

interface NotificationsValue {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markAllRead: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  alerts: AppNotification[];
  dismissAlert: (id: string) => void;
}

const NotificationsContext = createContext<NotificationsValue | null>(null);

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isHydrating } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const session = useRef(0);
  const [alerts, setAlerts] = useState<AppNotification[]>([]);
  // Ids already seen this session; null until the first load (no banners for old items).
  const seen = useRef<Set<string> | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    const current = session.current;
    try {
      const result = await fetchNotifications();
      if (current !== session.current) return;
      if (seen.current) {
        const fresh = result.notifications.filter((item) => !item.readAt && !seen.current!.has(item.id));
        if (fresh.length) setAlerts((list) => [...fresh.slice(0, 3), ...list].slice(0, 3));
      }
      seen.current = new Set([...(seen.current || []), ...result.notifications.map((item) => item.id)]);
      setNotifications(result.notifications);
      setUnreadCount(result.unreadCount);
    } catch {
      // Keep what we have; the next poll will try again.
    } finally {
      if (current === session.current) setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    session.current += 1;
    seen.current = null;
    setAlerts([]);
    setNotifications([]);
    setUnreadCount(0);
    if (!user || isHydrating) return;
    setLoading(true);
    void refresh();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    // The service worker posts a message when a push alert lands in an open tab.
    const onPush = (event: MessageEvent) => { if (event.data?.type === 'kidride:push') void refresh(); };
    navigator.serviceWorker?.addEventListener('message', onPush);
    startPushWorker();
    return () => { session.current += 1; clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); navigator.serviceWorker?.removeEventListener('message', onPush); };
  }, [user?.id, isHydrating, refresh]);

  const markAllRead = useCallback(async () => {
    if (!unreadCount) return;
    const readAt = new Date().toISOString();
    setNotifications((list) => list.map((item) => (item.readAt ? item : { ...item, readAt })));
    setUnreadCount(0);
    try { await markAllNotificationsRead(); } catch { /* the next poll corrects the count */ }
  }, [unreadCount]);

  const markRead = useCallback(async (id: string) => {
    const target = notifications.find((item) => item.id === id);
    if (!target || target.readAt) return;
    const readAt = new Date().toISOString();
    setNotifications((list) => list.map((item) => (item.id === id ? { ...item, readAt } : item)));
    setUnreadCount((count) => Math.max(0, count - 1));
    try { await markNotificationRead(id); } catch { /* the next poll corrects the count */ }
  }, [notifications]);

  const dismissAlert = useCallback((id: string) => setAlerts((list) => list.filter((item) => item.id !== id)), []);

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, loading, refresh, markAllRead, markRead, alerts, dismissAlert }}>
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => {
  const value = useContext(NotificationsContext);
  if (!value) throw new Error('useNotifications must be used within NotificationsProvider');
  return value;
};
