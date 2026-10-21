import type { FormEvent } from 'react';
import { useId, useMemo, useState } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Card, CardBody, CardFoot, CardHead } from '../../components/ui/Card';
import type { Column } from '../../components/ui/DataTable';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  Bell,
  Check,
  Mail,
  MailCheck,
  MailPlus,
  Send,
  TriangleAlert,
} from '../../components/ui/icons';
import { PageHeading } from '../../components/ui/PageHeading';
import { Sheet } from '../../components/ui/Sheet';
import { Stat } from '../../components/ui/Stat';
import { Badge, StatusBadge } from '../../components/ui/StatusBadge';
import { TabPanel, Tabs } from '../../components/ui/Tabs';
import { semestreActual } from '../../data/catalogos';
import { derivaciones, estadosDerivacionAbiertos } from '../../data/derivaciones';
import { avisos, notificaciones } from '../../data/institucional';
import { abreviaturaEscuela, docentes, estudiantes } from '../../data/personas';
import { usePortal } from '../../hooks/usePortal';
import type { Aviso } from '../../types/domain';
import { HOY_ISO, formatFechaHora } from '../../utils/fechas';

/** Plantilla de correo institucional disponible en la demostración. */
interface PlantillaCorreo {
  id: string;
  nombre: string;
  descripcion: string;
  variables: string[];
  uso: string;
}

/** Regla de envío pendiente de habilitación por la OTIC. */
interface ReglaEnvio {
  descripcion: string;
  estado: 'pendiente' | 'propuesta' | 'validada';
  fuente: string;
}

const PLANTILLAS: PlantillaCorreo[] = [
  {
    id: 'recordatorio-sesion',
    nombre: 'Recordatorio de sesión',
    descripcion:
      'Confirma al estudiante la fecha, la hora y el lugar de su próxima sesión de tutoría.',
    variables: ['{{nombre_estudiante}}', '{{fecha}}', '{{hora}}', '{{docente_tutor}}', '{{lugar}}'],
    uso: 'Se envía 24 horas antes de cada sesión programada.',
  },
  {
    id: 'instrumento-pendiente',
    nombre: 'Instrumento pendiente',
    descripcion: 'Informa al estudiante o al tutor que un formato sigue pendiente de llenado.',
    variables: ['{{nombre}}', '{{formato}}', '{{fecha_limite}}'],
    uso: 'Se envía al detectar formatos en borrador o no iniciados.',
  },
  {
    id: 'instrumento-observado',
    nombre: 'Instrumento observado',
    descripcion:
      'Comunica la observación registrada por la coordinación y el plazo de subsanación.',
    variables: ['{{nombre}}', '{{formato}}', '{{observacion}}', '{{fecha_limite}}'],
    uso: 'Se envía al registrar una observación en la revisión.',
  },
  {
    id: 'derivacion-registrada',
    nombre: 'Derivación registrada',
    descripcion:
      'Confirma al estudiante que su ficha de derivación fue remitida al área correspondiente.',
    variables: ['{{nombre_estudiante}}', '{{area}}', '{{codigo_derivacion}}'],
    uso: 'Se envía cuando el tutor registra el formato 12.',
  },
  {
    id: 'recordatorio-cita',
    nombre: 'Recordatorio de cita',
    descripcion: 'Recuerda la cita programada por el área de apoyo (sin contenido clínico).',
    variables: ['{{nombre_estudiante}}', '{{area}}', '{{fecha}}', '{{hora}}'],
    uso: 'Se envía cuando el área confirma fecha y hora de atención.',
  },
  {
    id: 'cierre-informe-tutor',
    nombre: 'Cierre del informe del tutor',
    descripcion: 'Comunica la habilitación del formato 02 y la fecha límite de presentación.',
    variables: ['{{nombre_tutor}}', '{{semestre}}', '{{fecha_limite}}'],
    uso: 'Se envía al inicio del periodo de cierre del semestre.',
  },
  {
    id: 'resumen-semanal',
    nombre: 'Resumen semanal de tutoría',
    descripcion:
      'Remite a la coordinación el consolidado de cobertura, sesiones e formularios pendientes.',
    variables: ['{{semestre}}', '{{escuela}}', '{{cobertura}}', '{{sesiones}}'],
    uso: 'Se envía los viernes a la coordinación de tutoría.',
  },
];

const REGLAS_ENVIO: ReglaEnvio[] = [
  {
    descripcion:
      'Remitente institucional único (tutoria@unas.edu.pe) con copia a la coordinación de la escuela.',
    estado: 'propuesta',
    fuente: 'Solicitud 05_OTIC, pendiente de configuración del dominio.',
  },
  {
    descripcion: 'Límite de envío por lote para no saturar la cuenta institucional.',
    estado: 'pendiente',
    fuente: 'Por definir con la OTIC y el área de Tutoría.',
  },
  {
    descripcion:
      'Prohibido incluir diagnósticos, resultados clínicos o detalles de atención en los correos.',
    estado: 'validada',
    fuente: 'Permisos para compartir información · Ley N.º 29733.',
  },
  {
    descripcion:
      'Registro obligatorio del aviso enviado (autor, fecha, plantilla y destinatarios) en la auditoría.',
    estado: 'validada',
    fuente: 'Guardar el historial de cada envío.',
  },
  {
    descripcion:
      'Reintento automático y notificación de fallos cuando el servidor de correo no esté disponible.',
    estado: 'pendiente',
    fuente: 'Solicitud 05_OTIC, a la espera del servidor y del respaldo.',
  },
];

/** Grupo de destinatarios predefinido para el aviso. */
interface GrupoDestinatarios {
  id: string;
  etiqueta: string;
  descripcion: string;
  correos: string[];
}

/**
 * Avisos y correos institucionales: bandeja de avisos enviados o programados,
 * plantillas disponibles, reglas de envío pendientes de la OTIC, notificaciones
 * del sistema y redacción de un nuevo aviso con sus destinatarios.
 */
export function CoordNotices() {
  const portal = usePortal();
  const idFormulario = useId();

  const [bandeja, setBandeja] = useState<Aviso[]>(() => avisos.map((aviso) => ({ ...aviso })));
  const [pestana, setPestana] = useState<
    'todos' | 'enviado' | 'programado' | 'borrador' | 'fallido'
  >('todos');
  const [redactando, setRedactando] = useState(false);
  const [avisoConfirmado, setAvisoConfirmado] = useState<string | null>(null);

  const [grupo, setGrupo] = useState('');
  const [plantilla, setPlantilla] = useState('');
  const [asunto, setAsunto] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [canal, setCanal] = useState<Aviso['canal']>('correo');
  const [enviarAhora, setEnviarAhora] = useState(true);

  const grupos = useMemo<GrupoDestinatarios[]>(() => {
    const deLaEscuela = estudiantes.filter(
      (estudiante) => estudiante.escuelaId === portal.escuelaId,
    );
    return [
      {
        id: 'tutorados-escuela',
        etiqueta: `Estudiantes de ${abreviaturaEscuela(portal.escuelaId)}`,
        descripcion: 'Todos los estudiantes del registro de la escuela.',
        correos: deLaEscuela.map((estudiante) => estudiante.correo),
      },
      {
        id: 'tutores-escuela',
        etiqueta: `Docentes tutores de ${abreviaturaEscuela(portal.escuelaId)}`,
        descripcion: 'Docentes con estudiantes asignados en la escuela.',
        correos: docentes
          .filter((docente) => docente.escuelaId === portal.escuelaId && docente.activo)
          .map((docente) => docente.correo),
      },
      {
        id: 'en-riesgo',
        etiqueta: 'Estudiantes con alerta de prioridad alta',
        descripcion: 'Estudiantes con señales activas que requieren acompañamiento.',
        correos: deLaEscuela
          .filter((estudiante) => estudiante.alertas.some((alerta) => alerta.nivel === 'alta'))
          .map((estudiante) => estudiante.correo),
      },
      {
        id: 'derivaciones-abiertas',
        etiqueta: 'Estudiantes con solicitud de apoyo abierta',
        descripcion: 'Casos en seguimiento por un área de apoyo.',
        correos: deLaEscuela
          .filter((estudiante) =>
            derivaciones.some(
              (derivacion) =>
                derivacion.estudianteId === estudiante.id &&
                estadosDerivacionAbiertos.includes(derivacion.estado),
            ),
          )
          .map((estudiante) => estudiante.correo),
      },
      {
        id: 'todos-tutores',
        etiqueta: 'Todos los docentes tutores de la universidad',
        descripcion: 'Registro docente activo completo.',
        correos: docentes.filter((docente) => docente.activo).map((docente) => docente.correo),
      },
    ];
  }, [portal.escuelaId]);

  const grupoElegido = grupos.find((item) => item.id === grupo);
  const plantillaElegida = PLANTILLAS.find((item) => item.id === plantilla);
  const puedeEnviar = Boolean(grupo && asunto.trim() && cuerpo.trim());

  const conteo = (estado: Aviso['estado']) =>
    bandeja.filter((aviso) => aviso.estado === estado).length;
  const visibles =
    pestana === 'todos' ? bandeja : bandeja.filter((aviso) => aviso.estado === pestana);
  const programados = bandeja.filter((aviso) => aviso.estado === 'programado');
  const fallidos = bandeja.filter((aviso) => aviso.estado === 'fallido');
  const sinLeer = notificaciones.filter((notificacion) => !notificacion.leida).length;
  const destinatariosTotales = bandeja.reduce(
    (total, aviso) => total + aviso.destinatarios.length,
    0,
  );

  function abrirRedaccion() {
    setRedactando(true);
    setAvisoConfirmado(null);
    setGrupo('');
    setPlantilla('');
    setAsunto('');
    setCuerpo('');
    setCanal('correo');
    setEnviarAhora(true);
  }

  function usarPlantilla(id: string) {
    const elegida = PLANTILLAS.find((item) => item.id === id);
    setPlantilla(id);
    if (!elegida) return;
    setAsunto(elegida.nombre);
    setCuerpo(
      `${elegida.descripcion}\n\nComuníquese con la coordinación de tutoría si requiere orientación adicional.\n\n${elegida.variables.join(' · ')}`,
    );
  }

  function registrarAviso(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!grupoElegido || !puedeEnviar) return;
    const nuevo: Aviso = {
      id: `AV-${String(bandeja.length + 1).padStart(3, '0')}`,
      asunto: asunto.trim(),
      cuerpo: cuerpo.trim(),
      destinatarios: grupoElegido.correos,
      canal,
      enviado: enviarAhora ? `${HOY_ISO}T08:00:00` : `${HOY_ISO}T18:00:00`,
      estado: enviarAhora ? 'enviado' : 'programado',
      plantilla: plantilla || 'redaccion-libre',
      relacionadoCon: null,
    };
    setBandeja((actuales) => [nuevo, ...actuales]);
    setAvisoConfirmado(
      `Aviso «${nuevo.asunto}» ${enviarAhora ? 'enviado' : 'programado'} a ${nuevo.destinatarios.length} destinatario(s) del grupo «${grupoElegido.etiqueta}».`,
    );
    setRedactando(false);
  }

  const columnas: Column<Aviso>[] = [
    {
      key: 'asunto',
      header: 'Asunto',
      sortable: true,
      sortValue: (aviso) => aviso.asunto,
      render: (aviso) => (
        <span className="stack" style={{ gap: 1 }}>
          <strong className="cell-strong">{aviso.asunto}</strong>
          <span className="cell-note">{aviso.cuerpo.slice(0, 110)}…</span>
        </span>
      ),
    },
    {
      key: 'destinatarios',
      header: 'Destinatarios',
      sortable: true,
      sortValue: (aviso) => aviso.destinatarios.length,
      render: (aviso) => (
        <span className="stack" style={{ gap: 1 }}>
          <span className="num">{aviso.destinatarios.length} correos</span>
          <span className="cell-note">{aviso.destinatarios[0]}</span>
        </span>
      ),
    },
    {
      key: 'plantilla',
      header: 'Plantilla',
      sortable: true,
      sortValue: (aviso) => aviso.plantilla,
      render: (aviso) => {
        const encontrada = PLANTILLAS.find((item) => item.id === aviso.plantilla);
        return (
          <span className="stack" style={{ gap: 1 }}>
            <Badge tone="info" mono>
              {aviso.plantilla}
            </Badge>
            <span className="cell-note">{encontrada?.nombre ?? 'Redacción libre'}</span>
          </span>
        );
      },
    },
    {
      key: 'canal',
      header: 'Canal',
      sortable: true,
      sortValue: (aviso) => aviso.canal,
      render: (aviso) => (
        <Badge tone={aviso.canal === 'correo' ? 'info' : 'neutro'}>
          {aviso.canal === 'correo' ? 'Correo institucional' : 'Notificación en el sistema'}
        </Badge>
      ),
    },
    {
      key: 'fecha',
      header: 'Fecha',
      sortable: true,
      sortValue: (aviso) => aviso.enviado,
      render: (aviso) => <span className="nowrap cell-mono">{formatFechaHora(aviso.enviado)}</span>,
    },
    {
      key: 'estado',
      header: 'Estado',
      sortable: true,
      sortValue: (aviso) => aviso.estado,
      render: (aviso) => <StatusBadge estado={aviso.estado} />,
    },
    {
      key: 'relacionado',
      header: 'Relacionado con',
      render: (aviso) =>
        aviso.relacionadoCon ? (
          <span className="cell-mono">{aviso.relacionadoCon}</span>
        ) : (
          <span className="muted small">Comunicación general</span>
        ),
    },
  ];

  return (
    <>
      <PageHeading
        eyebrow={`Coordinación de tutoría · Avisos y correos · Semestre ${semestreActual}`}
        title="Avisos"
        description="Revisa los mensajes enviados y prepara nuevos avisos para estudiantes y tutores."
        actions={
          <>
            <Badge tone={sinLeer ? 'alerta' : 'ok'}>{sinLeer} notificaciones sin leer</Badge>
            <button type="button" className="btn btn-primary" onClick={abrirRedaccion}>
              <MailPlus aria-hidden="true" /> Redactar aviso
            </button>
          </>
        }
      />

      {avisoConfirmado && (
        <Alert tone="ok" title="Aviso guardado en esta prueba">
          {avisoConfirmado} El envío real se habilitará cuando la OTIC configure el servidor de
          correo institucional.
        </Alert>
      )}

      {fallidos.length > 0 && (
        <Alert tone="riesgo" title={`${fallidos.length} aviso(s) con error de envío`}>
          Revisa las direcciones y vuelva a programar el envío. El sistema dejará constancia del
          reintento en la auditoría.
        </Alert>
      )}

      <div className="grid grid--4">
        <Stat
          label="Avisos registrados"
          value={bandeja.length}
          note={`${destinatariosTotales} correos acumulados`}
          icon={<Mail aria-hidden="true" />}
        />
        <Stat
          label="Enviados"
          value={conteo('enviado')}
          note="Confirmados por el servicio de correo"
          icon={<MailCheck aria-hidden="true" />}
          tone="verde"
        />
        <Stat
          label="Programados"
          value={programados.length}
          note="Pendientes de la hora de envío"
          icon={<Send aria-hidden="true" />}
          tone="info"
        />
        <Stat
          label="Notificaciones del sistema"
          value={notificaciones.length}
          note={`${sinLeer} sin leer en el panel`}
          icon={<Bell aria-hidden="true" />}
          tone="violeta"
        />
      </div>

      <Card>
        <CardHead
          title="Bandeja de avisos"
          description="Historial de correos y notificaciones generados por el sistema tutorial."
          actions={<Badge tone="dorado">{semestreActual}</Badge>}
        />
        <CardBody>
          <div className="stack">
            <Tabs
              etiqueta="Estado de los avisos"
              activo={pestana}
              onChange={(id) => setPestana(id as typeof pestana)}
              items={[
                { id: 'todos', label: 'Todos', count: bandeja.length },
                { id: 'enviado', label: 'Enviados', count: conteo('enviado') },
                { id: 'programado', label: 'Programados', count: conteo('programado') },
                { id: 'borrador', label: 'Borradores', count: conteo('borrador') },
                { id: 'fallido', label: 'Fallidos', count: conteo('fallido') },
              ]}
            />
            {(['todos', 'enviado', 'programado', 'borrador', 'fallido'] as const).map((id) => (
              <TabPanel key={id} id={id} activo={pestana}>
                <DataTable<Aviso>
                  rows={visibles}
                  columns={columnas}
                  caption={`Avisos institucionales en estado ${id}`}
                  rowKey={(aviso) => aviso.id}
                  pageSize={8}
                  emptyTitle="Sin avisos en esta pestaña"
                  emptyDescription="Redacte un aviso nuevo o cambie de pestaña para ver otros estados."
                />
              </TabPanel>
            ))}
          </div>
        </CardBody>
        <CardFoot>
          <span>
            Los correos usan las cuentas institucionales ficticias de la demostración; no se envían
            mensajes reales.
          </span>
          <button type="button" className="btn btn-falcon-default btn-sm" onClick={abrirRedaccion}>
            <MailPlus aria-hidden="true" /> Redactar aviso
          </button>
        </CardFoot>
      </Card>

      <div className="grid grid--sidebar">
        <Card>
          <CardHead
            title="Plantillas de correo disponibles"
            description="Mensajes aprobados para la comunicación del proceso de tutoría"
            actions={<Badge tone="info">{PLANTILLAS.length} plantillas</Badge>}
          />
          <CardBody flush>
            <ul className="list">
              {PLANTILLAS.map((item) => (
                <li className="list__item" key={item.id}>
                  <span className="list__icon list__icon--gold" aria-hidden="true">
                    <Mail />
                  </span>
                  <span className="list__body">
                    <strong>{item.nombre}</strong>
                    <p>{item.descripcion}</p>
                    <span className="list__meta">
                      <span className="mono">{item.id}</span>
                      <span>{item.uso}</span>
                    </span>
                    <span className="list__meta">
                      {item.variables.map((variable) => (
                        <Badge key={variable} mono tone="neutro">
                          {variable}
                        </Badge>
                      ))}
                    </span>
                  </span>
                  <span className="list__aside">
                    <button
                      type="button"
                      className="btn btn-falcon-default btn-sm"
                      onClick={() => {
                        abrirRedaccion();
                        usarPlantilla(item.id);
                      }}
                    >
                      Usar plantilla
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
          <CardFoot>
            <span>
              Las variables se completan con los datos del estudiante y del docente tutor al momento
              del envío.
            </span>
          </CardFoot>
        </Card>

        <div className="stack">
          <Card accent>
            <CardHead
              title="Reglas de envío pendientes de la OTIC"
              description="Condiciones que deben habilitarse para el envío real"
            />
            <CardBody flush>
              <ul className="list">
                {REGLAS_ENVIO.map((regla) => (
                  <li className="list__item" key={regla.descripcion}>
                    <span className="list__body">
                      <strong>{regla.descripcion}</strong>
                      <p>{regla.fuente}</p>
                    </span>
                    <span className="list__aside">
                      <StatusBadge estado={regla.estado} />
                    </span>
                  </li>
                ))}
              </ul>
            </CardBody>
            <CardFoot>
              <span>
                <TriangleAlert aria-hidden="true" /> Sin el servidor de correo habilitado, los
                avisos quedan en estado de demostración.
              </span>
            </CardFoot>
          </Card>

          <Card>
            <CardHead
              title="Notificaciones del sistema"
              description="Mensajes mostrados en el panel del usuario"
              actions={<Badge tone={sinLeer ? 'alerta' : 'ok'}>{sinLeer} sin leer</Badge>}
            />
            <CardBody flush>
              {notificaciones.length === 0 ? (
                <EmptyState
                  title="Sin notificaciones"
                  description="No hay mensajes del sistema en este momento."
                  icon={<Bell />}
                />
              ) : (
                <ul className="list">
                  {notificaciones.map((notificacion) => (
                    <li className="list__item" key={notificacion.id}>
                      <span
                        className={`list__icon list__icon--${notificacion.leida ? 'ok' : 'info'}`}
                        aria-hidden="true"
                      >
                        {notificacion.leida ? <Check /> : <Bell />}
                      </span>
                      <span className="list__body">
                        <strong>{notificacion.titulo}</strong>
                        <p>{notificacion.detalle}</p>
                        <span className="list__meta">
                          <span>{formatFechaHora(notificacion.fecha)}</span>
                          <span>{notificacion.tipo}</span>
                          {notificacion.enlace && (
                            <span className="mono">{notificacion.enlace}</span>
                          )}
                        </span>
                      </span>
                      <span className="list__aside">
                        <Badge tone={notificacion.leida ? 'neutro' : 'info'}>
                          {notificacion.leida ? 'Leída' : 'Sin leer'}
                        </Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {redactando && (
        <Sheet
          wide
          title="Redactar aviso institucional"
          description={`Comunicación del proceso de tutoría · ${abreviaturaEscuela(portal.escuelaId)}`}
          onClose={() => setRedactando(false)}
          footer={
            <>
              <button type="button" className="btn btn-link" onClick={() => setRedactando(false)}>
                Cancelar
              </button>
              <button
                type="submit"
                form={idFormulario}
                className="btn btn-primary"
                disabled={!puedeEnviar}
              >
                <Send aria-hidden="true" /> {enviarAhora ? 'Enviar aviso' : 'Programar envío'}
              </button>
            </>
          }
        >
          <form id={idFormulario} className="stack" onSubmit={registrarAviso}>
            <div className="field-grid">
              <div className="field">
                <label htmlFor={`${idFormulario}-grupo`}>
                  Destinatarios <span className="field__required">*</span>
                </label>
                <select
                  id={`${idFormulario}-grupo`}
                  className="select"
                  value={grupo}
                  onChange={(evento) => setGrupo(evento.target.value)}
                >
                  <option value="">Elige un grupo…</option>
                  {grupos.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.etiqueta} ({item.correos.length})
                    </option>
                  ))}
                </select>
                {grupoElegido && <span className="field__hint">{grupoElegido.descripcion}</span>}
              </div>

              <div className="field">
                <label htmlFor={`${idFormulario}-plantilla`}>Plantilla</label>
                <select
                  id={`${idFormulario}-plantilla`}
                  className="select"
                  value={plantilla}
                  onChange={(evento) => usarPlantilla(evento.target.value)}
                >
                  <option value="">Redacción libre</option>
                  {PLANTILLAS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nombre}
                    </option>
                  ))}
                </select>
                {plantillaElegida && (
                  <span className="field__hint">
                    Variables: {plantillaElegida.variables.join(' · ')}
                  </span>
                )}
              </div>

              <div className="field">
                <label htmlFor={`${idFormulario}-canal`}>Canal</label>
                <select
                  id={`${idFormulario}-canal`}
                  className="select"
                  value={canal}
                  onChange={(evento) => setCanal(evento.target.value as Aviso['canal'])}
                >
                  <option value="correo">Correo institucional</option>
                  <option value="sistema">Notificación en el sistema</option>
                </select>
              </div>

              <div className="field">
                <span className="field__label">Momento del envío</span>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={enviarAhora}
                    onChange={(evento) => setEnviarAhora(evento.target.checked)}
                  />
                  <span>{enviarAhora ? 'Enviar de inmediato' : 'Programar para las 18:00'}</span>
                </label>
                <span className="field__hint">
                  La programación se registra con la fecha {HOY_ISO} y queda sujeta a la
                  habilitación de la OTIC.
                </span>
              </div>
            </div>

            <div className="field">
              <label htmlFor={`${idFormulario}-asunto`}>
                Asunto <span className="field__required">*</span>
              </label>
              <input
                id={`${idFormulario}-asunto`}
                className="input"
                value={asunto}
                onChange={(evento) => setAsunto(evento.target.value)}
                placeholder="Ej.: Recordatorio: cierre del informe del tutor"
              />
            </div>

            <div className="field">
              <label htmlFor={`${idFormulario}-cuerpo`}>
                Mensaje <span className="field__required">*</span>
              </label>
              <textarea
                id={`${idFormulario}-cuerpo`}
                className="textarea"
                value={cuerpo}
                onChange={(evento) => setCuerpo(evento.target.value)}
                placeholder="Redacte el mensaje. No incluya diagnósticos ni datos clínicos."
              />
              <span className="field__hint">
                {cuerpo.trim().length} caracteres. Prohibido incluir información clínica o
                diagnósticos.
              </span>
            </div>

            {grupoElegido && grupoElegido.correos.length > 0 && (
              <dl className="def-list">
                <div>
                  <dt>Grupo seleccionado</dt>
                  <dd>{grupoElegido.etiqueta}</dd>
                </div>
                <div>
                  <dt>Destinatarios</dt>
                  <dd>
                    {grupoElegido.correos.length} correo(s):{' '}
                    {grupoElegido.correos.slice(0, 3).join(', ')}
                    {grupoElegido.correos.length > 3
                      ? ` y ${grupoElegido.correos.length - 3} más`
                      : ''}
                  </dd>
                </div>
                <div>
                  <dt>Remitente</dt>
                  <dd>tutoria@unas.edu.pe (remitente institucional propuesto)</dd>
                </div>
                <div>
                  <dt>Canal</dt>
                  <dd>
                    {canal === 'correo'
                      ? 'Correo institucional'
                      : 'Notificación dentro del sistema'}
                  </dd>
                </div>
              </dl>
            )}

            <Alert tone="info" title="Antes de enviar">
              Verifique el grupo de destinatarios y el texto. Cada aviso queda registrado con su
              autor, la fecha, la plantilla y los destinatarios en la auditoría del sistema.
            </Alert>
          </form>
        </Sheet>
      )}
    </>
  );
}
