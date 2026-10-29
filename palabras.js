// Banco de palabras por modo de juego. Agrega, quita o cambia lo que quieras.
//
// Formato de cada palabra (sin artículos: "perro", no "el perro"):
//   'perro'                         → solo esa palabra
//   'carro|coche|auto'              → la primera es la que se dibuja; las demás también cuentan como respuesta
//   'yuki|raspado :: hielo raspado' → después de "::" va qué significa. Lo ve quien dibuja
//                                     y todos al revelar la palabra. Útil para modismos.
module.exports = {
  // ---------- Modo Clásico ----------
  clasico: {
    facil: [
      'perro', 'gato', 'casa', 'sol', 'luna', 'árbol', 'flor', 'pez', 'pájaro', 'manzana',
      'plátano', 'carro|coche|auto', 'bicicleta|bici', 'avión', 'barco', 'pelota', 'zapato', 'sombrero', 'lentes|anteojos|gafas', 'reloj',
      'llave', 'puerta', 'ventana', 'cama', 'silla', 'mesa', 'taza', 'cuchara', 'tenedor', 'vaso',
      'botella', 'libro', 'lápiz', 'tijeras', 'globo', 'pastel', 'helado|nieve', 'pizza', 'hamburguesa', 'huevo',
      'nube', 'lluvia', 'estrella', 'corazón', 'montaña', 'playa', 'serpiente|víbora', 'araña', 'caracol', 'tortuga',
      'conejo', 'ratón', 'elefante', 'jirafa', 'león', 'vaca', 'cerdo|puerco|cochino', 'pollo', 'oso', 'mariposa',
      'abeja', 'hormiga', 'rana', 'pato', 'búho|lechuza', 'tiburón', 'ballena', 'pulpo', 'cangrejo', 'uvas',
      'fresa', 'piña', 'sandía', 'zanahoria', 'elote|mazorca', 'taco', 'dona', 'galleta', 'paleta', 'camisa',
      'pantalón', 'calcetín', 'guante', 'paraguas|sombrilla', 'mochila', 'teléfono|celular', 'televisión|tele|tv', 'computadora|compu|laptop', 'guitarra', 'tambor',
      'campana', 'vela', 'foco|bombilla', 'escalera', 'martillo', 'cohete', 'tren', 'autobús|camión', 'camión de carga|camión', 'robot',
      'fantasma', 'corona', 'bandera', 'regalo', 'ojo', 'nariz', 'boca', 'mano', 'pie', 'diente',
    ],
    medio: [
      'dinosaurio', 'dragón', 'sirena', 'pirata', 'vampiro', 'astronauta', 'payaso', 'bombero', 'doctor|médico', 'policía',
      'chef|cocinero', 'cartero', 'futbol', 'básquetbol|basquetbol|basket', 'boliche', 'karate', 'columpio', 'resbaladilla|tobogán', 'piñata', 'mariachi',
      'tienda de campaña|casa de campaña', 'fogata', 'castillo', 'puente', 'faro', 'volcán', 'isla', 'cascada', 'desierto', 'iglesia',
      'hospital', 'escuela', 'aeropuerto', 'semáforo', 'gasolinera', 'elevador', 'refrigerador|refri', 'lavadora', 'microondas', 'licuadora',
      'aspiradora', 'ventilador|abanico', 'plancha', 'regadera', 'excusado|baño|inodoro|taza del baño', 'cepillo de dientes', 'peine', 'espejo', 'almohada', 'chimenea',
      'buzón', 'trofeo', 'medalla', 'mapa', 'brújula', 'telescopio', 'microscopio', 'imán', 'batería|pila', 'audífonos',
      'control remoto|control', 'cámara', 'patineta', 'patines', 'paracaídas', 'helicóptero', 'submarino', 'ambulancia', 'tractor', 'globo aerostático',
      'arcoíris', 'tornado', 'relámpago|rayo', 'muñeco de nieve', 'calabaza', 'telaraña', 'esqueleto', 'momia', 'bruja', 'unicornio',
      'extraterrestre|alien|marciano', 'ovni', 'camello', 'pingüino', 'canguro', 'koala', 'mono|chango', 'cocodrilo', 'flamenco', 'pavo real',
      'caballo', 'oveja', 'chivo|cabra', 'murciélago', 'gusano', 'ajolote', 'nopal', 'cactus', 'palmera', 'hongo',
      'girasol', 'tamal', 'quesadilla', 'pozole', 'churro', 'concha', 'aguacate', 'torta', 'palomitas', 'salchicha',
      'espagueti', 'sushi', 'sartén', 'olla', 'semilla', 'ancla', 'velero', 'bolsa', 'cinturón', 'corbata',
    ],
    dificil: [
      'bailar', 'nadar', 'dormir', 'cocinar', 'llorar', 'estornudar', 'bostezar', 'roncar', 'pescar', 'escalar',
      'tejer', 'surfear', 'esquiar', 'acampar', 'cantar en la regadera', 'hacer ejercicio', 'sacar la basura', 'lavar los trastes', 'pasear al perro', 'tomar una selfie|selfie',
      'cambiar una llanta', 'dolor de cabeza', 'cumpleaños', 'boda', 'graduación', 'vacaciones', 'Navidad', 'Día de Muertos', 'Año Nuevo', 'luna de miel',
      'amor a primera vista', 'tráfico', 'fila del banco', 'apagón', 'mudanza', 'eclipse', 'gravedad', 'pesadilla', 'eco', 'sombra',
      'reflejo', 'silencio', 'internet', 'contraseña', 'contaminación', 'reciclaje', 'terremoto|temblor|sismo', 'huracán', 'hipo', 'cosquillas',
      'mareo', 'maratón', 'olimpiadas', 'karaoke', 'carne asada', 'posada', 'tianguis', 'lucha libre', 'charro', 'alebrije',
      'catrina', 'papel picado', 'ofrenda', 'mole', 'chiles en nogada', 'torre Eiffel', 'pirámide', 'estatua de la libertad', 'Ángel de la Independencia', 'trajinera',
      'marioneta|títere', 'ventrílocuo', 'domador de leones', 'mago', 'malabarista', 'detective', 'ladrón|ratero', 'rey', 'princesa', 'momento incómodo',
      'jardinero', 'peluquero', 'dentista', 'fotógrafo', 'arqueólogo', 'mesero', 'taxista', 'fiesta sorpresa', 'cita a ciegas', 'examen sorpresa',
    ],
  },

  // ---------- Modo Regio: puro Monterrey ----------
  regio: {
    // Cosas que se ven: comida, carne asada, la casa regia
    facil: [
      'carne asada|carnita asada', 'asador|parrilla', 'carbón', 'hielera', 'cheve|cerveza|chela :: cerveza', 'caguama|cerveza grande :: cerveza de litro',
      'tortillas de harina|tortilla de harina', 'cabrito|chivo :: cabrito al pastor, el platillo regio', 'arrachera', 'salchichas para asar|salchichas|salchicha',
      'cebollitas asadas|cebollitas|cebollas asadas', 'chiles toreados|chile toreado', 'frijoles charros|charros', 'machacado con huevo|machacado :: carne seca deshebrada con huevo',
      'glorias|gloria :: dulce de leche quemada con nuez', 'yuki|raspado :: hielo raspado con jarabe', 'lonche|torta :: torta', 'quequito|panquecito|mantecada :: pastelito',
      'durito|duritos|chicharrón de harina :: botana de harina frita', 'troca|camioneta|pickup :: camioneta', 'nave|carro|coche :: el carro', 'abanico|ventilador :: ventilador',
      'bordo|tope :: tope de la calle', 'mini split|minisplit|aire acondicionado|clima :: el aire acondicionado de la pared', 'Topo Chico|agua mineral',
      'sombrero vaquero|sombrero texano|tejana', 'botas vaqueras|botas', 'acordeón', 'calorón|calor :: el calor de 40 grados', 'cachucha|gorra',
      'hielo en bolsa|bolsa de hielo', 'pan de elote', 'empalme :: tortillas de maíz con frijoles y chorizo', 'chicharrón', 'carne seca',
      'elote en vaso|esquites|elote', 'molcajete', 'tráiler|trailer', 'nuez|nueces', 'chorizo', 'papa asada|papas en aluminio', 'pinzas para asar|pinzas',
      'aguja norteña|aguja :: corte de carne para asar', 'tortillería', 'bistec', 'cerveza de barril|barril',
    ],
    // Lugares, futbol y vida en la ciudad
    medio: [
      'Cerro de la Silla :: el cerro símbolo de Monterrey', 'Cerro de las Mitras|las Mitras', 'Chipinque', 'Parque Fundidora|Fundidora',
      'Horno 3 :: el alto horno del Parque Fundidora', 'Paseo Santa Lucía|Santa Lucía :: río artificial con lanchitas', 'Macroplaza',
      'Faro del Comercio :: la torre naranja con láser', 'Puente Atirantado :: el puente con el mástil inclinado', 'Obispado', 'Barrio Antiguo',
      'Grutas de García|grutas|cueva', 'Cola de Caballo :: la cascada de Santiago', 'Presa de la Boca|presa :: la presa de Santiago', 'Huasteca|la Huasteca',
      'Estadio BBVA|el Gigante de Acero :: el estadio de Rayados', 'Estadio Universitario|el Volcán :: el estadio de Tigres', 'Tigres :: el equipo de la UANL',
      'Rayados :: el equipo del Monterrey', 'Sultanes :: el equipo de béisbol', 'Mundial 2026|Mundial :: Monterrey es sede', 'Metrorrey|metro',
      'camión urbano|camión|ruta', 'McAllen :: a donde van de compras', 'Isla del Padre|South Padre|Padre Island :: la playa de los regios',
      'Tec de Monterrey|Tec', 'UANL|la Uni|universidad', 'Cervecería Cuauhtémoc|cervecería', 'Oxxo|tiendita :: nació en Monterrey',
      'San Pedro :: San Pedro Garza García', 'garza :: el ave y el apellido más regio', 'grupo norteño|norteño|conjunto norteño', 'bajo sexto',
      'polka|polka norteña', 'cabrito al pastor :: cabrito asado en estaca', 'contingencia ambiental|contingencia|smog', 'Santiago|pueblo mágico',
      'La Pastora|zoológico', 'Bioparque|safari', 'carril confinado|Ecovía', 'tortillas recién hechas',
      'cochera :: donde se hace la carne asada', 'chimenea de fábrica|fábrica', 'nieve de garrafa|nieve', 'aguas frescas', 'feria de Guadalupe|feria',
    ],
    // Dichos, forma de hablar y costumbres (con picante)
    dificil: [
      'tirar a león|dejar plantado|plantado :: dejar plantado a alguien', 'sordear|hacerse sordo|ignorar :: hacerse el que no oye',
      'poner gorro|insistir|rogar :: insistir hasta conseguir algo', 'te la bañaste|la regaste|meter la pata :: te pasaste o la regaste',
      '¿jalas o no jalas?|jalas|jalar :: ¿te apuntas?', 'jale|trabajo|chamba :: trabajo', 'tirar carro|coquetear|ligar :: coquetear',
      'carrilla|burla|carrillar :: bromas pesadas entre amigos', 'perreársela|irse de pinta|pinta :: faltar a clases',
      'acoplado|colado :: el que llega a la fiesta sin invitación', 'empelotado|enamorado :: perdidamente enamorado', 'licha|chismosa :: chismosa',
      'chiqueado|consentido :: consentido', 'puchar|empujar :: empujar (del inglés push)', 'sobres|va :: sí, va', 'sacas|entiendes :: ¿entiendes?',
      'cruda|resaca :: la resaca', 'pistear|tomar|chupar :: tomar alcohol', 'huerco|niño|chamaco :: niño', 'bien pata|chafa :: de mala calidad',
      'mamalón|chingón|muy bueno :: buenísimo', 'está con madre|con madre :: está muy bien', 'azorrillado|agobiado :: agobiado, presionado',
      'al tiro|alerta|atento :: estar atento', 'feria|cambio|monedas :: dinero suelto', 'bolas|varos|pesos :: pesos, dinero', 'chisqueado|loco :: loco',
      'bien acoplado|a gusto :: muy a gusto, como en casa', 'codo|tacaño :: tacaño (la fama regia)', 'fresa de San Pedro|fresa :: niño bien de San Pedro',
      'ir a McAllen de compras|compras en McAllen', 'carne asada de domingo', 'calor de 40 grados|calorón', 'manejar como regio|manejar rápido',
      'boda regia|boda', 'apellido Garza', 'clima loco :: frío en la mañana, calor en la tarde', 'invitar a la carne asada',
      'quemar la carne', 'echar la hueva|hueva|flojera :: flojera', 'la cruda del lunes|cruda', 'Noreste Caliente :: la rola regia por excelencia',
      'clásico regio :: Tigres contra Rayados', 'festejar en la Macroplaza', 'subir el Cerro de la Silla', 'irse al rancho|rancho',
      'echar carne|asar carne :: hacer carne asada', 'andar pisteando|pisteando :: andar tomando', 'tráfico en Constitución|tráfico',
      'hablar con acento regio|acento regio', 'gritar gol en el clásico|gol', 'ir a la presa :: paseo de fin de semana',
    ],
  },
};
