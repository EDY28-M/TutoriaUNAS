import { BorradoresAvisos } from '../../components/panels/AccionesTutoria';
import { API_MODE } from '../../services/apiConfig';
import { useSistema } from '../../hooks/useSistema';
import { RedactorAviso } from '../../components/panels/RedactorAviso';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Mail, ServerCog, TriangleAlert, Send, FileText } from '../../components/ui/icons';
import { MetricGroup } from '../../components/ui/MetricGroup';
import { Stat } from '../../components/ui/Stat';
import { PageHeading } from '../../components/ui/PageHeading';
import { Card, CardBody, CardFoot, CardHead } from '../../components/ui/Card';
import { Alert } from '../../components/ui/Alert';
import { Badge, StatusBadge } from '../../components/ui/StatusBadge';
import type { TonoBadge } from '../../components/ui/StatusBadge';
import { DataTable } from '../../components/ui/DataTable';
import type { Column } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { Sheet } from '../../components/ui/Sheet';
import { usePortal } from '../../hooks/usePortal';
import { avisos, insumos, notificaciones, reglasTutoria } from '../../data/institucional';
import { abreviaturaEscuela } from '../../data/personas';
import type { Aviso, Notificacion } from '../../types/domain';
import { formatFechaHora } from '../../utils/fechas';
import '../../assets/vendor/fontawesome.min.css';
import '../../styles/tutor-notices.css';

/**
 * Avisos y correos del docente tutor: bandeja de los mensajes dirigidos a su
 * cuenta institucional, plantillas disponibles, reglas de envío pendientes de
 * habilitación por la OTIC y notificaciones internas del sistema.
 */

interface PlantillaCorreo {
  clave: string;
  nombre: string;
  descripcion: string;
  destinatarios: string;
}

const PLANTILLAS: Record<string, Omit<PlantillaCorreo, 'clave'>> = {
  'recordatorio-sesion': {
    nombre: 'Recordatorio de sesión de tutoría',
    descripcion: 'Comunica la fecha, la hora y el lugar de la próxima sesión individual.',
    destinatarios: 'Tutorados convocados a la sesión',
  },
  'instrumento-pendiente': {
    nombre: 'Instrumento pendiente de llenado',
    descripcion: 'Recuerda completar la entrevista o evaluación antes del cierre del periodo.',
    destinatarios: 'Tutorados con instrumentos pendientes',
  },
  'derivacion-registrada': {
    nombre: 'Derivación registrada',
    descripcion: 'Informa el registro de la ficha 12 y el área a la que fue remitida.',
    destinatarios: 'Estudiante derivado',
  },
  'cierre-informe-tutor': {
    nombre: 'Cierre de informe del tutor',
    descripcion: 'Avisa la habilitación del formato 02 y su fecha límite de presentación.',
    destinatarios: 'Docentes tutores',
  },
  'instrumento-observado': {
    nombre: 'Instrumento observado',
    descripcion: 'Solicita subsanar las observaciones registradas por la coordinación.',
    destinatarios: 'Docente tutor responsable del formato',
  },
  'resumen-semanal': {
    nombre: 'Resumen semanal de tutoría',
    descripcion: 'Envía la cobertura semanal: sesiones, estudiantes atendidos e formularios.',
    destinatarios: 'Coordinación de tutoría y responsables',
  },
  'recordatorio-cita': {
    nombre: 'Recordatorio de cita en Bienestar',
    descripcion: 'Recuerda la cita programada por un servicio de apoyo universitario.',
    destinatarios: 'Estudiante con cita programada',
  },
};

const TONO_TIPO: Record<Notificacion['tipo'], TonoBadge> = {
  sesion: 'info',
  instrumento: 'alerta',
  derivacion: 'violeta',
  academico: 'neutro',
  sistema: 'dorado',
};

const ETIQUETA_TIPO: Record<Notificacion['tipo'], string> = {
  sesion: 'Sesión',
  instrumento: 'Instrumento',
  derivacion: 'Derivación',
  academico: 'Académico',
  sistema: 'Sistema',
};

export function TutorNotices() {
  const sistema = useSistema();
  const [editarAviso, setEditarAviso] = useState<string | null>(null);
  const portal = usePortal();
  const { docente, avisosSinLeer } = portal;

  const [ambito, setAmbito] = useState<'mios' | 'todos'>('mios');
  const [abiertoId, setAbiertoId] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState('');
  const [panel, setPanel] = useState<'plantillas' | 'notificaciones' | 'envio' | null>(null);

  const dirigidos = docente
    ? avisos.filter((aviso) => aviso.destinatarios.includes(docente.correo))
    : [];
  const mostrarTodos = ambito === 'todos' || dirigidos.length === 0;
  const bandeja = mostrarTodos ? avisos : dirigidos;
  const termino = busqueda.trim().toLocaleLowerCase('es');
  const visibles = bandeja.filter(
    (aviso) =>
      (!estado || aviso.estado === estado) &&
      (!termino ||
        `${aviso.asunto} ${aviso.cuerpo} ${aviso.destinatarios.join(' ')} ${aviso.plantilla}`
          .toLocaleLowerCase('es')
          .includes(termino)),
  );

  const abierto = avisos.find((aviso) => aviso.id === abiertoId);
  const plantillasUsadas = [...new Set(avisos.map((aviso) => aviso.plantilla))];
  const plantillasDisponibles: PlantillaCorreo[] = plantillasUsadas.map((clave) => ({
    clave,
    ...(PLANTILLAS[clave] ?? {
      nombre: clave.replaceAll('-', ' '),
      descripcion: 'Plantilla registrada en el sistema de avisos.',
      destinatarios: 'Destinatarios configurados por el área usuaria',
    }),
  }));

  const insumoOtic = insumos.find((insumo) => insumo.area.includes('OTIC'));
  const reglasPendientes = reglasTutoria.filter((regla) => regla.estado !== 'validada');

  const columnas: Column<Aviso>[] = [
    {
      key: 'asunto',
      header: 'Asunto',
      sortable: true,
      sortValue: (fila) => fila.asunto,
      render: (fila) => (
        <span className="tutor-notices__subject">
          <strong>{fila.asunto}</strong>
          <span className="tutor-notices__preview">{fila.cuerpo}</span>
          <small>
            {fila.destinatarios.length} destinatarios
            {docente && fila.destinatarios.includes(docente.correo) ? ' · Incluye mi cuenta' : ''}
          </small>
        </span>
      ),
    },
    {
      key: 'fecha',
      header: 'Fecha',
      sortable: true,
      sortValue: (fila) => fila.enviado,
      render: (fila) => (
        <span className="tutor-notices__date">{formatFechaHora(fila.enviado)}</span>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      sortable: true,
      sortValue: (fila) => fila.estado,
      render: (fila) => <StatusBadge estado={fila.estado} />,
    },
    {
      key: 'detalle',
      header: 'Detalle',
      align: 'right',
      render: (fila) => (
        <button
          type="button"
          className="tutor-notices__text-button"
          onClick={() => setAbiertoId(fila.id)}
          aria-label={`Ver el aviso ${fila.asunto}`}
        >
          Ver aviso <i className="fa-solid fa-arrow-right" aria-hidden="true" />
        </button>
      ),
    },
  ];
  if (!docente) {
    return (
      <PageHeading
        eyebrow="Cuenta"
        title="Avisos y correos"
        description="La cuenta de demostración no tiene una ficha de docente tutor asociada."
      />
    );
  }

  const enviados = bandeja.filter((aviso) => aviso.estado === 'enviado');
  const programados = bandeja.filter((aviso) => aviso.estado === 'programado');
  const borradores = bandeja.filter((aviso) => aviso.estado === 'borrador');

  return (
    <div className="tutor-notices">
      <PageHeading
        eyebrow={`Docente tutor · ${abreviaturaEscuela(docente.escuelaId)} · Cuenta institucional`}
        title="Avisos"
        description={`${docente.correo} · Comunicaciones de tutoría`}
        actions={
          <>
            <button
              type="button"
              className="btn btn-falcon-default"
              onClick={() => setPanel('notificaciones')}
            >
              <i className="fa-regular fa-bell" aria-hidden="true" /> Notificaciones{' '}
              <Badge>{avisosSinLeer}</Badge>
            </button>
            <button
              type="button"
              className="btn btn-falcon-default"
              onClick={() => setPanel('plantillas')}
            >
              <i className="fa-regular fa-file-lines" aria-hidden="true" /> Plantillas de correo
            </button>
          </>
        }
      />

      {dirigidos.length === 0 && (
        <Alert tone="info" title="No tienes avisos dirigidos a tu cuenta">
          En esta prueba se muestran avisos de ejemplo de todo el sistema.
        </Alert>
      )}

      <MetricGroup label="Resumen de avisos">
        <Stat
          label="Para mi cuenta"
          value={dirigidos.length}
          note="Avisos dirigidos a ti"
          icon={<Mail />}
        />
        <Stat
          label="Enviados"
          value={enviados.length}
          note={`${programados.length} programados · ${borradores.length} borradores`}
          icon={<Send />}
        />
        <Stat
          label="Plantillas"
          value={plantillasDisponibles.length}
          note="Textos disponibles"
          icon={<FileText />}
        />
        <Stat
          label="Notificaciones"
          value={avisosSinLeer}
          note="Sin leer en el sistema"
          icon={<Bell />}
        />
      </MetricGroup>

      <div className="notice-mail-status">
        <span>
          <i className="fa-solid fa-circle-info" aria-hidden="true" />{' '}
          {API_MODE
            ? 'Avisos dentro del sistema. El correo institucional requiere su proveedor.'
            : 'Correo en demostración. No se envían mensajes.'}
        </span>
        <button
          type="button"
          className="tutor-notices__text-button"
          onClick={() => setPanel('envio')}
        >
          {API_MODE ? 'Redactar aviso' : 'Estado del correo'}{' '}
          <i className="fa-solid fa-arrow-right" aria-hidden="true" />
        </button>
      </div>

      <Card className="tutor-notices__inbox">
        <CardHead
          title="Bandeja de avisos"
          actions={<span className="notice-order">Orden inicial: más recientes</span>}
        />
        <CardBody>
          <div className="tutor-notices__toolbar">
            <span className="segmented" role="group" aria-label="Alcance de la bandeja">
              <button type="button" aria-pressed={!mostrarTodos} onClick={() => setAmbito('mios')}>
                Para mí ({dirigidos.length})
              </button>
              <button type="button" aria-pressed={mostrarTodos} onClick={() => setAmbito('todos')}>
                Todos ({avisos.length})
              </button>
            </span>
            <span>
              {visibles.length} {visibles.length === 1 ? 'aviso' : 'avisos'}
            </span>
          </div>
          <div className="notice-filters" role="search" aria-label="Buscar avisos">
            <div className="field">
              <label htmlFor="notice-search">Buscar</label>
              <span className="search-field">
                <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
                <input
                  id="notice-search"
                  type="search"
                  value={busqueda}
                  onChange={(event) => setBusqueda(event.target.value)}
                  placeholder="Asunto, mensaje o destinatario…"
                />
              </span>
            </div>
            <div className="field">
              <label htmlFor="notice-status">Estado</label>
              <select
                id="notice-status"
                className="select"
                value={estado}
                onChange={(event) => setEstado(event.target.value)}
              >
                <option value="">Todos</option>
                {[...new Set(avisos.map((aviso) => aviso.estado))].map((item) => (
                  <option key={item} value={item}>
                    {item === 'enviado'
                      ? 'Enviado'
                      : item === 'programado'
                        ? 'Programado'
                        : 'Borrador'}
                  </option>
                ))}
              </select>
            </div>
            {(busqueda || estado) && (
              <button
                type="button"
                className="tutor-notices__text-button"
                onClick={() => {
                  setBusqueda('');
                  setEstado('');
                }}
              >
                Limpiar
              </button>
            )}
          </div>
          <DataTable<Aviso>
            rows={visibles}
            columns={columnas}
            caption="Avisos y correos del sistema de tutoría dirigidos al docente tutor"
            rowKey={(fila) => fila.id}
            emptyTitle={busqueda || estado ? 'Sin avisos que coincidan' : 'Bandeja vacía'}
            emptyDescription={
              busqueda || estado
                ? 'Ajusta la búsqueda o limpia los filtros.'
                : 'No hay avisos registrados para la cuenta docente.'
            }
            initialSort={{ key: 'fecha', direction: 'desc' }}
            pagination="auto"
            compact
          />
        </CardBody>
        <CardFoot>
          <span>Comunicación del sistema de tutoría · demostración</span>
          <Link className="tutor-notices__text-button" to="/tutor/instrumentos">
            Formularios observados <i className="fa-solid fa-arrow-right" aria-hidden="true" />
          </Link>
        </CardFoot>
      </Card>
      {panel === 'plantillas' && (
        <Sheet
          title="Plantillas de correo"
          description="Textos aprobados y destinatarios de cada comunicación."
          onClose={() => setPanel(null)}
          wide
        >
          <ul className="list">
            {plantillasDisponibles.map((plantilla) => (
              <li className="list__item" key={plantilla.clave}>
                <span className="list__icon" aria-hidden="true">
                  <Mail />
                </span>
                <span className="list__body">
                  <strong>{plantilla.nombre}</strong>
                  <p>{plantilla.descripcion}</p>
                  <span className="list__meta">
                    <span className="mono">{plantilla.clave}</span>
                    <span>{plantilla.destinatarios}</span>
                  </span>
                </span>
                <span className="list__aside">
                  <Badge tone="info">
                    {avisos.filter((aviso) => aviso.plantilla === plantilla.clave).length} uso(s)
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
        </Sheet>
      )}
      {panel === 'notificaciones' && (
        <Sheet
          title="Notificaciones del sistema"
          description={`${avisosSinLeer} sin leer`}
          onClose={() => setPanel(null)}
          wide
        >
          <ul className="list">
            {notificaciones.map((notificacion) => (
              <li className="list__item" key={notificacion.id}>
                <span
                  className={`list__icon list__icon--${notificacion.leida ? 'info' : 'gold'}`}
                  aria-hidden="true"
                >
                  <Bell />
                </span>
                <span className="list__body">
                  <strong>{notificacion.titulo}</strong>
                  <p>{notificacion.detalle}</p>
                  <span className="list__meta">
                    <Badge tone={TONO_TIPO[notificacion.tipo]}>
                      {ETIQUETA_TIPO[notificacion.tipo]}
                    </Badge>
                    <span>{formatFechaHora(notificacion.fecha)}</span>
                    {notificacion.enlace && (
                      <Link to={notificacion.enlace}>Ir al módulo relacionado</Link>
                    )}
                  </span>
                </span>
                <span className="list__aside">
                  <Badge tone={notificacion.leida ? 'neutro' : 'alerta'}>
                    {notificacion.leida ? 'Leída' : 'Sin leer'}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
        </Sheet>
      )}
      {API_MODE && <BorradoresAvisos />}
      {API_MODE && panel === 'envio' && (
        <RedactorAviso
          aviso={sistema?.mensajes.find((m) => m.id === editarAviso)}
          copiar={!sistema?.mensajes.find((m) => m.id === editarAviso)?.editable}
          onCerrar={() => {
            setPanel(null);
            setEditarAviso(null);
          }}
        />
      )}
      {!API_MODE && panel === 'envio' && (
        <Sheet title="Estado del correo institucional" onClose={() => setPanel(null)} wide>
          <div className="stack">
            <Card>
              <CardHead
                title="Reglas de envío pendientes de habilitar"
                description="Condiciones por validar antes de activar el despacho automático"
                actions={<Badge tone="alerta">{reglasPendientes.length} por validar</Badge>}
              />
              <CardBody flush>
                {reglasPendientes.length === 0 ? (
                  <EmptyState
                    title="Sin reglas pendientes"
                    description="Todas las reglas de envío cuentan con validación registrada."
                    icon={<ServerCog />}
                  />
                ) : (
                  <ul className="list">
                    {reglasPendientes.map((regla) => (
                      <li className="list__item" key={regla.id}>
                        <span className="list__icon list__icon--warn" aria-hidden="true">
                          <TriangleAlert />
                        </span>
                        <span className="list__body">
                          <strong>{regla.descripcion}</strong>
                          <p>{regla.valor}</p>
                          <span className="list__meta">
                            <span className="mono">{regla.codigo}</span>
                            <span>{regla.fuente}</span>
                          </span>
                        </span>
                        <span className="list__aside">
                          <StatusBadge estado={regla.estado} />
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
              <CardFoot>
                <span>
                  La habilitación del servidor, dominio y respaldos corresponde a la OTIC.
                </span>
                {insumoOtic && <StatusBadge estado={insumoOtic.estado} />}
              </CardFoot>
            </Card>

            {insumoOtic && (
              <Card>
                <CardHead title="Solicitud a la OTIC" description={insumoOtic.area} />
                <CardBody>
                  <dl className="def-list">
                    <div>
                      <dt>Datos solicitados</dt>
                      <dd>{insumoOtic.insumoPrioritario}</dd>
                    </div>
                    <div>
                      <dt>Aplicación</dt>
                      <dd>{insumoOtic.aplicacion}</dd>
                    </div>
                    <div>
                      <dt>Estado</dt>
                      <dd>
                        <StatusBadge estado={insumoOtic.estado} />
                      </dd>
                    </div>
                    <div>
                      <dt>Fecha de solicitud</dt>
                      <dd>{insumoOtic.fechaSolicitud}</dd>
                    </div>
                    <div>
                      <dt>Observación</dt>
                      <dd>{insumoOtic.observacion}</dd>
                    </div>
                  </dl>
                </CardBody>
              </Card>
            )}
          </div>
        </Sheet>
      )}
      {abierto && (
        <Sheet
          title={abierto.asunto}
          description={`${formatFechaHora(abierto.enviado)} · plantilla ${abierto.plantilla}`}
          onClose={() => setAbiertoId(null)}
          wide
          footer={
            <>
              <button
                type="button"
                className="btn btn-falcon-default"
                onClick={() => setAbiertoId(null)}
              >
                Cerrar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  if (API_MODE) {
                    setEditarAviso(abierto.id);
                    setPanel('envio');
                  }
                  setAbiertoId(null);
                }}
              >
                {API_MODE
                  ? sistema?.mensajes.find((m) => m.id === abierto.id)?.editable
                    ? 'Editar borrador'
                    : 'Redactar a partir de este aviso'
                  : 'Reenviar (demostración)'}
              </button>
            </>
          }
        >
          <div className="stack">
            <div className="ui-row ui-row--wrap ui-row--tight">
              <StatusBadge estado={abierto.estado} />
              <Badge tone="neutro">Canal: {abierto.canal}</Badge>
              <Badge tone="info">{abierto.destinatarios.length} destinatario(s)</Badge>
            </div>
            <section className="tutor-notices__message" aria-label="Contenido del aviso">
              <p>{abierto.cuerpo}</p>
            </section>
            <dl className="meta-list">
              <div>
                <dt>Plantilla</dt>
                <dd className="mono">{abierto.plantilla}</dd>
              </div>
              <div>
                <dt>Módulo relacionado</dt>
                <dd>{abierto.relacionadoCon ?? 'Sin referencia'}</dd>
              </div>
              <div>
                <dt>Fecha de envío</dt>
                <dd>{formatFechaHora(abierto.enviado)}</dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>
                  <StatusBadge estado={abierto.estado} />
                </dd>
              </div>
            </dl>
            <div className="stack stack--sm">
              <p className="field__label">Destinatarios</p>
              <ul className="list">
                {abierto.destinatarios.map((destinatario) => (
                  <li className="list__item" key={destinatario}>
                    <span className="list__icon list__icon--info" aria-hidden="true">
                      <Mail />
                    </span>
                    <span className="list__body">
                      <strong>{destinatario}</strong>
                      <p>
                        {destinatario === docente.correo
                          ? 'Cuenta del docente tutor'
                          : 'Cuenta institucional registrada'}
                      </p>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="small muted">
              {API_MODE
                ? 'Los avisos internos se publican en el sistema. El correo externo requiere que la OTIC habilite el servicio institucional.'
                : 'El reenvío y la programación se muestran con datos de demostración.'}
            </p>
          </div>
        </Sheet>
      )}
    </div>
  );
}
