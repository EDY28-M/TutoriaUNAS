import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'frontend/package.json'));
const { chromium } = require('@playwright/test');
const arg = (name, fallback) => process.argv.find(v => v.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const widths = arg('widths', '1920,1440,1366,1024,768,390,375').split(',').map(Number);
const pass = arg('pass', 'final');
if (!/^[a-z0-9-]+$/.test(pass)) throw new Error('Invalid artifact directory');
const out = resolve(root, 'artifacts/layout-audit', pass);
await mkdir(out, { recursive: true });
const routesSource = await readFile(resolve(root, 'frontend/src/routes/AppRoutes.tsx'), 'utf8');
const basePaths = [...routesSource.matchAll(/<Route path="([^"]+)"/g)].map(m => m[1]);
const accounts = [
  { role: 'estudiante', label: 'Estudiante', id: '2023010456' },
  { role: 'tutor', label: 'Tutor', id: 'DOC-0421' },
  { role: 'coordinacion', label: 'Coordinación', id: 'coordinacion.tutoria' },
];
const records = [];
const failures = [];
const runtime = [];
const network = [];
const actions = [];
let current = {};
const browser = await chromium.launch();
const slug = s => s.replace(/[^a-z0-9]+/gi, '-').slice(0, 105);
async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(image => image.decode().catch(() => {})));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

/** DOM geometry is inspected at every state, including content below the fold.
 * Horizontal scrolling inside explicitly scrollable tables/calendars is allowed. */
function inspectLayout() {
  const active = document.querySelector('dialog[open], .modal:not([hidden]) .modal__card');
  const popup = document.querySelector('[popover]:popover-open');
  const scope = active ?? popup ?? document.querySelector('.workspace, .d01') ?? document.body;
  const issues = [];
  const visible = e => {
    if(!e.getClientRects().length||getComputedStyle(e).visibility==='hidden')return false;
    for(let parent=e.parentElement;parent;parent=parent.parentElement) {
      if(parent.matches('details:not([open])')&&!parent.querySelector(':scope > summary')?.contains(e))return false;
    }
    return true;
  };
  const name = e => `${e.tagName.toLowerCase()}${[...e.classList].slice(0, 2).map(c => '.' + c).join('')}`;
  const rect = e => { const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
  const add = (kind, e, data = {}) => issues.push({ kind, element: name(e), text: e.textContent.trim().replace(/\s+/g, ' ').slice(0, 100), box: rect(e), ...data });
  for (const illustration of document.querySelectorAll('img.portal-art')) {
    if (!illustration.complete || !illustration.naturalWidth) add('broken-illustration', illustration, { src: illustration.getAttribute('src') });
    if (visible(illustration)) {
      const r = illustration.getBoundingClientRect();
      const parent = illustration.parentElement.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || r.width > parent.width + 1 || r.height > parent.height + 1) add('illustration-outside-container', illustration);
    }
  }
  if (document.documentElement.scrollWidth > innerWidth + 2) add('page-overflow', scope, { amount: document.documentElement.scrollWidth - innerWidth });
  const fluidFrame = document.querySelector('.app-shell--wide');
  if (fluidFrame) {
    const frame = fluidFrame.getBoundingClientRect();
    if (Math.abs(frame.left) > 1 || Math.abs(document.documentElement.clientWidth - frame.width) > 1) add('unused-viewport-width', fluidFrame);
    const bar = document.querySelector('.topbar').getBoundingClientRect();
    const workspace = document.querySelector('.workspace').getBoundingClientRect();
    if (Math.abs(bar.left - workspace.left) > 1 || Math.abs(bar.right - workspace.right) > 1) add('header-content-misaligned', fluidFrame);
  }
  if (active) {
    const r = active.getBoundingClientRect();
    if (r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1) add('dialog-outside-viewport', active);
    const body = active.querySelector('.sheet__body');
    const foot = active.querySelector('.sheet__foot');
    if (body && foot && body.getBoundingClientRect().bottom > foot.getBoundingClientRect().top + 1) add('dialog-body-footer-overlap', body);
  }
  const selectors = '.card,.grid,.stack,.field-grid,.calendar-layout,.tutorial-calendar,.calendar__day,.agenda,.agenda__row,.list__body,.sheet__body';
  for (const e of scope.querySelectorAll(selectors)) {
    if (!visible(e)) continue;
    const r = e.getBoundingClientRect();
    if (e.matches('.calendar__day') && r.width < 90) add('narrow-calendar-day', e);
    else if (e.matches('.tutorial-calendar') && r.width < Math.min(280, scope.clientWidth - 20)) add('collapsed-calendar', e);
    else if (e.matches('.card,.grid,.stack,.agenda,.list__body,.sheet__body') && e.textContent.trim().length > 35 && r.width < 80) add('collapsed-content', e);
  }
  for (const e of scope.querySelectorAll('button,h1,h2,h3,label,.list__body strong,.calendar__event,.badge')) {
    if (!visible(e) || e.closest('.sr-only,.truncate')) continue;
    const c = getComputedStyle(e);
    if (e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 3 && !['auto', 'scroll'].includes(c.overflowX)) add('clipped-or-overflowing-control', e, { excess: e.scrollWidth - e.clientWidth });
  }
  const text = [];
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const e = node.parentElement;
    if (!node.textContent.trim() || !e || !visible(e) || e.closest('.sr-only,.truncate,canvas,svg,option,script,style')) continue;
    const range = document.createRange(); range.selectNodeContents(node);
    for (const r of range.getClientRects()) {
      if (r.width < 3 || r.height < 3) continue;
      let clipped = false;
      for (let parent = e; parent && parent !== scope.parentElement; parent = parent.parentElement) {
        const c = getComputedStyle(parent); const p = parent.getBoundingClientRect();
        if (['auto','scroll','hidden','clip'].includes(c.overflowX) && (r.right <= p.left || r.left >= p.right)) clipped = true;
        if (['auto','scroll','hidden','clip'].includes(c.overflowY) && (r.bottom <= p.top || r.top >= p.bottom)) clipped = true;
      }
      if (!clipped) text.push({ e, r, text: node.textContent.trim().slice(0, 55) });
    }
  }
  text.sort((a,b) => a.r.top - b.r.top);
  let overlaps = 0;
  for (let i = 0; i < text.length && overlaps < 8; i++) {
    for (let j = i + 1; j < text.length && text[j].r.top < text[i].r.bottom - 2; j++) {
      const a = text[i], b = text[j];
      if (a.e === b.e) continue;
      const x = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const y = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (x > 3 && y > 3 && x * y > Math.min(a.r.width*a.r.height,b.r.width*b.r.height) * .25) {
        add('text-overlap', a.e, { other: name(b.e), otherText: b.text }); overlaps++; break;
      }
    }
  }
  const calendar = [...scope.querySelectorAll('.tutorial-calendar')].map(e => ({ box: rect(e), day: rect(e.querySelector('.calendar__day')), scroll: e.querySelector('.calendar__scroll').scrollWidth > e.querySelector('.calendar__scroll').clientWidth }));
  return { issues, title: document.querySelector('h1')?.textContent, calendar, documentHeight: document.documentElement.scrollHeight, tables: scope.querySelectorAll('table').length, inputs: scope.querySelectorAll('input,select,textarea').length, tabs: scope.querySelectorAll('[role="tab"]').length, dialog: active?.querySelector('h2,h3')?.textContent ?? null };
}

async function measure(page, state, screenshot = false) {
  await settle(page);
  const data = await page.evaluate(inspectLayout);
  const record = { ...current, state, ...data };
  records.push(record);
  if (data.issues.length) failures.push(record);
  if (screenshot || data.issues.length) {
    const file = `${slug(current.route)}-${current.width}-${slug(state)}.png`;
    const dialog = page.locator('dialog[open], .modal:not([hidden]) .modal__card');
    if (await dialog.count()) await dialog.screenshot({ path: resolve(out, file) });
    else { if (!await page.locator('[popover]:popover-open').count()) await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: resolve(out, file), fullPage: state==='pagina' && [375,1366].includes(current.width) }); }
    record.screenshot = file;
  }
  return record;
}

const accepted = /(?:ver|detalle|revisar|abrir|llenar|continuar|redactar|nuevo|nueva|programar|añadir|agregar|asignar|cambiar|registrar|solicitar|vista previa|asistencia|consultar|servicio|historial)/i;
const excluded = /(?:guardar|enviar|confirmar|eliminar|notificar|cerrar|cancelar|reprogramar|descargar|exportar|siguiente|anterior|hoy|limpiar|reintentar|sesión \(demostración\))/i;
async function candidateButtons(scope) {
  return scope.locator('button').evaluateAll(buttons => {
    const counts={}; const result=[];
    for(const button of buttons) {
      if(!button.getClientRects().length)continue;
      const label=button.getAttribute('aria-label')||button.textContent.trim().replace(/\s+/g,' ');
      const nth=counts[label]??0; counts[label]=nth+1;
      if(!button.disabled&&!button.matches('.calendar__day,[role="tab"],[aria-pressed],[popoverTarget]')&&!button.closest('.calendar__nav,.tabs'))result.push({label,nth});
    }
    return result;
  });
}
function buttonFor(scope, descriptor) {
  return scope.getByRole('button', { name: descriptor.label, exact: true }).nth(descriptor.nth??0);
}
async function inspectDialog(page, label, depth = 0) {
  const dialog = page.locator('dialog[open]').last();
  if (!await dialog.count()) return false;
  await measure(page, `modal-${label}-${depth}`, [375,1366].includes(current.width));
  const tabs = await dialog.getByRole('tab').allTextContents();
  for (let index=0;index<tabs.length;index++) {
    const tab = dialog.getByRole('tab').nth(index);
    if (await tab.isVisible()) { await tab.click(); await measure(page, `modal-${label}-tab-${tabs[index]}`); }
  }
  const details=dialog.locator('details > summary');
  for(let i=0;i<await details.count();i++) {await details.nth(i).click();await measure(page,`modal-${label}-detalle-${i}`);await details.nth(i).click();}
  const selects=dialog.locator('select');
  for(let i=0;i<await selects.count();i++) {
    const select=selects.nth(i);if(!await select.isVisible()||!await select.isEnabled())continue;
    const field=await select.evaluate(e=>[...e.labels??[]].map(l=>l.textContent).join(' '));
    if(!/tipo|plantilla|modalidad|servicio|canal|escuela/i.test(field))continue;
    const initial=await select.inputValue(), options=await select.locator('option:not([disabled])').evaluateAll(nodes=>nodes.map(o=>({value:o.value,label:o.textContent.trim()})));
    for(const option of options.filter(o=>o.value!==initial).slice(0,12)) {await select.selectOption(option.value);await measure(page,`modal-${label}-selector-${i}-${option.label}`);}
    await select.selectOption(initial);
  }
  if (!depth) {
    const nested = (await candidateButtons(dialog)).filter(v => accepted.test(v.label) && !excluded.test(v.label));
    for (const child of nested.slice(0, 8)) {
      const button = buttonFor(dialog, child);
      if (!await button.count() || !await button.isVisible()) continue;
      const title = await dialog.locator('h2').first().textContent();
      await button.click({ timeout: 3500 });
      if (await page.locator('dialog[open]').count()) {
        const changed = await page.locator('dialog[open] h2').first().textContent();
        if (changed !== title) { await inspectDialog(page, child.label, 1); break; }
        await measure(page, `modal-${label}-accion-${child.label}`);
      } else break;
    }
  }
  if (await page.locator('dialog[open]').count()) { await page.keyboard.press('Escape'); await settle(page); }
  return true;
}

async function exerciseMenus(page, sampled, phase='') {
  const menus=page.locator('.workspace').getByRole('button',{name:/^Acciones del registro/});
  for(let i=0;i<await menus.count();i++) {
    const trigger=menus.nth(i), row=trigger.locator('xpath=ancestor::tr');
    const status=await row.locator('.badge').allTextContents();
    const format=(await row.textContent()).match(/(?:Formato\s+|\bF)(\d{2})/i)?.[1]??'';
    const key=`${format}|${status.join('|')||'sin-estado'}`;
    if(sampled.has(key))continue;sampled.add(key);
    await trigger.click();const popup=page.locator('[popover]:popover-open');
    const menuActions=await candidateButtons(popup);await measure(page,`menu-${phase}-${key}`);
    for(const descriptor of menuActions.filter(v=>accepted.test(v.label)&&!excluded.test(v.label))) {
      if(!await popup.count())await trigger.click();
      const button=buttonFor(popup,descriptor);if(!await button.count())continue;
      await button.click({timeout:3500});const modal=await inspectDialog(page,`${phase}-${descriptor.label}`);
      actions.push({...current,label:`fila:${key}:${descriptor.label}`,modal});
    }
    if(await popup.count())await page.keyboard.press('Escape');
  }
}

async function exercise(page) {
  const main = page.locator('.workspace');
  const sampled=new Set();
  const tabs = await main.getByRole('tab').allTextContents();
  for (let i=0;i<tabs.length;i++) {
    const tab = main.getByRole('tab').nth(i);
    if (!await tab.isVisible()) continue;
    await tab.click();
    await measure(page, `tab-${tabs[i]}`, [375,1366].includes(current.width));
    if(current.route.includes('/instrumentos')||current.route.includes('/revisiones'))await exerciseMenus(page,sampled,`tab-${i}`);
  }
  if (tabs.length) await main.getByRole('tab').first().click();
  const groups = main.locator('.segmented[role="group"]');
  for (let g=0;g<await groups.count();g++) {
    const group = groups.nth(g); const labels = await group.locator('button').allTextContents();
    for (let i=0;i<labels.length;i++) { await group.locator('button').nth(i).click(); await measure(page, `vista-${labels[i]}`); }
    if (labels.length) await group.locator('button').first().click();
  }
  if (await main.locator('.tutorial-calendar').count()) {
    const calendar = main.locator('.tutorial-calendar').first();
    await calendar.getByRole('button',{name:'Mes siguiente',exact:true}).click();
    await measure(page,'calendario-mes-siguiente');
    await calendar.getByRole('button',{name:'Hoy',exact:true}).click();
    const eventDays = calendar.locator('.calendar__day').filter({ has: page.locator('.calendar__event') });
    if (await eventDays.count()) { await eventDays.first().click(); await measure(page,'calendario-dia-con-eventos'); }
    const scroller = calendar.locator('.calendar__scroll');
    await scroller.evaluate(e => { e.scrollLeft = e.scrollWidth; });
    await measure(page,'calendario-ultima-columna');
    await scroller.evaluate(e => { e.scrollLeft = 0; });
    if ([375,1366].includes(current.width)) await calendar.screenshot({ path: resolve(out, `${slug(current.route)}-${current.width}-calendario.png`) });
  }
  const buttons = (await candidateButtons(main)).filter(v => accepted.test(v.label) && !excluded.test(v.label));
  const seen = new Set();
  for (const descriptor of buttons) {
    const key=`${descriptor.label}-${descriptor.nth}`;
    if (seen.has(key)) continue; seen.add(key);
    const button = buttonFor(main, descriptor);
    if (!await button.count() || !await button.isVisible()) continue;
    const before = page.url();
    await button.click({ timeout: 3500 });
    if (page.url() !== before) { await page.goto(before); await page.locator('.workspace h1').waitFor(); }
    const modal = await inspectDialog(page, descriptor.label);
    actions.push({ ...current, label: descriptor.label, modal });
  }
  await exerciseMenus(page,sampled);
  const search = main.locator('input[type="search"]').first();
  if (await search.count() && await search.isVisible()) {
    await search.fill('SIN_COINCIDENCIAS_AUDITORIA'); await measure(page,'sin-resultados'); await search.fill('');
  }
  const details = main.locator('details > summary');
  for (let i=0;i<await details.count();i++) { await details.nth(i).click(); await measure(page,`detalle-expandido-${i}`); await details.nth(i).click(); }
  const selects = main.locator('select');
  for(let i=0;i<await selects.count();i++) {
    const select=selects.nth(i); if(!await select.isVisible()||!await select.isEnabled())continue;
    const initial=await select.inputValue();
    const options=await select.locator('option:not([disabled])').evaluateAll(nodes=>nodes.map(o=>({value:o.value,label:o.textContent.trim()})));
    for(const option of options) {
      if(option.value===initial)continue;
      await select.selectOption(option.value); await measure(page,`selector-${i}-${option.label}`);
      if(select && await select.getAttribute('aria-label')==='Filtrar por formato')await exerciseMenus(page,sampled,`formato-${option.value}`);
    }
    await select.selectOption(initial);
  }
  const tables=main.locator('.table-wrap');
  for(let i=0;i<await tables.count();i++) {
    const table=tables.nth(i);
    if(!await table.isVisible())continue;
    await table.evaluate(e=>{e.scrollLeft=e.scrollWidth;}); await measure(page,`tabla-${i}-ultima-columna`);
    await table.evaluate(e=>{e.scrollLeft=0;});
    const sort=table.locator('.th-sort').first();
    if(await sort.count()) {await sort.click();await measure(page,`tabla-${i}-orden-asc`);await sort.click();await measure(page,`tabla-${i}-orden-desc`);}
  }
  const pagination=main.getByRole('navigation',{name:/^Paginación/});
  for(let i=0;i<await pagination.count();i++) {
    const nav=pagination.nth(i), next=nav.getByRole('button',{name:'Página siguiente',exact:true});
    for(let n=0;n<25&&await next.isEnabled();n++) {await next.click();await measure(page,`paginacion-${i}-${n+2}`);}
  }
  if(current.route.endsWith('/preferencias')) {
    const switches=main.getByRole('checkbox');
    for(let i=0;i<await switches.count();i++) {await switches.nth(i).check();await measure(page,`preferencia-${i}-activa`);}
    await main.getByRole('button',{name:'Restablecer vista',exact:true}).click(); await measure(page,'preferencias-restablecidas');
  }
}

try {
  if (arg('area','all') !== 'roles') {
    const context = await browser.newContext(); const page = await context.newPage();
    page.on('pageerror', error => runtime.push({...current,error:error.message}));
    page.on('response', response => { if(response.status()>=400)network.push({...current,url:response.url(),status:response.status()}); });
    for (const width of widths) {
      await page.setViewportSize({width,height:width<768?844:950});
      for (const route of ['/login','/recuperar-clave','/no-autorizado','/ruta-inexistente']) {
        current={role:'publico',route,width};
        await page.goto(`http://127.0.0.1:5173${route}`); await page.locator('h1').waitFor();
        await measure(page,'pagina',true);
        if(route==='/login') {
          for(const account of accounts) { await page.getByRole('tab',{name:account.label,exact:true}).click(); await measure(page,`acceso-${account.role}`); }
          await page.locator('button[type=submit]').click(); await measure(page,'acceso-validacion');
        }
        if(route==='/recuperar-clave') {
          await page.locator('#recovery-submit').click(); await measure(page,'recuperacion-validacion');
          await page.locator('#recovery-email').fill('auditoria.demo@unas.edu.pe');
          await page.locator('#recovery-submit').click(); await page.locator('#recovery-success').waitFor();
          await measure(page,'recuperacion-confirmacion',true);
        }
        if(route==='/login'||route==='/recuperar-clave') {
          for(const label of ['Soporte','Privacidad']) {
            await page.getByRole('button',{name:label,exact:true}).click();
            await page.locator('.modal.is-active').waitFor(); await measure(page,`modal-${label}`,true);
            await page.keyboard.press('Escape');
          }
        }
      }
      current={role:'publico',route:'/',width}; await page.goto('http://127.0.0.1:5173/'); await page.waitForURL('**/login'); await measure(page,'redireccion-sin-sesion');
      console.log(`publico ${width}px: ${records.length} states, ${failures.length} findings`);
    }
    await context.close();
  }
  if (arg('area','all') !== 'public') for (const account of accounts.filter(account => !arg('roles','') || arg('roles','').split(',').includes(account.role))) {
    const context = await browser.newContext({ viewport:{width:1366,height:950} });
    const page = await context.newPage(); page.setDefaultTimeout(6500);
    const fixture=arg('student-fixture','');
    if(account.role==='estudiante'&&fixture) {
      if(!/^EST-\d+$/.test(fixture))throw new Error('Invalid layout fixture');
      await page.route('**/src/hooks/usePortal.ts*',async route=>{
        const response=await route.fetch(),source=await response.text();
        if(!/const userId = [^;]+;/.test(source))throw new Error('Fixture override no longer matches usePortal');
        await route.fulfill({response,body:source.replace(/const userId = [^;]+;/,`const userId = ${JSON.stringify(fixture)};`)});
      });
    }
    page.on('pageerror', error => runtime.push({ ...current, error:error.message }));
    page.on('console', message => { if (message.type()==='error') runtime.push({...current, error:message.text().slice(0,500)}); });
    page.on('requestfailed', request => { if (!request.failure()?.errorText?.includes('ERR_ABORTED')) network.push({...current,url:request.url(),error:request.failure()?.errorText}); });
    page.on('response', response => { if (response.status()>=400) network.push({...current,url:response.url(),status:response.status()}); });
    await page.goto('http://127.0.0.1:5173/login');
    await page.getByRole('tab',{name:account.label,exact:true}).click();
    await page.locator('#identifier').fill(account.id); await page.locator('#password').fill('tutoria2026');
    await page.locator('.d01__form button[type="submit"]').click(); await page.waitForURL(`**/${account.role}/dashboard`);
    let routes = basePaths.filter(path => path.startsWith(`/${account.role}/`)).map(path=>path.replace(':estudianteId','EST-2023010456'));
    if(account.role==='tutor'&&arg('records','')==='all') {
      await page.goto('http://127.0.0.1:5173/tutor/tutorados');await page.locator('.workspace h1').waitFor();
      const records=await page.locator('.workspace a[href^="/tutor/tutorados/"]').evaluateAll(links=>links.map(a=>a.getAttribute('href')));
      routes=[...new Set([...routes,...records])];
    }
    if(account.role!=='coordinacion') routes.push(`/${account.role}/sesiones?vista=historial`,`/${account.role}/instrumentos?estado=pendiente`,`/${account.role}/instrumentos?estado=observado`,`/${account.role}/derivaciones?estado=seguimiento`);
    const only = arg('routes',''); if(only) routes=routes.filter(route=>only.split(',').some(part=>route.includes(part)));
    for (const width of widths) {
      await page.setViewportSize({width,height: width<768?844:950});
      for (const route of routes) {
        current={role:account.role,route,width,...(fixture?{fixture}: {})};
        try {
          await page.goto(`http://127.0.0.1:5173${route}`); await page.locator('.workspace h1').waitFor();
          await measure(page,'pagina',true); if (arg('interactions','all') !== 'none') await exercise(page);
        } catch(error) { failures.push({...current,state:'interaction-failure',error:error.message.slice(0,700)}); await page.screenshot({path:resolve(out,`${slug(route)}-${width}-interaction-failure.png`)}).catch(()=>{}); }
      }
      console.log(`${account.role} ${width}px: ${records.length} states, ${failures.length} findings, ${runtime.length} runtime errors`);
      await writeFile(resolve(out,'checkpoint.json'),JSON.stringify({records,failures,runtime,network,actions},null,2));
    }
    await context.close();
  }
} finally {
  await browser.close();
  const report={widths,records,failures,runtime,network,actions,summary:{states:records.length,findings:failures.length,runtime:runtime.length,network:network.length,routes:[...new Set(records.map(r=>r.route))].sort(),modals:records.filter(r=>r.dialog).length}};
  await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report.summary));
  if(failures.length||runtime.length||network.length)process.exitCode=1;
}
