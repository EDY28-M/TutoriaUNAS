import { useMemo, useState } from 'react';
import { API_MODE } from '../../services/apiConfig';
import { snapshotApi } from '../../services/apiTutoria';
import { listaRespuesta, filasRespuesta } from '../../utils/instrumentos';
import { PageHeading } from '../../components/ui/PageHeading';
import { Card, CardBody, CardHead } from '../../components/ui/Card';
import { Badge, StatusBadge } from '../../components/ui/StatusBadge';
import { DataTable } from '../../components/ui/DataTable';
import type { Column } from '../../components/ui/DataTable';
import { Sheet } from '../../components/ui/Sheet';
import { Alert } from '../../components/ui/Alert';
import { EmptyState } from '../../components/ui/EmptyState';
import { usePortal } from '../../hooks/usePortal';
import { definicionPorCodigo } from '../../data/formatos';
import { areasDerivacion, semestreActual } from '../../data/catalogos';
import { downloadCsv } from '../../utils/csv';
import { formatFecha } from '../../utils/fechas';
import '../../assets/vendor/fontawesome.min.css';
import '../../styles/student-documents.css';

interface Documento {
  id: string;
  tipo: 'instrumento' | 'constancia' | 'derivacion';
  titulo: string;
  referencia: string;
  fecha: string;
  estado: string;
  detalle: string;
  descargable: boolean;
  periodo: string;
}

/**
 * Repositorio documental del tutorado: instrumentos aprobados, constancias y
 * fichas de derivación que puede consultar y descargar, con su periodo y
 * versión.
 */
export function StudentDocuments() {
  const portal = usePortal();
  const { estudiante, instrumentos, derivaciones } = portal;
  const historial = snapshotApi().datos?.historial;
  const [abierto, setAbierto] = useState<Documento | null>(null);

  const documentos = useMemo<Documento[]>(() => {
    const registros = [
      ...new Map(
        [...instrumentos, ...(API_MODE ? (historial ?? []) : [])].map((r) => [r.id, r]),
      ).values(),
    ];
    const deInstrumentos: Documento[] = registros
      .filter(
        (instrumento) =>
          instrumento.estado === 'aprobado' || (API_MODE && instrumento.estado === 'enviado'),
      )
      .map((instrumento) => {
        const definicion = definicionPorCodigo(instrumento.formato);
        return {
          id: instrumento.id,
          tipo: 'instrumento' as const,
          titulo: `Formato ${definicion?.numero} · ${definicion?.nombre}`,
          referencia: instrumento.id,
          fecha: instrumento.actualizado,
          estado: instrumento.estado,
          detalle: `Versión ${instrumento.version} · ${definicion?.actorEtiqueta ?? ''}`,
          descargable: API_MODE || instrumento.descargaDisponible,
          periodo: instrumento.semestreId,
        };
      });

    const deDerivaciones: Documento[] = derivaciones.map((derivacion) => ({
      id: derivacion.id,
      tipo: 'derivacion' as const,
      titulo: `Ficha de derivación · ${
        areasDerivacion.find((item) => item.id === derivacion.area)?.nombre ?? derivacion.area
      }`,
      referencia: derivacion.codigo,
      fecha: derivacion.fechaDerivacion,
      estado: derivacion.estado,
      detalle: derivacion.motivo,
      descargable: true,
      periodo: derivacion.semestreId,
    }));

    const constancias: Documento[] = API_MODE
      ? []
      : [
          {
            id: 'CONST-TUTORIA',
            periodo: semestreActual,
            tipo: 'constancia',
            titulo: 'Constancia de participación en el Programa de Tutoría',
            referencia: `CONST-${semestreActual}-TUTORIA`,
            fecha: '2026-10-14',
            estado: 'aprobado',
            detalle:
              'Acredita la participación en las sesiones del semestre. Requiere la visación del docente tutor.',
            descargable: false,
          },
          {
            id: 'CONST-MATRICULA',
            periodo: semestreActual,
            tipo: 'constancia',
            titulo: 'Constancia de matrícula del semestre',
            referencia: `CONST-${semestreActual}-MATRICULA`,
            fecha: '2026-08-22',
            estado: 'aprobado',
            detalle: 'Emitida por la DIAA a partir del registro de matrícula.',
            descargable: false,
          },
        ];

    return [...deInstrumentos, ...deDerivaciones, ...constancias];
  }, [derivaciones, instrumentos, historial]);

  if (!estudiante) {
    return (
      <EmptyState
        title="Sin datos del estudiante"
        description="La cuenta no tiene expediente asociado."
      />
    );
  }

  const descargables = documentos.filter((documento) => documento.descargable);

  function descargar(documento: Documento) {
    if (!documento.descargable) return;
    const registro = [...instrumentos, ...(historial ?? [])].find((r) => r.id === documento.id);
    const respuestas: string[][] = [];
    if (registro)
      for (const seccion of definicionPorCodigo(registro.formato)?.secciones ?? [])
        for (const campo of seccion.campos) {
          const valor = registro.respuestas[campo.codigo] ?? '';
          if (campo.tipo === 'tabla')
            filasRespuesta(valor).forEach((fila, i) =>
              campo.columnas?.forEach((c) =>
                respuestas.push([
                  seccion.titulo,
                  `${campo.etiqueta} · ${i + 1} · ${c.etiqueta}`,
                  fila[c.codigo] ?? '',
                ]),
              ),
            );
          else
            respuestas.push([
              seccion.titulo,
              campo.etiqueta,
              (campo.tipo === 'multiple' ? listaRespuesta(valor).join(' · ') : valor) +
                (registro.respuestas[`${campo.codigo}__otro`]
                  ? `: ${registro.respuestas[`${campo.codigo}__otro`]}`
                  : ''),
            ]);
        }
    downloadCsv(
      [
        ['Documento', 'Referencia', 'Fecha', 'Estado', 'Periodo'],
        [
          documento.titulo,
          documento.referencia,
          documento.fecha,
          documento.estado,
          documento.periodo,
        ],
        ...(respuestas.length ? [[], ['Sección', 'Campo', 'Respuesta'], ...respuestas] : []),
      ],
      `${documento.referencia}.csv`,
    );
  }

  const tipos = {
    instrumento: 'Formulario',
    constancia: 'Constancia',
    derivacion: 'Ficha de derivación',
  };
  const columnas: Column<Documento>[] = [
    {
      key: 'documento',
      header: 'Documento',
      sortable: true,
      sortValue: (fila) => fila.titulo,
      render: (fila) => (
        <span className="student-documents__file">
          <i className="fa-regular fa-file-lines" aria-hidden="true" />
          <span className="student-documents__file-text">
            <strong>{fila.titulo}</strong>
            <small>
              {tipos[fila.tipo]} · {formatFecha(fila.fecha)}
            </small>
          </span>
        </span>
      ),
    },
    { key: 'estado', header: 'Estado', render: (fila) => <StatusBadge estado={fila.estado} /> },
    {
      key: 'detalle',
      header: 'Acciones',
      align: 'right',
      render: (fila) => (
        <span className="student-documents__actions">
          <button
            type="button"
            className="student-documents__text-button"
            aria-label={`Ver detalle: ${fila.titulo}`}
            onClick={() => setAbierto(fila)}
          >
            Ver detalle <i className="fa-solid fa-arrow-right" aria-hidden="true" />
          </button>
          {fila.descargable ? (
            <button
              type="button"
              className="student-documents__text-button"
              aria-label={`Descargar CSV: ${fila.titulo}`}
              onClick={() => descargar(fila)}
            >
              <i className="fa-solid fa-download" aria-hidden="true" /> Descargar CSV
            </button>
          ) : (
            <span className="student-documents__pending">
              {fila.tipo === 'constancia'
                ? 'Descarga pendiente de firma'
                : 'Descarga no disponible'}
            </span>
          )}
        </span>
      ),
    },
  ];

  return (
    <div className="student-documents">
      <PageHeading
        eyebrow="Estudiante · Mi información"
        title="Mis documentos"
        description="Formularios, constancias y fichas de tu tutoría."
        actions={
          <button
            type="button"
            className="student-documents__text-button"
            onClick={() =>
              downloadCsv(
                [
                  ['Documento', 'Tipo', 'Referencia', 'Fecha', 'Estado'],
                  ...documentos.map((documento) => [
                    documento.titulo,
                    documento.tipo,
                    documento.referencia,
                    documento.fecha,
                    documento.estado,
                  ]),
                ],
                `tutoria-unas-documentos-${estudiante.codigo}.csv`,
              )
            }
          >
            <i className="fa-solid fa-download" aria-hidden="true" /> Descargar lista
          </button>
        }
      />
      <Card>
        <CardHead
          title="Mis archivos"
          description={`${documentos.length} ${documentos.length === 1 ? 'archivo' : 'archivos'} · ${descargables.length} con descarga disponible`}
          actions={<Badge>{semestreActual}</Badge>}
        />
        <CardBody>
          <DataTable
            rows={documentos}
            columns={columnas}
            caption="Documentos del estudiante"
            rowKey={(fila) => fila.id}
            emptyTitle="Sin documentos"
            emptyDescription="Cuando tus formularios se aprueben aparecerán aquí."
            pageSize={10}
            pagination="auto"
            compact
          />
        </CardBody>
      </Card>
      <details className="student-documents__help">
        <summary>
          <i className="fa-solid fa-circle-info" aria-hidden="true" /> Acerca de las descargas
        </summary>
        <p>
          Las descargas de demostración contienen los datos del documento en formato CSV. Los
          archivos oficiales en PDF o Word aún no están disponibles.
        </p>
        <p>
          Las constancias requieren la firma del docente tutor o de la autoridad correspondiente.
          Las notas personales y la información de salud no forman parte de este repositorio.
        </p>
      </details>

      {abierto && (
        <Sheet
          title={abierto.titulo}
          description={`${abierto.referencia} · ${formatFecha(abierto.fecha)}`}
          onClose={() => setAbierto(null)}
          footer={
            <>
              <button type="button" className="btn btn-link" onClick={() => setAbierto(null)}>
                Cerrar
              </button>
              {abierto.descargable && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => descargar(abierto)}
                >
                  <i className="fa-solid fa-download" aria-hidden="true" /> Descargar CSV
                </button>
              )}
            </>
          }
        >
          <div className="stack">
            <dl className="def-list">
              <div>
                <dt>Tipo de documento</dt>
                <dd>{tipos[abierto.tipo]}</dd>
              </div>
              <div>
                <dt>Referencia</dt>
                <dd className="mono">{abierto.referencia}</dd>
              </div>
              <div>
                <dt>Fecha</dt>
                <dd>{formatFecha(abierto.fecha)}</dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>
                  <StatusBadge estado={abierto.estado} />
                </dd>
              </div>
              <div>
                <dt>Detalle</dt>
                <dd>{abierto.detalle}</dd>
              </div>
              <div>
                <dt>Periodo</dt>
                <dd>{semestreActual}</dd>
              </div>
            </dl>
            {!abierto.descargable ? (
              <Alert tone="alerta" title="Descarga no disponible">
                {abierto.tipo === 'constancia'
                  ? 'La constancia requiere la firma del docente tutor o de la autoridad correspondiente para habilitar la descarga.'
                  : 'La descarga se habilitará cuando la versión aprobada del documento esté disponible.'}
              </Alert>
            ) : (
              <p className="small muted">
                Descarga de demostración: contiene los datos del documento en formato CSV.
              </p>
            )}
          </div>
        </Sheet>
      )}
    </div>
  );
}
