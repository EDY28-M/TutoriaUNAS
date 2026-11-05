import { describe, expect, it } from 'vitest';
import type { Asignacion, CodigoFormato, Instrumento, Sesion } from '../types/domain';
import { estudiantes } from '../data/personas';
import { etapaAcademica, etapaDeCiclo } from '../data/catalogos';
import { esCierre, resumenCierre } from './cierreSemestre';
import type { ClaveRequisito, ResumenCierre } from './cierreSemestre';

const SEMESTRE = '2026-II';
const TUTOR = 'DOC-PRUEBA';
const AHORA = Date.parse('2026-12-20T12:00:00-05:00');
const estudiante = estudiantes.find((e) => e.ciclo !== null)!;
const entrevista = etapaAcademica[etapaDeCiclo(estudiante.ciclo!)].formato;

const asignacion: Asignacion = {
  id: 'ASG-PRUEBA',
  estudianteId: estudiante.id,
  tutorId: TUTOR,
  semestreId: SEMESTRE,
  escuelaId: estudiante.escuelaId,
  grupo: 'G-01',
  fechaInicio: '2026-09-01',
  fechaFin: null,
  estado: 'activa',
  criterio: 'sorteo',
  referenciaAprobacion: 'RD-PRUEBA',
  historial: [],
};

function sesion(id: string, estado: Sesion['estado'], confirmada: boolean): Sesion {
  return {
    id,
    codigo: id,
    tipo: 'individual',
    tutorId: TUTOR,
    semestreId: SEMESTRE,
    fecha: '2026-10-01',
    horaInicio: '10:00',
    horaFin: '11:00',
    modalidad: 'presencial',
    lugar: 'Aula',
    tema: `Tema ${id}`,
    objetivo: '',
    estado,
    asistentes: [
      { estudianteId: estudiante.id, estado: 'asistio', horaRegistro: null, observacion: null },
    ],
    acuerdos: [],
    instrumentoId: null,
    observacion: null,
    asistenciaConfirmada: confirmada,
  };
}

function registro(
  id: string,
  formato: CodigoFormato,
  estado: Instrumento['estado'],
  extra: Partial<Instrumento> = {},
): Instrumento {
  return {
    id,
    formato,
    semestreId: SEMESTRE,
    tutorId: TUTOR,
    estudianteId: null,
    sesionId: null,
    estado,
    avance: 100,
    version: 1,
    creado: '2026-09-01',
    actualizado: '2026-10-01',
    enviado: '2026-10-01',
    revisadoPor: null,
    observaciones: [],
    descargaDisponible: false,
    respuestas: {},
    ...extra,
  };
}

const requisito = (resumen: ResumenCierre, clave: ClaveRequisito) =>
  resumen.requisitos.find((r) => r.clave === clave)!;

const realizada = sesion('SES-1', 'realizada', true);
const sinMarcar = sesion('SES-2', 'programada', false);
const base = [
  registro('ENT', entrevista, 'enviado', { estudianteId: estudiante.id }),
  registro('ASI', 'F06', 'aprobado', { sesionId: 'SES-1' }),
  registro('INF', 'F02', 'borrador'),
];

function calcular(instrumentos: Instrumento[], ambito: Partial<ResumenCierre['ambito']> = {}) {
  return resumenCierre({
    ambito: { semestreId: SEMESTRE, escuelaId: null, tutorId: null, ...ambito },
    asignaciones: [asignacion],
    sesiones: [realizada, sinMarcar],
    instrumentos,
    momento: 'cierre',
    ahora: AHORA,
  });
}

describe('resumenCierre', () => {
  it('cuenta lo completo, lo enviado sin aprobar y explica cada pendiente', () => {
    const resumen = calcular(base);
    expect(requisito(resumen, 'entrevistas')).toMatchObject({
      esperados: 1,
      completos: 1,
      porRevisar: 1,
      pendientes: [],
    });
    const asistencias = requisito(resumen, 'asistencias');
    expect(asistencias).toMatchObject({ esperados: 2, completos: 1 });
    expect(asistencias.pendientes[0]!.situacion).toBe(
      'La sesión terminó y no se registró como realizada',
    );
    expect(requisito(resumen, 'informe-tutor').pendientes[0]!.situacion).toBe('En borrador');
    expect(requisito(resumen, 'autoevaluacion').pendientes[0]!.situacion).toBe('Sin registro');
    expect(requisito(resumen, 'informe-comision').pendientes).toHaveLength(1);
    expect(resumen.completo).toBe(false);
    // Solo los formatos enviados o aprobados entran al paquete.
    expect(resumen.documentos.map((d) => d.id).sort()).toEqual(['ASI', 'ENT']);
    expect(resumen.porRevisar).toBe(1);
  });

  it('las evaluaciones de los estudiantes se informan pero no bloquean el cierre', () => {
    const resumen = resumenCierre({
      ambito: { semestreId: SEMESTRE, escuelaId: null, tutorId: null },
      asignaciones: [asignacion],
      sesiones: [realizada],
      instrumentos: [
        ...base.filter((r) => r.id !== 'INF'),
        registro('INF', 'F02', 'enviado'),
        registro('AUT', 'F09', 'aprobado'),
        registro('COM', 'F01', 'enviado', { respuestas: { escuela: estudiante.escuelaId } }),
      ],
      momento: 'cierre',
      ahora: AHORA,
    });
    const evaluaciones = requisito(resumen, 'evaluaciones');
    expect(evaluaciones.obligatorio).toBe(false);
    expect(evaluaciones.pendientes).toHaveLength(1);
    expect(resumen.completo).toBe(true);
  });

  it('al filtrar por un tutor no exige el informe de la comisión', () => {
    const resumen = calcular(base, { tutorId: TUTOR });
    expect(resumen.requisitos.map((r) => r.clave)).not.toContain('informe-comision');
  });

  it('no considera otros semestres ni ámbitos sin estudiantes', () => {
    const resumen = calcular(base, { escuelaId: 'E-INEXISTENTE' });
    expect(resumen.requisitos.every((r) => r.esperados === 0)).toBe(true);
    expect(resumen.documentos).toHaveLength(0);
    expect(resumen.completo).toBe(false);
    expect(esCierre('durante')).toBe(false);
    expect(esCierre('cierre')).toBe(true);
  });
});
