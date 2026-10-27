import { useEffect, useMemo, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { DefinicionFormato, Instrumento } from '../types/domain';
import type { Portal } from './usePortal';
import { contextualizarDefinicion, precargarInstrumentoConOrigen } from '../utils/instrumentos';
import {
  crearEsquemaFormulario,
  deserializarFormulario,
  serializarFormulario,
} from '../utils/validacionInstrumentos';
import type { ValoresFormularioInstrumento } from '../utils/validacionInstrumentos';

/** Los datos nuevos completan campos intactos; nunca pisan cambios pendientes de otra persona. */
export function useFormularioInstrumento(
  definicion: DefinicionFormato,
  instrumento: Instrumento,
  portal: Pick<Portal, 'sesiones' | 'instrumentos'>,
  editable: boolean,
) {
  const contexto = useMemo(
    () => contextualizarDefinicion(definicion, instrumento),
    [definicion, instrumento],
  );
  const precarga = useMemo(
    () => precargarInstrumentoConOrigen(instrumento, portal.sesiones, portal.instrumentos),
    [instrumento, portal.sesiones, portal.instrumentos],
  );
  const esquema = useMemo(() => crearEsquemaFormulario(contexto), [contexto]);
  const defaults = deserializarFormulario(contexto, precarga.valores);
  const formulario = useForm<ValoresFormularioInstrumento>({
    defaultValues: defaults,
    resolver: zodResolver(esquema),
    shouldUnregister: false,
    shouldFocusError: false,
  });
  // La suscripción explícita es necesaria para que reset conserve los valores dirty.
  const { dirtyFields, errors } = formulario.formState;
  const { reset, getValues, getFieldState } = formulario;
  const anteriorId = useRef(instrumento.id);
  const defaultsSerializados = JSON.stringify(defaults);
  const bloqueado = !editable || ['enviado', 'aprobado'].includes(instrumento.estado);
  useEffect(() => {
    const mismaPersonaYRegistro = anteriorId.current === instrumento.id;
    anteriorId.current = instrumento.id;
    const conservar = mismaPersonaYRegistro && !bloqueado;
    const siguientes = JSON.parse(defaultsSerializados) as ValoresFormularioInstrumento;
    if (conservar) {
      const actuales = getValues();
      for (const codigo of Object.keys(siguientes.tablas)) {
        // RHF conserva hojas dirty, pero un reset podría resucitar una fila eliminada.
        // Una tabla editada se conserva completa, incluida su estructura y orden.
        if (getFieldState(`tablas.${codigo}`).isDirty)
          siguientes.tablas[codigo] = actuales.tablas[codigo] ?? [];
      }
    }
    reset(siguientes, {
      keepDirtyValues: conservar,
      keepErrors: conservar,
    });
  }, [defaultsSerializados, instrumento.id, bloqueado, reset, getValues, getFieldState]);
  const observados = useWatch({
    control: formulario.control,
    compute: (datos: ValoresFormularioInstrumento) => datos,
  });
  const valores = serializarFormulario(observados);
  const reutilizados = precarga.reutilizados.filter(
    (codigo) => !dirtyFields.respuestas?.[codigo] && !dirtyFields.tablas?.[codigo],
  );
  const errores: Record<string, string> = {};
  for (const grupo of [errors.respuestas, errors.tablas]) {
    for (const [codigo, detalle] of Object.entries(grupo ?? {})) {
      if (!detalle || typeof detalle !== 'object') continue;
      if ('message' in detalle && typeof detalle.message === 'string')
        errores[codigo] = detalle.message;
      else if ('root' in detalle && detalle.root && typeof detalle.root.message === 'string')
        errores[codigo] = detalle.root.message;
    }
  }
  return { formulario, contexto, valores, reutilizados, errores };
}
