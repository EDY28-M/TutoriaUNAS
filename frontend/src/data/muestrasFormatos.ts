import type { CodigoFormato } from '../types/domain';
import type { DocumentoFormato } from '../utils/exportFormatos';

/**
 * Muestras de los formatos 01–12 completamente llenadas con datos ficticios.
 *
 * Sirven para revisar el diseño de exportación antes de que el semestre tenga
 * formularios enviados. Ninguna persona, colegio ni teléfono existe; cada hoja
 * exportada lleva la marca «Muestra con datos ficticios».
 */

const j = (valor: unknown) => JSON.stringify(valor);
const SEMESTRE = '2026-II';
const TUTOR = 'Sandoval Pinedo, Carlos Augusto';
const TELEFONO_TUTOR = '+51 962 418 307';
const ESCUELA = 'E-IIS';

const INGRESANTE = {
  nombreEstudiante: 'Huamán Torres, Kiara Milagros',
  codigo: '0020260417',
  correo: '0020260417@unas.edu.pe',
  telefono: '+51 951 302 774',
  apoderado: 'Torres Vela, Gladys Roxana',
  grupo: 'G-01',
};
const INTERMEDIO = {
  nombreEstudiante: 'Rengifo Panduro, Diego Alonso',
  codigo: '0020240233',
  correo: '0020240233@unas.edu.pe',
  telefono: '+51 948 115 620',
  apoderado: 'Panduro Saavedra, Elsa Marina',
  grupo: 'G-02',
};
const FINAL = {
  nombreEstudiante: 'Villacorta Ríos, Ana Lucía',
  codigo: '0020220158',
  correo: '0020220158@unas.edu.pe',
  telefono: '+51 937 640 281',
  apoderado: 'Ríos Chávez, Manuel Jesús',
  grupo: 'G-03',
};

const GRUPO_G02 = [
  ['Rengifo Panduro, Diego Alonso', '5'],
  ['Arévalo Mozombite, Luz Clarita', '5'],
  ['Céspedes Navarro, Bruno Andrés', '5'],
  ['Del Águila Flores, Marisol', '5'],
  ['Escobedo Ruiz, Fabricio Josué', '5'],
  ['Gonzales Shupingahua, Nayeli', '5'],
  ['Inga Cárdenas, Pedro Saúl', '5'],
  ['López Tuanama, Yessenia Paola', '5'],
  ['Mego Vásquez, Rodrigo', '5'],
  ['Pinchi Tello, Camila Fernanda', '5'],
  ['Ramírez Ushiñahua, Joel', '5'],
  ['Satalaya Ríos, Melany', '5'],
];

/** Datos de los formatos de entrevista que se repiten entre 04 y 05. */
const HABITOS_INTERMEDIO = {
  otrasActividades: j(['Trabajo', 'Deporte']),
  administracionTiempo: j([
    { actividad: 'Asistencia a clases', horas: '6' },
    { actividad: 'Estudio de las materias', horas: '3' },
    { actividad: 'Trabajo en el negocio familiar', horas: '3' },
    { actividad: 'Fútbol con el equipo de la escuela', horas: '1' },
    { actividad: 'Descanso y actividades sociales', horas: '2' },
  ]),
  transporte: 'Mototaxi',
  tiempoTransporte: '20',
  lugarEstudio: 'Biblioteca',
  espacioEstudio: 'Sí',
  cursosDificiles: j(['Estadística y Probabilidades', 'Física II']),
  accionesCursos: j(['Practico ejercicios', 'Estudio en grupo']),
  dificultades: j(['Organización del tiempo', 'Concentración']),
  soluciones: j(['Organicé un horario', 'Busqué tutoría']),
  materiasFaciles: j(['Programación Orientada a Objetos', 'Base de Datos I']),
  problemasPersonales: j(['Económicas']),
  estadoSalud: 'Bueno',
  autodescripcion:
    'Me considero una persona tranquila y perseverante. Me cuesta concentrarme cuando tengo muchas tareas juntas.',
  preocupaciones: j(['Mi situación económica']),
  cualidades: j(['Responsabilidad', 'Perseverancia']),
  habilidades: j(['Tecnología', 'Trabajo en equipo']),
  aficiones: j(['Deporte', 'Música']),
  adicciones: 'Ninguna',
  valores: j(['Respeto', 'Honestidad', 'Solidaridad']),
  antivalores: 'A veces dejo las tareas para el último momento.',
};

const HABITOS_FINAL = {
  otrasActividades: j(['Actividades sociales', 'Otro']),
  otrasActividades__otro: 'Prácticas preprofesionales',
  administracionTiempo: j([
    { actividad: 'Asistencia a clases', horas: '4' },
    { actividad: 'Prácticas preprofesionales', horas: '4' },
    { actividad: 'Avance de tesis', horas: '2' },
    { actividad: 'Estudio de las materias', horas: '2' },
  ]),
  transporte: 'Transporte público',
  tiempoTransporte: '35',
  lugarEstudio: 'En casa',
  espacioEstudio: 'Sí',
  cursosDificiles: j(['Seminario de Tesis II']),
  accionesCursos: j(['Pido asesoría', 'Veo material de apoyo']),
  dificultades: j(['Organización del tiempo']),
  soluciones: j(['Organicé un horario', 'Consulté al docente']),
  materiasFaciles: j(['Ingeniería de Software II', 'Gestión de Proyectos de TI']),
  problemasPersonales: j(['Trabajo']),
  estadoSalud: 'Regular',
  autodescripcion:
    'Soy organizada y comunicativa. Últimamente me siento cansada por combinar las prácticas con la tesis.',
  preocupaciones: j(['Mi futuro laboral']),
  cualidades: j(['Responsabilidad', 'Empatía']),
  habilidades: j(['Comunicación', 'Organización']),
  aficiones: j(['Lectura', 'Arte']),
  adicciones: 'Ninguna',
  valores: j(['Responsabilidad', 'Respeto']),
  antivalores: 'Ninguno identificado.',
};

function muestra(
  formato: CodigoFormato,
  referencia: string,
  fecha: string,
  respuestas: Record<string, string>,
  estudianteId: string | null = null,
): DocumentoFormato {
  return {
    id: `MUESTRA-${formato}`,
    formato,
    referencia,
    estudianteId,
    tutorId: 'MUESTRA-TUTOR',
    semestreId: SEMESTRE,
    estado: 'muestra',
    fecha,
    respuestas: { fecha, ...respuestas },
    muestra: true,
  };
}

export const muestrasFormatos: DocumentoFormato[] = [
  muestra('F01', 'Escuela Profesional de Ingeniería en Informática y Sistemas', '2026-12-18', {
    facultad:
      'Facultad de Ingeniería en Informática y Sistemas · Escuela Profesional de Ingeniería en Informática y Sistemas',
    comision: [
      'Sandoval Pinedo, Carlos Augusto (presidente)',
      'Paredes Isuiza, Rocío del Pilar',
      'Meléndez Arirama, Jorge Luis',
    ].join('\n'),
    actividades: j([
      {
        problematica: 'Bajo rendimiento en cursos de ciencias básicas (ciclos I–III)',
        meta: '80 % de ingresantes con tutoría grupal',
        fecha: '2026-09-18',
        justificacion: 'Alto número de desaprobados en Matemática I del semestre anterior',
        evidencia: 'Formato 07 · 4 sesiones grupales',
      },
      {
        problematica: 'Deficiente organización del tiempo',
        meta: 'Taller de organización para 3 grupos',
        fecha: '2026-10-02',
        justificacion: 'Entrevistas 03–05 reportan falta de horario de estudio',
        evidencia: 'Lista de asistencia y presentación del taller',
      },
      {
        problematica: 'Estudiantes en riesgo académico',
        meta: 'Seguimiento individual al 100 % de casos',
        fecha: '2026-10-21',
        justificacion: 'Alertas de la DIAA por cursos en segunda matrícula',
        evidencia: 'Formatos 06 y 08 de cada caso',
      },
      {
        problematica: 'Situaciones emocionales que afectan el estudio',
        meta: 'Derivación oportuna a Psicología',
        fecha: '2026-11-06',
        justificacion: 'Casos identificados en tutoría individual',
        evidencia: 'Formato 12 · 3 fichas de derivación',
      },
      {
        problematica: 'Inserción laboral de ciclos finales',
        meta: 'Charla de empleabilidad para IX y X ciclo',
        fecha: '2026-11-20',
        justificacion: 'Resultados del campo laboral del formato 05',
        evidencia: 'Registro fotográfico y formato 07',
      },
    ]),
    observaciones:
      'Se cumplió con el 90 % de las actividades programadas en el Plan de Acción Tutorial. La actividad con padres de familia se reprogramó para el siguiente semestre por la coincidencia con la semana de exámenes.',
  }),
  muestra('F02', TUTOR, '2026-12-11', {
    nombreTutor: TUTOR,
    atendidosIndividual: '14',
    ciclosIndividual: 'I, III y V',
    individuales: '22',
    atendidosGrupal: '28',
    ciclosGrupal: 'I y V',
    grupales: '6',
    dificultadesAcademicas: j([
      {
        dificultad: 'Bajo dominio de Matemática Básica',
        actividad: 'Asesoría de pares y práctica dirigida',
        resultado: '9 de 12 estudiantes aprobaron el primer parcial',
      },
      {
        dificultad: 'Hábitos de estudio poco organizados',
        actividad: 'Taller de organización del tiempo',
        resultado: 'Elaboraron su horario semanal de estudio',
      },
      {
        dificultad: 'Dificultad en la redacción de informes',
        actividad: 'Revisión guiada de un informe modelo',
        resultado: 'Mejoraron la presentación de sus trabajos',
      },
    ]),
    dificultadesTutoria: j([
      {
        dificultad: 'Cruce de horarios con laboratorios',
        atencion: 'Sesiones en horario alterno y virtual',
        resultado: 'Asistencia del 85 % a las sesiones',
      },
      {
        dificultad: 'Baja respuesta a las convocatorias',
        atencion: 'Recordatorios por avisos del sistema',
        resultado: 'Mayor puntualidad en las citas',
      },
    ]),
    dificultadesPersonales: j([
      {
        dificultad: 'Ansiedad ante evaluaciones',
        atencion: 'Derivación a Psicología',
        resultado: 'Estudiante en seguimiento por el área',
      },
      {
        dificultad: 'Situación económica familiar',
        atencion: 'Derivación a Bienestar y Servicio Social',
        resultado: 'Accedió al comedor universitario',
      },
    ]),
    observaciones:
      'Se recomienda programar el taller de técnicas de estudio en las primeras semanas del semestre y coordinar con los docentes de ciencias básicas.',
  }),
  muestra(
    'F03',
    INGRESANTE.nombreEstudiante,
    '2026-09-09',
    {
      ...INGRESANTE,
      colegio: 'I.E. «Nuevo Horizonte» · Tingo María',
      promedioSecundaria: '15.4',
      materiasSecundaria: j(['Matemática', 'Inglés']),
      conoceTutoria: 'Sí',
      expectativas: j(['Adaptarme a la universidad', 'Mejorar mi forma de estudiar']),
      eleccionCarrera: j(['Interés personal', 'Oportunidades laborales']),
      expectativaCarrera: j(['Trabajar en mi especialidad', 'Emprender']),
      expectativaUniversidad: j(['Buena formación', 'Acompañamiento']),
      administracionTiempo: j([
        { actividad: 'Asistencia a clases', horas: '6' },
        { actividad: 'Estudio en casa', horas: '3' },
        { actividad: 'Apoyo en labores del hogar', horas: '2' },
        { actividad: 'Descanso y recreación', horas: '2' },
      ]),
      horasEstudio: '3',
      tiempoSuficiente: 'No',
      formaEstudio: j(['Individual', 'Con música', 'Otro']),
      formaEstudio__otro: 'Haciendo resúmenes y mapas mentales',
      estudioEfectivo: 'A veces',
    },
    'MUESTRA-EST-ING',
  ),
  muestra(
    'F04',
    INTERMEDIO.nombreEstudiante,
    '2026-09-10',
    {
      ...INTERMEDIO,
      colegio: 'C.E.P. «San Martín de Porres» · Aucayacu',
      expectativas: 'Sí',
      aprendizajes: j([
        'Organizar mi tiempo',
        'Técnicas de estudio',
        'Conocer los servicios de apoyo',
      ]),
      caracteristicasTutor: j(['Escucha', 'Orientación académica', 'Seguimiento']),
      motivacion: 'Media',
      ...HABITOS_INTERMEDIO,
    },
    'MUESTRA-EST-INT',
  ),
  muestra(
    'F05',
    FINAL.nombreEstudiante,
    '2026-09-11',
    {
      ...FINAL,
      colegio: 'I.E. «Leoncio Prado» · Tingo María',
      expectativas: 'No',
      motivoExpectativas:
        'Me faltó más orientación sobre las prácticas preprofesionales y la elaboración de la tesis.',
      aprendizajes: j([
        'Organizar mi tiempo',
        'Resolver dificultades',
        'Prepararme para el trabajo',
      ]),
      caracteristicasTutor: j(['Orientación laboral', 'Disponibilidad']),
      laboral1: 'Sí',
      laboral2: 'Sí',
      laboral3: 'Sí',
      laboral4: 'No',
      laboral5: 'No',
      laboral6: 'Sí',
      laboral7: 'Sí',
      laboral8: 'Sí',
      laboral9: 'Sí',
      motivacion: 'Alta',
      ...HABITOS_FINAL,
    },
    'MUESTRA-EST-FIN',
  ),
  muestra('F06', TUTOR, '2026-10-14', {
    nombreTutor: TUTOR,
    horaInicio: '10:00',
    horaFin: '12:00',
    asistentes: j([
      {
        fecha: '2026-10-14',
        nombre: INTERMEDIO.nombreEstudiante,
        grupo: 'G-02',
        tipo: 'Académica',
      },
      { fecha: '2026-10-14', nombre: INGRESANTE.nombreEstudiante, grupo: 'G-01', tipo: 'Personal' },
      {
        fecha: '2026-10-16',
        nombre: 'Arévalo Mozombite, Luz Clarita',
        grupo: 'G-02',
        tipo: 'Académica',
      },
      {
        fecha: '2026-10-16',
        nombre: 'Pinchi Tello, Camila Fernanda',
        grupo: 'G-02',
        tipo: 'Social',
      },
      { fecha: '2026-10-21', nombre: FINAL.nombreEstudiante, grupo: 'G-03', tipo: 'Académica' },
      { fecha: '2026-10-23', nombre: 'Mego Vásquez, Rodrigo', grupo: 'G-02', tipo: 'Personal' },
    ]),
  }),
  muestra('F07', 'Técnicas de estudio · G-02', '2026-10-09', {
    nombreTutor: TUTOR,
    grupo: 'G-02',
    tema: 'Técnicas de estudio',
    horaInicio: '16:00',
    horaFin: '17:30',
    asistentes: j(GRUPO_G02.map(([nombre, ciclo]) => ({ nombre, ciclo }))),
  }),
  muestra(
    'F08',
    INTERMEDIO.nombreEstudiante,
    '2026-10-14',
    {
      nombreTutor: TUTOR,
      nombreEstudiante: INTERMEDIO.nombreEstudiante,
      ciclo: '5',
      grupo: 'G-02',
      motivo: 'Organización del tiempo',
      detalleMotivo:
        'El estudiante trabaja por las tardes en el negocio familiar y no logra cumplir con las prácticas de Estadística. Desaprobó la primera evaluación parcial.',
      resultado: 'Se programa nueva cita para seguimiento',
      proximaCita: '2026-10-28',
      horaCita: '10:00',
      horaFinCita: '10:45',
    },
    'MUESTRA-EST-INT',
  ),
  muestra('F09', TUTOR, '2026-12-10', {
    nombreTutor: TUTOR,
    gruposAsignados: '3',
    estudiantesAsignados: '28',
    actividad1: 'Realizada',
    actividad2: 'Realizada',
    actividad3: 'Realizada',
    actividad4: 'Realizada',
    actividad5: 'Realizada',
    actividad6: 'Realizada',
    actividad7: 'Realizada',
    actividad8: 'No realizada',
    actividad9: 'Realizada',
    actividad10: 'Realizada',
    observaciones:
      'La convocatoria a padres de familia queda pendiente para el inicio del siguiente semestre.',
  }),
  muestra(
    'F10',
    INTERMEDIO.nombreEstudiante,
    '2026-10-14',
    {
      grupo: 'G-02',
      turno: 'Mañana',
      ...Object.fromEntries(
        ['A', 'A', 'A', 'B', 'A', 'B', 'A', 'B', 'A', 'B', 'C', 'A', 'B', 'A'].map((letra, i) => [
          `p${String(i + 1).padStart(2, '0')}`,
          {
            A: 'A · Totalmente de acuerdo',
            B: 'B · De acuerdo',
            C: 'C · En desacuerdo',
          }[letra] ?? '',
        ]),
      ),
      tieneSugerencia: 'Sí',
      sugerencia:
        'Que las sesiones individuales también puedan agendarse por la tarde para quienes trabajamos en la mañana.',
    },
    'MUESTRA-EST-INT',
  ),
  muestra('F11', 'Técnicas de estudio · G-02', '2026-10-09', {
    nombreTutor: TUTOR,
    ...Object.fromEntries(
      [
        'Sí',
        'Sí',
        'Sí',
        'Sí',
        'A veces',
        'Sí',
        'Sí',
        'A veces',
        'Sí',
        'A veces',
        'No',
        'Sí',
        'Sí',
      ].map((valor, i) => [`p${String(i + 1).padStart(2, '0')}`, valor]),
    ),
  }),
  muestra(
    'F12',
    INGRESANTE.nombreEstudiante,
    '2026-11-04',
    {
      nombreEstudiante: INGRESANTE.nombreEstudiante,
      ciclo: '1',
      escuela: ESCUELA,
      codigo: INGRESANTE.codigo,
      telefono: INGRESANTE.telefono,
      nombreTutor: TUTOR,
      telefonoTutor: TELEFONO_TUTOR,
      area: 'Psicología',
      motivo: 'Apoyo emocional',
      detalle:
        'La estudiante refiere ansiedad intensa antes de las evaluaciones y dificultad para dormir. Se sugiere evaluación y acompañamiento psicológico.',
    },
    'MUESTRA-EST-ING',
  ),
];
