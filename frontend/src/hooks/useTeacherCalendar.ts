import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { teacherCalendarService } from '../services/serviceRegistry';
import { TEACHER_CALENDAR_KEY } from '../services/teacherCalendarService';
import type { CalendarInput } from '../types/calendar';

export function useTeacherCalendar() {
  const { user } = useAuth();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['teacher-calendar', user?.role, user?.id],
    queryFn: () => (user ? teacherCalendarService.list(user) : Promise.resolve([])),
    enabled: !!user,
  });
  useEffect(() => {
    const refresh = () => {
      void client.invalidateQueries({ queryKey: ['teacher-calendar'] });
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === TEACHER_CALENDAR_KEY || event.key === null) refresh();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('unas:calendar-updated', refresh);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('unas:calendar-updated', refresh);
    };
  }, [client]);
  return {
    ...query,
    blocks: query.data ?? [],
    async save(input: CalendarInput, id?: string) {
      if (!user) throw new Error('Inicia sesión para guardar el horario.');
      const result = await teacherCalendarService.save(user, input, id);
      await client.invalidateQueries({ queryKey: ['teacher-calendar'] });
      return result;
    },
    async remove(id: string) {
      if (!user) throw new Error('Inicia sesión para eliminar el horario.');
      await teacherCalendarService.remove(user, id);
      await client.invalidateQueries({ queryKey: ['teacher-calendar'] });
    },
  };
}
