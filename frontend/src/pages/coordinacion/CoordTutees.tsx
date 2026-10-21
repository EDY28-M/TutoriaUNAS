import { useCallback, useMemo, useState } from 'react';
import {
  BookOpen,
  CircleAlert,
  GraduationCap,
  TrendingUp,
  UserCheck,
  Users,
} from '../../components/ui/icons';
import { PageHeading } from '../../components/ui/PageHeading';
import { Card, CardBody, CardFoot, CardHead } from '../../components/ui/Card';
import { Stat } from '../../components/ui/Stat';
import { Alert } from '../../components/ui/Alert';
import { Badge, StatusBadge } from '../../components/ui/StatusBadge';
import { Progress } from '../../components/ui/Progress';
import { DataTable } from '../../components/ui/DataTable';
import type { Column } from '../../components/ui/DataTable';
import { PersonCell } from '../../components/ui/PersonCell';
import { Sheet } from '../../components/ui/Sheet';
import { EmptyState } from '../../components/ui/EmptyState';
import { PanelFiltros, useFiltro } from '../../components/panels/PanelFiltros';
import type { DefinicionSelect } from '../../components/panels/PanelFiltros';
import { usePortal } from '../../hooks/usePortal';
import type { AlertaAcademica, Estudiante, Sesion } from '../../types/domain';
import {
  abreviaturaEscuela,
  docentePorId,
  escuelaDe,
  estudiantes,
  iniciales,
  nombreCompleto,
} from '../../data/personas';
import { escuelas, etapaAcademica, semestreActual } from '../../data/catalogos';
import { asignaciones, sesionesDeEstudiante } from '../../data/tutoria';
import { matriculaDe, nombreCurso, resumenDe, resultadosDe } from '../../data/academico';
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
  return etapaAcademica[etapa]?.etiqueta ?? etapa;
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
  const [detalle, setDetalle] = useState<Estudiante | null>(null);

  const filas = useMemo<FilaTutorado[]>(
    () =>
      estudiantes
        .map((estudiante) => filaDe(estudiante, portal.sesiones))
        .sort((a, b) => a.estudiante.apellidos.localeCompare(b.estudiante.apellidos, 'es')),
    [portal.sesiones],
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
          .sort((a, b) => a - b)
          .map((ciclo) => ({ valor: String(ciclo), etiqueta: `Ciclo ${ciclo}` })),
        valorDe: (fila) => String(fila.estudiante.ciclo),
      },
      {
        id: 'etapa',
        etiqueta: 'Etapa',
        opciones: (['ingresante', 'intermedio', 'final'] as Estudiante['etapa'][]).map((etapa) => ({
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
    [],
  );

  const filtro = useFiltro(filas, buscarEn, selects);

  const deLaEscuela = filas.filter((fila) => fila.estudiante.escuelaId === portal.escuelaId);
  const conTutor = deLaEscuela.filter((fila) => fila.tutorId).length;
  const alertaAlta = filas.filter((fila) => fila.nivelAlerta === 'alta').length;
  const promedioEscuela = deLaEscuela.length
    ? deLaEscuela.reduce((total, fila) => total + fila.estudiante.promedioPonderado, 0) /
      deLaEscuela.length
    : 0;
  const enRiesgoAcademico = filas.filter((fila) => fila.estudiante.promedioPonderado < 12).length;
  const conObservaciones = filas.filter((fila) => fila.estudiante.estado === 'observado').length;

  const detalleFila = detalle ? filaDe(detalle, portal.sesiones) : null;
  const tutorDelDetalle =
    detalleFila && detalleFila.tutorId ? docentePorId(detalleFila.tutorId) : undefined;
  const resumen = detalle ? resumenDe(detalle.id) : undefined;
  const matricula = detalle ? matriculaDe(detalle.id) : undefined;
  const resultados = detalle ? resultadosDe(detalle.id) : [];
  const cerrados = resultados.filter((fila) => fila.notaFinal !== null);
  const desaprobados = cerrados.filter((fila) => fila.estado === 'desaprobado');

  const columnas: Column<FilaTutorado>[] = [
    {
      key: 'codigo',
      header: 'Código',
      sortable: true,
      sortValue: (fila) => fila.estudiante.codigo,
      render: (fila) => <span className="cell-mono">{fila.estudiante.codigo}</span>,
    },
    {
      key: 'estudiante',
      header: 'Estudiante',
      sortable: true,
      sortValue: (fila) => `${fila.estudiante.apellidos} ${fila.estudiante.nombres}`,
      render: (fila) => (
        <PersonCell
          nombres={fila.estudiante.nombres}
          apellidos={fila.estudiante.apellidos}
          detalle={fila.estudiante.correo}
          iniciales={iniciales(fila.estudiante)}
          tono={fila.nivelAlerta === 'alta' ? 'dorado' : 'verde'}
        />
      ),
    },
    {
      key: 'escuela',
      header: 'Escuela',
      sortable: true,
      sortValue: (fila) => abreviaturaEscuela(fila.estudiante.escuelaId),
      render: (fila) => <Badge tone="info">{abreviaturaEscuela(fila.estudiante.escuelaId)}</Badge>,
    },
    {
      key: 'ciclo',
      header: 'Ciclo',
      sortable: true,
      sortValue: (fila) => fila.estudiante.ciclo,
      render: (fila) => <span className="num">{fila.estudiante.ciclo}</span>,
    },
    {
      key: 'etapa',
      header: 'Etapa',
      sortable: true,
      sortValue: (fila) => etapaTexto(fila.estudiante.etapa),
      render: (fila) => (
        <span className="stack" style={{ gap: 1 }}>
          <span>{etapaTexto(fila.estudiante.etapa)}</span>
          <span className="cell-note">
            Entrevista {etapaAcademica[fila.estudiante.etapa]?.formato ?? '—'}
          </span>
        </span>
      ),
    },
    {
      key: 'estado',
      header: 'Estado académico',
      sortable: true,
      sortValue: (fila) => fila.estudiante.estado,
      render: (fila) => <StatusBadge estado={fila.estudiante.estado} />,
    },
    {
      key: 'promedio',
      header: 'Promedio',
      sortable: true,
      sortValue: (fila) => fila.estudiante.promedioPonderado,
      render: (fila) => (
        <span className="stack" style={{ gap: 2 }}>
          <strong
            className={fila.estudiante.promedioPonderado < 11 ? 'text-danger' : 'cell-strong'}
          >
            {fila.estudiante.promedioPonderado.toFixed(1)}
          </strong>
          <span className="cell-note">{fila.estudiante.creditosAprobados} créditos aprobados</span>
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
            <span className="cell-note">
              {fila.grupo ?? 'Sin grupo'} · {fila.criterio ?? 'criterio por definir'}
            </span>
          </span>
        ) : (
          <Badge tone="alerta">Sin tutor asignado</Badge>
        );
      },
    },
    {
      key: 'sesiones',
      header: 'Asistencia',
      sortable: true,
      sortValue: (fila) => fila.asistidas,
      render: (fila) => (
        <span className="stack" style={{ gap: 1 }}>
          <span className="num">
            {fila.asistidas}/{fila.sesiones} sesiones
          </span>
          <span className="cell-note">Asistió o llegó tarde</span>
        </span>
      ),
    },
    {
      key: 'alertas',
      header: 'Alertas',
      sortable: true,
      sortValue: (fila) => (fila.nivelAlerta ? NIVELES_ALERTA.indexOf(fila.nivelAlerta) : 9),
      render: (fila) =>
        fila.estudiante.alertas.length === 0 ? (
          <Badge tone="ok">Sin señales</Badge>
        ) : (
          <span className="stack" style={{ gap: 2 }}>
            <StatusBadge estado={fila.nivelAlerta ?? 'baja'} />
            <span className="cell-note">{fila.estudiante.alertas[0]?.detalle}</span>
          </span>
        ),
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
    <>
      <PageHeading
        eyebrow={`Coordinación de tutoría · ${abreviaturaEscuela(portal.escuelaId)} · Semestre ${semestreActual}`}
        title="Estudiantes"
        description="Busca estudiantes y revisa su tutor asignado, sus notas y sus alertas."
        actions={
          <>
            <Badge tone="info">{estudiantes.length} registros</Badge>
            <Badge tone={conObservaciones ? 'alerta' : 'ok'}>
              {conObservaciones} en estado observado
            </Badge>
          </>
        }
      />

      <Card>
        <CardHead
          title="Lista de estudiantes"
          description="Busca por escuela, tutor, ciclo o alerta."
        />
        <CardBody>
          <div className="stack">
            <PanelFiltros<FilaTutorado>
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
              etiqueta="Filtros del registro de estudiantes"
              placeholder="Buscar por nombre, código o grupo…"
            />
            <DataTable<FilaTutorado>
              rows={filtro.filtrados}
              columns={columnas}
              caption={`Registro de estudiantes asignados · semestre ${semestreActual}`}
              rowKey={(fila) => fila.estudiante.id}
              pageSize={10}
              initialSort={{ key: 'estudiante', direction: 'asc' }}
              emptyTitle="Sin estudiantes con estos filtros"
              emptyDescription="Pruebe otra escuela, ciclo o nivel de alerta."
            />
          </div>
        </CardBody>
        <CardFoot>
          <span>
            Fuente: registro de estudiantes de la DIAA y asignaciones registradas por la comisión de
            tutoría.
          </span>
          <span className="ui-row ui-row--tight">
            <UserCheck aria-hidden="true" /> {conTutor} de {deLaEscuela.length} estudiantes tienen
            tutor asignado.
          </span>
        </CardFoot>
      </Card>

      <div className="grid grid--4">
        <Stat
          label={`Estudiantes de ${abreviaturaEscuela(portal.escuelaId)}`}
          value={deLaEscuela.length}
          note={`${conTutor} con docente tutor asignado`}
          icon={<Users aria-hidden="true" />}
        />
        <Stat
          label="Promedio de la escuela"
          value={promedioEscuela.toFixed(1)}
          note={`${escuelaDe(portal.escuelaId)} · escala 0–20`}
          icon={<TrendingUp aria-hidden="true" />}
          tone={promedioEscuela >= 13 ? 'verde' : 'alerta'}
        />
        <Stat
          label="Alertas de prioridad alta"
          value={alertaAlta}
          note="Requieren seguimiento de la comisión"
          icon={<CircleAlert aria-hidden="true" />}
          tone={alertaAlta ? 'riesgo' : 'verde'}
        />
        <Stat
          label="Promedio por debajo de 12"
          value={enRiesgoAcademico}
          note="Posible riesgo académico (sin valor de sanción)"
          icon={<GraduationCap aria-hidden="true" />}
          tone={enRiesgoAcademico ? 'alerta' : 'verde'}
        />
      </div>

      <Alert tone="info" title="Uso de los datos del estudiante">
        El sistema muestra el estado académico y las señales de acompañamiento. No incluye
        diagnósticos ni detalles clínicos: solo la recomendación autorizada autorizada por el área
        responsable (Ley N.º 29733).
      </Alert>

      {detalle && detalleFila && (
        <Sheet
          wide
          title={`${detalle.apellidos}, ${detalle.nombres}`}
          description={`${detalle.codigo} · ${abreviaturaEscuela(detalle.escuelaId)} · ciclo ${detalle.ciclo} · ${etapaTexto(detalle.etapa)}`}
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
                value={detalle.promedioPonderado.toFixed(1)}
                note={`Créditos aprobados: ${detalle.creditosAprobados} de ${detalle.creditosTotales}`}
                tone={detalle.promedioPonderado < 11 ? 'riesgo' : 'verde'}
              />
              <Stat
                label="Sesiones asistidas"
                value={`${detalleFila.asistidas}/${detalleFila.sesiones}`}
                note="Sesiones individuales y grupales realizadas"
                icon={<UserCheck aria-hidden="true" />}
                tone="info"
              />
              <Stat
                label="Cursos desaprobados"
                value={desaprobados.length}
                note={`${cerrados.length} cursos con nota registrada`}
                icon={<BookOpen aria-hidden="true" />}
                tone={desaprobados.length ? 'alerta' : 'verde'}
              />
            </div>

            <Progress
              valor={resumen?.avanceCurricular ?? 0}
              etiqueta="Avance curricular del plan de estudios"
              variante="dorado"
            />

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
                          <td className="num">{inscrito.creditos}</td>
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
    </>
  );
}
