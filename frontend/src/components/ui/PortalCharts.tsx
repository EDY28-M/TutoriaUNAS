import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import echartsUrl from '../../assets/vendor/echarts.min.js?url';
import { usePortal } from '../../hooks/usePortal';
import type { Portal } from '../../hooks/usePortal';
import { semestreActual, semestres } from '../../data/catalogos';
import { docentePorId, nombreCorto } from '../../data/personas';
import { HOY_ISO } from '../../utils/fechas';
import { CHART_COLORS, CHART_STATUS_COLORS, waveSeries } from '../../utils/chartStyles';
import { Card, CardBody } from './Card';
import { EmptyState } from './EmptyState';
import '../../styles/charts.css';
import '../../styles/dashboard.css';

type Intervalo = 'semestre' | '7' | '30' | 'personalizado';

export interface DashboardScopeData {
  portal: Portal;
  semestreId: string;
  tutorId: string;
  inicio: string;
  fin: string;
  referencia: number;
  proxima: Portal['sesiones'][number] | undefined;
  filtros: ReactNode;
}

/** Corte de demostración, con la hora de Lima cuando la fecha coincide. */
function referenciaLima(): number {
  const ahora = new Date();
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(ahora);
  const obtener = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value;
  const fechaLima = `${obtener('year')}-${obtener('month')}-${obtener('day')}`;
  return fechaLima === HOY_ISO ? ahora.getTime() : Date.parse(`${HOY_ISO}T12:00:00-05:00`);
}

function desplazarFecha(fecha: string, dias: number): string {
  const valor = new Date(`${fecha}T12:00:00Z`);
  valor.setUTCDate(valor.getUTCDate() + dias);
  return valor.toISOString().slice(0, 10);
}

function unicos<T extends { id: string }>(items: T[]): T[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

/** Un único alcance alimenta las cifras, las listas y las visualizaciones. */
export function DashboardScope({
  children,
  coordinacion = false,
}: {
  children: (scope: DashboardScopeData) => ReactNode;
  coordinacion?: boolean;
}) {
  const source = usePortal();
  const [semestreId, setSemestreId] = useState(semestreActual);
  const [intervalo, setIntervalo] = useState<Intervalo>('semestre');
  const [tutorId, setTutorId] = useState('todos');
  const [desde, setDesde] = useState(HOY_ISO.slice(0, 8) + '01');
  const [hasta, setHasta] = useState(HOY_ISO);
  const [referencia, setReferencia] = useState(referenciaLima);

  useEffect(() => {
    const timer = window.setInterval(() => setReferencia(referenciaLima()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const semestre = semestres.find((item) => item.id === semestreId) ?? semestres[1]!;
  const inicio =
    intervalo === 'semestre'
      ? semestre.inicio
      : intervalo === 'personalizado'
        ? desde || semestre.inicio
        : desplazarFecha(HOY_ISO, -(Number(intervalo) - 1));
  const fin =
    intervalo === 'semestre'
      ? semestre.fin
      : intervalo === 'personalizado'
        ? hasta || semestre.fin
        : HOY_ISO;
  const rangoValido = inicio <= fin;
  const enRango = (fecha: string) =>
    rangoValido && fecha.slice(0, 10) >= inicio && fecha.slice(0, 10) <= fin;
  const mismoTutor = (id: string) => tutorId === 'todos' || id === tutorId;
  const sesiones = unicos(source.sesiones).filter(
    (item) => item.semestreId === semestreId && mismoTutor(item.tutorId) && enRango(item.fecha),
  );
  const instrumentos = unicos(source.instrumentos).filter(
    (item) =>
      item.semestreId === semestreId && mismoTutor(item.tutorId) && enRango(item.actualizado),
  );
  const derivaciones = unicos(source.derivaciones).filter(
    (item) =>
      item.semestreId === semestreId && mismoTutor(item.tutorId) && enRango(item.fechaDerivacion),
  );
  const tutorados = unicos(source.tutorados).filter(
    (item) =>
      rangoValido &&
      item.semestreId === semestreId &&
      mismoTutor(item.tutorId) &&
      item.estado === 'activa' &&
      item.fechaInicio <= fin &&
      (!item.fechaFin || item.fechaFin >= inicio),
  );
  const proxima = sesiones
    .filter(
      (item) =>
        ['programada', 'reprogramada'].includes(item.estado) &&
        Date.parse(`${item.fecha}T${item.horaInicio}:00-05:00`) > referencia,
    )
    .sort((a, b) => `${a.fecha}${a.horaInicio}`.localeCompare(`${b.fecha}${b.horaInicio}`))[0];
  const tutores = [
    ...new Set([
      ...source.tutorados.map((item) => item.tutorId),
      ...source.sesiones.map((item) => item.tutorId),
      ...source.instrumentos.map((item) => item.tutorId),
    ]),
  ]
    .map((id) => ({ id, nombre: docentePorId(id) ? nombreCorto(docentePorId(id)!) : id }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
  const pendientes = instrumentos.filter((item) =>
    ['no-iniciado', 'borrador', 'observado'].includes(item.estado),
  ).length;
  const portal: Portal = {
    ...source,
    sesiones,
    instrumentos,
    derivaciones,
    tutorados,
    contadores: {
      ...source.contadores,
      sesiones: sesiones.filter((item) => item.estado === 'programada').length,
      pendientes,
      derivaciones: derivaciones.filter((item) => !['cerrada', 'atendida'].includes(item.estado))
        .length,
      observados: instrumentos.filter((item) => item.estado === 'observado').length,
    },
  };
  const filtros = (
    <section className="dashboard-filters" aria-label="Filtrar indicadores del panel">
      <div className="dashboard-filters__controls">
        <label className="field">
          <span className="field__label">Semestre</span>
          <select
            className="select"
            aria-label="Semestre"
            value={semestreId}
            onChange={(event) => setSemestreId(event.target.value)}
          >
            {semestres.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nombre}
              </option>
            ))}
          </select>
        </label>
        {coordinacion && (
          <label className="field">
            <span className="field__label">Docente tutor</span>
            <select
              className="select"
              aria-label="Docente tutor"
              value={tutorId}
              onChange={(event) => setTutorId(event.target.value)}
            >
              <option value="todos">Todos los tutores</option>
              {tutores.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nombre}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          <span className="field__label">Periodo</span>
          <select
            className="select"
            aria-label="Periodo"
            value={intervalo}
            onChange={(event) => setIntervalo(event.target.value as Intervalo)}
          >
            <option value="semestre">Todo el semestre</option>
            <option value="7">Últimos 7 días</option>
            <option value="30">Últimos 30 días</option>
            <option value="personalizado">Rango de fechas</option>
          </select>
        </label>
        {intervalo === 'personalizado' && (
          <>
            <label className="field">
              <span className="field__label">Desde</span>
              <input
                className="input"
                type="date"
                value={desde}
                onChange={(event) => setDesde(event.target.value)}
              />
            </label>
            <label className="field">
              <span className="field__label">Hasta</span>
              <input
                className="input"
                type="date"
                value={hasta}
                onChange={(event) => setHasta(event.target.value)}
              />
            </label>
          </>
        )}
      </div>
      {!rangoValido && (
        <p className="dashboard-filters__error" role="alert">
          La fecha de inicio debe ser anterior o igual a la fecha final.
        </p>
      )}
    </section>
  );
  return children({ portal, semestreId, tutorId, inicio, fin, referencia, proxima, filtros });
}

type ChartOption = Record<string, unknown>;
interface EchartsInstance {
  setOption: (option: ChartOption, settings?: { notMerge: boolean }) => void;
  resize: () => void;
  dispose: () => void;
}
interface EchartsApi {
  init: (element: HTMLElement, theme?: unknown, opts?: { renderer: 'canvas' }) => EchartsInstance;
}

let cargaEcharts: Promise<EchartsApi> | undefined;

function cargarEcharts(): Promise<EchartsApi> {
  const ventana = window as Window & { echarts?: EchartsApi };
  if (ventana.echarts) return Promise.resolve(ventana.echarts);
  if (!cargaEcharts) {
    cargaEcharts = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = echartsUrl;
      script.async = true;
      script.onload = () => {
        if (ventana.echarts) resolve(ventana.echarts);
        else {
          cargaEcharts = undefined;
          script.remove();
          reject(new Error('No se pudo inicializar la gráfica.'));
        }
      };
      script.onerror = () => {
        cargaEcharts = undefined;
        script.remove();
        reject(new Error('No se pudo cargar la gráfica.'));
      };
      document.head.appendChild(script);
    });
  }
  return cargaEcharts;
}

const PALETTE = CHART_COLORS;
const ESTADOS_INSTRUMENTO = [
  { estado: 'aprobado', name: 'Aprobados', color: PALETTE.green },
  { estado: 'enviado', name: 'Enviados', color: CHART_STATUS_COLORS.enviado },
  { estado: 'borrador', name: 'Borradores', color: CHART_STATUS_COLORS.borrador },
  { estado: 'no-iniciado', name: 'Sin iniciar', color: PALETTE.slate },
  { estado: 'observado', name: 'Por corregir', color: CHART_STATUS_COLORS.observado },
  { estado: 'vencido', name: 'Vencidos', color: CHART_STATUS_COLORS.vencido },
];
const BASE: ChartOption = {
  color: [PALETTE.green, PALETTE.violet],
  animationDuration: 450,
  animationDurationUpdate: 250,
  textStyle: { fontFamily: 'Manrope Variable, sans-serif', fontSize: 14, color: '#354a65' },
  tooltip: {
    trigger: 'axis',
    confine: true,
    padding: [12, 16],
    borderWidth: 1,
    borderColor: '#a9bad0',
    backgroundColor: '#fff',
    extraCssText: 'border-radius:10px;box-shadow:0 8px 30px rgba(31,45,65,.12)',
    textStyle: { fontFamily: 'Manrope Variable, sans-serif', color: '#1c3046', fontSize: 14 },
    axisPointer: { type: 'line', lineStyle: { color: '#7389a5', type: 'dashed' } },
  },
  grid: { left: 8, right: 18, top: 18, bottom: 8, containLabel: true },
  legend: { show: false },
};

interface TablaGrafica {
  columnas: string[];
  filas: Array<Array<string | number>>;
}

function ChartTabs({
  label,
  value,
  onChange,
  items,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  items: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="chart-tabs" role="group" aria-label={label}>
      {items.map((item) => (
        <button
          type="button"
          key={item.value}
          aria-pressed={item.value === value}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function Grafica({
  title,
  eyebrow,
  description,
  option,
  tabla,
  empty = false,
  emptyDescription = 'Selecciona otro semestre o amplía el rango de fechas.',
  choices,
  summary,
  overlay,
  children,
  footer,
  className = '',
}: {
  title: string;
  eyebrow: string;
  description: string;
  option: ChartOption;
  tabla: TablaGrafica;
  empty?: boolean;
  emptyDescription?: string;
  choices?: ReactNode;
  summary?: ReactNode;
  overlay?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const instancia = useRef<EchartsInstance | undefined>(undefined);
  const ultimaOpcion = useRef(option);
  const [estado, setEstado] = useState<'cargando' | 'lista' | 'error'>('cargando');
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    ultimaOpcion.current = option;
    instancia.current?.setOption(
      {
        ...BASE,
        ...option,
        animation: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      },
      { notMerge: true },
    );
  }, [option]);

  useEffect(() => {
    if (empty || !contenedor.current) return;
    const elemento = contenedor.current;
    let desmontado = false;
    let grafica: EchartsInstance | undefined;
    let observador: ResizeObserver | undefined;
    void cargarEcharts()
      .then((echarts) => {
        if (desmontado) return;
        grafica = echarts.init(elemento, undefined, { renderer: 'canvas' });
        instancia.current = grafica;
        grafica.setOption(
          {
            ...BASE,
            ...ultimaOpcion.current,
            animation: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
          },
          { notMerge: true },
        );
        observador = new ResizeObserver(() => grafica?.resize());
        observador.observe(elemento);
        setEstado('lista');
      })
      .catch(() => {
        if (!desmontado) setEstado('error');
      });
    return () => {
      desmontado = true;
      observador?.disconnect();
      grafica?.dispose();
      instancia.current = undefined;
    };
  }, [empty, intento]);

  return (
    <Card className={`portal-chart-card ${className}`}>
      <header className="analytics-card-head">
        <div>
          <span className="analytics-eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        {choices}
      </header>
      <CardBody>
        {empty ? (
          <EmptyState title="Sin datos en este periodo" description={emptyDescription} />
        ) : (
          <>
            {summary}
            <div className="portal-chart-stage">
              <div className="portal-chart-shell">
                <div
                  className="portal-chart"
                  ref={contenedor}
                  role="img"
                  aria-label={`${title}. ${description}`}
                  aria-busy={estado === 'cargando'}
                />
                {estado === 'lista' && overlay}
                {estado === 'cargando' && (
                  <span className="portal-chart__status" role="status">
                    Cargando gráfica…
                  </span>
                )}
                {estado === 'error' && (
                  <span className="portal-chart__status" role="alert">
                    No se pudo cargar la gráfica.
                    <button
                      className="btn btn-falcon-default btn-sm"
                      onClick={() => {
                        setEstado('cargando');
                        setIntento((v) => v + 1);
                      }}
                    >
                      Reintentar
                    </button>
                  </span>
                )}
              </div>
              {children}
            </div>
            {footer}
            <details className="portal-chart__data">
              <summary>Ver datos del gráfico</summary>
              <div className="portal-chart__table-wrap" tabIndex={0}>
                <table>
                  <caption className="sr-only">{title}</caption>
                  <thead>
                    <tr>
                      {tabla.columnas.map((c) => (
                        <th key={c} scope="col">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tabla.filas.map((fila, indice) => (
                      <tr key={indice}>
                        {fila.map((valor, celda) => (
                          <td key={celda}>{valor}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </CardBody>
    </Card>
  );
}

/** Visual treatment informed by Falcon Analytics, Tabler and shadcn's area examples. */
export function PortalCharts({
  scope,
  simple = false,
}: {
  scope: DashboardScopeData;
  simple?: boolean;
}) {
  const [sessionView, setSessionView] = useState('evolucion');
  const [instrumentView, setInstrumentView] = useState('estado');
  const { sesiones, instrumentos } = scope.portal;
  const modelos = useMemo(() => {
    const semestre = semestres.find((item) => item.id === scope.semestreId);
    const inicioGrafica =
      semestre && semestre.inicio > scope.inicio ? semestre.inicio : scope.inicio;
    const finGrafica = semestre && semestre.fin < scope.fin ? semestre.fin : scope.fin;
    const inicio = new Date(`${inicioGrafica}T12:00:00Z`);
    const fin = new Date(`${finGrafica}T12:00:00Z`);
    const dias = Math.max(0, Math.round((fin.getTime() - inicio.getTime()) / 86_400_000));
    const paso = dias > 14 ? 7 : 1;
    const periodos: Array<{
      clave: string;
      label: string;
      programadas: number;
      realizadas: number;
      acumuladas: number;
      previstas: number;
    }> = [];
    if (inicioGrafica <= finGrafica) {
      const cursor = new Date(inicio);
      while (cursor <= fin && periodos.length < 60) {
        periodos.push({
          clave: cursor.toISOString().slice(0, 10),
          label: cursor.toLocaleDateString('es-PE', {
            day: 'numeric',
            month: 'short',
            timeZone: 'UTC',
          }),
          programadas: 0,
          realizadas: 0,
          acumuladas: 0,
          previstas: 0,
        });
        cursor.setUTCDate(cursor.getUTCDate() + paso);
      }
    }
    for (const sesion of sesiones) {
      const indice = Math.floor(
        (Date.parse(`${sesion.fecha}T12:00:00Z`) - inicio.getTime()) / (86_400_000 * paso),
      );
      const periodo = periodos[indice];
      if (!periodo) continue;
      if (['programada', 'reprogramada'].includes(sesion.estado)) periodo.programadas++;
      if (sesion.estado === 'realizada') periodo.realizadas++;
    }
    let lastActive = periodos.length - 1;
    while (
      lastActive >= 0 &&
      !periodos[lastActive]!.realizadas &&
      !periodos[lastActive]!.programadas
    )
      lastActive--;
    periodos.splice(lastActive + 1);
    let realizadas = 0;
    let programadas = 0;
    for (const periodo of periodos) {
      realizadas += periodo.realizadas;
      programadas += periodo.programadas;
      periodo.acumuladas = realizadas;
      periodo.previstas = programadas;
    }
    const estados = ESTADOS_INSTRUMENTO.map((item) => ({
      ...item,
      value: instrumentos.filter((i) => i.estado === item.estado).length,
    }));
    const tipos = ['individual', 'grupal'].map((tipo) => ({
      label: tipo === 'individual' ? 'Individual' : 'Grupal',
      realizadas: sesiones.filter((s) => s.tipo === tipo && s.estado === 'realizada').length,
      programadas: sesiones.filter(
        (s) => s.tipo === tipo && ['programada', 'reprogramada'].includes(s.estado),
      ).length,
    }));
    const formatos = [...new Set(instrumentos.map((i) => i.formato))].sort().map((formato) => {
      const items = instrumentos.filter((i) => i.formato === formato);
      return {
        formato: `Formato ${formato.slice(1)}`,
        avance: Math.round(items.reduce((sum, i) => sum + i.avance, 0) / items.length),
      };
    });
    const ejes = {
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#354a65', fontSize: 14, margin: 16, hideOverlap: true },
    };
    const sesionesOption: ChartOption = {
      xAxis: { type: 'category', boundaryGap: false, data: periodos.map((p) => p.label), ...ejes },
      yAxis: {
        type: 'value',
        minInterval: 1,
        splitNumber: 4,
        ...ejes,
        splitLine: { lineStyle: { color: '#d5dee9', type: 'dashed' } },
      },
      series: [
        waveSeries({
          name: 'Realizadas · acumulado',
          data: periodos.map((p) => p.acumuladas),
          color: PALETTE.green,
          fill: 'rgba(23,96,54,0.28)',
        }),
        waveSeries({
          name: 'Programadas · acumulado',
          data: periodos.map((p) => p.previstas),
          color: PALETTE.violet,
          fill: 'rgba(121,99,181,0.16)',
          dashed: true,
        }),
      ],
    };
    const tiposOption: ChartOption = {
      ...(simple ? { color: [PALETTE.green, PALETTE.blue] } : {}),
      grid: { left: 8, right: 36, top: 30, bottom: 24, containLabel: true },
      xAxis: {
        type: 'value',
        minInterval: 1,
        ...ejes,
        splitLine: { lineStyle: { color: '#d5dee9', type: 'dashed' } },
      },
      yAxis: { type: 'category', data: tipos.map((t) => t.label), ...ejes },
      series: ['realizadas', 'programadas'].map((key, index) => ({
        name: index ? 'Programadas' : 'Realizadas',
        type: 'bar',
        barMaxWidth: 24,
        barGap: '45%',
        itemStyle: { borderRadius: [0, 5, 5, 0] },
        label: { show: true, position: 'right', color: '#26384f', fontSize: 14 },
        data: tipos.map((t) => (key === 'realizadas' ? t.realizadas : t.programadas)),
      })),
    };
    const instrumentosOption: ChartOption = {
      color: estados.map((e) => e.color),
      tooltip: {
        ...(BASE.tooltip as Record<string, unknown>),
        trigger: 'item',
        formatter: '{b}<br/><strong>{c}</strong> instrumentos · {d}%',
      },
      series: [
        {
          name: 'Instrumentos',
          type: 'pie',
          radius: ['68%', '88%'],
          center: ['50%', '50%'],
          padAngle: 3,
          minAngle: 0,
          avoidLabelOverlap: true,
          label: { show: false },
          labelLine: { show: false },
          itemStyle: { borderRadius: 5 },
          emphasis: {
            scale: true,
            scaleSize: 6,
            itemStyle: { shadowBlur: 12, shadowColor: 'rgba(43,59,82,.12)' },
          },
          data: estados.map((e) => ({ name: e.name, value: e.value })),
        },
      ],
    };
    const sesionesClarasOption: ChartOption = {
      color: [PALETTE.green, PALETTE.blue],
      grid: { left: 0, right: 18, top: 24, bottom: 8, containLabel: true },
      tooltip: {
        ...(BASE.tooltip as Record<string, unknown>),
        axisPointer: { type: 'shadow' },
      },
      xAxis: {
        type: 'category',
        data: periodos.map((p) => p.label),
        ...ejes,
        axisLabel: { color: '#354a65', fontSize: 12, hideOverlap: true },
      },
      yAxis: {
        type: 'value',
        name: 'Sesiones',
        nameTextStyle: { color: '#405548', fontSize: 12, align: 'left' },
        minInterval: 1,
        ...ejes,
        axisLabel: { color: '#354a65', fontSize: 12 },
        splitLine: { lineStyle: { color: '#e2eae5', type: 'dashed' } },
      },
      series: ['realizadas', 'programadas'].map((key, index) => ({
        name: index ? 'Programadas' : 'Realizadas',
        type: 'bar',
        barMaxWidth: 20,
        barGap: '20%',
        itemStyle: { borderRadius: [4, 4, 0, 0] },
        label: {
          show: true,
          position: 'top',
          color: '#26384f',
          fontSize: 12,
          formatter: (dato: { value: number }) => (dato.value ? String(dato.value) : ''),
        },
        data: periodos.map((p) => (key === 'realizadas' ? p.realizadas : p.programadas)),
      })),
    };
    const sesionesOndasOption: ChartOption = {
      ...sesionesClarasOption,
      tooltip: {
        ...(BASE.tooltip as Record<string, unknown>),
        axisPointer: { type: 'line', lineStyle: { color: '#9fb8a9', type: 'dashed' } },
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: periodos.map((p) => p.label),
        ...ejes,
        axisLabel: { color: PALETTE.text, fontSize: 12, hideOverlap: true },
      },
      series: [
        waveSeries({
          name: 'Realizadas',
          data: periodos.map((p) => p.realizadas),
          color: PALETTE.green,
          fill: 'rgba(23,96,54,0.28)',
          labels: true,
        }),
        waveSeries({
          name: 'Programadas',
          data: periodos.map((p) => p.programadas),
          color: PALETTE.blue,
          fill: 'rgba(54,118,179,0.16)',
          dashed: true,
          labels: true,
        }),
      ],
    };
    const estadosClarosOption: ChartOption = {
      grid: { left: 0, right: 28, top: 18, bottom: 8, containLabel: true },
      tooltip: { ...(BASE.tooltip as Record<string, unknown>), axisPointer: { type: 'shadow' } },
      xAxis: {
        type: 'value',
        minInterval: 1,
        ...ejes,
        axisLabel: { color: '#354a65', fontSize: 12 },
        splitLine: { lineStyle: { color: '#e2eae5', type: 'dashed' } },
      },
      yAxis: {
        type: 'category',
        inverse: true,
        ...ejes,
        axisLabel: { color: '#354a65', fontSize: 12, margin: 10 },
        data: estados.filter((e) => e.value > 0).map((e) => e.name),
      },
      series: [
        {
          name: 'Formularios',
          type: 'bar',
          barMaxWidth: 18,
          showBackground: true,
          backgroundStyle: { color: '#f1f5f2', borderRadius: 4 },
          itemStyle: { borderRadius: [0, 6, 6, 0] },
          label: { show: true, position: 'right', color: '#26384f', fontSize: 12 },
          data: estados
            .filter((e) => e.value > 0)
            .map((e) => ({
              value: e.value,
              itemStyle: { color: e.color },
            })),
        },
      ],
    };
    const avanceOption: ChartOption = {
      grid: { left: 4, right: 8, top: 12, bottom: 12, containLabel: true },
      tooltip: {
        ...(BASE.tooltip as Record<string, unknown>),
        valueFormatter: (v: number) => `${v}%`,
      },
      xAxis: {
        type: 'value',
        min: 0,
        max: 100,
        show: false,
      },
      yAxis: [
        {
          type: 'category',
          inverse: true,
          data: formatos.map((f) => f.formato.replace('Formato ', 'F')),
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: PALETTE.text,
            fontSize: 12,
            fontFamily: 'JetBrains Mono',
            margin: 12,
            interval: 0,
          },
        },
        {
          type: 'category',
          inverse: true,
          position: 'right',
          data: formatos.map((f) => `${f.avance}%`),
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: PALETTE.text,
            fontSize: 12,
            fontFamily: 'JetBrains Mono',
            margin: 40,
            align: 'right',
            interval: 0,
          },
        },
      ],
      series: [
        {
          name: 'Avance',
          type: 'bar',
          barMaxWidth: 8,
          showBackground: true,
          backgroundStyle: { color: '#edf2ef', borderRadius: 5 },
          itemStyle: { borderRadius: 5 },
          label: { show: false },
          data: formatos.map((f) => ({
            value: f.avance,
            itemStyle: {
              color: f.avance >= 100 ? PALETTE.green : PALETTE.amber,
            },
          })),
        },
      ],
    };
    return {
      periodos,
      tipos,
      estados,
      formatos,
      realizadas,
      programadas,
      paso,
      sesionesOption,
      sesionesClarasOption,
      sesionesOndasOption,
      estadosClarosOption,
      tiposOption,
      instrumentosOption,
      avanceOption,
    };
  }, [sesiones, instrumentos, scope.inicio, scope.fin, scope.semestreId, simple]);
  const total = modelos.realizadas + modelos.programadas;
  const ejecucion = total ? Math.round((modelos.realizadas / total) * 100) : 0;
  const aprobados = modelos.estados.find((e) => e.estado === 'aprobado')?.value ?? 0;
  const porcentajeAprobado = instrumentos.length
    ? Math.round((aprobados / instrumentos.length) * 100)
    : 0;
  return (
    <div className={`portal-charts-grid${simple ? ' portal-charts--simple' : ''}`}>
      <Grafica
        title={
          simple
            ? sessionView === 'tipo'
              ? 'Sesiones por tipo'
              : modelos.paso === 7
                ? 'Sesiones por semana'
                : 'Sesiones por día'
            : 'Sesiones de tutoría'
        }
        eyebrow={simple ? '' : 'SESIONES'}
        description={
          simple
            ? 'Realizadas y programadas en el periodo elegido.'
            : sessionView === 'tipo'
              ? 'Compara las sesiones individuales y grupales.'
              : `Sesiones acumuladas por ${modelos.paso === 7 ? 'semana' : 'día'} en el periodo.`
        }
        className="chart-card--activity"
        choices={
          <ChartTabs
            label="Gráfica de sesiones"
            value={sessionView}
            onChange={setSessionView}
            items={[
              { value: 'evolucion', label: simple ? 'Ondas' : 'Evolución' },
              ...(simple ? [{ value: 'barras', label: 'Barras' }] : []),
              { value: 'tipo', label: 'Por tipo' },
            ]}
          />
        }
        summary={
          simple ? (
            <div
              className={`chart-simple-totals${sessionView === 'evolucion' ? ' chart-simple-totals--waves' : ''}`}
            >
              <span>
                <i style={{ background: PALETTE.green }} aria-hidden="true" />
                <strong>{modelos.realizadas}</strong> realizadas
              </span>
              <span>
                <i style={{ background: PALETTE.blue }} aria-hidden="true" />
                <strong>{modelos.programadas}</strong> programadas
              </span>
            </div>
          ) : (
            <div className="chart-activity-summary">
              <div className="chart-activity-total">
                <strong>{total}</strong>
                <span>sesiones en el periodo</span>
                <span className="chart-execution-badge">{ejecucion}% realizadas</span>
              </div>
              <div className="chart-series-legend">
                <span>
                  <i />
                  <b>{modelos.realizadas}</b>Realizadas
                </span>
                <span>
                  <i />
                  <b>{modelos.programadas}</b>Programadas
                </span>
              </div>
            </div>
          )
        }
        option={
          sessionView === 'tipo'
            ? modelos.tiposOption
            : simple
              ? sessionView === 'barras'
                ? modelos.sesionesClarasOption
                : modelos.sesionesOndasOption
              : modelos.sesionesOption
        }
        empty={total === 0}
        tabla={{
          columnas:
            sessionView === 'tipo'
              ? ['Tipo', 'Realizadas', 'Programadas']
              : simple
                ? ['Semana o día', 'Realizadas', 'Programadas']
                : [
                    'Periodo',
                    'Realizadas',
                    'Programadas',
                    'Realizadas acumuladas',
                    'Programadas acumuladas',
                  ],
          filas:
            sessionView === 'tipo'
              ? modelos.tipos.map((t) => [t.label, t.realizadas, t.programadas])
              : simple
                ? modelos.periodos.map((p) => [p.label, p.realizadas, p.programadas])
                : modelos.periodos.map((p) => [
                    p.label,
                    p.realizadas,
                    p.programadas,
                    p.acumuladas,
                    p.previstas,
                  ]),
        }}
        footer={
          <div className="chart-activity-footer">
            {!simple && (
              <span>
                <i />
                {modelos.paso === 7 ? 'Por semana' : 'Por día'}
              </span>
            )}
            <span>
              {sessionView === 'tipo'
                ? 'Cada barra representa sesiones del periodo.'
                : simple
                  ? 'Cada fecha se cuenta por separado.'
                  : 'Las cifras se van sumando durante el periodo.'}
            </span>
          </div>
        }
      />
      <Grafica
        title="Formularios de tutoría"
        eyebrow={simple ? '' : 'FORMULARIOS'}
        description={
          simple
            ? 'Consulta el estado y el avance de tus formularios.'
            : 'Estado y avance de los formularios del periodo.'
        }
        className={`chart-card--instruments ${instrumentView === 'avance' ? 'chart-card--formats' : ''}`}
        choices={
          <ChartTabs
            label="Gráfica de formularios"
            value={instrumentView}
            onChange={setInstrumentView}
            items={[
              { value: 'estado', label: simple ? 'Por estado' : 'Estados' },
              { value: 'avance', label: simple ? 'Por formato' : 'Avance' },
            ]}
          />
        }
        option={
          instrumentView === 'estado'
            ? simple
              ? modelos.estadosClarosOption
              : modelos.instrumentosOption
            : modelos.avanceOption
        }
        empty={!instrumentos.length}
        overlay={
          !simple &&
          instrumentView === 'estado' && (
            <div className="chart-radial-total">
              <span>TOTAL</span>
              <strong>{instrumentos.length}</strong>
              <small>formularios</small>
            </div>
          )
        }
        tabla={{
          columnas:
            instrumentView === 'avance'
              ? ['Formato', simple ? 'Preguntas respondidas (%)' : 'Avance (%)']
              : ['Estado', 'Formularios', 'Porcentaje (%)'],
          filas:
            instrumentView === 'avance'
              ? modelos.formatos.map((f) => [f.formato, f.avance])
              : modelos.estados.map((e) => [
                  e.name,
                  e.value,
                  Math.round((e.value / Math.max(1, instrumentos.length)) * 100),
                ]),
        }}
        footer={
          !simple && (
            <div className="chart-instrument-footer">
              <span>Aprobados</span>
              <strong>
                {aprobados}
                <small> / {instrumentos.length}</small>
              </strong>
              <div>
                <span style={{ width: `${porcentajeAprobado}%` }} />
              </div>
              <b>{porcentajeAprobado}%</b>
            </div>
          )
        }
      >
        {!simple && instrumentView === 'estado' && (
          <ul className="chart-state-legend">
            {modelos.estados.map((e) => (
              <li key={e.estado}>
                <i style={{ background: e.color }} />
                <span>{e.name}</span>
                <strong>{e.value}</strong>
              </li>
            ))}
          </ul>
        )}
      </Grafica>
    </div>
  );
}
