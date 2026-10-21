import { Link } from 'react-router-dom';
import mark from '../../assets/unas-logo-mark.png';
import light from '../../assets/unas-logo-light.png';

/**
 * Escudo y nombre institucional del marco «Selva».
 * En escritorio usa el escudo para fondo oscuro; por debajo de 980 px la
 * cabecera pasa a blanco y el <source> sirve el escudo normal.
 */
export function BrandMark({ variant }: { variant: 'login' | 'recovery' }) {
  const recovery = variant === 'recovery';
  return (
    <Link className="brand-mark brand-mark--light d01__logo" to={recovery ? '/login' : '/'}>
      <picture className="d01__crest">
        <source media="(max-width: 980px)" srcSet={mark} />
        <img
          className="brand-mark__logo"
          src={light}
          alt="Escudo UNAS"
          width={recovery ? 48 : 54}
          height={recovery ? 55 : 62}
        />
      </picture>
      <span className="brand-mark__text">
        <span className="brand-mark__eyebrow">Universidad Nacional</span>
        <span className="brand-mark__name">Agraria de la Selva</span>
      </span>
    </Link>
  );
}
