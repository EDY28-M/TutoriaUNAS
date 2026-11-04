import { Link } from 'react-router-dom';
import { DashboardTasks, NextSession } from '../../components/panels/DashboardSections';
import { EmptyState } from '../../components/ui/EmptyState';
import { CalendarDays, ClipboardList, Send, Users } from '../../components/ui/icons';
import { PageHeading } from '../../components/ui/PageHeading';
import { DashboardScope, PortalCharts } from '../../components/ui/PortalCharts';
import type { DashboardScopeData } from '../../components/ui/PortalCharts';
import { Stat } from '../../components/ui/Stat';
import { estudiantePorId } from '../../data/personas';
import '../../assets/vendor/fontawesome.min.css';
import '../../styles/tutor-dashboard.css';

export function TutorDashboard() {
  return <DashboardScope>{(scope) => <TutorPanel scope={scope} />}</DashboardScope>;
}

function TutorPanel({ scope }: { scope: DashboardScopeData }) {
  const { portal, proxima } = scope;
  const { docente, tutorados, instrumentos, sesiones, derivaciones, contadores } = portal;
  if (!docente)
    return (
      <EmptyState
        title="Sin datos del docente"
        description="No hay una ficha asociada a esta cuenta."
      />
    );
  const observados = instrumentos.filter((i) => i.estado === 'observado').length;
  const abiertas = derivaciones.filter((d) => !['atendida', 'cerrada'].includes(d.estado));
  const alertas = tutorados.filter((a) => {
    const estudiante = estudiantePorId(a.estudianteId);
    return (
      estudiante &&
      (estudiante.alertas.length > 0 || (estudiante.promedioPonderado ?? Infinity) < 13)
    );
  }).length;
  return (
    <div className="dashboard-page dashboard-page--tutor">
      <PageHeading
        eyebrow="Tutoría"
        title={`Hola, ${docente.nombres.split(' ')[0]}`}
        description="Revisa tus sesiones, tus estudiantes y las tareas pendientes."
        actions={
          <>
            {scope.filtros}
            <div className="dashboard-actions">
              <Link className="btn btn-falcon-default" to="/tutor/sesiones">
                Sesiones
              </Link>
              <Link className="btn btn-primary" to="/tutor/sesiones?accion=programar">
                Programar sesión
              </Link>
            </div>
          </>
        }
      />
      <div className="dashboard-metrics">
        <Stat
          label="Estudiantes"
          value={new Set(tutorados.map((a) => a.estudianteId)).size}
          note="Estudiantes a tu cargo"
          icon={<Users />}
        />
        <Stat
          label="Sesiones programadas"
          value={sesiones.filter((s) => ['programada', 'reprogramada'].includes(s.estado)).length}
          note="En el periodo seleccionado"
          tone="info"
          icon={<CalendarDays />}
        />
        <Stat
          label="Formularios pendientes"
          value={contadores.pendientes}
          note={`${observados} con observaciones`}
          tone="dorado"
          icon={<ClipboardList />}
        />
        <Stat
          label="Solicitudes de apoyo abiertas"
          value={abiertas.length}
          note="Requieren seguimiento"
          tone="violeta"
          icon={<Send />}
        />
      </div>
      <section className="tutor-dashboard-charts" aria-label="Gráficos de tu actividad tutorial">
        <header className="tutor-dashboard-charts__head">
          <h2>Tu actividad</h2>
          <Link to="/tutor/reportes">
            Ver reportes <i className="fa-solid fa-arrow-right" aria-hidden="true" />
          </Link>
        </header>
        <PortalCharts scope={scope} simple />
      </section>
      <div className="dashboard-focus-grid">
        <NextSession session={proxima} href="/tutor/sesiones" />
        <DashboardTasks
          items={[
            {
              label: 'Observaciones por corregir',
              description: 'Revisa y vuelve a enviar los formularios.',
              count: observados,
              href: '/tutor/instrumentos?estado=observado',
              urgent: true,
            },
            {
              label: 'Estudiantes con alertas',
              description: 'Consulta su situación y próximos pasos.',
              count: alertas,
              href: '/tutor/tutorados',
              urgent: true,
            },
            {
              label: 'Formularios por completar',
              count: contadores.pendientes - observados,
              href: '/tutor/instrumentos?estado=pendiente',
            },
            {
              label: 'Solicitudes de apoyo abiertas',
              count: abiertas.length,
              href: '/tutor/derivaciones',
            },
          ]}
        />
      </div>
    </div>
  );
}
