import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretarProvincia } from '../src/fuentes/provincia.js';

// Misma estructura que loteria.gba.gob.ar/resultados (copiada el 20/10/2026)
function bloque(nombre, fecha, numeros) {
  const fila = (n, i) => `<div class="${i === 0 ? 'bolilla-cabecera' : ''}"> <span>${String(i + 1).padStart(2, '0')}</span> <span>${n}</span> </div>`;
  return `<div class="sorteo"> <h3>Quiniela ${nombre}<i class="fa-solid fa-angle-down"></i></h3> <div class="datosSorteo"> <p class="fechaSorteo">${fecha}</p> <p class="nSorteo">Sorteo N°1</p> <div class="bolillas"> <div> ${numeros.slice(0, 10).map(fila).join(' ')} </div> <div> ${numeros.slice(10).map((n, i) => fila(n, i + 10)).join(' ')} </div> </div> </div> </div>`;
}
const PREVIA = ['4805', '5680', '1555', '2983', '8606', '8760', '0544', '8923', '5317', '3243', '1688', '6918', '0313', '1379', '0135', '2283', '4730', '6323', '9632', '0971'];
const MATUTINA = ['3923', '7066', '9815', '7225', '9337', '3647', '5879', '3207', '0664', '9787', '9984', '1172', '2847', '0192', '6472', '9844', '6174', '3444', '7523', '7671'];
const VACIO = Array(20).fill('----');

test('Lee los turnos completos de la página de la Provincia', () => {
  const html = `<div class="loteria-wrapper"> ${bloque('La Previa', '20/10/2026', PREVIA)} ${bloque('El Primero', '20/10/2026', VACIO)} ${bloque('Matutina', '20/10/2026', MATUTINA)} ${bloque('Vespertina', '20/10/2026', VACIO)} </div> <div class="sorteo"> <h3>Sorteo extraordinario de Navidad</h3> </div>`;
  const r = interpretarProvincia(html);
  assert.deepEqual(r.map((x) => `${x.fecha} ${x.turno}`), ['2026-10-20 previa', '2026-10-20 matutina']);
  assert.deepEqual(r[0].numeros, PREVIA);
  assert.equal(r[1].numeros[0], '3923');
  assert.equal(r[1].numeros[19], '7671');
});

test('Turno a medio publicar no se toma', () => {
  const medio = [...MATUTINA.slice(0, 5), ...Array(15).fill('----')];
  assert.deepEqual(interpretarProvincia(bloque('Matutina', '20/10/2026', medio)), []);
  assert.deepEqual(interpretarProvincia('<html>otra cosa</html>'), []);
});
