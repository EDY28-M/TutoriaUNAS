import type { ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert } from './icons';

type TonoAlerta = 'info' | 'ok' | 'alerta' | 'riesgo';

/**
 * Traducción del tono del aviso a las clases reales de `ui.css`
 * (`.alert--info|ok|warn|danger`). Sin esta tabla, «alerta» y «riesgo» emitían
 * `alert--alerta` y `alert--riesgo`, que no existen: el aviso salía gris neutro.
 */
const CLASES: Record<TonoAlerta, string> = {
  info: 'alert--info',
  ok: 'alert--ok',
  alerta: 'alert--warn',
  riesgo: 'alert--danger',
};

const iconos: Record<TonoAlerta, ReactNode> = {
  info: <Info />,
  ok: <CircleCheck />,
  alerta: <TriangleAlert />,
  riesgo: <CircleAlert />,
};

interface AlertProps {
  tone?: TonoAlerta;
  title?: string;
  children: ReactNode;
}

/** Aviso contextual con icono según su naturaleza. */
export function Alert({ tone = 'info', title, children }: AlertProps) {
  return (
    <div className={`alert ${CLASES[tone]}`} role={tone === 'riesgo' ? 'alert' : undefined}>
      {iconos[tone]}
      {tone === 'info' && title ? (
        <details className="alert__details">
          <summary>
            {title}
            <span className="sr-only"> · Ver explicación</span>
          </summary>
          <p>{children}</p>
        </details>
      ) : (
        <div>
          {title && <strong>{title}</strong>}
          <p>{children}</p>
        </div>
      )}
    </div>
  );
}
