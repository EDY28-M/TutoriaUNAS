import { useState } from 'react';
import { API_MODE } from '../../services/apiConfig';
import { useSearchParams } from 'react-router-dom';
import { definicionPorCodigo } from '../../data/formatos';
import { estudiantePorId, nombreCompleto } from '../../data/personas';
import type { CodigoFormato, Estudiante, Instrumento, Sesion } from '../../types/domain';
import { esEvaluacionSesion } from '../../utils/evaluacionesSesion';
import { formatFecha } from '../../utils/fechas';
import { puedeEnviarFormato } from '../../utils/instrumentos';
import type { MomentoTutoria } from '../../utils/instrumentos';
import { FormsFilters, FormsPanel } from '../ui/FormsPanel';
import { Badge, StatusBadge } from '../ui/StatusBadge';
import { EmptyState } from '../ui/EmptyState';
import { ArrowRight, Inbox, Search } from '../ui/icons';
import { tareasTutor, tituloFormulario } from './teacherFormTasks';
import '../../styles/teacher-forms.css';

interface Props {
  registros: Instrumento[];
  tutorados: Estudiante[];
  momento: MomentoTutoria;
  sesiones?: Sesion[];
  onAbrir(registro: Instrumento): void;
  onPreparar(codigo: CodigoFormato): void;
}

const TAMANO_PAGINA = 6;
const esEntrevista = (registro: Instrumento) => ['F03', 'F04', 'F05'].includes(registro.formato);

/** Acciones breves y una bandeja de registros con permisos compartidos entre roles. */
export function TeacherFormsPanel({
  registros,
  tutorados,
  momento,
  onAbrir,
  onPreparar,
  sesiones = [],
}: Props) {
  const [parametros, setParametros] = useSearchParams();
  const estudiantes = parametros.get('ambito') === 'estudiantes';
  const estado = parametros.get('estado') ?? '';
  const estudianteId = parametros.get('estudiante') ?? 'todos';
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const propios = registros.filter((r) => definicionPorCodigo(r.formato)?.actor === 'tutor');
  const entregas = registros.filter(
    (r) =>
      definicionPorCodigo(r.formato)?.actor === 'tutorado' &&
      (!esEvaluacionSesion(r.formato) || ['enviado', 'aprobado'].includes(r.estado)),
  );
  const bandeja = estudiantes ? entregas : propios;
  function coincide(registro: Instrumento, filtro: string) {
    if (filtro === 'pendiente')
      return (
        ['no-iniciado', 'borrador', 'observado'].includes(registro.estado) &&
        puedeEnviarFormato(registro.formato, momento)
      );
    if (filtro === 'por-revisar') return registro.estado === 'enviado' && esEntrevista(registro);
    return !filtro || registro.estado === filtro;
  }
  const pendientes = propios.filter((r) => coincide(r, 'pendiente')).length;
  const recibidas = entregas.filter((r) => coincide(r, 'por-revisar')).length;
  const filtros = estudiantes
    ? [
        { id: '', nombre: 'Todas' },
        { id: 'por-revisar', nombre: 'Por revisar' },
        { id: 'observado', nombre: 'Por corregir' },
        { id: 'aprobado', nombre: 'Revisadas' },
      ]
    : [
        { id: '', nombre: 'Todos' },
        { id: 'pendiente', nombre: 'Pendientes' },
        { id: 'observado', nombre: 'Por corregir' },
        { id: 'enviado', nombre: 'Enviados' },
        { id: 'aprobado', nombre: 'Revisados' },
      ];
  function actualizarParametro(nombre: string, valor: string) {
    const nuevos = new URLSearchParams(parametros);
    if (valor && valor !== 'todos') nuevos.set(nombre, valor);
    else nuevos.delete(nombre);
    setPagina(1);
    setParametros(nuevos);
  }
  function cambiarBandeja(valor: string) {
    const nuevos = new URLSearchParams(parametros);
    nuevos.set('ambito', valor);
    nuevos.delete('estado');
    nuevos.delete('estudiante');
    setPagina(1);
    setBusqueda('');
    setParametros(nuevos);
  }
  const listado = bandeja
    .filter((r) => {
      const estudiante = r.estudianteId ? estudiantePorId(r.estudianteId) : null;
      const sesion = sesiones.find((s) => s.id === r.sesionId);
      const texto = `${tituloFormulario(r.formato)} ${definicionPorCodigo(r.formato)?.nombre} ${r.formato} ${r.formato.slice(1)} ${estudiante ? nombreCompleto(estudiante) : ''} ${estudiante?.codigo ?? ''} ${sesion?.tema ?? ''} ${sesion?.codigo ?? ''}`;
      return (
        coincide(r, estado) &&
        (estudianteId === 'todos' || r.estudianteId === estudianteId) &&
        texto.toLocaleLowerCase('es-PE').includes(busqueda.trim().toLocaleLowerCase('es-PE'))
      );
    })
    .sort((a, b) => {
      const prioridad = (r: Instrumento) =>
        estudiantes
          ? Number(coincide(r, 'por-revisar'))
          : Number(['borrador', 'observado'].includes(r.estado));
      return (
        prioridad(b) - prioridad(a) ||
        b.actualizado.localeCompare(a.actualizado) ||
        a.id.localeCompare(b.id)
      );
    });
  const paginas = Math.max(1, Math.ceil(listado.length / TAMANO_PAGINA));
  const paginaActual = Math.min(pagina, paginas);
  const cantidad = estudiantes ? recibidas : pendientes;

  function tarea(tipo: (typeof tareasTutor)[number]) {
    const Icon = tipo.icono;
    const registro = tipo.cierre ? propios.find((r) => r.formato === tipo.codigo) : undefined;
    return (
      <article
        className={`teacher-task${tipo.cierre ? ' teacher-task--closing' : ''}`}
        key={tipo.codigo}
      >
        <span className="teacher-task__icon">
          <Icon aria-hidden="true" />
        </span>
        <div className="teacher-task__body">
          <span className="teacher-task__code">Formato {tipo.codigo.slice(1)}</span>
          <h3>{tipo.titulo}</h3>
          {tipo.cierre &&
            (registro ? (
              <StatusBadge estado={registro.estado} contexto="formulario" />
            ) : (
              <Badge>Sin iniciar</Badge>
            ))}
        </div>
        <button
          type="button"
          className="btn btn-falcon-default"
          aria-label={`Completar formato ${tipo.codigo.slice(1)}`}
          onClick={() => onPreparar(tipo.codigo)}
        >
          {tipo.cierre
            ? registro?.estado === 'enviado' || registro?.estado === 'aprobado'
              ? 'Ver'
              : registro?.estado === 'borrador' || registro?.estado === 'observado'
                ? 'Continuar'
                : 'Preparar'
            : 'Registrar'}
          <ArrowRight aria-hidden="true" />
        </button>
      </article>
    );
  }
  return (
    <FormsPanel
      title={estudiantes ? 'Respuestas de estudiantes' : 'Mis formularios'}
      status={
        cantidad
          ? `${cantidad} ${estudiantes ? 'por revisar' : cantidad === 1 ? 'pendiente' : 'pendientes'}`
          : 'Todo al día'
      }
      momento={momento}
      className="teacher-forms"
    >
      <div className="teacher-forms__scopes" role="group" aria-label="Bandejas de tutoría">
        <button type="button" aria-pressed={!estudiantes} onClick={() => cambiarBandeja('propios')}>
          Mis formularios<span>{pendientes}</span>
        </button>
        <button
          type="button"
          aria-pressed={estudiantes}
          onClick={() => cambiarBandeja('estudiantes')}
        >
          Respuestas de estudiantes<span>{recibidas}</span>
        </button>
      </div>
      {!estudiantes && (
        <>
          <section aria-labelledby="teacher-new-title">
            <div className="forms-panel__section-heading">
              <h2 id="teacher-new-title">Registrar atención</h2>
              <span>Durante el semestre</span>
            </div>
            <div className="teacher-forms__tasks">
              {tareasTutor.filter((t) => !t.cierre).map(tarea)}
            </div>
          </section>
          <section aria-labelledby="teacher-closing-title">
            <div className="forms-panel__section-heading">
              <h2 id="teacher-closing-title">Cierre del semestre</h2>
              <span>
                {momento === 'cierre' ? 'Envío disponible' : 'Puedes preparar tus borradores'}
              </span>
            </div>
            <div className="teacher-forms__tasks">
              {tareasTutor.filter((t) => t.cierre).map(tarea)}
            </div>
          </section>
        </>
      )}
      <section className="teacher-register" aria-labelledby="teacher-records-title">
        <div className="forms-panel__section-heading">
          <h2 id="teacher-records-title">
            {estudiantes ? 'Seguimiento' : 'Mis registros'}
            <span className="teacher-register__count">{bandeja.length}</span>
          </h2>
        </div>
        <FormsFilters
          label={estudiantes ? 'Filtrar respuestas de estudiantes' : 'Filtrar mis registros'}
          options={filtros.map((f) => ({
            ...f,
            cantidad: bandeja.filter((r) => coincide(r, f.id)).length,
          }))}
          value={estado}
          onChange={(valor) => actualizarParametro('estado', valor)}
        />
        <div className="teacher-register__filters">
          <label className="teacher-register__search">
            <Search aria-hidden="true" />
            <input
              className="input"
              type="search"
              aria-label="Buscar"
              placeholder="Buscar por estudiante o formato"
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setPagina(1);
              }}
            />
          </label>
          {estudiantes && (
            <label className="teacher-register__student">
              <span>Estudiante</span>
              <select
                className="select"
                aria-label="Estudiante"
                value={estudianteId}
                onChange={(e) => actualizarParametro('estudiante', e.target.value)}
              >
                <option value="todos">Todos mis estudiantes</option>
                {tutorados.map((e) => (
                  <option key={e.id} value={e.id}>
                    {nombreCompleto(e)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="teacher-register__list">
          {listado.length ? (
            listado
              .slice((paginaActual - 1) * TAMANO_PAGINA, paginaActual * TAMANO_PAGINA)
              .map((registro) => {
                const sesion = sesiones.find((s) => s.id === registro.sesionId);
                const def = definicionPorCodigo(registro.formato)!;
                const estudiante = registro.estudianteId
                  ? estudiantePorId(registro.estudianteId)
                  : null;
                const ver =
                  !estudiantes ||
                  ['enviado', 'aprobado'].includes(registro.estado) ||
                  (!API_MODE && registro.estado === 'observado');
                return (
                  <article
                    className="tutoring-record teacher-register__row"
                    key={registro.id}
                    data-instrument={registro.formato}
                  >
                    <span className="teacher-register__code">{def.numero}</span>
                    <div className="teacher-register__body">
                      <h3 title={def.nombre}>{tituloFormulario(registro.formato)}</h3>
                      <p>
                        {estudiante ? nombreCompleto(estudiante) : 'Docente tutor'}
                        <span> · </span>
                        {formatFecha(registro.actualizado)}
                      </p>
                      {!ver && (
                        <small>
                          {registro.estado === 'observado'
                            ? 'Esperando el nuevo envío del estudiante'
                            : 'Aún sin envío'}
                        </small>
                      )}
                      {sesion && esEvaluacionSesion(registro.formato) && (
                        <small>
                          {sesion.tema} · {formatFecha(sesion.fecha)} · {sesion.codigo}
                        </small>
                      )}
                    </div>
                    <StatusBadge estado={registro.estado} contexto="formulario" />
                    <button
                      type="button"
                      className="btn btn-falcon-default"
                      disabled={!ver}
                      onClick={() => onAbrir(registro)}
                      aria-label={`Abrir formato ${def.numero}${estudiante ? ` de ${nombreCompleto(estudiante)}` : ''}`}
                    >
                      {estudiantes && coincide(registro, 'por-revisar')
                        ? 'Revisar'
                        : !estudiantes && ['borrador', 'observado'].includes(registro.estado)
                          ? 'Continuar'
                          : 'Ver'}
                      <ArrowRight aria-hidden="true" />
                    </button>
                  </article>
                );
              })
          ) : (
            <div className="forms-panel__empty">
              <EmptyState
                title="Sin formularios en esta vista"
                description="Prueba con otro filtro o búsqueda."
                icon={<Inbox aria-hidden="true" />}
              />
              {(estado || busqueda || estudianteId !== 'todos') && (
                <button
                  type="button"
                  className="btn btn-falcon-default"
                  onClick={() => {
                    const p = new URLSearchParams(parametros);
                    p.delete('estado');
                    p.delete('estudiante');
                    setParametros(p);
                    setBusqueda('');
                    setPagina(1);
                  }}
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          )}
        </div>
        {listado.length > TAMANO_PAGINA && (
          <nav className="teacher-register__pagination" aria-label="Páginas de formularios">
            <span>
              {paginaActual} de {paginas} <span>· {listado.length} registros</span>
            </span>
            <div>
              <button
                type="button"
                className="btn btn-falcon-default"
                disabled={paginaActual === 1}
                onClick={() => setPagina(paginaActual - 1)}
              >
                Anterior
              </button>
              <button
                type="button"
                className="btn btn-falcon-default"
                disabled={paginaActual === paginas}
                onClick={() => setPagina(paginaActual + 1)}
              >
                Siguiente
              </button>
            </div>
          </nav>
        )}
      </section>
    </FormsPanel>
  );
}
