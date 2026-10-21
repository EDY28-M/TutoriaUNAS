import { useState } from 'react';
import { PageHeading } from '../../components/ui/PageHeading';
import { Card, CardBody, CardHead } from '../../components/ui/Card';
import { Badge, StatusBadge } from '../../components/ui/StatusBadge';
import { DataTable } from '../../components/ui/DataTable';
import type { Column } from '../../components/ui/DataTable';
import { Tabs, TabPanel } from '../../components/ui/Tabs';
import { Calendar } from '../../components/ui/Calendar';
import type { EventoCalendario } from '../../components/ui/Calendar';
import { Sheet } from '../../components/ui/Sheet';
import { Alert } from '../../components/ui/Alert';
import { EmptyState } from '../../components/ui/EmptyState';
import { usePortal } from '../../hooks/usePortal';
import {
  afiliacionSisDe,
  apoyosDe,
  atencionesDe,
  beneficiosDe,
  campanasSalud,
  etiquetaAfiliacionSis,
  etiquetaBeneficio,
  etiquetaServicio,
} from '../../data/salud';
import { serviciosBienestar } from '../../data/catalogos';
import { escuelaDe } from '../../data/personas';
import { HOY_ISO, formatFecha, formatFechaLarga, formatHora } from '../../utils/fechas';
import type { AtencionSalud, CampanaSalud, ServicioBienestar } from '../../types/domain';
import '../../assets/vendor/fontawesome.min.css';
import '../../styles/student-health.css';

/** Resumen administrativo de salud. Los detalles clínicos permanecen en el servicio. */
export function StudentHealth() {
  const { estudiante } = usePortal();
  const [pestana, setPestana] = useState('atenciones');
  const [calendario, setCalendario] = useState(false);
  const [servicio, setServicio] = useState<ServicioBienestar | null>(null);
  const [atencion, setAtencion] = useState<AtencionSalud | null>(null);
  const [campana, setCampana] = useState<CampanaSalud | null>(null);

  if (!estudiante) {
    return (
      <EmptyState
        title="Sin datos del estudiante"
        description="La cuenta no tiene expediente asociado."
      />
    );
  }

  const atenciones = atencionesDe(estudiante.id);
  const beneficios = beneficiosDe(estudiante.id);
  const apoyos = apoyosDe(estudiante.id);
  const sis = afiliacionSisDe(estudiante.id);
  const programadas = atenciones
    .filter((item) => item.estado === 'programada')
    .sort((a, b) => `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`));
  const proxima = programadas[0];
  const vigentes = beneficios.filter((item) => item.estado === 'activo');
  const eventos: EventoCalendario[] = campanasSalud.map((item) => ({
    id: item.id,
    fecha: item.fecha,
    titulo: item.tema,
    hora: item.hora,
    tono: 'violeta',
    detalle: `${item.canal} · ${item.inscritos} de ${item.cupos} inscritos`,
    lugar: item.lugar,
    etiqueta: 'Campaña',
  }));
  const columnasAtenciones: Column<AtencionSalud>[] = [
    {
      key: 'fecha',
      header: 'Fecha',
      sortable: true,
      sortValue: (fila) => `${fila.fecha} ${fila.hora}`,
      render: (fila) => <span className="health-page__date">{formatFecha(fila.fecha)}</span>,
    },
    {
      key: 'servicio',
      header: 'Servicio',
      sortable: true,
      sortValue: (fila) => etiquetaServicio[fila.servicio],
      render: (fila) => (
        <span className="person-cell__text">
          <strong>{etiquetaServicio[fila.servicio]}</strong>
          <small>{fila.profesional}</small>
        </span>
      ),
    },
    { key: 'estado', header: 'Estado', render: (fila) => <StatusBadge estado={fila.estado} /> },
    {
      key: 'detalle',
      header: 'Detalle',
      align: 'right',
      render: (fila) => (
        <button
          type="button"
          className="health-page__text-button"
          aria-label={`Ver detalle de ${etiquetaServicio[fila.servicio]} del ${formatFecha(fila.fecha)}`}
          onClick={() => setAtencion(fila)}
        >
          Ver detalle <i className="fa-solid fa-arrow-right" aria-hidden="true" />
        </button>
      ),
    },
  ];

  return (
    <div className="health-page">
      <PageHeading
        eyebrow="Estudiante · Mi información"
        title="Salud y bienestar"
        description="Tus atenciones y los servicios que tienes disponibles."
        actions={
          <button
            type="button"
            className="health-page__text-button"
            onClick={() => setPestana('servicios')}
          >
            Consultar servicios <i className="fa-solid fa-arrow-right" aria-hidden="true" />
          </button>
        }
      />

      <details className="health-page__sis">
        <summary>
          <i className="fa-solid fa-shield-halved" aria-hidden="true" />
          <span>
            Seguro Integral de Salud <span className="health-page__sis-abbr">(SIS)</span>
          </span>
          <Badge tone={sis?.estado === 'vigente' ? 'ok' : 'alerta'}>
            {sis ? etiquetaAfiliacionSis[sis.estado] : 'Sin registro'}
          </Badge>
          <span className="health-page__sis-date">
            Actualizado {formatFecha(sis?.fechaCorte ?? null)}
          </span>
          <i className="fa-solid fa-chevron-down health-page__chevron" aria-hidden="true" />
        </summary>
        <div className="health-page__sis-detail">
          Afiliación ficticia de demostración, pendiente de validación con el padrón institucional.
          Corte: {formatFecha(sis?.fechaCorte ?? null)}. El seguimiento al SIS es una función
          complementaria a la Resolución N.º 500-2022-CU-R-UNAS.
        </div>
      </details>

      <Tabs
        etiqueta="Secciones de salud y bienestar"
        activo={pestana}
        onChange={setPestana}
        items={[
          { id: 'atenciones', label: 'Atenciones', count: atenciones.length },
          { id: 'campanas', label: 'Campañas', count: campanasSalud.length },
          { id: 'beneficios', label: 'Beneficios', count: beneficios.length },
          { id: 'servicios', label: 'Servicios', count: serviciosBienestar.length },
        ]}
      />

      <TabPanel id="atenciones" activo={pestana}>
        <Card>
          <CardHead
            title="Mis atenciones"
            description={
              proxima
                ? `Próxima cita: ${formatFecha(proxima.fecha)} · ${formatHora(proxima.hora)} · ${etiquetaServicio[proxima.servicio]}`
                : 'Sin citas programadas'
            }
          />
          <CardBody>
            <DataTable
              rows={atenciones}
              columns={columnasAtenciones}
              caption="Atenciones de salud y bienestar del estudiante"
              rowKey={(fila) => fila.id}
              emptyTitle="Sin atenciones registradas"
              emptyDescription="Consulta los servicios disponibles para coordinar una cita."
              pageSize={8}
              pagination="auto"
              compact
              initialSort={{ key: 'fecha', direction: 'desc' }}
            />
          </CardBody>
          {apoyos.length > 0 && (
            <details className="health-page__recommendations">
              <summary>
                <i className="fa-solid fa-hand-holding-heart" aria-hidden="true" />
                <span>Recomendaciones para tus estudios</span>
                <Badge>{apoyos.length}</Badge>
                <i className="fa-solid fa-chevron-down health-page__chevron" aria-hidden="true" />
              </summary>
              <ul className="health-page__recommendation-list">
                {apoyos.map((apoyo) => (
                  <li key={apoyo.id}>
                    <strong>{apoyo.apoyoRecomendado}</strong>
                    <p>
                      Necesidad identificada: {apoyo.necesidad}. Autorizado por{' '}
                      {apoyo.autorizadoPor}.
                    </p>
                    <div className="health-page__meta">
                      <Badge tone="dorado">Prioridad {apoyo.prioridad}</Badge>
                      <span>Vigente hasta {formatFecha(apoyo.vigencia)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Card>
      </TabPanel>

      <TabPanel id="campanas" activo={pestana}>
        <Card>
          <CardHead
            title="Campañas y actividades"
            description="La inscripción se coordina con el servicio organizador."
            actions={
              <button
                type="button"
                className="health-page__text-button"
                aria-controls="health-campaign-view"
                aria-expanded={calendario}
                onClick={() => setCalendario((valor) => !valor)}
              >
                <i
                  className={`fa-solid ${calendario ? 'fa-list' : 'fa-calendar-days'}`}
                  aria-hidden="true"
                />
                {calendario ? 'Ver lista' : 'Ver calendario'}
              </button>
            }
          />
          <div id="health-campaign-view">
            {calendario ? (
              <Calendar
                eventos={eventos}
                etiqueta="campañas de salud"
                mesInicial={HOY_ISO}
                vistaInicial="mes"
                maxPorDia={2}
                onAbrir={(evento) =>
                  setCampana(campanasSalud.find((item) => item.id === evento.id) ?? null)
                }
              />
            ) : (
              <ul className="health-page__campaigns">
                {campanasSalud.map((item) => (
                  <li key={item.id}>
                    <time dateTime={item.fecha} className="health-page__day">
                      <strong>{item.fecha.slice(8)}</strong>
                      <span>{formatFecha(item.fecha).split(' ')[1]}</span>
                    </time>
                    <div className="health-page__item-text">
                      <strong>{item.tema}</strong>
                      <p>
                        {formatHora(item.hora)} · {item.lugar}
                      </p>
                      <div className="health-page__meta">
                        <span>{item.canal}</span>
                        <span>
                          {item.inscritos} de {item.cupos} cupos
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="health-page__text-button"
                      aria-label={`Ver actividad: ${item.tema}`}
                      onClick={() => setCampana(item)}
                    >
                      Ver actividad <i className="fa-solid fa-arrow-right" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </TabPanel>

      <TabPanel id="beneficios" activo={pestana}>
        <Card>
          <CardHead
            title="Mis beneficios de bienestar"
            description={`${vigentes.length} vigentes · Apoyos otorgados por el Área de Servicio Social`}
          />
          <CardBody>
            {beneficios.length === 0 ? (
              <EmptyState
                title="Sin beneficios registrados"
                description="Puedes solicitar la evaluación socioeconómica para comedor, residencia u otros apoyos."
              />
            ) : (
              <ul className="health-page__benefits">
                {beneficios.map((beneficio) => (
                  <li key={beneficio.id}>
                    <i className="fa-solid fa-hand-holding-heart" aria-hidden="true" />
                    <div className="health-page__item-text">
                      <strong>{etiquetaBeneficio[beneficio.tipo]}</strong>
                      <p>
                        Desde {formatFecha(beneficio.inicio)}
                        {beneficio.fin ? ` hasta ${formatFecha(beneficio.fin)}` : ''}
                      </p>
                      <p>{beneficio.fuente}</p>
                    </div>
                    <StatusBadge estado={beneficio.estado} />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </TabPanel>

      <TabPanel id="servicios" activo={pestana}>
        <Card>
          <CardHead
            title="Servicios y contactos"
            description="Consulta los horarios, requisitos y canales de atención."
          />
          <CardBody>
            <ul className="health-page__services">
              {serviciosBienestar.map((item) => (
                <li key={item.id}>
                  <i className="fa-solid fa-building-columns" aria-hidden="true" />
                  <div className="health-page__item-text">
                    <strong>{item.nombre}</strong>
                    <p>{item.horario}</p>
                  </div>
                  <button
                    type="button"
                    className="health-page__text-button"
                    onClick={() => setServicio(item)}
                    aria-label={`Ver requisitos de ${item.nombre}`}
                  >
                    Ver requisitos <i className="fa-solid fa-arrow-right" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </TabPanel>

      <details className="health-page__privacy">
        <summary>
          <i className="fa-solid fa-shield-halved" aria-hidden="true" />
          Privacidad y origen de los datos
        </summary>
        <p>
          Se muestra el estado administrativo de las atenciones y las recomendaciones autorizadas
          para tus estudios. Los diagnósticos, exámenes y recetas permanecen en el servicio de
          salud.
        </p>
        <p>
          Fuentes: Servicio de Medicina y Enfermería y Área de Servicio Social. Datos ficticios de
          demostración.
        </p>
      </details>

      {campana && (
        <Sheet
          title={campana.tema}
          description={`${formatFechaLarga(campana.fecha)} · ${formatHora(campana.hora)}`}
          onClose={() => setCampana(null)}
          footer={
            <button
              type="button"
              className="btn btn-falcon-default"
              onClick={() => setCampana(null)}
            >
              Cerrar
            </button>
          }
        >
          <dl className="def-list">
            <div>
              <dt>Modalidad</dt>
              <dd>{campana.canal}</dd>
            </div>
            <div>
              <dt>Lugar</dt>
              <dd>{campana.lugar}</dd>
            </div>
            <div>
              <dt>Cupos</dt>
              <dd>
                {campana.inscritos} inscritos de {campana.cupos} cupos
              </dd>
            </div>
            <div>
              <dt>Escuelas destinatarias</dt>
              <dd>{campana.escuelas.map(escuelaDe).join(', ')}</dd>
            </div>
            <div>
              <dt>Inscripción</dt>
              <dd>Coordina tu inscripción con el servicio organizador de la actividad.</dd>
            </div>
          </dl>
        </Sheet>
      )}
      {servicio && (
        <Sheet
          title={servicio.nombre}
          description={servicio.responsable}
          onClose={() => setServicio(null)}
          footer={
            <button
              type="button"
              className="btn btn-falcon-default"
              onClick={() => setServicio(null)}
            >
              Cerrar
            </button>
          }
        >
          <dl className="def-list">
            <div>
              <dt>Horario</dt>
              <dd>{servicio.horario}</dd>
            </div>
            <div>
              <dt>Ubicación</dt>
              <dd>{servicio.ubicacion}</dd>
            </div>
            <div>
              <dt>Correo</dt>
              <dd>
                <a href={`mailto:${servicio.correo}`}>{servicio.correo}</a>
              </dd>
            </div>
            <div>
              <dt>Teléfono</dt>
              <dd>
                <a href={`tel:${servicio.telefono.replace(/[^+\d]/g, '')}`}>{servicio.telefono}</a>
              </dd>
            </div>
            <div>
              <dt>Requisitos</dt>
              <dd>{servicio.requisitos}</dd>
            </div>
            <div>
              <dt>Cómo solicitar la cita</dt>
              <dd>{servicio.canalCita}</dd>
            </div>
          </dl>
          <Alert tone="info" title="En caso de urgencia">
            Acude directamente al Tópico de Bienestar Universitario. El docente tutor no asume una
            atención médica: su función es canalizarte al servicio correspondiente.
          </Alert>
        </Sheet>
      )}

      {atencion && (
        <Sheet
          title={etiquetaServicio[atencion.servicio]}
          description={`${formatFecha(atencion.fecha)} · ${formatHora(atencion.hora)}`}
          onClose={() => setAtencion(null)}
          footer={
            <button
              type="button"
              className="btn btn-falcon-default"
              onClick={() => setAtencion(null)}
            >
              Cerrar
            </button>
          }
        >
          <div className="stack">
            <dl className="meta-list">
              <div>
                <dt>Estado</dt>
                <dd>
                  <StatusBadge estado={atencion.estado} />
                </dd>
              </div>
              <div>
                <dt>Tipo</dt>
                <dd style={{ textTransform: 'capitalize' }}>{atencion.tipo}</dd>
              </div>
              <div>
                <dt>Profesional</dt>
                <dd>{atencion.profesional}</dd>
              </div>
              <div>
                <dt>Motivo declarado</dt>
                <dd>{atencion.motivo}</dd>
              </div>
            </dl>
            {atencion.recomendacionAcademica ? (
              <Alert tone="ok" title="Recomendación autorizada">
                {atencion.recomendacionAcademica} · vigente hasta el{' '}
                {formatFecha(atencion.vigenciaRecomendacion)}
              </Alert>
            ) : (
              <Alert tone="info" title="Sin recomendación académica">
                El servicio no registró una recomendación que deba comunicarse a la tutoría. El
                detalle de la atención es confidencial.
              </Alert>
            )}
            <p className="small muted">
              <i className="fa-solid fa-shield-halved" aria-hidden="true" /> El expediente clínico
              completo permanece bajo cuidado del servicio de salud y no forma parte del sistema de
              tutoría.
            </p>
          </div>
        </Sheet>
      )}
    </div>
  );
}
