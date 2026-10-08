// Pruebas automáticas de premios.js
// Correr desde la carpeta "shared" con:  npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluarDirecta, evaluarRedoblona, evaluarJugada } from './premios.js';

// Extracto REAL: Quiniela de la Ciudad, Matutina 08/10/2026 (sorteo 53009)
const MATUTINA_08_10 = [
  '9179', '4492', '3389', '6210', '5508', '6232', '1042', '3281', '0419', '9120',
  '9625', '4597', '0283', '4938', '6629', '1916', '3402', '5398', '8612', '1033',
];

// Arma un extracto de prueba: todo '0000' salvo las ubicaciones indicadas
function extracto(valores) {
  const e = Array(20).fill('0000');
  for (const [pos, val] of Object.entries(valores)) e[Number(pos) - 1] = val;
  return e;
}

// ----------------------------- DIRECTA ------------------------------

test('Directa a la cabeza: 1, 2, 3 y 4 cifras', () => {
  assert.equal(evaluarDirecta({ numero: '9', monto: 100 }, MATUTINA_08_10).premio, 700);
  assert.equal(evaluarDirecta({ numero: '79', monto: 100 }, MATUTINA_08_10).premio, 7000);
  assert.equal(evaluarDirecta({ numero: '179', monto: 100 }, MATUTINA_08_10).premio, 60000);
  assert.equal(evaluarDirecta({ numero: '9179', monto: 100 }, MATUTINA_08_10).premio, 350000);
});

test('Directa: la ganancia descuenta lo apostado', () => {
  const r = evaluarDirecta({ numero: '79', monto: 100 }, MATUTINA_08_10);
  assert.equal(r.ganancia, 6900);
  assert.equal(r.estimado, true);
});

test('Directa a los 5: divide por 5 (2 cifras paga 14 veces)', () => {
  const r = evaluarDirecta({ numero: '89', desde: 1, hasta: 5, monto: 100 }, MATUTINA_08_10);
  assert.deepEqual(r.aciertos, [3]);
  assert.equal(r.premio, 1400);
});

test('Directa a los 20 con número repetido: cobra cada aparición', () => {
  const e = extracto({ 4: '1233', 17: '9833' });
  const r = evaluarDirecta({ numero: '33', desde: 1, hasta: 20, monto: 100 }, e);
  assert.deepEqual(r.aciertos, [4, 17]);
  assert.equal(r.premio, 700); // 100 / 20 x 70 x 2
});

test('Directa: respeta el cero adelante ("05" no es "5")', () => {
  const e = extracto({ 1: '1205' });
  assert.equal(evaluarDirecta({ numero: '05', monto: 100 }, e).premio, 7000);
  assert.equal(evaluarDirecta({ numero: '5', monto: 100 }, e).premio, 700);
  assert.equal(evaluarDirecta({ numero: '15', monto: 100 }, e).premio, 0);
});

test('Directa sin acierto: premio 0 y pierde lo apostado', () => {
  const r = evaluarDirecta({ numero: '12', desde: 1, hasta: 10, monto: 100 }, MATUTINA_08_10);
  assert.equal(r.gano, false);
  assert.equal(r.premio, 0);
  assert.equal(r.ganancia, -100);
});

// ---------------- REDOBLONA: ejemplos del reglamento ----------------
// Mismo número saliendo en las ubicaciones 3, 6, 8 y 14
const CON_25 = extracto({ 3: '1125', 6: '2225', 8: '3325', 14: '4425' });

test('Art. 10.d: rangos independientes (1-10 y 12-20) → 3 y 1', () => {
  const r = evaluarRedoblona({ numero1: '25', desde1: 1, hasta1: 10, numero2: '25', desde2: 12, hasta2: 20, monto: 100 }, CON_25);
  assert.deepEqual(r.aciertos1, [3, 6, 8]);
  assert.deepEqual(r.aciertos2, [14]);
  assert.equal(r.premio, 16333.33); // (100/10 x 70 x 3) / 9 x 70 x 1
});

test('Art. 10.d: rangos superpuestos (1-12 y 5-20) → 2 y 2', () => {
  const r = evaluarRedoblona({ numero1: '25', desde1: 1, hasta1: 12, numero2: '25', desde2: 5, hasta2: 20, monto: 100 }, CON_25);
  assert.deepEqual(r.aciertos1, [3, 6]);
  assert.deepEqual(r.aciertos2, [8, 14]);
  assert.equal(r.premio, 10208.33); // (100/12 x 70 x 2) / 16 x 70 x 2
});

test('Art. 10.d: rangos incluidos (1-12 y 2-10) → 2 y 2', () => {
  const e = extracto({ 1: '1125', 3: '2225', 6: '3325', 8: '4425' });
  const r = evaluarRedoblona({ numero1: '25', desde1: 1, hasta1: 12, numero2: '25', desde2: 2, hasta2: 10, monto: 100 }, e);
  assert.deepEqual(r.aciertos1, [1, 3]);
  assert.deepEqual(r.aciertos2, [6, 8]);
});

// ---------------- REDOBLONA: casos especiales -----------------------

test('Art. 10.b: 1.ª a la cabeza y 2.ª a los 5 → la 2.ª va de la 2 a la 6', () => {
  const r = evaluarRedoblona({ numero1: '79', desde1: 1, hasta1: 1, numero2: '32', desde2: 1, hasta2: 5, monto: 100 }, MATUTINA_08_10);
  assert.deepEqual(r.ubicacionesSegunda, [2, 3, 4, 5, 6]);
  assert.deepEqual(r.aciertos2, [6]); // 6232 está en la ubicación 6
  assert.equal(r.premio, 98000); // 100 x 70 / 5 x 70
});

test('Art. 11: 1.ª a la cabeza y 2.ª a los 20 → divide por 19', () => {
  const r = evaluarRedoblona({ numero1: '79', desde1: 1, hasta1: 1, numero2: '33', desde2: 1, hasta2: 20, monto: 100 }, MATUTINA_08_10);
  assert.equal(r.ubicacionesSegunda.length, 19);
  assert.deepEqual(r.aciertos2, [20]); // 1033
  assert.equal(r.premio, 25789.47); // 7000 / 19 x 70
});

test('Art. 11: 1.ª a la ubicación 8 y 2.ª de 1 a 10 → divide por 9', () => {
  const r = evaluarRedoblona({ numero1: '81', desde1: 8, hasta1: 8, numero2: '89', desde2: 1, hasta2: 10, monto: 100 }, MATUTINA_08_10);
  assert.equal(r.ubicacionesSegunda.length, 9);
  assert.equal(r.premio, 54444.44); // 7000 / 9 x 70
});

test('Art. 19: tope de 2500 veces en la cabeza a los 2', () => {
  const e = extracto({ 1: '1179', 2: '2255', 3: '3355' });
  const r = evaluarRedoblona({ numero1: '79', desde1: 1, hasta1: 1, numero2: '55', desde2: 1, hasta2: 2, monto: 100 }, e);
  assert.equal(r.topeAplicado, true);
  assert.equal(r.premio, 250000);
});

test('Art. 19: sin repetición no llega al tope (cabeza a los 2)', () => {
  const e = extracto({ 1: '1179', 2: '2255' });
  const r = evaluarRedoblona({ numero1: '79', desde1: 1, hasta1: 1, numero2: '55', desde2: 1, hasta2: 2, monto: 100 }, e);
  assert.equal(r.topeAplicado, false);
  assert.equal(r.premio, 245000); // 7000 / 2 x 70
});

test('Redoblona exacta: 3500 veces lo apostado', () => {
  const r = evaluarRedoblona({ numero1: '79', desde1: 1, hasta1: 1, numero2: '92', desde2: 2, hasta2: 2, monto: 100 }, MATUTINA_08_10);
  assert.equal(r.exacta, true);
  assert.equal(r.premio, 350000);
});

test('Redoblona sin el segundo acierto: no cobra nada', () => {
  const r = evaluarRedoblona({ numero1: '79', desde1: 1, hasta1: 1, numero2: '00', desde2: 1, hasta2: 5, monto: 100 }, MATUTINA_08_10);
  assert.equal(r.gano, false);
  assert.equal(r.premio, 0);
});

// ----------------------------- GENERAL ------------------------------

test('evaluarJugada elige el tipo correcto', () => {
  assert.equal(evaluarJugada({ tipo: 'directa', numero: '79', monto: 100 }, MATUTINA_08_10).premio, 7000);
  assert.equal(evaluarJugada({ tipo: 'redoblona', numero1: '79', desde1: 1, hasta1: 1, numero2: '92', desde2: 2, hasta2: 2, monto: 100 }, MATUTINA_08_10).premio, 350000);
});

test('Rechaza datos inválidos', () => {
  assert.throws(() => evaluarDirecta({ numero: '12345', monto: 100 }, MATUTINA_08_10));
  assert.throws(() => evaluarDirecta({ numero: '12', monto: 0 }, MATUTINA_08_10));
  assert.throws(() => evaluarDirecta({ numero: '12', desde: 1, hasta: 21, monto: 100 }, MATUTINA_08_10));
  assert.throws(() => evaluarDirecta({ numero: '12', monto: 100 }, MATUTINA_08_10.slice(0, 19)));
  assert.throws(() => evaluarRedoblona({ numero1: '7', desde1: 1, hasta1: 1, numero2: '92', desde2: 2, hasta2: 2, monto: 100 }, MATUTINA_08_10));
  assert.throws(() => evaluarRedoblona({ numero1: '79', desde1: 5, hasta1: 5, numero2: '92', desde2: 5, hasta2: 5, monto: 100 }, MATUTINA_08_10));
});
