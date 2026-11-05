import { describe, expect, it } from 'vitest';
import type { Instrumento, Sesion } from '../types/domain';
import { semestreActual } from '../data/catalogos';
import {
  clasificarFormulario,
  formulariosDelEstudiante,
  porResponder,
  rutaFormulario,
} from './formulariosEstudiante';

const EST = 'EST-PRUEBA';
const AHORA = Date.parse('2026-11-05T12:00:00-05:00');

function instrumento(parcial: Partial<Instrumento>): Instrumento {
  return {
    id: 'X',
    formato: 'F10',
    semestreId: semestreActual,
    tutorId: 'DOC-1',
    estudianteId: EST,
    sesionId: 'SES-1',
    estado: 'no-iniciado',
    avance: 0,
    version: 1,
    creado: '2026-10-01',
    actualizado: '2026-10-01',
    enviado: null,
    revisadoPor: null,
    observaciones: [],
    descargaDisponible: false,
    respuestas: {},
    ...parcial,
  };
}

function sesion(
  parcial: Partial<Sesion> & { asistio?: Sesion['asistentes'][number]['estado'] },
): Sesion {
  const { asistio = 'asistio', ...resto } = parcial;
  return {
    id: 'SES-1',
    codigo: 'SES-1',
    tipo: 'individual',
    tutorId: 'DOC-1',
    semestreId: semestreActual,
    fecha: '2026-10-20',
    horaInicio: '10:00',
    horaFin: '11:00',
    modalidad: 'presencial',
    lugar: 'Aula',
    tema: 'Técnicas de estudio',
    objetivo: '',
    estado: 'realizada',
    asistentes: [{ estudianteId: EST, estado: asistio, horaRegistro: null, observacion: null }],
    acuerdos: [],
    instrumentoId: null,
    observacion: null,
    asistenciaConfirmada: true,
    ...resto,
  };
}

const clasificar = (registro: Instrumento, sesiones: Sesion[]) =>
  clasificarFormulario(registro, sesiones, 'durante', AHORA);

describe('disponibilidad de una evaluación de sesión', () => {
  it('se responde cuando la sesión terminó y el tutor confirmó la asistencia', () => {
    expect(clasificar(instrumento({}), [sesion({})]).disponibilidad).toBe('responder');
  });

  it('espera mientras la sesión no termina o falta confirmar la asistencia', () => {
    const futura = clasificar(instrumento({}), [
      sesion({ estado: 'programada', fecha: '2026-12-01' }),
    ]);
    expect(futura).toMatchObject({
      disponibilidad: 'esperando',
      motivo: 'Se habilita al terminar la sesión',
    });
    const sinConfirmar = clasificar(instrumento({}), [sesion({ asistenciaConfirmada: false })]);
    expect(sinConfirmar).toMatchObject({
      disponibilidad: 'esperando',
      motivo: 'Tu tutor aún no confirma la asistencia',
    });
  });

  it('no es tarea del estudiante si la sesión se canceló, no existe o no asistió', () => {
    expect(clasificar(instrumento({}), [sesion({ estado: 'cancelada' })]).disponibilidad).toBe(
      'no-aplica',
    );
    expect(clasificar(instrumento({}), [sesion({ estado: 'reprogramada' })]).disponibilidad).toBe(
      'no-aplica',
    );
    expect(clasificar(instrumento({}), []).disponibilidad).toBe('no-aplica');
    expect(clasificar(instrumento({}), [sesion({ asistio: 'falto' })]).disponibilidad).toBe(
      'no-aplica',
    );
  });

  it('lo enviado solo se consulta y lo observado se corrige', () => {
    expect(clasificar(instrumento({ estado: 'enviado' }), []).disponibilidad).toBe('enviado');
    expect(clasificar(instrumento({ estado: 'aprobado' }), []).disponibilidad).toBe('enviado');
    expect(
      clasificar(instrumento({ formato: 'F04', sesionId: null, estado: 'observado' }), [])
        .disponibilidad,
    ).toBe('corregir');
  });
});

describe('formularios del estudiante', () => {
  const registros = [
    instrumento({ id: 'F03', formato: 'F03', sesionId: null }),
    instrumento({ id: 'F04', formato: 'F04', sesionId: null }),
    instrumento({ id: 'cancelada', sesionId: 'SES-C' }),
    instrumento({ id: 'antigua', sesionId: 'SES-A' }),
    instrumento({ id: 'reciente', sesionId: 'SES-R', formato: 'F11' }),
  ];
  const sesiones = [
    sesion({ id: 'SES-C', estado: 'cancelada' }),
    sesion({ id: 'SES-A', fecha: '2026-09-10' }),
    sesion({ id: 'SES-R', fecha: '2026-10-28', tipo: 'grupal' }),
  ];

  it('muestra solo la entrevista de su ciclo, primero, y oculta lo que no le corresponde', () => {
    const lista = formulariosDelEstudiante(registros, 5, sesiones, 'durante', AHORA);
    expect(lista.map((f) => f.registro.id)).toEqual(['F04', 'reciente', 'antigua']);
    expect(lista.filter(porResponder)).toHaveLength(3);
  });

  it('sin ciclo informado no ofrece entrevista, pero sí las evaluaciones', () => {
    const lista = formulariosDelEstudiante(registros, null, sesiones, 'durante', AHORA);
    expect(lista.map((f) => f.registro.id)).toEqual(['reciente', 'antigua']);
  });

  it('cada formulario tiene su propia página', () => {
    expect(rutaFormulario({ id: 'INST-F10-SES 1-EST' })).toBe(
      '/estudiante/instrumentos/INST-F10-SES%201-EST',
    );
  });
});
