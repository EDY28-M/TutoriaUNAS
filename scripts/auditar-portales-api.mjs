import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../frontend/package.json', import.meta.url));
const { chromium } = require('@playwright/test');
const base = process.env.PORTAL_BASE_URL ?? 'http://127.0.0.1:5173';
const output = new URL('../artifacts/auditoria-portales/', import.meta.url);
await mkdir(new URL('capturas/', output), { recursive: true });
const source = await readFile(new URL('../frontend/src/routes/AppRoutes.tsx', import.meta.url), 'utf8');
const rutas = [...new Set([...source.matchAll(/path="(\/(?:estudiante|tutor|coordinacion)\/[^":]+)"/g)].map(m => m[1]))];
const resultados = [];
const browser = await chromium.launch({ headless: true });
try {
  for (const cuenta of [ { rol: 'estudiante', usuario: '2023010456' }, { rol: 'tutor', usuario: 'DOC-0421' }, { rol: 'coordinacion', usuario: 'coordinacion.tutoria' } ]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
    try {
      const page = await context.newPage();
      const errores = [];
      page.on('pageerror', e => errores.push(e.message));
      await page.goto(`${base}/login`);
      await page.locator(`#login-role-${cuenta.rol}`).click();
      await page.locator('#identifier').fill(cuenta.usuario);
      await page.locator('#password').fill('tutoria2026');
      await page.locator('button[type="submit"]').click();
      await page.waitForURL(`**/${cuenta.rol}/dashboard`);
      const propias = rutas.filter(r => r.startsWith(`/${cuenta.rol}/`));
      if(cuenta.rol === 'tutor') propias.push('/tutor/tutorados/EST-2023010456');
      for (const ruta of propias) {
        const antes = errores.length;
        const resultado = { rol: cuenta.rol, ruta, titulo: '', anchos: [], errores: [] };
        try {
          await page.goto(`${base}${ruta}`);
          await page.getByRole('heading', { level: 1 }).first().waitFor({ timeout: 12000 });
          resultado.titulo = await page.getByRole('heading', { level: 1 }).first().innerText();
          if (/no encontr|no disponible|no pudimos/i.test(resultado.titulo)) throw new Error(resultado.titulo);
          for (const ancho of [320, 375, 390, 768, 1024, 1440]) {
            await page.setViewportSize({ width: ancho, height: 950 });
            try {
              await page.waitForFunction(() => {
                const panel = document.querySelector('#app-sidebar');
                return innerWidth >= 1200 || !panel || getComputedStyle(panel).visibility === 'hidden' || panel.getBoundingClientRect().right <= 1;
              }, null, { timeout: 2000 });
              await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth + 1, null, { timeout: 2000 });
              resultado.anchos.push({ ancho, estado: 'PASS' });
            } catch { resultado.anchos.push({ ancho, estado: 'FAIL', exceso: await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) }); }
            if (ancho === 320 && ['/coordinacion/plan', '/coordinacion/permisos', '/tutor/avisos'].includes(ruta)) {
              await page.screenshot({ path: fileURLToPath(new URL(`capturas/${ruta.slice(1).replaceAll('/', '-')}-320.png`, output)), fullPage: true, animations: 'disabled' });
            }
          }
          if (['/coordinacion/permisos', '/coordinacion/plan', '/coordinacion/revisiones', '/tutor/avisos', '/estudiante/documentos'].includes(ruta)) {
            await page.screenshot({ path: fileURLToPath(new URL(`capturas/${ruta.slice(1).replaceAll('/', '-')}.png`, output)), fullPage: true, animations: 'disabled' });
          }
        } catch (error) { resultado.errores.push(error.message); }
        resultado.errores.push(...errores.slice(antes));
        resultado.estado = resultado.errores.length || resultado.anchos.some(a => a.estado === 'FAIL') ? 'FAIL' : 'PASS';
        resultados.push(resultado);
      }
    } finally { await context.close(); }
  }
  const resumen = { fecha: new Date().toISOString(), modo: 'API: lectura y responsive; las mutaciones se verifican en e2e/api-*.spec.ts', rutas: resultados.length, pass: resultados.filter(r => r.estado === 'PASS').length, fail: resultados.filter(r => r.estado === 'FAIL').length, resultados };
  await writeFile(new URL('rutas.json', output), JSON.stringify(resumen, null, 2));
  console.log(JSON.stringify({ rutas: resumen.rutas, pass: resumen.pass, fail: resumen.fail, fallos: resultados.filter(r => r.estado === 'FAIL') }));
  if(resumen.fail) process.exitCode = 1;
} finally { await browser.close(); }
