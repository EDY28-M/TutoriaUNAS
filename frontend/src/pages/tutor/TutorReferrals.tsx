import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeading } from '../../components/ui/PageHeading';
import { Card, CardBody, CardFoot, CardHead } from '../../components/ui/Card';
import { Alert } from '../../components/ui/Alert';
import { Badge, StatusBadge } from '../../components/ui/StatusBadge';
import { DataTable } from '../../components/ui/DataTable';
import type { Column } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { PersonCell } from '../../components/ui/PersonCell';
import { Sheet } from '../../components/ui/Sheet';
import { Timeline } from '../../components/ui/Timeline';
import { PanelFiltros, useFiltro } from '../../components/panels/PanelFiltros';
import type { DefinicionSelect } from '../../components/panels/PanelFiltros';
import { usePortal } from '../../hooks/usePortal';
import { areasDerivacion, etiquetasEstadoDerivacion, semestreActual } from '../../data/catalogos';
import { definicionPorCodigo } from '../../data/formatos';
import {
  abreviaturaEscuela,
  estudiantePorId,
  iniciales,
  nombreCompleto,
} from '../../data/personas';
import type { Derivacion, Estudiante } from '../../types/domain';
import { HOY_ISO, formatFecha, formatFechaHora } from '../../utils/fechas';
import '../../assets/vendor/fontawesome.min.css';
import '../../styles/tutor-referrals.css';

interface FilaDerivacion {
  derivacion: Derivacion;
  estudiante: Estudiante | undefined;
  areaNombre: string;
  tiempoRespuesta: string;
  responsableArea: string;
}
const ESTADOS_ABIERTOS: Derivacion['estado'][] = [
  'registrada',
  'recibida',
  'citada',
  'en-atencion',
  'seguimiento',
  'no-presentado',
];
const ESTADOS_SEGUIMIENTO: Derivacion['estado'][] = ['citada', 'en-atencion', 'seguimiento'];
const PRIORIDADES: Derivacion['prioridad'][] = ['alta', 'media', 'baja'];

/** Bandeja y seguimiento del formato 12, con los datos administrativos comunicables. */
export function TutorReferrals() {
  const portal = usePortal();
  const { docente, tutorados } = portal;
  const [parametros] = useSearchParams();
  const enSeguimiento = parametros.get('estado') === 'seguimiento';
  const [seleccionId, setSeleccionId] = useState<string | null>(null);
  const [nuevaAbierta, setNuevaAbierta] = useState(false);
  const [areasAbiertas, setAreasAbiertas] = useState(false);
  const [tablaCompleta, setTablaCompleta] = useState(false);
  const [areaDestino, setAreaDestino] = useState<string>('psicopedagogia');
  const filas: FilaDerivacion[] = portal.derivaciones.map((derivacion) => {
    const area = areasDerivacion.find((item) => item.id === derivacion.area);
    return {
      derivacion,
      estudiante: estudiantePorId(derivacion.estudianteId),
      areaNombre: area?.nombre ?? derivacion.area,
      tiempoRespuesta: area?.tiempoRespuesta ?? 'Por confirmar con el área',
      responsableArea: area?.responsable ?? derivacion.responsableArea,
    };
  });
  const areasPresentes = [...new Set(filas.map((fila) => fila.derivacion.area))];
  const estadosPresentes = [...new Set(filas.map((fila) => fila.derivacion.estado))];
  const selects: DefinicionSelect<FilaDerivacion>[] = [
    {
      id: 'area',
      etiqueta: 'Área',
      opciones: areasPresentes.map((area) => ({
        valor: area,
        etiqueta: areasDerivacion.find((item) => item.id === area)?.nombre ?? area,
      })),
      valorDe: (fila) => fila.derivacion.area,
    },
    {
      id: 'estado',
      etiqueta: 'Estado',
      opciones: estadosPresentes.map((estado) => ({
        valor: estado,
        etiqueta: etiquetasEstadoDerivacion[estado] ?? estado,
      })),
      valorDe: (fila) => fila.derivacion.estado,
    },
    {
      id: 'prioridad',
      etiqueta: 'Prioridad',
      opciones: PRIORIDADES.map((prioridad) => ({
        valor: prioridad,
        etiqueta: `Prioridad ${prioridad}`,
      })),
      valorDe: (fila) => fila.derivacion.prioridad,
    },
  ];
  const filtro = useFiltro(
    filas,
    (fila) =>
      `${fila.estudiante ? nombreCompleto(fila.estudiante) : ''} ${fila.estudiante?.codigo ?? ''} ${fila.derivacion.motivo} ${fila.derivacion.codigo}`,
    selects,
  );
  const filtradasSeguimiento = filtro.filtrados.filter((fila) =>
    ESTADOS_SEGUIMIENTO.includes(fila.derivacion.estado),
  );
  const visibles = enSeguimiento ? filtradasSeguimiento : filtro.filtrados;
  const delAlcance = enSeguimiento
    ? filas.filter((fila) => ESTADOS_SEGUIMIENTO.includes(fila.derivacion.estado))
    : filas;
  function enlaceVista(seguimiento: boolean) {
    const siguientes = new URLSearchParams(parametros);
    if (seguimiento) siguientes.set('estado', 'seguimiento');
    else siguientes.delete('estado');
    return `/tutor/derivaciones${siguientes.size ? `?${siguientes}` : ''}`;
  }
  const columnaEstudiante: Column<FilaDerivacion> = {
    key: 'estudiante',
    header: 'Estudiante',
    sortable: true,
    sortValue: (fila) => fila.estudiante?.apellidos ?? '',
    render: (fila) =>
      fila.estudiante ? (
        <Link
          className="referral-student"
          to={`/tutor/tutorados/${fila.estudiante.id}`}
          aria-label={`Ver expediente de ${nombreCompleto(fila.estudiante)}`}
        >
          <PersonCell
            nombres={fila.estudiante.nombres}
            apellidos={fila.estudiante.apellidos}
            iniciales={iniciales(fila.estudiante)}
            detalle={`${fila.estudiante.codigo} · Ciclo ${fila.estudiante.ciclo}`}
          />
        </Link>
      ) : (
        <span className="muted">Estudiante no disponible</span>
      ),
  };
  const columnaPrioridad: Column<FilaDerivacion> = {
    key: 'prioridad',
    header: 'Prioridad',
    sortable: true,
    sortValue: (fila) => PRIORIDADES.indexOf(fila.derivacion.prioridad),
    render: (fila) => <StatusBadge estado={fila.derivacion.prioridad} />,
  };
  const columnaEstado: Column<FilaDerivacion> = {
    key: 'estado',
    header: 'Estado',
    sortable: true,
    sortValue: (fila) => fila.derivacion.estado,
    render: (fila) => <StatusBadge estado={fila.derivacion.estado} />,
  };
  const columnaFecha: Column<FilaDerivacion> = {
    key: 'actualizado',
    header: 'Actualizado',
    sortable: true,
    sortValue: (fila) => fila.derivacion.actualizado,
    render: (fila) => (
      <span className="referral-date">{formatFecha(fila.derivacion.actualizado)}</span>
    ),
  };
  const columnaDetalle: Column<FilaDerivacion> = {
    key: 'detalle',
    header: 'Caso',
    render: (fila) => (
      <button
        type="button"
        className="referral-open"
        onClick={() => setSeleccionId(fila.derivacion.id)}
        aria-label={`Ver seguimiento de la solicitud de apoyo ${fila.derivacion.codigo}`}
      >
        Ver caso <i className="fa-solid fa-arrow-right" aria-hidden="true" />
      </button>
    ),
  };
  const columnasResumen: Column<FilaDerivacion>[] = [
    columnaEstudiante,
    {
      key: 'solicitud',
      header: 'Solicitud',
      sortable: true,
      sortValue: (fila) => fila.derivacion.motivo,
      render: (fila) => (
        <div className="referral-subject">
          <strong>{fila.areaNombre}</strong>
          <span>{fila.derivacion.motivo}</span>
          <small>{fila.derivacion.codigo}</small>
        </div>
      ),
    },
    {
      ...columnaEstado,
      header: 'Estado y prioridad',
      render: (fila) => (
        <div className="referral-state">
          <StatusBadge estado={fila.derivacion.estado} />
          <StatusBadge estado={fila.derivacion.prioridad} />
        </div>
      ),
    },
    columnaFecha,
    columnaDetalle,
  ];
  const columnasCompletas: Column<FilaDerivacion>[] = [
    columnaEstudiante,
    {
      key: 'area',
      header: 'Área de destino',
      sortable: true,
      sortValue: (fila) => fila.areaNombre,
      render: (fila) => (
        <>
          <span className="cell-strong">{fila.areaNombre}</span>
          <span className="cell-note">Respuesta: {fila.tiempoRespuesta}</span>
        </>
      ),
    },
    {
      key: 'motivo',
      header: 'Motivo',
      sortable: true,
      sortValue: (fila) => fila.derivacion.motivo,
      render: (fila) => (
        <>
          <span>{fila.derivacion.motivo}</span>
          <span className="cell-note">
            {fila.derivacion.recomendacionComunicable
              ? 'Recomendación autorizada'
              : 'Sin recomendación autorizada'}
          </span>
        </>
      ),
    },
    columnaPrioridad,
    columnaEstado,
    {
      ...columnaFecha,
      render: (fila) => (
        <>
          <span className="referral-date">{formatFecha(fila.derivacion.actualizado)}</span>
          <span className="cell-note mono">{fila.derivacion.codigo}</span>
        </>
      ),
    },
    {
      key: 'siguiente',
      header: 'Siguiente acción',
      render: (fila) => fila.derivacion.siguienteAccion,
    },
    columnaDetalle,
  ];
  if (!docente)
    return (
      <PageHeading
        eyebrow="Acompañamiento tutorial"
        title="Solicitudes de apoyo"
        description="La cuenta de demostración no tiene una ficha de docente tutor asociada."
      />
    );
  const seleccion = filas.find((fila) => fila.derivacion.id === seleccionId);
  const abiertas = delAlcance.filter((fila) => ESTADOS_ABIERTOS.includes(fila.derivacion.estado));
  const enAtencion = delAlcance.filter((fila) =>
    ESTADOS_SEGUIMIENTO.includes(fila.derivacion.estado),
  );
  const cerradas = delAlcance.filter((fila) =>
    ['atendida', 'cerrada'].includes(fila.derivacion.estado),
  );
  const prioridadAlta = delAlcance.filter((fila) => fila.derivacion.prioridad === 'alta');
  const areaSeleccionada = areasDerivacion.find((area) => area.id === areaDestino);
  const tutoradosResueltos = tutorados.flatMap((asignacion) => {
    const estudiante = estudiantePorId(asignacion.estudianteId);
    return estudiante ? [estudiante] : [];
  });
  return (
    <div className="tutor-referrals">
      <PageHeading
        eyebrow={`Docente tutor · ${abreviaturaEscuela(docente.escuelaId)} · Semestre ${semestreActual}`}
        title={enSeguimiento ? 'Seguimiento de solicitudes' : 'Solicitudes de apoyo'}
        description={
          enSeguimiento
            ? `Citas, atenciones y seguimiento · ${semestreActual}`
            : `${semestreActual} · ${abreviaturaEscuela(docente.escuelaId)} · Atención especializada`
        }
        actions={
          <>
            <Link className="btn btn-falcon-default" to="/tutor/reportes">
              <i className="fa-solid fa-chart-simple" aria-hidden="true" /> Ver reportes
            </Link>
            <button
              type="button"
              className="btn btn-primary"
              aria-label="Nueva solicitud de apoyo"
              onClick={() => setNuevaAbierta(true)}
            >
              <i className="fa-solid fa-plus" aria-hidden="true" /> Nueva solicitud
            </button>
          </>
        }
      />
      <dl
        className="referral-metrics"
        aria-label={
          enSeguimiento
            ? 'Resumen de solicitudes en seguimiento'
            : 'Resumen de todas las solicitudes'
        }
      >
        <div>
          <dt>Abiertas</dt>
          <dd>
            <strong>{abiertas.length}</strong>
            <small>Requieren seguimiento</small>
          </dd>
        </div>
        <div>
          <dt>En atención o seguimiento</dt>
          <dd>
            <strong>{enAtencion.length}</strong>
            <small>Incluye citas programadas</small>
          </dd>
        </div>
        <div>
          <dt>Atendidas o cerradas</dt>
          <dd>
            <strong>{cerradas.length}</strong>
            <small>Atención concluida</small>
          </dd>
        </div>
        <div>
          <dt>Prioridad alta</dt>
          <dd>
            <strong>{prioridadAlta.length}</strong>
            <small>Acompañamiento cercano</small>
          </dd>
        </div>
      </dl>
      <Card className={`referral-list${tablaCompleta ? ' referral-list--complete' : ''}`}>
        <CardHead
          title={enSeguimiento ? 'Casos en seguimiento' : 'Bandeja de solicitudes'}
          actions={
            <div className="referral-view" role="group" aria-label="Vista de solicitudes">
              <button
                type="button"
                aria-pressed={!tablaCompleta}
                onClick={() => setTablaCompleta(false)}
              >
                Resumen
              </button>
              <button
                type="button"
                aria-pressed={tablaCompleta}
                onClick={() => setTablaCompleta(true)}
              >
                Datos completos
              </button>
            </div>
          }
        />
        <nav className="referral-tabs" aria-label="Bandejas de solicitudes de apoyo">
          <Link to={enlaceVista(false)} aria-current={!enSeguimiento ? 'page' : undefined}>
            Todas <span>{filtro.filtrados.length}</span>
          </Link>
          <Link to={enlaceVista(true)} aria-current={enSeguimiento ? 'page' : undefined}>
            En seguimiento <span>{filtradasSeguimiento.length}</span>
          </Link>
        </nav>
        <CardBody>
          <div className="referral-list__content">
            <PanelFiltros<FilaDerivacion>
              busqueda={filtro.busqueda}
              onBusqueda={filtro.setBusqueda}
              selects={selects}
              valores={filtro.valores}
              onValor={(id, valor) => filtro.setValores((actual) => ({ ...actual, [id]: valor }))}
              mostrados={visibles.length}
              total={delAlcance.length}
              activos={filtro.activos}
              onLimpiar={filtro.limpiar}
              etiqueta="Filtros de solicitudes de apoyo"
              placeholder="Estudiante, motivo o código…"
            />
            <span className="sr-only" role="status">
              {visibles.length} solicitudes {enSeguimiento ? 'en seguimiento' : 'en la bandeja'}
            </span>
            <DataTable<FilaDerivacion>
              key={tablaCompleta ? 'completa' : 'resumen'}
              rows={visibles}
              columns={tablaCompleta ? columnasCompletas : columnasResumen}
              caption="Solicitudes de apoyo registradas por el docente tutor con su estado de la atención"
              rowKey={(fila) => fila.derivacion.id}
              emptyTitle="Sin solicitudes de apoyo que coincidan"
              emptyDescription={
                filtro.activos
                  ? 'Ajusta la búsqueda o limpia los filtros para ver los casos.'
                  : enSeguimiento
                    ? 'Aquí aparecerán las solicitudes con cita, en atención o en seguimiento.'
                    : 'Registra una solicitud cuando un estudiante necesite atención especializada.'
              }
              initialSort={{ key: 'actualizado', direction: 'desc' }}
              pagination="auto"
            />
          </div>
        </CardBody>
        <CardFoot>
          <span>
            Formato {definicionPorCodigo('F12')?.numero} · {definicionPorCodigo('F12')?.nombre}
          </span>
          <button
            type="button"
            className="referral-text-action"
            onClick={() => setAreasAbiertas(true)}
          >
            <i className="fa-solid fa-address-book" aria-hidden="true" /> Áreas y contactos
          </button>
        </CardFoot>
      </Card>
      <details className="referral-disclosure">
        <summary>
          <i className="fa-solid fa-chart-simple" aria-hidden="true" />
          <span>Resumen por estado</span>
          <Badge>{delAlcance.length}</Badge>
          <i className="fa-solid fa-chevron-down" aria-hidden="true" />
        </summary>
        {!delAlcance.length ? (
          <EmptyState
            title="Sin solicitudes de apoyo registradas"
            description="Los estados aparecerán al registrar una ficha de derivación."
          />
        ) : (
          <ul className="referral-states">
            {estadosPresentes.map((estado) => {
              const delEstado = delAlcance.filter((fila) => fila.derivacion.estado === estado);
              if (!delEstado.length) return null;
              return (
                <li key={estado}>
                  <div>
                    <StatusBadge estado={estado} />
                    <strong>
                      {delEstado.length}
                      <small> caso(s)</small>
                    </strong>
                  </div>
                  <meter
                    min={0}
                    max={delAlcance.length}
                    value={delEstado.length}
                    aria-label={`${etiquetasEstadoDerivacion[estado]}: ${delEstado.length} de ${delAlcance.length}`}
                  />
                  <small>
                    {delEstado.every((fila) => fila.derivacion.recomendacionComunicable)
                      ? 'Con recomendación autorizada'
                      : 'Algún caso sin recomendación autorizada'}
                  </small>
                </li>
              );
            })}
          </ul>
        )}
        <p className="referral-note">
          Estados propuestos por las áreas, pendientes de validación.{' '}
          <Link to="/tutor/tutorados">
            Ver estudiantes <i className="fa-solid fa-arrow-right" aria-hidden="true" />
          </Link>
        </p>
      </details>
      <details className="referral-disclosure referral-privacy">
        <summary>
          <i className="fa-solid fa-shield-halved" aria-hidden="true" />
          <span>Información compartida con el tutor</span>
          <i className="fa-solid fa-chevron-down" aria-hidden="true" />
        </summary>
        <p>
          El tutor consulta el área de destino, el estado y las recomendaciones autorizadas. Los
          diagnósticos, historias clínicas y detalles de atención permanecen en el área
          especializada.
        </p>
      </details>
      {areasAbiertas && (
        <Sheet
          title="Áreas de atención y contactos"
          description="Responsables y tiempos estimados de respuesta"
          onClose={() => setAreasAbiertas(false)}
          wide
          footer={
            <button
              type="button"
              className="btn btn-falcon-default"
              onClick={() => setAreasAbiertas(false)}
            >
              Cerrar
            </button>
          }
        >
          <div className="referral-directory">
            {areasDerivacion.map((area) => (
              <article key={area.id}>
                <header>
                  <strong>{area.nombre}</strong>
                  <Badge tone="info">
                    {filas.filter((fila) => fila.derivacion.area === area.id).length} caso(s)
                  </Badge>
                </header>
                <p>{area.responsable}</p>
                <a href={`mailto:${area.correo}`}>
                  <i className="fa-regular fa-envelope" aria-hidden="true" />
                  {area.correo}
                </a>
                <small>
                  <i className="fa-regular fa-clock" aria-hidden="true" />
                  Respuesta estimada: {area.tiempoRespuesta}
                </small>
              </article>
            ))}
          </div>
        </Sheet>
      )}
      {seleccion && (
        <Sheet
          title={`${seleccion.derivacion.codigo} · ${seleccion.areaNombre}`}
          description={
            seleccion.estudiante
              ? `${nombreCompleto(seleccion.estudiante)} · ${seleccion.estudiante.codigo}`
              : 'Estudiante no disponible'
          }
          onClose={() => setSeleccionId(null)}
          wide
          footer={
            <>
              <button
                type="button"
                className="btn btn-falcon-default"
                onClick={() => setSeleccionId(null)}
              >
                Cerrar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setSeleccionId(null)}
              >
                Notificar al área (demostración)
              </button>
            </>
          }
        >
          <div className="referral-case">
            <div className="referral-case__badges">
              <StatusBadge estado={seleccion.derivacion.estado} />
              <StatusBadge estado={seleccion.derivacion.prioridad} />
            </div>
            <section className="referral-next">
              <h3>Próximo paso</h3>
              <p>{seleccion.derivacion.siguienteAccion}</p>
              <small>Actualizado el {formatFechaHora(seleccion.derivacion.actualizado)}</small>
            </section>
            <dl className="referral-case__meta">
              <div className="referral-case__wide">
                <dt>Motivo</dt>
                <dd>{seleccion.derivacion.motivo}</dd>
              </div>
              <div className="referral-case__wide">
                <dt>Situación observada</dt>
                <dd>{seleccion.derivacion.detalle}</dd>
              </div>
              <div>
                <dt>Responsable del área</dt>
                <dd>{seleccion.responsableArea}</dd>
              </div>
              <div>
                <dt>Respuesta estimada</dt>
                <dd>{seleccion.tiempoRespuesta}</dd>
              </div>
              <div>
                <dt>Solicitud de apoyo</dt>
                <dd>{formatFecha(seleccion.derivacion.fechaDerivacion)}</dd>
              </div>
              <div>
                <dt>Recepción del área</dt>
                <dd>{formatFecha(seleccion.derivacion.fechaRecepcion)}</dd>
              </div>
              <div>
                <dt>Cita programada</dt>
                <dd>{formatFecha(seleccion.derivacion.fechaCita)}</dd>
              </div>
              <div>
                <dt>Atención registrada</dt>
                <dd>{formatFecha(seleccion.derivacion.fechaAtencion)}</dd>
              </div>
            </dl>
            {seleccion.derivacion.recomendacionComunicable ? (
              <Alert tone="ok" title="Recomendación para el tutor">
                {seleccion.derivacion.recomendacionComunicable}
                {seleccion.derivacion.vigenciaRecomendacion && (
                  <> Vigente hasta el {formatFecha(seleccion.derivacion.vigenciaRecomendacion)}.</>
                )}
              </Alert>
            ) : (
              <Alert tone="info" title="Sin recomendación autorizada">
                El área aún no autorizó pautas para el acompañamiento tutorial.
              </Alert>
            )}
            <details className="referral-disclosure" open>
              <summary>
                <i className="fa-solid fa-clock-rotate-left" aria-hidden="true" />
                <span>Historial de estados</span>
                <i className="fa-solid fa-chevron-down" aria-hidden="true" />
              </summary>
              <Timeline
                etiqueta={`Historial de la solicitud de apoyo ${seleccion.derivacion.codigo}`}
                hitos={seleccion.derivacion.historial.map((evento) => ({
                  titulo: etiquetasEstadoDerivacion[evento.estado] ?? evento.estado,
                  descripcion: `${evento.nota} · Responsable: ${evento.responsable}`,
                  fecha: formatFecha(evento.fecha),
                  icono: (
                    <i
                      className={`fa-solid ${['cerrada', 'atendida'].includes(evento.estado) ? 'fa-check' : evento.estado === 'no-presentado' ? 'fa-xmark' : 'fa-circle'}`}
                      aria-hidden="true"
                    />
                  ),
                  tono: ['cerrada', 'atendida'].includes(evento.estado)
                    ? 'ok'
                    : evento.estado === 'no-presentado'
                      ? 'riesgo'
                      : 'info',
                }))}
              />
            </details>
          </div>
        </Sheet>
      )}
      {nuevaAbierta && (
        <Sheet
          title="Nueva solicitud de apoyo · formato 12"
          description="Ficha de derivación a un área especializada"
          onClose={() => setNuevaAbierta(false)}
          wide
          footer={
            <>
              <button
                type="button"
                className="btn btn-falcon-default"
                onClick={() => setNuevaAbierta(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setNuevaAbierta(false)}
              >
                Registrar ficha (demostración)
              </button>
            </>
          }
        >
          <div className="referral-form stack">
            <Alert tone="alerta" title="No se registran diagnósticos">
              Describe únicamente la situación observada y el motivo de la solicitud de apoyo. La
              valoración clínica corresponde al área especializada, que devolverá el estado de la
              atención y, si lo autoriza, una recomendación autorizada.
            </Alert>

            <div className="field-grid">
              <div className="field">
                <label htmlFor="nueva-estudiante">Estudiante derivado</label>
                <select
                  id="nueva-estudiante"
                  className="select"
                  defaultValue={tutoradosResueltos[0]?.id ?? ''}
                >
                  {tutoradosResueltos.map((estudiante) => (
                    <option key={estudiante.id} value={estudiante.id}>
                      {nombreCompleto(estudiante)} · {estudiante.codigo}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="nueva-area">Área de destino</label>
                <select
                  id="nueva-area"
                  className="select"
                  value={areaDestino}
                  onChange={(evento) => setAreaDestino(evento.target.value)}
                >
                  {areasDerivacion.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="nueva-prioridad">Prioridad</label>
                <select id="nueva-prioridad" className="select" defaultValue="media">
                  <option value="alta">Alta</option>
                  <option value="media">Media</option>
                  <option value="baja">Baja</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="nueva-fecha">Fecha de solicitud de apoyo</label>
                <input id="nueva-fecha" className="input" type="date" defaultValue={HOY_ISO} />
              </div>
            </div>

            {areaSeleccionada && (
              <dl className="def-list">
                <div>
                  <dt>Responsable del área</dt>
                  <dd>{areaSeleccionada.responsable}</dd>
                </div>
                <div>
                  <dt>Correo de contacto</dt>
                  <dd>
                    <a href={`mailto:${areaSeleccionada.correo}`}>{areaSeleccionada.correo}</a>
                  </dd>
                </div>
                <div>
                  <dt>Tiempo de respuesta</dt>
                  <dd>{areaSeleccionada.tiempoRespuesta}</dd>
                </div>
              </dl>
            )}

            <div className="field">
              <label htmlFor="nueva-motivo">Motivo de la solicitud de apoyo</label>
              <input
                id="nueva-motivo"
                className="input"
                type="text"
                defaultValue="Dificultades en hábitos y técnicas de estudio"
              />
            </div>
            <div className="field">
              <label htmlFor="nueva-detalle">Descripción de la situación observada</label>
              <textarea
                id="nueva-detalle"
                className="textarea"
                defaultValue="El tutorado reporta que no logra organizar su tiempo y ha entregado tarde dos evaluaciones del semestre."
              />
              <span className="field__hint">
                Evita juicios clínicos: describa lo observado durante las sesiones de tutoría.
              </span>
            </div>
            <div className="field">
              <label htmlFor="nueva-acciones">
                Acciones realizadas antes de la solicitud de apoyo
              </label>
              <textarea
                id="nueva-acciones"
                className="textarea"
                defaultValue="Dos sesiones de tutoría individual con revisión conjunta del horario de estudio."
              />
            </div>
            <div className="field">
              <label htmlFor="nueva-autorizacion">
                El estudiante autoriza la comunicación de la información necesaria
              </label>
              <select id="nueva-autorizacion" className="select" defaultValue="Si">
                <option value="Si">Sí</option>
                <option value="No">No</option>
              </select>
            </div>
          </div>
        </Sheet>
      )}
    </div>
  );
}
