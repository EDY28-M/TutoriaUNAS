import { useState } from 'react';
import { Info } from '../ui/icons';
import type { CampoFormato, DefinicionFormato, Instrumento } from '../../types/domain';
import { Alert } from '../ui/Alert';
import { Badge, StatusBadge } from '../ui/StatusBadge';
import { Progress } from '../ui/Progress';
import { Field, ScaleInput, SelectInput, TextArea, TextInput } from './Field';
import { formatFecha } from '../../utils/fechas';

interface InstrumentFormProps {
  definicion: DefinicionFormato;
  instrumento: Instrumento | null;
  /** Permite editar los campos (borrador). Si es falso, se muestra solo lectura. */
  editable?: boolean;
}

function valorInicial(campo: CampoFormato, instrumento: Instrumento | null): string {
  const respuestas = instrumento?.respuestas ?? {};
  return respuestas[campo.codigo] ?? '';
}

/**
 * Renderiza un instrumento oficial a partir de su definición: agrupa los campos
 * por secciones, respeta el tipo de cada campo y muestra el estado del registro,
 * sus observaciones y el aviso de vigencia pendiente.
 */
export function InstrumentForm({ definicion, instrumento, editable = false }: InstrumentFormProps) {
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      definicion.secciones
        .flatMap((seccion) => seccion.campos)
        .map((campo) => [campo.codigo, valorInicial(campo, instrumento)]),
    ),
  );

  function actualizar(codigo: string, valor: string) {
    setValores((actual) => ({ ...actual, [codigo]: valor }));
  }

  const obligatorios = definicion.secciones
    .flatMap((seccion) => seccion.campos)
    .filter((campo) => campo.obligatorio);
  const completados = obligatorios.filter((campo) => valores[campo.codigo]).length;

  return (
    <div className="stack">
      <div className="ui-row ui-row--between ui-row--wrap">
        <div className="ui-row ui-row--tight ui-row--wrap">
          <Badge mono>Formato {definicion.numero}</Badge>
          <Badge tone={definicion.obligatorio ? 'alerta' : 'info'}>
            {definicion.obligatorio ? 'Obligatorio' : 'Opcional'}
          </Badge>
          <Badge tone="violeta">{definicion.actorEtiqueta}</Badge>
        </div>
        <span className="small muted">
          {completados} de {obligatorios.length} campos obligatorios
        </span>
      </div>

      {instrumento && (
        <div className="ui-row ui-row--between ui-row--wrap">
          <span className="ui-row ui-row--tight">
            <StatusBadge estado={instrumento.estado} contexto="formulario" />
            <span className="small muted">
              Versión {instrumento.version} · actualizado el {formatFecha(instrumento.actualizado)}
            </span>
          </span>
          <span style={{ minWidth: 180 }}>
            <Progress valor={instrumento.avance} etiqueta="Avance" mostrarValor />
          </span>
        </div>
      )}

      <Alert tone="info" title="Periodo de uso por confirmar">
        Este formulario se basa en la Resolución N.º 500-2022-CU-R-UNAS. El área de tutoría debe
        confirmar sus reglas antes de usarlo. Esta demostración no guarda respuestas reales.
      </Alert>

      {definicion.secciones.map((seccion) => (
        <section className="card" key={seccion.titulo}>
          <header className="card__head">
            <div>
              <h3 style={{ fontSize: '0.92rem' }}>{seccion.titulo}</h3>
              <p>
                {seccion.campos.length} campo(s) ·{' '}
                {seccion.campos.filter((campo) => campo.obligatorio).length} obligatorio(s)
              </p>
            </div>
          </header>
          <div className="card__body">
            <div className="field-grid field-grid--2">
              {seccion.campos.map((campo) => (
                <CampoInstrumento
                  key={campo.codigo}
                  campo={campo}
                  valor={valores[campo.codigo] ?? ''}
                  editable={editable}
                  onChange={(valor) => actualizar(campo.codigo, valor)}
                />
              ))}
            </div>
          </div>
        </section>
      ))}

      {instrumento && instrumento.observaciones.length > 0 && (
        <section className="card">
          <header className="card__head">
            <div>
              <h3 style={{ fontSize: '0.92rem' }}>Observaciones de revisión</h3>
              <p>Revisa las correcciones solicitadas antes de volver a enviar el formulario.</p>
            </div>
          </header>
          <div className="card__body card__body--flush">
            <ul className="list">
              {instrumento.observaciones.map((observacion) => (
                <li className="list__item" key={observacion.id}>
                  <span className="list__icon list__icon--warn" aria-hidden="true">
                    <Info />
                  </span>
                  <span className="list__body">
                    <strong>{observacion.autor}</strong>
                    <p>{observacion.texto}</p>
                    <span className="list__meta">{formatFecha(observacion.fecha)}</span>
                  </span>
                  <span className="list__aside">
                    <StatusBadge estado={observacion.estado} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="card">
        <header className="card__head">
          <div>
            <h3 style={{ fontSize: '0.92rem' }}>Firmas de aprobación y versión del formulario</h3>
            <p>{definicion.aprobacion}</p>
          </div>
        </header>
        <div className="card__body">
          <dl className="meta-list">
            <div>
              <dt>Quién lo completa</dt>
              <dd>{definicion.actorEtiqueta}</dd>
            </div>
            <div>
              <dt>Momento de uso</dt>
              <dd>{definicion.momento}</dd>
            </div>
            <div>
              <dt>Periodicidad</dt>
              <dd>{definicion.periodicidad}</dd>
            </div>
            <div>
              <dt>Destinatario</dt>
              <dd>{definicion.destinatario}</dd>
            </div>
            <div>
              <dt>Versión</dt>
              <dd>{definicion.version}</dd>
            </div>
            <div>
              <dt>Vigencia</dt>
              <dd>{definicion.vigencia}</dd>
            </div>
          </dl>
          <div className="field-grid field-grid--2" style={{ marginTop: 14 }}>
            {definicion.secciones.length > 0 && (
              <div>
                <p className="field__label" style={{ marginBottom: 6 }}>
                  Firmas de aprobación requeridas
                </p>
                <div className="ui-row ui-row--wrap ui-row--tight">
                  {definicion.visaciones.map((visacion) => (
                    <Badge key={visacion} tone="ok">
                      {visacion}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function CampoInstrumento({
  campo,
  valor,
  editable,
  onChange,
}: {
  campo: CampoFormato;
  valor: string;
  editable: boolean;
  onChange(valor: string): void;
}) {
  const etiqueta = campo.etiqueta;

  if (campo.tipo === 'escala' && campo.opciones) {
    return (
      <Field label={etiqueta} hint={campo.ayuda} required={campo.obligatorio}>
        <ScaleInput
          nombre={campo.codigo}
          opciones={campo.opciones}
          valor={valor}
          onChange={(nuevo) => editable && onChange(nuevo)}
        />
      </Field>
    );
  }

  if (
    (campo.tipo === 'seleccion' || campo.tipo === 'booleano' || campo.tipo === 'multiple') &&
    campo.opciones
  ) {
    return (
      <Field label={etiqueta} hint={campo.ayuda} required={campo.obligatorio}>
        <SelectInput
          value={valor}
          disabled={!editable}
          onChange={(evento) => onChange(evento.target.value)}
          opciones={['', ...campo.opciones]}
        />
      </Field>
    );
  }

  if (campo.tipo === 'texto-largo' || campo.tipo === 'tabla') {
    return (
      <div style={{ gridColumn: '1 / -1' }}>
        <Field label={etiqueta} hint={campo.ayuda} required={campo.obligatorio}>
          <TextArea
            value={valor}
            readOnly={!editable}
            onChange={(evento) => onChange(evento.target.value)}
            placeholder={editable ? 'Escribe aquí…' : 'Sin registrar'}
          />
        </Field>
      </div>
    );
  }

  return (
    <Field label={etiqueta} hint={campo.ayuda} required={campo.obligatorio}>
      <TextInput
        type={
          campo.tipo === 'fecha'
            ? 'date'
            : campo.tipo === 'hora'
              ? 'time'
              : campo.tipo === 'numero'
                ? 'number'
                : 'text'
        }
        value={valor}
        readOnly={!editable}
        onChange={(evento) => onChange(evento.target.value)}
        placeholder={editable ? 'Escribe aquí…' : 'Sin registrar'}
      />
    </Field>
  );
}
