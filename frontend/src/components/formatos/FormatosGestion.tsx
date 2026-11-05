import type { DocumentoFormato } from '../../utils/exportFormatos';
import { fechaOficial, filasDe, rellenar } from '../../utils/exportFormatos';
import { Campo, Guiones, Hoja, Marca, Val } from './primitivas';

type Props = { documento: DocumentoFormato };
type Fila = Record<string, string>;

/** Formato 01 · Informe de actividades del proceso tutorial (equipo de tutores). */
export function Formato01({ documento: d }: Props) {
  const r = d.respuestas;
  const integrantes = (r.comision ?? '')
    .split(/\n|;/)
    .map((nombre) => nombre.trim())
    .filter(Boolean);
  const actividades = rellenar<Fila>(filasDe(r, 'actividades'), 7, {});
  return (
    <Hoja documento={d}>
      <table className="fo-tabla">
        <tbody>
          <tr>
            <th className="fo-centro">Nombre de la Facultad y/o Escuela Profesional</th>
          </tr>
          <tr>
            <td className="fo-centro">
              <Val>{r.facultad}</Val>
            </td>
          </tr>
          <tr>
            <th>Nombre de los Integrantes de la Comisión de Acción Tutorial</th>
          </tr>
          <tr>
            <td>
              <Guiones items={integrantes} minimo={3} />
            </td>
          </tr>
        </tbody>
      </table>
      <table className="fo-tabla fo-rejilla">
        <thead>
          <tr>
            <th scope="col">Problemática priorizada</th>
            <th scope="col">Meta</th>
            <th scope="col">Fecha de realización</th>
            <th scope="col">Justificación</th>
            <th scope="col">Evidencia</th>
          </tr>
        </thead>
        <tbody>
          {actividades.map((fila, i) => (
            <tr key={i}>
              <td>
                <Val>{fila.problematica}</Val>
              </td>
              <td>
                <Val>{fila.meta}</Val>
              </td>
              <td className="fo-centro">
                <Val>{fechaOficial(fila.fecha)}</Val>
              </td>
              <td>
                <Val>{fila.justificacion}</Val>
              </td>
              <td>
                <Val>{fila.evidencia}</Val>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="fo-tabla">
        <tbody>
          <tr>
            <td className="fo-caja">
              <span className="fo-etq">OBSERVACIONES:</span>
              <p className="fo-parrafo">
                <Val>{r.observaciones}</Val>
              </p>
            </td>
          </tr>
        </tbody>
      </table>
      <div className="fo-firmas">
        <div className="fo-firma">
          <span className="fo-firma__linea" />
          <span>V.º B.º Decano de la Facultad</span>
        </div>
        <div className="fo-firma">
          <span className="fo-firma__linea">
            <Val>{fechaOficial(r.fecha)}</Val>
          </span>
          <span>Fecha</span>
        </div>
      </div>
    </Hoja>
  );
}

function TablaDificultades({
  filas,
  titulo,
  segunda,
  claveSegunda,
}: {
  filas: Fila[];
  titulo: string;
  segunda: string;
  claveSegunda: string;
}) {
  return (
    <table className="fo-tabla fo-rejilla">
      <colgroup>
        <col style={{ width: '38%' }} />
        <col style={{ width: '38%' }} />
        <col />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">{titulo}</th>
          <th scope="col">{segunda}</th>
          <th scope="col">Resultados observados</th>
        </tr>
      </thead>
      <tbody>
        {rellenar<Fila>(filas, 4, {}).map((fila, i) => (
          <tr key={i}>
            <td>
              <Val>{fila.dificultad}</Val>
            </td>
            <td>
              <Val>{fila[claveSegunda]}</Val>
            </td>
            <td>
              <Val>{fila.resultado}</Val>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Formato 02 · Informe de actividades del tutor. */
export function Formato02({ documento: d }: Props) {
  const r = d.respuestas;
  return (
    <Hoja documento={d}>
      <table className="fo-tabla">
        <colgroup>
          <col style={{ width: '34%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '22%' }} />
          <col />
        </colgroup>
        <tbody>
          <tr>
            <th className="fo-centro fo-sombra" colSpan={4}>
              Informe
            </th>
          </tr>
          <tr>
            <td colSpan={3}>
              <Campo etiqueta="TUTOR" valor={r.nombreTutor} />
            </td>
            <td>
              <Campo etiqueta="FECHA" valor={fechaOficial(r.fecha)} />
            </td>
          </tr>
          <tr>
            <th scope="col">Estudiantes atendidos</th>
            <th scope="col" className="fo-centro">
              N°
            </th>
            <th scope="col" className="fo-centro">
              Ciclo
            </th>
            <th scope="col" className="fo-centro">
              Número de sesiones
            </th>
          </tr>
          <tr>
            <th scope="row">Grupal</th>
            <td className="fo-centro">
              <Val>{r.atendidosGrupal}</Val>
            </td>
            <td className="fo-centro">
              <Val>{r.ciclosGrupal}</Val>
            </td>
            <td className="fo-centro">
              <Val>{r.grupales}</Val>
            </td>
          </tr>
          <tr>
            <th scope="row">Individual</th>
            <td className="fo-centro">
              <Val>{r.atendidosIndividual}</Val>
            </td>
            <td className="fo-centro">
              <Val>{r.ciclosIndividual}</Val>
            </td>
            <td className="fo-centro">
              <Val>{r.individuales}</Val>
            </td>
          </tr>
        </tbody>
      </table>
      <TablaDificultades
        filas={filasDe(r, 'dificultadesAcademicas')}
        titulo="Dificultades académicas más comunes"
        segunda="Actividades recomendadas"
        claveSegunda="actividad"
      />
      <TablaDificultades
        filas={filasDe(r, 'dificultadesTutoria')}
        titulo="Dificultades académicas para realizar la tutoría"
        segunda="Tipo de atención realizada"
        claveSegunda="atencion"
      />
      <TablaDificultades
        filas={filasDe(r, 'dificultadesPersonales')}
        titulo="Dificultades de orden personal identificadas"
        segunda="Tipo de atención realizada"
        claveSegunda="atencion"
      />
      <table className="fo-tabla">
        <tbody>
          <tr>
            <th className="fo-centro">Observaciones generales</th>
          </tr>
          <tr>
            <td className="fo-caja">
              <p className="fo-parrafo">
                <Val>{r.observaciones}</Val>
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    </Hoja>
  );
}

/** Redacción del anexo impreso (tercera persona), no la del formulario en línea. */
const ACTIVIDADES_F09 = [
  'Participó en el curso inductivo para favorecer la integración del equipo de tutores',
  'Conoce personalmente a cada uno de los tutorados',
  'Realizó un diagnóstico de los hábitos, estrategias y técnicas de estudio de sus tutorados grupal o individualmente',
  'Elaboró con el equipo de tutores el Plan de Acción Tutorial',
  'Colaboró con el equipo de tutores en las actividades planeadas',
  'Llevó a cabo el seguimiento académico de los estudiantes de alto riesgo',
  'Derivó a estudiantes que requerían atención especializada',
  'Convocó a padres de estudiantes cuando fue necesario',
  'Mantuvo contacto con docentes para conocer la situación académica de sus tutorados',
  'Realizó actividades de tipo preventivo con su grupo de tutorados',
];

/** Formato 09 · Autoevaluación de la actividad tutorial. */
export function Formato09({ documento: d }: Props) {
  const r = d.respuestas;
  return (
    <Hoja documento={d}>
      <table className="fo-tabla">
        <colgroup>
          <col style={{ width: '50%' }} />
          <col />
        </colgroup>
        <tbody>
          <tr>
            <td colSpan={2}>
              <Campo etiqueta="NOMBRE DEL TUTOR" valor={r.nombreTutor} />
            </td>
          </tr>
          <tr>
            <td>
              <Campo etiqueta="N° DE GRUPOS ASIGNADOS" valor={r.gruposAsignados} />
            </td>
            <td>
              <Campo etiqueta="N° DE ESTUDIANTES" valor={r.estudiantesAsignados} />
            </td>
          </tr>
        </tbody>
      </table>
      <table className="fo-tabla">
        <colgroup>
          <col />
          <col style={{ width: '12%' }} />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className="fo-sombra">
              Marque con una X las actividades que haya realizado
            </th>
            <th scope="col" className="fo-sombra fo-centro">
              <span className="sr-only">Realizada</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {ACTIVIDADES_F09.map((actividad, i) => (
            <tr key={actividad} className="fo-fila-alta">
              <td>{actividad}</td>
              <Marca activa={r[`actividad${i + 1}`] === 'Realizada'} etiqueta={actividad} />
            </tr>
          ))}
        </tbody>
      </table>
      <table className="fo-tabla">
        <tbody>
          <tr>
            <td className="fo-caja">
              <span className="fo-etq">OBSERVACIONES:</span>
              <p className="fo-parrafo">
                <Val>{r.observaciones}</Val>
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    </Hoja>
  );
}
