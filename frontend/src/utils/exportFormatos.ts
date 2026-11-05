import type { CodigoFormato, Instrumento, Sesion } from '../types/domain';
import { definicionPorCodigo } from '../data/formatos';
import { docentePorId, estudiantePorId, nombreCompleto } from '../data/personas';
import { escuelas, facultades } from '../data/catalogos';
import { asignacionDe } from '../data/tutoria';
import { filasRespuesta, listaRespuesta } from './validacionInstrumentos';
import type { RespuestasInstrumento } from './validacionInstrumentos';

/**
 * Exportación de los formatos 01–12 con el diseño de la Resolución N.º
 * 500-2022-CU-R-UNAS. Este módulo no dibuja: prepara las respuestas para que
 * `FormatoOficial` las coloque en la misma tabla que el anexo impreso.
 */

export interface DocumentoFormato {
  /** Clave estable del documento en la lista de exportación. */
  id: string;
  formato: CodigoFormato;
  /** Persona o grupo al que corresponde el documento (para listas y nombres de archivo). */
  referencia: string;
  estudianteId: string | null;
  tutorId: string | null;
  semestreId: string;
  estado: Instrumento['estado'] | 'muestra';
  fecha: string;
  respuestas: RespuestasInstrumento;
  /** Las muestras llevan una marca visible de datos ficticios en cada hoja. */
  muestra: boolean;
}

/** Solo se exportan los formatos que el responsable ya envió. */
export const ESTADOS_EXPORTABLES: Instrumento['estado'][] = ['enviado', 'aprobado'];

/**
 * Marca visible de cada hoja. Solo un formato aprobado por coordinación sale
 * limpio: el enviado aún no revisado lleva «Pendiente de revisión» para que
 * nadie lo confunda con un documento final.
 */
export type MarcaHoja = 'muestra' | 'revision' | null;
export function marcaDe(documento: DocumentoFormato): MarcaHoja {
  if (documento.muestra) return 'muestra';
  return documento.estado === 'aprobado' ? null : 'revision';
}

export const TITULOS_OFICIALES: Record<CodigoFormato, { titulo: string; actor: string }> = {
  F01: { titulo: 'Informe de actividades del proceso tutorial', actor: 'Equipo de tutores' },
  F02: { titulo: 'Informe de actividades del tutor', actor: 'Tutor' },
  F03: { titulo: 'Entrevista inicial al estudiante ingresante', actor: 'Tutorado' },
  F04: { titulo: 'Entrevista inicial al estudiante de ciclos intermedios', actor: 'Tutorado' },
  F05: { titulo: 'Entrevista inicial al estudiante de ciclos finales', actor: 'Tutorado' },
  F06: { titulo: 'Registro de asistencia: tutoría individual', actor: 'Tutor' },
  F07: { titulo: 'Registro de asistencia de la tutoría grupal', actor: 'Tutor' },
  F08: { titulo: 'Registro de atención personalizada al estudiante', actor: 'Tutor' },
  F09: { titulo: 'Autoevaluación de la actividad tutorial', actor: 'Tutor' },
  F10: { titulo: 'Evaluación de la tutoría individual', actor: 'Tutorado' },
  F11: { titulo: 'Evaluación del desempeño de tutoría grupal', actor: 'Tutorado' },
  F12: { titulo: 'Ficha de derivación', actor: 'Tutor' },
};

/* ==========================================================================
   Lectura de respuestas
   ========================================================================== */

/** Texto de una respuesta simple; «Otro» se sustituye por lo que escribió la persona. */
export function valorDe(r: RespuestasInstrumento, codigo: string): string {
  const valor = (r[codigo] ?? '').trim();
  if (valor === 'Otro') return (r[`${codigo}__otro`] ?? '').trim() || 'Otro';
  return valor;
}

/** Opciones marcadas de una respuesta múltiple, con «Otro» ya sustituido. */
export function valoresDe(r: RespuestasInstrumento, codigo: string): string[] {
  const otro = (r[`${codigo}__otro`] ?? '').trim();
  return listaRespuesta(r[codigo] ?? '')
    .map((valor) => (valor === 'Otro' ? otro || 'Otro' : valor))
    .filter(Boolean);
}

export function filasDe(r: RespuestasInstrumento, codigo: string): RespuestasInstrumento[] {
  return filasRespuesta(r[codigo] ?? '');
}

/** ¿Está marcada la opción? Sirve para respuestas simples y múltiples. */
export function marcada(r: RespuestasInstrumento, codigo: string, opcion: string): boolean {
  const valor = r[codigo] ?? '';
  return valor === opcion || listaRespuesta(valor).includes(opcion);
}

/** Fecha ISO (AAAA-MM-DD) en el formato del anexo: DD/MM/AAAA. */
export function fechaOficial(valor: string | null | undefined): string {
  const [anio, mes, dia] = (valor ?? '').slice(0, 10).split('-');
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : '';
}

/** Une las opciones elegidas en una frase legible: «a, b y c». */
export function frase(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}

/** Completa una lista hasta `minimo` elementos para conservar las filas del anexo. */
export function rellenar<T>(lista: T[], minimo: number, vacio: T): T[] {
  return lista.length >= minimo
    ? lista
    : [...lista, ...Array.from({ length: minimo - lista.length }, () => vacio)];
}

/* ==========================================================================
   Construcción de documentos
   ========================================================================== */

export function nombreEscuela(valor: string): string {
  return escuelas.find((escuela) => escuela.id === valor)?.nombre ?? valor;
}

function facultadDeEscuela(escuelaId: string): string {
  const escuela = escuelas.find((item) => item.id === escuelaId);
  const facultad = facultades.find((item) => item.id === escuela?.facultadId);
  if (!escuela) return '';
  return facultad
    ? `${facultad.nombre} · Escuela Profesional de ${escuela.nombre}`
    : `Escuela Profesional de ${escuela.nombre}`;
}

/** Copia sin pisar lo que la persona respondió; solo completa vacíos. */
function completar(r: RespuestasInstrumento, faltantes: Record<string, string | null | undefined>) {
  for (const [codigo, valor] of Object.entries(faltantes)) {
    if (!(r[codigo] ?? '').trim() && valor) r[codigo] = valor;
  }
}

const ASISTIO: Sesion['asistentes'][number]['estado'][] = ['asistio', 'tarde'];

/**
 * Las respuestas guardan lo que la persona escribió. Los datos de identidad
 * (nombre, correo, grupo, ciclo, tutor) se toman del padrón cuando el
 * formulario no los repite, igual que se llenarían a mano en el anexo.
 */
export function documentoDesdeInstrumento(
  instrumento: Instrumento,
  sesiones: Sesion[] = [],
): DocumentoFormato {
  const r: RespuestasInstrumento = { ...instrumento.respuestas };
  const estudiante = instrumento.estudianteId ? estudiantePorId(instrumento.estudianteId) : null;
  const tutor = docentePorId(instrumento.tutorId);
  const asignacion = estudiante ? asignacionDe(estudiante.id) : undefined;
  const sesion = sesiones.find((item) => item.id === instrumento.sesionId);
  const escuelaId = estudiante?.escuelaId ?? r.escuela ?? tutor?.escuelaId ?? '';

  completar(r, {
    nombreEstudiante: estudiante ? nombreCompleto(estudiante) : null,
    correo: estudiante?.correo,
    telefono: estudiante?.telefono,
    grupo: asignacion?.grupo,
    ciclo: estudiante?.ciclo ? String(estudiante.ciclo) : null,
    codigo: estudiante?.codigo,
    escuela: escuelaId,
    nombreTutor: tutor ? nombreCompleto(tutor) : null,
    telefonoTutor: tutor?.telefono,
    fecha: sesion?.fecha ?? instrumento.enviado ?? instrumento.actualizado,
    horaInicio: sesion?.horaInicio,
    horaFin: sesion?.horaFin,
  });
  if (instrumento.formato === 'F01') completar(r, { facultad: facultadDeEscuela(escuelaId) });
  if (instrumento.formato === 'F07') completar(r, { tema: sesion?.tema });

  // Sin filas capturadas, la asistencia confirmada de la sesión llena el registro.
  if ((instrumento.formato === 'F06' || instrumento.formato === 'F07') && sesion) {
    if (!filasDe(r, 'asistentes').length) {
      const filas = sesion.asistentes
        .filter((asistente) => ASISTIO.includes(asistente.estado))
        .map((asistente) => {
          const persona = estudiantePorId(asistente.estudianteId);
          return {
            nombre: persona ? nombreCompleto(persona) : asistente.estudianteId,
            grupo: asignacionDe(asistente.estudianteId)?.grupo ?? '',
            ciclo: persona?.ciclo ? String(persona.ciclo) : '',
            tipo: r.tipoTutoria ?? 'Académica',
            fecha: sesion.fecha,
          };
        });
      if (filas.length) r.asistentes = JSON.stringify(filas);
    }
  }

  const referencia = estudiante
    ? nombreCompleto(estudiante)
    : sesion
      ? `${sesion.tema || 'Sesión'} · ${fechaOficial(sesion.fecha)}`
      : instrumento.formato === 'F01'
        ? nombreEscuela(escuelaId)
        : tutor
          ? nombreCompleto(tutor)
          : instrumento.id;

  return {
    id: instrumento.id,
    formato: instrumento.formato,
    referencia,
    estudianteId: instrumento.estudianteId,
    tutorId: instrumento.tutorId,
    semestreId: instrumento.semestreId,
    estado: instrumento.estado,
    fecha: r.fecha ?? instrumento.actualizado,
    respuestas: r,
    muestra: false,
  };
}

export function documentosExportables(
  instrumentos: Instrumento[],
  sesiones: Sesion[] = [],
): DocumentoFormato[] {
  return instrumentos
    .filter((instrumento) => ESTADOS_EXPORTABLES.includes(instrumento.estado))
    .filter((instrumento) => definicionPorCodigo(instrumento.formato))
    .map((instrumento) => documentoDesdeInstrumento(instrumento, sesiones))
    .sort((a, b) => a.formato.localeCompare(b.formato) || a.referencia.localeCompare(b.referencia));
}

/**
 * Expediente de un estudiante: lo que respondió y lo que su tutor registró
 * sobre él, incluidas las sesiones grupales a las que asistió.
 */
export function expedienteDeEstudiante(
  documentos: DocumentoFormato[],
  estudianteId: string,
  sesiones: Sesion[],
  instrumentos: Instrumento[],
): DocumentoFormato[] {
  const grupales = new Set(
    sesiones
      .filter((sesion) =>
        sesion.asistentes.some(
          (a) => a.estudianteId === estudianteId && ASISTIO.includes(a.estado),
        ),
      )
      .map((sesion) => sesion.id),
  );
  const instrumentoPorId = new Map(instrumentos.map((item) => [item.id, item]));
  return documentos.filter(
    (documento) =>
      documento.estudianteId === estudianteId ||
      (documento.formato === 'F07' &&
        grupales.has(instrumentoPorId.get(documento.id)?.sesionId ?? '')),
  );
}

/** Las entrevistas 03, 04 y 05 ocupan dos hojas, como en el anexo; el resto, una. */
export function hojasDe(documentos: DocumentoFormato[]): number {
  return documentos.reduce(
    (total, d) => total + (['F03', 'F04', 'F05'].includes(d.formato) ? 2 : 1),
    0,
  );
}

function aSlug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Nombre sugerido del PDF: el navegador lo toma del título del documento. */
export function nombreArchivo(documentos: DocumentoFormato[], etiqueta?: string): string {
  if (etiqueta) return `formatos-tutoria-${aSlug(etiqueta)}`;
  const primero = documentos[0];
  if (!primero) return 'formatos-tutoria';
  if (documentos.length === 1)
    return `formato-${primero.formato.slice(1)}-${aSlug(primero.referencia)}-${primero.semestreId}`;
  return `formatos-tutoria-${documentos.length}-documentos-${primero.semestreId}`;
}
