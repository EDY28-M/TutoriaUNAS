import { Link, useNavigate, useParams } from 'react-router-dom';
import { GuidedInstrumentForm } from '../../components/panels/GuidedInstrumentForm';
import { Alert } from '../../components/ui/Alert';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageLoading } from '../../components/ui/PageLoading';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ArrowLeft } from '../../components/ui/icons';
import { useAuth } from '../../hooks/useAuth';
import { usePortal } from '../../hooks/usePortal';
import { useInstrumentWorkspace } from '../../hooks/useInstrumentWorkspace';
import { API_MODE } from '../../services/apiConfig';
import { snapshotApi } from '../../services/apiTutoria';
import { persistirFormulario } from '../../services/mutacionesTutoria';
import { definicionPorCodigo } from '../../data/formatos';
import { etapaAcademica, etapaDeCiclo } from '../../data/catalogos';
import { formatFecha } from '../../utils/fechas';
import { bloqueoEvaluacion, esEvaluacionSesion } from '../../utils/evaluacionesSesion';
import { clasificarFormulario } from '../../utils/formulariosEstudiante';
import '../../styles/student-forms.css';

function Volver() {
  return (
    <Link className="sf-volver" to="/estudiante/instrumentos">
      <ArrowLeft aria-hidden="true" /> Mis formularios
    </Link>
  );
}

/** Responder (o consultar) un formulario en su propia página, sin ventanas superpuestas. */
export function StudentInstrumentFill() {
  const { instrumentoId = '' } = useParams();
  const { user } = useAuth();
  const portal = usePortal();
  const workspace = useInstrumentWorkspace();
  const navegar = useNavigate();
  const registro = portal.instrumentos.find((r) => r.id === instrumentoId);
  const definicion = registro ? definicionPorCodigo(registro.formato) : undefined;

  if (!registro || !definicion || !user) {
    // En modo API los formularios llegan después del primer pintado.
    if (API_MODE && !snapshotApi().datos && !workspace.aviso) return <PageLoading />;
    return (
      <div className="sf-pagina sf-llenado">
        <Volver />
        <EmptyState
          title="No encontramos este formulario"
          description="Puede que ya no esté disponible para tu cuenta. Revisa tus formularios vigentes."
          action={
            <Link className="btn btn-falcon-default" to="/estudiante/instrumentos">
              Ver mis formularios
            </Link>
          }
        />
      </div>
    );
  }

  const { sesion, disponibilidad } = clasificarFormulario(
    registro,
    portal.sesiones,
    workspace.momento,
  );
  const evaluacion = esEvaluacionSesion(registro.formato);
  const editable =
    registro.estudianteId === user.id &&
    (disponibilidad === 'responder' || disponibilidad === 'corregir');
  const bloqueo =
    evaluacion && !editable && disponibilidad !== 'enviado'
      ? bloqueoEvaluacion(sesion, user.id)
      : null;
  const observaciones = registro.observaciones.filter((o) => o.estado === 'abierta');
  const ciclo = portal.estudiante?.ciclo ?? null;
  const etapa = ciclo === null ? null : etapaAcademica[etapaDeCiclo(ciclo)];
  const titulo = evaluacion
    ? `Evaluación de la tutoría ${registro.formato === 'F10' ? 'individual' : 'grupal'}`
    : 'Entrevista inicial';
  // «Entrevista inicial al estudiante ingresante» → «Estudiante ingresante».
  const perfil = etapa?.descripcion.replace(/^Entrevista inicial al /, '');
  const contexto = evaluacion
    ? sesion
      ? `${sesion.tema} · ${formatFecha(sesion.fecha)} · ${sesion.horaInicio}–${sesion.horaFin}`
      : 'Sesión no disponible'
    : [
        perfil && `${perfil.charAt(0).toUpperCase()}${perfil.slice(1)}`,
        etapa?.ciclos,
        `Semestre ${registro.semestreId}`,
      ]
        .filter(Boolean)
        .join(' · ');
  // Destinatario según la resolución (formatos.ts): el tutor para la entrevista,
  // el responsable del sistema para las evaluaciones.
  const destino = evaluacion
    ? 'Tus respuestas las recibe el responsable del Sistema de Tutoría.'
    : 'La recibe tu docente tutor y queda en tu expediente de tutoría.';

  const guardar = async (respuestas: Record<string, string>, enviar: boolean, version?: number) => {
    const guardado = await persistirFormulario(registro, respuestas, user, enviar, version);
    if (enviar)
      navegar('/estudiante/instrumentos', {
        replace: true,
        state: {
          aviso: evaluacion
            ? 'Evaluación enviada. Gracias: tu opinión ayuda a mejorar la tutoría.'
            : 'Entrevista enviada. Tu tutor la revisará y verás su respuesta en Mis formularios.',
        },
      });
    return guardado;
  };

  return (
    <div className="sf-pagina sf-llenado">
      <Volver />
      <header className="sf-cabecera">
        <div className="sf-cabecera__texto">
          <p className="sf-eyebrow">
            Formato {definicion.numero} · {evaluacion ? 'Evaluación' : 'Entrevista'}
          </p>
          <h1>{titulo}</h1>
          <p className="sf-cabecera__contexto">{contexto}</p>
          <p className="sf-cabecera__destino">{destino}</p>
        </div>
        <StatusBadge estado={registro.estado} contexto="formulario" />
      </header>

      {observaciones.length > 0 && (
        <Alert tone="alerta" title="Tu tutor pidió estos cambios">
          {observaciones.map((o) => (
            <span className="d-block" key={o.id}>
              {o.texto}
            </span>
          ))}
        </Alert>
      )}
      {bloqueo && (
        <Alert tone="info" title="Aún no puedes responder">
          {bloqueo} Mientras tanto, puedes ver las preguntas.
        </Alert>
      )}

      <div className="sf-hoja">
        <GuidedInstrumentForm
          key={registro.id}
          definicion={definicion}
          instrumento={registro}
          editable={editable}
          puedeEnviar={editable}
          mostrarFormato={false}
          onGuardar={editable ? guardar : undefined}
        />
      </div>
    </div>
  );
}
