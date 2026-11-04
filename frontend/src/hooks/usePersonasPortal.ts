import { useSyncExternalStore } from 'react';
import { estudiantes, docentes } from '../data/personas';
import { snapshotApi, suscribirApi } from '../services/apiTutoria';
import { API_MODE } from '../services/apiConfig';

/** Conserva referencias de cada respuesta para actualizar listas y filtros tras un alta. */
export function usePersonasPortal() {
  const { datos } = useSyncExternalStore(suscribirApi, snapshotApi, snapshotApi);
  return {
    estudiantes: API_MODE ? (datos?.estudiantes ?? []) : estudiantes,
    docentes: API_MODE ? (datos?.docentes ?? []) : docentes,
  };
}
