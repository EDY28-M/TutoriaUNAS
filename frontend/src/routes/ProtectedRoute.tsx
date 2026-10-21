import { Navigate, Outlet } from 'react-router-dom';
import type { Role } from '../types/auth';
import { useAuth } from '../hooks/useAuth';

// Presentation-only demo guards. They are not server security boundaries.
export function ProtectedRoute({ role }: { role?: Role }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/no-autorizado" replace />;
  return <Outlet />;
}
