import type { DocumentoFormato } from '../../utils/exportFormatos';
import {
  fechaOficial,
  filasDe,
  nombreEscuela,
  rellenar,
  valorDe,
} from '../../utils/exportFormatos';
import { Campo, Hoja, Marca, Seccion, Val } from './primitivas';

type Props = { documento: DocumentoFormato };
type Fila = Record<string, string>;

const TIPOS_TUTORIA = ['Académica', 'Personal', 'Social'];

/** Formato 06 · Registro de asistencia: tutoría individual. */
export function Formato06({ documento: d }: Props) {
  const r = d.respuestas;
  const filas = rellenar<Fila>(filasDe(r, 'asistentes'), 12, {});
  return (
    <Hoja documento={d}>
      <table className="fo-tabla">
        <tbody>
          <tr>
            <td className="fo-sombra-suave">
              <Campo etiqueta="NOMBRE DEL TUTOR" valor={r.nombreTutor} />
            </td>
          </tr>
        </tbody>
      </table>
      <table className="fo-tabla fo-rejilla fo-pegada">
        <colgroup>
          <col style={{ width: '13%' }} />
          <col style={{ width: '35%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '10.5%' }} />
          <col style={{ width: '10.5%' }} />
          <col style={{ width: '10.5%' }} />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" rowSpan={2}>
              Fecha
            </th>
            <th scope="col" rowSpan={2}>
              Apellidos y nombres
            </th>
            <th scope="col" rowSpan={2}>
              Grupo
            </th>
            <th scope="colgroup" colSpan={3} className="fo-sombra">
              Tipo de tutoría
            </th>
            <th scope="col" rowSpan={2}>
              Firma
            </th>
          </tr>
          <tr>
            {TIPOS_TUTORIA.map((tipo) => (
              <th scope="col" key={tipo} className="fo-subcabecera">
                {tipo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => (
            <tr key={i}>
              <td className="fo-centro">
                <Val>{fila.nombre ? fechaOficial(fila.fecha || r.fecha) : ''}</Val>
              </td>
              <td>
                <Val>{fila.nombre}</Val>
              </td>
              <td className="fo-centro">
                <Val>{fila.grupo}</Val>
              </td>
              {TIPOS_TUTORIA.map((tipo) => (
                <Marca
                  key={tipo}
                  activa={Boolean(fila.nombre) && fila.tipo === tipo}
                  etiqueta={`${fila.nombre || `Fila ${i + 1}`}: ${tipo}`}
                />
              ))}
              <td />
            </tr>
          ))}
        </tbody>
      </table>
    </Hoja>
  );
}

/** Formato 07 · Registro de asistencia de la tutoría grupal. */
export function Formato07({ documento: d }: Props) {
  const r = d.respuestas;
  const filas = rellenar<Fila>(filasDe(r, 'asistentes'), 18, {});
  const hora = r.horaInicio ? `de ${r.horaInicio}${r.horaFin ? ` a ${r.horaFin}` : ''}` : '';
  return (
    <Hoja documento={d}>
      <table className="fo-tabla">
        <colgroup>
          <col style={{ width: '46%' }} />
          <col style={{ width: '27%' }} />
          <col />
        </colgroup>
        <tbody>
          <tr>
            <td colSpan={2} className="fo-sombra-suave">
              <Campo etiqueta="NOMBRE DEL TUTOR" valor={r.nombreTutor} />
            </td>
            <td className="fo-sombra-suave">
              <Campo etiqueta="GRUPO" valor={r.grupo} />
            </td>
          </tr>
          <tr>
            <td className="fo-sombra-suave">
              <Campo etiqueta="TEMA" valor={valorDe(r, 'tema')} />
            </td>
            <td className="fo-sombra-suave">
              <Campo etiqueta="FECHA" valor={fechaOficial(r.fecha)} />
            </td>
            <td className="fo-sombra-suave">
              <Campo etiqueta="HORA" valor={hora} />
            </td>
          </tr>
        </tbody>
      </table>
      <table className="fo-tabla fo-rejilla fo-pegada">
        <colgroup>
          <col style={{ width: '7%' }} />
          <col style={{ width: '53%' }} />
          <col style={{ width: '12%' }} />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">N°</th>
            <th scope="col">Apellidos y nombres</th>
            <th scope="col">Ciclo</th>
            <th scope="col" className="fo-sombra">
              Firma
            </th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => (
            <tr key={i}>
              <td className="fo-centro">{fila.nombre ? i + 1 : ''}</td>
              <td>
                <Val>{fila.nombre}</Val>
              </td>
              <td className="fo-centro">
                <Val>{fila.ciclo}</Val>
              </td>
              <td />
            </tr>
          ))}
        </tbody>
      </table>
    </Hoja>
  );
}

/** Formato 08 · Registro de atención personalizada al estudiante. */
export function Formato08({ documento: d }: Props) {
  const r = d.respuestas;
  const resultado = r.resultado ?? '';
  const cita = [
    fechaOficial(r.proximaCita),
    r.horaCita && `${r.horaCita}${r.horaFinCita ? ` – ${r.horaFinCita}` : ''}`,
  ]
    .filter(Boolean)
    .join(', ');
  const procesos = [
    {
      titulo: 'Se resuelve con la asesoría',
      activa: resultado === 'Se resuelve con la asesoría',
      detalle: 'Caso resuelto en la sesión de asesoría.',
    },
    {
      titulo: 'Se programa nueva cita para seguimiento',
      activa: resultado === 'Se programa nueva cita para seguimiento',
      detalle: cita ? `Nueva cita: ${cita}` : '',
    },
    {
      titulo: 'Se deriva a:',
      activa: resultado === 'Se deriva a:',
      detalle: valorDe(r, 'areaDerivacion'),
    },
  ];
  return (
    <Hoja documento={d}>
      <table className="fo-tabla">
        <colgroup>
          <col style={{ width: '34%' }} />
          <col style={{ width: '33%' }} />
          <col />
        </colgroup>
        <tbody>
          <tr>
            <td colSpan={2} className="fo-sombra-suave">
              <Campo etiqueta="NOMBRE DEL TUTOR" valor={r.nombreTutor} />
            </td>
            <td className="fo-sombra-suave">
              <Campo etiqueta="FECHA" valor={fechaOficial(r.fecha)} />
            </td>
          </tr>
          <tr>
            <td colSpan={2}>
              <Campo etiqueta="NOMBRE DEL ESTUDIANTE" valor={r.nombreEstudiante} />
            </td>
            <td>
              <span className="fo-par">
                <span>
                  <Campo etiqueta="CICLO" valor={r.ciclo} />
                </span>
                <span>
                  <Campo etiqueta="GRUPO" valor={r.grupo} />
                </span>
              </span>
            </td>
          </tr>
          <Seccion columnas={3}>Motivo de atención</Seccion>
          <tr>
            <td colSpan={3} className="fo-renglones">
              <p>
                <Val>{valorDe(r, 'motivo')}</Val>
              </p>
              {r.detalleMotivo && (
                <p>
                  <Val>{r.detalleMotivo}</Val>
                </p>
              )}
            </td>
          </tr>
          <Seccion columnas={3}>Proceso de atención</Seccion>
          <tr>
            {procesos.map((proceso) => (
              <th scope="col" key={proceso.titulo} className="fo-sombra fo-centro">
                {proceso.titulo}
              </th>
            ))}
          </tr>
          <tr>
            {procesos.map((proceso) => (
              <td key={proceso.titulo} className="fo-proceso">
                {proceso.activa && (
                  <>
                    <span className="fo-proceso__marca" aria-label="Marcado">
                      X
                    </span>
                    <Val>{proceso.detalle}</Val>
                  </>
                )}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </Hoja>
  );
}

/** Formato 12 · Ficha de derivación. */
export function Formato12({ documento: d }: Props) {
  const r = d.respuestas;
  return (
    <Hoja documento={d}>
      <p className="fo-fecha-derecha">
        <Campo etiqueta="FECHA" valor={fechaOficial(r.fecha) || '……/……/………'} />
      </p>
      <table className="fo-tabla fo-holgada">
        <colgroup>
          <col style={{ width: '72%' }} />
          <col />
        </colgroup>
        <tbody>
          <tr>
            <td>
              <Campo etiqueta="APELLIDOS Y NOMBRES DEL ESTUDIANTE" valor={r.nombreEstudiante} />
            </td>
            <td>
              <Campo etiqueta="CICLO" valor={r.ciclo} />
            </td>
          </tr>
          <tr>
            <td>
              <Campo etiqueta="ESCUELA PROFESIONAL" valor={nombreEscuela(r.escuela ?? '')} />
            </td>
            <td>
              <Campo etiqueta="CÓDIGO UNIV." valor={r.codigo} />
            </td>
          </tr>
          <tr>
            <td colSpan={2}>
              <Campo etiqueta="TELÉFONO DE ESTUDIANTE" valor={r.telefono} />
            </td>
          </tr>
          <tr>
            <td colSpan={2}>
              <Campo etiqueta="SE DERIVA AL ÁREA DE" valor={valorDe(r, 'area')} />
            </td>
          </tr>
          <tr>
            <td colSpan={2} className="fo-caja">
              <Campo etiqueta="MOTIVO DE DERIVACIÓN" valor={valorDe(r, 'motivo')} />
              {r.detalle && (
                <p className="fo-parrafo">
                  <Val>{r.detalle}</Val>
                </p>
              )}
            </td>
          </tr>
          <tr>
            <td colSpan={2}>
              <Campo etiqueta="APELLIDOS Y NOMBRES DEL DOCENTE TUTOR" valor={r.nombreTutor} />
            </td>
          </tr>
          <tr>
            <td colSpan={2}>
              <Campo etiqueta="TELÉFONO DEL DOCENTE TUTOR" valor={r.telefonoTutor} />
            </td>
          </tr>
          <tr>
            <td colSpan={2} className="fo-firma-celda">
              <div className="fo-firma">
                <span className="fo-firma__linea" />
                <span>Firma del tutor</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </Hoja>
  );
}
