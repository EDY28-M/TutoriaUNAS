import {
  Activity,
  Award,
  Bell,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  ChartNoAxesCombined,
  ClipboardList,
  Database,
  FileText,
  FolderOpen,
  GraduationCap,
  HeartPulse,
  History,
  Layers,
  LayoutDashboard,
  ListChecks,
  Mail,
  Plug,
  Presentation,
  ScrollText,
  Send,
  ShieldCheck,
  Settings2,
  SlidersHorizontal,
  UserCheck,
  UserRound,
  Users,
} from '../components/ui/icons';
import type { Icono } from '../components/ui/icons';
import type { Role } from '../types/auth';

export interface NavigationItem {
  path: string;
  label: string;
  icon: Icono;
  /** Clave del contador dinámico que se muestra a la derecha. */
  counter?: 'sesiones' | 'pendientes' | 'derivaciones' | 'avisos' | 'observados' | 'revisiones';
  /** Submódulos con rutas reales o filtros admitidos por la página de destino. */
  children?: NavigationItem[];
}

export interface NavigationGroup {
  title: string;
  items: NavigationItem[];
}

/**
 * Navegación por rol. Los módulos siguen el alcance funcional del plan de
 * trabajo (acceso, formularios 01–12, sesiones y seguimiento, repositorio,
 * reportes y trazabilidad) y las nueve solicitudes de datos.
 */
export const navigation: Record<Role, NavigationGroup[]> = {
  estudiante: [
    {
      title: 'Inicio',
      items: [{ path: 'dashboard', label: 'Inicio', icon: LayoutDashboard }],
    },
    {
      title: 'Mi tutoría',
      items: [
        {
          path: 'instrumentos',
          label: 'Mis formularios',
          icon: ClipboardList,
          counter: 'pendientes',
          children: [
            { path: 'instrumentos', label: 'Todos los formularios', icon: ClipboardList },
            {
              path: 'instrumentos?estado=pendiente',
              label: 'Pendientes',
              icon: FileText,
              counter: 'pendientes',
            },
            {
              path: 'instrumentos?estado=observado',
              label: 'Por corregir',
              icon: ListChecks,
              counter: 'observados',
            },
          ],
        },
        { path: 'sesiones', label: 'Sesiones', icon: CalendarDays, counter: 'sesiones' },
        { path: 'tutor', label: 'Mi tutor', icon: UserCheck },
      ],
    },
    {
      title: 'Información y apoyo',
      items: [
        { path: 'expediente', label: 'Mis estudios', icon: GraduationCap },
        {
          path: 'derivaciones',
          label: 'Solicitudes de apoyo',
          icon: Send,
          counter: 'derivaciones',
          children: [
            { path: 'derivaciones', label: 'Todas las solicitudes de apoyo', icon: Send },
            { path: 'derivaciones?estado=seguimiento', label: 'En seguimiento', icon: Activity },
          ],
        },
        { path: 'salud', label: 'Salud y bienestar', icon: HeartPulse },
        { path: 'documentos', label: 'Documentos', icon: FolderOpen },
      ],
    },
    {
      title: 'Cuenta',
      items: [
        { path: 'avisos', label: 'Avisos', icon: Bell, counter: 'avisos' },
        { path: 'perfil', label: 'Mi perfil', icon: UserRound },
        { path: 'preferencias', label: 'Ajustes de pantalla', icon: Settings2 },
      ],
    },
  ],
  tutor: [
    {
      title: 'Inicio',
      items: [{ path: 'dashboard', label: 'Inicio', icon: LayoutDashboard }],
    },
    {
      title: 'Mi tutoría',
      items: [
        {
          path: 'instrumentos?ambito=propios',
          label: 'Mis formularios',
          icon: ClipboardList,
          counter: 'pendientes',
        },
        {
          path: 'instrumentos?ambito=estudiantes',
          label: 'Respuestas de estudiantes',
          icon: FileText,
          counter: 'revisiones',
        },
      ],
    },
    {
      title: 'Mis estudiantes',
      items: [
        { path: 'tutorados', label: 'Estudiantes', icon: Users },
        {
          path: 'sesiones',
          label: 'Sesiones',
          icon: CalendarCheck,
          counter: 'sesiones',
        },
        { path: 'asistencias', label: 'Asistencias', icon: UserCheck },
        {
          path: 'derivaciones',
          label: 'Solicitudes de apoyo',
          icon: Send,
          counter: 'derivaciones',
          children: [
            { path: 'derivaciones', label: 'Todas las solicitudes de apoyo', icon: Send },
            { path: 'derivaciones?estado=seguimiento', label: 'En seguimiento', icon: Activity },
          ],
        },
      ],
    },
    {
      title: 'Mi trabajo',
      items: [{ path: 'reportes', label: 'Reportes', icon: ChartNoAxesCombined }],
    },
    {
      title: 'Cuenta',
      items: [
        { path: 'avisos', label: 'Avisos', icon: Mail, counter: 'avisos' },
        { path: 'perfil', label: 'Mi perfil', icon: UserRound },
        { path: 'preferencias', label: 'Ajustes de pantalla', icon: Settings2 },
      ],
    },
  ],
  coordinacion: [
    {
      title: 'Inicio',
      items: [{ path: 'dashboard', label: 'Inicio', icon: LayoutDashboard }],
    },
    {
      title: 'Coordinación de tutoría',
      items: [
        { path: 'asignaciones', label: 'Asignar tutores', icon: UserCheck },
        { path: 'tutores', label: 'Tutores', icon: Presentation },
        { path: 'tutorados', label: 'Estudiantes', icon: Users },
        { path: 'plan', label: 'Plan de tutoría', icon: BookOpen },
        {
          path: 'revisiones',
          label: 'Informes',
          icon: ListChecks,
          counter: 'observados',
        },
      ],
    },
    {
      title: 'Seguimiento',
      items: [
        { path: 'reportes', label: 'Reportes', icon: ChartNoAxesCombined },
        { path: 'sesiones', label: 'Sesiones', icon: CalendarCheck, counter: 'sesiones' },
        { path: 'avisos', label: 'Avisos', icon: Mail, counter: 'avisos' },
      ],
    },
    {
      title: 'Administración',
      items: [
        {
          path: 'instrumentos',
          label: 'Formularios',
          icon: Layers,
          children: [
            { path: 'instrumentos', label: 'Formularios y versiones', icon: Layers },
            { path: 'campos', label: 'Preguntas y reglas', icon: SlidersHorizontal },
          ],
        },
        { path: 'permisos', label: 'Accesos y permisos', icon: ShieldCheck },
        { path: 'integraciones', label: 'Datos de otras áreas', icon: Plug },
        { path: 'padron', label: 'Padrón importado', icon: Database },
        { path: 'semestres', label: 'Semestres y fechas', icon: CalendarRange },
        { path: 'auditoria', label: 'Historial de cambios', icon: ScrollText },
      ],
    },
    {
      title: 'Cuenta',
      items: [
        { path: 'perfil', label: 'Mi perfil', icon: UserRound },
        { path: 'preferencias', label: 'Ajustes de pantalla', icon: Settings2 },
      ],
    },
  ],
};

/** Iconos usados fuera de la navegación, agrupados para reutilización. */
export const iconos = {
  Activity,
  Award,
  BookOpen,
  Database,
  FileText,
  GraduationCap,
  History,
  Users,
};
