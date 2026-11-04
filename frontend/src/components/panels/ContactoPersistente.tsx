import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSistema } from '../../hooks/useSistema';
import { guardarContactoApi } from '../../services/apiSistema';
import { Alert } from '../ui/Alert';

const schema = z.object({
  correo: z.email('Revisa el correo de contacto.').max(254),
  telefono: z.string().max(40, 'Usa como máximo 40 caracteres.'),
  version: z.number().int().nonnegative(),
});
type Contacto = z.infer<typeof schema>;
export function ContactoPersistente() {
  const sistema = useSistema();
  const data = sistema?.contacto;
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<Contacto>({
    resolver: zodResolver(schema),
    defaultValues: {
      correo: data?.correo ?? '',
      telefono: data?.telefono ?? '',
      version: data?.version ?? 0,
    },
  });
  useEffect(() => {
    if (data && !isDirty)
      reset({ correo: data.correo, telefono: data.telefono, version: data.version });
  }, [data, isDirty, reset]);
  if (!data) return <p role="status">Cargando contacto…</p>;
  return (
    <form
      className="stack"
      onSubmit={handleSubmit(async (values) => {
        setError('');
        setMensaje('');
        try {
          const guardado = await guardarContactoApi(values);
          reset({
            correo: guardado.correo,
            telefono: guardado.telefono,
            version: guardado.version,
          });
          setMensaje('Contacto guardado.');
        } catch (e) {
          setError(e instanceof Error ? e.message : 'No se pudo guardar el contacto.');
        }
      })}
    >
      {error && (
        <Alert tone="riesgo" title="No se guardó el contacto">
          {error}
        </Alert>
      )}
      <label className="field">
        <span>Correo de contacto</span>
        <input
          className="input"
          type="email"
          autoComplete="email"
          disabled={isSubmitting}
          aria-invalid={!!errors.correo}
          {...register('correo')}
        />
        {errors.correo && <span role="alert">{errors.correo.message}</span>}
      </label>
      <label className="field">
        <span>Teléfono o anexo</span>
        <input
          className="input"
          type="tel"
          autoComplete="tel"
          disabled={isSubmitting}
          aria-invalid={!!errors.telefono}
          {...register('telefono')}
        />
        {errors.telefono && <span role="alert">{errors.telefono.message}</span>}
      </label>
      <p className="small muted">
        Los datos académicos y el correo institucional los actualiza el área responsable.
      </p>
      <div className="ui-row ui-row--between ui-row--wrap">
        <span role="status">{mensaje}</span>
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}
