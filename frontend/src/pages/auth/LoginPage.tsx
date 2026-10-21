import { useState } from 'react';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Role } from '../../types/auth';
import { useAuth } from '../../hooks/useAuth';
import { FormField } from '../../components/forms/FormField';
import { RoleSelector } from '../../components/forms/RoleSelector';
import { dashboardPath, roleDetails } from '../../utils/roles';

const schema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, 'Ingresa tu usuario de prueba.')
    .max(64, 'El usuario es demasiado largo.'),
  password: z
    .string()
    .min(1, 'Ingresa tu contraseña de prueba.')
    .max(128, 'La contraseña es demasiado larga.'),
  remember: z.boolean(),
});
type LoginFields = z.infer<typeof schema>;

type LoginStatus = 'idle' | 'submitting' | 'granted';

const GRANTED_PAUSE = 700;

export function LoginPage() {
  const [role, setRole] = useState<Role>('estudiante');
  const [status, setStatus] = useState<LoginStatus>('idle');
  const [failure, setFailure] = useState<string | null>(null);
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    resetField,
    formState: { errors },
  } = useForm<LoginFields>({
    resolver: zodResolver(schema),
    defaultValues: { identifier: '', password: '', remember: true },
  });
  const details = roleDetails[role];
  const busy = status !== 'idle';

  function changeRole(nextRole: Role) {
    if (nextRole === role) return;
    setRole(nextRole);
    resetField('identifier');
    setFailure(null);
  }

  if (user) return <Navigate to={dashboardPath(user.role)} replace />;

  async function submit(values: LoginFields) {
    setFailure(null);
    setStatus('submitting');
    try {
      const account = await login(
        { role, identifier: values.identifier, password: values.password },
        values.remember,
      );
      setStatus('granted');
      // «Acceso concedido ✓» se mantiene un instante antes de entrar al panel,
      // igual que en el diseño de referencia.
      await new Promise((resolve) => {
        window.setTimeout(resolve, GRANTED_PAUSE);
      });
      navigate(dashboardPath(account.role), { replace: true });
    } catch (error) {
      setStatus('idle');
      setFailure(error instanceof Error ? error.message : 'No se pudo iniciar sesión.');
    }
  }

  return (
    <div className="d01__form-wrap">
      <div className="d01__intro">
        <h2 className="d01__title">{details.title}</h2>
        <p className="d01__sub">Accede a tu acompañamiento universitario.</p>
      </div>

      <RoleSelector value={role} onChange={changeRole} disabled={busy} />

      <form
        className="d01__form stack"
        id="login-role-panel"
        role="tabpanel"
        aria-labelledby={`login-role-${role}`}
        aria-busy={busy}
        onSubmit={handleSubmit(submit)}
        noValidate
      >
        <FormField
          id="identifier"
          label={details.identifierLabel}
          icon="fa-solid fa-id-card"
          iconVariant="classic"
          placeholder={details.example}
          autoComplete="username"
          maxLength={64}
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
          <span hidden={status !== 'submitting'} className="spin" aria-hidden="true" />
          <span data-btn-label>
            {status === 'submitting'
              ? 'Verificando credenciales…'
              : status === 'granted'
                ? 'Acceso concedido ✓'
                : details.cta}
          </span>
        </button>

        <p className="d01__ok" data-success role="status" hidden={status !== 'granted'}>
          Bienvenido de vuelta. Redirigiendo a tu panel…
        </p>

        {failure && (
          <p className="d01__ok d01__ok--error" role="alert">
            {failure}
          </p>
        )}
      </form>
      <p className="d01__demo-note">Entorno de demostración · Accede con una cuenta de prueba.</p>
    </div>
  );
}
