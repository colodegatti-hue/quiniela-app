// Recuadro que invita a hacerse Pro cuando algo está bloqueado
export default function CandadoPro({ titulo, texto }) {
  return (
    <section className="bloque candado-pro">
      <p className="pro-sello chico">PRO</p>
      <h3>{titulo}</h3>
      <p className="tenue">{texto}</p>
      <a className="boton" href="#/pro">Ver Quiniela Pro</a>
    </section>
  );
}
