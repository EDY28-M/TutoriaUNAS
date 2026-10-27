import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { bloqueoEvaluacion } from '../../utils/evaluacionesSesion';
import { formatFecha } from '../../utils/fechas';
import { useAuth } from '../../hooks/useAuth';
import { usePortal } from '../../hooks/usePortal';
import { useInstrumentWorkspace } from '../../hooks/useInstrumentWorkspace';
import { guardarInstrumento, revisarInstrumento } from '../../services/instrumentWorkspace';
import { definicionPorCodigo } from '../../data/formatos';
import { estudiantePorId, nombreCompleto } from '../../data/personas';
import { semestreActual } from '../../data/catalogos';
import type { CodigoFormato, Instrumento } from '../../types/domain';
import { etapaDeFormato, fechaTutoria, puedeEnviarFormato } from '../../utils/instrumentos';
import { StatusBadge } from '../ui/StatusBadge';
import { EmptyState } from '../ui/EmptyState';
import { Alert } from '../ui/Alert';
import { Sheet } from '../ui/Sheet';
import { SearchableSelect } from '../ui/SearchableSelect';
import { ArrowRight, Check, CircleCheck } from '../ui/icons';
import { GuidedInstrumentForm } from './GuidedInstrumentForm';
import { StudentFormsPanel } from './StudentFormsPanel';
import { TeacherFormsPanel } from './TeacherFormsPanel';
import { tituloFormulario } from './teacherFormTasks';
import '../../styles/tutoring-workspace.css';

/** Bandejas por responsable, con un solo registro compartido entre portales. */
export function TutoringWorkspace() {
  const { user } = useAuth();
  const portal = usePortal();
  const workspace = useInstrumentWorkspace();
  const [parametros, setParametros] = useSearchParams();
  const docente = user?.role === 'tutor';
  const [abierto, setAbierto] = useState<Instrumento | null>(null);
  const [nuevo, setNuevo] = useState<CodigoFormato | null>(null);
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [comentario, setComentario] = useState('');
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const registros = portal.instrumentos;
  const propios = registros.filter((r) =>
    docente ? definicionPorCodigo(r.formato)?.actor === 'tutor' : true,
  );
  const solicitado = parametros.get('sesion');
  const actual = abierto
    ? (registros.find((r) => r.id === abierto.id) ?? abierto)
    : solicitado
      ? (registros.find((r) => r.sesionId === solicitado && ['F10', 'F11'].includes(r.formato)) ??
        null)
      : null;
  const sesionActual = portal.sesiones.find((s) => s.id === actual?.sesionId);
  function cerrarFormulario() {
    setAbierto(null);
    const nuevos = new URLSearchParams(parametros);
    nuevos.delete('sesion');
    setParametros(nuevos, { replace: true });
  }
  const definicion = actual ? definicionPorCodigo(actual.formato) : null;
  const esPropio = Boolean(
    actual &&
    user &&
    (definicion?.actor === 'tutorado'
      ? actual.estudianteId === user.id
      : actual.tutorId === user.id && definicion?.actor === 'tutor'),
  );
  const esEvaluacion = Boolean(actual && ['F10', 'F11'].includes(actual.formato));
  const bloqueo = esEvaluacion ? bloqueoEvaluacion(sesionActual, user?.id ?? '') : null;
  const editar = Boolean(
    actual &&
    esPropio &&
    !['enviado', 'aprobado'].includes(actual.estado) &&
    !bloqueo &&
    puedeEnviarFormato(actual.formato, workspace.momento),
  );
  const puedeRevisar = Boolean(
    actual &&
    docente &&
    actual.tutorId === user?.id &&
    actual.estado === 'enviado' &&
    ['F03', 'F04', 'F05'].includes(actual.formato),
  );
  const tutorados = portal.tutorados.map((a) => estudiantePorId(a.estudianteId)).filter((e) => !!e);

  if (!user || (docente ? !portal.docente : !portal.estudiante))
    return (
      <EmptyState
        title="No encontramos tu ficha de tutoría"
        description="Revisa la cuenta con la que ingresaste."
      />
    );
  function abrir(registro: Instrumento) {
    setAbierto(registro);
    setComentario('');
    setError('');
  }
  function preparar(codigo: CodigoFormato) {
    const existente = propios.find((r) => r.formato === codigo && ['F02', 'F09'].includes(codigo));
    if (existente) {
      abrir(existente);
      return;
    }
    setNuevo(codigo);
    setSeleccionados([]);
    setError('');
  }
  function crear() {
    if (!nuevo || !user || !seleccionados.length) {
      setError('Selecciona al estudiante o a los participantes atendidos.');
      return;
    }
    const estudianteId = nuevo === 'F07' ? null : seleccionados[0]!;
    const respuestas: Record<string, string> = {};
    if (nuevo === 'F07')
      respuestas.grupo = [
        ...new Set(
          seleccionados
            .map((id) => portal.tutorados.find((a) => a.estudianteId === id)?.grupo)
            .filter(Boolean),
        ),
      ].join(', ');
    if (nuevo === 'F06' || nuevo === 'F07')
      respuestas.asistentes = JSON.stringify(
        seleccionados.map((id) => {
          const estudiante = estudiantePorId(id)!;
          return {
            estudianteId: id,
            nombre: nombreCompleto(estudiante),
            ciclo: String(estudiante.ciclo),
            grupo: portal.tutorados.find((a) => a.estudianteId === id)?.grupo ?? '',
            tipo: 'Académica',
          };
        }),
      );
    abrir({
      id: `INST-${nuevo}-${crypto.randomUUID()}`,
      formato: nuevo,
      semestreId: semestreActual,
      tutorId: user.id,
      estudianteId,
      sesionId: null,
      estado: 'no-iniciado',
      avance: 0,
      version: 1,
      creado: fechaTutoria(),
      actualizado: fechaTutoria(),
      enviado: null,
      revisadoPor: null,
      observaciones: [],
      descargaDisponible: false,
      respuestas,
    });
    setNuevo(null);
  }
  function guardar(respuestas: Record<string, string>, enviar: boolean) {
    if (!actual || !user) return;
    const guardado = guardarInstrumento(actual, respuestas, user, enviar);
    if (enviar) {
      cerrarFormulario();
      setAviso(
        definicion?.actor === 'tutorado'
          ? esEvaluacion
            ? 'Evaluación enviada. Su estado ya se actualizó en el seguimiento.'
            : 'Entrevista enviada a tu docente tutor para su revisión.'
          : actual.formato === 'F08' && respuestas.resultado === 'Se deriva a:'
            ? 'Atención registrada. Se preparó un borrador del formato 12: revísalo y envíalo desde Mis registros.'
            : actual.formato === 'F08' &&
                respuestas.resultado === 'Se programa nueva cita para seguimiento'
              ? 'Atención registrada. La nueva cita ya aparece en Sesiones de ambos roles.'
              : 'Formulario enviado. El seguimiento de tutoría se actualizó.',
      );
    } else setAbierto(guardado);
  }
  function revisar(decision: 'aprobado' | 'observado') {
    if (!actual || !user) return;
    try {
      revisarInstrumento(actual.id, user, decision, comentario);
      cerrarFormulario();
      setAviso(
        decision === 'aprobado'
          ? 'Entrevista revisada. El estudiante verá el estado actualizado.'
          : 'Corrección solicitada. El estudiante ya puede actualizar su entrevista.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la revisión.');
    }
  }
  return (
    <div className="tutoring-workspace tutoring-workspace--compact">
      {solicitado && !actual && (
        <Alert tone="alerta" title="Evaluación no disponible">
          La sesión no existe o no estás convocado a ella. Revisa tu calendario de sesiones.
        </Alert>
      )}
      {workspace.aviso && (
        <Alert tone="alerta" title="Guardado en el navegador">
          {workspace.aviso}
        </Alert>
      )}
      {aviso && (
        <div className="tutoring-notice" role="status">
          <CircleCheck aria-hidden="true" />
          <span>{aviso}</span>
          <button
            className="btn btn-link"
            type="button"
            aria-label="Cerrar aviso"
            onClick={() => setAviso('')}
          >
            Cerrar
          </button>
        </div>
      )}
      {docente ? (
        <TeacherFormsPanel
          registros={registros}
          tutorados={tutorados}
          momento={workspace.momento}
          sesiones={portal.sesiones}
          onAbrir={abrir}
          onPreparar={preparar}
        />
      ) : (
        <StudentFormsPanel
          registros={propios}
          ciclo={portal.estudiante!.ciclo}
          momento={workspace.momento}
          sesiones={portal.sesiones}
          onAbrir={abrir}
        />
      )}
      {nuevo && (
        <Sheet
          title={`Formato ${nuevo.slice(1)} · ${tituloFormulario(nuevo)}`}
          description={
            nuevo === 'F07'
              ? 'Marca a los estudiantes que participaron.'
              : 'Selecciona al estudiante al que atendiste.'
          }
          onClose={() => setNuevo(null)}
          footer={
            <button
              type="button"
              className="btn btn-primary"
              onClick={crear}
              disabled={!seleccionados.length}
            >
              Continuar <ArrowRight aria-hidden="true" />
            </button>
          }
        >
          {error && (
            <Alert tone="riesgo" title="Revisa la selección">
              {error}
            </Alert>
          )}
          {nuevo === 'F07' ? (
            <fieldset className="tutoring-roster">
              <legend>Participantes atendidos</legend>
              {tutorados.map((e) => (
                <label key={e.id}>
                  <input
                    type="checkbox"
                    checked={seleccionados.includes(e.id)}
                    onChange={() =>
                      setSeleccionados((actual) =>
                        actual.includes(e.id)
                          ? actual.filter((id) => id !== e.id)
                          : [...actual, e.id],
                      )
                    }
                  />
                  <span>
                    {nombreCompleto(e)}
                    <small>
                      {e.codigo} · Ciclo {e.ciclo}
                    </small>
                  </span>
                </label>
              ))}
            </fieldset>
          ) : ['F06', 'F08', 'F12'].includes(nuevo) ? (
            <SearchableSelect
              label="Estudiante"
              placeholder="Escribe un nombre o código"
              options={tutorados.map((e) => ({
                value: e.id,
                label: nombreCompleto(e),
                description: `${e.codigo} · Ciclo ${e.ciclo}`,
              }))}
              value={seleccionados[0] ?? ''}
              onChange={(id) => setSeleccionados(id ? [id] : [])}
            />
          ) : (
            <div className="field">
              <label htmlFor="estudiante-formato">Estudiante</label>
              <select
                id="estudiante-formato"
                className="select"
                value={seleccionados[0] ?? ''}
                onChange={(e) => setSeleccionados(e.target.value ? [e.target.value] : [])}
              >
                <option value="">Selecciona un estudiante</option>
                {tutorados.map((e) => (
                  <option value={e.id} key={e.id}>
                    {nombreCompleto(e)} · {e.codigo}
                  </option>
                ))}
              </select>
            </div>
          )}
          {!tutorados.length && (
            <EmptyState
              title="Aún no tienes estudiantes asignados"
              description="Coordinación debe registrar las asignaciones antes de una atención."
            />
          )}
        </Sheet>
      )}
      {actual && definicion && (
        <Sheet
          title={`Formato ${definicion.numero} · ${docente ? tituloFormulario(actual.formato) : esEvaluacion ? (actual.formato === 'F10' ? 'Tutoría individual' : 'Tutoría grupal') : 'Entrevista inicial'}`}
          wide
          onClose={cerrarFormulario}
        >
          <div className="tutoring-dialog-meta">
            <StatusBadge estado={actual.estado} contexto="formulario" />
            <span>
              {definicion.actorEtiqueta} · {actual.semestreId}
            </span>
          </div>
          {esEvaluacion && sesionActual && (
            <p className="forms-panel__context">
              {sesionActual.tema} · {formatFecha(sesionActual.fecha)} · {sesionActual.horaInicio}–
              {sesionActual.horaFin} · {sesionActual.codigo}. Los datos de la sesión ya están
              completados.
            </p>
          )}
          {actual.observaciones.some((o) => o.estado === 'abierta') && (
            <Alert tone="alerta" title="Correcciones solicitadas">
              {actual.observaciones
                .filter((o) => o.estado === 'abierta')
                .map((o) => (
                  <p key={o.id}>{o.texto}</p>
                ))}
            </Alert>
          )}
          {esPropio && !editar && !['enviado', 'aprobado'].includes(actual.estado) && (
            <Alert tone={esEvaluacion ? 'alerta' : 'info'} title="Vista previa">
              {bloqueo ??
                (etapaDeFormato(actual.formato) === 'inicio'
                  ? 'La entrevista inicial se responde al inicio del semestre. Puedes revisar las preguntas.'
                  : 'Podrás responder al cierre del semestre. Puedes revisar las preguntas.')}
            </Alert>
          )}
          <GuidedInstrumentForm
            key={actual.id}
            definicion={definicion}
            instrumento={actual}
            compacto
            editable={editar}
            puedeEnviar={!bloqueo && puedeEnviarFormato(actual.formato, workspace.momento)}
            onGuardar={editar ? guardar : undefined}
          />
          {puedeRevisar && (
            <div className="tutoring-review-actions">
              <h3>Revisión de la entrevista</h3>
              <label htmlFor="comentario-revision">
                ¿Qué debe corregir el estudiante?
                <textarea
                  id="comentario-revision"
                  className="textarea"
                  rows={3}
                  maxLength={600}
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  placeholder="Solo es necesario si solicitas una corrección."
                />
              </label>
              {error && (
                <p className="field__error" role="alert">
                  {error}
                </p>
              )}
              <div className="tutoring-form__actions">
                <button
                  type="button"
                  className="btn btn-falcon-default"
                  onClick={() => revisar('observado')}
                >
                  Pedir corrección
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => revisar('aprobado')}
                >
                  <Check aria-hidden="true" /> Marcar como revisada
                </button>
              </div>
            </div>
          )}
        </Sheet>
      )}
    </div>
  );
}
