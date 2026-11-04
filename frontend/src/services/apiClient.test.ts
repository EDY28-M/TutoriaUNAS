import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiJson, getApiSession, setApiSession } from './apiClient';

const user = {
  id: 'EST-FICTICIO',
  role: 'estudiante' as const,
  name: 'Cuenta ficticia',
  identifier: 'ficticio',
  email: 'ficticio@example.test',
};
describe('cliente HTTP de persistencia', () => {
  beforeEach(() => {
    setApiSession({ accessToken: 'token-ficticio', expiresAt: Date.now() + 60000, user });
  });
  afterEach(() => {
    setApiSession(null);
    vi.unstubAllGlobals();
  });
  it('envía el token y la versión, sin enviar cookies', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ version: 4 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(
      await apiJson('/api/formularios/ficticio', 'PUT', { version: 3, respuestas: {} }),
    ).toEqual({ version: 4 });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        credentials: 'omit',
        headers: expect.objectContaining({ Authorization: 'Bearer token-ficticio' }),
        body: JSON.stringify({ version: 3, respuestas: {} }),
      }),
    );
  });
  it.each([400, 403, 409, 503])('propaga HTTP %i sin convertirlo en éxito', async (status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            title: 'Operación rechazada',
            errors: { p01: ['Revisa la respuesta'] },
          }),
          { status },
        ),
      ),
    );
    await expect(apiJson('/api/formularios/ficticio', 'PUT', {})).rejects.toMatchObject({
      status,
      errors: { p01: ['Revisa la respuesta'] },
    });
  });
  it('la falta de conexión no guarda respuestas en localStorage', async () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(
      apiJson('/api/formularios/ficticio', 'PUT', { respuestas: { p01: 'Sí' } }),
    ).rejects.toMatchObject({ status: 503 });
    expect(storage).not.toHaveBeenCalled();
    storage.mockRestore();
  });
  it('un 401 caduca la sesión y avisa al portal', async () => {
    const expired = vi.fn();
    window.addEventListener('unas:api-session-expired', expired);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    await expect(apiJson('/api/tutoria/estado')).rejects.toMatchObject({ status: 401 });
    expect(getApiSession()).toBeNull();
    expect(expired).toHaveBeenCalledOnce();
    window.removeEventListener('unas:api-session-expired', expired);
  });
  it('una respuesta tardía de otra cuenta no modifica la sesión actual', async () => {
    let complete!: (response: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () =>
          new Promise<Response>((resolve) => {
            complete = resolve;
          }),
      ),
    );
    const pending = apiJson('/api/tutoria/estado');
    setApiSession({ accessToken: 'segunda-cuenta-ficticia', expiresAt: Date.now() + 60000, user });
    complete(new Response('{}', { status: 401 }));
    await expect(pending).rejects.toMatchObject({ status: 409 });
    expect(getApiSession()?.accessToken).toBe('segunda-cuenta-ficticia');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => {
          setApiSession({
            accessToken: 'tercera-cuenta-ficticia',
            expiresAt: Date.now() + 60000,
            user,
          });
          return {};
        },
      }),
    );
    await expect(apiJson('/api/tutoria/estado')).rejects.toMatchObject({ status: 409 });
    expect(getApiSession()?.accessToken).toBe('tercera-cuenta-ficticia');
  });
});
