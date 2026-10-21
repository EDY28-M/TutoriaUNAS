import { instrumentos } from '../data/instrumentos';
import { definicionPorCodigo } from '../data/formatos';
import { asignaciones } from '../data/tutoria';
import { estudiantePorId, nombreCompleto } from '../data/personas';
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
} from '../utils/instrumentos';
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
  estado = { ...estado, momento };
  publicar();
}

export function guardarInstrumento(
  instrumento: Instrumento,
  respuestas: Record<string, string>,
  usuario: DemoUser,
  enviar = false,
): Instrumento {
  const definicion = definicionPorCodigo(instrumento.formato);
  if (!definicion) throw new Error('No se encontró el formato.');
  const existente = estado.registros.find((r) => r.id === instrumento.id);
  const registro = existente ?? instrumento;
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
                a.estado === 'activa',
            ))
        : usuario.role === 'coordinacion';
  if (!propio) throw new Error('Este formato corresponde a otra persona o rol.');
  if (['enviado', 'aprobado'].includes(registro.estado))
    throw new Error(
      'El formulario ya fue enviado. Solo se habilita de nuevo si se solicitan correcciones.',
    );
  if (enviar && !puedeEnviarFormato(registro.formato, estado.momento))
    throw new Error('Este formato se envía al finalizar el semestre. Puedes guardar un borrador.');
  const valores = respuestasVisibles(definicion, respuestas);
  if (enviar && Object.keys(erroresInstrumento(definicion, valores)).length)
    throw new Error('Revisa las preguntas señaladas antes de enviar.');
  let asistentesIds: string[] = [];
  if (['F06', 'F07'].includes(registro.formato)) {
    asistentesIds = filasRespuesta(valores.asistentes ?? '').map((fila) => {
      const asignacion = asignaciones.find((a) => {
        const e = estudiantePorId(a.estudianteId);
        return (
          a.tutorId === usuario.id &&
          a.estado === 'activa' &&
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
    respuestas: valores,
    estado: enviar ? 'enviado' : registro.estado === 'observado' ? 'observado' : 'borrador',
    avance: avanceInstrumento(definicion, valores),
    actualizado: fechaTutoria(),
    enviado: enviar ? fechaTutoria() : null,
    version: registro.version + 1,
    observaciones: enviar
      ? registro.observaciones.map((o) => ({ ...o, estado: 'subsanada' }))
      : registro.observaciones,
  };
  if (enviar && registro.formato === 'F08' && valores.resultado === 'Se deriva a:') {
    const id = `INST-F12-desde-${registro.id}`;
    if (!estado.registros.some((r) => r.id === id))
      cambios = {
        ...cambios,
        [id]: {
          ...registro,
          id,
          formato: 'F12',
          estado: 'borrador',
          avance: 0,
          respuestas: {
            fecha: valores.fecha ?? fechaTutoria(),
            area: valores.areaDerivacion ?? '',
            motivo: 'Otro',
            motivo__otro:
              valores.motivo === 'Otro' ? (valores.motivo__otro ?? '') : (valores.motivo ?? ''),
            detalle: valores.detalleMotivo ?? '',
          },
          enviado: null,
          observaciones: [],
        },
      };
  }
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
