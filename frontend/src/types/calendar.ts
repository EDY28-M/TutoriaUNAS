import { z } from 'zod';
import type { DemoUser } from './auth';

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Selecciona una fecha válida.')
  .refine((value) => {
    const parsed = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Selecciona una fecha válida.');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Selecciona una hora válida.');

export const calendarInputSchema = z
  .object({
    kind: z.enum(['curso', 'tutoria']),
    title: z.string().trim().min(3, 'Escribe el nombre del curso.').max(100),
    semesterId: z.string().regex(/^\d{4}-(I|II)$/),
    days: z.array(z.number().int().min(1).max(7)).min(1, 'Selecciona al menos un día.').max(7),
    dateFrom: date,
    dateTo: date,
    startTime: time,
    endTime: time,
    location: z.string().trim().min(2, 'Indica el aula o enlace.').max(180),
    modality: z.enum(['presencial', 'virtual', 'mixta']),
    capacity: z.number().int().min(1).max(200).optional(),
  })
  .refine((input) => input.startTime < input.endTime, {
    message: 'La hora final debe ser posterior a la inicial.',
    path: ['endTime'],
  })
  .refine((input) => input.dateFrom <= input.dateTo, {
    message: 'La fecha final debe ser posterior a la inicial.',
    path: ['dateTo'],
  })
  .refine((input) => Date.parse(input.dateTo) - Date.parse(input.dateFrom) <= 366 * 86400000, {
    message: 'El horario no puede abarcar más de un año.',
    path: ['dateTo'],
  });

export type CalendarInput = z.infer<typeof calendarInputSchema>;
export interface TeacherCalendarBlock extends CalendarInput {
  id: string;
  tutorId: string;
  createdAt: string;
}
export type CalendarActor = Pick<DemoUser, 'id' | 'role'>;

/** Contrato sustituible por el cliente de la API institucional. */
export interface TeacherCalendarService {
  list(actor: CalendarActor): Promise<TeacherCalendarBlock[]>;
  save(actor: CalendarActor, input: CalendarInput, id?: string): Promise<TeacherCalendarBlock>;
  remove(actor: CalendarActor, id: string): Promise<void>;
}

export function occurrenceDates(block: CalendarInput): string[] {
  const result: string[] = [];
  const cursor = new Date(`${block.dateFrom}T12:00:00Z`);
  const end = new Date(`${block.dateTo}T12:00:00Z`);
  for (let i = 0; cursor <= end && i <= 366; i++, cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    if (block.days.includes(((cursor.getUTCDay() + 6) % 7) + 1))
      result.push(cursor.toISOString().slice(0, 10));
  }
  return result;
}

export function calendarBlocksOverlap(a: CalendarInput, b: CalendarInput): boolean {
  if (
    a.startTime >= b.endTime ||
    a.endTime <= b.startTime ||
    a.dateFrom > b.dateTo ||
    a.dateTo < b.dateFrom
  )
    return false;
  const dates = new Set(occurrenceDates(a));
  return occurrenceDates(b).some((day) => dates.has(day));
}
