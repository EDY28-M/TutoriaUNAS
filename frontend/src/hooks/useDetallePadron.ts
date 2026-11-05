import { useQuery } from '@tanstack/react-query';
import { apiJson } from '../services/apiClient';
import type { Docente, Estudiante, MatriculaCurso } from '../types/domain';

/** Persona tal como la importó el padrón: conserva los campos crudos del Excel. */
export type PersonaPadron = (Estudiante | Docente) & {
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  ppaFuente?: string;
  tcaFuente?: string;
  estadoFuente?: string;
};

export interface DetallePadron {
  persona: PersonaPadron;
  matriculas: {
    semestreId: string;
    estado: string;
    cursos: (MatriculaCurso & { codigo: string; nombre: string })[];
  }[];
}

/**
 * Detalle de una persona del padrón importado. Lo comparten «Padrón» y «Estudiantes»
 * (misma clave de caché), así que abrir la ficha en una vista la deja lista en la otra.
 */
export function useDetallePadron(id: string | null, habilitado: boolean) {
  return useQuery({
    queryKey: ['padron-detalle', id],
    queryFn: () => apiJson<DetallePadron>(`/api/padron/${encodeURIComponent(id!)}`),
    enabled: habilitado && id !== null,
    retry: false,
    staleTime: 60_000,
  });
}
