import { useState } from 'react';
import { PageHeading } from '../ui/PageHeading';
import { SessionCalendar } from './SessionCalendar';
import { SessionDetails } from './SessionDetails';
import { CalendarFilters } from '../ui/CalendarFilters';
import { useAuth } from '../../hooks/useAuth';
import { docentes, nombreCompleto } from '../../data/personas';
import { EmptyState } from '../ui/EmptyState';
import { Sheet } from '../ui/Sheet';
import { Alert } from '../ui/Alert';
import { usePortal } from '../../hooks/usePortal';
import { hayCruce } from '../../data/academico';
import { formatFechaLarga, formatHora } from '../../utils/fechas';

/** Una única vista de sesiones; detalle y acuerdos al abrir cada evento. */
export function SessionOverview() {
  const { user } = useAuth();
  const coordinacion = user?.role === 'coordinacion';
  const { estudiante, sesiones: todasSesiones } = usePortal();
  const [tutorId, setTutorId] = useState('todos');
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const detalle = todasSesiones.find((s) => s.id === detalleId);
  const sesiones =
    coordinacion && tutorId !== 'todos'
      ? todasSesiones.filter((sesion) => sesion.tutorId === tutorId)
      : todasSesiones;
  const tutores = docentes.filter((docente) =>
    todasSesiones.some((sesion) => sesion.tutorId === docente.id),
  );

  if (!coordinacion && !estudiante) {
    return (
      <EmptyState
        title="Sin datos del estudiante"
        description="La cuenta no tiene expediente asociado."
      />
    );
  }

  const cruce =
    estudiante && detalle?.tipo === 'individual'
      ? hayCruce(
          estudiante.id,
          new Date(`${detalle.fecha}T12:00:00`).getDay(),
          detalle.horaInicio,
          detalle.horaFin,
        )
      : null;

  return (
    <>
      <PageHeading
        eyebrow={coordinacion ? 'Coordinación' : 'Estudiante · Mi tutoría'}
        title={coordinacion ? 'Sesiones de tutoría' : 'Mis sesiones de tutoría'}
        description="Selecciona una sesión para consultar su detalle."
        actions={
          coordinacion ? (
            <CalendarFilters
              nombre="sesiones"
              activeCount={Number(tutorId !== 'todos')}
              onReset={() => setTutorId('todos')}
            >
              <label className="field">
                <span>Docente tutor</span>
                <select
                  aria-label="Docente tutor"
                  className="select"
                  value={tutorId}
                  onChange={(event) => setTutorId(event.target.value)}
                >
                  <option value="todos">Todos los docentes</option>
                  {tutores.map((docente) => (
                    <option key={docente.id} value={docente.id}>
                      {nombreCompleto(docente)}
                    </option>
                  ))}
                </select>
              </label>
            </CalendarFilters>
          ) : undefined
        }
      />
      <SessionCalendar
        sesiones={sesiones}
        onAbrir={(sesion) => setDetalleId(sesion.id)}
        compact={coordinacion}
      />

      {detalle && (
        <Sheet
          title={detalle.tema}
          description={`${formatFechaLarga(detalle.fecha)} · ${formatHora(detalle.horaInicio)} a ${formatHora(detalle.horaFin)}`}
          onClose={() => setDetalleId(null)}
          footer={
            <button
              type="button"
              className="btn btn-falcon-default"
              onClick={() => setDetalleId(null)}
            >
              Cerrar
            </button>
          }
        >
          <div className="stack">
            {cruce && (
              <Alert tone="alerta" title="Coincide con una clase">
                {cruce.titulo} · {cruce.horaInicio}–{cruce.horaFin}
              </Alert>
            )}
            <SessionDetails sesion={detalle} />
          </div>
        </Sheet>
      )}
    </>
  );
}
