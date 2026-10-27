import { describe, expect, it } from 'vitest';
import { definicionPorCodigo, definicionesFormato } from '../data/formatos';
import {
  crearEsquemaFormulario,
  crearEsquemaRespuestas,
  deserializarFormulario,
  erroresInstrumento,
  serializarFormulario,
} from './validacionInstrumentos';

const f04 = definicionPorCodigo('F04')!;
const f06 = definicionPorCodigo('F06')!;

describe('esquemas Zod de los instrumentos', () => {
  it.each(definicionesFormato.map((d) => [d.codigo, d] as const))(
    '%s dispone de un resolver compatible con borradores vacíos',
    (_, definicion) => {
      const valores = deserializarFormulario(definicion, {});
      expect(() => crearEsquemaFormulario(definicion).safeParse(valores)).not.toThrow();
      expect(serializarFormulario(valores)).toEqual(
        Object.fromEntries(
          definicion.secciones
            .flatMap((s) => s.campos)
            .filter((c) => c.tipo === 'tabla')
            .map((c) => [c.codigo, '']),
        ),
      );
    },
  );
  it('exige solo las respuestas condicionales visibles, incluida la explicación de Otro', () => {
    const ocultos = erroresInstrumento(f04, {
      expectativas: 'Sí',
      motivoExpectativas: '',
      transporte: 'A pie',
      transporte__otro: '',
    });
    expect(ocultos).not.toHaveProperty('motivoExpectativas');
    expect(ocultos).not.toHaveProperty('transporte__otro');
    const visibles = erroresInstrumento(f04, { expectativas: 'No', transporte: 'Otro' });
    expect(visibles.motivoExpectativas).toContain('Completa');
    expect(visibles.transporte__otro).toContain('otra respuesta');
  });
  it('rechaza una opción inventada, números inválidos, horas y fechas imposibles', () => {
    expect(
      erroresInstrumento(f04, {
        motivacion: 'inventado',
        tiempoTransporte: '-3',
        correo: 'sin-arroba',
      }),
    ).toMatchObject({
      motivacion: expect.any(String),
      tiempoTransporte: expect.any(String),
      correo: expect.any(String),
    });
    expect(
      erroresInstrumento(f06, { fecha: '2026-02-30', horaInicio: '25:00', horaFin: '26:00' }),
    ).toMatchObject({
      fecha: expect.any(String),
      horaInicio: expect.any(String),
      horaFin: expect.any(String),
    });
    expect(erroresInstrumento(f06, { fecha: '2024-02-29' })).not.toHaveProperty('fecha');
  });
  it('rechaza tablas con JSON inválido, columnas vacías y participantes repetidos', () => {
    for (const asistentes of ['{', '[null]', '[{"nombre":42}]', '[{"nombre":""}]'])
      expect(erroresInstrumento(f06, { asistentes })).toHaveProperty('asistentes');
    const fila = {
      nombre: 'Estudiante ficticio',
      grupo: 'G-1',
      tipo: 'Académica',
      estudianteId: 'E-1',
    };
    expect(
      erroresInstrumento(f06, { asistentes: JSON.stringify([fila, fila]) }).asistentes,
    ).toContain('No repitas');
  });
  it('admite una tabla opcional vacía y limita el total diario de horas', () => {
    expect(erroresInstrumento(f04, { administracionTiempo: '[]' })).not.toHaveProperty(
      'administracionTiempo',
    );
    expect(
      erroresInstrumento(f04, {
        administracionTiempo: JSON.stringify([
          { actividad: 'Estudio', horas: '20' },
          { actividad: 'Trabajo', horas: '8' },
        ]),
      }).administracionTiempo,
    ).toContain('24');
    expect(
      erroresInstrumento(f04, { otrasActividades: '["Solo estudio","Trabajo"]' }).otrasActividades,
    ).toContain('excluyentes');
  });
  it('conserva los borradores serializados y los IDs de estudiantes sin añadir las claves internas de RHF', () => {
    const respuestas = {
      fecha: '2026-10-10',
      asistentes: JSON.stringify([
        { nombre: 'Estudiante ficticio', grupo: 'G-1', tipo: 'Académica', estudianteId: 'E-1' },
      ]),
    };
    expect(serializarFormulario(deserializarFormulario(f06, respuestas))).toEqual(respuestas);
  });
  it('el resolver y la validación del adaptador señalan la misma tabla y los mismos campos', () => {
    const respuestas = { fecha: '2026-02-30', asistentes: '[{}]' };
    const raw = crearEsquemaRespuestas(f06).safeParse(respuestas);
    const formulario = crearEsquemaFormulario(f06).safeParse(
      deserializarFormulario(f06, respuestas),
    );
    expect(raw.success).toBe(false);
    expect(formulario.success).toBe(false);
    if (!raw.success && !formulario.success) {
      expect(formulario.error.issues.map((i) => i.path.join('.'))).toContain('tablas.asistentes');
      expect(formulario.error.issues.map((i) => i.path.join('.'))).toContain('respuestas.fecha');
      expect(formulario.error.issues.map((i) => i.message)).toEqual(
        raw.error.issues.map((i) => i.message),
      );
    }
  });
});
