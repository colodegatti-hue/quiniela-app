// =====================================================================
// avisos.js — Activar y configurar las notificaciones push en el teléfono
// =====================================================================
import { API } from './datos.js';
import { idDispositivo, cargarJugadas } from './jugadas.js';

const CLAVE_PREFS = 'quiniela.avisos.v1';

export const PREFERENCIAS_INICIALES = {
  cabezas: true,
  quinielas: ['ciudad', 'provincia', 'santafe', 'cordoba', 'entrerios'],
  recordatorio: false,
};

export function cargarPreferencias() {
  try {
    return { ...PREFERENCIAS_INICIALES, ...JSON.parse(localStorage.getItem(CLAVE_PREFS)) };
  } catch {
    return { ...PREFERENCIAS_INICIALES };
  }
}

function guardarPreferencias(p) {
  try { localStorage.setItem(CLAVE_PREFS, JSON.stringify(p)); } catch { /* sin espacio */ }
}

// ¿Este navegador puede recibir avisos?
export function soporteAvisos() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const esIphone = /iPhone|iPad|iPod/.test(ua);
  const instalada = typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true);
  const tiene = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (esIphone && !instalada) return { ok: false, motivo: 'iphone-sin-instalar' };
  if (!tiene) return { ok: false, motivo: 'sin-soporte' };
  if (Notification.permission === 'denied') return { ok: false, motivo: 'bloqueado' };
  return { ok: true };
}

async function registro() {
  return navigator.serviceWorker.ready;
}

export async function suscripcionActual() {
  if (!soporteAvisos().ok) return null;
  const reg = await registro();
  return reg.pushManager.getSubscription();
}

function claveABytes(base64) {
  const relleno = '='.repeat((4 - (base64.length % 4)) % 4);
  const b = atob((base64 + relleno).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...b].map((c) => c.charCodeAt(0)));
}

async function enviar(ruta, cuerpo) {
  const r = await fetch(`${API}${ruta}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(60000),
  });
  if (!r.ok) throw new Error(`El servidor respondió ${r.status}`);
  return r.json();
}

// Pide permiso, se suscribe y guarda en el servidor
export async function activarAvisos(preferencias = cargarPreferencias()) {
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') throw new Error('permiso');
  const r = await fetch(`${API}/api/push/clave`, { signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error('sin-clave');
  const { clave } = await r.json();
  const reg = await registro();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveABytes(clave) });
  await enviar('/api/push/suscribir', {
    suscripcion: sub.toJSON(),
    dispositivo: idDispositivo(),
    preferencias,
    jugadas: cargarJugadas(),
  });
  guardarPreferencias(preferencias);
  return sub;
}

export async function cambiarPreferencias(preferencias) {
  guardarPreferencias(preferencias);
  const sub = await suscripcionActual();
  if (sub) await enviar('/api/push/actualizar', { endpoint: sub.endpoint, preferencias });
}

// Manda las jugadas al servidor (para avisar si salen). No falla si no hay avisos.
export async function sincronizarJugadas(jugadas) {
  try {
    const sub = await suscripcionActual();
    if (sub) await enviar('/api/push/actualizar', { endpoint: sub.endpoint, jugadas });
  } catch {
    /* sin conexión: se manda la próxima vez */
  }
}

export async function avisoDePrueba() {
  const sub = await suscripcionActual();
  if (!sub) throw new Error('sin-suscripcion');
  return enviar('/api/push/prueba', { endpoint: sub.endpoint });
}

export async function desactivarAvisos() {
  const sub = await suscripcionActual();
  if (!sub) return;
  try { await enviar('/api/push/baja', { endpoint: sub.endpoint }); } catch { /* igual se da de baja local */ }
  await sub.unsubscribe();
}
