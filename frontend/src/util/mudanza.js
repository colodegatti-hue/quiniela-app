// =====================================================================
// mudanza.js — Pase de la dirección vieja (onrender.com) al dominio propio
// En la dirección vieja: junta lo guardado en el teléfono (jugadas, código
// Pro, preferencias) y abre el dominio nuevo llevándolo en la dirección.
// En el dominio nuevo: si llega ese paquete y el teléfono está vacío, lo guarda.
// =====================================================================
export const DOMINIO = 'https://quinielaaltoque.app';
const VIEJO = 'quiniela-app-i0j2.onrender.com';
const PREFIJO = 'quiniela.';
const MARCA = 'mudanza=';

function datosGuardados(almacen) {
  const r = {};
  for (let i = 0; i < almacen.length; i++) {
    const k = almacen.key(i);
    if (k && k.startsWith(PREFIJO)) r[k] = almacen.getItem(k);
  }
  return r;
}

const aBase64 = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deBase64 = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));

// Devuelve la dirección nueva a la que hay que ir, o null si ya estamos en el dominio bueno
export function direccionNueva(loc, almacen) {
  if (loc.hostname !== VIEJO) return null;
  let paquete = '';
  try {
    const datos = datosGuardados(almacen);
    if (Object.keys(datos).length) paquete = aBase64(JSON.stringify(datos));
  } catch { /* sin almacenamiento */ }
  const hash = paquete ? `#${MARCA}${paquete}` : loc.hash;
  return `${DOMINIO}${loc.pathname}${loc.search}${hash}`;
}

// En el dominio nuevo: guarda lo que trajo de la dirección vieja (sin pisar lo que ya haya)
export function recibirMudanza(loc, almacen, historial) {
  if (!loc.hash.startsWith(`#${MARCA}`)) return 0;
  let n = 0;
  try {
    const datos = JSON.parse(deBase64(loc.hash.slice(MARCA.length + 1)));
    for (const [k, v] of Object.entries(datos)) {
      if (k.startsWith(PREFIJO) && typeof v === 'string' && almacen.getItem(k) === null) {
        almacen.setItem(k, v);
        n++;
      }
    }
  } catch { /* paquete roto: se ignora */ }
  historial.replaceState(null, '', `${loc.pathname}${loc.search}`);
  return n;
}
