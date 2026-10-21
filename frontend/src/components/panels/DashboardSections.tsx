import { Link } from 'react-router-dom';
import { Card, CardBody, CardHead } from '../ui/Card';
import { ArrowRight, ChevronRight, Clock, MapPin } from '../ui/icons';
import type { Sesion } from '../../types/domain';
import { formatFecha, formatRangoHora } from '../../utils/fechas';

export interface DashboardTask {
  label: string;
  count: number;
  href: string;
  urgent?: boolean;
  description?: string;
}

export function DashboardTasks({ items }: { items: DashboardTask[] }) {
  const pending = items.filter((item) => item.count > 0);
  return (
    <Card className="dashboard-focus-card dashboard-priorities">
      <CardHead title="Tareas pendientes" description="Revisa qué necesitas resolver." />
      <CardBody>
        {pending.length ? (
          <ul className="dashboard-tasks">
            {pending.map((item) => (
              <li key={item.href}>
                <Link to={item.href} className={item.urgent ? 'dashboard-task--urgent' : ''}>
                  <span className="dashboard-task__count">{item.count}</span>
                  <span className="dashboard-task__text">
                    <strong>{item.label}</strong>
                    {item.description && <small>{item.description}</small>}
                  </span>
                  <ChevronRight />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Sin pendientes en este periodo.</p>
        )}
      </CardBody>
    </Card>
  );
}

export function NextSession({ session, href }: { session?: Sesion; href: string }) {
  const fecha = session ? formatFecha(session.fecha).split(' ') : [];
  return (
    <Card className="dashboard-focus-card dashboard-session">
      <CardHead
        title="Próxima sesión"
        actions={
          <Link className="dashboard-text-link" to={href}>
            Ver sesiones <ArrowRight />
          </Link>
        }
      />
      <CardBody>
        {session ? (
          <div className="dashboard-next">
            <time
              className="dashboard-next__date"
              dateTime={session.fecha}
              aria-label={formatFecha(session.fecha)}
            >
              <span>{fecha[1]}</span>
              <strong>{fecha[0]}</strong>
              <small>{fecha[2]}</small>
            </time>
            <div className="dashboard-next__info">
              <span className="dashboard-session__type">
                Sesión {session.tipo} · {session.modalidad}
              </span>
              <h3>{session.tema}</h3>
              <p>
                <Clock />
                {formatRangoHora(session.horaInicio, session.horaFin)}
              </p>
              <p>
                <MapPin />
                {session.lugar}
              </p>
            </div>
          </div>
        ) : (
          <p className="muted">Sin sesiones próximas.</p>
        )}
      </CardBody>
      {session && (
        <div className="dashboard-session__footer">
          <span>
            {session.asistentes.length}{' '}
            {session.asistentes.length === 1 ? 'estudiante convocado' : 'estudiantes convocados'}
          </span>
          <Link to={href}>
            Ver sesión <ArrowRight />
          </Link>
        </div>
      )}
    </Card>
  );
}
