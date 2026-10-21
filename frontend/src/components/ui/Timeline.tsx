import type { ReactNode } from 'react';
import { CircleCheck, CircleDashed, Clock, Send, TriangleAlert, X } from './icons';

type TonoHito = 'neutro' | 'ok' | 'alerta' | 'riesgo' | 'info';

/**
 * Traducción del tono del hito a las clases reales de `ui.css`
 * (`.timeline__marker--ok|warn|danger|info`). El marcador base ya es neutro.
 */
const CLASES: Record<TonoHito, string> = {
  neutro: '',
  ok: 'timeline__marker--ok',
  alerta: 'timeline__marker--warn',
  riesgo: 'timeline__marker--danger',
  info: 'timeline__marker--info',
};

const ICONOS: Record<TonoHito, ReactNode> = {
  neutro: <CircleDashed />,
  ok: <CircleCheck />,
  alerta: <TriangleAlert />,
  riesgo: <X />,
  info: <Send />,
};

export interface Hito {
  titulo: string;
  descripcion?: string;
  fecha?: string;
  tono?: TonoHito;
  icono?: ReactNode;
}

/** Línea de tiempo vertical para historiales y seguimientos. */
export function Timeline({ hitos, etiqueta }: { hitos: Hito[]; etiqueta?: string }) {
  return (
    <ol className="timeline" aria-label={etiqueta}>
      {hitos.map((hito, indice) => (
        <li className="timeline__item" key={`${hito.titulo}-${indice}`}>
          <span
            className={['timeline__marker', CLASES[hito.tono ?? 'neutro']]
              .filter(Boolean)
              .join(' ')}
            aria-hidden="true"
          >
            {hito.icono ?? ICONOS[hito.tono ?? 'neutro']}
          </span>
          <div className="timeline__body">
            <strong>{hito.titulo}</strong>
            {hito.descripcion && <p>{hito.descripcion}</p>}
            {hito.fecha && (
              <span className="timeline__date">
                <Clock
                  size={11}
                  aria-hidden="true"
                  style={{ verticalAlign: '-1px', marginRight: 4 }}
                />
                {hito.fecha}
              </span>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
