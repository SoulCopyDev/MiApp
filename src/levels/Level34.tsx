import { exitLevel } from '../utils/exitLevel';
import { router } from 'expo-router';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { useReportProgress } from '../components/LevelProgress';
import { typography } from '../theme';
import XPToast from '../components/XPToast';
import { pickN } from '../utils/shuffle';

// ═══════════════════════════════════════════════════════════
// Nivel 34 · IA y Tu Planeta: El Futuro que Vas a Heredar (Mundo 6)
// Mundo 6 · TEMA CLARO (verde: #15803d / #16a34a / cyan #0891b2).
// Reconstruido vs nivel-34.html (estándar v2.2). Fuente de verdad = HTML.
// 19 módulos de contenido (steps 1-19). Máx XP real ≈ 205.
// ═══════════════════════════════════════════════════════════

const P = {
  screen: '#ffffff',
  ink: '#111827', body: '#374151', muted: '#6b7280', faint: '#9ca3af',
  green: '#16a34a', greenDark: '#15803d', cyan: '#0891b2',
  greenBg: '#dcfce7', greenText: '#166534', greenSoft: '#f0fdf4', greenBorder: '#bbf7d0',
  accentBg: '#ecfccb', accentText: '#064e3b',
  border: '#e5e7eb', cardBg: '#f9fafb',
  red: '#dc2626', redBg: '#fef2f2', redText: '#991b1b', redBorder: '#fecaca',
  amberBg: '#fef3c7', amberText: '#92400e', amberBorder: '#fde68a',
  orangeBg: '#fff7ed', orangeText: '#9a3412', orangeBorder: '#fed7aa',
  violetBg: '#fdf4ff', violetBorder: '#e9d5ff', violetText: '#5b21b6',
  codeBg: '#0f172a', codeText: '#e2e8f0', codeKey: '#86efac', codeEmpty: '#64748b',
};

const TOTAL_STEPS = 21;   // 0 intro · 1-19 módulos · 20 completado
const CONTENT_STEPS = 19;
// "Volver" solo en lecturas puras: teoría (1) + tarjetas expandibles (3,4,7,8,10,11,12,14,15,17)
const THEORY_STEPS = new Set([0, 1, 3, 4, 7, 8, 10, 11, 12, 14, 15, 17]);

type QuizQ = { q: string; opts: string[]; correct: number; explain: string };
type TFItem = { stmt: string; correct: boolean; explain: string };
type BuilderConfig = { xp: number; rows: { key: string; label: string; opts: string[] }[] };
type ExCard = { emoji: string; name: string; how: React.ReactNode; fact: string };

const shuffleOpts = (q: QuizQ): QuizQ => {
  const paired = q.opts.map((opt, i) => ({ opt, isCorrect: i === q.correct }));
  for (let j = paired.length - 1; j > 0; j--) { const k = Math.floor(Math.random() * (j + 1)); [paired[j], paired[k]] = [paired[k], paired[j]]; }
  return { ...q, opts: paired.map((p) => p.opt), correct: paired.findIndex((p) => p.isCorrect) };
};
const normalizeText = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const looksRandom = (text: string): boolean => {
  const words = normalizeText(text).split(/\s+/).filter((w) => w.length > 0);
  if (words.length < 5) return true;
  if (new Set(words).size / words.length < 0.5) return true;
  const noVowel = words.filter((w) => w.length >= 3 && !/[aeiou]/.test(w)).length;
  return noVowel / words.length > 0.3;
};
const REFLECT_TERMS = ['planeta', 'clima', 'climatico', 'climatica', 'ia', 'agua', 'energia', 'energetico', 'agricultura', 'incendio', 'sequia', 'contaminacion', 'contaminado', 'co2', 'carbono', 'renovable', 'solar', 'nuclear', 'satelite', 'dron', 'drone', 'reforest', 'bosque', 'arbol', 'oceano', 'mar', 'coral', 'pesca', 'temperatura', 'calor', 'inundacion', 'deepmind', 'firesat', 'sostenible', 'sostenibilidad', 'ambiental', 'medioambiente', 'emision', 'bogota', 'ciudad', 'futuro', 'tecnologia', 'prediccion', 'sensor', 'riego', 'cultivo', 'huracan', 'terremoto', 'activismo', 'carrera', 'empleo', 'trabajo', 'habilidad', 'programacion', 'biologia', 'planta', 'reciclaje', 'basura', 'transporte', 'trafico'];
const containsTopic = (text: string): boolean => {
  const n = normalizeText(text);
  const words = n.split(/[^a-z0-9]+/).filter(Boolean);
  return REFLECT_TERMS.some((t) => (t.length <= 3 ? words.includes(t) : n.includes(t)));
};

// ── Pools (fuente: nivel-34.html) — distractores alargados y plausibles (§15/27) ──
const DISASTERS_Q: QuizQ[] = [
  { q: 'Google FireSat detecta incendios forestales en menos de:', opts: ['Un día completo, tras revisar las imágenes satelitales de forma manual', '20 minutos desde el inicio (vs 2-4 horas del método tradicional)', 'Una semana, cuando el humo ya es visible desde otras ciudades', 'Una hora, el mismo tiempo que tardan las brigadas tradicionales'], correct: 1, explain: 'FireSat usa satélites + IA en tiempo real. Cada minuto cuenta: los incendios crecen exponencialmente en su primera hora.' },
  { q: '¿Puede la IA predecir terremotos?', opts: ['Sí, con varios días de anticipación y el epicentro exacto calculado', 'Solo con segundos a minutos, suficiente para detener trenes y cerrar el gas', 'No, es físicamente imposible detectar cualquier señal antes del sismo', 'Solo en Japón, gracias a una tecnología secreta que nadie más tiene'], correct: 1, explain: 'La IA detecta ondas P (rápidas, no destructivas) que llegan antes de las ondas S (destructivas). Da 5-60 segundos clave.' },
  { q: 'Sistemas como FloodHub de Google predicen inundaciones en:', opts: ['Solo Europa occidental, donde los grandes ríos ya están muy monitoreados', '80+ países, incluidas zonas de África, India y LATAM sin servicio meteorológico avanzado', 'Solo Asia, por ser la región con más riesgo de monzones e inundaciones fuertes', 'Solo EE.UU., usando la red de sensores de la agencia meteorológica NOAA'], correct: 1, explain: 'FloodHub democratizó predicción meteorológica precisa para regiones que nunca la habían tenido. Lanzado en 2022 y expandido en 2024.' },
  { q: '¿Qué hace la IA en monitoreo de huracanes que el método tradicional no?', opts: ['Inventa datos de viento donde faltan estaciones que midan la tormenta', 'Predice la trayectoria con 30% más precisión a 48 horas, con modelos como GraphCast (DeepMind)', 'Nada distinto: da exactamente el mismo pronóstico que los modelos de siempre', 'Solo cambia los colores del mapa para que la tormenta se vea más dramática'], correct: 1, explain: 'GraphCast (2024) supera a los modelos meteorológicos tradicionales en velocidad Y precisión. Corre en una laptop común, no necesita supercomputador.' },
  { q: 'Cuando ocurre un terremoto, los sistemas de alerta temprana ahora:', opts: ['Solo envían una notificación al celular, sin activar ningún otro sistema', 'Pueden detener trenes, cerrar el gas y alertar hospitales en segundos, sin intervención humana', 'Solo encienden luces de emergencia en los edificios públicos más cercanos', 'Solo hacen sonar campanas y sirenas, como se hacía hace más de cien años'], correct: 1, explain: 'ShakeAlert (EE.UU.) y sistemas similares usan IA para activar sistemas críticos automáticamente. Reducen mucho las muertes por accidentes secundarios.' },
];

const ENERGY_TF_Q: TFItem[] = [
  { stmt: 'Entrenar un modelo grande de IA consume tanta energía como una ciudad pequeña por un mes', correct: true, explain: 'GPT-4 consumió aproximadamente 50 GWh para entrenarse — equivalente al consumo de una ciudad pequeña.' },
  { stmt: 'Las grandes tecnológicas están construyendo o comprando plantas nucleares para alimentar sus IA', correct: true, explain: 'Microsoft, Google y Amazon firmaron acuerdos directos con plantas nucleares en 2023-2024 para sus data centers.' },
  { stmt: 'Cada vez que envías un mensaje a ChatGPT consumes lo mismo que una búsqueda en Google', correct: false, explain: 'Una consulta a un LLM consume ~10x más que una búsqueda en Google. Por eso el costo energético total preocupa.' },
  { stmt: 'La IA puede ahorrar más energía de la que consume si se usa estratégicamente', correct: true, explain: 'Estudio del MIT: cada $1 invertido en IA para optimización energética puede ahorrar $5-10 en consumo global.' },
  { stmt: 'Los data centers de Google ya funcionan con 100% de energía renovable', correct: false, explain: 'Van camino a ello: compran créditos de energía renovable equivalentes, pero la red real que usan sigue siendo mixta.' },
  { stmt: 'El consumo energético de la IA va a duplicarse cada año durante los próximos 5 años', correct: true, explain: 'Según predicciones de la IEA (Agencia Internacional de Energía). El reto es si la energía limpia escala más rápido.' },
  { stmt: 'Generar una imagen con DALL-E consume aproximadamente lo mismo que cargar tu teléfono', correct: true, explain: "Es cierto de forma aproximada. Por eso 'usar IA para todo' tiene costos ambientales reales que se van sumando." },
  { stmt: 'El costo energético de la IA es trivial comparado con el de otras industrias', correct: false, explain: 'IA + cripto ya son ~2% del consumo eléctrico global y creciendo. Es comparable a la aviación civil.' },
];

const ENV_Q: QuizQ[] = [
  { q: '¿En cuánto redujo DeepMind el consumo energético de los data centers de Google?', opts: ['10%, ajustando solo el horario en que se encienden los servidores', '40% en refrigeración, evitando millones de toneladas de CO₂', '5%, apenas lo justo para cubrir el costo del propio sistema de IA', '0%: en la práctica el experimento no logró ningún ahorro real'], correct: 1, explain: 'Caso emblemático de 2016: la IA optimizó algo tan concreto como cuándo activar los ventiladores de enfriamiento. Resultado: 40% menos energía.' },
  { q: 'Google FireSat detecta incendios forestales en:', opts: ['Varios días, cuando el fuego ya arrasó cientos de hectáreas de bosque', 'Menos de 20 minutos desde el inicio (vs 2-4 horas del método tradicional)', 'Semanas, al comparar fotos satelitales viejas con las más recientes', 'Solo si un humano lo reporta antes por teléfono a los bomberos'], correct: 1, explain: 'FireSat: satélites + IA en tiempo real. Cada minuto cuenta — un incendio no detectado en una hora puede crecer 100x.' },
  { q: 'John Deere See & Spray reduce el uso de pesticidas hasta:', opts: ['10%, rociando igual todo el campo pero con dosis un poco menores', '90%, al rociar solo las malezas detectadas y no el campo entero', '20%, apagando los aspersores solo en los bordes del terreno cultivado', '50%, alternando el riego de pesticida un surco sí y un surco no'], correct: 1, explain: 'Operativo desde 2023 en EE.UU., Brasil y Argentina. Combina cámaras + IA + spray preciso: es el caso de uso ideal de la IA agrícola.' },
  { q: '¿Por qué Microsoft está comprando energía nuclear?', opts: ['Por novedad, para aparecer en las noticias como una empresa moderna', 'Sus data centers de IA necesitan electricidad estable masiva y la nuclear es más limpia que el carbón', 'Por moda, porque otras empresas de tecnología también lo están haciendo', 'Sin una razón clara: fue una decisión sin relación con sus data centers'], correct: 1, explain: 'Tendencia 2023-2024: los gigantes tech compran o reactivan plantas nucleares directamente. La IA revivió la energía nuclear como opción climática viable.' },
  { q: 'Climate Trace mide emisiones industriales de:', opts: ['Solo Europa, usando los reportes que cada gobierno entrega cada año', 'Cada planta industrial del mundo, con datos públicos gratuitos por IA + satélite', 'Solo EE.UU., a partir de los sensores instalados en cada fábrica grande', 'Apenas 10 países ricos que aceptaron voluntariamente ser monitoreados'], correct: 1, explain: 'Transparencia radical con IA. Antes los gobiernos podían ocultar sus emisiones reales; ahora cualquiera puede verificarlas.' },
  { q: 'El reto del costo energético de la IA es:', opts: ['No existe: los data centers consumen casi lo mismo que un hogar promedio', 'Crece exponencialmente, pero la IA misma puede optimizar el consumo total si se usa estratégicamente', 'Es trivial y ya está resuelto por completo con los paneles solares actuales', 'Solo aplica a las criptomonedas, nunca a los modelos de inteligencia artificial'], correct: 1, explain: 'Paradoja: la IA consume mucho pero también ahorra mucho. La pregunta es si los ahorros superan a los costos a tiempo.' },
];

const BUILDER_SMART_CITY: BuilderConfig = { xp: 22, rows: [
  { key: 'trafico', label: 'Sistema de TRÁFICO inteligente', opts: ['Semáforos que se adaptan en tiempo real al flujo vehicular', 'Predicción de congestión 30 min adelante con desvíos sugeridos', 'Sistema integrado con transporte público + auto + bici', 'Detección automática de accidentes con respuesta de emergencia'] },
  { key: 'basura', label: 'Sistema de BASURA inteligente', opts: ['Sensores en contenedores que avisan cuándo recoger (-30% rutas)', 'Clasificación automática con IA + cámaras (mejor reciclaje)', 'Compactadores solares que avisan su capacidad', 'Drones para revisar basura ilegal en zonas inaccesibles'] },
  { key: 'agua', label: 'Sistema de AGUA inteligente', opts: ['Detección de fugas en acueductos con sensores IoT', 'Predicción de demanda según clima + evento + zona', 'Calidad del agua monitoreada en tiempo real con IA', 'Riego automático de parques según la humedad real del suelo'] },
  { key: 'aire', label: 'Sistema de AIRE inteligente', opts: ['Red de sensores barriales con IA que predice picos de contaminación', 'Alertas personalizadas por barrio en una app oficial', 'Cámaras que detectan vehículos contaminantes (pico y placa inteligente)', 'Drones de monitoreo en zonas industriales'] },
] };

const BUILDER_SUSTAINABLE: BuilderConfig = { xp: 22, rows: [
  { key: 'energia', label: 'Sistema de ENERGÍA limpia', opts: ['100% renovable (solar en techos + eólica urbana + baterías comunitarias)', 'Mix con nuclear pequeña (SMR) + renovables + IA optimizando la red', 'Sistema híbrido con incentivos masivos para autoabastecimiento solar', 'Red distribuida ciudadana donde cada hogar es generador'] },
  { key: 'transporte', label: 'Sistema de TRANSPORTE', opts: ['Metro/tranvía 100% eléctrico autónomo + bici + caminar', 'Autos compartidos autónomos eléctricos (no propiedad personal)', 'Multimodal con una app única que combina opciones por viaje', 'Sistema aéreo (eVTOL) para largas distancias + tierra para corto'] },
  { key: 'alimentos', label: 'Sistema de ALIMENTACIÓN', opts: ['Agricultura urbana vertical en cada barrio (cero transporte)', 'Producción periurbana con IA + drones (90% local)', 'Mercado de cercanía con app que conecta productores y consumidores', 'Cero desperdicio: IA predice demanda + redistribuye sobrantes'] },
  { key: 'agua', label: 'Sistema de AGUA', opts: ['Captación pluvial + reciclaje de aguas grises en cada edificio', 'Acueducto inteligente con sensores + IA + cero fugas', 'Plantas desalinizadoras solares (si es zona costera)', 'Educación ciudadana + medición individual + tarifa progresiva'] },
  { key: 'naturaleza', label: 'Sistema de NATURALEZA', opts: ['Bosque urbano denso (mínimo 30% del área es verde)', 'Corredores biológicos para fauna + ríos urbanos restaurados', 'Agricultura mixta con biodiversidad (no monocultivo)', 'Mar + montaña + ríos protegidos con IA monitoreando 24/7'] },
] };

const tagVariants = {
  intro: { box: { backgroundColor: P.accentBg }, text: { color: P.accentText } },
  theory: { box: { backgroundColor: P.greenSoft }, text: { color: P.greenText } },
  activity: { box: { backgroundColor: '#eff6ff' }, text: { color: '#1e40af' } },
  build: { box: { backgroundColor: P.accentBg }, text: { color: P.accentText } },
  example: { box: { backgroundColor: P.orangeBg }, text: { color: P.orangeText } },
  quiz: { box: { backgroundColor: P.amberBg }, text: { color: P.amberText } },
  reflect: { box: { backgroundColor: '#f3f4f6' }, text: { color: '#374151' } },
} as const;
const Tag = ({ icon, label, variant }: { icon: string; label: string; variant: keyof typeof tagVariants }) => (
  <View style={[styles.tag, tagVariants[variant].box]}><Text style={[styles.tagText, tagVariants[variant].text]}>{icon}  {label}</Text></View>
);
const Title = ({ children }: { children: React.ReactNode }) => <Text style={styles.title}>{children}</Text>;
const Sub = ({ children }: { children: React.ReactNode }) => <Text style={styles.sub}>{children}</Text>;
const Body = ({ children }: { children: React.ReactNode }) => <Text style={styles.bodyText}>{children}</Text>;
const B = ({ children }: { children: React.ReactNode }) => <Text style={styles.bold}>{children}</Text>;

const EXAMPLES: { [k: number]: { icon: string; label: string; title: string; sub: string; cards: ExCard[] } } = {
  3: {
    icon: '🌡️', label: 'Módulo 3 de 19 · Estado real', title: 'El planeta YA cambió', sub: '3 datos concretos que cambian cómo ves el momento que vives. Toca cada tarjeta 👆',
    cards: [
      { emoji: '🌡️', name: 'El planeta YA cambió', how: <><B>2024 fue el primer año en superar +1.5°C</B> sobre niveles preindustriales, según Copernicus (UE). El umbral del Acuerdo de París, que se buscaba evitar para 2050, lo cruzamos antes. Las olas de calor, sequías e inundaciones extremas son la nueva normal — no excepciones.</>, fact: '⭐ Lo que esto significa para ti: tendrás 30-50 años más en este mundo. Las decisiones de los próximos 10 años deciden si será habitable como hoy o muy distinto. La IA puede ayudar — o consumir más recursos.' },
      { emoji: '💧', name: 'Agua: el recurso silencioso', how: <><B>2 mil millones de personas viven con escasez de agua hoy.</B> Bogotá racionó agua en 2024. Ciudad de México lleva años con crisis cíclica. São Paulo casi se quedó sin agua en 2014-15. La IA ahora monitorea acueductos completos en tiempo real: detecta fugas y predice demanda.</>, fact: '⭐ Caso real Bogotá: la EAAB usa IA desde 2023 para predecir el consumo y alertar fugas. Ha ahorrado millones de m³. Pero el problema sigue: el clima cambia los patrones de lluvia más rápido que la infraestructura.' },
      { emoji: '🔥', name: 'Incendios y la IA que los anticipa', how: <><B>Los incendios forestales aumentaron 4x desde 2000</B> en California, Australia y Siberia. La IA de Google FireSat los detecta en menos de 20 minutos desde su inicio (vs 2-4 horas tradicional). Cada minuto cuenta: un incendio no detectado en su primera hora puede crecer 100x.</>, fact: '⭐ FireSat opera en California desde 2024. Un incendio detectado por IA y apagado en 30 minutos habría quemado decenas de hectáreas. La IA NO detiene el cambio climático — pero ayuda a manejar sus consecuencias.' },
    ],
  },
  4: {
    icon: '💡', label: 'Módulo 4 de 19 · DeepMind', title: 'DeepMind, Google y la IA energética', sub: 'El caso emblemático y el dilema honesto: la IA consume Y ahorra. Toca cada tarjeta 👆',
    cards: [
      { emoji: '💡', name: 'DeepMind redujo 40% del consumo de Google', how: <>En 2016, Google DeepMind aplicó IA a la <B>refrigeración de sus data centers</B>. Resultado: 40% menos energía para enfriar = millones de toneladas de CO₂ evitadas. La misma técnica se replicó en otras empresas.</>, fact: '⭐ Paradoja: Google necesita más energía para entrenar IA, pero esa misma IA optimiza el consumo de su infraestructura. La carrera es ver si los ahorros superan el costo del entrenamiento.' },
      { emoji: '⚡', name: 'El costo energético del entrenamiento', how: <>Entrenar GPT-4 consumió aproximadamente <B>50 GWh — equivalente a una ciudad pequeña por 1 mes</B>. GPT-5 y modelos mayores consumirán órdenes de magnitud más. Esto presiona la red eléctrica masivamente.</>, fact: '⭐ Microsoft, Google y Amazon están construyendo o comprando energía nuclear directamente para alimentar sus data centers. Es una nueva era industrial: la IA reactivó la energía nuclear en EE.UU.' },
      { emoji: '♻️', name: 'El balance neto: ¿gana o pierde el planeta?', how: <>Estudio del MIT (2024): <B>cada $1 invertido en optimización con IA puede ahorrar $5-10 en consumo energético global</B>. Pero solo si se usa estratégicamente — no para chatear sobre nada o generar memes infinitos.</>, fact: "⭐ La pregunta correcta NO es 'IA sí o no', sino 'IA para qué'. Optimizar redes eléctricas: muy bueno. Generar 10,000 imágenes diarias de gatos: cuestionable ambientalmente." },
    ],
  },
  7: {
    icon: '🌾', label: 'Módulo 7 de 19 · Agricultura', title: 'IA en agricultura · Más comida con menos', sub: 'John Deere, sensores de riego, detección de plagas, menos desperdicio. Toca cada tarjeta 👆',
    cards: [
      { emoji: '🌾', name: 'John Deere See & Spray · Pesticidas precisos', how: <>Tractores con cámaras + IA que <B>detectan malezas individuales y rocían SOLO esas plantas, no todo el campo</B>. Reducen el uso de herbicida hasta 90%. Operativos desde 2023 en EE.UU., Brasil y Argentina.</>, fact: '⭐ Impacto LATAM: los grandes productores de soja en Argentina y Brasil lo adoptan rápido. Reduce costos + impacto ambiental. Los pequeños productores aún no tienen acceso por el costo del equipo.' },
      { emoji: '💦', name: 'Riego inteligente · CropX y similares', how: <>Sensores en el campo + IA que <B>determinan exactamente cuánta agua necesita CADA zona del cultivo</B>. Resultado: -30% de consumo de agua, +20% de productividad. Muy útil en zonas con escasez como California, Israel o regiones secas de México.</>, fact: '⭐ Caso colombiano: productores de café en Antioquia y Huila empiezan a usar sensores IoT + IA para optimizar el riego. La Federación Nacional de Cafeteros lidera la adopción.' },
      { emoji: '🍅', name: 'Detección de plagas · Plantix y AgroAI', how: <>App gratuita: el campesino <B>toma una foto de su planta enferma, la IA identifica la plaga o enfermedad en segundos</B> y recomienda tratamiento. Plantix tiene 30M+ usuarios en el mundo, la mayoría en países en desarrollo.</>, fact: '⭐ Democratización del conocimiento agrícola: antes necesitabas un agrónomo, ahora un teléfono. Caso de éxito real para reducir la brecha tecnológica rural.' },
      { emoji: '🥕', name: 'Reducción de desperdicio · IA en supermercados', how: <>Walmart, Carrefour y Éxito (Colombia) usan IA para <B>predecir la demanda real con precisión diaria</B>. Resultado: -25% de comida desperdiciada en tiendas. Globalmente se desperdicia el 30% de la comida: optimizar esto es enorme.</>, fact: '⭐ Si redujéramos a la mitad el desperdicio de comida, alimentaríamos a toda la humanidad sin nueva agricultura. La IA es clave para lograrlo.' },
    ],
  },
  8: {
    icon: '⚡', label: 'Módulo 8 de 19 · Energía', title: 'Energía limpia con IA', sub: 'Predicción solar, baterías inteligentes, energía oceánica. Toca cada tarjeta 👆',
    cards: [
      { emoji: '☀️', name: 'Predicción solar · Cómo la IA optimiza renovables', how: <>El problema clave de la energía solar: <B>varía con el clima, la hora y la estación</B>. La IA predice la producción solar con 24h de anticipación y 95% de precisión. Permite a las redes balancear oferta y demanda sin desperdiciar electricidad.</>, fact: '⭐ Sin esta tecnología, la transición a renovables es mucho más cara. España, Alemania y California lideran. LATAM apenas empieza — Chile y Brasil están a la vanguardia regional.' },
      { emoji: '🔋', name: 'Baterías inteligentes · Tesla Megapack y similares', how: <>Baterías industriales masivas que <B>almacenan energía solar/eólica de día para usar de noche</B>. La IA optimiza cuándo cargar/descargar según los precios eléctricos en tiempo real. Ya hay 'baterías virtuales' coordinando miles de baterías de hogares.</>, fact: '⭐ El mercado de almacenamiento eléctrico crece 60% anual. En los próximos 5 años, cada hogar con paneles solares tendrá batería y una app que la optimiza automáticamente.' },
      { emoji: '🌊', name: 'Predicción de mareas · Energía oceánica', how: <>Países como Reino Unido y Corea del Sur usan IA para <B>predecir mareas y diseñar plantas de energía oceánica</B>. La energía mareomotriz podría aportar hasta 20% de la electricidad mundial si optimizamos el diseño con IA.</>, fact: '⭐ Tecnología emergente, pero LATAM tiene potencial: las costas de Chile y Argentina son ideales por sus mareas extremas. La inversión apenas comienza.' },
    ],
  },
  10: {
    icon: '🌊', label: 'Módulo 10 de 19 · Océanos', title: 'IA que cuida los océanos', sub: 'Limpieza, pesca ilegal, salud de corales. Lo que el ojo humano no puede vigilar. Toca cada tarjeta 👆',
    cards: [
      { emoji: '🐢', name: 'Detección de basura marina con IA', how: <><B>The Ocean Cleanup</B> usa IA en sus barreras: distingue plástico de vida marina y optimiza dónde colocarlas según las corrientes. Han limpiado 13M kg de plástico en el Pacific Gyre desde 2019.</>, fact: '⭐ Sin IA, esto sería imposible. El océano es enorme + dinámico + complejo. La IA hace la limpieza factible económica y técnicamente.' },
      { emoji: '⚠️', name: 'Detección de pesca ilegal · Global Fishing Watch', how: <>Combinan datos de 50,000+ barcos pesqueros + IA + satélites. <B>Detectan pesca ilegal en aguas protegidas</B> y alertan a los guardacostas. Es open source: cualquiera puede usar la plataforma.</>, fact: '⭐ Antes los gobiernos no podían vigilar océanos completos. Ahora vigilan 100% del Pacífico, Atlántico e Índico en tiempo real. Caso de éxito brutal de IA para conservación.' },
      { emoji: '🐠', name: 'Coral Health Monitor · Salvar arrecifes', how: <>Cámaras submarinas con IA monitorean el <B>blanqueamiento de corales en tiempo real</B>. Australia, Indonesia, México y el Caribe lo usan. Responden con sombras artificiales, refrigerando el agua o transplantando corales sanos antes de la muerte total.</>, fact: '⭐ Los arrecifes son hábitat del 25% de la vida marina. Con IA monitoreando, las decisiones de conservación se toman en horas, no en meses.' },
    ],
  },
  11: {
    icon: '🛰️', label: 'Módulo 11 de 19 · Satélites', title: 'Satélites + IA · El planeta visto desde arriba', sub: 'Copernicus, Planet Labs, Global Forest Watch. Vigilancia ambiental masiva. Toca cada tarjeta 👆',
    cards: [
      { emoji: '🛰️', name: 'Copernicus (UE) · Vigila Europa y el mundo', how: <>Sistema de 5 satélites Sentinel + IA. Datos GRATUITOS para todos. <B>Cada 5 días tenemos una imagen actualizada del planeta entero.</B> Lo usan agricultores, gobiernos, ONGs y científicos de todo el mundo.</>, fact: '⭐ Los datos de Copernicus son la base de muchísima ciencia climática moderna. Vivas donde vivas, los efectos del clima en tu zona se calcularon usando estos datos.' },
      { emoji: '🛰️', name: 'Planet Labs · 200+ satélites diarios', how: <>Empresa privada con la <B>mayor flota de microsatélites del mundo</B>. Imagen diaria de toda la Tierra. La IA detecta deforestación amazónica, cambios urbanos y agricultura. Datos comerciales, pero también con acceso para investigadores.</>, fact: '⭐ Caso colombiano: Planet Labs ayudó a documentar la deforestación en la Amazonia colombiana 2020-2024. Datos clave para denuncias y acciones legales.' },
      { emoji: '🌳', name: 'Global Forest Watch · IA + satélites para selvas', how: <>Plataforma del WRI (World Resources Institute). <B>Alertas por IA cada vez que se detecta deforestación.</B> Uso gratuito para gobiernos, indígenas y ONG. Impulsó políticas anti-deforestación en Brasil, Indonesia y Colombia.</>, fact: '⭐ Antes se enteraban meses después de las talas ilegales. Ahora en horas. Han denunciado cientos de operaciones ilegales. Lección: transparencia + IA = poder real para proteger.' },
    ],
  },
  12: {
    icon: '🌳', label: 'Módulo 12 de 19 · Reforestación', title: '¿Drones que reforestan?', sub: 'Sí — y a escala masiva. 100x más rápido que los humanos. Toca cada tarjeta 👆',
    cards: [
      { emoji: '🌱', name: 'Drones que siembran · Flash Forest, BioCarbon', how: <>Drones que <B>plantan árboles a escala masiva</B>: hasta 100,000 semillas por día por equipo. Comparado con humanos: 100x más rápido y barato. La IA elige dónde plantar según topografía, suelo y clima.</>, fact: '⭐ Empresas activas: Flash Forest (Canadá), BioCarbon Engineering (UK), Dendra (USA). Han reforestado decenas de miles de hectáreas. Funciona especialmente bien en zonas inaccesibles.' },
      { emoji: '🌎', name: 'Reforestación amazónica · IA decide dónde plantar', how: <>ONGs en Brasil usan <B>imágenes satelitales + IA para identificar las zonas degradadas óptimas</B> para reforestar. La IA prioriza corredores biológicos, recuperación de cuencas y las zonas más afectadas.</>, fact: '⭐ Sin IA, los esfuerzos de reforestación eran semi-aleatorios. Con IA, cada árbol plantado tiene 10x más probabilidad de sobrevivir y formar bosque real.' },
      { emoji: '📱', name: 'Apps de ciudadanía · Treepl, Plant for the Planet', how: <>Aplicaciones que permiten a los ciudadanos <B>identificar árboles, registrar siembras y monitorear su crecimiento</B>. Plant for the Planet es un proyecto liderado por jóvenes. Han plantado 14 mil millones de árboles documentados.</>, fact: '⭐ Lección: reforestar a escala requiere TANTO drones como humanos motivados. La IA conecta ambos: dónde, cómo, qué especies y monitoreo.' },
    ],
  },
  14: {
    icon: '🚀', label: 'Módulo 14 de 19 · Espacio→Tierra', title: 'Misiones espaciales que ayudan al planeta', sub: 'Satélites climáticos + tecnología espacial que mejora la vida en la Tierra. Toca cada tarjeta 👆',
    cards: [
      { emoji: '🛰️', name: 'Satélites climáticos · GOES', how: <><B>NASA y NOAA</B> tienen una flota de satélites climáticos sobre el continente americano. Imagen cada 5 minutos. La IA procesa esa data para predecir tormentas, huracanes, sequías y cambios oceánicos.</>, fact: '⭐ Esta data salva vidas en LATAM. Predicciones que antes tomaban días ahora son horas. Tu próxima alerta de tormenta probablemente vendrá de IA + GOES.' },
      { emoji: '🌎', name: 'Earth Observation · Datos para ciencia abierta', how: <>Plataformas como <B>Open Earth Foundation</B> integran datos de satélites + sensores + IA = un 'gemelo digital de la Tierra'. Permite simular escenarios climáticos en tiempo real.</>, fact: '⭐ Caso real: simular qué pasaría si reducimos las emisiones X% en el escenario Y. Permite tomar decisiones políticas con base científica clara.' },
      { emoji: '🌌', name: 'Lecciones espaciales que ayudan al planeta', how: <>La tecnología de <B>aislamiento térmico</B> (NASA) inspiró edificios eficientes. Los <B>filtros de agua</B> de la EEI llegaron a zonas sin acceso a agua potable. La IA para misiones espaciales mejoró la IA para climatología.</>, fact: '⭐ El espacio NO es opuesto al planeta. Cada misión genera tecnología que se usa después aquí — desde paneles solares hasta robots quirúrgicos.' },
    ],
  },
  15: {
    icon: '💧', label: 'Módulo 15 de 19 · Agua', title: 'IA y agua potable', sub: 'Detección de fugas, contaminación, predicción de sequías. EAAB Bogotá lidera LATAM. Toca cada tarjeta 👆',
    cards: [
      { emoji: '💧', name: 'EAAB Bogotá · IA para el acueducto', how: <>El <B>Acueducto de Bogotá</B> instaló sensores IoT + IA desde 2023. Detecta fugas en tiempo real y predice la demanda. Resultado: millones de m³ ahorrados anualmente.</>, fact: '⭐ Caso de estudio en LATAM: cuando los recursos son escasos (como el agua en Bogotá), la IA es imprescindible para la gestión — no opcional.' },
      { emoji: '🚱', name: 'Detección de contaminación · IA + sensores', how: <>California, India, Israel y otros países usan IA para <B>detectar contaminación en ríos, embalses y acueductos</B> en tiempo real. Antes: muestras manuales semanales. Ahora: alertas en minutos.</>, fact: '⭐ Lección: los problemas ambientales son temas de monitoreo. Sin datos en tiempo real, las decisiones se toman tarde y mal. La IA cambió esto de raíz.' },
      { emoji: '🏞️', name: 'Predicción de sequías · India e Israel', how: <>India usa IA para <B>predecir sequías 6 meses adelante</B> con datos satelitales + climáticos + de cultivos. Permite a 700M de agricultores planificar mejor. Israel exporta esta tecnología globalmente.</>, fact: '⭐ Caso latinoamericano: Brasil empieza a adoptarlo para el Cerrado y el Sertão. Argentina lo usa para la Pampa. México, para las zonas áridas del norte.' },
    ],
  },
  17: {
    icon: '🗣️', label: 'Módulo 17 de 19 · Activismo', title: 'Activismo digital con IA', sub: 'Climate Trace, Greta + redes, organizaciones LATAM. Los datos cambian el poder. Toca cada tarjeta 👆',
    cards: [
      { emoji: '📊', name: 'Climate Trace · Transparencia con IA', how: <>ONG fundada por Al Gore. Usa IA + satélites para <B>medir las emisiones de cada planta industrial del mundo</B>. Datos públicos gratuitos. Resultado: los gobiernos no pueden mentir sobre sus emisiones reales.</>, fact: '⭐ Modelo replicable: transparencia con IA = accountability radical. Las industrias contaminantes lo tienen muchísimo más difícil para esconderse. Caso de éxito 2021-2026.' },
      { emoji: '🗣️', name: 'Greta Thunberg + redes + IA', how: <>Greta y movimientos como Fridays for Future usan <B>IA para optimizar mensajes en redes, traducir testimonios y coordinar acciones globales</B>. Resultado: 7M+ jóvenes movilizados en 150+ países desde 2018.</>, fact: '⭐ Lección: activismo digital + IA = escala antes imposible. Una persona en Suecia puede coordinar acciones globales que antes requerían organizaciones enormes.' },
      { emoji: '🌱', name: 'Casos LATAM · Movimientos ambientales con IA', how: <><B>FARN (Argentina), Dejusticia (Colombia) y CEMDA (México)</B> usan IA para análisis de datos legales, mapeo de daño ambiental y comunicación masiva. Han ganado casos contra empresas mineras, petroleras y agroindustriales.</>, fact: '⭐ El activismo ambiental LATAM siempre fue valiente. Con IA ahora también es técnicamente sofisticado — puede enfrentar a grandes corporaciones con argumentos basados en datos.' },
    ],
  },
};

const REFLECTIONS: { [k: number]: { tag: string; icon: string; question: React.ReactNode; placeholder: string; min: number; xp: number } } = {
  2: { tag: 'Tu emoción inicial · +14 XP', icon: '🤔', min: 80, xp: 14, placeholder: 'Me siento... porque... Creo que la IA va a... porque...', question: <><B>Antes de aprender los detalles técnicos, una pregunta directa:</B> ¿Qué tan preocupado o esperanzado te sientes sobre el futuro climático del planeta? ¿Crees que la tecnología (incluida la IA) va a salvarnos, va a empeorarlo o no será decisiva en absoluto? Sé honesto antes de procesar los datos del nivel.</> },
  6: { tag: 'Tu ciudad · +16 XP', icon: '🇨🇴', min: 120, xp: 16, placeholder: 'Creo que la IA podría resolver más rápido... porque... Pero NO podría resolver... porque...', question: <>Bogotá tiene problemas ambientales reales: <B>aire contaminado en horas pico, tráfico que genera estrés y emisiones, racionamiento de agua en 2024, baja arborización y un río de los más contaminados de LATAM</B>. Reflexiona honestamente: ¿cuál de estos crees que la IA podría ayudar a resolver MÁS RÁPIDO en tu ciudad? ¿Y cuál seguiría siendo problema aunque tuviéramos IA perfecta? ¿Por qué algunos problemas no se resuelven solo con tecnología?</> },
  16: { tag: 'Tu carrera futura · +18 XP', icon: '💼', min: 120, xp: 18, placeholder: 'La habilidad combinada que voy a desarrollar es... porque... Me interesa porque...', question: <>Los empleos que mejor sobrevivirán al cambio climático y a la IA serán los que <B>combinen ambas crisis</B>: ingenieros climáticos, programadores de IA verde, agricultores con sensores, expertos en restauración con drones, especialistas en agua urbana. <B>¿Qué habilidad combinada IA + planeta vas a desarrollar tú? ¿Programación + biología? ¿Diseño + sostenibilidad? ¿Comunicación + activismo digital? ¿Por qué te interesa esa combinación?</B></> },
};

// ═══════════════════════════════════════════════════════════
export default function World6Level4() {
  const completeLevel = useGameStore((s) => s.completeLevel);

  const [step, setStep] = useState(0);
  useReportProgress(step, TOTAL_STEPS);
  const [xp, setXp] = useState(0);
  const [xpToast, setXpToast] = useState<{ amount: number; id: number } | null>(null);
  const awarded = useRef<Set<number>>(new Set());

  const disastersQ = useRef(pickN(DISASTERS_Q, 5).map(shuffleOpts)).current;
  const envQ = useRef(pickN(ENV_Q, 6).map(shuffleOpts)).current;
  const energyTf = useRef(pickN(ENERGY_TF_Q, 5)).current;

  // Reflexión
  const [reflectText, setReflectText] = useState('');
  const [reflectFb, setReflectFb] = useState<string | null>(null);

  // Quiz
  const [quizAnswers, setQuizAnswers] = useState<{ [k: number]: number }>({});
  const [quizChecked, setQuizChecked] = useState(false);

  // V/F
  const [tfAnswers, setTfAnswers] = useState<{ [k: number]: boolean }>({});
  const [tfChecked, setTfChecked] = useState(false);

  // Builder
  const [builderState, setBuilderState] = useState<{ [k: string]: string }>({});

  // Ejemplos (expandibles)
  const [expandedEx, setExpandedEx] = useState<number | null>(null);

  const isTheory = THEORY_STEPS.has(step);
  const currentReflection = REFLECTIONS[step];
  const currentExample = EXAMPLES[step];
  const currentQuiz = step === 5 ? disastersQ : step === 18 ? envQ : null;

  useEffect(() => {
    setReflectText(''); setReflectFb(null);
    setQuizAnswers({}); setQuizChecked(false);
    setTfAnswers({}); setTfChecked(false);
    setBuilderState({});
    setExpandedEx(null);
  }, [step]);

  const addXP = useCallback((amount: number) => {
    setXp((p) => p + amount);
    if (amount > 0) setXpToast((prev) => ({ amount, id: (prev?.id ?? 0) + 1 }));
  }, []);
  const awardOnce = (amount: number) => { if (!awarded.current.has(step)) { awarded.current.add(step); if (amount > 0) addXP(amount); } };

  const checkQuiz = () => { if (!currentQuiz) return; setQuizChecked(true); let c = 0; currentQuiz.forEach((q, i) => { if (quizAnswers[i] === q.correct) c++; }); awardOnce(c * 8); };
  const checkTF = () => { setTfChecked(true); let c = 0; energyTf.forEach((it, i) => { if (tfAnswers[i] === it.correct) c++; }); awardOnce(c * 5); };

  const builderComplete = (cfg: BuilderConfig) => cfg.rows.every((r) => builderState[r.key]);

  const sendReflection = (): boolean => {
    if (!currentReflection) return false;
    const t = reflectText.trim();
    if (t.length < currentReflection.min) { setReflectFb(`Escribe al menos ${currentReflection.min} caracteres (llevas ${t.length}).`); return false; }
    if (looksRandom(t)) { setReflectFb('Parece texto al azar. Escribe una idea real con tus propias palabras.'); return false; }
    if (!containsTopic(t)) { setReflectFb('Conéctalo con el tema: el planeta, el clima, el agua, la energía o cómo la IA ayuda.'); return false; }
    setReflectFb(null); awardOnce(currentReflection.xp); return true;
  };

  // Footer button
  type Primary = { label: string; enabled: boolean; onPress: () => void; accent?: boolean };
  const advance = () => setStep((s) => s + 1);
  const getPrimary = (): Primary => {
    if (currentExample) return { label: 'Sigamos →', enabled: true, onPress: advance };
    if (currentReflection) return { label: 'Enviar reflexión →', enabled: reflectText.trim().length >= currentReflection.min, onPress: () => { if (sendReflection()) advance(); } };
    if (currentQuiz) return quizChecked ? { label: 'Continuar →', enabled: true, onPress: advance } : { label: 'Comprobar respuestas', enabled: Object.keys(quizAnswers).length === currentQuiz.length, onPress: checkQuiz, accent: true };
    switch (step) {
      case 0: return { label: '¡Vamos! Empecemos 🚀', enabled: true, onPress: advance };
      case 1: return { label: 'Entendido, sigamos →', enabled: true, onPress: advance };
      case 9: return { label: 'Terminar →', enabled: builderComplete(BUILDER_SMART_CITY), onPress: () => { awardOnce(BUILDER_SMART_CITY.xp); advance(); } };
      case 13: return tfChecked ? { label: 'Continuar →', enabled: true, onPress: advance } : { label: 'Comprobar', enabled: Object.keys(tfAnswers).length === energyTf.length, onPress: checkTF, accent: true };
      case 19: return { label: 'Terminar →', enabled: builderComplete(BUILDER_SUSTAINABLE), onPress: () => { awardOnce(BUILDER_SUSTAINABLE.xp); advance(); } };
      default: return { label: 'Continuar →', enabled: true, onPress: advance };
    }
  };

  const finishLevel = () => {
    const stars = xp >= 145 ? 3 : xp >= 92 ? 2 : 1; // máx real ≈ 205 XP
    completeLevel(34, stars, xp);
    router.replace('/level/35');
  };

  // ── Sub-renders ──
  const renderExCard = (i: number, c: ExCard) => {
    const open = expandedEx === i;
    return (
      <TouchableOpacity key={i} activeOpacity={0.9} style={[styles.exCard, open && styles.exCardOpen]} onPress={() => setExpandedEx(open ? null : i)}>
        <View style={styles.exHeader}>
          <View style={styles.exEmoji}><Text style={{ fontSize: 20 }}>{c.emoji}</Text></View>
          <View style={{ flex: 1 }}><Text style={styles.exName}>{c.name}</Text></View>
          <Text style={styles.exArrow}>{open ? '↓' : '›'}</Text>
        </View>
        {open && <View style={styles.exBody}><Text style={styles.exHow}>{c.how}</Text><View style={styles.exFact}><Text style={styles.exFactText}>{c.fact}</Text></View></View>}
      </TouchableOpacity>
    );
  };

  const renderQuiz = (items: QuizQ[], label: string, mTitle: string, mSub: string) => (
    <View>
      <Tag icon="❓" label={label} variant="quiz" />
      <Title>{mTitle}</Title>
      <Sub>{mSub}</Sub>
      {items.map((q, qi) => (
        <View key={qi} style={{ marginBottom: 18 }}>
          <Text style={styles.quizQ}>{qi + 1}. {q.q}</Text>
          {q.opts.map((o, oi) => {
            const sel = quizAnswers[qi] === oi;
            const showOk = quizChecked && oi === q.correct;
            const showWrong = quizChecked && sel && oi !== q.correct;
            return (
              <TouchableOpacity key={oi} disabled={quizChecked} style={[styles.qopt, sel && !quizChecked && styles.qoptSel, showOk && styles.qoptOk, showWrong && styles.qoptWrong]} onPress={() => setQuizAnswers((prev) => ({ ...prev, [qi]: oi }))}>
                <View style={[styles.qLetter, sel && !quizChecked && styles.qLetterSel, showOk && styles.qLetterOk, showWrong && styles.qLetterWrong]}>
                  <Text style={[styles.qLetterText, (sel || showOk || showWrong) && { color: '#fff' }]}>{String.fromCharCode(65 + oi)}</Text>
                </View>
                <Text style={styles.qoptText}>{o}</Text>
              </TouchableOpacity>
            );
          })}
          {quizChecked && (
            <View style={[styles.fb, quizAnswers[qi] === q.correct ? styles.fbOk : styles.fbBad]}>
              <Text style={quizAnswers[qi] === q.correct ? styles.fbOkText : styles.fbBadText}>{quizAnswers[qi] === q.correct ? '✓ ¡Correcto! — ' : `✗ Respuesta ${String.fromCharCode(65 + q.correct)} — `}{q.explain}</Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );

  const renderBuilder = (cfg: BuilderConfig, previewLabel: string) => (
    <>
      <View style={styles.builderWrap}>
        {cfg.rows.map((r) => (
          <View key={r.key} style={styles.builderRow}>
            <Text style={styles.builderLabel}>{r.label}</Text>
            <View style={styles.builderOpts}>
              {r.opts.map((o) => (
                <TouchableOpacity key={o} style={[styles.builderOpt, builderState[r.key] === o && styles.builderOptSel]} onPress={() => setBuilderState((prev) => ({ ...prev, [r.key]: o }))}>
                  <Text style={[styles.builderOptText, builderState[r.key] === o && styles.builderOptTextSel]}>{o}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </View>
      <Text style={[styles.builderLabel, { marginTop: 12, marginBottom: 4 }]}>{previewLabel}:</Text>
      <View style={styles.codeBox}>
        {cfg.rows.map((r) => (
          <Text key={r.key} style={styles.codeLine}>
            <Text style={styles.codeKey}>{r.label}: </Text>
            {builderState[r.key] ? <Text style={styles.codeText}>{builderState[r.key]}</Text> : <Text style={styles.codeEmpty}>elige una opción</Text>}
          </Text>
        ))}
      </View>
    </>
  );

  const renderContent = () => {
    if (currentExample) return (
      <View>
        <Tag icon={currentExample.icon} label={currentExample.label} variant="example" />
        <Title>{currentExample.title}</Title>
        <Sub>{currentExample.sub}</Sub>
        {currentExample.cards.map((c, i) => renderExCard(i, c))}
      </View>
    );
    if (currentReflection) return (
      <View>
        <Tag icon={currentReflection.icon} label={currentReflection.tag} variant="reflect" />
        <Title>Piensa tú</Title>
        <Sub>No hay respuesta correcta. Procesa lo aprendido con tus palabras.</Sub>
        <View style={[styles.card, styles.cardViolet]}><Text style={styles.cardTitle}>🤔  Tu pregunta</Text><Text style={styles.cardText}>{currentReflection.question}</Text></View>
        <TextInput style={styles.reflectArea} multiline value={reflectText} onChangeText={(t) => { setReflectText(t); if (reflectFb) setReflectFb(null); }} placeholder={currentReflection.placeholder} placeholderTextColor="#b8bcc0" />
        <Text style={styles.charCount}>{reflectText.trim().length} / {currentReflection.min} mínimo</Text>
        {reflectFb && <View style={[styles.fb, styles.fbBad]}><Text style={styles.fbBadText}>{reflectFb}</Text></View>}
      </View>
    );
    if (currentQuiz) {
      return step === 5 ? renderQuiz(disastersQ, 'Módulo 5 de 19 · Quiz', 'IA que predice desastres naturales', '5 preguntas sobre tecnologías que ya salvan vidas en 2025-2026.')
        : renderQuiz(envQ, 'Módulo 18 de 19 · Quiz', 'Quiz · IA y medioambiente', '6 preguntas finales que integran todo lo aprendido.');
    }
    switch (step) {
      case 0: return (
        <View>
          <View style={styles.introIcon}><Text style={{ fontSize: 34 }}>🌍</Text></View>
          <Tag icon="✨" label="Nivel 34 · Mundo 6" variant="intro" />
          <Title>IA y Tu Planeta: El Futuro que Vas a Heredar</Title>
          <Sub>Marte es fascinante para los adultos. Pero TÚ vas a vivir aquí, en este planeta, en una ciudad que existe hoy. La IA ya está cambiando el clima, el agua, la agricultura y la energía. Y lo que pase los próximos 10 años decide cómo será el resto de tu vida.</Sub>
          <View style={[styles.card, styles.cardAccent]}><Text style={styles.cardTitle}>📚  Qué vas a aprender</Text><Text style={styles.cardText}>Estado real del planeta + clima · IA en data centers (DeepMind) · Predicción de desastres · IA en agricultura, energía y agua · Satélites Copernicus + Planet Labs · Drones de reforestación · Costo energético de la IA</Text></View>
          <View style={[styles.card, styles.cardGreen]}><Text style={styles.cardTitle}>⚡  Qué podrás HACER al terminar</Text><Text style={styles.cardText}>Tener una visión clara y honesta de cómo la IA puede ayudar (o complicar) la crisis climática. Conocer casos reales de LATAM. Tener UN proyecto concreto que aplicarías en tu ciudad.</Text></View>
          <View style={[styles.card, styles.cardYellow]}><Text style={styles.cardTitle}>🎮  19 módulos · 45-60 min · hasta 205 XP</Text><Text style={styles.cardText}>📖 Teoría · 🤔 Esperanza/preocupación · 🌡️ 3 datos del planeta · 💡 DeepMind · ❓ Predicción de desastres · 🇨🇴 Bogotá · 🌾 Agricultura · ⚡ Energía limpia · 🏙️ Builder ciudad · 🌊 Océanos · 🛰️ Satélites · 🌳 Reforestación · ✅ V/F costo energético · 🚀 Espacio + Tierra · 💧 Agua · 💼 Trabajo futuro · 🗣️ Activismo digital · ❓ Quiz · 🌎 Builder 2040</Text></View>
        </View>
      );
      case 1: return (
        <View>
          <Tag icon="📖" label="Módulo 1 de 19 · Teoría" variant="theory" />
          <Title>El planeta que vas a heredar</Title>
          <Body>Marte es fascinante para los adultos. Pero <B>TÚ vas a vivir aquí</B>, en este planeta, en una ciudad real, con problemas reales. La crisis climática NO es ciencia ficción del 2080 — está pasando ahora mismo en tu ciudad, tu agua y tu aire.</Body>
          <View style={styles.highlightBox}><Text style={styles.highlightText}>💡 <B>Tres datos que cambian la perspectiva:</B>{'\n\n'}<B>2024</B>: primer año en superar +1.5°C (umbral del Acuerdo de París).{'\n'}<B>2024</B>: Bogotá racionó agua por sequía extrema.{'\n'}<B>2024</B>: incendios forestales 4x más comunes que en 2000.</Text></View>
          <Body>¿Y la IA? Es <B>parte del problema Y parte de la solución</B>. Consume MUCHA energía. Pero también optimiza redes eléctricas, predice desastres, monitorea contaminación y planta árboles. La pregunta no es 'IA sí o no', sino 'IA para qué'.</Body>
          <Text style={styles.sectionTitle}>🌍 Las 4 áreas críticas para tu generación</Text>
          {[['1', 'Clima:', ' predicción, alerta temprana, simulación de escenarios.'], ['2', 'Agua:', ' detección de fugas, predicción de sequías, calidad.'], ['3', 'Agricultura:', ' producir más con menos, sin destruir el suelo.'], ['4', 'Energía:', ' renovables + redes optimizadas + almacenamiento.']].map(([n, t, d]) => (
            <View key={n} style={styles.stepLi}><View style={styles.stepNum}><Text style={styles.stepNumText}>{n}</Text></View><Text style={styles.stepLiText}><B>{t}</B>{d}</Text></View>
          ))}
          <View style={styles.tipBox}><Text style={styles.tipText}>✅ <B>Verdad operativa:</B> el planeta que heredas SÍ se puede salvar. No con esperanza ingenua ni con pesimismo, sino con tecnología bien aplicada + decisiones políticas valientes + cambios de comportamiento. La IA es una herramienta crítica.</Text></View>
        </View>
      );
      case 9: return (
        <View>
          <Tag icon="🏙️" label="Módulo 9 de 19 · Builder" variant="build" />
          <Title>Tu ciudad inteligente</Title>
          <Sub>4 sistemas con IA: tráfico + basura + agua + aire. Diseño concreto.</Sub>
          {renderBuilder(BUILDER_SMART_CITY, 'Tu ciudad inteligente')}
        </View>
      );
      case 13: return (
        <View>
          <Tag icon="✅" label="Módulo 13 de 19 · Verdadero o Falso" variant="activity" />
          <Title>El costo energético de la IA · ¿Verdad o mito?</Title>
          <Sub>5 afirmaciones sobre el dilema energético. Algunas son duras pero ciertas.</Sub>
          {energyTf.map((it, i) => {
            const ans = tfAnswers[i];
            return (
              <View key={i} style={styles.tfSet}>
                <Text style={styles.tfQ}>{i + 1}. {it.stmt}</Text>
                <View style={styles.tfOpts}>
                  <TouchableOpacity disabled={tfChecked} style={[styles.tfBtn, ans === true && !tfChecked && styles.tfBtnTrue, tfChecked && it.correct === true && styles.tfBtnCorrect, tfChecked && ans === true && !it.correct && styles.tfBtnWrong]} onPress={() => setTfAnswers((prev) => ({ ...prev, [i]: true }))}><Text style={styles.tfBtnText}>✅ Verdadero</Text></TouchableOpacity>
                  <TouchableOpacity disabled={tfChecked} style={[styles.tfBtn, ans === false && !tfChecked && styles.tfBtnFalse, tfChecked && it.correct === false && styles.tfBtnCorrect, tfChecked && ans === false && it.correct && styles.tfBtnWrong]} onPress={() => setTfAnswers((prev) => ({ ...prev, [i]: false }))}><Text style={styles.tfBtnText}>❌ Falso</Text></TouchableOpacity>
                </View>
                {tfChecked && (
                  <View style={[styles.fb, ans === it.correct ? styles.fbOk : styles.fbBad]}>
                    <Text style={ans === it.correct ? styles.fbOkText : styles.fbBadText}>{ans === it.correct ? '✅ Correcto. ' : `❌ Incorrecto. La respuesta correcta es "${it.correct ? 'Verdadero' : 'Falso'}". `}{it.explain}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      );
      case 19: return (
        <View>
          <Tag icon="🌎" label="Módulo 19 de 19 · Visión final" variant="build" />
          <Title>Diseña la ciudad sostenible del 2040</Title>
          <Sub>5 sistemas integrados. Tu propuesta concreta para los próximos 15 años.</Sub>
          {renderBuilder(BUILDER_SUSTAINABLE, 'Tu ciudad 2040')}
        </View>
      );
      case 20: {
        const pct = Math.round((34 / 36) * 100);
        return (
          <View style={styles.completeContainer}>
            <View style={styles.completeBadge}><Text style={{ fontSize: 44 }}>🌍</Text></View>
            <Text style={styles.completeTitle}>¡Nivel 34 completado!</Text>
            <Text style={styles.completeSub}>Terminaste "IA y Tu Planeta: El Futuro que Vas a Heredar". Ahora eres Planet Guardian.</Text>
            <View style={styles.xpEarned}><Text style={styles.xpEarnedText}>⭐ {xp} XP ganados en este nivel</Text></View>
            <View style={styles.skillsList}>
              {['Identifico aplicaciones reales de IA en clima, energía, agua y agricultura HOY', 'Conozco el costo energético de la IA y por qué importa para el balance ambiental', 'Reconozco casos LATAM y locales (no solo de USA/Europa)', 'Entiendo el rol de los satélites y drones en el monitoreo planetario', 'Tengo una propuesta concreta de cómo la IA podría mejorar mi propia ciudad'].map((s, i) => (
                <View key={i} style={styles.skillRow}><Text style={styles.skillCheck}>✓</Text><Text style={styles.skillText}>{s}</Text></View>
              ))}
            </View>
            <View style={styles.nextHint}><Text style={styles.nextHintText}><B>Nivel 35: IA y Tu Salud · La medicina que viene por ti</B>{'\n'}Si N34 exploró el planeta que vas a heredar, N35 explora algo aún más cercano: tu cuerpo, tu familia, tu salud. Cómo la IA está cambiando el diagnóstico, los medicamentos y la longevidad.</Text></View>
            <View style={styles.lvlBarWrap}>
              <Text style={styles.lvlBarLabel}>Nivel 34 de 36 completado · {pct}% del camino</Text>
              <View style={styles.lvlBarOuter}><View style={[styles.lvlBarInner, { width: `${pct}%` }]} /></View>
            </View>
            <TouchableOpacity style={[styles.primaryBtn, styles.primaryBtnAccent, { width: '100%' }]} onPress={finishLevel}><Text style={styles.primaryBtnText}>Siguiente nivel →</Text></TouchableOpacity>
          </View>
        );
      }
      default: return null;
    }
  };

  const primary = getPrimary();
  const progress = (step / (TOTAL_STEPS - 1)) * 100;
  const progLabel = step === 0 ? 'Introducción' : step < TOTAL_STEPS - 1 ? `Módulo ${step} de ${CONTENT_STEPS}` : '¡Nivel completado!';

  return (
    <View style={styles.screen}>
      <View style={styles.bar}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => exitLevel()} accessibilityLabel="Salir del nivel"><Text style={styles.closeBtnText}>✕</Text></TouchableOpacity>
        <View style={styles.track}><View style={[styles.fill, { width: `${progress}%` }]} /></View>
        <Text style={styles.xpChip}>{xp} XP</Text>
      </View>
      {step < TOTAL_STEPS - 1 && <Text style={styles.progLabel}>{progLabel}</Text>}
      <ScrollView contentContainerStyle={styles.scrollContent}>{renderContent()}</ScrollView>

      {step !== TOTAL_STEPS - 1 && (
        <View style={styles.navRow}>
          {isTheory && step > 0 && <TouchableOpacity style={styles.backBtn} onPress={() => setStep((s) => s - 1)}><Text style={styles.backBtnText}>← Volver</Text></TouchableOpacity>}
          <TouchableOpacity style={[styles.primaryBtn, primary.accent && styles.primaryBtnAccent, { flex: 1 }, !primary.enabled && styles.primaryBtnOff]} disabled={!primary.enabled} onPress={primary.onPress}>
            <Text style={styles.primaryBtnText}>{primary.label}</Text>
          </TouchableOpacity>
        </View>
      )}
      {xpToast && <XPToast key={xpToast.id} amount={xpToast.amount} onHide={() => setXpToast(null)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.screen },
  bar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: P.border, backgroundColor: '#fafafa' },
  closeBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: P.border, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 15, fontWeight: '800', color: P.muted },
  track: { flex: 1, height: 8, backgroundColor: P.border, borderRadius: 4, marginHorizontal: 12, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: P.greenDark, borderRadius: 4 },
  xpChip: { ...typography.bold, fontSize: 13, color: '#854d0e', backgroundColor: '#fde68a', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
  progLabel: { ...typography.regular, fontSize: 11, color: P.faint, textAlign: 'center', paddingTop: 6 },
  scrollContent: { padding: 16, paddingBottom: 30 },

  tag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginBottom: 12 },
  tagText: { fontSize: 11, fontWeight: '700' },

  introIcon: { width: 68, height: 68, borderRadius: 20, backgroundColor: P.accentBg, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  title: { ...typography.extraBold, fontSize: 20, color: P.ink, marginBottom: 8, lineHeight: 26 },
  sub: { ...typography.regular, fontSize: 13, color: P.muted, lineHeight: 20, marginBottom: 12 },
  bodyText: { ...typography.regular, fontSize: 13, color: P.body, lineHeight: 22, marginBottom: 12 },
  bold: { fontWeight: '700', color: P.ink },
  sectionTitle: { ...typography.bold, fontSize: 14, color: P.ink, marginTop: 10, marginBottom: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f0f0f0' },

  card: { backgroundColor: P.cardBg, borderRadius: 14, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: P.border },
  cardAccent: { backgroundColor: P.accentBg, borderColor: P.greenBorder },
  cardGreen: { backgroundColor: P.greenSoft, borderColor: P.greenBorder },
  cardYellow: { backgroundColor: '#fefce8', borderColor: P.amberBorder },
  cardViolet: { backgroundColor: P.violetBg, borderColor: P.violetBorder },
  cardTitle: { ...typography.bold, fontSize: 13, color: P.ink, marginBottom: 4 },
  cardText: { ...typography.regular, fontSize: 13, color: P.body, lineHeight: 21 },

  highlightBox: { borderLeftWidth: 3, borderLeftColor: P.greenDark, backgroundColor: P.accentBg, borderRadius: 8, padding: 12, marginBottom: 12 },
  highlightText: { fontSize: 13, color: P.accentText, lineHeight: 21 },
  tipBox: { borderLeftWidth: 3, borderLeftColor: P.green, backgroundColor: P.greenSoft, borderRadius: 8, padding: 12, marginTop: 4 },
  tipText: { fontSize: 13, color: P.greenText, lineHeight: 21 },
  stepLi: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 9 },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: P.greenDark, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  stepLiText: { flex: 1, fontSize: 13, color: P.body, lineHeight: 20 },

  builderWrap: { gap: 10 },
  builderRow: { backgroundColor: P.cardBg, borderWidth: 1, borderColor: P.border, borderRadius: 12, padding: 11 },
  builderLabel: { fontSize: 11, fontWeight: '700', color: P.accentText, marginBottom: 6, letterSpacing: 0.3, textTransform: 'uppercase' },
  builderOpts: { gap: 5 },
  builderOpt: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 9, borderWidth: 1.5, borderColor: P.border, backgroundColor: '#fff' },
  builderOptSel: { borderColor: P.greenDark, backgroundColor: P.accentBg },
  builderOptText: { fontSize: 12, color: P.body, fontWeight: '500', lineHeight: 16 },
  builderOptTextSel: { color: P.accentText, fontWeight: '700' },
  codeBox: { backgroundColor: P.codeBg, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#1e293b' },
  codeLine: { fontSize: 12, lineHeight: 20, marginBottom: 2 },
  codeText: { color: P.codeText, fontFamily: 'monospace' },
  codeKey: { color: P.codeKey, fontWeight: '700', fontFamily: 'monospace' },
  codeEmpty: { color: P.codeEmpty, fontStyle: 'italic', fontFamily: 'monospace' },

  quizQ: { ...typography.bold, fontSize: 13, color: P.ink, padding: 12, backgroundColor: P.cardBg, borderRadius: 10, borderWidth: 1, borderColor: P.border, marginBottom: 8, lineHeight: 19 },
  qopt: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 11, borderWidth: 1.5, borderColor: P.border, backgroundColor: '#fff', marginBottom: 7 },
  qoptSel: { borderColor: P.greenDark, backgroundColor: P.accentBg },
  qoptOk: { borderColor: P.green, backgroundColor: P.greenBg },
  qoptWrong: { borderColor: P.red, backgroundColor: P.redBg },
  qLetter: { width: 24, height: 24, borderRadius: 7, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: P.border, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  qLetterSel: { backgroundColor: P.greenDark, borderColor: P.greenDark },
  qLetterOk: { backgroundColor: P.green, borderColor: P.green },
  qLetterWrong: { backgroundColor: P.red, borderColor: P.red },
  qLetterText: { fontSize: 11, fontWeight: '700', color: P.muted },
  qoptText: { flex: 1, fontSize: 12, color: P.body, lineHeight: 17 },

  tfSet: { marginBottom: 16 },
  tfQ: { fontSize: 13, fontWeight: '700', color: P.ink, padding: 12, backgroundColor: P.cardBg, borderRadius: 10, borderWidth: 1, borderColor: P.border, marginBottom: 10, lineHeight: 19 },
  tfOpts: { flexDirection: 'row', gap: 8 },
  tfBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 2, borderColor: P.border, backgroundColor: '#fff', alignItems: 'center' },
  tfBtnTrue: { borderColor: P.green, backgroundColor: P.greenSoft },
  tfBtnFalse: { borderColor: P.red, backgroundColor: P.redBg },
  tfBtnCorrect: { borderColor: P.green, backgroundColor: P.greenBg },
  tfBtnWrong: { borderColor: P.red, backgroundColor: P.redBg },
  tfBtnText: { fontSize: 13, fontWeight: '700', color: P.body },

  reflectArea: { minHeight: 120, padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: P.border, backgroundColor: '#fafafa', fontSize: 13, color: P.body, lineHeight: 22, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: P.faint, textAlign: 'right', marginTop: 4 },

  exCard: { borderRadius: 14, padding: 12, borderWidth: 1, borderColor: P.border, marginBottom: 8, backgroundColor: '#fff' },
  exCardOpen: { borderColor: P.greenDark, backgroundColor: P.accentBg },
  exHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exEmoji: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  exName: { fontSize: 13, fontWeight: '700', color: P.ink },
  exArrow: { fontSize: 18, color: P.faint },
  exBody: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: P.border },
  exHow: { fontSize: 12, color: P.body, lineHeight: 19, marginBottom: 8 },
  exFact: { backgroundColor: '#fef9c3', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#fde68a' },
  exFactText: { fontSize: 12, color: '#854d0e', fontWeight: '500', lineHeight: 17 },

  fb: { borderRadius: 10, padding: 11, marginTop: 8 },
  fbOk: { backgroundColor: P.greenBg },
  fbBad: { backgroundColor: P.redBg },
  fbOkText: { fontSize: 12, color: P.greenText, lineHeight: 18, fontWeight: '500' },
  fbBadText: { fontSize: 12, color: P.redText, lineHeight: 18, fontWeight: '500' },

  completeContainer: { alignItems: 'center', paddingTop: 8 },
  completeBadge: { width: 88, height: 88, borderRadius: 24, backgroundColor: P.greenDark, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  completeTitle: { ...typography.extraBold, fontSize: 22, color: P.ink, marginBottom: 6, textAlign: 'center' },
  completeSub: { fontSize: 13, color: P.muted, textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  xpEarned: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 20, backgroundColor: '#fef9c3', borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#fde047', width: '100%' },
  xpEarnedText: { fontSize: 16, fontWeight: '700', color: '#854d0e' },
  skillsList: { gap: 7, marginBottom: 16, width: '100%' },
  skillRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 10, backgroundColor: P.greenSoft, borderRadius: 10, borderWidth: 1, borderColor: P.greenBorder },
  skillCheck: { color: P.green, fontSize: 15, fontWeight: '800' },
  skillText: { flex: 1, fontSize: 12, color: P.greenText, lineHeight: 17, fontWeight: '500' },
  nextHint: { padding: 12, backgroundColor: P.cardBg, borderRadius: 10, borderWidth: 1, borderColor: P.border, width: '100%', marginBottom: 14 },
  nextHintText: { fontSize: 12, color: P.body, lineHeight: 20 },
  lvlBarWrap: { width: '100%', marginBottom: 16 },
  lvlBarLabel: { fontSize: 11, color: P.muted, marginBottom: 5 },
  lvlBarOuter: { height: 7, backgroundColor: P.border, borderRadius: 4, overflow: 'hidden' },
  lvlBarInner: { height: '100%', backgroundColor: P.greenDark, borderRadius: 4 },

  navRow: { flexDirection: 'row', gap: 8, padding: 14, borderTopWidth: 1, borderTopColor: '#f0f0f0', backgroundColor: '#fafafa' },
  backBtn: { paddingHorizontal: 16, paddingVertical: 13, borderRadius: 12, backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#e2e8f0', justifyContent: 'center' },
  backBtnText: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  primaryBtn: { backgroundColor: P.green, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
  primaryBtnAccent: { backgroundColor: P.greenDark },
  primaryBtnOff: { opacity: 0.35 },
  primaryBtnText: { ...typography.bold, color: '#fff', fontSize: 15 },
});
