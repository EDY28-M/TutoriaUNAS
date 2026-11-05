import type { ReactNode } from 'react';
import type { DocumentoFormato } from '../../utils/exportFormatos';
import { TITULOS_OFICIALES, marcaDe } from '../../utils/exportFormatos';

/**
 * Piezas comunes de los anexos de la Resolución N.º 500-2022-CU-R-UNAS.
 * Cada hoja replica la cabecera del documento oficial y su tabla bordeada;
 * las respuestas se distinguen de las etiquetas por el color de la tinta.
 * Los sellos y firmas del original no se reproducen.
 */

interface HojaProps {
  documento: DocumentoFormato;
  /** Las hojas siguientes de un mismo formato solo repiten la resolución. */
  continuacion?: boolean;
  children: ReactNode;
}

export function Hoja({ documento, continuacion = false, children }: HojaProps) {
  const { formato } = documento;
  const { titulo, actor } = TITULOS_OFICIALES[formato];
  const numero = formato.slice(1);
  const marca = marcaDe(documento);
  return (
    <article
      className="fo-hoja"
      aria-label={`Formato N.º ${numero}${continuacion ? ', continuación' : ''}`}
    >
      {marca === 'revision' && (
        <div className="fo-agua" aria-hidden="true">
          <span>Pendiente de revisión</span>
        </div>
      )}
      <p className="fo-resolucion">RESOLUCIÓN N° 500-2022-CU-R-UNAS</p>
      {!continuacion && (
        <header className="fo-cabecera">
          {formato === 'F01' && (
            <>
              <p>ANEXO</p>
              <p>INSTRUMENTOS PARA LA ACCIÓN TUTORIAL</p>
            </>
          )}
          <p>FORMATO N° {numero}</p>
          <h2>{titulo}</h2>
          <p className="fo-actor">{actor}</p>
        </header>
      )}
      <div className="fo-cuerpo">{children}</div>
      <footer className="fo-pie">
        <span>Tutoría UNAS · Formato N° {numero}</span>
        {marca === 'muestra' && <span className="fo-pie__marca">Muestra con datos ficticios</span>}
        {marca === 'revision' && (
          <span className="fo-pie__marca">Pendiente de revisión por coordinación</span>
        )}
      </footer>
    </article>
  );
}

/** «ETIQUETA: valor», como se llena a mano cada casilla del anexo. */
export function Campo({ etiqueta, valor }: { etiqueta: string; valor?: ReactNode }) {
  return (
    <>
      <span className="fo-etq">{etiqueta}:</span>{' '}
      {valor ? <span className="fo-val">{valor}</span> : null}
    </>
  );
}

/** Respuesta escrita en la casilla (tinta del formulario). */
export function Val({ children }: { children?: ReactNode }) {
  return children ? <span className="fo-val">{children}</span> : null;
}

/** Fila de título sombreada que separa los bloques del anexo. */
export function Seccion({
  children,
  columnas,
  izquierda = false,
}: {
  children: ReactNode;
  columnas: number;
  /** Algunos títulos del anexo van alineados a la izquierda y sin sombra. */
  izquierda?: boolean;
}) {
  return (
    <tr>
      <th
        className={izquierda ? 'fo-seccion fo-seccion--izq' : 'fo-seccion'}
        colSpan={columnas}
        scope="colgroup"
      >
        {children}
      </th>
    </tr>
  );
}

/** Casilla de marca: muestra la X cuando la opción fue elegida. */
export function Marca({ activa, etiqueta }: { activa: boolean; etiqueta: string }) {
  return (
    <td
      className="fo-marca"
      aria-label={activa ? `${etiqueta}: marcado` : `${etiqueta}: sin marca`}
    >
      {activa ? 'X' : ''}
    </td>
  );
}

/** Paréntesis del anexo: «( X ) Opción». */
export function Opcion({ activa, children }: { activa: boolean; children: ReactNode }) {
  return (
    <span className={`fo-opcion${activa ? ' fo-opcion--activa' : ''}`}>
      <span className="fo-opcion__caja" aria-hidden="true">
        ({activa ? 'X' : '  '})
      </span>{' '}
      {children}
      {activa && <span className="sr-only"> (marcado)</span>}
    </span>
  );
}

/** Lista con guiones, como los renglones «-» del documento original. */
export function Guiones({ items, minimo = 0 }: { items: string[]; minimo?: number }) {
  const renglones = [
    ...items,
    ...Array.from({ length: Math.max(0, minimo - items.length) }, () => ''),
  ];
  return (
    <ul className="fo-guiones">
      {renglones.map((item, i) => (
        <li key={i}>{item ? <span className="fo-val">{item}</span> : ' '}</li>
      ))}
    </ul>
  );
}

/** Pregunta numerada con su respuesta debajo, dentro de una fila de la tabla. */
export function Pregunta({
  numero,
  texto,
  columnas = 1,
  alta = false,
  children,
}: {
  numero?: number;
  texto: string;
  columnas?: number;
  alta?: boolean;
  children?: ReactNode;
}) {
  return (
    <tr className="fo-pregunta">
      <td colSpan={columnas} className={alta ? 'fo-alta' : undefined}>
        <p className="fo-pregunta__texto">
          {numero !== undefined && <span className="fo-pregunta__num">{numero}.</span>} {texto}
        </p>
        <div className="fo-pregunta__resp">{children}</div>
      </td>
    </tr>
  );
}
