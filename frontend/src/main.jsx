import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import './estilos.css';
import App from './App.jsx';

createRoot(document.getElementById('raiz')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
