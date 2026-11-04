import type { DemoUser } from '../types/auth';
import type { Instrumento, Sesion } from '../types/domain';
import { API_MODE } from './apiConfig';
import { guardarInstrumento, revisarInstrumento } from './instrumentWorkspace';
import { guardarAsistencia } from './sessionAttendance';
import { programarSesion } from './sessionWorkspace';
import type { ProgramacionSesion } from './sessionWorkspace';
import {
  guardarFormularioApi,
  revisarFormularioApi,
  guardarAsistenciaApi,
  programarSesionApi,
} from './apiTutoria';

export async function persistirFormulario(
  registro: Instrumento,
  respuestas: Record<string, string>,
  usuario: DemoUser,
  enviar = false,
  version = registro.version,
) {
  return API_MODE
    ? guardarFormularioApi(registro, respuestas, enviar, version)
    : guardarInstrumento(registro, respuestas, usuario, enviar);
}
export async function persistirRevision(
  registro: Instrumento,
  usuario: DemoUser,
  decision: 'aprobado' | 'observado',
  comentario: string,
) {
  if (API_MODE) await revisarFormularioApi(registro, decision, comentario);
  else revisarInstrumento(registro.id, usuario, decision, comentario);
}
export async function persistirProgramacion(
  usuario: DemoUser,
  entrada: ProgramacionSesion,
  registros: Instrumento[],
) {
  return API_MODE ? programarSesionApi(entrada) : programarSesion(usuario, entrada, registros);
}
export async function persistirAsistencia(
  usuario: DemoUser,
  sesion: Sesion,
  asistentes: Sesion['asistentes'],
  mensaje: string,
  tipoTutoria: string,
) {
  if (API_MODE) await guardarAsistenciaApi(sesion, asistentes, mensaje, tipoTutoria);
  else guardarAsistencia(usuario, sesion, asistentes, mensaje);
}
