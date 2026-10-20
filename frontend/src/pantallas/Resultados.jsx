import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import Extracto from '../componentes/Extracto.jsx';
import TablaDelDia from '../componentes/TablaDelDia.jsx';
import { QUINIELAS, TURNOS, obtenerResultados, extractoDe, sortea } from '../util/datos.js';
import { hoy, sumarDias, diaSemana, fechaLarga, yaEsLaHora, ahoraArgentina, minutosDelDia } from '../util/fechas.js';
import { cargarJugadas } from '../util/jugadas.js';
import { UBICACIONES } from '../../../shared/premios.js';
import { compartir, textoExtracto, textoCabezas } from '../util/herramientas.js';
import useMensaje from '../componentes/useMensaje.js';

// Ubicaciones a resaltar en un extracto según las jugadas guardadas
function ubicacionesJugadas(jugadas, fecha, turno, quiniela, numeros) {
  const set = new Set();
  for (const j of jugadas) {
    if (j.fecha !== fecha || !j.turnos.includes(turno) || !j.quinielas.includes(quiniela)) continue;
    const { desde, hasta } = UBICACIONES[j.ubicacion];
    for (let p = desde; p <= hasta; p++) if (numeros[p - 1].endsWith(j.numero)) set.add(p);
  }
  return set;
}

const CLAVE_VISTA = 'quiniela.vista.v1';
function leerVista() {
  try { return localStorage.getItem(CLAVE_VISTA) || 'dia'; } catch { return 'dia'; }
}

// Turnos de hoy "en vivo": ya se sortearon hace menos de 90 minutos y les falta alguna quiniela
export function turnosEnVivo(fecha, datos, instante = new Date()) {
  const a = ahoraArgentina(instante);
  const r = new Set();
  if (fecha !== a.fecha) return r;
  for (const t of TURNOS) {
    const pasaron = a.minutos - minutosDelDia(t.hora);
    if (pasaron < 0 || pasaron > 90) continue;
    const faltan = QUINIELAS.filter((q) => sortea(q.id, t.id)).some((q) => !extractoDe(datos, t.id, q.id));
    if (faltan) r.add(t.id);
  }
  return r;
}

export default function Resultados() {
  const [fecha, setFecha] = useState(() => (diaSemana(hoy()) === 0 ? sumarDias(hoy(), -1) : hoy()));
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [turnoElegido, setTurnoElegido] = useState(null);
  const jugadas = useMemo(() => cargarJugadas(), []);
  const calendario = useRef(null);
  const [mensaje, setMensaje] = useMensaje();
  const [vista, setVista] = useState(leerVista);
  function cambiarVista(v) {
    setVista(v);
    try { localStorage.setItem(CLAVE_VISTA, v); } catch { /* modo privado */ }
  }

  async function compartirTexto(texto) {
    try {
      const r = await compartir(texto);
      if (r === 'copiado') setMensaje('Copiado: pegalo donde quieras');
    } catch {
      setMensaje('Tu teléfono no dejó compartir');
    }
  }

  function abrirCalendario() {
    const c = calendario.current;
    if (!c) return;
    if (c.showPicker) {
      try { c.showPicker(); return; } catch { /* algunos navegadores no lo permiten */ }
    }
    c.focus();
    c.click();
  }

  const cargar = useCallback(async (f) => {
    setCargando(true);
    setError(null);
    try {
      setDatos(await obtenerResultados(f));
    } catch {
      setDatos(null);
      setError('No pudimos traer los resultados. Revisá tu conexión y tocá "Actualizar".');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    setTurnoElegido(null);
    cargar(fecha);
  }, [fecha, cargar]);

  // Hoy: mientras haya un turno en vivo (falta alguna quiniela), se actualiza solo cada 30 segundos
  useEffect(() => {
    if (fecha !== hoy()) return undefined;
    const id = setInterval(() => {
      const falta = TURNOS.some((t) => yaEsLaHora(fecha, t.hora) && !datos?.turnos?.some((x) => x.turno === t.id));
      if (falta || turnosEnVivo(fecha, datos).size) cargar(fecha);
    }, 30000);
    return () => clearInterval(id);
  }, [fecha, datos, cargar]);

  const salieron = new Set((datos?.turnos ?? []).map((t) => t.turno));
  const ultimoQueSalio = [...TURNOS].reverse().find((t) => salieron.has(t.id))?.id;
  const turno = turnoElegido ?? ultimoQueSalio ?? TURNOS[0].id;
  const infoTurno = TURNOS.find((t) => t.id === turno);
  const esDomingo = diaSemana(fecha) === 0;
  const esHoy = fecha === hoy();
  const enVivo = turnosEnVivo(fecha, datos);
  const jugadasCabeza = (t, q, n) => ubicacionesJugadas(jugadas, fecha, t, q, [n, ...Array(19).fill('')]).has(1);
  function elegirTurno(t) {
    setTurnoElegido(t);
    cambiarVista('turno');
  }

  return (
    <section className="pantalla">
      <div className="selector-fecha">
        <button type="button" className="flecha" onClick={() => setFecha(sumarDias(fecha, -1))} aria-label="Día anterior">‹</button>
        <h2>
          <button type="button" className="fecha-boton" onClick={abrirCalendario} aria-label="Elegir otra fecha">
            {esHoy ? 'Hoy, ' : ''}
            {fechaLarga(fecha)}
          </button>
        </h2>
        <input
          ref={calendario}
          type="date"
          className="calendario"
          max={hoy()}
          value={fecha}
          onChange={(e) => e.target.value && setFecha(e.target.value)}
          tabIndex={-1}
          aria-hidden="true"
        />
        <button type="button" className="flecha" onClick={() => setFecha(sumarDias(fecha, 1))} disabled={esHoy} aria-label="Día siguiente">›</button>
      </div>

      {esDomingo ? (
        <div className="aviso">
          <p>Los domingos no hay sorteos de quiniela.</p>
          <button type="button" className="boton" onClick={() => setFecha(sumarDias(fecha, -1))}>Ver los del sábado</button>
        </div>
      ) : (
        <>
          <div className="filtros-fila vista-resultados">
            <div className="segmentado" role="group" aria-label="Cómo ver los resultados">
              <button type="button" aria-pressed={vista === 'dia'} onClick={() => cambiarVista('dia')}>Todo el día</button>
              <button type="button" aria-pressed={vista === 'turno'} onClick={() => cambiarVista('turno')}>Por turno</button>
            </div>
            {enVivo.size > 0 && <span className="vivo">EN VIVO</span>}
          </div>

          {vista === 'dia' && datos && !error && (
            <>
              <TablaDelDia datos={datos} enVivo={enVivo} jugadasCabeza={jugadasCabeza} alElegir={elegirTurno} />
              <p className="nota">Tocá un número para ver los 20 de ese turno. Las quinielas van apareciendo a medida que cada lotería las publica.</p>
            </>
          )}

          {vista === 'turno' && (<>
          <nav className="turnos" aria-label="Turnos del día">
            {TURNOS.map((t) => {
              const salio = salieron.has(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`turno${t.id === turno ? ' activo' : ''}${salio ? ' salio' : ''}`}
                  aria-pressed={t.id === turno}
                  onClick={() => setTurnoElegido(t.id)}
                >
                  <span className="turno-nombre">{t.nombre}{enVivo.has(t.id) && <span className="vivo-punto" aria-label="en vivo" />}</span>
                  <span className="turno-hora">{t.hora}</span>
                </button>
              );
            })}
          </nav>

          {datos && salieron.has(turno) && (
            <div className="acciones-turno">
              <button type="button" className="enlace" onClick={() => compartirTexto(textoCabezas({ turno, fecha, resultados: datos }))}>
                Compartir las cabezas de {infoTurno.nombre}
              </button>
            </div>
          )}

          {datos?.sinConexion && <p className="nota">Sin conexión: te mostramos lo último que guardó tu teléfono.</p>}

          {error && (
            <div className="aviso">
              <p>{error}</p>
              <button type="button" className="boton" onClick={() => cargar(fecha)}>Actualizar</button>
            </div>
          )}

          {!error && cargando && !datos && <p className="nota">Buscando los resultados…</p>}

          {!error && datos && !salieron.has(turno) && (
            <div className="aviso">
              {yaEsLaHora(fecha, infoTurno.hora) ? (
                <>
                  <p>{infoTurno.nombre} se sorteó a las {infoTurno.hora}. Los resultados suelen aparecer en pocos minutos.</p>
                  <button type="button" className="boton" onClick={() => cargar(fecha)} disabled={cargando}>
                    {cargando ? 'Buscando…' : 'Actualizar'}
                  </button>
                </>
              ) : (
                <p>{infoTurno.nombre} se sortea a las {infoTurno.hora}. Cuando salga, lo vas a ver acá.</p>
              )}
            </div>
          )}

          {datos && salieron.has(turno) && (
            <div className="extractos">
              {QUINIELAS.map((q) => {
                const numeros = extractoDe(datos, turno, q.id);
                if (!numeros) return null;
                return (
                  <Extracto
                    key={q.id}
                    nombre={q.completo}
                    numeros={numeros}
                    resaltadas={ubicacionesJugadas(jugadas, fecha, turno, q.id, numeros)}
                    alCompartir={() => compartirTexto(textoExtracto({ quiniela: q.id, turno, fecha, numeros }))}
                  />
                );
              })}
              {enVivo.has(turno) && <p className="nota">Faltan quinielas de este turno: aparecen solas apenas se publican.</p>}
              <p className="nota">
                Resultados informativos: antes de cobrar, verificá con el extracto oficial de cada lotería.
              </p>
            </div>
          )}
          </>)}

          {vista === 'dia' && error && (
            <div className="aviso">
              <p>{error}</p>
              <button type="button" className="boton" onClick={() => cargar(fecha)}>Actualizar</button>
            </div>
          )}
          {vista === 'dia' && !error && cargando && !datos && <p className="nota">Buscando los resultados…</p>}
        </>
      )}
      {mensaje && <p className="mensaje" role="status">{mensaje}</p>}
    </section>
  );
}
