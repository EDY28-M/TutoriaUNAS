import { Link } from 'react-router-dom';
import { FormField } from '../../components/forms/FormField';
import { useCuentaSetup } from '../../hooks/useCuentaSetup';
import type { ModoCuenta } from '../../hooks/useCuentaSetup';
import type { Role } from '../../types/auth';
import { API_MODE } from '../../services/apiConfig';
import '../../styles/account-access.css';

export function AccountSetupPage({ modo }: { modo: ModoCuenta }) {
  const c = useCuentaSetup(modo);
  const titulo =
    modo === 'activacion'
      ? 'Verifica tu cuenta'
      : modo === 'recuperacion'
        ? 'Recupera tu contraseña'
        : 'Crea tu cuenta';
  if (!API_MODE || (modo === 'activacion' && !c.activacion))
    return (
      <div className="d01__form-wrap">
        <h2 className="d01__title">{titulo}</h2>
        <p className="d01__sub">
          {!API_MODE
            ? 'Este servicio está disponible al conectar con el servidor institucional.'
            : 'Ingresa con tu contraseña temporal para iniciar la verificación.'}
        </p>
        <Link to="/login" className="d01__link-btn">
          Volver al inicio de sesión
        </Link>
      </div>
    );
  return (
    <div className="d01__form-wrap account-access">
      <h2 className="d01__title">{titulo}</h2>
      <p className="d01__sub">
        {c.fase === 'correo'
          ? modo === 'activacion'
            ? `Confirma que tienes acceso a ${c.correo}.`
            : 'Usa el correo institucional registrado en el padrón de la universidad.'
          : c.fase === 'codigo'
            ? 'Introduce el código que enviamos a tu correo institucional.'
            : c.fase === 'password'
              ? 'Elige una contraseña personal que no uses en otros servicios.'
              : 'Cuenta verificada'}
      </p>
      {c.fase !== 'terminado' && (
        <p className="small muted" aria-label="Paso actual">
          Paso {c.fase === 'correo' ? 1 : c.fase === 'codigo' ? 2 : 3} de 3
        </p>
      )}
      <form
        className="d01__form stack"
        aria-busy={c.ocupado}
        onSubmit={(e) => {
          e.preventDefault();
          void (c.fase === 'correo'
            ? c.solicitar()
            : c.fase === 'codigo'
              ? c.confirmar()
              : c.completar());
        }}
      >
        {c.fase === 'correo' && (
          <>
            {modo !== 'activacion' && (
              <>
                <FormField
                  id="account-email"
                  label="Correo institucional"
                  icon="fa-solid fa-envelope"
                  iconVariant="classic"
                  type="email"
                  autoComplete="email"
                  placeholder="nombre@unas.edu.pe"
                  maxLength={254}
                  required
                  disabled={c.ocupado}
                  value={c.correo}
                  onChange={(e) => c.setCorreo(e.target.value)}
                />
                <label className="field">
                  <span className="field__label">Perfil</span>
                  <select
                    className="form-select"
                    aria-label="Perfil"
                    disabled={c.ocupado}
                    value={c.rol}
                    onChange={(e) => c.setRol(e.target.value as Role)}
                  >
                    <option value="estudiante">Estudiante</option>
                    <option value="tutor">Docente</option>
                    {modo === 'recuperacion' && <option value="coordinacion">Coordinación</option>}
                  </select>
                </label>
              </>
            )}
            <button type="submit" className="btn w-100 d01__cta" disabled={c.ocupado}>
              {c.ocupado
                ? 'Solicitando código…'
                : modo === 'activacion'
                  ? 'Verificar cuenta'
                  : 'Enviar código'}
            </button>
          </>
        )}
        {c.fase === 'codigo' && (
          <>
            <FormField
              id="account-code"
              label="Código de verificación"
              icon="fa-solid fa-key"
              iconVariant="classic"
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              required
              disabled={c.ocupado}
              value={c.codigo}
              onChange={(e) => c.setCodigo(e.target.value.replace(/\D/g, ''))}
            />
            <button type="submit" className="btn w-100 d01__cta" disabled={c.ocupado}>
              {c.ocupado ? 'Comprobando código…' : 'Confirmar código'}
            </button>
            <button
              type="button"
              className="d01__link-btn"
              disabled={c.ocupado || c.reenviarEn > 0}
              onClick={() => void c.solicitar()}
            >
              {c.reenviarEn > 0 ? `Reenviar en ${c.reenviarEn} s` : 'Reenviar código'}
            </button>
            <p className="small">
              El código vence en diez minutos. Revisa también Spam, No deseados y Papelera.
            </p>
          </>
        )}
        {c.fase === 'password' && (
          <>
            <FormField
              id="account-password"
              label="Nueva contraseña"
              icon="fa-solid fa-lock"
              iconVariant="classic"
              type="password"
              autoComplete="new-password"
              minLength={15}
              maxLength={128}
              required
              disabled={c.ocupado}
              value={c.password}
              onChange={(e) => c.setPassword(e.target.value)}
            />
            <FormField
              id="account-confirm"
              label="Confirmar nueva contraseña"
              icon="fa-solid fa-lock"
              iconVariant="classic"
              type="password"
              autoComplete="new-password"
              minLength={15}
              maxLength={128}
              required
              disabled={c.ocupado}
              value={c.confirmacion}
              onChange={(e) => c.setConfirmacion(e.target.value)}
            />
            <p className="small">De 15 a 128 caracteres. Puedes usar una frase larga.</p>
            <button type="submit" className="btn w-100 d01__cta" disabled={c.ocupado}>
              {c.ocupado
                ? 'Guardando…'
                : modo === 'registro'
                  ? 'Crear cuenta e ingresar'
                  : 'Guardar contraseña e ingresar'}
            </button>
          </>
        )}
        {c.mensaje && (
          <p className="account-access__status" role="status">
            {c.mensaje}
          </p>
        )}
        {c.error && (
          <p className="field__error" role="alert">
            {c.error}
          </p>
        )}
      </form>
      <Link to="/login" className="d01__link-btn">
        Volver al inicio de sesión
      </Link>
    </div>
  );
}
