// =====================================================================
// pro.js — Versión Pro: compra, confirmación del pago y código de 6 dígitos
//
// 1. comprar(): crea la compra y el link de pago de Mercado Pago.
// 2. La persona paga y vuelve a la app (o Mercado Pago avisa al servidor).
// 3. confirmar() / procesarAviso(): si el pago está aprobado y el monto es
//    correcto, se activa (o se extiende) el código. Se aprueba UNA sola vez.
// 4. verificar(): el teléfono consulta su código (hasta 3 teléfonos por código).
// =====================================================================
import { randomInt, randomUUID } from 'node:crypto';
import * as baseReal from './db.js';
import * as mpReal from './mercadopago.js';

export const MAX_DISPOSITIVOS = 3;

export function planes() {
  return {
    mensual: { dias: 31, precio: Number(process.env.PRECIO_MENSUAL || 1990), titulo: 'Quiniela Pro - 1 mes' },
    anual: { dias: 366, precio: Number(process.env.PRECIO_ANUAL || 14990), titulo: 'Quiniela Pro - 1 año' },
  };
}

const APP_URL = () => (process.env.APP_URL || 'https://quiniela-app-i0j2.onrender.com').replace(/\/$/, '');
const SERVIDOR_URL = () => (process.env.SERVIDOR_URL || 'https://quiniela-backend-ou9g.onrender.com').replace(/\/$/, '');

export const codigoValido = (c) => /^\d{6}$/.test(String(c ?? ''));

function respuestaLicencia(l, ahora = new Date()) {
  if (!l) return null;
  const vence = new Date(l.vence);
  return { codigo: l.codigo, plan: l.plan, vence: vence.toISOString(), activo: vence > ahora };
}

export function crearPro(opciones = {}) {
  const base = opciones.base ?? baseReal;
  const mp = opciones.mp ?? mpReal;
  const nuevoCodigo = opciones.nuevoCodigo ?? (() => String(randomInt(0, 1000000)).padStart(6, '0'));
  const nuevaReferencia = opciones.nuevaReferencia ?? (() => randomUUID());

  async function codigoLibre() {
    for (let i = 0; i < 20; i++) {
      const c = nuevoCodigo();
      if (!(await base.codigoUsado(c))) return c;
    }
    throw new Error('No se pudo generar un código libre');
  }

  // plan: 'mensual' | 'anual'. codigo (opcional): renovar ese código.
  async function comprar({ plan, codigo }) {
    const p = planes()[plan];
    if (!p) return { error: 'Plan inválido' };
    let cod = null;
    if (codigo !== undefined && codigo !== null && codigo !== '') {
      if (!codigoValido(codigo) || !(await base.buscarLicencia(codigo))) return { error: 'Ese código no existe' };
      cod = codigo;
    }
    cod ??= await codigoLibre();
    const referencia = nuevaReferencia();
    await base.crearCompra({ referencia, codigo: cod, plan, precio: p.precio });
    const pref = await mp.crearPreferencia({
      titulo: p.titulo,
      precio: p.precio,
      referencia,
      urlVuelta: `${APP_URL()}/?pro=${referencia}`,
      urlAvisos: `${SERVIDOR_URL()}/api/pro/aviso-pago`,
    });
    return { url: pref.url, referencia };
  }

  // Revisa un pago y, si corresponde, aprueba la compra. Devuelve la licencia o null.
  async function aprobarSiCorresponde(compra, pago) {
    if (!pago || pago.status !== 'approved') return null;
    if (pago.external_reference !== compra.referencia) return null;
    if (pago.currency_id && pago.currency_id !== 'ARS') return null;
    if (Number(pago.transaction_amount) + 0.01 < Number(compra.precio)) return null; // pagó menos
    return base.aprobarCompra(compra.referencia, pago.id, planes()[compra.plan].dias);
  }

  // Cuando la persona vuelve de Mercado Pago a la app
  async function confirmar(referencia) {
    const compra = await base.buscarCompra(referencia);
    if (!compra) return { estado: 'desconocida' };
    if (compra.estado === 'aprobada') {
      return { estado: 'aprobada', licencia: respuestaLicencia(await base.buscarLicencia(compra.codigo)) };
    }
    const pagos = await mp.buscarPagos(referencia);
    for (const pago of pagos) {
      const l = await aprobarSiCorresponde(compra, pago);
      if (l) return { estado: 'aprobada', licencia: respuestaLicencia(l) };
    }
    const rechazado = pagos.length > 0 && pagos.every((x) => ['rejected', 'cancelled'].includes(x.status));
    return { estado: rechazado ? 'rechazada' : 'pendiente' };
  }

  // Aviso de Mercado Pago (webhook). No se confía en lo que llega: se consulta el pago.
  async function procesarAviso(pagoId) {
    if (!/^\d+$/.test(String(pagoId ?? ''))) return { ok: false };
    const pago = await mp.obtenerPago(pagoId);
    if (!pago?.external_reference) return { ok: false };
    const compra = await base.buscarCompra(pago.external_reference);
    if (!compra) return { ok: false };
    if (compra.estado === 'aprobada') return { ok: true, ya: true };
    const l = await aprobarSiCorresponde(compra, pago);
    return { ok: Boolean(l) };
  }

  // El teléfono pregunta si su código está vigente (y queda anotado en ese código)
  async function verificar(codigo, dispositivo, ahora = new Date()) {
    if (!codigoValido(codigo)) return { activo: false, error: 'El código tiene 6 números' };
    const l = await base.buscarLicencia(codigo);
    if (!l) return { activo: false, error: 'Ese código no existe' };
    if (dispositivo && !(await base.vincularDispositivo(codigo, String(dispositivo).slice(0, 64), MAX_DISPOSITIVOS))) {
      return { activo: false, error: `Ese código ya se usa en ${MAX_DISPOSITIVOS} teléfonos` };
    }
    return respuestaLicencia(l, ahora);
  }

  return { comprar, confirmar, procesarAviso, verificar };
}
