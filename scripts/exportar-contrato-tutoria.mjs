import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../frontend/package.json', import.meta.url));
const { createServer } = require('vite');
const root = fileURLToPath(new URL('../frontend/', import.meta.url));
process.env.VITE_DATA_SOURCE = 'demo';
const server = await createServer({ root, configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true } });
try {
  const formatos = await server.ssrLoadModule('/src/data/formatos.ts');
  const personas = await server.ssrLoadModule('/src/data/personas.ts');
  const tutoria = await server.ssrLoadModule('/src/data/tutoria.ts');
  const catalogos = await server.ssrLoadModule('/src/data/catalogos.ts');
  const academico = await server.ssrLoadModule('/src/data/academico.ts');
  const cuentas = await server.ssrLoadModule('/src/mocks/accounts.ts');
  const expediente = await server.ssrLoadModule('/src/services/expediente.ts');
  const salud = await server.ssrLoadModule('/src/data/salud.ts');
  const institucional = await server.ssrLoadModule('/src/data/institucional.ts');
  const derivaciones = await server.ssrLoadModule('/src/data/derivaciones.ts');
  if (!process.argv.includes('--solo-sistema')) {
  await writeFile(new URL('../backend/TutoriaUNAS.Api/Data/formatos.json', import.meta.url), JSON.stringify({
    formatos: formatos.definicionesFormato,
    reutilizables: expediente.CAMPOS_REUTILIZABLES,
    estables: expediente.CAMPOS_ESTABLES,
    cursos: catalogos.cursos,
  }, null, 2));
  }
  await writeFile(new URL('../backend/TutoriaUNAS.Api/Data/semilla-sistema.json', import.meta.url), JSON.stringify({
    aviso: 'Datos ficticios para Development; no acredita acceso ni entrega de información institucional.',
    catalogos: Object.fromEntries([
      ['facultades', catalogos.facultades], ['escuelas', catalogos.escuelas], ['semestres', catalogos.semestres], ['cursos', catalogos.cursos],
      ['serviciosBienestar', catalogos.serviciosBienestar], ['areasDerivacion', catalogos.areasDerivacion], ['formatos', formatos.definicionesFormato],
      ['reglasTutoria', institucional.reglasTutoria],
    ]),
    fuentes: {
      resultadosAcademicos: academico.resultadosAcademicos, resumenesAcademicos: academico.resumenesAcademicos,
      horariosDocentes: academico.horariosDocentes, afiliacionesSis: salud.afiliacionesSis,
      atencionesSalud: salud.atencionesSalud, beneficiosSociales: salud.beneficiosSociales,
      apoyosComunicables: salud.apoyosComunicables, campanasSalud: salud.campanasSalud,
      insumos: institucional.insumos, derivaciones: derivaciones.derivaciones,
    },
    actividadesPlan: tutoria.actividadesPlan,
    avisos: institucional.avisos,
  }, null, 2));
  await writeFile(new URL('../backend/TutoriaUNAS.Api/Data/semilla-desarrollo.json', import.meta.url), JSON.stringify({
    aviso: 'Datos enteramente ficticios. Solo se cargan con permiso explícito en Development.',
    semestreId: catalogos.semestreActual, escuelas: catalogos.escuelas,
    estudiantes: personas.estudiantes, docentes: personas.docentes, cuentas: cuentas.demoAccounts,
    asignaciones: tutoria.asignaciones, matriculas: academico.matriculas, horarios: academico.horariosAcademicos,
  }, null, 2));
  console.log('Contrato de formatos y semilla ficticia exportados.');
} finally { await server.close(); }
