// Pruebas de la versión Pro con una base y un Mercado Pago de mentira
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearPro, planes, codigoValido } from '../src/pro.js';

function baseFalsa() {
  const compras = new Map();
  const licencias = new Map();
  return {
    compras, licencias,
    async crearCompra(c) { compras.set(c.referencia, { ...c, estado: 'pendiente', pago_id: null }); },
    async buscarCompra(ref) { return compras.get(ref) ?? null; },
    async codigoUsado(c) { return licencias.has(c) || [...compras.values()].some((x) => x.codigo === c); },
    async aprobarCompra(ref, pagoId, dias) {
      const c = compras.get(ref);
      if (c.estado === 'pendiente') {
        c.estado = 'aprobada'; c.pago_id = String(pagoId);
        const previa = licencias.get(c.codigo);
        const desde = previa && previa.vence > new Date() ? previa.vence : new Date();
        licencias.set(c.codigo, { codigo: c.codigo, plan: c.plan, vence: new Date(desde.getTime() + dias * 864e5), dispositivos: previa?.dispositivos ?? [] });
      }
      return licencias.get(c.codigo);
    },
    async buscarLicencia(c) { return licencias.get(c) ?? null; },
    async marcarRecuperacion(c, ahora) {
      const l = licencias.get(c);
      if (l.recuperada && ahora - l.recuperada < 2 * 864e5) return false;
      l.recuperada = ahora;
      return true;
    },
    async liberarLicencia(c) { licencias.get(c).dispositivos = []; return true; },
    async vincularDispositivo(c, d, max) {
      const l = licencias.get(c);
      if (l.dispositivos.includes(d)) return true;
      if (l.dispositivos.length >= max) return false;
      l.dispositivos.push(d);
      return true;
    },
  };
}

function mpFalso() {
  const pagos = []; // { id, external_reference, status, transaction_amount, currency_id }
  const preferencias = [];
  return {
    pagos, preferencias,
    async crearPreferencia(p) { preferencias.push(p); return { id: `pref-${preferencias.length}`, url: `https://mp/pagar/${p.referencia}` }; },
    async buscarPagos(ref) { return pagos.filter((x) => x.external_reference === ref); },
    async obtenerPago(id) { return pagos.find((x) => String(x.id) === String(id)) ?? null; },
  };
}

function armar(codigos = ['123456', '654321', '111111']) {
  const base = baseFalsa();
  const mp = mpFalso();
  let r = 0;
  const pro = crearPro({ base, mp, nuevoCodigo: () => codigos.shift(), nuevaReferencia: () => `ref-${++r}` });
  return { base, mp, pro };
}

test('Precios por defecto y validación del código', () => {
  assert.equal(planes().mensual.precio, 1990);
  assert.equal(planes().anual.precio, 14990);
  assert.ok(codigoValido('012345'));
  assert.ok(!codigoValido('12345'));
  assert.ok(!codigoValido('12a456'));
});

test('Comprar: crea la compra y el link de Mercado Pago con la referencia y la vuelta a la app', async () => {
  const { pro, base, mp } = armar();
  const r = await pro.comprar({ plan: 'mensual' });
  assert.deepEqual(r, { url: 'https://mp/pagar/ref-1', referencia: 'ref-1' });
  assert.equal(base.compras.get('ref-1').codigo, '123456');
  assert.equal(mp.preferencias[0].precio, 1990);
  assert.equal(mp.preferencias[0].urlVuelta, 'https://quinielaaltoque.app/?pro=ref-1');
  assert.equal(mp.preferencias[0].urlAvisos, 'https://api.quinielaaltoque.app/api/pro/aviso-pago');
  assert.deepEqual(await pro.comprar({ plan: 'semanal' }), { error: 'Plan inválido' });
});

test('Confirmar: pendiente hasta que el pago se aprueba; después da el código', async () => {
  const { pro, mp } = armar();
  await pro.comprar({ plan: 'anual' });
  assert.deepEqual(await pro.confirmar('ref-1'), { estado: 'pendiente' });
  mp.pagos.push({ id: 900, external_reference: 'ref-1', status: 'approved', transaction_amount: 14990, currency_id: 'ARS' });
  const r = await pro.confirmar('ref-1');
  assert.equal(r.estado, 'aprobada');
  assert.equal(r.licencia.codigo, '123456');
  assert.equal(r.licencia.plan, 'anual');
  assert.equal(r.licencia.activo, true);
  const dias = (new Date(r.licencia.vence) - Date.now()) / 864e5;
  assert.ok(dias > 365 && dias < 367);
  assert.deepEqual(await pro.confirmar('no-existe'), { estado: 'desconocida' });
});

test('No aprueba si el pago fue por menos plata, rechazado o de otra compra', async () => {
  const { pro, mp } = armar();
  await pro.comprar({ plan: 'mensual' });
  mp.pagos.push({ id: 1, external_reference: 'ref-1', status: 'approved', transaction_amount: 10, currency_id: 'ARS' });
  assert.equal((await pro.confirmar('ref-1')).estado, 'pendiente');
  mp.pagos.length = 0;
  mp.pagos.push({ id: 2, external_reference: 'ref-1', status: 'rejected', transaction_amount: 1990, currency_id: 'ARS' });
  assert.equal((await pro.confirmar('ref-1')).estado, 'rechazada');
});

test('El aviso de Mercado Pago aprueba una sola vez (aunque llegue repetido)', async () => {
  const { pro, mp, base } = armar();
  await pro.comprar({ plan: 'mensual' });
  mp.pagos.push({ id: 77, external_reference: 'ref-1', status: 'approved', transaction_amount: 1990, currency_id: 'ARS' });
  assert.deepEqual(await pro.procesarAviso('77'), { ok: true });
  const vence = base.licencias.get('123456').vence;
  assert.deepEqual(await pro.procesarAviso('77'), { ok: true, ya: true });
  assert.equal((await pro.confirmar('ref-1')).estado, 'aprobada');
  assert.equal(base.licencias.get('123456').vence, vence); // no sumó días dos veces
  assert.deepEqual(await pro.procesarAviso('abc'), { ok: false });
  assert.deepEqual(await pro.procesarAviso('999'), { ok: false });
});

test('Renovar: el mismo código suma los días a lo que le quedaba', async () => {
  const { pro, mp, base } = armar();
  await pro.comprar({ plan: 'mensual' });
  mp.pagos.push({ id: 1, external_reference: 'ref-1', status: 'approved', transaction_amount: 1990, currency_id: 'ARS' });
  await pro.confirmar('ref-1');
  const r = await pro.comprar({ plan: 'mensual', codigo: '123456' });
  assert.equal(base.compras.get(r.referencia).codigo, '123456');
  mp.pagos.push({ id: 2, external_reference: r.referencia, status: 'approved', transaction_amount: 1990, currency_id: 'ARS' });
  const c = await pro.confirmar(r.referencia);
  const dias = (new Date(c.licencia.vence) - Date.now()) / 864e5;
  assert.ok(dias > 61 && dias < 63);
  assert.deepEqual(await pro.comprar({ plan: 'mensual', codigo: '999999' }), { error: 'Ese código no existe' });
});

test('Verificar: código válido en un solo teléfono', async () => {
  const { pro, mp } = armar();
  await pro.comprar({ plan: 'mensual' });
  mp.pagos.push({ id: 1, external_reference: 'ref-1', status: 'approved', transaction_amount: 1990, currency_id: 'ARS' });
  await pro.confirmar('ref-1');
  for (const tel of ['a', 'a']) assert.equal((await pro.verificar('123456', tel)).activo, true);
  const otro = await pro.verificar('123456', 'b');
  assert.equal(otro.activo, false);
  assert.match(otro.error, /ya está activo en otro teléfono/);
  assert.deepEqual(await pro.verificar('000000', 'a'), { activo: false, error: 'Ese código no existe' });
  assert.deepEqual(await pro.verificar('12', 'a'), { activo: false, error: 'El código tiene 6 números' });
  const vencido = await pro.verificar('123456', 'a', new Date(Date.now() + 40 * 864e5));
  assert.equal(vencido.activo, false);
});

test('No repite códigos ya usados', async () => {
  const { pro, base } = armar(['123456', '123456', '222222']);
  await pro.comprar({ plan: 'mensual' });
  await pro.comprar({ plan: 'mensual' });
  assert.equal(base.compras.get('ref-2').codigo, '222222');
});

test('Recuperar el Pro en otro celular con el número de operación', async () => {
  const { pro, mp } = armar();
  await pro.comprar({ plan: 'mensual' });
  mp.pagos.push({ id: 98765432, external_reference: 'ref-1', status: 'approved', transaction_amount: 1990, currency_id: 'ARS' });
  const viejo = '11111111-1111-4111-8111-111111111111';
  const nuevo = '22222222-2222-4222-8222-222222222222';
  await pro.confirmar('ref-1');
  assert.equal((await pro.verificar('123456', viejo)).activo, true);
  assert.equal((await pro.verificar('123456', nuevo)).activo, false); // ocupado en el viejo
  const r = await pro.recuperar('98765432', nuevo);
  assert.equal(r.activo, true);
  assert.equal(r.codigo, '123456');
  assert.equal((await pro.verificar('123456', nuevo)).activo, true);
  assert.equal((await pro.verificar('123456', viejo)).activo, false); // el viejo quedó afuera
  assert.match((await pro.recuperar('98765432', viejo)).error, /hace poco/); // límite de 2 días
  const tarde = await pro.recuperar('98765432', viejo, new Date(Date.now() + 3 * 864e5));
  assert.equal(tarde.codigo, '123456');
  assert.match((await pro.recuperar('11223344', nuevo)).error, /No encontramos/);
  assert.match((await pro.recuperar('12', nuevo)).error, /solo números/);
});
