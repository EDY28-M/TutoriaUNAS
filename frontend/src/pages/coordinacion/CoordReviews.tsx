import { DirectoryDisclosure, DirectoryPage } from '../../components/ui/DirectoryPage';
import { SeguimientosCoordinacion } from '../../components/panels/GestionCoordinacion';
import { useCallback, useId, useMemo, useState } from 'react';
import { ClipboardCheck, Eye, FileCheck } from '../../components/ui/icons';
import { PageHeading } from '../../components/ui/PageHeading';
import { Card, CardBody, CardHead } from '../../components/ui/Card';
import { Alert } from '../../components/ui/Alert';
import { Badge, StatusBadge } from '../../components/ui/StatusBadge';
import { DataTable } from '../../components/ui/DataTable';
import type { Column } from '../../components/ui/DataTable';
import { Sheet } from '../../components/ui/Sheet';
import { Tabs, TabPanel } from '../../components/ui/Tabs';
import { EmptyState } from '../../components/ui/EmptyState';
import { useFiltro } from '../../hooks/useFiltro';
import { DirectoryToolbar } from '../../components/ui/DirectoryToolbar';
import type { DefinicionSelect } from '../../hooks/useFiltro';
import { usePortal } from '../../hooks/usePortal';
import { useAuth } from '../../hooks/useAuth';
import { persistirRevision } from '../../services/mutacionesTutoria';
import { API_MODE } from '../../services/apiConfig';
import type { CodigoFormato, Docente, Instrumento } from '../../types/domain';
import { abreviaturaEscuela, docentePorId } from '../../data/personas';
import { escuelas, semestreActual } from '../../data/catalogos';
import { definicionPorCodigo } from '../../data/formatos';
import { HOY_ISO, formatFecha } from '../../utils/fechas';

const FORMATOS_INFORME: CodigoFormato[] = ['F01', 'F02'];

/** Estado de revisión que la coordinación asigna a un informe. */
type EstadoRevision = 'pendiente' | 'observado' | 'aprobado';

/** Decisión registrada en la demostración sobre un informe. */
interface DecisionRevision {
  estado: EstadoRevision;
  comentario: string;
  revisor: string;
  fecha: string;
}

/** Fila de la bandeja de revisión de informes 01 y 02. */
interface FilaRevision {
  instrumento: Instrumento;
  tutor: Docente | undefined;
  escuelaId: string;
  estado: EstadoRevision;
  comentario: string;
  revisor: string;
  fecha: string;
  puedeRevisarse: boolean;
}

/** Nombre corto del formato para las tablas. */
function nombreFormato(registro: Instrumento): string {
  const definicion = definicionPorCodigo(registro.formato);
  return definicion ? `Formato ${definicion.numero} · ${definicion.nombre}` : registro.formato;
}

/**
 * Bandeja de revisión de los informes 01 y 02: pestañas por estado, detalle de
 * las secciones y campos del instrumento y registro de la observación o de la
 * aprobación por parte de la coordinación de tutoría.
 */
export function CoordReviews() {
  const portal = usePortal();
  const { user } = useAuth();
  const idObservacion = useId();

  const informes = useMemo(
    () =>
      portal.instrumentos
        .filter((instrumento) => FORMATOS_INFORME.includes(instrumento.formato))
        .sort((a, b) => b.actualizado.localeCompare(a.actualizado)),
    [portal.instrumentos],
  );

  const [decisiones, setDecisiones] = useState<Record<string, DecisionRevision>>({});
  const [seleccionado, setSeleccionado] = useState<Instrumento | null>(null);
  const [pestana, setPestana] = useState<EstadoRevision | 'todos'>('pendiente');
  const [comentario, setComentario] = useState('');
  const [avisoInterno, setAvisoInterno] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const filas = useMemo<FilaRevision[]>(
    () =>
      informes.map((instrumento) => {
        const decision = decisiones[instrumento.id];
        const abierta = instrumento.observaciones.some(
          (observacion) => observacion.estado === 'abierta',
        );
        const estado: EstadoRevision =
          decision?.estado ??
          (instrumento.estado === 'aprobado' ? 'aprobado' : abierta ? 'observado' : 'pendiente');
        const tutor = docentePorId(instrumento.tutorId);
        const escuelaDeclarada = instrumento.respuestas['escuela'];
        return {
          instrumento,
          tutor,
          escuelaId:
            escuelaDeclarada && escuelas.some((escuela) => escuela.id === escuelaDeclarada)
              ? escuelaDeclarada
              : (tutor?.escuelaId ?? portal.escuelaId),
          estado,
          comentario:
            decision?.comentario ??
            instrumento.observaciones[0]?.texto ??
            'Sin comentario de revisión registrado.',
          revisor: decision?.revisor ?? instrumento.revisadoPor ?? 'Coordinación de tutoría',
          fecha: decision?.fecha ?? instrumento.actualizado,
          puedeRevisarse: instrumento.estado === 'enviado',
        };
      }),
    [decisiones, informes, portal.escuelaId],
  );

  const buscarEn = useCallback(
    (fila: FilaRevision) =>
      [
        nombreFormato(fila.instrumento),
        fila.tutor?.apellidos ?? '',
        fila.tutor?.nombres ?? '',
        abreviaturaEscuela(fila.escuelaId),
        fila.instrumento.id,
        fila.estado,
      ].join(' '),
    [],
  );

  const selects = useMemo<Array<DefinicionSelect<FilaRevision>>>(
    () => [
      {
        id: 'formato',
        etiqueta: 'Formato',
        opciones: FORMATOS_INFORME.map((codigo) => {
          const definicion = definicionPorCodigo(codigo);
          return {
            valor: codigo,
            etiqueta: definicion ? `${definicion.numero} · ${definicion.nombre}` : codigo,
          };
        }),
        valorDe: (fila) => fila.instrumento.formato,
      },
      {
        id: 'escuela',
        etiqueta: 'Escuela',
        opciones: escuelas.map((escuela) => ({ valor: escuela.id, etiqueta: escuela.abreviatura })),
        valorDe: (fila) => fila.escuelaId,
      },
      {
        id: 'enviado',
        etiqueta: 'Situación del envío',
        opciones: [
          { valor: 'enviado', etiqueta: 'Enviado por el tutor' },
          { valor: 'borrador', etiqueta: 'En borrador' },
          { valor: 'no-iniciado', etiqueta: 'No iniciado' },
          { valor: 'aprobado', etiqueta: 'Aprobado en el registro' },
        ],
        valorDe: (fila) => fila.instrumento.estado,
      },
    ],
    [],
  );

  const filtro = useFiltro(filas, buscarEn, selects);

  const porTab: Record<EstadoRevision | 'todos', FilaRevision[]> = {
    todos: filtro.filtrados,
    pendiente: filtro.filtrados.filter((fila) => fila.estado === 'pendiente'),
    observado: filtro.filtrados.filter((fila) => fila.estado === 'observado'),
    aprobado: filtro.filtrados.filter((fila) => fila.estado === 'aprobado'),
  };
  const detalleFila = seleccionado
    ? (filas.find((fila) => fila.instrumento.id === seleccionado.id) ?? null)
    : null;
  const detalleFormato = seleccionado ? definicionPorCodigo(seleccionado.formato) : undefined;

  async function registrarDecision(estado: EstadoRevision) {
    if (!seleccionado || !user || estado === 'pendiente' || guardando) return;
    setGuardando(true);
    try {
      await persistirRevision(seleccionado, user, estado, comentario);
    } catch (error) {
      setAvisoInterno(error instanceof Error ? error.message : 'No se pudo registrar la revisión.');
      return;
    } finally {
      setGuardando(false);
    }
    const revisor = portal.docente
      ? `${portal.docente.nombres} ${portal.docente.apellidos}`
      : 'Coordinación de tutoría';
    if (!API_MODE)
      setDecisiones((actuales) => ({
        ...actuales,
        [seleccionado.id]: {
          estado,
          comentario:
            comentario.trim() ||
            (estado === 'aprobado'
              ? 'Informe revisado y conforme. Se aprueba para su descarga y consolidación.'
              : 'Se registra la observación para que el tutor subsane el informe.'),
          revisor,
          fecha: HOY_ISO,
        },
      }));
    setAvisoInterno(
      estado === 'aprobado'
        ? 'Informe aprobado. El tutor podrá descargar la constancia y el informe consolidado procede.'
        : 'Observación registrada. El docente tutor verá el requerimiento en su bandeja de instrumentos.',
    );
    setComentario('');
    setPestana(estado);
  }

  const columnas: Column<FilaRevision>[] = [
    {
      key: 'informe',
      header: 'Informe',
      sortable: true,
      sortValue: (fila) => `${fila.instrumento.formato} ${fila.instrumento.id}`,
      render: (fila) => (
        <span className="stack" style={{ gap: 1 }}>
          <strong className="cell-strong">
            {definicionPorCodigo(fila.instrumento.formato)?.nombre}
          </strong>
          <span className="cell-note">
            {fila.instrumento.formato} · {abreviaturaEscuela(fila.escuelaId)}
          </span>
        </span>
      ),
    },
    {
      key: 'tutor',
      header: 'Responsable',
      sortable: true,
      sortValue: (fila) => fila.tutor?.apellidos ?? '',
      render: (fila) =>
        fila.tutor ? `${fila.tutor.apellidos}, ${fila.tutor.nombres}` : 'Comisión de tutoría',
    },
    {
      key: 'registro',
      header: 'Registro',
      sortable: true,
      sortValue: (fila) => fila.instrumento.estado,
      render: (fila) => (
        <span className="stack" style={{ gap: 2 }}>
          <StatusBadge estado={fila.instrumento.estado} contexto="formulario" />
        </span>
      ),
    },
    {
      key: 'revision',
      header: 'Revisión',
      sortable: true,
      sortValue: (fila) => fila.estado,
      render: (fila) => (
        <span className="stack" style={{ gap: 2 }}>
          <StatusBadge estado={fila.estado} />
          <span className="cell-note">{formatFecha(fila.fecha)}</span>
        </span>
      ),
    },
    {
      key: 'acciones',
      header: 'Acciones',
      render: (fila) => (
        <span className="cell-actions">
          <button
            type="button"
            className="btn btn-falcon-default btn-sm"
            aria-label={`Revisar ${nombreFormato(fila.instrumento)}`}
            onClick={() => {
              setSeleccionado(fila.instrumento);
              setComentario('');
              setAvisoInterno(null);
            }}
          >
            <Eye aria-hidden="true" /> Revisar
          </button>
        </span>
      ),
    },
  ];

  return (
    <DirectoryPage>
      <PageHeading
        eyebrow={`Coordinación de tutoría · Revisión de informes · Semestre ${semestreActual}`}
        title="Revisar informes"
        description="Revisa los informes 01 y 02. Puedes aprobarlos o pedir correcciones."
      />

      <Card>
        <CardHead
          title="Bandeja de informes"
          actions={<Badge tone="info">{semestreActual}</Badge>}
        />
        <CardBody>
          <div className="stack">
            <DirectoryToolbar
              busqueda={filtro.busqueda}
              onBusqueda={filtro.setBusqueda}
              selects={selects}
              valores={filtro.valores}
              onValores={filtro.setValores}
              mostrados={porTab[pestana].length}
              total={
                pestana === 'todos'
                  ? filas.length
                  : filas.filter((fila) => fila.estado === pestana).length
              }
              onLimpiar={filtro.limpiar}
              etiqueta="Filtros de la bandeja de informes"
              placeholder="Buscar informe"
              views={
                <Tabs
                  etiqueta="Estado de revisión de los informes"
                  activo={pestana}
                  onChange={(id) => setPestana(id as EstadoRevision | 'todos')}
                  items={[
                    { id: 'pendiente', label: 'Pendiente', count: porTab.pendiente.length },
                    { id: 'observado', label: 'Por corregir', count: porTab.observado.length },
                    { id: 'aprobado', label: 'Aprobado', count: porTab.aprobado.length },
                    { id: 'todos', label: 'Todos', count: filtro.filtrados.length },
                  ]}
                />
              }
            />

            {(['pendiente', 'observado', 'aprobado', 'todos'] as const).map((id) => (
              <TabPanel key={id} id={id} activo={pestana}>
                <DataTable<FilaRevision>
                  rows={porTab[id]}
                  columns={columnas}
                  caption={`Informes 01 y 02 en estado ${id} · semestre ${semestreActual}`}
                  rowKey={(fila) => fila.instrumento.id}
                  pageSize={8}
                  pagination="auto"
                  paginationPosition="bottom"
                  inlineActions
                  initialSort={{ key: 'revision', direction: 'asc' }}
                  emptyTitle="Sin informes en esta pestaña"
                  emptyDescription="Cambia de pestaña o ajusta los filtros."
                />
              </TabPanel>
            ))}
          </div>
        </CardBody>
      </Card>

      <DirectoryDisclosure title="Guía de revisión">
        <p>
          El tutor envía el informe 02 y la comisión el 01. Revisa el contenido y aprueba o registra
          una observación.
        </p>
      </DirectoryDisclosure>
      {seleccionado && detalleFila && (
        <Sheet
          wide
          title={`Formato ${detalleFormato?.numero ?? '—'} · ${detalleFormato?.nombre ?? seleccionado.formato}`}
          description={`${seleccionado.id} · ${abreviaturaEscuela(detalleFila.escuelaId)} · semestre ${seleccionado.semestreId}`}
          onClose={() => {
            setSeleccionado(null);
            setAvisoInterno(null);
          }}
          footer={
            <>
              <button
                type="button"
                className="btn btn-link"
                onClick={() => {
                  setSeleccionado(null);
                  setAvisoInterno(null);
                }}
              >
                Cerrar
              </button>
              <button
                type="button"
                className="btn btn-outline-danger"
                disabled={guardando || !detalleFila.puedeRevisarse}
                onClick={() => registrarDecision('observado')}
              >
                <ClipboardCheck aria-hidden="true" /> Registrar observación
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={guardando || !detalleFila.puedeRevisarse}
                onClick={() => registrarDecision('aprobado')}
              >
                <FileCheck aria-hidden="true" /> Aprobar informe
              </button>
            </>
          }
        >
          <div className="stack stack--lg">
            {avisoInterno && (
              <Alert tone="ok" title="Registro de prueba">
                {avisoInterno}
              </Alert>
            )}

            {!detalleFila.puedeRevisarse && (
              <Alert tone="alerta" title="El informe aún no puede revisarse">
                Situación actual del registro: {seleccionado.estado}. Solo los informes enviados por
                el responsable pueden observarse o aprobarse.
              </Alert>
            )}

            <dl className="def-list">
              <div>
                <dt>Estado del registro</dt>
                <dd>
                  <StatusBadge estado={seleccionado.estado} contexto="formulario" /> · avance{' '}
                  {seleccionado.avance}% · versión {seleccionado.version}
                </dd>
              </div>
              <div>
                <dt>Envío del informe</dt>
                <dd>
                  {seleccionado.enviado
                    ? `Enviado el ${formatFecha(seleccionado.enviado)}`
                    : 'Aún no enviado al sistema'}
                </dd>
              </div>
              <div>
                <dt>Revisión actual</dt>
                <dd>
                  {detalleFila.estado} · {detalleFila.revisor} · {formatFecha(detalleFila.fecha)}
                </dd>
              </div>
              <div>
                <dt>Comentario de revisión</dt>
                <dd>{detalleFila.comentario}</dd>
              </div>
            </dl>

            <DirectoryDisclosure title="Ficha del formato">
              <dl className="def-list">
                <div>
                  <dt>Responsable que responde</dt>
                  <dd>{detalleFormato?.actorEtiqueta ?? '—'}</dd>
                </div>
                <div>
                  <dt>Momento de presentación</dt>
                  <dd>{detalleFormato?.momento ?? '—'}</dd>
                </div>
                <div>
                  <dt>Requisito</dt>
                  <dd>
                    {detalleFormato?.obligatorio ? 'Formulario obligatorio' : 'Formulario opcional'}
                  </dd>
                </div>
                <div>
                  <dt>Versión y aprobación</dt>
                  <dd>
                    {detalleFormato?.version ?? '—'} · {detalleFormato?.aprobacion ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt>Vigencia</dt>
                  <dd>{detalleFormato?.vigencia ?? '—'}</dd>
                </div>
                <div>
                  <dt>Firmas de aprobación</dt>
                  <dd>{detalleFormato?.visaciones.join(' · ') ?? '—'}</dd>
                </div>
              </dl>
            </DirectoryDisclosure>

            <div>
              <div className="section-head">
                <h2>Secciones y campos del formulario</h2>
                <p>{detalleFormato?.secciones.length ?? 0} secciones</p>
              </div>
              <div className="stack">
                {detalleFormato?.secciones.map((seccion) => (
                  <Card key={seccion.titulo} flat>
                    <CardHead
                      title={seccion.titulo}
                      description={`${seccion.campos.length} campos`}
                    />
                    <CardBody>
                      <dl className="def-list">
                        {seccion.campos.map((campo) => {
                          const respuesta = seleccionado.respuestas[campo.codigo];
                          return (
                            <div key={campo.codigo}>
                              <dt>{campo.etiqueta}</dt>
                              <dd>{respuesta || 'Sin respuesta'}</dd>
                            </div>
                          );
                        })}
                      </dl>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </div>

            <div className="grid grid--2">
              <div>
                <div className="section-head">
                  <h2>Observaciones registradas</h2>
                  <p>{seleccionado.observaciones.length} en el historial</p>
                </div>
                {seleccionado.observaciones.length === 0 ? (
                  <EmptyState
                    title="Sin observaciones"
                    description="El informe no tiene observaciones registradas en su historial."
                    icon={<ClipboardCheck />}
                  />
                ) : (
                  <ul className="list">
                    {seleccionado.observaciones.map((observacion) => (
                      <li className="list__item" key={observacion.id}>
                        <span
                          className={`list__icon list__icon--${observacion.estado === 'abierta' ? 'danger' : 'ok'}`}
                          aria-hidden="true"
                        >
                          <ClipboardCheck />
                        </span>
                        <span className="list__body">
                          <strong>{observacion.texto}</strong>
                          <p>
                            {observacion.autor} · {formatFecha(observacion.fecha)}
                          </p>
                        </span>
                        <span className="list__aside">
                          <StatusBadge estado={observacion.estado} />
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="stack stack--sm">
                <div className="field">
                  <label htmlFor={idObservacion}>Comentario de la revisión</label>
                  <textarea
                    id={idObservacion}
                    className="textarea"
                    value={comentario}
                    onChange={(evento) => setComentario(evento.target.value)}
                    placeholder="Ej.: precise el número de atenciones acumuladas y adjunte la lista de asistencia."
                  />
                  <span className="field__hint">
                    El comentario se guarda con su nombre, la fecha y el estado de la revisión.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Sheet>
      )}
      {API_MODE && <SeguimientosCoordinacion />}
    </DirectoryPage>
  );
}
