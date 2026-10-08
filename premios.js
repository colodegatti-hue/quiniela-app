// =====================================================================
// premios.js — Reglas de premios de la Quiniela (archivo COMPARTIDO)
// Lo usan el frontend (app) y el backend (servidor). No duplicar.
//
// Fuentes oficiales (Lotería de la Ciudad de Buenos Aires - LOTBA):
//  - Reglamento "La Quiniela de la Ciudad" (arts. 6, 10, 11, 17 y 19)
//  - Programación mensual octubre 2026 (relaciones de pago)
//
// Todos los premios son ESTIMADOS: la Lotería puede aplicar "tope de
// banca" y pagar a prorrata (reglamento, art. 17).
// Los premios INCLUYEN lo apostado (programación mensual).
// =====================================================================

export const TABLAS_DE_PAGO = {
  LOTBA: {
    nombre: 'Lotería de la Ciudad',
    fuente: 'Programación mensual LOTBA, octubre 2026',
    // Apuesta directa al primer lugar (a la cabeza): veces lo apostado
    directa: { 1: 7, 2: 70, 3: 600, 4: 3500 },
    // Redoblona: 70 veces el cociente de cada apuesta
    redoblona: 70,
    // Redoblona exacta (las dos apuestas a una sola ubicación): 3500 veces
    redoblonaExacta: 3500,
    // Topes de la redoblona por rangos (art. 19), en veces lo apostado
    topesRedoblona: { general: 1500, cabezaALos2: 2500, cabezaALos3: 1800 },
  },
};

export const TABLA_POR_DEFECTO = 'LOTBA';

// Ubicaciones que ofrece la app
export const UBICACIONES = {
  cabeza: { desde: 1, hasta: 1, nombre: 'A la cabeza' },
  a_los_5: { desde: 1, hasta: 5, nombre: 'A los 5' },
  a_los_10: { desde: 1, hasta: 10, nombre: 'A los 10' },
  a_los_20: { desde: 1, hasta: 20, nombre: 'A los 20' },
};

// ---------------------------------------------------------------------
// Ayudantes
// ---------------------------------------------------------------------

function redondear(valor) {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

function obtenerTabla(tabla) {
  const t = typeof tabla === 'string' ? TABLAS_DE_PAGO[tabla] : tabla;
  if (!t) throw new Error(`Tabla de pago desconocida: ${tabla}`);
  return t;
}

function validarExtracto(extracto) {
  if (!Array.isArray(extracto) || extracto.length !== 20) {
    throw new Error('El extracto debe tener exactamente 20 números');
  }
  extracto.forEach((n, i) => {
    if (!/^\d{4}$/.test(String(n))) {
      throw new Error(`Número inválido en la ubicación ${i + 1}: ${n}`);
    }
  });
}

function validarMonto(monto) {
  if (typeof monto !== 'number' || !(monto > 0)) {
    throw new Error('El monto debe ser un número mayor a cero');
  }
}

function crearRango(desde, hasta) {
  if (!Number.isInteger(desde) || !Number.isInteger(hasta) ||
      desde < 1 || hasta > 20 || desde > hasta) {
    throw new Error(`Ubicación inválida: desde ${desde} hasta ${hasta}`);
  }
  const r = [];
  for (let p = desde; p <= hasta; p++) r.push(p);
  return r;
}

// Devuelve las ubicaciones (1 a 20) donde sale el número jugado
function buscarAciertos(extracto, numero, posiciones) {
  return posiciones.filter((p) => String(extracto[p - 1]).endsWith(numero));
}

// ---------------------------------------------------------------------
// Apuesta directa (reglamento art. 6.a y 11)
// jugada = { numero: '1' a '9999' como texto (respeta ceros: '05'),
//            desde: 1, hasta: 1..20, monto: pesos por extracto }
// ---------------------------------------------------------------------
export function evaluarDirecta(jugada, extracto, tabla = TABLA_POR_DEFECTO) {
  const t = obtenerTabla(tabla);
  validarExtracto(extracto);
  const numero = String(jugada.numero);
  if (!/^\d{1,4}$/.test(numero)) {
    throw new Error('El número jugado debe tener de 1 a 4 cifras');
  }
  validarMonto(jugada.monto);
  const desde = jugada.desde ?? 1;
  const hasta = jugada.hasta ?? 1;
  const posiciones = crearRango(desde, hasta);

  const aciertos = buscarAciertos(extracto, numero, posiciones);
  const relacion = t.directa[numero.length];
  // Art. 11: importe / cantidad de lugares x relación de pago, por cada acierto
  const premio = redondear((jugada.monto / posiciones.length) * relacion * aciertos.length);

  return {
    tipo: 'directa',
    gano: aciertos.length > 0,
    aciertos,
    premio,
    ganancia: redondear(premio - jugada.monto),
    estimado: true,
  };
}

// ---------------------------------------------------------------------
// Redoblona (reglamento art. 6.b, 10, 11 y 19)
// jugada = { numero1: '00'..'99', desde1, hasta1,
//            numero2: '00'..'99', desde2, hasta2, monto }
// ---------------------------------------------------------------------
export function evaluarRedoblona(jugada, extracto, tabla = TABLA_POR_DEFECTO) {
  const t = obtenerTabla(tabla);
  validarExtracto(extracto);
  const n1 = String(jugada.numero1);
  const n2 = String(jugada.numero2);
  if (!/^\d{2}$/.test(n1) || !/^\d{2}$/.test(n2)) {
    throw new Error('En la redoblona los dos números deben tener 2 cifras');
  }
  validarMonto(jugada.monto);
  const { desde1, hasta1, desde2, hasta2, monto } = jugada;

  const rango1 = crearRango(desde1, hasta1);
  let rango2 = crearRango(desde2, hasta2);

  // Primera apuesta a UNA sola ubicación y la segunda la incluye:
  // esa ubicación no cuenta para la segunda (art. 11: "lugares menos uno").
  // Si la primera es a la cabeza, la segunda se corre una ubicación
  // (art. 10.b), salvo que llegue hasta la 20 (art. 11: divide por 19).
  const primeraUnica = desde1 === hasta1;
  if (primeraUnica && rango2.includes(desde1)) {
    rango2 = rango2.filter((p) => p !== desde1);
    if (desde1 === 1 && hasta2 < 20) rango2.push(hasta2 + 1);
  }
  if (rango2.length === 0) {
    throw new Error('La segunda apuesta no tiene ubicaciones válidas');
  }

  let aciertos1;
  let aciertos2;
  if (n1 !== n2) {
    // Art. 10.c: números distintos, cada uno cuenta sus repeticiones
    aciertos1 = buscarAciertos(extracto, n1, rango1);
    aciertos2 = buscarAciertos(extracto, n2, rango2);
  } else {
    // Art. 10.d: números iguales
    const en2 = new Set(rango2);
    const en1 = new Set(rango1);
    const solo1 = rango1.filter((p) => !en2.has(p));
    const solo2 = rango2.filter((p) => !en1.has(p));
    const compartido = rango1.filter((p) => en2.has(p));
    const enCompartido = buscarAciertos(extracto, n1, compartido);
    // En la parte compartida, el primer acierto va a la 1.ª apuesta
    // y el resto a la 2.ª. En las partes propias, cada una cuenta los suyos.
    aciertos1 = [...buscarAciertos(extracto, n1, solo1), ...enCompartido.slice(0, 1)].sort((a, b) => a - b);
    aciertos2 = [...enCompartido.slice(1), ...buscarAciertos(extracto, n2, solo2)].sort((a, b) => a - b);
  }

  const gano = aciertos1.length > 0 && aciertos2.length > 0;
  const exacta = desde1 === hasta1 && desde2 === hasta2;
  let premio = 0;
  let topeAplicado = false;

  if (gano && exacta) {
    // Redoblona exacta: 3500 veces lo apostado
    premio = monto * t.redoblonaExacta;
  } else if (gano) {
    // Art. 11: 70 veces el cociente de cada apuesta
    const premio1 = (monto / rango1.length) * t.redoblona * aciertos1.length;
    premio = (premio1 / rango2.length) * t.redoblona * aciertos2.length;
    // Art. 19: topes
    let tope = t.topesRedoblona.general;
    if (desde1 === 1 && hasta1 === 1 && desde2 === 1 && hasta2 === 2) tope = t.topesRedoblona.cabezaALos2;
    if (desde1 === 1 && hasta1 === 1 && desde2 === 1 && hasta2 === 3) tope = t.topesRedoblona.cabezaALos3;
    if (premio > monto * tope) {
      premio = monto * tope;
      topeAplicado = true;
    }
  }
  premio = redondear(premio);

  return {
    tipo: 'redoblona',
    gano,
    exacta,
    aciertos1,
    aciertos2,
    ubicacionesSegunda: rango2,
    premio,
    ganancia: redondear(premio - monto),
    topeAplicado,
    estimado: true,
  };
}

// ---------------------------------------------------------------------
// Punto de entrada único: evalúa cualquier jugada contra un extracto
// ---------------------------------------------------------------------
export function evaluarJugada(jugada, extracto, tabla = TABLA_POR_DEFECTO) {
  if (jugada.tipo === 'redoblona') return evaluarRedoblona(jugada, extracto, tabla);
  return evaluarDirecta(jugada, extracto, tabla);
}
