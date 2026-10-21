import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, LogOut, Menu, X } from '../ui/icons';
import escudo from '../../assets/unas-logo-mark.png';
import { navigation } from '../../data/navegacion';
import type { NavigationItem } from '../../data/navegacion';
import { useAuth } from '../../hooks/useAuth';
import { usePortal } from '../../hooks/usePortal';
import { escuelas } from '../../data/catalogos';
import { abreviaturaEscuela, iniciales } from '../../data/personas';
import { roleDetails } from '../../utils/roles';
import { preloadPortalRoute } from '../../routes/portalPages';

interface SidebarProps {
  onNavigate(): void;
  mini?: boolean;
  onToggleMini?(): void;
  onCerrar?(): void;
}

function itemActivo(item: NavigationItem, pathname: string, search: string, role: string) {
  const [ruta, consulta = ''] = item.path.split('?');
  const destino = `/${role}/${ruta}`;
  const coincideRuta = pathname === destino || pathname.startsWith(`${destino}/`);
  if (!coincideRuta) return false;

  const actuales = new URLSearchParams(search);
  if (role === 'tutor' && ruta === 'instrumentos' && !actuales.has('ambito'))
    actuales.set('ambito', 'propios');
  const esperados = new URLSearchParams(consulta);

  if (consulta) {
    return Array.from(esperados.entries()).every(([clave, valor]) => actuales.get(clave) === valor);
  }

  if (actuales.has('estado') && (ruta === 'instrumentos' || ruta === 'derivaciones')) {
    return false;
  }

  return true;
}

export function Sidebar({ onNavigate, mini = false, onToggleMini, onCerrar }: SidebarProps) {
  const { user, logout } = useAuth();
  const portal = usePortal();
  const { pathname, search } = useLocation();
  const ubicacion = `${pathname}${search}`;
  const grupos = user ? navigation[user.role] : [];
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({});
  const [rutaVisible, setRutaVisible] = useState(ubicacion);
  const hintId = useId();
  const [hint, setHint] = useState<{ label: string; left: number; top: number } | null>(null);
  const preloadTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function cancelPreload() {
    clearTimeout(preloadTimer.current);
  }
  function prepareRoute(path: string, immediate = false) {
    cancelPreload();
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } })
      .connection;
    if (connection?.saveData) return;
    if (immediate) preloadPortalRoute(path);
    else preloadTimer.current = setTimeout(() => preloadPortalRoute(path), 80);
  }
  useEffect(() => () => clearTimeout(preloadTimer.current), []);

  function showHint(element: HTMLElement, label: string) {
    if (!mini) return;
    const bounds = element.getBoundingClientRect();
    setHint({ label, left: bounds.right + 12, top: bounds.top + bounds.height / 2 });
  }
  useEffect(() => {
    const hideHint = () => setHint(null);
    window.addEventListener('resize', hideHint);
    window.addEventListener('scroll', hideHint, true);
    return () => {
      window.removeEventListener('resize', hideHint);
      window.removeEventListener('scroll', hideHint, true);
    };
  }, []);

  // Un módulo abierto desde una tarjeta despliega su categoría automáticamente.
  if (rutaVisible !== ubicacion) {
    setRutaVisible(ubicacion);
    const nuevas: Record<string, boolean> = {};
    grupos.forEach((grupo) =>
      grupo.items.forEach((item) => {
        if (item.children?.some((hijo) => itemActivo(hijo, pathname, search, user?.role ?? ''))) {
          nuevas[item.path] = true;
        }
      }),
    );
    setExpandidos({ ...expandidos, ...nuevas });
  }

  if (!user) return null;

  const ambito =
    user.role === 'coordinacion'
      ? 'Vicerrectorado Académico'
      : (escuelas.find((escuela) => escuela.id === portal.escuelaId)?.nombre ??
        'Escuela profesional');

  function enlace(item: NavigationItem, hijo = false) {
    const Icon = item.icon;
    const valor = item.counter ? portal.contadores[item.counter] : 0;
    const activo =
      itemActivo(item, pathname, search, user!.role) ||
      (mini && item.children?.some((hijo) => itemActivo(hijo, pathname, search, user!.role)));
    return (
      <Link
        to={`/${user!.role}/${item.path}`}
        className={`nav-link sidebar__link${hijo ? ' sidebar__link--child' : ''}${activo ? ' active' : ''}`}
        aria-current={activo ? 'page' : undefined}
        aria-label={mini ? item.label : undefined}
        aria-describedby={mini && hint?.label === item.label ? hintId : undefined}
        onMouseEnter={(event) => {
          showHint(event.currentTarget, item.label);
          prepareRoute(`/${user!.role}/${item.path}`);
        }}
        onMouseLeave={() => {
          setHint(null);
          cancelPreload();
        }}
        onFocus={(event) => {
          showHint(event.currentTarget, item.label);
          prepareRoute(`/${user!.role}/${item.path}`, true);
        }}
        onBlur={() => {
          setHint(null);
          cancelPreload();
        }}
        onClick={() => {
          setHint(null);
          cancelPreload();
          onNavigate();
        }}
      >
        <Icon aria-hidden="true" />
        <span className="sidebar__link-label">{item.label}</span>
        {item.counter && valor > 0 && (
          <span className="sidebar__link-count" aria-label={`${valor} pendientes`}>
            {valor}
          </span>
        )}
      </Link>
    );
  }

  return (
    <>
      {mini &&
        hint &&
        createPortal(
          <span
            id={hintId}
            role="tooltip"
            className="sidebar-tooltip"
            style={{ left: hint.left, top: hint.top }}
          >
            {hint.label}
          </span>,
          document.body,
        )}
      <div className="sidebar__brand">
        <Link
          to={`/${user.role}/dashboard`}
          className="navbar-brand sidebar__brand-link"
          onClick={onNavigate}
          onMouseEnter={() => prepareRoute(`/${user.role}/dashboard`)}
          onMouseLeave={cancelPreload}
          onFocus={() => prepareRoute(`/${user.role}/dashboard`, true)}
          onBlur={cancelPreload}
          aria-label="Sistema de Tutoría UNAS, ir al panel"
        >
          <img className="sidebar__crest" src={escudo} alt="" width={34} height={40} />
          <span className="sidebar__brand-text">
            <strong>tutoría</strong>
            <small>UNAS · Tingo María</small>
          </span>
        </Link>
        {onToggleMini && (
          <button
            type="button"
            className="sidebar__toggle"
            aria-controls="app-sidebar"
            aria-expanded={!mini}
            aria-label={
              mini ? 'Expandir la barra de navegación' : 'Contraer la barra de navegación'
            }
            title={mini ? 'Expandir la barra' : 'Contraer la barra'}
            onClick={onToggleMini}
          >
            <Menu size={15} aria-hidden="true" />
          </button>
        )}
        {onCerrar && (
          <button
            type="button"
            className="sidebar__close"
            aria-label="Cerrar el menú lateral"
            onClick={onCerrar}
          >
            <X aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="sidebar__context">
        <span>{roleDetails[user.role].label} · 2026-II</span>
        <strong>{ambito}</strong>
        <em>
          {user.role === 'coordinacion' ? 'Administración' : abreviaturaEscuela(portal.escuelaId)}
        </em>
      </div>
      <nav
        aria-label="Navegación principal"
        className="navbar-vertical-content sidebar__nav app-scroll"
      >
        {grupos.map((grupo) => (
          <div className="sidebar__group" key={grupo.title}>
            {grupo.title !== 'Inicio' && (
              <p className="navbar-vertical-label sidebar__group-title">
                <span>{grupo.title}</span>
              </p>
            )}
            <ul>
              {grupo.items.map((item) => {
                if (!item.children || mini) return <li key={item.path}>{enlace(item)}</li>;
                const Icon = item.icon;
                const activo = item.children.some((hijo) =>
                  itemActivo(hijo, pathname, search, user.role),
                );
                const abierto = mini || (expandidos[item.path] ?? activo);
                const valor = item.counter ? portal.contadores[item.counter] : 0;
                const submenuId = `submenu-${user.role}-${item.path}`;
                return (
                  <li
                    className={`sidebar__branch${activo ? ' sidebar__branch--active' : ''}`}
                    key={item.path}
                  >
                    <button
                      type="button"
                      className="nav-link dropdown-indicator sidebar__link sidebar__branch-toggle"
                      aria-expanded={abierto}
                      aria-controls={submenuId}
                      title={mini ? item.label : undefined}
                      onClick={() =>
                        setExpandidos((actuales) => ({ ...actuales, [item.path]: !abierto }))
                      }
                    >
                      <Icon aria-hidden="true" />
                      <span className="sidebar__link-label">{item.label}</span>
                      {valor > 0 && <span className="sidebar__link-count">{valor}</span>}
                      <ChevronRight className="sidebar__chevron" aria-hidden="true" />
                    </button>
                    <ul
                      id={submenuId}
                      className={`nav collapse sidebar__submenu${abierto ? ' show' : ''}`}
                      hidden={!abierto}
                    >
                      {item.children.map((hijo) => (
                        <li key={hijo.path}>{enlace(hijo, true)}</li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="sidebar__foot">
        <div className="ui-row sidebar__foot-row">
          <span className="avatar avatar--sm" aria-hidden="true">
            {iniciales({
              nombres: user.name.split(' ')[0] ?? '',
              apellidos: user.name.split(' ')[1] ?? '',
            })}
          </span>
          <span className="sidebar__foot-info">
            <strong className="truncate">{user.name}</strong>
          </span>
        </div>
        <button
          type="button"
          className="nav-link sidebar__link sidebar__link--boton"
          aria-label="Cerrar sesión"
          title={mini ? 'Cerrar sesión' : undefined}
          onClick={logout}
        >
          <LogOut aria-hidden="true" />
          <span className="sidebar__link-label">Cerrar sesión</span>
        </button>
      </div>
    </>
  );
}
