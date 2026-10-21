interface ProgressProps {
  valor: number;
  etiqueta?: string;
  variante?: 'verde' | 'dorado' | 'alerta' | 'riesgo';
  mostrarValor?: boolean;
}

/** Barra de avance con etiqueta opcional. */
export function Progress({
  valor,
  etiqueta,
  variante = 'verde',
  mostrarValor = true,
}: ProgressProps) {
  const porcentaje = Math.max(0, Math.min(100, Math.round(valor)));
  const clase =
    variante === 'dorado'
      ? 'tutorial-progress__bar--gold'
      : variante === 'alerta'
        ? 'tutorial-progress__bar--warn'
        : variante === 'riesgo'
          ? 'tutorial-progress__bar--danger'
          : '';
  return (
    <div className="tutorial-progress">
      {(etiqueta || mostrarValor) && (
        <div className="tutorial-progress__label">
          {etiqueta && <span>{etiqueta}</span>}
          {mostrarValor && <strong>{porcentaje}%</strong>}
        </div>
      )}
      <div
        className="tutorial-progress__track"
        role="progressbar"
        aria-valuenow={porcentaje}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={etiqueta ?? 'Avance'}
      >
        <div className={`tutorial-progress__bar ${clase}`} style={{ width: `${porcentaje}%` }} />
      </div>
    </div>
  );
}

/** Medidor compacto para usar dentro de tablas. */
export function Meter({ valor, sufijo = '%' }: { valor: number; sufijo?: string }) {
  const porcentaje = Math.max(0, Math.min(100, Math.round(valor)));
  return (
    <span className="meter">
      <span className="meter__track" aria-hidden="true">
        <span className="meter__bar" style={{ width: `${porcentaje}%` }} />
      </span>
      <span className="meter__value">
        {porcentaje}
        {sufijo}
      </span>
    </span>
  );
}
