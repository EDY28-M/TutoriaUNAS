import { z } from 'zod';
import type { Instrumento, Sesion } from '../types/domain';
import type { DemoUser } from '../types/auth';
import { asignaciones, sesiones } from '../data/tutoria';
import { semestreActual } from '../data/catalogos';
import { hayCruce } from '../data/academico';
import { sesionesDesdeInstrumentos } from '../utils/seguimientoInstrumentos';
import { aplicarRegistro, ATTENDANCE_KEY, leerRegistros } from './sessionAttendance';

export const SESSIONS_KEY = 'unas:scheduled-sessions:v1';
export const SESSIONS_EVENT = 'unas:scheduled-sessions-updated';
const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const entradaSchema = z.object({
  tipo: z.enum(['individual', 'grupal']),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  horaInicio: hora,
  horaFin: hora,
  modalidad: z.enum(['presencial', 'virtual', 'mixta']),
  lugar: z.string().trim().min(1).max(300),
  tema: z.string().trim().min(1).max(200),
  objetivo: z.string().trim().min(1).max(2000),
  estudiantes: z.array(z.string()).min(1),
});
export type ProgramacionSesion = z.infer<typeof entradaSchema>;
const programadaSchema = entradaSchema.extend({
  id: z.string(),
  tutorId: z.string(),
  semestreId: z.string(),
});

export function leerProgramadas(raw: string | null): Sesion[] {
  try {
    const filas = z.array(programadaSchema).parse(JSON.parse(raw ?? '[]'));
    return filas
      .filter(
        (s) =>
          new Set(s.estudiantes).size === s.estudiantes.length &&
          s.estudiantes.every((id) =>
            asignaciones.some(
              (a) =>
                a.estudianteId === id &&
                a.tutorId === s.tutorId &&
                a.semestreId === s.semestreId &&
                a.estado === 'activa',
            ),
          ),
      )
      .map((s): Sesion => ({
        ...s,
        codigo: `TUT-${s.id.slice(-8).toUpperCase()}`,
        estado: 'programada',
        asistentes: s.estudiantes.map((estudianteId) => ({
          estudianteId,
          estado: 'justificado',
          horaRegistro: null,
          observacion: 'Asistencia pendiente de registro',
        })),
        acuerdos: [],
        instrumentoId: null,
        observacion: null,
      }));
  } catch {
    return [];
  }
}

/** Fuente compartida para calendarios, asistencia y validación del guardado de evaluaciones. */
export function resolverSesiones(
  registros: Instrumento[],
  programadas: Sesion[],
  asistencias = leerRegistros(localStorage.getItem(ATTENDANCE_KEY)),
): Sesion[] {
  const unicas = new Map(
    [...sesiones, ...programadas, ...sesionesDesdeInstrumentos(registros)].map((s) => [s.id, s]),
  );
  return [...unicas.values()].map((s) => aplicarRegistro(s, asistencias));
}
export function consultarSesiones(registros: Instrumento[]): Sesion[] {
  return resolverSesiones(registros, leerProgramadas(localStorage.getItem(SESSIONS_KEY)));
}

/** Persistencia de demostración en el navegador; la API institucional sustituirá este adaptador. */
export function programarSesion(
  actor: DemoUser,
  entrada: ProgramacionSesion,
  registros: Instrumento[],
): Sesion {
  if (actor.role !== 'tutor') throw new Error('Solo un docente tutor puede programar sesiones.');
  const resultado = entradaSchema.safeParse(entrada);
  if (!resultado.success)
    throw new Error(
      'Completa la fecha, las horas, el lugar, el tema, el objetivo y los estudiantes.',
    );
  const dato = resultado.data;
  if (dato.horaFin <= dato.horaInicio)
    throw new Error('La hora de fin debe ser posterior al inicio.');
  const inicio = Date.parse(`${dato.fecha}T${dato.horaInicio}:00-05:00`);
  const fechaValida = new Date(`${dato.fecha}T12:00:00Z`);
  if (
    !Number.isFinite(inicio) ||
    !Number.isFinite(fechaValida.getTime()) ||
    fechaValida.toISOString().slice(0, 10) !== dato.fecha ||
    inicio < Date.now()
  )
    throw new Error('Programa una fecha y hora futuras válidas.');
  if (
    new Set(dato.estudiantes).size !== dato.estudiantes.length ||
    (dato.tipo === 'individual' ? dato.estudiantes.length !== 1 : dato.estudiantes.length < 2)
  )
    throw new Error(
      'Selecciona un estudiante para la sesión individual o al menos dos para la grupal, sin duplicados.',
    );
  if (
    dato.estudiantes.some(
      (id) =>
        !asignaciones.some(
          (a) =>
            a.estudianteId === id &&
            a.tutorId === actor.id &&
            a.semestreId === semestreActual &&
            a.estado === 'activa',
        ),
    )
  )
    throw new Error('Solo puedes convocar a estudiantes de tus asignaciones activas.');
  const dia = new Date(`${dato.fecha}T12:00:00-05:00`).getUTCDay() || 7;
  if (dato.estudiantes.some((id) => hayCruce(id, dia, dato.horaInicio, dato.horaFin)))
    throw new Error(
      'El horario coincide con una clase de los estudiantes convocados. Elige otro horario.',
    );
  if (
    consultarSesiones(registros).some(
      (s) =>
        !['cancelada', 'reprogramada'].includes(s.estado) &&
        s.fecha === dato.fecha &&
        s.horaInicio < dato.horaFin &&
        dato.horaInicio < s.horaFin &&
        (s.tutorId === actor.id ||
          s.asistentes.some((a) => dato.estudiantes.includes(a.estudianteId))),
    )
  )
    throw new Error('El tutor o un estudiante ya tiene otra sesión en ese horario.');
  const raw = localStorage.getItem(SESSIONS_KEY);
  const anteriores = z.array(programadaSchema).safeParse(JSON.parse(raw ?? '[]'));
  if (!anteriores.success)
    throw new Error(
      'No se pudo recuperar la agenda guardada. Revisa el almacenamiento antes de programar.',
    );
  const nueva = {
    ...dato,
    id: `SES-${crypto.randomUUID()}`,
    tutorId: actor.id,
    semestreId: semestreActual,
  };
  localStorage.setItem(SESSIONS_KEY, JSON.stringify([...anteriores.data, nueva]));
  window.dispatchEvent(new Event(SESSIONS_EVENT));
  return leerProgramadas(JSON.stringify([nueva]))[0]!;
}
