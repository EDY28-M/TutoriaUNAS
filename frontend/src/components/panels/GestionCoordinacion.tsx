import { useId, useState } from 'react';
import { GestionCuentas } from './GestionCuentas';
import { useSistema } from '../../hooks/useSistema';
import { usePermiso } from '../../hooks/usePermiso';
import { usePortal } from '../../hooks/usePortal';
import { mutarSistema } from '../../services/apiSistema';
import { semestreActual, semestres } from '../../data/catalogos';
import { docentes, estudiantePorId, nombreCompleto } from '../../data/personas';
import type {
  ActividadPersistida,
  PeriodoConfiguracion,
  SolicitudCambio,
} from '../../types/sistema';
import type { Derivacion } from '../../types/domain';
import { Card, CardBody, CardHead } from '../ui/Card';
import { Sheet } from '../ui/Sheet';
import { FormularioPersistente, EliminarPersistente } from './OperacionPersistente';

export function CuentasSistema() {
  return <GestionCuentas />;
}

export function ConfiguracionPeriodo() {
  const sistema = useSistema();
  const sem = semestres.find((s) => s.id === semestreActual);
  if (!sem) return null;
  const actual = sistema?.configuracionPeriodo ?? {
    periodoId: '',
    inicio: sem.inicio,
    fin: sem.fin,
    entrevistasHasta: sem.inicio,
    informesHasta: sem.fin,
    cerrado: false,
    version: 0,
  };
  return (
    <Card>
      <CardHead title="Configuración del semestre activo" />
      <CardBody>
        <EditorPeriodo key={actual.periodoId} actual={actual} />
      </CardBody>
    </Card>
  );
}
function EditorPeriodo({ actual }: { actual: PeriodoConfiguracion }) {
  const [datos, setDatos] = useState(() => ({ ...actual }));
  const id = useId();
  return (
    <FormularioPersistente
      guardar={() => mutarSistema('periodo', 'PUT', datos)}
      alGuardar={() => setDatos((d) => ({ ...d, version: d.version + 1 }))}
    >
      <div className="field-grid">
        {(
          [
            ['inicio', 'Inicio'],
            ['fin', 'Fin'],
            ['entrevistasHasta', 'Fecha recomendada de entrevistas'],
            ['informesHasta', 'Plazo de informes'],
          ] as const
        ).map(([key, label]) => (
          <div className="field" key={key}>
            <label htmlFor={`${id}-${key}`}>{label}</label>
            <input
              id={`${id}-${key}`}
              className="input"
              type="date"
              required
              value={datos[key]}
              onChange={(e) => setDatos((d) => ({ ...d, [key]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={datos.cerrado}
          onChange={(e) => setDatos((d) => ({ ...d, cerrado: e.target.checked }))}
        />{' '}
        Cerrar el semestre para escritura
      </label>
      <p className="small muted">
        El cierre conserva los registros y bloquea las nuevas escrituras tutoriales. Puedes
        reabrirlo desde esta configuración.
      </p>
    </FormularioPersistente>
  );
}

export function ActividadesPlanPersistentes() {
  const sistema = useSistema();
  const portal = usePortal();
  const [elegida, setElegida] = useState<ActividadPersistida | 'nueva' | null>(null);
  const actividades = sistema?.actividadesPlan.filter((a) => a.semestreId === semestreActual) ?? [];
  return (
    <Card>
      <CardHead
        title="Actividades del plan de acción"
        description="El formato 01 reutiliza las metas y actividades registradas."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setElegida('nueva')}>
            Nueva actividad
          </button>
        }
      />
      <CardBody>
        {!actividades.length && <p>Sin actividades registradas.</p>}
        <div className="stack">
          {actividades.map((a) => (
            <div className="ui-row ui-row--between ui-row--wrap" key={a.id}>
              <span>
                <strong>{a.actividad}</strong>
                <small className="d-block">
                  {a.responsable} · {a.avance}% · {a.estado}
                </small>
              </span>
              <button
                type="button"
                className="btn btn-falcon-default"
                onClick={() => setElegida(a)}
              >
                Editar actividad
              </button>
            </div>
          ))}
        </div>
        {elegida && (
          <Sheet
            title={elegida === 'nueva' ? 'Nueva actividad del plan' : 'Editar actividad del plan'}
            onClose={() => setElegida(null)}
            wide
          >
            <EditorActividad
              key={elegida === 'nueva' ? 'nueva' : elegida.id}
              actividad={elegida === 'nueva' ? undefined : elegida}
              escuelaId={portal.escuelaId}
              onCerrar={() => setElegida(null)}
            />
          </Sheet>
        )}
      </CardBody>
    </Card>
  );
}
function EditorActividad({
  actividad,
  escuelaId,
  onCerrar,
}: {
  actividad?: ActividadPersistida;
  escuelaId: string;
  onCerrar(): void;
}) {
  const id = useId();
  const puedeEliminar = usePermiso('planes', 'eliminar');
  const sem = semestres.find((s) => s.id === semestreActual);
  const [datos, setDatos] = useState(() =>
    actividad
      ? { ...actividad }
      : {
          version: 0,
          problematica: '',
          objetivo: '',
          actividad: '',
          meta: '',
          fechaInicio: sem?.inicio ?? '',
          fechaFin: sem?.fin ?? '',
          responsableId: docentes.find((d) => d.escuelaId === escuelaId && d.activo)?.id ?? '',
          evidencia: '',
          aprobacion: '',
          avance: 0,
          estado: 'planificada',
        },
  );
  return (
    <div className="stack">
      <FormularioPersistente
        guardar={() =>
          mutarSistema(
            `plan${actividad ? `/${encodeURIComponent(actividad.id)}` : ''}`,
            actividad ? 'PUT' : 'POST',
            datos,
          )
        }
        alGuardar={onCerrar}
      >
        {(['problematica', 'objetivo', 'actividad', 'meta'] as const).map((key) => (
          <div className="field" key={key}>
            <label htmlFor={`${id}-${key}`}>
              {
                {
                  problematica: 'Problemática',
                  objetivo: 'Objetivo',
                  actividad: 'Actividad',
                  meta: 'Meta',
                }[key]
              }
            </label>
            <textarea
              id={`${id}-${key}`}
              className="textarea"
              required
              maxLength={1000}
              value={datos[key]}
              onChange={(e) => setDatos((d) => ({ ...d, [key]: e.target.value }))}
            />
          </div>
        ))}
        <div className="field-grid">
          {(['fechaInicio', 'fechaFin'] as const).map((key) => (
            <div className="field" key={key}>
              <label htmlFor={`${id}-${key}`}>
                {key === 'fechaInicio' ? 'Inicio de la actividad' : 'Fin de la actividad'}
              </label>
              <input
                id={`${id}-${key}`}
                className="input"
                type="date"
                required
                value={datos[key]}
                onChange={(e) => setDatos((d) => ({ ...d, [key]: e.target.value }))}
              />
            </div>
          ))}
          <div className="field">
            <label htmlFor={`${id}-responsable`}>Responsable</label>
            <select
              id={`${id}-responsable`}
              className="select"
              required
              value={datos.responsableId}
              onChange={(e) => setDatos((d) => ({ ...d, responsableId: e.target.value }))}
            >
              {docentes
                .filter((d) => d.escuelaId === escuelaId && d.activo)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {nombreCompleto(d)}
                  </option>
                ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`${id}-estado`}>Estado</label>
            <select
              id={`${id}-estado`}
              className="select"
              value={datos.estado}
              onChange={(e) => setDatos((d) => ({ ...d, estado: e.target.value }))}
            >
              {['planificada', 'en-ejecucion', 'culminada', 'reprogramada'].map((e) => (
                <option key={e}>{e}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`${id}-avance`}>Avance (%)</label>
            <input
              id={`${id}-avance`}
              className="input"
              type="number"
              min={0}
              max={100}
              required
              value={datos.avance}
              onChange={(e) => setDatos((d) => ({ ...d, avance: Number(e.target.value) }))}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor={`${id}-evidencia`}>Evidencia</label>
          <textarea
            id={`${id}-evidencia`}
            className="textarea"
            maxLength={2000}
            value={datos.evidencia}
            onChange={(e) => setDatos((d) => ({ ...d, evidencia: e.target.value }))}
          />
        </div>
        <div className="field">
          <label htmlFor={`${id}-aprobacion`}>Referencia de aprobación</label>
          <input
            id={`${id}-aprobacion`}
            className="input"
            maxLength={500}
            value={datos.aprobacion}
            onChange={(e) => setDatos((d) => ({ ...d, aprobacion: e.target.value }))}
          />
        </div>
      </FormularioPersistente>
      {puedeEliminar && actividad?.estado === 'planificada' && actividad.avance === 0 && (
        <EliminarPersistente
          etiqueta="Eliminar actividad sin ejecución"
          eliminar={() =>
            mutarSistema(
              `plan/${encodeURIComponent(actividad.id)}?version=${datos.version}`,
              'DELETE',
            )
          }
          alEliminar={onCerrar}
        />
      )}
    </div>
  );
}

export function SolicitudesCambioPendientes() {
  const sistema = useSistema();
  const portal = usePortal();
  const [elegida, setElegida] = useState<SolicitudCambio | null>(null);
  const solicitudes = sistema?.solicitudesCambio.filter((s) => s.estado === 'pendiente') ?? [];
  return (
    <Card>
      <CardHead title="Solicitudes de cambio de tutor" />
      <CardBody>
        <div className="stack">
          {!solicitudes.length && <p>Sin solicitudes pendientes.</p>}
          {solicitudes.map((s) => (
            <div className="ui-row ui-row--between ui-row--wrap" key={s.id}>
              <span>
                {estudiantePorId(s.estudianteId)
                  ? nombreCompleto(estudiantePorId(s.estudianteId)!)
                  : s.estudianteId}
                <small className="d-block">{s.motivo}</small>
              </span>
              <button
                type="button"
                className="btn btn-falcon-default"
                onClick={() => setElegida(s)}
              >
                Resolver solicitud
              </button>
            </div>
          ))}
        </div>
        {elegida && (
          <Sheet title="Resolver cambio de tutor" onClose={() => setElegida(null)}>
            <EditorSolicitud
              key={elegida.id}
              solicitud={elegida}
              escuelaId={portal.escuelaId}
              asignacionVersion={
                portal.tutorados.find((a) => a.estudianteId === elegida.estudianteId)?.version ?? 0
              }
              onCerrar={() => setElegida(null)}
            />
          </Sheet>
        )}
      </CardBody>
    </Card>
  );
}
function EditorSolicitud({
  solicitud,
  escuelaId,
  asignacionVersion,
  onCerrar,
}: {
  solicitud: SolicitudCambio;
  escuelaId: string;
  asignacionVersion: number;
  onCerrar(): void;
}) {
  const id = useId();
  const [datos, setDatos] = useState({
    version: solicitud.version,
    asignacionVersion,
    decision: 'rechazada',
    respuesta: '',
    tutorId: '',
  });
  return (
    <FormularioPersistente
      guardar={() =>
        mutarSistema(`solicitudes-cambio/${encodeURIComponent(solicitud.id)}`, 'PUT', datos)
      }
      alGuardar={onCerrar}
    >
      <p>{solicitud.motivo}</p>
      <div className="field">
        <label htmlFor={`${id}-decision`}>Decisión</label>
        <select
          className="select"
          id={`${id}-decision`}
          value={datos.decision}
          onChange={(e) => setDatos((d) => ({ ...d, decision: e.target.value }))}
        >
          <option value="rechazada">Rechazar con respuesta</option>
          <option value="aprobada">Aprobar y asignar otro tutor</option>
        </select>
      </div>
      {datos.decision === 'aprobada' && (
        <div className="field">
          <label htmlFor={`${id}-tutor`}>Nuevo tutor</label>
          <select
            className="select"
            id={`${id}-tutor`}
            required
            value={datos.tutorId}
            onChange={(e) => setDatos((d) => ({ ...d, tutorId: e.target.value }))}
          >
            <option value="">Selecciona un docente</option>
            {docentes
              .filter(
                (d) => d.escuelaId === escuelaId && d.activo && d.id !== solicitud.tutorActualId,
              )
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {nombreCompleto(d)}
                </option>
              ))}
          </select>
        </div>
      )}
      <div className="field">
        <label htmlFor={`${id}-respuesta`}>Respuesta o referencia de aprobación</label>
        <textarea
          className="textarea"
          id={`${id}-respuesta`}
          required
          minLength={3}
          maxLength={1000}
          value={datos.respuesta}
          onChange={(e) => setDatos((d) => ({ ...d, respuesta: e.target.value }))}
        />
      </div>
    </FormularioPersistente>
  );
}

type Caso = Derivacion & { instrumentoId: string; version: number };
const TRANSICIONES: Record<string, string[]> = {
  registrada: ['recibida', 'cerrada'],
  recibida: ['citada', 'en-atencion', 'cerrada'],
  citada: ['en-atencion', 'no-presentado', 'cerrada'],
  'en-atencion': ['atendida', 'seguimiento'],
  atendida: ['seguimiento', 'cerrada'],
  seguimiento: ['citada', 'atendida', 'cerrada'],
  'no-presentado': ['citada', 'cerrada'],
  cerrada: [],
};
export function SeguimientosCoordinacion() {
  const sistema = useSistema();
  const [elegido, setElegido] = useState<Caso | null>(null);
  const casos = (sistema?.fuentes.derivaciones ?? []) as unknown as Caso[];
  return (
    <Card>
      <CardHead
        title="Seguimiento administrativo de apoyos"
        description="Registra únicamente lo comunicado por el área responsable."
      />
      <CardBody>
        <div className="stack">
          {!casos.length && <p>Sin derivaciones enviadas.</p>}
          {casos.map((c) => (
            <div key={c.id} className="ui-row ui-row--between ui-row--wrap">
              <span>
                {c.codigo}
                <small className="d-block">
                  {c.area} · {c.estado}
                </small>
              </span>
              {(TRANSICIONES[c.estado]?.length ?? 0) > 0 && (
                <button
                  type="button"
                  className="btn btn-falcon-default"
                  onClick={() => setElegido(c)}
                >
                  Registrar seguimiento
                </button>
              )}
            </div>
          ))}
        </div>
        {elegido && (
          <Sheet title="Registrar comunicación del área" onClose={() => setElegido(null)}>
            <EditorSeguimiento key={elegido.id} caso={elegido} onCerrar={() => setElegido(null)} />
          </Sheet>
        )}
      </CardBody>
    </Card>
  );
}
function EditorSeguimiento({ caso, onCerrar }: { caso: Caso; onCerrar(): void }) {
  const id = useId();
  const [datos, setDatos] = useState({
    version: caso.version,
    estado: TRANSICIONES[caso.estado]?.[0] ?? '',
    nota: '',
    responsableArea: caso.responsableArea,
    siguienteAccion: caso.siguienteAccion,
    fechaCita: caso.fechaCita ?? '',
    recomendacionComunicable: caso.recomendacionComunicable ?? '',
    vigenciaRecomendacion: caso.vigenciaRecomendacion ?? '',
  });
  return (
    <FormularioPersistente
      guardar={() =>
        mutarSistema(`derivaciones/${encodeURIComponent(caso.instrumentoId)}`, 'PUT', {
          ...datos,
          fechaCita: datos.fechaCita || null,
          vigenciaRecomendacion: datos.vigenciaRecomendacion || null,
          recomendacionComunicable: datos.recomendacionComunicable || null,
        })
      }
      alGuardar={onCerrar}
    >
      <div className="field">
        <label htmlFor={`${id}-estado`}>Nuevo estado</label>
        <select
          id={`${id}-estado`}
          className="select"
          value={datos.estado}
          onChange={(e) => setDatos((d) => ({ ...d, estado: e.target.value }))}
        >
          {TRANSICIONES[caso.estado]?.map((e) => (
            <option key={e}>{e}</option>
          ))}
        </select>
      </div>
      {(['responsableArea', 'nota', 'siguienteAccion', 'recomendacionComunicable'] as const).map(
        (key) => (
          <div className="field" key={key}>
            <label htmlFor={`${id}-${key}`}>
              {
                {
                  responsableArea: 'Responsable del área',
                  nota: 'Comunicación recibida',
                  siguienteAccion: 'Siguiente acción',
                  recomendacionComunicable: 'Recomendación autorizada para tutoría',
                }[key]
              }
            </label>
            <textarea
              id={`${id}-${key}`}
              className="textarea"
              required={key === 'responsableArea' || key === 'nota'}
              minLength={key === 'nota' ? 3 : undefined}
              maxLength={1000}
              value={datos[key]}
              onChange={(e) => setDatos((d) => ({ ...d, [key]: e.target.value }))}
            />
          </div>
        ),
      )}
      <div className="field-grid">
        {(['fechaCita', 'vigenciaRecomendacion'] as const).map((key) => (
          <div className="field" key={key}>
            <label htmlFor={`${id}-${key}`}>
              {key === 'fechaCita' ? 'Fecha de cita' : 'Vigencia de la recomendación'}
            </label>
            <input
              id={`${id}-${key}`}
              className="input"
              type="date"
              required={key === 'fechaCita' && datos.estado === 'citada'}
              value={datos[key]}
              onChange={(e) => setDatos((d) => ({ ...d, [key]: e.target.value }))}
            />
          </div>
        ))}
      </div>
    </FormularioPersistente>
  );
}

export function RespuestaInsumo({ insumoId, alGuardar }: { insumoId: string; alGuardar(): void }) {
  const sistema = useSistema();
  const fuente = sistema?.fuentes.insumos?.find((i) => i.id === insumoId);
  return fuente ? <EditorInsumo key={insumoId} fuente={fuente} alGuardar={alGuardar} /> : null;
}
function EditorInsumo({
  fuente,
  alGuardar,
}: {
  fuente: Record<string, unknown>;
  alGuardar(): void;
}) {
  const id = useId();
  const [datos, setDatos] = useState({
    version: Number(fuente.version),
    estado: String(fuente.estado),
    responsable: String(fuente.responsable ?? ''),
    observacion: String(fuente.observacion ?? ''),
    fechaRespuesta: String(fuente.fechaRespuesta ?? ''),
  });
  return (
    <FormularioPersistente
      guardar={() =>
        mutarSistema(`insumos/${encodeURIComponent(String(fuente.id))}`, 'PUT', {
          ...datos,
          fechaRespuesta: datos.fechaRespuesta || null,
        })
      }
      alGuardar={alGuardar}
    >
      <div className="field">
        <label htmlFor={`${id}-estado`}>Estado de la solicitud</label>
        <select
          id={`${id}-estado`}
          className="select"
          value={datos.estado}
          onChange={(e) => setDatos((d) => ({ ...d, estado: e.target.value }))}
        >
          {['pendiente', 'parcial', 'entregado', 'no-autorizado'].map((e) => (
            <option key={e}>{e}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${id}-responsable`}>Responsable</label>
        <input
          id={`${id}-responsable`}
          className="input"
          required
          maxLength={200}
          value={datos.responsable}
          onChange={(e) => setDatos((d) => ({ ...d, responsable: e.target.value }))}
        />
      </div>
      <div className="field">
        <label htmlFor={`${id}-fecha`}>Fecha de respuesta</label>
        <input
          id={`${id}-fecha`}
          className="input"
          type="date"
          value={datos.fechaRespuesta}
          onChange={(e) => setDatos((d) => ({ ...d, fechaRespuesta: e.target.value }))}
        />
      </div>
      <div className="field">
        <label htmlFor={`${id}-observacion`}>Observación</label>
        <textarea
          id={`${id}-observacion`}
          className="textarea"
          maxLength={2000}
          value={datos.observacion}
          onChange={(e) => setDatos((d) => ({ ...d, observacion: e.target.value }))}
        />
      </div>
    </FormularioPersistente>
  );
}
