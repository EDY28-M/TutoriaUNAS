import type { ReactNode } from 'react';

interface PageHeadingProps {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

/** Encabezado de página con la sección, el título y las acciones principales. */
export function PageHeading({ eyebrow, title, description, actions, className }: PageHeadingProps) {
  return (
    <header className={`page-head${className ? ` ${className}` : ''}`}>
      <div className="page-head__text">
        <p className="sr-only">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-head__actions">{actions}</div>}
    </header>
  );
}
