import type { MatriculaCurso } from '../types/domain';

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export interface FranjaClase {
  /** 1 = lunes … 7 = domingo; 0 si el Excel trae un día ilegible. */
  dia: number;
  diaTexto: string;
  /** Horas en formato 24 h, o null cuando el rango no se puede interpretar. */
  inicio: number | null;
  fin: number | null;
  horas: string;
  aula: string;
  practica: boolean;
}

const dosDigitos = (hora: number) => `${String(hora).padStart(2, '0')}:00`;

/**
 * Interpreta los rangos del Excel de la DIAA: «09-01 pm.» es de 9:00 a 13:00 y
 * «02-05 pm.» de 14:00 a 17:00 (el sufijo indica la hora de término).
 */
export function rangoHoras(horas: string): { inicio: number; fin: number } | null {
  const partes = /^(\d{1,2})\s*-\s*(\d{1,2})\s*(am|pm)\.?$/i.exec(horas.trim());
  if (!partes) return null;
  const a = Number(partes[1]);
  const b = Number(partes[2]);
  if (a < 1 || a > 12 || b < 1 || b > 12) return null;
  let inicio: number;
  let fin: number;
  if (partes[3]!.toLowerCase() === 'pm') {
    fin = b === 12 ? 12 : b + 12;
    inicio = a <= b && a !== 12 ? a + 12 : a;
  } else {
    inicio = a === 12 ? 0 : a;
    fin = b;
  }
  return fin > inicio ? { inicio, fin } : null;
}

/** Franjas de un curso, sin duplicados y ordenadas por día y hora. */
export function franjasDe(curso: Pick<MatriculaCurso, 'horariosOriginales'>): FranjaClase[] {
  const vistas = new Set<string>();
  const franjas: FranjaClase[] = [];
  for (const fila of curso.horariosOriginales ?? []) {
    const clave = `${fila.dia}|${fila.horas}|${fila.aula}`;
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    const dia = Number(fila.dia);
    const rango = rangoHoras(fila.horas);
    const valido = Number.isInteger(dia) && dia >= 1 && dia <= 7;
    franjas.push({
      dia: valido ? dia : 0,
      diaTexto: valido ? DIAS[dia - 1]! : fila.dia || 'Día ?',
      inicio: rango?.inicio ?? null,
      fin: rango?.fin ?? null,
      horas: rango ? `${dosDigitos(rango.inicio)}–${dosDigitos(rango.fin)}` : fila.horas,
      aula: (fila.aula || fila.codigoAula || '').trim(),
      practica: fila.esHoraTeorica === '0',
    });
  }
  return franjas.sort((x, y) => x.dia - y.dia || (x.inicio ?? 99) - (y.inicio ?? 99));
}

/** «18 h a la semana · 4 días» a partir de todas las franjas legibles. */
export function cargaSemanal(franjas: FranjaClase[]): { horas: number; dias: number } {
  const legibles = franjas.filter((f) => f.inicio !== null && f.fin !== null);
  return {
    horas: legibles.reduce((total, f) => total + (f.fin! - f.inicio!), 0),
    dias: new Set(legibles.map((f) => f.dia)).size,
  };
}
