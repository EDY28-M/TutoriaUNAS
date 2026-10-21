/**
 * Aviso estático mientras se descarga una ruta. Sus estilos son globales para
 * que no dependa de la hoja del panel que todavía se está cargando.
 */
export function PageLoading() {
  return (
    <div className="page-loading" role="status" aria-live="polite">
      Cargando…
    </div>
  );
}
