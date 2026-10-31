// =====================================================================
// mercadopago.js — Conexión con Mercado Pago (Checkout Pro)
// Variable de entorno: MP_ACCESS_TOKEN (Render → Environment)
// =====================================================================
const API = 'https://api.mercadopago.com';

export function mpConfigurado() {
  return Boolean(process.env.MP_ACCESS_TOKEN);
}

async function pedir(ruta, opciones = {}) {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error('Falta MP_ACCESS_TOKEN');
  let r;
  try {
    r = await fetch(`${API}${ruta}`, {
      ...opciones,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...opciones.headers },
      signal: AbortSignal.timeout(20000),
    });
  } catch (e) {
    throw new Error(`No se pudo conectar con Mercado Pago (${e.cause?.code || e.message})`);
  }
  const texto = await r.text();
  let datos;
  try { datos = JSON.parse(texto); } catch { datos = { mensaje: texto.slice(0, 200) }; }
  if (!r.ok) throw new Error(`Mercado Pago respondió ${r.status}: ${datos.message || datos.mensaje || ''}`.trim());
  return datos;
}

// Crea la "preferencia" (el link de pago). Devuelve { id, url }
export async function crearPreferencia({ titulo, precio, referencia, urlVuelta, urlAvisos }) {
  const p = await pedir('/checkout/preferences', {
    method: 'POST',
    headers: { 'X-Idempotency-Key': referencia },
    body: JSON.stringify({
      items: [{ id: 'quiniela-pro', title: titulo, quantity: 1, unit_price: precio, currency_id: 'ARS' }],
      external_reference: referencia,
      back_urls: { success: urlVuelta, pending: urlVuelta, failure: urlVuelta },
      auto_return: 'approved',
      notification_url: urlAvisos,
      statement_descriptor: 'QUINIELA PRO',
      payment_methods: { installments: 1 },
    }),
  });
  // Con credenciales de prueba se usa el link "sandbox"
  const prueba = process.env.MP_ACCESS_TOKEN?.startsWith('TEST-');
  return { id: p.id, url: prueba ? p.sandbox_init_point || p.init_point : p.init_point };
}

// Pagos hechos con una referencia (para confirmar cuando la persona vuelve)
export async function buscarPagos(referencia) {
  const r = await pedir(`/v1/payments/search?external_reference=${encodeURIComponent(referencia)}&sort=date_created&criteria=desc`);
  return r.results ?? [];
}

// Un pago por su número (cuando Mercado Pago avisa)
export async function obtenerPago(id) {
  return pedir(`/v1/payments/${encodeURIComponent(id)}`);
}

// Datos básicos de la cuenta del token (para saber si es de prueba o real)
export async function cuentaMp() {
  const u = await pedir('/users/me');
  const etiquetas = Array.isArray(u.tags) ? u.tags : [];
  return { id: u.id, apodo: u.nickname, pais: u.site_id, esPrueba: etiquetas.includes('test_user') || /^TESTUSER/i.test(u.nickname || '') };
}
