import { useId, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, X } from '../ui/icons';

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

interface PanelFiltrosProps<T> {
  busqueda: string;
  onBusqueda(valor: string): void;
  selects: DefinicionSelect<T>[];
  valores: Record<string, string>;
  onValor(id: string, valor: string): void;
  mostrados: number;
  total: number;
  activos: boolean;
  onLimpiar(): void;
  etiqueta: string;
  placeholder?: string;
}

/**
 * Barra de filtros controlada: búsqueda libre y selects por campo.
 * El estado vive en la página mediante `useFiltro`.
 */
export function PanelFiltros<T>({
  busqueda,
  onBusqueda,
  selects,
  valores,
  onValor,
  mostrados,
  total,
  activos,
  onLimpiar,
  etiqueta,
  placeholder = 'Buscar por nombre o código…',
}: PanelFiltrosProps<T>) {
  const idBusqueda = useId();
  return (
    <div className="toolbar" role="search" aria-label={etiqueta}>
      <div className="field filter-search">
        <label htmlFor={idBusqueda}>Buscar</label>
        <span className="search-field">
          <Search aria-hidden="true" />
          <input
            id={idBusqueda}
            type="search"
            value={busqueda}
            onChange={(evento) => onBusqueda(evento.target.value)}
            placeholder={placeholder}
          />
        </span>
      </div>

      {selects.map((select) => {
        const id = `${etiqueta}-${select.id}`;
        return (
          <div className="field" key={select.id}>
            <label htmlFor={id}>{select.etiqueta}</label>
            <FilterSelect
              id={id}
              className="select"
              value={valores[select.id] ?? ''}
              onChange={(evento) => onValor(select.id, evento.target.value)}
              opciones={select.opciones}
              etiqueta={select.etiqueta}
            />
          </div>
        );
      })}

      <span className="toolbar__spacer" />

      <span className="ui-row ui-row--tight">
        <span className="small muted nowrap">
          {mostrados} de {total}
        </span>
        {activos && (
          <button type="button" className="btn btn-link btn-sm" onClick={onLimpiar}>
            <X aria-hidden="true" /> Limpiar
          </button>
        )}
      </span>
    </div>
  );
}

function FilterSelect({
  id,
  className,
  value,
  onChange,
  opciones,
  etiqueta,
}: {
  id: string;
  className: string;
  value: string;
  onChange: React.ChangeEventHandler<HTMLSelectElement>;
  opciones: OpcionFiltro[];
  etiqueta: string;
}) {
  const [busqueda, setBusqueda] = useState('');
  const visibles = opciones.filter(
    (opcion) =>
      opcion.valor === value ||
      opcion.etiqueta.toLocaleLowerCase('es').includes(busqueda.toLocaleLowerCase('es')),
  );
  return (
    <>
      {opciones.length > 12 && (
        <input
          type="search"
          className="input"
          value={busqueda}
          aria-label={`Buscar opciones de ${etiqueta}`}
          placeholder="Buscar opción…"
          onChange={(event) => setBusqueda(event.target.value)}
        />
      )}
      <select id={id} className={className} value={value} onChange={onChange}>
        <option value="">Todas</option>
        {visibles.map((opcion) => (
          <option key={opcion.valor} value={opcion.valor}>
            {opcion.etiqueta}
          </option>
        ))}
      </select>
    </>
  );
}
