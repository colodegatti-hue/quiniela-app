// Pruebas del ciclo con una base y fuentes de mentira (en memoria)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearCiclo } from '../src/ciclo.js';
import { MATUTINA_53009 } from './datos-reales.js';

const CIUDAD = MATUTINA_53009.ciudad;

function baseEnMemoria() {
  const sorteos = new Map(); // "fecha|turno" -> { numero, fuente, extractos }
  const publicaciones = new Map();
  return {
    sorteos, publicaciones,
    async ultimoNumeroLotba() {
      const ns = [...sorteos.values()].map((s) => s.numero).filter((n) => n !== null);
      return ns.length ? Math.max(...ns) : null;
    },
    async sorteosDeFecha(fecha) {
      const r = {};
      for (const [k, s] of sorteos) if (k.startsWith(fecha)) r[k.split('|')[1]] = s.fuente;
      return r;
    },
    async guardarSorteo(s) {
      const k = `${s.fecha}|${s.turno}`;
      const previo = sorteos.get(k);
      if (previo && previo.fuente === 'lotba' && s.fuente !== 'lotba') return 'omitido';
      sorteos.set(k, { numero: s.numero ?? previo?.numero ?? null, fuente: s.fuente, extractos: s.extractos });
      return previo ? 'actualizado' : 'nuevo';
    },
    async registrarPublicacion(fecha, turno, fuente, minutos) {
      const k = `${fecha}|${turno}|${fuente}`;
      if (!publicaciones.has(k)) publicaciones.set(k, minutos);
    },
    async numerosFaltantes(desde, hasta) {
      const hay = new Set([...sorteos.values()].map((s) => s.numero));
      const r = [];
      for (let n = hasta; n >= desde; n--) if (!hay.has(n)) r.push(n);
      return r;
    },
    async publicacionesDeFecha(fecha) {
      return new Set([...publicaciones.keys()].filter((k) => k.startsWith(fecha)).map((k) => k.split('|').slice(1).join('|')));
    },
  };
}

// Calendario de mentira: n.º de sorteo -> { fecha, turno }
function fuentesFalsas(calendario, { lotbaPublicados = new Set(), lotbaRoto = false, quinieleando = {} } = {}) {
  const llamadas = { lotba: [], quinieleando: [], pagina: 0 };
  return {
    llamadas,
    fuentes: {
      async buscarSorteoLotba(n) {
        llamadas.lotba.push(n);
        if (lotbaRoto) throw new Error('Lotería respondió 403');
        if (!lotbaPublicados.has(n) || !calendario[n]) return null;
        return { numero: n, ...calendario[n], fuente: 'lotba', extractos: [{ quiniela: 'ciudad', numeros: CIUDAD, letras: 'DJQQ' }] };
      },
      async buscarSorteoQuinieleando(fecha, turno) {
        llamadas.quinieleando.push(`${fecha}|${turno}`);
        if (!quinieleando[`${fecha}|${turno}`]) return null;
        return { numero: null, fecha, turno, fuente: 'quinieleando', extractos: [{ quiniela: 'ciudad', numeros: CIUDAD, letras: null }] };
      },
      async buscarPaginaQuinieleando() {
        llamadas.pagina++;
        return Object.keys(quinieleando).map((k) => ({ fecha: k.split('|')[0], turno: k.split('|')[1], numeros: CIUDAD }));
      },
    },
  };
}

const CALENDARIO = {
  53007: { fecha: '2026-10-08', turno: 'previa' },
  53008: { fecha: '2026-10-08', turno: 'primera' },
  53009: { fecha: '2026-10-08', turno: 'matutina' },
  53010: { fecha: '2026-10-08', turno: 'vespertina' },
  53011: { fecha: '2026-10-08', turno: 'nocturna' },
};

test('Base vacía: arranca desde SORTEO_INICIAL y se pone al día', async () => {
  const base = baseEnMemoria();
  const { fuentes, llamadas } = fuentesFalsas(CALENDARIO, { lotbaPublicados: new Set([53007, 53008, 53009]) });
  const ciclo = crearCiclo({ base, fuentes, sorteoInicial: 53007 });
  const r = await ciclo.tick(new Date('2026-10-08T18:10:00Z')); // 15:10
  assert.deepEqual(r.guardados.map((g) => g.numero), [53007, 53008, 53009]);
  assert.equal(r.ultimoNumero, 53009);
  assert.deepEqual(llamadas.lotba, [53007, 53008, 53009, 53010]);
  assert.equal(base.sorteos.get('2026-10-08|matutina').fuente, 'lotba');
});

test('Sin SORTEO_INICIAL y base vacía: avisa el error', async () => {
  const { fuentes } = fuentesFalsas(CALENDARIO);
  const ciclo = crearCiclo({ base: baseEnMemoria(), fuentes, sorteoInicial: 0 });
  const r = await ciclo.tick(new Date('2026-10-08T18:10:00Z'));
  assert.match(r.errores[0], /SORTEO_INICIAL/);
});

test('Mide la demora: la Lotería publica la Matutina 4 minutos después', async () => {
  const base = baseEnMemoria();
  const publicados = new Set([53007, 53008]);
  const { fuentes } = fuentesFalsas(CALENDARIO, { lotbaPublicados: publicados });
  const ciclo = crearCiclo({ base, fuentes, sorteoInicial: 53007 });
  await ciclo.tick(new Date('2026-10-08T18:02:00Z')); // 15:02, todavía no salió
  assert.equal(base.sorteos.has('2026-10-08|matutina'), false);
  publicados.add(53009);
  const r = await ciclo.tick(new Date('2026-10-08T18:04:00Z')); // 15:04
  assert.deepEqual(r.publicaciones.find((p) => p.turno === 'matutina'), { turno: 'matutina', fuente: 'lotba', minutos: 4 });
});

test('Sorteos recuperados tarde no cuentan como demora', async () => {
  const base = baseEnMemoria();
  const { fuentes } = fuentesFalsas(CALENDARIO, { lotbaPublicados: new Set([53007]) });
  const ciclo = crearCiclo({ base, fuentes, sorteoInicial: 53007 });
  const r = await ciclo.tick(new Date('2026-10-08T23:59:00Z')); // 20:59, la Previa salió hace +10 h
  assert.equal(r.guardados.length, 1);
  assert.equal(r.publicaciones.length, 0);
});

test('Respaldo: si la Lotería no publica en 15 minutos, usa quinieleando', async () => {
  const base = baseEnMemoria();
  const { fuentes, llamadas } = fuentesFalsas(CALENDARIO, {
    lotbaPublicados: new Set([53007, 53008]),
    quinieleando: { '2026-10-08|matutina': true },
  });
  const ciclo = crearCiclo({ base, fuentes, sorteoInicial: 53007 });
  let r = await ciclo.tick(new Date('2026-10-08T18:10:00Z')); // 15:10: todavía espera
  assert.equal(llamadas.quinieleando.length, 0);
  assert.equal(r.publicaciones.find((p) => p.fuente === 'quinieleando')?.minutos, 10); // pero mide
  r = await ciclo.tick(new Date('2026-10-08T18:15:00Z')); // 15:15: usa el respaldo
  assert.deepEqual(llamadas.quinieleando, ['2026-10-08|matutina']);
  assert.equal(base.sorteos.get('2026-10-08|matutina').fuente, 'quinieleando');
  assert.equal(base.sorteos.get('2026-10-08|matutina').numero, null);
});

test('Respaldo inmediato si la Lotería falla (por ejemplo, bloqueo)', async () => {
  const base = baseEnMemoria();
  base.sorteos.set('2026-10-08|primera', { numero: 53008, fuente: 'lotba', extractos: [] });
  const { fuentes } = fuentesFalsas(CALENDARIO, { lotbaRoto: true, quinieleando: { '2026-10-08|matutina': true } });
  const ciclo = crearCiclo({ base, fuentes, sorteoInicial: 53007 });
  const r = await ciclo.tick(new Date('2026-10-08T18:03:00Z')); // 15:03
  assert.match(r.errores[0], /403/);
  assert.equal(base.sorteos.get('2026-10-08|matutina').fuente, 'quinieleando');
});

test('Cuando la Lotería publica, reemplaza al respaldo y le pone el número', async () => {
  const base = baseEnMemoria();
  base.sorteos.set('2026-10-08|primera', { numero: 53008, fuente: 'lotba', extractos: [] });
  base.sorteos.set('2026-10-08|matutina', { numero: null, fuente: 'quinieleando', extractos: [] });
  const { fuentes } = fuentesFalsas(CALENDARIO, { lotbaPublicados: new Set([53009]) });
  const ciclo = crearCiclo({ base, fuentes, sorteoInicial: 53007 });
  const r = await ciclo.tick(new Date('2026-10-08T18:30:00Z'));
  assert.equal(r.guardados[0].resultado, 'actualizado');
  assert.deepEqual(base.sorteos.get('2026-10-08|matutina').numero, 53009);
  assert.equal(base.sorteos.get('2026-10-08|matutina').fuente, 'lotba');
});

test('El respaldo nunca pisa un dato oficial', async () => {
  const base = baseEnMemoria();
  await base.guardarSorteo({ fecha: '2026-10-08', turno: 'matutina', numero: 53009, fuente: 'lotba', extractos: [] });
  const r = await base.guardarSorteo({ fecha: '2026-10-08', turno: 'matutina', numero: null, fuente: 'quinieleando', extractos: [] });
  assert.equal(r, 'omitido');
});

test('Si la Lotería saltea un número, lo detecta cuando un turno se atrasa', async () => {
  const base = baseEnMemoria();
  base.sorteos.set('2026-10-08|previa', { numero: 53007, fuente: 'lotba', extractos: [] });
  base.sorteos.set('2026-10-08|primera', { numero: 53008, fuente: 'lotba', extractos: [] });
  const cal = { 53010: { fecha: '2026-10-08', turno: 'matutina' } }; // el 53009 no existe
  const { fuentes } = fuentesFalsas(cal, { lotbaPublicados: new Set([53010]) });
  const ciclo = crearCiclo({ base, fuentes, sorteoInicial: 53007 });
  let r = await ciclo.tick(new Date('2026-10-08T18:10:00Z')); // 15:10: todavía no prueba
  assert.equal(r.guardados.length, 0);
  r = await ciclo.tick(new Date('2026-10-08T18:31:00Z')); // 15:31: prueba el siguiente
  assert.deepEqual(r.guardados.map((g) => g.numero), [53010]);
});

test('Domingo: no busca turnos de hoy', async () => {
  const base = baseEnMemoria();
  base.sorteos.set('2026-10-17|nocturna', { numero: 53051, fuente: 'lotba', extractos: [] });
  const { fuentes, llamadas } = fuentesFalsas({});
  const ciclo = crearCiclo({ base, fuentes, sorteoInicial: 1 });
  const r = await ciclo.tick(new Date('2026-10-18T19:00:00Z'));
  assert.deepEqual(llamadas.lotba, [53052]);
  assert.equal(llamadas.pagina, 0);
  assert.deepEqual(r.faltantes, []);
});

test('No usa la base en cada llamada: el estado queda en memoria', async () => {
  const base = baseEnMemoria();
  let lecturas = 0;
  const original = base.ultimoNumeroLotba;
  base.ultimoNumeroLotba = async () => { lecturas++; return original(); };
  const { fuentes } = fuentesFalsas(CALENDARIO, { lotbaPublicados: new Set([53007]) });
  const ciclo = crearCiclo({ base, fuentes, sorteoInicial: 53007 });
  for (let m = 20; m < 30; m += 2) await ciclo.tick(new Date(`2026-10-08T13:${m}:00Z`));
  assert.equal(lecturas, 1);
});

test('Dos llamadas al mismo tiempo: la segunda espera su turno', async () => {
  const { fuentes } = fuentesFalsas(CALENDARIO);
  const ciclo = crearCiclo({ base: baseEnMemoria(), fuentes, sorteoInicial: 53007 });
  const [a, b] = await Promise.all([ciclo.tick(new Date('2026-10-08T13:00:00Z')), ciclo.tick(new Date('2026-10-08T13:00:00Z'))]);
  assert.ok(a.ocupado || b.ocupado);
});

test('Historial: completa de a poco los sorteos viejos que faltan (8 por llamada)', async () => {
  const base = baseEnMemoria();
  base.sorteos.set('2026-10-08|matutina', { numero: 53009, fuente: 'lotba', extractos: [] });
  const viejos = {};
  for (let n = 52990; n < 53009; n++) viejos[n] = { fecha: '2026-10-01', turno: 'previa' };
  // Cada número viejo devuelve una fecha/turno distinto para no pisarse en la base de mentira
  const turnos = ['previa', 'primera', 'matutina', 'vespertina', 'nocturna'];
  Object.keys(viejos).forEach((n, i) => { viejos[n] = { fecha: `2026-09-${String(10 + Math.floor(i / 5)).padStart(2, '0')}`, turno: turnos[i % 5] }; });
  const { fuentes, llamadas } = fuentesFalsas(viejos, { lotbaPublicados: new Set(Object.keys(viejos).map(Number)) });
  const ciclo = crearCiclo({ base, fuentes, sorteoInicial: 53009, historialDesde: 52990 });
  let r = await ciclo.tick(new Date('2026-10-18T19:00:00Z')); // domingo, sin turnos
  assert.deepEqual(r.historial, { cargados: 8, quedan: 11 });
  assert.deepEqual(llamadas.lotba.slice(1), [53008, 53007, 53006, 53005, 53004, 53003, 53002, 53001]);
  r = await ciclo.tick(new Date('2026-10-18T19:05:00Z'));
  r = await ciclo.tick(new Date('2026-10-18T19:10:00Z'));
  assert.deepEqual(r.historial, { cargados: 3, quedan: 0 });
  assert.equal(base.sorteos.size, 20);
  r = await ciclo.tick(new Date('2026-10-18T19:15:00Z'));
  assert.equal(r.historial, undefined);
});

test('alGuardar recibe si el sorteo es nuevo o actualizado (para avisar solo los nuevos)', async () => {
  const base = baseEnMemoria();
  base.sorteos.set('2026-10-08|primera', { numero: 53008, fuente: 'lotba', extractos: [] });
  base.sorteos.set('2026-10-08|previa', { numero: 53007, fuente: 'lotba', extractos: [] });
  const recibidos = [];
  const { fuentes } = fuentesFalsas(CALENDARIO, { lotbaPublicados: new Set([53009]), quinieleando: { '2026-10-08|vespertina': true } });
  const ciclo = crearCiclo({ base, fuentes, sorteoInicial: 53007, alGuardar: (s, r) => recibidos.push(`${s.turno}:${s.fuente}:${r}`) });
  await ciclo.tick(new Date('2026-10-08T21:20:00Z')); // 18:20: matutina oficial + vespertina por respaldo
  assert.deepEqual(recibidos, ['matutina:lotba:nuevo', 'vespertina:quinieleando:nuevo']);
});
