import { promedioDe } from '../../utils/datosAcademicos';
import { etiquetaEtapa } from '../../utils/datosAcademicos';
import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, CircleAlert, UserCheck, Users, TrendingUp } from '../../components/ui/icons';
import { PageHeading } from '../../components/ui/PageHeading';
import { Card, CardBody, CardFoot, CardHead } from '../../components/ui/Card';
import { Stat } from '../../components/ui/Stat';
import { Alert } from '../../components/ui/Alert';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Progress } from '../../components/ui/Progress';
import { DataTable } from '../../components/ui/DataTable';
import type { Column } from '../../components/ui/DataTable';
import { PersonCell } from '../../components/ui/PersonCell';
import { Sheet } from '../../components/ui/Sheet';
import { EmptyState } from '../../components/ui/EmptyState';
import { useFiltro } from '../../components/panels/PanelFiltros';
import {
  DirectoryPage,
  DirectorySummary,
  DirectoryViews,
  DirectoryDisclosure,
} from '../../components/ui/DirectoryPage';
import { DirectoryToolbar } from '../../components/ui/DirectoryToolbar';
import type { DefinicionSelect } from '../../components/panels/PanelFiltros';
import { usePortal } from '../../hooks/usePortal';
import { usePersonasPortal } from '../../hooks/usePersonasPortal';
import { AccionesCuentas } from '../../components/panels/AccionesCuentas';
import type { AlertaAcademica, Estudiante, Sesion } from '../../types/domain';
import { abreviaturaEscuela, docentePorId, iniciales, nombreCompleto } from '../../data/personas';
import { escuelas, semestreActual } from '../../data/catalogos';
import { asignaciones, sesionesDeEstudiante } from '../../data/tutoria';
import { matriculaDe, nombreCurso, resumenDe } from '../../data/academico';
import { formatFecha } from '../../utils/fechas';

const NIVELES_ALERTA: Array<AlertaAcademica['nivel']> = ['alta', 'media', 'baja'];

/** Fila del padrón de tutorados con la asignación vigente resuelta. */
interface FilaTutorado {
  estudiante: Estudiante;
  tutorId: string | null;
  grupo: string | null;
  criterio: string | null;
  sesiones: number;
  asistidas: number;
  nivelAlerta: AlertaAcademica['nivel'] | null;
}

/** Nivel más alto entre las alertas del tutorado. */
function nivelDe(alertas: AlertaAcademica[]): AlertaAcademica['nivel'] | null {
  if (alertas.some((alerta) => alerta.nivel === 'alta')) return 'alta';
  if (alertas.some((alerta) => alerta.nivel === 'media')) return 'media';
  if (alertas.length > 0) return 'baja';
  return null;
}

/** Texto legible de la etapa académica del tutorado. */
function etapaTexto(etapa: Estudiante['etapa']): string {
  return etiquetaEtapa(etapa);
}

/** Construye la fila del padrón a partir del expediente y su asignación. */
function filaDe(estudiante: Estudiante, sesionesActuales?: Sesion[]): FilaTutorado {
  const asignacion = asignaciones.find(
    (item) => item.estudianteId === estudiante.id && item.estado === 'activa',
  );
  const sesiones = sesionesActuales
    ? sesionesActuales.filter((sesion) =>
        sesion.asistentes.some((asistente) => asistente.estudianteId === estudiante.id),
      )
    : sesionesDeEstudiante(estudiante.id);
  const asistidas = sesiones.filter((sesion) =>
    sesion.asistentes.some(
      (asistente) =>
        asistente.estudianteId === estudiante.id &&
        (asistente.estado === 'asistio' || asistente.estado === 'tarde'),
    ),
  );
  return {
    estudiante,
    tutorId: asignacion?.tutorId ?? null,
    grupo: asignacion?.grupo ?? null,
    criterio: asignacion?.criterio ?? null,
    sesiones: sesiones.filter((sesion) => sesion.estado === 'realizada').length,
    asistidas: asistidas.length,
    nivelAlerta: nivelDe(estudiante.alertas),
  };
}

/**
 * Padrón de tutorados de la escuela: expediente académico consultado en modo
 * lectura, asignación tutorial vigente, etapa académica, promedio ponderado y
 * alertas de acompañamiento, con la ficha ampliada de cada estudiante.
 */
export function CoordTutees() {
  const portal = usePortal();
  const { estudiantes } = usePersonasPortal();
  const [detalle, setDetalle] = useState<Estudiante | null>(null);

  const filas = useMemo<FilaTutorado[]>(
    () =>
      estudiantes
        .map((estudiante) => filaDe(estudiante, portal.sesiones))
        .sort((a, b) => a.estudiante.apellidos.localeCompare(b.estudiante.apellidos, 'es')),
    [estudiantes, portal.sesiones],
  );

  const buscarEn = useCallback(
    (fila: FilaTutorado) =>
      [
        fila.estudiante.codigo,
        fila.estudiante.apellidos,
        fila.estudiante.nombres,
        fila.estudiante.correo,
        fila.grupo ?? '',
        fila.tutorId ? (docentePorId(fila.tutorId)?.apellidos ?? '') : '',
      ].join(' '),
    [],
  );

  const selects = useMemo<Array<DefinicionSelect<FilaTutorado>>>(
    () => [
      {
        id: 'escuela',
        etiqueta: 'Escuela',
        opciones: escuelas.map((escuela) => ({ valor: escuela.id, etiqueta: escuela.abreviatura })),
        valorDe: (fila) => fila.estudiante.escuelaId,
      },
      {
        id: 'ciclo',
        etiqueta: 'Ciclo',
        opciones: [...new Set(estudiantes.map((estudiante) => estudiante.ciclo))]
          .sort((a, b) => (a ?? Infinity) - (b ?? Infinity))
          .map((ciclo) => ({
            valor: String(ciclo),
            etiqueta: ciclo === null ? 'Sin ciclo informado' : `Ciclo ${ciclo}`,
          })),
        valorDe: (fila) => String(fila.estudiante.ciclo),
      },
      {
        id: 'etapa',
        etiqueta: 'Etapa',
        opciones: (
          ['ingresante', 'intermedio', 'final', 'sin-informar'] as Estudiante['etapa'][]
        ).map((etapa) => ({
          valor: etapa,
          etiqueta: etapaTexto(etapa),
        })),
        valorDe: (fila) => fila.estudiante.etapa,
      },
      {
        id: 'estado',
        etiqueta: 'Estado académico',
        opciones: (
          [
            'regular',
            'observado',
            'reserva',
            'retirado',
            'egresado',
            'ingresante',
          ] as Estudiante['estado'][]
        ).map((estado) => ({
          valor: estado,
          etiqueta: estado.charAt(0).toUpperCase() + estado.slice(1),
        })),
        valorDe: (fila) => fila.estudiante.estado,
      },
      {
        id: 'alerta',
        etiqueta: 'Alerta',
        opciones: [
          { valor: 'ninguna', etiqueta: 'Sin alertas' },
          ...NIVELES_ALERTA.map((nivel) => ({
            valor: nivel,
            etiqueta: `Prioridad ${nivel}`,
          })),
        ],
        valorDe: (fila) => fila.nivelAlerta ?? 'ninguna',
      },
      {
        id: 'tutor',
        etiqueta: 'Tutor',
        opciones: [
          { valor: 'sin-tutor', etiqueta: 'Sin tutor asignado' },
          ...[...new Set(estudiantes.map((estudiante) => filaDe(estudiante).tutorId))]
            .filter((id): id is string => Boolean(id))
            .map((id) => ({
              valor: id,
              etiqueta: docentePorId(id)
                ? `${docentePorId(id)?.apellidos ?? ''}, ${docentePorId(id)?.nombres ?? ''}`
                : id,
            })),
        ],
        valorDe: (fila) => fila.tutorId ?? 'sin-tutor',
      },
    ],
    [estudiantes],
  );

  const filtro = useFiltro(filas, buscarEn, selects);

  const deLaEscuela = filas.filter((fila) => fila.estudiante.escuelaId === portal.escuelaId);
  const conTutor = deLaEscuela.filter((fila) => fila.tutorId).length;
  const alertaAlta = filas.filter((fila) => fila.nivelAlerta === 'alta').length;
  const promedioEscuela = promedioDe(deLaEscuela.map((fila) => fila.estudiante));
  const enRiesgoAcademico = filas.filter(
    (fila) => (fila.estudiante.promedioPonderado ?? Infinity) < 12,
  ).length;
  const conObservaciones = filas.filter((fila) => fila.estudiante.estado === 'observado').length;

  const detalleFila = detalle ? filaDe(detalle, portal.sesiones) : null;
  const tutorDelDetalle =
    detalleFila && detalleFila.tutorId ? docentePorId(detalleFila.tutorId) : undefined;
  const resumen = detalle ? resumenDe(detalle.id) : undefined;
  const matricula = detalle ? matriculaDe(detalle.id) : undefined;

  const columnas: Column<FilaTutorado>[] = [
    {
      key: 'estudiante',
      header: 'Estudiante',
      sortable: true,
      sortValue: (fila) => `${fila.estudiante.apellidos} ${fila.estudiante.nombres}`,
      render: (fila) => (
        <PersonCell
          nombres={fila.estudiante.nombres}
          apellidos={fila.estudiante.apellidos}
          detalle={`${fila.estudiante.codigo} · ${abreviaturaEscuela(fila.estudiante.escuelaId)}`}
          iniciales={iniciales(fila.estudiante)}
          tono={fila.nivelAlerta === 'alta' ? 'dorado' : 'verde'}
        />
      ),
    },
    {
      key: 'ciclo',
      header: 'Ciclo / etapa',
      sortable: true,
      sortValue: (fila) => fila.estudiante.ciclo,
      render: (fila) => (
        <span>
          {fila.estudiante.ciclo === null ? 'Por confirmar' : `Ciclo ${fila.estudiante.ciclo}`}
          {fila.estudiante.etapa !== 'sin-informar' && (
            <small className="cell-note">{etapaTexto(fila.estudiante.etapa)}</small>
          )}
        </span>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      sortable: true,
      sortValue: (fila) => fila.estudiante.estado,
      render: (fila) => (
        <span className="directory-student-status">
          <StatusBadge estado={fila.estudiante.estado} />
          {fila.nivelAlerta && (
            <small data-level={fila.nivelAlerta}>Alerta {fila.nivelAlerta}</small>
          )}
        </span>
      ),
    },
    {
      key: 'promedio',
      header: 'Promedio',
      sortable: true,
      sortValue: (fila) => fila.estudiante.promedioPonderado,
      render: (fila) => (
        <span className="stack" style={{ gap: 2 }}>
          <strong
            className={
              (fila.estudiante.promedioPonderado ?? Infinity) < 11 ? 'text-danger' : 'cell-strong'
            }
          >
            {fila.estudiante.promedioPonderado?.toFixed(1) ?? 'Sin informar'}
          </strong>
        </span>
      ),
    },
    {
      key: 'tutor',
      header: 'Tutor asignado',
      sortable: true,
      sortValue: (fila) => (fila.tutorId ? (docentePorId(fila.tutorId)?.apellidos ?? '') : ''),
      render: (fila) => {
        const tutor = fila.tutorId ? docentePorId(fila.tutorId) : undefined;
        return tutor ? (
          <span className="stack" style={{ gap: 1 }}>
            <strong className="cell-strong">{nombreCompleto(tutor)}</strong>
            <span className="cell-note">{fila.grupo ?? 'Sin grupo'}</span>
          </span>
        ) : (
          <span className="cell-note">Por asignar</span>
        );
      },
    },
    {
      key: 'acciones',
      header: 'Detalle',
      render: (fila) => (
        <span className="cell-actions">
          <button
            type="button"
            className="btn btn-falcon-default btn-sm"
            aria-label={`Ver ficha de ${fila.estudiante.apellidos}, ${fila.estudiante.nombres}`}
            onClick={() => setDetalle(fila.estudiante)}
          >
            Ver ficha
          </button>
        </span>
      ),
    },
  ];

  return (
    <DirectoryPage>
      <PageHeading
        eyebrow={`Coordinación de tutoría · ${abreviaturaEscuela(portal.escuelaId)} · Semestre ${semestreActual}`}
        title="Estudiantes"
        description="Padrón académico y seguimiento del acompañamiento tutorial."
        actions={
          <>
            <AccionesCuentas rol="estudiante" />
            <Link className="btn btn-falcon-default" to="/coordinacion/padron">
              <i className="fa-solid fa-file-csv" aria-hidden="true" /> Padrón de estudiantes
            </Link>
          </>
        }
      />

      <DirectorySummary
        label="Cobertura tutorial"
        icon={<UserCheck aria-hidden="true" />}
        value={`${filas.filter((fila) => fila.tutorId).length} / ${filas.length}`}
        percent={
          filas.length
            ? Math.round((filas.filter((fila) => fila.tutorId).length / filas.length) * 100)
            : 0
        }
        note="con tutor asignado"
        metrics={[
          {
            label: `Estudiantes de ${abreviaturaEscuela(portal.escuelaId)}`,
            value: deLaEscuela.length,
            note: `${conTutor} con tutor asignado`,
            icon: <Users aria-hidden="true" />,
          },
          {
            label: `Promedio de ${abreviaturaEscuela(portal.escuelaId)}`,
            value: promedioEscuela?.toFixed(1) ?? 'Sin datos',
            note: `${enRiesgoAcademico} del padrón con promedio < 12`,
            icon: <TrendingUp aria-hidden="true" />,
          },
          {
            label: 'Alertas de prioridad alta',
            value: alertaAlta,
            note: `${conObservaciones} en estado observado`,
            tone: alertaAlta ? 'warning' : 'default',
            icon: <CircleAlert aria-hidden="true" />,
          },
        ]}
      />

      <Card>
        <CardHead
          title="Directorio de estudiantes"
          actions={<span className="directory-result">Semestre {semestreActual}</span>}
        />
        <CardBody>
          <div className="stack">
            <DirectoryToolbar
              busqueda={filtro.busqueda}
              onBusqueda={filtro.setBusqueda}
              selects={selects}
              valores={filtro.valores}
              onValores={filtro.setValores}
              mostrados={filtro.filtrados.length}
              total={filas.length}
              onLimpiar={filtro.limpiar}
              etiqueta="Filtros del registro de estudiantes"
              placeholder="Buscar por nombre, código o grupo…"
              views={
                <DirectoryViews
                  views={[
                    {
                      label: 'Todos',
                      count: filas.length,
                      active:
                        !filtro.valores.tutor && !filtro.valores.alerta && !filtro.valores.estado,
                      onClick: () =>
                        filtro.setValores((v) => ({ ...v, tutor: '', alerta: '', estado: '' })),
                    },
                    {
                      label: 'Sin tutor',
                      count: filas.filter((fila) => !fila.tutorId).length,
                      active:
                        filtro.valores.tutor === 'sin-tutor' &&
                        !filtro.valores.alerta &&
                        !filtro.valores.estado,
                      onClick: () =>
                        filtro.setValores((v) => ({
                          ...v,
                          tutor: 'sin-tutor',
                          alerta: '',
                          estado: '',
                        })),
                    },
                    {
                      label: 'Prioridad alta',
                      count: alertaAlta,
                      active:
                        filtro.valores.alerta === 'alta' &&
                        !filtro.valores.estado &&
                        !filtro.valores.tutor,
                      onClick: () =>
                        filtro.setValores((v) => ({ ...v, tutor: '', alerta: 'alta', estado: '' })),
                    },
                    {
                      label: 'Observados',
                      count: conObservaciones,
                      active:
                        filtro.valores.estado === 'observado' &&
                        !filtro.valores.alerta &&
                        !filtro.valores.tutor,
                      onClick: () =>
                        filtro.setValores((v) => ({
                          ...v,
                          tutor: '',
                          alerta: '',
                          estado: 'observado',
                        })),
                    },
                  ]}
                />
              }
            />
            <DataTable<FilaTutorado>
              rows={filtro.filtrados}
              columns={columnas}
              caption={`Registro de estudiantes asignados · semestre ${semestreActual}`}
              rowKey={(fila) => fila.estudiante.id}
              pageSize={10}
              paginationPosition="bottom"
              inlineActions
              initialSort={{ key: 'estudiante', direction: 'asc' }}
              emptyTitle="Sin estudiantes con estos filtros"
              emptyDescription="Pruebe otra escuela, ciclo o nivel de alerta."
            />
          </div>
        </CardBody>
        <CardFoot>
          <span>Fuente: DIAA · padrón académico y asignaciones de la comisión de tutoría.</span>
        </CardFoot>
      </Card>

      <DirectoryDisclosure title="Uso de la información académica">
        El sistema muestra el estado académico y las señales de acompañamiento. No incluye
        diagnósticos ni detalles clínicos. Las alertas orientan el acompañamiento y no constituyen
        sanción.
      </DirectoryDisclosure>

      {detalle && detalleFila && (
        <Sheet
          wide
          title={`${detalle.apellidos}, ${detalle.nombres}`}
          description={`${detalle.codigo} · ${abreviaturaEscuela(detalle.escuelaId)} · ciclo ${detalle.ciclo ?? 'sin informar'} · ${etapaTexto(detalle.etapa)}`}
          onClose={() => setDetalle(null)}
          footer={
            <button
              type="button"
              className="btn btn-falcon-default"
              onClick={() => setDetalle(null)}
            >
              Cerrar ficha
            </button>
          }
        >
          <div className="stack stack--lg">
            <div className="grid grid--3">
              <Stat
                label="Promedio ponderado"
                icon={<TrendingUp />}
                value={detalle.promedioPonderado?.toFixed(1) ?? 'Sin informar'}
                note={`Créditos aprobados: ${detalle.creditosAprobados ?? 'Sin informar'}${detalle.creditosTotales === null ? '' : ` de ${detalle.creditosTotales}`}`}
                tone={(detalle.promedioPonderado ?? Infinity) < 11 ? 'riesgo' : 'verde'}
              />
              <Stat
                label="Sesiones asistidas"
                value={`${detalleFila.asistidas}/${detalleFila.sesiones}`}
                note="Sesiones individuales y grupales realizadas"
                icon={<UserCheck aria-hidden="true" />}
                tone="info"
              />
              <Stat
                label="Cursos matriculados"
                value={matricula?.cursos.length ?? 0}
                note="Semestre vigente"
                icon={<BookOpen aria-hidden="true" />}
                tone="info"
              />
            </div>

            {resumen?.avanceCurricular != null && (
              <Progress
                valor={resumen?.avanceCurricular ?? 0}
                etiqueta="Avance curricular del plan de estudios"
                variante="dorado"
              />
            )}

            <dl className="def-list">
              <div>
                <dt>Código universitario</dt>
                <dd className="mono">{detalle.codigo}</dd>
              </div>
              <div>
                <dt>Correo institucional</dt>
                <dd>
                  <a href={`mailto:${detalle.correo}`}>{detalle.correo}</a>
                </dd>
              </div>
              <div>
                <dt>Teléfono</dt>
                <dd>{detalle.telefono}</dd>
              </div>
              <div>
                <dt>Ingreso</dt>
                <dd>{formatFecha(detalle.ingreso)}</dd>
              </div>
              <div>
                <dt>Estado académico</dt>
                <dd>
                  <StatusBadge estado={detalle.estado} />
                </dd>
              </div>
              <div>
                <dt>Docente tutor</dt>
                <dd>
                  {tutorDelDetalle
                    ? nombreCompleto(tutorDelDetalle)
                    : detalleFila.tutorId
                      ? 'Tutor no registrado en el registro'
                      : 'Sin asignación vigente'}
                </dd>
              </div>
              <div>
                <dt>Grupo y criterio</dt>
                <dd>
                  {detalleFila.grupo ?? 'Sin grupo'} ·{' '}
                  {detalleFila.criterio ?? 'criterio por definir'}
                </dd>
              </div>
              <div>
                <dt>Matrícula {semestreActual}</dt>
                <dd>
                  {matricula
                    ? `${matricula.estado} · ${formatFecha(matricula.fecha)} · ${matricula.cursos.length} cursos`
                    : 'Sin matrícula registrada'}
                </dd>
              </div>
              <div>
                <dt>Fuente del expediente</dt>
                <dd>{resumen?.fuente ?? 'DIAA · consulta de solo lectura'}</dd>
              </div>
              <div>
                <dt>Fecha de corte</dt>
                <dd>{formatFecha(resumen?.fechaCorte)}</dd>
              </div>
            </dl>

            <div>
              <div className="section-head">
                <h2>Señales de acompañamiento</h2>
                <p>{detalle.alertas.length} registradas</p>
              </div>
              {detalle.alertas.length === 0 ? (
                <EmptyState
                  title="Sin alertas registradas"
                  description="El estudiante no presenta alertas académicas ni de bienestar en el corte vigente."
                />
              ) : (
                <ul className="list">
                  {detalle.alertas.map((alerta) => (
                    <li className="list__item" key={alerta.id}>
                      <span
                        className={`list__icon list__icon--${alerta.nivel === 'alta' ? 'danger' : alerta.nivel === 'media' ? 'warn' : 'info'}`}
                        aria-hidden="true"
                      >
                        <CircleAlert />
                      </span>
                      <span className="list__body">
                        <strong>{alerta.detalle}</strong>
                        <p>
                          Tipo {alerta.tipo} · detectada el {formatFecha(alerta.detectada)}. La
                          señal orienta el acompañamiento tutorial y no constituye sanción ni
                          diagnóstico.
                        </p>
                      </span>
                      <span className="list__aside">
                        <StatusBadge estado={alerta.nivel} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <div className="section-head">
                <h2>Cursos del semestre</h2>
                <p>{matricula?.planEstudios ?? 'Plan de estudios no registrado'}</p>
              </div>
              {!matricula || matricula.cursos.length === 0 ? (
                <EmptyState
                  title="Sin cursos matriculados"
                  description="La DIAA no reportó cursos para el semestre en curso."
                  icon={<BookOpen />}
                />
              ) : (
                <div className="table-wrap">
                  <table className="data-table data-table--compact">
                    <caption className="sr-only">
                      Cursos matriculados por {detalle.apellidos}, {detalle.nombres} en el semestre{' '}
                      {semestreActual}
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Curso</th>
                        <th scope="col">Sección</th>
                        <th scope="col">Créditos</th>
                        <th scope="col">Horario</th>
                        <th scope="col">Docente</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matricula.cursos.map((inscrito) => (
                        <tr key={`${inscrito.cursoId}-${inscrito.seccion}`}>
                          <td className="cell-strong">{nombreCurso(inscrito.cursoId)}</td>
                          <td>{inscrito.seccion}</td>
                          <td className="num">{inscrito.creditos ?? 'Sin informar'}</td>
                          <td className="nowrap">{inscrito.horario}</td>
                          <td>{inscrito.docente}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {detalleFila.tutorId && (
              <Alert tone="info" title="Acompañamiento tutorial">
                El docente tutor registra las sesiones, los acuerdos y, cuando corresponde, la ficha
                de solicitud de apoyo (formato 12). La coordinación revisa el cumplimiento del plan
                de tutoría de la escuela.
              </Alert>
            )}
          </div>
        </Sheet>
      )}
    </DirectoryPage>
  );
}
