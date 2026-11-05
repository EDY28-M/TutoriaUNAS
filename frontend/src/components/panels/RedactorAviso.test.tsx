import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { RedactorAviso } from './RedactorAviso';

vi.mock('../../hooks/useSistema', () => ({
  useSistema: () => ({
    destinatariosDisponibles: [
      { id: 'uno', nombre: 'Ana Prueba', rol: 'estudiante' },
      { id: 'dos', nombre: 'Luis Ejemplo', rol: 'tutor' },
    ],
  }),
}));
vi.mock('../../hooks/usePermiso', () => ({ usePermiso: () => false }));
vi.mock('../ui/Sheet', () => ({
  Sheet: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe('destinatarios del aviso', () => {
  it('conserva las selecciones al buscar y permite limpiarlas', () => {
    render(<RedactorAviso onCerrar={() => {}} />);
    const busqueda = screen.getByRole('searchbox', { name: /Destinatarios/ });
    fireEvent.focus(busqueda);
    const lista = screen.getByRole('group', { name: 'Destinatarios disponibles' });
    fireEvent.click(within(lista).getByRole('checkbox', { name: /Ana Prueba/ }));
    fireEvent.change(busqueda, { target: { value: 'luis' } });
    fireEvent.click(within(lista).getByRole('checkbox', { name: /Luis Ejemplo/ }));
    expect(screen.getByText(/2 seleccionados/)).toBeInTheDocument();
    fireEvent.change(busqueda, { target: { value: '' } });
    expect(within(lista).getByRole('checkbox', { name: /Ana Prueba/ })).toBeChecked();
    expect(within(lista).getByRole('checkbox', { name: /Luis Ejemplo/ })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar selección' }));
    expect(screen.getByRole('button', { name: 'Guardar borrador' })).toBeDisabled();
  });
});
