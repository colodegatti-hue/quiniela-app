import { test } from 'node:test';
import assert from 'node:assert/strict';
import { controlarJugada, resumenJugada, validarJugada, nuevaJugada } from '../src/util/jugadas.js';
import { yaEsLaHora, sumarDias, fechaLarga, ahoraArgentina } from '../src/util/fechas.js';

// Resultados reales: Matutina del 08/10/2026 (Ciudad y Córdoba)
const RESULTADOS = {
  fecha: '2026-10-08',
  turnos: [{
    turno: 'matutina',
    quinielas: {
      ciudad: { numeros: ['9179', '4492', '3389', '6210', '5508', '6232', '1042', '3281', '0419', '9120', '9625', '4597', '0283', '4938', '6629', '1916', '3402', '5398', '8612', '1033'] },
      cordoba: { numeros: ['9800', '7947', '5394', '9142', '0383', '3129', '0884', '7698', '7718', '9450', '2638', '9136', '4008', '3750', '9287', '7894', '8101', '0012', '7552', '1425'] },
    },
  }],
};
const A_LAS_1730 = new Date('2026-10-08T20:30:00Z'); // 17:30 en Argentina

test('Controla una jugada: gana en Ciudad, no sale en Córdoba, falta la Vespertina', () => {
  const j = nuevaJugada({ numero: '79', ubicacion: 'cabeza', quinielas: ['ciudad', 'cordoba'], turnos: ['matutina', 'vespertina'], fecha: '2026-10-08', monto: '100' });
  const filas = controlarJugada(j, RESULTADOS, A_LAS_1730);
  const estado = Object.fromEntries(filas.map((f) => [`${f.turno}-${f.quiniela}`, f.estado]));
  assert.deepEqual(estado, {
    'matutina-ciudad': 'gano',
    'matutina-cordoba': 'no',
    'vespertina-ciudad': 'falta',
    'vespertina-cordoba': 'falta',
  });
  assert.equal(filas[0].premio, 7000);
  const r = resumenJugada(filas, j);
  assert.deepEqual(r, { ganadas: 1, pendientes: 2, total: 4, apostado: 400, premio: 7000 });
});

test('Si ya pasó la hora y no hay resultado, queda "esperando" (no "falta")', () => {
  const j = nuevaJugada({ numero: '79', ubicacion: 'cabeza', quinielas: ['ciudad'], turnos: ['vespertina'], fecha: '2026-10-08', monto: '' });
  const filas = controlarJugada(j, RESULTADOS, new Date('2026-10-08T21:05:00Z')); // 18:05
  assert.equal(filas[0].estado, 'demora');
});

test('Sin monto: informa cuántas veces paga', () => {
  const j = nuevaJugada({ numero: '89', ubicacion: 'a_los_5', quinielas: ['ciudad'], turnos: ['matutina'], fecha: '2026-10-08', monto: '' });
  const [f] = controlarJugada(j, RESULTADOS, A_LAS_1730);
  assert.equal(f.estado, 'gano');
  assert.equal(f.premio, null);
  assert.equal(f.veces, 14);
  assert.equal(resumenJugada([f], j).premio, null);
});

test('A los 20 con 4 cifras y respeta el cero adelante', () => {
  const j = nuevaJugada({ numero: '0419', ubicacion: 'a_los_20', quinielas: ['ciudad'], turnos: ['matutina'], fecha: '2026-10-08', monto: '20' });
  const [f] = controlarJugada(j, RESULTADOS, A_LAS_1730);
  assert.deepEqual(f.aciertos, [9]);
  assert.equal(f.premio, 3500); // 20 / 20 x 3500
});

test('Validaciones del formulario', () => {
  const base = { numero: '47', quinielas: ['ciudad'], turnos: ['previa'], monto: '' };
  assert.equal(validarJugada(base), null);
  assert.match(validarJugada({ ...base, numero: '' }), /1 a 4 cifras/);
  assert.match(validarJugada({ ...base, numero: '12345' }), /1 a 4 cifras/);
  assert.match(validarJugada({ ...base, quinielas: [] }), /quiniela/);
  assert.match(validarJugada({ ...base, turnos: [] }), /turno/);
  assert.match(validarJugada({ ...base, monto: '0' }), /mayor a cero/);
});

test('Fechas en hora argentina', () => {
  assert.equal(ahoraArgentina(new Date('2026-10-09T01:00:00Z')).fecha, '2026-10-08');
  assert.equal(yaEsLaHora('2026-10-08', '18:00', A_LAS_1730), false);
  assert.equal(yaEsLaHora('2026-10-07', '21:00', A_LAS_1730), true);
  assert.equal(sumarDias('2026-10-31', 1), '2026-11-01');
  assert.equal(fechaLarga('2026-10-08'), 'jueves, 8 de octubre');
});

test('Con solo la cabeza: a la cabeza ya se sabe, a los 20 queda esperando', () => {
  const parcial = { fecha: '2026-10-08', turnos: [{ turno: 'matutina', quinielas: { entrerios: { numeros: ['7071', ...Array(19).fill('')], parcial: true } } }] };
  const cab = nuevaJugada({ numero: '71', ubicacion: 'cabeza', quinielas: ['entrerios'], turnos: ['matutina'], fecha: '2026-10-08', monto: '' });
  assert.equal(controlarJugada(cab, parcial, A_LAS_1730)[0].estado, 'gano');
  const no = nuevaJugada({ numero: '12', ubicacion: 'cabeza', quinielas: ['entrerios'], turnos: ['matutina'], fecha: '2026-10-08', monto: '' });
  assert.equal(controlarJugada(no, parcial, A_LAS_1730)[0].estado, 'no');
  const a20 = nuevaJugada({ numero: '12', ubicacion: 'a_los_20', quinielas: ['entrerios'], turnos: ['matutina'], fecha: '2026-10-08', monto: '' });
  assert.equal(controlarJugada(a20, parcial, A_LAS_1730)[0].estado, 'demora');
});
