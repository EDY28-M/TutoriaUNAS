import { useCallback, useState } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { AuthModals } from '../auth/AuthModals';
import type { AuthModalId } from '../auth/modalContent';
import crest from '../../assets/unas-logo-mark.png';
import forest from '../../assets/selva.jpg';
import '../../assets/vendor/fontawesome.min.css';
import '../../styles/auth.css';

/** Acceso UNAS: proporciones Falcon, fotografía local y formulario compartido. */
export function AuthLayout() {
  const { pathname } = useLocation();
  const variant = pathname.startsWith('/recuperar') ? 'recovery' : 'login';
  const [modal, setModal] = useState<AuthModalId | null>(null);
  const closeModal = useCallback(() => setModal(null), []);

  return (
    <main id="main-content" className="d01">
      <div className={`d01__frame${variant === 'recovery' ? ' d01__frame--recovery' : ''}`}>
        <section className="d01__brand" aria-label="Universidad Nacional Agraria de la Selva">
          <img className="d01__photo" src={forest} alt="" width="1400" height="875" />

          <Link className="d01__logo" to="/login" aria-label="UNAS · Inicio de sesión">
            <img className="d01__crest" src={crest} alt="Escudo UNAS" width="54" height="64" />
            <span className="d01__brand-text">
              <span className="d01__brand-eyebrow">Universidad Nacional</span>
              <span className="d01__brand-name">Agraria de la Selva</span>
            </span>
          </Link>

          <div className="d01__pitch">
            <p className="d01__tag">Sistema de Tutoría Universitaria</p>
            <h1 className="d01__headline">
              {variant === 'recovery'
                ? 'Vuelve a conectar con tu acompañamiento.'
                : 'Acompañamiento que germina desde el primer ciclo.'}
            </h1>
            {variant === 'recovery' && (
              <p className="d01__brand-description">
                Recupera tu acceso y continúa tu camino universitario.
              </p>
            )}
          </div>

          <p className="d01__motto">Tierra que sustenta, tutoría que orienta.</p>
        </section>

        <section className="d01__panel">
          <header className="d01__panel-head">
            {variant === 'recovery' && (
              <Link to="/login" className="d01__back-btn">
                <i className="fa-solid fa-arrow-left" aria-hidden="true" />
                Volver al login
              </Link>
            )}
            <span className="d01__head-note">
              {variant === 'recovery' ? 'Recuperación de acceso' : 'Acceso institucional'}
            </span>
          </header>

          <Outlet />

          <footer className="d01__foot">
            <span>© 2026 UNAS · Oficina de Tutoría</span>
            <span className="d01__foot-links">
              <button
                type="button"
                className="d01__link-btn"
                data-open-modal="soporte"
                onClick={() => setModal('soporte')}
              >
                Soporte
              </button>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                className="d01__link-btn"
                data-open-modal="privacidad"
                onClick={() => setModal('privacidad')}
              >
                Privacidad
              </button>
            </span>
          </footer>
        </section>
      </div>

      <AuthModals variant={variant} active={modal} onClose={closeModal} />
    </main>
  );
}
