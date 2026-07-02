import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  BackHandler,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { router } from 'expo-router';
import { useGameStore } from '../store/gameStore';
import { colors, typography } from '../theme';
import XPToast from '../components/XPToast';

// ---------- Tipos y constantes ----------
type DragItem = { text: string; correct: string };
type MatchPair = { left: string; right: string };
type QuizQuestion = {
  q: string;
  opts: string[];
  correct: number;
  explain: string;
};
type TFItem = { stmt: string; correct: boolean; explain: string };
type VocabItem = {
  sentence: string;
  allOpts: string[];
  correct: number;
  explain: string;
};
type PromptItem = {
  task: string;
  bad: string;
  good: string;
  explain: string;
};
type SortStep = { bold: string; rest: string };

const TOTAL_STEPS = 17; // 0:intro + 15 módulos + 1:complete
const CONTENT_STEPS = 15;

const AI_TYPE_POOL: DragItem[] = [
  { text: 'Recomendarte videos en YouTube', correct: 'rec' },
  { text: 'Sugerirte canciones en Spotify', correct: 'rec' },
  { text: 'Mostrarte publicaciones en Instagram', correct: 'rec' },
  { text: 'Predecir qué serie verás en Netflix', correct: 'rec' },
  { text: 'Reconocer tu cara para desbloquear el cel', correct: 'vis' },
  { text: 'Enfocar solo a las personas en una foto', correct: 'vis' },
  { text: 'Leer el texto de una foto en Google Lens', correct: 'vis' },
  { text: 'Detectar si tienes mascarilla en una foto', correct: 'vis' },
  { text: 'Autocorregir lo que escribes', correct: 'nlp' },
  { text: 'Traducir un mensaje de WhatsApp', correct: 'nlp' },
  { text: 'Responder preguntas en ChatGPT', correct: 'nlp' },
  { text: 'Resumir un texto largo automáticamente', correct: 'nlp' },
  { text: 'Crear una imagen desde cero con palabras', correct: 'gen' },
  { text: 'Escribir un correo completo con IA', correct: 'gen' },
  { text: 'Generar música a partir de una descripción', correct: 'gen' },
  { text: 'Crear un video con un personaje animado', correct: 'gen' },
];

const APP_MATCH_POOL: MatchPair[] = [
  { left: 'TikTok', right: 'IA de recomendación — predice qué video te engancha' },
  { left: 'Face ID', right: 'IA de visión — mapea 30,000 puntos de tu cara' },
  { left: 'Google Translate', right: 'IA de lenguaje — predice la traducción más probable' },
  { left: 'Midjourney', right: 'IA generativa — crea imágenes desde texto' },
  { left: 'Spotify Discover', right: 'IA de recomendación — compara tu historial con 600M usuarios' },
  { left: 'Google Lens', right: 'IA de visión — identifica objetos en fotos en tiempo real' },
  { left: 'ChatGPT', right: 'IA de lenguaje — predice la siguiente palabra a gran escala' },
  { left: 'DALL·E', right: 'IA generativa — transforma descripciones en imágenes únicas' },
];

const SEARCH_QUIZ_POOL: QuizQuestion[] = [
  {
    q: 'Quieres saber el precio actual del dólar hoy. ¿Qué usas?',
    opts: ['ChatGPT — es más inteligente y da mejores respuestas', 'Google — busca información en tiempo real actualizada', 'Claude — tiene la mejor capacidad de razonamiento', 'Ambos son iguales para esto'],
    correct: 1,
    explain: 'Los LLMs tienen fecha de corte en su conocimiento y no acceden a internet en tiempo real. Para datos que cambian cada segundo, Google es la herramienta correcta.',
  },
  {
    q: 'Necesitas entender un concepto difícil de física para mañana. ¿Qué usas?',
    opts: ['Google — tiene todas las páginas web del mundo', 'Un LLM como ChatGPT o Claude — puede explicarlo con ejemplos adaptados a tu nivel', 'Wikipedia directamente — es más confiable', 'YouTube — solo los videos explican bien'],
    correct: 1,
    explain: 'Los LLMs brillan en explicar conceptos complejos de forma personalizada. Puedes pedirle "explícame la inercia como si tuviera 12 años" y adapta la explicación exactamente a ti.',
  },
  {
    q: 'Quieres saber qué restaurantes están abiertos cerca de ti ahora. ¿Qué usas?',
    opts: ['ChatGPT — conoce restaurantes de todo el mundo', 'Google Maps o Google Search — tiene datos de ubicación en tiempo real', 'Claude — es más preciso para este tipo de consultas', 'Cualquiera, son exactamente iguales para esto'],
    correct: 1,
    explain: 'Los LLMs no tienen datos de tu ubicación ni de horarios de negocios actualizados. Para información local y en tiempo real, Google Maps es la herramienta indicada.',
  },
  {
    q: 'Quieres revisar si tu ensayo tiene errores de redacción y suena bien. ¿Qué usas?',
    opts: ['Google — busca los errores de gramática más comunes', 'Un LLM como Claude o ChatGPT — puede leer tu texto y sugerir mejoras específicas', 'Ninguno — solo un profesor puede revisar bien', 'Wikipedia — tiene las reglas de redacción en español'],
    correct: 1,
    explain: 'Esta es una tarea perfecta para un LLM. Puede leer tu texto completo, encontrar errores, sugerir mejoras de estilo y explicar por qué cada cambio mejora el texto.',
  },
];

const LLM_TF_POOL: TFItem[] = [
  { stmt: 'ChatGPT busca la respuesta en internet igual que Google', correct: false, explain: 'ChatGPT predice texto a partir de su entrenamiento, no busca en internet en tiempo real. Son herramientas fundamentalmente diferentes.' },
  { stmt: 'Un LLM puede equivocarse e inventar datos que suenan reales', correct: true, explain: 'Correcto — se llama "alucinación". El LLM predice qué texto es probable, no si los datos son verídicos. Por eso debes verificar datos importantes.' },
  { stmt: 'Claude, ChatGPT y Gemini son exactamente iguales en sus capacidades', correct: false, explain: 'Cada LLM fue entrenado con diferentes datos, técnicas y fortalezas. Claude es mejor para textos largos y análisis; ChatGPT para tareas generales; Gemini para integración con Google.' },
  { stmt: 'Los LLMs entienden realmente el significado de lo que lees', correct: false, explain: 'Los LLMs no "entienden" — predicen qué texto es estadísticamente probable. La comprensión real (como la humana) no existe en estos sistemas.' },
  { stmt: 'Puedes usar un LLM para mejorar la redacción de un texto que ya escribiste', correct: true, explain: '¡Perfecto uso! Puedes pegar tu texto y pedir "mejora la redacción manteniendo mi estilo" o "corrige errores sin cambiar el contenido". Es una de sus mejores aplicaciones.' },
  { stmt: 'Un LLM siempre da la misma respuesta a la misma pregunta', correct: false, explain: 'Los LLMs tienen un parámetro de "temperatura" que introduce variabilidad. La misma pregunta puede dar respuestas diferentes en distintas sesiones.' },
  { stmt: 'Los LLMs como ChatGPT aprendieron leyendo textos de internet', correct: true, explain: 'Correcto. Fueron entrenados con enormes volúmenes de texto: libros, artículos, páginas web, código y más. Eso les da conocimiento amplio pero también sus sesgos.' },
  { stmt: 'Puedes confiar al 100% en lo que dice un LLM para un trabajo académico', correct: false, explain: 'Nunca al 100%. Los LLMs pueden "alucinar" — inventar citas, estadísticas o hechos con total confianza. Siempre verifica con fuentes primarias.' },
  { stmt: 'Un LLM puede ayudarte a aprender a programar paso a paso', correct: true, explain: '¡Absolutamente! Los LLMs son excelentes tutores de programación: explican conceptos, muestran ejemplos, detectan errores en tu código y adaptan la dificultad.' },
  { stmt: 'Los LLMs solo sirven para escribir textos y nada más', correct: false, explain: 'Los LLMs sirven para: resumir, traducir, programar, analizar datos, generar ideas, hacer matemáticas, explicar conceptos, revisar textos, planear proyectos, y mucho más.' },
];

const VOCAB_FILL_POOL: VocabItem[] = [
  {
    sentence: 'Cuando un LLM inventa información falsa con total confianza se llama <b>___</b>.',
    allOpts: ['alucinación', 'error', 'crash', 'bug'],
    correct: 0,
    explain: '"Alucinación" es el término técnico. El modelo predice texto probable pero no verifica si es verdadero.',
  },
  {
    sentence: 'La instrucción que le das a un LLM para que haga algo se llama <b>___</b>.',
    allOpts: ['prompt', 'código', 'query', 'comando'],
    correct: 0,
    explain: '"Prompt" es la instrucción o pregunta que le das al modelo. Saber escribir buenos prompts es una habilidad clave — la aprenderás en el Nivel 3.',
  },
  {
    sentence: 'Los LLMs dividen el texto en pequeñas unidades llamadas <b>___</b> para procesarlo.',
    allOpts: ['tokens', 'bytes', 'pixeles', 'bits'],
    correct: 0,
    explain: '"Token" es la unidad básica de texto para un LLM. Una palabra puede ser 1-3 tokens. Los modelos tienen un límite de tokens que pueden procesar a la vez.',
  },
  {
    sentence: 'La información previa de una conversación que el LLM puede recordar se llama <b>___</b>.',
    allOpts: ['contexto', 'memoria', 'historial', 'caché'],
    correct: 0,
    explain: '"Contexto" es la ventana de conversación que el LLM puede "ver". Si supera ese límite, olvida lo que dijiste al principio de la conversación.',
  },
  {
    sentence: 'La capacidad de un LLM de generar contenido nuevo (texto, imágenes, código) se llama IA <b>___</b>.',
    allOpts: ['generativa', 'reactiva', 'predictiva', 'adaptativa'],
    correct: 0,
    explain: '"IA Generativa" o "GenAI" es el término. ChatGPT, Claude, Gemini, DALL·E y Midjourney son todos IA generativa.',
  },
];

const PROMPT_COMPARE_POOL: PromptItem[] = [
  {
    task: 'Pedir ayuda para estudiar para un examen',
    bad: 'Ayúdame a estudiar',
    good: 'Tengo un examen de historia del siglo XX mañana. Soy estudiante de 9° grado. Necesito que me hagas 10 preguntas de práctica con sus respuestas, de menor a mayor dificultad.',
    explain: 'El prompt bueno especifica: el tema exacto, tu nivel, el tipo de ayuda que necesitas y el formato deseado. Más contexto = mejor respuesta.',
  },
  {
    task: 'Pedir que revise un texto',
    bad: 'Revisa esto',
    good: 'Revisa este párrafo. Corrige errores de ortografía y gramática. No cambies el contenido ni mi estilo. Explica brevemente cada corrección que hagas.',
    explain: 'El prompt bueno especifica qué revisar, qué no cambiar, y cómo quieres la respuesta. Un LLM sin instrucciones claras puede reescribir todo tu texto.',
  },
  {
    task: 'Pedir que explique un concepto difícil',
    bad: 'Explícame la relatividad',
    good: 'Explícame la teoría de la relatividad de Einstein como si tuviera 12 años, usando una analogía con algo de la vida cotidiana. Máximo 3 párrafos.',
    explain: 'El prompt bueno especifica el nivel, el método (analogía) y el límite de longitud. Así el LLM sabe exactamente cómo formatear la respuesta para que sea útil para ti.',
  },
];

const LLM_DRAG_POOL: DragItem[] = [
  { text: 'Resumir un PDF de 200 páginas en los puntos clave', correct: 'claude' },
  { text: 'Generar una imagen de un dragón tocando guitarra', correct: 'chatgpt' },
  { text: 'Buscar información actualizada sobre noticias de hoy', correct: 'gemini' },
  { text: 'Analizar un texto largo y hacer preguntas sobre su contenido', correct: 'claude' },
  { text: 'Escribir código en Python para un proyecto escolar', correct: 'chatgpt' },
  { text: 'Integrar con Google Docs para tomar notas automáticas', correct: 'gemini' },
  { text: 'Revisar y mejorar un ensayo de 5 páginas', correct: 'claude' },
  { text: 'Crear un chatbot sencillo para un sitio web', correct: 'chatgpt' },
  { text: 'Ver un video de YouTube y pedir un resumen', correct: 'gemini' },
  { text: 'Analizar datos de una empresa con reflexión ética', correct: 'claude' },
];

const LLM_SORT_STEPS: SortStep[] = [
  { bold: 'Recibes tu prompt:', rest: ' Escribes tu pregunta o instrucción en el chat' },
  { bold: 'Tokenización:', rest: ' Tu texto se divide en pequeños fragmentos llamados tokens' },
  { bold: 'Búsqueda de contexto:', rest: ' El modelo analiza el historial de la conversación' },
  { bold: 'Predicción:', rest: ' Calcula qué tokens son más probables como respuesta' },
  { bold: 'Respuesta generada:', rest: ' Ensambla los tokens en texto y te lo muestra' },
];

const pickN = <T,>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};

interface LevelProps {
  navigation?: any;
  setAllowBack?: (allow: boolean) => void;
}

export default function GameLevel2({ navigation: propsNavigation, setAllowBack }: LevelProps) {
  const navigationFromHook = useNavigation();
  const navigation = propsNavigation || navigationFromHook;

  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);
  const completeLevel = useGameStore((state) => state.completeLevel);
  const devMode = useGameStore((state) => state.devMode);

  const [drag3Items] = useState(() => pickN(AI_TYPE_POOL, 12));
  const [matchPairs] = useState(() => pickN(APP_MATCH_POOL, 4));
  const [quizQuestions] = useState(() => pickN(SEARCH_QUIZ_POOL, 4));
  const [tfItems] = useState(() => pickN(LLM_TF_POOL, 5));
  const [fillItem] = useState(() => pickN(VOCAB_FILL_POOL, 1)[0]);
  const [promptItems] = useState(() => pickN(PROMPT_COMPARE_POOL, 3));
  const [llmItems] = useState(() => pickN(LLM_DRAG_POOL, 6));

  // Módulo 2 — tarjetas expandibles
  const [openAppCard, setOpenAppCard] = useState<number | null>(null);

  // Drag 3
  const [drag3Placed, setDrag3Placed] = useState<{ [key: number]: string }>({});
  const [drag3Sel, setDrag3Sel] = useState<number | null>(null);
  const [drag3Attempts, setDrag3Attempts] = useState(0);
  const [drag3Ok, setDrag3Ok] = useState(false);

  // Matching
  const [matchLeft, setMatchLeft] = useState<number | null>(null);
  const [matchDone, setMatchDone] = useState(0);
  const [rightOrder, setRightOrder] = useState<string[]>([]);
  const [matchedLeft, setMatchedLeft] = useState<Set<number>>(new Set());
  const [matchedRight, setMatchedRight] = useState<Set<number>>(new Set());

  // Quiz
  const [quizAnswers, setQuizAnswers] = useState<{ [key: number]: number }>({});
  const [quizChecked, setQuizChecked] = useState(false);

  // Sort
  const [sortOrder, setSortOrder] = useState<number[]>([]);
  const [sortOk, setSortOk] = useState(false);

  // TF
  const [tfAnswers, setTfAnswers] = useState<{ [key: number]: boolean }>({});
  const [tfChecked, setTfChecked] = useState(false);

  // Fill
  const [fillSel, setFillSel] = useState<number | null>(null);
  const [fillChecked, setFillChecked] = useState(false);

  // Prompt compare
  const [promptSels, setPromptSels] = useState<{ [key: number]: 'good' | 'bad' }>({});
  const [promptsChecked, setPromptsChecked] = useState(false);

  // Reflect
  const [reflectText, setReflectText] = useState('');
  const [stepResult, setStepResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // LLM Drag
  const [llmPlaced, setLlmPlaced] = useState<{ [key: number]: string }>({});
  const [llmSel, setLlmSel] = useState<number | null>(null);
  const [llmAttempts, setLlmAttempts] = useState(0);
  const [llmOk, setLlmOk] = useState(false);

  // Web D&D — Drag 3
  const [dragOver3Zone, setDragOver3Zone] = useState<string | null>(null);
  const drag3PlacedRef = useRef(drag3Placed);
  useEffect(() => { drag3PlacedRef.current = drag3Placed; }, [drag3Placed]);
  const drag3IdxRef = useRef<number | null>(null);

  // Web D&D — LLM Drag
  const [dragOverLLMZone, setDragOverLLMZone] = useState<string | null>(null);
  const llmPlacedRef = useRef(llmPlaced);
  useEffect(() => { llmPlacedRef.current = llmPlaced; }, [llmPlaced]);
  const llmIdxRef = useRef<number | null>(null);

  const isExamMode = step === 3 || step === 5 || step === 8 || step === 9 || step === 10 || step === 12 || step === 13 || step === 14 || step === 15;

  useEffect(() => {
    setAllowBack?.(!isExamMode);
  }, [isExamMode, setAllowBack]);

  useEffect(() => {
    const onBackPress = () => {
      if (isExamMode) {
        Alert.alert(
          'Examen en curso',
          'No puedes regresar mientras realizas el examen. Si sales, perderás el progreso no guardado.',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Salir', style: 'destructive', onPress: () => navigation.goBack() }
          ]
        );
        return true;
      }
      return false;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [isExamMode, navigation]);

  useEffect(() => {
    if (step === 5) {
      setRightOrder(pickN(matchPairs.map(p => p.right), matchPairs.length).sort(() => Math.random() - 0.5));
      setMatchLeft(null);
      setMatchDone(0);
      setMatchedLeft(new Set());
      setMatchedRight(new Set());
    }
    if (step === 9) {
      const order = [0, 1, 2, 3, 4];
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      setSortOrder(order);
      setSortOk(false);
    }
    if (step === 12) {
      setLlmPlaced({});
      setLlmSel(null);
      setLlmAttempts(0);
      setLlmOk(false);
    }
  }, [step, matchPairs]);

  // Web drag & drop — Módulo 3
  useEffect(() => {
    if (Platform.OS !== 'web' || step !== 3) return;
    const cleanups: (() => void)[] = [];
    const setup = () => {
      drag3Items.forEach((_, idx) => {
        if (drag3PlacedRef.current[idx] !== undefined) return;
        const el = document.getElementById(`drag3-chip-${idx}`);
        if (!el) return;
        el.setAttribute('draggable', 'true');
        (el as HTMLElement).style.cursor = 'grab';
        const onDragStart = (e: DragEvent) => {
          drag3IdxRef.current = idx;
          setDrag3Sel(null);
          if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
        };
        const onDragEnd = () => { drag3IdxRef.current = null; setDragOver3Zone(null); };
        el.addEventListener('dragstart', onDragStart);
        el.addEventListener('dragend', onDragEnd);
        cleanups.push(() => { el.removeEventListener('dragstart', onDragStart); el.removeEventListener('dragend', onDragEnd); });
      });
      (['rec', 'vis', 'nlp', 'gen'] as const).forEach(zone => {
        const el = document.getElementById(`drop3-zone-${zone}`);
        if (!el) return;
        const onDragOver = (e: Event) => { e.preventDefault(); setDragOver3Zone(zone); };
        const onDragLeave = (e: DragEvent) => { if (!el.contains(e.relatedTarget as Node)) setDragOver3Zone(null); };
        const onDrop = (e: Event) => {
          e.preventDefault(); setDragOver3Zone(null);
          const idx = drag3IdxRef.current;
          if (idx === null || drag3PlacedRef.current[idx] !== undefined) return;
          const item = drag3Items[idx];
          if (item.correct === zone) { setDrag3Placed(prev => ({ ...prev, [idx]: zone })); setStepResult(null); }
          else showResult(false, `"${item.text}" no pertenece a esta categoría.`);
          drag3IdxRef.current = null;
        };
        el.addEventListener('dragover', onDragOver);
        el.addEventListener('dragleave', onDragLeave);
        el.addEventListener('drop', onDrop);
        cleanups.push(() => { el.removeEventListener('dragover', onDragOver); el.removeEventListener('dragleave', onDragLeave); el.removeEventListener('drop', onDrop); });
      });
    };
    const timer = setTimeout(setup, 50);
    return () => { clearTimeout(timer); cleanups.forEach(fn => fn()); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, drag3Items, drag3Placed]);

  // Web drag & drop — Módulo 12 (LLM)
  useEffect(() => {
    if (Platform.OS !== 'web' || step !== 12) return;
    const cleanups: (() => void)[] = [];
    const setup = () => {
      llmItems.forEach((_, idx) => {
        if (llmPlacedRef.current[idx] !== undefined) return;
        const el = document.getElementById(`llm-chip-${idx}`);
        if (!el) return;
        el.setAttribute('draggable', 'true');
        (el as HTMLElement).style.cursor = 'grab';
        const onDragStart = (e: DragEvent) => {
          llmIdxRef.current = idx;
          setLlmSel(null);
          if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
        };
        const onDragEnd = () => { llmIdxRef.current = null; setDragOverLLMZone(null); };
        el.addEventListener('dragstart', onDragStart);
        el.addEventListener('dragend', onDragEnd);
        cleanups.push(() => { el.removeEventListener('dragstart', onDragStart); el.removeEventListener('dragend', onDragEnd); });
      });
      (['claude', 'chatgpt', 'gemini'] as const).forEach(zone => {
        const el = document.getElementById(`llm-zone-${zone}`);
        if (!el) return;
        const onDragOver = (e: Event) => { e.preventDefault(); setDragOverLLMZone(zone); };
        const onDragLeave = (e: DragEvent) => { if (!el.contains(e.relatedTarget as Node)) setDragOverLLMZone(null); };
        const onDrop = (e: Event) => {
          e.preventDefault(); setDragOverLLMZone(null);
          const idx = llmIdxRef.current;
          if (idx === null || llmPlacedRef.current[idx] !== undefined) return;
          const item = llmItems[idx];
          if (item.correct === zone) { setLlmPlaced(prev => ({ ...prev, [idx]: zone })); setStepResult(null); }
          else showResult(false, `"${item.text}" no corresponde a este LLM.`);
          llmIdxRef.current = null;
        };
        el.addEventListener('dragover', onDragOver);
        el.addEventListener('dragleave', onDragLeave);
        el.addEventListener('drop', onDrop);
        cleanups.push(() => { el.removeEventListener('dragover', onDragOver); el.removeEventListener('dragleave', onDragLeave); el.removeEventListener('drop', onDrop); });
      });
    };
    const timer = setTimeout(setup, 50);
    return () => { clearTimeout(timer); cleanups.forEach(fn => fn()); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, llmItems, llmPlaced]);

  const [xpToast, setXpToast] = useState<{ amount: number; id: number } | null>(null);
  const addXP = (amount: number) => {
    setXp(prev => prev + amount);
    if (amount > 0) setXpToast(prev => ({ amount, id: (prev?.id ?? 0) + 1 }));
  };

  const goToNextStep = () => {
    setStepResult(null);
    if (step < TOTAL_STEPS - 1) setStep(step + 1);
  };

  const showResult = (ok: boolean, msg: string) => setStepResult({ ok, msg });

  const handleClose = () => {
    if (Platform.OS === 'web') {
      const msg = isExamMode
        ? 'Estás en medio del examen. Si sales, perderás el progreso. ¿Seguro?'
        : '¿Seguro que quieres salir del nivel? Perderás el progreso no guardado.';
      if (window.confirm(msg)) router.back();
      return;
    }
    if (isExamMode) {
      Alert.alert('Examen en curso', 'Estás en medio del examen. Si sales, perderás todo el progreso de este nivel. ¿Seguro que quieres salir?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Salir', style: 'destructive', onPress: () => navigation.goBack() },
      ]);
    } else {
      Alert.alert('Salir', '¿Seguro que quieres salir del juego? Perderás el progreso no guardado.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Salir', onPress: () => navigation.goBack() },
      ]);
    }
  };

  const handleFinish = () => {
    let stars = 0;
    if (xp >= 100) stars = 3;
    else if (xp >= 70) stars = 2;
    else if (xp >= 40) stars = 1;
    completeLevel(2, stars, xp);
    router.replace('/level/3');
  };

  // ---------- Drag 3 ----------
  const handleChipPress3 = (idx: number) => {
    if (drag3Placed[idx] !== undefined) return;
    setDrag3Sel(drag3Sel === idx ? null : idx);
  };
  const handleDropZone3 = (zone: string) => {
    if (drag3Sel === null) return;
    if (drag3Placed[drag3Sel] !== undefined) return;
    const item = drag3Items[drag3Sel];
    if (item.correct === zone) {
      setDrag3Placed(prev => ({ ...prev, [drag3Sel!]: zone }));
      setDrag3Sel(null);
      setStepResult(null);
    } else {
      showResult(false, `"${item.text}" no pertenece a esta categoría.`);
    }
  };
  const handleRemoveChip3 = (idx: number) => {
    setDrag3Placed(prev => { const n = { ...prev }; delete n[idx]; return n; });
  };
  const checkDrag3 = () => {
    if (devMode) { setDrag3Ok(true); addXP(20); return true; }
    if (drag3Ok) return true;
    const placedCount = Object.keys(drag3Placed).length;
    if (placedCount < drag3Items.length) {
      showResult(false, `Faltan ${drag3Items.length - placedCount} chips. Clasifica todos.`);
      return false;
    }
    setDrag3Attempts(prev => prev + 1);
    let correct = 0;
    const wrongIndices: number[] = [];
    Object.keys(drag3Placed).forEach(k => {
      const i = parseInt(k);
      if (drag3Placed[i] === drag3Items[i].correct) correct++;
      else wrongIndices.push(i);
    });
    if (correct === drag3Items.length) {
      setDrag3Ok(true);
      const earned = drag3Attempts === 0 ? 20 : 12;
      addXP(earned);
      showResult(true, `¡Perfecto! Clasificaste todos correctamente. +${earned} XP`);
      return false;
    } else {
      showResult(false, `${correct} de ${drag3Items.length} correctas. Las incorrectas vuelven al banco.`);
      const newPlaced = { ...drag3Placed };
      wrongIndices.forEach(i => delete newPlaced[i]);
      setDrag3Placed(newPlaced);
      return false;
    }
  };

  // ---------- LLM Drag ----------
  const handleChipPressLLM = (idx: number) => {
    if (llmPlaced[idx] !== undefined) return;
    setLlmSel(llmSel === idx ? null : idx);
  };
  const handleDropZoneLLM = (zone: string) => {
    if (llmSel === null) return;
    if (llmPlaced[llmSel] !== undefined) return;
    const item = llmItems[llmSel];
    if (item.correct === zone) {
      setLlmPlaced(prev => ({ ...prev, [llmSel!]: zone }));
      setLlmSel(null);
      setStepResult(null);
    } else {
      showResult(false, `"${item.text}" no corresponde a este LLM.`);
    }
  };
  const handleRemoveChipLLM = (idx: number) => {
    setLlmPlaced(prev => { const n = { ...prev }; delete n[idx]; return n; });
  };
  const checkLLMDrag = () => {
    if (devMode) { setLlmOk(true); addXP(20); return true; }
    if (llmOk) return true;
    const placedCount = Object.keys(llmPlaced).length;
    if (placedCount < llmItems.length) {
      showResult(false, `Faltan ${llmItems.length - placedCount} tareas. Asígnalas todas.`);
      return false;
    }
    setLlmAttempts(prev => prev + 1);
    let correct = 0;
    const wrongIndices: number[] = [];
    Object.keys(llmPlaced).forEach(k => {
      const i = parseInt(k);
      if (llmPlaced[i] === llmItems[i].correct) correct++;
      else wrongIndices.push(i);
    });
    if (correct === llmItems.length) {
      setLlmOk(true);
      const earned = llmAttempts === 0 ? 20 : 12;
      addXP(earned);
      showResult(true, `¡Perfecto! Asignaste todas las tareas correctamente. +${earned} XP`);
      return false;
    } else {
      showResult(false, `${correct} de ${llmItems.length} correctas. Las incorrectas vuelven al banco.`);
      const newPlaced = { ...llmPlaced };
      wrongIndices.forEach(i => delete newPlaced[i]);
      setLlmPlaced(newPlaced);
      return false;
    }
  };

  // ---------- Matching ----------
  const handleLeftClick = (idx: number) => {
    if (matchedLeft.has(idx)) return;
    setStepResult(null);
    setMatchLeft(idx);
  };
  const handleRightClick = (rightIdx: number) => {
    if (matchLeft === null) return;
    if (matchedRight.has(rightIdx)) return;
    const correctRightText = matchPairs[matchLeft].right;
    const selectedRightText = rightOrder[rightIdx];
    if (selectedRightText === correctRightText) {
      setMatchedLeft(prev => new Set(prev).add(matchLeft!));
      setMatchedRight(prev => new Set(prev).add(rightIdx));
      setMatchLeft(null);
      const newCount = matchedLeft.size + 1;
      setMatchDone(newCount);
      if (newCount === matchPairs.length) {
        addXP(15);
        showResult(true, '¡Completado! Conectaste todos los pares. +15 XP');
      }
    } else {
      showResult(false, 'Ese par no es correcto. Intenta de nuevo.');
      setMatchLeft(null);
    }
  };

  // ---------- Sort ----------
  const moveSort = (pos: number, dir: number) => {
    const newPos = pos + dir;
    if (newPos < 0 || newPos >= sortOrder.length) return;
    const newOrder = [...sortOrder];
    [newOrder[pos], newOrder[newPos]] = [newOrder[newPos], newOrder[pos]];
    setSortOrder(newOrder);
  };
  const checkSort = () => {
    if (devMode) { setSortOk(true); addXP(15); return true; }
    if (sortOk) return true;
    const isOk = sortOrder.every((v, i) => v === i);
    if (isOk) {
      setSortOk(true);
      addXP(15);
      showResult(true, '¡Exacto! Ese es el orden real de procesamiento de un LLM. +15 XP');
      return false;
    } else {
      showResult(false, 'Algunos pasos están fuera de lugar. ¡Piensa en el orden lógico!');
      return false;
    }
  };

  // ---------- Quiz ----------
  const selectQuiz = (qIdx: number, optIdx: number) => {
    if (quizChecked) return;
    setQuizAnswers(prev => ({ ...prev, [qIdx]: optIdx }));
  };
  const checkQuiz = () => {
    if (devMode) { setQuizChecked(true); addXP(32); return true; }
    if (quizChecked) return true;
    if (Object.keys(quizAnswers).length < quizQuestions.length) {
      showResult(false, 'Incompleto. Responde todas las preguntas primero.');
      return false;
    }
    setQuizChecked(true);
    let correct = 0;
    quizQuestions.forEach((q, idx) => { if (quizAnswers[idx] === q.correct) correct++; });
    const earned = correct * 8;
    if (earned > 0) addXP(earned);
    showResult(true, `Resultado: ${correct} de ${quizQuestions.length} correctas. +${earned} XP`);
    return false;
  };

  // ---------- TF ----------
  const selectTF = (qIdx: number, val: boolean) => {
    if (tfChecked) return;
    setTfAnswers(prev => ({ ...prev, [qIdx]: val }));
  };
  const checkTF = () => {
    if (devMode) { setTfChecked(true); addXP(25); return true; }
    if (tfChecked) return true;
    if (Object.keys(tfAnswers).length < tfItems.length) {
      showResult(false, 'Incompleto. Responde todas las afirmaciones.');
      return false;
    }
    setTfChecked(true);
    let correct = 0;
    tfItems.forEach((item, idx) => { if (tfAnswers[idx] === item.correct) correct++; });
    const earned = correct * 5;
    if (earned > 0) addXP(earned);
    showResult(true, `Resultado: ${correct} de ${tfItems.length} correctas. +${earned} XP`);
    return false;
  };

  // ---------- Fill ----------
  const selectFill = (idx: number) => {
    if (fillChecked) return;
    setFillSel(idx);
  };
  const checkFill = () => {
    if (devMode) { setFillChecked(true); addXP(15); return true; }
    if (fillChecked) return true;
    if (fillSel === null) { showResult(false, 'Selecciona la palabra correcta.'); return false; }
    setFillChecked(true);
    const isOk = fillSel === fillItem.correct;
    if (isOk) {
      addXP(10);
      showResult(true, `¡Correcto! +10 XP. ${fillItem.explain}`);
    } else {
      showResult(false, `Incorrecto. La respuesta correcta es "${fillItem.allOpts[fillItem.correct]}". ${fillItem.explain}`);
    }
    return false;
  };

  // ---------- Prompt compare ----------
  const selectPrompt = (qIdx: number, which: 'good' | 'bad') => {
    if (promptsChecked) return;
    setPromptSels(prev => ({ ...prev, [qIdx]: which }));
  };
  const checkPrompts = () => {
    if (devMode) { setPromptsChecked(true); addXP(20); return true; }
    if (promptsChecked) return true;
    if (Object.keys(promptSels).length < promptItems.length) {
      showResult(false, 'Incompleto. Elige un prompt en cada situación.');
      return false;
    }
    setPromptsChecked(true);
    let correct = 0;
    promptItems.forEach((_, idx) => { if (promptSels[idx] === 'good') correct++; });
    const earned = correct * 8;
    if (earned > 0) addXP(earned);
    showResult(true, `Resultado: ${correct} de ${promptItems.length} correctas. +${earned} XP`);
    return false;
  };

  // ---------- Reflect ----------
  const checkReflect = () => {
    if (devMode) { addXP(15); goToNextStep(); return; }
    if (reflectText.trim().length >= 70) { addXP(15); goToNextStep(); }
    else showResult(false, 'Muy corto. Escribe al menos 70 caracteres.');
  };

  // ========== RENDER ==========

  const renderIntro = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.tag, styles.tagIntro]}>Nivel 2 · 15 módulos</Text>
      <View style={styles.iconContainer}><Text style={styles.iconEmoji}>📱</Text></View>
      <Text style={styles.title}>La IA que vive en tus apps</Text>
      <Text style={styles.subtitle}>Usas decenas de apps todos los días. Pero, ¿sabías que la IA está operando en todas ellas? Hoy vas a diseccionarlas, entender cómo funcionan por dentro, y conocer las herramientas de IA que van a cambiar la manera en que estudias y creas.</Text>
      <View style={[styles.card, styles.cardSky]}>
        <View style={styles.cardRow}>
          <View style={[styles.cardIcon, { backgroundColor: '#bae6fd' }]}><Text style={styles.cardIconText}>📚</Text></View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Qué vas a aprender</Text>
            <Text style={styles.cardText}>Cómo decide la IA qué mostrarte · 4 tipos de IA que ya usas · Qué son los LLMs y cómo funcionan · ChatGPT, Claude, Gemini y Grok comparados · Cuándo usar un LLM vs Google · Cómo escribir un buen prompt</Text>
          </View>
        </View>
      </View>
      <View style={[styles.card, styles.cardGreen]}>
        <View style={styles.cardRow}>
          <View style={[styles.cardIcon, { backgroundColor: '#bbf7d0' }]}><Text style={styles.cardIconText}>⚡</Text></View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Lo nuevo en este nivel</Text>
            <Text style={styles.cardText}>Tienes tu <Text style={styles.bold}>primer contacto real con los LLMs</Text> como herramientas de estudio. Al terminar sabrás cuándo y cómo usarlos correctamente — sin depender de ellos ciegamente.</Text>
          </View>
        </View>
      </View>
      <View style={[styles.card, styles.cardAmber]}>
        <View style={styles.cardRow}>
          <View style={[styles.cardIcon, { backgroundColor: '#fde68a' }]}><Text style={styles.cardIconText}>🎮</Text></View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>15 módulos · hasta 160 XP</Text>
            <Text style={styles.cardText}>Teoría · Apps reales · Caso de vida real · Clasificar · Conectar · Quiz · Ordenar · V/F · Qué LLM usar · Vocabulario clave · Comparar prompts · Reflexión</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderTheory1 = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.tag, styles.tagTheory]}>📖 Módulo 1 de 15 · Teoría</Text>
      <Text style={styles.title}>¿Cómo decide la IA qué mostrarte?</Text>
      <Text style={styles.bodyText}>Abres Instagram. En milisegundos ves una publicación que te engancha al instante. No fue casualidad, ni suerte, ni un humano eligiéndola para ti. <Text style={styles.bold}>Una IA tomó esa decisión en menos de 100 milisegundos</Text>, basándose en miles de datos que tiene sobre ti.</Text>
      <View style={styles.highlightBox}>
        <Text style={styles.highlightText}><Text style={styles.bold}>❌ El mito más común:</Text> "Las redes sociales me muestran lo que está de moda." — Falso. Te muestran lo que la IA calcula que <Text style={styles.italic}>a ti específicamente</Text> te va a enganchar más tiempo. El algoritmo no busca lo mejor — busca lo más adictivo para ti.</Text>
      </View>
      <Text style={styles.sectionTitle}>¿Qué datos usa la IA para decidir?</Text>
      <View style={[styles.card, styles.cardSky]}>
        <View style={styles.cardRow}>
          <View style={[styles.cardIcon, { backgroundColor: '#bae6fd' }]}><Text style={styles.cardIconText}>👁️</Text></View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Datos de comportamiento</Text>
            <Text style={styles.cardText}>Cuántos segundos exactos viste algo, si lo repetiste, si pausaste, a qué hora del día lo hiciste, si compartiste o solo cerraste.</Text>
          </View>
        </View>
      </View>
      <View style={[styles.card, styles.cardGreen]}>
        <View style={styles.cardRow}>
          <View style={[styles.cardIcon, { backgroundColor: '#bbf7d0' }]}><Text style={styles.cardIconText}>👥</Text></View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Datos de personas similares a ti</Text>
            <Text style={styles.cardText}>La IA encontró millones de usuarios con patrones parecidos a los tuyos. Lo que a ellos les gustó... probablemente te va a gustar a ti también.</Text>
          </View>
        </View>
      </View>
      <View style={[styles.card, styles.cardAmber]}>
        <View style={styles.cardRow}>
          <View style={[styles.cardIcon, { backgroundColor: '#fde68a' }]}><Text style={styles.cardIconText}>📍</Text></View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Datos de contexto</Text>
            <Text style={styles.cardText}>Tu ubicación, qué dispositivo usas, qué hora es, si estás en WiFi o datos móviles. El mismo usuario recibe contenido diferente a las 7am que a las 11pm.</Text>
          </View>
        </View>
      </View>
      <Text style={styles.sectionTitle}>El problema de la "burbuja de filtro"</Text>
      <Text style={styles.bodyText}>Cuando la IA solo te muestra contenido que le "gustó" a tu versión pasada, crea una burbuja. Ves las mismas ideas, las mismas personas, los mismos puntos de vista. El mundo parece más simple de lo que es. <Text style={styles.bold}>Saber esto te da poder para salir de la burbuja</Text> — busca activamente perspectivas diferentes.</Text>
      <View style={styles.highlightBoxGreen}>
        <Text style={styles.highlightTextGreen}><Text style={styles.bold}>✅ Clave de este módulo:</Text> La IA de las apps no busca lo mejor para ti — busca lo que te mantiene más tiempo en la pantalla. Son objetivos muy diferentes. Entender esto cambia cómo usas las redes.</Text>
      </View>
    </View>
  );

  const renderExamples = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.tag, styles.tagExample]}>📱 Módulo 2 de 15 · Apps reales</Text>
      <Text style={styles.title}>Disecciona 5 apps que ya conoces</Text>
      <Text style={styles.subtitle}>Abre cada tarjeta y descubre qué tipo de IA está corriendo en las apps que más usas.</Text>

      {/* Instagram */}
      <TouchableOpacity style={styles.exCard} onPress={() => setOpenAppCard(openAppCard === 0 ? null : 0)} activeOpacity={0.8}>
        <View style={styles.exHead}>
          <View style={styles.exEmoji}><Text style={styles.exEmojiText}>📸</Text></View>
          <View style={styles.exInfo}>
            <Text style={styles.exName}>Instagram</Text>
            <Text style={styles.exSub}>Reels, Explorar y Feed personalizados</Text>
          </View>
          <Text style={styles.exArr}>{openAppCard === 0 ? '↓' : '›'}</Text>
        </View>
        {openAppCard === 0 && (
          <View style={styles.exBody}>
            <Text style={[styles.exTag, { backgroundColor: '#fce7f3', color: '#9d174d' }]}>IA de Recomendación</Text>
            <Text style={styles.exHow}>El feed de Instagram es completamente diferente para cada persona. <Text style={styles.bold}>La IA analiza con quién interactúas, cuánto tiempo ves cada historia, qué tipo de Reels repites</Text> y qué cuentas visitas aunque no las sigas.{'\n\n'}La función de "Explorar" usa una IA que encontró personas con gustos similares a los tuyos y recomienda lo que a ellas les gustó recientemente.</Text>
            <View style={styles.exFact}><Text style={styles.exFactText}>⭐ Meta (dueño de Instagram) tiene más de <Text style={styles.bold}>3,000 millones de usuarios</Text> generando datos cada segundo. Es uno de los conjuntos de datos de comportamiento humano más grandes de la historia.</Text></View>
          </View>
        )}
      </TouchableOpacity>

      {/* YouTube */}
      <TouchableOpacity style={styles.exCard} onPress={() => setOpenAppCard(openAppCard === 1 ? null : 1)} activeOpacity={0.8}>
        <View style={styles.exHead}>
          <View style={styles.exEmoji}><Text style={styles.exEmojiText}>▶️</Text></View>
          <View style={styles.exInfo}>
            <Text style={styles.exName}>YouTube</Text>
            <Text style={styles.exSub}>Recomendaciones que te conocen mejor que tú</Text>
          </View>
          <Text style={styles.exArr}>{openAppCard === 1 ? '↓' : '›'}</Text>
        </View>
        {openAppCard === 1 && (
          <View style={styles.exBody}>
            <Text style={[styles.exTag, { backgroundColor: '#fff1f2', color: '#9f1239' }]}>IA de Recomendación</Text>
            <Text style={styles.exHow}>YouTube mide el <Text style={styles.bold}>Watch Time</Text> (tiempo de visualización) como señal principal. Si la gente abandona un video en el minuto 2, la IA lo recomienda menos. Si lo termina y busca más del mismo canal, lo recomienda agresivamente.{'\n\n'}El 70% de todo lo que se ve en YouTube viene de las recomendaciones de la IA — no de búsquedas.</Text>
            <View style={styles.exFact}><Text style={styles.exFactText}>⭐ YouTube tiene más de <Text style={styles.bold}>500 horas de video nuevas subidas cada minuto</Text>. Sin IA sería imposible conectar al usuario correcto con el contenido correcto.</Text></View>
          </View>
        )}
      </TouchableOpacity>

      {/* WhatsApp */}
      <TouchableOpacity style={styles.exCard} onPress={() => setOpenAppCard(openAppCard === 2 ? null : 2)} activeOpacity={0.8}>
        <View style={styles.exHead}>
          <View style={styles.exEmoji}><Text style={styles.exEmojiText}>💬</Text></View>
          <View style={styles.exInfo}>
            <Text style={styles.exName}>WhatsApp</Text>
            <Text style={styles.exSub}>Más IA de la que imaginas en el mensajero</Text>
          </View>
          <Text style={styles.exArr}>{openAppCard === 2 ? '↓' : '›'}</Text>
        </View>
        {openAppCard === 2 && (
          <View style={styles.exBody}>
            <Text style={[styles.exTag, { backgroundColor: '#f0fdf4', color: '#166534' }]}>IA de Lenguaje y Visión</Text>
            <Text style={styles.exHow}>WhatsApp usa IA en múltiples lugares: <Text style={styles.bold}>las respuestas rápidas sugeridas</Text> (esas opciones que aparecen sin que escribas nada), la <Text style={styles.bold}>transcripción automática de mensajes de voz</Text>, la detección de contenido spam o dañino antes de que llegue a ti, y el reconocimiento de objetos cuando usas la cámara integrada.</Text>
            <View style={styles.exFact}><Text style={styles.exFactText}>⭐ WhatsApp procesa más de <Text style={styles.bold}>100,000 millones de mensajes al día</Text>. Sus sistemas de detección de spam e información falsa usan IA para analizar patrones sin leer el contenido (está encriptado).</Text></View>
          </View>
        )}
      </TouchableOpacity>

      {/* Google Fotos */}
      <TouchableOpacity style={styles.exCard} onPress={() => setOpenAppCard(openAppCard === 3 ? null : 3)} activeOpacity={0.8}>
        <View style={styles.exHead}>
          <View style={styles.exEmoji}><Text style={styles.exEmojiText}>🖼️</Text></View>
          <View style={styles.exInfo}>
            <Text style={styles.exName}>Google Fotos</Text>
            <Text style={styles.exSub}>Tu álbum que entiende lo que hay dentro</Text>
          </View>
          <Text style={styles.exArr}>{openAppCard === 3 ? '↓' : '›'}</Text>
        </View>
        {openAppCard === 3 && (
          <View style={styles.exBody}>
            <Text style={[styles.exTag, { backgroundColor: '#e0f2fe', color: '#0369a1' }]}>IA de Visión por Computadora</Text>
            <Text style={styles.exHow}>Google Fotos puede encontrar "fotos con mi perro labrador en la playa" sin que hayas etiquetado nada. <Text style={styles.bold}>Una IA analizó cada foto que subiste: reconoció personas, animales, objetos, lugares y hasta emociones</Text> en las caras.{'\n\n'}También agrupa automáticamente fotos del mismo evento y crea álbumes sin que pidas nada.</Text>
            <View style={styles.exFact}><Text style={styles.exFactText}>⭐ La IA de Google Fotos identifica más de <Text style={styles.bold}>10,000 categorías de objetos</Text> en las imágenes. Puedes escribir "cumpleaños 2022" o "montañas con nieve" y te muestra las fotos exactas.</Text></View>
          </View>
        )}
      </TouchableOpacity>

      {/* Netflix */}
      <TouchableOpacity style={styles.exCard} onPress={() => setOpenAppCard(openAppCard === 4 ? null : 4)} activeOpacity={0.8}>
        <View style={styles.exHead}>
          <View style={styles.exEmoji}><Text style={styles.exEmojiText}>🎬</Text></View>
          <View style={styles.exInfo}>
            <Text style={styles.exName}>Netflix</Text>
            <Text style={styles.exSub}>El algoritmo que decide qué buscas el viernes</Text>
          </View>
          <Text style={styles.exArr}>{openAppCard === 4 ? '↓' : '›'}</Text>
        </View>
        {openAppCard === 4 && (
          <View style={styles.exBody}>
            <Text style={[styles.exTag, { backgroundColor: '#faf5ff', color: '#5b21b6' }]}>IA de Recomendación + Visión</Text>
            <Text style={styles.exHow}>Netflix no solo recomienda series — <Text style={styles.bold}>la IA elige qué miniatura de portada mostrarte según tu historial</Text>. La misma serie puede tener 10-30 miniaturas diferentes, y verás la que la IA calculó que más te va a llamar la atención a ti específicamente.{'\n\n'}También detecta en qué segundo del primer episodio la mayoría de personas decide si seguir o cerrar la serie.</Text>
            <View style={styles.exFact}><Text style={styles.exFactText}>⭐ Netflix gasta más de <Text style={styles.bold}>1,000 millones de dólares al año</Text> en sus sistemas de recomendación. Estiman que sin IA perderían más de 1,000 millones en suscripciones canceladas por personas que no encontraron qué ver.</Text></View>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderDrag3 = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.tag, styles.tagActivity]}>🧩 Módulo 3 de 15 · Clasificar</Text>
      <Text style={styles.title}>¿Qué tipo de IA es esta?</Text>
      <Text style={styles.subtitle}>Clasifica cada función en su tipo de IA correcto. Toca un chip y luego la columna.</Text>
      <View style={styles.hintCard}>
        <Text style={styles.hintCardText}>🟢 <Text style={styles.bold}>Recom.</Text> — recomienda contenido · 🟣 <Text style={styles.bold}>Visión</Text> — analiza imágenes · 🔵 <Text style={styles.bold}>Lenguaje</Text> — procesa texto · 🟡 <Text style={styles.bold}>Generativa</Text> — crea contenido nuevo</Text>
      </View>
      <View style={styles.chipsPool}>
        {drag3Items.map((item, idx) => {
          if (drag3Placed[idx] !== undefined) return null;
          return (
            <TouchableOpacity key={idx} nativeID={`drag3-chip-${idx}`} style={[styles.chip, drag3Sel === idx && styles.chipSelected]} onPress={() => handleChipPress3(idx)}>
              <Text style={styles.chipText}>{item.text}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.dropCols}>
        <View style={{ flex: 1, minWidth: '45%' }}>
          <View style={[styles.llmDropHeaderBox, { backgroundColor: '#dcfce7' }]}>
            <Text style={[styles.llmDropHeaderText, { color: '#166534' }]}>🟢 Recomendación</Text>
          </View>
          <TouchableOpacity nativeID="drop3-zone-rec" style={[styles.dropCol, { backgroundColor: dragOver3Zone === 'rec' ? '#e0f2fe' : '#fafafa', borderColor: dragOver3Zone === 'rec' ? '#0ea5e9' : colors.borderLight }]} onPress={() => handleDropZone3('rec')}>
            <View style={styles.dropChips}>
              {Object.entries(drag3Placed).map(([idx, zone]) => zone === 'rec' ? (
                <TouchableOpacity key={idx} style={[styles.dropChip, { backgroundColor: '#dcfce7' }]} onPress={() => handleRemoveChip3(parseInt(idx))}>
                  <Text style={[styles.dropChipText, { color: '#166534' }]}>{drag3Items[parseInt(idx)].text} ✕</Text>
                </TouchableOpacity>
              ) : null)}
            </View>
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, minWidth: '45%' }}>
          <View style={[styles.llmDropHeaderBox, { backgroundColor: '#ede9fe' }]}>
            <Text style={[styles.llmDropHeaderText, { color: '#5b21b6' }]}>🟣 Visión</Text>
          </View>
          <TouchableOpacity nativeID="drop3-zone-vis" style={[styles.dropCol, { backgroundColor: dragOver3Zone === 'vis' ? '#f5f3ff' : '#fafafa', borderColor: dragOver3Zone === 'vis' ? '#8b5cf6' : colors.borderLight }]} onPress={() => handleDropZone3('vis')}>
            <View style={styles.dropChips}>
              {Object.entries(drag3Placed).map(([idx, zone]) => zone === 'vis' ? (
                <TouchableOpacity key={idx} style={[styles.dropChip, { backgroundColor: '#ede9fe' }]} onPress={() => handleRemoveChip3(parseInt(idx))}>
                  <Text style={[styles.dropChipText, { color: '#5b21b6' }]}>{drag3Items[parseInt(idx)].text} ✕</Text>
                </TouchableOpacity>
              ) : null)}
            </View>
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, minWidth: '45%' }}>
          <View style={[styles.llmDropHeaderBox, { backgroundColor: '#dbeafe' }]}>
            <Text style={[styles.llmDropHeaderText, { color: '#1e40af' }]}>🔵 Lenguaje</Text>
          </View>
          <TouchableOpacity nativeID="drop3-zone-nlp" style={[styles.dropCol, { backgroundColor: dragOver3Zone === 'nlp' ? '#eff6ff' : '#fafafa', borderColor: dragOver3Zone === 'nlp' ? '#3b82f6' : colors.borderLight }]} onPress={() => handleDropZone3('nlp')}>
            <View style={styles.dropChips}>
              {Object.entries(drag3Placed).map(([idx, zone]) => zone === 'nlp' ? (
                <TouchableOpacity key={idx} style={[styles.dropChip, { backgroundColor: '#dbeafe' }]} onPress={() => handleRemoveChip3(parseInt(idx))}>
                  <Text style={[styles.dropChipText, { color: '#1e40af' }]}>{drag3Items[parseInt(idx)].text} ✕</Text>
                </TouchableOpacity>
              ) : null)}
            </View>
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, minWidth: '45%' }}>
          <View style={[styles.llmDropHeaderBox, { backgroundColor: '#fef3c7' }]}>
            <Text style={[styles.llmDropHeaderText, { color: '#92400e' }]}>🟡 Generativa</Text>
          </View>
          <TouchableOpacity nativeID="drop3-zone-gen" style={[styles.dropCol, { backgroundColor: dragOver3Zone === 'gen' ? '#fffbeb' : '#fafafa', borderColor: dragOver3Zone === 'gen' ? '#f59e0b' : colors.borderLight }]} onPress={() => handleDropZone3('gen')}>
            <View style={styles.dropChips}>
              {Object.entries(drag3Placed).map(([idx, zone]) => zone === 'gen' ? (
                <TouchableOpacity key={idx} style={[styles.dropChip, { backgroundColor: '#fef3c7' }]} onPress={() => handleRemoveChip3(parseInt(idx))}>
                  <Text style={[styles.dropChipText, { color: '#92400e' }]}>{drag3Items[parseInt(idx)].text} ✕</Text>
                </TouchableOpacity>
              ) : null)}
            </View>
          </TouchableOpacity>
        </View>
      </View>
      <TouchableOpacity style={[styles.checkButton, drag3Ok && { backgroundColor: '#0ea5e9' }]} onPress={drag3Ok ? goToNextStep : checkDrag3}>
        <Text style={styles.checkButtonText}>{drag3Ok ? 'Continuar →' : 'Verificar clasificación'}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderTheory2 = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.tag, styles.tagTheory]}>📖 Módulo 4 de 15 · Tipos de IA</Text>
      <Text style={styles.title}>Los 4 tipos de IA que ya usas</Text>
      <Text style={styles.subtitle}>Ahora que los clasificaste, veamos cada tipo con más detalle.</Text>
      <View style={[styles.card, styles.cardGreen]}>
        <View style={styles.cardRow}>
          <View style={[styles.cardIcon, { backgroundColor: '#bbf7d0' }]}><Text style={{ fontSize: 22 }}>🟢</Text></View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>IA de Recomendación</Text>
            <Text style={styles.cardText}>Predice qué contenido, producto o persona te va a gustar. <Text style={styles.bold}>Apps:</Text> TikTok, YouTube, Spotify, Netflix, Amazon, Instagram. <Text style={styles.italic}>Técnica detrás:</Text> filtrado colaborativo — encuentra usuarios similares a ti y copia sus preferencias.</Text>
          </View>
        </View>
      </View>
      <View style={[styles.card, styles.cardPurple]}>
        <View style={styles.cardRow}>
          <View style={[styles.cardIcon, { backgroundColor: '#e9d5ff' }]}><Text style={{ fontSize: 22 }}>🟣</Text></View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>IA de Visión por Computadora</Text>
            <Text style={styles.cardText}>Analiza y entiende imágenes y video. <Text style={styles.bold}>Apps:</Text> Face ID, Google Fotos, modo retrato, Google Lens, filtros de Snapchat. <Text style={styles.italic}>Técnica detrás:</Text> redes neuronales que detectan bordes, formas y patrones en millones de píxeles.</Text>
          </View>
        </View>
      </View>
      <View style={[styles.card, styles.cardSky]}>
        <View style={styles.cardRow}>
          <View style={[styles.cardIcon, { backgroundColor: '#bae6fd' }]}><Text style={{ fontSize: 22 }}>🔵</Text></View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>IA de Procesamiento de Lenguaje (NLP)</Text>
            <Text style={styles.cardText}>Lee, entiende y genera texto. <Text style={styles.bold}>Apps:</Text> ChatGPT, Claude, Google Translate, autocorrector, Siri, Alexa. <Text style={styles.italic}>Técnica detrás:</Text> Modelos de Lenguaje (LLMs) que predicen qué texto es más probable según el contexto.</Text>
          </View>
        </View>
      </View>
      <View style={[styles.card, styles.cardAmber]}>
        <View style={styles.cardRow}>
          <View style={[styles.cardIcon, { backgroundColor: '#fde68a' }]}><Text style={{ fontSize: 22 }}>🟡</Text></View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>IA Generativa (GenAI)</Text>
            <Text style={styles.cardText}>Crea contenido nuevo: texto, imágenes, música, video, código. <Text style={styles.bold}>Apps:</Text> ChatGPT, Claude, Gemini, DALL·E, Midjourney, Suno, ElevenLabs. <Text style={styles.italic}>Técnica detrás:</Text> modelos que aprendieron los patrones de millones de creaciones humanas y los combinan de formas nuevas.</Text>
          </View>
        </View>
      </View>
      <View style={styles.highlightBoxBlue}>
        <Text style={styles.highlightTextBlue}><Text style={styles.bold}>💡 Muchas apps usan varios tipos a la vez:</Text> TikTok usa recomendación + visión (analiza el video) + lenguaje (lee los captions). Los tipos de IA no son mutuamente excluyentes — las apps más poderosas combinan varios.</Text>
      </View>
    </View>
  );

  const renderMatching = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.tag, styles.tagMatch]}>🔗 Módulo 5 de 15 · Conectar</Text>
      <Text style={styles.title}>App + tipo de IA</Text>
      <Text style={styles.subtitle}>Conecta cada app con la descripción exacta de la IA que usa.</Text>
      <View style={[styles.card, styles.cardSky]}>
        <Text style={styles.cardText}>① Toca la tarjeta <Text style={styles.bold}>azul</Text> (izquierda) → ② Toca la <Text style={styles.bold}>verde</Text> (derecha) que la explica → Si conectas bien, ambas se vuelven ✅</Text>
      </View>
      <View style={styles.matchColLabels}>
        <Text style={styles.matchColLabel}>App</Text>
        <Text style={styles.matchColLabel}>¿Qué hace su IA?</Text>
      </View>
      <View style={styles.matchColumns}>
        <View style={styles.matchLeftColumn}>
          {matchPairs.map((pair, leftIdx) => (
            <TouchableOpacity
              key={leftIdx}
              style={[styles.matchLeftCard, matchLeft === leftIdx && styles.matchSelected, matchedLeft.has(leftIdx) && styles.matchMatched]}
              onPress={() => handleLeftClick(leftIdx)}
              disabled={matchedLeft.has(leftIdx)}
            >
              <Text style={[styles.matchText, { color: '#0369a1' }]}>{pair.left}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.matchRightColumn}>
          {rightOrder.map((rightText, rightIdx) => (
            <TouchableOpacity
              key={rightIdx}
              style={[styles.matchRightCard, matchedRight.has(rightIdx) && styles.matchMatched]}
              onPress={() => handleRightClick(rightIdx)}
              disabled={matchedRight.has(rightIdx)}
            >
              <Text style={[styles.matchText, { color: '#166534' }]}>{rightText}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {matchDone === matchPairs.length && (
        <TouchableOpacity style={[styles.checkButton, { backgroundColor: '#0ea5e9', marginTop: 12 }]} onPress={goToNextStep}>
          <Text style={styles.checkButtonText}>Continuar →</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderTheoryLLM = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.tag, styles.tagTheory]}>📖 Módulo 6 de 15 · LLMs</Text>
      <Text style={styles.title}>¿Qué son los Modelos de Lenguaje (LLMs)?</Text>
      <Text style={styles.bodyText}>LLM significa <Text style={styles.bold}>Large Language Model</Text> — Modelo de Lenguaje Grande. Son el tipo de IA detrás de ChatGPT, Claude, Gemini y Grok. Para entender qué son, primero hay que entender en qué se diferencian de Google.</Text>
      <View style={styles.vsGrid}>
        <View style={[styles.vsCol, { backgroundColor: '#fff7ed' }]}>
          <View style={{ backgroundColor: '#fed7aa', paddingVertical: 4, paddingHorizontal: 6, borderRadius: 7, marginBottom: 8, alignItems: 'center' }}>
            <Text style={[styles.vsHeader, { color: '#9a3412', marginBottom: 0 }]}>🔍 Google Search</Text>
          </View>
          <Text style={styles.vsItem}>Busca páginas que ya existen</Text>
          <Text style={styles.vsItem}>Devuelve links, tú lees</Text>
          <Text style={styles.vsItem}>Información en tiempo real</Text>
          <Text style={styles.vsItem}>No crea nada nuevo</Text>
          <Text style={styles.vsItem}>Ideal para: datos actuales, noticias, precios</Text>
        </View>
        <View style={[styles.vsCol, { backgroundColor: '#f0f9ff' }]}>
          <View style={{ backgroundColor: '#bae6fd', paddingVertical: 4, paddingHorizontal: 6, borderRadius: 7, marginBottom: 8, alignItems: 'center' }}>
            <Text style={[styles.vsHeader, { color: '#0369a1', marginBottom: 0 }]}>🤖 LLM (ChatGPT, Claude...)</Text>
          </View>
          <Text style={styles.vsItem}>Genera texto nuevo en respuesta</Text>
          <Text style={styles.vsItem}>Conversa contigo directamente</Text>
          <Text style={styles.vsItem}>Conocimiento hasta cierta fecha</Text>
          <Text style={styles.vsItem}>Crea, explica, analiza, resume</Text>
          <Text style={styles.vsItem}>Ideal para: aprender, escribir, analizar</Text>
        </View>
      </View>
      <View style={styles.highlightBox}>
        <Text style={styles.highlightText}><Text style={styles.bold}>⚠️ El error más peligroso:</Text> Usar un LLM para buscar datos en tiempo real (precios, noticias, resultados deportivos). Los LLMs no acceden a internet — su conocimiento viene de lo que aprendieron hasta cierta fecha. Para datos actuales: usa Google.</Text>
      </View>
      <Text style={styles.sectionTitle}>¿Cómo funciona un LLM por dentro?</Text>
      <Text style={styles.bodyText}>Un LLM leyó billones de textos durante su entrenamiento: libros, artículos, código, conversaciones. Aprendió a predecir qué palabra o frase es más probable que siga dado un contexto. Cuando le escribes, no "piensa" — <Text style={styles.bold}>calcula probabilidades a velocidad masiva</Text>.</Text>
      <View style={styles.highlightBoxAmber}>
        <Text style={styles.highlightTextAmber}><Text style={styles.bold}>🎯 La regla de oro para usar LLMs:</Text> Son brillantes para <Text style={styles.italic}>crear, explicar, analizar y transformar</Text> información. Son poco confiables para <Text style={styles.italic}>datos específicos, fechas exactas y hechos que pueden verificarse</Text>. Siempre verifica los datos importantes con fuentes primarias.</Text>
      </View>
    </View>
  );

  const renderCase = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.tag, styles.tagCase]}>🎯 Módulo 7 de 15 · Caso real</Text>
      <Text style={styles.title}>Sebastián: estudiante de 15 años en Medellín</Text>
      <Text style={styles.subtitle}>Así es como un estudiante usa los LLMs en su vida real — los buenos y los malos usos.</Text>
      <View style={styles.scenarioBox}>
        <Text style={styles.scenarioLabel}>🎬 LA SITUACIÓN</Text>
        <Text style={styles.scenarioText}>Sebastián tiene un trabajo para ciencias sociales sobre el cambio climático, un examen de álgebra en dos días, y quiere aprender inglés más rápido. Tiene acceso a ChatGPT, Claude y Gemini. ¿Cómo los usa — y cómo no debería usarlos?</Text>
      </View>
      <View style={[styles.card, styles.cardGreen]}>
        <View style={styles.cardRow}>
          <View style={[styles.cardIcon, { backgroundColor: '#bbf7d0' }]}><Text style={styles.cardIconText}>✅</Text></View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Uso correcto #1 — Entender, no copiar</Text>
            <Text style={styles.cardText}>Le pide a Claude: <Text style={styles.italic}>"Explícame las causas del cambio climático como si tuviera 15 años, con 3 ejemplos de Colombia específicamente."</Text> Toma notas y escribe el trabajo con sus propias palabras. <Text style={styles.bold}>El LLM fue su tutor, no su escritor.</Text></Text>
          </View>
        </View>
      </View>
      <View style={[styles.card, styles.cardGreen]}>
        <View style={styles.cardRow}>
          <View style={[styles.cardIcon, { backgroundColor: '#bbf7d0' }]}><Text style={styles.cardIconText}>✅</Text></View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Uso correcto #2 — Práctica personalizada</Text>
            <Text style={styles.cardText}>Le pide a ChatGPT: <Text style={styles.italic}>"Dame 10 ejercicios de ecuaciones cuadráticas de menor a mayor dificultad, y explícame paso a paso los que me cuesten más trabajo."</Text> <Text style={styles.bold}>El LLM fue su profesor particular gratuito disponible 24/7.</Text></Text>
          </View>
        </View>
      </View>
      <View style={[styles.card, styles.cardGreen]}>
        <View style={styles.cardRow}>
          <View style={[styles.cardIcon, { backgroundColor: '#bbf7d0' }]}><Text style={styles.cardIconText}>✅</Text></View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Uso correcto #3 — Práctica de idiomas</Text>
            <Text style={styles.cardText}>Conversa con ChatGPT en inglés sobre temas que le interesan (fútbol, música). Cuando comete un error, le pide que lo corrija y explique por qué. <Text style={styles.bold}>Un nativo de inglés disponible 24/7, gratis, infinitamente paciente.</Text></Text>
          </View>
        </View>
      </View>
      <View style={[styles.card, styles.cardRed]}>
        <View style={styles.cardRow}>
          <View style={[styles.cardIcon, { backgroundColor: '#fecdd3' }]}><Text style={styles.cardIconText}>❌</Text></View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Mal uso — Copiar y entregar</Text>
            <Text style={styles.cardText}>Le pide a ChatGPT que escriba el trabajo completo y lo entrega tal cual. Resultado: <Text style={styles.bold}>no aprendió nada, su escritura no mejoró, y si el profesor usa un detector de IA lo descubren.</Text> El LLM lo dejó más atrás, no más adelante.</Text>
          </View>
        </View>
      </View>
      <View style={styles.highlightBoxBlue}>
        <Text style={styles.highlightTextBlue}><Text style={styles.bold}>💡 La diferencia que importa:</Text> Un LLM usado como <Text style={styles.italic}>tutor</Text> te hace más inteligente. Un LLM usado como <Text style={styles.italic}>reemplazo</Text> te hace más dependiente. La habilidad de usar LLMs correctamente es una de las más valiosas del siglo XXI — y estás aprendiendo a desarrollarla ahora.</Text>
      </View>
    </View>
  );

  const renderQuiz = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.tag, styles.tagQuiz]}>❓ Módulo 8 de 15 · Quiz</Text>
      <Text style={styles.title}>¿Buscador o LLM? ¿Cuándo usar cuál?</Text>
      <Text style={styles.subtitle}>Cada situación requiere la herramienta correcta. Piensa antes de elegir.</Text>
      {quizQuestions.map((q, qIdx) => (
        <View key={qIdx} style={styles.quizCard}>
          <Text style={styles.quizQuestion}>{qIdx + 1}. {q.q}</Text>
          {q.opts.map((opt, optIdx) => (
            <TouchableOpacity
              key={optIdx}
              style={[styles.quizOption, quizAnswers[qIdx] === optIdx && styles.quizOptionSelected]}
              onPress={() => selectQuiz(qIdx, optIdx)}
              disabled={quizChecked}
            >
              <Text style={styles.quizLetter}>{String.fromCharCode(65 + optIdx)}</Text>
              <Text style={styles.quizOptText}>{opt}</Text>
            </TouchableOpacity>
          ))}
          {quizChecked && (
            <View style={[styles.resultBanner, quizAnswers[qIdx] === q.correct ? styles.resultBannerOk : styles.resultBannerErr]}>
              <Text style={styles.resultBannerText}>{quizAnswers[qIdx] === q.correct ? `✅ ¡Correcto! — ${q.explain}` : `❌ ${String.fromCharCode(65 + q.correct)} es la correcta — ${q.explain}`}</Text>
            </View>
          )}
        </View>
      ))}
      <TouchableOpacity style={[styles.checkButton, quizChecked && { backgroundColor: '#0ea5e9' }]} onPress={quizChecked ? goToNextStep : checkQuiz}>
        <Text style={styles.checkButtonText}>{quizChecked ? 'Continuar →' : 'Comprobar respuestas'}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSort = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.tag, styles.tagSort]}>↕️ Módulo 9 de 15 · Ordenar</Text>
      <Text style={styles.title}>El camino de tu pregunta en un LLM</Text>
      <Text style={styles.subtitle}>Estos son los 5 pasos que ocurren desde que escribes hasta que aparece la respuesta. Están mezclados — ponlos en orden con ▲▼.</Text>
      <View style={styles.hintCard}>
        <Text style={styles.hintCardText}>💡 Piensa: ¿qué necesita pasar <Text style={styles.italic}>primero</Text> para que el modelo pueda predecir algo? ¿Y qué es lo último que ocurre antes de que veas la respuesta?</Text>
      </View>
      {sortOrder.map((stepIdx, pos) => (
        <View key={pos} style={styles.sortItem}>
          <Text style={styles.sortNum}>{pos + 1}</Text>
          <Text style={styles.sortText}>
            <Text style={styles.bold}>{LLM_SORT_STEPS[stepIdx].bold}</Text>{LLM_SORT_STEPS[stepIdx].rest}
          </Text>
          <View style={styles.sortArrows}>
            <TouchableOpacity style={styles.sortBtn} onPress={() => moveSort(pos, -1)} disabled={pos === 0}>
              <MaterialIcons name="keyboard-arrow-up" size={20} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.sortBtn} onPress={() => moveSort(pos, 1)} disabled={pos === sortOrder.length - 1}>
              <MaterialIcons name="keyboard-arrow-down" size={20} />
            </TouchableOpacity>
          </View>
        </View>
      ))}
      <TouchableOpacity style={[styles.checkButton, sortOk && { backgroundColor: '#0ea5e9' }]} onPress={sortOk ? goToNextStep : checkSort}>
        <Text style={styles.checkButtonText}>{sortOk ? 'Continuar →' : 'Verificar orden'}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderTF = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.tag, styles.tagVF]}>✅ Módulo 10 de 15 · Verdadero o Falso</Text>
      <Text style={styles.title}>Mitos y realidades de los LLMs</Text>
      <Text style={styles.subtitle}>Muchas ideas sobre los LLMs son falsas. Separa los mitos de la realidad.</Text>
      {tfItems.map((item, idx) => (
        <View key={idx} style={styles.tfSet}>
          <Text style={styles.tfQuestion}>{idx + 1}. {item.stmt}</Text>
          <View style={styles.tfOpts}>
            <TouchableOpacity style={[styles.tfBtn, tfAnswers[idx] === true && styles.tfBtnTrue]} onPress={() => selectTF(idx, true)} disabled={tfChecked}>
              <Text>✅{'\n'}<Text style={{ fontSize: 10, fontWeight: '600' }}>Verdadero</Text></Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tfBtn, tfAnswers[idx] === false && styles.tfBtnFalse]} onPress={() => selectTF(idx, false)} disabled={tfChecked}>
              <Text>❌{'\n'}<Text style={{ fontSize: 10, fontWeight: '600' }}>Falso</Text></Text>
            </TouchableOpacity>
          </View>
          {tfChecked && (
            <View style={[styles.resultBanner, tfAnswers[idx] === item.correct ? styles.resultBannerOk : styles.resultBannerErr]}>
              <Text style={styles.resultBannerText}>{tfAnswers[idx] === item.correct ? `✓ Correcto — ${item.explain}` : `✗ Incorrecto — ${item.explain}`}</Text>
            </View>
          )}
        </View>
      ))}
      <TouchableOpacity style={[styles.checkButton, tfChecked && { backgroundColor: '#0ea5e9' }]} onPress={tfChecked ? goToNextStep : checkTF}>
        <Text style={styles.checkButtonText}>{tfChecked ? 'Continuar →' : 'Comprobar'}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderLLMCompare = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.tag, styles.tagTheory]}>📖 Módulo 11 de 15 · Los 4 LLMs</Text>
      <Text style={styles.title}>ChatGPT, Claude, Gemini y Grok</Text>
      <Text style={styles.subtitle}>No todos los LLMs son iguales. Cada uno tiene fortalezas distintas. Conocerlos te permite elegir el correcto para cada tarea.</Text>
      {/* ChatGPT */}
      <View style={[styles.llmCard, { borderColor: '#10a37f40', backgroundColor: '#f0fdf4' }]}>
        <View style={[styles.llmLogo, { backgroundColor: '#10a37f20' }]}>
          <Text style={[styles.llmLogoText, { color: '#10a37f' }]}>💬</Text>
        </View>
        <View style={styles.llmInfo}>
          <Text style={styles.llmModelName}>ChatGPT <Text style={styles.badgeGpt}>OpenAI</Text></Text>
          <Text style={styles.llmDesc}>El más popular y conocido. Muy versátil — sirve para casi todo. Tiene versión gratuita (GPT-3.5) y de pago (GPT-4o). Puede generar imágenes con DALL·E integrado.</Text>
          <View style={styles.llmTagsRow}>
            <Text style={[styles.llmTag, { backgroundColor: '#d1fae5', color: '#065f46' }]}>✅ Versátil</Text>
            <Text style={[styles.llmTag, { backgroundColor: '#d1fae5', color: '#065f46' }]}>✅ Genera imágenes</Text>
            <Text style={[styles.llmTag, { backgroundColor: '#fef3c7', color: '#92400e' }]}>⚠️ Puede alucinar</Text>
          </View>
        </View>
      </View>
      {/* Claude */}
      <View style={[styles.llmCard, { borderColor: '#d4714040', backgroundColor: '#fffbeb' }]}>
        <View style={[styles.llmLogo, { backgroundColor: '#d4714020' }]}>
          <Text style={[styles.llmLogoText, { color: '#c85f2a' }]}>🌟</Text>
        </View>
        <View style={styles.llmInfo}>
          <Text style={styles.llmModelName}>Claude <Text style={styles.badgeClaude}>Anthropic</Text></Text>
          <Text style={styles.llmDesc}>Diseñado para ser honesto, seguro y útil. Excelente para textos muy largos (lee documentos de 200+ páginas), análisis profundos y razonamiento complejo. Muy bueno con instrucciones detalladas.</Text>
          <View style={styles.llmTagsRow}>
            <Text style={[styles.llmTag, { backgroundColor: '#fef3c7', color: '#92400e' }]}>✅ Textos largos</Text>
            <Text style={[styles.llmTag, { backgroundColor: '#fef3c7', color: '#92400e' }]}>✅ Análisis</Text>
            <Text style={[styles.llmTag, { backgroundColor: '#fef3c7', color: '#92400e' }]}>✅ Más honesto</Text>
          </View>
        </View>
      </View>
      {/* Gemini */}
      <View style={[styles.llmCard, { borderColor: '#4285f440', backgroundColor: '#eff6ff' }]}>
        <View style={[styles.llmLogo, { backgroundColor: '#4285f420' }]}>
          <Text style={[styles.llmLogoText, { color: '#1a73e8' }]}>✦</Text>
        </View>
        <View style={styles.llmInfo}>
          <Text style={styles.llmModelName}>Gemini <Text style={styles.badgeGemini}>Google</Text></Text>
          <Text style={styles.llmDesc}>Integrado con todo el ecosistema de Google (Gmail, Docs, YouTube, Maps). Puede acceder a información actualizada de Google. Ideal para tareas que combinan búsqueda + generación.</Text>
          <View style={styles.llmTagsRow}>
            <Text style={[styles.llmTag, { backgroundColor: '#dbeafe', color: '#1e40af' }]}>✅ Info actualizada</Text>
            <Text style={[styles.llmTag, { backgroundColor: '#dbeafe', color: '#1e40af' }]}>✅ Con Google</Text>
            <Text style={[styles.llmTag, { backgroundColor: '#dbeafe', color: '#1e40af' }]}>✅ Multimodal</Text>
          </View>
        </View>
      </View>
      {/* Grok */}
      <View style={[styles.llmCard, { borderColor: '#1d9bf040', backgroundColor: '#f0f9ff' }]}>
        <View style={[styles.llmLogo, { backgroundColor: '#1d9bf020' }]}>
          <Text style={[styles.llmLogoText, { color: '#1d9bf0' }]}>𝕏</Text>
        </View>
        <View style={styles.llmInfo}>
          <Text style={styles.llmModelName}>Grok <Text style={styles.badgeGrok}>xAI / X</Text></Text>
          <Text style={styles.llmDesc}>Creado por xAI (Elon Musk). Integrado con X (antes Twitter) y tiene acceso a información en tiempo real de esa plataforma. Tiene un estilo más directo y menos filtros que otros modelos.</Text>
          <View style={styles.llmTagsRow}>
            <Text style={[styles.llmTag, { backgroundColor: '#e0f2fe', color: '#0369a1' }]}>✅ Tiempo real en X</Text>
            <Text style={[styles.llmTag, { backgroundColor: '#e0f2fe', color: '#0369a1' }]}>✅ Directo</Text>
            <Text style={[styles.llmTag, { backgroundColor: '#fff1f2', color: '#991b1b' }]}>⚠️ Menos filtros</Text>
          </View>
        </View>
      </View>
      <View style={styles.highlightBoxGreen}>
        <Text style={styles.highlightTextGreen}><Text style={styles.bold}>💡 Para empezar:</Text> Si eres nuevo usando LLMs, empieza con ChatGPT (gratis, versátil) o Gemini (gratis, integrado con Google). En el Nivel 3 aprenderás a escribir prompts poderosos para cualquiera de ellos.</Text>
      </View>
    </View>
  );

  const renderLLMDrag = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.tag, styles.tagActivity]}>🧩 Módulo 12 de 15 · ¿Qué LLM usarías?</Text>
      <Text style={styles.title}>Asigna la herramienta correcta</Text>
      <Text style={styles.subtitle}>Basándote en lo que aprendiste, ¿qué LLM usarías para cada tarea?</Text>
      <View style={[styles.card, { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }]}>
        <Text style={[styles.cardText, { fontSize: 11 }]}>🟡 <Text style={styles.bold}>Claude:</Text> textos largos, análisis · 🟢 <Text style={styles.bold}>ChatGPT:</Text> generación, código · 🔵 <Text style={styles.bold}>Gemini:</Text> info actualizada, Google</Text>
      </View>
      <View style={styles.chipsPool}>
        {llmItems.map((item, idx) => {
          if (llmPlaced[idx] !== undefined) return null;
          return (
            <TouchableOpacity key={idx} nativeID={`llm-chip-${idx}`} style={[styles.chip, llmSel === idx && styles.chipSelected]} onPress={() => handleChipPressLLM(idx)}>
              <Text style={styles.chipText}>{item.text}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {/* Claude + ChatGPT side by side */}
      <View style={styles.dropColsRow}>
        <View style={styles.dropColWrap}>
          <View style={[styles.llmDropHeaderBox, { backgroundColor: '#fef3c7' }]}>
            <Text style={[styles.llmDropHeaderText, { color: '#92400e' }]}>🟡 Claude</Text>
          </View>
          <TouchableOpacity nativeID="llm-zone-claude" style={[styles.dropCol, { borderColor: dragOverLLMZone === 'claude' ? '#0ea5e9' : '#fde68a', backgroundColor: dragOverLLMZone === 'claude' ? '#e0f2fe' : '#fffbeb', flex: 0 }]} onPress={() => handleDropZoneLLM('claude')}>
            <View style={styles.dropChips}>
              {Object.entries(llmPlaced).map(([idx, zone]) => zone === 'claude' ? (
                <TouchableOpacity key={idx} style={[styles.dropChip, { backgroundColor: '#fde68a40' }]} onPress={() => handleRemoveChipLLM(parseInt(idx))}>
                  <Text style={[styles.dropChipText, { color: '#92400e' }]}>{llmItems[parseInt(idx)].text} ✕</Text>
                </TouchableOpacity>
              ) : null)}
            </View>
          </TouchableOpacity>
        </View>
        <View style={styles.dropColWrap}>
          <View style={[styles.llmDropHeaderBox, { backgroundColor: '#d1fae5' }]}>
            <Text style={[styles.llmDropHeaderText, { color: '#065f46' }]}>🟢 ChatGPT</Text>
          </View>
          <TouchableOpacity nativeID="llm-zone-chatgpt" style={[styles.dropCol, { borderColor: dragOverLLMZone === 'chatgpt' ? '#0ea5e9' : '#6ee7b7', backgroundColor: dragOverLLMZone === 'chatgpt' ? '#e0f2fe' : '#f0fdf4', flex: 0 }]} onPress={() => handleDropZoneLLM('chatgpt')}>
            <View style={styles.dropChips}>
              {Object.entries(llmPlaced).map(([idx, zone]) => zone === 'chatgpt' ? (
                <TouchableOpacity key={idx} style={[styles.dropChip, { backgroundColor: '#d1fae560' }]} onPress={() => handleRemoveChipLLM(parseInt(idx))}>
                  <Text style={[styles.dropChipText, { color: '#065f46' }]}>{llmItems[parseInt(idx)].text} ✕</Text>
                </TouchableOpacity>
              ) : null)}
            </View>
          </TouchableOpacity>
        </View>
      </View>
      {/* Gemini - full width */}
      <View style={[styles.llmDropHeaderBox, { backgroundColor: '#dbeafe' }]}>
        <Text style={[styles.llmDropHeaderText, { color: '#1e40af' }]}>🔵 Gemini</Text>
      </View>
      <TouchableOpacity nativeID="llm-zone-gemini" style={[styles.dropCol, { borderColor: dragOverLLMZone === 'gemini' ? '#0ea5e9' : '#93c5fd', backgroundColor: dragOverLLMZone === 'gemini' ? '#e0f2fe' : '#eff6ff' }]} onPress={() => handleDropZoneLLM('gemini')}>
        <View style={styles.dropChips}>
          {Object.entries(llmPlaced).map(([idx, zone]) => zone === 'gemini' ? (
            <TouchableOpacity key={idx} style={[styles.dropChip, { backgroundColor: '#dbeafe60' }]} onPress={() => handleRemoveChipLLM(parseInt(idx))}>
              <Text style={[styles.dropChipText, { color: '#1e40af' }]}>{llmItems[parseInt(idx)].text} ✕</Text>
            </TouchableOpacity>
          ) : null)}
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.checkButton, llmOk && { backgroundColor: '#0ea5e9' }]} onPress={llmOk ? goToNextStep : checkLLMDrag}>
        <Text style={styles.checkButtonText}>{llmOk ? 'Continuar →' : 'Verificar asignación'}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderVocab = () => {
    const parts = fillItem.sentence.split('<b>___</b>');
    return (
      <View style={styles.stepContainer}>
        <Text style={[styles.tag, styles.tagVocab]}>💬 Módulo 13 de 15 · Vocabulario IA</Text>
        <Text style={styles.title}>El vocabulario que necesitas</Text>
        <Text style={styles.subtitle}>Los expertos en IA usan términos específicos. Aprende el más importante de este nivel.</Text>
        <View style={[styles.card, { backgroundColor: '#faf5ff', borderColor: '#e9d5ff' }]}>
          <Text style={styles.cardTitle}>📝 Completa la definición:</Text>
          <View style={styles.fillSentence}>
            <Text style={styles.fillSentenceText}>
              {parts[0]}<Text style={styles.fillBlank}>___</Text>{parts[1]}
            </Text>
          </View>
        </View>
        <View style={styles.hintCard}>
          <Text style={styles.hintCardText}>👇 Elige la palabra correcta:</Text>
        </View>
        <View style={styles.fillOpts}>
          {fillItem.allOpts.map((opt, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.fillOpt, fillSel === idx && styles.fillOptSelected]}
              onPress={() => selectFill(idx)}
              disabled={fillChecked}
            >
              <Text style={styles.fillOptText}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={[styles.checkButton, fillChecked && { backgroundColor: '#0ea5e9' }]} onPress={fillChecked ? goToNextStep : checkFill}>
          <Text style={styles.checkButtonText}>{fillChecked ? 'Continuar →' : 'Verificar respuesta'}</Text>
        </TouchableOpacity>
        <View style={[styles.highlightBox, { borderLeftColor: '#8b5cf6', backgroundColor: '#faf5ff', marginTop: 14 }]}>
          <Text style={[styles.highlightText, { color: '#5b21b6' }]}>
            <Text style={styles.bold}>📚 Vocabulario clave del Nivel 2:{'\n'}</Text>
            <Text style={styles.bold}>Prompt</Text> — La instrucción que le das al LLM{'\n'}
            <Text style={styles.bold}>Token</Text> — Fragmento de texto que el LLM procesa{'\n'}
            <Text style={styles.bold}>Contexto</Text> — Historial de conversación que el LLM puede "ver"{'\n'}
            <Text style={styles.bold}>Alucinación</Text> — Cuando el LLM inventa datos con total confianza{'\n'}
            <Text style={styles.bold}>IA Generativa</Text> — IA que crea contenido nuevo
          </Text>
        </View>
      </View>
    );
  };

  const renderPromptCompare = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.tag, styles.tagPrompt]}>🔍 Módulo 14 de 15 · Prompts</Text>
      <Text style={styles.title}>¿Cuál prompt es mejor?</Text>
      <Text style={styles.subtitle}>Para la misma tarea, un buen prompt da resultados 10x mejores que uno vago. ¿Puedes identificar cuál es cuál?</Text>
      <View style={styles.hintCard}>
        <Text style={styles.hintCardText}>👆 Toca el prompt que crees que daría mejor resultado en cada situación</Text>
      </View>
      {promptItems.map((item, idx) => (
        <View key={idx} style={styles.promptSet}>
          <Text style={styles.promptTask}>🎯 Tarea: {item.task}</Text>
          <TouchableOpacity
            style={[styles.promptCard, promptSels[idx] === 'bad' && styles.promptCardSelected]}
            onPress={() => selectPrompt(idx, 'bad')}
            disabled={promptsChecked}
          >
            <Text style={[styles.promptLabel, { color: '#ef4444' }]}>Prompt A:</Text>
            <Text style={styles.promptText}>{item.bad}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.promptCard, promptSels[idx] === 'good' && styles.promptCardSelected]}
            onPress={() => selectPrompt(idx, 'good')}
            disabled={promptsChecked}
          >
            <Text style={[styles.promptLabel, { color: '#10b981' }]}>Prompt B:</Text>
            <Text style={styles.promptText}>{item.good}</Text>
          </TouchableOpacity>
          {promptsChecked && (
            <View style={[styles.resultBanner, promptSels[idx] === 'good' ? styles.resultBannerOk : styles.resultBannerErr]}>
              <Text style={styles.resultBannerText}>{promptSels[idx] === 'good' ? `✓ ¡Correcto! El Prompt B es mucho mejor. ${item.explain}` : `✗ El Prompt B es el correcto. ${item.explain}`}</Text>
            </View>
          )}
        </View>
      ))}
      <View style={styles.highlightBoxBlue}>
        <Text style={styles.highlightTextBlue}><Text style={styles.bold}>💡 Lo que vas a aprender en el Nivel 3:</Text> El arte del prompting completo — cómo darle rol, contexto, formato y restricciones a un LLM para obtener exactamente lo que necesitas.</Text>
      </View>
      <TouchableOpacity style={[styles.checkButton, promptsChecked && { backgroundColor: '#0ea5e9' }]} onPress={promptsChecked ? goToNextStep : checkPrompts}>
        <Text style={styles.checkButtonText}>{promptsChecked ? 'Continuar →' : 'Comprobar elecciones'}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderReflect = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.tag, styles.tagReflect]}>✍️ Reflexión final · +15 XP</Text>
      <Text style={styles.title}>¿Cómo vas a usar esto a partir de hoy?</Text>
      <Text style={styles.subtitle}>Este nivel te presentó los LLMs como herramientas de aprendizaje reales.</Text>
      <View style={[styles.card, styles.cardPurple]}>
        <View style={styles.cardRow}>
          <View style={[styles.cardIcon, { backgroundColor: '#e9d5ff' }]}><Text style={styles.cardIconText}>🤔</Text></View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Tu reflexión de cierre</Text>
            <Text style={styles.cardText}>Piensa en dos cosas concretas:{'\n\n'}<Text style={styles.bold}>1. Una app que usas todos los días y que vas a usar diferente ahora que sabes cómo funciona la IA por dentro.</Text>{'\n\n'}<Text style={styles.bold}>2. Una tarea de estudio o de la vida real donde vas a usar un LLM esta semana — y cómo lo vas a usar correctamente.</Text></Text>
          </View>
        </View>
      </View>
      <TextInput
        style={styles.textArea}
        multiline
        numberOfLines={6}
        placeholder="Ejemplo: Voy a usar YouTube de forma más consciente, ya sé que el algoritmo me está jalando hacia cierto contenido... y esta semana voy a pedirle a Claude que me ayude a entender los temas de mi examen de química haciéndome preguntas de práctica, en lugar de copiar respuestas..."
        placeholderTextColor="#b8bcc0"
        value={reflectText}
        onChangeText={setReflectText}
      />
      <Text style={styles.charCount}>{reflectText.trim().length} / 70 mínimo</Text>
      <View style={styles.highlightBoxGreen}>
        <Text style={styles.highlightTextGreen}>✅ <Text style={styles.bold}>Esta reflexión queda en tu portafolio IA Explorer.</Text> La habilidad de saber qué herramienta usar para qué tarea es lo que separa a los usuarios avanzados de IA de los principiantes.</Text>
      </View>
      <TouchableOpacity style={styles.checkButton} onPress={checkReflect}>
        <Text style={styles.checkButtonText}>Enviar reflexión →</Text>
      </TouchableOpacity>
    </View>
  );

  const renderCompletion = () => (
    <View style={styles.completeContainer}>
      <View style={styles.completeBadgeContainer}>
        <Text style={styles.completeBadgeText}>🎖️</Text>
      </View>
      <Text style={styles.completeTitle}>¡Nivel 2 completado!</Text>
      <Text style={styles.completeSub}>Terminaste "La IA que vive en tus apps". Ahora ves las apps de otra manera — y tienes tu primera brújula para usar los LLMs correctamente.</Text>
      <View style={styles.xpEarnedChip}>
        <Text style={styles.xpEarnedChipText}>⭐ {xp} XP ganados en este nivel</Text>
      </View>
      <View style={styles.skillsList}>
        {[
          'Identifico los 4 tipos de IA en las apps que uso todos los días',
          'Sé qué son los LLMs, cómo funcionan y en qué se diferencian de Google',
          'Conozco ChatGPT, Claude, Gemini y Grok — y para qué sirve mejor cada uno',
          'Sé cuándo usar un LLM y cuándo usar Google para obtener mejores resultados',
          'Entiendo la diferencia entre un prompt vago y uno que da resultados 10x mejores',
        ].map((skill, i) => (
          <View key={i} style={styles.skillRow}>
            <Text style={styles.skillCheck}>✓</Text>
            <Text style={styles.skillText}>{skill}</Text>
          </View>
        ))}
      </View>
      <View style={styles.nextHint}>
        <Text style={styles.nextHintText}>🎯 <Text style={styles.bold}>Nivel 3: El Arte del Prompting{'\n\n'}</Text>Vas a dominar la habilidad más valiosa de la era de la IA: escribir prompts que le saquen el máximo provecho a cualquier LLM. Aprenderás las técnicas de prompting que usan los profesionales — rol, contexto, formato, restricciones y ejemplos.</Text>
      </View>
      <TouchableOpacity style={styles.nextLevelButton} onPress={handleFinish}>
        <Text style={styles.nextLevelText}>Siguiente nivel →</Text>
      </TouchableOpacity>
    </View>
  );

  const renderContent = () => {
    switch (step) {
      case 0: return renderIntro();
      case 1: return renderTheory1();
      case 2: return renderExamples();
      case 3: return renderDrag3();
      case 4: return renderTheory2();
      case 5: return renderMatching();
      case 6: return renderTheoryLLM();
      case 7: return renderCase();
      case 8: return renderQuiz();
      case 9: return renderSort();
      case 10: return renderTF();
      case 11: return renderLLMCompare();
      case 12: return renderLLMDrag();
      case 13: return renderVocab();
      case 14: return renderPromptCompare();
      case 15: return renderReflect();
      case 16: return renderCompletion();
      default: return null;
    }
  };

  const progressPercent = (step / (TOTAL_STEPS - 1)) * 100;
  const showNextButton = step < TOTAL_STEPS - 1 && ![3, 5, 8, 9, 10, 12, 13, 14, 15].includes(step);
  const getNextLabel = (s: number): string => {
    if (s === 0) return '¡Empecemos! 🚀';
    if ([1, 4, 11].includes(s)) return 'Entendido →';
    if (s === 2) return '¡Las vi todas! →';
    if (s === 6) return 'Entendido, sigamos →';
    return 'Continuar →';
  };
  const THEORY_STEPS_L2 = new Set([1, 2, 4, 6, 7, 11]);
  const showBackButton = step > 0 && THEORY_STEPS_L2.has(step) && showNextButton;
  const goToPrevStep = () => { setStepResult(null); setStep(s => s - 1); };

  const progLabel = step === 0 ? 'Introducción'
    : step < TOTAL_STEPS - 1 ? `Módulo ${step} de ${CONTENT_STEPS}`
    : '¡Nivel completado!';

  return (
    <View style={styles.screen}>
      <View style={styles.progressBar}>
        <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
          <MaterialIcons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>
          <Text style={styles.progLabel}>{progLabel}</Text>
        </View>
        <Text style={styles.xpText}>{xp} XP</Text>
      </View>
      {step > 0 && (
        <Text style={styles.stepsCounter}>
          {step < TOTAL_STEPS - 1
            ? `${step} de ${CONTENT_STEPS} módulos completados`
            : `${CONTENT_STEPS} de ${CONTENT_STEPS} módulos completados`}
        </Text>
      )}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {renderContent()}
      </ScrollView>
      {stepResult && (
        <View style={[styles.resultBanner, stepResult.ok ? styles.resultBannerOk : styles.resultBannerErr]}>
          <Text style={styles.resultBannerText}>{stepResult.ok ? '✅ ' : '❌ '}{stepResult.msg}</Text>
        </View>
      )}
      {xpToast && <XPToast key={xpToast.id} amount={xpToast.amount} onHide={() => setXpToast(null)} />}
      <View style={styles.footerRow}>
        {showBackButton && (
          <TouchableOpacity style={styles.backButton} onPress={goToPrevStep}>
            <Text style={styles.backButtonText}>← Volver</Text>
          </TouchableOpacity>
        )}
        {showNextButton && (
          <TouchableOpacity style={[styles.nextButton, showBackButton && styles.nextButtonFlex]} onPress={goToNextStep}>
            <Text style={styles.nextButtonText}>{getNextLabel(step)}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  progressBar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  closeBtn: { padding: 4 },
  progressWrap: { flex: 1, marginHorizontal: 12 },
  progressTrack: { height: 6, backgroundColor: colors.borderLight, borderRadius: 3 },
  progressFill: { height: '100%', backgroundColor: '#0ea5e9', borderRadius: 3 },
  progLabel: { fontSize: 10, color: '#94a3b8', marginTop: 3, fontWeight: '500' },
  stepsCounter: { fontSize: 10, color: '#94a3b8', textAlign: 'center', paddingBottom: 5, paddingTop: 2 },
  xpText: { ...typography.bold, fontSize: 14, color: colors.accentDark },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  stepContainer: { flex: 1 },
  tag: { fontSize: 11, fontWeight: '700', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 12, letterSpacing: 0.4 },
  tagIntro: { backgroundColor: '#e0f2fe', color: '#0369a1' },
  tagTheory: { backgroundColor: '#dcfce7', color: '#166534' },
  tagExample: { backgroundColor: '#fff7ed', color: '#9a3412' },
  tagCase: { backgroundColor: '#fdf4ff', color: '#7e22ce' },
  tagActivity: { backgroundColor: '#eff6ff', color: '#1e40af' },
  tagQuiz: { backgroundColor: '#fef3c7', color: '#92400e' },
  tagReflect: { backgroundColor: '#f1f5f9', color: '#475569' },
  tagVocab: { backgroundColor: '#ecfdf5', color: '#065f46' },
  tagVF: { backgroundColor: '#fef9ee', color: '#92400e' },
  tagMatch: { backgroundColor: '#eef2ff', color: '#3730a3' },
  tagSort: { backgroundColor: '#f5f3ff', color: '#5b21b6' },
  tagPrompt: { backgroundColor: '#fff1f2', color: '#9f1239' },
  iconContainer: { width: 60, height: 60, borderRadius: 18, backgroundColor: '#eef2ff', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  iconEmoji: { fontSize: 30 },
  title: { ...typography.extraBold, fontSize: 19, color: colors.textPrimary, marginBottom: 6 },
  subtitle: { ...typography.regular, fontSize: 13, color: colors.textSecondary, marginBottom: 14, lineHeight: 20 },
  bodyText: { ...typography.regular, fontSize: 13, color: colors.textPrimary, lineHeight: 20, marginBottom: 12 },
  bold: { fontWeight: 'bold' },
  italic: { fontStyle: 'italic' },
  sectionTitle: { ...typography.bold, fontSize: 14, color: colors.textPrimary, marginTop: 16, marginBottom: 8 },
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  cardTitle: { ...typography.bold, fontSize: 13, color: colors.textPrimary, marginBottom: 6 },
  cardText: { ...typography.regular, fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
  cardSky: { backgroundColor: '#f0f9ff', borderColor: '#bae6fd' },
  cardGreen: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  cardAmber: { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  cardPurple: { backgroundColor: '#faf5ff', borderColor: '#e9d5ff' },
  cardRed: { backgroundColor: '#fff1f2', borderColor: '#fecdd3' },
  cardRow: { flexDirection: 'row' as const, gap: 11, alignItems: 'flex-start' as const },
  cardIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center' as const, alignItems: 'center' as const, flexShrink: 0 },
  cardIconText: { fontSize: 19 },
  cardContent: { flex: 1 },
  hintCard: { backgroundColor: colors.surfaceVariant, borderRadius: 12, padding: 11, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  hintCardText: { ...typography.regular, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  highlightBox: { borderLeftWidth: 3, borderLeftColor: colors.error, padding: 11, backgroundColor: '#fff1f2', marginVertical: 10, borderRadius: 4 },
  highlightText: { ...typography.regular, fontSize: 13, color: '#991b1b', lineHeight: 20 },
  highlightBoxGreen: { borderLeftWidth: 3, borderLeftColor: colors.success, padding: 11, backgroundColor: '#f0fdf4', marginVertical: 10, borderRadius: 4 },
  highlightTextGreen: { ...typography.regular, fontSize: 13, color: '#166534', lineHeight: 20 },
  highlightBoxBlue: { borderLeftWidth: 3, borderLeftColor: colors.primary, padding: 11, backgroundColor: '#f0f9ff', marginVertical: 10, borderRadius: 4 },
  highlightTextBlue: { ...typography.regular, fontSize: 13, color: '#0369a1', lineHeight: 20 },
  highlightBoxAmber: { borderLeftWidth: 3, borderLeftColor: '#f59e0b', padding: 11, backgroundColor: '#fffbeb', marginVertical: 10, borderRadius: 4 },
  highlightTextAmber: { ...typography.regular, fontSize: 13, color: '#92400e', lineHeight: 20 },
  // Expandable app cards (módulo 2)
  exCard: { borderRadius: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 8, padding: 12, backgroundColor: colors.surface },
  exHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exEmoji: { width: 40, height: 40, backgroundColor: colors.surfaceVariant, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  exEmojiText: { fontSize: 22 },
  exInfo: { flex: 1 },
  exName: { ...typography.bold, fontSize: 13, color: colors.textPrimary },
  exSub: { ...typography.regular, fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  exArr: { fontSize: 17, color: colors.textSecondary },
  exBody: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  exTag: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, fontSize: 10, fontWeight: '700', marginBottom: 8 },
  exHow: { ...typography.regular, fontSize: 12, color: colors.textPrimary, lineHeight: 19, marginBottom: 8 },
  exFact: { backgroundColor: '#fffbeb', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#fde68a' },
  exFactText: { ...typography.regular, fontSize: 11, color: '#92400e', lineHeight: 17 },
  // Scenario box (módulo 7)
  scenarioBox: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 13, padding: 13, marginBottom: 12 },
  scenarioLabel: { fontSize: 9, fontWeight: '700', color: '#92400e', letterSpacing: 0.8, marginBottom: 7, textTransform: 'uppercase' },
  scenarioText: { ...typography.regular, fontSize: 12, color: colors.textPrimary, lineHeight: 19 },
  // LLM card layout (module 11)
  llmCard: { borderRadius: 12, padding: 11, borderWidth: 1.5, borderColor: '#e2e8f0', marginBottom: 7, flexDirection: 'row' as const, gap: 10, alignItems: 'flex-start' as const },
  llmLogo: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center' as const, alignItems: 'center' as const, flexShrink: 0 },
  llmLogoText: { fontSize: 20, fontWeight: '900' as const },
  llmInfo: { flex: 1 },
  llmModelName: { ...typography.bold, fontSize: 12, color: '#0f172a', marginBottom: 2 },
  llmDesc: { ...typography.regular, fontSize: 11, color: '#64748b', lineHeight: 17 },
  llmTagsRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 4, marginTop: 5 },
  llmTag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, fontSize: 10, fontWeight: '600' as const },
  // LLM drag column layout
  llmDropHeaderBox: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 7, marginBottom: 5 },
  llmDropHeaderText: { fontSize: 10, fontWeight: '700' as const },
  dropColsRow: { flexDirection: 'row' as const, gap: 8, marginBottom: 8 },
  dropColWrap: { flex: 1 },
  // Drag
  chipsPool: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, backgroundColor: colors.surfaceVariant, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, minHeight: 60 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight },
  chipSelected: { backgroundColor: '#dbeafe', borderColor: colors.primary },
  chipText: { ...typography.regular, fontSize: 12, color: colors.textPrimary },
  dropCols: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  dropCol: { flex: 1, minWidth: '45%', borderWidth: 2, borderStyle: 'dashed', borderColor: colors.borderLight, borderRadius: 12, padding: 8, minHeight: 100 },
  dropAI: { backgroundColor: '#f0f7ff' },
  dropHeader: { ...typography.bold, fontSize: 11, textAlign: 'center', marginBottom: 6 },
  dropChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  dropChip: { backgroundColor: '#dbeafe', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  dropChipText: { ...typography.regular, fontSize: 11, color: colors.primary },
  checkButton: { backgroundColor: colors.success, padding: 12, borderRadius: 11, alignItems: 'center', marginTop: 16 },
  checkButtonText: { ...typography.bold, color: '#fff' },
  // Matching
  matchColLabels: { flexDirection: 'row', marginTop: 4, marginBottom: 2 },
  matchColLabel: { flex: 1, fontSize: 10, fontWeight: '700', color: colors.textSecondary, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.3 },
  matchColumns: { flexDirection: 'row', gap: 12, marginTop: 4 },
  matchLeftColumn: { flex: 1, gap: 8 },
  matchRightColumn: { flex: 1, gap: 8 },
  matchLeftCard: { backgroundColor: '#f0f9ff', padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#bae6fd', minHeight: 60, justifyContent: 'center' },
  matchRightCard: { backgroundColor: '#f0fdf4', padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#bbf7d0', minHeight: 60, justifyContent: 'center' },
  matchSelected: { borderColor: '#0ea5e9', borderWidth: 2, backgroundColor: '#e0f2fe' },
  matchMatched: { backgroundColor: '#dcfce7', borderColor: '#10b981' },
  matchText: { ...typography.regular, fontSize: 12, color: colors.textPrimary, textAlign: 'center' },
  // VS grid
  vsGrid: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  vsCol: { flex: 1, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border },
  vsHeader: { ...typography.bold, fontSize: 12, marginBottom: 8, textAlign: 'center' },
  vsItem: { ...typography.regular, fontSize: 11, color: colors.textPrimary, marginBottom: 4, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  // Quiz
  quizCard: { marginBottom: 16 },
  quizQuestion: { ...typography.bold, fontSize: 14, color: colors.textPrimary, marginBottom: 8, padding: 12, backgroundColor: colors.surfaceVariant, borderRadius: 10 },
  quizOption: { flexDirection: 'row', alignItems: 'center', padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 11, marginBottom: 6, gap: 10 },
  quizOptionSelected: { borderColor: colors.primary, backgroundColor: '#eff6ff' },
  quizLetter: { width: 26, height: 26, borderRadius: 8, backgroundColor: '#f3f4f6', textAlign: 'center', lineHeight: 26, ...typography.bold },
  quizOptText: { flex: 1, ...typography.regular, fontSize: 13, color: colors.textPrimary },
  // Sort
  sortItem: { flexDirection: 'row', alignItems: 'center', padding: 11, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  sortNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#0ea5e9', color: '#fff', textAlign: 'center', lineHeight: 26, ...typography.bold, fontSize: 11, marginRight: 9 },
  sortText: { flex: 1, ...typography.regular, fontSize: 12, color: colors.textPrimary },
  sortArrows: { flexDirection: 'column', gap: 3 },
  sortBtn: { width: 28, height: 26, borderRadius: 7, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
  // TF
  tfSet: { marginBottom: 14 },
  tfQuestion: { ...typography.bold, fontSize: 13, color: colors.textPrimary, marginBottom: 8, padding: 11, backgroundColor: colors.surfaceVariant, borderRadius: 10 },
  tfOpts: { flexDirection: 'row', gap: 7 },
  tfBtn: { flex: 1, padding: 12, borderRadius: 11, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', minHeight: 52 },
  tfBtnTrue: { borderColor: colors.success, backgroundColor: '#f0fdf4' },
  tfBtnFalse: { borderColor: colors.error, backgroundColor: '#fff1f2' },
  // LLM compare badges
  badgeGpt: { fontSize: 10, fontWeight: '700', color: '#10a37f', backgroundColor: '#d1fae5', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  badgeClaude: { fontSize: 10, fontWeight: '700', color: '#c85f2a', backgroundColor: '#fef3c7', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  badgeGemini: { fontSize: 10, fontWeight: '700', color: '#1a73e8', backgroundColor: '#dbeafe', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  badgeGrok: { fontSize: 10, fontWeight: '700', color: '#1d9bf0', backgroundColor: '#e0f2fe', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  // Fill in blank
  fillSentence: { marginTop: 8 },
  fillSentenceText: { ...typography.regular, fontSize: 13, color: colors.textPrimary, lineHeight: 22 },
  fillBlank: { fontWeight: 'bold', color: '#0369a1', textDecorationLine: 'underline' },
  fillOpts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  fillOpt: { padding: 8, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  fillOptSelected: { borderColor: colors.primary, backgroundColor: '#e0f2fe' },
  fillOptText: { ...typography.bold, fontSize: 12, color: colors.textPrimary },
  // Prompt compare
  promptSet: { marginBottom: 16 },
  promptTask: { ...typography.bold, fontSize: 12, marginBottom: 8, padding: 8, backgroundColor: colors.surfaceVariant, borderRadius: 9 },
  promptCard: { borderRadius: 12, padding: 12, borderWidth: 2, borderColor: colors.border, marginBottom: 8 },
  promptCardSelected: { borderColor: colors.primary, backgroundColor: '#f0f9ff' },
  promptLabel: { ...typography.bold, fontSize: 10, textTransform: 'uppercase', marginBottom: 6 },
  promptText: { ...typography.regular, fontSize: 12, color: colors.textPrimary, lineHeight: 19, backgroundColor: colors.surfaceVariant, padding: 9, borderRadius: 8 },
  // Reflect
  textArea: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, ...typography.regular, fontSize: 13, color: colors.textPrimary, textAlignVertical: 'top', minHeight: 100, backgroundColor: '#fafafa' },
  charCount: { ...typography.regular, fontSize: 11, color: colors.textSecondary, textAlign: 'right', marginTop: 4, marginBottom: 10 },
  // Completion
  completeContainer: { alignItems: 'center', padding: 20 },
  completeBadgeText: { fontSize: 44 },
  completeTitle: { ...typography.extraBold, fontSize: 21, color: colors.textPrimary, marginBottom: 6 },
  completeSub: { ...typography.regular, fontSize: 12, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 14 },
  xpEarnedText: { ...typography.bold, fontSize: 15, color: colors.accentDark, marginBottom: 14 },
  skillsList: { width: '100%', gap: 6, marginBottom: 14 },
  skillRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 8, backgroundColor: '#f0fdf4', borderRadius: 9, borderWidth: 1, borderColor: '#bbf7d0' },
  skillCheck: { color: colors.success, fontSize: 14 },
  skillText: { flex: 1, ...typography.regular, fontSize: 11, color: '#166534', lineHeight: 17 },
  nextHint: { width: '100%', padding: 13, backgroundColor: colors.surfaceVariant, borderRadius: 10, marginBottom: 14, borderWidth: 1, borderColor: colors.border },
  nextHintText: { ...typography.regular, fontSize: 12, color: colors.textPrimary, lineHeight: 19 },
  completeBadgeContainer: { width: 86, height: 86, borderRadius: 24, backgroundColor: '#bae6fd', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  xpEarnedChip: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, paddingVertical: 11, paddingHorizontal: 20, backgroundColor: '#fef9c3', borderRadius: 12, marginBottom: 14, borderWidth: 1, borderColor: '#fcd34d', width: '100%' as const },
  xpEarnedChipText: { ...typography.bold, fontSize: 15, color: '#92400e' },
  nextLevelButton: { backgroundColor: '#0ea5e9', padding: 14, borderRadius: 11, width: '100%', alignItems: 'center' },
  nextLevelText: { ...typography.bold, color: '#fff' },
  // Result banner
  resultBanner: { margin: 16, padding: 14, borderRadius: 14, borderWidth: 1 },
  resultBannerOk: { backgroundColor: '#dcfce7', borderColor: colors.success },
  resultBannerErr: { backgroundColor: '#fee2e2', borderColor: colors.error },
  resultBannerText: { ...typography.bold, fontSize: 13, color: colors.textPrimary, lineHeight: 20 },
  // Footer
  footerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  nextButton: { backgroundColor: '#0ea5e9', padding: 14, margin: 16, borderRadius: 11, alignItems: 'center' },
  nextButtonText: { ...typography.bold, color: '#fff', fontSize: 15 },
  nextButtonFlex: { flex: 1, margin: 0 },
  backButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 14, borderRadius: 11, alignItems: 'center', paddingHorizontal: 20 },
  backButtonText: { ...typography.bold, color: colors.textSecondary, fontSize: 15 },
});
