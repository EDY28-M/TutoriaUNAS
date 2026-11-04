import { promedioDe } from '../../utils/datosAcademicos';
import { etiquetaEtapa } from '../../utils/datosAcademicos';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, GraduationCap, Users, CircleAlert } from '../../components/ui/icons';
import { MetricGroup } from '../../components/ui/MetricGroup';
import { Stat } from '../../components/ui/Stat';
import { PageHeading } from '../../components/ui/PageHeading';
import { Card, CardBody, CardFoot, CardHead } from '../../components/ui/Card';
import { Badge, StatusBadge } from '../../components/ui/StatusBadge';
import { DataTable } from '../../components/ui/DataTable';
import type { Column } from '../../components/ui/DataTable';
import { PersonCell } from '../../components/ui/PersonCell';
import { PanelFiltros, useFiltro } from '../../components/panels/PanelFiltros';
import type { DefinicionSelect } from '../../components/panels/PanelFiltros';
import { usePortal } from '../../hooks/usePortal';
import { semestreActual } from '../../data/catalogos';
import {
  abreviaturaEscuela,
  estudiantePorId,
  iniciales,
  nombreCompleto,
} from '../../data/personas';
import { resumenDe } from '../../data/academico';
import type { Asignacion, Estudiante, Instrumento, NivelAlerta, Sesion } from '../../types/domain';
import { formatFecha } from '../../utils/fechas';
import '../../assets/vendor/fontawesome.min.css';
import '../../styles/tutor-tutees.css';

/**
 * Listado de tutorados del docente: datos de contacto y académicos, alertas,
 * asistencia a tutoría e instrumentos pendientes, con acceso a cada expediente.
 * La búsqueda y los filtros se apoyan en `PanelFiltros` y `useFiltro`.
 */

interface FilaTutorado {
  asignacion: Asignacion;
  estudiante: Estudiante;
  /** Sesiones realizadas a las que asistió (o llegó tarde). */
  sesionesAsistidas: number;
  /** Sesiones realizadas registradas para el tutorado. */
  sesionesRealizadas: number;
  sesionesProgramadas: number;
  instrumentosPendientes: number;
  alertaMaxima: NivelAlerta | null;
}

const ORDEN_ALERTA: Record<NivelAlerta, number> = { alta: 0, media: 1, baja: 2 };

type VistaRapida = 'todos' | 'alertas' | 'sin-atencion' | 'pendientes';

const VISTAS_RAPIDAS: {
  id: VistaRapida;
  etiqueta: string;
  coincide(fila: FilaTutorado): boolean;
}[] = [
  { id: 'todos', etiqueta: 'Todos', coincide: () => true },
  { id: 'alertas', etiqueta: 'Con alertas', coincide: (fila) => fila.alertaMaxima !== null },
  { id: 'sin-atencion', etiqueta: 'Sin asistencia', coincide: (fila) => !fila.sesionesAsistidas },
  {
    id: 'pendientes',
    etiqueta: 'Formularios pendientes',
    coincide: (fila) => fila.instrumentosPendientes > 0,
  },
];

const ETIQUETA_ESTADO: Record<string, string> = {
  regular: 'Regular',
  observado: 'Observado',
  reserva: 'Reserva',
  retirado: 'Retirado',
  egresado: 'Egresado',
  ingresante: 'Ingresante',
};

function asistioA(sesion: Sesion, estudianteId: string): boolean {
  return sesion.asistentes.some(
    (asistente) =>
      asistente.estudianteId === estudianteId &&
      (asistente.estado === 'asistio' || asistente.estado === 'tarde'),
  );
}

/** Cruza asignaciones, sesiones e instrumentos en una fila por tutorado. */
function construirFilas(
  asignaciones: Asignacion[],
  sesiones: Sesion[],
  instrumentos: Instrumento[],
): FilaTutorado[] {
  return asignaciones.flatMap((asignacion) => {
    const estudiante = estudiantePorId(asignacion.estudianteId);
    if (!estudiante) return [];
    const propias = sesiones.filter((sesion) =>
      sesion.asistentes.some((asistente) => asistente.estudianteId === estudiante.id),
    );
    const realizadas = propias.filter((sesion) => sesion.estado === 'realizada');
    const alertaMaxima =
      estudiante.alertas.slice().sort((a, b) => ORDEN_ALERTA[a.nivel] - ORDEN_ALERTA[b.nivel])[0]
        ?.nivel ?? null;
    return [
      {
        asignacion,
        estudiante,
        sesionesAsistidas: realizadas.filter((sesion) => asistioA(sesion, estudiante.id)).length,
        sesionesRealizadas: realizadas.length,
        sesionesProgramadas: propias.filter((sesion) => sesion.estado === 'programada').length,
        instrumentosPendientes: instrumentos.filter(
          (instrumento) =>
            instrumento.estudianteId === estudiante.id &&
            ['no-iniciado', 'borrador', 'observado'].includes(instrumento.estado),
        ).length,
        alertaMaxima,
      },
    ];
  });
}

export function TutorTutees() {
  const portal = usePortal();
  const { docente, tutorados, sesiones, instrumentos } = portal;
  const [vista, setVista] = useState<VistaRapida>('todos');
  const [tablaCompleta, setTablaCompleta] = useState(false);

  const filas = construirFilas(tutorados, sesiones, instrumentos);

  const ciclos = [...new Set(filas.map((fila) => fila.estudiante.ciclo))].sort(
    (a, b) => (a ?? Infinity) - (b ?? Infinity),
  );
  const estados = [...new Set(filas.map((fila) => fila.estudiante.estado))].sort();

  const selects: DefinicionSelect<FilaTutorado>[] = [
    {
      id: 'ciclo',
      etiqueta: 'Ciclo',
      opciones: ciclos.map((ciclo) => ({
        valor: String(ciclo),
        etiqueta: ciclo === null ? 'Sin ciclo informado' : `Ciclo ${ciclo}`,
      })),
      valorDe: (fila) => String(fila.estudiante.ciclo),
    },
    {
      id: 'estado',
      etiqueta: 'Estado académico',
      opciones: estados.map((estado) => ({
        valor: estado,
        etiqueta: ETIQUETA_ESTADO[estado] ?? estado,
      })),
      valorDe: (fila) => fila.estudiante.estado,
    },
    {
      id: 'alerta',
      etiqueta: 'Alerta',
      opciones: [
        { valor: 'alta', etiqueta: 'Prioridad alta' },
        { valor: 'media', etiqueta: 'Prioridad media' },
        { valor: 'baja', etiqueta: 'Prioridad baja' },
        { valor: 'sin', etiqueta: 'Sin alertas' },
      ],
      valorDe: (fila) => fila.alertaMaxima ?? 'sin',
    },
  ];

  const filtro = useFiltro(
    filas,
    (fila) =>
      `${fila.estudiante.nombres} ${fila.estudiante.apellidos} ${fila.estudiante.codigo} ${fila.asignacion.grupo ?? ''}`,
    selects,
  );
  const vistaActual = VISTAS_RAPIDAS.find((item) => item.id === vista)!;
  const visibles = filtro.filtrados.filter(vistaActual.coincide);

  function limpiarFiltros() {
    filtro.limpiar();
    setVista('todos');
  }

  const columnas: Column<FilaTutorado>[] = [
    {
      key: 'estudiante',
      header: 'Estudiante',
      sortable: true,
      sortValue: (fila) => fila.estudiante.apellidos,
      render: (fila) => (
        <div className="tutee-person">
          <PersonCell
            nombres={fila.estudiante.nombres}
            apellidos={fila.estudiante.apellidos}
            iniciales={iniciales(fila.estudiante)}
            detalle={ETIQUETA_ESTADO[fila.estudiante.estado] ?? fila.estudiante.estado}
          />
          <details className="tutee-cell-detail">
            <summary>Contacto</summary>
            <a href={`mailto:${fila.estudiante.correo}`}>{fila.estudiante.correo}</a>
            <a href={`tel:${fila.estudiante.telefono.replace(/\s/g, '')}`}>
              {fila.estudiante.telefono}
            </a>
          </details>
        </div>
      ),
    },
    {
      key: 'codigo',
      header: 'Código',
      sortable: true,
      sortValue: (fila) => fila.estudiante.codigo,
      render: (fila) => <span className="cell-mono">{fila.estudiante.codigo}</span>,
    },
    {
      key: 'ciclo',
      header: 'Ciclo',
      sortable: true,
      sortValue: (fila) => fila.estudiante.ciclo,
      render: (fila) => (
        <>
          <span className="cell-strong">Ciclo {fila.estudiante.ciclo ?? 'Sin informar'}</span>
          <span className="cell-note">
            {etiquetaEtapa(fila.estudiante.etapa) ?? 'Etapa por definir'}
          </span>
        </>
      ),
    },
    {
      key: 'grupo',
      header: 'Grupo',
      sortable: true,
      sortValue: (fila) => fila.asignacion.grupo ?? 'Sin grupo',
      render: (fila) => (
        <>
          <span className="mono">{fila.asignacion.grupo ?? '—'}</span>
          <details className="tutee-cell-detail">
            <summary>Asignación</summary>
            <span>Desde el {formatFecha(fila.asignacion.fechaInicio)}</span>
            <span>{fila.asignacion.criterio}</span>
          </details>
        </>
      ),
    },
    {
      key: 'promedio',
      header: 'Promedio',
      sortable: true,
      sortValue: (fila) => fila.estudiante.promedioPonderado,
      render: (fila) => (
        <>
          <span
            className={
              (fila.estudiante.promedioPonderado ?? Infinity) < 11
                ? 'cell-strong text-danger'
                : (fila.estudiante.promedioPonderado ?? Infinity) < 13
                  ? 'cell-strong text-warn'
                  : 'cell-strong'
            }
          >
            {fila.estudiante.promedioPonderado?.toFixed(1) ?? 'Sin informar'}
          </span>
          <span className="cell-note">
            {resumenDe(fila.estudiante.id)?.avanceCurricular == null
              ? 'Avance no informado'
              : `${resumenDe(fila.estudiante.id)?.avanceCurricular}% de avance`}
          </span>
        </>
      ),
    },
    {
      key: 'alertas',
      header: 'Alertas',
      sortable: true,
      sortValue: (fila) => ORDEN_ALERTA[fila.alertaMaxima ?? 'baja'] + (fila.alertaMaxima ? 0 : 10),
      render: (fila) =>
        fila.alertaMaxima ? (
          <span className="tutee-alert">
            <StatusBadge estado={fila.alertaMaxima} />
            <span className="cell-note">{fila.estudiante.alertas.length} activa(s)</span>
          </span>
        ) : (
          <Badge tone="ok">Sin alertas</Badge>
        ),
    },
    {
      key: 'sesiones',
      header: 'Asistencia',
      sortable: true,
      sortValue: (fila) => fila.sesionesAsistidas,
      render: (fila) => (
        <>
          <span
            className="cell-strong"
            aria-label={`${fila.sesionesAsistidas} asistencias de ${fila.sesionesRealizadas} sesiones realizadas`}
          >
            {fila.sesionesAsistidas}/{fila.sesionesRealizadas}
          </span>
          <span className="cell-note">{fila.sesionesProgramadas} programada(s)</span>
        </>
      ),
    },
    {
      key: 'instrumentos',
      header: 'Formularios',
      sortable: true,
      sortValue: (fila) => fila.instrumentosPendientes,
      render: (fila) => (
        <Badge tone={fila.instrumentosPendientes > 0 ? 'alerta' : 'ok'}>
          {fila.instrumentosPendientes} pendiente(s)
        </Badge>
      ),
    },
    {
      key: 'ficha',
      header: 'Ficha',
      render: (fila) => (
        <Link
          className="tutee-open"
          to={`/tutor/tutorados/${fila.estudiante.id}`}
          aria-label={`Ver expediente de ${nombreCompleto(fila.estudiante)}`}
        >
          Ver ficha <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
        </Link>
      ),
    },
  ];

  const columnasResumen: Column<FilaTutorado>[] = [
    {
      ...columnas[0]!,
      render: (fila) => (
        <PersonCell
          nombres={fila.estudiante.nombres}
          apellidos={fila.estudiante.apellidos}
          iniciales={iniciales(fila.estudiante)}
          detalle={`${fila.estudiante.codigo} · ${ETIQUETA_ESTADO[fila.estudiante.estado] ?? fila.estudiante.estado}`}
        />
      ),
    },
    {
      ...columnas[4]!,
      header: 'Rendimiento',
      render: (fila) => (
        <>
          <span
            className={`cell-strong${(fila.estudiante.promedioPonderado ?? Infinity) < 11 ? ' text-danger' : (fila.estudiante.promedioPonderado ?? Infinity) < 13 ? ' text-warn' : ''}`}
          >
            {fila.estudiante.promedioPonderado?.toFixed(1) ?? 'Sin informar'}{' '}
            <small className="tutee-grade-label">promedio</small>
          </span>
          <span className="cell-note">
            Ciclo {fila.estudiante.ciclo ?? 'Sin informar'} · {fila.asignacion.grupo ?? 'Sin grupo'}
          </span>
        </>
      ),
    },
    ...columnas.slice(5),
  ];

  if (!docente) {
    return (
      <PageHeading
        eyebrow="Acompañamiento tutorial"
        title="Mis estudiantes"
        description="La cuenta de demostración no tiene una ficha de docente tutor asociada."
      />
    );
  }

  const promedioGrupo = promedioDe(filas.map((fila) => fila.estudiante));
  const conAlertas = filas.filter((fila) => fila.alertaMaxima !== null).length;
  const pendientesTotales = filas.reduce((total, fila) => total + fila.instrumentosPendientes, 0);
  const grupos = [...new Set(filas.map((fila) => fila.asignacion.grupo ?? 'Sin grupo'))].sort();

  return (
    <div className="tutor-tutees">
      <PageHeading
        eyebrow={`Docente tutor · ${abreviaturaEscuela(docente.escuelaId)} · Semestre ${semestreActual}`}
        title="Mis estudiantes"
        description={`${semestreActual} · ${abreviaturaEscuela(docente.escuelaId)} · Seguimiento de tus tutorados`}
        actions={
          <>
            <Link className="btn btn-falcon-default" to="/tutor/sesiones">
              <GraduationCap aria-hidden="true" /> Sesiones de tutoría
            </Link>
            <Link className="btn btn-falcon-default" to="/tutor/reportes">
              <ClipboardList aria-hidden="true" /> Ver reportes
            </Link>
          </>
        }
      />

      <MetricGroup label="Resumen de estudiantes">
        <Stat
          label="Estudiantes"
          value={filas.length}
          note={`${grupos.length} grupos · cupo ${docente.aforoMaximo ?? 'por confirmar'}`}
          icon={<Users />}
        />
        <Stat
          label="Con alertas"
          value={conAlertas}
          note="Requieren acompañamiento"
          icon={<CircleAlert />}
        />
        <Stat
          label="Promedio del grupo"
          value={promedioGrupo?.toFixed(1) ?? '—'}
          note="Escala 0–20 · mínimo aprobatorio: 11"
          icon={<GraduationCap />}
        />
        <Stat
          label="Formularios pendientes"
          value={pendientesTotales}
          note="Formatos 03, 04, 05, 10 y 11"
          icon={<ClipboardList />}
        />
      </MetricGroup>

      <Card className={`tutor-tutees-list${tablaCompleta ? '' : ' tutor-tutees-list--summary'}`}>
        <CardHead
          title="Lista de estudiantes"
          actions={
            <div className="tutees-view" role="group" aria-label="Vista de la lista">
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
        <div className="tutees-quick" role="group" aria-label="Vistas rápidas de estudiantes">
          {VISTAS_RAPIDAS.map((item) => (
            <button
              type="button"
              key={item.id}
              aria-pressed={vista === item.id}
              onClick={() => setVista(item.id)}
            >
              {item.etiqueta}
              <span>{filtro.filtrados.filter(item.coincide).length}</span>
            </button>
          ))}
        </div>
        <CardBody>
          <div className="stack tutor-tutees-list__content">
            <PanelFiltros<FilaTutorado>
              busqueda={filtro.busqueda}
              onBusqueda={filtro.setBusqueda}
              selects={selects}
              valores={filtro.valores}
              onValor={(id, valor) => filtro.setValores((actual) => ({ ...actual, [id]: valor }))}
              mostrados={visibles.length}
              total={filas.length}
              activos={filtro.activos || vista !== 'todos'}
              onLimpiar={limpiarFiltros}
              etiqueta="Filtros de estudiantes"
              placeholder="Nombre, apellidos o código…"
            />
            <span className="sr-only" role="status">
              {visibles.length} estudiantes en la vista {vistaActual.etiqueta}
            </span>
            <DataTable<FilaTutorado>
              key={tablaCompleta ? 'completa' : 'resumen'}
              rows={visibles}
              columns={tablaCompleta ? columnas : columnasResumen}
              caption="Relación de estudiantes asignados al docente tutor"
              rowKey={(fila) => fila.asignacion.id}
              emptyTitle="Sin estudiantes que coincidan"
              emptyDescription="Ajusta la búsqueda o limpia los filtros para ver la lista completa."
              initialSort={{ key: 'alertas', direction: 'asc' }}
              pagination="auto"
            />
          </div>
        </CardBody>
        <CardFoot>
          <span>
            <i className="fa-solid fa-arrow-down-short-wide" aria-hidden="true" /> Orden inicial:
            prioridad de alertas · {filas.length} de {docente.aforoMaximo} cupos
          </span>
          <Link className="btn btn-link btn-sm" to="/tutor/sesiones">
            Registrar asistencia <i className="fa-solid fa-arrow-right" aria-hidden="true" />
          </Link>
        </CardFoot>
      </Card>

      <details className="tutees-groups">
        <summary>
          <i className="fa-solid fa-layer-group" aria-hidden="true" />
          <span>Grupos y asignación</span>
          <Badge>{grupos.length}</Badge>
          <i className="fa-solid fa-chevron-down" aria-hidden="true" />
        </summary>
        <div className="tutees-groups__grid">
          {grupos.map((grupo) => {
            const delGrupo = filas.filter(
              (fila) => (fila.asignacion.grupo ?? 'Sin grupo') === grupo,
            );
            const conAlertaGrupo = delGrupo.filter((fila) => fila.alertaMaxima !== null).length;
            const promedio = promedioDe(delGrupo.map((fila) => fila.estudiante));
            return (
              <article className="tutees-group" key={grupo}>
                <header>
                  <strong>{grupo}</strong>
                  <button
                    type="button"
                    onClick={() => {
                      limpiarFiltros();
                      filtro.setBusqueda(grupo);
                    }}
                    aria-label={`Ver estudiantes del grupo ${grupo}`}
                  >
                    Ver grupo <i className="fa-solid fa-arrow-up" aria-hidden="true" />
                  </button>
                </header>
                <dl>
                  <div>
                    <dt>Estudiantes</dt>
                    <dd>{delGrupo.length}</dd>
                  </div>
                  <div>
                    <dt>Promedio</dt>
                    <dd>{promedio?.toFixed(1) ?? 'Sin informar'}</dd>
                  </div>
                  <div>
                    <dt>Con alertas</dt>
                    <dd>
                      {conAlertaGrupo}{' '}
                      <small>({Math.round((conAlertaGrupo / delGrupo.length) * 100)}%)</small>
                    </dd>
                  </div>
                </dl>
                <p>
                  {delGrupo
                    .slice(0, 4)
                    .map((fila) => fila.estudiante.apellidos.split(' ')[0])
                    .join(' · ')}
                </p>
              </article>
            );
          })}
        </div>
        <footer>
          <span>Asignación según el acta de la comisión de tutoría.</span>
          <Link to="/tutor/derivaciones">
            Ver solicitudes de apoyo <i className="fa-solid fa-arrow-right" aria-hidden="true" />
          </Link>
        </footer>
      </details>
    </div>
  );
}
