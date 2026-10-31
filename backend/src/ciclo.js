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
import { buscarVivi, buscarCabezasVivi } from './fuentes/vivitusuerte.js';
import { buscarPozos } from './fuentes/pozos.js';

const MAX_POR_CICLO = 12;      // sorteos oficiales a recuperar por llamada
const RESPALDO_MIN = 15;       // minutos de espera antes de usar el respaldo
const VENTANA_MIN = 180;       // minutos después del sorteo en que se sigue mirando
const SALTO_MIN = 30;          // si falta un turno hace +30 min, probar número siguiente
const MAX_HISTORIAL = 8;
const ANTES_MIN = 150;          // las provincias pueden sortear hasta 2 h y media antes que la Ciudad
const MAX_PROVINCIAS = 6;       // pizarras de provincias a pedir por llamada       // sorteos viejos a completar por llamada (historial)
const COMPLETAR_MIN = 150;     // hasta cuántos minutos después del sorteo se sigue completando

const PRINCIPALES = ['ciudad', 'provincia', 'santafe', 'cordoba', 'entrerios', 'mendoza'];
// Quinielas que tiene que traer un sorteo para estar completo
export function quinielasEsperadas(turno, fuente) {
  // Montevideo solo viene de la Lotería, en Matutina y Nocturna
  return fuente === 'lotba' && (turno === 'matutina' || turno === 'nocturna') ? [...PRINCIPALES, 'montevideo'] : PRINCIPALES;
}

function restarUnDia(fecha) {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function crearCiclo(opciones = {}) {
  const base = opciones.base ?? baseReal;
  const fuentes = opciones.fuentes ?? {
    buscarSorteoLotba,
    buscarSorteoQuinieleando,
    buscarPaginaQuinieleando,
    buscarProvincia,
    buscarVivi,
    buscarCabezasVivi,
    buscarPozos,
  };
  const sorteoInicial = opciones.sorteoInicial ?? Number(process.env.SORTEO_INICIAL || 0);
  const alGuardar = opciones.alGuardar ?? (() => {});
  const alListo = opciones.alListo ?? (() => {}); // llegaron quinielas nuevas de un sorteo de hoy
  const esperadas = opciones.quinielasEsperadas ?? quinielasEsperadas;
  // Desde qué n.º de sorteo se quiere tener historial completo (0 = no completar)
  const historialDesde = opciones.historialDesde ?? Number(process.env.HISTORIAL_DESDE || 0);
  // Desde qué fecha completar las provincias hacia atrás (vacío = no completar)
  const provinciasDesde = opciones.provinciasDesde ?? (process.env.PROVINCIAS_DESDE || '');
  // Desde qué fecha completar Poceada y Quiniela Plus hacia atrás
  const pozosDesde = opciones.pozosDesde ?? (process.env.POZOS_DESDE || '');

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
      cabezasHoy: {},         // turno -> [quinielas de las que ya se avisó la cabeza sola]
    };
    if (base.resultadosDeFecha) {
      for (const t of (await base.resultadosDeFecha(fecha)).turnos ?? []) {
        estado.extractosHoy[t.turno] = Object.fromEntries(Object.entries(t.quinielas).map(([q, e]) => [q, { quiniela: q, ...e }]));
        estado.cabezasHoy[t.turno] = Object.entries(t.quinielas).filter(([, e]) => e.parcial).map(([q]) => q);
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
    estado.provinciasViejas = provinciasDesde && base.provinciasFaltantes && (horarios.IDS_PROVINCIALES ?? []).length
      ? await base.provinciasFaltantes(provinciasDesde, restarUnDia(fecha), horarios.IDS_PROVINCIALES)
      : [];
    estado.pozosHoy = base.pozosDeFecha ? new Set(Object.keys(await base.pozosDeFecha(fecha))) : new Set();
    estado.ultimoPozo = 0;
    estado.pozosViejos = [];
    if (pozosDesde && base.fechasConPozo) {
      const hay = await base.fechasConPozo('poceada', pozosDesde);
      for (let f = restarUnDia(fecha); f >= pozosDesde; f = restarUnDia(f)) {
        if (new Date(`${f}T12:00:00Z`).getUTCDay() !== 0 && !hay.has(f)) estado.pozosViejos.push(f);
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

    // ---- 3c. Quinielas que todavía faltan en un turno de hoy: completarlas con los respaldos
    // (vivitusuerte y quinieleando suelen tener las provincias antes que la Lotería de la Ciudad).
    // Nunca pisa lo que ya hay; cuando llega el dato oficial, lo reemplaza.
    if (base.agregarExtracto && (fuentes.buscarPaginaQuinieleando || fuentes.buscarVivi)) {
      const paginas = {}; // slug -> turnos de esa quiniela en quinieleando (una vez por llamada)
      const vivi = {};    // quiniela -> turnos en vivitusuerte (una vez por llamada)
      for (const t of sorteados) {
        if (minutosDesde(t) > VENTANA_MIN) continue;
        // Aunque la Lotería de la Ciudad todavía no haya publicado nada, cada quiniela entra apenas aparece
        const faltan = [...horarios.QUINIELAS, { id: 'montevideo', slug: null }]
          .filter((q) => esperadas(t, 'lotba').includes(q.id) && !(estado.vistas[t] ?? []).includes(q.id));
        const juntas = []; // lo que se agregó en esta llamada: se avisa todo junto
        for (const q of faltan) {
          try {
            let x = null;
            let fuente = 'quinieleando';
            if (fuentes.buscarVivi) {
              try {
                vivi[q.id] ??= await fuentes.buscarVivi(q.id, ar.fecha);
              } catch (e) {
                vivi[q.id] = [];
                resumen.errores.push(`vivitusuerte (${q.id}): ${e.message}`);
              }
              x = vivi[q.id].find((p) => p.fecha === ar.fecha && p.turno === t) ?? null;
              if (x) fuente = 'vivitusuerte';
            }
            if (!x && q.slug && fuentes.buscarPaginaQuinieleando) {
              paginas[q.slug] ??= await fuentes.buscarPaginaQuinieleando(q.slug);
              x = paginas[q.slug].find((p) => p.fecha === ar.fecha && p.turno === t) ?? null;
            }
            if (!x) continue;
            const extracto = { quiniela: q.id, numeros: x.numeros, letras: null };
            const res = await base.agregarExtracto(ar.fecha, t, extracto, 'quinieleando');
            resumen.respaldo = { ...(resumen.respaldo ?? {}), [q.id]: fuente };
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

    // ---- 3d. Cabezas sueltas: si de una quiniela todavía no están los 20 números pero ya se
    // conoce la cabeza, se guarda y se avisa ya (el extracto completo la reemplaza después).
    // Incluye las provincias, que pueden sortear antes que la Ciudad.
    const provinciales = horarios.IDS_PROVINCIALES ?? [];
    const deTurno = (t) => [...esperadas(t, 'lotba'), ...provinciales];
    const enVentana = horarios.TURNOS.map((x) => x.id)
      .filter((t) => minutosDesde(t) >= -ANTES_MIN && minutosDesde(t) <= VENTANA_MIN && horarios.horaArgentina(ahora).diaSemana !== 0);
    let cabezasDelDia = null;
    const traerCabezas = async () => (cabezasDelDia ??= await fuentes.buscarCabezasVivi(ar.fecha));
    if (fuentes.buscarCabezasVivi && base.guardarCabeza) {
      const conFaltantes = enVentana.filter((t) => deTurno(t)
        .some((q) => !(estado.vistas[t] ?? []).includes(q) && !(estado.cabezasHoy[t] ?? []).includes(q)));
      if (conFaltantes.length) {
        try {
          const cabezas = await traerCabezas();
          for (const t of conFaltantes) {
            const nuevas = [];
            for (const c of cabezas.filter((x) => x.turno === t)) {
              if (!deTurno(t).includes(c.quiniela) || (estado.vistas[t] ?? []).includes(c.quiniela) || (estado.cabezasHoy[t] ?? []).includes(c.quiniela)) continue;
              await base.guardarCabeza(ar.fecha, t, c.quiniela, c.cabeza, 'vivitusuerte');
              estado.cabezasHoy[t] = [...(estado.cabezasHoy[t] ?? []), c.quiniela];
              estado.extractosHoy[t] = { ...(estado.extractosHoy[t] ?? {}), [c.quiniela]: { quiniela: c.quiniela, numeros: [c.cabeza, ...Array(19).fill('')], letras: null, parcial: true } };
              nuevas.push(c.quiniela);
            }
            if (nuevas.length) {
              resumen.cabezas = { ...(resumen.cabezas ?? {}), [t]: nuevas };
              const sorteo = { fecha: ar.fecha, turno: t, numero: null, fuente: 'vivitusuerte', extractos: Object.values(estado.extractosHoy[t]) };
              alGuardar(sorteo, 'cabezas');
              alListo(sorteo, { nuevas, completo: false, soloCabeza: true });
            }
          }
        } catch (e) {
          resumen.errores.push(`vivitusuerte (cabezas): ${e.message}`);
        }
      }
    }

    // ---- 3e. Provincias: cuando ya se conoce la cabeza, traer los 20 números
    if (fuentes.buscarVivi && base.agregarExtracto && provinciales.length) {
      let pedidas = 0;
      for (const t of enVentana) {
        const juntas = [];
        for (const q of provinciales) {
          if ((estado.vistas[t] ?? []).includes(q) || !(estado.cabezasHoy[t] ?? []).includes(q) || pedidas >= MAX_PROVINCIAS) continue;
          pedidas++;
          try {
            const x = (await fuentes.buscarVivi(q, ar.fecha)).find((p) => p.fecha === ar.fecha && p.turno === t);
            if (!x) continue;
            const extracto = { quiniela: q, numeros: x.numeros, letras: null };
            const res = await base.agregarExtracto(ar.fecha, t, extracto, 'quinieleando');
            if (res === 'omitido') { estado.vistas[t] = [...new Set([...(estado.vistas[t] ?? []), q])]; continue; }
            resumen.provincias = { ...(resumen.provincias ?? {}), [t]: [...(resumen.provincias?.[t] ?? []), q] };
            juntas.push(extracto);
            alGuardar({ fecha: ar.fecha, turno: t, numero: null, fuente: 'quinieleando', extractos: [extracto] }, res);
          } catch (e) {
            resumen.errores.push(`vivitusuerte (${q}): ${e.message}`);
          }
        }
        if (juntas.length) sumarAlDia({ fecha: ar.fecha, turno: t, numero: null, fuente: 'quinieleando', extractos: juntas }, juntas.map((e) => e.quiniela));
      }
    }

    // ---- 3f. Poceada de la Ciudad, Quiniela Plus y Super Plus (después de la Nocturna)
    if (fuentes.buscarPozos && base.guardarPozo && ar.diaSemana !== 0) {
      const desdeNocturna = minutosDesde('nocturna');
      const faltan = ['poceada', 'quinielaplus', 'superplus'].some((j) => !estado.pozosHoy.has(j));
      // Cada 3 minutos hasta tenerlos; después, una vez más a la hora (por los ganadores)
      const cada = faltan ? 3 * 60000 : 60 * 60000;
      if (desdeNocturna >= 3 && desdeNocturna <= 180 && ahora - estado.ultimoPozo >= cada) {
        estado.ultimoPozo = ahora.getTime();
        try {
          const p = await fuentes.buscarPozos(ar.fecha);
          for (const [juego, datos] of Object.entries(p)) {
            const res = await base.guardarPozo(juego, datos);
            if (res === 'nuevo') resumen.pozos = [...(resumen.pozos ?? []), juego];
            estado.pozosHoy.add(juego);
          }
        } catch (e) {
          resumen.errores.push(`pozos: ${e.message}`);
        }
      }
    }
    // Pozos viejos: un día por llamada
    if (estado.pozosViejos?.length && fuentes.buscarPozos && base.guardarPozo) {
      const f = estado.pozosViejos.shift();
      try {
        const p = await fuentes.buscarPozos(f);
        for (const [juego, datos] of Object.entries(p)) await base.guardarPozo(juego, datos);
        resumen.pozosViejos = { [f]: Object.keys(p).length, quedan: estado.pozosViejos.length };
      } catch (e) {
        resumen.errores.push(`pozos viejos (${f}): ${e.message}`);
      }
    }

    // ---- 4b. Provincias hacia atrás: un día de una provincia por llamada (trae los 5 turnos)
    if (estado.provinciasViejas?.length && fuentes.buscarVivi && base.agregarExtracto) {
      const p = estado.provinciasViejas.shift();
      try {
        const turnos = await fuentes.buscarVivi(p.quiniela, p.fecha);
        let n = 0;
        for (const x of turnos.filter((y) => y.fecha === p.fecha)) {
          const res = await base.agregarExtracto(p.fecha, x.turno, { quiniela: p.quiniela, numeros: x.numeros, letras: null }, 'quinieleando');
          if (res !== 'omitido') n++;
        }
        resumen.provinciasViejas = { [`${p.quiniela} ${p.fecha}`]: n, quedan: estado.provinciasViejas.length };
      } catch (e) {
        resumen.errores.push(`provincias viejas (${p.quiniela} ${p.fecha}): ${e.message}`);
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
