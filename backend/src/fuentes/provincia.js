// =====================================================================
// provincia.js — Fuente OFICIAL de la Quiniela de la Provincia de Bs. As.
// (loteria.gba.gob.ar/resultados). Publica los 20 números de Provincia
// de cada turno del día, a veces antes que la Lotería de la Ciudad.
// =====================================================================
import { fechaIso } from '../horarios.js';

const URL = 'https://loteria.gba.gob.ar/resultados';
const NAVEGADOR = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';

const TITULOS = {
  'LA PREVIA': 'previa',
  'EL PRIMERO': 'primera',
  'LA PRIMERA': 'primera',
  MATUTINA: 'matutina',
  VESPERTINA: 'vespertina',
  NOCTURNA: 'nocturna',
};

// Devuelve [{ fecha, turno, numeros }] solo de los turnos con los 20 números
export function interpretarProvincia(html) {
  const r = [];
  for (const bloque of String(html).split('<div class="sorteo">').slice(1)) {
    const titulo = bloque.match(/<h3>\s*Quiniela\s+([^<]+?)\s*</i)?.[1]?.toUpperCase();
    const turno = TITULOS[titulo];
    const fecha = bloque.match(/class="fechaSorteo">\s*(\d{2}\/\d{2}\/\d{4})/)?.[1];
    if (!turno || !fecha) continue;
    const numeros = [...bloque.matchAll(/<span>\s*(\d{2})\s*<\/span>\s*<span>\s*([^<]*?)\s*<\/span>/g)]
      .sort((a, b) => Number(a[1]) - Number(b[1]))
      .map((m) => m[2]);
    if (numeros.length !== 20 || !numeros.every((n) => /^\d{4}$/.test(n))) continue;
    r.push({ fecha: fechaIso(fecha), turno, numeros });
  }
  return r;
}

export async function buscarProvincia({ timeoutMs = 15000 } = {}) {
  let r;
  try {
    r = await fetch(`${URL}?t=${Date.now()}`, {
      headers: { 'User-Agent': NAVEGADOR, Accept: 'text/html', 'Cache-Control': 'no-cache' },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    throw new Error(`No se pudo conectar con la Lotería de la Provincia (${e.name === 'TimeoutError' ? 'tardó demasiado' : e.cause?.code || e.message})`);
  }
  if (!r.ok) throw new Error(`Lotería de la Provincia respondió ${r.status}`);
  return interpretarProvincia(await r.text());
}
