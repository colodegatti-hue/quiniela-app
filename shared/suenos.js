// =====================================================================
// suenos.js — Significado tradicional de los números (00 al 99)
// La tabla popular de la quiniela argentina. Hay pequeñas variantes
// según la zona; esta es la más difundida.
// "palabras" = otras formas de buscarlo (lo que alguien soñó)
// "dibujo" = emoji que se muestra al lado del número
// "sonar" = qué sueños se juegan a ese número (se muestra en la tabla)
// (compartido entre la app y el servidor: se usa también en los avisos)
// =====================================================================

const TABLA = [
  ['00', 'Los huevos', 'huevo', '🥚', 'huevos, gallinero, nido, desayuno'],
  ['01', 'El agua', 'mar pileta rio nadar', '💧', 'agua, mar, pileta, río, nadar, bañarse'],
  ['02', 'El niño', 'bebe chico hijo nene', '👶', 'un bebé, un nene, un hijo, una cuna, un chico'],
  ['03', 'San Cono', 'santo suerte', '🍀', 'un santo, la suerte, una estampita, ganar'],
  ['04', 'La cama', 'dormir', '🛏️', 'una cama, dormir, una siesta, sábanas'],
  ['05', 'El gato', 'gata', '🐈', 'un gato, una gata, gatitos'],
  ['06', 'El perro', 'perra', '🐕', 'un perro, una perra, cachorros, ladridos'],
  ['07', 'El revólver', 'arma pistola tiro', '🔫', 'un revólver, un arma, una pistola, un tiro'],
  ['08', 'El incendio', 'fuego quemar', '🔥', 'un incendio, fuego, algo quemándose, bomberos'],
  ['09', 'El arroyo', 'rio', '🏞️', 'un arroyo, un río, un puente, pescar en el río'],
  ['10', 'La leche', 'vaca tomar', '🥛', 'leche, una vaca, un tambo, tomar leche'],
  ['11', 'El palito', 'minero palo', '🪵', 'un palito, un palo, un minero, leña'],
  ['12', 'El soldado', 'militar guerra', '💂', 'un soldado, un militar, la guerra, un uniforme'],
  ['13', 'La yeta', 'mala suerte', '🐈‍⬛', 'mala suerte, un gato negro, un espejo roto'],
  ['14', 'El borracho', 'alcohol mamado', '🍺', 'un borracho, alcohol, estar mamado, una borrachera'],
  ['15', 'La niña bonita', 'nena chica linda', '👧', 'una niña linda, una nena, una chica bonita'],
  ['16', 'El anillo', 'joya', '💍', 'un anillo, una joya, una alianza, oro'],
  ['17', 'La desgracia', 'accidente', '⚠️', 'una desgracia, un accidente, una tragedia'],
  ['18', 'La sangre', 'herida', '🩸', 'sangre, una herida, un corte'],
  ['19', 'El pescado', 'pez pescar', '🐟', 'un pescado, un pez, pescar, la pescadería'],
  ['20', 'La fiesta', 'cumpleaños baile', '🎉', 'una fiesta, un cumpleaños, un baile, una torta'],
  ['21', 'La mujer', 'señora', '👩', 'una mujer, una señora, una dama'],
  ['22', 'El loco', 'locura', '🤪', 'un loco, la locura, el manicomio'],
  ['23', 'El cocinero', 'cocina comida', '👨‍🍳', 'un cocinero, cocinar, la cocina, comida'],
  ['24', 'El caballo', 'yegua', '🐎', 'un caballo, una yegua, montar, las carreras'],
  ['25', 'La gallina', 'pollo', '🐔', 'una gallina, un pollo, un gallo, pollitos'],
  ['26', 'La misa', 'iglesia rezar', '⛪', 'la misa, la iglesia, rezar, un cura'],
  ['27', 'El peine', 'pelo', '💇', 'un peine, peinarse, el pelo, la peluquería'],
  ['28', 'Los cerros', 'montaña sierra', '⛰️', 'los cerros, una montaña, las sierras, escalar'],
  ['29', 'San Pedro', 'llaves', '🔑', 'San Pedro, unas llaves, una puerta, el cielo'],
  ['30', 'Santa Rosa', 'tormenta', '⛈️', 'Santa Rosa, una tormenta, viento fuerte'],
  ['31', 'La luz', 'lampara', '💡', 'la luz, una lámpara, una vela, electricidad'],
  ['32', 'El dinero', 'plata guita billete', '💰', 'dinero, plata, billetes, ganar plata, un banco'],
  ['33', 'Cristo', 'edad jesus', '✝️', 'Cristo, Jesús, una cruz, la edad de Cristo'],
  ['34', 'La cabeza', 'pensar', '🧠', 'una cabeza, pensar, dolor de cabeza'],
  ['35', 'El pajarito', 'pajaro', '🐦', 'un pajarito, un pájaro, una jaula, volar'],
  ['36', 'La manteca', 'grasa', '🧈', 'manteca, grasa, untar'],
  ['37', 'El dentista', 'dientes muela', '🦷', 'el dentista, dientes, una muela, que se cae un diente'],
  ['38', 'El aceite', 'aceitera', '🫒', 'aceite, una aceitera, freír'],
  ['39', 'La lluvia', 'llover agua', '🌧️', 'lluvia, llover, un paraguas, mojarse'],
  ['40', 'El cura', 'sacerdote', '🙏', 'un cura, un sacerdote, confesarse'],
  ['41', 'El cuchillo', 'cortar', '🔪', 'un cuchillo, cortar, un puñal'],
  ['42', 'Las zapatillas', 'zapatos', '👟', 'zapatillas, zapatos, calzado, caminar'],
  ['43', 'El balcón', 'ventana', '🏠', 'un balcón, una ventana, asomarse'],
  ['44', 'La cárcel', 'preso policia', '⛓️', 'la cárcel, un preso, la policía, rejas'],
  ['45', 'El vino', 'tomar', '🍷', 'vino, tomar vino, una botella, uvas'],
  ['46', 'Los tomates', 'verdura', '🍅', 'tomates, verduras, la verdulería, ensalada'],
  ['47', 'El muerto', 'difunto velorio', '💀', 'un muerto, un difunto, un velorio, un cajón'],
  ['48', 'El muerto que habla', 'difunto', '👻', 'un muerto que habla, un difunto que te dice algo'],
  ['49', 'La carne', 'asado', '🥩', 'carne, un asado, la carnicería, parrilla'],
  ['50', 'El pan', 'panaderia', '🍞', 'pan, la panadería, facturas, harina'],
  ['51', 'El serrucho', 'herramienta', '🪚', 'un serrucho, herramientas, carpintería, cortar madera'],
  ['52', 'Madre e hijo', 'mama', '🤱', 'una madre con su hijo, mamá, un embarazo'],
  ['53', 'El barco', 'viaje', '🚢', 'un barco, un viaje, el puerto, navegar'],
  ['54', 'La vaca', 'campo', '🐄', 'una vaca, el campo, un toro, ganado'],
  ['55', 'La música', 'cantar canción', '🎵', 'música, cantar, una canción, un recital'],
  ['56', 'La caída', 'caer', '🤕', 'una caída, caerse, tropezar'],
  ['57', 'El jorobado', 'joroba', '🧙', 'un jorobado, una joroba'],
  ['58', 'El ahogado', 'ahogarse', '🌊', 'un ahogado, ahogarse, hundirse en el agua'],
  ['59', 'Las plantas', 'flores jardin arbol', '🪴', 'plantas, flores, un jardín, un árbol'],
  ['60', 'La Virgen', 'maria', '😇', 'la Virgen, María, una procesión'],
  ['61', 'La escopeta', 'caza arma', '🎯', 'una escopeta, la caza, un arma larga'],
  ['62', 'La inundación', 'agua', '🌊', 'una inundación, mucha agua, una creciente'],
  ['63', 'El casamiento', 'boda novia', '💒', 'un casamiento, una boda, una novia, un vestido blanco'],
  ['64', 'El llanto', 'llorar', '😢', 'llanto, llorar, tristeza'],
  ['65', 'El cazador', 'cazar', '🏹', 'un cazador, cazar, el monte'],
  ['66', 'Las lombrices', 'gusanos', '🪱', 'lombrices, gusanos, la tierra'],
  ['67', 'La víbora', 'serpiente', '🐍', 'una víbora, una serpiente, una culebra'],
  ['68', 'Los sobrinos', 'sobrino', '👦', 'los sobrinos, un sobrino, una sobrina'],
  ['69', 'Los vicios', 'vicio', '🚬', 'los vicios, un vicio, apostar'],
  ['70', 'El muerto que sueña', 'difunto', '💤', 'un muerto que sueña, soñar con un difunto'],
  ['71', 'El excremento', 'caca', '💩', 'excremento, caca, pisar algo (dicen que trae plata)'],
  ['72', 'La sorpresa', 'regalo', '🎁', 'una sorpresa, un regalo, algo inesperado'],
  ['73', 'El hospital', 'enfermo', '🏥', 'un hospital, un enfermo, una ambulancia'],
  ['74', 'La oscuridad', 'noche', '🌑', 'la oscuridad, la noche, un apagón'],
  ['75', 'Los besos', 'beso', '💋', 'besos, un beso, besar'],
  ['76', 'Las llamas', 'fuego', '🔥', 'llamas, fuego, una fogata'],
  ['77', 'Las piernas de mujer', 'piernas', '🦵', 'las piernas de una mujer, piernas'],
  ['78', 'La dama de la noche', 'noche', '🌙', 'la dama de la noche, una mujer de noche'],
  ['79', 'El ladrón', 'robo robar', '🦹', 'un ladrón, un robo, que te roban'],
  ['80', 'La bocha', 'pelota', '⚽', 'una bocha, una pelota, jugar a las bochas'],
  ['81', 'Las flores', 'flor', '🌸', 'flores, un ramo de flores, una flor'],
  ['82', 'La pelea', 'pelear discusion', '🥊', 'una pelea, pelear, una discusión'],
  ['83', 'El mal tiempo', 'tormenta', '🌪️', 'mal tiempo, una tormenta, granizo'],
  ['84', 'La iglesia', 'misa', '⛪', 'una iglesia, la misa, campanas'],
  ['85', 'La linterna', 'luz', '🔦', 'una linterna, una luz en la oscuridad'],
  ['86', 'El humo', 'fumar', '💨', 'humo, fumar, un cigarrillo'],
  ['87', 'Los piojos', 'piojo', '🪳', 'piojos, un piojo, picazón'],
  ['88', 'El Papa', 'francisco', '🕊️', 'el Papa, Francisco, el Vaticano'],
  ['89', 'La rata', 'raton', '🐀', 'una rata, un ratón, ratas'],
  ['90', 'El miedo', 'susto', '😱', 'miedo, un susto, una pesadilla'],
  ['91', 'El excusado', 'baño inodoro', '🚽', 'el excusado, el baño, el inodoro'],
  ['92', 'El médico', 'doctor', '🩺', 'un médico, un doctor, una consulta'],
  ['93', 'El enamorado', 'amor novio', '😍', 'un enamorado, el amor, un novio, una novia'],
  ['94', 'El cementerio', 'tumba', '🪦', 'el cementerio, una tumba, flores para un difunto'],
  ['95', 'Los anteojos', 'lentes', '👓', 'anteojos, lentes, ver mal'],
  ['96', 'El marido', 'esposo', '🤵', 'un marido, un esposo'],
  ['97', 'La mesa', 'comer', '🍽️', 'una mesa, comer, una cena'],
  ['98', 'La lavandera', 'lavar ropa', '🧺', 'una lavandera, lavar ropa, un lavarropas'],
  ['99', 'Los hermanos', 'hermano hermana', '👫', 'los hermanos, un hermano, una hermana'],
];

export const SUENOS = TABLA.map(([n, nombre, palabras, dibujo, sonar]) => ({ n, nombre, palabras, dibujo, sonar }));

export const suenoDe = (n) => SUENOS.find((s) => s.n === String(n).padStart(2, '0').slice(-2)) ?? null;

// Sin acentos ni mayúsculas, para comparar
const simple = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Busca por número ("47", "7") o por palabra ("perro", "plata")
export function buscarSueno(texto) {
  const t = simple(texto);
  if (!t) return SUENOS;
  if (/^\d{1,2}$/.test(t)) return SUENOS.filter((s) => s.n === t.padStart(2, '0'));
  const palabra = (texto) => simple(texto).split(/[\s,()]+/).some((p) => p.startsWith(t));
  // Primero los que coinciden con el nombre de la tabla, después los demás sueños
  const directos = SUENOS.filter((s) => palabra(`${s.nombre} ${s.palabras}`) || simple(s.nombre).includes(t));
  const otros = SUENOS.filter((s) => !directos.includes(s) && palabra(s.sonar));
  return [...directos, ...otros];
}
