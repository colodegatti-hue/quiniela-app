// =====================================================================
// resumen.mjs — Texto escrito para cada página de resultados del día
// (qué cabezas se repitieron, el número más visto, Montevideo, etc.)
// y el bloque "los más salidos de la semana".
// =====================================================================
import { suenoDe } from '../../shared/suenos.js';
import { sorteaMontevideo, feriadoUruguay } from '../../shared/montevideo.js';
import { QUINIELAS, TURNOS } from '../src/util/datos.js';

const nombreQ = (id) => QUINIELAS.find((q) => q.id === id)?.nombre ?? id;
const PRINCIPALES = QUINIELAS.filter((q) => !q.provincial).map((q) => q.id);
const completo = (x) => x && !x.parcial && Array.isArray(x.numeros) && x.numeros.length === 20 && x.numeros.every((n) => /^\d{4}$/.test(n));
const enlace = (n) => `<a href="/numeros/${n}/">${n}</a>`;
const lista = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}` : xs[0] ?? '');
const minuscula = (s) => (/^(San|Santa|Cristo|Jes)/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));
const conSueno = (n) => { const s = suenoDe(n); return s ? `${enlace(n)}, ${minuscula(s.nombre)}` : enlace(n); };

// Cabezas del día: [{ turno, quiniela, numero }]
function cabezasDe(datos) {
  const r = [];
  for (const t of TURNOS) {
    const turno = datos.turnos?.find((x) => x.turno === t.id);
    for (const q of QUINIELAS) {
      const n = turno?.quinielas?.[q.id]?.numeros?.[0];
      if (n && /^\d{4}$/.test(n)) r.push({ turno: t, quiniela: q.id, numero: n });
    }
  }
  return r;
}

export function resumenDelDia(fecha, datos) {
  const cabezas = cabezasDe(datos);
  if (!cabezas.length) return '';
  const frases = [];
  const turnosCon = TURNOS.filter((t) => cabezas.some((c) => c.turno.id === t.id));
  const quinielasCon = new Set(cabezas.map((c) => c.quiniela));
  frases.push(`Hubo resultados de ${quinielasCon.size} quinielas en ${turnosCon.length === 5 ? 'los cinco sorteos del día' : `${turnosCon.length} ${turnosCon.length === 1 ? 'sorteo' : 'sorteos'} (${lista(turnosCon.map((t) => t.nombre))})`}.`);

  // La última cabeza de la Ciudad
  const ciudad = cabezas.filter((c) => c.quiniela === 'ciudad').at(-1);
  if (ciudad) frases.push(`La cabeza de la ${ciudad.turno.nombre} de la Ciudad fue el <strong>${ciudad.numero}</strong>: en la quiniela de los sueños, el ${conSueno(ciudad.numero.slice(-2))}.`);

  // Terminaciones que se repitieron a la cabeza
  const porTerm = new Map();
  for (const c of cabezas) {
    const k = c.numero.slice(-2);
    porTerm.set(k, [...(porTerm.get(k) || []), c]);
  }
  const repetidas = [...porTerm.entries()].filter(([, l]) => l.length >= 2).sort((a, b) => b[1].length - a[1].length).slice(0, 2);
  for (const [n, l] of repetidas) {
    frases.push(`El ${enlace(n)} salió <strong>${l.length} veces a la cabeza</strong>: ${lista(l.map((c) => `${c.turno.nombre} de ${nombreQ(c.quiniela)}`))}.`);
  }
  if (!repetidas.length) frases.push('Ninguna terminación de dos cifras se repitió a la cabeza.');

  // El más visto entre los 20 de las principales
  const veces = new Map();
  for (const t of datos.turnos || []) {
    for (const id of PRINCIPALES) {
      const x = t.quinielas?.[id];
      if (!completo(x)) continue;
      for (const n of x.numeros) veces.set(n.slice(-2), (veces.get(n.slice(-2)) || 0) + 1);
    }
  }
  const top = [...veces.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  if (top && top[1] >= 3) frases.push(`Entre los 20 números de las quinielas principales, el que más apareció fue el ${conSueno(top[0])}: ${top[1]} veces.`);

  // Montevideo
  const sabado = new Date(`${fecha}T12:00:00Z`).getUTCDay() === 6;
  if (feriadoUruguay(fecha)) frases.push('Montevideo no sorteó porque fue feriado en Uruguay.');
  else if (sabado && !sorteaMontevideo(fecha, 'matutina')) frases.push('Montevideo, como todos los sábados, solo tuvo la Nocturna.');

  return `<div class="resumen"><b>Resumen del día.</b> ${frases.join(' ')}</div>`;
}

// Los más salidos a la cabeza (dos cifras) en los días dados, todas las quinielas
export function masSalidosDeLaSemana(dias, porDia) {
  const veces = new Map();
  let sorteos = 0;
  for (const f of dias) {
    for (const c of cabezasDe(porDia[f] || {})) {
      sorteos++;
      const k = c.numero.slice(-2);
      veces.set(k, (veces.get(k) || 0) + 1);
    }
  }
  const top = [...veces.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 6);
  if (!top.length) return '';
  return `<h2>Los que más salieron a la cabeza esta semana</h2>
<p>${top.map(([n, c]) => `<a class="chip" href="/numeros/${n}/">${n} · ${c} ${c === 1 ? 'vez' : 'veces'}</a>`).join(' ')}</p>
<p class="tenue">Sobre ${sorteos.toLocaleString('es-AR')} cabezas de las 22 quinielas en los últimos ${dias.length} días de sorteo. Que un número venga saliendo no cambia sus chances en el próximo sorteo.</p>`;
}
