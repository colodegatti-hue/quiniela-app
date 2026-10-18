// =====================================================================
// servidor.js — Servidor de la app Quiniela (Render)
//
// Variables de entorno (se cargan en Render → Environment):
//   DATABASE_URL         conexión a Neon (obligatoria)
//   CLAVE_CRON           clave secreta para /cron/tick y el diagnóstico
//   SORTEO_INICIAL       n.º de sorteo desde el que arranca si la base está vacía
//   ORIGENES_PERMITIDOS  dominios de la app separados por coma (vacío = todos)
// =====================================================================
import express from 'express';
import { conectar, resultadosDeFecha, demorasRecientes, ultimoNumeroLotba, buscarNumero } from './db.js';
import { crearCiclo } from './ciclo.js';
import { horaArgentina, QUINIELAS, TURNOS } from './horarios.js';

function restarDias(fecha, dias) {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}
import { buscarSorteoLotba } from './fuentes/lotba.js';
import { buscarPaginaQuinieleando } from './fuentes/quinieleando.js';

const PUERTO = process.env.PORT || 3000;
const CLAVE_CRON = process.env.CLAVE_CRON || '';
const ORIGENES = (process.env.ORIGENES_PERMITIDOS || '')
  .split(',').map((x) => x.trim()).filter(Boolean);

conectar();

// ---- Resultados en memoria (para no despertar la base en cada consulta)
const memoria = new Map(); // fecha -> { datos, guardadoEn }
const MEMORIA_MAX = 40;

async function obtenerResultados(fecha) {
  const hoy = horaArgentina().fecha;
  const guardado = memoria.get(fecha);
  // Días anteriores no cambian; hoy se refresca como mucho cada 2 minutos
  if (guardado && (fecha !== hoy || Date.now() - guardado.guardadoEn < 120000)) {
    return guardado.datos;
  }
  const datos = await resultadosDeFecha(fecha);
  memoria.set(fecha, { datos, guardadoEn: Date.now() });
  if (memoria.size > MEMORIA_MAX) memoria.delete(memoria.keys().next().value);
  return datos;
}

const ciclo = crearCiclo({
  alGuardar: (s) => memoria.delete(s.fecha), // llegó un resultado: refrescar
});

// ---- Servidor web
const app = express();
app.disable('x-powered-by');

app.use((req, res, next) => {
  const origen = req.headers.origin;
  if (ORIGENES.length === 0) res.set('Access-Control-Allow-Origin', '*');
  else if (origen && ORIGENES.includes(origen)) {
    res.set('Access-Control-Allow-Origin', origen);
    res.set('Vary', 'Origin');
  }
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

function exigirClave(req, res, next) {
  if (!CLAVE_CRON || req.query.clave !== CLAVE_CRON) {
    return res.status(401).json({ error: 'Clave incorrecta' });
  }
  next();
}

app.get('/', (req, res) => res.type('text').send('Quiniela Colo Apps - servidor OK'));

app.get('/salud', (req, res) => {
  res.json({ ok: true, horaArgentina: horaArgentina(), version: '1.0.0' });
});

// Lo llaman cron-job.org y/o GitHub (lunes a sábado, de 10 a 23).
// Freno: como mucho una búsqueda cada 45 segundos, aunque lo llamen más seguido.
let ultimoTick = { hora: 0, resumen: null };
app.get('/cron/tick', exigirClave, async (req, res) => {
  if (Date.now() - ultimoTick.hora < 45000) {
    return res.json({ omitido: 'Ya se buscó hace menos de 45 segundos', anterior: ultimoTick.resumen });
  }
  ultimoTick.hora = Date.now();
  try {
    const resumen = await ciclo.tick();
    ultimoTick.resumen = resumen;
    console.log('[tick]', JSON.stringify(resumen));
    res.json(resumen);
  } catch (e) {
    console.error('[tick] error:', e);
    ciclo.olvidarEstado();
    res.status(500).json({ error: e.message });
  }
});

// Resultados de un día. Sin fecha = hoy. Formato de fecha: AAAA-MM-DD
app.get('/api/resultados', async (req, res) => {
  const fecha = req.query.fecha || horaArgentina().fecha;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return res.status(400).json({ error: 'Fecha inválida (usar AAAA-MM-DD)' });
  }
  try {
    res.set('Cache-Control', 'public, max-age=60');
    res.json(await obtenerResultados(fecha));
  } catch (e) {
    console.error('[resultados] error:', e);
    res.status(503).json({ error: 'No se pudieron leer los resultados' });
  }
});

// ¿Salió mi número? Busca un número en los sorteos de los últimos días.
// /api/buscar?numero=79&dias=30  (dias: de 1 a 60)
const busquedas = new Map(); // "numero|dias|fecha" -> { datos, guardadoEn }
app.get('/api/buscar', async (req, res) => {
  const numero = String(req.query.numero || '');
  const dias = Number(req.query.dias || 30);
  if (!/^\d{1,4}$/.test(numero)) return res.status(400).json({ error: 'El número tiene que tener de 1 a 4 cifras' });
  if (!Number.isInteger(dias) || dias < 1 || dias > 60) return res.status(400).json({ error: 'Los días tienen que ser de 1 a 60' });
  const hoy = horaArgentina().fecha;
  const clave = `${numero}|${dias}|${hoy}`;
  const guardado = busquedas.get(clave);
  if (guardado && Date.now() - guardado.guardadoEn < 120000) return res.json(guardado.datos);
  try {
    const datos = await buscarNumero(numero, restarDias(hoy, dias - 1));
    busquedas.set(clave, { datos, guardadoEn: Date.now() });
    if (busquedas.size > 200) busquedas.delete(busquedas.keys().next().value);
    res.set('Cache-Control', 'public, max-age=60');
    res.json(datos);
  } catch (e) {
    console.error('[buscar] error:', e);
    res.status(503).json({ error: 'No se pudo hacer la búsqueda' });
  }
});

// Datos fijos para la app: quinielas y horarios
app.get('/api/configuracion', (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.json({ quinielas: QUINIELAS, turnos: TURNOS });
});

// Demoras medidas de cada fuente (últimos 7 días)
app.get('/api/demoras', exigirClave, async (req, res) => {
  try {
    res.json(await demorasRecientes(7));
  } catch (e) {
    res.status(503).json({ error: e.message });
  }
});

// Diagnóstico: prueba las dos fuentes desde Render SIN guardar nada
app.get('/api/prueba-fuentes', exigirClave, async (req, res) => {
  const informe = { horaArgentina: horaArgentina() };
  try {
    informe.base = { ok: true, ultimoNumero: await ultimoNumeroLotba() };
  } catch (e) {
    informe.base = { ok: false, error: e.message };
  }
  const numero = Number(req.query.sorteo) || informe.base.ultimoNumero || Number(process.env.SORTEO_INICIAL) || 0;
  try {
    const s = await buscarSorteoLotba(numero);
    informe.lotba = s
      ? { ok: true, sorteo: numero, fecha: s.fecha, turno: s.turno, quinielas: s.extractos.map((e) => `${e.quiniela}: ${e.numeros[0]}`) }
      : { ok: true, sorteo: numero, nota: 'Responde, pero ese sorteo no tiene datos' };
  } catch (e) {
    informe.lotba = { ok: false, sorteo: numero, error: e.message };
  }
  try {
    const turnos = await buscarPaginaQuinieleando('nacional');
    informe.quinieleando = { ok: true, turnosEncontrados: turnos.map((t) => `${t.fecha} ${t.turno}: ${t.numeros[0]}`) };
  } catch (e) {
    informe.quinieleando = { ok: false, error: e.message };
  }
  res.json(informe);
});

app.listen(PUERTO, () => console.log(`Servidor Quiniela escuchando en el puerto ${PUERTO}`));
