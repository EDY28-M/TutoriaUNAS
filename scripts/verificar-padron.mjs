import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(new URL('../frontend/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const output = path.join(process.env.LOCALAPPDATA, 'TutoriaUNAS', 'importaciones', 'verificacion-padron');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const page = await context.newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(e.message));
const resultados = [];
try {
  await page.goto('http://127.0.0.1:5173/login');
  await page.locator('#login-role-coordinacion').click();
  await page.locator('#identifier').fill('coordinacion.tutoria');
  await page.locator('#password').fill('tutoria2026');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/coordinacion/dashboard');
  // El acceso conserva su pausa visual de 700 ms antes de terminar la navegación.
  await page.waitForTimeout(800);
  await page.getByRole('link', { name: 'Padrón importado', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Padrón importado' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Alumnos ·/ })).toBeVisible();
  for (const hoja of ['Alumnos', 'Docentes']) {
    console.log(`Verificando ${hoja}`);
    await page.getByRole('tab', { name: hoja, exact: true }).click();
    await expect(page.getByRole('heading', { name: new RegExp(`${hoja} ·`) })).toBeVisible();
    for (const ancho of [320, 375, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width: ancho, height: 1000 });
      await page.evaluate(() => document.fonts.ready);
      const exceso = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert.ok(exceso <= 1, `${hoja}: desbordamiento a ${ancho}px: ${exceso}`);
      resultados.push({ hoja, ancho, exceso });
    }
    await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
    await expect(page.getByText(/Página 2 de/)).toBeVisible();
    await page.getByRole('button', { name: 'Anterior', exact: true }).click();
    await expect(page.getByText(/Página 1 de/)).toBeVisible();
    await page.getByRole('button', { name: /^Ver ficha de/ }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Apellido paterno', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Apellido materno', { exact: true })).toBeVisible();
    if (hoja === 'Alumnos') {
      await dialog.locator('details summary').first().click();
      await expect(dialog.getByRole('columnheader', { name: 'Cód. aula' }).first()).toBeVisible();
    } else await expect(dialog.getByText('Departamento académico', { exact: true })).toBeVisible();
    for (const ancho of [320, 375, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width: ancho, height: 1000 });
      const exceso = await dialog.evaluate((el) => el.scrollWidth - el.clientWidth);
      assert.ok(exceso <= 1, `${hoja}: ficha desborda a ${ancho}px`);
      resultados.push({ hoja: `${hoja}-ficha`, ancho, exceso });
    }
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    assert.deepEqual(axe.violations.map((v) => v.id), []);
    await page.screenshot({ path: path.join(output, `${hoja.toLowerCase()}-ficha.png`), fullPage: true });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await page.getByRole('searchbox', { name: /Buscar por nombre/ }).fill('ZZZ-SIN-COINCIDENCIAS-PRUEBA');
    await expect(page.getByText('Sin coincidencias', { exact: true })).toBeVisible();
    await page.getByRole('searchbox', { name: /Buscar por nombre/ }).fill('');
  }
  await page.getByRole('tab', { name: 'Alumnos', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Alumnos ·/ })).toBeVisible();
  await page.locator('main').getByRole('combobox').selectOption('E-IIS');
  await expect(page.getByRole('heading', { name: 'Alumnos · 346', exact: true })).toBeVisible();
  await page.goto('http://127.0.0.1:5173/coordinacion/tutorados');
  await expect(page.getByRole('heading', { name: 'Estudiantes', exact: true })).toBeVisible();
  assert.ok(!await page.getByText(/Notas por curso|Nota final|Cursos desaprobados/).count());
  assert.deepEqual(errores, []);
  await writeFile(path.join(output, 'resultado.local.json'), JSON.stringify({ resultado: 'PASS', vistas: resultados, errores }, null, 2));
  console.log(JSON.stringify({ resultado: 'PASS', comprobacionesResponsive: resultados.length, accesibilidad: 'sin infracciones', salidaLocal: output }));
} catch (error) {
  await page.screenshot({ path: path.join(output, 'fallo.png'), fullPage: true });
  console.log(JSON.stringify({ errores, pagina: page.url(), encabezado: await page.locator('h1').allTextContents(), fallosApi: await page.getByRole('alert').count() }));
  throw error;
} finally { await context.close(); await browser.close(); }
