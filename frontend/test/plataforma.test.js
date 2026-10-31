import { test } from 'node:test';
import assert from 'node:assert/strict';

const almacen = new Map();
globalThis.localStorage = { getItem: (k) => (almacen.has(k) ? almacen.get(k) : null), setItem: (k, v) => almacen.set(k, String(v)) };
const { detectarPlay, esPlay, esAndroid, contarApertura } = await import('../src/util/plataforma.js');

test('Detecta la app de Google Play por ?src=play o por el referrer, y limpia la dirección', () => {
  almacen.clear();
  const cambios = [];
  const h = { replaceState: (a, b, u) => cambios.push(u) };
  assert.equal(detectarPlay({ search: '', pathname: '/', hash: '' }, 'https://google.com', h), false);
  assert.equal(detectarPlay({ search: '?src=play&ag=x', pathname: '/', hash: '#/pro' }, '', h), true);
  assert.deepEqual(cambios, ['/?ag=x#/pro']);
  assert.equal(esPlay(), true);
  almacen.clear();
  assert.equal(detectarPlay({ search: '', pathname: '/', hash: '' }, 'android-app://com.coloapps.quinielaaltoque/', h), true);
});

test('Android sí, iPhone no', () => {
  assert.equal(esAndroid('Mozilla/5.0 (Linux; Android 14; SM-A546E) Chrome/129'), true);
  assert.equal(esAndroid('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), false);
  assert.equal(esAndroid('Mozilla/5.0 (Windows NT 10.0)'), false);
});

test('Cuenta una apertura por sesión', () => {
  almacen.clear();
  const sesion = (() => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; })();
  assert.equal(contarApertura(sesion), 1);
  assert.equal(contarApertura(sesion), 1); // misma sesión
  const otra = (() => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; })();
  assert.equal(contarApertura(otra), 2);
});
