import { useSyncExternalStore } from 'react';
import { snapshotApi, suscribirApi } from '../services/apiTutoria';

export function useSistema() {
  return useSyncExternalStore(suscribirApi, snapshotApi, snapshotApi).datos?.sistema ?? null;
}
