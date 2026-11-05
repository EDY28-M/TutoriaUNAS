import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { docentes } from '../../data/personas';
import type { Docente } from '../../types/domain';
import { CoordAssignments } from './CoordAssignments';

const datos = vi.hoisted(() => ({ docentes: [] as Docente[] }));

vi.mock('../../hooks/usePortal', () => ({
  usePortal: () => ({ escuelaId: 'IIS', docente: null, tutorados: [] }),
}));
vi.mock('../../hooks/usePersonasPortal', () => ({
  usePersonasPortal: () => ({ estudiantes: [], docentes: datos.docentes }),
}));
vi.mock('../../components/panels/GestionCoordinacion', () => ({
  SolicitudesCambioPendientes: () => null,
}));
vi.mock('../../components/ui/Sheet', () => ({
  Sheet: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe('tutores disponibles para asignación', () => {
  it('actualiza las opciones al cambiar el padrón y excluye docentes inactivos', () => {
    const docente: Docente = { ...docentes[0]!, id: 'DOC-PRUEBA', apellidos: 'Prueba' };
    datos.docentes = [{ ...docente, activo: true }];
    const vista = render(
      <MemoryRouter>
        <CoordAssignments />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Asignar tutor' }));
    const selector = screen.getByRole('combobox', { name: /Docente tutor/ });
    fireEvent.focus(selector);
    expect(
      within(screen.getByRole('listbox')).getByRole('option', { name: /Prueba/ }),
    ).toBeInTheDocument();

    datos.docentes = [
      { ...docente, activo: false },
      { ...docente, id: 'DOC-NUEVO', apellidos: 'Nuevo', activo: true },
    ];
    vista.rerender(
      <MemoryRouter>
        <CoordAssignments />
      </MemoryRouter>,
    );
    expect(
      within(screen.getByRole('listbox')).queryByRole('option', { name: /Prueba/ }),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('listbox')).getByRole('option', { name: /Nuevo/ }),
    ).toBeInTheDocument();
  });
});
