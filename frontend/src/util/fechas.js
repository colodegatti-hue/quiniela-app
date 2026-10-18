// Fechas en hora argentina (UTC-3 todo el año). Formato interno: AAAA-MM-DD
const DESFASE_MS = 3 * 60 * 60 * 1000;

export function ahoraArgentina(instante = new Date()) {
  const d = new Date(instante.getTime() - DESFASE_MS);
  return {
    fecha: d.toISOString().slice(0, 10),
    minutos: d.getUTCHours() * 60 + d.getUTCMinutes(),
    diaSemana: d.getUTCDay(),
  };
}

export const hoy = () => ahoraArgentina().fecha;

export function sumarDias(fecha, dias) {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function diaSemana(fecha) {
  return new Date(`${fecha}T12:00:00Z`).getUTCDay();
}

// "2026-10-08" -> "jueves 8 de octubre"
export function fechaLarga(fecha) {
  return new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
    .format(new Date(`${fecha}T12:00:00Z`));
}

// "2026-10-08" -> "jue 8/10"
export function fechaCorta(fecha) {
  const d = new Date(`${fecha}T12:00:00Z`);
  const dia = new Intl.DateTimeFormat('es-AR', { weekday: 'short', timeZone: 'UTC' }).format(d).replace('.', '');
  return `${dia} ${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
}

export function minutosDelDia(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// ¿Ya pasó la hora de este turno? (fechas pasadas: sí; futuras: no)
export function yaEsLaHora(fecha, hora, instante = new Date()) {
  const a = ahoraArgentina(instante);
  if (fecha < a.fecha) return true;
  if (fecha > a.fecha) return false;
  return a.minutos >= minutosDelDia(hora);
}

export function formatoPesos(valor) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: valor % 1 ? 2 : 0 }).format(valor);
}
