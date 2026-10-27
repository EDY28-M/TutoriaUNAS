import { useId, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from './icons';
import {
  DIAS_SEMANA,
  fechaActualLima,
  aIso,
  desdeIso,
  formatFechaLarga,
  matrizMensual,
  mesTitulo,
  sumarDias,
} from '../../utils/fechas';
import { Badge } from './StatusBadge';
import { distribuirCalendario } from '../../utils/calendarLayout';

export type TonoEvento = 'verde' | 'dorado' | 'info' | 'violeta' | 'riesgo';
export type VistaCalendario = 'semana' | 'mes';

const CLASES_EVENTO: Record<TonoEvento, string> = {
  verde: '',
  dorado: 'calendar__event--gold',
  info: 'calendar__event--info',
  violeta: 'calendar__event--violet',
  riesgo: 'calendar__event--danger',
};

const HORA_INICIO = 8;
const PX_HORA = 96;

function horaLegible(hora?: string): string {
  if (!hora) return '';
  return hora.replace(/\s/g, '').replace(/-/g, '–').replace('–', ' – ');
}

export interface EventoCalendario {
  id: string;
  fecha: string;
  titulo: string;
  hora?: string;
  tono?: TonoEvento;
  detalle?: string;
  lugar?: string;
  modalidad?: string;
  etiqueta?: string;
}

interface CalendarProps {
  eventos: EventoCalendario[];
  etiqueta: string;
  onAbrir?(evento: EventoCalendario): void;
  maxPorDia?: number;
  mesInicial?: string;
  legend?: ReactNode;
  vistaInicial?: VistaCalendario;
}

interface RangoMinutos {
  inicio: number;
  fin: number;
}

function lunesDe(iso: string): Date {
  const fecha = desdeIso(iso);
  return sumarDias(fecha, -((fecha.getDay() + 6) % 7));
}

function minutosDe(texto: string): number | null {
  const match = texto.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function rangoDe(hora?: string): RangoMinutos | null {
  if (!hora) return null;
  const partes = hora
    .split(/[–-]/)
    .map((parte) => parte.trim())
    .filter(Boolean);
  const inicio = minutosDe(partes[0] ?? '');
  if (inicio == null) return null;
  const fin = partes[1] ? (minutosDe(partes[1]) ?? inicio + 60) : inicio + 60;
  return { inicio, fin: Math.max(fin, inicio + 30) };
}

function etiquetaSemana(inicio: Date): string {
  const fin = sumarDias(inicio, 6);
  const mismoMes = inicio.getMonth() === fin.getMonth();
  if (mismoMes) {
    return `${inicio.getDate()} – ${fin.getDate()} de ${mesTitulo(inicio)}`;
  }
  return `${inicio.getDate()} ${mesTitulo(inicio).split(' ')[0]} – ${fin.getDate()} ${mesTitulo(fin)}`;
}

function horaEtiqueta(hora: number): string {
  const periodo = hora < 12 ? 'a. m.' : 'p. m.';
  const doce = hora % 12 === 0 ? 12 : hora % 12;
  return `${doce}:00 ${periodo}`;
}

function horaDeMinutos(minutos: number): string {
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
}

function franjaVisible(
  dias: string[],
  porFecha: Map<string, EventoCalendario[]>,
): { inicio: number; fin: number } {
  let minimo = Number.POSITIVE_INFINITY;
  let maximo = 0;
  for (const iso of dias) {
    for (const evento of porFecha.get(iso) ?? []) {
      const rango = rangoDe(evento.hora);
      if (!rango) continue;
      minimo = Math.min(minimo, rango.inicio);
      maximo = Math.max(maximo, rango.fin);
    }
  }
  if (!Number.isFinite(minimo)) {
    return { inicio: HORA_INICIO, fin: HORA_INICIO + 3 };
  }
  const inicio = Math.max(0, Math.floor(minimo / 60));
  const fin = Math.min(24, Math.max(Math.ceil(maximo / 60), inicio + 3));
  return { inicio, fin };
}

/**
 * Calendario estilo Teams: semana con franjas horarias, mes con bloques de color
 * y panel del día seleccionado. Sirve sesiones, disponibilidad y hitos.
 */
export function Calendar({
  eventos,
  etiqueta,
  onAbrir,
  maxPorDia = 3,
  mesInicial,
  legend,
  vistaInicial = 'semana',
}: CalendarProps) {
  const hoy = fechaActualLima();
  const [vista, setVista] = useState<VistaCalendario>(vistaInicial);
  const [periodo, setPeriodo] = useState((mesInicial ?? hoy).slice(0, 10));
  const [ancla, setAncla] = useState((mesInicial ?? hoy).slice(0, 10));
  const [dayLimit, setDayLimit] = useState(6);
  const agendaId = useId();
  const agenda = useRef<HTMLElement>(null);

  const anclaFecha = useMemo(() => desdeIso(periodo), [periodo]);
  const lunes = useMemo(() => lunesDe(periodo), [periodo]);
  const diasSemana = useMemo(
    () => Array.from({ length: 7 }, (_, i) => aIso(sumarDias(lunes, i))),
    [lunes],
  );
  const celdas = useMemo(
    () => matrizMensual(anclaFecha.getFullYear(), anclaFecha.getMonth(), hoy),
    [anclaFecha, hoy],
  );

  const porFecha = useMemo(() => {
    const mapa = new Map<string, EventoCalendario[]>();
    for (const evento of eventos) {
      const clave = evento.fecha.slice(0, 10);
      const lista = mapa.get(clave) ?? [];
      lista.push(evento);
      mapa.set(clave, lista);
    }
    for (const lista of mapa.values()) {
      lista.sort((a, b) => (a.hora ?? '').localeCompare(b.hora ?? ''));
    }
    return mapa;
  }, [eventos]);

  const delDia = porFecha.get(ancla) ?? [];
  const monthKey = `${anclaFecha.getFullYear()}-${String(anclaFecha.getMonth() + 1).padStart(2, '0')}`;
  const monthCount = eventos.filter((evento) => evento.fecha.startsWith(monthKey)).length;
  const weekCount = diasSemana.reduce((total, iso) => total + (porFecha.get(iso)?.length ?? 0), 0);

  function irA(iso: string) {
    setAncla(iso);
    setDayLimit(6);
  }

  function mover(delta: number) {
    if (vista === 'semana') {
      navegarA(aIso(sumarDias(desdeIso(periodo), delta * 7)));
      return;
    }
    const siguiente = new Date(anclaFecha.getFullYear(), anclaFecha.getMonth() + delta, 1);
    navegarA(aIso(siguiente));
  }

  function navegarA(iso: string) {
    setPeriodo(iso);
    irA(iso);
  }

  function cambiarVista(nueva: VistaCalendario) {
    if (nueva === vista) return;
    setVista(nueva);
    setPeriodo(ancla);
  }

  function irHoy() {
    navegarA(hoy);
  }

  function verAgenda(iso: string) {
    irA(iso);
    requestAnimationFrame(() => agenda.current?.focus());
  }

  return (
    <div className="tutorial-calendar-shell" data-view={vista}>
      <div className="calendar-layout">
        <div className="tutorial-calendar">
          <div className="calendar__head">
            <div className="calendar__title">
              <strong>{vista === 'semana' ? etiquetaSemana(lunes) : mesTitulo(anclaFecha)}</strong>
              <small>
                {vista === 'semana'
                  ? `${weekCount} eventos esta semana`
                  : `${monthCount} eventos este mes`}
              </small>
            </div>
            <div className="calendar__nav">
              <div className="calendar__views" role="group" aria-label="Vista del calendario">
                <button
                  type="button"
                  className={`calendar__view${vista === 'semana' ? ' is-active' : ''}`}
                  aria-pressed={vista === 'semana'}
                  onClick={() => cambiarVista('semana')}
                >
                  Semana
                </button>
                <button
                  type="button"
                  className={`calendar__view${vista === 'mes' ? ' is-active' : ''}`}
                  aria-pressed={vista === 'mes'}
                  onClick={() => cambiarVista('mes')}
                >
                  Mes
                </button>
              </div>
              <button
                type="button"
                className="icon-btn icon-btn--sm icon-btn--bordered"
                aria-label={vista === 'semana' ? 'Semana anterior' : 'Mes anterior'}
                onClick={() => mover(-1)}
              >
                <ChevronLeft aria-hidden="true" />
              </button>
              <button type="button" className="btn btn-falcon-default btn-sm" onClick={irHoy}>
                Hoy
              </button>
              <button
                type="button"
                className="icon-btn icon-btn--sm icon-btn--bordered"
                aria-label={vista === 'semana' ? 'Semana siguiente' : 'Mes siguiente'}
                onClick={() => mover(1)}
              >
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
          </div>

          {vista === 'semana' ? (
            <WeekView
              hoy={hoy}
              etiqueta={etiqueta}
              dias={diasSemana}
              ancla={ancla}
              porFecha={porFecha}
              onSeleccionar={irA}
              onAbrir={onAbrir}
              onVerAgenda={verAgenda}
              agendaId={agendaId}
            />
          ) : (
            <MonthView
              etiqueta={etiqueta}
              celdas={celdas}
              ancla={ancla}
              porFecha={porFecha}
              maxPorDia={maxPorDia}
              onSeleccionar={irA}
              onAbrir={onAbrir}
              onVerAgenda={verAgenda}
            />
          )}

          <div className="calendar__legend">
            {legend ?? (
              <>
                <span>
                  <span className="dot dot--ok" /> Tutoría individual
                </span>
                <span>
                  <span className="dot dot--warn" /> Actividad grupal
                </span>
                <span>
                  <span className="dot dot--info" /> Actividad académica
                </span>
                <span>
                  <span className="dot dot--violet" /> Bienestar y salud
                </span>
                <span>
                  <span className="dot dot--danger" /> Cierre o plazo crítico
                </span>
              </>
            )}
          </div>

          {vista === 'semana' && (
            <WeekAgenda dias={diasSemana} ancla={ancla} porFecha={porFecha} onAbrir={onAbrir} />
          )}

          <section
            ref={agenda}
            id={agendaId}
            tabIndex={-1}
            className="calendar__daypanel"
            aria-label={`Agenda del ${formatFechaLarga(ancla)}`}
          >
            <header className="calendar__daypanel-head">
              <div>
                <h2 className="calendar__aside-title">{formatFechaLarga(ancla)}</h2>
                <p className="calendar__aside-subtitle">
                  {delDia.length === 0
                    ? 'Sin eventos programados'
                    : `${delDia.length} ${delDia.length === 1 ? 'evento' : 'eventos'}`}
                </p>
              </div>
              {ancla === hoy && <Badge tone="dorado">Hoy</Badge>}
            </header>
            {delDia.length === 0 ? (
              <p className="calendar__daypanel-empty">
                Elige otro día en la grilla para ver el detalle.
              </p>
            ) : (
              <ul className="calendar__daylist">
                {delDia.slice(0, dayLimit).map((evento) => (
                  <li key={evento.id}>
                    <button
                      type="button"
                      className="calendar__dayitem"
                      onClick={() => onAbrir?.(evento)}
                    >
                      <span
                        className={`calendar__daydot calendar__daydot--${evento.tono ?? 'verde'}`}
                        aria-hidden="true"
                      />
                      <EventDetails evento={evento} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {dayLimit < delDia.length && (
              <button
                type="button"
                className="btn btn-link btn-sm"
                onClick={() => setDayLimit((limit) => limit + 6)}
              >
                Mostrar más ({delDia.length - dayLimit})
              </button>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function WeekView({
  hoy,
  etiqueta,
  dias,
  ancla,
  porFecha,
  onSeleccionar,
  onAbrir,
  onVerAgenda,
  agendaId,
}: {
  hoy: string;
  etiqueta: string;
  dias: string[];
  ancla: string;
  porFecha: Map<string, EventoCalendario[]>;
  onSeleccionar(iso: string): void;
  onAbrir?(evento: EventoCalendario): void;
  onVerAgenda(iso: string): void;
  agendaId: string;
}) {
  const franja = useMemo(() => franjaVisible(dias, porFecha), [dias, porFecha]);
  const horas = useMemo(
    () => Array.from({ length: franja.fin - franja.inicio }, (_, i) => franja.inicio + i),
    [franja],
  );
  const alto = horas.length * PX_HORA;
  const hayTodoElDia = dias.some((iso) =>
    (porFecha.get(iso) ?? []).some((evento) => !rangoDe(evento.hora)),
  );

  return (
    <div className="calendar__week" role="region" aria-label={`Vista semanal de ${etiqueta}`}>
      <div className="calendar__week-sheet">
        <div className="calendar__week-frozen">
          <div className="calendar__week-head">
            <span className="calendar__gutter" aria-hidden="true" />
            {dias.map((iso, indice) => {
              const fecha = desdeIso(iso);
              const clases = [
                'calendar__week-day',
                iso === hoy ? 'is-today' : '',
                iso === ancla ? 'is-selected' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <button
                  type="button"
                  key={iso}
                  className={clases}
                  onClick={() => onSeleccionar(iso)}
                  aria-current={iso === hoy ? 'date' : undefined}
                  aria-pressed={iso === ancla}
                  aria-label={`${formatFechaLarga(iso)}: ${porFecha.get(iso)?.length ?? 0} eventos`}
                >
                  <span>{DIAS_SEMANA[indice]?.slice(0, 3)}</span>
                  <strong>{fecha.getDate()}</strong>
                  <small className="calendar__week-count">
                    {(porFecha.get(iso)?.length ?? 0) > 0 ? porFecha.get(iso)!.length : '—'}
                  </small>
                </button>
              );
            })}
          </div>

          {hayTodoElDia && (
            <div className="calendar__allday">
              <span className="calendar__gutter calendar__gutter--label">Día</span>
              {dias.map((iso) => {
                const todoElDia = (porFecha.get(iso) ?? []).filter(
                  (evento) => !rangoDe(evento.hora),
                );
                return (
                  <div key={iso} className="calendar__allday-cell">
                    {todoElDia.slice(0, 2).map((evento) => (
                      <EventChip key={evento.id} evento={evento} onAbrir={onAbrir} />
                    ))}
                    {todoElDia.length > 2 && (
                      <button
                        type="button"
                        className="calendar__more"
                        onClick={() => onVerAgenda(iso)}
                        aria-controls={agendaId}
                      >
                        Ver {todoElDia.length} eventos
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="calendar__week-grid" style={{ height: alto }}>
          <div className="calendar__hours" aria-hidden="true">
            {horas.map((hora) => (
              <div key={hora} className="calendar__hour">
                <span>{horaEtiqueta(hora)}</span>
              </div>
            ))}
          </div>
          <div className="calendar__cols">
            {dias.map((iso) => {
              const timed = (porFecha.get(iso) ?? [])
                .map((evento) => ({ evento, rango: rangoDe(evento.hora) }))
                .filter((item): item is { evento: EventoCalendario; rango: RangoMinutos } =>
                  Boolean(item.rango),
                );
              const grupos = distribuirCalendario(timed);
              const clases = ['calendar__col', iso === ancla ? 'is-selected' : '']
                .filter(Boolean)
                .join(' ');
              return (
                <div key={iso} className={clases} onClick={() => onSeleccionar(iso)}>
                  {horas.map((hora) => (
                    <span key={hora} className="calendar__slot" />
                  ))}
                  {grupos.flatMap((grupo) => {
                    // Una agenda institucional puede reunir decenas de docentes a la vez.
                    // Se abre la lista completa en lugar de apilar tarjetas ilegibles.
                    if (grupo.columnas > 2) {
                      return [
                        <button
                          type="button"
                          key={`grupo-${grupo.inicio}`}
                          className="calendar__block calendar__block--group"
                          style={{
                            top: ((grupo.inicio - franja.inicio * 60) / 60) * PX_HORA + 2,
                            height: ((grupo.fin - grupo.inicio) / 60) * PX_HORA - 4,
                            left: 4,
                            width: 'calc(100% - 8px)',
                          }}
                          aria-label={`Ver ${grupo.items.length} eventos del ${formatFechaLarga(iso)}`}
                          aria-controls={agendaId}
                          onClick={(event) => {
                            event.stopPropagation();
                            onVerAgenda(iso);
                          }}
                        >
                          <span className="calendar__block-time">
                            {horaDeMinutos(grupo.inicio)} – {horaDeMinutos(grupo.fin)}
                          </span>
                          <strong className="calendar__block-title">
                            {grupo.items.length} eventos
                          </strong>
                          <span className="calendar__block-hint">Ver agenda del día</span>
                        </button>,
                      ];
                    }
                    return grupo.items.map((item) => {
                      const top = ((item.rango.inicio - franja.inicio * 60) / 60) * PX_HORA + 2;
                      const height = Math.max(
                        ((item.rango.fin - item.rango.inicio) / 60) * PX_HORA - 4,
                        44,
                      );
                      const estilo: CSSProperties = {
                        top,
                        height,
                        left: `calc(${(item.columna / grupo.columnas) * 100}% + 4px)`,
                        width: `calc(${100 / grupo.columnas}% - 8px)`,
                      };
                      return (
                        <button
                          type="button"
                          key={item.evento.id}
                          className={[
                            'calendar__block',
                            height < 64 ? 'calendar__block--short' : '',
                            grupo.columnas > 1 ? 'calendar__block--concurrent' : '',
                            CLASES_EVENTO[item.evento.tono ?? 'verde'],
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          style={estilo}
                          title={`${horaLegible(item.evento.hora)} ${item.evento.titulo}`}
                          aria-label={`${horaLegible(item.evento.hora)}, ${item.evento.titulo}, ${item.evento.detalle ?? ''}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            onSeleccionar(iso);
                            onAbrir?.(item.evento);
                          }}
                        >
                          <span className="calendar__block-time">
                            {grupo.columnas > 1
                              ? item.evento.hora?.split(/[–-]/)[0]?.trim()
                              : horaLegible(item.evento.hora)}
                          </span>
                          <span className="calendar__block-title">{item.evento.titulo}</span>
                        </button>
                      );
                    });
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function MonthView({
  etiqueta,
  celdas,
  ancla,
  porFecha,
  maxPorDia,
  onSeleccionar,
  onAbrir,
  onVerAgenda,
}: {
  etiqueta: string;
  celdas: ReturnType<typeof matrizMensual>;
  ancla: string;
  porFecha: Map<string, EventoCalendario[]>;
  maxPorDia: number;
  onSeleccionar(iso: string): void;
  onAbrir?(evento: EventoCalendario): void;
  onVerAgenda(iso: string): void;
}) {
  return (
    <div className="calendar__scroll" role="region" aria-label={`Vista mensual de ${etiqueta}`}>
      <div className="calendar__weekdays" aria-hidden="true">
        {DIAS_SEMANA.map((dia) => (
          <span key={dia}>{dia.slice(0, 3)}</span>
        ))}
      </div>
      <div className="calendar__grid" role="group" aria-label={`Calendario de ${etiqueta}`}>
        {celdas.map((celda) => {
          const lista = porFecha.get(celda.iso) ?? [];
          const visibles = lista.slice(0, maxPorDia);
          const clases = [
            'calendar__day',
            celda.fueraDeMes ? 'calendar__day--outside' : '',
            celda.esHoy ? 'calendar__day--today' : '',
            celda.iso === ancla ? 'calendar__day--selected' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <div key={celda.iso} className={clases} onClick={() => onSeleccionar(celda.iso)}>
              <button
                type="button"
                className="calendar__day-select"
                aria-label={`${formatFechaLarga(celda.iso)}: ${lista.length} eventos`}
                aria-current={celda.esHoy ? 'date' : undefined}
                aria-pressed={celda.iso === ancla}
                onClick={() => onSeleccionar(celda.iso)}
              >
                <span className="calendar__day-number">{celda.dia}</span>
                {lista.length > 0 && <span className="calendar__day-count">{lista.length}</span>}
              </button>
              <span className="calendar__events">
                {visibles.map((evento) => (
                  <EventChip
                    key={evento.id}
                    evento={evento}
                    onAbrir={(evento) => {
                      onSeleccionar(celda.iso);
                      onAbrir?.(evento);
                    }}
                  />
                ))}
                {lista.length > visibles.length && (
                  <button
                    type="button"
                    className="calendar__more"
                    onClick={(event) => {
                      event.stopPropagation();
                      onVerAgenda(celda.iso);
                    }}
                  >
                    +{lista.length - visibles.length} más
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventChip({
  evento,
  onAbrir,
}: {
  evento: EventoCalendario;
  onAbrir?(evento: EventoCalendario): void;
}) {
  return (
    <button
      type="button"
      className={['calendar__event', CLASES_EVENTO[evento.tono ?? 'verde']]
        .filter(Boolean)
        .join(' ')}
      title={`${horaLegible(evento.hora)} ${evento.titulo}`}
      onClick={(event) => {
        event.stopPropagation();
        onAbrir?.(evento);
      }}
    >
      {evento.hora && <span className="calendar__event-time">{horaLegible(evento.hora)}</span>}
      <span className="calendar__event-title">{evento.titulo}</span>
    </button>
  );
}

function EventDetails({ evento }: { evento: EventoCalendario }) {
  return (
    <span className="calendar__dayitem-body">
      <span className="calendar__dayitem-time">{horaLegible(evento.hora) || 'Todo el día'}</span>
      <strong>{evento.titulo}</strong>
      {evento.detalle && <span>{evento.detalle}</span>}
      {evento.lugar && <span>{evento.lugar}</span>}
      {evento.etiqueta && <Badge>{evento.etiqueta}</Badge>}
    </span>
  );
}

/** En un contenedor estrecho la semana se lee como una agenda, sin comprimir textos. */
function WeekAgenda({
  dias,
  ancla,
  porFecha,
  onAbrir,
}: {
  dias: string[];
  ancla: string;
  porFecha: Map<string, EventoCalendario[]>;
  onAbrir?(evento: EventoCalendario): void;
}) {
  return (
    <div className="calendar__week-agenda" aria-label="Agenda de la semana">
      <p className="calendar__agenda-note">Agenda semanal · Horarios y detalles completos</p>
      {dias
        .filter((iso) => iso === ancla || porFecha.has(iso))
        .map((iso) => (
          <WeekAgendaDay
            key={iso}
            iso={iso}
            selected={iso === ancla}
            eventos={porFecha.get(iso) ?? []}
            onAbrir={onAbrir}
          />
        ))}
    </div>
  );
}

function WeekAgendaDay({
  iso,
  selected,
  eventos,
  onAbrir,
}: {
  iso: string;
  selected: boolean;
  eventos: EventoCalendario[];
  onAbrir?(evento: EventoCalendario): void;
}) {
  const [limite, setLimite] = useState(3);
  return (
    <section
      className={`calendar__agenda-day${selected ? ' is-selected' : ''}`}
      aria-label={`Eventos del ${formatFechaLarga(iso)}`}
    >
      <header className="calendar__daypanel-head">
        <h2 className="calendar__aside-title">{formatFechaLarga(iso)}</h2>
        <span className="calendar__agenda-count">
          {eventos.length} {eventos.length === 1 ? 'evento' : 'eventos'}
        </span>
      </header>
      {eventos.length ? (
        <ul className="calendar__daylist">
          {eventos.slice(0, limite).map((evento) => (
            <li key={evento.id}>
              <button type="button" className="calendar__dayitem" onClick={() => onAbrir?.(evento)}>
                <span
                  className={`calendar__daydot calendar__daydot--${evento.tono ?? 'verde'}`}
                  aria-hidden="true"
                />
                <EventDetails evento={evento} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="calendar__daypanel-empty">Sin eventos programados.</p>
      )}
      {limite < eventos.length && (
        <button
          type="button"
          className="btn btn-link btn-sm"
          onClick={() => setLimite((valor) => valor + 6)}
        >
          Mostrar más ({eventos.length - limite})
        </button>
      )}
    </section>
  );
}
