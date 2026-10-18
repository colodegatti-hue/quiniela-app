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

// Anota la PRIMERA vez que una fuente mostró un resultado (no pisa)
export async function registrarPublicacion(fecha, turno, fuente, minutosDemora) {
  await db().query(
    `insert into publicaciones (fecha, turno, fuente, minutos_demora)
     values ($1, $2, $3, $4) on conflict do nothing`,
    [fecha, turno, fuente, minutosDemora],
  );
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
  return { fecha, turnos: Object.values(turnos) };
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
