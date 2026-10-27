import type { CodigoFormato, Instrumento, ObservacionInstrumento } from '../types/domain';
import { semestreActual } from './catalogos';
import { estudiantes } from './personas';
import { asignaciones, sesiones } from './tutoria';
import { derivaciones } from './derivaciones';

/**
 * Registros de instrumentos de demostración.
 *
 * Las definiciones oficiales de los formatos viven en `formatos.ts`; aquí solo
 * se generan expedientes ficticios para poder recorrer el circuito completo de
 * borrador, envío, observación, subsanación y descarga.
 */

export {
  APROBACION_INSTRUMENTOS,
  VERSION_INSTRUMENTOS,
  VIGENCIA_INSTRUMENTOS,
  definicionPorCodigo,
  definicionesFormato,
} from './formatos';

function semilla(texto: string): number {
  let valor = 2166136261;
  for (let i = 0; i < texto.length; i += 1) {
    valor ^= texto.charCodeAt(i);
    valor = Math.imul(valor, 16777619);
  }
  return Math.abs(valor);
}

function observacionDe(seed: number, instrumentoId: string): ObservacionInstrumento[] {
  if (seed % 5 !== 0) return [];
  return [
    {
      id: `OBS-${instrumentoId}`,
      autor: 'Comisión de tutoría de la escuela',
      fecha: '2026-10-09',
      texto:
        'Precise el número de atenciones acumuladas y adjunte la evidencia de la actividad desarrollada.',
      estado: seed % 10 === 0 ? 'subsanada' : 'abierta',
    },
  ];
}

const RESPUESTAS_EJEMPLO: Record<string, string> = {
  modalidad: 'Presencial',
  lugarEstudio: 'En mi cuarto, por las noches',
  estadoSalud: 'Buena, con episodios de cansancio en época de exámenes',
  motivacion: 'Alta al inicio del semestre; baja cuando se acumulan evaluaciones',
};

export const instrumentos: Instrumento[] = [];

const FORMATO_ENTREVISTA: Record<string, CodigoFormato> = {
  ingresante: 'F03',
  intermedio: 'F04',
  final: 'F05',
};

/* —— Instrumentos del tutorado: entrevistas 03, 04 y 05 —— */
estudiantes.forEach((estudiante, indice) => {
  const asignacion = asignaciones.find((item) => item.estudianteId === estudiante.id);
  if (!asignacion) return;
  const seed = semilla(`inst${estudiante.codigo}`);
  const entrevista = FORMATO_ENTREVISTA[estudiante.etapa] ?? 'F04';
  const estados: Instrumento['estado'][] = ['aprobado', 'enviado', 'borrador', 'no-iniciado'];
  const estado = estados[(seed + indice) % estados.length] ?? 'borrador';
  const id = `INST-${entrevista}-${estudiante.codigo}`;
  instrumentos.push({
    id,
    formato: entrevista,
    semestreId: semestreActual,
    tutorId: asignacion.tutorId,
    estudianteId: estudiante.id,
    sesionId: null,
    estado,
    avance: estado === 'aprobado' || estado === 'enviado' ? 100 : estado === 'borrador' ? 55 : 0,
    version: 1,
    creado: '2026-09-10',
    actualizado: estado === 'no-iniciado' ? '2026-09-10' : `2026-10-0${(seed % 8) + 1}`,
    enviado: estado === 'enviado' || estado === 'aprobado' ? '2026-10-05' : null,
    revisadoPor: estado === 'aprobado' ? 'Coordinación de tutoría' : null,
    observaciones: observacionDe(seed, id),
    descargaDisponible: estado === 'aprobado',
    respuestas: RESPUESTAS_EJEMPLO,
  });

  // Las evaluaciones 10 y 11 se crean desde cada sesión, no desde el ciclo del estudiante.
});

/* —— Instrumentos del tutor: asistencias 06 y 07 —— */
sesiones.forEach((sesion) => {
  if (sesion.estado !== 'realizada') return;
  const codigo: CodigoFormato = sesion.tipo === 'individual' ? 'F06' : 'F07';
  const seed = semilla(sesion.id);
  const id = `INST-${codigo}-${sesion.id}`;
  const estado: Instrumento['estado'] =
    seed % 7 === 0 ? 'observado' : seed % 3 === 0 ? 'enviado' : 'aprobado';
  instrumentos.push({
    id,
    formato: codigo,
    semestreId: sesion.semestreId,
    tutorId: sesion.tutorId,
    estudianteId:
      sesion.tipo === 'individual' ? (sesion.asistentes[0]?.estudianteId ?? null) : null,
    sesionId: sesion.id,
    estado,
    avance: 100,
    version: 1,
    creado: sesion.fecha,
    actualizado: sesion.fecha,
    enviado: sesion.fecha,
    revisadoPor: estado === 'aprobado' ? 'Coordinación de tutoría' : null,
    observaciones: observacionDe(seed, id),
    descargaDisponible: true,
    respuestas: {
      tema: sesion.tema,
      modalidad:
        sesion.modalidad === 'presencial'
          ? 'Presencial'
          : sesion.modalidad === 'virtual'
            ? 'Virtual'
            : 'Mixta',
      asistentesTotal: String(
        sesion.asistentes.filter((a) => a.estado === 'asistio' || a.estado === 'tarde').length,
      ),
      tipoTutoria: 'Académica',
    },
  });
});

/* —— Atenciones personalizadas (08) —— */
asignaciones.slice(0, 14).forEach((asignacion, indice) => {
  const seed = semilla(`f08${asignacion.id}`);
  const borrador = seed % 4 === 0;
  const id = `INST-F08-${asignacion.id}`;
  instrumentos.push({
    id,
    formato: 'F08',
    semestreId: semestreActual,
    tutorId: asignacion.tutorId,
    estudianteId: asignacion.estudianteId,
    sesionId: null,
    estado: borrador ? 'borrador' : 'enviado',
    avance: borrador ? 70 : 100,
    version: 1,
    creado: `2026-10-0${(indice % 9) + 1}`,
    actualizado: `2026-10-0${(indice % 9) + 1}`,
    enviado: borrador ? null : `2026-10-0${(indice % 9) + 1}`,
    revisadoPor: null,
    observaciones: [],
    descargaDisponible: false,
    respuestas: {
      motivo: 'Dificultad para organizar el tiempo entre estudio y trabajo familiar.',
      resultado: seed % 3 === 0 ? 'Se deriva a:' : 'Se resuelve con la asesoría',
      areaDerivacion: seed % 3 === 0 ? 'Psicopedagogía' : '',
    },
  });
});

/* —— Autoevaluación del tutor (09) —— */
const TUTORES_ACTIVOS = [
  'DOC-0421',
  'DOC-0422',
  'DOC-0423',
  'DOC-0425',
  'DOC-0426',
  'DOC-0427',
  'DOC-0428',
  'DOC-0429',
  'DOC-0430',
];

TUTORES_ACTIVOS.forEach((tutorId, indice) => {
  const seed = semilla(`f09${tutorId}`);
  const sinIniciar = seed % 3 === 0;
  instrumentos.push({
    id: `INST-F09-${tutorId}`,
    formato: 'F09',
    semestreId: semestreActual,
    tutorId,
    estudianteId: null,
    sesionId: null,
    estado: sinIniciar ? 'no-iniciado' : 'borrador',
    avance: sinIniciar ? 0 : 40 + (indice % 3) * 15,
    version: 1,
    creado: '2026-09-07',
    actualizado: '2026-09-07',
    enviado: null,
    revisadoPor: null,
    observaciones: [],
    descargaDisponible: false,
    respuestas: {},
  });
});

/* —— Informe del tutor (02) —— */
TUTORES_ACTIVOS.forEach((tutorId, indice) => {
  const seed = semilla(`f02${tutorId}`);
  const estado: Instrumento['estado'] =
    indice < 4 ? 'enviado' : seed % 2 === 0 ? 'borrador' : 'no-iniciado';
  instrumentos.push({
    id: `INST-F02-${tutorId}`,
    formato: 'F02',
    semestreId: semestreActual,
    tutorId,
    estudianteId: null,
    sesionId: null,
    estado,
    avance: estado === 'enviado' ? 100 : estado === 'borrador' ? 60 : 0,
    version: 1,
    creado: '2026-09-07',
    actualizado: estado === 'no-iniciado' ? '2026-09-07' : '2026-10-12',
    enviado: estado === 'enviado' ? '2026-10-12' : null,
    revisadoPor: null,
    observaciones: [],
    descargaDisponible: estado === 'enviado',
    respuestas: {},
  });
});

/* —— Informe consolidado por escuela (01) —— */
['E-IIS', 'E-ADM', 'E-CON', 'E-ECO', 'E-AGR', 'E-FOR', 'E-ZOO', 'E-BIO'].forEach(
  (escuelaId, indice) => {
    const estado: Instrumento['estado'] = indice < 3 ? 'borrador' : 'no-iniciado';
    instrumentos.push({
      id: `INST-F01-${escuelaId}`,
      formato: 'F01',
      semestreId: semestreActual,
      tutorId: 'DOC-0422',
      estudianteId: null,
      sesionId: null,
      estado,
      avance: estado === 'borrador' ? 45 : 0,
      version: 1,
      creado: '2026-09-07',
      actualizado: estado === 'borrador' ? '2026-10-11' : '2026-09-07',
      enviado: null,
      revisadoPor: null,
      observaciones: [],
      descargaDisponible: false,
      respuestas: { escuela: escuelaId },
    });
  },
);

/* —— Fichas de derivación (12), una por cada caso del circuito de apoyo —— */
const AREAS_F12: Record<string, string> = {
  psicologia: 'Psicología',
  psicopedagogia: 'Psicopedagogía',
  medicina: 'Medicina y Salud',
  'bienestar-social': 'Bienestar y Servicio Social',
  'tutoria-academica': 'Tutoría académica',
};
derivaciones.forEach((derivacion) => {
  instrumentos.push({
    id: `INST-F12-${derivacion.id}`,
    formato: 'F12',
    semestreId: derivacion.semestreId,
    tutorId: derivacion.tutorId,
    estudianteId: derivacion.estudianteId,
    sesionId: null,
    estado: 'enviado',
    avance: 100,
    version: 1,
    creado: derivacion.fechaDerivacion,
    actualizado: derivacion.actualizado,
    enviado: derivacion.fechaDerivacion,
    revisadoPor: null,
    observaciones: [],
    descargaDisponible: false,
    respuestas: {
      fecha: derivacion.fechaDerivacion,
      ciclo: String(
        estudiantes.find((estudiante) => estudiante.id === derivacion.estudianteId)?.ciclo ?? '',
      ),
      escuela:
        estudiantes.find((estudiante) => estudiante.id === derivacion.estudianteId)?.escuelaId ??
        '',
      area: AREAS_F12[derivacion.area] ?? derivacion.area,
      motivo: derivacion.motivo,
      detalle: derivacion.detalle,
    },
  });
});

/* ==========================================================================
   Selectores
   ========================================================================== */

// Las entrevistas son borradores personales hasta el envío explícito del alumno.
// No se presentan respuestas parciales de ejemplo como entrevistas ya aprobadas.
instrumentos.forEach((registro) => {
  if (['F03', 'F04', 'F05', 'F10', 'F11'].includes(registro.formato)) {
    registro.estado = 'no-iniciado';
    registro.avance = 0;
    registro.respuestas = {};
    registro.enviado = null;
    registro.revisadoPor = null;
    registro.observaciones = [];
    registro.descargaDisponible = false;
  }
  if (registro.formato === 'F09' || registro.formato === 'F02') {
    registro.estado = 'no-iniciado';
    registro.avance = 0;
    registro.enviado = null;
    registro.descargaDisponible = false;
  }
});

export function instrumentosDe(estudianteId: string): Instrumento[] {
  return instrumentos.filter((instrumento) => instrumento.estudianteId === estudianteId);
}

export function instrumentosDeTutor(tutorId: string): Instrumento[] {
  return instrumentos.filter((instrumento) => instrumento.tutorId === tutorId);
}

export function instrumentoPorId(id: string): Instrumento | undefined {
  return instrumentos.find((instrumento) => instrumento.id === id);
}

export function instrumentosPorFormato(codigo: CodigoFormato): Instrumento[] {
  return instrumentos.filter((instrumento) => instrumento.formato === codigo);
}
