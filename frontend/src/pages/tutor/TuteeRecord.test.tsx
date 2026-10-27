import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { estudiantes, nombreCompleto } from '../../data/personas';
import { TuteeRecord } from './TuteeRecord';

vi.mock('../../hooks/usePortal', () => ({
  usePortal: () => ({ docente: { id: 'DOC-sin-asignacion' }, tutorados: [] }),
}));

describe('alcance de la ficha de un estudiante', () => {
  it('no permite abrir por URL el expediente de alguien que no está asignado al tutor', () => {
    const estudiante = estudiantes[0]!;
    render(
      <MemoryRouter initialEntries={[`/tutor/tutorados/${estudiante.id}`]}>
        <Routes>
          <Route path="/tutor/tutorados/:estudianteId" element={<TuteeRecord />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Expediente no disponible' })).toBeVisible();
    expect(screen.queryByText(nombreCompleto(estudiante))).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Bienestar/ })).not.toBeInTheDocument();
  });
});
