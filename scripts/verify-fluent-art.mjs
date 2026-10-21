import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'artifacts/illustration-refresh');
await mkdir(out, { recursive: true });
const require = createRequire(resolve(root, 'frontend/package.json'));
const { chromium } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const browser = await chromium.launch();
const base = 'http://localhost:8080';
const report = { date: new Date().toISOString(), base, passed: false, views: [], accessibility: [], errors: [], network: [] };
async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(image => image.decode().catch(() => {})));
    await Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {})));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}
async function inspect(page, label) {
  await settle(page);
  const data = await page.evaluate(() => ({
    width: innerWidth,
    overflow: document.documentElement.scrollWidth - innerWidth,
    images: document.querySelectorAll('img.portal-art').length,
    broken: [...document.querySelectorAll('img.portal-art')].filter(image => !image.complete || !image.naturalWidth).map(image => image.src),
    headingArt: document.querySelectorAll('.card__heading .portal-icon,.card__heading i').length,
    genericMetricSymbols: document.querySelectorAll('.stat__visual>svg').length,
  }));
  report.views.push({ label, ...data });
  assert.ok(data.overflow <= 1, `${label}: overflow`);
  assert.equal(data.broken.length, 0, `${label}: broken art`);
  assert.equal(data.headingArt, 0, `${label}: heading art`);
  assert.equal(data.genericMetricSymbols, 0, `${label}: old metric`);
}
async function accessible(page, label) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  const violations = result.violations.map(violation => ({ id: violation.id, impact: violation.impact, targets: violation.nodes.map(node => node.target) }));
  report.accessibility.push({ label, violations });
  assert.deepEqual(violations, []);
}
function watch(page, role) {
  page.on('pageerror', error => report.errors.push({ role, message: error.message }));
  page.on('response', response => {
    if (response.status() >= 400) report.network.push({ role, url: response.url(), status: response.status() });
  });
}
try {
  assert.ok((await fetch(`${base}/assets/licenses/Microsoft-Fluent-Color.txt`).then(response => response.text())).includes('MIT License'));
  const publicContext = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const publicPage = await publicContext.newPage();
  watch(publicPage, 'publico');
  await publicPage.goto(`${base}/login`);
  await publicPage.locator('.role-switch').waitFor();
  await inspect(publicPage, 'login');
  await accessible(publicPage, 'login');
  await publicPage.screenshot({ path: resolve(out, 'login-desktop.png') });
  await publicPage.setViewportSize({ width: 375, height: 900 });
  await inspect(publicPage, 'login mobile');
  await publicPage.screenshot({ path: resolve(out, 'login-mobile.png') });
  await publicPage.goto(`${base}/recuperar-clave`);
  await publicPage.locator('.d01__panel').waitFor();
  await inspect(publicPage, 'recovery mobile');
  await accessible(publicPage, 'recovery');
  await publicContext.close();
  for (const account of [
    { role: 'estudiante', label: 'Estudiante', id: '2023010456' },
    { role: 'tutor', label: 'Tutor', id: 'DOC-0421' },
    { role: 'coordinacion', label: 'Coordinación', id: 'coordinacion.tutoria' },
  ]) {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1000 } });
    const page = await context.newPage();
    watch(page, account.role);
    await page.goto(`${base}/login`);
    await page.getByRole('tab', { name: account.label, exact: true }).click();
    await page.locator('#identifier').fill(account.id);
    await page.locator('#password').fill('tutoria2026');
    await page.locator('.d01__form .d01__cta').click();
    await page.waitForURL(`**/${account.role}/dashboard`);
    await page.locator('.portal-chart canvas').first().waitFor();
    await inspect(page, `${account.role} desktop`);
    await accessible(page, `${account.role} dashboard`);
    assert.ok(await page.locator('img.portal-art').count() > 10);
    await page.screenshot({ path: resolve(out, `${account.role}-desktop.png`) });
    await page.getByRole('button', { name: 'Contraer la barra de navegación', exact: true }).click();
    await inspect(page, `${account.role} mini`);
    const centers = await page.locator('.sidebar__crest,.sidebar__toggle,.sidebar__nav .sidebar__link').evaluateAll(elements => elements.map(element => {
      const bounds = element.getBoundingClientRect();
      return bounds.x + bounds.width / 2;
    }));
    const spread = Math.max(...centers) - Math.min(...centers);
    assert.ok(spread < 1);
    report.views.at(-1).centerSpread = spread;
    await page.screenshot({ path: resolve(out, `${account.role}-mini.png`) });
    await page.getByRole('button', { name: 'Expandir la barra de navegación', exact: true }).click();
    await settle(page);
    await page.setViewportSize({ width: 375, height: 900 });
    await inspect(page, `${account.role} mobile`);
    await page.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().right <= 0);
    await page.screenshot({ path: resolve(out, `${account.role}-mobile.png`) });
    await context.close();
  }
  assert.equal(report.errors.length, 0);
  assert.equal(report.network.length, 0);
  report.passed = true;
  console.log(JSON.stringify({ views: report.views.length, axe: report.accessibility.length, errors: report.errors, network: report.network }));
} finally {
  await browser.close();
  await writeFile(resolve(out, 'production-verification.json'), JSON.stringify(report, null, 2));
}
