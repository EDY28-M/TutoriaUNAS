import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface OpcionFiltro {
  valor: string;
  etiqueta: string;
}

export interface DefinicionSelect<T> {
  id: string;
  etiqueta: string;
  opciones: OpcionFiltro[];
  valorDe(item: T): string;
}

/** Estado de filtrado controlado por la página. */
export function useFiltro<T>(
  items: T[],
  buscarEn: (item: T) => string,
  selects: DefinicionSelect<T>[] = [],
) {
  const [parametros, setParametros] = useSearchParams();
  const [textoBusqueda, setTextoBusqueda] = useState('');
  const busqueda = parametros.get('buscar') ?? textoBusqueda;
  function setBusqueda(texto: string) {
    setTextoBusqueda(texto);
    if (parametros.has('buscar')) {
      const siguientes = new URLSearchParams(parametros);
      siguientes.delete('buscar');
      setParametros(siguientes, { replace: true });
    }
  }
  const [valores, setValores] = useState<Record<string, string>>({});

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return items.filter((item) => {
      if (termino && !buscarEn(item).toLowerCase().includes(termino)) return false;
      return selects.every((select) => {
        const elegido = valores[select.id] ?? '';
        return !elegido || select.valorDe(item) === elegido;
      });
    });
  }, [busqueda, buscarEn, items, selects, valores]);

  const activos = busqueda !== '' || Object.values(valores).some(Boolean);
  function limpiar() {
    setBusqueda('');
    setValores({});
  }
  return { busqueda, setBusqueda, valores, setValores, filtrados, activos, limpiar };
}
