import { Link } from 'react-router-dom';
import { DashboardTasks, NextSession } from '../../components/panels/DashboardSections';
import { EmptyState } from '../../components/ui/EmptyState';
import { CalendarDays, ClipboardList, Send, UserCheck } from '../../components/ui/icons';
import { PageHeading } from '../../components/ui/PageHeading';
import { DashboardScope, PortalCharts } from '../../components/ui/PortalCharts';
import type { DashboardScopeData } from '../../components/ui/PortalCharts';
import { Stat } from '../../components/ui/Stat';
import { formatFecha } from '../../utils/fechas';
import { useInstrumentWorkspace } from '../../hooks/useInstrumentWorkspace';
import { formulariosDelEstudiante, porResponder } from '../../utils/formulariosEstudiante';

export function StudentDashboard() {
  return <DashboardScope>{(scope) => <StudentPanel scope={scope} />}</DashboardScope>;
}

function StudentPanel({ scope }: { scope: DashboardScopeData }) {
  const { portal, proxima } = scope;
  const { momento } = useInstrumentWorkspace();
  const { estudiante, sesiones, instrumentos, derivaciones } = portal;
  if (!estudiante)
    return (
      <EmptyState
        title="Sin datos del estudiante"
        description="No hay un expediente asociado a esta cuenta."
      />
    );
  const realizadas = sesiones.filter((s) => s.estado === 'realizada');
  const asistidas = realizadas.filter((s) =>
    s.asistentes.some(
      (a) => a.estudianteId === estudiante.id && ['asistio', 'tarde'].includes(a.estado),
    ),
  );
  const abiertas = derivaciones.filter((d) => !['atendida', 'cerrada'].includes(d.estado));
  // Misma regla que «Mis formularios»: solo cuenta lo que el estudiante puede responder hoy.
  const formularios = formulariosDelEstudiante(
    instrumentos,
    estudiante.ciclo,
    sesiones,
    momento,
    scope.referencia,
  );
  const porCorregir = formularios.filter((f) => f.disponibilidad === 'corregir').length;
  const pendientes = formularios.filter(porResponder).length;
  return (
    <div className="dashboard-page dashboard-page--student">
      <PageHeading
        eyebrow="Mi tutoría"
        title={`Hola, ${estudiante.nombres.split(' ')[0]}`}
        actions={
          <>
            {scope.filtros}
            <div className="dashboard-actions">
              <Link className="btn btn-primary" to="/estudiante/sesiones">
                Sesiones
              </Link>
            </div>
          </>
        }
        description="Revisa tus próximas sesiones, formularios y solicitudes de apoyo."
      />
      <div className="dashboard-metrics">
        <Stat
          label="Próxima sesión"
          value={proxima ? formatFecha(proxima.fecha) : '—'}
          icon={<CalendarDays />}
        />
        <Stat
          label="Asistencia"
          value={`${asistidas.length}/${realizadas.length}`}
          note="Sesiones realizadas"
          icon={<UserCheck />}
        />
        <Stat
          label="Pendientes"
          value={pendientes}
          note="Formularios por responder"
          icon={<ClipboardList />}
        />
        <Stat
          label="En seguimiento"
          value={abiertas.length}
          note="Solicitudes de apoyo"
          icon={<Send />}
        />
      </div>
      <div className="dashboard-focus-grid">
        <NextSession session={proxima} href="/estudiante/sesiones" />
        <DashboardTasks
          items={[
            {
              label: 'Formularios por completar',
              count: pendientes - porCorregir,
              href: '/estudiante/instrumentos?estado=pendiente',
            },
            {
              label: 'Observaciones por corregir',
              count: porCorregir,
              href: '/estudiante/instrumentos?estado=observado',
              urgent: true,
            },
            {
              label: 'Solicitudes de apoyo en seguimiento',
              count: abiertas.length,
              href: '/estudiante/derivaciones?estado=seguimiento',
            },
          ]}
        />
      </div>
      <PortalCharts scope={scope} />
    </div>
  );
}
