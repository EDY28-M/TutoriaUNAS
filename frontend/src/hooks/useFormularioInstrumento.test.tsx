import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { definicionPorCodigo } from '../data/formatos';
import type { Instrumento } from '../types/domain';
import { useFormularioInstrumento } from './useFormularioInstrumento';

const registro: Instrumento = {
  id: 'entrevista-prueba-rhf',
  formato: 'F03',
  estudianteId: 'EST-2023010456',
  tutorId: 'DOC-0421',
  semestreId: '2026-II',
  sesionId: null,
  estado: 'borrador',
  avance: 0,
  version: 1,
  creado: '2026-10-27',
  actualizado: '2026-10-27',
  enviado: null,
  revisadoPor: null,
  descargaDisponible: false,
  observaciones: [],
  respuestas: { colegio: 'Colegio original', apoderado: 'Contacto original' },
};
const portal = { sesiones: [], instrumentos: [] };

describe('precarga con React Hook Form', () => {
  it('completa los campos intactos con datos nuevos y conserva los editados aunque estén vacíos', async () => {
    const { result, rerender } = renderHook(
      ({ instrumento }) =>
        useFormularioInstrumento(definicionPorCodigo('F03')!, instrumento, portal, true),
      { initialProps: { instrumento: registro } },
    );
    act(() => result.current.formulario.setValue('respuestas.colegio', '', { shouldDirty: true }));
    rerender({
      instrumento: {
        ...registro,
        version: 2,
        respuestas: { colegio: 'Otra precarga', apoderado: 'Contacto actualizado' },
      },
    });
    await waitFor(() => expect(result.current.valores.apoderado).toBe('Contacto actualizado'));
    expect(result.current.valores.colegio).toBe('');
    expect(result.current.formulario.formState.dirtyFields.respuestas?.colegio).toBe(true);
  });
  it('separa los valores pendientes cuando se cambia de estudiante o registro', async () => {
    const { result, rerender } = renderHook(
      ({ instrumento }) =>
        useFormularioInstrumento(definicionPorCodigo('F03')!, instrumento, portal, true),
      { initialProps: { instrumento: registro } },
    );
    act(() =>
      result.current.formulario.setValue('respuestas.colegio', 'Dato de la primera persona', {
        shouldDirty: true,
      }),
    );
    rerender({
      instrumento: {
        ...registro,
        id: 'otro-registro',
        estudianteId: 'EST-2023010457',
        respuestas: { colegio: 'Colegio de la segunda persona' },
      },
    });
    await waitFor(() =>
      expect(result.current.valores.colegio).toBe('Colegio de la segunda persona'),
    );
    expect(result.current.formulario.formState.isDirty).toBe(false);
  });
  it('al recibir un documento enviado muestra su versión guardada y abandona cambios locales', async () => {
    const { result, rerender } = renderHook(
      ({ instrumento }) =>
        useFormularioInstrumento(definicionPorCodigo('F03')!, instrumento, portal, true),
      { initialProps: { instrumento: registro } },
    );
    act(() =>
      result.current.formulario.setValue('respuestas.colegio', 'Cambio pendiente', {
        shouldDirty: true,
      }),
    );
    rerender({
      instrumento: {
        ...registro,
        estado: 'enviado',
        enviado: '2026-10-27',
        respuestas: { colegio: 'Documento enviado' },
      },
    });
    await waitFor(() => expect(result.current.valores.colegio).toBe('Documento enviado'));
    expect(result.current.formulario.formState.isDirty).toBe(false);
  });
});
