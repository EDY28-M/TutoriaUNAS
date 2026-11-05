import { Link } from 'react-router-dom';
import { definicionPorCodigo } from '../../data/formatos';
import { etapaAcademica, etapaDeCiclo } from '../../data/catalogos';
import type { Instrumento, Sesion } from '../../types/domain';
import { formatFecha } from '../../utils/fechas';
import {
  avanceInstrumento,
  contextualizarDefinicion,
  precargarInstrumentoConOrigen,
} from '../../utils/instrumentos';
import { esEvaluacionSesion } from '../../utils/evaluacionesSesion';
import { porResponder, rutaFormulario } from '../../utils/formulariosEstudiante';
import type { FormularioEstudiante } from '../../utils/formulariosEstudiante';
import { Badge, StatusBadge } from '../ui/StatusBadge';
import { EmptyState } from '../ui/EmptyState';
import { ArrowRight, ChevronRight, CircleCheck, Clock } from '../ui/icons';
import '../../styles/student-forms.css';

export type FiltroFormularios = '' | 'pendiente' | 'observado' | 'entregado';

interface Props {
  formularios: FormularioEstudiante[];
  /** Todos los registros del estudiante: alimentan el avance precargado de la entrevista. */
  registros: Instrumento[];
  sesiones: Sesion[];
  ciclo: number | null;
  filtro: FiltroFormularios;
}

/** Día y mes de una fecha ISO, para la ficha de fecha de cada fila. */
function partesFecha(iso: string | null | undefined) {
  const [dia = '', mes = ''] = iso ? formatFecha(iso).split(' ') : [];
  return { dia, mes };
}

function Fecha({ iso, apagada = false }: { iso: string | null | undefined; apagada?: boolean }) {
  const { dia, mes } = partesFecha(iso);
  return (
    <span className={`sf-fecha${apagada ? ' sf-fecha--apagada' : ''}`} aria-hidden="true">
      <strong>{dia || '—'}</strong>
      <span>{mes}</span>
    </span>
  );
}

const tipoEvaluacion = (registro: Instrumento) =>
  registro.formato === 'F10' ? 'Tutoría individual' : 'Tutoría grupal';

function accion(f: FormularioEstudiante): string {
  if (f.disponibilidad === 'enviado') return 'Ver respuestas';
  if (f.disponibilidad === 'corregir') return 'Corregir';
  if (f.registro.estado === 'borrador') return 'Continuar';
  return esEvaluacionSesion(f.registro.formato) ? 'Evaluar' : 'Comenzar';
}

/** La entrevista inicial: la tarea principal del semestre, con su avance. */
function Entrevista({
  f,
  ciclo,
  avance,
}: {
  f: FormularioEstudiante;
  ciclo: number | null;
  avance: number;
}) {
  const { registro } = f;
  const etapa = ciclo === null ? null : etapaAcademica[etapaDeCiclo(ciclo)];
  const observacion = registro.observaciones.find((o) => o.estado === 'abierta')?.texto;
  const enviada = f.disponibilidad === 'enviado';
  const detalle = enviada
    ? registro.estado === 'aprobado'
      ? 'Tu tutor ya la revisó.'
      : `Enviada el ${formatFecha(registro.enviado)}. Tu tutor la revisará.`
    : f.disponibilidad === 'corregir'
      ? (observacion ?? 'Tu tutor pidió algunos cambios.')
      : 'Cuéntale a tu tutor cómo llegas a este semestre para preparar tu acompañamiento.';
  return (
    <Link
      to={rutaFormulario(registro)}
      className={`sf-entrevista${f.disponibilidad === 'corregir' ? ' sf-entrevista--corregir' : ''}`}
      data-instrument={registro.formato}
      data-state={registro.estado}
    >
      <span className="sf-entrevista__cuerpo">
        <span className="sf-eyebrow">
          Formato {registro.formato.slice(1)}
          {etapa && ` · ${etapa.ciclos}`}
        </span>
        <span className="sf-entrevista__titulo">Entrevista inicial</span>
        <span className="sf-entrevista__detalle">{detalle}</span>
        {!enviada && (
          <span className="sf-avance">
            <span
              className="sf-avance__barra"
              role="progressbar"
              aria-label="Avance de la entrevista"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={avance}
            >
              <span style={{ width: `${avance}%` }} />
            </span>
            <span className="sf-avance__valor">{avance} %</span>
          </span>
        )}
      </span>
      <span className="sf-entrevista__lado">
        <StatusBadge estado={registro.estado} contexto="formulario" />
        <span className={`btn ${enviada ? 'btn-falcon-default' : 'btn-primary'} sf-cta`}>
          {accion(f)} <ArrowRight aria-hidden="true" />
        </span>
      </span>
    </Link>
  );
}

/** Una evaluación (10 u 11) o un envío: una fila compacta con su fecha. */
function Fila({ f }: { f: FormularioEstudiante }) {
  const { registro, sesion } = f;
  const evaluacion = esEvaluacionSesion(registro.formato);
  const titulo = evaluacion
    ? `Evaluación · ${tipoEvaluacion(registro)}`
    : (definicionPorCodigo(registro.formato)?.nombre ?? 'Formulario');
  const detalle = sesion
    ? `${sesion.tema} · ${sesion.horaInicio}–${sesion.horaFin}`
    : `Formato ${registro.formato.slice(1)}`;
  const fecha = f.disponibilidad === 'enviado' && !sesion ? registro.enviado : sesion?.fecha;
  const esperando = f.disponibilidad === 'esperando';
  const contenido = (
    <>
      <Fecha iso={fecha} apagada={esperando} />
      <span className="sf-fila__cuerpo">
        <span className="sf-fila__titulo">{titulo}</span>
        <span className="sf-fila__detalle">{detalle}</span>
        {esperando && f.motivo && (
          <span className="sf-fila__motivo">
            <Clock aria-hidden="true" /> {f.motivo}
          </span>
        )}
      </span>
      {!esperando && (
        <span className="sf-fila__lado">
          {['borrador', 'observado'].includes(registro.estado) && (
            <StatusBadge estado={registro.estado} contexto="formulario" />
          )}
          {registro.estado === 'aprobado' && <Badge tone="ok">Revisado</Badge>}
          <span className="sf-fila__accion">
            {accion(f)} <ArrowRight aria-hidden="true" />
          </span>
        </span>
      )}
    </>
  );
  return (
    <li
      data-instrument={registro.formato}
      data-state={registro.estado}
      data-session={registro.sesionId ?? undefined}
    >
      {esperando ? (
        <div className="sf-fila sf-fila--espera">{contenido}</div>
      ) : (
        <Link className="sf-fila" to={rutaFormulario(registro)}>
          {contenido}
        </Link>
      )}
    </li>
  );
}

function Grupo({
  titulo,
  formularios,
  plegado = false,
  nota,
}: {
  titulo: string;
  formularios: FormularioEstudiante[];
  plegado?: boolean;
  nota?: string;
}) {
  if (!formularios.length) return null;
  const lista = (
    <ul className="sf-lista">
      {formularios.map((f) => (
        <Fila key={f.registro.id} f={f} />
      ))}
    </ul>
  );
  if (plegado)
    return (
      <details className="sf-grupo sf-grupo--plegado">
        <summary>
          <span>{titulo}</span>
          <span className="sf-grupo__cantidad">{formularios.length}</span>
          <ChevronRight className="sf-grupo__chevron" aria-hidden="true" />
        </summary>
        {nota && <p className="sf-grupo__nota">{nota}</p>}
        {lista}
      </details>
    );
  return (
    <section className="sf-grupo" aria-label={titulo}>
      <h2 className="sf-grupo__titulo">
        {titulo} <span className="sf-grupo__cantidad">{formularios.length}</span>
      </h2>
      {lista}
    </section>
  );
}

/**
 * Bandeja del tutorado ordenada por lo que puede hacer ahora: primero lo que
 * debe responder; lo que aún no se habilita y lo enviado quedan plegados.
 */
export function StudentFormsPanel({ formularios, registros, sesiones, ciclo, filtro }: Props) {
  const entrevista = formularios.find((f) => !esEvaluacionSesion(f.registro.formato));
  const evaluaciones = formularios.filter((f) => esEvaluacionSesion(f.registro.formato));
  const avance = entrevista
    ? entrevista.registro.estado === 'no-iniciado'
      ? 0
      : avanceInstrumento(
          contextualizarDefinicion(
            definicionPorCodigo(entrevista.registro.formato)!,
            entrevista.registro,
          ),
          precargarInstrumentoConOrigen(entrevista.registro, sesiones, registros).valores,
        )
    : 0;

  const visibleEntrevista =
    entrevista &&
    (filtro === ''
      ? entrevista.disponibilidad !== 'enviado'
      : filtro === 'pendiente'
        ? porResponder(entrevista)
        : filtro === 'observado'
          ? entrevista.disponibilidad === 'corregir'
          : false);
  const porEvaluar = evaluaciones.filter((f) =>
    filtro === 'observado' ? f.disponibilidad === 'corregir' : porResponder(f),
  );
  const esperando = evaluaciones.filter((f) => f.disponibilidad === 'esperando');
  const enviados = formularios.filter((f) => f.disponibilidad === 'enviado');

  if (filtro === 'entregado')
    return enviados.length ? (
      <div className="sf-panel">
        <Grupo titulo="Enviados" formularios={enviados} />
      </div>
    ) : (
      <EmptyState
        title="Aún no envías formularios"
        description="Cuando envíes tu entrevista o una evaluación, la verás aquí."
      />
    );

  const nada = !visibleEntrevista && !porEvaluar.length;
  return (
    <div className="sf-panel">
      {ciclo === null && filtro !== 'observado' && (
        <p className="sf-aviso-ciclo">
          Tu entrevista inicial aparecerá cuando coordinación confirme tu ciclo.
        </p>
      )}
      {visibleEntrevista && <Entrevista f={entrevista} ciclo={ciclo} avance={avance} />}
      {porEvaluar.length > 0 && (
        <Grupo
          titulo={filtro === 'observado' ? 'Por corregir' : 'Evaluaciones por responder'}
          formularios={porEvaluar}
        />
      )}
      {nada && (
        <div className="sf-al-dia">
          <EmptyState
            icon={<CircleCheck aria-hidden="true" />}
            title={filtro === 'observado' ? 'Nada por corregir' : 'Estás al día'}
            description={
              filtro === 'observado'
                ? 'Tu tutor no pidió cambios en tus formularios.'
                : 'Cuando tu tutor confirme la asistencia de una sesión, su evaluación aparecerá aquí.'
            }
          />
        </div>
      )}
      {filtro === '' && (
        <>
          <Grupo
            titulo="Se habilitan más adelante"
            formularios={esperando}
            plegado
            nota="Cada evaluación se activa cuando termina la sesión y tu tutor confirma tu asistencia."
          />
          <Grupo titulo="Enviados" formularios={enviados} plegado />
        </>
      )}
    </div>
  );
}
