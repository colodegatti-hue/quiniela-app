// =====================================================================
// montevideo.js — ¿Hay sorteo de Montevideo (Uruguay) ese día y turno?
// Sale de los datos reales de 2026:
//  - Matutina: de lunes a viernes (los sábados no hay).
//  - Nocturna: de lunes a sábado.
//  - No hay sorteo en los feriados de Uruguay (Reyes, Carnaval, jueves a
//    sábado de Turismo, 18 de mayo, 19 de junio, 18 de julio, 25 de agosto,
//    2 de noviembre, etc.). El 12 de octubre y de lunes a miércoles de
//    Turismo SÍ sortea.
// (compartido entre la app y el servidor)
// =====================================================================

// Feriados fijos de Uruguay (mes-día)
const FIJOS = ['01-01', '01-06', '04-19', '05-01', '05-18', '06-19', '07-18', '08-25', '11-02', '12-25'];

// Domingo de Pascua (algoritmo de Gauss / Meeus) -> 'YYYY-MM-DD'
export function pascua(anio) {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function sumarDias(fecha, n) {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Feriados móviles: lunes y martes de Carnaval, y jueves a sábado de Turismo
function moviles(anio) {
  const p = pascua(anio);
  return [-48, -47, -3, -2, -1].map((n) => sumarDias(p, n));
}

export function feriadoUruguay(fecha) {
  const f = String(fecha).slice(0, 10);
  return FIJOS.includes(f.slice(5)) || moviles(Number(f.slice(0, 4))).includes(f);
}

// fecha 'YYYY-MM-DD', turno 'matutina' | 'nocturna' | ...
export function sorteaMontevideo(fecha, turno) {
  if (turno !== 'matutina' && turno !== 'nocturna') return false;
  const f = String(fecha).slice(0, 10);
  const dia = new Date(`${f}T12:00:00Z`).getUTCDay(); // 0 domingo, 6 sábado
  if (dia === 0) return false;
  if (dia === 6 && turno === 'matutina') return false;
  return !feriadoUruguay(f);
}
