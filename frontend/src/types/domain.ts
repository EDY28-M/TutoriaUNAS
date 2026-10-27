/**
 * Modelo de dominio del Sistema de Tutoría UNAS.
 *
 * Los nombres de campos provienen de la Resolución N.º 500-2022-CU-R-UNAS
 * (formatos 01 a 12), de las actas del 6 y 7 de octubre de 2026 y de las nueve
 * solicitudes de datos dirigidas a las áreas institucionales. Todos los valores
 * de `src/data` son ficticios y sirven únicamente para la demostración.
 */

/* ==========================================================================
   Catálogos institucionales
   ========================================================================== */

export interface Facultad {
  id: string;
  nombre: string;
  abreviatura: string;
}

export interface Escuela {
  id: string;
  nombre: string;
  abreviatura: string;
  facultadId: string;
}

export interface Semestre {
  id: string;
  nombre: string;
  inicio: string;
  fin: string;
  matriculaInicio: string;
  matriculaFin: string;
  estado: 'planificado' | 'en-curso' | 'cerrado';
}

export interface Curso {
  id: string;
  codigo: string;
  nombre: string;
  creditos: number;
  ciclo: number;
  escuelaId: string;
}

export type EtapaAcademica = 'ingresante' | 'intermedio' | 'final';

export type EstadoAcademico =
  'regular' | 'observado' | 'reserva' | 'retirado' | 'egresado' | 'ingresante';

/* ==========================================================================
   Personas
   ========================================================================== */

export interface Estudiante {
  id: string;
  codigo: string;
  apellidos: string;
  nombres: string;
  escuelaId: string;
  ciclo: number;
  etapa: EtapaAcademica;
  estado: EstadoAcademico;
  correo: string;
  telefono: string;
  ingreso: string;
  promedioPonderado: number;
  creditosAprobados: number;
  creditosTotales: number;
  alertas: AlertaAcademica[];
}

export type NivelAlerta = 'alta' | 'media' | 'baja';

export interface AlertaAcademica {
  id: string;
  tipo: 'riesgo-academico' | 'repitencia' | 'inasistencia-tutoria' | 'carga-creditos' | 'bienestar';
  nivel: NivelAlerta;
  detalle: string;
  detectada: string;
}

export interface Docente {
  id: string;
  codigo: string;
  apellidos: string;
  nombres: string;
  escuelaId: string;
  departamento: string;
  categoria: 'Principal' | 'Asociado' | 'Auxiliar' | 'Jefe de Práctica';
  dedicacion: 'Tiempo completo' | 'Dedicación exclusiva' | 'Tiempo parcial';
  correo: string;
  telefono: string;
  activo: boolean;
  aforoMaximo: number;
  cursosAsignados: string[];
}

export interface MiembroComision {
  id: string;
  docenteId: string | null;
  nombres: string;
  cargoTutorial:
    | 'Coordinador de tutoría'
    | 'Presidente de comisión'
    | 'Secretario técnico'
    | 'Responsable de Tutoría y Capacitación Docente';
  ambito: string;
  correo: string;
  vigenciaInicio: string;
  vigenciaFin: string | null;
  actaDesignacion: string;
}

/* ==========================================================================
   Asignación tutorial
   ========================================================================== */

export interface Asignacion {
  id: string;
  estudianteId: string;
  tutorId: string;
  semestreId: string;
  escuelaId: string;
  grupo: string | null;
  fechaInicio: string;
  fechaFin: string | null;
  estado: 'activa' | 'finalizada' | 'reemplazada';
  criterio: 'asignación directiva' | 'afinidad de curso' | 'elección del tutorado' | 'sorteo';
  referenciaAprobacion: string;
  historial: CambioTutor[];
}

export interface CambioTutor {
  fecha: string;
  tutorAnteriorId: string | null;
  tutorNuevoId: string;
  motivo: string;
  responsable: string;
}

/* ==========================================================================
   Horarios y sesiones
   ========================================================================== */

export interface BloqueHorario {
  id: string;
  titulo: string;
  dia: number; // 1 = lunes … 7 = domingo
  horaInicio: string;
  horaFin: string;
  modalidad: 'presencial' | 'virtual' | 'mixta';
  lugar: string;
  tipo: 'academico' | 'tutoria' | 'atención' | 'institucional';
  tutorId?: string;
  estudianteId?: string;
  cursoId?: string;
}

export interface BloqueTutoria {
  id: string;
  tutorId: string;
  semana: string;
  dia: number;
  horaInicio: string;
  horaFin: string;
  modalidad: 'presencial' | 'virtual' | 'mixta';
  lugar: string;
  vigenciaInicio: string;
  vigenciaFin: string | null;
  cupos: number;
}

export type ModalidadSesion = 'individual' | 'grupal';
export type EstadoSesion = 'programada' | 'realizada' | 'reprogramada' | 'cancelada';

export interface Sesion {
  id: string;
  codigo: string;
  tipo: ModalidadSesion;
  tutorId: string;
  semestreId: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  modalidad: 'presencial' | 'virtual' | 'mixta';
  lugar: string;
  tema: string;
  objetivo: string;
  estado: EstadoSesion;
  asistentes: AsistenciaSesion[];
  acuerdos: Acuerdo[];
  instrumentoId: string | null;
  observacion: string | null;
  /** Confirmación del tutor; no equivale a la convocatoria de una sesión programada. */
  asistenciaConfirmada?: boolean;
}

export interface AsistenciaSesion {
  estudianteId: string;
  estado: 'asistio' | 'tarde' | 'falto' | 'justificado';
  horaRegistro: string | null;
  observacion: string | null;
}

export interface Acuerdo {
  id: string;
  descripcion: string;
  responsable: 'tutor' | 'tutorado' | 'ambos';
  fechaCompromiso: string | null;
  estado: 'pendiente' | 'cumplido' | 'vencido';
}

/* ==========================================================================
   Instrumentos (formatos 01 a 12)
   ========================================================================== */

export type CodigoFormato =
  'F01' | 'F02' | 'F03' | 'F04' | 'F05' | 'F06' | 'F07' | 'F08' | 'F09' | 'F10' | 'F11' | 'F12';

export type ActorFormato = 'tutor' | 'tutorado' | 'equipo-tutores' | 'coordinacion';

export type EstadoInstrumento =
  'no-iniciado' | 'borrador' | 'enviado' | 'observado' | 'aprobado' | 'vencido';

export interface DefinicionFormato {
  codigo: CodigoFormato;
  numero: string;
  nombre: string;
  proposito: string;
  actor: ActorFormato;
  actorEtiqueta: string;
  momento: string;
  periodicidad: string;
  destinatario: string;
  obligatorio: boolean;
  secciones: SeccionFormato[];
  visaciones: string[];
  version: string;
  vigencia: string;
  aprobacion: string;
}

export interface SeccionFormato {
  titulo: string;
  campos: CampoFormato[];
}

export interface CampoFormato {
  codigo: string;
  etiqueta: string;
  tipo:
    | 'texto'
    | 'texto-largo'
    | 'numero'
    | 'fecha'
    | 'hora'
    | 'seleccion'
    | 'multiple'
    | 'booleano'
    | 'tabla'
    | 'escala';
  opciones?: string[];
  obligatorio: boolean;
  ayuda?: string;
  /** Columnas de una tabla editable; las respuestas se serializan como filas JSON. */
  columnas?: {
    codigo: string;
    etiqueta: string;
    tipo?: 'texto' | 'numero' | 'fecha' | 'seleccion';
    opciones?: string[];
  }[];
  /** Pregunta de seguimiento que solo aparece para estas respuestas. */
  visibleSi?: { campo: string; valores: string[] };
}

export interface Instrumento {
  id: string;
  formato: CodigoFormato;
  semestreId: string;
  tutorId: string;
  estudianteId: string | null;
  sesionId: string | null;
  estado: EstadoInstrumento;
  avance: number;
  version: number;
  creado: string;
  actualizado: string;
  enviado: string | null;
  revisadoPor: string | null;
  observaciones: ObservacionInstrumento[];
  descargaDisponible: boolean;
  respuestas: Record<string, string>;
}

export interface ObservacionInstrumento {
  id: string;
  autor: string;
  fecha: string;
  texto: string;
  estado: 'abierta' | 'subsanada';
}

/* ==========================================================================
   Derivaciones (formato 12)
   ========================================================================== */

export type AreaDerivacion =
  'tutoria-academica' | 'psicologia' | 'psicopedagogia' | 'medicina' | 'bienestar-social';

export type EstadoDerivacion =
  | 'registrada'
  | 'recibida'
  | 'citada'
  | 'en-atencion'
  | 'atendida'
  | 'seguimiento'
  | 'cerrada'
  | 'no-presentado';

export interface Derivacion {
  id: string;
  codigo: string;
  formato: 'F12';
  estudianteId: string;
  tutorId: string;
  semestreId: string;
  area: AreaDerivacion;
  motivo: string;
  detalle: string;
  prioridad: 'alta' | 'media' | 'baja';
  fechaDerivacion: string;
  fechaRecepcion: string | null;
  fechaCita: string | null;
  fechaAtencion: string | null;
  estado: EstadoDerivacion;
  responsableArea: string;
  siguienteAccion: string;
  actualizado: string;
  recomendacionComunicable: string | null;
  vigenciaRecomendacion: string | null;
  historial: EventoDerivacion[];
}

export interface EventoDerivacion {
  fecha: string;
  estado: EstadoDerivacion;
  nota: string;
  responsable: string;
}

/* ==========================================================================
   Expediente académico (fuente: DIAA). El SIS (Seguro Integral de Salud) vive en salud.
   ========================================================================== */

export interface Matricula {
  estudianteId: string;
  semestreId: string;
  fecha: string;
  estado: 'matriculado' | 'reserva' | 'retiro' | 'no-matriculado';
  planEstudios: string;
  ciclo: number;
  cursos: MatriculaCurso[];
}

export interface MatriculaCurso {
  cursoId: string;
  seccion: string;
  creditos: number;
  docente: string;
  horario: string;
}

export interface ResultadoAcademico {
  id: string;
  estudianteId: string;
  semestreId: string;
  cursoId: string;
  notaFinal: number | null;
  estado: 'aprobado' | 'desaprobado' | 'en-curso' | 'retirado';
  creditos: number;
  vecesCursado: number;
  evaluaciones: EvaluacionCurso[];
}

export interface EvaluacionCurso {
  nombre: string;
  peso: number;
  nota: number | null;
}

export interface ResumenAcademico {
  estudianteId: string;
  semestreId: string;
  promedioSemestre: number | null;
  promedioPonderado: number;
  creditosMatriculados: number;
  creditosAprobados: number;
  cursosDesaprobados: number;
  avanceCurricular: number;
  posicion: number | null;
  fuente: string;
  fechaCorte: string;
}

/* ==========================================================================
   Salud y bienestar (datos comunicables, sin historia clínica)
   ========================================================================== */

export type ServicioSalud =
  | 'medicina'
  | 'enfermeria'
  | 'topico'
  | 'psicologia'
  | 'psicopedagogia'
  | 'servicio-social'
  | 'comedor'
  | 'residencia';

export interface ServicioBienestar {
  id: string;
  servicio: ServicioSalud;
  nombre: string;
  responsable: string;
  correo: string;
  telefono: string;
  horario: string;
  ubicacion: string;
  requisitos: string;
  canalCita: string;
}

export type EstadoAfiliacionSis = 'vigente' | 'no-vigente' | 'en-tramite';

/** Afiliación al Seguro Integral de Salud. Requisito del usuario, no de la Resolución 500-2022. */
export interface AfiliacionSis {
  estudianteId: string;
  estado: EstadoAfiliacionSis;
  fechaCorte: string;
  nota: string;
}

export interface AtencionSalud {
  id: string;
  estudianteId: string;
  servicio: ServicioSalud;
  fecha: string;
  hora: string;
  motivo: string;
  profesional: string;
  tipo: 'consulta' | 'control' | 'campaña' | 'emergencia';
  estado: 'programada' | 'atendida' | 'no-asistio' | 'reprogramada';
  recomendacionAcademica: string | null;
  vigenciaRecomendacion: string | null;
  confidencial: boolean;
}

export interface CampanaSalud {
  id: string;
  tema: string;
  fecha: string;
  hora: string;
  canal: string;
  lugar: string;
  escuelas: string[];
  cupos: number;
  inscritos: number;
}

export interface BeneficioSocial {
  id: string;
  estudianteId: string;
  tipo: 'comedor' | 'residencia' | 'beca' | 'movilidad' | 'materiales';
  estado: 'activo' | 'en-evaluacion' | 'suspendido' | 'finalizado';
  inicio: string;
  fin: string | null;
  fuente: string;
}

export interface ApoyoComunicable {
  id: string;
  estudianteId: string;
  area: AreaDerivacion;
  necesidad: string;
  apoyoRecomendado: string;
  prioridad: 'alta' | 'media' | 'baja';
  fecha: string;
  vigencia: string;
  autorizadoPor: string;
}

/* ==========================================================================
   Plan de acción tutorial y revisiones
   ========================================================================== */

export interface ActividadPlan {
  id: string;
  semestreId: string;
  escuelaId: string;
  problematica: string;
  objetivo: string;
  actividad: string;
  meta: string;
  fechaInicio: string;
  fechaFin: string;
  responsable: string;
  evidencia: string;
  avance: number;
  estado: 'planificada' | 'en-ejecucion' | 'culminada' | 'reprogramada';
  aprobacion: string;
}

export interface RevisionInforme {
  id: string;
  instrumentoId: string;
  formato: CodigoFormato;
  revisor: string;
  ambito: string;
  estado: 'pendiente' | 'observado' | 'aprobado';
  fecha: string;
  comentario: string;
}

/* ==========================================================================
   Comunicación y trazabilidad
   ========================================================================== */

export interface Aviso {
  id: string;
  asunto: string;
  cuerpo: string;
  destinatarios: string[];
  canal: 'correo' | 'sistema';
  enviado: string;
  estado: 'enviado' | 'programado' | 'borrador' | 'fallido';
  plantilla: string;
  relacionadoCon: string | null;
}

export interface Notificacion {
  id: string;
  titulo: string;
  detalle: string;
  fecha: string;
  leida: boolean;
  tipo: 'sesion' | 'instrumento' | 'derivacion' | 'academico' | 'sistema';
  enlace: string | null;
}

export interface EventoAuditoria {
  id: string;
  fecha: string;
  actor: string;
  rol: string;
  accion: string;
  entidad: string;
  detalle: string;
  origenIp: string;
  descarga: boolean;
}

/* ==========================================================================
   Configuración institucional del sistema
   ========================================================================== */

export interface InsumoSolicitud {
  id: string;
  area: string;
  insumoPrioritario: string;
  aplicacion: string;
  estado: 'entregado' | 'parcial' | 'pendiente' | 'no-autorizado';
  fechaSolicitud: string;
  fechaRespuesta: string | null;
  responsable: string;
  observacion: string;
}

export interface ReglaTutoria {
  id: string;
  codigo: string;
  descripcion: string;
  valor: string;
  estado: 'validada' | 'propuesta' | 'pendiente-validacion';
  fuente: string;
}

export interface PermisoRol {
  id: string;
  rol: 'estudiante' | 'tutor' | 'coordinacion' | 'administracion';
  recurso: string;
  acciones: AccionPermiso[];
}

export type AccionPermiso =
  'ver' | 'crear' | 'editar' | 'revisar' | 'aprobar' | 'descargar' | 'eliminar';
