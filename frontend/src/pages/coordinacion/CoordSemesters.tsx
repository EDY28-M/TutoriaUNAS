import { useId, useMemo, useState } from 'react';
import { Alert } from '../../components/ui/Alert';
import type { EventoCalendario } from '../../components/ui/Calendar';
import { Calendar } from '../../components/ui/Calendar';
import { Card, CardBody, CardFoot, CardHead } from '../../components/ui/Card';
import type { Column } from '../../components/ui/DataTable';
import { DataTable } from '../../components/ui/DataTable';
import {
  CalendarRange,
  Check,
  CircleAlert,
  ClipboardList,
  Flag,
  Hourglass,
  Info,
  Milestone,
} from '../../components/ui/icons';
import { PageHeading } from '../../components/ui/PageHeading';
import { Progress } from '../../components/ui/Progress';
import { Stat } from '../../components/ui/Stat';
import { Badge, StatusBadge } from '../../components/ui/StatusBadge';
import { semestreActual, semestres } from '../../data/catalogos';
import { definicionPorCodigo } from '../../data/formatos';
import { abreviaturaEscuela } from '../../data/personas';
import { usePortal } from '../../hooks/usePortal';
import type { CodigoFormato, Semestre } from '../../types/domain';
import {
  aIso,
  desdeIso,
  formatFecha,
  formatFechaLarga,
  HOY_ISO,
  sumarDias,
} from '../../utils/fechas';

/** Hito del calendario académico del semestre. */
interface HitoSemestre {
  id: string;
  titulo: string;
  fecha: string;
  tipo: 'matricula' | 'academico' | 'tutoria' | 'cierre';
  ambito: string;
  detalle: string;
}

/** Fecha de cierre configurada para un instrumento dentro del semestre. */
interface CierreInstrumento {
  codigo: CodigoFormato;
  etiqueta: string;
  diasDesdeInicio: number;
  diasAntesDelFin: number;
  fecha: string;
  actor: string;
}

/** Calcula los hitos de referencia de un semestre. */
function hitosDe(semestre: Semestre): HitoSemestre[] {
  const fin = desdeIso(semestre.fin);
  const inicio = desdeIso(semestre.inicio);
  return [
    {
      id: `${semestre.id}-matricula-inicio`,
      titulo: 'Inicio de la matrícula',
      fecha: semestre.matriculaInicio,
      tipo: 'matricula',
      ambito: 'DIAA · Sistema de Gestión Académica',
      detalle: 'Apertura del proceso de matrícula del semestre.',
    },
    {
      id: `${semestre.id}-matricula-fin`,
      titulo: 'Cierre de la matrícula',
      fecha: semestre.matriculaFin,
      tipo: 'matricula',
      ambito: 'DIAA · Sistema de Gestión Académica',
      detalle: 'Último día para regularizar la matrícula y la reserva de matrícula.',
    },
    {
      id: `${semestre.id}-inicio`,
      titulo: 'Inicio de clases',
      fecha: semestre.inicio,
      tipo: 'academico',
      ambito: 'Facultades y escuelas profesionales',
      detalle: 'Primer día de actividades académicas del semestre.',
    },
    {
      id: `${semestre.id}-entrevistas`,
      titulo: 'Cierre de las entrevistas iniciales (03, 04 y 05)',
      fecha: aIso(sumarDias(inicio, 30)),
      tipo: 'tutoria',
      ambito: 'Tutoría y Capacitación Docente',
      detalle: 'Plazo referencial para las entrevistas iniciales según la etapa académica.',
    },
    {
      id: `${semestre.id}-registros`,
      titulo: 'Cierre de los registros de asistencia (06 y 07)',
      fecha: aIso(sumarDias(fin, -60)),
      tipo: 'tutoria',
      ambito: 'Docentes tutores',
      detalle:
        'Los registros de asistencia se completan sesión por sesión; esta es la fecha de consolidación.',
    },
    {
      id: `${semestre.id}-informe-tutor`,
      titulo: 'Presentación del informe del tutor (02)',
      fecha: aIso(sumarDias(fin, -35)),
      tipo: 'cierre',
      ambito: 'Docentes tutores · revisión de la coordinación',
      detalle: 'Informe de actividades del semestre con cobertura, sesiones y casos derivados.',
    },
    {
      id: `${semestre.id}-autoevaluacion`,
      titulo: 'Autoevaluación de la actividad tutorial (09)',
      fecha: aIso(sumarDias(fin, -30)),
      tipo: 'cierre',
      ambito: 'Docentes tutores',
      detalle: 'Instrumento opcional de mejora continua de la labor tutorial.',
    },
    {
      id: `${semestre.id}-evaluaciones`,
      titulo: 'Evaluaciones del estudiante (10 y 11)',
      fecha: aIso(sumarDias(fin, -15)),
      tipo: 'cierre',
      ambito: 'Tutorados',
      detalle: 'Evaluación de la tutoría individual y del desempeño de la tutoría grupal.',
    },
    {
      id: `${semestre.id}-informe-consolidado`,
      titulo: 'Informe consolidado de la comisión (01)',
      fecha: aIso(sumarDias(fin, -10)),
      tipo: 'cierre',
      ambito: 'Comisión de tutoría de la escuela',
      detalle: 'Consolidado por escuela a partir de los informes 02 aprobados.',
    },
    {
      id: `${semestre.id}-fin`,
      titulo: 'Fin del semestre académico',
      fecha: semestre.fin,
      tipo: 'academico',
      ambito: 'Facultades y escuelas profesionales',
      detalle: 'Cierre del periodo académico y entrega de actas.',
    },
  ];
}

/** Avance del semestre calculado con la fecha de corte de la demostración. */
function avanceDe(semestre: Semestre): number {
  const inicio = desdeIso(semestre.inicio).getTime();
  const fin = desdeIso(semestre.fin).getTime();
  const hoy = desdeIso(HOY_ISO).getTime();
  if (hoy <= inicio) return 0;
  if (hoy >= fin) return 100;
  return Math.round(((hoy - inicio) / (fin - inicio)) * 100);
}

/** Texto legible del estado del semestre. */
function textoEstado(estado: Semestre['estado']): string {
  if (estado === 'en-curso') return 'En curso';
  if (estado === 'cerrado') return 'Cerrado';
  return 'Planificado';
}

/** Cierres de instrumentos configurados para el semestre elegido. */
function cierresDe(semestre: Semestre): CierreInstrumento[] {
  const inicio = desdeIso(semestre.inicio);
  const fin = desdeIso(semestre.fin);
  const configurados: Array<{
    codigo: CodigoFormato;
    etiqueta: string;
    diasDesdeInicio: number;
    diasAntesDelFin: number;
  }> = [
    {
      codigo: 'F03',
      etiqueta: 'Entrevista inicial al ingresante',
      diasDesdeInicio: 30,
      diasAntesDelFin: 0,
    },
    {
      codigo: 'F04',
      etiqueta: 'Entrevista inicial a ciclos intermedios',
      diasDesdeInicio: 30,
      diasAntesDelFin: 0,
    },
    {
      codigo: 'F05',
      etiqueta: 'Entrevista inicial a ciclos finales',
      diasDesdeInicio: 30,
      diasAntesDelFin: 0,
    },
    {
      codigo: 'F06',
      etiqueta: 'Registro de asistencia individual',
      diasDesdeInicio: 0,
      diasAntesDelFin: 60,
    },
    {
      codigo: 'F07',
      etiqueta: 'Registro de asistencia grupal',
      diasDesdeInicio: 0,
      diasAntesDelFin: 60,
    },
    { codigo: 'F08', etiqueta: 'Atención personalizada', diasDesdeInicio: 0, diasAntesDelFin: 45 },
    {
      codigo: 'F09',
      etiqueta: 'Autoevaluación del tutor',
      diasDesdeInicio: 0,
      diasAntesDelFin: 30,
    },
    {
      codigo: 'F02',
      etiqueta: 'Informe de actividades del tutor',
      diasDesdeInicio: 0,
      diasAntesDelFin: 35,
    },
    {
      codigo: 'F10',
      etiqueta: 'Evaluación de la tutoría individual',
      diasDesdeInicio: 0,
      diasAntesDelFin: 15,
    },
    {
      codigo: 'F11',
      etiqueta: 'Evaluación de la tutoría grupal',
      diasDesdeInicio: 0,
      diasAntesDelFin: 15,
    },
    {
      codigo: 'F01',
      etiqueta: 'Informe consolidado de la comisión',
      diasDesdeInicio: 0,
      diasAntesDelFin: 10,
    },
  ];
  return configurados.map((item) => {
    const definicion = definicionPorCodigo(item.codigo);
    const fecha =
      item.diasDesdeInicio > 0
        ? aIso(sumarDias(inicio, item.diasDesdeInicio))
        : aIso(sumarDias(fin, -item.diasAntesDelFin));
    return {
      codigo: item.codigo,
      etiqueta: item.etiqueta,
      diasDesdeInicio: item.diasDesdeInicio,
      diasAntesDelFin: item.diasAntesDelFin,
      fecha,
      actor: definicion?.actorEtiqueta ?? 'Por definir',
    };
  });
}

/**
 * Semestres académicos e hitos: matrícula, inicio y fin de clases, fechas de
 * cierre de los instrumentos y calendario del semestre seleccionado, con el
 * avance del periodo y las condiciones de cada hito.
 */
export function CoordSemesters() {
  const portal = usePortal();
  const idSelector = useId();
  const [seleccionado, setSeleccionado] = useState(semestreActual);

  const semestre = semestres.find((item) => item.id === seleccionado) ?? semestres[0];
  const hitos = useMemo(() => (semestre ? hitosDe(semestre) : []), [semestre]);
  const cierres = useMemo(() => (semestre ? cierresDe(semestre) : []), [semestre]);

  const eventos = useMemo<EventoCalendario[]>(() => {
    const deHitos = hitos.map((hito) => ({
      id: hito.id,
      fecha: hito.fecha,
      titulo: hito.titulo,
      tono:
        hito.tipo === 'matricula'
          ? ('dorado' as const)
          : hito.tipo === 'tutoria'
            ? ('verde' as const)
            : hito.tipo === 'cierre'
              ? ('violeta' as const)
              : ('info' as const),
      detalle: `${hito.detalle} · ${hito.ambito}`,
      etiqueta:
        hito.tipo === 'matricula'
          ? 'Matrícula'
          : hito.tipo === 'tutoria'
            ? 'Tutoría'
            : hito.tipo === 'cierre'
              ? 'Cierre de formularios'
              : 'Académico',
    }));
    const deCierres = cierres.map((cierre) => ({
      id: `${semestre?.id ?? 'S'}-${cierre.codigo}`,
      fecha: cierre.fecha,
      titulo: `Cierre ${cierre.codigo} · ${cierre.etiqueta}`,
      tono: 'riesgo' as const,
      detalle: `Fecha de cierre configurada · responde ${cierre.actor} · ${formatFechaLarga(cierre.fecha)}`,
      etiqueta: 'Cierre de formulario',
    }));
    return [...deHitos, ...deCierres];
  }, [cierres, hitos, semestre]);

  const activo = semestres.find((item) => item.estado === 'en-curso') ?? semestres[0];
  const proximoHito = hitos
    .filter((hito) => hito.fecha >= HOY_ISO)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
  const duracionSemanas = semestre
    ? Math.round(
        (desdeIso(semestre.fin).getTime() - desdeIso(semestre.inicio).getTime()) / (7 * 86_400_000),
      )
    : 0;
  const diasParaCierre = proximoHito
    ? Math.max(
        0,
        Math.round(
          (desdeIso(proximoHito.fecha).getTime() - desdeIso(HOY_ISO).getTime()) / 86_400_000,
        ),
      )
    : 0;

  const columnasHitos: Column<HitoSemestre>[] = [
    {
      key: 'fecha',
      header: 'Fecha',
      sortable: true,
      sortValue: (hito) => hito.fecha,
      render: (hito) => (
        <span className="nowrap cell-mono">
          {formatFecha(hito.fecha)}
          {hito.fecha === HOY_ISO && <Badge tone="dorado">Hoy</Badge>}
        </span>
      ),
    },
    {
      key: 'titulo',
      header: 'Hito',
      sortable: true,
      sortValue: (hito) => hito.titulo,
      render: (hito) => (
        <span className="stack" style={{ gap: 1 }}>
          <strong className="cell-strong">{hito.titulo}</strong>
          <span className="cell-note">{hito.detalle}</span>
        </span>
      ),
    },
    {
      key: 'tipo',
      header: 'Tipo',
      sortable: true,
      sortValue: (hito) => hito.tipo,
      render: (hito) => (
        <Badge
          tone={
            hito.tipo === 'matricula'
              ? 'dorado'
              : hito.tipo === 'tutoria'
                ? 'ok'
                : hito.tipo === 'cierre'
                  ? 'violeta'
                  : 'info'
          }
        >
          {hito.tipo === 'matricula'
            ? 'Matrícula'
            : hito.tipo === 'tutoria'
              ? 'Tutoría'
              : hito.tipo === 'cierre'
                ? 'Cierre'
                : 'Académico'}
        </Badge>
      ),
    },
    {
      key: 'ambito',
      header: 'Corresponde a responsable',
      render: (hito) => <span className="cell-note">{hito.ambito}</span>,
    },
    {
      key: 'situacion',
      header: 'Situación',
      sortable: true,
      sortValue: (hito) => hito.fecha,
      render: (hito) =>
        hito.fecha < HOY_ISO ? (
          <Badge tone="ok">
            <Check aria-hidden="true" /> Cumplido
          </Badge>
        ) : hito.fecha === HOY_ISO ? (
          <Badge tone="dorado">Hoy</Badge>
        ) : (
          <Badge tone="info">Programado</Badge>
        ),
    },
  ];

  const columnasCierres: Column<CierreInstrumento>[] = [
    {
      key: 'instrumento',
      header: 'Formulario',
      sortable: true,
      sortValue: (cierre) => cierre.codigo,
      render: (cierre) => (
        <span className="stack" style={{ gap: 1 }}>
          <strong className="cell-strong">{cierre.codigo}</strong>
          <span className="cell-note">{cierre.etiqueta}</span>
        </span>
      ),
    },
    {
      key: 'actor',
      header: 'Quién lo completa',
      render: (cierre) => cierre.actor,
    },
    {
      key: 'fecha',
      header: 'Fecha de cierre',
      sortable: true,
      sortValue: (cierre) => cierre.fecha,
      render: (cierre) => <span className="nowrap cell-mono">{formatFecha(cierre.fecha)}</span>,
    },
    {
      key: 'situacion',
      header: 'Situación',
      sortable: true,
      sortValue: (cierre) => cierre.fecha,
      render: (cierre) =>
        cierre.fecha < HOY_ISO ? (
          <Badge tone="ok">Plazo cumplido</Badge>
        ) : (
          <Badge tone="alerta">
            <Hourglass aria-hidden="true" /> Abierto
          </Badge>
        ),
    },
    {
      key: 'regla',
      header: 'Condición',
      render: (cierre) => (
        <span className="cell-note">
          {cierre.diasDesdeInicio > 0
            ? `${cierre.diasDesdeInicio} días después del inicio de clases`
            : `${cierre.diasAntesDelFin} días antes del fin del semestre`}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeading
        eyebrow={`Gestión institucional · Semestres e hitos · ${abreviaturaEscuela(portal.escuelaId)}`}
        title="Semestres y fechas"
        description="Consulta las fechas de matrícula, las actividades de tutoría y los plazos de entrega."
        actions={
          <>
            <Badge tone="info">{semestres.length} semestres registrados</Badge>
            {activo && (
              <Badge tone={activo.estado === 'en-curso' ? 'ok' : 'neutro'}>
                {activo.nombre} · {textoEstado(activo.estado)}
              </Badge>
            )}
          </>
        }
      />

      <Card>
        <CardHead
          title="Elegir semestre"
          description="Elige un semestre para consultar sus fechas y plazos."
          actions={
            <div className="field" style={{ minWidth: 260 }}>
              <label htmlFor={idSelector}>Semestre académico</label>
              <select
                id={idSelector}
                className="select"
                value={seleccionado}
                onChange={(evento) => setSeleccionado(evento.target.value)}
              >
                {semestres.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nombre} · {textoEstado(item.estado)}
                  </option>
                ))}
              </select>
            </div>
          }
        />
        <CardBody>
          <ul className="list">
            {semestres.map((item) => (
              <li className="list__item" key={item.id}>
                <div className="list__body">
                  <strong>{item.nombre}</strong>
                  <p>
                    Clases del {formatFecha(item.inicio)} al {formatFecha(item.fin)} · matrícula del{' '}
                    {formatFecha(item.matriculaInicio)} al {formatFecha(item.matriculaFin)}
                  </p>
                  <Progress
                    valor={avanceDe(item)}
                    etiqueta={`Avance del periodo · ${item.nombre}`}
                    variante={item.estado === 'cerrado' ? 'dorado' : 'verde'}
                  />
                </div>
                <div className="list__aside">
                  {item.id === seleccionado ? (
                    <Badge tone="ok">
                      <Check aria-hidden="true" /> Seleccionado
                    </Badge>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-falcon-default btn-sm"
                      onClick={() => setSeleccionado(item.id)}
                    >
                      Ver calendario
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      {semestre && (
        <>
          <div className="grid grid--4">
            <Stat
              label="Estado del semestre"
              value={textoEstado(semestre.estado)}
              note={`${semestre.nombre} · ${duracionSemanas} semanas de clases`}
              icon={<CalendarRange aria-hidden="true" />}
              tone={semestre.estado === 'en-curso' ? 'verde' : 'info'}
            />
            <Stat
              label="Avance del periodo"
              value={`${avanceDe(semestre)}%`}
              note={`Corte al ${formatFecha(HOY_ISO)}`}
              icon={<Milestone aria-hidden="true" />}
              tone="dorado"
            />
            <Stat
              label="Ventana de matrícula"
              value={`${formatFecha(semestre.matriculaInicio)}`}
              note={`Hasta el ${formatFecha(semestre.matriculaFin)}`}
              icon={<ClipboardList aria-hidden="true" />}
              tone="violeta"
            />
            <Stat
              label="Próximo hito"
              value={proximoHito ? formatFecha(proximoHito.fecha) : 'Sin hitos'}
              note={
                proximoHito
                  ? `${proximoHito.titulo} · en ${diasParaCierre} día(s)`
                  : 'Semestre concluido'
              }
              icon={<Flag aria-hidden="true" />}
              tone={diasParaCierre <= 15 ? 'alerta' : 'verde'}
            />
          </div>

          {semestre.estado === 'en-curso' && proximoHito && diasParaCierre <= 15 && (
            <Alert
              tone="alerta"
              title={`El hito «${proximoHito.titulo}» vence en ${diasParaCierre} día(s)`}
            >
              <Hourglass aria-hidden="true" /> Recuerde a los docentes tutores y a la comisión las
              fechas de cierre de los formularios. Los avisos automáticos se habilitarán cuando la
              OTIC configure el correo institucional.
            </Alert>
          )}

          <Card>
            <CardHead
              title={`Calendario del semestre ${semestre.nombre}`}
              description="Matrícula, hitos académicos, cierres de formularios y fin del periodo."
              actions={<Badge tone="dorado">{eventos.length} eventos</Badge>}
            />
            <CardBody>
              <Calendar
                eventos={eventos}
                etiqueta={`Calendario académico ${semestre.nombre}`}
                mesInicial={semestre.inicio}
                vistaInicial="mes"
                maxPorDia={2}
              />
            </CardBody>
            <CardFoot>
              <span>
                Los eventos violeta y rojo corresponden a cierres de formularios configurados en el
                sistema.
              </span>
            </CardFoot>
          </Card>

          <Card>
            <CardHead
              title="Fechas importantes"
              description="Fechas, tipo y ámbito responsable de cada hito del periodo."
            />
            <CardBody flush>
              <DataTable<HitoSemestre>
                rows={hitos}
                columns={columnasHitos}
                caption={`Fechas importantes${semestre.nombre}`}
                rowKey={(hito) => hito.id}
                pageSize={10}
                initialSort={{ key: 'fecha', direction: 'asc' }}
              />
            </CardBody>
            <CardFoot>
              <span>
                Inicio de clases: {formatFechaLarga(semestre.inicio)} · Fin del periodo:{' '}
                {formatFechaLarga(semestre.fin)}
              </span>
            </CardFoot>
          </Card>

          <Card>
            <CardHead
              title="Fechas de cierre de formularios"
              description="Plazo referencial configurado por formulario dentro del semestre."
              actions={<Badge tone="alerta">Plazos por confirmar</Badge>}
            />
            <CardBody flush>
              <DataTable<CierreInstrumento>
                rows={cierres}
                columns={columnasCierres}
                caption={`Cierres de formularios del semestre ${semestre.nombre}`}
                rowKey={(cierre) => cierre.codigo}
                pageSize={11}
                initialSort={{ key: 'fecha', direction: 'asc' }}
              />
            </CardBody>
            <CardFoot>
              <span>
                <Info aria-hidden="true" /> Los plazos son referenciales: la vigencia y las reglas
                de llenado esperan confirmación de Tutoría y Capacitación Docente.
              </span>
            </CardFoot>
          </Card>

          <div className="grid grid--2">
            <Card accent>
              <CardHead
                title="Datos del semestre"
                description="Inicio, fin y fechas de matrícula."
              />
              <CardBody>
                <dl className="def-list">
                  <div>
                    <dt>Semestre</dt>
                    <dd>
                      {semestre.nombre} · {textoEstado(semestre.estado)}
                    </dd>
                  </div>
                  <div>
                    <dt>Duración</dt>
                    <dd>{duracionSemanas} semanas entre el inicio y el fin de clases</dd>
                  </div>
                  <div>
                    <dt>Matrícula</dt>
                    <dd>
                      Del {formatFecha(semestre.matriculaInicio)} al{' '}
                      {formatFecha(semestre.matriculaFin)} (fuente: DIAA)
                    </dd>
                  </div>
                  <div>
                    <dt>Fechas de cierre</dt>
                    <dd>
                      Las entrevistas iniciales cierran a los 30 días del inicio; los informes de
                      cierre, en el último mes del semestre.
                    </dd>
                  </div>
                  <div>
                    <dt>Matrícula condicionada</dt>
                    <dd>
                      No se configura como restricción automática; requiere disposición expresa de
                      la autoridad (pendiente de validación).
                    </dd>
                  </div>
                </dl>
              </CardBody>
            </Card>

            <Card>
              <CardHead
                title="Comparar semestres"
                description="Duración, estado y avance de cada periodo registrado"
              />
              <CardBody>
                <div className="stack">
                  {semestres.map((item) => (
                    <div className="stack stack--sm" key={`${item.id}-comparado`}>
                      <div className="ui-row ui-row--between ui-row--wrap">
                        <span className="small">
                          <strong>{item.nombre}</strong>
                          <span className="muted">
                            {' '}
                            · {formatFecha(item.inicio)} → {formatFecha(item.fin)}
                          </span>
                        </span>
                        <StatusBadge estado={item.estado} etiqueta={textoEstado(item.estado)} />
                      </div>
                      <Progress
                        valor={avanceDe(item)}
                        mostrarValor
                        variante={item.estado === 'cerrado' ? 'dorado' : 'verde'}
                      />
                    </div>
                  ))}
                </div>
                <Alert tone="info" title="Semestre usado en esta demostración">
                  <CircleAlert aria-hidden="true" /> El sistema opera con datos ficticios del
                  semestre {semestreActual}. Los demás periodos muestran la estructura de calendario
                  y cierres para cuando se cargue el histórico.
                </Alert>
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
