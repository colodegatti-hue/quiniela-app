import { test } from 'node:test';
import assert from 'node:assert/strict';
import { faltantes, textoAlerta, crearVigilancia } from '../src/vigilancia.js';

const a = (hhmm) => new Date(`2026-10-30T${hhmm}:00-03:00`); // viernes

test('Faltantes: avisa a los 40 min, Montevideo a los 70, y no después de 4 horas', () => {
  const vistas = { primera: ['ciudad', 'provincia', 'santafe', 'cordoba', 'entrerios'] };
  assert.deepEqual(faltantes({ vistas, ahora: a('12:30') }), [{ fecha: '2026-10-30', turno: 'previa', quinielas: ['ciudad', 'provincia', 'santafe', 'cordoba', 'entrerios', 'mendoza'], minutos: 135, nada: true }]);
  const r = faltantes({ vistas, ahora: a('12:41') });
  assert.deepEqual(r.find((x) => x.turno === 'primera').quinielas, ['mendoza']);
  assert.equal(faltantes({ vistas: {}, ahora: a('15:39') }).some((x) => x.turno === 'matutina'), false);
  const mat = faltantes({ vistas: { matutina: ['ciudad', 'provincia', 'santafe', 'cordoba', 'entrerios', 'mendoza'] }, ahora: a('16:05') }).find((x) => x.turno === 'matutina');
  assert.equal(mat, undefined); // Montevideo todavía no (70 min)
  const mat2 = faltantes({ vistas: { matutina: ['ciudad', 'provincia', 'santafe', 'cordoba', 'entrerios', 'mendoza'] }, ahora: a('16:11') }).find((x) => x.turno === 'matutina');
  assert.deepEqual(mat2.quinielas, ['montevideo']);
  assert.equal(faltantes({ vistas: {}, ahora: new Date('2026-11-01T15:00:00-03:00') }).length, 0); // domingo
});

test('Texto de la alerta', () => {
  assert.equal(textoAlerta({ turno: 'matutina', quinielas: ['santafe', 'mendoza'], minutos: 45 }).titulo, '⚠️ Falta Santa Fe, Mendoza de la Matutina');
  assert.match(textoAlerta({ turno: 'nocturna', quinielas: [], minutos: 50, nada: true }).titulo, /No llegó nada de la Nocturna/);
});

test('Cada falta se avisa una sola vez', async () => {
  const avisadas = new Set();
  const enviados = [];
  const v = crearVigilancia({ base: { alertaNueva: async (k) => !avisadas.has(k) && avisadas.add(k) }, enviar: async (d) => enviados.push(d.titulo) });
  const estado = { vistas: { primera: ['ciudad', 'provincia', 'santafe', 'cordoba', 'entrerios'], previa: ['ciudad', 'provincia', 'santafe', 'cordoba', 'entrerios', 'mendoza'] } };
  await v.revisar(estado, a('12:45'));
  await v.revisar(estado, a('12:50'));
  assert.deepEqual(enviados, ['⚠️ Falta Mendoza de la Primera']);
});
