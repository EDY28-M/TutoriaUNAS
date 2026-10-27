/**
 * Utilidades de fecha en español (zona horaria local de demostración).
 * Todas las fechas del sistema se almacenan como ISO `AAAA-MM-DD` y las marcas
 * de tiempo como ISO completo, tal como exige el formato de entrega de datos.
 */

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const MESES_CORTOS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'set',
  'oct',
  'nov',
  'dic',
];

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
export const DIAS_SEMANA = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
];

/** Fecha de referencia de la demostración. */
export const HOY_ISO = '2026-10-14';

/** Fecha operativa; el corte fijo de los datos ficticios no determina el día de hoy. */
export function fechaActualLima(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Lima' }).format(new Date());
}

function aFecha(valor: string): Date {
  const [fecha, hora] = valor.split('T');
  const [anio, mes, dia] = (fecha ?? '').split('-').map(Number);
  const [h = 0, m = 0] = (hora ?? '').split(':').map(Number);
  return new Date(anio ?? 1970, (mes ?? 1) - 1, dia ?? 1, h, m);
}

export function formatFecha(valor: string | null | undefined): string {
  if (!valor) return '—';
  const fecha = aFecha(valor);
  return `${fecha.getDate()} ${MESES_CORTOS[fecha.getMonth()]} ${fecha.getFullYear()}`;
}

export function formatFechaLarga(valor: string | null | undefined): string {
  if (!valor) return '—';
  const fecha = aFecha(valor);
  return `${DIAS[fecha.getDay()]}, ${fecha.getDate()} de ${MESES[fecha.getMonth()]} de ${fecha.getFullYear()}`;
}

export function formatFechaCorta(valor: string | null | undefined): string {
  if (!valor) return '—';
  const fecha = aFecha(valor);
  return `${String(fecha.getDate()).padStart(2, '0')}/${String(fecha.getMonth() + 1).padStart(2, '0')}/${fecha.getFullYear()}`;
}

export function formatFechaHora(valor: string | null | undefined): string {
  if (!valor) return '—';
  const fecha = aFecha(valor);
  return `${formatFecha(valor)} · ${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`;
}

export function formatHora(valor: string | null | undefined): string {
  if (!valor) return '—';
  const [h, m] = valor.split(':').map(Number);
  const sufijo = (h ?? 0) < 12 ? 'a. m.' : 'p. m.';
  const hora12 = (h ?? 0) % 12 === 0 ? 12 : (h ?? 0) % 12;
  return `${hora12}:${String(m ?? 0).padStart(2, '0')} ${sufijo}`;
}

export function formatRangoHora(inicio: string, fin: string): string {
  return `${inicio} – ${fin}`;
}

export function mesTitulo(fecha: Date): string {
  return `${MESES[fecha.getMonth()]} de ${fecha.getFullYear()}`;
}

export function diaSemanaCorto(dia: number): string {
  return DIAS_CORTOS[dia % 7] ?? '';
}

export function esMismaFecha(iso: string, fecha: Date): boolean {
  const otra = aFecha(iso);
  return (
    otra.getFullYear() === fecha.getFullYear() &&
    otra.getMonth() === fecha.getMonth() &&
    otra.getDate() === fecha.getDate()
  );
}

export function aIso(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

export interface CeldaCalendario {
  fecha: Date;
  iso: string;
  dia: number;
  fueraDeMes: boolean;
  esHoy: boolean;
}

/** Matriz de seis semanas (42 celdas) que comienza en lunes. */
export function matrizMensual(
  anio: number,
  mes: number,
  hoy = fechaActualLima(),
): CeldaCalendario[] {
  const primero = new Date(anio, mes, 1);
  const desplazamiento = (primero.getDay() + 6) % 7;
  const inicio = new Date(anio, mes, 1 - desplazamiento);
  const celdas: CeldaCalendario[] = [];
  for (let i = 0; i < 42; i += 1) {
    const fecha = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
    celdas.push({
      fecha,
      iso: aIso(fecha),
      dia: fecha.getDate(),
      fueraDeMes: fecha.getMonth() !== mes,
      esHoy: aIso(fecha) === hoy,
    });
  }
  return celdas;
}

export function sumarDias(fecha: Date, dias: number): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() + dias);
}

export function desdeIso(iso: string): Date {
  return aFecha(iso);
}

export function agruparPorFecha<T>(items: T[], obtener: (item: T) => string): Array<[string, T[]]> {
  const mapa = new Map<string, T[]>();
  for (const item of items) {
    const clave = obtener(item).slice(0, 10);
    const lista = mapa.get(clave) ?? [];
    lista.push(item);
    mapa.set(clave, lista);
  }
  return [...mapa.entries()].sort(([a], [b]) => a.localeCompare(b));
}
