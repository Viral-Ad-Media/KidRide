import { AppNotification } from '../types';
import { apiRequest, getStoredToken } from './api';

// The signed-in user's notifications (GET /notifications and the read markers).

interface NotificationsResponse { notifications: AppNotification[]; unreadCount: number }

const withToken = () => {
  const token = getStoredToken();
  if (!token) throw new Error('Not signed in');
  return token;
};

export const fetchNotifications = (limit = 30) =>
  apiRequest<NotificationsResponse>(`/notifications?limit=${limit}`, { token: withToken() });

export const markAllNotificationsRead = () =>
  apiRequest<{ unreadCount: number }>('/notifications/read-all', { method: 'PUT', token: withToken() });

export const markNotificationRead = (id: string) =>
  apiRequest<{ updated: boolean }>(`/notifications/${id}/read`, { method: 'PUT', token: withToken() });
