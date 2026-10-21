import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  accent?: boolean;
  flat?: boolean;
}

/** Superficie base del sistema: borde suave, esquinas redondeadas y sombra leve. */
export function Card({ children, className = '', accent = false, flat = false }: CardProps) {
  const clases = ['card', accent ? 'card--accent' : '', flat ? 'card--flat' : '', className]
    .filter(Boolean)
    .join(' ');
  return <section className={clases}>{children}</section>;
}

interface CardHeadProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function CardHead({ title, description, actions }: CardHeadProps) {
  return (
    <header className="card-header card__head">
      <div className="card__heading">
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="card__head-actions">{actions}</div>}
    </header>
  );
}

export function CardBody({ children, flush = false }: { children: ReactNode; flush?: boolean }) {
  return (
    <div className={`card-body card__body${flush ? ' card__body--flush' : ''}`}>{children}</div>
  );
}

export function CardFoot({ children }: { children: ReactNode }) {
  return <footer className="card-footer card__foot">{children}</footer>;
}
