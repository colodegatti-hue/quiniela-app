// =====================================================================
// paginas.mjs — Páginas para Google (HTML común, sin JavaScript)
// Se corre después de "vite build": trae los resultados del servidor y
// arma en dist/:
//   /resultados/                    índice de días
//   /resultados/AAAA-MM-DD/         resultados de ese día (las 22 quinielas)
//   /quiniela/<id>/                 última semana de esa quiniela
//   /sitemap.xml y /robots.txt
// Si el servidor no responde, no frena el build (la app sigue igual).
// =====================================================================
import { mkdir, writeFile } from 'node:fs/promises';
import { QUINIELAS, TURNOS } from '../src/util/datos.js';
import { suenoDe } from '../../shared/suenos.js';

const SITIO = 'https://quinielaaltoque.app';
const API = (process.env.VITE_API_URL || 'https://api.quinielaaltoque.app').replace(/\/$/, '');
const DIAS = Number(process.env.PAGINAS_DIAS || 45);
const SALIDA = new URL('../dist/', import.meta.url);

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dia = (f) => new Date(`${f}T12:00:00Z`);
const fechaLarga = (f) => { const d = dia(f); return `${DIAS_SEMANA[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`; };
const fechaCorta = (f) => { const [a, m, d] = f.split('-'); return `${Number(d)}/${Number(m)}/${a}`; };

function hoyArgentina() {
  return new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
}

function ultimosDias(n) {
  const r = [];
  const d = dia(hoyArgentina());
  while (r.length < n) {
    if (d.getUTCDay() !== 0) r.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return r;
}

async function traer(fecha) {
  const r = await fetch(`${API}/api/resultados?fecha=${fecha}`, { signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

const ESTILO = `
:root{--fondo:#eef2ef;--sup:#fff;--tinta:#14261e;--tenue:#5b6d64;--verde:#0e5a3c;--rojo:#c21d2e;--linea:#d3ddd7}
@media (prefers-color-scheme:dark){:root{--fondo:#0e1813;--sup:#16231d;--tinta:#e5eee9;--tenue:#9cb0a6;--verde:#4fb487;--rojo:#ff6470;--linea:#2a3a32}}
*{box-sizing:border-box}body{margin:0;background:var(--fondo);color:var(--tinta);font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
header{background:#0e5a3c;color:#fff;padding:12px 16px}header a{color:#fff;text-decoration:none;font-weight:800;font-size:20px}header span{color:#ffe27a}
main{max-width:860px;margin:0 auto;padding:12px 16px 40px}h1{font-size:24px;line-height:1.25}h2{font-size:19px;margin:24px 0 8px}
.cta{display:block;text-align:center;background:var(--rojo);color:#fff;text-decoration:none;font-weight:700;padding:12px;border-radius:12px;margin:14px 0}
table{border-collapse:collapse;width:100%;background:var(--sup);border-radius:12px;overflow:hidden}th,td{padding:7px 8px;border-bottom:1px solid var(--linea);text-align:left}
th{font-size:13px;color:var(--tenue)}td.n{font-weight:700;color:var(--rojo);font-variant-numeric:tabular-nums}th a{color:inherit}
.scroll{overflow-x:auto}details{background:var(--sup);border-radius:12px;padding:8px 12px;margin:8px 0}summary{cursor:pointer;font-weight:600}
ol.ext{columns:2;margin:8px 0;padding-left:26px;font-variant-numeric:tabular-nums}nav.dias a,nav.q a{display:inline-block;margin:3px 6px 3px 0;color:var(--verde)}
.tenue{color:var(--tenue);font-size:14px}footer{max-width:860px;margin:0 auto;padding:0 16px 30px;color:var(--tenue);font-size:13px}`;

function pagina({ titulo, descripcion, ruta, cuerpo }) {
  return `<!doctype html>
<html lang="es-AR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descripcion)}">
<link rel="canonical" href="${SITIO}${ruta}">
<meta name="theme-color" content="#0E5A3C">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(descripcion)}">
<meta property="og:url" content="${SITIO}${ruta}">
<meta property="og:type" content="website">
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7263397471173227" crossorigin="anonymous"></script>
<style>${ESTILO}</style>
</head>
<body>
<header><a href="/">Quiniela <span>al Toque</span></a></header>
<main>
${cuerpo}
</main>
<footer>Resultados informativos, no oficiales: antes de cobrar, verificá con el extracto oficial de cada lotería. Jugá con responsabilidad. Solo mayores de 18 años. <a href="/privacidad.html">Privacidad</a>.</footer>
</body>
</html>`;
}

const CTA = '<a class="cta" href="/">Abrí la app: resultados al instante y avisos en tu celular</a>';

function tablaCabezas(datos) {
  const filas = QUINIELAS.map((q) => {
    const celdas = TURNOS.map((t) => {
      const n = datos.turnos?.find((x) => x.turno === t.id)?.quinielas?.[q.id]?.numeros?.[0];
      return `<td class="n">${n && /^\d{4}$/.test(n) ? n : '—'}</td>`;
    }).join('');
    return `<tr><th scope="row"><a href="/quiniela/${q.id}/">${esc(q.nombre)}</a></th>${celdas}</tr>`;
  });
  const hayAlgo = QUINIELAS.some((q) => TURNOS.some((t) => datos.turnos?.find((x) => x.turno === t.id)?.quinielas?.[q.id]));
  if (!hayAlgo) return '<p>Todavía no hay resultados de este día.</p>';
  return `<div class="scroll"><table><thead><tr><th>Quiniela</th>${TURNOS.map((t) => `<th>${esc(t.nombre)}<br>${t.hora}</th>`).join('')}</tr></thead><tbody>${filas.join('')}</tbody></table></div>`;
}

function extractos(datos) {
  return TURNOS.map((t) => {
    const turno = datos.turnos?.find((x) => x.turno === t.id);
    if (!turno) return '';
    const bloques = QUINIELAS.filter((q) => turno.quinielas?.[q.id] && !turno.quinielas[q.id].parcial).map((q) => {
      const nums = turno.quinielas[q.id].numeros;
      const s = suenoDe(nums[0]);
      return `<details><summary>${esc(q.completo)}: cabeza ${nums[0]}${s ? ` (${esc(s.nombre)})` : ''}</summary><ol class="ext">${nums.map((n) => `<li>${n}</li>`).join('')}</ol></details>`;
    });
    if (!bloques.length) return '';
    return `<h2>${esc(t.nombre)} (${t.hora}): los 20 números</h2>${bloques.join('')}`;
  }).join('');
}

async function escribir(ruta, html) {
  const carpeta = new URL(`.${ruta}`, SALIDA);
  await mkdir(carpeta, { recursive: true });
  await writeFile(new URL('index.html', carpeta), html);
}

async function principal() {
  const dias = ultimosDias(DIAS);
  const porDia = {};
  for (const f of dias) {
    try { porDia[f] = await traer(f); } catch (e) { console.warn(`[páginas] ${f}: ${e.message}`); }
  }
  const conDatos = dias.filter((f) => porDia[f]);
  if (!conDatos.length) { console.warn('[páginas] el servidor no respondió: no se generan páginas'); return; }
  const hoy = hoyArgentina();
  const urls = ['/', '/resultados/'];

  // Un día
  for (const [i, f] of conDatos.entries()) {
    const esHoy = f === hoy;
    const titulo = `Quiniela ${esHoy ? 'de hoy, ' : ''}${fechaLarga(f)}: resultados`;
    const anterior = conDatos[i + 1];
    const siguiente = conDatos[i - 1];
    const cuerpo = `<h1>${esc(titulo)}</h1>
<p>Cabezas de la Previa, Primera, Matutina, Vespertina y Nocturna de las 22 quinielas: Ciudad, Provincia de Buenos Aires, Santa Fe, Córdoba, Entre Ríos, Mendoza, Montevideo y 15 provincias más.${esHoy ? ' Esta página se actualiza durante el día; en la app los ves apenas salen.' : ''}</p>
${CTA}
${tablaCabezas(porDia[f])}
${extractos(porDia[f])}
<p>${anterior ? `<a href="/resultados/${anterior}/">← ${fechaCorta(anterior)}</a>` : ''} ${siguiente ? ` · <a href="/resultados/${siguiente}/">${fechaCorta(siguiente)} →</a>` : ''} · <a href="/resultados/">Todos los días</a></p>`;
    await escribir(`/resultados/${f}/`, pagina({ titulo, descripcion: `Resultados de la quiniela del ${fechaLarga(f)}: cabezas y los 20 números de Ciudad, Provincia, Santa Fe, Córdoba y 18 quinielas más.`, ruta: `/resultados/${f}/`, cuerpo }));
    urls.push(`/resultados/${f}/`);
  }

  // Índice de días
  await escribir('/resultados/', pagina({
    titulo: 'Resultados de la quiniela: últimos días',
    descripcion: 'Resultados de la quiniela de los últimos días: Ciudad, Provincia, Santa Fe, Córdoba, Entre Ríos, Mendoza, Montevideo y 15 provincias más.',
    ruta: '/resultados/',
    cuerpo: `<h1>Resultados de la quiniela</h1>${CTA}<nav class="dias">${conDatos.map((f) => `<a href="/resultados/${f}/">${f === hoy ? 'Hoy, ' : ''}${fechaLarga(f)}</a>`).join('<br>')}</nav>
<h2>Por quiniela</h2><nav class="q">${QUINIELAS.map((q) => `<a href="/quiniela/${q.id}/">${esc(q.completo)}</a>`).join('')}</nav>`,
  }));

  // Una quiniela: última semana
  const semana = conDatos.slice(0, 7);
  for (const q of QUINIELAS) {
    const filas = semana.map((f) => {
      const celdas = TURNOS.map((t) => {
        const n = porDia[f].turnos?.find((x) => x.turno === t.id)?.quinielas?.[q.id]?.numeros?.[0];
        return `<td class="n">${n && /^\d{4}$/.test(n) ? n : '—'}</td>`;
      }).join('');
      return `<tr><th scope="row"><a href="/resultados/${f}/">${fechaCorta(f)}</a></th>${celdas}</tr>`;
    }).join('');
    const titulo = `Quiniela de ${q.completo}: resultados de hoy y de la semana`;
    await escribir(`/quiniela/${q.id}/`, pagina({
      titulo,
      descripcion: `Cabezas de la quiniela de ${q.completo} de los últimos días: Previa, Primera, Matutina, Vespertina y Nocturna.`,
      ruta: `/quiniela/${q.id}/`,
      cuerpo: `<h1>${esc(titulo)}</h1>${CTA}<div class="scroll"><table><thead><tr><th>Día</th>${TURNOS.map((t) => `<th>${esc(t.nombre)}</th>`).join('')}</tr></thead><tbody>${filas}</tbody></table></div>
<p class="tenue">En la app ves los 20 números, controlás tus jugadas y te avisamos apenas sale cada sorteo.</p><p><a href="/resultados/">Resultados por día</a></p>`,
    }));
    urls.push(`/quiniela/${q.id}/`);
  }

  // Sitemap y robots
  const ahora = new Date().toISOString();
  await writeFile(new URL('sitemap.xml', SALIDA), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${SITIO}${u}</loc><lastmod>${ahora}</lastmod></url>`).join('\n')}\n</urlset>\n`);
  await writeFile(new URL('robots.txt', SALIDA), `User-agent: *\nAllow: /\nSitemap: ${SITIO}/sitemap.xml\n`);
  console.log(`[páginas] ${urls.length} páginas generadas`);
}

principal().catch((e) => { console.warn('[páginas] error (no frena el build):', e.message); });
