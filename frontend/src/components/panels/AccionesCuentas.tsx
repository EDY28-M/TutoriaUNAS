import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePermiso } from '../../hooks/usePermiso';
import { API_MODE } from '../../services/apiConfig';
import { CrearCuenta } from './CrearCuenta';

export function AccionesCuentas({ rol }: { rol: 'estudiante' | 'tutor' }) {
  const puedeCrear = usePermiso('cuentas', 'crear');
  const puedeVer = usePermiso('cuentas', 'ver');
  const [crear, setCrear] = useState(false);
  if (!API_MODE) return null;
  return (
    <>
      {puedeCrear && (
        <button type="button" className="btn btn-primary" onClick={() => setCrear(true)}>
          <i className="fa-solid fa-user-plus" aria-hidden="true" />{' '}
          {rol === 'estudiante' ? 'Crear estudiante' : 'Crear docente'}
        </button>
      )}
      {puedeVer && (
        <Link className="btn btn-falcon-default" to="/coordinacion/permisos?tab=cuentas">
          Gestionar cuentas
        </Link>
      )}
      {crear && <CrearCuenta rolInicial={rol} onClose={() => setCrear(false)} />}
    </>
  );
}
