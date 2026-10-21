import { describe, expect, it, vi } from 'vitest';
import { encodeCsv, downloadCsv } from './csv';
import { dashboardPath, roleDetails } from './roles';

describe('salida de reportes', () => {
  it('escapa comillas, separadores y saltos de línea', () => {
    expect(encodeCsv([['Ana, Quispe', 'Una "nota"', 'texto\nnuevo']])).toBe(
      '"Ana, Quispe","Una ""nota""","texto\nnuevo"',
    );
  });
  it.each([
    '=SUM(A1)',
    '+123',
    '-123',
    '@command',
    '  =formula',
    '\tcontent',
    '\rcontent',
    '\ncontent',
  ])('neutraliza la celda con apariencia de fórmula %s', (celda) => {
    expect(encodeCsv([[celda]])).toBe(`"'${celda}"`);
  });
  it('descarga el archivo y libera la URL del objeto', () => {
    const crear = vi.fn(() => 'blob:ejemplo');
    const revocar = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: crear, revokeObjectURL: revocar });
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    downloadCsv([['Ficticio']], 'demo.csv');
    expect(crear).toHaveBeenCalledOnce();
    expect(clic).toHaveBeenCalledOnce();
    expect(revocar).toHaveBeenCalledWith('blob:ejemplo');
    vi.unstubAllGlobals();
    clic.mockRestore();
  });
});

describe('roles del sistema', () => {
  it('describe el portal de cada rol con los textos del diseño aprobado', () => {
    expect(roleDetails.estudiante.title).toBe('Portal del estudiante');
    expect(roleDetails.tutor.title).toBe('Panel del docente tutor');
    expect(roleDetails.coordinacion.title).toBe('Coordinación de tutoría');
    expect(roleDetails.coordinacion.cta).toBe('Entrar a coordinación');
  });
  it('construye la ruta del panel de cada rol', () => {
    expect(dashboardPath('estudiante')).toBe('/estudiante/dashboard');
    expect(dashboardPath('tutor')).toBe('/tutor/dashboard');
    expect(dashboardPath('coordinacion')).toBe('/coordinacion/dashboard');
  });
});
