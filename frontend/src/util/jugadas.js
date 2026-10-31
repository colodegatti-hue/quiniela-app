// =====================================================================
// jugadas.js — Guardar jugadas en el teléfono y controlarlas
// Usa las reglas de premios compartidas con el servidor (shared/premios.js)
// =====================================================================
import { evaluarGuardada, UBICACIONES } from '../../../shared/premios.js';
import { extractoDe, turnoPorId, TURNOS, QUINIELAS, sortea } from './datos.js';
import { yaEsLaHora } from './fechas.js';

const CLAVE = 'quiniela.jugadas.v1';
const CLAVE_DISPOSITIVO = 'quiniela.dispositivo';

export { UBICACIONES };

export function cargarJugadas() {
  try {
    const lista = JSON.parse(localStorage.getItem(CLAVE));
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

export function guardarJugadas(lista) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(lista));
    return true;
  } catch {
    return false;
  }
}

// Identificador anónimo del teléfono (para sincronizar más adelante, sin login)
export function idDispositivo() {
  try {
    let id = localStorage.getItem(CLAVE_DISPOSITIVO);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(CLAVE_DISPOSITIVO, id);
    }
    return id;
  } catch {
    return null;
  }
}

export function nuevaJugada({ tipo = 'directa', numero, ubicacion, numero2, ubicacion2, quinielas, turnos, fecha, monto }) {
  const redoblona = tipo === 'redoblona';
  return {
    id: crypto.randomUUID(),
    tipo: redoblona ? 'redoblona' : 'directa',
    numero: String(numero),
    ubicacion,
    ...(redoblona ? { numero2: String(numero2), ubicacion2 } : {}),
    quinielas,
    turnos,
    fecha,
    monto: monto ? Number(monto) : null,
    creada: new Date().toISOString(),
  };
}

// Valida lo que cargó la persona. Devuelve un texto de error o null.
export function validarJugada({ tipo, numero, numero2, ubicacion, ubicacion2, quinielas, turnos, monto }) {
  if (tipo === 'redoblona') {
    if (!/^\d{2}$/.test(numero) || !/^\d{2}$/.test(numero2 ?? '')) return 'En la redoblona los dos números tienen que tener 2 cifras.';
    if (ubicacion === 'a_los_20') return 'En la redoblona el primer número va a la cabeza, a los 5 o a los 10.';
    if (ubicacion2 === 'cabeza') return 'En la redoblona el segundo número va a los 5, a los 10 o a los 20.';
  } else if (!/^\d{1,4}$/.test(numero)) return 'El número tiene que tener de 1 a 4 cifras.';
  if (!quinielas.length) return 'Elegí al menos una quiniela.';
  if (!turnos.length) return 'Elegí al menos un turno.';
  if (monto !== '' && monto !== null && !(Number(monto) > 0)) return 'El monto tiene que ser mayor a cero, o dejalo vacío.';
  return null;
}

// Controla una jugada contra los resultados de su fecha.
// Devuelve una fila por cada quiniela y turno:
// { turno, quiniela, estado: 'gano' | 'no' | 'falta' | 'demora', aciertos, premio }
export function controlarJugada(jugada, resultados, instante = new Date()) {
  const monto = jugada.monto || 1; // sin monto: se calcula "por cada $1"
  const filas = [];
  // Siempre en el orden del día y de las quinielas, no en el que se tocaron
  const turnos = TURNOS.map((t) => t.id).filter((t) => jugada.turnos.includes(t));
  const quinielas = QUINIELAS.map((q) => q.id).filter((q) => jugada.quinielas.includes(q));
  for (const turno of turnos) {
    for (const quiniela of quinielas) {
      if (!sortea(quiniela, turno)) continue; // Montevideo no sortea en todos los turnos
      const extracto = extractoDe(resultados, turno, quiniela);
      if (!extracto) {
        const hora = turnoPorId(turno).hora;
        filas.push({ turno, quiniela, estado: yaEsLaHora(jugada.fecha, hora, instante) ? 'demora' : 'falta' });
        continue;
      }
      const { estado, resultado: r } = evaluarGuardada({ ...jugada, monto }, extracto);
      if (estado === 'pendiente') { // ya está la cabeza pero faltan números de su ubicación
        filas.push({ turno, quiniela, estado: 'demora' });
        continue;
      }
      const aciertos = r.aciertos ?? [...(r.aciertos1 ?? []), ...(r.aciertos2 ?? [])];
      filas.push({ turno, quiniela, estado: r.gano ? 'gano' : 'no', aciertos, premio: jugada.monto ? r.premio : null, veces: r.premio / monto });
    }
  }
  return filas;
}

export function resumenJugada(filas, jugada) {
  const ganadas = filas.filter((f) => f.estado === 'gano');
  const pendientes = filas.filter((f) => f.estado === 'falta' || f.estado === 'demora');
  const apostado = jugada.monto ? jugada.monto * filas.length : null;
  const premio = jugada.monto ? ganadas.reduce((s, f) => s + f.premio, 0) : null;
  return { ganadas: ganadas.length, pendientes: pendientes.length, total: filas.length, apostado, premio };
}
