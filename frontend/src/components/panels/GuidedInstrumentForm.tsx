import { useId, useRef, useState } from 'react';
import type { CampoFormato, DefinicionFormato, Instrumento } from '../../types/domain';
import { Alert } from '../ui/Alert';
import { Progress } from '../ui/Progress';
import { ArrowLeft, ArrowRight, Check, CircleCheck, Plus, Send, Trash } from '../ui/icons';
import { matriculaDe, nombreCurso } from '../../data/academico';
import { asignaciones } from '../../data/tutoria';
import { estudiantePorId, nombreCompleto } from '../../data/personas';
import { usePortal } from '../../hooks/usePortal';
import {
  avanceInstrumento,
  campoVisible,
  erroresInstrumento,
  filasRespuesta,
  listaRespuesta,
  precargarInstrumento,
} from '../../utils/instrumentos';

interface Props {
  definicion: DefinicionFormato;
  instrumento: Instrumento;
  editable?: boolean;
  puedeEnviar?: boolean;
  compacto?: boolean;
  onGuardar?(respuestas: Record<string, string>, enviar: boolean): void;
}

/** Pasos breves y revisión explícita antes de compartir respuestas. */
export function GuidedInstrumentForm({
  definicion,
  instrumento,
  editable = false,
  puedeEnviar = true,
  compacto = false,
  onGuardar,
}: Props) {
  const portal = usePortal();
  const [valores, setValores] = useState(() => precargarInstrumento(instrumento, portal.sesiones));
  const [paso, setPaso] = useState(0);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [mensaje, setMensaje] = useState('');
  const [fallo, setFallo] = useState('');
  const [confirmado, setConfirmado] = useState(false);
  const cabecera = useRef<HTMLHeadingElement>(null);
  const resumenError = useRef<HTMLDivElement>(null);
  const secciones = definicion.secciones;
  const resumen = paso === secciones.length;
  const seccion = secciones[paso];
  const cursos = instrumento.estudianteId
    ? (matriculaDe(instrumento.estudianteId)?.cursos ?? []).map((curso) =>
        nombreCurso(curso.cursoId),
      )
    : [];
  const nombres = asignaciones
    .filter((a) => a.tutorId === instrumento.tutorId && a.estado === 'activa')
    .map((a) => estudiantePorId(a.estudianteId))
    .filter((e) => !!e)
    .map(nombreCompleto);
  const adaptar = (campo: CampoFormato): CampoFormato => {
    if (['cursosDificiles', 'materiasFaciles'].includes(campo.codigo))
      return { ...campo, opciones: [...cursos, 'Ninguno', 'Otro'] };
    if (campo.codigo === 'asistentes')
      return {
        ...campo,
        columnas: campo.columnas?.map((columna) =>
          columna.codigo === 'nombre'
            ? { ...columna, tipo: 'seleccion', opciones: nombres }
            : columna,
        ),
      };
    return campo;
  };
  const calcularErrores = () =>
    erroresInstrumento(
      { ...definicion, secciones: secciones.map((s) => ({ ...s, campos: s.campos.map(adaptar) })) },
      valores,
    );
  function actualizar(codigo: string, valor: string) {
    setValores((actual) => ({ ...actual, [codigo]: valor }));
    setErrores((actual) => {
      const nuevos = { ...actual };
      delete nuevos[codigo];
      return nuevos;
    });
    setMensaje('');
    setFallo('');
    setConfirmado(false);
  }
  function ir(destino: number) {
    setPaso(destino);
    requestAnimationFrame(() => {
      cabecera.current?.focus();
      cabecera.current?.scrollIntoView({ block: 'start' });
    });
  }
  function guardar(enviar: boolean) {
    setFallo('');
    try {
      onGuardar?.(valores, enviar);
      setMensaje(enviar ? 'Formulario enviado.' : 'Borrador guardado. Puedes continuar después.');
      return true;
    } catch (error) {
      setFallo(error instanceof Error ? error.message : 'No pudimos guardar. Intenta nuevamente.');
      return false;
    }
  }
  function continuar() {
    const todos = calcularErrores();
    const campos =
      seccion?.campos
        .filter((campo) => campoVisible(campo, valores))
        .flatMap((campo) => [campo.codigo, `${campo.codigo}__otro`]) ?? [];
    const actuales = Object.fromEntries(
      Object.entries(todos).filter(([codigo]) => campos.includes(codigo)),
    );
    setErrores(actuales);
    if (Object.keys(actuales).length) {
      requestAnimationFrame(() => resumenError.current?.focus());
      return;
    }
    if (!onGuardar || guardar(false)) ir(paso + 1);
  }
  function enviar() {
    const actuales = calcularErrores();
    setErrores(actuales);
    if (Object.keys(actuales).length) {
      setFallo('Revisa las preguntas pendientes antes de enviar.');
      requestAnimationFrame(() => resumenError.current?.focus());
      return;
    }
    if (!confirmado) {
      setFallo('Confirma que revisaste tus respuestas.');
      return;
    }
    guardar(true);
  }
  function bloque(seccionActual: (typeof secciones)[number], lectura: boolean) {
    return (
      <div className="tutoring-fields">
        {seccionActual.campos
          .filter((campo) => campoVisible(campo, valores))
          .map((campo) => (
            <RespuestaCampo
              key={campo.codigo}
              campo={adaptar(campo)}
              valores={valores}
              editable={!lectura}
              error={errores[campo.codigo]}
              otroError={errores[`${campo.codigo}__otro`]}
              onChange={actualizar}
            />
          ))}
      </div>
    );
  }
  if (!editable)
    return (
      <div className="tutoring-form tutoring-form--read">
        {secciones.map((s) => (
          <section key={s.titulo} className="tutoring-review-section">
            <h3>{s.titulo}</h3>
            {bloque(s, true)}
          </section>
        ))}
      </div>
    );
  return (
    <div className="tutoring-form">
      <div className="tutoring-form__progress">
        <span className="small">
          {resumen ? 'Revisión final' : `Paso ${paso + 1} de ${secciones.length}`}
          {!compacto && ` · Formato ${definicion.numero}`}
        </span>
        <Progress valor={avanceInstrumento(definicion, valores)} etiqueta="Respuestas completas" />
      </div>
      {compacto ? (
        <label className="tutoring-section-picker">
          Sección
          <select
            className="select"
            aria-label="Sección del formulario"
            value={paso}
            onChange={(e) => ir(Number(e.target.value))}
          >
            {[...secciones.map((s) => s.titulo), 'Revisar y enviar'].map((titulo, i) => (
              <option key={titulo} value={i}>
                {i + 1}. {titulo}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <nav className="tutoring-steps" aria-label="Pasos del formulario">
          {[...secciones.map((s) => s.titulo), 'Revisar y enviar'].map((titulo, i) => (
            <button
              key={titulo}
              type="button"
              aria-current={paso === i ? 'step' : undefined}
              aria-label={`${i + 1}. ${titulo}`}
              title={titulo}
              onClick={() => ir(i)}
            >
              <span>{i < paso ? <Check aria-hidden="true" /> : i + 1}</span>
              <span>{titulo}</span>
            </button>
          ))}
        </nav>
      )}
      <div className="tutoring-form__heading">
        <h3 ref={cabecera} tabIndex={-1}>
          {resumen ? 'Revisa tus respuestas' : seccion?.titulo}
        </h3>
        <p>
          {resumen
            ? 'Comprueba los datos antes de compartirlos.'
            : compacto
              ? '* Obligatorio'
              : 'Marca tus opciones. Los campos con * son necesarios para enviar.'}
        </p>
      </div>
      {Object.keys(errores).length > 0 && (
        <div className="tutoring-errors" role="alert" tabIndex={-1} ref={resumenError}>
          <strong>Revisa las respuestas señaladas.</strong>
          <ul>
            {Object.entries(errores).map(([codigo, error]) => {
              const indice = secciones.findIndex((s) =>
                s.campos.some((c) => c.codigo === codigo.replace('__otro', '')),
              );
              const campo = secciones[indice]?.campos.find(
                (c) => c.codigo === codigo.replace('__otro', ''),
              );
              return (
                <li key={codigo}>
                  <button type="button" onClick={() => ir(Math.max(indice, 0))}>
                    {campo?.etiqueta}: {error}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {mensaje && (
        <p className="tutoring-saved" role="status">
          <CircleCheck aria-hidden="true" /> {mensaje}
        </p>
      )}
      {fallo && (
        <Alert tone="riesgo" title="Revisa el formulario">
          {fallo}
        </Alert>
      )}
      {resumen ? (
        <>
          {secciones.map((s, i) => (
            <details className="tutoring-review-section" key={s.titulo}>
              <summary>{s.titulo}</summary>
              {bloque(s, true)}
              <button type="button" className="btn btn-link" onClick={() => ir(i)}>
                Editar esta sección
              </button>
            </details>
          ))}
          <label className="tutoring-confirm">
            <input
              type="checkbox"
              checked={confirmado}
              onChange={(event) => setConfirmado(event.target.checked)}
            />
            <span>He revisado mis respuestas y deseo enviarlas.</span>
          </label>
          {!puedeEnviar && (
            <Alert tone="info" title="Envío al cierre del semestre">
              Puedes preparar y guardar el borrador. El envío se habilita al finalizar el semestre.
            </Alert>
          )}
        </>
      ) : (
        seccion && bloque(seccion, false)
      )}
      <div className="tutoring-form__actions">
        {paso > 0 && (
          <button type="button" className="btn btn-falcon-default" onClick={() => ir(paso - 1)}>
            <ArrowLeft aria-hidden="true" /> Atrás
          </button>
        )}
        {onGuardar && (
          <button type="button" className="btn btn-falcon-default" onClick={() => guardar(false)}>
            Guardar borrador
          </button>
        )}
        {resumen ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={!puedeEnviar || !onGuardar}
            onClick={enviar}
          >
            <Send aria-hidden="true" /> Enviar formulario
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={continuar}>
            {paso === secciones.length - 1 ? 'Revisar respuestas' : 'Continuar'}{' '}
            <ArrowRight aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

function RespuestaCampo({
  campo,
  valores,
  editable,
  error,
  otroError,
  onChange,
}: {
  campo: CampoFormato;
  valores: Record<string, string>;
  editable: boolean;
  error?: string;
  otroError?: string;
  onChange(codigo: string, valor: string): void;
}) {
  const id = useId();
  const valor = valores[campo.codigo] ?? '';
  const cambiar = (nuevo: string) => onChange(campo.codigo, nuevo);
  const seleccionados = listaRespuesta(valor);
  const identidad = [
    'nombreEstudiante',
    'nombreTutor',
    'codigo',
    'escuela',
    'ciclo',
    'gruposAsignados',
    'estudiantesAsignados',
    'individuales',
    'grupales',
    'atendidosIndividual',
    'atendidosGrupal',
    'ciclosIndividual',
    'ciclosGrupal',
  ].includes(campo.codigo);
  const otro = valor === 'Otro' || (campo.tipo === 'multiple' && seleccionados.includes('Otro'));
  const descripcion =
    `${campo.ayuda ? `${id}-ayuda ` : ''}${error ? `${id}-error` : ''}`.trim() || undefined;
  const opciones = campo.tipo === 'booleano' ? ['Sí', 'No'] : (campo.opciones ?? []);
  const escoger = (opcion: string) => {
    const exclusivas = [
      'Ninguna',
      'Ninguno',
      'Solo estudio',
      'Aún ninguno',
      'No he tenido',
      'No',
      'Prefiero conversarlo con mi tutor',
    ];
    const nuevos = seleccionados.includes(opcion)
      ? seleccionados.filter((v) => v !== opcion)
      : exclusivas.includes(opcion)
        ? [opcion]
        : [...seleccionados.filter((v) => !exclusivas.includes(v)), opcion];
    cambiar(campo.tipo === 'multiple' ? JSON.stringify(nuevos) : opcion);
  };
  let control;
  if (!editable) {
    const texto = campo.tipo === 'multiple' ? seleccionados.join(' · ') : valor;
    control =
      campo.tipo === 'tabla' ? (
        <div className="tutoring-rows">
          {filasRespuesta(valor).length ? (
            filasRespuesta(valor).map((fila, i) => (
              <dl className="tutoring-read-row" key={i}>
                {campo.columnas?.map((columna) => (
                  <div key={columna.codigo}>
                    <dt>{columna.etiqueta}</dt>
                    <dd>{fila[columna.codigo] || 'Sin respuesta'}</dd>
                  </div>
                ))}
              </dl>
            ))
          ) : (
            <p className="muted small">Sin registros</p>
          )}
        </div>
      ) : (
        <p className="tutoring-answer">
          {texto || 'Sin respuesta'}
          {otro && valores[`${campo.codigo}__otro`] ? `: ${valores[`${campo.codigo}__otro`]}` : ''}
        </p>
      );
  } else if (['multiple', 'escala', 'booleano'].includes(campo.tipo)) {
    control = (
      <div
        className={`tutoring-options${campo.tipo === 'multiple' ? ' tutoring-options--multi' : ''}`}
        role={campo.tipo === 'multiple' ? 'group' : 'radiogroup'}
        aria-labelledby={`${id}-label`}
        aria-required={campo.tipo === 'multiple' ? undefined : campo.obligatorio}
        aria-invalid={Boolean(error)}
        aria-describedby={descripcion}
      >
        {opciones.map((opcion) => (
          <label className="tutoring-option" key={opcion}>
            <input
              type={campo.tipo === 'multiple' ? 'checkbox' : 'radio'}
              name={id}
              value={opcion}
              checked={
                campo.tipo === 'multiple' ? seleccionados.includes(opcion) : valor === opcion
              }
              onChange={() => escoger(opcion)}
            />
            <span>{opcion}</span>
          </label>
        ))}
      </div>
    );
  } else if (campo.tipo === 'tabla') {
    control = <TablaRespuestas campo={campo} valor={valor} onChange={cambiar} />;
  } else if (campo.tipo === 'seleccion') {
    control = (
      <select
        id={id}
        className="select"
        value={valor}
        onChange={(e) => cambiar(e.target.value)}
        aria-required={campo.obligatorio}
        aria-invalid={Boolean(error)}
        aria-describedby={descripcion}
      >
        <option value="">Selecciona una opción</option>
        {valor && !opciones.includes(valor) && <option value={valor}>{valor}</option>}
        {opciones.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    );
  } else if (campo.tipo === 'texto-largo') {
    control = (
      <textarea
        id={id}
        className="textarea"
        rows={3}
        value={valor}
        maxLength={1000}
        onChange={(e) => cambiar(e.target.value)}
        aria-required={campo.obligatorio}
        aria-invalid={Boolean(error)}
        aria-describedby={descripcion}
        placeholder="Una respuesta breve es suficiente."
      />
    );
  } else {
    const tipo =
      campo.tipo === 'numero'
        ? 'number'
        : campo.tipo === 'fecha'
          ? 'date'
          : campo.tipo === 'hora'
            ? 'time'
            : campo.codigo === 'correo'
              ? 'email'
              : campo.codigo.toLowerCase().includes('telefono')
                ? 'tel'
                : 'text';
    control = (
      <input
        id={id}
        type={tipo}
        min={tipo === 'number' ? 0 : undefined}
        step={tipo === 'number' ? 'any' : undefined}
        className="input"
        value={valor}
        maxLength={tipo === 'text' ? 200 : undefined}
        readOnly={identidad}
        aria-required={campo.obligatorio}
        aria-invalid={Boolean(error)}
        aria-describedby={descripcion}
        onChange={(e) => cambiar(e.target.value)}
      />
    );
  }
  const grupo = ['multiple', 'escala', 'booleano', 'tabla'].includes(campo.tipo);
  return (
    <div
      className={`tutoring-field${error ? ' tutoring-field--error' : ''}`}
      data-field={campo.codigo}
    >
      {grupo ? (
        <div className="tutoring-field__label" id={`${id}-label`}>
          {campo.etiqueta}
          {editable && campo.obligatorio && <span> *</span>}
        </div>
      ) : (
        <label className="tutoring-field__label" htmlFor={editable ? id : undefined}>
          {campo.etiqueta}
          {editable && campo.obligatorio && <span> *</span>}
        </label>
      )}
      {control}
      {editable && identidad && (
        <span className="field__hint">Dato precargado de tu expediente.</span>
      )}
      {campo.ayuda && (
        <span id={`${id}-ayuda`} className="field__hint">
          {campo.ayuda}
        </span>
      )}
      {error && (
        <span className="field__error" id={`${id}-error`}>
          {error}
        </span>
      )}
      {editable && otro && (
        <div className="tutoring-other">
          <label htmlFor={`${id}-otro`}>¿Cuál? *</label>
          <input
            id={`${id}-otro`}
            className="input"
            value={valores[`${campo.codigo}__otro`] ?? ''}
            maxLength={200}
            onChange={(e) => onChange(`${campo.codigo}__otro`, e.target.value)}
            aria-required="true"
            aria-invalid={Boolean(otroError)}
            aria-describedby={otroError ? `${id}-otro-error` : undefined}
          />
          {otroError && (
            <span className="field__error" id={`${id}-otro-error`}>
              {otroError}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function TablaRespuestas({
  campo,
  valor,
  onChange,
}: {
  campo: CampoFormato;
  valor: string;
  onChange(valor: string): void;
}) {
  const filas = filasRespuesta(valor);
  const id = useId();
  function actualizar(indice: number, codigo: string, nuevo: string) {
    const estudiante =
      codigo === 'nombre'
        ? estudiantePorId(
            asignaciones.find((a) => {
              const e = estudiantePorId(a.estudianteId);
              return e && nombreCompleto(e) === nuevo;
            })?.estudianteId ?? '',
          )
        : undefined;
    const datos = estudiante
      ? {
          estudianteId: estudiante.id,
          ciclo: String(estudiante.ciclo),
          grupo: asignaciones.find((a) => a.estudianteId === estudiante.id)?.grupo ?? '',
        }
      : {};
    onChange(
      JSON.stringify(
        filas.map((fila, i) => (i === indice ? { ...fila, ...datos, [codigo]: nuevo } : fila)),
      ),
    );
  }
  return (
    <div className="tutoring-rows">
      {filas.map((fila, i) => (
        <div className="tutoring-edit-row" key={i}>
          <div className="tutoring-edit-row__head">
            <strong>Registro {i + 1}</strong>
            <button
              type="button"
              className="btn btn-link"
              aria-label={`Quitar registro ${i + 1} de ${campo.etiqueta}`}
              onClick={() => onChange(JSON.stringify(filas.filter((_, n) => n !== i)))}
            >
              <Trash aria-hidden="true" /> Quitar
            </button>
          </div>
          <div className="tutoring-row-fields">
            {campo.columnas?.map((columna) => (
              <div className="field" key={columna.codigo}>
                <label htmlFor={`${id}-${i}-${columna.codigo}`}>{columna.etiqueta}</label>
                {columna.tipo === 'seleccion' ? (
                  <select
                    id={`${id}-${i}-${columna.codigo}`}
                    className="select"
                    value={fila[columna.codigo] ?? ''}
                    onChange={(e) => actualizar(i, columna.codigo, e.target.value)}
                  >
                    <option value="">Selecciona</option>
                    {columna.opciones?.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={`${id}-${i}-${columna.codigo}`}
                    className="input"
                    type={
                      columna.tipo === 'numero'
                        ? 'number'
                        : columna.tipo === 'fecha'
                          ? 'date'
                          : 'text'
                    }
                    min={0}
                    maxLength={200}
                    step={columna.codigo === 'horas' ? '0.5' : '1'}
                    value={fila[columna.codigo] ?? ''}
                    onChange={(e) => actualizar(i, columna.codigo, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      {filas.length === 0 && <p className="small muted">Agrega un registro para comenzar.</p>}
      <button
        type="button"
        className="btn btn-falcon-default"
        onClick={() =>
          onChange(
            JSON.stringify([
              ...filas,
              Object.fromEntries((campo.columnas ?? []).map((columna) => [columna.codigo, ''])),
            ]),
          )
        }
      >
        <Plus aria-hidden="true" /> Agregar registro
      </button>
    </div>
  );
}
