// Reserved for real API integration. Authorization must be enforced by the server.
export async function getApiJson(path: string, signal?: AbortSignal): Promise<unknown> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5080';
  const response = await fetch(new URL(path, baseUrl), {
    credentials: 'omit',
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('No se pudo completar la consulta al servidor.');
  return response.json();
}
