import { SolicitudesCambioPendientes } from '../../components/panels/GestionCoordinacion';
import type { FormEvent } from 'react';
import { useCallback, useId, useMemo, useState } from 'react';
import type { DefinicionSelect } from '../../hooks/useFiltro';
import { useFiltro } from '../../hooks/useFiltro';
import {
  DirectoryPage,
  DirectorySummary,
  DirectoryViews,
  DirectoryDisclosure,
} from '../../components/ui/DirectoryPage';
import { DirectoryToolbar } from '../../components/ui/DirectoryToolbar';
import { Alert } from '../../components/ui/Alert';
import { Card, CardBody, CardFoot, CardHead } from '../../components/ui/Card';
import type { Column } from '../../components/ui/DataTable';
import { DataTable } from '../../components/ui/DataTable';
import {
  ArrowLeftRight,
  BadgeCheck,
  Download,
  Plus,
  Save,
  TriangleAlert,
  UserPlus,
  Presentation,
  UserCheck,
} from '../../components/ui/icons';
import { PageHeading } from '../../components/ui/PageHeading';
import { PersonCell } from '../../components/ui/PersonCell';
import { Progress } from '../../components/ui/Progress';
import { Sheet } from '../../components/ui/Sheet';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { Badge, StatusBadge } from '../../components/ui/StatusBadge';
import { escuelas, semestreActual } from '../../data/catalogos';
import { escuelaDe, docentePorId, iniciales, nombreCompleto } from '../../data/personas';
import { asignaciones } from '../../data/tutoria';
import { usePortal } from '../../hooks/usePortal';
import { useSistema } from '../../hooks/useSistema';
import { usePersonasPortal } from '../../hooks/usePersonasPortal';
import { API_MODE } from '../../services/apiConfig';
import { asignarTutorApi } from '../../services/apiTutoria';
import type { Asignacion, CambioTutor } from '../../types/domain';
import { downloadCsv } from '../../utils/csv';
import { HOY_ISO, formatFecha } from '../../utils/fechas';
import '../../styles/coord-assignments.css';

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
  const { estudiantes, docentes } = usePersonasPortal();
  const periodos = useSistema()?.periodosEscuela;
  const idFormulario = useId();

  const [registrosLocales, setRegistros] = useState<Asignacion[]>(() =>
    asignaciones.map((asignacion) => ({ ...asignacion, historial: [...asignacion.historial] })),
  );
  const registros = API_MODE ? portal.tutorados : registrosLocales;
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [cambios, setCambios] = useState<CambioRegistrado[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [altaAbierta, setAltaAbierta] = useState(false);
  const [cambioAbierto, setCambioAbierto] = useState<Asignacion | null>(null);
  const [detalle, setDetalle] = useState<Asignacion | null>(null);

  // —— Formulario de alta ——
  const [nuevoEstudiante, setNuevoEstudiante] = useState('');
  const [nuevoTutor, setNuevoTutor] = useState('');
  const [nuevoGrupo, setNuevoGrupo] = useState('');
  const [nuevaReferencia, setNuevaReferencia] = useState('');

  // —— Formulario de cambio de tutor ——
  const [tutorDestino, setTutorDestino] = useState('');
  const [motivoCambio, setMotivoCambio] = useState('');

  const buscarEn = useCallback(
    (asignacion: Asignacion) => {
      const estudiante = estudiantes.find((item) => item.id === asignacion.estudianteId);
      const tutor = docentePorId(asignacion.tutorId);
      return [
        estudiante?.codigo ?? '',
        estudiante ? `${estudiante.apellidos} ${estudiante.nombres}` : '',
        tutor ? `${tutor.apellidos} ${tutor.nombres}` : '',
        asignacion.referenciaAprobacion,
        asignacion.grupo ?? '',
      ].join(' ');
    },
    [estudiantes],
  );

  const selects = useMemo<Array<DefinicionSelect<Asignacion>>>(
    () => [
      {
        id: 'escuela',
        etiqueta: 'Escuela',
        opciones: escuelas
          .filter((escuela) => !API_MODE || portal.institucional || escuela.id === portal.escuelaId)
          .map((escuela) => ({ valor: escuela.id, etiqueta: escuela.nombre })),
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
    [docentes, portal.escuelaId, portal.institucional],
  );

  const filtro = useFiltro(registros, buscarEn, selects);

  const activas = useMemo(() => {
    const porEscuela = new Map(periodos?.map((p) => [p.escuelaId, p.semestreId]));
    return registros.filter(
      (a) =>
        a.estado === 'activa' && a.semestreId === (porEscuela.get(a.escuelaId) ?? semestreActual),
    );
  }, [periodos, registros]);
  const tutoresConTutorados = new Set(activas.map((asignacion) => asignacion.tutorId)).size;
  const estudiantesSinAsignar = useMemo(() => {
    const asignados = new Set(activas.map((a) => a.estudianteId));
    return estudiantes
      .filter((e) => !asignados.has(e.id))
      .sort((a, b) => a.apellidos.localeCompare(b.apellidos, 'es'));
  }, [activas, estudiantes]);
  const sinTutor = estudiantesSinAsignar.length;

  const tutoresDisponibles = useMemo(
    () =>
      [...docentes]
        .filter((docente) => docente.activo && docente.escuelaId)
        .sort((a, b) => a.apellidos.localeCompare(b.apellidos, 'es')),
    [docentes],
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
  const tutoresParaAlta = estudianteElegido
    ? tutoresDisponibles.filter((docente) => docente.escuelaId === estudianteElegido.escuelaId)
    : tutoresDisponibles;

  const puedeRegistrar = Boolean(
    estudianteElegido &&
    docenteElegido?.escuelaId === estudianteElegido.escuelaId &&
    nuevaReferencia.trim() &&
    cuposLibres > 0,
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

  async function registrarAsignacion(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!estudianteElegido || !nuevoTutor || !puedeRegistrar || guardando) return;
    if (API_MODE) {
      setError('');
      setGuardando(true);
      try {
        await asignarTutorApi({
          estudianteId: estudianteElegido.id,
          tutorId: nuevoTutor,
          grupo: nuevoGrupo.trim() || null,
          referencia: nuevaReferencia.trim(),
        });
        setAltaAbierta(false);
        setAviso('Asignación guardada.');
        setNuevoEstudiante('');
        setNuevoTutor('');
        setNuevoGrupo('');
        setNuevaReferencia('');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo asignar el tutor.');
      } finally {
        setGuardando(false);
      }
      return;
    }
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
      criterio: 'asignación directiva',
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
      }.`,
    );
    setAltaAbierta(false);
    setNuevoEstudiante('');
    setNuevoTutor('');
    setNuevoGrupo('');
    setNuevaReferencia('');
  }

  async function registrarCambio(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!asignacionEnCambio || !tutorDestino || !motivoCambio.trim() || guardando) return;
    if (API_MODE) {
      setError('');
      setGuardando(true);
      try {
        await asignarTutorApi({
          estudianteId: asignacionEnCambio.estudianteId,
          tutorId: tutorDestino,
          grupo: asignacionEnCambio.grupo,
          referencia: motivoCambio.trim(),
          version: asignacionEnCambio.version,
        });
        setCambioAbierto(null);
        setTutorDestino('');
        setMotivoCambio('');
        setAviso('Cambio de tutor guardado.');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo cambiar el tutor.');
      } finally {
        setGuardando(false);
      }
      return;
    }
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
        escuelaDe(asignacion.escuelaId),
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
            detalle={`${estudiante.codigo} · ${escuelaDe(asignacion.escuelaId)}`}
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
            <span className="cell-note">{tutor.codigo}</span>
          </span>
        );
      },
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
        </span>
      ),
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
            aria-label={`Ver detalle de la asignación ${asignacion.id}`}
            onClick={() => setDetalle(asignacion)}
          >
            Ver ficha <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
          </button>
        </span>
      ),
    },
  ];

  return (
    <DirectoryPage>
      <PageHeading
        eyebrow={`Coordinación de tutoría · ${portal.institucional ? 'Todas las escuelas' : escuelaDe(portal.escuelaId)}`}
        title="Asignar tutores"
        description="Organiza las asignaciones y la cobertura del semestre."
        actions={
          <>
            <button type="button" className="btn btn-falcon-default" onClick={exportarAsignaciones}>
              <Download aria-hidden="true" /> Exportar CSV
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
          {aviso} {!API_MODE && 'El registro se conserva solo en esta sesión del navegador.'}
        </Alert>
      )}

      <DirectorySummary
        label="Cobertura tutorial"
        icon={<UserCheck aria-hidden="true" />}
        value={`${estudiantes.length - sinTutor} / ${estudiantes.length}`}
        percent={
          estudiantes.length
            ? Math.round(((estudiantes.length - sinTutor) / estudiantes.length) * 100)
            : 0
        }
        note="con tutor asignado"
        metrics={[
          {
            label: 'Pendientes de asignar',
            value: sinTutor,
            note: sinTutor ? 'Sin tutor vigente' : 'Cobertura completa',
            tone: sinTutor ? 'warning' : 'default',
            icon: <UserPlus aria-hidden="true" />,
          },
          {
            label: 'Tutores con estudiantes',
            value: tutoresConTutorados,
            note: `${tutoresDisponibles.length} habilitados`,
            icon: <Presentation aria-hidden="true" />,
          },
          {
            label: 'Cambios de tutor',
            value: cambios.length,
            note: 'En esta sesión',
            icon: <ArrowLeftRight aria-hidden="true" />,
          },
        ]}
      />

      <Card>
        <CardHead
          title="Asignaciones del semestre"
          actions={
            <span className="directory-result">
              {portal.institucional ? 'Todas las escuelas' : `Semestre ${semestreActual}`}
            </span>
          }
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
              total={registros.length}
              onLimpiar={filtro.limpiar}
              etiqueta="Filtros de asignaciones"
              placeholder="Buscar por estudiante, código o tutor…"
              views={
                <DirectoryViews
                  views={[
                    {
                      label: 'Todas',
                      count: registros.length,
                      active: !filtro.valores.estado,
                      onClick: () => filtro.setValores((v) => ({ ...v, estado: '' })),
                    },
                    {
                      label: 'Activas',
                      count: activas.length,
                      active: filtro.valores.estado === 'activa',
                      onClick: () => filtro.setValores((v) => ({ ...v, estado: 'activa' })),
                    },
                    {
                      label: 'Finalizadas',
                      count: registros.filter((a) => a.estado === 'finalizada').length,
                      active: filtro.valores.estado === 'finalizada',
                      onClick: () => filtro.setValores((v) => ({ ...v, estado: 'finalizada' })),
                    },
                  ]}
                />
              }
            />
            <DataTable<Asignacion>
              rows={filtro.filtrados}
              columns={columnas}
              caption={`Asignaciones tutor–estudiante del semestre ${semestreActual}`}
              rowKey={(asignacion) => asignacion.id}
              pageSize={10}
              pagination="auto"
              paginationPosition="bottom"
              inlineActions
              initialSort={{ key: 'estudiante', direction: 'asc' }}
              emptyTitle="Sin asignaciones con estos filtros"
              emptyDescription="Ajusta la escuela, el tutor o el criterio de búsqueda."
            />
          </div>
        </CardBody>
        <CardFoot>
          <span>
            Acta FIIS · 7 oct. 2026 · criterios y cupos propuestos. La exportación respeta los
            filtros.
          </span>
        </CardFoot>
      </Card>

      {detalle && (
        <Sheet
          title="Detalle de asignación"
          description={detalle.id}
          onClose={() => setDetalle(null)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-falcon-default"
                onClick={() => setDetalle(null)}
              >
                Cerrar ficha
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={detalle.estado !== 'activa'}
                onClick={() => {
                  setCambioAbierto(detalle);
                  setDetalle(null);
                  setTutorDestino('');
                  setMotivoCambio('');
                }}
              >
                <ArrowLeftRight aria-hidden="true" /> Cambiar tutor
              </button>
            </>
          }
        >
          <dl className="def-list">
            <div>
              <dt>Estudiante</dt>
              <dd>
                {(() => {
                  const e = estudiantes.find((item) => item.id === detalle.estudianteId);
                  return e ? nombreCompleto(e) : 'Sin datos del estudiante';
                })()}
              </dd>
            </div>
            <div>
              <dt>Docente tutor</dt>
              <dd>
                {(() => {
                  const d = docentePorId(detalle.tutorId);
                  return d ? nombreCompleto(d) : 'Sin tutor';
                })()}
              </dd>
            </div>
            <div>
              <dt>Escuela / grupo</dt>
              <dd>
                {escuelaDe(detalle.escuelaId)} · {detalle.grupo ?? 'Sin grupo'}
              </dd>
            </div>
            <div>
              <dt>Criterio</dt>
              <dd>{etiquetaCriterio(detalle.criterio)}</dd>
            </div>
            <div>
              <dt>Vigencia</dt>
              <dd>{vigenciaDe(detalle)}</dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>
                <StatusBadge estado={detalle.estado} etiqueta={etiquetaEstado(detalle.estado)} />
              </dd>
            </div>
            <div>
              <dt>Referencia de aprobación</dt>
              <dd>{detalle.referenciaAprobacion}</dd>
            </div>
          </dl>
          <h3 className="directory-detail-title">Historial de la asignación</h3>
          <ul className="list">
            {detalle.historial.map((cambio, index) => (
              <li className="list__item" key={`${cambio.fecha}-${index}`}>
                <span className="list__body">
                  <strong>{formatFecha(cambio.fecha)}</strong>
                  <p>{cambio.motivo}</p>
                  <span className="list__meta">{cambio.responsable}</span>
                </span>
              </li>
            ))}
          </ul>
        </Sheet>
      )}

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
          description={`Semestre ${semestreActual}`}
          className="assignment-sheet"
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
                disabled={guardando || !puedeRegistrar}
              >
                <Save aria-hidden="true" /> Guardar asignación
              </button>
            </>
          }
        >
          <form id={idFormulario} className="assignment-form" onSubmit={registrarAsignacion}>
            {error && (
              <Alert tone="riesgo" title="No se guardó la asignación">
                {error}
              </Alert>
            )}
            <div className="assignment-people">
              <SearchableSelect
                label="Estudiante"
                placeholder="Buscar por nombre o código"
                options={estudiantesSinAsignar.map((estudiante) => ({
                  value: estudiante.id,
                  label: `${estudiante.apellidos}, ${estudiante.nombres}`,
                  description: `${estudiante.codigo} · ${escuelaDe(estudiante.escuelaId)}`,
                }))}
                value={nuevoEstudiante}
                onChange={(id) => {
                  setNuevoEstudiante(id);
                  if (estudiantes.find((e) => e.id === id)?.escuelaId !== docenteElegido?.escuelaId)
                    setNuevoTutor('');
                }}
                required
                autoFocus={false}
                limiteResultados={portal.institucional ? 50 : undefined}
              />
              <SearchableSelect
                label="Docente tutor"
                placeholder="Buscar por nombre o código"
                options={tutoresParaAlta.map((docente) => ({
                  value: docente.id,
                  label: `${docente.apellidos}, ${docente.nombres}`,
                  description: `${docente.codigo} · ${escuelaDe(docente.escuelaId)}`,
                }))}
                value={nuevoTutor}
                onChange={setNuevoTutor}
                required
                autoFocus={false}
                tipoResultado="docente"
                limiteResultados={portal.institucional ? 50 : undefined}
              />
            </div>
            <div className="field-grid">
              <div className="field">
                <label htmlFor={`${idFormulario}-grupo`}>
                  Grupo <span className="assignment-optional">· Opcional</span>
                </label>
                <input
                  id={`${idFormulario}-grupo`}
                  className="input"
                  value={nuevoGrupo}
                  onChange={(evento) => setNuevoGrupo(evento.target.value)}
                  placeholder="Ej.: G-IIS-2"
                />
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
              </div>
            </div>

            {docenteElegido && (
              <div className="assignment-capacity">
                <span className="field__label">Cupos del tutor</span>
                <div className="stack stack--sm">
                  <Progress
                    valor={porcentajeAforo}
                    etiqueta={`${docenteElegido.apellidos}, ${docenteElegido.nombres} · ${cargaElegida} de ${aforo} estudiantes`}
                    variante={
                      porcentajeAforo >= 100 ? 'riesgo' : porcentajeAforo >= 80 ? 'alerta' : 'verde'
                    }
                  />
                  {cuposLibres > 0 ? (
                    <span className="field__hint">
                      {cuposLibres} {cuposLibres === 1 ? 'cupo disponible' : 'cupos disponibles'}
                    </span>
                  ) : (
                    <Alert tone="riesgo" title="El tutor ya tiene todos sus cupos ocupados">
                      Elige otro tutor o solicita una ampliación de cupos.
                    </Alert>
                  )}
                </div>
              </div>
            )}
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
                disabled={guardando || !tutorDestino || !motivoCambio.trim()}
              >
                <UserPlus aria-hidden="true" /> Registrar cambio
              </button>
            </>
          }
        >
          <form id={`${idFormulario}-cambio`} className="stack" onSubmit={registrarCambio}>
            {error && (
              <Alert tone="riesgo" title="No se guardó el cambio">
                {error}
              </Alert>
            )}
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

      <DirectoryDisclosure title="Criterios, cupos y referencias de asignación">
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
              <BadgeCheck aria-hidden="true" /> Las personas, códigos y actas son ficticios y están
              listos para sustituirse por la consulta a la DIAA y a los decanatos.
            </Alert>
          </div>
        </div>
      </DirectoryDisclosure>
      {API_MODE && (
        <DirectoryDisclosure title="Solicitudes de cambio de tutor">
          <SolicitudesCambioPendientes />
        </DirectoryDisclosure>
      )}
    </DirectoryPage>
  );
}
