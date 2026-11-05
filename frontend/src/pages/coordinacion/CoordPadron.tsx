import { DirectoryDisclosure, DirectoryPage } from '../../components/ui/DirectoryPage';
import { DirectorySearch } from '../../components/ui/DirectoryToolbar';
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
import type { Docente, Escuela, Estudiante } from '../../types/domain';
import { FichaEstudiante } from '../../components/panels/FichaEstudiante';
import { useDetallePadron } from '../../hooks/useDetallePadron';
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
  const detalle = useDetallePadron(id, API_MODE);
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
    <DirectoryPage className="padron-page">
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
            <DirectoryDisclosure title="Resumen de la importación">
              <div className="stack">
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
              </div>
            </DirectoryDisclosure>
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
          <div className="directory-controls">
            <DirectorySearch
              label="Nombre, correo o código"
              maxLength={150}
              value={buscar}
              onChange={(value) => {
                setBuscar(value);
                setPagina(1);
              }}
            />
            {tipo === 'estudiante' && (
              <label className="field">
                Escuela
                <select
                  className="select"
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
                    paginationPosition="bottom"
                    inlineActions
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
          className="sheet--ficha"
          title={persona ? `${persona.apellidos}, ${persona.nombres}` : 'Ficha del padrón'}
          description={persona?.codigo}
          onClose={() => setId(null)}
        >
          <FichaEstudiante key={id} id={id} />
        </Sheet>
      )}
    </DirectoryPage>
  );
}
