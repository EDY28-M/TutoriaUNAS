import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCuentaSetup } from './useCuentaSetup';
const mocks = vi.hoisted(() => ({
  solicitar: vi.fn(),
  confirmar: vi.fn(),
  completar: vi.fn(),
  activacion: vi.fn(),
  borrar: vi.fn(),
  login: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock('./useAuth', () => ({ useAuth: () => ({ login: mocks.login }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('../services/cuentas', () => ({
  solicitarCodigoCuenta: mocks.solicitar,
  confirmarCodigoCuenta: mocks.confirmar,
  completarCuenta: mocks.completar,
  leerActivacion: mocks.activacion,
  borrarActivacion: mocks.borrar,
}));
const password = 'Una frase segura para las pruebas';
beforeEach(() => {
  vi.resetAllMocks();
  mocks.activacion.mockReturnValue(null);
  mocks.solicitar.mockResolvedValue({
    retoId: 'reto-ficticio',
    expiraEn: 600,
    reenviarEn: 60,
    mensaje: 'Si corresponde al padrón recibirás un código.',
  });
  mocks.confirmar.mockResolvedValue({ ticket: 'ticket-ficticio', expiraEn: 300 });
  mocks.completar.mockResolvedValue({
    identifier: 'prueba@unas.edu.pe',
    role: 'estudiante',
    pendienteVinculacion: false,
  });
  mocks.login.mockResolvedValue({ role: 'estudiante' });
});
describe('alta y verificación de cuentas', () => {
  it('verifica el correo antes de crear la contraseña y entra sin pedir otro código', async () => {
    const { result } = renderHook(() => useCuentaSetup('registro'));
    act(() => result.current.setCorreo('prueba@unas.edu.pe'));
    await act(() => result.current.solicitar());
    expect(result.current.fase).toBe('codigo');
    expect(mocks.login).not.toHaveBeenCalled();
    act(() => result.current.setCodigo('123456'));
    await act(() => result.current.confirmar());
    expect(result.current.fase).toBe('password');
    expect(mocks.completar).not.toHaveBeenCalled();
    act(() => {
      result.current.setPassword(password);
      result.current.setConfirmacion(password);
    });
    await act(() => result.current.completar());
    expect(mocks.login).toHaveBeenCalledWith(
      { identifier: 'prueba@unas.edu.pe', role: 'estudiante', password },
      true,
    );
    expect(mocks.navigate).toHaveBeenCalledWith('/estudiante/dashboard', { replace: true });
    expect(result.current.password).toBe('');
  });
  it('no da acceso con la contraseña temporal: mantiene su prueba solo para verificar', async () => {
    mocks.activacion.mockReturnValue({
      tokenActivacion: 'A'.repeat(64),
      correo: 'prueba@unas.edu.pe',
      role: 'tutor',
      expira: Date.now() + 900000,
    });
    const { result } = renderHook(() => useCuentaSetup('activacion'));
    await act(() => result.current.solicitar());
    expect(mocks.solicitar).toHaveBeenCalledWith({
      correo: 'prueba@unas.edu.pe',
      proposito: 'activacion',
      rol: 'tutor',
      tokenActivacion: 'A'.repeat(64),
    });
    expect(mocks.login).not.toHaveBeenCalled();
    act(() => result.current.setCodigo('123456'));
    await act(() => result.current.confirmar());
    expect(mocks.confirmar).toHaveBeenCalledWith({
      retoId: 'reto-ficticio',
      codigo: '123456',
      tokenActivacion: 'A'.repeat(64),
    });
  });
  it('conserva el paso y permite corregir un código rechazado', async () => {
    const { result } = renderHook(() => useCuentaSetup('registro'));
    act(() => result.current.setCorreo('prueba@unas.edu.pe'));
    await act(() => result.current.solicitar());
    mocks.confirmar.mockRejectedValue(new Error('El código venció.'));
    act(() => result.current.setCodigo('123456'));
    await act(() => result.current.confirmar());
    expect(result.current.fase).toBe('codigo');
    expect(result.current.error).toBe('El código venció.');
    expect(mocks.login).not.toHaveBeenCalled();
  });
  it('no pierde una cuenta completada si falla la apertura posterior del portal', async () => {
    const { result } = renderHook(() => useCuentaSetup('registro'));
    act(() => result.current.setCorreo('prueba@unas.edu.pe'));
    await act(() => result.current.solicitar());
    act(() => result.current.setCodigo('123456'));
    await act(() => result.current.confirmar());
    act(() => {
      result.current.setPassword(password);
      result.current.setConfirmacion(password);
    });
    mocks.login.mockRejectedValue(new Error('Sin conexión'));
    await act(() => result.current.completar());
    expect(result.current.fase).toBe('terminado');
    expect(result.current.error).toContain('La contraseña quedó guardada');
    expect(result.current.password).toBe('');
  });
});
