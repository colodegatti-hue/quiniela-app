// Elegir qué quinielas se ven en Resultados (se guarda en el teléfono)
import { useEffect, useState } from 'react';
import { PRINCIPALES, PROVINCIALES, quinielasVisibles, guardarVisibles, EVENTO_VER } from '../util/datos.js';

export function useQuinielasVisibles() {
  const [lista, setLista] = useState(quinielasVisibles);
  useEffect(() => {
    const cambiar = () => setLista(quinielasVisibles());
    window.addEventListener(EVENTO_VER, cambiar);
    return () => window.removeEventListener(EVENTO_VER, cambiar);
  }, []);
  return lista;
}

function Grupo({ titulo, quinielas, elegidas, alternar }) {
  return (
    <fieldset className="campo">
      <legend>{titulo}</legend>
      <div className="opciones">
        {quinielas.map((q) => (
          <button key={q.id} type="button" className={`opcion${elegidas.includes(q.id) ? ' activa' : ''}`} aria-pressed={elegidas.includes(q.id)} onClick={() => alternar(q.id)}>
            {q.nombre}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function ElegirQuinielas() {
  const visibles = useQuinielasVisibles();
  const [abierto, setAbierto] = useState(false);
  const elegidas = visibles.map((q) => q.id);
  const alternar = (id) => {
    const nuevas = elegidas.includes(id) ? elegidas.filter((x) => x !== id) : [...elegidas, id];
    if (nuevas.length) guardarVisibles(nuevas);
  };

  if (!abierto) {
    return (
      <button type="button" className="enlace elegir-quinielas" onClick={() => setAbierto(true)}>
        Elegir quinielas ({elegidas.length} de {PRINCIPALES.length + PROVINCIALES.length})
      </button>
    );
  }
  return (
    <section className="bloque elegir-quinielas-panel">
      <Grupo titulo="Principales" quinielas={PRINCIPALES} elegidas={elegidas} alternar={alternar} />
      <Grupo titulo="Más provincias" quinielas={PROVINCIALES} elegidas={elegidas} alternar={alternar} />
      <div className="acciones">
        <button type="button" className="boton" onClick={() => setAbierto(false)}>Listo</button>
        <button type="button" className="enlace" onClick={() => guardarVisibles(PRINCIPALES.map((q) => q.id))}>Volver a las de siempre</button>
      </div>
    </section>
  );
}
