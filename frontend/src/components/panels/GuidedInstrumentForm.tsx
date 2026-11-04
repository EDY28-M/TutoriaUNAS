import { useId, useRef, useState } from 'react';
import {
  FormProvider,
  useController,
  useFieldArray,
  useFormContext,
  useWatch,
} from 'react-hook-form';
import type { ControllerRenderProps, FieldPath } from 'react-hook-form';
import { useFormularioInstrumento } from '../../hooks/useFormularioInstrumento';
import { ApiError } from '../../services/apiClient';
import { OPCIONES_EXCLUSIVAS, serializarFormulario } from '../../utils/validacionInstrumentos';
import type { ValoresFormularioInstrumento } from '../../utils/validacionInstrumentos';
import type { CampoFormato, DefinicionFormato, Instrumento } from '../../types/domain';
import { Alert } from '../ui/Alert';
import { Progress } from '../ui/Progress';
import { ArrowLeft, ArrowRight, Check, CircleCheck, Plus, Send, Trash } from '../ui/icons';
import { asignaciones } from '../../data/tutoria';
import { estudiantePorId, nombreCompleto } from '../../data/personas';
import { usePortal } from '../../hooks/usePortal';
import { esEntrevista } from '../../utils/entrevistas';
import { preguntasRegistradas } from '../../utils/preguntasPendientes';
import '../../styles/tutoring-workspace.css';
import {
  avanceInstrumento,
  campoVisible,
  filasRespuesta,
  listaRespuesta,
  etapaDeFormato,
  respuestasVisibles,
} from '../../utils/instrumentos';

interface Props {
  definicion: DefinicionFormato;
  instrumento: Instrumento;
  editable?: boolean;
  puedeEnviar?: boolean;
  compacto?: boolean;
  onGuardar?(
    respuestas: Record<string, string>,
    enviar: boolean,
    version?: number,
  ): void | Instrumento | Promise<void | Instrumento>;
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
  const { formulario, contexto, valores, valoresIniciales, errores } = useFormularioInstrumento(
    definicion,
    instrumento,
    portal,
    editable,
  );
  const esEvaluacion = ['F10', 'F11'].includes(instrumento.formato);
  const entrevista = esEntrevista(instrumento.formato);
  const deReferencia = new Set([
    'nombreEstudiante',
    'codigo',
    'ciclo',
    'escuela',
    'nombreTutor',
    'telefonoTutor',
    'semestre',
    'correo',
    'telefono',
    'apoderado',
    'facultad',
    'comision',
    'gruposAsignados',
    'estudiantesAsignados',
    'atendidosIndividual',
    'atendidosGrupal',
    'ciclosIndividual',
    'ciclosGrupal',
    'individuales',
    'grupales',
    ...(esEvaluacion ? ['fecha', 'grupo', 'turno'] : []),
    ...(instrumento.formato === 'F12' ? ['area', 'motivo', 'detalle'] : []),
  ]);
  const registrados = new Set(
    [...preguntasRegistradas(contexto, valoresIniciales)].filter(
      (c) => entrevista || deReferencia.has(c),
    ),
  );
  const [mostrarRegistrados, setMostrarRegistrados] = useState(false);
  const secciones = contexto.secciones;
  const pasos = secciones.flatMap((s, i) =>
    registrados.size === 0 ||
    mostrarRegistrados ||
    s.campos.some((c) => campoVisible(c, valores) && !registrados.has(c.codigo))
      ? [i]
      : [],
  );
  const [pasoElegido, setPaso] = useState(() => pasos[0] ?? secciones.length);
  const paso = pasos.includes(pasoElegido)
    ? pasoElegido
    : (pasos.find((i) => i >= pasoElegido) ?? secciones.length);
  const indicePaso = pasos.indexOf(paso);
  const [mensaje, setMensaje] = useState('');
  const [fallo, setFallo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const guardadoEnCurso = useRef(false);
  const versionVista = useRef(instrumento.version);
  const [confirmacion, setConfirmacion] = useState<string | null>(null);
  const confirmado = confirmacion === JSON.stringify(valores);
  const cabecera = useRef<HTMLHeadingElement>(null);
  const resumenError = useRef<HTMLDivElement>(null);
  const resumen = paso === secciones.length;
  const seccion = secciones[paso];
  function alEditar(codigo: string, tabla = false) {
    const limpiar: FieldPath<ValoresFormularioInstrumento>[] = [
      (tabla
        ? `tablas.${codigo}`
        : `respuestas.${codigo}`) as FieldPath<ValoresFormularioInstrumento>,
    ];
    const actuales = serializarFormulario(formulario.getValues());
    for (const campo of secciones.flatMap((s) => s.campos)) {
      if (!campoVisible(campo, actuales))
        limpiar.push(
          (campo.tipo === 'tabla'
            ? `tablas.${campo.codigo}`
            : `respuestas.${campo.codigo}`) as FieldPath<ValoresFormularioInstrumento>,
        );
      if (
        !campoVisible(campo, actuales) ||
        (actuales[campo.codigo] !== 'Otro' &&
          !listaRespuesta(actuales[campo.codigo] ?? '').includes('Otro'))
      )
        limpiar.push(`respuestas.${campo.codigo}__otro`);
    }
    formulario.clearErrors(limpiar);
    setMensaje('');
    setFallo('');
    setConfirmacion(null);
  }
  function actualizar(codigo: string, valor: string) {
    formulario.setValue(`respuestas.${codigo}`, valor, { shouldDirty: true, shouldTouch: true });
    alEditar(codigo);
  }
  function ir(destino: number) {
    setPaso(destino);
    requestAnimationFrame(() => {
      cabecera.current?.focus();
      cabecera.current?.scrollIntoView({ block: 'start' });
    });
  }
  async function guardar(enviar: boolean) {
    if (guardadoEnCurso.current) return false;
    guardadoEnCurso.current = true;
    setGuardando(true);
    setFallo('');
    try {
      const resultado = await onGuardar?.(
        respuestasVisibles(contexto, serializarFormulario(formulario.getValues())),
        enviar,
        versionVista.current,
      );
      if (resultado) versionVista.current = resultado.version;
      setMensaje(enviar ? 'Formulario enviado.' : 'Borrador guardado. Puedes continuar después.');
      return true;
    } catch (error) {
      if (error instanceof ApiError) {
        for (const [codigo, mensajes] of Object.entries(error.errors))
          formulario.setError(
            (contexto.secciones.some((s) =>
              s.campos.some((c) => c.codigo === codigo && c.tipo === 'tabla'),
            )
              ? `tablas.${codigo}`
              : `respuestas.${codigo}`) as FieldPath<ValoresFormularioInstrumento>,
            { type: 'server', message: mensajes[0] ?? 'Revisa la respuesta.' },
          );
      }
      setFallo(error instanceof Error ? error.message : 'No pudimos guardar. Intenta nuevamente.');
      return false;
    } finally {
      guardadoEnCurso.current = false;
      setGuardando(false);
    }
  }
  async function continuar() {
    const campos: FieldPath<ValoresFormularioInstrumento>[] =
      seccion?.campos
        .filter((campo) => campoVisible(campo, valores))
        .flatMap(
          (campo) =>
            [
              campo.tipo === 'tabla' ? `tablas.${campo.codigo}` : `respuestas.${campo.codigo}`,
              `respuestas.${campo.codigo}__otro`,
            ] as FieldPath<ValoresFormularioInstrumento>[],
        ) ?? [];
    if (!(await formulario.trigger(campos))) {
      requestAnimationFrame(() => resumenError.current?.focus());
      return;
    }
    if (!onGuardar || (await guardar(false))) ir(pasos[indicePaso + 1] ?? secciones.length);
  }
  async function enviar() {
    if (!(await formulario.trigger())) {
      setFallo('Revisa las preguntas pendientes antes de enviar.');
      requestAnimationFrame(() => resumenError.current?.focus());
      return;
    }
    if (!confirmado) {
      setFallo('Confirma que revisaste tus respuestas.');
      return;
    }
    await guardar(true);
  }
  function bloque(
    seccionActual: (typeof secciones)[number],
    lectura: boolean,
    solo?: 'pendientes',
  ) {
    return (
      <div className="tutoring-fields">
        {seccionActual.campos
          .filter((campo) => campoVisible(campo, valores))
          .filter((campo) => !solo || !registrados.has(campo.codigo))
          .map((campo) => {
            const Campo = campo.tipo === 'tabla' ? RespuestaCampo : RespuestaRegistrada;
            return (
              <Campo
                key={campo.codigo}
                campo={campo}
                valores={valores}
                editable={
                  !lectura &&
                  !(
                    [
                      'nombreEstudiante',
                      'codigo',
                      'ciclo',
                      'escuela',
                      'nombreTutor',
                      'semestre',
                    ].includes(campo.codigo) && Boolean(valoresIniciales[campo.codigo])
                  ) &&
                  !(
                    esEvaluacion &&
                    ['grupo', 'fecha', 'turno', 'nombreTutor'].includes(campo.codigo)
                  )
                }
                error={errores[campo.codigo]}
                otroError={errores[`${campo.codigo}__otro`]}
                onChange={actualizar}
                onTablaEditada={() => alEditar(campo.codigo, true)}
              />
            );
          })}
      </div>
    );
  }
  if (!editable)
    return (
      <FormProvider {...formulario}>
        <div className="tutoring-form tutoring-form--read">
          {secciones.map((s) => (
            <section key={s.titulo} className="tutoring-review-section">
              <h3>{s.titulo}</h3>
              {bloque(s, true)}
            </section>
          ))}
        </div>
      </FormProvider>
    );
  return (
    <FormProvider {...formulario}>
      <div className="tutoring-form">
        <div className="tutoring-form__progress">
          <span className="small">
            {resumen ? 'Revisión final' : `Paso ${indicePaso + 1} de ${pasos.length}`}
            {!compacto && ` · Formato ${definicion.numero}`}
          </span>
          <Progress valor={avanceInstrumento(contexto, valores)} etiqueta="Respuestas completas" />
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
              {[...pasos, secciones.length].map((indice, i) => (
                <option key={indice} value={indice}>
                  {i + 1}. {secciones[indice]?.titulo ?? 'Revisar y enviar'}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <nav className="tutoring-steps" aria-label="Pasos del formulario">
            {[...pasos, secciones.length].map((indice, i) => (
              <button
                key={indice}
                type="button"
                aria-current={paso === indice ? 'step' : undefined}
                aria-label={`${i + 1}. ${secciones[indice]?.titulo ?? 'Revisar y enviar'}`}
                title={secciones[indice]?.titulo ?? 'Revisar y enviar'}
                onClick={() => ir(indice)}
              >
                <span>{indice < paso ? <Check aria-hidden="true" /> : i + 1}</span>
                <span>{secciones[indice]?.titulo ?? 'Revisar y enviar'}</span>
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
                    <button
                      type="button"
                      onClick={() => {
                        setMostrarRegistrados(true);
                        ir(Math.max(indice, 0));
                      }}
                    >
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
                <button
                  type="button"
                  className="btn btn-link"
                  onClick={() => {
                    setMostrarRegistrados(true);
                    ir(i);
                  }}
                >
                  Editar esta sección
                </button>
              </details>
            ))}
            <label className="tutoring-confirm">
              <input
                type="checkbox"
                checked={confirmado}
                onChange={(event) =>
                  setConfirmacion(event.target.checked ? JSON.stringify(valores) : null)
                }
              />
              <span>He revisado mis respuestas y deseo enviarlas.</span>
            </label>
            {!puedeEnviar && (
              <Alert
                tone="info"
                title={
                  etapaDeFormato(definicion.codigo) === 'inicio'
                    ? 'Envío al inicio del semestre'
                    : 'Envío al cierre del semestre'
                }
              >
                {etapaDeFormato(definicion.codigo) === 'inicio'
                  ? 'La entrevista inicial se completa al inicio del semestre. Puedes guardar el borrador.'
                  : 'Puedes preparar y guardar el borrador. El envío se habilita al finalizar el semestre.'}
              </Alert>
            )}
          </>
        ) : (
          seccion && bloque(seccion, false, !mostrarRegistrados ? 'pendientes' : undefined)
        )}
        <div className="tutoring-form__actions">
          {(resumen ? pasos.length > 0 : indicePaso > 0) && (
            <button
              type="button"
              className="btn btn-falcon-default"
              onClick={() => ir(resumen ? pasos.at(-1)! : pasos[indicePaso - 1]!)}
            >
              <ArrowLeft aria-hidden="true" /> Atrás
            </button>
          )}
          {onGuardar && (
            <button
              type="button"
              className="btn btn-falcon-default"
              disabled={guardando}
              onClick={() => {
                void guardar(false);
              }}
            >
              Guardar borrador
            </button>
          )}
          {resumen ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={guardando || !puedeEnviar || !onGuardar}
              onClick={enviar}
            >
              <Send aria-hidden="true" /> Enviar formulario
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              disabled={guardando}
              onClick={continuar}
            >
              {indicePaso === pasos.length - 1 ? 'Revisar respuestas' : 'Continuar'}{' '}
              <ArrowRight aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </FormProvider>
  );
}

function RespuestaRegistrada(props: Parameters<typeof RespuestaCampo>[0]) {
  const { control } = useFormContext<ValoresFormularioInstrumento>();
  const { field } = useController({
    control,
    name: `respuestas.${props.campo.codigo}`,
    defaultValue: props.valores[props.campo.codigo] ?? '',
  });
  return (
    <RespuestaCampo
      {...props}
      registro={{ name: field.name, ref: field.ref, onBlur: field.onBlur }}
      onChange={(codigo, valor) => {
        if (codigo === props.campo.codigo) field.onChange(valor);
        props.onChange(codigo, valor);
      }}
    />
  );
}

function RespuestaCampo({
  campo,
  valores,
  editable,
  error,
  otroError,
  onChange,
  onTablaEditada,
  registro,
}: {
  campo: CampoFormato;
  valores: Record<string, string>;
  editable: boolean;
  error?: string;
  otroError?: string;
  onChange(codigo: string, valor: string): void;
  onTablaEditada(): void;
  registro?: Pick<
    ControllerRenderProps<ValoresFormularioInstrumento, `respuestas.${string}`>,
    'name' | 'ref' | 'onBlur'
  >;
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
    const exclusivas = OPCIONES_EXCLUSIVAS;
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
              {...registro}
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
    control = <TablaRespuestas campo={campo} onEditar={onTablaEditada} />;
  } else if (campo.tipo === 'seleccion') {
    control = (
      <select
        {...registro}
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
        {...registro}
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
        {...registro}
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

function TablaRespuestas({ campo, onEditar }: { campo: CampoFormato; onEditar(): void }) {
  const { control, setValue } = useFormContext<ValoresFormularioInstrumento>();
  const name = `tablas.${campo.codigo}` as const;
  const { fields, append, remove } = useFieldArray({ control, name });
  const filas = useWatch({ control, name }) ?? [];
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
      : codigo === 'nombre'
        ? { estudianteId: '', ciclo: '', grupo: '' }
        : {};
    // setValue conserva el montaje y el foco de la fila; la clave de RHF es estable.
    for (const [clave, contenido] of Object.entries({ ...datos, [codigo]: nuevo })) {
      setValue(`${name}.${indice}.${clave}`, contenido, { shouldDirty: true, shouldTouch: true });
    }
    onEditar();
  }
  return (
    <div className="tutoring-rows">
      {fields.map((field, i) => {
        const fila = filas[i] ?? {};
        return (
          <div className="tutoring-edit-row" key={field.id}>
            <div className="tutoring-edit-row__head">
              <strong>Registro {i + 1}</strong>
              <button
                type="button"
                className="btn btn-link"
                aria-label={`Quitar registro ${i + 1} de ${campo.etiqueta}`}
                onClick={() => {
                  remove(i);
                  onEditar();
                }}
              >
                <Trash aria-hidden="true" /> Quitar
              </button>
            </div>
            <div className="tutoring-row-fields">
              {campo.columnas?.map((columna) => (
                <div className="field" key={columna.codigo}>
                  <label htmlFor={`${id}-${field.id}-${columna.codigo}`}>{columna.etiqueta}</label>
                  {columna.tipo === 'seleccion' ? (
                    <select
                      id={`${id}-${field.id}-${columna.codigo}`}
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
                      id={`${id}-${field.id}-${columna.codigo}`}
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
        );
      })}
      {fields.length === 0 && <p className="small muted">Agrega un registro para comenzar.</p>}
      <button
        type="button"
        className="btn btn-falcon-default"
        onClick={() => {
          append(Object.fromEntries((campo.columnas ?? []).map((columna) => [columna.codigo, ''])));
          onEditar();
        }}
      >
        <Plus aria-hidden="true" /> Agregar registro
      </button>
    </div>
  );
}
