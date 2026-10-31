import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretarPozo } from '../src/fuentes/pozos.js';

const bolillas = (pref, nums) => Object.fromEntries(nums.map((n, i) => [`${pref}b${i + 1}`, String(n)]));
const N = [5, 7, 8, 12, 27, 29, 30, 35, 37, 39, 54, 65, 66, 68, 70, 77, 78, 81, 85, 89];

test('Quiniela Plus y Poceada desde vivitusuerte (formato del 30/10/2026)', () => {
  const datos = { 'quinielaplus-fecha': '2026-10-30', 'quinielaplus-sorteo': '12902', ...bolillas('quinielaplus-', N), 'quinielaplus-cat1': '0', 'quinielaplus-prm1': '306.324.189,37', 'quinielaplus-cat2': '4', 'quinielaplus-prm2': '2.000.000,00', 'quinielaplus-cat5': '0', 'quinielaplus-prm5': '' };
  const r = interpretarPozo(datos, 'quinielaplus-', '2026-10-30');
  assert.equal(r.sorteo, 12902);
  assert.equal(r.numeros[0], '05');
  assert.equal(r.numeros.length, 20);
  assert.deepEqual(r.categorias.slice(0, 2), [{ cat: 1, ganadores: 0, premio: 306324189.37 }, { cat: 2, ganadores: 4, premio: 2000000 }]);
  assert.equal(interpretarPozo(datos, 'quinielaplus-', '2026-10-31'), null); // otra fecha
  const p = interpretarPozo({ fecha: '2026-10-30', sorteo: '9759', ...bolillas('', N), cat1: '0', prm1: '630.028.175' }, '', '2026-10-30');
  assert.equal(p.categorias[0].premio, 630028175);
  assert.equal(interpretarPozo({ fecha: '2026-10-30', ...bolillas('', N.slice(0, 19)) }, '', '2026-10-30'), null); // incompleto
});
