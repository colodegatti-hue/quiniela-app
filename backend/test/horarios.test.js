import { test } from 'node:test';
import assert from 'node:assert/strict';
import { horaArgentina, turnosYaSorteados, instanteDelSorteo, fechaCorta, fechaIso } from '../src/horarios.js';

test('Hora argentina: las 01:00 UTC todavía es el día anterior en Argentina', () => {
  const ar = horaArgentina(new Date('2026-10-09T01:00:00Z'));
  assert.equal(ar.fecha, '2026-10-08');
  assert.equal(ar.minutos, 22 * 60);
  assert.equal(ar.diaSemana, 4); // jueves
});

test('Turnos ya sorteados según la hora', () => {
  assert.deepEqual(turnosYaSorteados(new Date('2026-10-08T13:14:00Z')), []); // 10:14
  assert.deepEqual(turnosYaSorteados(new Date('2026-10-08T13:15:00Z')), ['previa']); // 10:15
  assert.deepEqual(turnosYaSorteados(new Date('2026-10-08T21:05:00Z')), ['previa', 'primera', 'matutina', 'vespertina']); // 18:05
  assert.equal(turnosYaSorteados(new Date('2026-10-09T00:30:00Z')).length, 5); // 21:30
});

test('Domingo no hay sorteos', () => {
  assert.deepEqual(turnosYaSorteados(new Date('2026-10-18T23:00:00Z')), []);
});

test('Instante de un sorteo', () => {
  assert.equal(instanteDelSorteo('2026-10-08', 'vespertina').toISOString(), '2026-10-08T21:00:00.000Z');
});

test('Conversión de fechas', () => {
  assert.equal(fechaCorta('2026-10-08'), '8/10/2026');
  assert.equal(fechaIso('08/10/2026'), '2026-10-08');
  assert.equal(fechaIso('8/1/2026'), '2026-01-08');
});
