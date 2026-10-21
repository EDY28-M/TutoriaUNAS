import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { IconoBase, X } from './icons';

/** Filtros del calendario en un panel nativo, anclado a la esquina de la cabecera. */
export function CalendarFilters({
  children,
  activeCount,
  onReset,
  nombre = 'calendario',
}: {
  children: ReactNode;
  activeCount: number;
  onReset(): void;
  nombre?: 'calendario' | 'sesiones';
}) {
  const etiqueta = nombre === 'calendario' ? 'del calendario' : 'de sesiones';
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    if (!open) return;
    function positionPanel() {
      const anchor = trigger.current?.getBoundingClientRect();
      const popup = panel.current;
      if (!anchor || !popup) return;
      if (anchor.bottom < 0 || anchor.top > innerHeight) {
        popup.hidePopover();
        return;
      }
      const bounds = popup.getBoundingClientRect();
      const below = anchor.bottom + 8;
      const top =
        below + bounds.height <= innerHeight - 12 ? below : anchor.top - bounds.height - 8;
      popup.style.left = `${Math.max(12, Math.min(anchor.right - bounds.width, innerWidth - bounds.width - 12))}px`;
      popup.style.top = `${Math.max(12, Math.min(top, innerHeight - bounds.height - 12))}px`;
    }
    positionPanel();
    panel.current?.querySelector('select')?.focus({ preventScroll: true });
    window.addEventListener('resize', positionPanel);
    window.addEventListener('scroll', positionPanel, true);
    return () => {
      window.removeEventListener('resize', positionPanel);
      window.removeEventListener('scroll', positionPanel, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={`btn btn-falcon-default calendar-filter-trigger${activeCount ? ' calendar-filter-trigger--active' : ''}`}
        aria-expanded={open}
        aria-controls={id}
        aria-haspopup="dialog"
        aria-label={
          activeCount ? `Filtros ${etiqueta}: ${activeCount} activos` : `Filtros ${etiqueta}`
        }
        popoverTarget={id}
      >
        <IconoBase nombre="fa-solid fa-filter" aria-hidden="true" />
        Filtros
        {activeCount > 0 && (
          <span className="calendar-filter-count" aria-hidden="true">
            {activeCount}
          </span>
        )}
      </button>
      <div
        ref={panel}
        id={id}
        popover="auto"
        role="dialog"
        aria-label={`Filtros ${etiqueta}`}
        className="calendar-filter-popover"
        onToggle={(event) => setOpen(event.currentTarget.matches(':popover-open'))}
      >
        <div className="calendar-filter-popover__head">
          <strong>Filtrar {nombre}</strong>
          <button
            type="button"
            className="icon-btn"
            aria-label="Cerrar filtros"
            onClick={() => panel.current?.hidePopover()}
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="calendar-filter-popover__body">{children}</div>
        <div className="calendar-filter-popover__foot">
          <button type="button" className="btn btn-link btn-sm" onClick={onReset}>
            Restablecer
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => panel.current?.hidePopover()}
          >
            Listo
          </button>
        </div>
      </div>
    </>
  );
}
