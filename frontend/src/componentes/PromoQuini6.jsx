// Tarjeta que recomienda la otra app de Colo Apps: Quini 6 Todo en uno.
// ir.html de esa app manda a Google Play en Android y a la web en el resto.

export const ENLACE_QUINI6 = 'https://quini6-tau.vercel.app/ir.html';

export default function PromoQuini6() {
  return (
    <aside className="bloque promo-quini6">
      <span className="promo-dibujo" aria-hidden="true">🍀</span>
      <div>
        <h3>¿Jugás al Quini 6?</h3>
        <p className="tenue">Controlá tu boleta al toque con nuestra app gratis.</p>
        <a
          className="boton"
          href={ENLACE_QUINI6}
          target="_blank"
          rel="noreferrer"
        >
          Abrir Quini 6
        </a>
      </div>
    </aside>
  );
}
