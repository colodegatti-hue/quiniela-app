import { useState } from 'react';
import { buscarNumero } from '../util/datos.js';
import { fechaCorta, formatoPesos } from '../util/fechas.js';
import { UBICACIONES } from '../../../shared/premios.js';
import { calcularPremio, describirAcierto } from '../util/herramientas.js';

const PERIODOS = [7, 15, 30];

function agruparPorFecha(aciertos) {
  const grupos = new Map();
  for (const a of aciertos) {
    if (!grupos.has(a.fecha)) grupos.set(a.fecha, []);
    grupos.get(a.fecha).push(a);
  }
  return [...grupos.entries()];
}

function Buscador() {
  const [numero, setNumero] = useState('');
  const [dias, setDias] = useState(30);
  const [estado, setEstado] = useState({ cargando: false, datos: null, error: null });

  async function buscar(e) {
    e.preventDefault();
    if (!/^\d{1,4}$/.test(numero)) {
      setEstado({ cargando: false, datos: null, error: 'Escribí un número de 1 a 4 cifras.' });
      return;
    }
    setEstado({ cargando: true, datos: null, error: null });
    try {
      setEstado({ cargando: false, datos: await buscarNumero(numero, dias), error: null });
    } catch {
      setEstado({ cargando: false, datos: null, error: 'No pudimos hacer la búsqueda. Revisá tu conexión y probá de nuevo.' });
    }
  }

  const { datos } = estado;
  const veces = datos ? datos.aciertos.reduce((s, a) => s + a.ubicaciones.length, 0) : 0;
  const cabezas = datos ? datos.aciertos.filter((a) => a.ubicaciones[0] === 1).length : 0;

  return (
    <section className="bloque">
      <h3>¿Salió mi número?</h3>
      <p className="tenue">Buscamos tu número en los 20 números de cada sorteo, en todas las quinielas.</p>
      <form className="buscador" onSubmit={buscar}>
        <input
          className="entrada-numero"
          inputMode="numeric"
          maxLength={4}
          placeholder="Ej.: 77"
          value={numero}
          onChange={(e) => setNumero(e.target.value.replace(/\D/g, ''))}
          aria-label="Número a buscar"
        />
        <div className="opciones">
          {PERIODOS.map((p) => (
            <button key={p} type="button" className={`opcion${dias === p ? ' activa' : ''}`} aria-pressed={dias === p} onClick={() => setDias(p)}>
              Últimos {p} días
            </button>
          ))}
        </div>
        <button type="submit" className="boton" disabled={estado.cargando}>{estado.cargando ? 'Buscando…' : 'Buscar'}</button>
      </form>

      {estado.error && <p className="error" role="alert">{estado.error}</p>}

      {datos && (
        <div className="resultado-busqueda">
          {datos.aciertos.length === 0 ? (
            <p className="resumen">El {datos.numero} no salió en los {datos.sorteos} sorteos de los últimos {dias} días.</p>
          ) : (
            <p className="resumen">
              El {datos.numero} salió {veces} {veces === 1 ? 'vez' : 'veces'} en {datos.sorteos} sorteos
              {cabezas > 0 ? ` (${cabezas} a la cabeza)` : ''}.
            </p>
          )}
          {agruparPorFecha(datos.aciertos).map(([fecha, lista]) => (
            <div key={fecha} className="grupo-fecha">
              <h4>{fechaCorta(fecha)}</h4>
              <ul>
                {lista.map((a) => (
                  <li key={`${a.turno}-${a.quiniela}`} className={a.ubicaciones[0] === 1 ? 'a-la-cabeza' : undefined}>
                    {describirAcierto(a)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Calculadora() {
  const [numero, setNumero] = useState('');
  const [ubicacion, setUbicacion] = useState('cabeza');
  const [monto, setMonto] = useState('');
  const r = calcularPremio({ numero, ubicacion, monto });

  return (
    <section className="bloque">
      <h3>Calculadora de premios</h3>
      <p className="tenue">Cuánto cobrarías si sale tu número, según la tabla de la Lotería de la Ciudad.</p>
      <div className="formulario plano">
        <div className="campo-doble">
          <label className="campo">
            <span>Número</span>
            <input inputMode="numeric" maxLength={4} placeholder="Ej.: 47" value={numero} onChange={(e) => setNumero(e.target.value.replace(/\D/g, ''))} />
          </label>
          <label className="campo">
            <span>Monto</span>
            <input inputMode="decimal" placeholder="Ej.: 500" value={monto} onChange={(e) => setMonto(e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))} />
          </label>
        </div>
        <div className="opciones">
          {Object.entries(UBICACIONES).map(([id, u]) => (
            <button key={id} type="button" className={`opcion${ubicacion === id ? ' activa' : ''}`} aria-pressed={ubicacion === id} onClick={() => setUbicacion(id)}>
              {u.nombre}
            </button>
          ))}
        </div>
        {r ? (
          <div className="calculo">
            <p className="calculo-veces">Paga {r.veces.toLocaleString('es-AR', { maximumFractionDigits: 2 })} veces lo apostado</p>
            {r.premio !== null && (
              <p>
                Cobrarías <strong>{formatoPesos(r.premio)}</strong>, o sea {formatoPesos(r.ganancia)} más de lo que jugaste.
              </p>
            )}
            <p className="tenue">Si el número sale repetido dentro de la ubicación, cobra por cada vez. Premio estimado.</p>
          </div>
        ) : (
          <p className="tenue">Escribí un número de 1 a 4 cifras para ver cuánto paga.</p>
        )}
      </div>
    </section>
  );
}

export default function Buscar() {
  return (
    <section className="pantalla">
      <h2>Buscar y calcular</h2>
      <Buscador />
      <Calculadora />
    </section>
  );
}
