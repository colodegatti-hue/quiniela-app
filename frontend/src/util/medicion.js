// =====================================================================
// medicion.js — Medición anónima de uso (cuántas personas usan la app)
// Una vez por día el teléfono le avisa al servidor que abrió la app.
// Solo manda: el id anónimo del teléfono, de dónde llegó la primera vez
// (por ejemplo el QR de una agencia) y si es Pro. Nada personal.
// =====================================================================
import { API } from './datos.js';
import { idDispositivo } from './jugadas.js';
import { hoy } from './fechas.js';

const CLAVE_ORIGEN = 'quiniela.origen';
const CLAVE_DIA = 'quiniela.uso.dia';
const ORIGEN_OK = /^(directo|inv|ag:[a-z0-9-]{2,30})$/;

let entradaAhora = null; // origen si en esta visita entró por un enlace

// Robots (Google, AdSense, analizadores, navegadores automáticos): no cuentan como personas
export const RE_ROBOT = /bot|crawl|spider|slurp|mediapartners|google-|adsbot|lighthouse|headless|pwabuilder|preview|facebookexternalhit|whatsapp|bingpreview|yandex|baidu/i;
export function esRobot(nav = typeof navigator !== 'undefined' ? navigator : {}) {
  return Boolean(nav.webdriver) || RE_ROBOT.test(String(nav.userAgent || ''));
}

const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const escribir = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };

// Lee ?ag=CODIGO de la dirección (enlace o QR de una agencia), lo recuerda y lo saca de la barra
export function capturarOrigen(loc = window.location, historial = window.history) {
  const params = new URLSearchParams(loc.search);
  const ag = String(params.get('ag') || '').toLowerCase();
  const inv = params.has('inv');
  let entrada = null;
  if (/^[a-z0-9-]{2,30}$/.test(ag)) entrada = `ag:${ag}`;
  else if (inv) entrada = 'inv';
  if (!entrada) return null;
  entradaAhora = entrada;
  if (!leer(CLAVE_ORIGEN)) escribir(CLAVE_ORIGEN, entrada);
  params.delete('ag');
  params.delete('inv');
  const resto = params.toString();
  historial.replaceState(null, '', `${loc.pathname}${resto ? `?${resto}` : ''}${loc.hash}`);
  return entrada;
}

export function origenGuardado() {
  const o = leer(CLAVE_ORIGEN);
  return ORIGEN_OK.test(o || '') ? o : 'directo';
}

// Avisa que se usó la app hoy (como mucho una vez por día, salvo que entre por un enlace)
export async function avisarUso({ pro = false } = {}) {
  if (esRobot()) return false;
  const dia = hoy();
  if (leer(CLAVE_DIA) === dia && !entradaAhora) return false;
  const d = idDispositivo();
  if (!d) return false;
  try {
    const r = await fetch(`${API}/api/ping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ d, o: origenGuardado(), e: entradaAhora, p: Boolean(pro) }),
      keepalive: true,
      signal: AbortSignal.timeout(30000),
    });
    if (r.ok) {
      escribir(CLAVE_DIA, dia);
      entradaAhora = null;
      return true;
    }
  } catch { /* sin conexión: se intenta la próxima vez que abra */ }
  return false;
}
