import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calendar } from '../ui/Calendar';
import { Tabs } from '../ui/Tabs';
import type { EventoCalendario } from '../ui/Calendar';
import { nombreTutor } from '../../data/tutoria';
import type { Sesion } from '../../types/domain';
import '../../styles/session-calendar.css';

/** Una sola representación de sesiones para los tres portales, sin bloques de disponibilidad. */
export function SessionCalendar({
  sesiones,
  onAbrir,
  compact = false,
}: {
  sesiones: Sesion[];
  onAbrir(sesion: Sesion): void;
  compact?: boolean;
}) {
  const [parametros, setParametros] = useSearchParams();
  const vista = parametros.get('vista') === 'historial' ? 'historial' : 'agenda';
  const compacto = compact || vista === 'historial';
  const eventos = useMemo<EventoCalendario[]>(
    () =>
      sesiones
        .filter((sesion) =>
          vista === 'historial'
            ? sesion.estado === 'realizada'
            : sesion.estado === 'programada' || sesion.estado === 'reprogramada',
        )
        .map((sesion) => ({
          id: sesion.id,
          fecha: sesion.fecha,
          titulo: sesion.tema,
          hora: `${sesion.horaInicio}–${sesion.horaFin}`,
          tono:
            sesion.tipo === 'grupal' ? 'dorado' : sesion.modalidad === 'virtual' ? 'info' : 'verde',
          detalle: `${sesion.tipo === 'grupal' ? 'Tutoría grupal' : 'Tutoría individual'} · ${nombreTutor(sesion.tutorId)}`,
          lugar: sesion.lugar,
          modalidad: sesion.modalidad,
          etiqueta: sesion.estado,
        })),
    [sesiones, vista],
  );

  return (
    <div
      className={[
        'session-calendar',
        compacto ? 'session-calendar--compact' : '',
        vista === 'historial' ? 'session-calendar--history' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Tabs
        etiqueta="Vistas de sesiones"
        activo={vista}
        items={[
          { id: 'agenda', label: 'Agenda' },
          { id: 'historial', label: 'Historial' },
        ]}
        onChange={(siguiente) =>
          setParametros(
            (actuales) => {
              const nuevos = new URLSearchParams(actuales);
              nuevos.set('vista', siguiente);
              return nuevos;
            },
            { replace: true, preventScrollReset: true },
          )
        }
      />
      <div role="tabpanel" id={`panel-${vista}`} aria-labelledby={`tab-${vista}`}>
        <Calendar
          eventos={eventos}
          etiqueta="sesiones de tutoría"
          vistaInicial="semana"
          maxPorDia={compacto ? 1 : 3}
          legend={
            <>
              <span>
                <span className="dot dot--ok" /> Individual
              </span>
              <span>
                <span className="dot dot--warn" /> Grupal
              </span>
              <span>
                <span className="dot dot--info" /> Individual virtual
              </span>
            </>
          }
          onAbrir={(evento) => {
            const sesion = sesiones.find((item) => item.id === evento.id);
            if (sesion) onAbrir(sesion);
          }}
        />
      </div>
    </div>
  );
}
