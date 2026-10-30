// =====================================================================
// herramientas.js — Compartir resultados y calculadora de premios
// =====================================================================
import { TABLAS_DE_PAGO, UBICACIONES } from '../../../shared/premios.js';
import { QUINIELAS, turnoPorId, nombreQuiniela } from './datos.js';
import { fechaCorta } from './fechas.js';

const PAGOS = TABLAS_DE_PAGO.LOTBA;

function enlaceApp() {
  return typeof location !== 'undefined' ? location.origin : 'https://quinielaaltoque.app';
}

// Texto para compartir un extracto completo
export function textoExtracto({ quiniela, turno, fecha, numeros }) {
  const nombre = QUINIELAS.find((q) => q.id === quiniela)?.completo ?? quiniela;
  const filas = [];
  for (let i = 0; i < 10; i++) {
    const a = `${String(i + 1).padStart(2, ' ')}. ${numeros[i] || '----'}`;
    const b = `${i + 11}. ${numeros[i + 10] || '----'}`;
    filas.push(`${a}    ${b}`);
  }
  return [
    `Quiniela ${nombre}, ${turnoPorId(turno).nombre} del ${fechaCorta(fecha)}`,
    `Cabeza: ${numeros[0]}`,
    '',
    ...filas,
    '',
    `Quiniela al Toque, resultados al instante: ${enlaceApp()}`,
  ].join('\n');
}

// Texto para compartir las cabezas de un turno
export function textoCabezas({ turno, fecha, resultados }) {
  const t = resultados?.turnos?.find((x) => x.turno === turno);
  if (!t) return null;
  const lineas = QUINIELAS.filter((q) => t.quinielas[q.id]).map((q) => `${q.nombre}: ${t.quinielas[q.id].numeros[0]}`);
  return [`Cabezas de ${turnoPorId(turno).nombre}, ${fechaCorta(fecha)}`, ...lineas, '', `Los 20 números: ${enlaceApp()}`].join('\n');
}

// Comparte con el menú del teléfono; si no se puede, copia al portapapeles.
// Devuelve 'compartido', 'copiado' o 'cancelado'.
export async function compartir(texto) {
  if (navigator.share) {
    try {
      await navigator.share({ text: texto });
      return 'compartido';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelado';
    }
  }
  await navigator.clipboard.writeText(texto);
  return 'copiado';
}

// Calculadora: cuánto paga un número según cifras, ubicación y monto
export function calcularPremio({ numero, ubicacion, monto }) {
  if (!/^\d{1,4}$/.test(numero)) return null;
  const { hasta, desde } = UBICACIONES[ubicacion];
  const lugares = hasta - desde + 1;
  const veces = PAGOS.directa[numero.length] / lugares;
  const m = Number(monto) > 0 ? Number(monto) : null;
  return {
    veces,
    premio: m ? Math.round(m * veces * 100) / 100 : null,
    ganancia: m ? Math.round((m * veces - m) * 100) / 100 : null,
  };
}

// Frase corta para un acierto de la búsqueda: "Ciudad, Matutina: ubicación 3 (5679)"
export function describirAcierto(a) {
  const ubic = a.ubicaciones.map((u, i) => (u === 1 ? `a la cabeza (${a.valores[i]})` : `ubicación ${u} (${a.valores[i]})`)).join(', ');
  return `${nombreQuiniela(a.quiniela)}, ${turnoPorId(a.turno).nombre}: ${ubic}`;
}
