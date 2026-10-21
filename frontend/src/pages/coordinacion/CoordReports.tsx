import { useId, useMemo, useState } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Card, CardBody, CardFoot, CardHead } from '../../components/ui/Card';
import type { Column } from '../../components/ui/DataTable';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  ClipboardList,
  Download,
  GraduationCap,
  Percent,
  Presentation,
  ScrollText,
  Send,
  UserCheck,
  Users,
} from '../../components/ui/icons';
import { PageHeading } from '../../components/ui/PageHeading';
import { Meter } from '../../components/ui/Progress';
import { Stat } from '../../components/ui/Stat';
import { Badge, StatusBadge } from '../../components/ui/StatusBadge';
import { areasDerivacion, escuelas, semestreActual, semestres } from '../../data/catalogos';
import { estadosDerivacionAbiertos } from '../../data/derivaciones';
import { abreviaturaEscuela, docentePorId, escuelaDe } from '../../data/personas';
import { actividadesPlan, asignaciones } from '../../data/tutoria';
import { usePortal } from '../../hooks/usePortal';
import type { EstadoInstrumento } from '../../types/domain';
import { downloadCsv, encodeCsv } from '../../utils/csv';

const ESTADOS_INSTRUMENTO: EstadoInstrumento[] = [
  'no-iniciado',
  'borrador',
  'enviado',
  'observado',
  'aprobado',
  'vencido',
];

/** Indicadores del proceso tutorial de una escuela. */
interface Indicadores {
  escuelaId: string;
  tutores: number;
  asignados: number;
  atendidos: number;
  atenciones: number;
  sesiones: number;
  sesionesProgramadas: number;
  cobertura: number;
  informesPorRevisar: number;
  derivaciones: number;
  derivacionesAbiertas: number;
  avancePlan: number;
}

/** Cuenta si la asistencia registrada equivale a una atención efectiva. */
function cuentaComoAtencion(estado: string): boolean {
  return estado === 'asistio' || estado === 'tarde';
}

/** Calcula los indicadores del proceso tutorial de una escuela y semestre. */
function indicadoresDe(
  escuelaId: string,
  semestreId: string,
  alcance: ReturnType<typeof usePortal>,
): Indicadores {
  const { sesiones, instrumentos, derivaciones } = alcance;
  const propias = asignaciones.filter(
    (asignacion) =>
      asignacion.escuelaId === escuelaId &&
      asignacion.semestreId === semestreId &&
      asignacion.estado !== 'reemplazada',
  );
  const estudiantesId = new Set(propias.map((asignacion) => asignacion.estudianteId));
  const delAlcance = sesiones.filter(
    (sesion) =>
      sesion.semestreId === semestreId &&
      sesion.asistentes.some((asistente) => estudiantesId.has(asistente.estudianteId)),
  );
  const realizadas = delAlcance.filter((sesion) => sesion.estado === 'realizada');
  const atendidos = new Set<string>();
  let atenciones = 0;
  for (const sesion of realizadas) {
    for (const asistente of sesion.asistentes) {
      if (estudiantesId.has(asistente.estudianteId) && cuentaComoAtencion(asistente.estado)) {
        atendidos.add(asistente.estudianteId);
        atenciones += 1;
      }
    }
  }
  const informes = instrumentos.filter((instrumento) => {
    if (instrumento.semestreId !== semestreId) return false;
    if (instrumento.formato !== 'F01' && instrumento.formato !== 'F02') return false;
    const declarada = instrumento.formato === 'F01' ? instrumento.respuestas['escuela'] : undefined;
    const pertenece =
      declarada === escuelaId ||
      (!declarada && docentePorId(instrumento.tutorId)?.escuelaId === escuelaId);
    return pertenece && instrumento.estado === 'enviado';
  });
  const derivacionesEscuela = derivaciones.filter(
    (derivacion) =>
      derivacion.semestreId === semestreId && estudiantesId.has(derivacion.estudianteId),
  );
  const actividades = actividadesPlan.filter(
    (actividad) => actividad.escuelaId === escuelaId && actividad.semestreId === semestreId,
  );

  return {
    escuelaId,
    tutores: new Set(propias.map((asignacion) => asignacion.tutorId)).size,
    asignados: propias.length,
    atendidos: atendidos.size,
    atenciones,
    sesiones: realizadas.length,
    sesionesProgramadas: delAlcance.filter((sesion) => sesion.estado === 'programada').length,
    cobertura: propias.length ? Math.round((atendidos.size / propias.length) * 100) : 0,
    informesPorRevisar: informes.length,
    derivaciones: derivacionesEscuela.length,
    derivacionesAbiertas: derivacionesEscuela.filter((derivacion) =>
      estadosDerivacionAbiertos.includes(derivacion.estado),
    ).length,
    avancePlan: actividades.length
      ? Math.round(
          actividades.reduce((total, actividad) => total + actividad.avance, 0) /
            actividades.length,
        )
      : 0,
  };
}

/**
 * Reportes e indicadores de la coordinación: comparación por escuela y semestre
 * de tutores, estudiantes asignados y atendidos, atenciones, sesiones,
 * cobertura, instrumentos por estado, derivaciones por área y motivos
 * frecuentes, con descarga en CSV.
 */
export function CoordReports() {
  const portal = usePortal();
  const { instrumentos, derivaciones } = portal;
  const idEscuela = useId();
  const idSemestre = useId();

  const [escuelaId, setEscuelaId] = useState(portal.escuelaId);
  const [semestreId, setSemestreId] = useState(semestreActual);
  const [ultimaExportacion, setUltimaExportacion] = useState<{
    filas: number;
    caracteres: number;
  } | null>(null);

  const porEscuela = useMemo<Indicadores[]>(
    () =>
      escuelas
        .map((escuela) => indicadoresDe(escuela.id, semestreId, portal))
        .sort((a, b) => b.cobertura - a.cobertura),
    [semestreId, portal],
  );

  const actual = porEscuela.find((fila) => fila.escuelaId === escuelaId) ?? porEscuela[0];
  const totales = porEscuela.reduce(
    (acumulado, fila) => ({
      tutores: acumulado.tutores + fila.tutores,
      asignados: acumulado.asignados + fila.asignados,
      atendidos: acumulado.atendidos + fila.atendidos,
      atenciones: acumulado.atenciones + fila.atenciones,
      sesiones: acumulado.sesiones + fila.sesiones,
      programas: acumulado.programas + fila.sesionesProgramadas,
    }),
    { tutores: 0, asignados: 0, atendidos: 0, atenciones: 0, sesiones: 0, programas: 0 },
  );
  const coberturaGlobal = totales.asignados
    ? Math.round((totales.atendidos / totales.asignados) * 100)
    : 0;

  const instrumentosDelAlcance = instrumentos.filter(
    (instrumento) => instrumento.semestreId === semestreId,
  );
  const instrumentosPorEstado = ESTADOS_INSTRUMENTO.map((estado) => ({
    estado,
    total: instrumentosDelAlcance.filter((instrumento) => instrumento.estado === estado).length,
  })).filter((fila) => fila.total > 0);

  const derivacionesDelAlcance = derivaciones.filter(
    (derivacion) => derivacion.semestreId === semestreId,
  );
  const porArea = areasDerivacion
    .map((area) => {
      const total = derivacionesDelAlcance.filter((derivacion) => derivacion.area === area.id);
      return {
        area,
        total: total.length,
        abiertas: total.filter((derivacion) =>
          estadosDerivacionAbiertos.includes(derivacion.estado),
        ).length,
        cerradas: total.filter((derivacion) => derivacion.estado === 'cerrada').length,
      };
    })
    .sort((a, b) => b.total - a.total);

  const porEstadoDerivacion = Object.entries(
    derivacionesDelAlcance.reduce<Record<string, number>>((acumulado, derivacion) => {
      acumulado[derivacion.estado] = (acumulado[derivacion.estado] ?? 0) + 1;
      return acumulado;
    }, {}),
  ).sort(([, a], [, b]) => b - a);

  const motivos = Object.entries(
    derivacionesDelAlcance.reduce<Record<string, number>>((acumulado, derivacion) => {
      acumulado[derivacion.motivo] = (acumulado[derivacion.motivo] ?? 0) + 1;
      return acumulado;
    }, {}),
  ).sort(([, a], [, b]) => b - a);

  function exportar() {
    const filas: string[][] = [
      ['Reporte institucional de tutoría', `Semestre ${semestreId}`],
      [],
      [
        'Escuela',
        'Tutores',
        'Estudiantes asignados',
        'Estudiantes únicos atendidos',
        'Atenciones acumuladas',
        'Sesiones realizadas',
        'Sesiones programadas',
        'Cobertura %',
        'Informes por revisar',
        'Derivaciones',
        'Derivaciones abiertas',
        'Avance del plan %',
      ],
    ];
    for (const fila of porEscuela) {
      filas.push([
        `${abreviaturaEscuela(fila.escuelaId)} · ${escuelaDe(fila.escuelaId)}`,
        String(fila.tutores),
        String(fila.asignados),
        String(fila.atendidos),
        String(fila.atenciones),
        String(fila.sesiones),
        String(fila.sesionesProgramadas),
        String(fila.cobertura),
        String(fila.informesPorRevisar),
        String(fila.derivaciones),
        String(fila.derivacionesAbiertas),
        String(fila.avancePlan),
      ]);
    }
    filas.push([]);
    filas.push(['Instrumentos por estado', 'Total']);
    for (const fila of instrumentosPorEstado) {
      filas.push([fila.estado, String(fila.total)]);
    }
    filas.push([]);
    filas.push(['Derivaciones por área', 'Total', 'Abiertas', 'Cerradas']);
    for (const fila of porArea) {
      filas.push([
        fila.area.nombre,
        String(fila.total),
        String(fila.abiertas),
        String(fila.cerradas),
      ]);
    }
    filas.push([]);
    filas.push(['Motivo de derivación', 'Casos']);
    for (const [motivo, total] of motivos) {
      filas.push([motivo, String(total)]);
    }
    // Se codifica el CSV antes de descargarlo para informar el tamaño del archivo.
    const contenido = encodeCsv(filas);
    setUltimaExportacion({
      filas: contenido.split('\r\n').length,
      caracteres: contenido.length,
    });
    downloadCsv(filas, `reporte-tutoria-${semestreId}.csv`);
  }

  const columnas: Column<Indicadores>[] = [
    {
      key: 'escuela',
      header: 'Escuela',
      sortable: true,
      sortValue: (fila) => abreviaturaEscuela(fila.escuelaId),
      render: (fila) => (
        <span className="stack" style={{ gap: 1 }}>
          <strong className="cell-strong">{abreviaturaEscuela(fila.escuelaId)}</strong>
          <span className="cell-note">{escuelaDe(fila.escuelaId)}</span>
        </span>
      ),
    },
    {
      key: 'tutores',
      header: 'Tutores',
      sortable: true,
      sortValue: (fila) => fila.tutores,
      render: (fila) => fila.tutores,
    },
    {
      key: 'asignados',
      header: 'Asignados',
      sortable: true,
      sortValue: (fila) => fila.asignados,
      render: (fila) => fila.asignados,
    },
    {
      key: 'atendidos',
      header: 'Únicos atendidos',
      sortable: true,
      sortValue: (fila) => fila.atendidos,
      render: (fila) => (
        <span className="stack" style={{ gap: 1 }}>
          <span className="num">{fila.atendidos}</span>
          <span className="cell-note">de {fila.asignados} asignados</span>
        </span>
      ),
    },
    {
      key: 'atenciones',
      header: 'Atenciones',
      sortable: true,
      sortValue: (fila) => fila.atenciones,
      render: (fila) => fila.atenciones,
    },
    {
      key: 'sesiones',
      header: 'Sesiones',
      sortable: true,
      sortValue: (fila) => fila.sesiones,
      render: (fila) => (
        <span className="stack" style={{ gap: 1 }}>
          <span className="num">{fila.sesiones}</span>
          <span className="cell-note">{fila.sesionesProgramadas} programadas</span>
        </span>
      ),
    },
    {
      key: 'cobertura',
      header: 'Cobertura',
      sortable: true,
      sortValue: (fila) => fila.cobertura,
      render: (fila) => <Meter valor={fila.cobertura} />,
    },
    {
      key: 'plan',
      header: 'Plan de tutoría',
      sortable: true,
      sortValue: (fila) => fila.avancePlan,
      render: (fila) => <Meter valor={fila.avancePlan} />,
    },
    {
      key: 'derivaciones',
      header: 'Solicitudes de apoyo',
      sortable: true,
      sortValue: (fila) => fila.derivaciones,
      render: (fila) =>
        fila.derivaciones === 0 ? (
          <span className="muted small">Sin casos</span>
        ) : (
          <span className="stack" style={{ gap: 2 }}>
            <Badge tone={fila.derivacionesAbiertas ? 'alerta' : 'ok'}>
              {fila.derivacionesAbiertas} abiertas
            </Badge>
            <span className="cell-note">{fila.derivaciones} en total</span>
          </span>
        ),
    },
    {
      key: 'informes',
      header: 'Informes por revisar',
      sortable: true,
      sortValue: (fila) => fila.informesPorRevisar,
      render: (fila) =>
        fila.informesPorRevisar ? (
          <StatusBadge estado="enviado" etiqueta={`${fila.informesPorRevisar} en bandeja`} />
        ) : (
          <Badge tone="ok">Al día</Badge>
        ),
    },
  ];

  return (
    <>
      <PageHeading
        eyebrow={`Coordinación de tutoría · Reportes e indicadores · ${semestreId}`}
        title="Reportes de tutoría"
        description="Compara las sesiones, los estudiantes atendidos y los formularios de cada escuela."
        actions={
          <>
            <div className="field" style={{ minWidth: 200 }}>
              <label htmlFor={idSemestre}>Semestre</label>
              <select
                id={idSemestre}
                className="select"
                value={semestreId}
                onChange={(evento) => setSemestreId(evento.target.value)}
              >
                {semestres.map((semestre) => (
                  <option key={semestre.id} value={semestre.id}>
                    {semestre.nombre} · {semestre.estado}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ minWidth: 240 }}>
              <label htmlFor={idEscuela}>Escuela en detalle</label>
              <select
                id={idEscuela}
                className="select"
                value={escuelaId}
                onChange={(evento) => setEscuelaId(evento.target.value)}
              >
                {escuelas.map((escuela) => (
                  <option key={escuela.id} value={escuela.id}>
                    {escuela.abreviatura} · {escuela.nombre}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="btn btn-primary" onClick={exportar}>
              <Download aria-hidden="true" /> Descargar tabla (CSV)
            </button>
          </>
        }
      />

      {ultimaExportacion && (
        <Alert tone="ok" title="Reporte generado en formato CSV">
          El archivo <strong>reporte-tutoria-{semestreId}.csv</strong> contiene{' '}
          {ultimaExportacion.filas} filas ({ultimaExportacion.caracteres} caracteres) con los
          indicadores por escuela, los formularios por estado, las solicitudes de apoyo por área y
          los motivos frecuentes.
        </Alert>
      )}

      <div className="grid grid--4">
        <Stat
          label="Tutores"
          value={totales.tutores}
          note={`${escuelas.length} escuelas en el ámbito`}
          icon={<Presentation aria-hidden="true" />}
        />
        <Stat
          label="Estudiantes asignados"
          value={totales.asignados}
          note={`${totales.atendidos} estudiantes únicos atendidos`}
          icon={<Users aria-hidden="true" />}
          tone="info"
        />
        <Stat
          label="Estudiantes atendidos (%)"
          value={`${coberturaGlobal}%`}
          note="Únicos atendidos de asignados"
          icon={<Percent aria-hidden="true" />}
          tone={coberturaGlobal >= 80 ? 'verde' : 'alerta'}
        />
        <Stat
          label="Sesiones y atenciones"
          value={totales.sesiones}
          note={`${totales.atenciones} atenciones · ${totales.programas} sesiones programadas`}
          icon={<UserCheck aria-hidden="true" />}
          tone="violeta"
        />
      </div>

      {totales.sesiones === 0 && (
        <Alert tone="alerta" title={`El semestre ${semestreId} no tiene sesiones registradas`}>
          La demostración concentra las sesiones y los formularios en el semestre 2026-II. Cambia el
          selector para consultar los indicadores disponibles; el reporte conserva la estructura
          para cuando se cargue el histórico.
        </Alert>
      )}

      <Card>
        <CardHead
          title={`Indicadores por escuela · ${semestreId}`}
          description="Compare la cobertura, las atenciones y el avance del plan de tutoría entre escuelas."
          actions={
            <button type="button" className="btn btn-falcon-default btn-sm" onClick={exportar}>
              <Download aria-hidden="true" /> Exportar tabla
            </button>
          }
        />
        <CardBody flush>
          <DataTable<Indicadores>
            rows={porEscuela}
            columns={columnas}
            caption={`Indicadores del proceso de tutoría por escuela · ${semestreId}`}
            rowKey={(fila) => fila.escuelaId}
            pageSize={10}
            initialSort={{ key: 'cobertura', direction: 'desc' }}
          />
        </CardBody>
        <CardFoot>
          <span>
            Cobertura = estudiantes únicos atendidos / estudiantes asignados. Una atención es cada
            asistencia registrada; una sesión puede generar varias atenciones.
          </span>
        </CardFoot>
      </Card>

      {actual && (
        <div className="grid grid--3">
          <Stat
            label={`Cobertura de ${abreviaturaEscuela(actual.escuelaId)}`}
            value={`${actual.cobertura}%`}
            note={`${actual.atendidos} de ${actual.asignados} estudiantes atendidos`}
            icon={<Percent aria-hidden="true" />}
            tone={actual.cobertura >= 80 ? 'verde' : 'alerta'}
          />
          <Stat
            label="Atenciones y sesiones"
            value={actual.atenciones}
            note={`${actual.sesiones} sesiones realizadas · ${actual.sesionesProgramadas} programadas`}
            icon={<ClipboardList aria-hidden="true" />}
            tone="info"
          />
          <Stat
            label="Avance del plan tutorial"
            value={`${actual.avancePlan}%`}
            note={`${escuelaDe(actual.escuelaId)}`}
            icon={<GraduationCap aria-hidden="true" />}
            tone="dorado"
          />
        </div>
      )}

      <div className="grid grid--2">
        <Card>
          <CardHead
            title="Formularios por estado"
            description={`Registros del semestre ${semestreId} en todo el ámbito`}
          />
          <CardBody flush>
            {instrumentosPorEstado.length === 0 ? (
              <EmptyState
                title="Sin formularios registrados"
                description="No hay formularios cargados para el semestre seleccionado."
                icon={<ClipboardList />}
              />
            ) : (
              <ul className="list">
                {instrumentosPorEstado.map((fila) => (
                  <li className="list__item" key={fila.estado}>
                    <span className="list__body">
                      <strong>
                        <StatusBadge estado={fila.estado} />
                      </strong>
                      <p>
                        {fila.total} registro(s) ·{' '}
                        {Math.round((fila.total / instrumentosDelAlcance.length) * 100)}% del total
                        del semestre
                      </p>
                    </span>
                    <span className="list__aside num">{fila.total}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
          <CardFoot>
            <span>{instrumentosDelAlcance.length} formularios cargados en el semestre.</span>
          </CardFoot>
        </Card>

        <Card>
          <CardHead
            title="Solicitudes de apoyo por estado"
            description="Estado administrativo reportado por las áreas"
          />
          <CardBody flush>
            {porEstadoDerivacion.length === 0 ? (
              <EmptyState
                title="Sin solicitudes de apoyo registradas"
                description="El semestre seleccionado no tiene fichas de solicitud de apoyo (formato 12)."
                icon={<Send />}
              />
            ) : (
              <ul className="list">
                {porEstadoDerivacion.map(([estado, total]) => (
                  <li className="list__item" key={estado}>
                    <span className="list__body">
                      <strong>
                        <StatusBadge estado={estado} />
                      </strong>
                      <p>
                        {estadosDerivacionAbiertos.some((abierto) => abierto === estado)
                          ? 'Caso abierto: requiere seguimiento de la coordinación.'
                          : 'Caso con atención concluida por el área.'}
                      </p>
                    </span>
                    <span className="list__aside num">{total}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
          <CardFoot>
            <span>
              {derivacionesDelAlcance.length} solicitudes de apoyo en el semestre seleccionado.
            </span>
          </CardFoot>
        </Card>
      </div>

      <div className="grid grid--2">
        <Card>
          <CardHead
            title="Solicitudes de apoyo por área"
            description="Área receptora, casos totales y seguimiento"
          />
          <CardBody flush>
            <ul className="list">
              {porArea.map((fila) => (
                <li className="list__item" key={fila.area.id}>
                  <span className="list__body">
                    <strong>{fila.area.nombre}</strong>
                    <p>
                      {fila.area.responsable} · respuesta estimada {fila.area.tiempoRespuesta}
                    </p>
                    <span className="list__meta">
                      <span>{fila.total} casos</span>
                      <span>{fila.cerradas} cerrados</span>
                    </span>
                  </span>
                  <span className="list__aside">
                    <Badge
                      tone={fila.abiertas === 0 ? 'ok' : fila.abiertas > 1 ? 'alerta' : 'info'}
                    >
                      {fila.abiertas} abiertas
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHead
            title="Motivos de solicitud de apoyo más frecuentes"
            description="Temas recurrentes que orientan el plan tutorial"
          />
          <CardBody flush>
            {motivos.length === 0 ? (
              <EmptyState
                title="Sin motivos registrados"
                description="No hay fichas de solicitud de apoyo en el semestre seleccionado."
                icon={<ScrollText />}
              />
            ) : (
              <ul className="list">
                {motivos.map(([motivo, total]) => (
                  <li className="list__item" key={motivo}>
                    <span className="list__body">
                      <strong>{motivo}</strong>
                      <p>{total} caso(s) en el semestre</p>
                    </span>
                    <span className="list__aside">
                      <Badge tone="info">{total}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Card flat>
        <CardHead
          title="Cómo se calculan las cifras"
          description="Criterios usados para calcular este reporte."
        />
        <CardBody>
          <dl className="def-list">
            <div>
              <dt>Estudiantes atendidos</dt>
              <dd>
                Un estudiante con varias sesiones se cuenta una sola vez, aunque haya asistido a
                tutoría individual y grupal.
              </dd>
            </div>
            <div>
              <dt>Total de asistencias</dt>
              <dd>Cada asistencia registrada en una sesión cuenta como una atención.</dd>
            </div>
            <div>
              <dt>Sesiones realizadas</dt>
              <dd>
                Sesiones efectivamente ejecutadas y registradas en el sistema (individuales y
                grupales).
              </dd>
            </div>
            <div>
              <dt>Cobertura</dt>
              <dd>
                Porcentaje de estudiantes asignados con al menos una atención efectiva. No se
                calcula sobre matrícula total de la escuela.
              </dd>
            </div>
            <div>
              <dt>Matrícula condicionada</dt>
              <dd>
                No se configura como restricción automática; requiere disposición expresa de la
                autoridad (pendiente de validación).
              </dd>
            </div>
            <div>
              <dt>Fuente de los datos</dt>
              <dd>
                Registro y expediente: DIAA (solo lectura). Docentes: Recursos Humanos.
                Asignaciones: comisiones de tutoría.
              </dd>
            </div>
          </dl>
        </CardBody>
        <CardFoot>
          <span>Este reporte usa datos ficticios para probar el sistema.</span>
          <button type="button" className="btn btn-falcon-default btn-sm" onClick={exportar}>
            <Download aria-hidden="true" /> Descargar tabla (CSV)
          </button>
        </CardFoot>
      </Card>
    </>
  );
}
