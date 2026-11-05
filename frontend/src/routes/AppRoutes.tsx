import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthLayout } from '../components/layout/AuthLayout';
import { PageLoading } from '../components/ui/PageLoading';
import { LoginPage } from '../pages/auth/LoginPage';
import { RecoveryPage } from '../pages/auth/RecoveryPage';
import { AccountSetupPage } from '../pages/auth/AccountSetupPage';
import { UnauthorizedPage } from '../pages/auth/UnauthorizedPage';
import { NotFoundPage } from '../pages/not-found/NotFoundPage';
import { ProtectedRoute } from './ProtectedRoute';
import { useAuth } from '../hooks/useAuth';
import { dashboardPath } from '../utils/roles';

import {
  AppLayout,
  ProfilePage,
  PreferencesPage,
  StudentDashboard,
  StudentSessions,
  StudentTutor,
  StudentInstruments,
  StudentInstrumentFill,
  StudentRecord,
  StudentReferrals,
  StudentHealth,
  StudentDocuments,
  StudentNotices,
  TutorDashboard,
  TutorTutees,
  TuteeRecord,
  TutorSessions,
  TutorAttendance,
  TutorReferrals,
  TutorInstruments,
  TutorReports,
  TutorNotices,
  CoordDashboard,
  CoordAssignments,
  CoordTutors,
  CoordTutees,
  CoordPlan,
  CoordReviews,
  CoordReports,
  CoordSessions,
  CoordNotices,
  CoordExports,
  CoordFormats,
  CoordFields,
  CoordPermissions,
  CoordIntegrations,
  CoordSemesters,
  CoordAudit,
} from './portalPages';

/**
 * Rutas del sistema.
 *
 * El acceso se carga de inmediato porque es la primera pantalla; los módulos de
 * cada portal se descargan bajo demanda, de modo que la carga inicial no
 * arrastre las 35 páginas ni los datos ficticios que no se van a consultar.
 */
const CoordPadron = lazy(() =>
  import('../pages/coordinacion/CoordPadron').then((m) => ({ default: m.CoordPadron })),
);

function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? dashboardPath(user.role) : '/login'} replace />;
}

export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/recuperar-clave" element={<RecoveryPage />} />
          <Route path="/crear-cuenta" element={<AccountSetupPage modo="registro" />} />
          <Route path="/verificar-cuenta" element={<AccountSetupPage modo="activacion" />} />
        </Route>

        <Route element={<ProtectedRoute role="estudiante" />}>
          <Route element={<AppLayout />}>
            <Route path="/estudiante" element={<Navigate to="/estudiante/dashboard" replace />} />
            <Route path="/estudiante/dashboard" element={<StudentDashboard />} />
            <Route
              path="/estudiante/calendario"
              element={<Navigate to="/estudiante/sesiones" replace />}
            />
            <Route path="/estudiante/sesiones" element={<StudentSessions />} />
            <Route path="/estudiante/tutor" element={<StudentTutor />} />
            <Route path="/estudiante/instrumentos" element={<StudentInstruments />} />
            <Route
              path="/estudiante/instrumentos/:instrumentoId"
              element={<StudentInstrumentFill />}
            />
            <Route path="/estudiante/expediente" element={<StudentRecord />} />
            <Route path="/estudiante/derivaciones" element={<StudentReferrals />} />
            <Route path="/estudiante/salud" element={<StudentHealth />} />
            <Route path="/estudiante/documentos" element={<StudentDocuments />} />
            <Route path="/estudiante/avisos" element={<StudentNotices />} />
            <Route path="/estudiante/perfil" element={<ProfilePage />} />
            <Route path="/estudiante/preferencias" element={<PreferencesPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute role="tutor" />}>
          <Route element={<AppLayout />}>
            <Route path="/tutor" element={<Navigate to="/tutor/dashboard" replace />} />
            <Route path="/tutor/dashboard" element={<TutorDashboard />} />
            <Route path="/tutor/calendario" element={<Navigate to="/tutor/sesiones" replace />} />
            <Route path="/tutor/tutorados" element={<TutorTutees />} />
            <Route path="/tutor/tutorados/:estudianteId" element={<TuteeRecord />} />
            <Route path="/tutor/sesiones" element={<TutorSessions />} />
            <Route path="/tutor/asistencias" element={<TutorAttendance />} />
            <Route path="/tutor/derivaciones" element={<TutorReferrals />} />
            <Route path="/tutor/instrumentos" element={<TutorInstruments />} />
            <Route path="/tutor/horario" element={<Navigate to="/tutor/sesiones" replace />} />
            <Route path="/tutor/reportes" element={<TutorReports />} />
            <Route path="/tutor/avisos" element={<TutorNotices />} />
            <Route path="/tutor/perfil" element={<ProfilePage />} />
            <Route path="/tutor/preferencias" element={<PreferencesPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute role="coordinacion" />}>
          <Route element={<AppLayout />}>
            <Route
              path="/coordinacion"
              element={<Navigate to="/coordinacion/dashboard" replace />}
            />
            <Route path="/coordinacion/dashboard" element={<CoordDashboard />} />
            <Route
              path="/coordinacion/calendario"
              element={<Navigate to="/coordinacion/sesiones" replace />}
            />
            <Route path="/coordinacion/sesiones" element={<CoordSessions />} />
            <Route path="/coordinacion/asignaciones" element={<CoordAssignments />} />
            <Route path="/coordinacion/tutores" element={<CoordTutors />} />
            <Route path="/coordinacion/tutorados" element={<CoordTutees />} />
            <Route path="/coordinacion/padron" element={<CoordPadron />} />
            <Route path="/coordinacion/plan" element={<CoordPlan />} />
            <Route path="/coordinacion/revisiones" element={<CoordReviews />} />
            <Route path="/coordinacion/reportes" element={<CoordReports />} />
            <Route path="/coordinacion/exportar" element={<CoordExports />} />
            <Route
              path="/coordinacion/horarios"
              element={<Navigate to="/coordinacion/sesiones" replace />}
            />
            <Route path="/coordinacion/avisos" element={<CoordNotices />} />
            <Route path="/coordinacion/instrumentos" element={<CoordFormats />} />
            <Route path="/coordinacion/campos" element={<CoordFields />} />
            <Route path="/coordinacion/permisos" element={<CoordPermissions />} />
            <Route path="/coordinacion/integraciones" element={<CoordIntegrations />} />
            <Route path="/coordinacion/semestres" element={<CoordSemesters />} />
            <Route path="/coordinacion/auditoria" element={<CoordAudit />} />
            <Route path="/coordinacion/perfil" element={<ProfilePage />} />
            <Route path="/coordinacion/preferencias" element={<PreferencesPage />} />
          </Route>
        </Route>

        <Route path="/no-autorizado" element={<UnauthorizedPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
