import { Fragment, useEffect, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import {
  aplicarEstadoApi,
  refrescarApi,
  snapshotApi,
  suscribirApi,
} from '../../services/apiTutoria';
import type { EstadoApi } from '../../services/apiTutoria';
import { API_MODE } from '../../services/apiConfig';
import { apiJson, rutaEscuela, seleccionarEscuelaApi } from '../../services/apiClient';
import { escuelaDe } from '../../data/personas';
import { Alert } from '../ui/Alert';
import { PageLoading } from '../ui/PageLoading';
import '../../styles/admin-school-scope.css';

export function ApiBoundary({
  children,
  scopeHost,
}: {
  children: ReactNode;
  scopeHost: HTMLDivElement | null;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const estado = useSyncExternalStore(suscribirApi, snapshotApi, snapshotApi);
  const [cambiandoEscuela, setCambiandoEscuela] = useState<string | null>(null);
  const [errorEscuela, setErrorEscuela] = useState('');
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
  const { escuelaId, consultaInstitucional, escuelasAdministrables = [] } = estado.datos;
  const seleccion = consultaInstitucional ? '' : escuelaId;
  const escuelas = escuelasAdministrables
    .map((id) => ({ id, nombre: escuelaDe(id) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  async function cambiarEscuela(id: string) {
    setCambiandoEscuela(id);
    setErrorEscuela('');
    try {
      const datos = await apiJson<EstadoApi>(
        id
          ? rutaEscuela('/api/tutoria/estado', id)
          : '/api/tutoria/estado?ambitoInstitucional=true',
      );
      seleccionarEscuelaApi(id || undefined);
      queryClient.clear();
      aplicarEstadoApi(datos);
    } catch (error) {
      setErrorEscuela(error instanceof Error ? error.message : 'No se pudo cambiar de escuela.');
    } finally {
      setCambiandoEscuela(null);
    }
  }
  return (
    <>
      {escuelas.length > 0 &&
        scopeHost &&
        createPortal(
          <div className="admin-school-scope">
            <label>
              <span className="admin-school-scope__label">Escuela</span>
              <select
                className="select"
                aria-label="Escuela de administración"
                title={seleccion ? escuelaDe(seleccion) : 'Todas las escuelas'}
                value={cambiandoEscuela ?? seleccion}
                disabled={cambiandoEscuela !== null}
                onChange={(event) => void cambiarEscuela(event.target.value)}
              >
                <option value="">Todas las escuelas</option>
                {escuelas.map(({ id, nombre }) => (
                  <option key={id} value={id}>
                    {nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>,
          scopeHost,
        )}
      {errorEscuela && <Alert tone="alerta">{errorEscuela}</Alert>}
      {estado.error && (
        <Alert tone="alerta" title="No se pudo actualizar la información">
          {estado.error} Los cambios requieren conexión con el servidor.
        </Alert>
      )}
      {cambiandoEscuela !== null ? (
        <PageLoading />
      ) : (
        <Fragment key={seleccion}>{children}</Fragment>
      )}
    </>
  );
}
