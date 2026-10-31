// Campanita arriba: aparece mientras los avisos no estén activados, para activarlos cuando quiera.
import { useEffect, useState } from 'react';
import { soporteAvisos, suscripcionActual, activarAvisos, EVENTO_AVISOS } from '../util/avisos.js';

export function useAvisosActivos() {
  const [activos, setActivos] = useState(null); // null = todavía no se sabe
  useEffect(() => {
    let vigente = true;
    const revisar = () => suscripcionActual().then((s) => vigente && setActivos(Boolean(s))).catch(() => vigente && setActivos(false));
    revisar();
    window.addEventListener(EVENTO_AVISOS, revisar);
    return () => { vigente = false; window.removeEventListener(EVENTO_AVISOS, revisar); };
  }, []);
  return activos;
}

export default function BotonAvisos() {
  const activos = useAvisosActivos();
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const soporte = soporteAvisos();

  if (activos !== false) return null;
  if (!soporte.ok && soporte.motivo !== 'bloqueado') return null;

  async function tocar() {
    if (!soporte.ok) {
      setMensaje('Bloqueaste los avisos. Para activarlos: ajustes del navegador → Notificaciones → permitir quinielaaltoque.app.');
      return;
    }
    setOcupado(true);
    try {
      await activarAvisos();
      setMensaje(null);
    } catch (e) {
      setMensaje(e.message === 'permiso' ? 'No diste permiso para los avisos.' : 'No se pudieron activar. Probá de nuevo.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <button type="button" className="boton-avisos" onClick={tocar} disabled={ocupado} aria-label="Activar avisos">
        <span aria-hidden="true">🔔</span> {ocupado ? 'Activando…' : 'Activar avisos'}
      </button>
      {mensaje && <p className="aviso-flotante" role="alert" onClick={() => setMensaje(null)}>{mensaje}</p>}
    </>
  );
}
