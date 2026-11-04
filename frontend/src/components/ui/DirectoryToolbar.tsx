import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { Sheet } from './Sheet';

interface FilterDefinition {
  id: string;
  etiqueta: string;
  opciones: { valor: string; etiqueta: string }[];
}

/** Búsqueda inmediata y filtros por lotes, con etiquetas removibles a la vista. */
export function DirectoryToolbar({
  busqueda,
  onBusqueda,
  selects,
  valores,
  onValores,
  mostrados,
  total,
  onLimpiar,
  etiqueta,
  placeholder,
  views,
}: {
  busqueda: string;
  onBusqueda(value: string): void;
  selects: FilterDefinition[];
  valores: Record<string, string>;
  onValores(values: Record<string, string>): void;
  mostrados: number;
  total: number;
  onLimpiar(): void;
  etiqueta: string;
  placeholder: string;
  views?: ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const active = selects.filter((select) => valores[select.id]);
  return (
    <div className="directory-toolbar">
      {views}
      <div className="directory-toolbar__search" role="search" aria-label={etiqueta}>
        <label className="directory-search">
          <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
          <span className="sr-only">{placeholder}</span>
          <input
            type="search"
            placeholder={placeholder}
            value={busqueda}
            onChange={(event) => onBusqueda(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="btn btn-falcon-default directory-filter-button"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => {
            setDraft({ ...valores });
            setOpen(true);
          }}
        >
          <i className="fa-solid fa-sliders" aria-hidden="true" /> Filtros
          {active.length > 0 && <span className="directory-filter-count">{active.length}</span>}
        </button>
        <span className="directory-result" role="status">
          {mostrados} de {total}
        </span>
      </div>
      {(active.length > 0 || busqueda) && (
        <div className="directory-filter-tags" aria-label="Filtros aplicados">
          {active.map((select) => (
            <button
              type="button"
              key={select.id}
              aria-label={`Quitar filtro ${select.etiqueta}`}
              onClick={() => onValores({ ...valores, [select.id]: '' })}
            >
              <span>
                {select.etiqueta}:{' '}
                <strong>
                  {select.opciones.find((option) => option.valor === valores[select.id])
                    ?.etiqueta ?? valores[select.id]}
                </strong>
              </span>
              <i className="fa-solid fa-xmark" aria-hidden="true" />
            </button>
          ))}
          <button type="button" className="directory-clear" onClick={onLimpiar}>
            Limpiar todo
          </button>
        </div>
      )}
      {open && (
        <Sheet
          title={etiqueta}
          description="Combina los campos y aplica los filtros al listado."
          className="directory-filter-sheet"
          onClose={() => setOpen(false)}
          footer={
            <>
              <button type="button" className="btn btn-link" onClick={() => setDraft({})}>
                Restablecer
              </button>
              <button type="submit" form={id} className="btn btn-primary">
                Aplicar filtros
              </button>
            </>
          }
        >
          <form
            id={id}
            className="directory-filter-form"
            onSubmit={(event) => {
              event.preventDefault();
              onValores(draft);
              setOpen(false);
            }}
          >
            {selects.map((select, index) => (
              <div className="field" key={select.id}>
                <label htmlFor={`${id}-${select.id}`}>
                  <span className="directory-filter-index" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  {select.etiqueta}
                </label>
                <select
                  id={`${id}-${select.id}`}
                  aria-label={select.etiqueta}
                  className="select"
                  value={draft[select.id] ?? ''}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, [select.id]: event.target.value }))
                  }
                >
                  <option value="">Todas las opciones</option>
                  {select.opciones.map((option) => (
                    <option key={option.valor} value={option.valor}>
                      {option.etiqueta}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </form>
        </Sheet>
      )}
    </div>
  );
}
