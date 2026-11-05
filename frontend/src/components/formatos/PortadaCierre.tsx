import type { CodigoFormato } from '../../types/domain';
import type { ResumenCierre } from '../../utils/cierreSemestre';
import { esCierre, etiquetaAmbito } from '../../utils/cierreSemestre';
import { TITULOS_OFICIALES, fechaOficial, hojasDe } from '../../utils/exportFormatos';
import type { MomentoTutoria } from '../../utils/instrumentos';
import { Campo, Val } from './primitivas';

const ETAPA: Record<MomentoTutoria, string> = {
  inicio: 'Inicio del semestre',
  durante: 'Semestre en curso',
  cierre: 'Cierre del semestre',
};

/**
 * Primera hoja del paquete de cierre: resume qué exige la resolución en el
 * ámbito, qué se cumplió y qué falta, con nombre y situación de cada pendiente.
 */
export function PortadaCierre({ resumen, generado }: { resumen: ResumenCierre; generado: string }) {
  const cierre = esCierre(resumen.momento);
  const titulo = `${cierre ? 'Cierre' : 'Avance'} del semestre ${resumen.ambito.semestreId}`;
  const conPendientes = resumen.requisitos.filter((requisito) => requisito.pendientes.length);
  const conteo = new Map<CodigoFormato, number>();
  for (const documento of resumen.documentos)
    conteo.set(documento.formato, (conteo.get(documento.formato) ?? 0) + 1);
  const formatos = [...conteo.entries()].sort(([a], [b]) => a.localeCompare(b));
  const estado = resumen.completo
    ? 'Completo'
    : `Con ${resumen.pendientesObligatorios} pendiente(s) obligatorio(s)`;

  return (
    <article className="fo-hoja fo-portada" aria-label={titulo}>
      <p className="fo-resolucion">RESOLUCIÓN N° 500-2022-CU-R-UNAS</p>
      <header className="fo-cabecera">
        <p>Sistema de Tutoría Universitaria</p>
        <h2>{titulo}</h2>
        <p className="fo-actor">Coordinación de tutoría</p>
      </header>
      <div className="fo-cuerpo">
        <table className="fo-tabla">
          <colgroup>
            <col style={{ width: '50%' }} />
            <col />
          </colgroup>
          <tbody>
            <tr>
              <td colSpan={2} className="fo-sombra-suave">
                <Campo etiqueta="ÁMBITO" valor={etiquetaAmbito(resumen.ambito)} />
              </td>
            </tr>
            <tr>
              <td>
                <Campo etiqueta="SEMESTRE" valor={resumen.ambito.semestreId} />
              </td>
              <td>
                <Campo etiqueta="ETAPA" valor={ETAPA[resumen.momento]} />
              </td>
            </tr>
            <tr>
              <td>
                <Campo etiqueta="GENERADO" valor={fechaOficial(generado)} />
              </td>
              <td>
                <span className="fo-etq">ESTADO:</span> <span className="fo-estado">{estado}</span>
              </td>
            </tr>
          </tbody>
        </table>

        {!cierre && (
          <p className="fo-aviso">
            El semestre aún no está en cierre: este paquete es un avance y no reemplaza al documento
            de cierre.
          </p>
        )}

        <table className="fo-tabla fo-rejilla-resumen">
          <colgroup>
            <col />
            <col style={{ width: '13%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '11%' }} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="fo-sombra">
                Requisito
              </th>
              <th scope="col" className="fo-sombra fo-centro">
                Formatos
              </th>
              <th scope="col" className="fo-sombra fo-centro">
                Esperados
              </th>
              <th scope="col" className="fo-sombra fo-centro">
                Completos
              </th>
              <th scope="col" className="fo-sombra fo-centro">
                Por revisar
              </th>
              <th scope="col" className="fo-sombra fo-centro">
                Pendientes
              </th>
            </tr>
          </thead>
          <tbody>
            {resumen.requisitos.map((requisito) => (
              <tr key={requisito.clave}>
                <td>
                  {requisito.etiqueta}
                  {!requisito.obligatorio && <span className="fo-nota-tabla"> (informativo)</span>}
                </td>
                <td className="fo-centro">{requisito.formatos}</td>
                <td className="fo-centro">{requisito.esperados}</td>
                <td className="fo-centro">
                  <Val>{String(requisito.completos)}</Val>
                </td>
                <td className="fo-centro">{requisito.porRevisar || '—'}</td>
                <td
                  className={
                    requisito.pendientes.length && requisito.obligatorio
                      ? 'fo-centro fo-celda-alerta'
                      : 'fo-centro'
                  }
                >
                  {requisito.pendientes.length || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <table className="fo-tabla">
          <colgroup>
            <col style={{ width: '12%' }} />
            <col />
            <col style={{ width: '14%' }} />
          </colgroup>
          <thead>
            <tr>
              <th scope="colgroup" colSpan={3} className="fo-seccion">
                Contenido del paquete
              </th>
            </tr>
          </thead>
          <tbody>
            {formatos.length ? (
              formatos.map(([formato, cantidad]) => (
                <tr key={formato}>
                  <td className="fo-centro">{formato.slice(1)}</td>
                  <td>{TITULOS_OFICIALES[formato].titulo}</td>
                  <td className="fo-centro">
                    <Val>{String(cantidad)}</Val>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3}>Aún no hay formatos enviados en este ámbito.</td>
              </tr>
            )}
            <tr>
              <td colSpan={2}>
                <strong>Total</strong> · {hojasDe(resumen.documentos)} hoja(s) de formatos
                {resumen.porRevisar > 0 && ` · ${resumen.porRevisar} pendiente(s) de revisión`}
              </td>
              <td className="fo-centro">
                <strong>{resumen.documentos.length}</strong>
              </td>
            </tr>
          </tbody>
        </table>

        <table className="fo-tabla">
          <colgroup>
            <col />
            <col style={{ width: '32%' }} />
          </colgroup>
          <thead>
            <tr>
              <th scope="colgroup" colSpan={2} className="fo-seccion">
                Detalle de pendientes
              </th>
            </tr>
          </thead>
          {conPendientes.length ? (
            conPendientes.map((requisito) => (
              <tbody key={requisito.clave}>
                <tr>
                  <th scope="colgroup" colSpan={2} className="fo-sombra-suave fo-grupo">
                    {requisito.etiqueta} · {requisito.pendientes.length}
                    {!requisito.obligatorio && (
                      <span className="fo-nota-tabla"> (informativo)</span>
                    )}
                  </th>
                </tr>
                {requisito.pendientes.map((pendiente, i) => (
                  <tr key={i}>
                    <td>
                      <Val>{pendiente.referencia}</Val>
                    </td>
                    <td>{pendiente.situacion}</td>
                  </tr>
                ))}
              </tbody>
            ))
          ) : (
            <tbody>
              <tr>
                <td colSpan={2}>Sin pendientes.</td>
              </tr>
            </tbody>
          )}
        </table>

        <p className="fo-nota">
          Los formatos enviados que coordinación aún no aprueba llevan la marca «Pendiente de
          revisión». Los formatos no enviados no se incluyen: figuran en el detalle de pendientes.
          {resumen.eventuales > 0 &&
            ` Se incluyen ${resumen.eventuales} registro(s) de atención o derivación (08 y 12), que se llenan cuando ocurre el caso.`}
        </p>
      </div>
      <footer className="fo-pie">
        <span>Tutoría UNAS · {titulo}</span>
        {!resumen.completo && <span className="fo-pie__marca">Con pendientes</span>}
      </footer>
    </article>
  );
}
