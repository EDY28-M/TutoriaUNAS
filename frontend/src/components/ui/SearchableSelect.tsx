import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  autoFocus?: boolean;
  required?: boolean;
  tipoResultado?: 'estudiante' | 'docente';
  limiteResultados?: number;
}

const normalizar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-PE');

/** Selección por escritura o lista, con navegación de teclado y valor confirmado. */
export function SearchableSelect({
  label,
  placeholder,
  options,
  value,
  onChange,
  autoFocus = true,
  required = false,
  tipoResultado = 'estudiante',
  limiteResultados,
}: Props) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [consulta, setConsulta] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const [posicion, setPosicion] = useState<{
    left: number;
    width: number;
    top?: number;
    bottom?: number;
    maxHeight: number;
    contenedor: HTMLElement;
  } | null>(null);
  useEffect(() => {
    if (!autoFocus) return;
    // El diálogo nativo debe estar abierto antes de enfocar su buscador.
    const frame = requestAnimationFrame(() => input.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [autoFocus]);
  useLayoutEffect(() => {
    if (!abierto || !input.current) return;
    const elemento = input.current;
    const dialogo = elemento.closest('dialog');
    const contenedor = dialogo ?? document.body;
    const actualizar = () => {
      const campo = elemento.getBoundingClientRect();
      const limites = (dialogo?.querySelector('.sheet__body') ?? dialogo)?.getBoundingClientRect();
      const arriba = Math.max(0, limites?.top ?? 0);
      const abajo = Math.min(window.innerHeight, limites?.bottom ?? window.innerHeight);
      const espacioAbajo = Math.max(0, abajo - campo.bottom - 8);
      const espacioArriba = Math.max(0, campo.top - arriba - 8);
      const abrirArriba = espacioAbajo < 180 && espacioArriba > espacioAbajo;
      const espacio = abrirArriba ? espacioArriba : espacioAbajo;
      const alto = Math.min(240, espacio);
      setPosicion({
        left: campo.left - document.documentElement.getBoundingClientRect().left,
        width: campo.width,
        top: abrirArriba ? undefined : campo.bottom + 4,
        bottom: abrirArriba ? window.innerHeight - campo.top + 4 : undefined,
        maxHeight: alto,
        contenedor,
      });
    };
    actualizar();
    window.addEventListener('resize', actualizar);
    document.addEventListener('scroll', actualizar, true);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(actualizar);
    observer?.observe(elemento);
    return () => {
      window.removeEventListener('resize', actualizar);
      document.removeEventListener('scroll', actualizar, true);
      observer?.disconnect();
    };
  }, [abierto]);
  const seleccionado = options.find((opcion) => opcion.value === value);
  const palabras = normalizar(consulta ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const coincidencias = options.filter((opcion) =>
    palabras.every((palabra) =>
      normalizar(`${opcion.label} ${opcion.description ?? ''}`).includes(palabra),
    ),
  );
  const resultados = coincidencias.slice(0, limiteResultados ?? coincidencias.length);
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
      <label htmlFor={id}>
        {label} {required && <span className="field__required">*</span>}
      </label>
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
          aria-required={required}
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
      {abierto &&
        posicion &&
        createPortal(
          <div
            className="searchable-select__popup"
            style={{
              left: posicion.left,
              top: posicion.top,
              bottom: posicion.bottom,
              width: posicion.width,
              maxHeight: posicion.maxHeight,
            }}
          >
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
                  onPointerDown={(e) => e.preventDefault()}
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
                ? `${coincidencias.length} ${tipoResultado}${coincidencias.length === 1 ? '' : 's'}${resultados.length < coincidencias.length ? ' · Escribe para acotar' : ''}`
                : `No se encontraron ${tipoResultado}s. Prueba otro nombre o código.`}
            </p>
          </div>,
          posicion.contenedor,
        )}
    </div>
  );
}
