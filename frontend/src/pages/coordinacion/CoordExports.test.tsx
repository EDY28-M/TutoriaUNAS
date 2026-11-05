import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Asignacion, Instrumento, Sesion } from '../../types/domain';
import { estudiantes, nombreCompleto } from '../../data/personas';
import { semestreActual } from '../../data/catalogos';
import { CoordExports } from './CoordExports';

const portal = {
  instrumentos: [] as Instrumento[],
  sesiones: [] as Sesion[],
  tutorados: [] as Asignacion[],
};
vi.mock('../../hooks/usePortal', () => ({ usePortal: () => portal }));
vi.mock('../../hooks/useInstrumentWorkspace', () => ({
  useInstrumentWorkspace: () => ({ registros: [], momento: 'durante', aviso: null }),
}));

const pagina = () =>
  render(
    <MemoryRouter>
      <CoordExports />
    </MemoryRouter>,
  );

function entrevistaEnviada(estudianteId: string): Instrumento {
  return {
    id: `INST-F04-${estudianteId}`,
    formato: 'F04',
    semestreId: semestreActual,
    tutorId: 'DOC-0422',
    estudianteId,
    sesionId: null,
    estado: 'enviado',
    avance: 100,
    version: 1,
    creado: '2026-09-01',
    actualizado: '2026-09-12',
    enviado: '2026-09-12',
    revisadoPor: null,
    observaciones: [],
    descargaDisponible: false,
    respuestas: { motivacion: 'Alta', lugarEstudio: 'Biblioteca' },
  };
}

describe('CoordExports', () => {
  beforeEach(() => {
    portal.instrumentos = [];
    portal.tutorados = [];
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('sin formatos enviados abre las muestras ficticias de los 12 formatos', () => {
    pagina();
    expect(screen.getByRole('heading', { name: 'Exportar formatos' })).toBeInTheDocument();
    const lista = screen.getByRole('list', { name: 'Muestras de formatos' });
    expect(within(lista).getAllByRole('listitem')).toHaveLength(12);
    expect(screen.getByRole('region', { name: /Vista previa: Formato 01/ })).toBeInTheDocument();
  });

  it('muestra los formatos enviados con la marca de revisión y arma el expediente', () => {
    const estudiante = estudiantes[0]!;
    portal.instrumentos = [entrevistaEnviada(estudiante.id)];
    pagina();
    const lista = screen.getByRole('list', { name: 'Formatos enviados' });
    expect(within(lista).getByText(nombreCompleto(estudiante))).toBeInTheDocument();
    const previa = screen.getByRole('region', { name: /Vista previa: Formato 04/ });
    expect(within(previa).getByText('Biblioteca')).toBeInTheDocument();
    expect(within(previa).getAllByText('Pendiente de revisión por coordinación')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /Por estudiante/ }));
    expect(
      screen.getByRole('heading', { name: `Expediente de ${nombreCompleto(estudiante)}` }),
    ).toBeInTheDocument();
  });

  it('permite elegir varios formatos para un solo PDF', () => {
    pagina();
    fireEvent.click(screen.getByRole('checkbox', { name: /Seleccionar formato 03/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Seleccionar formato 12/ }));
    expect(screen.getByRole('button', { name: /Exportar 2/ })).toBeInTheDocument();
  });

  it('con el semestre en curso exporta un avance con portada y pendientes', () => {
    const estudiante = estudiantes.find((e) => e.ciclo !== null && e.ciclo >= 4 && e.ciclo <= 7)!;
    portal.tutorados = [
      {
        id: 'ASG-1',
        estudianteId: estudiante.id,
        tutorId: 'DOC-0422',
        semestreId: semestreActual,
        escuelaId: estudiante.escuelaId,
        grupo: 'G-01',
        fechaInicio: '2026-09-01',
        fechaFin: null,
        estado: 'activa',
        criterio: 'sorteo',
        referenciaAprobacion: 'RD-1',
        historial: [],
      },
    ];
    portal.instrumentos = [entrevistaEnviada(estudiante.id)];
    vi.useFakeTimers();
    const imprimir = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    pagina();

    fireEvent.click(screen.getByRole('button', { name: /Cierre del semestre/ }));
    // Título del panel y título de la portada en la vista previa.
    expect(
      screen.getAllByRole('heading', { name: `Avance del semestre ${semestreActual}` }),
    ).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Plan de tutoría' })).toHaveAttribute(
      'href',
      '/coordinacion/plan',
    );
    const requisitos = screen.getByRole('list', { name: 'Requisitos del cierre' });
    expect(
      within(requisitos).getByText('Entrevistas iniciales de los estudiantes · 1/1'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Exportar avance/ }));
    act(() => {
      vi.runAllTimers();
    });
    expect(imprimir).toHaveBeenCalledTimes(1);
    expect(document.title).toMatch(/^formatos-tutoria-avance-/);
    const impresion = document.body.querySelector('.fo-impresion')!;
    expect(
      within(impresion as HTMLElement).getByRole('article', {
        name: `Avance del semestre ${semestreActual}`,
      }),
    ).toBeInTheDocument();
    expect(impresion.querySelectorAll('.fo-hoja')).toHaveLength(3);
  });
});
