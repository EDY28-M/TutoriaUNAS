import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const require = createRequire(new URL('../frontend/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const output = new URL('../artifacts/coordinacion-compacta/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const resultados = [];
const accesibilidad = [];
const interacciones = [];
const anchos = [320, 375, 390, 768, 1024, 1440];
async function login(page, rol, identifier) {
  await page.goto('http://127.0.0.1:5173/login');
  await page.locator('#identifier').fill(identifier);
  await page.locator('#password').fill('tutoria2026');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(`**/${rol}/dashboard`);
}
async function abrir(page, ruta) {
  await page.goto(`http://127.0.0.1:5173${ruta}`);
  await page.getByRole('heading', { level: 1 }).first().waitFor();
  await page.evaluate(() => document.fonts.ready);
}
async function accion(nombre, fn) {
  try { await fn(); interacciones.push({ nombre, estado: 'PASS' }); }
  catch (e) { interacciones.push({ nombre, estado: 'FAIL', error: e.message }); }
}
try {
  for (const cuenta of [
    { rol: 'estudiante', id: '2023010456', rutas: ['perfil'] },
    { rol: 'tutor', id: 'DOC-0421', rutas: ['perfil'] },
    { rol: 'coordinacion', id: 'coordinacion.tutoria', rutas: ['permisos','reportes','semestres','instrumentos','campos','avisos','perfil','integraciones','revisiones'] },
  ]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 950 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errores = [];
    page.on('pageerror', (e) => errores.push(e.message));
    try {
      await login(page, cuenta.rol, cuenta.id);
      for (const modulo of cuenta.rutas) {
        const ruta = `/${cuenta.rol}/${modulo}`;
        await abrir(page, ruta);
        for (const ancho of anchos) {
          await page.setViewportSize({ width: ancho, height: 950 });
          await page.waitForFunction(() => innerWidth >= 1200 || getComputedStyle(document.querySelector('#app-sidebar')).visibility === 'hidden');
          const datos = await page.locator('main').evaluate((main) => ({ alto: Math.ceil(main.getBoundingClientRect().height), palabras: main.innerText.trim().split(/\s+/).length, exceso: document.documentElement.scrollWidth - innerWidth }));
          resultados.push({ ruta, ancho, ...datos, estado: datos.exceso > 1 ? 'FAIL' : 'PASS' });
          if ([320, 1440].includes(ancho)) {
            await page.screenshot({ path: fileURLToPath(new URL(`${cuenta.rol}-${modulo}-${ancho}.png`, output)), fullPage: true, animations: 'disabled' });
            const axe = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
            accesibilidad.push({ ruta, ancho, violaciones: axe.violations.map((v) => ({ id: v.id, impacto: v.impact, nodos: v.nodes.map((n) => n.target) })) });
          }
        }
      }
      if (cuenta.rol === 'coordinacion') {
        await accion('Permisos por perfil, búsqueda y cuentas', async () => {
          await abrir(page, '/coordinacion/permisos');
          await page.getByRole('button', { name: /^Docente\s/ }).click();
          await page.getByRole('searchbox', { name: 'Buscar sección' }).fill('sin coincidencias QA');
          await expect(page.getByText('Sin secciones', { exact: true })).toBeVisible();
          await page.getByRole('tab', { name: 'Cuentas', exact: true }).click();
          await page.getByRole('searchbox', { name: 'Buscar cuenta' }).fill('2023010456');
          await expect(page.getByRole('button', { name: 'Deshabilitar · 2023010456', exact: true })).toBeVisible();
        });
        await accion('Fechas, calendario y configuración con Escape', async () => {
          await abrir(page, '/coordinacion/semestres');
          await page.getByRole('tab', { name: 'Calendario', exact: true }).click();
          assert.ok(await page.getByRole('button', { name: /mes siguiente/i }).count());
          await page.getByRole('tab', { name: 'Formularios', exact: true }).click();
          assert.equal(await page.locator('[role="tabpanel"] .compact-list > li').count(), 12);
          const editar = page.getByRole('button', { name: 'Editar fechas', exact: true });
          await editar.click();
          await page.getByRole('dialog').getByLabel('Plazo de informes', { exact: true }).waitFor();
          await page.keyboard.press('Escape');
          assert.equal(await page.getByRole('dialog').count(), 0);
          assert.equal(await editar.evaluate((e) => e === document.activeElement), true);
        });
        await accion('Catálogo, detalle de formato y preguntas', async () => {
          await abrir(page, '/coordinacion/instrumentos');
          assert.equal(await page.getByRole('button', { name: /^Ver formato/ }).count(), 12);
          await page.getByRole('searchbox', { name: 'Buscar formulario' }).fill('F04');
          await expect(page.getByRole('button', { name: /^Ver formato/ })).toHaveCount(1);
          await page.getByRole('button', { name: 'Ver formato 04', exact: true }).click();
          await page.getByRole('dialog').getByText('Responsable', { exact: true }).waitFor();
          await page.keyboard.press('Escape');
          await abrir(page, '/coordinacion/campos');
          await page.getByLabel('Formulario', { exact: true }).selectOption('F04');
          await page.locator('.compact-list__row').first().click();
          assert.equal(await page.getByRole('dialog').count(), 1);
          await page.keyboard.press('Escape');
          await page.getByRole('tab', { name: /^Reglas/ }).click();
          assert.ok(await page.locator('[role="tabpanel"] .compact-list > li').count());
        });
        await accion('Avisos: búsqueda, redactor y canales', async () => {
          await abrir(page, '/coordinacion/avisos');
          await page.getByRole('searchbox', { name: 'Buscar aviso' }).fill('sin coincidencias QA');
          await expect(page.getByText('Sin avisos', { exact: true })).toBeVisible();
          await page.getByRole('button', { name: 'Redactar aviso', exact: true }).click();
          await page.getByRole('dialog').getByLabel('Asunto', { exact: true }).waitFor();
          await page.keyboard.press('Escape');
          await page.getByRole('button', { name: 'Canales de envío', exact: true }).click();
          await page.getByRole('dialog').getByText('Correo externo', { exact: true }).waitFor();
          await page.keyboard.press('Escape');
        });
        await accion('Reportes: detalle bajo demanda y descarga CSV', async () => {
          await abrir(page, '/coordinacion/reportes');
          assert.equal(await page.getByRole('heading', { name: 'Cómo se calculan las cifras', exact: true }).count(), 0);
          await page.getByRole('button', { name: 'Cómo se calculan las cifras', exact: true }).click();
          await page.getByRole('dialog').getByText('Cobertura', { exact: true }).first().waitFor();
          await page.keyboard.press('Escape');
          const download = page.waitForEvent('download');
          await page.getByRole('button', { name: 'Descargar tabla (CSV)', exact: true }).click();
          assert.ok((await download).suggestedFilename().endsWith('.csv'));
        });
      }
      await accion(`Perfil compartido ${cuenta.rol}`, async () => {
        await abrir(page, `/${cuenta.rol}/perfil`);
        assert.equal(await page.locator('.profile-identity').count(), 1);
        assert.equal(await page.locator('.profile-panels > .card').count(), 2);
        assert.equal(await page.getByLabel('Correo de contacto', { exact: true }).count(), 1);
        await page.getByText('Cuenta y acceso', { exact: true }).click();
        await page.getByText('Correo institucional', { exact: true }).waitFor();
      });
      assert.deepEqual(errores, [], `Errores de página ${cuenta.rol}`);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
const fail = resultados.filter((r) => r.estado === 'FAIL').length + accesibilidad.filter((r) => r.violaciones.length).length + interacciones.filter((r) => r.estado === 'FAIL').length;
const resumen = { fecha: new Date().toISOString(), escenarios: resultados.length, accesibilidad: accesibilidad.length, interacciones: interacciones.length, fail, resultados, revisionesAxe: accesibilidad, acciones: interacciones };
await writeFile(new URL('verificacion.json', output), JSON.stringify(resumen, null, 2));
console.log(JSON.stringify({ escenarios: resultados.length, revisionesAxe: accesibilidad.length, interacciones, fail, problemas: accesibilidad.filter((r) => r.violaciones.length) }));
if (fail) process.exitCode = 1;
