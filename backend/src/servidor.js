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
import {
  conectar, resultadosDeFecha, demorasRecientes, ultimoNumeroLotba, buscarNumero, guardarSorteo,
  guardarSuscripcion, actualizarSuscripcion, borrarSuscripcion,
} from './db.js';
import { crearAvisos, pushConfigurado } from './avisos.js';
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

const avisos = crearAvisos();

const ciclo = crearCiclo({
  alGuardar: (s, resultado) => {
    memoria.delete(s.fecha); // llegó un resultado: refrescar
    // Sorteo NUEVO de hoy → avisar a los teléfonos (sin frenar la búsqueda)
    if (resultado === 'nuevo' && s.fecha === horaArgentina().fecha) {
      avisos.avisarSorteo(s)
        .then((r) => console.log(`[avisos] ${s.turno}: ${r.enviados} enviados, ${r.fallidos} fallidos`))
        .catch((e) => console.error('[avisos] error:', e.message));
    }
  },
});

// ---- Servidor web
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

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
    try {
      const r = await avisos.recordar();
      if (r.turno) resumen.recordatorio = r;
    } catch (e) {
      console.error('[recordatorio] error:', e.message);
    }
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

// ---- Avisos (notificaciones push) ---------------------------------
function validarSuscripcion(s) {
  return s && typeof s.endpoint === 'string' && s.endpoint.startsWith('https://') && s.endpoint.length < 1000
    && typeof s.keys?.p256dh === 'string' && typeof s.keys?.auth === 'string';
}

// Limpia lo que manda el teléfono: solo jugadas de hoy en adelante, como mucho 50
function limpiarJugadas(jugadas) {
  if (!Array.isArray(jugadas)) return [];
  const desde = horaArgentina().fecha;
  return jugadas
    .filter((j) => j && /^\d{1,4}$/.test(String(j.numero)) && typeof j.fecha === 'string' && j.fecha >= desde)
    .slice(0, 50)
    .map((j) => ({
      numero: String(j.numero), ubicacion: String(j.ubicacion), fecha: j.fecha,
      quinielas: (j.quinielas || []).map(String).slice(0, 10), turnos: (j.turnos || []).map(String).slice(0, 5),
      monto: Number(j.monto) > 0 ? Number(j.monto) : null,
    }));
}

function limpiarPreferencias(p = {}) {
  return {
    cabezas: p.cabezas !== false,
    quinielas: Array.isArray(p.quinielas) ? p.quinielas.map(String).slice(0, 10) : undefined,
    recordatorio: p.recordatorio === true,
  };
}

app.get('/api/push/clave', (req, res) => {
  if (!pushConfigurado()) return res.status(503).json({ error: 'Los avisos todavía no están configurados' });
  res.json({ clave: process.env.VAPID_PUBLICA });
});

app.post('/api/push/suscribir', async (req, res) => {
  const { suscripcion, dispositivo, preferencias, jugadas } = req.body || {};
  if (!validarSuscripcion(suscripcion)) return res.status(400).json({ error: 'Suscripción inválida' });
  try {
    await guardarSuscripcion({
      endpoint: suscripcion.endpoint, p256dh: suscripcion.keys.p256dh, auth: suscripcion.keys.auth,
      dispositivo: typeof dispositivo === 'string' ? dispositivo.slice(0, 64) : null,
      preferencias: limpiarPreferencias(preferencias), jugadas: limpiarJugadas(jugadas),
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('[push] suscribir:', e.message);
    res.status(503).json({ error: 'No se pudo guardar' });
  }
});

app.post('/api/push/actualizar', async (req, res) => {
  const { endpoint, preferencias, jugadas } = req.body || {};
  if (typeof endpoint !== 'string') return res.status(400).json({ error: 'Falta el endpoint' });
  try {
    const ok = await actualizarSuscripcion(endpoint, {
      preferencias: preferencias ? limpiarPreferencias(preferencias) : null,
      jugadas: jugadas ? limpiarJugadas(jugadas) : null,
    });
    res.status(ok ? 200 : 404).json({ ok });
  } catch (e) {
    res.status(503).json({ error: 'No se pudo actualizar' });
  }
});

app.post('/api/push/baja', async (req, res) => {
  const { endpoint } = req.body || {};
  if (typeof endpoint !== 'string') return res.status(400).json({ error: 'Falta el endpoint' });
  try {
    await borrarSuscripcion(endpoint);
    res.json({ ok: true });
  } catch (e) {
    res.status(503).json({ error: 'No se pudo dar de baja' });
  }
});

app.post('/api/push/prueba', async (req, res) => {
  const { endpoint } = req.body || {};
  if (typeof endpoint !== 'string') return res.status(400).json({ error: 'Falta el endpoint' });
  try {
    res.json(await avisos.prueba(endpoint));
  } catch (e) {
    res.status(503).json({ error: 'No se pudo enviar la prueba' });
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

// Carga sorteos ANTERIORES desde la Lotería (para el historial y el buscador).
// /api/cargar-historial?clave=...&desde=52900&hasta=52925  (hasta 30 por llamada)
app.get('/api/cargar-historial', exigirClave, async (req, res) => {
  const desde = Number(req.query.desde);
  const hasta = Number(req.query.hasta);
  if (!Number.isInteger(desde) || !Number.isInteger(hasta) || hasta < desde || hasta - desde >= 30) {
    return res.status(400).json({ error: 'Usar desde y hasta (números de sorteo), como mucho 30 por vez' });
  }
  const informe = { guardados: [], vacios: [], errores: [] };
  for (let n = desde; n <= hasta; n++) {
    try {
      const s = await buscarSorteoLotba(n);
      if (!s) { informe.vacios.push(n); continue; }
      const r = await guardarSorteo(s);
      informe.guardados.push(`${n} ${s.fecha} ${s.turno} (${r})`);
    } catch (e) {
      informe.errores.push(`${n}: ${e.message}`);
    }
  }
  memoria.clear();
  busquedas.clear();
  res.json(informe);
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
