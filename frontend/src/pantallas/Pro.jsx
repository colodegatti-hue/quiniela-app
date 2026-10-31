import { useEffect, useState } from 'react';
import { usePro, obtenerPlanes, comprar, activarCodigo, compraPendiente, confirmarCompra, fechaVence, olvidarCodigo } from '../util/pro.js';
import { formatoPesos } from '../util/fechas.js';
import { esPlay } from '../util/plataforma.js';

const BENEFICIOS = [
  ['Estadísticas completas', 'Salidores y atrasados de las 7 quinielas, de los últimos 30, 60 y 90 días.'],
  ['Alertas de tus números', 'Te avisamos al instante cuando sale el número que seguís, en cualquier quiniela.'],
];

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// Después de pagar: pregunta unas veces hasta que Mercado Pago confirma
function Confirmacion({ alTerminar }) {
  const [estado, setEstado] = useState('revisando');

  useEffect(() => {
    let vigente = true;
    (async () => {
      for (let i = 0; i < 8 && vigente; i++) {
        try {
          const r = await confirmarCompra();
          if (r !== 'pendiente') { if (vigente) setEstado(r); return; }
        } catch { /* sin conexión: reintentar */ }
        await espera(4000);
      }
      if (vigente) setEstado('pendiente');
    })();
    return () => { vigente = false; };
  }, []);

  const textos = {
    revisando: 'Estamos confirmando tu pago con Mercado Pago…',
    aprobada: '¡Listo! Ya sos Pro.',
    pendiente: 'Tu pago todavía no está acreditado. Cuando se acredite, volvé a esta pantalla y se activa solo.',
    rechazada: 'El pago no se aprobó. No se te cobró nada. Podés probar de nuevo con otro medio de pago.',
    desconocida: 'No encontramos ese pago. Si pagaste, escribinos y lo revisamos.',
  };
  return (
    <section className={`bloque confirmacion ${estado}`} role="status">
      <p>{textos[estado]}</p>
      {estado !== 'revisando' && estado !== 'aprobada' && <button type="button" className="enlace" onClick={alTerminar}>Cerrar</button>}
    </section>
  );
}

function IngresarCodigo() {
  const [codigo, setCodigo] = useState('');
  const [estado, setEstado] = useState({ ocupado: false, error: null });

  async function enviar(e) {
    e.preventDefault();
    if (!/^\d{6}$/.test(codigo)) return setEstado({ ocupado: false, error: 'El código tiene 6 números.' });
    setEstado({ ocupado: true, error: null });
    try {
      const r = await activarCodigo(codigo);
      setEstado({ ocupado: false, error: r.ok ? null : r.error });
    } catch {
      setEstado({ ocupado: false, error: 'No pudimos revisar el código. Revisá tu conexión.' });
    }
  }

  return (
    <section className="bloque">
      <h3>¿Ya tenés un código?</h3>
      <p className="tenue">Si ya tenés un código Pro, ponelo acá. Cada código sirve para un teléfono.</p>
      <form className="alertas-agregar" onSubmit={enviar}>
        <input className="entrada-codigo" inputMode="numeric" maxLength={6} placeholder="000000" value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} aria-label="Código Pro" />
        <button type="submit" className="boton secundario" disabled={estado.ocupado}>{estado.ocupado ? 'Revisando…' : 'Activar'}</button>
      </form>
      {estado.error && <p className="error" role="alert">{estado.error}</p>}
    </section>
  );
}

function Planes({ renovar }) {
  const [planes, setPlanes] = useState(null);
  const [ocupado, setOcupado] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    obtenerPlanes().then(setPlanes).catch(() => setError('No pudimos traer los precios. Revisá tu conexión.'));
  }, []);

  async function pagar(plan) {
    setOcupado(plan);
    setError(null);
    try {
      await comprar(plan); // se va a Mercado Pago
    } catch (e) {
      setError(e.message || 'No se pudo iniciar el pago.');
      setOcupado(null);
    }
  }

  if (error && !planes) return <p className="error">{error}</p>;
  if (!planes) return <p className="nota">Cargando precios…</p>;
  if (!planes.disponible) return <p className="nota">El pago con Mercado Pago se habilita muy pronto.</p>;
  const m = planes.planes.mensual;
  const a = planes.planes.anual;
  const ahorro = Math.round((1 - a.precio / (m.precio * 12)) * 100);

  return (
    <div className="planes">
      <button type="button" className="plan destacado" disabled={Boolean(ocupado)} onClick={() => pagar('anual')}>
        <span className="plan-etiqueta">Ahorrás {ahorro}%</span>
        <span className="plan-nombre">{renovar ? 'Sumar 1 año' : '1 año'}</span>
        <span className="plan-precio">{formatoPesos(a.precio)}</span>
        <span className="plan-detalle">{ocupado === 'anual' ? 'Abriendo Mercado Pago…' : `Sale ${formatoPesos(Math.round(a.precio / 12))} por mes`}</span>
      </button>
      <button type="button" className="plan" disabled={Boolean(ocupado)} onClick={() => pagar('mensual')}>
        <span className="plan-nombre">{renovar ? 'Sumar 1 mes' : '1 mes'}</span>
        <span className="plan-precio">{formatoPesos(m.precio)}</span>
        <span className="plan-detalle">{ocupado === 'mensual' ? 'Abriendo Mercado Pago…' : 'Pago único'}</span>
      </button>
      {error && <p className="error" role="alert">{error}</p>}
      <p className="tenue pie-lista">Pagás una sola vez con Mercado Pago: no hay débito automático. Te damos un código de 6 números que activa Pro.</p>
    </div>
  );
}

export default function Pro() {
  const { pro, datos } = usePro();
  const [confirmando, setConfirmando] = useState(() => Boolean(compraPendiente()));
  const [olvidar, setOlvidar] = useState(false);
  const play = esPlay(); // en la app de Google Play no se vende: solo se activa un código

  return (
    <section className="pantalla">
      <h2>Quiniela Pro</h2>

      {confirmando && <Confirmacion alTerminar={() => setConfirmando(false)} />}

      {pro ? (
        <section className="bloque tarjeta-pro">
          <p className="pro-sello">PRO</p>
          <p>Tu código</p>
          <p className="pro-codigo">{datos.codigo.slice(0, 3)} {datos.codigo.slice(3)}</p>
          <p className="tenue">Vence el {fechaVence(datos.vence)}. Guardalo: es tu comprobante. El código sirve para este teléfono; si cambiás de celular, escribinos y lo pasamos al nuevo.</p>
        </section>
      ) : (
        <>
          <p className="intro-pro">Controlá tus números con más datos y avisos a medida.</p>
          <ul className="beneficios">
            {BENEFICIOS.map(([t, d]) => (
              <li key={t}><strong>{t}</strong><span>{d}</span></li>
            ))}
          </ul>
        </>
      )}

      {datos && !pro && (
        <p className="nota">Tu código {datos.codigo} venció el {fechaVence(datos.vence)}.{play ? '' : ' Si lo renovás, sigue siendo el mismo.'}</p>
      )}

      {!play && (
        <section className="bloque">
          <h3>{datos ? 'Renovar' : 'Hacete Pro'}</h3>
          <Planes renovar={Boolean(datos)} />
        </section>
      )}

      {!datos && <IngresarCodigo />}

      {play && !datos && (
        <p className="nota">¿Todavía no tenés código? Lo conseguís en nuestra web, quinielaaltoque.app.</p>
      )}

      {datos && (
        <p className="nota">
          {olvidar ? (
            <>¿Sacar el código de este teléfono? Lo podés volver a poner cuando quieras. <button type="button" className="enlace peligro" onClick={() => { olvidarCodigo(); setOlvidar(false); }}>Sacar</button> <button type="button" className="enlace" onClick={() => setOlvidar(false)}>No</button></>
          ) : (
            <button type="button" className="enlace" onClick={() => setOlvidar(true)}>Usar otro código en este teléfono</button>
          )}
        </p>
      )}

      <p className="nota">La app es informativa y no es oficial. Los premios se cobran en las agencias oficiales. Jugá con responsabilidad. Solo para mayores de 18 años. <a href="#/legal">Términos y privacidad</a> · <a href="#/arrepentimiento">Botón de arrepentimiento</a>.</p>
    </section>
  );
}
