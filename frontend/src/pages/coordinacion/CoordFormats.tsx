import { useCallback, useMemo, useState } from 'react';
import type { DefinicionSelect } from '../../components/panels/PanelFiltros';
import { PanelFiltros, useFiltro } from '../../components/panels/PanelFiltros';
import { Alert } from '../../components/ui/Alert';
import { Card, CardBody, CardFoot, CardHead } from '../../components/ui/Card';
import type { Column } from '../../components/ui/DataTable';
import { DataTable } from '../../components/ui/DataTable';
import {
  BadgeCheck,
  ClipboardList,
  FileText,
  Info,
  Layers,
  Lock,
  TriangleAlert,
} from '../../components/ui/icons';
import { PageHeading } from '../../components/ui/PageHeading';
import { Sheet } from '../../components/ui/Sheet';
import { Stat } from '../../components/ui/Stat';
import { Badge } from '../../components/ui/StatusBadge';
import { semestreActual } from '../../data/catalogos';
import {
  APROBACION_INSTRUMENTOS,
  VERSION_INSTRUMENTOS,
  VIGENCIA_INSTRUMENTOS,
  definicionesFormato,
} from '../../data/formatos';
import { abreviaturaEscuela } from '../../data/personas';
import { usePortal } from '../../hooks/usePortal';
import type { ActorFormato, DefinicionFormato } from '../../types/domain';

const ACTORES: ActorFormato[] = ['tutor', 'tutorado', 'equipo-tutores', 'coordinacion'];

/** Etiqueta legible del actor que responde el instrumento. */
function etiquetaActor(actor: ActorFormato): string {
  if (actor === 'tutor') return 'Docente tutor';
  if (actor === 'tutorado') return 'Estudiante';
  if (actor === 'equipo-tutores') return 'Equipo de tutores / comisión';
  return 'Coordinación de tutoría';
}

/** Cantidad total de campos definidos en un instrumento. */
function totalCampos(definicion: DefinicionFormato): number {
  return definicion.secciones.reduce((total, seccion) => total + seccion.campos.length, 0);
}

/**
 * Catálogo institucional de los doce instrumentos de la acción tutorial:
 * versión, vigencia, aprobación, actor que responde, momentos de presentación y
 * el detalle de secciones y campos de cada formato (anexos de la Resolución
 * N.º 500-2022-CU-R-UNAS).
 */
export function CoordFormats() {
  const portal = usePortal();
  const instrumentosPorFormato = (codigo: DefinicionFormato['codigo']) =>
    portal.instrumentos.filter((instrumento) => instrumento.formato === codigo);
  const [detalle, setDetalle] = useState<DefinicionFormato | null>(null);

  const versiones = useMemo(
    () =>
      [...new Set(definicionesFormato.map((definicion) => definicion.version))].map((version) => ({
        version,
        formatos: definicionesFormato.filter((definicion) => definicion.version === version).length,
      })),
    [],
  );

  const buscarEn = useCallback(
    (definicion: DefinicionFormato) =>
      [
        definicion.numero,
        definicion.nombre,
        definicion.proposito,
        definicion.actorEtiqueta,
        definicion.momento,
        definicion.periodicidad,
        definicion.destinatario,
        definicion.codigo,
      ].join(' '),
    [],
  );

  const selects = useMemo<Array<DefinicionSelect<DefinicionFormato>>>(
    () => [
      {
        id: 'actor',
        etiqueta: 'Quién lo completa',
        opciones: ACTORES.map((actor) => ({ valor: actor, etiqueta: etiquetaActor(actor) })),
        valorDe: (definicion) => definicion.actor,
      },
      {
        id: 'obligatorio',
        etiqueta: 'Requisito',
        opciones: [
          { valor: 'obligatorio', etiqueta: 'Obligatorio' },
          { valor: 'opcional', etiqueta: 'Opcional' },
        ],
        valorDe: (definicion) => (definicion.obligatorio ? 'obligatorio' : 'opcional'),
      },
      {
        id: 'momento',
        etiqueta: 'Momento',
        opciones: [
          { valor: 'sesion', etiqueta: 'En cada sesión o actividad' },
          { valor: 'inicio', etiqueta: 'Inicio del semestre' },
          { valor: 'cierre', etiqueta: 'Cierre del semestre' },
          { valor: 'caso', etiqueta: 'Cuando el caso lo requiere' },
        ],
        valorDe: (definicion) => {
          const momento = definicion.momento.toLowerCase();
          if (momento.includes('cada')) return 'sesion';
          if (momento.includes('primeras semanas')) return 'inicio';
          if (momento.includes('cierre')) return 'cierre';
          return 'caso';
        },
      },
    ],
    [],
  );

  const filtro = useFiltro(definicionesFormato, buscarEn, selects);

  const obligatorios = definicionesFormato.filter((definicion) => definicion.obligatorio).length;
  const camposTotales = definicionesFormato.reduce(
    (total, definicion) => total + totalCampos(definicion),
    0,
  );
  const conRegistro = definicionesFormato.filter(
    (definicion) => instrumentosPorFormato(definicion.codigo).length > 0,
  ).length;

  const columnas: Column<DefinicionFormato>[] = [
    {
      key: 'numero',
      header: 'N.º',
      sortable: true,
      sortValue: (definicion) => definicion.numero,
      render: (definicion) => <span className="cell-mono">{definicion.numero}</span>,
    },
    {
      key: 'nombre',
      header: 'Formulario',
      sortable: true,
      sortValue: (definicion) => definicion.nombre,
      render: (definicion) => (
        <span className="stack" style={{ gap: 1 }}>
          <strong className="cell-strong">{definicion.nombre}</strong>
          <span className="cell-note">{definicion.proposito}</span>
        </span>
      ),
    },
    {
      key: 'actor',
      header: 'Quién lo completa',
      sortable: true,
      sortValue: (definicion) => definicion.actorEtiqueta,
      render: (definicion) => (
        <span className="stack" style={{ gap: 1 }}>
          <span>{definicion.actorEtiqueta}</span>
          <span className="cell-note">{etiquetaActor(definicion.actor)}</span>
        </span>
      ),
    },
    {
      key: 'momento',
      header: 'Momento',
      sortable: true,
      sortValue: (definicion) => definicion.momento,
      render: (definicion) => <span className="cell-note">{definicion.momento}</span>,
    },
    {
      key: 'periodicidad',
      header: 'Periodicidad',
      sortable: true,
      sortValue: (definicion) => definicion.periodicidad,
      render: (definicion) => <span className="cell-note">{definicion.periodicidad}</span>,
    },
    {
      key: 'destinatario',
      header: 'Destinatario',
      sortable: true,
      sortValue: (definicion) => definicion.destinatario,
      render: (definicion) => <span className="cell-note">{definicion.destinatario}</span>,
    },
    {
      key: 'obligatorio',
      header: 'Requisito',
      sortable: true,
      sortValue: (definicion) => (definicion.obligatorio ? 1 : 0),
      render: (definicion) => (
        <Badge tone={definicion.obligatorio ? 'ok' : 'neutro'}>
          {definicion.obligatorio ? 'Obligatorio' : 'Opcional'}
        </Badge>
      ),
    },
    {
      key: 'estructura',
      header: 'Estructura',
      sortable: true,
      sortValue: (definicion) => totalCampos(definicion),
      render: (definicion) => (
        <span className="stack" style={{ gap: 1 }}>
          <span className="num">{definicion.secciones.length} secciones</span>
          <span className="cell-note">{totalCampos(definicion)} campos</span>
        </span>
      ),
    },
    {
      key: 'registros',
      header: 'Registros del semestre',
      sortable: true,
      sortValue: (definicion) => instrumentosPorFormato(definicion.codigo).length,
      render: (definicion) => {
        const total = instrumentosPorFormato(definicion.codigo).length;
        return total ? (
          <Badge tone="info">{total} registro(s)</Badge>
        ) : (
          <Badge tone="neutro">Sin registros</Badge>
        );
      },
    },
    {
      key: 'vigencia',
      header: 'Versión y vigencia',
      render: (definicion) => (
        <span className="stack" style={{ gap: 1 }}>
          <span className="cell-note">{definicion.version}</span>
          <Badge tone="alerta">{definicion.vigencia}</Badge>
        </span>
      ),
    },
    {
      key: 'acciones',
      header: 'Detalle',
      render: (definicion) => (
        <span className="cell-actions">
          <button
            type="button"
            className="btn btn-falcon-default btn-sm"
            aria-label={`Ver secciones y campos del formato ${definicion.numero} ${definicion.nombre}`}
            onClick={() => setDetalle(definicion)}
          >
            Ver formato
          </button>
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeading
        eyebrow={`Gestión institucional · Formularios y versiones · Semestre ${semestreActual}`}
        title="Formularios de tutoría"
        description="Consulta los 12 formularios: para qué sirven, quién los completa y cuándo se entregan."
        actions={
          <>
            <Badge tone="info">{definicionesFormato.length} formularios</Badge>
            <Badge tone="alerta">Periodo de uso por confirmar</Badge>
          </>
        }
      />

      <Alert tone="alerta" title="Reglas y fechas por confirmar">
        <TriangleAlert aria-hidden="true" /> La vigencia de los formatos, la obligatoriedad por
        actor y las reglas de llenado <strong>deben ser confirmadas</strong> por Tutoría y
        Capacitación Docente antes de la configuración definitiva. El sistema muestra la información
        recibida y no inventa reglas: mientras no exista confirmación, los formularios se conservan
        con el estado «por confirmar».
      </Alert>

      <div className="grid grid--4">
        <Stat
          label="Formularios oficiales"
          value={definicionesFormato.length}
          note={`${obligatorios} obligatorios · ${definicionesFormato.length - obligatorios} opcionales`}
          icon={<Layers aria-hidden="true" />}
        />
        <Stat
          label="Campos definidos"
          value={camposTotales}
          note="Diccionario de campos y reglas del sistema"
          icon={<ClipboardList aria-hidden="true" />}
          tone="info"
        />
        <Stat
          label="Con registros del semestre"
          value={conRegistro}
          note="Formatos con datos cargados en la demostración"
          icon={<FileText aria-hidden="true" />}
          tone="violeta"
        />
        <Stat
          label="Versiones registradas"
          value={versiones.length}
          note={VERSION_INSTRUMENTOS}
          icon={<BadgeCheck aria-hidden="true" />}
          tone="dorado"
        />
      </div>

      <Card>
        <CardHead
          title="Lista de formularios"
          description="Busca por responsable, fecha de entrega o requisito."
          actions={<Badge tone="info">{APROBACION_INSTRUMENTOS}</Badge>}
        />
        <CardBody>
          <div className="stack">
            <PanelFiltros<DefinicionFormato>
              busqueda={filtro.busqueda}
              onBusqueda={filtro.setBusqueda}
              selects={selects}
              valores={filtro.valores}
              onValor={(id, valor) =>
                filtro.setValores((actuales) => ({ ...actuales, [id]: valor }))
              }
              mostrados={filtro.filtrados.length}
              total={definicionesFormato.length}
              activos={filtro.activos}
              onLimpiar={filtro.limpiar}
              etiqueta="Filtros del catálogo de formularios"
              placeholder="Buscar por número, nombre o propósito…"
            />
            <DataTable<DefinicionFormato>
              rows={filtro.filtrados}
              columns={columnas}
              caption="Catálogo de los doce formularios de la tutoría"
              rowKey={(definicion) => definicion.codigo}
              pageSize={12}
              initialSort={{ key: 'numero', direction: 'asc' }}
              emptyTitle="Sin formularios con estos filtros"
              emptyDescription="Ajusta el actor, la obligatoriedad o el momento seleccionado."
            />
          </div>
        </CardBody>
        <CardFoot>
          <span>{VIGENCIA_INSTRUMENTOS}</span>
          <span className="ui-row ui-row--tight">
            <Lock aria-hidden="true" /> La configuración de versiones la administra Tutoría y
            Capacitación Docente.
          </span>
        </CardFoot>
      </Card>

      <div className="grid grid--sidebar">
        <Card>
          <CardHead
            title="Detalle de cada formulario"
            description="Quién lo completa y quién debe firmarlo."
          />
          <CardBody flush>
            <ul className="list">
              {definicionesFormato.map((definicion) => (
                <li className="list__item" key={definicion.codigo}>
                  <span className="list__icon list__icon--gold" aria-hidden="true">
                    <FileText />
                  </span>
                  <span className="list__body">
                    <strong>
                      Formato {definicion.numero} · {definicion.nombre}
                    </strong>
                    <p>{definicion.proposito}</p>
                    <span className="list__meta">
                      <span>{definicion.actorEtiqueta}</span>
                      <span>{definicion.periodicidad}</span>
                      <span>{definicion.destinatario}</span>
                      <span>
                        {definicion.secciones.length} secciones · {totalCampos(definicion)} campos
                      </span>
                    </span>
                    <span className="list__meta">
                      <span>Visan: {definicion.visaciones.join(' · ')}</span>
                    </span>
                  </span>
                  <span className="list__aside">
                    <button
                      type="button"
                      className="btn btn-falcon-default btn-sm"
                      onClick={() => setDetalle(definicion)}
                    >
                      Ver secciones
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <div className="stack">
          <Card accent>
            <CardHead
              title="Versiones y aprobación"
              description="Historial de versiones y cambios."
            />
            <CardBody>
              <dl className="def-list">
                <div>
                  <dt>Versión vigente</dt>
                  <dd>{VERSION_INSTRUMENTOS}</dd>
                </div>
                <div>
                  <dt>Documento de aprobación</dt>
                  <dd>{APROBACION_INSTRUMENTOS}</dd>
                </div>
                <div>
                  <dt>Vigencia</dt>
                  <dd>{VIGENCIA_INSTRUMENTOS}</dd>
                </div>
                <div>
                  <dt>Formatos registrados</dt>
                  <dd>{definicionesFormato.length} formularios con estructura cargada</dd>
                </div>
                <div>
                  <dt>Corresponde a de la configuración</dt>
                  <dd>
                    Tutoría y Capacitación Docente · Vicerrectorado Académico (
                    {abreviaturaEscuela(portal.escuelaId)} como escuela de referencia)
                  </dd>
                </div>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHead
              title="Quién completa cada formulario"
              description="Responsables de responder cada formato"
            />
            <CardBody flush>
              <ul className="list">
                {ACTORES.map((actor) => (
                  <li className="list__item" key={actor}>
                    <span className="list__body">
                      <strong>{etiquetaActor(actor)}</strong>
                      <p>
                        {definicionesFormato
                          .filter((definicion) => definicion.actor === actor)
                          .map((definicion) => `F${definicion.numero}`)
                          .join(' · ') || 'Sin formularios asignados'}
                      </p>
                    </span>
                    <span className="list__aside num">
                      {
                        definicionesFormato.filter((definicion) => definicion.actor === actor)
                          .length
                      }
                    </span>
                  </li>
                ))}
              </ul>
            </CardBody>
            <CardFoot>
              <span>
                <Info aria-hidden="true" /> Los actores se usan para asignar permisos y notificar
                pendientes.
              </span>
            </CardFoot>
          </Card>
        </div>
      </div>

      {detalle && (
        <Sheet
          wide
          title={`Formato ${detalle.numero} · ${detalle.nombre}`}
          description={`${detalle.actorEtiqueta} · ${detalle.destinatario}`}
          onClose={() => setDetalle(null)}
          footer={
            <button
              type="button"
              className="btn btn-falcon-default"
              onClick={() => setDetalle(null)}
            >
              Cerrar formato
            </button>
          }
        >
          <div className="stack stack--lg">
            <Alert tone="alerta" title="Periodo de uso por confirmar">
              {detalle.vigencia}. Las reglas de llenado por campo y la obligatoriedad definitiva se
              encuentran en revisión por Tutoría y Capacitación Docente.
            </Alert>

            <dl className="def-list">
              <div>
                <dt>Código interno</dt>
                <dd className="mono">{detalle.codigo}</dd>
              </div>
              <div>
                <dt>Propósito</dt>
                <dd>{detalle.proposito}</dd>
              </div>
              <div>
                <dt>Quién lo completa</dt>
                <dd>{detalle.actorEtiqueta}</dd>
              </div>
              <div>
                <dt>Momento de presentación</dt>
                <dd>{detalle.momento}</dd>
              </div>
              <div>
                <dt>Periodicidad</dt>
                <dd>{detalle.periodicidad}</dd>
              </div>
              <div>
                <dt>Destinatario</dt>
                <dd>{detalle.destinatario}</dd>
              </div>
              <div>
                <dt>Requisito</dt>
                <dd>{detalle.obligatorio ? 'Obligatorio' : 'Opcional'}</dd>
              </div>
              <div>
                <dt>Versión</dt>
                <dd>{detalle.version}</dd>
              </div>
              <div>
                <dt>Vigencia</dt>
                <dd>{detalle.vigencia}</dd>
              </div>
              <div>
                <dt>Aprobación</dt>
                <dd>{detalle.aprobacion}</dd>
              </div>
              <div>
                <dt>Firmas de aprobación</dt>
                <dd>{detalle.visaciones.join(' · ')}</dd>
              </div>
              <div>
                <dt>Registros del semestre</dt>
                <dd>{instrumentosPorFormato(detalle.codigo).length} formulario(s) cargados</dd>
              </div>
            </dl>

            <div>
              <div className="section-head">
                <h2>Secciones y campos</h2>
                <p>
                  {detalle.secciones.length} secciones · {totalCampos(detalle)} campos
                </p>
              </div>
              <div className="stack">
                {detalle.secciones.map((seccion, indice) => (
                  <Card key={`${detalle.codigo}-${seccion.titulo}`} flat>
                    <CardHead
                      title={`${indice + 1}. ${seccion.titulo}`}
                      description={`${seccion.campos.length} campos`}
                    />
                    <CardBody>
                      <div className="table-wrap">
                        <table className="data-table data-table--compact">
                          <caption className="sr-only">
                            Campos de la sección {seccion.titulo} del formato {detalle.numero}
                          </caption>
                          <thead>
                            <tr>
                              <th scope="col">Código</th>
                              <th scope="col">Etiqueta</th>
                              <th scope="col">Tipo</th>
                              <th scope="col">Obligatorio</th>
                              <th scope="col">Opciones o ayuda</th>
                            </tr>
                          </thead>
                          <tbody>
                            {seccion.campos.map((campo) => (
                              <tr key={campo.codigo}>
                                <td className="cell-mono">{campo.codigo}</td>
                                <td className="cell-strong">{campo.etiqueta}</td>
                                <td>{campo.tipo}</td>
                                <td>{campo.obligatorio ? 'Sí' : 'No'}</td>
                                <td className="cell-note">
                                  {campo.opciones?.length
                                    ? campo.opciones.join(' / ')
                                    : (campo.ayuda ?? '—')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </div>

            <Alert tone="info" title="Uso de esta estructura">
              La estructura de secciones y campos alimenta el diccionario institucional, los
              formularios digitales y los reportes. Cualquier cambio de versión debe ser aprobado y
              registrado antes de publicarse.
            </Alert>
          </div>
        </Sheet>
      )}
    </>
  );
}
