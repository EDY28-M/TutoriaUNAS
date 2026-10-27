import { beforeEach, describe, expect, it } from 'vitest';
import { sesiones } from '../data/tutoria';
import {
  aplicarRegistro,
  ATTENDANCE_KEY,
  cantidadAsistentes,
  guardarAsistencia,
  leerRegistros,
} from './sessionAttendance';

const sesion = sesiones.find(
  (s) => s.tutorId === 'DOC-0421' && s.estado === 'realizada' && s.tipo === 'grupal',
)!;
const actor = { id: 'DOC-0421', role: 'tutor' as const };

describe('registro de asistencia por sesión', () => {
  beforeEach(() => localStorage.clear());
  it('guarda los cambios y un acuerdo que reaparece al leer la misma sesión', () => {
    const asistentes = sesion.asistentes.map((a, i) => ({
      ...a,
      estado: i === 0 ? ('tarde' as const) : ('falto' as const),
    }));
    guardarAsistencia(actor, sesion, asistentes, '  Compartir el plan de estudio.  ');
    const leida = aplicarRegistro(sesion, leerRegistros(localStorage.getItem(ATTENDANCE_KEY)));
    expect(leida.asistentes).toEqual(asistentes);
    expect(cantidadAsistentes(leida)).toBe(1);
    expect(leida.acuerdos).toHaveLength(sesion.acuerdos.length + 1);
    expect(leida.acuerdos.at(-1)?.descripcion).toBe('Compartir el plan de estudio.');
    guardarAsistencia(actor, sesion, asistentes, '');
    expect(
      aplicarRegistro(sesion, leerRegistros(localStorage.getItem(ATTENDANCE_KEY))).acuerdos,
    ).toEqual(leida.acuerdos);
  });
  it('rechaza otro docente, otros roles y sesiones que no han finalizado', () => {
    expect(() =>
      guardarAsistencia({ ...actor, id: 'DOC-0422' }, sesion, sesion.asistentes, ''),
    ).toThrow();
    expect(() =>
      guardarAsistencia({ ...actor, role: 'estudiante' }, sesion, sesion.asistentes, ''),
    ).toThrow();
    expect(() =>
      guardarAsistencia({ ...actor, role: 'coordinacion' }, sesion, sesion.asistentes, ''),
    ).toThrow();
    expect(() =>
      guardarAsistencia(
        actor,
        { ...sesion, estado: 'programada', fecha: '2099-01-01' },
        sesion.asistentes,
        '',
      ),
    ).toThrow();
    expect(localStorage.getItem(ATTENDANCE_KEY)).toBeNull();
  });
  it('rechaza estudiantes ajenos, duplicados, listas incompletas y horas inválidas', () => {
    expect(() => guardarAsistencia(actor, sesion, sesion.asistentes.slice(1), '')).toThrow();
    expect(() =>
      guardarAsistencia(
        actor,
        sesion,
        sesion.asistentes.map((a) => ({ ...a, estudianteId: 'ajeno' })),
        '',
      ),
    ).toThrow();
    expect(() =>
      guardarAsistencia(
        actor,
        sesion,
        sesion.asistentes.map((a) => ({ ...a, estudianteId: sesion.asistentes[0]!.estudianteId })),
        '',
      ),
    ).toThrow();
    expect(() =>
      guardarAsistencia(
        actor,
        sesion,
        sesion.asistentes.map((a) => ({ ...a, horaRegistro: '25:00' })),
        '',
      ),
    ).toThrow();
    expect(localStorage.getItem(ATTENDANCE_KEY)).toBeNull();
  });
  it('mantiene el dato base ante almacenamiento ilegible o registros de otro tutor', () => {
    expect(aplicarRegistro(sesion, leerRegistros('incompleto'))).toBe(sesion);
    expect(
      aplicarRegistro(sesion, { [sesion.id]: { tutorId: 'otro', asistentes: [], acuerdos: [] } }),
    ).toBe(sesion);
    expect(
      aplicarRegistro(sesion, {
        [sesion.id]: { tutorId: sesion.tutorId, asistentes: [], acuerdos: [] },
      }),
    ).toBe(sesion);
  });
});
