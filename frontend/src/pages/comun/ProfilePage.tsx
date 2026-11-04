import { AccountProfile } from '../../components/panels/AccountProfile';
import { Alert } from '../../components/ui/Alert';
import { useAuth } from '../../hooks/useAuth';
import { usePortal } from '../../hooks/usePortal';

export function ProfilePage() {
  const { user } = useAuth();
  const portal = usePortal();
  if (!user)
    return (
      <Alert tone="riesgo" title="Sesión no disponible">
        Vuelve a iniciar sesión.
      </Alert>
    );
  return <AccountProfile user={user} portal={portal} />;
}
