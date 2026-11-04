import { useState } from 'react';
import { PageHeading } from '../../components/ui/PageHeading';
import { Card, CardBody, CardHead } from '../../components/ui/Card';
import { Badge, StatusBadge } from '../../components/ui/StatusBadge';
import { DataTable } from '../../components/ui/DataTable';
import type { Column } from '../../components/ui/DataTable';
import { MetricGroup } from '../../components/ui/MetricGroup';
import { Stat } from '../../components/ui/Stat';
import { GraduationCap, BookOpen, UserCheck } from '../../components/ui/icons';
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
} from '../../data/academico';
import { semestreActual } from '../../data/catalogos';
import { escuelaDe } from '../../data/personas';
import { DIAS_SEMANA, formatFecha } from '../../utils/fechas';
import type { MatriculaCurso } from '../../types/domain';
import '../../styles/student-record.css';

/** Matrícula y horario primero; los datos de procedencia y del estudiante quedan a demanda. */
export function StudentRecord() {
  const { estudiante } = usePortal();
  const [pestana, setPestana] = useState('matricula');
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

  const cursosMatriculados = matricula?.cursos ?? [];
  const creditosMatriculados = cursosMatriculados.reduce(
    (total, curso) => total + (curso.creditos ?? 0),
    0,
  );
  const avance =
    resumen?.avanceCurricular ??
    (estudiante.creditosTotales
      ? ((estudiante.creditosAprobados ?? 0) / estudiante.creditosTotales) * 100
      : 0);
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
      sortValue: (fila) => fila.creditos ?? -1,
      render: (fila) => fila.creditos ?? 'Sin informar',
    },
  ];

  return (
    <div className="studies-page">
      <PageHeading
        eyebrow={`Estudiante · ${escuelaDe(estudiante.escuelaId)}`}
        title="Mis estudios"
        description={`Semestre ${semestreActual} · Ciclo ${estudiante.ciclo ?? 'sin informar'}`}
      />
      <MetricGroup label="Resumen académico">
        <Stat
          label="Promedio"
          value={estudiante.promedioPonderado?.toFixed(1) ?? '—'}
          note="Escala 0–20"
          icon={<GraduationCap />}
        />
        <Stat
          label="Créditos aprobados"
          value={estudiante.creditosAprobados ?? '—'}
          note={
            estudiante.creditosTotales !== null
              ? `De ${estudiante.creditosTotales} créditos del plan`
              : 'Plan de estudios por confirmar'
          }
          icon={<BookOpen />}
        />
        {estudiante.creditosTotales !== null && (
          <Stat
            label="Avance curricular"
            value={`${Math.round(avance)}%`}
            note="Créditos aprobados del plan"
            icon={<UserCheck />}
          />
        )}
      </MetricGroup>
      <Tabs
        etiqueta="Secciones del expediente académico"
        activo={pestana}
        onChange={setPestana}
        items={[
          { id: 'matricula', label: 'Matrícula' },
          { id: 'horario', label: 'Horario' },
          { id: 'datos', label: 'Mis datos' },
        ]}
      />

      <TabPanel id="matricula" activo={pestana}>
        <Card>
          <CardHead
            title={`Matrícula ${semestreActual}`}
            description={`${cursosMatriculados.length} cursos${cursosMatriculados.every((c) => c.creditos !== null) ? ` · ${creditosMatriculados} créditos` : ''}`}
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

      <TabPanel id="horario" activo={pestana}>
        <Card>
          <CardHead title="Horario de clases" />
          <CardBody>
            {horario.length === 0 ? (
              <EmptyState title="Sin horario registrado" />
            ) : (
              <div className="stack">
                {[1, 2, 3, 4, 5, 6, 7].map((dia) => {
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
                  {estudiante.ciclo ?? 'Sin informar'} · {estudiante.etapa}
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
        <summary>
          {estudiante.origen
            ? 'Padrón importado'
            : `DIAA · Actualizado ${formatFecha(FECHA_CORTE_ACADEMICA)}`}
        </summary>
        <p>
          {estudiante.origen
            ? `${estudiante.origen.archivo} · ${estudiante.origen.hoja}`
            : FUENTE_ACADEMICA}
        </p>
      </details>
    </div>
  );
}
