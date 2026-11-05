import { useState } from 'react';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../hooks/useAuth';
import { FormField } from '../../components/forms/FormField';
import { dashboardPath } from '../../utils/roles';
import { API_MODE } from '../../services/apiConfig';
import { ActivacionRequerida } from '../../services/cuentas';
import { preloadLoginDestination } from '../../routes/portalPages';

const schema = z.object({
  identifier: z
    .string()
    .trim()
    .min(
      1,
      API_MODE ? 'Ingresa tu correo institucional o usuario.' : 'Ingresa tu usuario de prueba.',
    )
    .max(254, 'El usuario es demasiado largo.'),
  password: z
    .string()
    .min(1, API_MODE ? 'Ingresa tu contraseña.' : 'Ingresa tu contraseña de prueba.')
    .max(128, 'La contraseña es demasiado larga.'),
  remember: z.boolean(),
});
type LoginFields = z.infer<typeof schema>;

export function LoginPage() {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFields>({
    resolver: zodResolver(schema),
    defaultValues: { identifier: '', password: '', remember: true },
  });
  if (user) return <Navigate to={dashboardPath(user.role)} replace />;

  async function submit(values: LoginFields) {
    setFailure(null);
    setBusy(true);
    preloadLoginDestination();
    try {
      await login({ identifier: values.identifier, password: values.password }, values.remember);
    } catch (error) {
      if (error instanceof ActivacionRequerida) {
        navigate('/verificar-cuenta', { replace: true });
        return;
      }
      setBusy(false);
      setFailure(error instanceof Error ? error.message : 'No se pudo iniciar sesión.');
    }
  }

  return (
    <div className="d01__form-wrap">
      <div className="d01__intro">
        <h2 className="d01__title" id="login-title">
          Inicia sesión
        </h2>
        <p className="d01__sub">Accede a tu acompañamiento universitario.</p>
      </div>

      <form
        className="d01__form stack"
        aria-labelledby="login-title"
        aria-busy={busy}
        onSubmit={handleSubmit(submit)}
        noValidate
      >
        <FormField
          id="identifier"
          label="Correo institucional o usuario"
          icon="fa-solid fa-id-card"
          iconVariant="classic"
          placeholder="nombre@unas.edu.pe"
          autoComplete="username"
          maxLength={254}
          disabled={busy}
          error={errors.identifier?.message}
          {...register('identifier')}
        />

        <FormField
          id="password"
          label="Contraseña"
          icon="fa-solid fa-lock"
          iconVariant="classic"
          type="password"
          placeholder="••••••••••"
          autoComplete="current-password"
          maxLength={128}
          disabled={busy}
          error={errors.password?.message}
          {...register('password')}
        />

        <div className="between d01__opts">
          <label className="checkbox">
            <input type="checkbox" disabled={busy} {...register('remember')} /> Mantener mi sesión
          </label>
          <Link className="link-soft" to="/recuperar-clave">
            ¿Olvidaste tu clave?
          </Link>
        </div>

        <button className="btn w-100 d01__cta" type="submit" disabled={busy}>
          <span hidden={!busy} className="spin" aria-hidden="true" />
          <span data-btn-label>{busy ? 'Verificando credenciales…' : 'Ingresar'}</span>
        </button>

        {failure && (
          <p className="d01__ok d01__ok--error" role="alert">
            {failure}
          </p>
        )}
      </form>
      {API_MODE ? (
        <p className="d01__demo-note">
          ¿Aún no tienes cuenta?{' '}
          <Link className="link-soft" to="/crear-cuenta">
            Crear cuenta
          </Link>
        </p>
      ) : (
        <p className="d01__demo-note">Entorno de demostración · Accede con una cuenta de prueba.</p>
      )}
    </div>
  );
}
