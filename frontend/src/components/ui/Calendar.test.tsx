import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Calendar } from './Calendar';
import type { EventoCalendario } from './Calendar';

function evento(id: number, hora = '16:00–18:00'): EventoCalendario {
  return {
    id: `${id}`,
    fecha: '2026-10-13',
    titulo: `Sesión de orientación ${id}`,
    hora,
    detalle: `Docente ficticio ${id}`,
    etiqueta: 'programada',
    lugar: 'Sala de tutoría',
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-14T17:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('Calendar', () => {
  it('abre en la fecha actual de Lima y Hoy no vuelve al corte de los datos ficticios', () => {
    vi.setSystemTime(new Date('2026-11-01T02:00:00Z')); // En Lima todavía es 31 de octubre.
    render(<Calendar etiqueta="pruebas" eventos={[]} />);
    expect(
      screen.getByRole('button', { name: 'sábado, 31 de octubre de 2026: 0 eventos' }),
    ).toHaveAttribute('aria-current', 'date');
    fireEvent.click(screen.getByRole('button', { name: 'Semana anterior' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hoy' }));
    expect(
      screen.getByRole('button', { name: 'sábado, 31 de octubre de 2026: 0 eventos' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });
  it('mantiene compacta una semana sin eventos en lugar de reservar diez horas vacías', () => {
    render(<Calendar etiqueta="pruebas" eventos={[]} />);
    expect(document.querySelector<HTMLElement>('.calendar__week-grid')!.style.height).toBe('288px');
  });
  it('mantiene la misma grilla al seleccionar días de ambos meses contiguos', () => {
    render(<Calendar etiqueta="pruebas" eventos={[]} vistaInicial="mes" />);
    const grilla = screen.getByRole('group', { name: 'Calendario de pruebas' });
    const fechas = within(grilla)
      .getAllByRole('button')
      .map((boton) => boton.getAttribute('aria-label'));
    for (const fecha of [
      'lunes, 28 de septiembre de 2026',
      'miércoles, 30 de septiembre de 2026',
      'jueves, 1 de octubre de 2026',
      'sábado, 31 de octubre de 2026',
      'domingo, 1 de noviembre de 2026',
    ]) {
      const boton = within(grilla).getByRole('button', { name: `${fecha}: 0 eventos` });
      fireEvent.click(boton);
      expect(screen.getByText('octubre de 2026', { selector: 'strong' })).toBeInTheDocument();
      expect(
        within(grilla)
          .getAllByRole('button')
          .map((dia) => dia.getAttribute('aria-label')),
      ).toEqual(fechas);
      expect(boton).toHaveAttribute('aria-pressed', 'true');
      expect(document.querySelectorAll('.calendar__day--selected')).toHaveLength(1);
      expect(screen.getByRole('region', { name: `Agenda del ${fecha}` })).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole('button', { name: 'Mes' }));
    expect(screen.getByText('octubre de 2026', { selector: 'strong' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mes siguiente' }));
    expect(screen.getByText('noviembre de 2026', { selector: 'strong' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mes anterior' }));
    expect(screen.getByText('octubre de 2026', { selector: 'strong' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mes anterior' }));
    expect(screen.getByText('septiembre de 2026', { selector: 'strong' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hoy' }));
    expect(screen.getByText('octubre de 2026', { selector: 'strong' })).toBeInTheDocument();
  });

  it('abre sesiones y listas de un mes contiguo sin desplazar el mes visible', () => {
    const abrir = vi.fn();
    render(
      <Calendar
        etiqueta="pruebas"
        vistaInicial="mes"
        onAbrir={abrir}
        eventos={Array.from({ length: 8 }, (_, i) => ({ ...evento(i), fecha: '2026-09-29' }))}
      />,
    );
    const celda = screen.getByRole('button', {
      name: 'martes, 29 de septiembre de 2026: 8 eventos',
    }).parentElement!;
    fireEvent.click(within(celda).getByRole('button', { name: /Sesión de orientación 0/ }));
    expect(abrir).toHaveBeenCalledOnce();
    expect(screen.getByText('octubre de 2026', { selector: 'strong' })).toBeInTheDocument();
    fireEvent.click(within(celda).getByRole('button', { name: '+5 más' }));
    const agenda = screen.getByRole('region', {
      name: 'Agenda del martes, 29 de septiembre de 2026',
    });
    expect(within(agenda).getAllByRole('listitem')).toHaveLength(6);
    fireEvent.click(within(agenda).getByRole('button', { name: 'Mostrar más (2)' }));
    expect(within(agenda).getAllByRole('listitem')).toHaveLength(8);
    expect(screen.getByText('octubre de 2026', { selector: 'strong' })).toBeInTheDocument();
  });

  it('conserva la semana que cruza un mes y cambia de período solo al navegar', () => {
    render(<Calendar etiqueta="pruebas" eventos={[]} mesInicial="2026-09-30" />);
    fireEvent.click(
      screen.getByRole('button', { name: 'domingo, 4 de octubre de 2026: 0 eventos' }),
    );
    expect(screen.getByText('28 septiembre – 4 octubre de 2026')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Semana siguiente' }));
    expect(screen.getByText('5 – 11 de octubre de 2026')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Semana anterior' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'domingo, 4 de octubre de 2026: 0 eventos' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Mes' }));
    expect(screen.getByText('octubre de 2026', { selector: 'strong' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'domingo, 4 de octubre de 2026: 0 eventos' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('traslada la selección a una sola columna y conserva una sola fecha al cambiar a mes', () => {
    render(<Calendar etiqueta="pruebas" eventos={[]} />);
    const viernes = screen.getByRole('button', {
      name: 'viernes, 16 de octubre de 2026: 0 eventos',
    });
    fireEvent.click(viernes);
    expect(document.querySelectorAll('.calendar__col.is-selected')).toHaveLength(1);
    expect(document.querySelectorAll('.calendar__col.is-today')).toHaveLength(0);
    expect(viernes).toHaveAttribute('aria-pressed', 'true');
    const miercoles = screen.getByRole('button', {
      name: 'miércoles, 14 de octubre de 2026: 0 eventos',
    });
    expect(miercoles).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Mes' }));
    expect(document.querySelectorAll('.calendar__day--selected')).toHaveLength(1);
    expect(
      screen.getByRole('button', { name: 'viernes, 16 de octubre de 2026: 0 eventos' }),
    ).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Hoy' }));
    expect(document.querySelectorAll('.calendar__day--selected')).toHaveLength(1);
    expect(
      screen.getByRole('button', { name: 'miércoles, 14 de octubre de 2026: 0 eventos' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('da acceso a todos los eventos de un grupo denso y a su detalle completo', () => {
    const abrir = vi.fn();
    render(
      <Calendar
        etiqueta="pruebas"
        eventos={Array.from({ length: 8 }, (_, i) => evento(i))}
        onAbrir={abrir}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Ver 8 eventos del martes, 13 de octubre de 2026' }),
    );
    const agenda = screen.getByRole('region', { name: 'Agenda del martes, 13 de octubre de 2026' });
    expect(within(agenda).getAllByRole('listitem')).toHaveLength(6);
    fireEvent.click(within(agenda).getByRole('button', { name: 'Mostrar más (2)' }));
    expect(within(agenda).getAllByRole('listitem')).toHaveLength(8);
    fireEvent.click(within(agenda).getByRole('button', { name: /Sesión de orientación 7/ }));
    expect(abrir).toHaveBeenCalledWith(evento(7));
  });

  it('mantiene el título, horario, docente y lugar completos en la agenda adaptable', () => {
    render(<Calendar etiqueta="pruebas" eventos={[evento(1)]} />);
    const agenda = screen.getByLabelText('Agenda de la semana');
    expect(within(agenda).getByText('16:00 – 18:00')).toBeInTheDocument();
    expect(within(agenda).getByText('Sesión de orientación 1')).toBeInTheDocument();
    expect(within(agenda).getByText('Docente ficticio 1')).toBeInTheDocument();
    expect(within(agenda).getByText('Sala de tutoría')).toBeInTheDocument();
  });

  it('permite seleccionar un día mensual con teclado sin anidar botones', () => {
    render(<Calendar etiqueta="pruebas" eventos={[evento(1)]} vistaInicial="mes" />);
    const dia = screen.getByRole('button', { name: 'martes, 13 de octubre de 2026: 1 eventos' });
    fireEvent.click(dia);
    expect(dia).toHaveAttribute('aria-pressed', 'true');
    expect(dia.querySelector('button')).toBeNull();
    expect(
      screen.getByRole('region', { name: 'Agenda del martes, 13 de octubre de 2026' }),
    ).toBeInTheDocument();
  });

  it('muestra eventos temprano y tarde dentro de la franja visible', () => {
    render(
      <Calendar
        etiqueta="pruebas"
        eventos={[evento(1, '06:00–07:00'), evento(2, '23:00–23:30')]}
      />,
    );
    const bloques = document.querySelectorAll<HTMLElement>('.calendar__block');
    const alto = Number.parseFloat(
      document.querySelector<HTMLElement>('.calendar__week-grid')!.style.height,
    );
    for (const bloque of bloques) {
      expect(Number.parseFloat(bloque.style.top)).toBeGreaterThanOrEqual(0);
      expect(
        Number.parseFloat(bloque.style.top) + Number.parseFloat(bloque.style.height),
      ).toBeLessThanOrEqual(alto);
    }
    expect(bloques).toHaveLength(2);
  });
});
