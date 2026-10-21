// Branded map check (screenshots 130-*). A driver goes online (idle map with
// their car), a parent books nearby, the driver declines the offer so the ride
// shows as a pulsing amber pin, then taps it and accepts from the card. The
// driver's GPS is then simulated driving towards the pickup while the parent
// watches the tracking map (desktop and phone) and the admin watches the live
// map. Cancels the test ride at the end.
//
// Usage (PowerShell, from the KidRide folder):
//   $env:KIDRIDE_TEST_EMAIL / KIDRIDE_TEST_PASSWORD   parent with a child, no unfinished ride
//   $env:KIDRIDE_DRIVERS = 'driver@x'                  approved driver, no unfinished ride
//   $env:KIDRIDE_DRIVER_PASSWORD
//   $env:KIDRIDE_ADMIN_EMAIL / KIDRIDE_ADMIN_PASSWORD
//   node scripts/screenshot-branded-map.mjs
import { chromium, request as apiRequest } from 'playwright';
import { mkdir, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const baseUrl = process.env.KIDRIDE_URL || 'http://localhost:3001';
const apiUrl = process.env.KIDRIDE_API_URL || 'http://localhost:5000/api';
const outDir = process.env.KIDRIDE_SCREENSHOT_DIR
  || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'test-screenshots');
const parent = { email: process.env.KIDRIDE_TEST_EMAIL, password: process.env.KIDRIDE_TEST_PASSWORD };
const driver = { email: (process.env.KIDRIDE_DRIVERS || '').split(',')[0]?.trim(), password: process.env.KIDRIDE_DRIVER_PASSWORD };
const admin = { email: process.env.KIDRIDE_ADMIN_EMAIL, password: process.env.KIDRIDE_ADMIN_PASSWORD };
if (![parent.email, parent.password, driver.email, driver.password, admin.email, admin.password].every(Boolean)) {
  console.error('Set KIDRIDE_TEST_EMAIL/PASSWORD, KIDRIDE_DRIVERS, KIDRIDE_DRIVER_PASSWORD and KIDRIDE_ADMIN_EMAIL/PASSWORD.');
  process.exit(1);
}

await mkdir(outDir, { recursive: true });
for (const f of await readdir(outDir)) if (/^13[0-9]-branded-map-.*\.png$/.test(f)) await unlink(path.join(outDir, f));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const issues = [];
const steps = [];
const api = await apiRequest.newContext({ baseURL: `${apiUrl}/`, timeout: 90000 });
const token = async (email, password) => (await (await api.post('auth/login', { data: { email, password } })).json()).token;
const authed = (t, data) => ({ headers: { Authorization: `Bearer ${t}` }, ...(data ? { data } : {}) });

const pickupCoords = { lat: 51.50334, lng: -0.12757 };
const driverStart = { latitude: 51.5098, longitude: -0.1340 }; // ~800 m north-west of the pickup

const browser = await chromium.launch();
const open = async (label, account, landing, options = {}) => {
  const context = await browser.newContext({ viewport: options.viewport || { width: 1280, height: 900 }, ...(options.geolocation ? { permissions: ['geolocation'], geolocation: options.geolocation } : {}) });
  const page = await context.newPage();
  page.setDefaultTimeout(90000);
  page.setDefaultNavigationTimeout(90000);
  page.on('pageerror', (e) => issues.push(`[${label}] page error: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') issues.push(`[${label}] console: ${m.text().split('\n')[0]}`); });
  await page.goto(`${baseUrl}/#/login`);
  await page.getByPlaceholder('you@example.com').fill(account.email);
  await page.getByPlaceholder('Enter your password').fill(account.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(landing);
  return { page, context };
};
// The app may still be redirecting after login; navigate again if it bounced back.
const go = async (page, hash) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(`${baseUrl}/#${hash}`);
    await sleep(2500);
    if (new URL(page.url()).hash === `#${hash}`) return;
  }
  throw new Error(`could not open ${hash}`);
};
const shoot = async (page, name, locator) => {
  await sleep(1500);
  if (locator) await locator.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(outDir, `${name}.png`), timeout: 90000 });
  console.log(`saved ${name}.png`);
};

let rideId = null, pt = null;
try {
  pt = await token(parent.email, parent.password);
  const dt = await token(driver.email, driver.password);
  for (const t of [pt, dt]) { const a = await (await api.get('rides/active', authed(t))).json(); if (a?.id) await api.put(`rides/${a.id}/cancel`, authed(t)); }

  // ---- Driver online: branded idle map with their car
  const { page: d, context: dc } = await open('driver', driver, /#\/driver-dashboard/, { geolocation: driverStart });
  if (await d.getByText('Go online to receive trip requests').count()) await d.locator('label:has(input[type=checkbox])').first().click();
  const idleMap = d.locator('[aria-label="Map of rides near you"]');
  await idleMap.locator('.gm-style').waitFor();
  await sleep(13000); // presence heartbeat with position

  // ---- Parent books nearby; the driver declines, so it shows as a waiting pin
  const kids = await (await api.get('users/children', authed(pt))).json();
  const quote = await (await api.post('rides/quote', authed(pt, { serviceType: 'pickup_and_dropoff' }))).json();
  const ride = await (await api.post('rides/request', authed(pt, { childId: kids[0].id, pickup: '10 Downing St, London SW1A 2AA, UK', dropoff: '40 Princess Rd, London NW1 8JS, UK', pickupCoords, dropoffCoords: { lat: 51.53959, lng: -0.15145 }, serviceType: 'pickup_and_dropoff', quotedPrice: quote.price, pickupTime: new Date().toISOString() }))).json();
  rideId = ride.id;
  await d.getByRole('button', { name: 'Accept Ride' }).waitFor({ timeout: 30000 });
  await d.getByRole('button', { name: 'Decline' }).click();
  await d.getByText('1 waiting within 5 km').waitFor({ timeout: 40000 });
  await idleMap.locator('[title^="Pickup: 10 Downing"]').click();
  await d.getByRole('dialog', { name: 'Waiting ride' }).waitFor();
  steps.push('driver idle map: car, pulsing waiting pin and ride card shown');
  await shoot(d, '131-branded-map-driver-idle', idleMap);
  await d.getByRole('dialog', { name: 'Waiting ride' }).getByRole('button', { name: 'Accept Ride' }).click();
  await d.getByRole('button', { name: 'Arrived at Pickup' }).waitFor();
  await dc.close(); // from here the driver's GPS is simulated through the API

  // ---- Simulated drive towards the pickup
  const drive = async (lat, lng, heading) => {
    const res = await api.put(`rides/${rideId}/location`, authed(dt, { latitude: lat, longitude: lng, heading, speed: 8 }));
    if (!res.ok()) issues.push(`location update ${res.status()}`);
  };
  await drive(driverStart.latitude, driverStart.longitude, 135);
  const { page: p } = await open('parent', parent, /#\/dashboard/);
  await go(p, `/tracking/${rideId}`);
  const tripMap = p.locator('[aria-label="Trip map"]');
  await tripMap.locator('[title="Driver"]').waitFor({ timeout: 30000 });
  for (const [lat, lng, heading] of [[51.5085, -0.1322, 140], [51.5072, -0.1305, 145], [51.5060, -0.1290, 150]]) { await drive(lat, lng, heading); await sleep(3500); }
  await p.getByRole('status').getByText(/Driver arriving in|Driver on the way/).waitFor();
  steps.push(`tracking: status card says "${(await p.getByRole('status').innerText()).replace(/\s+/g, ' ')}"`);
  await shoot(p, '130-branded-map-tracking');

  const { page: m } = await open('phone', parent, /#\/dashboard/, { viewport: { width: 390, height: 844 } });
  await go(m, `/tracking/${rideId}`);
  await m.locator('[aria-label="Trip map"] [title="Driver"]').waitFor({ timeout: 30000 });
  await drive(51.5052, -0.1282, 155);
  await shoot(m, '133-branded-map-phone-tracking');

  // ---- Admin live map
  const { page: a } = await open('admin', admin, /#\/admin/);
  await go(a, '/admin/live-map');
  await a.locator('[aria-label="Live map of drivers and rides"] .gm-style').waitFor();
  await sleep(6000);
  const driverPin = a.locator('[aria-label="Live map of drivers and rides"] [role="button"]').first();
  if (await driverPin.count()) await driverPin.click();
  steps.push(`admin: driver card shown=${(await a.getByRole('dialog', { name: 'Driver details' }).count()) > 0}`);
  await sleep(5000); // tiles for the new zoom level
  await shoot(a, '132-branded-map-admin');

  // ---- Phone: driver idle map
  const { page: dp } = await open('phone-driver', driver, /#\/driver-dashboard/, { geolocation: driverStart, viewport: { width: 390, height: 844 } });
  await api.put(`rides/${rideId}/cancel`, authed(pt));
  rideId = null;
  await dp.reload();
  const phoneIdle = dp.locator('[aria-label="Map of rides near you"]');
  await phoneIdle.locator('.gm-style').waitFor();
  await shoot(dp, '134-branded-map-phone-driver-idle', phoneIdle);
  await dp.locator('label:has(input[type=checkbox])').first().click(); // back offline
} catch (err) {
  issues.push(`FLOW FAILED: ${err.message.split('\n')[0]}`);
  let i = 0;
  for (const context of browser.contexts()) for (const pg of context.pages()) await pg.screenshot({ path: path.join(outDir, `139-branded-map-failure-${++i}.png`) }).catch(() => {});
} finally {
  if (rideId && pt) await api.put(`rides/${rideId}/cancel`, authed(pt)).catch(() => {});
  await browser.close();
  await api.dispose();
}
console.log(steps.join('\n'));
console.log(issues.length ? `ISSUES:\n${issues.join('\n')}` : 'No page or console errors.');
process.exitCode = issues.some((i) => i.startsWith('FLOW FAILED')) ? 1 : 0;
