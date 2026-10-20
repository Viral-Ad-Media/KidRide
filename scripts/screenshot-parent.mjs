// Parent-side visual check (screenshots 40-59): sign-up, children, booking every
// service type, live tracking with a real driver, rating, profile, and the
// notifications, payments, safety and help pages. Cancels any ride it leaves open.
//
// Usage (PowerShell, from the KidRide folder):
//   $env:KIDRIDE_NEW_PARENT_EMAIL / KIDRIDE_NEW_PARENT_PASSWORD  parent to sign up (logged in if it exists)
//   $env:KIDRIDE_DRIVER_EMAIL / KIDRIDE_DRIVER_PASSWORD          approved driver who takes the ride
//   node scripts/screenshot-parent.mjs
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
const parent = { email: process.env.KIDRIDE_NEW_PARENT_EMAIL, password: process.env.KIDRIDE_NEW_PARENT_PASSWORD };
const driver = { email: process.env.KIDRIDE_DRIVER_EMAIL, password: process.env.KIDRIDE_DRIVER_PASSWORD };
if (!parent.email || !parent.password || !driver.email || !driver.password) {
  console.error('Set KIDRIDE_NEW_PARENT_EMAIL/PASSWORD and KIDRIDE_DRIVER_EMAIL/PASSWORD first.');
  process.exit(1);
}

const OWN_FILES = /^(4[0-9]|5[0-9])-.*\.png$|^parent-console-log\.txt$/;
await mkdir(outDir, { recursive: true });
for (const f of await readdir(outDir)) if (OWN_FILES.test(f)) await unlink(path.join(outDir, f));

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

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
page.setDefaultTimeout(90000);
page.setDefaultNavigationTimeout(90000);
page.on('pageerror', (err) => note(`page error: ${err.message}`));
page.on('console', (msg) => { if (msg.type() === 'error') note(`console error: ${msg.text().split('\n')[0]}`); });
page.on('response', (res) => {
  const url = res.url();
  // The safety assistant answers 503 when no AI key is configured; that is reported separately.
  if (url.startsWith(apiUrl) && res.status() >= 400 && !url.endsWith('/safety-chat')) note(`API ${res.status()} ${res.request().method()} ${url.slice(apiUrl.length)}`);
});

const shoot = async (name, fullPage = true) => {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.getByText(/^Loading/).first().waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
  await sleep(700);
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage, timeout: 90000 });
  console.log(`saved ${name}.png`);
};
const go = async (hash) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.goto(`${baseUrl}/#${hash}`);
    await sleep(1500);
    if (new URL(page.url()).hash === `#${hash}`) return;
  }
  throw new Error(`Could not stay on #${hash} (now ${new URL(page.url()).hash})`);
};
const dialog = () => page.getByRole('dialog');

let failed = false;
let rideToCancel = null;
try {
  // ---- 40-41 Sign up (or log in if this parent already exists)
  await page.goto(`${baseUrl}/#/login`);
  await page.getByRole('button', { name: 'Switch to Sign Up' }).click();
  await page.getByPlaceholder('e.g. Jordan Lee').fill('Luqman Test Parent Three');
  await page.getByPlaceholder('you@example.com').fill(parent.email);
  await page.getByPlaceholder('Create a secure password').fill(parent.password);
  await page.getByPlaceholder('Repeat your password').fill(parent.password);
  await shoot('40-parent-signup', false);
  await page.click('button[type="submit"]');
  await Promise.race([
    page.waitForURL(/#\/dashboard/, { timeout: 60000 }),
    page.getByText(/already exists/i).waitFor({ timeout: 60000 })
  ]);
  if (!/#\/dashboard/.test(page.url())) {
    note('sign-up: account already exists, logging in instead');
    await page.getByRole('button', { name: 'Switch to Log In' }).click();
    await page.getByPlaceholder('you@example.com').fill(parent.email);
    await page.getByPlaceholder('Enter your password').fill(parent.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/#\/dashboard/);
  }
  const pt = await token(parent);
  // Start from a clean slate: no open ride and no children from an earlier run.
  const leftover = await (await api.get('rides/active', authed(pt))).json();
  if (leftover?.id) await api.put(`rides/${leftover.id}/cancel`, authed(pt));
  for (const child of await (await api.get('users/children', authed(pt))).json()) await api.delete(`users/children/${child.id}`, authed(pt));
  await page.reload();
  await shoot('41-parent-dashboard-new');

  // ---- 42-45 Children: add two, edit one, remove one
  for (const [name, age, notes] of [['Maya', '7', 'Allergic to peanuts, carries an EpiPen'], ['Sam', '10', '']]) {
    await go('/add-child');
    await page.getByPlaceholder('e.g. Leo').fill(name);
    await page.getByPlaceholder('e.g. 8').fill(age);
    if (notes) await page.getByPlaceholder(/Peanut allergy/).fill(notes);
    if (name === 'Maya') await shoot('42-add-child');
    await Promise.all([
      page.waitForResponse((res) => res.url().endsWith('/users/children') && res.request().method() === 'POST'),
      page.getByRole('button', { name: 'Save Profile' }).click()
    ]);
    await page.waitForURL(/#\/dashboard/);
    await page.getByText(name, { exact: true }).first().waitFor();
  }
  await shoot('43-dashboard-two-children');
  const mayaCard = page.locator('div.rounded-\\[24px\\]', { hasText: 'Maya' }).first();
  await mayaCard.getByRole('button', { name: 'Edit profile' }).click();
  await page.waitForURL(/#\/edit-child\//);
  await page.getByPlaceholder('e.g. 8').fill('8');
  await shoot('44-edit-child');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await page.waitForURL(/#\/dashboard/);
  await page.getByText('8 years old').first().waitFor();
  const samCard = page.locator('div.rounded-\\[24px\\]', { hasText: 'Sam' }).first();
  await samCard.getByRole('button', { name: 'Edit profile' }).click();
  await page.getByRole('button', { name: 'Remove this child' }).click();
  await dialog().waitFor();
  await shoot('45-remove-child-modal', false);
  await dialog().getByRole('button', { name: 'Remove child' }).click();
  await page.waitForURL(/#\/dashboard/);
  note(`children after edit/remove: ${(await (await api.get('users/children', authed(pt))).json()).map((c) => `${c.name} (${c.age})`).join(', ')}`);

  // ---- 46-47 Booking: every service type with its price, then a round trip
  await go('/book');
  await page.getByText('Maya').first().click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByPlaceholder('e.g. Home, 123 Maple St').fill('10 Downing Street, London');
  await page.getByPlaceholder('e.g. Soccer Field').fill('Primrose Hill School, London');
  const select = page.locator('select').first();
  await page.waitForFunction(() => [...document.querySelectorAll('select option')].some((o) => o.textContent?.includes('$')), null, { timeout: 30000 }).catch(() => {});
  note(`service options: ${(await select.locator('option').allTextContents()).join(' | ')}`);
  await select.selectOption('pickup_and_dropoff');
  await shoot('46-book-service-and-price');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByText(/Fixed service fare/).waitFor();
  await shoot('47-book-review');
  await page.getByRole('button', { name: 'Confirm & Book' }).click();
  await page.getByRole('button', { name: 'View Request' }).click({ timeout: 90000 });
  await page.waitForURL(/#\/tracking\//);
  const rideId = new URL(page.url()).hash.split('/').pop();
  rideToCancel = { id: rideId, token: pt };
  await shoot('48-tracking-searching');

  // ---- 49-50 The real driver flow (driver steps through the API)
  const dt = await token(driver);
  const accepted = await api.put(`rides/${rideId}/accept`, authed(dt));
  if (!accepted.ok()) throw new Error(`Driver could not accept: HTTP ${accepted.status()}`);
  await page.reload();
  await page.getByText(/DRIVER ASSIGNED|Driver assigned/i).first().waitFor();
  await shoot('49-tracking-driver-assigned');
  for (const status of ['driver_arrived_at_pickup', 'child_picked_up']) await api.put(`rides/${rideId}/status`, authed(dt, { status }));
  await page.reload();
  await page.getByText(/picked up|in progress/i).first().waitFor().catch(() => {});
  await shoot('50-tracking-in-progress');
  await api.put(`rides/${rideId}/status`, authed(dt, { status: 'completed' }));
  rideToCancel = null;

  // ---- 51-53 Past rides and rating
  await go('/rides');
  await page.getByRole('button', { name: 'Past' }).click();
  await page.getByRole('button', { name: 'Rate driver' }).first().waitFor();
  await shoot('51-rides-past-rate-button');
  await page.getByRole('button', { name: 'Rate driver' }).first().click();
  await page.getByRole('radio', { name: '4 stars' }).click();
  await dialog().locator('textarea').fill('Friendly and on time. Would book again.');
  await shoot('52-rate-driver-modal', false);
  await page.getByRole('button', { name: 'Submit rating' }).click();
  await page.getByText('Your rating').first().waitFor();
  await shoot('53-rides-past-rated');

  // ---- 54-56 Profile, notifications, payments
  await go('/profile');
  await page.getByRole('button', { name: 'Edit' }).click();
  await page.getByPlaceholder('(555) 123-4567').fill('(555) 020-0003');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByText('(555) 020-0003').waitFor();
  await shoot('54-profile-edited');
  await go('/profile/notifications');
  await page.getByText('Coming soon').first().waitFor();
  await shoot('55-notifications-coming-soon');
  await go('/profile/payments');
  await page.getByText('Coming soon').first().waitFor();
  await shoot('56-payments-coming-soon');

  // ---- 57-59 Safety, assistant, help
  await go('/safety');
  await shoot('57-safety');
  const chatEntry = page.getByText('AI safety guidance').first();
  if (await chatEntry.count()) {
    await chatEntry.click().catch(() => {});
    const input = page.getByPlaceholder('Ask a safety question...');
    if (await input.waitFor({ timeout: 10000 }).then(() => true).catch(() => false)) {
      await input.fill('What should I check before my child gets in the car?');
      await input.press('Enter');
      await sleep(8000);
      await shoot('58-safety-assistant', false);
    }
  }
  await go('/help');
  await shoot('59-help');
  await go('/contact');
  note(`contact page heading: ${(await page.locator('h1, h2').first().innerText().catch(() => 'none')).slice(0, 80)}`);
} catch (err) {
  failed = true;
  note(`FLOW FAILED: ${err.message.split('\n')[0]}`);
  await page.screenshot({ path: path.join(outDir, '59-failure.png'), timeout: 30000 }).catch(() => {});
} finally {
  if (rideToCancel) await api.put(`rides/${rideToCancel.id}/cancel`, authed(rideToCancel.token)).catch(() => {});
  await browser.close();
  await api.dispose();
}

await writeFile(path.join(outDir, 'parent-console-log.txt'), log.join('\n') + '\n');
console.log(failed ? '\nFlow failed - see parent-console-log.txt' : '\nDone - details in parent-console-log.txt');
process.exitCode = failed ? 1 : 0;
