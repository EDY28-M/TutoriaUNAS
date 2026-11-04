import { CompactPage, SecondaryPanel } from '../../components/ui/CompactPage';
import { API_MODE } from '../../services/apiConfig';
import { RespuestaInsumo } from '../../components/panels/GestionCoordinacion';
import { useCallback, useMemo, useState } from 'react';
import type { DefinicionSelect } from '../../components/panels/PanelFiltros';
import { PanelFiltros, useFiltro } from '../../components/panels/PanelFiltros';
import { Alert } from '../../components/ui/Alert';
import { Card, CardBody, CardFoot, CardHead } from '../../components/ui/Card';
import type { Column } from '../../components/ui/DataTable';
import { DataTable } from '../../components/ui/DataTable';
import {
  ClipboardList,
  Database,
  Info,
  Lock,
  ShieldCheck,
  Waypoints,
  Clock,
} from '../../components/ui/icons';
import { PageHeading } from '../../components/ui/PageHeading';
import { Sheet } from '../../components/ui/Sheet';
import { Stat } from '../../components/ui/Stat';
import { Badge, StatusBadge } from '../../components/ui/StatusBadge';
import { Timeline } from '../../components/ui/Timeline';
import { areasDerivacion } from '../../data/catalogos';
import { insumos as insumosInstitucionales } from '../../data/institucional';
import { abreviaturaEscuela } from '../../data/personas';
import { usePortal } from '../../hooks/usePortal';
import type { InsumoSolicitud } from '../../types/domain';
import { HOY_ISO, formatFecha } from '../../utils/fechas';

const ESTADOS_INSUMO: Array<InsumoSolicitud['estado']> = [
  'entregado',
  'parcial',
  'pendiente',
  'no-autorizado',
];

/** Etiqueta del estado de una solicitud de datos. */
function etiquetaEstado(estado: InsumoSolicitud['estado']): string {
  if (estado === 'entregado') return 'Entregado';
  if (estado === 'parcial') return 'Entrega parcial';
  if (estado === 'no-autorizado') return 'No autorizado';
  return 'Pendiente';
}

/** Siguiente paso sugerido según el estado de la solicitud. */
function siguientePaso(insumo: InsumoSolicitud): string {
  if (insumo.estado === 'entregado')
    return 'Los datos ya están disponibles. Revisa que correspondan al semestre.';
  if (insumo.estado === 'parcial')
    return 'Pide los datos que faltan y confirma cómo se pueden usar.';
  if (insumo.estado === 'no-autorizado')
    return 'Pide la autorización del responsable y registra su respuesta.';
  return 'Vuelve a solicitar los datos e informa a coordinación.';
}

/**
 * Seguimiento de las nueve solicitudes de datos a las áreas institucionales:
 * estado de entrega, insumo prioritario, aplicación en el sistema, fechas de
 * solicitud y respuesta, línea de tiempo del proceso y las condiciones de la
 * integración con la DIAA.
 */
export function CoordIntegrations() {
  const portal = usePortal();
  const [detalle, setDetalle] = useState<InsumoSolicitud | null>(null);

  const buscarEn = useCallback(
    (insumo: InsumoSolicitud) =>
      [
        insumo.id,
        insumo.area,
        insumo.insumoPrioritario,
        insumo.aplicacion,
        insumo.responsable,
      ].join(' '),
    [],
  );

  const selects = useMemo<Array<DefinicionSelect<InsumoSolicitud>>>(
    () => [
      {
        id: 'estado',
        etiqueta: 'Estado',
        opciones: ESTADOS_INSUMO.map((estado) => ({
          valor: estado,
          etiqueta: etiquetaEstado(estado),
        })),
        valorDe: (insumo) => insumo.estado,
      },
      {
        id: 'respuesta',
        etiqueta: 'Respuesta del área',
        opciones: [
          { valor: 'con-respuesta', etiqueta: 'Con respuesta registrada' },
          { valor: 'sin-respuesta', etiqueta: 'Sin respuesta' },
        ],
        valorDe: (insumo) => (insumo.fechaRespuesta ? 'con-respuesta' : 'sin-respuesta'),
      },
    ],
    [],
  );

  const filtro = useFiltro(insumosInstitucionales, buscarEn, selects);

  const conteo = (estado: InsumoSolicitud['estado']) =>
    insumosInstitucionales.filter((insumo) => insumo.estado === estado).length;
  const conRespuesta = insumosInstitucionales.filter((insumo) => insumo.fechaRespuesta).length;
  const atrasados = insumosInstitucionales.filter(
    (insumo) => !insumo.fechaRespuesta && insumo.estado !== 'no-autorizado',
  ).length;

  const hitos = useMemo(() => {
    const eventos: Array<{
      fecha: string;
      titulo: string;
      descripcion: string;
      tono: 'info' | 'ok' | 'alerta' | 'riesgo';
    }> = [];
    for (const insumo of insumosInstitucionales) {
      eventos.push({
        fecha: insumo.fechaSolicitud,
        titulo: `Solicitud ${insumo.id} enviada a ${insumo.area}`,
        descripcion: `Datos solicitados: ${insumo.insumoPrioritario}. Responsable del pedido: ${insumo.responsable}.`,
        tono: 'info',
      });
      if (insumo.fechaRespuesta) {
        eventos.push({
          fecha: insumo.fechaRespuesta,
          titulo: `Respuesta ${insumo.id}: ${etiquetaEstado(insumo.estado)}`,
          descripcion: insumo.observacion,
          tono:
            insumo.estado === 'entregado'
              ? 'ok'
              : insumo.estado === 'parcial'
                ? 'alerta'
                : insumo.estado === 'no-autorizado'
                  ? 'riesgo'
                  : 'info',
        });
      }
    }
    return eventos.sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, []);

  const columnas: Column<InsumoSolicitud>[] = [
    {
      key: 'id',
      header: 'Solicitud',
      sortable: true,
      sortValue: (insumo) => insumo.id,
      render: (insumo) => <span className="cell-mono">{insumo.id}</span>,
    },
    {
      key: 'area',
      header: 'Área institucional',
      sortable: true,
      sortValue: (insumo) => insumo.area,
      render: (insumo) => (
        <span className="stack" style={{ gap: 1 }}>
          <strong className="cell-strong">{insumo.area}</strong>
          <span className="cell-note">{insumo.responsable}</span>
        </span>
      ),
    },
    {
      key: 'insumo',
      header: 'Datos solicitados',
      render: (insumo) => (
        <span className="stack" style={{ gap: 1 }}>
          <span>{insumo.insumoPrioritario}</span>
          <span className="cell-note">Aplicación: {insumo.aplicacion}</span>
        </span>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      sortable: true,
      sortValue: (insumo) => insumo.estado,
      render: (insumo) => (
        <StatusBadge estado={insumo.estado} etiqueta={etiquetaEstado(insumo.estado)} />
      ),
    },
    {
      key: 'solicitud',
      header: 'Solicitado',
      sortable: true,
      sortValue: (insumo) => insumo.fechaSolicitud,
      render: (insumo) => (
        <span className="nowrap cell-mono">{formatFecha(insumo.fechaSolicitud)}</span>
      ),
    },
    {
      key: 'respuesta',
      header: 'Respondido',
      sortable: true,
      sortValue: (insumo) => insumo.fechaRespuesta ?? '',
      render: (insumo) =>
        insumo.fechaRespuesta ? (
          <span className="nowrap cell-mono">{formatFecha(insumo.fechaRespuesta)}</span>
        ) : (
          <Badge tone="alerta">Sin respuesta</Badge>
        ),
    },
    {
      key: 'observacion',
      header: 'Observación',
      render: (insumo) => <span className="cell-note">{insumo.observacion}</span>,
    },
    {
      key: 'acciones',
      header: 'Detalle',
      render: (insumo) => (
        <span className="cell-actions">
          <button
            type="button"
            className="btn btn-falcon-default btn-sm"
            aria-label={`Ver el detalle de la solicitud ${insumo.id}`}
            onClick={() => setDetalle(insumo)}
          >
            Ver detalle
          </button>
        </span>
      ),
    },
  ];

  return (
    <CompactPage>
      <PageHeading
        eyebrow={`Gestión institucional · Integraciones de datos · ${abreviaturaEscuela(portal.escuelaId)}`}
        title="Datos de otras áreas"
        description="Revisa qué datos se solicitaron a cada área y cuáles están pendientes de entrega."
        actions={
          <>
            <Badge tone="info">{insumosInstitucionales.length} solicitudes</Badge>
            <Badge tone={atrasados ? 'alerta' : 'ok'}>
              {atrasados ? `${atrasados} sin respuesta` : 'Todas respondidas'}
            </Badge>
          </>
        }
      />

      <Card>
        <CardHead
          title="Seguimiento de solicitudes"
          description="Filtra por estado o por existencia de respuesta del área."
          actions={
            <Badge tone="dorado">
              {conRespuesta} de {insumosInstitucionales.length} respondidas
            </Badge>
          }
        />
        <CardBody>
          <div className="stack">
            <PanelFiltros<InsumoSolicitud>
              busqueda={filtro.busqueda}
              onBusqueda={filtro.setBusqueda}
              selects={selects}
              valores={filtro.valores}
              onValor={(id, valor) =>
                filtro.setValores((actuales) => ({ ...actuales, [id]: valor }))
              }
              mostrados={filtro.filtrados.length}
              total={insumosInstitucionales.length}
              activos={filtro.activos}
              onLimpiar={filtro.limpiar}
              etiqueta="Filtros de las solicitudes de datos"
              placeholder="Buscar por área, insumo o responsable…"
            />
            <DataTable<InsumoSolicitud>
              rows={filtro.filtrados}
              columns={columnas.filter((c) =>
                ['area', 'estado', 'respuesta', 'acciones'].includes(c.key),
              )}
              caption="Solicitudes de datos a las áreas institucionales"
              rowKey={(insumo) => insumo.id}
              pageSize={9}
              emptyTitle="Sin solicitudes con estos filtros"
              emptyDescription="Ajusta el estado o el texto de búsqueda."
            />
          </div>
        </CardBody>
        <CardFoot>
          <span>
            Los estados y fechas de esta tabla son ficticios para probar el flujo. No acreditan una
            entrega ni una autorización institucional.
          </span>
        </CardFoot>
      </Card>

      <div className="compact-toolbar">
        <SecondaryPanel title="Resumen y condiciones">
          <div className="grid grid--4">
            <Stat
              label="Entregados"
              value={conteo('entregado')}
              note="Insumos incorporados al sistema"
              icon={<Database aria-hidden="true" />}
              tone="verde"
            />
            <Stat
              label="Entrega parcial"
              value={conteo('parcial')}
              note="Falta completar o confirmar reglas de uso"
              icon={<Waypoints aria-hidden="true" />}
              tone="alerta"
            />
            <Stat
              label="Pendientes"
              value={conteo('pendiente')}
              note="Requieren reiteración del pedido"
              icon={<ClipboardList aria-hidden="true" />}
              tone="info"
            />
            <Stat
              label="No autorizados"
              value={conteo('no-autorizado')}
              note="Se debe registrar una alternativa de tratamiento"
              icon={<Lock aria-hidden="true" />}
              tone={conteo('no-autorizado') ? 'riesgo' : 'verde'}
            />
          </div>

          <Alert tone="info" title="Datos académicos: solo consulta">
            <ShieldCheck aria-hidden="true" /> Aquí solo se consultan los datos académicos. Mientras
            se habilita la conexión con la universidad, se usarán archivos autorizados y se
            registrará quién los cargó y cuándo.
          </Alert>

          <Alert
            tone="alerta"
            title="Bienestar requiere un plan de trabajo antes de autorizar el acceso"
          >
            La carta 001026-2026-DIBU solicita precisar finalidad, usuarios autorizados, datos
            mínimos y modalidad de consulta. El acceso sigue en evaluación. La propuesta comprende
            código universitario, identificador de atención, servicio, fecha, estado y fecha de
            corte. Las pautas académicas requieren autorización y vigencia explícitas. Los
            diagnósticos, motivos confidenciales, historias clínicas e informes profesionales quedan
            fuera.
          </Alert>

          {conteo('no-autorizado') > 0 && (
            <Alert tone="riesgo" title="Hay datos que aún no se pueden usar">
              Ningún dato se incorpora sin autorización. Registra la alternativa institucional (por
              ejemplo, reporte agregado sin datos personales) y déjela constancia en la observación
              de la solicitud correspondiente.
            </Alert>
          )}
        </SecondaryPanel>
        <SecondaryPanel title="Historial y requisitos">
          <div className="grid grid--sidebar">
            <Card>
              <CardHead
                title="Historial de solicitudes"
                description="Envío de solicitudes y respuestas de las áreas, en orden cronológico."
              />
              <CardBody>
                <Timeline
                  etiqueta="Línea de tiempo de las solicitudes de datos"
                  hitos={hitos.map((hito) => ({
                    titulo: hito.titulo,
                    descripcion: hito.descripcion,
                    fecha: formatFecha(hito.fecha),
                    tono: hito.tono,
                  }))}
                />
              </CardBody>
              <CardFoot>
                <span>{hitos.length} eventos registrados entre solicitudes y respuestas.</span>
              </CardFoot>
            </Card>

            <div className="stack">
              <Card accent>
                <CardHead
                  title="Requisitos para usar los datos"
                  description="Permisos y condiciones que debe confirmar cada área."
                />
                <CardBody>
                  <dl className="def-list">
                    <div>
                      <dt>Modo de acceso</dt>
                      <dd>Consulta de datos académicos. No permite modificarlos.</dd>
                    </div>
                    <div>
                      <dt>Mientras se habilita la conexión</dt>
                      <dd>Carga de archivo CSV autorizado, con registro de responsable y fecha.</dd>
                    </div>
                    <div>
                      <dt>Datos mínimos</dt>
                      <dd>
                        Registro y matrícula, cursos y notas, promedio ponderado, avance curricular
                        y horarios del estudiante.
                      </dd>
                    </div>
                    <div>
                      <dt>Datos excluidos</dt>
                      <dd>
                        Historia clínica, diagnósticos y detalles de atención de salud o psicología.
                      </dd>
                    </div>
                    <div>
                      <dt>Responsable técnico</dt>
                      <dd>Área de tecnología de la universidad (solicitud INS-05).</dd>
                    </div>
                    <div>
                      <dt>Frecuencia prevista</dt>
                      <dd>Actualización por corte académico informada por la DIAA.</dd>
                    </div>
                  </dl>
                </CardBody>
                <CardFoot>
                  <span>
                    El área de tecnología debe habilitar el correo y la conexión con los datos
                    oficiales.
                  </span>
                </CardFoot>
              </Card>

              <Card>
                <CardHead
                  title="Para qué se usa cada dato"
                  description="Para qué usa el sistema cada dato recibido"
                />
                <CardBody flush>
                  <ul className="list">
                    {insumosInstitucionales.slice(0, 5).map((insumo) => (
                      <li className="list__item" key={`${insumo.id}-aplicacion`}>
                        <span className="list__body">
                          <strong>{insumo.aplicacion}</strong>
                          <p>
                            {insumo.id} · {insumo.area}
                          </p>
                        </span>
                        <span className="list__aside">
                          <StatusBadge
                            estado={insumo.estado}
                            etiqueta={etiquetaEstado(insumo.estado)}
                          />
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardBody>
                <CardFoot>
                  <span>
                    <Info aria-hidden="true" /> Las áreas de apoyo se corresponden con las rutas de
                    solicitud de apoyo del formato 12.
                  </span>
                </CardFoot>
              </Card>
            </div>
          </div>
        </SecondaryPanel>
        <SecondaryPanel title="Áreas y contactos">
          <Card flat>
            <CardHead
              title="Rutas de solicitud de apoyo relacionadas"
              description="Áreas institucionales que reciben fichas de solicitud de apoyo (formato 12)"
            />
            <CardBody>
              <div className="grid grid--2">
                <dl className="def-list">
                  {areasDerivacion.slice(0, 3).map((area) => (
                    <div key={area.id}>
                      <dt>{area.nombre}</dt>
                      <dd>
                        {area.responsable} · {area.correo} · respuesta estimada{' '}
                        {area.tiempoRespuesta}
                      </dd>
                    </div>
                  ))}
                </dl>
                <dl className="def-list">
                  {areasDerivacion.slice(3).map((area) => (
                    <div key={area.id}>
                      <dt>{area.nombre}</dt>
                      <dd>
                        {area.responsable} · {area.correo} · respuesta estimada{' '}
                        {area.tiempoRespuesta}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </CardBody>
            <CardFoot>
              <span>
                El sistema conserva el estado de la atención y la recomendación autorizada; nunca el
                diagnóstico.
              </span>
            </CardFoot>
          </Card>
        </SecondaryPanel>
      </div>
      {detalle && (
        <Sheet
          wide
          title={`${detalle.id} · ${detalle.area}`}
          description={`Solicitud del ${formatFecha(detalle.fechaSolicitud)} · responsable: ${detalle.responsable}`}
          onClose={() => setDetalle(null)}
          footer={
            <>
              <button type="button" className="btn btn-link" onClick={() => setDetalle(null)}>
                Cerrar detalle
              </button>
              <Badge tone={detalle.estado === 'entregado' ? 'ok' : 'alerta'}>
                {etiquetaEstado(detalle.estado)}
              </Badge>
            </>
          }
        >
          <div className="stack stack--lg">
            <div className="grid grid--3">
              <Stat
                label="Estado de la solicitud"
                icon={<Info />}
                value={etiquetaEstado(detalle.estado)}
                note={
                  detalle.fechaRespuesta
                    ? `Respondida el ${formatFecha(detalle.fechaRespuesta)}`
                    : 'Sin respuesta registrada'
                }
                tone={
                  detalle.estado === 'entregado'
                    ? 'verde'
                    : detalle.estado === 'parcial'
                      ? 'alerta'
                      : detalle.estado === 'no-autorizado'
                        ? 'riesgo'
                        : 'info'
                }
              />
              <Stat
                label="Días transcurridos"
                icon={<Clock />}
                value={diasDesde(detalle.fechaSolicitud, detalle.fechaRespuesta)}
                note="Desde la solicitud hasta la respuesta o hasta hoy"
                tone="info"
              />
              <Stat
                label="Insumos solicitados"
                icon={<ClipboardList />}
                value={detalle.insumoPrioritario.split(',').length}
                note="Componentes del insumo prioritario"
                tone="violeta"
              />
            </div>

            <dl className="def-list">
              <div>
                <dt>Área institucional</dt>
                <dd>{detalle.area}</dd>
              </div>
              <div>
                <dt>Responsable del área</dt>
                <dd>{detalle.responsable}</dd>
              </div>
              <div>
                <dt>Datos solicitados</dt>
                <dd>{detalle.insumoPrioritario}</dd>
              </div>
              <div>
                <dt>Aplicación en el sistema</dt>
                <dd>{detalle.aplicacion}</dd>
              </div>
              <div>
                <dt>Fecha de solicitud</dt>
                <dd>{formatFecha(detalle.fechaSolicitud)}</dd>
              </div>
              <div>
                <dt>Fecha de respuesta</dt>
                <dd>
                  {detalle.fechaRespuesta ? formatFecha(detalle.fechaRespuesta) : 'Pendiente'}
                </dd>
              </div>
              <div>
                <dt>Observación registrada</dt>
                <dd>{detalle.observacion}</dd>
              </div>
              <div>
                <dt>Siguiente paso</dt>
                <dd>{siguientePaso(detalle)}</dd>
              </div>
            </dl>

            <Alert tone="info" title="Uso permitido de los datos">
              Los datos recibidos se usan únicamente para la finalidad tutorial declarada. Cualquier
              uso distinto requiere una nueva autorización del área responsable y queda registrado
              en la auditoría.
            </Alert>
          </div>
          {API_MODE && <RespuestaInsumo insumoId={detalle.id} alGuardar={() => setDetalle(null)} />}
        </Sheet>
      )}
    </CompactPage>
  );
}

/** Días transcurridos entre la solicitud y la respuesta (o la fecha de corte). */
function diasDesde(solicitud: string, respuesta: string | null): number {
  const inicio = new Date(`${solicitud}T00:00:00`);
  const fin = new Date(`${respuesta ?? HOY_ISO}T00:00:00`);
  return Math.max(0, Math.round((fin.getTime() - inicio.getTime()) / 86_400_000));
}
