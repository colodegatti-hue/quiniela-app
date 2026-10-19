import { useState } from 'react';
import PestanasNumeros from '../componentes/PestanasNumeros.jsx';
import { buscarSueno } from '../util/suenos.js';

export default function Suenos() {
  const [texto, setTexto] = useState('');
  const lista = buscarSueno(texto);

  return (
    <section className="pantalla">
      <h2>Números</h2>
      <PestanasNumeros actual="suenos" />

      <section className="bloque">
        <h3>¿Qué número es lo que soñaste?</h3>
        <p className="tenue">Escribí lo que soñaste (por ejemplo: perro, plata, agua) o un número para ver qué significa.</p>
        <input
          className="entrada-texto"
          type="search"
          placeholder="Buscar sueño o número"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          aria-label="Buscar sueño o número"
        />
      </section>

      {lista.length === 0 ? (
        <p className="nota">No encontramos "{texto}" en la tabla. Probá con otra palabra parecida.</p>
      ) : (
        <ul className="tabla-suenos">
          {lista.map((s) => (
            <li key={s.n}>
              <span className="ts-numero">{s.n}</span>
              <span className="ts-nombre">{s.nombre}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="nota">Es la tabla tradicional de la quiniela argentina. Puede cambiar un poco según la zona.</p>
    </section>
  );
}
