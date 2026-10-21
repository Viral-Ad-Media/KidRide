// Brand foundations check (test-screenshots/brand/*). Splash mid-animation and
// settled, then login, parent home, Book a Ride, a simulated tracking map, the
// driver console and the admin live map, at desktop and 390px widths.
//
// Usage (PowerShell, from the KidRide folder):
//   $env:KIDRIDE_TEST_EMAIL / KIDRIDE_TEST_PASSWORD   parent with a child, no unfinished ride
//   $env:KIDRIDE_DRIVERS = 'driver@x'                  approved driver, no unfinished ride
//   $env:KIDRIDE_DRIVER_PASSWORD
//   $env:KIDRIDE_ADMIN_EMAIL / KIDRIDE_ADMIN_PASSWORD
//   node scripts/screenshot-brand.mjs
import { chromium, request as apiRequest } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const baseUrl = process.env.KIDRIDE_URL || 'http://localhost:3001';
const apiUrl = process.env.KIDRIDE_API_URL || 'http://localhost:5000/api';
const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'test-screenshots', 'brand');
const parent = { email: process.env.KIDRIDE_TEST_EMAIL, password: process.env.KIDRIDE_TEST_PASSWORD };
const driver = { email: (process.env.KIDRIDE_DRIVERS || '').split(',')[0]?.trim(), password: process.env.KIDRIDE_DRIVER_PASSWORD };
const admin = { email: process.env.KIDRIDE_ADMIN_EMAIL, password: process.env.KIDRIDE_ADMIN_PASSWORD };
if (![parent.email, parent.password, driver.email, driver.password, admin.email, admin.password].every(Boolean)) {
  console.error('Set KIDRIDE_TEST_EMAIL/PASSWORD, KIDRIDE_DRIVERS, KIDRIDE_DRIVER_PASSWORD and KIDRIDE_ADMIN_EMAIL/PASSWORD.');
  process.exit(1);
}
await mkdir(outDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const issues = [];
const steps = [];
const api = await apiRequest.newContext({ baseURL: `${apiUrl}/`, timeout: 90000 });
const token = async (email, password) => (await (await api.post('auth/login', { data: { email, password } })).json()).token;
const authed = (t, data) => ({ headers: { Authorization: `Bearer ${t}` }, ...(data ? { data } : {}) });
const browser = await chromium.launch();
const sizes = { desktop: { width: 1280, height: 900 }, phone: { width: 390, height: 844 } };

const newPage = async (label, viewport, extra = {}) => {
  const context = await browser.newContext({ viewport, ...extra });
  const page = await context.newPage();
  page.setDefaultTimeout(90000);
  page.setDefaultNavigationTimeout(90000);
  page.on('pageerror', (e) => issues.push(`[${label}] page error: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') issues.push(`[${label}] console: ${m.text().split('\n')[0]}`); });
  return page;
};
const login = async (page, account, landing) => {
  await page.goto(`${baseUrl}/#/login`);
  await page.getByPlaceholder('you@example.com').fill(account.email);
  await page.getByPlaceholder('Enter your password').fill(account.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(landing);
  await sleep(2000);
};
const go = async (page, hash) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(`${baseUrl}/#${hash}`);
    await sleep(2500);
    if (new URL(page.url()).hash === `#${hash}`) return;
  }
  throw new Error(`could not open ${hash}`);
};
const shoot = async (page, name) => { await page.screenshot({ path: path.join(outDir, `${name}.png`) }); console.log(`saved brand/${name}.png`); };
// Elements whose computed style still looks unstyled (no Tailwind): a quick sanity check.
const unstyledCheck = async (page, label) => {
  const result = await page.evaluate(() => {
    const body = getComputedStyle(document.body);
    const buttons = [...document.querySelectorAll('button')].filter((b) => b.offsetParent);
    const plain = buttons.filter((b) => { const s = getComputedStyle(b); return s.borderRadius === '0px' && s.backgroundColor === 'rgb(239, 239, 239)'; }).length;
    return { font: body.fontFamily.split(',')[0], bg: body.backgroundColor, plain };
  });
  if (result.plain) issues.push(`[${label}] ${result.plain} unstyled buttons`);
  return result;
};

let rideId = null, pt = null;
try {
  pt = await token(parent.email, parent.password);
  const dt = await token(driver.email, driver.password);
  for (const t of [pt, dt]) { const a = await (await api.get('rides/active', authed(t))).json(); if (a?.id) await api.put(`rides/${a.id}/cancel`, authed(t)); }

  for (const [size, viewport] of Object.entries(sizes)) {
    // Splash: a fresh session shows it once.
    const s = await newPage(`splash-${size}`, viewport);
    await s.goto(`${baseUrl}/#/login`);
    await sleep(650);
    await shoot(s, `splash-1-${size}`);
    await sleep(750);
    await shoot(s, `splash-2-${size}`);
    await s.getByRole('status', { name: 'Loading KidRide' }).waitFor({ state: 'detached' });
    steps.push(`[${size}] splash shown then removed; body ${JSON.stringify(await unstyledCheck(s, `login-${size}`))}`);
    await shoot(s, `login-${size}`);

    // Parent
    const p = await newPage(`parent-${size}`, viewport);
    await login(p, parent, /#\/dashboard/);
    await unstyledCheck(p, `parent-${size}`);
    await shoot(p, `parent-home-${size}`);
    await go(p, '/book');
    await p.getByRole('button', { name: /^Next$/ }).click();
    await p.getByPlaceholder('e.g. Home, 123 Maple St').fill('10 Downing Street London');
    await p.locator('ul[role=listbox] button[role=option]').first().click();
    await sleep(800);
    await unstyledCheck(p, `book-${size}`);
    await shoot(p, `book-${size}`);
  }

  // Tracking map with a simulated driver
  const kids = await (await api.get('users/children', authed(pt))).json();
  const quote = await (await api.post('rides/quote', authed(pt, { serviceType: 'pickup_and_dropoff' }))).json();
  const ride = await (await api.post('rides/request', authed(pt, { childId: kids[0].id, pickup: '10 Downing St, London SW1A 2AA, UK', dropoff: '40 Princess Rd, London NW1 8JS, UK', pickupCoords: { lat: 51.50334, lng: -0.12757 }, dropoffCoords: { lat: 51.53959, lng: -0.15145 }, serviceType: 'pickup_and_dropoff', quotedPrice: quote.price, pickupTime: new Date().toISOString() }))).json();
  rideId = ride.id;
  const acc = await api.put(`rides/${rideId}/accept`, authed(dt));
  if (!acc.ok()) throw new Error(`accept failed ${acc.status()}`);
  for (const [lat, lng, heading] of [[51.5098, -0.1340, 135], [51.5085, -0.1322, 140]]) await api.put(`rides/${rideId}/location`, authed(dt, { latitude: lat, longitude: lng, heading, speed: 8 }));
  for (const [size, viewport] of Object.entries(sizes)) {
    const t = await newPage(`tracking-${size}`, viewport);
    await login(t, parent, /#\/dashboard/);
    await go(t, `/tracking/${rideId}`);
    await t.locator('[aria-label="Trip map"] [title="Driver"]').waitFor({ timeout: 30000 });
    await api.put(`rides/${rideId}/location`, authed(dt, { latitude: 51.5072, longitude: -0.1305, heading: 145, speed: 8 }));
    await sleep(5000);
    const googleLogo = await t.locator('[aria-label="Trip map"] img[alt="Google"], [aria-label="Trip map"] a[title*="Google"]').count();
    steps.push(`[${size}] tracking map: Google logo visible=${googleLogo > 0}`);
    await shoot(t, `tracking-map-${size}`);
  }
  await api.put(`rides/${rideId}/cancel`, authed(pt));
  rideId = null;

  // Driver console and admin live map
  for (const [size, viewport] of Object.entries(sizes)) {
    const d = await newPage(`driver-${size}`, viewport, { permissions: ['geolocation'], geolocation: { latitude: 51.5050, longitude: -0.1282 } });
    await login(d, driver, /#\/driver-dashboard/);
    if (await d.getByText('Go online to receive trip requests').count()) await d.locator('label:has(input[type=checkbox])').first().click();
    await d.locator('[aria-label="Map of rides near you"] .gm-style').waitFor();
    await sleep(3000);
    await unstyledCheck(d, `driver-${size}`);
    await shoot(d, `driver-${size}`);
    await d.locator('label:has(input[type=checkbox])').first().click();

    const a = await newPage(`admin-${size}`, viewport);
    await login(a, admin, /#\/admin/);
    await go(a, '/admin/live-map');
    await a.locator('[aria-label="Live map of drivers and rides"] .gm-style').waitFor();
    await sleep(4000);
    await unstyledCheck(a, `admin-${size}`);
    await shoot(a, `admin-livemap-${size}`);
    if (size === 'desktop') { await go(a, '/admin/drivers'); await sleep(2500); await shoot(a, 'admin-drivers-desktop'); }
  }
} catch (err) {
  issues.push(`FLOW FAILED: ${err.message.split('\n')[0]}`);
  let i = 0;
  for (const context of browser.contexts()) for (const pg of context.pages()) await pg.screenshot({ path: path.join(outDir, `failure-${++i}.png`) }).catch(() => {});
} finally {
  if (rideId && pt) await api.put(`rides/${rideId}/cancel`, authed(pt)).catch(() => {});
  await browser.close();
  await api.dispose();
}
console.log(steps.join('\n'));
console.log(issues.length ? `ISSUES:\n${issues.join('\n')}` : 'No page or console errors; no unstyled buttons.');
process.exitCode = issues.some((i) => i.startsWith('FLOW FAILED')) ? 1 : 0;
