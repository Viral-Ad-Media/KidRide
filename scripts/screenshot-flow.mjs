// End-to-end visual check of the local KidRide web app.
// Parent: login -> dashboard -> add child -> book ride -> ride detail -> rides -> profile.
// Driver (optional): login -> dashboard -> accept the parent's ride -> arrive -> pick up -> complete.
//
// Usage (PowerShell, from the KidRide folder):
//   $env:KIDRIDE_TEST_EMAIL='...'; $env:KIDRIDE_TEST_PASSWORD='...'
//   $env:KIDRIDE_DRIVER_EMAIL='...'; $env:KIDRIDE_DRIVER_PASSWORD='...'   # optional
//   node scripts/screenshot-flow.mjs
// Env: KIDRIDE_URL (default http://localhost:3001), KIDRIDE_API_URL (default http://localhost:5000/api),
//      KIDRIDE_SCREENSHOT_DIR (default ../test-screenshots)
import { chromium, request as apiRequest } from 'playwright';
import { mkdir, writeFile, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const baseUrl = process.env.KIDRIDE_URL || 'http://localhost:3001';
const apiUrl = process.env.KIDRIDE_API_URL || 'http://localhost:5000/api';
const parent = { email: process.env.KIDRIDE_TEST_EMAIL, password: process.env.KIDRIDE_TEST_PASSWORD };
const driver = { email: process.env.KIDRIDE_DRIVER_EMAIL, password: process.env.KIDRIDE_DRIVER_PASSWORD };
const outDir = process.env.KIDRIDE_SCREENSHOT_DIR
  || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'test-screenshots');

if (!parent.email || !parent.password) {
  console.error('Set KIDRIDE_TEST_EMAIL and KIDRIDE_TEST_PASSWORD first.');
  process.exit(1);
}

await mkdir(outDir, { recursive: true });
// Only clear this script's own numbered output; other files in the folder are kept.
for (const f of await readdir(outDir)) if (/^(0[1-9]|1[0-9])-.*\.png$|^console-log\.txt$/.test(f)) await unlink(path.join(outDir, f));

const log = [];
const note = (line) => { log.push(line); console.log(line); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// API helper used only for test setup/cleanup, so reruns start from a clean state.
const api = await apiRequest.newContext({ baseURL: `${apiUrl}/` });
const apiLogin = async ({ email, password }) => {
  const res = await api.post('auth/login', { data: { email, password } });
  if (!res.ok()) throw new Error(`API login failed for ${email}: HTTP ${res.status()}`);
  return (await res.json()).token;
};
const authed = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

const cancelActiveRide = async (token, who) => {
  const res = await api.get('rides/active', authed(token));
  const ride = res.ok() ? await res.json() : null;
  const id = ride?.id || ride?._id;
  if (id) {
    const c = await api.put(`rides/${id}/cancel`, authed(token));
    note(`setup: cancelled leftover ${who} ride ${id} (HTTP ${c.status()})`);
  }
};

const browser = await chromium.launch();

const openPage = async (label) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.on('console', (msg) => { if (msg.type() === 'error') note(`[${label}] console error: ${msg.text().split('\n')[0]}`); });
  page.on('pageerror', (err) => note(`[${label}] page error: ${err.message}`));
  page.on('response', (res) => {
    if (res.url().startsWith(apiUrl) && res.status() >= 300) note(`[${label}] API ${res.status()} ${res.request().method()} ${res.url().slice(apiUrl.length)}`);
  });
  page.on('dialog', (d) => d.accept());
  return page;
};

let shot = 0;
const shoot = async (page, name) => {
  await page.waitForLoadState('networkidle').catch(() => {});
  // The backend can take a few seconds per call; wait for loading placeholders to clear.
  await page.getByText(/^Loading/).first().waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
  await sleep(500); // let CSS transitions settle
  const file = path.join(outDir, `${String(++shot).padStart(2, '0')}-${name}.png`);
  // The first capture waits on web fonts, which can take a while.
  await page.screenshot({ path: file, fullPage: true, timeout: 90000 });
  console.log(`saved ${path.basename(file)}`);
};

const loginViaUi = async (page, { email, password }) => {
  await page.goto(`${baseUrl}/#/login`);
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('Enter your password').fill(password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.hash.startsWith('#/login'), { timeout: 15000 });
};

let failed = false;
try {
  // ---- Setup: clear any ride left over from a previous run.
  const parentToken = await apiLogin(parent);
  await cancelActiveRide(parentToken, 'parent');
  let driverToken = null;
  if (driver.email) {
    driverToken = await apiLogin(driver);
    await cancelActiveRide(driverToken, 'driver');
  }

  // ---- Parent flow
  const p = await openPage('parent');
  await p.goto(`${baseUrl}/#/login`);
  await shoot(p, 'login');
  await loginViaUi(p, parent);
  await shoot(p, 'parent-dashboard');

  await p.goto(`${baseUrl}/#/add-child`);
  const childrenRes = await api.get('users/children', authed(parentToken));
  const children = childrenRes.ok() ? await childrenRes.json() : [];
  const hasTestChild = Array.isArray(children) && children.some((c) => c.name === 'Test Child');
  await p.getByPlaceholder('e.g. Leo').fill('Test Child');
  await p.getByPlaceholder('e.g. 8').fill('8');
  await p.getByPlaceholder(/Peanut allergy/).fill('No known allergies (test data)');
  await shoot(p, 'add-child-filled');
  if (hasTestChild) {
    note('parent: "Test Child" already exists, not saving a duplicate');
    await p.goto(`${baseUrl}/#/dashboard`);
  } else {
    await p.getByRole('button', { name: 'Save Profile' }).click();
    await p.waitForURL(/#\/dashboard/, { timeout: 15000 });
  }
  await shoot(p, 'dashboard-with-child');

  await p.goto(`${baseUrl}/#/book`);
  await p.getByText('Test Child').first().click();
  await shoot(p, 'book-step1-child');
  await p.getByRole('button', { name: 'Next' }).click();
  await p.getByPlaceholder('e.g. Home, 123 Maple St').fill('10 Downing Street, London');
  await p.getByPlaceholder('e.g. Soccer Field').fill('Primrose Hill School, London');
  await p.locator('select').first().selectOption('pickup_and_dropoff');
  await shoot(p, 'book-step2-details');
  await p.getByRole('button', { name: 'Next' }).click();
  await p.getByText(/Fixed service fare/).waitFor({ timeout: 15000 });
  await shoot(p, 'book-step3-review');
  await p.getByRole('button', { name: 'Confirm & Book' }).click();
  await p.getByRole('button', { name: 'View Request' }).waitFor({ timeout: 15000 });
  await shoot(p, 'booking-submitted');
  await p.getByRole('button', { name: 'View Request' }).click();
  await p.waitForURL(/#\/tracking\//, { timeout: 15000 });
  await shoot(p, 'ride-detail-searching');

  await p.goto(`${baseUrl}/#/rides`);
  await shoot(p, 'parent-rides');
  await p.goto(`${baseUrl}/#/profile`);
  await shoot(p, 'parent-profile');

  // ---- Driver flow
  if (driver.email) {
    const d = await openPage('driver');
    await loginViaUi(d, driver);
    await shoot(d, 'driver-after-login');
    if (/#\/driver-signup/.test(d.url())) {
      note('driver: redirected to /driver-signup - account is not an approved driver, so it cannot see or accept rides');
    } else {
      await d.goto(`${baseUrl}/#/driver-dashboard`);
      const accept = d.getByRole('button', { name: 'Accept Ride' });
      await accept.waitFor({ timeout: 30000 }); // open rides are polled every 7s
      await shoot(d, 'driver-new-request');
      await accept.click();
      for (const [button, name] of [
        ['Arrived at Pickup', 'driver-assigned'],
        ['Confirm Child Picked Up', 'driver-arrived'],
        ['Complete Ride', 'driver-in-progress']
      ]) {
        const b = d.getByRole('button', { name: button });
        await b.waitFor({ timeout: 20000 });
        await shoot(d, name);
        if (name === 'driver-assigned') {
          await p.goto(`${baseUrl}/#/rides`);
          await shoot(p, 'parent-sees-driver-assigned');
        }
        await b.click();
      }
      await d.getByText('Ride Completed').waitFor({ timeout: 20000 }).catch(() => {});
      await shoot(d, 'driver-completed');
      await p.goto(`${baseUrl}/#/rides`);
      await p.getByText('Past').click().catch(() => {});
      await shoot(p, 'parent-past-rides');
    }
  }
} catch (err) {
  failed = true;
  note(`FLOW FAILED: ${err.message.split('\n')[0]}`);
  for (const ctx of browser.contexts()) for (const pg of ctx.pages()) await shoot(pg, 'failure').catch(() => {});
} finally {
  await browser.close();
  await api.dispose();
}

const problems = log.filter((l) => !l.startsWith('setup:') && !l.startsWith('parent: "Test Child"'));
await writeFile(path.join(outDir, 'console-log.txt'), log.length ? log.join('\n') + '\n' : 'No console errors or non-2xx API calls.\n');
console.log(problems.length ? `\n${problems.length} problem line(s) - see console-log.txt` : '\nNo console errors, page errors or failed API calls.');
process.exitCode = failed || problems.length ? 1 : 0;
