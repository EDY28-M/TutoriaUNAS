import { useSyncExternalStore } from 'react';
import { obtenerWorkspace, suscribirWorkspace } from '../services/instrumentWorkspace';

/** Estado compartido por los portales. Solo datos ficticios y persistencia de esta pestaña. */
export function useInstrumentWorkspace() {
  return useSyncExternalStore(suscribirWorkspace, obtenerWorkspace, obtenerWorkspace);
}
