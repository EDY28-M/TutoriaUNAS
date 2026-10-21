import { useMemo, useState } from 'react';
import { Bell, Inbox, Mail, MailOpen, Send, Settings2, Users } from '../../components/ui/icons';
import { PageHeading } from '../../components/ui/PageHeading';
import { Card, CardBody, CardFoot, CardHead } from '../../components/ui/Card';
import { Stat } from '../../components/ui/Stat';
import { Badge, StatusBadge } from '../../components/ui/StatusBadge';
import { Sheet } from '../../components/ui/Sheet';
import { Alert } from '../../components/ui/Alert';
import { EmptyState } from '../../components/ui/EmptyState';
import { Timeline } from '../../components/ui/Timeline';
import { usePortal } from '../../hooks/usePortal';
import { avisos, notificaciones } from '../../data/institucional';
import { formatFechaHora } from '../../utils/fechas';
import type { Aviso } from '../../types/domain';

/**
 * Bandeja de avisos del tutorado. Los envíos por correo se habilitarán cuando
 * la OTIC confirme el servicio, el remitente autorizado y las reglas de envío;
 * hasta entonces el aviso vive dentro del sistema.
 */
export function StudentNotices() {
  const portal = usePortal();
  const { estudiante } = portal;
  const [abierto, setAbierto] = useState<Aviso | null>(null);
  const [filtro, setFiltro] = useState<'todos' | 'sistema' | 'correo'>('todos');

  const propios = useMemo(() => {
    if (!estudiante) return avisos;
    const dirigidos = avisos.filter((aviso) =>
      aviso.destinatarios.some((destinatario) => destinatario.startsWith(estudiante.codigo)),
    );
    return dirigidos.length > 0 ? dirigidos : avisos.slice(0, 3);
  }, [estudiante]);

  const visibles = propios.filter((aviso) => filtro === 'todos' || aviso.canal === filtro);

  if (!estudiante) {
    return (
      <EmptyState
        title="Sin datos del estudiante"
        description="La cuenta no tiene expediente asociado."
      />
    );
  }

  const sinLeer = notificaciones.filter((notificacion) => !notificacion.leida);

  return (
    <>
      <PageHeading
        eyebrow="Estudiante · Cuenta"
        title="Avisos"
        description="Revisa los mensajes y recordatorios de tus tutorías."
        actions={<Badge tone={sinLeer.length ? 'alerta' : 'ok'}>{sinLeer.length} sin leer</Badge>}
      />

      <Alert tone="info" title="Avisos dentro del sistema">
        Por ahora, revisa tus avisos aquí. El envío al correo institucional aún no está disponible.
      </Alert>

      <div className="grid grid--4">
        <Stat
          label="Avisos recibidos"
          value={propios.length}
          note="Del semestre 2026-II"
          icon={<Inbox aria-hidden="true" />}
        />
        <Stat
          label="Notificaciones sin leer"
          value={sinLeer.length}
          note="Sesiones, formularios y solicitudes de apoyo"
          icon={<Bell aria-hidden="true" />}
          tone={sinLeer.length ? 'alerta' : 'verde'}
        />
        <Stat
          label="Avisos por correo"
          value={propios.filter((aviso) => aviso.canal === 'correo').length}
          note={propios.filter((aviso) => aviso.estado === 'programado').length + ' programados'}
          icon={<Mail aria-hidden="true" />}
          tone="info"
        />
        <Stat
          label="Plantillas activas"
          value={new Set(propios.map((aviso) => aviso.plantilla)).size}
          note="Definidas por Tutoría y Capacitación Docente"
          icon={<Settings2 aria-hidden="true" />}
          tone="violeta"
        />
      </div>

      <div className="grid grid--sidebar">
        <Card>
          <CardHead
            title="Bandeja de avisos"
            description="Asunto, destinatarios, plantilla y estado de envío"
            actions={
              <div className="segmented" role="tablist" aria-label="Filtrar avisos por canal">
                {(
                  [
                    ['todos', 'Todos'],
                    ['correo', 'Correo'],
                    ['sistema', 'Sistema'],
                  ] as Array<['todos' | 'correo' | 'sistema', string]>
                ).map(([id, etiqueta]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={filtro === id}
                    onClick={() => setFiltro(id)}
                  >
                    {etiqueta}
                  </button>
                ))}
              </div>
            }
          />
          <CardBody flush>
            {visibles.length === 0 ? (
              <EmptyState
                title="Sin avisos en este canal"
                description="Cambia el filtro para ver los demás avisos registrados."
                icon={<Inbox />}
              />
            ) : (
              <ul className="list">
                {visibles.map((aviso) => (
                  <li className="list__item" key={aviso.id}>
                    <span
                      className={`list__icon list__icon--${aviso.estado === 'enviado' ? 'ok' : aviso.estado === 'programado' ? 'info' : 'warn'}`}
                      aria-hidden="true"
                    >
                      {aviso.estado === 'enviado' ? <MailOpen /> : <Mail />}
                    </span>
                    <span className="list__body">
                      <strong>{aviso.asunto}</strong>
                      <p>{aviso.cuerpo}</p>
                      <span className="list__meta">
                        <Badge mono>{aviso.plantilla}</Badge>
                        <span>{formatFechaHora(aviso.enviado)}</span>
                        <span>
                          <Users
                            size={12}
                            aria-hidden="true"
                            style={{ verticalAlign: '-2px', marginRight: 4 }}
                          />
                          {aviso.destinatarios.length} destinatario(s)
                        </span>
                      </span>
                    </span>
                    <span className="list__aside stack stack--sm" style={{ gap: 6 }}>
                      <StatusBadge estado={aviso.estado} />
                      <button
                        type="button"
                        className="btn btn-falcon-default btn-sm"
                        onClick={() => setAbierto(aviso)}
                      >
                        Ver aviso
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
          <CardFoot>
            <span>Los avisos se generan desde las plantillas aprobadas por el área.</span>
          </CardFoot>
        </Card>

        <div className="stack">
          <Card accent>
            <CardHead
              title="Notificaciones del sistema"
              description="Aparecen en la campana de la barra superior"
            />
            <CardBody>
              {notificaciones.length === 0 ? (
                <EmptyState title="Sin notificaciones" />
              ) : (
                <Timeline
                  etiqueta="Notificaciones recientes"
                  hitos={notificaciones.map((notificacion) => ({
                    titulo: notificacion.titulo,
                    descripcion: notificacion.detalle,
                    fecha: formatFechaHora(notificacion.fecha),
                    tono: notificacion.leida ? 'neutro' : 'info',
                  }))}
                />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHead
              title="Configurar avisos"
              description="Configuración de demostración; no envía correos reales"
            />
            <CardBody>
              <ul className="list">
                {[
                  ['Recordatorio de sesión de tutoría', true],
                  ['Formularios pendientes de llenado', true],
                  ['Cambios en el estado de una solicitud de apoyo', true],
                  ['Campañas de salud y bienestar', false],
                  ['Resumen semanal de mi avance tutorial', false],
                ].map(([etiqueta, activo]) => (
                  <li className="list__item" key={etiqueta as string}>
                    <label className="switch" style={{ width: '100%' }}>
                      <input type="checkbox" defaultChecked={Boolean(activo)} />
                      <span>{etiqueta}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </CardBody>
            <CardFoot>
              <span>Las preferencias se guardarán cuando exista el servicio de correo.</span>
            </CardFoot>
          </Card>
        </div>
      </div>

      {abierto && (
        <Sheet
          title={abierto.asunto}
          description={`Enviado el ${formatFechaHora(abierto.enviado)} · plantilla ${abierto.plantilla}`}
          onClose={() => setAbierto(null)}
          footer={
            <button
              type="button"
              className="btn btn-falcon-default"
              onClick={() => setAbierto(null)}
            >
              Cerrar
            </button>
          }
        >
          <div className="stack">
            <div className="ui-row ui-row--tight ui-row--wrap">
              <StatusBadge estado={abierto.estado} />
              <Badge tone="info">{abierto.canal}</Badge>
              <Badge mono>{abierto.plantilla}</Badge>
            </div>
            <p>{abierto.cuerpo}</p>
            <div>
              <h3 style={{ fontSize: '0.92rem', marginBottom: 8 }}>Destinatarios</h3>
              <ul className="list">
                {abierto.destinatarios.map((destinatario) => (
                  <li className="list__item" key={destinatario}>
                    <span className="list__icon list__icon--info" aria-hidden="true">
                      <Send />
                    </span>
                    <span className="list__body">
                      <strong className="mono">{destinatario}</strong>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <Alert tone="info" title="Historial">
              El sistema registra quién generó el aviso, cuándo y con qué plantilla. Los envíos por
              correo quedan condicionados a la habilitación del servicio institucional.
            </Alert>
          </div>
        </Sheet>
      )}
    </>
  );
}
