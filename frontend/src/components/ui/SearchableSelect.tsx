import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronRight, Search, X } from './icons';
import '../../styles/searchable-select.css';

interface Option {
  value: string;
  label: string;
  description?: string;
}

interface Props {
  label: string;
  placeholder?: string;
  options: Option[];
  value: string;
  onChange(value: string): void;
}

const normalizar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-PE');

/** Selección por escritura o lista, con navegación de teclado y valor confirmado. */
export function SearchableSelect({ label, placeholder, options, value, onChange }: Props) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [consulta, setConsulta] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  useEffect(() => {
    // El diálogo nativo debe estar abierto antes de enfocar su buscador.
    const frame = requestAnimationFrame(() => input.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);
  const seleccionado = options.find((opcion) => opcion.value === value);
  const palabras = normalizar(consulta ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const resultados = options.filter((opcion) =>
    palabras.every((palabra) =>
      normalizar(`${opcion.label} ${opcion.description ?? ''}`).includes(palabra),
    ),
  );
  const indiceActivo = resultados.length ? Math.min(activo, resultados.length - 1) : -1;
  function elegir(opcion: Option) {
    onChange(opcion.value);
    setConsulta(null);
    setAbierto(false);
    input.current?.focus();
  }
  function mover(indice: number) {
    setAbierto(true);
    const destino = Math.max(0, Math.min(indice, resultados.length - 1));
    setActivo(destino);
    requestAnimationFrame(() =>
      list.current?.children[destino]?.scrollIntoView({ block: 'nearest' }),
    );
  }
  return (
    <div
      className="searchable-select"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setAbierto(false);
      }}
    >
      <label htmlFor={id}>{label}</label>
      <div className="searchable-select__input">
        <Search aria-hidden="true" />
        <input
          id={id}
          ref={input}
          className="input"
          role="combobox"
          autoComplete="off"
          placeholder={placeholder}
          aria-autocomplete="list"
          aria-expanded={abierto}
          aria-controls={`${id}-list`}
          aria-activedescendant={
            abierto && indiceActivo >= 0 ? `${id}-option-${indiceActivo}` : undefined
          }
          aria-describedby={seleccionado?.description ? `${id}-selection` : undefined}
          value={consulta ?? seleccionado?.label ?? ''}
          onFocus={() => {
            if (!seleccionado || consulta !== null) setAbierto(true);
            setActivo(0);
          }}
          onClick={() => setAbierto(true)}
          onChange={(e) => {
            setConsulta(e.target.value);
            setAbierto(true);
            setActivo(0);
            if (value) onChange('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              mover(abierto ? indiceActivo + (e.key === 'ArrowDown' ? 1 : -1) : 0);
            } else if (e.key === 'Enter' && abierto) {
              e.preventDefault();
              const opcion = resultados[indiceActivo];
              if (opcion) elegir(opcion);
            } else if (e.key === 'Escape' && abierto) {
              e.preventDefault();
              e.stopPropagation();
              setAbierto(false);
            }
          }}
        />
        {(consulta || value) && (
          <button
            className="icon-btn"
            type="button"
            aria-label={`Limpiar ${label.toLocaleLowerCase('es-PE')}`}
            onClick={() => {
              onChange('');
              setConsulta('');
              setActivo(0);
              setAbierto(true);
              input.current?.focus();
            }}
          >
            <X aria-hidden="true" />
          </button>
        )}
      </div>
      {seleccionado?.description && (
        <p id={`${id}-selection`} className="searchable-select__selection">
          <Check aria-hidden="true" />
          {seleccionado.description}
        </p>
      )}
      {abierto && (
        <>
          <ul
            id={`${id}-list`}
            ref={list}
            className="searchable-select__list"
            role="listbox"
            aria-label={label}
          >
            {resultados.map((opcion, indice) => (
              <li
                key={opcion.value}
                id={`${id}-option-${indice}`}
                role="option"
                aria-selected={value === opcion.value}
                data-active={indice === indiceActivo}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => elegir(opcion)}
              >
                <span>
                  <strong>{opcion.label}</strong>
                  {opcion.description && <small>{opcion.description}</small>}
                </span>
                {value === opcion.value ? (
                  <Check aria-hidden="true" />
                ) : (
                  <ChevronRight aria-hidden="true" />
                )}
              </li>
            ))}
          </ul>
          <p className="searchable-select__results" role="status">
            {resultados.length
              ? `${resultados.length} ${resultados.length === 1 ? 'estudiante encontrado' : 'estudiantes encontrados'}`
              : 'No se encontraron estudiantes. Prueba otro nombre o código.'}
          </p>
        </>
      )}
    </div>
  );
}
