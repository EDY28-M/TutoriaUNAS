import { instrumentos } from '../data/instrumentos';
import { API_MODE } from './apiConfig';
import { definicionPorCodigo } from '../data/formatos';
import { asignaciones } from '../data/tutoria';
import { docentePorId, estudiantePorId, escuelaDe, nombreCompleto } from '../data/personas';
import type { Instrumento } from '../types/domain';
import type { DemoUser } from '../types/auth';
import {
  avanceInstrumento,
  erroresInstrumento,
  fechaTutoria,
  formatoInicial,
  puedeEnviarFormato,
  respuestasVisibles,
  filasRespuesta,
  motivoDerivacionDesdeAtencion,
  precargarInstrumentoConOrigen,
  contextualizarDefinicion,
} from '../utils/instrumentos';
import { consultarSesiones } from './sessionWorkspace';
import {
  bloqueoEvaluacion,
  esEvaluacionSesion,
  formatoDeSesion,
  idEvaluacionSesion,
} from '../utils/evaluacionesSesion';
import { recordarRespuestas } from './expediente';
import type { MomentoTutoria } from '../utils/instrumentos';

const CLAVE = 'tutoria-unas:instrument-workspace:v1';
const base: Instrumento[] = [...instrumentos];
interface EstadoWorkspace {
  registros: Instrumento[];
  momento: MomentoTutoria;
  aviso: string | null;
}
let cambios: Record<string, Instrumento> = {};
let estado: EstadoWorkspace = { registros: base, momento: 'durante', aviso: null };
const suscriptores = new Set<() => void>();
try {
  const guardado = sessionStorage.getItem(CLAVE);
  if (guardado) {
    const datos = JSON.parse(guardado) as {
      cambios?: Record<string, Instrumento>;
      momento?: MomentoTutoria;
    };
    if (
      datos.cambios &&
      Object.values(datos.cambios).every(
        (r) =>
          typeof r.id === 'string' &&
          Boolean(definicionPorCodigo(r.formato)) &&
          r.respuestas &&
          typeof r.respuestas === 'object' &&
          Array.isArray(r.observaciones),
      )
    )
      cambios = datos.cambios;
    if (['inicio', 'durante', 'cierre'].includes(datos.momento ?? ''))
      estado.momento = datos.momento!;
    estado.registros = [...base.filter((r) => !cambios[r.id]), ...Object.values(cambios)];
  }
} catch {
  estado.aviso = 'No se pudo recuperar el avance guardado en esta pestaña.';
}

function publicar() {
  let aviso: string | null = null;
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify({ cambios, momento: estado.momento }));
  } catch {
    aviso =
      'El avance está disponible mientras mantengas esta página abierta. El navegador no permite conservarlo al recargar.';
  }
  estado = {
    ...estado,
    registros: [...base.filter((r) => !cambios[r.id]), ...Object.values(cambios)],
    aviso,
  };
  suscriptores.forEach((escuchar) => escuchar());
}
export const obtenerWorkspace = () => estado;
export function suscribirWorkspace(escuchar: () => void) {
  suscriptores.add(escuchar);
  return () => {
    suscriptores.delete(escuchar);
  };
}
export function cambiarMomento(momento: MomentoTutoria) {
  if (API_MODE) throw new Error('El momento del semestre debe guardarse en el servidor.');
  estado = { ...estado, momento };
  publicar();
}

export function guardarInstrumento(
  instrumento: Instrumento,
  respuestas: Record<string, string>,
  usuario: DemoUser,
  enviar = false,
): Instrumento {
  if (API_MODE) throw new Error('El formulario debe guardarse en el servidor.');
  const existente = estado.registros.find((r) => r.id === instrumento.id);
  const registro = existente ?? instrumento;
  const definicion = definicionPorCodigo(registro.formato);
  if (!definicion) throw new Error('No se encontró el formato.');
  const estudiante = registro.estudianteId ? estudiantePorId(registro.estudianteId) : null;
  const propio =
    definicion.actor === 'tutorado'
      ? usuario.role === 'estudiante' &&
        usuario.id === registro.estudianteId &&
        (!['F03', 'F04', 'F05'].includes(registro.formato) ||
          registro.formato === formatoInicial(estudiante?.ciclo ?? 1))
      : definicion.actor === 'tutor'
        ? usuario.role === 'tutor' &&
          usuario.id === registro.tutorId &&
          (!registro.estudianteId ||
            asignaciones.some(
              (a) =>
                a.estudianteId === registro.estudianteId &&
                a.tutorId === usuario.id &&
                a.semestreId === registro.semestreId &&
                a.estado === 'activa',
            ))
        : usuario.role === 'coordinacion';
  if (!propio) {
    const esEntrevista = ['F03', 'F04', 'F05'].includes(registro.formato);
    if (esEntrevista && usuario.role === 'estudiante' && usuario.id === registro.estudianteId) {
      const etapa = formatoInicial(estudiante?.ciclo ?? 1);
      throw new Error(
        `Tu ciclo (${estudiante?.ciclo}) corresponde a la entrevista ${etapa}. No puedes responder otro formato de entrevista.`,
      );
    }
    throw new Error('Este formato corresponde a otra persona o rol.');
  }
  if (['enviado', 'aprobado'].includes(registro.estado))
    throw new Error(
      'El formulario ya fue enviado. Solo se habilita de nuevo si se solicitan correcciones.',
    );
  let respuestasSesion: Record<string, string> = {};
  if (esEvaluacionSesion(registro.formato)) {
    const sesiones = consultarSesiones(estado.registros);
    const sesion = sesiones.find((s) => s.id === registro.sesionId);
    const bloqueo = bloqueoEvaluacion(sesion, usuario.id);
    if (bloqueo) throw new Error(bloqueo);
    if (
      !sesion ||
      registro.id !== idEvaluacionSesion(sesion, usuario.id) ||
      registro.formato !== formatoDeSesion(sesion) ||
      registro.tutorId !== sesion.tutorId ||
      registro.semestreId !== sesion.semestreId
    )
      throw new Error('La evaluación debe corresponder a esta sesión, estudiante y docente tutor.');
    const { valores: contexto } = precargarInstrumentoConOrigen(
      { ...registro, respuestas: {} },
      sesiones,
      estado.registros,
    );
    respuestasSesion = Object.fromEntries(
      ['fecha', 'grupo', 'turno', 'nombreTutor'].map((campo) => [campo, contexto[campo] ?? '']),
    );
  }
  if (enviar && !puedeEnviarFormato(registro.formato, estado.momento))
    throw new Error('Este formato se envía al finalizar el semestre. Puedes guardar un borrador.');
  const contexto = contextualizarDefinicion(definicion, registro);
  const valores = respuestasVisibles(contexto, { ...respuestas, ...respuestasSesion });
  if (enviar && Object.keys(erroresInstrumento(contexto, valores)).length)
    throw new Error('Revisa las preguntas señaladas antes de enviar.');
  let asistentesIds: string[] = [];
  if (['F06', 'F07'].includes(registro.formato)) {
    asistentesIds = filasRespuesta(valores.asistentes ?? '').map((fila) => {
      const asignacion = asignaciones.find((a) => {
        const e = estudiantePorId(a.estudianteId);
        return (
          a.tutorId === usuario.id &&
          a.estado === 'activa' &&
          a.semestreId === registro.semestreId &&
          e &&
          nombreCompleto(e) === fila.nombre
        );
      });
      return asignacion?.estudianteId ?? '';
    });
    if (
      enviar &&
      (asistentesIds.some((id) => !id) || new Set(asistentesIds).size !== asistentesIds.length)
    )
      throw new Error(
        'Selecciona estudiantes de tu grupo y evita repetir a la misma persona en la asistencia.',
      );
  }
  const actualizado: Instrumento = {
    ...registro,
    estudianteId:
      registro.formato === 'F06'
        ? asistentesIds.length === 1
          ? asistentesIds[0] || null
          : null
        : registro.estudianteId,
    respuestas:
      registro.formato === 'F01'
        ? { ...valores, escuela: registro.respuestas.escuela ?? '' }
        : valores,
    estado: enviar ? 'enviado' : registro.estado === 'observado' ? 'observado' : 'borrador',
    avance: avanceInstrumento(contexto, valores),
    actualizado: fechaTutoria(),
    enviado: enviar ? fechaTutoria() : null,
    version: registro.version + 1,
    observaciones: enviar
      ? registro.observaciones.map((o) => ({ ...o, estado: 'subsanada' }))
      : registro.observaciones,
  };
  if (enviar && registro.formato === 'F08' && valores.resultado === 'Se deriva a:') {
    const id = `INST-F12-desde-${registro.id}`;
    if (!estado.registros.some((r) => r.id === id)) {
      const docente = docentePorId(registro.tutorId);
      const motivo = motivoDerivacionDesdeAtencion(valores.motivo ?? '');
      const contacto = estado.registros
        .filter(
          (r) =>
            r.estudianteId === registro.estudianteId &&
            r.semestreId === registro.semestreId &&
            ['F03', 'F04', 'F05'].includes(r.formato) &&
            ['enviado', 'aprobado'].includes(r.estado),
        )
        .sort((a, b) => a.actualizado.localeCompare(b.actualizado) || a.version - b.version)
        .at(-1)?.respuestas;
      const respuestasDerivacion: Record<string, string> = {
        fecha: valores.fecha ?? fechaTutoria(),
        nombreEstudiante: estudiante ? nombreCompleto(estudiante) : '',
        codigo: estudiante?.codigo ?? '',
        escuela: estudiante ? escuelaDe(estudiante.escuelaId) : '',
        ciclo: estudiante ? String(estudiante.ciclo) : '',
        telefono: contacto?.telefono ?? estudiante?.telefono ?? '',
        nombreTutor: docente ? nombreCompleto(docente) : '',
        telefonoTutor: docente?.telefono ?? '',
        area: valores.areaDerivacion ?? '',
        motivo,
        motivo__otro:
          motivo === 'Otro'
            ? valores.motivo === 'Otro'
              ? (valores.motivo__otro ?? '')
              : (valores.motivo ?? '')
            : '',
        detalle: valores.detalleMotivo ?? '',
      };
      const definicionF12 = definicionPorCodigo('F12');
      cambios = {
        ...cambios,
        [id]: {
          ...registro,
          id,
          formato: 'F12',
          estado: 'borrador',
          avance: definicionF12 ? avanceInstrumento(definicionF12, respuestasDerivacion) : 0,
          respuestas: respuestasDerivacion,
          enviado: null,
          observaciones: [],
        },
      };
    }
  }
  // Solo una operación aceptada puede cambiar la fuente compartida.
  recordarRespuestas(actualizado, valores);
  cambios = { ...cambios, [actualizado.id]: actualizado };
  publicar();
  return actualizado;
}
export function revisarInstrumento(
  id: string,
  usuario: DemoUser,
  decision: 'aprobado' | 'observado',
  comentario: string,
): void {
  if (API_MODE) throw new Error('La revisión debe guardarse en el servidor.');
  const registro = estado.registros.find((r) => r.id === id);
  if (!registro || registro.estado !== 'enviado')
    throw new Error('Solo se revisan formularios enviados.');
  const definicion = definicionPorCodigo(registro.formato)!;
  const autorizado =
    definicion.actor === 'tutorado'
      ? usuario.role === 'tutor' &&
        registro.tutorId === usuario.id &&
        ['F03', 'F04', 'F05'].includes(registro.formato)
      : usuario.role === 'coordinacion';
  if (!autorizado) throw new Error('La revisión de este formato corresponde a otro responsable.');
  if (decision === 'observado' && !comentario.trim())
    throw new Error('Indica qué debe corregirse.');
  const actualizado: Instrumento = {
    ...registro,
    estado: decision,
    actualizado: fechaTutoria(),
    revisadoPor: usuario.name,
    version: registro.version + 1,
    observaciones:
      decision === 'observado'
        ? [
            ...registro.observaciones,
            {
              id: `OBS-${Date.now()}`,
              autor: usuario.name,
              fecha: fechaTutoria(),
              texto: comentario.trim(),
              estado: 'abierta',
            },
          ]
        : registro.observaciones.map((o) => ({ ...o, estado: 'subsanada' })),
  };
  cambios = { ...cambios, [id]: actualizado };
  publicar();
}
