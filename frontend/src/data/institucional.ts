import type {
  Aviso,
  EventoAuditoria,
  InsumoSolicitud,
  Notificacion,
  PermisoRol,
  ReglaTutoria,
} from '../types/domain';
import { HOY } from './tutoria';

/**
 * Comunicación, configuración institucional y trazabilidad.
 *
 * Los avisos representan las notificaciones que el sistema enviaría por correo
 * institucional cuando el servicio esté habilitado por la OTIC (solicitud
 * 05_Tecnologias_Informacion). El estado de los insumos refleja el seguimiento
 * de las nueve solicitudes de datos.
 */

export const avisos: Aviso[] = [
  {
    id: 'AV-001',
    asunto: 'Recordatorio: sesión de tutoría programada',
    cuerpo:
      'Se le recuerda que tiene una sesión de tutoría individual programada. Confirme su asistencia desde el sistema o comuníquese con su docente tutor.',
    destinatarios: ['2023010456@unas.edu.pe', '2023010457@unas.edu.pe'],
    canal: 'correo',
    enviado: '2026-10-13T07:30:00',
    estado: 'enviado',
    plantilla: 'recordatorio-sesion',
    relacionadoCon: 'SES-ASG-2023010456-3',
  },
  {
    id: 'AV-002',
    asunto: 'Instrumento pendiente de llenado',
    cuerpo:
      'La entrevista inicial correspondiente a su etapa académica se encuentra pendiente. Complete el formulario antes del cierre del periodo.',
    destinatarios: ['2023010461@unas.edu.pe', '2023010481@unas.edu.pe', '2023010501@unas.edu.pe'],
    canal: 'correo',
    enviado: '2026-10-12T09:00:00',
    estado: 'enviado',
    plantilla: 'instrumento-pendiente',
    relacionadoCon: 'INST-F04-2023010461',
  },
  {
    id: 'AV-003',
    asunto: 'Derivación registrada y derivada al área',
    cuerpo:
      'Su ficha de derivación fue registrada y remitida al área correspondiente. Puede consultar el estado desde la sección de derivaciones.',
    destinatarios: ['2023010481@unas.edu.pe'],
    canal: 'correo',
    enviado: '2026-10-10T11:15:00',
    estado: 'enviado',
    plantilla: 'derivacion-registrada',
    relacionadoCon: 'DER-2023010481',
  },
  {
    id: 'AV-004',
    asunto: 'Cierre de semestre: informe de actividades del tutor',
    cuerpo:
      'Se encuentra habilitado el formato 02 para el registro del informe de actividades del semestre 2026-II. La fecha límite de presentación es el 15 de diciembre.',
    destinatarios: ['lvela@unas.edu.pe', 'mparedes@unas.edu.pe', 'crios@unas.edu.pe'],
    canal: 'correo',
    enviado: '2026-10-11T08:00:00',
    estado: 'enviado',
    plantilla: 'cierre-informe-tutor',
    relacionadoCon: null,
  },
  {
    id: 'AV-005',
    asunto: 'Observación registrada en el registro de asistencia',
    cuerpo:
      'El registro de asistencia de la tutoría grupal presenta una observación de la coordinación. Ingrese al sistema para revisarla y subsanarla.',
    destinatarios: ['lvela@unas.edu.pe'],
    canal: 'correo',
    enviado: '2026-10-09T16:40:00',
    estado: 'enviado',
    plantilla: 'instrumento-observado',
    relacionadoCon: 'INST-F07-SESG-E-IIS-2',
  },
  {
    id: 'AV-006',
    asunto: 'Resumen semanal de tutoría',
    cuerpo:
      'Se envía el resumen de cobertura semanal del proceso tutorial: sesiones realizadas, estudiantes atendidos e instrumentos pendientes.',
    destinatarios: ['tutoria@unas.edu.pe'],
    canal: 'correo',
    enviado: '2026-10-13T18:00:00',
    estado: 'programado',
    plantilla: 'resumen-semanal',
    relacionadoCon: null,
  },
  {
    id: 'AV-007',
    asunto: 'Recordatorio de confirmación de cita en Psicología',
    cuerpo:
      'Se le recuerda la cita programada por el Servicio de Psicología. Si no puede asistir, comuníquelo con anticipación.',
    destinatarios: ['2023010520@unas.edu.pe'],
    canal: 'correo',
    enviado: '2026-10-14T07:00:00',
    estado: 'borrador',
    plantilla: 'recordatorio-cita',
    relacionadoCon: 'DER-2023010520',
  },
];

export const notificaciones: Notificacion[] = [
  {
    id: 'NT-001',
    titulo: 'Sesión de tutoría el 27 de octubre',
    detalle: 'Su docente tutor programó una sesión individual a las 16:00.',
    fecha: '2026-10-13T07:30:00',
    leida: false,
    tipo: 'sesion',
    enlace: '/estudiante/sesiones',
  },
  {
    id: 'NT-002',
    titulo: 'Entrevista inicial pendiente',
    detalle: 'Complete el formato 04 antes del cierre del periodo.',
    fecha: '2026-10-12T09:00:00',
    leida: false,
    tipo: 'instrumento',
    enlace: '/estudiante/instrumentos',
  },
  {
    id: 'NT-003',
    titulo: 'Derivación en seguimiento',
    detalle: 'El área de Psicopedagogía registró una recomendación para su caso.',
    fecha: '2026-10-10T11:15:00',
    leida: true,
    tipo: 'derivacion',
    enlace: '/estudiante/derivaciones',
  },
  {
    id: 'NT-004',
    titulo: 'Actualización de su expediente académico',
    detalle: 'La DIAA actualizó las notas del semestre 2026-I el 13 de octubre.',
    fecha: '2026-10-13T06:00:00',
    leida: true,
    tipo: 'academico',
    enlace: '/estudiante/expediente',
  },
  {
    id: 'NT-005',
    titulo: 'Campaña de salud preventiva',
    detalle: 'Jornada de control de presión y glucosa el 21 de octubre en la explanada central.',
    fecha: '2026-10-11T10:00:00',
    leida: false,
    tipo: 'sistema',
    enlace: '/estudiante/salud',
  },
];

/* ==========================================================================
   Seguimiento de las nueve solicitudes de datos
   ========================================================================== */

export const insumos: InsumoSolicitud[] = [
  {
    id: 'INS-01',
    area: 'Gestión Pedagógica · Tutoría y Capacitación Docente',
    insumoPrioritario:
      'Plantillas oficiales de los doce formularios, reglas de campos, calendario y permisos',
    aplicacion: 'Formularios digitales, estados de presentación y reportes',
    estado: 'parcial',
    fechaSolicitud: '2026-10-09',
    fechaRespuesta: '2026-10-13',
    responsable: 'Departamento de Pedagogía',
    observacion:
      'Se recibieron los anexos de la Resolución N.º 500-2022-CU-R-UNAS. Falta confirmar vigencia y reglas de llenado por actor.',
  },
  {
    id: 'INS-02',
    area: 'DIAA · Dirección de Asuntos Académicos',
    insumoPrioritario: 'API de lectura; padrones, matrícula, cursos, notas, promedio y horarios',
    aplicacion: 'Precarga y consulta del expediente académico',
    estado: 'parcial',
    fechaSolicitud: '2026-10-09',
    fechaRespuesta: '2026-10-12',
    responsable: 'Área de Soporte Informático del Sistema de Gestión Académica',
    observacion:
      'Se confirmó el padrón de estudiantes y el horario. La API de notas y matrícula continúa en evaluación; por ahora se usa carga CSV autorizada.',
  },
  {
    id: 'INS-03',
    area: 'Decanatos y direcciones de escuela',
    insumoPrioritario: 'Asignación de tutores, comisiones, horarios y planes de acción tutorial',
    aplicacion: 'Tutorados por docente, programación y revisión por ámbito',
    estado: 'entregado',
    fechaSolicitud: '2026-10-09',
    fechaRespuesta: '2026-10-11',
    responsable: 'Comisiones de tutoría de cada facultad',
    observacion:
      'Ocho escuelas remitieron su relación de asignaciones y su plan de acción tutorial.',
  },
  {
    id: 'INS-04',
    area: 'Recursos Humanos',
    insumoPrioritario: 'Identificador docente, vigencia laboral y contactos institucionales',
    aplicacion: 'Validación de cuentas y actualización de habilitación',
    estado: 'entregado',
    fechaSolicitud: '2026-10-09',
    fechaRespuesta: '2026-10-10',
    responsable: 'Unidad de Recursos Humanos',
    observacion: 'Padrón docente validado. Se reportó un docente con vínculo concluido.',
  },
  {
    id: 'INS-05',
    area: 'OTIC · Tecnologías de la Información',
    insumoPrioritario: 'Identidad institucional, servidor, dominio, HTTPS y respaldos',
    aplicacion: 'Servicios de operación, integración y despliegue',
    estado: 'pendiente',
    fechaSolicitud: '2026-10-09',
    fechaRespuesta: null,
    responsable: 'Oficina de Tecnologías de la Información y Comunicación',
    observacion:
      'Se solicitó servidor o máquina virtual, base de datos propia, subdominio institucional y habilitación de la conexión con la API de la DIAA.',
  },
  {
    id: 'INS-06',
    area: 'Bienestar Universitario · Servicio Social',
    insumoPrioritario: 'Directorio, rutas de atención y estados de solicitudes de apoyo social',
    aplicacion: 'Derivación social y seguimiento administrativo',
    estado: 'parcial',
    fechaSolicitud: '2026-10-09',
    fechaRespuesta: '2026-10-12',
    responsable: 'Área de Servicio Social',
    observacion:
      'Se entregó el directorio. Los estados de las solicitudes de apoyo están propuestos y pendientes de validación.',
  },
  {
    id: 'INS-07',
    area: 'Medicina · Bienestar Universitario',
    insumoPrioritario:
      'Ruta de atención, recepción de solicitudes de apoyo y recomendaciones académicas',
    aplicacion: 'Seguimiento de la derivación sin historia clínica completa',
    estado: 'parcial',
    fechaSolicitud: '2026-10-09',
    fechaRespuesta: '2026-10-12',
    responsable: 'Servicio de Medicina, con coordinación de Enfermería',
    observacion:
      'Se validó la ruta y el protocolo de respuesta al tutor. Falta confirmar la base de tratamiento de datos de salud.',
  },
  {
    id: 'INS-08',
    area: 'Psicología · Bienestar Universitario',
    insumoPrioritario: 'Canales, estados y coordinación autorizada; pautas comunicables',
    aplicacion: 'Estado administrativo y apoyo tutorial pertinente',
    estado: 'entregado',
    fechaSolicitud: '2026-10-09',
    fechaRespuesta: '2026-10-13',
    responsable: 'Servicio de Psicología',
    observacion:
      'Se acordó comunicar únicamente el estado administrativo y las pautas de acompañamiento.',
  },
  {
    id: 'INS-09',
    area: 'Psicopedagogía · Bienestar Universitario',
    insumoPrioritario: 'Ruta de apoyo, recomendaciones de aprendizaje y plan de seguimiento',
    aplicacion: 'Acciones tutoriales y revisión de avances autorizados',
    estado: 'entregado',
    fechaSolicitud: '2026-10-09',
    fechaRespuesta: '2026-10-13',
    responsable: 'Servicio de Psicopedagogía',
    observacion:
      'Se recibieron las recomendaciones de aprendizaje y el plan mínimo de seguimiento.',
  },
];

/* ==========================================================================
   Reglas de tutoría y permisos
   ========================================================================== */

export const reglasTutoria: ReglaTutoria[] = [
  {
    id: 'RG-01',
    codigo: 'sesiones-periodicidad',
    descripcion: 'Periodicidad mínima de tutoría individual y grupal en el primer ciclo',
    valor:
      'Al menos una tutoría grupal y una individual al inicio del semestre para estudiantes de primer ciclo',
    estado: 'validada',
    fuente: 'Reglamento de Tutoría de Pregrado UNAS, Resolución N.º 500-2022-CU-R-UNAS, art. 17.k',
  },
  {
    id: 'RG-08',
    codigo: 'tutoria-especial',
    descripcion: 'Periodicidad de la tutoría especial presencial',
    valor: 'Presencial y obligatoria, al menos dos veces por semestre',
    estado: 'validada',
    fuente: 'Reglamento de Tutoría de Pregrado UNAS, Resolución N.º 500-2022-CU-R-UNAS, art. 17.l',
  },
  {
    id: 'RG-02',
    codigo: 'aforo-tutor',
    descripcion: 'Número máximo de tutorados por docente tutor',
    valor: 'Propuesta: entre 10 y 14 según la escuela',
    estado: 'propuesta',
    fuente: 'Acta de audiencia FIIS del 7 de octubre de 2026, punto PRIMERO',
  },
  {
    id: 'RG-03',
    codigo: 'criterio-asignacion',
    descripcion: 'Criterio de asignación del docente tutor',
    valor: 'Asignación directiva por la comisión; afinidad de curso como criterio complementario',
    estado: 'propuesta',
    fuente: 'Acta de audiencia FIIS del 7 de octubre de 2026, punto PRIMERO',
  },
  {
    id: 'RG-04',
    codigo: 'etapa-formato',
    descripcion: 'Instrumento de entrevista inicial según la etapa académica',
    valor: 'Ciclos I–II: formato 03 · Ciclos III–VII: formato 04 · Ciclos VIII–X: formato 05',
    estado: 'validada',
    fuente: 'Anexos de la Resolución N.º 500-2022-CU-R-UNAS',
  },
  {
    id: 'RG-05',
    codigo: 'conteo-cobertura',
    descripcion: 'Forma de conteo de la cobertura tutorial',
    valor: 'Separar estudiantes únicos atendidos, atenciones acumuladas y sesiones realizadas',
    estado: 'propuesta',
    fuente: 'Acta de audiencia FIIS del 7 de octubre de 2026, punto QUINTO',
  },
  {
    id: 'RG-06',
    codigo: 'matricula-condicionada',
    descripcion: 'Condicionar la matrícula a una constancia de tutoría',
    valor: 'No se configura como restricción automática',
    estado: 'pendiente-validacion',
    fuente:
      'Acta de reunión del 6 de octubre de 2026, punto SEGUNDO. Requiere disposición expresa de la autoridad.',
  },
  {
    id: 'RG-07',
    codigo: 'derivacion-acceso',
    descripcion: 'Información visible al tutor sobre una derivación',
    valor: 'Área de destino, estado administrativo y recomendación comunicable; sin diagnóstico',
    estado: 'validada',
    fuente: 'Solicitudes 07_Medicina_Salud y 08_Psicologia',
  },
];

export const permisos: PermisoRol[] = [
  {
    id: 'PM-01',
    rol: 'estudiante',
    recurso: 'Expediente académico propio',
    acciones: ['ver', 'descargar'],
  },
  {
    id: 'PM-02',
    rol: 'estudiante',
    recurso: 'Formularios de su etapa (03, 04, 05, 10, 11)',
    acciones: ['ver', 'crear', 'editar'],
  },
  { id: 'PM-03', rol: 'estudiante', recurso: 'Sesiones de tutoría propias', acciones: ['ver'] },
  {
    id: 'PM-04',
    rol: 'estudiante',
    recurso: 'Solicitudes de apoyo y recomendaciones autorizadas',
    acciones: ['ver'],
  },
  {
    id: 'PM-05',
    rol: 'estudiante',
    recurso: 'Salud y bienestar (información autorizada)',
    acciones: ['ver'],
  },
  { id: 'PM-06', rol: 'tutor', recurso: 'Estudiantes asignados', acciones: ['ver', 'descargar'] },
  {
    id: 'PM-07',
    rol: 'tutor',
    recurso: 'Formularios 01, 02, 06, 07, 08, 09 y 12',
    acciones: ['ver', 'crear', 'editar', 'descargar'],
  },
  {
    id: 'PM-08',
    rol: 'tutor',
    recurso: 'Sesiones y asistencias de sus estudiantes',
    acciones: ['ver', 'crear', 'editar'],
  },
  {
    id: 'PM-09',
    rol: 'tutor',
    recurso: 'Estado de las solicitudes de apoyo que registró',
    acciones: ['ver', 'crear', 'editar'],
  },
  {
    id: 'PM-10',
    rol: 'coordinacion',
    recurso: 'Asignaciones de su escuela',
    acciones: ['ver', 'crear', 'editar', 'aprobar'],
  },
  {
    id: 'PM-11',
    rol: 'coordinacion',
    recurso: 'Informes 01 y 02 de su escuela',
    acciones: ['ver', 'revisar', 'aprobar', 'descargar'],
  },
  {
    id: 'PM-12',
    rol: 'coordinacion',
    recurso: 'Reportes de su facultad o escuela',
    acciones: ['ver', 'descargar'],
  },
  {
    id: 'PM-13',
    rol: 'administracion',
    recurso: 'Formularios y versiones vigentes',
    acciones: ['ver', 'crear', 'editar', 'aprobar'],
  },
  {
    id: 'PM-14',
    rol: 'administracion',
    recurso: 'Roles, permisos y catálogos institucionales',
    acciones: ['ver', 'editar'],
  },
  {
    id: 'PM-15',
    rol: 'administracion',
    recurso: 'Historial de cambios',
    acciones: ['ver', 'descargar'],
  },
  {
    id: 'PM-16',
    rol: 'administracion',
    recurso: 'Reportes institucionales consolidados',
    acciones: ['ver', 'descargar'],
  },
];

/* ==========================================================================
   Auditoría
   ========================================================================== */

export const eventosAuditoria: EventoAuditoria[] = [
  {
    id: 'AU-001',
    fecha: '2026-10-14T08:12:00',
    actor: 'Luis Alberto Vela Ríos',
    rol: 'tutor',
    accion: 'Registró asistencia',
    entidad: 'Formato 06 · TUT-2026II-0012',
    detalle: 'Sesión individual con la estudiante Ana Lucía Quispe Rojas.',
    origenIp: '10.20.4.31',
    descarga: false,
  },
  {
    id: 'AU-002',
    fecha: '2026-10-14T07:55:00',
    actor: 'Ana Lucía Quispe Rojas',
    rol: 'estudiante',
    accion: 'Consultó expediente',
    entidad: 'Expediente académico',
    detalle: 'Consulta del resumen del semestre 2026-II.',
    origenIp: '10.20.7.88',
    descarga: false,
  },
  {
    id: 'AU-003',
    fecha: '2026-10-13T18:04:00',
    actor: 'Jackelin Tamayo Vela',
    rol: 'administracion',
    accion: 'Descargó reporte',
    entidad: 'Reporte de cobertura',
    detalle: 'Cobertura por escuela y semestre 2026-II.',
    origenIp: '10.20.1.12',
    descarga: true,
  },
  {
    id: 'AU-004',
    fecha: '2026-10-13T16:40:00',
    actor: 'Marta Elena Paredes Auqui',
    rol: 'coordinacion',
    accion: 'Observó instrumento',
    entidad: 'Formato 02 · DOC-0423',
    detalle: 'Solicitó precisar el número de atenciones acumuladas.',
    origenIp: '10.20.3.44',
    descarga: false,
  },
  {
    id: 'AU-005',
    fecha: '2026-10-13T11:20:00',
    actor: 'Luis Alberto Vela Ríos',
    rol: 'tutor',
    accion: 'Registró derivación',
    entidad: 'Formato 12 · DER-2026II-0007',
    detalle: 'Derivación al Servicio de Psicopedagogía.',
    origenIp: '10.20.4.31',
    descarga: false,
  },
  {
    id: 'AU-006',
    fecha: '2026-10-12T15:33:00',
    actor: 'Ps. Jorge Bermúdez Salas',
    rol: 'administracion',
    accion: 'Actualizó derivación',
    entidad: 'DER-2026II-0004',
    detalle: 'Registró la recomendación comunicable al tutor.',
    origenIp: '10.20.9.7',
    descarga: false,
  },
  {
    id: 'AU-007',
    fecha: '2026-10-12T10:05:00',
    actor: 'Carmen Julia Ríos Valverde',
    rol: 'tutor',
    accion: 'Descargó instrumento',
    entidad: 'Formato 06 · TUT-2026II-0008',
    detalle: 'Descarga en PDF del registro de asistencia.',
    origenIp: '10.20.5.19',
    descarga: true,
  },
  {
    id: 'AU-008',
    fecha: '2026-10-11T09:47:00',
    actor: 'Pedro Pablo Zavaleta Ruiz',
    rol: 'coordinacion',
    accion: 'Aprobó instrumento',
    entidad: 'Formato 01 · FIIS',
    detalle: 'Aprobación del informe consolidado de la FIIS.',
    origenIp: '10.20.2.61',
    descarga: false,
  },
  {
    id: 'AU-009',
    fecha: '2026-10-10T14:22:00',
    actor: 'Jackelin Tamayo Vela',
    rol: 'administracion',
    accion: 'Actualizó regla',
    entidad: 'Regla sesiones-periodicidad',
    detalle: 'Cambió el estado a pendiente de validación.',
    origenIp: '10.20.1.12',
    descarga: false,
  },
  {
    id: 'AU-010',
    fecha: '2026-10-09T17:10:00',
    actor: 'Servicio de Medicina',
    rol: 'administracion',
    accion: 'Rechazó acceso',
    entidad: 'Intento de consulta de historia clínica',
    detalle: 'El sistema bloqueó la consulta: el dato no está autorizado para tutoría.',
    origenIp: '10.20.9.22',
    descarga: false,
  },
];

export const HOY_AUDITORIA = HOY;
