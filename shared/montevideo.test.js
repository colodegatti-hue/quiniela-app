import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pascua, feriadoUruguay, sorteaMontevideo } from './montevideo.js';

test('Pascua', () => {
  assert.equal(pascua(2026), '2026-04-05');
  assert.equal(pascua(2027), '2027-03-28');
});

test('Montevideo: días reales de 2026', () => {
  // Sin sorteo (feriados de Uruguay vistos en la base)
  for (const f of ['2026-01-06', '2026-02-16', '2026-02-17', '2026-05-18', '2026-06-19', '2026-08-25', '2026-11-02']) {
    assert.equal(sorteaMontevideo(f, 'matutina'), false, f);
    assert.equal(sorteaMontevideo(f, 'nocturna'), false, f);
  }
  assert.equal(sorteaMontevideo('2026-04-04', 'nocturna'), false); // sábado de Turismo
  assert.equal(sorteaMontevideo('2026-07-18', 'nocturna'), false); // sábado 18 de julio
  // Sábado: solo nocturna
  assert.equal(sorteaMontevideo('2026-10-31', 'matutina'), false);
  assert.equal(sorteaMontevideo('2026-10-31', 'nocturna'), true);
  // Días con sorteo
  for (const f of ['2026-03-30', '2026-04-01', '2026-10-12', '2026-10-30', '2026-11-03']) {
    assert.equal(sorteaMontevideo(f, 'matutina'), true, f);
  }
  assert.equal(sorteaMontevideo('2026-11-03', 'vespertina'), false);
  assert.equal(feriadoUruguay('2027-02-08'), true); // Carnaval 2027
});
