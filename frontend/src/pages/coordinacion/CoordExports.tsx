import { DirectorySearch } from '../../components/ui/DirectoryToolbar';
import { useId, useMemo, useState } from 'react';
import { CompactPage } from '../../components/ui/CompactPage';
import { PageHeading } from '../../components/ui/PageHeading';
import { FormsFilters } from '../../components/ui/FormsPanel';
import { Card, CardHead } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Alert } from '../../components/ui/Alert';
import { Badge, StatusBadge } from '../../components/ui/StatusBadge';
import {
  HojasFormatos,
  ImpresionFormatos,
  VistaPreviaFormatos,
} from '../../components/formatos/FormatoOficial';
import { PortadaCierre } from '../../components/formatos/PortadaCierre';
import { usePortal } from '../../hooks/usePortal';
import { useInstrumentWorkspace } from '../../hooks/useInstrumentWorkspace';
import { definicionesFormato } from '../../data/formatos';
import { muestrasFormatos } from '../../data/muestrasFormatos';
import { semestreActual } from '../../data/catalogos';
import { escuelaDe, docentePorId, estudiantePorId, nombreCompleto } from '../../data/personas';
import type { CodigoFormato, Estudiante } from '../../types/domain';
import { esCierre } from '../../utils/cierreSemestre';
import type { ResumenCierre } from '../../utils/cierreSemestre';
import { fechaActualLima } from '../../utils/fechas';
import { CierreSemestre } from './CierreSemestre';
import {
  TITULOS_OFICIALES,
  documentosExportables,
  expedienteDeEstudiante,
  fechaOficial,
  hojasDe,
  nombreArchivo,
} from '../../utils/exportFormatos';
import type { DocumentoFormato } from '../../utils/exportFormatos';
import { normalizar } from '../../utils/busqueda';
import '../../styles/coord-exports.css';

type Vista = 'completados' | 'estudiantes' | 'muestras' | 'cierre';

interface Expediente {
  estudiante: Estudiante;
  documentos: DocumentoFormato[];
}

interface Impresion {
  id: number;
  documentos: DocumentoFormato[];
  titulo: string;
  /** El paquete de cierre abre con su portada de avance y pendientes. */
  portada?: { resumen: ResumenCierre; generado: string };
}

const numero = (formato: CodigoFormato) => formato.slice(1);

/**
 * Exportación de los formatos 01–12 que el estudiante, el tutor y la comisión
 * ya enviaron, con el diseño de los anexos de la Resolución N.º
 * 500-2022-CU-R-UNAS. El PDF se genera con «Guardar como PDF» del navegador.
 */
export function CoordExports() {
  const portal = usePortal();
  const { aviso, momento } = useInstrumentWorkspace();
  const idFormato = useId();
  const [vistaElegida, setVista] = useState<Vista | null>(null);
  const [formato, setFormato] = useState<CodigoFormato | 'todos'>('todos');
  const [buscar, setBuscar] = useState('');
  const [activoElegido, setActivo] = useState<string | null>(null);
  const [seleccion, setSeleccion] = useState<ReadonlySet<string>>(new Set());
  const [impresion, setImpresion] = useState<Impresion | null>(null);

  const completados = useMemo(
    () => documentosExportables(portal.instrumentos, portal.sesiones),
    [portal.instrumentos, portal.sesiones],
  );
  const expedientes = useMemo<Expediente[]>(() => {
    const ids = [...new Set(completados.map((d) => d.estudianteId).filter(Boolean))] as string[];
    return ids
      .map((id) => ({
        estudiante: estudiantePorId(id),
        documentos: expedienteDeEstudiante(completados, id, portal.sesiones, portal.instrumentos),
      }))
      .filter((item): item is Expediente => Boolean(item.estudiante))
      .sort((a, b) => nombreCompleto(a.estudiante).localeCompare(nombreCompleto(b.estudiante)));
  }, [completados, portal.sesiones, portal.instrumentos]);

  // Sin formatos enviados todavía, la página abre en las muestras ficticias.
  const vista: Vista = vistaElegida ?? (completados.length ? 'completados' : 'muestras');
  const texto = normalizar(buscar);
  const coincideFormato = (d: DocumentoFormato) => formato === 'todos' || d.formato === formato;
  const coincideTexto = (d: DocumentoFormato) =>
    normalizar(
      `${numero(d.formato)} ${TITULOS_OFICIALES[d.formato].titulo} ${d.referencia} ${d.respuestas.nombreTutor ?? ''}`,
    ).includes(texto);

  const documentosVisibles =
    vista === 'muestras'
      ? muestrasFormatos.filter((d) => coincideFormato(d) && coincideTexto(d))
      : completados.filter((d) => coincideFormato(d) && coincideTexto(d));
  const expedientesVisibles = expedientes
    .map((item) => ({ ...item, documentos: item.documentos.filter(coincideFormato) }))
    .filter(
      (item) =>
        item.documentos.length > 0 &&
        normalizar(`${nombreCompleto(item.estudiante)} ${item.estudiante.codigo}`).includes(texto),
    );

  const activoDocumento =
    vista !== 'estudiantes'
      ? (documentosVisibles.find((d) => d.id === activoElegido) ?? documentosVisibles[0] ?? null)
      : null;
  const activoExpediente =
    vista === 'estudiantes'
      ? (expedientesVisibles.find((e) => e.estudiante.id === activoElegido) ??
        expedientesVisibles[0] ??
        null)
      : null;
  const enVista = activoExpediente?.documentos ?? (activoDocumento ? [activoDocumento] : []);
  const seleccionados = documentosVisibles.filter((d) => seleccion.has(d.id));

  function cambiarVista(id: string) {
    setVista(id as Vista);
    setActivo(null);
    setSeleccion(new Set());
  }
  function alternar(id: string) {
    setSeleccion((actual) => {
      const nueva = new Set(actual);
      if (nueva.has(id)) nueva.delete(id);
      else nueva.add(id);
      return nueva;
    });
  }
  function exportar(documentos: DocumentoFormato[], etiqueta?: string) {
    if (!documentos.length) return;
    setImpresion({
      id: Date.now(),
      documentos,
      titulo: nombreArchivo(documentos, etiqueta),
    });
  }
  function exportarCierre(resumen: ResumenCierre) {
    const { semestreId, escuelaId, tutorId } = resumen.ambito;
    const etiqueta = [
      esCierre(resumen.momento) ? 'cierre' : 'avance',
      semestreId,
      escuelaId ? escuelaDe(escuelaId) : 'todas-las-escuelas',
      tutorId ? (docentePorId(tutorId)?.codigo ?? tutorId) : '',
    ].join(' ');
    setImpresion({
      id: Date.now(),
      documentos: resumen.documentos,
      titulo: nombreArchivo(resumen.documentos, etiqueta),
      portada: { resumen, generado: fechaActualLima() },
    });
  }

  const tituloVista = activoExpediente
    ? `Expediente de ${nombreCompleto(activoExpediente.estudiante)}`
    : activoDocumento
      ? `Formato ${numero(activoDocumento.formato)} · ${activoDocumento.referencia}`
      : 'Vista previa';

  return (
    <CompactPage>
      <PageHeading
        eyebrow="Coordinación"
        title="Exportar formatos"
        description="Formatos 01–12 con el diseño de la Resolución N.º 500-2022-CU-R-UNAS, llenados con las respuestas enviadas y listos para guardar en PDF."
        actions={
          <button
            type="button"
            className="btn btn-falcon-default"
            onClick={() => exportar(muestrasFormatos, 'muestra-formatos-01-12')}
          >
            <i className="fa-solid fa-file-pdf" aria-hidden="true" /> Muestra de los 12 formatos
          </button>
        }
      />

      {aviso && (
        <Alert tone="alerta" title="No se pudo actualizar la información">
          {aviso} Se muestran los últimos formatos cargados.
        </Alert>
      )}

      <FormsFilters
        label="Qué exportar"
        options={[
          { id: 'completados', nombre: 'Formatos completados', cantidad: completados.length },
          { id: 'estudiantes', nombre: 'Por estudiante', cantidad: expedientes.length },
          { id: 'muestras', nombre: 'Muestras ficticias', cantidad: muestrasFormatos.length },
          {
            id: 'cierre',
            nombre: 'Cierre del semestre',
            cantidad: completados.filter((d) => d.semestreId === semestreActual).length,
          },
        ]}
        value={vista}
        onChange={cambiarVista}
        acciones={
          vista !== 'cierre' && (
            <div className="fx-filtros">
              <div className="field">
                <label htmlFor={idFormato} className="sr-only">
                  Formato
                </label>
                <select
                  id={idFormato}
                  className="select"
                  value={formato}
                  onChange={(evento) => setFormato(evento.target.value as CodigoFormato | 'todos')}
                >
                  <option value="todos">Todos los formatos</option>
                  {definicionesFormato.map((definicion) => (
                    <option key={definicion.codigo} value={definicion.codigo}>
                      {definicion.numero} · {TITULOS_OFICIALES[definicion.codigo].titulo}
                    </option>
                  ))}
                </select>
              </div>
              <DirectorySearch
                value={buscar}
                onChange={setBuscar}
                label={vista === 'estudiantes' ? 'Buscar estudiante' : 'Buscar formato o persona'}
              />
            </div>
          )
        }
      />

      {vista === 'muestras' && (
        <Alert tone="info" title="Datos ficticios">
          Cada formato está llenado con personas y respuestas inventadas para revisar el diseño. Las
          hojas exportadas llevan la marca «Muestra con datos ficticios».
        </Alert>
      )}

      {vista === 'cierre' ? (
        <CierreSemestre
          semestreId={semestreActual}
          momento={momento}
          asignaciones={portal.tutorados}
          sesiones={portal.sesiones}
          instrumentos={portal.instrumentos}
          onExportar={exportarCierre}
        />
      ) : (
        <div className="fx-layout">
          <Card className="fx-lista">
            {vista === 'estudiantes' ? (
              <>
                <CardHead
                  title="Expedientes"
                  description="Todo lo que respondió el estudiante y lo que su tutor registró sobre él."
                />
                {expedientesVisibles.length ? (
                  <ul className="compact-list" aria-label="Estudiantes con formatos completados">
                    {expedientesVisibles.map(({ estudiante, documentos }) => {
                      const activo = activoExpediente?.estudiante.id === estudiante.id;
                      return (
                        <li
                          key={estudiante.id}
                          className={activo ? 'fx-item fx-item--activo' : 'fx-item'}
                        >
                          <button
                            type="button"
                            className="compact-list__row"
                            aria-current={activo ? 'true' : undefined}
                            onClick={() => setActivo(estudiante.id)}
                          >
                            <span className="compact-list__body">
                              <strong>{nombreCompleto(estudiante)}</strong>
                              <small>
                                {estudiante.codigo} · Formatos{' '}
                                {[...new Set(documentos.map((d) => numero(d.formato)))].join(', ')}
                              </small>
                            </span>
                            <span className="compact-list__end">
                              <Badge tone="info">{documentos.length}</Badge>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <EmptyState
                    title={buscar ? 'Sin coincidencias' : 'Aún no hay expedientes para exportar'}
                    description={
                      buscar
                        ? 'Prueba con otro nombre o código.'
                        : 'Aparecerán cuando los estudiantes envíen sus entrevistas y evaluaciones.'
                    }
                    action={
                      !buscar && (
                        <button
                          type="button"
                          className="btn btn-falcon-default btn-sm"
                          onClick={() => cambiarVista('muestras')}
                        >
                          Ver muestras ficticias
                        </button>
                      )
                    }
                  />
                )}
              </>
            ) : (
              <>
                <CardHead
                  title={vista === 'muestras' ? 'Muestras' : 'Formatos enviados'}
                  description={
                    seleccionados.length
                      ? `${seleccionados.length} seleccionado(s) para exportar juntos.`
                      : 'Marca varios para exportarlos en un solo PDF.'
                  }
                  actions={
                    seleccionados.length > 0 && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => exportar(seleccionados)}
                      >
                        <i className="fa-solid fa-file-pdf" aria-hidden="true" /> Exportar{' '}
                        {seleccionados.length}
                      </button>
                    )
                  }
                />
                {documentosVisibles.length ? (
                  <ul
                    className="compact-list"
                    aria-label={vista === 'muestras' ? 'Muestras de formatos' : 'Formatos enviados'}
                  >
                    {documentosVisibles.map((documento) => {
                      const activo = activoDocumento?.id === documento.id;
                      const marcado = seleccion.has(documento.id);
                      return (
                        <li
                          key={documento.id}
                          className={activo ? 'fx-item fx-item--activo' : 'fx-item'}
                        >
                          <label className="fx-item__check">
                            <input
                              type="checkbox"
                              checked={marcado}
                              onChange={() => alternar(documento.id)}
                              aria-label={`Seleccionar formato ${numero(documento.formato)} de ${documento.referencia}`}
                            />
                          </label>
                          <button
                            type="button"
                            className="compact-list__row"
                            aria-current={activo ? 'true' : undefined}
                            onClick={() => setActivo(documento.id)}
                          >
                            <span className="compact-code">{numero(documento.formato)}</span>
                            <span className="compact-list__body">
                              <strong>{documento.referencia}</strong>
                              <small>
                                {TITULOS_OFICIALES[documento.formato].titulo} ·{' '}
                                {fechaOficial(documento.fecha) || 'Sin fecha'}
                              </small>
                            </span>
                            <span className="compact-list__end">
                              {documento.muestra ? (
                                <Badge tone="dorado">Ficticio</Badge>
                              ) : (
                                <StatusBadge estado={documento.estado} contexto="formulario" />
                              )}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <EmptyState
                    title={
                      buscar || formato !== 'todos'
                        ? 'Sin coincidencias'
                        : 'Aún no hay formatos enviados'
                    }
                    description={
                      buscar || formato !== 'todos'
                        ? 'Cambia el formato o la búsqueda.'
                        : 'Los formatos se podrán exportar cuando el estudiante, el tutor o la comisión los envíen.'
                    }
                    action={
                      vista === 'completados' &&
                      !buscar &&
                      formato === 'todos' && (
                        <button
                          type="button"
                          className="btn btn-falcon-default btn-sm"
                          onClick={() => cambiarVista('muestras')}
                        >
                          Ver muestras ficticias
                        </button>
                      )
                    }
                  />
                )}
              </>
            )}
          </Card>

          <section className="fx-previa" aria-labelledby={`${idFormato}-previa`}>
            <header className="fx-previa__cabecera">
              <div>
                <h2 id={`${idFormato}-previa`}>{tituloVista}</h2>
                <p>
                  {enVista.length
                    ? `${enVista.length} formato(s) · ${hojasDe(enVista)} hoja(s) A4`
                    : 'Elige un formato de la lista.'}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!enVista.length}
                onClick={() =>
                  exportar(
                    enVista,
                    activoExpediente
                      ? `expediente-${activoExpediente.estudiante.codigo}-${activoExpediente.documentos[0]?.semestreId ?? ''}`
                      : undefined,
                  )
                }
              >
                <i className="fa-solid fa-file-pdf" aria-hidden="true" /> Exportar PDF
              </button>
            </header>
            {enVista.length ? (
              <VistaPreviaFormatos documentos={enVista} etiqueta={`Vista previa: ${tituloVista}`} />
            ) : (
              <Card>
                <EmptyState
                  title="Nada que mostrar"
                  description="Selecciona un formato o un estudiante para ver cómo quedará el PDF."
                />
              </Card>
            )}
            <p className="compact-note">
              Al exportar se abre la ventana de impresión: elige «Guardar como PDF», tamaño A4 y sin
              encabezados del navegador.
            </p>
          </section>
        </div>
      )}

      {impresion && (
        <ImpresionFormatos
          key={impresion.id}
          titulo={impresion.titulo}
          onTerminar={() => setImpresion(null)}
        >
          {impresion.portada && (
            <PortadaCierre
              resumen={impresion.portada.resumen}
              generado={impresion.portada.generado}
            />
          )}
          <HojasFormatos documentos={impresion.documentos} />
        </ImpresionFormatos>
      )}
    </CompactPage>
  );
}
