import { useSyncExternalStore } from 'react';
import { obtenerWorkspace, suscribirWorkspace } from '../services/instrumentWorkspace';
import { API_MODE } from '../services/apiConfig';
import { suscribirApi, workspaceApi } from '../services/apiTutoria';

/** Estado compartido por los portales; el modo API recibe exclusivamente el ámbito del servidor. */
export function useInstrumentWorkspace() {
  return useSyncExternalStore(
    API_MODE ? suscribirApi : suscribirWorkspace,
    API_MODE ? workspaceApi : obtenerWorkspace,
    API_MODE ? workspaceApi : obtenerWorkspace,
  );
}
