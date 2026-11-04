import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useAuth } from './useAuth';
import { avisos, notificaciones } from '../data/institucional';
import { estudiantePorId } from '../data/personas';
import type { Aviso, Notificacion } from '../types/domain';
import {
  claveAvisosEstudiante,
  guardarEstadoAvisos,
  leerEstadoAvisos,
  STUDENT_NOTICES_EVENT,
} from '../services/studentNoticesWorkspace';
import type { PreferenciaAviso } from '../services/studentNoticesWorkspace';
import { API_MODE } from '../services/apiConfig';
import { marcarAvisosApi, guardarPreferenciasApi } from '../services/apiSistema';
import { useSistema } from './useSistema';

export interface MensajeEstudiante extends Notificacion {
  canal: Aviso['canal'];
  aviso?: Aviso;
}

function suscribir(cambio: () => void) {
  window.addEventListener(STUDENT_NOTICES_EVENT, cambio);
  window.addEventListener('storage', cambio);
  return () => {
    window.removeEventListener(STUDENT_NOTICES_EVENT, cambio);
    window.removeEventListener('storage', cambio);
  };
}

/** Una sola fuente para la bandeja, la campana y los contadores del estudiante. */
export function useStudentNotices() {
  const sistema = useSistema();
  const { user } = useAuth();
  const estudiante = user?.role === 'estudiante' ? estudiantePorId(user.id) : undefined;
  const key = claveAvisosEstudiante(estudiante?.id ?? '');
  const snapshot = useCallback(() => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }, [key]);
  const raw = useSyncExternalStore(suscribir, snapshot, () => null);
  const estado = useMemo(() => leerEstadoAvisos(raw), [raw]);
  const mensajes = useMemo<MensajeEstudiante[]>(() => {
    if (!estudiante) return [];
    if (API_MODE)
      return (sistema?.notificaciones ?? []).map((item) => ({
        ...item,
        aviso: item.aviso ?? undefined,
      }));
    const correos = avisos
      .filter(
        (aviso) => aviso.estado === 'enviado' && aviso.destinatarios.includes(estudiante.correo),
      )
      .map((aviso): MensajeEstudiante => ({
        id: aviso.id,
        titulo: aviso.asunto,
        detalle: aviso.cuerpo,
        fecha: aviso.enviado,
        leida: true,
        tipo: 'sistema',
        canal: aviso.canal,
        enlace: aviso.plantilla === 'recordatorio-sesion' ? '/estudiante/sesiones' : null,
        aviso,
      }));
    return [
      ...notificaciones.map((item): MensajeEstudiante => ({ ...item, canal: 'sistema' })),
      ...correos,
    ]
      .map((item) => ({ ...item, leida: estado.leidas[item.id] ?? item.leida }))
      .sort(
        (a, b) =>
          b.fecha.localeCompare(a.fecha) ||
          Number(a.canal === 'correo') - Number(b.canal === 'correo') ||
          a.id.localeCompare(b.id),
      );
  }, [estudiante, estado.leidas, sistema]);

  function marcarLeidas(ids: string[], leida = true) {
    if (!estudiante) return;
    if (API_MODE) return marcarAvisosApi(ids, leida);
    const actual = leerEstadoAvisos(snapshot());
    const propias = new Set(mensajes.map((mensaje) => mensaje.id));
    guardarEstadoAvisos(estudiante.id, {
      ...actual,
      leidas: {
        ...actual.leidas,
        ...Object.fromEntries(ids.filter((id) => propias.has(id)).map((id) => [id, leida])),
      },
    });
  }

  function cambiarPreferencia(id: PreferenciaAviso, activo: boolean) {
    if (!estudiante) return;
    if (API_MODE && sistema)
      return guardarPreferenciasApi({
        ...sistema.preferencias,
        avisos: { ...sistema.preferencias.avisos, [id]: activo },
      });
    const actual = leerEstadoAvisos(snapshot());
    guardarEstadoAvisos(estudiante.id, {
      ...actual,
      preferencias: { ...actual.preferencias, [id]: activo },
    });
  }

  return {
    mensajes,
    sinLeer: mensajes.filter((mensaje) => !mensaje.leida).length,
    preferencias: API_MODE
      ? (sistema?.preferencias.avisos ?? estado.preferencias)
      : estado.preferencias,
    marcarLeidas,
    cambiarPreferencia,
  };
}
