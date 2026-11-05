import { useState } from 'react';
import type { ReactNode } from 'react';
import { DirectoryPage } from './DirectoryPage';
import { Sheet } from './Sheet';
import '../../styles/compact-pages.css';

export function CompactPage({ children }: { children: ReactNode }) {
  return <DirectoryPage className="compact-page forms-panel">{children}</DirectoryPage>;
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
