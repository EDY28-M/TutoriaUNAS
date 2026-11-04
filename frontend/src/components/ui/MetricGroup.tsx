import { Children } from 'react';
import type { ReactNode } from 'react';

/** El mismo grupo de indicadores para todos los roles y módulos. */
export function MetricGroup({
  label,
  children,
  className = '',
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className="portal-metrics-region" aria-label={label}>
      <div
        className={`portal-metrics ${className}`.trim()}
        data-count={Children.toArray(children).length}
      >
        {children}
      </div>
    </section>
  );
}
