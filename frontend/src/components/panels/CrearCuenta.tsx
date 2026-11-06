import { useDeferredValue, useId, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sheet } from '../ui/Sheet';
import { Alert } from '../ui/Alert';
import { apiJson, rutaEscuela } from '../../services/apiClient';
import { refrescarApi } from '../../services/apiTutoria';
import { useSistema } from '../../hooks/useSistema';
import { EscuelaGestion } from '../ui/EscuelaGestion';
import type { CandidatoCuenta, CuentaCreada } from '../../services/cuentas';
import type { Role } from '../../types/auth';
import '../../styles/coord-modals.css';

const perfiles: Record<Role, string> = {
  estudiante: 'Estudiante',
  tutor: 'Docente',
  coordinacion: 'Coordinación',
};

export function CrearCuenta({ onClose, rolInicial }: { onClose(): void; rolInicial?: Role }) {
  const queryClient = useQueryClient();
  const formId = useId();
  const [origen, setOrigen] = useState('nueva');
  const escuelasGestion = useSistema()?.periodosEscuela?.map((p) => p.escuelaId) ?? [];
  const [escuela, setEscuela] = useState('');
  const faltaEscuela = escuelasGestion.length > 0 && !escuela;

  const [rol, setRol] = useState<Role>(rolInicial ?? 'estudiante');
  const [buscar, setBuscar] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [persona, setPersona] = useState<CandidatoCuenta | null>(null);
  const [correo, setCorreo] = useState('');
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [codigo, setCodigo] = useState('');
  const [ciclo, setCiclo] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [creada, setCreada] = useState<CuentaCreada | null>(null);
  const [copiado, setCopiado] = useState(false);
  const texto = useDeferredValue(buscar);
  const candidatos = useQuery({
    queryKey: ['cuenta-candidatos', escuela, rol, texto],
    queryFn: () => {
      const path = `/api/cuentas/candidatos?${new URLSearchParams({ rol, buscar: texto })}`;
      return apiJson<CandidatoCuenta[]>(escuela ? rutaEscuela(path, escuela) : path);
    },
    enabled: !faltaEscuela && origen === 'padron' && texto.trim().length >= 2 && persona === null,
  });
  function limpiarDatos() {
    setPersona(null);
    setBuscar('');
    setCorreo('');
    setNombres('');
    setApellidos('');
    setCodigo('');
    setCiclo('');
    setError('');
  }
  function elegir(p: CandidatoCuenta) {
    setPersona(p);
    setCorreo(p.correo);
    setNombres(p.nombres);
    setApellidos(p.apellidos);
    setCiclo(p.ciclo === null ? '' : String(p.ciclo));
  }
  async function guardar() {
    if (ocupado || faltaEscuela || (origen === 'padron' && !persona)) return;
    setOcupado(true);
    setError('');
    try {
      const resultado = await apiJson<CuentaCreada>(
        escuela ? rutaEscuela('/api/cuentas', escuela) : '/api/cuentas',
        'POST',
        {
          rol,
          correo,
          nombres,
          apellidos,
          personaId: persona?.id,
          codigo: codigo || undefined,
          ciclo: ciclo ? Number(ciclo) : null,
        },
      );
      setCreada(resultado);
      try {
        await queryClient.invalidateQueries({ queryKey: ['cuentas-administracion'] });
        await refrescarApi();
      } catch {
        setError(
          'La cuenta está creada. No se pudo actualizar la lista; recarga la página para verla.',
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la cuenta.');
    } finally {
      setOcupado(false);
    }
  }
  return (
    <Sheet
      className="coord-form-sheet"
      title={
        creada
          ? 'Cuenta creada'
          : rolInicial === 'estudiante'
            ? 'Crear estudiante'
            : rolInicial === 'tutor'
              ? 'Crear docente'
              : 'Crear cuenta'
      }
      onClose={onClose}
      footer={
        !creada ? (
          <>
            <button type="button" className="btn btn-link" onClick={onClose} disabled={ocupado}>
              Cancelar
            </button>
            <button
              type="submit"
              form={formId}
              className="btn btn-primary"
              disabled={ocupado || faltaEscuela || (origen === 'padron' && !persona)}
            >
              {ocupado ? 'Creando cuenta…' : 'Crear cuenta'}
            </button>
          </>
        ) : undefined
      }
    >
      {creada ? (
        <div className="stack">
          <p role="status">
            La cuenta se creó y el acceso temporal quedó en la cola de correo. Vence en 48 horas.
          </p>
          <dl className="def-list">
            <div>
              <dt>Usuario</dt>
              <dd>{creada.identifier}</dd>
            </div>
            <div>
              <dt>Perfil</dt>
              <dd>{perfiles[rol]}</dd>
            </div>
          </dl>
          <label>
            Contraseña temporal
            <input
              className="form-control mono"
              readOnly
              type="text"
              value={creada.passwordTemporal}
            />
          </label>
          <button
            type="button"
            className="btn btn-falcon-default"
            onClick={() =>
              void navigator.clipboard
                .writeText(creada.passwordTemporal)
                .then(() => setCopiado(true))
                .catch(() => setError('Selecciona la contraseña y cópiala manualmente.'))
            }
          >
            {copiado ? 'Copiada' : 'Copiar contraseña temporal'}
          </button>
          <p className="small muted">
            Se muestra una sola vez. La persona deberá verificar su correo y establecer una
            contraseña personal antes de acceder al portal.
          </p>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Cerrar
          </button>
          {error && <p role="alert">{error}</p>}
        </div>
      ) : (
        <form
          id={formId}
          className="coord-account-form"
          aria-busy={ocupado}
          onSubmit={(e) => {
            e.preventDefault();
            void guardar();
          }}
        >
          {escuelasGestion.length > 0 && (
            <EscuelaGestion
              ids={escuelasGestion}
              value={escuela}
              disabled={ocupado}
              onChange={(id) => {
                setEscuela(id);
                limpiarDatos();
              }}
            />
          )}
          <div className="coord-modal-grid">
            <label className="field">
              Perfil
              <select
                className="form-select"
                value={rol}
                disabled={ocupado}
                onChange={(e) => {
                  setRol(e.target.value as Role);
                  limpiarDatos();
                }}
              >
                <option value="estudiante">Estudiante</option>
                <option value="tutor">Docente</option>
                <option value="coordinacion">Coordinación</option>
              </select>
            </label>
            <label className="field">
              Origen de los datos
              <select
                className="form-select"
                value={origen}
                disabled={ocupado}
                onChange={(e) => {
                  setOrigen(e.target.value);
                  limpiarDatos();
                }}
              >
                <option value="nueva">Nueva persona</option>
                <option value="padron">Persona del padrón</option>
              </select>
            </label>
          </div>
          {origen === 'padron' && (
            <div
              className="coord-account-search"
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setBuscando(false);
              }}
            >
              <label className="field">
                Buscar en el padrón
                <input
                  className="form-control"
                  type="search"
                  maxLength={150}
                  disabled={ocupado}
                  value={buscar}
                  onFocus={() => setBuscando(true)}
                  onChange={(e) => {
                    limpiarDatos();
                    setBuscar(e.target.value);
                  }}
                  placeholder="Nombre o correo institucional"
                />
              </label>
              {persona && <p role="status">Persona seleccionada: {persona.nombre}</p>}
              {buscando && !persona && texto.trim().length >= 2 && (
                <div className="coord-account-search__results">
                  {candidatos.isPending ? (
                    <p role="status">Buscando…</p>
                  ) : candidatos.isError ? (
                    <p role="alert">No se pudo consultar el padrón. Inténtalo nuevamente.</p>
                  ) : candidatos.data?.length ? (
                    <ul className="list">
                      {candidatos.data.map((p) => (
                        <li key={p.id}>
                          <button type="button" className="btn btn-link" onClick={() => elegir(p)}>
                            {p.nombre} · {p.correo}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="small muted">Sin coincidencias. Prueba otro nombre o correo.</p>
                  )}
                </div>
              )}
            </div>
          )}
          {(origen === 'nueva' || persona) && (
            <>
              <label className="field">
                Correo institucional
                <input
                  className="form-control"
                  type="email"
                  maxLength={254}
                  required
                  readOnly={persona !== null}
                  disabled={ocupado}
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  placeholder="nombre@unas.edu.pe"
                />
              </label>
              <div className="coord-modal-grid">
                <label className="field">
                  Nombres
                  <input
                    className="form-control"
                    maxLength={150}
                    required
                    readOnly={persona !== null}
                    disabled={ocupado}
                    value={nombres}
                    onChange={(e) => setNombres(e.target.value)}
                  />
                </label>
                <label className="field">
                  Apellidos
                  <input
                    className="form-control"
                    maxLength={150}
                    required
                    readOnly={persona !== null}
                    disabled={ocupado}
                    value={apellidos}
                    onChange={(e) => setApellidos(e.target.value)}
                  />
                </label>
              </div>
              {!persona && (
                <div className="coord-modal-grid">
                  <label className="field">
                    {rol === 'estudiante' ? 'Código de alumno' : 'Código de docente'} (opcional)
                    <input
                      className="form-control"
                      maxLength={40}
                      disabled={ocupado}
                      value={codigo}
                      onChange={(e) => setCodigo(e.target.value)}
                    />
                  </label>
                  {rol === 'estudiante' && (
                    <label className="field">
                      Ciclo (opcional)
                      <input
                        className="form-control"
                        type="number"
                        min={1}
                        max={10}
                        disabled={ocupado}
                        value={ciclo}
                        onChange={(e) => setCiclo(e.target.value)}
                      />
                    </label>
                  )}
                </div>
              )}
            </>
          )}
          <p className="small muted">Se enviará un acceso temporal al correo institucional.</p>
          {error && (
            <Alert tone="riesgo" title="No se creó la cuenta">
              {error}
            </Alert>
          )}
        </form>
      )}
    </Sheet>
  );
}
