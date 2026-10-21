import { Badge, StatusBadge } from '../ui/StatusBadge';
import { nombreTutor } from '../../data/tutoria';
import { cantidadAsistentes } from '../../services/sessionAttendance';
import { formatFecha } from '../../utils/fechas';
import type { Sesion } from '../../types/domain';

/** Detalle común del calendario, sin registros individuales de asistencia. */
export function SessionDetails({ sesion }: { sesion: Sesion }) {
  return (
    <div className="stack">
      <div className="ui-row ui-row--wrap ui-row--tight">
        <StatusBadge estado={sesion.estado} />
        <Badge tone="info">{sesion.tipo === 'individual' ? 'Individual' : 'Grupal'}</Badge>
        <Badge tone="neutro">
          {sesion.modalidad === 'virtual'
            ? 'Virtual'
            : sesion.modalidad === 'mixta'
              ? 'Mixta'
              : 'Presencial'}
        </Badge>
      </div>
      <dl className="meta-list">
        <div>
          <dt>Docente tutor</dt>
          <dd>{nombreTutor(sesion.tutorId)}</dd>
        </div>
        <div>
          <dt>Lugar</dt>
          <dd>{sesion.lugar}</dd>
        </div>
        <div>
          <dt>{sesion.estado === 'realizada' ? 'Asistentes' : 'Convocados'}</dt>
          <dd>
            {sesion.estado === 'realizada' ? cantidadAsistentes(sesion) : sesion.asistentes.length}{' '}
            estudiantes
          </dd>
        </div>
        <div>
          <dt>Código de sesión</dt>
          <dd className="mono">{sesion.codigo}</dd>
        </div>
      </dl>
      <div>
        <h3 className="field__label">Objetivo</h3>
        <p className="small muted">{sesion.objetivo}</p>
      </div>
      <div className="stack stack--sm">
        <h3 className="field__label">Acuerdos de la sesión</h3>
        {sesion.acuerdos.length ? (
          <ul className="list">
            {sesion.acuerdos.map((acuerdo) => (
              <li key={acuerdo.id} className="list__item">
                <span className="list__body">
                  <strong>{acuerdo.descripcion}</strong>
                  {acuerdo.fechaCompromiso && (
                    <p>Compromiso: {formatFecha(acuerdo.fechaCompromiso)}</p>
                  )}
                </span>
                <StatusBadge estado={acuerdo.estado} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="small muted">
            {sesion.estado === 'programada'
              ? 'Los acuerdos se publican después de la sesión.'
              : 'Sin acuerdos registrados.'}
          </p>
        )}
      </div>
    </div>
  );
}
