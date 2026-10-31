// Poceada de la Ciudad, Quiniela Plus y Super Plus: los 20 números, premios y control de la boleta
import { useEffect, useState } from 'react';
import { obtenerPozos, leerBoleta } from '../util/datos.js';
import { formatoPesos } from '../util/fechas.js';

const JUEGOS = [
  { id: 'poceada', nombre: 'Poceada de la Ciudad', ayuda: 'Se juegan de 8 a 15 números del 00 al 99 contra los 20 de la Nocturna de la Ciudad.' },
  { id: 'quinielaplus', nombre: 'Quiniela Plus', ayuda: 'Se juegan 8 números del 00 al 99 contra los 20 de su sorteo.' },
  { id: 'superplus', nombre: 'Super Plus', ayuda: 'Sorteo adicional de la Quiniela Plus.' },
];
const CATEGORIAS = { 1: '8 aciertos', 2: '7 aciertos', 3: '6 aciertos', 4: '5 aciertos' };
const CLAVE_BOLETA = 'quiniela.boleta.pozos';

function Tarjeta({ juego, datos, boleta }) {
  const aciertos = boleta.filter((n) => datos.numeros.includes(n));
  return (
    <article className="bloque pozo">
      <header className="pozo-cabecera">
        <h3>{juego.nombre}</h3>
        {datos.sorteo && <span className="tenue">Sorteo {datos.sorteo}</span>}
      </header>
      <ol className="pozo-bolillas">
        {datos.numeros.map((n) => <li key={n} className={boleta.includes(n) ? 'acierto' : undefined}>{n}</li>)}
      </ol>
      {boleta.length > 0 && (
        <p className={`pozo-resultado${aciertos.length >= 6 ? ' gano' : ''}`}>
          Acertaste <strong>{aciertos.length}</strong> de {boleta.length}{aciertos.length ? `: ${aciertos.join(', ')}` : ''}.
          {aciertos.length >= 6 && juego.id !== 'superplus' ? ' ¡Revisá tu boleta en la agencia!' : ''}
        </p>
      )}
      {datos.categorias?.some((c) => c.premio || c.ganadores) && (
        <table className="pozo-premios">
          <thead><tr><th>Categoría</th><th>Ganadores</th><th>Premio</th></tr></thead>
          <tbody>
            {datos.categorias.filter((c) => c.premio || c.ganadores).map((c) => (
              <tr key={c.cat}>
                <td>{juego.id === 'superplus' ? 'Super Plus' : CATEGORIAS[c.cat] ?? `Categoría ${c.cat}`}</td>
                <td>{c.ganadores === 0 ? 'Vacante' : c.ganadores ?? '—'}</td>
                <td>{c.premio ? formatoPesos(c.premio) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="nota">{juego.ayuda}</p>
    </article>
  );
}

export default function Pozos({ fecha }) {
  const [estado, setEstado] = useState({ cargando: true, datos: null, error: null });
  const [texto, setTexto] = useState(() => { try { return localStorage.getItem(CLAVE_BOLETA) || ''; } catch { return ''; } });
  const boleta = leerBoleta(texto);

  useEffect(() => {
    let vigente = true;
    setEstado((e) => ({ ...e, cargando: true, error: null }));
    obtenerPozos(fecha)
      .then((datos) => vigente && setEstado({ cargando: false, datos, error: null }))
      .catch(() => vigente && setEstado({ cargando: false, datos: null, error: 'No pudimos traer la Poceada y la Quiniela Plus. Revisá tu conexión.' }));
    return () => { vigente = false; };
  }, [fecha]);

  function cambiar(v) {
    setTexto(v);
    try { localStorage.setItem(CLAVE_BOLETA, v); } catch { /* modo privado */ }
  }

  const juegos = estado.datos?.juegos ?? {};
  const hay = JUEGOS.filter((j) => juegos[j.id]);

  return (
    <div className="pozos">
      <section className="bloque">
        <h3>Controlá tu boleta</h3>
        <label className="campo">
          <span>Tus números (de 8 a 15, del 00 al 99)</span>
          <input inputMode="numeric" placeholder="Ej.: 05 12 27 33 48 61 77 90" value={texto} onChange={(e) => cambiar(e.target.value.replace(/[^\d\s,.-]/g, ''))} />
        </label>
        {boleta.length > 0 && boleta.length < 8 && <p className="nota">Te faltan {8 - boleta.length} números.</p>}
      </section>
      {estado.error && <p className="error" role="alert">{estado.error}</p>}
      {estado.cargando && !estado.datos && <p className="nota">Buscando…</p>}
      {!estado.cargando && !estado.error && !hay.length && <p className="nota">Todavía no salieron. La Poceada y la Quiniela Plus aparecen después de la Nocturna (21 h).</p>}
      {hay.map((j) => <Tarjeta key={j.id} juego={j} datos={juegos[j.id]} boleta={boleta.length >= 8 ? boleta : []} />)}
      {hay.length > 0 && <p className="nota">Resultados informativos: verificá con el extracto oficial antes de cobrar.</p>}
    </div>
  );
}
