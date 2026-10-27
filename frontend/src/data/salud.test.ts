import { describe, expect, it } from 'vitest';
import { atencionesSalud, atencionesTutorialesDe, apoyosDe } from './salud';

describe('información comunicable para el seguimiento tutorial', () => {
  it('proyecta solo los campos del seguimiento y excluye el motivo confidencial', () => {
    const origen = atencionesSalud[0]!;
    const registros = atencionesTutorialesDe(origen.estudianteId);
    expect(registros.length).toBeGreaterThan(0);
    for (const registro of registros) {
      expect(registro.estudianteId).toBe(origen.estudianteId);
      expect(Object.keys(registro).sort()).toEqual(
        [
          'id',
          'estudianteId',
          'servicio',
          'fecha',
          'hora',
          'estado',
          'recomendacionAcademica',
          'vigenciaRecomendacion',
          'fuente',
          'fechaCorte',
        ].sort(),
      );
      expect(registro).not.toHaveProperty('motivo');
      expect(registro).not.toHaveProperty('profesional');
    }
  });

  it('las pautas del tutor no incluyen el motivo médico como necesidad académica', () => {
    for (const atencion of atencionesSalud) {
      for (const apoyo of apoyosDe(atencion.estudianteId)) {
        expect(apoyo.necesidad).toBe('Acompañamiento académico autorizado');
        expect(apoyo.necesidad).not.toBe(atencion.motivo);
      }
    }
    expect(atencionesTutorialesDe('sin-registros')).toEqual([]);
  });
});
