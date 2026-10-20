// Admin live map check (screenshots 90-93): three drivers go Online at
// different simulated positions, one accepts a ride (on a ride), another ride
// waits for a driver, and the admin watches it all on the live map.
// Cancels both test rides at the end.
//
// Usage (PowerShell, from the KidRide folder):
//   $env:KIDRIDE_ADMIN_EMAIL / KIDRIDE_ADMIN_PASSWORD
//   $env:KIDRIDE_PARENTS = 'a@x,b@x'           two parents with a child each
//   $env:KIDRIDE_PARENT_PASSWORD               their (shared) password
//   $env:KIDRIDE_DRIVERS = 'near@x,mid@x,far@x'; $env:KIDRIDE_DRIVER_PASSWORD
//   node scripts/screenshot-admin-map.mjs
import { chromium, request as apiRequest } from 'playwright';
import { mkdir, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const baseUrl = process.env.KIDRIDE_URL || 'http://localhost:3001';
const apiUrl = process.env.KIDRIDE_API_URL || 'http://localhost:5000/api';
const outDir = process.env.KIDRIDE_SCREENSHOT_DIR
  || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'test-screenshots');
const admin = { email: process.env.KIDRIDE_ADMIN_EMAIL, password: process.env.KIDRIDE_ADMIN_PASSWORD };
const parents = (process.env.KIDRIDE_PARENTS || '').split(',').map((s) => s.trim()).filter(Boolean);
const drivers = (process.env.KIDRIDE_DRIVERS || '').split(',').map((s) => s.trim()).filter(Boolean);
if (!admin.email || !admin.password || parents.length !== 2 || drivers.length !== 3 || !process.env.KIDRIDE_PARENT_PASSWORD || !process.env.KIDRIDE_DRIVER_PASSWORD) {
  console.error('Set KIDRIDE_ADMIN_EMAIL/PASSWORD, KIDRIDE_PARENTS (2), KIDRIDE_PARENT_PASSWORD, KIDRIDE_DRIVERS (3) and KIDRIDE_DRIVER_PASSWORD.');
  process.exit(1);
}

await mkdir(outDir, { recursive: true });
for (const f of await readdir(outDir)) if (/^9[0-9]-.*\.png$/.test(f)) await unlink(path.join(outDir, f));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const notes = [];
const issues = [];
const api = await apiRequest.newContext({ baseURL: `${apiUrl}/`, timeout: 90000 });
const token = async (email, password) => (await (await api.post('auth/login', { data: { email, password } })).json()).token;
const authed = (t, data) => ({ headers: { Authorization: `Bearer ${t}` }, ...(data ? { data } : {}) });
const positions = [
  { latitude: 51.5050, longitude: -0.1282 },
  { latitude: 51.5110, longitude: -0.1330 },
  { latitude: 51.5200, longitude: -0.1050 }
];
const pickups = [
  { pickup: '10 Downing St, London SW1A 2AA, UK', coords: { lat: 51.50334, lng: -0.12757 } },
  { pickup: 'British Museum, Great Russell St, London WC1B 3DG, UK', coords: { lat: 51.51943, lng: -0.12696 } }
];

const browser = await chromium.launch();
const page = async (label, options = {}) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...options });
  const p = await context.newPage();
  p.setDefaultTimeout(90000);
  p.setDefaultNavigationTimeout(90000);
  p.on('pageerror', (e) => issues.push(`[${label}] page error: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error' || /MapError/.test(m.text())) issues.push(`[${label}] console: ${m.text().split('\n')[0]}`); });
  return p;
};
const login = async (p, email, password) => {
  await p.goto(`${baseUrl}/#/login`);
  await p.getByPlaceholder('you@example.com').fill(email);
  await p.getByPlaceholder('Enter your password').fill(password);
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => !u.hash.startsWith('#/login'));
};
const shoot = async (p, name) => { await sleep(900); await p.screenshot({ path: path.join(outDir, `${name}.png`), timeout: 90000 }); console.log(`saved ${name}.png`); };

const rides = [];
try {
  const parentTokens = await Promise.all(parents.map((e) => token(e, process.env.KIDRIDE_PARENT_PASSWORD)));
  const driverTokens = await Promise.all(drivers.map((e) => token(e, process.env.KIDRIDE_DRIVER_PASSWORD)));
  for (const t of [...parentTokens, ...driverTokens]) { const a = await (await api.get('rides/active', authed(t))).json(); if (a?.id) await api.put(`rides/${a.id}/cancel`, authed(t)); }

  const driverPages = [];
  for (let i = 0; i < 3; i++) {
    const p = await page(`driver${i}`, { permissions: ['geolocation'], geolocation: positions[i] });
    await login(p, drivers[i], process.env.KIDRIDE_DRIVER_PASSWORD);
    if (await p.getByText('Go online to receive trip requests').count()) await p.locator('label:has(input[type=checkbox])').first().click();
    driverPages.push(p);
  }
  await sleep(13000);

  // Ride 1 is accepted by the nearest driver; ride 2 is still looking.
  for (let i = 0; i < 2; i++) {
    const kids = await (await api.get('users/children', authed(parentTokens[i]))).json();
    if (!kids.length) throw new Error(`${parents[i]} has no child to book for`);
    const quote = await (await api.post('rides/quote', authed(parentTokens[i], { serviceType: 'pickup_and_dropoff' }))).json();
    const ride = await (await api.post('rides/request', authed(parentTokens[i], { childId: kids[0].id, pickup: pickups[i].pickup, dropoff: '40 Princess Rd, London NW1 8JS, UK', pickupCoords: pickups[i].coords, dropoffCoords: { lat: 51.53959, lng: -0.15145 }, serviceType: 'pickup_and_dropoff', quotedPrice: quote.price, pickupTime: new Date().toISOString() }))).json();
    rides.push({ id: ride.id, token: parentTokens[i] });
    if (i === 0) {
      await driverPages[0].getByRole('button', { name: 'Accept Ride' }).click();
      await driverPages[0].getByRole('button', { name: 'Arrived at Pickup' }).waitFor();
    }
  }

  const a = await page('admin');
  await login(a, admin.email, admin.password);
  await a.goto(`${baseUrl}/#/admin/live-map`);
  await a.getByText(/Updates every 5 s · last/).waitFor();
  await sleep(4000);
  const tiles = await a.locator('div.grid.sm\\:grid-cols-4 > div').allInnerTexts();
  notes.push(`counts: ${tiles.map((t) => t.replace(/\n/g, ' ')).join(' | ')}`);
  notes.push(`sidebar: ${(await a.locator('aside ul li button').allInnerTexts()).map((t) => t.split('\n').slice(0, 2).join(' ')).join(' | ')}`);
  await shoot(a, '90-admin-live-map-overview');

  await a.getByRole('tab', { name: 'On a ride' }).click();
  await a.locator('aside ul li button').first().click();
  await a.locator('.gm-style-iw').first().waitFor({ timeout: 15000 }).catch(() => issues.push('driver info window did not open'));
  await shoot(a, '91-admin-live-map-driver-selected');

  await a.getByRole('tab', { name: 'All' }).click();
  await a.getByPlaceholder('Search drivers').fill('Three');
  notes.push(`search "Three": ${(await a.locator('aside ul li button').allInnerTexts()).length} result(s)`);
  await shoot(a, '92-admin-live-map-search');

  // The busy driver moves; the map follows on the next refresh.
  await driverPages[0].context().setGeolocation({ latitude: 51.5040, longitude: -0.1279 });
  await sleep(12000);
  await a.getByPlaceholder('Search drivers').fill('');
  await shoot(a, '93-admin-live-map-after-refresh');
} catch (err) {
  issues.push(`FLOW FAILED: ${err.message.split('\n')[0]}`);
  let i = 0;
  for (const context of browser.contexts()) for (const pg of context.pages()) await pg.screenshot({ path: path.join(outDir, `99-failure-${++i}.png`) }).catch(() => {});
} finally {
  for (const ride of rides) await api.put(`rides/${ride.id}/cancel`, authed(ride.token)).catch(() => {});
  await browser.close();
  await api.dispose();
}
console.log(notes.join('\n'));
console.log(issues.length ? `ISSUES:\n${issues.join('\n')}` : 'No console errors, page errors or Google map errors.');
process.exitCode = issues.some((i) => i.startsWith('FLOW FAILED')) ? 1 : 0;
