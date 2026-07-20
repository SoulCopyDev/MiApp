import { exitLevel } from '../utils/exitLevel';
import { router } from 'expo-router';
import { useState, useEffect, useRef, type ReactNode } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, BackHandler,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useGameStore } from '../store/gameStore';
import { useReportProgress } from '../components/LevelProgress';
import { colors, typography } from '../theme';
import XPToast from '../components/XPToast';

// ---------- Tipos ----------
type MCQ = { q?: string; opts: string[]; correct: number; explain: string };
type CompareCoT = { directo: { prompt: string; resp: string }; cot: { prompt: string; resp: string }; q: string; opts: string[]; correct: number; explain: string };
type TareaCompleja = { tarea: string; subtareas: string[]; errorComun: string };
type FillCoT = { base: string; campos: string[]; correcto: string };
type VFCoTItem = { stmt: string; correct: boolean; explain: string };
type ArbolItem = { condicion: string; accion: string; alternativa: string };
type RazonItem = { texto: string; tipo: string; label: string; explain: string };

const TOTAL_STEPS = 20; // 0: intro + 18 módulos + 19: completado
const CONTENT_STEPS = 18;
// "Volver" solo en módulos puramente informativos (leer + Continuar, sin ejercicio puntuado).
const THEORY_STEPS = new Set([1, 4, 7, 10, 13, 15]);

const pickN = <T,>(arr: T[], n: number): T[] => [...arr].sort(() => Math.random() - 0.5).slice(0, n);

// Baraja las opciones de un MCQ preservando cuál es la correcta.
function shuffleMCQ<T extends { opts: string[]; correct: number }>(q: T): T {
  const paired = q.opts.map((opt, i) => ({ opt, ok: i === q.correct }));
  for (let j = paired.length - 1; j > 0; j--) {
    const k = Math.floor(Math.random() * (j + 1));
    [paired[j], paired[k]] = [paired[k], paired[j]];
  }
  return { ...q, opts: paired.map((p) => p.opt), correct: paired.findIndex((p) => p.ok) };
}

// ---------- Validación heurística de inputs (offline, sin IA) ----------
const stripAccents = (s: string) => s.normalize('NFD').split('').filter((c) => c.charCodeAt(0) < 0x0300 || c.charCodeAt(0) > 0x036f).join('');
const normalize = (s: string) => stripAccents(s.toLowerCase());
const INSTRUCTION_RE = /(escrib|explic|analiz|traduc|resum|genera|crea|haz |hazme|dame|describe|compar|enumer|redact|disen|calcul|responde|elabor|propon|sugier|lista|convierte|corrig|mejora|resuelve|ordena|clasifica|define|identifica|planifica|planea|evalua|pondera|recomien|divide|construye|investiga|pide|verifica)/;

// Dobles de consonante que NO existen en español (ss, dd, fdf...) → señal de tecleo al azar.
const BAD_DOUBLE = /(ss|dd|ff|gg|jj|kk|pp|qq|vv|ww|yy|zz|hh|bb|mm|tt)/;
// Una palabra parece basura de teclado (assasasd, casdfd...) si tiene dobles inválidos,
// racimos de 5+ consonantes, o casi ninguna vocal.
function wordIsGibberish(w: string): boolean {
  const nw = normalize(w).replace(/[^a-z]/g, '');
  if (nw.length < 4) return false;
  if (!/[aeiou]/.test(nw)) return true;
  if (BAD_DOUBLE.test(nw)) return true;
  if (/[bcdfghjklmnpqrstvwxyz]{5,}/.test(nw)) return true;
  const vowels = (nw.match(/[aeiou]/g) || []).length;
  return nw.length >= 5 && vowels / nw.length < 0.25;
}
function looksRandom(raw: string): boolean {
  const words = raw.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const unique = new Set(words.map((w) => normalize(w)));
  if (unique.size < Math.min(4, words.length)) return true;
  const long = words.filter((w) => normalize(w).replace(/[^a-z]/g, '').length >= 4);
  if (long.length > 0 && long.filter(wordIsGibberish).length / long.length >= 0.5) return true;
  const withVowel = words.filter((w) => /[aeiou]/.test(normalize(w))).length;
  return withVowel / words.length < 0.6;
}
const notGibberish = (raw: string, minWords: number) => {
  const words = raw.trim().split(/\s+/).filter(Boolean);
  return words.length >= minWords && !looksRandom(raw);
};
const containsTopic = (text: string, terms: string[]) => {
  const t = normalize(text);
  const words = new Set(t.split(/[^a-z0-9]+/).filter(Boolean));
  return terms.some((k) => (k.length <= 3 ? words.has(k) : t.includes(k)));
};

type Eval = { ok: boolean; msg: string };
const fieldOk = (v: string) => v.trim().length >= 5 && !looksRandom(v);
function evalPrompt(text: string): Eval {
  const t = text.trim();
  if (!notGibberish(t, 8)) return { ok: false, msg: 'Escribe un prompt real y con sentido (al menos una frase completa, no texto al azar).' };
  if (!INSTRUCTION_RE.test(normalize(t))) return { ok: false, msg: 'Falta una instrucción clara: empieza con un verbo de acción (explica, analiza, escribe...).' };
  return { ok: true, msg: '' };
}
function evalVp(text: string): Eval {
  const t = text.trim();
  if (t.length < 15 || looksRandom(t)) return { ok: false, msg: 'Escribe una instrucción principal real (mín. 15 caracteres, no texto al azar).' };
  if (!INSTRUCTION_RE.test(normalize(t))) return { ok: false, msg: 'Empieza con un verbo de acción (explica, analiza, escribe...).' };
  return { ok: true, msg: '' };
}
function evalReasoning(text: string): Eval {
  if (!notGibberish(text.trim(), 10)) return { ok: false, msg: 'Escribe tu razonamiento con pasos reales (no texto al azar): explica cómo llegas a la respuesta.' };
  return { ok: true, msg: '' };
}
const REFLECT_TERMS = ['razon', 'paso', 'pensar', 'piensa', 'pienso', 'logic', 'cadena', 'cot', 'chain', 'ia', 'inteligencia', 'modelo', 'error', 'confiar', 'verific', 'trazab', 'proceso', 'conclusion', 'respuesta', 'detect'];
function evalReflect(text: string): Eval {
  const t = text.trim();
  if (!notGibberish(t, 10)) return { ok: false, msg: 'Escribe una reflexión real (una o dos frases con sentido, no texto al azar).' };
  if (!containsTopic(t, REFLECT_TERMS)) return { ok: false, msg: 'Responde al tema: ¿importa que la IA muestre su razonamiento paso a paso? ¿puedes confiar más si ves su lógica o el proceso?' };
  return { ok: true, msg: '' };
}

// ===================== POOLS =====================
const COMPARE_COT: CompareCoT = {
  directo: {
    prompt: '¿Cuántos segundos hay en una semana?',
    resp: '604,800 segundos. [Sin mostrar cómo llegó ahí — puede ser incorrecto sin que lo notes]',
  },
  cot: {
    prompt: 'Calcula cuántos segundos hay en una semana. Muéstrame cada paso del razonamiento: primero días, luego horas, luego minutos, luego segundos. Al final, verifica el resultado.',
    resp: 'Paso 1: 1 semana = 7 días. Paso 2: 7 × 24 = 168 horas. Paso 3: 168 × 60 = 10,080 minutos. Paso 4: 10,080 × 60 = 604,800 segundos. ✓ Verificación: 604,800 / 60 = 10,080 ✓',
  },
  q: '¿Por qué el segundo prompt es más valioso aunque el resultado numérico sea el mismo?',
  opts: [
    'Porque usa más palabras y la IA respeta mejor los prompts largos y detallados',
    'Porque muestra el razonamiento paso a paso y puedes ver en qué punto exacto falla',
    'Porque pedir una verificación activa un modo especial de precisión en el modelo',
    'Porque los prompts que dicen "primero, luego" siempre dan mejores resultados',
  ],
  correct: 1,
  explain: 'El valor del CoT no es el resultado — es la trazabilidad. Si hay un error, lo ves en el paso exacto donde ocurrió. Con el prompt directo, si el número fuera incorrecto, no tendrías forma de detectarlo sin recalcular tú mismo.',
};

const TAREAS_COMPLEJAS: TareaCompleja[] = [
  {
    tarea: 'Prepara una presentación de 10 slides sobre cambio climático para un congreso científico',
    subtareas: [
      'Define la estructura general y los títulos de los 10 slides',
      'Investiga los 3 datos más impactantes sobre cambio climático reciente',
      'Escribe el contenido de los slides 1-3 (introducción y contexto)',
      'Escribe el contenido de los slides 4-7 (causas y efectos)',
      'Diseña la conclusión y llamada a la acción (slides 8-10)',
    ],
    errorComun: 'Pedirlo todo en un solo prompt produce slides superficiales y desconectados.',
  },
  {
    tarea: 'Ayúdame a mejorar mi inglés para una entrevista de trabajo',
    subtareas: [
      'Evalúa mi nivel actual con 5 preguntas de diagnóstico',
      'Identifica mis errores más frecuentes en las respuestas anteriores',
      'Dame un plan de práctica de 2 semanas específico para entrevistas',
      'Simula una entrevista técnica y dame feedback detallado',
      'Crea 10 frases modelo para las preguntas más comunes de entrevista',
    ],
    errorComun: 'Un solo prompt no puede hacer diagnóstico + plan + práctica a la vez con profundidad.',
  },
];

const FILL_COT: FillCoT[] = [
  {
    base: 'Analiza los pros y contras de estudiar en el extranjero.',
    campos: [
      "Añade: 'Al terminar de analizar los pros, dime cuántos encontraste'",
      "Añade: 'Antes de los contras, resume los pros en una frase'",
      "Añade: 'Al final, dame tu conclusión más importante con un veredicto claro'",
    ],
    correcto: 'Analiza los pros y contras de estudiar en el extranjero. Al terminar los pros, dime cuántos encontraste. Antes de pasar a los contras, resume los pros en una frase. Al terminar, dame tu conclusión más importante con un veredicto claro: ¿vale la pena o no?',
  },
  {
    base: 'Escribe un ensayo sobre el impacto de las redes sociales.',
    campos: [
      "Añade: 'Primero crea un esquema con las 3 ideas principales'",
      "Añade: 'Escríbelo párrafo a párrafo, confirmando al inicio de cada uno cuál idea desarrollas'",
      "Añade: 'Al terminar, identifica el argumento más débil y cómo reforzarlo'",
    ],
    correcto: 'Escribe un ensayo sobre el impacto de las redes sociales. Primero crea un esquema con las 3 ideas principales. Luego escríbelo párrafo a párrafo, indicando al inicio de cada uno cuál idea desarrollas. Al terminar, identifica el argumento más débil y cómo reforzarlo.',
  },
];

// Módulo 5 (rediseñado): elegir el checkpoint correcto para cada punto del prompt.
const CP_EXERCISE = {
  base: 'Analiza los pros y contras de estudiar en el extranjero.',
  steps: [
    { titulo: 'Checkpoint 1 — al terminar de analizar los pros', opts: ['Al terminar los pros, dime cuántos encontraste antes de seguir', 'Ignora los pros y pasa directo a los contras', 'Hazlo lo más rápido posible, sin detenerte'], correct: 0, explain: 'Un checkpoint hace que la IA confirme un resultado parcial (cuántos pros) antes de avanzar, para no perder el hilo.' },
    { titulo: 'Checkpoint 2 — antes de pasar a los contras', opts: ['Antes de los contras, resume los pros en una sola frase', 'Antes de los contras, cambia el tema a otro país', 'Escribe los contras con la mayor cantidad de palabras posible'], correct: 0, explain: 'Resumir antes de avanzar obliga a la IA a consolidar lo anterior: es un checkpoint de síntesis.' },
    { titulo: 'Checkpoint 3 — al final', opts: ['Al final, dame tu conclusión con un veredicto claro: ¿vale la pena o no?', 'Al final, no des ninguna conclusión, solo la lista', 'Al final, inventa datos si no estás seguro'], correct: 0, explain: 'El checkpoint final fuerza una decisión concreta en vez de dejar la respuesta abierta.' },
  ],
  modelo: 'Analiza los pros y contras de estudiar en el extranjero. Al terminar los pros, dime cuántos encontraste. Antes de pasar a los contras, resume los pros en una frase. Al terminar, dame tu conclusión con un veredicto claro: ¿vale la pena o no?',
};

// Módulo 11 (rediseñado): elegir cuál de dos cadenas está mejor diseñada.
const CHAIN_CHOICE = [
  { task: 'Planifica una semana de estudio para un examen de química en 7 días', good: 'P1: Lista los 7 temas del examen. P2: Para cada tema, el concepto clave y una fórmula. P3: Diseña 2 ejercicios de práctica por tema con solución.', bad: 'Dame toda la planificación de la semana con los temas, las fórmulas y todos los ejercicios resueltos de una sola vez.', why: 'La cadena divide en pasos (temas → conceptos → ejercicios); cada uno recibe atención completa. El prompt único mezcla todo y la IA responde superficial.' },
  { task: 'Analiza las ventajas y desventajas de vivir en una ciudad grande vs. un pueblo', good: 'P1: Lista 5 ventajas y 5 desventajas de cada uno. P2: Pondéralas según calidad de vida, trabajo y costo. P3: Dame una recomendación según mi perfil.', bad: 'Dime de una vez si es mejor la ciudad o el pueblo, con todo el análisis y la conclusión en un solo texto.', why: 'Separar análisis → ponderación → recomendación evita que la IA salte a una conclusión sin fundamentar. El prompt único da una opinión sin respaldo.' },
  { task: 'Diseña un asistente de IA que ayude a estudiantes con tareas de matemáticas', good: 'P1: Define el perfil del estudiante ideal. P2: Diseña el system prompt (rol, tono, límites, ejemplos). P3: Crea 5 preguntas de prueba para verificar que funciona.', bad: 'Créame el asistente de matemáticas completo con todo lo necesario en un solo prompt bien detallado.', why: 'Diseñar por fases (perfil → configuración → prueba) produce un asistente probado. Pedirlo todo junto deja huecos sin verificar.' },
];

const VF_COT_POOL: VFCoTItem[] = [
  { stmt: "Añadir 'piénsalo paso a paso' a un prompt mejora significativamente la precisión en problemas que requieren razonamiento.", correct: true, explain: 'Esta técnica (Chain-of-Thought) fue demostrada en investigaciones de Google en 2022. Fuerza al modelo a generar pasos intermedios que anclan el razonamiento y reducen errores en cálculos y lógica.' },
  { stmt: 'Si un LLM muestra todos los pasos de su razonamiento, garantiza que el resultado final es correcto.', correct: false, explain: 'El modelo puede cometer errores en los pasos intermedios y llegar a una conclusión incorrecta de forma coherente con esos pasos. El CoT mejora la probabilidad de corrección, no la garantiza.' },
  { stmt: 'Una cadena de prompts de 3 pasos siempre produce mejores resultados que un prompt único largo.', correct: false, explain: 'Para tareas simples, la cadena es sobreingeniería — agrega complejidad sin beneficio. El CoT es valioso para razonamiento multistep, no para todas las tareas.' },
  { stmt: "Pedir a la IA que 'verifique su propia respuesta' puede detectar algunos errores que cometió.", correct: true, explain: 'Aunque no es infalible (puede validar un error con el mismo razonamiento), agregar "revisa y corrige si hay error" sí detecta inconsistencias obvias y mejora la confiabilidad en muchos casos.' },
  { stmt: 'Los LLMs razonan de forma similar a como los humanos resuelven problemas de lógica.', correct: false, explain: 'Los LLMs generan texto probable dado el contexto — no "razonan" en el sentido cognitivo humano. El CoT funciona porque guía al modelo a generar texto que sigue patrones de razonamiento correcto.' },
  { stmt: 'Dividir una tarea compleja en sub-prompts independientes generalmente produce mejor resultado que un mega-prompt.', correct: true, explain: 'Cada sub-tarea recibe toda la atención del modelo. En un mega-prompt, el modelo debe balancear múltiples instrucciones simultáneamente, lo que reduce la profundidad de cada respuesta.' },
  { stmt: "Si le pido a la IA que 'piense en voz alta', siempre obtengo exactamente cómo llegó a su conclusión.", correct: false, explain: 'El modelo genera texto que parece razonamiento, pero no es necesariamente el proceso real que produjo la respuesta. Es una representación post-hoc plausible, no un registro exacto.' },
  { stmt: 'Un prompt con checkpoints intermedios es especialmente útil para tareas de escritura larga.', correct: true, explain: 'En textos largos, los checkpoints evitan que el modelo pierda el hilo o desvíe el tema. Pedir confirmaciones parciales mantiene la coherencia del resultado final.' },
];

const ARBOL_ITEMS: ArbolItem[] = [
  { condicion: 'Si el usuario escribe algo en otro idioma', accion: 'Responde en el mismo idioma que usó', alternativa: 'Cambia al español automáticamente' },
  { condicion: 'Si no entiendes la pregunta', accion: 'Pide una aclaración antes de responder', alternativa: 'Inventa una interpretación y responde' },
  { condicion: 'Si la respuesta requiere más de 300 palabras', accion: 'Divide en secciones con subtítulos', alternativa: 'Responde todo en un párrafo sin estructura' },
  { condicion: 'Si el usuario dice que tu respuesta está mal', accion: 'Reconsidera el razonamiento y admite el error si es válido', alternativa: 'Insiste en que tu respuesta original es correcta' },
];

const RAZON_ITEMS: RazonItem[] = [
  { texto: "La IA dice: 'Einstein fue el científico más importante del siglo XX, por lo tanto todas sus teorías son correctas.'", tipo: 'falacia', label: '⚠️ Falacia lógica', explain: 'Argumento de autoridad: que alguien sea importante no hace automáticamente correcta cada afirmación. El mérito no se transfiere.' },
  { texto: "La IA dice: 'Los estudios muestran que el 60% de personas prefieren X. Por lo tanto, X es mejor para todo el mundo.'", tipo: 'salto', label: '🦘 Salto de conclusión', explain: "Salto de 'mayoría lo prefiere' a 'es mejor para todos'. La preferencia mayoritaria no implica superioridad universal — depende del contexto y del individuo." },
  { texto: "La IA dice: 'La capital de Australia es Sídney.' (La capital real es Canberra)", tipo: 'dato', label: '❌ Dato falso', explain: 'Alucinación clásica. Sídney es la ciudad más grande y conocida, lo que hace al modelo propenso a asumir que es la capital. Siempre verifica capitales, fechas y estadísticas.' },
  { texto: "La IA dice: 'Si X causa Y en ratas de laboratorio, entonces X causará exactamente lo mismo en humanos.'", tipo: 'falacia', label: '⚠️ Falacia lógica', explain: 'Generalización inválida: los resultados en modelos animales no se transfieren automáticamente a humanos. Es uno de los errores más comunes en divulgación científica.' },
  { texto: "La IA dice: 'Este autor publicó un artículo en 2019 argumentando Z.' (El artículo no existe)", tipo: 'dato', label: '❌ Dato falso', explain: 'Alucinación de cita bibliográfica. El modelo genera autores, títulos y años que suenan plausibles pero pueden no existir. Nunca uses una cita de IA sin verificarla.' },
];

const QUIZ_COT: MCQ[] = [
  {
    q: '¿Qué significa CoT en el contexto del prompting?',
    opts: [
      'Copy of Text: duplicar el contexto del prompt varias veces para reforzarlo',
      'Chain-of-Thought: pedir a la IA su razonamiento paso a paso de forma explícita',
      'Context of Terms: definir bien los términos técnicos antes de hacer la pregunta',
      'Correction of Tone: ajustar el tono del modelo antes de darle la tarea principal',
    ],
    correct: 1,
    explain: 'CoT = Chain-of-Thought. Es la técnica de añadir instrucciones como "piénsalo paso a paso" para forzar razonamiento intermedio visible.',
  },
  {
    q: 'Tienes que analizar 50 páginas de un documento. ¿Cuál es la estrategia más efectiva?',
    opts: [
      'Pegar todo el texto en un solo prompt y pedirle el análisis completo de una vez',
      'Dividir en secciones, hacer un prompt por cada una y luego integrar los resultados',
      'Pedirle que lea el documento completo repartido en varias conversaciones seguidas',
      'Copiar solo las conclusiones del documento y pedirle que las analice a fondo',
    ],
    correct: 1,
    explain: "Dividir en secciones permite profundidad real en cada parte. Un prompt con 50 páginas sufre de 'pérdida de atención' — el modelo procesa el final peor que el principio.",
  },
  {
    q: '¿Cuándo un prompt iterativo (ronda 1 → feedback → ronda 2) es más valioso que un único prompt?',
    opts: [
      'Siempre, porque el resultado mejora automáticamente con cada ronda que agregas',
      'Cuando la tarea necesita refinamiento progresivo: escritura, código o análisis',
      'Cuando el primer resultado fue completamente inútil y hay que empezar de cero',
      'Cuando tienes más de diez minutos disponibles para conversar con el modelo',
    ],
    correct: 1,
    explain: 'El prompting iterativo brilla en tareas donde la dirección inicial es correcta pero el resultado necesita pulirse: escritura creativa, código, argumentación. No es eficiente para preguntas factuales simples.',
  },
  {
    q: "Añades 'verifica tu respuesta al final y corrígela si hay error'. ¿Qué hace el modelo?",
    opts: [
      'Accede a internet en tiempo real para verificar que los datos sean correctos',
      'Activa un modo interno de mayor precisión distinto al que usa normalmente',
      'Genera una segunda pasada sobre su propia respuesta buscando inconsistencias',
      'Consulta una base de datos de respuestas ya verificadas por expertos humanos',
    ],
    correct: 2,
    explain: 'El modelo no tiene acceso a internet ni a bases de datos externas. Genera una segunda revisión de su texto buscando contradicciones internas — lo que sí puede detectar.',
  },
];

const ACERTIJO = {
  problema: 'Tengo hermanos y hermanas. Cada hijo de mis padres tiene el doble de hermanos que de hermanas — y yo soy mujer. ¿Cuántos hermanos y hermanas tengo?',
  hint: 'Usa variables. Sea H = hermanos, M = hermanas (incluyéndome). Para mí (mujer): hermanos = H, hermanas = M-1. La condición es H = 2(M-1).',
  solucion: 'Si H = 4 y M = 3: para mí, hermanos = 4, hermanas = 2. ¿Se cumple 4 = 2×2? Sí. Total: 4 hermanos + 3 hermanas.',
};

// ---------- Presentación (paleta fiel al CSS del HTML) ----------
function Bold({ children }: { children: ReactNode }) { return <Text style={styles.bold}>{children}</Text>; }
// Tags del template: la mayoría son esmeralda; quiz ámbar; reflexión pizarra.
const TAG_VARIANTS = { emerald: { bg: '#ecfdf5', fg: '#065f46' }, amber: { bg: '#fef3c7', fg: '#92400e' }, slate: { bg: '#f1f5f9', fg: '#475569' } };
function Tag({ variant = 'emerald', label }: { variant?: keyof typeof TAG_VARIANTS; label: string }) {
  const v = TAG_VARIANTS[variant];
  return <Text style={[styles.tag, { backgroundColor: v.bg, color: v.fg }]}>{label}</Text>;
}
// Card = layout card-row del HTML: chip de ícono 36×36 + columna (título + texto).
// Paleta: card-green #f0fdf4/#bbf7d0 · card-amber #fffbeb/#fde68a · card-slate #f8fafc/#e2e8f0
// · card-blue (no definida en el HTML → base blanca #fff/#e2e8f0 con chip azul #bfdbfe).
function Card({ bg, border, icon, iconBg, title, children }: { bg: string; border: string; icon?: string; iconBg?: string; title?: string; children: ReactNode }) {
  return (
    <View style={[styles.card, { backgroundColor: bg, borderColor: border }]}>
      <View style={styles.cardRow}>
        {icon ? <View style={[styles.cardIcon, { backgroundColor: iconBg }]}><Text style={styles.cardIconText}>{icon}</Text></View> : null}
        <View style={styles.cardContent}>
          {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
          <Text style={styles.cardText}>{children}</Text>
        </View>
      </View>
    </View>
  );
}
// Fondos de card según su clase HTML.
const CARD_BLUE = { bg: '#fff', border: '#e2e8f0', iconBg: '#bfdbfe' };
const CARD_GREEN = { bg: '#f0fdf4', border: '#bbf7d0', iconBg: '#bbf7d0' };
const CARD_AMBER = { bg: '#fffbeb', border: '#fde68a', iconBg: '#fde68a' };
const CARD_SLATE = { bg: '#f8fafc', border: '#e2e8f0', iconBg: '#e2e8f0' };
const HL = { blue: { bd: '#3b82f6', bg: '#eff6ff', fg: '#1e40af' }, red: { bd: '#ef4444', bg: '#fff1f2', fg: '#991b1b' }, amber: { bd: '#f59e0b', bg: '#fffbeb', fg: '#92400e' }, green: { bd: '#10b981', bg: '#f0fdf4', fg: '#166534' } };
function Hl({ variant, children }: { variant: keyof typeof HL; children: ReactNode }) {
  const v = HL[variant];
  return <View style={[styles.hl, { borderLeftColor: v.bd, backgroundColor: v.bg }]}><Text style={[styles.hlText, { color: v.fg }]}>{children}</Text></View>;
}

// ===================== COMPONENTE =====================
export default function World2Level5() {
  const completeLevel = useGameStore((state) => state.completeLevel);

  const [step, setStep] = useState(0);
  useReportProgress(step, TOTAL_STEPS);
  const [xp, setXp] = useState(0);
  const [xpToast, setXpToast] = useState<{ amount: number; id: number } | null>(null);

  // Pools aleatorios (fijados una vez)
  const tareaCompleja = useRef(pickN(TAREAS_COMPLEJAS, 1)[0]).current;
  const vfItems = useRef(pickN(VF_COT_POOL, 6)).current;
  const compareItem = useRef(shuffleMCQ(COMPARE_COT)).current;
  const quizItems = useRef(QUIZ_COT.map(shuffleMCQ)).current;

  // Compare (2)
  const [compareAnswered, setCompareAnswered] = useState(false);
  const [compareSel, setCompareSel] = useState<number | null>(null);

  // Builder 3 pasos (3)
  const [tema, setTema] = useState(''); const [p1, setP1] = useState(''); const [p2, setP2] = useState(''); const [p3, setP3] = useState('');
  const [chainBuilt, setChainBuilt] = useState(false);

  // Fill checkpoints (5) — elegir el checkpoint correcto (opción múltiple)
  const cpShuffled = useRef(CP_EXERCISE.steps.map(shuffleMCQ)).current;
  const [cpSel, setCpSel] = useState<(number | null)[]>([null, null, null]);
  const [cpChecked, setCpChecked] = useState(false);
  const [cpCorrect, setCpCorrect] = useState(0);

  // V/F (6)
  const [vfIdx, setVfIdx] = useState(0); const [vfScore, setVfScore] = useState(0);
  const [vfDone, setVfDone] = useState(false); const [vfSel, setVfSel] = useState<boolean | null>(null);

  // Matching árbol (8) — se baraja de qué lado aparece la acción correcta.
  const arbolFlip = useRef(ARBOL_ITEMS.map(() => Math.random() < 0.5)).current;
  const [arbolAnswers, setArbolAnswers] = useState<(number | null)[]>([null, null, null, null]);
  const [arbolChecked, setArbolChecked] = useState(false);
  const [arbolCorrect, setArbolCorrect] = useState(0);

  // Prompt iterativo (9)
  const [iterRound, setIterRound] = useState(1); const [iterText, setIterText] = useState(''); const [iterDone, setIterDone] = useState(false);

  // Elegir la mejor cadena (11) — se baraja de qué lado queda la buena.
  const chainFlip = useRef(CHAIN_CHOICE.map(() => Math.random() < 0.5)).current;
  const [chIdx, setChIdx] = useState(0); const [chSel, setChSel] = useState<number | null>(null);
  const [chScore, setChScore] = useState(0); const [chDone, setChDone] = useState(false);

  // Builder verificación (12)
  const [vpBase, setVpBase] = useState(''); const [vpBuilt, setVpBuilt] = useState(false);

  // Clasificador errores (14)
  const [razonIdx, setRazonIdx] = useState(0); const [razonScore, setRazonScore] = useState(0);
  const [razonDone, setRazonDone] = useState(false); const [razonSel, setRazonSel] = useState<number | null>(null);

  // Acertijo (16)
  const [acertijoText, setAcertijoText] = useState(''); const [acertijoDone, setAcertijoDone] = useState(false); const [acertijoSol, setAcertijoSol] = useState(false);

  // Quiz (17)
  const [quizIdx, setQuizIdx] = useState(0); const [quizScore, setQuizScore] = useState(0);
  const [quizDone, setQuizDone] = useState(false); const [quizSel, setQuizSel] = useState<number | null>(null);

  // Reflexión (18)
  const [reflectText, setReflectText] = useState(''); const [reflectAwarded, setReflectAwarded] = useState(false); const [reflectError, setReflectError] = useState<string | null>(null);

  const isActivity = !THEORY_STEPS.has(step) && step !== 0 && step !== TOTAL_STEPS - 1;

  useEffect(() => {
    const onBack = () => {
      if (isActivity) {
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
  }, [isActivity]);

  const addXP = (n: number) => { setXp((prev) => prev + n); if (n > 0) setXpToast((prev) => ({ amount: n, id: (prev?.id ?? 0) + 1 })); };
  const goToNextStep = () => { if (step < TOTAL_STEPS - 1) setStep(step + 1); };
  const goToPrevStep = () => setStep((s) => Math.max(0, s - 1));
  const handleFinish = () => {
    const stars = xp >= 180 ? 3 : xp >= 120 ? 2 : xp >= 60 ? 1 : 0;
    completeLevel(11, stars, xp);
    router.replace('/level/12');
  };

  // ---- Mecánicas ----
  const answerCOT = (i: number) => { if (compareAnswered) return; setCompareAnswered(true); setCompareSel(i); if (i === compareItem.correct) addXP(12); };

  const chainValid = fieldOk(tema) && fieldOk(p1) && fieldOk(p2) && fieldOk(p3);

  const cpAllSel = cpSel.every((s) => s !== null);
  const answerCp = (i: number, opt: number) => { if (cpChecked) return; setCpSel((prev) => { const n = [...prev]; n[i] = opt; return n; }); };
  const verifyCp = () => { if (cpChecked) return; let c = 0; cpShuffled.forEach((s, i) => { if (cpSel[i] === s.correct) c++; }); setCpCorrect(c); setCpChecked(true); if (c > 0) addXP(c * 5); };

  const answerVF = (ans: boolean) => { if (vfSel !== null) return; setVfSel(ans); if (ans === vfItems[vfIdx].correct) setVfScore((s) => s + 1); };
  const nextVf = () => { if (vfSel === null) return; if (vfIdx + 1 < vfItems.length) { setVfIdx((i) => i + 1); setVfSel(null); } else { setVfDone(true); addXP(vfScore * 8); } };

  const selArbol = (i: number, choice: number) => { if (arbolChecked) return; setArbolAnswers((prev) => { const n = [...prev]; n[i] = choice; return n; }); };
  const arbolAllAnswered = arbolAnswers.every((a) => a !== null);
  const checkArbol = () => {
    if (arbolChecked) return;
    let correct = 0; ARBOL_ITEMS.forEach((_, i) => { const cc = arbolFlip[i] ? 1 : 0; if (arbolAnswers[i] === cc) correct++; });
    setArbolCorrect(correct); setArbolChecked(true); if (correct > 0) addXP(correct * 8);
  };

  const iterEval = iterText.trim() ? evalPrompt(iterText) : null;
  const iterValid = iterEval?.ok ?? false;
  const advanceIter = () => {
    if (!iterValid) return;
    addXP(iterRound === 3 ? 20 : 8);
    if (iterRound < 3) { setIterRound((r) => r + 1); setIterText(''); } else { setIterDone(true); }
  };

  const answerChain = (choice: number) => { if (chSel !== null) return; setChSel(choice); const goodSide = chainFlip[chIdx] ? 1 : 0; if (choice === goodSide) setChScore((s) => s + 1); };
  const nextChain = () => { if (chSel === null) return; if (chIdx + 1 < CHAIN_CHOICE.length) { setChIdx((i) => i + 1); setChSel(null); } else { setChDone(true); addXP(chScore * 10); } };

  const vpEval = vpBase.trim() ? evalVp(vpBase) : null;
  const vpValid = vpEval?.ok ?? false;
  const commitVp = () => { if (!vpBuilt && vpValid) { setVpBuilt(true); addXP(10); } };

  const razonMap: Record<string, number> = { falacia: 0, salto: 1, dato: 2 };
  const answerRazon = (i: number) => { if (razonSel !== null) return; setRazonSel(i); if (i === razonMap[RAZON_ITEMS[razonIdx].tipo]) setRazonScore((s) => s + 1); };
  const nextRazon = () => { if (razonSel === null) return; if (razonIdx + 1 < RAZON_ITEMS.length) { setRazonIdx((i) => i + 1); setRazonSel(null); } else { setRazonDone(true); addXP(razonScore * 10); } };

  const acEval = acertijoText.trim() ? evalReasoning(acertijoText) : null;
  const acValid = acEval?.ok ?? false;
  const commitAcertijo = () => { if (!acertijoDone && acValid) { setAcertijoDone(true); addXP(15); } };

  const answerQuiz = (i: number) => { if (quizSel !== null) return; setQuizSel(i); if (i === quizItems[quizIdx].correct) setQuizScore((s) => s + 1); };
  const nextQuiz = () => { if (quizSel === null) return; if (quizIdx + 1 < quizItems.length) { setQuizIdx((i) => i + 1); setQuizSel(null); } else { setQuizDone(true); addXP(quizScore * 12); } };

  const refEval = reflectText.trim() ? evalReflect(reflectText) : null;
  const refValid = refEval?.ok ?? false;
  const submitReflect = (): boolean => {
    const res = evalReflect(reflectText);
    if (!res.ok) { setReflectError(res.msg); return false; }
    setReflectError(null); if (!reflectAwarded) { setReflectAwarded(true); addXP(15); } return true;
  };

  // Feedback de MCQ (compare / quiz)
  const mcqFeedback = (mcq: MCQ, chosen: number | null) => {
    if (chosen === null) return null;
    const ok = chosen === mcq.correct;
    return (
      <View style={[styles.fbBox, ok ? styles.fbOk : styles.fbBad]}>
        <Text style={[styles.fbText, ok ? styles.fbOkText : styles.fbBadText]}>
          {ok ? `✅ ${mcq.explain}` : `❌ No exactamente. La correcta: "${mcq.opts[mcq.correct]}". ${mcq.explain}`}
        </Text>
      </View>
    );
  };

  // ============ RENDER DE CADA PASO ============
  const renderStep = () => {
    switch (step) {
      case 0: return (
        <View>
          <Tag label="Nivel 11 · 18 módulos" />
          <View style={styles.iconCircle}><Text style={{ fontSize: 34 }}>🔗</Text></View>
          <Text style={styles.title}>Prompts en Cadena</Text>
          <Text style={styles.subtitle}>Un solo prompt resuelve el 60% de los problemas. Una cadena bien diseñada resuelve el 100%.</Text>
          <Card {...CARD_BLUE} icon="🎯" title="Qué vas a aprender">
            Chain-of-Thought prompting · Dividir tareas complejas · Prompts con checkpoints · Árbol de decisiones · Detectar errores de razonamiento
          </Card>
          <Hl variant="blue"><Bold>La analogía de la receta:</Bold> Un chef no cocina todos los platos mezclados en una sola olla. Divide el proceso en pasos, verifica cada uno, y el resultado es mucho mejor.</Hl>
        </View>
      );
      case 1: return (
        <View>
          <Tag label="📐 Módulo 1 · Casos reales" />
          <Text style={styles.titleSm}>La magia del "piénsalo paso a paso"</Text>
          <Text style={styles.subtitle}>Un experimento real: el mismo problema, dos prompts.</Text>
          <Card {...CARD_SLATE} icon="🧮" title="Problema">
            Si Juan tiene 3 veces más manzanas que María, y juntos tienen 48, ¿cuántas tiene cada uno?
          </Card>
          <View style={styles.compareRow}>
            <View style={[styles.comparePanel, { backgroundColor: '#fff7ed', borderColor: '#fed7aa' }]}>
              <Text style={[styles.compareLabel, { color: '#c2410c' }]}>Sin cadena</Text>
              <Text style={styles.compareText}>"Juan tiene 36 y María 12." [No hay forma de saber si llegó correctamente]</Text>
            </View>
            <View style={[styles.comparePanel, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
              <Text style={[styles.compareLabel, { color: '#065f46' }]}>Con "paso a paso"</Text>
              <Text style={styles.compareText}>"Paso 1: Sea M = manzanas de María. Paso 2: Juan tiene 3M. Paso 3: M + 3M = 48 → 4M = 48 → M = 12. Paso 4: Juan = 36. Verificación: 12 + 36 = 48 ✓"</Text>
            </View>
          </View>
          <Hl variant="blue"><Bold>Por qué importa más allá de las matemáticas:</Bold> El razonamiento visible te permite detectar el error exacto. Sin los pasos, si el resultado es incorrecto, no sabes dónde falló — ni si falló.</Hl>
        </View>
      );
      case 2: return (
        <View>
          <Tag label="🔗 Módulo 2 · Prompt-compare" />
          <Text style={styles.titleSm}>Antes vs. después del Chain-of-Thought</Text>
          <View style={styles.compareRow}>
            <View style={[styles.comparePanel, { backgroundColor: '#fff7ed', borderColor: '#fed7aa' }]}>
              <Text style={[styles.compareLabel, { color: '#c2410c' }]}>Prompt directo</Text>
              <Text style={styles.compareMono}>{compareItem.directo.prompt}</Text>
              <Text style={styles.compareText}>{compareItem.directo.resp}</Text>
            </View>
            <View style={[styles.comparePanel, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
              <Text style={[styles.compareLabel, { color: '#065f46' }]}>Prompt CoT</Text>
              <Text style={styles.compareMono}>{compareItem.cot.prompt}</Text>
              <Text style={styles.compareText}>{compareItem.cot.resp}</Text>
            </View>
          </View>
          <Text style={styles.qText}>{compareItem.q}</Text>
          {compareItem.opts.map((opt, i) => (
            <TouchableOpacity key={i} style={[styles.optionBtn, compareSel === i && styles.optSel, compareAnswered && i === compareItem.correct && styles.optCorrect, compareAnswered && compareSel === i && i !== compareItem.correct && styles.optWrong]} onPress={() => answerCOT(i)} disabled={compareAnswered}>
              <Text style={styles.optText}>{opt}</Text>
            </TouchableOpacity>
          ))}
          {mcqFeedback(compareItem, compareSel)}
        </View>
      );
      case 3: return (
        <View>
          <Tag label="🛠️ Módulo 3 · Builder" />
          <Text style={styles.titleSm}>Construye un prompt de 3 pasos</Text>
          <Text style={styles.subtitle}>Elige una tarea compleja y divídela en: Análisis → Opciones → Decisión.</Text>
          <Hl variant="blue"><Bold>Estructura base:</Bold>{'\n'}Paso 1: Analiza [situación] y lista los factores clave.{'\n'}Paso 2: Dame 3 opciones con pros y contras de cada una.{'\n'}Paso 3: Recomienda la mejor opción y justifica por qué.</Hl>
          <Text style={styles.label}>Tu tema o situación a resolver</Text>
          <TextInput style={styles.input} placeholder="Ej: qué carrera estudiar, cómo mejorar mi rutina de estudio..." placeholderTextColor="#b8bcc0" value={tema} onChangeText={setTema} />
          <Text style={styles.label}>Paso 1 — ¿Qué debe analizar primero?</Text>
          <TextInput style={styles.input} placeholder="Ej: mis intereses, mi presupuesto, mis fortalezas..." placeholderTextColor="#b8bcc0" value={p1} onChangeText={setP1} />
          <Text style={styles.label}>Paso 2 — ¿Cuántas opciones y qué criterios comparar?</Text>
          <TextInput style={styles.input} placeholder="Ej: 3 opciones comparadas en costo, tiempo y dificultad..." placeholderTextColor="#b8bcc0" value={p2} onChangeText={setP2} />
          <Text style={styles.label}>Paso 3 — ¿Qué tipo de recomendación final quieres?</Text>
          <TextInput style={styles.input} placeholder="Ej: la más realista para mi situación actual..." placeholderTextColor="#b8bcc0" value={p3} onChangeText={setP3} />
          {chainValid && (
            <View style={styles.builderResult}>
              <Text style={styles.builderResultText}>
                <Bold>Prompt 1:</Bold> Analiza mi situación de {tema}. Factores clave: {p1}.{'\n\n'}
                <Bold>Prompt 2:</Bold> Basándote en ese análisis, dame {p2}.{'\n\n'}
                <Bold>Prompt 3:</Bold> Con todo lo anterior, recomiéndame {p3}. Justifica paso a paso.
              </Text>
            </View>
          )}
        </View>
      );
      case 4: return (
        <View>
          <Tag label="📦 Módulo 4 · Divide y vencerás" />
          <Text style={styles.titleSm}>Divide y vencerás</Text>
          <Text style={styles.subtitle}>Una tarea compleja se convierte en una cadena de 5 sub-prompts manejables.</Text>
          <Card {...CARD_SLATE} icon="🎯" title="Tarea compleja"><Text style={styles.italic}>{tareaCompleja.tarea}</Text></Card>
          <Hl variant="red"><Bold>Error común:</Bold> {tareaCompleja.errorComun}</Hl>
          <Text style={styles.label}>División en 5 sub-prompts:</Text>
          {tareaCompleja.subtareas.map((s, i) => (
            <View key={i} style={styles.subRow}>
              <View style={styles.subNum}><Text style={styles.subNumText}>{i + 1}</Text></View>
              <Text style={styles.subText}>{s}</Text>
            </View>
          ))}
          <Hl variant="blue"><Bold>La regla:</Bold> Si un prompt requiere más de 3 "y además", divídelo. Cada sub-prompt recibe atención completa del modelo.</Hl>
        </View>
      );
      case 5: return (
        <View>
          <Tag label="📍 Módulo 5 · Fill-in-blank" />
          <Text style={styles.titleSm}>Añade checkpoints al prompt</Text>
          <Text style={styles.subtitle}>Un checkpoint hace que la IA se detenga y confirme un resultado parcial. Elige la instrucción correcta para cada punto.</Text>
          <Card {...CARD_SLATE} icon="📋" title="Prompt base"><Text style={styles.italic}>"{CP_EXERCISE.base}"</Text></Card>
          {cpShuffled.map((s, i) => (
            <View key={i}>
              <Text style={styles.label}>{s.titulo}</Text>
              {s.opts.map((o, j) => (
                <TouchableOpacity key={j} style={[styles.optionBtn, cpSel[i] === j && styles.optSel, cpChecked && j === s.correct && styles.optCorrect, cpChecked && cpSel[i] === j && j !== s.correct && styles.optWrong]} onPress={() => answerCp(i, j)} disabled={cpChecked}>
                  <Text style={styles.optText}>{o}</Text>
                </TouchableOpacity>
              ))}
              {cpChecked && (
                <Text style={[styles.arbolFb, cpSel[i] === s.correct ? styles.fbOkText : styles.fbBadText]}>{cpSel[i] === s.correct ? '✅ ' : '❌ '}{s.explain}</Text>
              )}
            </View>
          ))}
          {cpChecked && (
            <View style={styles.builderResult}><Text style={styles.builderResultText}>✅ {cpCorrect}/3 correctas · +{cpCorrect * 5} XP. Prompt con checkpoints: {CP_EXERCISE.modelo}</Text></View>
          )}
        </View>
      );
      case 6: return (
        <View>
          <Tag label={vfDone ? '✅ Resultado V/F' : `✔ V/F · ${vfIdx + 1}/${vfItems.length}`} />
          {!vfDone ? (
            <>
              <Text style={styles.vfStmt}>{vfItems[vfIdx].stmt}</Text>
              <View style={styles.row}>
                <TouchableOpacity style={[styles.vfBtn, styles.vfTrue, vfSel === true && styles.vfOn]} onPress={() => answerVF(true)} disabled={vfSel !== null}><Text style={styles.vfBtnText}>✅ Verdadero</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.vfBtn, styles.vfFalse, vfSel === false && styles.vfOnBad]} onPress={() => answerVF(false)} disabled={vfSel !== null}><Text style={styles.vfBtnText}>❌ Falso</Text></TouchableOpacity>
              </View>
              {vfSel !== null && (
                <View style={[styles.fbBox, vfSel === vfItems[vfIdx].correct ? styles.fbOk : styles.fbBad]}>
                  <Text style={[styles.fbText, vfSel === vfItems[vfIdx].correct ? styles.fbOkText : styles.fbBadText]}>
                    {vfSel === vfItems[vfIdx].correct ? '✅ ' : `❌ Incorrecto. La respuesta correcta es "${vfItems[vfIdx].correct ? 'Verdadero' : 'Falso'}". `}{vfItems[vfIdx].explain}
                  </Text>
                </View>
              )}
            </>
          ) : (
            <View style={[styles.fbBox, vfScore >= 5 ? styles.fbOk : styles.fbAmber]}>
              <Text style={styles.resultBig}>{vfScore}/{vfItems.length} correctas 🎯</Text>
              <Text style={[styles.fbText, vfScore >= 5 ? styles.fbOkText : styles.fbAmberText]}>+{vfScore * 8} XP. {vfScore >= 5 ? 'Entiendes bien las capacidades y límites del razonamiento en LLMs.' : 'Recuerda: el CoT mejora pero no garantiza. El modelo simula razonamiento, no lo realiza como un humano.'}</Text>
            </View>
          )}
        </View>
      );
      case 7: return (
        <View>
          <Tag label="🌍 Módulo 7 · Casos reales" />
          <Text style={styles.titleSm}>Chain-of-Thought en acción</Text>
          <Text style={styles.subtitle}>3 situaciones cotidianas donde el razonamiento paso a paso marca la diferencia.</Text>
          <Card {...CARD_BLUE} icon="🔬" title="Caso 1: Análisis de texto literario">
            <Bold>Sin CoT: </Bold>"Analiza el simbolismo en El Principito."{'\n'}<Bold>Con CoT: </Bold>"Identifica 3 símbolos en El Principito. Para cada uno: 1) qué objeto/personaje lo representa, 2) qué simboliza, 3) cita una frase del libro que lo confirme."{'\n'}<Text style={styles.caseArrow}>→ El CoT obliga precisión en cada argumento.</Text>
          </Card>
          <Card {...CARD_BLUE} icon="📊" title="Caso 2: Tomar una decisión compleja">
            <Bold>Sin CoT: </Bold>"¿Debería estudiar ingeniería o diseño?"{'\n'}<Bold>Con CoT: </Bold>"Primero lista 5 características de cada carrera. Luego compáralas según: salida laboral, habilidades requeridas y tiempo de estudio. Finalmente recomienda basándote solo en lo que analizaste."{'\n'}<Text style={styles.caseArrow}>→ La recomendación está fundamentada, no es una opinión aleatoria.</Text>
          </Card>
          <Card {...CARD_BLUE} icon="📝" title="Caso 3: Corregir un texto">
            <Bold>Sin CoT: </Bold>"Corrige este ensayo."{'\n'}<Bold>Con CoT: </Bold>"Analiza este ensayo en 3 pasadas: 1) errores gramaticales, 2) claridad de argumentos, 3) coherencia general. En cada pasada, lista los problemas antes de corregirlos."{'\n'}<Text style={styles.caseArrow}>→ Correcciones organizadas y justificadas, no una reescritura aleatoria.</Text>
          </Card>
        </View>
      );
      case 8: return (
        <View>
          <Tag label="🌳 Módulo 8 · Matching" />
          <Text style={styles.titleSm}>Árbol de decisiones para tu IA</Text>
          <Text style={styles.subtitle}>Diseña las reglas de comportamiento de un asistente. Para cada condición, elige la acción correcta.</Text>
          {ARBOL_ITEMS.map((item, i) => {
            const flip = arbolFlip[i];
            const leftText = flip ? item.alternativa : item.accion;
            const rightText = flip ? item.accion : item.alternativa;
            const chosen = arbolAnswers[i];
            const isRight = chosen === (flip ? 1 : 0);
            return (
              <View key={i} style={styles.arbolCard}>
                <Text style={styles.arbolCond}>Si: <Text style={styles.italic}>{item.condicion}</Text></Text>
                <View style={styles.row}>
                  <TouchableOpacity style={[styles.treeOpt, chosen === 0 && styles.treeSel]} onPress={() => selArbol(i, 0)} disabled={arbolChecked}><Text style={styles.treeText}>{leftText}</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.treeOpt, chosen === 1 && styles.treeSel]} onPress={() => selArbol(i, 1)} disabled={arbolChecked}><Text style={styles.treeText}>{rightText}</Text></TouchableOpacity>
                </View>
                {arbolChecked && (
                  <Text style={[styles.arbolFb, isRight ? styles.fbOkText : styles.fbBadText]}>{isRight ? '✅ Correcto' : `❌ La correcta era: "${item.accion}"`}</Text>
                )}
              </View>
            );
          })}
          {arbolChecked && (
            <View style={[styles.fbBox, arbolCorrect >= 3 ? styles.fbOk : styles.fbAmber]}>
              <Text style={[styles.fbText, arbolCorrect >= 3 ? styles.fbOkText : styles.fbAmberText]}>{arbolCorrect >= 3 ? '✅ ' : '⚠️ '}{arbolCorrect}/4 correctas · +{arbolCorrect * 8} XP. Un árbol bien diseñado define una IA predecible y útil.</Text>
            </View>
          )}
        </View>
      );
      case 9: return (
        <View>
          <Tag label={iterDone ? '✅ Prompt iterativo completado' : `🔄 Módulo 9 · Builder iterativo · Ronda ${iterRound}/3`} />
          {iterDone ? (
            <View style={[styles.fbBox, styles.fbOk]}>
              <Text style={styles.resultBig}>3 rondas completadas</Text>
              <Text style={[styles.fbText, styles.fbOkText]}>+36 XP acumulados. Este proceso iterativo es exactamente cómo los profesionales usan los LLMs — raramente se quedan con el primer resultado.</Text>
            </View>
          ) : (
            <>
              <Text style={styles.subtitle}>Proceso iterativo: cada ronda mejora la anterior.</Text>
              <Card {...CARD_BLUE}>
                {iterRound === 1 ? 'Ronda 1: escribe el prompt inicial para un asistente de estudio de historia.' :
                 iterRound === 2 ? 'Ronda 2: pide un refinamiento específico sobre lo anterior (qué mejorar y cómo).' :
                 'Ronda 3: instrucción de cierre y verificación (resumen o esquema final).'}
              </Card>
              <TextInput style={styles.textArea} multiline placeholder={iterRound === 1 ? 'Ej: Actúa como tutor de historia para 10°. Explícame las causas de la Primera Guerra Mundial...' : iterRound === 2 ? 'Ej: Eso está bien, pero quiero que cada causa tenga un ejemplo con fecha y su conexión con el inicio de la guerra...' : 'Ej: Ahora resume todo en un esquema de máximo 10 puntos para repasar 30 minutos antes del examen...'} placeholderTextColor="#b8bcc0" value={iterText} onChangeText={setIterText} />
              {iterEval && !iterValid && <Text style={styles.hint}>💡 {iterEval.msg}</Text>}
            </>
          )}
        </View>
      );
      case 10: return (
        <View>
          <Tag label="⚖️ Módulo 10 · Escenarios" />
          <Text style={styles.titleSm}>Cuándo usar cadenas y cuándo no</Text>
          <Text style={styles.subtitle}>No todo necesita una cadena. Aquí los 4 casos con criterio claro.</Text>
          <Card {...CARD_GREEN} icon="✅" title="Útil: tarea de múltiples fases">"Escribir un informe de investigación" → fase de investigación + estructuración + redacción + revisión. Cada fase se beneficia de atención completa.</Card>
          <Card {...CARD_GREEN} icon="✅" title="Necesario: razonamiento lógico complejo">Cualquier problema donde un error en el paso 2 invalida el paso 3. Matemáticas, lógica, análisis legal.</Card>
          <Card {...CARD_AMBER} icon="⚠️" title="Sobreingeniería: pregunta factual simple">"¿Cuándo nació Simón Bolívar?" no necesita cadena. Un prompt directo es suficiente — dividirlo agrega complejidad sin beneficio.</Card>
          <Card {...CARD_AMBER} icon="⚠️" title="Innecesario: tarea creativa libre">"Escríbeme un poema sobre el mar" — demasiadas restricciones de proceso pueden limitar la creatividad. A veces el prompt libre produce lo mejor.</Card>
        </View>
      );
      case 11: return (
        <View>
          <Tag label="⚡ Módulo 11 · Sprint" />
          <Text style={styles.titleSm}>¿Cuál cadena está mejor diseñada?</Text>
          {chDone ? (
            <View style={[styles.fbBox, chScore >= 2 ? styles.fbOk : styles.fbAmber]}>
              <Text style={styles.resultBig}>{chScore}/{CHAIN_CHOICE.length} correctas 🏁</Text>
              <Text style={[styles.fbText, chScore >= 2 ? styles.fbOkText : styles.fbAmberText]}>+{chScore * 10} XP. Reconocer una buena cadena es el primer paso para diseñarla tú.</Text>
            </View>
          ) : (
            <>
              <Text style={styles.subtitle}>Para esta tarea, elige la opción con la cadena de prompts mejor dividida ({chIdx + 1}/{CHAIN_CHOICE.length}).</Text>
              <Card {...CARD_BLUE}>{CHAIN_CHOICE[chIdx].task}</Card>
              {[0, 1].map((side) => {
                const goodSide = chainFlip[chIdx] ? 1 : 0;
                const text = side === goodSide ? CHAIN_CHOICE[chIdx].good : CHAIN_CHOICE[chIdx].bad;
                return (
                  <TouchableOpacity key={side} style={[styles.optionBtn, chSel === side && styles.optSel, chSel !== null && side === goodSide && styles.optCorrect, chSel === side && side !== goodSide && styles.optWrong]} onPress={() => answerChain(side)} disabled={chSel !== null}>
                    <Text style={styles.optLabel}>Opción {side === 0 ? 'A' : 'B'}</Text>
                    <Text style={styles.optText}>{text}</Text>
                  </TouchableOpacity>
                );
              })}
              {chSel !== null && (
                <View style={[styles.fbBox, chSel === (chainFlip[chIdx] ? 1 : 0) ? styles.fbOk : styles.fbBad]}>
                  <Text style={[styles.fbText, chSel === (chainFlip[chIdx] ? 1 : 0) ? styles.fbOkText : styles.fbBadText]}>{chSel === (chainFlip[chIdx] ? 1 : 0) ? '✅ ' : '❌ '}{CHAIN_CHOICE[chIdx].why}</Text>
                </View>
              )}
            </>
          )}
        </View>
      );
      case 12: return (
        <View>
          <Tag label="🔍 Módulo 12 · Builder" />
          <Text style={styles.titleSm}>El prompt que se verifica a sí mismo</Text>
          <Text style={styles.subtitle}>Añade una capa de auto-verificación a cualquier prompt. Construye uno a partir de una tarea base.</Text>
          <Hl variant="blue"><Bold>Patrón de auto-verificación:</Bold> [Tu instrucción]. Al terminar, revisa tu respuesta: 1) ¿respondí exactamente lo que se pedía? 2) ¿hay contradicciones internas? 3) ¿los datos son precisos? Si encuentras un error, corrígelo antes de terminar.</Hl>
          <Text style={styles.label}>Escribe tu instrucción principal</Text>
          <TextInput style={styles.textArea} multiline placeholder="Ej: Explícame las 3 leyes de Newton con un ejemplo cotidiano para cada una..." placeholderTextColor="#b8bcc0" value={vpBase} onChangeText={setVpBase} />
          {vpEval && !vpValid && <Text style={styles.hint}>💡 {vpEval.msg}</Text>}
          {vpValid && (
            <View style={styles.builderResult}>
              <Text style={styles.builderResultText}>{vpBase.trim()}. Al terminar, revisa: 1) ¿respondiste exactamente lo que se pidió? 2) ¿hay contradicciones? 3) ¿los datos son precisos? Corrige cualquier error antes de terminar.</Text>
            </View>
          )}
        </View>
      );
      case 13: return (
        <View>
          <Tag label="🎓 Módulo 13 · Casos reales" />
          <Text style={styles.titleSm}>La IA como tutor paso a paso</Text>
          <Text style={styles.subtitle}>3 materias escolares — 3 cadenas de prompts que realmente funcionan.</Text>
          <Card {...CARD_GREEN} icon="🧪" title="Ciencias: entender un concepto difícil">
            <Bold>P1:</Bold> Explícame [concepto] con una analogía cotidiana. Máximo 3 párrafos.{'\n'}<Bold>P2:</Bold> Ahora dame 2 ejemplos del mundo real donde este concepto aplica.{'\n'}<Bold>P3:</Bold> Hazme 3 preguntas para verificar que entendí. No me des las respuestas aún.
          </Card>
          <Card {...CARD_GREEN} icon="📜" title="Historia: análisis de evento">
            <Bold>P1:</Bold> Lista las 5 causas de [evento histórico] ordenadas de más a menos importante.{'\n'}<Bold>P2:</Bold> Para la causa #1, dame 3 evidencias históricas que la respalden.{'\n'}<Bold>P3:</Bold> ¿Qué habría cambiado si esa causa no hubiera ocurrido?
          </Card>
          <Card {...CARD_GREEN} icon="🔢" title="Matemáticas: resolver paso a paso">
            <Bold>P1:</Bold> Explícame el método para resolver [tipo de problema]. Solo el método, sin resolverlo.{'\n'}<Bold>P2:</Bold> Ahora aplica ese método a este problema: [problema]. Muestra cada paso.{'\n'}<Bold>P3:</Bold> Diseña un problema similar para que yo lo practique. Dame la solución solo si la pido.
          </Card>
        </View>
      );
      case 14: return (
        <View>
          <Tag label={razonDone ? '✅ Clasificador completado' : `🔎 Módulo 14 · Clasificador · ${razonIdx + 1}/${RAZON_ITEMS.length}`} />
          {!razonDone ? (
            <>
              <Text style={styles.subtitle}>Clasifica el error en este razonamiento de la IA.</Text>
              <Card {...CARD_SLATE}><Text style={styles.italic}>"{RAZON_ITEMS[razonIdx].texto}"</Text></Card>
              {['⚠️ Falacia lógica — argumento inválido', '🦘 Salto de conclusión — generalización inválida', '❌ Dato falso — información incorrecta o inventada'].map((label, i) => (
                <TouchableOpacity key={i} style={[styles.optionBtn, razonSel === i && styles.optSel, razonSel !== null && i === razonMap[RAZON_ITEMS[razonIdx].tipo] && styles.optCorrect, razonSel === i && i !== razonMap[RAZON_ITEMS[razonIdx].tipo] && styles.optWrong]} onPress={() => answerRazon(i)} disabled={razonSel !== null}>
                  <Text style={styles.optText}>{label}</Text>
                </TouchableOpacity>
              ))}
              {razonSel !== null && (
                <View style={[styles.fbBox, razonSel === razonMap[RAZON_ITEMS[razonIdx].tipo] ? styles.fbOk : styles.fbBad]}>
                  <Text style={[styles.fbText, razonSel === razonMap[RAZON_ITEMS[razonIdx].tipo] ? styles.fbOkText : styles.fbBadText]}>{razonSel === razonMap[RAZON_ITEMS[razonIdx].tipo] ? '✅ ' : '❌ '}{RAZON_ITEMS[razonIdx].label}: {RAZON_ITEMS[razonIdx].explain}</Text>
                </View>
              )}
            </>
          ) : (
            <View style={[styles.fbBox, razonScore >= 4 ? styles.fbOk : styles.fbAmber]}>
              <Text style={styles.resultBig}>{razonScore}/{RAZON_ITEMS.length} correctas</Text>
              <Text style={[styles.fbText, razonScore >= 4 ? styles.fbOkText : styles.fbAmberText]}>+{razonScore * 10} XP. {razonScore >= 4 ? 'Detectas errores de razonamiento que la mayoría ignora.' : 'La práctica de clasificar errores agudiza tu criterio crítico.'}</Text>
            </View>
          )}
        </View>
      );
      case 15: return (
        <View>
          <Tag label="🧠 Módulo 15 · Reflexión conceptual" />
          <Text style={styles.titleSm}>¿Qué tan profundo puede pensar un LLM?</Text>
          <Text style={styles.subtitle}>Límites reales del razonamiento en modelos de lenguaje actuales.</Text>
          <Card {...CARD_AMBER} icon="⚠️" title="Lo que el CoT NO resuelve">El CoT mejora la coherencia del texto — no el acceso a información que el modelo no tiene. Si la información no está en el entrenamiento, el razonamiento paso a paso no la va a encontrar.</Card>
          <Card {...CARD_SLATE} icon="🔬" title="Lo que la ciencia dice (2024)">Los LLMs actuales pueden hacer razonamiento lógico simple, aritmética básica y análisis textual con CoT. Fallan en razonamiento espacial complejo, lógica modal y problemas que requieren comprensión causal profunda.</Card>
          <Card {...CARD_GREEN} icon="✅" title="La regla práctica">Si un problema requiere "sentido común" acumulado por años de experiencia vivida o intuición física del mundo real, el LLM va a fallar incluso con CoT. Para eso, todavía necesitas al humano.</Card>
        </View>
      );
      case 16: return (
        <View>
          <Tag label="🧩 Módulo 16 · Reto" />
          <Text style={styles.titleSm}>Resuelve el acertijo con CoT</Text>
          <Text style={styles.subtitle}>Antes de escribir la respuesta, escribe los pasos de tu razonamiento.</Text>
          <Card {...CARD_SLATE}>{ACERTIJO.problema}</Card>
          <Hl variant="blue"><Bold>Pista: </Bold>{ACERTIJO.hint}</Hl>
          <Text style={styles.label}>Tu razonamiento paso a paso</Text>
          <TextInput style={styles.textArea} multiline placeholder="Paso 1: ... Paso 2: ... Paso 3: ... Respuesta: ..." placeholderTextColor="#b8bcc0" value={acertijoText} onChangeText={setAcertijoText} />
          {acEval && !acValid && <Text style={styles.hint}>💡 {acEval.msg}</Text>}
          <TouchableOpacity style={styles.ghostBtn} onPress={() => setAcertijoSol(true)}><Text style={styles.ghostText}>Ver solución modelo</Text></TouchableOpacity>
          {acertijoSol && (
            <View style={[styles.fbBox, styles.fbOk]}><Text style={[styles.fbText, styles.fbOkText]}><Bold>Solución: </Bold>{ACERTIJO.solucion}</Text></View>
          )}
        </View>
      );
      case 17: return (
        <View>
          <Tag variant="amber" label={quizDone ? '✅ Quiz completado' : `🧠 Módulo 17 · Quiz · ${quizIdx + 1}/${quizItems.length}`} />
          {!quizDone ? (
            <>
              <Text style={styles.qText}>{quizItems[quizIdx].q}</Text>
              {quizItems[quizIdx].opts.map((opt, i) => (
                <TouchableOpacity key={i} style={[styles.optionBtn, quizSel === i && styles.optSel, quizSel !== null && i === quizItems[quizIdx].correct && styles.optCorrect, quizSel === i && i !== quizItems[quizIdx].correct && styles.optWrong]} onPress={() => answerQuiz(i)} disabled={quizSel !== null}>
                  <Text style={styles.optText}>{opt}</Text>
                </TouchableOpacity>
              ))}
              {quizSel !== null && mcqFeedback(quizItems[quizIdx], quizSel)}
            </>
          ) : (
            <View style={[styles.fbBox, quizScore >= 3 ? styles.fbOk : styles.fbAmber]}>
              <Text style={styles.resultBig}>{quizScore}/{quizItems.length} correctas</Text>
              <Text style={[styles.fbText, quizScore >= 3 ? styles.fbOkText : styles.fbAmberText]}>+{quizScore * 12} XP.</Text>
            </View>
          )}
        </View>
      );
      case 18: return (
        <View>
          <Tag variant="slate" label="💬 Módulo 18 · Reflexión" />
          <Text style={styles.titleSm}>¿La diferencia importa?</Text>
          <Text style={styles.subtitle}>IA que piensa vs. IA que responde.</Text>
          <TextInput style={styles.reflectArea} multiline placeholder="Ej: creo que la diferencia sí importa porque cuando le pido que piense paso a paso puedo seguir su lógica y detectar errores. Cuando solo responde, no sé si confiar..." placeholderTextColor="#b8bcc0" value={reflectText} onChangeText={(t) => { setReflectText(t); if (reflectError) setReflectError(null); }} />
          <Text style={styles.charCount}>{reflectText.trim().length} / mínimo 50 caracteres</Text>
          {reflectError && <View style={[styles.fbBox, styles.fbBad]}><Text style={[styles.fbText, styles.fbBadText]}>❌ {reflectError}</Text></View>}
          <Hl variant="blue">✅ Esta reflexión queda en tu portafolio IA Explorer.</Hl>
        </View>
      );
      case 19: return (
        <View style={{ alignItems: 'center', padding: 4 }}>
          <View style={styles.completeIcon}><Text style={{ fontSize: 44 }}>🏅</Text></View>
          <Text style={[styles.title, { textAlign: 'center' }]}>¡Nivel 11 completado!</Text>
          <Text style={[styles.subtitle, { textAlign: 'center' }]}>Badge: 🔗 Chain Master desbloqueado. Ahora construyes secuencias de prompts que la mayoría de adultos no sabe usar.</Text>
          <View style={styles.xpEarned}><Text style={styles.xpEarnedText}>⭐ {xp} XP ganados</Text></View>
          <View style={styles.skillsBox}>
            {['Entiendo qué es Chain-of-Thought y cuándo aplicarlo', 'Dividí tareas complejas en sub-prompts manejables', 'Construí prompts iterativos de 3 rondas', 'Detecté falacias, saltos de conclusión y datos falsos', 'Conozco los límites reales del razonamiento en LLMs'].map((skill, i) => (
              <View key={i} style={styles.skillRow}><Text style={styles.skillCheck}>✓</Text><Text style={styles.skillText}>{skill}</Text></View>
            ))}
          </View>
          <View style={styles.nextHint}>
            <Text style={styles.nextHintText}>🔑 <Bold>Nivel 12: Trucos Secretos{'\n\n'}</Bold>Zero-shot, few-shot, system prompts, temperatura máxima/mínima, ReAct. Los trucos que usan los ingenieros de IA. El nivel final del Mundo 2.</Text>
          </View>
          <View style={styles.lvlBarWrap}>
            <Text style={styles.lvlBarLabel}>Nivel 11 de 36 completado · Mundo 2 — Domina el Prompting</Text>
            <View style={styles.lvlBarOuter}><View style={styles.lvlBarInner} /></View>
          </View>
          <TouchableOpacity style={styles.completeBtn} onPress={handleFinish} activeOpacity={0.85}><Text style={styles.mainButtonText}>Siguiente nivel →</Text></TouchableOpacity>
        </View>
      );
      default: return null;
    }
  };

  // ============ BOTÓN / HABILITACIÓN ============
  const canProceed = (() => {
    switch (step) {
      case 2: return compareAnswered;
      case 3: return chainBuilt || chainValid;
      case 5: return cpChecked || cpAllSel;
      case 6: return vfDone || vfSel !== null;
      case 8: return arbolChecked || arbolAllAnswered;
      case 9: return iterDone || iterValid;
      case 11: return chDone || chSel !== null;
      case 12: return vpBuilt || vpValid;
      case 14: return razonDone || razonSel !== null;
      case 16: return acertijoDone || acValid;
      case 17: return quizDone || quizSel !== null;
      case 18: return reflectText.trim().length >= 50;
      default: return true;
    }
  })();

  const getBtnLabel = () => {
    switch (step) {
      case 0: return '¡Empezar! →';
      case 5: return cpChecked ? 'Continuar →' : 'Verificar →';
      case 6: return vfDone ? 'Continuar →' : 'Siguiente →';
      case 8: return arbolChecked ? 'Continuar →' : 'Verificar árbol →';
      case 9: return iterDone ? 'Continuar →' : (iterRound < 3 ? 'Siguiente ronda →' : 'Completar →');
      case 11: return chDone ? 'Continuar →' : 'Siguiente →';
      case 14: return razonDone ? 'Continuar →' : 'Siguiente →';
      case 17: return quizDone ? 'Continuar →' : 'Siguiente →';
      case 18: return 'Completar nivel →';
      default: return 'Continuar →';
    }
  };

  const handleMainBtn = () => {
    if (!canProceed) return;
    switch (step) {
      case 3: if (!chainBuilt) { setChainBuilt(true); addXP(10); } break;
      case 5: if (!cpChecked) { verifyCp(); return; } break;
      case 6: if (!vfDone) { nextVf(); return; } break;
      case 8: if (!arbolChecked) { checkArbol(); return; } break;
      case 9: if (!iterDone) { advanceIter(); return; } break;
      case 11: if (!chDone) { nextChain(); return; } break;
      case 12: if (!vpBuilt) { commitVp(); } break;
      case 14: if (!razonDone) { nextRazon(); return; } break;
      case 16: if (!acertijoDone) { commitAcertijo(); } break;
      case 17: if (!quizDone) { nextQuiz(); return; } break;
      case 18: if (!submitReflect()) return; break;
    }
    goToNextStep();
  };

  const progressPercent = (step / (TOTAL_STEPS - 1)) * 100;
  const progressLabel = step === 0 ? 'Introducción' : step < TOTAL_STEPS - 1 ? `Módulo ${step} de ${CONTENT_STEPS}` : '¡Nivel completado!';
  const showFooter = step < TOTAL_STEPS - 1;
  const showBack = THEORY_STEPS.has(step);

  return (
    <View style={styles.screen}>
      <View style={styles.progressBar}>
        <TouchableOpacity onPress={() => exitLevel()} style={styles.closeBtn}><MaterialIcons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
        <View style={styles.progressCol}>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progressPercent}%` }]} /></View>
          <Text style={styles.progressLabel}>{progressLabel}</Text>
        </View>
        <Text style={styles.xpText}>{xp} XP</Text>
      </View>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">{renderStep()}</ScrollView>
      {xpToast && <XPToast key={xpToast.id} amount={xpToast.amount} onHide={() => setXpToast(null)} bgColor="#10b981" textColor="#fff" />}
      {showFooter && (
        <View style={styles.footerRow}>
          {showBack && (
            <TouchableOpacity style={styles.backButton} onPress={goToPrevStep}><Text style={styles.backButtonText}>← Volver</Text></TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.mainButton, !canProceed && styles.mainButtonDisabled]} onPress={handleMainBtn} disabled={!canProceed} activeOpacity={0.85}>
            <Text style={styles.mainButtonText}>{getBtnLabel()}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ===================== ESTILOS =====================
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  progressBar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  closeBtn: { padding: 4 },
  progressCol: { flex: 1, marginHorizontal: 12 },
  progressTrack: { height: 8, backgroundColor: colors.borderLight, borderRadius: 4 },
  progressFill: { height: '100%', backgroundColor: '#10b981', borderRadius: 4 },
  progressLabel: { fontSize: 10, color: '#94a3b8', marginTop: 3, fontWeight: '500' },
  // Pastilla de XP como el HTML (.xp-chip: fondo ámbar #fef3c7→#fde68a, borde #fcd34d).
  xpText: { ...typography.bold, fontSize: 12, color: '#92400e', backgroundColor: '#fde68a', borderWidth: 1, borderColor: '#fcd34d', paddingHorizontal: 11, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  tag: { alignSelf: 'flex-start', fontSize: 11, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 12, letterSpacing: 0.4, overflow: 'hidden' },
  iconCircle: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#dbeafe', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  title: { ...typography.extraBold, fontSize: 19, color: colors.textPrimary, marginBottom: 8, lineHeight: 25 },
  titleSm: { ...typography.extraBold, fontSize: 16, color: colors.textPrimary, marginBottom: 8, lineHeight: 22 },
  subtitle: { ...typography.regular, fontSize: 13, color: colors.textSecondary, marginBottom: 14, lineHeight: 20 },
  bold: { fontWeight: 'bold', color: colors.textPrimary },
  italic: { fontStyle: 'italic' },
  card: { borderRadius: 14, padding: 13, marginBottom: 9, borderWidth: 1 },
  cardRow: { flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  cardIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  cardIconText: { fontSize: 19 },
  cardContent: { flex: 1 },
  cardTitle: { ...typography.bold, fontSize: 13, color: colors.textPrimary, marginBottom: 3 },
  cardText: { ...typography.regular, fontSize: 12, color: '#334155', lineHeight: 18 },
  hl: { borderLeftWidth: 3, padding: 12, borderTopRightRadius: 12, borderBottomRightRadius: 12, marginTop: 9, marginBottom: 13 },
  hlText: { fontSize: 12, lineHeight: 18, fontWeight: '500' },
  label: { fontSize: 11, fontWeight: '700', color: '#374151', marginBottom: 4, marginTop: 10 },
  input: { borderWidth: 1.5, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 12, backgroundColor: '#f8fafc', marginBottom: 8, color: colors.textPrimary },
  textArea: { borderWidth: 1.5, borderColor: '#cbd5e1', borderRadius: 10, padding: 12, minHeight: 90, fontSize: 12, backgroundColor: '#f8fafc', marginBottom: 4, color: colors.textPrimary, textAlignVertical: 'top' },
  reflectArea: { borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, padding: 11, minHeight: 110, fontSize: 13, backgroundColor: '#fafafa', marginBottom: 4, color: colors.textPrimary, textAlignVertical: 'top', lineHeight: 20 },
  charCount: { fontSize: 11, color: '#94a3b8', textAlign: 'right', marginTop: 2, marginBottom: 6 },
  hint: { fontSize: 11, color: '#1e40af', backgroundColor: '#eff6ff', borderRadius: 8, padding: 9, marginTop: 4, marginBottom: 4, lineHeight: 15, borderWidth: 1, borderColor: '#bfdbfe' },
  qText: { ...typography.bold, fontSize: 13, color: colors.textPrimary, padding: 11, backgroundColor: '#f8fafc', borderRadius: 10, marginBottom: 9, borderWidth: 1, borderColor: '#e2e8f0', lineHeight: 18 },
  // Compare panels
  compareRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  comparePanel: { flex: 1, borderRadius: 12, padding: 11, borderWidth: 1.5 },
  compareLabel: { ...typography.bold, fontSize: 10, textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.4 },
  compareText: { fontSize: 11, color: '#334155', lineHeight: 16, marginTop: 4 },
  compareMono: { fontSize: 11, color: '#334155', lineHeight: 16, fontFamily: 'monospace' },
  // Options (MCQ)
  optionBtn: { padding: 11, borderRadius: 11, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#fff', marginBottom: 7 },
  optSel: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
  optCorrect: { borderColor: '#10b981', backgroundColor: '#dcfce7' },
  optWrong: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },
  optText: { fontSize: 12, color: '#334155', lineHeight: 17, fontWeight: '500' },
  optLabel: { fontSize: 10, fontWeight: '700', color: '#64748b', marginBottom: 3, textTransform: 'uppercase' },
  // V/F
  row: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  vfStmt: { fontSize: 13, color: '#0f172a', fontWeight: '600', lineHeight: 19, marginBottom: 12, padding: 13, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  vfBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 2, alignItems: 'center', minHeight: 52, justifyContent: 'center' },
  vfTrue: { borderColor: '#bbf7d0', backgroundColor: '#f0fdf4' },
  vfFalse: { borderColor: '#fecdd3', backgroundColor: '#fff1f2' },
  vfOn: { borderColor: '#10b981', backgroundColor: '#dcfce7' },
  vfOnBad: { borderColor: '#ef4444', backgroundColor: '#fee2e2' },
  vfBtnText: { fontSize: 13, fontWeight: '700', color: '#334155' },
  // Sub-prompts (divide)
  subRow: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: '#eff6ff', borderColor: '#bfdbfe', borderWidth: 1, borderRadius: 12, padding: 11, marginBottom: 6 },
  subNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#bfdbfe', justifyContent: 'center', alignItems: 'center' },
  subNumText: { fontSize: 12, fontWeight: '700', color: '#1e40af' },
  subText: { flex: 1, fontSize: 12, color: '#334155', lineHeight: 17 },
  // Árbol
  arbolCard: { borderWidth: 1.5, borderColor: '#bfdbfe', borderRadius: 12, padding: 11, marginBottom: 8, backgroundColor: '#eff6ff' },
  arbolCond: { fontSize: 11, fontWeight: '700', color: '#1e40af', marginBottom: 6 },
  treeOpt: { flex: 1, padding: 9, borderRadius: 9, borderWidth: 2, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  treeSel: { borderColor: '#3b82f6', backgroundColor: '#dbeafe' },
  treeText: { fontSize: 11, fontWeight: '600', color: '#334155' },
  arbolFb: { fontSize: 11, fontWeight: '600', marginTop: 7 },
  // Sprint
  timer: { fontSize: 30, fontWeight: '800', textAlign: 'center', color: '#1e40af', marginBottom: 6 },
  timerTrack: { height: 8, backgroundColor: '#e2e8f0', borderRadius: 4, overflow: 'hidden', marginBottom: 10 },
  timerFill: { height: '100%', backgroundColor: '#3b82f6', borderRadius: 4 },
  actionBtn: { flex: 1, padding: 12, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  actionGhost: { backgroundColor: '#eff6ff', borderWidth: 1.5, borderColor: '#bfdbfe' },
  actionText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  ghostBtn: { backgroundColor: '#eff6ff', borderWidth: 1.5, borderColor: '#bfdbfe', paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  ghostText: { ...typography.bold, color: '#1e40af', fontSize: 13 },
  // Feedback boxes
  fbBox: { borderRadius: 10, padding: 12, marginTop: 8, marginBottom: 4 },
  fbOk: { backgroundColor: '#dcfce7' },
  fbBad: { backgroundColor: '#fff1f2' },
  fbAmber: { backgroundColor: '#fffbeb' },
  fbText: { fontSize: 12, lineHeight: 18, fontWeight: '500' },
  fbOkText: { color: '#166534' },
  fbBadText: { color: '#991b1b' },
  fbAmberText: { color: '#92400e' },
  resultBig: { fontSize: 15, fontWeight: '800', color: '#0f172a', textAlign: 'center', marginBottom: 6 },
  // Complete
  completeIcon: { width: 86, height: 86, borderRadius: 24, backgroundColor: '#93c5fd', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  xpEarned: { backgroundColor: '#fef9c3', borderRadius: 12, padding: 11, marginBottom: 14, borderWidth: 1, borderColor: '#fcd34d', width: '100%' },
  xpEarnedText: { fontSize: 15, fontWeight: '700', color: '#92400e', textAlign: 'center' },
  skillsBox: { backgroundColor: '#eff6ff', borderRadius: 12, padding: 13, marginBottom: 14, borderWidth: 1, borderColor: '#bfdbfe', width: '100%' },
  skillRow: { flexDirection: 'row', gap: 8, marginBottom: 7 },
  skillCheck: { color: '#1e40af', fontWeight: '700', fontSize: 14 },
  skillText: { fontSize: 12, color: '#334155', lineHeight: 18, flex: 1 },
  nextHint: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#e2e8f0', width: '100%' },
  nextHintText: { fontSize: 12, color: '#334155', lineHeight: 20 },
  lvlBarWrap: { width: '100%', marginBottom: 14 },
  lvlBarLabel: { fontSize: 10, color: '#94a3b8', marginBottom: 4 },
  lvlBarOuter: { height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden' },
  lvlBarInner: { height: '100%', width: '31%', backgroundColor: '#3b82f6', borderRadius: 3 },
  // Footer
  footerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 8, borderTopWidth: 1, borderTopColor: colors.borderLight, backgroundColor: colors.background },
  backButton: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, paddingVertical: 14, paddingHorizontal: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  backButtonText: { ...typography.bold, color: colors.textSecondary, fontSize: 14 },
  mainButton: { flex: 1, backgroundColor: colors.success, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  mainButtonDisabled: { opacity: 0.4 },
  mainButtonText: { ...typography.bold, color: '#fff', fontSize: 15 },
  completeBtn: { width: '100%', backgroundColor: colors.success, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  // Caja de resultado del builder (HTML .builder-result.filled: fondo #ecfdf5, borde #a7f3d0).
  builderResult: { backgroundColor: '#ecfdf5', borderWidth: 1.5, borderColor: '#a7f3d0', borderRadius: 12, padding: 12, marginTop: 10 },
  builderResultText: { fontSize: 12, color: '#065f46', lineHeight: 18 },
  caseArrow: { fontSize: 11, color: '#1e40af', lineHeight: 16 },
});
