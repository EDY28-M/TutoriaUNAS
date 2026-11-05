import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { fontAwesomeIcons } from '../frontend/src/assets/vendor/fontawesome-icons.ts';

const require = createRequire(new URL('../frontend/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const base = process.argv[2] ?? 'http://127.0.0.1:5173';
const mode = new URL(base).port === '5188' ? 'demo' : 'api';
const output = new URL(`../artifacts/directorios/${mode}/`, import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, reducedMotion: 'reduce' });
const page = await context.newPage();
const errors = [];
const results = [];
const officialPaths = new Set(Object.values(fontAwesomeIcons).map((icon) => icon.path));
const stylesByRoute = [];
async function metricStyle(locator) {
  return locator.evaluate((card) => {
    const properties = {
      card: ['borderTopWidth', 'borderTopColor', 'borderRadius', 'boxShadow', 'backgroundColor'],
      '.stat__body': ['display', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'rowGap', 'columnGap'],
      '.stat__label': ['fontSize', 'fontWeight', 'color'],
      '.stat__value': ['fontSize', 'fontWeight', 'color', 'letterSpacing'],
      '.stat__visual': ['width', 'height', 'backgroundColor', 'borderRadius'],
      '.stat__note': ['fontSize', 'color'],
    };
    return Object.fromEntries(Object.entries(properties).map(([selector, keys]) => {
      const style = getComputedStyle(selector === 'card' ? card : card.querySelector(selector));
      return [selector, Object.fromEntries(keys.map((key) => [key, style[key]]))];
    }));
  });
}
page.on('pageerror', (error) => errors.push(error.message));
try {
  await page.goto(`${base}/login`);
  await page.locator('#identifier').fill('coordinacion.tutoria');
  await page.locator('#password').fill('tutoria2026');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/coordinacion/dashboard');
  for (const route of ['asignaciones', 'tutores', 'tutorados']) {
    await page.goto(`${base}/coordinacion/${route}`);
    await page.locator('.directory-summary').waitFor();
    await page.evaluate(() => document.fonts.ready);
    for (const width of [1440, 1024, 768, 390, 375, 320]) {
      await page.setViewportSize({ width, height: 960 });
      await page.waitForFunction(() => innerWidth >= 1200 || getComputedStyle(document.querySelector('#app-sidebar')).visibility === 'hidden');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert(overflow <= 1, `${route} a ${width}: desbordamiento de ${overflow}px`);
      const gutters = await page.locator('.directory-page .card:not(.stat) > :is(.card__head,.card__body,.card__foot)').evaluateAll((elements) => elements.map((element) => {
        const style = getComputedStyle(element);
        return { left: parseFloat(style.paddingLeft), right: parseFloat(style.paddingRight) };
      }));
      assert(gutters.length >= 2 && gutters.every((gutter) => gutter.left >= 16 && gutter.right >= 16), `${route} a ${width}: espacio interior de los listados`);
      await expect(page.locator('.directory-summary .stat')).toHaveCount(4);
      await expect(page.locator('.directory-summary .stat__visual > svg.portal-icon')).toHaveCount(4);
      const paths = await page.locator('.directory-summary .stat__visual').evaluateAll((visuals) => visuals.map((visual) => ({
        children: visual.children.length,
        count: visual.querySelectorAll('path').length,
        path: visual.querySelector('path')?.getAttribute('d'),
        background: getComputedStyle(visual).backgroundColor,
      })));
      assert(paths.every((icon) => icon.children === 1 && icon.count === 1 && officialPaths.has(icon.path)), `${route}: un único icono oficial`);
      assert(paths.every((icon) => icon.path !== fontAwesomeIcons['solid:percent'].path), `${route}: porcentaje repetido como icono`);
      if ([1440, 390].includes(width)) stylesByRoute.push({ route, width, style: await metricStyle(page.locator('.directory-summary .stat').first()) });
      const collisions = await page.locator('.directory-summary .stat__body').evaluateAll((bodies) => bodies.filter((body) => {
        const range = document.createRange();
        range.selectNodeContents(body.querySelector('.stat__value'));
        const value = range.getBoundingClientRect();
        const icon = body.querySelector('.stat__visual').getBoundingClientRect();
        return value.right > icon.left + 1;
      }).length);
      assert.equal(collisions, 0, `${route} a ${width}: cifra e icono superpuestos`);
      await expect(page.getByRole('button', { name: /^Filtros/ })).toBeVisible();
      await expect(page.locator('.directory-filter-form')).toHaveCount(0);
      if ([1440, 390, 320].includes(width)) {
        await page.screenshot({ path: fileURLToPath(new URL(`${route}-${width}.png`, output)), fullPage: true, animations: 'disabled' });
        await page.locator('.directory-summary').screenshot({ path: fileURLToPath(new URL(`${route}-indicadores-${width}.png`, output)), animations: 'disabled' });
      }
      results.push({ route, width, overflow });
    }
    await page.setViewportSize({ width: 1880, height: 960 });
    await page.locator('.directory-summary').screenshot({ path: fileURLToPath(new URL(`${route}-indicadores-escritorio.png`, output)), animations: 'disabled' });
    await page.setViewportSize({ width: 1440, height: 960 });
    const filterButton = page.getByRole('button', { name: /^Filtros/ });
    await filterButton.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Escuela', { exact: true }).selectOption({ index: 1 });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(filterButton).toBeFocused();
    await expect(page.locator('.directory-filter-tags')).toHaveCount(0);
    await filterButton.click();
    await expect(dialog.getByLabel('Escuela', { exact: true })).toHaveValue('');
    await dialog.getByLabel('Escuela', { exact: true }).selectOption({ index: 1 });
    await dialog.getByRole('button', { name: 'Aplicar filtros' }).click();
    await expect(page.getByRole('button', { name: 'Quitar filtro Escuela' })).toBeVisible();
    await page.reload();
    await page.locator('.directory-summary').waitFor();
    const view = route === 'asignaciones' ? 'Finalizadas' : route === 'tutores' ? 'Con cupos' : 'Sin tutor';
    await page.getByRole('button', { name: new RegExp(`^${view}`) }).click();
    await expect(page.getByRole('button', { name: new RegExp(`^${view}`) })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Limpiar todo' }).click();
    const search = page.locator('.directory-search input');
    await search.fill('ZZZ-SIN-RESULTADOS-912');
    await expect(page.locator('.directory-page .empty-state')).toBeVisible();
    await page.getByRole('button', { name: 'Limpiar todo' }).click();
    const detail = page.locator('.directory-page tbody button').first();
    if (await detail.count()) {
      await detail.click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(detail).toBeFocused();
    }
    if (route === 'tutorados') {
      await page.getByRole('button', { name: 'Página siguiente' }).click();
      await expect(page.locator('.table-pagination')).toContainText('página 2');
    }
    await page.setViewportSize({ width: 390, height: 960 });
    await filterButton.click();
    await page.screenshot({ path: fileURLToPath(new URL(`${route}-filtros-390.png`, output)), animations: 'disabled' });
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    assert.deepEqual(axe.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((node) => node.target) })), [], `${route}: accesibilidad del panel`);
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 1440, height: 960 });
    const listAxe = await new AxeBuilder({ page }).include('.directory-page').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    assert.deepEqual(listAxe.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((node) => node.target) })), [], `${route}: accesibilidad del listado`);
    console.log(`${route}: responsive, filtros, búsqueda, ficha y accesibilidad PASS`);
  }
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 960 });
    await page.goto(`${base}/coordinacion/dashboard`);
    const reference = page.locator('.dashboard-metrics > .stat').first();
    await reference.waitFor();
    const expected = await metricStyle(reference);
    for (const entry of stylesByRoute.filter((entry) => entry.width === width)) {
      assert.deepEqual(entry.style, expected, `${entry.route} a ${width}: mismo diseño de las tarjetas de Inicio`);
    }
  }
  for (const route of ['dashboard', 'reportes']) {
    await page.setViewportSize({ width: 1880, height: 960 });
    await page.goto(`${base}/coordinacion/${route}`);
    const stats = page.locator(route === 'dashboard' ? '.dashboard-metrics > .stat' : '.compact-page > .grid--4 > .stat');
    await expect(stats).toHaveCount(4);
    const expectedSize = 48;
    const dimensions = await stats.locator('.stat__visual > svg.portal-icon').evaluateAll((icons) => icons.map((icon) => ({
      width: icon.getBoundingClientRect().width,
      height: icon.getBoundingClientRect().height,
      path: icon.querySelector('path')?.getAttribute('d'),
      count: icon.querySelectorAll('path').length,
    })));
    assert.equal(dimensions.length, 4, `${route}: renderer anterior restaurado`);
    assert(dimensions.every((icon) => icon.width === expectedSize && icon.height === expectedSize && icon.count === 1 && officialPaths.has(icon.path)), `${route}: tamaño anterior e icono oficial único`);
    await stats.first().locator('..').screenshot({ path: fileURLToPath(new URL(`${route}-iconos-restaurados.png`, output)), animations: 'disabled' });
    console.log(`${route}: iconos compartidos de Reportes a ${expectedSize}px PASS`);
  }
  assert.deepEqual(errors, []);
  await writeFile(new URL('verificacion.json', output), JSON.stringify({ base, results, errors, status: 'PASS' }, null, 2));
} catch (error) {
  await page.screenshot({ path: fileURLToPath(new URL('fallo.png', output)), fullPage: true });
  throw error;
} finally {
  await browser.close();
}
