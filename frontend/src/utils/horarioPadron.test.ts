import { describe, expect, it } from 'vitest';
import { cargaSemanal, franjasDe, rangoHoras } from './horarioPadron';

const fila = (dia: string, horas: string, aula = 'A-101', esHoraTeorica = '1') => ({
  fila: 1,
  dia,
  horas,
  duracion: '4',
  aula,
  codigoAula: '',
  esHoraTeorica,
  docente: 'Docente ficticio',
});

describe('horario del padrón', () => {
  it('interpreta los rangos del Excel con el sufijo de la hora de término', () => {
    expect(rangoHoras('09-01 pm.')).toEqual({ inicio: 9, fin: 13 });
    expect(rangoHoras('02-05 pm.')).toEqual({ inicio: 14, fin: 17 });
    expect(rangoHoras('07-09 am.')).toEqual({ inicio: 7, fin: 9 });
    expect(rangoHoras('12-02 pm.')).toEqual({ inicio: 12, fin: 14 });
    expect(rangoHoras('sin hora')).toBeNull();
    expect(rangoHoras('13-02 pm.')).toBeNull();
  });

  it('ordena, quita duplicados y conserva lo que no se puede interpretar', () => {
    const franjas = franjasDe({
      horariosOriginales: [
        fila('3', '02-05 pm.', 'Lab 2', '0'),
        fila('1', '09-01 pm.'),
        fila('1', '09-01 pm.'),
        fila('9', 'por definir', ''),
      ],
    });
    expect(franjas.map((f) => `${f.diaTexto} ${f.horas}`)).toEqual([
      '9 por definir',
      'Lun 09:00–13:00',
      'Mié 14:00–17:00',
    ]);
    expect(franjas[2]!.practica).toBe(true);
    expect(cargaSemanal(franjas)).toEqual({ horas: 7, dias: 2 });
  });
});
