// Datos REALES de la Lotería de la Ciudad — 08/10/2026 (leídos de la web oficial)
// Se usan para probar que el servidor interpreta bien las dos fuentes.

export const MATUTINA_53009 = {
  ciudad: ['9179', '4492', '3389', '6210', '5508', '6232', '1042', '3281', '0419', '9120', '9625', '4597', '0283', '4938', '6629', '1916', '3402', '5398', '8612', '1033'],
  provincia: ['9643', '9941', '6766', '1317', '3694', '5875', '2671', '1138', '0781', '8527', '9194', '3480', '0522', '5823', '8460', '6369', '9651', '0063', '3542', '8461'],
  santafe: ['6316', '3592', '7147', '1720', '7079', '0947', '4376', '5994', '5988', '8152', '6013', '3282', '5993', '8516', '0231', '0303', '3697', '5318', '7294', '1613'],
  cordoba: ['9800', '7947', '5394', '9142', '0383', '3129', '0884', '7698', '7718', '9450', '2638', '9136', '4008', '3750', '9287', '7894', '8101', '0012', '7552', '1425'],
  mendoza: ['8250', '9455', '1774', '1484', '5963', '8433', '2131', '7768', '6572', '2015', '8920', '0630', '3172', '2782', '0420', '1265', '7576', '3148', '4355', '3429'],
  entrerios: ['7071', '2275', '6137', '6658', '6476', '1315', '1232', '0899', '0452', '4982', '3108', '7980', '7086', '0787', '5644', '9832', '4543', '0731', '6462', '8542'],
  montevideo: ['9850', '4640', '3491', '6225', '5246', '6954', '1199', '3823', '0868', '9766', '9903', '4842', '0885', '4958', '6702', '1590', '3586', '5611', '8187', '1949'],
};

const NOMBRES = {
  ciudad: ['51', 'CIUDAD DE BS AS'],
  provincia: ['53', 'PROVINCIA DE BS AS'],
  santafe: ['72', 'PROVINCIA DE SANTA FE'],
  cordoba: ['55', 'PROVINCIA DE CÓRDOBA'],
  mendoza: ['56', 'PROVINCIA DE MENDOZA'],
  entrerios: ['59', 'PROVINCIA DE ENTRE RÍOS'],
  montevideo: ['70', 'MONTEVIDEO - URUGUAY'],
};

// Arma la respuesta tal como la devuelve resultados-data.php
// (con "\/" y acentos como Ó, igual que la web oficial)
export function respuestaLotba(sorteo, fecha, modalidad, extractos) {
  const jurisdicciones = {};
  for (const [id, numeros] of Object.entries(extractos)) {
    const [clave, nombre] = NOMBRES[id];
    jurisdicciones[clave] = {
      nombre,
      numeros: numeros.map((val, i) => ({ pos: String(i + 1).padStart(2, '0'), val })),
      letras: 'DJQQ',
    };
  }
  const json = JSON.stringify([{ sorteo, fecha, modalidad, jurisdicciones }])
    .replace(/\//g, '\\/')
    .replace(/[\u0080-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
  return `window.RESULTADOS_DATA = ${json};window.POZO_ULTIMO_SORTEO = 0;`;
}

export const LOTBA_VACIO = 'window.RESULTADOS_DATA = [];window.POZO_ULTIMO_SORTEO = 0;';

// Quiniela Nacional en quinieleando, 08/10/2026 (texto real de la página)
export const NACIONAL_08_10 = {
  previa: ['7218', '2200', '3107', '4988', '3463', '2820', '3623', '9207', '1817', '3140', '3408', '0127', '1091', '4352', '6866', '3310', '7974', '1403', '1473', '1721'],
  primera: ['4599', '7414', '1743', '3337', '1500', '2759', '2903', '2921', '5104', '9925', '1440', '3835', '9902', '6757', '2203', '7947', '6354', '7048', '0632', '7675'],
  matutina: MATUTINA_53009.ciudad,
};

const TITULO = { previa: 'LA PREVIA', primera: 'LA PRIMERA', matutina: 'MATUTINA', vespertina: 'VESPERTINA', nocturna: 'NOCTURNA' };

// Arma una página parecida a la de quinieleando (tabla de 4 columnas)
export function paginaQuinieleando(nombre, fechaCorta, turnos) {
  const bloques = Object.entries(turnos).map(([turno, numeros]) => {
    const filas = [1, 2, 3, 4, 5].map((r) =>
      '<tr>' + [r, r + 5, r + 10, r + 15].map((p) => `<td>${p}</td><td>${numeros[p - 1]}</td>`).join('') + '</tr>',
    ).join('\n');
    return `<div class="sorteo"><h3>${TITULO[turno]}, Quiniela ${nombre}. ${fechaCorta}</h3>
<p>Cabeza: ${numeros[0]} - Sangre <a href="#">(ver sueños...)</a></p>
<table>${filas}</table><p>Letras</p></div>
<div class="publicidad">Ver más Resultados Quiniela ${nombre} Sorteos 2026 Quini 6</div>`;
  });
  return `<!DOCTYPE html><html><head><title>Quiniela ${nombre} resultados HOY. 8/10/2026</title>
<script>var x = "MATUTINA, Quiniela. 1/1/2020 Cabeza: 1111";</script></head>
<body><h1>Quiniela ${nombre}</h1><p>Resultados de HOY</p>
${bloques.join('\n')}
<footer>© 2026 quinieleando.com.ar</footer></body></html>`;
}
