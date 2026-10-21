import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

/** Compatibilidad de enlaces anteriores: el único módulo vigente es Sesiones. */
export function TeacherCalendarPage() {
  const { user } = useAuth();
  return <Navigate to={user ? `/${user.role}/sesiones` : '/login'} replace />;
}
