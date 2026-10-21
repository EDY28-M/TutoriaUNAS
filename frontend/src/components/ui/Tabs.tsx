import type { ReactNode } from 'react';

export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
  count?: number;
}

interface TabsProps {
  items: TabItem[];
  activo: string;
  onChange(id: string): void;
  etiqueta: string;
}

/** Pestañas accesibles con navegación por flechas. */
export function Tabs({ items, activo, onChange, etiqueta }: TabsProps) {
  function alTeclado(evento: React.KeyboardEvent<HTMLButtonElement>, indice: number) {
    const salto = evento.key === 'ArrowRight' ? 1 : evento.key === 'ArrowLeft' ? -1 : 0;
    if (!salto) return;
    evento.preventDefault();
    const siguiente = items[(indice + salto + items.length) % items.length];
    if (!siguiente) return;
    onChange(siguiente.id);
    const botones =
      evento.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    const boton = botones?.[(indice + salto + items.length) % items.length];
    boton?.focus({ preventScroll: true });
    const fila = boton?.parentElement;
    if (boton && fila) {
      const item = boton.getBoundingClientRect();
      const contenedor = fila.getBoundingClientRect();
      if (item.left < contenedor.left) fila.scrollLeft += item.left - contenedor.left;
      else if (item.right > contenedor.right) fila.scrollLeft += item.right - contenedor.right;
    }
  }

  return (
    <div className="tabs" role="tablist" aria-label={etiqueta}>
      {items.map((item, indice) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          id={`tab-${item.id}`}
          aria-selected={activo === item.id}
          tabIndex={activo === item.id ? 0 : -1}
          onClick={() => onChange(item.id)}
          onKeyDown={(evento) => alTeclado(evento, indice)}
        >
          {item.icon}
          {item.label}
          {typeof item.count === 'number' && <span className="tabs__count">{item.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({
  id,
  activo,
  children,
}: {
  id: string;
  activo: string;
  children: ReactNode;
}) {
  if (id !== activo) return null;
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} className="stack">
      {children}
    </div>
  );
}
