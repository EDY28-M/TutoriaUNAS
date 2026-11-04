import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeading } from '../../components/ui/PageHeading';
import { FormsFilters } from '../../components/ui/FormsPanel';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/StatusBadge';
import { Sheet } from '../../components/ui/Sheet';
import { Alert } from '../../components/ui/Alert';
import { EmptyState } from '../../components/ui/EmptyState';
import { usePortal } from '../../hooks/usePortal';
import { useStudentNotices } from '../../hooks/useStudentNotices';
import type { MensajeEstudiante } from '../../hooks/useStudentNotices';
import { preferenciasAvisos } from '../../services/studentNoticesWorkspace';
import { formatFecha, formatFechaHora } from '../../utils/fechas';
import '../../assets/vendor/fontawesome.min.css';
import '../../styles/student-notices.css';

const categorias = {
  sesion: { titulo: 'Sesiones', icono: 'calendar-days', accion: 'Ver mis sesiones' },
  instrumento: { titulo: 'Formularios', icono: 'file-lines', accion: 'Ver mis formularios' },
  derivacion: { titulo: 'Apoyo', icono: 'hand-holding-heart', accion: 'Ver mis solicitudes' },
  academico: { titulo: 'Mis estudios', icono: 'graduation-cap', accion: 'Ver mis estudios' },
  sistema: { titulo: 'Bienestar', icono: 'heart-pulse', accion: 'Ver salud y bienestar' },
} as const;
type Filtro = 'todos' | 'sin-leer' | 'sistema' | 'correo';

export function StudentNotices() {
  const { estudiante } = usePortal();
  const { mensajes, sinLeer, preferencias, marcarLeidas, cambiarPreferencia } = useStudentNotices();
  const [abiertoId, setAbiertoId] = useState<string | null>(null);
  const [configurando, setConfigurando] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const filtros = useRef<HTMLDivElement>(null);
  const origenDetalle = useRef<HTMLButtonElement | null>(null);
  const abierto = mensajes.find((mensaje) => mensaje.id === abiertoId);
  const termino = busqueda.trim().toLocaleLowerCase('es-PE');
  const visibles = mensajes.filter(
    (mensaje) =>
      (filtro === 'todos' || (filtro === 'sin-leer' ? !mensaje.leida : mensaje.canal === filtro)) &&
      (!termino ||
        `${mensaje.titulo} ${mensaje.detalle} ${categorias[mensaje.tipo].titulo}`
          .toLocaleLowerCase('es-PE')
          .includes(termino)),
  );
  const correos = mensajes.filter((mensaje) => mensaje.canal === 'correo').length;

  async function guardar(accion: () => void | Promise<void>, texto: string) {
    try {
      await accion();
      setError('');
      setConfirmacion(texto);
    } catch (causa) {
      setConfirmacion('');
      setError(causa instanceof Error ? causa.message : 'No se pudo guardar. Inténtalo otra vez.');
    }
  }
  function abrir(mensaje: MensajeEstudiante, origen: HTMLButtonElement) {
    origenDetalle.current = origen;
    setAbiertoId(mensaje.id);
    if (!mensaje.leida) guardar(() => marcarLeidas([mensaje.id]), 'Aviso leído.');
  }
  function cerrar() {
    setAbiertoId(null);
    requestAnimationFrame(() => {
      const destino = origenDetalle.current?.isConnected
        ? origenDetalle.current
        : filtros.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
      destino?.focus();
    });
  }

  if (!estudiante) {
    return (
      <EmptyState
        title="Sin datos del estudiante"
        description="La cuenta no tiene expediente asociado."
      />
    );
  }

  return (
    <div className="student-notices forms-panel">
      <PageHeading
        className="forms-panel__header"
        eyebrow="Estudiante · Cuenta"
        title="Mis avisos"
        actions={
          <>
            <span className="forms-panel__pending">
              {sinLeer ? `${sinLeer} sin leer` : 'Todo al día'}
            </span>
            <button
              type="button"
              className="btn btn-falcon-default student-notices__settings"
              onClick={() => setConfigurando(true)}
            >
              <i className="fa-solid fa-sliders" aria-hidden="true" /> Preferencias
            </button>
          </>
        }
      />
      {error && !abierto && !configurando && (
        <Alert tone="riesgo" title="No se guardó el cambio">
          {error}
        </Alert>
      )}
      <p className="sr-only" role="status">
        {confirmacion}
      </p>

      <div ref={filtros}>
        <FormsFilters
          label="Filtrar avisos"
          options={[
            { id: 'todos', nombre: 'Todos', cantidad: mensajes.length },
            { id: 'sin-leer', nombre: 'Sin leer', cantidad: sinLeer },
            { id: 'sistema', nombre: 'Sistema', cantidad: mensajes.length - correos },
            { id: 'correo', nombre: 'Correo', cantidad: correos },
          ]}
          value={filtro}
          onChange={(valor) => setFiltro(valor as Filtro)}
          acciones={
            <label className="student-notices__search">
              <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
              <input
                type="search"
                aria-label="Buscar en mis avisos"
                placeholder="Buscar aviso"
                value={busqueda}
                onChange={(evento) => setBusqueda(evento.target.value)}
              />
            </label>
          }
        />
      </div>

      <Card className="student-notices__inbox">
        {visibles.length ? (
          <ul className="student-notices__messages" aria-label="Avisos recibidos">
            {visibles.map((mensaje) => {
              const categoria = categorias[mensaje.tipo];
              return (
                <li key={mensaje.id}>
                  <button
                    type="button"
                    className={`student-notices__message${mensaje.leida ? '' : ' student-notices__message--unread'}`}
                    aria-label={`${mensaje.leida ? 'Leído' : 'Sin leer'}: ${mensaje.titulo}`}
                    onClick={(evento) => abrir(mensaje, evento.currentTarget)}
                  >
                    <span className="student-notices__message-icon" aria-hidden="true">
                      <i
                        className={`fa-solid fa-${mensaje.canal === 'correo' ? 'envelope' : categoria.icono}`}
                      />
                    </span>
                    <span className="student-notices__message-body">
                      <strong>{mensaje.titulo}</strong>
                      <span>
                        {mensaje.canal === 'correo' ? 'Correo · Demo' : categoria.titulo}
                        <span aria-hidden="true"> · </span>
                        <time dateTime={mensaje.fecha}>{formatFecha(mensaje.fecha)}</time>
                      </span>
                    </span>
                    <span className="student-notices__message-end" aria-hidden="true">
                      {!mensaje.leida && <span className="student-notices__unread-dot" />}
                      <i className="fa-solid fa-arrow-right" />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            title={filtro === 'sin-leer' && !termino ? 'Todo al día' : 'Sin avisos'}
            icon={<i className="fa-regular fa-circle-check" aria-hidden="true" />}
            action={
              <button
                type="button"
                className="student-notices__text-button"
                onClick={() => {
                  setBusqueda('');
                  setFiltro('todos');
                }}
              >
                Ver todos
              </button>
            }
          />
        )}
      </Card>

      <footer className="student-notices__footer">
        <span role="status">
          {visibles.length} {visibles.length === 1 ? 'aviso' : 'avisos'}
        </span>
        <button
          type="button"
          className="student-notices__text-button"
          disabled={!sinLeer}
          onClick={() =>
            guardar(
              () => marcarLeidas(mensajes.map((mensaje) => mensaje.id)),
              'Todos los avisos leídos.',
            )
          }
        >
          <i className="fa-solid fa-check-double" aria-hidden="true" /> Marcar todos como leídos
        </button>
      </footer>

      {configurando && (
        <Sheet
          title="Preferencias de avisos"
          onClose={() => setConfigurando(false)}
          footer={
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setConfigurando(false)}
            >
              Listo
            </button>
          }
        >
          <div className="student-notices-detail">
            {error && (
              <Alert tone="riesgo" title="No se guardó el cambio">
                {error}
              </Alert>
            )}
            <fieldset className="student-notices__preference-list">
              <legend className="sr-only">Configurar avisos</legend>
              {preferenciasAvisos.map((preferencia) => (
                <label className="student-notices__preference" key={preferencia.id}>
                  <i className={`fa-solid fa-${preferencia.icono}`} aria-hidden="true" />
                  <span>{preferencia.titulo}</span>
                  <input
                    type="checkbox"
                    role="switch"
                    aria-label={preferencia.titulo}
                    checked={preferencias[preferencia.id]}
                    onChange={(evento) =>
                      guardar(
                        () => cambiarPreferencia(preferencia.id, evento.target.checked),
                        'Preferencia guardada.',
                      )
                    }
                  />
                </label>
              ))}
            </fieldset>
            <p className="student-notices__local-note">
              Guardado en este navegador. Correo por habilitar.
            </p>
          </div>
        </Sheet>
      )}

      {abierto && (
        <Sheet
          title={abierto.titulo}
          description={formatFechaHora(abierto.fecha)}
          onClose={cerrar}
          footer={
            <>
              <button
                type="button"
                className="btn btn-falcon-default"
                onClick={() =>
                  guardar(
                    () => marcarLeidas([abierto.id], !abierto.leida),
                    abierto.leida ? 'Aviso marcado como no leído.' : 'Aviso leído.',
                  )
                }
              >
                {abierto.leida ? 'Marcar como no leído' : 'Marcar como leído'}
              </button>
              {abierto.enlace && (
                <Link className="btn btn-primary" to={abierto.enlace}>
                  {abierto.canal === 'correo'
                    ? 'Ver mis sesiones'
                    : categorias[abierto.tipo].accion}{' '}
                  <i className="fa-solid fa-arrow-right" aria-hidden="true" />
                </Link>
              )}
            </>
          }
        >
          <div className="student-notices-detail stack">
            {error && (
              <Alert tone="riesgo" title="No se guardó el cambio">
                {error}
              </Alert>
            )}
            <div className="ui-row ui-row--wrap">
              <Badge>
                {abierto.canal === 'correo'
                  ? 'Correo de demostración'
                  : categorias[abierto.tipo].titulo}
              </Badge>
              <Badge tone="ok">{abierto.leida ? 'Leído' : 'Sin leer'}</Badge>
            </div>
            <p>{abierto.detalle}</p>
            {abierto.aviso && (
              <p className="student-notices__local-note">
                Para: {estudiante.correo}
                <br />
                Correo simulado.
              </p>
            )}
          </div>
        </Sheet>
      )}
    </div>
  );
}
