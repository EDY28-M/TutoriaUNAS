import type {
  Asignacion,
  Docente,
  Estudiante,
  Instrumento,
  Matricula,
  BloqueHorario,
  Sesion,
  CodigoFormato,
} from '../types/domain';
import type { DemoUser } from '../types/auth';
import { estudiantes, docentes } from '../data/personas';
import { asignaciones } from '../data/tutoria';
import { matriculas, horariosAcademicos } from '../data/academico';
import { establecerSemestreActual } from '../data/catalogos';
import { apiJson, getApiSession } from './apiClient';
import type { MomentoTutoria } from '../utils/instrumentos';
import type { ProgramacionSesion } from './sessionWorkspace';
import type { SistemaApi } from '../types/sistema';
import { aplicarDatosSistema, vaciarDatosSistema } from './datosSistema';
import { API_MODE } from './apiConfig';

export interface EstadoApi {
  usuario: DemoUser;
  semestreId: string;
  momento: MomentoTutoria;
  periodoVersion: number;
  estudiantes: Estudiante[];
  docentes: Docente[];
  asignaciones: Asignacion[];
  matriculas: Matricula[];
  horarios: BloqueHorario[];
  registros: Instrumento[];
  sesiones: Sesion[];
  precargas: Record<string, Record<string, string>>;
  sistema?: SistemaApi;
  historial?: Instrumento[];
}
const vacio = {
  registros: [] as Instrumento[],
  momento: 'durante' as MomentoTutoria,
  aviso: null as string | null,
};
let estado = { datos: null as EstadoApi | null, error: null as string | null, workspace: vacio };
let revisionCarga = 0;
const listeners = new Set<() => void>();
export const snapshotApi = () => estado;
export const workspaceApi = () => estado.workspace;
export function suscribirApi(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function publicar() {
  listeners.forEach((l) => l());
}
export function confirmarSistema(actualizar: (sistema: SistemaApi) => SistemaApi) {
  if (!estado.datos?.sistema) return;
  revisionCarga++;
  const sistema = actualizar(estado.datos.sistema);
  const registros = [...estado.datos.registros];
  estado = {
    ...estado,
    datos: { ...estado.datos, sistema, registros },
    workspace: { ...estado.workspace, registros },
  };
  aplicarDatosSistema(sistema);
  publicar();
}
export function vaciarApi() {
  revisionCarga++;
  estado = { datos: null, error: null, workspace: vacio };
  estudiantes.splice(0);
  docentes.splice(0);
  asignaciones.splice(0);
  matriculas.splice(0);
  horariosAcademicos.splice(0);
  if (API_MODE) vaciarDatosSistema();
  publicar();
}
export function aplicarEstadoApi(datos: EstadoApi) {
  revisionCarga++;
  estudiantes.splice(0, estudiantes.length, ...datos.estudiantes);
  docentes.splice(0, docentes.length, ...datos.docentes);
  asignaciones.splice(0, asignaciones.length, ...datos.asignaciones);
  matriculas.splice(0, matriculas.length, ...datos.matriculas);
  horariosAcademicos.splice(0, horariosAcademicos.length, ...datos.horarios);
  establecerSemestreActual(datos.semestreId);
  if (datos.sistema) aplicarDatosSistema(datos.sistema);
  estado = {
    datos,
    error: null,
    workspace: { registros: datos.registros, momento: datos.momento, aviso: null },
  };
  publicar();
}
export async function refrescarApi() {
  const token = getApiSession()?.accessToken;
  if (!token) return;
  const revision = ++revisionCarga;
  try {
    const datos = await apiJson<EstadoApi>('/api/tutoria/estado');
    if (getApiSession()?.accessToken !== token || revision !== revisionCarga) return;
    aplicarEstadoApi(datos);
    return datos;
  } catch (e) {
    if (getApiSession()?.accessToken !== token || revision !== revisionCarga) return;
    const mensaje = e instanceof Error ? e.message : 'No se pudo cargar la tutoría del servidor.';
    estado = { ...estado, error: mensaje, workspace: { ...estado.workspace, aviso: mensaje } };
    publicar();
    throw e;
  }
}
function documentoAceptado(result: Instrumento) {
  revisionCarga++;
  if (!estado.datos) return;
  const registros = [...estado.datos.registros.filter((r) => r.id !== result.id), result];
  estado = {
    ...estado,
    datos: { ...estado.datos, registros },
    workspace: { ...estado.workspace, registros },
  };
  publicar();
}
function sesionAceptada(result: Sesion) {
  revisionCarga++;
  if (!estado.datos) return;
  const sesiones = [...estado.datos.sesiones.filter((s) => s.id !== result.id), result];
  const registros = [...estado.datos.registros];
  estado = {
    ...estado,
    datos: { ...estado.datos, sesiones, registros },
    workspace: { ...estado.workspace, registros },
  };
  publicar();
}
// La escritura ya fue confirmada. Un fallo posterior al recargar la bandeja se
// comunica como falta de actualización; no se presenta como un guardado fallido.
async function actualizarTrasEscritura() {
  revisionCarga++;
  await refrescarApi().catch(() => undefined);
}
export async function crearFormularioApi(formato: CodigoFormato, estudianteId?: string | null) {
  const result = await apiJson<Instrumento>('/api/formularios', 'POST', {
    formato,
    estudianteId: estudianteId ?? null,
  });
  documentoAceptado(result);
  await actualizarTrasEscritura();
  return result;
}
export async function guardarFormularioApi(
  registro: Instrumento,
  respuestas: Record<string, string>,
  enviar: boolean,
  version: number,
) {
  const result = await apiJson<Instrumento>(
    `/api/formularios/${encodeURIComponent(registro.id)}`,
    'PUT',
    { respuestas, enviar, version },
  );
  documentoAceptado(result);
  await actualizarTrasEscritura();
  return result;
}
export async function revisarFormularioApi(
  registro: Instrumento,
  decision: string,
  comentario: string,
) {
  const result = await apiJson<Instrumento>(
    `/api/formularios/${encodeURIComponent(registro.id)}/revision`,
    'POST',
    { version: registro.version, decision, comentario },
  );
  documentoAceptado(result);
  await actualizarTrasEscritura();
}
export async function programarSesionApi(input: ProgramacionSesion) {
  const result = await apiJson<Sesion>('/api/sesiones', 'POST', input);
  sesionAceptada(result);
  await actualizarTrasEscritura();
  return result;
}
export async function guardarAsistenciaApi(
  sesion: Sesion,
  asistentes: Sesion['asistentes'],
  mensaje: string,
  tipoTutoria = 'Académica',
) {
  const result = await apiJson<Sesion>(
    `/api/sesiones/${encodeURIComponent(sesion.id)}/asistencia`,
    'PUT',
    { version: sesion.version, asistentes, mensaje, tipoTutoria },
  );
  sesionAceptada(result);
  await actualizarTrasEscritura();
  return result;
}
export async function cambiarMomentoApi(momento: MomentoTutoria) {
  await apiJson('/api/tutoria/periodo', 'PUT', { version: estado.datos?.periodoVersion, momento });
  await actualizarTrasEscritura();
}
export async function asignarTutorApi(input: {
  estudianteId: string;
  tutorId: string;
  grupo: string | null;
  referencia: string;
  version?: number;
}) {
  await apiJson('/api/tutoria/asignaciones', 'POST', input);
  await actualizarTrasEscritura();
}
