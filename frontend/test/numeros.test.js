import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SUENOS, suenoDe, buscarSueno } from '../src/util/suenos.js';
import { salidores, atrasados, intensidad } from '../src/util/estadisticas.js';

test('La tabla de sueños tiene los 100 números, del 00 al 99, sin repetir', () => {
  assert.equal(SUENOS.length, 100);
  SUENOS.forEach((s, i) => assert.equal(s.n, String(i).padStart(2, '0')));
  assert.ok(SUENOS.every((s) => s.nombre.length > 2));
});

test('Significado de un número (de 1 a 4 cifras: cuentan las 2 últimas)', () => {
  assert.equal(suenoDe('47').nombre, 'El muerto');
  assert.equal(suenoDe(6).nombre, 'El perro');
  assert.equal(suenoDe('9179').nombre, 'El ladrón');
});

test('Buscar un sueño por palabra, sin importar acentos ni mayúsculas', () => {
  assert.deepEqual(buscarSueno('PLATA').map((s) => s.n), ['32']);
  assert.deepEqual(buscarSueno('perro').map((s) => s.n), ['06']);
  assert.ok(buscarSueno('musica').some((s) => s.n === '55'));
  assert.deepEqual(buscarSueno('7').map((s) => s.n), ['07']);
  assert.equal(buscarSueno('').length, 100);
  assert.deepEqual(buscarSueno('xyzw'), []);
});

const NUMEROS = [
  { n: '00', cabeza: 0, aLos20: 3, atrasoCabeza: null, atraso20: 2 },
  { n: '01', cabeza: 2, aLos20: 5, atrasoCabeza: 4, atraso20: 0 },
  { n: '02', cabeza: 2, aLos20: 1, atrasoCabeza: 1, atraso20: 9 },
  { n: '03', cabeza: 1, aLos20: 0, atrasoCabeza: 30, atraso20: null },
];

test('Salidores: más veces primero; a igual cantidad, el que salió más reciente', () => {
  assert.deepEqual(salidores(NUMEROS, 'cabeza').map((x) => x.n), ['02', '01', '03']);
  assert.deepEqual(salidores(NUMEROS, 'a_los_20').map((x) => x.n), ['01', '00', '02']);
});

test('Atrasados: los que nunca salieron primero, después los de más sorteos sin salir', () => {
  assert.deepEqual(atrasados(NUMEROS, 'cabeza').map((x) => x.n), ['00', '03', '01', '02']);
  assert.deepEqual(atrasados(NUMEROS, 'a_los_20', 2).map((x) => x.n), ['03', '02']);
});

test('Intensidad para la grilla', () => {
  assert.equal(intensidad(0, 10), 0);
  assert.equal(intensidad(1, 10), 1);
  assert.equal(intensidad(10, 10), 4);
  assert.equal(intensidad(6, 10), 3);
});
