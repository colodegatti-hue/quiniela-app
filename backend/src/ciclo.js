// =====================================================================
// ciclo.js — Lo que hace el servidor cada vez que cron-job.org lo llama
//
// 1. Busca en la Lotería (oficial) los sorteos nuevos, por número
//    correlativo, y los guarda. Si el servidor estuvo dormido, se pone al
//    día solo (hasta MAX_POR_CICLO sorteos por llamada).
// 2. Si un turno de hoy ya debería haber salido y la Lotería no lo tiene
//    (o falla), lo toma del respaldo (quinieleando) a los RESPALDO_MIN min.
// 3. Anota cuándo vio cada fuente cada resultado (para medir la demora).
// 4. La Lotería publica las quinielas DE A UNA: si un sorteo de hoy llegó
//    incompleto, lo vuelve a pedir en cada llamada hasta tenerlas todas.
//    Cada vez que aparecen quinielas nuevas de hoy llama a alListo(sorteo,
//    { nuevas }) para avisar al instante (los avisos deciden a quién).
//
// Para no gastar la base (Neon gratis), el estado del día se guarda en
// memoria y la base solo se usa al arrancar, al cambiar el día y al guardar.
// =====================================================================
import * as horarios from './horarios.js';
import * as baseReal from './db.js';
import { buscarSorteoLotba } from './fuentes/lotba.js';
import { buscarSorteoQuinieleando, buscarPaginaQuinieleando } from './fuentes/quinieleando.js';
import { buscarProvincia } from './fuentes/provincia.js';

const MAX_POR_CICLO = 12;      // sorteos oficiales a recuperar por llamada
const RESPALDO_MIN = 15;       // minutos de espera antes de usar el respaldo
const VENTANA_MIN = 180;       // minutos después del sorteo en que se sigue mirando
const SALTO_MIN = 30;          // si falta un turno hace +30 min, probar número siguiente
const MAX_HISTORIAL = 8;       // sorteos viejos a completar por llamada (historial)
const COMPLETAR_MIN = 150;     // hasta cuántos minutos después del sorteo se sigue completando

const PRINCIPALES = ['ciudad', 'provincia', 'santafe', 'cordoba', 'entrerios', 'mendoza'];
// Quinielas que tiene que traer un sorteo para estar completo
export function quinielasEsperadas(turno, fuente) {
  // Montevideo solo viene de la Lotería, en Matutina y Nocturna
  return fuente === 'lotba' && (turno === 'matutina' || turno === 'nocturna') ? [...PRINCIPALES, 'montevideo'] : PRINCIPALES;
}

export function crearCiclo(opciones = {}) {
  const base = opciones.base ?? baseReal;
  const fuentes = opciones.fuentes ?? {
    buscarSorteoLotba,
    buscarSorteoQuinieleando,
    buscarPaginaQuinieleando,
    buscarProvincia,
  };
  const sorteoInicial = opciones.sorteoInicial ?? Number(process.env.SORTEO_INICIAL || 0);
  const alGuardar = opciones.alGuardar ?? (() => {});
  const alListo = opciones.alListo ?? (() => {}); // llegaron quinielas nuevas de un sorteo de hoy
  const esperadas = opciones.quinielasEsperadas ?? quinielasEsperadas;
  // Desde qué n.º de sorteo se quiere tener historial completo (0 = no completar)
  const historialDesde = opciones.historialDesde ?? Number(process.env.HISTORIAL_DESDE || 0);

  let estado = null;
  let enCurso = null;

  async function cargarEstado(fecha) {
    estado = {
      fecha,
      ultimoNumero: await base.ultimoNumeroLotba(),
      sorteosHoy: await base.sorteosDeFecha(fecha),
      publicacionesHoy: await base.publicacionesDeFecha(fecha),
      incompletos: new Map(), // turno -> { numero, quinielas: [...] }
      vistas: {},             // turno -> quinielas ya guardadas hoy (para saber cuáles son nuevas)
      extractosHoy: {},       // turno -> { quiniela: extracto } (para armar los avisos con todo lo que hay)
    };
    if (base.resultadosDeFecha) {
      for (const t of (await base.resultadosDeFecha(fecha)).turnos ?? []) {
        estado.extractosHoy[t.turno] = Object.fromEntries(Object.entries(t.quinielas).map(([q, e]) => [q, { quiniela: q, ...e }]));
      }
    }
    if (base.quinielasDeFecha) {
      for (const x of await base.quinielasDeFecha(fecha)) {
        estado.vistas[x.turno] = x.quinielas;
        if (x.fuente === 'lotba' && !esperadas(x.turno, x.fuente).every((q) => x.quinielas.includes(q))) {
          estado.incompletos.set(x.turno, { numero: x.numero, quinielas: x.quinielas });
        }
      }
    }
    estado.faltantes = historialDesde && base.numerosFaltantes && estado.ultimoNumero
      ? await base.numerosFaltantes(historialDesde, estado.ultimoNumero)
      : [];
  }

  async function anotarPublicacion(fecha, turno, fuente, ahora, resumen) {
    const clave = `${turno}|${fuente}`;
    if (fecha !== estado.fecha || estado.publicacionesHoy.has(clave)) return;
    const demora = (ahora - horarios.instanteDelSorteo(fecha, turno)) / 60000;
    if (demora < 0 || demora > VENTANA_MIN) return; // recuperado tarde: no sirve para medir
    await base.registrarPublicacion(fecha, turno, fuente, Math.round(demora * 10) / 10);
    estado.publicacionesHoy.add(clave);
    resumen.publicaciones.push({ turno, fuente, minutos: Math.round(demora * 10) / 10 });
  }

  async function guardar(sorteo, ahora, resumen) {
    const res = await base.guardarSorteo(sorteo);
    if (res !== 'omitido') {
      const quinielas = sorteo.extractos.map((e) => e.quiniela);
      const completo = esperadas(sorteo.turno, sorteo.fuente).every((q) => quinielas.includes(q));
      const dato = { fecha: sorteo.fecha, turno: sorteo.turno, numero: sorteo.numero, fuente: sorteo.fuente, resultado: res, quinielas: quinielas.length };
      if (!completo) dato.incompleto = true;
      resumen.guardados.push(dato);
      alGuardar(sorteo, res);
      if (sorteo.fecha === estado.fecha) {
        estado.sorteosHoy[sorteo.turno] = sorteo.fuente;
        if (!completo && sorteo.fuente === 'lotba') {
          estado.incompletos.set(sorteo.turno, { numero: sorteo.numero, quinielas });
        } else {
          estado.incompletos.delete(sorteo.turno);
        }
        sumarAlDia(sorteo, quinielas);
      }
    }
    await anotarPublicacion(sorteo.fecha, sorteo.turno, sorteo.fuente, ahora, resumen);
  }

  // Junta lo que va llegando de cada turno de hoy y avisa las quinielas nuevas
  function sumarAlDia(sorteo, quinielas) {
    const t = sorteo.turno;
    estado.extractosHoy[t] = { ...(estado.extractosHoy[t] ?? {}) };
    for (const e of sorteo.extractos) estado.extractosHoy[t][e.quiniela] = e;
    const antes = estado.vistas[t] ?? [];
    const nuevas = quinielas.filter((q) => !antes.includes(q));
    estado.vistas[t] = [...new Set([...antes, ...quinielas])];
    if (!nuevas.length) return;
    const todo = { ...sorteo, extractos: Object.values(estado.extractosHoy[t]) };
    const completo = esperadas(t, 'lotba').every((q) => estado.vistas[t].includes(q));
    alListo(todo, { nuevas, completo });
  }

  async function ejecutar(ahora) {
    const ar = horarios.horaArgentina(ahora);
    if (!estado || estado.fecha !== ar.fecha) await cargarEstado(ar.fecha);

    const resumen = { fecha: ar.fecha, guardados: [], publicaciones: [], faltantes: [], errores: [] };
    const sorteados = horarios.turnosYaSorteados(ahora);
    const minutosDesde = (t) => (ahora - horarios.instanteDelSorteo(ar.fecha, t)) / 60000;

    // ---- 0. Sorteos de hoy que llegaron incompletos: volver a pedirlos
    let lotbaFallo = false;
    for (const [turno, inc] of [...estado.incompletos]) {
      if (minutosDesde(turno) > COMPLETAR_MIN) {
        estado.incompletos.delete(turno); // no se completó: se deja como está
        continue;
      }
      try {
        const s = await fuentes.buscarSorteoLotba(inc.numero);
        if (s && s.extractos.length > inc.quinielas.length) await guardar(s, ahora, resumen);
      } catch (e) {
        lotbaFallo = true;
        resumen.errores.push(`Lotería (completar ${turno}): ${e.message}`);
        break;
      }
    }

    // ---- 1. Fuente oficial: sorteos nuevos por número ----------------
    let n = estado.ultimoNumero === null ? sorteoInicial : estado.ultimoNumero + 1;
    if (lotbaFallo) {
      // ya falló al completar: no insistir en esta llamada
    } else if (!n) {
      resumen.errores.push('Falta configurar SORTEO_INICIAL (la base está vacía)');
      lotbaFallo = true;
    } else {
      for (let i = 0; i < MAX_POR_CICLO; i++) {
        try {
          let s = await fuentes.buscarSorteoLotba(n);
          if (!s) {
            // ¿La Lotería salteó un número? Solo se prueba si hace rato falta un turno.
            const atrasado = sorteados.some((t) => !estado.sorteosHoy[t] && minutosDesde(t) >= SALTO_MIN);
            if (!atrasado) break;
            s = await fuentes.buscarSorteoLotba(n + 1);
            if (!s) break;
          }
          await guardar(s, ahora, resumen);
          estado.ultimoNumero = s.numero;
          n = s.numero + 1;
        } catch (e) {
          lotbaFallo = true;
          resumen.errores.push(`Lotería: ${e.message}`);
          break;
        }
      }
    }

    // ---- 2 y 3. Turnos de hoy: respaldo y medición -------------------
    let paginaNacional; // se baja una sola vez por llamada
    for (const t of sorteados) {
      const minutos = minutosDesde(t);
      if (minutos > VENTANA_MIN) {
        if (!estado.sorteosHoy[t]) resumen.faltantes.push(t);
        continue;
      }
      try {
        const sinOficial = !estado.sorteosHoy[t] || estado.sorteosHoy[t] === 'provincia';
        if (sinOficial && (lotbaFallo || minutos >= RESPALDO_MIN)) {
          const s = await fuentes.buscarSorteoQuinieleando(ar.fecha, t);
          if (s) await guardar(s, ahora, resumen);
          else resumen.faltantes.push(t);
        } else if (!estado.publicacionesHoy.has(`${t}|quinieleando`)) {
          paginaNacional ??= await fuentes.buscarPaginaQuinieleando('nacional');
          if (paginaNacional.some((x) => x.fecha === ar.fecha && x.turno === t)) {
            await anotarPublicacion(ar.fecha, t, 'quinieleando', ahora, resumen);
          }
        }
      } catch (e) {
        paginaNacional ??= []; // no reintentar en esta misma llamada
        resumen.errores.push(`quinieleando (${t}): ${e.message}`);
      }
    }

    // ---- 3b. Provincia desde su lotería oficial (suele publicar antes)
    const sinProvincia = sorteados.filter((t) => minutosDesde(t) <= VENTANA_MIN && !(estado.vistas[t] ?? []).includes('provincia'));
    if (sinProvincia.length && fuentes.buscarProvincia && base.agregarExtracto) {
      try {
        const pagina = await fuentes.buscarProvincia();
        for (const x of pagina) {
          if (x.fecha !== ar.fecha || !sinProvincia.includes(x.turno)) continue;
          const extracto = { quiniela: 'provincia', numeros: x.numeros, letras: null };
          const res = await base.agregarExtracto(x.fecha, x.turno, extracto, 'provincia');
          await anotarPublicacion(x.fecha, x.turno, 'provincia', ahora, resumen);
          if (res === 'omitido') { estado.vistas[x.turno] = [...new Set([...(estado.vistas[x.turno] ?? []), 'provincia'])]; continue; }
          resumen.guardados.push({ fecha: x.fecha, turno: x.turno, fuente: 'provincia', resultado: res, quinielas: 1 });
          estado.sorteosHoy[x.turno] ??= 'provincia';
          const sorteo = { fecha: x.fecha, turno: x.turno, numero: null, fuente: 'provincia', extractos: [extracto] };
          alGuardar(sorteo, res);
          sumarAlDia(sorteo, ['provincia']);
        }
      } catch (e) {
        resumen.errores.push(`Provincia: ${e.message}`);
      }
    }

    // ---- 3c. Quinielas que todavía faltan en un turno de hoy: completarlas con el respaldo
    // (quinieleando suele tener las provincias antes que la Lotería de la Ciudad).
    // Nunca pisa lo que ya hay; cuando llega el dato oficial, lo reemplaza.
    if (base.agregarExtracto && fuentes.buscarPaginaQuinieleando) {
      const paginas = {}; // slug -> turnos de esa quiniela (una vez por llamada)
      for (const t of sorteados) {
        if (minutosDesde(t) > VENTANA_MIN) continue;
        // Aunque la Lotería de la Ciudad todavía no haya publicado nada, cada quiniela entra apenas aparece
        const faltan = horarios.QUINIELAS.filter((q) => !(estado.vistas[t] ?? []).includes(q.id));
        const juntas = []; // lo que se agregó en esta llamada: se avisa todo junto
        for (const q of faltan) {
          try {
            paginas[q.slug] ??= await fuentes.buscarPaginaQuinieleando(q.slug);
            const x = paginas[q.slug].find((p) => p.fecha === ar.fecha && p.turno === t);
            if (!x) continue;
            const extracto = { quiniela: q.id, numeros: x.numeros, letras: null };
            const res = await base.agregarExtracto(ar.fecha, t, extracto, 'quinieleando');
            if (res === 'omitido') { estado.vistas[t] = [...new Set([...(estado.vistas[t] ?? []), q.id])]; continue; }
            estado.sorteosHoy[t] ??= 'quinieleando';
            resumen.guardados.push({ fecha: ar.fecha, turno: t, fuente: 'quinieleando', resultado: res, quiniela: q.id });
            juntas.push(extracto);
            alGuardar({ fecha: ar.fecha, turno: t, numero: null, fuente: 'quinieleando', extractos: [extracto] }, res);
          } catch (e) {
            paginas[q.slug] = [];
            resumen.errores.push(`quinieleando (${q.id}): ${e.message}`);
          }
        }
        if (juntas.length) {
          sumarAlDia({ fecha: ar.fecha, turno: t, numero: null, fuente: 'quinieleando', extractos: juntas }, juntas.map((e) => e.quiniela));
        }
      }
    }

    // ---- 4. Historial: completa de a poco los sorteos viejos que faltan
    if (estado.faltantes.length && !lotbaFallo) {
      let cargados = 0;
      while (estado.faltantes.length && cargados < MAX_HISTORIAL) {
        const viejo = estado.faltantes[0];
        try {
          const s = await fuentes.buscarSorteoLotba(viejo);
          if (s) await base.guardarSorteo(s);
          estado.faltantes.shift();
          cargados++;
        } catch (e) {
          resumen.errores.push(`Historial ${viejo}: ${e.message}`);
          break;
        }
      }
      resumen.historial = { cargados, quedan: estado.faltantes.length };
    }

    if (estado.incompletos.size) resumen.incompletos = [...estado.incompletos.keys()];

    resumen.ultimoNumero = estado.ultimoNumero;
    resumen.turnosHoy = { ...estado.sorteosHoy };
    return resumen;
  }

  // Evita dos ejecuciones al mismo tiempo
  async function tick(ahora = new Date()) {
    if (enCurso) return { ocupado: true };
    enCurso = ejecutar(ahora);
    try {
      return await enCurso;
    } finally {
      enCurso = null;
    }
  }

  return {
    tick,
    olvidarEstado: () => { estado = null; },
    verEstado: () => estado,
  };
}
