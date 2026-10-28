// Contenido editorial: qué es la quiniela, cómo se juega, cuánto paga y cómo se cobra.
// Los montos de los ejemplos se calculan con las mismas reglas que usa la app.
import { TABLAS_DE_PAGO, evaluarDirecta, evaluarRedoblona } from '../../../shared/premios.js';
import { TURNOS } from '../util/datos.js';
import { formatoPesos } from '../util/fechas.js';

const PAGOS = TABLAS_DE_PAGO.LOTBA;
const LUGARES = [1, 5, 10, 20];
const veces = (n) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 });

// Extracto de ejemplo: Quiniela de la Ciudad, Matutina del 8 de octubre de 2026
const EJEMPLO = ['9179', '4492', '3389', '6210', '5508', '6232', '1042', '3281', '0419', '9120', '9625', '4597', '0283', '4938', '6629', '1916', '3402', '5398', '8612', '1033'];
const ej1 = evaluarDirecta({ numero: '79', desde: 1, hasta: 1, monto: 100 }, EJEMPLO).premio;
const ej2 = evaluarDirecta({ numero: '89', desde: 1, hasta: 5, monto: 100 }, EJEMPLO).premio;
const ej3 = evaluarRedoblona({ numero1: '79', desde1: 1, hasta1: 1, numero2: '32', desde2: 1, hasta2: 5, monto: 100 }, EJEMPLO).premio;

export default function ComoSeJuega() {
  return (
    <section className="pantalla texto">
      <h2>Cómo se juega a la quiniela</h2>

      <h3>Qué es</h3>
      <p>
        La quiniela es un juego de las loterías provinciales. En cada sorteo salen 20 números de cuatro cifras,
        del 0000 al 9999, ordenados del 1 al 20. El primero se llama <strong>la cabeza</strong>. Cada lotería tiene
        su propio sorteo: Ciudad (la ex Nacional), Provincia de Buenos Aires, Santa Fe, Córdoba, Entre Ríos y otras.
      </p>

      <h3>Horarios</h3>
      <p>Hay cinco sorteos por día, de lunes a sábado. Los domingos no se sortea.</p>
      <table className="tabla">
        <thead><tr><th>Turno</th><th>Hora</th></tr></thead>
        <tbody>{TURNOS.map((t) => <tr key={t.id}><td>{t.nombre}</td><td>{t.hora}</td></tr>)}</tbody>
      </table>

      <h3>Cómo se juega</h3>
      <ol className="pasos">
        <li>Elegís un número de 1 a 4 cifras.</li>
        <li>Elegís la ubicación: a la cabeza (solo el primer número), a los 5, a los 10 o a los 20 primeros.</li>
        <li>Elegís la quiniela y el turno, y cuánto querés apostar.</li>
      </ol>
      <p>
        Ganás si tu número coincide con las <strong>últimas cifras</strong> de un número sorteado dentro de la
        ubicación que elegiste. Por ejemplo, si jugaste el 79 a la cabeza y la cabeza fue 9179, ganaste.
      </p>

      <h3>Cuánto paga</h3>
      <p>
        Estas son las veces que se multiplica lo apostado, según la Lotería de la Ciudad. El premio incluye lo que
        apostaste. Cuando jugás a los 5, a los 10 o a los 20, el pago se divide por la cantidad de lugares.
      </p>
      <div className="tabla-scroll">
        <table className="tabla">
          <thead>
            <tr><th>Cifras</th><th>A la cabeza</th><th>A los 5</th><th>A los 10</th><th>A los 20</th></tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4].map((c) => (
              <tr key={c}>
                <td>{c}</td>
                {LUGARES.map((l) => <td key={l}>{veces(PAGOS.directa[c] / l)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>Si el número sale repetido dentro de la ubicación, cobra cada vez que aparece.</p>
      <p>
        Ejemplo con el extracto de la Ciudad del 8 de octubre de 2026 (Matutina), apostando $100:
        el 79 a la cabeza pagaba {formatoPesos(ej1)}, y el 89 a los 5 pagaba {formatoPesos(ej2)}.
      </p>

      <h3>La redoblona</h3>
      <p>
        Son dos números de dos cifras, cada uno con su ubicación, en la misma quiniela. Si sale el primero, lo que
        ganás se juega entero al segundo. Con el mismo extracto, $100 al 79 a la cabeza y al 32 a los 5 pagaban{' '}
        {formatoPesos(ej3)}. La redoblona tiene topes: en general, hasta {veces(PAGOS.topesRedoblona.general)} veces
        lo apostado. La app todavía no controla redoblonas; llega en una próxima versión.
      </p>

      <h3>Cómo se cobra</h3>
      <p>
        El premio se cobra en la agencia donde jugaste, presentando el ticket en buen estado. En la Lotería de la
        Ciudad, los turnos del día se pagan desde el mismo día; la Nocturna, desde el día siguiente (la del sábado,
        desde el lunes). Los premios de más de $2.100.000 se cobran en la sede de la Lotería. Hay un plazo de unos
        30 días para cobrar, que figura en el extracto oficial. Cada lotería tiene sus propias reglas: consultalas
        en tu agencia.
      </p>
      <p>
        Los premios que muestra esta app son estimados. La lotería puede pagar menos si hay muchos ganadores en un
        mismo sorteo (lo que se llama tope de banca).
      </p>

      <h3>Jugá con responsabilidad</h3>
      <p>
        La quiniela es solo para mayores de 18 años. Si sentís que el juego te está trayendo problemas, podés
        llamar gratis a la línea de orientación de la Lotería de la Ciudad: <a href="tel:08006666006">0800-666-6006</a>,
        o entrar a <a href="https://www.juegosegurolegal.gob.ar" target="_blank" rel="noreferrer">juegosegurolegal.gob.ar</a>.
      </p>

      <p className="nota">
        Esta app no vende jugadas ni tiene relación con las loterías. Los resultados son informativos: verificalos
        siempre con el extracto oficial. Fuente de las reglas: reglamento y programación oficial de la Lotería de la
        Ciudad de Buenos Aires (octubre de 2026).
      </p>
      <p className="nota"><a href="#/legal">Privacidad, términos de uso y juego responsable</a> · <a href="#/arrepentimiento">Botón de arrepentimiento</a></p>
    </section>
  );
}
