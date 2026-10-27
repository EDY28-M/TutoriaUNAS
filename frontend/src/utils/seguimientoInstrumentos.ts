import type { Derivacion, Instrumento, Sesion } from '../types/domain';
import { estudiantes, nombreCompleto } from '../data/personas';
import { filasRespuesta } from './instrumentos';

/** Proyecciones frontend: un envío alimenta las vistas de sesiones y apoyo sin duplicar registros. */
export function sesionesDesdeInstrumentos(registros: Instrumento[]): Sesion[] {
  return registros
    .filter(
      (r) =>
        ['enviado', 'aprobado'].includes(r.estado) &&
        !r.sesionId &&
        ((['F06', 'F07'].includes(r.formato) && r.id.includes('-')) ||
          (r.formato === 'F08' &&
            r.respuestas.resultado === 'Se programa nueva cita para seguimiento')),
    )
    .flatMap((r): Sesion[] => {
      const seguimiento = r.formato === 'F08';
      const respuestas = r.respuestas;
      const fecha = seguimiento ? respuestas.proximaCita : respuestas.fecha;
      const horaInicio = seguimiento ? respuestas.horaCita : respuestas.horaInicio;
      const horaFin = seguimiento ? respuestas.horaFinCita : respuestas.horaFin;
      if (!fecha || !horaInicio || !horaFin) return [];
      const ids = seguimiento
        ? [r.estudianteId].filter((id): id is string => Boolean(id))
        : filasRespuesta(respuestas.asistentes ?? '').flatMap((fila) => {
            const e = estudiantes.find(
              (e) => e.id === fila.estudianteId || nombreCompleto(e) === fila.nombre,
            );
            return e ? [e.id] : [];
          });
      if (!ids.length) return [];
      return [
        {
          id: `SES-${r.id}`,
          codigo: `${seguimiento ? 'Seguimiento' : 'Registro'} ${r.formato}`,
          tipo: r.formato === 'F07' ? 'grupal' : 'individual',
          tutorId: r.tutorId,
          semestreId: r.semestreId,
          fecha,
          horaInicio,
          horaFin,
          modalidad: 'presencial',
          lugar: seguimiento ? 'Por confirmar con el tutor' : 'Atención registrada',
          tema: seguimiento
            ? 'Seguimiento de atención personalizada'
            : respuestas.tema === 'Otro'
              ? (respuestas.tema__otro ?? 'Tutoría grupal')
              : (respuestas.tema ?? 'Tutoría individual'),
          objetivo: seguimiento
            ? 'Revisar el avance del caso identificado'
            : 'Acompañamiento tutorial',
          estado: seguimiento ? 'programada' : 'realizada',
          asistenciaConfirmada: !seguimiento,
          asistentes: [...new Set(ids)].map((estudianteId) => ({
            estudianteId,
            estado: seguimiento ? 'justificado' : 'asistio',
            horaRegistro: seguimiento ? null : horaInicio,
            observacion: seguimiento ? 'Cita de seguimiento programada' : null,
          })),
          acuerdos: [],
          instrumentoId: r.id,
          observacion: 'Registro de demostración procedente del formulario de tutoría.',
        },
      ];
    });
}
export function derivacionesDesdeInstrumentos(registros: Instrumento[]): Derivacion[] {
  const areas: Record<string, Derivacion['area']> = {
    Psicología: 'psicologia',
    Psicopedagogía: 'psicopedagogia',
    'Medicina y Salud': 'medicina',
    'Bienestar y Servicio Social': 'bienestar-social',
  };
  return registros
    .filter(
      (r) =>
        r.formato === 'F12' &&
        !r.id.startsWith('INST-F12-DER-') &&
        ['enviado', 'aprobado'].includes(r.estado) &&
        r.estudianteId,
    )
    .flatMap((r): Derivacion[] => {
      const area = areas[r.respuestas.area ?? ''];
      if (!area || !r.estudianteId) return [];
      const fecha = r.respuestas.fecha ?? r.actualizado;
      return [
        {
          id: `DER-${r.id}`,
          codigo: `F12-${r.id.slice(-8)}`,
          formato: 'F12',
          estudianteId: r.estudianteId,
          tutorId: r.tutorId,
          semestreId: r.semestreId,
          area,
          motivo:
            r.respuestas.motivo === 'Otro'
              ? (r.respuestas.motivo__otro ?? 'Apoyo especializado')
              : (r.respuestas.motivo ?? 'Apoyo especializado'),
          detalle: r.respuestas.detalle ?? '',
          prioridad: 'media',
          fechaDerivacion: fecha,
          fechaRecepcion: null,
          fechaCita: null,
          fechaAtencion: null,
          estado: 'registrada',
          responsableArea: 'Pendiente de recepción por el área',
          siguienteAccion: 'El área receptora debe confirmar la recepción y programar la atención.',
          actualizado: r.actualizado,
          recomendacionComunicable: null,
          vigenciaRecomendacion: null,
          historial: [
            {
              fecha,
              estado: 'registrada',
              nota: 'Ficha 12 enviada por el docente tutor (demostración).',
              responsable: r.respuestas.nombreTutor ?? 'Docente tutor',
            },
          ],
        },
      ];
    });
}
