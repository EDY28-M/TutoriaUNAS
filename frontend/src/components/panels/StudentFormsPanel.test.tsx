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
  it('conserva las evaluaciones y espera la confirmación del ciclo para ofrecer la entrevista', () => {
    render(
      <MemoryRouter>
        <StudentFormsPanel registros={registros} ciclo={null} momento="inicio" onAbrir={vi.fn()} />
      </MemoryRouter>,
    );
    expect(
      screen.getByText('Coordinación debe confirmar tu ciclo para habilitar la entrevista.'),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /Comenzar · Formato 0[345]/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver preguntas · Formato 10' })).toBeVisible();
  });
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

  it('muestra el ciclo sin un selector de momento del semestre', () => {
    renderPanel('inicio');
    expect(screen.getByText('Ciclo 4 · 2026-II')).toBeVisible();
    expect(screen.queryByLabelText('Momento del semestre')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Entrevista de ciclos intermedios' })).toBeVisible();
  });

  it('al inicio permite la entrevista y bloquea evaluaciones sin sesión asociada', () => {
    renderPanel('inicio');
    expect(screen.getByRole('button', { name: 'Comenzar · Formato 04' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Ver preguntas · Formato 10' })).toBeEnabled();
    expect(screen.getAllByText('Pendiente de asistencia')).toHaveLength(2);
    expect(screen.queryByText(/En esta etapa no hay formularios/)).toBeNull();
  });

  it.each(['inicio', 'durante', 'cierre'] as const)(
    'permite recuperar la entrevista pendiente en %s',
    (momento) => {
      renderPanel(momento);
      expect(screen.getByRole('button', { name: 'Comenzar · Formato 04' })).toBeEnabled();
      expect(screen.queryByText('Se completa al inicio')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Ver preguntas · Formato 10' })).toBeEnabled();
    },
  );

  it('conserva solo la entrevista vigente y no convierte un envío en otra tarea', () => {
    render(
      <MemoryRouter>
        <StudentFormsPanel
          ciclo={5}
          momento="durante"
          onAbrir={vi.fn()}
          registros={[
            instrumento({ id: 'pasada', formato: 'F03', estado: 'enviado', semestreId: '2026-I' }),
            instrumento({
              id: 'anterior',
              formato: 'F04',
              estado: 'enviado',
              semestreId: '2026-I',
            }),
            instrumento({ id: 'vigente', formato: 'F04', estado: 'enviado' }),
            instrumento({ id: 'futura', formato: 'F05' }),
          ]}
        />
      </MemoryRouter>,
    );
    expect(screen.getAllByRole('button', { name: /Ver respuestas · Formato/ })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /Comenzar · Formato/ })).not.toBeInTheDocument();
    expect(screen.getByText('Todo al día')).toBeVisible();
  });
});
