import { describe, expect, it } from 'vitest';
import { definicionPorCodigo } from '../data/formatos';
import { preguntasRegistradas } from './preguntasPendientes';

describe('preguntas que ya tienen respuesta', () => {
  it('conserva el dato válido sin ocultar preguntas incompletas o inválidas', () => {
    const guardadas = preguntasRegistradas(definicionPorCodigo('F04')!, {
      colegio: 'I.E. ficticia',
      expectativas: 'No',
      motivoExpectativas: '',
      lugarEstudio: 'Otro',
      lugarEstudio__otro: '',
      cursosDificiles: '[]',
    });
    expect(guardadas.has('colegio')).toBe(true);
    expect(guardadas.has('expectativas')).toBe(true);
    expect(guardadas.has('motivoExpectativas')).toBe(false);
    expect(guardadas.has('lugarEstudio')).toBe(false);
    expect(guardadas.has('cursosDificiles')).toBe(false);
  });
});
