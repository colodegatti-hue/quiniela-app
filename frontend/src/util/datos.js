// =====================================================================
// datos.js — Quinielas, turnos y conexión con el servidor
// (los mismos datos que backend/src/horarios.js)
// =====================================================================

export const API = (import.meta.env?.VITE_API_URL || 'https://api.quinielaaltoque.app').replace(/\/$/, '');

export const QUINIELAS = [
  { id: 'ciudad', nombre: 'Ciudad', completo: 'Ciudad (ex Nacional)' },
  { id: 'provincia', nombre: 'Provincia', completo: 'Provincia de Bs. As.' },
  { id: 'santafe', nombre: 'Santa Fe', completo: 'Santa Fe' },
  { id: 'cordoba', nombre: 'Córdoba', completo: 'Córdoba' },
  { id: 'entrerios', nombre: 'Entre Ríos', completo: 'Entre Ríos' },
  { id: 'mendoza', nombre: 'Mendoza', completo: 'Mendoza' },
  { id: 'montevideo', nombre: 'Montevideo', completo: 'Montevideo (Uruguay)', soloTurnos: ['matutina', 'nocturna'] },
  // Provincias (sortean en horarios parecidos; algunas no tienen todos los turnos)
  { id: 'corrientes', nombre: 'Corrientes', completo: 'Corrientes', provincial: true },
  { id: 'chaco', nombre: 'Chaco', completo: 'Chaco', provincial: true },
  { id: 'santiago', nombre: 'Santiago', completo: 'Santiago del Estero', provincial: true },
  { id: 'neuquen', nombre: 'Neuquén', completo: 'Neuquén', provincial: true },
  { id: 'sanluis', nombre: 'San Luis', completo: 'San Luis', provincial: true },
  { id: 'salta', nombre: 'Salta', completo: 'Salta', provincial: true },
  { id: 'jujuy', nombre: 'Jujuy', completo: 'Jujuy', provincial: true },
  { id: 'tucuman', nombre: 'Tucumán', completo: 'Tucumán', provincial: true },
  { id: 'chubut', nombre: 'Chubut', completo: 'Chubut', provincial: true },
  { id: 'formosa', nombre: 'Formosa', completo: 'Formosa', provincial: true },
  { id: 'misiones', nombre: 'Misiones', completo: 'Misiones', provincial: true },
  { id: 'catamarca', nombre: 'Catamarca', completo: 'Catamarca', provincial: true },
  { id: 'sanjuan', nombre: 'San Juan', completo: 'San Juan', provincial: true },
  { id: 'larioja', nombre: 'La Rioja', completo: 'La Rioja', provincial: true },
  { id: 'rionegro', nombre: 'Río Negro', completo: 'Río Negro', provincial: true },
];
export const PRINCIPALES = QUINIELAS.filter((q) => !q.provincial);
export const PROVINCIALES = QUINIELAS.filter((q) => q.provincial);

// Qué quinielas mostrar en Resultados (las elige cada uno; por defecto las 7 de siempre)
const CLAVE_VER = 'quiniela.ver';
export const EVENTO_VER = 'quiniela-ver';
export function quinielasVisibles() {
  try {
    const lista = JSON.parse(localStorage.getItem(CLAVE_VER));
    if (Array.isArray(lista) && lista.length) return QUINIELAS.filter((q) => lista.includes(q.id));
  } catch { /* sin almacenamiento */ }
  return PRINCIPALES;
}
export function guardarVisibles(ids) {
  try { localStorage.setItem(CLAVE_VER, JSON.stringify(ids)); } catch { /* modo privado */ }
  try { window.dispatchEvent(new Event(EVENTO_VER)); } catch { /* fuera del navegador */ }
}

// ¿Esa quiniela sortea en ese turno? (Montevideo solo en Matutina y Nocturna)
export function sortea(quiniela, turno) {
  const q = QUINIELAS.find((x) => x.id === quiniela);
  return !q?.soloTurnos || q.soloTurnos.includes(turno);
}

export const TURNOS = [
  { id: 'previa', nombre: 'La Previa', hora: '10:15' },
  { id: 'primera', nombre: 'La Primera', hora: '12:00' },
  { id: 'matutina', nombre: 'Matutina', hora: '15:00' },
  { id: 'vespertina', nombre: 'Vespertina', hora: '18:00' },
  { id: 'nocturna', nombre: 'Nocturna', hora: '21:00' },
];

export const nombreQuiniela = (id) => QUINIELAS.find((q) => q.id === id)?.nombre ?? id;
export const turnoPorId = (id) => TURNOS.find((t) => t.id === id);

const CLAVE_MEMORIA = 'quiniela.resultados.';

function leerMemoria(fecha) {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_MEMORIA + fecha));
  } catch {
    return null;
  }
}

// Borra los resultados guardados de hace más de 14 días (para no llenar el teléfono)
export function podarMemoria(fechaActual, almacen = localStorage) {
  const limite = new Date(`${fechaActual}T12:00:00Z`);
  limite.setUTCDate(limite.getUTCDate() - 14);
  const desde = limite.toISOString().slice(0, 10);
  const viejas = [];
  for (let i = 0; i < almacen.length; i++) {
    const k = almacen.key(i);
    if (k?.startsWith(CLAVE_MEMORIA) && k.slice(CLAVE_MEMORIA.length) < desde) viejas.push(k);
  }
  for (const k of viejas) almacen.removeItem(k);
  return viejas.length;
}

function guardarMemoria(fecha, datos) {
  try {
    podarMemoria(new Date().toISOString().slice(0, 10));
    localStorage.setItem(CLAVE_MEMORIA + fecha, JSON.stringify(datos));
  } catch {
    /* sin espacio o modo privado: no pasa nada */
  }
}

// Resultados de un día: { fecha, turnos: [{ turno, numero, fuente, quinielas: { ciudad: { numeros, letras } } }] }
// Si no hay conexión, devuelve lo último que se vio de ese día (con sinConexion: true).
export async function obtenerResultados(fecha) {
  try {
    const r = await fetch(`${API}/api/resultados?fecha=${fecha}`, { signal: AbortSignal.timeout(60000) });
    if (!r.ok) throw new Error(`El servidor respondió ${r.status}`);
    const datos = await r.json();
    guardarMemoria(fecha, datos);
    return datos;
  } catch (e) {
    const guardado = leerMemoria(fecha);
    if (guardado) return { ...guardado, sinConexion: true };
    throw e;
  }
}

// Extracto (20 números) de una quiniela en un turno, o null
export function extractoDe(resultados, turno, quiniela) {
  return resultados?.turnos?.find((t) => t.turno === turno)?.quinielas?.[quiniela]?.numeros ?? null;
}

// ¿Salió mi número? Busca en los sorteos de los últimos días
export async function buscarNumero(numero, dias) {
  const r = await fetch(`${API}/api/buscar?numero=${numero}&dias=${dias}`, { signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`El servidor respondió ${r.status}`);
  return r.json();
}

// Poceada de la Ciudad, Quiniela Plus y Super Plus de un día: { fecha, juegos: { poceada: { sorteo, numeros, categorias } } }
export async function obtenerPozos(fecha) {
  const r = await fetch(`${API}/api/pozos?fecha=${fecha}`, { signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`El servidor respondió ${r.status}`);
  return r.json();
}

// Números de la boleta de Poceada/Plus: "5 12 27..." -> ['05','12','27'] (sin repetir, hasta 15)
export function leerBoleta(texto) {
  const r = [];
  for (const m of String(texto).match(/\d{1,2}/g) ?? []) {
    const n = m.padStart(2, '0');
    if (!r.includes(n)) r.push(n);
  }
  return r.slice(0, 15);
}
