import type {
  BloqueHorario,
  EvaluacionCurso,
  Matricula,
  ResumenAcademico,
  ResultadoAcademico,
} from '../types/domain';
import { cursos, cursosDeEscuela, semestreActual } from './catalogos';
import { estudiantes } from './personas';

/**
 * Expediente académico de demostración con la procedencia que exige la
 * solicitud a la DIAA: matrícula, cursos, evaluaciones, promedio ponderado,
 * avance curricular y horarios. La consulta es de solo lectura.
 */

export const FUENTE_ACADEMICA = 'DIAA · Sistema de Gestión Académica (consulta de solo lectura)';
export const FECHA_CORTE_ACADEMICA = '2026-10-13';

/** Generador determinista: el mismo estudiante produce siempre los mismos datos. */
function semilla(texto: string): number {
  let valor = 2166136261;
  for (let i = 0; i < texto.length; i += 1) {
    valor ^= texto.charCodeAt(i);
    valor = Math.imul(valor, 16777619);
  }
  return Math.abs(valor);
}

function entre(seed: number, min: number, max: number, paso = 1): number {
  const rango = Math.floor((max - min) / paso) + 1;
  return min + (((seed % rango) + rango) % rango) * paso;
}

const SECCIONES = ['A', 'B', 'C'];
const HORAS = ['07:00', '08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'];

function evaluacionesDe(codigo: string, nota: number | null): EvaluacionCurso[] {
  const seed = semilla(codigo);
  const base = nota ?? 0;
  const ajuste = (indice: number) =>
    Math.round(Math.max(0, Math.min(20, base + entre(seed + indice * 31, -2, 2))) * 10) / 10;
  return [
    { nombre: 'Práctica calificada 1', peso: 20, nota: nota === null ? null : ajuste(1) },
    { nombre: 'Examen parcial', peso: 30, nota: nota === null ? null : ajuste(2) },
    { nombre: 'Práctica calificada 2', peso: 20, nota: nota === null ? null : ajuste(3) },
    { nombre: 'Examen final', peso: 30, nota: nota === null ? null : ajuste(4) },
  ];
}

export const matriculas: Matricula[] = estudiantes.map((estudiante) => {
  const seed = semilla(estudiante.codigo);
  const disponibles = cursosDeEscuela(estudiante.escuelaId);
  const delCiclo = disponibles.filter((curso) => curso.ciclo === estudiante.ciclo);
  const otros = disponibles.filter((curso) => curso.ciclo !== estudiante.ciclo);
  const seleccion = [...delCiclo, ...otros].slice(0, estudiante.etapa === 'ingresante' ? 5 : 6);
  return {
    estudianteId: estudiante.id,
    semestreId: semestreActual,
    fecha: `2026-08-${String(entre(seed, 17, 28)).padStart(2, '0')}`,
    estado:
      estudiante.estado === 'reserva'
        ? 'reserva'
        : estudiante.estado === 'retirado'
          ? 'retiro'
          : 'matriculado',
    planEstudios: `Plan de estudios 2022 · ${estudiante.escuelaId.replace('E-', '')}`,
    ciclo: estudiante.ciclo,
    cursos: seleccion.map((curso, indice) => ({
      cursoId: curso.id,
      seccion: SECCIONES[(seed + indice) % SECCIONES.length] ?? 'A',
      creditos: curso.creditos,
      docente: docentesPorCurso(curso.id),
      horario: horarioDeCurso(seed + indice, curso.id),
    })),
  };
});

export const resultadosAcademicos: ResultadoAcademico[] = estudiantes.flatMap((estudiante) => {
  const seed = semilla(estudiante.codigo);
  const disponibles = cursosDeEscuela(estudiante.escuelaId);
  const delCiclo = disponibles.filter((curso) => curso.ciclo === estudiante.ciclo);
  const previos = disponibles.filter((curso) => curso.ciclo < estudiante.ciclo);
  const enCurso = delCiclo.slice(0, 6);
  const cerrrados = previos.slice(-4);
  const filas: ResultadoAcademico[] = [];
  for (const curso of cerrrados) {
    const nota = Math.max(
      4,
      Math.min(
        20,
        Math.round((estudiante.promedioPonderado + entre(seed + curso.ciclo, -4, 3)) * 10) / 10,
      ),
    );
    filas.push({
      id: `RA-${estudiante.codigo}-${curso.id}-2026I`,
      estudianteId: estudiante.id,
      semestreId: '2026-I',
      cursoId: curso.id,
      notaFinal: nota,
      estado: nota >= 11 ? 'aprobado' : 'desaprobado',
      creditos: curso.creditos,
      vecesCursado: nota >= 11 ? 1 : entre(seed + curso.ciclo, 2, 3),
      evaluaciones: evaluacionesDe(`${estudiante.codigo}${curso.id}I`, nota),
    });
  }
  for (const curso of enCurso) {
    filas.push({
      id: `RA-${estudiante.codigo}-${curso.id}-2026II`,
      estudianteId: estudiante.id,
      semestreId: semestreActual,
      cursoId: curso.id,
      notaFinal: null,
      estado: 'en-curso',
      creditos: curso.creditos,
      vecesCursado: 1,
      evaluaciones: evaluacionesDe(`${estudiante.codigo}${curso.id}II`, null),
    });
  }
  return filas;
});

export const resumenesAcademicos: ResumenAcademico[] = estudiantes.map((estudiante) => {
  const seed = semilla(`resumen${estudiante.codigo}`);
  const propios = resultadosAcademicos.filter((fila) => fila.estudianteId === estudiante.id);
  const cerrados = propios.filter(
    (fila) => fila.semestreId !== semestreActual && fila.notaFinal !== null,
  );
  const promedioSemestre = cerrados.length
    ? Math.round(
        (cerrados.reduce((total, fila) => total + (fila.notaFinal ?? 0) * fila.creditos, 0) /
          cerrados.reduce((total, fila) => total + fila.creditos, 0)) *
          10,
      ) / 10
    : null;
  const enCurso = propios.filter((fila) => fila.semestreId === semestreActual);
  return {
    estudianteId: estudiante.id,
    semestreId: semestreActual,
    promedioSemestre,
    promedioPonderado: estudiante.promedioPonderado,
    creditosMatriculados: enCurso.reduce((total, fila) => total + fila.creditos, 0),
    creditosAprobados: estudiante.creditosAprobados,
    cursosDesaprobados: propios.filter((fila) => fila.estado === 'desaprobado').length,
    avanceCurricular:
      Math.round((estudiante.creditosAprobados / estudiante.creditosTotales) * 1000) / 10,
    posicion: entre(seed, 1, 40),
    fuente: FUENTE_ACADEMICA,
    fechaCorte: FECHA_CORTE_ACADEMICA,
  };
});

/* ==========================================================================
   Horarios (fuente DIAA)
   ========================================================================== */

function docentesPorCurso(cursoId: string): string {
  const mapa: Record<string, string> = {
    'C-IIS-101': 'Luis Alberto Vela Ríos',
    'C-IIS-201': 'Marta Elena Paredes Auqui',
    'C-IIS-202': 'Luis Alberto Vela Ríos',
    'C-IIS-301': 'Luis Alberto Vela Ríos',
    'C-IIS-302': 'Teresa Lomas Pizango',
    'C-IIS-401': 'Marta Elena Paredes Auqui',
    'C-IIS-402': 'Marta Elena Paredes Auqui',
    'C-IIS-501': 'Marta Elena Paredes Auqui',
    'C-ADM-101': 'Jorge Luis Bermúdez Salas',
    'C-ADM-201': 'Carmen Julia Ríos Valverde',
    'C-ADM-301': 'Jorge Luis Bermúdez Salas',
    'C-ADM-401': 'Carmen Julia Ríos Valverde',
    'C-CON-101': 'Milagros Huamán Ríos',
    'C-CON-201': 'Milagros Huamán Ríos',
    'C-CON-301': 'Milagros Huamán Ríos',
    'C-ECO-101': 'Pedro Pablo Zavaleta Ruiz',
    'C-ECO-201': 'Pedro Pablo Zavaleta Ruiz',
    'C-ECO-301': 'Pedro Pablo Zavaleta Ruiz',
    'C-AGR-101': 'Rocío del Carmen Sifuentes Lomas',
    'C-AGR-201': 'Rocío del Carmen Sifuentes Lomas',
    'C-AGR-301': 'Rocío del Carmen Sifuentes Lomas',
    'C-FOR-101': 'Elmer Tuanama Sangama',
    'C-FOR-201': 'Elmer Tuanama Sangama',
    'C-ZOO-101': 'Gloria Fachín Chujandama',
    'C-ZOO-201': 'Gloria Fachín Chujandama',
    'C-BIO-101': 'Segundo Angulo Reátegui',
    'C-BIO-201': 'Segundo Angulo Reátegui',
  };
  return mapa[cursoId] ?? 'Docente por designar';
}

function horarioDeCurso(seed: number, cursoId: string): string {
  const dia = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'][seed % 5] ?? 'Lun';
  const inicio = HORAS[seed % HORAS.length] ?? '08:00';
  const curso = cursos.find((item) => item.id === cursoId);
  const fin = `${String(Number(inicio.slice(0, 2)) + (curso ? Math.max(2, curso.creditos - 1) : 2)).padStart(2, '0')}:00`;
  return `${dia} ${inicio}–${fin}`;
}

/** Bloques de clase del estudiante en el semestre actual. */
export const horariosAcademicos: BloqueHorario[] = matriculas.flatMap((matricula) =>
  matricula.cursos.flatMap((inscrito, indice) => {
    const curso = cursos.find((item) => item.id === inscrito.cursoId);
    if (!curso) return [];
    const seed = semilla(`${matricula.estudianteId}${inscrito.cursoId}`);
    const dia = ((seed + indice) % 5) + 1;
    const hora = HORAS[(seed + indice * 3) % HORAS.length] ?? '08:00';
    const duracion = Math.max(2, curso.creditos - 1);
    return [
      {
        id: `HB-${matricula.estudianteId}-${inscrito.cursoId}`,
        titulo: `${curso.nombre} · Sec. ${inscrito.seccion}`,
        dia,
        horaInicio: hora,
        horaFin: `${String(Number(hora.slice(0, 2)) + duracion).padStart(2, '0')}:00`,
        modalidad: 'presencial' as const,
        lugar: `Aula ${100 + ((seed % 12) + 1)} · Pabellón ${String.fromCharCode(65 + (seed % 4))}`,
        tipo: 'academico' as const,
        estudianteId: matricula.estudianteId,
        cursoId: curso.id,
      },
    ];
  }),
);

/** Bloques de clase del docente. */
export const horariosDocentes: BloqueHorario[] = [
  {
    id: 'HD-1',
    titulo: 'Base de Datos I · Sec. A',
    dia: 1,
    horaInicio: '08:00',
    horaFin: '10:00',
    modalidad: 'presencial',
    lugar: 'Aula 204 · Pabellón B',
    tipo: 'academico',
    tutorId: 'DOC-0421',
    cursoId: 'C-IIS-202',
  },
  {
    id: 'HD-2',
    titulo: 'Ingeniería de Software · Sec. A',
    dia: 2,
    horaInicio: '10:00',
    horaFin: '12:00',
    modalidad: 'presencial',
    lugar: 'Aula 205 · Pabellón B',
    tipo: 'academico',
    tutorId: 'DOC-0421',
    cursoId: 'C-IIS-301',
  },
  {
    id: 'HD-3',
    titulo: 'Base de Datos I · Sec. B',
    dia: 3,
    horaInicio: '14:00',
    horaFin: '16:00',
    modalidad: 'presencial',
    lugar: 'Laboratorio 3 · Pabellón C',
    tipo: 'academico',
    tutorId: 'DOC-0421',
    cursoId: 'C-IIS-202',
  },
  {
    id: 'HD-4',
    titulo: 'Consejo de facultad',
    dia: 4,
    horaInicio: '11:00',
    horaFin: '12:00',
    modalidad: 'presencial',
    lugar: 'Sala de sesiones FIIS',
    tipo: 'institucional',
    tutorId: 'DOC-0421',
  },
  {
    id: 'HD-5',
    titulo: 'Arquitectura de Software · Sec. A',
    dia: 5,
    horaInicio: '08:00',
    horaFin: '10:00',
    modalidad: 'presencial',
    lugar: 'Aula 301 · Pabellón A',
    tipo: 'academico',
    tutorId: 'DOC-0422',
    cursoId: 'C-IIS-401',
  },
];

/* ==========================================================================
   Selectores
   ========================================================================== */

export function matriculaDe(estudianteId: string): Matricula | undefined {
  return matriculas.find((matricula) => matricula.estudianteId === estudianteId);
}

export function resumenDe(estudianteId: string): ResumenAcademico | undefined {
  return resumenesAcademicos.find((resumen) => resumen.estudianteId === estudianteId);
}

export function resultadosDe(estudianteId: string): ResultadoAcademico[] {
  return resultadosAcademicos.filter((fila) => fila.estudianteId === estudianteId);
}

export function horarioDe(estudianteId: string): BloqueHorario[] {
  return horariosAcademicos.filter((bloque) => bloque.estudianteId === estudianteId);
}

export function nombreCurso(cursoId: string): string {
  return cursos.find((curso) => curso.id === cursoId)?.nombre ?? 'Curso no registrado';
}

export function cursoPorId(cursoId: string) {
  return cursos.find((curso) => curso.id === cursoId);
}

/** Indica si un bloque de tutoría choca con el horario académico del estudiante. */
export function hayCruce(
  estudianteId: string,
  dia: number,
  horaInicio: string,
  horaFin: string,
): BloqueHorario | null {
  const bloques = horarioDe(estudianteId);
  for (const bloque of bloques) {
    if (bloque.dia !== dia) continue;
    if (horaInicio < bloque.horaFin && horaFin > bloque.horaInicio) return bloque;
  }
  return null;
}
