import { useMemo, useState } from 'react';
import { PageHeading } from '../../components/ui/PageHeading';
import { Card, CardBody, CardHead } from '../../components/ui/Card';
import { Badge, StatusBadge } from '../../components/ui/StatusBadge';
import { DataTable } from '../../components/ui/DataTable';
import type { Column } from '../../components/ui/DataTable';
import { Progress } from '../../components/ui/Progress';
import { Tabs, TabPanel } from '../../components/ui/Tabs';
import { EmptyState } from '../../components/ui/EmptyState';
import { usePortal } from '../../hooks/usePortal';
import {
  FECHA_CORTE_ACADEMICA,
  FUENTE_ACADEMICA,
  cursoPorId,
  horarioDe,
  matriculaDe,
  nombreCurso,
  resumenDe,
  resultadosDe,
} from '../../data/academico';
import { semestreActual } from '../../data/catalogos';
import { escuelaDe } from '../../data/personas';
import { DIAS_SEMANA, formatFecha } from '../../utils/fechas';
import type { EvaluacionCurso, MatriculaCurso, ResultadoAcademico } from '../../types/domain';
import '../../styles/student-record.css';

/** Matrícula y notas primero; los datos de procedencia y del estudiante quedan a demanda. */
export function StudentRecord() {
  const { estudiante } = usePortal();
  const [pestana, setPestana] = useState('matricula');
  const resultados = useMemo(() => (estudiante ? resultadosDe(estudiante.id) : []), [estudiante]);
  const matricula = estudiante ? matriculaDe(estudiante.id) : undefined;
  const resumen = estudiante ? resumenDe(estudiante.id) : undefined;
  const horario = estudiante ? horarioDe(estudiante.id) : [];
  if (!estudiante)
    return (
      <EmptyState
        title="Sin información académica"
        description="Aún no hay un expediente asociado a tu cuenta."
      />
    );

  const cerrados = resultados.filter((fila) => fila.semestreId !== semestreActual);
  const desaprobados = resultados.filter((fila) => fila.estado === 'desaprobado');
  const repitencias = resultados.filter((fila) => fila.vecesCursado > 1);
  const cursosMatriculados = matricula?.cursos ?? [];
  const creditosMatriculados = cursosMatriculados.reduce(
    (total, curso) => total + curso.creditos,
    0,
  );
  const avance =
    resumen?.avanceCurricular ??
    (estudiante.creditosTotales
      ? (estudiante.creditosAprobados / estudiante.creditosTotales) * 100
      : 0);
  const columnasCurso: Column<ResultadoAcademico>[] = [
    {
      key: 'curso',
      header: 'Curso',
      sortable: true,
      sortValue: (fila) => nombreCurso(fila.cursoId),
      render: (fila) => {
        const curso = cursoPorId(fila.cursoId);
        return (
          <span className="person-cell__text">
            <strong>{nombreCurso(fila.cursoId)}</strong>
            <small className="mono">
              {curso?.codigo} · Ciclo {curso?.ciclo} · {fila.creditos} créditos
            </small>
          </span>
        );
      },
    },
    {
      key: 'semestre',
      header: 'Semestre',
      sortable: true,
      sortValue: (fila) => fila.semestreId,
      render: (fila) => <span className="mono small">{fila.semestreId}</span>,
    },
    {
      key: 'nota',
      header: 'Nota /20',
      sortable: true,
      sortValue: (fila) => fila.notaFinal ?? -1,
      align: 'right',
      render: (fila) =>
        fila.notaFinal === null ? (
          <span className="small muted">En curso</span>
        ) : (
          <span
            className="mono"
            style={{
              fontWeight: 700,
              color: fila.notaFinal >= 11 ? 'var(--ok)' : 'var(--danger)',
            }}
          >
            {fila.notaFinal.toFixed(1)}
          </span>
        ),
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (fila) => <StatusBadge estado={fila.estado} />,
    },
    {
      key: 'repeticion',
      header: 'Intentos',
      align: 'right',
      render: (fila) => (
        <span className={fila.vecesCursado > 1 ? 'text-warn nowrap' : 'nowrap'}>
          {fila.vecesCursado}
        </span>
      ),
    },
  ];

  const columnasMatricula: Column<MatriculaCurso>[] = [
    {
      key: 'curso',
      header: 'Curso',
      sortable: true,
      sortValue: (fila) => nombreCurso(fila.cursoId),
      render: (fila) => (
        <span className="person-cell__text">
          <strong>{nombreCurso(fila.cursoId)}</strong>
          <small>{cursoPorId(fila.cursoId)?.codigo}</small>
        </span>
      ),
    },
    {
      key: 'seccion',
      header: 'Sección',
      render: (fila) => <span className="mono">{fila.seccion}</span>,
    },
    { key: 'docente', header: 'Docente', render: (fila) => fila.docente },
    {
      key: 'horario',
      header: 'Horario',
      render: (fila) => <span className="mono small">{fila.horario}</span>,
    },
    {
      key: 'creditos',
      header: 'Créditos',
      align: 'right',
      sortable: true,
      sortValue: (fila) => fila.creditos,
      render: (fila) => fila.creditos,
    },
  ];

  const ultimoResultado = cerrados[cerrados.length - 1];
  const evaluaciones: EvaluacionCurso[] = ultimoResultado?.evaluaciones ?? [];

  return (
    <div className="studies-page">
      <PageHeading
        eyebrow={`Estudiante · ${escuelaDe(estudiante.escuelaId)}`}
        title="Mis estudios"
        description={`Semestre ${semestreActual} · Ciclo ${estudiante.ciclo}`}
      />
      <dl className="studies-summary" aria-label="Resumen académico">
        <div>
          <dt>Promedio</dt>
          <dd>
            {estudiante.promedioPonderado.toFixed(1)} <small>/20</small>
          </dd>
        </div>
        <div>
          <dt>Créditos aprobados</dt>
          <dd className="studies-credits">
            <span>
              {estudiante.creditosAprobados} <small>/ {estudiante.creditosTotales}</small>
            </span>
            <strong>{Math.round(avance)}%</strong>
          </dd>
          <Progress valor={avance} mostrarValor={false} />
        </div>
      </dl>
      <Tabs
        etiqueta="Secciones del expediente académico"
        activo={pestana}
        onChange={setPestana}
        items={[
          { id: 'matricula', label: 'Matrícula' },
          { id: 'cursos', label: 'Notas' },
          { id: 'evaluaciones', label: 'Evaluaciones' },
          { id: 'horario', label: 'Horario' },
          { id: 'datos', label: 'Mis datos' },
        ]}
      />

      <TabPanel id="matricula" activo={pestana}>
        <Card>
          <CardHead
            title={`Matrícula ${semestreActual}`}
            description={`${cursosMatriculados.length} cursos · ${creditosMatriculados} créditos`}
            actions={<StatusBadge estado={matricula?.estado ?? 'no-matriculado'} />}
          />
          <CardBody>
            <DataTable
              rows={cursosMatriculados}
              columns={columnasMatricula}
              caption="Cursos matriculados"
              rowKey={(fila) => fila.cursoId}
              pageSize={10}
              pagination="auto"
              compact
              emptyTitle="Sin cursos matriculados"
              emptyDescription="Aún no hay matrícula registrada para este semestre."
            />
          </CardBody>
        </Card>
      </TabPanel>

      <TabPanel id="cursos" activo={pestana}>
        <Card>
          <CardHead title="Notas por curso" />
          <CardBody>
            <DataTable
              rows={resultados}
              columns={columnasCurso}
              caption="Notas por curso y semestre"
              rowKey={(fila) => fila.id}
              pageSize={12}
              pagination="auto"
              emptyTitle="Sin notas registradas"
            />
          </CardBody>
        </Card>
      </TabPanel>

      <TabPanel id="evaluaciones" activo={pestana}>
        <Card>
          <CardHead
            title="Evaluaciones"
            description={
              ultimoResultado
                ? `${nombreCurso(ultimoResultado.cursoId)} · ${ultimoResultado.semestreId}`
                : undefined
            }
          />
          <CardBody>
            {evaluaciones.length === 0 ? (
              <EmptyState title="Sin evaluaciones registradas" />
            ) : (
              <ul className="studies-evaluations">
                {evaluaciones.map((evaluacion) => (
                  <li key={evaluacion.nombre}>
                    <div>
                      <strong>{evaluacion.nombre}</strong>
                      <small>Peso {evaluacion.peso}%</small>
                    </div>
                    <span>
                      {evaluacion.nota ?? '—'} <small>/20</small>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </TabPanel>

      <TabPanel id="horario" activo={pestana}>
        <Card>
          <CardHead title="Horario de clases" />
          <CardBody>
            {horario.length === 0 ? (
              <EmptyState title="Sin horario registrado" />
            ) : (
              <div className="stack">
                {[1, 2, 3, 4, 5].map((dia) => {
                  const bloques = horario
                    .filter((bloque) => bloque.dia === dia)
                    .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
                  if (!bloques.length) return null;
                  return (
                    <div key={dia}>
                      <p className="agenda__date">{DIAS_SEMANA[dia - 1]}</p>
                      <div className="stack stack--sm">
                        {bloques.map((bloque) => (
                          <div className="agenda__row" key={bloque.id}>
                            <span className="agenda__time">
                              {bloque.horaInicio}
                              <small>{bloque.horaFin}</small>
                            </span>
                            <span className="list__body">
                              <strong>{bloque.titulo}</strong>
                              <p>{bloque.lugar}</p>
                            </span>
                            <span className="list__aside">
                              <Badge tone="info">{bloque.modalidad}</Badge>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>
      </TabPanel>

      <TabPanel id="datos" activo={pestana}>
        <Card>
          <CardHead title="Mis datos" />
          <CardBody>
            <dl className="def-list">
              <div>
                <dt>Código universitario</dt>
                <dd className="mono">{estudiante.codigo}</dd>
              </div>
              <div>
                <dt>Nombre completo</dt>
                <dd>
                  {estudiante.apellidos}, {estudiante.nombres}
                </dd>
              </div>
              <div>
                <dt>Escuela</dt>
                <dd>{escuelaDe(estudiante.escuelaId)}</dd>
              </div>
              <div>
                <dt>Ciclo</dt>
                <dd>
                  {estudiante.ciclo} · {estudiante.etapa}
                </dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>
                  <StatusBadge estado={estudiante.estado} />
                </dd>
              </div>
              <div>
                <dt>Correo institucional</dt>
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
                <dt>Promedio del último semestre</dt>
                <dd>{resumen?.promedioSemestre?.toFixed(1) ?? '—'}</dd>
              </div>
              <div>
                <dt>Cursos desaprobados</dt>
                <dd>{desaprobados.length}</dd>
              </div>
              <div>
                <dt>Repitencias</dt>
                <dd>{repitencias.length}</dd>
              </div>
              {matricula && (
                <>
                  <div>
                    <dt>Registro de matrícula</dt>
                    <dd>{formatFecha(matricula.fecha)}</dd>
                  </div>
                  <div>
                    <dt>Plan de estudios</dt>
                    <dd>{matricula.planEstudios}</dd>
                  </div>
                </>
              )}
            </dl>
          </CardBody>
        </Card>
      </TabPanel>

      <details className="studies-source">
        <summary>DIAA · Actualizado {formatFecha(FECHA_CORTE_ACADEMICA)}</summary>
        <p>{FUENTE_ACADEMICA}. Las actualizaciones las realiza la DIAA.</p>
      </details>
    </div>
  );
}
