import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  CalendarClock,
  Users,
  Presentation,
  GraduationCap,
  CalendarCheck,
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
import type { Docente } from '../../types/domain';
import {
  abreviaturaEscuela,
  comisionTutoria,
  escuelaDe,
  iniciales,
  nombreCompleto,
} from '../../data/personas';
import { escuelas, semestreActual } from '../../data/catalogos';
import { asignaciones, bloquesDeTutor, nombreTutor, sesionesDeTutor } from '../../data/tutoria';
import { horariosDocentes, nombreCurso } from '../../data/academico';
import { DIAS_SEMANA, formatFecha, formatHora } from '../../utils/fechas';

/** Fila del padrón docente con los indicadores calculados del semestre. */
interface FilaTutor {
  docente: Docente;
  tutorados: number;
  sesionesRealizadas: number;
  sesionesProgramadas: number;
  ocupacion: number;
  bloques: number;
}

/** Calcula los indicadores del docente tutor para el semestre en curso. */
function filaDeTutor(docente: Docente): FilaTutor {
  const activas = asignaciones.filter(
    (asignacion) => asignacion.tutorId === docente.id && asignacion.estado === 'activa',
  );
  const sesiones = sesionesDeTutor(docente.id).filter(
    (sesion) => sesion.semestreId === semestreActual,
  );
  return {
    docente,
    tutorados: activas.length,
    sesionesRealizadas: sesiones.filter((sesion) => sesion.estado === 'realizada').length,
    sesionesProgramadas: sesiones.filter((sesion) => sesion.estado === 'programada').length,
    ocupacion: docente.aforoMaximo ? Math.round((activas.length / docente.aforoMaximo) * 100) : 0,
    bloques: bloquesDeTutor(docente.id).length,
  };
}

/** Día de la semana en texto a partir del número de bloque. */
function diaLargo(dia: number): string {
  return DIAS_SEMANA[(dia - 1) % 7] ?? `Día ${dia}`;
}

/**
 * Padrón de docentes tutores de la facultad: datos de Recursos Humanos y
 * asignaciones de la comisión, con aforo, tutorados asignados, sesiones del
 * semestre y el detalle de tutorados y horario de atención de cada docente.
 */
export function CoordTutors() {
  const portal = usePortal();
  const { estudiantes, docentes } = usePersonasPortal();
  const [detalle, setDetalle] = useState<Docente | null>(null);

  const filas = useMemo<FilaTutor[]>(
    () =>
      docentes
        .map((docente) => filaDeTutor(docente))
        .sort((a, b) => a.docente.apellidos.localeCompare(b.docente.apellidos, 'es')),
    [docentes],
  );

  const buscarEn = useCallback(
    (fila: FilaTutor) =>
      [
        fila.docente.codigo,
        fila.docente.apellidos,
        fila.docente.nombres,
        fila.docente.correo,
        fila.docente.departamento,
        abreviaturaEscuela(fila.docente.escuelaId),
      ].join(' '),
    [],
  );

  const selects = useMemo<Array<DefinicionSelect<FilaTutor>>>(
    () => [
      {
        id: 'escuela',
        etiqueta: 'Escuela',
        opciones: escuelas.map((escuela) => ({ valor: escuela.id, etiqueta: escuela.abreviatura })),
        valorDe: (fila) => fila.docente.escuelaId,
      },
      {
        id: 'estado',
        etiqueta: 'Estado',
        opciones: [
          { valor: 'activo', etiqueta: 'Activo' },
          { valor: 'inactivo', etiqueta: 'Inactivo' },
        ],
        valorDe: (fila) => (fila.docente.activo ? 'activo' : 'inactivo'),
      },
      {
        id: 'disponibilidad',
        etiqueta: 'Disponibilidad',
        opciones: [
          { valor: 'con-cupos', etiqueta: 'Con cupos disponibles' },
          { valor: 'sin-cupos', etiqueta: 'Sin cupos disponibles' },
        ],
        valorDe: (fila) =>
          fila.docente.activo && (fila.docente.aforoMaximo ?? 0) > fila.tutorados
            ? 'con-cupos'
            : 'sin-cupos',
      },
      {
        id: 'dedicacion',
        etiqueta: 'Dedicación',
        opciones: [
          { valor: 'Tiempo completo', etiqueta: 'Tiempo completo' },
          { valor: 'Dedicación exclusiva', etiqueta: 'Dedicación exclusiva' },
          { valor: 'Tiempo parcial', etiqueta: 'Tiempo parcial' },
        ],
        valorDe: (fila) => fila.docente.dedicacion ?? '',
      },
    ],
    [],
  );

  const filtro = useFiltro(filas, buscarEn, selects);

  const activos = filas.filter((fila) => fila.docente.activo);
  const sinTutorados = filas.filter((fila) => fila.docente.activo && fila.tutorados === 0);
  const aforoTotal = activos.reduce((total, fila) => total + (fila.docente.aforoMaximo ?? 0), 0);
  const aforoUsado = filas.reduce((total, fila) => total + fila.tutorados, 0);
  const ocupacionGlobal = aforoTotal ? Math.round((aforoUsado / aforoTotal) * 100) : 0;
  const sinHorario = activos.filter((fila) => fila.bloques === 0);

  const detalleFila = detalle ? filaDeTutor(detalle) : null;
  const tutoradosDelDetalle = detalle
    ? asignaciones.filter(
        (asignacion) => asignacion.tutorId === detalle.id && asignacion.estado === 'activa',
      )
    : [];
  const bloquesDelDetalle = detalle ? bloquesDeTutor(detalle.id) : [];
  const clasesDelDetalle = detalle
    ? horariosDocentes.filter((bloque) => bloque.tutorId === detalle.id)
    : [];

  const columnas: Column<FilaTutor>[] = [
    {
      key: 'docente',
      header: 'Docente tutor',
      sortable: true,
      sortValue: (fila) => `${fila.docente.apellidos} ${fila.docente.nombres}`,
      render: (fila) => (
        <PersonCell
          nombres={fila.docente.nombres}
          apellidos={fila.docente.apellidos}
          detalle={`${fila.docente.codigo} · ${abreviaturaEscuela(fila.docente.escuelaId)}`}
          iniciales={iniciales(fila.docente)}
        />
      ),
    },
    {
      key: 'dedicacion',
      header: 'Dedicación',
      sortable: true,
      sortValue: (fila) => fila.docente.categoria,
      render: (fila) => (
        <span className="stack" style={{ gap: 1 }}>
          <span>{fila.docente.categoria ?? 'Sin informar'}</span>
          <span className="cell-note">{fila.docente.dedicacion ?? 'Sin informar'}</span>
        </span>
      ),
    },
    {
      key: 'aforo',
      header: 'Cupos',
      sortable: true,
      sortValue: (fila) => fila.docente.aforoMaximo,
      render: (fila) => (
        <span className="directory-capacity">
          <span>
            {fila.tutorados} / {fila.docente.aforoMaximo ?? 'Por confirmar'}
          </span>
          <meter
            min={0}
            max={Math.max(1, fila.docente.aforoMaximo ?? 0)}
            value={fila.tutorados}
            aria-label={`Cupos ocupados de ${nombreCompleto(fila.docente)}`}
          />
        </span>
      ),
    },
    {
      key: 'horario',
      header: 'Horario',
      sortable: true,
      sortValue: (fila) => fila.bloques,
      render: (fila) =>
        fila.bloques ? (
          <Badge tone="ok">{fila.bloques} bloque(s)</Badge>
        ) : (
          <Badge tone="alerta">Sin horario</Badge>
        ),
    },
    {
      key: 'estado',
      header: 'Estado',
      sortable: true,
      sortValue: (fila) => (fila.docente.activo ? 1 : 0),
      render: (fila) => (
        <StatusBadge
          estado={fila.docente.activo ? 'activo' : 'suspendido'}
          etiqueta={fila.docente.activo ? 'Activo' : 'Inactivo'}
        />
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
            aria-label={`Ver detalle del docente ${nombreCompleto(fila.docente)}`}
            onClick={() => setDetalle(fila.docente)}
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
        title="Tutores"
        description="Equipo docente, disponibilidad y atención tutorial."
        actions={
          <>
            <AccionesCuentas rol="tutor" />
            <Link className="btn btn-falcon-default" to="/coordinacion/padron?hoja=docentes">
              <i className="fa-solid fa-file-csv" aria-hidden="true" /> Padrón docente
            </Link>
          </>
        }
      />

      <DirectorySummary
        label="Ocupación de cupos"
        icon={<Users aria-hidden="true" />}
        value={`${aforoUsado} / ${aforoTotal}`}
        percent={ocupacionGlobal}
        note="cupos ocupados"
        metrics={[
          {
            label: 'Tutores habilitados',
            value: activos.length,
            note: `${docentes.length} docentes en el padrón`,
            icon: <Presentation aria-hidden="true" />,
          },
          {
            label: 'Cupos disponibles',
            value: activos.reduce(
              (total, fila) =>
                total + Math.max(0, (fila.docente.aforoMaximo ?? 0) - fila.tutorados),
              0,
            ),
            note: `${sinTutorados.length} tutores sin estudiantes`,
            icon: <GraduationCap aria-hidden="true" />,
          },
          {
            label: 'Horario publicado',
            value: `${activos.length - sinHorario.length} / ${activos.length}`,
            note: sinHorario.length
              ? `${sinHorario.length} pendientes de publicar`
              : 'Todo el equipo con horario',
            icon: <CalendarCheck aria-hidden="true" />,
          },
        ]}
      />

      <Card>
        <CardHead
          title="Directorio de tutores"
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
              etiqueta="Filtros del registro docente"
              placeholder="Buscar por nombre, código o correo…"
              views={
                <DirectoryViews
                  views={[
                    {
                      label: 'Todos',
                      count: filas.length,
                      active: !filtro.valores.estado && !filtro.valores.disponibilidad,
                      onClick: () =>
                        filtro.setValores((v) => ({ ...v, estado: '', disponibilidad: '' })),
                    },
                    {
                      label: 'Habilitados',
                      count: activos.length,
                      active: filtro.valores.estado === 'activo' && !filtro.valores.disponibilidad,
                      onClick: () =>
                        filtro.setValores((v) => ({ ...v, estado: 'activo', disponibilidad: '' })),
                    },
                    {
                      label: 'Con cupos',
                      count: activos.filter(
                        (fila) => (fila.docente.aforoMaximo ?? 0) > fila.tutorados,
                      ).length,
                      active: filtro.valores.disponibilidad === 'con-cupos',
                      onClick: () =>
                        filtro.setValores((v) => ({
                          ...v,
                          estado: '',
                          disponibilidad: 'con-cupos',
                        })),
                    },
                  ]}
                />
              }
            />
            <DataTable<FilaTutor>
              rows={filtro.filtrados}
              columns={columnas}
              caption={`Registro de docentes tutores · semestre ${semestreActual}`}
              rowKey={(fila) => fila.docente.id}
              pageSize={10}
              pagination="auto"
              paginationPosition="bottom"
              inlineActions
              initialSort={{ key: 'docente', direction: 'asc' }}
              emptyTitle="Sin docentes con estos filtros"
              emptyDescription="Revisa la escuela, la dedicación o el estado seleccionado."
            />
          </div>
        </CardBody>
        <CardFoot>
          <span>Fuente: Recursos Humanos · INS-04 y designaciones de la comisión.</span>
        </CardFoot>
      </Card>

      <DirectoryDisclosure title="Comisión, horarios y criterios de cupos">
        <Alert tone="info" title="Cupos por confirmar">
          El acta del 7 de octubre de 2026 propone entre 10 y 14 estudiantes por docente según la
          escuela. El sistema muestra los cupos registrados y alerta cuando se supera, pero no
          impide la asignación: la regla cupos-tutor permanece con estado «propuesta».
        </Alert>

        <div className="grid grid--sidebar">
          <Card>
            <CardHead
              title="Comisión de tutoría y responsables"
              description="Designaciones vigentes para el periodo 2026"
            />
            <CardBody flush>
              <ul className="list">
                {comisionTutoria.map((miembro) => (
                  <li className="list__item" key={miembro.id}>
                    <span className="list__icon list__icon--gold" aria-hidden="true">
                      <Users />
                    </span>
                    <span className="list__body">
                      <strong>{miembro.nombres}</strong>
                      <p>
                        {miembro.cargoTutorial} · {miembro.ambito}
                      </p>
                      <span className="list__meta">
                        <span>{miembro.correo}</span>
                        <span>
                          Vigencia {formatFecha(miembro.vigenciaInicio)} →{' '}
                          {formatFecha(miembro.vigenciaFin)}
                        </span>
                      </span>
                    </span>
                    <span className="list__aside">
                      <Badge tone="dorado">{miembro.actaDesignacion}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card accent>
            <CardHead
              title="Estado del horario de atención"
              description="Bloques publicados por los tutores"
            />
            <CardBody>
              <div className="stack">
                {activos.slice(0, 8).map((fila) => (
                  <div className="ui-row ui-row--between ui-row--wrap" key={fila.docente.id}>
                    <span className="small">
                      <strong>{nombreCompleto(fila.docente)}</strong>
                      <span className="muted"> · {abreviaturaEscuela(fila.docente.escuelaId)}</span>
                    </span>
                    {fila.bloques ? (
                      <Badge tone="ok">{fila.bloques} bloque(s)</Badge>
                    ) : (
                      <Badge tone="alerta">Sin publicar</Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardBody>
            <CardFoot>
              <span>Los bloques se administran desde «Horarios de tutoría».</span>
            </CardFoot>
          </Card>
        </div>
      </DirectoryDisclosure>

      {detalle && detalleFila && (
        <Sheet
          wide
          title={`${detalle.apellidos}, ${detalle.nombres}`}
          description={`${detalle.codigo} · ${detalle.categoria} · ${detalle.dedicacion}`}
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
                label="Estudiantes asignados"
                icon={<Users />}
                value={detalleFila.tutorados}
                note={`Límite de estudiantes ${detalle.aforoMaximo}`}
              />
              <Stat
                label="Sesiones realizadas"
                icon={<CalendarCheck />}
                value={detalleFila.sesionesRealizadas}
                note={`${detalleFila.sesionesProgramadas} programadas`}
                tone="info"
              />
              <Stat
                label="Bloques de atención"
                icon={<CalendarClock />}
                value={detalleFila.bloques}
                note={`${clasesDelDetalle.length} bloques de clase registrados`}
                tone="violeta"
              />
            </div>

            <Progress
              valor={detalleFila.ocupacion}
              etiqueta={`Ocupación del cupos · ${detalleFila.tutorados} de ${detalle.aforoMaximo} estudiantes`}
              variante={
                detalleFila.ocupacion >= 100
                  ? 'riesgo'
                  : detalleFila.ocupacion >= 80
                    ? 'alerta'
                    : 'verde'
              }
            />

            <dl className="def-list">
              <div>
                <dt>Escuela profesional</dt>
                <dd>{escuelaDe(detalle.escuelaId)}</dd>
              </div>
              <div>
                <dt>Departamento académico</dt>
                <dd>{detalle.departamento}</dd>
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
                <dt>Estado en el registro</dt>
                <dd>
                  {detalle.activo ? 'Activo (vínculo vigente)' : 'Inactivo (vínculo concluido)'}
                </dd>
              </div>
              <div>
                <dt>Vigencia laboral</dt>
                <dd>
                  {detalle.activo
                    ? 'Confirmada por Recursos Humanos para el semestre en curso'
                    : 'Reportada como concluida en la solicitud INS-04'}
                </dd>
              </div>
            </dl>

            <div>
              <div className="section-head">
                <h2>Estudiantes asignados</h2>
                <p>{tutoradosDelDetalle.length} asignaciones activas</p>
              </div>
              {tutoradosDelDetalle.length === 0 ? (
                <EmptyState
                  title="Sin estudiantes asignados"
                  description="La comisión de tutoría aún no registra asignaciones para este docente."
                  icon={<Users />}
                />
              ) : (
                <ul className="list">
                  {tutoradosDelDetalle.map((asignacion) => {
                    const estudiante = estudiantes.find(
                      (item) => item.id === asignacion.estudianteId,
                    );
                    if (!estudiante) return null;
                    return (
                      <li className="list__item" key={asignacion.id}>
                        <span className="avatar" aria-hidden="true">
                          {iniciales(estudiante)}
                        </span>
                        <span className="list__body">
                          <strong>
                            {estudiante.apellidos}, {estudiante.nombres}
                          </strong>
                          <p>
                            {estudiante.codigo} · ciclo {estudiante.ciclo} · {estudiante.etapa} ·
                            promedio {estudiante.promedioPonderado?.toFixed(1) ?? 'Sin informar'}
                          </p>
                          <span className="list__meta">
                            <span>Grupo {asignacion.grupo ?? 'sin grupo'}</span>
                            <span>{asignacion.criterio}</span>
                            {estudiante.alertas.length > 0 && (
                              <Badge tone="alerta">{estudiante.alertas.length} alerta(s)</Badge>
                            )}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div>
              <div className="section-head">
                <h2>Horario de atención tutorial</h2>
                <p>{bloquesDelDetalle.length} bloques publicados</p>
              </div>
              {bloquesDelDetalle.length === 0 ? (
                <EmptyState
                  title="Sin horario publicado"
                  description="El docente aún no registra bloques de atención para el semestre."
                  icon={<CalendarClock />}
                />
              ) : (
                <ul className="list">
                  {bloquesDelDetalle.map((bloque) => (
                    <li className="list__item" key={bloque.id}>
                      <span className="list__icon list__icon--info" aria-hidden="true">
                        <CalendarClock />
                      </span>
                      <span className="list__body">
                        <strong>
                          {diaLargo(bloque.dia)} · {formatHora(bloque.horaInicio)} a{' '}
                          {formatHora(bloque.horaFin)}
                        </strong>
                        <p>
                          {bloque.lugar} · modalidad {bloque.modalidad}
                        </p>
                        <span className="list__meta">
                          <span>{bloque.semana}</span>
                          <span>
                            Vigencia {formatFecha(bloque.vigenciaInicio)} →{' '}
                            {formatFecha(bloque.vigenciaFin)}
                          </span>
                        </span>
                      </span>
                      <span className="list__aside">
                        <Badge tone="info">{bloque.cupos} cupos</Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <div className="section-head">
                <h2>Carga académica y cruces</h2>
                <p>Bloques de clase informados por la DIAA</p>
              </div>
              {clasesDelDetalle.length === 0 ? (
                <EmptyState
                  title="Sin bloques de clase registrados"
                  description="La consulta a la DIAA no devolvió carga académica para este docente."
                  icon={<BookOpen />}
                />
              ) : (
                <ul className="list">
                  {clasesDelDetalle.map((bloque) => (
                    <li className="list__item" key={bloque.id}>
                      <span className="list__icon" aria-hidden="true">
                        <BookOpen />
                      </span>
                      <span className="list__body">
                        <strong>{bloque.titulo}</strong>
                        <p>
                          {diaLargo(bloque.dia)} · {bloque.horaInicio}–{bloque.horaFin} ·{' '}
                          {bloque.lugar}
                        </p>
                        <span className="list__meta">
                          <span>
                            {bloque.tipo === 'academico' ? 'Clase' : 'Actividad institucional'}
                          </span>
                          {bloque.cursoId && <span>{nombreCurso(bloque.cursoId)}</span>}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="small muted" style={{ marginTop: 10 }}>
                La programación y el seguimiento de las sesiones se consultan en «Sesiones». Ficha
                de {nombreTutor(detalle.id)}.
              </p>
            </div>
          </div>
        </Sheet>
      )}
    </DirectoryPage>
  );
}
