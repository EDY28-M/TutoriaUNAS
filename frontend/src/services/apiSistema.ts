import { apiJson, getApiSession } from './apiClient';
import { confirmarSistema, refrescarApi } from './apiTutoria';
import type { ContactoPerfil, PreferenciasUsuario } from '../types/sistema';

export async function mutarSistema<T = void>(
  path: string,
  method: 'POST' | 'PUT' | 'DELETE',
  body?: unknown,
  confirmado?: (resultado: T) => void,
) {
  const token = getApiSession()?.accessToken;
  const result = await apiJson<T>(`/api/sistema/${path}`, method, body);
  if (getApiSession()?.accessToken !== token) return result;
  confirmado?.(result);
  await refrescarApi().catch(() => undefined);
  return result;
}
export const guardarContactoApi = (contacto: ContactoPerfil) =>
  mutarSistema<ContactoPerfil>('perfil', 'PUT', contacto, (guardado) =>
    confirmarSistema((s) =>
      s.contacto.version > guardado.version ? s : { ...s, contacto: guardado },
    ),
  );
export const guardarPreferenciasApi = (p: PreferenciasUsuario) =>
  mutarSistema('preferencias', 'PUT', p, () =>
    confirmarSistema((s) =>
      s.preferencias.version > p.version + 1
        ? s
        : { ...s, preferencias: { ...p, version: p.version + 1 } },
    ),
  );
export const marcarAvisosApi = (ids: string[], leida = true) =>
  mutarSistema('notificaciones/lectura', 'PUT', { ids, leida }, () =>
    confirmarSistema((s) => ({
      ...s,
      notificaciones: s.notificaciones.map((n) => (ids.includes(n.id) ? { ...n, leida } : n)),
    })),
  );
