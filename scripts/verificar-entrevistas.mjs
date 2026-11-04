import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const require = createRequire(new URL('../frontend/package.json', import.meta.url));
const { chromium } = require('@playwright/test');
const output = new URL('../artifacts/revision-entrevistas/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const resultados = [];
try {
  for (const caso of [
    { ciclo: 3, usuario: '2023010456', formato: 'F03' },
    { ciclo: 5, usuario: '2023010458', formato: 'F04' },
    { ciclo: 9, usuario: '2023010462', formato: 'F05' },
  ]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
    try {
      const page = await context.newPage();
      const errores = [];
      page.on('pageerror', error => errores.push(error.message));
      await page.goto('http://127.0.0.1:5173/login');
      await page.locator('#identifier').fill(caso.usuario);
      await page.locator('#password').fill('tutoria2026');
      const cargado = page.waitForResponse(r => r.url().endsWith('/api/tutoria/estado') && r.ok());
      await page.locator('button[type="submit"]').click();
      await cargado;
      await page.waitForURL('**/estudiante/dashboard');
      await page.goto('http://127.0.0.1:5173/estudiante/instrumentos');
      const tarjeta = page.locator(`[data-instrument="${caso.formato}"]`);
      await tarjeta.waitFor();
      assert.equal(await page.locator('[data-instrument="F03"], [data-instrument="F04"], [data-instrument="F05"]').count(), 1);
      assert.equal(await page.getByLabel('Momento del semestre').count(), 0);
      for (const ancho of [320, 375, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width: ancho, height: 950 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        await tarjeta.locator('button').click();
        const modal = page.getByRole('dialog');
        await modal.waitFor();
        const nombre = modal.locator('[data-field="nombreEstudiante"]');
        assert.equal(await nombre.locator('input').count(), 0);
        assert.equal(await modal.evaluate(e => e.scrollWidth > e.clientWidth + 1), false);
        assert.equal(await modal.getByRole('button', { name: 'Guardar borrador', exact: true }).isEnabled(), true);
        assert.equal(await modal.getByText(/Datos ya disponibles/).count(), 0);
        const selector = modal.getByLabel('Sección del formulario');
        const paso = await selector.inputValue();
        await selector.selectOption((await selector.locator('option').last().getAttribute('value')));
        await modal.locator('.tutoring-review-section > summary').first().click();
        await nombre.waitFor({ state: 'visible' });
        assert.equal(await modal.evaluate(e => e.scrollWidth > e.clientWidth + 1), false);
        await selector.selectOption(paso);
        if (caso.ciclo === 5 && [390, 1440].includes(ancho))
          await page.screenshot({ path: fileURLToPath(new URL(`formulario-ciclo5-${ancho}.png`, output)), fullPage: true });
        await page.keyboard.press('Escape');
        await modal.waitFor({ state: 'hidden' });
        resultados.push({ ciclo: caso.ciclo, formato: caso.formato, ancho, resultado: 'PASS' });
      }
      assert.deepEqual(errores, []);
      if (caso.ciclo === 5)
        await page.screenshot({ path: fileURLToPath(new URL('bandeja-ciclo5.png', output)), fullPage: true });
    } finally { await context.close(); }
  }
  await writeFile(new URL('verificacion.json', output), JSON.stringify({ fecha: new Date().toISOString(), resultados }, null, 2));
  console.log(JSON.stringify({ escenarios: resultados.length, resultado: 'PASS', detalle: fileURLToPath(new URL('verificacion.json', output)) }));
} finally { await browser.close(); }
