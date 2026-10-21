import type { Role } from '../types/auth';

/**
 * Textos por rol tomados literalmente de `ROLE_META` en
 * `login-unas/assets/app.js` (diseño 01 · Selva).
 */
export const roleDetails: Record<
  Role,
  { label: string; title: string; identifierLabel: string; example: string; cta: string }
> = {
  estudiante: {
    label: 'Estudiante',
    title: 'Portal del estudiante',
    identifierLabel: 'Código de matrícula',
    example: '2023010456',
    cta: 'Ingresar a mis tutorías',
  },
  tutor: {
    label: 'Tutor',
    title: 'Panel del docente tutor',
    identifierLabel: 'Código de docente',
    example: 'DOC-0421',
    cta: 'Abrir panel de tutoría',
  },
  coordinacion: {
    label: 'Coordinación',
    title: 'Coordinación de tutoría',
    identifierLabel: 'Usuario institucional',
    example: 'coordinacion.tutoria',
    cta: 'Entrar a coordinación',
  },
};

export function dashboardPath(role: Role): string {
  return `/${role}/dashboard`;
}
