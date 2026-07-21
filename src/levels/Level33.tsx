import { exitLevel } from '../utils/exitLevel';
import { router } from 'expo-router';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { useReportProgress } from '../components/LevelProgress';
import { typography } from '../theme';
import XPToast from '../components/XPToast';
import { pickN, shuffle } from '../utils/shuffle';

// ═══════════════════════════════════════════════════════════
// Nivel 33 · IA en Movimiento: Autos y Drones (Mundo 6)
// Mundo 6 · TEMA CLARO (azul: #1d4ed8 / #0ea5e9).
// Reconstruido vs nivel-33.html (estándar v2.2).
// 19 módulos de contenido (steps 1-19).
// ═══════════════════════════════════════════════════════════

const P = {
  screen: '#ffffff',
  ink: '#111827', body: '#374151', muted: '#6b7280', faint: '#9ca3af',
  blue: '#1d4ed8', blueText: '#1e3a8a', blueBg: '#eff6ff', blueBorder: '#bfdbfe', sky: '#0ea5e9',
  border: '#e5e7eb', cardBg: '#f9fafb',
  green: '#16a34a', greenBg: '#dcfce7', greenText: '#166534', greenSoft: '#f0fdf4', greenBorder: '#bbf7d0',
  red: '#dc2626', redBg: '#fef2f2', redText: '#991b1b', redBorder: '#fecaca',
  amberBg: '#fef3c7', amberText: '#92400e', amberBorder: '#fde68a',
  orangeBg: '#fff7ed', orangeText: '#9a3412', orangeBorder: '#fed7aa',
  violetBg: '#f5f3ff', violetBorder: '#ddd6fe', violetText: '#5b21b6',
  codeBg: '#0f172a', codeText: '#e2e8f0', codeKey: '#93c5fd', codeEmpty: '#64748b',
};

const TOTAL_STEPS = 21;   // 0 intro · 1-19 módulos · 20 completado
const CONTENT_STEPS = 19;
const THEORY_STEPS = new Set([0, 1, 4, 5, 10, 12, 13, 15, 17]); // lecturas / tarjetas → "Volver"

type MatchPair = { left: string; right: string };
type QuizQ = { q: string; opts: string[]; correct: number; explain: string };
type TFItem = { stmt: string; correct: boolean; explain: string };
type DragItem = { text: string; correct: 'vision' | 'distancia' | 'ubicacion' };
type SprintItem = { text: string; good: boolean };
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
const REFLECT_TERMS = ['auto', 'autonomo', 'conducir', 'volante', 'waymo', 'tesla', 'drone', 'taxi', 'volador', 'evtol', 'sensor', 'lidar', 'camara', 'radar', 'gps', 'trafico', 'semaforo', 'tren', 'movilidad', 'transporte', 'ciudad', 'peaton', 'accidente', 'seguridad', 'etica', 'dilema', 'tranvia', 'militar', 'confianza', 'maquina', 'ia', 'futuro', 'delivery', 'entrega', 'obstaculo', 'conductor', 'humano', 'regulacion'];
const containsTopic = (text: string): boolean => {
  const n = normalizeText(text);
  const words = n.split(/[^a-z0-9]+/).filter(Boolean);
  return REFLECT_TERMS.some((t) => (t.length <= 3 ? words.includes(t) : n.includes(t)));
};

// ── Pools (fuente: nivel-33.html) — distractores alargados (§15/27) ──
const MATCH_POOL: MatchPair[] = [
  { left: 'Nivel 0', right: 'Manual total: el conductor controla todo. Ningún sistema asiste' },
  { left: 'Nivel 1', right: 'Asistencia básica: control crucero adaptativo o asistente de carril, no ambos' },
  { left: 'Nivel 2', right: 'Automatización parcial: dirección + aceleración a la vez (Tesla Autopilot, GM Super Cruise)' },
  { left: 'Nivel 3', right: 'Autonomía condicional: el auto maneja solo en ciertas condiciones, conductor disponible (Mercedes Drive Pilot)' },
  { left: 'Nivel 4', right: 'Alta autonomía: sin conductor en zonas geográficas específicas (Waymo en Phoenix/SF)' },
  { left: 'Nivel 5', right: 'Autonomía total: maneja en cualquier condición y lugar como un humano. NO existe aún en producción' },
];

// Drag arreglado (§23): el HTML mencionaba 3 categorías ("IMAGEN, DISTANCIA o MUNDO")
// pero solo ponía 2 columnas → los sensores de ubicación (GPS, IMU, HD Maps) no tenían
// dónde ir = imposible. Aquí van las 3 columnas reales.
const SENSORS_POOL: DragItem[] = [
  { text: 'Cámara estéreo · ve el ancho del carril y los obstáculos visibles', correct: 'vision' },
  { text: 'Cámaras de profundidad RGB-D · estiman distancia con visión sola', correct: 'vision' },
  { text: 'Radar · mide distancia y velocidad de objetos en 360°', correct: 'distancia' },
  { text: 'Lidar · pulsa rayos láser que crean un mapa 3D punto por punto', correct: 'distancia' },
  { text: 'Ultrasonido · detecta obstáculos a corta distancia (estacionar)', correct: 'distancia' },
  { text: 'GPS · ubicación absoluta del auto en el mundo', correct: 'ubicacion' },
  { text: 'Sensores inerciales (IMU) · detectan aceleración y rotación', correct: 'ubicacion' },
  { text: 'HD Maps pre-cargados · precisión de centímetros del entorno', correct: 'ubicacion' },
];

const ACCIDENTS_POOL: TFItem[] = [
  { stmt: 'Los autos autónomos ya tienen menos accidentes por km que los humanos en TODAS las condiciones', correct: false, explain: 'Solo en zonas geográficas controladas y con buen clima. Generalizarlo a todo es engañoso.' },
  { stmt: 'Cualquier accidente de un auto autónomo es noticia mundial; los accidentes humanos NO', correct: true, explain: 'Sesgo de cobertura mediática. ~40,000 muertes en accidentes en EE.UU./año, y casi ninguna es portada nacional.' },
  { stmt: 'Si un auto autónomo causa una muerte, está claro legalmente quién es el responsable', correct: false, explain: 'Sigue siendo una zona gris legal. Las demandas a Tesla, Uber y Cruise (2018-2024) no dejan precedentes definitivos.' },
  { stmt: 'Las pruebas de autos autónomos en California han causado más muertes que los accidentes humanos de la zona', correct: false, explain: 'Es al revés. En las zonas de operación de Waymo y Cruise, los autónomos tienen una tasa de accidentes graves más baja que los humanos.' },
  { stmt: 'Los autos autónomos todavía fallan en clima extremo, como la nieve o la lluvia torrencial', correct: true, explain: 'Sigue siendo una limitación clave. Por eso Waymo solo opera donde el clima es predecible.' },
  { stmt: 'Cruise (GM) suspendió operaciones tras un accidente grave en San Francisco en 2023', correct: true, explain: 'Cruise atropelló a una persona, la arrastró y NO reportó todo al regulador. Le suspendieron el permiso. Caso emblemático.' },
  { stmt: 'Tesla está siendo investigada por la NHTSA por accidentes con Autopilot', correct: true, explain: 'Investigación abierta desde 2022 sobre 50+ accidentes con Autopilot/FSD activos. Procesos legales en curso.' },
  { stmt: 'Los autos autónomos eliminan TODOS los accidentes de tráfico', correct: false, explain: 'Reducen los errores humanos (90% de los accidentes de hoy) pero no los errores ambientales, fallos técnicos o casos imprevistos.' },
];

const FUTURE_AUTO_ITEMS: SprintItem[] = [
  { text: 'Maneja completamente solo a cualquier hora y en cualquier clima', good: true },
  { text: 'Sigue siendo un auto idéntico al de 1995, con ruedas y volante', good: false },
  { text: 'Sin volante ni pedales — interior diseñado para conversar o trabajar', good: true },
  { text: 'Carga inalámbrica mientras conduce en autopistas equipadas', good: true },
  { text: 'Solo puede manejarse a 20 km/h por seguridad excesiva', good: false },
  { text: 'Asientos giratorios que permiten reuniones cara a cara', good: true },
  { text: 'Necesita 8 horas de carga para solo 50 km de autonomía', good: false },
  { text: 'Comparte datos con otros autos para anticipar el tráfico (V2V)', good: true },
  { text: 'Solo lo pueden usar los millonarios', good: false },
  { text: 'Adapta su modo según la situación: solo, familia, amigos, trabajo', good: true },
];

const NAV_POOL: QuizQ[] = [
  { q: '¿Cómo aprende Google Maps los tiempos de tráfico?', opts: ['De los millones de teléfonos Android que envían su ubicación anónima en tiempo real', 'Únicamente de las cámaras de tráfico instaladas en las calles de la ciudad', 'De los reportes que los policías de tránsito envían manualmente cada cierto tiempo', 'En realidad se los inventa con un algoritmo aleatorio, sin usar ningún dato real'], correct: 0, explain: 'Crowdsourcing masivo: cada Android (con ubicación activada) reporta su velocidad. Google lo promedia = mapa de tráfico en tiempo real.' },
  { q: '¿Qué hace Waze diferente a un Google Maps tradicional?', opts: ['Reportes en tiempo real de usuarios sobre policías, accidentes y baches — comunidad activa', 'Simplemente que es una aplicación mucho más barata de usar que Google Maps', 'Únicamente el color y el diseño de la interfaz; por dentro es exactamente igual', 'Nada en absoluto; Waze y Google Maps son literalmente la misma aplicación'], correct: 0, explain: 'Waze (también de Google desde 2013) tiene una capa social: los usuarios reportan eventos y la IA prioriza las alertas según el contexto.' },
  { q: '¿Pueden las apps de navegación predecir el tráfico FUTURO?', opts: ['Sí — entrenan con miles de millones de viajes pasados y predicen patrones por hora, día y clima', 'No, es imposible; predecir el tráfico futuro sería una especie de magia inexplicable', 'Solo adivinan al azar, sin ningún dato ni modelo detrás de sus predicciones', 'No, únicamente pueden mostrar el estado del tráfico en el momento presente exacto'], correct: 0, explain: 'Modelos de ML predicen con 5-15 min de anticipación. Los errores se reportan al modelo y mejora continuamente.' },
  { q: "¿Qué pasa si todos los autos siguen la 'mejor ruta' que Google sugiere?", opts: ["PARADOJA: la 'mejor ruta' deja de serlo porque se llena. Google lo calcula y diversifica sus recomendaciones", 'Que absolutamente todos los conductores llegan muy rápido a su destino sin ningún problema', 'Que la aplicación se sobrecarga, deja de funcionar y se cierra sola por el exceso de gente', 'No pasa nada en particular; el tráfico sigue exactamente igual que siempre, sin cambios'], correct: 0, explain: 'Paradoja de Braess + sistemas multi-agente. Los algoritmos modernos balancean el tráfico distribuyendo las recomendaciones.' },
  { q: '¿Por qué se criticó tanto a Apple Maps cuando se lanzó en 2012?', opts: ['Lanzó con datos muy pobres — Apple no tenía la capa de datos crowdsourced que Google construyó en años', 'Porque en realidad era demasiado bueno y le quitaba demasiados usuarios a la competencia', 'Porque era completamente gratis y la gente desconfiaba de todo lo que fuera gratuito', 'Porque su precio era carísimo y muy pocas personas del mundo podían llegar a pagarlo'], correct: 0, explain: 'Lección clave: la calidad de los mapas digitales depende MÁS de los datos que del software. Apple lleva $10B+ invertidos desde entonces.' },
];

const TRANSPORT_POOL: QuizQ[] = [
  { q: '¿Qué empresa lidera en taxis sin conductor REALES (no demos)?', opts: ['Waymo: 100,000+ viajes semanales sin conductor en Phoenix, San Francisco, LA y Austin (2024)', 'Solamente Tesla, que ya tiene millones de robotaxis operando por todo el mundo entero', 'Uber, que fue la primera y la única empresa en lograr taxis totalmente autónomos', 'Apple con su Apple Car, que ya circula por las calles de muchas ciudades grandes'], correct: 0, explain: 'Waymo vs Tesla: enfoques opuestos. Waymo apuesta seguridad sobre escalabilidad; Tesla al revés. Waymo lidera en operación real.' },
  { q: 'Diferencia clave entre los autos autónomos y los trenes autónomos:', opts: ['Los trenes van en vías fijas, sin tráfico mixto ni peatones cruzando = más fácil de automatizar', 'El color de los vehículos, que hace que unos sean más fáciles de programar que los otros', 'Únicamente el peso, ya que los trenes pesan muchísimo más que cualquier automóvil', 'Que los trenes en realidad no usan nada de inteligencia artificial para poder funcionar'], correct: 0, explain: 'Por eso los trenes autónomos operan desde 1987 (Singapur). Los autos enfrentan un mundo MUCHO más caótico: peatones, motos, semáforos, clima.' },
  { q: '¿Por quién están aprobados los drones de delivery en EE.UU.?', opts: ['Por la FAA (Federal Aviation Administration), bajo la regulación Part 135 desde 2020', 'Por nadie en absoluto; los drones de delivery operan hoy en una total ilegalidad', 'Directamente por el presidente del país, que firma un permiso especial para cada dron', 'Por el Vaticano, que es la única autoridad mundial que regula todo el espacio aéreo'], correct: 0, explain: 'La FAA regula el espacio aéreo. Amazon, Wing y Zipline tienen aprobación Part 135 para operación comercial.' },
  { q: '¿Cómo se llama un taxi volador eléctrico?', opts: ['eVTOL (Electric Vertical Take-Off and Landing) — Joby, Volocopter y EHang los desarrollan', 'Simplemente un helicóptero normal, exactamente igual a los que ya existen hoy en día', 'Un avión pequeño con motores eléctricos que necesita una pista larga para despegar', 'Un drone común y corriente, del mismo tipo que se usa para grabar videos aéreos'], correct: 0, explain: 'eVTOL: nueva categoría aérea. Despegue/aterrizaje vertical sin pista, propulsión eléctrica silenciosa y una certificación tipo nueva.' },
  { q: '¿Por qué Singapur es una referencia mundial en transporte inteligente?', opts: ['Ciudad-estado pequeña + inversión gubernamental masiva + cultura tecnológica = laboratorio ideal', 'Simplemente porque es una ciudad muy bonita y muy limpia para vivir y para pasear', 'Únicamente por su turismo, que atrae a millones de visitantes de todo el mundo cada año', 'Porque está de moda y todos los países quieren imitar lo que hace solo por moda'], correct: 0, explain: 'Singapur invierte $2B+/año, regula con flexibilidad y mide resultados. Bogotá, Medellín y Buenos Aires estudian su modelo.' },
];

const BUILDER_CITY: BuilderConfig = { xp: 22, rows: [
  { key: 'publico', label: 'Transporte PÚBLICO masivo', opts: ['Metro/tren autónomo 100% (modelo Singapur/Dubai)', 'BRT (buses) con semáforos inteligentes optimizando el flujo', 'Tranvía eléctrico autónomo con prioridad en tiempo real', 'Hyperloop entre ciudades para distancias largas (aún utópico)'] },
  { key: 'privado', label: 'Movilidad PRIVADA', opts: ['Auto compartido autónomo on-demand (sin propiedad personal)', 'Tipo Tesla/Waymo — propiedad, pero el auto se conduce solo', 'Bicicletas y patinetes eléctricos compartidos asistidos por IA', 'Sistema 100% multimodal: una app que combina opciones por viaje'] },
  { key: 'peatonal', label: 'Sistema PEATONAL', opts: ['Calles peatonales con semáforos que detectan cruces y optimizan', 'Cámaras con IA que alertan a los conductores cuando hay peatones', 'App de seguridad personal para las zonas más inseguras', 'Iluminación LED adaptativa que sigue al peatón por la noche'] },
  { key: 'aereo', label: 'Sistema AÉREO / Drones', opts: ['Delivery por drones para farmacia y emergencias médicas', 'eVTOL (taxi volador) entre el aeropuerto y el centro de la ciudad', 'Drones de monitoreo para tráfico, contaminación y seguridad', 'Sin sistema aéreo en esta primera fase del plan'] },
] };

const tagVariants = {
  intro: { box: { backgroundColor: P.blueBg }, text: { color: P.blueText } },
  theory: { box: { backgroundColor: P.greenSoft }, text: { color: P.greenText } },
  activity: { box: { backgroundColor: P.blueBg }, text: { color: '#1e40af' } },
  build: { box: { backgroundColor: P.blueBg }, text: { color: P.blueText } },
  example: { box: { backgroundColor: P.orangeBg }, text: { color: P.orangeText } },
  quiz: { box: { backgroundColor: P.amberBg }, text: { color: P.amberText } },
  reflect: { box: { backgroundColor: '#f3f4f6' }, text: { color: '#374151' } },
  sprint: { box: { backgroundColor: '#fee2e2' }, text: { color: P.redText } },
} as const;
const Tag = ({ icon, label, variant }: { icon: string; label: string; variant: keyof typeof tagVariants }) => (
  <View style={[styles.tag, tagVariants[variant].box]}><Text style={[styles.tagText, tagVariants[variant].text]}>{icon}  {label}</Text></View>
);
const Title = ({ children }: { children: React.ReactNode }) => <Text style={styles.title}>{children}</Text>;
const Sub = ({ children }: { children: React.ReactNode }) => <Text style={styles.sub}>{children}</Text>;
const Body = ({ children }: { children: React.ReactNode }) => <Text style={styles.bodyText}>{children}</Text>;
const B = ({ children }: { children: React.ReactNode }) => <Text style={styles.bold}>{children}</Text>;

const EXAMPLES: { [k: number]: { icon: string; label: string; title: string; sub: string; cards: ExCard[] } } = {
  4: {
    icon: '🚗', label: 'Módulo 4 de 19 · Tesla', title: 'Tesla Autopilot · Cámaras + IA, sin lidar', sub: 'El enfoque de visión pura. 3 casos para entender qué funciona y qué no. Toca cada tarjeta 👆',
    cards: [
      { emoji: '🚙', name: 'Tesla Autopilot · Visión por computador', how: <>Tesla apuesta SOLO por <B>cámaras + redes neuronales</B>, sin lidar ni radar (los eliminó en 2021). Argumento de Musk: 'los humanos manejamos solo con los ojos, la IA debería poder igual'. Crítica: es más barato pero técnicamente discutido.</>, fact: '⭐ Tesla recolecta datos de millones de autos en producción. ~10 millones de Teslas envían telemetría continua: esa data masiva es su ventaja competitiva única.' },
      { emoji: '🤖', name: 'Tesla FSD (Full Self-Driving)', how: <>FSD es el <B>nivel más avanzado de Tesla</B>: maneja en autopistas Y ciudades. La versión 12 (2024) usa una red neuronal end-to-end (cámaras → comportamiento del auto, sin código intermedio). Cuesta $8,000-$12,000 USD extra.</>, fact: "⭐ Crítica honesta: llamarlo 'Full Self-Driving' es engañoso — sigue siendo Nivel 2 técnicamente. Tesla tiene varias demandas en EE.UU. por marketing engañoso." },
      { emoji: '📊', name: 'Datos de seguridad reales de Tesla', how: <>Tesla publica reportes trimestrales: <B>1 accidente cada ~10M km con FSD activo vs ~1 cada 1M km de promedio en EE.UU.</B> Pero la crítica: los datos son auto-reportados y excluyen las condiciones donde FSD se desactiva.</>, fact: '⭐ Según la NHTSA (regulador de EE.UU.), Tesla está bajo investigación desde 2022 por 50+ accidentes con Autopilot activado, varios fatales. La verdad estadística es compleja.' },
    ],
  },
  5: {
    icon: '🚖', label: 'Módulo 5 de 19 · Waymo', title: 'Waymo · El taxi sin conductor real', sub: 'El enfoque opuesto: lidar + HD maps + cámaras. Operación comercial real. Toca cada tarjeta 👆',
    cards: [
      { emoji: '🚖', name: 'Waymo · El taxi sin conductor real', how: <>Waymo (división de Google) opera un <B>servicio comercial sin conductor en Phoenix, San Francisco, Los Ángeles y Austin</B> desde 2020. Más de 100,000 viajes semanales. Pides por app, llega solo, te lleva y se va.</>, fact: '⭐ Diferencia clave con Tesla: Waymo usa lidar + cámaras + radar + HD maps. Más caro de equipar, pero mucho más robusto en escenarios complejos. Apuesta opuesta filosóficamente.' },
      { emoji: '📈', name: 'Waymo vs accidentes humanos', how: <>Un estudio de Waymo (2024): <B>~80% menos accidentes con airbag activado</B> que los conductores humanos en la misma zona, tras 7M+ millas autónomas. Datos auditados por terceros, no auto-reportados.</>, fact: '⭐ El número es real pero cualificado: Waymo opera en geografías limitadas, con clima predominante bueno y velocidades urbanas bajas. Generalizarlo a todas las condiciones es prematuro.' },
      { emoji: '🚧', name: 'Limitaciones reales de Waymo en 2025-2026', how: <>Aún no opera bien en: <B>nieve fuerte, lluvia torrencial, zonas mal mapeadas o de noche en condiciones extremas</B>. Por eso solo está en ciudades del sur de EE.UU. con clima predecible.</>, fact: '⭐ Expansión planeada 2025-2027: Atlanta, Miami, Washington DC, Tokio. El reto NO es la IA — es escalar a geografías nuevas con HD maps confiables.' },
    ],
  },
  10: {
    icon: '📦', label: 'Módulo 10 de 19 · Drones delivery', title: 'Drones de delivery · Ya en producción', sub: 'Amazon, Wing y Zipline operan comercialmente. 3 casos reales. Toca cada tarjeta 👆',
    cards: [
      { emoji: '📦', name: 'Amazon Prime Air · Aprobado por la FAA', how: <>Amazon obtuvo la <B>aprobación FAA tipo Part 135</B> en 2020. Opera comercialmente en College Station (Texas) y Lockeford (California) desde 2022. Los drones cargan hasta 2.3 kg, vuelan 25 km y entregan en menos de 30 min.</>, fact: '⭐ En 2024 ya hacen cientos de entregas semanales. Productos limitados (nada frágil ni comida caliente). El reto es escalar, no la tecnología.' },
      { emoji: '🇦🇺', name: 'Wing (Google) · Líder global', how: <>Wing opera en Australia, Texas, Virginia y Finlandia. <B>200,000+ entregas comerciales</B> hasta 2024. Drones diseñados para baja altitud urbana, sin pista de aterrizaje (bajan la carga con un cable).</>, fact: '⭐ Caso colombiano potencial: Wing busca expandirse a LATAM en 2025-2026. Bogotá y Medellín se han evaluado, pero la regulación aeronáutica local aún no aprueba el uso comercial sistemático.' },
      { emoji: '🍕', name: 'Zipline · El líder en África', how: <>Zipline empezó entregando <B>sangre y medicinas en Ruanda y Ghana</B> donde no hay carreteras. Hoy también opera en Japón (alimentos) y EE.UU. (farmacia). 1M+ entregas reales.</>, fact: '⭐ Lección de Zipline: empezar resolviendo un problema crítico (de vida o muerte) genera regulación favorable. Ghana cambió sus leyes para permitir su operación. Modelo replicable en la LATAM rural.' },
    ],
  },
  12: {
    icon: '🚁', label: 'Módulo 12 de 19 · eVTOL', title: 'Taxis voladores · Joby, Volocopter, EHang', sub: 'Los eVTOL ya tienen certificación en algunos países. Estado real 2025-2026. Toca cada tarjeta 👆',
    cards: [
      { emoji: '🚁', name: 'Joby Aviation · El más avanzado', how: <>Joby tiene la <B>certificación tipo de la FAA en proceso</B> y planea operar taxis aéreos eléctricos en Nueva York y Los Ángeles desde 2025-2026. Vehículo: 4 pasajeros + 1 piloto, 240 km/h, 240 km de rango. Ruido = 1/4 de un helicóptero.</>, fact: '⭐ Inversores: Toyota, SK Telecom, Delta Airlines, Uber. Modelo de negocio: del aeropuerto al centro de la ciudad en menos de 10 minutos vs 1 hora de auto.' },
      { emoji: '🇦🇪', name: 'Volocopter · El operador más cerca', how: <>Volocopter (Alemania) hizo su <B>primera demostración pública en Dubái en 2023</B>. Taxis voladores autónomos. Plan: operar comercialmente desde la Expo 2025. Vehículo: 18 rotores eléctricos, 2 pasajeros, 35 km de rango.</>, fact: '⭐ Operación inicial planeada: del aeropuerto de Dubái a la palmera Jumeirah en 8 minutos. Costo estimado: $100-300 USD por viaje, similar a un helicóptero pero silencioso y eléctrico.' },
      { emoji: '🇨🇳', name: 'EHang · El primero en certificarse', how: <>EHang (China) obtuvo en 2023 la <B>primera certificación tipo del mundo para un eVTOL autónomo</B> (sin piloto). Vehículo: 2 pasajeros, 35 km/h, autonomía de 25 minutos. Ya operan vuelos turísticos en Cantón.</>, fact: '⭐ China lidera en regulación de eVTOL autónomo, no solo en prototipos. Primer mercado real con servicio comercial en operación. Posible referencia regulatoria global.' },
    ],
  },
  13: {
    icon: '🚦', label: 'Módulo 13 de 19 · Semáforos IA', title: 'Semáforos que piensan en tiempo real', sub: 'Pittsburgh redujo el tráfico un 40%. Singapur tiene red nacional. ¿Y Bogotá? Toca cada tarjeta 👆',
    cards: [
      { emoji: '🚦', name: 'Pittsburgh · Surtrac', how: <>Carnegie Mellon desarrolló Surtrac: un sistema que <B>adapta los semáforos en tiempo real con IA</B> según el tráfico real, no según horarios fijos. Resultados: 25-40% menos tiempo de viaje y 21% menos emisiones.</>, fact: '⭐ Implementado en 50+ intersecciones de Pittsburgh. Modelo replicable en cualquier ciudad. Costo: $20K-50K USD por intersección, con ROI en 18-36 meses por el ahorro de combustible.' },
      { emoji: '🇸🇬', name: 'Singapur · Smart Nation', how: <>Singapur tiene una <B>red nacional de IA en el transporte</B>: cámaras + sensores en todas las intersecciones, optimización en tiempo real y predicción de congestión con 30 min de anticipación.</>, fact: '⭐ Singapur invierte ~$2B USD/año en infraestructura inteligente. Caso de estudio único: una ciudad-estado entera como laboratorio, con datos públicos para investigadores de todo el mundo.' },
      { emoji: '🇨🇴', name: 'Bogotá · Sistemas básicos en pruebas', how: <>Bogotá tiene desde 2020 <B>semáforos adaptativos en TransMilenio y zonas piloto</B> (por ejemplo, el corredor Suba-Calle 100). 15% menos tiempo de viaje en horas valle. La implementación nacional aún es limitada por presupuesto.</>, fact: '⭐ El reto de LATAM: implementarlo a escala exige reemplazar miles de semáforos viejos + redes de comunicación + capacitación técnica. Es una decisión política, no técnica.' },
    ],
  },
  15: {
    icon: '🚆', label: 'Módulo 15 de 19 · Trenes', title: 'Trenes sin conductor · Ya llevan décadas', sub: 'Singapur (1987), Dubái, Europa. Por qué los trenes van adelante. Toca cada tarjeta 👆',
    cards: [
      { emoji: '🇸🇬', name: 'Singapur · 100% sin conductor desde 1987', how: <>El <B>MRT de Singapur</B> opera sin conductor desde su apertura. Las líneas modernas (NEL, CCL, DTL) están completamente automatizadas. 1.6M viajeros diarios, con un índice de seguridad líder mundial.</>, fact: '⭐ Patrón replicado: cuando construyes desde cero, la automatización es natural. El retrofit es lo difícil — modificar trenes humanos existentes a autónomos cuesta muchísimo más.' },
      { emoji: '🇦🇪', name: 'Dubái Metro · El más largo sin conductor', how: <>El Dubái Metro tiene <B>89.6 km de red 100% autónoma</B>, la más larga del mundo. Operativo desde 2009. Todo el sistema está vigilado por IA: detección de objetos en las vías y monitoreo de pasajeros.</>, fact: '⭐ Modelo financiero: $7.6B USD invertidos. Recuperan la inversión con publicidad en estaciones + tarifa baja + crecimiento urbano. El modelo Singapur extendido a ciudades nuevas.' },
      { emoji: '🇪🇺', name: 'Trenes de larga distancia · Europa avanza', how: <>Deutsche Bahn (Alemania) hizo demos de <B>trenes autónomos de carga de larga distancia</B> en 2024. SNCF (Francia) planea trenes de pasajeros TGV semi-autónomos para 2030. Italia ya opera el Frecciarossa con asistencia de IA.</>, fact: "⭐ Los trenes son el caso 'fácil' de automatización: vías fijas, sin peatones cruzando, sin tráfico mixto. Por eso van adelante de los autos. Lección: optimiza el escenario antes que el algoritmo." },
    ],
  },
  17: {
    icon: '📊', label: 'Módulo 17 de 19 · Seguridad', title: '¿Son seguros los autos autónomos?', sub: 'Las cifras crudas, lo que aún falla y el caso Uber 2018. Toca cada tarjeta 👆',
    cards: [
      { emoji: '📊', name: 'Las cifras crudas', how: <>EE.UU. tiene <B>~40,000 muertes anuales en accidentes</B> de tráfico. ~94% son por error humano (alcohol, distracción, velocidad, fatiga). Si la autonomía elimina solo el 50%, ya salvaría 18,000 vidas al año.</>, fact: '⭐ La narrativa pública se enfoca en los accidentes específicos de autos autónomos. El cálculo objetivo cambia el debate: incluso una autonomía imperfecta puede reducir las muertes totales.' },
      { emoji: '⚠️', name: 'Lo que aún falla', how: <>Los autos autónomos NO están listos para: <B>clima extremo, situaciones impredecibles (un objeto raro en la calle) o interpretar gestos humanos</B> (un policía dirigiendo el tráfico).</>, fact: "⭐ La pregunta NO es '¿son perfectos?' sino '¿son mejores que un conductor humano promedio?'. La respuesta empieza a ser SÍ en geografías controladas." },
      { emoji: '💔', name: 'El caso Uber 2018 · Punto de inflexión', how: <><B>Marzo de 2018, Tempe (Arizona)</B>: un auto autónomo de Uber atropelló mortalmente a Elaine Herzberg. La conductora de seguridad estaba viendo Hulu. El auto detectó a la víctima 6 segundos antes, pero NO frenó.</>, fact: '⭐ Resultado: Uber abandonó la autonomía vehicular en 2020. Fue el caso que cambió la conversación: la responsabilidad legal y la cultura de seguridad importan tanto como la IA.' },
    ],
  },
};

const REFLECTIONS: { [k: number]: { tag: string; icon: string; question: React.ReactNode; placeholder: string; min: number; xp: number } } = {
  2: { tag: 'Tu confianza · +14 XP', icon: '🤔', min: 80, xp: 14, placeholder: 'Confío más / menos en una máquina que en un humano porque... Lo dejaría llevar a mi familia desde...', question: <>Antes de los detalles: <B>¿confiarías en un auto que se maneja solo? ¿Desde qué edad lo dejarías llevar a tu hijo o a tu abuela? ¿Por qué confías más o menos en una máquina vs un humano al volante?</B> Sé honesto antes de procesar los datos del nivel.</> },
  7: { tag: 'Dilema del tranvía · +16 XP', icon: '💔', min: 120, xp: 16, placeholder: 'Quien debería decidir es... Yo priorizaría... porque...', question: <>El dilema del tranvía: <B>un tren va a chocar con 5 personas. Puedes desviarlo a otra vía donde solo hay 1. ¿Lo desvías?</B> En autos autónomos: si el accidente es inevitable, ¿el auto debe priorizar a sus pasajeros, a los peatones, a los niños? <B>¿Quién debería tomar esa decisión — el fabricante, el conductor, el regulador, una IA, nadie? ¿Qué priorizarías tú al programarlo?</B></> },
  11: { tag: 'Ética militar · +18 XP', icon: '🪖', min: 130, xp: 18, placeholder: 'Creo que es siempre / a veces aceptable porque... Las reglas mínimas serían...', question: <>Los drones militares autónomos ya existen. Turquía, EE.UU., Rusia e Israel los han usado en combates reales. La ONU debate restringirlos pero no hay tratado vinculante; algunos deciden <B>sin un humano en el loop</B>. <B>¿Es siempre inaceptable un dron militar autónomo, o hay casos defendibles (contra otros drones, defensa de territorio)? ¿Qué reglas mínimas deberían existir?</B></> },
  14: { tag: 'Tu ciudad · +18 XP', icon: '🇨🇴', min: 120, xp: 18, placeholder: 'En mi ciudad creo que llegará en... porque los obstáculos REALES son...', question: <>Las ciudades de LATAM tienen retos únicos: <B>tráfico caótico, motos por todos lados, calles sin nombres claros, peatones que cruzan donde sea, semáforos no siempre respetados, mapas no siempre actualizados</B>. <B>¿Crees que Bogotá, CDMX, Buenos Aires o tu ciudad tendrá autos autónomos comerciales en 5 años, 15, 30 o nunca? ¿Cuáles serían los obstáculos REALES (regulación, infraestructura, cultura) más allá de la tecnología?</B></> },
};

// ═══════════════════════════════════════════════════════════
export default function World6Level3() {
  const completeLevel = useGameStore((s) => s.completeLevel);

  const [step, setStep] = useState(0);
  useReportProgress(step, TOTAL_STEPS);
  const [xp, setXp] = useState(0);
  const [xpToast, setXpToast] = useState<{ amount: number; id: number } | null>(null);
  const awarded = useRef<Set<number>>(new Set());

  const matchPairs = useRef(pickN(MATCH_POOL, 5)).current;
  const rightOrder = useRef(shuffle(matchPairs.map((p) => p.right))).current;
  const navQ = useRef(pickN(NAV_POOL, 5).map(shuffleOpts)).current;
  const transportQ = useRef(pickN(TRANSPORT_POOL, 5).map(shuffleOpts)).current;
  const accidentsQ = useRef(pickN(ACCIDENTS_POOL, 5)).current;
  const sensorsItems = useRef(shuffle(SENSORS_POOL)).current;

  // Reflexión
  const [reflectText, setReflectText] = useState('');
  const [reflectFb, setReflectFb] = useState<string | null>(null);

  // Matching
  const [matchSel, setMatchSel] = useState<number | null>(null);
  const [matchedLeft, setMatchedLeft] = useState<Set<number>>(new Set());
  const [matchedRight, setMatchedRight] = useState<Set<number>>(new Set());
  const [matchWrong, setMatchWrong] = useState<{ l: number; r: number } | null>(null);
  const [matchFb, setMatchFb] = useState<{ ok: boolean; msg: string } | null>(null);

  // Quiz
  const [quizAnswers, setQuizAnswers] = useState<{ [k: number]: number }>({});
  const [quizChecked, setQuizChecked] = useState(false);

  // V/F
  const [tfAnswers, setTfAnswers] = useState<{ [k: number]: boolean }>({});
  const [tfChecked, setTfChecked] = useState(false);

  // Drag (3 columnas)
  const [dragPlaced, setDragPlaced] = useState<{ [k: number]: 'vision' | 'distancia' | 'ubicacion' }>({});
  const [dragSel, setDragSel] = useState<number | null>(null);
  const [dragSolved, setDragSolved] = useState(false);
  const [dragFb, setDragFb] = useState<{ ok: boolean; msg: string } | null>(null);
  const [dragFlash, setDragFlash] = useState<Set<number>>(new Set());
  const dragAttempts = useRef(0);

  // Sprint
  const [sprintRunning, setSprintRunning] = useState(false);
  const [sprintDone, setSprintDone] = useState(false);
  const [sprintTime, setSprintTime] = useState(90);
  const [sprintPicks, setSprintPicks] = useState<{ [k: number]: 'good' | 'bad' }>({});
  const [sprintFb, setSprintFb] = useState<{ ok: boolean; msg: string } | null>(null);
  const sprintPicksRef = useRef<{ [k: number]: 'good' | 'bad' }>({});
  const sprintDoneRef = useRef(false);

  // Builder
  const [builderState, setBuilderState] = useState<{ [k: string]: string }>({});

  // Ejemplos (expandibles)
  const [expandedEx, setExpandedEx] = useState<number | null>(null);

  const isTheory = THEORY_STEPS.has(step);
  const currentReflection = REFLECTIONS[step];
  const currentExample = EXAMPLES[step];
  const currentQuiz = step === 16 ? navQ : step === 18 ? transportQ : null;

  useEffect(() => {
    setReflectText(''); setReflectFb(null);
    setMatchSel(null); setMatchedLeft(new Set()); setMatchedRight(new Set()); setMatchWrong(null); setMatchFb(null);
    setQuizAnswers({}); setQuizChecked(false);
    setTfAnswers({}); setTfChecked(false);
    setDragPlaced({}); setDragSel(null); setDragSolved(false); setDragFb(null); setDragFlash(new Set()); dragAttempts.current = 0;
    setSprintRunning(false); setSprintDone(false); setSprintTime(90); setSprintPicks({}); setSprintFb(null);
    sprintPicksRef.current = {}; sprintDoneRef.current = false;
    setBuilderState({});
    setExpandedEx(null);
  }, [step]);

  useEffect(() => {
    if (!sprintRunning || sprintDone) return;
    if (sprintTime <= 0) { evaluateSprint(true); return; }
    const t = setTimeout(() => setSprintTime((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [sprintRunning, sprintTime, sprintDone]);

  const addXP = useCallback((amount: number) => {
    setXp((p) => p + amount);
    if (amount > 0) setXpToast((prev) => ({ amount, id: (prev?.id ?? 0) + 1 }));
  }, []);
  const awardOnce = (amount: number) => { if (!awarded.current.has(step)) { awarded.current.add(step); if (amount > 0) addXP(amount); } };

  // Matching
  const matchLeft = (i: number) => { if (matchedLeft.has(i)) return; setMatchSel(i); };
  const matchRight = (ri: number) => {
    if (matchSel === null || matchedRight.has(ri)) return;
    if (rightOrder[ri] === matchPairs[matchSel].right) {
      const nl = new Set(matchedLeft).add(matchSel);
      const nr = new Set(matchedRight).add(ri);
      setMatchedLeft(nl); setMatchedRight(nr); setMatchSel(null);
      if (nl.size === matchPairs.length) { awardOnce(15); setMatchFb({ ok: true, msg: '¡Excelente! Todos los pares conectados. +15 XP 🎉' }); }
      else setMatchFb({ ok: true, msg: `¡Par correcto! ${nl.size} de ${matchPairs.length} conectados. 🎯` });
    } else {
      setMatchWrong({ l: matchSel, r: ri });
      setTimeout(() => { setMatchWrong(null); setMatchSel(null); }, 500);
    }
  };
  const matchComplete = matchedLeft.size === matchPairs.length;

  // Quiz / VF
  const checkQuiz = () => { if (!currentQuiz) return; setQuizChecked(true); let c = 0; currentQuiz.forEach((q, i) => { if (quizAnswers[i] === q.correct) c++; }); awardOnce(c * 8); };
  const checkTF = () => { setTfChecked(true); let c = 0; accidentsQ.forEach((it, i) => { if (tfAnswers[i] === it.correct) c++; }); awardOnce(c * 5); };

  // Drag
  const placeDrag = (zone: 'vision' | 'distancia' | 'ubicacion') => { if (dragSel === null || dragSolved) return; setDragPlaced((prev) => ({ ...prev, [dragSel]: zone })); setDragSel(null); setDragFb(null); };
  const removeDrag = (idx: number) => { if (dragSolved) return; setDragPlaced((prev) => { const n = { ...prev }; delete n[idx]; return n; }); };
  const checkDrag = () => {
    const placedCount = Object.keys(dragPlaced).length;
    if (placedCount < sensorsItems.length) { setDragFb({ ok: false, msg: `Faltan ${sensorsItems.length - placedCount} tarjetas. Toca un chip y luego la columna.` }); return; }
    dragAttempts.current += 1;
    const wrong: number[] = []; let correct = 0;
    sensorsItems.forEach((it, i) => { if (dragPlaced[i] === it.correct) correct++; else wrong.push(i); });
    if (correct === sensorsItems.length) {
      setDragSolved(true);
      const earned = dragAttempts.current === 1 ? 20 : 10;
      awardOnce(earned);
      setDragFb({ ok: true, msg: `¡Genial! ${sensorsItems.length} correctas. +${earned} XP 🎉${dragAttempts.current === 1 ? ' (¡primer intento!)' : ''}` });
    } else {
      setDragPlaced((prev) => { const n = { ...prev }; wrong.forEach((i) => delete n[i]); return n; });
      setDragFlash(new Set(wrong));
      setTimeout(() => setDragFlash(new Set()), 700);
      setDragFb({ ok: false, msg: `${correct} de ${sensorsItems.length} correctas. Las incorrectas vuelven al banco.` });
    }
  };

  // Sprint
  const startSprint = () => {
    sprintPicksRef.current = {}; sprintDoneRef.current = false;
    setSprintPicks({}); setSprintDone(false); setSprintFb(null); setSprintTime(90); setSprintRunning(true);
  };
  const pickSprint = (i: number) => {
    if (sprintDoneRef.current || sprintPicksRef.current[i] !== undefined) return;
    const next = { ...sprintPicksRef.current, [i]: FUTURE_AUTO_ITEMS[i].good ? 'good' as const : 'bad' as const };
    sprintPicksRef.current = next; setSprintPicks(next);
    const good = Object.values(next).filter((v) => v === 'good').length;
    const totalGood = FUTURE_AUTO_ITEMS.filter((x) => x.good).length;
    if (good >= 5 || good === totalGood) evaluateSprint(false);
  };
  const evaluateSprint = (timeout: boolean) => {
    if (sprintDoneRef.current) return;
    sprintDoneRef.current = true; setSprintDone(true); setSprintRunning(false);
    const picks = sprintPicksRef.current;
    const good = Object.values(picks).filter((v) => v === 'good').length;
    const bad = Object.values(picks).filter((v) => v === 'bad').length;
    const earned = Math.max(0, good * 5 - bad * 2);
    awardOnce(earned);
    setSprintFb(good >= 5
      ? { ok: true, msg: `¡Sprint logrado! ${good} elecciones correctas${bad > 0 ? ` (${bad} errores)` : ''}. +${earned} XP 🎉` }
      : { ok: false, msg: `${timeout ? '⏱ Tiempo agotado. ' : ''}Solo ${good} correctas (meta: 5). +${earned} XP` });
  };

  // Builder
  const builderComplete = (cfg: BuilderConfig) => cfg.rows.every((r) => builderState[r.key]);

  const sendReflection = (): boolean => {
    if (!currentReflection) return false;
    const t = reflectText.trim();
    if (t.length < currentReflection.min) { setReflectFb(`Escribe al menos ${currentReflection.min} caracteres (llevas ${t.length}).`); return false; }
    if (looksRandom(t)) { setReflectFb('Parece texto al azar. Escribe una idea real con tus propias palabras.'); return false; }
    if (!containsTopic(t)) { setReflectFb('Conéctalo con el tema: autos autónomos, drones, movilidad o tu ciudad.'); return false; }
    setReflectFb(null); awardOnce(currentReflection.xp); return true;
  };

  // Footer button
  type Primary = { label: string; enabled: boolean; onPress: () => void; accent?: boolean };
  const advance = () => setStep((s) => s + 1);
  const getPrimary = (): Primary => {
    if (currentExample) return { label: 'Sigamos →', enabled: true, onPress: advance };
    if (currentReflection) return { label: 'Enviar reflexión →', enabled: reflectText.trim().length >= currentReflection.min, onPress: () => { if (sendReflection()) advance(); } };
    if (currentQuiz) return quizChecked ? { label: 'Ver resultado →', enabled: true, onPress: advance } : { label: 'Comprobar respuestas', enabled: Object.keys(quizAnswers).length === currentQuiz.length, onPress: checkQuiz, accent: true };
    switch (step) {
      case 0: return { label: '¡Vamos! Empecemos 🚀', enabled: true, onPress: advance };
      case 1: return { label: 'Entendido, sigamos →', enabled: true, onPress: advance };
      case 3: return { label: matchComplete ? 'Continuar →' : 'Conecta todos los pares', enabled: matchComplete, onPress: advance };
      case 6: return dragSolved ? { label: 'Continuar →', enabled: true, onPress: advance } : { label: 'Verificar clasificación', enabled: Object.keys(dragPlaced).length > 0, onPress: checkDrag, accent: true };
      case 8: return tfChecked ? { label: 'Continuar →', enabled: true, onPress: advance } : { label: 'Comprobar', enabled: Object.keys(tfAnswers).length === accidentsQ.length, onPress: checkTF, accent: true };
      case 9:
        if (sprintDone) return { label: 'Continuar →', enabled: true, onPress: advance };
        if (sprintRunning) return { label: 'Elige las características reales…', enabled: false, onPress: () => {} };
        return { label: '▶ Iniciar Sprint (90s)', enabled: true, onPress: startSprint, accent: true };
      case 19: return { label: 'Terminar →', enabled: builderComplete(BUILDER_CITY), onPress: () => { awardOnce(BUILDER_CITY.xp); advance(); } };
      default: return { label: 'Continuar →', enabled: true, onPress: advance };
    }
  };

  const finishLevel = () => {
    const stars = xp >= 185 ? 3 : xp >= 120 ? 2 : 1; // máx real ~253 XP
    completeLevel(33, stars, xp);
    router.replace('/level/34');
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

  const DRAG_ZONES: { k: 'vision' | 'distancia' | 'ubicacion'; label: string }[] = [
    { k: 'vision', label: '👁️ Captura visual' },
    { k: 'distancia', label: '📏 Mide distancia' },
    { k: 'ubicacion', label: '🌍 Ubica en el mundo' },
  ];

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
      return step === 16 ? renderQuiz(navQ, 'Módulo 16 de 19 · Quiz', 'Cómo aprenden Google Maps y Waze', '5 preguntas sobre cómo funcionan las apps que usas todos los días.')
        : renderQuiz(transportQ, 'Módulo 18 de 19 · Quiz', 'Quiz · Transporte inteligente', '5 preguntas finales que integran todo lo aprendido.');
    }
    switch (step) {
      case 0: return (
        <View>
          <View style={styles.introIcon}><Text style={{ fontSize: 34 }}>🚗</Text></View>
          <Tag icon="✨" label="Nivel 33 · Mundo 6" variant="intro" />
          <Title>IA en Movimiento: Autos y Drones</Title>
          <Sub>Si N32 exploró robots con cuerpo, N33 explora máquinas que se mueven solas. Autos autónomos ya operan en San Francisco. Taxis voladores tienen prototipos reales. Drones reparten en Texas. La movilidad cambió mientras nadie miraba.</Sub>
          <View style={[styles.card, styles.cardAccent]}><Text style={styles.cardTitle}>📚  Qué vas a aprender</Text><Text style={styles.cardText}>5 niveles de autonomía · Tesla vs Waymo: filosofías opuestas · Sensores reales (lidar, cámaras) · Dilema del tranvía · Drones de delivery · Taxis voladores (Joby, Volocopter) · Semáforos inteligentes · Trenes autónomos</Text></View>
          <View style={[styles.card, styles.cardGreen]}><Text style={styles.cardTitle}>⚡  Qué podrás HACER al terminar</Text><Text style={styles.cardText}>Tener una visión clara del estado real de la movilidad autónoma 2025-2026 y formar tu opinión informada sobre seguridad, ética y lo que llegará a tu ciudad.</Text></View>
          <View style={[styles.card, styles.cardYellow]}><Text style={styles.cardTitle}>🎮  19 módulos · 45-60 min · hasta 230 XP</Text><Text style={styles.cardText}>📖 Teoría · 🤔 Confianza · 🔗 5 niveles · 🚗 Tesla · 🚖 Waymo · 👁️ Sensores · 💔 Dilema · ✅ V/F · ⏱ Sprint 2035 · 📦 Drones · 🪖 Ética militar · 🚁 eVTOL · 🚦 Semáforos · 🇨🇴 Tu ciudad · 🚆 Trenes · ❓ Navegación · 📊 Seguridad · ❓ Quiz · 🏙️ Builder</Text></View>
        </View>
      );
      case 1: return (
        <View>
          <Tag icon="📖" label="Módulo 1 de 19 · Teoría" variant="theory" />
          <Title>La movilidad cambió mientras nadie miraba</Title>
          <Body>Si N32 exploró robots con cuerpo, N33 explora algo más concreto y cercano: <B>máquinas que se mueven solas para llevarte (o lo que pidas) de un lugar a otro</B>. Autos sin conductor ya operan en San Francisco. Drones reparten en Texas. Taxis voladores tienen permisos en Dubái.</Body>
          <View style={styles.highlightBox}><Text style={styles.highlightText}>💡 <B>La pregunta clave:</B>{'\n\n'}Cuando un humano comete un error de tráfico, lo aceptamos como parte de la vida. Cuando una máquina lo hace, genera titulares mundiales. <B>¿Es justo? ¿Cómo decidimos cuándo confiar en una IA al volante?</B></Text></View>
          <Body>Lo que cambió en 2024-2026: <B>los autos autónomos pasaron de demos a producción real</B>. Waymo hace 100,000 viajes semanales en EE.UU. El FSD de Tesla está en millones de autos. Mientras debatimos su ética, la tecnología ya está aquí.</Body>
          <Text style={styles.sectionTitle}>🚗 Las 4 categorías de IA en movimiento hoy</Text>
          {[['1', 'Autos autónomos:', ' Tesla, Waymo, Cruise — diferentes enfoques.'], ['2', 'Drones de delivery:', ' Amazon, Wing, Zipline ya operan.'], ['3', 'Taxis voladores:', ' Joby, Volocopter — primeros vuelos comerciales.'], ['4', 'Trenes y semáforos inteligentes:', ' Singapur, Dubái, Pittsburgh.']].map(([n, t, d]) => (
            <View key={n} style={styles.stepLi}><View style={styles.stepNum}><Text style={styles.stepNumText}>{n}</Text></View><Text style={styles.stepLiText}><B>{t}</B>{d}</Text></View>
          ))}
          <View style={styles.tipBox}><Text style={styles.tipText}>✅ <B>Verdad operativa:</B> los autos autónomos NO son perfectos. Pero la pregunta no es '¿son perfectos?', sino '¿son MEJORES que un conductor humano promedio?'. La respuesta empieza a ser SÍ en geografías controladas.</Text></View>
        </View>
      );
      case 3: return (
        <View>
          <Tag icon="🔗" label="Módulo 3 de 19 · Matching" variant="activity" />
          <Title>Los 5 niveles de autonomía</Title>
          <Sub>La SAE definió 6 niveles (0-5). Conecta cada uno con su descripción real: toca un nivel y luego su descripción.</Sub>
          <View style={styles.matchHeaderRow}><Text style={styles.matchColLabel}>Nivel</Text><Text style={styles.matchColLabel}>Descripción técnica</Text></View>
          {matchPairs.map((p, i) => (
            <View key={i} style={styles.matchRow}>
              <TouchableOpacity disabled={matchedLeft.has(i)} style={[styles.matchItem, styles.matchLeft, matchSel === i && styles.matchItemSel, matchedLeft.has(i) && styles.matchItemDone, matchWrong?.l === i && styles.matchItemWrong]} onPress={() => matchLeft(i)}>
                <Text style={[styles.matchText, styles.matchLeftText, matchedLeft.has(i) && styles.matchTextDone]}>{p.left}</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={matchedRight.has(i)} style={[styles.matchItem, styles.matchRightBox, matchedRight.has(i) && styles.matchItemDone, matchWrong?.r === i && styles.matchItemWrong]} onPress={() => matchRight(i)}>
                <Text style={[styles.matchText, styles.matchRightText, matchedRight.has(i) && styles.matchTextDone]}>{rightOrder[i]}</Text>
              </TouchableOpacity>
            </View>
          ))}
          {matchFb && <View style={[styles.fb, styles.fbOk]}><Text style={styles.fbOkText}>{matchFb.msg}</Text></View>}
        </View>
      );
      case 6: return (
        <View>
          <Tag icon="🧩" label="Módulo 6 de 19 · Clasificar" variant="activity" />
          <Title>¿Qué ve un auto autónomo?</Title>
          <Sub>8 sensores reales. Clasifícalos: ¿captan IMAGEN, MIDEN DISTANCIA o UBICAN en el mundo? Toca un chip y luego su columna.</Sub>
          <View style={styles.chipsPool}>
            {sensorsItems.map((it, i) => dragPlaced[i] === undefined && (
              <TouchableOpacity key={i} disabled={dragSolved} style={[styles.chip, dragSel === i && styles.chipSel, dragFlash.has(i) && styles.chipFlash]} onPress={() => setDragSel(dragSel === i ? null : i)}>
                <Text style={[styles.chipText, dragSel === i && { color: P.blueText }]}>{it.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {DRAG_ZONES.map((z) => {
            const placedHere = Object.keys(dragPlaced).map(Number).filter((k) => dragPlaced[k] === z.k);
            const hasItem = placedHere.length > 0;
            const zStyle = z.k === 'vision' ? styles.zoneVision : z.k === 'distancia' ? styles.zoneDist : styles.zoneUbic;
            const zHead = z.k === 'vision' ? styles.zoneHeadVision : z.k === 'distancia' ? styles.zoneHeadDist : styles.zoneHeadUbic;
            const zColor = z.k === 'vision' ? '#1e40af' : z.k === 'distancia' ? P.amberText : P.violetText;
            return (
              <TouchableOpacity key={z.k} activeOpacity={0.9} disabled={dragSel === null || dragSolved} style={[styles.dropRow, hasItem && zStyle]} onPress={() => placeDrag(z.k)}>
                <View style={[styles.dropHeader, zHead]}><Text style={[styles.dropHeaderText, { color: zColor }]}>{z.label}</Text></View>
                <View style={styles.dropArea}>
                  {placedHere.map((k) => (
                    <TouchableOpacity key={k} disabled={dragSolved} onPress={() => removeDrag(k)} style={[styles.dropChip, zHead]}>
                      <Text style={[styles.dropChipText, { color: zColor }]}>{sensorsItems[k].text}  ✕</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}
          {dragFb && <View style={[styles.fb, dragFb.ok ? styles.fbOk : styles.fbBad]}><Text style={dragFb.ok ? styles.fbOkText : styles.fbBadText}>{dragFb.msg}</Text></View>}
        </View>
      );
      case 8: return (
        <View>
          <Tag icon="✅" label="Módulo 8 de 19 · Verdadero o Falso" variant="activity" />
          <Title>Accidentes de autos autónomos · ¿Verdad o mito?</Title>
          <Sub>5 afirmaciones populares. Algunas son ciertas, otras NO.</Sub>
          {accidentsQ.map((it, i) => {
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
      case 9: return (
        <View>
          <Tag icon="⏱" label="Módulo 9 de 19 · Sprint 90s" variant="sprint" />
          <Title>Sprint: ¿cómo será el auto del 2035?</Title>
          <Sub>10 características posibles. Toca solo las que serán REALES en 90 segundos. Meta: 5 buenas.</Sub>
          <View style={styles.sprintBox}>
            <View style={styles.sprintTimer}>
              <Text style={[styles.sprintTime, sprintTime <= 10 && { color: P.red }]}>{Math.floor(sprintTime / 60)}:{String(sprintTime % 60).padStart(2, '0')}</Text>
              <Text style={styles.sprintLabel}>{sprintDone ? 'Sprint terminado' : sprintRunning ? `${Object.values(sprintPicks).filter((v) => v === 'good').length} buenas · ${Object.keys(sprintPicks).length} elegidas` : 'Meta: 5 buenas'}</Text>
            </View>
            <View style={{ gap: 7 }}>
              {FUTURE_AUTO_ITEMS.map((it, i) => {
                const pick = sprintPicks[i];
                return (
                  <TouchableOpacity key={i} activeOpacity={0.8} disabled={!sprintRunning || sprintDone || pick !== undefined} style={[styles.sprintItem, pick === 'good' && styles.sprintItemOk, pick === 'bad' && styles.sprintItemBad]} onPress={() => pickSprint(i)}>
                    <View style={[styles.sprintMarker, pick === 'good' && styles.sprintMarkerOk, pick === 'bad' && styles.sprintMarkerBad]}><Text style={[styles.sprintMarkerText, pick && { color: '#fff' }]}>{i + 1}</Text></View>
                    <Text style={styles.sprintItemText}>{it.text}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          {sprintFb && <View style={[styles.fb, sprintFb.ok ? styles.fbOk : styles.fbBad]}><Text style={sprintFb.ok ? styles.fbOkText : styles.fbBadText}>{sprintFb.msg}</Text></View>}
        </View>
      );
      case 19: return (
        <View>
          <Tag icon="🏙️" label="Módulo 19 de 19 · Builder" variant="build" />
          <Title>Diseña tu ciudad con movilidad IA</Title>
          <Sub>4 sistemas integrados: público + privado + peatonal + aéreo.</Sub>
          <View style={styles.builderWrap}>
            {BUILDER_CITY.rows.map((r) => (
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
          <Text style={[styles.builderLabel, { marginTop: 12, marginBottom: 4 }]}>Tu sistema de movilidad:</Text>
          <View style={styles.codeBox}>
            {BUILDER_CITY.rows.map((r) => (
              <Text key={r.key} style={styles.codeLine}>
                <Text style={styles.codeKey}>{r.label}: </Text>
                {builderState[r.key] ? <Text style={styles.codeText}>{builderState[r.key]}</Text> : <Text style={styles.codeEmpty}>elige una opción</Text>}
              </Text>
            ))}
          </View>
        </View>
      );
      case 20: {
        const pct = Math.round((33 / 36) * 100);
        return (
          <View style={styles.completeContainer}>
            <View style={styles.completeBadge}><Text style={{ fontSize: 44 }}>🚗</Text></View>
            <Text style={styles.completeTitle}>¡Nivel 33 completado!</Text>
            <Text style={styles.completeSub}>Terminaste "IA en Movimiento: Autos y Drones". Ahora eres Mobility Innovator.</Text>
            <View style={styles.xpEarned}><Text style={styles.xpEarnedText}>⭐ {xp} XP ganados en este nivel</Text></View>
            <View style={styles.skillsList}>
              {['Conozco los 5 niveles de autonomía y dónde está cada empresa hoy', 'Distingo Tesla Autopilot, Waymo y otros: enfoques técnicos diferentes', 'Entiendo el dilema del tranvía y por qué importa para la programación ética', 'Sé el estado real del delivery por dron, los taxis voladores y los trenes autónomos', 'Tengo opinión informada sobre la seguridad de los autos autónomos vs los humanos'].map((s, i) => (
                <View key={i} style={styles.skillRow}><Text style={styles.skillCheck}>✓</Text><Text style={styles.skillText}>{s}</Text></View>
              ))}
            </View>
            <View style={styles.nextHint}><Text style={styles.nextHintText}><B>Nivel 34: IA y Tu Planeta</B>{'\n'}Si N33 exploró cómo nos movemos, N34 explora dónde vivimos. Cómo la IA está cambiando el clima, las ciudades, el agua y la agricultura. El planeta que TÚ vas a heredar.</Text></View>
            <View style={styles.lvlBarWrap}>
              <Text style={styles.lvlBarLabel}>Nivel 33 de 36 completado · {pct}% del camino</Text>
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
  fill: { height: '100%', backgroundColor: P.blue, borderRadius: 4 },
  xpChip: { ...typography.bold, fontSize: 13, color: '#854d0e', backgroundColor: '#fde68a', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
  progLabel: { ...typography.regular, fontSize: 11, color: P.faint, textAlign: 'center', paddingTop: 6 },
  scrollContent: { padding: 16, paddingBottom: 30 },

  tag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginBottom: 12 },
  tagText: { fontSize: 11, fontWeight: '700' },

  introIcon: { width: 68, height: 68, borderRadius: 20, backgroundColor: P.blueBg, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  title: { ...typography.extraBold, fontSize: 20, color: P.ink, marginBottom: 8, lineHeight: 26 },
  sub: { ...typography.regular, fontSize: 13, color: P.muted, lineHeight: 20, marginBottom: 12 },
  bodyText: { ...typography.regular, fontSize: 13, color: P.body, lineHeight: 22, marginBottom: 12 },
  bold: { fontWeight: '700', color: P.ink },
  sectionTitle: { ...typography.bold, fontSize: 14, color: P.ink, marginTop: 10, marginBottom: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f0f0f0' },

  card: { backgroundColor: P.cardBg, borderRadius: 14, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: P.border },
  cardAccent: { backgroundColor: P.blueBg, borderColor: P.blueBorder },
  cardGreen: { backgroundColor: P.greenSoft, borderColor: P.greenBorder },
  cardYellow: { backgroundColor: '#fefce8', borderColor: P.amberBorder },
  cardViolet: { backgroundColor: P.violetBg, borderColor: P.violetBorder },
  cardTitle: { ...typography.bold, fontSize: 13, color: P.ink, marginBottom: 4 },
  cardText: { ...typography.regular, fontSize: 13, color: P.body, lineHeight: 21 },

  highlightBox: { borderLeftWidth: 3, borderLeftColor: P.blue, backgroundColor: P.blueBg, borderRadius: 8, padding: 12, marginBottom: 12 },
  highlightText: { fontSize: 13, color: P.blueText, lineHeight: 21 },
  tipBox: { borderLeftWidth: 3, borderLeftColor: P.green, backgroundColor: P.greenSoft, borderRadius: 8, padding: 12, marginTop: 4 },
  tipText: { fontSize: 13, color: P.greenText, lineHeight: 21 },
  stepLi: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 9 },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: P.blue, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  stepLiText: { flex: 1, fontSize: 13, color: P.body, lineHeight: 20 },

  chipsPool: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, padding: 10, backgroundColor: P.cardBg, borderRadius: 14, borderWidth: 1, borderColor: P.border, marginBottom: 10, minHeight: 54 },
  chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#d1d5db', backgroundColor: '#fff' },
  chipSel: { borderColor: P.blue, backgroundColor: P.blueBg },
  chipFlash: { borderColor: '#fca5a5', backgroundColor: P.redBg },
  chipText: { fontSize: 12, color: P.body, lineHeight: 16 },
  dropRow: { borderRadius: 12, borderWidth: 2, borderColor: '#d1d5db', borderStyle: 'dashed', minHeight: 58, padding: 8, backgroundColor: '#fafafa', marginBottom: 8 },
  zoneVision: { borderStyle: 'solid', borderColor: P.blueBorder, backgroundColor: P.blueBg },
  zoneDist: { borderStyle: 'solid', borderColor: P.amberBorder, backgroundColor: '#fffbeb' },
  zoneUbic: { borderStyle: 'solid', borderColor: P.violetBorder, backgroundColor: P.violetBg },
  dropHeader: { paddingVertical: 5, paddingHorizontal: 6, borderRadius: 7, marginBottom: 7, alignSelf: 'flex-start' },
  zoneHeadVision: { backgroundColor: '#dbeafe' },
  zoneHeadDist: { backgroundColor: P.amberBg },
  zoneHeadUbic: { backgroundColor: '#ede9fe' },
  dropHeaderText: { fontSize: 11, fontWeight: '700' },
  dropArea: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  dropChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14 },
  dropChipText: { fontSize: 11, fontWeight: '500', lineHeight: 15 },

  matchHeaderRow: { flexDirection: 'row', gap: 6, marginBottom: 5 },
  matchColLabel: { flex: 1, fontSize: 11, fontWeight: '700', color: P.muted, textAlign: 'center' },
  matchRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  matchItem: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', minHeight: 66 },
  matchLeft: { borderColor: P.blueBorder, backgroundColor: P.blueBg },
  matchRightBox: { borderColor: P.violetBorder, backgroundColor: P.violetBg },
  matchItemSel: { borderColor: P.blue, backgroundColor: '#dbeafe' },
  matchItemDone: { borderColor: P.green, backgroundColor: P.greenSoft },
  matchItemWrong: { borderColor: P.red, backgroundColor: P.redBg },
  matchText: { fontSize: 11, textAlign: 'center', lineHeight: 15 },
  matchLeftText: { color: '#1e40af', fontWeight: '700' },
  matchRightText: { color: P.violetText },
  matchTextDone: { color: P.greenText },

  builderWrap: { gap: 10 },
  builderRow: { backgroundColor: P.cardBg, borderWidth: 1, borderColor: P.border, borderRadius: 12, padding: 11 },
  builderLabel: { fontSize: 11, fontWeight: '700', color: P.blueText, marginBottom: 6, letterSpacing: 0.3, textTransform: 'uppercase' },
  builderOpts: { gap: 5 },
  builderOpt: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 9, borderWidth: 1.5, borderColor: P.border, backgroundColor: '#fff' },
  builderOptSel: { borderColor: P.blue, backgroundColor: P.blueBg },
  builderOptText: { fontSize: 12, color: P.body, fontWeight: '500', lineHeight: 16 },
  builderOptTextSel: { color: P.blueText, fontWeight: '700' },
  codeBox: { backgroundColor: P.codeBg, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#1e293b' },
  codeLine: { fontSize: 12, lineHeight: 20, marginBottom: 2 },
  codeText: { color: P.codeText, fontFamily: 'monospace' },
  codeKey: { color: P.codeKey, fontWeight: '700', fontFamily: 'monospace' },
  codeEmpty: { color: P.codeEmpty, fontStyle: 'italic', fontFamily: 'monospace' },

  quizQ: { ...typography.bold, fontSize: 13, color: P.ink, padding: 12, backgroundColor: P.cardBg, borderRadius: 10, borderWidth: 1, borderColor: P.border, marginBottom: 8, lineHeight: 19 },
  qopt: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 11, borderWidth: 1.5, borderColor: P.border, backgroundColor: '#fff', marginBottom: 7 },
  qoptSel: { borderColor: P.blue, backgroundColor: P.blueBg },
  qoptOk: { borderColor: P.green, backgroundColor: P.greenBg },
  qoptWrong: { borderColor: P.red, backgroundColor: P.redBg },
  qLetter: { width: 24, height: 24, borderRadius: 7, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: P.border, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  qLetterSel: { backgroundColor: P.blue, borderColor: P.blue },
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

  sprintBox: { backgroundColor: P.orangeBg, borderWidth: 2, borderColor: P.orangeBorder, borderRadius: 14, padding: 14 },
  sprintTimer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, padding: 8, paddingHorizontal: 12, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: P.orangeBorder },
  sprintTime: { fontSize: 22, fontWeight: '800', color: '#c2410c' },
  sprintLabel: { flex: 1, fontSize: 11, color: P.orangeText },
  sprintItem: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, backgroundColor: '#fff', borderWidth: 1.5, borderColor: P.orangeBorder, borderRadius: 9 },
  sprintItemOk: { borderColor: P.green, backgroundColor: P.greenBg },
  sprintItemBad: { borderColor: P.red, backgroundColor: P.redBg },
  sprintMarker: { width: 22, height: 22, borderRadius: 6, backgroundColor: P.orangeBorder, alignItems: 'center', justifyContent: 'center' },
  sprintMarkerOk: { backgroundColor: P.green },
  sprintMarkerBad: { backgroundColor: P.red },
  sprintMarkerText: { fontSize: 11, fontWeight: '700', color: P.orangeText },
  sprintItemText: { flex: 1, fontSize: 12, color: P.body, lineHeight: 17 },

  reflectArea: { minHeight: 120, padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: P.border, backgroundColor: '#fafafa', fontSize: 13, color: P.body, lineHeight: 22, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: P.faint, textAlign: 'right', marginTop: 4 },

  exCard: { borderRadius: 14, padding: 12, borderWidth: 1, borderColor: P.border, marginBottom: 8, backgroundColor: '#fff' },
  exCardOpen: { borderColor: P.blue, backgroundColor: P.blueBg },
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
  completeBadge: { width: 88, height: 88, borderRadius: 24, backgroundColor: P.blue, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
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
  lvlBarInner: { height: '100%', backgroundColor: P.blue, borderRadius: 4 },

  navRow: { flexDirection: 'row', gap: 8, padding: 14, borderTopWidth: 1, borderTopColor: '#f0f0f0', backgroundColor: '#fafafa' },
  backBtn: { paddingHorizontal: 16, paddingVertical: 13, borderRadius: 12, backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#e2e8f0', justifyContent: 'center' },
  backBtnText: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  primaryBtn: { backgroundColor: P.green, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
  primaryBtnAccent: { backgroundColor: P.blue },
  primaryBtnOff: { opacity: 0.35 },
  primaryBtnText: { ...typography.bold, color: '#fff', fontSize: 15 },
});
