import type { ReactNode } from 'react';

interface PersonCellProps {
  nombres: string;
  apellidos?: string;
  detalle?: string;
  iniciales: string;
  tono?: 'verde' | 'dorado' | 'slate';
}

/** Celda de tabla con avatar, nombre completo y dato secundario. */
export function PersonCell({
  nombres,
  apellidos,
  detalle,
  iniciales,
  tono = 'verde',
}: PersonCellProps) {
  const claseTono = tono === 'dorado' ? ' avatar--gold' : tono === 'slate' ? ' avatar--slate' : '';
  return (
    <span className="person-cell">
      <span className={`avatar${claseTono}`} aria-hidden="true">
        {iniciales}
      </span>
      <span className="person-cell__text">
        <strong>{apellidos ? `${apellidos}, ${nombres}` : nombres}</strong>
        {detalle && <small>{detalle}</small>}
      </span>
    </span>
  );
}

/** Fila de lista con icono, título y descripción. */
export function ListItem({
  icon,
  titulo,
  descripcion,
  meta,
  aside,
  to,
  onClick,
}: {
  icon?: ReactNode;
  titulo: string;
  descripcion?: string;
  meta?: ReactNode;
  aside?: ReactNode;
  to?: string;
  onClick?(): void;
}) {
  const contenido = (
    <>
      {icon && <span className="list__icon">{icon}</span>}
      <span className="list__body">
        <strong>{titulo}</strong>
        {descripcion && <p>{descripcion}</p>}
        {meta && <span className="list__meta">{meta}</span>}
      </span>
      {aside && <span className="list__aside">{aside}</span>}
    </>
  );

  if (to) {
    return (
      <li>
        <a className="list__item list__item--interactive" href={to}>
          {contenido}
        </a>
      </li>
    );
  }
  if (onClick) {
    return (
      <li>
        <button
          type="button"
          className="list__item list__item--interactive list__item--boton"
          onClick={onClick}
        >
          {contenido}
        </button>
      </li>
    );
  }
  return <li className="list__item">{contenido}</li>;
}
