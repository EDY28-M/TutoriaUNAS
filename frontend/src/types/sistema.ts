import type { ActividadPlan, Aviso, Notificacion, PermisoRol } from './domain';
import type { DisplayPreferences } from '../utils/displayPreferences';
import type { EstadoAvisosEstudiante } from '../services/studentNoticesWorkspace';

export interface ContactoPerfil {
  correo: string;
  telefono: string;
  version: number;
}
export interface PreferenciasUsuario {
  avisos: EstadoAvisosEstudiante['preferencias'];
  pantalla: DisplayPreferences;
  version: number;
}
export interface CuentaAcceso {
  id: string;
  personaId: string;
  rol: 'estudiante' | 'tutor';
  identifier: string;
  nombre: string;
  activo: boolean;
  version: number;
}
export interface SolicitudCambio {
  id: string;
  estudianteId: string;
  tutorActualId: string;
  escuelaId: string;
  semestreId: string;
  motivo: string;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  respuesta: string | null;
  creado: string;
  resuelto: string | null;
  version: number;
}
export interface PeriodoConfiguracion {
  periodoId: string;
  inicio: string;
  fin: string;
  entrevistasHasta: string;
  informesHasta: string;
  cerrado: boolean;
  version: number;
}
export type ActividadPersistida = ActividadPlan & { responsableId: string; version: number };
export type MensajePersistido = Aviso & {
  emisorId: string;
  editable: boolean;
  version: number;
  destinatarioIds?: string[];
  programadoPara?: string | null;
};
export type NotificacionPersistida = Notificacion & { canal: Aviso['canal']; aviso?: Aviso | null };
export interface SistemaApi {
  catalogos: Record<string, Record<string, unknown>[]>;
  fuentes: Record<string, Record<string, unknown>[]>;
  contacto: ContactoPerfil;
  preferencias: PreferenciasUsuario;
  mensajes: MensajePersistido[];
  notificaciones: NotificacionPersistida[];
  solicitudesCambio: SolicitudCambio[];
  actividadesPlan: ActividadPersistida[];
  cuentas: CuentaAcceso[];
  permisos: PermisoRol[];
  configuracionPeriodo: PeriodoConfiguracion | null;
  actividadCuenta?: { titulo: string; descripcion: string; fecha: string }[];
  accesoLocal?: boolean;
  destinatariosDisponibles?: { id: string; personaId: string; rol: string; nombre: string }[];
}
