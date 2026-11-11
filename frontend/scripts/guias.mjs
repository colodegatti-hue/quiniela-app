// =====================================================================
// guias.mjs — Guías escritas: /guias/ y una página por tema.
// Texto propio, pensado para quien busca en Google cómo se juega,
// cuánto paga o cómo controlar la boleta.
// =====================================================================
import { TABLAS_DE_PAGO } from '../../shared/premios.js';
import { QUINIELAS, TURNOS } from '../src/util/datos.js';

const P = TABLAS_DE_PAGO.LOTBA;
const v = (n) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 });
const pesos = (n) => '$' + Math.round(n).toLocaleString('es-AR');

export const GUIAS = [
  {
    slug: 'cuanto-paga',
    titulo: 'Cuánto paga la quiniela: tabla de premios y ejemplos',
    corto: 'Cuánto paga cada apuesta',
    descripcion: 'Cuánto paga la quiniela a la cabeza, a los 5, a los 10 y a los 20, con una, dos, tres o cuatro cifras. Tabla de premios y ejemplos en pesos.',
    cuerpo: () => `
<p>En la quiniela el premio se calcula multiplicando lo que apostaste por un número fijo, que depende de <strong>cuántas cifras</strong> jugaste y en <strong>qué ubicación</strong>. No es un pozo: si acertás, cobrás siempre lo mismo, sin importar cuántas personas hayan jugado ese número.</p>
<h2>La tabla de premios</h2>
<table><thead><tr><th>Cifras</th><th>A la cabeza</th><th>A los 5</th><th>A los 10</th><th>A los 20</th></tr></thead><tbody>
${[1, 2, 3, 4].map((c) => `<tr><th>${c}</th>${[1, 5, 10, 20].map((l) => `<td>${v(P.directa[c] / l)} veces</td>`).join('')}</tr>`).join('')}
</tbody></table>
<p class="tenue">Valores de referencia de la Lotería de la Ciudad. Las demás loterías pagan valores iguales o muy parecidos.</p>
<h2>Por qué a los 5 paga menos que a la cabeza</h2>
<p>Cuando jugás a los 5, a los 10 o a los 20, tu número puede salir en cualquiera de esos lugares, así que tenés más chances. A cambio, lo que apostaste se reparte entre esas ubicaciones: jugar $1.000 a los 5 es como jugar $200 en cada uno de los primeros cinco lugares. Por eso el premio a la cabeza se divide por 5, por 10 o por 20.</p>
<h2>Ejemplos en pesos</h2>
<ul>
<li>$1.000 al <strong>7</strong> (una cifra) a la cabeza: si la cabeza termina en 7, cobrás ${pesos(1000 * P.directa[1])}.</li>
<li>$1.000 al <strong>47</strong> a la cabeza: si sale, por ejemplo, 3547 en el primer lugar, cobrás ${pesos(1000 * P.directa[2])}.</li>
<li>$1.000 al <strong>47</strong> a los 5: si aparece un número terminado en 47 entre los cinco primeros, cobrás ${pesos(1000 * P.directa[2] / 5)}.</li>
<li>$500 al <strong>547</strong> a la cabeza: si la cabeza es 3547, cobrás ${pesos(500 * P.directa[3])}.</li>
<li>$200 al <strong>3547</strong> a la cabeza: si sale exacto, cobrás ${pesos(200 * P.directa[4])}.</li>
</ul>
<h2>Si el número sale dos veces</h2>
<p>Si jugaste a los 5, 10 o 20 y tu número aparece más de una vez dentro de esos lugares, cobrás por cada vez que salió.</p>
<h2>Tope de banca e impuestos</h2>
<p>Cuando muchas personas aciertan el mismo número en un sorteo, la lotería puede aplicar un <strong>tope de banca</strong> y pagar menos de lo que dice la tabla. Además, los premios que superan cierto monto pagan impuesto: la agencia te informa el valor neto al cobrar. Por eso los premios que muestra Quiniela al Toque son siempre estimados.</p>
<p>Si querés jugar dos números juntos, mirá la guía de la <a href="/guias/redoblona/">redoblona</a>.</p>`,
  },
  {
    slug: 'redoblona',
    titulo: 'Qué es la redoblona y cuánto paga',
    corto: 'La redoblona',
    descripcion: 'Qué es la redoblona en la quiniela, cómo se juega con dos números de dos cifras, cuánto paga y cuáles son los topes. Con ejemplos.',
    cuerpo: () => `
<p>La redoblona es una apuesta a <strong>dos números de dos cifras</strong> en el mismo sorteo. Para cobrar tienen que salir los dos, cada uno en la ubicación que elegiste. Es más difícil que una apuesta común, pero paga mucho más.</p>
<h2>Cómo se arma</h2>
<ul>
<li>El <strong>primer número</strong> va a la cabeza, a los 5 o a los 10.</li>
<li>El <strong>segundo número</strong> va a los 5, a los 10 o a los 20.</li>
</ul>
<p>Por ejemplo: el 47 a la cabeza y el 32 a los 5. Ganás si la cabeza termina en 47 y, además, algún número terminado en 32 sale entre los cinco primeros.</p>
<h2>Cuánto paga</h2>
<p>La cuenta se hace en dos pasos. Primero se calcula el premio del primer número como si fuera una apuesta común (${P.redoblona} veces, dividido por la ubicación). Ese resultado se vuelve a apostar al segundo número: otra vez por ${P.redoblona} y dividido por su ubicación.</p>
<ul>
<li>$100 al 47 a la cabeza y al 32 a los 5: $100 × ${P.redoblona} = $7.000; $7.000 ÷ 5 × ${P.redoblona} = <strong>${pesos(100 * P.redoblona / 5 * P.redoblona)}</strong>.</li>
<li>$100 al 47 a los 5 y al 32 a los 10: $100 ÷ 5 × ${P.redoblona} = $1.400; $1.400 ÷ 10 × ${P.redoblona} = <strong>${pesos(100 / 5 * P.redoblona / 10 * P.redoblona)}</strong>.</li>
</ul>
<h2>Los topes</h2>
<p>La redoblona tiene un máximo: en general no paga más de ${v(P.topesRedoblona.general)} veces lo apostado. Si el primer número va a la cabeza y el segundo a los 2 o a los 3, el tope sube a ${v(P.topesRedoblona.cabezaALos2)} y ${v(P.topesRedoblona.cabezaALos3)} veces. Si las dos apuestas son a una sola ubicación cada una, paga ${v(P.redoblonaExacta)} veces.</p>
<p class="tenue">Valores de referencia del reglamento de la Lotería de la Ciudad. Cada lotería puede tener diferencias.</p>
<h2>Controlarla sin hacer cuentas</h2>
<p>En Quiniela al Toque podés cargar tus redoblonas y la app te avisa si salieron, con el premio estimado.</p>`,
  },
  {
    slug: 'horarios',
    titulo: 'Horarios de la quiniela: a qué hora sale cada sorteo',
    corto: 'Horarios de los sorteos',
    descripcion: 'A qué hora sale la quiniela: la Previa, la Primera, la Matutina, la Vespertina y la Nocturna. Días de sorteo, Montevideo y feriados.',
    cuerpo: () => `
<p>La quiniela se sortea de <strong>lunes a sábado</strong>, cinco veces por día. Los domingos no hay sorteos. Los horarios son los mismos para la mayoría de las loterías del país:</p>
<table><thead><tr><th>Sorteo</th><th>Hora</th></tr></thead><tbody>
${TURNOS.map((t) => `<tr><th>${t.nombre}</th><td>${t.hora}</td></tr>`).join('')}
</tbody></table>
<h2>Cuándo se conocen los resultados</h2>
<p>El sorteo dura unos minutos y cada lotería publica su extracto apenas termina. Por lo general, las cabezas se conocen entre 5 y 20 minutos después del horario, y los 20 números completos un poco más tarde. Algunas provincias publican antes que otras.</p>
<h2>Montevideo</h2>
<p>La quiniela de Montevideo (Uruguay) se juega en muchas agencias argentinas, pero tiene otros días: la <strong>Matutina de lunes a viernes</strong> y la <strong>Nocturna de lunes a sábado</strong>. No hay Montevideo en la Previa, la Primera ni la Vespertina, ni en los feriados de Uruguay, como el 2 de noviembre, el 25 de agosto o el Carnaval.</p>
<h2>Feriados en Argentina</h2>
<p>En algunos feriados nacionales las loterías no sortean o hacen menos sorteos. Ante la duda, consultá en tu agencia o fijate en la app: si un sorteo no se hace, no aparece.</p>
<h2>Avisos a horario</h2>
<p>Quiniela al Toque te puede mandar un aviso con las cabezas apenas salen y, si querés, un recordatorio 15 minutos antes de cada sorteo para que no te olvides de jugar.</p>`,
  },
  {
    slug: 'controlar-la-boleta',
    titulo: 'Cómo controlar la boleta de la quiniela',
    corto: 'Cómo controlar tu boleta',
    descripcion: 'Cómo saber si ganaste en la quiniela: qué mirar en la boleta, cómo leer el extracto de 20 números y cómo cobrar un premio.',
    cuerpo: () => `
<p>Controlar la quiniela es más fácil de lo que parece. Solo necesitás tres datos de tu boleta y el extracto del sorteo.</p>
<h2>1. Mirá tu boleta</h2>
<p>En la boleta figuran el <strong>número</strong> que jugaste, la <strong>lotería</strong> (Ciudad, Provincia, Santa Fe, Córdoba…), el <strong>sorteo</strong> (Previa, Primera, Matutina, Vespertina o Nocturna), la <strong>ubicación</strong> (a la cabeza, a los 5, 10 o 20) y el importe.</p>
<h2>2. Buscá el extracto correcto</h2>
<p>Cada lotería tiene su propio sorteo, así que el número tiene que salir en la lotería y en el turno de tu boleta. Un 47 que salió en Córdoba no sirve si jugaste a la Ciudad.</p>
<h2>3. Compará las últimas cifras</h2>
<p>El extracto tiene 20 números de cuatro cifras. Si jugaste dos cifras, mirá los dos últimos números de cada premio. Si jugaste a la cabeza, mirá solo el primero; si jugaste a los 5, los primeros cinco, y así.</p>
<p>Ejemplo: jugaste el 32 a los 10 y en el lugar 7 salió 5832. Ganaste, porque termina en 32 y está dentro de los primeros diez.</p>
<h2>4. Cobrá en la agencia</h2>
<p>Los premios se cobran en las agencias oficiales con la boleta original, dentro del plazo que fija cada lotería. Antes de ir, verificá el resultado con el extracto oficial.</p>
<h2>Dejá que la app controle por vos</h2>
<p>En Quiniela al Toque cargás tu jugada una vez (o la dejás fija para todos los días) y la app la compara sola contra cada sorteo y te avisa si salió, con el premio estimado.</p>`,
  },
  {
    slug: 'quinielas-de-argentina',
    titulo: 'Las quinielas de Argentina: Ciudad, Provincia y todas las provincias',
    corto: 'Las 22 quinielas',
    descripcion: 'Qué quinielas se juegan en Argentina: Ciudad (ex Nacional), Provincia de Buenos Aires, Santa Fe, Córdoba, Entre Ríos, Mendoza, Montevideo y 15 provincias más.',
    cuerpo: () => `
<p>Cada provincia tiene su propia lotería y su propio sorteo de quiniela. En casi todas las agencias se pueden jugar varias, no solo la de tu provincia. Estas son las que sigue Quiniela al Toque:</p>
<h2>Las más jugadas</h2>
<ul>
<li><strong>Ciudad (ex Nacional):</strong> la de la Lotería de la Ciudad de Buenos Aires, que heredó la tradicional Quiniela Nacional. Es la referencia en todo el país.</li>
<li><strong>Provincia de Buenos Aires:</strong> de la Lotería de la Provincia, con sede en La Plata. Junto con la Ciudad, es la más jugada.</li>
<li><strong>Santa Fe, Córdoba, Entre Ríos y Mendoza:</strong> loterías provinciales con mucho público en sus regiones, que también se juegan en otras provincias.</li>
<li><strong>Montevideo:</strong> la quiniela uruguaya, que se ofrece en muchas agencias argentinas. Sortea en la Matutina y la Nocturna, con su propio calendario.</li>
</ul>
<h2>Las provincias</h2>
<p>${QUINIELAS.filter((q) => q.provincial).map((q) => `<a href="/quiniela/${q.id}/">${q.completo}</a>`).join(', ')}. Sortean en horarios parecidos a los de la Ciudad, aunque algunas no tienen todos los turnos.</p>
<h2>¿Cuál conviene jugar?</h2>
<p>Ninguna da más chances que otra: en todas salen 20 números de cuatro cifras y cada número tiene la misma probabilidad. Lo que cambia es la costumbre de cada lugar y, en algunos casos, pequeñas diferencias en los premios. Mucha gente juega el mismo número en varias quinielas a la vez.</p>
<p>Mirá los <a href="/resultados/">resultados de todas las quinielas</a> o elegí una: ${QUINIELAS.filter((q) => !q.provincial).map((q) => `<a href="/quiniela/${q.id}/">${q.nombre}</a>`).join(', ')}.</p>`,
  },
  {
    slug: 'juego-responsable',
    titulo: 'Juego responsable: cómo jugar a la quiniela sin que sea un problema',
    corto: 'Juego responsable',
    descripcion: 'Consejos para jugar a la quiniela con responsabilidad, señales de alerta y dónde pedir ayuda gratis en Argentina.',
    cuerpo: () => `
<p>La quiniela es un juego de azar: es entretenido, pero no es una forma de ganar plata. A la larga, la lotería siempre paga menos de lo que se juega. Jugar con responsabilidad es disfrutarla sin que te traiga problemas.</p>
<h2>Algunos consejos</h2>
<ul>
<li>Jugá solo plata que no necesites para otra cosa y poné un límite por semana.</li>
<li>No juegues para recuperar lo que perdiste.</li>
<li>Ningún sistema, sueño ni estadística aumenta tus chances: cada sorteo es independiente.</li>
<li>La quiniela es solo para mayores de 18 años.</li>
</ul>
<h2>Señales de alerta</h2>
<p>Si jugás más de lo que planeabas, si pedís plata prestada para jugar, si lo escondés a tu familia o si te pone de mal humor no poder jugar, puede ser momento de pedir ayuda.</p>
<h2>Dónde pedir ayuda</h2>
<p>Hay líneas gratuitas y confidenciales, como la de la Lotería de la Ciudad de Buenos Aires: <strong>0800-666-6006</strong>. También podés consultar en <a href="https://www.juegosegurolegal.gob.ar">juegosegurolegal.gob.ar</a> y en los programas de juego responsable de cada lotería provincial.</p>
<h2>Cómo te ayuda la app</h2>
<p>Quiniela al Toque no vende jugadas: sirve para ver resultados y controlar lo que ya jugaste. Si cargás el monto de tus jugadas, vas a ver cuánto jugaste en total.</p>`,
  },
];

export function paginasDeGuias({ pagina, esc, cta, menu }) {
  const otras = (slug) => `<h2>Otras guías</h2><p>${[{ slug: '../como-jugar', corto: 'Cómo se juega' }, ...GUIAS].filter((g) => g.slug !== slug).map((g) => `<a class="chip" href="/guias/${g.slug}/">${esc(g.corto)}</a>`).join(' ').replaceAll('/guias/../como-jugar/', '/como-jugar/')}</p>`;
  const paginas = GUIAS.map((g) => ({
    ruta: `/guias/${g.slug}/`,
    html: pagina({
      titulo: g.titulo,
      descripcion: g.descripcion,
      ruta: `/guias/${g.slug}/`,
      anuncios: true,
      cuerpo: `<p class="ruta"><a href="/">Inicio</a> › <a href="/guias/">Guías</a> › ${esc(g.corto)}</p><h1>${esc(g.titulo)}</h1>${g.cuerpo()}${cta()}${otras(g.slug)}${menu}`,
    }),
  }));
  paginas.push({
    ruta: '/guias/',
    html: pagina({
      titulo: 'Guías de la quiniela: cómo se juega, premios, horarios y más',
      descripcion: 'Guías simples para jugar y controlar la quiniela: cómo se juega, cuánto paga, la redoblona, los horarios, cómo controlar la boleta y juego responsable.',
      ruta: '/guias/',
      anuncios: true,
      cuerpo: `<p class="ruta"><a href="/">Inicio</a> › Guías</p><h1>Guías de la quiniela</h1>
<p>Todo lo que necesitás saber para jugar y controlar la quiniela, explicado simple y con ejemplos.</p>
<ul class="lista-guias"><li><a href="/como-jugar/"><b>Cómo se juega a la quiniela</b></a><br><span class="tenue">Qué es la cabeza, las ubicaciones y cómo se cobra.</span></li>
${GUIAS.map((g) => `<li><a href="/guias/${g.slug}/"><b>${esc(g.titulo)}</b></a><br><span class="tenue">${esc(g.descripcion)}</span></li>`).join('')}</ul>
${cta()}${menu}`,
    }),
  });
  return paginas;
}
