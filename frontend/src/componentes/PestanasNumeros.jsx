// Pestañas de la sección "Números": Estadísticas y Sueños
export default function PestanasNumeros({ actual }) {
  return (
    <div className="pestanas" role="tablist" aria-label="Números">
      <a href="#/estadisticas" role="tab" aria-selected={actual === 'estadisticas'} className={actual === 'estadisticas' ? 'activa' : undefined}>Estadísticas</a>
      <a href="#/suenos" role="tab" aria-selected={actual === 'suenos'} className={actual === 'suenos' ? 'activa' : undefined}>Sueños</a>
    </div>
  );
}
