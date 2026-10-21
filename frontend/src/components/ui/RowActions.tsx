import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/** El portal-popover nativo evita recortes en tablas y permite cerrar con Escape. */
export function RowActions({ children, label }: { children: ReactNode; label: string }) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    if (!open) return;
    function positionMenu() {
      const anchor = trigger.current?.getBoundingClientRect();
      const popup = menu.current;
      if (!anchor || !popup) return;
      if (anchor.bottom < 0 || anchor.top > window.innerHeight) {
        popup.hidePopover();
        return;
      }
      const bounds = popup.getBoundingClientRect();
      const below = anchor.bottom + 4;
      const top =
        below + bounds.height <= window.innerHeight - 8 ? below : anchor.top - bounds.height - 4;
      popup.style.left = `${Math.max(8, Math.min(anchor.right - bounds.width, window.innerWidth - bounds.width - 8))}px`;
      popup.style.top = `${Math.max(8, Math.min(top, window.innerHeight - bounds.height - 8))}px`;
    }
    positionMenu();
    window.addEventListener('resize', positionMenu);
    window.addEventListener('scroll', positionMenu, true);
    return () => {
      window.removeEventListener('resize', positionMenu);
      window.removeEventListener('scroll', positionMenu, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="icon-btn icon-btn--sm"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        popoverTarget={id}
      >
        <i className="fa-solid fa-ellipsis" aria-hidden="true" />
      </button>
      <div
        id={id}
        ref={menu}
        popover="auto"
        className="ui-row-actions"
        onToggle={(event) => setOpen(event.currentTarget.matches(':popover-open'))}
        onClick={() => menu.current?.hidePopover()}
      >
        {children}
      </div>
    </>
  );
}
