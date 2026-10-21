import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { dashboardPath } from '../../utils/roles';

export function NotFoundPage() {
  const { user } = useAuth();
  return (
    <main id="main-content" className="error-page">
      <p className="eyebrow">Error 404</p>
      <h1>No encontramos esta página</h1>
      <p>Verifica la dirección o regresa al inicio.</p>
      <Link className="button button--primary" to={user ? dashboardPath(user.role) : '/login'}>
        Volver al inicio
      </Link>
    </main>
  );
}
