import { describe, expect, it } from 'vitest';
import type { Instrumento } from '../types/domain';
import { estudiantes, nombreCompleto } from '../data/personas';
import {
  documentoDesdeInstrumento,
  documentosExportables,
  fechaOficial,
  frase,
  hojasDe,
  marcaDe,
  marcada,
  nombreArchivo,
  rellenar,
  valorDe,
  valoresDe,
} from './exportFormatos';
import { muestrasFormatos } from '../data/muestrasFormatos';

function instrumento(parcial: Partial<Instrumento>): Instrumento {
  return {
    id: 'INST-PRUEBA',
    formato: 'F04',
    semestreId: '2026-II',
    tutorId: 'DOC-0422',
    estudianteId: null,
    sesionId: null,
    estado: 'enviado',
    avance: 100,
    version: 1,
    creado: '2026-09-01',
    actualizado: '2026-09-10',
    enviado: '2026-09-10',
    revisadoPor: null,
    observaciones: [],
    descargaDisponible: false,
    respuestas: {},
    ...parcial,
  };
}

describe('lectura de respuestas para el anexo', () => {
  it('sustituye «Otro» por el texto que escribió la persona', () => {
    const r = {
      lugarEstudio: 'Otro',
      lugarEstudio__otro: 'Casa de mi abuela',
      formaEstudio: JSON.stringify(['Individual', 'Otro']),
      formaEstudio__otro: 'Con tarjetas',
    };
    expect(valorDe(r, 'lugarEstudio')).toBe('Casa de mi abuela');
    expect(valoresDe(r, 'formaEstudio')).toEqual(['Individual', 'Con tarjetas']);
    expect(marcada(r, 'formaEstudio', 'Individual')).toBe(true);
    expect(marcada(r, 'formaEstudio', 'En grupo')).toBe(false);
  });

  it('escribe las fechas como en el formato impreso y conserva las filas vacías', () => {
    expect(fechaOficial('2026-10-14')).toBe('14/10/2026');
    expect(fechaOficial('')).toBe('');
    expect(rellenar(['a'], 3, '')).toEqual(['a', '', '']);
    expect(frase(['Trabajo', 'Deporte', 'Música'])).toBe('Trabajo, Deporte y Música');
  });
});

describe('documentos exportables', () => {
  it('solo exporta formatos enviados o aprobados', () => {
    const docs = documentosExportables([
      instrumento({ id: 'A', estado: 'enviado' }),
      instrumento({ id: 'B', estado: 'aprobado' }),
      instrumento({ id: 'C', estado: 'borrador' }),
      instrumento({ id: 'D', estado: 'observado' }),
    ]);
    expect(docs.map((d) => d.id).sort()).toEqual(['A', 'B']);
  });

  it('completa los datos de identidad desde el padrón sin pisar las respuestas', () => {
    const estudiante = estudiantes[0]!;
    const doc = documentoDesdeInstrumento(
      instrumento({
        estudianteId: estudiante.id,
        respuestas: { telefono: '+51 900 000 000', motivacion: 'Alta' },
      }),
    );
    expect(doc.respuestas.nombreEstudiante).toBe(nombreCompleto(estudiante));
    expect(doc.respuestas.correo).toBe(estudiante.correo);
    expect(doc.respuestas.telefono).toBe('+51 900 000 000');
    expect(doc.respuestas.motivacion).toBe('Alta');
    expect(doc.referencia).toBe(nombreCompleto(estudiante));
  });

  it('solo el formato aprobado sale sin marca', () => {
    const [doc] = documentosExportables([instrumento({ id: 'A', estado: 'enviado' })]);
    expect(marcaDe(doc!)).toBe('revision');
    expect(marcaDe({ ...doc!, estado: 'aprobado' })).toBeNull();
    expect(marcaDe(muestrasFormatos[0]!)).toBe('muestra');
  });

  it('sugiere un nombre de archivo legible y cuenta las hojas', () => {
    const [f01, , f03] = muestrasFormatos;
    expect(nombreArchivo([f03!])).toBe('formato-03-huaman-torres-kiara-milagros-2026-II');
    expect(nombreArchivo(muestrasFormatos, 'Muestra 01–12')).toBe('formatos-tutoria-muestra-01-12');
    expect(hojasDe([f01!, f03!])).toBe(3);
    expect(hojasDe(muestrasFormatos)).toBe(15);
  });
});

describe('muestras ficticias', () => {
  it('cubren los 12 formatos y van marcadas como muestra', () => {
    expect(muestrasFormatos.map((d) => d.formato)).toEqual([
      'F01',
      'F02',
      'F03',
      'F04',
      'F05',
      'F06',
      'F07',
      'F08',
      'F09',
      'F10',
      'F11',
      'F12',
    ]);
    expect(muestrasFormatos.every((d) => d.muestra)).toBe(true);
  });
});
