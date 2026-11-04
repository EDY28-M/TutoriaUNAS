import { z } from 'zod';
import type { Role } from '../types/auth';
import { apiJson } from './apiClient';

const activacionSchema = z.object({
  tokenActivacion: z.string().length(64),
  correo: z.email(),
  role: z.enum(['estudiante', 'tutor', 'coordinacion']),
  expira: z.number(),
});
const ACTIVACION_KEY = 'unas:activacion:v1';
export type ActivacionPendiente = z.infer<typeof activacionSchema>;
let activacionMemoria: ActivacionPendiente | null = null;
export class ActivacionRequerida extends Error {
  constructor() {
    super('Verifica tu cuenta para continuar.');
  }
}
export function guardarActivacion(
  data: { tokenActivacion: string; correo: string; expiraEn: number },
  role: Role,
) {
  activacionMemoria = {
    tokenActivacion: data.tokenActivacion,
    correo: data.correo,
    role,
    expira: Date.now() + data.expiraEn * 1000,
  };
  try {
    sessionStorage.setItem(ACTIVACION_KEY, JSON.stringify(activacionMemoria));
  } catch {
    /* La verificación continúa en memoria. */
  }
}
export function leerActivacion(): ActivacionPendiente | null {
  try {
    const data = activacionSchema.safeParse(
      JSON.parse(sessionStorage.getItem(ACTIVACION_KEY) ?? 'null'),
    );
    return data.success && data.data.expira > Date.now()
      ? data.data
      : activacionMemoria && activacionMemoria.expira > Date.now()
        ? activacionMemoria
        : null;
  } catch {
    return activacionMemoria && activacionMemoria.expira > Date.now() ? activacionMemoria : null;
  }
}
export function borrarActivacion() {
  activacionMemoria = null;
  try {
    sessionStorage.removeItem(ACTIVACION_KEY);
  } catch {
    /* Sin persistencia local. */
  }
}
export interface CodigoSolicitado {
  retoId: string;
  expiraEn: number;
  reenviarEn: number;
  mensaje: string;
}
export interface CuentaAdmin {
  id: string;
  personaId: string;
  rol: Role;
  identifier: string;
  nombre: string;
  activo: boolean;
  version: number;
  verificada: boolean | null;
  cambioObligatorio: boolean;
  pendienteVinculacion: boolean;
  propia: boolean;
  correo: string;
  correoEstado: string;
}
export interface CandidatoCuenta {
  id: string;
  nombre: string;
  nombres: string;
  apellidos: string;
  correo: string;
  escuelaId: string;
  ciclo: number | null;
}
export interface CuentaCreada {
  id: string;
  identifier: string;
  passwordTemporal: string;
  expiraEn: number;
  estadoCorreo: string;
}
export const solicitarCodigoCuenta = (body: {
  correo: string;
  proposito: string;
  rol: Role;
  tokenActivacion?: string;
}) => apiJson<CodigoSolicitado>('/api/auth/codigo', 'POST', body);
export const confirmarCodigoCuenta = (body: {
  retoId: string;
  codigo: string;
  tokenActivacion?: string;
}) => apiJson<{ ticket: string; expiraEn: number }>('/api/auth/codigo/confirmar', 'POST', body);
export const completarCuenta = (body: {
  retoId: string;
  ticket: string;
  password: string;
  confirmacion: string;
}) =>
  apiJson<{ identifier: string; role: Role; pendienteVinculacion: boolean }>(
    '/api/auth/cuenta/completar',
    'POST',
    body,
  );
