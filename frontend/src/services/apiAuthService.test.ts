import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiAuthService } from './apiAuthService';
import { getApiSession, setApiSession } from './apiClient';
import { ActivacionRequerida, borrarActivacion, leerActivacion } from './cuentas';
const api = vi.hoisted(() => ({ aplicar: vi.fn(), refrescar: vi.fn(), vaciar: vi.fn() }));
vi.mock('./apiTutoria', () => ({
  aplicarEstadoApi: api.aplicar,
  refrescarApi: api.refrescar,
  vaciarApi: api.vaciar,
}));
const credentials = {
  identifier: 'prueba@unas.edu.pe',
  password: 'Temporal de prueba solamente',
};
function respuesta(body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 })),
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  setApiSession(null);
  borrarActivacion();
});
afterEach(() => {
  setApiSession(null);
  borrarActivacion();
  vi.unstubAllGlobals();
});
describe('acceso institucional del cliente', () => {
  it('aplica el estado inicial sin pedirlo una segunda vez', async () => {
    const usuario = {
      id: 'DOC-FICTICIO',
      role: 'tutor',
      identifier: credentials.identifier,
      name: 'Docente de prueba',
      email: credentials.identifier,
    };
    const estado = { usuario };
    respuesta({ accessToken: 'token-de-prueba', expiresIn: 3600, estado });
    await expect(apiAuthService.login(credentials, true)).resolves.toEqual(usuario);
    expect(api.aplicar).toHaveBeenCalledWith(estado);
    expect(api.refrescar).not.toHaveBeenCalled();
    expect(getApiSession()?.user).toEqual(usuario);
  });
  it('una contraseña temporal nunca se convierte en una sesión del portal', async () => {
    respuesta({
      activacionRequerida: true,
      tokenActivacion: 'A'.repeat(64),
      correo: credentials.identifier,
      expiraEn: 900,
      role: 'tutor',
    });
    await expect(apiAuthService.login(credentials, true)).rejects.toBeInstanceOf(
      ActivacionRequerida,
    );
    expect(getApiSession()).toBeNull();
    expect(api.refrescar).not.toHaveBeenCalled();
    expect(leerActivacion()).toMatchObject({ correo: credentials.identifier, role: 'tutor' });
    expect(sessionStorage.getItem('unas:activacion:v1')).not.toContain(credentials.password);
  });
  it('no permite entrar a un docente pendiente de vinculación académica', async () => {
    respuesta({ pendienteVinculacion: true });
    await expect(apiAuthService.login(credentials, true)).rejects.toThrow(/vincular tu escuela/);
    expect(getApiSession()).toBeNull();
    expect(api.refrescar).not.toHaveBeenCalled();
  });
  it('rechaza respuestas incompletas antes de crear la sesión', async () => {
    respuesta({ accessToken: 'incompleto' });
    await expect(apiAuthService.login(credentials, true)).rejects.toThrow();
    expect(getApiSession()).toBeNull();
    expect(api.refrescar).not.toHaveBeenCalled();
  });
});
