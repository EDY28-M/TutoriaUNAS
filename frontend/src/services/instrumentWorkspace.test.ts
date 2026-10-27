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
import { asignaciones } from '../data/tutoria';
import { estudiantePorId, nombreCompleto } from '../data/personas';
import type { DemoUser } from '../types/auth';
import type { Instrumento } from '../types/domain';

const tutor = demoAccounts[1]!;
const asignacionIntermedia = asignaciones.find(
  (a) => a.tutorId === tutor.id && estudiantePorId(a.estudianteId)?.etapa === 'intermedio',
)!;
const estudiante = { ...demoAccounts[0]!, id: asignacionIntermedia.estudianteId };
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
  localStorage.clear();
  vi.resetModules();
});

describe('correspondencia con los dos PDF proporcionados', () => {
  it('asigna una sola entrevista según los ciclos 1–3, 4–7 y 8–10', () => {
    expect(Array.from({ length: 10 }, (_, i) => formatoInicial(i + 1))).toEqual([
      'F03',
      'F03',
      'F03',
      'F04',
      'F04',
      'F04',
      'F04',
      'F05',
      'F05',
      'F05',
    ]);
    for (const ciclo of [0, -1, 11, 12, 3.5, NaN])
      expect(() => formatoInicial(ciclo)).toThrow('entre 1 y 10');
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
  it('reserva las etapas para entrevistas e informes; F10 y F11 dependen de cada sesión', () => {
    expect(puedeEnviarFormato('F10', 'durante')).toBe(true);
    expect(puedeEnviarFormato('F11', 'inicio')).toBe(true);
    expect(puedeEnviarFormato('F02', 'durante')).toBe(false);
    expect(puedeEnviarFormato('F09', 'cierre')).toBe(true);
    expect(puedeEnviarFormato('F04', 'inicio')).toBe(true);
    expect(puedeEnviarFormato('F04', 'durante')).toBe(false);
    expect(puedeEnviarFormato('F04', 'cierre')).toBe(false);
    expect(puedeEnviarFormato('F06', 'durante')).toBe(true);
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
  it('un envío rechazado no modifica la fuente de datos reutilizados', async () => {
    const servicio = await import('./instrumentWorkspace');
    const expediente = await import('./expediente');
    servicio.cambiarMomento('inicio');
    expediente.recordarRespuestas(registro(), { colegio: 'Colegio original' });
    expect(() =>
      servicio.guardarInstrumento(registro(), { colegio: 'Cambio inválido' }, estudiante, true),
    ).toThrow('preguntas');
    expect(expediente.respuestasRecordadas(registro()).colegio).toBe('Colegio original');
  });

  it('conserva borrador, envío, observación, subsanación y revisión sobre el mismo registro', async () => {
    const servicio = await import('./instrumentWorkspace');
    servicio.cambiarMomento('inicio');
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
  it('no permite responder la entrevista de otra etapa', async () => {
    const servicio = await import('./instrumentWorkspace');
    servicio.cambiarMomento('inicio');
    const f03 = { ...registro(), formato: 'F03' as const, id: 'entrevista-otra-etapa' };
    expect(() => servicio.guardarInstrumento(f03, {}, estudiante)).toThrow(
      'corresponde a la entrevista',
    );
  });
  it('no permite que el tutor cambie las evaluaciones 10 y 11 del estudiante', async () => {
    const servicio = await import('./instrumentWorkspace');
    const r = { ...registro(), formato: 'F11' as const, id: 'evaluacion-prueba' };
    expect(() => servicio.guardarInstrumento(r, {}, tutor)).toThrow('otra persona');
  });
});

describe('automatización de la derivación', () => {
  it('prepara la ficha 12 con la identidad del estudiante y el motivo traducido', async () => {
    const servicio = await import('./instrumentWorkspace');
    const asignacion = asignaciones.find((item) => item.estado === 'activa')!;
    const estudiante = estudiantePorId(asignacion.estudianteId)!;
    const tutor: DemoUser = {
      id: asignacion.tutorId,
      role: 'tutor',
      name: 'Docente tutor de prueba',
      identifier: asignacion.tutorId,
      email: 'tutor@unas.edu.pe',
    };
    const f08: Instrumento = {
      ...registro(),
      id: 'prueba-f08',
      formato: 'F08',
      tutorId: asignacion.tutorId,
      estudianteId: asignacion.estudianteId,
    };
    servicio.guardarInstrumento(
      f08,
      {
        ...precargarInstrumento(f08),
        motivo: 'Situación personal',
        detalleMotivo: 'Requiere acompañamiento emocional.',
        resultado: 'Se deriva a:',
        areaDerivacion: 'Psicología',
      },
      tutor,
      true,
    );
    const derivacion = servicio
      .obtenerWorkspace()
      .registros.find((r) => r.id === `INST-F12-desde-${f08.id}`);
    expect(derivacion?.formato).toBe('F12');
    expect(derivacion?.respuestas.nombreEstudiante).toBe(nombreCompleto(estudiante));
    expect(derivacion?.respuestas.codigo).toBe(estudiante.codigo);
    expect(derivacion?.respuestas.ciclo).toBe(String(estudiante.ciclo));
    expect(derivacion?.respuestas.nombreTutor).toBeTruthy();
    expect(derivacion?.respuestas.motivo).toBe('Apoyo emocional');
    expect(derivacion?.respuestas.detalle).toBe('Requiere acompañamiento emocional.');
    expect(derivacion?.avance).toBeGreaterThan(0);
  });
});
