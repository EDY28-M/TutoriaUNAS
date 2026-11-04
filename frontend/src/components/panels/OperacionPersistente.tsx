import { useState } from 'react';
import type { ReactNode } from 'react';
import { useAccionPersistente } from '../../hooks/useAccionPersistente';
import { Alert } from '../ui/Alert';

export function FormularioPersistente({
  children,
  guardar,
  alGuardar,
  etiqueta = 'Guardar cambios',
}: {
  children: ReactNode;
  guardar(): Promise<unknown>;
  alGuardar?(): void;
  etiqueta?: string;
}) {
  const accion = useAccionPersistente();
  return (
    <form
      className="stack"
      aria-busy={accion.ocupado}
      onSubmit={(e) => {
        e.preventDefault();
        void accion.ejecutar(guardar).then((ok) => {
          if (ok) alGuardar?.();
        });
      }}
    >
      <fieldset
        disabled={accion.ocupado}
        className="stack"
        style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
      >
        {children}
      </fieldset>
      {accion.error && (
        <Alert tone="riesgo" title="No se guardó">
          {accion.error}
        </Alert>
      )}
      <div className="ui-row ui-row--between ui-row--wrap">
        <span role="status">{accion.mensaje}</span>
        <button type="submit" className="btn btn-primary" disabled={accion.ocupado}>
          {accion.ocupado ? 'Guardando…' : etiqueta}
        </button>
      </div>
    </form>
  );
}

export function EliminarPersistente({
  eliminar,
  alEliminar,
  etiqueta = 'Eliminar borrador',
}: {
  eliminar(): Promise<unknown>;
  alEliminar?(): void;
  etiqueta?: string;
}) {
  const [confirmar, setConfirmar] = useState(false);
  const accion = useAccionPersistente();
  return (
    <div className="stack stack--sm">
      {accion.error && (
        <Alert tone="riesgo" title="No se eliminó">
          {accion.error}
        </Alert>
      )}
      <div className="ui-row ui-row--wrap">
        <button
          type="button"
          className="btn btn-falcon-default"
          disabled={accion.ocupado}
          onClick={() => {
            if (!confirmar) setConfirmar(true);
            else
              void accion.ejecutar(eliminar, 'Registro eliminado.').then((ok) => {
                if (ok) alEliminar?.();
              });
          }}
        >
          {accion.ocupado ? 'Eliminando…' : confirmar ? 'Confirmar eliminación' : etiqueta}
        </button>
        {confirmar && (
          <button
            type="button"
            className="btn btn-link"
            disabled={accion.ocupado}
            onClick={() => setConfirmar(false)}
          >
            Conservar registro
          </button>
        )}
        <span role="status">{accion.mensaje}</span>
      </div>
    </div>
  );
}
