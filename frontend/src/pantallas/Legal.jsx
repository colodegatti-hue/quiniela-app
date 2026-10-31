// Privacidad, términos de uso y juego responsable.
// Escrito para lo que la app hace HOY: si se suman publicidad o cuentas, actualizar.
const ACTUALIZADO = '31 de octubre de 2026';
// Si cambiás este texto, actualizá también public/privacidad.html (la que se enlaza en Google Play)
// Mail de contacto del responsable (vacío = todavía no definido)
export const CONTACTO = 'coloapps.soporte@gmail.com';

export default function Legal() {
  return (
    <section className="pantalla texto">
      <h2>Privacidad y términos</h2>
      <p className="tenue">Última actualización: {ACTUALIZADO}.</p>
      <nav className="indice-legal" aria-label="Secciones">
        <a href="#/legal" onClick={(e) => { e.preventDefault(); document.getElementById('privacidad')?.scrollIntoView(); }}>Privacidad</a>
        <a href="#/legal" onClick={(e) => { e.preventDefault(); document.getElementById('terminos')?.scrollIntoView(); }}>Términos de uso</a>
        <a href="#/legal" onClick={(e) => { e.preventDefault(); document.getElementById('responsable')?.scrollIntoView(); }}>Juego responsable</a>
      </nav>

      <h3 id="privacidad">Política de privacidad</h3>
      <p>
        Quiniela al Toque (de Colo Apps) es una app informativa. No pedimos tu nombre, tu mail ni que crees una cuenta.
        Esto es todo lo que se guarda y para qué:
      </p>
      <ul className="pasos">
        <li>
          <strong>En tu teléfono:</strong> tus jugadas, tus preferencias de avisos y estadísticas, tu código Pro y un
          identificador anónimo del teléfono. Quedan en el almacenamiento del navegador y se borran si borrás los datos
          de la app.
        </li>
        <li>
          <strong>Estadísticas de uso:</strong> una vez por día la app le avisa a nuestro servidor que fue abierta, con el
          identificador anónimo del teléfono, si llegaste por el enlace o QR de una agencia amiga y si sos Pro. Sirve
          para saber cuántas personas usan la app. No incluye tu nombre, tus jugadas ni datos de contacto.
        </li>
        <li>
          <strong>Si activás los avisos:</strong> guardamos en nuestro servidor la dirección de notificaciones que da tu
          navegador, tus preferencias de avisos, una copia de tus jugadas de hoy en adelante (para avisarte si salen) y,
          si sos Pro, tu código. Si desactivás los avisos, se borra esa información.
        </li>
        <li>
          <strong>Si comprás Pro:</strong> el pago lo procesa Mercado Pago. Nosotros no vemos ni guardamos los datos de
          tu tarjeta o cuenta: solo el número de operación, el plan, el monto y el código de 6 números que te damos.
          Para activar el código guardamos el identificador anónimo del teléfono donde se usa (un teléfono por código).
        </li>
        <li>
          <strong>Datos técnicos:</strong> como cualquier sitio, el servidor recibe la dirección IP y el tipo de
          navegador de cada consulta. Los usamos solo para que la app funcione y para frenar abusos, y no los cruzamos
          con nada.
        </li>
        <li>
          <strong>Publicidad:</strong> en la versión gratuita mostramos anuncios de Google AdSense. Google y sus
          socios pueden usar cookies para mostrar anuncios según tus visitas a este y otros sitios. Podés desactivar los
          anuncios personalizados en <span className="seleccionable">adssettings.google.com</span>. Los usuarios Pro no ven
          publicidad.
        </li>
      </ul>
      <p>
        No vendemos ni compartimos tus datos con terceros, salvo los proveedores que hacen funcionar la app
        (alojamiento del servidor y la base de datos, el servicio de notificaciones de tu navegador y Mercado Pago),
        y solo para eso, y Google en el caso de la publicidad, como se explica arriba.
      </p>
      <p>
        Podés pedir que borremos tus datos del servidor desactivando los avisos desde la pantalla Jugadas
        {CONTACTO ? <> o escribiendo a <strong className="seleccionable">{CONTACTO}</strong></> : null}. Tenés los
        derechos que da la Ley 25.326 de Protección de Datos Personales; la Agencia de Acceso a la Información Pública
        es el organismo de control.
      </p>

      <h3 id="terminos">Términos de uso</h3>
      <ol className="pasos">
        <li>
          <strong>App informativa y no oficial.</strong> Mostramos resultados que publican las loterías y otras fuentes
          públicas. No tenemos relación con ninguna lotería, no vendemos jugadas y no pagamos premios.
        </li>
        <li>
          <strong>Los resultados pueden tener errores o demoras.</strong> Antes de cobrar o de tomar una decisión,
          verificá siempre con el extracto oficial de la lotería que corresponda. Los premios que calcula la app son
          estimados.
        </li>
        <li>
          <strong>Las estadísticas no predicen nada.</strong> Cada sorteo es independiente: que un número esté atrasado
          o venga saliendo no cambia sus chances.
        </li>
        <li>
          <strong>Versión Pro.</strong> Es un pago único por 1 mes o 1 año, sin débito automático. El código sirve en
          un teléfono; si cambiás de celular, lo recuperás en la pantalla Pro con el número de operación de Mercado Pago. Si el pago se aprobó y no se activó tu código, o si tenés cualquier problema con la compra,
          {CONTACTO ? <> escribinos a <strong className="seleccionable">{CONTACTO}</strong> y</> : null} lo
          resolvemos. Podés arrepentirte de la compra dentro de los 10 días corridos, como indica la ley de defensa del
          consumidor, desde el <a href="#/arrepentimiento">botón de arrepentimiento</a>.
        </li>
        <li>
          <strong>Uso.</strong> La app es solo para mayores de 18 años. No está permitido usarla para copiar sus datos
          de forma automática ni para intentar dañar el servicio.
        </li>
        <li>
          <strong>Cambios.</strong> Podemos mejorar o cambiar la app y estos términos. La fecha de arriba indica la
          última actualización.
        </li>
      </ol>

      <h3 id="responsable">Juego responsable</h3>
      <p>
        La quiniela es solo para mayores de 18 años. Jugá con plata que no necesites para otra cosa y poné un límite
        antes de empezar. Si sentís que el juego te está trayendo problemas, pedí ayuda: hay líneas gratuitas y
        confidenciales, como la de la Lotería de la Ciudad (<span className="seleccionable">0800-666-6006</span>) y
        el sitio <a href="https://www.juegosegurolegal.gob.ar" target="_blank" rel="noreferrer">juegosegurolegal.gob.ar</a>.
      </p>
    </section>
  );
}
