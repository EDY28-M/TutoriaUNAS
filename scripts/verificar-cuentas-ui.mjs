import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const require = createRequire(new URL('../frontend/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const output = new URL('../artifacts/cuentas-correo/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const resultados = [];
const errores = [];
const anchos = [320, 375, 390, 768, 1024, 1440];
async function revisar(page, vista, dialog = false) {
  for (const ancho of anchos) {
    await page.setViewportSize({ width: ancho, height: 1000 });
    await page.evaluate(() => document.fonts.ready);
    const exceso = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    const excesoDialogo = dialog ? await page.getByRole('dialog').evaluate((el) => el.scrollWidth - el.clientWidth) : 0;
    assert.ok(exceso <= 1 && excesoDialogo <= 1, `${vista}: desbordamiento a ${ancho}px`);
    resultados.push({ vista, ancho, exceso, excesoDialogo });
  }
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  assert.deepEqual(axe.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })), []);
  await page.screenshot({ path: fileURLToPath(new URL(`${vista}.png`, output)), fullPage: true });
}
try {
  for (const modo of ['registro', 'activacion']) {
    const context = await browser.newContext(); const page = await context.newPage();
    page.on('pageerror', (e) => errores.push(e.message));
    let solicitudes = 0;
    // Solo simula el correo y sus respuestas en el navegador. No solicita códigos reales.
    await page.route('**/api/auth/codigo', (r) => { solicitudes++; return r.fulfill({ json: { retoId: 'RETO-UI-FICTICIO', expiraEn: 600, reenviarEn: 60, mensaje: 'Revisa tu correo institucional, Spam, No deseados y Papelera.' } }); });
    await page.route('**/api/auth/codigo/confirmar', (r) => r.fulfill({ json: { ticket: 'TICKET-UI-FICTICIO', expiraEn: 300 } }));
    await page.route('**/api/auth/cuenta/completar', (r) => r.fulfill({ json: { identifier: 'prueba-ui@unas.edu.pe', role: 'tutor', pendienteVinculacion: true } }));
    if (modo === 'activacion') await page.addInitScript(() => sessionStorage.setItem('unas:activacion:v1', JSON.stringify({ tokenActivacion: 'A'.repeat(64), correo: 'prueba-ui@unas.edu.pe', role: 'tutor', expira: Date.now() + 900000 })));
    await page.goto(`http://127.0.0.1:5173/${modo === 'registro' ? 'crear-cuenta' : 'verificar-cuenta'}`);
    await revisar(page, `${modo}-correo`);
    if (modo === 'registro') {
      await page.getByLabel('Correo institucional', { exact: true }).fill('prueba-ui@unas.edu.pe');
      const perfil = page.getByRole('combobox', { name: 'Perfil', exact: true });
      assert.equal(await perfil.locator('option').count(), 2);
      await perfil.selectOption('tutor');
    }
    await page.getByRole('button', { name: modo === 'registro' ? 'Enviar código' : 'Verificar cuenta', exact: true }).click();
    await expect(page.getByLabel('Código de verificación', { exact: true })).toBeVisible();
    await revisar(page, `${modo}-codigo`);
    await page.getByLabel('Código de verificación', { exact: true }).fill('123456');
    await page.getByRole('button', { name: 'Confirmar código', exact: true }).click();
    await expect(page.getByLabel('Nueva contraseña', { exact: true })).toBeVisible();
    await revisar(page, `${modo}-password`);
    await page.getByLabel('Nueva contraseña', { exact: true }).fill('Una frase ficticia para probar la interfaz');
    await page.getByLabel('Confirmar nueva contraseña', { exact: true }).fill('Una frase ficticia para probar la interfaz');
    await page.getByRole('button', { name: modo === 'registro' ? 'Crear cuenta e ingresar' : 'Guardar contraseña e ingresar', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Tu cuenta ya está verificada.');
    assert.equal(solicitudes, 1);
    await context.close();
  }
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); const page = await context.newPage();
  page.on('pageerror', (e) => errores.push(e.message));
  await page.goto('http://127.0.0.1:5173/login');
  await expect(page.getByRole('link', { name: 'Crear cuenta', exact: true })).toBeVisible();
  await page.locator('#identifier').fill('coordinacion.tutoria'); await page.locator('#password').fill('tutoria2026');
  await page.locator('button[type="submit"]').click(); await page.waitForURL('**/coordinacion/dashboard'); await page.waitForTimeout(800);
  await page.goto('http://127.0.0.1:5173/coordinacion/permisos');
  await page.getByRole('tab', { name: 'Cuentas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Cuentas de acceso', exact: true })).toBeVisible();
  await revisar(page, 'coordinacion-cuentas');
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('combobox', { name: 'Perfil', exact: true }).locator('option')).toHaveCount(3);
  await revisar(page, 'coordinacion-crear', true);
  // Evita crear cuentas o enviar mensajes en la base real durante la revisión visual.
  await page.route('**/api/cuentas', (r) => r.request().method() === 'POST' ? r.fulfill({ json: { id: 'CTA-UI-FICTICIA', identifier: 'prueba-ui@unas.edu.pe', passwordTemporal: 'TEMPORAL-FICTICIA-SOLO-PARA-UI', expiraEn: 172800, estadoCorreo: 'pendiente' } }) : r.continue());
  await dialog.getByLabel('Correo institucional', { exact: true }).fill('prueba-ui@unas.edu.pe');
  await dialog.getByLabel('Nombres', { exact: true }).fill('Persona ficticia'); await dialog.getByLabel('Apellidos', { exact: true }).fill('Prueba de interfaz');
  await dialog.getByRole('button', { name: 'Crear cuenta y enviar acceso', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Cuenta creada', exact: true })).toBeVisible();
  await revisar(page, 'coordinacion-temporal', true);
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
  await context.close(); assert.deepEqual(errores, []);
  await writeFile(new URL('resultado.json', output), JSON.stringify({ resultado: 'PASS', simulacionCorreo: true, mensajesRealesEnviados: 0, resultados, errores }, null, 2));
  console.log(JSON.stringify({ resultado: 'PASS', vistasAncho: resultados.length, mensajesRealesEnviados: 0, accesibilidad: 'sin infracciones' }));
} finally { await browser.close(); }
