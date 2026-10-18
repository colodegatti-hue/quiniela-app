import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretarLotba } from '../src/fuentes/lotba.js';
import { interpretarQuinieleando } from '../src/fuentes/quinieleando.js';
import { MATUTINA_53009, respuestaLotba, LOTBA_VACIO, NACIONAL_08_10, paginaQuinieleando } from './datos-reales.js';

// ----------------------------- LOTERÍA ------------------------------

test('Lotería: interpreta la Matutina real del 08/10/2026 (sorteo 53009)', () => {
  const s = interpretarLotba(respuestaLotba(53009, '08/10/2026', 'MATU', MATUTINA_53009));
  assert.equal(s.numero, 53009);
  assert.equal(s.fecha, '2026-10-08');
  assert.equal(s.turno, 'matutina');
  assert.equal(s.fuente, 'lotba');
  const porId = Object.fromEntries(s.extractos.map((e) => [e.quiniela, e.numeros]));
  assert.deepEqual(Object.keys(porId).sort(), ['ciudad', 'cordoba', 'entrerios', 'mendoza', 'montevideo', 'provincia', 'santafe']);
  assert.deepEqual(porId.ciudad, MATUTINA_53009.ciudad);
  assert.deepEqual(porId.provincia, MATUTINA_53009.provincia);
  assert.deepEqual(porId.cordoba, MATUTINA_53009.cordoba);
  assert.equal(porId.ciudad[0], '9179');
  assert.equal(porId.santafe[0], '6316');
  assert.equal(porId.entrerios[19], '8542');
});

test('Lotería: "Provincia de Bs As" no se confunde con "Ciudad de Bs As"', () => {
  const s = interpretarLotba(respuestaLotba(53009, '08/10/2026', 'MATU', { provincia: MATUTINA_53009.provincia }));
  assert.equal(s.extractos[0].quiniela, 'provincia');
});

test('Lotería: reconoce los 5 turnos', () => {
  const casos = { PREV: 'previa', PRIM: 'primera', MATU: 'matutina', VESP: 'vespertina', NOCT: 'nocturna' };
  for (const [codigo, turno] of Object.entries(casos)) {
    const s = interpretarLotba(respuestaLotba(1, '09/06/2026', codigo, { ciudad: MATUTINA_53009.ciudad }));
    assert.equal(s.turno, turno);
    assert.equal(s.fecha, '2026-06-09');
  }
});

test('Lotería: sorteo sin publicar devuelve null', () => {
  assert.equal(interpretarLotba(LOTBA_VACIO), null);
});

test('Lotería: descarta extractos incompletos', () => {
  const incompleto = { ciudad: MATUTINA_53009.ciudad.slice(0, 19), cordoba: MATUTINA_53009.cordoba };
  const s = interpretarLotba(respuestaLotba(53009, '08/10/2026', 'MATU', incompleto));
  assert.deepEqual(s.extractos.map((e) => e.quiniela), ['cordoba']);
});

test('Lotería: avisa si cambia el formato', () => {
  assert.throws(() => interpretarLotba('<html>Mantenimiento</html>'), /Formato inesperado/);
});

// --------------------------- QUINIELEANDO ---------------------------

test('quinieleando: lee los 3 turnos reales de Nacional del 08/10/2026', () => {
  const turnos = interpretarQuinieleando(paginaQuinieleando('Nacional', '8/10/2026', NACIONAL_08_10));
  assert.equal(turnos.length, 3);
  assert.deepEqual(turnos.map((t) => t.turno), ['previa', 'primera', 'matutina']);
  assert.ok(turnos.every((t) => t.fecha === '2026-10-08'));
  assert.deepEqual(turnos[0].numeros, NACIONAL_08_10.previa);
  assert.deepEqual(turnos[1].numeros, NACIONAL_08_10.primera);
  assert.deepEqual(turnos[2].numeros, NACIONAL_08_10.matutina);
});

test('quinieleando: la Matutina coincide con la Lotería oficial', () => {
  const turnos = interpretarQuinieleando(paginaQuinieleando('Nacional', '8/10/2026', NACIONAL_08_10));
  assert.deepEqual(turnos.find((t) => t.turno === 'matutina').numeros, MATUTINA_53009.ciudad);
});

test('quinieleando: funciona con nombres con espacios ("Buenos Aires", "Entre Ríos")', () => {
  const t1 = interpretarQuinieleando(paginaQuinieleando('Buenos Aires', '8/10/2026', { matutina: MATUTINA_53009.provincia }));
  const t2 = interpretarQuinieleando(paginaQuinieleando('de Entre Ríos', '8/10/2026', { matutina: MATUTINA_53009.entrerios }));
  assert.deepEqual(t1[0].numeros, MATUTINA_53009.provincia);
  assert.deepEqual(t2[0].numeros, MATUTINA_53009.entrerios);
});

test('quinieleando: descarta un turno incompleto', () => {
  const html = paginaQuinieleando('Nacional', '8/10/2026', NACIONAL_08_10)
    .replace('<td>20</td><td>1721</td>', '<td>20</td><td>----</td>');
  const turnos = interpretarQuinieleando(html);
  assert.deepEqual(turnos.map((t) => t.turno), ['primera', 'matutina']);
});

test('quinieleando: página sin sorteos devuelve lista vacía', () => {
  assert.deepEqual(interpretarQuinieleando('<html><body>Cabezas del día</body></html>'), []);
});
