import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Instrumento, Sesion } from '../types/domain';
import { apiJson } from './apiClient';
import {
  guardarFormularioApi,
  programarSesionApi,
  refrescarApi,
  snapshotApi,
  vaciarApi,
} from './apiTutoria';
import type { EstadoApi } from './apiTutoria';

vi.mock('./apiClient', () => ({
  apiJson: vi.fn(),
  getApiSession: () => ({ accessToken: 'cuenta-ficticia' }),
}));
const document: Instrumento = {
  id: 'INST-FICTICIO',
  formato: 'F03',
  tutorId: 'DOC-FICTICIO',
  estudianteId: 'EST-FICTICIO',
  semestreId: '2026-II',
  sesionId: null,
  estado: 'borrador',
  avance: 10,
  version: 2,
  creado: '2026-10-28',
  actualizado: '2026-10-28',
  enviado: null,
  revisadoPor: null,
  observaciones: [],
  descargaDisponible: false,
  respuestas: { apoderado: 'Dato anterior' },
};
function state(record = document): EstadoApi {
  return {
    usuario: {
      id: 'EST-FICTICIO',
      role: 'estudiante',
      name: 'Ficticio',
      identifier: 'ficticio',
      email: 'ficticio@example.test',
    },
    semestreId: '2026-II',
    momento: 'inicio',
    periodoVersion: 1,
    estudiantes: [],
    docentes: [],
    asignaciones: [],
    matriculas: [],
    horarios: [],
    registros: [record],
    sesiones: [],
    precargas: {},
  };
}
describe('estado remoto del expediente', () => {
  beforeEach(() => {
    vaciarApi();
    vi.mocked(apiJson).mockReset();
  });
  it('una escritura rechazada no cambia la versión ni las respuestas de la bandeja', async () => {
    vi.mocked(apiJson).mockResolvedValueOnce(state());
    await refrescarApi();
    vi.mocked(apiJson).mockRejectedValueOnce(new Error('El registro cambió en otro cliente.'));
    await expect(
      guardarFormularioApi(document, { apoderado: 'Sin confirmar' }, false, 2),
    ).rejects.toThrow('El registro cambió');
    expect(snapshotApi().workspace.registros[0]).toEqual(document);
  });
  it('distingue un guardado confirmado de una recarga posterior que falla', async () => {
    vi.mocked(apiJson).mockResolvedValueOnce(state());
    await refrescarApi();
    const saved = { ...document, version: 3, respuestas: { apoderado: 'Dato confirmado' } };
    vi.mocked(apiJson)
      .mockResolvedValueOnce(saved)
      .mockRejectedValueOnce(new Error('No se pudo actualizar la bandeja'));
    await expect(guardarFormularioApi(document, saved.respuestas, false, 2)).resolves.toEqual(
      saved,
    );
    expect(snapshotApi().workspace.registros[0]).toEqual(saved);
    expect(snapshotApi().error).toContain('No se pudo actualizar');
    const session: Sesion = {
      id: 'SES-FICTICIA',
      codigo: 'TUT-FICTICIA',
      tipo: 'individual',
      tutorId: 'DOC-FICTICIO',
      semestreId: '2026-II',
      fecha: '2026-11-01',
      horaInicio: '10:00',
      horaFin: '11:00',
      modalidad: 'presencial',
      lugar: 'Sala ficticia',
      tema: 'Prueba de persistencia',
      objetivo: 'Comprobar una confirmación',
      estado: 'programada',
      asistentes: [],
      acuerdos: [],
      instrumentoId: null,
      observacion: null,
      version: 1,
    };
    vi.mocked(apiJson)
      .mockResolvedValueOnce(session)
      .mockRejectedValueOnce(new Error('No se pudo actualizar la agenda'));
    await programarSesionApi({ ...session, estudiantes: ['EST-FICTICIO'] });
    expect(snapshotApi().datos?.sesiones).toEqual([session]);
  });
  it('una consulta más antigua no sobrescribe los datos de una consulta reciente', async () => {
    let finishOld!: (value: unknown) => void;
    vi.mocked(apiJson).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOld = resolve;
        }),
    );
    const old = refrescarApi();
    const latest = { ...document, version: 5 };
    vi.mocked(apiJson).mockResolvedValueOnce(state(latest));
    await refrescarApi();
    finishOld(state());
    await old;
    expect(snapshotApi().workspace.registros[0]?.version).toBe(5);
  });
  it('una consulta pendiente no resucita el expediente después de cerrar la cuenta', async () => {
    let finish!: (value: unknown) => void;
    vi.mocked(apiJson).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = refrescarApi();
    vaciarApi();
    finish(state());
    await pending;
    expect(snapshotApi().datos).toBeNull();
    expect(snapshotApi().workspace.registros).toEqual([]);
  });
});
