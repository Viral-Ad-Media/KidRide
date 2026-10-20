// Screenshots of the admin, driver-status, rating and modal screens (20-34).
// Puts everything back as it found it: the blocked account is unblocked, the
// test ride is cancelled, and revoke/block dialogs are opened and cancelled.
// The applicant account ends each run rejected, ready to re-apply next run.
//
// Usage (PowerShell, from the KidRide folder), all accounts must already exist:
//   $env:KIDRIDE_ADMIN_EMAIL / KIDRIDE_ADMIN_PASSWORD        admin
//   $env:KIDRIDE_TEST_EMAIL / KIDRIDE_TEST_PASSWORD          parent with a child and completed rides
//   $env:KIDRIDE_DRIVER_EMAIL / KIDRIDE_DRIVER_PASSWORD      approved driver with at least one rating
//   $env:KIDRIDE_APPLICANT_EMAIL / KIDRIDE_APPLICANT_PASSWORD driver who has applied before
//   $env:KIDRIDE_BLOCK_EMAIL / KIDRIDE_BLOCK_PASSWORD        parent that may be blocked briefly
//   node scripts/screenshot-admin.mjs
// Env: KIDRIDE_URL (default http://localhost:3001), KIDRIDE_API_URL (default http://localhost:5000/api),
//      KIDRIDE_SCREENSHOT_DIR (default ../test-screenshots)
import { chromium, request as apiRequest } from 'playwright';
import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const baseUrl = process.env.KIDRIDE_URL || 'http://localhost:3001';
const apiUrl = process.env.KIDRIDE_API_URL || 'http://localhost:5000/api';
const outDir = process.env.KIDRIDE_SCREENSHOT_DIR
  || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'test-screenshots');
const account = (prefix) => ({ email: process.env[`KIDRIDE_${prefix}_EMAIL`], password: process.env[`KIDRIDE_${prefix}_PASSWORD`] });
const admin = account('ADMIN'), parent = account('TEST'), driver = account('DRIVER'), applicant = account('APPLICANT'), blockable = account('BLOCK');
const missing = Object.entries({ ADMIN: admin, TEST: parent, DRIVER: driver, APPLICANT: applicant, BLOCK: blockable }).filter(([, a]) => !a.email || !a.password).map(([k]) => k);
if (missing.length) { console.error(`Set KIDRIDE_<NAME>_EMAIL and _PASSWORD for: ${missing.join(', ')}`); process.exit(1); }

const OWN_FILES = /^(2[0-9]|3[0-4])-.*\.png$|^admin-console-log\.txt$/;
await mkdir(outDir, { recursive: true });
for (const f of await readdir(outDir)) if (OWN_FILES.test(f)) await unlink(path.join(outDir, f));

// 1x1 PNG stand-in for documents; the fake camera supplies the face photos.
const dummyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const log = [];
const note = (line) => { log.push(line); console.log(line); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const api = await apiRequest.newContext({ baseURL: `${apiUrl}/`, timeout: 90000 });
const token = async ({ email, password }) => {
  const res = await api.post('auth/login', { data: { email, password } });
  if (!res.ok()) throw new Error(`API login failed for ${email}: HTTP ${res.status()}`);
  return (await res.json()).token;
};
const authed = (t, data) => ({ headers: { Authorization: `Bearer ${t}` }, ...(data ? { data } : {}) });

const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
const openPage = async (label, width = 1280, height = 900) => {
  const context = await browser.newContext({ viewport: { width, height }, permissions: ['camera'] });
  const page = await context.newPage();
  page.setDefaultTimeout(90000);
  page.setDefaultNavigationTimeout(90000);
  page.on('pageerror', (err) => note(`[${label}] page error: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    // The blocked account's refused login (403) is the behaviour being shown.
    if (label === 'blocked' && msg.text().includes('403')) return;
    note(`[${label}] console error: ${msg.text().split('\n')[0]}`);
  });
  return page;
};
const login = async (page, { email, password }) => {
  await page.goto(`${baseUrl}/#/login`);
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('Enter your password').fill(password);
  await page.click('button[type="submit"]');
};
const loggedIn = async (page, user) => { await login(page, user); await page.waitForURL((u) => !u.hash.startsWith('#/login')); };
// The app redirects right after login; make sure we end up on the page we asked for.
const go = async (page, hash) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.goto(`${baseUrl}/#${hash}`);
    await sleep(1500);
    if (new URL(page.url()).hash === `#${hash}`) return;
  }
  throw new Error(`Could not stay on #${hash} (now ${new URL(page.url()).hash})`);
};
const shoot = async (page, name, fullPage = true) => {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.getByText(/^Loading/).first().waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
  await sleep(700);
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage, timeout: 90000 });
  console.log(`saved ${name}.png`);
};
const dialog = (page) => page.getByRole('dialog');
const search = async (page, section, text) => {
  await go(page, `/admin/${section}`);
  await page.getByPlaceholder(new RegExp(`Search ${section}`)).fill(text);
  await page.getByRole('button', { name: 'Search' }).click();
};
const waitForImages = (page) => page.waitForFunction(() => {
  const imgs = [...document.querySelectorAll('[role=dialog] img, img[alt]')];
  return imgs.length > 0 && imgs.every((i) => i.complete);
}, null, { timeout: 90000 }).catch(() => {});

let failed = false;
let rideToCancel = null;
let blockedId = null;
const adminToken = await token(admin);
try {
  const driverName = (await (await api.get('auth/me', authed(await token(driver)))).json()).name;
  const applicantName = (await (await api.get('auth/me', authed(await token(applicant)))).json()).name;
  const blockName = (await (await api.get('auth/me', authed(await token(blockable)))).json()).name;

  // ---- Admin: drivers, documents, revoke and block dialogs (opened and cancelled), parents
  const a = await openPage('admin');
  await loggedIn(a, admin);
  await go(a, '/admin/drivers');
  await a.getByText(driverName).first().waitFor();
  await shoot(a, '20-admin-drivers');
  await search(a, 'drivers', driver.email);
  await a.getByText(driverName).first().waitFor();
  await a.getByRole('button', { name: 'View documents' }).first().click();
  await dialog(a).getByText(/Document links expire/).waitFor();
  await waitForImages(a);
  await shoot(a, '21-admin-driver-documents', false);
  await a.keyboard.press('Escape');
  await a.getByRole('button', { name: 'Revoke approval' }).first().click();
  await dialog(a).locator('textarea').fill('Insurance has expired. Please upload a current policy.');
  await shoot(a, '22-admin-revoke-reason', false);
  await dialog(a).getByRole('button', { name: 'Cancel', exact: true }).click();
  await a.getByRole('button', { name: 'Block', exact: true }).first().click();
  await dialog(a).locator('textarea').fill('Reported unsafe driving on 20 Oct');
  await shoot(a, '23-admin-block-reason', false);
  await dialog(a).getByRole('button', { name: 'Cancel', exact: true }).click();
  await go(a, '/admin/parents');
  await a.getByText(/parents$/).first().waitFor().catch(() => {});
  await a.getByText(blockName).first().waitFor();
  await shoot(a, '25-admin-parents');

  // ---- Blocked login message (account is unblocked again in finally)
  const users = await (await api.get(`users?role=parent&search=${encodeURIComponent(blockable.email)}`, authed(adminToken))).json();
  blockedId = users.users?.[0]?.id;
  if (!blockedId) throw new Error('Block account not found in admin parents list');
  await api.put(`users/${blockedId}/block`, authed(adminToken, { reason: 'Screenshot run: temporary block' }));
  const b = await openPage('blocked');
  await login(b, blockable);
  await b.getByText(/This account has been blocked/).waitFor();
  await shoot(b, '24-blocked-login-message', false);
  await api.put(`users/${blockedId}/unblock`, authed(adminToken));
  blockedId = null;

  // ---- Applicant re-applies (pending), admin approve dialog (cancelled), reject with a reason
  const d = await openPage('applicant');
  await loggedIn(d, applicant);
  if (!/#\/driver-signup/.test(d.url())) throw new Error(`Applicant must not be an approved driver (landed on ${new URL(d.url()).hash})`);
  // Either the pending status card or the application form, once the page has drawn.
  await d.getByText(/Application status: Under review|Let.s get you verified/).first().waitFor();
  if (await d.getByText(/Application status: Under review/).count() === 0) {
    await d.getByRole('button', { name: 'Next: Vehicle Details' }).click();
    await d.getByRole('button', { name: 'Next: Documents' }).click();
    for (let i = 0; i < 3; i++) await d.locator('input[type="file"]').nth(i).setInputFiles({ name: `doc${i}.png`, mimeType: 'image/png', buffer: dummyPng });
    await d.getByRole('button', { name: 'Start Camera' }).click();
    for (let i = 0; i < 3; i++) {
      await d.waitForFunction(() => (document.querySelector('video')?.videoWidth || 0) > 0);
      await d.locator('video').locator('xpath=..').locator('button').click();
      await sleep(400);
    }
    await d.getByRole('button', { name: 'Confirm Photos' }).click();
    await d.getByRole('button', { name: 'Submit Application' }).click();
    await d.getByText('Application Received!').waitFor({ timeout: 120000 });
    await d.getByRole('button', { name: 'View Application Status' }).click();
  }
  await d.getByText(/Application status: Under review/).waitFor();
  await shoot(d, '27-driver-status-under-review');

  await go(a, '/admin');
  await a.getByRole('button', { name: new RegExp(applicantName) }).first().click();
  await a.waitForFunction(() => [...document.querySelectorAll('button')].some((x) => x.textContent?.trim() === 'Approve' && !x.disabled));
  await a.getByRole('button', { name: 'Approve', exact: true }).click();
  await dialog(a).waitFor();
  await shoot(a, '33-modal-admin-approve-centered', false);
  await dialog(a).getByRole('button', { name: 'Cancel', exact: true }).click();
  await a.getByRole('button', { name: 'Reject', exact: true }).click();
  await dialog(a).locator('textarea').fill('The vehicle registration photo is blurry. Please upload a clear photo.');
  await shoot(a, '26-admin-reject-reason', false);
  await dialog(a).getByRole('button', { name: 'Reject application' }).click();
  await a.getByText(`${applicantName} was rejected.`).waitFor();
  const d2 = await openPage('applicant-rejected');
  await loggedIn(d2, applicant);
  await d2.getByText(/Reason: The vehicle registration photo is blurry/).waitFor();
  await shoot(d2, '28-driver-status-rejected-with-reason');

  // ---- Ratings
  const dp = await openPage('driver');
  await loggedIn(dp, driver);
  await go(dp, '/profile');
  await dp.getByText('Your rating').waitFor();
  await shoot(dp, '29-driver-profile-rating');
  await go(dp, '/driver-dashboard');
  await dp.getByText(/from \d+ rating|No ratings yet/).first().waitFor();
  await shoot(dp, '32-driver-console-rating', false);

  const pp = await openPage('parent');
  await loggedIn(pp, parent);
  await go(pp, '/rides');
  await pp.getByRole('button', { name: 'Past' }).click();
  const rate = pp.getByRole('button', { name: 'Rate driver' }).first();
  if (await rate.waitFor({ timeout: 30000 }).then(() => true).catch(() => false)) {
    await rate.click();
    await pp.getByRole('radio', { name: '5 stars' }).click();
    await dialog(pp).locator('textarea').fill('On time, friendly, and kept us updated. Thank you!');
    await shoot(pp, '30-parent-rate-driver', false);
    await dialog(pp).getByRole('button', { name: 'Not now' }).click();
  } else {
    note('parent: no unrated completed ride, skipped 30-parent-rate-driver');
  }

  // ---- Assigned ride: parent sees the driver's rating; driver's cancel dialog on a phone
  const pt = await token(parent), dt = await token(driver);
  for (const t of [pt, dt]) {
    const active = await (await api.get('rides/active', authed(t))).json();
    if (active?.id) await api.put(`rides/${active.id}/cancel`, authed(t));
  }
  const kids = await (await api.get('users/children', authed(pt))).json();
  const quote = await (await api.post('rides/quote', authed(pt, { serviceType: 'pickup_and_dropoff' }))).json();
  const ride = await (await api.post('rides/request', authed(pt, { childId: kids[0].id, pickup: '10 Downing Street, London', dropoff: 'Primrose Hill School, London', serviceType: 'pickup_and_dropoff', quotedPrice: quote.price, pickupTime: new Date().toISOString() }))).json();
  rideToCancel = { id: ride.id, token: pt };
  const accepted = await api.put(`rides/${ride.id}/accept`, authed(dt));
  if (!accepted.ok()) throw new Error(`Driver could not accept the test ride: HTTP ${accepted.status()}`);
  await go(pp, `/tracking/${ride.id}`);
  await pp.getByText(/rating|No ratings yet/).first().waitFor();
  await shoot(pp, '31-parent-tracking-driver-rating');

  const phone = await openPage('driver-phone', 390, 844);
  await loggedIn(phone, driver);
  await go(phone, '/driver-dashboard');
  await phone.getByRole('button', { name: 'Cancel Ride' }).click();
  await dialog(phone).waitFor();
  await shoot(phone, '34-modal-cancel-ride-phone', false);
  await dialog(phone).getByRole('button', { name: 'Cancel ride', exact: true }).click();
  await dialog(phone).waitFor({ state: 'detached' });
  rideToCancel = null;
} catch (err) {
  failed = true;
  note(`FLOW FAILED: ${err.message.split('\n')[0]}`);
  let index = 0;
  for (const context of browser.contexts()) for (const pg of context.pages()) {
    note(`  page ${++index}: ${pg.url()}`);
    await pg.screenshot({ path: path.join(outDir, `29-failure-page-${index}.png`), timeout: 30000 }).catch(() => {});
  }
} finally {
  // Never leave a test account blocked or a test ride open.
  if (blockedId) await api.put(`users/${blockedId}/unblock`, authed(adminToken)).catch(() => {});
  if (rideToCancel) await api.put(`rides/${rideToCancel.id}/cancel`, authed(rideToCancel.token)).catch(() => {});
  await browser.close();
  await api.dispose();
}

await writeFile(path.join(outDir, 'admin-console-log.txt'), log.length ? log.join('\n') + '\n' : 'No console errors or page errors.\n');
console.log(log.length ? `\n${log.length} problem line(s) - see admin-console-log.txt` : '\nNo console errors or page errors.');
process.exitCode = failed || log.length ? 1 : 0;
