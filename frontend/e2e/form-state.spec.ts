import { expect, test } from '@playwright/test';

test('formato 07: quitar una fila intermedia conserva la identidad y el borrador de las demás', async ({
  page,
}) => {
  await page.goto('/login');

  await page.locator('#identifier').fill('DOC-0421');
  await page.locator('#password').fill('tutoria2026');
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL('/tutor/dashboard');
  await page.goto('/tutor/instrumentos');
  await page.getByRole('button', { name: 'Completar formato 07', exact: true }).click();
  const modal = page.getByRole('dialog');
  const participantes = modal.locator('.tutoring-roster input[type="checkbox"]');
  for (let i = 0; i < 3; i++) await participantes.nth(i).check();
  await modal.getByRole('button', { name: 'Continuar', exact: true }).click();
  await modal.getByLabel('Sección del formulario').selectOption('2');
  const filas = modal.locator('.tutoring-edit-row');
  await expect(filas).toHaveCount(3);
  const ultima = filas.nth(2);
  const estudiante = await ultima.getByLabel('Apellidos y nombres').inputValue();
  const cicloId = await ultima.getByLabel('Ciclo').getAttribute('id');
  await ultima.getByLabel('Ciclo').fill('7');
  await modal.getByRole('button', { name: /Quitar registro 2/ }).click();
  await expect(filas).toHaveCount(2);
  await expect(filas.nth(1).getByLabel('Ciclo')).toHaveAttribute('id', cicloId!);
  await expect(filas.nth(1).getByLabel('Ciclo')).toHaveValue('7');
  await expect(filas.nth(1).getByLabel('Apellidos y nombres')).toHaveValue(estudiante);
  await modal.getByRole('button', { name: 'Guardar borrador', exact: true }).click();
  await expect(modal.getByRole('status')).toContainText('Borrador guardado');
  const leerFilas = () =>
    page.evaluate(() => {
      const raw = sessionStorage.getItem('tutoria-unas:instrument-workspace:v1');
      const cambios = (JSON.parse(raw ?? '{}').cambios ?? {}) as Record<
        string,
        { formato: string; respuestas: { asistentes?: string } }
      >;
      return Object.values(cambios)
        .filter((r) => r.formato === 'F07')
        .map((r) => JSON.parse(r.respuestas.asistentes ?? '[]') as Record<string, string>[]);
    });
  const antes = await leerFilas();
  expect(antes).toHaveLength(1);
  expect(antes[0]).toHaveLength(2);
  expect(antes[0]![1]).toMatchObject({ nombre: estudiante, ciclo: '7' });
  expect(new Set(antes[0]!.map((r) => r.estudianteId)).size).toBe(2);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await leerFilas()).toEqual(antes);
});
