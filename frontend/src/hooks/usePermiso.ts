import { useAuth } from './useAuth';
import { useSistema } from './useSistema';

/** La interfaz acompaña los permisos publicados; la API vuelve a validarlos. */
export function usePermiso(recurso: string, accion: string): boolean {
  const { user } = useAuth();
  const sistema = useSistema();
  const rol = user?.role;
  return Boolean(
    rol &&
    sistema?.permisos.some(
      (p) => p.rol === rol && p.id === `${rol}|${recurso}` && p.acciones.some((a) => a === accion),
    ),
  );
}
