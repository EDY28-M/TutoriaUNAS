/** Explicaciones secundarias disponibles sin recargar la vista principal. */
export function ContextHelp({ text, subject }: { text: string; subject: string }) {
  return (
    <details className="context-help">
      <summary>
        Ver detalles<span className="sr-only"> de {subject}</span>
      </summary>
      <p>{text}</p>
    </details>
  );
}
