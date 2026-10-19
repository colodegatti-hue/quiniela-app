import { useEffect, useState } from 'react';
import { QUINIELAS } from '../util/datos.js';
import {
  soporteAvisos, suscripcionActual, activarAvisos, desactivarAvisos, cambiarPreferencias, avisoDePrueba, cargarPreferencias,
} from '../util/avisos.js';

const TEXTOS_SIN_SOPORTE = {
  'iphone-sin-instalar': 'En iPhone, primero instalá la app: en Safari tocá Compartir y después "Agregar a inicio". Abrila desde ese ícono y activá los avisos.',
  'sin-soporte': 'Este navegador no permite avisos. Probá con Chrome en Android o instalando la app en iPhone.',
  bloqueado: 'Los avisos están bloqueados para esta app. Activalos en los ajustes del teléfono (Notificaciones) y volvé a intentar.',
};

// "Avisame cuando salga el 47": números a seguir en cualquier quiniela
function AlertasNumeros({ prefs, cambiar }) {
  const [nuevo, setNuevo] = useState('');
  const alertas = prefs.alertas ?? [];
  const lleno = alertas.length >= 10;

  function agregar(e) {
    e.preventDefault();
    const n = nuevo.padStart(2, '0');
    if (!/^\d{1,2}$/.test(nuevo) || alertas.includes(n) || lleno) return;
    cambiar({ ...prefs, alertas: [...alertas, n] });
    setNuevo('');
  }

  return (
    <div className="alertas">
      <p className="alertas-titulo">Avisarme cuando salga un número</p>
      <p className="tenue">En cualquier quiniela y turno. Hasta 10 números de 2 cifras.</p>
      {alertas.length > 0 && (
        <ul className="fichas">
          {alertas.map((n) => (
            <li key={n}>
              <span>{n}</span>
              <button type="button" aria-label={`Quitar el ${n}`} onClick={() => cambiar({ ...prefs, alertas: alertas.filter((x) => x !== n) })}>✕</button>
            </li>
          ))}
        </ul>
      )}
      <form className="alertas-agregar" onSubmit={agregar}>
        <input inputMode="numeric" maxLength={2} placeholder="Ej.: 47" value={nuevo} disabled={lleno} onChange={(e) => setNuevo(e.target.value.replace(/\D/g, ''))} aria-label="Número a seguir" />
        <button type="submit" className="boton secundario" disabled={!nuevo || lleno}>Agregar</button>
      </form>
      {alertas.length > 0 && (
        <div className="segmentado" role="group" aria-label="Dónde tiene que salir">
          <button type="button" aria-pressed={prefs.alertasDonde !== 'a_los_20'} onClick={() => cambiar({ ...prefs, alertasDonde: 'cabeza' })}>A la cabeza</button>
          <button type="button" aria-pressed={prefs.alertasDonde === 'a_los_20'} onClick={() => cambiar({ ...prefs, alertasDonde: 'a_los_20' })}>En los 20</button>
        </div>
      )}
    </div>
  );
}

export default function PanelAvisos() {
  const [activos, setActivos] = useState(null); // null = revisando
  const [prefs, setPrefs] = useState(cargarPreferencias);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const soporte = soporteAvisos();

  useEffect(() => {
    suscripcionActual().then((s) => setActivos(Boolean(s))).catch(() => setActivos(false));
  }, []);

  async function hacer(accion, exito) {
    setOcupado(true);
    setMensaje(null);
    try {
      await accion();
      if (exito) setMensaje(exito);
    } catch (e) {
      setMensaje(e?.message === 'permiso'
        ? 'Para recibir avisos, aceptá el permiso de notificaciones cuando el teléfono lo pida.'
        : 'No pudimos completar el cambio. Revisá tu conexión y probá de nuevo.');
    } finally {
      setOcupado(false);
    }
  }

  function cambiar(nuevas) {
    setPrefs(nuevas);
    if (activos) hacer(() => cambiarPreferencias(nuevas));
  }

  if (!soporte.ok) {
    return (
      <section className="bloque avisos">
        <h3>Avisos al instante</h3>
        <p>{TEXTOS_SIN_SOPORTE[soporte.motivo]}</p>
      </section>
    );
  }

  return (
    <section className="bloque avisos">
      <h3>Avisos al instante</h3>
      {activos === false && (
        <>
          <p>Te avisamos la cabeza de cada sorteo apenas sale, si sale una de tus jugadas (con el premio estimado) y cuando salga el número que sigas.</p>
          <button type="button" className="boton" disabled={ocupado} onClick={() => hacer(async () => { await activarAvisos(prefs); setActivos(true); }, 'Listo: los avisos quedaron activados.')}>
            {ocupado ? 'Activando…' : 'Activar avisos'}
          </button>
        </>
      )}

      {activos && (
        <div className="avisos-opciones">
          <label className="interruptor">
            <input type="checkbox" checked={prefs.cabezas} onChange={(e) => cambiar({ ...prefs, cabezas: e.target.checked })} />
            <span>Cabeza de cada sorteo</span>
          </label>
          {prefs.cabezas && (
            <div className="opciones">
              {QUINIELAS.map((q) => {
                const elegida = prefs.quinielas.includes(q.id);
                return (
                  <button
                    key={q.id}
                    type="button"
                    className={`opcion${elegida ? ' activa' : ''}`}
                    aria-pressed={elegida}
                    onClick={() => cambiar({ ...prefs, quinielas: elegida ? prefs.quinielas.filter((x) => x !== q.id) : [...prefs.quinielas, q.id] })}
                  >
                    {q.nombre}
                  </button>
                );
              })}
            </div>
          )}
          <label className="interruptor">
            <input type="checkbox" checked readOnly disabled />
            <span>Si sale una de mis jugadas (siempre activo)</span>
          </label>
          <AlertasNumeros prefs={prefs} cambiar={cambiar} />
          <label className="interruptor">
            <input type="checkbox" checked={prefs.recordatorio} onChange={(e) => cambiar({ ...prefs, recordatorio: e.target.checked })} />
            <span>Recordarme 15 minutos antes de cada turno</span>
          </label>
          <div className="acciones">
            <button type="button" className="boton secundario" disabled={ocupado} onClick={() => hacer(avisoDePrueba, 'Te mandamos un aviso de prueba.')}>Probar aviso</button>
            <button type="button" className="enlace" disabled={ocupado} onClick={() => hacer(async () => { await desactivarAvisos(); setActivos(false); }, 'Desactivaste los avisos.')}>Desactivar</button>
          </div>
        </div>
      )}

      {mensaje && <p className="nota" role="status">{mensaje}</p>}
    </section>
  );
}
