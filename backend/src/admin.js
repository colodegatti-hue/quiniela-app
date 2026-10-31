// =====================================================================
// admin.js — Panel administrativo privado (solo Colo)
//
// Se entra en  https://<servidor>/admin  con la clave ADMIN_CLAVE
// (variable de entorno en Render; sin ella el panel queda apagado).
// La sesión es una cookie firmada en el servidor (HttpOnly, 30 días).
// Cambiar ADMIN_CLAVE cierra todas las sesiones abiertas.
// =====================================================================
import crypto from 'node:crypto';
import express from 'express';
import QRCode from 'qrcode';
import * as baseReal from './db.js';
import { horaArgentina } from './horarios.js';

const COOKIE = 'qat_admin';
const DURACION_MS = 30 * 864e5;

const ipDe = (req) => String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();

function firmar(texto, clave) {
  return crypto.createHmac('sha256', `panel|${clave}`).update(texto).digest('base64url');
}

function iguales(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function crearToken(clave, ahora = Date.now()) {
  const vence = String(ahora + DURACION_MS);
  return `${vence}.${firmar(vence, clave)}`;
}

export function tokenValido(token, clave, ahora = Date.now()) {
  if (!clave || !token) return false;
  const [vence, firma] = String(token).split('.');
  if (!/^\d+$/.test(vence ?? '') || Number(vence) < ahora) return false;
  return iguales(firma ?? '', firmar(vence, clave));
}

function leerCookie(req, nombre) {
  for (const parte of String(req.headers.cookie || '').split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === nombre) return decodeURIComponent(v.join('='));
  }
  return null;
}

// Código de agencia a partir del nombre: "Agencia La Suerte" -> "la-suerte"
export function codigoDesdeNombre(nombre) {
  return String(nombre || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\bagencia\b/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function montarAdmin(app, { base = baseReal, clave = () => process.env.ADMIN_CLAVE || '', appUrl = () => process.env.APP_URL || 'https://quinielaaltoque.app' } = {}) {
  const r = express.Router();
  const fallos = new Map(); // ip -> { n, desde }

  r.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Frame-Options', 'DENY');
    res.set('Referrer-Policy', 'no-referrer');
    res.set('X-Robots-Tag', 'noindex, nofollow');
    if (!clave()) return res.status(503).type('text').send('Panel apagado: falta ADMIN_CLAVE en el servidor.');
    next();
  });

  const logueado = (req) => tokenValido(leerCookie(req, COOKIE), clave());
  const exigir = (req, res, next) => (logueado(req) ? next() : res.status(401).json({ error: 'Sesión vencida' }));

  r.get('/', (req, res) => res.type('html').send(logueado(req) ? PANEL : LOGIN('')));

  r.post('/entrar', express.urlencoded({ extended: false, limit: '2kb' }), async (req, res) => {
    const ip = ipDe(req);
    const f = fallos.get(ip);
    if (f && Date.now() - f.desde < 15 * 60000 && f.n >= 5) {
      return res.status(429).type('html').send(LOGIN('Demasiados intentos. Esperá 15 minutos.'));
    }
    if (!iguales(req.body?.clave ?? '', clave())) {
      if (!f || Date.now() - f.desde >= 15 * 60000) fallos.set(ip, { n: 1, desde: Date.now() });
      else f.n++;
      if (fallos.size > 1000) fallos.clear();
      base.anotarAdmin('entrada fallida', null, ip).catch(() => {});
      return res.status(401).type('html').send(LOGIN('Clave incorrecta.'));
    }
    fallos.delete(ip);
    base.anotarAdmin('entrada', null, ip).catch(() => {});
    res.set('Set-Cookie', `${COOKIE}=${crearToken(clave())}; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${DURACION_MS / 1000}`);
    res.redirect(303, '/admin');
  });

  r.post('/salir', (req, res) => {
    res.set('Set-Cookie', `${COOKIE}=; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
    res.redirect(303, '/admin');
  });

  r.get('/api/resumen', exigir, async (req, res) => {
    try {
      const hoy = horaArgentina().fecha;
      const [resumen, agencias] = await Promise.all([base.resumenAdmin(hoy), base.agenciasConDatos(hoy)]);
      res.json({ hoy, ...resumen, agencias, appUrl: appUrl() });
    } catch (e) {
      console.error('[admin] resumen:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // Buscar un código Pro y liberarlo (cuando alguien cambia de celular)
  r.get('/api/codigo/:codigo', exigir, async (req, res) => {
    const codigo = String(req.params.codigo);
    if (!/^\d{6}$/.test(codigo)) return res.status(400).json({ error: 'El código tiene 6 números' });
    const l = await base.licenciaAdmin(codigo);
    if (!l) return res.status(404).json({ error: 'Ese código no existe' });
    res.json(l);
  });

  r.post('/api/codigo/:codigo/liberar', exigir, async (req, res) => {
    const codigo = String(req.params.codigo);
    if (!/^\d{6}$/.test(codigo)) return res.status(400).json({ error: 'El código tiene 6 números' });
    const ok = await base.liberarLicencia(codigo);
    if (!ok) return res.status(404).json({ error: 'Ese código no existe' });
    base.anotarAdmin('código liberado', codigo, ipDe(req)).catch(() => {});
    res.json({ ok: true });
  });

  r.get('/api/registro', exigir, async (req, res) => {
    res.json(await base.registroAdmin(50));
  });

  r.post('/api/agencias', exigir, async (req, res) => {
    const b = req.body || {};
    const nombre = String(b.nombre || '').trim().slice(0, 80);
    const codigo = String(b.codigo || codigoDesdeNombre(nombre)).trim().toLowerCase();
    if (nombre.length < 2) return res.status(400).json({ error: 'Poné el nombre de la agencia' });
    if (!/^[a-z0-9-]{2,30}$/.test(codigo)) return res.status(400).json({ error: 'Código inválido (letras, números y guiones)' });
    try {
      const resultado = await base.guardarAgencia({
        codigo, nombre,
        localidad: String(b.localidad || '').trim().slice(0, 60),
        contacto: String(b.contacto || '').trim().slice(0, 80),
        activa: b.activa !== false,
      });
      base.anotarAdmin(`agencia ${resultado}`, `${codigo} (${nombre})`, ipDe(req)).catch(() => {});
      res.json({ ok: true, codigo, resultado });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // QR de una agencia (SVG). Lleva a /ir.html?ag=CODIGO: Android → Play (cuando esté publicada), iPhone → cómo instalar, resto → la app
  r.get('/qr/:codigo.svg', async (req, res) => {
    if (!logueado(req)) return res.sendStatus(401);
    const codigo = String(req.params.codigo);
    if (!/^[a-z0-9-]{2,30}$/.test(codigo)) return res.sendStatus(404);
    const svg = await QRCode.toString(`${appUrl()}/ir.html?ag=${codigo}`, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0b2545', light: '#ffffff' } });
    res.type('image/svg+xml').send(svg);
  });

  // Flyer para imprimir (A4 o media hoja)
  r.get('/flyer/:codigo', async (req, res) => {
    if (!logueado(req)) return res.redirect(303, '/admin');
    const ag = await base.buscarAgencia(String(req.params.codigo));
    if (!ag) return res.status(404).type('text').send('No existe esa agencia');
    const enlace = `${appUrl()}/ir.html?ag=${ag.codigo}`;
    const svg = await QRCode.toString(enlace, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0b2545', light: '#ffffff' } });
    res.type('html').send(FLYER({ nombre: ag.nombre, localidad: ag.localidad, enlace, svg }));
  });

  app.use('/admin', express.json({ limit: '10kb' }), r);
}

// ---------------------------------------------------------------------
// Pantallas (HTML simple, sin librerías externas)
// ---------------------------------------------------------------------
const ESTILO = `
:root{--fondo:#f4f6fa;--tarjeta:#fff;--texto:#14213d;--tenue:#5c677d;--marca:#0b2545;--acento:#e63946;--verde:#2a9d8f;--borde:#dde3ec}
@media (prefers-color-scheme:dark){:root{--fondo:#0d1321;--tarjeta:#16203a;--texto:#e8ecf4;--tenue:#9aa6bf;--marca:#8ecae6;--borde:#26345a}}
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:var(--fondo);color:var(--texto)}
header{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;background:var(--marca);color:#fff}
header h1{font-size:18px;margin:0}header form{margin:0}
main{max-width:1100px;margin:0 auto;padding:16px}
h2{font-size:16px;margin:24px 0 10px}
.grilla{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px}
.dato{background:var(--tarjeta);border:1px solid var(--borde);border-radius:12px;padding:12px}
.dato b{display:block;font-size:26px;margin-top:4px}.dato small{color:var(--tenue);font-size:12px}
.caja{background:var(--tarjeta);border:1px solid var(--borde);border-radius:12px;padding:12px;overflow-x:auto}
table{border-collapse:collapse;width:100%;font-size:14px}th,td{text-align:left;padding:8px 6px;border-bottom:1px solid var(--borde);white-space:nowrap}
th{color:var(--tenue);font-weight:600;font-size:12px}
button,.boton{background:var(--acento);color:#fff;border:0;border-radius:8px;padding:9px 14px;font-size:14px;cursor:pointer;text-decoration:none;display:inline-block}
.sec{background:transparent;color:inherit;border:1px solid currentColor}
input{padding:9px;border:1px solid var(--borde);border-radius:8px;font-size:15px;background:var(--fondo);color:var(--texto);width:100%}
.form{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;align-items:end}
.nota{color:var(--tenue);font-size:12px;margin:6px 0 0}
.barras{display:flex;align-items:flex-end;gap:2px;height:120px;margin-top:8px}
.barras div{flex:1;background:var(--verde);border-radius:3px 3px 0 0;min-height:1px;position:relative}
.barras div span{position:absolute;bottom:0;left:0;right:0;background:var(--acento);border-radius:3px 3px 0 0}
.eje{display:flex;justify-content:space-between;color:var(--tenue);font-size:11px;margin-top:4px}
.leyenda{font-size:12px;color:var(--tenue)}.leyenda i{display:inline-block;width:10px;height:10px;border-radius:2px;margin:0 4px 0 10px;vertical-align:middle}
.error{color:var(--acento)}
`;

const LOGIN = (mensaje) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Panel Quiniela al Toque</title><style>${ESTILO}
.login{max-width:340px;margin:12vh auto;padding:0 16px}.login .caja{padding:20px}</style></head><body>
<div class="login"><div class="caja"><h1 style="font-size:20px;margin-top:0">Panel privado</h1>
<form method="post" action="/admin/entrar"><input type="password" name="clave" placeholder="Clave" autocomplete="current-password" autofocus required>
<p><button type="submit" style="width:100%">Entrar</button></p></form>
${mensaje ? `<p class="error">${esc(mensaje)}</p>` : ''}</div></div></body></html>`;

const PANEL = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Panel Quiniela al Toque</title><style>${ESTILO}</style></head><body>
<header><h1>Quiniela al Toque · Panel</h1><form method="post" action="/admin/salir"><button class="sec" type="submit">Salir</button></form></header>
<main>
<p id="estado" class="nota">Cargando…</p>
<h2>Personas que usan la app</h2>
<div class="grilla" id="uso"></div>
<p class="nota">Un "teléfono" es una instalación o navegador (anónimo, sin datos personales). Activo = abrió la app ese día o en ese período. Se mide desde el 30/10/2026.</p>
<div class="caja" style="margin-top:10px"><div class="leyenda">Últimos 30 días<i style="background:var(--verde)"></i>activos<i style="background:var(--acento)"></i>nuevos</div><div class="barras" id="barras"></div><div class="eje" id="eje"></div></div>

<h2>Pro e ingresos</h2>
<div class="grilla" id="pro"></div>
<p class="nota">Montos brutos cobrados por Mercado Pago (antes de comisiones e impuestos). "Pro activos" incluye códigos de cortesía.</p>

<h2>Código Pro de un cliente</h2>
<div class="caja"><form id="buscar-codigo" class="form">
<label>Código<input name="codigo" inputmode="numeric" maxlength="6" placeholder="000000" required></label>
<button type="submit">Buscar</button></form><div id="codigo-res" class="nota"></div></div>
<p class="nota">Cada código sirve en un teléfono. Si el cliente cambió de celular, tocá "Liberar" y que ponga el código en el nuevo.</p>

<h2>Agencias amigas</h2>
<div class="caja"><table><thead><tr><th>Agencia</th><th>Localidad</th><th>Entradas por QR</th><th>Teléfonos nuevos</th><th>Activos 30 días</th><th>Compras Pro</th><th></th></tr></thead><tbody id="agencias"></tbody></table></div>
<p class="nota">Entradas = veces que abrieron el enlace o QR (aunque ya tuvieran la app). Teléfonos nuevos = la primera vez que abrieron la app fue por esa agencia.</p>
<h2>Agregar agencia</h2>
<div class="caja"><form id="nueva" class="form">
<label>Nombre<input name="nombre" required placeholder="Agencia La Suerte"></label>
<label>Localidad<input name="localidad" placeholder="Isla Verde"></label>
<label>Contacto<input name="contacto" placeholder="Teléfono o nombre"></label>
<button type="submit">Agregar</button></form><p id="msj" class="nota"></p></div>

<h2>De dónde llegan</h2>
<div class="caja"><table><thead><tr><th>Origen</th><th>Teléfonos</th></tr></thead><tbody id="origenes"></tbody></table></div>
</main>
<script>
const $ = (id) => document.getElementById(id);
const fmt = (n) => Number(n || 0).toLocaleString('es-AR');
const pesos = (n) => '$ ' + Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 });
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tarjeta = (t, v, n) => '<div class="dato"><small>' + t + '</small><b>' + v + '</b>' + (n ? '<small>' + n + '</small>' : '') + '</div>';
const NOMBRES = { directo: 'Entró directo', inv: 'Invitación de un usuario' };
async function cargar() {
  const r = await fetch('/admin/api/resumen');
  if (r.status === 401) { location.reload(); return; }
  const d = await r.json();
  if (d.error) { $('estado').textContent = 'Error: ' + d.error; return; }
  $('estado').textContent = 'Datos al ' + new Date().toLocaleString('es-AR');
  $('uso').innerHTML = tarjeta('Activos hoy', fmt(d.activos.hoy)) + tarjeta('Activos 7 días', fmt(d.activos.dias7)) + tarjeta('Activos 30 días', fmt(d.activos.dias30))
    + tarjeta('Nuevos hoy', fmt(d.nuevos.hoy)) + tarjeta('Nuevos 7 días', fmt(d.nuevos.dias7)) + tarjeta('Nuevos 30 días', fmt(d.nuevos.dias30))
    + tarjeta('Teléfonos en total', fmt(d.nuevos.total), 'desde que se mide') + tarjeta('Con avisos activados', fmt(d.avisos.telefonos));
  const max = Math.max(1, ...d.serie.map((x) => x.activos));
  $('barras').innerHTML = d.serie.map((x) => '<div title="' + x.dia + ': ' + x.activos + ' activos, ' + x.nuevos + ' nuevos" style="height:' + (x.activos / max * 100) + '%"><span style="height:' + (x.activos ? x.nuevos / x.activos * 100 : 0) + '%"></span></div>').join('');
  $('eje').innerHTML = '<span>' + d.serie[0].dia.slice(5) + '</span><span>' + d.serie.at(-1).dia.slice(5) + '</span>';
  $('pro').innerHTML = tarjeta('Pro activos', fmt(d.pro.activos), fmt(d.pro.pagos) + ' pagos') + tarjeta('Vencen en 7 días', fmt(d.pro.vencen7)) + tarjeta('Vencidos (30 días)', fmt(d.pro.vencidos30))
    + tarjeta('Cobrado este mes', pesos(d.ventas.mes_monto), fmt(d.ventas.mes_cantidad) + ' compras') + tarjeta('Cobrado este año', pesos(d.ventas.anio_monto), fmt(d.ventas.anio_cantidad) + ' compras')
    + tarjeta('Planes vendidos', fmt(d.ventas.mensuales) + ' / ' + fmt(d.ventas.anuales), 'mensuales / anuales');
  $('agencias').innerHTML = d.agencias.length ? d.agencias.map((a) => '<tr><td><b>' + esc(a.nombre) + '</b><br><small class="nota">' + esc(d.appUrl) + '/ir.html?ag=' + esc(a.codigo) + '</small></td><td>' + esc(a.localidad) + '</td><td>' + fmt(a.visitas) + '</td><td>' + fmt(a.telefonos) + '</td><td>' + fmt(a.activos30) + '</td><td>' + fmt(a.compras_pro) + '</td><td><a class="boton" href="/admin/flyer/' + encodeURIComponent(a.codigo) + '" target="_blank">Flyer y QR</a></td></tr>').join('')
    : '<tr><td colspan="7" class="nota">Todavía no cargaste agencias.</td></tr>';
  $('origenes').innerHTML = d.origenes.length ? d.origenes.map((o) => '<tr><td>' + esc(NOMBRES[o.origen] || (o.origen.startsWith('ag:') ? 'Agencia ' + o.origen.slice(3) : o.origen)) + '</td><td>' + fmt(o.telefonos) + '</td></tr>').join('') : '<tr><td colspan="2" class="nota">Sin datos todavía.</td></tr>';
}
$('buscar-codigo').addEventListener('submit', async (e) => {
  e.preventDefault();
  const c = new FormData(e.target).get('codigo');
  const r = await fetch('/admin/api/codigo/' + encodeURIComponent(c));
  const x = await r.json();
  if (x.error) { $('codigo-res').textContent = x.error; return; }
  const vence = new Date(x.vence);
  $('codigo-res').innerHTML = '<p><b>' + esc(x.codigo) + '</b> · plan ' + esc(x.plan) + (x.nota ? ' (' + esc(x.nota) + ')' : '') + ' · ' + (vence > new Date() ? 'vence el ' : 'venció el ') + vence.toLocaleDateString('es-AR') + ' · ' + x.compras + ' compra(s) · ' + (x.telefonos ? 'activo en ' + x.telefonos + ' teléfono(s)' : 'sin teléfono') + '</p>'
    + (x.telefonos ? '<button id="liberar" type="button">Liberar para otro teléfono</button>' : '');
  const b = $('liberar');
  if (b) b.addEventListener('click', async () => {
    const y = await (await fetch('/admin/api/codigo/' + encodeURIComponent(c) + '/liberar', { method: 'POST' })).json();
    $('codigo-res').textContent = y.ok ? 'Listo: el código ' + c + ' quedó libre. Ya lo puede poner en el celular nuevo.' : (y.error || 'No se pudo');
  });
});
$('nueva').addEventListener('submit', async (e) => {
  e.preventDefault();
  const datos = Object.fromEntries(new FormData(e.target));
  const r = await fetch('/admin/api/agencias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) });
  const x = await r.json();
  $('msj').textContent = x.ok ? 'Listo: agencia "' + datos.nombre + '" (código ' + x.codigo + ').' : (x.error || 'No se pudo guardar');
  if (x.ok) { e.target.reset(); cargar(); }
});
cargar().catch((e) => { $('estado').textContent = 'No se pudo cargar: ' + e.message; });
setInterval(() => cargar().catch(() => {}), 60000);
</script></body></html>`;

const FLYER = ({ nombre, localidad, enlace, svg }) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Flyer ${esc(nombre)}</title><style>
@page{size:A4;margin:12mm}*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0b2545;background:#fff}
.hoja{max-width:180mm;margin:0 auto;padding:10mm 8mm;text-align:center;border:3px solid #0b2545;border-radius:16px}
.marca{font-size:34px;font-weight:800;margin:0}.marca span{color:#e63946}
.lema{font-size:20px;margin:6px 0 18px}
.qr{width:95mm;max-width:80vw;margin:0 auto}.qr svg{width:100%;height:auto}
ul{list-style:none;padding:0;margin:16px auto;font-size:17px;text-align:left;display:inline-block}li{margin:6px 0}li::before{content:"✔ ";color:#2a9d8f;font-weight:700}
.agencia{margin-top:14px;padding-top:12px;border-top:2px dashed #0b2545;font-size:18px}.agencia b{font-size:22px}
.chico{font-size:11px;color:#5c677d;margin-top:10px}
.imprimir{display:block;margin:16px auto;padding:12px 18px;font-size:16px;border:0;border-radius:8px;background:#e63946;color:#fff;cursor:pointer}
@media print{.imprimir{display:none}}
</style></head><body>
<button class="imprimir" onclick="window.print()">Imprimir</button>
<div class="hoja">
<p class="marca">Quiniela <span>al Toque</span></p>
<p class="lema">Controlá tus números al instante, desde el celular</p>
<div class="qr">${svg}</div>
<p><b>Escaneá con la cámara del celular</b></p>
<ul><li>Resultados de todas las quinielas apenas salen</li><li>Avisos en el celular con las cabezas</li><li>Controlá tus jugadas y tus números</li><li>Gratis, sin registrarte</li></ul>
<div class="agencia">Te la recomienda<br><b>${esc(nombre)}</b>${localidad ? `<br>${esc(localidad)}` : ''}</div>
<p class="chico">App informativa, no oficial. Los premios se cobran en agencias oficiales. Jugá con responsabilidad. Solo mayores de 18 años.<br>${esc(enlace)}</p>
</div></body></html>`;
