import { useDeferredValue, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sheet } from '../ui/Sheet';
import { Alert } from '../ui/Alert';
import { apiJson } from '../../services/apiClient';
import { refrescarApi } from '../../services/apiTutoria';
import type { CandidatoCuenta, CuentaCreada } from '../../services/cuentas';
import type { Role } from '../../types/auth';

const perfiles: Record<Role, string> = {
  estudiante: 'Estudiante',
  tutor: 'Docente',
  coordinacion: 'Coordinación',
};

export function CrearCuenta({ onClose, rolInicial }: { onClose(): void; rolInicial?: Role }) {
  const queryClient = useQueryClient();
  const [origen, setOrigen] = useState('nueva');

  const [rol, setRol] = useState<Role>(rolInicial ?? 'estudiante');
  const [buscar, setBuscar] = useState('');
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
    queryKey: ['cuenta-candidatos', rol, texto],
    queryFn: () =>
      apiJson<CandidatoCuenta[]>(
        `/api/cuentas/candidatos?${new URLSearchParams({ rol, buscar: texto })}`,
      ),
    enabled: origen === 'padron' && texto.trim().length >= 2 && persona === null,
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
    if (ocupado || (origen === 'padron' && !persona)) return;
    setOcupado(true);
    setError('');
    try {
      const resultado = await apiJson<CuentaCreada>('/api/cuentas', 'POST', {
        rol,
        correo,
        nombres,
        apellidos,
        personaId: persona?.id,
        codigo: codigo || undefined,
        ciclo: ciclo ? Number(ciclo) : null,
      });
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
          className="stack"
          aria-busy={ocupado}
          onSubmit={(e) => {
            e.preventDefault();
            void guardar();
          }}
        >
          <label>
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
          <label>
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
              <option value="nueva">Nueva persona (fuera del padrón)</option>
              <option value="padron">Persona del padrón</option>
            </select>
          </label>
          {origen === 'nueva' && (
            <p className="small muted">
              Registra sus nombres, apellidos y correo institucional. No necesita figurar en el
              Excel.
            </p>
          )}
          {origen === 'padron' && (
            <>
              <label>
                Buscar en el padrón
                <input
                  className="form-control"
                  type="search"
                  maxLength={150}
                  disabled={ocupado}
                  value={buscar}
                  onChange={(e) => {
                    limpiarDatos();
                    setBuscar(e.target.value);
                  }}
                  placeholder="Nombre o correo institucional"
                />
              </label>
              {persona && <p role="status">Persona seleccionada: {persona.nombre}</p>}
              {!persona && texto.trim().length >= 2 && (
                <div>
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
                    <p className="small muted">
                      Sin coincidencias. Para registrar a alguien fuera del padrón, selecciona Nueva
                      persona.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
          {(origen === 'nueva' || persona) && (
            <>
              <label>
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
              <div className="grid grid--2">
                <label>
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
                <label>
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
                <div className="grid grid--2">
                  <label>
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
                    <label>
                      Ciclo, si está confirmado
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
          <p className="small muted">
            El perfil se habilita en tu escuela. Se generará una contraseña temporal y se enviará al
            correo institucional.
          </p>
          {error && (
            <Alert tone="riesgo" title="No se creó la cuenta">
              {error}
            </Alert>
          )}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={ocupado || (origen === 'padron' && !persona)}
          >
            {ocupado ? 'Creando cuenta…' : 'Crear cuenta y enviar acceso'}
          </button>
        </form>
      )}
    </Sheet>
  );
}
