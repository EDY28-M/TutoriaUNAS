import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { dashboardPath } from '../../utils/roles';

export function UnauthorizedPage() {
  const { user } = useAuth();
  return (
    <main id="main-content" className="error-page">
      <p className="eyebrow">Acceso no autorizado</p>
      <h1>Esta página pertenece a otro rol</h1>
      <p>La cuenta de demostración actual no tiene acceso a este portal.</p>
      <Link className="button button--primary" to={user ? dashboardPath(user.role) : '/login'}>
        Volver a mi portal
      </Link>
    </main>
  );
}
