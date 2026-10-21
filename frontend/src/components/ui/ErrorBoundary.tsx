import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Alert } from './Alert';
import { Card, CardBody, CardHead } from './Card';
import { reloadPage } from '../../utils/navigation';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Frontera de errores de la interfaz.
 *
 * Sin esta barrera, cualquier excepción durante el render deja la aplicación en
 * blanco sin explicación. Aquí se muestra un aviso en el idioma del sistema, se
 * conserva la sesión de demostración y se ofrecen dos salidas: reintentar el
 * módulo o volver al acceso.
 *
 * En la integración institucional, `componentDidCatch` es el punto donde se
 * enviaría el incidente al servicio de monitoreo.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Fallo de interfaz capturado por ErrorBoundary:', error, info.componentStack);
  }

  retry = () => {
    const mensaje = this.state.error?.message ?? '';
    if (
      /lazy element type|loading chunk|dynamically imported module|importing a module script/i.test(
        mensaje,
      )
    ) {
      // React.lazy conserva la promesa fallida: remontar el árbol no la vuelve a cargar.
      reloadPage();
      return;
    }
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="workspace">
        <div className="workspace__inner stack">
          <Card>
            <CardHead
              title="No se pudo mostrar esta pantalla"
              description="Reintenta la carga o vuelve al acceso para continuar."
            />
            <CardBody>
              <div className="stack">
                <Alert tone="riesgo" title="Error de interfaz">
                  Se produjo un fallo al dibujar este módulo. Puedes reintentar la carga o volver al
                  acceso; la información ficticia de la demostración no se ha modificado.
                </Alert>
                <p className="mono small">{error.message}</p>
                <div className="ui-row ui-row--wrap">
                  <button type="button" className="btn btn-falcon-default" onClick={this.retry}>
                    Reintentar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => window.location.assign('/login')}
                  >
                    Volver al acceso
                  </button>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    );
  }
}
