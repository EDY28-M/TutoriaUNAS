import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function ingresar(page: Page, rol: 'Tutor' | 'Estudiante') {
  await page.goto('/login');
  await page.getByRole('tab', { name: rol, exact: true }).click();
  await page.locator('#identifier').fill(rol === 'Tutor' ? 'DOC-0421' : '2023010456');
  await page.locator('#password').fill('tutoria2026');
  await page.locator('.d01__form .d01__cta').click();
  await expect(page).toHaveURL(/dashboard/);
}
async function salir(page: Page) {
  if (!(await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).isVisible()))
    await page.getByRole('button', { name: 'Expandir menú', exact: true }).click();
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
}
async function revisarAnchos(page: Page, nombre: string) {
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    expect(await modal.evaluate((d) => d.scrollWidth - d.clientWidth)).toBeLessThanOrEqual(1);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    ).toBeLessThanOrEqual(1);
    if (width === 375 || width === 1440)
      await page.screenshot({ path: `../artifacts/tutoria-workflow/${nombre}-${width}.png` });
  }
}

for (const caso of [
  { tipo: 'individual', formato: '10', asistio: true, ancho: 1440 },
  { tipo: 'grupal', formato: '11', asistio: true, ancho: 375 },
  { tipo: 'individual', formato: '10', asistio: false, ancho: 1440 },
]) {
  test(`${caso.tipo}: programar, finalizar y ${caso.asistio ? 'evaluar' : 'bloquear por inasistencia'}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: caso.ancho, height: 1000 });
    await page.clock.setFixedTime(new Date('2026-11-01T17:00:00-05:00'));
    await ingresar(page, 'Tutor');
    await page.goto('/tutor/sesiones');
    await page.getByRole('button', { name: 'Programar sesión', exact: true }).click();
    const modal = page.getByRole('dialog');
    await modal.getByLabel('Tipo de tutoría').selectOption(caso.tipo);
    await modal.getByLabel('Fecha', { exact: true }).fill('2026-11-01');
    await modal.getByLabel('Hora de inicio').fill('18:00');
    await modal.getByLabel('Hora de fin').fill('19:00');
    const tema = `Sesión ${caso.tipo} de prueba`;
    await modal.getByLabel('Tema o título de la sesión').fill(tema);
    if (caso.tipo === 'individual' && caso.asistio) await revisarAnchos(page, 'programar-sesion');
    await modal.getByRole('button', { name: 'Guardar programación', exact: true }).click();
    await expect(modal).toContainText(tema);
    const enlace = await modal
      .getByRole('link', { name: 'Registrar asistencia' })
      .getAttribute('href');
    const sesionId = new URLSearchParams(enlace!.split('?')[1]).get('sesion')!;
    await modal.getByRole('link', { name: 'Registrar asistencia' }).click();
    await expect(
      page.getByRole('button', { name: 'Finalizar sesión y guardar asistencia' }),
    ).toBeDisabled();
    await modal.getByRole('button', { name: 'Cerrar ventana', exact: true }).click();
    await expect(modal).toHaveCount(0);
    await salir(page);

    await ingresar(page, 'Estudiante');
    await page.goto('/estudiante/sesiones');
    await page.getByRole('button').filter({ hasText: tema }).first().click();
    await expect(modal).toContainText('finaliza la sesión');
    await modal.getByRole('link', { name: 'Ver preguntas de evaluación' }).click();
    await expect(page).toHaveURL(/instrumentos\?sesion=/);
    await expect(modal.locator('input, textarea')).toHaveCount(0);
    await expect(modal).toBeVisible();
    await modal.getByRole('button', { name: 'Cerrar ventana', exact: true }).click();
    await expect(modal).toHaveCount(0);
    await salir(page);

    await page.clock.setFixedTime(new Date('2026-11-01T20:00:00-05:00'));
    await ingresar(page, 'Tutor');
    await page.goto(enlace!);
    if (caso.tipo === 'individual' && caso.asistio)
      await revisarAnchos(page, 'confirmar-asistencia');
    if (caso.asistio)
      await modal.getByRole('button', { name: 'Marcar todos como presentes' }).click();
    else await modal.getByRole('radio', { name: /^Faltó:/ }).check();
    await modal.getByRole('button', { name: 'Finalizar sesión y guardar asistencia' }).click();
    await expect(modal).toHaveCount(0);
    await salir(page);

    await ingresar(page, 'Estudiante');
    await page.goto('/estudiante/sesiones?vista=historial');
    await page.getByRole('button').filter({ hasText: tema }).first().click();
    await modal
      .getByRole('link', { name: caso.asistio ? 'Evaluar tutoría' : 'Ver preguntas de evaluación' })
      .click();
    if (!caso.asistio) {
      await expect(modal).toContainText('debes haber asistido a esta sesión');
      await expect(modal.locator('input, textarea')).toHaveCount(0);
      return;
    }
    await expect(modal.getByRole('heading', { level: 2 })).toContainText(`Formato ${caso.formato}`);
    const selector = modal.getByLabel('Sección del formulario');
    if (caso.tipo === 'individual' && caso.asistio) await revisarAnchos(page, 'evaluar-sesion');
    const cantidad = await selector.locator('option').count();
    await selector.selectOption('0');
    await expect(modal.locator('[data-field="fecha"]')).toContainText('2026-11-01');
    await expect(modal.locator('[data-field="fecha"] input')).toHaveCount(0);
    for (let i = 1; i < cantidad - 1; i++) {
      await selector.selectOption(String(i));
      for (const grupo of await modal.getByRole('radiogroup').all()) {
        await expect(grupo.getByRole('radio')).toHaveCount(
          caso.formato === '11' ? 3 : i === cantidad - 2 ? 2 : 4,
        );
        await grupo.getByRole('radio').last().check();
      }
    }
    await modal.getByRole('button', { name: 'Guardar borrador', exact: true }).click();
    await page.reload();
    await expect(modal).toBeVisible();
    await expect(modal.locator('[data-field="p01"] input:checked')).toHaveCount(1);
    await modal.getByLabel('Sección del formulario').selectOption(String(cantidad - 1));
    await modal
      .getByRole('checkbox', { name: 'He revisado mis respuestas y deseo enviarlas.' })
      .check();
    await modal.getByRole('button', { name: 'Enviar formulario', exact: true }).click();
    await expect(modal).toHaveCount(0);
    await expect(page.locator(`[data-session="${sesionId}"]`)).toHaveAttribute(
      'data-state',
      'enviado',
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    ).toBeLessThanOrEqual(1);
  });
}
