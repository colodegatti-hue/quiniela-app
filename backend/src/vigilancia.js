// =====================================================================
// vigilancia.js — Avisarle a Colo si una fuente falla
// Si pasado un rato del sorteo todavía falta una quiniela, manda un aviso
// a los teléfonos marcados como "de administrador" (desde el panel).
// Cada falta se avisa una sola vez (queda anotada en la base).
// =====================================================================
import { turnosYaSorteados, horaArgentina, instanteDelSorteo, TURNOS } from './horarios.js';
import { quinielasEsperadas } from './ciclo.js';

export const DEMORA_MIN = 40;            // minutos después del sorteo para considerar que falta
export const DEMORA_MONTEVIDEO_MIN = 70; // Montevideo suele publicarse más tarde
const HASTA_MIN = 240;                   // después de 4 horas ya no se avisa

const NOMBRES = { ciudad: 'Ciudad', provincia: 'Provincia', santafe: 'Santa Fe', cordoba: 'Córdoba', entrerios: 'Entre Ríos', mendoza: 'Mendoza', montevideo: 'Montevideo' };
const nombreTurno = (t) => (TURNOS.find((x) => x.id === t)?.nombre ?? t).replace(/^La /, '');

// Qué quinielas faltan hoy: [{ turno, quinielas, minutos, nada }]
export function faltantes({ vistas = {}, ahora = new Date(), esperadas = quinielasEsperadas }) {
  const { fecha } = horaArgentina(ahora);
  const r = [];
  for (const turno of turnosYaSorteados(ahora)) {
    const minutos = Math.floor((ahora - instanteDelSorteo(fecha, turno)) / 60000);
    if (minutos > HASTA_MIN) continue;
    const esperadasTurno = esperadas(turno, 'lotba');
    const vistasTurno = vistas[turno] ?? [];
    const faltan = esperadasTurno.filter((q) => !vistasTurno.includes(q) && minutos >= (q === 'montevideo' ? DEMORA_MONTEVIDEO_MIN : DEMORA_MIN));
    if (faltan.length) r.push({ fecha, turno, quinielas: faltan, minutos, nada: vistasTurno.length === 0 });
  }
  return r;
}

export function textoAlerta(f) {
  if (f.nada) {
    return { titulo: `⚠️ No llegó nada de la ${nombreTurno(f.turno)}`, cuerpo: `Pasaron ${f.minutos} min del sorteo. ¿Feriado o falla de las fuentes? Revisá el panel.` };
  }
  const lista = f.quinielas.map((q) => NOMBRES[q] ?? q).join(', ');
  return { titulo: `⚠️ Falta ${lista} de la ${nombreTurno(f.turno)}`, cuerpo: `Pasaron ${f.minutos} min del sorteo y todavía no está. Revisá el panel.` };
}

// base: { alertaNueva(clave) -> bool (true si no se había avisado) }
// enviar(datos): manda el aviso a los teléfonos de administrador
export function crearVigilancia({ base, enviar }) {
  async function revisar(estado, ahora = new Date()) {
    if (!estado) return [];
    const enviadas = [];
    for (const f of faltantes({ vistas: estado.vistas, ahora })) {
      // Una alerta por turno y conjunto de faltantes nuevos (si después falta otra, se vuelve a avisar)
      const nuevas = [];
      for (const q of f.quinielas) {
        if (await base.alertaNueva(`${f.fecha}|${f.turno}|${q}`)) nuevas.push(q);
      }
      if (!nuevas.length) continue;
      const datos = textoAlerta({ ...f, quinielas: nuevas });
      await enviar({ ...datos, url: '/#/resultados', etiqueta: `falla-${f.fecha}-${f.turno}` });
      enviadas.push({ turno: f.turno, quinielas: nuevas });
    }
    return enviadas;
  }
  return { revisar };
}
