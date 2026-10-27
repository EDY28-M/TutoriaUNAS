import { useId } from 'react';
import type { ReactNode } from 'react';
import { cambiarMomento } from '../../services/instrumentWorkspace';
import type { MomentoTutoria } from '../../utils/instrumentos';
import { Info } from './icons';
import '../../styles/forms-panel.css';

interface FormsPanelProps {
  title: string;
  status: ReactNode;
  momento: MomentoTutoria;
  children: ReactNode;
  className?: string;
  /** Mueve el selector de etapa a la fila de filtros (portal del estudiante). */
  etapaEnFiltros?: boolean;
}

/** Cabecera y etapa compartidas por las bandejas de estudiante y docente. */
export function FormsPanel({
  title,
  status,
  momento,
  children,
  className = '',
  etapaEnFiltros = false,
}: FormsPanelProps) {
  const id = useId();
  return (
    <section className={`forms-panel ${className}`} aria-labelledby={`${id}-title`}>
      <header className="forms-panel__header page-head">
        <h1 id={`${id}-title`}>{title}</h1>
        <span className="forms-panel__pending">{status}</span>
      </header>
      {children}
      <footer className="forms-panel__demo">
        <span>
          <Info aria-hidden="true" /> Modo demostración
        </span>
        {!etapaEnFiltros && <EtapaSelector momento={momento} />}
      </footer>
    </section>
  );
}

/** Selector de la etapa del semestre que gobierna qué formularios se pueden enviar. */
export function EtapaSelector({ momento }: { momento: MomentoTutoria }) {
  const id = useId();
  return (
    <label className="forms-panel__etapa" htmlFor={`${id}-moment`}>
      Etapa
      <select
        className="select"
        id={`${id}-moment`}
        aria-label="Momento del semestre"
        value={momento}
        onChange={(e) => cambiarMomento(e.target.value as MomentoTutoria)}
      >
        <option value="inicio">Inicio</option>
        <option value="durante">Durante el semestre</option>
        <option value="cierre">Cierre</option>
      </select>
    </label>
  );
}

interface FormsFiltersProps {
  label: string;
  options: { id: string; nombre: string; cantidad: number }[];
  value: string;
  onChange(value: string): void;
  /** Controles que se alinean a la derecha de los filtros (por ejemplo, la etapa). */
  acciones?: ReactNode;
}

export function FormsFilters({ label, options, value, onChange, acciones }: FormsFiltersProps) {
  return (
    <div className="forms-panel__filters" role="group" aria-label={label}>
      {options.map(({ id, nombre, cantidad }) => (
        <button type="button" key={id} aria-pressed={value === id} onClick={() => onChange(id)}>
          {nombre}
          <span>{cantidad}</span>
        </button>
      ))}
      {acciones && <div className="forms-panel__filters-actions">{acciones}</div>}
    </div>
  );
}
