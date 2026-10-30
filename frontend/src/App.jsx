import { useEffect, useState } from 'react';
import Resultados from './pantallas/Resultados.jsx';
import Jugadas from './pantallas/Jugadas.jsx';
import ComoSeJuega from './pantallas/ComoSeJuega.jsx';
import Buscar from './pantallas/Buscar.jsx';
import Estadisticas from './pantallas/Estadisticas.jsx';
import Suenos from './pantallas/Suenos.jsx';
import Pro from './pantallas/Pro.jsx';
import Legal from './pantallas/Legal.jsx';
import Arrepentimiento from './pantallas/Arrepentimiento.jsx';
import { usePro, tomarRetorno, revisarPro } from './util/pro.js';
import { capturarOrigen, avisarUso } from './util/medicion.js';

const PANTALLAS = {
  resultados: { titulo: 'Resultados', componente: Resultados },
  jugadas: { titulo: 'Jugadas', componente: Jugadas },
  estadisticas: { titulo: 'Números', componente: Estadisticas },
  suenos: { componente: Suenos, seccion: 'estadisticas' }, // dentro de "Números"
  buscar: { titulo: 'Buscar', componente: Buscar },
  'como-se-juega': { titulo: 'Cómo jugar', componente: ComoSeJuega },
  pro: { componente: Pro }, // se entra desde el botón de arriba
  legal: { componente: Legal, seccion: 'como-se-juega' }, // privacidad y términos
  arrepentimiento: { componente: Arrepentimiento, seccion: 'como-se-juega' }, // botón de arrepentimiento
};

capturarOrigen(); // si entró por el QR o enlace de una agencia, recordarlo
tomarRetorno(); // si vuelve de pagar en Mercado Pago, ir a la pantalla Pro

function pantallaActual() {
  const id = window.location.hash.replace(/^#\/?/, '');
  return PANTALLAS[id] ? id : 'resultados';
}

export default function App() {
  const [pantalla, setPantalla] = useState(pantallaActual);
  const { pro } = usePro();

  useEffect(() => { revisarPro(); }, []);

  // Medición anónima: una vez por día (y al volver a la app si cambió el día)
  useEffect(() => {
    avisarUso({ pro });
    const alVolver = () => { if (document.visibilityState === 'visible') avisarUso({ pro }); };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [pro]);

  useEffect(() => {
    const alCambiar = () => {
      setPantalla(pantallaActual());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', alCambiar);
    return () => window.removeEventListener('hashchange', alCambiar);
  }, []);

  const Componente = PANTALLAS[pantalla].componente;

  return (
    <div className="app">
      <header className="barra">
        <p className="marca">Quiniela <span className="marca-toque">al Toque</span></p>
        <a className={`boton-pro${pro ? ' es-pro' : ''}`} href="#/pro">{pro ? 'PRO' : 'Hacete Pro'}</a>
      </header>
      <main>
        <Componente />
      </main>
      <nav className="navegacion" aria-label="Secciones">
        {Object.entries(PANTALLAS).filter(([, p]) => p.titulo).map(([id, p]) => {
          const activa = id === (PANTALLAS[pantalla].seccion ?? pantalla);
          return (
            <a key={id} href={`#/${id}`} className={activa ? 'activa' : undefined} aria-current={activa ? 'page' : undefined}>
              {p.titulo}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
