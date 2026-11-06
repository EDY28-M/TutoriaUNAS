import { etiquetaEtapa } from '../../utils/datosAcademicos';
import { API_MODE } from '../../services/apiConfig';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  HeartPulse,
  Send,
} from '../../components/ui/icons';
import { PageHeading } from '../../components/ui/PageHeading';
import { Card, CardBody, CardFoot, CardHead } from '../../components/ui/Card';
import { Stat } from '../../components/ui/Stat';
import { Alert } from '../../components/ui/Alert';
import { Badge, StatusBadge } from '../../components/ui/StatusBadge';
import { DataTable } from '../../components/ui/DataTable';
import type { Column } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { Progress, Meter } from '../../components/ui/Progress';
import { Sheet } from '../../components/ui/Sheet';
import { Tabs, TabPanel } from '../../components/ui/Tabs';
import { Timeline } from '../../components/ui/Timeline';
import { usePortal } from '../../hooks/usePortal';
import { definicionPorCodigo } from '../../data/formatos';
import { areasDerivacion, semestreActual } from '../../data/catalogos';
import {
  escuelaDe,
  docentePorId,
  estudiantePorId,
  iniciales,
  nombreCompleto,
} from '../../data/personas';
import { asignacionDe } from '../../data/tutoria';
import { horarioDe, matriculaDe, nombreCurso, resumenDe } from '../../data/academico';
import {
  apoyosDe,
  atencionesTutorialesDe,
  beneficiosDe,
  etiquetaBeneficio,
  etiquetaServicio,
} from '../../data/salud';
import type { MatriculaCurso } from '../../types/domain';
import {
  DIAS_SEMANA,
  HOY_ISO,
  formatFecha,
  formatFechaLarga,
  formatHora,
  formatRangoHora,
} from '../../utils/fechas';

/**
 * Expediente del tutorado: datos académicos consultados a la DIAA, historial de
 * sesiones con sus acuerdos, instrumentos, derivaciones con recomendación
 * comunicable, horario de clases y datos de bienestar sin detalle clínico.
 *
 * Incluye dos formularios de demostración (registrar sesión y registrar
 * derivación) que reproducen los campos oficiales sin persistir datos.
 */

const ETIQUETA_ASISTENCIA: Record<string, string> = {
  asistio: 'Asistió',
  tarde: 'Llegó tarde',
  falto: 'Faltó',
  justificado: 'Falta justificada',
};

const RESPONSABLE_ACUERDO: Record<string, string> = {
  tutor: 'Docente tutor',
  tutorado: 'Tutorado',
  ambos: 'Ambos',
};

function tonoAlerta(nivel: string): 'riesgo' | 'alerta' | 'info' {
  return nivel === 'alta' ? 'riesgo' : nivel === 'media' ? 'alerta' : 'info';
}

export function TuteeRecord() {
  const { estudianteId } = useParams<{ estudianteId: string }>();
  const navegar = useNavigate();
  function abrirRegistro(tipo: 'sesion' | 'derivacion') {
    if (API_MODE)
      navegar(
        tipo === 'sesion'
          ? `/tutor/sesiones?accion=programar&estudiante=${encodeURIComponent(estudianteId ?? '')}`
          : `/tutor/instrumentos?crear=F12&estudiante=${encodeURIComponent(estudianteId ?? '')}`,
      );
    else setVentana(tipo);
  }
  const portal = usePortal();
  const [pestana, setPestana] = useState('academico');
  const [ventana, setVentana] = useState<'sesion' | 'derivacion' | null>(null);

  const estudiante = estudianteId ? estudiantePorId(estudianteId) : undefined;

  const asignado = portal.tutorados.some(
    (asignacion) =>
      asignacion.estudianteId === estudianteId &&
      asignacion.tutorId === portal.docente?.id &&
      asignacion.semestreId === semestreActual &&
      asignacion.estado === 'activa',
  );
  if (!estudiante || !asignado) {
    return (
      <>
        <PageHeading
          eyebrow="Acompañamiento tutorial"
          title="Expediente no disponible"
          description="Solo puedes consultar estudiantes con una asignación tutorial activa a tu cargo en este semestre."
          actions={
            <Link className="btn btn-falcon-default" to="/tutor/tutorados">
              <ArrowLeft aria-hidden="true" /> Volver al listado
            </Link>
          }
        />
        <EmptyState
          title="Sin datos del estudiante"
          description="Elige un estudiante de la relación de asignaciones para consultar su expediente."
          icon={<GraduationCap />}
        />
      </>
    );
  }

  const asignacion = asignacionDe(estudiante.id);
  const tutor = asignacion ? (docentePorId(asignacion.tutorId) ?? portal.docente) : portal.docente;
  const sesiones = portal.sesiones
    .filter((sesion) => sesion.asistentes.some((a) => a.estudianteId === estudiante.id))
    .slice()
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const instrumentos = portal.instrumentos.filter((item) => item.estudianteId === estudiante.id);
  const derivaciones = portal.derivaciones.filter((d) => d.estudianteId === estudiante.id);
  const matricula = matriculaDe(estudiante.id);
  const resumen = resumenDe(estudiante.id);
  const bloques = horarioDe(estudiante.id);
  const beneficios = beneficiosDe(estudiante.id);
  const atenciones = atencionesTutorialesDe(estudiante.id);
  const apoyos = apoyosDe(estudiante.id);

  const realizadas = sesiones.filter((sesion) => sesion.estado === 'realizada');
  const asistidas = realizadas.filter((sesion) =>
    sesion.asistentes.some(
      (asistente) =>
        asistente.estudianteId === estudiante.id &&
        (asistente.estado === 'asistio' || asistente.estado === 'tarde'),
    ),
  );
  const instrumentosPendientes = instrumentos.filter((instrumento) =>
    ['no-iniciado', 'borrador', 'observado'].includes(instrumento.estado),
  );
  const columnasCursos: Column<MatriculaCurso>[] = [
    {
      key: 'curso',
      header: 'Curso',
      sortable: true,
      sortValue: (fila) => nombreCurso(fila.cursoId),
      render: (fila) => (
        <>
          <span className="cell-strong">{nombreCurso(fila.cursoId)}</span>
          <span className="cell-note">{matricula?.semestreId}</span>
        </>
      ),
    },
    {
      key: 'seccion',
      header: 'Sección y docente',
      render: (fila) => {
        return (
          <>
            <span>{fila.seccion ? `Sección ${fila.seccion}` : 'Sección no registrada'}</span>
            <span className="cell-note">{fila.docente || 'Docente por designar'}</span>
          </>
        );
      },
    },
    {
      key: 'creditos',
      header: 'Créditos',
      sortable: true,
      sortValue: (fila) => fila.creditos ?? -1,
      render: (fila) => <span className="num">{fila.creditos ?? 'Sin informar'}</span>,
    },
    {
      key: 'horario',
      header: 'Horario de clases',
      render: (fila) => <span className="cell-mono">{fila.horario || 'Por definir'}</span>,
    },
  ];

  const columnasInstrumentos: Column<(typeof instrumentos)[number]>[] = [
    {
      key: 'formato',
      header: 'Formato',
      sortable: true,
      sortValue: (fila) => fila.formato,
      render: (fila) => {
        const definicion = definicionPorCodigo(fila.formato);
        return (
          <>
            <span className="cell-strong">
              {definicion?.numero} · {definicion?.nombre}
            </span>
            <span className="cell-note">{definicion?.actorEtiqueta}</span>
          </>
        );
      },
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (fila) => <StatusBadge estado={fila.estado} />,
    },
    {
      key: 'avance',
      header: 'Avance',
      sortable: true,
      sortValue: (fila) => fila.avance,
      render: (fila) => <Meter valor={fila.avance} />,
    },
    {
      key: 'actualizado',
      header: 'Actualizado',
      sortable: true,
      sortValue: (fila) => fila.actualizado,
      render: (fila) => <span className="cell-mono">{formatFecha(fila.actualizado)}</span>,
    },
    {
      key: 'observaciones',
      header: 'Observaciones',
      render: (fila) =>
        fila.observaciones.length === 0 ? (
          <span className="muted small">Sin observaciones</span>
        ) : (
          <span className="stack stack--sm">
            <StatusBadge
              estado={fila.observaciones[0]!.estado}
              etiqueta={`${fila.observaciones.length} observación(es)`}
            />
            <span className="cell-note">{fila.observaciones[0]!.texto}</span>
          </span>
        ),
    },
  ];

  const pestanas = [
    { id: 'academico', label: 'Académico', icon: <GraduationCap aria-hidden="true" /> },
    {
      id: 'tutoria',
      label: 'Tutoría',
      icon: <CalendarCheck aria-hidden="true" />,
      count: sesiones.length,
    },
    {
      id: 'instrumentos',
      label: 'Formularios',
      icon: <ClipboardList aria-hidden="true" />,
      count: instrumentos.length,
    },
    {
      id: 'derivaciones',
      label: 'Solicitudes de apoyo',
      icon: <Send aria-hidden="true" />,
      count: derivaciones.length,
    },
    {
      id: 'horario',
      label: 'Horario',
      icon: <CalendarClock aria-hidden="true" />,
      count: bloques.length,
    },
    {
      id: 'bienestar',
      label: 'Bienestar',
      icon: <HeartPulse aria-hidden="true" />,
      count: beneficios.length + atenciones.length + apoyos.length,
    },
  ];

  return (
    <>
      <PageHeading
        eyebrow={`Expediente tutorial · ${escuelaDe(estudiante.escuelaId)} · Semestre ${semestreActual}`}
        title={nombreCompleto(estudiante)}
        description={`Código ${estudiante.codigo} · ciclo ${estudiante.ciclo ?? 'sin informar'} (${etiquetaEtapa(estudiante.etapa) ?? 'etapa por definir'}) · ${asignacion?.grupo ?? 'sin grupo'} · datos consultados al ${formatFecha(HOY_ISO)}.`}
        actions={
          <>
            <Link className="btn btn-falcon-default" to="/tutor/tutorados">
              <ArrowLeft aria-hidden="true" /> Volver al listado
            </Link>
            <button
              type="button"
              className="btn btn-falcon-default"
              onClick={() => abrirRegistro('derivacion')}
            >
              <Send aria-hidden="true" /> Registrar solicitud de apoyo
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => abrirRegistro('sesion')}
            >
              <CalendarCheck aria-hidden="true" /> Registrar sesión
            </button>
          </>
        }
      />

      {estudiante.alertas.length > 0 && (
        <Alert
          tone={tonoAlerta(
            estudiante.alertas.slice().sort((a, b) => a.nivel.localeCompare(b.nivel))[0]!.nivel,
          )}
          title="Alertas del estudiante"
        >
          {estudiante.alertas.map((alerta) => alerta.detalle).join(' · ')}. Ninguna alerta
          constituye sanción ni diagnóstico.
        </Alert>
      )}

      <div className="grid grid--4">
        <Stat
          label="Promedio ponderado"
          value={estudiante.promedioPonderado?.toFixed(1) ?? 'Sin informar'}
          note={`Posición ${resumen?.posicion ?? '—'} de su ciclo · corte ${formatFecha(resumen?.fechaCorte ?? null)}`}
          icon={<GraduationCap aria-hidden="true" />}
          tone={(estudiante.promedioPonderado ?? -Infinity) >= 13 ? 'verde' : 'alerta'}
        />
        <Stat
          label="Créditos aprobados"
          value={estudiante.creditosAprobados ?? 'Sin informar'}
          note={
            estudiante.creditosTotales === null
              ? 'Total del plan no informado'
              : `de ${estudiante.creditosTotales} del plan de estudios`
          }
          icon={<BookOpen aria-hidden="true" />}
          tone="info"
        />
        <Stat
          label="Sesiones asistidas"
          value={`${asistidas.length}/${realizadas.length}`}
          note={`${sesiones.filter((sesion) => sesion.estado === 'programada').length} sesión(es) programada(s)`}
          icon={<CalendarCheck aria-hidden="true" />}
        />
        <Stat
          label="Formularios pendientes"
          value={instrumentosPendientes.length}
          note={`${instrumentos.length} formatos del estudiante registrados`}
          icon={<ClipboardList aria-hidden="true" />}
          tone={instrumentosPendientes.length > 0 ? 'alerta' : 'verde'}
        />
      </div>

      <Card>
        <CardHead
          title="Ficha del estudiante"
          description="Datos de contacto y condición académica vigente"
          actions={<StatusBadge estado={estudiante.estado} />}
        />
        <CardBody>
          <div className="ui-row ui-row--wrap" style={{ alignItems: 'flex-start' }}>
            <span className="avatar avatar--lg avatar--gold" aria-hidden="true">
              {iniciales(estudiante)}
            </span>
            <dl className="meta-list" style={{ flex: 1 }}>
              <div>
                <dt>Correo</dt>
                <dd>
                  <a href={`mailto:${estudiante.correo}`}>{estudiante.correo}</a>
                </dd>
              </div>
              <div>
                <dt>Teléfono</dt>
                <dd>{estudiante.telefono}</dd>
              </div>
              <div>
                <dt>Ingreso</dt>
                <dd>{formatFecha(estudiante.ingreso)}</dd>
              </div>
              <div>
                <dt>Docente tutor</dt>
                <dd>{tutor ? nombreCompleto(tutor) : 'Por asignar'}</dd>
              </div>
              <div>
                <dt>Criterio de asignación</dt>
                <dd>{asignacion?.criterio ?? 'Sin asignación activa'}</dd>
              </div>
              <div>
                <dt>Referencia de aprobación</dt>
                <dd>{asignacion?.referenciaAprobacion ?? '—'}</dd>
              </div>
            </dl>
          </div>
        </CardBody>
      </Card>

      <Tabs
        items={pestanas}
        activo={pestana}
        onChange={setPestana}
        etiqueta="Secciones del expediente"
      />

      <TabPanel id="academico" activo={pestana}>
        <div className="grid grid--3">
          <Stat
            label="Avance curricular"
            value={
              resumen?.avanceCurricular == null ? 'Sin informar' : `${resumen.avanceCurricular}%`
            }
            note={resumen?.fuente ?? 'Información de la DIAA'}
            icon={<BookOpen aria-hidden="true" />}
            tone="dorado"
          />
          <Stat
            label="Cursos matriculados"
            value={matricula?.cursos.length ?? 0}
            note={
              resumen?.creditosMatriculados == null
                ? 'Créditos no informados'
                : `${resumen.creditosMatriculados} créditos en el semestre`
            }
            icon={<CalendarDays aria-hidden="true" />}
            tone="info"
          />
        </div>

        <Card>
          <CardHead
            title="Matrícula y plan de estudios"
            description={
              matricula
                ? `${matricula.planEstudios} · corte ${formatFecha(resumen?.fechaCorte ?? null)}`
                : 'Sin matrícula registrada para el semestre'
            }
            actions={<StatusBadge estado={matricula?.estado ?? 'no-matriculado'} />}
          />
          <CardBody>
            {matricula ? (
              <div className="stack">
                <dl className="meta-list">
                  <div>
                    <dt>Semestre</dt>
                    <dd>{matricula.semestreId}</dd>
                  </div>
                  <div>
                    <dt>Fecha de matrícula</dt>
                    <dd>{formatFecha(matricula.fecha)}</dd>
                  </div>
                  <div>
                    <dt>Ciclo</dt>
                    <dd>{matricula.ciclo ?? 'Sin informar'}</dd>
                  </div>
                  <div>
                    <dt>Cursos matriculados</dt>
                    <dd>{matricula.cursos.length}</dd>
                  </div>
                </dl>
                {resumen?.avanceCurricular != null && (
                  <Progress
                    valor={resumen.avanceCurricular}
                    etiqueta="Avance curricular del plan de estudios"
                    variante="dorado"
                  />
                )}
              </div>
            ) : (
              <EmptyState
                title="Sin matrícula"
                description="La DIAA no reporta matrícula vigente para este semestre."
                icon={<CalendarDays />}
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHead title="Cursos y docentes" description="Matrícula y horarios del semestre" />
          <CardBody flush>
            <DataTable<MatriculaCurso>
              rows={matricula?.cursos ?? []}
              columns={columnasCursos}
              caption="Cursos matriculados del estudiante"
              rowKey={(fila) => `${fila.cursoId}-${fila.seccion}`}
              emptyTitle="Sin cursos registrados"
              emptyDescription="No hay matrícula disponible para este semestre."
              initialSort={{ key: 'curso', direction: 'asc' }}
            />
          </CardBody>
          <CardFoot>
            <span>Fuente: {resumen?.fuente ?? 'DIAA'} · consulta de solo lectura.</span>
            <Link className="btn btn-link btn-sm" to="/tutor/reportes">
              Ver indicadores
            </Link>
          </CardFoot>
        </Card>
      </TabPanel>

      <TabPanel id="tutoria" activo={pestana}>
        <Card>
          <CardHead
            title="Historial de sesiones y acuerdos"
            description={`${realizadas.length} sesión(es) realizada(s) · ${asistidas.length} con asistencia registrada`}
            actions={<Badge tone="info">Formato 06 · asistencia individual</Badge>}
          />
          <CardBody flush>
            {sesiones.length === 0 ? (
              <EmptyState
                title="Sin sesiones registradas"
                description="No hay sesiones individuales ni grupales con este estudiante en el semestre."
                icon={<CalendarCheck />}
              />
            ) : (
              <ul className="list">
                {sesiones.map((sesion) => (
                  <li className="list__item" key={sesion.id}>
                    <span className="list__icon" aria-hidden="true">
                      <CalendarCheck />
                    </span>
                    <span className="list__body">
                      <strong>{sesion.tema}</strong>
                      <p>
                        {formatFechaLarga(sesion.fecha)} ·{' '}
                        {formatRangoHora(formatHora(sesion.horaInicio), formatHora(sesion.horaFin))}{' '}
                        · {sesion.lugar}
                      </p>
                      <span className="list__meta">
                        <span style={{ textTransform: 'capitalize' }}>Tutoría {sesion.tipo}</span>
                        <span style={{ textTransform: 'capitalize' }}>{sesion.modalidad}</span>
                        <span className="mono">{sesion.codigo}</span>
                        <StatusBadge estado={sesion.estado} />
                      </span>
                      {sesion.acuerdos.length > 0 && (
                        <span className="stack stack--sm" style={{ marginTop: 6 }}>
                          <span className="field__label">Acuerdos de la sesión</span>
                          {sesion.acuerdos.map((acuerdo) => (
                            <span className="ui-row ui-row--between ui-row--wrap" key={acuerdo.id}>
                              <span className="small">{acuerdo.descripcion}</span>
                              <span className="ui-row ui-row--tight">
                                <Badge>
                                  {RESPONSABLE_ACUERDO[acuerdo.responsable] ?? acuerdo.responsable}
                                </Badge>
                                {acuerdo.fechaCompromiso && (
                                  <span className="small muted nowrap">
                                    Compromiso: {formatFecha(acuerdo.fechaCompromiso)}
                                  </span>
                                )}
                                <StatusBadge estado={acuerdo.estado} />
                              </span>
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                    <span className="list__aside">
                      {(() => {
                        const asistencia = sesion.asistentes.find(
                          (asistente) => asistente.estudianteId === estudiante.id,
                        );
                        return asistencia ? (
                          <StatusBadge
                            estado={asistencia.estado}
                            etiqueta={ETIQUETA_ASISTENCIA[asistencia.estado] ?? asistencia.estado}
                          />
                        ) : (
                          <Badge tone="info">Convocatoria grupal</Badge>
                        );
                      })()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
          <CardFoot>
            <span>Los acuerdos se revisan al inicio de la siguiente sesión.</span>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => abrirRegistro('sesion')}
            >
              Registrar sesión
            </button>
          </CardFoot>
        </Card>
      </TabPanel>

      <TabPanel id="instrumentos" activo={pestana}>
        <Card>
          <CardHead
            title="Formularios del estudiante"
            description="Entrevistas 03/04/05 y evaluaciones 10/11 que responde el estudiante, junto con los registros de atención 06/08 del tutor"
            actions={
              <Badge tone={instrumentosPendientes.length > 0 ? 'alerta' : 'ok'}>
                {instrumentosPendientes.length} pendiente(s)
              </Badge>
            }
          />
          <CardBody flush>
            <DataTable<(typeof instrumentos)[number]>
              rows={instrumentos}
              columns={columnasInstrumentos}
              caption="Formularios del estudiante y su estado de presentación"
              rowKey={(fila) => fila.id}
              emptyTitle="Sin formularios"
              emptyDescription="No hay formatos registrados para este estudiante en el semestre."
              initialSort={{ key: 'formato', direction: 'asc' }}
            />
          </CardBody>
          <CardFoot>
            <span>
              Cada formato conserva los campos del anexo de la Resolución N.º 500-2022-CU-R-UNAS.
            </span>
            <Link
              className="btn btn-falcon-default btn-sm"
              to={`/tutor/instrumentos?ambito=estudiantes&estudiante=${estudiante.id}`}
            >
              Abrir bandeja de formularios
            </Link>
          </CardFoot>
        </Card>
      </TabPanel>

      <TabPanel id="derivaciones" activo={pestana}>
        <Alert tone="info" title="Información que puedes consultar">
          El sistema conserva el área de destino, el estado de la atención y la recomendación
          comunicable. No se almacenan diagnósticos, historias clínicas ni detalles de atención.
        </Alert>
        {derivaciones.length === 0 ? (
          <Card>
            <CardBody flush>
              <EmptyState
                title="Sin solicitudes de apoyo"
                description="El estudiante no tiene fichas de solicitud de apoyo (formato 12) registradas en el semestre."
                icon={<Send />}
              />
            </CardBody>
          </Card>
        ) : (
          derivaciones.map((derivacion) => (
            <Card key={derivacion.id}>
              <CardHead
                title={`${derivacion.codigo} · ${
                  areasDerivacion.find((area) => area.id === derivacion.area)?.nombre ??
                  derivacion.area
                }`}
                description={derivacion.motivo}
                actions={
                  <span className="ui-row ui-row--tight">
                    <StatusBadge estado={derivacion.prioridad} />
                    <StatusBadge estado={derivacion.estado} />
                  </span>
                }
              />
              <CardBody>
                <div className="stack">
                  <dl className="meta-list">
                    <div>
                      <dt>Fecha de solicitud de apoyo</dt>
                      <dd>{formatFecha(derivacion.fechaDerivacion)}</dd>
                    </div>
                    <div>
                      <dt>Recepción del área</dt>
                      <dd>{formatFecha(derivacion.fechaRecepcion)}</dd>
                    </div>
                    <div>
                      <dt>Cita programada</dt>
                      <dd>{formatFecha(derivacion.fechaCita)}</dd>
                    </div>
                    <div>
                      <dt>Atención</dt>
                      <dd>{formatFecha(derivacion.fechaAtencion)}</dd>
                    </div>
                    <div>
                      <dt>Responsable del área</dt>
                      <dd>{derivacion.responsableArea}</dd>
                    </div>
                    <div>
                      <dt>Siguiente acción</dt>
                      <dd>{derivacion.siguienteAccion}</dd>
                    </div>
                  </dl>
                  <p className="small muted">Situación observada: {derivacion.detalle}</p>
                  {derivacion.recomendacionComunicable ? (
                    <Alert tone="ok" title="Recomendación autorizada">
                      {derivacion.recomendacionComunicable}
                      {derivacion.vigenciaRecomendacion && (
                        <> Vigente hasta el {formatFecha(derivacion.vigenciaRecomendacion)}.</>
                      )}
                    </Alert>
                  ) : (
                    <Alert tone="info" title="Sin recomendación autorizada">
                      El área aún no ha registrado una recomendación autorizada para compartir con
                      la tutoría.
                    </Alert>
                  )}
                  <Timeline
                    etiqueta={`Historial de la solicitud de apoyo ${derivacion.codigo}`}
                    hitos={derivacion.historial.map((evento) => ({
                      titulo: evento.nota,
                      descripcion: `Responsable: ${evento.responsable}`,
                      fecha: `${formatFecha(evento.fecha)} · ${evento.estado}`,
                      tono:
                        evento.estado === 'cerrada' || evento.estado === 'atendida'
                          ? 'ok'
                          : evento.estado === 'no-presentado'
                            ? 'riesgo'
                            : 'info',
                    }))}
                  />
                </div>
              </CardBody>
            </Card>
          ))
        )}
      </TabPanel>

      <TabPanel id="horario" activo={pestana}>
        <Card>
          <CardHead
            title="Horario académico del semestre"
            description={`${bloques.length} bloque(s) de clase reportados por la DIAA · corte ${formatFecha(HOY_ISO)}`}
          />
          <CardBody flush>
            {bloques.length === 0 ? (
              <EmptyState
                title="Sin horario registrado"
                description="La DIAA no reporta bloques de clase para este estudiante."
                icon={<CalendarDays />}
              />
            ) : (
              <ul className="list">
                {DIAS_SEMANA.map((dia, indice) => {
                  const delDia = bloques
                    .filter((bloque) => bloque.dia === indice + 1)
                    .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
                  if (delDia.length === 0) return null;
                  return delDia.map((bloque) => (
                    <li className="list__item" key={bloque.id}>
                      <span className="list__icon list__icon--info" aria-hidden="true">
                        <CalendarClock />
                      </span>
                      <span className="list__body">
                        <strong>{bloque.titulo}</strong>
                        <p>
                          {dia} ·{' '}
                          {formatRangoHora(
                            formatHora(bloque.horaInicio),
                            formatHora(bloque.horaFin),
                          )}
                        </p>
                        <span className="list__meta">
                          <span>{bloque.lugar}</span>
                          <span style={{ textTransform: 'capitalize' }}>{bloque.modalidad}</span>
                        </span>
                      </span>
                      <span className="list__aside mono">{bloque.cursoId ?? '—'}</span>
                    </li>
                  ));
                })}
              </ul>
            )}
          </CardBody>
        </Card>
      </TabPanel>

      <TabPanel id="bienestar" activo={pestana}>
        <Alert tone="info" title="Información autorizada de bienestar">
          Se muestran únicamente el servicio, el estado de la atención y la recomendación académica
          autorizada. No se incluye información clínica ni diagnósticos.
        </Alert>

        <div className="split">
          <Card>
            <CardHead
              title="Beneficios sociales"
              description="Concesiones vigentes reportadas por Servicio Social"
            />
            <CardBody flush>
              {beneficios.length === 0 ? (
                <EmptyState
                  title="Sin beneficios registrados"
                  description="El estudiante no figura en las concesiones del semestre."
                  icon={<HeartPulse />}
                />
              ) : (
                <ul className="list">
                  {beneficios.map((beneficio) => (
                    <li className="list__item" key={beneficio.id}>
                      <span className="list__icon list__icon--violet" aria-hidden="true">
                        <HeartPulse />
                      </span>
                      <span className="list__body">
                        <strong>{etiquetaBeneficio[beneficio.tipo]}</strong>
                        <p>
                          Desde el {formatFecha(beneficio.inicio)}
                          {beneficio.fin ? ` hasta el ${formatFecha(beneficio.fin)}` : ' · vigente'}
                        </p>
                        <span className="list__meta">{beneficio.fuente}</span>
                      </span>
                      <span className="list__aside">
                        <StatusBadge estado={beneficio.estado} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHead
              title="Atenciones y recomendaciones"
              description="Estado administrativo de las atenciones comunicables"
            />
            <CardBody flush>
              {atenciones.length === 0 ? (
                <EmptyState
                  title="Sin atenciones registradas"
                  description="Bienestar Universitario no reporta atenciones comunicables para el estudiante."
                  icon={<HeartPulse />}
                />
              ) : (
                <ul className="list">
                  {atenciones.map((atencion) => (
                    <li className="list__item" key={atencion.id}>
                      <span className="list__icon list__icon--info" aria-hidden="true">
                        <HeartPulse />
                      </span>
                      <span className="list__body">
                        <strong>{etiquetaServicio[atencion.servicio]}</strong>
                        <p>
                          {formatFecha(atencion.fecha)} · {formatHora(atencion.hora)}
                        </p>
                        <p>
                          {atencion.recomendacionAcademica ??
                            'Sin recomendación académica autorizada para compartir.'}
                        </p>
                        <span className="list__meta">
                          <span>
                            {atencion.fuente} · corte {formatFecha(atencion.fechaCorte)}
                          </span>
                          {atencion.vigenciaRecomendacion && (
                            <span>
                              Vigente hasta el {formatFecha(atencion.vigenciaRecomendacion)}
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="list__aside">
                        <StatusBadge estado={atencion.estado} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHead
            title="Apoyos autorizados"
            description="Indicaciones que el área autorizó compartir."
          />
          <CardBody flush>
            {apoyos.length === 0 ? (
              <EmptyState
                title="Sin apoyos autorizados"
                description="Ninguna área ha autorizado la comunicación de pautas para este estudiante."
                icon={<HeartPulse />}
              />
            ) : (
              <ul className="list">
                {apoyos.map((apoyo) => (
                  <li className="list__item" key={apoyo.id}>
                    <span className="list__icon list__icon--ok" aria-hidden="true">
                      <HeartPulse />
                    </span>
                    <span className="list__body">
                      <strong>{apoyo.necesidad}</strong>
                      <p>{apoyo.apoyoRecomendado}</p>
                      <span className="list__meta">
                        <span>{apoyo.autorizadoPor}</span>
                        <span>Vigente hasta el {formatFecha(apoyo.vigencia)}</span>
                        <span>Registrado el {formatFecha(apoyo.fecha)}</span>
                      </span>
                    </span>
                    <span className="list__aside">
                      <StatusBadge estado={apoyo.prioridad} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
          <CardFoot>
            <span>
              Solo se incluyen los datos cuya comunicación fue autorizada por el área responsable.
            </span>
            <Link className="btn btn-falcon-default btn-sm" to="/tutor/derivaciones">
              Ver solicitudes de apoyo
            </Link>
          </CardFoot>
        </Card>
      </TabPanel>

      {ventana === 'sesion' && (
        <Sheet
          title="Registrar sesión de tutoría"
          description="Formulario de demostración del registro de asistencia (formatos 06 y 07)"
          onClose={() => setVentana(null)}
          wide
          footer={
            <>
              <button
                type="button"
                className="btn btn-falcon-default"
                onClick={() => setVentana(null)}
              >
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setVentana(null)}>
                Registrar (demostración)
              </button>
            </>
          }
        >
          <div className="stack">
            <Alert tone="info" title="Sesión de demostración">
              Los campos reproducen el registro oficial; en esta demostración no se guardan datos ni
              se notifica al estudiante.
            </Alert>
            <div className="field-grid">
              <div className="field">
                <label htmlFor="sesion-fecha">Fecha de la sesión</label>
                <input id="sesion-fecha" className="input" type="date" defaultValue={HOY_ISO} />
              </div>
              <div className="field">
                <label htmlFor="sesion-tipo">Tipo de tutoría</label>
                <select id="sesion-tipo" className="select" defaultValue="individual">
                  <option value="individual">Individual</option>
                  <option value="grupal">Grupal</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="sesion-inicio">Hora de inicio</label>
                <input id="sesion-inicio" className="input" type="time" defaultValue="16:00" />
              </div>
              <div className="field">
                <label htmlFor="sesion-fin">Hora de fin</label>
                <input id="sesion-fin" className="input" type="time" defaultValue="17:00" />
              </div>
              <div className="field">
                <label htmlFor="sesion-modalidad">Modalidad</label>
                <select id="sesion-modalidad" className="select" defaultValue="presencial">
                  <option value="presencial">Presencial</option>
                  <option value="virtual">Virtual</option>
                  <option value="mixta">Mixta</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="sesion-lugar">Lugar o enlace institucional</label>
                <input
                  id="sesion-lugar"
                  className="input"
                  type="text"
                  defaultValue="Cubículo de tutoría · Pabellón B"
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="sesion-tema">Tema desarrollado</label>
              <input
                id="sesion-tema"
                className="input"
                type="text"
                defaultValue="Seguimiento del avance académico y revisión de acuerdos"
                aria-describedby="sesion-tema-ayuda"
              />
              <span className="field__hint" id="sesion-tema-ayuda">
                En las actividades grupales el formato 07 exige consignar el tema o título.
              </span>
            </div>
            <div className="field">
              <label htmlFor="sesion-objetivo">Objetivo de la sesión</label>
              <textarea
                id="sesion-objetivo"
                className="textarea"
                defaultValue="Acompañar el desempeño académico del tutorado y registrar los acuerdos alcanzados."
              />
            </div>
            <div className="field">
              <label htmlFor="sesion-acuerdos">Acuerdos y compromisos</label>
              <textarea
                id="sesion-acuerdos"
                className="textarea"
                defaultValue="El tutorado elaborará un horario semanal de estudio y lo compartirá en la siguiente sesión."
              />
            </div>
            <dl className="meta-list">
              <div>
                <dt>Estudiante</dt>
                <dd>{nombreCompleto(estudiante)}</dd>
              </div>
              <div>
                <dt>Código</dt>
                <dd className="mono">{estudiante.codigo}</dd>
              </div>
              <div>
                <dt>Grupo</dt>
                <dd>{asignacion?.grupo ?? 'Sin grupo'}</dd>
              </div>
              <div>
                <dt>Semestre</dt>
                <dd>{semestreActual}</dd>
              </div>
            </dl>
          </div>
        </Sheet>
      )}

      {ventana === 'derivacion' && (
        <Sheet
          title="Registrar solicitud de apoyo · formato 12"
          description="Ficha de derivación a un área especializada"
          onClose={() => setVentana(null)}
          wide
          footer={
            <>
              <button
                type="button"
                className="btn btn-falcon-default"
                onClick={() => setVentana(null)}
              >
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setVentana(null)}>
                Registrar ficha (demostración)
              </button>
            </>
          }
        >
          <div className="stack">
            <Alert tone="alerta" title="No se registran diagnósticos">
              La ficha describe la situación observada y el motivo de la solicitud de apoyo. El
              diagnóstico y la historia clínica permanecen en el área especializada; solo se
              comparte el estado administrativo y la recomendación autorizada.
            </Alert>
            <div className="field-grid">
              <div className="field">
                <label htmlFor="derivacion-estudiante">Estudiante</label>
                <input
                  id="derivacion-estudiante"
                  className="input"
                  type="text"
                  value={nombreCompleto(estudiante)}
                  readOnly
                />
              </div>
              <div className="field">
                <label htmlFor="derivacion-codigo">Código universitario</label>
                <input
                  id="derivacion-codigo"
                  className="input input--mono"
                  type="text"
                  value={estudiante.codigo}
                  readOnly
                />
              </div>
              <div className="field">
                <label htmlFor="derivacion-area">Área de destino</label>
                <select id="derivacion-area" className="select" defaultValue="psicopedagogia">
                  {areasDerivacion.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.nombre} · respuesta en {area.tiempoRespuesta}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="derivacion-prioridad">Prioridad</label>
                <select id="derivacion-prioridad" className="select" defaultValue="media">
                  <option value="alta">Alta</option>
                  <option value="media">Media</option>
                  <option value="baja">Baja</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label htmlFor="derivacion-motivo">Motivo de la solicitud de apoyo</label>
              <input
                id="derivacion-motivo"
                className="input"
                type="text"
                defaultValue="Dificultades en hábitos y técnicas de estudio"
              />
            </div>
            <div className="field">
              <label htmlFor="derivacion-detalle">Descripción de la situación observada</label>
              <textarea
                id="derivacion-detalle"
                className="textarea"
                defaultValue="El tutorado manifiesta dificultades para organizar su tiempo y ha entregado tarde dos evaluaciones del semestre."
              />
            </div>
            <div className="field">
              <label htmlFor="derivacion-acciones">
                Acciones realizadas antes de la solicitud de apoyo
              </label>
              <textarea
                id="derivacion-acciones"
                className="textarea"
                defaultValue="Dos sesiones de tutoría individual con revisión del horario de estudio y seguimiento quincenal."
              />
            </div>
            <div className="field">
              <label htmlFor="derivacion-autorizacion">
                El estudiante autoriza la comunicación de la información necesaria
              </label>
              <select id="derivacion-autorizacion" className="select" defaultValue="Si">
                <option value="Si">Sí</option>
                <option value="No">No</option>
              </select>
              <span className="field__hint">
                Sin autorización solo se comparte el estado de la atención del caso.
              </span>
            </div>
          </div>
        </Sheet>
      )}
    </>
  );
}
