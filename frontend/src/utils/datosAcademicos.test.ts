import { describe, expect, it } from 'vitest';
import { estudiantes } from '../data/personas';
import { etiquetaEtapa, promedioDe } from './datosAcademicos';

describe('datos académicos ausentes en el padrón', () => {
  it('excluye el PPA ausente del denominador y conserva el cero informado', () => {
    expect(
      promedioDe(
        [0, null, 14].map((promedioPonderado) => ({ ...estudiantes[0]!, promedioPonderado })),
      ),
    ).toBe(7);
  });
  it('no convierte un grupo sin PPA en un promedio cero', () => {
    expect(promedioDe([])).toBeNull();
    expect(promedioDe([{ ...estudiantes[0]!, promedioPonderado: null }])).toBeNull();
  });
  it('no asigna una etapa académica a un ciclo que no se informó', () => {
    expect(etiquetaEtapa('sin-informar')).toBe('Ciclo sin informar');
  });
});
