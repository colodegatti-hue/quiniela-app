import { test } from 'node:test';
import assert from 'node:assert/strict';
import { direccionNueva, recibirMudanza } from '../src/util/mudanza.js';

function almacen(inicial = {}) {
  const m = new Map(Object.entries(inicial));
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
}

test('Desde la dirección vieja va al dominio nuevo llevando los datos del teléfono', () => {
  const viejo = almacen({ 'quiniela.pro.v1': '{"codigo":"938572"}', 'quiniela.jugadas.v1': '[{"numero":"25","n":"ñ"}]', otra: 'x' });
  const url = direccionNueva({ hostname: 'quiniela-app-i0j2.onrender.com', pathname: '/', search: '', hash: '#/jugadas' }, viejo);
  assert.match(url, /^https:\/\/quinielaaltoque\.app\/#mudanza=/);
  const nuevo = almacen({ 'quiniela.jugadas.v1': '[]' }); // ya tenía jugadas: no se pisan
  const cambios = [];
  const hash = url.slice(url.indexOf('#'));
  const n = recibirMudanza({ pathname: '/', search: '', hash }, nuevo, { replaceState: (a, b, u) => cambios.push(u) });
  assert.equal(n, 1);
  assert.equal(nuevo.getItem('quiniela.pro.v1'), '{"codigo":"938572"}');
  assert.equal(nuevo.getItem('quiniela.jugadas.v1'), '[]');
  assert.equal(nuevo.getItem('otra'), null);
  assert.deepEqual(cambios, ['/']);
});

test('En el dominio nuevo no redirige; sin datos conserva la ruta', () => {
  assert.equal(direccionNueva({ hostname: 'quinielaaltoque.app', pathname: '/', search: '', hash: '' }, almacen()), null);
  assert.equal(direccionNueva({ hostname: 'quiniela-app-i0j2.onrender.com', pathname: '/', search: '?pro=r1', hash: '#/pro' }, almacen()), 'https://quinielaaltoque.app/?pro=r1#/pro');
  assert.equal(recibirMudanza({ pathname: '/', search: '', hash: '#/resultados' }, almacen(), { replaceState: () => {} }), 0);
});
