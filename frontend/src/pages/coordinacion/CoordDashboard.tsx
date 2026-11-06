import { Link } from 'react-router-dom';
import { DashboardTasks } from '../../components/panels/DashboardSections';
import { Card, CardBody, CardHead } from '../../components/ui/Card';
import { ArrowRight, ClipboardList, Percent, Presentation, Users } from '../../components/ui/icons';
import { PageHeading } from '../../components/ui/PageHeading';
import { DashboardScope, PortalCharts } from '../../components/ui/PortalCharts';
import type { DashboardScopeData } from '../../components/ui/PortalCharts';
import { Stat } from '../../components/ui/Stat';
import { escuelas } from '../../data/catalogos';
import { estudiantePorId } from '../../data/personas';
import { useSistema } from '../../hooks/useSistema';

export function CoordDashboard() {
  return <DashboardScope coordinacion>{(scope) => <CoordPanel scope={scope} />}</DashboardScope>;
}

function CoordPanel({ scope }: { scope: DashboardScopeData }) {
  const importacion = useSistema()?.fuentes.importacionesPadron?.[0];
  const { portal } = scope;
  const asignaciones = portal.tutorados.filter((a) => a.estado === 'activa');
  const asignados = new Set(asignaciones.map((a) => a.estudianteId));
  const atendidos = new Set(
    portal.sesiones
      .filter((s) => s.estado === 'realizada')
      .flatMap((s) =>
        s.asistentes
          .filter((a) => asignados.has(a.estudianteId) && ['asistio', 'tarde'].includes(a.estado))
          .map((a) => a.estudianteId),
      ),
  );
  const enviados = portal.instrumentos.filter(
    (i) => ['F01', 'F02'].includes(i.formato) && i.estado === 'enviado',
  ).length;
  const abiertas = portal.derivaciones.filter(
    (d) => !['atendida', 'cerrada'].includes(d.estado),
  ).length;
  const alertas = [...asignados].filter((id) => {
    const e = estudiantePorId(id);
    return e && (e.alertas.length > 0 || (e.promedioPonderado ?? Infinity) < 13);
  }).length;
  const cobertura = asignados.size ? Math.round((atendidos.size / asignados.size) * 100) : 0;
  const porEscuela = escuelas
    .map((e) => {
      const ids = new Set(
        asignaciones.filter((a) => a.escuelaId === e.id).map((a) => a.estudianteId),
      );
      const atendidosEscuela = [...ids].filter((id) => atendidos.has(id)).length;
      return {
        ...e,
        asignados: ids.size,
        atendidos: atendidosEscuela,
        cobertura: ids.size ? Math.round((atendidosEscuela / ids.size) * 100) : 0,
      };
    })
    .filter((e) => e.asignados > 0)
    .sort((a, b) => a.cobertura - b.cobertura);
  return (
    <div className="dashboard-page dashboard-page--coord">
      <PageHeading
        eyebrow="Coordinación"
        title="Resumen de tutoría"
        description={
          portal.institucional
            ? 'Sesiones, formularios y tareas de todas las escuelas.'
            : 'Sesiones, formularios y tareas de la escuela seleccionada.'
        }
        actions={
          <>
            {scope.filtros}
            <div className="dashboard-actions">
              {importacion && (
                <Link className="btn btn-falcon-default" to="/coordinacion/padron">
                  Padrón: {Number(importacion.alumnos).toLocaleString('es-PE')} alumnos ·{' '}
                  {Number(importacion.docentes).toLocaleString('es-PE')} docentes
                </Link>
              )}
              <Link className="btn btn-falcon-default" to="/coordinacion/sesiones">
                Sesiones
              </Link>
              <Link className="btn btn-primary" to="/coordinacion/revisiones">
                Revisar informes
              </Link>
            </div>
          </>
        }
      />
      <div className="dashboard-metrics">
        <Stat
          label="Tutores"
          value={new Set(asignaciones.map((a) => a.tutorId)).size}
          note="Con asignaciones activas"
          icon={<Presentation />}
        />
        <Stat
          label="Estudiantes asignados"
          value={asignados.size}
          note={`En ${porEscuela.length} escuelas profesionales`}
          tone="info"
          icon={<Users />}
        />
        <Stat
          label="Informes por revisar"
          value={enviados}
          note="Listos para tu revisión"
          tone="dorado"
          icon={<ClipboardList />}
        />
        <Stat
          label="Cobertura de atención"
          value={`${cobertura}%`}
          note={`${atendidos.size} de ${asignados.size} estudiantes atendidos`}
          icon={<Percent />}
        />
      </div>
      <PortalCharts scope={scope} />
      <div className="dashboard-focus-grid">
        <DashboardTasks
          items={[
            {
              label: 'Informes recibidos',
              description: 'Revisa, aprueba o deja observaciones.',
              count: enviados,
              href: '/coordinacion/revisiones',
            },
            {
              label: 'Estudiantes con alertas',
              description: 'Revisa quién necesita más apoyo.',
              count: alertas,
              href: '/coordinacion/tutorados',
              urgent: true,
            },
            {
              label: 'Solicitudes de apoyo abiertas',
              description: 'Consulta el seguimiento de los casos.',
              count: abiertas,
              href: '/coordinacion/reportes',
            },
          ]}
        />
        <Card className="dashboard-focus-card dashboard-coverage">
          <CardHead
            title="Estudiantes atendidos por escuela"
            description="Compara cuántos estudiantes fueron atendidos en cada escuela."
            actions={
              <Link className="dashboard-text-link" to="/coordinacion/reportes">
                Ver reporte <ArrowRight />
              </Link>
            }
          />
          <CardBody>
            {porEscuela.length ? (
              <ul className="dashboard-schools">
                {porEscuela.map((e) => (
                  <li key={e.id}>
                    <div className="dashboard-school__name">
                      <span title={e.nombre}>{e.nombre}</span>
                      <small>
                        {e.atendidos}/{e.asignados}
                      </small>
                    </div>
                    <div className="dashboard-school__result">
                      <span className="dashboard-school__track" aria-hidden="true">
                        <span
                          style={{
                            width: `${(e.atendidos / Math.max(1, ...porEscuela.map((escuela) => escuela.asignados))) * 100}%`,
                          }}
                        />
                      </span>
                      <strong>{e.cobertura}%</strong>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Sin asignaciones en este periodo.</p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
