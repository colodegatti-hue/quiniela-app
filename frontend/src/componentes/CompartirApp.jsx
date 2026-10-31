// Botón para recomendar la app (WhatsApp o lo que tenga el teléfono)
import { useState } from 'react';
import { compartir, textoInvitacion } from '../util/herramientas.js';

export default function CompartirApp({ compacto = false }) {
  const [mensaje, setMensaje] = useState(null);

  async function tocar() {
    try {
      const r = await compartir(textoInvitacion());
      if (r === 'copiado') setMensaje('Copiamos el enlace: pegalo en WhatsApp o donde quieras.');
      else if (r === 'compartido') setMensaje('¡Gracias por recomendarnos!');
    } catch {
      setMensaje('Tu teléfono no dejó compartir.');
    }
    setTimeout(() => setMensaje(null), 4000);
  }

  return (
    <div className={`compartir-app${compacto ? ' compacto' : ''}`}>
      <button type="button" className="boton secundario" onClick={tocar}>📲 Compartir la app</button>
      {!compacto && <p className="tenue">¿Te sirve? Pasásela a quien juegue: es gratis.</p>}
      {mensaje && <p className="mensaje" role="status">{mensaje}</p>}
    </div>
  );
}
