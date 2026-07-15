import { useState, useEffect, useRef, type ReactNode } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  Alert, BackHandler, Vibration, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useGameStore } from '../store/gameStore';
import { typography } from '../theme';
import { exitLevel } from '../utils/exitLevel';
import XPToast from '../components/XPToast';

// ===================== PALETA (tema claro verde/lima, Mundo 4 "El Gran Torneo") =====================
const C = {
  bg: '#f0fdf4', card: '#ffffff', card2: '#f8fafc',
  text: '#0f172a', muted: '#64748b', border: '#e2e8f0',
  green: '#16a34a', greenDark: '#15803d', greenLight: '#dcfce7', greenBorder: '#bbf7d0', lime: '#84cc16',
  okBg: '#dcfce7', okText: '#166534', okBorder: '#16a34a',
  failBg: '#fff1f2', failText: '#991b1b', failBorder: '#ef4444',
  amber: '#f59e0b', amberBg: '#fef3c7', amberText: '#92400e',
  placeholder: '#94a3b8',
};

// ===================== HELPERS =====================
const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function looksRandom(text: string): boolean {
  const words = normalize(text).split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return true;
  const noVowels = words.filter(w => w.length >= 4 && !/[aeiou]/.test(w));
  if (noVowels.length >= Math.max(1, Math.floor(words.length / 2))) return true;
  if (words.length >= 4) { const u = new Set(words); if (u.size / words.length < 0.5) return true; }
  return false;
}
function containsTopic(text: string, terms: string[]): boolean {
  const t = normalize(text);
  return terms.some(term => term.length <= 3 ? new RegExp(`\\b${term}\\b`).test(t) : t.includes(term));
}
const REFLECT_TERMS = ['chatgpt', 'ia', 'imagen', 'imagenes', 'voz', 'gpt', 'dall', 'estudiar', 'aprender', 'idioma', 'idiomas', 'codigo', 'archivo', 'usar', 'usaria', 'superpoder', 'herramienta', 'tarea', 'examen', 'practicar'];

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let j = a.length - 1; j > 0; j--) { const k = Math.floor(Math.random() * (j + 1)); [a[j], a[k]] = [a[k], a[j]]; }
  return a;
}
function shuffleOpts<T extends { opts: string[]; correct: number }>(q: T): T {
  const paired = q.opts.map((opt, i) => ({ opt, isCorrect: i === q.correct }));
  const sh = shuffle(paired);
  return { ...q, opts: sh.map(p => p.opt), correct: sh.findIndex(p => p.isCorrect) };
}
const pickN = <T,>(arr: T[], n: number): T[] => shuffle(arr).slice(0, n);

// ===================== DATOS (fieles al HTML nivel-19) =====================
type MatchPair = { left: string; right: string };
const MATCH_POOL: MatchPair[] = [
  { left: 'Crear una imagen desde cero con palabras', right: 'DALL-E (generador de imágenes)' },
  { left: 'Hablarle con voz y escuchar su respuesta', right: 'Modo de voz de ChatGPT' },
  { left: 'Un ChatGPT especial solo para matemáticas', right: 'GPTs personalizados' },
  { left: 'Subir un PDF y hacerle preguntas', right: 'Analizar archivos y documentos' },
  { left: 'Pedirle que programe una app sencilla', right: 'ChatGPT escribiendo código' },
];

const SORT_SESION = [
  'Abre ChatGPT y empieza una conversación nueva',
  'Define tu objetivo: quiero estudiar las capitales de Europa para el examen del viernes',
  'Pide el plan: hazme un plan de 3 días con actividades divertidas cada día',
  'Elige lo que más te gusta del plan y pide que lo desarrolle en detalle',
  'Practica con preguntas: hazme un quiz de 10 preguntas de menor a mayor dificultad',
  'Termina con resumen: resume en 5 puntos lo más importante que estudié hoy',
];

type TFItem = { stmt: string; correct: boolean; explain: string };
const TF_POOL: TFItem[] = [
  { stmt: 'ChatGPT puede buscar noticias de hoy en internet sin ninguna configuración extra.', correct: false, explain: '¡Mito! La versión básica no busca en internet. Para noticias de hoy, usa Google o Gemini con búsqueda activada.' },
  { stmt: 'Puedes subir fotos a ChatGPT y pedirle que las describa o analice.', correct: true, explain: '¡Verdad! Con GPT-4o puedes subir imágenes. ChatGPT explica lo que ve, analiza un gráfico o lee texto en una foto.' },
  { stmt: 'ChatGPT recuerda todo lo que hablaste en conversaciones de días anteriores.', correct: false, explain: '¡Mito! Cada conversación nueva empieza desde cero. Tienes que darle el contexto de nuevo cada vez.' },
  { stmt: 'Los GPTs personalizados son versiones de ChatGPT entrenadas para temas específicos.', correct: true, explain: '¡Verdad! Los GPTs son como apps dentro de ChatGPT: para idiomas, matemáticas, cocina y miles de temas más.' },
  { stmt: 'GPT-4o es exactamente igual que GPT-3.5, solo con diferente nombre.', correct: false, explain: '¡Mito! Son muy diferentes. GPT-4o ve imágenes, usa voz, genera imágenes con DALL-E y razona mucho mejor.' },
  { stmt: 'DALL-E es la herramienta de ChatGPT para generar imágenes desde texto.', correct: true, explain: '¡Verdad! Describes lo que quieres ver y DALL-E crea la imagen en segundos. Solo disponible con GPT-4o.' },
  { stmt: 'Si ChatGPT te da una estadística, siempre es correcta y no necesitas verificar.', correct: false, explain: '¡Cuidado! ChatGPT puede alucinar e inventar datos que suenan reales. Siempre verifica los datos importantes.' },
  { stmt: 'Puedes usar ChatGPT para practicar un idioma nuevo conversando con él.', correct: true, explain: '¡Verdad! Uno de sus mejores usos. Puedes hablar en inglés o francés y pedirle que corrija tus errores.' },
  { stmt: 'ChatGPT puede escribir código de programación y explicar cómo funciona.', correct: true, explain: '¡Verdad! Puede escribir código en Python, explicarlo línea por línea o encontrar errores.' },
  { stmt: 'Copiar la respuesta de ChatGPT y entregarla como tu tarea es una buena forma de aprender.', correct: false, explain: '¡Mito peligroso! Copiar no es aprender. Lo correcto es pedirle que te EXPLIQUE para escribir con tus palabras.' },
];

type DetectiveItem = { task: string; respA: { text: string; hint: string }; respB: { text: string; hint: string }; cual4o: 'A' | 'B'; explain: string };
const DETECTIVE_POOL: DetectiveItem[] = [
  { task: 'Le preguntaron: ¿Qué es la fotosíntesis?',
    respA: { text: 'La fotosíntesis es el proceso por el que las plantas convierten luz solar en energía. Toman CO2 del aire y agua del suelo, y con la luz producen glucosa y liberan oxígeno. Es como si cada hoja tuviera una fábrica solar dentro.', hint: 'Usa metáforas y lenguaje accesible' },
    respB: { text: 'La fotosíntesis es un proceso bioquímico en los cloroplastos. Involucra las fotorreacciones en los tilacoides y el ciclo de Calvin en el estroma. Ecuación: 6CO2 + 6H2O + luz → C6H12O6 + 6O2.', hint: 'Respuesta técnica y formal' },
    cual4o: 'A', explain: 'La A es GPT-4o: usa analogías (fábrica solar), lenguaje claro y adapta la explicación. La B es correcta pero muy técnica, sin considerar quién pregunta.' },
  { task: 'Le pidieron: Ayúdame a planear mis vacaciones en Brasil',
    respA: { text: 'Para tus vacaciones en Brasil: 1) ¿Destino: playa (Río) o naturaleza (Amazonas)? 2) Época: evita enero-marzo en Río por lluvias. 3) Presupuesto: hay opciones económicas fuera de zonas turísticas. ¿Cuántos días tienes y qué te emociona más?', hint: 'Hace preguntas personalizadas' },
    respB: { text: 'Brasil es un país hermoso. Río de Janeiro tiene el Cristo Redentor y Copacabana. São Paulo es la ciudad más grande. El Amazonas es la selva más grande del mundo. Hay muchas cosas para ver y hacer.', hint: 'Información genérica sin personalizar' },
    cual4o: 'A', explain: 'La A es GPT-4o: da consejos específicos, anticipa problemas (lluvias) y hace preguntas para personalizar. La B es genérica y no te ayuda a planear nada concreto.' },
  { task: 'Le preguntaron: ¿Por qué el cielo es azul?',
    respA: { text: 'El cielo es azul porque el aire dispersa la luz azul más que otros colores. Es como si el aire fuera un filtro que esparce el azul. Por eso al atardecer el cielo es naranja: la luz viaja más lejos y el azul ya no llega a tus ojos.', hint: 'Conecta con el atardecer también' },
    respB: { text: 'El cielo es azul por la dispersión de Rayleigh. Las moléculas de gas dispersan longitudes de onda cortas (azul) más que las largas (rojo). Por eso vemos luz azul dispersada en todas direcciones.', hint: 'Explicación correcta pero básica' },
    cual4o: 'A', explain: 'La A es GPT-4o: anticipa la pregunta del atardecer y usa la analogía del filtro. La B es correcta pero no va más allá de la pregunta inicial.' },
];

type QuizItem = { q: string; opts: string[]; correct: number; explain: string };
const QUIZ_POOL: QuizItem[] = [
  { q: 'Yuki, 11 años, de Tokio quiere aprender inglés con ChatGPT. ¿Cuál es el mejor prompt?',
    opts: ['Enséñame inglés', 'Eres un profe de inglés paciente y divertido para niños de 11 años. Hablemos en inglés sobre videojuegos y corrígeme con amabilidad.', 'Tradúceme palabras en inglés', 'Dame lecciones de inglés'],
    correct: 1, explain: 'El segundo usa una identidad (Truco 4) y contexto específico. ChatGPT sabe exactamente cómo ayudar a Yuki.' },
  { q: 'Sofía, 10 años, de Madrid tiene tarea de historia. ¿Qué NO debe hacer con ChatGPT?',
    opts: ['Pedirle que explique el tema con ejemplos divertidos', 'Pedirle preguntas de práctica', 'Copiar la respuesta completa y entregarla como su tarea', 'Pedirle que simplifique un texto difícil'],
    correct: 2, explain: 'Copiar es trampa y no sirve para aprender. ChatGPT debe ser el profe que te guía, no el que hace la tarea por ti.' },
  { q: 'Lucas, 12, de Buenos Aires quiere una imagen de un dinosaurio en la ciudad. ¿Qué herramienta usa?',
    opts: ['El modo de voz', 'DALL-E, el generador de imágenes de ChatGPT', 'Los GPTs personalizados', 'La función de código'],
    correct: 1, explain: 'DALL-E convierte texto en imágenes. Lucas escribe la descripción y ChatGPT genera la imagen. Solo con GPT-4o.' },
  { q: '¿Para qué sirven los GPTs personalizados de ChatGPT?',
    opts: ['Para hacer ChatGPT más rápido', 'Para tener versiones entrenadas en temas específicos', 'Para guardar conversaciones entre sesiones', 'Para traducir textos mejor'],
    correct: 1, explain: 'Los GPTs son como apps dentro de ChatGPT: cocina, idiomas, programación, matemáticas y mucho más.' },
  { q: 'Amara, 11, de Ghana quiere practicar matemáticas. ¿Cuál prompt es mejor?',
    opts: ['Ayúdame con mates', 'Hazme 5 problemas de multiplicación de fracciones para 5º grado. Cuando me equivoque, dame una pista para descubrirlo, no la respuesta.', 'Explícame las matemáticas', 'Quiero aprender matemáticas'],
    correct: 1, explain: 'El segundo especifica tema, nivel, cantidad y cómo quiere la ayuda (pistas, no respuestas). Más específico = mejor resultado.' },
  { q: 'ChatGPT dice que un personaje histórico dijo una frase famosa. ¿Qué debes hacer?',
    opts: ['Publicarlo de inmediato en redes', 'Creértelo porque ChatGPT siempre tiene razón', 'Buscar la cita en una fuente confiable para verificarla', 'Pedirle más citas del mismo personaje'],
    correct: 2, explain: '¡Siempre verifica! ChatGPT puede alucinar e inventar citas que suenan reales. Para datos históricos, confirma en fuentes confiables.' },
  { q: '¿Qué ventaja tiene GPT-4o sobre GPT-3.5?',
    opts: ['Es completamente gratis siempre', 'Puede ver imágenes, razona mejor y tiene acceso a DALL-E', 'Recuerda todas tus conversaciones anteriores', 'Nunca se equivoca en ningún tema'],
    correct: 1, explain: 'GPT-4o ve imágenes, genera imágenes con DALL-E y razona mejor. Pero ninguna versión recuerda conversaciones y todas pueden equivocarse.' },
  { q: 'Kai, 10, de Japón quiere un juego de preguntas sobre animales. ¿Cuál prompt es mejor?',
    opts: ['Preguntas de animales', 'Hazme un juego de 10 preguntas sobre animales de África para niños de 10 años. Incluye 4 opciones y la respuesta al final.', 'Dame información de animales', 'Animales salvajes de África'],
    correct: 1, explain: 'Excelente prompt: especifica el tipo (juego), tema, audiencia, cantidad y formato. Más específico = mejor resultado.' },
];

type FillItem = { before: string; after: string; opts: string[]; correct: number; explain: string };
const FILL_POOL: FillItem[] = [
  { before: 'La herramienta de ChatGPT que convierte texto en imágenes se llama ', after: '.', opts: ['DALL-E', 'Google', 'Bing', 'Stable'], correct: 0, explain: '"DALL-E" es la herramienta de OpenAI para generar imágenes. Está integrada en ChatGPT con GPT-4o.' },
  { before: 'Los ', after: ' son versiones de ChatGPT entrenadas para tareas específicas, como aprender idiomas.', opts: ['GPTs', 'Bots', 'Apps', 'Modos'], correct: 0, explain: '"GPTs" son como apps dentro de ChatGPT. Hay miles creados por la comunidad y por OpenAI.' },
  { before: 'Cuando ChatGPT inventa información falsa con total confianza, se llama ', after: '.', opts: ['alucinación', 'error', 'bug', 'trampa'], correct: 0, explain: '"Alucinación" es el término técnico. La IA predice texto que suena real pero puede ser falso.' },
  { before: 'La versión más avanzada de ChatGPT actualmente se llama GPT-', after: '.', opts: ['4o', '3.5', '5', 'Ultra'], correct: 0, explain: '"GPT-4o" (la "o" es de "omni", que significa "todo") procesa texto, imágenes y voz.' },
  { before: 'La empresa que creó ChatGPT se llama ', after: '.', opts: ['OpenAI', 'Google', 'Microsoft', 'Apple'], correct: 0, explain: '"OpenAI" lanzó ChatGPT en 2022. Microsoft invirtió en ellos; por eso Bing y Copilot usan su tecnología.' },
  { before: 'Para que ChatGPT responda como un experto, le das una ', after: ' como "eres un profe de física divertido".', opts: ['identidad', 'contraseña', 'imagen', 'canción'], correct: 0, explain: '"Identidad" o rol. Darle una identidad específica cambia por completo su forma de responder. ¡Es el Truco 4!' },
];

const SPRINT_POOL: TFItem[] = [
  { stmt: 'ChatGPT puede generar imágenes usando DALL-E', correct: true, explain: '' },
  { stmt: 'ChatGPT recuerda automáticamente todas tus conversaciones anteriores', correct: false, explain: '' },
  { stmt: 'GPT-4o puede analizar imágenes que le envías', correct: true, explain: '' },
  { stmt: 'Copiar la respuesta de ChatGPT y entregarla como tu tarea es correcto', correct: false, explain: '' },
  { stmt: 'Los GPTs personalizados son versiones especializadas de ChatGPT', correct: true, explain: '' },
  { stmt: 'ChatGPT siempre dice la verdad y nunca se equivoca', correct: false, explain: '' },
  { stmt: 'Puedes hablarle a ChatGPT con tu voz usando el modo de voz', correct: true, explain: '' },
  { stmt: 'ChatGPT puede ayudarte a escribir código de programación', correct: true, explain: '' },
  { stmt: 'GPT-3.5 y GPT-4o son exactamente iguales en capacidades', correct: false, explain: '' },
  { stmt: 'Es buena idea verificar los datos importantes que te da ChatGPT', correct: true, explain: '' },
  { stmt: 'Puedes pedirle a ChatGPT que te haga un quiz para estudiar', correct: true, explain: '' },
  { stmt: 'ChatGPT conoce resultados de partidos de ayer sin buscar en internet', correct: false, explain: '' },
];

type EthicsItem = { scenario: string; correct: 'safe' | 'doubt' | 'bad'; explain: string };
const ETHICS_POOL: EthicsItem[] = [
  { scenario: 'Emma, 11, de París le pide a ChatGPT que explique la Revolución Francesa como una historia de superhéroes para entenderla mejor.', correct: 'safe', explain: '¡Uso perfecto! Pedir explicaciones creativas ayuda a entender temas difíciles. Emma va a aprender mucho más así.' },
  { scenario: 'Ryo, 12, de Tokio usa ChatGPT para que le escriba su ensayo completo sobre el medio ambiente y lo entrega como si fuera suyo.', correct: 'bad', explain: 'Trampa académica. Ryo no aprende nada y engaña a su profe. Lo correcto: pedirle que explique y ayude a organizar ideas, pero escribir con sus palabras.' },
  { scenario: 'Valentina, 10, de Lima le pregunta a ChatGPT si un hongo que encontró en el bosque es venenoso para decidir si se lo come.', correct: 'bad', explain: '¡Peligroso! ChatGPT puede equivocarse identificando plantas y hongos. Para salud y seguridad, siempre consulta a un adulto real.' },
  { scenario: 'Oliver, 11, de Londres usa ChatGPT para practicar conversación en español y le pide que corrija sus errores de gramática.', correct: 'safe', explain: '¡Uso excelente! Practicar idiomas con ChatGPT es de sus mejores usos. Oliver tiene un compañero de conversación infinitamente paciente.' },
  { scenario: 'Priya, 12, de Mumbai le pide a ChatGPT la contraseña de su correo porque la olvidó.', correct: 'bad', explain: 'ChatGPT no puede recuperar contraseñas de cuentas externas. Nunca compartas contraseñas con ninguna app. Usa "olvidé mi contraseña".' },
];

const IMG_OPTIONS: Record<'estilo' | 'objeto' | 'ambiente' | 'emocion', string[]> = {
  estilo: ['Dibujo animado colorido estilo anime', 'Pintura realista como fotografía', 'Arte digital con colores neón', 'Acuarela suave con colores pastel', 'Ilustración de libro infantil'],
  objeto: ['un robot bailando salsa', 'un gato astronauta explorando Marte', 'un dragón leyendo libros', 'un pingüino haciendo surf', 'una tortuga volando con globos'],
  ambiente: ['en una ciudad futurista de luces', 'en un bosque mágico encantado', 'en el fondo del océano entre peces', 'en el espacio con planetas de colores', 'en un mercado medieval con castillos'],
  emocion: ['con expresión alegre y emocionada', 'con cara de sorpresa y ojos enormes', 'con sonrisa tranquila y relajada', 'con cara de concentración total', 'con expresión de misterio y curiosidad'],
};

type SesionStep = { label: string; q: string; opts: string[]; correct: number; fb_ok: string; fb_no: string };
const SESION_STEPS: SesionStep[] = [
  { label: 'Paso 1 de 4 · El objetivo', q: 'Tienes un examen de geografía sobre los continentes en 3 días. ¿Cómo empiezas la sesión con ChatGPT?',
    opts: ['Hazme el examen ya', 'Tengo un examen sobre los 7 continentes en 3 días. ¿Puedes ayudarme a crear un plan de estudio divertido de 3 días con actividades diferentes cada día?', 'Dime los continentes', 'Estudia geografía conmigo'],
    correct: 1, fb_ok: '¡Perfecto! Das el contexto completo: tema, tiempo disponible y pides un plan estructurado.', fb_no: 'Ese prompt es muy vago. Sin el tema exacto y el tiempo, ChatGPT no puede ayudarte tan bien.' },
  { label: 'Paso 2 de 4 · El truco', q: 'ChatGPT te da el plan pero las explicaciones son muy aburridas. ¿Qué haces?',
    opts: ['Cierro ChatGPT y estudio con mi libro', 'Eres un explorador geográfico para niños de 11 años. Explícame cada continente como si fuera un mundo diferente de un videojuego con características únicas.', 'Explícame mejor', 'Dame más información'],
    correct: 1, fb_ok: '¡Brillante! Usas el Truco 4 (darle identidad) para hacer las explicaciones mucho más divertidas.', fb_no: 'Puedes hacerlo mejor. Recuerda el Truco 4: darle una identidad específica cambia cómo explica las cosas.' },
  { label: 'Paso 3 de 4 · La práctica', q: 'Ya entendiste los continentes. ¿Cómo practicas con ChatGPT?',
    opts: ['Hazme el examen completo con todas las respuestas', 'Hazme un quiz de 10 preguntas sobre los 7 continentes de menor a mayor dificultad. Cuando me equivoque, dame una pista antes de la respuesta.', 'Dame un resumen de todo', '¿Cuáles son las respuestas del examen?'],
    correct: 1, fb_ok: '¡Excelente estrategia! Pides dificultad progresiva y pistas en lugar de respuestas. Así tu cerebro aprende de verdad.', fb_no: 'Pedir las respuestas no es estudiar. El cerebro aprende cuando se esfuerza. Pide práctica, no respuestas.' },
  { label: 'Paso 4 de 4 · El cierre', q: 'Terminaste de estudiar. ¿Cómo cierras la sesión de forma inteligente?',
    opts: ['Cierro el chat sin más', 'Resume en 5 puntos lo más importante que estudié hoy sobre los continentes y dime qué temas debo repasar mañana.', 'Gracias, adiós', '¿Cuándo es mi examen?'],
    correct: 1, fb_ok: '¡Cierre perfecto! Pides un resumen que consolida lo aprendido y planeas el día siguiente.', fb_no: 'Cerrar sin revisar es perder lo aprendido. Un buen resumen al final fija mejor la información.' },
];

const DRAG_POOL: { text: string; correct: '35' | '4o' }[] = [
  { text: 'Subir una foto de mi examen para que la corrija', correct: '4o' },
  { text: 'Preguntar cuánto es 15% de 200 pesos', correct: '35' },
  { text: 'Pedirle que genere una imagen de un volcán', correct: '4o' },
  { text: 'Hacer un resumen de un texto que le pego', correct: '35' },
  { text: 'Analizar un gráfico de mi trabajo de ciencias', correct: '4o' },
  { text: 'Pedir ideas para un proyecto escolar', correct: '35' },
  { text: 'Hablarle por voz y que me responda con voz', correct: '4o' },
  { text: 'Preguntar cómo se dice "hola" en japonés', correct: '35' },
];

const TOTAL_STEPS = 22;   // 0=intro … 21=completado
const CONTENT_STEPS = 20;
const SPRINT_DURATION = 60;

export default function Level19() {
  const completeLevel = useGameStore(s => s.completeLevel);
  const devMode = useGameStore(s => s.devMode);

  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);
  const [xpToast, setXpToast] = useState<{ amount: number; id: number } | null>(null);
  const awardedSteps = useRef<Set<number>>(new Set());

  // Pools (fijos por sesión)
  const [matchPairs] = useState(() => pickN(MATCH_POOL, 4));
  const [tfItems] = useState(() => pickN(TF_POOL, 5));
  const [quizItems] = useState(() => pickN(QUIZ_POOL, 5).map(shuffleOpts));
  const [fillItems] = useState(() => pickN(FILL_POOL, 4).map(shuffleOpts));
  const [ethicsItems] = useState(() => pickN(ETHICS_POOL, 5));
  const [sesSteps] = useState(() => SESION_STEPS.map(shuffleOpts));
  const [dragItems] = useState(() => pickN(DRAG_POOL, 6));
  const [rightOrder] = useState(() => shuffle(matchPairs.map((p, i) => ({ idx: i, text: p.right }))));

  // Detective
  const [detQ, setDetQ] = useState(0);
  const [detSel, setDetSel] = useState<'A' | 'B' | null>(null);
  const [detCorrect, setDetCorrect] = useState(0);
  const [detDone, setDetDone] = useState(false);

  // Drag
  const [ddPlaced, setDdPlaced] = useState<{ [idx: number]: '35' | '4o' }>({});
  const [ddSel, setDdSel] = useState<number | null>(null);
  const [ddChecked, setDdChecked] = useState(false);
  const [ddSolved, setDdSolved] = useState(false);
  const [ddOverZone, setDdOverZone] = useState<'35' | '4o' | null>(null);
  const ddPlacedRef = useRef(ddPlaced);
  useEffect(() => { ddPlacedRef.current = ddPlaced; }, [ddPlaced]);
  const ddIdxRef = useRef<number | null>(null);
  const ddAllPlaced = dragItems.every((_, i) => ddPlaced[i] !== undefined);

  // Matching
  const [matchSel, setMatchSel] = useState<number | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [matchWrong, setMatchWrong] = useState<{ left: number; right: number } | null>(null);

  // Image builder
  const [imgState, setImgState] = useState({ estilo: '', objeto: '', ambiente: '', emocion: '' });

  // Sort
  const [sortOrder, setSortOrder] = useState<number[]>(() => shuffle([0, 1, 2, 3, 4, 5]));
  const [sortSolved, setSortSolved] = useState(false);
  const [sortWrong, setSortWrong] = useState<Set<number>>(new Set());

  // VF / Quiz
  const [vfAns, setVfAns] = useState<Record<number, boolean>>({});
  const [vfChecked, setVfChecked] = useState(false);
  const [vfScore, setVfScore] = useState(0);
  const [quizAns, setQuizAns] = useState<Record<number, number>>({});
  const [quizChecked, setQuizChecked] = useState(false);
  const [quizScore, setQuizScore] = useState(0);

  // Ethics
  const [ethQ, setEthQ] = useState(0);
  const [ethSel, setEthSel] = useState<string | null>(null);
  const [ethCorrect, setEthCorrect] = useState(0);
  const [ethDone, setEthDone] = useState(false);

  // Fill
  const [fillAns, setFillAns] = useState<Record<number, number>>({});

  // Sprint
  const [sprintItems] = useState(() => shuffle(SPRINT_POOL));
  const [sprintPhase, setSprintPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [sprintSec, setSprintSec] = useState(SPRINT_DURATION);
  const [sprintIdx, setSprintIdx] = useState(0);
  const [sprintAns, setSprintAns] = useState<boolean | null>(null);
  const sprintScoreRef = useRef(0);
  const [sprintScore, setSprintScore] = useState(0);

  // Sesión
  const [sesQ, setSesQ] = useState(0);
  const [sesSel, setSesSel] = useState<number | null>(null);
  const [sesCorrect, setSesCorrect] = useState(0);
  const [sesDone, setSesDone] = useState(false);

  // Reflexión
  const [reflectText, setReflectText] = useState('');
  const [reflectDone, setReflectDone] = useState(false);
  const [reflectError, setReflectError] = useState<string | null>(null);

  const addXP = (v: number) => {
    if (v <= 0) return;
    setXp(p => p + v);
    setXpToast(prev => ({ amount: v, id: (prev?.id ?? 0) + 1 }));
  };
  const awardStep = (amount: number) => {
    if (awardedSteps.current.has(step)) return;
    awardedSteps.current.add(step);
    addXP(amount);
  };

  const theorySteps = new Set([1, 2, 4, 6, 8, 11, 13, 15]);
  const showBack = theorySteps.has(step);

  useEffect(() => {
    const onBack = () => {
      if (showBack && step > 0) { setStep(s => s - 1); return true; }
      if (step > 0 && step < TOTAL_STEPS - 1) {
        Alert.alert('Módulo en curso', 'No puedes regresar durante esta actividad.', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Salir', style: 'destructive', onPress: () => exitLevel({ confirm: false }) },
        ]);
        return true;
      }
      return false;
    };
    const h = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => h.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, showBack]);

  // Sprint timer
  useEffect(() => {
    if (sprintPhase !== 'running') return;
    if (sprintSec <= 0) { finishSprint(); return; }
    const t = setTimeout(() => setSprintSec(s => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sprintPhase, sprintSec]);

  // Drag & drop web (mouse) — el shim táctil global se apoya en estos listeners para móvil
  useEffect(() => {
    if (Platform.OS !== 'web' || step !== 5 || ddSolved) return;
    const cleanups: (() => void)[] = [];
    const setup = () => {
      dragItems.forEach((_, idx) => {
        if (ddPlacedRef.current[idx] !== undefined) return;
        const el = document.getElementById(`dd-chip-${idx}`);
        if (!el) return;
        el.setAttribute('draggable', 'true');
        (el as HTMLElement).style.cursor = 'grab';
        const onDragStart = (e: DragEvent) => { ddIdxRef.current = idx; setDdSel(null); if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(idx)); } };
        const onDragEnd = () => { ddIdxRef.current = null; setDdOverZone(null); };
        el.addEventListener('dragstart', onDragStart);
        el.addEventListener('dragend', onDragEnd);
        cleanups.push(() => { el.removeEventListener('dragstart', onDragStart); el.removeEventListener('dragend', onDragEnd); });
      });
      (['35', '4o'] as const).forEach(zone => {
        const el = document.getElementById(`dd-zone-${zone}`);
        if (!el) return;
        const onOver = (e: Event) => { e.preventDefault(); setDdOverZone(zone); };
        const onLeave = (e: DragEvent) => { if (!el.contains(e.relatedTarget as Node)) setDdOverZone(null); };
        const onDrop = (e: Event) => { e.preventDefault(); setDdOverZone(null); const idx = ddIdxRef.current; if (idx === null || ddPlacedRef.current[idx] !== undefined) return; setDdPlaced(p => ({ ...p, [idx]: zone })); ddIdxRef.current = null; };
        el.addEventListener('dragover', onOver);
        el.addEventListener('dragleave', onLeave);
        el.addEventListener('drop', onDrop);
        cleanups.push(() => { el.removeEventListener('dragover', onOver); el.removeEventListener('dragleave', onLeave); el.removeEventListener('drop', onDrop); });
      });
    };
    const t = setTimeout(setup, 50);
    return () => { clearTimeout(t); cleanups.forEach(fn => fn()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, ddPlaced, ddSolved]);

  const next = () => { if (step < TOTAL_STEPS - 1) setStep(s => s + 1); };
  const prev = () => { if (step > 0) setStep(s => s - 1); };
  const finish = () => {
    const stars = xp >= 190 ? 3 : xp >= 120 ? 2 : 1;
    completeLevel(19, stars, xp);
    router.replace('/level/20');
  };

  // ---------- Acciones ----------
  const answerDet = (side: 'A' | 'B') => {
    if (detSel !== null) return;
    setDetSel(side);
    const item = DETECTIVE_POOL[detQ];
    const ok = side === item.cual4o;
    const running = detCorrect + (ok ? 1 : 0);
    if (ok) setDetCorrect(running);
    if (Platform.OS === 'android') Vibration.vibrate(60);
    setTimeout(() => {
      if (detQ + 1 < DETECTIVE_POOL.length) { setDetQ(q => q + 1); setDetSel(null); }
      else { setDetDone(true); awardStep(running >= 3 ? 20 : running >= 2 ? 12 : 5); }
    }, 1400);
  };

  const ddPlace = (zone: '35' | '4o') => {
    if (ddSel === null || ddPlaced[ddSel] !== undefined || ddSolved) return;
    setDdPlaced(p => ({ ...p, [ddSel]: zone }));
    setDdSel(null);
  };
  const ddReturn = (idx: number) => {
    if (ddSolved) return;
    setDdChecked(false);
    setDdPlaced(p => { const n = { ...p }; delete n[idx]; return n; });
  };
  const ddAllCorrect = dragItems.every((it, i) => ddPlaced[i] === it.correct);
  const verifyDd = () => {
    setDdChecked(true);
    if (dragItems.every((it, i) => ddPlaced[i] === it.correct)) { setDdSolved(true); awardStep(20); }
  };

  const pressRight = (correctIdx: number, rightPos: number) => {
    if (matchSel === null) return;
    if (matchSel === correctIdx) {
      const n = new Set(matched); n.add(matchSel); setMatched(n); setMatchSel(null);
      if (n.size === matchPairs.length) awardStep(20);
    } else {
      const l = matchSel; setMatchWrong({ left: l, right: rightPos });
      setTimeout(() => { setMatchWrong(null); setMatchSel(null); }, 600);
    }
  };

  const imgComplete = Object.values(imgState).every(v => v.length > 0);
  const imgPrompt = imgComplete ? `${imgState.estilo}, ${imgState.objeto} ${imgState.ambiente}, ${imgState.emocion}. Alta calidad, detallado.` : '';

  const moveSort = (pos: number, dir: number) => {
    if (sortSolved) return;
    const np = pos + dir; if (np < 0 || np >= sortOrder.length) return;
    const n = [...sortOrder]; [n[pos], n[np]] = [n[np], n[pos]]; setSortOrder(n); setSortWrong(new Set());
  };
  const checkSort = () => {
    if (sortOrder.every((v, i) => v === i)) { setSortSolved(true); awardStep(15); }
    else {
      const w = new Set(sortOrder.reduce<number[]>((a, v, i) => { if (v !== i) a.push(i); return a; }, []));
      setSortWrong(w); setTimeout(() => setSortWrong(new Set()), 3000);
    }
  };

  const checkVF = () => {
    setVfChecked(true);
    const c = tfItems.reduce((a, it, i) => a + (vfAns[i] === it.correct ? 1 : 0), 0);
    setVfScore(c); awardStep(c * 5);
  };
  const checkQuiz = () => {
    setQuizChecked(true);
    const c = quizItems.reduce((a, q, i) => a + (quizAns[i] === q.correct ? 1 : 0), 0);
    setQuizScore(c); awardStep(c * 8);
  };

  const answerEth = (val: string) => {
    if (ethSel !== null) return;
    setEthSel(val);
    const item = ethicsItems[ethQ];
    const ok = val === item.correct;
    const running = ethCorrect + (ok ? 1 : 0);
    if (ok) setEthCorrect(running);
    setTimeout(() => {
      if (ethQ + 1 < ethicsItems.length) { setEthQ(q => q + 1); setEthSel(null); }
      else { setEthDone(true); awardStep(running >= 4 ? 20 : running >= 3 ? 12 : 5); }
    }, 1400);
  };

  const selectFill = (qi: number, oi: number) => {
    if (fillAns[qi] !== undefined) return;
    setFillAns(p => ({ ...p, [qi]: oi }));
    if (oi === fillItems[qi].correct) addXP(7);
  };

  const answerSprint = (val: boolean) => {
    if (sprintPhase !== 'running' || sprintAns !== null) return;
    setSprintAns(val);
    if (val === sprintItems[sprintIdx].correct) { sprintScoreRef.current += 1; setSprintScore(sprintScoreRef.current); }
    setTimeout(() => {
      if (sprintIdx + 1 < sprintItems.length) { setSprintIdx(i => i + 1); setSprintAns(null); }
      else finishSprint();
    }, 500);
  };
  function finishSprint() {
    if (sprintPhase === 'done') return;
    setSprintPhase('done');
    const s = sprintScoreRef.current;
    awardStep(s >= 10 ? 25 : s >= 7 ? 18 : s >= 4 ? 12 : 5);
  }

  const answerSes = (oi: number) => {
    if (sesSel !== null) return;
    setSesSel(oi);
    const s = sesSteps[sesQ];
    const ok = oi === s.correct;
    const running = sesCorrect + (ok ? 1 : 0);
    if (ok) setSesCorrect(running);
    setTimeout(() => {
      if (sesQ + 1 < sesSteps.length) { setSesQ(q => q + 1); setSesSel(null); }
      else { setSesDone(true); awardStep(running >= 3 ? 25 : running >= 2 ? 15 : 8); }
    }, 1600);
  };

  const submitReflect = () => {
    const t = reflectText.trim();
    if (t.length < 40) { setReflectError('Escribe un poco más — al menos 40 caracteres.'); return; }
    if (looksRandom(t)) { setReflectError('Tu texto parece escrito al azar. Cuéntalo con tus propias palabras.'); return; }
    if (!containsTopic(t, REFLECT_TERMS)) { setReflectError('⚠️ Habla de ChatGPT: qué superpoder usarías (imágenes, voz, estudiar, idiomas...) y para qué.'); return; }
    setReflectError(null); setReflectDone(true); awardStep(15);
  };

  // ---------- Bloques auxiliares ----------
  const Tag = ({ children }: { children: ReactNode }) => (
    <View style={styles.tag}><Text style={styles.tagText}>{children}</Text></View>
  );
  const Title = ({ children }: { children: ReactNode }) => <Text style={styles.title}>{children}</Text>;
  const Body = ({ children }: { children: ReactNode }) => <Text style={styles.body}>{children}</Text>;
  const B = ({ children }: { children: ReactNode }) => <Text style={styles.bold}>{children}</Text>;
  const Card = ({ children, tint }: { children: ReactNode; tint?: string }) => (
    <View style={[styles.infoCard, tint ? { backgroundColor: tint } : null]}>{children}</View>
  );
  const Fb = ({ ok, children }: { ok: boolean; children: ReactNode }) => (
    <View style={[styles.fb, ok ? styles.fbOk : styles.fbFail]}>
      <Text style={[styles.fbText, { color: ok ? C.okText : C.failText }]}>{children}</Text>
    </View>
  );

  const renderStep = (): ReactNode => {
    switch (step) {
      case 0: return (
        <>
          <View style={styles.iconCircle}><Text style={styles.iconEmoji}>💬</Text></View>
          <Title>ChatGPT: tu compañero de aventuras</Title>
          <Text style={styles.subtitle}>Ya conoces los trucos del prompting. Ahora vas a conocer a fondo a ChatGPT, el LLM más famoso del mundo, y todas sus herramientas secretas.</Text>
          <Card tint={C.greenLight}><Text style={styles.cardTitle}>🌟 ¿Por qué es tan famoso?</Text><Text style={styles.cardText}>Lo usa gente de más de 180 países. ¡Más de 100 millones de personas cada mes!</Text></Card>
          <Card tint="#f7fee7"><Text style={styles.cardTitle}>🆕 3 mecánicas nuevas hoy</Text><Text style={styles.cardText}>Modo Detective (detecta cuál es GPT-4o) · Constructor de Imagen para DALL-E · Mi Sesión Perfecta.</Text></Card>
          <Card tint={C.card2}><Text style={styles.cardText}>⭐ 20 módulos · Nivel 19 de 36 · Mundo 4: El Gran Torneo</Text></Card>
        </>
      );

      case 1: return (
        <>
          <Tag>📖 Módulo 1 · ¿Por qué ChatGPT?</Tag>
          <Title>¿Qué hace especial a ChatGPT?</Title>
          <Body>ChatGPT es como una navaja suiza digital. Lo creó la empresa <B>OpenAI</B> en 2022 y tiene 5 superpoderes:</Body>
          <Body><B>1. Genera imágenes:</B> con DALL-E dibuja lo que imagines.{'\n'}<B>2. Habla con tu voz:</B> el modo de voz es perfecto para practicar idiomas.{'\n'}<B>3. GPTs personalizados:</B> apps dentro de ChatGPT para cada tema.{'\n'}<B>4. Analiza archivos:</B> sube un PDF o una foto y pídele que lo explique.{'\n'}<B>5. Escribe código:</B> programa y explica cómo funciona.</Body>
        </>
      );

      case 2: return (
        <>
          <Tag>📖 Módulo 2 · Los 5 superpoderes</Tag>
          <Title>Un vistazo rápido</Title>
          {[['🎨', 'Crear imágenes con DALL-E'], ['🎤', 'Modo de voz para conversar'], ['🧩', 'GPTs personalizados por tema'], ['📄', 'Analizar archivos y fotos'], ['💻', 'Escribir y explicar código']].map(([e, t], i) => (
            <Card key={i}><Text style={styles.cardText}>{e}  {t}</Text></Card>
          ))}
        </>
      );

      case 3: {
        const item = DETECTIVE_POOL[detQ];
        return (
          <>
            <Tag>🆕 Módulo 3 · Modo Detective</Tag>
            <Title>Detective: ¿cuál es GPT-4o?</Title>
            {!detDone ? (
              <>
                <Text style={styles.progressNote}>Caso {detQ + 1} de {DETECTIVE_POOL.length} · {detCorrect} correctos</Text>
                <View style={styles.scenarioBox}><Text style={styles.scenarioLabel}>La pregunta</Text><Text style={styles.scenarioText}>{item.task}</Text></View>
                {(['A', 'B'] as const).map(side => {
                  const resp = side === 'A' ? item.respA : item.respB;
                  const sel = detSel === side;
                  const isCorrect = detSel !== null && side === item.cual4o;
                  const isWrong = sel && side !== item.cual4o;
                  return (
                    <TouchableOpacity key={side} style={[styles.detCard, isCorrect && styles.optCorrect, isWrong && styles.optWrong]} disabled={detSel !== null} onPress={() => answerDet(side)}>
                      <Text style={styles.detLabel}>Respuesta {side}</Text>
                      <Text style={styles.detText}>{resp.text}</Text>
                      <Text style={styles.detHint}>Pista: {resp.hint}</Text>
                    </TouchableOpacity>
                  );
                })}
                {detSel !== null && <Fb ok={detSel === item.cual4o}>{detSel === item.cual4o ? '✅ ¡Correcto detective! ' : '❌ ¡Casi! '}{item.explain}</Fb>}
              </>
            ) : <Fb ok>🕵️ Detective completado: {detCorrect}/{DETECTIVE_POOL.length}. GPT-4o suele usar analogías, anticipar preguntas y adaptar el tono.</Fb>}
          </>
        );
      }

      case 4: return (
        <>
          <Tag>📖 Módulo 4 · GPT-3.5 vs GPT-4o</Tag>
          <Title>¿Cuál usar?</Title>
          <View style={styles.compareRow}>
            <View style={[styles.comparePanel, { backgroundColor: C.card2 }]}><Text style={styles.compareLabel}>GPT-3.5</Text><Text style={styles.compareText}>Gratis, rápido, bueno para texto. No ve imágenes ni tiene voz nativa.</Text></View>
            <View style={[styles.comparePanel, { backgroundColor: C.greenLight, borderColor: C.greenBorder }]}><Text style={[styles.compareLabel, { color: C.okText }]}>GPT-4o</Text><Text style={styles.compareText}>Analiza imágenes, modo de voz, DALL-E y razona mejor. Versión gratis limitada.</Text></View>
          </View>
        </>
      );

      case 5: return (
        <>
          <Tag>🧩 Módulo 5 · Clasifica</Tag>
          <Title>¿GPT-3.5 o GPT-4o?</Title>
          <Body>Cada tarea funciona mejor en una versión. Toca una y luego su columna (o arrástrala).</Body>
          <View style={styles.chipWrap}>
            {dragItems.map((item, i) => ddPlaced[i] === undefined ? (
              <TouchableOpacity key={i} id={`dd-chip-${i}`} style={[styles.chip, ddSel === i && styles.chipOn]} disabled={ddSolved} onPress={() => setDdSel(ddSel === i ? null : i)}>
                <Text style={styles.chipText}>{item.text}</Text>
              </TouchableOpacity>
            ) : null)}
            {ddAllPlaced && <Text style={{ color: C.placeholder, fontSize: 11 }}>Todas clasificadas ✓</Text>}
          </View>
          <View style={styles.dropRow}>
            {(['35', '4o'] as const).map(zone => (
              <TouchableOpacity key={zone} id={`dd-zone-${zone}`} activeOpacity={0.85} style={[styles.dropZone, ddOverZone === zone && styles.dropZoneOver]} disabled={ddSolved} onPress={() => ddPlace(zone)}>
                <Text style={styles.dropHeader}>{zone === '35' ? '⚡ GPT-3.5' : '🌟 GPT-4o'}</Text>
                {dragItems.map((item, idx) => ddPlaced[idx] === zone ? (
                  <TouchableOpacity key={idx} disabled={ddSolved} onPress={() => ddReturn(idx)} style={[styles.dropChip, ddChecked && (item.correct === zone ? styles.dropChipOk : styles.dropChipBad)]}>
                    <Text style={[styles.dropChipText, ddChecked && { color: item.correct === zone ? C.okText : C.failText }]}>{ddChecked ? (item.correct === zone ? '✓ ' : '✕ ') : ''}{item.text}</Text>
                  </TouchableOpacity>
                ) : null)}
              </TouchableOpacity>
            ))}
          </View>
          {ddChecked && ddSolved && <Fb ok>✅ ¡Perfecto! Sabes cuándo cada versión es la mejor.</Fb>}
          {ddChecked && !ddSolved && <Fb ok={false}>❌ Algunas no están bien (en rojo). Recuerda: imágenes, voz y análisis visual → GPT-4o; texto simple y cálculos → GPT-3.5. Toca las ✕ para reintentar.</Fb>}
        </>
      );

      case 6: return (
        <>
          <Tag>📖 Módulo 6 · GPTs personalizados</Tag>
          <Title>La tienda de apps de ChatGPT</Title>
          <Body>Los <B>GPTs</B> son como apps dentro de ChatGPT, entrenadas para un tema. Hay miles: para estudiar, crear arte, cocinar o aprender idiomas. Los encuentras en <B>"Explorar GPTs"</B>.</Body>
          <Card tint={C.greenLight}><Text style={styles.cardText}>Ejemplo: un GPT de "tutor de matemáticas" te explica paso a paso y te da problemas de tu nivel, sin que tú configures nada.</Text></Card>
        </>
      );

      case 7: return (
        <>
          <Tag>🔗 Módulo 7 · Conecta</Tag>
          <Title>¿Para qué sirve cada herramienta?</Title>
          <Body>Toca una tarea de la izquierda y luego su herramienta a la derecha.</Body>
          <View style={styles.matchRow}>
            <View style={styles.matchCol}>
              {matchPairs.map((p, i) => (
                <TouchableOpacity key={i} style={[styles.matchCard, matchSel === i && styles.matchCardSel, matched.has(i) && styles.matchCardDone, matchWrong?.left === i && styles.matchCardWrong]} disabled={matched.has(i)} onPress={() => setMatchSel(i)}>
                  <Text style={[styles.matchText, matched.has(i) && { color: C.okText }]}>{p.left}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.matchCol}>
              {rightOrder.map((item, pos) => {
                const isM = matched.has(item.idx);
                return (
                  <TouchableOpacity key={pos} style={[styles.matchCard, isM && styles.matchCardDone, matchWrong?.right === pos && styles.matchCardWrong]} disabled={isM || matchSel === null} onPress={() => pressRight(item.idx, pos)}>
                    <Text style={[styles.matchText, isM && { color: C.okText }]}>{item.text}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          {matched.size === matchPairs.length && <Fb ok>✅ ¡Todo conectado! Conoces las herramientas de ChatGPT.</Fb>}
        </>
      );

      case 8: return (
        <>
          <Tag>📖 Módulo 8 · DALL-E</Tag>
          <Title>Cuando las palabras se vuelven imágenes</Title>
          <Body>DALL-E crea imágenes desde texto. La receta de un buen prompt de imagen:</Body>
          <Body><B>Estilo</B> (anime, realista...) + <B>Sujeto</B> (qué o quién) + <B>Ambiente</B> (dónde) + <B>Emoción</B> (cómo se siente). Solo funciona con GPT-4o.</Body>
        </>
      );

      case 9: return (
        <>
          <Tag>🆕 Módulo 9 · Constructor de Imagen</Tag>
          <Title>Construye tu prompt para DALL-E</Title>
          <Body>Elige una opción de cada categoría y arma tu prompt.</Body>
          {(Object.keys(IMG_OPTIONS) as (keyof typeof IMG_OPTIONS)[]).map(key => (
            <View key={key} style={{ marginBottom: 10 }}>
              <Text style={styles.selectorLabel}>{key.toUpperCase()}</Text>
              <View style={styles.selectorRow}>
                {IMG_OPTIONS[key].map((opt, i) => (
                  <TouchableOpacity key={i} style={[styles.optChip, imgState[key] === opt && styles.optChipOn]} onPress={() => setImgState(p => ({ ...p, [key]: opt }))}>
                    <Text style={[styles.optChipText, imgState[key] === opt && { color: C.okText, fontWeight: '700' }]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
          <View style={styles.imgOutput}>
            <Text style={styles.imgOutputLabel}>Tu prompt para DALL-E</Text>
            {imgComplete ? <Text style={styles.imgOutputText}>{imgPrompt}</Text> : <Text style={[styles.imgOutputText, { color: C.placeholder, fontStyle: 'italic' }]}>Selecciona las 4 opciones para ver el prompt completo.</Text>}
          </View>
        </>
      );

      case 10: return (
        <>
          <Tag>↕️ Módulo 10 · Ordena</Tag>
          <Title>El orden perfecto para estudiar</Title>
          <Body>Ordena los pasos de una sesión de estudio con ChatGPT, del primero al último.</Body>
          {sortOrder.map((origIdx, pos) => (
            <View key={pos} style={[styles.sortRow, sortWrong.has(pos) && styles.sortRowWrong, sortSolved && styles.sortRowOk]}>
              <Text style={styles.sortNum}>{pos + 1}</Text>
              <Text style={styles.sortText}>{SORT_SESION[origIdx]}</Text>
              <View style={styles.sortArrows}>
                <TouchableOpacity onPress={() => moveSort(pos, -1)} disabled={pos === 0 || sortSolved}><Text style={[styles.sortArrow, (pos === 0 || sortSolved) && { opacity: 0.25 }]}>▲</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => moveSort(pos, 1)} disabled={pos === sortOrder.length - 1 || sortSolved}><Text style={[styles.sortArrow, (pos === sortOrder.length - 1 || sortSolved) && { opacity: 0.25 }]}>▼</Text></TouchableOpacity>
              </View>
            </View>
          ))}
          {sortSolved && <Fb ok>✅ ¡Ese es el orden perfecto para estudiar con ChatGPT!</Fb>}
          {!sortSolved && sortWrong.size > 0 && <Fb ok={false}>❌ Los pasos en rojo no están en orden. Piensa qué necesitas hacer primero.</Fb>}
        </>
      );

      case 11: return (
        <>
          <Tag>📖 Módulo 11 · Estudiar con ChatGPT</Tag>
          <Title>5 formas que sí funcionan</Title>
          <Body><B>1.</B> Pide preguntas, no respuestas.{'\n'}<B>2.</B> Dale una identidad divertida (Truco 4).{'\n'}<B>3.</B> Pide que explique tus errores.{'\n'}<B>4.</B> Pide ejemplos de tu país.{'\n'}<B>5.</B> Pide un resumen al final.</Body>
        </>
      );

      case 12: return (
        <>
          <Tag>✅ Módulo 12 · Verdadero o Falso</Tag>
          <Title>¿Mito o verdad?</Title>
          {tfItems.map((item, i) => (
            <View key={i} style={styles.vfItem}>
              <Text style={styles.qText}>{item.stmt}</Text>
              <View style={styles.row}>
                <TouchableOpacity style={[styles.tfBtn, vfAns[i] === true && !vfChecked && styles.tfSel, vfChecked && item.correct && styles.optCorrect, vfChecked && vfAns[i] === true && !item.correct && styles.optWrong]} disabled={vfChecked} onPress={() => setVfAns(p => ({ ...p, [i]: true }))}><Text style={styles.tfText}>✅ Verdad</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.tfBtn, vfAns[i] === false && !vfChecked && styles.tfSel, vfChecked && !item.correct && styles.optCorrect, vfChecked && vfAns[i] === false && item.correct && styles.optWrong]} disabled={vfChecked} onPress={() => setVfAns(p => ({ ...p, [i]: false }))}><Text style={styles.tfText}>❌ Mito</Text></TouchableOpacity>
              </View>
              {vfChecked && <Fb ok={vfAns[i] === item.correct}>{vfAns[i] === item.correct ? '✅ ' : '❌ '}{item.explain}</Fb>}
            </View>
          ))}
          {vfChecked && <Fb ok={vfScore >= 3}>{vfScore}/{tfItems.length} correctas.</Fb>}
        </>
      );

      case 13: return (
        <>
          <Tag>📖 Módulo 13 · Historia real</Tag>
          <Title>Yuki: de no saber inglés a conversarlo</Title>
          <Body>Yuki, 11 años, de Tokio, practicó 15 minutos diarios con el modo de voz de ChatGPT. En 3 meses pasó de entender el 10% a tener fluidez básica.</Body>
          <Card tint={C.greenLight}><Text style={styles.cardText}>La clave: le pidió a ChatGPT que conversara sobre videojuegos (algo que le gusta) y que corrigiera sus errores con amabilidad.</Text></Card>
        </>
      );

      case 14: return (
        <>
          <Tag>❓ Módulo 14 · Quiz</Tag>
          <Title>Demuestra lo que sabes</Title>
          {quizItems.map((q, i) => (
            <View key={i} style={styles.vfItem}>
              <Text style={styles.qText}>{i + 1}. {q.q}</Text>
              {q.opts.map((o, j) => (
                <TouchableOpacity key={j} style={[styles.quizOpt, quizAns[i] === j && !quizChecked && styles.quizOptOn, quizChecked && j === q.correct && styles.optCorrect, quizChecked && quizAns[i] === j && j !== q.correct && styles.optWrong]} disabled={quizChecked} onPress={() => setQuizAns(p => ({ ...p, [i]: j }))}>
                  <Text style={[styles.quizOptText, quizChecked && j === q.correct && { color: C.okText }, quizChecked && quizAns[i] === j && j !== q.correct && { color: C.failText }]}>{['🅐', '🅑', '🅒', '🅓'][j]} {o}</Text>
                </TouchableOpacity>
              ))}
              {quizChecked && <Fb ok={quizAns[i] === q.correct}>{quizAns[i] === q.correct ? '✅ ' : '❌ '}{q.explain}</Fb>}
            </View>
          ))}
          {quizChecked && <Fb ok={quizScore >= 3}>{quizScore}/{quizItems.length} correctas.</Fb>}
        </>
      );

      case 15: return (
        <>
          <Tag>📖 Módulo 15 · Límites</Tag>
          <Title>Cuándo NO usar ChatGPT</Title>
          <Body>ChatGPT es genial, pero no sirve para todo. Evítalo para:</Body>
          <Body><B>📰</B> Noticias de hoy o resultados de ayer.{'\n'}<B>🏥</B> Emergencias médicas o de seguridad.{'\n'}<B>🔢</B> Cálculos muy precisos (puede equivocarse).{'\n'}<B>📍</B> Información local en tiempo real.</Body>
        </>
      );

      case 16: {
        const item = ethicsItems[ethQ];
        return (
          <>
            <Tag>⚖️ Módulo 16 · ¿Está bien?</Tag>
            <Title>¿Está bien o mal usar ChatGPT así?</Title>
            {!ethDone ? (
              <>
                <Text style={styles.progressNote}>Situación {ethQ + 1} de {ethicsItems.length}</Text>
                <View style={styles.scenarioBox}><Text style={styles.scenarioText}>{item.scenario}</Text></View>
                <View style={styles.ethRow}>
                  {([['safe', '✅ OK', 'Buen uso'], ['doubt', '🤔 Cuidado', 'Depende'], ['bad', '⛔ Mal', 'No hacerlo']] as const).map(([v, t, s]) => {
                    const isCorrect = ethSel !== null && v === item.correct;
                    const isWrong = ethSel === v && v !== item.correct;
                    return (
                      <TouchableOpacity key={v} style={[styles.ethBtn, isCorrect && styles.optCorrect, isWrong && styles.optWrong]} disabled={ethSel !== null} onPress={() => answerEth(v)}>
                        <Text style={styles.ethBtnText}>{t}</Text>
                        <Text style={styles.ethBtnSub}>{s}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {ethSel !== null && <Fb ok={ethSel === item.correct}>{ethSel === item.correct ? '✅ ¡Correcto! ' : '❌ '}{item.explain}</Fb>}
              </>
            ) : <Fb ok>⚖️ Completado: {ethCorrect}/{ethicsItems.length} correctas. Usar ChatGPT para aprender = ✅; para hacer trampa o decisiones de seguridad = ⛔.</Fb>}
          </>
        );
      }

      case 17: return (
        <>
          <Tag>📄 Módulo 17 · Completa</Tag>
          <Title>Completa la frase</Title>
          {fillItems.map((item, qi) => {
            const ans = fillAns[qi];
            return (
              <View key={qi} style={styles.vfItem}>
                <Text style={styles.fillSentence}>{item.before}<Text style={styles.fillBlank}>{ans !== undefined ? item.opts[ans] : '_____'}</Text>{item.after}</Text>
                <View style={styles.optWrap}>
                  {item.opts.map((opt, oi) => (
                    <TouchableOpacity key={oi} style={[styles.fillOpt, ans !== undefined && oi === item.correct && styles.optCorrect, ans === oi && oi !== item.correct && styles.optWrong]} disabled={ans !== undefined} onPress={() => selectFill(qi, oi)}>
                      <Text style={[styles.fillOptText, ans !== undefined && oi === item.correct && { color: C.okText }, ans === oi && oi !== item.correct && { color: C.failText }]}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {ans !== undefined && <Fb ok={ans === item.correct}>{ans === item.correct ? '✅ ' : '❌ '}{item.explain}</Fb>}
              </View>
            );
          })}
        </>
      );

      case 18: {
        const item = sprintItems[sprintIdx];
        return (
          <>
            <Tag>⚡ Módulo 18 · Sprint</Tag>
            <Title>Sprint de mitos y verdades</Title>
            {sprintPhase === 'idle' && (
              <>
                <Body>¡Contra el reloj! 60 segundos para responder verdad/mito lo más rápido posible. +XP según cuántas aciertes.</Body>
                <View style={styles.sprintBox}><Text style={styles.timerText}>1:00</Text></View>
                <TouchableOpacity style={styles.btn} onPress={() => { sprintScoreRef.current = 0; setSprintScore(0); setSprintIdx(0); setSprintAns(null); setSprintSec(SPRINT_DURATION); setSprintPhase('running'); }}>
                  <Text style={styles.btnText}>▶ ¡Empezar Sprint!</Text>
                </TouchableOpacity>
              </>
            )}
            {sprintPhase === 'running' && item && (
              <>
                <View style={styles.sprintBox}>
                  <Text style={[styles.timerText, sprintSec <= 10 && { color: C.failBorder }, sprintSec <= 20 && sprintSec > 10 && { color: C.amber }]}>0:{String(Math.max(0, sprintSec)).padStart(2, '0')}</Text>
                  <Text style={styles.sprintScore}>{sprintScore} correctas · {sprintIdx}/{sprintItems.length}</Text>
                </View>
                <View style={styles.sprintQ}><Text style={styles.sprintQText}>{item.stmt}</Text></View>
                <View style={styles.row}>
                  <TouchableOpacity style={[styles.tfBtn, sprintAns === true && (item.correct ? styles.optCorrect : styles.optWrong)]} disabled={sprintAns !== null} onPress={() => answerSprint(true)}><Text style={styles.tfText}>✅ Verdad</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.tfBtn, sprintAns === false && (!item.correct ? styles.optCorrect : styles.optWrong)]} disabled={sprintAns !== null} onPress={() => answerSprint(false)}><Text style={styles.tfText}>❌ Mito</Text></TouchableOpacity>
                </View>
              </>
            )}
            {sprintPhase === 'done' && (
              <Fb ok={sprintScore >= 8}>{sprintScore >= 8 ? '🏆' : sprintScore >= 5 ? '⭐' : '💪'} {sprintScore} de {sprintItems.length} correctas. ¡Bien hecho!</Fb>
            )}
          </>
        );
      }

      case 19: {
        const s = sesSteps[sesQ];
        return (
          <>
            <Tag>🆕 Módulo 19 · Mi sesión perfecta</Tag>
            <Title>Diseña tu sesión perfecta</Title>
            {!sesDone ? (
              <>
                <Text style={styles.subtitle}>Eres Kai, 10 años, con un examen de geografía en 3 días. ¡Toma las mejores decisiones!</Text>
                <Card tint={C.greenLight}><Text style={styles.sesLabel}>{s.label}</Text><Text style={styles.sesQ}>{s.q}</Text></Card>
                {s.opts.map((o, i) => {
                  const isCorrect = sesSel !== null && i === s.correct;
                  const isWrong = sesSel === i && i !== s.correct;
                  return (
                    <TouchableOpacity key={i} style={[styles.sesOpt, isCorrect && styles.optCorrect, isWrong && styles.optWrong]} disabled={sesSel !== null} onPress={() => answerSes(i)}>
                      <Text style={[styles.sesOptText, isCorrect && { color: C.okText }, isWrong && { color: C.failText }]}>{o}</Text>
                    </TouchableOpacity>
                  );
                })}
                {sesSel !== null && <Fb ok={sesSel === s.correct}>{sesSel === s.correct ? '✅ ' : '❌ '}{sesSel === s.correct ? s.fb_ok : s.fb_no}</Fb>}
              </>
            ) : (
              <>
                <Card tint={C.greenLight}><Text style={styles.cardText}><B>{sesCorrect} de {sesSteps.length} decisiones perfectas.</B></Text></Card>
                <Card tint="#f7fee7"><Text style={styles.cardText}>La sesión perfecta tiene 4 fases: 1) dar contexto completo → 2) usar trucos para hacerla divertida → 3) practicar con preguntas (no respuestas) → 4) cerrar con resumen y plan del día siguiente. ¡Kai pasó su examen con excelente!</Text></Card>
              </>
            )}
          </>
        );
      }

      case 20: return (
        <>
          <Tag>💬 Módulo 20 · Reflexión</Tag>
          <Title>¿Para qué lo vas a usar tú?</Title>
          <Body>De los 5 superpoderes de ChatGPT, ¿cuál te parece más útil? ¿Cómo lo usarías esta semana en algo real (estudiar, un idioma, un proyecto)?</Body>
          <TextInput style={styles.textArea} placeholder="Escribe tu reflexión: qué superpoder usarías y para qué..." placeholderTextColor={C.placeholder} value={reflectText} onChangeText={t => { setReflectText(t); setReflectError(null); }} multiline editable={!reflectDone} />
          {reflectError && <Fb ok={false}>{reflectError}</Fb>}
          {reflectDone && <Fb ok>💬 ¡Buena reflexión! Ese es exactamente el tipo de uso que te convierte en un experto de ChatGPT.</Fb>}
        </>
      );

      case 21: return (
        <View style={styles.completeScreen}>
          <View style={styles.completeIcon}><Text style={styles.iconEmoji}>💬</Text></View>
          <Text style={styles.completeTitle}>¡Nivel 19 completado!</Text>
          <Text style={styles.completeBadge}>🏅 Experto en ChatGPT</Text>
          <Text style={styles.completeSub}>Terminaste "ChatGPT: tu compañero de aventuras". Conoces sus 5 superpoderes y sabes usarlo de forma inteligente.</Text>
          <Text style={styles.xpGained}>+<Text style={{ color: C.green }}>{xp}</Text> XP</Text>
          <View style={styles.skillsBox}>
            {['Conozco los 5 superpoderes: imágenes, voz, GPTs, archivos y código', 'Sé cuándo usar GPT-3.5 y cuándo necesito GPT-4o', 'Puedo crear prompts detallados para DALL-E', 'Uso ChatGPT para estudiar sin hacer trampa', 'Detecto alucinaciones y sé cuándo verificar', 'Sé cuándo ChatGPT NO es la herramienta correcta'].map((s, i, arr) => (
              <View key={i} style={[styles.skillRow, i === arr.length - 1 && { marginBottom: 0 }]}>
                <Text style={styles.skillCheck}>✓</Text><Text style={styles.skillText}>{s}</Text>
              </View>
            ))}
          </View>
          <View style={styles.nextBox}>
            <Text style={styles.nextText}>🌟 <B>Nivel 20: Claude, el LLM honesto</B>{'\n\n'}Claude fue creado por Anthropic con una misión: ser honesto y seguro. Superpoderes únicos para análisis profundos y conversaciones largas.</Text>
          </View>
          <TouchableOpacity style={[styles.btn, { width: '100%' }]} onPress={finish}><Text style={styles.btnText}>Siguiente nivel →</Text></TouchableOpacity>
        </View>
      );

      default: return null;
    }
  };

  // ---------- Botón principal ----------
  const getBtn = (): { label: string; enabled: boolean; note?: string; onPress: () => void } | null => {
    switch (step) {
      case 0: return { label: '¡Vamos! 🚀', enabled: true, onPress: next };
      case 1: case 2: case 4: case 6: case 8: case 11: case 13: case 15:
        return { label: 'Continuar →', enabled: true, onPress: () => next() };
      case 3: return detDone ? { label: 'Continuar →', enabled: true, onPress: next } : { label: 'Elige una respuesta', enabled: false, note: 'Toca la que creas que es GPT-4o', onPress: () => {} };
      case 5:
        if (!ddChecked || (!ddSolved && !ddAllCorrect)) return { label: 'Verificar →', enabled: ddAllPlaced || devMode, note: `Clasifica las ${dragItems.length} tareas · +20 XP`, onPress: verifyDd };
        return { label: 'Continuar →', enabled: true, onPress: next };
      case 7: return { label: 'Continuar →', enabled: matched.size === matchPairs.length || devMode, note: matched.size < matchPairs.length ? `Conecta los ${matchPairs.length} pares · +20 XP` : undefined, onPress: next };
      case 9: return { label: 'Continuar →', enabled: imgComplete || devMode, note: imgComplete ? undefined : 'Elige las 4 opciones · +12 XP', onPress: () => { awardStep(12); next(); } };
      case 10: return sortSolved ? { label: 'Continuar →', enabled: true, onPress: next } : { label: 'Verificar orden →', enabled: true, note: 'Ordena del primer paso al último · +15 XP', onPress: checkSort };
      case 12: return quizVfBtn(vfChecked, Object.keys(vfAns).length === tfItems.length, checkVF, next, 'Comprobar →', 'Responde las 5 · hasta +25 XP');
      case 14: return quizVfBtn(quizChecked, Object.keys(quizAns).length === quizItems.length, checkQuiz, next, 'Comprobar respuestas →', 'Responde las 5 · hasta +40 XP');
      case 16: return ethDone ? { label: 'Continuar →', enabled: true, onPress: next } : { label: 'Elige una opción', enabled: false, note: 'Decide si el uso es OK, con cuidado o mal', onPress: () => {} };
      case 17: return { label: 'Continuar →', enabled: Object.keys(fillAns).length === fillItems.length || devMode, note: `Completa las ${fillItems.length} frases · +7 XP c/u`, onPress: next };
      case 18: return sprintPhase === 'done' ? { label: 'Continuar →', enabled: true, onPress: next } : { label: 'Continuar →', enabled: devMode, note: sprintPhase === 'idle' ? 'Pulsa "¡Empezar Sprint!"' : 'Responde hasta que acabe el tiempo', onPress: next };
      case 19: return sesDone ? { label: 'Completar nivel →', enabled: true, onPress: next } : { label: 'Elige la opción', enabled: false, note: 'Toma la mejor decisión de estudio', onPress: () => {} };
      case 20:
        if (!reflectDone) return { label: 'Enviar reflexión →', enabled: reflectText.trim().length >= 40 || devMode, note: 'Escribe al menos 40 caracteres · +15 XP', onPress: submitReflect };
        return { label: 'Ver resumen →', enabled: true, onPress: next };
      case 21: return null;
      default: return null;
    }
  };
  function quizVfBtn(checked: boolean, allAns: boolean, check: () => void, adv: () => void, label: string, note: string) {
    if (checked) return { label: 'Continuar →', enabled: true, onPress: adv };
    return { label, enabled: allAns || devMode, note: allAns ? undefined : note, onPress: check };
  }

  const btn = getBtn();
  const progress = Math.round((step / (TOTAL_STEPS - 1)) * 100);
  const progLabel = step === 0 ? 'Introducción' : step < TOTAL_STEPS - 1 ? `Módulo ${step} de ${CONTENT_STEPS}` : '¡Nivel completado!';

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => exitLevel()} style={styles.closeBtn}><Text style={styles.closeBtnText}>✕</Text></TouchableOpacity>
        <View style={styles.progWrap}>
          <View style={styles.progTrack}><View style={[styles.progFill, { width: `${progress}%` }]} /></View>
          <Text style={styles.progLabel}>{progLabel}</Text>
        </View>
        <View style={styles.xpChip}><Text style={styles.xpChipText}>{xp} XP</Text></View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container}>
        <View style={styles.moduleCard}>{renderStep()}</View>
      </ScrollView>

      {btn && (
        <View style={styles.btnRow}>
          <View style={styles.btnRowInner}>
            {showBack && <TouchableOpacity style={styles.backBtn} onPress={prev}><Text style={styles.backBtnText}>← Volver</Text></TouchableOpacity>}
            <TouchableOpacity style={[styles.mainBtn, { flex: 1 }, !btn.enabled && styles.mainBtnDisabled]} onPress={btn.onPress} disabled={!btn.enabled}>
              <Text style={styles.btnText}>{btn.label}</Text>
            </TouchableOpacity>
          </View>
          {btn.note ? <Text style={styles.btnNote}>{btn.note}</Text> : null}
        </View>
      )}

      {xpToast && <XPToast key={xpToast.id} amount={xpToast.amount} onHide={() => setXpToast(null)} bgColor={C.green} textColor="#fff" />}
    </View>
  );
}

// ===================== ESTILOS (tema claro verde M4) =====================
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13, paddingTop: 11, paddingBottom: 9, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.greenBorder },
  closeBtn: { minWidth: 42, minHeight: 42, borderRadius: 10, backgroundColor: C.greenLight, borderWidth: 1, borderColor: C.greenBorder, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 12, color: C.okText, fontWeight: '800' },
  progWrap: { flex: 1 },
  progTrack: { height: 8, backgroundColor: C.greenLight, borderRadius: 4, overflow: 'hidden' },
  progFill: { height: '100%', borderRadius: 4, backgroundColor: C.green },
  progLabel: { fontSize: 10, color: C.placeholder, marginTop: 3, fontWeight: '500' },
  xpChip: { paddingHorizontal: 11, paddingVertical: 4, borderRadius: 12, backgroundColor: C.amberBg, borderWidth: 1, borderColor: '#fcd34d' },
  xpChipText: { fontSize: 12, color: C.amberText, fontWeight: '700' },

  container: { padding: 14, paddingBottom: 24 },
  moduleCard: { backgroundColor: C.card, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: C.border },

  tag: { alignSelf: 'flex-start', backgroundColor: C.greenLight, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 12 },
  tagText: { fontSize: 10, fontWeight: '700', color: C.okText, textTransform: 'uppercase', letterSpacing: 0.4 },
  iconCircle: { width: 66, height: 66, borderRadius: 20, backgroundColor: C.greenLight, justifyContent: 'center', alignItems: 'center', marginBottom: 12, alignSelf: 'center' },
  iconEmoji: { fontSize: 34 },
  title: { ...typography.extraBold, fontSize: 19, color: C.text, marginBottom: 8, lineHeight: 25 },
  subtitle: { ...typography.regular, fontSize: 13, color: C.muted, marginBottom: 13, lineHeight: 20 },
  body: { ...typography.regular, fontSize: 14, color: '#334155', lineHeight: 23, marginBottom: 11 },
  bold: { fontWeight: '700', color: C.text },
  infoCard: { backgroundColor: C.card2, borderRadius: 14, padding: 13, marginBottom: 9, borderWidth: 1, borderColor: C.border },
  cardTitle: { ...typography.bold, fontSize: 13, color: C.text, marginBottom: 3 },
  cardText: { ...typography.regular, fontSize: 12.5, color: '#334155', lineHeight: 18 },

  progressNote: { fontSize: 11, color: C.muted, textAlign: 'center', marginBottom: 8, fontWeight: '500' },
  scenarioBox: { backgroundColor: C.amberBg, borderRadius: 12, padding: 13, marginBottom: 11, borderWidth: 1, borderColor: '#fde68a' },
  scenarioLabel: { fontSize: 9, fontWeight: '700', color: C.amberText, letterSpacing: 0.6, marginBottom: 6, textTransform: 'uppercase' },
  scenarioText: { fontSize: 12.5, color: '#334155', lineHeight: 20, fontWeight: '500' },

  // Feedback
  fb: { marginTop: 8, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  fbOk: { backgroundColor: C.okBg, borderColor: C.greenBorder },
  fbFail: { backgroundColor: C.failBg, borderColor: '#fecdd3' },
  fbText: { fontSize: 12, lineHeight: 18, fontWeight: '500' },

  optCorrect: { borderColor: C.okBorder, backgroundColor: C.okBg },
  optWrong: { borderColor: C.failBorder, backgroundColor: C.failBg },

  // Detective
  detCard: { borderRadius: 12, padding: 12, borderWidth: 2, borderColor: C.border, marginBottom: 8, backgroundColor: C.card },
  detLabel: { fontSize: 10, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  detText: { fontSize: 12, color: '#334155', lineHeight: 18 },
  detHint: { fontSize: 10.5, color: C.placeholder, fontStyle: 'italic', marginTop: 6 },

  // Compare
  compareRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  comparePanel: { flex: 1, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border },
  compareLabel: { fontSize: 11, fontWeight: '700', color: C.muted, marginBottom: 6, textTransform: 'uppercase' },
  compareText: { fontSize: 11.5, color: '#334155', lineHeight: 17 },

  // Chips / drag
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 10, backgroundColor: C.card2, borderRadius: 12, borderWidth: 1, borderColor: C.border, marginBottom: 10, minHeight: 52, alignItems: 'center' },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1.5, borderColor: '#cbd5e1', backgroundColor: C.card },
  chipOn: { borderColor: C.green, backgroundColor: C.greenLight },
  chipText: { fontSize: 11, color: '#334155', lineHeight: 15 },
  dropRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  dropZone: { flex: 1, borderWidth: 2, borderStyle: 'dashed', borderColor: '#cbd5e1', borderRadius: 12, padding: 8, minHeight: 100, backgroundColor: '#fafafa' },
  dropZoneOver: { borderColor: C.green, backgroundColor: C.greenLight },
  dropHeader: { fontSize: 11, fontWeight: '700', textAlign: 'center', marginBottom: 6, color: C.text },
  dropChip: { backgroundColor: C.greenLight, borderRadius: 10, paddingVertical: 5, paddingHorizontal: 8, marginBottom: 4 },
  dropChipOk: { backgroundColor: C.okBg },
  dropChipBad: { backgroundColor: C.failBg },
  dropChipText: { fontSize: 10.5, color: C.okText, lineHeight: 14 },

  // Match
  matchRow: { flexDirection: 'row', gap: 8 },
  matchCol: { flex: 1, gap: 6 },
  matchCard: { backgroundColor: C.card, padding: 10, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, minHeight: 58, justifyContent: 'center' },
  matchCardSel: { borderColor: C.green, backgroundColor: C.greenLight },
  matchCardDone: { borderColor: C.okBorder, backgroundColor: C.okBg },
  matchCardWrong: { borderColor: C.failBorder, backgroundColor: C.failBg },
  matchText: { fontSize: 11, color: '#334155', textAlign: 'center', lineHeight: 15 },

  // Img builder
  selectorLabel: { fontSize: 10, fontWeight: '700', color: C.okText, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 },
  selectorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  optChip: { paddingVertical: 7, paddingHorizontal: 10, borderRadius: 9, borderWidth: 1.5, borderColor: C.greenBorder, backgroundColor: C.card },
  optChipOn: { borderColor: C.green, backgroundColor: C.greenLight },
  optChipText: { fontSize: 10.5, color: '#334155' },
  imgOutput: { backgroundColor: C.card, borderWidth: 2, borderColor: C.greenBorder, borderRadius: 12, padding: 12, marginTop: 6 },
  imgOutputLabel: { fontSize: 9, fontWeight: '700', color: C.green, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 7 },
  imgOutputText: { fontSize: 12, color: '#334155', lineHeight: 20, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },

  // Sort
  sortRow: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: C.card2, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, marginBottom: 6 },
  sortRowWrong: { borderColor: C.failBorder, backgroundColor: C.failBg },
  sortRowOk: { borderColor: C.greenBorder, backgroundColor: C.okBg },
  sortNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: C.green, color: '#fff', textAlign: 'center', lineHeight: 26, fontWeight: '800', fontSize: 11, marginRight: 9, overflow: 'hidden' },
  sortText: { flex: 1, fontSize: 11.5, color: '#334155', lineHeight: 16 },
  sortArrows: { flexDirection: 'column', marginLeft: 8 },
  sortArrow: { fontSize: 13, color: C.green, paddingVertical: 2, paddingHorizontal: 5 },

  // VF / Quiz / Sprint
  vfItem: { marginBottom: 14 },
  qText: { fontSize: 12.5, fontWeight: '700', color: C.text, lineHeight: 18, padding: 11, backgroundColor: C.card2, borderRadius: 10, borderWidth: 1, borderColor: C.border, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8 },
  tfBtn: { flex: 1, paddingVertical: 12, borderRadius: 11, borderWidth: 2, borderColor: C.border, alignItems: 'center', backgroundColor: C.card },
  tfSel: { borderColor: C.green, backgroundColor: C.greenLight },
  tfText: { fontSize: 13, fontWeight: '700', color: C.text },
  quizOpt: { paddingVertical: 11, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, marginBottom: 6, backgroundColor: C.card },
  quizOptOn: { borderColor: C.green, backgroundColor: C.greenLight },
  quizOptText: { fontSize: 12, color: '#334155', lineHeight: 17 },

  // Fill
  fillSentence: { fontSize: 13, color: '#334155', lineHeight: 24, padding: 11, backgroundColor: C.greenLight, borderRadius: 10, borderWidth: 1, borderColor: C.greenBorder, marginBottom: 8 },
  fillBlank: { fontWeight: '800', color: C.okText },
  optWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  fillOpt: { paddingVertical: 8, paddingHorizontal: 13, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.card },
  fillOptText: { fontSize: 12, fontWeight: '600', color: '#334155' },

  // Ethics
  ethRow: { flexDirection: 'row', gap: 6 },
  ethBtn: { flex: 1, paddingVertical: 11, paddingHorizontal: 4, borderRadius: 11, borderWidth: 2, borderColor: C.border, alignItems: 'center', backgroundColor: C.card },
  ethBtnText: { fontSize: 11, fontWeight: '700', color: C.text, textAlign: 'center' },
  ethBtnSub: { fontSize: 9, color: C.muted, marginTop: 2 },

  // Sprint
  sprintBox: { alignItems: 'center', backgroundColor: C.card2, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  timerText: { fontSize: 40, fontWeight: '800', color: C.green, fontVariant: ['tabular-nums'] },
  sprintScore: { fontSize: 12, color: C.muted, marginTop: 4 },
  sprintQ: { backgroundColor: C.card2, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border, marginBottom: 8, minHeight: 52, justifyContent: 'center' },
  sprintQText: { fontSize: 13, fontWeight: '700', color: C.text, lineHeight: 18 },

  // Sesión
  sesLabel: { fontSize: 10, fontWeight: '700', color: C.okText, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 },
  sesQ: { fontSize: 12.5, fontWeight: '600', color: '#334155', lineHeight: 18 },
  sesOpt: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, marginBottom: 6, backgroundColor: C.card },
  sesOptText: { fontSize: 11.5, color: '#334155', lineHeight: 16 },

  // Reflexión
  textArea: { backgroundColor: C.card2, borderWidth: 2, borderColor: C.greenBorder, borderRadius: 12, padding: 13, fontSize: 14, lineHeight: 21, color: C.text, minHeight: 110, marginVertical: 8, textAlignVertical: 'top' },

  // Botones
  btn: { backgroundColor: C.green, padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  btnText: { ...typography.bold, color: '#fff', fontSize: 14 },

  // Completado
  completeScreen: { alignItems: 'center', paddingVertical: 8 },
  completeIcon: { width: 84, height: 84, borderRadius: 24, backgroundColor: '#86efac', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  completeTitle: { ...typography.extraBold, fontSize: 22, color: C.text, textAlign: 'center', marginBottom: 4 },
  completeBadge: { ...typography.extraBold, fontSize: 17, color: C.green, marginBottom: 8 },
  completeSub: { ...typography.regular, fontSize: 13, color: C.muted, textAlign: 'center', marginBottom: 14, lineHeight: 20 },
  xpGained: { ...typography.extraBold, fontSize: 30, color: C.text, marginBottom: 14 },
  skillsBox: { width: '100%', backgroundColor: C.greenLight, borderRadius: 12, padding: 13, borderWidth: 1, borderColor: C.greenBorder, marginBottom: 12 },
  skillRow: { flexDirection: 'row', gap: 8, marginBottom: 7 },
  skillCheck: { color: C.green, fontWeight: '800', fontSize: 13 },
  skillText: { flex: 1, fontSize: 11.5, color: C.okText, lineHeight: 17, fontWeight: '500' },
  nextBox: { width: '100%', backgroundColor: C.card2, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border, marginBottom: 14 },
  nextText: { fontSize: 12, color: '#334155', lineHeight: 19 },

  btnRow: { paddingHorizontal: 13, paddingVertical: 11, borderTopWidth: 1, borderTopColor: C.greenBorder, backgroundColor: C.card },
  btnRowInner: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  backBtn: { paddingHorizontal: 16, paddingVertical: 13, borderRadius: 12, backgroundColor: C.card2, borderWidth: 1.5, borderColor: C.border, minHeight: 48, justifyContent: 'center' },
  backBtnText: { fontSize: 14, fontWeight: '700', color: C.muted },
  mainBtn: { padding: 13, borderRadius: 12, backgroundColor: C.green, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  mainBtnDisabled: { opacity: 0.35 },
  btnNote: { fontSize: 11, color: C.placeholder, textAlign: 'center', marginTop: 5, minHeight: 15 },
});
