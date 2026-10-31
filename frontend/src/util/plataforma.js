// =====================================================================
// plataforma.js — Dónde está corriendo la app (Google Play, Android, iPhone)
// y contador de aperturas (para pedir la calificación).
// =====================================================================
export const PAQUETE_PLAY = 'com.coloapps.quinielaaltoque';
// Poner en true cuando la app esté publicada en Google Play
export const PLAY_PUBLICADA = false;
export const ENLACE_PLAY = `https://play.google.com/store/apps/details?id=${PAQUETE_PLAY}`;

const CLAVE_PLAY = 'quiniela.play';
const CLAVE_APERTURAS = 'quiniela.aperturas';

const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const escribir = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };

// La app de Google Play abre la web con ?src=play (y el referrer android-app://)
export function detectarPlay(loc = window.location, referrer = document.referrer, historial = window.history) {
  const params = new URLSearchParams(loc.search);
  const desdePlay = params.get('src') === 'play' || String(referrer || '').startsWith(`android-app://${PAQUETE_PLAY}`);
  if (desdePlay) escribir(CLAVE_PLAY, '1');
  if (params.has('src')) {
    params.delete('src');
    const resto = params.toString();
    historial.replaceState(null, '', `${loc.pathname}${resto ? `?${resto}` : ''}${loc.hash}`);
  }
  return esPlay();
}

export const esPlay = () => leer(CLAVE_PLAY) === '1';

export function esAndroid(ua = typeof navigator !== 'undefined' ? navigator.userAgent : '') {
  return /Android/i.test(ua) && !/iPhone|iPad|iPod/i.test(ua);
}

// Cuenta una apertura por sesión (abrir la app, no cada pantalla). Devuelve el total.
export function contarApertura(sesion = typeof sessionStorage !== 'undefined' ? sessionStorage : null) {
  let ya = false;
  try { ya = sesion?.getItem('quiniela.sesion') === '1'; sesion?.setItem('quiniela.sesion', '1'); } catch { /* sin sesión */ }
  const n = Number(leer(CLAVE_APERTURAS)) || 0;
  if (ya) return n;
  escribir(CLAVE_APERTURAS, String(n + 1));
  return n + 1;
}

export const aperturas = () => Number(leer(CLAVE_APERTURAS)) || 0;
