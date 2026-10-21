/** Estilo compartido para los gráficos locales de ECharts, sin añadir librerías. */
export const CHART_COLORS = {
  green: '#176036',
  blue: '#3676b3',
  violet: '#7963b5',
  amber: '#b38931',
  slate: '#84998c',
  rose: '#b34856',
  line: '#e2eae5',
  text: '#405548',
};

export const CHART_STATUS_COLORS = {
  'no-iniciado': CHART_COLORS.slate,
  borrador: CHART_COLORS.amber,
  enviado: CHART_COLORS.blue,
  observado: CHART_COLORS.rose,
  aprobado: CHART_COLORS.green,
  vencido: CHART_COLORS.violet,
};

export function waveSeries({
  name,
  data,
  color,
  fill,
  dashed = false,
  labels = false,
}: {
  name: string;
  data: number[];
  color: string;
  fill: string;
  dashed?: boolean;
  labels?: boolean;
}) {
  return {
    name,
    type: 'line',
    data,
    smooth: 0.34,
    smoothMonotone: 'x',
    clip: true,
    showSymbol: data.length <= 14,
    symbol: 'circle',
    symbolSize: 5,
    lineStyle: {
      width: dashed ? 2.5 : 3,
      color,
      type: dashed ? 'dashed' : 'solid',
      cap: 'round',
      join: 'round',
    },
    itemStyle: { color, borderColor: '#fff', borderWidth: 1.5 },
    areaStyle: {
      color: {
        type: 'linear',
        x: 0,
        y: 0,
        x2: 0,
        y2: 1,
        colorStops: [
          { offset: 0, color: fill },
          { offset: 1, color: 'rgba(255,255,255,0)' },
        ],
      },
      origin: 'start',
    },
    label: {
      show: labels && data.length <= 14,
      position: 'top',
      distance: 10,
      color: CHART_COLORS.text,
      fontSize: 11,
      formatter: (item: { value: number }) => (item.value ? String(item.value) : ''),
    },
    emphasis: { focus: 'series', scale: true },
  };
}
