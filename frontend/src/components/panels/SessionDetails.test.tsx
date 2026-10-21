import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { SessionDetails } from './SessionDetails';
import { sesiones } from '../../data/tutoria';
import { estudiantePorId, nombreCompleto } from '../../data/personas';
import { cantidadAsistentes } from '../../services/sessionAttendance';

it('el detalle compartido muestra cantidad y acuerdos sin identificar asistentes ni registrar asistencia', () => {
  const sesion = sesiones.find((s) => s.tipo === 'grupal' && s.estado === 'realizada')!;
  render(<SessionDetails sesion={sesion} />);
  expect(screen.getByText(`${cantidadAsistentes(sesion)} estudiantes`)).toBeInTheDocument();
  for (const a of sesion.asistentes) {
    expect(screen.queryByText(a.estudianteId)).not.toBeInTheDocument();
    const estudiante = estudiantePorId(a.estudianteId);
    if (estudiante) expect(screen.queryByText(nombreCompleto(estudiante))).not.toBeInTheDocument();
  }
  for (const a of sesion.acuerdos) expect(screen.getByText(a.descripcion)).toBeInTheDocument();
  expect(
    screen.queryByText(/Asistió|Faltó|Tu asistencia|Registrar asistencia/),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
