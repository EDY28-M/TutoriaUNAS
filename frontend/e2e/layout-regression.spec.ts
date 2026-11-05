import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const widths = [1920, 1440, 1366, 1024, 768, 390, 375];
const accounts = [
  { role: 'estudiante', label: 'Estudiante', id: '2023010456' },
  { role: 'tutor', label: 'Tutor', id: 'DOC-0421' },
  { role: 'coordinacion', label: 'Coordinación', id: 'coordinacion.tutoria' },
] as const;

async function login(page: Page, account = accounts[1] as (typeof accounts)[number]) {
  await page.goto('/login');

  await page.locator('#identifier').fill(account.id);
  await page.locator('#password').fill('tutoria2026');
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(`/${account.role}/dashboard`);
}

async function noPageOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  ).toBeLessThanOrEqual(2);
}

for (const width of widths) {
  test(`calendario y detalles conservan dimensiones legibles a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    // El calendario abre en el mes de «hoy»: se fija la fecha de referencia de la demostración
    // (14 oct. 2026) para que «Mes siguiente» siga siendo noviembre cualquier día que se ejecute.
    await page.clock.setFixedTime(new Date('2026-10-14T12:00:00-05:00'));
    await login(page);
    await page.goto('/tutor/sesiones');
    await expect(page.getByRole('button', { name: 'Semana', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByRole('button', { name: 'Mes', exact: true }).click();
    const calendar = page.locator('.tutorial-calendar');
    await expect(calendar).toBeVisible();
    const dimensions = await calendar.evaluate((element) => ({
      width: element.getBoundingClientRect().width,
      day: element.querySelector('.calendar__day')!.getBoundingClientRect().width,
      days: element.querySelectorAll('.calendar__day').length,
      headings: element.querySelectorAll('.calendar__weekdays > span').length,
    }));
    expect(dimensions.width).toBeGreaterThan(280);
    expect(dimensions.day).toBeGreaterThan(25);
    expect(dimensions.days % 7).toBe(0);
    expect(dimensions.headings).toBe(7);
    await calendar.getByRole('button', { name: 'Mes siguiente', exact: true }).click();
    await expect(calendar.locator('.calendar__title strong')).toContainText(/noviembre/i);
    await calendar.getByRole('button', { name: 'Hoy', exact: true }).click();
    const day = calendar
      .locator('.calendar__day')
      .filter({ has: page.locator('.calendar__event') })
      .last();
    // La esquina del día lo selecciona; el centro cae sobre una sesión y abre su detalle directamente.
    await day.click({ position: { x: 6, y: 6 } });
    const detail = page.locator('.calendar__daypanel');
    await expect(detail.locator('.calendar__dayitem').first()).toBeVisible();
    await detail.locator('.calendar__dayitem').first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await calendar.locator('.calendar__scroll').evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    await noPageOverflow(page);
  });

  test(`formulario largo mantiene cabecera y acciones accesibles a ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 660 });
    await login(page);
    await page.goto('/tutor/sesiones');
    await page.getByRole('button', { name: 'Programar sesión', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const geometry = await dialog.evaluate((element) => {
      const head = element.querySelector('.sheet__head')!.getBoundingClientRect();
      const body = element.querySelector('.sheet__body')!;
      const foot = element.querySelector('.sheet__foot')!.getBoundingClientRect();
      const bounds = element.getBoundingClientRect();
      return {
        top: bounds.top,
        bottom: bounds.bottom,
        viewport: innerHeight,
        bodyTop: body.getBoundingClientRect().top,
        bodyBottom: body.getBoundingClientRect().bottom,
        headBottom: head.bottom,
        footTop: foot.top,
        bodyHeight: body.clientHeight,
        contentHeight: body.scrollHeight,
      };
    });
    expect(geometry.top).toBeGreaterThanOrEqual(0);
    expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewport);
    expect(geometry.bodyTop).toBeGreaterThanOrEqual(geometry.headBottom - 1);
    expect(geometry.bodyBottom).toBeLessThanOrEqual(geometry.footTop + 1);
    expect(geometry.bodyHeight).toBeGreaterThan(80);
    expect(geometry.contentHeight).toBeGreaterThan(geometry.bodyHeight);
    await dialog.locator('.sheet__body').evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect(dialog.getByRole('button', { name: 'Cancelar', exact: true })).toBeInViewport();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await noPageOverflow(page);
  });

  test(`coordinación unifica el horario anterior en sesiones a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    await login(page, accounts[2]);
    await page.goto('/coordinacion/horarios');
    await expect(page).toHaveURL('/coordinacion/sesiones');
    await expect(page.getByRole('button', { name: 'Semana', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByRole('button', { name: 'Mes', exact: true }).click();
    await expect(page.locator('.calendar__grid')).toBeVisible();
    await expect(page.locator('.sidebar__nav a[href$="/calendario"]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Filtros de sesiones', exact: true }).click();
    const popup = page.getByRole('dialog', { name: 'Filtros de sesiones', exact: true });
    await expect(popup).toBeVisible();
    const bounds = await popup.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    await page.keyboard.press('Escape');
    await expect(popup).not.toBeVisible();
    await noPageOverflow(page);
  });
}

for (const account of accounts) {
  test(`${account.role}: gráficas y calendario recalculan al cambiar el menú y el viewport`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    await login(page, account);
    const brand = await page.locator('.sidebar__brand-link').boundingBox();
    const toggle = await page
      .getByRole('button', { name: 'Contraer la barra de navegación', exact: true })
      .boundingBox();
    expect(toggle!.x).toBeGreaterThanOrEqual(brand!.x + brand!.width);
    await expect(page.locator('.card__heading svg, .card__heading i')).toHaveCount(0);
    // El inicio muestra dos gráficas: sesiones y formularios.
    await expect(page.locator('.portal-chart canvas')).toHaveCount(2);
    await page
      .getByRole('button', { name: 'Contraer la barra de navegación', exact: true })
      .click();
    await expect(page.locator('.app-shell')).toHaveClass(/app-shell--mini/);
    const centers = await page
      .locator('.sidebar__crest, .sidebar__toggle, .sidebar__nav .sidebar__link')
      .evaluateAll((elements) =>
        elements.map((element) => {
          const bounds = element.getBoundingClientRect();
          return bounds.x + bounds.width / 2;
        }),
      );
    expect(Math.max(...centers) - Math.min(...centers)).toBeLessThan(1);
    const firstLink = page.locator('.sidebar__nav .sidebar__link').first();
    await firstLink.hover();
    await expect(page.getByRole('tooltip')).toHaveText('Inicio');
    await expect
      .poll(async () =>
        page.locator('.portal-chart canvas').evaluateAll((canvases) =>
          // Al redibujar, la gráfica cambia de lienzo: uno suelto aún no cuenta como medido.
          canvases.every((canvas) => {
            const grafica = canvas.closest('.portal-chart');
            return (
              grafica !== null &&
              Math.abs(
                canvas.getBoundingClientRect().width - grafica.getBoundingClientRect().width,
              ) < 2
            );
          }),
        ),
      )
      .toBe(true);
    await page
      .getByRole('button', { name: 'Expandir la barra de navegación', exact: true })
      .click();
    for (const width of widths) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 950 });
      const alignment = await page.evaluate(() => {
        const frame = document.querySelector('.app-shell')!.getBoundingClientRect();
        const bar = document.querySelector('.topbar')!.getBoundingClientRect();
        const workspace = document.querySelector('.workspace')!.getBoundingClientRect();
        return {
          // La aplicación tiene un ancho máximo: sobra espacio, pero repartido por igual a ambos lados.
          centrado: (document.documentElement.clientWidth - frame.width) / 2 - frame.left,
          headerLeft: bar.left - workspace.left,
          headerRight: bar.right - workspace.right,
        };
      });
      for (const difference of Object.values(alignment)) {
        expect(Math.abs(difference)).toBeLessThan(1);
      }
      await expect
        .poll(async () =>
          page.locator('.portal-chart canvas').evaluateAll((canvases) =>
            canvases.every((canvas) => {
              const grafica = canvas.closest('.portal-chart');
              return (
                grafica !== null &&
                Math.abs(
                  canvas.getBoundingClientRect().width - grafica.getBoundingClientRect().width,
                ) < 2
              );
            }),
          ),
        )
        .toBe(true);
      await noPageOverflow(page);
      if (width < 1200) {
        await page.getByRole('button', { name: 'Expandir menú', exact: true }).click();
        await expect(
          page.getByRole('dialog', { name: 'Módulos del portal', exact: true }),
        ).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.locator('.sidebar--open')).toHaveCount(0);
      }
    }
  });
}
