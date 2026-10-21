import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { SessionCalendar } from './SessionCalendar';
import { sesiones } from '../../data/tutoria';
import type { Sesion } from '../../types/domain';

const base = sesiones[0]!;
const registros: Sesion[] = [
  { ...base, id: 'pasada', fecha: '2026-10-06', tema: 'Sesión realizada', estado: 'realizada' },
  { ...base, id: 'pendiente', fecha: '2026-10-20', tema: 'Sesión pendiente', estado: 'programada' },
  {
    ...base,
    id: 'movida',
    fecha: '2026-10-21',
    tema: 'Sesión reprogramada',
    estado: 'reprogramada',
  },
  { ...base, id: 'cancelada', fecha: '2026-10-22', tema: 'Sesión cancelada', estado: 'cancelada' },
];
it('separa pendientes y realizadas y conserva mes y selección al cambiar de vista', () => {
  render(
    <MemoryRouter>
      <SessionCalendar sesiones={registros} onAbrir={vi.fn()} />
    </MemoryRouter>,
  );
  expect(screen.getByRole('button', { name: 'Semana' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Mes' }));
  expect(screen.getByRole('tab', { name: 'Agenda' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('button', { name: /Sesión pendiente/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Sesión reprogramada/ })).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /Sesión realizada|Sesión cancelada/ }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole('button', { name: 'lunes, 28 de septiembre de 2026: 0 eventos' }),
  );
  fireEvent.click(screen.getByRole('tab', { name: 'Historial' }));
  expect(screen.getByRole('tabpanel', { name: 'Historial' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Sesión realizada/ })).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /Sesión pendiente|Sesión reprogramada|Sesión cancelada/ }),
  ).not.toBeInTheDocument();
  expect(screen.getByText('octubre de 2026', { selector: 'strong' })).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'lunes, 28 de septiembre de 2026: 0 eventos' }),
  ).toHaveAttribute('aria-pressed', 'true');
  fireEvent.keyDown(screen.getByRole('tab', { name: 'Historial' }), { key: 'ArrowLeft' });
  expect(screen.getByRole('tab', { name: 'Agenda' })).toHaveFocus();
  expect(screen.getByRole('tab', { name: 'Agenda' })).toHaveAttribute('aria-selected', 'true');
});
it('abre Historial desde su enlace y entrega la sesión completa al consultar un evento', () => {
  const abrir = vi.fn();
  render(
    <MemoryRouter initialEntries={['/estudiante/sesiones?vista=historial']}>
      <SessionCalendar sesiones={registros} onAbrir={abrir} />
    </MemoryRouter>,
  );
  expect(screen.getByRole('tab', { name: 'Historial' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('button', { name: 'Semana' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Mes' }));
  fireEvent.click(screen.getByRole('button', { name: /Sesión realizada/ }));
  expect(abrir).toHaveBeenCalledWith(registros[0]);
  expect(screen.queryByRole('button', { name: /Sesión pendiente/ })).not.toBeInTheDocument();
});
