import type { Instrumento } from '../types/domain';
import { definicionPorCodigo } from '../data/formatos';

/**
 * Expediente compartido de la demostración.
 *
 * Los formatos 01–12 repiten la misma información (identidad del estudiante,
 * colegio de procedencia, hábitos de estudio, situación socioemocional, etc.).
 * Este módulo guarda una sola vez los datos estables que la persona ya respondió
 * y los devuelve como precarga para los demás formularios: el usuario solo
 * completa lo que falta o lo que cambió.
 *
 * Se apoya en `localStorage` para sobrevivir a la recarga y al cierre de la
 * pestaña. Solo se usa con datos ficticios. La integración institucional requiere
 * persistencia y autorización en el servidor, además de sustituir este adaptador.
 */

// v1 no conservaba semestre ni significado de la pregunta: no se reutiliza.
const CLAVE = 'tutoria-unas:expediente:v2';
const VERSION = 2;

/** Ámbito del expediente: cada estudiante, cada tutor y cada escuela tienen el suyo. */
export type AlcanceExpediente = `estudiante:${string}` | `tutor:${string}` | `escuela:${string}`;

/**
 * Campos reutilizables. La trayectoria escolar se conserva entre semestres;
 * el contexto actual se reutiliza dentro del mismo semestre y se revisa al enviar.
 *
 * Quedan fuera, a propósito, los datos propios de un registro: fechas y horas de
 * una atención, participantes de una sesión, respuestas de una evaluación del
 * semestre (10 y 11), observaciones de un informe y el detalle de un caso de
 * derivación. Esos se piden de nuevo porque describen un hecho concreto.
 */
export const CAMPOS_REUTILIZABLES: readonly string[] = [
  // Identificación y contexto familiar
  'correo',
  'telefono',
  'apoderado',
  'turno',
  // Trayectoria académica y expectativas
  'colegio',
  'promedioSecundaria',
  'materiasSecundaria',
  'conoceTutoria',
  'expectativas',
  'motivoExpectativas',
  'eleccionCarrera',
  'expectativaCarrera',
  'expectativaUniversidad',
  'aprendizajes',
  'caracteristicasTutor',
  // Organización del tiempo y estrategias de estudio
  'otrasActividades',
  'administracionTiempo',
  'transporte',
  'tiempoTransporte',
  'horasEstudio',
  'tiempoSuficiente',
  'formaEstudio',
  'estudioEfectivo',
  'lugarEstudio',
  'espacioEstudio',
  'cursosDificiles',
  'accionesCursos',
  'dificultades',
  'soluciones',
  'materiasFaciles',
  // Situación socioemocional y rasgos personales
  'problemasPersonales',
  'estadoSalud',
  'autodescripcion',
  'preocupaciones',
  'cualidades',
  'habilidades',
  'aficiones',
  'adicciones',
  'valores',
  'antivalores',
  'motivacion',
  // Preparación para el campo laboral (formato 05)
  'laboral1',
  'laboral2',
  'laboral3',
  'laboral4',
  'laboral5',
  'laboral6',
  'laboral7',
  'laboral8',
  'laboral9',
];

const REUTILIZABLES = new Set(CAMPOS_REUTILIZABLES);
const PERMANENTES = new Set(['colegio', 'promedioSecundaria', 'materiasSecundaria']);

interface DatoRecordado {
  valor: string;
  formato: string;
  semestre: string;
}

interface RegistroExpediente {
  respuestas: Record<string, DatoRecordado>;
  actualizado: string;
  formatos: string[];
}

interface EstadoExpediente {
  version: number;
  actualizado: string;
  registros: Record<string, RegistroExpediente>;
}

function hoy(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Lima' }).format(new Date());
}

function estadoVacio(): EstadoExpediente {
  return { version: VERSION, actualizado: hoy(), registros: {} };
}

function leerEstado(): EstadoExpediente {
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (guardado) {
      const datos = JSON.parse(guardado) as Partial<EstadoExpediente>;
      if (
        datos.version === VERSION &&
        datos.registros &&
        typeof datos.registros === 'object' &&
        !Array.isArray(datos.registros) &&
        Object.values(datos.registros).every(
          (r) =>
            r &&
            typeof r === 'object' &&
            r.respuestas &&
            typeof r.respuestas === 'object' &&
            !Array.isArray(r.respuestas) &&
            Array.isArray(r.formatos) &&
            r.formatos.every((f) => typeof f === 'string') &&
            Object.values(r.respuestas).every(
              (d) =>
                d &&
                typeof d === 'object' &&
                typeof d.valor === 'string' &&
                typeof d.formato === 'string' &&
                typeof d.semestre === 'string',
            ),
        )
      )
        return {
          version: VERSION,
          actualizado: typeof datos.actualizado === 'string' ? datos.actualizado : hoy(),
          registros: datos.registros,
        };
    }
  } catch {
    // Sin almacenamiento disponible: se trabaja con un expediente vacío.
  }
  return estadoVacio();
}

/** Un mismo código puede tener distinto significado en dos anexos. */
function significado(codigo: string, formato: string): string {
  if (codigo === 'motivacion') return `${codigo}:${formato}`; // estudio (04) / carrera (05)
  if (codigo === 'expectativas' && formato === 'F03') return `${codigo}:ingreso`;
  return codigo;
}

function claveDato(codigo: string, instrumento: Instrumento): string {
  return `${PERMANENTES.has(codigo) ? 'permanente' : instrumento.semestreId}:${significado(codigo, instrumento.formato)}`;
}

function datosReutilizables(instrumento: Instrumento, respuestas: Record<string, string>) {
  const datos: Record<string, DatoRecordado> = {};
  const campos = definicionPorCodigo(instrumento.formato)?.secciones.flatMap((s) => s.campos) ?? [];
  for (const campo of campos) {
    const codigo = campo.codigo;
    if (!REUTILIZABLES.has(codigo) || !(codigo in respuestas)) continue;
    if (
      campo.visibleSi &&
      !campo.visibleSi.valores.includes(respuestas[campo.visibleSi.campo] ?? '')
    )
      continue;
    const valor = respuestas[codigo];
    if (typeof valor !== 'string') continue;
    const clave = claveDato(codigo, instrumento);
    datos[clave] = { valor, formato: instrumento.formato, semestre: instrumento.semestreId };
    // El complemento de «Otro» forma parte de la misma respuesta; al cambiarla se limpia.
    datos[`${clave}__otro`] = {
      valor:
        valor === 'Otro' || valor.includes('"Otro"') ? (respuestas[`${codigo}__otro`] ?? '') : '',
      formato: instrumento.formato,
      semestre: instrumento.semestreId,
    };
  }
  return datos;
}

function escribirEstado(estado: EstadoExpediente): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(estado));
  } catch {
    // El navegador puede bloquear el almacenamiento; la precarga se pierde al recargar.
  }
}

/** Ámbito que corresponde a un instrumento según el actor que lo responde. */
export function alcanceDe(instrumento: Instrumento): AlcanceExpediente | null {
  const actor = definicionPorCodigo(instrumento.formato)?.actor;
  if (actor === 'tutorado' && instrumento.estudianteId)
    return `estudiante:${instrumento.estudianteId}`;
  if (actor === 'tutor' && instrumento.tutorId) return `tutor:${instrumento.tutorId}`;
  if (actor === 'equipo-tutores') {
    const escuela = instrumento.respuestas.escuela;
    if (escuela) return `escuela:${escuela}`;
  }
  return null;
}

/**
 * Guarda los datos estables de un formulario en el expediente del ámbito.
 * Solo se conservan los campos declarados en `CAMPOS_REUTILIZABLES`.
 */
export function recordarRespuestas(
  instrumento: Instrumento,
  respuestas: Record<string, string>,
): void {
  const alcance = alcanceDe(instrumento);
  if (!alcance) return;
  const nuevos = datosReutilizables(instrumento, respuestas);
  if (!Object.keys(nuevos).length) return;
  const estado = leerEstado();
  const previo = estado.registros[alcance];
  const formatos = new Set([...(previo?.formatos ?? []), instrumento.formato]);
  escribirEstado({
    version: VERSION,
    actualizado: hoy(),
    registros: {
      ...estado.registros,
      [alcance]: {
        respuestas: { ...(previo?.respuestas ?? {}), ...nuevos },
        actualizado: hoy(),
        formatos: [...formatos].sort(),
      },
    },
  });
}

/** Devuelve los datos estables que el ámbito ya registró en otros formularios. */
export function respuestasRecordadas(
  instrumento: Instrumento,
  fuentes: readonly Instrumento[] = [],
): Record<string, string> {
  const alcance = alcanceDe(instrumento);
  if (!alcance) return {};
  // Las respuestas enviadas también son fuente, aunque precedan a la caché.
  // Los borradores ajenos no se consultan ni se comparten entre roles.
  let datos: Record<string, DatoRecordado> = {};
  for (const fuente of [...fuentes]
    .filter(
      (r) =>
        r.id !== instrumento.id &&
        alcanceDe(r) === alcance &&
        ['enviado', 'aprobado'].includes(r.estado),
    )
    .sort((a, b) => a.actualizado.localeCompare(b.actualizado) || a.version - b.version)) {
    datos = { ...datos, ...datosReutilizables(fuente, fuente.respuestas) };
  }
  datos = { ...datos, ...leerEstado().registros[alcance]?.respuestas };
  const respuestas: Record<string, string> = {};
  for (const codigo of CAMPOS_REUTILIZABLES) {
    const clave = claveDato(codigo, instrumento);
    const dato = datos[clave];
    if (!dato || !dato.valor.trim()) continue;
    respuestas[codigo] = dato.valor;
    if (datos[`${clave}__otro`]?.valor)
      respuestas[`${codigo}__otro`] = datos[`${clave}__otro`]!.valor;
  }
  return respuestas;
}

/** Formularios que ya aportaron datos al expediente del ámbito. */
export function formatosDelExpediente(instrumento: Instrumento): string[] {
  const alcance = alcanceDe(instrumento);
  if (!alcance) return [];
  return [...(leerEstado().registros[alcance]?.formatos ?? [])];
}

/** Descarta el expediente guardado; se usa al reiniciar la demostración y en pruebas. */
export function olvidarExpediente(): void {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    // Sin almacenamiento disponible no hay nada que borrar.
  }
}
