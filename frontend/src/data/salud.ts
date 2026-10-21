import type {
  AfiliacionSis,
  ApoyoComunicable,
  AtencionSalud,
  BeneficioSocial,
  CampanaSalud,
} from '../types/domain';
import { FECHA_CORTE_ACADEMICA } from './academico';
import { estudiantes } from './personas';

/**
 * Seguimiento de salud y bienestar con datos ficticios.
 *
 * El sistema conserva únicamente lo que la solicitud 07_Medicina_Salud y
 * 06_Bienestar_Servicio_Social describen como comunicable: el estado
 * administrativo de la atención y la recomendación funcional para los
 * estudios. No hay diagnósticos, historias clínicas, recetas ni análisis.
 */

function semilla(texto: string): number {
  let valor = 2166136261;
  for (let i = 0; i < texto.length; i += 1) {
    valor ^= texto.charCodeAt(i);
    valor = Math.imul(valor, 16777619);
  }
  return Math.abs(valor);
}

const MOTIVOS_CONSULTA = [
  'Control general y consejería en salud',
  'Malestar estomacal recurrente',
  'Cefalea tensional asociada al estudio',
  'Control de tratamiento preventivo',
  'Evaluación por fatiga y sueño insuficiente',
  'Consejería en alimentación y descanso',
];

const RECOMENDACIONES = [
  'Se recomienda flexibilidad en la entrega de trabajos durante el periodo de tratamiento.',
  'Se sugiere evitar la exposición prolongada a pantallas y fraccionar las sesiones de estudio.',
  'Se recomienda justificar inasistencias por atención médica y reprogramar evaluaciones.',
  'Se sugiere mantener una rutina de descanso y actividad física moderada.',
  null,
];

const PROFESIONALES = [
  'Dra. Carmen Ríos Valverde',
  'Lic. Rosa Paredes Auqui',
  'Ps. Jorge Bermúdez Salas',
  'Lic. Milagros Huamán Ríos',
];

const SERVICIOS: AtencionSalud['servicio'][] = [
  'medicina',
  'enfermeria',
  'medicina',
  'psicologia',
  'medicina',
  'topico',
];

export const atencionesSalud: AtencionSalud[] = [];

estudiantes.forEach((estudiante, indice) => {
  const seed = semilla(`salud${estudiante.codigo}`);
  // Un tercio de los estudiantes tiene al menos una atención registrada.
  if ((seed + indice) % 3 !== 0) return;
  const cantidad = (seed % 2) + 1;
  for (let i = 0; i < cantidad; i += 1) {
    const pos = (seed + i * 7) % MOTIVOS_CONSULTA.length;
    const servicio = SERVICIOS[pos] ?? 'medicina';
    const dia = 15 + ((seed + i * 3) % 14);
    const estado: AtencionSalud['estado'] =
      i === 0 && seed % 4 === 0 ? 'programada' : seed % 11 === 0 ? 'no-asistio' : 'atendida';
    const recomendacion = estado === 'atendida' ? (RECOMENDACIONES[pos] ?? null) : null;
    atencionesSalud.push({
      id: `ATN-${estudiante.codigo}-${i + 1}`,
      estudianteId: estudiante.id,
      servicio,
      fecha: estado === 'programada' ? '2026-10-22' : `2026-10-${String(dia).padStart(2, '0')}`,
      hora: `${String(9 + (pos % 6)).padStart(2, '0')}:${pos % 2 === 0 ? '00' : '30'}`,
      motivo: MOTIVOS_CONSULTA[pos] ?? MOTIVOS_CONSULTA[0]!,
      profesional: PROFESIONALES[pos % PROFESIONALES.length] ?? PROFESIONALES[0]!,
      tipo: 'consulta',
      estado,
      recomendacionAcademica: recomendacion,
      vigenciaRecomendacion: recomendacion ? '2026-12-31' : null,
      confidencial: true,
    });
  }
});

const ESTADOS_SIS: AfiliacionSis['estado'][] = ['vigente', 'vigente', 'en-tramite', 'no-vigente'];

export const afiliacionesSis: AfiliacionSis[] = estudiantes.map((estudiante, indice) => {
  const seed = semilla(`sis${estudiante.codigo}`);
  return {
    estudianteId: estudiante.id,
    estado: ESTADOS_SIS[(seed + indice) % ESTADOS_SIS.length] ?? 'vigente',
    fechaCorte: FECHA_CORTE_ACADEMICA,
    nota: 'Requisito del usuario · pendiente de la API institucional. No forma parte de la Resolución N.º 500-2022-CU-R-UNAS.',
  };
});

export const campanasSalud: CampanaSalud[] = [
  {
    id: 'CAMP-01',
    tema: 'Jornada de salud preventiva: control de presión y glucosa',
    fecha: '2026-10-21',
    hora: '09:00',
    canal: 'Presencial',
    lugar: 'Explanada del Pabellón Central',
    escuelas: ['E-IIS', 'E-ADM', 'E-CON'],
    cupos: 120,
    inscritos: 86,
  },
  {
    id: 'CAMP-02',
    tema: 'Charla: manejo del estrés en época de exámenes',
    fecha: '2026-10-28',
    hora: '16:00',
    canal: 'Virtual',
    lugar: 'Sala institucional UNAS',
    escuelas: ['E-IIS', 'E-ECO', 'E-AGR', 'E-FOR', 'E-ZOO', 'E-BIO'],
    cupos: 200,
    inscritos: 143,
  },
  {
    id: 'CAMP-03',
    tema: 'Campaña de vacunación e inmunización',
    fecha: '2026-11-05',
    hora: '08:30',
    canal: 'Presencial',
    lugar: 'Tópico de Bienestar Universitario',
    escuelas: ['E-IIS', 'E-ADM', 'E-CON', 'E-ECO', 'E-AGR', 'E-FOR', 'E-ZOO', 'E-BIO'],
    cupos: 300,
    inscritos: 112,
  },
  {
    id: 'CAMP-04',
    tema: 'Taller de primeros auxilios para delegados de aula',
    fecha: '2026-11-12',
    hora: '15:00',
    canal: 'Presencial',
    lugar: 'Auditorio de Bienestar Universitario',
    escuelas: ['E-IIS', 'E-ADM'],
    cupos: 60,
    inscritos: 41,
  },
];

export const beneficiosSociales: BeneficioSocial[] = estudiantes
  .map((estudiante, indice) => {
    const seed = semilla(`beneficio${estudiante.codigo}`);
    if ((seed + indice) % 4 !== 0) return null;
    const tipos: BeneficioSocial['tipo'][] = [
      'comedor',
      'residencia',
      'beca',
      'movilidad',
      'materiales',
    ];
    const estados: BeneficioSocial['estado'][] = [
      'activo',
      'activo',
      'en-evaluacion',
      'suspendido',
      'finalizado',
    ];
    const tipo = tipos[seed % tipos.length] ?? 'comedor';
    const estado = estados[(seed + indice) % estados.length] ?? 'activo';
    return {
      id: `BEN-${estudiante.codigo}`,
      estudianteId: estudiante.id,
      tipo,
      estado,
      inicio: '2026-09-07',
      fin: estado === 'finalizado' ? '2026-10-01' : null,
      fuente: 'Área de Servicio Social · concesión del semestre 2026-II (dato de demostración)',
    };
  })
  .filter((beneficio): beneficio is BeneficioSocial => beneficio !== null);

export const apoyosComunicables: ApoyoComunicable[] = atencionesSalud
  .filter((atencion) => atencion.recomendacionAcademica !== null && atencion.estado === 'atendida')
  .map((atencion, indice) => ({
    id: `APO-${indice + 1}`,
    estudianteId: atencion.estudianteId,
    area: atencion.servicio === 'psicologia' ? 'psicologia' : 'medicina',
    necesidad: atencion.motivo,
    apoyoRecomendado: atencion.recomendacionAcademica ?? '',
    prioridad: indice % 3 === 0 ? 'alta' : indice % 3 === 1 ? 'media' : 'baja',
    fecha: atencion.fecha,
    vigencia: atencion.vigenciaRecomendacion ?? '2026-12-31',
    autorizadoPor: `${atencion.profesional} · autorización de comunicación al tutor`,
  }));

/* ==========================================================================
   Selectores
   ========================================================================== */

export function atencionesDe(estudianteId: string): AtencionSalud[] {
  return atencionesSalud.filter((atencion) => atencion.estudianteId === estudianteId);
}

export function beneficiosDe(estudianteId: string): BeneficioSocial[] {
  return beneficiosSociales.filter((beneficio) => beneficio.estudianteId === estudianteId);
}

export function apoyosDe(estudianteId: string): ApoyoComunicable[] {
  return apoyosComunicables.filter((apoyo) => apoyo.estudianteId === estudianteId);
}

export function afiliacionSisDe(estudianteId: string): AfiliacionSis | undefined {
  return afiliacionesSis.find((afiliacion) => afiliacion.estudianteId === estudianteId);
}

/** Sede de la fecha de corte usada en los encabezados de datos de salud. */
export const FECHA_CORTE_SALUD = FECHA_CORTE_ACADEMICA;

export const etiquetaServicio: Record<AtencionSalud['servicio'], string> = {
  medicina: 'Medicina',
  enfermeria: 'Enfermería',
  topico: 'Tópico',
  psicologia: 'Psicología',
  psicopedagogia: 'Psicopedagogía',
  'servicio-social': 'Servicio Social',
  comedor: 'Comedor',
  residencia: 'Residencia',
};

export const etiquetaAfiliacionSis: Record<AfiliacionSis['estado'], string> = {
  vigente: 'SIS vigente',
  'no-vigente': 'SIS no vigente',
  'en-tramite': 'SIS en trámite',
};

export const etiquetaBeneficio: Record<BeneficioSocial['tipo'], string> = {
  comedor: 'Comedor universitario',
  residencia: 'Residencia estudiantil',
  beca: 'Beca',
  movilidad: 'Movilidad',
  materiales: 'Materiales de estudio',
};
