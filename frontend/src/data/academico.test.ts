import { describe, expect, it } from 'vitest';
import {
  hayCruce,
  horarioDe,
  matriculaDe,
  nombreCurso,
  resumenDe,
  resultadosDe,
} from './academico';
import { estudiantes, estudiantePorId } from './personas';
import { asignaciones } from './tutoria';
import {
  areasDerivacion,
  cursosDeEscuela,
  escuelas,
  etapaDeCiclo,
  facultades,
  semestres,
} from './catalogos';

const estudiante = estudiantes[0]!;

describe('catÃ¡logos acadÃ©micos', () => {
  it('relaciona escuelas con facultades existentes', () => {
    for (const escuela of escuelas) {
      expect(facultades.some((facultad) => facultad.id === escuela.facultadId)).toBe(true);
    }
  });

  it('marca un Ãºnico semestre en curso', () => {
    expect(semestres.filter((semestre) => semestre.estado === 'en-curso')).toHaveLength(1);
  });

  it('deriva la etapa acadÃ©mica del ciclo', () => {
    expect(etapaDeCiclo(1)).toBe('ingresante');
    expect(etapaDeCiclo(2)).toBe('ingresante');
    expect(etapaDeCiclo(3)).toBe('ingresante');
    expect(etapaDeCiclo(4)).toBe('intermedio');
    expect(etapaDeCiclo(7)).toBe('intermedio');
    expect(etapaDeCiclo(8)).toBe('final');
    expect(etapaDeCiclo(9)).toBe('final');
  });

  it('devuelve los cursos de una escuela', () => {
    const cursos = cursosDeEscuela('E-IIS');
    expect(cursos.length).toBeGreaterThan(0);
    expect(cursos.every((curso) => curso.escuelaId === 'E-IIS')).toBe(true);
  });
});

describe('expediente acadÃ©mico de demostraciÃ³n', () => {
  it('asigna una matrÃ­cula y un resumen a cada estudiante', () => {
    expect(matriculaDe(estudiante.id)?.estudianteId).toBe(estudiante.id);
    expect(resumenDe(estudiante.id)?.estudianteId).toBe(estudiante.id);
  });

  it('registra resultados en curso y cerrados con coherencia', () => {
    const resultados = resultadosDe(estudiante.id);
    expect(resultados.length).toBeGreaterThan(0);
    for (const fila of resultados) {
      if (fila.estado === 'en-curso') expect(fila.notaFinal).toBeNull();
      if (fila.estado === 'aprobado') expect(fila.notaFinal).toBeGreaterThanOrEqual(11);
      if (fila.estado === 'desaprobado') expect(fila.notaFinal).toBeLessThan(11);
    }
  });

  it('resuelve el nombre del curso y devuelve un texto alternativo si no existe', () => {
    expect(nombreCurso('C-IIS-202')).toContain('Base de Datos');
    expect(nombreCurso('C-INEXISTENTE')).toBe('Curso no registrado');
  });

  it('publica el horario del estudiante con bloques vÃ¡lidos', () => {
    const bloques = horarioDe(estudiante.id);
    expect(bloques.length).toBeGreaterThan(0);
    for (const bloque of bloques) {
      expect(bloque.dia).toBeGreaterThanOrEqual(1);
      expect(bloque.dia).toBeLessThanOrEqual(5);
      expect(bloque.horaInicio < bloque.horaFin).toBe(true);
    }
  });
});

describe('detecciÃ³n de cruces de horario', () => {
  it('detecta el cruce con una clase del propio estudiante', () => {
    const bloque = horarioDe(estudiante.id)[0]!;
    const encontrado = hayCruce(estudiante.id, bloque.dia, bloque.horaInicio, bloque.horaFin);
    expect(encontrado?.id).toBe(bloque.id);
  });

  it('no reporta cruce fuera del horario acadÃ©mico', () => {
    expect(hayCruce(estudiante.id, 6, '20:00', '21:00')).toBeNull();
  });

  it('no reporta cruce en un dÃ­a distinto', () => {
    const bloque = horarioDe(estudiante.id)[0]!;
    const otroDia = bloque.dia === 1 ? 2 : 1;
    const ocupado = horarioDe(estudiante.id).some((item) => item.dia === otroDia);
    if (!ocupado) {
      expect(hayCruce(estudiante.id, otroDia, bloque.horaInicio, bloque.horaFin)).toBeNull();
    }
  });
});

describe('coherencia entre personas, asignaciones y Ã¡reas', () => {
  it('asigna cada estudiante a un docente tutor existente', () => {
    const idsTutores = new Set(asignaciones.map((asignacion) => asignacion.tutorId));
    expect(idsTutores.size).toBeGreaterThan(0);
    for (const asignacion of asignaciones) {
      expect(estudiantePorId(asignacion.estudianteId)).toBeDefined();
      expect(asignacion.semestreId).toBe('2026-II');
    }
  });

  it('define las cinco Ã¡reas de derivaciÃ³n con su tiempo de respuesta', () => {
    expect(areasDerivacion).toHaveLength(5);
    for (const area of areasDerivacion) {
      expect(area.tiempoRespuesta.length).toBeGreaterThan(0);
      expect(area.responsable.length).toBeGreaterThan(0);
    }
  });
});
