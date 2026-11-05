import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StudentFormsPanel } from './StudentFormsPanel';
import type { FiltroFormularios } from './StudentFormsPanel';
import type { Instrumento, Sesion } from '../../types/domain';
import type { FormularioEstudiante } from '../../utils/formulariosEstudiante';

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

function sesion(id: string, tema: string, fecha: string): Sesion {
  return {
    id,
    codigo: id,
    tipo: 'individual',
    tutorId: 'DOC-0421',
    semestreId: '2026-II',
    fecha,
    horaInicio: '10:00',
    horaFin: '11:00',
    modalidad: 'presencial',
    lugar: 'Aula',
    tema,
    objetivo: '',
    estado: 'realizada',
    asistentes: [],
    acuerdos: [],
    instrumentoId: null,
    observacion: null,
  };
}

const sesiones = [
  sesion('S1', 'Técnicas de estudio', '2026-10-20'),
  sesion('S2', 'Organización del tiempo', '2026-11-10'),
  sesion('S3', 'Adaptación universitaria', '2026-09-15'),
];

const formularios: FormularioEstudiante[] = [
  {
    registro: instrumento({ id: 'ENT', formato: 'F04', estado: 'borrador' }),
    sesion: undefined,
    disponibilidad: 'responder',
  },
  {
    registro: instrumento({ id: 'EV1', formato: 'F10', sesionId: 'S1' }),
    sesion: sesiones[0],
    disponibilidad: 'responder',
  },
  {
    registro: instrumento({ id: 'EV2', formato: 'F10', sesionId: 'S2' }),
    sesion: sesiones[1],
    disponibilidad: 'esperando',
    motivo: 'Se habilita al terminar la sesión',
  },
  {
    registro: instrumento({
      id: 'EV3',
      formato: 'F11',
      sesionId: 'S3',
      estado: 'enviado',
      enviado: '2026-09-16',
    }),
    sesion: sesiones[2],
    disponibilidad: 'enviado',
  },
];

function panel(filtro: FiltroFormularios, lista = formularios, ciclo: number | null = 5) {
  return render(
    <MemoryRouter>
      <StudentFormsPanel
        formularios={lista}
        registros={lista.map((f) => f.registro)}
        sesiones={sesiones}
        ciclo={ciclo}
        filtro={filtro}
      />
    </MemoryRouter>,
  );
}

describe('Mis formularios del tutorado', () => {
  it('destaca la entrevista y lleva a su propia página para responderla', () => {
    panel('');
    const entrevista = screen.getByRole('link', { name: /Entrevista inicial/ });
    expect(entrevista).toHaveAttribute('href', '/estudiante/instrumentos/ENT');
    expect(within(entrevista).getByText('Continuar')).toBeInTheDocument();
    expect(
      within(entrevista).getByRole('progressbar', { name: 'Avance de la entrevista' }),
    ).toBeInTheDocument();
  });

  it('lista solo las evaluaciones habilitadas y pliega las que aún esperan', () => {
    panel('');
    const porResponder = screen.getByRole('region', { name: 'Evaluaciones por responder' });
    expect(within(porResponder).getAllByRole('link')).toHaveLength(1);
    expect(within(porResponder).getByText(/Técnicas de estudio/)).toBeInTheDocument();

    const espera = screen.getByText('Se habilitan más adelante').closest('details')!;
    expect(espera).not.toHaveAttribute('open');
    // Lo que espera no es un enlace: todavía no se puede responder.
    expect(within(espera).queryByRole('link')).not.toBeInTheDocument();
    expect(within(espera).getByText('Se habilita al terminar la sesión')).toBeInTheDocument();

    const enviados = screen.getByText('Enviados').closest('details')!;
    expect(within(enviados).getByRole('link', { name: /Ver respuestas/ })).toHaveAttribute(
      'href',
      '/estudiante/instrumentos/EV3',
    );
  });

  it('«Pendientes» muestra solo lo que se puede responder ahora', () => {
    panel('pendiente');
    expect(screen.getByRole('link', { name: /Entrevista inicial/ })).toBeInTheDocument();
    expect(screen.queryByText('Se habilitan más adelante')).not.toBeInTheDocument();
    expect(screen.queryByText('Enviados')).not.toBeInTheDocument();
  });

  it('«Por corregir» y «Enviados» tienen su propio estado vacío', () => {
    panel('observado');
    expect(screen.getByText('Nada por corregir')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Entrevista inicial/ })).not.toBeInTheDocument();

    panel(
      'entregado',
      formularios.filter((f) => f.disponibilidad !== 'enviado'),
    );
    expect(screen.getByText('Aún no envías formularios')).toBeInTheDocument();
  });

  it('una entrevista observada se presenta para corregir con el pedido del tutor', () => {
    panel('observado', [
      {
        registro: instrumento({
          id: 'ENT',
          estado: 'observado',
          observaciones: [
            {
              id: 'O1',
              autor: 'Tutor',
              fecha: '2026-10-20',
              texto: 'Completa tu horario de estudio.',
              estado: 'abierta',
            },
          ],
        }),
        sesion: undefined,
        disponibilidad: 'corregir',
      },
    ]);
    const entrevista = screen.getByRole('link', { name: /Entrevista inicial/ });
    expect(within(entrevista).getByText('Completa tu horario de estudio.')).toBeInTheDocument();
    expect(within(entrevista).getByText('Corregir')).toBeInTheDocument();
  });

  it('sin ciclo informado explica por qué aún no hay entrevista', () => {
    panel('', formularios.slice(1), null);
    expect(
      screen.getByText('Tu entrevista inicial aparecerá cuando coordinación confirme tu ciclo.'),
    ).toBeInTheDocument();
  });

  it('cuando no queda nada por responder, lo dice con claridad', () => {
    panel(
      'pendiente',
      formularios.filter((f) => f.disponibilidad === 'enviado'),
    );
    expect(screen.getByText('Estás al día')).toBeInTheDocument();
  });
});
