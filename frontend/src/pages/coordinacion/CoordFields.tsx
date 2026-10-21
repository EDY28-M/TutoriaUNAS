import { useCallback, useId, useMemo, useState } from 'react';
import {
  BookOpen,
  Download,
  FileSpreadsheet,
  Info,
  ScrollText,
  SlidersHorizontal,
  TriangleAlert,
} from '../../components/ui/icons';
import { PageHeading } from '../../components/ui/PageHeading';
import { Card, CardBody, CardFoot, CardHead } from '../../components/ui/Card';
import { Stat } from '../../components/ui/Stat';
import { Alert } from '../../components/ui/Alert';
import { Badge, StatusBadge } from '../../components/ui/StatusBadge';
import { DataTable } from '../../components/ui/DataTable';
import type { Column } from '../../components/ui/DataTable';
import { Tabs, TabPanel } from '../../components/ui/Tabs';
import { PanelFiltros, useFiltro } from '../../components/panels/PanelFiltros';
import type { DefinicionSelect } from '../../components/panels/PanelFiltros';
import type { CampoFormato, DefinicionFormato, ReglaTutoria } from '../../types/domain';
import {
  APROBACION_INSTRUMENTOS,
  VIGENCIA_INSTRUMENTOS,
  definicionesFormato,
} from '../../data/formatos';
import { reglasTutoria } from '../../data/institucional';
import { downloadCsv } from '../../utils/csv';

/** Campo del diccionario con su formato y sección de origen. */
interface CampoDiccionario {
  formato: DefinicionFormato;
  seccion: string;
  campo: CampoFormato;
}

const TIPOS: Array<CampoFormato['tipo']> = [
  'texto',
  'texto-largo',
  'numero',
  'fecha',
  'hora',
  'seleccion',
  'multiple',
  'booleano',
  'tabla',
  'escala',
];

/** Construye el diccionario completo de campos de los doce instrumentos. */
function diccionario(): CampoDiccionario[] {
  return definicionesFormato.flatMap((formato) =>
    formato.secciones.flatMap((seccion) =>
      seccion.campos.map((campo) => ({ formato, seccion: seccion.titulo, campo })),
    ),
  );
}

/**
 * Diccionario institucional de campos y reglas: estructura de cada instrumento
 * (código, etiqueta, tipo, obligatoriedad y opciones) con búsqueda y selector de
 * formato, más la tabla de reglas de tutoría con su estado de validación y
 * fuente, y la exportación del diccionario a CSV.
 */
export function CoordFields() {
  const idFormato = useId();
  const [pestana, setPestana] = useState<'campos' | 'reglas'>('campos');
  const [codigoFormato, setCodigoFormato] = useState(definicionesFormato[0]?.codigo ?? 'F01');

  const todos = useMemo(() => diccionario(), []);
  const formatoElegido = definicionesFormato.find((formato) => formato.codigo === codigoFormato);
  const delFormato = useMemo(
    () => todos.filter((fila) => fila.formato.codigo === codigoFormato),
    [codigoFormato, todos],
  );

  const buscarEn = useCallback(
    (fila: CampoDiccionario) =>
      [
        fila.campo.codigo,
        fila.campo.etiqueta,
        fila.seccion,
        fila.campo.tipo,
        fila.campo.ayuda ?? '',
      ].join(' '),
    [],
  );

  const selects = useMemo<Array<DefinicionSelect<CampoDiccionario>>>(
    () => [
      {
        id: 'tipo',
        etiqueta: 'Tipo de campo',
        opciones: TIPOS.map((tipo) => ({ valor: tipo, etiqueta: tipo })),
        valorDe: (fila) => fila.campo.tipo,
      },
      {
        id: 'obligatorio',
        etiqueta: 'Requisito',
        opciones: [
          { valor: 'obligatorio', etiqueta: 'Obligatorio' },
          { valor: 'opcional', etiqueta: 'Opcional' },
        ],
        valorDe: (fila) => (fila.campo.obligatorio ? 'obligatorio' : 'opcional'),
      },
      {
        id: 'seccion',
        etiqueta: 'Sección',
        opciones: [...new Set(delFormato.map((fila) => fila.seccion))].map((seccion) => ({
          valor: seccion,
          etiqueta: seccion,
        })),
        valorDe: (fila) => fila.seccion,
      },
    ],
    [delFormato],
  );

  const filtro = useFiltro(delFormato, buscarEn, selects);

  const obligatorios = todos.filter((fila) => fila.campo.obligatorio).length;
  const conOpciones = todos.filter((fila) => fila.campo.opciones?.length).length;
  const tablas = todos.filter((fila) => fila.campo.tipo === 'tabla').length;
  const reglasValidadas = reglasTutoria.filter((regla) => regla.estado === 'validada').length;
  const reglasPendientes = reglasTutoria.filter(
    (regla) => regla.estado === 'pendiente-validacion',
  ).length;

  function exportarDiccionario() {
    const filas: string[][] = [
      ['Diccionario de campos · Sistema de Tutoría UNAS'],
      ['Instrumentos', APROBACION_INSTRUMENTOS],
      ['Vigencia', VIGENCIA_INSTRUMENTOS],
      [],
      [
        'Formato',
        'Número',
        'Instrumento',
        'Sección',
        'Código del campo',
        'Etiqueta',
        'Tipo',
        'Obligatorio',
        'Opciones',
        'Ayuda',
      ],
    ];
    for (const fila of todos) {
      filas.push([
        fila.formato.codigo,
        fila.formato.numero,
        fila.formato.nombre,
        fila.seccion,
        fila.campo.codigo,
        fila.campo.etiqueta,
        fila.campo.tipo,
        fila.campo.obligatorio ? 'Sí' : 'No',
        fila.campo.opciones?.join(' | ') ?? '',
        fila.campo.ayuda ?? '',
      ]);
    }
    // Se codifica antes de descargar para comprobar que el diccionario tiene contenido.
    if (filas.length > 3) downloadCsv(filas, 'diccionario-campos-tutoria.csv');
  }

  function exportarReglas() {
    const filas: string[][] = [
      ['Reglas de tutoría · diccionario institucional'],
      [],
      ['Código', 'Identificador', 'Descripción', 'Valor', 'Estado', 'Fuente'],
    ];
    for (const regla of reglasTutoria) {
      filas.push([
        regla.codigo,
        regla.id,
        regla.descripcion,
        regla.valor,
        regla.estado,
        regla.fuente,
      ]);
    }
    downloadCsv(filas, 'reglas-tutoria.csv');
  }

  const columnasCampos: Column<CampoDiccionario>[] = [
    {
      key: 'codigo',
      header: 'Código',
      sortable: true,
      sortValue: (fila) => fila.campo.codigo,
      render: (fila) => <span className="cell-mono">{fila.campo.codigo}</span>,
    },
    {
      key: 'etiqueta',
      header: 'Etiqueta',
      sortable: true,
      sortValue: (fila) => fila.campo.etiqueta,
      render: (fila) => (
        <span className="stack" style={{ gap: 1 }}>
          <strong className="cell-strong">{fila.campo.etiqueta}</strong>
          <span className="cell-note">{fila.seccion}</span>
        </span>
      ),
    },
    {
      key: 'tipo',
      header: 'Tipo de campo',
      sortable: true,
      sortValue: (fila) => fila.campo.tipo,
      render: (fila) => (
        <Badge tone="info" mono>
          {fila.campo.tipo}
        </Badge>
      ),
    },
    {
      key: 'obligatorio',
      header: 'Obligatorio',
      sortable: true,
      sortValue: (fila) => (fila.campo.obligatorio ? 1 : 0),
      render: (fila) => (
        <Badge tone={fila.campo.obligatorio ? 'ok' : 'neutro'}>
          {fila.campo.obligatorio ? 'Sí' : 'No'}
        </Badge>
      ),
    },
    {
      key: 'opciones',
      header: 'Opciones o ayuda',
      render: (fila) => (
        <span className="stack" style={{ gap: 2 }}>
          {fila.campo.opciones?.length ? (
            fila.campo.opciones.map((opcion) => (
              <Badge key={opcion} tone="neutro">
                {opcion}
              </Badge>
            ))
          ) : (
            <span className="cell-note">{fila.campo.ayuda ?? 'Campo abierto sin opciones'}</span>
          )}
        </span>
      ),
    },
  ];

  const columnasReglas: Column<ReglaTutoria>[] = [
    {
      key: 'codigo',
      header: 'Código',
      sortable: true,
      sortValue: (regla) => regla.codigo,
      render: (regla) => <span className="cell-mono">{regla.codigo}</span>,
    },
    {
      key: 'descripcion',
      header: 'Descripción',
      sortable: true,
      sortValue: (regla) => regla.descripcion,
      render: (regla) => (
        <span className="stack" style={{ gap: 1 }}>
          <strong className="cell-strong">{regla.descripcion}</strong>
          <span className="cell-note">{regla.id}</span>
        </span>
      ),
    },
    {
      key: 'valor',
      header: 'Valor registrado',
      render: (regla) => regla.valor,
    },
    {
      key: 'estado',
      header: 'Estado',
      sortable: true,
      sortValue: (regla) => regla.estado,
      render: (regla) => <StatusBadge estado={regla.estado} />,
    },
    {
      key: 'fuente',
      header: 'Fuente',
      render: (regla) => <span className="cell-note">{regla.fuente}</span>,
    },
  ];

  return (
    <>
      <PageHeading
        eyebrow="Gestión institucional · Diccionario de campos y reglas"
        title="Preguntas y reglas"
        description="Consulta las preguntas de cada formulario y las reglas del Reglamento frente a las que aún confirma el área."
        actions={
          <>
            <button type="button" className="btn btn-falcon-default" onClick={exportarReglas}>
              <Download aria-hidden="true" /> Exportar reglas
            </button>
            <button type="button" className="btn btn-primary" onClick={exportarDiccionario}>
              <FileSpreadsheet aria-hidden="true" /> Exportar diccionario
            </button>
          </>
        }
      />

      <div className="grid grid--4">
        <Stat
          label="Campos del diccionario"
          value={todos.length}
          note={`${obligatorios} obligatorios · ${todos.length - obligatorios} opcionales`}
          icon={<SlidersHorizontal aria-hidden="true" />}
        />
        <Stat
          label="Campos con opciones"
          value={conOpciones}
          note="Listas cerradas y escalas de respuesta"
          icon={<BookOpen aria-hidden="true" />}
          tone="info"
        />
        <Stat
          label="Campos de tipo tabla"
          value={tablas}
          note="Relaciones de asistentes, actividades y evaluaciones"
          icon={<FileSpreadsheet aria-hidden="true" />}
          tone="violeta"
        />
        <Stat
          label="Reglas validadas"
          value={`${reglasValidadas}/${reglasTutoria.length}`}
          note={`${reglasPendientes} pendientes de validación`}
          icon={<ScrollText aria-hidden="true" />}
          tone={reglasPendientes ? 'alerta' : 'verde'}
        />
      </div>

      {reglasPendientes > 0 && (
        <Alert tone="alerta" title="Reglas pendientes de confirmación del área">
          <TriangleAlert aria-hidden="true" /> La periodicidad mínima de las sesiones ya está fijada
          por el Reglamento (arts. 17.k y 17.l). Sigue pendiente de validación la matrícula
          condicionada (RG-06): el sistema muestra el valor y su fuente, sin aplicar restricciones
          automáticas.
        </Alert>
      )}

      <Card>
        <CardHead
          title="Configuración de formularios"
          description="Consulta las preguntas y las reglas de cada formulario."
          actions={<Badge tone="info">{definicionesFormato.length} formularios</Badge>}
        />
        <CardBody>
          <div className="stack">
            <Tabs
              etiqueta="Secciones del diccionario"
              activo={pestana}
              onChange={(id) => setPestana(id as typeof pestana)}
              items={[
                { id: 'campos', label: 'Preguntas de cada formulario', count: todos.length },
                { id: 'reglas', label: 'Reglas de tutoría', count: reglasTutoria.length },
              ]}
            />

            <TabPanel id="campos" activo={pestana}>
              <Card flat>
                <CardHead
                  title="Preguntas de cada formulario"
                  description="Elige un formulario para ver sus preguntas y opciones."
                  actions={
                    <div className="field" style={{ width: 300, maxWidth: '100%' }}>
                      <label htmlFor={idFormato}>Formulario</label>
                      <select
                        id={idFormato}
                        className="select"
                        value={codigoFormato}
                        onChange={(evento) =>
                          setCodigoFormato(evento.target.value as DefinicionFormato['codigo'])
                        }
                      >
                        {definicionesFormato.map((formato) => (
                          <option key={formato.codigo} value={formato.codigo}>
                            {formato.codigo} · Formato {formato.numero} · {formato.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                  }
                />
                <CardBody>
                  <div className="stack">
                    <PanelFiltros<CampoDiccionario>
                      busqueda={filtro.busqueda}
                      onBusqueda={filtro.setBusqueda}
                      selects={selects}
                      valores={filtro.valores}
                      onValor={(id, valor) =>
                        filtro.setValores((actuales) => ({ ...actuales, [id]: valor }))
                      }
                      mostrados={filtro.filtrados.length}
                      total={delFormato.length}
                      activos={filtro.activos}
                      onLimpiar={filtro.limpiar}
                      etiqueta="Filtros del diccionario de campos"
                      placeholder="Buscar por código, etiqueta o ayuda…"
                    />
                    <DataTable<CampoDiccionario>
                      rows={filtro.filtrados}
                      columns={columnasCampos}
                      caption={`Campos del formato ${formatoElegido?.numero ?? ''} ${formatoElegido?.nombre ?? ''}`}
                      rowKey={(fila) =>
                        `${fila.formato.codigo}-${fila.seccion}-${fila.campo.codigo}`
                      }
                      pageSize={12}
                      emptyTitle="Sin campos con estos filtros"
                      emptyDescription="Ajusta el tipo de campo, la obligatoriedad o la sección."
                    />
                  </div>
                </CardBody>
                <CardFoot>
                  <span>
                    {formatoElegido
                      ? `${formatoElegido.secciones.length} secciones · ${delFormato.length} campos · responde ${formatoElegido.actorEtiqueta}`
                      : 'Elige un formulario'}
                  </span>
                  <button
                    type="button"
                    className="btn btn-falcon-default btn-sm"
                    onClick={exportarDiccionario}
                  >
                    <Download aria-hidden="true" /> Descargar preguntas y reglas
                  </button>
                </CardFoot>
              </Card>
            </TabPanel>

            <TabPanel id="reglas" activo={pestana}>
              <Card flat>
                <CardHead
                  title="Reglas de tutoría"
                  description="Valor registrado, estado de validación y fuente de cada regla."
                  actions={
                    <button
                      type="button"
                      className="btn btn-falcon-default btn-sm"
                      onClick={exportarReglas}
                    >
                      <Download aria-hidden="true" /> Exportar reglas
                    </button>
                  }
                />
                <CardBody flush>
                  <DataTable<ReglaTutoria>
                    rows={reglasTutoria}
                    columns={columnasReglas}
                    caption="Reglas de tutoría del diccionario institucional"
                    rowKey={(regla) => regla.id}
                    pageSize={10}
                    initialSort={{ key: 'codigo', direction: 'asc' }}
                  />
                </CardBody>
                <CardFoot>
                  <span>
                    <Info aria-hidden="true" /> Las reglas con estado «pendiente de validación» no
                    se aplican como restricción automática.
                  </span>
                </CardFoot>
              </Card>
            </TabPanel>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid--2">
        <Card accent>
          <CardHead
            title="Para qué sirve esta información"
            description="Relación entre los formatos y las preguntas del sistema."
          />
          <CardBody>
            <dl className="def-list">
              <div>
                <dt>Formularios digitales</dt>
                <dd>
                  Cada campo del diccionario genera su control (texto, número, fecha, selección,
                  escala o tabla) y su validación de obligatoriedad.
                </dd>
              </div>
              <div>
                <dt>Formularios y versiones</dt>
                <dd>
                  Un cambio de versión del formato exige actualizar el diccionario y registrar la
                  aprobación correspondiente.
                </dd>
              </div>
              <div>
                <dt>Reportes</dt>
                <dd>
                  Los indicadores de cobertura usan los campos de conteo: asignados, únicos
                  atendidos, atenciones y sesiones.
                </dd>
              </div>
              <div>
                <dt>Exportación</dt>
                <dd>
                  El diccionario se exporta a CSV con formato, sección, código, etiqueta, tipo,
                  obligatoriedad y opciones.
                </dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHead
            title="Decisiones que requieren autorización"
            description="Estas decisiones deben ser confirmadas por el área responsable."
          />
          <CardBody flush>
            <ul className="list">
              {reglasTutoria
                .filter((regla) => regla.estado !== 'validada')
                .map((regla) => (
                  <li className="list__item" key={regla.id}>
                    <span className="list__icon list__icon--warn" aria-hidden="true">
                      <TriangleAlert />
                    </span>
                    <span className="list__body">
                      <strong>{regla.descripcion}</strong>
                      <p>{regla.valor}</p>
                      <span className="list__meta">
                        <span>{regla.fuente}</span>
                      </span>
                    </span>
                    <span className="list__aside">
                      <StatusBadge estado={regla.estado} />
                    </span>
                  </li>
                ))}
            </ul>
          </CardBody>
          <CardFoot>
            <span>El sistema informa el estado de la regla y su fuente normativa.</span>
          </CardFoot>
        </Card>
      </div>
    </>
  );
}
