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
];

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

function guardarMemoria(fecha, datos) {
  try {
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
