import { useMemo } from 'react';
import { useAuth } from './useAuth';
import { useSessionAttendance } from './useSessionAttendance';
import { aplicarRegistro } from '../services/sessionAttendance';
import { useInstrumentWorkspace } from './useInstrumentWorkspace';
import { puedeEnviarFormato } from '../utils/instrumentos';
import {
  derivacionesDesdeInstrumentos,
  sesionesDesdeInstrumentos,
} from '../utils/seguimientoInstrumentos';
import type {
  Asignacion,
  Derivacion,
  Docente,
  Estudiante,
  Instrumento,
  Sesion,
} from '../types/domain';
import type { Contadores } from '../data';
import {
  asignacionDe,
  definicionPorCodigo,
  derivacionesDe,
  derivacionesDeTutor,
  docentePorId,
  docentePorId as docente,
  estudiantes,
  estudiantePorId,
  notificaciones,
  sesionesDeEstudiante,
  sesionesDeTutor,
  tutoradosDe,
  asignaciones as todasAsignaciones,
  sesiones as todasSesiones,
  derivaciones as todasDerivaciones,
} from '../data';

const ESTADOS_ABIERTOS: Derivacion['estado'][] = [
  'registrada',
  'recibida',
  'citada',
  'en-atencion',
  'seguimiento',
  'no-presentado',
];

const ESTADOS_PENDIENTES: Instrumento['estado'][] = ['no-iniciado', 'borrador', 'observado'];

export interface Portal {
  /** Entidades resueltas para el usuario de la sesión. */
  estudiante: Estudiante | null;
  docente: Docente | null;
  asignacion: Asignacion | null;
  tutor: Docente | null;
  /** Alcance de datos según el rol. */
  tutorados: Asignacion[];
  sesiones: Sesion[];
  instrumentos: Instrumento[];
  derivaciones: Derivacion[];
  contadores: Contadores;
  /** Ámbito institucional: escuela del estudiante o del tutor. */
  escuelaId: string;
  avisosSinLeer: number;
}

/**
 * Resuelve la sesión de demostración en entidades del dominio y calcula el
 * alcance de datos y los contadores que muestra la barra lateral.
 */
export function usePortal(): Portal {
  const { user } = useAuth();
  const role = user?.role ?? 'estudiante';
  const userId = user?.id ?? '';
  const { registros: todosInstrumentos, momento } = useInstrumentWorkspace();
  const registrosAsistencia = useSessionAttendance();

  return useMemo<Portal>(() => {
    let estudiante: Estudiante | null = null;
    let doc: Docente | null = null;
    let asignacion: Asignacion | null = null;
    let tutorados: Asignacion[] = [];
    let sesiones: Sesion[] = [];
    let instrumentos: Instrumento[] = [];
    let derivaciones: Derivacion[] = [];

    if (role === 'estudiante') {
      estudiante = estudiantePorId(userId) ?? estudiantes[0] ?? null;
      if (estudiante) {
        asignacion = asignacionDe(estudiante.id) ?? null;
        sesiones = sesionesDeEstudiante(estudiante.id);
        // El tutorado solo responde los instrumentos cuyo actor es él mismo
        // (entrevistas 03, 04 o 05 y evaluaciones 10 y 11). Los formatos que
        // llena el docente tutor pertenecen a su bandeja, no a la del tutorado.
        instrumentos = todosInstrumentos
          .filter((item) => item.estudianteId === estudiante!.id)
          .filter((instrumento) => definicionPorCodigo(instrumento.formato)?.actor === 'tutorado');
        derivaciones = derivacionesDe(estudiante.id);
      }
    } else if (role === 'tutor') {
      doc = docente(userId) ?? null;
      if (doc) {
        tutorados = tutoradosDe(doc.id);
        sesiones = sesionesDeTutor(doc.id);
        instrumentos = todosInstrumentos.filter((item) => item.tutorId === doc!.id);
        derivaciones = derivacionesDeTutor(doc.id);
      }
    } else {
      doc = docentePorId('DOC-0422') ?? null;
      tutorados = todasAsignaciones;
      sesiones = todasSesiones;
      instrumentos = todosInstrumentos;
      derivaciones = todasDerivaciones;
    }

    const extrasSesiones = sesionesDesdeInstrumentos(todosInstrumentos);
    const extrasDerivaciones = derivacionesDesdeInstrumentos(todosInstrumentos);
    sesiones = [
      ...sesiones,
      ...extrasSesiones.filter(
        (s) =>
          role === 'coordinacion' ||
          (role === 'tutor'
            ? s.tutorId === doc?.id
            : s.asistentes.some((a) => a.estudianteId === estudiante?.id)),
      ),
    ];
    sesiones = sesiones.map((sesion) => aplicarRegistro(sesion, registrosAsistencia));
    derivaciones = [
      ...derivaciones,
      ...extrasDerivaciones.filter(
        (d) =>
          role === 'coordinacion' ||
          (role === 'tutor' ? d.tutorId === doc?.id : d.estudianteId === estudiante?.id),
      ),
    ];
    const sesionesPendientes = sesiones.filter((sesion) => sesion.estado === 'programada').length;
    const instrumentosPendientes = instrumentos.filter(
      (instrumento) =>
        ESTADOS_PENDIENTES.includes(instrumento.estado) &&
        puedeEnviarFormato(instrumento.formato, momento) &&
        (role !== 'tutor' || definicionPorCodigo(instrumento.formato)?.actor === 'tutor'),
    ).length;
    const derivacionesAbiertas = derivaciones.filter((derivacion) =>
      ESTADOS_ABIERTOS.includes(derivacion.estado),
    ).length;
    const avisosSinLeer = notificaciones.filter((notificacion) => !notificacion.leida).length;
    const instrumentosObservados = instrumentos.filter(
      (instrumento) => instrumento.estado === 'observado',
    ).length;

    const tutor = asignacion ? (docentePorId(asignacion.tutorId) ?? null) : null;
    const escuelaId = estudiante?.escuelaId ?? doc?.escuelaId ?? 'E-IIS';

    return {
      estudiante,
      docente: doc,
      asignacion,
      tutor,
      tutorados,
      sesiones,
      instrumentos,
      derivaciones,
      contadores: {
        sesiones: sesionesPendientes,
        pendientes: instrumentosPendientes,
        derivaciones: derivacionesAbiertas,
        avisos: avisosSinLeer,
        observados: instrumentosObservados,
        revisiones: instrumentos.filter(
          (item) => ['F03', 'F04', 'F05'].includes(item.formato) && item.estado === 'enviado',
        ).length,
      },
      escuelaId,
      avisosSinLeer,
    };
  }, [role, userId, todosInstrumentos, momento, registrosAsistencia]);
}
