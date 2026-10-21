// Book-for-later check (screenshots 110-*). A parent schedules a ride ~2 h
// ahead from the Book a Ride page (Schedule toggle), sees it under Upcoming and
// changes its time. A nearby online driver is not offered it while it is held.
// A test-only time shift then moves the pickup to 25 min away: the ride is
// released to the nearest driver, who accepts it and sees it in Upcoming; at
// 12 min the driver gets the reminder and the trip becomes current. A second
// scheduled ride with no driver 4 min before pickup shows "Needs attention"
// for the admin, and the parent cancels it from Upcoming.
//
// Usage (PowerShell, from the KidRide folder):
//   $env:KIDRIDE_TEST_EMAIL / KIDRIDE_TEST_PASSWORD   parent with a child, no unfinished ride
//   $env:KIDRIDE_DRIVERS = 'driver@x'                  approved driver, no unfinished ride
//   $env:KIDRIDE_DRIVER_PASSWORD
//   $env:KIDRIDE_ADMIN_EMAIL / KIDRIDE_ADMIN_PASSWORD
//   $env:KIDRIDE_TIME_SHIFT = 'node path\to\shift_ride.js <backendDir>'   moves a test ride's pickup_time
//   node scripts/screenshot-schedule.mjs
import { chromium, request as apiRequest } from 'playwright';
import { execSync } from 'node:child_process';
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
const timeShift = process.env.KIDRIDE_TIME_SHIFT;
if (![parent.email, parent.password, driver.email, driver.password, admin.email, admin.password, timeShift].every(Boolean)) {
  console.error('Set KIDRIDE_TEST_EMAIL/PASSWORD, KIDRIDE_DRIVERS, KIDRIDE_DRIVER_PASSWORD, KIDRIDE_ADMIN_EMAIL/PASSWORD and KIDRIDE_TIME_SHIFT.');
  process.exit(1);
}

await mkdir(outDir, { recursive: true });
for (const f of await readdir(outDir)) if (/^1[12][0-9]-schedule-.*\.png$/.test(f)) await unlink(path.join(outDir, f));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const issues = [];
const steps = [];
const api = await apiRequest.newContext({ baseURL: `${apiUrl}/`, timeout: 90000 });
const token = async (email, password) => (await (await api.post('auth/login', { data: { email, password } })).json()).token;
const authed = (t, data) => ({ headers: { Authorization: `Bearer ${t}` }, ...(data ? { data } : {}) });
const shift = (rideId, minutes) => { execSync(`${timeShift} ${rideId} ${minutes}`, { stdio: 'pipe' }); steps.push(`time shift: pickup now ${minutes} min away`); };
const pad = (n) => String(n).padStart(2, '0');
const localValue = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
const slot = (minutes) => { const d = new Date(Date.now() + minutes * 60000); d.setSeconds(0, 0); d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5); return d; };

const browser = await chromium.launch();
const open = async (label, account, landing, options = {}) => {
  const context = await browser.newContext({ viewport: options.viewport || { width: 1280, height: 900 }, ...(options.geolocation ? { permissions: ['geolocation'], geolocation: options.geolocation } : {}) });
  const page = await context.newPage();
  page.setDefaultTimeout(90000);
  page.setDefaultNavigationTimeout(90000);
  page.on('pageerror', (e) => issues.push(`[${label}] page error: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/409|400/.test(m.text())) issues.push(`[${label}] console: ${m.text().split('\n')[0]}`); });
  await page.goto(`${baseUrl}/#/login`);
  await page.getByPlaceholder('you@example.com').fill(account.email);
  await page.getByPlaceholder('Enter your password').fill(account.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(landing);
  return page;
};
const shoot = async (page, name, locator) => {
  await sleep(900);
  if (locator) await locator.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(outDir, `${name}.png`), timeout: 90000 });
  console.log(`saved ${name}.png`);
};
const pickPlace = async (page, placeholder, text) => {
  await page.getByPlaceholder(placeholder).fill(text);
  await page.locator('ul[role=listbox] button[role=option]').first().click();
  await sleep(1500);
};

const created = [];
let pt = null;
try {
  pt = await token(parent.email, parent.password);
  const dt = await token(driver.email, driver.password);
  for (const t of [pt, dt]) { const a = await (await api.get('rides/active', authed(t))).json(); if (a?.id) await api.put(`rides/${a.id}/cancel`, authed(t)); }
  for (const r of await (await api.get('rides/scheduled', authed(pt))).json()) await api.put(`rides/${r.id}/cancel`, authed(pt));

  // ---- 1. Parent books for later
  const p = await open('parent', parent, /#\/dashboard/);
  await p.goto(`${baseUrl}/#/book`);
  await p.getByRole('button', { name: /^Next$/ }).click();
  await pickPlace(p, 'e.g. Home, 123 Maple St', '10 Downing Street London');
  await pickPlace(p, 'e.g. Soccer Field', 'Primrose Hill Primary School London');
  await p.getByRole('radio', { name: 'Schedule' }).click();
  const when = p.getByLabel('Pickup date and time');
  await when.fill(localValue(slot(10)));
  await p.getByText('at least 30 minutes from now').waitFor();
  steps.push(`too soon: Next disabled=${await p.getByRole('button', { name: /^Next$/ }).isDisabled()}`);
  await shoot(p, '110-schedule-1-too-soon', when);
  const firstTime = slot(120);
  await when.fill(localValue(firstTime));
  await p.getByText('in your local time').waitFor();
  await shoot(p, '111-schedule-2-booking-form', when);
  await p.getByRole('button', { name: /^Next$/ }).click();
  await p.getByRole('button', { name: 'Confirm & Schedule' }).waitFor();
  await shoot(p, '112-schedule-3-review');
  await p.getByRole('button', { name: 'Confirm & Schedule' }).click();
  await p.getByText('Ride scheduled').waitFor();
  await shoot(p, '113-schedule-4-confirmed');

  // ---- 2. Upcoming on the parent dashboard; change the time
  await p.getByRole('button', { name: 'Back to Dashboard' }).click();
  const upcoming = p.getByRole('list', { name: 'Upcoming rides' });
  await upcoming.getByText('Scheduled', { exact: true }).waitFor();
  const [ride] = await (await api.get('rides/scheduled', authed(pt))).json();
  created.push(ride.id);
  steps.push(`booked: isScheduled=${ride.isScheduled} scheduleState=${ride.scheduleState} pickupTime UTC=${ride.pickupTime} (chosen local ${localValue(firstTime)})`);
  await shoot(p, '114-schedule-5-parent-upcoming', upcoming);
  await upcoming.getByRole('button', { name: 'Change time' }).click();
  const newTime = slot(180);
  await p.getByLabel('New pickup date and time').fill(localValue(newTime));
  await shoot(p, '115-schedule-6-change-time');
  await p.getByRole('button', { name: 'Save new time' }).click();
  await p.getByRole('dialog').waitFor({ state: 'detached' });
  const moved = (await (await api.get('rides/scheduled', authed(pt))).json())[0];
  steps.push(`rescheduled: ${new Date(moved.pickupTime).getTime() === newTime.getTime() ? 'ok' : `MISMATCH ${moved.pickupTime}`}`);

  // ---- 3. Held: an online driver right next to the pickup is not offered it
  const d = await open('driver', driver, /#\/driver-dashboard/, { geolocation: { latitude: 51.5050, longitude: -0.1282 } });
  if (await d.getByText('Go online to receive trip requests').count()) await d.locator('label:has(input[type=checkbox])').first().click();
  await sleep(13000); // presence heartbeat with position
  const open1 = await (await api.get('rides/open?limit=50', authed(dt))).json();
  steps.push(`held: visible to driver=${open1.some((r) => r.id === ride.id)}; driver sees offer=${(await d.getByRole('button', { name: 'Accept Ride' }).count()) > 0}`);
  const accept409 = await api.put(`rides/${ride.id}/accept`, authed(dt));
  steps.push(`held: accept via API -> ${accept409.status()}`);
  await shoot(d, '116-schedule-7-driver-not-offered-while-held');

  // ---- 4. 25 min before pickup: released to the nearest driver
  shift(ride.id, 25);
  await d.getByRole('button', { name: 'Accept Ride' }).waitFor({ timeout: 30000 });
  await d.getByText(/Booked ahead for/).waitFor();
  steps.push(`released: driver offered it with countdown=${(await d.getByText(/s to accept/).count()) > 0}`);
  await shoot(d, '117-schedule-8-driver-offer-after-release');
  await p.reload();
  await upcoming.getByText('Finding a driver').waitFor();
  await shoot(p, '118-schedule-9-parent-finding-driver', upcoming);

  // ---- 5. Driver accepts: it goes to their Upcoming list, not the current trip
  await d.getByRole('button', { name: 'Accept Ride' }).click();
  const driverUpcoming = d.getByRole('list', { name: 'Your upcoming rides' });
  await driverUpcoming.waitFor();
  await d.getByText('Scanning the area').waitFor();
  steps.push(`accepted 25 min ahead: in driver Upcoming, dashboard still idle=${(await d.getByText('Scanning the area').count()) > 0}`);
  await shoot(d, '119-schedule-10-driver-upcoming', driverUpcoming);
  await p.reload();
  await upcoming.getByText('Driver confirmed').waitFor();
  await shoot(p, '120-schedule-11-parent-driver-confirmed', upcoming);

  // ---- 6. 12 min before pickup: reminder, and it becomes the current trip
  shift(ride.id, 12);
  await d.reload();
  await d.getByRole('alert').filter({ hasText: 'Scheduled pickup in' }).waitFor();
  await d.getByRole('button', { name: 'Arrived at Pickup' }).waitFor();
  steps.push('12 min before: driver reminder shown and the trip is current');
  await shoot(d, '121-schedule-12-driver-reminder');
  await p.reload();
  await p.getByRole('button', { name: 'Track Live Ride' }).waitFor();
  await shoot(p, '122-schedule-13-parent-live-ride');
  await api.put(`rides/${ride.id}/cancel`, authed(pt));
  created.length = 0;

  // ---- 7. A second ride with no driver 4 min before pickup: Needs attention
  if (await d.getByText('Go online to receive trip requests').count() === 0) await d.locator('label:has(input[type=checkbox])').first().click();
  const kids = await (await api.get('users/children', authed(pt))).json();
  const quote = await (await api.post('rides/quote', authed(pt, { serviceType: 'pickup_only' }))).json();
  const res2 = await api.post('rides/request', authed(pt, { childId: kids[0].id, pickup: '1 Example Road, London', dropoff: '2 Example Road, London', serviceType: 'pickup_only', quotedPrice: quote.price, scheduled: true, pickupTime: slot(60).toISOString() }));
  const ride2 = await res2.json();
  if (!res2.ok()) throw new Error(`second booking failed: ${res2.status()} ${ride2.message}`);
  created.push(ride2.id);
  shift(ride2.id, 4);
  const a = await open('admin', admin, /#\/admin/);
  await a.goto(`${baseUrl}/#/admin/rides`);
  await a.getByRole('button', { name: /^Needs attention \(\d+\)$/ }).click();
  await a.getByText('Needs attention', { exact: true }).first().waitFor();
  steps.push(`admin: needs attention filter shows the ride=${(await a.getByText(ride2.id).count()) > 0}`);
  await shoot(a, '123-schedule-14-admin-needs-attention');
  await a.getByRole('button', { name: /^Scheduled \(\d+\)$/ }).click();
  await shoot(a, '124-schedule-15-admin-scheduled-filter');

  // ---- 8. Parent cancels it from Upcoming
  await p.reload();
  await upcoming.getByText('Needs attention').waitFor();
  await upcoming.getByRole('button', { name: 'Cancel' }).first().click();
  await shoot(p, '125-schedule-16-parent-cancel-confirm');
  await p.getByRole('button', { name: 'Cancel ride' }).click();
  await p.getByText('No upcoming rides.').waitFor();
  created.length = 0;
  steps.push('parent cancelled the ride from Upcoming');
  await shoot(p, '126-schedule-17-parent-no-upcoming');

  // ---- 9. Phone width
  const m = await open('phone', parent, /#\/dashboard/, { viewport: { width: 390, height: 844 } });
  await m.goto(`${baseUrl}/#/book`);
  await m.getByRole('button', { name: /^Next$/ }).click();
  await m.getByRole('radio', { name: 'Schedule' }).click();
  await shoot(m, '127-schedule-18-phone-booking', m.getByLabel('Pickup date and time'));
} catch (err) {
  issues.push(`FLOW FAILED: ${err.message.split('\n')[0]}`);
  let i = 0;
  for (const context of browser.contexts()) for (const pg of context.pages()) await pg.screenshot({ path: path.join(outDir, `129-schedule-failure-${++i}.png`) }).catch(() => {});
} finally {
  for (const id of created) if (pt) await api.put(`rides/${id}/cancel`, authed(pt)).catch(() => {});
  await browser.close();
  await api.dispose();
}
console.log(steps.join('\n'));
console.log(issues.length ? `ISSUES:\n${issues.join('\n')}` : 'No page or console errors.');
process.exitCode = issues.some((i) => i.startsWith('FLOW FAILED')) ? 1 : 0;
