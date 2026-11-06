import { useId, useState } from 'react';
import { ConfiguracionPeriodo } from '../../components/panels/GestionCoordinacion';
import { Calendar } from '../../components/ui/Calendar';
import type { EventoCalendario } from '../../components/ui/Calendar';
import { Card, CardBody, CardHead } from '../../components/ui/Card';
import { DirectoryPage } from '../../components/ui/DirectoryPage';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeading } from '../../components/ui/PageHeading';
import { Sheet } from '../../components/ui/Sheet';
import { Badge } from '../../components/ui/StatusBadge';
import { Tabs, TabPanel } from '../../components/ui/Tabs';
import { semestres, semestreActual } from '../../data/catalogos';
import { escuelaDe } from '../../data/personas';
import { definicionesFormato } from '../../data/formatos';
import { useSistema } from '../../hooks/useSistema';
import { API_MODE } from '../../services/apiConfig';
import { formatFecha } from '../../utils/fechas';
import '../../styles/coord-planning.css';

function Fecha({ fecha }: { fecha: string }) {
  return <time dateTime={fecha}>{formatFecha(fecha)}</time>;
}

export function CoordSemesters() {
  const sistema = useSistema();
  const id = useId();
  const [eleccion, setEleccion] = useState<string>();
  const [vista, setVista] = useState('fechas');
  const [editar, setEditar] = useState(false);
  const [evento, setEvento] = useState<EventoCalendario | null>(null);
  const seleccionado = eleccion ?? semestreActual;
  const semestre = semestres.find((s) => s.id === seleccionado);
  const config = seleccionado === semestreActual ? sistema?.configuracionPeriodo : null;
  if (!semestre) return <EmptyState title="Sin semestres registrados" />;

  const inicio = config?.inicio ?? semestre.inicio;
  const fin = config?.fin ?? semestre.fin;
  const cerrado = semestre.estado === 'cerrado' || config?.cerrado;
  const estado = cerrado ? 'Cerrado' : semestre.estado === 'en-curso' ? 'En curso' : 'Planificado';
  const eventos: EventoCalendario[] = [
    {
      id: 'matricula-inicio',
      titulo: 'Inicio de matrícula',
      fecha: semestre.matriculaInicio,
      tono: 'info',
    },
    { id: 'matricula-fin', titulo: 'Fin de matrícula', fecha: semestre.matriculaFin, tono: 'info' },
    { id: 'clases-inicio', titulo: 'Inicio de clases', fecha: inicio, tono: 'verde' },
    { id: 'clases-fin', titulo: 'Fin de clases', fecha: fin, tono: 'verde' },
  ];
  if (config) {
    eventos.push(
      {
        id: 'entrevistas',
        titulo: 'Fecha recomendada de entrevistas',
        fecha: config.entrevistasHasta,
        tono: 'info',
      },
      { id: 'informes', titulo: 'Plazo de informes', fecha: config.informesHasta, tono: 'dorado' },
    );
  }

  return (
    <DirectoryPage className="coord-planning">
      <PageHeading
        eyebrow="Coordinación de tutoría"
        title="Semestres y fechas"
        description="Calendario académico y plazos de tutoría."
        actions={
          API_MODE &&
          config && (
            <button type="button" className="btn btn-primary" onClick={() => setEditar(true)}>
              <i className="fa-regular fa-pen-to-square" aria-hidden="true" /> Editar fechas
            </button>
          )
        }
      />
      {!!sistema?.periodosEscuela?.length && (
        <Card>
          <CardHead
            title="Periodos por escuela"
            description="Selecciona una escuela en Ámbito para editar sus fechas."
          />
          <CardBody>
            <DataTable
              caption="Periodos tutoriales por escuela"
              rows={sistema.periodosEscuela}
              rowKey={(p) => p.escuelaId}
              pagination="auto"
              columns={[
                {
                  key: 'escuela',
                  header: 'Escuela',
                  sortable: true,
                  sortValue: (p) => escuelaDe(p.escuelaId),
                  render: (p) => escuelaDe(p.escuelaId),
                },
                { key: 'semestre', header: 'Semestre', render: (p) => p.semestreId },
                {
                  key: 'inicio',
                  header: 'Inicio',
                  render: (p) => (p.inicio ? <Fecha fecha={p.inicio} /> : '—'),
                },
                {
                  key: 'fin',
                  header: 'Fin',
                  render: (p) => (p.fin ? <Fecha fecha={p.fin} /> : '—'),
                },
                {
                  key: 'estado',
                  header: 'Estado',
                  render: (p) => (p.cerrado ? 'Cerrado' : 'Abierto'),
                },
              ]}
            />
          </CardBody>
        </Card>
      )}
      <Card>
        <CardHead
          title="Periodo académico"
          actions={
            <div className="semester-picker">
              <Badge tone={cerrado ? 'neutro' : semestre.estado === 'en-curso' ? 'ok' : 'info'}>
                {estado}
              </Badge>
              <label className="sr-only" htmlFor={id}>
                Semestre
              </label>
              <select
                id={id}
                className="select"
                value={seleccionado}
                onChange={(e) => setEleccion(e.target.value)}
              >
                {semestres.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>
          }
        />
        <CardBody>
          <div className="directory-toolbar">
            <Tabs
              etiqueta="Fechas del semestre"
              activo={vista}
              onChange={setVista}
              items={[
                { id: 'fechas', label: 'Fechas' },
                { id: 'calendario', label: 'Calendario' },
                { id: 'formularios', label: 'Formularios' },
              ]}
            />
          </div>
          <TabPanel id="fechas" activo={vista}>
            <dl className="semester-dates">
              <div>
                <dt>Matrícula</dt>
                <dd>
                  <Fecha fecha={semestre.matriculaInicio} /> –{' '}
                  <Fecha fecha={semestre.matriculaFin} />
                </dd>
              </div>
              <div>
                <dt>Clases</dt>
                <dd>
                  <Fecha fecha={inicio} /> – <Fecha fecha={fin} />
                </dd>
              </div>
              {config && (
                <>
                  <div>
                    <dt>
                      Entrevistas <small>Fecha recomendada</small>
                    </dt>
                    <dd>
                      <Fecha fecha={config.entrevistasHasta} />
                    </dd>
                  </div>
                  <div>
                    <dt>Entrega de informes</dt>
                    <dd>
                      <Fecha fecha={config.informesHasta} />
                    </dd>
                  </div>
                </>
              )}
            </dl>
          </TabPanel>
          <TabPanel id="calendario" activo={vista}>
            <div className="semester-calendar">
              <Calendar
                key={`${seleccionado}-${inicio}`}
                eventos={eventos}
                etiqueta="Calendario del semestre"
                mesInicial={inicio}
                vistaInicial="mes"
                onAbrir={setEvento}
              />
            </div>
          </TabPanel>
          <TabPanel id="formularios" activo={vista}>
            <ul className="semester-formats" aria-label="Plazos de los formularios">
              {definicionesFormato.map((f) => (
                <li key={f.codigo}>
                  <Badge mono>{f.numero}</Badge>
                  <span>
                    <strong>{f.nombre}</strong>
                    <small>{f.actorEtiqueta}</small>
                  </span>
                  <small>{f.periodicidad}</small>
                </li>
              ))}
            </ul>
          </TabPanel>
        </CardBody>
      </Card>
      {editar && config && (
        <Sheet title="Editar fechas" description={semestre.nombre} onClose={() => setEditar(false)}>
          <ConfiguracionPeriodo key={config.periodoId} actual={config} />
        </Sheet>
      )}
      {evento && (
        <Sheet title={evento.titulo} onClose={() => setEvento(null)}>
          <Fecha fecha={evento.fecha} />
        </Sheet>
      )}
    </DirectoryPage>
  );
}
