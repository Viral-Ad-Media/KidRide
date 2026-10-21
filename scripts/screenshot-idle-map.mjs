// Driver idle map check (screenshots 100-*). An approved driver goes online at a
// simulated position near 10 Downing St and sees the idle map. A parent books a
// ride there; the driver (nearest, so it is offered to them first) declines it,
// and with nobody else near it opens to everyone. Back on the idle map the ride
// shows as an amber pin; the driver taps it, sees the trip card and accepts.
// A second driver with location blocked sees the "allow location" card.
// Cancels the test ride at the end.
//
// Usage (PowerShell, from the KidRide folder):
//   $env:KIDRIDE_TEST_EMAIL / KIDRIDE_TEST_PASSWORD   parent with a child
//   $env:KIDRIDE_DRIVERS = 'a@x,b@x'                   two approved drivers
//   $env:KIDRIDE_DRIVER_PASSWORD                       their (shared) password
//   node scripts/screenshot-idle-map.mjs
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
if (!parent.email || !parent.password || driverEmails.length !== 2 || !driverPassword) {
  console.error('Set KIDRIDE_TEST_EMAIL/PASSWORD, KIDRIDE_DRIVERS (two emails) and KIDRIDE_DRIVER_PASSWORD.');
  process.exit(1);
}

await mkdir(outDir, { recursive: true });
for (const f of await readdir(outDir)) if (/^10[0-9]-idle-map-.*\.png$/.test(f)) await unlink(path.join(outDir, f));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const issues = [];
const steps = [];
const api = await apiRequest.newContext({ baseURL: `${apiUrl}/`, timeout: 90000 });
const token = async (email, password) => (await (await api.post('auth/login', { data: { email, password } })).json()).token;
const authed = (t, data) => ({ headers: { Authorization: `Bearer ${t}` }, ...(data ? { data } : {}) });

const pickupCoords = { lat: 51.50334, lng: -0.12757 };
const start = { latitude: 51.5050, longitude: -0.1282 }; // ~200 m from the pickup

const browser = await chromium.launch();
const openDriver = async (email, label, { geolocation, viewport = { width: 1280, height: 900 } } = {}) => {
  const context = await browser.newContext({ viewport, ...(geolocation ? { permissions: ['geolocation'], geolocation } : {}) });
  const page = await context.newPage();
  page.setDefaultTimeout(90000);
  page.setDefaultNavigationTimeout(90000);
  page.on('pageerror', (e) => issues.push(`[${label}] page error: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') issues.push(`[${label}] console: ${m.text().split('\n')[0]}`); });
  await page.goto(`${baseUrl}/#/login`);
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('Enter your password').fill(driverPassword);
  await page.click('button[type="submit"]');
  await page.waitForURL(/#\/driver-dashboard/);
  if (await page.getByText('Go online to receive trip requests').count()) await page.locator('label:has(input[type=checkbox])').first().click();
  return { page, context };
};
const shoot = async (page, name, locator) => {
  await sleep(1200);
  if (locator) await locator.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(outDir, `${name}.png`), timeout: 90000 });
  console.log(`saved ${name}.png`);
};
const mapBox = (page) => page.locator('[aria-label="Map of rides near you"]');
// Clicks the amber pin: Google draws markers into the map pane, so find the one titled with the pickup.
const clickPin = async (page) => page.locator('[aria-label="Map of rides near you"] [title^="Pickup: 10 Downing"]').first().click();

let rideId = null, pt = null;
try {
  pt = await token(parent.email, parent.password);
  const driverTokens = await Promise.all(driverEmails.map((e) => token(e, driverPassword)));
  for (const t of [pt, ...driverTokens]) { const a = await (await api.get('rides/active', authed(t))).json(); if (a?.id) await api.put(`rides/${a.id}/cancel`, authed(t)); }

  // ---- 1. Online, nothing waiting: map centred on the driver's car
  const { page: d, context: dc } = await openDriver(driverEmails[0], 'driver', { geolocation: start });
  await d.getByText('Scanning the area').waitFor();
  await mapBox(d).locator('.gm-style').waitFor();
  await d.getByText(/waiting within 5 km/).waitFor();
  steps.push(`idle map shown; badge: ${await d.getByText(/waiting within 5 km/).innerText()}`);
  await shoot(d, '100-idle-map-1-online-no-rides', mapBox(d));

  // Car moves: the marker glides to the new fix.
  await dc.setGeolocation({ latitude: 51.5046, longitude: -0.1279 });
  await sleep(14000); // presence heartbeat with the new position, and a nearby-rides poll

  // ---- 2. Parent books near the driver; the driver is offered it first and declines
  const kids = await (await api.get('users/children', authed(pt))).json();
  const quote = await (await api.post('rides/quote', authed(pt, { serviceType: 'pickup_and_dropoff' }))).json();
  const ride = await (await api.post('rides/request', authed(pt, { childId: kids[0].id, pickup: '10 Downing St, London SW1A 2AA, UK', dropoff: '40 Princess Rd, London NW1 8JS, UK', pickupCoords, dropoffCoords: { lat: 51.53959, lng: -0.15145 }, serviceType: 'pickup_and_dropoff', quotedPrice: quote.price, pickupTime: new Date().toISOString() }))).json();
  rideId = ride.id;
  steps.push(`booked: dispatchState=${ride.dispatchState}`);
  await d.getByRole('button', { name: 'Accept Ride' }).waitFor({ timeout: 30000 });
  await d.getByRole('button', { name: 'Decline' }).click();

  // ---- 3. Back to idle: the declined ride is an amber pin within 5 km
  await d.getByText('Scanning the area').waitFor();
  await d.getByText('1 waiting within 5 km').waitFor({ timeout: 40000 });
  steps.push('after declining, the ride shows as 1 waiting within 5 km');
  await shoot(d, '101-idle-map-2-waiting-ride-pin', mapBox(d));

  // ---- 4. Tap the pin: trip card with price and Accept
  await clickPin(d);
  const card = d.getByRole('dialog', { name: 'Waiting ride' });
  await card.waitFor();
  steps.push(`card: ${(await card.innerText()).replace(/\s+/g, ' ')}`);
  await shoot(d, '102-idle-map-3-ride-card', mapBox(d));

  // ---- 5. Accept from the card: the existing accept flow assigns the ride
  await card.getByRole('button', { name: 'Accept Ride' }).click();
  await d.getByRole('button', { name: 'Arrived at Pickup' }).waitFor();
  const accepted = await (await api.get(`rides/${rideId}`, authed(pt))).json();
  steps.push(`accepted from the map: status=${accepted.status}`);
  await shoot(d, '103-idle-map-4-accepted-trip');

  // ---- 6. Location blocked: card asking to allow it, no map
  const { page: blocked } = await openDriver(driverEmails[1], 'blocked-driver');
  await blocked.getByText('Allow location to see rides near you').waitFor({ timeout: 40000 });
  steps.push(`location blocked: map shown=${(await mapBox(blocked).count()) > 0}`);
  await shoot(blocked, '104-idle-map-5-location-blocked', blocked.getByText('Allow location to see rides near you'));

  // ---- 7. Phone width
  await api.put(`rides/${rideId}/cancel`, authed(pt));
  rideId = null;
  const { page: phone } = await openDriver(driverEmails[0], 'phone', { geolocation: start, viewport: { width: 390, height: 844 } });
  await mapBox(phone).locator('.gm-style').waitFor();
  await shoot(phone, '105-idle-map-6-phone', mapBox(phone));
} catch (err) {
  issues.push(`FLOW FAILED: ${err.message.split('\n')[0]}`);
  let i = 0;
  for (const context of browser.contexts()) for (const pg of context.pages()) await pg.screenshot({ path: path.join(outDir, `109-idle-map-failure-${++i}.png`) }).catch(() => {});
} finally {
  if (rideId && pt) await api.put(`rides/${rideId}/cancel`, authed(pt)).catch(() => {});
  await browser.close();
  await api.dispose();
}
console.log(steps.join('\n'));
console.log(issues.length ? `ISSUES:\n${issues.join('\n')}` : 'No page or console errors.');
process.exitCode = issues.some((i) => i.startsWith('FLOW FAILED')) ? 1 : 0;
