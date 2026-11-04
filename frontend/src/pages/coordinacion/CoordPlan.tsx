import { ActividadesPlanPersistentes } from '../../components/panels/GestionCoordinacion';
import { useId, useMemo, useState } from 'react';
import { CalendarDays, Check, Flag, Target, Users } from '../../components/ui/icons';
import { PageHeading } from '../../components/ui/PageHeading';
import { Card, CardBody, CardFoot, CardHead } from '../../components/ui/Card';
import { Stat } from '../../components/ui/Stat';
import { Alert } from '../../components/ui/Alert';
import { Badge, StatusBadge } from '../../components/ui/StatusBadge';
import { Progress, Meter } from '../../components/ui/Progress';
import { DataTable } from '../../components/ui/DataTable';
import type { Column } from '../../components/ui/DataTable';
import { Calendar } from '../../components/ui/Calendar';
import type { EventoCalendario } from '../../components/ui/Calendar';
import { EmptyState } from '../../components/ui/EmptyState';
import { usePortal } from '../../hooks/usePortal';
import type { ActividadPlan } from '../../types/domain';
import { abreviaturaEscuela, escuelaDe } from '../../data/personas';
import { escuelas, semestreActual, etapaAcademica } from '../../data/catalogos';
import { actividadesPlan } from '../../data/tutoria';
import { formatFecha, formatFechaLarga } from '../../utils/fechas';
import { API_MODE } from '../../services/apiConfig';
import { crearFormularioApi, guardarFormularioApi } from '../../services/apiTutoria';
import { useInstrumentWorkspace } from '../../hooks/useInstrumentWorkspace';
import { GuidedInstrumentForm } from '../../components/panels/GuidedInstrumentForm';
import { EtapaSelector } from '../../components/ui/FormsPanel';
import { definicionPorCodigo } from '../../data/formatos';
import { puedeEnviarFormato } from '../../utils/instrumentos';

export function CoordPlan() {
  return API_MODE ? <PlanPersistente /> : <PlanDemostracion />;
}

function PlanPersistente() {
  const { registros, momento } = useInstrumentWorkspace();
  const plan = registros.find((r) => r.formato === 'F01');
  const [error, setError] = useState('');
  const [creando, setCreando] = useState(false);
  async function preparar() {
    setError('');
    setCreando(true);
    try {
      await crearFormularioApi('F01');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo preparar el plan.');
    } finally {
      setCreando(false);
    }
  }
  return (
    <div className="stack">
      <PageHeading
        eyebrow={`Coordinación · Semestre ${semestreActual}`}
        title="Plan e informe de tutoría"
        description="Formato 01 del equipo de tutores de tu escuela. Puedes preparar el borrador y enviarlo en el cierre del semestre."
      />
      <EtapaSelector momento={momento} />
      {error && (
        <Alert tone="riesgo" title="No se pudo preparar el formato">
          {error}
        </Alert>
      )}
      <ActividadesPlanPersistentes />
      {plan ? (
        <GuidedInstrumentForm
          key={plan.id}
          definicion={definicionPorCodigo('F01')!}
          instrumento={plan}
          editable={!['enviado', 'aprobado'].includes(plan.estado)}
          puedeEnviar={puedeEnviarFormato('F01', momento)}
          onGuardar={(respuestas, enviar, version) =>
            guardarFormularioApi(plan, respuestas, enviar, version ?? plan.version)
          }
        />
      ) : (
        <Card>
          <CardBody>
            <p>Aún no se preparó el formato 01 de esta escuela y semestre.</p>
            <button
              type="button"
              className="btn btn-primary"
              disabled={creando}
              onClick={() => void preparar()}
            >
              Preparar formato 01
            </button>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

/** Resumen del plan de una escuela. */
interface ResumenPlan {
  escuelaId: string;
  actividades: number;
  avance: number;
  culminadas: number;
  enEjecucion: number;
  planificadas: number;
}

/** Calcula el resumen del plan de acción tutorial de una escuela. */
function resumenDe(escuelaId: string): ResumenPlan {
  const actividades = actividadesPlan.filter((actividad) => actividad.escuelaId === escuelaId);
  const avance = actividades.length
    ? Math.round(
        actividades.reduce((total, actividad) => total + actividad.avance, 0) / actividades.length,
      )
    : 0;
  return {
    escuelaId,
    actividades: actividades.length,
    avance,
    culminadas: actividades.filter((actividad) => actividad.estado === 'culminada').length,
    enEjecucion: actividades.filter((actividad) => actividad.estado === 'en-ejecucion').length,
    planificadas: actividades.filter((actividad) => actividad.estado === 'planificada').length,
  };
}

/** Etiqueta del estado de una actividad del plan. */
function estadoPlan(actividad: ActividadPlan): string {
  if (actividad.estado === 'culminada') return 'Culminada';
  if (actividad.estado === 'en-ejecucion') return 'En ejecución';
  if (actividad.estado === 'reprogramada') return 'Reprogramada';
  return 'Planificada';
}

/**
 * Plan de acción tutorial por escuela: problemática priorizada, objetivos,
 * actividades, metas, responsables, evidencias y avance, con el calendario de
 * las actividades del semestre y su referencia de aprobación.
 */
function PlanDemostracion() {
  const portal = usePortal();
  const idSelector = useId();
  const [escuelaId, setEscuelaId] = useState(portal.escuelaId);

  const resumenes = useMemo<ResumenPlan[]>(
    () =>
      escuelas
        .map((escuela) => resumenDe(escuela.id))
        .sort((a, b) =>
          abreviaturaEscuela(a.escuelaId).localeCompare(abreviaturaEscuela(b.escuelaId), 'es'),
        ),
    [],
  );

  const resumenActual = resumenes.find((fila) => fila.escuelaId === escuelaId) ?? resumenes[0];
  const actividadesDeEscuela = actividadesPlan
    .filter((actividad) => actividad.escuelaId === escuelaId)
    .sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio));
  const problematicas = [
    ...new Set(actividadesDeEscuela.map((actividad) => actividad.problematica)),
  ];
  const referencias = [...new Set(actividadesDeEscuela.map((actividad) => actividad.aprobacion))];

  const eventos: EventoCalendario[] = actividadesPlan.flatMap((actividad) => [
    {
      id: `${actividad.id}-inicio`,
      fecha: actividad.fechaInicio,
      titulo: actividad.actividad,
      tono: actividad.escuelaId === escuelaId ? ('verde' as const) : ('info' as const),
      detalle: `${abreviaturaEscuela(actividad.escuelaId)} · inicio · ${actividad.meta}`,
      lugar: actividad.responsable,
      etiqueta: estadoPlan(actividad),
    },
    {
      id: `${actividad.id}-fin`,
      fecha: actividad.fechaFin,
      titulo: `Cierre: ${actividad.actividad}`,
      tono: 'dorado' as const,
      detalle: `${abreviaturaEscuela(actividad.escuelaId)} · fecha de término · evidencia: ${actividad.evidencia}`,
      lugar: actividad.responsable,
      etiqueta: `${actividad.avance}% de avance`,
    },
  ]);

  const columnas: Column<ActividadPlan>[] = [
    {
      key: 'actividad',
      header: 'Actividad',
      sortable: true,
      sortValue: (actividad) => actividad.actividad,
      render: (actividad) => (
        <span className="stack" style={{ gap: 1 }}>
          <strong className="cell-strong">{actividad.actividad}</strong>
          <span className="cell-note">{actividad.objetivo}</span>
        </span>
      ),
    },
    {
      key: 'problematica',
      header: 'Problemática priorizada',
      sortable: true,
      sortValue: (actividad) => actividad.problematica,
      render: (actividad) => <span className="cell-note">{actividad.problematica}</span>,
    },
    {
      key: 'meta',
      header: 'Meta',
      render: (actividad) => actividad.meta,
    },
    {
      key: 'fechas',
      header: 'Fechas',
      sortable: true,
      sortValue: (actividad) => actividad.fechaInicio,
      render: (actividad) => (
        <span className="stack" style={{ gap: 1 }}>
          <span className="nowrap cell-mono">{formatFecha(actividad.fechaInicio)}</span>
          <span className="cell-note">hasta {formatFecha(actividad.fechaFin)}</span>
        </span>
      ),
    },
    {
      key: 'responsable',
      header: 'Responsable',
      sortable: true,
      sortValue: (actividad) => actividad.responsable,
      render: (actividad) => actividad.responsable,
    },
    {
      key: 'evidencia',
      header: 'Evidencia',
      render: (actividad) => <span className="cell-note">{actividad.evidencia}</span>,
    },
    {
      key: 'avance',
      header: 'Avance',
      sortable: true,
      sortValue: (actividad) => actividad.avance,
      render: (actividad) => <Meter valor={actividad.avance} />,
    },
    {
      key: 'estado',
      header: 'Estado',
      sortable: true,
      sortValue: (actividad) => actividad.estado,
      render: (actividad) => (
        <StatusBadge estado={actividad.estado} etiqueta={estadoPlan(actividad)} />
      ),
    },
  ];

  return (
    <>
      <PageHeading
        eyebrow={`Coordinación de tutoría · Plan de tutoría · Semestre ${semestreActual}`}
        title="Plan de tutoría"
        description="Consulta las actividades, los responsables y el avance del plan de cada escuela."
        actions={
          <>
            <Badge tone="info">{escuelas.length} escuelas</Badge>
            <Badge tone="dorado">{actividadesPlan.length} actividades registradas</Badge>
          </>
        }
      />

      <Card>
        <CardHead
          title="Elegir escuela"
          description="Elige una escuela para ver sus actividades y fechas."
          actions={
            <div className="field" style={{ minWidth: 260 }}>
              <label htmlFor={idSelector}>Escuela profesional</label>
              <select
                id={idSelector}
                className="select"
                value={escuelaId}
                onChange={(evento) => setEscuelaId(evento.target.value)}
              >
                {escuelas.map((escuela) => (
                  <option key={escuela.id} value={escuela.id}>
                    {escuela.abreviatura} · {escuela.nombre}
                  </option>
                ))}
              </select>
            </div>
          }
        />
        <CardBody>
          <ul className="list">
            {resumenes.map((fila) => (
              <li className="list__item" key={fila.escuelaId}>
                <span className="list__body">
                  <strong>
                    {abreviaturaEscuela(fila.escuelaId)} · {escuelaDe(fila.escuelaId)}
                  </strong>
                  <p>
                    {fila.actividades} actividades · {fila.culminadas} culminadas ·{' '}
                    {fila.enEjecucion} en ejecución · {fila.planificadas} planificadas
                  </p>
                  <span className="list__meta">
                    <Meter valor={fila.avance} />
                    <span>Avance promedio del plan</span>
                  </span>
                </span>
                <span className="list__aside">
                  {fila.escuelaId === escuelaId ? (
                    <Badge tone="ok">
                      <Check aria-hidden="true" /> Seleccionada
                    </Badge>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-falcon-default btn-sm"
                      onClick={() => setEscuelaId(fila.escuelaId)}
                    >
                      Ver plan
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      {resumenActual && (
        <>
          <div className="grid grid--4">
            <Stat
              label="Actividades del plan"
              value={resumenActual.actividades}
              note={escuelaDe(resumenActual.escuelaId)}
              icon={<Target aria-hidden="true" />}
            />
            <Stat
              label="Avance promedio"
              value={`${resumenActual.avance}%`}
              note="Meta del semestre por actividad"
              icon={<Flag aria-hidden="true" />}
              tone={
                resumenActual.avance >= 70
                  ? 'verde'
                  : resumenActual.avance >= 40
                    ? 'dorado'
                    : 'alerta'
              }
            />
            <Stat
              label="Culminadas"
              value={resumenActual.culminadas}
              note={`${resumenActual.enEjecucion} en ejecución`}
              icon={<Check aria-hidden="true" />}
              tone="info"
            />
            <Stat
              label="Planificadas"
              value={resumenActual.planificadas}
              note="Aún sin ejecución registrada"
              icon={<CalendarDays aria-hidden="true" />}
              tone={resumenActual.planificadas ? 'alerta' : 'verde'}
            />
          </div>

          {problematicas.length > 0 && (
            <Alert tone="alerta" title="Necesidades de la escuela">
              {problematicas.join(' ')} La comisión de tutoría la revisa cada semestre y la sustenta
              con evidencia documental en el informe 01.
            </Alert>
          )}

          <Card>
            <CardHead
              title={`Actividades del plan · ${abreviaturaEscuela(escuelaId)}`}
              description={`${actividadesDeEscuela.length} actividades registradas para el semestre ${semestreActual}`}
              actions={
                <span className="ui-row ui-row--tight">
                  <Users aria-hidden="true" /> Responsables por actividad
                </span>
              }
            />
            <CardBody>
              <div className="stack">
                <Progress
                  valor={resumenActual.avance}
                  etiqueta={`Avance promedio del plan de ${abreviaturaEscuela(escuelaId)}`}
                  variante={
                    resumenActual.avance >= 70
                      ? 'verde'
                      : resumenActual.avance >= 40
                        ? 'dorado'
                        : 'alerta'
                  }
                />
                <DataTable<ActividadPlan>
                  rows={actividadesDeEscuela}
                  columns={columnas}
                  caption={`Plan de tutoría de ${escuelaDe(escuelaId)} · semestre ${semestreActual}`}
                  rowKey={(actividad) => actividad.id}
                  pageSize={8}
                  initialSort={{ key: 'avance', direction: 'desc' }}
                  emptyTitle="Sin actividades registradas"
                  emptyDescription="La comisión de tutoría de la escuela aún no registra su plan de tutoría."
                />
              </div>
            </CardBody>
            <CardFoot>
              <span>
                {referencias.length > 0
                  ? `Aprobación: ${referencias.join(' · ')}`
                  : 'Sin referencia de aprobación registrada'}
              </span>
              <Badge tone="info">{semestreActual}</Badge>
            </CardFoot>
          </Card>

          <Card>
            <CardHead
              title="Calendario de actividades del semestre"
              description="Inicio y cierre de cada actividad del plan, de todas las escuelas."
            />
            <CardBody>
              <Calendar
                eventos={eventos}
                etiqueta="Actividades del plan de tutoría"
                vistaInicial="mes"
                maxPorDia={2}
              />
            </CardBody>
            <CardFoot>
              <span>
                Los eventos verdes corresponden a la escuela seleccionada; los azules, al resto de
                escuelas.
              </span>
            </CardFoot>
          </Card>

          <div className="grid grid--2">
            <Card>
              <CardHead
                title="Metas y resultados"
                description="Qué se espera lograr y cómo se comprobará."
              />
              <CardBody flush>
                <ul className="list">
                  {actividadesDeEscuela.map((actividad) => (
                    <li className="list__item" key={`${actividad.id}-meta`}>
                      <span className="list__icon list__icon--gold" aria-hidden="true">
                        <Flag />
                      </span>
                      <span className="list__body">
                        <strong>{actividad.actividad}</strong>
                        <p>{actividad.meta}</p>
                        <span className="list__meta">
                          <span>Evidencia: {actividad.evidencia}</span>
                          <span>Cierre {formatFechaLarga(actividad.fechaFin)}</span>
                        </span>
                      </span>
                      <span className="list__aside">
                        <StatusBadge estado={actividad.estado} etiqueta={estadoPlan(actividad)} />
                      </span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>

            <Card accent>
              <CardHead
                title="Seguimiento del plan"
                description="Responsables de revisar el avance."
              />
              <CardBody>
                <dl className="def-list">
                  <div>
                    <dt>Cómo se calcula la atención</dt>
                    <dd>
                      Se separan estudiantes únicos atendidos, atenciones acumuladas y sesiones
                      realizadas al reportar el avance del plan.
                    </dd>
                  </div>
                  <div>
                    <dt>Formato por etapa</dt>
                    <dd>
                      {Object.values(etapaAcademica)
                        .map((etapa) => `${etapa.ciclos}: formato ${etapa.formato.slice(1)}`)
                        .join(' · ')}
                      .
                    </dd>
                  </div>
                  <div>
                    <dt>Evidencia de actividad</dt>
                    <dd>
                      Acta, lista de asistencia o informe del tutor (formato 02) según la actividad.
                    </dd>
                  </div>
                  <div>
                    <dt>Vigencia de formatos</dt>
                    <dd>
                      Pendiente de confirmación por Tutoría y Capacitación Docente; el sistema no
                      inventa reglas de llenado.
                    </dd>
                  </div>
                </dl>
                {actividadesDeEscuela.length === 0 && (
                  <EmptyState
                    title="Sin plan registrado"
                    description="Solicite a la comisión de tutoría el plan de tutoría de la escuela."
                    icon={<Target />}
                  />
                )}
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
