import { z } from 'zod';
import { calendarBlocksOverlap, calendarInputSchema, occurrenceDates } from '../types/calendar';
import type {
  CalendarActor,
  CalendarInput,
  TeacherCalendarBlock,
  TeacherCalendarService,
} from '../types/calendar';
import { asignacionDe, bloquesTutoria, sesiones } from '../data/tutoria';
import { semestreActual, semestres } from '../data/catalogos';

export const TEACHER_CALENDAR_KEY = 'unas:teacher-calendar:v1';
const persistedSchema = z.object({
  blocks: z.array(
    z
      .object({ id: z.string(), tutorId: z.string(), createdAt: z.string() })
      .and(calendarInputSchema),
  ),
  deletedIds: z.array(z.string()),
});

const institutional: TeacherCalendarBlock[] = bloquesTutoria.map((block) => ({
  id: block.id,
  tutorId: block.tutorId,
  kind: 'tutoria',
  title: 'Tutoría',
  semesterId: semestreActual,
  days: [block.dia],
  dateFrom: block.vigenciaInicio,
  dateTo: block.vigenciaFin ?? semestres.find((term) => term.id === semestreActual)!.fin,
  startTime: block.horaInicio,
  endTime: block.horaFin,
  location: block.lugar,
  modality: block.modalidad,
  capacity: block.cupos,
  createdAt: block.vigenciaInicio,
}));

/** Persistencia local reemplazable desde serviceRegistry, sin simular una API remota. */
export class BrowserTeacherCalendarService implements TeacherCalendarService {
  constructor(private readonly storage: () => Pick<Storage, 'getItem' | 'setItem'>) {}

  private read() {
    const raw = this.storage().getItem(TEACHER_CALENDAR_KEY);
    if (!raw) return { blocks: [] as TeacherCalendarBlock[], deletedIds: [] as string[] };
    const result = persistedSchema.safeParse(JSON.parse(raw));
    if (!result.success) throw new Error('No se pudieron leer los horarios guardados.');
    return result.data;
  }
  private all(): TeacherCalendarBlock[] {
    const stored = this.read();
    const map = new Map(institutional.map((block) => [block.id, block]));
    for (const block of stored.blocks) map.set(block.id, block);
    for (const id of stored.deletedIds) map.delete(id);
    return [...map.values()];
  }
  private publish(value: ReturnType<BrowserTeacherCalendarService['read']>) {
    this.storage().setItem(TEACHER_CALENDAR_KEY, JSON.stringify(value));
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('unas:calendar-updated'));
  }
  async list(actor: CalendarActor): Promise<TeacherCalendarBlock[]> {
    const all = this.all();
    if (actor.role === 'coordinacion') return all;
    const tutorId = actor.role === 'tutor' ? actor.id : asignacionDe(actor.id)?.tutorId;
    return all.filter((block) => block.tutorId === tutorId);
  }
  async save(
    actor: CalendarActor,
    input: CalendarInput,
    id?: string,
  ): Promise<TeacherCalendarBlock> {
    if (actor.role !== 'tutor') throw new Error('Sólo el docente puede registrar su horario.');
    const parsed = calendarInputSchema.parse(input);
    const all = this.all();
    const existing = id ? all.find((block) => block.id === id) : undefined;
    if (id && (!existing || existing.tutorId !== actor.id))
      throw new Error('No puedes modificar este horario.');
    const dates = occurrenceDates(parsed);
    if (!dates.length) throw new Error('No hay fechas que coincidan con los días seleccionados.');
    const overlap = all.find(
      (block) =>
        block.id !== id && block.tutorId === actor.id && calendarBlocksOverlap(block, parsed),
    );
    if (overlap)
      throw new Error(
        `El horario coincide con «${overlap.title}» (${overlap.startTime}–${overlap.endTime}).`,
      );
    if (
      parsed.kind === 'curso' &&
      sesiones.some(
        (session) =>
          session.tutorId === actor.id &&
          session.estado !== 'cancelada' &&
          dates.includes(session.fecha) &&
          parsed.startTime < session.horaFin &&
          parsed.endTime > session.horaInicio,
      )
    ) {
      throw new Error(
        'El curso coincide con una sesión de tutoría. Cambia el horario o reprograma la sesión.',
      );
    }
    const block: TeacherCalendarBlock = {
      ...parsed,
      id:
        id ??
        `CB-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`,
      tutorId: actor.id,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    const stored = this.read();
    this.publish({
      blocks: [...stored.blocks.filter((item) => item.id !== block.id), block],
      deletedIds: stored.deletedIds.filter((item) => item !== block.id),
    });
    return block;
  }
  async remove(actor: CalendarActor, id: string): Promise<void> {
    const existing = this.all().find((block) => block.id === id);
    if (actor.role !== 'tutor' || !existing || existing.tutorId !== actor.id)
      throw new Error('No puedes eliminar este horario.');
    const stored = this.read();
    this.publish({
      blocks: stored.blocks.filter((block) => block.id !== id),
      deletedIds: [...new Set([...stored.deletedIds, id])],
    });
  }
}

export const browserTeacherCalendarService = new BrowserTeacherCalendarService(
  () => window.localStorage,
);
