import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FormField } from '../../components/forms/FormField';
import { API_MODE } from '../../services/apiConfig';
import { AccountSetupPage } from './AccountSetupPage';

const schema = z.object({
  email: z.email('Ingresa un correo válido.').max(254, 'El correo es demasiado largo.'),
});
type RecoveryFields = z.infer<typeof schema>;

const SEND_PAUSE = 800;
const RESEND_PAUSE = 700;
const RESEND_RESET = 3000;

export function RecoveryPage() {
  return API_MODE ? <AccountSetupPage modo="recuperacion" /> : <DemoRecoveryPage />;
}
function DemoRecoveryPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [resendLabel, setResendLabel] = useState('Reenviar enlace');
  const resendTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (resendTimer.current) window.clearTimeout(resendTimer.current);
    },
    [],
  );
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RecoveryFields>({ resolver: zodResolver(schema), defaultValues: { email: '' } });

  function submit(values: RecoveryFields) {
    setSending(true);
    window.setTimeout(() => {
      setSending(false);
      setSentTo(values.email.trim());
    }, SEND_PAUSE);
  }

  function resend() {
    if (resendTimer.current) window.clearTimeout(resendTimer.current);
    setResendLabel('Enviando…');
    window.setTimeout(() => {
      setResendLabel('¡Enviado! ✓');
      resendTimer.current = window.setTimeout(
        () => setResendLabel('Reenviar enlace'),
        RESEND_RESET,
      );
    }, RESEND_PAUSE);
  }

  return (
    <div className="d01__form-wrap">
      {sentTo === null && (
        <div id="recovery-intro">
          <h2 className="d01__title">¿Olvidaste tu contraseña?</h2>
          <p className="d01__sub">
            Ingresa tu correo institucional para recibir tu enlace de acceso.
          </p>
        </div>
      )}

      {/* Formulario (visible por defecto) */}
      {sentTo === null && (
        <form
          className="d01__form stack"
          id="recovery-form"
          aria-busy={sending}
          noValidate
          onSubmit={handleSubmit(submit)}
        >
          <FormField
            id="recovery-email"
            label="Correo institucional"
            icon="fa-solid fa-envelope"
            type="email"
            placeholder="ejemplo@unas.edu.pe"
            autoComplete="email"
            maxLength={254}
            disabled={sending}
            error={errors.email?.message}
            {...register('email')}
          />

          <button
            className="btn w-100 d01__cta"
            type="submit"
            id="recovery-submit"
            disabled={sending}
          >
            <span hidden={!sending} className="spin" aria-hidden="true" />
            <span id="recovery-btn-label">{sending ? 'Enviando…' : 'Enviar enlace'}</span>
          </button>
        </form>
      )}

      {/* Estado de éxito */}
      {sentTo !== null && (
        <div className="recovery-success" id="recovery-success" role="status">
          <div className="recovery-success__icon" aria-hidden="true">
            <i className="fa-solid fa-circle-check" aria-hidden="true" />
          </div>
          <h3 className="recovery-success__title">¡Enlace enviado!</h3>
          <p className="recovery-success__desc">
            Enviamos el enlace a: <strong id="sent-email-display">{sentTo}</strong>
          </p>
          <p className="recovery-success__note">
            Válido por 15 minutos. Revisa también tu carpeta de spam.
          </p>
          <div className="recovery-success__actions">
            <Link to="/login" className="btn w-100 d01__cta">
              Volver al inicio de sesión
            </Link>
            <button
              type="button"
              className="d01__link-btn"
              id="btn-resend"
              onClick={resend}
              disabled={resendLabel !== 'Reenviar enlace'}
            >
              {resendLabel}
            </button>
          </div>
        </div>
      )}
      <p className="d01__demo-note">Entorno de demostración · El envío del correo se simula.</p>
    </div>
  );
}
