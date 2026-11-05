import type { Asignacion, CodigoFormato, Instrumento, Sesion } from '../types/domain';
import { etapaAcademica, etapaDeCiclo } from '../data/catalogos';
import { docentePorId, estudiantePorId, nombreCompleto } from '../data/personas';
import type { MomentoTutoria } from './instrumentos';
import { sesionFinalizo } from './evaluacionesSesion';
import {
  ESTADOS_EXPORTABLES,
  documentosExportables,
  fechaOficial,
  nombreEscuela,
} from './exportFormatos';
import type { DocumentoFormato } from './exportFormatos';

/**
 * Cierre del semestre: verifica qué formatos exige la resolución en el ámbito
 * elegido (escuela y, opcionalmente, un tutor), qué falta y qué está enviado
 * sin aprobar. Nada se omite en silencio: lo que falta se lista en la portada
 * del paquete en lugar de exportar hojas vacías.
 */

export interface AmbitoCierre {
  semestreId: string;
  /** `null` = todas las escuelas. */
  escuelaId: string | null;
  /** `null` = todos los tutores del ámbito. */
  tutorId: string | null;
}

export interface Pendiente {
  referencia: string;
  situacion: string;
}

export type ClaveRequisito =
  | 'entrevistas'
  | 'asistencias'
  | 'evaluaciones'
  | 'informe-tutor'
  | 'autoevaluacion'
  | 'informe-comision';

export interface RequisitoCierre {
  clave: ClaveRequisito;
  etiqueta: string;
  formatos: string;
  /** Las evaluaciones dependen de cada estudiante: se informan, pero no bloquean el cierre. */
  obligatorio: boolean;
  esperados: number;
  completos: number;
  porRevisar: number;
  pendientes: Pendiente[];
}

export interface ResumenCierre {
  ambito: AmbitoCierre;
  momento: MomentoTutoria;
  requisitos: RequisitoCierre[];
  documentos: DocumentoFormato[];
  /** Atenciones (08) y derivaciones (12): se registran cuando ocurren; no tienen un mínimo. */
  eventuales: number;
  porRevisar: number;
  /** Pendientes de los requisitos que bloquean el cierre. */
  pendientesObligatorios: number;
  /** Todo lo obligatorio está enviado o aprobado. */
  completo: boolean;
}

const SITUACION: Record<Instrumento['estado'], string> = {
  'no-iniciado': 'No iniciado',
  borrador: 'En borrador',
  observado: 'Observado: debe corregirse',
  vencido: 'Vencido',
  enviado: 'Enviado',
  aprobado: 'Aprobado',
};

const exportable = (registro: Instrumento | undefined) =>
  Boolean(registro && ESTADOS_EXPORTABLES.includes(registro.estado));

interface Esperado {
  referencia: string;
  registro?: Instrumento;
  /** Situación cuando no existe registro (p. ej. asistencia sin confirmar). */
  sinRegistro?: string;
}

function evaluar(
  clave: ClaveRequisito,
  etiqueta: string,
  formatos: string,
  obligatorio: boolean,
  esperados: Esperado[],
): RequisitoCierre {
  const pendientes: Pendiente[] = [];
  let completos = 0;
  let porRevisar = 0;
  for (const { referencia, registro, sinRegistro } of esperados) {
    if (exportable(registro)) {
      completos += 1;
      if (registro!.estado === 'enviado') porRevisar += 1;
    } else {
      pendientes.push({
        referencia,
        situacion: registro ? SITUACION[registro.estado] : (sinRegistro ?? 'Sin registro'),
      });
    }
  }
  return {
    clave,
    etiqueta,
    formatos,
    obligatorio,
    esperados: esperados.length,
    completos,
    porRevisar,
    pendientes,
  };
}

const nombreDocente = (id: string) => {
  const docente = docentePorId(id);
  return docente ? nombreCompleto(docente) : id;
};
const nombreEstudiante = (id: string) => {
  const estudiante = estudiantePorId(id);
  return estudiante ? nombreCompleto(estudiante) : id;
};

/** Escuela a la que pertenece un registro: la del estudiante, la indicada o la del tutor. */
function escuelaDeRegistro(registro: Instrumento): string | undefined {
  if (registro.estudianteId) return estudiantePorId(registro.estudianteId)?.escuelaId;
  return registro.respuestas.escuela || docentePorId(registro.tutorId)?.escuelaId;
}

export function resumenCierre({
  ambito,
  asignaciones,
  sesiones,
  instrumentos,
  momento,
  ahora = Date.now(),
}: {
  ambito: AmbitoCierre;
  asignaciones: Asignacion[];
  sesiones: Sesion[];
  instrumentos: Instrumento[];
  momento: MomentoTutoria;
  ahora?: number;
}): ResumenCierre {
  const { semestreId, escuelaId, tutorId } = ambito;
  const asignadas = asignaciones.filter(
    (a) =>
      a.semestreId === semestreId &&
      a.estado !== 'reemplazada' &&
      (!escuelaId || a.escuelaId === escuelaId) &&
      (!tutorId || a.tutorId === tutorId),
  );
  const tutores = [...new Set(asignadas.map((a) => a.tutorId))];
  const escuelasDelAmbito = [...new Set(asignadas.map((a) => a.escuelaId))];
  const registros = instrumentos.filter((r) => r.semestreId === semestreId);

  /** Si hay duplicados (reenvíos, versiones), cuenta el que ya está enviado o aprobado. */
  const buscar = (condicion: (r: Instrumento) => boolean) => {
    const candidatos = registros.filter(condicion);
    return candidatos.find(exportable) ?? candidatos[0];
  };
  const esAsistencia = (f: CodigoFormato) => f === 'F06' || f === 'F07';
  const esEvaluacion = (f: CodigoFormato) => f === 'F10' || f === 'F11';

  const entrevistas = evaluar(
    'entrevistas',
    'Entrevistas iniciales de los estudiantes',
    '03 · 04 · 05',
    true,
    asignadas.map((a) => {
      const estudiante = estudiantePorId(a.estudianteId);
      const nombre = nombreEstudiante(a.estudianteId);
      if (!estudiante?.ciclo) return { referencia: nombre, sinRegistro: 'Ciclo sin informar' };
      const formato = etapaAcademica[etapaDeCiclo(estudiante.ciclo)].formato;
      return {
        referencia: `${nombre} · formato ${formato.slice(1)}`,
        registro: buscar((r) => r.formato === formato && r.estudianteId === a.estudianteId),
      };
    }),
  );

  // Sesiones que ya terminaron; las canceladas o reprogramadas no exigen asistencia.
  const sesionesDelAmbito = sesiones.filter(
    (s) =>
      s.semestreId === semestreId &&
      tutores.includes(s.tutorId) &&
      !['cancelada', 'reprogramada'].includes(s.estado) &&
      sesionFinalizo(s, ahora),
  );
  const referenciaSesion = (s: Sesion) =>
    `${s.tema || 'Sesión'} · ${fechaOficial(s.fecha)} · ${nombreDocente(s.tutorId)}`;

  const asistencias = evaluar(
    'asistencias',
    'Registro de asistencia de cada sesión',
    '06 · 07',
    true,
    sesionesDelAmbito.map((s) => ({
      referencia: referenciaSesion(s),
      registro: buscar((r) => esAsistencia(r.formato) && r.sesionId === s.id),
      sinRegistro:
        s.estado === 'programada'
          ? 'La sesión terminó y no se registró como realizada'
          : 'Asistencia sin confirmar',
    })),
  );

  const evaluaciones = evaluar(
    'evaluaciones',
    'Evaluaciones de la tutoría por los estudiantes',
    '10 · 11',
    false,
    sesionesDelAmbito
      .filter((s) => s.estado === 'realizada' && s.asistenciaConfirmada)
      .flatMap((s) =>
        s.asistentes
          .filter((a) => a.estado === 'asistio' || a.estado === 'tarde')
          .map((a) => ({
            referencia: `${nombreEstudiante(a.estudianteId)} · ${referenciaSesion(s)}`,
            registro: buscar(
              (r) =>
                esEvaluacion(r.formato) && r.sesionId === s.id && r.estudianteId === a.estudianteId,
            ),
          })),
      ),
  );

  const porTutor = (clave: ClaveRequisito, etiqueta: string, formato: CodigoFormato) =>
    evaluar(
      clave,
      etiqueta,
      formato.slice(1),
      true,
      tutores.map((id) => ({
        referencia: nombreDocente(id),
        registro: buscar((r) => r.formato === formato && r.tutorId === id),
      })),
    );

  const requisitos = [
    entrevistas,
    asistencias,
    evaluaciones,
    porTutor('informe-tutor', 'Informe de actividades de cada tutor', 'F02'),
    porTutor('autoevaluacion', 'Autoevaluación de cada tutor', 'F09'),
  ];
  // El informe 01 es de la comisión de la escuela: no aplica al filtrar por un tutor.
  if (!tutorId) {
    requisitos.push(
      evaluar(
        'informe-comision',
        'Informe del proceso tutorial de la comisión',
        '01',
        true,
        escuelasDelAmbito.map((id) => ({
          referencia: nombreEscuela(id),
          registro: buscar((r) => r.formato === 'F01' && escuelaDeRegistro(r) === id),
        })),
      ),
    );
  }

  const enAmbito = (r: Instrumento) =>
    r.formato === 'F01'
      ? !tutorId && escuelasDelAmbito.includes(escuelaDeRegistro(r) ?? '')
      : tutores.includes(r.tutorId) &&
        (!escuelaId || !r.estudianteId || escuelaDeRegistro(r) === escuelaId);
  const documentos = documentosExportables(registros.filter(enAmbito), sesiones);
  const pendientesObligatorios = requisitos
    .filter((r) => r.obligatorio)
    .reduce((total, r) => total + r.pendientes.length, 0);

  return {
    ambito,
    momento,
    requisitos,
    documentos,
    eventuales: documentos.filter((d) => d.formato === 'F08' || d.formato === 'F12').length,
    porRevisar: documentos.filter((d) => d.estado === 'enviado').length,
    pendientesObligatorios,
    completo: asignadas.length > 0 && pendientesObligatorios === 0,
  };
}

/** Texto del ámbito para la portada y el nombre del archivo. */
export function etiquetaAmbito(ambito: AmbitoCierre): string {
  const partes = [
    ambito.escuelaId
      ? `Escuela Profesional de ${nombreEscuela(ambito.escuelaId)}`
      : 'Todas las escuelas',
  ];
  if (ambito.tutorId) partes.push(`Tutor: ${nombreDocente(ambito.tutorId)}`);
  return partes.join(' · ');
}

/** «Cierre» solo cuando coordinación pasó el semestre a cierre; antes es un avance. */
export const esCierre = (momento: MomentoTutoria) => momento === 'cierre';
