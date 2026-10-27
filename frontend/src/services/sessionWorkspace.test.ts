import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { demoAccounts } from '../mocks/accounts';
import { asignaciones } from '../data/tutoria';
import { definicionPorCodigo } from '../data/formatos';
import {
  consultarSesiones,
  leerProgramadas,
  programarSesion,
  SESSIONS_KEY,
} from './sessionWorkspace';
import { guardarAsistencia } from './sessionAttendance';
import {
  bloqueoEvaluacion,
  evaluacionesDeSesiones,
  idEvaluacionSesion,
} from '../utils/evaluacionesSesion';
import { precargarInstrumentoConOrigen } from '../utils/instrumentos';

const tutor = demoAccounts.find((a) => a.role === 'tutor')!;
const estudiante = demoAccounts.find((a) => a.role === 'estudiante')!;
const ids = asignaciones
  .filter((a) => a.tutorId === tutor.id && a.estado === 'activa')
  .map((a) => a.estudianteId);
const entrada = {
  tipo: 'individual' as const,
  fecha: '2026-11-01',
  horaInicio: '18:00',
  horaFin: '19:00',
  modalidad: 'presencial' as const,
  lugar: 'Aula de demostración',
  tema: 'Organización del estudio',
  objetivo: 'Acordar un plan de estudio',
  estudiantes: [estudiante.id],
};
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-27T12:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('programación y evaluaciones por sesión', () => {
  it('comparte las sesiones individuales y grupales y evita convocatorias y horarios inválidos', () => {
    const individual = programarSesion(tutor, entrada, []);
    const grupal = programarSesion(
      tutor,
      {
        ...entrada,
        tipo: 'grupal',
        horaInicio: '19:00',
        horaFin: '20:00',
        estudiantes: ids.slice(0, 2),
      },
      [],
    );
    expect(consultarSesiones([]).find((s) => s.id === individual.id)?.estado).toBe('programada');
    expect(leerProgramadas(localStorage.getItem(SESSIONS_KEY)).map((s) => s.id)).toEqual([
      individual.id,
      grupal.id,
    ]);
    expect(() => programarSesion(tutor, entrada, [])).toThrow('otra sesión');
    expect(() => programarSesion(estudiante, entrada, [])).toThrow('docente tutor');
    expect(() => programarSesion(tutor, { ...entrada, estudiantes: ['ajeno'] }, [])).toThrow(
      'asignaciones activas',
    );
    expect(() => programarSesion(tutor, { ...entrada, horaFin: '17:00' }, [])).toThrow('posterior');
    expect(() => programarSesion(tutor, { ...entrada, fecha: '2026-10-01' }, [])).toThrow(
      'futuras',
    );
    expect(() => programarSesion(tutor, { ...entrada, tipo: 'grupal' }, [])).toThrow(
      'al menos dos',
    );
    expect(leerProgramadas('corrupto')).toEqual([]);
  });
  it('bloquea borradores y envíos antes del cierre de la sesión, con falta y sin convocatoria', async () => {
    const { guardarInstrumento } = await import('./instrumentWorkspace');
    const sesion = programarSesion(tutor, entrada, []);
    const evaluacion = evaluacionesDeSesiones([sesion], [])[0]!;
    expect(() => guardarInstrumento(evaluacion, {}, estudiante)).toThrow('finaliza la sesión');
    expect(() => guardarAsistencia(tutor, sesion, sesion.asistentes, '')).toThrow('finalizado');
    vi.setSystemTime(new Date('2026-11-02T12:00:00Z'));
    guardarAsistencia(
      tutor,
      sesion,
      sesion.asistentes.map((a) => ({ ...a, estado: 'falto' })),
      '',
    );
    const cerrada = consultarSesiones([]).find((s) => s.id === sesion.id)!;
    expect(cerrada.estado).toBe('realizada');
    expect(bloqueoEvaluacion(cerrada, 'ajeno')).toContain('No estás convocado');
    expect(() => guardarInstrumento(evaluacion, {}, estudiante)).toThrow('debes haber asistido');
    expect(() => guardarInstrumento(evaluacion, {}, estudiante, true)).toThrow(
      'debes haber asistido',
    );
  });
  it('habilita cualquier sesión asistida sin fase ni ciclo, conserva la evaluación y no copia sus calificaciones', async () => {
    const { guardarInstrumento, obtenerWorkspace } = await import('./instrumentWorkspace');
    const s1 = programarSesion(tutor, entrada, []);
    const s2 = programarSesion(tutor, { ...entrada, horaInicio: '19:00', horaFin: '20:00' }, []);
    vi.setSystemTime(new Date('2026-11-02T12:00:00Z'));
    for (const s of [s1, s2])
      guardarAsistencia(
        tutor,
        s,
        s.asistentes.map((a) => ({ ...a, estado: 'asistio', horaRegistro: s.horaInicio })),
        '',
      );
    const lista = consultarSesiones([]);
    const e1 = evaluacionesDeSesiones(
      lista.filter((s) => s.id === s1.id),
      [],
    )[0]!;
    expect(
      bloqueoEvaluacion(
        lista.find((s) => s.id === s1.id),
        estudiante.id,
      ),
    ).toBeNull();
    const respuestas = Object.fromEntries(
      definicionPorCodigo('F10')!
        .secciones.flatMap((s) => s.campos)
        .map((c) => [c.codigo, c.opciones?.at(-1) ?? 'Respuesta de demostración']),
    );
    const enviado = guardarInstrumento(
      e1,
      { ...respuestas, fecha: '1999-01-01' },
      estudiante,
      true,
    );
    expect(enviado.estado).toBe('enviado');
    expect(enviado.respuestas.fecha).toBe(s1.fecha);
    expect(() => guardarInstrumento(enviado, {}, estudiante)).toThrow('ya fue enviado');
    const e2 = evaluacionesDeSesiones(
      lista.filter((s) => s.id === s2.id),
      obtenerWorkspace().registros,
    )[0]!;
    expect(e2.id).not.toBe(enviado.id);
    expect(precargarInstrumentoConOrigen(e2, lista, obtenerWorkspace().registros).valores.p01).toBe(
      '',
    );
    expect(() => guardarInstrumento({ ...e2, id: 'otra-evaluacion' }, {}, estudiante)).toThrow(
      'debe corresponder',
    );
    expect(
      obtenerWorkspace().registros.filter((r) => r.id === idEvaluacionSesion(s1, estudiante.id)),
    ).toHaveLength(1);
    expect(
      evaluacionesDeSesiones(
        lista.filter((s) => s.id === s1.id),
        obtenerWorkspace().registros,
      )[0]?.estado,
    ).toBe('enviado');
  });
});
