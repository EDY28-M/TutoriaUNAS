import type {
  AlertaAcademica,
  Docente,
  Estudiante,
  EstadoAcademico,
  MiembroComision,
} from '../types/domain';
import { etapaDeCiclo, escuelas } from './catalogos';

/**
 * Padrón ficticio de estudiantes y docentes. La estructura replica los campos
 * que el sistema solicita a la DIAA (padrón y contacto), a Recursos Humanos
 * (padrón docente y vigencia) y a las facultades (comisiones de tutoría).
 * Ninguna persona de este archivo existe: son datos de demostración.
 */

const CREDITOS_PLAN = 210;

function correoDe(codigo: string): string {
  return `${codigo}@unas.edu.pe`;
}

function telefonoDe(seed: number): string {
  return `+51 9${String(20 + (seed % 70)).padStart(2, '0')} ${String(100000 + ((seed * 7919) % 899999)).slice(0, 3)} ${String(100 + ((seed * 104729) % 899)).slice(0, 3)}`;
}

let secuencia = 0;

function estudiante(
  codigo: string,
  apellidos: string,
  nombres: string,
  escuelaId: string,
  ciclo: number,
  promedioPonderado: number,
  creditosAprobados: number,
  estado: EstadoAcademico,
  alertas: AlertaAcademica[],
  ingreso: string,
): Estudiante {
  secuencia += 1;
  return {
    id: `EST-${codigo}`,
    codigo,
    apellidos,
    nombres,
    escuelaId,
    ciclo,
    etapa: etapaDeCiclo(ciclo),
    estado,
    correo: correoDe(codigo),
    telefono: telefonoDe(secuencia * 13 + ciclo),
    ingreso,
    promedioPonderado,
    creditosAprobados,
    creditosTotales: CREDITOS_PLAN,
    alertas,
  };
}

function alerta(
  id: string,
  tipo: AlertaAcademica['tipo'],
  nivel: AlertaAcademica['nivel'],
  detalle: string,
  detectada: string,
): AlertaAcademica {
  return { id, tipo, nivel, detalle, detectada };
}

export const estudiantes: Estudiante[] = [
  // ——— Ingeniería en Informática y Sistemas ———
  estudiante(
    '2023010456',
    'Quispe Rojas',
    'Ana Lucía',
    'E-IIS',
    3,
    15.4,
    62,
    'regular',
    [],
    '2023-03-27',
  ),
  estudiante(
    '2023010457',
    'Vásquez Paredes',
    'Diego Alonso',
    'E-IIS',
    3,
    11.8,
    48,
    'observado',
    [
      alerta(
        'AL-001',
        'riesgo-academico',
        'alta',
        'Promedio por debajo de 12 y dos cursos en riesgo.',
        '2026-10-09',
      ),
      alerta(
        'AL-002',
        'inasistencia-tutoria',
        'media',
        'No asistió a las dos últimas sesiones programadas.',
        '2026-10-12',
      ),
    ],
    '2023-03-27',
  ),
  estudiante(
    '2023010458',
    'Ríos Campos',
    'Rosa Melina',
    'E-IIS',
    5,
    16.9,
    108,
    'regular',
    [],
    '2022-03-28',
  ),
  estudiante(
    '2023010459',
    'Tuanama Fachín',
    'Luis Fernando',
    'E-IIS',
    5,
    13.2,
    96,
    'regular',
    [alerta('AL-003', 'repitencia', 'media', 'Segunda vez en Base de Datos I.', '2026-10-08')],
    '2022-03-28',
  ),
  estudiante(
    '2023010460',
    'Bardales Ruiz',
    'Katherine',
    'E-IIS',
    7,
    14.7,
    152,
    'regular',
    [],
    '2021-03-29',
  ),
  estudiante(
    '2023010461',
    'Sangama Pérez',
    'Jhonatan',
    'E-IIS',
    7,
    12.4,
    138,
    'regular',
    [
      alerta(
        'AL-004',
        'carga-creditos',
        'baja',
        'Carga de 22 créditos por encima del promedio de su ciclo.',
        '2026-10-05',
      ),
    ],
    '2021-03-29',
  ),
  estudiante(
    '2023010462',
    'Meléndez Acuña',
    'Fiorella',
    'E-IIS',
    9,
    16.1,
    186,
    'regular',
    [],
    '2020-03-30',
  ),
  estudiante(
    '2026010012',
    'Chávez Dávila',
    'María Fernanda',
    'E-IIS',
    1,
    14.2,
    0,
    'ingresante',
    [],
    '2026-03-30',
  ),
  estudiante(
    '2026010013',
    'Pinedo Salas',
    'Álvaro Jesús',
    'E-IIS',
    1,
    12.9,
    0,
    'ingresante',
    [
      alerta(
        'AL-005',
        'bienestar',
        'media',
        'Declaró dificultad de conectividad en la entrevista inicial.',
        '2026-10-06',
      ),
    ],
    '2026-03-30',
  ),

  // ——— Administración ———
  estudiante(
    '2023010470',
    'Zevallos Ibarra',
    'Carla Beatriz',
    'E-ADM',
    3,
    15.9,
    64,
    'regular',
    [],
    '2023-03-27',
  ),
  estudiante(
    '2023010471',
    'Huamán García',
    'José Carlos',
    'E-ADM',
    3,
    12.1,
    45,
    'observado',
    [
      alerta(
        'AL-006',
        'riesgo-academico',
        'media',
        'Desaprobó Contabilidad General en el semestre anterior.',
        '2026-10-07',
      ),
    ],
    '2023-03-27',
  ),
  estudiante(
    '2023010472',
    'Ayala Rengifo',
    'Melissa',
    'E-ADM',
    5,
    16.4,
    112,
    'regular',
    [],
    '2022-03-28',
  ),
  estudiante(
    '2023010473',
    'Cárdenas Pizango',
    'Bryan',
    'E-ADM',
    7,
    13.7,
    148,
    'regular',
    [],
    '2021-03-29',
  ),

  // ——— Contabilidad ———
  estudiante(
    '2023010480',
    'Flores Amasifuén',
    'Diana Carolina',
    'E-CON',
    1,
    15.1,
    20,
    'regular',
    [],
    '2026-03-30',
  ),
  estudiante(
    '2023010481',
    'Núñez Tello',
    'Pablo Andrés',
    'E-CON',
    3,
    11.4,
    42,
    'observado',
    [
      alerta(
        'AL-007',
        'riesgo-academico',
        'alta',
        'Tres cursos desaprobados en el semestre 2026-I.',
        '2026-10-10',
      ),
      alerta(
        'AL-008',
        'inasistencia-tutoria',
        'alta',
        'Sin registro de asistencia a tutoría en el semestre.',
        '2026-10-12',
      ),
    ],
    '2023-03-27',
  ),
  estudiante(
    '2023010482',
    'Ruiz Vela',
    'Sofía Alejandra',
    'E-CON',
    5,
    17.2,
    118,
    'regular',
    [],
    '2022-03-28',
  ),

  // ——— Economía ———
  estudiante(
    '2023010490',
    'Del Águila Mozombite',
    'Renzo',
    'E-ECO',
    3,
    14.6,
    58,
    'regular',
    [],
    '2023-03-27',
  ),
  estudiante(
    '2023010491',
    'Paredes Soria',
    'Lucero',
    'E-ECO',
    5,
    15.8,
    104,
    'regular',
    [
      alerta(
        'AL-009',
        'carga-creditos',
        'baja',
        'Matriculó 20 créditos y trabaja por las tardes.',
        '2026-10-04',
      ),
    ],
    '2022-03-28',
  ),

  // ——— Agronomía ———
  estudiante(
    '2023010500',
    'Sánchez Bardales',
    'Wilder',
    'E-AGR',
    3,
    13.9,
    60,
    'regular',
    [],
    '2023-03-27',
  ),
  estudiante(
    '2023010501',
    'Gonzales Fachín',
    'Elmer',
    'E-AGR',
    7,
    12.7,
    144,
    'regular',
    [
      alerta(
        'AL-010',
        'repitencia',
        'media',
        'Repite Fitopatología por segunda vez.',
        '2026-10-08',
      ),
    ],
    '2021-03-29',
  ),
  estudiante(
    '2026010020',
    'Torres Angulo',
    'Kely Yaneth',
    'E-AGR',
    1,
    14.9,
    0,
    'ingresante',
    [],
    '2026-03-30',
  ),

  // ——— Forestal ———
  estudiante(
    '2023010510',
    'Mozombite Lomas',
    'Iván',
    'E-FOR',
    3,
    15.2,
    61,
    'regular',
    [],
    '2023-03-27',
  ),
  estudiante(
    '2023010511',
    'Reátegui Pinedo',
    'Nataly',
    'E-FOR',
    5,
    16.6,
    110,
    'regular',
    [],
    '2022-03-28',
  ),

  // ——— Zootecnia ———
  estudiante(
    '2023010520',
    'Cabrera Sifuentes',
    'Marco Antonio',
    'E-ZOO',
    3,
    12.3,
    52,
    'observado',
    [
      alerta(
        'AL-011',
        'bienestar',
        'alta',
        'Beneficio de comedor suspendido; reporta dificultad alimentaria.',
        '2026-10-11',
      ),
    ],
    '2023-03-27',
  ),
  estudiante(
    '2023010521',
    'Vela Sangama',
    'Rocío del Pilar',
    'E-ZOO',
    5,
    15.5,
    106,
    'regular',
    [],
    '2022-03-28',
  ),

  // ——— Biología ———
  estudiante(
    '2023010530',
    'Amasifuén Tuanama',
    'Ángel Gabriel',
    'E-BIO',
    3,
    14.4,
    59,
    'regular',
    [],
    '2023-03-27',
  ),
  estudiante(
    '2023010531',
    'Rengifo Saldaña',
    'Brenda',
    'E-BIO',
    7,
    17.4,
    158,
    'regular',
    [],
    '2021-03-29',
  ),
  estudiante(
    '2023010532',
    'Saldaña Chujandama',
    'Elías',
    'E-BIO',
    9,
    13.1,
    176,
    'regular',
    [
      alerta(
        'AL-012',
        'riesgo-academico',
        'media',
        'Taller de Tesis I en curso con avance bajo.',
        '2026-10-09',
      ),
    ],
    '2020-03-30',
  ),
];

export const docentes: Docente[] = [
  {
    id: 'DOC-0421',
    codigo: 'DOC-0421',
    apellidos: 'Vela Ríos',
    nombres: 'Luis Alberto',
    escuelaId: 'E-IIS',
    departamento: 'Departamento Académico de Informática y Sistemas',
    categoria: 'Asociado',
    dedicacion: 'Tiempo completo',
    correo: 'lvela@unas.edu.pe',
    telefono: '+51 962 111 421',
    activo: true,
    aforoMaximo: 12,
    cursosAsignados: ['C-IIS-202', 'C-IIS-301'],
  },
  {
    id: 'DOC-0422',
    codigo: 'DOC-0422',
    apellidos: 'Paredes Auqui',
    nombres: 'Marta Elena',
    escuelaId: 'E-IIS',
    departamento: 'Departamento Académico de Informática y Sistemas',
    categoria: 'Principal',
    dedicacion: 'Dedicación exclusiva',
    correo: 'mparedes@unas.edu.pe',
    telefono: '+51 962 111 422',
    activo: true,
    aforoMaximo: 10,
    cursosAsignados: ['C-IIS-401', 'C-IIS-501'],
  },
  {
    id: 'DOC-0423',
    codigo: 'DOC-0423',
    apellidos: 'Ríos Valverde',
    nombres: 'Carmen Julia',
    escuelaId: 'E-ADM',
    departamento: 'Departamento Académico de Ciencias Económicas',
    categoria: 'Asociado',
    dedicacion: 'Tiempo completo',
    correo: 'crios@unas.edu.pe',
    telefono: '+51 962 111 423',
    activo: true,
    aforoMaximo: 14,
    cursosAsignados: ['C-ADM-201'],
  },
  {
    id: 'DOC-0424',
    codigo: 'DOC-0424',
    apellidos: 'Bermúdez Salas',
    nombres: 'Jorge Luis',
    escuelaId: 'E-ADM',
    departamento: 'Departamento Académico de Ciencias Económicas',
    categoria: 'Auxiliar',
    dedicacion: 'Tiempo completo',
    correo: 'jbermudez@unas.edu.pe',
    telefono: '+51 962 111 424',
    activo: true,
    aforoMaximo: 12,
    cursosAsignados: ['C-ADM-101'],
  },
  {
    id: 'DOC-0425',
    codigo: 'DOC-0425',
    apellidos: 'Huamán Ríos',
    nombres: 'Milagros',
    escuelaId: 'E-CON',
    departamento: 'Departamento Académico de Ciencias Contables',
    categoria: 'Asociado',
    dedicacion: 'Tiempo completo',
    correo: 'mhuaman@unas.edu.pe',
    telefono: '+51 962 111 425',
    activo: true,
    aforoMaximo: 12,
    cursosAsignados: ['C-CON-201', 'C-CON-301'],
  },
  {
    id: 'DOC-0426',
    codigo: 'DOC-0426',
    apellidos: 'Zavaleta Ruiz',
    nombres: 'Pedro Pablo',
    escuelaId: 'E-ECO',
    departamento: 'Departamento Académico de Ciencias Económicas',
    categoria: 'Principal',
    dedicacion: 'Dedicación exclusiva',
    correo: 'pzavaleta@unas.edu.pe',
    telefono: '+51 962 111 426',
    activo: true,
    aforoMaximo: 10,
    cursosAsignados: ['C-ECO-301'],
  },
  {
    id: 'DOC-0427',
    codigo: 'DOC-0427',
    apellidos: 'Sifuentes Lomas',
    nombres: 'Rocío del Carmen',
    escuelaId: 'E-AGR',
    departamento: 'Departamento Académico de Ciencias Agrarias',
    categoria: 'Asociado',
    dedicacion: 'Tiempo completo',
    correo: 'rsifuentes@unas.edu.pe',
    telefono: '+51 962 111 427',
    activo: true,
    aforoMaximo: 14,
    cursosAsignados: ['C-AGR-201'],
  },
  {
    id: 'DOC-0428',
    codigo: 'DOC-0428',
    apellidos: 'Tuanama Sangama',
    nombres: 'Elmer',
    escuelaId: 'E-FOR',
    departamento: 'Departamento Académico de Ciencias Forestales',
    categoria: 'Auxiliar',
    dedicacion: 'Tiempo completo',
    correo: 'etuanama@unas.edu.pe',
    telefono: '+51 962 111 428',
    activo: true,
    aforoMaximo: 12,
    cursosAsignados: ['C-FOR-201'],
  },
  {
    id: 'DOC-0429',
    codigo: 'DOC-0429',
    apellidos: 'Fachín Chujandama',
    nombres: 'Gloria',
    escuelaId: 'E-ZOO',
    departamento: 'Departamento Académico de Zootecnia',
    categoria: 'Asociado',
    dedicacion: 'Tiempo completo',
    correo: 'gfachin@unas.edu.pe',
    telefono: '+51 962 111 429',
    activo: true,
    aforoMaximo: 12,
    cursosAsignados: ['C-ZOO-201'],
  },
  {
    id: 'DOC-0430',
    codigo: 'DOC-0430',
    apellidos: 'Angulo Reátegui',
    nombres: 'Segundo',
    escuelaId: 'E-BIO',
    departamento: 'Departamento Académico de Ciencias Biológicas',
    categoria: 'Principal',
    dedicacion: 'Dedicación exclusiva',
    correo: 'sangulo@unas.edu.pe',
    telefono: '+51 962 111 430',
    activo: true,
    aforoMaximo: 10,
    cursosAsignados: ['C-BIO-201'],
  },
  {
    id: 'DOC-0431',
    codigo: 'DOC-0431',
    apellidos: 'Lomas Pizango',
    nombres: 'Teresa',
    escuelaId: 'E-IIS',
    departamento: 'Departamento Académico de Informática y Sistemas',
    categoria: 'Auxiliar',
    dedicacion: 'Tiempo parcial',
    correo: 'tlomas@unas.edu.pe',
    telefono: '+51 962 111 431',
    activo: false,
    aforoMaximo: 0,
    cursosAsignados: [],
  },
];

export const comisionTutoria: MiembroComision[] = [
  {
    id: 'COM-01',
    docenteId: 'DOC-0422',
    nombres: 'Marta Elena Paredes Auqui',
    cargoTutorial: 'Coordinador de tutoría',
    ambito: 'FIIS · Ingeniería en Informática y Sistemas',
    correo: 'mparedes@unas.edu.pe',
    vigenciaInicio: '2026-04-01',
    vigenciaFin: '2027-03-31',
    actaDesignacion: 'Resolución N.º 118-2026-CU-R-UNAS',
  },
  {
    id: 'COM-02',
    docenteId: 'DOC-0426',
    nombres: 'Pedro Pablo Zavaleta Ruiz',
    cargoTutorial: 'Presidente de comisión',
    ambito: 'FCEA · Ciencias Económicas y Administrativas',
    correo: 'pzavaleta@unas.edu.pe',
    vigenciaInicio: '2026-04-01',
    vigenciaFin: '2027-03-31',
    actaDesignacion: 'Resolución N.º 119-2026-CU-R-UNAS',
  },
  {
    id: 'COM-03',
    docenteId: null,
    nombres: 'Jackelin Tamayo Vela',
    cargoTutorial: 'Responsable de Tutoría y Capacitación Docente',
    ambito: 'Vicerrectorado Académico · Departamento de Pedagogía',
    correo: 'tutoria@unas.edu.pe',
    vigenciaInicio: '2026-01-02',
    vigenciaFin: null,
    actaDesignacion: 'Resolución N.º 500-2022-CU-R-UNAS',
  },
  {
    id: 'COM-04',
    docenteId: 'DOC-0430',
    nombres: 'Segundo Angulo Reátegui',
    cargoTutorial: 'Secretario técnico',
    ambito: 'FC · Facultad de Ciencias',
    correo: 'sangulo@unas.edu.pe',
    vigenciaInicio: '2026-04-01',
    vigenciaFin: '2027-03-31',
    actaDesignacion: 'Resolución N.º 120-2026-CU-R-UNAS',
  },
];

/* ==========================================================================
   Utilidades de presentación
   ========================================================================== */

export function nombreCompleto(persona: { nombres: string; apellidos: string }): string {
  return `${persona.apellidos}, ${persona.nombres}`;
}

export function nombreCorto(persona: { nombres: string; apellidos: string }): string {
  const primero = persona.nombres.split(' ')[0] ?? persona.nombres;
  const apellido = persona.apellidos.split(' ')[0] ?? persona.apellidos;
  return `${primero} ${apellido}`;
}

export function iniciales(persona: { nombres: string; apellidos: string }): string {
  const a = persona.nombres.trim()[0] ?? '';
  const b = persona.apellidos.trim()[0] ?? '';
  return `${a}${b}`.toUpperCase();
}

export function escuelaDe(escuelaId: string): string {
  return escuelas.find((escuela) => escuela.id === escuelaId)?.nombre ?? 'Escuela no registrada';
}

export function abreviaturaEscuela(escuelaId: string): string {
  return escuelas.find((escuela) => escuela.id === escuelaId)?.abreviatura ?? '—';
}

export function docentePorId(id: string): Docente | undefined {
  return docentes.find((docente) => docente.id === id);
}

export function estudiantePorId(id: string): Estudiante | undefined {
  return estudiantes.find((estudiante) => estudiante.id === id);
}
