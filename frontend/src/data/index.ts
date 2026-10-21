/**
 * Punto único de acceso a los datos de demostración.
 *
 * Las páginas consumen estos selectores en lugar de importar los archivos de
 * `src/data` uno por uno, de modo que la sustitución por la API institucional
 * (DIAA, RRHH, Bienestar) se limite a este módulo y a los servicios.
 */
export * from './catalogos';
export * from './personas';
export * from './academico';
export * from './tutoria';
export * from './instrumentos';
export * from './derivaciones';
export * from './salud';
export * from './institucional';
export * from './navegacion';

import { avisos, notificaciones } from './institucional';
import { derivaciones } from './derivaciones';
import { instrumentos } from './instrumentos';
import { sesiones } from './tutoria';

export { avisos, notificaciones, derivaciones, instrumentos, sesiones };

/** Contadores que la barra lateral muestra junto a cada módulo. */
export interface Contadores {
  sesiones: number;
  pendientes: number;
  derivaciones: number;
  avisos: number;
  observados: number;
  revisiones: number;
}

export function contadoresDe(alcance: {
  sesionesPendientes: number;
  instrumentosPendientes: number;
  derivacionesAbiertas: number;
  avisosSinLeer: number;
  instrumentosObservados: number;
}): Contadores {
  return {
    sesiones: alcance.sesionesPendientes,
    pendientes: alcance.instrumentosPendientes,
    derivaciones: alcance.derivacionesAbiertas,
    avisos: alcance.avisosSinLeer,
    observados: alcance.instrumentosObservados,
    revisiones: 0,
  };
}
