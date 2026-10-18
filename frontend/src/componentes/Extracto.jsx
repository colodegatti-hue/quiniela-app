// Extracto de una quiniela: la cabeza grande y los 20 números
// en dos columnas (1 a 10 y 11 a 20), como el extracto oficial.
export default function Extracto({ nombre, numeros, resaltadas = new Set(), alCompartir }) {
  const columna = (desde) =>
    numeros.slice(desde, desde + 10).map((n, i) => {
      const pos = desde + i + 1;
      const marcado = resaltadas.has(pos);
      return (
        <li key={pos} className={marcado ? 'marcado' : undefined}>
          <span className="pos">{pos}</span>
          <span className="num">{n}</span>
        </li>
      );
    });

  return (
    <article className="extracto">
      <header className="extracto-cabecera">
        <div>
          <h3>{nombre}</h3>
          {alCompartir && (
            <button type="button" className="enlace compartir" onClick={alCompartir}>Compartir</button>
          )}
        </div>
        <p className={resaltadas.has(1) ? 'cabeza marcado' : 'cabeza'} aria-label={`Cabeza: ${numeros[0]}`}>
          {numeros[0]}
        </p>
      </header>
      <div className="extracto-tabla">
        <ol>{columna(0)}</ol>
        <ol>{columna(10)}</ol>
      </div>
    </article>
  );
}
