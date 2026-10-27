import { matriculaDe, nombreCurso } from '../data/academico';
import {
  camposVisibles,
  erroresInstrumento,
  listaRespuesta,
  fechaTutoria,
} from './validacionInstrumentos';
export {
  campoVisible,
  camposVisibles,
  erroresInstrumento,
  filasRespuesta,
  listaRespuesta,
  fechaTutoria,
} from './validacionInstrumentos';
import type { CodigoFormato, DefinicionFormato, Instrumento, Sesion } from '../types/domain';
import { definicionPorCodigo } from '../data/formatos';
import { asignaciones, planDeEscuela, sesiones } from '../data/tutoria';
import {
  comisionTutoria,
  docentePorId,
  estudiantePorId,
  escuelaDe,
  nombreCompleto,
} from '../data/personas';
import {
  etapaAcademica,
  etapaDeCiclo,
  facultades,
  escuelas,
  semestreActual,
} from '../data/catalogos';
import { respuestasRecordadas } from '../services/expediente';

/** Opciones de matrícula y participantes resueltas desde el mismo ámbito que el guardado. */
export function contextualizarDefinicion(
  definicion: DefinicionFormato,
  instrumento: Instrumento,
): DefinicionFormato {
  const cursos = instrumento.estudianteId
    ? (matriculaDe(instrumento.estudianteId)?.cursos ?? []).map((curso) =>
        nombreCurso(curso.cursoId),
      )
    : [];
  const nombres = asignaciones
    .filter(
      (a) =>
        a.tutorId === instrumento.tutorId &&
        a.semestreId === instrumento.semestreId &&
        a.estado === 'activa',
    )
    .map((a) => estudiantePorId(a.estudianteId))
    .filter((e) => !!e)
    .map(nombreCompleto);
  return {
    ...definicion,
    secciones: definicion.secciones.map((seccion) => ({
      ...seccion,
      campos: seccion.campos.map((campo) => {
        if (['cursosDificiles', 'materiasFaciles'].includes(campo.codigo))
          return { ...campo, opciones: [...cursos, 'Ninguno', 'Otro'] };
        if (campo.codigo === 'asistentes')
          return {
            ...campo,
            columnas: campo.columnas?.map((col) =>
              col.codigo === 'nombre'
                ? { ...col, tipo: 'seleccion' as const, opciones: nombres }
                : col,
            ),
          };
        return campo;
      }),
    })),
  };
}

export type MomentoTutoria = 'inicio' | 'durante' | 'cierre';
export function formatoInicial(ciclo: number): CodigoFormato {
  return etapaAcademica[etapaDeCiclo(ciclo)].formato;
}
export function avanceInstrumento(
  definicion: DefinicionFormato,
  valores: Record<string, string>,
): number {
  const campos = camposVisibles(definicion, valores).filter((campo) => campo.obligatorio);
  const errores = erroresInstrumento(definicion, valores);
  return campos.length
    ? Math.round(
        (100 *
          campos.filter((campo) => !errores[campo.codigo] && !errores[`${campo.codigo}__otro`])
            .length) /
          campos.length,
      )
    : 100;
}
export function respuestasVisibles(
  definicion: DefinicionFormato,
  valores: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    camposVisibles(definicion, valores).flatMap((campo) => {
      const valor = valores[campo.codigo] ?? '';
      const entries = [[campo.codigo, valor]];
      if (valor === 'Otro' || listaRespuesta(valor).includes('Otro'))
        entries.push([`${campo.codigo}__otro`, valores[`${campo.codigo}__otro`] ?? '']);
      return entries;
    }),
  );
}
/** Entrevistas iniciales: se responden al inicio del semestre. */
const FORMATOS_DE_INICIO: CodigoFormato[] = ['F03', 'F04', 'F05'];
/** Informes y autoevaluación del tutor: al cierre. F10/F11 dependen de cada sesión. */
const FORMATOS_DE_CIERRE: CodigoFormato[] = ['F01', 'F02', 'F09'];

/** Etapa del semestre en la que corresponde completar cada formato. */
export function etapaDeFormato(codigo: CodigoFormato): MomentoTutoria {
  if (FORMATOS_DE_INICIO.includes(codigo)) return 'inicio';
  if (FORMATOS_DE_CIERRE.includes(codigo)) return 'cierre';
  return 'durante';
}

/**
 * Indica si el formato se puede enviar en la etapa seleccionada.
 * Las entrevistas iniciales solo al inicio; los informes solo al cierre.
 * F10/F11 requieren además sesión finalizada y asistencia confirmada.
 * Los registros del tutor (06, 07, 08 y 12) se completan durante todo
 * el semestre, cuando ocurre la atención.
 */
export function puedeEnviarFormato(codigo: CodigoFormato, momento: MomentoTutoria): boolean {
  const etapa = etapaDeFormato(codigo);
  return etapa === 'durante' || etapa === momento;
}

const MOTIVOS_DERIVACION: Record<string, string> = {
  'Dificultades de estudio': 'Dificultades de aprendizaje',
  'Organización del tiempo': 'Dificultades de aprendizaje',
  'Riesgo académico': 'Dificultades de aprendizaje',
  'Situación personal': 'Apoyo emocional',
  'Situación familiar': 'Situación económica o familiar',
  'Necesidad de apoyo especializado': 'Otro',
  Otro: 'Otro',
};

/** Traduce el motivo de una atención 08 a las opciones de la ficha de derivación 12. */
export function motivoDerivacionDesdeAtencion(motivo: string): string {
  return MOTIVOS_DERIVACION[motivo] ?? 'Otro';
}

/**
 * Precarga los datos institucionales del formato 01 (informe de la comisión):
 * facultad y escuela, integrantes de la comisión y actividades del plan tutorial
 * de la escuela. Así la comisión solo completa lo que falta o lo que cambió.
 */
function datosInformeEscuela(instrumento: Instrumento): Record<string, string> {
  const escuelaId = instrumento.respuestas.escuela ?? '';
  const escuela = escuelas.find((item) => item.id === escuelaId);
  if (!escuela) return {};
  const facultad = facultades.find((item) => item.id === escuela.facultadId);
  const comision = comisionTutoria
    .filter(
      (miembro) =>
        miembro.cargoTutorial === 'Responsable de Tutoría y Capacitación Docente' ||
        miembro.ambito.includes(escuela.abreviatura),
    )
    .map((miembro) => `${miembro.nombres} · ${miembro.cargoTutorial}`);
  const actividades = planDeEscuela(escuela.id)
    .filter((actividad) => actividad.semestreId === instrumento.semestreId)
    .map((actividad) => ({
      problematica: actividad.problematica,
      meta: actividad.meta,
      // El plan contiene fechas previstas y tipos de evidencia, no ejecución acreditada.
      fecha: '',
      justificacion: `${actividad.actividad}. ${actividad.objetivo}`,
      evidencia: '',
    }));
  return {
    facultad: facultad ? `${facultad.nombre} · ${escuela.nombre}` : escuela.nombre,
    comision: comision.join('\n'),
    actividades: actividades.length ? JSON.stringify(actividades) : '',
  };
}

export interface PrecargaInstrumento {
  valores: Record<string, string>;
  /** Códigos tomados del expediente compartido, no del padrón ni del borrador. */
  reutilizados: string[];
}

export function precargarInstrumentoConOrigen(
  instrumento: Instrumento,
  sesionesActuales: Sesion[] = sesiones,
  registrosPrevios: readonly Instrumento[] = [],
): PrecargaInstrumento {
  // Un envío es una fotografía de lo declarado en ese momento.
  if (['enviado', 'aprobado'].includes(instrumento.estado)) {
    const definicion = definicionPorCodigo(instrumento.formato);
    return {
      valores: definicion
        ? respuestasVisibles(definicion, instrumento.respuestas)
        : { ...instrumento.respuestas },
      reutilizados: [],
    };
  }
  const estudiante = instrumento.estudianteId ? estudiantePorId(instrumento.estudianteId) : null;
  const contactoDeclarado = registrosPrevios
    .filter(
      (r) =>
        r.estudianteId === instrumento.estudianteId &&
        r.semestreId === instrumento.semestreId &&
        ['F03', 'F04', 'F05'].includes(r.formato) &&
        ['enviado', 'aprobado'].includes(r.estado),
    )
    .sort((a, b) => a.actualizado.localeCompare(b.actualizado) || a.version - b.version)
    .at(-1)?.respuestas;
  const docente = docentePorId(instrumento.tutorId);
  const asignacion = asignaciones.find(
    (item) =>
      item.estudianteId === estudiante?.id &&
      item.semestreId === instrumento.semestreId &&
      item.tutorId === instrumento.tutorId &&
      item.estado === 'activa',
  );
  const grupo = asignacion?.grupo ?? '';
  const tutorados = asignaciones.filter(
    (item) =>
      item.tutorId === instrumento.tutorId &&
      item.semestreId === instrumento.semestreId &&
      item.estado === 'activa',
  );
  const realizadas = sesionesActuales.filter(
    (item) =>
      item.tutorId === instrumento.tutorId &&
      item.semestreId === instrumento.semestreId &&
      item.estado === 'realizada',
  );
  const sesion = sesionesActuales.find((item) => item.id === instrumento.sesionId);
  const asistentesDe = (tipo: Sesion['tipo']) => [
    ...new Set(
      realizadas
        .filter((item) => item.tipo === tipo)
        .flatMap((item) =>
          item.asistentes
            .filter((a) => ['asistio', 'tarde'].includes(a.estado))
            .map((a) => a.estudianteId),
        ),
    ),
  ];
  const ciclosDe = (tipo: Sesion['tipo']) =>
    [...new Set(asistentesDe(tipo).map((id) => estudiantePorId(id)?.ciclo))]
      .filter((ciclo): ciclo is number => ciclo !== undefined)
      .sort((a, b) => a - b)
      .join(', ') || 'Sin atenciones';
  const identidad: Record<string, string> = {
    nombreTutor: docente ? nombreCompleto(docente) : '',
    telefonoTutor: docente?.telefono ?? '',
    semestre: instrumento.semestreId || semestreActual,
    fecha: instrumento.enviado ?? fechaTutoria(),
    ...(estudiante
      ? {
          nombreEstudiante: nombreCompleto(estudiante),
          codigo: estudiante.codigo,
          correo: estudiante.correo,
          telefono: estudiante.telefono,
          ciclo: String(estudiante.ciclo),
          escuela: escuelaDe(estudiante.escuelaId),
          grupo,
        }
      : {}),
    ...(instrumento.formato === 'F09'
      ? {
          gruposAsignados: String(new Set(tutorados.map((a) => a.grupo).filter(Boolean)).size),
          estudiantesAsignados: String(tutorados.length),
        }
      : {}),
    ...(instrumento.formato === 'F01' ? datosInformeEscuela(instrumento) : {}),
    ...(instrumento.formato === 'F02'
      ? {
          individuales: String(realizadas.filter((item) => item.tipo === 'individual').length),
          grupales: String(realizadas.filter((item) => item.tipo === 'grupal').length),
          atendidosIndividual: String(asistentesDe('individual').length),
          atendidosGrupal: String(asistentesDe('grupal').length),
          ciclosIndividual: ciclosDe('individual'),
          ciclosGrupal: ciclosDe('grupal'),
          atendidos: String(
            new Set(
              realizadas.flatMap((item) =>
                item.asistentes
                  .filter((a) => ['asistio', 'tarde'].includes(a.estado))
                  .map((a) => a.estudianteId),
              ),
            ).size,
          ),
          ciclos: [...new Set(tutorados.map((a) => estudiantePorId(a.estudianteId)?.ciclo))]
            .filter(Boolean)
            .sort((a, b) => a! - b!)
            .join(', '),
        }
      : {}),
    ...(sesion
      ? {
          fecha: sesion.fecha,
          turno:
            Number(sesion.horaInicio.slice(0, 2)) < 12
              ? 'Mañana'
              : Number(sesion.horaInicio.slice(0, 2)) < 18
                ? 'Tarde'
                : 'Noche',
          tema: sesion.tema,
          horaInicio: sesion.horaInicio,
          horaFin: sesion.horaFin,
          grupo:
            grupo ||
            tutorados.find((a) => sesion.asistentes.some((p) => p.estudianteId === a.estudianteId))
              ?.grupo ||
            '',
          asistentes: JSON.stringify(
            sesion.asistentes
              .filter((a) => ['asistio', 'tarde'].includes(a.estado))
              .map((a) => {
                const e = estudiantePorId(a.estudianteId);
                return {
                  nombre: e ? nombreCompleto(e) : '',
                  ciclo: String(e?.ciclo ?? ''),
                  grupo:
                    asignaciones.find(
                      (as) =>
                        as.estudianteId === a.estudianteId &&
                        as.tutorId === instrumento.tutorId &&
                        as.semestreId === instrumento.semestreId &&
                        as.estado === 'activa',
                    )?.grupo ?? '',
                  tipo: 'Académica',
                };
              }),
          ),
        }
      : {}),
  };
  // Los datos que la persona ya respondió en otros formularios se reutilizan;
  // el borrador propio y el padrón institucional tienen prioridad sobre ellos.
  const recordadas = {
    ...Object.fromEntries(
      ['correo', 'telefono'].flatMap((codigo) =>
        contactoDeclarado && typeof contactoDeclarado[codigo] === 'string'
          ? [[codigo, contactoDeclarado[codigo]]]
          : [],
      ),
    ),
    ...respuestasRecordadas(instrumento, registrosPrevios),
  };
  const valores = { ...identidad, ...recordadas, ...instrumento.respuestas };
  if (sesion && ['F10', 'F11'].includes(instrumento.formato)) {
    // La fecha y el turno corresponden a esta sesión, aunque otra evaluación los recordara.
    valores.fecha = sesion.fecha;
    valores.turno = identidad.turno!;
    valores.grupo = grupo;
    valores.nombreTutor = identidad.nombreTutor!;
  }
  if (
    instrumento.formato === 'F08' &&
    valores.motivo &&
    !definicionPorCodigo('F08')
      ?.secciones.flatMap((s) => s.campos)
      .find((c) => c.codigo === 'motivo')
      ?.opciones?.includes(valores.motivo)
  ) {
    valores.motivo__otro = valores.motivo;
    valores.motivo = 'Otro';
  }
  if (
    instrumento.formato === 'F12' &&
    valores.motivo &&
    !definicionPorCodigo('F12')
      ?.secciones.flatMap((s) => s.campos)
      .find((c) => c.codigo === 'motivo')
      ?.opciones?.includes(valores.motivo)
  ) {
    valores.motivo__otro = valores.motivo;
    valores.motivo = 'Otro';
  }
  // Los campos identificativos proceden siempre del padrón de la sesión, no de otro formulario.
  for (const codigo of [
    'nombreEstudiante',
    'codigo',
    'nombreTutor',
    'ciclo',
    'escuela',
    'semestre',
  ])
    if (identidad[codigo]) valores[codigo] = identidad[codigo];
  if (['F02', 'F09'].includes(instrumento.formato)) {
    for (const codigo of [
      'individuales',
      'grupales',
      'atendidosIndividual',
      'atendidosGrupal',
      'ciclosIndividual',
      'ciclosGrupal',
      'gruposAsignados',
      'estudiantesAsignados',
    ])
      if (codigo in identidad) valores[codigo] = identidad[codigo] ?? '';
  }
  const definicion = definicionPorCodigo(instrumento.formato);
  if (!definicion) return { valores, reutilizados: [] };
  const visibles = respuestasVisibles(definicion, valores);
  const reutilizados = Object.keys(recordadas).filter(
    (codigo) =>
      codigo in visibles &&
      visibles[codigo] === recordadas[codigo] &&
      !(codigo in instrumento.respuestas) &&
      visibles[codigo] !== identidad[codigo],
  );
  return { valores: visibles, reutilizados };
}

export function precargarInstrumento(
  instrumento: Instrumento,
  sesionesActuales: Sesion[] = sesiones,
): Record<string, string> {
  return precargarInstrumentoConOrigen(instrumento, sesionesActuales).valores;
}
