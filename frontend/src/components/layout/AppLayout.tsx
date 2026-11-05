import { Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from '../ui/icons';
import { Sidebar } from '../navigation/Sidebar';
import { Topbar } from './Topbar';
import { RouteContent } from './RouteContent';
import { PageLoading } from '../ui/PageLoading';
import { Alert } from '../ui/Alert';
import { ApiBoundary } from './ApiBoundary';
import { navigation } from '../../data/navegacion';
import { useAuth } from '../../hooks/useAuth';
import { useSistema } from '../../hooks/useSistema';
import { API_MODE } from '../../services/apiConfig';
import { guardarPreferenciasApi } from '../../services/apiSistema';
import {
  DISPLAY_PREFERENCES_KEY as PREFERENCES_KEY,
  parseDisplayPreferences,
  serializeDisplayPreferences,
} from '../../utils/displayPreferences';
import '../../styles/ui.css';
import '../../styles/falcon-layout.css';
import '../../styles/app.css';
import '../../styles/portal-surfaces.css';

function subscribePreferences(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener('unas:preferences', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('unas:preferences', callback);
  };
}
function preferenceSnapshot() {
  try {
    return localStorage.getItem(PREFERENCES_KEY) ?? '{}';
  } catch {
    return '{}';
  }
}
function subscribeMobile(callback: () => void) {
  const query = window.matchMedia('(max-width: 1199px)');
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
}
function mobileSnapshot() {
  return window.matchMedia('(max-width: 1199px)').matches;
}

export function AppLayout() {
  const { user } = useAuth();
  const sistema = useSistema();
  const [menuOpen, setMenuOpen] = useState(false);
  const [errorMenu, setErrorMenu] = useState('');
  const guardandoMenu = useRef(false);
  const esMovil = useSyncExternalStore(subscribeMobile, mobileSnapshot, () => false);
  const rawPreferences = useSyncExternalStore(subscribePreferences, preferenceSnapshot, () => '{}');
  const preferences = useMemo(() => parseDisplayPreferences(rawPreferences), [rawPreferences]);
  const { pathname, search } = useLocation();
  const [rutaVisible, setRutaVisible] = useState(`${pathname}${search}`);
  const mainRef = useRef<HTMLElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const navigationFromDrawer = useRef(false);

  if (rutaVisible !== `${pathname}${search}`) {
    setRutaVisible(`${pathname}${search}`);
    setMenuOpen(false);
  }

  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [pathname]);

  // El drawer retiene el foco, bloquea el scroll del fondo y devuelve el foco al botón.
  useEffect(() => {
    if (!menuOpen || !esMovil) return undefined;
    const anterior = document.activeElement as HTMLElement | null;
    const contenidoPrincipal = mainRef.current;
    const scrollAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const elementos = () =>
      Array.from(
        sidebarRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex="0"]',
        ) ?? [],
      ).filter((elemento) => elemento.getClientRects().length > 0);
    elementos()[0]?.focus();
    function alPulsar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        setMenuOpen(false);
      }
      if (evento.key !== 'Tab') return;
      const disponibles = elementos();
      const primero = disponibles[0];
      const ultimo = disponibles.at(-1);
      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimo?.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero?.focus();
      }
    }
    document.addEventListener('keydown', alPulsar);
    return () => {
      document.body.style.overflow = scrollAnterior;
      document.removeEventListener('keydown', alPulsar);
      if (navigationFromDrawer.current) {
        contenidoPrincipal?.focus({ preventScroll: true });
        navigationFromDrawer.current = false;
      } else {
        anterior?.focus({ preventScroll: true });
      }
    };
  }, [menuOpen, esMovil]);

  const reducida = preferences.sidebarMini && !esMovil;
  const segmento = pathname.split('/')[2] ?? 'dashboard';
  // Rutas de detalle (/rol/modulo/:id): el módulo se vuelve enlace y el detalle cierra la ruta.
  const detalle =
    pathname.split('/').length > 3
      ? segmento === 'instrumentos'
        ? 'Formulario'
        : 'Expediente'
      : null;
  const grupoActual = user
    ? navigation[user.role].find((grupo) =>
        grupo.items.some(
          (item) =>
            item.path.split('?')[0] === segmento ||
            item.children?.some((hijo) => hijo.path.split('?')[0] === segmento),
        ),
      )
    : undefined;
  const itemActual =
    grupoActual?.items
      .flatMap((item) => item.children ?? [item])
      .find((item) => item.path === `${segmento}${search}`) ??
    grupoActual?.items.find((item) => item.path === segmento) ??
    grupoActual?.items.find((item) => item.path.split('?')[0] === segmento);

  async function alternarMenu() {
    if (esMovil) {
      setMenuOpen((valor) => !valor);
      return;
    }
    const nuevas = { ...preferences, sidebarMini: !preferences.sidebarMini };
    if (API_MODE) {
      if (!sistema || guardandoMenu.current) return;
      guardandoMenu.current = true;
      setErrorMenu('');
      try {
        await guardarPreferenciasApi({ ...sistema.preferencias, pantalla: nuevas });
      } catch (error) {
        setErrorMenu(
          error instanceof Error ? error.message : 'No se pudo guardar el estado del menú.',
        );
      } finally {
        guardandoMenu.current = false;
      }
      return;
    }
    localStorage.setItem(PREFERENCES_KEY, serializeDisplayPreferences(nuevas));
    window.dispatchEvent(new Event('unas:preferences'));
  }

  return (
    <div
      className={`container app-shell${reducida ? ' app-shell--mini' : ''}${preferences.fullWidth ? ' app-shell--wide' : ''}${preferences.compactTables ? ' app-shell--compact' : ''}`}
    >
      <aside
        ref={sidebarRef}
        id="app-sidebar"
        className={`sidebar navbar navbar-light navbar-vertical navbar-expand-xl${reducida ? ' sidebar--mini' : ''}${menuOpen && esMovil ? ' sidebar--open' : ''}`}
        role={menuOpen && esMovil ? 'dialog' : undefined}
        aria-modal={menuOpen && esMovil ? true : undefined}
        aria-label="Módulos del portal"
        inert={esMovil && !menuOpen}
      >
        <Sidebar
          mini={reducida}
          onToggleMini={alternarMenu}
          onNavigate={() => {
            if (menuOpen && esMovil) navigationFromDrawer.current = true;
            setMenuOpen(false);
          }}
          onCerrar={() => setMenuOpen(false)}
        />
      </aside>
      <button
        type="button"
        className={`sidebar-scrim${menuOpen && esMovil ? ' sidebar-scrim--open' : ''}`}
        aria-label="Cerrar el menú de navegación"
        aria-hidden={!menuOpen || !esMovil}
        inert={!menuOpen || !esMovil}
        tabIndex={-1}
        onClick={() => setMenuOpen(false)}
      />
      <div className="app-main content" inert={menuOpen && esMovil}>
        <Topbar
          menuOpen={menuOpen && esMovil}
          menuExpanded={esMovil ? menuOpen : !reducida}
          onToggleMenu={alternarMenu}
        />
        <main id="main-content" className="workspace" ref={mainRef} tabIndex={-1}>
          <div
            className={`workspace__inner${segmento === 'dashboard' ? ' workspace__inner--dashboard' : ''}`}
          >
            {errorMenu && (
              <Alert tone="riesgo" title="No se guardó el ajuste del menú">
                {errorMenu}
              </Alert>
            )}
            {user && (
              <nav className="app-breadcrumbs" aria-label="Ruta de navegación">
                <ol>
                  <li aria-current={segmento === 'dashboard' ? 'page' : undefined}>
                    {segmento === 'dashboard' ? (
                      'Inicio'
                    ) : (
                      <Link to={`/${user.role}/dashboard`}>Inicio</Link>
                    )}
                  </li>
                  {segmento !== 'dashboard' && (
                    <>
                      <li aria-hidden="true">
                        <ChevronRight />
                      </li>
                      {detalle ? (
                        <>
                          <li>
                            <Link to={`/${user.role}/${segmento}`}>
                              {itemActual?.label ?? 'Módulo'}
                            </Link>
                          </li>
                          <li aria-hidden="true">
                            <ChevronRight />
                          </li>
                          <li aria-current="page">{detalle}</li>
                        </>
                      ) : (
                        <li aria-current="page">{itemActual?.label ?? 'Detalle'}</li>
                      )}
                    </>
                  )}
                </ol>
              </nav>
            )}
            <Suspense fallback={<PageLoading />}>
              <ApiBoundary>
                <RouteContent />
              </ApiBoundary>
            </Suspense>
          </div>
        </main>
        <footer className="app-footer">
          <span>© 2026 UNAS · Sistema de Tutoría Universitaria</span>
          <span>
            Oficina de Tutoría{' '}
            {user && (
              <>
                <span aria-hidden="true">·</span>
                <Link to={`/${user.role}/preferencias`}>Ajustes de pantalla</Link>
              </>
            )}
          </span>
        </footer>
      </div>
    </div>
  );
}
