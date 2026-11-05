import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function login(page: Page, rol: 'Estudiante' | 'Tutor') {
  await page.goto('/login');

  await page.locator('#identifier').fill(rol === 'Estudiante' ? '2023010456' : 'DOC-0421');
  await page.locator('#password').fill('tutoria2026');
  await page.locator('.d01__form .d01__cta').click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto(
    rol === 'Estudiante' ? '/estudiante/instrumentos' : '/tutor/instrumentos?ambito=estudiantes',
  );
  await page
    .getByRole('heading', {
      name: rol === 'Estudiante' ? 'Mis formularios' : 'Respuestas de estudiantes',
      exact: true,
    })
    .waitFor();
  await page.evaluate(() => document.fonts.ready);
}
/** El tutorado responde en su propia página; los pasos son botones con nombre. */
const hojaFormulario = (page: Page) => page.locator('.sf-llenado');
const paso = (hoja: Locator, nombre: RegExp) =>
  hoja
    .getByRole('navigation', { name: 'Pasos del formulario' })
    .getByRole('button', { name: nombre });
/** Va a «Revisar y enviar»: selector en el modal del tutor, botón en la página del tutorado. */
async function revisarFormulario(contenedor: Locator) {
  const selector = contenedor.getByLabel('Sección del formulario');
  if (await selector.count()) {
    await selector.selectOption((await selector.locator('option').last().getAttribute('value'))!);
    return;
  }
  await paso(contenedor, /\. Revisar y enviar$/).click();
}
async function abrirEntrevista(page: Page) {
  await page.getByRole('link', { name: /Entrevista inicial/ }).click();
  await expect(page).toHaveURL(/\/estudiante\/instrumentos\/INST-F03-/);
}
async function llenarEntrevista(page: Page) {
  const dialogo = hojaFormulario(page);
  await revisarFormulario(dialogo);
  const primeraSeccion = dialogo.locator('.tutoring-review-section').first();
  await primeraSeccion.locator('summary').click();
  await primeraSeccion.getByRole('button', { name: 'Editar esta sección' }).click();
  await paso(dialogo, /^1\. /).click();
  await dialogo.getByRole('button', { name: 'Continuar', exact: true }).click();
  await dialogo.getByLabel('Colegio de procedencia').fill('I.E. de demostración');
  await dialogo.getByRole('button', { name: 'Continuar', exact: true }).click();
  await dialogo.locator('[data-field="conoceTutoria"]').getByLabel('Sí', { exact: true }).check();
  await dialogo
    .locator('[data-field="expectativas"]')
    .getByLabel('Organizar mi tiempo', { exact: true })
    .check();
  await dialogo.getByRole('button', { name: 'Continuar', exact: true }).click();
  await dialogo.getByLabel('Interés personal', { exact: true }).check();
  await dialogo.getByLabel('Desarrollar mi vocación', { exact: true }).check();
  await dialogo.getByLabel('Buena formación', { exact: true }).check();
  await dialogo.getByRole('button', { name: 'Continuar', exact: true }).click();
  await dialogo.getByRole('button', { name: 'Continuar', exact: true }).click();
  await dialogo.getByLabel('¿Cuántas horas al día dedicas al estudio?').fill('2');
  await dialogo
    .locator('[data-field="tiempoSuficiente"]')
    .getByLabel('Sí', { exact: true })
    .check();
  await dialogo
    .locator('[data-field="formaEstudio"]')
    .getByLabel('Individual', { exact: true })
    .check();
  await dialogo.locator('[data-field="estudioEfectivo"]').getByLabel('Sí', { exact: true }).check();
  await dialogo.getByRole('button', { name: 'Revisar respuestas', exact: true }).click();
  await dialogo
    .getByRole('checkbox', { name: 'He revisado mis respuestas y deseo enviarlas.' })
    .check();
  await dialogo.getByRole('button', { name: 'Enviar formulario', exact: true }).click();
  await expect(dialogo).toHaveCount(0);
}
test('entrevista: guardar, recargar, enviar, pedir corrección, reenviar y revisar entre roles', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page, 'Estudiante');
  await abrirEntrevista(page);
  const hoja = hojaFormulario(page);
  await expect(hoja.getByText(/Datos ya disponibles/)).toHaveCount(0);
  await revisarFormulario(hoja);
  await hoja.locator('.tutoring-review-section > summary').first().click();
  await expect(hoja.locator('[data-field="nombreEstudiante"]')).toContainText('Ana');
  await hoja.getByRole('button', { name: 'Guardar borrador', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Borrador guardado' })).toBeVisible();
  // El borrador se conserva al recargar la página del formulario.
  await page.reload();
  await expect(hoja).toBeVisible();
  await llenarEntrevista(page);
  await expect(page.getByRole('status').filter({ hasText: 'Entrevista enviada' })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await login(page, 'Tutor');
  const fila = page
    .locator('.tutoring-record[data-instrument="F03"]')
    .filter({ hasText: 'Quispe Rojas' });
  await fila.getByRole('button', { name: /Abrir formato 03/ }).click();
  // La lectura del tutor se organiza en pestañas por sección: la forma de estudiar está en la última.
  await page.getByRole('dialog').getByRole('tab', { name: 'Tu forma de estudiar' }).click();
  await expect(page.getByRole('dialog')).toContainText('Individual');
  await page
    .getByLabel('¿Qué debe corregir el estudiante?')
    .fill('Confirma si dedicas dos horas al estudio cada día.');
  await page.getByRole('button', { name: 'Pedir corrección', exact: true }).click();
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await login(page, 'Estudiante');
  // La entrevista observada muestra el pedido del tutor ya en la lista.
  await expect(page.getByRole('link', { name: /Entrevista inicial/ })).toContainText(
    'Confirma si dedicas',
  );
  await abrirEntrevista(page);
  await expect(hojaFormulario(page)).toContainText('Confirma si dedicas');
  await llenarEntrevista(page);
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await login(page, 'Tutor');
  await fila.getByRole('button', { name: /Abrir formato 03/ }).click();
  await page.getByRole('button', { name: 'Marcar como revisada', exact: true }).click();
  await expect(fila).toContainText(/Aprobado|Revisado/);
});

test('fases: cambiar al cierre no habilita evaluaciones sin asistencia confirmada', async ({
  page,
}) => {
  await login(page, 'Estudiante');
  const filtros = page.getByRole('group', { name: 'Filtrar mis formularios' });
  await filtros.getByRole('button', { name: 'Pendientes 1', exact: true }).click();
  await expect(page).toHaveURL(/estado=pendiente/);
  await expect(page.locator('[data-instrument]')).toHaveCount(1);
  await filtros.getByRole('button', { name: 'Por corregir 0', exact: true }).click();
  await expect(page.getByText('Nada por corregir', { exact: true })).toBeVisible();
  await filtros.getByRole('button', { name: /^Todos/ }).click();
  await expect(page.getByText('Tu tutor te acompaña', { exact: true })).toHaveCount(0);
  const accesibilidad = await new AxeBuilder({ page })
    .include('.sf-pagina')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(accesibilidad.violations).toEqual([]);
  // Una evaluación sin asistencia confirmada espera plegada y no se puede abrir para responder.
  const enEspera = async () => {
    await page.getByText('Se habilitan más adelante', { exact: true }).click();
    const grupal = page.locator('[data-instrument="F11"]').first();
    await expect(grupal).toBeVisible();
    await expect(grupal.getByRole('link')).toHaveCount(0);
    await expect(grupal).toContainText(/Se habilita al terminar la sesión|aún no confirma/);
  };
  await enEspera();
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await login(page, 'Tutor');
  await page.getByLabel('Momento del semestre').selectOption('cierre');
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await login(page, 'Estudiante');
  // Pasar al cierre no habilita lo que aún espera asistencia.
  await enEspera();
});

test('atención personalizada: prepara una ficha 12 y su envío aparece en el apoyo del estudiante', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 950 });
  await login(page, 'Tutor');
  await page
    .getByRole('button', { name: 'Mis formularios', exact: false })
    .filter({ hasText: 'Mis formularios' })
    .last()
    .click();
  await page.getByRole('button', { name: 'Completar formato 08', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('combobox', { name: 'Estudiante', exact: true })
    .fill('2023010456');
  await page
    .getByRole('dialog')
    .getByRole('combobox', { name: 'Estudiante', exact: true })
    .press('Enter');
  await page.getByRole('dialog').getByRole('button', { name: 'Continuar', exact: true }).click();
  const d = page.getByRole('dialog');
  await d.getByRole('button', { name: 'Continuar', exact: true }).click();
  await d.getByRole('button', { name: 'Continuar', exact: true }).click();
  await d.getByLabel('Necesidad de apoyo especializado', { exact: true }).check();
  await d.getByRole('button', { name: 'Continuar', exact: true }).click();
  await d.getByLabel('Se deriva a:', { exact: true }).check();
  await d.getByLabel('Área a la que se deriva').selectOption('Psicología');
  await d.getByRole('button', { name: 'Revisar respuestas', exact: true }).click();
  await d.getByRole('checkbox', { name: 'He revisado mis respuestas y deseo enviarlas.' }).check();
  await d.getByRole('button', { name: 'Enviar formulario', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Se preparó un borrador del formato 12' }),
  ).toBeVisible();
  await page.getByRole('searchbox', { name: 'Buscar', exact: true }).fill('Ficha de derivación');
  const ficha = page
    .locator('.tutoring-record')
    .filter({ hasText: 'Quispe Rojas' })
    .filter({ hasText: 'Borrador' });
  await ficha.getByRole('button', { name: /Abrir formato 12/ }).click();
  await revisarFormulario(d);
  for (const resumen of await d.locator('.tutoring-review-section > summary').all())
    await resumen.click();
  await expect(d.locator('[data-field="area"]')).toContainText('Psicología');
  await d.getByRole('checkbox', { name: 'He revisado mis respuestas y deseo enviarlas.' }).check();
  await d.getByRole('button', { name: 'Enviar formulario', exact: true }).click();
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await login(page, 'Estudiante');
  await page.goto('/estudiante/derivaciones');
  await expect(
    page.getByText('Psicología · Necesidad de apoyo especializado', { exact: true }).first(),
  ).toBeVisible();
});

test('atención personalizada: programa una cita visible en las sesiones de ambos roles', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 950 });
  await login(page, 'Tutor');
  await page.goto('/tutor/instrumentos');
  await page.getByRole('button', { name: 'Completar formato 08', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('combobox', { name: 'Estudiante', exact: true })
    .fill('2023010456');
  await page
    .getByRole('dialog')
    .getByRole('combobox', { name: 'Estudiante', exact: true })
    .press('Enter');
  await page.getByRole('dialog').getByRole('button', { name: 'Continuar', exact: true }).click();
  const d = page.getByRole('dialog');
  await d.getByRole('button', { name: 'Continuar', exact: true }).click();
  await d.getByRole('button', { name: 'Continuar', exact: true }).click();
  await d.getByLabel('Organización del tiempo', { exact: true }).check();
  await d.getByRole('button', { name: 'Continuar', exact: true }).click();
  await d.getByLabel('Se programa nueva cita para seguimiento', { exact: true }).check();
  await d
    .getByLabel('Fecha de la nueva cita')
    .fill(
      new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Lima' }).format(
        new Date(Date.now() + 86_400_000),
      ),
    );
  await d.getByLabel('Hora de inicio de la nueva cita').fill('10:00');
  await d.getByLabel('Hora de fin de la nueva cita').fill('10:45');
  await d.getByRole('button', { name: 'Revisar respuestas', exact: true }).click();
  await d.getByRole('checkbox', { name: 'He revisado mis respuestas y deseo enviarlas.' }).check();
  await d.getByRole('button', { name: 'Enviar formulario', exact: true }).click();
  await page.goto('/tutor/sesiones');
  await expect(
    page.getByRole('button').filter({ hasText: 'Seguimiento de atención personalizada' }).first(),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await login(page, 'Estudiante');
  await page.goto('/estudiante/sesiones');
  await expect(
    page.getByRole('button').filter({ hasText: 'Seguimiento de atención personalizada' }).first(),
  ).toBeVisible();
  await page.goto('/estudiante/calendario');
  await expect(
    page.getByRole('button').filter({ hasText: 'Seguimiento de atención personalizada' }).first(),
  ).toBeVisible();
});

for (const ancho of [320, 375, 390, 768, 1024, 1440]) {
  test(`responsive: estudiante, docente y formulario a ${ancho}px`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 950 });
    await login(page, 'Estudiante');
    const sinDesborde = async () =>
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
      ).toBeLessThanOrEqual(1);
    await sinDesborde();
    await page.screenshot({
      path: `../artifacts/tutoria-workflow/estudiante-${ancho}.png`,
      fullPage: true,
    });
    await abrirEntrevista(page);
    const hoja = hojaFormulario(page);
    await paso(hoja, /\. Expectativas de la tutoría$/).click();
    await hoja.locator('[data-field="expectativas"]').getByLabel('Otro', { exact: true }).check();
    await expect(hoja.getByLabel('¿Cuál?')).toBeVisible();
    if (ancho === 1440) {
      const formularioAxe = await new AxeBuilder({ page })
        .include('.sf-llenado')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(formularioAxe.violations).toEqual([]);
    }
    await sinDesborde();
    expect(await hoja.evaluate((d) => d.scrollWidth - d.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `../artifacts/tutoria-workflow/formulario-${ancho}.png` });
    // Restaurar la cuenta en la misma pestaña mantiene el estado frontend de la demostración.
    await page.evaluate(() => sessionStorage.setItem('tutoria-unas:demo-account', 'DOC-0421'));
    await page.goto('/tutor/instrumentos');
    await page.getByRole('heading', { name: 'Mis formularios', exact: true }).waitFor();
    await sinDesborde();
    await page.screenshot({
      path: `../artifacts/tutoria-workflow/docente-${ancho}.png`,
      fullPage: true,
    });
    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(axe.violations).toEqual([]);
    await page.getByRole('button', { name: 'Completar formato 06', exact: true }).click();
    const dialogoDocente = page.getByRole('dialog');
    await dialogoDocente
      .getByRole('combobox', { name: 'Estudiante', exact: true })
      .fill('ana quispe');
    await expect(dialogoDocente.getByRole('option')).toHaveCount(1);
    expect(await dialogoDocente.evaluate((d) => d.scrollWidth - d.clientWidth)).toBeLessThanOrEqual(
      1,
    );
    await page.screenshot({
      path: `../artifacts/tutoria-workflow/buscador-estudiante-${ancho}.png`,
    });
    if (ancho === 1440) {
      const buscadorAxe = await new AxeBuilder({ page })
        .include('dialog')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(buscadorAxe.violations).toEqual([]);
    }
    await dialogoDocente
      .getByRole('combobox', { name: 'Estudiante', exact: true })
      .fill('2023010456');
    await dialogoDocente.getByRole('combobox', { name: 'Estudiante', exact: true }).press('Enter');
    await dialogoDocente.getByRole('button', { name: 'Continuar', exact: true }).click();
    await expect(dialogoDocente.getByLabel('Sección del formulario')).toBeVisible();
    expect(await dialogoDocente.evaluate((d) => d.scrollWidth - d.clientWidth)).toBeLessThanOrEqual(
      1,
    );
    await page.screenshot({
      path: `../artifacts/tutoria-workflow/formulario-docente-${ancho}.png`,
    });
    await page.keyboard.press('Escape');
    await page
      .getByRole('group', { name: 'Bandejas de tutoría' })
      .getByRole('button', { name: /Respuestas de estudiantes/ })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Respuestas de estudiantes', exact: true }),
    ).toBeVisible();
    await sinDesborde();
    await page.screenshot({
      path: `../artifacts/tutoria-workflow/respuestas-docente-${ancho}.png`,
      fullPage: true,
    });
    const bandejaAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(bandejaAxe.violations).toEqual([]);
  });
}

test('asistencia individual: filas editables y registro visible para el estudiante', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 950 });
  await login(page, 'Tutor');
  await page.goto('/tutor/instrumentos');
  await page.getByRole('button', { name: 'Completar formato 06', exact: true }).click();
  const d = page.getByRole('dialog');
  await d.getByRole('combobox', { name: 'Estudiante', exact: true }).fill('2023010456');
  await d.getByRole('combobox', { name: 'Estudiante', exact: true }).press('Enter');
  await d.getByRole('button', { name: 'Continuar', exact: true }).click();
  await d.getByRole('button', { name: 'Continuar', exact: true }).click();
  await d.getByLabel('Hora de inicio').fill('10:00');
  await d.getByLabel('Hora de fin').fill('10:45');
  await d.getByRole('button', { name: 'Continuar', exact: true }).click();
  await d.getByRole('button', { name: 'Agregar registro', exact: true }).click();
  await expect(d.locator('.tutoring-edit-row')).toHaveCount(2);
  await d.getByRole('button', { name: /Quitar registro 2/ }).click();
  await expect(d.locator('.tutoring-edit-row')).toHaveCount(1);
  await d.getByRole('button', { name: 'Revisar respuestas', exact: true }).click();
  await d.getByRole('checkbox', { name: 'He revisado mis respuestas y deseo enviarlas.' }).check();
  await d.getByRole('button', { name: 'Enviar formulario', exact: true }).click();
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await login(page, 'Estudiante');
  await page.goto('/estudiante/sesiones?vista=historial');
  await expect(
    page.getByRole('button').filter({ hasText: 'Atención registrada' }).first(),
  ).toBeVisible();
});

test('autoevaluación del docente: diez actividades, borrador y envío al cierre', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 950 });
  await login(page, 'Tutor');
  await page.goto('/tutor/instrumentos');
  await page.getByLabel('Momento del semestre').selectOption('cierre');
  await page.getByRole('button', { name: 'Completar formato 09', exact: true }).click();
  const d = page.getByRole('dialog');
  await d.getByRole('button', { name: 'Continuar', exact: true }).click();
  const actividades = d.locator('[data-field^="actividad"]');
  await expect(actividades).toHaveCount(10);
  for (const actividad of await actividades.all())
    await actividad.getByLabel('Realizada', { exact: true }).check();
  await d.getByRole('button', { name: 'Continuar', exact: true }).click();
  await d.getByRole('button', { name: 'Revisar respuestas', exact: true }).click();
  await d.getByRole('button', { name: 'Guardar borrador', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.getByLabel('Momento del semestre').selectOption('durante');
  await page.getByRole('button', { name: 'Completar formato 09', exact: true }).click();
  await expect(d.getByRole('button', { name: 'Enviar formulario', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByLabel('Momento del semestre').selectOption('cierre');
  await page.getByRole('button', { name: 'Completar formato 09', exact: true }).click();
  await d.getByLabel('Sección del formulario').selectOption('3');
  await d.getByRole('checkbox', { name: 'He revisado mis respuestas y deseo enviarlas.' }).check();
  await d.getByRole('button', { name: 'Enviar formulario', exact: true }).click();
  await expect(d).toHaveCount(0);
});

test('bandejas del docente: filtros, paginación y borradores protegidos', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page, 'Tutor');
  const bandejas = page.getByRole('group', { name: 'Bandejas de tutoría' });
  await bandejas.getByRole('button', { name: /^Mis formularios/ }).click();
  const filtros = page.getByRole('group', { name: 'Filtrar mis registros' });
  await filtros.getByRole('button', { name: /^Pendientes / }).click();
  await expect(page).toHaveURL(/estado=pendiente/);
  const filas = page.locator('.teacher-register__row');
  expect(await filas.count()).toBeGreaterThan(0);
  for (const fila of await filas.all())
    await expect(fila.locator('.badge')).toHaveText(/Borrador|Por corregir|Sin iniciar/);
  await filtros.getByRole('button', { name: /^Revisados / }).click();
  await expect(page).toHaveURL(/estado=aprobado/);
  expect(await filas.count()).toBeGreaterThan(0);
  for (const fila of await filas.all()) await expect(fila.locator('.badge')).toHaveText('Aprobado');
  await page.getByRole('searchbox', { name: 'Buscar', exact: true }).fill('sin-coincidencia-qa');
  await expect(page.getByRole('status')).toContainText('Sin formularios en esta vista');
  await page.getByRole('button', { name: 'Limpiar filtros', exact: true }).click();
  await expect(page.getByRole('searchbox', { name: 'Buscar', exact: true })).toHaveValue('');
  const primeraPagina = await filas.allTextContents();
  await page
    .getByRole('navigation', { name: 'Páginas de formularios' })
    .getByRole('button', { name: 'Siguiente', exact: true })
    .click();
  expect(await filas.allTextContents()).not.toEqual(primeraPagina);
  await bandejas.getByRole('button', { name: /^Respuestas de estudiantes/ }).click();
  await page.getByLabel('Estudiante', { exact: true }).selectOption('EST-2023010456');
  await expect(filas).toHaveCount(1);
  for (const fila of await filas.all()) await expect(fila.getByRole('button')).toBeDisabled();
  await page.reload();
  await expect(page.getByLabel('Estudiante', { exact: true })).toHaveValue('EST-2023010456');
  await expect(filas).toHaveCount(1);
  await page
    .getByRole('group', { name: 'Filtrar respuestas de estudiantes' })
    .getByRole('button', { name: /^Por revisar / })
    .click();
  await expect(page.getByRole('status')).toContainText('Sin formularios en esta vista');
});

for (const codigo of ['06', '08', '12']) {
  test(`formato ${codigo}: buscar por nombre sin tildes o código y confirmar al estudiante`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await login(page, 'Tutor');
    await page.goto('/tutor/instrumentos');
    const registrar = page.getByRole('button', {
      name: `Completar formato ${codigo}`,
      exact: true,
    });
    await registrar.click();
    const dialogo = page.getByRole('dialog');
    const buscador = dialogo.getByRole('combobox', { name: 'Estudiante', exact: true });
    const continuar = dialogo.getByRole('button', { name: 'Continuar', exact: true });
    await expect(buscador).toBeFocused();
    await expect(continuar).toBeDisabled();
    await buscador.fill('PINEDO alvaro');
    await expect(dialogo.getByRole('option')).toHaveCount(1);
    await expect(dialogo.getByRole('option')).toContainText('Álvaro');
    await buscador.press('Enter');
    await expect(buscador).toHaveValue('Pinedo Salas, Álvaro Jesús');
    await expect(continuar).toBeEnabled();
    await buscador.fill('sin-coincidencia-qa');
    await expect(continuar).toBeDisabled();
    await expect(dialogo.getByRole('option')).toHaveCount(0);
    await expect(dialogo.getByRole('status')).toContainText('No se encontraron estudiantes');
    await buscador.fill('2023010456');
    await page.screenshot({ path: `../artifacts/tutoria-workflow/buscador-formato-${codigo}.png` });
    await dialogo.getByRole('option', { name: /Quispe Rojas, Ana Lucía/ }).click();
    await expect(buscador).toHaveValue('Quispe Rojas, Ana Lucía');
    await expect(continuar).toBeEnabled();
    await dialogo.getByRole('button', { name: 'Limpiar estudiante', exact: true }).click();
    await expect(buscador).toHaveValue('');
    await expect(continuar).toBeDisabled();
    await buscador.fill('2023010456');
    await buscador.press('ArrowDown');
    await buscador.press('Enter');
    await continuar.click();
    await expect(dialogo.getByLabel('Sección del formulario')).toBeVisible();
    await page.keyboard.press('Escape');
    await registrar.click();
    await expect(buscador).toHaveValue('');
    await expect(continuar).toBeDisabled();
  });
}
