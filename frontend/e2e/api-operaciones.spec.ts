import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
const api = 'http://127.0.0.1:5080';
async function login(
  page: Page,
  role: 'estudiante' | 'tutor' | 'coordinacion',
  identifier?: string,
) {
  await page.goto('/login');

  await page
    .locator('#identifier')
    .fill(
      identifier ??
        (role === 'estudiante'
          ? '2023010456'
          : role === 'tutor'
            ? 'DOC-0421'
            : 'coordinacion.tutoria'),
    );
  await page.locator('#password').fill('tutoria2026');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(`**/${role}/dashboard`);
}
async function headers(page: Page) {
  return {
    Authorization: `Bearer ${await page.evaluate(() => JSON.parse(sessionStorage.getItem('unas:api-session:v1')!).accessToken as string)}`,
  };
}
async function state(page: Page) {
  const response = await page.request.get(`${api}/api/tutoria/estado`, {
    headers: await headers(page),
  });
  expect(response.ok()).toBe(true);
  return response.json();
}
const suffix = () => `QA-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

test('docente y coordinación crean, recuperan, editan y eliminan sus borradores de aviso', async ({
  browser,
}) => {
  for (const role of ['tutor', 'coordinacion'] as const) {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await login(page, role);
      await page.goto(`/${role}/avisos`);
      const titulo = `Borrador ficticio ${suffix()}`;
      await page.getByRole('button', { name: 'Redactar aviso', exact: true }).first().click();
      let modal = page.getByRole('dialog');
      await modal
        .getByRole('listbox', { name: 'Destinatarios', exact: true })
        .selectOption('EST-2023010456');
      await modal.getByLabel('Asunto', { exact: true }).fill(titulo);
      await modal
        .getByLabel('Mensaje', { exact: true })
        .fill('Mensaje ficticio que debe sobrevivir a una recarga.');
      await modal.getByRole('button', { name: 'Guardar borrador', exact: true }).click();
      await expect(modal).toHaveCount(0);
      await page.reload();
      async function abrirBorrador(asunto: string) {
        if (role === 'coordinacion') {
          await page.getByRole('button', { name: `${asunto} · borrador`, exact: true }).click();
        } else {
          await page
            .locator('.card')
            .filter({
              has: page.getByRole('heading', { name: 'Borradores y publicaciones programadas' }),
            })
            .locator('.ui-row')
            .filter({ hasText: asunto })
            .getByRole('button', { name: 'Editar o eliminar borrador' })
            .click();
        }
      }
      await abrirBorrador(titulo);
      modal = page.getByRole('dialog');
      await expect(modal.getByLabel('Mensaje', { exact: true })).toHaveValue(
        'Mensaje ficticio que debe sobrevivir a una recarga.',
      );
      await modal.getByLabel('Asunto', { exact: true }).fill(`${titulo} editado`);
      await modal.getByRole('button', { name: 'Guardar borrador', exact: true }).click();
      await expect(modal).toHaveCount(0);
      await page.reload();
      await abrirBorrador(`${titulo} editado`);
      await page
        .getByRole('dialog')
        .getByRole('button', { name: 'Eliminar borrador', exact: true })
        .click();
      await page
        .getByRole('dialog')
        .getByRole('button', { name: 'Confirmar eliminación', exact: true })
        .click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await page.reload();
      expect(
        (await state(page)).sistema.mensajes.some((m: { asunto: string }) =>
          m.asunto.includes(titulo),
        ),
      ).toBe(false);
    } finally {
      await context.close();
    }
  }
});

test('aviso publicado por el docente llega al estudiante y la lectura se conserva', async ({
  browser,
}) => {
  const teacher = await browser.newContext();
  const pupil = await browser.newContext();
  try {
    const tutor = await teacher.newPage();
    const student = await pupil.newPage();
    const titulo = `Publicación ficticia ${suffix()}`;
    await login(tutor, 'tutor');
    await tutor.goto('/tutor/avisos');
    await tutor.getByRole('button', { name: 'Redactar aviso', exact: true }).first().click();
    const modal = tutor.getByRole('dialog');
    await modal
      .getByRole('listbox', { name: 'Destinatarios', exact: true })
      .selectOption('EST-2023010456');
    await modal.getByLabel('Asunto', { exact: true }).fill(titulo);
    await modal
      .getByLabel('Mensaje', { exact: true })
      .fill('Aviso ficticio de verificación entre roles.');
    await modal.getByRole('combobox', { name: 'Acción', exact: true }).selectOption('enviado');
    await modal.getByRole('button', { name: 'Publicar aviso', exact: true }).click();
    await expect(modal).toHaveCount(0);
    await login(student, 'estudiante');
    await student.goto('/estudiante/avisos');
    await student
      .getByRole('button', { name: new RegExp(titulo) })
      .first()
      .click();
    const notif = (await state(student)).sistema.notificaciones.find(
      (n: { titulo: string }) => n.titulo === titulo,
    );
    expect(notif).toBeTruthy();
    expect(notif.leida).toBe(true);
    await student.reload();
    expect(
      (await state(student)).sistema.notificaciones.find((n: { id: string }) => n.id === notif.id)
        .leida,
    ).toBe(true);
  } finally {
    await teacher.close();
    await pupil.close();
  }
});

test('la ficha del tutor abre la derivación con estudiante elegido y permite descartar el borrador', async ({
  page,
}) => {
  await login(page, 'tutor');
  await page.goto('/tutor/tutorados/EST-2023010456');
  await page
    .getByRole('button', { name: /Derivar|solicitud de apoyo/i })
    .first()
    .click();
  await expect(page).toHaveURL(/instrumentos\?crear=F12/);
  let modal = page.getByRole('dialog');
  await expect(modal.getByRole('combobox', { name: 'Estudiante', exact: true })).toHaveValue(/Ana/);
  const created = page.waitForResponse(
    (r) => r.url() === `${api}/api/formularios` && r.request().method() === 'POST' && r.ok(),
  );
  await modal.getByRole('button', { name: 'Continuar', exact: true }).click();
  const doc = await (await created).json();
  modal = page.getByRole('dialog');
  await modal.getByRole('button', { name: 'Descartar este borrador', exact: true }).click();
  await modal.getByRole('button', { name: 'Confirmar eliminación', exact: true }).click();
  await expect(modal).toHaveCount(0);
  await page.reload();
  expect((await state(page)).registros.some((r: { id: string }) => r.id === doc.id)).toBe(false);
});

test('coordinación guarda, recupera y elimina una actividad planificada', async ({ page }) => {
  await login(page, 'coordinacion');
  await page.goto('/coordinacion/plan');
  const nombre = `Actividad ficticia ${suffix()}`;
  await page.getByRole('button', { name: 'Nueva actividad', exact: true }).click();
  let modal = page.getByRole('dialog');
  await modal.getByLabel('Problemática', { exact: true }).fill('Necesidad ficticia de orientación');
  await modal.getByLabel('Objetivo', { exact: true }).fill('Verificar el plan persistente');
  await modal.getByLabel('Actividad', { exact: true }).fill(nombre);
  await modal.getByLabel('Meta', { exact: true }).fill('Una actividad de verificación');
  await modal.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(modal).toHaveCount(0);
  await page.reload();
  await page.getByRole('searchbox', { name: 'Buscar actividad' }).fill(nombre);
  const row = page
    .getByRole('row')
    .filter({ has: page.getByText(nombre, { exact: true }) })
    .filter({ has: page.getByRole('button', { name: 'Editar actividad', exact: true }) });
  await row.getByRole('button', { name: 'Editar actividad', exact: true }).click();
  modal = page.getByRole('dialog');
  await expect(modal.getByLabel('Meta', { exact: true })).toHaveValue(
    'Una actividad de verificación',
  );
  await modal
    .getByRole('button', { name: 'Eliminar actividad sin ejecución', exact: true })
    .click();
  await modal.getByRole('button', { name: 'Confirmar eliminación', exact: true }).click();
  await expect(modal).toHaveCount(0);
  expect(
    (await state(page)).sistema.actividadesPlan.some(
      (a: { actividad: string }) => a.actividad === nombre,
    ),
  ).toBe(false);
});

test('el estudiante guarda su contacto y preferencias, y los recupera al recargar', async ({
  page,
}) => {
  await login(page, 'estudiante');
  const original = (await state(page)).sistema;
  try {
    await page.goto('/estudiante/perfil');
    await page.getByLabel('Correo de contacto', { exact: true }).fill('qa-ficticio@example.test');
    await page.getByLabel('Teléfono o anexo', { exact: true }).fill('900000124');
    await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Contacto guardado' })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Correo de contacto', { exact: true })).toHaveValue(
      'qa-ficticio@example.test',
    );
    await page.goto('/estudiante/preferencias');
    const checkbox = page.getByRole('checkbox', {
      name: 'Filas de tabla más pequeñas',
      exact: true,
    });
    await checkbox.click();
    await expect(page.getByText('Preferencias guardadas en tu cuenta.')).toBeVisible();
    await page.reload();
    await expect(checkbox).toBeChecked({ checked: !original.preferencias.pantalla.compactTables });
  } finally {
    const latest = (await state(page)).sistema;
    expect(
      (
        await page.request.put(`${api}/api/sistema/perfil`, {
          headers: await headers(page),
          data: { ...original.contacto, version: latest.contacto.version },
        })
      ).ok(),
    ).toBe(true);
    expect(
      (
        await page.request.put(`${api}/api/sistema/preferencias`, {
          headers: await headers(page),
          data: { ...original.preferencias, version: latest.preferencias.version },
        })
      ).ok(),
    ).toBe(true);
  }
});

test('el docente reprograma una convocatoria y conserva la anterior como historial', async ({
  page,
}) => {
  await login(page, 'tutor');
  await page.goto('/tutor/sesiones?accion=programar&estudiante=EST-2023010456');
  const titulo = `Sesión ficticia ${suffix()}`;
  const fecha = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);
  const ocupadas = (await state(page)).sesiones.filter(
    (s: { fecha: string; estado: string }) =>
      s.fecha === fecha && !['cancelada', 'reprogramada'].includes(s.estado),
  );
  const hora = ['20:00', '21:00', '22:00', '23:00'].find(
    (h) =>
      !ocupadas.some(
        (s: { horaInicio: string; horaFin: string }) =>
          s.horaInicio < `${h.slice(0, 2)}:40` && h < s.horaFin,
      ),
  )!;
  expect(hora).toBeTruthy();
  const modal = page.getByRole('dialog');
  await modal.getByLabel('Fecha', { exact: true }).fill(fecha);
  await modal.getByLabel('Hora de inicio', { exact: true }).fill(hora);
  await modal.getByLabel('Hora de fin', { exact: true }).fill(`${hora.slice(0, 2)}:20`);
  await modal.getByLabel('Tema o título de la sesión', { exact: true }).fill(titulo);
  await modal.getByRole('button', { name: 'Guardar programación', exact: true }).click();
  await expect(modal.getByRole('heading', { level: 2 })).toHaveText(titulo);
  await modal.getByText('Cancelar o reprogramar esta sesión', { exact: true }).click();
  await modal.getByRole('combobox', { name: 'Acción', exact: true }).selectOption('reprogramar');
  await modal
    .getByLabel('Motivo del cambio', { exact: true })
    .fill('Reprogramación ficticia de verificación');
  await modal.getByLabel('Nueva hora de inicio', { exact: true }).fill(`${hora.slice(0, 2)}:10`);
  await modal.getByLabel('Nueva hora de fin', { exact: true }).fill(`${hora.slice(0, 2)}:30`);
  await modal.getByRole('button', { name: 'Confirmar reprogramación', exact: true }).click();
  await expect(modal.getByText('Reprogramada', { exact: true })).toBeVisible();
  const sessions = (await state(page)).sesiones.filter((s: { tema: string }) => s.tema === titulo);
  expect(sessions).toHaveLength(2);
  expect(sessions.some((s: { estado: string }) => s.estado === 'reprogramada')).toBe(true);
  const next = sessions.find((s: { estado: string }) => s.estado === 'programada');
  expect(
    (
      await page.request.put(`${api}/api/sistema/sesiones/${next.id}/estado`, {
        headers: await headers(page),
        data: { version: next.version, accion: 'cancelar', motivo: 'Fin de verificación ficticia' },
      })
    ).ok(),
  ).toBe(true);
});

test('coordinación cambia el acceso y el plazo del periodo y los recupera tras recargar', async ({
  page,
}) => {
  await login(page, 'coordinacion');
  const original = (await state(page)).sistema;
  const cuenta = original.cuentas.find(
    (c: { identifier: string }) => c.identifier === '2023010458',
  );
  expect(cuenta.activo).toBe(true);
  try {
    await page.goto('/coordinacion/permisos');
    await page.getByRole('tab', { name: 'Cuentas', exact: true }).click();
    await page
      .getByRole('button', { name: `Deshabilitar · ${cuenta.identifier}`, exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: `Habilitar · ${cuenta.identifier}`, exact: true }),
    ).toBeVisible();
    await page.reload();
    expect(
      (await state(page)).sistema.cuentas.find((c: { id: string }) => c.id === cuenta.id).activo,
    ).toBe(false);

    await page.goto('/coordinacion/semestres');
    await page.getByRole('button', { name: 'Editar fechas', exact: true }).click();
    const configuracion = page.getByRole('dialog', { name: 'Editar fechas', exact: true });
    const fecha = new Date(`${original.configuracionPeriodo.fin}T12:00:00Z`);
    fecha.setUTCDate(fecha.getUTCDate() + 1);
    const plazo = fecha.toISOString().slice(0, 10);
    await configuracion.getByLabel('Plazo de informes', { exact: true }).fill(plazo);
    await configuracion.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
    await expect(configuracion.getByRole('status')).toHaveText('Cambios guardados.');
    await page.reload();
    await page.getByRole('button', { name: 'Editar fechas', exact: true }).click();
    await expect(configuracion.getByLabel('Plazo de informes', { exact: true })).toHaveValue(plazo);
  } finally {
    const latest = (await state(page)).sistema;
    expect(
      (
        await page.request.put(`${api}/api/sistema/cuentas/${cuenta.id}`, {
          headers: await headers(page),
          data: {
            activo: cuenta.activo,
            version: latest.cuentas.find((c: { id: string }) => c.id === cuenta.id).version,
          },
        })
      ).ok(),
    ).toBe(true);
    expect(
      (
        await page.request.put(`${api}/api/sistema/periodo`, {
          headers: await headers(page),
          data: { ...original.configuracionPeriodo, version: latest.configuracionPeriodo.version },
        })
      ).ok(),
    ).toBe(true);
  }
});

test('coordinación conserva la respuesta de una solicitud institucional sin simular una integración', async ({
  page,
}) => {
  await login(page, 'coordinacion');
  const original = (await state(page)).sistema.fuentes.insumos[0];
  expect(original).toBeTruthy();
  const observacion = `Respuesta administrativa ficticia ${suffix()}`;
  try {
    await page.goto('/coordinacion/integraciones');
    await page
      .getByRole('button', { name: `Acciones del registro ${original.id}`, exact: true })
      .click();
    await page
      .getByRole('button', { name: `Ver el detalle de la solicitud ${original.id}`, exact: true })
      .click();
    const modal = page.getByRole('dialog');
    await modal.getByLabel('Observación', { exact: true }).fill(observacion);
    await modal.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
    await expect(modal).toHaveCount(0);
    await page.reload();
    await page
      .getByRole('button', { name: `Acciones del registro ${original.id}`, exact: true })
      .click();
    await page
      .getByRole('button', { name: `Ver el detalle de la solicitud ${original.id}`, exact: true })
      .click();
    await expect(page.getByRole('dialog').getByLabel('Observación', { exact: true })).toHaveValue(
      observacion,
    );
  } finally {
    const latest = (await state(page)).sistema.fuentes.insumos.find(
      (i: { id: string }) => i.id === original.id,
    );
    expect(
      (
        await page.request.put(`${api}/api/sistema/insumos/${original.id}`, {
          headers: await headers(page),
          data: { ...original, version: latest.version },
        })
      ).ok(),
    ).toBe(true);
  }
});
