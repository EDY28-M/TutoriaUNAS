import type { ReactNode } from 'react';

export type TonoBadge = 'neutro' | 'ok' | 'alerta' | 'riesgo' | 'info' | 'violeta' | 'dorado';

interface BadgeProps {
  children: ReactNode;
  tone?: TonoBadge;
  icon?: ReactNode;
  mono?: boolean;
}

const clases: Record<TonoBadge, string> = {
  neutro: '',
  ok: 'badge--ok',
  alerta: 'badge--warn',
  riesgo: 'badge--danger',
  info: 'badge--info',
  violeta: 'badge--violet',
  dorado: 'badge--gold',
};

export function Badge({ children, tone = 'neutro', icon, mono = false }: BadgeProps) {
  const clasesFinales = ['badge', clases[tone], mono ? 'badge--mono' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <span className={clasesFinales}>
      {icon}
      {children}
    </span>
  );
}

/* ==========================================================================
   Mapas de estado del dominio a insignias
   ========================================================================== */

type Mapa = Record<string, { texto: string; tono: TonoBadge }>;

const ESTADO_INSTRUMENTO: Mapa = {
  'no-iniciado': { texto: 'Sin iniciar', tono: 'neutro' },
  borrador: { texto: 'Borrador', tono: 'alerta' },
  enviado: { texto: 'Enviado', tono: 'info' },
  observado: { texto: 'Observado', tono: 'riesgo' },
  aprobado: { texto: 'Aprobado', tono: 'ok' },
  vencido: { texto: 'Vencido', tono: 'riesgo' },
};

const ESTADO_DERIVACION: Mapa = {
  registrada: { texto: 'Registrada', tono: 'neutro' },
  recibida: { texto: 'Recibida por el área', tono: 'info' },
  citada: { texto: 'Cita programada', tono: 'info' },
  'en-atencion': { texto: 'En atención', tono: 'violeta' },
  atendida: { texto: 'Atendida', tono: 'ok' },
  seguimiento: { texto: 'En seguimiento', tono: 'violeta' },
  cerrada: { texto: 'Cerrada', tono: 'ok' },
  'no-presentado': { texto: 'No se presentó', tono: 'riesgo' },
};

const ESTADO_SESION: Mapa = {
  programada: { texto: 'Programada', tono: 'info' },
  realizada: { texto: 'Realizada', tono: 'ok' },
  cancelada: { texto: 'Cancelada', tono: 'riesgo' },
};

const ESTADO_ASISTENCIA: Mapa = {
  asistio: { texto: 'Asistió', tono: 'ok' },
  tarde: { texto: 'Tarde', tono: 'alerta' },
  falto: { texto: 'Faltó', tono: 'riesgo' },
  justificado: { texto: 'Justificado', tono: 'info' },
};

const ESTADO_ACADEMICO: Mapa = {
  regular: { texto: 'Regular', tono: 'ok' },
  observado: { texto: 'Observado', tono: 'alerta' },
  reserva: { texto: 'Reserva', tono: 'info' },
  retirado: { texto: 'Retirado', tono: 'riesgo' },
  egresado: { texto: 'Egresado', tono: 'violeta' },
  ingresante: { texto: 'Ingresante', tono: 'info' },
};

const NIVEL_ALERTA: Mapa = {
  alta: { texto: 'Prioridad alta', tono: 'riesgo' },
  media: { texto: 'Prioridad media', tono: 'alerta' },
  baja: { texto: 'Prioridad baja', tono: 'info' },
};

const ESTADO_GENERICO: Mapa = {
  activa: { texto: 'Activa', tono: 'ok' },
  activo: { texto: 'Activo', tono: 'ok' },
  finalizada: { texto: 'Finalizada', tono: 'neutro' },
  finalizado: { texto: 'Finalizado', tono: 'neutro' },
  reemplazada: { texto: 'Reemplazada', tono: 'alerta' },
  suspendido: { texto: 'Suspendido', tono: 'riesgo' },
  'en-evaluacion': { texto: 'En evaluación', tono: 'info' },
  entregado: { texto: 'Entregado', tono: 'ok' },
  parcial: { texto: 'Entrega parcial', tono: 'alerta' },
  pendiente: { texto: 'Pendiente', tono: 'neutro' },
  'no-autorizado': { texto: 'No autorizado', tono: 'riesgo' },
  validada: { texto: 'Validada', tono: 'ok' },
  propuesta: { texto: 'Propuesta', tono: 'info' },
  'pendiente-validacion': { texto: 'Pendiente de validación', tono: 'alerta' },
  planificada: { texto: 'Planificada', tono: 'info' },
  'en-ejecucion': { texto: 'En ejecución', tono: 'violeta' },
  culminada: { texto: 'Culminada', tono: 'ok' },
  reprogramada: { texto: 'Reprogramada', tono: 'alerta' },
  programado: { texto: 'Programado', tono: 'info' },
  fallido: { texto: 'Fallido', tono: 'riesgo' },
  abierta: { texto: 'Observación abierta', tono: 'riesgo' },
  subsanada: { texto: 'Corregida', tono: 'ok' },
  'en-curso': { texto: 'En curso', tono: 'info' },
  aprobado: { texto: 'Aprobado', tono: 'ok' },
  desaprobado: { texto: 'Desaprobado', tono: 'riesgo' },
  retiro: { texto: 'Retiro', tono: 'riesgo' },
  matriculado: { texto: 'Matriculado', tono: 'ok' },
  'no-matriculado': { texto: 'No matriculado', tono: 'neutro' },
  'no-asistio': { texto: 'No asistió', tono: 'riesgo' },
  cumplido: { texto: 'Cumplido', tono: 'ok' },
  vencido: { texto: 'Vencido', tono: 'riesgo' },
  alta: { texto: 'Prioridad alta', tono: 'riesgo' },
  media: { texto: 'Prioridad media', tono: 'alerta' },
  baja: { texto: 'Prioridad baja', tono: 'info' },
};

const MAPAS: Mapa[] = [
  ESTADO_INSTRUMENTO,
  ESTADO_DERIVACION,
  ESTADO_SESION,
  ESTADO_ASISTENCIA,
  ESTADO_ACADEMICO,
  NIVEL_ALERTA,
  ESTADO_GENERICO,
];

/** Insignia de estado a partir del valor almacenado en el dominio. */
export function StatusBadge({
  estado,
  etiqueta,
  contexto,
}: {
  estado: string;
  etiqueta?: string;
  contexto?: 'formulario';
}) {
  if (contexto === 'formulario' && estado === 'observado') {
    return <Badge tone="riesgo">{etiqueta ?? 'Por corregir'}</Badge>;
  }
  for (const mapa of MAPAS) {
    const encontrado = mapa[estado];
    if (encontrado) return <Badge tone={encontrado.tono}>{etiqueta ?? encontrado.texto}</Badge>;
  }
  return <Badge>{etiqueta ?? estado}</Badge>;
}
