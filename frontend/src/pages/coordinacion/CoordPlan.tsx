import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { EditorActividad } from '../../components/panels/GestionCoordinacion';
import { GuidedInstrumentForm } from '../../components/panels/GuidedInstrumentForm';
import { Alert } from '../../components/ui/Alert';
import { Calendar } from '../../components/ui/Calendar';
import type { EventoCalendario } from '../../components/ui/Calendar';
import { Card, CardBody, CardHead } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import type { Column } from '../../components/ui/DataTable';
import { DirectoryPage, DirectoryViews } from '../../components/ui/DirectoryPage';
import { DirectoryToolbar } from '../../components/ui/DirectoryToolbar';
import { EtapaSelector } from '../../components/ui/FormsPanel';
import { PageHeading } from '../../components/ui/PageHeading';
import { Meter } from '../../components/ui/Progress';
import { Sheet } from '../../components/ui/Sheet';
import { Badge, StatusBadge } from '../../components/ui/StatusBadge';
import { escuelas, semestreActual } from '../../data/catalogos';
import { definicionPorCodigo } from '../../data/formatos';
import { escuelaDe } from '../../data/personas';
import { actividadesPlan } from '../../data/tutoria';
import { useFiltro } from '../../hooks/useFiltro';
import { useInstrumentWorkspace } from '../../hooks/useInstrumentWorkspace';
import { usePortal } from '../../hooks/usePortal';
import { useSistema } from '../../hooks/useSistema';
import { API_MODE } from '../../services/apiConfig';
import { crearFormularioApi, guardarFormularioApi } from '../../services/apiTutoria';
import type { ActividadPlan } from '../../types/domain';
import { formatFecha } from '../../utils/fechas';
import { puedeEnviarFormato } from '../../utils/instrumentos';
import '../../styles/coord-planning.css';
import '../../styles/coord-modals.css';

const ESTADOS = [
  { valor: 'planificada', etiqueta: 'Planificadas' },
  { valor: 'en-ejecucion', etiqueta: 'En ejecución' },
  { valor: 'culminada', etiqueta: 'Culminadas' },
  { valor: 'reprogramada', etiqueta: 'Reprogramadas' },
];

const FILTROS = [
  { id: 'estado', etiqueta: 'Estado', opciones: ESTADOS, valorDe: (a: ActividadPlan) => a.estado },
];
const buscarEn = (a: ActividadPlan) => `${a.actividad} ${a.responsable} ${a.meta}`;

export function CoordPlan() {
  const portal = usePortal();
  const sistema = useSistema();
  const { registros, momento } = useInstrumentWorkspace();
  const idEscuela = useId();
  const [escuelaDemo, setEscuelaDemo] = useState(portal.escuelaId);
  const [actividadId, setActividadId] = useState<string | null>(null);
  const [panel, setPanel] = useState<'informe' | 'calendario' | 'nueva' | null>(null);
  const [error, setError] = useState('');
  const [creando, setCreando] = useState(false);
  const escuelaId = API_MODE ? (portal.institucional ? '' : portal.escuelaId) : escuelaDemo;
  const persistidas = sistema?.actividadesPlan ?? [];
  const periodos = new Map(sistema?.periodosEscuela?.map((p) => [p.escuelaId, p.semestreId]));
  const actividades = (API_MODE ? persistidas : actividadesPlan).filter(
    (a) =>
      (!escuelaId || a.escuelaId === escuelaId) &&
      a.semestreId === (periodos.get(a.escuelaId) ?? semestreActual),
  );
  const plan = registros.find((r) => r.formato === 'F01' && r.semestreId === semestreActual);
  const filtros = portal.institucional
    ? [
        ...FILTROS,
        {
          id: 'escuela',
          etiqueta: 'Escuela',
          opciones: escuelas.map((e) => ({ valor: e.id, etiqueta: e.nombre })),
          valorDe: (a: ActividadPlan) => a.escuelaId,
        },
      ]
    : FILTROS;
  const filtro = useFiltro(actividades, buscarEn, filtros);
  const seleccionada = actividades.find((a) => a.id === actividadId);
  const editable = persistidas.find((a) => a.id === actividadId);
  const vistas = [
    { valor: '', etiqueta: 'Todas' },
    ...ESTADOS.filter(({ valor }) => valor === 'en-ejecucion' || valor === 'culminada'),
  ];

  async function abrirInforme() {
    if (plan) {
      setPanel('informe');
      return;
    }
    setError('');
    setCreando(true);
    try {
      await crearFormularioApi('F01');
      setPanel('informe');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo preparar el informe.');
    } finally {
      setCreando(false);
    }
  }

  function cerrarActividad() {
    setActividadId(null);
    setPanel(null);
  }

  const columnas: Column<ActividadPlan>[] = [
    {
      key: 'actividad',
      header: 'Actividad',
      sortable: true,
      sortValue: (a) => a.actividad,
      render: (a) => (
        <span className="plan-activity-name">
          <strong>{a.actividad}</strong>
          <small>{a.responsable}</small>
          {portal.institucional && <small>{escuelaDe(a.escuelaId)}</small>}
        </span>
      ),
    },
    {
      key: 'fechas',
      header: 'Fechas',
      sortable: true,
      sortValue: (a) => a.fechaInicio,
      render: (a) => (
        <span className="cell-note">
          <time dateTime={a.fechaInicio}>{formatFecha(a.fechaInicio)}</time>
          {' – '}
          <time dateTime={a.fechaFin}>{formatFecha(a.fechaFin)}</time>
        </span>
      ),
    },
    {
      key: 'avance',
      header: 'Avance',
      sortable: true,
      sortValue: (a) => a.avance,
      render: (a) => <Meter valor={a.avance} />,
    },
    {
      key: 'estado',
      header: 'Estado',
      sortable: true,
      sortValue: (a) => a.estado,
      render: (a) => <StatusBadge estado={a.estado} />,
    },
    {
      key: 'acciones',
      header: 'Acciones',
      render: (a) => (
        <span className="cell-actions">
          <button
            type="button"
            className="btn btn-falcon-default btn-sm"
            onClick={() => setActividadId(a.id)}
          >
            <i
              className={API_MODE ? 'fa-regular fa-pen-to-square' : 'fa-regular fa-eye'}
              aria-hidden="true"
            />
            {API_MODE ? 'Editar actividad' : 'Ver detalle'}
          </button>
        </span>
      ),
    },
  ];

  const eventos: EventoCalendario[] = actividades.flatMap((a) => [
    { id: a.id + '-inicio', fecha: a.fechaInicio, titulo: a.actividad, tono: 'verde' },
    { id: a.id + '-fin', fecha: a.fechaFin, titulo: 'Cierre · ' + a.actividad, tono: 'dorado' },
  ]);

  return (
    <DirectoryPage className="coord-planning">
      <PageHeading
        eyebrow="Coordinación de tutoría"
        title={API_MODE ? 'Plan e informe de tutoría' : 'Plan de tutoría'}
        description={
          portal.institucional
            ? 'Actividades de todas las escuelas.'
            : `${semestreActual} · ${escuelaDe(escuelaId)}`
        }
        actions={
          API_MODE && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setPanel('nueva')}
              disabled={!sistema}
            >
              <i className="fa-solid fa-plus" aria-hidden="true" /> Nueva actividad
            </button>
          )
        }
      />
      <Card>
        <CardHead
          title="Actividades del plan"
          actions={
            <button
              type="button"
              className="btn btn-falcon-default"
              onClick={() => setPanel('calendario')}
            >
              <i className="fa-regular fa-calendar" aria-hidden="true" /> Calendario
            </button>
          }
        />
        <CardBody>
          {!API_MODE && (
            <div className="directory-controls">
              <div className="field">
                <label htmlFor={idEscuela}>Escuela</label>
                <select
                  id={idEscuela}
                  className="select"
                  value={escuelaId}
                  onChange={(e) => setEscuelaDemo(e.target.value)}
                >
                  {escuelas.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <DirectoryToolbar
            busqueda={filtro.busqueda}
            onBusqueda={filtro.setBusqueda}
            selects={filtros}
            valores={filtro.valores}
            onValores={filtro.setValores}
            mostrados={filtro.filtrados.length}
            total={actividades.length}
            onLimpiar={filtro.limpiar}
            etiqueta="Filtros del plan"
            placeholder="Buscar actividad"
            views={
              <DirectoryViews
                views={vistas.map(({ valor, etiqueta }) => ({
                  label: etiqueta,
                  active: (filtro.valores.estado ?? '') === valor,
                  count: actividades.filter((a) => !valor || a.estado === valor).length,
                  onClick: () => filtro.setValores((actual) => ({ ...actual, estado: valor })),
                }))}
              />
            }
          />
          <DataTable
            rows={filtro.filtrados}
            columns={columnas}
            caption="Actividades del plan de tutoría"
            rowKey={(a) => a.id}
            pagination="auto"
            paginationPosition="bottom"
            inlineActions
            emptyTitle={filtro.activos ? 'Sin coincidencias' : 'Sin actividades registradas'}
            emptyDescription={filtro.activos ? 'Ajusta la búsqueda o los filtros.' : undefined}
          />
        </CardBody>
      </Card>

      {API_MODE && (
        <Card>
          <CardHead
            title="Informe del semestre"
            description={
              portal.institucional
                ? 'Selecciona una escuela en Ámbito para preparar su Formato 01.'
                : 'Formato 01 · Actividades del proceso tutorial'
            }
            actions={
              portal.institucional ? (
                <Link className="btn btn-falcon-default" to="/coordinacion/revisiones">
                  Ver informes
                </Link>
              ) : (
                <>
                  <StatusBadge estado={plan?.estado ?? 'no-iniciado'} contexto="formulario" />
                  <button
                    type="button"
                    className="btn btn-falcon-default"
                    disabled={creando || !sistema}
                    onClick={() => void abrirInforme()}
                  >
                    {creando ? 'Preparando…' : plan ? 'Abrir formato 01' : 'Preparar formato 01'}
                  </button>
                </>
              )
            }
          />
          {error && (
            <CardBody>
              <Alert tone="riesgo" title="No se pudo abrir el informe">
                {error}
              </Alert>
            </CardBody>
          )}
        </Card>
      )}

      {(panel === 'nueva' || seleccionada) && (
        <Sheet
          title={panel === 'nueva' ? 'Nueva actividad' : (seleccionada?.actividad ?? 'Actividad')}
          description={
            seleccionada
              ? `${formatFecha(seleccionada.fechaInicio)} – ${formatFecha(seleccionada.fechaFin)}`
              : undefined
          }
          onClose={cerrarActividad}
          className="coord-form-sheet coord-plan-sheet"
          wide
        >
          {API_MODE ? (
            <EditorActividad
              key={editable?.id ?? 'nueva'}
              actividad={editable}
              escuelaId={editable?.escuelaId ?? escuelaId}
              onCerrar={cerrarActividad}
            />
          ) : (
            seleccionada && (
              <dl className="def-list">
                <div>
                  <dt>Responsable</dt>
                  <dd>{seleccionada.responsable}</dd>
                </div>
                <div>
                  <dt>Estado</dt>
                  <dd>
                    <StatusBadge estado={seleccionada.estado} /> · {seleccionada.avance}%
                  </dd>
                </div>
                <div>
                  <dt>Problemática</dt>
                  <dd>{seleccionada.problematica}</dd>
                </div>
                <div>
                  <dt>Objetivo</dt>
                  <dd>{seleccionada.objetivo}</dd>
                </div>
                <div>
                  <dt>Meta</dt>
                  <dd>{seleccionada.meta}</dd>
                </div>
                <div>
                  <dt>Evidencia</dt>
                  <dd>{seleccionada.evidencia || 'Sin registrar'}</dd>
                </div>
                <div>
                  <dt>Aprobación</dt>
                  <dd>{seleccionada.aprobacion || 'Sin registrar'}</dd>
                </div>
              </dl>
            )
          )}
        </Sheet>
      )}
      {panel === 'calendario' && (
        <Sheet title="Calendario del plan" wide onClose={() => setPanel(null)}>
          <Calendar
            eventos={eventos}
            etiqueta="Actividades del plan de tutoría"
            vistaInicial="mes"
            maxPorDia={2}
            onAbrir={(evento) => {
              setPanel(null);
              setActividadId(evento.id.replace(/-(inicio|fin)$/, ''));
            }}
          />
        </Sheet>
      )}
      {panel === 'informe' && plan && (
        <Sheet
          title="Informe del semestre"
          description="Formato 01"
          wide
          onClose={() => setPanel(null)}
        >
          <div className="stack">
            <div className="directory-controls">
              <EtapaSelector momento={momento} />
              <Badge tone="info">{semestreActual}</Badge>
            </div>
            <GuidedInstrumentForm
              key={plan.id}
              definicion={definicionPorCodigo('F01')!}
              instrumento={plan}
              editable={!['enviado', 'aprobado'].includes(plan.estado)}
              puedeEnviar={puedeEnviarFormato('F01', momento)}
              compacto
              onGuardar={(respuestas, enviar, version) =>
                guardarFormularioApi(plan, respuestas, enviar, version ?? plan.version)
              }
            />
          </div>
        </Sheet>
      )}
    </DirectoryPage>
  );
}
