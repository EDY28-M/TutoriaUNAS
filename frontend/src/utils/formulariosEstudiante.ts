import type { Instrumento, Sesion } from '../types/domain';
import { semestreActual } from '../data/catalogos';
import { formulariosVigentes } from './entrevistas';
import { esEvaluacionSesion, sesionFinalizo } from './evaluacionesSesion';
import { formatoInicial, puedeEnviarFormato } from './instrumentos';
import type { MomentoTutoria } from './instrumentos';

/**
 * Qué puede hacer el estudiante con cada formulario en este momento.
 *
 * - `responder`: está habilitado y aún no se envió.
 * - `corregir`: su tutor pidió cambios.
 * - `esperando`: existirá, pero todavía no (la sesión no terminó o falta la asistencia).
 * - `enviado`: ya lo envió; solo se consulta.
 * - `no-aplica`: no es una tarea suya (sesión cancelada o reprogramada, o no asistió).
 */
export type Disponibilidad = 'responder' | 'corregir' | 'esperando' | 'enviado' | 'no-aplica';

export interface FormularioEstudiante {
  registro: Instrumento;
  sesion: Sesion | undefined;
  disponibilidad: Disponibilidad;
  /** Explicación breve cuando el formulario aún no se puede responder. */
  motivo?: string;
}

const ENTREGADOS: Instrumento['estado'][] = ['enviado', 'aprobado'];
const PRESENTE = ['asistio', 'tarde'];

export function clasificarFormulario(
  registro: Instrumento,
  sesiones: Sesion[],
  momento: MomentoTutoria,
  ahora = Date.now(),
): Omit<FormularioEstudiante, 'registro'> {
  const sesion = registro.sesionId ? sesiones.find((s) => s.id === registro.sesionId) : undefined;
  if (ENTREGADOS.includes(registro.estado)) return { sesion, disponibilidad: 'enviado' };

  if (esEvaluacionSesion(registro.formato)) {
    const asistencia = sesion?.asistentes.find((a) => a.estudianteId === registro.estudianteId);
    if (!sesion || !asistencia || ['cancelada', 'reprogramada'].includes(sesion.estado))
      return { sesion, disponibilidad: 'no-aplica' };
    if (sesion.estado !== 'realizada' || !sesionFinalizo(sesion, ahora))
      return { sesion, disponibilidad: 'esperando', motivo: 'Se habilita al terminar la sesión' };
    if (!sesion.asistenciaConfirmada)
      return {
        sesion,
        disponibilidad: 'esperando',
        motivo: 'Tu tutor aún no confirma la asistencia',
      };
    // Solo evalúa quien estuvo presente; una inasistencia no es una tarea pendiente.
    if (!PRESENTE.includes(asistencia.estado)) return { sesion, disponibilidad: 'no-aplica' };
  }

  if (!puedeEnviarFormato(registro.formato, momento))
    return { sesion, disponibilidad: 'esperando', motivo: 'Se envía en otra etapa del semestre' };
  return { sesion, disponibilidad: registro.estado === 'observado' ? 'corregir' : 'responder' };
}

const fechaSesion = (f: FormularioEstudiante) =>
  f.sesion ? `${f.sesion.fecha}T${f.sesion.horaInicio}` : '';

/**
 * Formularios del tutorado en el semestre: su entrevista vigente (03, 04 o 05
 * según el ciclo) y una evaluación por sesión. Excluye lo que no es su tarea.
 */
export function formulariosDelEstudiante(
  registros: Instrumento[],
  ciclo: number | null,
  sesiones: Sesion[],
  momento: MomentoTutoria,
  ahora = Date.now(),
): FormularioEstudiante[] {
  return formulariosVigentes(registros, ciclo, semestreActual)
    .filter(
      (r) =>
        (ciclo !== null && r.formato === formatoInicial(ciclo)) || esEvaluacionSesion(r.formato),
    )
    .map((registro) => ({ registro, ...clasificarFormulario(registro, sesiones, momento, ahora) }))
    .filter((f) => f.disponibilidad !== 'no-aplica')
    .sort(
      (a, b) =>
        // La entrevista va primero; luego, lo más reciente.
        Number(esEvaluacionSesion(a.registro.formato)) -
          Number(esEvaluacionSesion(b.registro.formato)) ||
        fechaSesion(b).localeCompare(fechaSesion(a)),
    );
}

export const porResponder = (f: FormularioEstudiante) =>
  f.disponibilidad === 'responder' || f.disponibilidad === 'corregir';

/** Página propia para responder o consultar un formulario. */
export const rutaFormulario = (registro: Pick<Instrumento, 'id'>) =>
  `/estudiante/instrumentos/${encodeURIComponent(registro.id)}`;
