import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const accounts = [
  {
    role: 'estudiante',
    label: 'Estudiante',
    identifier: '2023010456',
    link: 'Documentos',
    path: '/estudiante/documentos',
    module: 'estudiante/StudentDocuments',
  },
  {
    role: 'tutor',
    label: 'Tutor',
    identifier: 'DOC-0421',
    link: 'Reportes',
    path: '/tutor/reportes',
    module: 'tutor/TutorReports',
  },
  {
    role: 'coordinacion',
    label: 'Coordinación',
    identifier: 'coordinacion.tutoria',
    link: 'Preguntas y reglas',
    path: '/coordinacion/campos',
    module: 'coordinacion/CoordFields',
  },
] as const;

async function login(page: Page, account: (typeof accounts)[number]) {
  await page.goto('/login');

  await page.locator('#identifier').fill(account.identifier);
  await page.locator('#password').fill('tutoria2026');
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(`/${account.role}/dashboard`);
  await expect(page.locator('.workspace h1')).toBeVisible();
}

async function destinationLink(page: Page, account: (typeof accounts)[number]) {
  const nav = page.locator('.sidebar__nav');
  if (account.role === 'coordinacion')
    await nav.getByRole('button', { name: /^Formularios/ }).click();
  return nav.getByRole('link', { name: account.link, exact: true });
}

for (const account of accounts) {
  test(`${account.role}: una descarga lenta conserva el sidebar y permite cambiar de destino`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    await login(page, account);
    const sidebar = await page.locator('#app-sidebar').elementHandle();
    let release!: () => void;
    const pending = new Promise<void>((resolve) => (release = resolve));
    await page.route(`**/src/pages/${account.module}.tsx*`, async (route) => {
      await pending;
      await route.continue();
    });
    try {
      const request = page.waitForRequest((r) => r.url().includes(`${account.module}.tsx`));
      await (await destinationLink(page, account)).click();
      await request;
      await expect(page.locator('#app-sidebar')).toBeVisible();
      await expect(page.locator('.topbar')).toBeVisible();
      expect(await sidebar!.evaluate((element) => element.isConnected)).toBe(true);
      // La navegación sigue disponible aunque el primer destino no haya terminado de cargar.
      await page
        .locator('.sidebar__nav')
        .getByRole('link', { name: 'Mi perfil', exact: true })
        .click();
      await expect(page).toHaveURL(`/${account.role}/perfil`);
      await expect(page.locator('.workspace h1')).toBeVisible();
    } finally {
      release();
    }
    await expect(page).toHaveURL(`/${account.role}/perfil`);
    expect(await sidebar!.evaluate((element) => element.isConnected)).toBe(true);
  });

  test(`${account.role}: anticipa solo el módulo señalado sin cambiar de página`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    const modules: string[] = [];
    page.on('request', (request) => {
      const path = new URL(request.url()).pathname;
      if (path.startsWith('/src/pages/')) modules.push(path);
    });
    await login(page, account);
    const destination = await destinationLink(page, account);
    const module = `/src/pages/${account.module}.tsx`;
    expect(modules).not.toContain(module);
    const beforeIntent = modules.length;
    const response = page.waitForResponse((r) => new URL(r.url()).pathname === module);
    if (account.role === 'tutor') await destination.focus();
    else await destination.hover();
    await response;
    await expect(page).toHaveURL(`/${account.role}/dashboard`);
    expect(modules.filter((path) => path === module)).toHaveLength(1);
    expect(modules.slice(beforeIntent)).toEqual([module]);
    await destination.click();
    await expect(page).toHaveURL(account.path);
    await expect(page.locator('.workspace h1')).toBeVisible();
    expect(modules.filter((path) => path === module)).toHaveLength(1);
    await expect(destination).toHaveAttribute('aria-current', 'page');
    await page.goBack();
    await expect(page).toHaveURL(`/${account.role}/dashboard`);
    await expect(page.locator('.workspace h1')).toBeVisible();
  });
}

for (const width of [320, 375, 390, 768, 1024, 1440]) {
  test(`sidebar: foco, navegación y geometría a ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await login(page, accounts[1]);
    const sidebar = page.locator('#app-sidebar');
    const mobile = width < 1200;
    if (mobile) {
      const trigger = page.getByRole('button', { name: 'Expandir menú', exact: true });
      await trigger.click();
      await expect(sidebar).toHaveAttribute('aria-modal', 'true');
      await page.keyboard.press('Escape');
      await expect(trigger).toBeFocused();
      await expect(sidebar).toHaveAttribute('inert', '');
      await trigger.click();
    }
    await sidebar.getByRole('link', { name: /^Mis formularios/ }).click();
    await expect(page).toHaveURL('/tutor/instrumentos?ambito=propios');
    await expect(page.getByRole('heading', { name: 'Mis formularios', exact: true })).toBeVisible();
    await expect(page.locator('#main-content')).toBeFocused();
    if (mobile) {
      await expect(sidebar).toHaveAttribute('inert', '');
      await expect(page.locator('.app-main')).not.toHaveAttribute('inert', '');
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath(`navigation-${width}.png`) });
  });
}

test('movimiento reducido: no se anima el contenido ni los submenús', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 950 });
  await login(page, accounts[0]);
  const nav = page.locator('.sidebar__nav');
  await nav.getByRole('button', { name: /^Mis formularios/ }).click();
  await expect(nav.locator('.sidebar__submenu.show')).toBeVisible();
  expect(await nav.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0);
  await nav.getByRole('link', { name: 'Todos los formularios', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mis formularios', exact: true })).toBeVisible();
  expect(
    await page.locator('.workspace__page').evaluate((element) => element.getAnimations().length),
  ).toBe(0);
});
