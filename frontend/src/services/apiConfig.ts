/** La demostración debe seleccionarse explícitamente; nunca se usa como respaldo de un fallo HTTP. */
export const API_MODE = import.meta.env.VITE_DATA_SOURCE !== 'demo';
