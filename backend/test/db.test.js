// Pruebas contra una base PostgreSQL REAL.
// Solo corren si existe la variable TEST_DATABASE_URL (base de prueba vacía).
// NUNCA apuntarla a la base de producción: borra las tablas de prueba al final.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import * as db from '../src/db.js';
import { MATUTINA_53009 } from './datos-reales.js';

const URL_PRUEBA = process.env.TEST_DATABASE_URL;
const opciones = { skip: !URL_PRUEBA && 'sin TEST_DATABASE_URL' };

before(async () => {
  if (!URL_PRUEBA) return;
  const esquema = await readFile(new URL('../sql/esquema.sql', import.meta.url), 'utf8');
  const c = new pg.Client({ connectionString: URL_PRUEBA });
  await c.connect();
  await c.query('drop table if exists extractos, publicaciones, sorteos, suscripciones, compras, licencias, arrepentimientos, cabezas cascade');
  await c.query(esquema);
  await c.query(esquema); // se puede correr dos veces
  await c.end();
  db.conectar(URL_PRUEBA);
});

after(async () => { if (URL_PRUEBA) await db.cerrar(); });

const extractos = Object.entries(MATUTINA_53009).map(([quiniela, numeros]) => ({ quiniela, numeros, letras: 'DJQQ' }));

test('Base real: guarda la Matutina oficial y la lee igual', opciones, async () => {
  assert.equal(await db.ultimoNumeroLotba(), null);
  const r = await db.guardarSorteo({ fecha: '2026-10-08', turno: 'matutina', numero: 53009, fuente: 'lotba', extractos });
  assert.equal(r, 'nuevo');
  assert.equal(await db.ultimoNumeroLotba(), 53009);
  assert.deepEqual(await db.sorteosDeFecha('2026-10-08'), { matutina: 'lotba' });
  const res = await db.resultadosDeFecha('2026-10-08');
  assert.equal(res.turnos.length, 1);
  assert.equal(res.turnos[0].numero, 53009);
  assert.deepEqual(res.turnos[0].quinielas.ciudad.numeros, MATUTINA_53009.ciudad);
  assert.equal(res.turnos[0].quinielas.ciudad.numeros[8], '0419'); // conserva el cero adelante
});

test('Base real: el respaldo no pisa al oficial', opciones, async () => {
  const otro = [{ quiniela: 'ciudad', numeros: Array(20).fill('0000'), letras: null }];
  const r = await db.guardarSorteo({ fecha: '2026-10-08', turno: 'matutina', numero: null, fuente: 'quinieleando', extractos: otro });
  assert.equal(r, 'omitido');
  const res = await db.resultadosDeFecha('2026-10-08');
  assert.deepEqual(res.turnos[0].quinielas.ciudad.numeros, MATUTINA_53009.ciudad);
});

test('Base real: respaldo primero y después la Lotería lo reemplaza', opciones, async () => {
  const resp = [{ quiniela: 'ciudad', numeros: MATUTINA_53009.cordoba, letras: null }];
  assert.equal(await db.guardarSorteo({ fecha: '2026-10-08', turno: 'vespertina', numero: null, fuente: 'quinieleando', extractos: resp }), 'nuevo');
  assert.equal(await db.ultimoNumeroLotba(), 53009); // el respaldo no tiene número
  assert.equal(await db.guardarSorteo({ fecha: '2026-10-08', turno: 'vespertina', numero: 53010, fuente: 'lotba', extractos }), 'actualizado');
  const res = await db.resultadosDeFecha('2026-10-08');
  assert.deepEqual(res.turnos.map((t) => t.turno), ['matutina', 'vespertina']); // orden del día
  assert.equal(res.turnos[1].numero, 53010);
  assert.equal(res.turnos[1].fuente, 'lotba');
  assert.deepEqual(res.turnos[1].quinielas.ciudad.numeros, MATUTINA_53009.ciudad);
  assert.equal(res.turnos[1].quinielas.ciudad.letras, 'DJQQ');
});

test('Base real: rechaza un extracto que no tiene 20 números', opciones, async () => {
  await assert.rejects(db.guardarSorteo({
    fecha: '2026-10-08', turno: 'nocturna', numero: 53011, fuente: 'lotba',
    extractos: [{ quiniela: 'ciudad', numeros: ['1234'], letras: null }],
  }));
  assert.deepEqual(Object.keys(await db.sorteosDeFecha('2026-10-08')).sort(), ['matutina', 'vespertina']); // no quedó a medias
});

test('Base real: la publicación se anota una sola vez', opciones, async () => {
  await db.registrarPublicacion('2026-10-08', 'matutina', 'lotba', 3.5);
  await db.registrarPublicacion('2026-10-08', 'matutina', 'lotba', 9);
  const pubs = await db.publicacionesDeFecha('2026-10-08');
  assert.ok(pubs.has('matutina|lotba'));
  const c = new pg.Client({ connectionString: URL_PRUEBA });
  await c.connect();
  const r = await c.query('select minutos_demora from publicaciones');
  await c.end();
  assert.equal(r.rows.length, 1);
  assert.equal(Number(r.rows[0].minutos_demora), 3.5);
});

test('Base real: busca un número en los sorteos (últimas cifras y ubicaciones)', opciones, async () => {
  const r = await db.buscarNumero('79', '2026-10-01');
  // Lo esperado se calcula a mano sobre los datos guardados en las pruebas anteriores
  const esperados = [];
  for (const turno of ['vespertina', 'matutina']) {
    for (const [quiniela, numeros] of Object.entries(MATUTINA_53009).sort(([a], [b]) => a.localeCompare(b))) {
      const ub = numeros.map((n, i) => (n.endsWith('79') ? i + 1 : null)).filter(Boolean);
      if (ub.length) esperados.push(`${turno}|${quiniela}|${ub.join(',')}`);
    }
  }
  assert.deepEqual(r.aciertos.map((a) => `${a.turno}|${a.quiniela}|${a.ubicaciones.join(',')}`), esperados);
  assert.equal(r.aciertos[0].fecha, '2026-10-08');
  assert.equal(r.sorteos, 2);
  assert.equal(r.dias, 1);
  const cabeza = r.aciertos.find((a) => a.quiniela === 'ciudad' && a.turno === 'matutina');
  assert.deepEqual(cabeza.ubicaciones, [1]);
  assert.deepEqual(cabeza.valores, ['9179']);
});

test('Base real: búsqueda de 4 cifras con cero adelante y sin resultados', opciones, async () => {
  const r = await db.buscarNumero('0419', '2026-10-01');
  assert.ok(r.aciertos.some((a) => a.quiniela === 'ciudad' && a.ubicaciones.includes(9)));
  const nada = await db.buscarNumero('0419', '2026-11-01');
  assert.deepEqual(nada.aciertos, []);
  assert.equal(nada.sorteos, 0);
});

test('Base real: números de sorteo faltantes', opciones, async () => {
  const f = await db.numerosFaltantes(53005, 53012);
  assert.deepEqual(f, [53012, 53011, 53008, 53007, 53006, 53005]);
  assert.deepEqual(await db.numerosFaltantes(0, 53012), []);
});

test('Base real: estadísticas de salidores y atrasados', opciones, async () => {
  // Un sorteo anterior, fuera del período: cabeza 5500 y el resto 5501
  const viejo = [{ quiniela: 'ciudad', numeros: ['5500', ...Array(19).fill('5501')], letras: null }];
  await db.guardarSorteo({ fecha: '2026-10-07', turno: 'nocturna', numero: 53004, fuente: 'lotba', extractos: viejo });
  const e = await db.estadisticas('ciudad', '2026-10-08');
  assert.equal(e.numeros.length, 100);
  assert.equal(e.sorteos, 2); // matutina y vespertina del 08
  assert.deepEqual(e.historial, { sorteos: 3, desde: '2026-10-07', hasta: '2026-10-08' });
  const n79 = e.numeros.find((x) => x.n === '79');
  const veces79 = MATUTINA_53009.ciudad.filter((v) => v.endsWith('79')).length;
  assert.equal(n79.cabeza, 2); // 9179 a la cabeza en los dos
  assert.equal(n79.aLos20, veces79 * 2);
  assert.equal(n79.atrasoCabeza, 0); // salió en el último sorteo
  assert.deepEqual(n79.ultimaCabeza, { fecha: '2026-10-08', turno: 'vespertina' });
  const n00 = e.numeros.find((x) => x.n === '00');
  assert.equal(n00.cabeza, 0); // salió antes del período
  assert.equal(n00.atrasoCabeza, 2); // hace 2 sorteos
  assert.deepEqual(n00.ultimaCabeza, { fecha: '2026-10-07', turno: 'nocturna' });
  const n01 = e.numeros.find((x) => x.n === '01');
  assert.equal(n01.atrasoCabeza, null); // nunca a la cabeza
  // Los números que no salieron nunca también aparecen, con 0
  const nunca = e.numeros.filter((x) => x.atraso20 === null);
  assert.ok(nunca.every((x) => x.aLos20 === 0 && x.cabeza === 0));
  // Otra quiniela no se mezcla
  const otra = await db.estadisticas('cordoba', '2026-10-08');
  assert.equal(otra.historial.sorteos, 2);
});

test('Base real: quinielas guardadas de cada sorteo de una fecha', opciones, async () => {
  const q = await db.quinielasDeFecha('2026-10-08');
  const mat = q.find((x) => x.turno === 'matutina');
  assert.equal(mat.numero, 53009);
  assert.equal(mat.fuente, 'lotba');
  assert.deepEqual(mat.quinielas, Object.keys(MATUTINA_53009).sort());
});

test('Base real: agregar Provincia desde su lotería (antes o después de la Ciudad)', opciones, async () => {
  const prov = { quiniela: 'provincia', numeros: MATUTINA_53009.provincia, letras: null };
  assert.equal(await db.agregarExtracto('2026-10-09', 'matutina', prov), 'nuevo');
  assert.equal(await db.agregarExtracto('2026-10-09', 'matutina', prov), 'omitido');
  let r = await db.resultadosDeFecha('2026-10-09');
  assert.equal(r.turnos[0].fuente, 'provincia');
  assert.equal(r.turnos[0].numero, null);
  // Después llega la Lotería de la Ciudad con su número y sus quinielas
  const extractos = [{ quiniela: 'ciudad', numeros: MATUTINA_53009.ciudad, letras: null }];
  assert.equal(await db.guardarSorteo({ fecha: '2026-10-09', turno: 'matutina', numero: 53014, fuente: 'lotba', extractos }), 'actualizado');
  r = await db.resultadosDeFecha('2026-10-09');
  assert.equal(r.turnos[0].fuente, 'lotba');
  assert.deepEqual(Object.keys(r.turnos[0].quinielas).sort(), ['ciudad', 'provincia']);
  assert.equal(await db.agregarExtracto('2026-10-08', 'matutina', prov), 'omitido'); // ya la tenía la Ciudad
  await db.registrarPublicacion('2026-10-09', 'matutina', 'provincia', 9);
});

test('Base real: suscripciones a los avisos', opciones, async () => {
  const sus = { endpoint: 'https://push.ejemplo/abc', p256dh: 'p', auth: 'a', dispositivo: 'tel-1', preferencias: { cabezas: true }, jugadas: [{ numero: '79' }] };
  await db.guardarSuscripcion(sus);
  await db.guardarSuscripcion({ ...sus, p256dh: 'p2' }); // repetir actualiza, no duplica
  let lista = await db.listarSuscripciones();
  assert.equal(lista.length, 1);
  assert.equal(lista[0].p256dh, 'p2');
  assert.deepEqual(lista[0].jugadas, [{ numero: '79' }]);
  assert.equal(await db.actualizarSuscripcion(sus.endpoint, { preferencias: { cabezas: false, recordatorio: true } }), true);
  assert.equal(await db.actualizarSuscripcion('https://no-existe', { jugadas: [] }), false);
  const una = await db.buscarSuscripcion(sus.endpoint);
  assert.deepEqual(una.preferencias, { cabezas: false, recordatorio: true });
  assert.deepEqual(una.jugadas, [{ numero: '79' }]); // no se pisó
  for (let i = 0; i < 5; i++) await db.registrarFalloEnvio(sus.endpoint);
  lista = await db.listarSuscripciones();
  assert.equal(lista.length, 0); // a los 5 fallos se borra
});

test('Base real: compra Pro aprobada una sola vez, renovación y teléfonos', opciones, async () => {
  await db.crearCompra({ referencia: 'r1', codigo: '012345', plan: 'mensual', precio: 1990 });
  assert.equal(await db.codigoUsado('012345'), true);
  assert.equal(await db.codigoUsado('999999'), false);
  assert.equal(await db.buscarLicencia('012345'), null);
  assert.deepEqual(await db.buscarCompra('r1'), { referencia: 'r1', codigo: '012345', plan: 'mensual', precio: 1990, estado: 'pendiente', pago_id: null });
  const l = await db.aprobarCompra('r1', 555, 31);
  assert.equal(l.codigo, '012345');
  const dias = (new Date(l.vence) - Date.now()) / 864e5;
  assert.ok(dias > 30.9 && dias < 31.1);
  const otra = await db.aprobarCompra('r1', 555, 31); // repetido: no suma
  assert.equal(new Date(otra.vence).getTime(), new Date(l.vence).getTime());
  await db.crearCompra({ referencia: 'r2', codigo: '012345', plan: 'anual', precio: 14990 });
  const ren = await db.aprobarCompra('r2', 556, 366);
  const dias2 = (new Date(ren.vence) - Date.now()) / 864e5;
  assert.ok(dias2 > 396.9 && dias2 < 397.1);
  assert.equal(ren.plan, 'anual');
  for (const t of ['a', 'b', 'c', 'a']) assert.equal(await db.vincularDispositivo('012345', t, 3), true);
  assert.equal(await db.vincularDispositivo('012345', 'd', 3), false);
  assert.deepEqual((await db.buscarLicencia('012345')).dispositivos, ['a', 'b', 'c']);
  await assert.rejects(db.crearCompra({ referencia: 'r3', codigo: '1', plan: 'diario', precio: 1 }));
});

test('Base real: suscripción con código Pro vigente', opciones, async () => {
  await db.guardarSuscripcion({ endpoint: 'https://push/pro', p256dh: 'p', auth: 'a', preferencias: {}, jugadas: [], codigo: '012345' });
  await db.guardarSuscripcion({ endpoint: 'https://push/gratis', p256dh: 'p', auth: 'a', preferencias: {}, jugadas: [] });
  const lista = await db.listarSuscripciones();
  assert.equal(lista.find((x) => x.endpoint === 'https://push/pro').pro, true);
  assert.equal(lista.find((x) => x.endpoint === 'https://push/gratis').pro, false);
  await db.actualizarSuscripcion('https://push/gratis', { codigo: '012345' });
  assert.equal((await db.buscarSuscripcion('https://push/gratis')).pro, true);
});

test('Base real: pedidos de arrepentimiento', opciones, async () => {
  await db.crearArrepentimiento({ numero: 'ARR-1', codigo: '012345', contacto: 'a@b.com', detalle: 'no lo uso' });
  const l = await db.listarArrepentimientos();
  assert.equal(l[0].numero, 'ARR-1');
  assert.equal(l[0].estado, 'pendiente');
});

test('Base real: cabeza anticipada se ve como extracto parcial hasta que llegan los 20', opciones, async () => {
  assert.equal(await db.guardarCabeza('2026-10-10', 'nocturna', 'entrerios', '4321', 'vivitusuerte'), true);
  assert.equal(await db.guardarCabeza('2026-10-10', 'nocturna', 'entrerios', '4321', 'vivitusuerte'), false);
  let r = await db.resultadosDeFecha('2026-10-10');
  const q = r.turnos[0].quinielas.entrerios;
  assert.equal(q.parcial, true);
  assert.equal(q.numeros[0], '4321');
  assert.equal(q.numeros.length, 20);
  assert.equal(q.numeros[1], '');
  await db.agregarExtracto('2026-10-10', 'nocturna', { quiniela: 'entrerios', numeros: MATUTINA_53009.entrerios, letras: null }, 'quinieleando');
  r = await db.resultadosDeFecha('2026-10-10');
  assert.equal(r.turnos[0].quinielas.entrerios.parcial, undefined);
  assert.deepEqual(r.turnos[0].quinielas.entrerios.numeros, MATUTINA_53009.entrerios);
});
