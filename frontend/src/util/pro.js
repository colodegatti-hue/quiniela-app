// =====================================================================
// pro.js — Versión Pro en el teléfono: código de 6 dígitos, compra y vencimiento
// =====================================================================
import { useEffect, useState } from 'react';
import { API } from './datos.js';
import { idDispositivo } from './jugadas.js';
import { origenGuardado } from './medicion.js';

const CLAVE = 'quiniela.pro.v1';
const CLAVE_PENDIENTE = 'quiniela.pro.pendiente';
const EVENTO = 'quiniela-pro';

// Qué es gratis y qué es Pro
export const GRATIS = {
  quinielas: ['ciudad', 'provincia'], // estadísticas
  dias: [30],
};

function leer(clave) {
  try { return JSON.parse(localStorage.getItem(clave)); } catch { return null; }
}
function escribir(clave, valor) {
  try {
    if (valor === null) localStorage.removeItem(clave);
    else localStorage.setItem(clave, JSON.stringify(valor));
  } catch { /* modo privado */ }
}

// { codigo, plan, vence, revisado } o null
export function leerPro() {
  const p = leer(CLAVE);
  return p && /^\d{6}$/.test(p.codigo) ? p : null;
}

export function esPro(p = leerPro(), ahora = new Date()) {
  return Boolean(p && new Date(p.vence) > ahora);
}

function guardarPro(p) {
  escribir(CLAVE, p);
  window.dispatchEvent(new Event(EVENTO));
}

// Para las pantallas: se actualiza solo cuando cambia
export function usePro() {
  const [p, setP] = useState(leerPro);
  useEffect(() => {
    const cambio = () => setP(leerPro());
    window.addEventListener(EVENTO, cambio);
    window.addEventListener('storage', cambio);
    return () => { window.removeEventListener(EVENTO, cambio); window.removeEventListener('storage', cambio); };
  }, []);
  return { pro: esPro(p), datos: p };
}

async function pedir(ruta, cuerpo) {
  const r = await fetch(`${API}${ruta}`, cuerpo === undefined ? { signal: AbortSignal.timeout(60000) } : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(60000),
  });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok && !datos.error) throw new Error(`El servidor respondió ${r.status}`);
  return datos;
}

export const obtenerPlanes = () => pedir('/api/pro/planes');

// Activa un código en este teléfono. Devuelve { ok, error }
export async function activarCodigo(codigo) {
  const r = await pedir('/api/pro/verificar', { codigo, dispositivo: idDispositivo() });
  if (r.error) return { ok: false, error: r.error };
  guardarPro({ codigo: r.codigo, plan: r.plan, vence: r.vence, revisado: new Date().toISOString() });
  avisarCodigoAlServidor(r.codigo);
  if (!r.activo) return { ok: false, error: 'Ese código está vencido. Podés renovarlo abajo.' };
  return { ok: true };
}

// Revisa el código guardado una vez por día (por si se renovó o venció)
export async function revisarPro() {
  const p = leerPro();
  if (!p) return;
  if (p.revisado && Date.now() - new Date(p.revisado) < 864e5) return;
  try {
    const r = await pedir('/api/pro/verificar', { codigo: p.codigo, dispositivo: idDispositivo() });
    if (!r.error) guardarPro({ codigo: r.codigo, plan: r.plan, vence: r.vence, revisado: new Date().toISOString() });
  } catch { /* sin conexión: se revisa la próxima vez */ }
}

export function olvidarCodigo() {
  guardarPro(null);
}

// Va a Mercado Pago. Si ya tiene código, lo renueva (suma los días).
export async function comprar(plan) {
  const r = await pedir('/api/pro/comprar', { plan, codigo: leerPro()?.codigo, dispositivo: idDispositivo(), origen: origenGuardado() });
  if (r.error || !r.url) throw new Error(r.error || 'No se pudo iniciar el pago');
  escribir(CLAVE_PENDIENTE, r.referencia);
  window.location.href = r.url;
}

// Al volver de Mercado Pago la dirección trae ?pro=REFERENCIA
export function tomarRetorno() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('pro');
  if (!ref) return false;
  escribir(CLAVE_PENDIENTE, ref);
  window.history.replaceState(null, '', `${window.location.pathname}#/pro`);
  return true;
}

export const compraPendiente = () => leer(CLAVE_PENDIENTE);

// Pregunta por la compra pendiente. Devuelve 'aprobada' | 'pendiente' | 'rechazada' | 'desconocida'
export async function confirmarCompra() {
  const ref = compraPendiente();
  if (!ref) return 'desconocida';
  const r = await pedir(`/api/pro/confirmar?ref=${encodeURIComponent(ref)}`);
  if (r.estado === 'aprobada' && r.licencia) {
    escribir(CLAVE_PENDIENTE, null);
    await activarCodigo(r.licencia.codigo);
  }
  if (r.estado === 'rechazada' || r.estado === 'desconocida') escribir(CLAVE_PENDIENTE, null);
  return r.estado ?? 'pendiente';
}

// Le cuenta al servidor de avisos que este teléfono es Pro (para las alertas de número)
async function avisarCodigoAlServidor(codigo) {
  try {
    const { suscripcionActual } = await import('./avisos.js');
    const sub = await suscripcionActual();
    if (sub) await pedir('/api/push/actualizar', { endpoint: sub.endpoint, codigo });
  } catch { /* sin avisos o sin conexión */ }
}

// "2026-11-20T..." -> "20/11/2026"
export function fechaVence(iso) {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}
