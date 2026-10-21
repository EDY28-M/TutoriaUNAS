import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AuthContext } from '../contexts/authContext';
import { usePortal } from './usePortal';
import { demoAccounts } from '../mocks/accounts';
import type { LoginCredentials } from '../types/auth';
import { sesiones, instrumentos, derivaciones } from '../data';

const cuentaEstudiante = demoAccounts.find((cuenta) => cuenta.role === 'estudiante')!;
const cuentaTutor = demoAccounts.find((cuenta) => cuenta.role === 'tutor')!;
const cuentaCoordinacion = demoAccounts.find((cuenta) => cuenta.role === 'coordinacion')!;

function envolver(usuario: typeof cuentaEstudiante | null) {
  return function Envoltorio({ children }: { children: ReactNode }) {
    return (
      <AuthContext.Provider
        value={{
          user: usuario,
          login: async (_credenciales: LoginCredentials) => cuentaEstudiante,
          logout: () => undefined,
        }}
      >
        {children}
      </AuthContext.Provider>
    );
  };
}

describe('alcance de datos por rol', () => {
  it('resuelve el expediente del tutorado y sus contadores', () => {
    const { result } = renderHook(() => usePortal(), { wrapper: envolver(cuentaEstudiante) });
    expect(result.current.estudiante?.codigo).toBe('2023010456');
    expect(result.current.tutor).not.toBeNull();
    expect(result.current.sesiones.length).toBeGreaterThan(0);
    expect(result.current.instrumentos.length).toBeGreaterThan(0);
    expect(result.current.contadores.pendientes).toBeGreaterThanOrEqual(0);
    expect(result.current.escuelaId).toBe('E-IIS');
    expect(result.current.avisosSinLeer).toBeGreaterThan(0);
  });

  it('limita el alcance del docente tutor a sus tutorados', () => {
    const { result } = renderHook(() => usePortal(), { wrapper: envolver(cuentaTutor) });
    expect(result.current.docente?.id).toBe('DOC-0421');
    expect(result.current.tutorados.length).toBeGreaterThan(0);
    expect(result.current.tutorados.every((asignacion) => asignacion.tutorId === 'DOC-0421')).toBe(
      true,
    );
    expect(result.current.sesiones.every((sesion) => sesion.tutorId === 'DOC-0421')).toBe(true);
  });

  it('agrega el ámbito completo para la coordinación de tutoría', () => {
    const { result } = renderHook(() => usePortal(), { wrapper: envolver(cuentaCoordinacion) });
    expect(result.current.tutorados.length).toBeGreaterThan(10);
    expect(result.current.derivaciones.length).toBeGreaterThan(0);
    expect(result.current.sesiones).toHaveLength(sesiones.length);
    expect(new Set(result.current.sesiones.map((sesion) => sesion.id)).size).toBe(sesiones.length);
    expect(result.current.instrumentos).toHaveLength(instrumentos.length);
    expect(result.current.instrumentos.filter((item) => item.formato === 'F12')).toHaveLength(
      derivaciones.length,
    );
    expect(
      result.current.instrumentos.some((instrumento) => instrumento.estudianteId === null),
    ).toBe(true);
  });

  it('no rompe cuando no hay sesión activa', () => {
    const { result } = renderHook(() => usePortal(), { wrapper: envolver(null) });
    expect(result.current.estudiante).not.toBeNull();
    expect(result.current.contadores.sesiones).toBeGreaterThanOrEqual(0);
  });

  it('cuenta los instrumentos observados para la bandeja de revisión', () => {
    const { result } = renderHook(() => usePortal(), { wrapper: envolver(cuentaTutor) });
    expect(result.current.contadores.observados).toBeGreaterThanOrEqual(0);
    expect(
      result.current.instrumentos.filter((instrumento) => instrumento.estado === 'observado')
        .length,
    ).toBe(result.current.contadores.observados);
  });

  it('mantiene el alcance vacío cuando el docente no está en el padrón', () => {
    const desconocido = { ...cuentaTutor, id: 'DOC-9999' };
    const { result } = renderHook(() => usePortal(), { wrapper: envolver(desconocido) });
    expect(result.current.docente).toBeNull();
    expect(result.current.tutorados).toHaveLength(0);
    expect(result.current.sesiones).toHaveLength(0);
    expect(result.current.contadores.pendientes).toBe(0);
    expect(result.current.escuelaId).toBe('E-IIS');
  });

  it('cae en el primer estudiante del padrón si el identificador no existe', () => {
    const desconocido = { ...cuentaEstudiante, id: 'EST-0000000000' };
    const { result } = renderHook(() => usePortal(), { wrapper: envolver(desconocido) });
    expect(result.current.estudiante).not.toBeNull();
    expect(result.current.escuelaId).toBe(result.current.estudiante?.escuelaId);
  });
});
