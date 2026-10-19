// =====================================================================
// avisos.js — Notificaciones push
//  - Cabeza de cada sorteo al instante (de las quinielas elegidas)
//  - Aviso especial si sale una jugada guardada (con premio estimado)
//  - Recordatorio unos minutos antes de cada turno (opcional)
//
// Variables de entorno: VAPID_PUBLICA, VAPID_PRIVADA, VAPID_CONTACTO
// =====================================================================
import webpush from 'web-push';
import { evaluarDirecta, UBICACIONES } from '../../shared/premios.js';
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
    process.env.VAPID_CONTACTO || 'https://quiniela-app-i0j2.onrender.com',
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
    const { desde, hasta } = UBICACIONES[j.ubicacion];
    for (const q of j.quinielas || []) {
      const ex = sorteo.extractos.find((e) => e.quiniela === q);
      if (!ex || !/^\d{1,4}$/.test(String(j.numero))) continue;
      const r = evaluarDirecta({ numero: String(j.numero), desde, hasta, monto: Number(j.monto) || 1 }, ex.numeros);
      if (r.gano) aciertos.push({ numero: String(j.numero), quiniela: q, ubicaciones: r.aciertos, premio: Number(j.monto) ? r.premio : null });
    }
  }
  if (aciertos.length) {
    const numeros = [...new Set(aciertos.map((a) => a.numero))];
    const lineas = aciertos.slice(0, 4).map((a) => {
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

  // 2. Cabezas del sorteo
  if (prefs.cabezas === false) return null;
  const elegidas = Array.isArray(prefs.quinielas) && prefs.quinielas.length ? prefs.quinielas : QUINIELAS_POR_DEFECTO;
  const cabezas = ORDEN.filter((q) => elegidas.includes(q))
    .map((q) => sorteo.extractos.find((e) => e.quiniela === q))
    .filter(Boolean)
    .map((e) => `${NOMBRES[e.quiniela]} ${e.numeros[0]}`);
  if (!cabezas.length) return null;
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

  // Cuando sale un sorteo nuevo de hoy
  async function avisarSorteo(sorteo) {
    const informe = { enviados: 0, fallidos: 0 };
    if (!activo()) return informe;
    const subs = await base.listarSuscripciones();
    for (let i = 0; i < subs.length; i += 20) {
      await Promise.all(subs.slice(i, i + 20).map(async (sub) => {
        const datos = armarAviso(sub, sorteo);
        if (datos) await mandar(sub, datos, informe);
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

  return { avisarSorteo, recordar, prueba };
}
