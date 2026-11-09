/* KidRide service worker: shows ride alerts sent by the server (Web Push) and
   opens the right screen when one is tapped. It does not cache pages. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data && event.data.text() }; }
  const title = data.title || 'KidRide';
  const options = {
    body: data.body || 'You have a new ride update.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || undefined,
    renotify: !!data.tag,
    requireInteraction: !!data.urgent,
    vibrate: data.urgent ? [300, 100, 300, 100, 300] : [120],
    data: { url: data.url || '/#/notifications', kind: data.kind || 'general' }
  };
  event.waitUntil((async () => {
    // Tell open KidRide tabs so the bell and the page update at once.
    const tabs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    tabs.forEach((tab) => tab.postMessage({ type: 'kidride:push', kind: options.data.kind }));
    await self.registration.showNotification(title, options);
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/#/notifications', self.location.origin).href;
  event.waitUntil((async () => {
    const tabs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const tab = tabs.find((client) => new URL(client.url).origin === self.location.origin);
    if (tab) { await tab.focus(); return tab.navigate ? tab.navigate(target) : undefined; }
    return self.clients.openWindow(target);
  })());
});
