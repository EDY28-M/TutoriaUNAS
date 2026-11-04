import type { CodigoFormato, Instrumento } from '../types/domain';
import { etapaAcademica, etapaDeCiclo } from '../data/catalogos';

export const esEntrevista = (codigo: CodigoFormato) => ['F03', 'F04', 'F05'].includes(codigo);

export function tituloEntrevista(codigo: CodigoFormato): string {
  if (codigo === 'F03') return 'Entrevista de primeros ciclos';
  if (codigo === 'F04') return 'Entrevista de ciclos intermedios';
  if (codigo === 'F05') return 'Entrevista de ciclos finales';
  return 'Entrevista';
}

/** Las entrevistas de otros ciclos o semestres se conservan como antecedentes. */
export function formulariosVigentes(
  registros: readonly Instrumento[],
  ciclo: number | null,
  semestre: string,
): Instrumento[] {
  const formato = ciclo === null ? null : etapaAcademica[etapaDeCiclo(ciclo)].formato;
  return registros.filter(
    (r) => !esEntrevista(r.formato) || (r.formato === formato && r.semestreId === semestre),
  );
}
