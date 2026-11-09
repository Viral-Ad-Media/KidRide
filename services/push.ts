import { apiRequest, getStoredToken } from './api';

// Browser push alerts (Web Push). The server holds the VAPID keys; this file
// registers the service worker, asks the browser for permission and sends the
// subscription to the backend. On iPhone and iPad it works only after
// "Add to Home Screen" (iOS 16.4+), which pushSupport() reports.

export type PushSupport = 'supported' | 'unsupported' | 'needs-home-screen';

const token = () => {
  const value = getStoredToken();
  if (!value) throw new Error('Not signed in');
  return value;
};

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export const pushSupport = (): PushSupport => {
  if (typeof window === 'undefined') return 'unsupported';
  const capable = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (isIos() && !isStandalone()) return 'needs-home-screen';
  return capable ? 'supported' : 'unsupported';
};

export const pushPermission = (): NotificationPermission | 'unsupported' => ('Notification' in window ? Notification.permission : 'unsupported');

let config: Promise<{ enabled: boolean; publicKey: string | null }> | null = null;
export const fetchPushConfig = () => {
  config ||= apiRequest<{ enabled: boolean; publicKey: string | null }>('/notifications/push/config', { token: token() }).catch((error) => { config = null; throw error; });
  return config;
};

const registration = async () => {
  const existing = await navigator.serviceWorker.getRegistration('/');
  return existing || navigator.serviceWorker.register('/sw.js', { scope: '/' });
};

const keyBytes = (base64: string) => {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
};

/** True when this browser is subscribed right now. */
export const isPushOn = async () => {
  if (pushSupport() !== 'supported' || pushPermission() !== 'granted') return false;
  const reg = await navigator.serviceWorker.getRegistration('/');
  return !!(await reg?.pushManager.getSubscription());
};

/** Asks for permission (must run from a tap), subscribes and saves it on the server. */
export const turnPushOn = async () => {
  if (pushSupport() !== 'supported') throw new Error('This browser cannot show KidRide alerts.');
  const { enabled, publicKey } = await fetchPushConfig();
  if (!enabled || !publicKey) throw new Error('Alerts are not switched on for KidRide yet.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Alerts are blocked. Allow notifications for this site in your browser settings, then try again.');
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const subscription = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
  await apiRequest('/notifications/push/subscribe', { method: 'POST', token: token(), body: { subscription: subscription.toJSON() } });
  return true;
};

export const turnPushOff = async () => {
  const reg = await navigator.serviceWorker.getRegistration('/');
  const subscription = await reg?.pushManager.getSubscription();
  if (!subscription) return;
  try { await apiRequest('/notifications/push/subscribe', { method: 'DELETE', token: token(), body: { endpoint: subscription.endpoint } }); } finally { await subscription.unsubscribe(); }
};

export const sendTestPush = () => apiRequest<{ sent: number }>('/notifications/push/test', { method: 'POST', token: token() });

/** Re-registers the worker on load so alerts keep working after an update. */
export const startPushWorker = () => {
  if (pushSupport() !== 'supported' || pushPermission() !== 'granted') return;
  void registration().catch(() => undefined);
};
