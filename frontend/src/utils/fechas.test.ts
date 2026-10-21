import { describe, expect, it } from 'vitest';
import {
  aIso,
  agruparPorFecha,
  desdeIso,
  diaSemanaCorto,
  esMismaFecha,
  formatFecha,
  formatFechaCorta,
  formatFechaHora,
  formatFechaLarga,
  formatHora,
  formatRangoHora,
  matrizMensual,
  mesTitulo,
  sumarDias,
} from './fechas';

describe('formato de fechas en español', () => {
  it('presenta la fecha en formato corto, largo y de marca de tiempo', () => {
    expect(formatFecha('2026-10-14')).toBe('14 oct 2026');
    expect(formatFechaLarga('2026-10-14')).toBe('miércoles, 14 de octubre de 2026');
    expect(formatFechaCorta('2026-10-14')).toBe('14/10/2026');
    expect(formatFechaHora('2026-10-14T08:05:00')).toBe('14 oct 2026 · 08:05');
  });

  it('devuelve un guion cuando no hay fecha', () => {
    expect(formatFecha(null)).toBe('—');
    expect(formatFechaLarga(undefined)).toBe('—');
    expect(formatFechaHora('')).toBe('—');
  });

  it('convierte horas al formato de doce horas', () => {
    expect(formatHora('08:30')).toBe('8:30 a. m.');
    expect(formatHora('13:45')).toBe('1:45 p. m.');
    expect(formatHora('00:05')).toBe('12:05 a. m.');
    expect(formatHora('12:00')).toBe('12:00 p. m.');
    expect(formatHora(null)).toBe('—');
    expect(formatRangoHora('08:00', '10:00')).toBe('08:00 – 10:00');
  });

  it('titula el mes y acorta los días de la semana', () => {
    expect(mesTitulo(new Date(2026, 9, 1))).toBe('octubre de 2026');
    expect(diaSemanaCorto(1)).toBe('lun');
    expect(diaSemanaCorto(7)).toBe('dom');
  });
});

describe('operaciones de calendario', () => {
  it('construye 42 celdas que empiezan en lunes', () => {
    const celdas = matrizMensual(2026, 9);
    expect(celdas).toHaveLength(42);
    expect(diaSemanaCorto(celdas[0]!.fecha.getDay())).toBe('lun');
    expect(celdas.some((celda) => celda.esHoy)).toBe(true);
    expect(celdas.filter((celda) => celda.fueraDeMes).length).toBeGreaterThan(0);
  });

  it('marca el primer día del mes correctamente', () => {
    const celdas = matrizMensual(2026, 9);
    const primero = celdas.find((celda) => celda.iso === '2026-10-01');
    expect(primero?.dia).toBe(1);
    expect(primero?.fueraDeMes).toBe(false);
  });

  it('compara fechas y desplaza días', () => {
    expect(esMismaFecha('2026-10-14', new Date(2026, 9, 14))).toBe(true);
    expect(esMismaFecha('2026-10-13', new Date(2026, 9, 14))).toBe(false);
    expect(aIso(sumarDias(new Date(2026, 9, 14), 5))).toBe('2026-10-19');
    expect(aIso(desdeIso('2026-10-14'))).toBe('2026-10-14');
  });

  it('agrupa registros por fecha y los ordena', () => {
    const registros = [
      { id: 'b', fecha: '2026-10-20' },
      { id: 'a', fecha: '2026-10-14' },
      { id: 'c', fecha: '2026-10-20' },
    ];
    const grupos = agruparPorFecha(registros, (registro) => registro.fecha);
    expect(grupos.map(([fecha]) => fecha)).toEqual(['2026-10-14', '2026-10-20']);
    expect(grupos[1]?.[1]).toHaveLength(2);
  });

  it('acepta marcas de tiempo completas y horas sin minutos', () => {
    expect(formatFecha('2026-10-14T08:05:00')).toBe('14 oct 2026');
    expect(formatFechaHora('2026-10-14T08:05')).toBe('14 oct 2026 · 08:05');
    expect(formatHora('9')).toBe('9:00 a. m.');
    expect(formatHora('9:')).toBe('9:00 a. m.');
    expect(esMismaFecha('2026-10-14T23:59', new Date(2026, 9, 14))).toBe(true);
  });

  it('construye correctamente un mes que comienza en domingo', () => {
    const celdas = matrizMensual(2026, 2);
    expect(celdas[0]!.fueraDeMes).toBe(true);
    expect(celdas[6]!.iso).toBe('2026-03-01');
    expect(celdas[6]!.fueraDeMes).toBe(false);
    expect(celdas.filter((celda) => celda.esHoy)).toHaveLength(0);
  });

  it('normaliza el índice del día de la semana', () => {
    expect(diaSemanaCorto(0)).toBe('dom');
    expect(diaSemanaCorto(8)).toBe('lun');
  });
});
