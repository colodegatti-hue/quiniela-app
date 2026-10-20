import { test } from 'node:test';
import assert from 'node:assert/strict';
import { armarAviso, turnoParaRecordar, crearAvisos } from '../src/avisos.js';
import { MATUTINA_53009 } from './datos-reales.js';

const SORTEO = {
  numero: 53009, fecha: '2026-10-08', turno: 'matutina', fuente: 'lotba',
  extractos: Object.entries(MATUTINA_53009).map(([quiniela, numeros]) => ({ quiniela, numeros, letras: null })),
};

test('Aviso de cabezas con las quinielas por defecto (las 5 principales)', () => {
  const a = armarAviso({ preferencias: {}, jugadas: [] }, SORTEO);
  assert.equal(a.titulo, 'Cabezas de la Matutina');
  assert.equal(a.cuerpo, 'Ciudad 9179 · Provincia 9643 · Santa Fe 6316 · Córdoba 9800 · Entre Ríos 7071');
  assert.equal(a.url, '/#/resultados');
  assert.equal(a.etiqueta, 'sorteo-2026-10-08-matutina');
});

test('Aviso de cabezas solo con las quinielas elegidas', () => {
  const a = armarAviso({ preferencias: { quinielas: ['montevideo', 'cordoba'] }, jugadas: [] }, SORTEO);
  assert.equal(a.cuerpo, 'Córdoba 9800 · Montevideo 9850');
});

test('Sin cabezas activadas y sin aciertos: no se avisa', () => {
  assert.equal(armarAviso({ preferencias: { cabezas: false }, jugadas: [] }, SORTEO), null);
});

test('Si sale una jugada, avisa el acierto con el premio (aunque no quiera cabezas)', () => {
  const sub = {
    preferencias: { cabezas: false },
    jugadas: [
      { numero: '79', ubicacion: 'cabeza', quinielas: ['ciudad', 'cordoba'], turnos: ['matutina'], fecha: '2026-10-08', monto: 100 },
      { numero: '00', ubicacion: 'a_los_20', quinielas: ['ciudad'], turnos: ['matutina'], fecha: '2026-10-08', monto: 100 },
    ],
  };
  const a = armarAviso(sub, SORTEO);
  assert.equal(a.titulo, '¡Salió tu 79 en la Matutina!');
  assert.equal(a.cuerpo, 'Ciudad: el 79 a la cabeza ($7.000 estimado)');
  assert.equal(a.url, '/#/jugadas');
});

test('Jugada de otra fecha u otro turno no cuenta', () => {
  const sub = { preferencias: {}, jugadas: [
    { numero: '79', ubicacion: 'cabeza', quinielas: ['ciudad'], turnos: ['nocturna'], fecha: '2026-10-08', monto: 100 },
    { numero: '79', ubicacion: 'cabeza', quinielas: ['ciudad'], turnos: ['matutina'], fecha: '2026-10-09', monto: 100 },
  ] };
  assert.equal(armarAviso(sub, SORTEO).titulo, 'Cabezas de la Matutina');
});

test('Varias jugadas ganadoras y ubicaciones a los 20', () => {
  const sub = { preferencias: {}, jugadas: [
    { numero: '79', ubicacion: 'a_los_5', quinielas: ['santafe'], turnos: ['matutina'], fecha: '2026-10-08', monto: null },
    { numero: '66', ubicacion: 'a_los_20', quinielas: ['provincia'], turnos: ['matutina'], fecha: '2026-10-08', monto: null },
  ] };
  const a = armarAviso(sub, SORTEO);
  assert.equal(a.titulo, '¡Salieron 2 de tus números en la Matutina!');
  assert.equal(a.cuerpo, 'Santa Fe: el 79 en la ubicación 5\nProvincia: el 66 en la ubicación 3');
});

test('Alerta de un número a la cabeza, en cualquier quiniela, con las cabezas abajo', () => {
  const a = armarAviso({ preferencias: { alertas: ['50'], quinielas: ['ciudad'] }, jugadas: [] }, SORTEO);
  assert.equal(a.titulo, 'Salió el 50 en la Matutina');
  assert.equal(a.cuerpo, 'Mendoza a la cabeza\nMontevideo a la cabeza\nCabezas: Ciudad 9179');
  assert.equal(a.url, '/#/resultados');
});

test('Alerta a los 20 con varios números (y sin cabezas)', () => {
  const a = armarAviso({ preferencias: { cabezas: false, alertas: ['79', '12', '45'], alertasDonde: 'a_los_20' }, jugadas: [] }, SORTEO);
  assert.equal(a.titulo, 'Salió el 79 y el 12 en la Matutina');
  assert.equal(a.cuerpo, '79: Ciudad a la cabeza\n79: Santa Fe en la ubicación 5\n12: Ciudad en la ubicación 19\n12: Córdoba en la ubicación 18');
});

test('Alerta que no salió: queda el aviso común de cabezas (o nada)', () => {
  assert.equal(armarAviso({ preferencias: { alertas: ['12'] }, jugadas: [] }, SORTEO).titulo, 'Cabezas de la Matutina'); // 12 no salió a la cabeza
  assert.equal(armarAviso({ preferencias: { alertas: ['12'], cabezas: false }, jugadas: [] }, SORTEO), null);
});

test('Si sale una jugada, gana el aviso de la jugada sobre la alerta', () => {
  const sub = { preferencias: { alertas: ['50'] }, jugadas: [{ numero: '79', ubicacion: 'cabeza', quinielas: ['ciudad'], turnos: ['matutina'], fecha: '2026-10-08', monto: 100 }] };
  assert.equal(armarAviso(sub, SORTEO).titulo, '¡Salió tu 79 en la Matutina!');
});

test('Recordatorio: avisa entre 5 y 20 minutos antes de cada turno', () => {
  assert.deepEqual(turnoParaRecordar(new Date('2026-10-19T13:00:00Z')), { fecha: '2026-10-19', turno: 'previa', faltan: 15 }); // 10:00
  assert.equal(turnoParaRecordar(new Date('2026-10-19T13:12:00Z')), null); // 10:12, faltan 3
  assert.equal(turnoParaRecordar(new Date('2026-10-19T14:00:00Z')), null); // 11:00, faltan 60
  assert.equal(turnoParaRecordar(new Date('2026-10-18T13:00:00Z')), null); // domingo
});

function baseFalsa(subs) {
  const borrados = [];
  const fallos = [];
  return {
    borrados, fallos,
    async listarSuscripciones() { return subs; },
    async buscarSuscripcion(e) { return subs.find((s) => s.endpoint === e) ?? null; },
    async borrarSuscripcion(e) { borrados.push(e); },
    async registrarFalloEnvio(e) { fallos.push(e); },
  };
}

test('Envía a cada teléfono y borra los que se dieron de baja (410)', async () => {
  const subs = [
    { endpoint: 'https://push/a', preferencias: {}, jugadas: [] },
    { endpoint: 'https://push/b', preferencias: {}, jugadas: [] },
    { endpoint: 'https://push/c', preferencias: { cabezas: false }, jugadas: [] },
    { endpoint: 'https://push/d', preferencias: {}, jugadas: [] },
  ];
  const base = baseFalsa(subs);
  const enviados = [];
  const avisos = crearAvisos({
    base,
    activo: () => true,
    enviar: async (sub, datos) => {
      if (sub.endpoint === 'https://push/b') throw Object.assign(new Error('Gone'), { statusCode: 410 });
      if (sub.endpoint === 'https://push/d') throw Object.assign(new Error('Error'), { statusCode: 500 });
      enviados.push([sub.endpoint, datos.titulo]);
    },
  });
  const r = await avisos.avisarSorteo(SORTEO);
  assert.deepEqual(r, { enviados: 1, fallidos: 2 });
  assert.deepEqual(enviados, [['https://push/a', 'Cabezas de la Matutina']]);
  assert.deepEqual(base.borrados, ['https://push/b']);
  assert.deepEqual(base.fallos, ['https://push/d']);
});

test('Recordatorio: una sola vez por turno y solo a quien lo pidió', async () => {
  const subs = [
    { endpoint: 'https://push/a', preferencias: { recordatorio: true } },
    { endpoint: 'https://push/b', preferencias: {} },
  ];
  const enviados = [];
  const avisos = crearAvisos({ base: baseFalsa(subs), activo: () => true, enviar: async (s, d) => enviados.push([s.endpoint, d.titulo]) });
  const r1 = await avisos.recordar(new Date('2026-10-19T13:00:00Z'));
  const r2 = await avisos.recordar(new Date('2026-10-19T13:05:00Z'));
  assert.equal(r1.enviados, 1);
  assert.equal(r2.enviados, 0);
  assert.deepEqual(enviados, [['https://push/a', 'La Previa sale a las 10:15']]);
});

test('Sin claves configuradas no envía nada', async () => {
  const avisos = crearAvisos({ base: baseFalsa([{ endpoint: 'x', preferencias: {} }]), activo: () => false, enviar: async () => { throw new Error('no'); } });
  assert.deepEqual(await avisos.avisarSorteo(SORTEO), { enviados: 0, fallidos: 0 });
});

test('Las alertas de número solo se mandan a teléfonos Pro', async () => {
  const subs = [
    { endpoint: 'https://push/gratis', preferencias: { alertas: ['50'] }, jugadas: [], pro: false },
    { endpoint: 'https://push/pro', preferencias: { alertas: ['50'] }, jugadas: [], pro: true },
  ];
  const enviados = [];
  const avisos = crearAvisos({ base: baseFalsa(subs), activo: () => true, enviar: async (s, d) => enviados.push([s.endpoint, d.titulo]) });
  await avisos.avisarSorteo(SORTEO);
  assert.deepEqual(enviados, [['https://push/gratis', 'Cabezas de la Matutina'], ['https://push/pro', 'Salió el 50 en la Matutina']]);
});
