import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/fonts.css';
import './assets/vendor/falcon-theme.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-600.css';
import './styles/global.css';

const container = document.getElementById('root');
if (!container) throw new Error('No se encontró el contenedor de la aplicación.');
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
