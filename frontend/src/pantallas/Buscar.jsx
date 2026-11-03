import { useState } from 'react';
import { buscarNumero, nombreQuiniela, turnoPorId, quinielasVisibles, TURNOS } from '../util/datos.js';
import { fechaCorta, formatoPesos } from '../util/fechas.js';
import { UBICACIONES } from '../../../shared/premios.js';
import { calcularPremio } from '../util/herramientas.js';

const PERIODOS = [7, 15, 30];

const DIAS_INICIALES = 3;
const FILTROS = [['todas', 'Todas'], ['cabeza', 'Solo a la cabeza'], ['mias', 'Mis quinielas']];
const ORDEN_TURNO = TURNOS.map((t) => t.id).reverse(); // del último turno del día al primero

// fecha -> turno -> aciertos
function agruparPorFecha(aciertos) {
  const grupos = new Map();
  for (const a of aciertos) {
    if (!grupos.has(a.fecha)) grupos.set(a.fecha, new Map());
    const dia = grupos.get(a.fecha);
    if (!dia.has(a.turno)) dia.set(a.turno, []);
    dia.get(a.turno).push(a);
  }
  return [...grupos.entries()].map(([fecha, turnos]) => [
    fecha,
    [...turnos.entries()].sort((x, y) => ORDEN_TURNO.indexOf(x[0]) - ORDEN_TURNO.indexOf(y[0])),
  ]);
}

const vecesTexto = (n) => `${n} ${n === 1 ? 'vez' : 'veces'}`;

function Ficha({ a }) {
  const cabeza = a.ubicaciones[0] === 1;
  const detalle = a.ubicaciones.map((u, i) => `${u === 1 ? 'cabeza' : `ubicación ${u}`} (${a.valores[i]})`).join(', ');
  return (
    <li className={`ficha-acierto${cabeza ? ' cabeza' : ''}`} title={detalle} aria-label={`${nombreQuiniela(a.quiniela)}: ${detalle}`}>
      <span className="fa-quiniela">{nombreQuiniela(a.quiniela)}</span>
      <span className="fa-pos">{a.ubicaciones.map((u) => (u === 1 ? '★ Cabeza' : `${u}°`)).join(' · ')}</span>
    </li>
  );
}

function Resultado({ datos, dias }) {
  const [filtro, setFiltro] = useState('todas');
  const [verTodo, setVerTodo] = useState(false);
  const mias = quinielasVisibles().map((q) => q.id);
  const veces = datos.aciertos.reduce((s, a) => s + a.ubicaciones.length, 0);
  const cabezas = datos.aciertos.filter((a) => a.ubicaciones[0] === 1).length;

  if (datos.aciertos.length === 0) {
    return <p className="resumen">El {datos.numero} no salió en los {datos.sorteos} sorteos de los últimos {dias} días.</p>;
  }

  const lista = datos.aciertos.filter((a) => (filtro === 'cabeza' ? a.ubicaciones[0] === 1 : filtro === 'mias' ? mias.includes(a.quiniela) : true));
  const grupos = agruparPorFecha(lista);
  const visibles = verTodo ? grupos : grupos.slice(0, DIAS_INICIALES);
  const ultima = datos.aciertos[0];

  return (
    <>
      <div className="busqueda-cifras">
        <div><strong>{veces}</strong><span>{veces === 1 ? 'vez' : 'veces'}</span></div>
        <div className="destacada"><strong>{cabezas}</strong><span>a la cabeza</span></div>
        <div><strong>{datos.sorteos}</strong><span>sorteos</span></div>
      </div>
      <p className="tenue busqueda-ultima">
        Última vez: {fechaCorta(ultima.fecha)}, {turnoPorId(ultima.turno).nombre} de {nombreQuiniela(ultima.quiniela)}.
      </p>

      <div className="opciones desplazable" role="group" aria-label="Filtrar resultados">
        {FILTROS.map(([id, texto]) => (
          <button key={id} type="button" className={`opcion${filtro === id ? ' activa' : ''}`} aria-pressed={filtro === id} onClick={() => setFiltro(id)}>
            {texto}
          </button>
        ))}
      </div>

      {grupos.length === 0 && <p className="nota">No hay resultados con ese filtro.</p>}

      {visibles.map(([fecha, turnos]) => (
        <div key={fecha} className="grupo-fecha">
          <h4>{fechaCorta(fecha)} <span className="tenue">· {vecesTexto(turnos.reduce((s, [, l]) => s + l.reduce((n, a) => n + a.ubicaciones.length, 0), 0))}</span></h4>
          {turnos.map(([turno, aciertos]) => (
            <div key={turno} className="grupo-turno">
              <p className="gt-nombre">{turnoPorId(turno).nombre}</p>
              <ul className="fichas-acierto">
                {aciertos.map((a) => <Ficha key={a.quiniela} a={a} />)}
              </ul>
            </div>
          ))}
        </div>
      ))}

      {!verTodo && grupos.length > DIAS_INICIALES && (
        <button type="button" className="boton secundario ver-mas" onClick={() => setVerTodo(true)}>
          {grupos.length - DIAS_INICIALES === 1 ? 'Ver 1 día más' : `Ver ${grupos.length - DIAS_INICIALES} días más`}
        </button>
      )}
    </>
  );
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
          <Resultado key={`${datos.numero}-${dias}`} datos={datos} dias={dias} />
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
