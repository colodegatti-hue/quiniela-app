// =====================================================================
// estadisticas.js — Ordenar los números salidores y atrasados
// Los datos vienen del servidor (/api/estadisticas)
// =====================================================================
import { API } from './datos.js';
import { idDispositivo } from './jugadas.js';
import { leerPro } from './pro.js';

export async function obtenerEstadisticas(quiniela, dias) {
  // Las quinielas y períodos Pro los valida el servidor con el código y el teléfono
  const codigo = leerPro()?.codigo;
  const extra = codigo ? `&codigo=${codigo}&dispositivo=${idDispositivo()}` : '';
  const r = await fetch(`${API}/api/estadisticas?quiniela=${quiniela}&dias=${dias}${extra}`, { signal: AbortSignal.timeout(60000) });
  if (r.status === 403) throw new Error('pro');
  if (!r.ok) throw new Error(`El servidor respondió ${r.status}`);
  return r.json();
}

// Campos según la ubicación elegida
export function campos(donde) {
  return donde === 'a_los_20'
    ? { veces: 'aLos20', atraso: 'atraso20', ultima: 'ultima20' }
    : { veces: 'cabeza', atraso: 'atrasoCabeza', ultima: 'ultimaCabeza' };
}

// Los que más salieron (a igual cantidad, el que salió más reciente primero)
export function salidores(numeros, donde, cuantos = 10) {
  const c = campos(donde);
  return [...numeros]
    .filter((x) => x[c.veces] > 0)
    .sort((a, b) => b[c.veces] - a[c.veces] || (a[c.atraso] ?? Infinity) - (b[c.atraso] ?? Infinity) || a.n.localeCompare(b.n))
    .slice(0, cuantos);
}

// Los que hace más sorteos que no salen (los que nunca salieron en el historial, primero)
export function atrasados(numeros, donde, cuantos = 10) {
  const c = campos(donde);
  return [...numeros]
    .sort((a, b) => (b[c.atraso] ?? Infinity) - (a[c.atraso] ?? Infinity) || a.n.localeCompare(b.n))
    .slice(0, cuantos);
}

// Del 0 al 4 según cuántas veces salió, comparado con el que más salió (para pintar la grilla)
export function intensidad(veces, maximo) {
  if (!veces || !maximo) return 0;
  return Math.max(1, Math.ceil((veces / maximo) * 4));
}
