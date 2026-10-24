// =====================================================================
// vivitusuerte.js — Fuente de RESPALDO rápida: vivitusuerte.com
// Una consulta por quiniela trae los 20 números de los 5 turnos del día.
// Se usa solo para completar quinielas que todavía no llegaron por la vía
// oficial; cuando llega el dato oficial, lo reemplaza.
// =====================================================================
const URL_BASE = 'https://vivitusuerte.com/api/juegos/pizarras';
const NAVEGADOR = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';

// Nombre de cada quiniela en ese sitio
export const SLUGS_VIVI = {
  ciudad: 'ciudad',
  provincia: 'provincia',
  santafe: 'santa+fe',
  cordoba: 'cordoba',
  entrerios: 'entre+rios',
  mendoza: 'mendoza',
  montevideo: 'montevideo',
};

// "momento" del sitio -> turno de la app
const MOMENTOS = { 5: 'previa', 1: 'primera', 2: 'matutina', 3: 'vespertina', 4: 'nocturna' };

// Devuelve [{ turno, numeros }] solo de los turnos con los 20 números
export function interpretarVivi(json) {
  const datos = json?.datos;
  if (!datos || typeof datos !== 'object') return [];
  const r = [];
  for (const [momento, fila] of Object.entries(datos)) {
    const turno = MOMENTOS[momento];
    if (!turno || !fila) continue;
    const numeros = [];
    for (let i = 1; i <= 20; i++) numeros.push(String(fila[`momento_dato_${i}`] ?? ''));
    if (numeros.every((n) => /^\d{4}$/.test(n))) r.push({ turno, numeros });
  }
  return r;
}

// fecha: AAAA-MM-DD. Devuelve [{ fecha, turno, numeros }]
export async function buscarVivi(quiniela, fecha, { timeoutMs = 10000 } = {}) {
  const slug = SLUGS_VIVI[quiniela];
  if (!slug) return [];
  let r;
  try {
    r = await fetch(`${URL_BASE}?fecha=${fecha}&url=${slug}&_=${Date.now()}`, {
      headers: { 'User-Agent': NAVEGADOR, Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', Referer: `https://vivitusuerte.com/pizarra/${slug}` },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    throw new Error(`No se pudo conectar con vivitusuerte (${e.name === 'TimeoutError' ? 'tardó demasiado' : e.cause?.code || e.message})`);
  }
  if (!r.ok) throw new Error(`vivitusuerte respondió ${r.status}`);
  return interpretarVivi(await r.json()).map((x) => ({ fecha, ...x }));
}
