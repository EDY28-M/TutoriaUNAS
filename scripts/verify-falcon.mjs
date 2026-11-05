import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'frontend/package.json'));
const { chromium } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const out = resolve(root, 'artifacts/falcon');
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const results = [];
const errors = [];
const widths = [1920, 1440, 1366, 1024, 768, 390, 375];
const accounts = [
  { role: 'estudiante', label: 'Estudiante', id: '2023010456', modules: ['dashboard', 'sesiones', 'tutor', 'instrumentos', 'expediente', 'derivaciones', 'salud', 'documentos', 'avisos', 'perfil', 'preferencias'] },
  { role: 'tutor', label: 'Tutor', id: 'DOC-0421', modules: ['dashboard', 'tutorados', 'sesiones', 'derivaciones', 'instrumentos', 'horario', 'reportes', 'avisos', 'perfil', 'preferencias'] },
  { role: 'coordinacion', label: 'Coordinación', id: 'coordinacion.tutoria', modules: ['dashboard', 'asignaciones', 'tutores', 'tutorados', 'plan', 'revisiones', 'reportes', 'horarios', 'avisos', 'instrumentos', 'campos', 'permisos', 'integraciones', 'semestres', 'auditoria', 'perfil', 'preferencias'] },
];
async function check(name, fn) {
  try { await fn(); results.push({ name, pass: true }); }
  catch (error) { results.push({ name, pass: false, error: error.message }); console.log(`FAIL ${name}: ${error.message}`); }
}
async function overflow(page) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 1, 'horizontal page overflow');
}
async function visit(page, route) {
  await page.goto(`http://127.0.0.1:5173${route}`);
  await page.locator('.workspace h1').waitFor();
  assert.equal(await page.getByText('No se pudo mostrar esta pantalla', { exact: true }).count(), 0);
  await overflow(page);
}
async function accessible(page) {
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  assert.deepEqual(axe.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })), []);
}
try {
  const authContext = await browser.newContext();
  const auth = await authContext.newPage();
  auth.setDefaultTimeout(6000);
  auth.on('pageerror', e => errors.push(e.message));
  for (const width of widths) await check(`login ${width}`, async () => {
    await auth.setViewportSize({ width, height: 900 });
    await auth.goto('http://127.0.0.1:5173/login');
    await auth.locator('.d01__form').waitFor();
    await auth.evaluate(() => document.fonts.ready);
    await overflow(auth);
    assert.ok(await auth.locator('.d01__photo').isVisible(), 'login photo hidden');
    assert.equal(await auth.getByRole('tablist').count(), 0, 'login must be role-independent');
    if ([390, 1366].includes(width)) await auth.screenshot({ path: resolve(out, `login-${width}.png`), fullPage: false });
  });
  await auth.setViewportSize({ width: 1366, height: 900 });
  await check('login accessibility', () => accessible(auth));
  await check('password visibility', async () => {
    await auth.locator('#password').fill('tutoria2026');
    await auth.getByRole('button', { name: 'Mostrar contraseña' }).click();
    assert.equal(await auth.locator('#password').getAttribute('type'), 'text');
    await auth.getByRole('button', { name: 'Ocultar contraseña' }).click();
  });
  await check('recovery responsive + accessibility', async () => {
    await auth.goto('http://127.0.0.1:5173/recuperar-clave');
    await auth.locator('.d01__panel').waitFor();
    for (const width of widths) { await auth.setViewportSize({ width, height: 900 }); await overflow(auth); }
    await accessible(auth);
  });
  await auth.close();
  for (const account of accounts) {
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const page = await context.newPage();
    page.setDefaultTimeout(6000);
    page.on('pageerror', e => errors.push(e.message));
    await check(`${account.role} login`, async () => {
      await page.goto('http://127.0.0.1:5173/login');
      await page.locator('#identifier').fill(account.id);
      await page.locator('#password').fill('tutoria2026');
      await page.locator('.d01__form .d01__cta').click();
      await page.waitForURL(`**/${account.role}/dashboard`);
      await page.locator('.workspace h1').waitFor();
      await page.locator('.portal-chart canvas').first().waitFor();
    });
    for (const width of widths) await check(`${account.role} dashboard ${width}`, async () => {
      await page.setViewportSize({ width, height: 900 });
      await visit(page, `/${account.role}/dashboard`);
      await page.locator('.portal-chart canvas').first().waitFor();
      await overflow(page);
      if ([390, 1366].includes(width)) await page.screenshot({ path: resolve(out, `${account.role}-${width}.png`), fullPage: false });
    });
    await page.setViewportSize({ width: 1366, height: 900 });
    await check(`${account.role} dashboard accessibility`, () => accessible(page));
    await check(`${account.role} filter updates charts`, async () => {
      await page.getByLabel('Periodo', { exact: true }).selectOption('7');
      await page.locator('.portal-chart canvas').first().waitFor();
      assert.ok((await page.locator('.dashboard-filters__title').innerText()).includes('oct'));
      await page.getByLabel('Periodo', { exact: true }).selectOption('semestre');
    });
    for (const width of [1366, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const module of account.modules) await check(`${account.role}/${module} ${width}`, () => visit(page, `/${account.role}/${module}`));
    }
    await page.setViewportSize({ width: 390, height: 900 });
    await check(`${account.role} drawer Escape`, async () => {
      await visit(page, `/${account.role}/dashboard`);
      const trigger = page.locator('.topbar__menu');
      await trigger.click();
      assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
      await page.keyboard.press('Escape');
      assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
      assert.ok(await trigger.evaluate(button => document.activeElement === button));
    });
    if (account.role !== 'coordinacion') await check(`${account.role} query routes + reload`, async () => {
      await visit(page, `/${account.role}/instrumentos?estado=observado`);
      await page.reload(); await page.locator('.workspace h1').waitFor();
      assert.equal(await page.locator('.data-table tbody .badge').filter({ hasText: 'Enviado' }).count(), 0);
      await visit(page, `/${account.role}/sesiones?vista=historial`);
      await visit(page, `/${account.role}/derivaciones?estado=seguimiento`);
    });
    await check(`${account.role} role restriction`, async () => {
      await page.goto(`http://127.0.0.1:5173/${account.role === 'coordinacion' ? 'tutor' : 'coordinacion'}/dashboard`);
      await page.waitForURL('**/no-autorizado');
    });
    await page.close();
    console.log(`Checked ${account.role}`);
  }
} finally {
  await browser.close();
  const report = { date: '2026-10-15', widths, passed: results.filter(r => r.pass).length, failed: results.filter(r => !r.pass).length, errors, results };
  await writeFile(resolve(out, 'verification.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed, errors }));
  if (report.failed || errors.length) process.exitCode = 1;
}
