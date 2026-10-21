import type { KeyboardEvent } from 'react';
import { roles } from '../../types/auth';
import type { Role } from '../../types/auth';
import { roleDetails } from '../../utils/roles';

const roleIcons: Record<Role, string> = {
  estudiante: 'fa-solid fa-graduation-cap',
  tutor: 'fa-solid fa-chalkboard-user',
  coordinacion: 'fa-solid fa-building-columns',
};

/** Valores de `data-role` tal como aparecen en el diseño de referencia. */
const roleDataValues: Record<Role, string> = {
  estudiante: 'estudiante',
  tutor: 'tutor',
  coordinacion: 'coordinador',
};

/** Tres perfiles completos con selección y navegación accesibles por teclado. */
export function RoleSelector({
  value,
  onChange,
  disabled = false,
}: {
  value: Role;
  onChange(role: Role): void;
  disabled?: boolean;
}) {
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const offsets: Record<string, number> = {
      ArrowRight: 1,
      ArrowDown: 1,
      ArrowLeft: -1,
      ArrowUp: -1,
    };
    const offset = offsets[event.key];
    if (offset === undefined) return;
    event.preventDefault();
    const next = (index + offset + roles.length) % roles.length;
    const role = roles[next];
    if (!role) return;
    onChange(role);
    const buttons =
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('.role-switch__btn');
    buttons?.[next]?.focus();
  }
  return (
    <div className="role-switch d01__roles" role="tablist" aria-label="Selecciona tu rol">
      <span className="role-switch__pill" aria-hidden="true" />
      {roles.map((role, index) => (
        <button
          key={role}
          id={`login-role-${role}`}
          type="button"
          className="role-switch__btn"
          role="tab"
          aria-selected={value === role}
          aria-controls="login-role-panel"
          disabled={disabled}
          tabIndex={value === role ? 0 : -1}
          data-role={roleDataValues[role]}
          onClick={() => onChange(role)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          <i className={`${roleIcons[role]} role-icon`} aria-hidden="true" />
          <span>{roleDetails[role].label}</span>
        </button>
      ))}
    </div>
  );
}
