import { useId, useState } from 'react';
import { ConfiguracionPeriodo } from '../../components/panels/GestionCoordinacion';
import { CompactPage } from '../../components/ui/CompactPage';
import { PageHeading } from '../../components/ui/PageHeading';
import { Card } from '../../components/ui/Card';
import { Tabs, TabPanel } from '../../components/ui/Tabs';
import { Sheet } from '../../components/ui/Sheet';
import { Calendar } from '../../components/ui/Calendar';
import type { EventoCalendario } from '../../components/ui/Calendar';
import { Badge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { semestres, semestreActual } from '../../data/catalogos';
import { definicionesFormato } from '../../data/formatos';
import { useSistema } from '../../hooks/useSistema';
import { API_MODE } from '../../services/apiConfig';
import { formatFecha } from '../../utils/fechas';

export function CoordSemesters() {
  const sistema = useSistema();
  const id = useId();
  const [seleccionado, setSeleccionado] = useState(semestreActual);
  const [vista, setVista] = useState('fechas');
  const [editar, setEditar] = useState(false);
  const [evento, setEvento] = useState<EventoCalendario | null>(null);
  const semestre = semestres.find((s) => s.id === seleccionado);
  const config = seleccionado === semestreActual ? sistema?.configuracionPeriodo : null;
  if (!semestre) return <EmptyState title="Sin semestres registrados" />;
  const fechas = [
    { id: 'matricula-inicio', titulo: 'Inicio de matrícula', fecha: semestre.matriculaInicio },
    { id: 'matricula-fin', titulo: 'Fin de matrícula', fecha: semestre.matriculaFin },
    { id: 'inicio', titulo: 'Inicio de clases', fecha: semestre.inicio },
    ...(config
      ? [
          {
            id: 'entrevistas',
            titulo: 'Entrevistas · fecha recomendada',
            fecha: config.entrevistasHasta,
          },
        ]
      : []),
    { id: 'fin', titulo: 'Fin de clases', fecha: semestre.fin },
    ...(config
      ? [{ id: 'informes', titulo: 'Plazo de informes', fecha: config.informesHasta }]
      : []),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const eventos: EventoCalendario[] = fechas.map((f) => ({ ...f, tono: 'verde' }));
  return (
    <CompactPage>
      <PageHeading
        eyebrow="Coordinación"
        title="Semestres y fechas"
        actions={
          API_MODE && seleccionado === semestreActual ? (
            <button type="button" className="btn btn-primary" onClick={() => setEditar(true)}>
              <i className="fa-regular fa-pen-to-square" aria-hidden="true" /> Editar fechas
            </button>
          ) : undefined
        }
      />
      <div className="compact-toolbar">
        <div className="field">
          <label htmlFor={id}>Semestre</label>
          <select
            id={id}
            className="select"
            value={seleccionado}
            onChange={(e) => setSeleccionado(e.target.value)}
          >
            {semestres.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>
        <Badge tone={semestre.estado === 'cerrado' ? 'neutro' : 'ok'}>
          {semestre.estado === 'cerrado'
            ? 'Cerrado'
            : semestre.estado === 'en-curso'
              ? 'En curso'
              : 'Planificado'}
        </Badge>
      </div>
      <Card>
        <div className="compact-date-summary">
          <dl>
            <dt>Inicio</dt>
            <dd>{formatFecha(semestre.inicio)}</dd>
          </dl>
          <dl>
            <dt>Fin</dt>
            <dd>{formatFecha(semestre.fin)}</dd>
          </dl>
          {config && (
            <dl>
              <dt>Escritura</dt>
              <dd>{config.cerrado ? 'Cerrada' : 'Habilitada'}</dd>
            </dl>
          )}
        </div>
      </Card>
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
      <TabPanel id="fechas" activo={vista}>
        <Card>
          <ul className="compact-list" aria-label="Fechas importantes">
            {fechas.map((f) => (
              <li key={f.id}>
                <div className="compact-list__row">
                  <span className="compact-list__body">
                    <strong>{f.titulo}</strong>
                  </span>
                  <time dateTime={f.fecha}>{formatFecha(f.fecha)}</time>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </TabPanel>
      <TabPanel id="calendario" activo={vista}>
        <Card>
          <Calendar
            key={seleccionado}
            eventos={eventos}
            etiqueta="Calendario del semestre"
            mesInicial={semestre.inicio}
            vistaInicial="mes"
            onAbrir={setEvento}
          />
        </Card>
      </TabPanel>
      <TabPanel id="formularios" activo={vista}>
        <Card>
          <ul className="compact-list">
            {definicionesFormato.map((f) => (
              <li key={f.codigo}>
                <div className="compact-list__row">
                  <span className="compact-code">{f.numero}</span>
                  <span className="compact-list__body">
                    <strong>{f.nombre}</strong>
                    <small>{f.actorEtiqueta}</small>
                  </span>
                  <span className="compact-list__end">
                    {['F01', 'F02', 'F09'].includes(f.codigo)
                      ? 'Al cierre'
                      : ['F03', 'F04', 'F05'].includes(f.codigo)
                        ? 'Al inicio · según ciclo'
                        : ['F10', 'F11'].includes(f.codigo)
                          ? 'Después de cada sesión'
                          : ['F06', 'F07'].includes(f.codigo)
                            ? 'Por sesión'
                            : 'Según el caso'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <p className="compact-note">
          Las entrevistas pendientes se pueden completar durante el semestre abierto. Las
          evaluaciones requieren asistencia confirmada.
        </p>
      </TabPanel>
      {editar && (
        <Sheet title="Editar fechas del semestre" onClose={() => setEditar(false)}>
          <ConfiguracionPeriodo />
        </Sheet>
      )}
      {evento && (
        <Sheet title={evento.titulo} onClose={() => setEvento(null)}>
          <p>{formatFecha(evento.fecha)}</p>
        </Sheet>
      )}
    </CompactPage>
  );
}
