import { demoAuthService } from './demoAuthService';
import type { AuthService } from '../types/auth';
import type { TeacherCalendarService } from '../types/calendar';
import { browserTeacherCalendarService } from './teacherCalendarService';
import { API_MODE } from './apiConfig';
import { apiAuthService } from './apiAuthService';
import { apiTeacherCalendarService } from './apiTeacherCalendarService';

/**
 * Punto único de composición de servicios.
 *
 * El modo API autentica en el servidor y carga el expediente persistente mediante
 * apiTutoria. El modo demo conserva el adaptador ficticio para pruebas aisladas.
 * La disponibilidad personal usa la API en este modo y el navegador solo en demo.
 *
 * Fix del Lead (2026-10-14): se retiraron las importaciones a
 * `./demoTutoringRepository` y `../types/tutoring`, que la refactorización eliminó y
 * dejaban el arranque de la aplicación sin compilar.
 */
export const authService: AuthService = API_MODE ? apiAuthService : demoAuthService;
export const teacherCalendarService: TeacherCalendarService = API_MODE
  ? apiTeacherCalendarService
  : browserTeacherCalendarService;
