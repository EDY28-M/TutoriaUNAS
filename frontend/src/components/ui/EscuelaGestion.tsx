import { escuelas } from '../../data/catalogos';

export function EscuelaGestion({
  ids,
  value,
  onChange,
  disabled,
}: {
  ids: string[];
  value: string;
  onChange(value: string): void;
  disabled?: boolean;
}) {
  const opciones = escuelas
    .filter((e) => ids.includes(e.id))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  return (
    <label className="field">
      Escuela
      <select
        className="select"
        required
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Selecciona una escuela</option>
        {opciones.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}
