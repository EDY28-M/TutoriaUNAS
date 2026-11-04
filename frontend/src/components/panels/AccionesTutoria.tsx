import { useId, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useSistema } from '../../hooks/useSistema';
import { usePermiso } from '../../hooks/usePermiso';
import { useAccionPersistente } from '../../hooks/useAccionPersistente';
import { API_MODE } from '../../services/apiConfig';
import { apiJson } from '../../services/apiClient';
import { refrescarApi } from '../../services/apiTutoria';
import { mutarSistema, marcarAvisosApi } from '../../services/apiSistema';
import type { CampanaSalud, Instrumento, Sesion } from '../../types/domain';
import { fechaActualLima } from '../../utils/fechas';
import { Alert } from '../ui/Alert';
import { Card, CardBody, CardHead } from '../ui/Card';
import { FormularioPersistente, EliminarPersistente } from './OperacionPersistente';
import { RedactorAviso } from './RedactorAviso';

export function InscripcionCampana({ campana }: { campana: CampanaSalud }) {
  const sistema = useSistema();
  const accion = useAccionPersistente();
  const actual = sistema?.fuentes.campanasSalud?.find((c) => c.id === campana.id);
  if (!API_MODE || !actual) return null;
  const inscrito = actual.inscrito === true;
  return (
    <div className="stack stack--sm">
      <p role="status">
        {inscrito
          ? 'Tu inscripción está confirmada.'
          : `${Number(actual.inscritos)} de ${Number(actual.cupos)} cupos ocupados.`}{' '}
        {accion.mensaje}
      </p>
      {accion.error && (
        <Alert tone="riesgo" title="No se cambió la inscripción">
          {accion.error}
        </Alert>
      )}
      <button
        type="button"
        className="btn btn-primary"
        disabled={
          accion.ocupado ||
          String(actual.fecha) < fechaActualLima() ||
          (!inscrito && Number(actual.inscritos) >= Number(actual.cupos))
        }
        onClick={() =>
          void accion.ejecutar(
            () =>
              mutarSistema(
                `campanas/${encodeURIComponent(campana.id)}/inscripcion`,
                inscrito ? 'DELETE' : 'POST',
              ),
            inscrito ? 'Inscripción cancelada.' : 'Inscripción guardada.',
          )
        }
      >
        {inscrito ? 'Cancelar mi inscripción' : 'Inscribirme a la actividad'}
      </button>
    </div>
  );
}

export function AccionesSesion({ sesion }: { sesion: Sesion }) {
  const { user } = useAuth();
  return API_MODE &&
    user?.role === 'tutor' &&
    user.id === sesion.tutorId &&
    sesion.estado === 'programada' ? (
    <EditorEstadoSesion key={sesion.id} sesion={sesion} />
  ) : null;
}
function EditorEstadoSesion({ sesion }: { sesion: Sesion }) {
  const id = useId();
  const [datos, setDatos] = useState({
    version: sesion.version ?? 0,
    accion: 'cancelar',
    motivo: '',
    fecha: sesion.fecha,
    horaInicio: sesion.horaInicio,
    horaFin: sesion.horaFin,
  });
  return (
    <details>
      <summary>Cancelar o reprogramar esta sesión</summary>
      <FormularioPersistente
        guardar={() =>
          mutarSistema(`sesiones/${encodeURIComponent(sesion.id)}/estado`, 'PUT', datos)
        }
        etiqueta={
          datos.accion === 'cancelar'
            ? 'Confirmar cancelación de sesión'
            : 'Confirmar reprogramación'
        }
      >
        <div className="field">
          <label htmlFor={`${id}-accion`}>Acción</label>
          <select
            id={`${id}-accion`}
            className="select"
            value={datos.accion}
            onChange={(e) => setDatos((d) => ({ ...d, accion: e.target.value }))}
          >
            <option value="cancelar">Cancelar convocatoria</option>
            <option value="reprogramar">Reprogramar convocatoria</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${id}-motivo`}>Motivo del cambio</label>
          <textarea
            id={`${id}-motivo`}
            className="textarea"
            required
            minLength={3}
            maxLength={1000}
            value={datos.motivo}
            onChange={(e) => setDatos((d) => ({ ...d, motivo: e.target.value }))}
          />
        </div>
        {datos.accion === 'reprogramar' && (
          <div className="field-grid">
            {(['fecha', 'horaInicio', 'horaFin'] as const).map((key) => (
              <div className="field" key={key}>
                <label htmlFor={`${id}-${key}`}>
                  {
                    {
                      fecha: 'Nueva fecha',
                      horaInicio: 'Nueva hora de inicio',
                      horaFin: 'Nueva hora de fin',
                    }[key]
                  }
                </label>
                <input
                  id={`${id}-${key}`}
                  type={key === 'fecha' ? 'date' : 'time'}
                  className="input"
                  required
                  value={datos[key]}
                  onChange={(e) => setDatos((d) => ({ ...d, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        )}
      </FormularioPersistente>
    </details>
  );
}

export function DescartarFormulario({
  instrumento,
  onCerrar,
}: {
  instrumento: Instrumento;
  onCerrar(): void;
}) {
  const { user } = useAuth();
  const puedeEliminar = usePermiso('formularios', 'eliminar');
  if (
    !API_MODE ||
    !puedeEliminar ||
    user?.role !== 'tutor' ||
    instrumento.tutorId !== user.id ||
    !['F08', 'F12'].includes(instrumento.formato) ||
    !['no-iniciado', 'borrador'].includes(instrumento.estado) ||
    instrumento.enviado
  )
    return null;
  return (
    <EliminarPersistente
      etiqueta="Descartar este borrador"
      eliminar={async () => {
        await apiJson(
          `/api/formularios/${encodeURIComponent(instrumento.id)}?version=${instrumento.version}`,
          'DELETE',
        );
        await refrescarApi();
      }}
      alEliminar={onCerrar}
    />
  );
}

export function BorradoresAvisos() {
  const sistema = useSistema();
  const lectura = useAccionPersistente();
  const sinLeer = sistema?.notificaciones.filter((n) => !n.leida).map((n) => n.id) ?? [];
  const [abierto, setAbierto] = useState<string | null>(null);
  const borradores = sistema?.mensajes.filter((m) => m.editable) ?? [];
  const aviso = sistema?.mensajes.find((m) => m.id === abierto);
  return (
    <Card>
      <CardHead
        title="Borradores y publicaciones programadas"
        actions={
          <button
            type="button"
            className="btn btn-falcon-default"
            disabled={lectura.ocupado || !sinLeer.length}
            onClick={() =>
              void lectura.ejecutar(() => marcarAvisosApi(sinLeer), 'Avisos marcados como leídos.')
            }
          >
            Marcar avisos como leídos ({sinLeer.length})
          </button>
        }
      />
      <CardBody>
        {lectura.error && (
          <Alert tone="riesgo" title="No se actualizó la lectura">
            {lectura.error}
          </Alert>
        )}
        <span role="status">{lectura.mensaje}</span>
        {!borradores.length && <p>Sin borradores propios.</p>}
        <div className="stack">
          {borradores.map((m) => (
            <div key={m.id} className="ui-row ui-row--between ui-row--wrap">
              <span>
                {m.asunto}
                <small className="d-block">
                  {m.estado} · {m.destinatarios.length} destinatarios
                </small>
              </span>
              <button
                type="button"
                className="btn btn-falcon-default"
                onClick={() => setAbierto(m.id)}
              >
                Editar o eliminar borrador
              </button>
            </div>
          ))}
        </div>
        {aviso && <RedactorAviso key={aviso.id} aviso={aviso} onCerrar={() => setAbierto(null)} />}
      </CardBody>
    </Card>
  );
}
