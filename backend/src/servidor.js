// =====================================================================
// servidor.js — Servidor de la app Quiniela (Render)
//
// Variables de entorno (se cargan en Render → Environment):
//   DATABASE_URL         conexión a Neon (obligatoria)
//   CLAVE_CRON           clave secreta para /cron/tick y el diagnóstico
//   SORTEO_INICIAL       n.º de sorteo desde el que arranca si la base está vacía
//   ORIGENES_PERMITIDOS  dominios de la app separados por coma (vacío = todos)
//   ADMIN_CLAVE          clave del panel privado /admin (sin ella el panel queda apagado)
// =====================================================================
import { buscarCabezasVivi } from './fuentes/vivitusuerte.js';
import express from 'express';
import {
  conectar, resultadosDeFecha, demorasRecientes, ultimoNumeroLotba, buscarNumero, guardarSorteo, estadisticas,
  guardarSuscripcion, actualizarSuscripcion, borrarSuscripcion, crearArrepentimiento, listarArrepentimientos,
  registrarUso, esProDispositivo, alertaNueva,
} from './db.js';
import { crearVigilancia } from './vigilancia.js';
import { montarAdmin } from './admin.js';
import { crearAvisos, pushConfigurado } from './avisos.js';
import { crearPro, planes, codigoValido } from './pro.js';
import { mpConfigurado, crearPreferencia, cuentaMp } from './mercadopago.js';
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
// Si falta una quiniela pasado un rato del sorteo, le avisa a los teléfonos de administrador
const vigilancia = crearVigilancia({ base: { alertaNueva }, enviar: (datos) => avisos.avisarAdmins(datos) });
const pro = crearPro();
const cacheEstadisticas = new Map(); // "quiniela|dias|fecha" -> datos (se borra cuando llega un sorteo)
const IDS_ESTADISTICAS = ['ciudad', 'provincia', 'santafe', 'cordoba', 'entrerios', 'mendoza', 'montevideo'];

const ciclo = crearCiclo({
  alGuardar: (s) => {
    memoria.delete(s.fecha); // llegó un resultado: refrescar
    cacheEstadisticas.clear();
  },
  // Aparecieron quinielas de un sorteo de hoy → avisar a los teléfonos al instante, sin frenar la búsqueda
  alListo: (s, { nuevas } = {}) => {
    avisos.avisarSorteo(s, { nuevas })
      .then((r) => console.log(`[avisos] ${s.turno} (${s.extractos.length} quinielas, nuevas: ${nuevas?.join(',')}): ${r.enviados} enviados, ${r.fallidos} fallidos`))
      .catch((e) => console.error('[avisos] error:', e.message));
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

app.get('/', (req, res) => res.type('text').send('Quiniela al Toque (Colo Apps) - servidor OK'));

app.get('/salud', (req, res) => {
  res.json({ ok: true, horaArgentina: horaArgentina(), version: '1.0.0' });
});

// Lo llaman cron-job.org y/o GitHub (lunes a sábado, de 10 a 23).
// Freno: como mucho una búsqueda cada 45 segundos, aunque lo llamen más seguido.
let ultimoTick = { hora: 0, resumen: null };
app.get('/cron/tick', exigirClave, async (req, res) => {
  if (Date.now() - ultimoTick.hora < 45000) {
    return res.json({ ok: true, omitido: 'Ya se buscó hace menos de 45 segundos' });
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
    try {
      const fallas = await vigilancia.revisar(ciclo.verEstado());
      if (fallas.length) resumen.alertasFallas = fallas;
    } catch (e) {
      console.error('[vigilancia] error:', e.message);
    }
    ultimoTick.resumen = resumen;
    console.log('[tick]', JSON.stringify(resumen));
    // Respuesta corta (cron-job.org rechaza respuestas grandes). El detalle queda en los logs.
    res.json({ ok: true, guardados: resumen.guardados?.length ?? 0, errores: resumen.errores?.length ?? 0, incompletos: resumen.incompletos ?? [] });
  } catch (e) {
    console.error('[tick] error:', e);
    ciclo.olvidarEstado();
    res.status(500).json({ error: e.message });
  }
});

// Diagnóstico: qué cabezas lee de vivitusuerte para una fecha (pide la clave)
app.get('/api/diag/cabezas', exigirClave, async (req, res) => {
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(req.query.fecha ?? '') ? req.query.fecha : null;
  if (!fecha) return res.status(400).json({ error: 'fecha AAAA-MM-DD' });
  try {
    const cabezas = await buscarCabezasVivi(fecha);
    console.log('[diag cabezas]', fecha, JSON.stringify(cabezas));
    res.json({ fecha, cantidad: cabezas.length, cabezas });
  } catch (e) {
    console.error('[diag cabezas] error:', e.message);
    res.status(502).json({ error: e.message });
  }
});

// ---- Medición de uso: cada teléfono avisa una vez por día que abrió la app (anónimo)
// Cuerpo: { d: id del teléfono, o: origen de la primera vez, e: origen si entró ahora por un enlace, p: es Pro }
const ORIGEN_OK = /^(directo|inv|ag:[a-z0-9-]{2,30})$/;
const pingsPorIp = new Map();
app.post('/api/ping', async (req, res) => {
  const ip = String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
  const n = (pingsPorIp.get(ip) ?? 0) + 1;
  pingsPorIp.set(ip, n);
  if (pingsPorIp.size > 20000) pingsPorIp.clear();
  if (n > 600) return res.status(429).json({ ok: false }); // muchos celulares comparten IP (CGNAT)
  const { d, o, e, p } = req.body || {};
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(String(d ?? ''))) return res.status(400).json({ ok: false });
  try {
    await registrarUso({
      dispositivo: d,
      origen: ORIGEN_OK.test(String(o ?? '')) ? o : 'directo',
      entrada: ORIGEN_OK.test(String(e ?? '')) && e !== 'directo' ? e : null,
      pro: p === true,
      dia: horaArgentina().fecha,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[ping] error:', err.message);
    res.status(500).json({ ok: false });
  }
});
setInterval(() => pingsPorIp.clear(), 3600000).unref();

// ---- Panel privado
montarAdmin(app, { estadoCiclo: () => ciclo.verEstado() });

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

// Números salidores y atrasados de una quiniela.
// /api/estadisticas?quiniela=ciudad&dias=30  (dias: de 7 a 365)
app.get('/api/estadisticas', async (req, res) => {
  const quiniela = String(req.query.quiniela || 'ciudad');
  const dias = Number(req.query.dias || 30);
  if (!IDS_ESTADISTICAS.includes(quiniela)) return res.status(400).json({ error: 'Quiniela inválida' });
  if (!Number.isInteger(dias) || dias < 7 || dias > 365) return res.status(400).json({ error: 'Los días tienen que ser de 7 a 365' });
  // Gratis: Ciudad y Provincia, últimos 30 días. El resto es Pro (se valida acá, no solo en la app)
  const gratis = ['ciudad', 'provincia'].includes(quiniela) && dias === 30;
  if (!gratis) {
    const codigo = String(req.query.codigo || '');
    const dispositivo = String(req.query.dispositivo || '');
    const ok = codigoValido(codigo) && /^[0-9a-f-]{36}$/.test(dispositivo) && await esProDispositivo(codigo, dispositivo).catch(() => false);
    if (!ok) return res.status(403).json({ error: 'Estas estadísticas son de la versión Pro' });
  }
  const hoy = horaArgentina().fecha;
  const clave = `${quiniela}|${dias}|${hoy}`;
  try {
    let datos = cacheEstadisticas.get(clave);
    if (!datos) {
      datos = await estadisticas(quiniela, restarDias(hoy, dias - 1));
      cacheEstadisticas.set(clave, datos);
      if (cacheEstadisticas.size > 100) cacheEstadisticas.delete(cacheEstadisticas.keys().next().value);
    }
    res.set('Cache-Control', gratis ? 'public, max-age=120' : 'private, max-age=120');
    res.json(datos);
  } catch (e) {
    console.error('[estadisticas] error:', e);
    res.status(503).json({ error: 'No se pudieron calcular las estadísticas' });
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
    // Números a seguir (de 2 cifras, sin repetir, como mucho 10)
    alertas: Array.isArray(p.alertas) ? [...new Set(p.alertas.map(String).filter((n) => /^\d{2}$/.test(n)))].slice(0, 10) : [],
    alertasDonde: p.alertasDonde === 'a_los_20' ? 'a_los_20' : 'cabeza',
  };
}

app.get('/api/push/clave', (req, res) => {
  if (!pushConfigurado()) return res.status(503).json({ error: 'Los avisos todavía no están configurados' });
  res.json({ clave: process.env.VAPID_PUBLICA });
});

app.post('/api/push/suscribir', async (req, res) => {
  const { suscripcion, dispositivo, preferencias, jugadas, codigo } = req.body || {};
  if (!validarSuscripcion(suscripcion)) return res.status(400).json({ error: 'Suscripción inválida' });
  try {
    await guardarSuscripcion({
      endpoint: suscripcion.endpoint, p256dh: suscripcion.keys.p256dh, auth: suscripcion.keys.auth,
      dispositivo: typeof dispositivo === 'string' ? dispositivo.slice(0, 64) : null,
      preferencias: limpiarPreferencias(preferencias), jugadas: limpiarJugadas(jugadas),
      codigo: codigoValido(codigo) ? String(codigo) : null,
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('[push] suscribir:', e.message);
    res.status(503).json({ error: 'No se pudo guardar' });
  }
});

app.post('/api/push/actualizar', async (req, res) => {
  const { endpoint, preferencias, jugadas, codigo } = req.body || {};
  if (typeof endpoint !== 'string') return res.status(400).json({ error: 'Falta el endpoint' });
  try {
    const ok = await actualizarSuscripcion(endpoint, {
      preferencias: preferencias ? limpiarPreferencias(preferencias) : null,
      jugadas: jugadas ? limpiarJugadas(jugadas) : null,
      codigo: codigoValido(codigo) ? String(codigo) : null,
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

// ---- Versión Pro ---------------------------------------------------
// Freno simple contra quien prueba códigos al azar: 15 intentos cada 10 minutos por IP
const intentos = new Map(); // ip -> { n, desde }
function demasiadosIntentos(req) {
  const ip = String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
  const ahora = Date.now();
  const x = intentos.get(ip);
  if (!x || ahora - x.desde > 600000) { intentos.set(ip, { n: 1, desde: ahora }); return false; }
  x.n++;
  if (intentos.size > 5000) intentos.clear();
  return x.n > 15;
}

app.get('/api/pro/planes', (req, res) => {
  const p = planes();
  res.json({
    disponible: mpConfigurado(),
    planes: Object.fromEntries(Object.entries(p).map(([id, x]) => [id, { precio: x.precio, dias: x.dias }])),
  });
});

app.post('/api/pro/comprar', async (req, res) => {
  if (!mpConfigurado()) return res.status(503).json({ error: 'El pago todavía no está habilitado' });
  const { plan, codigo, dispositivo, origen } = req.body || {};
  try {
    const r = await pro.comprar({ plan, codigo, dispositivo, origen });
    if (r.error) return res.status(400).json(r);
    res.json(r);
  } catch (e) {
    console.error('[pro] comprar:', e.message);
    res.status(503).json({ error: 'No se pudo iniciar el pago. Probá de nuevo en un rato.' });
  }
});

// La app la llama al volver de Mercado Pago: /api/pro/confirmar?ref=...
app.get('/api/pro/confirmar', async (req, res) => {
  const ref = String(req.query.ref || '');
  if (!/^[0-9a-f-]{36}$/.test(ref)) return res.status(400).json({ error: 'Referencia inválida' });
  try {
    const r = await pro.confirmar(ref);
    if (r.estado === 'aprobada') console.log(`[pro] compra aprobada ${ref.slice(0, 8)}`);
    res.json(r);
  } catch (e) {
    console.error('[pro] confirmar:', e.message);
    res.status(503).json({ error: 'No se pudo consultar el pago' });
  }
});

// Aviso automático de Mercado Pago (webhook). Siempre responde 200 rápido.
app.post('/api/pro/aviso-pago', (req, res) => {
  const tipo = req.body?.type || req.query.type || req.query.topic;
  const id = req.body?.data?.id || req.query['data.id'] || req.query.id;
  res.sendStatus(200);
  if (tipo !== 'payment' || !id) return;
  pro.procesarAviso(id)
    .then((r) => r.ok && !r.ya && console.log(`[pro] pago ${id} aprobado por aviso`))
    .catch((e) => console.error('[pro] aviso:', e.message));
});

// ¿Este código Pro está vigente? (anota el teléfono, máx. 3 por código)
app.post('/api/pro/verificar', async (req, res) => {
  if (demasiadosIntentos(req)) return res.status(429).json({ activo: false, error: 'Demasiados intentos. Esperá unos minutos.' });
  const { codigo, dispositivo } = req.body || {};
  try {
    res.json(await pro.verificar(String(codigo ?? ''), dispositivo));
  } catch (e) {
    console.error('[pro] verificar:', e.message);
    res.status(503).json({ error: 'No se pudo verificar el código' });
  }
});

// Botón de arrepentimiento: la persona pide cancelar su compra Pro (Ley 24.240, art. 34).
// Se guarda el pedido y se le devuelve un número de trámite. La devolución se hace a mano en Mercado Pago.
app.post('/api/pro/recuperar', async (req, res) => {
  if (demasiadosIntentos(req)) return res.status(429).json({ activo: false, error: 'Demasiados intentos. Esperá unos minutos.' });
  const { pago, dispositivo } = req.body || {};
  try {
    const r = await pro.recuperar(pago, dispositivo);
    if (r.activo !== undefined && !r.error) console.log(`[pro] recuperado ${r.codigo?.slice(0, 2)}****`);
    res.json(r);
  } catch (e) {
    console.error('[pro] recuperar:', e.message);
    res.status(503).json({ activo: false, error: 'No pudimos consultar Mercado Pago. Probá de nuevo en un rato.' });
  }
});

app.post('/api/pro/arrepentimiento', async (req, res) => {
  if (demasiadosIntentos(req)) return res.status(429).json({ error: 'Demasiados intentos. Esperá unos minutos.' });
  const { codigo, contacto, detalle } = req.body || {};
  const c = String(contacto ?? '').trim();
  if (c.length < 6 || c.length > 120 || !(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) || /^[+\d][\d\s-]{5,}$/.test(c))) {
    return res.status(400).json({ error: 'Poné un mail o un teléfono para que te podamos responder.' });
  }
  if (codigo && !codigoValido(codigo)) return res.status(400).json({ error: 'El código tiene 6 números.' });
  const numero = `ARR-${Date.now().toString(36).toUpperCase()}`;
  try {
    await crearArrepentimiento({ numero, codigo: codigo || null, contacto: c, detalle: String(detalle ?? '').slice(0, 500) || null });
    console.log(`[pro] arrepentimiento ${numero} (código ${codigo || '-'})`);
    res.json({ numero });
  } catch (e) {
    console.error('[pro] arrepentimiento:', e.message);
    res.status(503).json({ error: 'No se pudo registrar el pedido. Probá de nuevo o escribinos.' });
  }
});

app.get('/api/pro/arrepentimientos', exigirClave, async (req, res) => {
  try { res.json(await listarArrepentimientos()); } catch (e) { res.status(503).json({ error: e.message }); }
});

// Diagnóstico: crea un link de pago de prueba SIN guardar nada (para ver que Mercado Pago responde)
app.get('/api/pro/prueba-mp', exigirClave, async (req, res) => {
  // Forma del token (sin mostrarlo): un Access Token es APP_USR-<números>-<números>-<letras>-<números>
  const t = String(process.env.MP_ACCESS_TOKEN || '');
  const forma = { largo: t.length, partes: t.split('-').length, pareceAccessToken: /^(APP_USR|TEST)-\d+-\d+-[0-9a-f]+-\d+$/.test(t), espaciosOComillas: /[\s"']/.test(t) };
  console.log('[pro] forma del token:', JSON.stringify(forma));
  const cuentaAntes = await cuentaMp().catch((e) => ({ error: e.message }));
  console.log('[pro] cuenta del token:', JSON.stringify(cuentaAntes));
  try {
    const p = await crearPreferencia({
      titulo: 'Prueba', precio: 10, referencia: `prueba-${Date.now()}`,
      urlVuelta: 'https://quinielaaltoque.app/', urlAvisos: 'https://api.quinielaaltoque.app/api/pro/aviso-pago',
    });
    const cuenta = await cuentaMp().catch((e) => ({ error: e.message }));
    const r = { ok: true, preferencia: p.id, linkDePrueba: p.url.includes('sandbox') ? 'sandbox' : 'normal', tipoDeToken: (process.env.MP_ACCESS_TOKEN || '').split('-')[0], cuenta };
    console.log('[pro] prueba Mercado Pago:', JSON.stringify(r));
    res.json(r);
  } catch (e) {
    console.log('[pro] prueba Mercado Pago FALLÓ:', e.message);
    res.json({ ok: false, error: e.message });
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
