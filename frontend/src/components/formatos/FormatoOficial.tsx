import { useEffect, useEffectEvent, useRef, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { CodigoFormato } from '../../types/domain';
import type { DocumentoFormato } from '../../utils/exportFormatos';
import { Formato01, Formato02, Formato09 } from './FormatosGestion';
import { Formato03, Formato04, Formato05 } from './FormatosEntrevista';
import { Formato06, Formato07, Formato08, Formato12 } from './FormatosRegistro';
import { Formato10, Formato11 } from './FormatosEvaluacion';
import '../../styles/formato-oficial.css';

const FORMATOS: Record<CodigoFormato, ComponentType<{ documento: DocumentoFormato }>> = {
  F01: Formato01,
  F02: Formato02,
  F03: Formato03,
  F04: Formato04,
  F05: Formato05,
  F06: Formato06,
  F07: Formato07,
  F08: Formato08,
  F09: Formato09,
  F10: Formato10,
  F11: Formato11,
  F12: Formato12,
};

/** Dibuja un formato con el diseño del anexo de la Resolución N.º 500-2022-CU-R-UNAS. */
export function FormatoOficial({ documento }: { documento: DocumentoFormato }) {
  const Formato = FORMATOS[documento.formato];
  return <Formato documento={documento} />;
}

/** Ancho de la hoja A4 (210 mm a 96 ppp) más el margen del marco de la vista previa. */
const ANCHO_HOJA = 794;

/** Una o varias hojas seguidas: los formatos de un paquete, en orden. */
export function HojasFormatos({ documentos }: { documentos: DocumentoFormato[] }) {
  return documentos.map((documento) => <FormatoOficial key={documento.id} documento={documento} />);
}

/**
 * Vista previa a escala: la hoja conserva sus medidas A4 y se reduce para
 * caber en pantallas angostas sin desbordar la página.
 */
export function VistaPreviaHojas({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: ReactNode;
}) {
  const marco = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(1);
  useEffect(() => {
    const elemento = marco.current;
    if (!elemento || typeof ResizeObserver === 'undefined') return;
    const observador = new ResizeObserver(([entrada]) => {
      const ancho = entrada?.contentRect.width ?? 0;
      if (ancho > 0) setEscala(Math.min(1, ancho / ANCHO_HOJA));
    });
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);
  return (
    <div ref={marco} className="fo-vista" role="region" aria-label={etiqueta} tabIndex={0}>
      <div className="fo-vista__hojas" style={{ zoom: escala }}>
        {children}
      </div>
    </div>
  );
}

export function VistaPreviaFormatos({
  documentos,
  etiqueta,
}: {
  documentos: DocumentoFormato[];
  etiqueta: string;
}) {
  return (
    <VistaPreviaHojas etiqueta={etiqueta}>
      <HojasFormatos documentos={documentos} />
    </VistaPreviaHojas>
  );
}

/**
 * Abre el diálogo de impresión del navegador con solo las hojas indicadas.
 * «Guardar como PDF» produce el archivo; el título del documento se usa como
 * nombre sugerido.
 */
export function ImpresionFormatos({
  titulo,
  onTerminar,
  children,
}: {
  titulo: string;
  onTerminar(): void;
  children: ReactNode;
}) {
  const terminar = useEffectEvent(onTerminar);
  useEffect(() => {
    const tituloAnterior = document.title;
    document.title = titulo;
    document.body.classList.add('fo-imprimiendo');
    const alCerrar = () => terminar();
    window.addEventListener('afterprint', alCerrar);
    // Un ciclo de pintado antes de imprimir: las hojas deben estar en el DOM.
    const temporizador = window.setTimeout(() => window.print(), 80);
    return () => {
      window.clearTimeout(temporizador);
      window.removeEventListener('afterprint', alCerrar);
      document.title = tituloAnterior;
      document.body.classList.remove('fo-imprimiendo');
    };
  }, [titulo]);
  return createPortal(<div className="fo-impresion">{children}</div>, document.body);
}
