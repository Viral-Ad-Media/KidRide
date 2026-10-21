import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppNotification } from '../types';
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '../services/notifications';
import { useAuth } from './AuthContext';

// Keeps the bell count and the inbox current: polled every POLL_MS while
// signed in, refreshed when the tab comes back into view, and refreshed by
// the pages that change rides.

const POLL_MS = 30000;

interface NotificationsValue {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markAllRead: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsValue | null>(null);

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isHydrating } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const session = useRef(0);

  const refresh = useCallback(async () => {
    if (!user) return;
    const current = session.current;
    try {
      const result = await fetchNotifications();
      if (current !== session.current) return;
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
    setNotifications([]);
    setUnreadCount(0);
    if (!user || isHydrating) return;
    setLoading(true);
    void refresh();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { session.current += 1; clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
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

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, loading, refresh, markAllRead, markRead }}>
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => {
  const value = useContext(NotificationsContext);
  if (!value) throw new Error('useNotifications must be used within NotificationsProvider');
  return value;
};
