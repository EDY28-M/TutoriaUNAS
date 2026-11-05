import { act, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormatoOficial, ImpresionFormatos } from './FormatoOficial';
import { muestrasFormatos } from '../../data/muestrasFormatos';
import type { CodigoFormato } from '../../types/domain';

const muestra = (formato: CodigoFormato) => muestrasFormatos.find((d) => d.formato === formato)!;

function marcas(contenedor: HTMLElement) {
  return [...contenedor.querySelectorAll('.fo-marca')].filter((celda) => celda.textContent === 'X');
}

describe('FormatoOficial', () => {
  it.each(muestrasFormatos.map((d) => [d.formato, d] as const))(
    'dibuja el formato %s con la cabecera de la resolución',
    (formato, documento) => {
      const { container } = render(<FormatoOficial documento={documento} />);
      expect(screen.getAllByText('RESOLUCIÓN N° 500-2022-CU-R-UNAS').length).toBeGreaterThan(0);
      expect(screen.getByText(`FORMATO N° ${formato.slice(1)}`)).toBeInTheDocument();
      expect(screen.getAllByText('Muestra con datos ficticios').length).toBeGreaterThan(0);
      // Toda muestra trae respuestas escritas o marcadas con X.
      const respuestas = container.querySelectorAll('.fo-val').length + marcas(container).length;
      expect(respuestas).toBeGreaterThan(3);
    },
  );

  it('repite el encabezado del anexo 01 y coloca la firma del decano', () => {
    render(<FormatoOficial documento={muestra('F01')} />);
    expect(screen.getByText('ANEXO')).toBeInTheDocument();
    expect(screen.getByText('INSTRUMENTOS PARA LA ACCIÓN TUTORIAL')).toBeInTheDocument();
    expect(screen.getByText('V.º B.º Decano de la Facultad')).toBeInTheDocument();
    expect(screen.getByText(/Rocío del Pilar/)).toBeInTheDocument();
  });

  it('las entrevistas ocupan dos hojas con la numeración del anexo', () => {
    const { container } = render(<FormatoOficial documento={muestra('F05')} />);
    expect(container.querySelectorAll('.fo-hoja')).toHaveLength(2);
    // Campo laboral: 9 afirmaciones, una X por fila (SÍ o NO).
    const laboral = container.querySelector('.fo-pegada')!;
    expect(marcas(laboral as HTMLElement)).toHaveLength(9);
    expect(screen.getByText('27.')).toBeInTheDocument();
  });

  it('marca una X por pregunta en las evaluaciones 10 y 11', () => {
    const f10 = render(<FormatoOficial documento={muestra('F10')} />);
    expect(marcas(f10.container)).toHaveLength(14);
    f10.unmount();
    const f11 = render(<FormatoOficial documento={muestra('F11')} />);
    expect(marcas(f11.container)).toHaveLength(13);
  });

  it('la ficha de derivación muestra el nombre de la escuela, no su código', () => {
    render(<FormatoOficial documento={muestra('F12')} />);
    const hoja = screen.getByRole('article', { name: 'Formato N.º 12' });
    expect(within(hoja).getByText('Ingeniería en Informática y Sistemas')).toBeInTheDocument();
    expect(within(hoja).getByText('Firma del tutor')).toBeInTheDocument();
  });
});

describe('marca de revisión', () => {
  const real = (estado: 'enviado' | 'aprobado') => ({
    ...muestra('F12'),
    muestra: false,
    estado,
  });

  it('un formato enviado sin aprobar sale con «Pendiente de revisión»', () => {
    const { container } = render(<FormatoOficial documento={real('enviado')} />);
    expect(container.querySelector('.fo-agua')).toHaveTextContent('Pendiente de revisión');
    expect(screen.getByText('Pendiente de revisión por coordinación')).toBeInTheDocument();
    expect(screen.queryByText('Muestra con datos ficticios')).not.toBeInTheDocument();
  });

  it('un formato aprobado sale limpio', () => {
    const { container } = render(<FormatoOficial documento={real('aprobado')} />);
    expect(container.querySelector('.fo-agua')).toBeNull();
    expect(screen.queryByText(/Pendiente de revisión/)).not.toBeInTheDocument();
  });
});

describe('ImpresionFormatos', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('imprime solo las hojas elegidas y restaura el título al cerrar', () => {
    vi.useFakeTimers();
    const imprimir = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const terminar = vi.fn();
    document.title = 'Tutoría UNAS';
    const { unmount } = render(
      <ImpresionFormatos titulo="formato-12-prueba" onTerminar={terminar}>
        <FormatoOficial documento={muestra('F12')} />
      </ImpresionFormatos>,
    );
    expect(document.title).toBe('formato-12-prueba');
    expect(document.body).toHaveClass('fo-imprimiendo');
    expect(document.body.querySelector('.fo-impresion .fo-hoja')).not.toBeNull();
    act(() => {
      vi.runAllTimers();
    });
    expect(imprimir).toHaveBeenCalledTimes(1);
    act(() => {
      window.dispatchEvent(new Event('afterprint'));
    });
    expect(terminar).toHaveBeenCalledTimes(1);
    unmount();
    expect(document.title).toBe('Tutoría UNAS');
    expect(document.body).not.toHaveClass('fo-imprimiendo');
  });
});
