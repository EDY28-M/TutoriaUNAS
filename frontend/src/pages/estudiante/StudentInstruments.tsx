import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeading } from '../../components/ui/PageHeading';
import { FormsFilters } from '../../components/ui/FormsPanel';
import { Alert } from '../../components/ui/Alert';
import { EmptyState } from '../../components/ui/EmptyState';
import { CircleCheck } from '../../components/ui/icons';
import { StudentFormsPanel } from '../../components/panels/StudentFormsPanel';
import type { FiltroFormularios } from '../../components/panels/StudentFormsPanel';
import { usePortal } from '../../hooks/usePortal';
import { useInstrumentWorkspace } from '../../hooks/useInstrumentWorkspace';
import { semestreActual } from '../../data/catalogos';
import { esEvaluacionSesion } from '../../utils/evaluacionesSesion';
import {
  formulariosDelEstudiante,
  porResponder,
  rutaFormulario,
} from '../../utils/formulariosEstudiante';
import '../../styles/student-forms.css';

const FILTROS: { id: FiltroFormularios; nombre: string }[] = [
  { id: '', nombre: 'Todos' },
  { id: 'pendiente', nombre: 'Pendientes' },
  { id: 'observado', nombre: 'Por corregir' },
  { id: 'entregado', nombre: 'Enviados' },
];

const esFiltro = (valor: string | null): valor is FiltroFormularios =>
  FILTROS.some((f) => f.id === valor);

/** Mis formularios: lo que el tutorado debe responder ahora, sin ruido. */
export function StudentInstruments() {
  const portal = usePortal();
  const workspace = useInstrumentWorkspace();
  const [parametros, setParametros] = useSearchParams();
  const location = useLocation();
  const navegar = useNavigate();
  const estado = parametros.get('estado');
  const filtro: FiltroFormularios = esFiltro(estado) ? estado : '';
  const aviso = (location.state as { aviso?: string } | null)?.aviso;

  // Enlaces anteriores («Evaluar» desde Sesiones) abren directamente la página del formulario.
  const sesionPedida = parametros.get('sesion');
  if (sesionPedida) {
    const evaluacion = portal.instrumentos.find(
      (r) => r.sesionId === sesionPedida && esEvaluacionSesion(r.formato),
    );
    if (evaluacion) return <Navigate replace to={rutaFormulario(evaluacion)} />;
  }

  const estudiante = portal.estudiante;
  if (!estudiante)
    return (
      <EmptyState
        title="No encontramos tu ficha de tutoría"
        description="Revisa la cuenta con la que ingresaste."
      />
    );

  const formularios = formulariosDelEstudiante(
    portal.instrumentos,
    estudiante.ciclo,
    portal.sesiones,
    workspace.momento,
  );
  const pendientes = formularios.filter(porResponder).length;
  const cantidad: Record<FiltroFormularios, number> = {
    '': formularios.length,
    pendiente: pendientes,
    observado: formularios.filter((f) => f.disponibilidad === 'corregir').length,
    entregado: formularios.filter((f) => f.disponibilidad === 'enviado').length,
  };

  function filtrar(id: string) {
    const nuevos = new URLSearchParams(parametros);
    if (id) nuevos.set('estado', id);
    else nuevos.delete('estado');
    nuevos.delete('sesion');
    setParametros(nuevos);
  }

  return (
    <div className="sf-pagina">
      <PageHeading
        eyebrow="Mi tutoría"
        title="Mis formularios"
        description={`${
          pendientes
            ? `Tienes ${pendientes} ${pendientes === 1 ? 'formulario' : 'formularios'} por responder.`
            : 'Estás al día con tus formularios.'
        } Ciclo ${estudiante.ciclo ?? 'sin informar'} · ${semestreActual}.`}
        actions={
          <span className={`sf-pill${pendientes ? '' : ' sf-pill--ok'}`}>
            {pendientes ? `${pendientes} por responder` : 'Al día'}
          </span>
        }
      />

      {aviso && (
        <div className="tutoring-notice sf-notice" role="status">
          <CircleCheck aria-hidden="true" />
          <span>{aviso}</span>
          <button
            className="btn btn-link"
            type="button"
            onClick={() =>
              navegar(`${location.pathname}${location.search}`, { replace: true, state: null })
            }
          >
            Cerrar
          </button>
        </div>
      )}
      {workspace.aviso && (
        <Alert tone="alerta" title="No se pudo actualizar la información">
          {workspace.aviso}
        </Alert>
      )}
      {sesionPedida && (
        <Alert tone="alerta" title="Evaluación no disponible">
          La sesión no existe o no estás convocado a ella. Revisa tu calendario de sesiones.
        </Alert>
      )}

      <FormsFilters
        label="Filtrar mis formularios"
        options={FILTROS.map((f) => ({ ...f, cantidad: cantidad[f.id] }))}
        value={filtro}
        onChange={filtrar}
      />

      <StudentFormsPanel
        formularios={formularios}
        registros={portal.instrumentos}
        sesiones={portal.sesiones}
        ciclo={estudiante.ciclo}
        filtro={filtro}
      />
    </div>
  );
}
