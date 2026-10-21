import { useId } from 'react';
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { CircleAlert } from '../ui/icons';

interface FieldProps {
  id?: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

/**
 * Envoltura de campo del sistema: etiqueta asociada, ayuda y mensaje de error.
 * El control se pasa como hijo para poder usar `input`, `select` o `textarea`.
 */
export function Field({ id, label, hint, error, required = false, children }: FieldProps) {
  const generado = useId();
  const controlId = id ?? generado;
  return (
    <div className="field">
      <label htmlFor={controlId}>
        {label}
        {required && (
          <span className="field__required" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && <span className="field__hint">{hint}</span>}
      {error && (
        <span className="field__error" id={`${controlId}-error`}>
          <CircleAlert aria-hidden="true" />
          {error}
        </span>
      )}
    </div>
  );
}

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & { mono?: boolean };

export function TextInput({ mono = false, className = '', ...props }: TextInputProps) {
  return <input {...props} className={`input${mono ? ' input--mono' : ''} ${className}`.trim()} />;
}

export function TextArea({
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`textarea ${className}`.trim()} />;
}

type SelectInputProps = SelectHTMLAttributes<HTMLSelectElement> & { opciones: string[] };

export function SelectInput({ opciones, className = '', ...props }: SelectInputProps) {
  return (
    <select {...props} className={`select ${className}`.trim()}>
      {opciones.map((opcion) => (
        <option key={opcion} value={opcion}>
          {opcion}
        </option>
      ))}
    </select>
  );
}

/** Fila de opciones de una escala tipo Likert. */
export function ScaleInput({
  nombre,
  opciones,
  valor,
  onChange,
}: {
  nombre: string;
  opciones: string[];
  valor: string;
  onChange(valor: string): void;
}) {
  return (
    <div className="ui-row ui-row--wrap ui-row--tight" role="radiogroup" aria-label={nombre}>
      {opciones.map((opcion) => (
        <label className="chip" key={opcion} aria-pressed={valor === opcion}>
          <input
            type="radio"
            name={nombre}
            value={opcion}
            checked={valor === opcion}
            onChange={() => onChange(opcion)}
            className="sr-only"
          />
          {opcion}
        </label>
      ))}
    </div>
  );
}
