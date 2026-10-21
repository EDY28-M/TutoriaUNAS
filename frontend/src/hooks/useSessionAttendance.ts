import { useMemo, useSyncExternalStore } from 'react';
import { ATTENDANCE_EVENT, ATTENDANCE_KEY, leerRegistros } from '../services/sessionAttendance';

function subscribe(change: () => void) {
  window.addEventListener(ATTENDANCE_EVENT, change);
  window.addEventListener('storage', change);
  return () => {
    window.removeEventListener(ATTENDANCE_EVENT, change);
    window.removeEventListener('storage', change);
  };
}
function snapshot() {
  try {
    return window.localStorage.getItem(ATTENDANCE_KEY);
  } catch {
    return null;
  }
}
export function useSessionAttendance() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  return useMemo(() => leerRegistros(raw), [raw]);
}
