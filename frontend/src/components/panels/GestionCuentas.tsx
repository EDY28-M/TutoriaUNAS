import { DirectorySearch } from '../ui/DirectoryToolbar';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardBody, CardHead } from '../ui/Card';
import { Sheet } from '../ui/Sheet';
import { Alert } from '../ui/Alert';
import { Badge } from '../ui/StatusBadge';
import { DataTable, type Column } from '../ui/DataTable';
import { apiJson } from '../../services/apiClient';
import { refrescarApi } from '../../services/apiTutoria';
import type { CuentaAdmin, CuentaCreada } from '../../services/cuentas';
import { usePermiso } from '../../hooks/usePermiso';
import type { Role } from '../../types/auth';
import { normalizar } from '../../utils/busqueda';
import { CrearCuenta } from './CrearCuenta';

const perfiles: Record<Role, string> = {
  estudiante: 'Estudiante',
  tutor: 'Docente',
  coordinacion: 'Coordinación',
};
export function GestionCuentas() {
  const queryClient = useQueryClient();
  const consulta = useQuery({
    queryKey: ['cuentas-administracion'],
    queryFn: () => apiJson<CuentaAdmin[]>('/api/cuentas'),
  });
  const [buscar, setBuscar] = useState('');
  const [crear, setCrear] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [renovada, setRenovada] = useState<CuentaCreada | null>(null);
  const puedeCrear = usePermiso('cuentas', 'crear');
  async function actualizar() {
    await queryClient.invalidateQueries({ queryKey: ['cuentas-administracion'] });
    await refrescarApi();
  }
  async function accion(cuenta: CuentaAdmin, vincular = false) {
    setOcupado(true);
    setError('');
    setMensaje('');
    try {
      await apiJson(
        `/api/cuentas/${encodeURIComponent(cuenta.id)}/${vincular ? 'vinculacion' : 'estado'}`,
        'PUT',
        { version: cuenta.version, activo: !cuenta.activo },
      );
      await actualizar();
      setMensaje(vincular ? 'Cuenta vinculada a tu escuela.' : 'Acceso actualizado.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar la cuenta.');
    } finally {
      setOcupado(false);
    }
  }
  async function renovar(c: CuentaAdmin) {
    setOcupado(true);
    setError('');
    try {
      const result = await apiJson<CuentaCreada>(
        `/api/cuentas/${encodeURIComponent(c.id)}/temporal`,
        'POST',
        { version: c.version },
      );
      setRenovada(result);
      await actualizar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo renovar el acceso.');
    } finally {
      setOcupado(false);
    }
  }
  const columnas: Column<CuentaAdmin>[] = [
    {
      key: 'cuenta',
      header: 'Cuenta',
      render: (c) => (
        <span className="person-cell__text">
          <strong>{c.nombre}</strong>
          <small>{c.correo}</small>
        </span>
      ),
    },
    { key: 'perfil', header: 'Perfil', render: (c) => perfiles[c.rol] },
    {
      key: 'verificacion',
      header: 'Verificación',
      render: (c) => (
        <Badge tone={c.verificada ? 'ok' : c.verificada === false ? 'alerta' : 'neutro'}>
          {c.verificada === null
            ? 'Cuenta de prueba'
            : c.verificada
              ? 'Verificada'
              : 'Pendiente de verificar'}
        </Badge>
      ),
    },
    {
      key: 'estado',
      header: 'Acceso',
      render: (c) =>
        c.pendienteVinculacion ? 'Escuela pendiente' : c.activo ? 'Habilitada' : 'Deshabilitada',
    },
    {
      key: 'correo',
      header: 'Último correo',
      render: (c) =>
        ({
          enviado: 'Enviado al proveedor',
          pendiente: 'En cola',
          'no-entregado': 'No entregado',
          'sin-envio': '—',
        })[c.correoEstado] ?? '—',
    },
    {
      key: 'accion',
      header: 'Acción',
      render: (c) =>
        c.propia ? (
          <span className="small muted">Tu cuenta</span>
        ) : (
          <div className="stack stack--sm">
            <button
              className="btn btn-falcon-default btn-sm"
              type="button"
              disabled={ocupado}
              onClick={() => void accion(c, c.pendienteVinculacion)}
            >
              {c.pendienteVinculacion
                ? 'Vincular a mi escuela'
                : c.activo
                  ? 'Deshabilitar'
                  : 'Habilitar'}{' '}
              · {c.identifier}
            </button>
            {c.verificada === false && c.activo && (
              <button
                type="button"
                className="btn btn-link btn-sm"
                disabled={ocupado}
                onClick={() => void renovar(c)}
              >
                Renovar acceso temporal
              </button>
            )}
          </div>
        ),
    },
  ];
  const filas =
    consulta.data?.filter((c) =>
      normalizar(`${c.nombre} ${c.correo} ${perfiles[c.rol]}`).includes(normalizar(buscar)),
    ) ?? [];
  return (
    <>
      <Card>
        <CardHead
          title="Cuentas de acceso"
          actions={
            puedeCrear && (
              <button type="button" className="btn btn-primary" onClick={() => setCrear(true)}>
                <i className="fa-solid fa-user-plus" aria-hidden="true" /> Crear cuenta
              </button>
            )
          }
        />
        <CardBody>
          <DirectorySearch value={buscar} onChange={setBuscar} label="Buscar cuenta" />
          {consulta.isPending ? (
            <p role="status">Cargando cuentas…</p>
          ) : consulta.isError ? (
            <Alert tone="riesgo" title="No se pudieron cargar las cuentas">
              <p>{consulta.error.message}</p>
              <button
                type="button"
                className="btn btn-falcon-default"
                onClick={() => void consulta.refetch()}
              >
                Reintentar
              </button>
            </Alert>
          ) : (
            <DataTable
              rows={filas}
              columns={columnas}
              rowKey={(c) => c.id}
              caption="Cuentas y perfiles de acceso"
              emptyTitle="Sin cuentas coincidentes"
            />
          )}
          {error && (
            <Alert tone="riesgo" title="No se cambió el acceso">
              {error}
            </Alert>
          )}
          {mensaje && <p role="status">{mensaje}</p>}
        </CardBody>
      </Card>
      {crear && <CrearCuenta onClose={() => setCrear(false)} />}
      {renovada && (
        <Sheet title="Acceso temporal renovado" onClose={() => setRenovada(null)}>
          <div className="stack">
            <p>Usuario: {renovada.identifier}</p>
            <label>
              Nueva contraseña temporal
              <input className="form-control mono" readOnly value={renovada.passwordTemporal} />
            </label>
            <p>
              La clave anterior dejó de funcionar. El nuevo acceso vence en 48 horas y quedó en la
              cola de correo.
            </p>
          </div>
        </Sheet>
      )}
    </>
  );
}
