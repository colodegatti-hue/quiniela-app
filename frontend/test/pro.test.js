import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esPro, fechaVence, GRATIS } from '../src/util/pro.js';

test('Pro vigente solo hasta la fecha de vencimiento', () => {
  const p = { codigo: '123456', vence: '2026-11-20T12:00:00Z' };
  assert.equal(esPro(p, new Date('2026-11-20T11:59:00Z')), true);
  assert.equal(esPro(p, new Date('2026-11-20T12:01:00Z')), false);
  assert.equal(esPro(null), false);
});

test('Fecha de vencimiento corta y lo que es gratis', () => {
  assert.equal(fechaVence('2026-11-20T15:00:00Z'), '20/11/2026');
  assert.deepEqual(GRATIS, { quinielas: ['ciudad', 'provincia'], dias: [30] });
});
