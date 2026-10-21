import { useCallback, useId, useMemo, useState } from 'react';
import {
  ClipboardCheck,
  Download,
  Eye,
  FileCheck,
  FileClock,
  FileText,
  ListChecks,
  Send,
  ShieldCheck,
} from '../../components/ui/icons';
import { PageHeading } from '../../components/ui/PageHeading';
import { Card, CardBody, CardFoot, CardHead } from '../../components/ui/Card';
import { Stat } from '../../components/ui/Stat';
import { Alert } from '../../components/ui/Alert';
import { Badge, StatusBadge } from '../../components/ui/StatusBadge';
import { DataTable } from '../../components/ui/DataTable';
import type { Column } from '../../components/ui/DataTable';
import { Sheet } from '../../components/ui/Sheet';
import { Tabs, TabPanel } from '../../components/ui/Tabs';
import { Timeline } from '../../components/ui/Timeline';
import { EmptyState } from '../../components/ui/EmptyState';
import { PanelFiltros, useFiltro } from '../../components/panels/PanelFiltros';
import type { DefinicionSelect } from '../../components/panels/PanelFiltros';
import { usePortal } from '../../hooks/usePortal';
import { useAuth } from '../../hooks/useAuth';
import { revisarInstrumento } from '../../services/instrumentWorkspace';
import type { CodigoFormato, DefinicionFormato, Docente, Instrumento } from '../../types/domain';
import { abreviaturaEscuela, docentePorId, escuelaDe } from '../../data/personas';
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
  definicion: DefinicionFormato | undefined;
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
          definicion: definicionPorCodigo(instrumento.formato),
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

  const conteo = (estado: EstadoRevision) => filas.filter((fila) => fila.estado === estado).length;
  const porTab: Record<EstadoRevision | 'todos', FilaRevision[]> = {
    todos: filtro.filtrados,
    pendiente: filtro.filtrados.filter((fila) => fila.estado === 'pendiente'),
    observado: filtro.filtrados.filter((fila) => fila.estado === 'observado'),
    aprobado: filtro.filtrados.filter((fila) => fila.estado === 'aprobado'),
  };
  const sinIniciar = filas.filter((fila) => fila.instrumento.estado === 'no-iniciado').length;
  const conObservacionAbierta = filas.filter((fila) =>
    fila.instrumento.observaciones.some((observacion) => observacion.estado === 'abierta'),
  ).length;

  const detalleFila = seleccionado
    ? (filas.find((fila) => fila.instrumento.id === seleccionado.id) ?? null)
    : null;
  const detalleFormato = seleccionado ? definicionPorCodigo(seleccionado.formato) : undefined;

  function registrarDecision(estado: EstadoRevision) {
    if (!seleccionado || !user || estado === 'pendiente') return;
    try {
      revisarInstrumento(seleccionado.id, user, estado, comentario);
    } catch (error) {
      setAvisoInterno(error instanceof Error ? error.message : 'No se pudo registrar la revisión.');
      return;
    }
    const revisor = portal.docente
      ? `${portal.docente.nombres} ${portal.docente.apellidos}`
      : 'Coordinación de tutoría';
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
          <strong className="cell-strong">{nombreFormato(fila.instrumento)}</strong>
          <span className="cell-note mono">{fila.instrumento.id}</span>
        </span>
      ),
    },
    {
      key: 'ambito',
      header: 'Corresponde a',
      sortable: true,
      sortValue: (fila) => abreviaturaEscuela(fila.escuelaId),
      render: (fila) => (
        <span className="stack" style={{ gap: 1 }}>
          <Badge tone="info">{abreviaturaEscuela(fila.escuelaId)}</Badge>
          <span className="cell-note">{escuelaDe(fila.escuelaId)}</span>
        </span>
      ),
    },
    {
      key: 'tutor',
      header: 'Responsable del informe',
      sortable: true,
      sortValue: (fila) => fila.tutor?.apellidos ?? '',
      render: (fila) => (
        <span className="stack" style={{ gap: 1 }}>
          <span>
            {fila.tutor ? `${fila.tutor.apellidos}, ${fila.tutor.nombres}` : 'Equipo de tutores'}
          </span>
          <span className="cell-note">
            {fila.instrumento.formato === 'F01' ? 'Consolidado de la comisión' : 'Docente tutor'}
          </span>
        </span>
      ),
    },
    {
      key: 'registro',
      header: 'Situación del registro',
      sortable: true,
      sortValue: (fila) => fila.instrumento.estado,
      render: (fila) => (
        <span className="stack" style={{ gap: 2 }}>
          <StatusBadge estado={fila.instrumento.estado} contexto="formulario" />
          <span className="cell-note">
            Avance {fila.instrumento.avance}% · v.{fila.instrumento.version}
          </span>
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
          <StatusBadge estado={fila.estado} etiqueta={`Revisión: ${fila.estado}`} />
          <span className="cell-note">{formatFecha(fila.fecha)}</span>
        </span>
      ),
    },
    {
      key: 'observaciones',
      header: 'Observaciones',
      sortable: true,
      sortValue: (fila) => fila.instrumento.observaciones.length,
      render: (fila) =>
        fila.instrumento.observaciones.length === 0 ? (
          <span className="muted small">Ninguna</span>
        ) : (
          <span className="stack" style={{ gap: 2 }}>
            {fila.instrumento.observaciones.map((observacion) => (
              <StatusBadge
                key={observacion.id}
                estado={observacion.estado}
                etiqueta={
                  observacion.estado === 'abierta' ? 'Observación abierta' : 'Observación subsanada'
                }
              />
            ))}
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
    <>
      <PageHeading
        eyebrow={`Coordinación de tutoría · Revisión de informes · Semestre ${semestreActual}`}
        title="Revisar informes"
        description="Revisa los informes 01 y 02. Puedes aprobarlos o pedir correcciones."
        actions={
          <>
            <Badge tone={conteo('pendiente') ? 'alerta' : 'ok'}>
              {conteo('pendiente')} por revisar
            </Badge>
            <Badge tone="riesgo">{conteo('observado')} observados</Badge>
          </>
        }
      />

      <div className="grid grid--4">
        <Stat
          label="Informes en bandeja"
          value={filas.length}
          note="Formatos 01 y 02 del semestre en curso"
          icon={<ListChecks aria-hidden="true" />}
        />
        <Stat
          label="Pendientes de revisión"
          value={conteo('pendiente')}
          note={`${sinIniciar} informes sin iniciar`}
          icon={<FileClock aria-hidden="true" />}
          tone={conteo('pendiente') ? 'alerta' : 'verde'}
        />
        <Stat
          label="Por corregir"
          value={conteo('observado')}
          note={`${conObservacionAbierta} con observación abierta`}
          icon={<ClipboardCheck aria-hidden="true" />}
          tone={conteo('observado') ? 'riesgo' : 'verde'}
        />
        <Stat
          label="Aprobados"
          value={conteo('aprobado')}
          note="Habilitados para descarga y consolidación"
          icon={<FileCheck aria-hidden="true" />}
          tone="verde"
        />
      </div>

      <Alert tone="info" title="Cómo se revisa un informe">
        El tutor envía el informe 02 y la comisión el informe 01; la coordinación revisa y registra
        la aprobación o la observación. Un informe observado vuelve al tutor con el plazo de
        subsanación. La descarga se habilita al aprobarse.
      </Alert>

      <Card>
        <CardHead
          title="Bandeja de informes"
          description="Filtra por formato, escuela o situación del envío; las pestañas agrupan por estado de revisión."
          actions={<Badge tone="info">{semestreActual}</Badge>}
        />
        <CardBody>
          <div className="stack">
            <PanelFiltros<FilaRevision>
              busqueda={filtro.busqueda}
              onBusqueda={filtro.setBusqueda}
              selects={selects}
              valores={filtro.valores}
              onValor={(id, valor) =>
                filtro.setValores((actuales) => ({ ...actuales, [id]: valor }))
              }
              mostrados={filtro.filtrados.length}
              total={filas.length}
              activos={filtro.activos}
              onLimpiar={filtro.limpiar}
              etiqueta="Filtros de la bandeja de informes"
              placeholder="Buscar por formato, tutor o código…"
            />

            <Tabs
              etiqueta="Estado de revisión de los informes"
              activo={pestana}
              onChange={(id) => setPestana(id as EstadoRevision | 'todos')}
              items={[
                { id: 'pendiente', label: 'Pendiente', count: conteo('pendiente') },
                { id: 'observado', label: 'Por corregir', count: conteo('observado') },
                { id: 'aprobado', label: 'Aprobado', count: conteo('aprobado') },
                { id: 'todos', label: 'Todos', count: filtro.filtrados.length },
              ]}
            />

            {(['pendiente', 'observado', 'aprobado', 'todos'] as const).map((id) => (
              <TabPanel key={id} id={id} activo={pestana}>
                <DataTable<FilaRevision>
                  rows={porTab[id]}
                  columns={columnas}
                  caption={`Informes 01 y 02 en estado ${id} · semestre ${semestreActual}`}
                  rowKey={(fila) => fila.instrumento.id}
                  pageSize={8}
                  initialSort={{ key: 'revision', direction: 'asc' }}
                  emptyTitle="Sin informes en esta pestaña"
                  emptyDescription="Cambia de pestaña o ajuste los filtros de la bandeja."
                />
              </TabPanel>
            ))}
          </div>
        </CardBody>
        <CardFoot>
          <span>
            La revisión usa los datos del formulario: no se crea un registro paralelo al formato
            oficial.
          </span>
          <span className="ui-row ui-row--tight">
            <ShieldCheck aria-hidden="true" /> Solo la coordinación del ámbito puede aprobar.
          </span>
        </CardFoot>
      </Card>

      <div className="grid grid--sidebar">
        <Card>
          <CardHead
            title="Contenido del informe"
            description="Secciones y campos oficiales que respaldan la revisión"
          />
          <CardBody flush>
            <ul className="list">
              {FORMATOS_INFORME.map((codigo) => {
                const definicion = definicionPorCodigo(codigo);
                if (!definicion) return null;
                const totalCampos = definicion.secciones.reduce(
                  (total, seccion) => total + seccion.campos.length,
                  0,
                );
                return (
                  <li className="list__item" key={codigo}>
                    <span className="list__icon" aria-hidden="true">
                      <FileText />
                    </span>
                    <span className="list__body">
                      <strong>
                        Formato {definicion.numero} · {definicion.nombre}
                      </strong>
                      <p>{definicion.proposito}</p>
                      <span className="list__meta">
                        <span>{definicion.secciones.length} secciones</span>
                        <span>{totalCampos} campos</span>
                        <span>Responde: {definicion.actorEtiqueta}</span>
                      </span>
                    </span>
                    <span className="list__aside">
                      <Badge tone={definicion.obligatorio ? 'ok' : 'neutro'}>
                        {definicion.obligatorio ? 'Obligatorio' : 'Opcional'}
                      </Badge>
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardBody>
          <CardFoot>
            <span>Vigencia de los formatos pendiente de confirmación por el área usuaria.</span>
          </CardFoot>
        </Card>

        <Card accent>
          <CardHead title="Pasos de revisión" description="Historial de la revisión." />
          <CardBody>
            <Timeline
              etiqueta="Circuito de revisión de informes"
              hitos={[
                {
                  titulo: 'Registro del informe',
                  descripcion: 'El tutor o la comisión completa el formato y lo envía al sistema.',
                  tono: 'info',
                },
                {
                  titulo: 'Revisión de la coordinación',
                  descripcion: 'Se verifican la cobertura, las actividades y las evidencias.',
                  tono: 'info',
                },
                {
                  titulo: 'Observación o aprobación',
                  descripcion:
                    'La observación vuelve al responsable; la aprobación habilita la descarga.',
                  tono: 'alerta',
                },
                {
                  titulo: 'Consolidación final',
                  descripcion: 'El informe 01 reúne la información aprobada de la escuela.',
                  tono: 'ok',
                },
              ]}
            />
          </CardBody>
        </Card>
      </div>

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
                disabled={!detalleFila.puedeRevisarse}
                onClick={() => registrarDecision('observado')}
              >
                <ClipboardCheck aria-hidden="true" /> Registrar observación
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!detalleFila.puedeRevisarse}
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
                              <dt>
                                <span className="mono">{campo.codigo}</span>
                                {campo.obligatorio && <span className="field__required"> *</span>}
                              </dt>
                              <dd>
                                <strong>{campo.etiqueta}</strong>
                                <span className="cell-note">
                                  Tipo {campo.tipo}
                                  {campo.opciones?.length
                                    ? ` · opciones: ${campo.opciones.join(' / ')}`
                                    : ''}
                                </span>
                                {respuesta && (
                                  <span className="cell-note">Respuesta: {respuesta}</span>
                                )}
                                {campo.ayuda && <span className="cell-note">{campo.ayuda}</span>}
                              </dd>
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
                <Alert tone="info" title="Cifras que debes comprobar">
                  Estudiantes asignados, estudiantes únicos atendidos, atenciones acumuladas y
                  sesiones realizadas se revisan por separado (acta del 7 de octubre de 2026, punto
                  QUINTO).
                </Alert>
                <Alert tone="ok" title="Descarga del informe">
                  <Download aria-hidden="true" /> La descarga se habilita cuando el informe queda
                  aprobado; queda registrada en la auditoría.
                </Alert>
                <Alert tone="alerta" title="Reglas pendientes de confirmación">
                  <Send aria-hidden="true" /> La vigencia de los formatos y las reglas de llenado
                  por actor siguen pendientes de confirmación por Tutoría y Capacitación Docente.
                </Alert>
              </div>
            </div>
          </div>
        </Sheet>
      )}
    </>
  );
}
