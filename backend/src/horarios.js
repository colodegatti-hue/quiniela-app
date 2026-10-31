// =====================================================================
// horarios.js — Turnos, quinielas y manejo de la hora argentina
// Fuente: programación mensual de la Lotería de la Ciudad (oct-2026):
// lunes a sábado, 5 sorteos por día, mismos horarios todos los días.
// =====================================================================

export const TURNOS = [
  { id: 'previa', nombre: 'La Previa', hora: '10:15' },
  { id: 'primera', nombre: 'La Primera', hora: '12:00' },
  { id: 'matutina', nombre: 'Matutina', hora: '15:00' },
  { id: 'vespertina', nombre: 'Vespertina', hora: '18:00' },
  { id: 'nocturna', nombre: 'Nocturna', hora: '21:00' },
];

// Quinielas con respaldo en quinieleando.com.ar ("slug" = dirección en ese sitio)
export const QUINIELAS = [
  { id: 'ciudad', nombre: 'Ciudad (Nacional)', slug: 'nacional' },
  { id: 'provincia', nombre: 'Provincia de Buenos Aires', slug: 'buenosaires' },
  { id: 'santafe', nombre: 'Santa Fe', slug: 'santafe' },
  { id: 'cordoba', nombre: 'Córdoba', slug: 'cordoba' },
  { id: 'entrerios', nombre: 'Entre Ríos', slug: 'entrerios' },
  { id: 'mendoza', nombre: 'Mendoza', slug: 'mendoza' },
];
// Montevideo también llega desde la Lotería (Matutina y Nocturna), pero no tiene respaldo.

// Quinielas provinciales (solo desde vivitusuerte: 20 números y cabezas del día).
// vivi = nombre en vivitusuerte (los de dos palabras van con %2B); cabeza = id en "cabezas del día"
export const PROVINCIALES = [
  { id: 'corrientes', nombre: 'Corrientes', vivi: 'corrientes', cabeza: 8 },
  { id: 'chaco', nombre: 'Chaco', vivi: 'chaco', cabeza: 9 },
  { id: 'santiago', nombre: 'Santiago del Estero', vivi: 'santiago', cabeza: 10 },
  { id: 'neuquen', nombre: 'Neuquén', vivi: 'neuquen', cabeza: 11 },
  { id: 'sanluis', nombre: 'San Luis', vivi: 'san%2Bluis', cabeza: 12 },
  { id: 'salta', nombre: 'Salta', vivi: 'salta', cabeza: 13 },
  { id: 'jujuy', nombre: 'Jujuy', vivi: 'jujuy', cabeza: 14 },
  { id: 'tucuman', nombre: 'Tucumán', vivi: 'tucuman', cabeza: 15 },
  { id: 'chubut', nombre: 'Chubut', vivi: 'chubut', cabeza: 16 },
  { id: 'formosa', nombre: 'Formosa', vivi: 'formosa', cabeza: 17 },
  { id: 'misiones', nombre: 'Misiones', vivi: 'misiones', cabeza: 18 },
  { id: 'catamarca', nombre: 'Catamarca', vivi: 'catamarca', cabeza: 19 },
  { id: 'sanjuan', nombre: 'San Juan', vivi: 'san%2Bjuan', cabeza: 20 },
  { id: 'larioja', nombre: 'La Rioja', vivi: 'la%2Brioja', cabeza: 21 },
  { id: 'rionegro', nombre: 'Río Negro', vivi: 'rio%2Bnegro', cabeza: 34 },
];
export const IDS_PROVINCIALES = PROVINCIALES.map((q) => q.id);

export const IDS_TURNOS = TURNOS.map((t) => t.id);
export const IDS_QUINIELAS = QUINIELAS.map((q) => q.id);

// Argentina usa UTC-3 todo el año (sin horario de verano).
const DESFASE_MS = 3 * 60 * 60 * 1000;

// Devuelve la fecha/hora argentina de un instante
export function horaArgentina(instante = new Date()) {
  const d = new Date(instante.getTime() - DESFASE_MS);
  const fecha = d.toISOString().slice(0, 10); // AAAA-MM-DD
  return {
    fecha,
    diaSemana: d.getUTCDay(), // 0 = domingo
    minutos: d.getUTCHours() * 60 + d.getUTCMinutes(),
  };
}

export function minutosDelDia(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// Instante exacto (Date) en que sale un turno de una fecha
export function instanteDelSorteo(fecha, turnoId) {
  const turno = TURNOS.find((t) => t.id === turnoId);
  if (!turno) throw new Error(`Turno desconocido: ${turnoId}`);
  return new Date(`${fecha}T${turno.hora}:00-03:00`);
}

// Turnos de hoy cuya hora ya pasó (domingo: ninguno)
export function turnosYaSorteados(instante = new Date()) {
  const { diaSemana, minutos } = horaArgentina(instante);
  if (diaSemana === 0) return [];
  return TURNOS.filter((t) => minutosDelDia(t.hora) <= minutos).map((t) => t.id);
}

// "2026-10-08" -> "8/10/2026" (formato de quinieleando)
export function fechaCorta(fecha) {
  const [a, m, d] = fecha.split('-').map(Number);
  return `${d}/${m}/${a}`;
}

// "08/10/2026" o "8/10/2026" -> "2026-10-08"
export function fechaIso(texto) {
  const [d, m, a] = texto.split('/').map(Number);
  return `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
