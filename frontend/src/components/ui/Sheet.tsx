import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from './icons';

interface SheetProps {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose(): void;
  wide?: boolean;
}

/**
 * Ventana modal sobre el elemento `dialog` nativo: gestiona el foco, el cierre
 * con Escape y el bloqueo del fondo sin dependencias adicionales.
 */
export function Sheet({ title, description, children, footer, onClose, wide = false }: SheetProps) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const tituloId = useId();

  useEffect(() => {
    const elemento = dialogo.current;
    const focoPrevio = document.activeElement;
    elemento?.showModal();
    return () => {
      elemento?.close();
      if (focoPrevio instanceof HTMLElement) focoPrevio.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogo}
      className={`sheet${wide ? ' sheet--wide' : ''}`}
      aria-labelledby={tituloId}
      onCancel={(evento) => {
        evento.preventDefault();
        onClose();
      }}
      onClose={(evento) => {
        // StrictMode vuelve a abrir el diálogo antes de entregar el evento close
        // de la limpieza inicial. Ese evento no debe cerrar la nueva apertura.
        if (!evento.currentTarget.open) onClose();
      }}
      onClick={(evento) => {
        if (evento.target !== evento.currentTarget) return;
        const limites = evento.currentTarget.getBoundingClientRect();
        if (
          evento.clientX < limites.left ||
          evento.clientX > limites.right ||
          evento.clientY < limites.top ||
          evento.clientY > limites.bottom
        ) {
          onClose();
        }
      }}
    >
      <header className="sheet__head">
        <div>
          <h2 id={tituloId}>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        <button
          type="button"
          className="icon-btn icon-btn--bordered"
          aria-label="Cerrar ventana"
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>
      </header>
      <div className="sheet__body app-scroll" tabIndex={0}>
        {children}
      </div>
      {footer && <footer className="sheet__foot">{footer}</footer>}
    </dialog>
  );
}
