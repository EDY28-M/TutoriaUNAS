import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });
const endpoint = 'http://127.0.0.1:5080';
async function ingresar(page: Page, rol: 'Tutor' | 'Estudiante' | 'Coordinación') {
  await page.goto('/login');

  await page
    .locator('#identifier')
    .fill(
      rol === 'Tutor' ? 'DOC-0421' : rol === 'Coordinación' ? 'coordinacion.tutoria' : '2023010456',
    );
  await page.locator('#password').fill('tutoria2026');
  const acceso = page.waitForResponse(
    (r) => r.url() === `${endpoint}/api/auth/login` && r.request().method() === 'POST' && r.ok(),
  );
  await page.locator('button[type="submit"]').click();
  await acceso;
  await expect(page).toHaveURL(/dashboard/);
}
async function headers(page: Page) {
  const token = await page.evaluate(
    () => JSON.parse(sessionStorage.getItem('unas:api-session:v1')!).accessToken as string,
  );
  return { Authorization: `Bearer ${token}` };
}
/** El enlace por sesión redirige a la página propia del formulario. */
async function abrirEvaluacion(page: Page) {
  await page.goto('/estudiante/instrumentos?sesion=SES-PRUEBA-individual');
  await expect(page).toHaveURL(/\/estudiante\/instrumentos\/INST-F10-/);
  const hoja = page.locator('.sf-llenado');
  await expect(hoja).toBeVisible();
  return hoja;
}

/** Abre la sección «Atención y confianza» (la primera con preguntas del formato 10). */
async function irAPreguntas(hoja: Locator) {
  await hoja
    .getByRole('navigation', { name: 'Pasos del formulario' })
    .getByRole('button', { name: /\. Atención y confianza$/ })
    .click();
}
test('asistencia del tutor libera la evaluación; otro navegador recupera el borrador desde PostgreSQL', async ({
  browser,
}) => {
  const contextoTutor = await browser.newContext();
  const contextoEstudiante = await browser.newContext();
  const tutor = await contextoTutor.newPage();
  const estudiante = await contextoEstudiante.newPage();
  await ingresar(tutor, 'Tutor');
  await ingresar(estudiante, 'Estudiante');
  const response = await tutor.request.get(`${endpoint}/api/tutoria/estado`, {
    headers: await headers(tutor),
  });
  const state = await response.json();
  const session = state.sesiones.find((s: { id: string }) => s.id === 'SES-PRUEBA-individual');
  if (!session.asistenciaConfirmada) {
    const blocked = await abrirEvaluacion(estudiante);
    await expect(blocked.locator('input, textarea')).toHaveCount(0);
    await expect(blocked).toContainText('asistencia');
  }
  await tutor.goto('/tutor/asistencias?sesion=SES-PRUEBA-individual');
  const attendance = tutor.getByRole('dialog');
  await expect(attendance).toBeVisible();
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    await tutor.setViewportSize({ width, height: 1000 });
    expect(await attendance.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(
      1,
    );
    expect(
      await tutor.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    ).toBeLessThanOrEqual(1);
  }
  await attendance.getByRole('button', { name: 'Marcar todos como presentes' }).click();
  const savedAttendance = tutor.waitForResponse(
    (r) => r.url().endsWith('/SES-PRUEBA-individual/asistencia') && r.request().method() === 'PUT',
  );
  await attendance
    .getByRole('button', { name: /Guardar registro|Finalizar sesión y guardar asistencia/ })
    .click();
  expect((await savedAttendance).status()).toBe(200);
  await expect(attendance).toHaveCount(0);
  const modal = await abrirEvaluacion(estudiante);
  await irAPreguntas(modal);
  const chosen = modal.getByRole('radiogroup').first().getByRole('radio').nth(1);
  await chosen.check();
  const saved = estudiante.waitForResponse(
    (r) => r.url().includes('/api/formularios/') && r.request().method() === 'PUT',
  );
  await modal.getByRole('button', { name: 'Guardar borrador', exact: true }).click();
  expect((await saved).status()).toBe(200);
  await expect(modal.getByRole('status')).toContainText('Borrador guardado');
  const localKeys = await estudiante.evaluate(() => Object.keys(localStorage));
  expect(
    localKeys.filter((key) =>
      /expediente|instrument-workspace|asistencia|sesiones-programadas/.test(key),
    ),
  ).toEqual([]);
  const segundoContexto = await browser.newContext();
  const segundo = await segundoContexto.newPage();
  await ingresar(segundo, 'Estudiante');
  const restored = await abrirEvaluacion(segundo);
  await irAPreguntas(restored);
  await expect(restored.getByRole('radiogroup').first().getByRole('radio').nth(1)).toBeChecked();
  await contextoTutor.close();
  await contextoEstudiante.close();
  await segundoContexto.close();
});
test('coordinación guarda el formato 01 y consulta la operación persistida en auditoría', async ({
  page,
}) => {
  await ingresar(page, 'Coordinación');
  await page.goto('/coordinacion/plan');
  await expect(
    page.getByRole('heading', { name: 'Plan e informe de tutoría', exact: true }),
  ).toBeVisible();
  const prepare = page.getByRole('button', { name: 'Preparar formato 01', exact: true });
  if (await prepare.isVisible()) await prepare.click();
  else await page.getByRole('button', { name: 'Abrir formato 01', exact: true }).click();
  const save = page
    .getByRole('dialog', { name: 'Informe del semestre' })
    .getByRole('button', { name: 'Guardar borrador', exact: true });
  await expect(save).toBeVisible();
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    ).toBeLessThanOrEqual(1);
  }
  const saved = page.waitForResponse(
    (r) => r.url().includes('/api/formularios/INST-F01-') && r.request().method() === 'PUT',
  );
  await save.click();
  expect((await saved).status()).toBe(200);
  await expect(page.getByRole('status')).toContainText('Borrador guardado');
  const audit = page.waitForResponse((r) => r.url().endsWith('/api/tutoria/auditoria') && r.ok());
  await page.goto('/coordinacion/auditoria');
  await audit;
  await expect(page.getByRole('table')).toContainText('guardar-borrador');
  await expect(page.getByRole('table')).toContainText('INST-F01-');
});
test('un conflicto o una caída de conexión conserva la respuesta editada y no muestra un guardado exitoso', async ({
  page,
}) => {
  await ingresar(page, 'Estudiante');
  const modal = await abrirEvaluacion(page);
  await irAPreguntas(modal);
  const edited = modal.getByRole('radiogroup').first().getByRole('radio').last();
  await edited.check();
  const auth = await headers(page);
  const current = await (
    await page.request.get(`${endpoint}/api/tutoria/estado`, { headers: auth })
  ).json();
  const record = current.registros.find(
    (r: { sesionId: string }) => r.sesionId === 'SES-PRUEBA-individual',
  );
  const path = `${endpoint}/api/formularios/${encodeURIComponent(record.id)}`;
  const updated = await page.request.put(path, {
    headers: auth,
    data: {
      version: record.version,
      respuestas: { ...record.respuestas, p01: 'A · Totalmente de acuerdo' },
      enviar: false,
    },
  });
  expect(updated.status()).toBe(200);
  const conflict = page.waitForResponse((r) => r.url() === path && r.request().method() === 'PUT');
  await modal.getByRole('button', { name: 'Guardar borrador', exact: true }).click();
  expect((await conflict).status()).toBe(409);
  await expect(modal).toContainText('El registro cambió en otro cliente');
  await expect(edited).toBeChecked();
  await expect(modal.getByRole('status')).toHaveCount(0);
  await page.route(`${endpoint}/api/formularios/**`, (route) => route.abort());
  await modal.getByRole('button', { name: 'Guardar borrador', exact: true }).click();
  await expect(modal).toContainText('No hay conexión con el servidor');
  await expect(edited).toBeChecked();
  await expect(modal.getByRole('status')).toHaveCount(0);
});
