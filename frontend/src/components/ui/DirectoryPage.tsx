import type { ReactNode } from 'react';
import { Stat } from './Stat';
import { MetricGroup } from './MetricGroup';
import '../../assets/vendor/fontawesome.min.css';
import '../../styles/directory.css';

export function DirectoryPage({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`directory-page ${className}`.trim()}>{children}</div>;
}

interface DirectoryMetric {
  label: string;
  value: ReactNode;
  note: string;
  icon: ReactNode;
  tone?: 'warning' | 'default';
}

/** Resumen del padrón completo; los filtros solo modifican el listado. */
export function DirectorySummary({
  label,
  value,
  note,
  icon,
  percent,
  metrics,
}: DirectoryMetric & { percent: number; metrics: DirectoryMetric[] }) {
  const progress = Math.min(100, Math.max(0, percent));
  const parts = typeof value === 'string' ? value.split(' / ') : [];
  return (
    <MetricGroup label="Resumen del semestre" className="directory-summary">
      <Stat
        label={label}
        value={parts.length === 2 ? `${progress}%` : value}
        note={parts.length === 2 ? `${parts[0]} de ${parts[1]} ${note}` : note}
        icon={icon}
      />
      {metrics.map((metric) => (
        <Stat
          key={metric.label}
          label={metric.label}
          value={metric.value}
          note={metric.note}
          icon={metric.icon}
        />
      ))}
    </MetricGroup>
  );
}

export function DirectoryViews({
  views,
}: {
  views: { label: string; count: number; active: boolean; onClick(): void }[];
}) {
  return (
    <div className="directory-views" role="group" aria-label="Vistas del listado">
      {views.map((view) => (
        <button type="button" key={view.label} aria-pressed={view.active} onClick={view.onClick}>
          {view.label}
          <span>{view.count}</span>
        </button>
      ))}
    </div>
  );
}

export function DirectoryDisclosure({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="directory-disclosure">
      <summary>
        <span>
          <i className="fa-solid fa-circle-info" aria-hidden="true" />
          {title}
        </span>
        <i className="fa-solid fa-chevron-down" aria-hidden="true" />
      </summary>
      <div className="directory-disclosure__body">{children}</div>
    </details>
  );
}
