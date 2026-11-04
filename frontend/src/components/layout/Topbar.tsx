import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, ChevronRight, LogOut, Menu, Search, Settings2, UserRound, X } from '../ui/icons';
import { useAuth } from '../../hooks/useAuth';
import { usePortal } from '../../hooks/usePortal';
import { navigation } from '../../data/navegacion';
import { estudiantePorId, estudiantes, iniciales } from '../../data/personas';
import { roleDetails } from '../../utils/roles';
import { formatFechaHora } from '../../utils/fechas';

interface TopbarProps {
  menuOpen: boolean;
  menuExpanded: boolean;
  onToggleMenu(): void;
}
interface Resultado {
  id: string;
  titulo: string;
  detalle: string;
  destino: string;
}

export function Topbar({ menuOpen, menuExpanded, onToggleMenu }: TopbarProps) {
  const { user, logout } = useAuth();
  const portal = usePortal();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const [busqueda, setBusqueda] = useState('');
  const [busquedaVisible, setBusquedaVisible] = useState(false);
  const [panel, setPanel] = useState<'avisos' | 'cuenta' | null>(null);
  const [rutaVisible, setRutaVisible] = useState(`${pathname}${search}`);
  const contenedor = useRef<HTMLElement>(null);
  const buscador = useRef<HTMLInputElement>(null);
  const avisosBoton = useRef<HTMLButtonElement>(null);
  const cuentaBoton = useRef<HTMLButtonElement>(null);
  const busquedaBoton = useRef<HTMLButtonElement>(null);

  if (rutaVisible !== `${pathname}${search}`) {
    setRutaVisible(`${pathname}${search}`);
    setPanel(null);
    setBusqueda('');
    setBusquedaVisible(false);
  }

  useEffect(() => {
    function alClicFuera(evento: MouseEvent) {
      if (!contenedor.current?.contains(evento.target as Node)) {
        setPanel(null);
        setBusqueda('');
        setBusquedaVisible(false);
      }
    }
    document.addEventListener('mousedown', alClicFuera);
    return () => document.removeEventListener('mousedown', alClicFuera);
  }, []);

  useEffect(() => {
    function alPulsar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        if (panel === 'avisos') avisosBoton.current?.focus();
        if (panel === 'cuenta') cuentaBoton.current?.focus();
        if (busquedaVisible) busquedaBoton.current?.focus();
        setPanel(null);
        setBusqueda('');
        setBusquedaVisible(false);
      }
    }
    document.addEventListener('keydown', alPulsar);
    return () => document.removeEventListener('keydown', alPulsar);
  }, [panel, busquedaVisible]);

  const titulo = (() => {
    if (!user) return { grupo: '', label: '' };
    const segmento = pathname.split('/')[2] ?? 'dashboard';
    const entradas = navigation[user.role].flatMap((grupo) =>
      grupo.items.flatMap((entrada) =>
        (entrada.children ?? [entrada]).map((item) => ({ grupo: grupo.title, item })),
      ),
    );
    const actual =
      entradas.find(({ item }) => item.path === `${segmento}${search}`) ??
      entradas.find(({ item }) => item.path.split('?')[0] === segmento);
    if (actual) return { grupo: actual.grupo, label: actual.item.label };
    return { grupo: roleDetails[user.role].label, label: 'Detalle' };
  })();

  const resultados = useMemo<Resultado[]>(() => {
    if (!user || busqueda.trim().length < 2) return [];
    const termino = busqueda.trim().toLocaleLowerCase('es-PE');
    const modulos = navigation[user.role]
      .flatMap((grupo) => grupo.items.flatMap((item) => item.children ?? [item]))
      .filter((item) => item.label.toLocaleLowerCase('es-PE').includes(termino))
      .map((item) => ({
        id: `modulo-${item.path}`,
        titulo: item.label,
        detalle: 'Ir al módulo',
        destino: `/${user.role}/${item.path}`,
      }));

    if (user.role === 'estudiante') {
      const propios = [portal.tutor, portal.docente].filter(Boolean);
      const docentes = propios
        .filter(
          (docente, indice) => propios.findIndex((otra) => otra?.id === docente?.id) === indice,
        )
        .filter((docente) =>
          `${docente?.nombres} ${docente?.apellidos} ${docente?.codigo}`
            .toLowerCase()
            .includes(termino),
        )
        .map((docente) => ({
          id: docente!.id,
          titulo: `${docente!.nombres} ${docente!.apellidos}`,
          detalle: `Docente tutor · ${docente!.codigo}`,
          destino: '/estudiante/tutor',
        }));
      return [...modulos, ...docentes].slice(0, 7);
    }
    const alcance =
      user.role === 'tutor'
        ? portal.tutorados
            .map((asignacion) => estudiantePorId(asignacion.estudianteId))
            .filter(Boolean)
        : estudiantes;
    const personas = alcance
      .filter((estudiante) =>
        `${estudiante?.nombres} ${estudiante?.apellidos} ${estudiante?.codigo}`
          .toLowerCase()
          .includes(termino),
      )
      .map((estudiante) => ({
        id: estudiante!.id,
        titulo: `${estudiante!.nombres} ${estudiante!.apellidos}`,
        detalle: `${estudiante!.codigo} · Ciclo ${estudiante!.ciclo ?? 'sin informar'}`,
        destino:
          user.role === 'tutor'
            ? `/tutor/tutorados/${estudiante!.id}`
            : `/coordinacion/tutorados?buscar=${encodeURIComponent(estudiante!.codigo)}`,
      }));
    return [...modulos, ...personas].slice(0, 7);
  }, [busqueda, portal.docente, portal.tutor, portal.tutorados, user]);

  if (!user) return null;
  const sinLeer = portal.avisosSinLeer;
  const nombreCorto = user.name.split(' ').slice(0, 2).join(' ');
  const avisos =
    user.role === 'estudiante'
      ? portal.notificaciones.map((aviso) => ({
          ...aviso,
          destino: aviso.enlace ?? '/estudiante/avisos',
        }))
      : [
          {
            id: 'agenda',
            titulo: 'Agenda de tutoría',
            detalle: `${portal.contadores.sesiones} sesiones en el periodo. Consulta horarios y asistencia.`,
            fecha: '2026-10-14T08:00:00',
            leida: false,
            destino: `/${user.role}/sesiones`,
          },
          {
            id: 'instrumentos',
            titulo: 'Formularios por revisar',
            detalle: `${portal.contadores.observados} registros con observaciones abiertas.`,
            fecha: '2026-10-14T08:00:00',
            leida: false,
            destino:
              user.role === 'tutor'
                ? '/tutor/instrumentos?estado=observado'
                : '/coordinacion/revisiones',
          },
          {
            id: 'comunicaciones',
            titulo: 'Comunicaciones institucionales',
            detalle: `${sinLeer} avisos sin leer en tu bandeja.`,
            fecha: '2026-10-14T08:00:00',
            leida: false,
            destino: `/${user.role}/avisos`,
          },
        ];

  return (
    <header
      className="topbar navbar navbar-light navbar-glass navbar-top navbar-expand"
      ref={contenedor}
    >
      <button
        type="button"
        className="icon-btn topbar__menu"
        aria-label={menuOpen ? 'Cerrar menú' : menuExpanded ? 'Contraer menú' : 'Expandir menú'}
        aria-expanded={menuExpanded}
        aria-controls="app-sidebar"
        onClick={onToggleMenu}
        id="sidebar-trigger"
      >
        <Menu aria-hidden="true" />
      </button>
      <div className="topbar__heading">
        <span>{roleDetails[user.role].label}</span>
        <strong>{titulo.label}</strong>
      </div>
      <div className={`search-box topbar__search${busquedaVisible ? ' topbar__search--open' : ''}`}>
        <Search aria-hidden="true" />
        <input
          ref={buscador}
          type="search"
          className="form-control search-input"
          value={busqueda}
          onChange={(evento) => setBusqueda(evento.target.value)}
          placeholder={
            user.role === 'estudiante'
              ? 'Buscar módulos o docente tutor…'
              : 'Buscar módulos, nombre o código…'
          }
          aria-label="Buscar módulos y personas"
          aria-controls={busqueda.trim().length >= 2 ? 'search-results' : undefined}
        />
        <button
          type="button"
          className="icon-btn topbar__search-close"
          aria-label="Cerrar búsqueda"
          onClick={() => {
            setBusquedaVisible(false);
            setBusqueda('');
            busquedaBoton.current?.focus();
          }}
        >
          <X aria-hidden="true" />
        </button>
        {busqueda.trim().length >= 2 && (
          <div
            className="portal-popover topbar__results"
            id="search-results"
            aria-label="Resultados de búsqueda"
          >
            <div className="portal-popover__head">
              <span>Resultados</span>
              <small>{resultados.length}</small>
            </div>
            {resultados.length ? (
              <ul className="portal-popover__list">
                {resultados.map((resultado) => (
                  <li key={resultado.id}>
                    <Link
                      className="list__item list__item--interactive"
                      to={resultado.destino}
                      onClick={() => setBusqueda('')}
                    >
                      <span className="avatar avatar--sm" aria-hidden="true">
                        {iniciales({
                          nombres: resultado.titulo.split(' ')[0] ?? '',
                          apellidos: resultado.titulo.split(' ')[1] ?? '',
                        })}
                      </span>
                      <span className="list__body">
                        <strong>{resultado.titulo}</strong>
                        <p>{resultado.detalle}</p>
                      </span>
                      <ChevronRight aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="topbar__empty" role="status">
                No encontramos resultados para “{busqueda}”.
              </p>
            )}
          </div>
        )}
      </div>
      <div className="topbar__actions">
        <button
          type="button"
          ref={busquedaBoton}
          className="icon-btn topbar__search-trigger"
          aria-label="Abrir búsqueda"
          aria-expanded={busquedaVisible}
          onClick={() => {
            setBusquedaVisible(true);
            requestAnimationFrame(() => buscador.current?.focus());
          }}
        >
          <Search aria-hidden="true" />
        </button>
        <div className="dropdown">
          <button
            ref={avisosBoton}
            type="button"
            className="icon-btn"
            aria-label={`Avisos: ${sinLeer} sin leer`}
            aria-expanded={panel === 'avisos'}
            aria-controls="notices-popover"
            onClick={() => setPanel(panel === 'avisos' ? null : 'avisos')}
          >
            <Bell aria-hidden="true" />
            {sinLeer > 0 && <span className="topbar__notification-dot" aria-hidden="true" />}
          </button>
          {panel === 'avisos' && (
            <div
              className="portal-popover topbar__notices"
              id="notices-popover"
              role="dialog"
              aria-label="Avisos recientes"
            >
              <div className="portal-popover__head">
                <span>Notificaciones</span>
                <span className="badge badge--ok">{sinLeer} sin leer</span>
              </div>
              <ul className="portal-popover__list">
                {avisos.map((aviso) => (
                  <li key={aviso.id}>
                    <Link
                      className="list__item list__item--interactive"
                      to={aviso.destino}
                      onClick={() => setPanel(null)}
                    >
                      <span className="list__icon list__icon--info" aria-hidden="true">
                        <Bell />
                      </span>
                      <span className="list__body">
                        <strong>{aviso.titulo}</strong>
                        <p>{aviso.detalle}</p>
                        <span className="timeline__date">{formatFechaHora(aviso.fecha)}</span>
                      </span>
                      {!aviso.leida && <span className="dot dot--ok" aria-label="Sin leer" />}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="portal-popover__foot">
                <Link to={`/${user.role}/avisos`} onClick={() => setPanel(null)}>
                  Ver todos los avisos <ChevronRight aria-hidden="true" />
                </Link>
              </div>
            </div>
          )}
        </div>
        <div className="dropdown">
          <button
            ref={cuentaBoton}
            type="button"
            className="user-menu"
            aria-label={`Cuenta de ${user.name}`}
            aria-expanded={panel === 'cuenta'}
            aria-controls="account-menu"
            onClick={() => setPanel(panel === 'cuenta' ? null : 'cuenta')}
          >
            <span className="avatar" aria-hidden="true">
              {iniciales({
                nombres: user.name.split(' ')[0] ?? '',
                apellidos: user.name.split(' ')[1] ?? '',
              })}
            </span>
            <span className="user-menu__text">
              <strong>{nombreCorto}</strong>
              <small>{roleDetails[user.role].label}</small>
            </span>
            <ChevronRight className="user-menu__chevron" aria-hidden="true" />
          </button>
          {panel === 'cuenta' && (
            <ul className="dropdown__menu" id="account-menu">
              <li className="user-menu__identity">
                <strong>{user.name}</strong>
                <p className="small muted">{user.email}</p>
              </li>
              <li className="dropdown__separator" aria-hidden="true" />
              <li>
                <Link to={`/${user.role}/perfil`}>
                  <UserRound aria-hidden="true" /> Mi perfil
                </Link>
              </li>
              <li>
                <Link to={`/${user.role}/preferencias`}>
                  <Settings2 aria-hidden="true" /> Ajustes de pantalla
                </Link>
              </li>
              <li className="dropdown__separator" aria-hidden="true" />
              <li>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    navigate('/login', { replace: true });
                  }}
                >
                  <LogOut aria-hidden="true" /> Cerrar sesión
                </button>
              </li>
            </ul>
          )}
        </div>
      </div>
    </header>
  );
}
