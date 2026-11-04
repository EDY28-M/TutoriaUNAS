import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const require = createRequire(new URL('../frontend/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const base = process.argv.find((arg) => arg.startsWith('http')) ?? 'http://127.0.0.1:5173';
const auditOnly = process.argv.includes('--audit-only');
const mode = new URL(base).port === '5188' ? 'demo' : 'api';
const output = new URL(`../artifacts/estilo-portales/${mode}/`, import.meta.url);
await mkdir(output, { recursive: true });
const source = await readFile(new URL('../frontend/src/routes/AppRoutes.tsx', import.meta.url), 'utf8');
const routes = [...new Set([...source.matchAll(/path="(\/(?:estudiante|tutor|coordinacion)\/[^":]+)"/g)].map((match) => match[1]))];
const widths = auditOnly ? [1440] : [320, 375, 390, 768, 1024, 1440];
const results = [];
const errors = [];
const accessibility = [];
const browser = await chromium.launch({ headless: true });
try {
  for (const account of [
    { role: 'estudiante', identifier: '2023010456' },
    { role: 'tutor', identifier: 'DOC-0421' },
    { role: 'coordinacion', identifier: 'coordinacion.tutoria' },
  ]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push({ role: account.role, error: error.message }));
    try {
      await page.goto(`${base}/login`);
      await page.locator(`#login-role-${account.role}`).click();
      await page.locator('#identifier').fill(account.identifier);
      await page.locator('#password').fill('tutoria2026');
      await page.locator('button[type="submit"]').click();
      await page.waitForURL(`**/${account.role}/dashboard`);
      const ownRoutes = routes.filter((route) => route.startsWith(`/${account.role}/`));
      if (account.role === 'tutor') ownRoutes.push('/tutor/tutorados/EST-2023010456');
      for (const route of ownRoutes) {
        await page.goto(`${base}${route}`);
        await page.getByRole('heading', { level: 1 }).first().waitFor();
        await page.evaluate(() => document.fonts.ready);
        for (const width of widths) {
          await page.setViewportSize({ width, height: 960 });
          await page.waitForFunction(() => innerWidth >= 1200 || getComputedStyle(document.querySelector('#app-sidebar')).visibility === 'hidden');
          const result = await page.locator('.workspace').evaluate((workspace) => {
            const visible = (element) => element.getClientRects().length > 0;
            const hasFrame = (style) => ['Top', 'Right', 'Bottom', 'Left'].some((side) => parseFloat(style[`border${side}Width`]) > 0);
            const cards = [...workspace.querySelectorAll('.card')].filter(visible);
            const wrappers = [...workspace.querySelectorAll('.table-wrap, .data-table-panel__scroll')].filter(visible);
            const icons = [...workspace.querySelectorAll('.stat__visual')].filter(visible);
            const unexpectedFrames = [...workspace.querySelectorAll('*')].filter((element) => {
              const bounds = element.getBoundingClientRect();
              if (bounds.width < 180 || bounds.height < 60 || !visible(element)) return false;
              if (element.matches('input,select,textarea,button,a,label,fieldset,summary,th,td,table,.alert,.badge') || element.closest('.alert')) return false;
              const css = getComputedStyle(element);
              return css.boxShadow !== 'none' || ['Top', 'Right', 'Bottom', 'Left'].every((side) => parseFloat(css[`border${side}Width`]) > 0);
            }).map((element) => element.className);
            return {
              overflow: document.documentElement.scrollWidth - innerWidth,
              cards: cards.length,
              tables: wrappers.length,
              iconCount: icons.length,
              cardErrors: cards.filter((element) => { const css = getComputedStyle(element); return hasFrame(css) || css.boxShadow !== 'none'; }).map((element) => element.className),
              tableErrors: wrappers.filter((element) => { const css = getComputedStyle(element); return hasFrame(css) || css.boxShadow !== 'none'; }).map((element) => element.className),
              iconErrors: icons.filter((element) => { const css = getComputedStyle(element); const icon = element.querySelector('svg'); return css.backgroundColor !== 'rgba(0, 0, 0, 0)' || !icon || icon.getBoundingClientRect().width !== 48 || icon.getBoundingClientRect().height !== 48 || element.children.length !== 1; }).map((element) => element.className),
              unexpectedFrames: [...new Set(unexpectedFrames)],
              legacyMetrics: workspace.querySelectorAll('.tutees-metrics,.notice-metrics,.studies-summary,.report-metrics,.referral-metrics,.report-preview-totals').length,
            };
          });
          results.push({ route, width, ...result });
          if (!auditOnly) {
            assert(result.overflow <= 1, `${route} ${width}px: desbordamiento ${result.overflow}`);
            assert.deepEqual(result.cardErrors, [], `${route}: tarjetas sin contorno ni sombra`);
            assert.deepEqual(result.tableErrors, [], `${route}: tablas sin marco`);
            assert.deepEqual(result.iconErrors, [], `${route}: iconos como Reportes`);
            assert.equal(result.legacyMetrics, 0, `${route}: franja de indicadores antigua`);
          }
          if (!auditOnly && width === 1440 && /\/(dashboard|perfil|tutorados|expediente)$/.test(route)) {
            const axe = await new AxeBuilder({ page }).include('.workspace').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
            const violations = axe.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((node) => node.target) }));
            accessibility.push({ route, width, violations });
            assert.deepEqual(violations, [], `${route}: accesibilidad A/AA`);
          }
          if (!auditOnly && [320, 1440].includes(width) && /\/(dashboard|reportes|tutorados|asignaciones|salud|instrumentos)$/.test(route)) {
            const name = route.slice(1).replaceAll('/', '-');
            await page.screenshot({ path: fileURLToPath(new URL(`${name}-${width}.png`, output)), fullPage: true, animations: 'disabled' });
          }
        }
        if (!auditOnly && /\/(tutorados|expediente|reportes|avisos|derivaciones|asignaciones)$/.test(route) && await page.locator('.portal-metrics-region').count()) {
          await page.setViewportSize({ width: 1880, height: 960 });
          await page.locator('.portal-metrics-region').first().screenshot({ path: fileURLToPath(new URL(`${route.slice(1).replaceAll('/', '-')}-indicadores.png`, output)), animations: 'disabled' });
        }
      }
      console.log(`${account.role}: ${ownRoutes.length} rutas revisadas`);
    } finally { await context.close(); }
  }
  assert.deepEqual(errors, []);
  const summary = { base, auditOnly, routes: new Set(results.map((result) => result.route)).size, combinations: results.length, errors, accessibility, results };
  await writeFile(new URL(auditOnly ? 'auditoria.json' : 'verificacion.json', output), JSON.stringify(summary, null, 2));
  const frames = [...new Set(results.flatMap((result) => result.unexpectedFrames))];
  console.log(JSON.stringify({ routes: summary.routes, combinations: summary.combinations, frames }));
} finally { await browser.close(); }
