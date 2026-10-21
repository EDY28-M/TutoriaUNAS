export interface IntervaloCalendario<T> {
  evento: T;
  rango: { inicio: number; fin: number };
}

/** Cada grupo contiene intervalos conectados; las columnas se reinician entre grupos. */
export function distribuirCalendario<T>(items: IntervaloCalendario<T>[]) {
  const ordenados = [...items].sort(
    (a, b) => a.rango.inicio - b.rango.inicio || b.rango.fin - a.rango.fin,
  );
  const grupos: Array<{
    inicio: number;
    fin: number;
    columnas: number;
    items: Array<IntervaloCalendario<T> & { columna: number }>;
  }> = [];
  let finales: number[] = [];
  for (const item of ordenados) {
    let grupo = grupos.at(-1);
    if (!grupo || item.rango.inicio >= grupo.fin) {
      grupo = { inicio: item.rango.inicio, fin: item.rango.fin, columnas: 0, items: [] };
      grupos.push(grupo);
      finales = [];
    }
    let columna = finales.findIndex((fin) => fin <= item.rango.inicio);
    if (columna === -1) columna = finales.length;
    finales[columna] = item.rango.fin;
    grupo.fin = Math.max(grupo.fin, item.rango.fin);
    grupo.columnas = finales.length;
    grupo.items.push({ ...item, columna });
  }
  return grupos;
}
