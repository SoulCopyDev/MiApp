import { useState, useEffect, useRef, type ReactNode } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, BackHandler, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useGameStore } from '../store/gameStore';
import { typography } from '../theme';
import { exitLevel } from '../utils/exitLevel';
import XPToast from '../components/XPToast';

// ===================== HELPERS DE VALIDACIÓN =====================
const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Detecta texto al azar: teclazos sin vocales o mucha repetición de palabras
function looksRandom(text: string): boolean {
  const words = normalize(text).split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return true;
  const noVowels = words.filter(w => w.length >= 4 && !/[aeiou]/.test(w));
  if (noVowels.length >= Math.max(1, Math.floor(words.length / 2))) return true;
  if (words.length >= 4) {
    const unique = new Set(words);
    if (unique.size / words.length < 0.5) return true;
  }
  return false;
}

const INSTRUCTION_VERBS = ['escribe', 'genera', 'crea', 'haz', 'redacta', 'explica', 'resume', 'clasifica', 'traduce', 'analiza', 'lista', 'dame', 'diseña', 'corrige', 'mejora', 'responde', 'actua', 'eres', 'resuelve', 'compara', 'evalua', 'identifica', 'describe', 'elabora', 'propon', 'sugiere'];
function hasInstructionVerb(text: string): boolean {
  const t = normalize(text);
  return INSTRUCTION_VERBS.some(v => new RegExp(`\\b${v}`).test(t));
}

const REFLECT_TERMS = ['prompt', 'prompts', 'ia', 'tecnica', 'tecnicas', 'shot', 'system', 'temperatura', 'cot', 'react', 'ejemplo', 'ejemplos', 'domino', 'dominar', 'practicar', 'practico', 'aprender', 'aprendi', 'cuesta', 'falta', 'libreria', 'refinamiento', 'maestro', 'combinar'];
function mentionsTopic(text: string): boolean {
  const t = normalize(text);
  return REFLECT_TERMS.some(term =>
    term.length <= 3 ? new RegExp(`\\b${term}\\b`).test(t) : t.includes(term)
  );
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let j = a.length - 1; j > 0; j--) {
    const k = Math.floor(Math.random() * (j + 1));
    [a[j], a[k]] = [a[k], a[j]];
  }
  return a;
}
// Baraja las opciones de una pregunta preservando cuál es la correcta
function shuffleOpts<T extends { opts: string[]; correct: number }>(q: T): T {
  const paired = q.opts.map((opt, i) => ({ opt, isCorrect: i === q.correct }));
  const sh = shuffle(paired);
  return { ...q, opts: sh.map(p => p.opt), correct: sh.findIndex(p => p.isCorrect) };
}

const MONO = Platform.select({ ios: 'Courier', default: 'monospace' });

// ===================== DATOS (fieles al HTML nivel-12) =====================
const COMPARE_ONESHOT = {
  sinEj: {
    prompt: 'Escribe un título atractivo para un artículo sobre productividad estudiantil.',
    resp: '10 consejos para mejorar tu productividad como estudiante',
  },
  conEj: {
    prompt: "Escribe un título atractivo para un artículo sobre productividad estudiantil. Ejemplo del estilo que quiero: 'Por qué estudiar 8 horas seguidas destruye tu memoria (y qué hacer en su lugar)'",
    resp: 'El error que comete el 90% de estudiantes antes de un examen — y cómo evitarlo',
  },
  q: '¿Qué aportó el ejemplo al resultado?',
  opts: [
    'Hizo el prompt más largo, y los prompts más largos siempre producen respuestas de mejor calidad',
    'Definió el tono, el formato y el estilo concreto — el modelo capturó el patrón y lo replicó',
    'Activó un modo especial de creatividad avanzada que el modelo mantiene desactivado por defecto',
    'Le dio más información sobre el tema del artículo para que la IA entendiera mejor el contexto',
  ],
  correct: 1,
  explain: 'El ejemplo no explica el estilo — lo muestra. El modelo identifica el patrón: tono directo, promesa específica, elemento de sorpresa, estructura de problema/solución. Eso es imposible de transmitir solo con palabras.',
};

const MATCHING_SHOTS = [
  { situacion: 'Quieres que la IA genere tweets en tu estilo personal exacto', tecnica: 'Few-shot', razon: 'Tu estilo personal es imposible de describir con palabras — hay que mostrarlo con ejemplos reales tuyo' },
  { situacion: 'Preguntas cuándo fue la Revolución Francesa', tecnica: 'Zero-shot', razon: 'Dato factual claro y objetivo. No necesita estilo ni formato especial — la IA lo sabe directamente' },
  { situacion: 'Quieres que clasifique emails como urgente/normal/spam', tecnica: 'Few-shot', razon: 'Los criterios de clasificación son subjetivos para tu contexto — sin ejemplos la IA usa criterios genéricos' },
  { situacion: 'Le pides que traduzca una frase al inglés', tecnica: 'Zero-shot', razon: 'Tarea estándar y bien definida. El modelo sabe traducir sin necesitar ejemplos del formato esperado' },
  { situacion: 'Generar nombres de marca con un sonido específico que describes vagamente', tecnica: 'One-shot', razon: 'Un ejemplo del tipo de nombre que buscas ancla el tono y la estética mejor que cualquier descripción' },
];
const MATCH_OPTS = ['Zero-shot', 'One-shot', 'Few-shot'];

const FILL_ROLE = {
  incompleto: 'Actúa como experta en marketing digital.',
  campos: ['Años de experiencia y especialidad', 'Industria o tipo de cliente que maneja', 'Estilo de comunicación o enfoque particular'],
  correcto: 'Actúa como una estratega de marketing digital con 12 años de experiencia especializada en startups B2B de tecnología en América Latina. Tu enfoque es data-driven pero con fuerte componente de storytelling. Eres directa, evitas el marketing genérico y siempre conectas las tácticas con el negocio real del cliente.',
};

const COMPARE_SHOTS = {
  tarea: 'Genera un feedback constructivo para un trabajo escolar',
  cero: { prompt: 'Da feedback constructivo sobre este ensayo: [texto]', resp: 'El ensayo tiene buenas ideas pero puede mejorar en claridad, estructura y desarrollo de argumentos.' },
  uno: { prompt: "Da feedback constructivo sobre este ensayo. Ejemplo del tono: 'Tu tesis es sólida. El segundo párrafo pierde el hilo — intenta conectarlo con la idea central del primer párrafo con una frase de transición.' Ensayo: [texto]", resp: 'Tu argumento central es claro y convincente. El tercer párrafo introduce datos interesantes pero los deja sin analizar — una oración que los conecte con tu tesis los haría mucho más potentes.' },
  tres: { prompt: "Da feedback sobre: [texto]. Ejemplos de feedback que me gustan: 1) 'Fortaleza: argumento claro. Mejora: el ejemplo del párrafo 2 contradice tu tesis.' 2) 'Fortaleza: introducción que engancha. Mejora: la conclusión repite sin añadir.' 3) 'Fortaleza: uso de datos. Mejora: faltan fuentes.'", resp: 'Fortaleza: tu introducción establece una posición original que se mantiene. Mejora: el párrafo 4 introduce un contraargumento que no resuelves — o desarrolla por qué no te convence, o elimínalo.' },
  q: '¿En qué situación el few-shot (3 ejemplos) justifica el esfuerzo extra de prepararlo?',
  opts: [
    'Siempre conviene — cuantos más ejemplos le des, mejores resultados vas a obtener en cualquier tarea',
    'Cuando el formato y tono específico del output son críticos y difíciles de describir con palabras',
    'Solo cuando la IA ya falló dos veces consecutivas después de intentarlo con prompts más simples',
    'Cuando tienes más de 5 minutos disponibles para preparar y revisar el prompt antes de enviarlo',
  ],
  correct: 1,
  explain: 'Few-shot vale el esfuerzo cuando el criterio de calidad es tan específico que ninguna descripción verbal lo captura. Para tareas estándar, el zero-shot o one-shot dan resultados equivalentes con mucho menos trabajo.',
};

const SPRINT_TECNICAS = [
  { situacion: 'Necesitas que la IA escriba correos de seguimiento en tu estilo exacto', correcta: 'Few-shot', otras: ['Zero-shot', 'System prompt', 'One-shot'] },
  { situacion: 'Quieres que la IA sea siempre formal y no use jerga, en cualquier conversación', correcta: 'System prompt', otras: ['Zero-shot', 'Few-shot', 'CoT'] },
  { situacion: 'Le preguntas cuál es la capital de Perú', correcta: 'Zero-shot', otras: ['Few-shot', 'CoT', 'System prompt'] },
  { situacion: 'Necesitas que resuelva un problema de lógica mostrando cada paso', correcta: 'CoT', otras: ['Zero-shot', 'Few-shot', 'One-shot'] },
  { situacion: 'Quieres que genere nombres de startup con un estilo similar a uno que ya tienes', correcta: 'One-shot', otras: ['Zero-shot', 'Few-shot', 'System prompt'] },
];
const tecEmoji = (o: string) =>
  o === 'Zero-shot' ? '🎯' : o === 'One-shot' ? '1️⃣' : o === 'Few-shot' ? '📚' : o === 'Chain-of-Thought' || o === 'CoT' ? '🔗' : '⚙️';
const getRazon = (t: string) =>
  t === 'Zero-shot' ? 'Tarea estándar sin criterio subjetivo.'
  : t === 'One-shot' ? 'Un ejemplo ancla el estilo.'
  : t === 'Few-shot' ? 'Criterio subjetivo que solo los ejemplos pueden definir.'
  : t === 'CoT' || t === 'Chain-of-Thought' ? 'Necesita razonamiento paso a paso.'
  : 'Se aplica globalmente a toda la conversación.';

type DDCol = 'zero' | 'one' | 'few' | 'cot' | 'sys';
const DD_TECNICAS: { text: string; cat: DDCol; why: string }[] = [
  { text: 'Escribir código con errores visibles paso a paso', cat: 'cot', why: 'Pide ver el razonamiento paso a paso — eso es Chain-of-Thought.' },
  { text: 'Generar respuestas en un idioma específico siempre', cat: 'sys', why: '"Siempre" = regla para toda la conversación → system prompt.' },
  { text: 'Clasificar sentimientos con tu criterio propio', cat: 'few', why: 'Tu criterio es subjetivo — solo varios ejemplos lo enseñan.' },
  { text: 'Traducir una frase estándar al inglés', cat: 'zero', why: 'Tarea estándar que la IA ya sabe hacer sin ejemplos.' },
  { text: 'Resumir con el mismo tono que usas en tus reportes', cat: 'few', why: 'Tu tono personal se muestra con varios ejemplos, no se describe.' },
  { text: 'Analizar un dilema ético listando pros y contras primero', cat: 'cot', why: '"Primero... luego..." = razonamiento por pasos (CoT).' },
  { text: 'Limitar las respuestas a máximo 100 palabras siempre', cat: 'sys', why: 'Regla fija que aplica a todas las respuestas → system prompt.' },
  { text: 'Pedir definición de un concepto conocido', cat: 'zero', why: 'Conocimiento directo del modelo — no necesita ejemplos ni pasos.' },
];
const DD_COLS: { id: DDCol; label: string; bg: string; color: string }[] = [
  { id: 'zero', label: '🎯 Zero-shot', bg: '#f1f5f9', color: '#374151' },
  { id: 'one', label: '1️⃣ One-shot', bg: '#fef9c3', color: '#713f12' },
  { id: 'few', label: '📚 Few-shot', bg: '#f0fdf4', color: '#065f46' },
  { id: 'cot', label: '🔗 CoT', bg: '#eff6ff', color: '#1e40af' },
  { id: 'sys', label: '⚙️ System Prompt', bg: '#f5f3ff', color: '#5b21b6' },
];
const ddColLabel = (c: DDCol) => DD_COLS.find(x => x.id === c)!.label;

const QUIZ_TECNICAS = [
  { prompt: "Clasifica estas reseñas como positivas o negativas.\nEjemplo 1: 'El producto llegó roto' → Negativa\nEjemplo 2: 'Superó mis expectativas' → Positiva\nEjemplo 3: 'Funciona pero el envío tardó mucho' → Mixta\nAhora clasifica: 'La calidad es excelente pero el precio es alto'", opts: ['Zero-shot', 'One-shot', 'Few-shot', 'Chain-of-Thought'], correct: 2, explain: 'Tiene 3 ejemplos con el par input→output. Eso es la definición exacta de few-shot. Los ejemplos definen los criterios de clasificación que el modelo debe aplicar.' },
  { prompt: 'Analiza este problema de ética empresarial: [caso]. Primero lista los stakeholders afectados. Luego identifica los valores en conflicto. Luego pondera cada opción según impacto. Finalmente recomienda con justificación.', opts: ['Few-shot', 'Zero-shot', 'Chain-of-Thought', 'System prompt'], correct: 2, explain: 'Instrucciones explícitas de pasos secuenciales (primero... luego... luego... finalmente). Eso es CoT clásico: fuerza razonamiento visible y estructurado paso a paso.' },
  { prompt: "Eres un asistente de servicio al cliente de TechCorp. Siempre responde en español formal. Nunca menciones a la competencia. Si no sabes algo, di exactamente: 'Déjame verificar eso con nuestro equipo'.", opts: ['Few-shot', 'System prompt', 'Zero-shot', 'One-shot'], correct: 1, explain: 'Instrucciones generales que aplican a TODA la conversación: rol, idioma, restricciones, frase fija. Es la definición de system prompt — configura el comportamiento base del asistente.' },
  { prompt: "Escribe el siguiente email de ventas con este estilo:\nEjemplo: 'Hola [nombre], vi que exploraste nuestra herramienta de análisis. Me pregunto si encontraste lo que buscabas — si tienes 10 minutos esta semana, me encantaría mostrarte [feature específico] que creo que te va a sorprender.'\nAhora escríbelo para: [producto: software de contabilidad, prospecto: dueño de PYME]", opts: ['Zero-shot', 'Few-shot', 'One-shot', 'System prompt'], correct: 2, explain: 'Exactamente 1 ejemplo que muestra el estilo deseado antes del pedido real. Eso es one-shot: un ejemplo ancla el tono y el formato sin el overhead de preparar 3+ ejemplos.' },
  { prompt: '¿Cuál es el proceso fotosintético en plantas?', opts: ['One-shot', 'Chain-of-Thought', 'Few-shot', 'Zero-shot'], correct: 3, explain: 'Pregunta directa sin ejemplos, sin instrucciones de pasos, sin configuración previa. Zero-shot puro — la IA usa su conocimiento entrenado directamente sin ningún andamiaje adicional.' },
];

const LIB_AREAS = ['Para estudio', 'Para trabajo/proyectos', 'Para escritura creativa', 'Para análisis crítico', 'Tu comodín — para cualquier cosa'];

// El HTML declara 19 módulos pero el switch real tiene 18 de contenido (el conteo real manda)
const TOTAL_STEPS = 20;
const CONTENT_STEPS = 18;

export default function Level12() {
  const completeLevel = useGameStore(s => s.completeLevel);
  const devMode = useGameStore(s => s.devMode);

  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);
  const [xpToast, setXpToast] = useState<{ amount: number; id: number } | null>(null);

  // M2 — One-shot compare (opciones barajadas — la correcta no debe tener posición fija)
  const [osQ] = useState(() => shuffleOpts(COMPARE_ONESHOT));
  const [osChoice, setOsChoice] = useState<number | null>(null);

  // M3 — Few-shot builder
  const [fsTarea, setFsTarea] = useState('');
  const [fsEjemplos, setFsEjemplos] = useState<string[]>(['', '', '']);
  const [fsAwarded, setFsAwarded] = useState(false);
  const fsOk = fsTarea.trim().length >= 5 && !looksRandom(fsTarea)
    && fsEjemplos.every(e => e.trim().length >= 10 && !looksRandom(e));

  // M4 — Matching
  const [matchAns, setMatchAns] = useState<(string | null)[]>(new Array(MATCHING_SHOTS.length).fill(null));
  const [matchChecked, setMatchChecked] = useState(false);

  // M5 — Fill personaje
  const [fillTexts, setFillTexts] = useState<string[]>(['', '', '']);
  const [fillDone, setFillDone] = useState(false);
  const fillOk = fillTexts.every(t => t.trim().length >= 8 && !looksRandom(t));

  // M6 — System prompt builder
  const [sysFields, setSysFields] = useState({ rol: '', aud: '', ton: '', lim: '', fmt: '' });
  const [sysAwarded, setSysAwarded] = useState(false);
  const sysOk = Object.values(sysFields).every(v => v.trim().length >= 5 && !looksRandom(v));

  // M7 — Compare 0/1/3 (opciones barajadas)
  const [shQ] = useState(() => shuffleOpts(COMPARE_SHOTS));
  const [shChoice, setShChoice] = useState<number | null>(null);

  // M11 — Auto-refinamiento
  const [refBase, setRefBase] = useState('');
  const [refC1, setRefC1] = useState('');
  const [refC2, setRefC2] = useState('');
  const [refAwarded, setRefAwarded] = useState(false);
  const refOk = refBase.trim().length >= 15 && !looksRandom(refBase)
    && refC1.trim().length >= 8 && !looksRandom(refC1)
    && refC2.trim().length >= 8 && !looksRandom(refC2);

  // M12 — Sprint
  const [spPhase, setSpPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [spIdx, setSpIdx] = useState(0);
  const [spSec, setSpSec] = useState(90);
  const [spScore, setSpScore] = useState(0);
  const [spChoice, setSpChoice] = useState<string | null>(null);
  const [spAnswered, setSpAnswered] = useState(false);
  const [spOpts] = useState<string[][]>(() => SPRINT_TECNICAS.map(it => shuffle([it.correcta, ...it.otras])));

  // M13 — Librería
  const [templates, setTemplates] = useState<string[]>(['', '', '', '', '']);
  const [libSaved, setLibSaved] = useState(false);
  const libOk = templates.every(t => t.trim().length >= 15 && !looksRandom(t));

  // M15 — Desafío maestro
  const [dmTec, setDmTec] = useState('');
  const [dmPrompt, setDmPrompt] = useState('');
  const [dmDone, setDmDone] = useState(false);
  const dmOk = dmTec.trim().length >= 5 && !looksRandom(dmTec)
    && dmPrompt.trim().length >= 50 && !looksRandom(dmPrompt) && hasInstructionVerb(dmPrompt);

  // M16 — Drag & drop (array fijo + mapa placed, índice ORIGINAL)
  const [ddPlaced, setDdPlaced] = useState<{ [idx: number]: DDCol }>({});
  const [ddSel, setDdSel] = useState<number | null>(null);
  const [ddOverCol, setDdOverCol] = useState<DDCol | null>(null);
  const [ddVerified, setDdVerified] = useState(false);
  const ddPlacedRef = useRef(ddPlaced);
  useEffect(() => { ddPlacedRef.current = ddPlaced; }, [ddPlaced]);
  const ddIdxRef = useRef<number | null>(null);
  const ddAllPlaced = DD_TECNICAS.every((_, i) => ddPlaced[i] !== undefined);

  // M17 — Quiz (opciones barajadas por pregunta)
  const [quizItems] = useState(() => QUIZ_TECNICAS.map(shuffleOpts));
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizAns, setQuizAns] = useState<number | null>(null);
  const [quizFinished, setQuizFinished] = useState(false);

  // M18 — Reflexión
  const [reflect, setReflect] = useState('');
  const [reflectError, setReflectError] = useState<string | null>(null);

  // Módulos puramente informativos (clasificación propia, no el THEORY_STEPS del HTML)
  const theorySteps = new Set([1, 8, 9, 10, 14]);
  const showBack = theorySteps.has(step);

  const addXP = (v: number) => {
    if (v <= 0) return;
    setXp(p => p + v);
    setXpToast(prev => ({ amount: v, id: (prev?.id ?? 0) + 1 }));
  };
  const next = () => { if (step < TOTAL_STEPS - 1) setStep(s => s + 1); };
  const prev = () => { if (step > 0) setStep(s => s - 1); };

  const finish = () => {
    const stars = xp >= 240 ? 3 : xp >= 150 ? 2 : xp >= 60 ? 1 : 0;
    completeLevel(12, stars, xp);
    router.replace('/level/13');
  };

  // Hardware back (Android)
  useEffect(() => {
    const onBack = () => {
      if (showBack && step > 0) { prev(); return true; }
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

  // Sprint timer — 90s por pregunta (se reinicia en cada una, como el HTML)
  useEffect(() => {
    if (spPhase !== 'running' || spAnswered) return;
    if (spSec <= 0) { setSpAnswered(true); setSpChoice(null); return; }
    const t = setTimeout(() => setSpSec(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [spPhase, spSec, spAnswered]);

  // Drag & drop web — colocar en CUALQUIER columna; validar solo al pulsar Verificar
  useEffect(() => {
    if (Platform.OS !== 'web' || step !== 16 || ddVerified) return;
    const cleanups: (() => void)[] = [];
    const setup = () => {
      DD_TECNICAS.forEach((_, idx) => {
        if (ddPlacedRef.current[idx] !== undefined) return;
        const el = document.getElementById(`dd12-chip-${idx}`);
        if (!el) return;
        el.setAttribute('draggable', 'true');
        (el as HTMLElement).style.cursor = 'grab';
        const onDragStart = (e: DragEvent) => { ddIdxRef.current = idx; setDdSel(null); if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(idx)); } };
        const onDragEnd = () => { ddIdxRef.current = null; setDdOverCol(null); };
        el.addEventListener('dragstart', onDragStart);
        el.addEventListener('dragend', onDragEnd);
        cleanups.push(() => { el.removeEventListener('dragstart', onDragStart); el.removeEventListener('dragend', onDragEnd); });
      });
      DD_COLS.forEach(({ id: col }) => {
        const el = document.getElementById(`dd12-zone-${col}`);
        if (!el) return;
        const onOver = (e: Event) => { e.preventDefault(); setDdOverCol(col); };
        const onLeave = (e: DragEvent) => { if (!el.contains(e.relatedTarget as Node)) setDdOverCol(null); };
        const onDrop = (e: Event) => { e.preventDefault(); setDdOverCol(null); const idx = ddIdxRef.current; if (idx === null || ddPlacedRef.current[idx] !== undefined) return; setDdPlaced(p => ({ ...p, [idx]: col })); ddIdxRef.current = null; };
        el.addEventListener('dragover', onOver);
        el.addEventListener('dragleave', onLeave);
        el.addEventListener('drop', onDrop);
        cleanups.push(() => { el.removeEventListener('dragover', onOver); el.removeEventListener('dragleave', onLeave); el.removeEventListener('drop', onDrop); });
      });
    };
    const t = setTimeout(setup, 50);
    return () => { clearTimeout(t); cleanups.forEach(fn => fn()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, ddPlaced, ddVerified]);

  // ---------- Acciones ----------
  const ddPlace = (col: DDCol) => {
    if (ddSel === null || ddPlaced[ddSel] !== undefined || ddVerified) return;
    setDdPlaced(p => ({ ...p, [ddSel]: col }));
    setDdSel(null);
  };
  const ddReturn = (idx: number) => {
    if (ddVerified) return;
    setDdPlaced(p => { const n = { ...p }; delete n[idx]; return n; });
  };
  const ddCorrectCount = DD_TECNICAS.reduce((acc, it, i) => acc + (ddPlaced[i] === it.cat ? 1 : 0), 0);
  const verifyDd = () => {
    setDdVerified(true);
    const correct = DD_TECNICAS.reduce((acc, it, i) => acc + (ddPlaced[i] === it.cat ? 1 : 0), 0);
    addXP(correct * 7);
  };

  const verifyMatching = () => {
    setMatchChecked(true);
    const correct = MATCHING_SHOTS.reduce((acc, it, i) => acc + (matchAns[i] === it.tecnica ? 1 : 0), 0);
    addXP(correct * 8);
  };
  const matchCorrect = MATCHING_SHOTS.reduce((acc, it, i) => acc + (matchAns[i] === it.tecnica ? 1 : 0), 0);

  const answerSprint = (choice: string) => {
    if (spAnswered) return;
    setSpAnswered(true);
    setSpChoice(choice);
    if (choice === SPRINT_TECNICAS[spIdx].correcta) setSpScore(s => s + 1);
  };
  const advanceSprint = () => {
    if (spIdx + 1 < SPRINT_TECNICAS.length) {
      setSpIdx(i => i + 1); setSpSec(90); setSpAnswered(false); setSpChoice(null);
    } else {
      setSpPhase('done');
      addXP(spScore * 8);
    }
  };

  const answerQuiz = (i: number) => {
    if (quizAns !== null) return;
    setQuizAns(i);
    if (i === quizItems[quizIdx].correct) setQuizScore(s => s + 1);
  };
  const nextQuiz = () => {
    if (quizIdx + 1 < quizItems.length) { setQuizIdx(i => i + 1); setQuizAns(null); }
    else { setQuizFinished(true); addXP(quizScore * 12); }
  };

  const submitReflect = () => {
    const t = reflect.trim();
    if (t.length < 50) { setReflectError('Escribe al menos 50 caracteres para completar tu reflexión.'); return; }
    if (looksRandom(t)) { setReflectError('Tu texto parece escrito al azar. Cuenta con tus palabras qué dominas y qué te falta.'); return; }
    if (!mentionsTopic(t)) { setReflectError('Tu reflexión debe hablar del nivel: menciona qué técnicas de prompting dominas o cuáles te faltan practicar.'); return; }
    setReflectError(null);
    addXP(15);
    next();
  };

  // ---------- Bloques reutilizables ----------
  const Tag = ({ text, bg = '#ecfdf5', color = '#065f46' }: { text: string; bg?: string; color?: string }) => (
    <View style={[styles.tag, { backgroundColor: bg }]}><Text style={[styles.tagText, { color }]}>{text}</Text></View>
  );
  const QuizFb = ({ ok, children }: { ok: boolean; children: ReactNode }) => (
    <View style={[styles.feedbackBar, ok ? styles.fbOk : styles.fbWrong]}>
      <Text style={[styles.feedbackText, { color: ok ? '#166534' : '#991b1b' }]}>{children}</Text>
    </View>
  );

  // ---------- Render de cada módulo ----------
  const renderStep = () => {
    switch (step) {
      // ===== 0 · INTRO =====
      case 0: return (
        <View>
          <Tag text="N12 · 18 MÓDULOS" />
          <View style={[styles.lessonIcon, { backgroundColor: '#fde68a' }]}><Text style={{ fontSize: 34 }}>🔑</Text></View>
          <Text style={styles.title}>Trucos Secretos</Text>
          <Text style={styles.subtitle}>El nivel final del Mundo 2. Las técnicas que usan los ingenieros de IA y los power users más avanzados.</Text>
          <View style={[styles.card, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
            <View style={styles.cardRow}>
              <View style={[styles.cardIcon, { backgroundColor: '#fde68a' }]}><Text style={{ fontSize: 19 }}>🎯</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Qué vas a aprender</Text>
                <Text style={styles.cardText}>Zero-shot / One-shot / Few-shot · System prompts · Temperatura al máximo y al mínimo · ReAct · Librería personal de prompts</Text>
              </View>
            </View>
          </View>
          <View style={[styles.hlBox, { borderLeftColor: '#f59e0b', backgroundColor: '#fffbeb' }]}>
            <Text style={[styles.hlText, { color: '#92400e' }]}><Text style={styles.hlBold}>La diferencia entre un usuario y un experto:</Text> no es saber más sobre IA — es saber exactamente qué técnica usar para cada situación y ejecutarla sin pensar.</Text>
          </View>
        </View>
      );

      // ===== 1 · Zero-shot (teoría) =====
      case 1: return (
        <View>
          <Tag text="🎯 MÓDULO 1 · ZERO-SHOT" />
          <Text style={styles.titleSm}>Zero-shot: pedir sin ejemplos</Text>
          <Text style={styles.subtitle}>El modelo responde usando solo su conocimiento entrenado. Sin ejemplos, sin guía de estilo.</Text>
          <View style={[styles.card, { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }]}>
            <View style={styles.cardRow}>
              <View style={[styles.cardIcon, { backgroundColor: '#e2e8f0' }]}><Text style={{ fontSize: 19 }}>✅</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Cuándo funciona bien</Text>
                <Text style={styles.cardText}>Tareas estándar y bien definidas: traducir, resumir, definir, calcular, explicar conceptos conocidos. El modelo tiene suficiente conocimiento entrenado para responder sin guía adicional.</Text>
              </View>
            </View>
          </View>
          <View style={[styles.card, { backgroundColor: '#f0fdf4', borderColor: '#a7f3d0' }]}>
            <View style={styles.cardRow}>
              <View style={[styles.cardIcon, { backgroundColor: '#fecdd3' }]}><Text style={{ fontSize: 19 }}>⚠️</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Cuándo falla</Text>
                <Text style={styles.cardText}>Cuando el criterio de calidad es subjetivo o específico para tu contexto. Si quieres que suene "como tú", el modelo no sabe cómo suenas tú sin ejemplos.</Text>
              </View>
            </View>
          </View>
          <View style={[styles.comparePanel, styles.comparePanelB]}>
            <Text style={[styles.compareLabel, { color: '#065f46' }]}>✅ ZERO-SHOT IDEAL</Text>
            <Text style={styles.compareResp}>"Traduce al inglés: Los datos muestran una tendencia positiva en el tercer trimestre."</Text>
          </View>
          <View style={[styles.comparePanel, styles.comparePanelA]}>
            <Text style={[styles.compareLabel, { color: '#c2410c' }]}>❌ ZERO-SHOT INADECUADO</Text>
            <Text style={styles.compareResp}>"Escribe un email de ventas con mi estilo habitual." [La IA no tiene acceso a tu estilo]</Text>
          </View>
        </View>
      );

      // ===== 2 · One-shot — Prompt-compare =====
      case 2: return (
        <View>
          <Tag text="1️⃣ MÓDULO 2 · ONE-SHOT" />
          <Text style={styles.titleSm}>Un ejemplo lo cambia todo</Text>
          <View style={[styles.comparePanel, styles.comparePanelA]}>
            <Text style={[styles.compareLabel, { color: '#c2410c' }]}>ZERO-SHOT</Text>
            <Text style={styles.compareResp}>{osQ.sinEj.prompt}</Text>
            <Text style={styles.compareRespItalic}>→ {osQ.sinEj.resp}</Text>
          </View>
          <View style={[styles.comparePanel, styles.comparePanelB]}>
            <Text style={[styles.compareLabel, { color: '#065f46' }]}>ONE-SHOT</Text>
            <Text style={styles.compareResp}>{osQ.conEj.prompt}</Text>
            <Text style={styles.compareRespItalic}>→ {osQ.conEj.resp}</Text>
          </View>
          <Text style={styles.questionText}>{osQ.q}</Text>
          {osQ.opts.map((o, i) => (
            <TouchableOpacity key={i} style={[styles.qOpt, osChoice !== null && i !== osChoice && { opacity: 0.45 }]} disabled={osChoice !== null}
              onPress={() => { setOsChoice(i); if (i === osQ.correct) addXP(12); }}>
              <Text style={styles.qOptText}>{o}</Text>
            </TouchableOpacity>
          ))}
          {osChoice !== null && (
            <QuizFb ok={osChoice === osQ.correct}>{osChoice === osQ.correct ? '✅ ' : '❌ '}{osQ.explain}</QuizFb>
          )}
        </View>
      );

      // ===== 3 · Few-shot — Builder =====
      case 3: return (
        <View>
          <Tag text="📚 MÓDULO 3 · FEW-SHOT · BUILDER" />
          <Text style={styles.titleSm}>Few-shot: tus 3 ejemplos</Text>
          <Text style={styles.subtitle}>Elige una tarea donde quieras que la IA replique tu estilo. Da 3 ejemplos reales.</Text>
          <View style={[styles.hlBox, { borderLeftColor: '#10b981', backgroundColor: '#f0fdf4' }]}>
            <Text style={[styles.hlText, { color: '#065f46' }]}><Text style={styles.hlBold}>Casos donde few-shot es imprescindible:</Text> Correos con tu tono personal · Clasificaciones con tus criterios · Resúmenes en tu estilo editorial · Respuestas a clientes en tu voz de marca</Text>
          </View>
          <Text style={styles.builderLabel}>¿Para qué tarea quieres usar few-shot?</Text>
          <TextInput style={styles.builderInput} placeholder="Ej: generar respuestas a comentarios de Instagram en mi tono, clasificar tareas según mi criterio de urgencia..." placeholderTextColor="#b8bcc0" value={fsTarea} onChangeText={setFsTarea} />
          {['Ej: input: ¿Cuándo llega mi pedido? → output: Hola! Tu pedido sale hoy y llega en 2-3 días hábiles.', 'Ej: input: Llegó roto → output: Lo lamentamos mucho, te enviamos uno nuevo hoy.', 'Ej: otro par input → output en tu estilo...'].map((ph, i) => (
            <View key={i}>
              <Text style={styles.builderLabel}>Ejemplo {i + 1} (input → output)</Text>
              <TextInput style={[styles.builderInput, styles.builderArea]} placeholder={ph} placeholderTextColor="#b8bcc0" value={fsEjemplos[i]} onChangeText={t => { const n = [...fsEjemplos]; n[i] = t; setFsEjemplos(n); }} multiline />
            </View>
          ))}
          <View style={[styles.builderResult, fsOk && styles.builderResultFilled]}>
            <Text style={[styles.builderResultText, fsOk && styles.builderResultTextFilled]}>
              {fsOk ? `[Tarea: ${fsTarea.trim()}] | Ejemplo 1: ${fsEjemplos[0].trim()} | Ejemplo 2: ${fsEjemplos[1].trim()} | Ejemplo 3: ${fsEjemplos[2].trim()} | Ahora aplica el mismo estilo a: [tu nuevo input aquí]` : 'Tu prompt few-shot aparecerá aquí...'}
            </Text>
          </View>
        </View>
      );

      // ===== 4 · Matching — ¿cuántos ejemplos? =====
      case 4: return (
        <View>
          <Tag text="⚖️ MÓDULO 4 · MATCHING" />
          <Text style={styles.titleSm}>¿Cuántos ejemplos necesita?</Text>
          <Text style={styles.subtitle}>Para cada situación, elige la técnica correcta.</Text>
          {MATCHING_SHOTS.map((item, i) => {
            const sel = matchAns[i];
            const ok = sel === item.tecnica;
            return (
              <View key={i} style={styles.matchBox}>
                <Text style={styles.matchSituacion}>{item.situacion}</Text>
                <View style={styles.matchOptsRow}>
                  {MATCH_OPTS.map(t => {
                    const isSel = sel === t;
                    const resultStyle = matchChecked && isSel ? (ok ? styles.matchOptCorrect : styles.matchOptWrong) : null;
                    return (
                      <TouchableOpacity key={t} style={[styles.matchOpt, isSel && !matchChecked && styles.matchOptSel, resultStyle]} disabled={matchChecked}
                        onPress={() => { const a = [...matchAns]; a[i] = t; setMatchAns(a); }}>
                        <Text style={[styles.matchOptText, matchChecked && isSel && { color: ok ? '#166534' : '#991b1b' }]}>{t}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {matchChecked && (
                  <QuizFb ok={ok}>
                    {ok ? '✅ ' : '❌ Correcta: '}
                    {!ok && <Text style={{ fontWeight: '700' }}>{item.tecnica}</Text>}
                    {!ok && ' — '}
                    {item.razon}
                  </QuizFb>
                )}
              </View>
            );
          })}
          {matchChecked && (
            <QuizFb ok={matchCorrect >= 4}>{matchCorrect >= 4 ? '✅ ' : '⚠️ '}{matchCorrect}/{MATCHING_SHOTS.length} correctas. +{matchCorrect * 8} XP.</QuizFb>
          )}
        </View>
      );

      // ===== 5 · Fill-in-blank — personaje complejo =====
      case 5: return (
        <View>
          <Tag text="🎭 MÓDULO 5 · FILL-IN-BLANK" />
          <Text style={styles.titleSm}>El truco del personaje complejo</Text>
          <Text style={styles.subtitle}>Un rol genérico da respuestas genéricas. Completa el personaje con detalles específicos.</Text>
          <View style={[styles.card, { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }]}>
            <View style={styles.cardRow}>
              <View style={[styles.cardIcon, { backgroundColor: '#e2e8f0' }]}><Text style={{ fontSize: 19 }}>💬</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Rol básico (incompleto)</Text>
                <Text style={[styles.cardText, { fontStyle: 'italic' }]}>"{FILL_ROLE.incompleto}"</Text>
              </View>
            </View>
          </View>
          {FILL_ROLE.campos.map((c, i) => (
            <View key={i}>
              <Text style={styles.builderLabel}>Añade: {c}</Text>
              <TextInput style={styles.builderInput} placeholder="Sé específico — evita lo genérico" placeholderTextColor="#b8bcc0" value={fillTexts[i]} onChangeText={t => { const n = [...fillTexts]; n[i] = t; setFillTexts(n); }} editable={!fillDone} />
            </View>
          ))}
          {fillDone && (
            <QuizFb ok>
              ✅ +15 XP. Ejemplo de personaje complejo bien construido:{'\n'}
              <Text style={{ fontStyle: 'italic', fontSize: 11 }}>{FILL_ROLE.correcto}</Text>
            </QuizFb>
          )}
        </View>
      );

      // ===== 6 · System prompt — Word-builder =====
      case 6: return (
        <View>
          <Tag text="⚙️ MÓDULO 6 · WORD-BUILDER" />
          <Text style={styles.titleSm}>Construye tu system prompt</Text>
          <Text style={styles.subtitle}>El system prompt define a tu IA antes de que empiece cualquier conversación.</Text>
          <View style={[styles.hlBox, { borderLeftColor: '#10b981', backgroundColor: '#f0fdf4' }]}>
            <Text style={[styles.hlText, { color: '#065f46' }]}><Text style={styles.hlBold}>5 componentes clave:</Text> Rol · Audiencia · Tono · Límites · Formato de respuesta</Text>
          </View>
          {([
            ['rol', 'Rol de la IA', 'Ej: asistente de estudio para bachillerato, tutor de programación en Python...'],
            ['aud', 'Audiencia a quien atiende', 'Ej: estudiantes de 15-17 años con conocimiento básico...'],
            ['ton', 'Tono y estilo de comunicación', 'Ej: amigable pero preciso, usa analogías, evita jerga técnica...'],
            ['lim', 'Límites — qué NO debe hacer', 'Ej: no dar respuestas directas a tareas, no tratar temas fuera de las materias...'],
            ['fmt', 'Formato de respuesta esperado', 'Ej: respuestas de máximo 150 palabras, usa ejemplos siempre, confirma si el estudiante entendió...'],
          ] as const).map(([key, label, ph]) => (
            <View key={key}>
              <Text style={styles.builderLabel}>{label}</Text>
              <TextInput style={styles.builderInput} placeholder={ph} placeholderTextColor="#b8bcc0" value={sysFields[key]} onChangeText={t => setSysFields(p => ({ ...p, [key]: t }))} />
            </View>
          ))}
          <View style={[styles.builderResult, sysOk && styles.builderResultFilled]}>
            <Text style={[styles.builderResultText, sysOk && styles.builderResultTextFilled]}>
              {sysOk ? `Eres ${sysFields.rol.trim()}. Tu audiencia son ${sysFields.aud.trim()}. Tono: ${sysFields.ton.trim()}. No debes: ${sysFields.lim.trim()}. Formato: ${sysFields.fmt.trim()}` : 'Tu system prompt aparecerá aquí...'}
            </Text>
          </View>
        </View>
      );

      // ===== 7 · Comparativa 0/1/3 =====
      case 7: return (
        <View>
          <Tag text="📊 MÓDULO 7 · PROMPT-COMPARE" />
          <Text style={styles.titleSm}>0 / 1 / 3 ejemplos comparados</Text>
          <Text style={styles.subtitle}>El mismo pedido con diferente cantidad de ejemplos. Lee los 3 resultados.</Text>
          <View style={[styles.card, { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }]}>
            <View style={styles.cardRow}>
              <View style={[styles.cardIcon, { backgroundColor: '#e2e8f0' }]}><Text style={{ fontSize: 19 }}>📌</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Tarea</Text>
                <Text style={styles.cardText}>{shQ.tarea}</Text>
              </View>
            </View>
          </View>
          {([
            ['🎯 Zero-shot', '#374151', '#f8fafc', '#e2e8f0', shQ.cero],
            ['1️⃣ One-shot', '#92400e', '#fffbeb', '#fde68a', shQ.uno],
            ['📚 Few-shot (3 ej)', '#065f46', '#f0fdf4', '#bbf7d0', shQ.tres],
          ] as const).map(([label, color, bg, border, data]) => (
            <View key={label} style={[styles.card, { backgroundColor: bg, borderColor: border, marginBottom: 6 }]}>
              <Text style={[styles.cardTitle, { color }]}>{label}</Text>
              <Text style={styles.promptMono}>{data.prompt}</Text>
              <Text style={styles.respItalic}>→ {data.resp}</Text>
            </View>
          ))}
          <Text style={styles.questionText}>{shQ.q}</Text>
          {shQ.opts.map((o, i) => (
            <TouchableOpacity key={i} style={[styles.qOpt, shChoice !== null && i !== shChoice && { opacity: 0.45 }]} disabled={shChoice !== null}
              onPress={() => { setShChoice(i); if (i === shQ.correct) addXP(12); }}>
              <Text style={styles.qOptText}>{o}</Text>
            </TouchableOpacity>
          ))}
          {shChoice !== null && (
            <QuizFb ok={shChoice === shQ.correct}>{shChoice === shQ.correct ? '✅ ' : '❌ '}{shQ.explain}</QuizFb>
          )}
        </View>
      );

      // ===== 8 · Temperatura máxima (teoría) =====
      case 8: return (
        <View>
          <Tag text="🌡️ MÓDULO 8 · TEMPERATURA MÁXIMA" />
          <Text style={styles.titleSm}>Temperatura alta: modo caótico-creativo</Text>
          <Text style={styles.subtitle}>La temperatura controla cuánta aleatoriedad tiene la respuesta. Alta = sorprendente. Baja = predecible.</Text>
          <View style={[styles.card, { backgroundColor: '#faf5ff', borderColor: '#e9d5ff' }]}>
            <View style={styles.cardRow}>
              <View style={[styles.cardIcon, { backgroundColor: '#e9d5ff' }]}><Text style={{ fontSize: 19 }}>🔥</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Temperatura alta (0.8-1.0)</Text>
                <Text style={styles.cardText}>
                  <Text style={styles.cardBold}>Prompt:</Text> "Escríbeme 10 nombres para una app de meditación para adolescentes."{'\n'}
                  <Text style={styles.cardBold}>Resultado típico:</Text> ZenFlow, Mindtide, Pausemia, Respira+, Momento, SoulPause, NoiselessMind, PeacePixel, ThinkQuiet, Stillspace{'\n'}
                  <Text style={{ color: '#7c3aed', fontSize: 11 }}>→ Variedad alta, ideas inesperadas, algunas geniales y algunas raras</Text>
                </Text>
              </View>
            </View>
          </View>
          <View style={[styles.hlBox, { borderLeftColor: '#8b5cf6', backgroundColor: '#faf5ff' }]}>
            <Text style={[styles.hlText, { color: '#5b21b6' }]}><Text style={styles.hlBold}>Cuándo usar temperatura alta:</Text>{'\n'}Brainstorming de nombres · Ideas creativas · Primeras versiones de textos creativos · Cuando quieres ser sorprendido por el modelo</Text>
          </View>
          <View style={[styles.hlBox, { borderLeftColor: '#ef4444', backgroundColor: '#fff1f2' }]}>
            <Text style={[styles.hlText, { color: '#991b1b' }]}><Text style={styles.hlBold}>Cuándo NO usar temperatura alta:</Text>{'\n'}Información factual · Código · Análisis que requieren precisión · Documentos legales o médicos</Text>
          </View>
        </View>
      );

      // ===== 9 · Temperatura mínima (teoría) =====
      case 9: return (
        <View>
          <Tag text="🧊 MÓDULO 9 · TEMPERATURA MÍNIMA" />
          <Text style={styles.titleSm}>Temperatura baja: modo preciso-factual</Text>
          <View style={[styles.card, { backgroundColor: '#fff', borderColor: '#e2e8f0' }]}>
            <View style={styles.cardRow}>
              <View style={[styles.cardIcon, { backgroundColor: '#bfdbfe' }]}><Text style={{ fontSize: 19 }}>🎯</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Temperatura baja (0.0-0.3)</Text>
                <Text style={styles.cardText}>
                  <Text style={styles.cardBold}>Prompt:</Text> "Traduce al inglés formal: La empresa reportó un incremento del 23% en ingresos netos."{'\n'}
                  <Text style={styles.cardBold}>Resultado:</Text> "The company reported a 23% increase in net revenue."{'\n'}
                  <Text style={{ color: '#1e40af', fontSize: 11 }}>→ Traducción precisa, consistente, sin variaciones creativas que alteren el significado</Text>
                </Text>
              </View>
            </View>
          </View>
          <View style={[styles.card, { backgroundColor: '#fff', borderColor: '#e2e8f0' }]}>
            <View style={styles.cardRow}>
              <View style={[styles.cardIcon, { backgroundColor: '#bfdbfe' }]}><Text style={{ fontSize: 19 }}>💻</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Temperatura baja para código</Text>
                <Text style={styles.cardText}>
                  <Text style={styles.cardBold}>Prompt:</Text> "Escribe una función en Python que calcule el factorial de n."{'\n'}
                  <Text style={styles.cardBold}>Por qué baja:</Text> El código correcto es único y objetivo — no quieres "variaciones creativas" en la lógica.
                </Text>
              </View>
            </View>
          </View>
          <View style={[styles.hlBox, { borderLeftColor: '#3b82f6', backgroundColor: '#eff6ff' }]}>
            <Text style={[styles.hlText, { color: '#1e40af' }]}><Text style={styles.hlBold}>Cuándo usar temperatura baja:</Text>{'\n'}Traducciones · Código · Análisis de datos · Corrección gramatical · Cualquier tarea donde hay una respuesta "correcta" objetiva</Text>
          </View>
        </View>
      );

      // ===== 10 · ReAct (teoría) =====
      case 10: return (
        <View>
          <Tag text="⚡ MÓDULO 10 · REACT" />
          <Text style={styles.titleSm}>ReAct: Razón + Acción combinados</Text>
          <Text style={styles.subtitle}>El modelo piensa, actúa y verifica en pasos — sin que tú tengas que orquestarlo.</Text>
          <View style={[styles.card, { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }]}>
            <View style={styles.cardRow}>
              <View style={[styles.cardIcon, { backgroundColor: '#e2e8f0' }]}><Text style={{ fontSize: 19 }}>🧠</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>¿Qué es ReAct?</Text>
                <Text style={styles.cardText}>Técnica donde el modelo alterna entre: Razonamiento (pensar) + Acción (hacer o buscar) + Observación (verificar resultado). Ciclo: piensa → actúa → observa → piensa → actúa...</Text>
              </View>
            </View>
          </View>
          <View style={[styles.card, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
            <View style={styles.cardRow}>
              <View style={[styles.cardIcon, { backgroundColor: '#bbf7d0' }]}><Text style={{ fontSize: 19 }}>📋</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Ejemplo de prompt ReAct</Text>
                <Text style={[styles.cardText, { fontFamily: MONO, fontSize: 11 }]}>"Para resolver este problema de planificación, sigue este ciclo: 1) Razona qué información necesitas. 2) Lista qué acciones tomarías para obtenerla. 3) Con esa info, razona la solución. 4) Verifica si la solución cumple todos los criterios. Repite si es necesario."</Text>
              </View>
            </View>
          </View>
          <View style={[styles.card, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
            <View style={styles.cardRow}>
              <View style={[styles.cardIcon, { backgroundColor: '#fde68a' }]}><Text style={{ fontSize: 19 }}>💡</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Por qué importa</Text>
                <Text style={styles.cardText}>ReAct es la base de los agentes de IA actuales (como cuando un LLM puede buscar en internet, ejecutar código y tomar decisiones en secuencia). Entenderlo te prepara para el siguiente nivel de uso de IA.</Text>
              </View>
            </View>
          </View>
        </View>
      );

      // ===== 11 · Auto-refinamiento — Builder =====
      case 11: return (
        <View>
          <Tag text="🔄 MÓDULO 11 · BUILDER" />
          <Text style={styles.titleSm}>El prompt que se refina solo</Text>
          <Text style={styles.subtitle}>Añade instrucciones para que el modelo mejore su propia respuesta antes de entregarla.</Text>
          <View style={[styles.hlBox, { borderLeftColor: '#10b981', backgroundColor: '#f0fdf4' }]}>
            <Text style={[styles.hlText, { color: '#065f46' }]}><Text style={styles.hlBold}>Patrón:</Text> [Instrucción principal]. Antes de responder: evalúa si tu borrador cumple [criterio 1] y [criterio 2]. Si no, corrígelo. Luego entrega la versión mejorada.</Text>
          </View>
          <Text style={styles.builderLabel}>Tu instrucción principal</Text>
          <TextInput style={[styles.builderInput, styles.builderArea]} placeholder="Ej: Escribe el email de presentación de mi startup para un inversionista ángel..." placeholderTextColor="#b8bcc0" value={refBase} onChangeText={setRefBase} multiline />
          <Text style={styles.builderLabel}>Criterio de refinamiento 1</Text>
          <TextInput style={styles.builderInput} placeholder="Ej: ¿el tono es confiado sin sonar arrogante?" placeholderTextColor="#b8bcc0" value={refC1} onChangeText={setRefC1} />
          <Text style={styles.builderLabel}>Criterio de refinamiento 2</Text>
          <TextInput style={styles.builderInput} placeholder="Ej: ¿menciona el problema que resuelvo en las primeras 2 oraciones?" placeholderTextColor="#b8bcc0" value={refC2} onChangeText={setRefC2} />
          <View style={[styles.builderResult, refOk && styles.builderResultFilled]}>
            <Text style={[styles.builderResultText, refOk && styles.builderResultTextFilled]}>
              {refOk ? `${refBase.trim()} Antes de entregar tu respuesta, evalúa: 1) ${refC1.trim()} 2) ${refC2.trim()} Si alguno falla, corrige el texto. Luego entrega la versión final mejorada.` : 'Tu prompt con auto-refinamiento aparecerá aquí...'}
            </Text>
          </View>
        </View>
      );

      // ===== 12 · Sprint =====
      case 12: {
        if (spPhase === 'done') {
          return (
            <View>
              <Tag text="🏁 SPRINT COMPLETADO" />
              <Text style={styles.sprintBigScore}>{spScore}/{SPRINT_TECNICAS.length}</Text>
              <View style={[styles.hlBox, { borderLeftColor: '#10b981', backgroundColor: '#f0fdf4' }]}>
                <Text style={[styles.hlText, { color: '#065f46' }]}><Text style={styles.hlBold}>+{spScore * 8} XP.</Text> {spScore >= 4 ? 'Identificas técnicas como un experto.' : 'Con práctica, la selección de técnica se vuelve automática.'}</Text>
              </View>
            </View>
          );
        }
        const it = SPRINT_TECNICAS[spIdx];
        const timedOut = spAnswered && spChoice === null;
        return (
          <View>
            <Tag text="⚡ MÓDULO 12 · SPRINT" />
            <Text style={styles.titleSm}>Tus trucos en acción</Text>
            <Text style={styles.subtitle}>90 segundos. Lee la situación y elige la técnica correcta.</Text>
            <Text style={styles.sprintTimer}>{Math.floor(spSec / 60)}:{String(spSec % 60).padStart(2, '0')}</Text>
            <View style={styles.sprintBarWrap}><View style={[styles.sprintBar, { width: `${Math.max(0, (spSec / 90) * 100)}%` }]} /></View>
            <View style={styles.sprintSituacion}>
              <Text style={styles.sprintSituacionText}>{spPhase === 'idle' ? 'Toca Iniciar para comenzar' : it.situacion}</Text>
            </View>
            {spPhase === 'running' && (
              <View style={styles.sprintOptsRow}>
                {spOpts[spIdx].map(o => (
                  <TouchableOpacity key={o} style={[styles.sprintOpt, spAnswered && spChoice === o && (o === it.correcta ? styles.sprintOptCorrect : styles.sprintOptWrong)]} disabled={spAnswered} onPress={() => answerSprint(o)}>
                    <Text style={styles.sprintOptText}>{tecEmoji(o)} {o}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {spPhase === 'running' && spAnswered && (
              <QuizFb ok={!timedOut && spChoice === it.correcta}>
                {timedOut ? '⏱️ Tiempo. Correcta: ' : spChoice === it.correcta ? '✅ ' : '❌ Correcta: '}
                {(timedOut || spChoice !== it.correcta) && <Text style={{ fontWeight: '700' }}>{it.correcta}</Text>}
                {(timedOut || spChoice !== it.correcta) && '. '}
                {getRazon(it.correcta)}
              </QuizFb>
            )}
            {spPhase === 'running' && spAnswered && (
              <TouchableOpacity style={styles.sprintAdvBtn} onPress={advanceSprint}>
                <Text style={styles.sprintBtnLabel}>→ Continuar</Text>
              </TouchableOpacity>
            )}
            {spPhase === 'idle' && (
              <TouchableOpacity style={styles.sprintStartBtn} onPress={() => { setSpPhase('running'); setSpSec(90); }}>
                <Text style={styles.sprintBtnLabel}>▶ Iniciar</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      }

      // ===== 13 · Librería personal =====
      case 13: return (
        <View>
          <Tag text="📦 MÓDULO 13 · LIBRERÍA PERSONAL" />
          <Text style={styles.titleSm}>Tu kit: 5 prompts reutilizables</Text>
          <Text style={styles.subtitle}>Los mejores prompts se guardan y reutilizan. Diseña tus 5 plantillas personales.</Text>
          <View style={[styles.hlBox, { borderLeftColor: '#10b981', backgroundColor: '#f0fdf4' }]}>
            <Text style={[styles.hlText, { color: '#065f46' }]}><Text style={styles.hlBold}>Estructura de una plantilla:</Text> [Técnica] + [Rol] + [Instrucción con variable] + [Formato]{'\n'}Ejemplo: "Few-shot. Actúa como editor. Mejora este [tipo de texto]: [pega aquí]. Estilo: [conciso / formal / conversacional]."</Text>
          </View>
          {LIB_AREAS.map((area, i) => (
            <View key={i}>
              <Text style={styles.builderLabel}>Plantilla {i + 1} — {area}</Text>
              <TextInput style={[styles.builderInput, styles.builderArea]} placeholder="Escribe tu plantilla reutilizable aquí..." placeholderTextColor="#b8bcc0" value={templates[i]} onChangeText={t => { const n = [...templates]; n[i] = t; setTemplates(n); }} multiline editable={!libSaved} />
            </View>
          ))}
          {libSaved && <QuizFb ok>✅ +25 XP. Tu librería de 5 prompts quedó guardada en tu portafolio IA Explorer.</QuizFb>}
        </View>
      );

      // ===== 14 · Prompts por materia (teoría) =====
      case 14: return (
        <View>
          <Tag text="🎓 MÓDULO 14 · CASOS REALES" />
          <Text style={styles.titleSm}>Prompts por materia escolar</Text>
          <Text style={styles.subtitle}>Templates reales que aplican las técnicas de este nivel.</Text>
          {([
            ['🔬', '#bbf7d0', '#f0fdf4', '#bbf7d0', 'Ciencias — Few-shot', 'Clasifica estos conceptos como física / química / biología:\nEj 1: "fotosíntesis" → biología\nEj 2: "enlace covalente" → química\nEj 3: "velocidad terminal" → física\nAhora clasifica: [tus conceptos]'],
            ['📚', '#bfdbfe', '#fff', '#e2e8f0', 'Literatura — CoT + System', 'System: "Eres un crítico literario que enseña a adolescentes. Siempre citas párrafos del texto."\nPrompt: "Analiza el simbolismo de [obra]. Primero identifica 3 símbolos. Para cada uno: cita el párrafo, explica el símbolo, conecta con el tema central."'],
            ['🔢', '#fde68a', '#fffbeb', '#fde68a', 'Matemáticas — CoT + temperatura baja', 'Resuelve: [problema]. Muéstrame paso a paso, identificando qué fórmula usas en cada paso y por qué. Al terminar, verifica que el resultado sea razonable en el contexto del problema.'],
            ['🌍', '#e9d5ff', '#faf5ff', '#e9d5ff', 'Inglés — One-shot', 'Corrige mi inglés con este estilo:\nEj: "I goed to the store" → Corrección: "I went to the store." Error: pasado irregular de go. Regla: los verbos irregulares no usan -ed.\nAhora corrige: [tus oraciones]'],
          ] as const).map(([emoji, iconBg, bg, border, title, text]) => (
            <View key={title} style={[styles.card, { backgroundColor: bg, borderColor: border, marginBottom: 7 }]}>
              <View style={styles.cardRow}>
                <View style={[styles.cardIcon, { backgroundColor: iconBg }]}><Text style={{ fontSize: 19 }}>{emoji}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{title}</Text>
                  <Text style={[styles.cardText, { fontSize: 11 }]}>{text}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      );

      // ===== 15 · Desafío maestro =====
      case 15: return (
        <View>
          <Tag text="🏆 MÓDULO 15 · DESAFÍO MAESTRO" />
          <Text style={styles.titleSm}>El prompt más complejo que puedas escribir</Text>
          <Text style={styles.subtitle}>Combina al menos 3 técnicas del nivel en un solo prompt. Este es tu proyecto final de Mundo 2.</Text>
          <View style={[styles.hlBox, { borderLeftColor: '#f59e0b', backgroundColor: '#fffbeb' }]}>
            <Text style={[styles.hlText, { color: '#92400e' }]}><Text style={styles.hlBold}>Técnicas disponibles:</Text> Zero/One/Few-shot · System prompt · CoT · Temperatura implícita · Auto-refinamiento · Rol complejo · Checkpoints · ReAct</Text>
          </View>
          <Text style={styles.builderLabel}>¿Qué técnicas vas a combinar?</Text>
          <TextInput style={styles.builderInput} placeholder="Ej: Few-shot + CoT + auto-refinamiento..." placeholderTextColor="#b8bcc0" value={dmTec} onChangeText={setDmTec} editable={!dmDone} />
          <Text style={styles.builderLabel}>Tu prompt maestro</Text>
          <TextInput style={[styles.builderInput, styles.builderAreaLg]} placeholder="Escribe el prompt más completo y poderoso que puedas construir hoy. Sin límite de extensión." placeholderTextColor="#b8bcc0" value={dmPrompt} onChangeText={setDmPrompt} multiline editable={!dmDone} />
          {dmDone && <QuizFb ok>✅ +30 XP. Tu prompt maestro quedó en tu portafolio IA Explorer. Es evidencia real de que dominas el prompting avanzado.</QuizFb>}
        </View>
      );

      // ===== 16 · Drag & drop =====
      case 16: return (
        <View>
          <Tag text="🗂️ MÓDULO 16 · DRAG-DROP" />
          <Text style={styles.subtitle}>Clasifica cada tarea con la técnica más adecuada.</Text>
          <View style={styles.chipsPool}>
            {DD_TECNICAS.map((item, idx) => ddPlaced[idx] === undefined ? (
              <TouchableOpacity key={idx} id={`dd12-chip-${idx}`} style={[styles.chip, ddSel === idx && styles.chipSel]} onPress={() => setDdSel(ddSel === idx ? null : idx)} disabled={ddVerified}>
                <Text style={styles.chipText}>{item.text}</Text>
              </TouchableOpacity>
            ) : null)}
            {ddAllPlaced && <Text style={styles.poolDone}>Todos los chips colocados ✓</Text>}
          </View>
          {[[DD_COLS[0], DD_COLS[1]], [DD_COLS[2], DD_COLS[3]]].map((row, r) => (
            <View key={r} style={styles.dropRow}>
              {row.map(col => (
                <TouchableOpacity key={col.id} id={`dd12-zone-${col.id}`} activeOpacity={0.8} style={[styles.dropCol, { flex: 1 }, ddOverCol === col.id && styles.dropColOver]} onPress={() => ddPlace(col.id)} disabled={ddVerified}>
                  <Text style={[styles.dropHeader, { backgroundColor: col.bg, color: col.color }]}>{col.label}</Text>
                  <View style={styles.dropArea}>
                    {DD_TECNICAS.map((item, idx) => ddPlaced[idx] === col.id ? (
                      <TouchableOpacity key={idx} onPress={() => ddReturn(idx)} disabled={ddVerified}
                        style={[styles.dropChip, ddVerified && (item.cat === col.id ? styles.dropChipOk : styles.dropChipBad)]}>
                        <Text style={[styles.dropChipText, ddVerified && { color: item.cat === col.id ? '#166534' : '#991b1b' }]}>
                          {ddVerified ? (item.cat === col.id ? '✓ ' : '✕ ') : ''}{item.text}{ddVerified ? '' : ' ✕'}
                        </Text>
                      </TouchableOpacity>
                    ) : null)}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ))}
          <TouchableOpacity id="dd12-zone-sys" activeOpacity={0.8} style={[styles.dropCol, ddOverCol === 'sys' && styles.dropColOver]} onPress={() => ddPlace('sys')} disabled={ddVerified}>
            <Text style={[styles.dropHeader, { backgroundColor: DD_COLS[4].bg, color: DD_COLS[4].color }]}>{DD_COLS[4].label}</Text>
            <View style={styles.dropArea}>
              {DD_TECNICAS.map((item, idx) => ddPlaced[idx] === 'sys' ? (
                <TouchableOpacity key={idx} onPress={() => ddReturn(idx)} disabled={ddVerified}
                  style={[styles.dropChip, ddVerified && (item.cat === 'sys' ? styles.dropChipOk : styles.dropChipBad)]}>
                  <Text style={[styles.dropChipText, ddVerified && { color: item.cat === 'sys' ? '#166534' : '#991b1b' }]}>
                    {ddVerified ? (item.cat === 'sys' ? '✓ ' : '✕ ') : ''}{item.text}{ddVerified ? '' : ' ✕'}
                  </Text>
                </TouchableOpacity>
              ) : null)}
            </View>
          </TouchableOpacity>
          {ddVerified && (
            <View>
              <QuizFb ok={ddCorrectCount >= 6}>
                {ddCorrectCount >= 6 ? '✅ ' : '⚠️ '}{ddCorrectCount}/{DD_TECNICAS.length} correctas. +{ddCorrectCount * 7} XP.{'\n'}
                <Text style={{ fontSize: 11 }}>Zero-shot=sin ejemplos | One-shot=1 ej | Few-shot=3+ ej | CoT=pasos | System=instrucciones base</Text>
              </QuizFb>
              {DD_TECNICAS.map((item, idx) => ddPlaced[idx] !== item.cat ? (
                <View key={idx} style={[styles.feedbackBar, styles.fbWrong]}>
                  <Text style={[styles.feedbackText, { color: '#991b1b' }]}>✕ "{item.text}" iba en <Text style={{ fontWeight: '700' }}>{ddColLabel(item.cat)}</Text>. {item.why}</Text>
                </View>
              ) : null)}
            </View>
          )}
        </View>
      );

      // ===== 17 · Quiz identifica técnica =====
      case 17: {
        if (quizFinished) {
          return (
            <View>
              <Tag text="✅ QUIZ COMPLETADO" bg="#fef3c7" color="#92400e" />
              <View style={styles.quizResultBox}><Text style={styles.quizResultText}>{quizScore}/{quizItems.length} correctas 🎯</Text></View>
              <View style={[styles.hlBox, quizScore >= 4 ? { borderLeftColor: '#10b981', backgroundColor: '#f0fdf4' } : { borderLeftColor: '#f59e0b', backgroundColor: '#fffbeb' }]}>
                <Text style={[styles.hlText, { color: quizScore >= 4 ? '#065f46' : '#92400e' }]}><Text style={styles.hlBold}>+{quizScore * 12} XP.</Text> {quizScore >= 4 ? 'Lees prompts como un experto — identificas la técnica en segundos.' : 'Practica: mira prompts en internet e identifica qué técnica usan.'}</Text>
              </View>
            </View>
          );
        }
        const q = quizItems[quizIdx];
        return (
          <View>
            <Tag text={`🔍 MÓDULO 17 · QUIZ · ${quizIdx + 1}/${quizItems.length}`} bg="#fef3c7" color="#92400e" />
            <Text style={styles.subtitle}>Lee el prompt. ¿Qué técnica usa?</Text>
            <View style={[styles.card, { backgroundColor: '#f8fafc', borderColor: '#e2e8f0', marginBottom: 10 }]}>
              <Text style={[styles.cardText, { fontFamily: MONO, fontSize: 11, lineHeight: 19 }]}>{q.prompt}</Text>
            </View>
            {q.opts.map((o, i) => (
              <TouchableOpacity key={i} style={[styles.qOpt, quizAns !== null && i !== quizAns && { opacity: 0.45 }]} disabled={quizAns !== null} onPress={() => answerQuiz(i)}>
                <Text style={styles.qOptText}>{o}</Text>
              </TouchableOpacity>
            ))}
            {quizAns !== null && (
              <QuizFb ok={quizAns === q.correct}>{quizAns === q.correct ? '✅ ' : '❌ '}{q.explain}</QuizFb>
            )}
          </View>
        );
      }

      // ===== 18 · Reflexión =====
      case 18: return (
        <View>
          <Tag text="💬 MÓDULO 18 · REFLEXIÓN" bg="#f1f5f9" color="#475569" />
          <Text style={styles.titleSm}>¿Eres ya un Prompt Master?</Text>
          <Text style={styles.subtitle}>Evalúate honestamente. ¿Qué dominas y qué te falta?</Text>
          <TextInput
            style={styles.reflectArea}
            placeholder="Ej: Creo que domino bien los conceptos de zero/few-shot y el CoT. Me falta practicar más el system prompt porque todavía me cuesta saber qué incluir y qué dejar fuera. El desafío maestro me hizo darme cuenta de que combinar técnicas es más difícil de lo que parece..."
            placeholderTextColor="#b8bcc0"
            value={reflect}
            onChangeText={t => { setReflect(t); setReflectError(null); }}
            multiline
          />
          <Text style={styles.charCount}>{reflect.length} / mínimo 50 caracteres</Text>
          {reflectError && <QuizFb ok={false}>⚠️ {reflectError}</QuizFb>}
          <View style={styles.tipBox}>
            <Text style={styles.tipBoxText}>✅ Esta reflexión queda en tu portafolio IA Explorer. Es el cierre del Mundo 2.</Text>
          </View>
        </View>
      );

      // ===== 19 · COMPLETADO =====
      case 19: return (
        <View style={styles.completeContainer}>
          <View style={styles.completeBadge}><Text style={{ fontSize: 46 }}>🏅</Text></View>
          <Text style={styles.completeTitle}>¡Nivel 12 completado!</Text>
          <Text style={styles.completeSub}>Badge: 🔑 Prompt Master desbloqueado. Completaste el Mundo 2 — Domina el Prompting.</Text>
          <View style={styles.skillsBox}>
            {[
              'Domino zero-shot, one-shot, few-shot y cuándo usar cada uno',
              'Construí un system prompt completo con los 5 componentes',
              'Entiendo temperatura alta vs. baja y cuándo aplica cada una',
              'Tengo mi librería personal de 5 prompts reutilizables',
              'Escribí el prompt más complejo que he construido hasta ahora',
            ].map((skill, i, arr) => (
              <View key={i} style={[styles.skillRow, i === arr.length - 1 && { marginBottom: 0 }]}>
                <Text style={styles.skillCheck}>✓</Text>
                <Text style={styles.skillText}>{skill}</Text>
              </View>
            ))}
          </View>
          <View style={styles.nextWorldBox}>
            <Text style={styles.nextWorldTitle}>🌍 Mundo 1 ✅ · 🎯 Mundo 2 ✅</Text>
            <Text style={styles.nextWorldText}>Siguiente: 🎨 Mundo 3 — IA Creativa{'\n'}Imágenes, audio, video, datos y multimodalidad</Text>
          </View>
          <View style={styles.lvlBarWrap}>
            <Text style={styles.lvlBarLabel}>Nivel 12 de 36 completado · Mundo 2 completado · ¡Empieza el Mundo 3!</Text>
            <View style={styles.lvlBarOuter}><View style={[styles.lvlBarInner, { width: '33%' }]} /></View>
          </View>
          <TouchableOpacity style={[styles.mainBtn, { width: '100%' }]} onPress={finish}>
            <Text style={styles.mainBtnText}>Ir al Mundo 3 →</Text>
          </TouchableOpacity>
        </View>
      );

      default: return null;
    }
  };

  // ---------- Botón principal por paso ----------
  const getBtn = (): { label: string; enabled: boolean; green?: boolean; note?: string; onPress: () => void } | null => {
    switch (step) {
      case 0: return { label: '¡Empezar! →', enabled: true, onPress: next };
      case 1: case 8: case 9: case 10: case 14: return { label: 'Continuar →', enabled: true, onPress: next };
      case 2: return { label: 'Continuar →', enabled: osChoice !== null || devMode, note: osChoice === null ? 'Responde la pregunta para continuar · +12 XP' : undefined, onPress: next };
      case 3: return { label: 'Continuar →', enabled: fsOk || devMode, note: fsOk ? undefined : 'Completa la tarea y los 3 ejemplos con contenido real (no texto al azar) · +15 XP', onPress: () => { if (!fsAwarded) { setFsAwarded(true); addXP(15); } next(); } };
      case 4:
        if (!matchChecked) return { label: 'Verificar →', enabled: matchAns.every(a => a !== null) || devMode, note: 'Elige una técnica para cada situación · hasta 40 XP', onPress: verifyMatching };
        return { label: 'Continuar →', enabled: true, onPress: next };
      case 5:
        if (!fillDone) return { label: 'Ver personaje completo →', enabled: fillOk || devMode, note: 'Completa los 3 campos con detalles específicos (mínimo 8 caracteres) · +15 XP', onPress: () => { setFillDone(true); addXP(15); } };
        return { label: 'Continuar →', enabled: true, onPress: next };
      case 6: return { label: 'Continuar →', enabled: sysOk || devMode, note: sysOk ? undefined : 'Completa los 5 componentes de tu system prompt · +15 XP', onPress: () => { if (!sysAwarded) { setSysAwarded(true); addXP(15); } next(); } };
      case 7: return { label: 'Continuar →', enabled: shChoice !== null || devMode, note: shChoice === null ? 'Responde la pregunta para continuar · +12 XP' : undefined, onPress: next };
      case 11: return { label: 'Continuar →', enabled: refOk || devMode, note: refOk ? undefined : 'Escribe tu instrucción y los 2 criterios de refinamiento · +12 XP', onPress: () => { if (!refAwarded) { setRefAwarded(true); addXP(12); } next(); } };
      case 12: return { label: 'Continuar →', enabled: spPhase === 'done' || devMode, note: spPhase !== 'done' ? 'Completa el sprint · hasta 40 XP' : undefined, onPress: next };
      case 13:
        if (!libSaved) return { label: 'Guardar librería →', enabled: libOk || devMode, note: 'Escribe tus 5 plantillas (mínimo 15 caracteres cada una) · +25 XP', onPress: () => { setLibSaved(true); addXP(25); } };
        return { label: 'Continuar →', enabled: true, onPress: next };
      case 15:
        if (!dmDone) return { label: 'Entregar prompt maestro →', enabled: dmOk || devMode, green: true, note: 'Nombra tus técnicas y escribe un prompt real de al menos 50 caracteres · +30 XP', onPress: () => { setDmDone(true); addXP(30); } };
        return { label: 'Continuar →', enabled: true, onPress: next };
      case 16:
        if (!ddVerified) return { label: 'Verificar →', enabled: ddAllPlaced || devMode, note: 'Toca un chip → luego toca la columna donde va (o arrástralo) · hasta 56 XP', onPress: verifyDd };
        return { label: 'Continuar →', enabled: true, onPress: next };
      case 17:
        if (quizFinished) return { label: 'Continuar →', enabled: true, onPress: next };
        return { label: 'Siguiente →', enabled: quizAns !== null || devMode, note: quizAns === null ? `Pregunta ${quizIdx + 1} de ${quizItems.length} · +12 XP por acierto` : undefined, onPress: nextQuiz };
      case 18: return { label: 'Completar nivel →', enabled: reflect.trim().length >= 50 || devMode, green: true, note: 'Escribe al menos 50 caracteres · +15 XP', onPress: submitReflect };
      case 19: return null; // botón dentro de la pantalla de completado
      default: return null;
    }
  };

  const btn = getBtn();
  const progressPercent = (step / (TOTAL_STEPS - 1)) * 100;

  return (
    <View style={styles.screen}>
      <View style={styles.lessonBar}>
        <TouchableOpacity onPress={() => exitLevel()} style={styles.closeBtn}><Text style={styles.closeBtnText}>✕</Text></TouchableOpacity>
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
            <TouchableOpacity style={[styles.mainBtn, { flex: 1 }, !btn.enabled && styles.mainBtnDisabled]} onPress={btn.onPress} disabled={!btn.enabled}>
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

// ===================== ESTILOS (paleta del HTML nivel-12) =====================
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
  titleSm: { ...typography.extraBold, fontSize: 16, color: '#0f172a', marginBottom: 7, lineHeight: 22 },
  subtitle: { ...typography.regular, fontSize: 13, color: '#64748b', marginBottom: 13, lineHeight: 22 },
  questionText: { fontSize: 13, fontWeight: '700', color: '#0f172a', lineHeight: 20, marginTop: 4, marginBottom: 8 },

  // Cards
  card: { borderRadius: 14, padding: 13, marginBottom: 9, borderWidth: 1 },
  cardRow: { flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  cardIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 12, fontWeight: '700', color: '#0f172a', marginBottom: 3 },
  cardText: { fontSize: 12, color: '#334155', lineHeight: 20 },
  cardBold: { fontWeight: '700', color: '#0f172a' },
  promptMono: { fontFamily: MONO, fontSize: 10, color: '#334155', lineHeight: 16, marginTop: 2 },
  respItalic: { fontStyle: 'italic', fontSize: 11, color: '#334155', lineHeight: 17, marginTop: 4 },

  // Highlight boxes
  hlBox: { paddingHorizontal: 14, paddingVertical: 12, borderTopRightRadius: 12, borderBottomRightRadius: 12, borderLeftWidth: 3, marginVertical: 9 },
  hlText: { fontSize: 12, lineHeight: 20, fontWeight: '500' },
  hlBold: { fontWeight: '700' },

  // Compare panels
  comparePanel: { borderRadius: 12, padding: 12, borderWidth: 1.5, marginBottom: 8 },
  comparePanelA: { backgroundColor: '#fff7ed', borderColor: '#fed7aa' },
  comparePanelB: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  compareLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, marginBottom: 6, textTransform: 'uppercase' },
  compareResp: { fontFamily: MONO, fontSize: 11, color: '#334155', lineHeight: 18, borderLeftWidth: 2, borderLeftColor: '#94a3b8', paddingLeft: 8 },
  compareRespItalic: { fontStyle: 'italic', fontSize: 11, color: '#334155', lineHeight: 18, marginTop: 6, borderLeftWidth: 2, borderLeftColor: '#94a3b8', paddingLeft: 8 },

  // Opciones de quiz/compare
  qOpt: { width: '100%', paddingHorizontal: 13, paddingVertical: 11, borderRadius: 11, borderWidth: 2, borderColor: '#e2e8f0', backgroundColor: '#f8fafc', marginBottom: 7 },
  qOptText: { fontSize: 12, fontWeight: '600', color: '#334155', lineHeight: 18 },

  // Feedback
  feedbackBar: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 7 },
  fbOk: { backgroundColor: '#dcfce7' },
  fbWrong: { backgroundColor: '#f0fdf4' },
  feedbackText: { fontSize: 12, lineHeight: 19, fontWeight: '500' },

  // Builder
  builderLabel: { fontSize: 11, fontWeight: '700', color: '#374151', marginTop: 10, marginBottom: 4 },
  builderInput: { width: '100%', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#cbd5e1', backgroundColor: '#f8fafc', fontSize: 12, color: '#0f172a' },
  builderArea: { minHeight: 56, textAlignVertical: 'top' },
  builderAreaLg: { minHeight: 110, textAlignVertical: 'top' },
  builderResult: { backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, marginTop: 10, minHeight: 48 },
  builderResultFilled: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' },
  builderResultText: { fontSize: 12, color: '#94a3b8', lineHeight: 20, fontStyle: 'italic' },
  builderResultTextFilled: { color: '#065f46', fontStyle: 'normal' },

  // Matching
  matchBox: { borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12, padding: 11, marginBottom: 8, backgroundColor: '#f8fafc' },
  matchSituacion: { fontSize: 12, color: '#0f172a', fontWeight: '600', marginBottom: 8, lineHeight: 18 },
  matchOptsRow: { flexDirection: 'row', gap: 6 },
  matchOpt: { flex: 1, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 9, borderWidth: 1.5, borderColor: '#c4b5fd', backgroundColor: '#f5f3ff', alignItems: 'center' },
  matchOptSel: { borderColor: '#7c3aed', backgroundColor: '#ede9fe' },
  matchOptCorrect: { borderColor: '#10b981', backgroundColor: '#dcfce7' },
  matchOptWrong: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },
  matchOptText: { fontSize: 11, fontWeight: '700', color: '#5b21b6' },

  // Sprint
  sprintTimer: { fontSize: 24, fontWeight: '800', color: '#d97706', textAlign: 'center', marginTop: 8, marginBottom: 4, fontVariant: ['tabular-nums'] },
  sprintBarWrap: { height: 8, backgroundColor: '#e2e8f0', borderRadius: 4, overflow: 'hidden', marginBottom: 10 },
  sprintBar: { height: '100%', borderRadius: 4, backgroundColor: '#f59e0b' },
  sprintSituacion: { padding: 13, backgroundColor: '#fffbeb', borderRadius: 12, borderWidth: 1.5, borderColor: '#fde68a', marginBottom: 10 },
  sprintSituacionText: { fontSize: 13, fontWeight: '700', color: '#0f172a', lineHeight: 19 },
  sprintOptsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  sprintOpt: { flexGrow: 1, flexBasis: '45%', paddingVertical: 9, paddingHorizontal: 6, borderRadius: 9, borderWidth: 2, borderColor: '#e2e8f0', backgroundColor: '#f8fafc', alignItems: 'center' },
  sprintOptCorrect: { borderColor: '#10b981', backgroundColor: '#dcfce7' },
  sprintOptWrong: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },
  sprintOptText: { fontSize: 11, fontWeight: '700', color: '#334155' },
  sprintStartBtn: { width: '100%', padding: 11, borderRadius: 11, backgroundColor: '#d97706', alignItems: 'center', marginTop: 8 },
  sprintAdvBtn: { width: '100%', padding: 11, borderRadius: 11, backgroundColor: '#10b981', alignItems: 'center', marginTop: 8 },
  sprintBtnLabel: { color: '#fff', fontWeight: '700', fontSize: 13 },
  sprintBigScore: { fontSize: 28, fontWeight: '800', color: '#0f172a', textAlign: 'center', paddingVertical: 16 },

  // Drag & drop
  chipsPool: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 8, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#cbd5e1', marginBottom: 10, minHeight: 52, alignItems: 'center' },
  chip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 14, borderWidth: 1.5, borderColor: '#cbd5e1', backgroundColor: '#f1f5f9', minHeight: 36, justifyContent: 'center' },
  chipSel: { borderColor: '#10b981', backgroundColor: '#ecfdf5' },
  chipText: { fontSize: 11, color: '#334155', fontWeight: '700' },
  poolDone: { fontSize: 11, color: '#94a3b8', alignSelf: 'center' },
  dropRow: { flexDirection: 'row', gap: 7, marginBottom: 7 },
  dropCol: { borderRadius: 12, borderWidth: 2, borderStyle: 'dashed', borderColor: '#cbd5e1', minHeight: 80, padding: 7, backgroundColor: '#fafafa', marginBottom: 7 },
  dropColOver: { borderColor: '#10b981', backgroundColor: '#ecfdf5' },
  dropHeader: { fontSize: 10, fontWeight: '700', textAlign: 'center', marginBottom: 6, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 7, overflow: 'hidden', textTransform: 'uppercase', letterSpacing: 0.4 },
  dropArea: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, minHeight: 28 },
  dropChip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12, minHeight: 28, justifyContent: 'center', backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#cbd5e1' },
  dropChipOk: { backgroundColor: '#dcfce7', borderColor: '#10b981' },
  dropChipBad: { backgroundColor: '#fff1f2', borderColor: '#ef4444' },
  dropChipText: { fontSize: 10, fontWeight: '700', color: '#334155', lineHeight: 14 },

  // Quiz resultado
  quizResultBox: { padding: 13, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 4 },
  quizResultText: { fontSize: 15, fontWeight: '700', color: '#0f172a', textAlign: 'center' },

  // Reflexión
  reflectArea: { width: '100%', minHeight: 110, padding: 11, borderRadius: 10, borderWidth: 1.5, borderColor: '#e2e8f0', fontSize: 13, color: '#334155', lineHeight: 22, backgroundColor: '#fafafa', textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: '#94a3b8', textAlign: 'right', marginTop: 4 },
  tipBox: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 11, marginTop: 10 },
  tipBoxText: { fontSize: 12, color: '#92400e', lineHeight: 20 },

  // Completado
  completeContainer: { alignItems: 'center', paddingTop: 8, paddingHorizontal: 4, paddingBottom: 16 },
  completeBadge: { width: 88, height: 88, borderRadius: 24, backgroundColor: '#fde68a', alignItems: 'center', justifyContent: 'center', marginBottom: 16, shadowColor: '#fbbf24', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 24, elevation: 8 },
  completeTitle: { ...typography.extraBold, fontSize: 21, color: '#0f172a', marginBottom: 6, textAlign: 'center' },
  completeSub: { ...typography.regular, fontSize: 12, color: '#64748b', lineHeight: 20, marginBottom: 16, textAlign: 'center' },
  skillsBox: { width: '100%', backgroundColor: '#fffbeb', borderRadius: 12, padding: 13, marginBottom: 14, borderWidth: 1, borderColor: '#fde68a' },
  skillRow: { flexDirection: 'row', gap: 8, marginBottom: 7, alignItems: 'flex-start' },
  skillCheck: { color: '#d97706', fontWeight: '700', fontSize: 12 },
  skillText: { flex: 1, fontSize: 12, color: '#334155', lineHeight: 18 },
  nextWorldBox: { width: '100%', backgroundColor: '#fde68a', borderRadius: 12, padding: 14, marginBottom: 14, alignItems: 'center', borderWidth: 1, borderColor: '#fcd34d' },
  nextWorldTitle: { fontSize: 14, fontWeight: '800', color: '#92400e', marginBottom: 4 },
  nextWorldText: { fontSize: 12, color: '#92400e', textAlign: 'center', lineHeight: 18 },
  lvlBarWrap: { width: '100%', marginBottom: 14 },
  lvlBarLabel: { fontSize: 10, color: '#94a3b8', marginBottom: 4 },
  lvlBarOuter: { height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden' },
  lvlBarInner: { height: '100%', backgroundColor: '#f59e0b', borderRadius: 3 },

  // Footer
  btnRow: { paddingHorizontal: 13, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', backgroundColor: '#fafcff' },
  btnRowInner: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  backBtn: { paddingHorizontal: 16, paddingVertical: 13, borderRadius: 12, backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#e2e8f0', minHeight: 48, justifyContent: 'center' },
  backBtnText: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  mainBtn: { padding: 13, borderRadius: 12, backgroundColor: '#10b981', alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  mainBtnText: { ...typography.bold, color: '#fff', fontSize: 14, letterSpacing: 0.14 },
  mainBtnDisabled: { opacity: 0.32 },
  btnNote: { fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 5, minHeight: 15 },
});
