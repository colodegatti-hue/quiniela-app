import { useEffect, useState } from 'react';
import Resultados from './pantallas/Resultados.jsx';
import Jugadas from './pantallas/Jugadas.jsx';
import ComoSeJuega from './pantallas/ComoSeJuega.jsx';

const PANTALLAS = {
  resultados: { titulo: 'Resultados', componente: Resultados },
  jugadas: { titulo: 'Mis jugadas', componente: Jugadas },
  'como-se-juega': { titulo: 'Cómo se juega', componente: ComoSeJuega },
};

function pantallaActual() {
  const id = window.location.hash.replace(/^#\/?/, '');
  return PANTALLAS[id] ? id : 'resultados';
}

export default function App() {
  const [pantalla, setPantalla] = useState(pantallaActual);

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
        <p className="marca">Quiniela</p>
        <p className="marca-sub">Colo Apps</p>
      </header>
      <main>
        <Componente />
      </main>
      <nav className="navegacion" aria-label="Secciones">
        {Object.entries(PANTALLAS).map(([id, p]) => (
          <a key={id} href={`#/${id}`} className={id === pantalla ? 'activa' : undefined} aria-current={id === pantalla ? 'page' : undefined}>
            {p.titulo}
          </a>
        ))}
      </nav>
    </div>
  );
}
