import { demoAuthService } from './demoAuthService';
import type { AuthService } from '../types/auth';
import type { TeacherCalendarService } from '../types/calendar';
import { browserTeacherCalendarService } from './teacherCalendarService';

/**
 * Punto único de composición de servicios.
 *
 * La autenticación de la demostración se sustituye desde aquí el día que exista el
 * proveedor institucional. Las consultas de tutoría ya no pasan por este registro:
 * viven en `src/data` y se consumen con `hooks/usePortal`, que es el punto que se
 * reemplazará por la API real (DIAA, RRHH, Bienestar) cuando se integre.
 *
 * Fix del Lead (2026-10-14): se retiraron las importaciones a
 * `./demoTutoringRepository` y `../types/tutoring`, que la refactorización eliminó y
 * dejaban el arranque de la aplicación sin compilar.
 */
export const authService: AuthService = demoAuthService;
export const teacherCalendarService: TeacherCalendarService = browserTeacherCalendarService;
