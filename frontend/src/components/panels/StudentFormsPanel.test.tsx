import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StudentFormsPanel } from './StudentFormsPanel';
import type { Instrumento } from '../../types/domain';

function instrumento(parcial: Partial<Instrumento>): Instrumento {
  return {
    id: 'prueba',
    formato: 'F04',
    semestreId: '2026-II',
    tutorId: 'DOC-0421',
    estudianteId: 'EST-2023010456',
    sesionId: null,
    estado: 'no-iniciado',
    avance: 0,
    version: 1,
    creado: '2026-10-16',
    actualizado: '2026-10-16',
    enviado: null,
    revisadoPor: null,
    observaciones: [],
    descargaDisponible: false,
    respuestas: {},
    ...parcial,
  };
}

const registros: Instrumento[] = [
  instrumento({ id: 'entrevista', formato: 'F04' }),
  instrumento({ id: 'individual', formato: 'F10' }),
  instrumento({ id: 'grupal', formato: 'F11' }),
];

function renderPanel(momento: 'inicio' | 'durante' | 'cierre') {
  return render(
    <MemoryRouter>
      <StudentFormsPanel registros={registros} ciclo={4} momento={momento} onAbrir={vi.fn()} />
    </MemoryRouter>,
  );
}

describe('etapas del portal del estudiante', () => {
  it.each([
    [1, 'F03'],
    [2, 'F03'],
    [3, 'F03'],
    [4, 'F04'],
    [5, 'F04'],
    [6, 'F04'],
    [7, 'F04'],
    [8, 'F05'],
    [9, 'F05'],
    [10, 'F05'],
  ] as const)('el ciclo %i muestra únicamente la entrevista %s', (ciclo, formato) => {
    render(
      <MemoryRouter>
        <StudentFormsPanel
          ciclo={ciclo}
          momento="inicio"
          onAbrir={vi.fn()}
          registros={['F03', 'F04', 'F05'].map((codigo) =>
            instrumento({ id: codigo, formato: codigo as Instrumento['formato'] }),
          )}
        />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('button', { name: `Comenzar · Formato ${formato.slice(1)}` }),
    ).toBeEnabled();
    expect(screen.getAllByRole('button', { name: /^Comenzar · Formato/ })).toHaveLength(1);
  });

  it('coloca el selector de etapa en la fila de filtros, junto a los contadores', () => {
    renderPanel('inicio');
    const filtros = screen.getByRole('group', { name: 'Filtrar mis formularios' });
    const etapa = screen.getByLabelText('Momento del semestre');
    expect(filtros.contains(etapa)).toBe(true);
    expect(etapa).toHaveValue('inicio');
  });

  it('explica el ciclo y la entrevista que corresponde', () => {
    const { container } = renderPanel('inicio');
    const contexto = container.querySelector('.forms-panel__context');
    expect(contexto?.textContent).toContain('Tu ciclo es 4');
    expect(contexto?.textContent).toContain('formato 04');
    expect(contexto?.textContent).toContain('ciclos 4 a 7');
  });

  it('al inicio permite la entrevista y bloquea evaluaciones sin sesión asociada', () => {
    renderPanel('inicio');
    expect(screen.getByRole('button', { name: 'Comenzar · Formato 04' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Ver preguntas · Formato 10' })).toBeEnabled();
    expect(screen.getAllByText('Pendiente de asistencia')).toHaveLength(2);
    expect(screen.queryByText(/En esta etapa no hay formularios/)).toBeNull();
  });

  it('durante el semestre explica que las evaluaciones dependen de la asistencia', () => {
    renderPanel('durante');
    expect(screen.getByText(/Cada evaluación se habilita al finalizar su sesión/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Ver preguntas · Formato 04' })).toBeEnabled();
    expect(screen.getByText('Se completa al inicio')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Comenzar · Formato 04' })).toBeNull();
  });

  it('cambiar al cierre no habilita una evaluación sin asistencia', () => {
    renderPanel('cierre');
    expect(screen.getByRole('button', { name: 'Ver preguntas · Formato 10' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Ver preguntas · Formato 11' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Ver preguntas · Formato 04' })).toBeEnabled();
    expect(screen.getByText('Se completa al inicio')).toBeVisible();
  });
});
