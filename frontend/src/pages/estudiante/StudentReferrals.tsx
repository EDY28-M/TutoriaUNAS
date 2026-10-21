import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Building2,
  CalendarClock,
  CircleCheck,
  FileText,
  Send,
  ShieldCheck,
} from '../../components/ui/icons';
import { PageHeading } from '../../components/ui/PageHeading';
import { Card, CardBody, CardFoot, CardHead } from '../../components/ui/Card';
import { Stat } from '../../components/ui/Stat';
import { Badge, StatusBadge } from '../../components/ui/StatusBadge';
import { Timeline } from '../../components/ui/Timeline';
import type { Hito } from '../../components/ui/Timeline';
import { Sheet } from '../../components/ui/Sheet';
import { Alert } from '../../components/ui/Alert';
import { EmptyState } from '../../components/ui/EmptyState';
import { usePortal } from '../../hooks/usePortal';
import { areasDerivacion, etiquetasEstadoDerivacion } from '../../data/catalogos';
import { formatFecha } from '../../utils/fechas';
import type { Derivacion } from '../../types/domain';

/**
 * Derivaciones del tutorado y su seguimiento. El estudiante ve el área de
 * destino, el estado administrativo y la recomendación que el área autorizó a
 * comunicar; nunca el detalle clínico.
 */
export function StudentReferrals() {
  const portal = usePortal();
  const [parametros] = useSearchParams();
  const enSeguimiento = parametros.get('estado') === 'seguimiento';
  const derivaciones = enSeguimiento
    ? portal.derivaciones.filter((item) =>
        ['citada', 'en-atencion', 'seguimiento'].includes(item.estado),
      )
    : portal.derivaciones;
  const [abierta, setAbierta] = useState<Derivacion | null>(null);

  const abiertas = derivaciones.filter(
    (derivacion) => !['cerrada', 'atendida'].includes(derivacion.estado),
  );
  const atendidas = derivaciones.filter((derivacion) =>
    ['atendida', 'seguimiento', 'cerrada'].includes(derivacion.estado),
  );
  const conRecomendacion = derivaciones.filter((derivacion) => derivacion.recomendacionComunicable);
  const alta = derivaciones.filter((derivacion) => derivacion.prioridad === 'alta');

  function hitosDe(derivacion: Derivacion): Hito[] {
    return derivacion.historial.map((evento) => ({
      titulo: etiquetasEstadoDerivacion[evento.estado] ?? evento.estado,
      descripcion: evento.nota,
      fecha: `${formatFecha(evento.fecha)} · ${evento.responsable}`,
      tono:
        evento.estado === 'cerrada' || evento.estado === 'atendida'
          ? 'ok'
          : evento.estado === 'no-presentado'
            ? 'riesgo'
            : 'info',
    }));
  }

  return (
    <>
      <PageHeading
        eyebrow="Estudiante · Mi información"
        title={enSeguimiento ? 'Solicitudes de apoyo en seguimiento' : 'Mis solicitudes de apoyo'}
        description="Consulta las solicitudes de apoyo que registró tu tutor y el estado de cada atención."
        actions={<Badge tone={abiertas.length ? 'info' : 'ok'}>{abiertas.length} en proceso</Badge>}
      />

      <div className="segmented" aria-label="Vista de solicitudes de apoyo">
        <Link className="btn btn-link" to="/estudiante/derivaciones">
          Todas
        </Link>
        <Link className="btn btn-link" to="/estudiante/derivaciones?estado=seguimiento">
          En seguimiento
        </Link>
      </div>

      <Alert tone="info" title="Qué información puedes ver aquí">
        El sistema conserva el área de destino, el estado de la atención y las recomendaciones
        funcionales para tus estudios. <strong>No</strong> almacena diagnósticos, historias
        clínicas, recetas ni análisis. No tener una atención registrada no significa que no recibas
        atención fuera de la UNAS.
      </Alert>

      <div className="grid grid--4">
        <Stat
          label="Solicitudes de apoyo registradas"
          value={derivaciones.length}
          note="Fichas del formato 12 registradas por tu tutor"
          icon={<Send aria-hidden="true" />}
        />
        <Stat
          label="En proceso"
          value={abiertas.length}
          note="Esperando recepción, cita o atención del área"
          icon={<CalendarClock aria-hidden="true" />}
          tone={abiertas.length ? 'alerta' : 'verde'}
        />
        <Stat
          label="Atendidas"
          value={atendidas.length}
          note="Con atención registrada por el área"
          icon={<CircleCheck aria-hidden="true" />}
          tone="info"
        />
        <Stat
          label="Recomendaciones vigentes"
          value={conRecomendacion.length}
          note="Pautas autorizadas para tu acompañamiento tutorial"
          icon={<ShieldCheck aria-hidden="true" />}
          tone="violeta"
        />
      </div>

      {alta.length > 0 && (
        <Alert tone="alerta" title="Tienes una solicitud de apoyo con prioridad alta">
          El área correspondiente fue notificada. Mantén el contacto con tu docente tutor para
          coordinar el seguimiento.
        </Alert>
      )}

      {derivaciones.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              title="Sin solicitudes de apoyo registradas"
              description="No tienes solicitudes de apoyo a servicios de apoyo. Si lo necesitas, coméntalo con tu docente tutor."
              icon={<Send />}
            />
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid--sidebar">
          <Card>
            <CardHead
              title="Historial de solicitudes de apoyo"
              description="Área, motivo, estado y última actualización"
              actions={<Badge tone="neutro">{derivaciones.length} fichas</Badge>}
            />
            <CardBody flush>
              <ul className="list">
                {derivaciones.map((derivacion) => {
                  const area = areasDerivacion.find((item) => item.id === derivacion.area);
                  return (
                    <li className="list__item" key={derivacion.id}>
                      <span
                        className={`list__icon list__icon--${
                          derivacion.prioridad === 'alta'
                            ? 'danger'
                            : derivacion.prioridad === 'media'
                              ? 'warn'
                              : 'info'
                        }`}
                        aria-hidden="true"
                      >
                        <Building2 />
                      </span>
                      <span className="list__body">
                        <strong>
                          {area?.nombre ?? derivacion.area} · {derivacion.motivo}
                        </strong>
                        <p>{derivacion.detalle}</p>
                        <span className="list__meta">
                          <span className="mono">{derivacion.codigo}</span>
                          <Badge tone="neutro">Prioridad {derivacion.prioridad}</Badge>
                          <span>Actualizado el {formatFecha(derivacion.actualizado)}</span>
                        </span>
                      </span>
                      <span className="list__aside stack stack--sm" style={{ gap: 6 }}>
                        <StatusBadge estado={derivacion.estado} />
                        <button
                          type="button"
                          className="btn btn-falcon-default btn-sm"
                          onClick={() => setAbierta(derivacion)}
                        >
                          Ver seguimiento
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </CardBody>
            <CardFoot>
              <span>El área receptora actualiza el estado; tu tutor lo consulta aquí.</span>
            </CardFoot>
          </Card>

          <div className="stack">
            <Card accent>
              <CardHead
                title="Recomendaciones para tus estudios"
                description="Pautas autorizadas por el área y vigentes para el acompañamiento"
              />
              <CardBody flush>
                {conRecomendacion.length === 0 ? (
                  <EmptyState
                    title="Sin recomendaciones"
                    description="Cuando el área lo autorice, aquí verás las pautas de apoyo académico."
                  />
                ) : (
                  <ul className="list">
                    {conRecomendacion.map((derivacion) => (
                      <li className="list__item" key={derivacion.id}>
                        <span className="list__icon list__icon--ok" aria-hidden="true">
                          <CircleCheck />
                        </span>
                        <span className="list__body">
                          <strong>{derivacion.recomendacionComunicable}</strong>
                          <p>
                            {areasDerivacion.find((item) => item.id === derivacion.area)?.nombre} ·
                            vigente hasta el {formatFecha(derivacion.vigenciaRecomendacion)}
                          </p>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
              <CardFoot>
                <span>Comunica al área cualquier cambio en tu situación.</span>
              </CardFoot>
            </Card>

            <Card flat>
              <CardBody>
                <p className="small muted">
                  <ShieldCheck size={13} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> El
                  tratamiento de tus datos se rige por la Ley N.º 29733 y su reglamento. La
                  información de salud solo se comunica al tutor en los términos que el área
                  autorice.
                </p>
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {abierta && (
        <Sheet
          title={`${areasDerivacion.find((item) => item.id === abierta.area)?.nombre ?? abierta.area} · ${abierta.motivo}`}
          description={`${abierta.codigo} · registrada el ${formatFecha(abierta.fechaDerivacion)}`}
          onClose={() => setAbierta(null)}
          footer={
            <button
              type="button"
              className="btn btn-falcon-default"
              onClick={() => setAbierta(null)}
            >
              Cerrar
            </button>
          }
        >
          <div className="stack">
            <dl className="meta-list">
              <div>
                <dt>Estado actual</dt>
                <dd>
                  <StatusBadge estado={abierta.estado} />
                </dd>
              </div>
              <div>
                <dt>Prioridad</dt>
                <dd style={{ textTransform: 'capitalize' }}>{abierta.prioridad}</dd>
              </div>
              <div>
                <dt>Responsable del área</dt>
                <dd>{abierta.responsableArea}</dd>
              </div>
              <div>
                <dt>Recepción</dt>
                <dd>{formatFecha(abierta.fechaRecepcion)}</dd>
              </div>
              <div>
                <dt>Cita programada</dt>
                <dd>{formatFecha(abierta.fechaCita)}</dd>
              </div>
              <div>
                <dt>Atención</dt>
                <dd>{formatFecha(abierta.fechaAtencion)}</dd>
              </div>
            </dl>

            <div>
              <h3 style={{ fontSize: '0.95rem', marginBottom: 8 }}>Siguiente acción</h3>
              <p className="small muted">{abierta.siguienteAccion}</p>
            </div>

            {abierta.recomendacionComunicable && (
              <Alert tone="ok" title="Recomendación vigente">
                {abierta.recomendacionComunicable}
              </Alert>
            )}

            <div>
              <h3 style={{ fontSize: '0.95rem', marginBottom: 10 }}>Historial de estados</h3>
              <Timeline hitos={hitosDe(abierta)} etiqueta="Historial de la solicitud de apoyo" />
            </div>

            <p className="small muted">
              <FileText size={13} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> El detalle
              de la atención es confidencial y permanece en el servicio de salud o bienestar
              correspondiente.
            </p>
          </div>
        </Sheet>
      )}
    </>
  );
}
