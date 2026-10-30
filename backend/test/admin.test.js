import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { crearToken, tokenValido, codigoDesdeNombre, montarAdmin } from '../src/admin.js';

test('Sesión del panel: token firmado, vence y depende de la clave', () => {
  const t = crearToken('secreta', 1000);
  assert.equal(tokenValido(t, 'secreta', 2000), true);
  assert.equal(tokenValido(t, 'otra', 2000), false);
  assert.equal(tokenValido(t, 'secreta', 1000 + 31 * 864e5), false);
  assert.equal(tokenValido('9999999999999.falsa', 'secreta', 2000), false);
  assert.equal(tokenValido(null, 'secreta'), false);
});

test('Código de agencia desde el nombre', () => {
  assert.equal(codigoDesdeNombre('Agencia La Suerte'), 'la-suerte');
  assert.equal(codigoDesdeNombre('El Trébol Nº 5'), 'el-trebol-n-5');
});

test('Panel: pide clave, bloquea sin sesión y entra con la clave correcta', async () => {
  const base = {
    anotarAdmin: async () => {}, registroAdmin: async () => [],
    resumenAdmin: async () => ({ activos: { hoy: 3 } }), agenciasConDatos: async () => [],
  };
  const app = express();
  app.use(express.json());
  montarAdmin(app, { base, clave: () => 'clave-de-prueba' });
  const srv = app.listen(0);
  const url = `http://127.0.0.1:${srv.address().port}`;
  try {
    assert.match(await (await fetch(`${url}/admin`)).text(), /Panel privado/);
    assert.equal((await fetch(`${url}/admin/api/resumen`)).status, 401);
    const mal = await fetch(`${url}/admin/entrar`, { method: 'POST', body: new URLSearchParams({ clave: 'no' }), redirect: 'manual' });
    assert.equal(mal.status, 401);
    const bien = await fetch(`${url}/admin/entrar`, { method: 'POST', body: new URLSearchParams({ clave: 'clave-de-prueba' }), redirect: 'manual' });
    assert.equal(bien.status, 303);
    const cookie = bien.headers.get('set-cookie').split(';')[0];
    assert.match(bien.headers.get('set-cookie'), /HttpOnly/);
    const r = await fetch(`${url}/admin/api/resumen`, { headers: { cookie } });
    assert.equal((await r.json()).activos.hoy, 3);
    assert.match(await (await fetch(`${url}/admin`, { headers: { cookie } })).text(), /Agencias amigas/);
  } finally {
    srv.close();
  }
});

test('Panel apagado si no hay clave', async () => {
  const app = express();
  montarAdmin(app, { base: {}, clave: () => '' });
  const srv = app.listen(0);
  try {
    assert.equal((await fetch(`http://127.0.0.1:${srv.address().port}/admin`)).status, 503);
  } finally {
    srv.close();
  }
});
