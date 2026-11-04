import { useState } from 'react';
import type { ReactNode } from 'react';
import { Sheet } from './Sheet';
import '../../styles/compact-pages.css';

export function CompactPage({ children }: { children: ReactNode }) {
  return <div className="compact-page forms-panel">{children}</div>;
}

export function CompactSearch({
  value,
  onChange,
  label = 'Buscar',
}: {
  value: string;
  onChange(value: string): void;
  label?: string;
}) {
  return (
    <label className="compact-search">
      <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
      <input
        type="search"
        aria-label={label}
        placeholder={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function SecondaryPanel({
  title,
  children,
  wide = true,
}: {
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-falcon-default" onClick={() => setOpen(true)}>
        {title}
      </button>
      {open && (
        <Sheet title={title} wide={wide} onClose={() => setOpen(false)}>
          {children}
        </Sheet>
      )}
    </>
  );
}
