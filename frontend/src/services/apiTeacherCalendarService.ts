import type { TeacherCalendarBlock, TeacherCalendarService } from '../types/calendar';
import { apiJson } from './apiClient';

type Bloque = TeacherCalendarBlock & { version: number };
const versiones = new Map<string, Bloque>();
export const apiTeacherCalendarService: TeacherCalendarService = {
  async list() {
    const bloques = await apiJson<Bloque[]>('/api/sistema/calendario');
    versiones.clear();
    bloques.forEach((b) => versiones.set(b.id, b));
    return bloques;
  },
  async save(actor, input, id) {
    if (actor.role !== 'tutor') throw new Error('Solo el docente registra su disponibilidad.');
    const existente = id ? versiones.get(id) : null;
    if (id && (!existente || existente.tutorId !== actor.id))
      throw new Error('Recarga el horario antes de editarlo.');
    const bloque = await apiJson<Bloque>(
      `/api/sistema/calendario${id ? `/${encodeURIComponent(id)}` : ''}`,
      id ? 'PUT' : 'POST',
      { ...input, version: existente?.version ?? 0 },
    );
    versiones.set(bloque.id, bloque);
    return bloque;
  },
  async remove(actor, id) {
    const existente = versiones.get(id);
    if (actor.role !== 'tutor' || !existente || existente.tutorId !== actor.id)
      throw new Error('Recarga el horario antes de eliminarlo.');
    await apiJson(
      `/api/sistema/calendario/${encodeURIComponent(id)}?version=${existente.version}`,
      'DELETE',
    );
    versiones.delete(id);
  },
};
