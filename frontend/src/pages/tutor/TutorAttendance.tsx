import { useState } from 'react';
import { PageHeading } from '../../components/ui/PageHeading';
import { DataTable } from '../../components/ui/DataTable';
import { Badge } from '../../components/ui/StatusBadge';
import { Sheet } from '../../components/ui/Sheet';
import { Alert } from '../../components/ui/Alert';
import { EmptyState } from '../../components/ui/EmptyState';
import { usePortal } from '../../hooks/usePortal';
import { useAuth } from '../../hooks/useAuth';
import { estudiantePorId, nombreCompleto } from '../../data/personas';
import { cantidadAsistentes, guardarAsistencia } from '../../services/sessionAttendance';
import { formatFecha, formatFechaLarga } from '../../utils/fechas';
import type { Sesion } from '../../types/domain';
import '../../styles/attendance.css';

export function TutorAttendance() {
  const { sesiones, docente } = usePortal();
  const { user } = useAuth();
  const [fecha, setFecha] = useState('');
  const [buscar, setBuscar] = useState('');
  const [detalle, setDetalle] = useState<Sesion | null>(null);
  const [confirmacion, setConfirmacion] = useState('');
  const realizadas = sesiones.filter((s) => s.estado === 'realizada');
  const filas = realizadas.filter(
    (s) =>
      (!fecha || s.fecha === fecha) &&
      `${s.tema} ${s.codigo}`
        .toLocaleLowerCase('es')
        .includes(buscar.trim().toLocaleLowerCase('es')),
  );
  if (!docente || !user) return <EmptyState title="Sin docente asociado" />;
  return (
    <div className="attendance-page">
      <PageHeading
        eyebrow="Tutoría"
        title="Asistencias"
        description="Registra la asistencia y los acuerdos de cada sesión."
      />
      {confirmacion && (
        <p className="attendance-notice" role="status">
          {confirmacion}
        </p>
      )}
      <section className="card attendance-register" aria-label="Sesiones realizadas">
        <div className="attendance-filters">
          <label className="field">
            <span>Buscar sesión</span>
            <input
              className="input"
              type="search"
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              placeholder="Título o código"
            />
          </label>
          <label className="field">
            <span>Fecha</span>
            <input
              className="input"
              type="date"
              value={fecha}
              onInput={(e) => setFecha(e.currentTarget.value)}
              onChange={(e) => setFecha(e.target.value)}
            />
          </label>
          {(fecha || buscar) && (
            <button
              className="btn btn-falcon-default"
              type="button"
              onClick={() => {
                setFecha('');
                setBuscar('');
              }}
            >
              Limpiar
            </button>
          )}
          <span className="small muted">{filas.length} sesiones</span>
        </div>
        <DataTable
          rows={filas}
          rowKey={(s) => s.id}
          caption="Asistencia por sesión"
          pagination="auto"
          initialSort={{ key: 'fecha', direction: 'desc' }}
          emptyTitle="Sin sesiones realizadas"
          emptyDescription={
            fecha || buscar
              ? 'Prueba con otra fecha o título.'
              : 'Las sesiones aparecerán aquí cuando se realicen.'
          }
          columns={[
            {
              key: 'fecha',
              header: 'Fecha',
              sortable: true,
              sortValue: (s) => s.fecha,
              render: (s) => (
                <>
                  <span className="cell-strong nowrap">{formatFecha(s.fecha)}</span>
                  <span className="cell-note mono">
                    {s.horaInicio}–{s.horaFin}
                  </span>
                </>
              ),
            },
            {
              key: 'sesion',
              header: 'Sesión',
              sortable: true,
              sortValue: (s) => s.tema,
              render: (s) => (
                <>
                  <span className="cell-strong">{s.tema}</span>
                  <span className="cell-note mono">{s.codigo}</span>
                </>
              ),
            },
            {
              key: 'tipo',
              header: 'Tipo',
              render: (s) => (
                <Badge tone={s.tipo === 'grupal' ? 'dorado' : 'info'}>
                  {s.tipo === 'grupal' ? 'Grupal' : 'Individual'}
                </Badge>
              ),
            },
            {
              key: 'asistentes',
              header: 'Asistentes',
              render: (s) => (
                <>
                  <span className="cell-strong">
                    {cantidadAsistentes(s)} de {s.asistentes.length}
                  </span>
                  <span className="cell-note">{s.acuerdos.length} acuerdos</span>
                </>
              ),
            },
            {
              key: 'accion',
              header: 'Registro',
              render: (s) => (
                <button
                  type="button"
                  className="btn btn-falcon-default btn-sm"
                  aria-label={`Revisar asistencia de ${s.codigo}`}
                  onClick={() => {
                    setDetalle(s);
                    setConfirmacion('');
                  }}
                >
                  Revisar
                </button>
              ),
            },
          ]}
        />
      </section>
      {detalle && (
        <AttendanceEditor
          key={detalle.id}
          sesion={detalle}
          onClose={() => setDetalle(null)}
          onSave={(asistentes, mensaje) => {
            guardarAsistencia(user, detalle, asistentes, mensaje);
            setDetalle(null);
            setConfirmacion(
              `Registro guardado · ${detalle.codigo}${mensaje.trim() ? '. El acuerdo ya está disponible en la sesión del estudiante.' : '.'}`,
            );
          }}
        />
      )}
    </div>
  );
}

function AttendanceEditor({
  sesion,
  onClose,
  onSave,
}: {
  sesion: Sesion;
  onClose(): void;
  onSave(asistentes: Sesion['asistentes'], mensaje: string): void;
}) {
  const [asistentes, setAsistentes] = useState<Sesion['asistentes']>(() =>
    sesion.asistentes.map((a) => ({
      ...a,
      estado: a.estado === 'asistio' || a.estado === 'tarde' ? 'asistio' : 'falto',
    })),
  );
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const total = asistentes.filter((a) => a.estado === 'asistio' || a.estado === 'tarde').length;
  function guardar() {
    try {
      onSave(asistentes, mensaje);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'No se pudo guardar el registro. Inténtalo de nuevo.',
      );
    }
  }
  return (
    <Sheet
      title={sesion.tema}
      description={`${formatFechaLarga(sesion.fecha)} · ${sesion.horaInicio}–${sesion.horaFin} · ${sesion.codigo}`}
      wide
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-falcon-default" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={guardar}>
            Guardar registro
          </button>
        </>
      }
    >
      <div className="stack">
        {error && (
          <Alert tone="riesgo" title="No se guardó el registro">
            {error}
          </Alert>
        )}
        <div className="ui-row ui-row--between ui-row--wrap">
          <strong>
            {total} de {asistentes.length} asistentes
          </strong>
          <span className="small muted">
            Formato {sesion.tipo === 'individual' ? '06' : '07'} · {sesion.semestreId}
          </span>
        </div>
        <table className="attendance-students">
          <caption className="sr-only">Asistencia de los estudiantes de esta sesión</caption>
          <thead>
            <tr>
              <th scope="col">Estudiante</th>
              <th scope="col">Asistió</th>
              <th scope="col">Faltó</th>
            </tr>
          </thead>
          <tbody>
            {asistentes.map((asistente) => {
              const estudiante = estudiantePorId(asistente.estudianteId);
              const nombre = estudiante ? nombreCompleto(estudiante) : asistente.estudianteId;
              return (
                <tr className="attendance-student" key={asistente.estudianteId}>
                  <th scope="row">
                    <strong>{nombre}</strong>
                    <span className="cell-note mono">
                      {estudiante?.codigo ?? asistente.estudianteId}
                    </span>
                  </th>
                  {(['asistio', 'falto'] as const).map((estado) => (
                    <td key={estado}>
                      <label className="attendance-choice">
                        <input
                          type="radio"
                          name={`asistencia-${asistente.estudianteId}`}
                          value={estado}
                          checked={asistente.estado === estado}
                          onChange={() =>
                            setAsistentes((lista) =>
                              lista.map((alumno) =>
                                alumno.estudianteId === asistente.estudianteId
                                  ? {
                                      ...alumno,
                                      estado,
                                      horaRegistro:
                                        estado === 'asistio'
                                          ? (alumno.horaRegistro ?? sesion.horaInicio)
                                          : null,
                                    }
                                  : alumno,
                              ),
                            )
                          }
                        />
                        <span className="sr-only">
                          {estado === 'asistio' ? 'Asistió' : 'Faltó'}: {nombre}
                        </span>
                      </label>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        <section className="stack stack--sm" aria-label="Acuerdos de tutoría">
          {sesion.acuerdos.length > 0 && (
            <details>
              <summary>Acuerdos anteriores ({sesion.acuerdos.length})</summary>
              <ul className="list">
                {sesion.acuerdos.map((a) => (
                  <li className="list__item" key={a.id}>
                    {a.descripcion}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <label className="field" htmlFor="asistencia-acuerdo">
            <span>Nuevo acuerdo o mensaje</span>
            <textarea
              id="asistencia-acuerdo"
              className="textarea"
              rows={3}
              value={mensaje}
              maxLength={2000}
              onChange={(e) => setMensaje(e.target.value)}
              aria-describedby="asistencia-acuerdo-ayuda"
              placeholder="Escribe el acuerdo de esta sesión…"
            />
          </label>
          <p id="asistencia-acuerdo-ayuda" className="small muted">
            Se mostrará a los estudiantes de esta sesión. Solo verán el acuerdo y la cantidad de
            asistentes.
          </p>
        </section>
        <p className="small muted">Demostración: registro guardado en este navegador.</p>
      </div>
    </Sheet>
  );
}
