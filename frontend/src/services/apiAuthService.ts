import type { AuthService } from '../types/auth';
import { apiJson, getApiSession, setApiSession } from './apiClient';
import { aplicarEstadoApi, refrescarApi, vaciarApi } from './apiTutoria';
import type { EstadoApi } from './apiTutoria';
import { ActivacionRequerida, borrarActivacion, guardarActivacion } from './cuentas';
import { z } from 'zod';

const respuestaLogin = z.union([
  z.object({
    accessToken: z.string().min(1),
    expiresIn: z.number().positive(),
    estado: z.custom<EstadoApi>().optional(),
  }),
  z.object({
    activacionRequerida: z.literal(true),
    tokenActivacion: z.string().length(64),
    correo: z.email(),
    expiraEn: z.number().positive(),
    role: z.enum(['estudiante', 'tutor', 'coordinacion']),
  }),
  z.object({ pendienteVinculacion: z.literal(true) }),
]);

export const apiAuthService: AuthService = {
  async login(credentials, remember) {
    setApiSession(null);
    vaciarApi();
    const result = respuestaLogin.parse(
      await apiJson<unknown>('/api/auth/login', 'POST', {
        identifier: credentials.identifier.trim(),
        password: credentials.password,
        role: credentials.role,
        incluirEstado: true,
      }),
    );
    if ('activacionRequerida' in result) {
      guardarActivacion(
        {
          tokenActivacion: result.tokenActivacion,
          correo: result.correo,
          expiraEn: result.expiraEn ?? 900,
        },
        result.role,
      );
      throw new ActivacionRequerida();
    }
    if ('pendienteVinculacion' in result)
      throw new Error(
        'Tu cuenta está verificada. Coordinación debe vincular tu escuela para habilitar el portal docente.',
      );
    borrarActivacion();
    setApiSession(
      {
        accessToken: result.accessToken,
        expiresAt: Date.now() + result.expiresIn * 1000,
        user: null,
      },
      false,
    );
    try {
      const data = result.estado ?? (await refrescarApi());
      if (!data) throw new Error('No se pudo validar la cuenta con el servidor.');
      if (result.estado) aplicarEstadoApi(data);
      setApiSession(
        {
          accessToken: result.accessToken,
          expiresAt: Date.now() + result.expiresIn * 1000,
          user: data.usuario,
        },
        remember,
      );
      return data.usuario;
    } catch (e) {
      setApiSession(null);
      vaciarApi();
      throw e;
    }
  },
  restore: () => {
    const user = getApiSession()?.user ?? null;
    vaciarApi();
    return user;
  },
  logout() {
    borrarActivacion();
    setApiSession(null);
    vaciarApi();
  },
};
