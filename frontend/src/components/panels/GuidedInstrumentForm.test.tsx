import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { definicionPorCodigo } from '../../data/formatos';
import { asignaciones } from '../../data/tutoria';
import { estudiantePorId, nombreCompleto } from '../../data/personas';
import type { Instrumento } from '../../types/domain';
import { GuidedInstrumentForm } from './GuidedInstrumentForm';

vi.mock('../../hooks/usePortal', () => ({ usePortal: () => ({ sesiones: [], instrumentos: [] }) }));
beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
const participantes = asignaciones
  .filter((a) => a.tutorId === 'DOC-0421')
  .slice(0, 3)
  .map((a) => ({
    nombre: nombreCompleto(estudiantePorId(a.estudianteId)!),
    grupo: a.grupo ?? '',
    ciclo: String(estudiantePorId(a.estudianteId)!.ciclo),
    estudianteId: a.estudianteId,
  }));
function registro(formato: Instrumento['formato'] = 'F07'): Instrumento {
  return {
    id: 'formulario-rhf',
    formato,
    tutorId: 'DOC-0421',
    estudianteId: null,
    semestreId: '2026-II',
    sesionId: null,
    estado: 'borrador',
    avance: 0,
    version: 1,
    creado: '2026-10-27',
    actualizado: '2026-10-27',
    enviado: null,
    revisadoPor: null,
    observaciones: [],
    descargaDisponible: false,
    respuestas: {
      asistentes: JSON.stringify(participantes),
      fecha: '2026-10-10',
      tema: 'Actividad ficticia',
    },
  };
}

describe('formulario guiado con RHF y resolver Zod', () => {
  it('agrupa la vista de lectura compacta por secciones sin perder respuestas', () => {
    const definicion = definicionPorCodigo('F09')!;
    const instrumento = {
      ...registro('F09'),
      respuestas: { nombreTutor: 'Tutor ficticio', actividad1: 'Realizada' },
    };
    render(<GuidedInstrumentForm definicion={definicion} instrumento={instrumento} compacto />);
    const primera = screen.getByRole('tab', { name: 'Tu grupo de tutoría' });
    const actividades = screen.getByRole('tab', { name: 'Actividades realizadas' });
    expect(primera).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Docente tutor');
    fireEvent.click(actividades);
    expect(actividades).toHaveAttribute('aria-selected', 'true');
    expect(within(screen.getByRole('tabpanel')).getByText('Realizada')).toBeVisible();
    fireEvent.keyDown(actividades, { key: 'ArrowLeft' });
    expect(primera).toHaveAttribute('aria-selected', 'true');
  });
  function editarSeccion(indice: number) {
    const definicion = definicionPorCodigo('F04')!;
    fireEvent.change(screen.getByLabelText('Sección del formulario'), {
      target: { value: String(definicion.secciones.length) },
    });
    const titulo = screen.getByText(definicion.secciones[indice]!.titulo, { selector: 'summary' });
    fireEvent.click(titulo);
    fireEvent.click(
      within(titulo.closest('details')!).getByRole('button', { name: 'Editar esta sección' }),
    );
  }
  it('conserva la precarga sin mostrar el bloque de datos disponibles y permite editar desde la revisión', async () => {
    const guardar = vi.fn();
    const instrumento = {
      ...registro('F04'),
      estudianteId: 'EST-2023010456',
      respuestas: { colegio: 'I.E. ficticia', apoderado: 'Contacto ficticio' },
    };
    const { container } = render(
      <GuidedInstrumentForm
        definicion={definicionPorCodigo('F04')!}
        instrumento={instrumento}
        editable
        compacto
        onGuardar={guardar}
      />,
    );
    expect(container.querySelector('details.tutoring-known-data')).not.toBeInTheDocument();
    expect(screen.queryByText(/Datos ya disponibles/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Colegio de procedencia/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Nombre del estudiante/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    await waitFor(() => expect(guardar).toHaveBeenCalled());
    expect(guardar.mock.lastCall![0]).toMatchObject({
      colegio: 'I.E. ficticia',
      apoderado: 'Contacto ficticio',
    });
    editarSeccion(1);
    expect(screen.getByLabelText(/Colegio de procedencia/)).toHaveValue('I.E. ficticia');
  });
  it.each(['F06', 'F07'] as const)(
    '%s conserva los datos y el nodo de la última fila al quitar la intermedia',
    async (formato) => {
      const guardar = vi.fn();
      const instrumento = registro(formato);
      const { container, rerender } = render(
        <GuidedInstrumentForm
          definicion={definicionPorCodigo(formato)!}
          instrumento={instrumento}
          editable
          compacto
          onGuardar={guardar}
        />,
      );
      fireEvent.change(screen.getByLabelText('Sección del formulario'), { target: { value: '2' } });
      const filas = container.querySelectorAll('.tutoring-edit-row');
      expect(filas).toHaveLength(3);
      const ultima = filas[2]!;
      const campo = ultima.querySelector<HTMLInputElement>('input')!;
      fireEvent.change(campo, { target: { value: '7' } });
      fireEvent.click(screen.getByRole('button', { name: /Quitar registro 2/ }));
      expect(container.querySelectorAll('.tutoring-edit-row')).toHaveLength(2);
      expect(container.querySelectorAll('.tutoring-edit-row')[1]).toBe(ultima);
      fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
      const respuestas = guardar.mock.lastCall![0] as Record<string, string>;
      const guardadas = JSON.parse(respuestas.asistentes!) as Record<string, string>[];
      expect(guardadas.map((f) => f.estudianteId)).toEqual([
        participantes[0]!.estudianteId,
        participantes[2]!.estudianteId,
      ]);
      expect(guardadas[1]![formato === 'F07' ? 'ciclo' : 'grupo']).toBe('7');
      expect(guardadas.every((f) => !('id' in f))).toBe(true);
      rerender(
        <GuidedInstrumentForm
          definicion={definicionPorCodigo(formato)!}
          instrumento={{
            ...instrumento,
            version: 2,
            respuestas: { ...instrumento.respuestas, fecha: '2026-10-11' },
          }}
          editable
          compacto
          onGuardar={guardar}
        />,
      );
      expect(container.querySelectorAll('.tutoring-edit-row')).toHaveLength(2);
      fireEvent.change(screen.getByLabelText('Sección del formulario'), { target: { value: '0' } });
      fireEvent.change(screen.getByLabelText('Sección del formulario'), { target: { value: '2' } });
      expect(container.querySelectorAll('.tutoring-edit-row')).toHaveLength(2);
      await waitFor(() =>
        expect(screen.getAllByLabelText('Apellidos y nombres')[1]).toHaveValue(
          participantes[2]!.nombre,
        ),
      );
    },
  );

  it('el borrador acepta incompletos; avanzar exige los campos del paso y muestra mensajes accesibles', async () => {
    const guardar = vi.fn();
    render(
      <GuidedInstrumentForm
        definicion={definicionPorCodigo('F07')!}
        instrumento={registro()}
        editable
        compacto
        onGuardar={guardar}
      />,
    );
    fireEvent.change(screen.getByLabelText('Sección del formulario'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    expect(guardar).toHaveBeenCalledWith(expect.any(Object), false, registro().version);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled());
    guardar.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Revisa las respuestas señaladas'),
    );
    expect(guardar).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/^Hora de inicio/)).toHaveAttribute('aria-invalid', 'true');
    fireEvent.change(screen.getByLabelText('Grupo *'), { target: { value: 'G-IIS-1' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Técnicas de estudio' }));
    fireEvent.change(screen.getByLabelText(/^Hora de inicio/), { target: { value: '10:00' } });
    fireEvent.change(screen.getByLabelText(/^Hora de fin/), { target: { value: '11:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await waitFor(() => expect(screen.getByLabelText('Sección del formulario')).toHaveValue('2'));
  });

  it('al cambiar a una respuesta que oculta el seguimiento no guarda el texto oculto', async () => {
    const guardar = vi.fn();
    const instrumento = {
      ...registro('F04'),
      estudianteId: 'EST-2023010456',
      respuestas: { expectativas: 'No', motivoExpectativas: 'Texto anterior' },
    };
    render(
      <GuidedInstrumentForm
        definicion={definicionPorCodigo('F04')!}
        instrumento={instrumento}
        editable
        compacto
        onGuardar={guardar}
      />,
    );
    editarSeccion(2);
    expect(screen.getByLabelText('¿Qué te faltó recibir? *')).toHaveValue('Texto anterior');
    fireEvent.click(screen.getByRole('radio', { name: 'Sí' }));
    expect(screen.queryByLabelText('¿Qué te faltó recibir? *')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    expect(guardar.mock.lastCall![0]).not.toHaveProperty('motivoExpectativas');
  });

  it('retira del resumen el error de una pregunta que deja de corresponder', async () => {
    const instrumento = {
      ...registro('F04'),
      estudianteId: 'EST-2023010456',
      respuestas: { expectativas: 'No', motivoExpectativas: '' },
    };
    render(
      <GuidedInstrumentForm
        definicion={definicionPorCodigo('F04')!}
        instrumento={instrumento}
        editable
        compacto
        onGuardar={vi.fn()}
      />,
    );
    editarSeccion(2);
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Qué te faltó recibir/ })).toBeVisible(),
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Sí' }));
    expect(screen.queryByRole('button', { name: /Qué te faltó recibir/ })).not.toBeInTheDocument();
  });
});
