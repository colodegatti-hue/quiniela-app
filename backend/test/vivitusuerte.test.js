import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretarVivi } from '../src/fuentes/vivitusuerte.js';

const fila = (nums) => Object.fromEntries(nums.map((n, i) => [`momento_dato_${i + 1}`, n]));
const PREVIA = ['3520', '9879', '4101', '7641', '6412', '5284', '4406', '4956', '5738', '4190', '3407', '4655', '7512', '7282', '5946', '5509', '7265', '8902', '2621', '4581'];

test('Lee los turnos completos de vivitusuerte (formato del 24/10/2026)', () => {
  const json = { error: 0, datos: { 5: fila(PREVIA), 1: fila(PREVIA.map((n) => n.split('').reverse().join(''))), 4: fila(Array(20).fill('----')) } };
  const r = interpretarVivi(json);
  assert.deepEqual(r.map((x) => x.turno), ['primera', 'previa']);
  assert.deepEqual(r.find((x) => x.turno === 'previa').numeros, PREVIA);
});

test('Turnos incompletos o respuestas raras no se toman', () => {
  assert.deepEqual(interpretarVivi({ datos: { 2: fila([...PREVIA.slice(0, 19), '----']) } }), []);
  assert.deepEqual(interpretarVivi({ error: 1 }), []);
  assert.deepEqual(interpretarVivi(null), []);
});

test('Lee las cabezas sueltas de vivitusuerte (solo las de 4 cifras)', async () => {
  const { interpretarCabezasVivi } = await import('../src/fuentes/vivitusuerte.js');
  const json = { datos: { 1: { momento_5: '3520', momento_1: '----' }, 5: { momento_4: '0712' }, 4: { momento_2: '439' }, 99: { momento_1: '1111' } } };
  assert.deepEqual(interpretarCabezasVivi(json), [
    { turno: 'previa', quiniela: 'ciudad', cabeza: '3520' },
    { turno: 'nocturna', quiniela: 'entrerios', cabeza: '0712' },
  ]);
  assert.deepEqual(interpretarCabezasVivi({ datos: [{ id: 3, momento_3: '9999' }] }), [{ turno: 'vespertina', quiniela: 'santafe', cabeza: '9999' }]);
  assert.deepEqual(interpretarCabezasVivi(null), []);
});

test('Provincias: nombres en vivitusuerte y cabezas del día', async () => {
  const { SLUGS_VIVI, interpretarCabezasVivi } = await import('../src/fuentes/vivitusuerte.js');
  assert.equal(SLUGS_VIVI.sanluis, 'san%2Bluis');
  assert.equal(SLUGS_VIVI.tucuman, 'tucuman');
  const r = interpretarCabezasVivi({ datos: { 15: { momento_2: '2169' }, 34: { momento_5: '6016' }, 12: { momento_1: '----' } } });
  assert.deepEqual(r, [{ turno: 'matutina', quiniela: 'tucuman', cabeza: '2169' }, { turno: 'previa', quiniela: 'rionegro', cabeza: '6016' }]);
});
