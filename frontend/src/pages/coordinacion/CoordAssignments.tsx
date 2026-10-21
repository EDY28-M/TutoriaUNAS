import type { FormEvent } from 'react';
import { useCallback, useId, useMemo, useState } from 'react';
import type { DefinicionSelect } from '../../components/panels/PanelFiltros';
import { PanelFiltros, useFiltro } from '../../components/panels/PanelFiltros';
import { Alert } from '../../components/ui/Alert';
import { Card, CardBody, CardFoot, CardHead } from '../../components/ui/Card';
import type { Column } from '../../components/ui/DataTable';
import { DataTable } from '../../components/ui/DataTable';
import {
  ArrowLeftRight,
  BadgeCheck,
  CircleAlert,
  Download,
  Network,
  Plus,
  Save,
  TriangleAlert,
  UserPlus,
  Users,
} from '../../components/ui/icons';
import { PageHeading } from '../../components/ui/PageHeading';
import { PersonCell } from '../../components/ui/PersonCell';
import { Progress } from '../../components/ui/Progress';
import { Sheet } from '../../components/ui/Sheet';
import { Stat } from '../../components/ui/Stat';
import { Badge, StatusBadge } from '../../components/ui/StatusBadge';
import { escuelas, semestreActual } from '../../data/catalogos';
import {
  abreviaturaEscuela,
  docentePorId,
  docentes,
  estudiantes,
  iniciales,
  nombreCompleto,
} from '../../data/personas';
import { asignaciones } from '../../data/tutoria';
import { usePortal } from '../../hooks/usePortal';
import type { Asignacion, CambioTutor, Estudiante } from '../../types/domain';
import { downloadCsv } from '../../utils/csv';
import { HOY_ISO, formatFecha } from '../../utils/fechas';

const CRITERIOS: Array<Asignacion['criterio']> = [
  'asignación directiva',
  'afinidad de curso',
  'elección del tutorado',
  'sorteo',
];

const ESTADOS_ASIGNACION: Array<Asignacion['estado']> = ['activa', 'finalizada', 'reemplazada'];

/** Texto legible de un criterio de asignación. */
function etiquetaCriterio(criterio: Asignacion['criterio']): string {
  if (criterio === 'asignación directiva') return 'Asignación directiva';
  if (criterio === 'afinidad de curso') return 'Afinidad de curso';
  if (criterio === 'elección del tutorado') return 'Elección del tutorado';
  return 'Sorteo';
}

/** Texto legible del estado de la asignación. */
function etiquetaEstado(estado: Asignacion['estado']): string {
  if (estado === 'activa') return 'Activa';
  if (estado === 'finalizada') return 'Finalizada';
  return 'Reemplazada';
}

/** Vigencia legible de una asignación tutorial. */
function vigenciaDe(asignacion: Asignacion): string {
  return `${formatFecha(asignacion.fechaInicio)} → ${formatFecha(asignacion.fechaFin)}`;
}

/** Registro en memoria de un cambio de tutor realizado en la demostración. */
interface CambioRegistrado extends CambioTutor {
  id: string;
  asignacionId: string;
  estudianteId: string;
}

/**
 * Asignaciones tutor–tutorado de la escuela: padrón vigente, filtros por
 * escuela, tutor, criterio y estado, alta de una nueva asignación con aviso de
 * aforo y registro del cambio de docente tutor con su motivo.
 */
export function CoordAssignments() {
  const portal = usePortal();
  const idFormulario = useId();

  const [registros, setRegistros] = useState<Asignacion[]>(() =>
    asignaciones.map((asignacion) => ({ ...asignacion, historial: [...asignacion.historial] })),
  );
  const [cambios, setCambios] = useState<CambioRegistrado[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [altaAbierta, setAltaAbierta] = useState(false);
  const [cambioAbierto, setCambioAbierto] = useState<Asignacion | null>(null);

  // —— Formulario de alta ——
  const [nuevoEstudiante, setNuevoEstudiante] = useState('');
  const [nuevoTutor, setNuevoTutor] = useState('');
  const [nuevoCriterio, setNuevoCriterio] =
    useState<Asignacion['criterio']>('asignación directiva');
  const [nuevoGrupo, setNuevoGrupo] = useState('');
  const [nuevaReferencia, setNuevaReferencia] = useState('');

  // —— Formulario de cambio de tutor ——
  const [tutorDestino, setTutorDestino] = useState('');
  const [motivoCambio, setMotivoCambio] = useState('');

  const buscarEn = useCallback((asignacion: Asignacion) => {
    const estudiante = estudiantes.find((item) => item.id === asignacion.estudianteId);
    const tutor = docentePorId(asignacion.tutorId);
    return [
      estudiante?.codigo ?? '',
      estudiante ? `${estudiante.apellidos} ${estudiante.nombres}` : '',
      tutor ? `${tutor.apellidos} ${tutor.nombres}` : '',
      asignacion.referenciaAprobacion,
      asignacion.grupo ?? '',
    ].join(' ');
  }, []);

  const selects = useMemo<Array<DefinicionSelect<Asignacion>>>(
    () => [
      {
        id: 'escuela',
        etiqueta: 'Escuela',
        opciones: escuelas.map((escuela) => ({ valor: escuela.id, etiqueta: escuela.abreviatura })),
        valorDe: (asignacion) => asignacion.escuelaId,
      },
      {
        id: 'tutor',
        etiqueta: 'Docente tutor',
        opciones: docentes.map((docente) => ({
          valor: docente.id,
          etiqueta: `${docente.apellidos}, ${docente.nombres}`,
        })),
        valorDe: (asignacion) => asignacion.tutorId,
      },
      {
        id: 'criterio',
        etiqueta: 'Criterio',
        opciones: CRITERIOS.map((criterio) => ({
          valor: criterio,
          etiqueta: etiquetaCriterio(criterio),
        })),
        valorDe: (asignacion) => asignacion.criterio,
      },
      {
        id: 'estado',
        etiqueta: 'Estado',
        opciones: ESTADOS_ASIGNACION.map((estado) => ({
          valor: estado,
          etiqueta: etiquetaEstado(estado),
        })),
        valorDe: (asignacion) => asignacion.estado,
      },
    ],
    [],
  );

  const filtro = useFiltro(registros, buscarEn, selects);

  const activas = registros.filter((asignacion) => asignacion.estado === 'activa');
  const tutoresConTutorados = new Set(activas.map((asignacion) => asignacion.tutorId)).size;
  const sinTutor = estudiantes.filter(
    (estudiante) => !activas.some((asignacion) => asignacion.estudianteId === estudiante.id),
  ).length;

  const estudiantesSinAsignar = useMemo(
    () =>
      [...estudiantes]
        .filter(
          (estudiante) => !activas.some((asignacion) => asignacion.estudianteId === estudiante.id),
        )
        .sort((a, b) => a.apellidos.localeCompare(b.apellidos, 'es')),
    [activas],
  );

  const tutoresDisponibles = useMemo(
    () =>
      [...docentes]
        .filter((docente) => docente.activo)
        .sort((a, b) => a.apellidos.localeCompare(b.apellidos, 'es')),
    [],
  );

  const docenteElegido = nuevoTutor ? docentePorId(nuevoTutor) : undefined;
  const cargaElegida = nuevoTutor
    ? activas.filter((asignacion) => asignacion.tutorId === nuevoTutor).length
    : 0;
  const aforo = docenteElegido?.aforoMaximo ?? 0;
  const cuposLibres = Math.max(0, aforo - cargaElegida);
  const porcentajeAforo = aforo > 0 ? Math.round((cargaElegida / aforo) * 100) : 0;

  const estudianteElegido = nuevoEstudiante
    ? estudiantes.find((item) => item.id === nuevoEstudiante)
    : undefined;

  const puedeRegistrar = Boolean(
    nuevoEstudiante && nuevoTutor && nuevaReferencia.trim() && cuposLibres > 0,
  );

  const asignacionEnCambio = cambioAbierto;
  const estudianteEnCambio = asignacionEnCambio
    ? estudiantes.find((item) => item.id === asignacionEnCambio.estudianteId)
    : undefined;
  const tutorActualEnCambio = asignacionEnCambio
    ? docentePorId(asignacionEnCambio.tutorId)
    : undefined;
  const tutoresDeLaEscuela = asignacionEnCambio
    ? tutoresDisponibles.filter(
        (docente) =>
          docente.escuelaId === asignacionEnCambio.escuelaId &&
          docente.id !== asignacionEnCambio.tutorId,
      )
    : [];

  function registrarAsignacion(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!estudianteElegido || !nuevoTutor || !puedeRegistrar) return;
    const tutor = docentePorId(nuevoTutor);
    const asignacion: Asignacion = {
      id: `ASG-${estudianteElegido.codigo}-${registros.length + 1}`,
      estudianteId: estudianteElegido.id,
      tutorId: nuevoTutor,
      semestreId: semestreActual,
      escuelaId: estudianteElegido.escuelaId,
      grupo: nuevoGrupo.trim() || null,
      fechaInicio: HOY_ISO,
      fechaFin: null,
      estado: 'activa',
      criterio: nuevoCriterio,
      referenciaAprobacion: nuevaReferencia.trim(),
      historial: [
        {
          fecha: HOY_ISO,
          tutorAnteriorId: null,
          tutorNuevoId: nuevoTutor,
          motivo: 'Asignación registrada por la coordinación de tutoría',
          responsable: portal.docente ? nombreCompleto(portal.docente) : 'Coordinación de tutoría',
        },
      ],
    };
    setRegistros((actuales) => [asignacion, ...actuales]);
    setAviso(
      `Asignación registrada: ${estudianteElegido.apellidos}, ${estudianteElegido.nombres} con ${
        tutor ? `${tutor.apellidos}, ${tutor.nombres}` : 'el tutor seleccionado'
      } (${etiquetaCriterio(nuevoCriterio)}).`,
    );
    setAltaAbierta(false);
    setNuevoEstudiante('');
    setNuevoTutor('');
    setNuevoCriterio('asignación directiva');
    setNuevoGrupo('');
    setNuevaReferencia('');
  }

  function registrarCambio(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!asignacionEnCambio || !tutorDestino || !motivoCambio.trim()) return;
    const nuevo = docentePorId(tutorDestino);
    const registro: CambioRegistrado = {
      id: `CAM-${asignacionEnCambio.id}-${cambios.length + 1}`,
      asignacionId: asignacionEnCambio.id,
      estudianteId: asignacionEnCambio.estudianteId,
      fecha: HOY_ISO,
      tutorAnteriorId: asignacionEnCambio.tutorId,
      tutorNuevoId: tutorDestino,
      motivo: motivoCambio.trim(),
      responsable: portal.docente ? nombreCompleto(portal.docente) : 'Coordinación de tutoría',
    };
    setRegistros((actuales) =>
      actuales.map((asignacion) =>
        asignacion.id === asignacionEnCambio.id
          ? { ...asignacion, tutorId: tutorDestino, historial: [...asignacion.historial, registro] }
          : asignacion,
      ),
    );
    setCambios((actuales) => [registro, ...actuales]);
    setAviso(
      `Cambio de tutor registrado para ${
        estudianteEnCambio
          ? `${estudianteEnCambio.apellidos}, ${estudianteEnCambio.nombres}`
          : 'el estudiante'
      }: nuevo tutor ${nuevo ? `${nuevo.apellidos}, ${nuevo.nombres}` : tutorDestino}.`,
    );
    setCambioAbierto(null);
    setTutorDestino('');
    setMotivoCambio('');
  }

  function exportarAsignaciones() {
    const filas: string[][] = [
      [
        'Código',
        'Estudiante',
        'Escuela',
        'Tutor',
        'Grupo',
        'Criterio',
        'Vigencia desde',
        'Vigencia hasta',
        'Estado',
        'Referencia de aprobación',
        'Cambios',
      ],
    ];
    for (const asignacion of filtro.filtrados) {
      const estudiante = estudiantes.find((item) => item.id === asignacion.estudianteId);
      const tutor = docentePorId(asignacion.tutorId);
      filas.push([
        estudiante?.codigo ?? asignacion.estudianteId,
        estudiante ? `${estudiante.apellidos}, ${estudiante.nombres}` : '—',
        abreviaturaEscuela(asignacion.escuelaId),
        tutor ? `${tutor.apellidos}, ${tutor.nombres}` : 'Sin tutor',
        asignacion.grupo ?? '—',
        etiquetaCriterio(asignacion.criterio),
        asignacion.fechaInicio,
        asignacion.fechaFin ?? '',
        etiquetaEstado(asignacion.estado),
        asignacion.referenciaAprobacion,
        String(asignacion.historial.length),
      ]);
    }
    downloadCsv(filas, `asignaciones-tutoria-${semestreActual}.csv`);
  }

  const columnas: Column<Asignacion>[] = [
    {
      key: 'estudiante',
      header: 'Estudiante',
      sortable: true,
      sortValue: (asignacion) => {
        const estudiante = estudiantes.find((item) => item.id === asignacion.estudianteId);
        return estudiante ? `${estudiante.apellidos} ${estudiante.nombres}` : '';
      },
      render: (asignacion) => {
        const estudiante = estudiantes.find((item) => item.id === asignacion.estudianteId);
        return estudiante ? (
          <PersonCell
            nombres={estudiante.nombres}
            apellidos={estudiante.apellidos}
            detalle={`${estudiante.codigo} · ciclo ${estudiante.ciclo}`}
            iniciales={iniciales(estudiante)}
          />
        ) : (
          <span className="cell-mono">Sin datos del estudiante</span>
        );
      },
    },
    {
      key: 'tutor',
      header: 'Docente tutor',
      sortable: true,
      sortValue: (asignacion) => docentePorId(asignacion.tutorId)?.apellidos ?? '',
      render: (asignacion) => {
        const tutor = docentePorId(asignacion.tutorId);
        if (!tutor) return <Badge tone="alerta">Sin tutor</Badge>;
        return (
          <span className="stack" style={{ gap: 1 }}>
            <strong className="cell-strong">{`${tutor.apellidos}, ${tutor.nombres}`}</strong>
            <span className="cell-note">
              {tutor.categoria} · cupos {tutor.aforoMaximo}
            </span>
          </span>
        );
      },
    },
    {
      key: 'escuela',
      header: 'Escuela',
      sortable: true,
      sortValue: (asignacion) => abreviaturaEscuela(asignacion.escuelaId),
      render: (asignacion) => <Badge tone="info">{abreviaturaEscuela(asignacion.escuelaId)}</Badge>,
    },
    {
      key: 'grupo',
      header: 'Grupo',
      sortable: true,
      sortValue: (asignacion) => asignacion.grupo ?? '',
      render: (asignacion) => asignacion.grupo ?? <span className="muted">Sin grupo</span>,
    },
    {
      key: 'criterio',
      header: 'Criterio',
      sortable: true,
      sortValue: (asignacion) => etiquetaCriterio(asignacion.criterio),
      render: (asignacion) => (
        <span className="stack" style={{ gap: 1 }}>
          <span>{etiquetaCriterio(asignacion.criterio)}</span>
          <span className="cell-note">{asignacion.referenciaAprobacion}</span>
        </span>
      ),
    },
    {
      key: 'vigencia',
      header: 'Vigencia',
      sortable: true,
      sortValue: (asignacion) => asignacion.fechaInicio,
      render: (asignacion) => <span className="nowrap cell-mono">{vigenciaDe(asignacion)}</span>,
    },
    {
      key: 'estado',
      header: 'Estado',
      sortable: true,
      sortValue: (asignacion) => asignacion.estado,
      render: (asignacion) => (
        <span className="stack" style={{ gap: 2 }}>
          <StatusBadge estado={asignacion.estado} etiqueta={etiquetaEstado(asignacion.estado)} />
          {asignacion.historial.length > 1 && (
            <span className="cell-note">{asignacion.historial.length - 1} cambio(s) de tutor</span>
          )}
        </span>
      ),
    },
    {
      key: 'acciones',
      header: 'Acciones',
      render: (asignacion) => (
        <span className="cell-actions">
          <button
            type="button"
            className="btn btn-falcon-default btn-sm"
            aria-label={`Cambiar tutor de la asignación ${asignacion.id}`}
            disabled={asignacion.estado !== 'activa'}
            onClick={() => {
              setCambioAbierto(asignacion);
              setTutorDestino('');
              setMotivoCambio('');
            }}
          >
            <ArrowLeftRight aria-hidden="true" /> Cambiar tutor
          </button>
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeading
        eyebrow={`Coordinación de tutoría · ${abreviaturaEscuela(portal.escuelaId)} · Semestre ${semestreActual}`}
        title="Asignar tutores"
        description="Asigna un tutor a cada estudiante y revisa los cupos disponibles."
        actions={
          <>
            <button type="button" className="btn btn-falcon-default" onClick={exportarAsignaciones}>
              <Download aria-hidden="true" /> Descargar tabla (CSV)
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setAviso(null);
                setAltaAbierta(true);
              }}
            >
              <Plus aria-hidden="true" /> Asignar tutor
            </button>
          </>
        }
      />

      {aviso && (
        <Alert tone="ok" title="Cambio guardado en esta prueba">
          {aviso} El registro se conserva solo en esta sesión del navegador.
        </Alert>
      )}

      <div className="grid grid--4">
        <Stat
          label="Asignaciones activas"
          value={activas.length}
          note={`${registros.length} registros históricos del semestre`}
          icon={<Network aria-hidden="true" />}
        />
        <Stat
          label="Docentes tutores con estudiantes"
          value={tutoresConTutorados}
          note={`${tutoresDisponibles.length} docentes habilitados en el padrón`}
          icon={<Users aria-hidden="true" />}
          tone="info"
        />
        <Stat
          label="Estudiantes sin asignación"
          value={sinTutor}
          note={sinTutor ? 'Requieren asignación de tutor' : 'Todo el padrón está asignado'}
          icon={<CircleAlert aria-hidden="true" />}
          tone={sinTutor ? 'alerta' : 'verde'}
        />
        <Stat
          label="Cambios de tutor"
          value={cambios.length}
          note="Registrados en esta sesión con su motivo"
          icon={<ArrowLeftRight aria-hidden="true" />}
          tone="violeta"
        />
      </div>

      <Card>
        <CardHead
          title="Estudiantes con tutor asignado"
          description="Busca por escuela, tutor o estado de la asignación."
          actions={<Badge tone="info">{semestreActual}</Badge>}
        />
        <CardBody>
          <div className="stack">
            <PanelFiltros<Asignacion>
              busqueda={filtro.busqueda}
              onBusqueda={filtro.setBusqueda}
              selects={selects}
              valores={filtro.valores}
              onValor={(id, valor) =>
                filtro.setValores((actuales) => ({ ...actuales, [id]: valor }))
              }
              mostrados={filtro.filtrados.length}
              total={registros.length}
              activos={filtro.activos}
              onLimpiar={filtro.limpiar}
              etiqueta="Filtros de asignaciones"
              placeholder="Buscar por estudiante, código o tutor…"
            />
            <DataTable<Asignacion>
              rows={filtro.filtrados}
              columns={columnas}
              caption={`Asignaciones tutor–estudiante del semestre ${semestreActual}`}
              rowKey={(asignacion) => asignacion.id}
              pageSize={10}
              initialSort={{ key: 'estudiante', direction: 'asc' }}
              emptyTitle="Sin asignaciones con estos filtros"
              emptyDescription="Ajusta la escuela, el tutor o el criterio de búsqueda."
            />
          </div>
        </CardBody>
        <CardFoot>
          <span>
            Referencia normativa: acta de audiencia FIIS del 7 de octubre de 2026, punto PRIMERO
            (cupos y criterio de asignación propuestos).
          </span>
          <button
            type="button"
            className="btn btn-falcon-default btn-sm"
            onClick={exportarAsignaciones}
          >
            <Download aria-hidden="true" /> Exportar lo filtrado
          </button>
        </CardFoot>
      </Card>

      {cambios.length > 0 && (
        <Card>
          <CardHead
            title="Cambios de tutor realizados"
            description="Cada cambio conserva el tutor anterior, el nuevo, el motivo y el responsable."
          />
          <CardBody flush>
            <ul className="list">
              {cambios.map((cambio) => {
                const estudiante = estudiantes.find((item) => item.id === cambio.estudianteId);
                const anterior = cambio.tutorAnteriorId
                  ? docentePorId(cambio.tutorAnteriorId)
                  : undefined;
                const nuevo = docentePorId(cambio.tutorNuevoId);
                return (
                  <li className="list__item" key={cambio.id}>
                    <span className="list__icon list__icon--violet" aria-hidden="true">
                      <ArrowLeftRight />
                    </span>
                    <span className="list__body">
                      <strong>
                        {estudiante
                          ? `${estudiante.apellidos}, ${estudiante.nombres}`
                          : cambio.asignacionId}
                      </strong>
                      <p>
                        De {anterior ? nombreCompleto(anterior) : 'sin tutor'} a{' '}
                        {nuevo ? nombreCompleto(nuevo) : cambio.tutorNuevoId}. Motivo:{' '}
                        {cambio.motivo}
                      </p>
                      <span className="list__meta">
                        <span>{formatFecha(cambio.fecha)}</span>
                        <span>Responsable: {cambio.responsable}</span>
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      )}

      {altaAbierta && (
        <Sheet
          title="Asignar un tutor"
          description={`Registro de la asignación del semestre ${semestreActual}`}
          onClose={() => setAltaAbierta(false)}
          footer={
            <>
              <button type="button" className="btn btn-link" onClick={() => setAltaAbierta(false)}>
                Cancelar
              </button>
              <button
                type="submit"
                form={idFormulario}
                className="btn btn-primary"
                disabled={!puedeRegistrar}
              >
                <Save aria-hidden="true" /> Registrar asignación
              </button>
            </>
          }
        >
          <form id={idFormulario} className="stack" onSubmit={registrarAsignacion}>
            <div className="field-grid">
              <div className="field">
                <label htmlFor={`${idFormulario}-estudiante`}>
                  Estudiante <span className="field__required">*</span>
                </label>
                <select
                  id={`${idFormulario}-estudiante`}
                  className="select"
                  value={nuevoEstudiante}
                  onChange={(evento) => setNuevoEstudiante(evento.target.value)}
                >
                  <option value="">Elige un estudiante…</option>
                  {estudiantesSinAsignar.map((estudiante: Estudiante) => (
                    <option key={estudiante.id} value={estudiante.id}>
                      {estudiante.apellidos}, {estudiante.nombres} · {estudiante.codigo} · ciclo{' '}
                      {estudiante.ciclo}
                    </option>
                  ))}
                </select>
                <span className="field__hint">
                  Solo se listan estudiantes sin asignación activa ({estudiantesSinAsignar.length}).
                </span>
              </div>

              <div className="field">
                <label htmlFor={`${idFormulario}-tutor`}>
                  Docente tutor <span className="field__required">*</span>
                </label>
                <select
                  id={`${idFormulario}-tutor`}
                  className="select"
                  value={nuevoTutor}
                  onChange={(evento) => setNuevoTutor(evento.target.value)}
                >
                  <option value="">Elige un docente…</option>
                  {tutoresDisponibles.map((docente) => (
                    <option key={docente.id} value={docente.id}>
                      {docente.apellidos}, {docente.nombres} ·{' '}
                      {abreviaturaEscuela(docente.escuelaId)} · cupos {docente.aforoMaximo}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor={`${idFormulario}-criterio`}>Criterio de asignación</label>
                <select
                  id={`${idFormulario}-criterio`}
                  className="select"
                  value={nuevoCriterio}
                  onChange={(evento) =>
                    setNuevoCriterio(evento.target.value as Asignacion['criterio'])
                  }
                >
                  {CRITERIOS.map((criterio) => (
                    <option key={criterio} value={criterio}>
                      {etiquetaCriterio(criterio)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor={`${idFormulario}-grupo`}>Grupo</label>
                <input
                  id={`${idFormulario}-grupo`}
                  className="input"
                  value={nuevoGrupo}
                  onChange={(evento) => setNuevoGrupo(evento.target.value)}
                  placeholder="Ej.: G-IIS-2"
                />
                <span className="field__hint">
                  Puede dejarse vacío si el grupo se define después.
                </span>
              </div>
            </div>

            <div className="field">
              <label htmlFor={`${idFormulario}-referencia`}>
                Referencia de aprobación <span className="field__required">*</span>
              </label>
              <input
                id={`${idFormulario}-referencia`}
                className="input"
                value={nuevaReferencia}
                onChange={(evento) => setNuevaReferencia(evento.target.value)}
                placeholder="Acta de asignación tutorial · 2026-II"
              />
              <span className="field__hint">
                Documento de la comisión de tutoría que sustenta la asignación.
              </span>
            </div>

            <div className="field">
              <span className="field__label">Aviso de cupos del docente tutor</span>
              {docenteElegido ? (
                <div className="stack stack--sm">
                  <Progress
                    valor={porcentajeAforo}
                    etiqueta={`${docenteElegido.apellidos}, ${docenteElegido.nombres} · ${cargaElegida} de ${aforo} estudiantes`}
                    variante={
                      porcentajeAforo >= 100 ? 'riesgo' : porcentajeAforo >= 80 ? 'alerta' : 'verde'
                    }
                  />
                  {cuposLibres > 0 ? (
                    <Alert
                      tone={porcentajeAforo >= 80 ? 'alerta' : 'info'}
                      title={`${cuposLibres} cupo(s) disponible(s) según los cupos registrados`}
                    >
                      El límite de estudiantes proviene del registro docente. El acta del 7 de
                      octubre de 2026 propone un rango de 10 a 14 estudiantes por docente y está
                      pendiente de validación: el sistema avisa, pero no bloquea la asignación.
                    </Alert>
                  ) : (
                    <Alert tone="riesgo" title="El tutor ya tiene todos sus cupos ocupados">
                      {cargaElegida} de {aforo} estudiantes registrados. Solicite la ampliación del
                      cupos o elija otro docente antes de continuar.
                    </Alert>
                  )}
                </div>
              ) : (
                <Alert tone="info" title="Elige un tutor">
                  Al elegir al docente se comparará su carga actual con el límite de estudiantes
                  registrado en su registro.
                </Alert>
              )}
            </div>

            {estudianteElegido && (
              <dl className="def-list">
                <div>
                  <dt>Estudiante</dt>
                  <dd>
                    {estudianteElegido.apellidos}, {estudianteElegido.nombres} ·{' '}
                    {estudianteElegido.codigo}
                  </dd>
                </div>
                <div>
                  <dt>Escuela y ciclo</dt>
                  <dd>
                    {abreviaturaEscuela(estudianteElegido.escuelaId)} · ciclo{' '}
                    {estudianteElegido.ciclo} · {estudianteElegido.etapa}
                  </dd>
                </div>
                <div>
                  <dt>Promedio ponderado</dt>
                  <dd>{estudianteElegido.promedioPonderado.toFixed(1)}</dd>
                </div>
                <div>
                  <dt>Señales registradas</dt>
                  <dd>
                    {estudianteElegido.alertas.length
                      ? estudianteElegido.alertas.map((alerta) => alerta.detalle).join(' · ')
                      : 'Sin alertas'}
                  </dd>
                </div>
              </dl>
            )}

            <p className="small muted">
              La matrícula condicionada no se configura como restricción automática en el sistema
              (regla matricula-condicionada, pendiente de validación).
            </p>
          </form>
        </Sheet>
      )}

      {asignacionEnCambio && (
        <Sheet
          title="Cambiar tutor"
          description={
            estudianteEnCambio
              ? `${estudianteEnCambio.apellidos}, ${estudianteEnCambio.nombres} · ${estudianteEnCambio.codigo}`
              : asignacionEnCambio.id
          }
          onClose={() => setCambioAbierto(null)}
          footer={
            <>
              <button type="button" className="btn btn-link" onClick={() => setCambioAbierto(null)}>
                Cancelar
              </button>
              <button
                type="submit"
                form={`${idFormulario}-cambio`}
                className="btn btn-primary"
                disabled={!tutorDestino || !motivoCambio.trim()}
              >
                <UserPlus aria-hidden="true" /> Registrar cambio
              </button>
            </>
          }
        >
          <form id={`${idFormulario}-cambio`} className="stack" onSubmit={registrarCambio}>
            <dl className="def-list">
              <div>
                <dt>Tutor actual</dt>
                <dd>{tutorActualEnCambio ? nombreCompleto(tutorActualEnCambio) : 'Sin tutor'}</dd>
              </div>
              <div>
                <dt>Grupo y referencia</dt>
                <dd>
                  {asignacionEnCambio.grupo ?? 'Sin grupo'} ·{' '}
                  {asignacionEnCambio.referenciaAprobacion}
                </dd>
              </div>
              <div>
                <dt>Cambios anteriores</dt>
                <dd>{Math.max(0, asignacionEnCambio.historial.length - 1)}</dd>
              </div>
            </dl>

            <div className="field">
              <label htmlFor={`${idFormulario}-destino`}>
                Nuevo docente tutor <span className="field__required">*</span>
              </label>
              <select
                id={`${idFormulario}-destino`}
                className="select"
                value={tutorDestino}
                onChange={(evento) => setTutorDestino(evento.target.value)}
              >
                <option value="">Elige un docente de la escuela…</option>
                {tutoresDeLaEscuela.map((docente) => {
                  const carga = activas.filter(
                    (asignacion) => asignacion.tutorId === docente.id,
                  ).length;
                  return (
                    <option key={docente.id} value={docente.id}>
                      {docente.apellidos}, {docente.nombres} · {carga}/{docente.aforoMaximo}{' '}
                      estudiantes
                    </option>
                  );
                })}
              </select>
              <span className="field__hint">
                {tutoresDeLaEscuela.length === 0
                  ? 'No hay otro docente habilitado en la escuela: solicite la designación a la comisión.'
                  : 'Solo se listan docentes activos de la misma escuela.'}
              </span>
            </div>

            <div className="field">
              <label htmlFor={`${idFormulario}-motivo`}>
                Motivo del cambio <span className="field__required">*</span>
              </label>
              <textarea
                id={`${idFormulario}-motivo`}
                className="textarea"
                value={motivoCambio}
                onChange={(evento) => setMotivoCambio(evento.target.value)}
                placeholder="Ej.: el docente concluyó su vínculo laboral; el estudiante solicitó afinidad de curso."
              />
              <span className="field__hint">
                El motivo queda en el historial de la asignación y en el registro de auditoría.
              </span>
            </div>

            {tutorDestino && (
              <Alert tone="info" title="Qué cambia al elegir otro tutor">
                El historial conservará al tutor anterior, la fecha del cambio (
                {formatFecha(HOY_ISO)}) y el responsable que lo registró. Los formularios ya
                aprobados mantienen su revisor original.
              </Alert>
            )}

            <Alert tone="alerta" title="Cómo se asignó el tutor">
              <TriangleAlert aria-hidden="true" /> La asignación es directiva por la comisión de
              tutoría; la afinidad de curso y la elección del estudiante se registran como criterios
              complementarios y requieren la constancia correspondiente.
            </Alert>
          </form>
        </Sheet>
      )}

      <Card flat>
        <CardHead
          title="Reglas para asignar tutores"
          description="Consulta las reglas de asignación."
        />
        <CardBody>
          <div className="grid grid--2">
            <dl className="def-list">
              <div>
                <dt>Criterio de asignación</dt>
                <dd>
                  Asignación directiva por la comisión; afinidad de curso como criterio
                  complementario.
                </dd>
              </div>
              <div>
                <dt>Cupos por docente tutor</dt>
                <dd>Propuesta: entre 10 y 14 estudiantes según la escuela (estado: propuesta).</dd>
              </div>
              <div>
                <dt>Referencia de aprobación</dt>
                <dd>Acta de la comisión de tutoría de la escuela por semestre académico.</dd>
              </div>
            </dl>
            <div className="stack stack--sm">
              <Alert tone="info" title="Cómo se calcula la atención">
                El sistema separa estudiantes únicos atendidos, atenciones acumuladas y sesiones
                realizadas. La asignación no cambia el conteo histórico del semestre.
              </Alert>
              <Alert tone="ok" title="Datos de prueba">
                <BadgeCheck aria-hidden="true" /> Las personas, códigos y actas son ficticios y
                están listos para sustituirse por la consulta a la DIAA y a los decanatos.
              </Alert>
            </div>
          </div>
        </CardBody>
      </Card>
    </>
  );
}
