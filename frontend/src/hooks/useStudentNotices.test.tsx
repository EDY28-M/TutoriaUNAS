import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { AuthContext } from '../contexts/authContext';
import { demoAccounts } from '../mocks/accounts';
import { useStudentNotices } from './useStudentNotices';
import { usePortal } from './usePortal';
import { claveAvisosEstudiante, leerEstadoAvisos } from '../services/studentNoticesWorkspace';

const estudiante = demoAccounts[0]!;
function envolver(user = estudiante) {
  return function Envoltorio({ children }: { children: ReactNode }) {
    return (
      <AuthContext.Provider value={{ user, login: async () => user, logout: () => undefined }}>
        {children}
      </AuthContext.Provider>
    );
  };
}
beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('bandeja de avisos del estudiante', () => {
  it('solo incorpora correos enviados al estudiante y no usa avisos ajenos como reemplazo', () => {
    const { result } = renderHook(useStudentNotices, { wrapper: envolver() });
    expect(result.current.mensajes).toHaveLength(6);
    expect(result.current.mensajes.filter((item) => item.aviso).map((item) => item.id)).toEqual([
      'AV-001',
    ]);
    const sinCorreo = { ...estudiante, id: 'EST-2023010458' };
    const otra = renderHook(useStudentNotices, { wrapper: envolver(sinCorreo) });
    expect(otra.result.current.mensajes.filter((item) => item.aviso)).toHaveLength(0);
    const desconocida = renderHook(useStudentNotices, {
      wrapper: envolver({ ...estudiante, id: 'EST-inexistente' }),
    });
    expect(desconocida.result.current.mensajes).toHaveLength(0);
    const tutor = renderHook(useStudentNotices, { wrapper: envolver(demoAccounts[1]!) });
    expect(tutor.result.current.mensajes).toHaveLength(0);
  });

  it('sincroniza lectura y contadores del portal y conserva el cambio al montar de nuevo', () => {
    const { result, unmount } = renderHook(
      () => ({ bandeja: useStudentNotices(), portal: usePortal() }),
      { wrapper: envolver() },
    );
    expect(result.current.bandeja.sinLeer).toBe(3);
    act(() => result.current.bandeja.marcarLeidas(['NT-001']));
    expect(result.current.bandeja.sinLeer).toBe(2);
    expect(result.current.portal.contadores.avisos).toBe(2);
    expect(result.current.portal.notificaciones.find((item) => item.id === 'NT-001')?.leida).toBe(
      true,
    );
    unmount();
    const nueva = renderHook(useStudentNotices, { wrapper: envolver() });
    expect(nueva.result.current.sinLeer).toBe(2);
    act(() => nueva.result.current.marcarLeidas(['NT-001'], false));
    expect(nueva.result.current.sinLeer).toBe(3);
  });

  it('guarda preferencias sin ocultar avisos ya recibidos y mantiene el estado por cuenta', () => {
    const { result } = renderHook(useStudentNotices, { wrapper: envolver() });
    act(() => result.current.cambiarPreferencia('sesiones', false));
    act(() => result.current.cambiarPreferencia('bienestar', true));
    expect(result.current.preferencias.sesiones).toBe(false);
    expect(result.current.preferencias.bienestar).toBe(true);
    expect(result.current.mensajes).toHaveLength(6);
    const otra = renderHook(useStudentNotices, {
      wrapper: envolver({ ...estudiante, id: 'EST-2023010457' }),
    });
    expect(otra.result.current.preferencias.sesiones).toBe(true);
    expect(otra.result.current.preferencias.bienestar).toBe(false);
  });

  it('recupera valores válidos ante almacenamiento corrupto y no informa éxito si falla el guardado', () => {
    localStorage.setItem(claveAvisosEstudiante(estudiante.id), '{invalido');
    expect(leerEstadoAvisos('{"preferencias":{"sesiones":"sí"}}').preferencias.sesiones).toBe(true);
    const { result } = renderHook(useStudentNotices, { wrapper: envolver() });
    expect(result.current.sinLeer).toBe(3);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Cuota excedida');
    });
    expect(() => act(() => result.current.marcarLeidas(['NT-001']))).toThrow('No se pudo guardar');
    expect(result.current.sinLeer).toBe(3);
    expect(result.current.preferencias.sesiones).toBe(true);
  });
});
