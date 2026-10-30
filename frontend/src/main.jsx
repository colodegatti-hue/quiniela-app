import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import './estilos.css';
import App from './App.jsx';
import { direccionNueva, recibirMudanza } from './util/mudanza.js';

// Si se abrió la dirección vieja, pasar al dominio propio con los datos del teléfono
const destino = (() => { try { return direccionNueva(window.location, localStorage); } catch { return null; } })();
if (destino) {
  window.location.replace(destino);
} else {
  try { recibirMudanza(window.location, localStorage, window.history); } catch { /* sin almacenamiento */ }

  createRoot(document.getElementById('raiz')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
