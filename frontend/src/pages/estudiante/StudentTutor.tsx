import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeading } from '../../components/ui/PageHeading';
import { Card, CardBody, CardHead } from '../../components/ui/Card';
import { Badge, StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { Sheet } from '../../components/ui/Sheet';
import { Alert } from '../../components/ui/Alert';
import { Field, TextArea } from '../../components/panels/Field';
import { usePortal } from '../../hooks/usePortal';
import { useSistema } from '../../hooks/useSistema';
import { API_MODE } from '../../services/apiConfig';
import { mutarSistema } from '../../services/apiSistema';
import { cursoPorId, nombreCurso } from '../../data/academico';
import { etapaAcademica, semestreActual } from '../../data/catalogos';
import { escuelaDe } from '../../data/personas';
import { formatFecha } from '../../utils/fechas';
import '../../assets/vendor/fontawesome.min.css';
import '../../styles/student-tutor.css';

/** Contacto del tutor y contexto de la asignación, con los detalles a demanda. */
export function StudentTutor() {
  const sistema = useSistema();
  const { estudiante, tutor, asignacion, escuelaId, instrumentos } = usePortal();
  const [solicitud, setSolicitud] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [enviadoLocal, setEnviado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const enviada = sistema?.solicitudesCambio.find((s) => s.estado === 'pendiente');
  const enviado = API_MODE ? !!enviada : enviadoLocal;

  if (!estudiante) {
    return (
      <EmptyState
        title="Sin datos del estudiante"
        description="La cuenta no tiene expediente asociado."
      />
    );
  }
  if (!tutor) {
    return (
      <>
        <PageHeading
          eyebrow="Estudiante · Mi tutoría"
          title="Mi tutor"
          description="Aún no se ha registrado la asignación tutorial de tu escuela."
        />
        <EmptyState
          title="Sin tutor asignado"
          description="La comisión de tutoría de tu escuela valida la asignación al inicio del semestre."
          icon={<i className="fa-solid fa-user-check" aria-hidden="true" />}
        />
      </>
    );
  }

  const etapa = estudiante.etapa === 'sin-informar' ? null : etapaAcademica[estudiante.etapa];
  const entrevista = instrumentos.find((instrumento) => instrumento.formato === etapa?.formato);
  const entrevistaEnviada = entrevista && ['enviado', 'aprobado'].includes(entrevista.estado);
  const historial = asignacion?.historial ?? [];
  const nombreTutor = `${tutor.nombres} ${tutor.apellidos}`;
  const iniciales = `${tutor.nombres.charAt(0)}${tutor.apellidos.charAt(0)}`;

  return (
    <div className="student-tutor">
      <PageHeading
        eyebrow="Estudiante · Mi tutoría"
        title="Mi tutor"
        description="Tu contacto para acompañarte durante el semestre."
        actions={
          <Link className="student-tutor__link" to="/estudiante/sesiones">
            Ver mis sesiones <i className="fa-solid fa-arrow-right" aria-hidden="true" />
          </Link>
        }
      />
      {enviado && (
        <div role="status">
          <Alert tone="ok" title="Solicitud registrada en la demostración">
            {API_MODE
              ? 'Tu solicitud está registrada y pendiente de revisión por coordinación.'
              : 'Tu solicitud queda en evaluación en esta sesión. No se envía ninguna solicitud real.'}
          </Alert>
        </div>
      )}

      <div className="student-tutor__layout">
        <div className="student-tutor__main">
          <Card className="student-tutor__profile">
            <CardBody>
              <div className="student-tutor__profile-top">
                <p className="student-tutor__label">Docente asignado</p>
                <Badge tone={tutor.activo ? 'ok' : 'neutro'}>
                  {tutor.activo ? 'Activo y habilitado' : 'Vínculo concluido'}
                </Badge>
              </div>
              <div className="student-tutor__identity">
                <span className="student-tutor__avatar" aria-hidden="true">
                  {iniciales}
                </span>
                <div>
                  <h2>{nombreTutor}</h2>
                  <p>
                    {tutor.categoria} · {tutor.dedicacion}
                  </p>
                  <span className="student-tutor__code">{tutor.codigo}</span>
                </div>
              </div>
              <dl className="student-tutor__contact">
                <div>
                  <dt>Correo institucional</dt>
                  <dd>
                    <a href={`mailto:${tutor.correo}`}>
                      <i className="fa-regular fa-envelope" aria-hidden="true" />
                      {tutor.correo}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt>Teléfono o anexo</dt>
                  <dd>
                    <a href={`tel:${tutor.telefono.replace(/[^+\d]/g, '')}`}>
                      <i className="fa-solid fa-phone" aria-hidden="true" />
                      {tutor.telefono}
                    </a>
                  </dd>
                </div>
                <div className="student-tutor__department">
                  <dt>Departamento</dt>
                  <dd>{tutor.departamento}</dd>
                </div>
              </dl>
              <div className="student-tutor__actions">
                <a className="btn btn-primary" href={`mailto:${tutor.correo}`}>
                  <i className="fa-regular fa-envelope" aria-hidden="true" /> Escribir por correo
                </a>
                <button
                  type="button"
                  className="student-tutor__link student-tutor__change"
                  disabled={enviado}
                  onClick={() => setSolicitud(true)}
                >
                  {enviado ? 'Solicitud enviada' : 'Solicitar cambio de tutor'}
                </button>
              </div>
            </CardBody>
          </Card>

          <Card className="student-tutor__courses">
            <CardHead
              title="Cursos que dicta"
              actions={<Badge>{tutor.cursosAsignados.length}</Badge>}
            />
            <CardBody flush>
              {tutor.cursosAsignados.length === 0 ? (
                <EmptyState
                  title="Sin cursos registrados"
                  description="La DIAA no reporta cursos asignados para este semestre."
                />
              ) : (
                <ul className="student-tutor__course-list">
                  {tutor.cursosAsignados.map((cursoId) => {
                    const curso = cursoPorId(cursoId);
                    return (
                      <li key={cursoId}>
                        <span className="student-tutor__course-icon" aria-hidden="true">
                          <i className="fa-solid fa-book-open" />
                        </span>
                        <div>
                          <strong>{curso?.nombre ?? nombreCurso(cursoId)}</strong>
                          <p>
                            {curso ? (
                              <>
                                <span className="student-tutor__code">{curso.codigo}</span> · Ciclo{' '}
                                {curso.ciclo} · {curso.creditos} créditos
                              </>
                            ) : (
                              cursoId
                            )}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <aside className="student-tutor__aside" aria-label="Tu asignación tutorial">
          <Card className="student-tutor__assignment">
            <CardHead title="Tu tutoría este semestre" />
            <CardBody>
              <dl className="student-tutor__facts">
                <div>
                  <dt>Grupo de tutoría</dt>
                  <dd>{asignacion?.grupo ?? 'Sin grupo'}</dd>
                </div>
                <div>
                  <dt>Semestre</dt>
                  <dd>{asignacion?.semestreId ?? semestreActual}</dd>
                </div>
              </dl>
              <dl className="student-tutor__assignment-details">
                <div>
                  <dt>Etapa académica</dt>
                  <dd>
                    Ciclo {estudiante.ciclo ?? 'sin informar'} ·{' '}
                    {etapa?.etiqueta ?? 'Por confirmar'}
                  </dd>
                </div>
                <div>
                  <dt>Asignado desde</dt>
                  <dd>{formatFecha(asignacion?.fechaInicio ?? null)}</dd>
                </div>
                <div>
                  <dt>Capacidad del tutor</dt>
                  <dd>Hasta {tutor.aforoMaximo} estudiantes por semestre</dd>
                </div>
              </dl>
              <div className="student-tutor__interview">
                <div className="student-tutor__interview-top">
                  <p className="student-tutor__label">
                    {etapa
                      ? `Formato ${etapa.formato.replace('F', '')}`
                      : 'Ciclo pendiente de confirmar'}
                  </p>
                  {entrevista && <StatusBadge estado={entrevista.estado} contexto="formulario" />}
                </div>
                <h3>Entrevista inicial</h3>
                <p>Comparte con tu tutor cómo va tu experiencia universitaria.</p>
                <Link className="student-tutor__link" to="/estudiante/instrumentos">
                  {entrevistaEnviada ? 'Ver entrevista' : 'Completar entrevista'}
                  <i className="fa-solid fa-arrow-right" aria-hidden="true" />
                </Link>
              </div>
            </CardBody>
          </Card>
          <div className="student-tutor__help">
            <i className="fa-regular fa-clock" aria-hidden="true" />
            <div>
              <h3>¿Necesitas otro horario?</h3>
              <p>
                Coordina con tu tutor. Si no encuentran un horario compatible, comunícalo a la
                comisión de tutoría de tu escuela.
              </p>
            </div>
          </div>
        </aside>
      </div>

      <div className="student-tutor__details">
        <details className="student-tutor__disclosure">
          <summary>
            <i className="fa-solid fa-clock-rotate-left" aria-hidden="true" />
            <span>Historial de tus tutores</span>
            <span className="student-tutor__summary-note">
              {historial.length} {historial.length === 1 ? 'registro' : 'registros'}
            </span>
            <i className="fa-solid fa-chevron-down student-tutor__chevron" aria-hidden="true" />
          </summary>
          <div className="student-tutor__disclosure-body">
            {historial.length ? (
              <ol className="student-tutor__history" aria-label="Historial de asignación tutorial">
                {historial.map((cambio, indice) => (
                  <li key={`${cambio.fecha}-${indice}`}>
                    <i className="fa-solid fa-circle-check" aria-hidden="true" />
                    <div>
                      <strong>{cambio.motivo}</strong>
                      <p>{cambio.responsable}</p>
                      <time dateTime={cambio.fecha}>{formatFecha(cambio.fecha)}</time>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p>Aún no hay cambios de tutor registrados.</p>
            )}
            <p className="student-tutor__reference">
              Criterio: {asignacion?.criterio ?? 'Sin registro'}. Referencia de aprobación:{' '}
              {asignacion?.referenciaAprobacion ?? 'Sin registro'}.
            </p>
          </div>
        </details>
        <details className="student-tutor__disclosure">
          <summary>
            <i className="fa-regular fa-circle-question" aria-hidden="true" />
            <span>Cómo se elige a tu tutor</span>
            <i className="fa-solid fa-chevron-down student-tutor__chevron" aria-hidden="true" />
          </summary>
          <div className="student-tutor__disclosure-body">
            <p>
              La escuela valida la asignación y los cupos disponibles. La comisión de tutoría evalúa
              tu preferencia y las solicitudes de cambio; cuando autoriza un cambio, su motivo y
              fecha quedan en el historial de tu expediente.
            </p>
          </div>
        </details>
      </div>

      {solicitud && (
        <Sheet
          title="Pedir cambio de tutor"
          description="La comisión de tutoría de tu escuela evaluará el motivo y los cupos disponibles."
          onClose={() => setSolicitud(false)}
          footer={
            <>
              <button type="button" className="btn btn-link" onClick={() => setSolicitud(false)}>
                Cancelar
              </button>
              <button
                type="submit"
                form="student-tutor-change"
                className="btn btn-primary"
                disabled={guardando || motivo.trim().length < 10 || enviado}
              >
                Enviar solicitud
              </button>
            </>
          }
        >
          <form
            id="student-tutor-change"
            className="stack"
            onSubmit={async (evento) => {
              evento.preventDefault();
              if (motivo.trim().length < 10 || enviado) return;
              if (API_MODE) {
                setError('');
                setGuardando(true);
                try {
                  await mutarSistema('solicitudes-cambio', 'POST', { motivo });
                  setSolicitud(false);
                  setMotivo('');
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'No se pudo presentar la solicitud.');
                } finally {
                  setGuardando(false);
                }
                return;
              }
              setEnviado(true);
              setSolicitud(false);
            }}
          >
            {error && (
              <Alert tone="riesgo" title="No se guardó la solicitud">
                {error}
              </Alert>
            )}
            <dl className="meta-list">
              <div>
                <dt>Estudiante</dt>
                <dd>
                  {estudiante.apellidos}, {estudiante.nombres}
                </dd>
              </div>
              <div>
                <dt>Tutor actual</dt>
                <dd>{nombreTutor}</dd>
              </div>
              <div>
                <dt>Escuela</dt>
                <dd>{escuelaDe(escuelaId)}</dd>
              </div>
            </dl>
            <Field id="motivo-cambio" label="Motivo de la solicitud" required>
              <TextArea
                id="motivo-cambio"
                value={motivo}
                onChange={(evento) => setMotivo(evento.target.value)}
                placeholder="Explica por qué necesitas cambiar de tutor."
                required
                minLength={10}
                aria-describedby="motivo-cambio-ayuda"
              />
              <span id="motivo-cambio-ayuda" className="field__hint">
                Escribe al menos 10 caracteres. Puedes coordinar otro horario con tu tutor antes de
                solicitar el cambio.
              </span>
            </Field>
            <p className="small muted">
              {API_MODE
                ? 'La solicitud se guardará para que coordinación la revise. Tu tutor se mantiene hasta que se apruebe el cambio.'
                : 'Demostración: la solicitud solo se muestra durante esta sesión y no se envía a la comisión.'}
            </p>
          </form>
        </Sheet>
      )}
    </div>
  );
}
