import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const require = createRequire(new URL('../frontend/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const output = new URL('../artifacts/altas-coordinacion/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const resultados = [];
const errores = [];
const nuevas = { estudiante: [], tutor: [] };
const solicitudes = [];
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
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => errores.push(e.message));
  // La sesión y los permisos vienen de la API local. Altas y listados de personas son
  // sintéticos: no se escriben cuentas reales ni se envían invitaciones al padrón.
  await page.route('**/api/tutoria/estado', async (route) => {
    const response = await route.fetch();
    const estado = await response.json();
    estado.estudiantes = nuevas.estudiante;
    estado.docentes = [...estado.docentes.filter((p) => p.id === 'DOC-0422'), ...nuevas.tutor];
    estado.asignaciones = []; estado.matriculas = []; estado.horarios = [];
    return route.fulfill({ response, json: estado });
  });
  await page.route('**/api/cuentas/candidatos?*', (route) => route.fulfill({ json: [{
    id: 'PAD-UI-FICTICIO', nombre: 'Persona del padrón ficticia', nombres: 'Persona del padrón',
    apellidos: 'Ficticia', correo: 'padron-ui@unas.edu.pe', escuelaId: 'E-IIS', ciclo: 3,
  }] }));
  let rechazar = true;
  await page.route('**/api/cuentas', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    const body = route.request().postDataJSON();
    solicitudes.push(body);
    assert.equal(body.personaId, undefined);
    if (rechazar) {
      rechazar = false;
      return route.fulfill({ status: 409, json: { title: 'El correo ya tiene una cuenta.' } });
    }
    const persona = {
      id: `PER-UI-${body.rol}`, nombres: body.nombres, apellidos: body.apellidos,
      correo: body.correo, telefono: '', escuelaId: 'E-IIS', codigo: body.codigo,
      ...(body.rol === 'estudiante'
        ? { ciclo: body.ciclo, etapa: 'ingresante', estado: 'regular', ingreso: '', promedioPonderado: null, creditosAprobados: null, creditosTotales: null, alertas: [] }
        : { departamento: '', categoria: null, dedicacion: null, activo: true, aforoMaximo: null, cursosAsignados: [] }),
    };
    nuevas[body.rol].push(persona);
    return route.fulfill({ json: { id: `CTA-UI-${body.rol}`, identifier: body.correo,
      passwordTemporal: 'TEMPORAL-FICTICIA-SOLO-UI', expiraEn: 172800, estadoCorreo: 'pendiente' } });
  });
  await page.goto('http://127.0.0.1:5173/login');
  await page.locator('#identifier').fill('coordinacion.tutoria');
  await page.locator('#password').fill('tutoria2026');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/coordinacion/dashboard');
  for (const [rol, ruta, etiqueta] of [
    ['estudiante', 'tutorados', 'Crear estudiante'], ['tutor', 'tutores', 'Crear docente'],
  ]) {
    await page.goto(`http://127.0.0.1:5173/coordinacion/${ruta}`);
    const boton = page.getByRole('button', { name: etiqueta, exact: true });
    await expect(boton).toBeVisible();
    await revisar(page, `${rol}-lista`);
    await boton.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('combobox', { name: 'Perfil', exact: true })).toHaveValue(rol);
    const origen = dialog.getByRole('combobox', { name: 'Origen de los datos', exact: true });
    await expect(origen).toHaveValue('nueva');
    await expect(dialog.getByLabel('Buscar en el padrón', { exact: true })).toHaveCount(0);
    await revisar(page, `${rol}-alta-manual`, true);
    await origen.selectOption('padron');
    await expect(dialog.getByRole('button', { name: 'Crear cuenta y enviar acceso', exact: true })).toBeDisabled();
    await dialog.getByLabel('Buscar en el padrón', { exact: true }).fill('Persona');
    await dialog.getByRole('button', { name: /Persona del padrón ficticia/ }).click();
    await expect(dialog.getByLabel('Correo institucional', { exact: true })).toHaveAttribute('readonly', '');
    await origen.selectOption('nueva');
    await expect(dialog.getByLabel('Correo institucional', { exact: true })).toHaveValue('');
    const email = `alta-${rol}-ui@unas.edu.pe`;
    await dialog.getByLabel('Correo institucional', { exact: true }).fill(email);
    await dialog.getByLabel('Nombres', { exact: true }).fill('Persona ficticia');
    await dialog.getByLabel('Apellidos', { exact: true }).fill(`Alta ${rol}`);
    await dialog.getByLabel(rol === 'estudiante' ? 'Código de alumno (opcional)' : 'Código de docente (opcional)', { exact: true }).fill(`UI-${rol}`);
    if (rol === 'estudiante') await dialog.getByLabel('Ciclo, si está confirmado', { exact: true }).fill('3');
    const enviar = dialog.getByRole('button', { name: 'Crear cuenta y enviar acceso', exact: true });
    await enviar.click();
    if (rol === 'estudiante') {
      await expect(dialog.getByRole('alert')).toContainText('El correo ya tiene una cuenta.');
      await expect(dialog.getByLabel('Correo institucional', { exact: true })).toHaveValue(email);
      await enviar.click();
    }
    await expect(dialog.getByRole('heading', { name: 'Cuenta creada', exact: true })).toBeVisible();
    await expect(dialog.getByLabel('Contraseña temporal', { exact: true })).toHaveValue('TEMPORAL-FICTICIA-SOLO-UI');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(boton).toBeFocused();
    await expect(page.getByRole('row').filter({ hasText: email })).toHaveCount(1);
    await revisar(page, `${rol}-lista-actualizada`);
    await page.getByRole('link', { name: 'Gestionar cuentas', exact: true }).click();
    await expect(page).toHaveURL(/\/coordinacion\/permisos\?tab=cuentas$/);
    await expect(page.getByRole('tab', { name: 'Cuentas', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Cuentas de acceso', exact: true })).toBeVisible();
    await page.goBack();
    await expect(boton).toBeVisible();
  }
  assert.equal(solicitudes.length, 3);
  assert.deepEqual(solicitudes.map((s) => s.rol), ['estudiante', 'estudiante', 'tutor']);
  assert.deepEqual(errores, []);
  const resultado = { resultado: 'PASS', vistasAncho: resultados.length, simulacionAltas: true,
    mensajesRealesEnviados: 0, resultados, errores };
  await writeFile(new URL('resultado.json', output), JSON.stringify(resultado, null, 2));
  console.log(JSON.stringify({ resultado: 'PASS', vistasAncho: resultados.length,
    altasSinPadron: 2, listaActualizada: true, erroresConservanDatos: true, accesibilidad: 'sin infracciones' }));
} finally { await browser.close(); }
