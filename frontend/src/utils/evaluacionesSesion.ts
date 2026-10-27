import type { Instrumento, Sesion } from '../types/domain';

export const esEvaluacionSesion = (formato: string) => ['F10', 'F11'].includes(formato);
export const formatoDeSesion = (sesion: Sesion) =>
  sesion.tipo === 'individual' ? ('F10' as const) : ('F11' as const);
export const idEvaluacionSesion = (sesion: Sesion, estudianteId: string) =>
  `INST-${formatoDeSesion(sesion)}-${sesion.id}-${estudianteId}`;

/** Las horas de las sesiones son horas locales de Perú, independientemente del equipo. */
export function sesionFinalizo(sesion: Sesion, ahora = Date.now()): boolean {
  return Date.parse(`${sesion.fecha}T${sesion.horaFin}:00-05:00`) <= ahora;
}

export function bloqueoEvaluacion(
  sesion: Sesion | undefined,
  estudianteId: string,
  ahora = Date.now(),
): string | null {
  if (!sesion) return 'Esta evaluación no tiene una sesión disponible asociada.';
  const asistencia = sesion.asistentes.find((a) => a.estudianteId === estudianteId);
  if (!asistencia) return 'No estás convocado a esta sesión.';
  if (['cancelada', 'reprogramada'].includes(sesion.estado))
    return 'Esta sesión fue cancelada o reprogramada y no admite evaluaciones.';
  if (sesion.estado !== 'realizada' || !sesionFinalizo(sesion, ahora))
    return 'La evaluación se habilita cuando finaliza la sesión y tu tutor confirma tu asistencia.';
  if (!sesion.asistenciaConfirmada)
    return 'Tu tutor aún debe confirmar la asistencia de esta sesión. Por ahora puedes ver las preguntas.';
  if (!['asistio', 'tarde'].includes(asistencia.estado))
    return 'Para responder debes haber asistido a esta sesión. Tu asistencia no está confirmada como presente; comunícate con tu tutor si necesitas corregirla.';
  return null;
}

/** Un registro por estudiante y sesión; nunca reutiliza calificaciones de otra evaluación. */
export function evaluacionesDeSesiones(
  sesiones: Sesion[],
  registros: Instrumento[],
): Instrumento[] {
  const guardados = new Map(registros.map((r) => [r.id, r]));
  return sesiones.flatMap((sesion) =>
    sesion.asistentes.map(({ estudianteId }): Instrumento => {
      const id = idEvaluacionSesion(sesion, estudianteId);
      const guardado = guardados.get(id);
      if (
        guardado?.sesionId === sesion.id &&
        guardado.estudianteId === estudianteId &&
        guardado.tutorId === sesion.tutorId &&
        guardado.semestreId === sesion.semestreId &&
        guardado.formato === formatoDeSesion(sesion)
      )
        return guardado;
      return {
        id,
        formato: formatoDeSesion(sesion),
        sesionId: sesion.id,
        estudianteId,
        tutorId: sesion.tutorId,
        semestreId: sesion.semestreId,
        estado: 'no-iniciado',
        avance: 0,
        version: 1,
        creado: sesion.fecha,
        actualizado: sesion.fecha,
        enviado: null,
        revisadoPor: null,
        observaciones: [],
        descargaDisponible: false,
        respuestas: {},
      };
    }),
  );
}
