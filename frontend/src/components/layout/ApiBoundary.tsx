import { useEffect, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { refrescarApi, snapshotApi, suscribirApi } from '../../services/apiTutoria';
import { API_MODE } from '../../services/apiConfig';
import { Alert } from '../ui/Alert';
import { PageLoading } from '../ui/PageLoading';

export function ApiBoundary({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const estado = useSyncExternalStore(suscribirApi, snapshotApi, snapshotApi);
  useEffect(() => {
    if (!API_MODE || !user) return;
    const cargar = () => {
      void refrescarApi().catch(() => undefined);
    };
    if (!snapshotApi().datos) cargar();
    const timer = window.setInterval(cargar, 10_000);
    window.addEventListener('focus', cargar);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', cargar);
    };
  }, [user]);
  if (!API_MODE) return children;
  if (!estado.datos)
    return estado.error ? (
      <Alert tone="riesgo" title="No se pudo cargar la tutoría">
        <span className="d-block">{estado.error}</span>
        <button
          className="btn btn-primary"
          onClick={() => {
            void refrescarApi().catch(() => undefined);
          }}
        >
          Reintentar
        </button>
      </Alert>
    ) : (
      <PageLoading />
    );
  return (
    <>
      {estado.error && (
        <Alert tone="alerta" title="No se pudo actualizar la información">
          {estado.error} Los cambios requieren conexión con el servidor.
        </Alert>
      )}
      {children}
    </>
  );
}
