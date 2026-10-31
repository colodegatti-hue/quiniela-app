// =====================================================================
// pozos.js — Poceada de la Ciudad, Quiniela Plus y Super Plus (vivitusuerte)
// Cada juego: 20 números de 2 cifras (00 al 99) y ganadores/premios por categoría.
// =====================================================================
const URL = 'https://vivitusuerte.com/api/juegos/poceado';
const NAVEGADOR = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';

// juego -> { nombre en vivitusuerte, prefijo de las claves }
export const JUEGOS_POZO = {
  poceada: { vivi: 'q.%2Bpoceada%2Bde%2Bla%2Bciudad', prefijo: '' },
  quinielaplus: { vivi: 'quiniela%2Bplus', prefijo: 'quinielaplus-' },
  superplus: { vivi: 'quiniela%2Bplus', prefijo: 'superplus-' },
};

const pesos = (t) => {
  const v = Number(String(t || '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(v) && v > 0 ? v : null;
};

// Devuelve { fecha, sorteo, numeros, categorias: [{ cat, ganadores, premio }] } o null si no está completo
export function interpretarPozo(datos, prefijo, fechaEsperada) {
  if (!datos || typeof datos !== 'object') return null;
  const k = (x) => datos[`${prefijo}${x}`];
  const fecha = k('fecha');
  if (fechaEsperada && fecha !== fechaEsperada) return null;
  const numeros = [];
  for (let i = 1; i <= 20; i++) {
    const n = String(k(`b${i}`) ?? '').trim();
    if (!/^\d{1,2}$/.test(n)) return null;
    numeros.push(n.padStart(2, '0'));
  }
  const categorias = [];
  for (let c = 1; c <= 7; c++) {
    const g = String(k(`cat${c}`) ?? '').trim();
    const p = pesos(k(`prm${c}`));
    if (g === '' && p === null) continue;
    categorias.push({ cat: c, ganadores: /^\d+$/.test(g) ? Number(g) : null, premio: p });
  }
  return { fecha, sorteo: Number(k('sorteo')) || null, numeros, categorias, pozo: pesos(k('pozo')) };
}

async function traer(vivi, fecha, timeoutMs) {
  let r;
  try {
    r = await fetch(`${URL}?fecha=${fecha}&url=${vivi}&_=${Date.now()}`, {
      headers: { 'User-Agent': NAVEGADOR, Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', Referer: 'https://vivitusuerte.com/poceados/quiniela+plus' },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    throw new Error(`No se pudo conectar con vivitusuerte (${e.name === 'TimeoutError' ? 'tardó demasiado' : e.cause?.code || e.message})`);
  }
  if (!r.ok) throw new Error(`vivitusuerte respondió ${r.status}`);
  const j = await r.json();
  return j?.datos ?? null;
}

// Trae los tres juegos de una fecha: { poceada, quinielaplus, superplus } (los que estén)
export async function buscarPozos(fecha, { timeoutMs = 10000 } = {}) {
  const r = {};
  const poceada = await traer(JUEGOS_POZO.poceada.vivi, fecha, timeoutMs);
  const p = interpretarPozo(poceada, '', fecha);
  if (p) r.poceada = p;
  const plus = await traer(JUEGOS_POZO.quinielaplus.vivi, fecha, timeoutMs);
  const q = interpretarPozo(plus, 'quinielaplus-', fecha);
  if (q) r.quinielaplus = q;
  const s = interpretarPozo(plus, 'superplus-', fecha);
  if (s) r.superplus = s;
  return r;
}
