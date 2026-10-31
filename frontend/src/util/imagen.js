// =====================================================================
// imagen.js — Arma imágenes para compartir (extracto y cabezas de un turno)
// Se dibujan en un <canvas> con la marca y el enlace de la app, listas para
// mandar a WhatsApp. Si el teléfono no deja compartir archivos, se baja la imagen.
// =====================================================================
import { suenoDe } from './suenos.js';
import { fechaLarga } from './fechas.js';

const ANCHO = 1080;
const C = {
  fondo: '#eef2ef', tarjeta: '#ffffff', verde: '#0e5a3c', amarillo: '#ffe27a',
  rojo: '#c21d2e', tinta: '#14261e', tenue: '#5b6d64', linea: '#d3ddd7',
};
const NUM = '"Barlow Condensed", "Arial Narrow", sans-serif';
const TXT = 'Barlow, system-ui, sans-serif';
export const ENLACE_CORTO = 'quinielaaltoque.app';

function lienzo(alto) {
  const c = document.createElement('canvas');
  c.width = ANCHO;
  c.height = alto;
  const x = c.getContext('2d');
  x.fillStyle = C.fondo;
  x.fillRect(0, 0, ANCHO, alto);
  return { c, x };
}

function rect(x, px, py, w, h, r, color) {
  x.fillStyle = color;
  x.beginPath();
  x.roundRect(px, py, w, h, r);
  x.fill();
}

// Franja verde de arriba con la marca
function encabezado(x) {
  x.fillStyle = C.verde;
  x.fillRect(0, 0, ANCHO, 150);
  x.textBaseline = 'middle';
  x.font = `700 72px ${NUM}`;
  x.fillStyle = '#fff';
  x.fillText('Quiniela', 60, 78);
  const w = x.measureText('Quiniela ').width;
  x.fillStyle = C.amarillo;
  x.fillText('al Toque', 60 + w, 78);
}

// Pie con el enlace
function pie(x, alto) {
  x.fillStyle = C.verde;
  x.fillRect(0, alto - 130, ANCHO, 130);
  x.textBaseline = 'middle';
  x.fillStyle = '#fff';
  x.font = `600 38px ${TXT}`;
  x.fillText('Resultados al instante y avisos en tu celular', 60, alto - 84);
  x.fillStyle = C.amarillo;
  x.font = `700 44px ${NUM}`;
  x.fillText(ENLACE_CORTO, 60, alto - 38);
}

const aBlob = (c) => new Promise((ok, mal) => c.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo armar la imagen'))), 'image/png'));

async function fuentesListas() {
  try {
    await Promise.all([document.fonts.load(`700 72px ${NUM}`), document.fonts.load(`600 38px ${TXT}`)]);
    await document.fonts.ready;
  } catch { /* se usan las del sistema */ }
}

// Extracto completo de una quiniela (20 números)
export async function imagenExtracto({ quiniela, turno, hora, fecha, numeros }) {
  await fuentesListas();
  const alto = 1720;
  const { c, x } = lienzo(alto);
  encabezado(x);

  rect(x, 40, 190, ANCHO - 80, alto - 190 - 170, 36, C.tarjeta);
  x.textBaseline = 'alphabetic';
  x.fillStyle = C.tinta;
  x.font = `700 62px ${NUM}`;
  x.fillText(quiniela, 90, 285);
  x.fillStyle = C.tenue;
  x.font = `500 36px ${TXT}`;
  const fl = fechaLarga(fecha);
  x.fillText(`${turno}${hora ? ` (${hora})` : ''} · ${fl.charAt(0).toUpperCase()}${fl.slice(1)}`, 90, 340);

  // La cabeza grande, en su propia franja
  rect(x, 70, 380, ANCHO - 140, 220, 28, '#fbeef0');
  const cabeza = numeros[0] || '----';
  x.fillStyle = C.tenue;
  x.font = `600 40px ${TXT}`;
  x.fillText('A la cabeza', 110, 470);
  const s = suenoDe(cabeza);
  if (s) {
    x.font = `500 38px ${TXT}`;
    x.fillText(`${s.dibujo} ${s.nombre}`, 110, 535);
  }
  x.textAlign = 'right';
  x.fillStyle = C.rojo;
  x.font = `700 200px ${NUM}`;
  x.fillText(cabeza, ANCHO - 110, 565);
  x.textAlign = 'left';

  // Los 20 en dos columnas
  const y0 = 690;
  const alturaFila = 82;
  for (let i = 0; i < 20; i++) {
    const col = i < 10 ? 0 : 1;
    const fila = i % 10;
    const px = col === 0 ? 90 : ANCHO / 2 + 30;
    const py = y0 + fila * alturaFila;
    x.strokeStyle = C.linea;
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(px, py + 22);
    x.lineTo(px + ANCHO / 2 - 150, py + 22);
    x.stroke();
    x.fillStyle = C.tenue;
    x.font = `500 32px ${TXT}`;
    x.fillText(String(i + 1), px, py);
    x.textAlign = 'right';
    x.fillStyle = i === 0 ? C.rojo : C.tinta;
    x.font = `700 58px ${NUM}`;
    x.fillText(numeros[i] || '----', px + ANCHO / 2 - 150, py + 4);
    x.textAlign = 'left';
  }
  pie(x, alto);
  return aBlob(c);
}

// Cabezas de todas las quinielas de un turno
export async function imagenCabezas({ turno, hora, fecha, filas }) {
  await fuentesListas();
  const alturaFila = 96;
  const alto = Math.max(900, 190 + 160 + filas.length * alturaFila + 60 + 130 + 40);
  const { c, x } = lienzo(alto);
  encabezado(x);
  rect(x, 40, 190, ANCHO - 80, alto - 190 - 170, 36, C.tarjeta);
  x.textBaseline = 'alphabetic';
  x.fillStyle = C.tinta;
  x.font = `700 62px ${NUM}`;
  x.fillText(`Cabezas de ${turno}`, 90, 285);
  x.fillStyle = C.tenue;
  x.font = `500 36px ${TXT}`;
  const fl = fechaLarga(fecha);
  x.fillText(`${fl.charAt(0).toUpperCase()}${fl.slice(1)}${hora ? ` · ${hora}` : ''}`, 90, 340);
  filas.forEach((f, i) => {
    const py = 440 + i * alturaFila;
    if (i % 2 === 0) rect(x, 70, py - 62, ANCHO - 140, alturaFila - 8, 18, '#f3f6f4');
    x.fillStyle = C.tinta;
    x.font = `600 44px ${TXT}`;
    x.fillText(f.nombre, 100, py);
    const s = suenoDe(f.numero);
    x.textAlign = 'right';
    x.fillStyle = C.tenue;
    x.font = `400 40px ${TXT}`;
    if (s) x.fillText(s.dibujo, ANCHO - 330, py - 2);
    x.fillStyle = C.rojo;
    x.font = `700 70px ${NUM}`;
    x.fillText(f.numero, ANCHO - 100, py + 4);
    x.textAlign = 'left';
  });
  pie(x, alto);
  return aBlob(c);
}

// Comparte la imagen con el menú del teléfono; si no se puede, la baja.
// Devuelve 'compartido', 'descargado' o 'cancelado'.
export async function compartirImagen(blob, archivo, texto) {
  const file = new File([blob], archivo, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: texto });
      return 'compartido';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelado';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = archivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'descargado';
}
