import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { PageHeading } from '../../components/ui/PageHeading';
import { Card, CardBody, CardHead } from '../../components/ui/Card';
import { Tabs } from '../../components/ui/Tabs';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Sheet } from '../../components/ui/Sheet';
import { Alert } from '../../components/ui/Alert';
import { EmptyState } from '../../components/ui/EmptyState';
import { apiJson } from '../../services/apiClient';
import { API_MODE } from '../../services/apiConfig';
import type { Docente, Escuela, Estudiante, MatriculaCurso } from '../../types/domain';
import '../../styles/padron.css';

type Persona = (Estudiante | Docente) & {
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  ppaFuente?: string;
  tcaFuente?: string;
};
interface Importacion {
  alumnos: number;
  docentes: number;
  filasDocentesExcluidas: number;
  horarios: number;
  horariosSinNormalizar: number;
  archivo: string;
  semestre: string;
}
interface Padron {
  filas: Persona[];
  total: number;
  pagina: number;
  tamano: number;
  escuelas: Escuela[];
  importaciones: Importacion[];
}
interface Detalle {
  persona: Persona;
  matriculas: {
    semestreId: string;
    estado: string;
    cursos: (MatriculaCurso & { codigo: string; nombre: string })[];
  }[];
}

/** Consulta completa de ambas hojas. El servidor pagina y restringe el padrón a coordinación. */
export function CoordPadron() {
  const [parametros] = useSearchParams();
  const [tipo, setTipo] = useState(parametros.get('hoja') === 'docentes' ? 'tutor' : 'estudiante');
  const [buscar, setBuscar] = useState('');
  const [escuela, setEscuela] = useState('');
  const [pagina, setPagina] = useState(1);
  const [id, setId] = useState<string | null>(null);
  const consulta = useDeferredValue(buscar);
  const padron = useQuery({
    queryKey: ['padron', tipo, consulta, escuela, pagina],
    queryFn: () =>
      apiJson<Padron>(
        `/api/padron?${new URLSearchParams({ tipo, buscar: consulta, escuelaId: escuela, pagina: String(pagina) })}`,
      ),
    enabled: API_MODE,
  });
  const detalle = useQuery({
    queryKey: ['padron-detalle', id],
    queryFn: () => apiJson<Detalle>(`/api/padron/${encodeURIComponent(id!)}`),
    enabled: API_MODE && id !== null,
  });
  const datos = padron.data;
  const reporte = datos?.importaciones[0];
  const persona = detalle.data?.persona;
  const escuelaDe = (school: string) =>
    datos?.escuelas.find((e) => e.id === school)?.nombre ?? 'Sin escuela tutorial asignada';
  const columnas: Column<Persona>[] = [
    {
      key: 'persona',
      header: tipo === 'estudiante' ? 'Alumno' : 'Docente',
      render: (p) => (
        <span className="person-cell__text">
          <strong>
            {p.apellidos}, {p.nombres}
          </strong>
          {p.codigo && <small className="mono">{p.codigo}</small>}
        </span>
      ),
    },
    {
      key: 'area',
      header: tipo === 'estudiante' ? 'Escuela' : 'Departamento académico',
      render: (p) => ('departamento' in p ? p.departamento : escuelaDe(p.escuelaId)),
    },
    {
      key: 'correo',
      header: 'Correo',
      render: (p) => <a href={`mailto:${p.correo}`}>{p.correo}</a>,
    },
    ...(tipo === 'estudiante'
      ? [
          {
            key: 'ppa',
            header: 'PPA',
            render: (p: Persona) =>
              'promedioPonderado' in p ? (p.promedioPonderado?.toFixed(2) ?? 'Sin informar') : '—',
          },
          {
            key: 'tca',
            header: 'TCA',
            render: (p: Persona) =>
              'creditosAprobados' in p ? (p.creditosAprobados ?? 'Sin informar') : '—',
          },
        ]
      : []),
    {
      key: 'detalle',
      header: 'Ficha',
      render: (p) => (
        <button
          type="button"
          className="btn btn-falcon-default btn-sm"
          aria-label={`Ver ficha de ${p.nombres} ${p.apellidos}`}
          onClick={() => setId(p.id)}
        >
          Ver datos
        </button>
      ),
    },
  ];
  return (
    <div className="padron-page stack stack--lg">
      <PageHeading
        eyebrow="Coordinación · Datos institucionales"
        title="Padrón importado"
        description="Alumnos, docentes, matrícula y horarios del Excel."
      />
      {!API_MODE ? (
        <EmptyState
          title="Disponible con la base de datos"
          description="Abre el sistema en modo API para consultar el padrón importado."
        />
      ) : (
        <>
          {reporte && (
            <Card>
              <CardBody>
                <div className="grid grid--3">
                  <div>
                    <strong>{reporte.alumnos.toLocaleString('es-PE')}</strong>
                    <p>Alumnos · {reporte.semestre}</p>
                  </div>
                  <div>
                    <strong>{reporte.docentes.toLocaleString('es-PE')}</strong>
                    <p>Docentes con nombre, apellido y correo</p>
                  </div>
                  <div>
                    <strong>{reporte.horarios.toLocaleString('es-PE')}</strong>
                    <p>Bloques de clase</p>
                  </div>
                </div>
                <p className="small muted">
                  {reporte.filasDocentesExcluidas} filas docentes excluidas por identidad o correo
                  incompletos. {reporte.horariosSinNormalizar} horarios con datos por revisar
                  conservan su texto original en la ficha del alumno.
                </p>
              </CardBody>
            </Card>
          )}
          <Tabs
            etiqueta="Hojas del padrón"
            activo={tipo}
            onChange={(valor) => {
              setTipo(valor);
              setPagina(1);
              setEscuela('');
            }}
            items={[
              { id: 'estudiante', label: 'Alumnos' },
              { id: 'tutor', label: 'Docentes' },
            ]}
          />
          <div className="grid grid--2">
            <label>
              Buscar por nombre, apellido, correo o código
              <input
                className="form-control"
                type="search"
                maxLength={150}
                value={buscar}
                onChange={(e) => {
                  setBuscar(e.target.value);
                  setPagina(1);
                }}
              />
            </label>
            {tipo === 'estudiante' && (
              <label>
                Escuela
                <select
                  className="form-select"
                  value={escuela}
                  onChange={(e) => {
                    setEscuela(e.target.value);
                    setPagina(1);
                  }}
                >
                  <option value="">Todas las escuelas</option>
                  {datos?.escuelas.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {padron.isPending ? (
            <p role="status">Cargando padrón…</p>
          ) : padron.isError ? (
            <Alert tone="riesgo" title="No se pudo consultar el padrón">
              <p>{padron.error.message}</p>
              <button
                type="button"
                className="btn btn-falcon-default"
                onClick={() => void padron.refetch()}
              >
                Reintentar
              </button>
            </Alert>
          ) : (
            datos && (
              <Card>
                <CardHead
                  title={`${tipo === 'estudiante' ? 'Alumnos' : 'Docentes'} · ${datos.total.toLocaleString('es-PE')}`}
                />
                <CardBody>
                  <DataTable
                    rows={datos.filas}
                    columns={columnas}
                    caption={
                      tipo === 'estudiante'
                        ? 'Alumnos del padrón importado'
                        : 'Docentes del padrón importado'
                    }
                    rowKey={(p) => p.id}
                    pageSize={25}
                    pagination="auto"
                    emptyTitle="Sin coincidencias"
                  />
                  <nav className="padron-pager" aria-label="Páginas del padrón">
                    <button
                      type="button"
                      className="btn btn-falcon-default"
                      disabled={datos.pagina <= 1}
                      onClick={() => setPagina(datos.pagina - 1)}
                    >
                      Anterior
                    </button>
                    <span role="status">
                      Página {datos.pagina} de {Math.max(1, Math.ceil(datos.total / datos.tamano))}
                    </span>
                    <button
                      type="button"
                      className="btn btn-falcon-default"
                      disabled={datos.pagina * datos.tamano >= datos.total}
                      onClick={() => setPagina(datos.pagina + 1)}
                    >
                      Siguiente
                    </button>
                  </nav>
                </CardBody>
              </Card>
            )
          )}
        </>
      )}
      {id && (
        <Sheet
          wide
          title={persona ? `${persona.apellidos}, ${persona.nombres}` : 'Ficha del padrón'}
          onClose={() => setId(null)}
        >
          {detalle.isPending ? (
            <p role="status">Cargando ficha…</p>
          ) : detalle.isError ? (
            <Alert tone="riesgo" title="No se pudo cargar la ficha">
              <p>{detalle.error.message}</p>
              <button
                type="button"
                className="btn btn-falcon-default"
                onClick={() => void detalle.refetch()}
              >
                Reintentar
              </button>
            </Alert>
          ) : (
            persona && (
              <div className="stack stack--lg">
                <dl className="def-list">
                  <div>
                    <dt>Apellido paterno</dt>
                    <dd>{persona.apellidoPaterno || 'Sin informar'}</dd>
                  </div>
                  <div>
                    <dt>Apellido materno</dt>
                    <dd>{persona.apellidoMaterno || 'Sin informar'}</dd>
                  </div>
                  <div>
                    <dt>Nombres</dt>
                    <dd>{persona.nombres}</dd>
                  </div>
                  <div>
                    <dt>Correo</dt>
                    <dd>
                      <a href={`mailto:${persona.correo}`}>{persona.correo}</a>
                    </dd>
                  </div>
                  {'departamento' in persona ? (
                    <div>
                      <dt>Departamento académico</dt>
                      <dd>{persona.departamento}</dd>
                    </div>
                  ) : (
                    <>
                      <div>
                        <dt>Código de alumno</dt>
                        <dd className="mono">{persona.codigo}</dd>
                      </div>
                      <div>
                        <dt>Escuela</dt>
                        <dd>{escuelaDe(persona.escuelaId)}</dd>
                      </div>
                      <div>
                        <dt>Estado en el Excel</dt>
                        <dd>{persona.estadoFuente}</dd>
                      </div>
                      <div>
                        <dt>Celular</dt>
                        <dd>{persona.telefono || 'Sin informar'}</dd>
                      </div>
                      <div>
                        <dt>PPA</dt>
                        <dd>{persona.ppaFuente || 'Sin informar'}</dd>
                      </div>
                      <div>
                        <dt>TCA</dt>
                        <dd>{persona.tcaFuente || 'Sin informar'}</dd>
                      </div>
                    </>
                  )}
                </dl>
                {detalle.data?.matriculas.map((m) => (
                  <section className="stack" key={m.semestreId}>
                    <h2>Matrícula {m.semestreId}</h2>
                    <p>
                      {m.estado} · {m.cursos.length} cursos
                    </p>
                    {m.cursos.map((c) => (
                      <details key={`${c.cursoId}-${c.seccion}`}>
                        <summary>
                          <strong>
                            {c.codigo} · {c.nombre}
                          </strong>{' '}
                          · Grupo {c.seccion}
                        </summary>
                        <p>Docente: {c.docente || 'Sin informar'}</p>
                        <div
                          className="table-wrap"
                          role="region"
                          aria-label={`Horario de ${c.nombre}`}
                          tabIndex={0}
                        >
                          <table className="data-table data-table--compact">
                            <caption>
                              Horario original de {c.nombre} · grupo {c.seccion}
                            </caption>
                            <thead>
                              <tr>
                                <th>Día</th>
                                <th>Horas</th>
                                <th>Duración</th>
                                <th>Aula</th>
                                <th>Cód. aula</th>
                                <th>Teórica</th>
                                <th>Docente</th>
                              </tr>
                            </thead>
                            <tbody>
                              {c.horariosOriginales?.map((h) => (
                                <tr key={h.fila}>
                                  <td>
                                    {[
                                      'Lunes',
                                      'Martes',
                                      'Miércoles',
                                      'Jueves',
                                      'Viernes',
                                      'Sábado',
                                      'Domingo',
                                    ][Number(h.dia) - 1] ?? h.dia}
                                  </td>
                                  <td className="nowrap">{h.horas}</td>
                                  <td>{h.duracion === '0' ? '0 · Por revisar' : h.duracion}</td>
                                  <td>{h.aula || 'Sin informar'}</td>
                                  <td>{h.codigoAula || 'Sin informar'}</td>
                                  <td>
                                    {h.esHoraTeorica === '1'
                                      ? 'Sí'
                                      : h.esHoraTeorica === '0'
                                        ? 'No'
                                        : h.esHoraTeorica}
                                  </td>
                                  <td>{h.docente}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    ))}
                  </section>
                ))}
                <p className="small muted">
                  Fuente: {persona.origen?.archivo} · {persona.origen?.hoja}. Filas:{' '}
                  {persona.origen?.filas?.join(', ')}.
                </p>
              </div>
            )
          )}
        </Sheet>
      )}
    </div>
  );
}
