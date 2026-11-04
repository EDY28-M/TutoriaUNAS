import { useSearchParams } from 'react-router-dom';
import { definicionPorCodigo } from '../../data/formatos';
import type { Instrumento, Sesion } from '../../types/domain';
import { bloqueoEvaluacion, esEvaluacionSesion } from '../../utils/evaluacionesSesion';
import { formatFecha } from '../../utils/fechas';
import { etapaAcademica, etapaDeCiclo, semestreActual } from '../../data/catalogos';
import {
  avanceInstrumento,
  contextualizarDefinicion,
  precargarInstrumentoConOrigen,
  formatoInicial,
  puedeEnviarFormato,
} from '../../utils/instrumentos';
import { formulariosVigentes, tituloEntrevista } from '../../utils/entrevistas';
import type { MomentoTutoria } from '../../utils/instrumentos';
import { Badge, StatusBadge } from '../ui/StatusBadge';
import { EmptyState } from '../ui/EmptyState';
import { Progress } from '../ui/Progress';
import { ArrowRight, CircleCheck, ClipboardList, Eye, UserRound, UsersRound } from '../ui/icons';
import { FormsFilters, FormsPanel } from '../ui/FormsPanel';

interface Props {
  registros: Instrumento[];
  ciclo: number | null;
  momento: MomentoTutoria;
  sesiones?: Sesion[];
  onAbrir(registro: Instrumento): void;
}

const FILTROS = [
  { id: '', nombre: 'Todos' },
  { id: 'pendiente', nombre: 'Pendientes' },
  { id: 'observado', nombre: 'Por corregir' },
  { id: 'entregado', nombre: 'Enviados' },
] as const;

/** Una tarea principal y evaluaciones breves, con el mismo estado que la navegación. */
export function StudentFormsPanel({ registros, ciclo, momento, onAbrir, sesiones = [] }: Props) {
  const [parametros, setParametros] = useSearchParams();
  const filtro = parametros.get('estado') ?? '';
  const formularios = formulariosVigentes(registros, ciclo, semestreActual).filter(
    (r) =>
      (ciclo !== null && r.formato === formatoInicial(ciclo)) || ['F10', 'F11'].includes(r.formato),
  );
  const coincide = (registro: Instrumento, estado: string) => {
    if (estado === 'pendiente')
      return (
        ['no-iniciado', 'borrador', 'observado'].includes(registro.estado) &&
        puedeEnviarFormato(registro.formato, momento) &&
        (!esEvaluacionSesion(registro.formato) ||
          !bloqueoEvaluacion(
            sesiones.find((s) => s.id === registro.sesionId),
            registro.estudianteId ?? '',
          ))
      );
    if (estado === 'entregado') return ['enviado', 'aprobado'].includes(registro.estado);
    return !estado || registro.estado === estado;
  };
  const etapaActual = ciclo === null ? null : etapaAcademica[etapaDeCiclo(ciclo)];
  const visibles = formularios.filter((r) => coincide(r, filtro));
  const entrevistas = visibles.filter((r) => ciclo !== null && r.formato === formatoInicial(ciclo));
  const evaluaciones = visibles
    .filter((r) => esEvaluacionSesion(r.formato))
    .sort((a, b) =>
      (sesiones.find((s) => s.id === b.sesionId)?.fecha ?? '').localeCompare(
        sesiones.find((s) => s.id === a.sesionId)?.fecha ?? '',
      ),
    );
  const pendientes = formularios.filter((r) => coincide(r, 'pendiente')).length;
  function filtrar(estado: string) {
    const nuevos = new URLSearchParams(parametros);
    if (estado) nuevos.set('estado', estado);
    else nuevos.delete('estado');
    setParametros(nuevos);
  }
  function tarjeta(registro: Instrumento, entrevista = false) {
    const def = definicionPorCodigo(registro.formato)!;
    const avance = entrevista
      ? avanceInstrumento(
          contextualizarDefinicion(def, registro),
          precargarInstrumentoConOrigen(registro, sesiones, registros).valores,
        )
      : registro.avance;
    const entregado = ['enviado', 'aprobado'].includes(registro.estado);
    const sesion = sesiones.find((s) => s.id === registro.sesionId);
    const bloqueo = entrevista ? null : bloqueoEvaluacion(sesion, registro.estudianteId ?? '');
    const bloqueado =
      !entregado && (!puedeEnviarFormato(registro.formato, momento) || Boolean(bloqueo));
    const accion = entregado
      ? 'Ver respuestas'
      : bloqueado
        ? 'Ver preguntas'
        : registro.estado === 'observado'
          ? 'Corregir entrevista'
          : registro.estado === 'borrador'
            ? 'Continuar'
            : 'Comenzar';
    return (
      <article
        className={`form-tile${entrevista ? ' form-tile--featured' : ''}`}
        key={registro.id}
        data-instrument={registro.formato}
        data-state={registro.estado}
        data-session={registro.sesionId ?? undefined}
      >
        <div className="form-tile__top">
          <span className="form-tile__icon">
            {entrevista ? (
              <ClipboardList aria-hidden="true" />
            ) : registro.formato === 'F10' ? (
              <UserRound aria-hidden="true" />
            ) : (
              <UsersRound aria-hidden="true" />
            )}
          </span>
          {bloqueado ? (
            <Badge>Pendiente de asistencia</Badge>
          ) : (
            <StatusBadge estado={registro.estado} contexto="formulario" />
          )}
        </div>
        <div className="form-tile__content">
          <span className="form-tile__eyebrow">
            {entrevista
              ? `Formato ${def.numero} · ${etapaActual?.ciclos ?? 'Ciclo pendiente'}`
              : `Evaluación · Formato ${def.numero}`}
          </span>
          <h2>
            {entrevista
              ? tituloEntrevista(registro.formato)
              : registro.formato === 'F10'
                ? 'Tutoría individual'
                : 'Tutoría grupal'}
          </h2>
          {!entrevista && sesion && (
            <p>
              {sesion.tema}
              <br />
              {formatFecha(sesion.fecha)} · {sesion.horaInicio}–{sesion.horaFin} · {sesion.codigo}
            </p>
          )}
          {!entrevista && bloqueado && <p className="small muted">{bloqueo}</p>}
        </div>
        {entrevista && (
          <div className="form-tile__progress">
            <Progress valor={avance} etiqueta="Datos completos" />
          </div>
        )}
        <div className="form-tile__action">
          <button
            type="button"
            className={`btn ${entrevista && !entregado ? 'btn-primary' : 'btn-falcon-default'}`}
            onClick={() => onAbrir(registro)}
            aria-label={`${accion} · Formato ${def.numero}${!entrevista && sesion ? ` · ${sesion.codigo}` : ''}`}
          >
            {registro.estado === 'observado' && !bloqueado ? 'Corregir' : accion}
            {bloqueado || entregado ? (
              <Eye aria-hidden="true" />
            ) : (
              <ArrowRight aria-hidden="true" />
            )}
          </button>
        </div>
      </article>
    );
  }
  return (
    <FormsPanel
      title="Mis formularios"
      status={
        pendientes
          ? `${pendientes} ${pendientes === 1 ? 'pendiente' : 'pendientes'}`
          : 'Todo al día'
      }
      momento={momento}
      etapaEnFiltros
      className="student-forms"
    >
      <FormsFilters
        label="Filtrar mis formularios"
        options={FILTROS.map((f) => ({
          ...f,
          cantidad: formularios.filter((r) => coincide(r, f.id)).length,
        }))}
        value={filtro}
        onChange={filtrar}
        acciones={
          <span className="small muted">
            Ciclo {ciclo ?? 'sin informar'} · {semestreActual}
          </span>
        }
      />
      <p className="forms-panel__context">
        {ciclo === null
          ? 'Coordinación debe confirmar tu ciclo para habilitar la entrevista.'
          : 'Completa las preguntas pendientes.'}
      </p>
      <div className="forms-panel__results">
        {entrevistas.map((r) => tarjeta(r, true))}
        {evaluaciones.length > 0 && (
          <section className="forms-panel__evaluations" aria-labelledby="student-evaluations-title">
            <div className="forms-panel__section-heading">
              <h2 id="student-evaluations-title">Evaluaciones</h2>
              <span>Una evaluación por cada sesión asistida</span>
            </div>
            <div className="forms-panel__grid">{evaluaciones.map((r) => tarjeta(r))}</div>
          </section>
        )}
        {!visibles.length && (
          <div className="forms-panel__empty">
            <EmptyState
              title={
                filtro === 'observado'
                  ? 'Sin correcciones pendientes'
                  : filtro === 'entregado'
                    ? 'Aún no hay envíos'
                    : 'Sin formularios pendientes'
              }
              description={
                filtro === 'observado'
                  ? 'Tus formularios no necesitan cambios.'
                  : 'Consulta tus formularios en la vista Todos.'
              }
              icon={<CircleCheck aria-hidden="true" />}
            />
            <button className="btn btn-falcon-default" type="button" onClick={() => filtrar('')}>
              Ver todos
            </button>
          </div>
        )}
      </div>
    </FormsPanel>
  );
}
