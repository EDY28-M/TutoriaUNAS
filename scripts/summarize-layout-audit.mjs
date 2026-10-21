import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'artifacts/layout-audit');
const widths = [1920, 1440, 1366, 1024, 768, 390, 375];
const sources = ['verified-estudiante', 'verified-tutor', 'verified-coordinacion', 'verified-tutor-instrumentos', 'verified-tutee-records', 'final-public-v2'];
const selected = new Map();
const histories = [];
const caseKey = record => `${record.role}|${record.route}|${record.width}`;
for (const source of sources) {
  const report = JSON.parse(await readFile(resolve(out, source, 'report.json'), 'utf8'));
  histories.push({ source, summary: report.summary });
  for (const key of new Set(report.records.map(caseKey))) {
    const records = report.records.filter(record => caseKey(record) === key).map(record => ({ ...record, source, ...(record.screenshot ? { screenshot: `${source}/${record.screenshot}` } : {}) }));
    selected.set(key, {
      role: records[0].role, route: records[0].route, width: records[0].width, source, records,
      failures: report.failures.filter(record => caseKey(record) === key),
      runtime: report.runtime.filter(record => caseKey(record) === key),
      network: report.network.filter(record => caseKey(record) === key),
    });
  }
}
const cases = [...selected.values()].sort((a,b)=>a.route.localeCompare(b.route)||widths.indexOf(a.width)-widths.indexOf(b.width));
const routes = [...new Set(cases.map(item=>item.route))].sort();
for (const route of routes) for (const width of widths) {
  if(!cases.some(item=>item.route===route&&item.width===width))throw new Error(`Missing verification: ${route} at ${width}px`);
}
const sourceRoutes = await readFile(resolve(root, 'frontend/src/routes/AppRoutes.tsx'), 'utf8');
const declared = [...sourceRoutes.matchAll(/<Route path="([^"]+)"/g)].map(match=>match[1]).filter(path=>/^\/(?:estudiante|tutor|coordinacion)\//.test(path));
for(const declaredRoute of declared) {
  const pattern = new RegExp(`^${declaredRoute.replace(':estudianteId','[^/]+')}$`);
  if(!routes.some(route=>pattern.test(route)))throw new Error(`Unverified declared route: ${declaredRoute}`);
}
const fixture = JSON.parse(await readFile(resolve(out,'verified-student-referrals-fixture/report.json'),'utf8'));
const e2e = JSON.parse(await readFile(resolve(out,'e2e.json'),'utf8'));
const ui = JSON.parse(await readFile(resolve(root,'artifacts/falcon/verification.json'),'utf8'));
const production = JSON.parse(await readFile(resolve(out,'production-smoke.json'),'utf8'));
const gate = JSON.parse(await readFile(resolve(root,'docs/QA/last-gate.json'),'utf8'));
const records = cases.flatMap(item=>item.records);
const failures = cases.flatMap(item=>item.failures);
const runtime = cases.flatMap(item=>item.runtime);
const network = cases.flatMap(item=>item.network);
const summary = {
  date: '2026-10-15', widths, declaredProtectedRoutes: declared.length,
  concreteRoutesAndQueryVariants: routes.length, routeWidthCases: cases.length,
  states: records.length, modalStates: records.filter(record=>record.dialog).length,
  findings: failures.length, runtime: runtime.length, network: network.length,
  extraFixtureStates: fixture.records.length, extraFixtureModals: fixture.summary.modals,
  e2ePassed: e2e.stats.expected, e2eFailed: e2e.stats.unexpected,
  uiChecksPassed: ui.passed, uiChecksFailed: ui.failed,
};
const report = {
  summary, histories,
  selection: 'Later sources replace the complete route/width case. The instruments pass supersedes the initial walker attempt to edit disabled read-only fields. The nine-student record pass expands the route parameter. Fixture records never replace the real demo account.',
  cases: cases.map(({records,...item})=>({...item,states:records.length,modals:records.filter(record=>record.dialog).length})),
  records, failures, runtime, network,
  extraFixture: { id:'EST-2023010521', method:'Browser-only usePortal module override; no source or production data mutation.', summary:fixture.summary, records:fixture.records },
  production, gate,
};
await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));
const link = path => `${root.replaceAll('\\','/')}/${path}`;
const changed = [
  'frontend/src/components/ui/Calendar.tsx','frontend/src/components/ui/DataTable.tsx','frontend/src/components/ui/RowActions.tsx','frontend/src/components/ui/Card.tsx','frontend/src/components/ui/PageHeading.tsx','frontend/src/components/ui/ContextHelp.tsx','frontend/src/components/ui/Alert.tsx','frontend/src/components/ui/icons.tsx',
  'frontend/src/components/layout/AuthLayout.tsx','frontend/src/components/layout/AppLayout.tsx','frontend/src/components/navigation/Sidebar.tsx','frontend/src/data/navegacion.ts',
  'frontend/src/styles/ui.css','frontend/src/styles/app.css','frontend/src/styles/auth.css','frontend/src/styles/falcon-layout.css',
  'frontend/src/assets/vendor/fontawesome-icons.ts','frontend/src/assets/vendor/LICENSE-FONT-AWESOME.txt',
  ...['comun/PreferencesPage','comun/ProfilePage','coordinacion/CoordAssignments','coordinacion/CoordAudit','coordinacion/CoordDashboard','coordinacion/CoordFields','coordinacion/CoordFormats','coordinacion/CoordIntegrations','coordinacion/CoordNotices','coordinacion/CoordPermissions','coordinacion/CoordPlan','coordinacion/CoordReports','coordinacion/CoordReviews','coordinacion/CoordSchedules','coordinacion/CoordSemesters','coordinacion/CoordTutees','coordinacion/CoordTutors','estudiante/StudentDashboard','estudiante/StudentTutor','tutor/TuteeRecord','tutor/TutorDashboard','tutor/TutorInstruments','tutor/TutorNotices','tutor/TutorReports','tutor/TutorSessions'].map(path=>`frontend/src/pages/${path}.tsx`),
  'frontend/e2e/layout-regression.spec.ts','scripts/audit-layout.mjs','scripts/vendor-falcon-icons.mjs','scripts/verify-falcon.mjs','scripts/summarize-layout-audit.mjs','docs/MIGRACION.md','docs/VALIDACION.md',
];
const rows=routes.map(route=>{
  const routeCases=cases.filter(item=>item.route===route);
  return `| \`${route}\` | ${routeCases.length}/7 | ${routeCases.reduce((sum,item)=>sum+item.records.length,0)} |`;
}).join('\n');
const body=`# Auditoría de layout y lectura · 15 de octubre de 2026

Verificadas **${routes.length} rutas concretas y variantes**, **${cases.length} combinaciones ruta/ancho**, **${records.length} estados de interfaz** y **${summary.modalStates} estados de modal**. Resultado final: **${summary.findings} hallazgos, ${summary.runtime} errores de ejecución y ${summary.network} errores de red** en las comprobaciones descritas.

Resoluciones: ${widths.join(', ')} px. Navegador: Chromium. Cuenta ficticia habitual por rol; nueve expedientes de tutorados autorizados. Las rutas de formulario, pestañas, vistas, filtros, paginación, ordenación, menús de fila, ayuda desplegada y calendarios se recorrieron mediante interacciones reales. Las capturas base a 1366/375 incluyen contenido vertical; el scroll horizontal pertenece a tablas/calendarios, sin extender la página.

## Causas raíz y correcciones

| Causa comprobada | Corrección estructural |
| --- | --- |
| El selector Falcon \`.calendar\` era una insignia de fecha de 50 px. El calendario mensual heredaba ese ancho y alcanzaba unos 6295 px de alto. | Componente aislado como \`.tutorial-calendar\`, grid con \`minmax(0,1fr)\`, consulta de contenedor, columnas de día legibles y scroll interior. |
| Tablas sin mínimos legibles y etiquetas \`nowrap\` comprimían columnas a 39–53 px. | Mínimos por tipo de columna, acciones compactas, etiquetas adaptables y contenedores de tabla con scroll. Se añadieron los que faltaban en reportes y asistencia. |
| Filas flexibles con complementos que no cedían espacio dejaban 27–74 px para textos. | Las filas se reorganizan y reservan una base legible al contenido; hijos flex/grid con \`min-width:0\`. |
| Cuatro métricas con auto-fit producían tres tarjetas y una aislada. | Distribución equilibrada de 4, 2 o 1 columnas según el espacio. |
| Altura del cuerpo del modal calculada restando una cantidad fija. | Modal flex vertical: cabecera/pie conservan su altura real y el cuerpo desplaza su contenido. |
| Campos con mínimos rígidos y login en dos columnas a 768 px. | Mínimos limitados al contenedor, selector de campos adaptable y login apilado desde 991 px, conservando la foto. |
| Marca, botón y enlaces del menú reducido tenían anchos y alineaciones diferentes. | Columna de 64 px, eje común medido, controles de 44 px, espacio reservado para scroll y etiquetas al pasar el cursor o enfocar. |

## Simplificación solicitada

Se retiró la frase «Un espacio para crecer, aprender y construir juntos tu camino universitario». Se eliminaron 75 iconos decorativos de cabeceras en los tres roles. El botón del menú está a la derecha de la marca al expandir y centrado al reducir. Los iconos principales usan 92 SVG oficiales locales de Font Awesome Free 6.5.1, con licencia y procedencia incluidas; no se generaron imágenes con IA.

Se quitaron contextos repetidos, se abreviaron avisos repetitivos y se trasladaron explicaciones largas a «Ver detalles». Los avisos informativos se despliegan a petición; advertencias y errores permanecen visibles. Se aumentaron texto de tablas/listas/notas, contraste de cifras, espacio y áreas de interacción. Las gráficas existentes y sus alternativas tabulares se conservan.

## Validación funcional y límites

- ${summary.e2ePassed} pruebas Playwright aprobadas y ${summary.e2eFailed} fallidas: calendarios, detalle de eventos, formularios altos, acciones de tabla, menú reducido, tooltips, drawer, gráficas al redimensionar y recuperación de módulos lazy.
- ${ui.passed} comprobaciones adicionales aprobadas, ${ui.failed} fallidas. Axe sin infracciones detectadas en login, recuperación y los tres dashboards; no se afirma certificación de accesibilidad de toda la aplicación.
- Gate obligatorio: 7/7, incluidos TypeScript, ESLint, formato, 64 pruebas unitarias y build.
- Build servido en localhost:8080: tres roles, cuatro gráficas por dashboard, cero iconos decorativos en títulos, dispersión horizontal de centros del menú reducido igual a 0 px y cero errores de ejecución/red.
- La cuenta normal de estudiante tiene cero derivaciones: su estado vacío se verificó. Se recorrieron además ${fixture.records.length} estados y ${fixture.summary.modals} modales de seguimiento con un alumno ficticio con derivación/prioridad alta mediante una sustitución del módulo sólo en el navegador de pruebas. Este escenario se identifica aparte y no sustituye los resultados de la cuenta normal.
- El calendario propio usa CSS y no necesita llamar a una biblioteca para recalcular medidas. Las gráficas usan ResizeObserver; se probó cambio de ancho y de menú.
- Las peticiones reales inspeccionadas cargan módulos y recursos locales. Los datos siguen siendo fixtures síncronos; no se atribuyen estados vacíos a errores HTTP ni se declara verificada una API de producción, correo real o persistencia institucional.
- Los intentos iniciales del recorrido sobre selects deshabilitados se repitieron omitiendo esas interacciones inválidas. El informe consolidado utiliza los casos completos repetidos; conserva la procedencia de cada resultado.

## Rutas efectivamente verificadas

Cada fila siguiente se comprobó en las siete resoluciones. El total incluye 39 patrones protegidos, sus nueve expedientes concretos, ocho variantes con parámetros de búsqueda y las cinco rutas públicas/de redirección o error.

| Ruta | Anchos verificados | Estados |
| --- | ---: | ---: |
${rows}

## Archivos modificados

${changed.map(path=>`- [${path}](${link(path)})`).join('\n')}

El build \`frontend/dist\` se regeneró. No se modificaron la API, los paquetes npm ni el CSS Falcon original.

## Evidencias

- [Informe consolidado JSON](${link('artifacts/layout-audit/report.json')})
- [Pruebas Playwright](${link('artifacts/layout-audit/e2e.json')})
- [Verificación adicional y Axe](${link('artifacts/falcon/verification.json')})
- [Build local](${link('artifacts/layout-audit/production-smoke.json')})
- [Gate](${link('docs/QA/last-gate.json')})
- [Menú reducido y lectura](${link('artifacts/layout-audit/visual/sidebar-mini-final.png')})
- [Login](${link('artifacts/falcon/login-1366.png')})
- Cada registro JSON con \`screenshot\` enlaza a su captura bajo \`artifacts/layout-audit\`.
`;
await writeFile(resolve(out,'README.md'),body);
console.log(JSON.stringify(summary));
if(failures.length||runtime.length||network.length||fixture.failures.length||e2e.stats.unexpected||ui.failed||production.errors.length)process.exitCode=1;
