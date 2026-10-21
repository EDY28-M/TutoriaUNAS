import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { modalDefinitions } from './modalContent';
import type { AuthModalId, AuthVariant, ModalRow } from './modalContent';

interface AuthModalsProps {
  variant: AuthVariant;
  active: AuthModalId | null;
  onClose(): void;
}

/** Valor o enlace de una fila del modal, con el marcado de la referencia. */
function ModalRowValue({ row }: { row: ModalRow }) {
  if (row.link) {
    return (
      <a
        className="modal__link"
        href={row.link.href}
        {...(row.link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {row.link.text}
      </a>
    );
  }
  return <span className="modal__val">{row.value}</span>;
}

/**
 * Modales emergentes institucionales (Soporte y Privacidad).
 * Reproduce el comportamiento de `login-unas/assets/app.js`: fondo con
 * desenfoque, animación de entrada, cierre con Escape, con el fondo o con
 * los botones, y devolución del foco al elemento que los abrió.
 */
export function AuthModals({ variant, active, onClose }: AuthModalsProps) {
  const [entered, setEntered] = useState(false);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return undefined;
    previousFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.classList.add('modal-open');
    const frame = requestAnimationFrame(() => {
      setEntered(true);
      document
        .getElementById(`modal-${active}`)
        ?.querySelector<HTMLElement>('[data-close-modal]')
        ?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      const dialog = document.getElementById(`modal-${active}`);
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const disponibles = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((elemento) => elemento.getClientRects().length > 0);
      const primero = disponibles[0];
      const ultimo = disponibles.at(-1);
      if (!primero || !ultimo) return;
      if (event.shiftKey && document.activeElement === primero) {
        event.preventDefault();
        ultimo.focus();
      } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault();
        primero.focus();
      } else if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('modal-open');
      setEntered(false);
      previousFocus.current?.focus();
    };
  }, [active, onClose]);

  const onOverlayClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) onClose();
    },
    [onClose],
  );

  return (
    <>
      <div
        className={`modal-backdrop${active ? ' is-open' : ''}`}
        id="modal-backdrop"
        aria-hidden="true"
        onClick={onClose}
      />
      {modalDefinitions(variant).map((modal) => (
        <div
          key={modal.id}
          className={`modal${active === modal.id && entered ? ' is-active' : ''}`}
          id={`modal-${modal.id}`}
          role={active === modal.id ? 'dialog' : undefined}
          aria-modal={active === modal.id ? true : undefined}
          aria-labelledby={`modal-${modal.id}-title`}
          hidden={active !== modal.id}
          onClick={onOverlayClick}
        >
          <div className="modal__card">
            <div className="modal__head">
              <span className="modal__eyebrow">{modal.eyebrow}</span>
              <button
                type="button"
                className="modal__close"
                data-close-modal
                aria-label="Cerrar modal"
                onClick={onClose}
              >
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            </div>

            <h3 className="modal__title" id={`modal-${modal.id}-title`}>
              {modal.title}
            </h3>
            <p className="modal__sub">{modal.sub}</p>

            <div className="modal__list">
              {modal.rows.map((row) => (
                <div className="modal__row" key={row.label}>
                  <span className="modal__label">{row.label}</span>
                  <ModalRowValue row={row} />
                </div>
              ))}
            </div>

            <button
              type="button"
              className="btn btn-warning w-100 d01__cta modal__action"
              data-close-modal
              onClick={onClose}
            >
              {modal.action}
            </button>
          </div>
        </div>
      ))}
    </>
  );
}
