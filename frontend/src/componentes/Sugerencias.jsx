// Carteles que aparecen arriba de la pantalla:
// 1) Activar los avisos (apenas abre la app, hasta que los active o diga "Ahora no").
// 2) Calificar en Google Play (solo Android, desde la 3.ª vez que abre la app).
import { useEffect, useState } from 'react';
import { soporteAvisos, suscripcionActual, activarAvisos } from '../util/avisos.js';
import { esAndroid, aperturas, ENLACE_PLAY, PLAY_PUBLICADA, esPlay } from '../util/plataforma.js';

const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const escribir = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
const DIA = 864e5;

// "Ahora no" lo vuelve a ofrecer en unos días; "no" definitivo después de 3 veces
function posponer(clave, dias) {
  const veces = (Number(leer(`${clave}.veces`)) || 0) + 1;
  escribir(`${clave}.veces`, String(veces));
  escribir(clave, veces >= 3 ? 'nunca' : String(Date.now() + dias * DIA));
}
function toca(clave) {
  const v = leer(clave);
  if (v === 'nunca' || v === 'hecho') return false;
  return !v || Date.now() > Number(v);
}

export default function Sugerencias() {
  const [cartel, setCartel] = useState(null); // 'avisos' | 'iphone' | 'calificar'
  const [estado, setEstado] = useState({ ocupado: false, error: null });

  useEffect(() => {
    let vigente = true;
    (async () => {
      const s = soporteAvisos();
      if (s.ok && Notification.permission !== 'denied' && toca('quiniela.cartel.avisos')) {
        const sub = await suscripcionActual().catch(() => null);
        if (!sub) { if (vigente) setCartel('avisos'); return; }
      }
      if (s.motivo === 'iphone-sin-instalar' && toca('quiniela.cartel.iphone')) { if (vigente) setCartel('iphone'); return; }
      if (esAndroid() && (PLAY_PUBLICADA || esPlay()) && aperturas() >= 3 && toca('quiniela.cartel.calificar')) {
        if (vigente) setCartel('calificar');
      }
    })();
    return () => { vigente = false; };
  }, []);

  if (!cartel) return null;

  async function activar() {
    setEstado({ ocupado: true, error: null });
    try {
      await activarAvisos();
      escribir('quiniela.cartel.avisos', 'hecho');
      setCartel(null);
    } catch (e) {
      setEstado({ ocupado: false, error: e.message === 'permiso' ? 'No diste permiso. Lo podés activar después desde Jugadas.' : 'No se pudo activar. Probá de nuevo en un rato.' });
    }
  }

  if (cartel === 'avisos') {
    return (
      <section className="cartel" role="dialog" aria-label="Activar avisos">
        <p className="cartel-titulo">🔔 ¿Te avisamos cuando salgan los números?</p>
        <p>Recibí la cabeza de cada sorteo apenas sale y enterate al toque si salió tu jugada.</p>
        <div className="cartel-botones">
          <button type="button" className="boton" disabled={estado.ocupado} onClick={activar}>{estado.ocupado ? 'Activando…' : 'Sí, avisame'}</button>
          <button type="button" className="enlace" onClick={() => { posponer('quiniela.cartel.avisos', 3); setCartel(null); }}>Ahora no</button>
        </div>
        {estado.error && <p className="error" role="alert">{estado.error}</p>}
      </section>
    );
  }

  if (cartel === 'iphone') {
    return (
      <section className="cartel" role="dialog" aria-label="Instalar la app">
        <p className="cartel-titulo">🔔 Para recibir avisos en iPhone</p>
        <p>Tocá el botón Compartir <span aria-hidden="true">⬆️</span> de Safari y elegí <strong>“Agregar a inicio”</strong>. Después abrí la app desde ese ícono y activá los avisos.</p>
        <div className="cartel-botones">
          <button type="button" className="enlace" onClick={() => { posponer('quiniela.cartel.iphone', 7); setCartel(null); }}>Entendido</button>
        </div>
      </section>
    );
  }

  return (
    <section className="cartel" role="dialog" aria-label="Calificar la app">
      <p className="cartel-titulo">⭐ ¿Te sirve Quiniela al Toque?</p>
      <p>Calificala en Google Play: nos ayuda un montón a que más gente la encuentre.</p>
      <div className="cartel-botones">
        <a className="boton" href={ENLACE_PLAY} target="_blank" rel="noopener" onClick={() => { escribir('quiniela.cartel.calificar', 'hecho'); setCartel(null); }}>Calificar</a>
        <button type="button" className="enlace" onClick={() => { posponer('quiniela.cartel.calificar', 5); setCartel(null); }}>Más tarde</button>
      </div>
    </section>
  );
}
