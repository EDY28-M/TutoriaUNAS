import { useRef, useState } from 'react';

/** El éxito se comunica únicamente después de confirmar la operación remota. */
export function useAccionPersistente() {
  const bloqueo = useRef(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  async function ejecutar(accion: () => Promise<unknown>, exito = 'Cambios guardados.') {
    if (bloqueo.current) return false;
    bloqueo.current = true;
    setOcupado(true);
    setError('');
    setMensaje('');
    try {
      await accion();
      setMensaje(exito);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la operación.');
      return false;
    } finally {
      bloqueo.current = false;
      setOcupado(false);
    }
  }
  return { ocupado, error, mensaje, ejecutar };
}
