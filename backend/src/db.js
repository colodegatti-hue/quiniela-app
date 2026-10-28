// =====================================================================
// db.js — Conexión a la base (Neon / PostgreSQL)
// El servidor es el ÚNICO que habla con la base.
// =====================================================================
import pg from 'pg';

let pool = null;

export function conectar(urlBase = process.env.DATABASE_URL) {
  if (!urlBase) throw new Error('Falta la variable DATABASE_URL');
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(urlBase);
  pool = new pg.Pool({
    connectionString: urlBase,
    ssl: local ? false : { rejectUnauthorized: true },
    max: 3,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 20000, // Neon puede tardar en "despertar"
  });
  pool.on('error', (e) => console.error('[db] error de conexión:', e.message));
  return pool;
}

export async function cerrar() {
  if (pool) await pool.end();
  pool = null;
}

function db() {
  if (!pool) throw new Error('La base no está conectada');
  return pool;
}

// Último número de sorteo oficial guardado
export async function ultimoNumeroLotba() {
  const r = await db().query('select max(numero) as n from sorteos');
  return r.rows[0].n === null ? null : Number(r.rows[0].n);
}

// Sorteos guardados de una fecha: { turno: fuente }
export async function sorteosDeFecha(fecha) {
  const r = await db().query('select turno, fuente from sorteos where fecha = $1', [fecha]);
  return Object.fromEntries(r.rows.map((x) => [x.turno, x.fuente]));
}

// Guarda (o actualiza) un sorteo con sus extractos.
// Regla: el respaldo nunca pisa un dato oficial de la Lotería.
// Devuelve 'nuevo', 'actualizado' u 'omitido'.
export async function guardarSorteo(sorteo) {
  const cliente = await db().connect();
  try {
    await cliente.query('begin');
    const previo = await cliente.query(
      'select fuente from sorteos where fecha = $1 and turno = $2 for update',
      [sorteo.fecha, sorteo.turno],
    );
    const existe = previo.rowCount > 0;
    if (existe && previo.rows[0].fuente === 'lotba' && sorteo.fuente !== 'lotba') {
      await cliente.query('rollback');
      return 'omitido';
    }

    if (existe) {
      await cliente.query(
        `update sorteos set numero = coalesce($3, numero), fuente = $4, actualizado_en = now()
         where fecha = $1 and turno = $2`,
        [sorteo.fecha, sorteo.turno, sorteo.numero, sorteo.fuente],
      );
    } else {
      await cliente.query(
        'insert into sorteos (fecha, turno, numero, fuente) values ($1, $2, $3, $4)',
        [sorteo.fecha, sorteo.turno, sorteo.numero, sorteo.fuente],
      );
    }

    for (const e of sorteo.extractos) {
      await cliente.query(
        `insert into extractos (fecha, turno, quiniela, numeros, letras)
         values ($1, $2, $3, $4, $5)
         on conflict (fecha, turno, quiniela)
         do update set numeros = excluded.numeros, letras = coalesce(excluded.letras, extractos.letras)`,
        [sorteo.fecha, sorteo.turno, e.quiniela, e.numeros, e.letras],
      );
    }
    await cliente.query('commit');
    return existe ? 'actualizado' : 'nuevo';
  } catch (e) {
    await cliente.query('rollback').catch(() => {});
    throw e;
  } finally {
    cliente.release();
  }
}

// Agrega UNA quiniela que llegó de su lotería oficial (p. ej. Provincia desde loteria.gba.gob.ar).
// Si el sorteo todavía no existe lo crea (sin número, fuente 'provincia'). No pisa una quiniela ya guardada.
// Devuelve 'nuevo' (creó el sorteo), 'agregado' u 'omitido'.
export async function agregarExtracto(fecha, turno, extracto, fuente = 'provincia') {
  const cliente = await db().connect();
  try {
    await cliente.query('begin');
    const previo = await cliente.query('select 1 from sorteos where fecha = $1 and turno = $2 for update', [fecha, turno]);
    if (!previo.rowCount) {
      await cliente.query('insert into sorteos (fecha, turno, numero, fuente) values ($1, $2, null, $3)', [fecha, turno, fuente]);
    }
    const r = await cliente.query(
      `insert into extractos (fecha, turno, quiniela, numeros, letras) values ($1, $2, $3, $4, $5)
       on conflict (fecha, turno, quiniela) do nothing`,
      [fecha, turno, extracto.quiniela, extracto.numeros, extracto.letras ?? null],
    );
    await cliente.query('commit');
    if (!r.rowCount) return 'omitido';
    return previo.rowCount ? 'agregado' : 'nuevo';
  } catch (e) {
    await cliente.query('rollback').catch(() => {});
    throw e;
  } finally {
    cliente.release();
  }
}

// Anota la PRIMERA vez que una fuente mostró un resultado (no pisa)
export async function registrarPublicacion(fecha, turno, fuente, minutosDemora) {
  await db().query(
    `insert into publicaciones (fecha, turno, fuente, minutos_demora)
     values ($1, $2, $3, $4) on conflict do nothing`,
    [fecha, turno, fuente, minutosDemora],
  );
}

// Quinielas guardadas de cada sorteo de una fecha (para saber si alguno quedó incompleto)
export async function quinielasDeFecha(fecha) {
  const r = await db().query(
    `select s.turno, s.numero, s.fuente, array_agg(e.quiniela order by e.quiniela) as quinielas
     from sorteos s join extractos e using (fecha, turno)
     where s.fecha = $1 group by s.turno, s.numero, s.fuente`,
    [fecha],
  );
  return r.rows.map((x) => ({ turno: x.turno, numero: x.numero === null ? null : Number(x.numero), fuente: x.fuente, quinielas: x.quinielas }));
}

// Fuentes que ya tienen registrada la publicación de una fecha: Set("turno|fuente")
export async function publicacionesDeFecha(fecha) {
  const r = await db().query('select turno, fuente from publicaciones where fecha = $1', [fecha]);
  return new Set(r.rows.map((x) => `${x.turno}|${x.fuente}`));
}

// Todos los resultados de una fecha, agrupados por turno
export async function resultadosDeFecha(fecha) {
  const r = await db().query(
    `select s.turno, s.numero, s.fuente, e.quiniela, e.numeros, e.letras
     from sorteos s join extractos e using (fecha, turno)
     where s.fecha = $1
     order by array_position(array['previa','primera','matutina','vespertina','nocturna'], s.turno), e.quiniela`,
    [fecha],
  );
  const turnos = {};
  for (const x of r.rows) {
    turnos[x.turno] ??= { turno: x.turno, numero: x.numero, fuente: x.fuente, quinielas: {} };
    turnos[x.turno].quinielas[x.quiniela] = { numeros: x.numeros, letras: x.letras };
  }
  // Cabezas que ya se conocen pero todavía no tienen el extracto completo: van como extracto parcial
  const c = await db().query('select turno, quiniela, cabeza, fuente from cabezas where fecha = $1', [fecha]);
  for (const x of c.rows) {
    turnos[x.turno] ??= { turno: x.turno, numero: null, fuente: x.fuente, quinielas: {} };
    if (!turnos[x.turno].quinielas[x.quiniela]) {
      turnos[x.turno].quinielas[x.quiniela] = { numeros: [x.cabeza, ...Array(19).fill('')], letras: null, parcial: true };
    }
  }
  const orden = ['previa', 'primera', 'matutina', 'vespertina', 'nocturna'];
  return { fecha, turnos: Object.values(turnos).sort((a, b) => orden.indexOf(a.turno) - orden.indexOf(b.turno)) };
}

// Demoras medidas (para ajustar el scraper)
export async function demorasRecientes(dias = 7) {
  const r = await db().query(
    `select fecha, turno, fuente, minutos_demora from publicaciones
     where fecha >= (now() at time zone 'America/Argentina/Buenos_Aires')::date - $1::int
     order by fecha desc, turno, fuente`,
    [dias],
  );
  return r.rows;
}

// Busca en qué sorteos salió un número (de 1 a 4 cifras) desde una fecha.
// Compara con las últimas cifras de cada número sorteado, como en la quiniela.
export async function buscarNumero(numero, desde) {
  const r = await db().query(
    `select e.fecha, e.turno, e.quiniela, s.numero as sorteo,
            array_agg(u.pos::int order by u.pos) as ubicaciones,
            array_agg(u.valor order by u.pos) as valores
     from extractos e
     join sorteos s using (fecha, turno)
     cross join lateral unnest(e.numeros) with ordinality as u(valor, pos)
     where e.fecha >= $2 and right(u.valor, length($1)) = $1
     group by e.fecha, e.turno, e.quiniela, s.numero
     order by e.fecha desc,
       array_position(array['nocturna','vespertina','matutina','primera','previa'], e.turno),
       e.quiniela`,
    [numero, desde],
  );
  const total = await db().query(
    'select count(*)::int as sorteos, count(distinct fecha)::int as dias from sorteos where fecha >= $1',
    [desde],
  );
  return {
    numero,
    desde,
    sorteos: total.rows[0].sorteos,
    dias: total.rows[0].dias,
    aciertos: r.rows.map((x) => ({
      fecha: x.fecha instanceof Date ? x.fecha.toISOString().slice(0, 10) : String(x.fecha).slice(0, 10),
      turno: x.turno,
      quiniela: x.quiniela,
      sorteo: x.sorteo,
      ubicaciones: x.ubicaciones,
      valores: x.valores,
    })),
  };
}

// Números de sorteo que faltan en la base entre dos números (para completar el historial)
export async function numerosFaltantes(desde, hasta) {
  if (!desde || !hasta || hasta < desde) return [];
  const r = await db().query(
    `select n from generate_series($1::int, $2::int) as n
     where not exists (select 1 from sorteos where numero = n)
     order by n desc limit 1000`,
    [desde, hasta],
  );
  return r.rows.map((x) => Number(x.n));
}

// ---- Estadísticas ---------------------------------------------------
// Para una quiniela: cuántas veces salió cada número de 2 cifras (00 a 99)
// desde una fecha, y hace cuántos sorteos salió por última vez (en todo el historial).
export async function estadisticas(quiniela, desde) {
  const r = await db().query(
    `with s as (
       select fecha, turno,
              row_number() over (order by fecha, array_position(array['previa','primera','matutina','vespertina','nocturna'], turno)) as orden
       from extractos where quiniela = $1
     ),
     u as (
       select s.orden, s.fecha, s.turno, x.pos, right(x.valor, 2) as n
       from extractos e
       join s using (fecha, turno)
       cross join lateral unnest(e.numeros) with ordinality as x(valor, pos)
       where e.quiniela = $1
     )
     select n,
            count(*) filter (where pos = 1 and fecha >= $2)::int as cabeza,
            count(*) filter (where fecha >= $2)::int as a_los_20,
            max(orden) filter (where pos = 1)::int as orden_cabeza,
            max(orden)::int as orden_20,
            (array_agg(fecha::text || ' ' || turno order by orden desc) filter (where pos = 1))[1] as ultima_cabeza,
            (array_agg(fecha::text || ' ' || turno order by orden desc))[1] as ultima_20
     from u group by n`,
    [quiniela, desde],
  );
  const t = await db().query(
    `select count(*)::int as total,
            count(*) filter (where fecha >= $2)::int as periodo,
            min(fecha)::text as primera,
            max(fecha)::text as ultima
     from extractos where quiniela = $1`,
    [quiniela, desde],
  );
  const { total, periodo, primera, ultima } = t.rows[0];
  const porNumero = new Map(r.rows.map((x) => [x.n, x]));
  const partir = (v) => (v ? { fecha: v.slice(0, 10), turno: v.slice(11) } : null);
  const numeros = [];
  for (let i = 0; i < 100; i++) {
    const n = String(i).padStart(2, '0');
    const x = porNumero.get(n);
    numeros.push({
      n,
      cabeza: x?.cabeza ?? 0,
      aLos20: x?.a_los_20 ?? 0,
      // Sorteos que pasaron desde la última vez (0 = salió en el último). null = nunca en el historial
      atrasoCabeza: x?.orden_cabeza ? total - x.orden_cabeza : null,
      atraso20: x?.orden_20 ? total - x.orden_20 : null,
      ultimaCabeza: partir(x?.ultima_cabeza),
      ultima20: partir(x?.ultima_20),
    });
  }
  return { quiniela, desde, sorteos: periodo, historial: { sorteos: total, desde: primera, hasta: ultima }, numeros };
}

// ---- Avisos (notificaciones push) ----------------------------------

export async function guardarSuscripcion({ endpoint, p256dh, auth, dispositivo, preferencias, jugadas, codigo }) {
  await db().query(
    `insert into suscripciones (endpoint, p256dh, auth, dispositivo, preferencias, jugadas, codigo)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (endpoint) do update set
       p256dh = excluded.p256dh, auth = excluded.auth, dispositivo = excluded.dispositivo,
       preferencias = excluded.preferencias, jugadas = excluded.jugadas, codigo = excluded.codigo,
       fallos = 0, actualizada = now()`,
    [endpoint, p256dh, auth, dispositivo ?? null, JSON.stringify(preferencias ?? {}), JSON.stringify(jugadas ?? []), codigo ?? null],
  );
}

// Cambia preferencias, jugadas y/o código Pro. Devuelve false si esa suscripción no existe.
export async function actualizarSuscripcion(endpoint, { preferencias, jugadas, codigo }) {
  const r = await db().query(
    `update suscripciones set
       preferencias = coalesce($2::jsonb, preferencias),
       jugadas = coalesce($3::jsonb, jugadas),
       codigo = coalesce($4, codigo),
       actualizada = now()
     where endpoint = $1`,
    [endpoint, preferencias ? JSON.stringify(preferencias) : null, jugadas ? JSON.stringify(jugadas) : null, codigo ?? null],
  );
  return r.rowCount > 0;
}

export async function borrarSuscripcion(endpoint) {
  await db().query('delete from suscripciones where endpoint = $1', [endpoint]);
}

// pro = el teléfono tiene un código Pro vigente
const CONSULTA_SUSCRIPCIONES = `
  select s.endpoint, s.p256dh, s.auth, s.preferencias, s.jugadas,
         coalesce(l.vence > now(), false) as pro
  from suscripciones s left join licencias l on l.codigo = s.codigo`;

export async function listarSuscripciones() {
  const r = await db().query(CONSULTA_SUSCRIPCIONES);
  return r.rows;
}

export async function buscarSuscripcion(endpoint) {
  const r = await db().query(`${CONSULTA_SUSCRIPCIONES} where s.endpoint = $1`, [endpoint]);
  return r.rows[0] ?? null;
}

// Suma un fallo de envío; a los 5 fallos seguidos se borra
export async function registrarFalloEnvio(endpoint) {
  await db().query('update suscripciones set fallos = fallos + 1 where endpoint = $1', [endpoint]);
  await db().query('delete from suscripciones where endpoint = $1 and fallos >= 5', [endpoint]);
}

// ---- Versión Pro -----------------------------------------------------

const filaLicencia = (x) => (!x ? null : { codigo: x.codigo, plan: x.plan, vence: x.vence, dispositivos: x.dispositivos });

export async function crearCompra({ referencia, codigo, plan, precio }) {
  await db().query('insert into compras (referencia, codigo, plan, precio) values ($1, $2, $3, $4)', [referencia, codigo, plan, precio]);
}

export async function buscarCompra(referencia) {
  const r = await db().query('select referencia, codigo, plan, precio::float as precio, estado, pago_id from compras where referencia = $1', [referencia]);
  return r.rows[0] ?? null;
}

// ¿Ese código ya existe (activo, vencido o en una compra pendiente)?
export async function codigoUsado(codigo) {
  const r = await db().query(
    'select exists (select 1 from licencias where codigo = $1) or exists (select 1 from compras where codigo = $1) as usado',
    [codigo],
  );
  return r.rows[0].usado;
}

// Aprueba una compra UNA sola vez y crea o extiende la licencia.
// Devuelve la licencia (o null si la compra no existe).
export async function aprobarCompra(referencia, pagoId, dias) {
  const cliente = await db().connect();
  try {
    await cliente.query('begin');
    const c = await cliente.query(
      `update compras set estado = 'aprobada', pago_id = $2, aprobada = now()
       where referencia = $1 and estado = 'pendiente' returning codigo, plan`,
      [referencia, String(pagoId)],
    );
    if (c.rowCount) {
      const { codigo, plan } = c.rows[0];
      await cliente.query(
        `insert into licencias (codigo, plan, vence) values ($1, $2, now() + make_interval(days => $3))
         on conflict (codigo) do update set
           plan = excluded.plan,
           vence = greatest(licencias.vence, now()) + make_interval(days => $3)`,
        [codigo, plan, dias],
      );
    }
    await cliente.query('commit');
  } catch (e) {
    await cliente.query('rollback').catch(() => {});
    throw e;
  } finally {
    cliente.release();
  }
  const r = await db().query(
    'select l.* from licencias l join compras c on c.codigo = l.codigo where c.referencia = $1 and c.estado = $2',
    [referencia, 'aprobada'],
  );
  return filaLicencia(r.rows[0]);
}

export async function buscarLicencia(codigo) {
  const r = await db().query('select * from licencias where codigo = $1', [codigo]);
  return filaLicencia(r.rows[0]);
}

// Anota el teléfono en el código. false si ya hay "maximo" teléfonos distintos.
export async function vincularDispositivo(codigo, dispositivo, maximo = 3) {
  const r = await db().query(
    `update licencias set dispositivos = array_append(dispositivos, $2)
     where codigo = $1 and not ($2 = any(dispositivos)) and cardinality(dispositivos) < $3`,
    [codigo, dispositivo, maximo],
  );
  if (r.rowCount) return true;
  const ya = await db().query('select $2 = any(dispositivos) as esta from licencias where codigo = $1', [codigo, dispositivo]);
  return Boolean(ya.rows[0]?.esta);
}

// Licencia de regalo (la crea a mano el dueño)
export async function crearLicenciaCortesia(codigo, dias, nota = 'cortesía') {
  await db().query(
    "insert into licencias (codigo, plan, vence, nota) values ($1, 'anual', now() + make_interval(days => $2), $3)",
    [codigo, dias, nota],
  );
}

// ---- Botón de arrepentimiento ---------------------------------------
export async function crearArrepentimiento({ numero, codigo, contacto, detalle }) {
  await db().query(
    'insert into arrepentimientos (numero, codigo, contacto, detalle) values ($1, $2, $3, $4)',
    [numero, codigo ?? null, contacto, detalle ?? null],
  );
}

export async function listarArrepentimientos() {
  const r = await db().query("select numero, codigo, contacto, detalle, estado, creado from arrepentimientos order by creado desc limit 100");
  return r.rows;
}

// ---- Cabezas anticipadas --------------------------------------------
// Devuelve true si es nueva
export async function guardarCabeza(fecha, turno, quiniela, cabeza, fuente) {
  const r = await db().query(
    'insert into cabezas (fecha, turno, quiniela, cabeza, fuente) values ($1, $2, $3, $4, $5) on conflict do nothing',
    [fecha, turno, quiniela, cabeza, fuente],
  );
  return r.rowCount > 0;
}
