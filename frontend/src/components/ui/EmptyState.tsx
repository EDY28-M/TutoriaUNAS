import type { ReactNode } from 'react';
import { Inbox } from './icons';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

/** Estado vacío con explicación y, si corresponde, una acción sugerida. */
export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="empty-state" role="status">
      <span className="empty-state__illustration" aria-hidden="true">
        {icon ?? <Inbox />}
      </span>
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
