import { useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from './icons';
import { EmptyState } from './EmptyState';
import { RowActions } from './RowActions';

export interface Column<T> {
  key: string;
  header: string;
  render(row: T): ReactNode;
  sortable?: boolean;
  sortValue?(row: T): string | number;
  align?: 'left' | 'right';
}

interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  caption: string;
  rowKey(row: T): string;
  emptyTitle?: string;
  emptyDescription?: string;
  pageSize?: number;
  initialSort?: { key: string; direction: 'asc' | 'desc' };
  compact?: boolean;
  pagination?: 'always' | 'auto';
}

/**
 * Tabla de datos con ordenamiento y paginación a la vista.
 * Las filas se desplazan dentro del recuadro; no hay que bajar al fondo de la
 * página para cambiar de página ni para ver el resto del listado.
 */
export function DataTable<T>({
  rows,
  columns,
  caption,
  rowKey,
  emptyTitle = 'Sin registros',
  emptyDescription,
  pageSize = 12,
  initialSort,
  compact = false,
  pagination = 'always',
}: DataTableProps<T>) {
  const [orden, setOrden] = useState(initialSort ?? null);
  const [pagina, setPagina] = useState(1);
  const [cantidad, setCantidad] = useState(pageSize);
  const cantidadId = useId();
  const marco = useRef<HTMLDivElement>(null);

  const ordenadas = useMemo(() => {
    if (!orden) return rows;
    const columna = columns.find((item) => item.key === orden.key);
    if (!columna?.sortValue) return rows;
    const valor = columna.sortValue;
    return [...rows].sort((a, b) => {
      const va = valor(a);
      const vb = valor(b);
      const comparacion =
        typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb), 'es');
      return orden.direction === 'asc' ? comparacion : -comparacion;
    });
  }, [columns, orden, rows]);

  const totalPaginas = Math.max(1, Math.ceil(ordenadas.length / cantidad));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = ordenadas.slice((paginaActual - 1) * cantidad, paginaActual * cantidad);
  const desde = ordenadas.length === 0 ? 0 : (paginaActual - 1) * cantidad + 1;
  const hasta = Math.min(paginaActual * cantidad, ordenadas.length);

  function irA(siguiente: number) {
    setPagina(siguiente);
    marco.current?.scrollTo({ top: 0, left: 0 });
  }

  function alternarOrden(key: string) {
    irA(1);
    setOrden((actual) =>
      actual?.key === key
        ? { key, direction: actual.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    );
  }

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const paginacion = (
    <nav className="table-pagination" aria-label={`Paginación de ${caption}`}>
      <span className="table-pagination__info">
        <label htmlFor={cantidadId}>Filas</label>
        <select
          id={cantidadId}
          className="select"
          value={cantidad}
          onChange={(evento) => {
            setCantidad(Number(evento.target.value));
            irA(1);
          }}
        >
          {[...new Set([pageSize, 12, 25, 50])]
            .sort((a, b) => a - b)
            .map((numero) => (
              <option key={numero} value={numero}>
                {numero}
              </option>
            ))}
        </select>
        <span className="small muted">
          {desde}–{hasta} de {ordenadas.length}
          {totalPaginas > 1 ? ` · página ${paginaActual} de ${totalPaginas}` : ''}
        </span>
      </span>
      <span className="ui-row ui-row--tight">
        <button
          type="button"
          className="icon-btn icon-btn--sm icon-btn--bordered"
          aria-label="Página anterior"
          disabled={paginaActual === 1}
          onClick={() => irA(paginaActual - 1)}
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <button
          type="button"
          className="icon-btn icon-btn--sm icon-btn--bordered"
          aria-label="Página siguiente"
          disabled={paginaActual === totalPaginas}
          onClick={() => irA(paginaActual + 1)}
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </span>
    </nav>
  );

  return (
    <div className="data-table-panel">
      {(pagination === 'always' || rows.length > pageSize) && paginacion}
      <div
        ref={marco}
        className="table-wrap data-table-panel__scroll"
        role="region"
        aria-label={caption}
        tabIndex={0}
      >
        <table className={`data-table${compact ? ' data-table--compact' : ''}`}>
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((columna) => {
                const activa = orden?.key === columna.key;
                return (
                  <th
                    key={columna.key}
                    data-column={columna.key}
                    scope="col"
                    aria-sort={
                      activa ? (orden?.direction === 'asc' ? 'ascending' : 'descending') : 'none'
                    }
                  >
                    {columna.sortable && columna.sortValue ? (
                      <button
                        type="button"
                        className="th-sort"
                        onClick={() => alternarOrden(columna.key)}
                      >
                        {columna.header}
                        {activa &&
                          (orden?.direction === 'asc' ? (
                            <ArrowUp size={12} aria-hidden="true" />
                          ) : (
                            <ArrowDown size={12} aria-hidden="true" />
                          ))}
                      </button>
                    ) : (
                      columna.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibles.map((fila) => (
              <tr key={rowKey(fila)}>
                {columns.map((columna) => (
                  <td
                    key={columna.key}
                    data-column={columna.key}
                    style={columna.align === 'right' ? { textAlign: 'right' } : undefined}
                  >
                    {columna.key === 'acciones' ? (
                      <RowActions label={`Acciones del registro ${rowKey(fila)}`}>
                        {columna.render(fila)}
                      </RowActions>
                    ) : (
                      columna.render(fila)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
