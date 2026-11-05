import { useState } from 'react';
import type { ReactNode } from 'react';
import { Tabs, TabPanel } from '../ui/Tabs';
import { Alert } from '../ui/Alert';
import { API_MODE } from '../../services/apiConfig';
import { useDetallePadron } from '../../hooks/useDetallePadron';
import type { PersonaPadron } from '../../hooks/useDetallePadron';
import { escuelaDe } from '../../data/personas';
import { cargaSemanal, franjasDe } from '../../utils/horarioPadron';
import type { FranjaClase } from '../../utils/horarioPadron';
import { formatFecha } from '../../utils/fechas';
import type { Estudiante } from '../../types/domain';
import '../../styles/ficha-estudiante.css';

/** Curso listo para mostrar, venga del padrón o de la matrícula del estado. */
export interface CursoVista {
  id: string;
  codigo?: string;
  nombre: string;
  docente?: string;
  franjas: FranjaClase[];
  /** Horario resumido cuando no hay franjas (datos que no vienen del Excel). */
  horario?: string;
}

export interface CifraFicha {
  etiqueta: string;
  valor: ReactNode;
  riesgo?: boolean;
}

interface Props {
  id: string;
  /** Expediente del estado del portal; se completa con lo que trae el padrón. */
  base?: Estudiante;
  /** Cursos a usar si la persona no está en el padrón importado. */
  cursosRespaldo?: CursoVista[];
  semestreRespaldo?: string;
  insignias?: ReactNode;
  cifrasExtra?: CifraFicha[];
  tutoria?: { contenido: ReactNode; cantidad?: number };
}

const presente = (valor: unknown) => valor !== null && valor !== undefined && valor !== '';
const capital = (texto: string) => texto.charAt(0) + texto.slice(1).toLowerCase();

/** «1580, 1581, 1582, 1590» → «1580–1582, 1590». */
function rangos(numeros: number[]): string {
  const orden = [...new Set(numeros)].sort((a, b) => a - b);
  const tramos: string[] = [];
  for (let i = 0; i < orden.length; i++) {
    const desde = orden[i]!;
    while (i + 1 < orden.length && orden[i + 1] === orden[i]! + 1) i++;
    tramos.push(orden[i] === desde ? String(desde) : `${desde}–${orden[i]}`);
  }
  return tramos.join(', ');
}

/** Fila de datos: [etiqueta, valor, monoespaciado, ocupa las dos columnas]. */
type FilaDato = [string, ReactNode, boolean?, boolean?];

function Datos({ filas }: { filas: FilaDato[] }) {
  return (
    <dl className="fe-datos">
      {filas
        .filter(([, valor]) => presente(valor))
        .map(([etiqueta, valor, mono, ancho]) => (
          <div key={etiqueta} className={ancho ? 'fe-datos__ancho' : undefined}>
            <dt>{etiqueta}</dt>
            <dd className={mono ? 'mono' : undefined}>{valor}</dd>
          </div>
        ))}
    </dl>
  );
}

function ListaCursos({ cursos }: { cursos: CursoVista[] }) {
  return (
    <ul className="fe-cursos">
      {cursos.map((curso) => (
        <li key={curso.id}>
          <div className="fe-curso__materia">
            <strong>{curso.nombre}</strong>
            <span>
              {curso.codigo && <span className="mono">{curso.codigo}</span>}
              {curso.codigo && curso.docente && ' · '}
              {curso.docente}
            </span>
          </div>
          {curso.franjas.length > 0 ? (
            <ul className="fe-franjas" aria-label={`Horario de ${curso.nombre}`}>
              {curso.franjas.map((f) => (
                <li key={`${f.dia}-${f.horas}-${f.aula}`}>
                  <b>{f.diaTexto}</b>
                  <span className="fe-franja__hora">{f.horas}</span>
                  <span className="fe-franja__aula">
                    {f.aula}
                    {f.practica && ' · práctica'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="fe-franjas fe-nota">{curso.horario || 'Horario sin registrar'}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * Ficha compacta de una persona para coordinación. Se usa en «Estudiantes» y en
 * «Padrón»: toma los datos crudos del Excel importado y, en «Estudiantes», les suma
 * lo propio de la tutoría.
 */
export function FichaEstudiante({
  id,
  base,
  cursosRespaldo = [],
  semestreRespaldo,
  insignias,
  cifrasExtra = [],
  tutoria,
}: Props) {
  const detalle = useDetallePadron(id, API_MODE);
  const [pestana, setPestana] = useState('ficha-datos');

  if (API_MODE && detalle.isPending && !base) {
    return (
      <p className="fe-nota" role="status">
        Cargando ficha…
      </p>
    );
  }
  if (detalle.isError && !base) {
    return (
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
    );
  }

  const persona = { ...base, ...detalle.data?.persona } as PersonaPadron;
  const esDocente = 'departamento' in persona;
  const matriculas = [...(detalle.data?.matriculas ?? [])].sort((a, b) =>
    b.semestreId.localeCompare(a.semestreId),
  );
  const ultima = matriculas[0];
  const cursos: CursoVista[] = ultima
    ? ultima.cursos
        .map((c) => ({
          id: `${c.cursoId}-${c.seccion}`,
          codigo: c.codigo,
          nombre: c.nombre,
          docente: c.docente,
          franjas: franjasDe(c),
          horario: c.horario,
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    : cursosRespaldo;
  const semestre = ultima?.semestreId ?? semestreRespaldo;
  const cargandoCursos = API_MODE && detalle.isPending;

  const estudiante = esDocente ? null : (persona as Estudiante & PersonaPadron);
  const cifras: CifraFicha[] = estudiante
    ? [
        {
          etiqueta: 'PPA',
          valor: estudiante.ppaFuente || estudiante.promedioPonderado?.toFixed(2),
          riesgo: Number(estudiante.ppaFuente ?? estudiante.promedioPonderado) < 11,
        },
        { etiqueta: 'TCA', valor: estudiante.tcaFuente || estudiante.creditosAprobados },
        { etiqueta: 'Cursos', valor: cargandoCursos ? '…' : cursos.length },
        ...cifrasExtra,
      ].filter((c) => presente(c.valor))
    : [];

  const apellidos =
    persona.apellidoPaterno || persona.apellidoMaterno
      ? null
      : (persona.apellidos as string | undefined);
  const origen = persona.origen;
  const fuente = origen
    ? [
        origen.archivo,
        origen.hoja && `hoja ${origen.hoja}`,
        origen.filas?.length &&
          `${origen.filas.length === 1 ? 'fila' : 'filas'} ${rangos(origen.filas)}`,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  const carga = cargaSemanal(cursos.flatMap((c) => c.franjas));
  const pestanas = [
    { id: 'ficha-datos', label: 'Datos' },
    ...(esDocente ? [] : [{ id: 'ficha-cursos', label: 'Cursos', count: cursos.length }]),
    ...(tutoria ? [{ id: 'ficha-tutoria', label: 'Tutoría', count: tutoria.cantidad }] : []),
  ];

  return (
    <div className="fe">
      {(insignias || cifras.length > 0) && (
        <div className="fe-cabecera">
          {cifras.length > 0 && (
            <dl className="fe-cifras">
              {cifras.map((c) => (
                <div key={c.etiqueta} data-riesgo={c.riesgo || undefined}>
                  <dt>{c.etiqueta}</dt>
                  <dd>{c.valor}</dd>
                </div>
              ))}
            </dl>
          )}
          {insignias && <div className="fe-insignias">{insignias}</div>}
        </div>
      )}

      {pestanas.length > 1 && (
        <Tabs
          items={pestanas}
          activo={pestana}
          onChange={setPestana}
          etiqueta="Secciones de la ficha"
        />
      )}

      <div className="fe-panel">
        <TabPanel id="ficha-datos" activo={pestana}>
          <Datos
            filas={[
              ['Apellido paterno', persona.apellidoPaterno],
              ['Apellido materno', persona.apellidoMaterno],
              ['Apellidos', apellidos],
              ['Nombres', persona.nombres],
              ['Código', persona.codigo, true],
              ['Celular', persona.telefono],
              ...(esDocente
                ? ([
                    ['Departamento', 'departamento' in persona ? persona.departamento : ''],
                    ['Categoría', 'categoria' in persona ? persona.categoria : ''],
                    ['Dedicación', 'dedicacion' in persona ? persona.dedicacion : ''],
                  ] as FilaDato[])
                : ([
                    ['Estado padrón', persona.estadoFuente && capital(persona.estadoFuente)],
                    ['Ciclo', estudiante?.ciclo],
                    ['Ingreso', estudiante?.ingreso && formatFecha(estudiante.ingreso)],
                  ] as FilaDato[])),
              [
                'Correo',
                persona.correo && <a href={`mailto:${persona.correo}`}>{persona.correo}</a>,
                false,
                true,
              ],
              ['Escuela', persona.escuelaId && escuelaDe(persona.escuelaId), false, true],
            ]}
          />
          {fuente && <p className="fe-nota">Importado de {fuente}</p>}
        </TabPanel>

        <TabPanel id="ficha-cursos" activo={pestana}>
          {cargandoCursos ? (
            <p className="fe-nota" role="status">
              Cargando cursos…
            </p>
          ) : cursos.length === 0 ? (
            <p className="fe-nota">Sin cursos registrados para el semestre en curso.</p>
          ) : (
            <>
              <p className="fe-nota">
                {[
                  semestre && `Matrícula ${semestre}`,
                  ultima?.estado,
                  carga.horas > 0 &&
                    `${carga.horas} h de clase a la semana en ${carga.dias} ${carga.dias === 1 ? 'día' : 'días'}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <ListaCursos cursos={cursos} />
            </>
          )}
        </TabPanel>

        {tutoria && (
          <TabPanel id="ficha-tutoria" activo={pestana}>
            {tutoria.contenido}
          </TabPanel>
        )}
      </div>
    </div>
  );
}
