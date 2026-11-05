import { DirectorySearch } from '../../components/ui/DirectoryToolbar';
import { useState } from 'react';
import { RedactorAviso } from '../../components/panels/RedactorAviso';
import { CompactPage, SecondaryPanel } from '../../components/ui/CompactPage';
import { FormsFilters } from '../../components/ui/FormsPanel';
import { PageHeading } from '../../components/ui/PageHeading';
import { Card } from '../../components/ui/Card';
import { Sheet } from '../../components/ui/Sheet';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Alert } from '../../components/ui/Alert';
import { EmptyState } from '../../components/ui/EmptyState';
import { useSistema } from '../../hooks/useSistema';
import { useAccionPersistente } from '../../hooks/useAccionPersistente';
import { marcarAvisosApi } from '../../services/apiSistema';
import { API_MODE } from '../../services/apiConfig';
import { avisos } from '../../data/institucional';
import { normalizar } from '../../utils/busqueda';
import { formatFecha, formatFechaHora } from '../../utils/fechas';
import type { Aviso } from '../../types/domain';
import type { MensajePersistido } from '../../types/sistema';

export function CoordNotices() {
  const sistema = useSistema();
  const accion = useAccionPersistente();
  const [demo, setDemo] = useState<Aviso[]>(() => [...avisos]);
  const [filtro, setFiltro] = useState('todos');
  const [buscar, setBuscar] = useState('');
  const [abierto, setAbierto] = useState<Aviso | null>(null);
  const [redactar, setRedactar] = useState(false);
  const [editar, setEditar] = useState<MensajePersistido | undefined>();
  const [copiar, setCopiar] = useState(false);
  const [recibidos, setRecibidos] = useState(false);
  const bandeja = API_MODE ? (sistema?.mensajes ?? []) : demo;
  const filtros = [
    { id: 'todos', nombre: 'Todos' },
    { id: 'borrador', nombre: 'Borradores' },
    { id: 'programado', nombre: 'Programados' },
    { id: 'enviado', nombre: 'Enviados' },
    ...(bandeja.some((a) => a.estado === 'fallido')
      ? [{ id: 'fallido', nombre: 'Con error' }]
      : []),
  ];
  const visibles = bandeja.filter(
    (a) =>
      (filtro === 'todos' || a.estado === filtro) &&
      normalizar(`${a.asunto} ${a.cuerpo} ${a.destinatarios.join(' ')}`).includes(
        normalizar(buscar),
      ),
  );
  const sinLeer = sistema?.notificaciones.filter((n) => !n.leida).length ?? 0;
  function abrir(a: Aviso) {
    if (API_MODE && 'editable' in a && a.editable) {
      setEditar(a as MensajePersistido);
      setCopiar(false);
      setRedactar(true);
    } else setAbierto(a);
  }
  return (
    <CompactPage>
      <PageHeading
        eyebrow="Coordinación"
        title="Avisos"
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditar(undefined);
              setCopiar(false);
              setRedactar(true);
            }}
          >
            <i className="fa-solid fa-plus" aria-hidden="true" /> Redactar aviso
          </button>
        }
      />
      {accion.error && !recibidos && !abierto && (
        <Alert tone="riesgo" title="No se actualizó la lectura">
          {accion.error}
        </Alert>
      )}
      <FormsFilters
        label="Filtrar avisos"
        options={filtros.map((f) => ({
          ...f,
          cantidad: bandeja.filter((a) => f.id === 'todos' || a.estado === f.id).length,
        }))}
        value={filtro}
        onChange={setFiltro}
        acciones={<DirectorySearch value={buscar} onChange={setBuscar} label="Buscar aviso" />}
      />
      <Card>
        {visibles.length ? (
          <ul className="compact-list" aria-label="Bandeja de avisos">
            {visibles.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  className="compact-list__row"
                  aria-label={`${a.asunto} · ${a.estado}`}
                  onClick={() => abrir(a)}
                >
                  <span className="compact-code">
                    <i
                      className={`fa-${a.canal === 'correo' ? 'regular fa-envelope' : 'solid fa-bullhorn'}`}
                      aria-hidden="true"
                    />
                  </span>
                  <span className="compact-list__body">
                    <strong>{a.asunto}</strong>
                    <small>
                      {formatFecha(a.enviado)} · {a.destinatarios.length} destinatarios
                    </small>
                  </span>
                  <span className="compact-list__end">
                    <StatusBadge estado={a.estado} />
                    <i className="fa-solid fa-chevron-right" aria-hidden="true" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="Sin avisos"
            description={buscar ? 'Prueba otra búsqueda.' : 'Los mensajes aparecerán aquí.'}
          />
        )}
      </Card>
      <div className="compact-toolbar">
        {API_MODE && (
          <button
            type="button"
            className="btn btn-falcon-default"
            onClick={() => setRecibidos(true)}
          >
            Recibidos {sinLeer > 0 ? `· ${sinLeer} sin leer` : ''}
          </button>
        )}
        <SecondaryPanel title="Canales de envío" wide={false}>
          <dl className="compact-detail-list">
            <div>
              <dt>Avisos internos</dt>
              <dd>
                {API_MODE
                  ? 'Publicación inmediata o programada dentro del sistema.'
                  : 'Mensajes de demostración.'}
              </dd>
            </div>
            <div>
              <dt>Correo externo</dt>
              <dd>Pendiente de habilitación institucional.</dd>
            </div>
          </dl>
        </SecondaryPanel>
      </div>
      {redactar && API_MODE && (
        <RedactorAviso
          key={editar?.id ?? 'nuevo'}
          aviso={editar}
          copiar={copiar}
          onCerrar={() => setRedactar(false)}
        />
      )}
      {redactar && !API_MODE && (
        <Sheet title="Redactar aviso" onClose={() => setRedactar(false)}>
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              const datos = new FormData(e.currentTarget);
              setDemo((d) => [
                {
                  id: `DEMO-${Date.now()}`,
                  asunto: String(datos.get('asunto')),
                  cuerpo: String(datos.get('cuerpo')),
                  destinatarios: String(datos.get('destinatarios'))
                    .split(',')
                    .map((s) => s.trim()),
                  canal: 'sistema',
                  estado: 'borrador',
                  enviado: new Date().toISOString(),
                  plantilla: 'redaccion-libre',
                  relacionadoCon: null,
                },
                ...d,
              ]);
              setRedactar(false);
            }}
          >
            <p className="compact-note">Borrador de demostración en esta vista.</p>
            <label className="field">
              Destinatarios
              <input className="input" name="destinatarios" required />
            </label>
            <label className="field">
              Asunto
              <input className="input" name="asunto" required />
            </label>
            <label className="field">
              Mensaje
              <textarea className="textarea" name="cuerpo" required />
            </label>
            <button className="btn btn-primary" type="submit">
              Guardar borrador
            </button>
          </form>
        </Sheet>
      )}
      {abierto && (
        <Sheet title={abierto.asunto} onClose={() => setAbierto(null)}>
          <div className="stack">
            {accion.error && (
              <Alert tone="riesgo" title="No se actualizó la lectura">
                {accion.error}
              </Alert>
            )}
            <div className="ui-row ui-row--wrap">
              <StatusBadge estado={abierto.estado} />
              <span className="compact-note">{formatFechaHora(abierto.enviado)}</span>
            </div>
            <p style={{ whiteSpace: 'pre-wrap' }}>{abierto.cuerpo}</p>
            <details>
              <summary>Destinatarios · {abierto.destinatarios.length}</summary>
              <ul>
                {abierto.destinatarios.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </details>
            {API_MODE && (
              <button
                type="button"
                className="btn btn-falcon-default"
                onClick={() => {
                  setEditar(abierto as MensajePersistido);
                  setCopiar(true);
                  setAbierto(null);
                  setRedactar(true);
                }}
              >
                Crear aviso a partir de este
              </button>
            )}
          </div>
        </Sheet>
      )}
      {recibidos && (
        <Sheet title="Avisos recibidos" onClose={() => setRecibidos(false)}>
          <div className="stack">
            {accion.error && (
              <Alert tone="riesgo" title="No se actualizó la lectura">
                {accion.error}
              </Alert>
            )}
            <button
              type="button"
              className="btn btn-falcon-default"
              disabled={accion.ocupado || !sinLeer}
              onClick={() =>
                void accion.ejecutar(() =>
                  marcarAvisosApi(
                    sistema?.notificaciones.filter((n) => !n.leida).map((n) => n.id) ?? [],
                  ),
                )
              }
            >
              Marcar todos como leídos
            </button>
            <ul className="compact-list">
              {sistema?.notificaciones.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className="compact-list__row"
                    onClick={() => {
                      if (!n.leida) void accion.ejecutar(() => marcarAvisosApi([n.id]));
                      setAbierto(
                        n.aviso ?? {
                          id: n.id,
                          asunto: n.titulo,
                          cuerpo: n.detalle,
                          destinatarios: [],
                          enviado: n.fecha,
                          estado: 'enviado',
                          canal: 'sistema',
                          plantilla: 'sistema',
                          relacionadoCon: null,
                        },
                      );
                      setRecibidos(false);
                    }}
                  >
                    <span className="compact-list__body">
                      <strong>{n.titulo}</strong>
                      <small>
                        {formatFecha(n.fecha)} · {n.leida ? 'Leído' : 'Sin leer'}
                      </small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {!sistema?.notificaciones.length && <EmptyState title="Sin avisos recibidos" />}
          </div>
        </Sheet>
      )}
    </CompactPage>
  );
}
