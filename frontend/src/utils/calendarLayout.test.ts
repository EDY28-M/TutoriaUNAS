import { describe, expect, it } from 'vitest';
import { distribuirCalendario } from './calendarLayout';

function intervalo(evento: string, inicio: number, fin: number) {
  return { evento, rango: { inicio, fin } };
}

describe('distribución de coincidencias del calendario', () => {
  it('separa disponibilidad y sesión sin colocar una encima de la otra', () => {
    const [grupo] = distribuirCalendario([
      intervalo('sesión', 17 * 60, 18 * 60),
      intervalo('disponibilidad', 16 * 60, 18 * 60),
    ]);
    if (!grupo) throw new Error('Falta el grupo de eventos coincidentes');
    expect(grupo.columnas).toBe(2);
    expect(grupo.items.map((item) => item.columna)).toEqual([0, 1]);
  });

  it('recupera todo el ancho después de terminar una coincidencia', () => {
    const grupos = distribuirCalendario([
      intervalo('A', 540, 600),
      intervalo('B', 570, 630),
      intervalo('C', 630, 690),
    ]);
    expect(grupos.map((grupo) => grupo.columnas)).toEqual([2, 1]);
    expect(grupos[1]?.items[0]?.evento).toBe('C');
  });

  it('reutiliza columnas en coincidencias encadenadas y conserva todos los eventos', () => {
    const entradas = [
      intervalo('A', 480, 660),
      intervalo('B', 500, 550),
      intervalo('C', 550, 620),
      intervalo('D', 560, 600),
    ];
    const [grupo] = distribuirCalendario(entradas);
    if (!grupo) throw new Error('Falta el grupo de eventos encadenados');
    expect(grupo.columnas).toBe(3);
    expect(grupo.items).toHaveLength(entradas.length);
    for (const a of grupo.items) {
      for (const b of grupo.items) {
        if (a === b || a.rango.fin <= b.rango.inicio || b.rango.fin <= a.rango.inicio) continue;
        expect(a.columna).not.toBe(b.columna);
      }
    }
  });

  it('admite una agenda vacía y no modifica el orden de entrada', () => {
    expect(distribuirCalendario([])).toEqual([]);
    const entradas = [intervalo('tarde', 960, 1020), intervalo('mañana', 480, 540)];
    distribuirCalendario(entradas);
    expect(entradas.map((item) => item.evento)).toEqual(['tarde', 'mañana']);
  });
});
