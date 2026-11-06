import { DirectoryDisclosure, DirectoryPage } from '../../components/ui/DirectoryPage';
import { MetricGroup } from '../../components/ui/MetricGroup';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_MODE } from '../../services/apiConfig';
import { apiJson } from '../../services/apiClient';
import type { DefinicionSelect } from '../../hooks/useFiltro';
import { useFiltro } from '../../hooks/useFiltro';
import { DirectoryToolbar } from '../../components/ui/DirectoryToolbar';
import { Alert } from '../../components/ui/Alert';
import { Card, CardBody, CardFoot, CardHead } from '../../components/ui/Card';
import type { Column } from '../../components/ui/DataTable';
import { DataTable } from '../../components/ui/DataTable';
import { Ban, Download, Lock, ScrollText, ShieldAlert, UserRound } from '../../components/ui/icons';
import { PageHeading } from '../../components/ui/PageHeading';
import { Stat } from '../../components/ui/Stat';
import { Badge } from '../../components/ui/StatusBadge';
import { semestreActual } from '../../data/catalogos';
import { eventosAuditoria } from '../../data/institucional';
import { escuelaDe } from '../../data/personas';
import { usePortal } from '../../hooks/usePortal';
import type { EventoAuditoria } from '../../types/domain';
import { downloadCsv, encodeCsv } from '../../utils/csv';
import { formatFechaHora } from '../../utils/fechas';

/** Etiqueta legible del rol que ejecutó la acción. */
function etiquetaRol(rol: string): string {
  if (rol === 'estudiante') return 'Estudiante';
  if (rol === 'tutor') return 'Docente tutor';
  if (rol === 'coordinacion') return 'Coordinación de tutoría';
  if (rol === 'administracion') return 'Administración';
  return rol;
}

/** Indica si el evento corresponde a un acceso bloqueado por el sistema. */
function esAccesoBloqueado(evento: EventoAuditoria): boolean {
  const texto = `${evento.accion} ${evento.entidad} ${evento.detalle}`.toLowerCase();
  return texto.includes('rechaz') || texto.includes('bloque') || texto.includes('no autorizado');
}

/**
 * Auditoría y trazabilidad del sistema: registro cronológico de acciones por
 * actor y rol, entidad afectada, detalle, dirección IP y condición de descarga,
 * con filtros, métricas de descargas y de accesos bloqueados, y exportación CSV.
 */
export function CoordAudit() {
  return API_MODE ? <AuditoriaPersistente /> : <AuditoriaDemostracion />;
}

interface RegistroServidor {
  id: number;
  fecha: string;
  usuarioId: string;
  escuelaId: string;
  accion: string;
  recursoId: string;
  version: number;
  identificador?: string | null;
  nombre?: string | null;
  rol?: string | null;
  dispositivo?: string | null;
}

const accionesAcceso: Record<string, string> = {
  'iniciar-sesion': 'Inicio de sesión',
  'iniciar-activacion': 'Inicio de verificación',
  'acceso-pendiente-vinculacion': 'Acceso pendiente de vinculación',
};

function AuditoriaPersistente() {
  const { institucional } = usePortal();
  const [registros, setRegistros] = useState<RegistroServidor[]>([]);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    apiJson<RegistroServidor[]>('/api/tutoria/auditoria', 'GET', undefined, controller.signal)
      .then((datos) => {
        if (!controller.signal.aborted) {
          setRegistros(datos);
          setError('');
        }
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : 'No se pudo cargar la auditoría.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setCargando(false);
      });
    return () => controller.abort();
  }, [revision]);
  return (
    <DirectoryPage>
      <PageHeading
        eyebrow="Coordinación"
        title="Auditoría de tutoría"
        description={
          institucional
            ? 'Últimas 200 operaciones de todas las escuelas.'
            : 'Últimas 200 operaciones de la escuela seleccionada.'
        }
        actions={
          <button
            type="button"
            className="btn btn-falcon-default"
            disabled={cargando}
            onClick={() => {
              setCargando(true);
              setRevision((value) => value + 1);
            }}
          >
            Actualizar
          </button>
        }
      />
      {error && (
        <Alert tone="riesgo" title="No se pudo cargar la auditoría">
          {error}
        </Alert>
      )}
      {cargando && <p role="status">Cargando operaciones…</p>}
      <DataTable
        rows={registros}
        rowKey={(r) => String(r.id)}
        caption="Operaciones persistidas en el servidor"
        pagination="auto"
        paginationPosition="bottom"
        emptyTitle="Sin operaciones registradas"
        columns={[
          { key: 'fecha', header: 'Fecha y hora', render: (r) => formatFechaHora(r.fecha) },
          ...(institucional
            ? [
                {
                  key: 'escuela',
                  header: 'Escuela',
                  render: (r: RegistroServidor) => escuelaDe(r.escuelaId),
                },
              ]
            : []),
          {
            key: 'cuenta',
            header: 'Usuario',
            render: (r) => (
              <>
                <strong>{r.nombre || r.identificador || r.usuarioId}</strong>
                {r.nombre && r.identificador && (
                  <span className="cell-note d-block">{r.identificador}</span>
                )}
                {r.rol && <span className="cell-note d-block">{etiquetaRol(r.rol)}</span>}
              </>
            ),
          },
          { key: 'accion', header: 'Acción', render: (r) => accionesAcceso[r.accion] ?? r.accion },
          {
            key: 'dispositivo',
            header: 'Dispositivo',
            render: (r) =>
              accionesAcceso[r.accion] ? (r.dispositivo ?? 'Dispositivo no registrado') : '—',
          },
          { key: 'recurso', header: 'Registro', render: (r) => r.recursoId },
          { key: 'version', header: 'Versión', render: (r) => String(r.version) },
        ]}
      />
    </DirectoryPage>
  );
}

function AuditoriaDemostracion() {
  const portal = usePortal();
  const [soloDescargas, setSoloDescargas] = useState(false);

  const eventos = useMemo(
    () => [...eventosAuditoria].sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [],
  );

  const buscarEn = useCallback(
    (evento: EventoAuditoria) =>
      [
        evento.actor,
        evento.rol,
        evento.accion,
        evento.entidad,
        evento.detalle,
        evento.origenIp,
      ].join(' '),
    [],
  );

  const accionesDisponibles = useMemo(
    () => [...new Set(eventosAuditoria.map((evento) => evento.accion))].sort(),
    [],
  );

  const selects = useMemo<Array<DefinicionSelect<EventoAuditoria>>>(
    () => [
      {
        id: 'rol',
        etiqueta: 'Rol',
        opciones: [...new Set(eventosAuditoria.map((evento) => evento.rol))].map((rol) => ({
          valor: rol,
          etiqueta: etiquetaRol(rol),
        })),
        valorDe: (evento) => evento.rol,
      },
      {
        id: 'accion',
        etiqueta: 'Acción',
        opciones: accionesDisponibles.map((accion) => ({ valor: accion, etiqueta: accion })),
        valorDe: (evento) => evento.accion,
      },
      {
        id: 'descarga',
        etiqueta: 'Descarga',
        opciones: [
          { valor: 'si', etiqueta: 'Sí descargó' },
          { valor: 'no', etiqueta: 'No descargó' },
        ],
        valorDe: (evento) => (evento.descarga ? 'si' : 'no'),
      },
      {
        id: 'tipo',
        etiqueta: 'Tipo de evento',
        opciones: [
          { valor: 'bloqueado', etiqueta: 'Acceso bloqueado' },
          { valor: 'normal', etiqueta: 'Operación normal' },
        ],
        valorDe: (evento) => (esAccesoBloqueado(evento) ? 'bloqueado' : 'normal'),
      },
    ],
    [accionesDisponibles],
  );

  const filtro = useFiltro(eventos, buscarEn, selects);
  const visibles = soloDescargas
    ? filtro.filtrados.filter((evento) => evento.descarga)
    : filtro.filtrados;

  const descargas = eventos.filter((evento) => evento.descarga);
  const bloqueados = eventos.filter((evento) => esAccesoBloqueado(evento));
  const porRol = [...new Set(eventos.map((evento) => evento.rol))].map((rol) => ({
    rol,
    total: eventos.filter((evento) => evento.rol === rol).length,
    descargas: eventos.filter((evento) => evento.rol === rol && evento.descarga).length,
  }));
  const ipsDistintas = new Set(eventos.map((evento) => evento.origenIp)).size;

  function exportar() {
    const filas: string[][] = [
      ['Auditoría y trazabilidad · Sistema de Tutoría UNAS'],
      ['Corresponde a', `${escuelaDe(portal.escuelaId)} · semestre ${semestreActual}`],
      ['Registros exportados', String(visibles.length)],
      [],
      ['ID', 'Fecha', 'Actor', 'Rol', 'Acción', 'Entidad', 'Detalle', 'IP de origen', 'Descarga'],
    ];
    for (const evento of visibles) {
      filas.push([
        evento.id,
        evento.fecha,
        evento.actor,
        etiquetaRol(evento.rol),
        evento.accion,
        evento.entidad,
        evento.detalle,
        evento.origenIp,
        evento.descarga ? 'Sí' : 'No',
      ]);
    }
    // Se codifica antes de descargar para verificar el contenido exportado.
    const contenido = encodeCsv(filas);
    if (contenido.length > 0) downloadCsv(filas, `auditoria-tutoria-${semestreActual}.csv`);
  }

  const columnas: Column<EventoAuditoria>[] = [
    {
      key: 'fecha',
      header: 'Fecha',
      sortable: true,
      sortValue: (evento) => evento.fecha,
      render: (evento) => <span className="nowrap cell-mono">{formatFechaHora(evento.fecha)}</span>,
    },
    {
      key: 'actor',
      header: 'Actor',
      sortable: true,
      sortValue: (evento) => evento.actor,
      render: (evento) => (
        <span className="stack" style={{ gap: 1 }}>
          <strong className="cell-strong">{evento.actor}</strong>
          <span className="cell-note mono">{evento.origenIp}</span>
        </span>
      ),
    },
    {
      key: 'rol',
      header: 'Rol',
      sortable: true,
      sortValue: (evento) => evento.rol,
      render: (evento) => (
        <Badge
          tone={
            evento.rol === 'administracion' ? 'violeta' : evento.rol === 'tutor' ? 'info' : 'neutro'
          }
        >
          {etiquetaRol(evento.rol)}
        </Badge>
      ),
    },
    {
      key: 'accion',
      header: 'Acción',
      sortable: true,
      sortValue: (evento) => evento.accion,
      render: (evento) => (
        <span className="stack" style={{ gap: 2 }}>
          <span>{evento.accion}</span>
          {esAccesoBloqueado(evento) && (
            <Badge tone="riesgo">
              <Ban aria-hidden="true" /> Acceso bloqueado
            </Badge>
          )}
        </span>
      ),
    },
    {
      key: 'entidad',
      header: 'Entidad',
      sortable: true,
      sortValue: (evento) => evento.entidad,
      render: (evento) => <span className="cell-mono">{evento.entidad}</span>,
    },
    {
      key: 'detalle',
      header: 'Detalle',
      render: (evento) => <span className="cell-note">{evento.detalle}</span>,
    },
    {
      key: 'descarga',
      header: 'Descarga',
      sortable: true,
      sortValue: (evento) => (evento.descarga ? 1 : 0),
      render: (evento) =>
        evento.descarga ? (
          <Badge tone="alerta">
            <Download aria-hidden="true" /> Sí descargó
          </Badge>
        ) : (
          <span className="muted small">Sin descarga</span>
        ),
    },
  ];

  return (
    <DirectoryPage>
      <PageHeading
        eyebrow={`Gestión institucional · Auditoría y historial de cambios · Semestre ${semestreActual}`}
        title="Historial de cambios"
        description="Revisa quién consultó, cambió o descargó información y cuándo lo hizo."
        actions={
          <>
            <Badge tone="info">{eventos.length} eventos registrados</Badge>
            <button type="button" className="btn btn-primary" onClick={exportar}>
              <Download aria-hidden="true" /> Descargar tabla (CSV)
            </button>
          </>
        }
      />

      <MetricGroup label="Resumen de auditoría">
        <Stat
          label="Eventos de auditoría"
          value={eventos.length}
          note={`${ipsDistintas} direcciones IP de origen`}
          icon={<ScrollText aria-hidden="true" />}
        />
        <Stat
          label="Descargas registradas"
          value={descargas.length}
          note="Reportes, formularios y constancias"
          icon={<Download aria-hidden="true" />}
          tone={descargas.length ? 'dorado' : 'verde'}
        />
        <Stat
          label="Accesos bloqueados"
          value={bloqueados.length}
          note="Consultas no autorizadas rechazadas por el sistema"
          icon={<Lock aria-hidden="true" />}
          tone={bloqueados.length ? 'riesgo' : 'verde'}
        />
        <Stat
          label="Actores distintos"
          value={new Set(eventos.map((evento) => evento.actor)).size}
          note="Docentes, estudiantes, coordinación y áreas"
          icon={<UserRound aria-hidden="true" />}
          tone="violeta"
        />
      </MetricGroup>

      {bloqueados.length > 0 && (
        <Alert tone="riesgo" title={`${bloqueados.length} intento(s) de acceso no autorizado`}>
          <ShieldAlert aria-hidden="true" /> El sistema bloqueó la consulta y registró el intento.
          Los datos clínicos y de salud no están disponibles para el proceso de tutoría: solo se
          comparte el estado de la atención y la recomendación autorizada autorizada por el área
          responsable.
        </Alert>
      )}

      <Card>
        <CardHead
          title="Acciones registradas"
          description="Busca por perfil, acción o descarga."
          actions={
            <button
              type="button"
              className="chip"
              aria-pressed={soloDescargas}
              onClick={() => setSoloDescargas((actual) => !actual)}
            >
              <Download aria-hidden="true" /> Solo descargas
            </button>
          }
        />
        <CardBody>
          <div className="stack">
            <DirectoryToolbar
              busqueda={filtro.busqueda}
              onBusqueda={filtro.setBusqueda}
              selects={selects}
              valores={filtro.valores}
              onValores={filtro.setValores}
              mostrados={visibles.length}
              total={eventos.length}
              filtrosAdicionalesActivos={soloDescargas}
              onLimpiar={() => {
                filtro.limpiar();
                setSoloDescargas(false);
              }}
              etiqueta="Filtros de auditoría"
              placeholder="Buscar por persona, acción o dirección IP…"
            />
            <DataTable<EventoAuditoria>
              rows={visibles}
              columns={columnas}
              caption="Eventos de auditoría y historial de cambios del sistema de tutoría"
              rowKey={(evento) => evento.id}
              pageSize={10}
              pagination="auto"
              paginationPosition="bottom"
              initialSort={{ key: 'fecha', direction: 'desc' }}
              emptyTitle="Sin eventos con estos filtros"
              emptyDescription="Ajusta el rol, la acción o el tipo de evento seleccionado."
            />
          </div>
        </CardBody>
      </Card>

      <DirectoryDisclosure title="Detalle de auditoría">
        <div className="grid grid--2">
          <Card>
            <CardHead
              title="Actividad por perfil"
              description="Acciones y descargas realizadas por cada perfil."
            />
            <CardBody flush>
              <ul className="list">
                {porRol.map((fila) => (
                  <li className="list__item" key={fila.rol}>
                    <span className="list__body">
                      <strong>{etiquetaRol(fila.rol)}</strong>
                      <p>
                        {fila.total} evento(s) registrados · {fila.descargas} con descarga de
                        información
                      </p>
                    </span>
                    <span className="list__aside">
                      <Badge tone={fila.descargas ? 'alerta' : 'ok'}>
                        {fila.descargas} descargas
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card accent>
            <CardHead
              title="Qué se guarda en el historial"
              description="Acciones que quedan registradas."
            />
            <CardBody>
              <dl className="def-list">
                <div>
                  <dt>Quién</dt>
                  <dd>La persona que realizó la acción y su perfil.</dd>
                </div>
                <div>
                  <dt>Qué</dt>
                  <dd>
                    La acción ejecutada y la entidad afectada (formato, asignación, regla o
                    reporte).
                  </dd>
                </div>
                <div>
                  <dt>Cuándo</dt>
                  <dd>Fecha y hora del evento con la zona horaria institucional.</dd>
                </div>
                <div>
                  <dt>Desde dónde</dt>
                  <dd>Dirección IP de origen de la sesión.</dd>
                </div>
                <div>
                  <dt>Descarga</dt>
                  <dd>
                    Marca específica cuando el evento implicó exportar información del sistema.
                  </dd>
                </div>
                <div>
                  <dt>Conservación</dt>
                  <dd>
                    El registro se mantiene como evidencia y solo la administración puede
                    consultarlo o descargarlo.
                  </dd>
                </div>
                <div>
                  <dt>Accesos bloqueados</dt>
                  <dd>
                    Los intentos de consulta no autorizados se registran con su motivo y se revisan
                    con la coordinación.
                  </dd>
                </div>
              </dl>
            </CardBody>
            <CardFoot>
              <span>
                Base normativa: Ley N.º 29733 de Protección de Datos Personales y directiva
                institucional de seguridad de la información.
              </span>
            </CardFoot>
          </Card>
        </div>
      </DirectoryDisclosure>
    </DirectoryPage>
  );
}
