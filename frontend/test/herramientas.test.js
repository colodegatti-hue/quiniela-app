import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textoExtracto, textoCabezas, calcularPremio, describirAcierto } from '../src/util/herramientas.js';
import { controlarJugada, nuevaJugada } from '../src/util/jugadas.js';
import { sortea } from '../src/util/datos.js';

const CIUDAD = ['9179', '4492', '3389', '6210', '5508', '6232', '1042', '3281', '0419', '9120', '9625', '4597', '0283', '4938', '6629', '1916', '3402', '5398', '8612', '1033'];

test('Texto para compartir un extracto', () => {
  const t = textoExtracto({ quiniela: 'ciudad', turno: 'matutina', fecha: '2026-10-08', numeros: CIUDAD });
  const lineas = t.split('\n');
  assert.equal(lineas[0], 'Quiniela Ciudad (ex Nacional), Matutina del jue 8/10');
  assert.equal(lineas[1], 'Cabeza: 9179');
  assert.equal(lineas[3], ' 1. 9179    11. 9625');
  assert.equal(lineas[12], '10. 9120    20. 1033');
  assert.match(t, /Resultados al instante: https:\/\//);
});

test('Texto para compartir las cabezas de un turno', () => {
  const resultados = { turnos: [{ turno: 'nocturna', quinielas: { ciudad: { numeros: ['5577'] }, montevideo: { numeros: ['5120'] } } }] };
  const t = textoCabezas({ turno: 'nocturna', fecha: '2026-10-17', resultados });
  assert.equal(t.split('\n').slice(0, 3).join('|'), 'Cabezas de Nocturna, sáb 17/10|Ciudad: 5577|Montevideo: 5120');
  assert.equal(textoCabezas({ turno: 'previa', fecha: '2026-10-17', resultados }), null);
});

test('Calculadora de premios', () => {
  assert.deepEqual(calcularPremio({ numero: '47', ubicacion: 'cabeza', monto: '100' }), { veces: 70, premio: 7000, ganancia: 6900 });
  assert.deepEqual(calcularPremio({ numero: '47', ubicacion: 'a_los_5', monto: '' }), { veces: 14, premio: null, ganancia: null });
  assert.equal(calcularPremio({ numero: '0419', ubicacion: 'a_los_20', monto: '20' }).premio, 3500);
  assert.equal(calcularPremio({ numero: '7', ubicacion: 'a_los_10', monto: '10' }).premio, 7);
  assert.equal(calcularPremio({ numero: '', ubicacion: 'cabeza', monto: '10' }), null);
});

test('Frase de un acierto de la búsqueda', () => {
  assert.equal(
    describirAcierto({ quiniela: 'ciudad', turno: 'nocturna', ubicaciones: [1, 7], valores: ['5577', '1277'] }),
    'Ciudad, Nocturna: a la cabeza (5577), ubicación 7 (1277)',
  );
});

test('Montevideo solo cuenta en Matutina y Nocturna', () => {
  assert.equal(sortea('montevideo', 'previa'), false);
  assert.equal(sortea('montevideo', 'nocturna'), true);
  assert.equal(sortea('mendoza', 'previa'), true);
  const j = nuevaJugada({ numero: '79', ubicacion: 'cabeza', quinielas: ['montevideo'], turnos: ['previa', 'matutina'], fecha: '2026-10-08', monto: '' });
  const filas = controlarJugada(j, { turnos: [] }, new Date('2026-10-08T20:30:00Z'));
  assert.deepEqual(filas.map((f) => f.turno), ['matutina']);
});
