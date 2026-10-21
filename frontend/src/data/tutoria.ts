import type { Acuerdo, ActividadPlan, Asignacion, BloqueTutoria, Sesion } from '../types/domain';
import { escuelas, semestreActual } from './catalogos';
import { docentes, estudiantes } from './personas';

/**
 * Asignaciones, horarios de atención y sesiones de tutoría de demostración.
 * El aforo, los criterios de asignación y las modalidades siguen lo que las
 * actas del 6 y 7 de octubre de 2026 dejaron planteado para validación.
 */

export const HOY = '2026-10-14';

/** Tutor responsable por escuela, según la afinidad de curso registrada. */
const tutorPorEscuela: Record<string, string> = {
  'E-IIS': 'DOC-0421',
  'E-ADM': 'DOC-0423',
  'E-CON': 'DOC-0425',
  'E-ECO': 'DOC-0426',
  'E-AGR': 'DOC-0427',
  'E-FOR': 'DOC-0428',
  'E-ZOO': 'DOC-0429',
  'E-BIO': 'DOC-0430',
};

function semilla(texto: string): number {
  let valor = 2166136261;
  for (let i = 0; i < texto.length; i += 1) {
    valor ^= texto.charCodeAt(i);
    valor = Math.imul(valor, 16777619);
  }
  return Math.abs(valor);
}

export const asignaciones: Asignacion[] = estudiantes.map((estudiante, indice) => {
  const tutorId = tutorPorEscuela[estudiante.escuelaId] ?? 'DOC-0421';
  const seed = semilla(estudiante.codigo);
  return {
    id: `ASG-${estudiante.codigo}`,
    estudianteId: estudiante.id,
    tutorId,
    semestreId: semestreActual,
    escuelaId: estudiante.escuelaId,
    grupo: `G-${estudiante.escuelaId.replace('E-', '')}-${(seed % 4) + 1}`,
    fechaInicio: '2026-09-07',
    fechaFin: null,
    estado: 'activa',
    criterio: indice % 5 === 0 ? 'afinidad de curso' : 'asignación directiva',
    referenciaAprobacion: `Acta de asignación tutorial ${estudiante.escuelaId.replace('E-', '')} · 2026-II`,
    historial: [
      {
        fecha: '2026-09-07',
        tutorAnteriorId: null,
        tutorNuevoId: tutorId,
        motivo: 'Asignación inicial del semestre 2026-II',
        responsable: 'Comisión de tutoría de la escuela',
      },
    ],
  };
});

/** Horarios de atención publicados por cada tutor. */
export const bloquesTutoria: BloqueTutoria[] = [
  {
    id: 'BT-0421-1',
    tutorId: 'DOC-0421',
    semana: 'Lun–Vie',
    dia: 2,
    horaInicio: '16:00',
    horaFin: '18:00',
    modalidad: 'presencial',
    lugar: 'Cubículo 12 · Pabellón B',
    vigenciaInicio: '2026-09-07',
    vigenciaFin: null,
    cupos: 6,
  },
  {
    id: 'BT-0421-2',
    tutorId: 'DOC-0421',
    semana: 'Lun–Vie',
    dia: 4,
    horaInicio: '15:00',
    horaFin: '17:00',
    modalidad: 'virtual',
    lugar: 'Sala institucional UNAS-Tutoría',
    vigenciaInicio: '2026-09-07',
    vigenciaFin: null,
    cupos: 8,
  },
  {
    id: 'BT-0422-1',
    tutorId: 'DOC-0422',
    semana: 'Lun–Vie',
    dia: 1,
    horaInicio: '15:00',
    horaFin: '17:00',
    modalidad: 'presencial',
    lugar: 'Cubículo 14 · Pabellón B',
    vigenciaInicio: '2026-09-07',
    vigenciaFin: null,
    cupos: 6,
  },
  {
    id: 'BT-0423-1',
    tutorId: 'DOC-0423',
    semana: 'Lun–Vie',
    dia: 3,
    horaInicio: '16:00',
    horaFin: '18:00',
    modalidad: 'presencial',
    lugar: 'Cubículo 08 · Pabellón A',
    vigenciaInicio: '2026-09-07',
    vigenciaFin: null,
    cupos: 8,
  },
  {
    id: 'BT-0425-1',
    tutorId: 'DOC-0425',
    semana: 'Lun–Vie',
    dia: 2,
    horaInicio: '17:00',
    horaFin: '19:00',
    modalidad: 'mixta',
    lugar: 'Cubículo 05 · Pabellón A',
    vigenciaInicio: '2026-09-07',
    vigenciaFin: null,
    cupos: 8,
  },
  {
    id: 'BT-0426-1',
    tutorId: 'DOC-0426',
    semana: 'Lun–Vie',
    dia: 5,
    horaInicio: '15:00',
    horaFin: '17:00',
    modalidad: 'presencial',
    lugar: 'Cubículo 03 · Pabellón A',
    vigenciaInicio: '2026-09-07',
    vigenciaFin: null,
    cupos: 6,
  },
  {
    id: 'BT-0427-1',
    tutorId: 'DOC-0427',
    semana: 'Lun–Vie',
    dia: 1,
    horaInicio: '17:00',
    horaFin: '19:00',
    modalidad: 'presencial',
    lugar: 'Cubículo 21 · Pabellón D',
    vigenciaInicio: '2026-09-07',
    vigenciaFin: null,
    cupos: 8,
  },
  {
    id: 'BT-0428-1',
    tutorId: 'DOC-0428',
    semana: 'Lun–Vie',
    dia: 4,
    horaInicio: '16:00',
    horaFin: '18:00',
    modalidad: 'presencial',
    lugar: 'Cubículo 30 · Pabellón D',
    vigenciaInicio: '2026-09-07',
    vigenciaFin: null,
    cupos: 6,
  },
  {
    id: 'BT-0429-1',
    tutorId: 'DOC-0429',
    semana: 'Lun–Vie',
    dia: 3,
    horaInicio: '15:00',
    horaFin: '17:00',
    modalidad: 'presencial',
    lugar: 'Cubículo 17 · Pabellón E',
    vigenciaInicio: '2026-09-07',
    vigenciaFin: null,
    cupos: 8,
  },
  {
    id: 'BT-0430-1',
    tutorId: 'DOC-0430',
    semana: 'Lun–Vie',
    dia: 2,
    horaInicio: '15:00',
    horaFin: '17:00',
    modalidad: 'presencial',
    lugar: 'Cubículo 22 · Pabellón F',
    vigenciaInicio: '2026-09-07',
    vigenciaFin: null,
    cupos: 6,
  },
];

const TEMAS_INDIVIDUALES = [
  'Adaptación al semestre y organización del tiempo',
  'Dificultades en Base de Datos I',
  'Estrategias de estudio para evaluaciones parciales',
  'Revisión del avance curricular',
  'Orientación para prácticas preprofesionales',
  'Seguimiento de curso en riesgo',
  'Hábitos de estudio y carga académica',
  'Orientación vocacional y proyección profesional',
];

const TEMAS_GRUPALES = [
  'Taller: técnicas de estudio y gestión del tiempo',
  'Charla: uso responsable de la información académica',
  'Taller: preparación para el examen parcial',
  'Charla: servicios de Bienestar Universitario',
  'Taller: elaboración del plan de vida y carrera',
];

function acuerdoPara(seed: number, sesionId: string): Acuerdo[] {
  const plantillas: Array<[string, Acuerdo['responsable']]> = [
    ['Elaborar un horario semanal de estudio y compartirlo con el tutor.', 'tutorado'],
    ['Asistir a la asesoría académica del curso en riesgo.', 'tutorado'],
    ['Coordinar una nueva sesión de seguimiento en dos semanas.', 'ambos'],
    ['Revisar el sílabo y priorizar los temas con mayor peso en la evaluación.', 'tutorado'],
    ['Solicitar el apoyo del servicio de Psicopedagogía.', 'tutor'],
  ];
  const cantidad = (seed % 2) + 1;
  const acuerdos: Acuerdo[] = [];
  for (let i = 0; i < cantidad; i += 1) {
    const [descripcion, responsable] = plantillas[(seed + i) % plantillas.length] ?? plantillas[0]!;
    acuerdos.push({
      id: `AC-${sesionId}-${i + 1}`,
      descripcion,
      responsable,
      fechaCompromiso: `2026-11-${String(((seed + i * 5) % 24) + 1).padStart(2, '0')}`,
      estado: seed % 3 === 0 ? 'cumplido' : seed % 3 === 1 ? 'pendiente' : 'vencido',
    });
  }
  return acuerdos;
}

export const sesiones: Sesion[] = [];

// —— Sesiones individuales por asignación ——
asignaciones.forEach((asignacion, indiceAsignacion) => {
  const seed = semilla(`sesion${asignacion.id}`);
  const historial: Array<{ fecha: string; estado: 'realizada' | 'programada' }> = [
    { fecha: '2026-09-15', estado: 'realizada' },
    { fecha: '2026-09-29', estado: 'realizada' },
    { fecha: '2026-10-13', estado: indiceAsignacion % 4 === 0 ? 'programada' : 'realizada' },
    { fecha: '2026-10-27', estado: 'programada' },
  ];
  historial.forEach((item, indice) => {
    const sesionId = `SES-${asignacion.id}-${indice + 1}`;
    const asistio = seed % 7 !== 0 ? 'asistio' : indice % 2 === 0 ? 'falto' : 'justificado';
    sesiones.push({
      id: sesionId,
      codigo: `TUT-2026II-${String(sesiones.length + 1).padStart(4, '0')}`,
      tipo: 'individual',
      tutorId: asignacion.tutorId,
      semestreId: semestreActual,
      fecha: item.fecha,
      horaInicio: `${String(15 + (seed % 3)).padStart(2, '0')}:00`,
      horaFin: `${String(16 + (seed % 3)).padStart(2, '0')}:00`,
      modalidad: indice % 2 === 0 ? 'presencial' : 'virtual',
      lugar:
        indice % 2 === 0 ? 'Cubículo de tutoría · Pabellón B' : 'Sala institucional UNAS-Tutoría',
      tema:
        TEMAS_INDIVIDUALES[(seed + indice) % TEMAS_INDIVIDUALES.length] ?? TEMAS_INDIVIDUALES[0]!,
      objetivo: 'Acompañar el desempeño académico y registrar los acuerdos de la sesión.',
      estado: item.estado,
      asistentes: [
        {
          estudianteId: asignacion.estudianteId,
          estado:
            item.estado === 'programada'
              ? 'asistio'
              : (asistio as 'asistio' | 'tarde' | 'falto' | 'justificado'),
          horaRegistro:
            item.estado === 'programada'
              ? null
              : `${String(15 + (seed % 3)).padStart(2, '0')}:0${(seed % 6) + 1}`,
          observacion:
            asistio === 'justificado' ? 'Presentó constancia del servicio de salud.' : null,
        },
      ],
      acuerdos: item.estado === 'realizada' ? acuerdoPara(seed + indice, sesionId) : [],
      instrumentoId: item.estado === 'realizada' ? `INST-F06-${asignacion.id}-${indice + 1}` : null,
      observacion: null,
    });
  });
});

// —— Sesiones grupales por escuela ——
escuelas.forEach((escuela, indiceEscuela) => {
  const tutorId = tutorPorEscuela[escuela.id] ?? 'DOC-0421';
  const integrantes = asignaciones.filter((asignacion) => asignacion.escuelaId === escuela.id);
  if (!integrantes.length) return;
  const fechas = ['2026-09-22', '2026-10-06', '2026-10-20'];
  fechas.forEach((fecha, indice) => {
    const seed = semilla(`${escuela.id}grupal${indice}`);
    const sesionId = `SESG-${escuela.id}-${indice + 1}`;
    const realizada = indice < 2;
    sesiones.push({
      id: sesionId,
      codigo: `TUT-2026II-G${String(indiceEscuela * 3 + indice + 1).padStart(3, '0')}`,
      tipo: 'grupal',
      tutorId,
      semestreId: semestreActual,
      fecha,
      horaInicio: '17:00',
      horaFin: '18:30',
      modalidad: indice % 2 === 0 ? 'presencial' : 'virtual',
      lugar:
        indice % 2 === 0 ? `Aula magna ${escuela.abreviatura}` : 'Sala institucional UNAS-Tutoría',
      tema: TEMAS_GRUPALES[(seed + indice) % TEMAS_GRUPALES.length] ?? TEMAS_GRUPALES[0]!,
      objetivo: 'Desarrollar actividades grupales de orientación y registrar la asistencia.',
      estado: realizada ? 'realizada' : 'programada',
      asistentes: integrantes.map((asignacion, posicion) => ({
        estudianteId: asignacion.estudianteId,
        estado: realizada
          ? (seed + posicion) % 6 === 0
            ? 'falto'
            : (seed + posicion) % 9 === 0
              ? 'justificado'
              : 'asistio'
          : 'asistio',
        horaRegistro: realizada ? `17:0${((seed + posicion) % 8) + 1}` : null,
        observacion: null,
      })),
      acuerdos: realizada
        ? [
            {
              id: `AC-${sesionId}-1`,
              descripcion: 'Aplicar la técnica de estudio presentada en el taller.',
              responsable: 'tutorado',
              fechaCompromiso: '2026-11-05',
              estado: 'pendiente',
            },
          ]
        : [],
      instrumentoId: realizada ? `INST-F07-${escuela.id}-${indice + 1}` : null,
      observacion: null,
    });
  });
});

/* ==========================================================================
   Plan de acción tutorial
   ========================================================================== */

const PROBLEMATICAS: Record<string, string> = {
  'E-IIS': 'Bajo rendimiento en cursos de programación y bases de datos en el tercer ciclo.',
  'E-ADM': 'Inasistencia a las sesiones de tutoría y desorientación en la matrícula.',
  'E-CON': 'Cursos desaprobados en el primer año y riesgo de pérdida de condición de estudiante.',
  'E-ECO': 'Estudiantes que trabajan y presentan dificultades de horario para la tutoría.',
  'E-AGR': 'Repitencia en cursos de especialidad del quinto ciclo.',
  'E-FOR': 'Escasa participación en actividades grupales de tutoría.',
  'E-ZOO': 'Estudiantes con necesidades socioeconómicas que afectan la continuidad de estudios.',
  'E-BIO': 'Bajo avance en el trabajo de tesis de los ciclos finales.',
};

const ACTIVIDADES: Array<[string, string, string]> = [
  [
    'Taller de técnicas de estudio',
    '80% de los estudiantes del ciclo participan en el taller',
    'Coordinación de tutoría de la escuela',
  ],
  [
    'Jornada de orientación para la matrícula',
    '100% de ingresantes orientados antes del cierre de matrícula',
    'Tutores de la escuela',
  ],
  [
    'Feria de servicios de Bienestar Universitario',
    'Difundir los servicios de salud, psicología y servicio social',
    'Comisión de tutoría',
  ],
  [
    'Acompañamiento focalizado a estudiantes en riesgo',
    'Reducir a 10% los estudiantes con promedio menor a 12',
    'Tutor y coordinación',
  ],
];

export const actividadesPlan: ActividadPlan[] = escuelas
  .flatMap((escuela) =>
    ACTIVIDADES.map(([actividad, meta, responsable], indice): ActividadPlan => {
      const seed = semilla(`${escuela.id}plan${indice}`);
      const avance = [100, 65, 40, 15][(seed + indice) % 4] ?? 0;
      return {
        id: `PLAN-${escuela.id}-${indice + 1}`,
        semestreId: semestreActual,
        escuelaId: escuela.id,
        problematica:
          PROBLEMATICAS[escuela.id] ?? 'Problemática por definir con la comisión de tutoría.',
        objetivo: `Mejorar el acompañamiento tutorial en ${escuela.nombre}.`,
        actividad,
        meta,
        fechaInicio: `2026-09-${String(10 + indice * 3).padStart(2, '0')}`,
        fechaFin: `2026-12-${String(5 + indice * 4).padStart(2, '0')}`,
        responsable,
        evidencia:
          indice % 2 === 0 ? 'Acta y lista de asistencia' : 'Informe del tutor (formato 02)',
        avance,
        estado: avance === 100 ? 'culminada' : avance > 0 ? 'en-ejecucion' : 'planificada',
        aprobacion: `Resolución de aprobación del plan tutorial ${escuela.abreviatura} · 2026-II`,
      };
    }),
  )
  .map((actividad, indice) => ({
    ...actividad,
    id: `PLAN-${actividad.escuelaId}-${(indice % ACTIVIDADES.length) + 1}`,
  }));

/* ==========================================================================
   Selectores
   ========================================================================== */

export function asignacionDe(estudianteId: string): Asignacion | undefined {
  return asignaciones.find(
    (asignacion) => asignacion.estudianteId === estudianteId && asignacion.estado === 'activa',
  );
}

export function tutoradosDe(tutorId: string): Asignacion[] {
  return asignaciones.filter(
    (asignacion) => asignacion.tutorId === tutorId && asignacion.estado === 'activa',
  );
}

export function sesionesDeTutor(tutorId: string): Sesion[] {
  return sesiones.filter((sesion) => sesion.tutorId === tutorId);
}

export function sesionesDeEstudiante(estudianteId: string): Sesion[] {
  return sesiones.filter((sesion) =>
    sesion.asistentes.some((asistente) => asistente.estudianteId === estudianteId),
  );
}

export function bloquesDeTutor(tutorId: string): BloqueTutoria[] {
  return bloquesTutoria.filter((bloque) => bloque.tutorId === tutorId);
}

export function nombreTutor(tutorId: string): string {
  const docente = docentes.find((item) => item.id === tutorId);
  return docente ? `${docente.nombres} ${docente.apellidos}` : 'Tutor por asignar';
}

export function planDeEscuela(escuelaId: string): ActividadPlan[] {
  return actividadesPlan.filter((actividad) => actividad.escuelaId === escuelaId);
}
