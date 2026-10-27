import { beforeEach, describe, expect, it } from 'vitest';
import type { Instrumento } from '../types/domain';
import { asignaciones } from '../data/tutoria';
import { estudiantePorId, nombreCompleto } from '../data/personas';
import {
  alcanceDe,
  olvidarExpediente,
  recordarRespuestas,
  respuestasRecordadas,
} from './expediente';
import {
  motivoDerivacionDesdeAtencion,
  precargarInstrumento,
  precargarInstrumentoConOrigen,
} from '../utils/instrumentos';

const asignacion = asignaciones.find((item) => item.estado === 'activa')!;
const estudianteId = asignacion.estudianteId;
const otroEstudianteId = asignaciones.find(
  (item) => item.estudianteId !== estudianteId,
)!.estudianteId;

function registro(overrides: Partial<Instrumento> = {}): Instrumento {
  return {
    id: 'prueba-expediente',
    formato: 'F04',
    semestreId: '2026-II',
    tutorId: asignacion.tutorId,
    estudianteId,
    sesionId: null,
    estado: 'borrador',
    avance: 0,
    version: 1,
    creado: '2026-10-16',
    actualizado: '2026-10-16',
    enviado: null,
    revisadoPor: null,
    observaciones: [],
    descargaDisponible: false,
    respuestas: {},
    ...overrides,
  };
}

beforeEach(() => olvidarExpediente());

describe('expediente compartido entre formularios', () => {
  it('guarda solo los datos estables y descarta los del registro concreto', () => {
    recordarRespuestas(registro(), {
      colegio: 'I.E. 001',
      expectativas: 'Sí',
      fecha: '2026-10-16',
      asistentes: '[]',
      p01: 'A · Totalmente de acuerdo',
      observaciones: 'texto libre',
      motivacion: '',
    });
    expect(respuestasRecordadas(registro())).toEqual({
      colegio: 'I.E. 001',
      expectativas: 'Sí',
    });
  });

  it('separa el expediente de cada estudiante y de cada tutor', () => {
    recordarRespuestas(registro(), { colegio: 'I.E. 001' });
    recordarRespuestas(registro({ estudianteId: otroEstudianteId }), { colegio: 'I.E. 002' });
    recordarRespuestas(registro({ formato: 'F09', estudianteId: null }), {
      observaciones: 'no se reutiliza',
    });
    expect(respuestasRecordadas(registro()).colegio).toBe('I.E. 001');
    expect(respuestasRecordadas(registro({ estudianteId: otroEstudianteId })).colegio).toBe(
      'I.E. 002',
    );
    expect(respuestasRecordadas(registro({ formato: 'F09', estudianteId: null }))).toEqual({});
    expect(alcanceDe(registro())).toBe(`estudiante:${estudianteId}`);
  });

  it('reutiliza en la entrevista 05 lo que ya respondió la entrevista 04', () => {
    recordarRespuestas(registro(), {
      colegio: 'I.E. 001',
      expectativas: 'Sí',
      lugarEstudio: 'Individual',
    });
    const precarga = precargarInstrumentoConOrigen(registro({ formato: 'F05' }));
    expect(precarga.valores.colegio).toBe('I.E. 001');
    expect(precarga.valores.lugarEstudio).toBe('Individual');
    expect(precarga.reutilizados).toContain('colegio');
    expect(precarga.reutilizados).toContain('lugarEstudio');
  });

  it('el borrador propio y el padrón tienen prioridad sobre lo reutilizado', () => {
    recordarRespuestas(registro(), { colegio: 'I.E. 001', nombreEstudiante: 'Otro nombre' });
    const precarga = precargarInstrumentoConOrigen(
      registro({ formato: 'F05', respuestas: { colegio: 'I.E. 999' } }),
    );
    expect(precarga.valores.colegio).toBe('I.E. 999');
    expect(precarga.reutilizados).not.toContain('colegio');
    expect(precarga.valores.nombreEstudiante).toBe(nombreCompleto(estudiantePorId(estudianteId)!));
  });

  it('traduce el motivo de la atención 08 a las opciones de la ficha 12', () => {
    expect(motivoDerivacionDesdeAtencion('Situación personal')).toBe('Apoyo emocional');
    expect(motivoDerivacionDesdeAtencion('Situación familiar')).toBe(
      'Situación económica o familiar',
    );
    expect(motivoDerivacionDesdeAtencion('Riesgo académico')).toBe('Dificultades de aprendizaje');
    expect(motivoDerivacionDesdeAtencion('Otra cosa')).toBe('Otro');
  });

  it('precarga el formato 01 con la facultad, la comisión y el plan de la escuela', () => {
    const valores = precargarInstrumento(
      registro({ formato: 'F01', estudianteId: null, respuestas: { escuela: 'E-IIS' } }),
    );
    expect(valores.facultad).toContain('Ingeniería en Informática y Sistemas');
    expect(valores.comision).toContain('Marta Elena Paredes Auqui');
    const actividades = JSON.parse(valores.actividades ?? '[]') as Array<{ problematica: string }>;
    expect(actividades.length).toBeGreaterThan(0);
    expect(actividades[0]?.problematica).toBeTruthy();
  });

  it('conserva la explicación de Otro y la limpia al cambiar de opción', () => {
    recordarRespuestas(registro(), {
      transporte: 'Otro',
      transporte__otro: 'Movilidad compartida',
    });
    expect(respuestasRecordadas(registro()).transporte__otro).toBe('Movilidad compartida');
    recordarRespuestas(registro(), { transporte: 'A pie' });
    expect(respuestasRecordadas(registro())).not.toHaveProperty('transporte__otro');
  });

  it('recuerda datos históricos entre semestres y renueva las preguntas de situación actual', () => {
    recordarRespuestas(registro(), {
      colegio: 'I.E. 001',
      estadoSalud: 'Buena',
      motivacion: 'Alta',
      cursosDificiles: '["Otro"]',
      cursosDificiles__otro: 'Curso anterior',
    });
    const siguiente = respuestasRecordadas(registro({ semestreId: '2027-I', formato: 'F05' }));
    expect(siguiente).toEqual({ colegio: 'I.E. 001' });
  });

  it('no confunde expectativas del ingresante con satisfacción ni estudio con carrera', () => {
    recordarRespuestas(registro({ formato: 'F03' }), { expectativas: '["Organizar mi tiempo"]' });
    recordarRespuestas(registro(), { motivacion: 'Alta' });
    expect(respuestasRecordadas(registro())).not.toHaveProperty('expectativas');
    expect(respuestasRecordadas(registro({ formato: 'F05' }))).not.toHaveProperty('motivacion');
  });

  it('no resucita una respuesta borrada ni restaura respuestas desde una caché corrupta', () => {
    recordarRespuestas(registro(), { colegio: 'I.E. 001', apoderado: 'Dato ficticio' });
    recordarRespuestas(registro(), { apoderado: '' });
    expect(respuestasRecordadas(registro())).not.toHaveProperty('apoderado');
    localStorage.setItem(
      'tutoria-unas:expediente:v2',
      JSON.stringify({
        version: 2,
        registros: { [`estudiante:${estudianteId}`]: { respuestas: null } },
      }),
    );
    expect(respuestasRecordadas(registro())).toEqual({});
  });

  it('reutiliza formularios enviados sin abrir borradores de otro registro', () => {
    const objetivo = registro({ id: 'nuevo', formato: 'F05' });
    const enviado = registro({
      id: 'previo',
      estado: 'enviado',
      respuestas: { colegio: 'I.E. previa', telefono: '900000001' },
    });
    const borrador = registro({
      id: 'otro-borrador',
      actualizado: '2026-10-17',
      respuestas: { colegio: 'No compartido' },
    });
    const datos = precargarInstrumentoConOrigen(objetivo, [], [enviado, borrador]);
    expect(datos.valores.colegio).toBe('I.E. previa');
    expect(datos.valores.telefono).toBe('900000001');
    expect(datos.reutilizados).toContain('telefono');
  });

  it('la revisión de un envío conserva su contenido aunque cambie el expediente', () => {
    recordarRespuestas(registro(), { colegio: 'Dato posterior', telefono: '900000002' });
    const enviado = registro({
      estado: 'enviado',
      respuestas: {
        colegio: 'Dato original',
        telefono: '900000001',
        nombreEstudiante: 'Nombre guardado',
      },
    });
    const datos = precargarInstrumentoConOrigen(enviado);
    expect(datos.valores.colegio).toBe('Dato original');
    expect(datos.valores.telefono).toBe('900000001');
    expect(datos.valores.nombreEstudiante).toBe('Nombre guardado');
    expect(datos.reutilizados).toEqual([]);
  });

  it('precarga la ficha 12 con el contacto enviado por el estudiante y no lee borradores', () => {
    const ficha = registro({ formato: 'F12' });
    const entrevista = registro({
      id: 'entrevista-enviada',
      estado: 'enviado',
      respuestas: { telefono: '900000007' },
    });
    const borrador = registro({ id: 'entrevista-borrador', respuestas: { telefono: '900000009' } });
    const datos = precargarInstrumentoConOrigen(ficha, [], [entrevista, borrador]);
    expect(datos.valores.telefono).toBe('900000007');
  });
});
