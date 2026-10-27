import type {
  AreaDerivacion,
  Curso,
  CodigoFormato,
  Escuela,
  EtapaAcademica,
  Facultad,
  Semestre,
  ServicioBienestar,
} from '../types/domain';

/**
 * Catálogos académicos ficticios con la estructura que el sistema solicita a
 * la DIAA (solicitud 02_DIAA: facultades, escuelas, cursos, planes, semestres
 * y calendario). Los códigos y nombres son de demostración.
 */

export const facultades: Facultad[] = [
  { id: 'FCEA', nombre: 'Facultad de Ciencias Económicas y Administrativas', abreviatura: 'FCEA' },
  { id: 'FIIS', nombre: 'Facultad de Ingeniería en Informática y Sistemas', abreviatura: 'FIIS' },
  { id: 'FIA', nombre: 'Facultad de Ingeniería Agraria', abreviatura: 'FIA' },
  { id: 'FRNR', nombre: 'Facultad de Recursos Naturales Renovables', abreviatura: 'FRNR' },
  { id: 'FZ', nombre: 'Facultad de Zootecnia', abreviatura: 'FZ' },
  { id: 'FC', nombre: 'Facultad de Ciencias', abreviatura: 'FC' },
  { id: 'FMV', nombre: 'Facultad de Medicina Veterinaria', abreviatura: 'FMV' },
];

export const escuelas: Escuela[] = [
  { id: 'E-ADM', nombre: 'Administración', abreviatura: 'ADM', facultadId: 'FCEA' },
  { id: 'E-CON', nombre: 'Contabilidad', abreviatura: 'CON', facultadId: 'FCEA' },
  { id: 'E-ECO', nombre: 'Economía', abreviatura: 'ECO', facultadId: 'FCEA' },
  {
    id: 'E-IIS',
    nombre: 'Ingeniería en Informática y Sistemas',
    abreviatura: 'IIS',
    facultadId: 'FIIS',
  },
  { id: 'E-AGR', nombre: 'Ingeniería Agronómica', abreviatura: 'AGR', facultadId: 'FIA' },
  { id: 'E-FOR', nombre: 'Ingeniería Forestal', abreviatura: 'FOR', facultadId: 'FRNR' },
  { id: 'E-ZOO', nombre: 'Zootecnia', abreviatura: 'ZOO', facultadId: 'FZ' },
  { id: 'E-BIO', nombre: 'Biología', abreviatura: 'BIO', facultadId: 'FC' },
];

export const semestres: Semestre[] = [
  {
    id: '2026-I',
    nombre: '2026-I',
    inicio: '2026-03-30',
    fin: '2026-08-07',
    matriculaInicio: '2026-03-09',
    matriculaFin: '2026-03-20',
    estado: 'cerrado',
  },
  {
    id: '2026-II',
    nombre: '2026-II',
    inicio: '2026-09-07',
    fin: '2027-01-29',
    matriculaInicio: '2026-08-17',
    matriculaFin: '2026-08-28',
    estado: 'en-curso',
  },
  {
    id: '2027-I',
    nombre: '2027-I',
    inicio: '2027-03-29',
    fin: '2027-08-06',
    matriculaInicio: '2027-03-08',
    matriculaFin: '2027-03-19',
    estado: 'planificado',
  },
];

export const semestreActual = '2026-II';

export const cursos: Curso[] = [
  // Ingeniería en Informática y Sistemas
  {
    id: 'C-IIS-101',
    codigo: 'IIS101',
    nombre: 'Introducción a la Ingeniería de Sistemas',
    creditos: 3,
    ciclo: 1,
    escuelaId: 'E-IIS',
  },
  {
    id: 'C-IIS-201',
    codigo: 'IIS201',
    nombre: 'Algoritmos y Estructuras de Datos',
    creditos: 4,
    ciclo: 3,
    escuelaId: 'E-IIS',
  },
  {
    id: 'C-IIS-202',
    codigo: 'IIS202',
    nombre: 'Base de Datos I',
    creditos: 4,
    ciclo: 3,
    escuelaId: 'E-IIS',
  },
  {
    id: 'C-IIS-301',
    codigo: 'IIS301',
    nombre: 'Ingeniería de Software',
    creditos: 4,
    ciclo: 5,
    escuelaId: 'E-IIS',
  },
  {
    id: 'C-IIS-302',
    codigo: 'IIS302',
    nombre: 'Redes de Computadoras',
    creditos: 3,
    ciclo: 5,
    escuelaId: 'E-IIS',
  },
  {
    id: 'C-IIS-401',
    codigo: 'IIS401',
    nombre: 'Arquitectura de Software',
    creditos: 4,
    ciclo: 7,
    escuelaId: 'E-IIS',
  },
  {
    id: 'C-IIS-402',
    codigo: 'IIS402',
    nombre: 'Gestión de Proyectos TI',
    creditos: 3,
    ciclo: 7,
    escuelaId: 'E-IIS',
  },
  {
    id: 'C-IIS-501',
    codigo: 'IIS501',
    nombre: 'Taller de Tesis I',
    creditos: 3,
    ciclo: 9,
    escuelaId: 'E-IIS',
  },
  // Administración
  {
    id: 'C-ADM-101',
    codigo: 'ADM101',
    nombre: 'Fundamentos de Administración',
    creditos: 3,
    ciclo: 1,
    escuelaId: 'E-ADM',
  },
  {
    id: 'C-ADM-201',
    codigo: 'ADM201',
    nombre: 'Contabilidad General',
    creditos: 4,
    ciclo: 3,
    escuelaId: 'E-ADM',
  },
  {
    id: 'C-ADM-301',
    codigo: 'ADM301',
    nombre: 'Gestión del Talento Humano',
    creditos: 3,
    ciclo: 5,
    escuelaId: 'E-ADM',
  },
  {
    id: 'C-ADM-401',
    codigo: 'ADM401',
    nombre: 'Planeamiento Estratégico',
    creditos: 4,
    ciclo: 7,
    escuelaId: 'E-ADM',
  },
  // Contabilidad
  {
    id: 'C-CON-101',
    codigo: 'CON101',
    nombre: 'Contabilidad Básica',
    creditos: 4,
    ciclo: 1,
    escuelaId: 'E-CON',
  },
  {
    id: 'C-CON-201',
    codigo: 'CON201',
    nombre: 'Costos y Presupuestos',
    creditos: 4,
    ciclo: 3,
    escuelaId: 'E-CON',
  },
  {
    id: 'C-CON-301',
    codigo: 'CON301',
    nombre: 'Auditoría Financiera',
    creditos: 3,
    ciclo: 5,
    escuelaId: 'E-CON',
  },
  // Economía
  {
    id: 'C-ECO-101',
    codigo: 'ECO101',
    nombre: 'Microeconomía I',
    creditos: 4,
    ciclo: 1,
    escuelaId: 'E-ECO',
  },
  {
    id: 'C-ECO-201',
    codigo: 'ECO201',
    nombre: 'Estadística Económica',
    creditos: 3,
    ciclo: 3,
    escuelaId: 'E-ECO',
  },
  {
    id: 'C-ECO-301',
    codigo: 'ECO301',
    nombre: 'Econometría',
    creditos: 4,
    ciclo: 5,
    escuelaId: 'E-ECO',
  },
  // Agronomía
  {
    id: 'C-AGR-101',
    codigo: 'AGR101',
    nombre: 'Botánica General',
    creditos: 4,
    ciclo: 1,
    escuelaId: 'E-AGR',
  },
  {
    id: 'C-AGR-201',
    codigo: 'AGR201',
    nombre: 'Suelos y Fertilidad',
    creditos: 4,
    ciclo: 3,
    escuelaId: 'E-AGR',
  },
  {
    id: 'C-AGR-301',
    codigo: 'AGR301',
    nombre: 'Fitopatología',
    creditos: 3,
    ciclo: 5,
    escuelaId: 'E-AGR',
  },
  // Forestal
  {
    id: 'C-FOR-101',
    codigo: 'FOR101',
    nombre: 'Dendrología',
    creditos: 4,
    ciclo: 1,
    escuelaId: 'E-FOR',
  },
  {
    id: 'C-FOR-201',
    codigo: 'FOR201',
    nombre: 'Silvicultura',
    creditos: 4,
    ciclo: 3,
    escuelaId: 'E-FOR',
  },
  // Zootecnia
  {
    id: 'C-ZOO-101',
    codigo: 'ZOO101',
    nombre: 'Anatomía Animal',
    creditos: 4,
    ciclo: 1,
    escuelaId: 'E-ZOO',
  },
  {
    id: 'C-ZOO-201',
    codigo: 'ZOO201',
    nombre: 'Nutrición Animal',
    creditos: 4,
    ciclo: 3,
    escuelaId: 'E-ZOO',
  },
  // Biología
  {
    id: 'C-BIO-101',
    codigo: 'BIO101',
    nombre: 'Biología General',
    creditos: 4,
    ciclo: 1,
    escuelaId: 'E-BIO',
  },
  {
    id: 'C-BIO-201',
    codigo: 'BIO201',
    nombre: 'Ecología General',
    creditos: 3,
    ciclo: 3,
    escuelaId: 'E-BIO',
  },
];

/** Cursos de una escuela para un ciclo concreto. */
export function cursosDeEscuela(escuelaId: string): Curso[] {
  return cursos.filter((curso) => curso.escuelaId === escuelaId);
}

/* ==========================================================================
   Rutas de derivación y atención (solicitudes 06_Bienestar y 07_Medicina)
   ========================================================================== */

export const serviciosBienestar: ServicioBienestar[] = [
  {
    id: 'SB-MED',
    servicio: 'medicina',
    nombre: 'Servicio de Medicina',
    responsable: 'Dra. Carmen Ríos Valverde',
    correo: 'medicina@unas.edu.pe',
    telefono: '+51 962 000 101',
    horario: 'Lun – Vie · 8:00 a. m. a 5:00 p. m.',
    ubicacion: 'Pabellón de Bienestar Universitario · 1.er piso',
    requisitos: 'Código universitario y documento de identidad',
    canalCita: 'Cita presencial en tópico o solicitud desde el sistema',
  },
  {
    id: 'SB-ENF',
    servicio: 'enfermeria',
    nombre: 'Servicio de Enfermería y Tópico',
    responsable: 'Lic. Rosa Paredes Auqui',
    correo: 'enfermeria@unas.edu.pe',
    telefono: '+51 962 000 102',
    horario: 'Lun – Sáb · 7:30 a. m. a 6:00 p. m.',
    ubicacion: 'Tópico de Bienestar Universitario',
    requisitos: 'Atención inmediata para casos de urgencia',
    canalCita: 'Atención directa en tópico',
  },
  {
    id: 'SB-PSI',
    servicio: 'psicologia',
    nombre: 'Servicio de Psicología',
    responsable: 'Ps. Jorge Bermúdez Salas',
    correo: 'psicologia@unas.edu.pe',
    telefono: '+51 962 000 103',
    horario: 'Lun – Vie · 9:00 a. m. a 4:00 p. m.',
    ubicacion: 'Pabellón de Bienestar Universitario · 2.° piso',
    requisitos: 'Derivación tutorial (formato 12) o solicitud del estudiante',
    canalCita: 'Cita programada por el servicio',
  },
  {
    id: 'SB-PSP',
    servicio: 'psicopedagogia',
    nombre: 'Servicio de Psicopedagogía',
    responsable: 'Lic. Milagros Huamán Ríos',
    correo: 'psicopedagogia@unas.edu.pe',
    telefono: '+51 962 000 104',
    horario: 'Lun – Vie · 8:30 a. m. a 3:30 p. m.',
    ubicacion: 'Pabellón de Bienestar Universitario · 2.° piso',
    requisitos: 'Derivación tutorial (formato 12)',
    canalCita: 'Cita programada por el servicio',
  },
  {
    id: 'SB-SOC',
    servicio: 'servicio-social',
    nombre: 'Área de Servicio Social',
    responsable: 'Lic. Pedro Zavaleta Ruiz',
    correo: 'serviciosocial@unas.edu.pe',
    telefono: '+51 962 000 105',
    horario: 'Lun – Vie · 8:00 a. m. a 4:30 p. m.',
    ubicacion: 'Pabellón de Bienestar Universitario · 1.er piso',
    requisitos: 'Ficha socioeconómica vigente',
    canalCita: 'Solicitud en ventanilla o desde el sistema',
  },
  {
    id: 'SB-COM',
    servicio: 'comedor',
    nombre: 'Comedor Universitario',
    responsable: 'Lic. Pedro Zavaleta Ruiz',
    correo: 'comedor@unas.edu.pe',
    telefono: '+51 962 000 106',
    horario: 'Lun – Sáb · 11:30 a. m. a 3:00 p. m.',
    ubicacion: 'Comedor Universitario',
    requisitos: 'Clasificación socioeconómica vigente',
    canalCita: 'Convocatoria semestral',
  },
  {
    id: 'SB-RES',
    servicio: 'residencia',
    nombre: 'Residencia Estudiantil',
    responsable: 'Lic. Pedro Zavaleta Ruiz',
    correo: 'residencia@unas.edu.pe',
    telefono: '+51 962 000 107',
    horario: 'Atención administrativa · Lun – Vie 8:00 a. m. a 4:00 p. m.',
    ubicacion: 'Residencia Universitaria',
    requisitos: 'Clasificación socioeconómica y lugar de procedencia',
    canalCita: 'Convocatoria semestral',
  },
];

export const areasDerivacion: Array<{
  id: AreaDerivacion;
  nombre: string;
  responsable: string;
  correo: string;
  servicioId: string;
  tiempoRespuesta: string;
}> = [
  {
    id: 'tutoria-academica',
    nombre: 'Tutoría académica',
    responsable: 'Docente tutor asignado',
    correo: 'tutoria@unas.edu.pe',
    servicioId: 'SB-PSP',
    tiempoRespuesta: '3 días hábiles',
  },
  {
    id: 'psicologia',
    nombre: 'Psicología',
    responsable: 'Ps. Jorge Bermúdez Salas',
    correo: 'psicologia@unas.edu.pe',
    servicioId: 'SB-PSI',
    tiempoRespuesta: '5 días hábiles',
  },
  {
    id: 'psicopedagogia',
    nombre: 'Psicopedagogía',
    responsable: 'Lic. Milagros Huamán Ríos',
    correo: 'psicopedagogia@unas.edu.pe',
    servicioId: 'SB-PSP',
    tiempoRespuesta: '5 días hábiles',
  },
  {
    id: 'medicina',
    nombre: 'Medicina y Salud',
    responsable: 'Dra. Carmen Ríos Valverde',
    correo: 'medicina@unas.edu.pe',
    servicioId: 'SB-MED',
    tiempoRespuesta: '2 días hábiles',
  },
  {
    id: 'bienestar-social',
    nombre: 'Bienestar y Servicio Social',
    responsable: 'Lic. Pedro Zavaleta Ruiz',
    correo: 'serviciosocial@unas.edu.pe',
    servicioId: 'SB-SOC',
    tiempoRespuesta: '5 días hábiles',
  },
];

/** Etiquetas legibles de los estados de derivación. */
export const etiquetasEstadoDerivacion: Record<string, string> = {
  registrada: 'Registrada',
  recibida: 'Recibida por el área',
  citada: 'Cita programada',
  'en-atencion': 'En atención',
  atendida: 'Atendida',
  seguimiento: 'En seguimiento',
  cerrada: 'Cerrada',
  'no-presentado': 'No se presentó',
};

/**
 * Etapas de la entrevista inicial. Se declara con las claves del dominio y no como
 * índice abierto (`Record<string, …>`) para que `etapaAcademica[estudiante.etapa]`
 * nunca sea `undefined` bajo `noUncheckedIndexedAccess`: `Estudiante.etapa` ya está
 * tipado como `EtapaAcademica`.
 */
export const etapaAcademica: Record<
  EtapaAcademica,
  {
    etiqueta: string;
    formato: CodigoFormato;
    descripcion: string;
    ciclos: string;
    desde: number;
    hasta: number;
  }
> = {
  ingresante: {
    etiqueta: 'Inicial',
    formato: 'F03',
    descripcion: 'Entrevista inicial al estudiante ingresante',
    ciclos: 'Ciclos 1 a 3',
    desde: 1,
    hasta: 3,
  },
  intermedio: {
    etiqueta: 'Intermedio',
    formato: 'F04',
    descripcion: 'Entrevista inicial al estudiante de ciclos intermedios',
    ciclos: 'Ciclos 4 a 7',
    desde: 4,
    hasta: 7,
  },
  final: {
    etiqueta: 'Final',
    formato: 'F05',
    descripcion: 'Entrevista inicial al estudiante de ciclos finales',
    ciclos: 'Ciclos 8 a 10',
    desde: 8,
    hasta: 10,
  },
};

/**
 * Rangos indicados por el usuario el 27/10/2026: inicial (1–3), intermedia (4–7)
 * y final (8–10). Es la única fuente de la regla: la entrevista inicial, el
 * padrón y los filtros del portal leen de aquí.
 */
export function etapaDeCiclo(ciclo: number): 'ingresante' | 'intermedio' | 'final' {
  for (const etapa of ['ingresante', 'intermedio', 'final'] as const) {
    const rango = etapaAcademica[etapa];
    if (Number.isInteger(ciclo) && ciclo >= rango.desde && ciclo <= rango.hasta) return etapa;
  }
  throw new RangeError('El ciclo debe ser un número entero entre 1 y 10.');
}
