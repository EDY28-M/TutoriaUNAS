import { beforeEach, describe, expect, it, vi } from 'vitest';
import { demoAccounts } from '../mocks/accounts';
import { definicionPorCodigo, definicionesFormato } from '../data/formatos';
import {
  erroresInstrumento,
  formatoInicial,
  puedeEnviarFormato,
  respuestasVisibles,
  precargarInstrumento,
} from '../utils/instrumentos';
import type { Instrumento } from '../types/domain';

const estudiante = demoAccounts[0]!;
const tutor = demoAccounts[1]!;
const registro = (): Instrumento => ({
  id: 'prueba-entrevista',
  formato: 'F04',
  semestreId: '2026-II',
  tutorId: tutor.id,
  estudianteId: estudiante.id,
  sesionId: null,
  estado: 'no-iniciado',
  avance: 0,
  version: 1,
  creado: '2026-10-16',
  actualizado: '2026-10-16',
  enviado: null,
  revisadoPor: null,
  observaciones: [],
  descargaDisponible: false,
  respuestas: {},
});
function respuestasCompletas(): Record<string, string> {
  return {
    ...precargarInstrumento(registro()),
    expectativas: 'Sí',
    motivacion: 'Alta',
    lugarEstudio: 'Biblioteca',
    cursosDificiles: JSON.stringify(['Ninguno']),
  };
}
beforeEach(() => {
  sessionStorage.clear();
  vi.resetModules();
});

describe('correspondencia con los dos PDF proporcionados', () => {
  it('asigna una sola entrevista según ciclo I, II–VII y VIII en adelante', () => {
    expect([1, 2, 7, 8, 12].map(formatoInicial)).toEqual(['F03', 'F04', 'F04', 'F05', 'F05']);
  });
  it('conserva las preguntas y escalas oficiales de los formatos 09, 10 y 11', () => {
    const campos = (codigo: 'F09' | 'F10' | 'F11') =>
      definicionPorCodigo(codigo)!.secciones.flatMap((s) => s.campos);
    expect(campos('F09').filter((c) => c.codigo.startsWith('actividad'))).toHaveLength(10);
    expect(campos('F10').filter((c) => /^p\d/.test(c.codigo))).toHaveLength(14);
    const grupal = campos('F11').filter((c) => /^p\d/.test(c.codigo));
    expect(grupal).toHaveLength(13);
    expect(grupal.every((c) => c.opciones?.join('|') === 'Sí|A veces|No')).toBe(true);
    for (const d of definicionesFormato) {
      const codigos = d.secciones.flatMap((s) => s.campos.map((c) => c.codigo));
      expect(new Set(codigos).size).toBe(codigos.length);
      expect(d.periodicidad.length).toBeGreaterThan(8);
      expect(d.destinatario.length).toBeGreaterThan(8);
    }
  });
  it('incorpora las fichas 12 al circuito de instrumentos', async () => {
    const { instrumentos } = await import('../data/instrumentos');
    expect(instrumentos.filter((item) => item.formato === 'F12').length).toBeGreaterThan(0);
  });
  it('reserva las evaluaciones y el informe para el cierre y permite entrevistas durante el semestre', () => {
    expect(puedeEnviarFormato('F10', 'durante')).toBe(false);
    expect(puedeEnviarFormato('F11', 'inicio')).toBe(false);
    expect(puedeEnviarFormato('F02', 'durante')).toBe(false);
    expect(puedeEnviarFormato('F09', 'cierre')).toBe(true);
    expect(puedeEnviarFormato('F04', 'durante')).toBe(true);
  });
  it('exige la explicación cuando corresponde y limpia preguntas de seguimiento ocultas', () => {
    const d = definicionPorCodigo('F04')!;
    expect(
      erroresInstrumento(d, { ...respuestasCompletas(), expectativas: 'No' }).motivoExpectativas,
    ).toBeTruthy();
    expect(
      respuestasVisibles(d, { ...respuestasCompletas(), motivoExpectativas: 'Valor anterior' }),
    ).not.toHaveProperty('motivoExpectativas');
    expect(
      erroresInstrumento(d, { ...respuestasCompletas(), cursosDificiles: '[]' }).cursosDificiles,
    ).toBeTruthy();
  });
  it('rechaza horarios invertidos y días de más de 24 horas', () => {
    const errores = erroresInstrumento(definicionPorCodigo('F06')!, {
      horaInicio: '17:00',
      horaFin: '16:00',
    });
    expect(errores.horaFin).toBeTruthy();
    expect(
      erroresInstrumento(definicionPorCodigo('F04')!, {
        ...respuestasCompletas(),
        administracionTiempo: JSON.stringify([{ actividad: 'Estudio', horas: '25' }]),
      }).administracionTiempo,
    ).toBeTruthy();
  });
});

describe('circuito frontend compartido por estudiante y docente', () => {
  it('conserva borrador, envío, observación, subsanación y revisión sobre el mismo registro', async () => {
    const servicio = await import('./instrumentWorkspace');
    const borrador = servicio.guardarInstrumento(registro(), {}, estudiante);
    expect(borrador.estado).toBe('borrador');
    expect(() => servicio.guardarInstrumento(borrador, {}, estudiante, true)).toThrow('preguntas');
    const enviado = servicio.guardarInstrumento(borrador, respuestasCompletas(), estudiante, true);
    expect(enviado.estado).toBe('enviado');
    expect(() => servicio.guardarInstrumento(enviado, respuestasCompletas(), estudiante)).toThrow(
      'ya fue enviado',
    );
    servicio.revisarInstrumento(enviado.id, tutor, 'observado', 'Precisa tu lugar de estudio.');
    expect(servicio.obtenerWorkspace().registros.find((r) => r.id === enviado.id)?.estado).toBe(
      'observado',
    );
    const reenviado = servicio.guardarInstrumento(
      enviado,
      { ...respuestasCompletas(), lugarEstudio: 'En casa' },
      estudiante,
      true,
    );
    expect(reenviado.observaciones[0]?.estado).toBe('subsanada');
    servicio.revisarInstrumento(reenviado.id, tutor, 'aprobado', '');
    expect(
      servicio.obtenerWorkspace().registros.find((r) => r.id === enviado.id)?.respuestas
        .lugarEstudio,
    ).toBe('En casa');
    expect(servicio.obtenerWorkspace().registros.filter((r) => r.id === enviado.id)).toHaveLength(
      1,
    );
    expect(
      JSON.parse(sessionStorage.getItem('tutoria-unas:instrument-workspace:v1')!).cambios[
        enviado.id
      ].estado,
    ).toBe('aprobado');
  });
  it('impide editar respuestas de otra persona o presentar el formato 01 como docente', async () => {
    const servicio = await import('./instrumentWorkspace');
    expect(() => servicio.guardarInstrumento(registro(), respuestasCompletas(), tutor)).toThrow(
      'otra persona',
    );
    expect(() =>
      servicio.guardarInstrumento({ ...registro(), formato: 'F01', estudianteId: null }, {}, tutor),
    ).toThrow('otra persona');
  });
  it('no permite que el tutor cambie las evaluaciones 10 y 11 del estudiante', async () => {
    const servicio = await import('./instrumentWorkspace');
    const r = { ...registro(), formato: 'F11' as const, id: 'evaluacion-prueba' };
    expect(() => servicio.guardarInstrumento(r, {}, tutor)).toThrow('otra persona');
  });
});
