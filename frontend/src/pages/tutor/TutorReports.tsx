import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeading } from '../../components/ui/PageHeading';
import { MetricGroup } from '../../components/ui/MetricGroup';
import { Stat } from '../../components/ui/Stat';
import { UserCheck, Users, CalendarCheck, ClipboardList } from '../../components/ui/icons';
import { Badge, StatusBadge } from '../../components/ui/StatusBadge';
import { DataTable } from '../../components/ui/DataTable';
import type { Column } from '../../components/ui/DataTable';
import { Grafica } from '../../components/ui/PortalCharts';
import { Sheet } from '../../components/ui/Sheet';
import { usePortal } from '../../hooks/usePortal';
import { areasDerivacion, semestreActual } from '../../data/catalogos';
import { reglasTutoria } from '../../data/institucional';
import { escuelaDe, estudiantePorId, nombreCompleto } from '../../data/personas';
import type { EstadoInstrumento, Sesion } from '../../types/domain';
import { HOY_ISO, formatFecha } from '../../utils/fechas';
import { downloadCsv } from '../../utils/csv';
import { CHART_COLORS, CHART_STATUS_COLORS, waveSeries } from '../../utils/chartStyles';
import '../../assets/vendor/fontawesome.min.css';
import '../../styles/tutor-reports.css';

const COLORES = {
  verde: CHART_COLORS.green,
  azul: CHART_COLORS.blue,
  violeta: CHART_COLORS.violet,
  dorado: CHART_COLORS.amber,
  gris: CHART_COLORS.slate,
  rojo: CHART_COLORS.rose,
  linea: CHART_COLORS.line,
  texto: CHART_COLORS.text,
};
const COLOR_ESTADO: Record<EstadoInstrumento, string> = CHART_STATUS_COLORS;

function lunesDe(fecha: string): string {
  const dia = new Date(`${fecha.slice(0, 10)}T12:00:00Z`);
  dia.setUTCDate(dia.getUTCDate() - ((dia.getUTCDay() + 6) % 7));
  return dia.toISOString().slice(0, 10);
}
function sumarSemana(fecha: string): string {
  const dia = new Date(`${fecha}T12:00:00Z`);
  dia.setUTCDate(dia.getUTCDate() + 7);
  return dia.toISOString().slice(0, 10);
}
const ejeNumerico = {
  type: 'value',
  min: 0,
  minInterval: 1,
  axisLabel: { color: COLORES.texto, fontSize: 11 },
  splitLine: { lineStyle: { color: COLORES.linea, type: 'dashed' } },
  axisLine: { show: false },
  axisTick: { show: false },
};
const ejeCategoria = {
  type: 'category',
  axisLine: { show: false },
  axisTick: { show: false },
  axisLabel: { color: COLORES.texto, fontSize: 12, margin: 12 },
};
const barra = {
  type: 'bar',
  barMaxWidth: 16,
  showBackground: true,
  backgroundStyle: { color: '#f1f5f2', borderRadius: 4 },
  itemStyle: { color: COLORES.verde, borderRadius: [0, 6, 6, 0] },
  label: { show: true, position: 'right', fontSize: 12, color: '#1c3046' },
};
type Modalidad = Sesion['modalidad'];

interface FilaCiclo {
  ciclo: number | null;
  asignados: number;
  atendidos: number;
  atenciones: number;
  sesiones: number;
  individuales: number;
  grupales: number;
  cobertura: number;
}

const MODALIDADES: Modalidad[] = ['presencial', 'virtual', 'mixta'];

const ESTADOS_INSTRUMENTO: EstadoInstrumento[] = [
  'no-iniciado',
  'borrador',
  'enviado',
  'observado',
  'aprobado',
  'vencido',
];

const ETIQUETA_ESTADO: Record<EstadoInstrumento, string> = {
  'no-iniciado': 'No iniciado',
  borrador: 'Borrador',
  enviado: 'Enviado',
  observado: 'Observado',
  aprobado: 'Aprobado',
  vencido: 'Vencido',
};

function asistio(asistente: { estado: string }): boolean {
  return asistente.estado === 'asistio' || asistente.estado === 'tarde';
}

export function TutorReports() {
  const portal = usePortal();
  const docente = portal.docente;
  const { tutorados, sesiones, instrumentos, derivaciones } = portal;

  const [previaAbierta, setPreviaAbierta] = useState(false);
  const [actividad, setActividad] = useState<'asistencias' | 'sesiones'>('asistencias');
  const [cicloVista, setCicloVista] = useState<'asistencias' | 'cobertura'>('asistencias');

  const realizadas = sesiones.filter((sesion) => sesion.estado === 'realizada');
  const programadas = sesiones.filter((sesion) => sesion.estado === 'programada');
  const canceladas = sesiones.filter(
    (sesion) => sesion.estado === 'cancelada' || sesion.estado === 'reprogramada',
  );

  const atenciones = realizadas.flatMap((sesion) =>
    sesion.asistentes.filter(asistio).map((asistente) => ({
      estudianteId: asistente.estudianteId,
      sesion,
    })),
  );
  const estudiantesAtendidos = new Set(atenciones.map((atencion) => atencion.estudianteId));

  const tutoradosResueltos = tutorados.flatMap((asignacion) => {
    const estudiante = estudiantePorId(asignacion.estudianteId);
    return estudiante ? [estudiante] : [];
  });
  const ciclos = [...new Set(tutoradosResueltos.map((estudiante) => estudiante.ciclo))].sort(
    (a, b) => (a ?? Infinity) - (b ?? Infinity),
  );

  const filasCiclo: FilaCiclo[] = ciclos.map((ciclo) => {
    const delCiclo = tutoradosResueltos.filter((estudiante) => estudiante.ciclo === ciclo);
    const ids = new Set(delCiclo.map((estudiante) => estudiante.id));
    const propias = realizadas.filter((sesion) =>
      sesion.asistentes.some((asistente) => ids.has(asistente.estudianteId)),
    );
    const asistenciasCiclo = atenciones.filter((atencion) => ids.has(atencion.estudianteId));
    const atendidosCiclo = new Set(asistenciasCiclo.map((atencion) => atencion.estudianteId));
    return {
      ciclo,
      asignados: delCiclo.length,
      atendidos: atendidosCiclo.size,
      atenciones: asistenciasCiclo.length,
      sesiones: propias.length,
      individuales: propias.filter((sesion) => sesion.tipo === 'individual').length,
      grupales: propias.filter((sesion) => sesion.tipo === 'grupal').length,
      cobertura: delCiclo.length ? Math.round((atendidosCiclo.size / delCiclo.length) * 100) : 0,
    };
  });

  const totalAsignados = tutoradosResueltos.length;
  const coberturaTotal = totalAsignados
    ? Math.round((estudiantesAtendidos.size / totalAsignados) * 100)
    : 0;

  const sinAtencion = tutoradosResueltos.filter(
    (estudiante) => !estudiantesAtendidos.has(estudiante.id),
  );

  const porModalidad = MODALIDADES.map((modalidad) => {
    const total = realizadas.filter((sesion) => sesion.modalidad === modalidad).length;
    return {
      modalidad,
      total,
      porcentaje: realizadas.length ? Math.round((total / realizadas.length) * 100) : 0,
    };
  });

  const motivos = [...new Set(derivaciones.map((derivacion) => derivacion.motivo))].map(
    (motivo) => {
      const casos = derivaciones.filter((derivacion) => derivacion.motivo === motivo);
      const area = casos[0]?.area;
      return {
        motivo,
        area: area
          ? (areasDerivacion.find((item) => item.id === area)?.nombre ?? area)
          : 'Sin área',
        total: casos.length,
        prioridad: casos[0]?.prioridad ?? 'media',
        porcentaje: derivaciones.length
          ? Math.round((casos.length / derivaciones.length) * 100)
          : 0,
      };
    },
  );

  const instrumentosPorEstado = ESTADOS_INSTRUMENTO.map((estado) => ({
    estado,
    total: instrumentos.filter((instrumento) => instrumento.estado === estado).length,
  })).filter((fila) => fila.total > 0);

  const filasCsv: string[][] = [
    [
      'Ciclo',
      'Estudiantes asignados',
      'Estudiantes únicos atendidos',
      'Atenciones acumuladas',
      'Sesiones realizadas',
      'Sesiones individuales',
      'Sesiones grupales',
      'Cobertura (%)',
    ],
    ...filasCiclo.map((fila) => [
      `Ciclo ${fila.ciclo}`,
      String(fila.asignados),
      String(fila.atendidos),
      String(fila.atenciones),
      String(fila.sesiones),
      String(fila.individuales),
      String(fila.grupales),
      String(fila.cobertura),
    ]),
    [
      'Total',
      String(totalAsignados),
      String(estudiantesAtendidos.size),
      String(atenciones.length),
      String(realizadas.length),
      String(realizadas.filter((sesion) => sesion.tipo === 'individual').length),
      String(realizadas.filter((sesion) => sesion.tipo === 'grupal').length),
      String(coberturaTotal),
    ],
  ];

  const nombreArchivo = `reporte-tutorial-${semestreActual}-${docente?.codigo ?? 'docente'}.csv`;
  const reglaConteo = reglasTutoria.find((regla) => regla.codigo === 'conteo-cobertura');

  const columnas: Column<FilaCiclo>[] = [
    {
      key: 'ciclo',
      header: 'Ciclo',
      sortable: true,
      sortValue: (fila) => fila.ciclo,
      render: (fila) => `Ciclo ${fila.ciclo}`,
    },
    { key: 'asignados', header: 'Asignados', render: (fila) => fila.asignados },
    { key: 'atendidos', header: 'Atendidos', render: (fila) => fila.atendidos },
    { key: 'asistencias', header: 'Asistencias', render: (fila) => fila.atenciones },
    { key: 'sesiones', header: 'Sesiones', render: (fila) => fila.sesiones },
    { key: 'cobertura', header: 'Cobertura', render: (fila) => `${fila.cobertura}%` },
  ];
  const fechas = realizadas.map((sesion) => lunesDe(sesion.fecha)).sort();
  const semanas: string[] = [];
  if (fechas.length) {
    for (
      let semana = fechas[0]!;
      semana <= fechas[fechas.length - 1]!;
      semana = sumarSemana(semana)
    )
      semanas.push(semana);
  }
  const serieSemanal = semanas.map((semana) => ({
    semana,
    sesiones: realizadas.filter((sesion) => lunesDe(sesion.fecha) === semana).length,
    asistencias: atenciones.filter((atencion) => lunesDe(atencion.sesion.fecha) === semana).length,
  }));
  const areas = [...new Set(motivos.map((fila) => fila.area))]
    .map((area) => ({
      area,
      total: motivos
        .filter((fila) => fila.area === area)
        .reduce((suma, fila) => suma + fila.total, 0),
    }))
    .sort((a, b) => b.total - a.total);
  const actividadOption = {
    color: [COLORES.verde],
    grid: { left: 0, right: 28, top: 24, bottom: 4, containLabel: true },
    xAxis: {
      ...ejeCategoria,
      boundaryGap: false,
      data: serieSemanal.map((fila) => formatFecha(fila.semana).replace(/ \d{4}$/, '')),
      axisLabel: { color: COLORES.texto, fontSize: 11, hideOverlap: true },
    },
    yAxis: { ...ejeNumerico },
    series: [
      waveSeries({
        name: actividad === 'asistencias' ? 'Asistencias' : 'Sesiones',
        data: serieSemanal.map((fila) => fila[actividad]),
        color: COLORES.verde,
        fill: 'rgba(23,96,54,0.28)',
        labels: true,
      }),
    ],
  };
  const modalidadOption = {
    color: [COLORES.verde, COLORES.azul, COLORES.dorado],
    tooltip: { trigger: 'item', confine: true, formatter: '{b}: {c} sesiones ({d}%)' },
    series: [
      {
        name: 'Modalidad',
        type: 'pie',
        radius: ['66%', '86%'],
        center: ['50%', '50%'],
        label: { show: false },
        labelLine: { show: false },
        itemStyle: { borderColor: '#fff', borderWidth: 3, borderRadius: 4 },
        data: porModalidad.map((fila) => ({
          name: fila.modalidad.charAt(0).toUpperCase() + fila.modalidad.slice(1),
          value: fila.total,
        })),
      },
    ],
  };
  const cicloOption = {
    grid: { left: 0, right: 42, top: 12, bottom: 4, containLabel: true },
    xAxis: {
      ...ejeNumerico,
      ...(cicloVista === 'cobertura'
        ? { max: 100, axisLabel: { color: COLORES.texto, fontSize: 11, formatter: '{value}%' } }
        : {}),
    },
    yAxis: {
      ...ejeCategoria,
      inverse: true,
      data: filasCiclo.map((fila) => `Ciclo ${fila.ciclo}`),
    },
    series: [
      {
        ...barra,
        name: cicloVista === 'cobertura' ? 'Cobertura (%)' : 'Asistencias',
        data: filasCiclo.map((fila) =>
          cicloVista === 'cobertura' ? fila.cobertura : fila.atenciones,
        ),
        label: { ...barra.label, formatter: cicloVista === 'cobertura' ? '{c}%' : '{c}' },
      },
    ],
  };
  const formulariosOption = {
    grid: { left: 0, right: 28, top: 12, bottom: 4, containLabel: true },
    xAxis: { ...ejeNumerico },
    yAxis: {
      ...ejeCategoria,
      inverse: true,
      data: instrumentosPorEstado.map((fila) => ETIQUETA_ESTADO[fila.estado]),
    },
    series: [
      {
        ...barra,
        name: 'Formularios',
        data: instrumentosPorEstado.map((fila) => ({
          value: fila.total,
          itemStyle: { color: COLOR_ESTADO[fila.estado] },
        })),
      },
    ],
  };
  const apoyoOption = {
    grid: { left: 0, right: 28, top: 12, bottom: 4, containLabel: true },
    xAxis: { ...ejeNumerico },
    yAxis: {
      ...ejeCategoria,
      inverse: true,
      data: areas.map((fila) =>
        fila.area
          .replace('Bienestar y Servicio Social', 'Bienestar')
          .replace('Tutoría académica', 'Tutoría'),
      ),
      axisLabel: {
        color: COLORES.texto,
        fontSize: 11,
        width: 110,
        overflow: 'truncate',
        margin: 10,
      },
    },
    series: [
      {
        ...barra,
        name: 'Solicitudes',
        barMaxWidth: 20,
        itemStyle: { color: COLORES.violeta, borderRadius: [0, 4, 4, 0] },
        data: areas.map((fila) => fila.total),
      },
    ],
  };

  if (!docente)
    return (
      <PageHeading
        eyebrow="Mi trabajo"
        title="Reportes"
        description="La cuenta no tiene una ficha de docente tutor asociada."
      />
    );

  return (
    <div className="tutor-reports">
      <PageHeading
        eyebrow="Docente tutor · Reportes"
        title="Reportes de tutoría"
        description={`${semestreActual} · ${escuelaDe(docente.escuelaId)}`}
        actions={
          <>
            <button
              type="button"
              className="btn btn-falcon-default"
              onClick={() => setPreviaAbierta(true)}
            >
              <i className="fa-regular fa-file-lines" aria-hidden="true" /> Vista previa
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => downloadCsv(filasCsv, nombreArchivo)}
            >
              <i className="fa-solid fa-download" aria-hidden="true" /> Exportar CSV
            </button>
          </>
        }
      />

      <MetricGroup label="Indicadores de tutoría">
        <Stat
          label="Cobertura"
          value={`${coberturaTotal}%`}
          note={`${estudiantesAtendidos.size} de ${totalAsignados} estudiantes atendidos`}
          icon={<UserCheck />}
        />
        <Stat
          label="Asistencias"
          value={atenciones.length}
          note="En sesiones realizadas"
          icon={<Users />}
        />
        <Stat
          label="Sesiones realizadas"
          value={realizadas.length}
          note={`${realizadas.filter((s) => s.tipo === 'individual').length} individuales · ${realizadas.filter((s) => s.tipo === 'grupal').length} grupales`}
          icon={<CalendarCheck />}
        />
        <Stat
          label="Formularios"
          value={instrumentos.length}
          note={`${instrumentos.filter((item) => item.estado === 'aprobado').length} aprobados`}
          icon={<ClipboardList />}
        />
      </MetricGroup>

      <div className="report-charts">
        <Grafica
          className="report-chart report-chart--activity"
          title="Actividad semanal"
          eyebrow=""
          description="Sesiones realizadas y asistencias por semana."
          emptyDescription="Los datos aparecerán al registrar actividad en tutoría."
          empty={!realizadas.length}
          option={actividadOption}
          tabla={{
            columnas: ['Semana del', 'Asistencias', 'Sesiones'],
            filas: serieSemanal.map((fila) => [
              formatFecha(fila.semana),
              fila.asistencias,
              fila.sesiones,
            ]),
          }}
          choices={
            <div className="report-switch" role="group" aria-label="Métrica de actividad">
              <button
                type="button"
                aria-pressed={actividad === 'asistencias'}
                onClick={() => setActividad('asistencias')}
              >
                Asistencias
              </button>
              <button
                type="button"
                aria-pressed={actividad === 'sesiones'}
                onClick={() => setActividad('sesiones')}
              >
                Sesiones
              </button>
            </div>
          }
        />
        <Grafica
          className="report-chart report-chart--modality"
          title="Modalidad de sesiones"
          eyebrow=""
          description="Distribución de las sesiones realizadas."
          emptyDescription="Los datos aparecerán al registrar actividad en tutoría."
          empty={!realizadas.length}
          option={modalidadOption}
          tabla={{
            columnas: ['Modalidad', 'Sesiones', 'Porcentaje'],
            filas: porModalidad.map((fila) => [fila.modalidad, fila.total, `${fila.porcentaje}%`]),
          }}
          overlay={
            <div className="report-donut-total">
              <strong>{realizadas.length}</strong>
              <span>sesiones</span>
            </div>
          }
          footer={
            <ul className="report-legend">
              {porModalidad.map((fila, indice) => (
                <li key={fila.modalidad}>
                  <i
                    style={{
                      backgroundColor: [COLORES.verde, COLORES.azul, COLORES.dorado][indice],
                    }}
                    aria-hidden="true"
                  />
                  <span>{fila.modalidad.charAt(0).toUpperCase() + fila.modalidad.slice(1)}</span>
                  <strong>{fila.total}</strong>
                  <small>{fila.porcentaje}%</small>
                </li>
              ))}
            </ul>
          }
        />
        <Grafica
          className="report-chart report-chart--cycles"
          title="Atención por ciclo"
          eyebrow=""
          description="Asistencias y cobertura por ciclo académico."
          emptyDescription="Los datos aparecerán al registrar actividad en tutoría."
          empty={!filasCiclo.length}
          option={cicloOption}
          tabla={{
            columnas: ['Ciclo', 'Asignados', 'Atendidos', 'Asistencias', 'Cobertura'],
            filas: filasCiclo.map((fila) => [
              fila.ciclo ?? 'Sin informar',
              fila.asignados,
              fila.atendidos,
              fila.atenciones,
              `${fila.cobertura}%`,
            ]),
          }}
          choices={
            <div className="report-switch" role="group" aria-label="Métrica por ciclo">
              <button
                type="button"
                aria-pressed={cicloVista === 'asistencias'}
                onClick={() => setCicloVista('asistencias')}
              >
                Asistencias
              </button>
              <button
                type="button"
                aria-pressed={cicloVista === 'cobertura'}
                onClick={() => setCicloVista('cobertura')}
              >
                Cobertura
              </button>
            </div>
          }
        />
        <Grafica
          className="report-chart report-chart--forms"
          title="Estado de formularios"
          eyebrow=""
          description="Registros por estado de presentación."
          emptyDescription="Los datos aparecerán al registrar actividad en tutoría."
          empty={!instrumentos.length}
          option={formulariosOption}
          tabla={{
            columnas: ['Estado', 'Formularios'],
            filas: instrumentosPorEstado.map((fila) => [ETIQUETA_ESTADO[fila.estado], fila.total]),
          }}
          choices={<Badge>{instrumentos.length}</Badge>}
        />
        <Grafica
          className="report-chart report-chart--referrals"
          title="Solicitudes de apoyo"
          eyebrow=""
          description="Solicitudes registradas por área de atención."
          emptyDescription="Los datos aparecerán al registrar actividad en tutoría."
          empty={!derivaciones.length}
          option={apoyoOption}
          tabla={{
            columnas: ['Motivo', 'Área', 'Casos', 'Prioridad'],
            filas: motivos.map((fila) => [fila.motivo, fila.area, fila.total, fila.prioridad]),
          }}
          choices={<Badge>{derivaciones.length}</Badge>}
        />
      </div>

      <div className="report-status">
        <span>
          <i className="fa-solid fa-calendar-check" aria-hidden="true" />
          {programadas.length} sesiones programadas
        </span>
        <span>{canceladas.length} canceladas o reprogramadas</span>
        <Link to="/tutor/sesiones">
          Ver sesiones <i className="fa-solid fa-arrow-right" aria-hidden="true" />
        </Link>
      </div>

      <details className="report-details">
        <summary>
          <i className="fa-solid fa-table" aria-hidden="true" /> Desglose por ciclo{' '}
          <i className="fa-solid fa-chevron-down" aria-hidden="true" />
        </summary>
        <DataTable
          rows={filasCiclo}
          columns={columnas}
          caption="Cobertura de la labor tutorial por ciclo académico"
          rowKey={(fila) => String(fila.ciclo)}
          pagination="auto"
          compact
        />
      </details>
      <details className="report-details">
        <summary>
          <i className="fa-solid fa-user-check" aria-hidden="true" /> Estudiantes sin atención{' '}
          <Badge tone={sinAtencion.length ? 'alerta' : 'ok'}>{sinAtencion.length}</Badge>
          <i className="fa-solid fa-chevron-down" aria-hidden="true" />
        </summary>
        {sinAtencion.length ? (
          <ul className="report-unattended">
            {sinAtencion.map((estudiante) => (
              <li key={estudiante.id}>
                <span>
                  <strong>{nombreCompleto(estudiante)}</strong>
                  <small>Ciclo {estudiante.ciclo}</small>
                </span>
                <Link to={`/tutor/tutorados/${estudiante.id}`}>Ver ficha</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="report-note">Todos tus estudiantes registran al menos una atención.</p>
        )}
      </details>
      <details className="report-details report-source">
        <summary>
          <i className="fa-solid fa-circle-info" aria-hidden="true" /> Cálculo y fuente de los datos{' '}
          <i className="fa-solid fa-chevron-down" aria-hidden="true" />
        </summary>
        <p>
          Estudiantes atendidos: personas únicas que asistieron o llegaron tarde. Asistencias:
          participaciones acumuladas en sesiones realizadas. Sesiones: encuentros realizados,
          contados una sola vez.
        </p>
        <p>
          Una sesión grupal puede aparecer en varios ciclos. El total de sesiones se calcula sin
          duplicados.
        </p>
        <p>
          {reglaConteo?.valor} <StatusBadge estado={reglaConteo?.estado ?? 'propuesta'} />
        </p>
        <p>
          {reglaConteo?.fuente} · Datos ficticios con corte al {formatFecha(HOY_ISO)}.
        </p>
      </details>

      {previaAbierta && (
        <Sheet
          title="Vista previa del reporte"
          description={`Semestre ${semestreActual} · ${docente.codigo}`}
          onClose={() => setPreviaAbierta(false)}
          wide
          footer={
            <>
              <button
                type="button"
                className="btn btn-link"
                onClick={() => setPreviaAbierta(false)}
              >
                Cerrar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => downloadCsv(filasCsv, nombreArchivo)}
              >
                Exportar CSV
              </button>
            </>
          }
        >
          <div className="stack">
            <MetricGroup label="Resumen de la vista previa">
              <Stat
                label="Estudiantes atendidos"
                value={estudiantesAtendidos.size}
                note={`De ${totalAsignados} asignados`}
                icon={<UserCheck />}
              />
              <Stat
                label="Asistencias"
                value={atenciones.length}
                note="En sesiones realizadas"
                icon={<Users />}
              />
              <Stat
                label="Sesiones"
                value={realizadas.length}
                note="Realizadas en el periodo"
                icon={<CalendarCheck />}
              />
            </MetricGroup>
            <DataTable
              rows={filasCiclo}
              columns={columnas}
              caption="Vista previa de la cobertura por ciclo"
              rowKey={(fila) => String(fila.ciclo)}
              compact
              pagination="auto"
            />
            <p className="report-note">Datos de demostración · Exportación para el formato 02.</p>
          </div>
        </Sheet>
      )}
    </div>
  );
}
