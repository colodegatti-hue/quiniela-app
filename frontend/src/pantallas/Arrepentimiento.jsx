// Botón de arrepentimiento (Ley 24.240, art. 34): pedir que se cancele una compra Pro
import { useState } from 'react';
import { API } from '../util/datos.js';
import { leerPro } from '../util/pro.js';
import { CONTACTO } from './Legal.jsx';

export default function Arrepentimiento() {
  const [codigo, setCodigo] = useState(() => leerPro()?.codigo ?? '');
  const [contacto, setContacto] = useState('');
  const [detalle, setDetalle] = useState('');
  const [estado, setEstado] = useState({ enviando: false, numero: null, error: null });

  async function enviar(e) {
    e.preventDefault();
    setEstado({ enviando: true, numero: null, error: null });
    try {
      const r = await fetch(`${API}/api/pro/arrepentimiento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: codigo || undefined, contacto, detalle }),
        signal: AbortSignal.timeout(60000),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo enviar el pedido.');
      setEstado({ enviando: false, numero: d.numero, error: null });
    } catch (err) {
      setEstado({ enviando: false, numero: null, error: err.message || 'No se pudo enviar el pedido. Revisá tu conexión.' });
    }
  }

  return (
    <section className="pantalla texto">
      <h2>Botón de arrepentimiento</h2>
      <p>
        Si compraste Quiniela Pro, podés cancelar la compra dentro de los 10 días corridos desde que la hiciste, sin dar
        explicaciones. Te devolvemos el dinero por el mismo medio de pago en Mercado Pago y el código deja de funcionar.
      </p>

      {estado.numero ? (
        <section className="bloque confirmacion aprobada" role="status">
          <p>Recibimos tu pedido.</p>
          <p>Número de trámite: <strong className="seleccionable">{estado.numero}</strong></p>
          <p className="tenue">Guardalo. Te vamos a responder al contacto que dejaste{CONTACTO ? <> y, si querés, podés escribirnos a <strong className="seleccionable">{CONTACTO}</strong></> : null}.</p>
        </section>
      ) : (
        <form className="formulario" onSubmit={enviar} noValidate>
          <label className="campo">
            <span>Tu código Pro</span>
            <input id="arr-codigo" inputMode="numeric" maxLength={6} placeholder="000000" value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} />
            <small>Si no lo tenés a mano, dejalo vacío y contanos abajo cuándo compraste.</small>
          </label>
          <label className="campo">
            <span>Mail o teléfono para responderte</span>
            <input id="arr-contacto" type="text" autoComplete="email" value={contacto} onChange={(e) => setContacto(e.target.value)} />
          </label>
          <label className="campo">
            <span>Algo más que nos quieras contar (opcional)</span>
            <textarea id="arr-detalle" rows={3} maxLength={500} value={detalle} onChange={(e) => setDetalle(e.target.value)} />
          </label>
          {estado.error && <p className="error" role="alert">{estado.error}</p>}
          <div className="acciones">
            <button type="submit" className="boton" disabled={estado.enviando}>{estado.enviando ? 'Enviando…' : 'Cancelar mi compra'}</button>
          </div>
        </form>
      )}
    </section>
  );
}
