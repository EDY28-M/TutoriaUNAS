import {
  facultades,
  escuelas,
  cursos,
  semestres,
  serviciosBienestar,
  areasDerivacion,
} from '../data/catalogos';
import { definicionesFormato } from '../data/formatos';
import { resumenesAcademicos, horariosDocentes } from '../data/academico';
import {
  afiliacionesSis,
  atencionesSalud,
  beneficiosSociales,
  apoyosComunicables,
  campanasSalud,
} from '../data/salud';
import { avisos, notificaciones, permisos, insumos, reglasTutoria } from '../data/institucional';
import { actividadesPlan } from '../data/tutoria';
import { derivaciones } from '../data/derivaciones';
import { comisionTutoria } from '../data/personas';
import { DISPLAY_PREFERENCES_KEY, serializeDisplayPreferences } from '../utils/displayPreferences';
import type { SistemaApi } from '../types/sistema';

function reemplazar<T>(destino: T[], origen: readonly unknown[] = []) {
  destino.splice(0, destino.length, ...(origen as T[]));
}
const catalogos = {
  facultades,
  escuelas,
  cursos,
  semestres,
  serviciosBienestar,
  areasDerivacion,
  formatos: definicionesFormato,
  reglasTutoria,
};
const fuentes = {
  resumenesAcademicos,
  horariosDocentes,
  afiliacionesSis,
  atencionesSalud,
  beneficiosSociales,
  apoyosComunicables,
  campanasSalud,
  insumos,
  derivaciones,
};
export function vaciarDatosSistema() {
  for (const destino of [
    ...Object.values(catalogos),
    ...Object.values(fuentes),
    avisos,
    notificaciones,
    permisos,
    actividadesPlan,
    comisionTutoria,
  ])
    destino.splice(0);
}
export function aplicarDatosSistema(datos: SistemaApi) {
  for (const [key, destino] of Object.entries(catalogos))
    reemplazar(destino as unknown[], datos.catalogos[key]);
  for (const [key, destino] of Object.entries(fuentes))
    reemplazar(destino as unknown[], datos.fuentes[key]);
  reemplazar(avisos, datos.mensajes);
  reemplazar(notificaciones, datos.notificaciones);
  reemplazar(permisos, datos.permisos);
  reemplazar(actividadesPlan, datos.actividadesPlan);
  // Solo caché de presentación. El estado de negocio y las preferencias confirmadas vienen de PostgreSQL.
  try {
    const pantalla = serializeDisplayPreferences(datos.preferencias.pantalla);
    if (localStorage.getItem(DISPLAY_PREFERENCES_KEY) !== pantalla) {
      localStorage.setItem(DISPLAY_PREFERENCES_KEY, pantalla);
      window.dispatchEvent(new Event('unas:preferences'));
    }
  } catch {
    /* El bloqueo de la caché visual no afecta al guardado en el servidor. */
  }
}
