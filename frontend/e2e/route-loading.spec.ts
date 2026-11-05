import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const accounts = [
  { role: 'estudiante', label: 'Estudiante', identifier: '2023010456' },
  { role: 'tutor', label: 'Tutor', identifier: 'DOC-0421' },
  { role: 'coordinacion', label: 'Coordinación', identifier: 'coordinacion.tutoria' },
] as const;

async function login(page: Page, account: (typeof accounts)[number]) {
  await page.goto('/login');

  await page.locator('#identifier').fill(account.identifier);
  await page.locator('#password').fill('tutoria2026');
  await page.locator('.d01__form button[type="submit"]').click();
  await expect(page).toHaveURL(`/${account.role}/dashboard`);
}

for (const account of accounts) {
  test(`${account.role}: el panel carga y se conserva al recargar`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await login(page, account);
    await expect(page.locator('.workspace h1')).toBeVisible();
    // Dos tarjetas con vistas alternas: evolución/tipo y estados/avance por formato.
    await expect(page.locator('.portal-chart canvas')).toHaveCount(2);
    await page.reload();
    await expect(page.locator('.workspace h1')).toBeVisible();
    await expect(page.locator('.portal-chart canvas')).toHaveCount(2);
    await expect(page.getByText('No se pudo mostrar esta pantalla', { exact: true })).toHaveCount(
      0,
    );
    expect(errors).toEqual([]);
  });

  for (const width of [1920, 375]) {
    test(`${account.role}: recarga sin círculos con el layout pendiente a ${width}px`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: width === 375 ? 844 : 950 });
      await login(page, account);
      await expect(page.locator('.workspace h1')).toBeVisible();
      const routes = [
        `/${account.role}/dashboard`,
        account.role === 'coordinacion'
          ? '/coordinacion/asignaciones'
          : `/${account.role}/sesiones?vista=historial`,
      ];
      for (const [index, path] of routes.entries()) {
        await page.goto(path);
        await expect(page.locator('.workspace h1')).toBeVisible();
        // Retrasa el módulo y su CSS para comprobar el primer render de una recarga fría.
        let release!: () => void;
        const pending = new Promise<void>((resolve) => {
          release = resolve;
        });
        const modulePath = '**/src/components/layout/AppLayout.tsx*';
        await page.route(modulePath, async (route) => {
          await pending;
          await route.continue();
        });
        try {
          await page.reload({ waitUntil: 'domcontentloaded' });
          const status = page.getByRole('status');
          await expect(status).toHaveText('Cargando…');
          await expect(status.locator('svg, img, canvas')).toHaveCount(0);
          const geometry = await status.evaluate((element) => {
            const bounds = element.getBoundingClientRect();
            return {
              height: bounds.height,
              overflow: document.documentElement.scrollWidth - innerWidth,
              animations: document
                .getAnimations()
                .filter((animation) => animation.playState === 'running').length,
            };
          });
          expect(geometry.height).toBeLessThanOrEqual(180);
          expect(geometry.overflow).toBeLessThanOrEqual(1);
          expect(geometry.animations).toBe(0);
          await page.screenshot({ path: testInfo.outputPath(`loading-${index}.png`) });
        } finally {
          release();
        }
        await expect(page.locator('.workspace h1')).toBeVisible();
        await expect(page.getByRole('status').filter({ hasText: 'Cargando…' })).toHaveCount(0);
        await page.unroute(modulePath);
      }
    });
  }
}

test('Reintentar recupera el panel después de recibir un módulo vacío', async ({ page }) => {
  const path = '**/src/pages/estudiante/StudentDashboard.tsx*';
  // Reproduce la respuesta vacía que conservó el servidor al leer una escritura incompleta.
  await page.route(path, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: 'export {};',
    }),
  );
  await login(page, accounts[0]);
  await expect(page.getByText('No se pudo mostrar esta pantalla', { exact: true })).toBeVisible();
  await expect(page.getByText(/Lazy element type must resolve/)).toBeVisible();
  await page.unroute(path);
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(page).toHaveURL('/estudiante/dashboard');
  await expect(page.locator('.workspace h1')).toBeVisible();
  await expect(page.locator('.portal-chart canvas')).toHaveCount(2);
  await expect(page.getByText('No se pudo mostrar esta pantalla', { exact: true })).toHaveCount(0);
});
