import { exitLevel } from '../utils/exitLevel';
import { router } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, BackHandler, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useGameStore } from '../store/gameStore';
import { useReportProgress } from '../components/LevelProgress';
import { typography } from '../theme';
import XPToast from '../components/XPToast';
import { pickN, shuffle } from '../utils/shuffle';

// ---------- Tipos ----------
type TFItem = { stmt: string; correct: boolean; explain: string };
type DragItem = { text: string; correct: string };
type MatchPair = { left: string; right: string };
type QuizItem = { q: string; opts: string[]; correct: number; explain: string };
type HallPart = { text: string; idx: number | null };
type HallCase = { intro: string; parts: HallPart[]; correct: number; explain: string };
type SprintItem = { stmt: string; correct: boolean };

// ---------- Pools (fuente: nivel-08.html) ----------
const TEMP_POOL: DragItem[] = [
  { text: 'Escríbeme un poema sobre el mar', correct: 'hot' },
  { text: '¿Cuántos continentes hay en la Tierra?', correct: 'cold' },
  { text: 'Invéntate una historia de ciencia ficción', correct: 'hot' },
  { text: '¿Cuánto es 1,847 × 23?', correct: 'cold' },
  { text: 'Dame 5 ideas creativas para mi proyecto', correct: 'hot' },
  { text: 'Explícame la ley de gravedad paso a paso', correct: 'cold' },
  { text: 'Crea un personaje ficticio para mi novela', correct: 'hot' },
  { text: '¿Cuál es la capital de Australia?', correct: 'cold' },
];

const CONTEXT_TF_POOL: TFItem[] = [
  { stmt: 'Si le cierras la conversación a un LLM y abres una nueva, recuerda lo que hablaron antes.', correct: false, explain: 'No — los LLMs no tienen memoria entre sesiones. Cada conversación nueva empieza desde cero. Por eso a veces tienes que repetir contexto al inicio.' },
  { stmt: 'La "ventana de contexto" define cuánto texto puede "ver" el LLM en una sola conversación.', correct: true, explain: 'Exacto. Si superas ese límite (en tokens), el modelo empieza a olvidar el inicio de la conversación. Los modelos modernos tienen ventanas de 100,000+ tokens.' },
  { stmt: 'Si le das más contexto en tu prompt, un LLM siempre da mejores respuestas.', correct: true, explain: 'Generalmente sí. Más contexto relevante = mejor respuesta. Por eso los prompts con rol, objetivo y formato específico funcionan mejor que los vagos.' },
  { stmt: 'Los LLMs pueden recordar información de otras conversaciones de otros usuarios.', correct: false, explain: 'Falso — y esto es bueno para la privacidad. Lo que tú le dices a un LLM no "contamina" las respuestas que otros usuarios reciben.' },
  { stmt: 'El "historial de conversación" que ves en la pantalla es exactamente lo que el LLM tiene en su contexto.', correct: true, explain: 'Sí. El sistema envía el historial completo con cada mensaje. Por eso las conversaciones muy largas consumen más tokens y cuestan más a los proveedores.' },
  { stmt: 'Un LLM con ventana de contexto más grande siempre es mejor que uno con ventana pequeña.', correct: false, explain: 'No necesariamente. Una ventana grande ayuda con documentos largos, pero un modelo con ventana pequeña puede ser más preciso, rápido y barato para tareas cortas.' },
  { stmt: 'Si empiezas cada conversación con un mensaje de sistema (system prompt), el LLM lo incluye en su contexto.', correct: true, explain: 'Correcto. El "system prompt" es texto oculto que los desarrolladores añaden antes de tu mensaje para darle instrucciones permanentes al modelo en esa sesión.' },
  { stmt: 'Los LLMs recuerdan todo lo que les dices indefinidamente mientras la conversación esté abierta.', correct: false, explain: 'Depende de la ventana de contexto. Si la conversación es muy larga, el modelo puede empezar a "olvidar" los mensajes más antiguos porque ya no caben en la ventana.' },
  { stmt: 'Puedes darle a un LLM información personal tuya en el prompt para que personalice mejor su respuesta.', correct: true, explain: 'Sí, y es una estrategia poderosa. Ejemplos: "Soy estudiante de 15 años en Colombia" o "Trabajo en diseño gráfico". El LLM adapta su respuesta a ese perfil.' },
  { stmt: 'Los LLMs guardan la información que les das para mejorar sus respuestas futuras en tiempo real.', correct: false, explain: 'No durante el uso normal. El modelo no aprende de tu conversación en tiempo real — su conocimiento viene de su entrenamiento previo, que ocurrió antes de que lo usaras.' },
];

const LLM_MATCH_POOL: MatchPair[] = [
  { left: 'Analizar un PDF de 300 páginas', right: 'Claude — mayor ventana de contexto' },
  { left: 'Generar una imagen desde texto', right: 'ChatGPT — integra DALL·E nativo' },
  { left: 'Buscar noticias de hoy y resumirlas', right: 'Gemini — acceso a búsqueda Google' },
  { left: 'Debatir ideas polémicas sin filtros', right: 'Grok — menos restricciones editoriales' },
  { left: 'Revisar código con análisis ético', right: 'Claude — diseñado para razonamiento seguro' },
  { left: 'Tomar notas automáticas en Google Docs', right: 'Gemini — integrado con Apps de Google' },
];

const LLM_QUIZ_POOL: QuizItem[] = [
  { q: '¿Qué es un "token" en el lenguaje de los LLMs?', opts: ['Un tipo de criptomoneda para pagar al modelo', 'Un fragmento de texto (parte de palabra, palabra completa o signo)', 'El nombre técnico de un prompt', 'La respuesta que genera el modelo'], correct: 1, explain: 'Un token es la unidad básica de texto que un LLM procesa. "Hola" es 1 token. "Hello" es 1 token. "ChatGPT" puede ser 2-3 tokens. Los modelos cobran por cantidad de tokens procesados.' },
  { q: '¿Qué pasa cuando un LLM "alucina"?', opts: ['El modelo se queda sin memoria y reinicia', 'Genera texto con errores de ortografía', 'Inventa información falsa con total confianza', 'Se niega a responder la pregunta'], correct: 2, explain: 'Alucinación = el modelo predice texto que suena plausible pero es factualmente falso. Puede inventar citas, estadísticas, nombres de personas. Siempre verifica datos importantes.' },
  { q: '¿Qué significa que un LLM tenga "temperatura alta"?', opts: ['Que procesa las respuestas más rápido', 'Que sus respuestas son más creativas y variables', 'Que usa más energía y recursos del servidor', 'Que solo responde preguntas de ciencias'], correct: 1, explain: 'Temperatura alta = más aleatoriedad y creatividad. Temperatura baja = más determinismo y precisión. Para poemas usa temperatura alta; para cálculos, temperatura baja.' },
  { q: '¿Por qué un LLM puede dar respuestas diferentes a la misma pregunta en distintas sesiones?', opts: ['Porque los servidores cambian de ubicación', 'Porque el modelo se actualiza cada hora', 'Porque la temperatura introduce variabilidad estadística', 'Porque lee páginas web distintas cada vez'], correct: 2, explain: 'La temperatura es un parámetro de aleatoriedad. Incluso con la misma pregunta, el modelo no siempre elige exactamente el mismo token siguiente — hay variación controlada.' },
  { q: '¿Qué limitación tiene un LLM sin acceso a internet?', opts: ['No puede responder en español', 'Solo puede procesar textos cortos', 'No sabe sobre eventos ocurridos después de su fecha de corte', 'No puede hacer cálculos matemáticos'], correct: 2, explain: 'Los LLMs entrenados sin acceso a internet tienen una "fecha de corte" — no saben qué pasó después de esa fecha. Para eventos recientes, usa Gemini o ChatGPT con búsqueda activada.' },
  { q: '¿Qué es la "ventana de contexto" de un LLM?', opts: ['La pantalla donde se muestra el chat', 'La cantidad máxima de tokens que el modelo puede procesar en una conversación', 'El tiempo máximo que puede durar una sesión', 'El número de idiomas que el modelo conoce'], correct: 1, explain: 'La ventana de contexto es la "memoria de trabajo" del modelo en una conversación. Si el chat supera ese límite, el modelo empieza a "olvidar" los mensajes más antiguos.' },
  { q: '¿Cuál de estas tareas es MÁS adecuada para un LLM?', opts: ['Saber el precio actual del dólar', 'Ver las noticias de hoy', 'Explicar un concepto difícil con analogías', 'Encontrar restaurantes abiertos cerca de ti'], correct: 2, explain: 'Los LLMs brillan en tareas que requieren generación, explicación y análisis de texto. Para datos en tiempo real (precios, noticias, ubicaciones), usa Google o servicios especializados.' },
  { q: '¿Qué es un "sistema de embeddings" en los LLMs?', opts: ['Un tipo de virus informático', 'Una representación matemática del significado de las palabras', 'El sistema de seguridad del servidor', 'El historial de conversaciones guardado'], correct: 1, explain: 'Los embeddings son vectores numéricos que representan el significado de palabras y frases. Permiten al modelo entender que "carro", "coche" y "automóvil" significan lo mismo.' },
  { q: '¿Por qué Claude dice "no sé" más frecuentemente que otros LLMs?', opts: ['Porque tiene menos datos de entrenamiento', 'Porque fue diseñado para priorizar honestidad sobre parecer útil', 'Porque solo funciona en inglés', 'Porque tiene la ventana de contexto más pequeña'], correct: 1, explain: 'Claude fue entrenado con énfasis en honestidad y en no inventar respuestas. Prefiere admitir incertidumbre antes que alucinar. Esto lo hace más confiable para tareas de investigación.' },
  { q: '¿Qué significa que un modelo sea "multimodal"?', opts: ['Que funciona en múltiples idiomas al mismo tiempo', 'Que puede procesar y generar diferentes tipos de datos: texto, imagen, audio', 'Que tiene múltiples versiones de pago y gratuita', 'Que funciona en varios dispositivos a la vez'], correct: 1, explain: 'Multimodal = capaz de trabajar con más de un tipo de dato. GPT-4o puede ver imágenes y escuchar audio. Gemini puede analizar videos de YouTube. Claude puede leer PDFs con imágenes.' },
];

const SESGO_POOL: DragItem[] = [
  { text: 'ChatGPT responde mejor a preguntas sobre cultura anglosajona que latinoamericana', correct: 'sesgo-datos' },
  { text: 'Un modelo entrenado solo con textos académicos usa lenguaje muy formal para todo', correct: 'sesgo-datos' },
  { text: 'Si preguntas "¿el café es malo?", el modelo tiende a confirmar que sí si ya lo dijiste', correct: 'sesgo-confirmacion' },
  { text: 'El modelo siempre está de acuerdo con lo que dices, aunque estés equivocado', correct: 'sesgo-confirmacion' },
  { text: 'Un LLM entrenado en inglés a veces malinterpreta modismos colombianos o argentinos', correct: 'sesgo-cultura' },
  { text: 'El modelo describe a doctores como hombres y enfermeras como mujeres por defecto', correct: 'sesgo-datos' },
  { text: 'Si le dices "soy experto en esto", el modelo ajusta su respuesta aunque no lo seas', correct: 'sesgo-confirmacion' },
  { text: 'El modelo no conoce expresiones como "parcero" o "chevere" con su significado local', correct: 'sesgo-cultura' },
  { text: 'El modelo usa más ejemplos de empresas de EE.UU. que de Latinoamérica', correct: 'sesgo-cultura' },
];

const SPRINT_POOL: SprintItem[] = [
  { stmt: 'Los LLMs generan texto prediciendo cuál es la siguiente palabra más probable', correct: true },
  { stmt: 'ChatGPT puede acceder a internet en tiempo real sin herramientas adicionales', correct: false },
  { stmt: 'Un token es más o menos equivalente a una palabra completa en español', correct: false },
  { stmt: 'La temperatura alta hace que el modelo sea más creativo y menos predecible', correct: true },
  { stmt: 'Claude fue creado por Google', correct: false },
  { stmt: 'Los LLMs pueden "alucinar": inventar datos falsos con total confianza', correct: true },
  { stmt: 'Gemini tiene ventaja sobre otros LLMs para tareas que requieren datos actuales', correct: true },
  { stmt: 'Si cierras una conversación y abres una nueva, el LLM recuerda lo que hablaron', correct: false },
  { stmt: 'Un modelo con mayor ventana de contexto puede procesar documentos más largos', correct: true },
  { stmt: 'Los embeddings permiten al modelo entender sinónimos y palabras relacionadas', correct: true },
  { stmt: 'Grok fue creado por Anthropic, la misma empresa de Claude', correct: false },
  { stmt: 'Dar contexto adicional en tu prompt generalmente mejora la calidad de la respuesta', correct: true },
];

const HALL_POOL: HallCase[] = [
  {
    intro: 'Le pregunté a un LLM: "¿Cuándo fue fundada Medellín?" y esto respondió:',
    parts: [
      { text: 'Medellín fue fundada el ', idx: null },
      { text: '2 de noviembre de 1616', idx: 0 },
      { text: ' por el español ', idx: null },
      { text: 'Francisco de Herrera Campuzano', idx: 1 },
      { text: '. Actualmente es la segunda ciudad más grande de Colombia con ', idx: null },
      { text: 'alrededor de 4 millones de habitantes', idx: 2 },
      { text: ' en su área metropolitana. Es reconocida mundialmente por su ', idx: null },
      { text: 'sistema de metro y metrocable', idx: 3 },
      { text: '.', idx: null },
    ],
    correct: 2,
    explain: 'El área metropolitana de Medellín tiene alrededor de 3.9 millones de habitantes, no 4 millones exactos. Pero más importante: los LLMs frecuentemente inventan estadísticas demográficas con falsa precisión. Siempre verifica números con fuentes oficiales como el DANE.',
  },
  {
    intro: 'Pregunté: "¿Qué hace GPT-4?" y el modelo dijo:',
    parts: [
      { text: 'GPT-4 es un modelo de lenguaje creado por ', idx: null },
      { text: 'OpenAI', idx: 0 },
      { text: ' lanzado en ', idx: null },
      { text: '2023', idx: 1 },
      { text: '. Puede procesar texto e imágenes. Tiene una ventana de contexto de ', idx: null },
      { text: '128,000 tokens en su versión estándar', idx: 2 },
      { text: '. Fue entrenado con ', idx: null },
      { text: 'billones de páginas de texto de internet, libros y código', idx: 3 },
      { text: '.', idx: null },
    ],
    correct: 2,
    explain: 'La ventana de contexto de GPT-4 estándar es de 8,192 tokens. La versión GPT-4-32k tiene 32,768 tokens. El dato de 128,000 tokens corresponde a GPT-4 Turbo, no al modelo estándar. ¡Los LLMs pueden mezclar versiones y dar datos incorrectos sobre sí mismos!',
  },
  {
    intro: 'Pregunté: "Dame datos sobre la IA en Latinoamérica" y respondió:',
    parts: [
      { text: 'En Latinoamérica, ', idx: null },
      { text: 'Brasil y México', idx: 0 },
      { text: ' lideran la adopción de IA empresarial. Según un informe de ', idx: null },
      { text: 'McKinsey de 2023', idx: 1 },
      { text: ', el 67% de las empresas latinoamericanas ya usan IA en sus operaciones. Colombia tiene más de ', idx: null },
      { text: '2,000 startups de tecnología', idx: 2 },
      { text: ' registradas. La región podría añadir ', idx: null },
      { text: 'USD 1 billón a su PIB', idx: 3 },
      { text: ' para 2030 gracias a la automatización.', idx: null },
    ],
    correct: 1,
    explain: 'El LLM inventó una cita específica de McKinsey con un porcentaje preciso. Los modelos frecuentemente fabrican referencias a informes reales (McKinsey, Deloitte, WEF) con estadísticas falsas. ¡Nunca cites datos de un LLM sin verificarlos en la fuente original!',
  },
  {
    intro: 'Pregunté: "¿Quién creó a Gemini?" y respondió:',
    parts: [
      { text: 'Gemini es el modelo de lenguaje de ', idx: null },
      { text: 'Google DeepMind', idx: 0 },
      { text: '. Fue lanzado en ', idx: null },
      { text: 'diciembre de 2023', idx: 1 },
      { text: ' como sucesor de ', idx: null },
      { text: 'Bard', idx: 2 },
      { text: '. Gemini Ultra, la versión más potente, ', idx: null },
      { text: 'superó a GPT-4 en todos los benchmarks de lenguaje disponibles al momento de su lanzamiento', idx: 3 },
      { text: '.', idx: null },
    ],
    correct: 3,
    explain: 'Gemini superó a GPT-4 en MUCHOS benchmarks, pero no en "todos". Afirmaciones absolutas como "superó en todos" son señales de alerta clásicas. Los LLMs tienden a exagerar o simplificar comparaciones de rendimiento entre modelos.',
  },
];

const TEMP_RESPONSES = [
  { label: '🔵 Temperatura BAJA (0.1)', color: '#f0f9ff', border: '#bae6fd', text: '"La fotosíntesis es el proceso mediante el cual las plantas convierten la luz solar en energía química. Utilizan dióxido de carbono (CO₂) y agua (H₂O) para producir glucosa y oxígeno."' },
  { label: '🟢 Temperatura MEDIA (0.5)', color: '#f0fdf4', border: '#a7f3d0', text: '"La fotosíntesis es como la cocina de las plantas — usan la luz del sol como estufa, el CO₂ del aire como ingrediente y el agua como base para preparar su propio alimento: azúcar. Como subproducto, liberan oxígeno, el que nosotros respiramos."' },
  { label: '🔴 Temperatura ALTA (1.0)', color: '#fff1f2', border: '#fecdd3', text: '"Imagina que cada hoja es una pequeña fábrica solar mágica: capta fotones como si fueran monedas de luz, los fusiona con moléculas de aire invisible y agua subterránea para alquimizar azúcar pura — mientras regala oxígeno al mundo como si fuera cambio sobrante."' },
];

const TEMP_ZONES = {
  cold: { header: '🔵 Temperatura Baja', hbg: '#dbeafe', hcolor: '#1e40af', border: '#0ea5e9', bg: '#f0f9ff', chipBg: '#dbeafe', chipColor: '#1e40af' },
  hot: { header: '🔴 Temperatura Alta', hbg: '#fee2e2', hcolor: '#991b1b', border: '#ef4444', bg: '#fff1f2', chipBg: '#fee2e2', chipColor: '#991b1b' },
} as const;

const SESGO_ZONES = {
  'sesgo-datos': { header: '🟣 Sesgo de datos', hbg: '#ede9fe', hcolor: '#5b21b6', border: '#8b5cf6', bg: '#faf5ff', chipBg: '#ede9fe', chipColor: '#5b21b6' },
  'sesgo-confirmacion': { header: '🟡 Sesgo de confirmación', hbg: '#fef3c7', hcolor: '#92400e', border: '#f59e0b', bg: '#fffbeb', chipBg: '#fef3c7', chipColor: '#92400e' },
  'sesgo-cultura': { header: '🩷 Sesgo cultural', hbg: '#fce7f3', hcolor: '#9d174d', border: '#ec4899', bg: '#fdf2f8', chipBg: '#fce7f3', chipColor: '#9d174d' },
} as const;

const TOTAL_STEPS = 20;
const CONTENT_STEPS = 18;


const estimateTokens = (text: string): number => {
  if (!text.trim()) return 0;
  const words = text.trim().split(/\s+/).filter((w) => w.length > 0);
  let tokens = 0;
  words.forEach((w) => {
    if (w.length <= 6) tokens += 1;
    else if (w.length <= 10) tokens += 2;
    else tokens += 3;
    if (/[.,!?;:]/.test(w)) tokens += 0.5;
  });
  return Math.round(tokens);
};

// ---------- Estilos-token ----------
const CARD_VARIANTS: Record<string, { bg: string; border: string }> = {
  sky: { bg: '#f0f9ff', border: '#bae6fd' },
  green: { bg: '#f0fdf4', border: '#bbf7d0' },
  amber: { bg: '#fffbeb', border: '#fde68a' },
  purple: { bg: '#faf5ff', border: '#e9d5ff' },
  pink: { bg: '#fdf2f8', border: '#fbcfe8' },
  slate: { bg: '#f8fafc', border: '#e2e8f0' },
  red: { bg: '#fff1f2', border: '#fecdd3' },
  teal: { bg: '#f0fdfa', border: '#99f6e4' },
  emerald: { bg: '#ecfdf5', border: '#a7f3d0' },
};
const HL_VARIANTS: Record<string, { border: string; bg: string; color: string }> = {
  blue: { border: '#0ea5e9', bg: '#f0f9ff', color: '#0369a1' },
  green: { border: '#10b981', bg: '#f0fdf4', color: '#065f46' },
  amber: { border: '#f59e0b', bg: '#fffbeb', color: '#92400e' },
  purple: { border: '#8b5cf6', bg: '#faf5ff', color: '#5b21b6' },
  red: { border: '#ef4444', bg: '#fff1f2', color: '#991b1b' },
  teal: { border: '#14b8a6', bg: '#f0fdfa', color: '#0f766e' },
};
const TAG_VARIANTS: Record<string, { bg: string; color: string; border?: string }> = {
  theory: { bg: '#dcfce7', color: '#166534' },
  example: { bg: '#fff7ed', color: '#9a3412' },
  activity: { bg: '#eff6ff', color: '#1e40af' },
  quiz: { bg: '#fef3c7', color: '#92400e' },
  reflect: { bg: '#f1f5f9', color: '#475569' },
  vf: { bg: '#fef9ee', color: '#92400e' },
  match: { bg: '#eef2ff', color: '#3730a3' },
  sprint: { bg: '#fef3c7', color: '#92400e' },
  new: { bg: '#ccfbf1', color: '#0f766e', border: '#5eead4' },
};

// ---------- Componentes reutilizables ----------
const B = ({ children }: { children: React.ReactNode }) => <Text style={styles.bold}>{children}</Text>;

function Tag({ variant, children }: { variant: string; children: React.ReactNode }) {
  const v = TAG_VARIANTS[variant];
  return (
    <View style={[styles.tag, { backgroundColor: v.bg }, v.border ? { borderWidth: 1, borderColor: v.border } : null]}>
      <Text style={[styles.tagText, { color: v.color }]}>{children}</Text>
    </View>
  );
}
function Hl({ variant, children }: { variant: string; children: React.ReactNode }) {
  const v = HL_VARIANTS[variant];
  return (
    <View style={[styles.hlBox, { borderLeftColor: v.border, backgroundColor: v.bg }]}>
      <Text style={[styles.hlText, { color: v.color }]}>{children}</Text>
    </View>
  );
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}
function InfoCard({ variant, iconBg, icon, title, children }: { variant: string; iconBg?: string; icon?: string; title?: string; children?: React.ReactNode }) {
  const v = CARD_VARIANTS[variant];
  return (
    <View style={[styles.card, { backgroundColor: v.bg, borderColor: v.border }]}>
      <View style={styles.cardRow}>
        {icon !== undefined && <View style={[styles.cardIcon, { backgroundColor: iconBg || '#e2e8f0' }]}><Text style={{ fontSize: 19 }}>{icon}</Text></View>}
        <View style={{ flex: 1 }}>
          {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
          {children ? <Text style={styles.cardText}>{children}</Text> : null}
        </View>
      </View>
    </View>
  );
}
function FeedbackBar({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <View style={[styles.feedbackBar, ok ? styles.fbOk : styles.fbWrong]}>
      <Text style={[styles.feedbackText, { color: ok ? '#166534' : '#991b1b' }]}>{children}</Text>
    </View>
  );
}

export default function World2Level2() {
  const completeLevel = useGameStore((s) => s.completeLevel);
  const devMode = useGameStore((s) => s.devMode);

  const [step, setStep] = useState(0);
  useReportProgress(step, TOTAL_STEPS);
  const [xp, setXp] = useState(0);
  const [xpToast, setXpToast] = useState<{ amount: number; id: number } | null>(null);

  const tempItems = useRef(pickN(TEMP_POOL, 6)).current;
  const contextTF = useRef(pickN(CONTEXT_TF_POOL, 5)).current;
  const matchPairs = useRef(pickN(LLM_MATCH_POOL, 4)).current;
  const quizItems = useRef(pickN(LLM_QUIZ_POOL, 5)).current;
  const sesgoItems = useRef(pickN(SESGO_POOL, 6)).current;
  const sprintItems = useRef(pickN(SPRINT_POOL, SPRINT_POOL.length)).current;
  const hallCase = useRef(pickN(HALL_POOL, 1)[0]).current;

  // M2 ejemplos
  const [expandedEx, setExpandedEx] = useState<number | null>(null);
  // M3 token
  const [tokenText, setTokenText] = useState('');
  // M5 slider
  const [tempSliderVal, setTempSliderVal] = useState(2);
  // M6 drag temp
  const [tempPlaced, setTempPlaced] = useState<Record<number, string>>({});
  const [tempSel, setTempSel] = useState<number | null>(null);
  const [tempOk, setTempOk] = useState(false);
  const [tempAttempts, setTempAttempts] = useState(0);
  const [tempFb, setTempFb] = useState<{ ok: boolean; msg: string } | null>(null);
  // M8 TF
  const [tfAnswers, setTfAnswers] = useState<Record<number, boolean>>({});
  const [tfChecked, setTfChecked] = useState(false);
  // M10 match
  const [matchSel, setMatchSel] = useState<number | null>(null);
  const [rightOrder] = useState(() => shuffle(matchPairs.map((p) => p.right)));
  const [matchedLeft, setMatchedLeft] = useState<Set<number>>(new Set());
  const [matchedRight, setMatchedRight] = useState<Set<number>>(new Set());
  const [matchWrong, setMatchWrong] = useState<{ l: number; r: number } | null>(null);
  const [matchFb, setMatchFb] = useState<{ ok: boolean; msg: string } | null>(null);
  // M12 hall
  const [hallSel, setHallSel] = useState<number | null>(null);
  const [hallChecked, setHallChecked] = useState(false);
  // M13 quiz
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizChecked, setQuizChecked] = useState(false);
  // M15 drag sesgo
  const [sesgoPlaced, setSesgoPlaced] = useState<Record<number, string>>({});
  const [sesgoSel, setSesgoSel] = useState<number | null>(null);
  const [sesgoOk, setSesgoOk] = useState(false);
  const [sesgoAttempts, setSesgoAttempts] = useState(0);
  const [sesgoFb, setSesgoFb] = useState<{ ok: boolean; msg: string } | null>(null);
  // M16 sprint
  const [sprintStarted, setSprintStarted] = useState(false);
  const [sprintSec, setSprintSec] = useState(60);
  const [sprintQ, setSprintQ] = useState(0);
  const [sprintCorrect, setSprintCorrect] = useState(0);
  const [sprintDone, setSprintDone] = useState(false);
  const [sprintPick, setSprintPick] = useState<boolean | null>(null);
  const sprintTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const sprintCorrectRef = useRef(0);
  // M17 reflect
  const [reflectText, setReflectText] = useState('');

  const theorySteps = new Set([1, 2, 3, 4, 7, 9, 11, 14]);
  const examSteps = new Set([6, 8, 10, 12, 13, 15, 16, 17]);
  const isExamMode = examSteps.has(step);

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isExamMode) {
        if (Platform.OS !== 'web') Alert.alert('Actividad en curso', 'Completa la actividad antes de salir.', [{ text: 'OK' }]);
        return true;
      }
      return false;
    });
    return () => handler.remove();
  }, [isExamMode]);

  useEffect(() => () => { if (sprintTimer.current) clearInterval(sprintTimer.current); }, []);

  // ----- Drag & drop web (M6 temp, M15 sesgo) -----
  const tempPlacedRef = useRef(tempPlaced); useEffect(() => { tempPlacedRef.current = tempPlaced; }, [tempPlaced]);
  const sesgoPlacedRef = useRef(sesgoPlaced); useEffect(() => { sesgoPlacedRef.current = sesgoPlaced; }, [sesgoPlaced]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const active = step === 6 ? { prefix: 't8temp', items: tempItems, zones: ['cold', 'hot'], placedRef: tempPlacedRef, ok: tempOk, set: setTempPlaced } :
      step === 15 ? { prefix: 't8sesgo', items: sesgoItems, zones: ['sesgo-datos', 'sesgo-confirmacion', 'sesgo-cultura'], placedRef: sesgoPlacedRef, ok: sesgoOk, set: setSesgoPlaced } : null;
    if (!active || active.ok) return;
    const cleanups: Array<() => void> = [];
    const setup = setTimeout(() => {
      active.items.forEach((_: any, i: number) => {
        if (active.placedRef.current[i] !== undefined) return;
        const el = document.getElementById(`${active.prefix}-chip-${i}`);
        if (!el) return;
        el.setAttribute('draggable', 'true');
        (el.style as any).cursor = 'grab';
        const onDragStart = (e: any) => { (window as any)._t8drag = i; if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(i)); } catch { /* noop */ } } };
        el.addEventListener('dragstart', onDragStart);
        cleanups.push(() => el.removeEventListener('dragstart', onDragStart));
      });
      active.zones.forEach((zone: string) => {
        const zoneEl = document.getElementById(`${active.prefix}-zone-${zone}`);
        if (!zoneEl) return;
        const onDragOver = (e: any) => e.preventDefault();
        const onDrop = (e: any) => { e.preventDefault(); const idx = (window as any)._t8drag; if (idx == null) return; active.set((prev: any) => ({ ...prev, [idx]: zone })); (window as any)._t8drag = null; };
        zoneEl.addEventListener('dragover', onDragOver);
        zoneEl.addEventListener('drop', onDrop);
        cleanups.push(() => { zoneEl.removeEventListener('dragover', onDragOver); zoneEl.removeEventListener('drop', onDrop); });
      });
    }, 60);
    return () => { clearTimeout(setup); cleanups.forEach((c) => c()); };
  }, [step, tempPlaced, sesgoPlaced, tempOk, sesgoOk, tempItems, sesgoItems]);

  const addXP = (v: number) => { setXp((prev) => prev + v); if (v > 0) setXpToast((prev) => ({ amount: v, id: (prev?.id ?? 0) + 1 })); };
  const next = () => { if (step < TOTAL_STEPS - 1) setStep(step + 1); };
  const prev = () => setStep((s) => s - 1);

  const handleClose = () => {
    const msg = isExamMode ? 'Estás en una actividad. Si sales perderás el progreso. ¿Seguro?' : '¿Seguro que quieres salir?';
    if (Platform.OS === 'web') { if (window.confirm(msg)) exitLevel({ confirm: false }); return; }
    Alert.alert('Salir', msg, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Salir', style: 'destructive', onPress: () => exitLevel({ confirm: false }) }]);
  };

  const finishLevel = () => {
    const stars = xp >= 180 ? 3 : xp >= 120 ? 2 : xp >= 50 ? 1 : 0;
    completeLevel(8, stars, xp);
    exitLevel({ confirm: false });
  };

  // ----- M6 drag temp -----
  const placeTemp = (zone: string) => { if (tempSel === null || tempOk) return; setTempPlaced((p) => ({ ...p, [tempSel]: zone })); setTempSel(null); };
  const removeTemp = (idx: number) => { if (tempOk) return; setTempPlaced((p) => { const n = { ...p }; delete n[idx]; return n; }); };
  const checkTemp = () => {
    const total = tempItems.length;
    const placed = Object.keys(tempPlaced).length;
    if (placed < total) { setTempFb({ ok: false, msg: `Faltan ${total - placed} tarjetas. Toca un chip y luego la columna donde va.` }); return; }
    const attempts = tempAttempts + 1;
    setTempAttempts(attempts);
    let correct = 0; const wrong: number[] = [];
    tempItems.forEach((it, i) => { if (tempPlaced[i] === it.correct) correct++; else wrong.push(i); });
    if (correct === total) {
      setTempOk(true);
      const earned = attempts === 1 ? 20 : 12;
      addXP(earned);
      setTempFb({ ok: true, msg: `¡Perfecto! Clasificaste las ${total} tareas correctamente. +${earned} XP 🎉` });
      return;
    }
    setTempFb({ ok: false, msg: `${correct} de ${total} correctos. Los incorrectos vuelven al banco.` });
    setTempPlaced((p) => { const n = { ...p }; wrong.forEach((i) => delete n[i]); return n; });
  };

  // ----- M8 TF -----
  const selectTF = (qi: number, val: boolean) => { if (!tfChecked) setTfAnswers((p) => ({ ...p, [qi]: val })); };
  const checkTF = () => {
    if (tfChecked) return true;
    if (!devMode && Object.keys(tfAnswers).length < contextTF.length) return false;
    setTfChecked(true);
    let c = 0; contextTF.forEach((item, i) => { if (tfAnswers[i] === item.correct) c++; });
    addXP(c * 5);
    return false;
  };

  // ----- M10 match -----
  const handleMatchLeft = (i: number) => { if (matchedLeft.has(i)) return; setMatchSel(i); };
  const handleMatchRight = (ri: number) => {
    if (matchSel === null || matchedRight.has(ri)) return;
    const correctRight = matchPairs[matchSel].right;
    if (rightOrder[ri] === correctRight) {
      const nl = new Set(matchedLeft); nl.add(matchSel);
      const nr = new Set(matchedRight); nr.add(ri);
      setMatchedLeft(nl); setMatchedRight(nr);
      setMatchFb({ ok: true, msg: `✅ ¡Correcto! ${matchPairs[matchSel].left} ↔ ${correctRight}` });
      if (nl.size >= matchPairs.length) addXP(20);
      setMatchSel(null);
    } else {
      setMatchWrong({ l: matchSel, r: ri });
      setMatchFb({ ok: false, msg: '❌ Esa no es la combinación correcta. Sigue intentando.' });
      setTimeout(() => setMatchWrong(null), 600);
      setMatchSel(null);
    }
  };

  // ----- M12 hall -----
  const checkHall = () => {
    if (hallChecked) return true;
    if (hallSel === null) return false;
    setHallChecked(true);
    if (hallSel === hallCase.correct) addXP(15); else addXP(5);
    return false;
  };

  // ----- M13 quiz -----
  const selectQuiz = (qi: number, oi: number) => { if (!quizChecked) setQuizAnswers((p) => ({ ...p, [qi]: oi })); };
  const checkQuiz = () => {
    if (quizChecked) return true;
    if (!devMode && Object.keys(quizAnswers).length < quizItems.length) return false;
    setQuizChecked(true);
    let c = 0; quizItems.forEach((q, i) => { if (quizAnswers[i] === q.correct) c++; });
    addXP(c * 8);
    return false;
  };

  // ----- M15 drag sesgo -----
  const placeSesgo = (zone: string) => { if (sesgoSel === null || sesgoOk) return; setSesgoPlaced((p) => ({ ...p, [sesgoSel]: zone })); setSesgoSel(null); };
  const removeSesgo = (idx: number) => { if (sesgoOk) return; setSesgoPlaced((p) => { const n = { ...p }; delete n[idx]; return n; }); };
  const checkSesgo = () => {
    const total = sesgoItems.length;
    const placed = Object.keys(sesgoPlaced).length;
    if (placed < total) { setSesgoFb({ ok: false, msg: `Faltan ${total - placed} tarjetas. Toca un chip y luego la columna donde va.` }); return; }
    const attempts = sesgoAttempts + 1;
    setSesgoAttempts(attempts);
    let correct = 0; const wrong: number[] = [];
    sesgoItems.forEach((it, i) => { if (sesgoPlaced[i] === it.correct) correct++; else wrong.push(i); });
    if (correct === total) {
      setSesgoOk(true);
      const earned = attempts === 1 ? 20 : 12;
      addXP(earned);
      setSesgoFb({ ok: true, msg: `¡Excelente! Identificaste los ${total} sesgos correctamente. +${earned} XP 🎉` });
      return;
    }
    setSesgoFb({ ok: false, msg: `${correct} de ${total} correctos. Los incorrectos vuelven al banco.` });
    setSesgoPlaced((p) => { const n = { ...p }; wrong.forEach((i) => delete n[i]); return n; });
  };

  // ----- M16 sprint -----
  const startSprint = () => {
    setSprintStarted(true); setSprintSec(60); setSprintQ(0); setSprintCorrect(0); sprintCorrectRef.current = 0; setSprintDone(false); setSprintPick(null);
    sprintTimer.current = setInterval(() => { setSprintSec((prev) => { if (prev <= 1) { finishSprint(); return 0; } return prev - 1; }); }, 1000);
  };
  const answerSprint = (val: boolean) => {
    if (sprintDone || sprintPick !== null || sprintQ >= sprintItems.length) return;
    setSprintPick(val);
    if (val === sprintItems[sprintQ].correct) { sprintCorrectRef.current += 1; setSprintCorrect(sprintCorrectRef.current); }
    setTimeout(() => {
      if (sprintQ + 1 >= sprintItems.length) finishSprint();
      else { setSprintQ((p) => p + 1); setSprintPick(null); }
    }, 600);
  };
  const finishSprint = () => {
    if (sprintDone) return;
    setSprintDone(true);
    if (sprintTimer.current) clearInterval(sprintTimer.current);
    const c = sprintCorrectRef.current;
    addXP(c >= 10 ? 25 : c >= 7 ? 18 : c >= 4 ? 12 : 5);
  };

  // ----- M17 reflect -----
  const submitReflect = () => { if (reflectText.trim().length >= 80) { addXP(15); return true; } return false; };

  // ---------- RENDERS ----------
  const renderStep = () => {
    switch (step) {
      // ---- 0 INTRO ----
      case 0:
        return (
          <View>
            <View style={[styles.lessonIcon, { backgroundColor: '#a7f3d0' }]}><Text style={{ fontSize: 34 }}>🧠</Text></View>
            <Text style={styles.title}>Habla el lenguaje de la IA</Text>
            <Text style={styles.subtitle}>Ya sabes escribir prompts. Ahora vas a entender qué pasa por dentro de los LLMs — y eso va a cambiar cómo los usas para siempre.</Text>
            <InfoCard variant="emerald" icon="🔬" iconBg="#6ee7b7" title="Lo que vas a descubrir">Tokens, temperatura, memoria de contexto, alucinaciones, sesgos y cómo comparar LLMs como un experto.</InfoCard>
            <InfoCard variant="teal" icon="🆕" iconBg="#99f6e4" title="Dos mecánicas nuevas">Token Estimator en vivo y Hallucination Spotter — habilidades que pocos tienen.</InfoCard>
            <InfoCard variant="slate" icon="⭐" iconBg="#e2e8f0" title="Hasta 230 XP disponibles">18 módulos · ~35-45 min · Nivel 4 de 30</InfoCard>
          </View>
        );

      // ---- 1 TEORÍA: dentro de un LLM ----
      case 1:
        return (
          <View>
            <Tag variant="theory">📖 Módulo 1 de 18 · Teoría</Tag>
            <Text style={styles.title}>¿Qué hay dentro de un LLM?</Text>
            <Text style={styles.bodyText}>Ya sabes que los LLMs predicen texto. Pero ¿cómo funciona eso en la práctica? Hay 5 conceptos clave que cambian cómo ves estas herramientas.</Text>
            {[
              { t: 'Entrenamiento masivo:', d: ' El modelo leyó billones de textos — libros, artículos, código, conversaciones. Aprendió patrones estadísticos del lenguaje humano.' },
              { t: 'Tokenización:', d: ' Antes de procesar tu texto, lo divide en "tokens" — fragmentos de palabras o palabras completas. Es la unidad básica de procesamiento.' },
              { t: 'Predicción estadística:', d: ' Con cada token que lee, calcula qué token es más probable que siga. No "piensa" — calcula probabilidades a velocidad masiva.' },
              { t: 'Temperatura:', d: ' Un parámetro que controla qué tan creativo o predecible es el modelo. Alta = más creativo, Baja = más exacto.' },
              { t: 'Ventana de contexto:', d: ' La cantidad de texto que el modelo puede "ver" en una conversación. Si la superas, empieza a olvidar mensajes anteriores.' },
            ].map((it, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
                <Text style={styles.stepListText}><B>{it.t}</B>{it.d}</Text>
              </View>
            ))}
            <Hl variant="teal"><B>💡 La idea central:</B>{'\n'}Un LLM no tiene conciencia, emociones ni comprensión real. Es un predictor de texto extremadamente sofisticado. Entender esto te ayuda a usarlo mejor — y a saber cuándo NO confiar en él.</Hl>
          </View>
        );

      // ---- 2 EJEMPLOS: tokens ----
      case 2:
        return (
          <View>
            <Tag variant="example">🔍 Módulo 2 de 18 · Ejemplos</Tag>
            <Text style={styles.title}>Tokens: la moneda secreta de la IA</Text>
            <Text style={styles.subtitle}>Toca cada ejemplo para entender cómo los LLMs "ven" el texto.</Text>
            {[
              { emoji: '✂️', name: '¿Qué es un token?', sub: 'La unidad básica de procesamiento', tag: 'TOKENIZACIÓN', tagBg: '#d1fae5', tagColor: '#065f46',
                body: <Text style={styles.exHow}>Una palabra corta como <B>"hola"</B> = 1 token. Una palabra larga como <B>"extraordinariamente"</B> = 2-3 tokens. Un signo de puntuación = 1 token. <B>"ChatGPT"</B> = 2 tokens (Chat + GPT).</Text>,
                fact: '📊 En inglés: ~1 token = ~4 caracteres o ¾ de palabra. En español los textos usan ~15% más tokens que en inglés por las palabras más largas.' },
              { emoji: '💰', name: '¿Por qué importan los tokens?', sub: 'Así te cobran y así limitan los modelos', tag: 'ECONOMÍA DE IA', tagBg: '#fef3c7', tagColor: '#92400e',
                body: <Text style={styles.exHow}>Los proveedores de LLMs cobran por tokens: tanto los que <B>envías</B> (tu prompt) como los que <B>recibes</B> (la respuesta). GPT-4 cobra ~$0.03 por cada 1,000 tokens de entrada. Un PDF de 100 páginas = ~75,000 tokens.</Text>,
                fact: '💡 Por eso los prompts cortos y precisos son más eficientes que los largos y vagos — no solo en calidad, sino también en costo.' },
              { emoji: '🪟', name: 'La ventana de contexto', sub: 'La "memoria de trabajo" del modelo', tag: 'CONTEXTO', tagBg: '#ede9fe', tagColor: '#5b21b6',
                body: <Text style={styles.exHow}>GPT-4 tiene ventana de <B>128,000 tokens</B> (~100,000 palabras). Claude puede manejar hasta <B>200,000 tokens</B>. Si tu conversación supera ese límite, el modelo empieza a "olvidar" los primeros mensajes.</Text>,
                fact: '📚 200,000 tokens equivale aproximadamente a leer El Señor de los Anillos completo (las 3 partes) de una sola vez.' },
              { emoji: '🎲', name: 'Cómo el modelo "elige" el siguiente token', sub: 'No hay pensamiento, hay probabilidades', tag: 'PREDICCIÓN', tagBg: '#f0fdf4', tagColor: '#166534',
                body: <Text style={styles.exHow}>Si escribes "El cielo es de color", el modelo calcula probabilidades: <B>azul</B> (42%), <B>gris</B> (18%), <B>negro</B> (12%), etc. La temperatura decide qué tan a menudo elige la opción menos probable.</Text>,
                fact: '⚡ GPT-4 hace este cálculo en milisegundos sobre un vocabulario de ~100,000 tokens posibles. Eso es lo que hace que parezca "inteligente".' },
            ].map((c, i) => {
              const open = expandedEx === i;
              return (
                <TouchableOpacity key={i} activeOpacity={0.9} style={[styles.exCard, open && styles.exCardOpen]} onPress={() => setExpandedEx(open ? null : i)}>
                  <View style={styles.exHead}>
                    <View style={styles.exEmoji}><Text style={{ fontSize: 22 }}>{c.emoji}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.exName}>{c.name}</Text>
                      <Text style={styles.exSub}>{c.sub}</Text>
                    </View>
                    <MaterialIcons name={open ? 'keyboard-arrow-down' : 'chevron-right'} size={20} color="#94a3b8" />
                  </View>
                  {open && (
                    <View style={styles.exBody}>
                      <View style={[styles.exTag, { backgroundColor: c.tagBg }]}><Text style={[styles.exTagText, { color: c.tagColor }]}>{c.tag}</Text></View>
                      {c.body}
                      <View style={styles.exFact}><Text style={styles.exFactText}>{c.fact}</Text></View>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
            <Hl variant="green"><B>🎯 Para recordar:</B>{'\n'}Los tokens no son palabras exactas — son fragmentos de texto. Entender esto te ayuda a estimar cuánto cabe en un prompt, por qué los modelos tienen límites, y por qué el español "consume" más tokens que el inglés.</Hl>
          </View>
        );

      // ---- 3 TOKEN ESTIMATOR ----
      case 3: {
        const tokens = estimateTokens(tokenText);
        const words = tokenText.trim().split(/\s+/).filter((w) => w.length > 0);
        const wordColors = ['#d1fae5', '#a7f3d0', '#6ee7b7', '#34d399', '#10b981', '#059669'];
        return (
          <View>
            <Tag variant="new">🆕 Módulo 3 de 18 · Token Estimator</Tag>
            <Text style={styles.title}>Escribe y mira tus tokens</Text>
            <Text style={styles.subtitle}>Escribe cualquier texto y ve en tiempo real cómo un LLM lo "tokeniza". Más largo o más técnico = más tokens.</Text>
            <TextInput style={styles.tokenTextarea} multiline textAlignVertical="top" value={tokenText} onChangeText={setTokenText} placeholder="Escribe tu prompt aquí... por ejemplo: Explícame cómo funciona la fotosíntesis de forma sencilla para un estudiante de 13 años que vive en Colombia." placeholderTextColor="#b8bcc0" />
            <View style={styles.tokenDisplay}>
              <Text style={styles.tokenCount}>{tokens}</Text>
              <Text style={styles.tokenLabel}>TOKENS ESTIMADOS</Text>
              <View style={styles.tokenBarWrap}><View style={[styles.tokenBar, { width: `${Math.min((tokens / 4096) * 100, 100)}%` }]} /></View>
              <View style={styles.tokenBarLabels}>
                <Text style={styles.tokenBarLabelText}>0</Text>
                <Text style={styles.tokenBarLabelText}>~1,000</Text>
                <Text style={styles.tokenBarLabelText}>~2,000</Text>
                <Text style={styles.tokenBarLabelText}>~4,096 (límite chat)</Text>
              </View>
              <View style={styles.tokenWords}>
                {words.slice(0, 30).map((w, i) => (
                  <View key={i} style={[styles.tokenWord, { backgroundColor: wordColors[i % wordColors.length] }]}><Text style={styles.tokenWordText}>{w}</Text></View>
                ))}
                {words.length > 30 && <Text style={{ fontSize: 10, color: '#94a3b8', alignSelf: 'center' }}>…+{words.length - 30} más</Text>}
              </View>
            </View>
            <Hl variant="teal"><B>💡 Prueba esto:</B>{'\n'}Escribe el mismo texto en español y en inglés — verás que el español usa más tokens. También prueba: un texto simple vs uno técnico con palabras largas.</Hl>
            <InfoCard variant="slate">⚠️ <B>Nota:</B> Esta es una estimación educativa simplificada. Los conteos reales varían según el tokenizador específico de cada modelo.</InfoCard>
          </View>
        );
      }

      // ---- 4 TEORÍA: temperatura ----
      case 4:
        return (
          <View>
            <Tag variant="theory">📖 Módulo 4 de 18 · Temperatura</Tag>
            <Text style={styles.title}>Temperatura: el dial de creatividad</Text>
            <Text style={styles.bodyText}>La <B>temperatura</B> es el parámetro más importante que controla el comportamiento de un LLM. Es un número entre 0 y 1 (a veces hasta 2) que cambia completamente el estilo de las respuestas.</Text>
            <View style={styles.vsGrid}>
              <View style={[styles.vsCol, { backgroundColor: '#f0f9ff' }]}>
                <Text style={[styles.vsHeader, { backgroundColor: '#bae6fd', color: '#0369a1' }]}>🔵 Temp. BAJA (0.0–0.3)</Text>
                {['Respuestas predecibles y consistentes', 'Siempre elige el token más probable', 'Ideal para: cálculos, datos, instrucciones', 'Poca variedad entre sesiones'].map((t, i) => <Text key={i} style={styles.vsItem}>{t}</Text>)}
              </View>
              <View style={[styles.vsCol, { backgroundColor: '#fff1f2' }]}>
                <Text style={[styles.vsHeader, { backgroundColor: '#fecdd3', color: '#991b1b' }]}>🔴 Temp. ALTA (0.7–1.0)</Text>
                {['Respuestas creativas y variables', 'A veces elige tokens menos probables', 'Ideal para: poesía, historias, ideas', 'Cada sesión puede ser diferente'].map((t, i) => <Text key={i} style={styles.vsItem}>{t}</Text>)}
              </View>
            </View>
            <InfoCard variant="green" icon="🎯" iconBg="#bbf7d0" title="Cuándo usar temperatura baja">Código de programación, ecuaciones, traducciones exactas, instrucciones paso a paso, datos específicos. Necesitas que el modelo sea predecible y correcto.</InfoCard>
            <InfoCard variant="red" icon="🎨" iconBg="#fecdd3" title="Cuándo usar temperatura alta">Poemas, historias, lluvia de ideas, nombres creativos, personajes de ficción. Quieres sorprenderte con respuestas inesperadas y variadas.</InfoCard>
            <Hl variant="amber"><B>⚙️ ¿Puedes cambiarla tú?</B>{'\n'}En ChatGPT y Claude estándar la temperatura está fija (~0.7). Pero si accedes a la API o usas herramientas avanzadas, puedes ajustarla. Algunos prompts pueden simularlo: "Sé muy creativo y poco convencional" = temperatura alta implícita.</Hl>
          </View>
        );

      // ---- 5 TEMPERATURE SLIDER ----
      case 5: {
        const labels = ['Muy fría (0.0)', 'Baja (0.2)', 'Media (0.5)', 'Alta (0.8)', 'Muy alta (1.0)'];
        const labelColors = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#dc2626'];
        const activeRes = tempSliderVal < 2 ? 0 : tempSliderVal === 2 ? 1 : 2;
        return (
          <View>
            <Tag variant="new">🆕 Módulo 5 de 18 · Temperature Slider</Tag>
            <Text style={styles.title}>Mueve la temperatura, cambia la respuesta</Text>
            <Text style={styles.subtitle}>Mismo prompt: <Text style={styles.italic}>"Explícame la fotosíntesis"</Text>. Mueve el slider y observa cómo cambia completamente la respuesta del modelo.</Text>
            <View style={styles.sliderTrack}>
              {[0, 1, 2, 3, 4].map((i) => (
                <TouchableOpacity key={i} style={styles.sliderStop} onPress={() => setTempSliderVal(i)}>
                  <View style={[styles.sliderDot, tempSliderVal === i && styles.sliderDotActive]} />
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.tempLabel, { color: labelColors[tempSliderVal] }]}>{labels[tempSliderVal]}</Text>
            <View style={styles.tempLabelsRow}><Text style={styles.tempLabelsSm}>🔵 Muy fría</Text><Text style={styles.tempLabelsSm}>🔴 Muy alta</Text></View>
            <View style={{ marginTop: 12, gap: 8 }}>
              {TEMP_RESPONSES.map((r, i) => (
                <View key={i} style={[styles.tempResponse, { backgroundColor: r.color, borderColor: i === activeRes ? '#10b981' : 'transparent', opacity: i === activeRes ? 1 : 0.4 }]}>
                  <Text style={styles.tempResLabel}>{r.label}</Text>
                  <Text style={styles.tempResText}>{r.text}</Text>
                </View>
              ))}
            </View>
            <Hl variant="green"><B>🧠 Observa la diferencia:</B>{'\n'}La temperatura baja da la respuesta correcta y directa. La alta usa metáforas, analogías y lenguaje poético. Ambas responden la misma pregunta, pero de formas completamente distintas.</Hl>
          </View>
        );
      }

      // ---- 6 DRAG temperatura ----
      case 6:
        return (
          <View>
            <Tag variant="activity">🎯 Módulo 6 de 18 · Clasificar</Tag>
            <Text style={styles.title}>¿Alta o baja temperatura?</Text>
            <Text style={[styles.subtitle, { marginBottom: 9 }]}>Para cada tarea, ¿usarías temperatura baja (precisión) o alta (creatividad)?</Text>
            <InfoCard variant="slate">🔵 <B>Baja:</B> datos, cálculos, instrucciones exactas · 🔴 <B>Alta:</B> creatividad, ideas, historias</InfoCard>
            <View style={styles.chipsPool}>
              {tempItems.map((it, i) => (tempPlaced[i] === undefined && (
                <TouchableOpacity key={i} {...({ nativeID: `t8temp-chip-${i}` } as any)} style={[styles.chip, tempSel === i && styles.chipSel]} onPress={() => setTempSel(tempSel === i ? null : i)} disabled={tempOk}>
                  <Text style={[styles.chipText, tempSel === i && { color: '#065f46' }]}>{it.text}</Text>
                </TouchableOpacity>
              )))}
              {Object.keys(tempPlaced).length === tempItems.length && <Text style={styles.poolDone}>Todas ubicadas ✓</Text>}
            </View>
            <View style={styles.dropGrid2}>
              {(['cold', 'hot'] as const).map((zone) => {
                const z = TEMP_ZONES[zone];
                const placedHere = Object.entries(tempPlaced).filter(([, v]) => v === zone).map(([k]) => parseInt(k));
                return (
                  <View key={zone} style={{ flex: 1 }}>
                    <Text style={[styles.dropHeader, { backgroundColor: z.hbg, color: z.hcolor }]}>{z.header}</Text>
                    <TouchableOpacity {...({ nativeID: `t8temp-zone-${zone}` } as any)} activeOpacity={0.9} style={[styles.dropCol, placedHere.length > 0 && { borderStyle: 'solid', borderColor: z.border, backgroundColor: z.bg }]} onPress={() => placeTemp(zone)}>
                      <View style={styles.dropArea}>
                        {placedHere.map((idx) => (
                          <TouchableOpacity key={idx} onPress={() => removeTemp(idx)} style={[styles.dropChip, { backgroundColor: z.chipBg }]}>
                            <Text style={[styles.dropChipText, { color: z.chipColor }]}>{tempItems[idx].text} ✕</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
            {tempFb && <FeedbackBar ok={tempFb.ok}>{tempFb.msg}</FeedbackBar>}
          </View>
        );

      // ---- 7 TEORÍA: memoria y contexto ----
      case 7:
        return (
          <View>
            <Tag variant="theory">📖 Módulo 7 de 18 · Contexto</Tag>
            <Text style={styles.title}>La memoria que se borra</Text>
            <Text style={styles.bodyText}>Una de las confusiones más comunes sobre los LLMs: <B>¿recuerdan lo que les dijiste antes?</B> La respuesta corta es: dentro de una conversación sí, pero entre sesiones no.</Text>
            <InfoCard variant="green" icon="✅" iconBg="#bbf7d0" title="Sí recuerda: dentro de la misma conversación">Si le dices "Me llamo Valentina" y luego preguntas "¿Cómo me llamo?", responderá "Valentina". Porque tu nombre sigue en la ventana de contexto activa.</InfoCard>
            <InfoCard variant="red" icon="❌" iconBg="#fecdd3" title="No recuerda: entre conversaciones distintas">Si cierras el chat y abres uno nuevo, el LLM empieza desde cero. No sabe quién eres, qué hablaron antes ni nada de tu historial anterior.</InfoCard>
            <InfoCard variant="amber" icon="⚠️" iconBg="#fde68a" title="Depende: conversaciones muy largas">Si tu chat supera la ventana de contexto, el modelo empieza a "olvidar" los mensajes más antiguos. Los primeros mensajes desaparecen de lo que puede "ver".</InfoCard>
            <SectionTitle>¿Cómo aprovechar esto?</SectionTitle>
            {[
              'Siempre empieza conversaciones importantes con contexto: quién eres, qué necesitas y el tono deseado.',
              'Para proyectos largos, guarda los acuerdos clave y repégatelos al inicio de cada sesión nueva.',
              'Si el modelo parece "olvidar" instrucciones antiguas en un chat largo, es la ventana de contexto — recuérdale.',
            ].map((t, i) => (
              <View key={i} style={styles.stepRow}><View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View><Text style={styles.stepListText}>{t}</Text></View>
            ))}
            <Hl variant="teal"><B>💡 Truco profesional:</B>{'\n'}Crea una "tarjeta de contexto" — un párrafo corto con tu perfil: nombre, edad, contexto, idioma preferido y tipo de respuestas que quieres. Pégala al inicio de cada conversación nueva para que el modelo te conozca de inmediato.</Hl>
          </View>
        );

      // ---- 8 V/F memoria ----
      case 8:
        return (
          <View>
            <Tag variant="vf">✅ Módulo 8 de 18 · Verdadero o Falso</Tag>
            <Text style={styles.title}>¿Qué recuerda realmente un LLM?</Text>
            <Text style={[styles.subtitle, { marginBottom: 12 }]}>Muchas personas tienen ideas equivocadas sobre la memoria de los LLMs. ¿Cuáles son mitos?</Text>
            {contextTF.map((item, qi) => {
              const sel = tfAnswers[qi];
              const tCorrect = tfChecked && item.correct === true;
              const fCorrect = tfChecked && item.correct === false;
              const tWrong = tfChecked && sel === true && item.correct !== true;
              const fWrong = tfChecked && sel === false && item.correct !== false;
              const isOk = sel === item.correct;
              return (
                <View key={qi} style={{ marginBottom: 14 }}>
                  <Text style={styles.tfQuestion}>{qi + 1}. {item.stmt}</Text>
                  <View style={styles.tfOpts}>
                    <TouchableOpacity style={[styles.tfBtn, sel === true && !tfChecked && styles.tfSelT, tCorrect && styles.tfCorrect, tWrong && styles.tfWrong]} onPress={() => selectTF(qi, true)} disabled={tfChecked}>
                      <Text style={styles.tfBtnEmoji}>✅</Text><Text style={styles.tfBtnLabel}>Verdadero</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.tfBtn, sel === false && !tfChecked && styles.tfSelF, fCorrect && styles.tfCorrect, fWrong && styles.tfWrong]} onPress={() => selectTF(qi, false)} disabled={tfChecked}>
                      <Text style={styles.tfBtnEmoji}>❌</Text><Text style={styles.tfBtnLabel}>Falso</Text>
                    </TouchableOpacity>
                  </View>
                  {tfChecked && <FeedbackBar ok={isOk}>{isOk ? `✅ ${item.explain}` : `❌ Incorrecto. La respuesta correcta es «${item.correct ? 'Verdadero' : 'Falso'}». ${item.explain}`}</FeedbackBar>}
                </View>
              );
            })}
          </View>
        );

      // ---- 9 TEORÍA: comparativa LLMs ----
      case 9:
        return (
          <View>
            <Tag variant="theory">📖 Módulo 9 de 18 · Comparativa</Tag>
            <Text style={styles.title}>ChatGPT, Claude, Gemini y Grok: las diferencias que importan</Text>
            <Text style={[styles.subtitle, { marginBottom: 10 }]}>Ahora que entiendes cómo funcionan por dentro, podemos comparar sus diferencias reales.</Text>
            <View style={styles.cmpTable}>
              <View style={[styles.cmpRow, styles.cmpHead]}>
                <Text style={[styles.cmpCell, styles.cmpHeadText, { flex: 1.1 }]}>Modelo</Text>
                <Text style={[styles.cmpCell, styles.cmpHeadText, { flex: 0.9 }]}>Ventana</Text>
                <Text style={[styles.cmpCell, styles.cmpHeadText, { flex: 1 }]}>Internet</Text>
                <Text style={[styles.cmpCell, styles.cmpHeadText, { flex: 1.3 }]}>Fortaleza</Text>
              </View>
              {[
                { m: 'GPT-4o', mBg: '#dcfce7', mColor: '#166534', ctx: '128K', net: '✅ búsqueda', str: 'Versatilidad + imágenes' },
                { m: 'Claude 3.5', mBg: '#fef3c7', mColor: '#92400e', ctx: '200K', net: '❌ sin internet', str: 'Docs largos + ética' },
                { m: 'Gemini 1.5', mBg: '#dbeafe', mColor: '#1e40af', ctx: '1M', net: '✅ Google', str: 'Contexto masivo + Google' },
                { m: 'Grok 2', mBg: '#ede9fe', mColor: '#5b21b6', ctx: '128K', net: '✅ X (Twitter)', str: 'Tiempo real en X' },
              ].map((r, i) => (
                <View key={i} style={styles.cmpRow}>
                  <View style={[styles.cmpCell, { flex: 1.1 }]}><View style={[styles.cmpBadge, { backgroundColor: r.mBg }]}><Text style={[styles.cmpBadgeText, { color: r.mColor }]}>{r.m}</Text></View></View>
                  <Text style={[styles.cmpCell, styles.cmpCellText, { flex: 0.9 }]}>{r.ctx}</Text>
                  <Text style={[styles.cmpCell, styles.cmpCellText, { flex: 1 }]}>{r.net}</Text>
                  <Text style={[styles.cmpCell, styles.cmpCellText, { flex: 1.3 }]}>{r.str}</Text>
                </View>
              ))}
            </View>
            <SectionTitle>¿Cuándo usar cada uno?</SectionTitle>
            <InfoCard variant="green" icon="🌟" iconBg="#bbf7d0" title="Claude — para textos muy largos y análisis profundo">¿Tienes un PDF de 200 páginas? ¿Necesitas análisis que requiera razonamiento extenso? Claude tiene la ventana más grande y está optimizado para ser honesto.</InfoCard>
            <InfoCard variant="sky" icon="✦" iconBg="#bae6fd" title="Gemini — para búsquedas + generación combinadas">¿Necesitas info de hoy + generar contenido basado en ella? ¿Tienes que procesar un libro entero de una vez? Gemini tiene la ventana más grande y búsqueda en Google.</InfoCard>
            <InfoCard variant="amber" icon="💬" iconBg="#fde68a" title="ChatGPT — para todo lo demás, especialmente imágenes">El más versátil. Puede generar imágenes con DALL·E, tiene plugins y es el más conocido. Si no sabes cuál usar, empieza aquí.</InfoCard>
            <Hl variant="green"><B>🔑 Regla práctica:</B>{'\n'}Para aprendizaje y proyectos escolares: Claude o ChatGPT. Para investigación con datos actuales: Gemini. Para tendencias de redes sociales: Grok. La herramienta correcta cambia el resultado completamente.</Hl>
          </View>
        );

      // ---- 10 MATCHING ----
      case 10:
        return (
          <View>
            <Tag variant="match">🔗 Módulo 10 de 18 · Conectar</Tag>
            <Text style={styles.title}>Situación → LLM ideal</Text>
            <Text style={[styles.subtitle, { marginBottom: 9 }]}>Conecta cada tarea con el modelo más adecuado para hacerla.</Text>
            <InfoCard variant="emerald">① Toca la tarjeta <B>verde izquierda</B> (situación) → ② Toca la <B>teal derecha</B> que la explica → Si conectas bien, ambas se vuelven ✅</InfoCard>
            <View style={{ flexDirection: 'row', gap: 5, marginBottom: 4 }}>
              <Text style={styles.matchColLabel}>La tarea</Text>
              <Text style={styles.matchColLabel}>El modelo ideal</Text>
            </View>
            {matchPairs.map((p, i) => {
              const lMatched = matchedLeft.has(i), lSel = matchSel === i, lFlash = matchWrong?.l === i;
              const rMatched = matchedRight.has(i), rFlash = matchWrong?.r === i;
              return (
                <View key={i} style={{ flexDirection: 'row', gap: 5, marginBottom: 5 }}>
                  <TouchableOpacity style={[styles.matchItem, styles.matchLeft, lMatched && styles.matchOk, lSel && styles.matchSelSt, lFlash && styles.matchWrongSt]} onPress={() => handleMatchLeft(i)} disabled={lMatched}>
                    <Text style={[styles.matchText, { color: '#065f46' }, lMatched && { color: '#166534' }]}>{p.left}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.matchItem, styles.matchRight, rMatched && styles.matchOk, rFlash && styles.matchWrongSt]} onPress={() => handleMatchRight(i)} disabled={rMatched}>
                    <Text style={[styles.matchText, { color: '#0f766e' }, rMatched && { color: '#166534' }]}>{rightOrder[i]}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
            {matchFb && <FeedbackBar ok={matchFb.ok}>{matchFb.msg}</FeedbackBar>}
          </View>
        );

      // ---- 11 TEORÍA: alucinaciones ----
      case 11:
        return (
          <View>
            <Tag variant="theory">📖 Módulo 11 de 18 · Alucinaciones</Tag>
            <Text style={styles.title}>Cuando la IA inventa con total confianza</Text>
            <Text style={styles.bodyText}>El fenómeno más peligroso de los LLMs se llama <B>"alucinación"</B>: el modelo genera información falsa con total seguridad, como si fuera un hecho verificado.</Text>
            <View style={styles.scenarioBox}>
              <Text style={styles.scenarioLabel}>🎬 UN CASO REAL DE ALUCINACIÓN</Text>
              <Text style={styles.scenarioText}>Un abogado en EE.UU. usó ChatGPT para investigar precedentes legales. El modelo citó <B>6 casos judiciales reales… que no existían</B>. Nombres de jueces, fechas, veredictos — todo inventado. El abogado fue sancionado por presentarlos ante el tribunal sin verificar. Fuente: NY Times, 2023.</Text>
            </View>
            <SectionTitle>¿Por qué alucina?</SectionTitle>
            <Text style={styles.bodyText}>El modelo no "verifica" si algo es verdad — solo predice qué texto es estadísticamente probable. Si la pregunta "suena" como que debería tener una respuesta específica, el modelo puede generarla aunque no tenga esa información.</Text>
            <InfoCard variant="red" icon="⚠️" iconBg="#fecdd3" title="Tipos de alucinación más comunes"><B>Datos estadísticos inventados:</B> "El 73% de los estudiantes…"{'\n'}<B>Citas falsas:</B> Atribuye frases a personas que nunca las dijeron{'\n'}<B>Referencias bibliográficas:</B> Libros y artículos que no existen{'\n'}<B>Fechas y nombres erróneos:</B> Eventos históricos mezclados</InfoCard>
            <SectionTitle>¿Cómo detectarlas y evitarlas?</SectionTitle>
            {[
              { t: 'Sospecha de números exactos:', d: ' "El 67.3% de..." suena más falso que "alrededor de la mitad..."' },
              { t: 'Verifica referencias:', d: ' Si el modelo cita un estudio o libro, búscalo en Google antes de usarlo.' },
              { t: 'Pide fuentes:', d: ' "Dame la fuente exacta de ese dato." Si no puede, probablemente lo inventó.' },
              { t: 'Usa búsqueda web:', d: ' Para datos verificables, usa Gemini o ChatGPT con búsqueda activada.' },
            ].map((it, i) => (
              <View key={i} style={styles.stepRow}><View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View><Text style={styles.stepListText}><B>{it.t}</B>{it.d}</Text></View>
            ))}
            <Hl variant="red"><B>🚨 Regla de oro:</B>{'\n'}NUNCA uses datos de un LLM en un trabajo académico, presentación profesional o decisión importante sin verificarlos en fuentes primarias. Los LLMs son brillantes para analizar y explicar — no para ser fuentes de hechos.</Hl>
          </View>
        );

      // ---- 12 HALLUCINATION SPOTTER ----
      case 12:
        return (
          <View>
            <Tag variant="new">🆕 Módulo 12 de 18 · Hallucination Spotter</Tag>
            <Text style={styles.title}>Detecta la alucinación</Text>
            <Text style={styles.subtitle}>Lee esta respuesta que generó un LLM. Uno de los fragmentos subrayados es una alucinación — una afirmación que el modelo probablemente inventó. ¿Puedes encontrarla?</Text>
            <View style={[styles.card, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
              <Text style={styles.scenarioLabel}>📋 CONTEXTO</Text>
              <Text style={styles.scenarioText}>{hallCase.intro}</Text>
            </View>
            <View style={[styles.card, { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }]}>
              <Text style={[styles.cardTitle, { marginBottom: 8 }]}>💬 Respuesta del LLM:</Text>
              <Text style={styles.hallText}>
                {hallCase.parts.map((part, i) => {
                  if (part.idx === null) return <Text key={i}>{part.text}</Text>;
                  const sel = hallSel === part.idx;
                  const isCorrect = hallChecked && part.idx === hallCase.correct;
                  const isWrong = hallChecked && sel && part.idx !== hallCase.correct;
                  return (
                    <Text key={i} onPress={() => { if (!hallChecked) setHallSel(part.idx); }}
                      style={[styles.hallSpan, sel && !hallChecked && styles.hallSpanSel, isCorrect && styles.hallSpanCorrect, isWrong && styles.hallSpanWrong]}>
                      {part.text}
                    </Text>
                  );
                })}
              </Text>
            </View>
            <InfoCard variant="sky">👆 Toca el <B>fragmento subrayado</B> que crees que es incorrecto o inventado, luego presiona el botón.</InfoCard>
            {hallChecked && <FeedbackBar ok={hallSel === hallCase.correct}>{(hallSel === hallCase.correct ? '✅ ¡Exacto! ' : '❌ No era ese. ') + hallCase.explain}</FeedbackBar>}
          </View>
        );

      // ---- 13 QUIZ ----
      case 13:
        return (
          <View>
            <Tag variant="quiz">❓ Módulo 13 de 18 · Quiz</Tag>
            <Text style={styles.title}>LLMs: lo que ya deberías saber</Text>
            <Text style={[styles.subtitle, { marginBottom: 12 }]}>Preguntas de nivel avanzado sobre todo lo que hemos visto en este nivel.</Text>
            {quizItems.map((q, qi) => (
              <View key={qi} style={{ marginBottom: 16 }}>
                <Text style={styles.quizQ}>{qi + 1}. {q.q}</Text>
                {q.opts.map((o, oi) => {
                  const sel = quizAnswers[qi] === oi;
                  const okColor = quizChecked && oi === q.correct;
                  const badColor = quizChecked && sel && oi !== q.correct;
                  return (
                    <TouchableOpacity key={oi} style={[styles.qopt, sel && !quizChecked && styles.qoptSel, okColor && styles.qoptOk, badColor && styles.qoptBad]} onPress={() => selectQuiz(qi, oi)} disabled={quizChecked}>
                      <View style={[styles.qoptLetter, sel && !quizChecked && styles.qoptLetterSel, okColor && styles.qoptLetterOk, badColor && styles.qoptLetterBad]}>
                        <Text style={[styles.qoptLetterText, (sel && !quizChecked) || okColor || badColor ? { color: '#fff' } : null]}>{String.fromCharCode(65 + oi)}</Text>
                      </View>
                      <Text style={[styles.qoptText, okColor && { color: '#166534' }, badColor && { color: '#991b1b' }, sel && !quizChecked && { color: '#065f46' }]}>{o}</Text>
                    </TouchableOpacity>
                  );
                })}
                {quizChecked && <FeedbackBar ok={quizAnswers[qi] === q.correct}>{(quizAnswers[qi] === q.correct ? '✅ ' : '❌ ') + q.explain}</FeedbackBar>}
              </View>
            ))}
          </View>
        );

      // ---- 14 TEORÍA: sesgos ----
      case 14:
        return (
          <View>
            <Tag variant="theory">📖 Módulo 14 de 18 · Sesgos</Tag>
            <Text style={styles.title}>Los sesgos que nadie te cuenta</Text>
            <Text style={styles.bodyText}>Los LLMs no son neutrales. Fueron entrenados por humanos con datos producidos por humanos — y esos datos tienen sesgos. Conocerlos es indispensable para usarlos con pensamiento crítico.</Text>
            <InfoCard variant="purple" icon="📊" iconBg="#e9d5ff" title="Sesgo de datos (el más común)">El modelo aprendió más de ciertos grupos, idiomas y culturas. Internet tiene más contenido en inglés, de perspectivas occidentales y sobre ciertos temas. Lo que no está en los datos de entrenamiento, el modelo lo conoce poco.</InfoCard>
            <InfoCard variant="amber" icon="🪞" iconBg="#fde68a" title="Sesgo de confirmación">Los modelos tienden a estar de acuerdo con lo que dice el usuario — especialmente si lo planteas con convicción. Si dices "Tengo razón en que X, ¿verdad?", el modelo frecuentemente te da la razón aunque estés equivocado.</InfoCard>
            <InfoCard variant="pink" icon="🌎" iconBg="#fbcfe8" title="Sesgo cultural y geográfico">Los LLMs usan más ejemplos de EE.UU. y Europa. Pueden no entender modismos latinoamericanos, contextos locales o referencias culturales de países específicos. "Parcero" o "chévere" pueden confundirlos.</InfoCard>
            <SectionTitle>¿Cómo manejar los sesgos?</SectionTitle>
            <Hl variant="teal"><B>💡 Estrategias concretas:</B>{'\n'}① Pregunta siempre por perspectivas alternativas: "¿Qué diría alguien que está en desacuerdo?"{'\n'}② Especifica el contexto cultural: "Tengo en cuenta el contexto colombiano..."{'\n'}③ Nunca asumas que la primera respuesta es neutral — cuestiona, compara, verifica.</Hl>
            <Hl variant="amber"><B>⚠️ El sesgo más peligroso:</B>{'\n'}Creer que el LLM es objetivo porque "es una máquina". Las máquinas heredan los sesgos de los datos y personas que las crean. El pensamiento crítico no se puede delegar a la IA.</Hl>
          </View>
        );

      // ---- 15 DRAG sesgos ----
      case 15:
        return (
          <View>
            <Tag variant="activity">🎭 Módulo 15 de 18 · Clasificar sesgos</Tag>
            <Text style={styles.title}>¿Qué tipo de sesgo es?</Text>
            <Text style={[styles.subtitle, { marginBottom: 9 }]}>Clasifica cada afirmación en el tipo de sesgo que describe.</Text>
            <InfoCard variant="slate">🟣 <B>Datos:</B> viene de los datos de entrenamiento · 🟡 <B>Confirmación:</B> el modelo te da la razón · 🩷 <B>Cultural:</B> falta de contexto local</InfoCard>
            <View style={styles.chipsPool}>
              {sesgoItems.map((it, i) => (sesgoPlaced[i] === undefined && (
                <TouchableOpacity key={i} {...({ nativeID: `t8sesgo-chip-${i}` } as any)} style={[styles.chip, sesgoSel === i && styles.chipSel]} onPress={() => setSesgoSel(sesgoSel === i ? null : i)} disabled={sesgoOk}>
                  <Text style={[styles.chipText, sesgoSel === i && { color: '#065f46' }]}>{it.text}</Text>
                </TouchableOpacity>
              )))}
              {Object.keys(sesgoPlaced).length === sesgoItems.length && <Text style={styles.poolDone}>Todas ubicadas ✓</Text>}
            </View>
            {(['sesgo-datos', 'sesgo-confirmacion', 'sesgo-cultura'] as const).map((zone) => {
              const z = SESGO_ZONES[zone];
              const placedHere = Object.entries(sesgoPlaced).filter(([, v]) => v === zone).map(([k]) => parseInt(k));
              return (
                <View key={zone} style={{ marginBottom: 7 }}>
                  <Text style={[styles.dropHeader, { backgroundColor: z.hbg, color: z.hcolor }]}>{z.header}</Text>
                  <TouchableOpacity {...({ nativeID: `t8sesgo-zone-${zone}` } as any)} activeOpacity={0.9} style={[styles.dropCol, placedHere.length > 0 && { borderStyle: 'solid', borderColor: z.border, backgroundColor: z.bg }]} onPress={() => placeSesgo(zone)}>
                    <View style={styles.dropArea}>
                      {placedHere.map((idx) => (
                        <TouchableOpacity key={idx} onPress={() => removeSesgo(idx)} style={[styles.dropChip, { backgroundColor: z.chipBg }]}>
                          <Text style={[styles.dropChipText, { color: z.chipColor }]}>{sesgoItems[idx].text} ✕</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </TouchableOpacity>
                </View>
              );
            })}
            {sesgoFb && <FeedbackBar ok={sesgoFb.ok}>{sesgoFb.msg}</FeedbackBar>}
          </View>
        );

      // ---- 16 SPRINT ----
      case 16: {
        const item = sprintItems[sprintQ];
        const showEmoji = sprintCorrect >= 8 ? '🏆' : sprintCorrect >= 5 ? '⭐' : '💪';
        const resBg = sprintCorrect >= 8 ? '#dcfce7' : sprintCorrect >= 5 ? '#fef3c7' : '#fff1f2';
        const resCol = sprintCorrect >= 8 ? '#166534' : sprintCorrect >= 5 ? '#92400e' : '#991b1b';
        const vOk = sprintPick !== null && item && item.correct === true;
        const fOk = sprintPick !== null && item && item.correct === false;
        const vBad = sprintPick === true && item && item.correct !== true;
        const fBad = sprintPick === false && item && item.correct !== false;
        return (
          <View>
            <Tag variant="sprint">⚡ Módulo 16 de 18 · Sprint</Tag>
            <Text style={styles.title}>Sprint: ¿Mito o Realidad?</Text>
            <Text style={[styles.subtitle, { marginBottom: 9 }]}>60 segundos para demostrar todo lo que aprendiste sobre LLMs. ¿Cuántas respuestas correctas logras?</Text>
            {!sprintStarted && <InfoCard variant="emerald">⚡ Toca <B>"Empezar Sprint"</B> para comenzar · Después responde V/F lo más rápido posible</InfoCard>}
            <Text style={styles.sprintTimer}>{sprintSec}</Text>
            <View style={styles.sprintBarWrap}><View style={[styles.sprintBar, { width: `${(sprintSec / 60) * 100}%` }]} /></View>
            {sprintDone ? (
              <View style={[styles.sprintResult, { backgroundColor: resBg, borderColor: resCol + '40' }]}>
                <Text style={{ fontSize: 28, marginBottom: 6 }}>{showEmoji}</Text>
                <Text style={{ fontSize: 17, fontWeight: '800', color: resCol, marginBottom: 4 }}>{sprintCorrect} de {sprintItems.length} correctas</Text>
                <Text style={{ fontSize: 12, color: resCol }}>+{sprintCorrect >= 10 ? 25 : sprintCorrect >= 7 ? 18 : sprintCorrect >= 4 ? 12 : 5} XP ganados</Text>
              </View>
            ) : (
              <>
                <Text style={styles.sprintScore}>{sprintCorrect} correctas de {sprintQ} respondidas</Text>
                <View style={styles.sprintQBox}><Text style={styles.sprintQText}>{sprintStarted && item ? item.stmt : 'Presiona el botón de abajo para empezar'}</Text></View>
                <View style={styles.sprintOpts}>
                  <TouchableOpacity style={[styles.sprintBtn, vOk && styles.sprintBtnOk, vBad && styles.sprintBtnBad]} onPress={() => answerSprint(true)} disabled={!sprintStarted || sprintPick !== null}><Text style={styles.sprintBtnText}>✅ Verdadero</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.sprintBtn, fOk && styles.sprintBtnOk, fBad && styles.sprintBtnBad]} onPress={() => answerSprint(false)} disabled={!sprintStarted || sprintPick !== null}><Text style={styles.sprintBtnText}>❌ Falso</Text></TouchableOpacity>
                </View>
              </>
            )}
          </View>
        );
      }

      // ---- 17 REFLEXIÓN ----
      case 17:
        return (
          <View>
            <Tag variant="reflect">✍️ Módulo 17 de 18 · Reflexión · +15 XP</Tag>
            <Text style={styles.title}>Tu nueva relación con la IA</Text>
            <Text style={styles.subtitle}>Este nivel te dio el "por qué" detrás de los LLMs. Ahora piensa en cómo cambia tu forma de usarlos.</Text>
            <View style={[styles.card, { backgroundColor: '#f0fdfa', borderColor: '#99f6e4' }]}>
              <View style={styles.cardRow}>
                <View style={[styles.cardIcon, { backgroundColor: '#99f6e4' }]}><Text style={{ fontSize: 19 }}>🤔</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Tu reflexión de cierre</Text>
                  <Text style={styles.cardText}>Responde al menos uno de estos puntos:{'\n\n'}<B>1. Un dato de este nivel que te sorprendió o no sabías antes (tokens, temperatura, alucinaciones, sesgos...).</B>{'\n\n'}<B>2. Algo concreto que vas a hacer diferente al usar un LLM a partir de hoy — algo que antes hacías "mal" sin saberlo.</B></Text>
                </View>
              </View>
            </View>
            <TextInput style={styles.reflectArea} multiline textAlignVertical="top" value={reflectText} onChangeText={setReflectText} placeholder="Ejemplo: Me sorprendió que los LLMs no buscan en internet — siempre creí que sí lo hacían. Ahora que sé que pueden alucinar, voy a dejar de citar datos de ChatGPT en mis trabajos sin verificarlos. También voy a empezar mis conversaciones con mi contexto personal para que el modelo me entienda mejor desde el inicio..." placeholderTextColor="#b8bcc0" />
            <Text style={styles.charCount}>{reflectText.length} / 80 mínimo</Text>
            <Hl variant="green">✅ <B>Habilidad real desbloqueada:</B>{'\n'}La mayoría de personas usa LLMs como una caja negra mágica. Tú ahora sabes cómo funcionan por dentro — y eso te hace un usuario radicalmente más efectivo y crítico.</Hl>
          </View>
        );

      // ---- 18 COMPLETADO ----
      case 18:
        return (
          <View style={{ alignItems: 'center', paddingHorizontal: 13, paddingTop: 18 }}>
            <View style={styles.completeBadge}><Text style={{ fontSize: 44 }}>🧠</Text></View>
            <Text style={styles.completeTitle}>¡Nivel 8 completado!</Text>
            <Text style={styles.completeSub}>Terminaste "Habla el lenguaje de la IA". Ya no eres un usuario común — entiendes tokens, temperatura, contexto, alucinaciones y sesgos como lo hacen los profesionales.</Text>
            <View style={styles.xpEarned}><Text style={styles.xpEarnedText}>⭐ {xp} XP ganados en este nivel</Text></View>
            <View style={{ alignSelf: 'stretch' }}>
              {[
                'Entiendo qué son los tokens y cómo afectan los límites y costos de los LLMs',
                'Sé cómo funciona la temperatura y cuándo usarla alta o baja',
                'Conozco los límites de la memoria y el contexto en los LLMs',
                'Puedo detectar y prevenir alucinaciones en respuestas de IA',
                'Identifico sesgos de datos, confirmación y culturales en los LLMs',
                'Elijo el modelo correcto (Claude, ChatGPT, Gemini, Grok) según la tarea',
              ].map((s, i) => (
                <View key={i} style={styles.skillRow}><Text style={styles.skillCheck}>✓</Text><Text style={styles.skillText}>{s}</Text></View>
              ))}
            </View>
            <View style={styles.nextHint}>
              <Text style={styles.cardText}>✨ <B>Nivel 9: Prompts Creativos</B>{'\n\n'}Ahora que entiendes cómo funciona la IA por dentro, vas a usar ese conocimiento para crear. Historias, personajes, canciones, juegos — todo construido con prompts que van más allá de lo básico.</Text>
            </View>
            <View style={styles.lvlBarWrap}>
              <Text style={styles.lvlBarLabel}>Nivel 8 de 36 completado · Mundo 2 — Domina el Prompting</Text>
              <View style={styles.lvlBarOuter}><View style={[styles.lvlBarInner, { width: '13%' }]} /></View>
            </View>
            <TouchableOpacity style={styles.mainBtn} onPress={finishLevel}><Text style={styles.mainBtnText}>Siguiente nivel →</Text></TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  // ---------- BOTÓN INFERIOR ----------
  const getBtn = (): { label: string; enabled: boolean; green: boolean; onPress: () => void; note?: string } | null => {
    switch (step) {
      case 0: return { label: '¡Empezar! →', enabled: true, green: false, onPress: next };
      case 1: return { label: 'Entendido, sigamos →', enabled: true, green: false, onPress: next };
      case 2: case 4: case 7: case 9: case 11: case 14: return { label: 'Entendido →', enabled: true, green: false, onPress: next };
      case 3: return { label: 'Continuar →', enabled: estimateTokens(tokenText) > 0, green: false, note: estimateTokens(tokenText) > 0 ? `~${estimateTokens(tokenText)} tokens estimados · Escribe más para ver cómo cambia` : 'Escribe algo para ver los tokens', onPress: next };
      case 5: return { label: 'Continuar →', enabled: true, green: false, onPress: next };
      case 6: return { label: tempOk ? 'Continuar →' : 'Verificar clasificación', enabled: true, green: false, note: tempOk ? undefined : 'Toca un chip → luego toca la columna donde va', onPress: () => { if (!tempOk) checkTemp(); else next(); } };
      case 8: {
        const answered = Object.keys(tfAnswers).length >= contextTF.length || devMode;
        return { label: tfChecked ? 'Continuar →' : 'Comprobar', enabled: tfChecked || answered, green: false, note: `Responde las ${contextTF.length} afirmaciones · hasta ${contextTF.length * 5} XP`, onPress: () => { if (!tfChecked) checkTF(); else next(); } };
      }
      case 10: {
        const done = matchedLeft.size >= matchPairs.length;
        return { label: done ? '¡Completado! Continuar →' : 'Conecta todos los pares', enabled: done, green: done, onPress: next };
      }
      case 12: return { label: hallChecked ? 'Continuar →' : 'Marcar como alucinación', enabled: hallChecked || hallSel !== null, green: false, note: hallChecked ? undefined : 'Toca el fragmento que crees que el LLM inventó · +15 XP', onPress: () => { if (!hallChecked) checkHall(); else next(); } };
      case 13: {
        const answered = Object.keys(quizAnswers).length >= quizItems.length || devMode;
        return { label: quizChecked ? 'Continuar →' : 'Comprobar respuestas', enabled: quizChecked || answered, green: quizChecked, note: `Responde las ${quizItems.length} preguntas · hasta ${quizItems.length * 8} XP`, onPress: () => { if (!quizChecked) checkQuiz(); else next(); } };
      }
      case 15: return { label: sesgoOk ? 'Continuar →' : 'Verificar clasificación', enabled: true, green: false, note: sesgoOk ? undefined : 'Toca un chip → luego toca la columna donde va', onPress: () => { if (!sesgoOk) checkSesgo(); else next(); } };
      case 16:
        if (!sprintStarted) return { label: 'Empezar Sprint ⚡', enabled: true, green: false, note: '60 segundos · Responde V/F lo más rápido posible · hasta 25 XP', onPress: startSprint };
        return { label: sprintDone ? 'Continuar →' : 'Sprint en curso...', enabled: sprintDone, green: false, onPress: next };
      case 17: return { label: 'Enviar reflexión →', enabled: reflectText.trim().length >= 80 || devMode, green: false, note: 'Escribe al menos 80 caracteres · +15 XP', onPress: () => { if (submitReflect()) next(); } };
      default: return null;
    }
  };

  const btn = getBtn();
  const showBack = theorySteps.has(step);
  const progressPercent = (step / (TOTAL_STEPS - 1)) * 100;

  return (
    <View style={styles.screen}>
      <View style={styles.lessonBar}>
        <TouchableOpacity onPress={handleClose} style={styles.closeBtn}><Text style={styles.closeBtnText}>✕</Text></TouchableOpacity>
        <View style={styles.progWrap}>
          <View style={styles.progTrack}><View style={[styles.progFill, { width: `${progressPercent}%` }]} /></View>
          <Text style={styles.progLabel}>{step === 0 ? 'Introducción' : step < TOTAL_STEPS - 1 ? `Módulo ${step} de ${CONTENT_STEPS}` : '¡Nivel completado!'}</Text>
        </View>
        <View style={styles.xpChip}><Text style={styles.xpChipText}>{xp} XP</Text></View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {renderStep()}
      </ScrollView>

      {btn && (
        <View style={styles.btnRow}>
          <View style={styles.btnRowInner}>
            {showBack && <TouchableOpacity style={styles.backBtn} onPress={prev}><Text style={styles.backBtnText}>← Volver</Text></TouchableOpacity>}
            <TouchableOpacity style={[styles.mainBtn, btn.green && styles.mainBtnGreen, !btn.enabled && styles.mainBtnDisabled, showBack && { flex: 1 }]} onPress={btn.onPress} disabled={!btn.enabled}>
              <Text style={styles.mainBtnText}>{btn.label}</Text>
            </TouchableOpacity>
          </View>
          {btn.note ? <Text style={styles.btnNote}>{btn.note}</Text> : null}
        </View>
      )}

      {xpToast && <XPToast key={xpToast.id} amount={xpToast.amount} onHide={() => setXpToast(null)} bgColor="#10b981" textColor="#fff" />}
    </View>
  );
}

// ===================== ESTILOS =====================
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },

  // Header
  lessonBar: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13, paddingTop: 11, paddingBottom: 9, borderBottomWidth: 1, borderBottomColor: '#ecfdf5', backgroundColor: '#ecfdf5' },
  closeBtn: { minWidth: 42, minHeight: 42, borderRadius: 10, backgroundColor: '#d1fae5', borderWidth: 1, borderColor: '#a7f3d0', alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 12, color: '#065f46', fontWeight: '800' },
  progWrap: { flex: 1 },
  progTrack: { height: 8, backgroundColor: '#d1fae5', borderRadius: 4, overflow: 'hidden' },
  progFill: { height: '100%', borderRadius: 4, backgroundColor: '#10b981' },
  progLabel: { fontSize: 10, color: '#94a3b8', marginTop: 3, fontWeight: '500' },
  xpChip: { paddingHorizontal: 11, paddingVertical: 4, borderRadius: 12, backgroundColor: '#fde68a', borderWidth: 1, borderColor: '#fcd34d' },
  xpChipText: { fontSize: 12, color: '#92400e', fontWeight: '700' },

  scrollView: { flex: 1 },
  scrollContent: { padding: 15, paddingBottom: 28 },

  // Tipografía
  tag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 11 },
  tagText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  lessonIcon: { width: 66, height: 66, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { ...typography.extraBold, fontSize: 19, color: '#0f172a', marginBottom: 7, lineHeight: 25 },
  subtitle: { ...typography.regular, fontSize: 13, color: '#64748b', marginBottom: 13, lineHeight: 22 },
  bodyText: { ...typography.regular, fontSize: 13, color: '#334155', lineHeight: 23, marginBottom: 11 },
  bold: { fontWeight: '700', color: '#0f172a' },
  italic: { fontStyle: 'italic', color: '#64748b' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#0f172a', marginTop: 13, marginBottom: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' },

  // Cards
  card: { borderRadius: 14, padding: 13, marginBottom: 9, borderWidth: 1 },
  cardRow: { flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  cardIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 12, fontWeight: '700', color: '#0f172a', marginBottom: 3 },
  cardText: { fontSize: 12, color: '#334155', lineHeight: 20 },

  // Step list
  stepRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 8 },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  stepNumText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  stepListText: { flex: 1, fontSize: 12, color: '#334155', lineHeight: 20 },

  // Highlight
  hlBox: { paddingHorizontal: 14, paddingVertical: 12, borderTopRightRadius: 12, borderBottomRightRadius: 12, borderLeftWidth: 3, marginVertical: 9 },
  hlText: { fontSize: 12, lineHeight: 20, fontWeight: '500' },

  // Ejemplos
  exCard: { borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 8, backgroundColor: '#fff' },
  exCardOpen: { borderColor: '#10b981', backgroundColor: '#f0fdf4' },
  exHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exEmoji: { width: 40, height: 40, backgroundColor: '#f1f5f9', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  exName: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  exSub: { fontSize: 11, color: '#64748b', marginTop: 1 },
  exBody: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#a7f3d0' },
  exTag: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginBottom: 6 },
  exTagText: { fontSize: 10, fontWeight: '700' },
  exHow: { fontSize: 12, color: '#334155', lineHeight: 21, marginBottom: 8 },
  exFact: { backgroundColor: '#fffbeb', padding: 9, borderRadius: 8, borderWidth: 1, borderColor: '#fde68a' },
  exFactText: { fontSize: 11, color: '#92400e', fontWeight: '500', lineHeight: 16 },

  // Token estimator
  tokenTextarea: { minHeight: 80, padding: 11, borderRadius: 10, borderWidth: 1.5, borderColor: '#a7f3d0', fontSize: 13, color: '#334155', lineHeight: 20, backgroundColor: '#f0fdf4' },
  tokenDisplay: { marginTop: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  tokenCount: { fontSize: 22, fontWeight: '800', color: '#10b981', textAlign: 'center', marginBottom: 4 },
  tokenLabel: { fontSize: 10, color: '#64748b', textAlign: 'center', marginBottom: 10, letterSpacing: 0.5 },
  tokenBarWrap: { height: 10, backgroundColor: '#e2e8f0', borderRadius: 5, overflow: 'hidden', marginBottom: 6 },
  tokenBar: { height: '100%', borderRadius: 5, backgroundColor: '#10b981' },
  tokenBarLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  tokenBarLabelText: { fontSize: 9, color: '#94a3b8' },
  tokenWords: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 },
  tokenWord: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  tokenWordText: { fontSize: 11, fontWeight: '600', color: '#065f46' },

  // VS grid
  vsGrid: { flexDirection: 'row', gap: 8, marginBottom: 11 },
  vsCol: { flex: 1, borderRadius: 12, padding: 11, borderWidth: 1, borderColor: '#e2e8f0' },
  vsHeader: { fontSize: 10, fontWeight: '700', marginBottom: 7, textAlign: 'center', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 7, overflow: 'hidden' },
  vsItem: { fontSize: 11, color: '#334155', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', lineHeight: 15 },

  // Temperature slider
  sliderTrack: { flexDirection: 'row', height: 24, borderRadius: 12, backgroundColor: '#d1fae5', alignItems: 'center', marginTop: 12, marginBottom: 8, overflow: 'hidden' },
  sliderStop: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 24 },
  sliderDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#94a3b8' },
  sliderDotActive: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', borderWidth: 3, borderColor: '#10b981' },
  tempLabel: { textAlign: 'center', fontSize: 13, fontWeight: '700', marginTop: 4 },
  tempLabelsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  tempLabelsSm: { fontSize: 10, color: '#94a3b8' },
  tempResponse: { borderRadius: 12, padding: 11, borderWidth: 2 },
  tempResLabel: { fontSize: 9, fontWeight: '700', color: '#64748b', letterSpacing: 0.5, marginBottom: 5, textTransform: 'uppercase' },
  tempResText: { fontSize: 12, color: '#334155', lineHeight: 20, fontStyle: 'italic' },

  // Drag & drop
  chipsPool: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 10, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 9, minHeight: 52, alignItems: 'center' },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: '#cbd5e1', backgroundColor: '#fff', minHeight: 40, justifyContent: 'center' },
  chipSel: { borderColor: '#10b981', backgroundColor: '#d1fae5' },
  chipText: { fontSize: 11, color: '#334155', fontWeight: '500' },
  poolDone: { fontSize: 11, color: '#94a3b8', alignSelf: 'center' },
  dropGrid2: { flexDirection: 'row', gap: 7, marginBottom: 8 },
  dropHeader: { fontSize: 10, fontWeight: '700', textAlign: 'center', marginBottom: 6, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 7, overflow: 'hidden' },
  dropCol: { borderRadius: 12, borderWidth: 2, borderStyle: 'dashed', borderColor: '#cbd5e1', minHeight: 90, padding: 7, backgroundColor: '#fafafa' },
  dropArea: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  dropChip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12, minHeight: 30, justifyContent: 'center' },
  dropChipText: { fontSize: 10, fontWeight: '600' },

  // Feedback
  feedbackBar: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 7 },
  fbOk: { backgroundColor: '#dcfce7' },
  fbWrong: { backgroundColor: '#fff1f2' },
  feedbackText: { fontSize: 12, lineHeight: 18, fontWeight: '500' },

  // TF
  tfQuestion: { fontSize: 12, fontWeight: '700', color: '#0f172a', lineHeight: 19, padding: 11, backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 8 },
  tfOpts: { flexDirection: 'row', gap: 7 },
  tfBtn: { flex: 1, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 11, borderWidth: 2, borderColor: '#e2e8f0', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', minHeight: 52 },
  tfBtnEmoji: { fontSize: 15 },
  tfBtnLabel: { fontSize: 10, fontWeight: '600', color: '#334155', marginTop: 3 },
  tfSelT: { borderColor: '#10b981', backgroundColor: '#f0fdf4' },
  tfSelF: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },
  tfCorrect: { borderColor: '#10b981', backgroundColor: '#dcfce7' },
  tfWrong: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },

  // Comparativa tabla
  cmpTable: { borderRadius: 10, overflow: 'hidden', marginVertical: 6, borderWidth: 1, borderColor: '#f1f5f9' },
  cmpRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center' },
  cmpHead: { backgroundColor: '#dcfce7', borderBottomWidth: 2, borderBottomColor: '#a7f3d0' },
  cmpCell: { paddingHorizontal: 6, paddingVertical: 8 },
  cmpHeadText: { fontSize: 11, color: '#166534', fontWeight: '700' },
  cmpCellText: { fontSize: 10, color: '#64748b', lineHeight: 14 },
  cmpBadge: { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  cmpBadgeText: { fontSize: 10, fontWeight: '700' },

  // Matching
  matchColLabel: { flex: 1, fontSize: 10, fontWeight: '700', color: '#64748b', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.3 },
  matchItem: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1.5, minHeight: 60, alignItems: 'center', justifyContent: 'center' },
  matchLeft: { borderColor: '#a7f3d0', backgroundColor: '#f0fdf4' },
  matchRight: { borderColor: '#99f6e4', backgroundColor: '#f0fdfa' },
  matchText: { fontSize: 11, fontWeight: '500', textAlign: 'center', lineHeight: 15 },
  matchSelSt: { borderColor: '#10b981', backgroundColor: '#d1fae5' },
  matchOk: { borderColor: '#10b981', backgroundColor: '#dcfce7' },
  matchWrongSt: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },

  // Scenario / hall
  scenarioBox: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 13, padding: 13, marginVertical: 9 },
  scenarioLabel: { fontSize: 9, fontWeight: '700', color: '#92400e', letterSpacing: 0.7, marginBottom: 7 },
  scenarioText: { fontSize: 12, color: '#334155', lineHeight: 21 },
  hallText: { fontSize: 12, color: '#334155', lineHeight: 24 },
  hallSpan: { borderRadius: 4 },
  hallSpanSel: { backgroundColor: '#fde68a', color: '#92400e', fontWeight: '700' },
  hallSpanCorrect: { backgroundColor: '#dcfce7', color: '#166534', fontWeight: '700' },
  hallSpanWrong: { backgroundColor: '#fff1f2', color: '#991b1b', fontWeight: '700' },

  // Quiz
  quizQ: { fontSize: 12, fontWeight: '700', color: '#0f172a', lineHeight: 18, padding: 11, backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 9 },
  qopt: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 10, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#fff', marginBottom: 6, minHeight: 44 },
  qoptSel: { borderColor: '#10b981', backgroundColor: '#d1fae5' },
  qoptOk: { borderColor: '#10b981', backgroundColor: '#dcfce7' },
  qoptBad: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },
  qoptLetter: { width: 22, height: 22, borderRadius: 6, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  qoptLetterSel: { backgroundColor: '#10b981', borderColor: '#10b981' },
  qoptLetterOk: { backgroundColor: '#10b981', borderColor: '#10b981' },
  qoptLetterBad: { backgroundColor: '#ef4444', borderColor: '#ef4444' },
  qoptLetterText: { fontSize: 10, fontWeight: '700', color: '#64748b' },
  qoptText: { flex: 1, fontSize: 11, color: '#334155', lineHeight: 17, fontWeight: '500' },

  // Sprint
  sprintTimer: { fontSize: 36, fontWeight: '800', textAlign: 'center', color: '#10b981', marginTop: 8, marginBottom: 4 },
  sprintBarWrap: { height: 8, backgroundColor: '#e2e8f0', borderRadius: 4, overflow: 'hidden', marginBottom: 12 },
  sprintBar: { height: '100%', borderRadius: 4, backgroundColor: '#10b981' },
  sprintScore: { textAlign: 'center', fontSize: 12, color: '#64748b', marginBottom: 6 },
  sprintQBox: { padding: 12, backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 9, minHeight: 52, justifyContent: 'center' },
  sprintQText: { fontSize: 13, fontWeight: '700', color: '#0f172a', lineHeight: 18 },
  sprintOpts: { flexDirection: 'row', gap: 8 },
  sprintBtn: { flex: 1, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 11, borderWidth: 2, borderColor: '#e2e8f0', backgroundColor: '#fff', alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  sprintBtnOk: { borderColor: '#10b981', backgroundColor: '#dcfce7' },
  sprintBtnBad: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },
  sprintBtnText: { fontSize: 12, fontWeight: '700', color: '#334155' },
  sprintResult: { padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 8, borderWidth: 1 },

  // Reflect
  reflectArea: { minHeight: 110, padding: 11, borderRadius: 10, borderWidth: 1.5, borderColor: '#e2e8f0', fontSize: 13, color: '#334155', lineHeight: 20, backgroundColor: '#fafafa' },
  charCount: { fontSize: 11, color: '#94a3b8', textAlign: 'right', marginTop: 4 },

  // Completado
  completeBadge: { width: 86, height: 86, borderRadius: 24, backgroundColor: '#a7f3d0', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  completeTitle: { fontSize: 21, fontWeight: '800', color: '#0f172a', marginBottom: 6, textAlign: 'center' },
  completeSub: { fontSize: 12, color: '#64748b', lineHeight: 20, marginBottom: 16, textAlign: 'center' },
  xpEarned: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 11, paddingHorizontal: 20, backgroundColor: '#fef9c3', borderRadius: 12, marginBottom: 14, borderWidth: 1, borderColor: '#fcd34d', alignSelf: 'stretch' },
  xpEarnedText: { fontSize: 15, fontWeight: '700', color: '#92400e' },
  skillRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: '#f0fdf4', borderRadius: 9, borderWidth: 1, borderColor: '#bbf7d0', marginBottom: 6 },
  skillCheck: { color: '#10b981', fontSize: 14, fontWeight: '700', marginTop: 1 },
  skillText: { flex: 1, fontSize: 11, color: '#166534', lineHeight: 16, fontWeight: '500' },
  nextHint: { alignSelf: 'stretch', padding: 11, backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginTop: 8, marginBottom: 13 },
  lvlBarWrap: { alignSelf: 'stretch', marginBottom: 14 },
  lvlBarLabel: { fontSize: 10, color: '#94a3b8', marginBottom: 4 },
  lvlBarOuter: { height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden' },
  lvlBarInner: { height: '100%', backgroundColor: '#10b981', borderRadius: 3 },

  // Botón inferior
  btnRow: { paddingHorizontal: 13, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', backgroundColor: '#fafcff' },
  btnRowInner: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  backBtn: { paddingVertical: 13, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#e2e8f0', minHeight: 48, justifyContent: 'center' },
  backBtnText: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  mainBtn: { flex: 1, padding: 13, borderRadius: 12, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  mainBtnGreen: { backgroundColor: '#059669' },
  mainBtnDisabled: { opacity: 0.32 },
  mainBtnText: { ...typography.bold, color: '#fff', fontSize: 14 },
  btnNote: { fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 5 },
});
