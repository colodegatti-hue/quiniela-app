// =====================================================================
// numeros.mjs — Páginas /numeros/ y /numeros/NN/ (00 al 99)
// Cada página junta el significado tradicional del número con datos
// reales del último año (las 7 quinielas principales), así el texto
// cambia según cómo viene saliendo cada número.
// =====================================================================
import { SUENOS } from '../../shared/suenos.js';
import { TABLAS_DE_PAGO } from '../../shared/premios.js';
import { QUINIELAS, TURNOS } from '../src/util/datos.js';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const fechaLinda = (f) => { const d = new Date(`${f}T12:00:00Z`); return `${DIAS_SEMANA[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`; };
const miles = (n) => n.toLocaleString('es-AR');
const nombreQ = (id) => QUINIELAS.find((q) => q.id === id)?.nombre ?? id;
const nombreT = (id) => TURNOS.find((t) => t.id === id)?.nombre ?? id;
// "Los huevos" -> "los huevos", pero "San Cono" queda igual
const minuscula = (s) => (/^(San|Santa|Cristo|Jes)/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));
const diasEntre = (a, b) => Math.round((new Date(`${b}T12:00:00Z`) - new Date(`${a}T12:00:00Z`)) / 864e5);

// Frase sobre cómo viene saliendo, comparado con lo esperable por azar
function fraseFrecuencia(x, esperado, puesto) {
  const dif = esperado ? Math.round(((x.cabezas - esperado) / esperado) * 100) : 0;
  if (dif >= 15) return `Salió <strong>bastante más de lo esperable</strong>: un ${dif}% por encima. Está en el puesto ${puesto} de 100 entre los que más salieron a la cabeza.`;
  if (dif >= 5) return `Salió <strong>un poco más de lo esperable</strong> (${dif}% arriba) y está en el puesto ${puesto} de 100.`;
  if (dif <= -15) return `Salió <strong>bastante menos de lo esperable</strong>: un ${Math.abs(dif)}% por debajo. Está en el puesto ${puesto} de 100, entre los que menos salieron a la cabeza.`;
  if (dif <= -5) return `Salió <strong>un poco menos de lo esperable</strong> (${Math.abs(dif)}% abajo) y está en el puesto ${puesto} de 100.`;
  return `Salió <strong>prácticamente lo esperable</strong> y está en el puesto ${puesto} de 100.`;
}

function fraseUltima(x, hoy) {
  const u = x.ultimaCabeza;
  if (!u) return 'En el último año no salió a la cabeza en las quinielas principales.';
  const d = diasEntre(u.fecha, hoy);
  const cuando = d <= 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} días`;
  return `La última vez que salió a la cabeza fue ${cuando}, el ${fechaLinda(u.fecha)}, en la ${nombreT(u.turno)} de ${nombreQ(u.quiniela)}.`;
}

function fraseQuinielas(x) {
  const top = x.quinielas.slice(0, 3);
  if (!top.length) return '';
  const lista = top.map((q, i) => (i === 0 ? `<strong>${nombreQ(q.quiniela)} (${q.cabezas})</strong>` : `${nombreQ(q.quiniela)} (${q.cabezas})`));
  const texto = lista.length > 1 ? `${lista.slice(0, -1).join(', ')} y ${lista.at(-1)}` : lista[0];
  return `Donde más salió a la cabeza fue en ${texto}.`;
}

export function paginasDeNumeros({ resumen, hoy, pagina, esc, cta, menu }) {
  const paginas = [];
  const P = TABLAS_DE_PAGO.LOTBA.directa[2];
  const datos = new Map((resumen?.numeros || []).map((x) => [x.n, x]));
  const esperado = resumen ? resumen.sorteos / 100 : 0;
  const ranking = [...datos.values()].sort((a, b) => b.cabezas - a.cabezas).map((x) => x.n);

  for (const s of SUENOS) {
    const x = datos.get(s.n);
    const invertido = s.n.split('').reverse().join('');
    const vecinos = [String((Number(s.n) + 99) % 100).padStart(2, '0'), String((Number(s.n) + 1) % 100).padStart(2, '0')];
    const relacionados = [...new Set([invertido, ...vecinos])].filter((n) => n !== s.n)
      .map((n) => SUENOS.find((y) => y.n === n))
      .map((y) => `<a class="chip" href="/numeros/${y.n}/">${y.n} ${esc(y.nombre)}</a>`).join(' ');
    const titulo = `El ${s.n} en la quiniela: ${minuscula(s.nombre)}. Significado y cuántas veces salió`;
    const estadisticas = x ? `
<h2>Qué tan seguido sale el ${s.n}</h2>
<div class="cifras"><div><b>${miles(x.cabezas)}</b><span>a la cabeza</span></div><div><b>${miles(x.en20)}</b><span>en los 20</span></div><div><b>${x.ultimaCabeza ? x.ultimaCabeza.fecha.slice(8, 10) + '/' + x.ultimaCabeza.fecha.slice(5, 7) : '—'}</b><span>última cabeza</span></div></div>
<p>En los últimos 12 meses, sumando las quinielas de Ciudad, Provincia, Santa Fe, Córdoba, Entre Ríos, Mendoza y Montevideo, hubo ${miles(resumen.sorteos)} sorteos. El ${s.n} salió <strong>${miles(x.cabezas)} veces a la cabeza</strong>; por puro azar se esperaban unas ${miles(Math.round(esperado))}. ${fraseFrecuencia(x, esperado, ranking.indexOf(s.n) + 1)}</p>
<p>${fraseUltima(x, hoy)} ${fraseQuinielas(x)} Entre los 20 números de cada sorteo apareció ${miles(x.en20)} veces.</p>
<p class="tenue">Que un número haya salido más o menos no cambia sus chances en el próximo sorteo: en cada sorteo todos los números tienen la misma probabilidad (1 en 100 de salir a la cabeza con dos cifras). Datos actualizados al ${fechaLinda(hoy)}.</p>` : '';

    const cuerpo = `<p class="ruta"><a href="/">Inicio</a> › <a href="/numeros/">Números</a> › ${s.n}</p>
<div class="numero-cab"><span class="n-grande">${s.n}</span><span class="n-dibujo" aria-hidden="true">${esc(s.dibujo)}</span><h1>${esc(titulo)}</h1></div>
<h2>Qué significa el ${s.n}</h2>
<p>En la tabla tradicional de la quiniela, el ${s.n} es <strong>${esc(minuscula(s.nombre))}</strong>. Según la costumbre popular, se juega cuando soñás con ${esc(s.sonar)}.</p>
<p>Es una tradición que se transmite de generación en generación en las agencias de todo el país: no hace que el número tenga más chances, pero es una forma divertida de elegir qué jugar.</p>
${estadisticas}
<h2>Cómo jugar el ${s.n}</h2>
<p>Con dos cifras, el ${s.n} gana si los dos últimos números de algún premio terminan en ${s.n} dentro de la ubicación que elijas. Por ejemplo, un 47${s.n} a la cabeza.</p>
<ul><li><strong>A la cabeza</strong> paga ${P} veces lo apostado: con $1.000 cobrás $${miles(P * 1000)}.</li>
<li><strong>A los 5</strong> paga ${P / 5} veces, <strong>a los 10</strong> ${P / 10} veces y <strong>a los 20</strong> ${(P / 20).toLocaleString('es-AR')} veces.</li></ul>
<p class="tenue">Valores de referencia de la Lotería de la Ciudad. Ver <a href="/guias/cuanto-paga/">cuánto paga la quiniela</a>.</p>
${cta(`Avisame cuando salga el ${s.n}`)}
<h2>Números relacionados</h2>
<p>${relacionados}</p>
<p><a href="/numeros/${vecinos[0]}/">← El ${vecinos[0]}</a> · <a href="/numeros/">Los 100 números</a> · <a href="/numeros/${vecinos[1]}/">El ${vecinos[1]} →</a></p>
${menu}`;
    paginas.push({
      ruta: `/numeros/${s.n}/`,
      html: pagina({
        titulo: `El ${s.n} en la quiniela: ${minuscula(s.nombre)} | Quiniela al Toque`,
        descripcion: `Qué significa el ${s.n} en la quiniela (${minuscula(s.nombre)}), qué sueños se juegan a ese número y cuántas veces salió a la cabeza en el último año.`,
        ruta: `/numeros/${s.n}/`,
        cuerpo,
        anuncios: true,
      }),
    });
  }

  // Índice
  const mas = ranking.slice(0, 5).map((n) => `<a href="/numeros/${n}/">${n}</a>`).join(', ');
  const menos = ranking.slice(-5).reverse().map((n) => `<a href="/numeros/${n}/">${n}</a>`).join(', ');
  paginas.push({
    ruta: '/numeros/',
    html: pagina({
      titulo: 'Los números de la quiniela del 00 al 99: significado y estadísticas',
      descripcion: 'Los 100 números de la quiniela: qué significa cada uno, qué sueños se juegan y cuántas veces salió a la cabeza en el último año.',
      ruta: '/numeros/',
      anuncios: true,
      cuerpo: `<p class="ruta"><a href="/">Inicio</a> › Números</p>
<h1>Los números de la quiniela, del 00 al 99</h1>
<p>Cada número de dos cifras tiene su significado en la tabla tradicional de la quiniela y su propia historia de sorteos. Entrá a cualquiera para ver qué sueños se le juegan, cuántas veces salió a la cabeza en el último año, cuándo fue la última vez y en qué quinielas sale más.</p>
${resumen ? `<p>En los últimos 12 meses los que más salieron a la cabeza en las quinielas principales fueron ${mas}; los que menos, ${menos}. Recordá que eso no cambia lo que puede pasar en el próximo sorteo.</p>` : ''}
<ul class="grilla">${SUENOS.map((s) => `<li><a href="/numeros/${s.n}/"><b>${s.n}</b> ${esc(s.dibujo)} ${esc(s.nombre)}</a></li>`).join('')}</ul>
${cta()}
${menu}`,
    }),
  });
  return paginas;
}
