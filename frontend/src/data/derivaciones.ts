import type { Derivacion, EventoDerivacion, EstadoDerivacion } from '../types/domain';
import { areasDerivacion, semestreActual } from './catalogos';
import { estudiantes } from './personas';
import { asignacionDe } from './tutoria';

/**
 * Derivaciones del formato 12 y su seguimiento administrativo por área.
 * El sistema conserva el estado y la recomendación comunicable; no almacena
 * diagnósticos, historias clínicas ni detalles de atención.
 */

function semilla(texto: string): number {
  let valor = 2166136261;
  for (let i = 0; i < texto.length; i += 1) {
    valor ^= texto.charCodeAt(i);
    valor = Math.imul(valor, 16777619);
  }
  return Math.abs(valor);
}

const MOTIVOS: Array<{
  area: Derivacion['area'];
  motivo: string;
  detalle: string;
  prioridad: Derivacion['prioridad'];
  recomendacion: string | null;
}> = [
  {
    area: 'psicopedagogia',
    motivo: 'Dificultades en hábitos y técnicas de estudio',
    detalle:
      'El tutorado reporta que no logra organizar su tiempo y pierde evaluaciones por entregas tardías.',
    prioridad: 'media',
    recomendacion:
      'Priorizar el acompañamiento con un plan de estudio semanal y revisión quincenal.',
  },
  {
    area: 'psicologia',
    motivo: 'Situación socioemocional que afecta la asistencia',
    detalle:
      'El tutorado manifiesta ansiedad antes de las evaluaciones y ha faltado a dos sesiones.',
    prioridad: 'alta',
    recomendacion:
      'Se autoriza informar al tutor que el estudiante se encuentra en acompañamiento; sin detalle clínico.',
  },
  {
    area: 'medicina',
    motivo: 'Molestias recurrentes que dificultan la asistencia',
    detalle: 'El tutorado refiere dolores de cabeza frecuentes durante las clases de laboratorio.',
    prioridad: 'media',
    recomendacion:
      'Se recomienda justificar inasistencias por atención médica y reprogramar evaluaciones.',
  },
  {
    area: 'bienestar-social',
    motivo: 'Dificultad económica para la continuidad de estudios',
    detalle:
      'El tutorado reporta que la suspensión del beneficio de comedor afecta su asistencia regular.',
    prioridad: 'alta',
    recomendacion: 'Gestionar la evaluación socioeconómica para el comedor universitario.',
  },
  {
    area: 'tutoria-academica',
    motivo: 'Curso desaprobado y riesgo de repitencia',
    detalle:
      'El tutorado desaprobó Base de Datos I y requiere nivelación antes del siguiente semestre.',
    prioridad: 'media',
    recomendacion: 'Programar asesoría académica semanal con el docente del curso.',
  },
];

const ESTADOS_POR_INDICE: EstadoDerivacion[][] = [
  ['registrada', 'recibida', 'citada', 'atendida', 'cerrada'],
  ['registrada', 'recibida', 'citada', 'en-atencion', 'seguimiento'],
  ['registrada', 'recibida', 'no-presentado'],
  ['registrada'],
];

const NOTAS_ESTADO: Record<string, string> = {
  registrada: 'El docente tutor registró la ficha de derivación (formato 12).',
  recibida: 'El área confirmó la recepción de la ficha.',
  citada: 'El área programó la cita con el estudiante.',
  'en-atencion': 'El área inició la atención del caso.',
  atendida: 'El área registró la atención y la recomendación comunicable.',
  seguimiento: 'El caso continúa en seguimiento con coordinación tutorial.',
  cerrada: 'El área cerró el caso y notificó al tutor.',
  'no-presentado': 'El estudiante no asistió a la cita programada.',
};

const SIGUIENTE_ACCION: Record<string, string> = {
  registrada: 'Esperar la confirmación de recepción del área.',
  recibida: 'Esperar la programación de la cita.',
  citada: 'Recordar al estudiante la fecha de la cita.',
  'en-atencion': 'Esperar el resultado de la atención.',
  atendida: 'Revisar la recomendación y ajustar el acompañamiento.',
  seguimiento: 'Mantener el acompañamiento y revisar la próxima fecha.',
  cerrada: 'Sin acción pendiente.',
  'no-presentado': 'Coordinar una nueva cita con el área.',
};

export const derivaciones: Derivacion[] = [];

estudiantes.forEach((estudiante, indice) => {
  const asignacion = asignacionDe(estudiante.id);
  if (!asignacion) return;
  const seed = semilla(`derivacion${estudiante.codigo}`);
  // Aproximadamente un tercio de los tutorados tiene una derivación registrada.
  const tieneDerivacion =
    (seed + indice) % 3 === 0 || estudiante.alertas.some((a) => a.nivel === 'alta');
  if (!tieneDerivacion) return;
  const base = MOTIVOS[(seed + indice) % MOTIVOS.length] ?? MOTIVOS[0]!;
  const secuencia =
    ESTADOS_POR_INDICE[(seed + indice) % ESTADOS_POR_INDICE.length] ?? ESTADOS_POR_INDICE[0]!;
  const estadoActual = secuencia[secuencia.length - 1] ?? 'registrada';
  const area = areasDerivacion.find((item) => item.id === base.area) ?? areasDerivacion[0]!;
  const diaBase = 8 + (seed % 12);
  const fechas = secuencia.map(
    (_, posicion) => `2026-10-${String(Math.min(30, diaBase + posicion * 3)).padStart(2, '0')}`,
  );
  const historial: EventoDerivacion[] = secuencia.map((estado, posicion) => ({
    fecha: fechas[posicion] ?? '2026-10-08',
    estado,
    nota: NOTAS_ESTADO[estado] ?? 'Actualización del estado de la derivación.',
    responsable: posicion === 0 ? asignacion.tutorId : area.responsable,
  }));
  derivaciones.push({
    id: `DER-${estudiante.codigo}`,
    codigo: `DER-2026II-${String(derivaciones.length + 1).padStart(4, '0')}`,
    formato: 'F12',
    estudianteId: estudiante.id,
    tutorId: asignacion.tutorId,
    semestreId: semestreActual,
    area: base.area,
    motivo: base.motivo,
    detalle: base.detalle,
    prioridad: base.prioridad,
    fechaDerivacion: fechas[0] ?? '2026-10-08',
    fechaRecepcion: secuencia.includes('recibida')
      ? (fechas[secuencia.indexOf('recibida')] ?? null)
      : null,
    fechaCita: secuencia.includes('citada') ? (fechas[secuencia.indexOf('citada')] ?? null) : null,
    fechaAtencion: secuencia.includes('atendida')
      ? (fechas[secuencia.indexOf('atendida')] ?? null)
      : null,
    estado: estadoActual,
    responsableArea: area.responsable,
    siguienteAccion: SIGUIENTE_ACCION[estadoActual] ?? 'Sin acción pendiente.',
    actualizado: historial[historial.length - 1]?.fecha ?? '2026-10-08',
    recomendacionComunicable:
      estadoActual === 'atendida' || estadoActual === 'seguimiento' || estadoActual === 'cerrada'
        ? base.recomendacion
        : null,
    vigenciaRecomendacion:
      estadoActual === 'atendida' || estadoActual === 'seguimiento' ? '2026-12-31' : null,
    historial,
  });
});

export function derivacionesDe(estudianteId: string): Derivacion[] {
  return derivaciones.filter((derivacion) => derivacion.estudianteId === estudianteId);
}

export function derivacionesDeTutor(tutorId: string): Derivacion[] {
  return derivaciones.filter((derivacion) => derivacion.tutorId === tutorId);
}

export function derivacionesPorArea(area: Derivacion['area']): Derivacion[] {
  return derivaciones.filter((derivacion) => derivacion.area === area);
}

export const estadosDerivacionAbiertos: EstadoDerivacion[] = [
  'registrada',
  'recibida',
  'citada',
  'en-atencion',
  'seguimiento',
  'no-presentado',
];
