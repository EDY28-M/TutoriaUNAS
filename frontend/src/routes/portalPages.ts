import { lazy } from 'react';
import type { ComponentType } from 'react';

/** La navegación y la precarga comparten una única descarga por módulo. */
function precargable<T extends ComponentType>(loader: () => Promise<{ default: T }>) {
  let pending: ReturnType<typeof loader> | undefined;
  const load = () => {
    pending ??= loader().catch((error: unknown) => {
      pending = undefined;
      throw error;
    });
    return pending;
  };
  return Object.assign(lazy(load), { preload: load });
}
export const ProfilePage = precargable(() =>
  import('../pages/comun/ProfilePage').then((m) => ({ default: m.ProfilePage })),
);
export const PreferencesPage = precargable(() =>
  import('../pages/comun/PreferencesPage').then((m) => ({ default: m.PreferencesPage })),
);

// Tutorado
export const StudentDashboard = precargable(() =>
  import('../pages/estudiante/StudentDashboard').then((m) => ({ default: m.StudentDashboard })),
);
export const StudentSessions = precargable(() =>
  import('../pages/estudiante/StudentSessions').then((m) => ({ default: m.StudentSessions })),
);
export const StudentTutor = precargable(() =>
  import('../pages/estudiante/StudentTutor').then((m) => ({ default: m.StudentTutor })),
);
export const StudentInstruments = precargable(() =>
  import('../pages/estudiante/StudentInstruments').then((m) => ({ default: m.StudentInstruments })),
);
export const StudentRecord = precargable(() =>
  import('../pages/estudiante/StudentRecord').then((m) => ({ default: m.StudentRecord })),
);
export const StudentReferrals = precargable(() =>
  import('../pages/estudiante/StudentReferrals').then((m) => ({ default: m.StudentReferrals })),
);
export const StudentHealth = precargable(() =>
  import('../pages/estudiante/StudentHealth').then((m) => ({ default: m.StudentHealth })),
);
export const StudentDocuments = precargable(() =>
  import('../pages/estudiante/StudentDocuments').then((m) => ({ default: m.StudentDocuments })),
);
export const StudentNotices = precargable(() =>
  import('../pages/estudiante/StudentNotices').then((m) => ({ default: m.StudentNotices })),
);

// Docente tutor
export const TutorDashboard = precargable(() =>
  import('../pages/tutor/TutorDashboard').then((m) => ({ default: m.TutorDashboard })),
);
export const TutorTutees = precargable(() =>
  import('../pages/tutor/TutorTutees').then((m) => ({ default: m.TutorTutees })),
);
export const TuteeRecord = precargable(() =>
  import('../pages/tutor/TuteeRecord').then((m) => ({ default: m.TuteeRecord })),
);
export const TutorSessions = precargable(() =>
  import('../pages/tutor/TutorSessions').then((m) => ({ default: m.TutorSessions })),
);
export const TutorAttendance = precargable(() =>
  import('../pages/tutor/TutorAttendance').then((m) => ({ default: m.TutorAttendance })),
);
export const TutorReferrals = precargable(() =>
  import('../pages/tutor/TutorReferrals').then((m) => ({ default: m.TutorReferrals })),
);
export const TutorInstruments = precargable(() =>
  import('../pages/tutor/TutorInstruments').then((m) => ({ default: m.TutorInstruments })),
);
export const TutorReports = precargable(() =>
  import('../pages/tutor/TutorReports').then((m) => ({ default: m.TutorReports })),
);
export const TutorNotices = precargable(() =>
  import('../pages/tutor/TutorNotices').then((m) => ({ default: m.TutorNotices })),
);

// Coordinación de tutoría y gestión institucional
export const CoordDashboard = precargable(() =>
  import('../pages/coordinacion/CoordDashboard').then((m) => ({ default: m.CoordDashboard })),
);
export const CoordAssignments = precargable(() =>
  import('../pages/coordinacion/CoordAssignments').then((m) => ({ default: m.CoordAssignments })),
);
export const CoordTutors = precargable(() =>
  import('../pages/coordinacion/CoordTutors').then((m) => ({ default: m.CoordTutors })),
);
export const CoordTutees = precargable(() =>
  import('../pages/coordinacion/CoordTutees').then((m) => ({ default: m.CoordTutees })),
);
export const CoordPlan = precargable(() =>
  import('../pages/coordinacion/CoordPlan').then((m) => ({ default: m.CoordPlan })),
);
export const CoordReviews = precargable(() =>
  import('../pages/coordinacion/CoordReviews').then((m) => ({ default: m.CoordReviews })),
);
export const CoordReports = precargable(() =>
  import('../pages/coordinacion/CoordReports').then((m) => ({ default: m.CoordReports })),
);
export const CoordSessions = precargable(() =>
  import('../pages/coordinacion/CoordSessions').then((m) => ({ default: m.CoordSessions })),
);
export const CoordNotices = precargable(() =>
  import('../pages/coordinacion/CoordNotices').then((m) => ({ default: m.CoordNotices })),
);
export const CoordFormats = precargable(() =>
  import('../pages/coordinacion/CoordFormats').then((m) => ({ default: m.CoordFormats })),
);
export const CoordFields = precargable(() =>
  import('../pages/coordinacion/CoordFields').then((m) => ({ default: m.CoordFields })),
);
export const CoordPermissions = precargable(() =>
  import('../pages/coordinacion/CoordPermissions').then((m) => ({ default: m.CoordPermissions })),
);
export const CoordIntegrations = precargable(() =>
  import('../pages/coordinacion/CoordIntegrations').then((m) => ({ default: m.CoordIntegrations })),
);
export const CoordSemesters = precargable(() =>
  import('../pages/coordinacion/CoordSemesters').then((m) => ({ default: m.CoordSemesters })),
);
export const CoordAudit = precargable(() =>
  import('../pages/coordinacion/CoordAudit').then((m) => ({ default: m.CoordAudit })),
);

const shared = {
  perfil: ProfilePage,
  preferencias: PreferencesPage,
};
const pages: Record<string, Record<string, { preload(): Promise<unknown> }>> = {
  estudiante: {
    ...shared,
    dashboard: StudentDashboard,
    sesiones: StudentSessions,
    calendario: StudentSessions,
    tutor: StudentTutor,
    instrumentos: StudentInstruments,
    expediente: StudentRecord,
    derivaciones: StudentReferrals,
    salud: StudentHealth,
    documentos: StudentDocuments,
    avisos: StudentNotices,
  },
  tutor: {
    ...shared,
    dashboard: TutorDashboard,
    tutorados: TutorTutees,
    sesiones: TutorSessions,
    asistencias: TutorAttendance,
    calendario: TutorSessions,
    derivaciones: TutorReferrals,
    instrumentos: TutorInstruments,
    horario: TutorSessions,
    reportes: TutorReports,
    avisos: TutorNotices,
  },
  coordinacion: {
    ...shared,
    dashboard: CoordDashboard,
    asignaciones: CoordAssignments,
    tutores: CoordTutors,
    tutorados: CoordTutees,
    plan: CoordPlan,
    revisiones: CoordReviews,
    reportes: CoordReports,
    sesiones: CoordSessions,
    calendario: CoordSessions,
    horarios: CoordSessions,
    avisos: CoordNotices,
    instrumentos: CoordFormats,
    campos: CoordFields,
    permisos: CoordPermissions,
    integraciones: CoordIntegrations,
    semestres: CoordSemesters,
    auditoria: CoordAudit,
  },
};

/** Solo descarga la pantalla señalada; conserva la carga diferida del resto. */
export function preloadPortalRoute(path: string) {
  const [, role = '', module = '', detail] = path.split('?')[0]!.split('/');
  const page =
    role === 'tutor' && module === 'tutorados' && detail ? TuteeRecord : pages[role]?.[module];
  // Una precarga fallida no interrumpe la página actual. El clic puede reintentar.
  void page?.preload().catch(() => undefined);
}
