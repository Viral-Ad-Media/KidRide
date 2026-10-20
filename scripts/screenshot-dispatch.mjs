// Nearest-driver dispatch check (screenshots 80-85). Three approved drivers go
// Online at different simulated positions; a parent books from 10 Downing St.
// The nearest driver gets the offer first (with a countdown), declines, the next
// nearest gets it and lets it expire, then the ride opens to every driver and
// the far driver accepts. Cancels the test ride at the end.
//
// Usage (PowerShell, from the KidRide folder):
//   $env:KIDRIDE_TEST_EMAIL / KIDRIDE_TEST_PASSWORD   parent with a child
//   $env:KIDRIDE_DRIVERS = 'near@x,mid@x,far@x'        three approved drivers
//   $env:KIDRIDE_DRIVER_PASSWORD                       their (shared) password
//   node scripts/screenshot-dispatch.mjs
import { chromium, request as apiRequest } from 'playwright';
import { mkdir, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const baseUrl = process.env.KIDRIDE_URL || 'http://localhost:3001';
const apiUrl = process.env.KIDRIDE_API_URL || 'http://localhost:5000/api';
const outDir = process.env.KIDRIDE_SCREENSHOT_DIR
  || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'test-screenshots');
const parent = { email: process.env.KIDRIDE_TEST_EMAIL, password: process.env.KIDRIDE_TEST_PASSWORD };
const driverEmails = (process.env.KIDRIDE_DRIVERS || '').split(',').map((s) => s.trim()).filter(Boolean);
const driverPassword = process.env.KIDRIDE_DRIVER_PASSWORD;
if (!parent.email || !parent.password || driverEmails.length !== 3 || !driverPassword) {
  console.error('Set KIDRIDE_TEST_EMAIL/PASSWORD, KIDRIDE_DRIVERS (three emails, nearest first) and KIDRIDE_DRIVER_PASSWORD.');
  process.exit(1);
}

await mkdir(outDir, { recursive: true });
for (const f of await readdir(outDir)) if (/^8[0-9]-.*\.png$/.test(f)) await unlink(path.join(outDir, f));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const issues = [];
const steps = [];
const api = await apiRequest.newContext({ baseURL: `${apiUrl}/`, timeout: 90000 });
const token = async (email, password) => (await (await api.post('auth/login', { data: { email, password } })).json()).token;
const authed = (t, data) => ({ headers: { Authorization: `Bearer ${t}` }, ...(data ? { data } : {}) });

const pickupCoords = { lat: 51.50334, lng: -0.12757 };
const positions = [
  { latitude: 51.5050, longitude: -0.1282 }, // ~200 m: nearest
  { latitude: 51.5110, longitude: -0.1330 }, // ~1 km
  { latitude: 51.5560, longitude: -0.2200 } // ~9 km: outside the search rings
];

const browser = await chromium.launch();
const openDriver = async (email, position, label) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['geolocation'], geolocation: position });
  const page = await context.newPage();
  page.setDefaultTimeout(90000);
  page.setDefaultNavigationTimeout(90000);
  page.on('pageerror', (e) => issues.push(`[${label}] page error: ${e.message}`));
  await page.goto(`${baseUrl}/#/login`);
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('Enter your password').fill(driverPassword);
  await page.click('button[type="submit"]');
  await page.waitForURL(/#\/driver-dashboard/);
  if (await page.getByText('Go online to receive trip requests').count()) await page.locator('label:has(input[type=checkbox])').first().click();
  return page;
};
const shoot = async (page, name) => { await sleep(700); await page.screenshot({ path: path.join(outDir, `${name}.png`), timeout: 90000 }); console.log(`saved ${name}.png`); };
const hasOffer = async (page) => (await page.getByRole('button', { name: 'Accept Ride' }).count()) > 0;
const waitOffer = async (page, timeout = 30000) => page.getByRole('button', { name: 'Accept Ride' }).waitFor({ timeout });

let rideId = null, pt = null;
try {
  pt = await token(parent.email, parent.password);
  const driverTokens = await Promise.all(driverEmails.map((e) => token(e, driverPassword)));
  for (const t of [pt, ...driverTokens]) { const a = await (await api.get('rides/active', authed(t))).json(); if (a?.id) await api.put(`rides/${a.id}/cancel`, authed(t)); }

  const [near, mid, far] = await Promise.all(driverEmails.map((e, i) => openDriver(e, positions[i], ['near', 'mid', 'far'][i])));
  await sleep(13000); // at least one presence heartbeat with a position from each driver

  // ---- Parent books from 10 Downing St (with coordinates, as Places provides them)
  const kids = await (await api.get('users/children', authed(pt))).json();
  const quote = await (await api.post('rides/quote', authed(pt, { serviceType: 'pickup_and_dropoff' }))).json();
  const ride = await (await api.post('rides/request', authed(pt, { childId: kids[0].id, pickup: '10 Downing St, London SW1A 2AA, UK', dropoff: '40 Princess Rd, London NW1 8JS, UK', pickupCoords, dropoffCoords: { lat: 51.53959, lng: -0.15145 }, serviceType: 'pickup_and_dropoff', quotedPrice: quote.price, pickupTime: new Date().toISOString() }))).json();
  rideId = ride.id;
  steps.push(`booked: dispatchState=${ride.dispatchState}`);

  await waitOffer(near);
  await near.getByText(/s to accept/).waitFor();
  steps.push(`nearest driver has the offer; mid sees it: ${await hasOffer(mid)}; far sees it: ${await hasOffer(far)}`);
  await shoot(near, '80-nearest-driver-offer-countdown');
  await shoot(mid, '81-second-driver-not-offered-yet');

  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  p.setDefaultTimeout(90000);
  await p.goto(`${baseUrl}/#/login`);
  await p.getByPlaceholder('you@example.com').fill(parent.email);
  await p.getByPlaceholder('Enter your password').fill(parent.password);
  await p.click('button[type="submit"]');
  await p.waitForURL(/#\/dashboard/);
  await p.goto(`${baseUrl}/#/tracking/${rideId}`);
  await p.getByText('Finding a driver near you').waitFor();
  await p.getByText(/drivers? nearby|No drivers nearby/).waitFor();
  steps.push(`parent sees: ${await p.getByText(/drivers? nearby|No drivers nearby/).first().innerText()}`);
  await shoot(p, '82-parent-finding-driver-nearby');

  // ---- Nearest declines; the next nearest gets it
  await near.getByRole('button', { name: 'Decline' }).click();
  await waitOffer(mid);
  steps.push(`after decline the second driver has the offer: ${await hasOffer(mid)}; far sees it: ${await hasOffer(far)}`);
  await shoot(mid, '83-second-driver-offer-after-decline');

  // ---- Second driver lets it expire; nobody else near, so it opens to everyone
  const t0 = Date.now();
  await waitOffer(far, 60000);
  steps.push(`opened to all after ${Math.round((Date.now() - t0) / 1000)}s; far driver sees it without a countdown: ${(await far.getByText(/s to accept/).count()) === 0}`);
  await shoot(far, '84-far-driver-open-pool-offer');
  await far.getByRole('button', { name: 'Accept Ride' }).click();
  await far.getByRole('button', { name: 'Arrived at Pickup' }).waitFor();
  await p.reload();
  await p.getByText(/DRIVER ASSIGNED|Driver assigned/i).first().waitFor();
  await shoot(p, '85-parent-driver-assigned');
  const finalRide = await (await api.get(`rides/${rideId}`, authed(pt))).json();
  steps.push(`final: status=${finalRide.status} dispatchState=${finalRide.dispatchState}`);
} catch (err) {
  issues.push(`FLOW FAILED: ${err.message.split('\n')[0]}`);
  let i = 0;
  for (const context of browser.contexts()) for (const pg of context.pages()) await pg.screenshot({ path: path.join(outDir, `89-failure-${++i}.png`) }).catch(() => {});
} finally {
  if (rideId && pt) await api.put(`rides/${rideId}/cancel`, authed(pt)).catch(() => {});
  await browser.close();
  await api.dispose();
}
console.log(steps.join('\n'));
console.log(issues.length ? `ISSUES:\n${issues.join('\n')}` : 'No page errors.');
process.exitCode = issues.some((i) => i.startsWith('FLOW FAILED')) ? 1 : 0;
