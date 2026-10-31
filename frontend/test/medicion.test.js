import { test } from 'node:test';
import assert from 'node:assert/strict';

// localStorage de mentira
const almacen = new Map();
globalThis.localStorage = { getItem: (k) => (almacen.has(k) ? almacen.get(k) : null), setItem: (k, v) => almacen.set(k, String(v)), removeItem: (k) => almacen.delete(k) };
const { capturarOrigen, origenGuardado } = await import('../src/util/medicion.js');

function lugar(search, hash = '#/resultados') {
  const cambios = [];
  return { loc: { search, pathname: '/', hash }, historial: { replaceState: (a, b, url) => cambios.push(url) }, cambios };
}

test('Enlace de agencia: guarda el origen la primera vez y limpia la dirección', () => {
  almacen.clear();
  const l = lugar('?ag=La-Suerte&pro=abc');
  assert.equal(capturarOrigen(l.loc, l.historial), 'ag:la-suerte');
  assert.equal(origenGuardado(), 'ag:la-suerte');
  assert.deepEqual(l.cambios, ['/?pro=abc#/resultados']);
  const otra = lugar('?ag=otra');
  capturarOrigen(otra.loc, otra.historial); // no pisa el primer origen
  assert.equal(origenGuardado(), 'ag:la-suerte');
});

test('Sin enlace: origen directo y no toca la dirección', () => {
  almacen.clear();
  const l = lugar('');
  assert.equal(capturarOrigen(l.loc, l.historial), null);
  assert.equal(origenGuardado(), 'directo');
  assert.deepEqual(l.cambios, []);
  const mal = lugar('?ag=<script>');
  assert.equal(capturarOrigen(mal.loc, mal.historial), null);
});

test('Robots no cuentan como personas', async () => {
  const { esRobot } = await import('../src/util/medicion.js');
  assert.equal(esRobot({ userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/129 Mobile Safari/537.36' }), false);
  assert.equal(esRobot({ userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1)' }), true);
  assert.equal(esRobot({ userAgent: 'Mediapartners-Google' }), true);
  assert.equal(esRobot({ userAgent: 'Mozilla/5.0 HeadlessChrome/129' }), true);
  assert.equal(esRobot({ userAgent: 'Chrome', webdriver: true }), true);
});
