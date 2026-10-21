import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Sheet } from './Sheet';

const prototipo = HTMLDialogElement.prototype;
const showModalOriginal = Object.getOwnPropertyDescriptor(prototipo, 'showModal');
const closeOriginal = Object.getOwnPropertyDescriptor(prototipo, 'close');

beforeAll(() => {
  // jsdom no implementa dialog. El navegador entrega close de forma asíncrona,
  // después de que StrictMode ya haya ejecutado de nuevo el efecto de montaje.
  Object.defineProperty(prototipo, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(prototipo, 'close', {
    configurable: true,
    value(this: HTMLDialogElement) {
      if (!this.open) return;
      this.open = false;
      queueMicrotask(() => this.dispatchEvent(new Event('close')));
    },
  });
});

afterAll(() => {
  if (showModalOriginal) Object.defineProperty(prototipo, 'showModal', showModalOriginal);
  else Reflect.deleteProperty(prototipo, 'showModal');
  if (closeOriginal) Object.defineProperty(prototipo, 'close', closeOriginal);
  else Reflect.deleteProperty(prototipo, 'close');
});

describe('Sheet', () => {
  it('permanece abierto en StrictMode y comunica un cierre nativo real', async () => {
    const onClose = vi.fn();
    render(
      <StrictMode>
        <Sheet title="Añadir bloque" onClose={onClose}>
          Contenido del formulario
        </Sheet>
      </StrictMode>,
    );
    await act(async () => {
      await Promise.resolve();
    });

    const dialogo = screen.getByRole('dialog', { name: 'Añadir bloque' });
    expect(dialogo).toHaveAttribute('open');
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      (dialogo as HTMLDialogElement).close();
      await Promise.resolve();
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('permite cerrar con el botón y con el evento cancel de Escape', () => {
    const onClose = vi.fn();
    render(
      <Sheet title="Detalle" onClose={onClose}>
        Contenido
      </Sheet>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar ventana' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    const cancelar = new Event('cancel', { cancelable: true });
    fireEvent(screen.getByRole('dialog'), cancelar);
    expect(cancelar.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('cierra al pulsar el fondo y mantiene abierto al pulsar dentro', () => {
    const onClose = vi.fn();
    render(
      <Sheet title="Detalle" onClose={onClose}>
        <p>Contenido</p>
      </Sheet>,
    );
    const dialogo = screen.getByRole('dialog');
    vi.spyOn(dialogo, 'getBoundingClientRect').mockReturnValue({
      x: 100,
      y: 100,
      left: 100,
      top: 100,
      right: 300,
      bottom: 200,
      width: 200,
      height: 100,
      toJSON: () => ({}),
    });

    fireEvent.click(dialogo, { clientX: 150, clientY: 150 });
    fireEvent.click(screen.getByText('Contenido'), { clientX: 150, clientY: 150 });
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(dialogo, { clientX: 50, clientY: 50 });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
