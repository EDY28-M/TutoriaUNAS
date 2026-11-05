import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const require = createRequire(new URL('../frontend/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const base = process.argv[2] ?? 'http://127.0.0.1:5173';
const mode = new URL(base).port === '5188' ? 'demo' : 'api';
const output = new URL(`../artifacts/graficas-estables/${mode}/`, import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
const errors = [];
try {
  for (const account of [
    { role: 'tutor', id: 'DOC-0421' },
    { role: 'estudiante', id: '2023010456' },
    { role: 'coordinacion', id: 'coordinacion.tutoria' },
  ]) {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${base}/login`);
    await page.locator('#identifier').fill(account.id);
    await page.locator('#password').fill('tutoria2026');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(`**/${account.role}/dashboard`);
    const card = page.locator('.chart-card--instruments');
    const chart = card.locator('.portal-chart');
    await expect(chart).toHaveAttribute('aria-busy', 'false');
    await page.evaluate(() => document.fonts.ready);
    const tabs = card.getByRole('group', { name: 'Gráfica de formularios' });
    const geometry = () => card.evaluate((element) => {
      const rect = (item) => {
        const r = item.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      };
      return {
        card: rect(element),
        tabs: rect(element.querySelector('.chart-tabs')),
        data: rect(element.querySelector('details')),
        scroll: scrollY,
        pageHeight: document.documentElement.scrollHeight,
      };
    });
    for (const width of [320, 375, 390, 768, 1024, 1440, 1880]) {
      await page.setViewportSize({ width, height: 900 });
      // Dejar terminar la adaptación del grid y el ResizeObserver de ECharts.
      await page.waitForTimeout(200);
      await tabs.evaluate((element) => window.scrollTo(0, element.getBoundingClientRect().top + scrollY - 120));
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const before = await geometry();
      for (const label of account.role === 'tutor' ? ['Por formato', 'Por estado', 'Por formato'] : ['Avance', 'Estados', 'Avance']) {
        const button = tabs.getByRole('button', { name: label, exact: true });
        await button.focus();
        await page.keyboard.press('Enter');
        await expect(button).toHaveAttribute('aria-pressed', 'true');
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const after = await geometry();
        for (const key of ['card', 'tabs', 'data']) {
          for (const prop of ['x', 'y', 'width', 'height']) assert(Math.abs(after[key][prop] - before[key][prop]) <= 1, `${account.role} ${width}: ${key}.${prop} cambió de ${before[key][prop]} a ${after[key][prop]}`);
        }
        assert.equal(after.scroll, before.scroll, `${account.role} ${width}: no desplazar scroll`);
        assert.equal(after.pageHeight, before.pageHeight, `${account.role} ${width}: mantener alto de página`);
        await expect(button).toBeFocused();
      }
      const options = await chart.evaluate((element) => window.echarts.getInstanceByDom(element).getOption());
      assert.equal(options.yAxis.length, 2, 'Porcentajes alineados en su propio eje');
      assert(options.yAxis[0].data.every((label) => /^F\d{2}$/.test(label)));
      assert(options.yAxis[1].data.every((label) => /^\d+%$/.test(label)));
      assert((await chart.boundingBox()).height >= 198);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert(overflow <= 1, `${account.role} ${width}: desbordamiento ${overflow}`);
      if ([390, 1880].includes(width)) {
        await card.evaluate((element) => window.scrollTo(0, element.getBoundingClientRect().top + scrollY - 180));
        await card.screenshot({ path: fileURLToPath(new URL(`${account.role}-formato-${width}.png`, output)), animations: 'disabled' });
      }
      await tabs.getByRole('button', { name: account.role === 'tutor' ? 'Por estado' : 'Estados', exact: true }).click();
      results.push({ role: account.role, width, geometry: before, overflow, status: 'PASS' });
    }
    await card.getByText('Ver datos del gráfico', { exact: true }).click();
    await expect(card.locator('details table')).toBeVisible();
    await context.close();
    console.log(`${account.role}: siete anchos, teclado y datos accesibles PASS`);
  }
  assert.deepEqual(errors, []);
  await writeFile(new URL('verificacion.json', output), JSON.stringify({ base, results, errors }, null, 2));
} finally {
  await browser.close();
}
