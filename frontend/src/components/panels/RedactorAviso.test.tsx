import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RedactorAviso } from './RedactorAviso';
import { mutarSistema } from '../../services/apiSistema';
import type { MensajePersistido } from '../../types/sistema';

vi.mock('../../services/apiSistema', () => ({ mutarSistema: vi.fn() }));
vi.mock('../../hooks/usePermiso', () => ({ usePermiso: () => true }));
vi.mock('../../hooks/useSistema', () => ({
  useSistema: () => ({
    destinatariosDisponibles: [
      { id: 'EST-FICTICIO', nombre: 'Estudiante ficticio', rol: 'estudiante' },
    ],
  }),
}));
const aviso: MensajePersistido = {
  id: 'MSG-QA',
  emisorId: 'DOC-QA',
  editable: true,
  version: 1,
  asunto: 'Aviso ficticio',
  cuerpo: 'Contenido ficticio pendiente',
  destinatarios: ['ficticio@example.test'],
  destinatarioIds: ['EST-FICTICIO'],
  canal: 'sistema',
  estado: 'borrador',
  enviado: '2026-10-30T10:00:00-05:00',
  plantilla: 'redaccion-libre',
  relacionadoCon: null,
};
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
beforeEach(() => {
  vi.mocked(mutarSistema).mockReset().mockResolvedValue({});
});

it('conserva la edición y la versión inicial ante una actualización concurrente', async () => {
  const cerrar = vi.fn();
  vi.mocked(mutarSistema).mockRejectedValue(
    new Error('Conflicto de versión. Recarga el borrador.'),
  );
  const { container, rerender } = render(<RedactorAviso aviso={aviso} onCerrar={cerrar} />);
  fireEvent.change(screen.getByLabelText('Mensaje'), {
    target: { value: 'Mi edición pendiente de guardar' },
  });
  rerender(<RedactorAviso aviso={{ ...aviso, version: 2 }} onCerrar={cerrar} />);
  fireEvent.submit(container.querySelector('form')!);
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Conflicto de versión'));
  expect(mutarSistema).toHaveBeenCalledWith(
    'mensajes/MSG-QA',
    'PUT',
    expect.objectContaining({ version: 1, cuerpo: 'Mi edición pendiente de guardar' }),
  );
  expect(screen.getByLabelText('Mensaje')).toHaveValue('Mi edición pendiente de guardar');
  expect(cerrar).not.toHaveBeenCalled();
});

it('cierra el redactor solo cuando el servidor confirma el guardado', async () => {
  const cerrar = vi.fn();
  const { container } = render(<RedactorAviso aviso={aviso} onCerrar={cerrar} />);
  fireEvent.submit(container.querySelector('form')!);
  await waitFor(() => expect(cerrar).toHaveBeenCalledTimes(1));
  expect(mutarSistema).toHaveBeenCalledWith(
    'mensajes/MSG-QA',
    'PUT',
    expect.objectContaining({ destinatarios: ['EST-FICTICIO'], estado: 'borrador', version: 1 }),
  );
});

it('exige confirmar la eliminación y conserva el borrador si falla la API', async () => {
  const cerrar = vi.fn();
  vi.mocked(mutarSistema).mockRejectedValue(new Error('No hay conexión con el servidor.'));
  render(<RedactorAviso aviso={aviso} onCerrar={cerrar} />);
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar borrador' }));
  expect(mutarSistema).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar eliminación' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No hay conexión'));
  expect(mutarSistema).toHaveBeenCalledWith('mensajes/MSG-QA?version=1', 'DELETE');
  expect(screen.getByLabelText('Mensaje')).toHaveValue(aviso.cuerpo);
  expect(cerrar).not.toHaveBeenCalled();
});
