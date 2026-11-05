import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useInstrumentWorkspace } from '../../hooks/useInstrumentWorkspace';
import { persistirProgramacion } from '../../services/mutacionesTutoria';
import { TriangleAlert } from '../../components/ui/icons';
import { PageHeading } from '../../components/ui/PageHeading';

import { Alert } from '../../components/ui/Alert';

import { EmptyState } from '../../components/ui/EmptyState';
import { Sheet } from '../../components/ui/Sheet';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { usePortal } from '../../hooks/usePortal';
import { SessionCalendar } from '../../components/panels/SessionCalendar';
import { SessionDetails } from '../../components/panels/SessionDetails';
import { AccionesSesion } from '../../components/panels/AccionesTutoria';

import { semestreActual } from '../../data/catalogos';
import { estudiantePorId, nombreCompleto } from '../../data/personas';
import { hayCruce } from '../../data/academico';
import type { ModalidadSesion, Sesion } from '../../types/domain';
import { fechaActualLima, formatFechaLarga, formatHora, formatRangoHora } from '../../utils/fechas';
import '../../styles/coord-modals.css';

/** Sesiones del docente: un solo calendario con detalle y programación. */

type Ventana = { tipo: 'detalle'; sesionId: string } | { tipo: 'programar' } | null;

/** Día de la semana del bloque horario (1 = lunes … 7 = domingo). */
function diaDeFecha(fecha: string): number {
  return ((new Date(`${fecha}T12:00:00`).getDay() + 6) % 7) + 1;
}

export function TutorSessions() {
  const portal = usePortal();
  const { user } = useAuth();
  const workspace = useInstrumentWorkspace();
  const { docente, tutorados, sesiones } = portal;
  const [parametros] = useSearchParams();

  const [ventana, setVentana] = useState<Ventana>(() =>
    parametros.get('accion') === 'programar' ? { tipo: 'programar' } : null,
  );

  const [nuevoTipo, setNuevoTipo] = useState<ModalidadSesion>('individual');
  const [nuevaFecha, setNuevaFecha] = useState(fechaActualLima);
  const [nuevaInicio, setNuevaInicio] = useState('16:00');
  const [nuevaFin, setNuevaFin] = useState('17:00');
  const [nuevoEstudiante, setNuevoEstudiante] = useState(
    tutorados.find((a) => a.estudianteId === parametros.get('estudiante'))?.estudianteId ??
      tutorados[0]?.estudianteId ??
      '',
  );
  const [nuevoGrupo, setNuevoGrupo] = useState(tutorados[0]?.grupo ?? '');
  const [modalidad, setModalidad] = useState<Sesion['modalidad']>('presencial');
  const [lugar, setLugar] = useState('Cubículo de tutoría · Pabellón B');
  const [tema, setTema] = useState('Seguimiento del avance académico del semestre');
  const [objetivo, setObjetivo] = useState(
    'Acompañar al tutorado en la organización de su tiempo y en la preparación de las evaluaciones.',
  );
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [guardando, setGuardando] = useState(false);
  const convocados =
    nuevoTipo === 'individual'
      ? [nuevoEstudiante].filter(Boolean)
      : tutorados.filter((a) => a.grupo === nuevoGrupo).map((a) => a.estudianteId);
  async function programar() {
    if (!user || guardando) return;
    setGuardando(true);
    try {
      const sesion = await persistirProgramacion(
        user,
        {
          tipo: nuevoTipo,
          fecha: nuevaFecha,
          horaInicio: nuevaInicio,
          horaFin: nuevaFin,
          modalidad,
          lugar,
          tema,
          objetivo,
          estudiantes: convocados,
        },
        workspace.registros,
      );
      setError('');
      setAviso(
        'Sesión programada. Ya está disponible en el calendario de los estudiantes convocados.',
      );
      setVentana({ tipo: 'detalle', sesionId: sesion.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo programar la sesión.');
    } finally {
      setGuardando(false);
    }
  }

  const tutoradosResueltos = tutorados.flatMap((asignacion) => {
    const estudiante = estudiantePorId(asignacion.estudianteId);
    return estudiante ? [{ estudiante, grupo: asignacion.grupo }] : [];
  });

  const sesionDetalle =
    ventana && ventana.tipo !== 'programar'
      ? sesiones.find((sesion) => sesion.id === ventana.sesionId)
      : undefined;

  const cruceProgramacion =
    nuevoTipo === 'individual' &&
    nuevoEstudiante !== '' &&
    nuevaInicio < nuevaFin &&
    nuevaFecha !== ''
      ? hayCruce(nuevoEstudiante, diaDeFecha(nuevaFecha), nuevaInicio, nuevaFin)
      : null;

  if (!docente) {
    return (
      <PageHeading
        eyebrow="Acompañamiento tutorial"
        title="Sesiones de tutoría"
        description="La cuenta de demostración no tiene una ficha de docente tutor asociada."
      />
    );
  }

  return (
    <>
      <PageHeading
        eyebrow="Tutoría"
        title="Sesiones de tutoría"
        actions={
          <>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setError('');
                setVentana({ tipo: 'programar' });
              }}
            >
              Programar sesión
            </button>
          </>
        }
        description="Programa sesiones y consulta sus acuerdos."
      />
      {aviso && (
        <div role="status">
          <Alert tone="ok" title="Sesión programada">
            {aviso}
          </Alert>
        </div>
      )}
      <SessionCalendar
        sesiones={sesiones}
        onAbrir={(sesion) => setVentana({ tipo: 'detalle', sesionId: sesion.id })}
      />

      {ventana?.tipo === 'detalle' && sesionDetalle && (
        <Sheet
          title={sesionDetalle.tema}
          description={`${formatFechaLarga(sesionDetalle.fecha)} · ${formatRangoHora(
            formatHora(sesionDetalle.horaInicio),
            formatHora(sesionDetalle.horaFin),
          )} · ${sesionDetalle.codigo}`}
          onClose={() => setVentana(null)}
          wide
          footer={
            <>
              {!['cancelada', 'reprogramada'].includes(sesionDetalle.estado) && (
                <Link
                  className="btn btn-primary"
                  to={`/tutor/asistencias?sesion=${encodeURIComponent(sesionDetalle.id)}`}
                >
                  Registrar asistencia
                </Link>
              )}
              <button
                type="button"
                className="btn btn-falcon-default"
                onClick={() => setVentana(null)}
              >
                Cerrar
              </button>
            </>
          }
        >
          <SessionDetails sesion={sesionDetalle} />
          <AccionesSesion sesion={sesionDetalle} />
        </Sheet>
      )}

      {ventana?.tipo === 'programar' && (
        <Sheet
          title="Programar sesión de tutoría"
          description="Elige el horario y los participantes."
          className="coord-form-sheet"
          onClose={() => setVentana(null)}
          wide
          footer={
            <>
              <button
                type="button"
                className="btn btn-falcon-default"
                onClick={() => setVentana(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={programar}
                disabled={guardando || (nuevoTipo === 'individual' && !nuevoEstudiante)}
              >
                Guardar programación
              </button>
            </>
          }
        >
          <div className="stack">
            {error && (
              <Alert tone="riesgo" title="Revisa la programación">
                {error}
              </Alert>
            )}
            <div className="field-grid">
              <div className="field">
                <label htmlFor="programar-fecha">Fecha</label>
                <input
                  id="programar-fecha"
                  className="input"
                  type="date"
                  value={nuevaFecha}
                  onChange={(evento) => setNuevaFecha(evento.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="programar-tipo">Tipo de tutoría</label>
                <select
                  id="programar-tipo"
                  className="select"
                  value={nuevoTipo}
                  onChange={(evento) =>
                    setNuevoTipo(evento.target.value === 'grupal' ? 'grupal' : 'individual')
                  }
                >
                  <option value="individual">Individual</option>
                  <option value="grupal">Grupal</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="programar-inicio">Hora de inicio</label>
                <input
                  id="programar-inicio"
                  className="input"
                  type="time"
                  value={nuevaInicio}
                  onChange={(evento) => setNuevaInicio(evento.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="programar-fin">Hora de fin</label>
                <input
                  id="programar-fin"
                  className="input"
                  type="time"
                  value={nuevaFin}
                  onChange={(evento) => setNuevaFin(evento.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="programar-modalidad">Modalidad</label>
                <select
                  id="programar-modalidad"
                  className="select"
                  value={modalidad}
                  onChange={(e) => setModalidad(e.target.value as Sesion['modalidad'])}
                >
                  <option value="presencial">Presencial</option>
                  <option value="virtual">Virtual</option>
                  <option value="mixta">Mixta</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="programar-lugar">Lugar o enlace institucional</label>
                <input
                  id="programar-lugar"
                  className="input"
                  type="text"
                  value={lugar}
                  onChange={(e) => setLugar(e.target.value)}
                  maxLength={300}
                />
              </div>
            </div>

            {nuevoTipo === 'individual' && (
              <SearchableSelect
                label="Estudiante convocado"
                placeholder="Buscar por nombre o código"
                options={tutoradosResueltos.map(({ estudiante }) => ({
                  value: estudiante.id,
                  label: nombreCompleto(estudiante),
                  description: estudiante.codigo,
                }))}
                value={nuevoEstudiante}
                onChange={setNuevoEstudiante}
                autoFocus={false}
                required
              />
            )}
            {nuevoTipo === 'grupal' && (
              <label className="field" htmlFor="programar-grupo">
                <span>Grupo convocado</span>
                <select
                  id="programar-grupo"
                  className="select"
                  value={nuevoGrupo}
                  onChange={(e) => setNuevoGrupo(e.target.value)}
                >
                  {[
                    ...new Set(
                      tutorados
                        .map((a) => a.grupo)
                        .filter((grupo): grupo is string => Boolean(grupo)),
                    ),
                  ].map((grupo) => (
                    <option key={grupo} value={grupo}>
                      {grupo}
                    </option>
                  ))}
                </select>
                <span className="field__hint">
                  {convocados.length} estudiantes de tus asignaciones activas recibirán la sesión en
                  su calendario.
                </span>
              </label>
            )}

            {cruceProgramacion ? (
              <Alert tone="alerta" title="Posible cruce con el horario académico">
                El bloque coincide con <strong>{cruceProgramacion.titulo}</strong> (
                {cruceProgramacion.horaInicio}–{cruceProgramacion.horaFin}). Elige otro horario para
                asegurar la asistencia del estudiante.
              </Alert>
            ) : nuevoTipo === 'individual' && nuevoEstudiante !== '' && nuevaInicio < nuevaFin ? (
              <Alert tone="ok" title="Horario sin cruces">
                Se revisará la disponibilidad al guardar.
              </Alert>
            ) : null}

            <div className="field">
              <label htmlFor="programar-tema">Tema o título de la sesión</label>
              <input
                id="programar-tema"
                className="input"
                type="text"
                value={tema}
                onChange={(e) => setTema(e.target.value)}
                maxLength={200}
                aria-describedby={nuevoTipo === 'grupal' ? 'programar-tema-ayuda' : undefined}
              />
              {nuevoTipo === 'grupal' && (
                <span className="field__hint" id="programar-tema-ayuda">
                  Obligatorio para sesiones grupales.
                </span>
              )}
            </div>
            <div className="field">
              <label htmlFor="programar-objetivo">Objetivo de la sesión</label>
              <textarea
                id="programar-objetivo"
                className="textarea"
                value={objetivo}
                onChange={(e) => setObjetivo(e.target.value)}
                maxLength={2000}
              />
            </div>
            <dl className="meta-list">
              <div>
                <dt>Docente tutor</dt>
                <dd>{nombreCompleto(docente)}</dd>
              </div>
              <div>
                <dt>Semestre</dt>
                <dd>{semestreActual}</dd>
              </div>
              <div>
                <dt>Día de la semana</dt>
                <dd>
                  {['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'][
                    diaDeFecha(nuevaFecha) - 1
                  ] ?? '—'}
                </dd>
              </div>
              <div>
                <dt>Vigencia del horario</dt>
                <dd>Semestre {semestreActual}</dd>
              </div>
            </dl>
          </div>
        </Sheet>
      )}

      {ventana?.tipo === 'detalle' && !sesionDetalle && (
        <Sheet
          title="Sesión no disponible"
          description="La sesión seleccionada ya no figura en el registro"
          onClose={() => setVentana(null)}
        >
          <EmptyState
            title="Sesión no encontrada"
            description="Actualiza el listado de sesiones para volver a intentarlo."
            icon={<TriangleAlert />}
          />
        </Sheet>
      )}
    </>
  );
}
