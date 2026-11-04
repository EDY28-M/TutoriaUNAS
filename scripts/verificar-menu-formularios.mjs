import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const require = createRequire(new URL('../frontend/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const base = 'http://127.0.0.1:5173';
const output = new URL('../artifacts/menu-formularios/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const account of [
    { role: 'estudiante', id: '2023010456' },
    { role: 'tutor', id: 'DOC-0421' },
    { role: 'coordinacion', id: 'coordinacion.tutoria' },
  ]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    let preferences;
    let stateReads = 0;
    let rejectNext = false;
    const writes = [];
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    // Se usa la sesión real de desarrollo, con preferencias simuladas. No se
    // modifica la configuración de las cuentas que utiliza el usuario.
    await page.route('**/api/tutoria/estado', async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      preferences ??= { ...body.sistema.preferencias, pantalla: { ...body.sistema.preferencias.pantalla, sidebarMini: false } };
      body.sistema.preferencias = structuredClone(preferences);
      stateReads++;
      await route.fulfill({ response, json: body });
    });
    await page.route('**/api/sistema/preferencias', async (route) => {
      const body = route.request().postDataJSON();
      writes.push(structuredClone(body));
      assert.deepEqual(body.avisos, preferences.avisos, 'Conservar las preferencias de avisos');
      assert.equal(body.version, preferences.version, 'Usar la versión confirmada');
      if (rejectNext) {
        rejectNext = false;
        return route.fulfill({ status: 409, json: { title: 'No se pudo guardar el ajuste de prueba.' } });
      }
      preferences = { ...body, version: body.version + 1 };
      return route.fulfill({ status: 204 });
    });
    try {
      await page.goto(`${base}/login`);
      await page.locator(`#login-role-${account.role}`).click();
      await page.locator('#identifier').fill(account.id);
      await page.locator('#password').fill('tutoria2026');
      await page.locator('button[type="submit"]').click();
      await page.waitForURL(`**/${account.role}/dashboard`);
      const shell = page.locator('.app-shell');
      await expect(shell).not.toHaveClass(/app-shell--mini/);
      await page.locator('.sidebar__toggle').click();
      await expect(shell).toHaveClass(/app-shell--mini/);
      assert.equal(preferences.pantalla.sidebarMini, true);
      const readsBefore = stateReads;
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await expect.poll(() => stateReads).toBeGreaterThan(readsBefore);
      await expect(shell).toHaveClass(/app-shell--mini/);
      if (account.role === 'tutor') {
        const beforePolling = stateReads;
        await expect.poll(() => stateReads, { timeout: 12000 }).toBeGreaterThan(beforePolling);
        await expect(shell).toHaveClass(/app-shell--mini/);
      }
      await page.reload();
      await page.getByRole('heading', { level: 1 }).first().waitFor();
      await expect(shell).toHaveClass(/app-shell--mini/);
      await page.goto(`${base}/${account.role}/instrumentos`);
      await page.getByRole('heading', { level: 1 }).first().waitFor();
      await expect(shell).toHaveClass(/app-shell--mini/);
      const iconSelector = '.teacher-task__icon > svg, .form-tile__icon > svg';
      const icons = page.locator(iconSelector);
      if (account.role !== 'coordinacion') {
        await expect(icons.first()).toBeVisible();
        const sizes = await icons.evaluateAll((items) => items.map((item) => ({ width: item.getBoundingClientRect().width, height: item.getBoundingClientRect().height })));
        assert(sizes.every((size) => size.width === 36 && size.height === 36));
        await page.locator(account.role === 'tutor' ? '.teacher-forms__tasks' : '.form-tile').first().screenshot({ path: fileURLToPath(new URL(`${account.role}-iconos.png`, output)), animations: 'disabled' });
      }
      await page.goto(`${base}/${account.role}/preferencias`);
      await expect(page.getByRole('checkbox', { name: 'Mostrar solo iconos en el menú' })).toBeChecked();
      const beforeMobile = writes.length;
      await page.setViewportSize({ width: 390, height: 960 });
      await page.locator('#sidebar-trigger').click();
      await expect(page.locator('#app-sidebar')).toHaveClass(/sidebar--open/);
      await page.keyboard.press('Escape');
      await expect(page.locator('#app-sidebar')).not.toHaveClass(/sidebar--open/);
      await expect(page.locator('#sidebar-trigger')).toBeFocused();
      assert.equal(writes.length, beforeMobile, 'El drawer no cambia la preferencia de escritorio');
      await page.setViewportSize({ width: 1440, height: 960 });
      await expect(shell).toHaveClass(/app-shell--mini/);
      rejectNext = true;
      await page.locator('.sidebar__toggle').click();
      await expect(page.getByRole('alert')).toContainText('No se guardó el ajuste del menú');
      await expect(shell).toHaveClass(/app-shell--mini/);
      await page.locator('.sidebar__toggle').click();
      await expect(shell).not.toHaveClass(/app-shell--mini/);
      await expect(page.getByRole('checkbox', { name: 'Mostrar solo iconos en el menú' })).not.toBeChecked();
      assert.deepEqual(errors, []);
      results.push({ role: account.role, stateReads, preferenceWrites: writes.length, status: 'PASS' });
      console.log(`${account.role}: iconos, guardado, actualización, recarga, navegación, móvil y error PASS`);
    } catch (error) {
      await page.screenshot({ path: fileURLToPath(new URL(`${account.role}-fallo.png`, output)), fullPage: true });
      throw error;
    } finally {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await context.close();
    }
  }
  await writeFile(new URL('verificacion.json', output), JSON.stringify({ results, status: 'PASS' }, null, 2));
} finally { await browser.close(); }
