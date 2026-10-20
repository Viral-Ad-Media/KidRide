// Live map check (screenshots 70-75): a parent books with Google Places
// suggestions, an approved driver accepts, and the driver's simulated GPS moves
// along a few points while the parent's tracking map glides the car marker.
// Cancels the test ride at the end.
//
// Usage (PowerShell, from the KidRide folder; needs VITE_GOOGLE_MAPS_KEY in .env.local):
//   $env:KIDRIDE_TEST_EMAIL / KIDRIDE_TEST_PASSWORD      parent with at least one child
//   $env:KIDRIDE_DRIVER_EMAIL / KIDRIDE_DRIVER_PASSWORD  approved driver
//   node scripts/screenshot-map.mjs
import { chromium, request as apiRequest } from 'playwright';
import { mkdir, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const baseUrl = process.env.KIDRIDE_URL || 'http://localhost:3001';
const apiUrl = process.env.KIDRIDE_API_URL || 'http://localhost:5000/api';
const outDir = process.env.KIDRIDE_SCREENSHOT_DIR
  || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'test-screenshots');
const parent = { email: process.env.KIDRIDE_TEST_EMAIL, password: process.env.KIDRIDE_TEST_PASSWORD };
const driver = { email: process.env.KIDRIDE_DRIVER_EMAIL, password: process.env.KIDRIDE_DRIVER_PASSWORD };
if (!parent.email || !parent.password || !driver.email || !driver.password) {
  console.error('Set KIDRIDE_TEST_EMAIL/PASSWORD and KIDRIDE_DRIVER_EMAIL/PASSWORD first.');
  process.exit(1);
}

await mkdir(outDir, { recursive: true });
for (const f of await readdir(outDir)) if (/^7[0-9]-.*\.png$/.test(f)) await unlink(path.join(outDir, f));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const issues = [];
const api = await apiRequest.newContext({ baseURL: `${apiUrl}/`, timeout: 90000 });
const token = async ({ email, password }) => (await (await api.post('auth/login', { data: { email, password } })).json()).token;
const authed = (t, data) => ({ headers: { Authorization: `Bearer ${t}` }, ...(data ? { data } : {}) });

// The driver approaches the pickup from the south in a few steps.
const driverPath = [
  { latitude: 51.4985, longitude: -0.1240 },
  { latitude: 51.5000, longitude: -0.1255 },
  { latitude: 51.5015, longitude: -0.1266 },
  { latitude: 51.5028, longitude: -0.1273 }
];

const browser = await chromium.launch();
const openPage = async (label, options = {}) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...options });
  const page = await context.newPage();
  page.setDefaultTimeout(90000);
  page.setDefaultNavigationTimeout(90000);
  page.on('pageerror', (e) => issues.push(`[${label}] page error: ${e.message}`));
  page.on('console', (m) => {
    const text = m.text();
    // Google reports key/billing/API problems as console errors named *MapError.
    if (m.type() === 'error' || /MapError|Google Maps JavaScript API/.test(text)) issues.push(`[${label}] console: ${text.split('\n')[0]}`);
  });
  return page;
};
const login = async (page, { email, password }) => {
  await page.goto(`${baseUrl}/#/login`);
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('Enter your password').fill(password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.hash.startsWith('#/login'));
};
const shoot = async (page, name, fullPage = false) => {
  await sleep(800);
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage, timeout: 90000 });
  console.log(`saved ${name}.png`);
};
const pickSuggestion = async (page, placeholder, text) => {
  await page.getByPlaceholder(placeholder).fill(text);
  const option = page.getByRole('option').first();
  await option.waitFor({ timeout: 30000 });
  return option;
};

let rideId = null;
let pt = null;
try {
  pt = await token(parent);
  const dt = await token(driver);
  for (const t of [pt, dt]) { const a = await (await api.get('rides/active', authed(t))).json(); if (a?.id) await api.put(`rides/${a.id}/cancel`, authed(t)); }

  // ---- Parent books using Places suggestions
  const p = await openPage('parent');
  await login(p, parent);
  await p.goto(`${baseUrl}/#/book`);
  await p.getByRole('button', { name: 'Next' }).click();
  const pickupOption = await pickSuggestion(p, 'e.g. Home, 123 Maple St', '10 Downing Street');
  await shoot(p, '70-book-address-suggestions');
  await pickupOption.click();
  await sleep(1500);
  await (await pickSuggestion(p, 'e.g. Soccer Field', 'Primrose Hill Primary School')).click();
  await sleep(1500);
  await p.locator('select').first().selectOption('pickup_and_dropoff');
  console.log('pickup field:', await p.getByPlaceholder('e.g. Home, 123 Maple St').inputValue());
  console.log('drop-off field:', await p.getByPlaceholder('e.g. Soccer Field').inputValue());
  await p.getByRole('button', { name: 'Next' }).click();
  await p.getByText(/Fixed service fare/).waitFor();
  await p.getByRole('button', { name: 'Confirm & Book' }).click();
  await p.getByRole('button', { name: 'View Request' }).click();
  await p.waitForURL(/#\/tracking\//);
  rideId = new URL(p.url()).hash.split('/').pop();
  const saved = await (await api.get(`rides/${rideId}`, authed(pt))).json();
  console.log('saved coords:', JSON.stringify(saved.pickupCoords), JSON.stringify(saved.dropoffCoords));
  await p.getByText(/^Trip$/).waitFor({ timeout: 60000 }).catch(() => {});
  await shoot(p, '71-tracking-route-before-driver');

  // ---- Driver accepts in the console with simulated GPS
  const d = await openPage('driver', { permissions: ['geolocation'], geolocation: driverPath[0] });
  await login(d, driver);
  await d.goto(`${baseUrl}/#/driver-dashboard`);
  await d.getByRole('button', { name: 'Accept Ride' }).click();
  await d.getByRole('button', { name: 'Arrived at Pickup' }).waitFor();
  await d.locator('[aria-label="Trip map"]').waitFor();
  await sleep(6000);
  await shoot(d, '72-driver-console-trip-map', true);

  // ---- Driver moves; parent watches the car glide
  for (let i = 1; i < driverPath.length; i++) {
    await d.context().setGeolocation(driverPath[i]);
    await sleep(5000);
    if (i === 2) {
      // Mid-route, captured part-way through a glide.
      await d.context().setGeolocation(driverPath[3]);
      await sleep(4600);
      await shoot(p, '73-tracking-car-mid-route');
    }
  }
  await sleep(4000);
  await p.getByText(/Driver arriving in/).waitFor({ timeout: 60000 }).catch(() => issues.push('driver ETA was not shown'));
  await shoot(p, '74-tracking-car-near-pickup');
  const latest = await (await api.get(`rides/${rideId}`, authed(pt))).json();
  console.log('latest driver fix:', JSON.stringify({ lat: latest.driverLocation?.latitude, lng: latest.driverLocation?.longitude, heading: latest.driverLocation?.heading }));
} catch (err) {
  issues.push(`FLOW FAILED: ${err.message.split('\n')[0]}`);
  for (const context of browser.contexts()) for (const pg of context.pages()) await pg.screenshot({ path: path.join(outDir, `79-failure-${browser.contexts().indexOf(context)}.png`) }).catch(() => {});
} finally {
  if (rideId && pt) await api.put(`rides/${rideId}/cancel`, authed(pt)).catch(() => {});
  await browser.close();
  await api.dispose();
}
console.log(issues.length ? `ISSUES:\n${issues.join('\n')}` : 'No console errors or Google map errors.');
process.exitCode = issues.some((i) => i.startsWith('FLOW FAILED')) ? 1 : 0;
