import { useEffect, useState } from 'react';
import PanelAvisos from '../componentes/PanelAvisos.jsx';
import { sincronizarJugadas } from '../util/avisos.js';
import { QUINIELAS, TURNOS, nombreQuiniela, turnoPorId, obtenerResultados } from '../util/datos.js';
import { hoy, sumarDias, fechaCorta, formatoPesos, yaEsLaHora, diaSemana } from '../util/fechas.js';
import {
  UBICACIONES, cargarJugadas, guardarJugadas, nuevaJugada, validarJugada, controlarJugada, resumenJugada,
} from '../util/jugadas.js';

// Días que se pueden elegir: hoy, mañana y ayer (los domingos no hay sorteos)
const fechasPosibles = () => [hoy(), sumarDias(hoy(), 1), sumarDias(hoy(), -1)].filter((d) => diaSemana(d) !== 0);

// Turnos que todavía no se sortearon en esa fecha (si ya pasaron todos, se marcan todos)
function turnosPendientes(fecha) {
  const pendientes = TURNOS.filter((t) => !yaEsLaHora(fecha, t.hora)).map((t) => t.id);
  return pendientes.length ? pendientes : TURNOS.map((t) => t.id);
}

const FORM_INICIAL = () => {
  const fecha = fechasPosibles()[0];
  return { tipo: 'directa', numero: '', ubicacion: 'cabeza', numero2: '', ubicacion2: 'a_los_5', quinielas: ['ciudad', 'provincia'], turnos: turnosPendientes(fecha), fecha, monto: '' };
};

function alternar(lista, valor) {
  return lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor];
}

function Formulario({ alGuardar, alCancelar }) {
  const [f, setF] = useState(FORM_INICIAL);
  const [error, setError] = useState(null);
  const cambiar = (campo, valor) => setF((x) => ({ ...x, [campo]: valor }));

  function enviar(e) {
    e.preventDefault();
    const problema = validarJugada(f);
    if (problema) return setError(problema);
    alGuardar(nuevaJugada(f));
  }

  return (
    <form className="formulario" onSubmit={enviar} noValidate>
      <fieldset className="campo">
        <legend>Tipo de jugada</legend>
        <div className="opciones">
          <button type="button" className={`opcion${f.tipo === 'directa' ? ' activa' : ''}`} aria-pressed={f.tipo === 'directa'} onClick={() => cambiar('tipo', 'directa')}>Directa</button>
          <button type="button" className={`opcion${f.tipo === 'redoblona' ? ' activa' : ''}`} aria-pressed={f.tipo === 'redoblona'} onClick={() => setF((x) => ({ ...x, tipo: 'redoblona', numero: x.numero.slice(-2), ubicacion: x.ubicacion === 'a_los_20' ? 'cabeza' : x.ubicacion }))}>Redoblona</button>
        </div>
        {f.tipo === 'redoblona' && <small>Dos números de 2 cifras: tienen que salir los dos para cobrar.</small>}
      </fieldset>

      <label className="campo">
        <span>{f.tipo === 'redoblona' ? 'Primer número' : 'Número'}</span>
        <input
          className="entrada-numero"
          inputMode="numeric"
          autoComplete="off"
          maxLength={f.tipo === 'redoblona' ? 2 : 4}
          placeholder="Ej.: 47"
          value={f.numero}
          onChange={(e) => cambiar('numero', e.target.value.replace(/\D/g, ''))}
          autoFocus
        />
        {f.tipo !== 'redoblona' && <small>De 1 a 4 cifras. Se controla con las últimas cifras de cada número sorteado.</small>}
      </label>

      <fieldset className="campo">
        <legend>Ubicación</legend>
        <div className="opciones">
          {Object.entries(UBICACIONES).filter(([id]) => f.tipo !== 'redoblona' || id !== 'a_los_20').map(([id, u]) => (
            <button key={id} type="button" className={`opcion${f.ubicacion === id ? ' activa' : ''}`} aria-pressed={f.ubicacion === id} onClick={() => cambiar('ubicacion', id)}>
              {u.nombre}
            </button>
          ))}
        </div>
      </fieldset>

      {f.tipo === 'redoblona' && (
        <>
          <label className="campo">
            <span>Segundo número</span>
            <input className="entrada-numero" inputMode="numeric" autoComplete="off" maxLength={2} placeholder="Ej.: 12" value={f.numero2} onChange={(e) => cambiar('numero2', e.target.value.replace(/\D/g, ''))} />
          </label>
          <fieldset className="campo">
            <legend>Ubicación del segundo</legend>
            <div className="opciones">
              {Object.entries(UBICACIONES).filter(([id]) => id !== 'cabeza').map(([id, u]) => (
                <button key={id} type="button" className={`opcion${f.ubicacion2 === id ? ' activa' : ''}`} aria-pressed={f.ubicacion2 === id} onClick={() => cambiar('ubicacion2', id)}>
                  {u.nombre}
                </button>
              ))}
            </div>
          </fieldset>
        </>
      )}

      <fieldset className="campo">
        <legend>Quinielas</legend>
        <div className="opciones">
          {QUINIELAS.map((q) => (
            <button key={q.id} type="button" className={`opcion${f.quinielas.includes(q.id) ? ' activa' : ''}`} aria-pressed={f.quinielas.includes(q.id)} onClick={() => cambiar('quinielas', alternar(f.quinielas, q.id))}>
              {q.nombre}{q.soloTurnos && <span className="tenue"> (Matutina y Nocturna)</span>}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="campo">
        <legend>Turnos</legend>
        <div className="opciones">
          {TURNOS.map((t) => (
            <button key={t.id} type="button" className={`opcion${f.turnos.includes(t.id) ? ' activa' : ''}`} aria-pressed={f.turnos.includes(t.id)} onClick={() => cambiar('turnos', alternar(f.turnos, t.id))}>
              {t.nombre} <span className="tenue">{t.hora}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="campo-doble">
        <label className="campo">
          <span>Día</span>
          <select value={f.fecha} onChange={(e) => setF((x) => ({ ...x, fecha: e.target.value, turnos: turnosPendientes(e.target.value) }))}>
            {fechasPosibles().map((d) => (
              <option key={d} value={d}>{d === hoy() ? `Hoy (${fechaCorta(d)})` : fechaCorta(d)}</option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>Monto por quiniela y turno</span>
          <input inputMode="decimal" placeholder="Opcional" value={f.monto} onChange={(e) => cambiar('monto', e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))} />
        </label>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      <div className="acciones">
        <button type="submit" className="boton">Guardar jugada</button>
        <button type="button" className="boton secundario" onClick={alCancelar}>Cancelar</button>
      </div>
    </form>
  );
}

function TarjetaJugada({ jugada, resultados, alBorrar }) {
  const [confirmar, setConfirmar] = useState(false);
  const filas = controlarJugada(jugada, resultados);
  const r = resumenJugada(filas, jugada);
  const ubic = UBICACIONES[jugada.ubicacion].nombre.toLowerCase();
  const redoblona = jugada.tipo === 'redoblona';
  const ubic2 = redoblona ? (UBICACIONES[jugada.ubicacion2]?.nombre ?? '').toLowerCase() : '';

  return (
    <article className={`jugada${r.ganadas ? ' ganadora' : ''}`}>
      <header className="jugada-cabecera">
        <p className="jugada-numero">{redoblona ? `${jugada.numero}·${jugada.numero2}` : jugada.numero}</p>
        <div>
          <p className="jugada-detalle">{redoblona ? `Redoblona: ${jugada.numero} ${ubic} y ${jugada.numero2} ${ubic2}` : ubic}, {fechaCorta(jugada.fecha)}</p>
          <p className="jugada-estado">
            {r.ganadas > 0
              ? r.premio !== null ? `Ganaste ${formatoPesos(r.premio)} (estimado)` : `Acertaste en ${r.ganadas} ${r.ganadas === 1 ? 'sorteo' : 'sorteos'}`
              : r.pendientes === r.total ? 'Todavía no salió ningún sorteo de esta jugada' : r.pendientes ? `Sin aciertos por ahora. Faltan ${r.pendientes}` : 'Esta vez no salió'}
          </p>
        </div>
      </header>
      <ul className="jugada-filas">
        {filas.map((f) => (
          <li key={`${f.turno}-${f.quiniela}`} className={`fila ${f.estado}`}>
            <span>{nombreQuiniela(f.quiniela)}, {turnoPorId(f.turno).nombre}</span>
            <span className="fila-estado">
              {f.estado === 'gano' && (f.premio !== null ? formatoPesos(f.premio) : `Salió: paga ${f.veces.toLocaleString('es-AR')} veces`)}
              {f.estado === 'no' && 'No salió'}
              {f.estado === 'falta' && `Se sortea a las ${turnoPorId(f.turno).hora}`}
              {f.estado === 'demora' && 'Esperando resultado'}
            </span>
          </li>
        ))}
      </ul>
      <footer className="jugada-pie">
        {r.apostado !== null && <span className="tenue">Apostado: {formatoPesos(r.apostado)}</span>}
        {confirmar ? (
          <span className="confirmar">
            ¿Borrar esta jugada?
            <button type="button" className="enlace peligro" onClick={() => alBorrar(jugada.id)}>Borrar</button>
            <button type="button" className="enlace" onClick={() => setConfirmar(false)}>No</button>
          </span>
        ) : (
          <button type="button" className="enlace" onClick={() => setConfirmar(true)}>Borrar</button>
        )}
      </footer>
    </article>
  );
}

export default function Jugadas() {
  const [jugadas, setJugadas] = useState(cargarJugadas);
  const [creando, setCreando] = useState(false);
  const [resultados, setResultados] = useState({}); // fecha -> resultados
  const [aviso, setAviso] = useState(null);

  const fechas = [...new Set(jugadas.map((j) => j.fecha))];
  const claveFechas = fechas.sort().join(',');

  useEffect(() => {
    let vigente = true;
    const traer = () => {
      for (const f of claveFechas ? claveFechas.split(',') : []) {
        obtenerResultados(f)
          .then((d) => vigente && setResultados((x) => ({ ...x, [f]: d })))
          .catch(() => vigente && setAviso('No pudimos traer los resultados. Tus jugadas se van a controlar cuando vuelva la conexión.'));
      }
    };
    traer();
    const id = setInterval(traer, 120000);
    return () => { vigente = false; clearInterval(id); };
  }, [claveFechas]);

  function guardar(lista) {
    setJugadas(lista);
    if (!guardarJugadas(lista)) setAviso('Tu teléfono no dejó guardar la jugada. Revisá que no estés en modo privado.');
    sincronizarJugadas(lista); // para que el servidor avise si salen
  }

  const ordenadas = [...jugadas].sort((a, b) => (b.fecha + b.creada).localeCompare(a.fecha + a.creada));

  return (
    <section className="pantalla">
      <div className="titulo-pantalla">
        <h2>Mis jugadas</h2>
        {!creando && <button type="button" className="boton" onClick={() => setCreando(true)}>Cargar jugada</button>}
      </div>

      {creando && (
        <Formulario
          alGuardar={(j) => { guardar([j, ...jugadas]); setCreando(false); window.dispatchEvent(new Event('quiniela-jugada-guardada')); }}
          alCancelar={() => setCreando(false)}
        />
      )}

      {aviso && <p className="nota">{aviso}</p>}

      {!creando && <PanelAvisos />}

      {!creando && jugadas.length === 0 && (
        <div className="vacio">
          <p>Cargá el número que jugaste y la app lo controla sola en cada turno.</p>
          <p className="tenue">Tus jugadas quedan guardadas en este teléfono.</p>
        </div>
      )}

      <div className="lista-jugadas">
        {ordenadas.map((j) => (
          <TarjetaJugada key={j.id} jugada={j} resultados={resultados[j.fecha]} alBorrar={(id) => guardar(jugadas.filter((x) => x.id !== id))} />
        ))}
      </div>
    </section>
  );
}
