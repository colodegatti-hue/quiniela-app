import { useEffect, useState } from 'react';
import PestanasNumeros from '../componentes/PestanasNumeros.jsx';
import { QUINIELAS, nombreQuiniela, turnoPorId } from '../util/datos.js';
import { fechaCorta } from '../util/fechas.js';
import { obtenerEstadisticas, salidores, atrasados, campos, intensidad } from '../util/estadisticas.js';
import { suenoDe } from '../util/suenos.js';
import { usePro, GRATIS } from '../util/pro.js';
import CandadoPro from '../componentes/CandadoPro.jsx';

const PERIODOS = [30, 60, 90, 180, 365];
const CLAVE = 'quiniela.estadisticas.v1';

function leerFiltros() {
  try {
    return { quiniela: 'ciudad', dias: 30, donde: 'cabeza', ...JSON.parse(localStorage.getItem(CLAVE)) };
  } catch {
    return { quiniela: 'ciudad', dias: 30, donde: 'cabeza' };
  }
}

const vez = (n) => `${n} ${n === 1 ? 'vez' : 'veces'}`;
const cuando = (u) => (u ? `${fechaCorta(u.fecha)}, ${turnoPorId(u.turno)?.nombre ?? u.turno}` : '');

function textoAtraso(x, c, historial) {
  const a = x[c.atraso];
  if (a === null) return `No salió desde el ${fechaCorta(historial.desde)}`;
  if (a === 0) return 'Salió en el último sorteo';
  return `Hace ${a} ${a === 1 ? 'sorteo' : 'sorteos'}`;
}

function Fila({ x, derecha, detalle, ancho, alElegir }) {
  return (
    <li>
      <button type="button" className="fila-numero" onClick={() => alElegir(x.n)}>
        <span className="fn-numero">{x.n}</span>
        <span className="fn-texto">
          <span className="fn-sueno">{suenoDe(x.n)?.nombre}</span>
          {detalle && <span className="fn-detalle">{detalle}</span>}
          {ancho !== undefined && <span className="barra-veces" style={{ width: `${Math.max(4, ancho)}%` }} />}
        </span>
        <span className="fn-derecha">{derecha}</span>
      </button>
    </li>
  );
}

export default function Estadisticas() {
  const [filtros, setFiltros] = useState(leerFiltros);
  const [estado, setEstado] = useState({ cargando: true, datos: null, error: null });
  const [elegido, setElegido] = useState(null);
  const { quiniela, dias, donde } = filtros;
  const { pro } = usePro();
  const bloqueado = !pro && (!GRATIS.quinielas.includes(quiniela) || !GRATIS.dias.includes(dias));

  function cambiar(campo, valor) {
    const nuevos = { ...filtros, [campo]: valor };
    setFiltros(nuevos);
    try { localStorage.setItem(CLAVE, JSON.stringify(nuevos)); } catch { /* modo privado */ }
  }

  useEffect(() => {
    if (bloqueado) return undefined;
    let vigente = true;
    setEstado((e) => ({ ...e, cargando: true, error: null }));
    obtenerEstadisticas(quiniela, dias)
      .then((datos) => vigente && setEstado({ cargando: false, datos, error: null }))
      .catch((e) => vigente && setEstado({ cargando: false, datos: null, error: e.message === 'pro' ? 'Estas estadísticas son de la versión Pro y tu código no está activo en este teléfono.' : 'No pudimos traer las estadísticas. Revisá tu conexión y probá de nuevo.' }));
    return () => { vigente = false; };
  }, [quiniela, dias, bloqueado]);

  const { datos } = estado;
  const c = campos(donde);
  const top = datos ? salidores(datos.numeros, donde) : [];
  const atr = datos ? atrasados(datos.numeros, donde) : [];
  const maximo = datos ? Math.max(...datos.numeros.map((x) => x[c.veces])) : 0;
  const sel = datos && elegido ? datos.numeros.find((x) => x.n === elegido) : null;
  const pocos = datos?.historial.desde && datos.historial.desde > datos.desde; // el historial todavía no cubre todo el período

  function elegir(n) {
    setElegido(n);
    requestAnimationFrame(() => document.getElementById('detalle-numero')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  }

  return (
    <section className="pantalla">
      <h2>Números</h2>
      <PestanasNumeros actual="estadisticas" />

      <div className="filtros">
        <div className="opciones desplazable" role="group" aria-label="Quiniela">
          {QUINIELAS.map((q) => (
            <button key={q.id} type="button" className={`opcion${quiniela === q.id ? ' activa' : ''}`} aria-pressed={quiniela === q.id} onClick={() => cambiar('quiniela', q.id)}>
              {q.nombre}{!pro && !GRATIS.quinielas.includes(q.id) && <span className="etiqueta-pro">Pro</span>}
            </button>
          ))}
        </div>
        <div className="filtros-fila">
          <div className="segmentado" role="group" aria-label="Ubicación">
            <button type="button" aria-pressed={donde === 'cabeza'} onClick={() => cambiar('donde', 'cabeza')}>A la cabeza</button>
            <button type="button" aria-pressed={donde === 'a_los_20'} onClick={() => cambiar('donde', 'a_los_20')}>En los 20</button>
          </div>
          <select aria-label="Período" value={dias} onChange={(e) => cambiar('dias', Number(e.target.value))}>
            {PERIODOS.map((p) => <option key={p} value={p}>Últimos {p} días{!pro && !GRATIS.dias.includes(p) ? ' (Pro)' : ''}</option>)}
          </select>
        </div>
      </div>

      {bloqueado && (
        <CandadoPro
          titulo={`Estadísticas de ${nombreQuiniela(quiniela)}, últimos ${dias} días`}
          texto="Con Pro ves los salidores y atrasados de las 7 quinielas, de los últimos 30, 60 y 90 días. Gratis tenés Ciudad y Provincia de los últimos 30 días."
        />
      )}
      {!bloqueado && estado.error && <p className="error" role="alert">{estado.error}</p>}
      {!bloqueado && estado.cargando && !datos && <p className="nota">Calculando…</p>}

      {!bloqueado && datos && (
        <div className={estado.cargando ? 'cargando' : undefined}>
          <p className="nota">
            {nombreQuiniela(quiniela)}: {datos.sorteos} sorteos analizados
            {pocos ? ` (tenemos datos desde el ${fechaCorta(datos.historial.desde)})` : ''}.
          </p>

          {sel && (
            <section id="detalle-numero" className="bloque detalle-numero" aria-live="polite">
              <div className="detalle-cabecera">
                <p className="detalle-n">{sel.n}</p>
                <div>
                  <p className="detalle-sueno">{suenoDe(sel.n)?.nombre}</p>
                  <p className="tenue">{nombreQuiniela(quiniela)}, últimos {dias} días</p>
                </div>
                <button type="button" className="enlace" onClick={() => setElegido(null)} aria-label="Cerrar">✕</button>
              </div>
              <dl className="detalle-datos">
                <div><dt>A la cabeza</dt><dd>{vez(sel.cabeza)}</dd></div>
                <div><dt>En los 20</dt><dd>{vez(sel.aLos20)}</dd></div>
                <div><dt>Última a la cabeza</dt><dd>{sel.ultimaCabeza ? `${cuando(sel.ultimaCabeza)} (${textoAtraso(sel, campos('cabeza'), datos.historial).toLowerCase()})` : textoAtraso(sel, campos('cabeza'), datos.historial)}</dd></div>
                <div><dt>Última en los 20</dt><dd>{sel.ultima20 ? cuando(sel.ultima20) : textoAtraso(sel, campos('a_los_20'), datos.historial)}</dd></div>
              </dl>
            </section>
          )}

          <section className="bloque">
            <h3>Los que más salieron</h3>
            {top.length === 0 ? <p className="tenue">Todavía no hay sorteos en este período.</p> : (
              <ol className="lista-numeros">
                {top.map((x) => (
                  <Fila key={x.n} x={x} alElegir={elegir} derecha={vez(x[c.veces])} ancho={(x[c.veces] / maximo) * 100} />
                ))}
              </ol>
            )}
          </section>

          <section className="bloque">
            <h3>Los más atrasados</h3>
            <ol className="lista-numeros">
              {atr.map((x) => (
                <Fila key={x.n} x={x} alElegir={elegir} derecha={x[c.atraso] === null ? '—' : x[c.atraso]} detalle={x[c.ultima] ? `${textoAtraso(x, c, datos.historial)} · ${cuando(x[c.ultima])}` : textoAtraso(x, c, datos.historial)} />
              ))}
            </ol>
            <p className="tenue pie-lista">El número de la derecha es cuántos sorteos pasaron sin salir.</p>
          </section>

          <section className="bloque">
            <h3>Los 100 números</h3>
            <p className="tenue">Cuántas veces salió cada uno {donde === 'cabeza' ? 'a la cabeza' : 'en los 20'}. Tocá un número para ver el detalle.</p>
            <div className="grilla-100">
              {datos.numeros.map((x) => (
                <button
                  key={x.n}
                  type="button"
                  className={`celda i${intensidad(x[c.veces], maximo)}${elegido === x.n ? ' elegida' : ''}`}
                  onClick={() => elegir(x.n)}
                  aria-label={`${x.n}: ${vez(x[c.veces])}`}
                >
                  <span className="celda-n">{x.n}</span>
                  <span className="celda-v">{x[c.veces]}</span>
                </button>
              ))}
            </div>
          </section>

          <p className="nota">
            Cada sorteo es independiente: que un número esté atrasado o venga saliendo no cambia sus chances.
            Estos datos son solo para informarte.
          </p>
        </div>
      )}
    </section>
  );
}
