// =====================================================================
// suenos.js — Significado tradicional de los números (00 al 99)
// La tabla popular de la quiniela argentina. Hay pequeñas variantes
// según la zona; esta es la más difundida.
// "palabras" = otras formas de buscarlo (lo que alguien soñó)
// =====================================================================

const TABLA = [
  ['00', 'Los huevos', 'huevo'],
  ['01', 'El agua', 'mar pileta rio nadar'],
  ['02', 'El niño', 'bebe chico hijo nene'],
  ['03', 'San Cono', 'santo suerte'],
  ['04', 'La cama', 'dormir'],
  ['05', 'El gato', 'gata'],
  ['06', 'El perro', 'perra'],
  ['07', 'El revólver', 'arma pistola tiro'],
  ['08', 'El incendio', 'fuego quemar'],
  ['09', 'El arroyo', 'rio'],
  ['10', 'La leche', 'vaca tomar'],
  ['11', 'El palito', 'minero palo'],
  ['12', 'El soldado', 'militar guerra'],
  ['13', 'La yeta', 'mala suerte'],
  ['14', 'El borracho', 'alcohol mamado'],
  ['15', 'La niña bonita', 'nena chica linda'],
  ['16', 'El anillo', 'joya'],
  ['17', 'La desgracia', 'accidente'],
  ['18', 'La sangre', 'herida'],
  ['19', 'El pescado', 'pez pescar'],
  ['20', 'La fiesta', 'cumpleaños baile'],
  ['21', 'La mujer', 'señora'],
  ['22', 'El loco', 'locura'],
  ['23', 'El cocinero', 'cocina comida'],
  ['24', 'El caballo', 'yegua'],
  ['25', 'La gallina', 'pollo'],
  ['26', 'La misa', 'iglesia rezar'],
  ['27', 'El peine', 'pelo'],
  ['28', 'Los cerros', 'montaña sierra'],
  ['29', 'San Pedro', 'llaves'],
  ['30', 'Santa Rosa', 'tormenta'],
  ['31', 'La luz', 'lampara'],
  ['32', 'El dinero', 'plata guita billete'],
  ['33', 'Cristo', 'edad jesus'],
  ['34', 'La cabeza', 'pensar'],
  ['35', 'El pajarito', 'pajaro'],
  ['36', 'La manteca', 'grasa'],
  ['37', 'El dentista', 'dientes muela'],
  ['38', 'El aceite', 'aceitera'],
  ['39', 'La lluvia', 'llover agua'],
  ['40', 'El cura', 'sacerdote'],
  ['41', 'El cuchillo', 'cortar'],
  ['42', 'Las zapatillas', 'zapatos'],
  ['43', 'El balcón', 'ventana'],
  ['44', 'La cárcel', 'preso policia'],
  ['45', 'El vino', 'tomar'],
  ['46', 'Los tomates', 'verdura'],
  ['47', 'El muerto', 'difunto velorio'],
  ['48', 'El muerto que habla', 'difunto'],
  ['49', 'La carne', 'asado'],
  ['50', 'El pan', 'panaderia'],
  ['51', 'El serrucho', 'herramienta'],
  ['52', 'Madre e hijo', 'mama'],
  ['53', 'El barco', 'viaje'],
  ['54', 'La vaca', 'campo'],
  ['55', 'La música', 'cantar canción'],
  ['56', 'La caída', 'caer'],
  ['57', 'El jorobado', 'joroba'],
  ['58', 'El ahogado', 'ahogarse'],
  ['59', 'Las plantas', 'flores jardin arbol'],
  ['60', 'La Virgen', 'maria'],
  ['61', 'La escopeta', 'caza arma'],
  ['62', 'La inundación', 'agua'],
  ['63', 'El casamiento', 'boda novia'],
  ['64', 'El llanto', 'llorar'],
  ['65', 'El cazador', 'cazar'],
  ['66', 'Las lombrices', 'gusanos'],
  ['67', 'La víbora', 'serpiente'],
  ['68', 'Los sobrinos', 'sobrino'],
  ['69', 'Los vicios', 'vicio'],
  ['70', 'El muerto que sueña', 'difunto'],
  ['71', 'El excremento', 'caca'],
  ['72', 'La sorpresa', 'regalo'],
  ['73', 'El hospital', 'enfermo'],
  ['74', 'La oscuridad', 'noche'],
  ['75', 'Los besos', 'beso'],
  ['76', 'Las llamas', 'fuego'],
  ['77', 'Las piernas de mujer', 'piernas'],
  ['78', 'La dama de la noche', 'noche'],
  ['79', 'El ladrón', 'robo robar'],
  ['80', 'La bocha', 'pelota'],
  ['81', 'Las flores', 'flor'],
  ['82', 'La pelea', 'pelear discusion'],
  ['83', 'El mal tiempo', 'tormenta'],
  ['84', 'La iglesia', 'misa'],
  ['85', 'La linterna', 'luz'],
  ['86', 'El humo', 'fumar'],
  ['87', 'Los piojos', 'piojo'],
  ['88', 'El Papa', 'francisco'],
  ['89', 'La rata', 'raton'],
  ['90', 'El miedo', 'susto'],
  ['91', 'El excusado', 'baño inodoro'],
  ['92', 'El médico', 'doctor'],
  ['93', 'El enamorado', 'amor novio'],
  ['94', 'El cementerio', 'tumba'],
  ['95', 'Los anteojos', 'lentes'],
  ['96', 'El marido', 'esposo'],
  ['97', 'La mesa', 'comer'],
  ['98', 'La lavandera', 'lavar ropa'],
  ['99', 'Los hermanos', 'hermano hermana'],
];

export const SUENOS = TABLA.map(([n, nombre, palabras]) => ({ n, nombre, palabras }));

export const suenoDe = (n) => SUENOS.find((s) => s.n === String(n).padStart(2, '0').slice(-2)) ?? null;

// Sin acentos ni mayúsculas, para comparar
const simple = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Busca por número ("47", "7") o por palabra ("perro", "plata")
export function buscarSueno(texto) {
  const t = simple(texto);
  if (!t) return SUENOS;
  if (/^\d{1,2}$/.test(t)) return SUENOS.filter((s) => s.n === t.padStart(2, '0'));
  return SUENOS.filter((s) => simple(`${s.nombre} ${s.palabras}`).split(/\s+/).some((p) => p.startsWith(t)) || simple(s.nombre).includes(t));
}
