import { z } from 'zod';
import type { Sesion } from '../types/domain';
import type { Role } from '../types/auth';

export const ATTENDANCE_KEY = 'unas:session-attendance:v1';
export const ATTENDANCE_EVENT = 'unas:session-attendance-updated';
const asistenteSchema = z.object({
  estudianteId: z.string(),
  estado: z.enum(['asistio', 'tarde', 'falto', 'justificado']),
  horaRegistro: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable(),
  observacion: z.string().nullable(),
});
const acuerdoSchema = z.object({
  id: z.string(),
  descripcion: z.string(),
  responsable: z.enum(['tutor', 'tutorado', 'ambos']),
  fechaCompromiso: z.string().nullable(),
  estado: z.enum(['pendiente', 'cumplido', 'vencido']),
});
const registroSchema = z.object({
  tutorId: z.string(),
  asistentes: z.array(asistenteSchema),
  acuerdos: z.array(acuerdoSchema),
});
const registrosSchema = z.record(z.string(), registroSchema);
export type RegistrosAsistencia = z.infer<typeof registrosSchema>;

export function leerRegistros(raw: string | null): RegistrosAsistencia {
  try {
    return registrosSchema.parse(JSON.parse(raw ?? '{}'));
  } catch {
    return {};
  }
}

export function aplicarRegistro(sesion: Sesion, registros: RegistrosAsistencia): Sesion {
  const registro = registros[sesion.id];
  if (!registro || registro.tutorId !== sesion.tutorId) return sesion;
  const ids = new Set(sesion.asistentes.map((a) => a.estudianteId));
  if (
    registro.asistentes.length !== ids.size ||
    new Set(registro.asistentes.map((a) => a.estudianteId)).size !== ids.size ||
    registro.asistentes.some((a) => !ids.has(a.estudianteId))
  )
    return sesion;
  return { ...sesion, asistentes: registro.asistentes, acuerdos: registro.acuerdos };
}

/** Persistencia de demostración en este navegador; sustituible por la API institucional. */
export function guardarAsistencia(
  actor: { id: string; role: Role },
  sesion: Sesion,
  asistentes: Sesion['asistentes'],
  mensaje: string,
  storage: Pick<Storage, 'getItem' | 'setItem'> = window.localStorage,
) {
  if (actor.role !== 'tutor' || actor.id !== sesion.tutorId || sesion.estado !== 'realizada') {
    throw new Error('Solo el tutor responsable puede registrar esta sesión realizada.');
  }
  const registros = leerRegistros(storage.getItem(ATTENDANCE_KEY));
  const actual = aplicarRegistro(sesion, registros);
  const texto = mensaje.trim();
  if (texto.length > 2000) throw new Error('El acuerdo admite hasta 2000 caracteres.');
  const registro = registroSchema.parse({
    tutorId: sesion.tutorId,
    asistentes,
    acuerdos: texto
      ? [
          ...actual.acuerdos,
          {
            id: `AC-${crypto.randomUUID()}`,
            descripcion: texto,
            responsable: 'ambos',
            fechaCompromiso: null,
            estado: 'pendiente',
          },
        ]
      : actual.acuerdos,
  });
  const ids = new Set(sesion.asistentes.map((a) => a.estudianteId));
  if (
    registro.asistentes.length !== ids.size ||
    new Set(registro.asistentes.map((a) => a.estudianteId)).size !== ids.size ||
    registro.asistentes.some((a) => !ids.has(a.estudianteId))
  ) {
    throw new Error('La lista debe incluir una sola vez a cada estudiante de la sesión.');
  }
  storage.setItem(ATTENDANCE_KEY, JSON.stringify({ ...registros, [sesion.id]: registro }));
  window.dispatchEvent(new Event(ATTENDANCE_EVENT));
}

export function cantidadAsistentes(sesion: Sesion): number {
  return sesion.asistentes.filter((a) => a.estado === 'asistio' || a.estado === 'tarde').length;
}
