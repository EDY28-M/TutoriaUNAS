import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../frontend/package.json', import.meta.url));
const { chromium } = require('@playwright/test');
const output = fileURLToPath(new URL('../artifacts/analisis-tutoria/navegador/', import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
const errors = [];
const widths = [320, 375, 390, 768, 1024, 1440];
try {
  for (const account of [
    { role: 'estudiante', label: 'Estudiante', id: '2023010456', route: 'instrumentos' },
    { role: 'tutor', label: 'Tutor', id: 'DOC-0421', route: 'tutorados/EST-2023010456' },
    { role: 'coordinacion', label: 'Coordinación', id: 'coordinacion.tutoria', route: 'integraciones' },
  ]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(`${account.role}: ${e.message}`));
    await page.goto('http://127.0.0.1:5173/login');
    await page.getByRole('tab', { name: account.label, exact: true }).click();
    await page.locator('#identifier').fill(account.id);
    await page.locator('#password').fill('tutoria2026');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(`**/${account.role}/dashboard`);
    await page.goto(`http://127.0.0.1:5173/${account.role}/${account.route}`);
    await page.locator('.page-head h1').waitFor();
    if (account.role === 'estudiante') {
      await page.getByLabel('Momento del semestre').selectOption('inicio');
      await page.getByRole('button', { name: /^(Comenzar|Continuar|Corregir entrevista) · Formato 03$/ }).click();
      await page.getByRole('dialog').waitFor();
    }
    if (account.role === 'tutor') {
      await page.getByRole('tab', { name: /Bienestar/ }).click();
      if (await page.getByText(/Motivo:.*(malestar|cefalea|fatiga)/i).count()) throw new Error('Se expone un motivo médico');
    }
    if (account.role === 'coordinacion') {
      await page.getByText('Bienestar requiere un plan de trabajo antes de autorizar el acceso', { exact: true }).waitFor();
    }
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(() => document.fonts.ready);
      const dimensions = await page.evaluate(() => ({
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        dialog: document.querySelector('[role="dialog"]')?.getBoundingClientRect().toJSON() ?? null,
      }));
      if (dimensions.scrollWidth > width + 1) throw new Error(`${account.role}: desbordamiento en ${width}`);
      if (dimensions.dialog && (dimensions.dialog.x < -1 || dimensions.dialog.right > width + 1)) throw new Error(`Formulario fuera de pantalla en ${width}`);
      results.push({ role: account.role, ...dimensions });
      if ([320, 1440].includes(width)) await page.screenshot({ path: `${output}/${account.role}-${width}.png`, fullPage: true });
    }
    if (account.role === 'tutor') {
      await page.goto('http://127.0.0.1:5173/tutor/tutorados/EST-2023010556');
      await page.getByRole('heading', { name: 'Expediente no disponible', exact: true }).waitFor();
      results.push({ check: 'expediente fuera de asignación', passed: true });
    }
    await context.close();
  }
  if (errors.length) throw new Error(errors.join('\n'));
  await writeFile(`${output}/resultado.json`, JSON.stringify({ results, errors }, null, 2));
  console.log(JSON.stringify({ checks: results.length, errors: errors.length, output }));
} finally {
  await browser.close();
}
