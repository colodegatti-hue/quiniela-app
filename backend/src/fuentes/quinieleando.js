// =====================================================================
// quinieleando.js — Fuente de RESPALDO: quinieleando.com.ar
// Una página por quiniela con todos los turnos del día en el HTML.
// =====================================================================
import { QUINIELAS, fechaIso } from '../horarios.js';

const URL_BASE = 'https://quinieleando.com.ar/quinielas';
const NAVEGADOR = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';

// fetch con un mensaje de error claro (por ejemplo, si bloquean al servidor)
async function pedir(url, opciones) {
  try {
    return await fetch(url, opciones);
  } catch (e) {
    const causa = e.name === 'TimeoutError' ? 'tardó demasiado' : (e.cause?.code || e.message);
    throw new Error(`No se pudo conectar con quinieleando (${causa})`);
  }
}

const TITULOS = {
  'LA PREVIA': 'previa',
  'LA PRIMERA': 'primera',
  MATUTINA: 'matutina',
  VESPERTINA: 'vespertina',
  NOCTURNA: 'nocturna',
};

function aTexto(html) {
  return html
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
}

// Devuelve los turnos completos que encuentra en la página de una quiniela:
// [{ fecha, turno, numeros: [20 textos] }]
export function interpretarQuinieleando(html) {
  const texto = aTexto(html);
  const encabezado = /(LA PREVIA|LA PRIMERA|MATUTINA|VESPERTINA|NOCTURNA),[^.]{0,60}\.\s*(\d{1,2}\/\d{1,2}\/\d{4})\s*Cabeza:\s*(\d{4})/g;
  const marcas = [...texto.matchAll(encabezado)];
  const resultado = [];

  marcas.forEach((m, i) => {
    const inicio = m.index + m[0].length;
    const fin = i + 1 < marcas.length ? marcas[i + 1].index : texto.length;
    let bloque = texto.slice(inicio, fin);
    const corte = bloque.search(/Letras/i);
    if (corte >= 0) bloque = bloque.slice(0, corte);

    // La tabla viene como pares "ubicación número": 1 7218 6 2820 11 3408 ...
    const numeros = Array(20).fill(null);
    for (const p of bloque.matchAll(/(?:^|\s)(\d{1,2})\s+(\d{4})(?=\s|$)/g)) {
      const pos = Number(p[1]);
      if (pos >= 1 && pos <= 20 && numeros[pos - 1] === null) numeros[pos - 1] = p[2];
    }
    if (numeros.includes(null)) return; // incompleto: se descarta
    if (numeros[0] !== m[3]) return; // la cabeza tiene que coincidir

    resultado.push({ fecha: fechaIso(m[2]), turno: TITULOS[m[1]], numeros });
  });
  return resultado;
}

// Baja la página "resultados de hoy" de una quiniela
export async function buscarPaginaQuinieleando(slug, { timeoutMs = 15000 } = {}) {
  const r = await pedir(`${URL_BASE}/${slug}/resultados-de-hoy`, {
    headers: { 'User-Agent': NAVEGADOR, Accept: 'text/html' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!r.ok) throw new Error(`quinieleando respondió ${r.status}`);
  return interpretarQuinieleando(await r.text());
}

// Arma un sorteo (fecha + turno) juntando las 5 quinielas. null = no está.
export async function buscarSorteoQuinieleando(fecha, turno, opciones) {
  const extractos = [];
  for (const q of QUINIELAS) {
    try {
      const turnos = await buscarPaginaQuinieleando(q.slug, opciones);
      const t = turnos.find((x) => x.fecha === fecha && x.turno === turno);
      if (t) extractos.push({ quiniela: q.id, numeros: t.numeros, letras: null });
    } catch (e) {
      console.warn(`[quinieleando] ${q.slug}: ${e.message}`);
    }
  }
  if (extractos.length === 0) return null;
  return { numero: null, fecha, turno, fuente: 'quinieleando', extractos };
}
