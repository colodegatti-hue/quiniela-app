// =====================================================================
// avisos.js — Notificaciones push
//  - Cabeza de cada sorteo al instante (de las quinielas elegidas)
//  - Aviso especial si sale una jugada guardada (con premio estimado)
//  - Alerta de números: "avisame cuando salga el 47" (en cualquier quiniela)
//  - Recordatorio unos minutos antes de cada turno (opcional)
//
// Variables de entorno: VAPID_PUBLICA, VAPID_PRIVADA, VAPID_CONTACTO
// =====================================================================
import webpush from 'web-push';
import { evaluarGuardada, UBICACIONES } from '../../shared/premios.js';
import { suenoDe } from '../../shared/suenos.js';
import { TURNOS, horaArgentina, minutosDelDia } from './horarios.js';
import * as baseReal from './db.js';

const NOMBRES = {
  ciudad: 'Ciudad', provincia: 'Provincia', santafe: 'Santa Fe', cordoba: 'Córdoba',
  entrerios: 'Entre Ríos', mendoza: 'Mendoza', montevideo: 'Montevideo',
};
const ORDEN = Object.keys(NOMBRES);
const QUINIELAS_POR_DEFECTO = ['ciudad', 'provincia', 'santafe', 'cordoba', 'entrerios'];
const nombreTurno = (id) => TURNOS.find((t) => t.id === id)?.nombre ?? id;

const pesos = (v) => '$' + Math.round(v).toLocaleString('es-AR');

export function pushConfigurado() {
  return Boolean(process.env.VAPID_PUBLICA && process.env.VAPID_PRIVADA);
}

let configurado = false;
function configurar() {
  if (configurado || !pushConfigurado()) return configurado;
  webpush.setVapidDetails(
    process.env.VAPID_CONTACTO || 'mailto:coloapps.soporte@gmail.com',
    process.env.VAPID_PUBLICA,
    process.env.VAPID_PRIVADA,
  );
  configurado = true;
  return true;
}

// Arma el aviso para una persona cuando sale un sorteo. null = no se le avisa.
export function armarAviso(sub, sorteo) {
  const prefs = sub.preferencias || {};
  const jugadas = Array.isArray(sub.jugadas) ? sub.jugadas : [];
  const etiqueta = `sorteo-${sorteo.fecha}-${sorteo.turno}`;

  // 1. ¿Salió alguna de sus jugadas?
  const aciertos = [];
  for (const j of jugadas) {
    if (j.fecha !== sorteo.fecha || !j.turnos?.includes(sorteo.turno) || !UBICACIONES[j.ubicacion]) continue;
    const redoblona = j.tipo === 'redoblona';
    if (redoblona ? !(/^\d{2}$/.test(String(j.numero)) && /^\d{2}$/.test(String(j.numero2)) && UBICACIONES[j.ubicacion2]) : !/^\d{1,4}$/.test(String(j.numero))) continue;
    for (const q of j.quinielas || []) {
      const ex = sorteo.extractos.find((e) => e.quiniela === q);
      if (!ex) continue;
      let ev;
      try { ev = evaluarGuardada({ ...j, monto: Number(j.monto) || 1 }, ex.numeros); } catch { continue; }
      if (ev.estado !== 'gano') continue;
      const r = ev.resultado;
      aciertos.push({
        numero: redoblona ? `${j.numero}-${j.numero2}` : String(j.numero), quiniela: q, redoblona,
        ubicaciones: redoblona ? [...r.aciertos1, ...r.aciertos2] : r.aciertos, premio: Number(j.monto) ? r.premio : null,
      });
    }
  }
  if (aciertos.length) {
    const numeros = [...new Set(aciertos.map((a) => a.numero))];
    const lineas = aciertos.slice(0, 4).map((a) => {
      if (a.redoblona) return `${NOMBRES[a.quiniela]}: redoblona ${a.numero}${a.premio ? ` (${pesos(a.premio)} estimado)` : ''}`;
      const donde = a.ubicaciones[0] === 1 ? 'a la cabeza' : `en la ubicación ${a.ubicaciones.join(', ')}`;
      return `${NOMBRES[a.quiniela]}: el ${a.numero} ${donde}${a.premio ? ` (${pesos(a.premio)} estimado)` : ''}`;
    });
    return {
      titulo: numeros.length === 1 ? `¡Salió tu ${numeros[0]} en la ${nombreTurno(sorteo.turno)}!` : `¡Salieron ${numeros.length} de tus números en la ${nombreTurno(sorteo.turno)}!`,
      cuerpo: lineas.join('\n'),
      url: '/#/jugadas',
      etiqueta,
    };
  }

  // Cabezas de las quinielas elegidas (para el aviso común y como agregado)
  const elegidas = Array.isArray(prefs.quinielas) && prefs.quinielas.length ? prefs.quinielas : QUINIELAS_POR_DEFECTO;
  const cabezas = ORDEN.filter((q) => elegidas.includes(q))
    .map((q) => sorteo.extractos.find((e) => e.quiniela === q))
    .filter(Boolean)
    .map((e) => `${NOMBRES[e.quiniela]} ${e.numeros[0]} ${suenoDe(e.numeros[0])?.dibujo ?? ''}`.trim());
  const quiereCabezas = prefs.cabezas !== false && cabezas.length > 0;

  // 2. ¿Salió alguno de los números que sigue?
  const alertas = (Array.isArray(prefs.alertas) ? prefs.alertas : []).filter((n) => /^\d{2}$/.test(n));
  if (alertas.length) {
    const hasta = prefs.alertasDonde === 'a_los_20' ? 20 : 1;
    const hallados = [];
    for (const n of alertas) {
      for (const q of ORDEN) {
        const ex = sorteo.extractos.find((e) => e.quiniela === q);
        if (!ex) continue;
        const ubic = ex.numeros.slice(0, hasta).map((v, i) => (v.endsWith(n) ? i + 1 : null)).filter(Boolean);
        if (ubic.length) hallados.push({ n, quiniela: q, ubic });
      }
    }
    if (hallados.length) {
      const numeros = [...new Set(hallados.map((h) => h.n))];
      const lista = numeros.length === 1 ? `el ${numeros[0]}` : numeros.slice(0, -1).map((x) => `el ${x}`).join(', ') + ` y el ${numeros.at(-1)}`;
      const lineas = hallados.slice(0, 4).map((h) => {
        const donde = h.ubic[0] === 1 ? 'a la cabeza' : `en la ubicación ${h.ubic.join(', ')}`;
        return `${numeros.length > 1 ? `${h.n}: ` : ''}${NOMBRES[h.quiniela]} ${donde}`;
      });
      if (hallados.length > 4) lineas.push(`y ${hallados.length - 4} más`);
      if (quiereCabezas) lineas.push(`Cabezas: ${cabezas.join(' · ')}`);
      return {
        titulo: `Salió ${lista} en la ${nombreTurno(sorteo.turno)}`,
        cuerpo: lineas.join('\n'),
        url: '/#/resultados',
        etiqueta,
      };
    }
  }

  // 3. Cabezas del sorteo
  if (!quiereCabezas) return null;
  return {
    titulo: `Cabezas de la ${nombreTurno(sorteo.turno)}`,
    cuerpo: cabezas.join(' · '),
    url: '/#/resultados',
    etiqueta,
  };
}

// ¿Toca recordatorio? Devuelve el turno que sale en 5 a 20 minutos (o null)
export function turnoParaRecordar(ahora = new Date()) {
  const ar = horaArgentina(ahora);
  if (ar.diaSemana === 0) return null;
  for (const t of TURNOS) {
    const faltan = minutosDelDia(t.hora) - ar.minutos;
    if (faltan >= 5 && faltan <= 20) return { fecha: ar.fecha, turno: t.id, faltan };
  }
  return null;
}

export function crearAvisos(opciones = {}) {
  const base = opciones.base ?? baseReal;
  const enviar = opciones.enviar ?? ((sub, datos) => {
    configurar();
    return webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(datos),
      { TTL: 3600, urgency: 'high' },
    );
  });
  const activo = opciones.activo ?? pushConfigurado;
  const recordados = new Set(); // "fecha|turno" ya recordados (en memoria)

  async function mandar(sub, datos, informe) {
    try {
      await enviar(sub, datos);
      informe.enviados++;
    } catch (e) {
      informe.fallidos++;
      // 404/410: el teléfono dio de baja los avisos → se borra
      if (e?.statusCode === 404 || e?.statusCode === 410) await base.borrarSuscripcion(sub.endpoint);
      else await base.registrarFalloEnvio(sub.endpoint);
    }
  }

  // Último aviso mandado a cada teléfono por turno: "endpoint|fecha|turno" -> { titulo, cuerpo }
  const ultimos = new Map();

  // Cuando aparecen quinielas de un sorteo de hoy (la Lotería las publica de a una).
  // nuevas = quinielas que recién aparecieron. Se avisa apenas sale algo que a esa
  // persona le importa; si después llega más, el aviso se actualiza SIN volver a sonar
  // (salvo que cambie el título: por ejemplo, ahora salió su jugada).
  async function avisarSorteo(sorteo, { nuevas } = {}) {
    const informe = { enviados: 0, fallidos: 0 };
    if (!activo()) return informe;
    const nuevasSet = new Set(nuevas ?? sorteo.extractos.map((e) => e.quiniela));
    if (ultimos.size > 20000) ultimos.clear();
    const subs = await base.listarSuscripciones();
    for (let i = 0; i < subs.length; i += 20) {
      await Promise.all(subs.slice(i, i + 20).map(async (sub) => {
        const prefs = sub.preferencias || {};
        // Las alertas de número son de la versión Pro
        const alertas = sub.pro && Array.isArray(prefs.alertas) && prefs.alertas.length > 0;
        const importan = new Set();
        if (prefs.cabezas !== false) {
          for (const q of Array.isArray(prefs.quinielas) && prefs.quinielas.length ? prefs.quinielas : QUINIELAS_POR_DEFECTO) importan.add(q);
        }
        for (const j of Array.isArray(sub.jugadas) ? sub.jugadas : []) {
          if (j.fecha === sorteo.fecha && j.turnos?.includes(sorteo.turno)) for (const q of j.quinielas || []) importan.add(q);
        }
        if (!alertas && ![...nuevasSet].some((q) => importan.has(q))) return; // no llegó nada que le importe

        const datos = armarAviso(sub.pro ? sub : { ...sub, preferencias: { ...prefs, alertas: [] } }, sorteo);
        if (!datos) return;
        const clave = `${sub.endpoint}|${sorteo.fecha}|${sorteo.turno}`;
        const previo = ultimos.get(clave);
        if (previo && previo.titulo === datos.titulo && previo.cuerpo === datos.cuerpo) return; // nada nuevo
        ultimos.set(clave, { titulo: datos.titulo, cuerpo: datos.cuerpo });
        await mandar(sub, { ...datos, silencioso: Boolean(previo && previo.titulo === datos.titulo) }, informe);
      }));
    }
    return informe;
  }

  // Se llama en cada /cron/tick
  async function recordar(ahora = new Date()) {
    const informe = { enviados: 0, fallidos: 0 };
    const t = turnoParaRecordar(ahora);
    if (!activo() || !t || recordados.has(`${t.fecha}|${t.turno}`)) return informe;
    recordados.add(`${t.fecha}|${t.turno}`);
    const subs = (await base.listarSuscripciones()).filter((s) => s.preferencias?.recordatorio);
    const hora = TURNOS.find((x) => x.id === t.turno).hora;
    const datos = { titulo: `${nombreTurno(t.turno)} sale a las ${hora}`, cuerpo: `Faltan ${t.faltan} minutos. Si vas a jugar, todavía estás a tiempo.`, url: '/#/jugadas', etiqueta: `recordatorio-${t.fecha}-${t.turno}` };
    await Promise.all(subs.map((s) => mandar(s, datos, informe)));
    informe.turno = t.turno;
    return informe;
  }

  async function prueba(endpoint) {
    const sub = await base.buscarSuscripcion(endpoint);
    if (!sub) return { ok: false, error: 'Ese teléfono no tiene los avisos activados' };
    const informe = { enviados: 0, fallidos: 0 };
    await mandar(sub, { titulo: 'Avisos activados', cuerpo: 'Así te vamos a avisar cuando salga cada sorteo.', url: '/#/resultados', etiqueta: 'prueba' }, informe);
    return { ok: informe.enviados === 1 };
  }

  // Alertas de fallas para los teléfonos de administrador
  async function avisarAdmins(datos) {
    const informe = { enviados: 0, fallidos: 0 };
    if (!activo()) return informe;
    const subs = await base.listarSuscripcionesAdmin();
    await Promise.all(subs.map((s) => mandar(s, datos, informe)));
    return informe;
  }

  return { avisarSorteo, recordar, prueba, avisarAdmins };
}
