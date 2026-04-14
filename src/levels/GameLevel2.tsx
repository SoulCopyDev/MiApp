// src/levels/GameLevel2.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useGameStore } from '../store/gameStore';
import { colors, typography } from '../theme';

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

const TOTAL_STEPS = 18; // 0:intro + 15 módulos + 1:complete
const CONTENT_STEPS = 15;

// Pools de datos (los mismos del HTML)
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
    explain: 'Los LLMs brillan en explicar conceptos complejos de forma personalizada.',
  },
  {
    q: 'Quieres saber qué restaurantes están abiertos cerca de ti ahora. ¿Qué usas?',
    opts: ['ChatGPT — conoce restaurantes de todo el mundo', 'Google Maps o Google Search — tiene datos de ubicación en tiempo real', 'Claude — es más preciso para este tipo de consultas', 'Cualquiera, son exactamente iguales para esto'],
    correct: 1,
    explain: 'Los LLMs no tienen datos de tu ubicación ni de horarios de negocios actualizados.',
  },
  {
    q: 'Quieres revisar si tu ensayo tiene errores de redacción y suena bien. ¿Qué usas?',
    opts: ['Google — busca los errores de gramática más comunes', 'Un LLM como Claude o ChatGPT — puede leer tu texto y sugerir mejoras específicas', 'Ninguno — solo un profesor puede revisar bien', 'Wikipedia — tiene las reglas de redacción en español'],
    correct: 1,
    explain: 'Esta es una tarea perfecta para un LLM.',
  },
];

const LLM_TF_POOL: TFItem[] = [
  { stmt: 'ChatGPT busca la respuesta en internet igual que Google', correct: false, explain: 'ChatGPT predice texto a partir de su entrenamiento, no busca en internet en tiempo real.' },
  { stmt: 'Un LLM puede equivocarse e inventar datos que suenan reales', correct: true, explain: 'Correcto — se llama "alucinación".' },
  { stmt: 'Claude, ChatGPT y Gemini son exactamente iguales en sus capacidades', correct: false, explain: 'Cada LLM tiene fortalezas distintas.' },
  { stmt: 'Los LLMs entienden realmente el significado de lo que lees', correct: false, explain: 'Los LLMs no "entienden" — predicen texto estadísticamente probable.' },
  { stmt: 'Puedes usar un LLM para mejorar la redacción de un texto que ya escribiste', correct: true, explain: '¡Perfecto uso!' },
  { stmt: 'Un LLM siempre da la misma respuesta a la misma pregunta', correct: false, explain: 'Los LLMs tienen variabilidad.' },
  { stmt: 'Los LLMs como ChatGPT aprendieron leyendo textos de internet', correct: true, explain: 'Correcto. Fueron entrenados con enormes volúmenes de texto.' },
  { stmt: 'Puedes confiar al 100% en lo que dice un LLM para un trabajo académico', correct: false, explain: 'Nunca al 100%. Verifica siempre.' },
  { stmt: 'Un LLM puede ayudarte a aprender a programar paso a paso', correct: true, explain: '¡Absolutamente! Son excelentes tutores.' },
  { stmt: 'Los LLMs solo sirven para escribir textos y nada más', correct: false, explain: 'Sirven para resumir, traducir, programar, analizar, etc.' },
];

const VOCAB_FILL_POOL: VocabItem[] = [
  {
    sentence: 'Cuando un LLM inventa información falsa con total confianza se llama <b>___</b>.',
    allOpts: ['alucinación', 'error', 'crash', 'bug'],
    correct: 0,
    explain: '"Alucinación" es el término técnico.',
  },
  {
    sentence: 'La instrucción que le das a un LLM para que haga algo se llama <b>___</b>.',
    allOpts: ['prompt', 'código', 'query', 'comando'],
    correct: 0,
    explain: '"Prompt" es la instrucción o pregunta que le das al modelo.',
  },
  {
    sentence: 'Los LLMs dividen el texto en pequeñas unidades llamadas <b>___</b> para procesarlo.',
    allOpts: ['tokens', 'bytes', 'pixeles', 'bits'],
    correct: 0,
    explain: '"Token" es la unidad básica de texto para un LLM.',
  },
  {
    sentence: 'La información previa de una conversación que el LLM puede recordar se llama <b>___</b>.',
    allOpts: ['contexto', 'memoria', 'historial', 'caché'],
    correct: 0,
    explain: '"Contexto" es la ventana de conversación que el LLM puede "ver".',
  },
  {
    sentence: 'La capacidad de un LLM de generar contenido nuevo (texto, imágenes, código) se llama IA <b>___</b>.',
    allOpts: ['generativa', 'reactiva', 'predictiva', 'adaptativa'],
    correct: 0,
    explain: '"IA Generativa" o "GenAI" es el término.',
  },
];

const PROMPT_COMPARE_POOL: PromptItem[] = [
  {
    task: 'Pedir ayuda para estudiar para un examen',
    bad: 'Ayúdame a estudiar',
    good: 'Tengo un examen de historia del siglo XX mañana. Soy estudiante de 9° grado. Necesito que me hagas 10 preguntas de práctica con sus respuestas, de menor a mayor dificultad.',
    explain: 'El prompt bueno especifica: el tema exacto, tu nivel, el tipo de ayuda que necesitas y el formato deseado.',
  },
  {
    task: 'Pedir que revise un texto',
    bad: 'Revisa esto',
    good: 'Revisa este párrafo. Corrige errores de ortografía y gramática. No cambies el contenido ni mi estilo. Explica brevemente cada corrección que hagas.',
    explain: 'El prompt bueno especifica qué revisar, qué no cambiar, y cómo quieres la respuesta.',
  },
  {
    task: 'Pedir que explique un concepto difícil',
    bad: 'Explícame la relatividad',
    good: 'Explícame la teoría de la relatividad de Einstein como si tuviera 12 años, usando una analogía con algo de la vida cotidiana. Máximo 3 párrafos.',
    explain: 'El prompt bueno especifica el nivel, el método (analogía) y el límite de longitud.',
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

const LLM_SORT_STEPS = [
  'Recibes tu prompt: Escribes tu pregunta o instrucción en el chat',
  'Tokenización: Tu texto se divide en pequeños fragmentos llamados tokens',
  'Búsqueda de contexto: El modelo analiza el historial de la conversación',
  'Predicción: Calcula qué tokens son más probables como respuesta',
  'Respuesta generada: Ensambla los tokens en texto y te lo muestra',
];

// Función helper para elegir N elementos aleatorios
const pickN = <T,>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};

export default function GameLevel2({ navigation }: any) {
  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);
  const completeLevel = useGameStore((state) => state.completeLevel);

  // Pools aleatorios (se inicializan una vez)
  const [drag3Items] = useState(() => pickN(AI_TYPE_POOL, 12));
  const [matchPairs] = useState(() => pickN(APP_MATCH_POOL, 4));
  const [quizQuestions] = useState(() => pickN(SEARCH_QUIZ_POOL, 4));
  const [tfItems] = useState(() => pickN(LLM_TF_POOL, 5));
  const [fillItem] = useState(() => pickN(VOCAB_FILL_POOL, 1)[0]);
  const [promptItems] = useState(() => pickN(PROMPT_COMPARE_POOL, 3));

  // Estados para actividades
  const [drag3Placed, setDrag3Placed] = useState<{ [key: number]: string }>({});
  const [drag3Sel, setDrag3Sel] = useState<number | null>(null);
  const [drag3Attempts, setDrag3Attempts] = useState(0);
  const [drag3Ok, setDrag3Ok] = useState(false);

  const [matchLeft, setMatchLeft] = useState<number | null>(null);
  const [matchDone, setMatchDone] = useState(0);
  const [rightOrder, setRightOrder] = useState<string[]>([]);
  const [matchedLeft, setMatchedLeft] = useState<Set<number>>(new Set());
  const [matchedRight, setMatchedRight] = useState<Set<number>>(new Set());

  const [quizAnswers, setQuizAnswers] = useState<{ [key: number]: number }>({});
  const [quizChecked, setQuizChecked] = useState(false);

  const [sortOrder, setSortOrder] = useState<number[]>([]);
  const [sortOk, setSortOk] = useState(false);

  const [tfAnswers, setTfAnswers] = useState<{ [key: number]: boolean }>({});
  const [tfChecked, setTfChecked] = useState(false);

  const [fillSel, setFillSel] = useState<number | null>(null);
  const [fillChecked, setFillChecked] = useState(false);

  const [promptSels, setPromptSels] = useState<{ [key: number]: 'good' | 'bad' }>({});
  const [promptsChecked, setPromptsChecked] = useState(false);

  const [reflectText, setReflectText] = useState('');

  const [llmItems] = useState(() => pickN(LLM_DRAG_POOL, 6));
  const [llmPlaced, setLlmPlaced] = useState<{ [key: number]: string }>({});
  const [llmSel, setLlmSel] = useState<number | null>(null);
  const [llmAttempts, setLlmAttempts] = useState(0);
  const [llmOk, setLlmOk] = useState(false);

  // Inicializar rightOrder y sortOrder cuando corresponda
  useEffect(() => {
    if (step === 5) {
      // Matching
      setRightOrder(pickN(matchPairs.map(p => p.right), matchPairs.length).sort(() => Math.random() - 0.5));
      setMatchLeft(null);
      setMatchDone(0);
      setMatchedLeft(new Set());
      setMatchedRight(new Set());
    }
    if (step === 9) {
      // Sort
      const order = [0, 1, 2, 3, 4];
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      setSortOrder(order);
      setSortOk(false);
    }
    if (step === 12) {
      // LLM Drag & Drop
      setLlmPlaced({});
      setLlmSel(null);
      setLlmAttempts(0);
      setLlmOk(false);
    }

  }, [step, matchPairs]);

  const addXP = (amount: number) => setXp(prev => prev + amount);

  const goToNextStep = () => {
    if (step < TOTAL_STEPS - 1) setStep(step + 1);
  };

  const handleClose = () => {
    Alert.alert('Salir', '¿Seguro que quieres salir del juego? Perderás el progreso no guardado.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', onPress: () => navigation.goBack() },
    ]);
  };

  const handleFinish = () => {
    let stars = 0;
    if (xp >= 100) stars = 3;
    else if (xp >= 70) stars = 2;
    else if (xp >= 40) stars = 1;
    completeLevel(2, stars, xp); // Nivel 2
    navigation.goBack();
  };

  // Drag & Drop (módulo 3)
  const handleChipPress3 = (idx: number) => {
    if (drag3Placed[idx] !== undefined) return;
    setDrag3Sel(drag3Sel === idx ? null : idx);
  };

  const handleDropZone3 = (zone: string) => {
    if (drag3Sel === null) return;
    if (drag3Placed[drag3Sel] !== undefined) return;
    const item = drag3Items[drag3Sel];
    if (item.correct === zone) {
      setDrag3Placed(prev => ({ ...prev, [drag3Sel]: zone }));
      setDrag3Sel(null);
    } else {
      Alert.alert('Incorrecto', `"${item.text}" no pertenece a esta categoría.`);
    }
  };

  const handleRemoveChip3 = (idx: number) => {
    setDrag3Placed(prev => {
      const newPlaced = { ...prev };
      delete newPlaced[idx];
      return newPlaced;
    });
  };

  const checkDrag3 = () => {
    if (drag3Ok) return true;
    const placedCount = Object.keys(drag3Placed).length;
    if (placedCount < drag3Items.length) {
      Alert.alert('Faltan habilidades', `Coloca todas las habilidades (${drag3Items.length - placedCount} restantes).`);
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
      Alert.alert('¡Perfecto!', `Clasificaste todos correctamente. +${earned} XP`, [{ text: 'OK', onPress: goToNextStep }]);
      return false;
    } else {
      Alert.alert('Algunas incorrectas', `${correct} de ${drag3Items.length} correctas. Las incorrectas vuelven al banco.`);
      const newPlaced = { ...drag3Placed };
      wrongIndices.forEach(i => delete newPlaced[i]);
      setDrag3Placed(newPlaced);
      return false;
    }
  };

  // LLM Drag handlers
const handleChipPressLLM = (idx: number) => {
    if (llmPlaced[idx] !== undefined) return;
    setLlmSel(llmSel === idx ? null : idx);
  };
  
  const handleDropZoneLLM = (zone: string) => {
    if (llmSel === null) return;
    if (llmPlaced[llmSel] !== undefined) return;
    const item = llmItems[llmSel];
    if (item.correct === zone) {
      setLlmPlaced(prev => ({ ...prev, [llmSel]: zone }));
      setLlmSel(null);
    } else {
      Alert.alert('Incorrecto', `"${item.text}" no corresponde a este LLM.`);
    }
  };
  
  const handleRemoveChipLLM = (idx: number) => {
    setLlmPlaced(prev => {
      const newPlaced = { ...prev };
      delete newPlaced[idx];
      return newPlaced;
    });
  };
  
  const checkLLMDrag = () => {
    if (llmOk) return true;
    const placedCount = Object.keys(llmPlaced).length;
    if (placedCount < llmItems.length) {
      Alert.alert('Faltan tareas', `Asigna todas las tareas (${llmItems.length - placedCount} restantes).`);
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
      Alert.alert('¡Perfecto!', `Asignaste todas las tareas correctamente. +${earned} XP`, [{ text: 'OK', onPress: goToNextStep }]);
      return false;
    } else {
      Alert.alert('Algunas incorrectas', `${correct} de ${llmItems.length} correctas. Las incorrectas vuelven al banco.`);
      const newPlaced = { ...llmPlaced };
      wrongIndices.forEach(i => delete newPlaced[i]);
      setLlmPlaced(newPlaced);
      return false;
    }
  };

  // Matching (módulo 5)
  const handleLeftClick = (idx: number) => {
    if (matchedLeft.has(idx)) return;
    setMatchLeft(idx);
  };

  const handleRightClick = (rightIdx: number) => {
    if (matchLeft === null) return;
    if (matchedRight.has(rightIdx)) return;
    const correctRightText = matchPairs[matchLeft].right;
    const selectedRightText = rightOrder[rightIdx];
    if (selectedRightText === correctRightText) {
      setMatchedLeft(prev => new Set(prev).add(matchLeft));
      setMatchedRight(prev => new Set(prev).add(rightIdx));
      setMatchLeft(null);
      const newCount = matchedLeft.size + 1;
      setMatchDone(newCount);
      if (newCount === matchPairs.length) {
        addXP(15);
        Alert.alert('¡Completado!', 'Conectaste todos los pares. +15 XP', [{ text: 'OK', onPress: goToNextStep }]);
      } else {
        Alert.alert('¡Correcto!', `Llevas ${newCount} de ${matchPairs.length} pares.`);
      }
    } else {
      Alert.alert('Incorrecto', 'Ese par no es correcto. Intenta de nuevo.');
      setMatchLeft(null);
    }
  };

  // Sort (módulo 9)
  const moveSort = (pos: number, dir: number) => {
    const newPos = pos + dir;
    if (newPos < 0 || newPos >= sortOrder.length) return;
    const newOrder = [...sortOrder];
    [newOrder[pos], newOrder[newPos]] = [newOrder[newPos], newOrder[pos]];
    setSortOrder(newOrder);
  };

  const checkSort = () => {
    if (sortOk) return true;
    const isOk = sortOrder.every((v, i) => v === i);
    if (isOk) {
      setSortOk(true);
      addXP(15);
      Alert.alert('¡Exacto!', 'Ese es el orden real de procesamiento de un LLM. +15 XP', [{ text: 'OK', onPress: goToNextStep }]);
      return false;
    } else {
      Alert.alert('Incorrecto', 'Algunos pasos están fuera de lugar. ¡Piensa en el orden lógico!');
      return false;
    }
  };

  // Quiz (módulo 8)
  const selectQuiz = (qIdx: number, optIdx: number) => {
    if (quizChecked) return;
    setQuizAnswers(prev => ({ ...prev, [qIdx]: optIdx }));
  };

  const checkQuiz = () => {
    if (quizChecked) return true;
    if (Object.keys(quizAnswers).length < quizQuestions.length) {
      Alert.alert('Incompleto', 'Responde todas las preguntas primero.');
      return false;
    }
    setQuizChecked(true);
    let correct = 0;
    quizQuestions.forEach((q, idx) => {
      if (quizAnswers[idx] === q.correct) correct++;
    });
    const earned = correct * 8;
    if (earned > 0) addXP(earned);
    Alert.alert('Resultado', `${correct} de ${quizQuestions.length} correctas. +${earned} XP`, [
      { text: 'OK', onPress: goToNextStep },
    ]);
    return false;
  };

  // True/False (módulo 10)
  const selectTF = (qIdx: number, val: boolean) => {
    if (tfChecked) return;
    setTfAnswers(prev => ({ ...prev, [qIdx]: val }));
  };

  const checkTF = () => {
    if (tfChecked) return true;
    if (Object.keys(tfAnswers).length < tfItems.length) {
      Alert.alert('Incompleto', 'Responde todas las afirmaciones.');
      return false;
    }
    setTfChecked(true);
    let correct = 0;
    tfItems.forEach((item, idx) => {
      if (tfAnswers[idx] === item.correct) correct++;
    });
    const earned = correct * 5;
    if (earned > 0) addXP(earned);
    Alert.alert('Resultado', `${correct} de ${tfItems.length} correctas. +${earned} XP`, [
      { text: 'OK', onPress: goToNextStep },
    ]);
    return false;
  };

  // Fill in blank (módulo 13)
  const selectFill = (idx: number) => {
    if (fillChecked) return;
    setFillSel(idx);
  };

  const checkFill = () => {
    if (fillChecked) return true;
    if (fillSel === null) {
      Alert.alert('Elige una opción', 'Selecciona la palabra correcta.');
      return false;
    }
    setFillChecked(true);
    const isOk = fillSel === fillItem.correct;
    if (isOk) {
      addXP(10);
      Alert.alert('¡Correcto!', `+10 XP. ${fillItem.explain}`, [{ text: 'OK', onPress: goToNextStep }]);
    } else {
      Alert.alert('Incorrecto', `La respuesta correcta es "${fillItem.allOpts[fillItem.correct]}". ${fillItem.explain}`, [
        { text: 'OK', onPress: goToNextStep },
      ]);
    }
    return false;
  };

  // Prompt compare (módulo 14)
  const selectPrompt = (qIdx: number, which: 'good' | 'bad') => {
    if (promptsChecked) return;
    setPromptSels(prev => ({ ...prev, [qIdx]: which }));
  };

  const checkPrompts = () => {
    if (promptsChecked) return true;
    if (Object.keys(promptSels).length < promptItems.length) {
      Alert.alert('Incompleto', 'Elige un prompt en cada situación.');
      return false;
    }
    setPromptsChecked(true);
    let correct = 0;
    promptItems.forEach((_, idx) => {
      if (promptSels[idx] === 'good') correct++;
    });
    const earned = correct * 8;
    if (earned > 0) addXP(earned);
    Alert.alert('Resultado', `${correct} de ${promptItems.length} correctas. +${earned} XP`, [
      { text: 'OK', onPress: goToNextStep },
    ]);
    return false;
  };

  // Reflexión (módulo 15)
  const checkReflect = () => {
    if (reflectText.trim().length >= 70) {
      addXP(15);
      goToNextStep();
    } else {
      Alert.alert('Muy corto', 'Escribe al menos 70 caracteres.');
    }
  };

  // ========== RENDERIZADO DE CADA PASO ==========
  const renderIntro = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>Nivel 2 · 15 módulos</Text>
      <View style={styles.iconContainer}><Text style={styles.iconEmoji}>📱</Text></View>
      <Text style={styles.title}>La IA que vive en tus apps</Text>
      <Text style={styles.subtitle}>Usas decenas de apps todos los días. Pero, ¿sabías que la IA está operando en todas ellas? Hoy vas a diseccionarlas.</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📚 Qué vas a aprender</Text>
        <Text style={styles.cardText}>Cómo decide la IA qué mostrarte · 4 tipos de IA que ya usas · Qué son los LLMs y cómo funcionan · ChatGPT, Claude, Gemini y Grok comparados · Cuándo usar un LLM vs Google · Cómo escribir un buen prompt</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>⚡ Lo nuevo</Text>
        <Text style={styles.cardText}>Tienes tu primer contacto real con los LLMs como herramientas de estudio.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🎮 15 módulos · hasta 160 XP</Text>
        <Text style={styles.cardText}>Teoría · Apps reales · Caso de vida real · Clasificar · Conectar · Quiz · Ordenar · V/F · Qué LLM usar · Vocabulario clave · Comparar prompts · Reflexión</Text>
      </View>
    </View>
  );

  const renderTheory1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>📖 Módulo 1 de 15 · Teoría</Text>
      <Text style={styles.title}>¿Cómo decide la IA qué mostrarte?</Text>
      <Text style={styles.bodyText}>Abres Instagram. En milisegundos ves una publicación que te engancha al instante. No fue casualidad. <Text style={styles.bold}>Una IA tomó esa decisión en menos de 100 milisegundos</Text>, basándose en miles de datos que tiene sobre ti.</Text>
      <View style={styles.highlightBox}>
        <Text style={styles.highlightText}><Text style={styles.bold}>❌ El mito más común:</Text> "Las redes sociales me muestran lo que está de moda." — Falso. Te muestran lo que la IA calcula que <Text style={styles.italic}>a ti específicamente</Text> te va a enganchar más tiempo.</Text>
      </View>
      <Text style={styles.sectionTitle}>¿Qué datos usa la IA para decidir?</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>👁️ Datos de comportamiento</Text>
        <Text style={styles.cardText}>Cuántos segundos exactos viste algo, si lo repetiste, si pausaste, a qué hora del día lo hiciste, si compartiste o solo cerraste.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>👥 Datos de personas similares a ti</Text>
        <Text style={styles.cardText}>La IA encontró millones de usuarios con patrones parecidos a los tuyos. Lo que a ellos les gustó... probablemente te va a gustar a ti también.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📍 Datos de contexto</Text>
        <Text style={styles.cardText}>Tu ubicación, qué dispositivo usas, qué hora es, si estás en WiFi o datos móviles.</Text>
      </View>
      <Text style={styles.sectionTitle}>El problema de la "burbuja de filtro"</Text>
      <Text style={styles.bodyText}>Cuando la IA solo te muestra contenido que le "gustó" a tu versión pasada, crea una burbuja. Ves las mismas ideas, los mismos puntos de vista. <Text style={styles.bold}>Saber esto te da poder para salir de la burbuja</Text> — busca activamente perspectivas diferentes.</Text>
    </View>
  );

  const renderExamples = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>📱 Módulo 2 de 15 · Apps reales</Text>
      <Text style={styles.title}>Disecciona 5 apps que ya conoces</Text>
      <Text style={styles.subtitle}>Aquí verías tarjetas expandibles con ejemplos (Instagram, YouTube, WhatsApp, Google Fotos, Netflix). Por brevedad, resumimos.</Text>
      {/* En una implementación completa incluirías tarjetas interactivas como en el HTML */}
    </View>
  );

  const renderDrag3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>🧩 Módulo 3 de 15 · Clasificar</Text>
      <Text style={styles.title}>¿Qué tipo de IA es esta?</Text>
      <Text style={styles.subtitle}>Clasifica cada función en su tipo de IA correcto.</Text>
      <View style={styles.chipsPool}>
        {drag3Items.map((item, idx) => {
          if (drag3Placed[idx] !== undefined) return null;
          return (
            <TouchableOpacity
              key={idx}
              style={[styles.chip, drag3Sel === idx && styles.chipSelected]}
              onPress={() => handleChipPress3(idx)}
            >
              <Text style={styles.chipText}>{item.text}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.dropCols}>
        <TouchableOpacity style={[styles.dropCol, styles.dropAI]} onPress={() => handleDropZone3('rec')}>
          <Text style={styles.dropHeader}>🟢 Recomendación</Text>
          <View style={styles.dropChips}>
            {Object.entries(drag3Placed).map(([idx, zone]) => {
              if (zone === 'rec') {
                const i = parseInt(idx);
                return (
                  <TouchableOpacity key={i} style={styles.dropChip} onPress={() => handleRemoveChip3(i)}>
                    <Text style={styles.dropChipText}>{drag3Items[i].text} ✕</Text>
                  </TouchableOpacity>
                );
              }
              return null;
            })}
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.dropCol, styles.dropAI]} onPress={() => handleDropZone3('vis')}>
          <Text style={styles.dropHeader}>🟣 Visión</Text>
          <View style={styles.dropChips}>
            {Object.entries(drag3Placed).map(([idx, zone]) => {
              if (zone === 'vis') {
                const i = parseInt(idx);
                return (
                  <TouchableOpacity key={i} style={styles.dropChip} onPress={() => handleRemoveChip3(i)}>
                    <Text style={styles.dropChipText}>{drag3Items[i].text} ✕</Text>
                  </TouchableOpacity>
                );
              }
              return null;
            })}
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.dropCol, styles.dropAI]} onPress={() => handleDropZone3('nlp')}>
          <Text style={styles.dropHeader}>🔵 Lenguaje</Text>
          <View style={styles.dropChips}>
            {Object.entries(drag3Placed).map(([idx, zone]) => {
              if (zone === 'nlp') {
                const i = parseInt(idx);
                return (
                  <TouchableOpacity key={i} style={styles.dropChip} onPress={() => handleRemoveChip3(i)}>
                    <Text style={styles.dropChipText}>{drag3Items[i].text} ✕</Text>
                  </TouchableOpacity>
                );
              }
              return null;
            })}
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.dropCol, styles.dropAI]} onPress={() => handleDropZone3('gen')}>
          <Text style={styles.dropHeader}>🟡 Generativa</Text>
          <View style={styles.dropChips}>
            {Object.entries(drag3Placed).map(([idx, zone]) => {
              if (zone === 'gen') {
                const i = parseInt(idx);
                return (
                  <TouchableOpacity key={i} style={styles.dropChip} onPress={() => handleRemoveChip3(i)}>
                    <Text style={styles.dropChipText}>{drag3Items[i].text} ✕</Text>
                  </TouchableOpacity>
                );
              }
              return null;
            })}
          </View>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.checkButton} onPress={checkDrag3}>
        <Text style={styles.checkButtonText}>Verificar clasificación</Text>
      </TouchableOpacity>
    </View>
  );

  const renderTheory2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>📖 Módulo 4 de 15 · Tipos de IA</Text>
      <Text style={styles.title}>Los 4 tipos de IA que ya usas</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🟢 IA de Recomendación</Text>
        <Text style={styles.cardText}>Predice qué contenido, producto o persona te va a gustar. Apps: TikTok, YouTube, Spotify, Netflix, Amazon, Instagram.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🟣 IA de Visión por Computadora</Text>
        <Text style={styles.cardText}>Analiza y entiende imágenes y video. Apps: Face ID, Google Fotos, modo retrato, Google Lens, filtros de Snapchat.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🔵 IA de Procesamiento de Lenguaje (NLP)</Text>
        <Text style={styles.cardText}>Lee, entiende y genera texto. Apps: ChatGPT, Claude, Google Translate, autocorrector, Siri, Alexa.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🟡 IA Generativa (GenAI)</Text>
        <Text style={styles.cardText}>Crea contenido nuevo: texto, imágenes, música, video, código. Apps: ChatGPT, Claude, Gemini, DALL·E, Midjourney, Suno, ElevenLabs.</Text>
      </View>
    </View>
  );

  const renderMatching = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>🔗 Módulo 5 de 15 · Conectar</Text>
      <Text style={styles.title}>App + tipo de IA</Text>
      <Text style={styles.subtitle}>Conecta cada app con la descripción exacta de la IA que usa.</Text>
      <View style={styles.matchColumns}>
        <View style={styles.matchLeftColumn}>
          {matchPairs.map((pair, leftIdx) => (
            <TouchableOpacity
              key={leftIdx}
              style={[styles.matchLeftCard, matchLeft === leftIdx && styles.matchSelected, matchedLeft.has(leftIdx) && styles.matchMatched]}
              onPress={() => handleLeftClick(leftIdx)}
              disabled={matchedLeft.has(leftIdx)}
            >
              <Text style={styles.matchText}>{pair.left}</Text>
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
              <Text style={styles.matchText}>{rightText}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  const renderTheoryLLM = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>📖 Módulo 6 de 15 · LLMs</Text>
      <Text style={styles.title}>¿Qué son los Modelos de Lenguaje (LLMs)?</Text>
      <Text style={styles.bodyText}>LLM significa Large Language Model. Son el tipo de IA detrás de ChatGPT, Claude, Gemini y Grok.</Text>
      <View style={styles.vsGrid}>
        <View style={styles.vsCol}>
          <Text style={styles.vsHeader}>🔍 Google Search</Text>
          <Text style={styles.vsItem}>Busca páginas que ya existen</Text>
          <Text style={styles.vsItem}>Devuelve links, tú lees</Text>
          <Text style={styles.vsItem}>Información en tiempo real</Text>
          <Text style={styles.vsItem}>No crea nada nuevo</Text>
        </View>
        <View style={styles.vsCol}>
          <Text style={styles.vsHeader}>🤖 LLM (ChatGPT, Claude...)</Text>
          <Text style={styles.vsItem}>Genera texto nuevo en respuesta</Text>
          <Text style={styles.vsItem}>Conversa contigo directamente</Text>
          <Text style={styles.vsItem}>Conocimiento hasta cierta fecha</Text>
          <Text style={styles.vsItem}>Crea, explica, analiza, resume</Text>
        </View>
      </View>
      <View style={styles.highlightBox}>
        <Text style={styles.highlightText}><Text style={styles.bold}>⚠️ El error más peligroso:</Text> Usar un LLM para buscar datos en tiempo real (precios, noticias, resultados deportivos). Los LLMs no acceden a internet — su conocimiento viene de lo que aprendieron hasta cierta fecha.</Text>
      </View>
    </View>
  );

  const renderCase = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>🎯 Módulo 7 de 15 · Caso real</Text>
      <Text style={styles.title}>Sebastián: estudiante de 15 años en Medellín</Text>
      <Text style={styles.subtitle}>Así es como un estudiante usa los LLMs en su vida real — los buenos y los malos usos.</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>✅ Uso correcto #1 — Entender, no copiar</Text>
        <Text style={styles.cardText}>Le pide a Claude: "Explícame las causas del cambio climático como si tuviera 15 años, con 3 ejemplos de Colombia específicamente." Toma notas y escribe el trabajo con sus propias palabras.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>✅ Uso correcto #2 — Práctica personalizada</Text>
        <Text style={styles.cardText}>Le pide a ChatGPT: "Dame 10 ejercicios de ecuaciones cuadráticas de menor a mayor dificultad, y explícame paso a paso los que me cuesten más trabajo."</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>❌ Mal uso — Copiar y entregar</Text>
        <Text style={styles.cardText}>Le pide a ChatGPT que escriba el trabajo completo y lo entrega tal cual. Resultado: no aprendió nada.</Text>
      </View>
    </View>
  );

  const renderQuiz = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>❓ Módulo 8 de 15 · Quiz</Text>
      <Text style={styles.title}>¿Buscador o LLM? ¿Cuándo usar cuál?</Text>
      {quizQuestions.map((q, qIdx) => (
        <View key={qIdx} style={styles.quizCard}>
          <Text style={styles.quizQuestion}>{qIdx+1}. {q.q}</Text>
          {q.opts.map((opt, optIdx) => (
            <TouchableOpacity
              key={optIdx}
              style={[styles.quizOption, quizAnswers[qIdx] === optIdx && styles.quizOptionSelected]}
              onPress={() => selectQuiz(qIdx, optIdx)}
              disabled={quizChecked}
            >
              <Text style={styles.quizLetter}>{String.fromCharCode(65+optIdx)}</Text>
              <Text style={styles.quizOptText}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
      <TouchableOpacity style={styles.checkButton} onPress={checkQuiz}>
        <Text style={styles.checkButtonText}>Comprobar respuestas</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSort = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>↕️ Módulo 9 de 15 · Ordenar</Text>
      <Text style={styles.title}>El camino de tu pregunta en un LLM</Text>
      <Text style={styles.subtitle}>Ordena los pasos con ▲▼.</Text>
      {sortOrder.map((stepIdx, pos) => (
        <View key={pos} style={styles.sortItem}>
          <Text style={styles.sortNum}>{pos+1}</Text>
          <Text style={styles.sortText}>{LLM_SORT_STEPS[stepIdx]}</Text>
          <View style={styles.sortArrows}>
            <TouchableOpacity style={styles.sortBtn} onPress={() => moveSort(pos, -1)} disabled={pos === 0}>
              <MaterialIcons name="keyboard-arrow-up" size={20} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.sortBtn} onPress={() => moveSort(pos, 1)} disabled={pos === sortOrder.length-1}>
              <MaterialIcons name="keyboard-arrow-down" size={20} />
            </TouchableOpacity>
          </View>
        </View>
      ))}
      <TouchableOpacity style={styles.checkButton} onPress={checkSort}>
        <Text style={styles.checkButtonText}>Verificar orden</Text>
      </TouchableOpacity>
    </View>
  );

  const renderTF = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>✅ Módulo 10 de 15 · V/F</Text>
      <Text style={styles.title}>Mitos y realidades de los LLMs</Text>
      {tfItems.map((item, idx) => (
        <View key={idx} style={styles.tfSet}>
          <Text style={styles.tfQuestion}>{idx+1}. {item.stmt}</Text>
          <View style={styles.tfOpts}>
            <TouchableOpacity style={[styles.tfBtn, tfAnswers[idx] === true && styles.tfBtnTrue]} onPress={() => selectTF(idx, true)} disabled={tfChecked}>
              <Text>✅ Verdadero</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tfBtn, tfAnswers[idx] === false && styles.tfBtnFalse]} onPress={() => selectTF(idx, false)} disabled={tfChecked}>
              <Text>❌ Falso</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
      <TouchableOpacity style={styles.checkButton} onPress={checkTF}>
        <Text style={styles.checkButtonText}>Comprobar</Text>
      </TouchableOpacity>
    </View>
  );

  const renderLLMCompare = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>📖 Módulo 11 de 15 · Los 4 LLMs</Text>
      <Text style={styles.title}>ChatGPT, Claude, Gemini y Grok</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>💬 ChatGPT (OpenAI)</Text>
        <Text style={styles.cardText}>El más popular y conocido. Muy versátil. Puede generar imágenes con DALL·E integrado.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🌟 Claude (Anthropic)</Text>
        <Text style={styles.cardText}>Excelente para textos muy largos (lee documentos de 200+ páginas), análisis profundos y razonamiento complejo.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>✦ Gemini (Google)</Text>
        <Text style={styles.cardText}>Integrado con el ecosistema de Google. Puede acceder a información actualizada.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>𝕏 Grok (xAI / X)</Text>
        <Text style={styles.cardText}>Integrado con X (antes Twitter). Tiene un estilo más directo y menos filtros.</Text>
      </View>
    </View>
  );

  const renderLLMDrag = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>🧩 Módulo 12 de 15 · ¿Qué LLM usarías?</Text>
      <Text style={styles.title}>Asigna la herramienta correcta</Text>
      <Text style={styles.subtitle}>Arrastra cada tarea al LLM más adecuado.</Text>
      <View style={styles.chipsPool}>
        {llmItems.map((item, idx) => {
          if (llmPlaced[idx] !== undefined) return null;
          return (
            <TouchableOpacity
              key={idx}
              style={[styles.chip, llmSel === idx && styles.chipSelected]}
              onPress={() => handleChipPressLLM(idx)}
            >
              <Text style={styles.chipText}>{item.text}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.dropCols}>
        <TouchableOpacity style={[styles.dropCol, styles.dropAI]} onPress={() => handleDropZoneLLM('claude')}>
          <Text style={styles.dropHeader}>🌟 Claude</Text>
          <View style={styles.dropChips}>
            {Object.entries(llmPlaced).map(([idx, zone]) => {
              if (zone === 'claude') {
                const i = parseInt(idx);
                return (
                  <TouchableOpacity key={i} style={styles.dropChip} onPress={() => handleRemoveChipLLM(i)}>
                    <Text style={styles.dropChipText}>{llmItems[i].text} ✕</Text>
                  </TouchableOpacity>
                );
              }
              return null;
            })}
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.dropCol, styles.dropAI]} onPress={() => handleDropZoneLLM('chatgpt')}>
          <Text style={styles.dropHeader}>💬 ChatGPT</Text>
          <View style={styles.dropChips}>
            {Object.entries(llmPlaced).map(([idx, zone]) => {
              if (zone === 'chatgpt') {
                const i = parseInt(idx);
                return (
                  <TouchableOpacity key={i} style={styles.dropChip} onPress={() => handleRemoveChipLLM(i)}>
                    <Text style={styles.dropChipText}>{llmItems[i].text} ✕</Text>
                  </TouchableOpacity>
                );
              }
              return null;
            })}
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.dropCol, styles.dropAI]} onPress={() => handleDropZoneLLM('gemini')}>
          <Text style={styles.dropHeader}>✦ Gemini</Text>
          <View style={styles.dropChips}>
            {Object.entries(llmPlaced).map(([idx, zone]) => {
              if (zone === 'gemini') {
                const i = parseInt(idx);
                return (
                  <TouchableOpacity key={i} style={styles.dropChip} onPress={() => handleRemoveChipLLM(i)}>
                    <Text style={styles.dropChipText}>{llmItems[i].text} ✕</Text>
                  </TouchableOpacity>
                );
              }
              return null;
            })}
          </View>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.checkButton} onPress={checkLLMDrag}>
        <Text style={styles.checkButtonText}>Verificar asignación</Text>
      </TouchableOpacity>
    </View>
  );

  const renderVocab = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>💬 Módulo 13 de 15 · Vocabulario IA</Text>
      <Text style={styles.title}>El vocabulario que necesitas</Text>
      <Text style={styles.subtitle}>Completa la definición:</Text>
      <View style={styles.fillSentence}>
        <Text>{fillItem.sentence.replace('<b>___</b>', '_____')}</Text>
      </View>
      <View style={styles.fillOpts}>
        {fillItem.allOpts.map((opt, idx) => (
          <TouchableOpacity
            key={idx}
            style={[styles.fillOpt, fillSel === idx && styles.fillOptSelected]}
            onPress={() => selectFill(idx)}
            disabled={fillChecked}
          >
            <Text>{opt}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={styles.checkButton} onPress={checkFill}>
        <Text style={styles.checkButtonText}>Verificar respuesta</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPromptCompare = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>🔍 Módulo 14 de 15 · Prompts</Text>
      <Text style={styles.title}>¿Cuál prompt es mejor?</Text>
      {promptItems.map((item, idx) => (
        <View key={idx} style={styles.promptSet}>
          <Text style={styles.promptTask}>🎯 Tarea: {item.task}</Text>
          <TouchableOpacity
            style={[styles.promptCard, promptSels[idx] === 'bad' && styles.promptCardSelected]}
            onPress={() => selectPrompt(idx, 'bad')}
            disabled={promptsChecked}
          >
            <Text style={styles.promptLabel}>Prompt A:</Text>
            <Text style={styles.promptText}>{item.bad}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.promptCard, promptSels[idx] === 'good' && styles.promptCardSelected]}
            onPress={() => selectPrompt(idx, 'good')}
            disabled={promptsChecked}
          >
            <Text style={styles.promptLabel}>Prompt B:</Text>
            <Text style={styles.promptText}>{item.good}</Text>
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity style={styles.checkButton} onPress={checkPrompts}>
        <Text style={styles.checkButtonText}>Comprobar elecciones</Text>
      </TouchableOpacity>
    </View>
  );

  const renderReflect = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>✍️ Reflexión final · +15 XP</Text>
      <Text style={styles.title}>¿Cómo vas a usar esto a partir de hoy?</Text>
      <Text style={styles.subtitle}>Piensa en una app que usarás diferente y una tarea donde usarás un LLM correctamente.</Text>
      <TextInput
        style={styles.textArea}
        multiline
        numberOfLines={6}
        placeholder="Escribe tu reflexión (mínimo 70 caracteres)..."
        value={reflectText}
        onChangeText={setReflectText}
      />
      <Text style={styles.charCount}>{reflectText.trim().length} / 70 mínimo</Text>
      <TouchableOpacity style={styles.checkButton} onPress={checkReflect}>
        <Text style={styles.checkButtonText}>Enviar reflexión</Text>
      </TouchableOpacity>
    </View>
  );

  const renderCompletion = () => (
    <View style={styles.completeContainer}>
      <Text style={styles.completeBadgeText}>🎖️</Text>
      <Text style={styles.completeTitle}>¡Nivel 2 completado!</Text>
      <Text style={styles.completeSub}>Terminaste "La IA que vive en tus apps". Ahora ves las apps de otra manera — y tienes tu primera brújula para usar los LLMs correctamente.</Text>
      <Text style={styles.xpEarnedText}>⭐ {xp} XP ganados en este nivel</Text>
      <TouchableOpacity style={styles.nextLevelButton} onPress={handleFinish}>
        <Text style={styles.nextLevelText}>Volver al mapa</Text>
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
  const showNextButton = step < TOTAL_STEPS - 1 && ![3,5,8,9,10,12,13,14,15].includes(step);

  return (
    <View style={styles.screen}>
      <View style={styles.progressBar}>
        <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
          <MaterialIcons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>
        <Text style={styles.xpText}>{xp} XP</Text>
      </View>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {renderContent()}
      </ScrollView>
      {showNextButton && (
        <TouchableOpacity style={styles.nextButton} onPress={goToNextStep}>
          <Text style={styles.nextButtonText}>Continuar →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  progressBar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  closeBtn: { padding: 4 },
  progressTrack: { flex: 1, height: 6, backgroundColor: colors.borderLight, borderRadius: 3, marginHorizontal: 12 },
  progressFill: { height: '100%', backgroundColor: colors.success, borderRadius: 3 },
  xpText: { ...typography.bold, fontSize: 14, color: colors.accentDark },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  stepContainer: { flex: 1 },
  tag: { fontSize: 11, fontWeight: '600', color: colors.primary, backgroundColor: '#eef2ff', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 12 },
  iconContainer: { width: 60, height: 60, borderRadius: 18, backgroundColor: '#eef2ff', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  iconEmoji: { fontSize: 30 },
  title: { ...typography.extraBold, fontSize: 19, color: colors.textPrimary, marginBottom: 6 },
  subtitle: { ...typography.regular, fontSize: 13, color: colors.textSecondary, marginBottom: 14, lineHeight: 18 },
  bodyText: { ...typography.regular, fontSize: 13, color: colors.textPrimary, lineHeight: 20, marginBottom: 12 },
  bold: { fontWeight: 'bold' },
  italic: { fontStyle: 'italic' },
  sectionTitle: { ...typography.bold, fontSize: 14, color: colors.textPrimary, marginTop: 16, marginBottom: 8 },
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  cardTitle: { ...typography.bold, fontSize: 13, color: colors.textPrimary, marginBottom: 6 },
  cardText: { ...typography.regular, fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
  highlightBox: { borderLeftWidth: 3, borderLeftColor: colors.error, padding: 11, backgroundColor: '#fff1f2', marginVertical: 10, borderRadius: 4 },
  highlightText: { ...typography.regular, fontSize: 13, color: '#991b1b', lineHeight: 20 },
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
  nextButton: { backgroundColor: colors.success, padding: 14, margin: 16, borderRadius: 11, alignItems: 'center' },
  nextButtonText: { ...typography.bold, color: '#fff', fontSize: 15 },
  matchColumns: { flexDirection: 'row', gap: 12, marginTop: 12 },
  matchLeftColumn: { flex: 1, gap: 8 },
  matchRightColumn: { flex: 1, gap: 8 },
  matchLeftCard: { backgroundColor: '#eff6ff', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#bfdbfe' },
  matchRightCard: { backgroundColor: '#fdf4ff', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e9d5ff' },
  matchSelected: { borderColor: colors.primary, borderWidth: 2 },
  matchMatched: { backgroundColor: '#dcfce7', borderColor: colors.success },
  matchText: { ...typography.regular, fontSize: 12, color: colors.textPrimary },
  vsGrid: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  vsCol: { flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border },
  vsHeader: { ...typography.bold, fontSize: 12, marginBottom: 8, textAlign: 'center' },
  vsItem: { ...typography.regular, fontSize: 11, color: colors.textPrimary, marginBottom: 4 },
  quizCard: { marginBottom: 16 },
  quizQuestion: { ...typography.bold, fontSize: 14, color: colors.textPrimary, marginBottom: 8, padding: 12, backgroundColor: colors.surfaceVariant, borderRadius: 10 },
  quizOption: { flexDirection: 'row', alignItems: 'center', padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 11, marginBottom: 6, gap: 10 },
  quizOptionSelected: { borderColor: colors.primary, backgroundColor: '#eff6ff' },
  quizLetter: { width: 26, height: 26, borderRadius: 8, backgroundColor: '#f3f4f6', textAlign: 'center', lineHeight: 26, ...typography.bold },
  quizOptText: { flex: 1, ...typography.regular, fontSize: 13, color: colors.textPrimary },
  sortItem: { flexDirection: 'row', alignItems: 'center', padding: 11, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  sortNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, color: '#fff', textAlign: 'center', lineHeight: 26, ...typography.bold, fontSize: 11, marginRight: 9 },
  sortText: { flex: 1, ...typography.regular, fontSize: 12, color: colors.textPrimary },
  sortArrows: { flexDirection: 'column', gap: 3 },
  sortBtn: { width: 28, height: 26, borderRadius: 7, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
  tfSet: { marginBottom: 14 },
  tfQuestion: { ...typography.bold, fontSize: 13, color: colors.textPrimary, marginBottom: 8, padding: 11, backgroundColor: colors.surfaceVariant, borderRadius: 10 },
  tfOpts: { flexDirection: 'row', gap: 7 },
  tfBtn: { flex: 1, padding: 12, borderRadius: 11, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center' },
  tfBtnTrue: { borderColor: colors.success, backgroundColor: '#f0fdf4' },
  tfBtnFalse: { borderColor: colors.error, backgroundColor: '#fff1f2' },
  fillSentence: { backgroundColor: '#f0f9ff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#bae6fd', marginBottom: 11 },
  fillOpts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  fillOpt: { padding: 8, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  fillOptSelected: { borderColor: colors.primary, backgroundColor: '#e0f2fe' },
  promptSet: { marginBottom: 16 },
  promptTask: { ...typography.bold, fontSize: 12, marginBottom: 8, padding: 8, backgroundColor: colors.surfaceVariant, borderRadius: 9 },
  promptCard: { borderRadius: 12, padding: 12, borderWidth: 2, borderColor: colors.border, marginBottom: 8 },
  promptCardSelected: { borderColor: colors.primary, backgroundColor: '#f0f9ff' },
  promptLabel: { ...typography.bold, fontSize: 10, textTransform: 'uppercase', marginBottom: 6 },
  promptText: { ...typography.regular, fontSize: 12, color: colors.textPrimary, lineHeight: 1.6, backgroundColor: colors.surfaceVariant, padding: 9, borderRadius: 8 },
  textArea: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, ...typography.regular, fontSize: 13, color: colors.textPrimary, textAlignVertical: 'top', minHeight: 100, backgroundColor: '#fafafa' },
  charCount: { ...typography.regular, fontSize: 11, color: colors.textSecondary, textAlign: 'right', marginTop: 4 },
  completeContainer: { alignItems: 'center', padding: 20 },
  completeBadgeText: { fontSize: 44, marginBottom: 14 },
  completeTitle: { ...typography.extraBold, fontSize: 21, color: colors.textPrimary, marginBottom: 6 },
  completeSub: { ...typography.regular, fontSize: 12, color: colors.textSecondary, textAlign: 'center', lineHeight: 1.7, marginBottom: 16 },
  xpEarnedText: { ...typography.bold, fontSize: 15, color: colors.accentDark, marginBottom: 14 },
  nextLevelButton: { backgroundColor: colors.primary, padding: 14, borderRadius: 11, width: '100%', alignItems: 'center' },
  nextLevelText: { ...typography.bold, color: '#fff' },
});