import type { DefinicionFormato } from '../types/domain';
import { camposVisibles, erroresInstrumento } from './validacionInstrumentos';

/** Solo se ocultan respuestas existentes y válidas; las preguntas nuevas siguen visibles. */
export function preguntasRegistradas(
  definicion: DefinicionFormato,
  valores: Record<string, string>,
): Set<string> {
  const errores = erroresInstrumento(definicion, valores);
  return new Set(
    camposVisibles(definicion, valores)
      .filter(
        (campo) =>
          Boolean(valores[campo.codigo]?.trim()) &&
          !['[]', '{}'].includes(valores[campo.codigo]!) &&
          !errores[campo.codigo] &&
          !errores[`${campo.codigo}__otro`],
      )
      .map((campo) => campo.codigo),
  );
}
