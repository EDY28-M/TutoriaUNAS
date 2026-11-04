import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

async function login(page: Page, role: 'Estudiante' | 'Tutor') {
  await page.goto('/login');
  await page.getByRole('tab', { name: role, exact: true }).click();
  await page.locator('#identifier').fill(role === 'Estudiante' ? '2023010456' : 'DOC-0421');
  await page.locator('#password').fill('tutoria2026');
  await page.locator('button[type="submit"]').click();
  await expect(page.locator('.workspace h1')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

async function geometry(locator: Locator) {
  return locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, scroll: scrollY };
  });
}

async function expectUnmoved(locator: Locator, before: Awaited<ReturnType<typeof geometry>>) {
  await expect
    .poll(async () => {
      // Espera a que el navegador haya aplicado el tamaño de la nueva vista.
      await locator.evaluate(
        () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
      );
      const after = await geometry(locator);
      return Math.max(
        ...Object.keys(before).map((key) =>
          Math.abs(after[key as keyof typeof after] - before[key as keyof typeof before]),
        ),
      );
    })
    .toBeLessThanOrEqual(1);
}

for (const width of [320, 375, 390, 768, 1024, 1440]) {
  test(`estudiante: filtros con resultados y vacíos sin desplazar la página a ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 650 });
    await login(page, 'Estudiante');
    await page.goto('/estudiante/instrumentos');
    const filters = page.getByRole('group', { name: 'Filtrar mis formularios', exact: true });
    await expect(filters).toBeVisible();
    const atTop = await geometry(filters);
    await filters.getByRole('button', { name: /^Enviados/ }).click();
    await expect(filters.getByRole('button', { name: /^Enviados/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expectUnmoved(filters, atTop);
    await filters.getByRole('button', { name: /^Todos/ }).click();
    await page.evaluate(() => window.scrollTo(0, 40));
    const before = await geometry(filters);
    expect(before.scroll).toBe(40);
    for (const label of ['Pendientes', 'Por corregir', 'Enviados', 'Todos']) {
      const button = filters.getByRole('button', { name: new RegExp(`^${label}`) });
      await button.click();
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      await expect(button).toBeFocused();
      await expectUnmoved(filters, before);
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    ).toBeLessThanOrEqual(1);
  });
}

for (const width of [375, 1440]) {
  test(`tutor: filtros al final de formularios y vistas del calendario de sesiones estables a ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 650 });
    await login(page, 'Tutor');
    await page.goto('/tutor/instrumentos?ambito=propios');
    const filters = page.getByRole('group', { name: 'Filtrar mis registros', exact: true });
    await expect(filters).toBeAttached();
    await filters.evaluate((element) =>
      window.scrollTo(0, element.getBoundingClientRect().top + scrollY - 100),
    );
    const before = await geometry(filters);
    for (const label of ['Por corregir', 'Enviados', 'Revisados', 'Todos']) {
      const button = filters.getByRole('button', { name: new RegExp(`^${label}`) });
      await button.click();
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      await expect(button).toBeFocused();
      await expectUnmoved(filters, before);
    }
    await page.goto('/tutor/sesiones');
    const tabs = page.getByRole('group', { name: 'Vista del calendario', exact: true });
    await expect(tabs).toBeVisible();
    const initial = await geometry(tabs);
    for (const label of ['Semana', 'Mes']) {
      const button = tabs.getByRole('button', { name: label, exact: true });
      await button.click();
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      await expectUnmoved(tabs, initial);
    }
  });

  test(`expediente: pestañas con estado local y teclado conservan la posición a ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 650 });
    await login(page, 'Estudiante');
    await page.goto('/estudiante/expediente');
    const tabs = page.getByRole('tablist', { name: 'Secciones del expediente académico' });
    await expect(tabs).toBeAttached();
    await tabs.evaluate((element) =>
      window.scrollTo(0, element.getBoundingClientRect().top + scrollY - 100),
    );
    await tabs
      .getByRole('tab', { name: /^Matrícula/ })
      .evaluate((element) => element.focus({ preventScroll: true }));
    const before = await geometry(tabs);
    for (const label of ['Horario', 'Mis datos']) {
      await page.keyboard.press('ArrowRight');
      await expect(tabs.getByRole('tab', { name: new RegExp(`^${label}`) })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await expectUnmoved(tabs, before);
    }
    await page.getByRole('link', { name: 'Inicio', exact: true }).first().click();
    await expect(page).toHaveURL('/estudiante/dashboard');
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    await expect(page.locator('#main-content')).toBeFocused();
  });
}
