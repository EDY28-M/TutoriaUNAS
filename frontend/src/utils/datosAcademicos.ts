import type { Estudiante, EtapaAcademica } from '../types/domain';
import { etapaAcademica } from '../data/catalogos';

export function promedioDe(estudiantes: readonly Estudiante[]): number | null {
  const valores = estudiantes.flatMap((e) =>
    e.promedioPonderado === null ? [] : [e.promedioPonderado],
  );
  return valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : null;
}

export function etiquetaEtapa(etapa: EtapaAcademica | 'sin-informar'): string {
  return etapa === 'sin-informar' ? 'Ciclo sin informar' : etapaAcademica[etapa].etiqueta;
}
