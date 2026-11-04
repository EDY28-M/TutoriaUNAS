import { z } from 'zod';

export const STUDENT_NOTICES_EVENT = 'unas:student-notices-updated';
export const preferenciasAvisos = [
  {
    id: 'sesiones',
    titulo: 'Sesiones de tutoría',
    detalle: 'Recordatorios de tu agenda',
    icono: 'calendar-days',
  },
  {
    id: 'formularios',
    titulo: 'Mis formularios',
    detalle: 'Pendientes y correcciones',
    icono: 'file-lines',
  },
  {
    id: 'apoyo',
    titulo: 'Solicitudes de apoyo',
    detalle: 'Cambios en el seguimiento',
    icono: 'hand-holding-heart',
  },
  {
    id: 'bienestar',
    titulo: 'Salud y bienestar',
    detalle: 'Campañas y actividades',
    icono: 'heart-pulse',
  },
  {
    id: 'resumen',
    titulo: 'Resumen semanal',
    detalle: 'Tu avance en un solo aviso',
    icono: 'chart-simple',
  },
] as const;

const preferenciasSchema = z.object({
  sesiones: z.boolean().default(true),
  formularios: z.boolean().default(true),
  apoyo: z.boolean().default(true),
  bienestar: z.boolean().default(false),
  resumen: z.boolean().default(false),
});
const estadoSchema = z.object({
  leidas: z.record(z.string(), z.boolean()).default({}),
  preferencias: preferenciasSchema.prefault({}),
});
export type EstadoAvisosEstudiante = z.infer<typeof estadoSchema>;
export type PreferenciaAviso = (typeof preferenciasAvisos)[number]['id'];

export function claveAvisosEstudiante(estudianteId: string) {
  return `unas:student-notices:v1:${estudianteId}`;
}

export function leerEstadoAvisos(raw: string | null): EstadoAvisosEstudiante {
  try {
    return estadoSchema.parse(JSON.parse(raw ?? '{}'));
  } catch {
    return estadoSchema.parse({});
  }
}

/** Adaptador local de demostración, sustituible por el servicio institucional. */
export function guardarEstadoAvisos(estudianteId: string, estado: EstadoAvisosEstudiante) {
  try {
    localStorage.setItem(
      claveAvisosEstudiante(estudianteId),
      JSON.stringify(estadoSchema.parse(estado)),
    );
  } catch {
    throw new Error(
      'No se pudo guardar el cambio. Habilita el almacenamiento del navegador y vuelve a intentarlo.',
    );
  }
  window.dispatchEvent(new Event(STUDENT_NOTICES_EVENT));
}
