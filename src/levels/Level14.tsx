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

// ===================== PALETA (hex exactos del HTML nivel-14, tema oscuro teal M3) =====================
const C = {
  bg: '#020f12', surface: '#041a1f', card: '#062028', card2: '#092b34',
  text: '#e0f7fa', muted: '#80cbc4', border: '#0d3d4a',
  teal: '#00bcd4', tealLight: '#4dd0e1', cyan: '#00e5ff', emerald: '#00897b',
  green: '#22c55e', okBg: '#052e16', okBorder: '#16a34a', okText: '#86efac',
  red: '#ef4444', failBg: '#2d0707', failBorder: '#dc2626', failText: '#fca5a5',
  yellow: '#f59e0b',
  placeholder: '#4d7a80',
};

// ===================== HELPERS =====================
const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

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

function containsTopic(text: string, terms: string[]): boolean {
  const t = normalize(text);
  return terms.some(term =>
    term.length <= 3 ? new RegExp(`\\b${term}\\b`).test(t) : t.includes(term)
  );
}

// Diccionarios de tema para validar los builders
const VOICE_TERMS = ['voz', 'voces', 'tono', 'acento', 'ritmo', 'velocidad', 'emocion', 'emociones', 'personalidad', 'asistente', 'nombre', 'grave', 'agudo', 'calmado', 'animad', 'habla', 'sonido', 'suena'];
const SONG_TERMS = ['cancion', 'canta', 'musica', 'genero', 'rock', 'pop', 'cumbia', 'reggaeton', 'rap', 'jazz', 'balada', 'letra', 'estrofa', 'verso', 'coro', 'mood', 'ritmo', 'melodia', 'alegr', 'triste', 'romantic', 'energic'];
const REFLECT_TERMS = ['ia', 'audio', 'voz', 'voces', 'musica', 'cancion', 'futuro', 'riesgo', 'peligro', 'ley', 'leyes', 'regla', 'reglas', 'fraude', 'estafa', 'clonar', 'clon', 'emociona', 'preocupa', 'permiso', 'consentimiento', 'deepfake'];

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let j = a.length - 1; j > 0; j--) {
    const k = Math.floor(Math.random() * (j + 1));
    [a[j], a[k]] = [a[k], a[j]];
  }
  return a;
}
function shuffleOpts<T extends { options: string[]; correct: number }>(q: T): T {
  const paired = q.options.map((opt, i) => ({ opt, isCorrect: i === q.correct }));
  const sh = shuffle(paired);
  return { ...q, options: sh.map(p => p.opt), correct: sh.findIndex(p => p.isCorrect) };
}

// ===================== DATOS (fieles al HTML nivel-14) =====================
type QuizMod = { title: string; question: string; options: string[]; correct: number; feedback: string };

// Quizzes (opciones balanceadas en longitud — la correcta no debe ser siempre la más larga)
const QUIZZES: Record<number, QuizMod> = {
  4: {
    title: 'Whisper en acción',
    question: 'Lena, una estudiante de Alemania, quiere transcribir automáticamente las entrevistas de su proyecto de periodismo escolar. La IA de OpenAI llamada "Whisper" es perfecta para esto. ¿Qué hace exactamente Whisper?',
    options: [
      'Genera música de fondo para acompañar el video final de la entrevista',
      'Convierte el audio hablado en texto escrito de forma automática',
      'Traduce idiomas en tiempo real durante una llamada telefónica',
      'Mejora la calidad del audio eliminando todo el ruido de fondo',
    ],
    correct: 1,
    feedback: 'Whisper es un modelo de transcripción: convierte lo que dices en texto. Es tan preciso que funciona bien con acentos variados, incluyendo el español latinoamericano.',
  },
  9: {
    title: 'La voz falsa peligrosa',
    question: 'Sebastián en Chile recibe una llamada de alguien que suena exactamente como su papá, diciendo que está en un accidente y necesita dinero urgente. ¿Cuál es la respuesta más inteligente?',
    options: [
      'Enviar el dinero de inmediato porque la voz suena idéntica a la de su papá',
      'Colgar y llamar directamente a su papá al número que él ya conoce para verificar',
      'Pedir que le manden una foto del accidente y después enviar el dinero solicitado',
      'Preguntar el número de cuenta y transferir el dinero para resolverlo rápido',
    ],
    correct: 1,
    feedback: 'Las estafas con voz clonada ya existen y son muy convincentes. La regla de oro: NUNCA actúes sobre información urgente sin verificar directamente con la persona por un canal que tú controles.',
  },
  10: {
    title: 'Detecta la voz artificial',
    question: '¿Cuál de estas señales es una pista real de que podrías estar escuchando una voz de IA?',
    options: [
      'La persona habla sin ningún acento regional, porque las IA todavía no logran imitar acentos',
      'El ritmo suena demasiado uniforme y perfecto, sin las pequeñas vacilaciones del habla humana',
      'La persona usa palabras muy difíciles y técnicas, porque las IA dominan el vocabulario avanzado',
      'El audio tiene demasiado ruido de fondo, porque las IA siempre generan un sonido muy limpio',
    ],
    correct: 1,
    feedback: 'Las voces de IA a veces se delatan por el ritmo demasiado uniforme, sin las pequeñas vacilaciones, "eehh" y variaciones naturales del habla humana. ¡Los humanos somos imperfectos, y eso es una ventaja!',
  },
  16: {
    title: 'IA de audio y accesibilidad',
    question: 'Aisha tiene esclerosis lateral amiotrófica (ELA), una enfermedad que le quitó la capacidad de hablar pero conserva todos sus recuerdos y pensamientos. ¿Cómo podría ayudarle la IA de audio?',
    options: [
      'No puede ayudarle de ninguna forma, porque la IA no entiende de enfermedades ni medicina',
      'Clonar la voz que tenía antes, para que un lector hable con SU voz real',
      'Solo serviría para traducir sus pensamientos escritos al inglés y a varios idiomas extranjeros',
      'La IA no puede comunicarse con personas que tienen discapacidades motoras o del habla grave',
    ],
    correct: 1,
    feedback: 'Esto es real: el astrofísico Stephen Hawking usó durante años un sintetizador de voz. Hoy, con IA, Aisha podría conservar SU voz original — su identidad vocal — para comunicarse. ElevenLabs tiene un programa especial para esto.',
  },
  18: {
    title: 'Quiz de cierre',
    question: 'Tu profesor de Arte quiere crear un audiolibro de los cuentos que escriben los estudiantes, con las voces de los propios estudiantes pero sin tener que grabar durante horas. ¿Cuál es la solución más inteligente con IA?',
    options: [
      'Contratar actores de doblaje profesionales para que graben en un estudio todos los cuentos escritos',
      'Grabar unos minutos de la voz de cada estudiante y clonarla con ElevenLabs para narrar',
      'Usar la misma voz genérica de robot para todos los cuentos del audiolibro de la clase',
      'Escribir los cuentos en papel y pedir a un voluntario que los lea en voz alta',
    ],
    correct: 1,
    feedback: 'Con los clones de voz de cada estudiante, el audiolibro final sonaría como si cada uno hubiera narrado su propio cuento. Esto se puede hacer hoy con herramientas gratuitas o de bajo costo.',
  },
};

// Módulo 2 · Matching
const MATCH_PAIRS = [
  { left: '🎙️ Locutor de radio profesional', right: 'Voz humana entrenada, con imperfecciones naturales' },
  { left: '🤖 ElevenLabs Clone', right: 'Voz sintética que aprende de grabaciones de una persona' },
  { left: '📱 Siri / Google Assistant', right: 'IA de voz simple, diseñada para comandos cortos' },
  { left: '🎧 Audiolibro narrado por IA', right: 'Narración larga generada sin actor humano' },
];

// Módulo 6 · Clasificador (uso válido / problemático)
const CLASSIFY_ITEMS = [
  { text: 'Un escritor crea un audiolibro de su novela con su propia voz clonada', correct: 'ok', feedback: '✅ Totalmente válido. El creador usa su propia voz con su propio permiso.' },
  { text: 'Alguien clona la voz de su abuela para que pueda "hablar" después de su muerte', correct: 'ok', feedback: '✅ Con consentimiento previo, esto puede ser un bello proyecto de legado digital.' },
  { text: 'Una persona crea audio falso de un político diciendo cosas que nunca dijo', correct: 'bad', feedback: '⚠️ Esto es desinformación y puede ser ilegal. Crear deepfakes de voz sin consentimiento está prohibido en muchos países.' },
  { text: 'Una empresa usa voz de IA para hacer llamadas falsas de "tu banco" y robarte datos', correct: 'bad', feedback: '🚨 Esto es una estafa. Las IA de voz ya se usan en fraudes telefónicos reales. ¡Nunca des datos por teléfono sin verificar!' },
  { text: 'Un estudiante con parálisis usa IA para generar su voz y poder comunicarse', correct: 'ok', feedback: '✅ Uso extraordinario. La IA de voz está transformando la vida de personas con discapacidades del habla.' },
];

// Módulo 12 · Verdadero/Falso
const VF_ITEMS_1 = [
  { text: 'Con ElevenLabs puedes clonar tu propia voz y está completamente prohibido.', correct: false, feedback: 'FALSO. Clonar tu propia voz para uso personal es totalmente legal. Lo problemático es clonar la voz de OTRAS personas sin su permiso.' },
  { text: 'La IA puede crear música en géneros que ella misma "inventa", mezclando estilos que nunca existieron.', correct: true, feedback: 'VERDADERO. Las IA pueden generar estilos musicales híbridos completamente nuevos que no tienen nombre. ¡Su creatividad puede ir más allá de los géneros conocidos!' },
  { text: 'Una llamada telefónica con voz de IA siempre puede detectarse fácilmente.', correct: false, feedback: 'FALSO. Las mejores IA de voz son extremadamente difíciles de detectar, especialmente con conexiones telefónicas de baja calidad que reducen la nitidez de las señales.' },
];

// Módulo 14 · ¿Legal o ilegal?
const VF_ITEMS_2 = [
  { text: 'Usar la voz clonada de un cantante famoso para hacer que "cante" tu canción y venderla sin permiso.', correct: false, feedback: 'FALSO que sea legal. Esto viola los derechos de imagen y voz del artista. Necesitas permiso explícito. Ya hay demandas legales reales por esto.' },
  { text: 'Crear un podcast donde usas tu propia voz clonada para que "lea" artículos mientras tú descansas.', correct: true, feedback: 'VERDADERO que es legal. Tu voz, tu contenido, tu decisión. Es perfectamente válido automatizar tu propio trabajo creativo.' },
  { text: 'Una empresa puede usar fragmentos de tu voz de una llamada de servicio al cliente para entrenar su IA.', correct: false, feedback: 'FALSO. En muchos países esto requiere consentimiento explícito. El GDPR en Europa y otras leyes de privacidad lo regulan. ¡Lee los términos de servicio!' },
];

// Módulo 17 · Ordena por sofisticación (de la más básica a la más avanzada).
// El índice del array = posición correcta. Los años NO se muestran durante el ejercicio
// (para no poder adivinar el orden); se revelan como dato curioso solo al acertar.
const SORT_ITEMS: { text: string; reveal: string }[] = [
  { text: 'Una máquina imita sonidos de voz, muy robóticos', reveal: '1939 · Primer sintetizador de voz mecánico' },
  { text: 'La computadora lee un texto en voz alta y plana', reveal: '1961 · IBM crea el primer sistema de texto a voz' },
  { text: 'El teléfono empieza a escribir lo que le dictas', reveal: '1990 · Dragon: reconocimiento de voz' },
  { text: 'Un asistente entiende y responde tus preguntas', reveal: '2011 · Siri llega al iPhone' },
  { text: 'La IA copia la voz exacta de una persona', reveal: '2022 · ElevenLabs: clonación de voz de alta calidad' },
  { text: 'Escribes una idea y la IA crea una canción entera', reveal: '2023 · Suno compone canciones completas' },
];

// Builders (intro + caja + ejemplo + placeholder + feedback)
const BUILDERS: Record<number, { icon: string; label: string; title: string; intro: string; box: string; example?: string; outro?: string; placeholder: string; fb: string; terms: string[]; topicMsg: string }> = {
  5: {
    icon: '✏️', label: 'Constructor', title: 'Crea la voz perfecta para tu asistente',
    intro: 'Si pudieras diseñar la voz de tu asistente de IA personal, ¿cómo sería? Define estas características:',
    box: '🎚️ Tono: ¿Grave y serio? ¿Agudo y jovial?\n⚡ Velocidad: ¿Rápido y energético? ¿Pausado y tranquilizador?\n🌍 Acento: ¿Colombia? ¿España? ¿México? ¿Sin acento regional?\n😊 Emoción: ¿Entusiasta? ¿Calmado? ¿Profesional? ¿Divertido?\n📛 Nombre y personalidad: ¿Cómo se llama? ¿Quién es?',
    example: '"Mi asistente se llama ARIA, habla con tono medio-agudo, ritmo moderado, acento neutro latinoamericano, siempre suena optimista y animada. Es como una amiga mayor que sabe de todo."',
    placeholder: 'Describe la voz y personalidad de tu asistente de IA ideal...',
    fb: '🎤 ¡Diseño increíble! Eso es exactamente lo que hacen los ingenieros de producto en empresas como Apple o Amazon cuando crean asistentes de voz.',
    terms: VOICE_TERMS, topicMsg: 'Describe la voz: tono, velocidad, acento, emoción o personalidad de tu asistente.',
  },
  8: {
    icon: '🎵', label: 'Constructor', title: 'Tu primera canción con IA',
    intro: 'Escribe el prompt para tu canción. Incluye:',
    box: '🎸 Género musical: rock, pop, cumbia, reggaeton, rap, jazz...\n📖 Tema de la letra: ¿de qué habla la canción?\n😊 Mood / emoción: alegre, melancólico, energético, romántico\n🎤 Primera estrofa (opcional): escribe al menos 2 versos',
    example: '"Cumbia colombiana tropical, sobre un estudiante de Medellín que sueña con ser astronauta, mood alegre y esperanzador. Primera estrofa: \'Mirando las estrellas desde el barrio / soñando que algún día podré volar...\'"',
    placeholder: 'Describe tu canción: género + tema + mood + versos iniciales...',
    fb: '🎵 ¡Ese prompt generaría una canción increíble! Con Suno o Udio podrías escucharla en menos de un minuto.',
    terms: SONG_TERMS, topicMsg: 'Incluye elementos de una canción: género, tema de la letra, mood o una estrofa.',
  },
  19: {
    icon: '💭', label: 'Reflexión', title: 'El futuro del audio',
    intro: 'En 10 años probablemente tendrás canciones personalizadas en segundos, podrás hablar con cualquiera en cualquier idioma y los libros tendrán la voz de su propio autor... pero también habrá más fraudes y desinformación.',
    box: 'Para reflexionar:\n🎧 ¿Cuál es el uso de la IA de audio que más te emociona?\n⚠️ ¿Y cuál te preocupa más?\n⚖️ ¿Qué reglas pondrías tú si fueras quien decide las leyes?',
    outro: 'No hay respuestas correctas o incorrectas aquí. Escribe lo que piensas tú:',
    placeholder: '¿El futuro del audio con IA te parece más emocionante o más preocupante? ¿Por qué? ¿Qué reglas pondrías?',
    fb: '💭 ¡Excelente reflexión! Las preguntas que haces son exactamente las que los legisladores y empresas tecnológicas están debatiendo ahora mismo.',
    terms: REFLECT_TERMS, topicMsg: 'Tu reflexión debe hablar del tema: IA, audio, voz, música, riesgos o reglas.',
  },
};

// XP por módulo (campo xp real del HTML). Suma real = 265 (el header del HTML decía 240 — el conteo real manda)
const MODULE_XP: number[] = [0, 10, 15, 10, 15, 15, 15, 10, 20, 10, 15, 10, 15, 15, 15, 10, 15, 15, 20, 15, 0];
const MAX_XP = MODULE_XP.reduce((a, b) => a + b, 0); // 265
const TOTAL_STEPS = 21;   // 0=intro … 20=completado
const CONTENT_STEPS = 19; // módulos de contenido (1..19)
const SPRINT_DURATION = 60;

export default function Level14() {
  const completeLevel = useGameStore(s => s.completeLevel);
  const devMode = useGameStore(s => s.devMode);

  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);
  const [xpToast, setXpToast] = useState<{ amount: number; id: number } | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const awardedSteps = useRef<Set<number>>(new Set());

  // Quizzes con opciones barajadas (la correcta no debe tener posición fija)
  const [quizzes] = useState<Record<number, QuizMod>>(() => {
    const out: Record<number, QuizMod> = {};
    Object.entries(QUIZZES).forEach(([k, q]) => { out[Number(k)] = shuffleOpts(q); });
    return out;
  });
  const [quizSel, setQuizSel] = useState<number | null>(null);

  // Matching
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [wrongFlash, setWrongFlash] = useState<{ left: number; right: number } | null>(null);
  const [shuffledRight] = useState(() => shuffle(MATCH_PAIRS.map((p, i) => ({ idx: i, text: p.right }))));

  // Builders (dos fases: confirmar → continuar)
  const [builderText, setBuilderText] = useState('');
  const [builderDone, setBuilderDone] = useState(false);
  const [builderError, setBuilderError] = useState<string | null>(null);

  // Clasificador (case 6)
  const [c2Answers, setC2Answers] = useState<Record<number, string>>({});
  // VF (12 y 14)
  const [vf1Answers, setVf1Answers] = useState<Record<number, boolean>>({});
  const [vf2Answers, setVf2Answers] = useState<Record<number, boolean>>({});

  // Sprint
  const [sprintPhase, setSprintPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [sprintSec, setSprintSec] = useState(SPRINT_DURATION);
  const [sprintText, setSprintText] = useState('');
  const [sprintValid, setSprintValid] = useState(false);

  // Sort (reordenar con flechas; resaltar mal ubicados al verificar)
  const [sortOrder, setSortOrder] = useState<number[]>(() => shuffle([0, 1, 2, 3, 4, 5]));
  const [sortSolved, setSortSolved] = useState(false);
  const [sortWrong, setSortWrong] = useState<Set<number>>(new Set());

  const addXP = (amount: number) => {
    if (amount <= 0) return;
    setXp(p => p + amount);
    setXpToast(prev => ({ amount, id: (prev?.id ?? 0) + 1 }));
  };
  // XP del módulo actual, una sola vez (evita re-otorgar al volver con "Volver")
  const awardStep = (amount: number, countCorrect = true) => {
    if (awardedSteps.current.has(step)) return;
    awardedSteps.current.add(step);
    addXP(amount);
    if (countCorrect) setCorrectCount(c => c + 1);
  };

  // Reset de estados por módulo
  useEffect(() => {
    setQuizSel(null);
    setSelectedLeft(null);
    setWrongFlash(null);
    setBuilderText('');
    setBuilderDone(false);
    setBuilderError(null);
    setC2Answers({});
    setVf1Answers({});
    setVf2Answers({});
    setSprintPhase('idle');
    setSprintSec(SPRINT_DURATION);
    setSprintText('');
    setSortWrong(new Set());
  }, [step]);

  // Sprint timer
  useEffect(() => {
    if (sprintPhase !== 'running') return;
    if (sprintSec <= 0) {
      const valid = sprintText.trim().length > 20 && !looksRandom(sprintText);
      setSprintValid(valid);
      setSprintPhase('done');
      if (valid) awardStep(MODULE_XP[13]);
      return;
    }
    const t = setTimeout(() => setSprintSec(s => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sprintPhase, sprintSec]);

  // Módulos puramente informativos (clasificación propia — el THEORY_STEPS del HTML marca mal builders)
  const theorySteps = new Set([1, 3, 7, 11, 15]);
  const showBack = theorySteps.has(step);

  // Hardware back (Android)
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

  const next = () => { if (step < TOTAL_STEPS - 1) setStep(s => s + 1); };
  const prev = () => { if (step > 0) setStep(s => s - 1); };

  const finishLevel = () => {
    const stars = xp >= 185 ? 3 : xp >= 120 ? 2 : 1;
    completeLevel(14, stars, xp);
    router.replace('/level/15');
  };

  // ---------- Acciones ----------
  const answerQuiz = (i: number) => {
    if (quizSel !== null) return;
    const q = quizzes[step];
    setQuizSel(i);
    if (i === q.correct) awardStep(MODULE_XP[step]);
    if (Platform.OS === 'android') Vibration.vibrate(100);
  };

  const pressRight = (correctIdx: number, rightPos: number) => {
    if (selectedLeft === null) return;
    if (selectedLeft === correctIdx) {
      const n = new Set(matched);
      n.add(selectedLeft);
      setMatched(n);
      setSelectedLeft(null);
      if (n.size === MATCH_PAIRS.length) awardStep(MODULE_XP[2]);
    } else {
      const l = selectedLeft;
      setWrongFlash({ left: l, right: rightPos });
      setTimeout(() => { setWrongFlash(null); setSelectedLeft(null); }, 600);
    }
  };

  const confirmBuilder = () => {
    const b = BUILDERS[step];
    const t = builderText.trim();
    if (t.length <= 15) { setBuilderError('Escribe un poco más — al menos 16 caracteres.'); return; }
    if (looksRandom(t)) { setBuilderError('Tu texto parece escrito al azar. Escríbelo con tus propias palabras.'); return; }
    if (!containsTopic(t, b.terms)) { setBuilderError('⚠️ ' + b.topicMsg); return; }
    setBuilderError(null);
    setBuilderDone(true);
    awardStep(MODULE_XP[step]);
  };

  const answerC2 = (idx: number, ans: string) => {
    if (c2Answers[idx] !== undefined) return;
    const n = { ...c2Answers, [idx]: ans };
    setC2Answers(n);
    if (Object.keys(n).length === CLASSIFY_ITEMS.length) awardStep(MODULE_XP[6]);
  };
  const answerVf1 = (idx: number, ans: boolean) => {
    if (vf1Answers[idx] !== undefined) return;
    const n = { ...vf1Answers, [idx]: ans };
    setVf1Answers(n);
    if (Object.keys(n).length === VF_ITEMS_1.length) awardStep(MODULE_XP[12]);
  };
  const answerVf2 = (idx: number, ans: boolean) => {
    if (vf2Answers[idx] !== undefined) return;
    const n = { ...vf2Answers, [idx]: ans };
    setVf2Answers(n);
    if (Object.keys(n).length === VF_ITEMS_2.length) awardStep(MODULE_XP[14]);
  };

  const submitSprint = () => {
    if (sprintPhase !== 'running') return;
    const valid = sprintText.trim().length > 20 && !looksRandom(sprintText);
    setSprintValid(valid);
    setSprintPhase('done');
    if (valid) awardStep(MODULE_XP[13]);
  };

  const moveSort = (pos: number, dir: number) => {
    if (sortSolved) return;
    const newPos = pos + dir;
    if (newPos < 0 || newPos >= sortOrder.length) return;
    const n = [...sortOrder];
    [n[pos], n[newPos]] = [n[newPos], n[pos]];
    setSortOrder(n);
    setSortWrong(new Set());
  };
  const checkSort = () => {
    const isOk = sortOrder.every((v, i) => v === i);
    if (isOk) {
      setSortSolved(true);
      awardStep(MODULE_XP[17]);
    } else {
      const wrong = new Set(sortOrder.reduce<number[]>((acc, v, i) => { if (v !== i) acc.push(i); return acc; }, []));
      setSortWrong(wrong);
      setTimeout(() => setSortWrong(new Set()), 3000);
    }
  };

  // ---------- Bloques auxiliares ----------
  const ModuleType = ({ icon, label }: { icon: string; label: string }) => (
    <View style={styles.moduleType}>
      <Text style={{ fontSize: 15 }}>{icon}</Text>
      <Text style={styles.moduleTypeText}>{label}</Text>
    </View>
  );
  const Title = ({ children }: { children: ReactNode }) => <Text style={styles.moduleTitle}>{children}</Text>;
  const Body = ({ children, style }: { children: ReactNode; style?: object }) => <Text style={[styles.bodyText, style]}>{children}</Text>;
  const B = ({ children }: { children: ReactNode }) => <Text style={styles.bold}>{children}</Text>;
  const InfoBox = ({ children }: { children: ReactNode }) => (
    <View style={styles.infoBox}><Text style={styles.infoBoxText}>{children}</Text></View>
  );
  const Fb = ({ ok, children }: { ok: boolean; children: ReactNode }) => (
    <View style={[styles.feedback, ok ? styles.feedbackOk : styles.feedbackFail]}>
      <Text style={[styles.feedbackText, { color: ok ? C.okText : C.failText }]}>{children}</Text>
    </View>
  );

  // ---------- Render de módulos ----------
  const renderBuilder = () => {
    const b = BUILDERS[step];
    return (
      <>
        <ModuleType icon={b.icon} label={b.label} />
        <Title>{b.title}</Title>
        <Body>{b.intro}</Body>
        <InfoBox>{b.box}</InfoBox>
        {b.example && (
          <View style={styles.builderExample}>
            <Text style={styles.builderExampleText}><Text style={styles.builderExampleLabel}>Ejemplo: </Text>{b.example}</Text>
          </View>
        )}
        {b.outro && <Body>{b.outro}</Body>}
        <TextInput
          style={styles.builderInput}
          placeholder={b.placeholder}
          placeholderTextColor={C.placeholder}
          multiline
          value={builderText}
          onChangeText={t => { setBuilderText(t); setBuilderError(null); }}
          editable={!builderDone}
        />
        {builderError && <Fb ok={false}>{builderError}</Fb>}
        {builderDone && <Fb ok>{b.fb}</Fb>}
      </>
    );
  };

  const renderQuiz = () => {
    const q = quizzes[step];
    return (
      <>
        <ModuleType icon="❓" label="Quiz" />
        <Title>{q.title}</Title>
        <Body style={{ marginBottom: 16 }}><B>{q.question}</B></Body>
        {q.options.map((opt, i) => (
          <TouchableOpacity
            key={i}
            style={[
              styles.option,
              quizSel !== null && i === q.correct && styles.optionCorrect,
              quizSel === i && i !== q.correct && styles.optionWrong,
            ]}
            disabled={quizSel !== null}
            onPress={() => answerQuiz(i)}
          >
            <Text style={styles.optionIcon}>{['🅐', '🅑', '🅒', '🅓'][i]}</Text>
            <Text style={[styles.optionText, quizSel !== null && i === q.correct && { color: C.okText }, quizSel === i && i !== q.correct && { color: C.failText }]}>{opt}</Text>
          </TouchableOpacity>
        ))}
        {quizSel !== null && (
          <Fb ok={quizSel === q.correct}>{quizSel === q.correct ? '✅ ' : '❌ Casi. '}{q.feedback}</Fb>
        )}
      </>
    );
  };

  const renderStep = (): ReactNode => {
    switch (step) {
      // ===== 0 · INTRO =====
      case 0: return (
        <>
          <ModuleType icon="🎵" label="Introducción" />
          <Title>¿Puede la IA tener voz?</Title>
          <Body>
            Imagínate hablarle a tu computadora y que ella te responda con una voz que suena exactamente como la de tu artista favorito. O componer una canción completa — letra, melodía, batería — con solo escribir un párrafo. <B>Esto ya es posible hoy.</B>
          </Body>
          <Body>
            En este nivel vas a explorar el mundo del <B>audio generado con IA</B>: voces artificiales, clonación de voz, transcripción automática y música creada desde cero.
          </Body>
          <InfoBox>
            <B>Herramientas que vamos a conocer:</B>{'\n'}
            🎤 <B>ElevenLabs</B> — clona voces humanas{'\n'}
            👂 <B>Whisper</B> (OpenAI) — transcribe audio a texto{'\n'}
            🎵 <B>Suno y Udio</B> — componen canciones completas{'\n'}
            🌐 <B>Google Translate Voice / DeepL</B> — traducen en tiempo real
          </InfoBox>
        </>
      );

      // ===== 1 · TEORÍA: texto a voz =====
      case 1: return (
        <>
          <ModuleType icon="🧠" label="Teoría" />
          <Title>¿Cómo convierte la IA texto en voz?</Title>
          <Body>El proceso de convertir texto en voz se llama <B>Text-to-Speech (TTS)</B>. La IA lo hace en dos pasos:</Body>
          <Body><B>1. Entender el texto:</B> analiza las palabras, la puntuación y el contexto emocional, y decide cómo debería sonar cada parte (pausas, énfasis, entonación).</Body>
          <Body><B>2. Generar el audio:</B> usando ondas de sonido, la IA "construye" la voz poco a poco, añadiendo las características únicas de la voz que debe imitar.</Body>
          <InfoBox><B>Analogía:</B> imagina una partitura de música. El texto sería la partitura escrita, y la IA sería el músico que la toca. Cada IA "músico" tiene su propio estilo.</InfoBox>
          <Body>Las voces de IA modernas son tan buenas que en pruebas ciegas <B>muchas personas no pueden distinguirlas de voces humanas reales</B>. Esto tiene implicaciones increíbles... y también riesgos importantes.</Body>
        </>
      );

      // ===== 2 · MATCHING =====
      case 2: return (
        <>
          <ModuleType icon="🔗" label="Matching" />
          <Title>Voces reales vs IA</Title>
          <Body style={{ marginBottom: 16 }}>Conecta cada elemento con su descripción. Toca uno del lado izquierdo, luego el correcto del lado derecho.</Body>
          <View style={styles.matchGrid}>
            <View style={styles.matchCol}>
              {MATCH_PAIRS.map((pair, i) => (
                <TouchableOpacity
                  key={`l${i}`}
                  style={[styles.matchItem, selectedLeft === i && styles.matchItemSelected, matched.has(i) && styles.matchItemMatched, wrongFlash?.left === i && styles.matchItemWrong]}
                  disabled={matched.has(i)}
                  onPress={() => setSelectedLeft(i)}
                >
                  <Text style={[styles.matchItemText, selectedLeft === i && { color: C.tealLight }, matched.has(i) && { color: C.okText }, wrongFlash?.left === i && { color: C.failText }]}>{pair.left}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.matchCol}>
              {shuffledRight.map((item, pos) => {
                const isMatched = matched.has(item.idx);
                return (
                  <TouchableOpacity
                    key={`r${pos}`}
                    style={[styles.matchItem, isMatched && styles.matchItemMatched, wrongFlash?.right === pos && styles.matchItemWrong]}
                    disabled={isMatched || selectedLeft === null}
                    onPress={() => pressRight(item.idx, pos)}
                  >
                    <Text style={[styles.matchItemText, isMatched && { color: C.okText }, wrongFlash?.right === pos && { color: C.failText }]}>{item.text}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          {matched.size === MATCH_PAIRS.length && <Fb ok>✅ ¡Todos los pares conectados correctamente!</Fb>}
        </>
      );

      // ===== 3 · TEORÍA: ElevenLabs =====
      case 3: return (
        <>
          <ModuleType icon="🎤" label="Casos reales" />
          <Title>La empresa que clona voces</Title>
          <Body><B>ElevenLabs</B> es una empresa fundada en 2022 por dos amigos de la universidad — uno de Polonia y otro de EE.UU. — que querían escuchar películas dobladas en sus idiomas nativos con voces de alta calidad.</Body>
          <Body>Con solo <B>1-3 minutos de audio</B> de una persona pueden crear un clon de voz casi indistinguible del original.</Body>
          <InfoBox>
            <B>¿Para qué se usa legítimamente?</B>{'\n'}
            🎬 Doblaje de películas a otros idiomas{'\n'}
            📚 Audiolibros generados automáticamente{'\n'}
            ♿ Accesibilidad para personas con discapacidades del habla{'\n'}
            🎮 Voces de personajes en videojuegos{'\n'}
            📣 Locución de publicidad y podcasts
          </InfoBox>
          <Body>Pero como toda tecnología poderosa, también puede usarse mal. Por eso trabajan en sistemas de detección de audio falso.</Body>
        </>
      );

      // ===== 4, 9, 10, 16, 18 · QUIZ =====
      case 4: case 9: case 10: case 16: case 18: return renderQuiz();

      // ===== 5, 8, 19 · BUILDER =====
      case 5: case 8: case 19: return renderBuilder();

      // ===== 6 · CLASIFICADOR =====
      case 6: return (
        <>
          <ModuleType icon="⚖️" label="Clasificador" />
          <Title>¿Bueno o peligroso?</Title>
          <Body style={{ marginBottom: 4 }}>Clasifica cada uso de la clonación de voz con IA:</Body>
          {CLASSIFY_ITEMS.map((item, idx) => {
            const ans = c2Answers[idx];
            return (
              <View key={idx} style={styles.vfItem}>
                <Text style={styles.vfStatement}>{item.text}</Text>
                <View style={styles.vfButtons}>
                  <TouchableOpacity
                    style={[styles.vfBtn, ans === 'ok' && (item.correct === 'ok' ? styles.vfBtnCorrect : styles.vfBtnWrong)]}
                    disabled={ans !== undefined}
                    onPress={() => answerC2(idx, 'ok')}
                  >
                    <Text style={[styles.vfBtnText, ans === 'ok' && { color: item.correct === 'ok' ? C.okText : C.failText }]}>✅ Uso válido</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.vfBtn, ans === 'bad' && (item.correct === 'bad' ? styles.vfBtnCorrect : styles.vfBtnWrong)]}
                    disabled={ans !== undefined}
                    onPress={() => answerC2(idx, 'bad')}
                  >
                    <Text style={[styles.vfBtnText, ans === 'bad' && { color: item.correct === 'bad' ? C.okText : C.failText }]}>⚠️ Problemático</Text>
                  </TouchableOpacity>
                </View>
                {ans !== undefined && <Fb ok={ans === item.correct}>{item.feedback}</Fb>}
              </View>
            );
          })}
        </>
      );

      // ===== 7 · TEORÍA: Suno y Udio =====
      case 7: return (
        <>
          <ModuleType icon="🎵" label="Casos reales" />
          <Title>Suno y Udio: canciones desde cero</Title>
          <Body>¿Y si pudieras escribir "canción de rock épico sobre un gato que quiere conquistar el mundo" y en 30 segundos tuvieras una canción completa con letra, melodía, guitarra y batería? Eso hacen <B>Suno</B> y <B>Udio</B>.</Body>
          <Body>Aprendieron de millones de canciones para entender ritmo, armonía, estructura de versos y coros, y distintos géneros musicales.</Body>
          <InfoBox>
            <B>¿Cómo se usa Suno?</B>{'\n'}
            1. Describes el estilo y tema de la canción{'\n'}
            2. Opcionalmente escribes la letra{'\n'}
            3. En 30-60 segundos tienes una canción completa{'\n\n'}
            <B>Géneros:</B> pop, rock, reggaeton, cumbia, jazz, electrónica, clásica, K-pop... ¡casi cualquier estilo!
          </InfoBox>
          <Body>En 2024, varias canciones generadas con Suno llegaron a playlists populares de Spotify sin que los oyentes supieran que eran de IA.</Body>
        </>
      );

      // ===== 11 · TEORÍA: medios que ya usan IA =====
      case 11: return (
        <>
          <ModuleType icon="📻" label="Casos reales" />
          <Title>El audio de IA ya está en todas partes</Title>
          <Body>Puede que ya hayas escuchado audio generado por IA sin saberlo:</Body>
          <Body><B>📻 Radios automatizadas:</B> varias emisoras en EE.UU., Reino Unido y España ya transmiten locutores de IA 24/7, sobre todo de noche.</Body>
          <Body><B>📖 Audiolibros:</B> Amazon tiene miles de audiolibros narrados por IA. Son más baratos de producir que con actores humanos.</Body>
          <Body><B>🎧 Podcasts:</B> muchos creadores usan ElevenLabs para generar versiones en audio de sus artículos de blog.</Body>
          <Body><B>📺 Doblajes:</B> Netflix y Disney ya prueban doblaje automático con IA para idiomas poco rentables de doblar.</Body>
          <InfoBox><B>Impacto en empleos:</B> los actores de doblaje en México, Argentina y España están muy preocupados. Es un debate activo sobre el futuro del trabajo creativo.</InfoBox>
        </>
      );

      // ===== 12 · VERDADERO/FALSO =====
      case 12: return (
        <>
          <ModuleType icon="✔️" label="Verdadero o Falso" />
          <Title>Verdadero o Falso</Title>
          {VF_ITEMS_1.map((item, idx) => {
            const ans = vf1Answers[idx];
            return (
              <View key={idx} style={styles.vfItem}>
                <Text style={styles.vfStatement}>"{item.text}"</Text>
                <View style={styles.vfButtons}>
                  <TouchableOpacity
                    style={[styles.vfBtn, ans === true && (item.correct ? styles.vfBtnCorrect : styles.vfBtnWrong)]}
                    disabled={ans !== undefined}
                    onPress={() => answerVf1(idx, true)}
                  >
                    <Text style={[styles.vfBtnText, ans === true && { color: item.correct ? C.okText : C.failText }]}>✅ Verdadero</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.vfBtn, ans === false && (!item.correct ? styles.vfBtnCorrect : styles.vfBtnWrong)]}
                    disabled={ans !== undefined}
                    onPress={() => answerVf1(idx, false)}
                  >
                    <Text style={[styles.vfBtnText, ans === false && { color: !item.correct ? C.okText : C.failText }]}>❌ Falso</Text>
                  </TouchableOpacity>
                </View>
                {ans !== undefined && <Fb ok={ans === item.correct}>{ans === item.correct ? '✅ ' : '❌ Incorrecto. '}{item.feedback}</Fb>}
              </View>
            );
          })}
        </>
      );

      // ===== 13 · SPRINT =====
      case 13: {
        const minutes = Math.floor(sprintSec / 60);
        const seconds = String(sprintSec % 60).padStart(2, '0');
        return (
          <>
            <ModuleType icon="⚡" label="Sprint" />
            <Title>Sprint: tu personaje de audio</Title>
            <View style={styles.sprintBox}>
              <Text style={styles.sprintInstruction}>⚡ ¡60 segundos! Diseña 3 personajes de voz para un videojuego. Cada uno con: nombre + personalidad + tipo de voz.</Text>
              <Text style={[styles.timerText, sprintPhase === 'running' && sprintSec <= 15 ? styles.timerDanger : sprintPhase === 'running' && sprintSec <= 30 ? styles.timerWarning : null]}>
                {sprintPhase === 'done' ? '0:00' : `${minutes}:${seconds}`}
              </Text>
              {sprintPhase === 'idle' && (
                <TouchableOpacity style={styles.btn} onPress={() => setSprintPhase('running')}>
                  <Text style={styles.btnText}>▶ Iniciar Sprint</Text>
                </TouchableOpacity>
              )}
            </View>
            <TextInput
              style={styles.builderInput}
              placeholder={'Personaje 1: [Nombre] — [Personalidad] — [Tipo de voz]\nPersonaje 2: ...\nPersonaje 3: ...'}
              placeholderTextColor={C.placeholder}
              multiline
              value={sprintText}
              onChangeText={setSprintText}
              editable={sprintPhase === 'running'}
            />
            {sprintPhase === 'running' && (
              <TouchableOpacity style={[styles.btn, sprintText.trim().length <= 20 && styles.mainBtnDisabled]} onPress={submitSprint} disabled={sprintText.trim().length <= 20}>
                <Text style={styles.btnText}>Entregar ✓</Text>
              </TouchableOpacity>
            )}
            {sprintPhase === 'done' && (
              <Fb ok={sprintValid}>⚡ ¡Sprint terminado! {sprintValid ? 'Diseñaste personajes de audio únicos.' : 'La próxima vez intenta describir los 3 personajes completos.'}</Fb>
            )}
          </>
        );
      }

      // ===== 14 · ¿LEGAL O ILEGAL? =====
      case 14: return (
        <>
          <ModuleType icon="⚖️" label="¿Legal o ilegal?" />
          <Title>Verdadero o Falso</Title>
          {VF_ITEMS_2.map((item, idx) => {
            const ans = vf2Answers[idx];
            return (
              <View key={idx} style={styles.vfItem}>
                <Text style={styles.vfStatement}>"{item.text}"</Text>
                <View style={styles.vfButtons}>
                  <TouchableOpacity
                    style={[styles.vfBtn, ans === true && (item.correct ? styles.vfBtnCorrect : styles.vfBtnWrong)]}
                    disabled={ans !== undefined}
                    onPress={() => answerVf2(idx, true)}
                  >
                    <Text style={[styles.vfBtnText, ans === true && { color: item.correct ? C.okText : C.failText }]}>✅ Verdadero</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.vfBtn, ans === false && (!item.correct ? styles.vfBtnCorrect : styles.vfBtnWrong)]}
                    disabled={ans !== undefined}
                    onPress={() => answerVf2(idx, false)}
                  >
                    <Text style={[styles.vfBtnText, ans === false && { color: !item.correct ? C.okText : C.failText }]}>❌ Falso</Text>
                  </TouchableOpacity>
                </View>
                {ans !== undefined && <Fb ok={ans === item.correct}>{ans === item.correct ? '✅ ' : '❌ Incorrecto. '}{item.feedback}</Fb>}
              </View>
            );
          })}
        </>
      );

      // ===== 15 · TEORÍA: traducción en tiempo real =====
      case 15: return (
        <>
          <ModuleType icon="🌐" label="Casos reales" />
          <Title>El intérprete automático ya existe</Title>
          <Body>Imagina hablar en español y que tu amigo en Japón te escuche directamente en japonés, con tu misma voz pero traducida. <B>Esto ya es posible hoy.</B></Body>
          <Body><B>HeyGen</B> permite hacer videos donde una persona habla en un idioma y se genera automáticamente en otro, con los labios sincronizados.</Body>
          <Body><B>Seamless Communication</B> (de Meta) traduce voz en tiempo real preservando el tono y las emociones del hablante original.</Body>
          <InfoBox><B>Impacto educativo:</B> imagina tomar clases de un profesor de Finlandia y escucharlo perfectamente en español, con su voz original. ¡Esta tecnología está eliminando las barreras del idioma!</InfoBox>
          <Body>Sin embargo, también preocupa que cualquier persona pueda ser "traducida" diciendo cosas que nunca dijo en realidad.</Body>
        </>
      );

      // ===== 17 · ORDENA POR SOFISTICACIÓN (sin años visibles) =====
      case 17: return (
        <>
          <ModuleType icon="📈" label="Ordena" />
          <Title>De lo más básico a lo más avanzado</Title>
          <Body style={{ marginBottom: 12 }}>El audio con IA fue volviéndose más poderoso con los años. Ordena estas tecnologías de la <B>más básica (arriba)</B> a la <B>más avanzada (abajo)</B>. Piensa en cuánto puede hacer cada una.</Body>
          {sortOrder.map((origIdx, pos) => (
            <View key={pos} style={[styles.sortRow, sortWrong.has(pos) && styles.sortRowWrong, sortSolved && styles.sortRowOk]}>
              <Text style={styles.sortNum}>{pos + 1}</Text>
              <Text style={styles.sortText}>{SORT_ITEMS[origIdx].text}</Text>
              <View style={styles.sortArrows}>
                <TouchableOpacity onPress={() => moveSort(pos, -1)} disabled={pos === 0 || sortSolved}>
                  <Text style={[styles.sortArrow, (pos === 0 || sortSolved) && { opacity: 0.25 }]}>▲</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => moveSort(pos, 1)} disabled={pos === sortOrder.length - 1 || sortSolved}>
                  <Text style={[styles.sortArrow, (pos === sortOrder.length - 1 || sortSolved) && { opacity: 0.25 }]}>▼</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          {sortSolved && (
            <>
              <Fb ok>✅ ¡Exacto! Cada paso podía hacer más que el anterior. Y así ocurrió en la vida real:</Fb>
              <View style={styles.revealBox}>
                {SORT_ITEMS.map((it, i) => (
                  <Text key={i} style={styles.revealLine}>{i + 1}. {it.reveal}</Text>
                ))}
              </View>
            </>
          )}
          {!sortSolved && sortWrong.size > 0 && <Fb ok={false}>❌ Los elementos en rojo aún no están en el orden correcto. Piensa cuál tecnología es más sencilla y cuál puede hacer más.</Fb>}
        </>
      );

      // ===== 20 · COMPLETADO =====
      case 20: return (
        <View style={styles.completionScreen}>
          <Text style={styles.completionIcon}>🎵</Text>
          <Text style={styles.completionTitle}>¡Badge desbloqueado!</Text>
          <Text style={styles.completionBadge}>🏅 Sound Designer</Text>
          <Text style={styles.completionText}>
            ¡Nivel 14 completado! Ahora entiendes el mundo del audio con IA: voces sintéticas, clonación, música generativa y los riesgos que conlleva esta tecnología.
          </Text>
          <Text style={styles.xpGained}>+<Text style={{ color: C.tealLight }}>{xp}</Text> XP</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{correctCount}</Text>
              <Text style={styles.statLbl}>Correctas</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{CONTENT_STEPS}</Text>
              <Text style={styles.statLbl}>Módulos</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>N15</Text>
              <Text style={styles.statLbl}>Próximo nivel</Text>
            </View>
          </View>
          <View style={styles.nextLevelBox}>
            <Text style={styles.nextLevelText}>
              🎬 <Text style={{ fontWeight: '700', color: C.text }}>Nivel 15: IA y Video{'\n\n'}</Text>
              Del audio al video: Runway, Sora, Kling. Cómo se generan videos con IA, deepfakes, copyright y el futuro del cine.
            </Text>
          </View>
          <TouchableOpacity style={[styles.btn, { width: '100%' }]} onPress={finishLevel}>
            <Text style={styles.btnText}>Siguiente nivel →</Text>
          </TouchableOpacity>
        </View>
      );

      default: return null;
    }
  };

  // ---------- Botón principal ----------
  const getBtn = (): { label: string; enabled: boolean; note?: string; onPress: () => void } | null => {
    switch (step) {
      case 0: return { label: '¡Empezar! →', enabled: true, onPress: next };
      case 1: case 3: case 7: case 11: case 15:
        return { label: 'Continuar →', enabled: true, onPress: () => { awardStep(MODULE_XP[step]); next(); } };
      case 4: case 9: case 10: case 16: case 18:
        return { label: 'Continuar →', enabled: quizSel !== null || devMode, note: quizSel === null ? `Responde para continuar · +${MODULE_XP[step]} XP` : undefined, onPress: next };
      case 5: case 8: case 19: {
        const isReflect = step === 19;
        if (!builderDone) return { label: isReflect ? 'Enviar reflexión →' : 'Confirmar →', enabled: builderText.trim().length > 15 || devMode, note: `Escribe al menos 16 caracteres · +${MODULE_XP[step]} XP`, onPress: confirmBuilder };
        return { label: step === 19 ? 'Completar nivel →' : 'Continuar →', enabled: true, onPress: next };
      }
      case 2: return { label: 'Continuar →', enabled: matched.size === MATCH_PAIRS.length || devMode, note: matched.size < MATCH_PAIRS.length ? `Conecta los ${MATCH_PAIRS.length} pares · +${MODULE_XP[step]} XP` : undefined, onPress: next };
      case 6: return { label: 'Continuar →', enabled: Object.keys(c2Answers).length === CLASSIFY_ITEMS.length || devMode, note: `Clasifica los ${CLASSIFY_ITEMS.length} usos · +${MODULE_XP[step]} XP`, onPress: next };
      case 12: return { label: 'Continuar →', enabled: Object.keys(vf1Answers).length === VF_ITEMS_1.length || devMode, note: `Responde las ${VF_ITEMS_1.length} afirmaciones · +${MODULE_XP[step]} XP`, onPress: next };
      case 13: return { label: 'Continuar →', enabled: sprintPhase === 'done' || devMode, note: sprintPhase !== 'done' ? 'Escribe tus personajes y pulsa "Entregar" · +15 XP' : undefined, onPress: next };
      case 14: return { label: 'Continuar →', enabled: Object.keys(vf2Answers).length === VF_ITEMS_2.length || devMode, note: `Responde las ${VF_ITEMS_2.length} afirmaciones · +${MODULE_XP[step]} XP`, onPress: next };
      case 17:
        if (!sortSolved) return { label: 'Verificar orden →', enabled: true, note: `Ordena de la más básica a la más avanzada · +${MODULE_XP[step]} XP`, onPress: checkSort };
        return { label: 'Continuar →', enabled: true, onPress: next };
      case 20: return null; // botón dentro de la pantalla final
      default: return null;
    }
  };

  const btn = getBtn();
  const progress = Math.round((step / (TOTAL_STEPS - 1)) * 100);

  return (
    <View style={styles.screen}>
      {/* Barra superior: salida + XP */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => exitLevel()} style={styles.closeBtn}><Text style={styles.closeBtnText}>✕</Text></TouchableOpacity>
        <View style={{ flex: 1 }} />
        <View style={styles.xpChip}><Text style={styles.xpChipText}>{xp} XP</Text></View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container}>
        {/* Header del nivel (como el HTML) */}
        <View style={styles.header}>
          <View style={styles.levelBadge}><Text style={styles.levelBadgeText}>🎵 MUNDO 3 · NIVEL 14</Text></View>
          <Text style={styles.levelTitle}>IA que <Text style={{ color: C.tealLight }}>Canta y Habla</Text></Text>
          <Text style={styles.subtitle}>Audio, voz y música generados con inteligencia artificial</Text>
          <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
          <View style={styles.progressLabelRow}>
            <Text style={styles.progressLabel}>{step === 0 ? 'Introducción' : step < TOTAL_STEPS - 1 ? `Módulo ${step} de ${CONTENT_STEPS}` : '¡Nivel completado!'}</Text>
            <Text style={styles.progressLabel}>{xp} / {MAX_XP} XP</Text>
          </View>
        </View>

        {/* Tarjeta del módulo */}
        <View style={styles.moduleCard}>
          <View style={styles.moduleCardAccent} />
          {MODULE_XP[step] > 0 && (
            <View style={styles.moduleXpBadge}><Text style={styles.moduleXpBadgeText}>+{MODULE_XP[step]} XP</Text></View>
          )}
          {renderStep()}
        </View>
      </ScrollView>

      {/* Footer */}
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

      {xpToast && <XPToast key={xpToast.id} amount={xpToast.amount} onHide={() => setXpToast(null)} bgColor={C.teal} textColor="#fff" />}
    </View>
  );
}

// ===================== ESTILOS (paleta oscura teal del HTML nivel-14) =====================
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },

  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingTop: 11, paddingBottom: 8, backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.border },
  closeBtn: { minWidth: 42, minHeight: 42, borderRadius: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 12, color: C.tealLight, fontWeight: '800' },
  xpChip: { paddingHorizontal: 11, paddingVertical: 4, borderRadius: 12, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border },
  xpChipText: { fontSize: 12, color: C.tealLight, fontWeight: '700' },

  container: { padding: 16, paddingBottom: 28 },

  // Header del nivel
  header: { marginBottom: 20 },
  levelBadge: { alignSelf: 'flex-start', backgroundColor: C.emerald, borderRadius: 99, paddingHorizontal: 16, paddingVertical: 6, marginBottom: 12 },
  levelBadgeText: { ...typography.bold, fontSize: 12, color: '#fff', letterSpacing: 0.6 },
  levelTitle: { ...typography.extraBold, fontSize: 28, color: C.text, lineHeight: 34 },
  subtitle: { ...typography.regular, fontSize: 13, color: C.muted, marginTop: 4, marginBottom: 14 },
  progressBar: { width: '100%', height: 8, backgroundColor: C.border, borderRadius: 99, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: C.teal, borderRadius: 99 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  progressLabel: { fontSize: 11, color: C.muted, fontWeight: '500' },

  // Tarjeta del módulo
  moduleCard: { backgroundColor: C.card, borderRadius: 16, padding: 22, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  moduleCardAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: C.teal },
  moduleXpBadge: { position: 'absolute', top: 14, right: 14, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  moduleXpBadgeText: { fontSize: 11, fontWeight: '700', color: C.tealLight },
  moduleType: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  moduleTypeText: { ...typography.bold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: C.tealLight },
  moduleTitle: { ...typography.extraBold, fontSize: 19, color: C.text, marginBottom: 14, lineHeight: 25 },
  bodyText: { ...typography.regular, fontSize: 14, lineHeight: 23, color: C.muted, marginBottom: 12 },
  bold: { fontWeight: '700', color: C.text },
  infoBox: { backgroundColor: C.card2, borderLeftWidth: 4, borderLeftColor: C.teal, borderTopRightRadius: 12, borderBottomRightRadius: 12, paddingHorizontal: 16, paddingVertical: 13, marginBottom: 14 },
  infoBoxText: { ...typography.regular, fontSize: 13, lineHeight: 24, color: C.muted },

  // Quiz
  option: { flexDirection: 'row', backgroundColor: C.card2, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 12, marginBottom: 10, borderWidth: 2, borderColor: C.border, alignItems: 'center' },
  optionCorrect: { borderColor: C.green, backgroundColor: C.okBg },
  optionWrong: { borderColor: C.red, backgroundColor: C.failBg },
  optionIcon: { marginRight: 10, fontSize: 16 },
  optionText: { flex: 1, fontSize: 13, lineHeight: 19, color: C.text, fontWeight: '500' },

  // Feedback
  feedback: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 12, borderWidth: 1 },
  feedbackOk: { backgroundColor: C.okBg, borderColor: C.okBorder },
  feedbackFail: { backgroundColor: C.failBg, borderColor: C.failBorder },
  feedbackText: { fontSize: 13, lineHeight: 20, fontWeight: '500' },

  // Matching
  matchGrid: { flexDirection: 'row', gap: 10 },
  matchCol: { flex: 1, gap: 8 },
  matchItem: { backgroundColor: C.card2, paddingHorizontal: 10, paddingVertical: 12, borderRadius: 10, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center', minHeight: 64 },
  matchItemSelected: { borderColor: C.cyan, backgroundColor: '#062d38' },
  matchItemMatched: { borderColor: C.green, backgroundColor: C.okBg },
  matchItemWrong: { borderColor: C.red, backgroundColor: C.failBg },
  matchItemText: { fontSize: 12, color: C.text, textAlign: 'center', lineHeight: 17, fontWeight: '500' },

  // Builder
  builderInput: { backgroundColor: C.surface, borderWidth: 2, borderColor: C.border, borderRadius: 12, padding: 14, fontSize: 14, lineHeight: 21, color: C.text, minHeight: 100, marginVertical: 10, textAlignVertical: 'top' },
  builderExample: { backgroundColor: C.card2, borderLeftWidth: 3, borderLeftColor: C.tealLight, borderTopRightRadius: 10, borderBottomRightRadius: 10, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12 },
  builderExampleText: { fontSize: 13, color: C.muted, lineHeight: 20, fontStyle: 'italic' },
  builderExampleLabel: { color: C.tealLight, fontWeight: '700', fontStyle: 'normal' },

  // Sprint
  sprintBox: { backgroundColor: '#041520', borderWidth: 2, borderColor: C.teal, borderRadius: 16, padding: 22, alignItems: 'center', marginBottom: 12 },
  sprintInstruction: { textAlign: 'center', marginBottom: 6, fontSize: 13, lineHeight: 20, color: C.muted },
  timerText: { fontSize: 44, fontWeight: '800', color: C.tealLight, fontVariant: ['tabular-nums'], marginVertical: 8 },
  timerWarning: { color: C.yellow },
  timerDanger: { color: C.red },

  // VF & Clasificador
  vfItem: { marginBottom: 12, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 16 },
  vfStatement: { fontSize: 13, fontWeight: '600', marginBottom: 12, color: C.text, lineHeight: 20 },
  vfButtons: { flexDirection: 'row', gap: 8 },
  vfBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 2, borderColor: C.border, alignItems: 'center', backgroundColor: 'transparent' },
  vfBtnCorrect: { borderColor: C.green, backgroundColor: C.okBg },
  vfBtnWrong: { borderColor: C.red, backgroundColor: C.failBg },
  vfBtnText: { ...typography.bold, fontSize: 12, color: C.muted },

  // Sort
  sortRow: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: C.card2, borderRadius: 10, borderWidth: 2, borderColor: C.border, marginBottom: 8 },
  sortRowWrong: { borderColor: C.red, backgroundColor: C.failBg },
  sortRowOk: { borderColor: C.green, backgroundColor: C.okBg },
  sortNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: C.teal, color: '#00252b', textAlign: 'center', lineHeight: 26, fontWeight: '800', fontSize: 12, marginRight: 10, overflow: 'hidden' },
  sortText: { flex: 1, fontSize: 12, color: C.text, lineHeight: 17 },
  sortArrows: { flexDirection: 'column', marginLeft: 8 },
  sortArrow: { fontSize: 14, color: C.tealLight, paddingVertical: 2, paddingHorizontal: 4 },
  revealBox: { backgroundColor: C.card2, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 14, marginTop: 10 },
  revealLine: { fontSize: 12, color: C.muted, lineHeight: 22 },

  // Botones
  btn: { backgroundColor: C.teal, padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 12 },
  btnText: { ...typography.bold, color: '#fff', fontSize: 14 },

  // Completado
  completionScreen: { alignItems: 'center', paddingVertical: 20 },
  completionIcon: { fontSize: 64, marginBottom: 12 },
  completionTitle: { ...typography.extraBold, fontSize: 26, color: C.tealLight, textAlign: 'center', marginBottom: 4 },
  completionBadge: { ...typography.extraBold, fontSize: 20, color: C.tealLight, marginVertical: 8 },
  completionText: { ...typography.regular, fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 16, color: C.muted },
  xpGained: { ...typography.extraBold, fontSize: 34, color: C.text, marginBottom: 16 },
  statsRow: { flexDirection: 'row', width: '100%', gap: 8, marginBottom: 16 },
  statItem: { flex: 1, alignItems: 'center', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 8 },
  statNum: { ...typography.extraBold, fontSize: 20, color: C.tealLight },
  statLbl: { fontSize: 10, color: C.muted, marginTop: 2, textAlign: 'center' },
  nextLevelBox: { backgroundColor: C.card2, borderRadius: 10, padding: 13, marginBottom: 16, borderWidth: 1, borderColor: C.border, width: '100%' },
  nextLevelText: { fontSize: 12, color: C.muted, lineHeight: 20 },

  // Footer
  btnRow: { paddingHorizontal: 13, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.surface },
  btnRowInner: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  backBtn: { paddingHorizontal: 16, paddingVertical: 13, borderRadius: 10, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, minHeight: 48, justifyContent: 'center' },
  backBtnText: { fontSize: 14, fontWeight: '700', color: C.muted },
  mainBtn: { padding: 13, borderRadius: 10, backgroundColor: C.teal, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  mainBtnDisabled: { opacity: 0.35 },
  btnNote: { fontSize: 11, color: C.placeholder, textAlign: 'center', marginTop: 5, minHeight: 15 },
});
