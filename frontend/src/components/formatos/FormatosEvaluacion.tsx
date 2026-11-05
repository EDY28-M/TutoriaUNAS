import type { CodigoFormato } from '../../types/domain';
import type { DocumentoFormato } from '../../utils/exportFormatos';
import { fechaOficial, valorDe } from '../../utils/exportFormatos';
import { definicionPorCodigo } from '../../data/formatos';
import { Campo, Hoja, Marca, Opcion, Val } from './primitivas';

type Props = { documento: DocumentoFormato };

/** Las preguntas de las escalas (p01, p02…) en el orden del anexo. */
function preguntasDe(formato: CodigoFormato) {
  return (definicionPorCodigo(formato)?.secciones ?? [])
    .flatMap((seccion) => seccion.campos)
    .filter((campo) => /^p\d{2}$/.test(campo.codigo));
}

const ESCALA = [
  { letra: 'A', texto: 'Totalmente de acuerdo' },
  { letra: 'B', texto: 'De acuerdo' },
  { letra: 'C', texto: 'En desacuerdo' },
  { letra: 'D', texto: 'Totalmente en desacuerdo' },
];

/** Formato 10 · Evaluación de la tutoría individual (escala A–D). */
export function Formato10({ documento: d }: Props) {
  const r = d.respuestas;
  const conSugerencia = r.tieneSugerencia === 'Sí';
  const sinSugerencia = r.tieneSugerencia === 'No, todo bien';
  return (
    <Hoja documento={d}>
      <table className="fo-tabla">
        <colgroup>
          <col style={{ width: '30%' }} />
          <col style={{ width: '30%' }} />
          <col />
        </colgroup>
        <tbody>
          <tr>
            <td className="fo-sombra-suave">
              <Campo etiqueta="GRUPO" valor={r.grupo} />
            </td>
            <td className="fo-sombra-suave">
              <Campo etiqueta="TURNO" valor={r.turno} />
            </td>
            <td className="fo-sombra-suave">
              <Campo etiqueta="FECHA" valor={fechaOficial(r.fecha)} />
            </td>
          </tr>
        </tbody>
      </table>
      <table className="fo-tabla fo-pegada">
        <colgroup>
          <col />
          <col style={{ width: '6.5%' }} />
          <col style={{ width: '6.5%' }} />
          <col style={{ width: '6.5%' }} />
          <col style={{ width: '6.5%' }} />
        </colgroup>
        <tbody>
          <tr>
            <td colSpan={5}>
              <strong>COLOCA UNA X DONDE CORRESPONDA</strong>
            </td>
          </tr>
          <tr>
            <td colSpan={5} className="fo-sombra-suave">
              <span className="fo-leyenda">
                {ESCALA.map(({ letra, texto }) => (
                  <span key={letra}>
                    <strong>{letra}</strong> = {texto.toUpperCase()}
                  </span>
                ))}
              </span>
            </td>
          </tr>
          <tr>
            <th scope="col" className="fo-sombra">
              Pregunta
            </th>
            {ESCALA.map(({ letra }) => (
              <th scope="col" key={letra} className="fo-centro">
                {letra}
              </th>
            ))}
          </tr>
          {preguntasDe('F10').map((pregunta) => (
            <tr key={pregunta.codigo}>
              <td>{pregunta.etiqueta}</td>
              {ESCALA.map(({ letra }) => (
                <Marca
                  key={letra}
                  activa={(r[pregunta.codigo] ?? '').startsWith(`${letra} ·`)}
                  etiqueta={`${pregunta.etiqueta}: ${letra}`}
                />
              ))}
            </tr>
          ))}
          <tr>
            <td colSpan={5}>
              <strong>¿Tienes alguna sugerencia que hacer para que mejore la tutoría?</strong>
            </td>
          </tr>
          <tr>
            <td colSpan={5} className="fo-caja">
              <Opcion activa={conSugerencia}>SÍ (describa):</Opcion>{' '}
              {conSugerencia && <Val>{r.sugerencia}</Val>}
            </td>
          </tr>
          <tr>
            <td colSpan={5}>
              <Opcion activa={sinSugerencia}>NO, todo bien ¡Gracias!</Opcion>
            </td>
          </tr>
        </tbody>
      </table>
    </Hoja>
  );
}

const FRECUENCIA = ['Sí', 'A veces', 'No'];

/** Formato 11 · Evaluación del desempeño de tutoría grupal. */
export function Formato11({ documento: d }: Props) {
  const r = d.respuestas;
  return (
    <Hoja documento={d}>
      <table className="fo-tabla">
        <colgroup>
          <col />
          <col style={{ width: '9%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '9%' }} />
        </colgroup>
        <tbody>
          <tr>
            <td>
              <Campo etiqueta="NOMBRE DE TU TUTOR" valor={valorDe(r, 'nombreTutor')} />
            </td>
            <td colSpan={3}>
              <Campo etiqueta="FECHA DE APLICACIÓN" valor={fechaOficial(r.fecha)} />
            </td>
          </tr>
          <tr>
            <th scope="col" className="fo-sombra">
              En el grupo, tu tutor:
            </th>
            {FRECUENCIA.map((opcion) => (
              <th scope="col" key={opcion} className="fo-centro">
                {opcion.toUpperCase()}
              </th>
            ))}
          </tr>
          {preguntasDe('F11').map((pregunta) => (
            <tr key={pregunta.codigo} className="fo-fila-alta">
              <td>¿{pregunta.etiqueta}?</td>
              {FRECUENCIA.map((opcion) => (
                <Marca
                  key={opcion}
                  activa={r[pregunta.codigo] === opcion}
                  etiqueta={`${pregunta.etiqueta}: ${opcion}`}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Hoja>
  );
}
