import type {
  CampoFormato,
  CodigoFormato,
  DefinicionFormato,
  SeccionFormato,
} from '../types/domain';

/** Transcripción funcional de los anexos 01–12 y la guía de llenado entregada por el usuario.
 * Las opciones sugeridas agilizan la captura; «Otro» conserva la respuesta libre del anexo.
 * Los campos adicionales de seguimiento son propios de la demostración, no exigencias normativas.
 */
export const VERSION_INSTRUMENTOS = 'Anexos 01–12 · Resolución N.º 500-2022-CU-R-UNAS';
export const APROBACION_INSTRUMENTOS = 'Resolución N.º 500-2022-CU-R-UNAS';
export const VIGENCIA_INSTRUMENTOS =
  'Responsables y momentos según la guía de llenado proporcionada';
const SI_NO = ['Sí', 'No'];
const ACUERDO = [
  'A · Totalmente de acuerdo',
  'B · De acuerdo',
  'C · En desacuerdo',
  'D · Totalmente en desacuerdo',
];
const AREAS = ['Psicología', 'Psicopedagogía', 'Medicina y Salud', 'Bienestar y Servicio Social'];
const c = (
  codigo: string,
  etiqueta: string,
  tipo: CampoFormato['tipo'] = 'texto',
  obligatorio = true,
  opciones?: string[],
): CampoFormato => ({ codigo, etiqueta, tipo, obligatorio, opciones });
const s = (titulo: string, campos: CampoFormato[]): SeccionFormato => ({ titulo, campos });
const opciones = (
  codigo: string,
  etiqueta: string,
  valores: string[],
  multiple = false,
  obligatorio = true,
): CampoFormato => c(codigo, etiqueta, multiple ? 'multiple' : 'escala', obligatorio, valores);
const condicional = (campo: CampoFormato, depende: string, valores: string[]): CampoFormato => ({
  ...campo,
  visibleSi: { campo: depende, valores },
});
const tabla = (
  codigo: string,
  etiqueta: string,
  columnas: NonNullable<CampoFormato['columnas']>,
  obligatorio = true,
): CampoFormato => ({ ...c(codigo, etiqueta, 'tabla', obligatorio), columnas });
const col = (codigo: string, etiqueta: string, tipo: 'texto' | 'numero' | 'fecha' = 'texto') => ({
  codigo,
  etiqueta,
  tipo,
});
const estudiante = s('Tus datos', [
  c('nombreEstudiante', 'Nombre del estudiante'),
  c('grupo', 'Grupo'),
  c('correo', 'Correo electrónico'),
  c('telefono', 'Teléfono', 'texto', false),
  c('apoderado', 'Nombre del padre o apoderado', 'texto', false),
]);
const tutor = s('Datos del docente', [
  c('nombreTutor', 'Docente tutor'),
  c('fecha', 'Fecha', 'fecha'),
]);
const tiempo = s('Organización del tiempo', [
  opciones(
    'otrasActividades',
    'Además de estudiar, ¿qué actividades realizas?',
    ['Trabajo', 'Deporte', 'Cuidado de familiares', 'Actividades sociales', 'Solo estudio', 'Otro'],
    true,
    false,
  ),
  tabla(
    'administracionTiempo',
    'Describe un día en la universidad y el hogar',
    [col('actividad', 'Actividad'), col('horas', 'Horas al día', 'numero')],
    false,
  ),
  opciones(
    'transporte',
    '¿Cómo te transportas a la universidad?',
    ['A pie', 'Bicicleta', 'Transporte público', 'Mototaxi', 'Vehículo propio', 'Otro'],
    false,
    false,
  ),
  c('tiempoTransporte', 'Tiempo para llegar (minutos)', 'numero', false),
]);
const estrategias = s('Estrategias de estudio', [
  opciones('lugarEstudio', '¿Dónde estudias regularmente?', [
    'En casa',
    'Biblioteca',
    'Universidad',
    'Otro',
  ]),
  opciones('espacioEstudio', '¿Tienes un espacio específico para estudiar?', SI_NO, false, false),
  {
    ...c('cursosDificiles', '¿Qué cursos te cuestan más?', 'multiple', true, ['Ninguno', 'Otro']),
    ayuda: 'Selecciona tus cursos o indica que no tienes dificultades.',
  },
  opciones(
    'accionesCursos',
    '¿Qué haces para estudiarlos?',
    [
      'Repaso mis apuntes',
      'Practico ejercicios',
      'Estudio en grupo',
      'Pido asesoría',
      'Veo material de apoyo',
      'Otro',
    ],
    true,
    false,
  ),
  opciones(
    'dificultades',
    '¿Has tenido dificultades con tus estudios?',
    [
      'No he tenido',
      'Organización del tiempo',
      'Comprender los temas',
      'Concentración',
      'Asistencia',
      'Otro',
    ],
    true,
    false,
  ),
  opciones(
    'soluciones',
    '¿Qué has hecho para resolverlas?',
    [
      'Organicé un horario',
      'Consulté al docente',
      'Pedí apoyo a compañeros',
      'Busqué tutoría',
      'Aún necesito ayuda',
      'Otro',
    ],
    true,
    false,
  ),
  c('materiasFaciles', '¿Qué cursos te gustan y se te facilitan?', 'multiple', false, [
    'Ninguno',
    'Otro',
  ]),
]);
const socioemocional = s('Cómo te encuentras', [
  opciones(
    'problemasPersonales',
    '¿Qué situaciones influyen en tu aprendizaje?',
    [
      'Ninguna',
      'Económicas',
      'Familiares',
      'Trabajo',
      'Salud',
      'Prefiero conversarlo con mi tutor',
      'Otro',
    ],
    true,
    false,
  ),
  opciones(
    'estadoSalud',
    '¿Cómo consideras tu estado actual de salud?',
    ['Bueno', 'Regular', 'Necesito apoyo', 'Prefiero conversarlo con mi tutor'],
    false,
    false,
  ),
  c(
    'autodescripcion',
    '¿Cómo te describes física, mental y temperamentalmente?',
    'texto-largo',
    false,
  ),
  opciones(
    'preocupaciones',
    '¿Hay algo que te preocupe en este momento?',
    [
      'No',
      'Mis estudios',
      'Mi familia',
      'Mi situación económica',
      'Mi futuro laboral',
      'Prefiero conversarlo con mi tutor',
      'Otro',
    ],
    true,
    false,
  ),
]);
const rasgos = s('Un poco más sobre ti', [
  opciones(
    'cualidades',
    'Tus cualidades',
    ['Responsabilidad', 'Perseverancia', 'Empatía', 'Creatividad', 'Otro'],
    true,
    false,
  ),
  opciones(
    'habilidades',
    'Tus habilidades',
    ['Comunicación', 'Trabajo en equipo', 'Tecnología', 'Organización', 'Otro'],
    true,
    false,
  ),
  opciones(
    'aficiones',
    'Tus aficiones',
    ['Lectura', 'Música', 'Deporte', 'Arte', 'Videojuegos', 'Otro'],
    true,
    false,
  ),
  c('adicciones', 'Adicciones, si existen', 'texto-largo', false),
  opciones(
    'valores',
    'Tus valores',
    ['Honestidad', 'Respeto', 'Solidaridad', 'Responsabilidad', 'Otro'],
    true,
    false,
  ),
  c('antivalores', 'Antivalores que quisieras mejorar, si existen', 'texto-largo', false),
]);
const expectativas = s('Tu experiencia con la tutoría', [
  opciones('expectativas', '¿La tutoría recibida ha colmado tus expectativas?', [
    'Sí',
    'No',
    'Todavía no recibí tutoría',
  ]),
  condicional(c('motivoExpectativas', '¿Qué te faltó recibir?', 'texto-largo'), 'expectativas', [
    'No',
  ]),
  opciones(
    'aprendizajes',
    'Aspectos que aprendiste en las tutorías',
    [
      'Organizar mi tiempo',
      'Técnicas de estudio',
      'Conocer los servicios de apoyo',
      'Resolver dificultades',
      'Prepararme para el trabajo',
      'Aún ninguno',
      'Otro',
    ],
    true,
    false,
  ),
  opciones(
    'caracteristicasTutor',
    '¿Qué acompañamiento te gustaría encontrar en tu tutor?',
    [
      'Escucha',
      'Orientación académica',
      'Disponibilidad',
      'Seguimiento',
      'Orientación laboral',
      'Otro',
    ],
    true,
    false,
  ),
]);
const motivacion = s('Motivación', [
  opciones('motivacion', '¿Cómo se encuentra tu motivación hacia el estudio?', [
    'Alta',
    'Media',
    'Baja',
    'Quisiera conversar sobre ello',
  ]),
]);

const PERIODICIDAD: Record<CodigoFormato, { periodicidad: string; destinatario: string }> = {
  F01: {
    periodicidad: 'Al término del semestre académico',
    destinatario: 'Comisión de Tutoría de la EP → responsable del Sistema (arts. 15.c–d)',
  },
  F02: {
    periodicidad: 'Semestral',
    destinatario: 'Comisión de Tutoría de la escuela profesional (art. 17.f)',
  },
  F03: {
    periodicidad: 'Al inicio del semestre, para quienes inician el primer ciclo (art. 17.k)',
    destinatario: 'Docente tutor; expediente del tutorado',
  },
  F04: {
    periodicidad: 'Al inicio del semestre (ciclos intermedios; no fijada en el Reglamento)',
    destinatario: 'Docente tutor; expediente del tutorado',
  },
  F05: {
    periodicidad: 'Al inicio del semestre (ciclos finales; no fijada en el Reglamento)',
    destinatario: 'Docente tutor; expediente del tutorado',
  },
  F06: {
    periodicidad: 'En cada sesión de tutoría individual; el tutorado firma (art. 18.f)',
    destinatario: 'Expediente del tutorado y archivo del tutor',
  },
  F07: {
    periodicidad: 'En cada actividad de tutoría grupal; el tutorado firma (art. 18.f)',
    destinatario: 'Expediente del grupo y archivo del tutor',
  },
  F08: {
    periodicidad: 'Cuando el estudiante requiere atención específica',
    destinatario: 'Expediente del tutorado; áreas de apoyo si hay derivación',
  },
  F09: {
    periodicidad: 'Al cierre del semestre académico',
    destinatario: 'Comisión de Tutoría de la escuela profesional',
  },
  F10: {
    periodicidad: 'Encuesta por semestre académico (art. 19.h)',
    destinatario: 'Responsable del Sistema de Tutoría (art. 12.g)',
  },
  F11: {
    periodicidad: 'Encuesta por semestre académico (art. 19.h)',
    destinatario: 'Responsable del Sistema de Tutoría (art. 12.g)',
  },
  F12: {
    periodicidad: 'Cuando el caso excede la competencia del tutor (art. 17.o)',
    destinatario: 'Área especializada de destino y copia en el expediente tutorial',
  },
};

function definicion(
  codigo: CodigoFormato,
  nombre: string,
  actor: DefinicionFormato['actor'],
  momento: string,
  secciones: SeccionFormato[],
  proposito: string,
): DefinicionFormato {
  const meta = PERIODICIDAD[codigo];
  return {
    codigo,
    numero: codigo.slice(1),
    nombre,
    actor,
    actorEtiqueta:
      actor === 'tutorado'
        ? 'Estudiante'
        : actor === 'equipo-tutores'
          ? 'Comisión de tutoría'
          : 'Docente tutor',
    momento,
    periodicidad: meta.periodicidad,
    destinatario: meta.destinatario,
    secciones,
    proposito,
    obligatorio: true,
    version: VERSION_INSTRUMENTOS,
    vigencia: VIGENCIA_INSTRUMENTOS,
    aprobacion: APROBACION_INSTRUMENTOS,
    visaciones:
      actor === 'equipo-tutores'
        ? ['Comisión de tutoría', 'V.º B.º del decano']
        : actor === 'tutorado'
          ? ['Tutorado']
          : ['Docente tutor'],
  };
}

export const definicionesFormato: DefinicionFormato[] = [
  definicion(
    'F01',
    'Informe de actividades del proceso tutorial',
    'equipo-tutores',
    'Al finalizar el semestre · comisión de tutoría',
    [
      s('Identificación', [
        c('facultad', 'Facultad o escuela profesional'),
        c('comision', 'Integrantes de la comisión de acción tutorial', 'texto-largo'),
      ]),
      s('Actividades del proceso tutorial', [
        tabla('actividades', 'Actividades ejecutadas', [
          col('problematica', 'Problemática priorizada'),
          col('meta', 'Meta'),
          col('fecha', 'Fecha de realización', 'fecha'),
          col('justificacion', 'Justificación'),
          col('evidencia', 'Evidencia'),
        ]),
      ]),
      s('Observaciones', [c('observaciones', 'Observaciones', 'texto-largo', false)]),
    ],
    'La comisión consolida el proceso tutorial y solicita el visto bueno del decano.',
  ),
  definicion(
    'F02',
    'Informe de actividades del tutor',
    'tutor',
    'Al finalizar el semestre',
    [
      tutor,
      s('Estudiantes atendidos', [
        c('atendidosIndividual', 'Estudiantes atendidos en tutoría individual', 'numero'),
        c('ciclosIndividual', 'Ciclos atendidos en tutoría individual', 'texto'),
        c('individuales', 'Número de sesiones individuales', 'numero'),
        c('atendidosGrupal', 'Estudiantes atendidos en tutoría grupal', 'numero'),
        c('ciclosGrupal', 'Ciclos atendidos en tutoría grupal', 'texto'),
        c('grupales', 'Número de sesiones grupales', 'numero'),
      ]),
      s('Dificultades académicas más comunes', [
        tabla(
          'dificultadesAcademicas',
          'Dificultades, actividades y resultados',
          [
            col('dificultad', 'Dificultad académica'),
            col('actividad', 'Actividad recomendada'),
            col('resultado', 'Resultado observado'),
          ],
          false,
        ),
      ]),
      s('Dificultades para realizar la tutoría', [
        tabla(
          'dificultadesTutoria',
          'Dificultades en la tutoría',
          [
            col('dificultad', 'Dificultad'),
            col('atencion', 'Tipo de atención realizada'),
            col('resultado', 'Resultado observado'),
          ],
          false,
        ),
      ]),
      s('Dificultades personales identificadas', [
        tabla(
          'dificultadesPersonales',
          'Acompañamiento realizado',
          [
            col('dificultad', 'Dificultad personal'),
            col('atencion', 'Tipo de atención realizada'),
            col('resultado', 'Resultado observado'),
          ],
          false,
        ),
      ]),
      s('Observaciones generales', [
        c('observaciones', 'Observaciones generales', 'texto-largo', false),
      ]),
    ],
    'Resume las atenciones y sus resultados. Los totales se precargan desde las sesiones registradas.',
  ),
  definicion(
    'F03',
    'Entrevista inicial al estudiante ingresante',
    'tutorado',
    'Al inicio del semestre · ciclo I',
    [
      estudiante,
      s('Trayectoria académica', [
        c('colegio', 'Colegio de procedencia'),
        c('promedioSecundaria', 'Promedio general de secundaria', 'numero', false),
        opciones(
          'materiasSecundaria',
          'Materias que se te dificultaron en secundaria',
          ['Matemática', 'Comunicación', 'Ciencia y Tecnología', 'Inglés', 'Ninguna', 'Otro'],
          true,
          false,
        ),
      ]),
      s('Expectativas de la tutoría', [
        opciones('conoceTutoria', '¿Sabes qué es una tutoría?', SI_NO),
        opciones(
          'expectativas',
          '¿Qué esperas de una tutoría?',
          [
            'Adaptarme a la universidad',
            'Mejorar mi forma de estudiar',
            'Organizar mi tiempo',
            'Conocer los servicios de apoyo',
            'Otro',
          ],
          true,
        ),
      ]),
      s('Motivación y carrera', [
        opciones(
          'eleccionCarrera',
          '¿Qué influyó para elegir esta carrera?',
          ['Interés personal', 'Aptitudes', 'Familia', 'Oportunidades laborales', 'Otro'],
          true,
        ),
        opciones(
          'expectativaCarrera',
          '¿Qué esperas de tu carrera profesional?',
          [
            'Desarrollar mi vocación',
            'Trabajar en mi especialidad',
            'Investigar',
            'Emprender',
            'Otro',
          ],
          true,
        ),
        opciones(
          'expectativaUniversidad',
          '¿Qué esperas de la universidad y la facultad?',
          ['Buena formación', 'Acompañamiento', 'Prácticas', 'Investigación', 'Otro'],
          true,
        ),
      ]),
      s('Un día en la universidad y el hogar', [
        tabla(
          'administracionTiempo',
          'Tus actividades y el tiempo que les dedicas',
          [col('actividad', 'Actividad'), col('horas', 'Horas al día', 'numero')],
          false,
        ),
      ]),
      s('Tu forma de estudiar', [
        c('horasEstudio', '¿Cuántas horas al día dedicas al estudio?', 'numero'),
        opciones('tiempoSuficiente', '¿El tiempo que utilizas para estudiar es suficiente?', SI_NO),
        opciones(
          'formaEstudio',
          'Cuando estudias, ¿cómo prefieres hacerlo?',
          [
            'Individual',
            'En grupo',
            'Haciendo acordeón',
            'En tu cuarto',
            'Al aire libre',
            'Con música',
            'Repasando en silencio',
            'Repasando en voz alta',
            'Generalmente no estudio',
            'Otro',
          ],
          true,
        ),
        opciones(
          'estudioEfectivo',
          '¿Tu forma de estudiar te resulta efectiva para los exámenes?',
          ['Sí', 'A veces', 'No'],
        ),
      ]),
    ],
    'Cuéntale a tu tutor cómo llegas a la universidad y qué apoyo necesitas.',
  ),
  definicion(
    'F04',
    'Entrevista inicial al estudiante de ciclos intermedios',
    'tutorado',
    'Al inicio del semestre · ciclos II a VII',
    [
      estudiante,
      s('Trayectoria académica', [c('colegio', 'Colegio de procedencia', 'texto', false)]),
      expectativas,
      motivacion,
      tiempo,
      estrategias,
      socioemocional,
      rasgos,
    ],
    'Actualiza tu situación al iniciar el semestre para preparar el acompañamiento con tu tutor.',
  ),
  definicion(
    'F05',
    'Entrevista inicial al estudiante de ciclos finales',
    'tutorado',
    'Al inicio del semestre · ciclo VIII en adelante',
    [
      estudiante,
      s('Trayectoria académica', [c('colegio', 'Colegio de procedencia', 'texto', false)]),
      expectativas,
      s(
        'Campo laboral',
        [
          'He logrado clarificar en qué puedo trabajar',
          'He aprendido dónde puedo buscar trabajo y cursos de formación',
          'Me siento capaz de redactar mi currículum',
          'Me siento capaz de redactar una carta de presentación',
          'Me siento más capacitado para afrontar con éxito una entrevista de trabajo',
          'He logrado construir un proyecto profesional durante la tutoría',
          'El tiempo de duración de la acción de tutoría ha sido adecuado',
          'He mejorado mis habilidades y capacidades comunicativas',
          'Creo que ahora tengo más posibilidades de encontrar trabajo',
        ].map((etiqueta, i) => opciones(`laboral${i + 1}`, etiqueta, SI_NO)),
      ),
      motivacion,
      tiempo,
      estrategias,
      socioemocional,
      rasgos,
    ],
    'Revisa tus hábitos de estudio y tu preparación para el campo laboral.',
  ),
  definicion(
    'F06',
    'Registro de asistencia: tutoría individual',
    'tutor',
    'Durante el semestre · en cada sesión individual',
    [
      tutor,
      s('Horario de la atención', [
        c('horaInicio', 'Hora de inicio', 'hora'),
        c('horaFin', 'Hora de fin', 'hora'),
      ]),
      s('Asistencia individual', [
        tabla('asistentes', 'Registro de estudiantes', [
          col('nombre', 'Apellidos y nombres'),
          col('grupo', 'Grupo'),
          {
            codigo: 'tipo',
            etiqueta: 'Tipo de tutoría',
            tipo: 'seleccion',
            opciones: ['Académica', 'Personal', 'Social'],
          },
        ]),
      ]),
    ],
    'Registra a quién atendiste y el tipo de tutoría. La firma del estudiante se recoge fuera de esta demostración.',
  ),
  definicion(
    'F07',
    'Registro de asistencia: tutoría grupal',
    'tutor',
    'Durante el semestre · en cada actividad grupal',
    [
      tutor,
      s('Actividad grupal', [
        c('grupo', 'Grupo'),
        opciones('tema', 'Tema o título de la actividad', [
          'Técnicas de estudio',
          'Organización del tiempo',
          'Adaptación universitaria',
          'Bienestar emocional',
          'Orientación laboral',
          'Otro',
        ]),
        c('horaInicio', 'Hora de inicio', 'hora'),
        c('horaFin', 'Hora de fin', 'hora'),
      ]),
      s('Asistencia grupal', [
        tabla('asistentes', 'Participantes de la actividad', [
          col('nombre', 'Apellidos y nombres'),
          col('ciclo', 'Ciclo', 'numero'),
        ]),
      ]),
    ],
    'Registra el tema, la fecha y los participantes. Las firmas no se simulan.',
  ),
  definicion(
    'F08',
    'Registro de atención personalizada al estudiante',
    'tutor',
    'Durante el semestre · al identificar un caso',
    [
      tutor,
      s('Estudiante atendido', [
        c('nombreEstudiante', 'Estudiante'),
        c('ciclo', 'Ciclo', 'numero'),
        c('grupo', 'Grupo'),
      ]),
      s('Motivo de atención', [
        opciones('motivo', '¿Qué motivó la atención?', [
          'Dificultades de estudio',
          'Organización del tiempo',
          'Riesgo académico',
          'Situación personal',
          'Situación familiar',
          'Necesidad de apoyo especializado',
          'Otro',
        ]),
        c('detalleMotivo', 'Detalle que ayude al acompañamiento', 'texto-largo', false),
      ]),
      s('Proceso de atención', [
        opciones('resultado', '¿Cómo continúa la atención?', [
          'Se resuelve con la asesoría',
          'Se programa nueva cita para seguimiento',
          'Se deriva a:',
        ]),
        condicional(c('proximaCita', 'Fecha de la nueva cita', 'fecha'), 'resultado', [
          'Se programa nueva cita para seguimiento',
        ]),
        condicional(c('horaCita', 'Hora de inicio de la nueva cita', 'hora'), 'resultado', [
          'Se programa nueva cita para seguimiento',
        ]),
        condicional(c('horaFinCita', 'Hora de fin de la nueva cita', 'hora'), 'resultado', [
          'Se programa nueva cita para seguimiento',
        ]),
        condicional(
          c('areaDerivacion', 'Área a la que se deriva', 'seleccion', true, AREAS),
          'resultado',
          ['Se deriva a:'],
        ),
      ]),
    ],
    'Registra el caso y decide si se resuelve, requiere seguimiento o necesita una derivación.',
  ),
  definicion(
    'F09',
    'Autoevaluación de la actividad tutorial',
    'tutor',
    'Durante el semestre y al finalizarlo',
    [
      s('Tu grupo de tutoría', [
        c('nombreTutor', 'Docente tutor'),
        c('gruposAsignados', 'Número de grupos asignados', 'numero'),
        c('estudiantesAsignados', 'Número de estudiantes', 'numero'),
      ]),
      s(
        'Actividades realizadas',
        [
          'Participé en el curso inductivo para favorecer la integración del equipo de tutores',
          'Conozco personalmente a cada uno de los tutorados',
          'Realicé un diagnóstico de hábitos, estrategias y técnicas de estudio de mis tutorados',
          'Elaboré con el equipo de tutores el Plan de Acción Tutorial',
          'Colaboré con el equipo de tutores en las actividades planeadas',
          'Llevé a cabo el seguimiento académico de los estudiantes de alto riesgo',
          'Derivé a estudiantes que requerían atención especializada',
          'Convoqué a padres de estudiantes cuando fue necesario',
          'Mantuve contacto con docentes para conocer la situación académica de mis tutorados',
          'Realicé actividades preventivas con mi grupo de tutorados',
        ].map((etiqueta, i) => ({
          ...opciones(`actividad${i + 1}`, etiqueta, ['Realizada', 'No realizada']),
          ayuda: '«Realizada» equivale a marcar X en el formato oficial.',
        })),
      ),
      s('Observaciones', [c('observaciones', 'Observaciones', 'texto-largo', false)]),
    ],
    'Marca las actividades que realizaste. Puedes preparar el registro durante el semestre y enviarlo al cierre.',
  ),
  definicion(
    'F10',
    'Evaluación de la tutoría individual',
    'tutorado',
    'Al finalizar el semestre',
    [
      s('Datos de la evaluación', [
        c('grupo', 'Grupo'),
        c('turno', 'Turno', 'seleccion', false, ['Mañana', 'Tarde', 'Noche']),
        c('fecha', 'Fecha', 'fecha'),
      ]),
      ...[
        [
          'Atención y confianza',
          [
            'Mostró buena disposición para atenderme',
            'Logró un clima de confianza',
            'Su trato fue respetuoso',
            'Mostró interés en los problemas académicos y personales que afectan mi rendimiento',
            'Mostró capacidad de escucha y empatía',
          ],
        ],
        [
          'Acompañamiento recibido',
          [
            'Mostró disposición para mantener una comunicación permanente',
            'Me ayudó a resolver dudas académicas y/o personales',
            'Me ofreció asesoría respecto a técnicas de estudio',
            'Me motivó para continuar en mis estudios',
          ],
        ],
        [
          'Resultados de la tutoría',
          [
            'El tiempo que destinó mi tutor para atenderme fue el necesario',
            'Fue fácil localizar a mi tutor cuando lo necesitaba',
            'Me derivó si necesité apoyo profesional en otras instancias',
            'Participar en el Programa de Tutoría ha hecho que mejore mi rendimiento académico',
            'Me siento conforme con el tutor que me asignaron',
          ],
        ],
      ].map(([titulo, preguntas], seccionIndex) =>
        s(
          titulo as string,
          (preguntas as string[]).map((etiqueta, i) =>
            opciones(
              `p${String(([0, 5, 9][seccionIndex] ?? 0) + i + 1).padStart(2, '0')}`,
              etiqueta,
              ACUERDO,
            ),
          ),
        ),
      ),
      s('Sugerencias', [
        opciones('tieneSugerencia', '¿Tienes alguna sugerencia para mejorar la tutoría?', [
          'Sí',
          'No, todo bien',
        ]),
        condicional(c('sugerencia', 'Tu sugerencia', 'texto-largo'), 'tieneSugerencia', ['Sí']),
      ]),
    ],
    'Evalúa la tutoría individual recibida con la escala A–D del anexo.',
  ),
  definicion(
    'F11',
    'Evaluación del desempeño de tutoría grupal',
    'tutorado',
    'Al finalizar el semestre',
    [
      s('Datos de la evaluación', [
        c('nombreTutor', 'Nombre de tu tutor'),
        c('fecha', 'Fecha de aplicación', 'fecha'),
      ]),
      ...[
        [
          'Atención al grupo',
          [
            'Mostró buena disposición para atender las necesidades de la tutoría grupal',
            'Generó un clima de confianza en el grupo',
            'Trató con respeto y cordialidad al grupo de estudiantes',
            'Tiene las competencias para orientar al grupo con respecto a sus necesidades',
          ],
        ],
        [
          'Orientación y apoyo',
          [
            'Utilizó estrategias didácticas útiles para los temas que expuso',
            'Dio a conocer el programa de atención tutorial',
            'Se mostró interesado por los problemas que manifestó el grupo',
            'Dio soluciones a los problemas que como grupo presentan',
          ],
        ],
        [
          'Participación y seguimiento',
          [
            'Abordó temas de interés grupal para mejorar el rendimiento académico',
            'Estuvo cuando lo necesitan como grupo de su asesoría',
            'Aplicó algún cuestionario al inicio de la tutoría sobre la problemática del grupo',
            'Generó motivación y participación en el grupo',
            'Identificó problemáticas y/o necesidades del grupo',
          ],
        ],
      ].map(([titulo, preguntas], seccionIndex) =>
        s(
          titulo as string,
          (preguntas as string[]).map((etiqueta, i) =>
            opciones(`p${String(seccionIndex * 4 + i + 1).padStart(2, '0')}`, etiqueta, [
              'Sí',
              'A veces',
              'No',
            ]),
          ),
        ),
      ),
    ],
    'Evalúa las 13 preguntas del anexo grupal con sus opciones: Sí, A veces y No.',
  ),
  definicion(
    'F12',
    'Ficha de derivación',
    'tutor',
    'Durante el semestre · al detectar problemas no académicos',
    [
      s('Estudiante y docente', [
        c('fecha', 'Fecha de derivación', 'fecha'),
        c('nombreEstudiante', 'Apellidos y nombres del estudiante'),
        c('ciclo', 'Ciclo', 'numero'),
        c('escuela', 'Escuela profesional'),
        c('codigo', 'Código universitario'),
        c('telefono', 'Teléfono del estudiante'),
        c('nombreTutor', 'Docente tutor'),
        c('telefonoTutor', 'Teléfono del docente tutor'),
      ]),
      s('Derivación al área especializada', [
        c('area', 'Área de destino', 'seleccion', true, AREAS),
        opciones('motivo', 'Motivo de derivación', [
          'Apoyo emocional',
          'Dificultades de aprendizaje',
          'Atención de salud',
          'Situación económica o familiar',
          'Otro',
        ]),
        c('detalle', 'Información necesaria para la atención', 'texto-largo', false),
      ]),
    ],
    'El docente deriva el caso al área adecuada y mantiene el seguimiento tutorial.',
  ),
];

export const definicionPorCodigo = (codigo: CodigoFormato): DefinicionFormato | undefined =>
  definicionesFormato.find((formato) => formato.codigo === codigo);
