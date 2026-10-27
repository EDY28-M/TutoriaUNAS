import { useMemo, useSyncExternalStore } from 'react';
import { leerProgramadas, SESSIONS_EVENT, SESSIONS_KEY } from '../services/sessionWorkspace';

function suscribir(cambio: () => void) {
  window.addEventListener(SESSIONS_EVENT, cambio);
  window.addEventListener('storage', cambio);
  return () => {
    window.removeEventListener(SESSIONS_EVENT, cambio);
    window.removeEventListener('storage', cambio);
  };
}
function snapshot() {
  try {
    return localStorage.getItem(SESSIONS_KEY);
  } catch {
    return null;
  }
}
export function useScheduledSessions() {
  const raw = useSyncExternalStore(suscribir, snapshot, () => null);
  return useMemo(() => leerProgramadas(raw), [raw]);
}
