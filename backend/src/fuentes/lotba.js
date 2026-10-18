// =====================================================================
// lotba.js — Fuente PRINCIPAL: Lotería de la Ciudad (oficial)
// Un pedido por sorteo trae los 20 números de todas las quinielas.
// Sorteo sin publicar: "window.RESULTADOS_DATA = [];"
// =====================================================================
import { fechaIso } from '../horarios.js';

const URL_BASE = 'https://quiniela.loteriadelaciudad.gob.ar/includes/resultados-data.php';
const NAVEGADOR = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';

// fetch con un mensaje de error claro (por ejemplo, si bloquean al servidor)
async function pedir(url, opciones) {
  try {
    return await fetch(url, opciones);
  } catch (e) {
    const causa = e.name === 'TimeoutError' ? 'tardó demasiado' : (e.cause?.code || e.message);
    throw new Error(`No se pudo conectar con la Lotería (${causa})`);
  }
}

// Pasa el nombre que usa la Lotería al id de la app
function idQuiniela(nombre) {
  const n = nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  if (n.includes('CIUDAD')) return 'ciudad';
  if (n.includes('SANTA FE')) return 'santafe';
  if (n.includes('CORDOBA')) return 'cordoba';
  if (n.includes('ENTRE RIOS')) return 'entrerios';
  if (n.includes('MENDOZA')) return 'mendoza';
  if (n.includes('MONTEVIDEO') || n.includes('URUGUAY')) return 'montevideo';
  if (n.includes('BS AS') || n.includes('BUENOS AIRES')) return 'provincia';
  return null;
}

function idTurno(modalidad) {
  const m = String(modalidad).toUpperCase();
  if (m.startsWith('PRE')) return 'previa';
  if (m.startsWith('PRI')) return 'primera';
  if (m.startsWith('MAT')) return 'matutina';
  if (m.startsWith('VES')) return 'vespertina';
  if (m.startsWith('NOC')) return 'nocturna';
  return null;
}

// Convierte la respuesta de la Lotería en un sorteo. null = todavía no salió.
export function interpretarLotba(texto) {
  const m = texto.match(/window\.RESULTADOS_DATA\s*=\s*(\[[\s\S]*?\])\s*;\s*window\./) ||
            texto.match(/window\.RESULTADOS_DATA\s*=\s*(\[[\s\S]*\])\s*;?\s*$/);
  if (!m) throw new Error('Formato inesperado en la respuesta de la Lotería');
  const datos = JSON.parse(m[1]);
  if (!Array.isArray(datos) || datos.length === 0) return null;

  const s = datos[0];
  const turno = idTurno(s.modalidad);
  if (!turno) throw new Error(`Modalidad desconocida: ${s.modalidad}`);

  const extractos = [];
  for (const j of Object.values(s.jurisdicciones || {})) {
    const quiniela = idQuiniela(j.nombre || '');
    if (!quiniela) continue;
    const numeros = [...(j.numeros || [])]
      .sort((a, b) => Number(a.pos) - Number(b.pos))
      .map((x) => String(x.val));
    // Solo se guardan extractos completos (20 números de 4 cifras)
    if (numeros.length !== 20 || !numeros.every((v) => /^\d{4}$/.test(v))) continue;
    extractos.push({ quiniela, numeros, letras: j.letras || null });
  }
  if (extractos.length === 0) return null;

  return {
    numero: Number(s.sorteo),
    fecha: fechaIso(s.fecha),
    turno,
    fuente: 'lotba',
    extractos,
  };
}

// Pide un sorteo por número. Devuelve el sorteo, o null si no salió todavía.
export async function buscarSorteoLotba(numero, { timeoutMs = 15000 } = {}) {
  const r = await pedir(`${URL_BASE}?sorteo=${numero}`, {
    headers: { 'User-Agent': NAVEGADOR, Accept: '*/*' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!r.ok) throw new Error(`Lotería respondió ${r.status}`);
  return interpretarLotba(await r.text());
}
