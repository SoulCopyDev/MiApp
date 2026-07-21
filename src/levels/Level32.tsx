import { exitLevel } from '../utils/exitLevel';
import { router } from 'expo-router';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { useReportProgress } from '../components/LevelProgress';
import { typography } from '../theme';
import XPToast from '../components/XPToast';

// ═══════════════════════════════════════════════════════════
// Nivel 32 · Robótica e IA: El Cuerpo de la IA (Mundo 6)
// Mundo 6 · TEMA CLARO (slate + naranja: #475569 / #ea580c).
// Reconstruido vs nivel-32.html (estándar v2.2).
// 19 módulos de contenido (steps 1-19).
// (El TSX previo tenía contenido de AGI: correspondía a N31.)
// ═══════════════════════════════════════════════════════════

const P = {
  screen: '#ffffff',
  ink: '#111827', body: '#374151', muted: '#6b7280', faint: '#9ca3af',
  slate: '#475569', slateText: '#1e293b', slateBg: '#f8fafc', slateBorder: '#cbd5e1', orange: '#ea580c',
  border: '#e5e7eb', cardBg: '#f9fafb',
  green: '#16a34a', greenBg: '#dcfce7', greenText: '#166534', greenSoft: '#f0fdf4', greenBorder: '#bbf7d0',
  red: '#dc2626', redBg: '#fef2f2', redText: '#991b1b', redBorder: '#fecaca',
  blueBg: '#eff6ff', blueBorder: '#bfdbfe', blueText: '#1e40af',
  violetBg: '#fdf4ff', violetBorder: '#e9d5ff', violetText: '#5b21b6',
  amberBg: '#fef3c7', amberText: '#92400e', amberBorder: '#fde68a',
  orangeBg: '#fff7ed', orangeText: '#9a3412', orangeBorder: '#fed7aa',
  codeBg: '#0f172a', codeText: '#e2e8f0', codeKey: '#cbd5e1', codeEmpty: '#64748b',
};

const TOTAL_STEPS = 21;   // 0 intro · 1-19 módulos · 20 completado
const CONTENT_STEPS = 19;
const THEORY_STEPS = new Set([0, 1, 4, 5, 8, 11, 12, 14, 15]); // lecturas / tarjetas → "Volver"

type MatchPair = { left: string; right: string };
type QuizQ = { q: string; opts: string[]; correct: number; explain: string };
type TFItem = { stmt: string; correct: boolean; explain: string };
type DragItem = { text: string; correct: 'vista' | 'tacto' };
type BuilderConfig = { xp: number; rows: { key: string; label: string; opts: string[] }[] };
type ExCard = { emoji: string; name: string; how: React.ReactNode; fact: string };

const pickN = <T,>(arr: T[], n: number): T[] => [...arr].sort(() => Math.random() - 0.5).slice(0, n);
const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);
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
const REFLECT_TERMS = ['robot', 'sensor', 'actuador', 'ia', 'robotica', 'humanoide', 'atlas', 'figure', 'tesla', 'drone', 'cirugia', 'espacio', 'marte', 'cuidado', 'mayores', 'trabajo', 'empleo', 'fabrica', 'mover', 'brazo', 'motor', 'camara', 'ciudad', 'aprender', 'refuerzo', 'simulacion', 'etica', 'autonomo', 'boston', 'spot', 'movimiento', 'maquina', 'tecnologia', 'futuro', 'entusiasma', 'preocupa', 'terminator', 'robotico'];
const containsTopic = (text: string): boolean => {
  const n = normalizeText(text);
  const words = n.split(/[^a-z0-9]+/).filter(Boolean);
  return REFLECT_TERMS.some((t) => (t.length <= 3 ? words.includes(t) : n.includes(t)));
};

// ── Pools (fuente: nivel-32.html) — distractores alargados (§15/27) ──
const MATCH_POOL: MatchPair[] = [
  { left: 'Cámara que detecta una taza en la mesa', right: 'Sensor: convierte luz en datos digitales para que la IA los procese' },
  { left: "Red neuronal que reconoce 'eso es una taza'", right: 'IA: procesa los datos del sensor y decide qué hacer' },
  { left: 'Motor que mueve el brazo robótico hacia la taza', right: 'Actuador: ejecuta físicamente la decisión de la IA' },
  { left: 'Sensor de presión en los dedos del robot', right: 'Sensor táctil: dice cuánta fuerza aplicar al agarrar' },
  { left: 'Algoritmo que decide la ruta esquivando obstáculos', right: 'IA de planificación: calcula trayectorias en tiempo real' },
  { left: 'Servomotores que generan el caminado bípedo', right: 'Actuadores: convierten señales eléctricas en movimiento físico' },
  { left: 'Lidar 360° para mapear el ambiente', right: 'Sensor avanzado: crea un mapa 3D del entorno' },
  { left: 'Modelo de visión que detecta una caída inminente', right: 'IA reactiva: ajusta el equilibrio en milisegundos' },
];

const PURPOSE_POOL: QuizQ[] = [
  { q: '¿Por qué los robots para fábricas suelen ser humanoides en vez de una forma optimizada?', opts: ['Porque las fábricas están diseñadas para humanos — un humanoide encaja sin rediseñar todo el espacio', 'Simplemente porque los robots con forma humana se ven mucho más modernos y atractivos', 'Porque construir un robot humanoide siempre resulta más barato que cualquier otra forma', 'Porque una ley internacional obliga a que todos los robots de fábrica sean humanoides'], correct: 0, explain: 'La inversión enorme en infraestructura humana ya existe. Un humanoide encaja en el mundo humano sin rediseñar nada.' },
  { q: 'Caso real donde el humanoide es claramente útil:', opts: ['En fábricas con tareas repetitivas peligrosas: BMW + Figure 02 ensamblando autos', 'En la superficie de la Luna, ayudando a los astronautas durante sus caminatas espaciales', 'En la cocina de los restaurantes, preparando platos gourmet de altísima complejidad', 'Dentro de los videojuegos, como personajes controlados por la inteligencia artificial'], correct: 0, explain: 'BMW Spartanburg desde 2024: Figure 02 hace inserción de pernos. Trabajo repetitivo + alta precisión = caso de uso ideal.' },
  { q: '¿En qué tipo de hospital ya hay robots asistiendo hoy?', opts: ['Quirófanos: el Da Vinci hace cirugías mínimamente invasivas con precisión sub-milimétrica', 'En ningún hospital todavía; los robots quirúrgicos siguen siendo pura ciencia ficción hoy', 'Solo en la cafetería del hospital, sirviendo café y comida a los pacientes y visitantes', 'Solo limpiando los pasillos y las habitaciones durante la noche cuando ya no hay gente'], correct: 0, explain: 'Da Vinci de Intuitive Surgical: 14M+ procedimientos desde 2000. Lo opera un cirujano humano, pero la precisión la da el robot.' },
  { q: '¿Qué robots están explorando otros planetas HOY?', opts: ['Perseverance (Marte desde 2021), Curiosity (Marte) e Ingenuity (helicóptero marciano hasta 2024)', 'Ninguno; ningún robot ha salido nunca del planeta Tierra hasta el día de hoy en la historia', 'Solo aparecen en las películas de cine; en la realidad no existe ninguno que esté explorando', 'Únicamente en la Luna, con las mismas máquinas que llegaron allí desde el año 1969'], correct: 0, explain: 'NASA tiene varios rovers exitosos en Marte. Perseverance toma muestras para una misión de retorno futura; Ingenuity voló 72 veces.' },
  { q: '¿Por qué Japón apuesta fuerte por robots de cuidado de mayores?', opts: ['Pirámide poblacional invertida — más mayores que jóvenes y una escasez crítica de cuidadores humanos', 'Por pura tradición cultural japonesa de fascinación histórica con los robots y la tecnología', 'Simplemente porque Japón fabrica la mejor tecnología del mundo y quiere presumirla siempre', 'Porque en Japón está de moda tener un robot en casa como si fuera una mascota más'], correct: 0, explain: 'Japón: 28% de mayores de 65 años. Sin suficientes cuidadores humanos, la única solución viable es tecnológica (PARO, Pepper, Lovot).' },
  { q: 'Limitación más grande de los robots humanoides actuales (2025-2026):', opts: ['La BATERÍA: 4-5 horas máximo. Las cargas largas limitan la operación continua durante el día', 'Que todavía no son lo suficientemente rápidos para moverse por una fábrica muy ocupada', 'El precio tan elevado, que hoy hace imposible que cualquier empresa del mundo pueda comprarlos', 'El idioma, porque los humanoides actuales solo entienden órdenes en un único idioma fijo'], correct: 0, explain: 'Operar 24/7 exige cambio de baterías o carga inalámbrica eficiente. Hoy lo común es 4-5h de operación + 1-2h de carga.' },
];

const RL_POOL: QuizQ[] = [
  { q: '¿Cómo aprende a caminar un robot bípedo?', opts: ["En simulación intenta millones de veces, recibe una 'recompensa' cuando avanza sin caer y se ajusta", 'Un ingeniero lo programa paso a paso, indicándole cada movimiento exacto de cada uno de sus motores', 'Mira miles de videos de personas caminando en internet y copia exactamente lo que ve en pantalla', 'Lee libros de anatomía y de física para entender de forma teórica cómo se debe caminar bien'], correct: 0, explain: 'Aprendizaje por refuerzo (RL): el robot prueba acciones, recibe feedback (éxito/fracaso) y ajusta su política. En simulación no se daña al fallar.' },
  { q: "¿Cuántos 'intentos' puede hacer un robot en simulación antes de probarse físicamente?", opts: ['Millones — equivalente a años de práctica humana comprimidos en horas o días reales de cómputo', 'Solo unas 10 veces, porque más intentos harían que el robot se dañe demasiado rápido y se rompa', 'Ninguno; los robots deben aprender directamente en el mundo real desde el primerísimo día', 'Una sola vez, ya que la inteligencia artificial aprende todo perfecto en su primer intento'], correct: 0, explain: 'La simulación es paralela y rápida. 1 hora de cómputo = años de "experiencia" humana. Por eso los avances son rápidos.' },
  { q: 'El término técnico para entrenar un robot en simulación antes del mundo real:', opts: ['Sim-to-real transfer (transferencia simulación-a-real): el reto es que la simulación NO es perfecta', "Se llama 'real-time processing', el procesamiento de todos los datos en tiempo real y sin retrasos", "Se llama 'cloud-only training', porque todo el entrenamiento del robot ocurre solo en la nube", "Se llama simplemente 'fase beta', como cuando un videojuego todavía está siendo probado"], correct: 0, explain: 'Sim-to-real es el problema técnico clave. La simulación nunca refleja perfectamente la realidad (fricción, materiales, viento).' },
  { q: '¿Qué pasó cuando se aplicó la tecnología de AlphaGo al movimiento físico?', opts: ["DeepMind aplicó la misma tecnología a manipulación robótica — surgió el 'Robot Foundation Model'", 'No pasó absolutamente nada; esa tecnología solo sirve para jugar al Go y para nada más en el mundo', 'Solo funcionó para el juego de Go y jamás pudo aplicarse a ningún tipo de movimiento físico', 'Falló por completo cuando lo intentaron aplicar al movimiento de un robot de verdad en la vida real'], correct: 0, explain: 'Robot Foundation Models: modelos pre-entrenados en MUCHAS tareas robóticas que generalizan a tareas nuevas (RT-2, Gemini Robotics, Π0).' },
  { q: 'Razón por la que entrenar un robot 100% en el mundo real es impráctico:', opts: ['Los robots se rompen, los humanos se cansan supervisando y necesitas espacios físicos enormes para iterar', 'Porque en realidad tiene un costo muy bajo y es la forma más fácil y rápida de entrenar que existe', 'Porque entrenar a un robot fuera de una simulación es completamente ilegal en casi todos los países', 'En realidad da exactamente igual entrenar en el mundo real que en una simulación por computadora'], correct: 0, explain: 'Imitación + simulación + RL = combo ganador. Solo el último 5-10% se entrena en el mundo real para refinar.' },
];

const ADVANCED_POOL: QuizQ[] = [
  { q: 'Robot humanoide que ya está en producción industrial real (BMW):', opts: ['Figure 02 desde 2024', 'Atlas', 'Robonaut', 'Pepper'], correct: 0, explain: 'Figure 02 + BMW Spartanburg = primer humanoide en una línea de ensamblaje automotriz a escala (producción real, no demo).' },
  { q: 'Empresas que más invierten en humanoides actualmente (sumando todo):', opts: ['Múltiples: Tesla (Optimus), Figure (con OpenAI), 1X, Apptronik, Sanctuary, Unitree — competencia masiva', 'Solamente la empresa Boston Dynamics; ninguna otra compañía en el mundo invierte en humanoides hoy', 'Únicamente Tesla con su robot Optimus; el resto de las empresas ya abandonaron el proyecto por completo', 'Solamente la empresa japonesa Honda, que sigue desarrollando a su antiguo robot humanoide Asimo'], correct: 0, explain: 'Boom 2024-2026: 10+ startups serias + Tesla + los chinos. Inversión total >$10B USD. Es el tema más caliente de la robótica.' },
  { q: 'Modelos de IA específicos para robótica que surgieron en 2024:', opts: ['RT-2 (Google), Gemini Robotics, Pi-0 y Helix (Figure) — modelos foundation para la acción física', 'No existe ningún modelo de IA hecho específicamente para robótica; todos son solo de texto', 'Solamente GPT-4, que es el único modelo capaz de controlar a un robot físico en movimiento', 'Únicamente Siri, el asistente de voz de Apple, que además también controla robots físicos'], correct: 0, explain: 'Robot Foundation Models: pre-entrenados en muchas tareas físicas, generalizan a nuevas. Análogos a los LLMs pero para el movimiento.' },
  { q: 'Tarea que hoy los humanoides hacen MEJOR que los humanos:', opts: ['Tareas repetitivas con precisión durante 4-5 horas continuas y sin cansarse ni aburrirse', 'Conversar de forma natural y espontánea sobre cualquier tema durante varias horas seguidas', 'Crear obras de arte originales y emocionantes que conmuevan de verdad a las personas', 'Sentir y expresar emociones humanas auténticas como la alegría, la tristeza o el miedo'], correct: 0, explain: 'Resistencia y consistencia. Donde un humano se cansa o se aburre tras 2 horas, un humanoide mantiene la precisión hasta agotar la batería.' },
  { q: 'Tarea que hoy los humanoides hacen PEOR que los humanos:', opts: ['Manipulación fina y delicada (por ejemplo: pelar fruta, atar cordones, doblar la ropa)', 'Levantar objetos muy pesados y transportarlos de un lugar a otro sin ningún tipo de esfuerzo', 'Caminar largas distancias por terrenos planos y regulares durante varias horas seguidas', 'Cargar su propia batería conectándose solos a una toma de corriente cuando se les agota'], correct: 0, explain: 'La manipulación delicada con feedback táctil sutil sigue siendo difícil. Por eso dominan tareas industriales repetitivas más que las domésticas variables.' },
];

const ETHICS_POOL: TFItem[] = [
  { stmt: 'Si un robot autónomo causa un accidente, el responsable legal está claramente definido en todos los países', correct: false, explain: 'La responsabilidad legal sigue siendo una zona gris: ¿fabricante? ¿programador? ¿usuario? Las leyes apenas se están escribiendo.' },
  { stmt: 'Las 3 leyes de la robótica de Asimov son ficción literaria, no un marco legal real en ningún país', correct: true, explain: 'Son de una novela de ciencia ficción. La robótica real necesita una regulación específica que apenas se está construyendo.' },
  { stmt: 'Los robots militares autónomos letales (LAWS) ya existen y se debaten en la ONU', correct: true, explain: 'La ONU debate prohibir los Lethal Autonomous Weapons Systems. Ya existen drones autónomos en uso militar (Turquía, Rusia, EE.UU., Israel).' },
  { stmt: 'Un robot que monitorea a adultos mayores debería alertar SIEMPRE a los familiares de cualquier comportamiento inusual', correct: false, explain: 'La privacidad del mayor también importa. Lo correcto es matizado: emergencias → familia; comportamiento normal → privado del usuario.' },
  { stmt: 'Es ético usar robots para reemplazar a trabajadores humanos en tareas peligrosas', correct: true, explain: 'Generalmente aceptado. Reducir lesiones y muertes en minería, demolición o residuos peligrosos = bien social.' },
  { stmt: 'Para ser útiles, los humanoides domésticos necesitan algo de contexto privado — la clave es CÓMO se maneja, no prohibirlo del todo', correct: true, explain: "La pregunta correcta no es 'si' sino 'cómo': qué se almacena, dónde, quién accede y cómo se borra." },
  { stmt: "Los robots pueden tomar decisiones de fin de vida en hospitales para evitar los 'sesgos humanos'", correct: false, explain: 'Las decisiones bioéticas profundas requieren juicio humano. Los robots ASISTEN con datos; los humanos DECIDEN.' },
  { stmt: 'Los sistemas militares autónomos son más éticos que los soldados humanos porque no sienten miedo ni ira', correct: false, explain: 'Posición muy controvertida. Las máquinas no tienen empatía ni juicio moral profundo. La ICRC y la ONU defienden el control humano.' },
];

// Drag arreglado (§23): el HTML tenía columnas Vista/Tacto pero el pool incluía
// audio/equilibrio/temperatura sin columna → imposible de completar. Aquí solo van
// sensores de las 2 columnas reales.
const SENSORS_POOL: DragItem[] = [
  { text: 'Cámaras estéreo (2 o más ángulos)', correct: 'vista' },
  { text: 'Lidar (rayos láser que miden distancias)', correct: 'vista' },
  { text: 'Sensor de profundidad (RGB-D)', correct: 'vista' },
  { text: 'Sensor ultrasónico de proximidad', correct: 'vista' },
  { text: 'Cámara infrarroja para visión nocturna', correct: 'vista' },
  { text: 'Sensores piezoeléctricos en los dedos', correct: 'tacto' },
  { text: 'Galgas extensiométricas (force sensors)', correct: 'tacto' },
  { text: 'Sensor de presión en la palma', correct: 'tacto' },
  { text: 'Sensor de torque en las articulaciones', correct: 'tacto' },
];

const BUILDER_CITY: BuilderConfig = { xp: 22, rows: [
  { key: 'problema', label: 'Problema urbano que resuelve', opts: ['Recoger basura en calles peatonales sin contaminación sonora', 'Reparto en zonas con mucho tráfico (el humano se demora horas)', 'Vigilar calles inseguras de noche con sensores que detectan crisis', 'Riego automático y mantenimiento de parques urbanos', 'Inspección de infraestructura (puentes, túneles, alcantarillas)'] },
  { key: 'forma', label: 'Forma física', opts: ['Cuadrúpedo tipo Spot (ágil en escaleras y terreno irregular)', 'Vehículo rodante (rápido en calles planas)', 'Drone aéreo (sin tráfico, vista superior)', 'Bípedo humanoide (encaja en infraestructura humana)', 'Híbrido rodante-volador para más versatilidad'] },
  { key: 'sensor', label: 'Sensor más crítico', opts: ['Cámaras estéreo + Lidar para navegación robusta', 'Sensores químicos + olfativos (gases, contaminantes)', 'Micrófonos direccionales (detección de gritos, alarmas)', 'Sensores ambientales (calidad del aire, temperatura, humedad)', 'GPS + comunicación 5G para coordinarse con otros robots'] },
  { key: 'operacion', label: 'Modelo de operación', opts: ['24/7 con relevo de baterías en estaciones de carga', 'Por turnos (mañana/tarde) con recarga nocturna', 'Por demanda (responde a llamadas/alertas y descansa)', 'En enjambre — múltiples unidades coordinadas'] },
] };

const tagVariants = {
  intro: { box: { backgroundColor: P.slateBg }, text: { color: P.slateText } },
  theory: { box: { backgroundColor: P.greenSoft }, text: { color: P.greenText } },
  activity: { box: { backgroundColor: P.blueBg }, text: { color: P.blueText } },
  build: { box: { backgroundColor: P.slateBg }, text: { color: P.slateText } },
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
  4: {
    icon: '🐕', label: 'Módulo 4 de 19 · Boston Dynamics', title: 'Boston Dynamics · Spot, Atlas, Stretch', sub: 'El líder histórico. 4 casos para entender qué hacen sus robots reales. Toca cada tarjeta 👆',
    cards: [
      { emoji: '🐕', name: 'Spot · El perro robot', how: <>Spot pesa 32 kg y puede <B>caminar 1.6 m/s, subir escaleras, abrir puertas y cargar 14 kg</B>. Lo usan en inspecciones industriales, minas, vigilancia y rescate. Cuesta ~$75,000 USD. Hay miles trabajando desde 2020.</>, fact: '⭐ La NYPD lo usó en 2021 (con polémica). Plantas químicas y nucleares lo usan donde sería peligroso enviar humanos. Ya es producto comercial.' },
      { emoji: '🤸', name: 'Atlas · El humanoide acrobático', how: <>Famoso por sus videos saltando, haciendo parkour y backflips. <B>1.5m, 89 kg, 28 grados de libertad</B>. En 2024 presentó la versión eléctrica que reemplaza la hidráulica.</>, fact: '⭐ Atlas NO es un producto comercial aún — es una plataforma de investigación. Sus capacidades de hace 5 años son las que veremos en producción en 5-10 años.' },
      { emoji: '🏭', name: 'Stretch · El robot de bodegas', how: <>El menos conocido de Boston Dynamics, pero el <B>más rentable comercialmente</B>. Especializado en descargar contenedores y mover cajas. Brazo modular, base estable.</>, fact: '⭐ Diseñado para trabajos repetitivos y pesados. DHL, GAP y otras grandes ya lo despliegan. El robot "aburrido" es el que gana dinero.' },
      { emoji: '🎯', name: 'El método de entrenamiento', how: <>Boston Dynamics combina <B>simulación masiva + refuerzo + ajuste humano</B>. Antes de hacer parkour real, Atlas entrena en simulación el equivalente a años de práctica, fallando millones de veces sin daño.</>, fact: '⭐ Los robots ya no se programan paso a paso: aprenden imitando + experimentando en simulación. Igual que los LLMs, pero para el movimiento físico.' },
    ],
  },
  5: {
    icon: '🤖', label: 'Módulo 5 de 19 · Humanoides', title: 'Humanoides 2024-2026 · Figure, Tesla, 1X, Unitree', sub: 'La carrera más caliente. 4 humanoides reales con apuestas distintas. Toca cada tarjeta 👆',
    cards: [
      { emoji: '🤖', name: 'Figure 02 · El humanoide industrial', how: <>Startup de 2022 valuada en $2.6B. <B>Figure 02 (ago 2024)</B>: 1.65m, 70 kg, 5h de batería, conectado a GPT-4 para entender comandos en lenguaje natural. <B>BMW ya lo usa en su línea de ensamblaje</B> en Spartanburg.</>, fact: '⭐ Primer humanoide en una planta automotriz seria. Inversión de OpenAI, Microsoft y Bezos. Apuesta clara por el mainstream en 5 años.' },
      { emoji: '🔋', name: 'Tesla Optimus (Bot)', how: <>Anunciado en 2021; en <B>octubre 2024</B> hizo un demo público junto al Cybercab. Elon afirma producción masiva en 2026 a ~$25,000 USD. Crítica: muchos demos fueron <B>teleoperados</B>, no autónomos.</>, fact: '⭐ Tesla tiene historial de fechas optimistas, pero domina la manufactura a escala como nadie. Si llega a $25K masivo, redefine el sector.' },
      { emoji: '🌏', name: 'Unitree H1 (China)', how: <>Unitree, empresa china, lanzó el H1 en 2023 — <B>un humanoide bípedo a $90,000 USD</B>, más barato que el Atlas eléctrico (~$200K). Prioriza accesibilidad sobre prestaciones máximas.</>, fact: '⭐ China apuesta fuerte: BYD, Xiaomi y Huawei tienen proyectos de humanoides. La carrera no es solo de EE.UU.' },
      { emoji: '🇳🇴', name: '1X Technologies (Noruega) · NEO', how: <>1X es una startup noruega respaldada por OpenAI. Su robot <B>NEO está diseñado para HOGARES</B>: tareas domésticas, conversación natural, gestos suaves. Foco en el consumidor, no en la industria.</>, fact: '⭐ Apuesta opuesta a Figure (industrial) y Boston Dynamics (investigación): el robot doméstico amigable para adopción masiva en hogares.' },
    ],
  },
  8: {
    icon: '🩺', label: 'Módulo 8 de 19 · Cirugía', title: 'Cirugía robótica · Da Vinci', sub: 'El robot quirúrgico más usado del mundo. Cómo funciona y dónde está en LATAM. Toca cada tarjeta 👆',
    cards: [
      { emoji: '🩺', name: 'Da Vinci · El cirujano robótico', how: <>Sistema Da Vinci de Intuitive Surgical: <B>brazos robóticos controlados por el cirujano</B> desde una consola. Precisión sub-milimétrica, sin temblor humano, vista 3D HD. <B>14M+ cirugías</B> realizadas.</>, fact: '⭐ Cuesta $2M USD. NO es autónomo — es una extensión del cirujano. Efectos: menos sangrado, menos cicatriz, recuperación más rápida.' },
      { emoji: '🇨🇴', name: 'Da Vinci en Colombia', how: <>Hospitales como la <B>Fundación Santa Fe (Bogotá), la Clínica Imbanaco (Cali) y CES (Medellín)</B> tienen Da Vinci. La capacitación de los cirujanos toma 6+ meses.</>, fact: '⭐ El equipo solo se justifica con un volumen alto de cirugías. Por eso está en hospitales de referencia con mucho flujo, no en ciudades pequeñas.' },
      { emoji: '🤖', name: 'El siguiente paso: cirugía autónoma', how: <>Investigación activa: <B>robots que toman decisiones quirúrgicas autónomas en partes específicas</B>. STAR demostró suturas más uniformes que las humanas. Aún en fase experimental.</>, fact: '⭐ Bioética compleja: ¿quién responde si una IA quirúrgica causa un daño? Las regulaciones de la FDA se redefinen constantemente.' },
    ],
  },
  11: {
    icon: '🚀', label: 'Módulo 11 de 19 · Espacio', title: 'Robots en el espacio · Marte y la EEI', sub: 'Perseverance, Ingenuity, Robonaut. Lo que ya hacemos lejos de la Tierra. Toca cada tarjeta 👆',
    cards: [
      { emoji: '🚀', name: 'Perseverance · El rover científico', how: <>Aterrizó en Marte el <B>18 de febrero de 2021</B>. Recolecta muestras de roca para una misión de retorno futura. Tiene 23 cámaras, espectrómetros y taladros. Pesa 1,025 kg.</>, fact: '⭐ Primer rover en producir oxígeno en Marte (experimento MOXIE). Cada decisión considera el retraso de comunicación con la Tierra: 5-20 minutos.' },
      { emoji: '🚁', name: 'Ingenuity · El primer helicóptero marciano', how: <>Mini-helicóptero de 1.8 kg que voló 72 veces en Marte entre <B>2021 y enero de 2024</B>. Demostró que el vuelo controlado en otros planetas es posible. La atmósfera marciana es 1% de la terrestre.</>, fact: '⭐ Su última misión terminó con las palas dañadas, pero abrió la puerta a futuras misiones con drones: Dragonfly (Titán, lanzamiento en 2027) será el siguiente.' },
      { emoji: '🤖', name: 'Robonaut 2 · El primer humanoide en el espacio', how: <>NASA + GM construyeron Robonaut 2: <B>primer humanoide en la Estación Espacial Internacional (2011-2018)</B>. Demostró que los humanoides pueden trabajar en gravedad cero asistiendo a los astronautas.</>, fact: '⭐ Desafío único del espacio: radiación dañina para la electrónica y mantenimiento imposible. Los robots espaciales necesitan un diseño robusto y redundante.' },
    ],
  },
  12: {
    icon: '👵', label: 'Módulo 12 de 19 · Cuidado de mayores', title: 'Robots que cuidan a personas mayores', sub: 'Japón lidera. Tres categorías: físicos, sociales y monitoreo. Toca cada tarjeta 👆',
    cards: [
      { emoji: '🇯🇵', name: 'Japón · Pionero de robots de cuidado', how: <>Japón invierte $1B+/año en robots para mayores. Tres categorías: <B>físicos (exoesqueleto HAL), sociales (Pepper, PARO) y monitoreo (sensores en casa)</B>. Más de 5,000 residencias los usan.</>, fact: '⭐ PARO: robot foca terapéutico, aprobado como dispositivo médico en EE.UU. Reduce la ansiedad en pacientes con demencia. Cuesta $6,000 USD.' },
      { emoji: '🦾', name: 'Exoesqueletos para cuidadores', how: <>La otra cara: ayudar a los humanos a cuidar mejor. <B>Exoesqueletos como el Innophys Muscle Suit reducen el esfuerzo físico</B> del cuidador al levantar pacientes. Ya en hospitales de Japón, EE.UU. y Alemania.</>, fact: '⭐ Cuidar a un mayor en EE.UU. cuesta $50,000+/año. Si un exoesqueleto evita una lesión de espalda del cuidador (muy común), se paga en meses.' },
      { emoji: '💬', name: 'Compañía y monitoreo · ElliQ', how: <>ElliQ (Israel) y Joy for All (EE.UU.) son <B>compañeros de IA conversacional</B> para mayores que viven solos. Recuerdan medicaciones, conversan y llaman a la familia. No son humanoides — solo voz + pantalla.</>, fact: '⭐ Crítica: ¿reemplazan las visitas humanas? Riesgo de aislamiento disfrazado de "compañía". Bien diseñados, complementan; mal diseñados, sustituyen.' },
    ],
  },
  14: {
    icon: '📦', label: 'Módulo 14 de 19 · Drones', title: 'Drones · Delivery, agricultura, rescate', sub: 'Robots voladores ya operando en producción. 3 casos de uso reales. Toca cada tarjeta 👆',
    cards: [
      { emoji: '📦', name: 'Delivery: Wing (Google) y Amazon', how: <>Wing opera en Australia, Texas y Virginia desde 2019. <B>Drones autónomos entregan paquetes de menos de 1.5 kg en 6-8 minutos</B>. Amazon Prime Air fue aprobado por la FAA en 2024 para Texas y California.</>, fact: '⭐ El delivery por dron NO reemplaza a UPS — gana en farmacia urgente, comida caliente y zonas rurales sin acceso vehicular fácil.' },
      { emoji: '🌾', name: 'Agricultura · DJI Agras', how: <>El DJI Agras es un <B>tractor del aire</B>: rocía pesticidas, fertilizantes y semillas. Cubre 16 hectáreas/hora frente a 1-2 de un humano. Reduce un 30% el uso de químicos por su aplicación precisa.</>, fact: '⭐ Ya en uso masivo en China, Brasil, Argentina y Colombia. Los productores de café y palma en Latinoamérica son adoptantes tempranos.' },
      { emoji: '🚁', name: 'Rescate · Drones térmicos', how: <>Bomberos en California, España y Australia usan drones con <B>cámaras térmicas para encontrar personas en incendios forestales</B>. Reducen las búsquedas de horas a minutos.</>, fact: '⭐ Caso emblemático: un dron DJI Mavic 3T detectó a una persona viva entre los escombros tras los incendios de Maui (2023) y envió su posición GPS a los equipos terrestres.' },
    ],
  },
  15: {
    icon: '🌊', label: 'Módulo 15 de 19 · Submarinos', title: 'Robots bajo el agua · Exploración y limpieza', sub: 'Saildrone, arqueología, limpieza oceánica. Donde los humanos no pueden. Toca cada tarjeta 👆',
    cards: [
      { emoji: '🐬', name: 'Saildrone · Vela autónoma', how: <>Drones de superficie del tamaño de un kayak. <B>Recorren océanos durante meses sin tripulación</B>, alimentados por energía solar + viento. Recopilan datos: temperatura, salinidad, vida marina, CO₂.</>, fact: '⭐ Un Saildrone navegó dentro de un huracán categoría 4 en 2021, enviando datos en tiempo real que ningún barco tripulado podría obtener y sobrevivir.' },
      { emoji: '🤖', name: 'Robots submarinos para arqueología', how: <>Hércules y Argos descubrieron el <B>USS Indianapolis y los restos del Endurance de Shackleton (2022, a 3 km bajo el hielo antártico)</B>. Trabajan donde los humanos morirían.</>, fact: '⭐ Tienen brazos robóticos articulados para recoger muestras delicadas sin dañarlas. Cada misión de exploración cuesta $5-10M USD pero produce ciencia única.' },
      { emoji: '🌊', name: 'Limpieza oceánica · The Ocean Cleanup', how: <>El Sistema 003 (2024): <B>barreras autónomas asistidas por drones</B> que detectan y recolectan plástico oceánico. Han limpiado 13M kg del Pacific Gyre desde 2019.</>, fact: '⭐ La IA optimiza las rutas según corrientes, viento y densidad de plástico detectada por satélite. Es 10x más eficiente que la limpieza manual.' },
    ],
  },
};

const REFLECTIONS: { [k: number]: { tag: string; icon: string; question: React.ReactNode; placeholder: string; min: number; xp: number } } = {
  2: { tag: 'Tu intuición · +14 XP', icon: '🤔', min: 80, xp: 14, placeholder: 'Cuando pienso en robot, imagino... y siento...', question: <>Antes de los detalles técnicos: <B>¿qué imagen te viene a la cabeza cuando piensas en 'robot'? ¿Terminator, R2-D2, una aspiradora Roomba, o algo distinto? ¿Qué SIENTES — entusiasmo, miedo, indiferencia?</B> Sé honesto antes de procesar todos los datos del nivel.</> },
  7: { tag: 'Robots y trabajo · +16 XP', icon: '💼', min: 120, xp: 16, placeholder: 'Creo que destruirán / crearán más empleos porque... Los trabajos que sobrevivirán serán...', question: <>Cuando llegan robots a una industria pasan dos cosas a la vez: <B>se eliminan trabajos específicos Y se crean otros nuevos</B> (mantenimiento, programación, supervisión). Pero la velocidad esta vez es diferente. <B>¿Crees que los robots destruirán más empleos de los que crearán, o al revés? ¿Qué trabajos sobrevivirán más y por qué?</B></> },
  19: { tag: 'Tu visión de robótica · +22 XP', icon: '✍️', min: 150, xp: 22, placeholder: 'Lo que más me entusiasma: ... Lo que me preocupa con razón: ... El robot que introduciría es...', question: <>Después de explorar robots reales (Atlas, Figure 02, Optimus), sus aplicaciones (cirugía, espacio, cuidado) y sus dilemas éticos: <B>¿cómo cambió tu visión sobre los robots? ¿Qué te entusiasma genuinamente? ¿Qué te preocupa con razón? Si pudieras introducir UN tipo de robot en tu ciudad mañana, ¿cuál sería y por qué?</B></> },
};

// ═══════════════════════════════════════════════════════════
export default function World6Level2() {
  const completeLevel = useGameStore((s) => s.completeLevel);

  const [step, setStep] = useState(0);
  useReportProgress(step, TOTAL_STEPS);
  const [xp, setXp] = useState(0);
  const [xpToast, setXpToast] = useState<{ amount: number; id: number } | null>(null);
  const awarded = useRef<Set<number>>(new Set());

  const matchPairs = useRef(pickN(MATCH_POOL, 5)).current;
  const rightOrder = useRef(shuffle(matchPairs.map((p) => p.right))).current;
  const purposeQ = useRef(pickN(PURPOSE_POOL, 5).map(shuffleOpts)).current;
  const rlQ = useRef(pickN(RL_POOL, 5).map(shuffleOpts)).current;
  const advancedQ = useRef(pickN(ADVANCED_POOL, 5).map(shuffleOpts)).current;
  const ethicsQ = useRef(pickN(ETHICS_POOL, 5)).current;
  const sensorsItems = useRef(pickN(SENSORS_POOL, 8)).current;

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

  // Drag
  const [dragPlaced, setDragPlaced] = useState<{ [k: number]: 'vista' | 'tacto' }>({});
  const [dragSel, setDragSel] = useState<number | null>(null);
  const [dragSolved, setDragSolved] = useState(false);
  const [dragFb, setDragFb] = useState<{ ok: boolean; msg: string } | null>(null);
  const [dragFlash, setDragFlash] = useState<Set<number>>(new Set());
  const dragAttempts = useRef(0);

  // Builder
  const [builderState, setBuilderState] = useState<{ [k: string]: string }>({});

  // Compare
  const [compareSel, setCompareSel] = useState<'a' | 'b' | null>(null);
  const [compareChecked, setCompareChecked] = useState(false);

  // Ejemplos (expandibles)
  const [expandedEx, setExpandedEx] = useState<number | null>(null);

  const isTheory = THEORY_STEPS.has(step);
  const currentReflection = REFLECTIONS[step];
  const currentExample = EXAMPLES[step];
  const currentQuiz = step === 6 ? purposeQ : step === 9 ? rlQ : step === 13 ? advancedQ : null;

  useEffect(() => {
    setReflectText(''); setReflectFb(null);
    setMatchSel(null); setMatchedLeft(new Set()); setMatchedRight(new Set()); setMatchWrong(null); setMatchFb(null);
    setQuizAnswers({}); setQuizChecked(false);
    setTfAnswers({}); setTfChecked(false);
    setDragPlaced({}); setDragSel(null); setDragSolved(false); setDragFb(null); setDragFlash(new Set()); dragAttempts.current = 0;
    setBuilderState({});
    setCompareSel(null); setCompareChecked(false);
    setExpandedEx(null);
  }, [step]);

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
  const checkTF = () => { setTfChecked(true); let c = 0; ethicsQ.forEach((it, i) => { if (tfAnswers[i] === it.correct) c++; }); awardOnce(c * 5); };

  // Drag
  const placeDrag = (zone: 'vista' | 'tacto') => { if (dragSel === null || dragSolved) return; setDragPlaced((prev) => ({ ...prev, [dragSel]: zone })); setDragSel(null); setDragFb(null); };
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

  // Builder
  const builderComplete = (cfg: BuilderConfig) => cfg.rows.every((r) => builderState[r.key]);

  // Compare (B es el correcto: los foundation models generalizan al mundo desordenado)
  const checkCompare = () => { if (compareSel === null) return; setCompareChecked(true); if (compareSel === 'b') awardOnce(12); };

  const sendReflection = (): boolean => {
    if (!currentReflection) return false;
    const t = reflectText.trim();
    if (t.length < currentReflection.min) { setReflectFb(`Escribe al menos ${currentReflection.min} caracteres (llevas ${t.length}).`); return false; }
    if (looksRandom(t)) { setReflectFb('Parece texto al azar. Escribe una idea real con tus propias palabras.'); return false; }
    if (!containsTopic(t)) { setReflectFb('Conéctalo con el tema: robots, robótica, lo que sientes o el robot que introducirías.'); return false; }
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
      case 10: return dragSolved ? { label: 'Continuar →', enabled: true, onPress: advance } : { label: 'Verificar clasificación', enabled: Object.keys(dragPlaced).length > 0, onPress: checkDrag, accent: true };
      case 16: return compareChecked ? { label: 'Continuar →', enabled: true, onPress: advance } : { label: 'Ver explicación', enabled: compareSel !== null, onPress: checkCompare, accent: true };
      case 17: return tfChecked ? { label: 'Continuar →', enabled: true, onPress: advance } : { label: 'Comprobar', enabled: Object.keys(tfAnswers).length === ethicsQ.length, onPress: checkTF, accent: true };
      case 18: return { label: 'Terminar →', enabled: builderComplete(BUILDER_CITY), onPress: () => { awardOnce(BUILDER_CITY.xp); advance(); } };
      default: return { label: 'Continuar →', enabled: true, onPress: advance };
    }
  };

  const finishLevel = () => {
    const stars = xp >= 190 ? 3 : xp >= 120 ? 2 : 1; // máx real ~266 XP
    completeLevel(32, stars, xp);
    router.replace('/level/33');
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
      return step === 6 ? renderQuiz(purposeQ, 'Módulo 6 de 19 · Quiz', '¿Para qué sirve un humanoide?', '5 preguntas sobre aplicaciones reales y limitaciones honestas.')
        : step === 9 ? renderQuiz(rlQ, 'Módulo 9 de 19 · Quiz', 'Aprendizaje por refuerzo: cómo aprenden a moverse', '5 preguntas sobre cómo Atlas aprendió parkour y por qué importa la simulación.')
        : renderQuiz(advancedQ, 'Módulo 13 de 19 · Quiz', 'El estado del arte en 2025-2026', '5 preguntas sobre quién lidera, qué pueden y qué no pueden hacer aún.');
    }
    switch (step) {
      case 0: return (
        <View>
          <View style={styles.introIcon}><Text style={{ fontSize: 34 }}>🦾</Text></View>
          <Tag icon="✨" label="Nivel 32 · Mundo 6" variant="intro" />
          <Title>Robótica e IA: El Cuerpo de la IA</Title>
          <Sub>Si N31 exploró la mente que piensa sola, N32 explora el cuerpo que se mueve solo. La IA tiene cerebro; la robótica le da cuerpo. Y eso cambia TODO: fábricas, hogares, hospitales, exploración espacial.</Sub>
          <View style={[styles.card, styles.cardAccent]}><Text style={styles.cardTitle}>📚  Qué vas a aprender</Text><Text style={styles.cardText}>Ciclo Sensor → IA → Actuador · Boston Dynamics, Figure, Tesla Bot · Aprendizaje por refuerzo · Cirugía robótica · Robots espaciales · Cuidado de mayores · Drones y submarinos</Text></View>
          <View style={[styles.card, styles.cardGreen]}><Text style={styles.cardTitle}>⚡  Qué podrás HACER al terminar</Text><Text style={styles.cardText}>Tener una visión clara del estado real de la robótica 2025-2026, distinguir lo que ya existe de la ciencia ficción, y formar tu opinión informada sobre el futuro inmediato.</Text></View>
          <View style={[styles.card, styles.cardYellow]}><Text style={styles.cardTitle}>🎮  19 módulos · 45-60 min · hasta 230 XP</Text><Text style={styles.cardText}>📖 Teoría · 🤔 Reflexión · 🔗 Sensor-IA-Actuador · 🐕 Boston Dynamics · 🤖 Humanoides · ❓ Para qué sirven · 💼 Robots y trabajo · 🩺 Da Vinci · 🧠 Refuerzo · 👁️ Sensores · 🚀 Espacio · 👵 Cuidado · ❓ Avanzados · 📦 Drones · 🌊 Submarinos · 🆚 Compare · ✅ V/F ética · 🏙️ Builder · ✍️ Visión final</Text></View>
        </View>
      );
      case 1: return (
        <View>
          <Tag icon="📖" label="Módulo 1 de 19 · Teoría" variant="theory" />
          <Title>El cuerpo de la IA</Title>
          <Body>La IA tiene cerebro; la robótica le da <B>cuerpo</B>. Y eso cambia todo. Una IA en la nube responde preguntas. Un robot con esa misma IA puede <B>caminar</B>, <B>levantar cosas</B>, <B>operar en cirugía</B> o <B>explorar Marte</B>.</Body>
          <View style={styles.highlightBox}><Text style={styles.highlightText}>💡 <B>El ciclo básico de toda robótica:</B>{'\n\n'}<B>1. SENSOR</B> capta datos del ambiente (cámara, micrófono, presión).{'\n'}<B>2. IA</B> procesa y decide qué hacer.{'\n'}<B>3. ACTUADOR</B> ejecuta la decisión físicamente (motor, garra, rueda).</Text></View>
          <Body>Lo que cambió en 2024-2026: los robots ya no se programan paso a paso. <B>Aprenden</B> en simulación, generalizan y se adaptan. Foundation Models como RT-2, Gemini Robotics y Pi-0 permiten que un robot aprenda una tarea nueva sin código nuevo, solo con ejemplos.</Body>
          <Text style={styles.sectionTitle}>🤖 Las 4 categorías de robots reales hoy</Text>
          {[['1', 'Industriales:', ' Stretch y Figure 02 ensamblan en BMW desde 2024.'], ['2', 'Quirúrgicos:', ' Da Vinci ha hecho 14M+ cirugías reales.'], ['3', 'Espaciales:', ' Perseverance e Ingenuity exploran Marte hoy.'], ['4', 'Domésticos/cuidado:', ' NEO de 1X, PARO en Japón, la próxima ola.']].map(([n, t, d]) => (
            <View key={n} style={styles.stepLi}><View style={styles.stepNum}><Text style={styles.stepNumText}>{n}</Text></View><Text style={styles.stepLiText}><B>{t}</B>{d}</Text></View>
          ))}
          <View style={styles.tipBox}><Text style={styles.tipText}>✅ <B>Verdad operativa:</B> los robots que dominan en 2026 son los que hacen tareas <B>repetitivas y precisas</B> donde el humano se cansa. La manipulación delicada y variada sigue siendo difícil.</Text></View>
        </View>
      );
      case 3: return (
        <View>
          <Tag icon="🔗" label="Módulo 3 de 19 · Matching" variant="activity" />
          <Title>El ciclo Sensor → IA → Actuador</Title>
          <Sub>Cada componente tiene un rol específico. Conéctalo correctamente: toca un componente y luego su función.</Sub>
          <View style={styles.matchHeaderRow}><Text style={styles.matchColLabel}>Componente</Text><Text style={styles.matchColLabel}>Función</Text></View>
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
      case 10: {
        const zones: { k: 'vista' | 'tacto'; label: string }[] = [
          { k: 'vista', label: '👁️ Vista / distancia' },
          { k: 'tacto', label: '👆 Tacto / fuerza' },
        ];
        return (
          <View>
            <Tag icon="🧩" label="Módulo 10 de 19 · Clasificar" variant="activity" />
            <Title>Los sentidos del robot</Title>
            <Sub>8 sensores reales. Clasifícalos según qué tipo de información captan. Toca un chip y luego su columna.</Sub>
            <View style={styles.chipsPool}>
              {sensorsItems.map((it, i) => dragPlaced[i] === undefined && (
                <TouchableOpacity key={i} disabled={dragSolved} style={[styles.chip, dragSel === i && styles.chipSel, dragFlash.has(i) && styles.chipFlash]} onPress={() => setDragSel(dragSel === i ? null : i)}>
                  <Text style={[styles.chipText, dragSel === i && { color: P.slateText }]}>{it.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.dropCols}>
              {zones.map((z) => {
                const placedHere = Object.keys(dragPlaced).map(Number).filter((k) => dragPlaced[k] === z.k);
                const hasItem = placedHere.length > 0;
                const zStyle = z.k === 'vista' ? styles.zoneVista : styles.zoneTacto;
                const zColor = z.k === 'vista' ? P.blueText : P.amberText;
                return (
                  <TouchableOpacity key={z.k} activeOpacity={0.9} disabled={dragSel === null || dragSolved} style={[styles.dropCol, hasItem && zStyle]} onPress={() => placeDrag(z.k)}>
                    <View style={[styles.dropHeader, z.k === 'vista' ? styles.dropHeaderVista : styles.dropHeaderTacto]}><Text style={[styles.dropHeaderText, { color: zColor }]}>{z.label}</Text></View>
                    <View style={styles.dropArea}>
                      {placedHere.map((k) => (
                        <TouchableOpacity key={k} disabled={dragSolved} onPress={() => removeDrag(k)} style={[styles.dropChip, z.k === 'vista' ? styles.dropChipVista : styles.dropChipTacto]}>
                          <Text style={[styles.dropChipText, { color: zColor }]}>{sensorsItems[k].text}  ✕</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            {dragFb && <View style={[styles.fb, dragFb.ok ? styles.fbOk : styles.fbBad]}><Text style={dragFb.ok ? styles.fbOkText : styles.fbBadText}>{dragFb.msg}</Text></View>}
          </View>
        );
      }
      case 16: return (
        <View>
          <Tag icon="🆚" label="Módulo 16 de 19 · Compara robots" variant="quiz" />
          <Title>Robot programado vs robot que aprende</Title>
          <View style={styles.scenarioBox}><Text style={styles.scenarioLabel}>MISMO DESAFÍO</Text><Text style={styles.scenarioText}>El robot debe limpiar una casa con muebles desordenados. Dos enfoques:</Text></View>
          <TouchableOpacity activeOpacity={0.9} disabled={compareChecked} style={[styles.compareCard, compareSel === 'a' && !compareChecked && styles.compareSel, compareChecked && styles.compareCardDim]} onPress={() => setCompareSel('a')}>
            <Text style={styles.compareLabel}>🔧 ROBOT TRADICIONAL (programación rígida)</Text>
            <Text style={styles.compareText}>"Tiene un mapa pre-programado de la casa. Si encuentra algo nuevo, se detiene y pide ayuda. Si los muebles cambiaron, falla. Funciona PERFECTO en un escenario controlado, pero MAL en el mundo real."</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.9} disabled={compareChecked} style={[styles.compareCard, compareSel === 'b' && !compareChecked && styles.compareSel, compareChecked && styles.compareCardOk]} onPress={() => setCompareSel('b')}>
            <Text style={styles.compareLabel}>🧠 ROBOT MODERNO (IA + foundation model)</Text>
            <Text style={styles.compareText}>"Tiene visión + razonamiento. Ve un sillón donde no estaba, lo identifica y ajusta su ruta sin ayuda humana. Aprende de cada limpieza. Funciona en cualquier casa sin reprogramar."</Text>
          </TouchableOpacity>
          <Text style={styles.compareQ}>¿Cuál enfoque domina en 2025-2026 y por qué?</Text>
          <View style={styles.compareBtns}>
            <TouchableOpacity disabled={compareChecked} style={[styles.compareBtn, compareSel === 'a' && !compareChecked && styles.compareBtnSel]} onPress={() => setCompareSel('a')}><Text style={styles.compareBtnText}>Tradicional</Text></TouchableOpacity>
            <TouchableOpacity disabled={compareChecked} style={[styles.compareBtn, compareSel === 'b' && !compareChecked && styles.compareBtnSel]} onPress={() => setCompareSel('b')}><Text style={styles.compareBtnText}>Moderno</Text></TouchableOpacity>
          </View>
          {compareChecked && (
            <View style={[styles.fb, compareSel === 'b' ? styles.fbOk : styles.fbBad]}>
              <Text style={compareSel === 'b' ? styles.fbOkText : styles.fbBadText}>{compareSel === 'b' ? '✓ ¡Correcto! ' : '✗ Gana el robot MODERNO. '}Las casas reales SON desordenadas. Los foundation models robóticos (RT-2, Pi-0, Gemini Robotics) entrenan en miles de escenarios reales. La generalización le gana a la programación específica para un mundo no estructurado.</Text>
            </View>
          )}
        </View>
      );
      case 17: return (
        <View>
          <Tag icon="✅" label="Módulo 17 de 19 · Verdadero o Falso" variant="activity" />
          <Title>Ética y robótica · ¿Verdad o mito?</Title>
          <Sub>5 afirmaciones sobre dilemas éticos reales. ¿Cuáles son verdad?</Sub>
          {ethicsQ.map((it, i) => {
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
      case 18: return (
        <View>
          <Tag icon="🏙️" label="Módulo 18 de 19 · Builder" variant="build" />
          <Title>Diseña el robot que cambiaría tu ciudad</Title>
          <Sub>Problema + forma + sensor + operación. Tu propuesta concreta.</Sub>
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
          <Text style={[styles.builderLabel, { marginTop: 12, marginBottom: 4 }]}>Tu robot urbano:</Text>
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
        const pct = Math.round((32 / 36) * 100);
        return (
          <View style={styles.completeContainer}>
            <View style={styles.completeBadge}><Text style={{ fontSize: 44 }}>🦾</Text></View>
            <Text style={styles.completeTitle}>¡Nivel 32 completado!</Text>
            <Text style={styles.completeSub}>Terminaste "Robótica e IA: El Cuerpo de la IA". Ahora eres Robotics Engineer.</Text>
            <View style={styles.xpEarned}><Text style={styles.xpEarnedText}>⭐ {xp} XP ganados en este nivel</Text></View>
            <View style={styles.skillsList}>
              {['Entiendo el ciclo Sensor → IA → Actuador como base de toda robótica', 'Conozco los robots reales más avanzados de 2025-2026 (Boston Dynamics, Figure, Tesla Bot)', 'Distingo el aprendizaje por refuerzo de la programación tradicional', 'Identifico aplicaciones reales: cirugía, exploración espacial, cuidado de mayores', 'Tengo opinión informada sobre robots en el trabajo, ética y responsabilidad'].map((s, i) => (
                <View key={i} style={styles.skillRow}><Text style={styles.skillCheck}>✓</Text><Text style={styles.skillText}>{s}</Text></View>
              ))}
            </View>
            <View style={styles.nextHint}><Text style={styles.nextHintText}><B>Nivel 33: IA en Movimiento — Autos y Drones</B>{'\n'}Si N32 explora robots con cuerpo completo, N33 se enfoca en máquinas en movimiento: autos autónomos, drones, taxis voladores y semáforos inteligentes. La movilidad del futuro.</Text></View>
            <View style={styles.lvlBarWrap}>
              <Text style={styles.lvlBarLabel}>Nivel 32 de 36 completado · {pct}% del camino</Text>
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
  fill: { height: '100%', backgroundColor: P.slate, borderRadius: 4 },
  xpChip: { ...typography.bold, fontSize: 13, color: '#854d0e', backgroundColor: '#fde68a', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
  progLabel: { ...typography.regular, fontSize: 11, color: P.faint, textAlign: 'center', paddingTop: 6 },
  scrollContent: { padding: 16, paddingBottom: 30 },

  tag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginBottom: 12 },
  tagText: { fontSize: 11, fontWeight: '700' },

  introIcon: { width: 68, height: 68, borderRadius: 20, backgroundColor: P.slateBg, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  title: { ...typography.extraBold, fontSize: 20, color: P.ink, marginBottom: 8, lineHeight: 26 },
  sub: { ...typography.regular, fontSize: 13, color: P.muted, lineHeight: 20, marginBottom: 12 },
  bodyText: { ...typography.regular, fontSize: 13, color: P.body, lineHeight: 22, marginBottom: 12 },
  bold: { fontWeight: '700', color: P.ink },
  sectionTitle: { ...typography.bold, fontSize: 14, color: P.ink, marginTop: 10, marginBottom: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f0f0f0' },

  card: { backgroundColor: P.cardBg, borderRadius: 14, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: P.border },
  cardAccent: { backgroundColor: P.slateBg, borderColor: P.slateBorder },
  cardGreen: { backgroundColor: P.greenSoft, borderColor: P.greenBorder },
  cardYellow: { backgroundColor: '#fefce8', borderColor: P.amberBorder },
  cardViolet: { backgroundColor: P.violetBg, borderColor: P.violetBorder },
  cardTitle: { ...typography.bold, fontSize: 13, color: P.ink, marginBottom: 4 },
  cardText: { ...typography.regular, fontSize: 13, color: P.body, lineHeight: 21 },

  highlightBox: { borderLeftWidth: 3, borderLeftColor: P.slate, backgroundColor: P.slateBg, borderRadius: 8, padding: 12, marginBottom: 12 },
  highlightText: { fontSize: 13, color: P.slateText, lineHeight: 21 },
  tipBox: { borderLeftWidth: 3, borderLeftColor: P.green, backgroundColor: P.greenSoft, borderRadius: 8, padding: 12, marginTop: 4 },
  tipText: { fontSize: 13, color: P.greenText, lineHeight: 21 },
  stepLi: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 9 },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: P.slate, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  stepLiText: { flex: 1, fontSize: 13, color: P.body, lineHeight: 20 },

  chipsPool: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, padding: 10, backgroundColor: P.cardBg, borderRadius: 14, borderWidth: 1, borderColor: P.border, marginBottom: 10, minHeight: 54 },
  chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#d1d5db', backgroundColor: '#fff' },
  chipSel: { borderColor: P.slate, backgroundColor: P.slateBg },
  chipFlash: { borderColor: '#fca5a5', backgroundColor: P.redBg },
  chipText: { fontSize: 12, color: P.body, lineHeight: 16 },
  dropCols: { flexDirection: 'row', gap: 8 },
  dropCol: { flex: 1, borderRadius: 12, borderWidth: 2, borderColor: '#d1d5db', borderStyle: 'dashed', minHeight: 110, padding: 8, backgroundColor: '#fafafa' },
  zoneVista: { borderStyle: 'solid', borderColor: P.blueBorder, backgroundColor: P.blueBg },
  zoneTacto: { borderStyle: 'solid', borderColor: P.amberBorder, backgroundColor: '#fffbeb' },
  dropHeader: { paddingVertical: 5, paddingHorizontal: 6, borderRadius: 7, marginBottom: 7, alignItems: 'center' },
  dropHeaderVista: { backgroundColor: '#dbeafe' },
  dropHeaderTacto: { backgroundColor: P.amberBg },
  dropHeaderText: { fontSize: 11, fontWeight: '700' },
  dropArea: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  dropChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14 },
  dropChipVista: { backgroundColor: '#dbeafe' },
  dropChipTacto: { backgroundColor: P.amberBg },
  dropChipText: { fontSize: 11, fontWeight: '500', lineHeight: 15 },

  matchHeaderRow: { flexDirection: 'row', gap: 6, marginBottom: 5 },
  matchColLabel: { flex: 1, fontSize: 11, fontWeight: '700', color: P.muted, textAlign: 'center' },
  matchRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  matchItem: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', minHeight: 66 },
  matchLeft: { borderColor: P.blueBorder, backgroundColor: P.blueBg },
  matchRightBox: { borderColor: P.violetBorder, backgroundColor: P.violetBg },
  matchItemSel: { borderColor: P.slate, backgroundColor: P.slateBg },
  matchItemDone: { borderColor: P.green, backgroundColor: P.greenSoft },
  matchItemWrong: { borderColor: P.red, backgroundColor: P.redBg },
  matchText: { fontSize: 11, textAlign: 'center', lineHeight: 15 },
  matchLeftText: { color: P.blueText, fontWeight: '700' },
  matchRightText: { color: P.violetText },
  matchTextDone: { color: P.greenText },

  builderWrap: { gap: 10 },
  builderRow: { backgroundColor: P.cardBg, borderWidth: 1, borderColor: P.border, borderRadius: 12, padding: 11 },
  builderLabel: { fontSize: 11, fontWeight: '700', color: P.slateText, marginBottom: 6, letterSpacing: 0.3, textTransform: 'uppercase' },
  builderOpts: { gap: 5 },
  builderOpt: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 9, borderWidth: 1.5, borderColor: P.border, backgroundColor: '#fff' },
  builderOptSel: { borderColor: P.slate, backgroundColor: P.slateBg },
  builderOptText: { fontSize: 12, color: P.body, fontWeight: '500', lineHeight: 16 },
  builderOptTextSel: { color: P.slateText, fontWeight: '700' },
  codeBox: { backgroundColor: P.codeBg, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#1e293b' },
  codeLine: { fontSize: 12, lineHeight: 20, marginBottom: 2 },
  codeText: { color: P.codeText, fontFamily: 'monospace' },
  codeKey: { color: P.codeKey, fontWeight: '700', fontFamily: 'monospace' },
  codeEmpty: { color: P.codeEmpty, fontStyle: 'italic', fontFamily: 'monospace' },

  quizQ: { ...typography.bold, fontSize: 13, color: P.ink, padding: 12, backgroundColor: P.cardBg, borderRadius: 10, borderWidth: 1, borderColor: P.border, marginBottom: 8, lineHeight: 19 },
  qopt: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 11, borderWidth: 1.5, borderColor: P.border, backgroundColor: '#fff', marginBottom: 7 },
  qoptSel: { borderColor: P.slate, backgroundColor: P.slateBg },
  qoptOk: { borderColor: P.green, backgroundColor: P.greenBg },
  qoptWrong: { borderColor: P.red, backgroundColor: P.redBg },
  qLetter: { width: 24, height: 24, borderRadius: 7, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: P.border, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  qLetterSel: { backgroundColor: P.slate, borderColor: P.slate },
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

  scenarioBox: { backgroundColor: '#fffbeb', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: P.amberBorder },
  scenarioLabel: { fontSize: 10, fontWeight: '700', color: P.amberText, marginBottom: 8, letterSpacing: 0.7 },
  scenarioText: { fontSize: 13, color: P.body, lineHeight: 21 },

  compareCard: { borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: P.border, marginBottom: 8, backgroundColor: P.cardBg },
  compareSel: { borderColor: P.slate, backgroundColor: P.slateBg },
  compareCardDim: { opacity: 0.7 },
  compareCardOk: { borderColor: P.green, backgroundColor: P.greenSoft },
  compareLabel: { fontSize: 11, fontWeight: '700', color: P.slateText, marginBottom: 5, letterSpacing: 0.3 },
  compareText: { fontSize: 12, color: P.body, lineHeight: 19 },
  compareQ: { fontSize: 13, fontWeight: '700', color: P.ink, marginTop: 4, marginBottom: 8 },
  compareBtns: { flexDirection: 'row', gap: 10 },
  compareBtn: { flex: 1, padding: 12, borderRadius: 11, borderWidth: 1.5, borderColor: P.border, backgroundColor: '#fff', alignItems: 'center' },
  compareBtnSel: { borderColor: P.slate, backgroundColor: P.slateBg },
  compareBtnText: { fontSize: 13, fontWeight: '700', color: P.slateText },

  reflectArea: { minHeight: 120, padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: P.border, backgroundColor: '#fafafa', fontSize: 13, color: P.body, lineHeight: 22, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: P.faint, textAlign: 'right', marginTop: 4 },

  exCard: { borderRadius: 14, padding: 12, borderWidth: 1, borderColor: P.border, marginBottom: 8, backgroundColor: '#fff' },
  exCardOpen: { borderColor: P.slate, backgroundColor: P.slateBg },
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
  completeBadge: { width: 88, height: 88, borderRadius: 24, backgroundColor: P.slate, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
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
  lvlBarInner: { height: '100%', backgroundColor: P.slate, borderRadius: 4 },

  navRow: { flexDirection: 'row', gap: 8, padding: 14, borderTopWidth: 1, borderTopColor: '#f0f0f0', backgroundColor: '#fafafa' },
  backBtn: { paddingHorizontal: 16, paddingVertical: 13, borderRadius: 12, backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#e2e8f0', justifyContent: 'center' },
  backBtnText: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  primaryBtn: { backgroundColor: P.green, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
  primaryBtnAccent: { backgroundColor: P.slate },
  primaryBtnOff: { opacity: 0.35 },
  primaryBtnText: { ...typography.bold, color: '#fff', fontSize: 15 },
});
