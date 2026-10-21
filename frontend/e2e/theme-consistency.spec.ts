import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const baseURL = process.env.PORTAL_BASE_URL ?? 'http://127.0.0.1:5173';
const accounts = [
  { role: 'estudiante', label: 'Estudiante', id: '2023010456' },
  { role: 'tutor', label: 'Tutor', id: 'DOC-0421' },
  { role: 'coordinacion', label: 'Coordinación', id: 'coordinacion.tutoria' },
] as const;

async function appearance(page: Page) {
  await expect(page.locator('.page-head h1')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  return page.evaluate(() => {
    function style(selector: string) {
      const element = document.querySelector(selector)!;
      const css = getComputedStyle(element);
      return {
        font: css.fontFamily,
        size: css.fontSize,
        weight: css.fontWeight,
        lineHeight: css.lineHeight,
        spacing: css.letterSpacing,
        color: css.color,
        background: css.backgroundColor,
      };
    }
    function bounds(selector: string) {
      const rect = document.querySelector(selector)!.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }
    const heading = bounds('.page-head h1');
    return {
      body: style('body'),
      sidebar: style('.sidebar'),
      brand: style('.sidebar__brand-text strong'),
      menu: style('.sidebar__link-label'),
      heading: style('.page-head h1'),
      description: style('.page-head__text > p:not(.sr-only)'),
      topbar: style('.topbar'),
      geometry: {
        brand: bounds('.sidebar__brand'),
        sidebar: bounds('.sidebar'),
        topbar: bounds('.topbar'),
        search: bounds('.topbar__search'),
        heading: { x: heading.x + scrollX, y: heading.y + scrollY },
      },
      fontLoaded: document.fonts.check('600 16px "Manrope Variable"'),
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  });
}

async function navigate(page: Page, role: string, route: string, width: number) {
  if (width < 1200) await page.locator('.topbar__menu').click();
  await page.locator(`.sidebar__nav a[href="/${role}/${route}"]`).click();
  await expect(page).toHaveURL(`${baseURL}/${role}/${route}`);
  if (route === 'dashboard') await expect(page.locator('.dashboard-page')).toBeVisible();
  else await expect(page.locator('.page-head h1')).toHaveText(/sesiones de tutoría/i);
}

for (const account of accounts) {
  for (const width of [320, 375, 390, 768, 1024, 1440, 1920]) {
    test(`${account.role}: tema estable entre rutas y recargas a ${width}px`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`${baseURL}/login`);
      await page.getByRole('tab', { name: account.label, exact: true }).click();
      await page.locator('#identifier').fill(account.id);
      await page.locator('#password').fill('tutoria2026');
      await page.locator('.d01__form button[type="submit"]').click();
      await expect(page).toHaveURL(`${baseURL}/${account.role}/dashboard`);

      // Sesiones abre antes de que se descargue el estilo del panel de inicio.
      await page.goto(`${baseURL}/${account.role}/sesiones`);
      const calendar = await appearance(page);
      expect(calendar.fontLoaded).toBe(true);
      expect(calendar.body.font).toContain('Manrope Variable');
      expect(calendar.brand.font).toBe(calendar.body.font);
      expect(calendar.heading.font).toBe(calendar.body.font);
      expect(calendar.description.font).toBe(calendar.body.font);
      const { overflow, ...theme } = calendar;
      expect(overflow).toBeLessThanOrEqual(1);
      const todayLines = await page
        .locator('.calendar__daypanel-head > .badge')
        .evaluate((element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          return range.getClientRects().length;
        });
      expect(todayLines).toBe(1);
      const assertSameTheme = async () => {
        const { overflow, ...current } = await appearance(page);
        expect(overflow).toBeLessThanOrEqual(1);
        expect(current).toEqual(theme);
      };

      await navigate(page, account.role, 'dashboard', width);
      await assertSameTheme();
      await expect(page.locator('.portal-chart canvas')).toHaveCount(2);
      if ([375, 1440].includes(width)) {
        await page.screenshot({ path: testInfo.outputPath('inicio.png'), fullPage: true });
      }
      await navigate(page, account.role, 'sesiones', width);
      await assertSameTheme();
      if ([375, 1440].includes(width)) {
        await page.screenshot({ path: testInfo.outputPath('calendario.png') });
      }
      await page.locator(`.app-footer a[href="/${account.role}/preferencias"]`).click();
      await expect(page.locator('.page-head h1')).toHaveText('Ajustes de pantalla');
      await assertSameTheme();
      await page.goBack();
      await expect(page.locator('.page-head h1')).toHaveText(/sesiones de tutoría/i);
      await assertSameTheme();
      await page.reload();
      await assertSameTheme();
      expect(errors).toEqual([]);
    });
  }
}
