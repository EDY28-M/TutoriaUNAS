import type { ReactNode } from 'react';

type Tono = 'verde' | 'dorado' | 'violeta' | 'info' | 'alerta' | 'riesgo';

interface StatProps {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  icon?: ReactNode;
  tone?: Tono;
  trend?: { direccion: 'up' | 'down' | 'flat'; texto: string };
  series?: number[];
  ratio?: number;
}

/** Métrica con una ilustración de su objeto o personas y datos legibles. */
export function Stat({
  label,
  value,
  note,
  icon,
  tone = 'verde',
  trend,
  series,
  ratio,
}: StatProps) {
  const max = Math.max(1, ...(series ?? []));
  return (
    <article className={`card stat stat--${tone}`}>
      <div className="card-body stat__body">
        <h2 className="stat__label">{label}</h2>
        <div className="stat__content">
          <p className="stat__value">{value}</p>
        </div>
        {ratio !== undefined ? (
          <span
            className="stat__ring"
            aria-hidden="true"
            style={{
              background: `conic-gradient(var(--green) ${Math.min(100, Math.max(0, ratio))}%, var(--green-soft) 0)`,
            }}
          >
            <span>{icon}</span>
          </span>
        ) : series?.length ? (
          <span className="stat__sparkline" aria-hidden="true">
            {series.map((number, index) => (
              <span key={index}>
                <i style={{ height: `${Math.max(3, (number / max) * 100)}%` }} />
              </span>
            ))}
          </span>
        ) : (
          icon && (
            <span className="stat__visual" aria-hidden="true">
              {icon}
            </span>
          )
        )}
        {(note || trend) && (
          <p className="stat__note">
            {trend && (
              <span className={`stat__trend stat__trend--${trend.direccion}`}>{trend.texto} </span>
            )}
            {note}
          </p>
        )}
      </div>
    </article>
  );
}
