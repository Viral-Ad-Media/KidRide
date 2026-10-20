// Visual check of the driver approval flow on the local KidRide web app.
// Driver applies (dummy PNG documents + fake-camera photos), admin approves it in the UI,
// then the driver sees the driver console. The driver must not have applied yet.
//
// Usage (PowerShell, from the KidRide folder):
//   $env:KIDRIDE_DRIVER_EMAIL='...'; $env:KIDRIDE_DRIVER_PASSWORD='...'
//   $env:KIDRIDE_ADMIN_EMAIL='...'; $env:KIDRIDE_ADMIN_PASSWORD='...'
//   node scripts/approval-flow.mjs
// Env: KIDRIDE_URL (default http://localhost:3001), KIDRIDE_API_URL (default http://localhost:5000/api),
//      KIDRIDE_SCREENSHOT_DIR (default ../test-screenshots)
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const baseUrl = process.env.KIDRIDE_URL || 'http://localhost:3001';
const apiUrl = process.env.KIDRIDE_API_URL || 'http://localhost:5000/api';
const driver = { email: process.env.KIDRIDE_DRIVER_EMAIL, password: process.env.KIDRIDE_DRIVER_PASSWORD };
const admin = { email: process.env.KIDRIDE_ADMIN_EMAIL, password: process.env.KIDRIDE_ADMIN_PASSWORD };
const outDir = process.env.KIDRIDE_SCREENSHOT_DIR
  || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'test-screenshots');

if (!driver.email || !driver.password || !admin.email || !admin.password) {
  console.error('Set KIDRIDE_DRIVER_EMAIL/PASSWORD and KIDRIDE_ADMIN_EMAIL/PASSWORD first.');
  process.exit(1);
}

// 1x1 PNG used as a stand-in for each document.
const dummyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

await mkdir(outDir, { recursive: true });
const log = [];
const note = (line) => { log.push(line); console.log(line); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Fake camera so the liveness photos can be captured headless.
const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });

const openPage = async (label) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['camera'] });
  const page = await context.newPage();
  page.on('console', (msg) => { if (msg.type() === 'error') note(`[${label}] console error: ${msg.text().split('\n')[0]}`); });
  page.on('pageerror', (err) => note(`[${label}] page error: ${err.message}`));
  page.on('response', (res) => {
    if (res.url().startsWith(apiUrl) && res.status() >= 300) note(`[${label}] API ${res.status()} ${res.request().method()} ${res.url().slice(apiUrl.length)}`);
  });
  return page;
};

const shoot = async (page, name) => {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.getByText(/^Loading/).first().waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
  await sleep(500);
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true, timeout: 90000 });
  console.log(`saved ${name}.png`);
};

const loginViaUi = async (page, { email, password }) => {
  await page.goto(`${baseUrl}/#/login`);
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('Enter your password').fill(password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.hash.startsWith('#/login'), { timeout: 20000 });
};

let failed = false;
try {
  // ---- Driver applies
  const d = await openPage('driver');
  await loginViaUi(d, driver);
  await d.goto(`${baseUrl}/#/driver-signup`);
  await d.getByPlaceholder('(555) 123-4567').fill('(555) 010-0000');
  await d.getByRole('button', { name: 'Next: Vehicle Details' }).click();
  await d.getByPlaceholder('e.g. Toyota').fill('Toyota');
  await d.getByPlaceholder('e.g. Sienna').fill('Sienna');
  await d.getByPlaceholder('2020').fill('2020');
  await d.getByPlaceholder('Silver').fill('Silver');
  await d.getByPlaceholder('ABC-1234').fill('TEST-123');
  await d.getByRole('button', { name: 'Next: Documents' }).click();

  const fileInputs = d.locator('input[type="file"]');
  for (const [i, name] of ['license.png', 'insurance.png', 'registration.png'].entries()) {
    await fileInputs.nth(i).setInputFiles({ name, mimeType: 'image/png', buffer: dummyPng });
  }
  await d.getByRole('button', { name: 'Start Camera' }).click();
  for (let i = 0; i < 3; i++) {
    await d.waitForFunction(() => (document.querySelector('video')?.videoWidth || 0) > 0, null, { timeout: 15000 });
    await d.locator('video').locator('xpath=..').locator('button').click();
    await sleep(400);
  }
  await d.getByRole('button', { name: 'Confirm Photos' }).click();
  await d.getByText('3D photos captured').waitFor({ timeout: 10000 });
  await shoot(d, '20-driver-upload');
  await d.getByRole('button', { name: 'Submit Application' }).click();
  await d.getByRole('button', { name: /Submit|Submitting/ }).waitFor({ state: 'detached', timeout: 90000 });
  await shoot(d, '21-driver-submitted');

  // ---- Admin reviews and approves
  const a = await openPage('admin');
  await loginViaUi(a, admin);
  await a.goto(`${baseUrl}/#/admin`);
  const row = a.getByRole('button', { name: /Luqman Test Driver/ }).first();
  await row.waitFor({ timeout: 30000 });
  await shoot(a, '22-admin-pending-list');
  await row.click();
  const approve = a.getByRole('button', { name: 'Approve', exact: true });
  await approve.waitFor({ timeout: 30000 });
  await a.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent?.trim() === 'Approve' && !b.disabled), null, { timeout: 30000 });
  await shoot(a, '23-admin-review');
  await approve.click();
  await a.getByRole('button', { name: 'Approve driver' }).click();
  await a.getByRole('button', { name: 'Approve driver' }).waitFor({ state: 'detached', timeout: 30000 });
  await shoot(a, '24-admin-approved');

  // ---- Driver logs in again and lands on the driver console
  const d2 = await openPage('driver-after');
  await loginViaUi(d2, driver);
  await shoot(d2, '25-driver-approved');
  if (!/#\/driver-dashboard/.test(d2.url())) note(`driver: after approval landed on ${new URL(d2.url()).hash} instead of the driver console`);
} catch (err) {
  failed = true;
  note(`FLOW FAILED: ${err.message.split('\n')[0]}`);
  for (const ctx of browser.contexts()) for (const pg of ctx.pages()) await shoot(pg, `approval-failure-${Date.now()}`).catch(() => {});
} finally {
  await browser.close();
}

await writeFile(path.join(outDir, 'approval-console-log.txt'), log.length ? log.join('\n') + '\n' : 'No console errors or non-2xx API calls.\n');
console.log(log.length ? `\n${log.length} problem line(s) - see approval-console-log.txt` : '\nNo console errors, page errors or failed API calls.');
process.exitCode = failed || log.length ? 1 : 0;
