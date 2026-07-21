import { useState, useEffect, useRef, type ReactNode } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  Alert, BackHandler, Vibration, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useGameStore } from '../store/gameStore';
import { useReportProgress } from '../components/LevelProgress';
import { typography } from '../theme';
import { exitLevel } from '../utils/exitLevel';
import XPToast from '../components/XPToast';
import { shuffleDistinct } from '../utils/shuffle';

// ===================== PALETA (hex exactos del HTML nivel-13, tema oscuro M3) =====================
const C = {
  bg: '#0f0a1a', surface: '#1a1028', card: '#231535', card2: '#2d1a42',
  text: '#f0e6ff', muted: '#b89fd4', border: '#3d2060',
  pink: '#e91e8c', pinkLight: '#f472b6', rose: '#ff4da6',
  green: '#22c55e', okBg: '#052e16', okBorder: '#16a34a', okText: '#86efac',
  red: '#ef4444', failBg: '#2d0707', failBorder: '#dc2626', failText: '#fca5a5',
  yellow: '#f59e0b',
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

const REFLECT_TERMS = ['arte', 'artista', 'artistas', 'artistico', 'artistica', 'ia', 'imagen', 'imagenes', 'copyright', 'credito', 'derechos', 'permiso', 'prompt', 'crear', 'creativo', 'creatividad', 'humano', 'humanos', 'pienso', 'creo', 'opinion', 'justo'];
const mentionsTopic = (text: string) => {
  const t = normalize(text);
  return REFLECT_TERMS.some(term =>
    term.length <= 3 ? new RegExp(`\\b${term}\\b`).test(t) : t.includes(term)
  );
};

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

// ===================== DATOS (fieles al HTML nivel-13) =====================
type QuizMod = { type: 'quiz'; title: string; xp: number; question: string; options: string[]; correct: number; feedback: string };

const QUIZZES: Record<number, QuizMod> = {
  2: {
    type: 'quiz', title: '¿Cómo funciona?', xp: 15,
    question: 'Un estudiante en Seúl, Corea del Sur, pregunta: "Si la IA parte de ruido aleatorio para crear imágenes, ¿qué determina hacia dónde va transformando ese ruido?"',
    options: [
      'El número de megapíxeles de tu pantalla',
      'Tu descripción en texto (el prompt)',
      'La velocidad de tu conexión a internet',
      'El color más popular en internet ese día',
    ],
    correct: 1,
    feedback: '¡Exacto! Tu texto (el prompt) es el "mapa" que guía a la IA para transformar el ruido en algo coherente. Sin un buen prompt, la imagen puede salir de cualquier manera.',
  },
  7: {
    type: 'quiz', title: 'Aspectos de imagen', xp: 10,
    question: 'Sofía quiere crear imágenes para publicar en Instagram Stories (formato vertical). ¿Qué proporción de aspecto debería pedir en su prompt?',
    options: [
      '1:1 (cuadrado, para el feed normal)',
      '16:9 (panorámico, para videos de YouTube)',
      '9:16 (vertical, perfecto para Stories)',
      '4:3 (antiguo, como fotos de cámara)',
    ],
    correct: 2,
    feedback: '¡Correcto! El formato 9:16 es vertical y perfecto para Instagram Stories, TikTok y Reels. El 16:9 es para pantallas anchas, y el 1:1 para el feed cuadrado.',
  },
  8: {
    type: 'quiz', title: 'Ángulo de cámara', xp: 15,
    question: 'Amara está creando una imagen de una ciudad en Nigeria para su proyecto escolar. Quiere que se vea toda la ciudad desde lejos, como si estuviera en un helicóptero. ¿Qué término debe añadir a su prompt?',
    options: [
      'Close-up (primer plano extremo)',
      "Bird's eye view (vista aérea desde arriba)",
      'Macro shot (foto muy cercana de detalles)',
      'Low angle (ángulo bajo, desde el suelo)',
    ],
    correct: 1,
    feedback: '¡Perfecto! "Bird\'s eye view" significa literalmente "vista de pájaro" — como ver desde arriba. Si Amara quisiera destacar el rostro de alguien, usaría "close-up".',
  },
  12: {
    type: 'quiz', title: 'Negative prompts', xp: 10,
    question: 'Valentina en Buenos Aires quiere generar una imagen de un gato naranja, pero la IA sigue añadiendo fondos feos y borrosos. ¿Qué debería añadir a su prompt para evitar esto?',
    options: [
      'Escribir todo el prompt en mayúsculas para darle más énfasis al pedido',
      'Usar un "negative prompt" con: blurry background, ugly, low quality',
      'Pedirle la imagen en otro idioma para que el modelo entienda mejor',
      'Reiniciar la computadora y volver a intentarlo desde el principio',
    ],
    correct: 1,
    feedback: '¡Exacto! Los "negative prompts" le dicen a la IA qué NO quieres. Es como decirle "todo bien, pero sin fondo borroso ni baja calidad". ¡Son súper útiles!',
  },
  19: {
    type: 'quiz', title: 'Quiz de cierre', xp: 15,
    question: 'Kenji en Japón quiere crear una imagen de "un samurái en Tokio moderno". Quiere que parezca una fotografía real, con mucho detalle y buena iluminación. ¿Qué versión de su prompt sería mejor?',
    options: [
      '"Un samurái en Tokio"',
      '"Samurái japonés caminando por el barrio de Shinjuku en Tokio moderno, foto realista, hyper-detailed, cinematic lighting, 4K, award-winning photography, rainy night atmosphere"',
      '"SAMURÁI TOKIO FOTO REAL BUENA"',
      '"Por favor genera una imagen muy buena de un samurái que esté en la ciudad de Tokio con mucho detalle"',
    ],
    correct: 1,
    feedback: '¡Exacto! El segundo prompt tiene todos los elementos: sujeto específico, escenario detallado, estilo (foto realista), calidad (4K) y ambiente (noche lluviosa). Los detalles específicos siempre ganan.',
  },
};

const MATCH_PAIRS = [
  { left: '📸 Foto realista', right: 'Parece una fotografía real, muy detallada' },
  { left: '🎌 Anime', right: 'Estilo japonés con ojos grandes y colores vivos' },
  { left: '🖌️ Acuarela', right: 'Colores suaves que parecen pintados con agua' },
  { left: '👾 Pixel art', right: 'Imágenes hechas de cuadraditos de colores' },
];

const WB_WORDS = ['cinematic', 'vibrant', 'hyper-detailed', 'soft light', 'dramatic lighting', 'golden hour', 'minimalist', 'ethereal', '4K resolution', 'award-winning photo'];
const WB_SCENARIO = '"Un tigre blanco en la selva de India"';

const DD_ITEMS: { text: string; zone: 0 | 1; why: string }[] = [
  { text: 'Generar un paisaje de fantasía para tu novela', zone: 0, why: 'Es contenido original que no daña a nadie.' },
  { text: 'Crear imágenes en el "estilo de" un artista vivo sin su permiso', zone: 1, why: 'Copia el estilo de una persona real sin su permiso.' },
  { text: 'Diseñar el logo de tu proyecto escolar con IA', zone: 0, why: 'Uso educativo y original — no perjudica a nadie.' },
  { text: 'Generar fotos falsas de una persona real en situaciones inventadas', zone: 1, why: 'Es un deepfake — daña la imagen de una persona real.' },
  { text: 'Crear ilustraciones para un cuento que escribiste', zone: 0, why: 'Ilustra TU propia historia — creación original.' },
  { text: 'Vender imágenes de IA haciéndolas pasar por fotos reales', zone: 1, why: 'Es un engaño — hacer pasar IA por realidad.' },
];
const DD_ZONES = ['✅ Generalmente permitido', '⚠️ Puede ser problemático'];

const CLASSIFY_ITEMS = [
  { text: 'Manos con 6 dedos o dedos deformes', correct: true, feedback: '¡Correcto! Las IAs tienen problemas históricos con las manos. Ver dedos raros es una señal clásica.' },
  { text: 'Texto ilegible o con letras mezcladas en carteles y letreros', correct: true, feedback: '¡Exacto! Las IAs de imagen luchan mucho con el texto coherente.' },
  { text: 'Sombras que no coinciden con la dirección de la luz', correct: true, feedback: '¡Bien detectado! Las inconsistencias de iluminación son un indicador frecuente.' },
  { text: 'Colores muy vivos y saturados', correct: false, feedback: 'No necesariamente. Las fotos reales también pueden tener colores vivos. No es un indicador confiable.' },
  { text: 'Fondos con patrones repetidos o extraños', correct: true, feedback: '¡Correcto! Los fondos de las imágenes de IA a veces tienen patrones que no tienen sentido lógico.' },
];

const VF_ITEMS = [
  { text: 'Los deepfakes visuales solo pueden crearse con supercomputadoras muy caras.', correct: false, feedback: 'FALSO. Hoy existen apps gratuitas y fáciles de usar que pueden crear deepfakes convincentes. Por eso la educación en detección es tan importante.' },
  { text: 'Si una imagen fue generada por IA, su creador no tiene derechos de autor sobre ella.', correct: true, feedback: 'VERDADERO. En muchos países, las leyes de derechos de autor requieren autoría humana. Las imágenes de IA están en zona legal gris.' },
  { text: 'Solo los expertos en tecnología pueden detectar imágenes falsas.', correct: false, feedback: 'FALSO. Con práctica y conociendo las señales (manos raras, texto ilegible, sombras inconsistentes), cualquiera puede mejorar en detectarlas.' },
];

// Builders: intro + caja de ingredientes + ejemplo + placeholder + feedback (del HTML)
const BUILDERS: Record<number, { icon: string; label: string; title: string; xp: number; intro: string; box: string; example?: string; outro?: string; placeholder: string; fb: string }> = {
  3: {
    icon: '✏️', label: 'Constructor', title: 'Crea tu primer prompt de imagen', xp: 10,
    intro: 'Un buen prompt de imagen tiene 5 ingredientes:',
    box: '🎯 Sujeto: ¿Qué o quién aparece?\n🌍 Escenario: ¿Dónde está?\n🎨 Estilo artístico: ¿Foto realista? ¿Anime? ¿Acuarela?\n💡 Iluminación/mood: ¿Atardecer dorado? ¿Oscuro y misterioso?\n📐 Detalles extras: Colores, texturas, ángulo de cámara',
    example: '"Una niña con trenzas y ropa colorida en un mercado de Ciudad de México, estilo acuarela vibrante, luz cálida de atardecer, colores naranja y rosa, vista desde arriba"',
    outro: 'Ahora construye tu propio prompt de imagen usando los 5 ingredientes:',
    placeholder: 'Escribe aquí tu prompt de imagen. Por ejemplo: Un astronauta en la playa de Río de Janeiro...',
    fb: '🎨 ¡Excelente prompt! Cuanto más detallado, mejor será la imagen resultante.',
  },
  9: {
    icon: '🎮', label: 'Constructor', title: 'Diseña tu personaje de videojuego', xp: 20,
    intro: 'Una de las cosas más divertidas de las IAs de imagen es crear personajes únicos. Tienes que describir:',
    box: '👤 Nombre y origen: ¿De dónde viene tu personaje?\n👕 Apariencia: Ropa, color de cabello, rasgos físicos\n⚔️ Poderes o habilidades: ¿Qué puede hacer?\n🎨 Paleta de colores: ¿Qué colores lo representan?\n🎭 Estilo visual: ¿Anime? ¿Comic americano? ¿Pixel art?',
    example: '"Hiroshi, un ninja de Kioto con armadura azul y dorado, capa que controla el viento, ojos que brillan plateados, estilo anime moderno, hyper-detailed"',
    placeholder: 'Describe tu personaje con todos los detalles...',
    fb: '🎮 ¡Increíble! Ese prompt podría generar un personaje digno de un videojuego profesional.',
  },
  14: {
    icon: '🔀', label: 'Constructor', title: 'Mezcla 2 estilos + 1 concepto inesperado', xp: 10,
    intro: 'Los prompts más creativos mezclan estilos que nadie esperaría combinar. Prueba estas combinaciones locas:',
    box: 'Ejemplos de mashups:\n🎌 Anime + Renacimiento italiano\n🖼️ Impressionismo + Cyberpunk\n👾 Pixel art + Fotografía de naturaleza\n🏛️ Arquitectura antigua + Ciencia ficción',
    example: '"El Coliseo Romano reconstruido en el año 3000, estilo anime con naves espaciales sobrevolando, colores néon, hyper-detailed, cinematic"',
    placeholder: 'Estilo 1 + Estilo 2 + Concepto inesperado = ...',
    fb: '🔀 ¡Esa mezcla es fantástica! Los mejores artistas digitales siempre experimentan con combinaciones inesperadas.',
  },
  18: {
    icon: '💭', label: 'Reflexión', title: 'Arte, IA y tu opinión', xp: 20,
    intro: 'Has aprendido que la IA puede crear imágenes increíbles. Pero esto genera preguntas importantes que los adultos y expertos aún están debatiendo.',
    box: 'Para reflexionar:\n🤔 ¿Una imagen generada por IA es "arte"?\n🎨 ¿El artista que escribe el prompt merece crédito por la imagen?\n⚖️ ¿Es justo que la IA haya aprendido de imágenes de artistas sin pedirles permiso?',
    outro: 'No hay respuestas correctas o incorrectas aquí. Escribe lo que piensas tú:',
    placeholder: '¿Crees que la IA puede ser verdaderamente artística? ¿Los humanos que usan IA son artistas? ¿Qué piensas sobre el copyright? Escribe tu opinión...',
    fb: '💭 Tu reflexión muestra pensamiento crítico. ¡Eso es exactamente lo que el mundo necesita: personas que piensan antes de usar la tecnología!',
  },
};

// XP por módulo (campo xp del HTML). Suma real = 260 (el header del HTML decía 230 — el conteo real manda)
const MODULE_XP: number[] = [0, 10, 15, 10, 15, 10, 15, 10, 15, 20, 15, 10, 10, 15, 10, 15, 15, 15, 20, 15, 0];
const MAX_XP = MODULE_XP.reduce((a, b) => a + b, 0); // 260
// El HTML declara "20 módulos" pero su array tiene 19 de contenido (0=intro, 20=final)
const TOTAL_STEPS = 21;
const CONTENT_STEPS = 19;
const SPRINT_DURATION = 120;

export default function Level13() {
  const completeLevel = useGameStore(s => s.completeLevel);
  const devMode = useGameStore(s => s.devMode);

  const [step, setStep] = useState(0);
  useReportProgress(step, TOTAL_STEPS);
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
  const [shuffledRight] = useState(() => shuffleDistinct(MATCH_PAIRS.map((p, i) => ({ idx: i, text: p.right }))));

  // Builders (dos fases: confirmar → continuar)
  const [builderText, setBuilderText] = useState('');
  const [builderDone, setBuilderDone] = useState(false);
  const [builderError, setBuilderError] = useState<string | null>(null);

  // Word builder
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [wbDone, setWbDone] = useState(false);

  // Drag & drop (array fijo + mapa placed con índice ORIGINAL)
  const [ddPlaced, setDdPlaced] = useState<{ [idx: number]: 0 | 1 }>({});
  const [ddSel, setDdSel] = useState<number | null>(null);
  const [ddOverZone, setDdOverZone] = useState<0 | 1 | null>(null);
  const [ddChecked, setDdChecked] = useState(false);
  const [ddSolved, setDdSolved] = useState(false);
  const ddPlacedRef = useRef(ddPlaced);
  useEffect(() => { ddPlacedRef.current = ddPlaced; }, [ddPlaced]);
  const ddIdxRef = useRef<number | null>(null);
  const ddAllPlaced = DD_ITEMS.every((_, i) => ddPlaced[i] !== undefined);

  // Sprint
  const [sprintPhase, setSprintPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [sprintSec, setSprintSec] = useState(SPRINT_DURATION);
  const [sprintText, setSprintText] = useState('');
  const [sprintValid, setSprintValid] = useState(false);

  // Classify3 / VF
  const [classifyAnswers, setClassifyAnswers] = useState<Record<number, boolean>>({});
  const [vfAnswers, setVfAnswers] = useState<Record<number, boolean>>({});

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
    setSelectedWords([]);
    setWbDone(false);
    setSprintPhase('idle');
    setSprintSec(SPRINT_DURATION);
    setSprintText('');
    setClassifyAnswers({});
    setVfAnswers({});
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
  const theorySteps = new Set([1, 5, 10, 15]);
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

  // Drag & drop web — soltar en CUALQUIER zona; validar solo al pulsar Verificar
  useEffect(() => {
    if (Platform.OS !== 'web' || step !== 11 || ddSolved) return;
    const cleanups: (() => void)[] = [];
    const setup = () => {
      DD_ITEMS.forEach((_, idx) => {
        if (ddPlacedRef.current[idx] !== undefined) return;
        const el = document.getElementById(`dd13-chip-${idx}`);
        if (!el) return;
        el.setAttribute('draggable', 'true');
        (el as HTMLElement).style.cursor = 'grab';
        const onDragStart = (e: DragEvent) => { ddIdxRef.current = idx; setDdSel(null); if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(idx)); } };
        const onDragEnd = () => { ddIdxRef.current = null; setDdOverZone(null); };
        el.addEventListener('dragstart', onDragStart);
        el.addEventListener('dragend', onDragEnd);
        cleanups.push(() => { el.removeEventListener('dragstart', onDragStart); el.removeEventListener('dragend', onDragEnd); });
      });
      ([0, 1] as const).forEach(zone => {
        const el = document.getElementById(`dd13-zone-${zone}`);
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

  const finishLevel = () => {
    const stars = xp >= 180 ? 3 : xp >= 120 ? 2 : 1;
    completeLevel(13, stars, xp);
    router.replace('/level/14');
  };

  // ---------- Acciones ----------
  const answerQuiz = (i: number) => {
    if (quizSel !== null) return;
    const q = quizzes[step];
    setQuizSel(i);
    if (i === q.correct) awardStep(q.xp);
    if (Platform.OS === 'android') Vibration.vibrate(100);
  };

  const pressRight = (correctIdx: number, rightPos: number) => {
    if (selectedLeft === null) return;
    if (selectedLeft === correctIdx) {
      const n = new Set(matched);
      n.add(selectedLeft);
      setMatched(n);
      setSelectedLeft(null);
      if (n.size === MATCH_PAIRS.length) awardStep(MODULE_XP[4]);
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
    if (looksRandom(t)) { setBuilderError('Tu texto parece escrito al azar. Escribe un prompt real con tus palabras.'); return; }
    if (step === 18 && !mentionsTopic(t)) { setBuilderError('Tu reflexión debe hablar del tema: arte, IA, artistas, crédito o copyright.'); return; }
    setBuilderError(null);
    setBuilderDone(true);
    awardStep(b.xp);
  };

  const ddPlace = (zone: 0 | 1) => {
    if (ddSel === null || ddPlaced[ddSel] !== undefined || ddSolved) return;
    setDdPlaced(p => ({ ...p, [ddSel]: zone }));
    setDdSel(null);
  };
  const ddReturn = (idx: number) => {
    if (ddSolved) return;
    setDdChecked(false);
    setDdPlaced(p => { const n = { ...p }; delete n[idx]; return n; });
  };
  const ddAllCorrect = DD_ITEMS.every((it, i) => ddPlaced[i] === it.zone);
  const verifyDd = () => {
    setDdChecked(true);
    if (DD_ITEMS.every((it, i) => ddPlaced[i] === it.zone)) {
      setDdSolved(true);
      awardStep(MODULE_XP[11]);
    }
  };

  const answerClassify = (idx: number, ans: boolean) => {
    if (classifyAnswers[idx] !== undefined) return;
    const n = { ...classifyAnswers, [idx]: ans };
    setClassifyAnswers(n);
    if (Object.keys(n).length === CLASSIFY_ITEMS.length) awardStep(MODULE_XP[16]);
  };
  const answerVf = (idx: number, ans: boolean) => {
    if (vfAnswers[idx] !== undefined) return;
    const n = { ...vfAnswers, [idx]: ans };
    setVfAnswers(n);
    if (Object.keys(n).length === VF_ITEMS.length) awardStep(MODULE_XP[17]);
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
          placeholderTextColor="#6d4a8a"
          multiline
          value={builderText}
          onChangeText={t => { setBuilderText(t); setBuilderError(null); }}
          editable={!builderDone}
        />
        {builderError && <Fb ok={false}>⚠️ {builderError}</Fb>}
        {builderDone && <Fb ok>{b.fb}</Fb>}
      </>
    );
  };

  const renderStep = (): ReactNode => {
    switch (step) {
      // ===== 0 · INTRO =====
      case 0: return (
        <>
          <ModuleType icon="🎨" label="Introducción" />
          <Title>¿Puede la IA ser artista?</Title>
          <Body>
            Imagínate que pudieras describir con palabras la imagen perfecta que tienes en tu cabeza y que en segundos aparezca en tu pantalla exactamente como la soñaste. <B>Eso es exactamente lo que hacen las IAs de generación de imágenes</B>.
          </Body>
          <Body>
            Herramientas como <B>DALL-E</B> (de OpenAI), <B>Midjourney</B> y <B>Stable Diffusion</B> permiten convertir texto en imágenes de alta calidad. ¿Quieres un dragón volando sobre Tokio al estilo anime? ¿Una foto realista de un mercado en Ghana? ¿Un logo para tu negocio? ¡Solo escríbelo!
          </Body>
          <InfoBox><B>¿Cómo funciona?</B> Estas IAs aprendieron viendo millones de imágenes y sus descripciones. Ahora pueden "imaginar" imágenes nuevas cuando les describes lo que quieres.</InfoBox>
          <Body>En este nivel vas a aprender a dominar los <B>prompts de imagen</B>, conocer los mejores estilos artísticos, y entender los límites éticos de esta tecnología increíble.</Body>
        </>
      );

      // ===== 1 · TEORÍA: cómo funciona =====
      case 1: return (
        <>
          <ModuleType icon="🧠" label="Teoría" />
          <Title>La magia detrás de las imágenes</Title>
          <Body>Los modelos de generación de imágenes usan un proceso llamado <B>diffusion</B> (difusión). Funciona así:</Body>
          <Body><B>1.</B> El modelo parte de una imagen completamente aleatoria (como estática de televisión).</Body>
          <Body><B>2.</B> Poco a poco va "limpiando" esa estática, guiado por tu descripción en texto.</Body>
          <Body><B>3.</B> Después de miles de pequeños pasos, aparece una imagen coherente que coincide con lo que escribiste.</Body>
          <InfoBox><B>Analogía:</B> Es como esculpir en mármol. No creas desde cero, sino que vas quitando lo que no va hasta revelar la figura final. La IA parte del "caos" y lo convierte en arte.</InfoBox>
          <Body>Por eso los prompts de imagen más específicos y detallados generalmente producen mejores resultados. <B>Cuanto más preciso seas, mejor entiende la IA lo que quieres</B>.</Body>
        </>
      );

      // ===== 2, 7, 8, 12, 19 · QUIZ =====
      case 2: case 7: case 8: case 12: case 19: {
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
      }

      // ===== 3, 9, 14, 18 · BUILDER =====
      case 3: case 9: case 14: case 18: return renderBuilder();

      // ===== 4 · MATCHING =====
      case 4: return (
        <>
          <ModuleType icon="🔗" label="Matching" />
          <Title>Estilos artísticos</Title>
          <Body style={{ marginBottom: 16 }}>Conecta cada estilo con su descripción. Toca uno del lado izquierdo, luego el correcto del lado derecho.</Body>
          <View style={styles.matchGrid}>
            <View style={styles.matchCol}>
              {MATCH_PAIRS.map((pair, i) => (
                <TouchableOpacity
                  key={`l${i}`}
                  style={[styles.matchItem, selectedLeft === i && styles.matchItemSelected, matched.has(i) && styles.matchItemMatched, wrongFlash?.left === i && styles.matchItemWrong]}
                  disabled={matched.has(i)}
                  onPress={() => setSelectedLeft(i)}
                >
                  <Text style={[styles.matchItemText, selectedLeft === i && { color: C.pinkLight }, matched.has(i) && { color: C.okText }, wrongFlash?.left === i && { color: C.failText }]}>{pair.left}</Text>
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
          {matched.size === MATCH_PAIRS.length && <Fb ok>✅ ¡Perfecto! Conectaste todos los pares correctamente.</Fb>}
        </>
      );

      // ===== 5 · TEORÍA: palabras mágicas =====
      case 5: return (
        <>
          <ModuleType icon="✨" label="Teoría" />
          <Title>Las palabras que mejoran todo</Title>
          <Body>Existen palabras especiales que los artistas digitales usan para mejorar dramáticamente sus prompts. ¡Apréndetelas de memoria!</Body>
          <InfoBox>
            <B>🎬 Cinematic</B> — Da aspecto de película de cine{'\n'}
            <B>🌈 Vibrant</B> — Colores muy vivos e intensos{'\n'}
            <B>⬜ Minimalist</B> — Simple, sin elementos de más{'\n'}
            <B>🔍 Hyper-detailed</B> — Nivel de detalle extremo{'\n'}
            <B>💫 Soft light</B> — Iluminación suave y agradable{'\n'}
            <B>🎭 Dramatic lighting</B> — Sombras fuertes y contrastes{'\n'}
            <B>🌅 Golden hour</B> — Luz cálida del atardecer{'\n'}
            <B>🔮 Ethereal</B> — Aspecto mágico y etéreo
          </InfoBox>
          <Body>Prueba añadir estas palabras al final de cualquier prompt y verás cómo cambia el resultado. <B>A veces una sola palabra transforma completamente la imagen</B>.</Body>
        </>
      );

      // ===== 6 · WORD BUILDER =====
      case 6: return (
        <>
          <ModuleType icon="🔤" label="Constructor de palabras" />
          <Title>Palabras mágicas en acción</Title>
          <Body>Construye un prompt añadiendo las palabras que harían esta imagen más impresionante:</Body>
          <InfoBox><B>Prompt base:</B> {WB_SCENARIO}</InfoBox>
          <View style={styles.sentenceBox}>
            {selectedWords.length === 0 ? (
              <Text style={{ color: '#6d4a8a', fontSize: 13 }}>Toca las palabras para añadirlas...</Text>
            ) : (
              selectedWords.map((w, i) => (
                <TouchableOpacity key={i} style={styles.builtChip} disabled={wbDone} onPress={() => setSelectedWords(prev => prev.filter(x => x !== w))}>
                  <Text style={styles.builtChipText}>{w} ✕</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
          <View style={styles.wordPool}>
            {WB_WORDS.map(word => {
              const used = selectedWords.includes(word);
              return (
                <TouchableOpacity
                  key={word}
                  disabled={used || wbDone}
                  style={[styles.wordChip, used && styles.wordChipUsed]}
                  onPress={() => {
                    const n = [...selectedWords, word];
                    setSelectedWords(n);
                    if (n.length >= 3 && !wbDone) { setWbDone(true); awardStep(MODULE_XP[6]); }
                  }}
                >
                  <Text style={[styles.wordChipText, used && styles.wordChipTextUsed]}>{word}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {!wbDone && (
            <TouchableOpacity style={styles.clearBtn} onPress={() => setSelectedWords([])}>
              <Text style={styles.clearBtnText}>🗑️ Limpiar</Text>
            </TouchableOpacity>
          )}
          {wbDone && (
            <Fb ok>✅ ¡Excelente! Tu prompt mejorado: "{WB_SCENARIO.replace(/"/g, '')} — {selectedWords.join(', ')}"</Fb>
          )}
        </>
      );

      // ===== 10 · TEORÍA: IA en el mundo real =====
      case 10: return (
        <>
          <ModuleType icon="🌍" label="Casos reales" />
          <Title>¿Quién ya usa esto?</Title>
          <Body>La generación de imágenes con IA ya está transformando industrias enteras:</Body>
          <Body><B>🎬 Entretenimiento:</B> Marvel y Disney usan IA para generar conceptos visuales iniciales antes de contratar artistas humanos.</Body>
          <Body><B>📚 Editorial:</B> Editoriales en Argentina y España ya publican libros infantiles con ilustraciones 100% generadas por IA.</Body>
          <Body><B>🛒 E-commerce:</B> Empresas en México generan fotos de productos que nunca han existido físicamente para probar diseños.</Body>
          <Body><B>🎮 Videojuegos:</B> Estudios indie en todo el mundo crean assets visuales (fondos, objetos, personajes) sin necesidad de diseñadores gráficos.</Body>
          <InfoBox><B>¿Sabías que?</B> El ganador de un concurso de fotografía en Colorado, USA, en 2022 resultó ser una imagen generada con IA. ¡Causó un debate enorme sobre el arte y la tecnología!</InfoBox>
        </>
      );

      // ===== 11 · DRAG & DROP: copyright =====
      case 11: return (
        <>
          <ModuleType icon="↕️" label="Clasifica" />
          <Title>¿Qué está permitido?</Title>
          <Body>Clasifica cada situación según si está generalmente permitida o puede ser problemática con imágenes de IA:</Body>
          <View style={styles.dragPool}>
            {DD_ITEMS.map((item, idx) => ddPlaced[idx] === undefined ? (
              <TouchableOpacity key={idx} id={`dd13-chip-${idx}`} style={[styles.dragItem, ddSel === idx && styles.dragItemSel]} disabled={ddSolved} onPress={() => setDdSel(ddSel === idx ? null : idx)}>
                <Text style={styles.dragItemText}>{item.text}</Text>
              </TouchableOpacity>
            ) : null)}
            {ddAllPlaced && <Text style={{ color: '#6d4a8a', fontSize: 12 }}>Todas las situaciones clasificadas ✓</Text>}
          </View>
          {([0, 1] as const).map(zone => (
            <View key={zone}>
              <Text style={styles.dropZoneLabel}>{DD_ZONES[zone]}</Text>
              <TouchableOpacity id={`dd13-zone-${zone}`} activeOpacity={0.8} style={[styles.dropZone, ddOverZone === zone && styles.dropZoneOver]} disabled={ddSolved} onPress={() => ddPlace(zone)}>
                {DD_ITEMS.map((item, idx) => ddPlaced[idx] === zone ? (
                  <TouchableOpacity key={idx} disabled={ddSolved} onPress={() => ddReturn(idx)}
                    style={[styles.dragItem, ddChecked && (item.zone === zone ? styles.dragItemOk : styles.dragItemBad)]}>
                    <Text style={[styles.dragItemText, ddChecked && { color: item.zone === zone ? C.okText : C.failText }]}>
                      {ddChecked ? (item.zone === zone ? '✓ ' : '✕ ') : ''}{item.text}
                    </Text>
                  </TouchableOpacity>
                ) : null)}
              </TouchableOpacity>
            </View>
          ))}
          {ddChecked && ddSolved && <Fb ok>✅ ¡Clasificación perfecta! Entiendes bien los límites del uso de imágenes de IA.</Fb>}
          {ddChecked && !ddSolved && (
            <>
              <Fb ok={false}>❌ Algunas clasificaciones no son correctas. Toca las marcadas con ✕ para devolverlas y vuelve a intentarlo.</Fb>
              {DD_ITEMS.map((item, idx) => ddPlaced[idx] !== undefined && ddPlaced[idx] !== item.zone ? (
                <Fb key={idx} ok={false}>✕ "{item.text}" va en <Text style={{ fontWeight: '700' }}>{DD_ZONES[item.zone]}</Text>. {item.why}</Fb>
              ) : null)}
            </>
          )}
        </>
      );

      // ===== 13 · SPRINT =====
      case 13: {
        const minutes = Math.floor(sprintSec / 60);
        const seconds = String(sprintSec % 60).padStart(2, '0');
        return (
          <>
            <ModuleType icon="⚡" label="Sprint" />
            <Title>Sprint Visual</Title>
            <View style={styles.sprintBox}>
              <Text style={styles.sprintInstruction}>🎨 ¡Sprint creativo! En 2 minutos, escribe 3 prompts de imagen diferentes. Cada uno debe tener: sujeto + escenario + estilo artístico.</Text>
              <Text style={[styles.timerText, sprintPhase === 'running' && sprintSec <= 30 ? styles.timerDanger : sprintPhase === 'running' && sprintSec <= 60 ? styles.timerWarning : null]}>
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
              placeholder={'Prompt 1:\nPrompt 2:\nPrompt 3:'}
              placeholderTextColor="#6d4a8a"
              multiline
              value={sprintText}
              onChangeText={setSprintText}
              editable={sprintPhase === 'running'}
            />
            {sprintPhase === 'done' && (
              <Fb ok={sprintValid}>⚡ ¡Sprint terminado! {sprintValid ? 'Escribiste contenido — ¡bien hecho!' : 'Intenta escribir al menos 3 prompts la próxima vez.'}</Fb>
            )}
          </>
        );
      }

      // ===== 15 · TEORÍA: portadas =====
      case 15: return (
        <>
          <ModuleType icon="📚" label="Casos reales" />
          <Title>La IA en el mundo editorial</Title>
          <Body>El mundo de los libros está siendo transformado por la IA. Algunos ejemplos reales:</Body>
          <Body><B>🇩🇪 Alemania:</B> La editorial Carlsen publicó en 2023 uno de los primeros libros infantiles con ilustraciones generadas con IA, causando debate entre ilustradores.</Body>
          <Body><B>🇺🇸 EE.UU.:</B> Amazon KDP (la plataforma de autopublicación) recibe miles de libros por semana con portadas e ilustraciones generadas con IA.</Body>
          <Body><B>🇨🇴 Colombia:</B> Algunas agencias de publicidad ya usan DALL-E y Midjourney para crear campañas visuales completas en horas, no semanas.</Body>
          <InfoBox><B>El debate:</B> ¿Los ilustradores humanos están en peligro? Muchos expertos creen que la IA será una herramienta que complementa a los artistas, no que los reemplaza. ¡Los artistas que saben usar IA serán los más valiosos!</InfoBox>
        </>
      );

      // ===== 16 · CLASSIFY3 =====
      case 16: return (
        <>
          <ModuleType icon="🔍" label="Detector" />
          <Title>¿Real o generada por IA?</Title>
          <Body>Identifica estas características de imágenes. ¿Son señales de que una imagen fue generada por IA?</Body>
          {CLASSIFY_ITEMS.map((item, idx) => {
            const ans = classifyAnswers[idx];
            return (
              <View key={idx} style={styles.vfItem}>
                <Text style={styles.vfStatement}>{item.text}</Text>
                <View style={styles.vfButtons}>
                  <TouchableOpacity
                    style={[styles.vfBtn, ans === true && (item.correct ? styles.vfBtnCorrect : styles.vfBtnWrong)]}
                    disabled={ans !== undefined}
                    onPress={() => answerClassify(idx, true)}
                  >
                    <Text style={[styles.vfBtnText, ans === true && { color: item.correct ? C.okText : C.failText }]}>✅ Sí es señal de IA</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.vfBtn, ans === false && (!item.correct ? styles.vfBtnCorrect : styles.vfBtnWrong)]}
                    disabled={ans !== undefined}
                    onPress={() => answerClassify(idx, false)}
                  >
                    <Text style={[styles.vfBtnText, ans === false && { color: !item.correct ? C.okText : C.failText }]}>❌ No es señal de IA</Text>
                  </TouchableOpacity>
                </View>
                {ans !== undefined && <Fb ok={ans === item.correct}>{item.feedback}</Fb>}
              </View>
            );
          })}
        </>
      );

      // ===== 17 · VERDADERO/FALSO =====
      case 17: return (
        <>
          <ModuleType icon="✔️" label="Verdadero o Falso" />
          <Title>Verdadero o Falso</Title>
          {VF_ITEMS.map((item, idx) => {
            const ans = vfAnswers[idx];
            return (
              <View key={idx} style={styles.vfItem}>
                <Text style={styles.vfStatement}>"{item.text}"</Text>
                <View style={styles.vfButtons}>
                  <TouchableOpacity
                    style={[styles.vfBtn, ans === true && (item.correct ? styles.vfBtnCorrect : styles.vfBtnWrong)]}
                    disabled={ans !== undefined}
                    onPress={() => answerVf(idx, true)}
                  >
                    <Text style={[styles.vfBtnText, ans === true && { color: item.correct ? C.okText : C.failText }]}>✅ Verdadero</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.vfBtn, ans === false && (!item.correct ? styles.vfBtnCorrect : styles.vfBtnWrong)]}
                    disabled={ans !== undefined}
                    onPress={() => answerVf(idx, false)}
                  >
                    <Text style={[styles.vfBtnText, ans === false && { color: !item.correct ? C.okText : C.failText }]}>❌ Falso</Text>
                  </TouchableOpacity>
                </View>
                {ans !== undefined && <Fb ok={ans === item.correct}>{item.feedback}</Fb>}
              </View>
            );
          })}
        </>
      );

      // ===== 20 · COMPLETADO =====
      case 20: return (
        <View style={styles.completionScreen}>
          <Text style={styles.completionIcon}>🎨</Text>
          <Text style={styles.completionTitle}>¡Badge desbloqueado!</Text>
          <Text style={styles.completionBadge}>🏅 AI Artist</Text>
          <Text style={styles.completionText}>
            ¡Completaste el Nivel 13! Ahora sabes crear prompts de imagen, conoces los estilos artísticos y entiendes cómo funciona la IA generativa visual.
          </Text>
          <Text style={styles.xpGained}>+<Text style={{ color: C.pinkLight }}>{xp}</Text> XP</Text>
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
              <Text style={styles.statNum}>N14</Text>
              <Text style={styles.statLbl}>Próximo nivel</Text>
            </View>
          </View>
          <View style={styles.nextLevelBox}>
            <Text style={styles.nextLevelText}>
              🎵 <Text style={{ fontWeight: '700', color: C.text }}>Nivel 14: IA y Audio{'\n\n'}</Text>
              Ahora que dominas las imágenes, vas a explorar el sonido: voces sintéticas, clonación de voz, música generativa y los riesgos que conlleva esta tecnología.
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
      case 1: case 5: case 10: case 15:
        return { label: 'Continuar →', enabled: true, onPress: () => { awardStep(MODULE_XP[step]); next(); } };
      case 2: case 7: case 8: case 12: case 19:
        return { label: 'Continuar →', enabled: quizSel !== null || devMode, note: quizSel === null ? `Responde para continuar · +${MODULE_XP[step]} XP` : undefined, onPress: next };
      case 3: case 9: case 14: case 18: {
        const isReflect = step === 18;
        if (!builderDone) return { label: isReflect ? 'Enviar reflexión →' : 'Confirmar prompt →', enabled: builderText.trim().length > 15 || devMode, note: `Escribe al menos 16 caracteres · +${MODULE_XP[step]} XP`, onPress: confirmBuilder };
        return { label: 'Continuar →', enabled: true, onPress: next };
      }
      case 4: return { label: 'Continuar →', enabled: matched.size === MATCH_PAIRS.length || devMode, note: matched.size < MATCH_PAIRS.length ? `Conecta los ${MATCH_PAIRS.length} pares · +${MODULE_XP[step]} XP` : undefined, onPress: next };
      case 6: return { label: 'Continuar →', enabled: wbDone || devMode, note: !wbDone ? `Añade al menos 3 palabras mágicas · +${MODULE_XP[step]} XP` : undefined, onPress: next };
      case 11:
        if (!ddChecked || (!ddSolved && !ddAllCorrect)) return { label: 'Verificar →', enabled: ddAllPlaced || devMode, note: 'Toca una situación → luego toca la zona donde va (o arrástrala) · +10 XP', onPress: verifyDd };
        return { label: 'Continuar →', enabled: true, onPress: next };
      case 13: return { label: 'Continuar →', enabled: sprintPhase === 'done' || devMode, note: sprintPhase !== 'done' ? 'Completa el sprint de 2 minutos · +15 XP' : undefined, onPress: next };
      case 16: return { label: 'Continuar →', enabled: Object.keys(classifyAnswers).length === CLASSIFY_ITEMS.length || devMode, note: `Responde las ${CLASSIFY_ITEMS.length} características · +${MODULE_XP[step]} XP`, onPress: next };
      case 17: return { label: 'Continuar →', enabled: Object.keys(vfAnswers).length === VF_ITEMS.length || devMode, note: `Responde las ${VF_ITEMS.length} afirmaciones · +${MODULE_XP[step]} XP`, onPress: next };
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
          <View style={styles.levelBadge}><Text style={styles.levelBadgeText}>🖼️ MUNDO 3 · NIVEL 13</Text></View>
          <Text style={styles.levelTitle}>IA que <Text style={{ color: C.pinkLight }}>Dibuja</Text></Text>
          <Text style={styles.subtitle}>Genera imágenes con palabras</Text>
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

      {xpToast && <XPToast key={xpToast.id} amount={xpToast.amount} onHide={() => setXpToast(null)} bgColor={C.pink} textColor="#fff" />}
    </View>
  );
}

// ===================== ESTILOS (paleta oscura del HTML M3) =====================
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },

  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingTop: 11, paddingBottom: 8, backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.border },
  closeBtn: { minWidth: 42, minHeight: 42, borderRadius: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 12, color: C.pinkLight, fontWeight: '800' },
  xpChip: { paddingHorizontal: 11, paddingVertical: 4, borderRadius: 12, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border },
  xpChipText: { fontSize: 12, color: C.pinkLight, fontWeight: '700' },

  container: { padding: 16, paddingBottom: 28 },

  // Header del nivel
  header: { marginBottom: 20 },
  levelBadge: { alignSelf: 'flex-start', backgroundColor: C.pink, borderRadius: 99, paddingHorizontal: 16, paddingVertical: 6, marginBottom: 12 },
  levelBadgeText: { ...typography.bold, fontSize: 12, color: '#fff', letterSpacing: 0.6 },
  levelTitle: { ...typography.extraBold, fontSize: 28, color: C.text, lineHeight: 34 },
  subtitle: { ...typography.regular, fontSize: 13, color: C.muted, marginTop: 4, marginBottom: 14 },
  progressBar: { width: '100%', height: 8, backgroundColor: C.border, borderRadius: 99, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: C.pink, borderRadius: 99 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  progressLabel: { fontSize: 11, color: C.muted, fontWeight: '500' },

  // Tarjeta del módulo
  moduleCard: { backgroundColor: C.card, borderRadius: 16, padding: 22, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  moduleCardAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: C.pink },
  moduleXpBadge: { position: 'absolute', top: 14, right: 14, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  moduleXpBadgeText: { fontSize: 11, fontWeight: '700', color: C.pinkLight },
  moduleType: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  moduleTypeText: { ...typography.bold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: C.pinkLight },
  moduleTitle: { ...typography.extraBold, fontSize: 19, color: C.text, marginBottom: 14, lineHeight: 25 },
  bodyText: { ...typography.regular, fontSize: 14, lineHeight: 23, color: C.muted, marginBottom: 12 },
  bold: { fontWeight: '700', color: C.text },
  infoBox: { backgroundColor: C.card2, borderLeftWidth: 4, borderLeftColor: C.pink, borderTopRightRadius: 12, borderBottomRightRadius: 12, paddingHorizontal: 16, paddingVertical: 13, marginBottom: 14 },
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
  matchItem: { backgroundColor: C.card2, paddingHorizontal: 10, paddingVertical: 12, borderRadius: 10, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center', minHeight: 60 },
  matchItemSelected: { borderColor: C.rose, backgroundColor: '#3d1060' },
  matchItemMatched: { borderColor: C.green, backgroundColor: C.okBg },
  matchItemWrong: { borderColor: C.red, backgroundColor: C.failBg },
  matchItemText: { fontSize: 12, color: C.text, textAlign: 'center', lineHeight: 17, fontWeight: '500' },

  // Builder
  builderInput: { backgroundColor: C.surface, borderWidth: 2, borderColor: C.border, borderRadius: 12, padding: 14, fontSize: 14, lineHeight: 21, color: C.text, minHeight: 100, marginVertical: 10, textAlignVertical: 'top' },
  builderExample: { backgroundColor: C.card2, borderLeftWidth: 3, borderLeftColor: C.pinkLight, borderTopRightRadius: 10, borderBottomRightRadius: 10, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12 },
  builderExampleText: { fontSize: 13, color: C.muted, lineHeight: 20, fontStyle: 'italic' },
  builderExampleLabel: { color: C.pinkLight, fontWeight: '700', fontStyle: 'normal' },

  // Word builder
  sentenceBox: { backgroundColor: C.surface, borderWidth: 2, borderColor: C.border, borderRadius: 10, padding: 14, minHeight: 50, flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 10 },
  builtChip: { backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, borderRadius: 6, paddingVertical: 4, paddingHorizontal: 10 },
  builtChipText: { fontSize: 13, color: C.muted },
  wordPool: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 14, backgroundColor: C.card2, borderRadius: 10 },
  wordChip: { backgroundColor: '#3d1060', borderWidth: 1, borderColor: C.pink, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 14 },
  wordChipUsed: { opacity: 0.3 },
  wordChipText: { color: C.pinkLight, fontWeight: '600', fontSize: 13 },
  wordChipTextUsed: { color: '#6d4a8a' },
  clearBtn: { alignSelf: 'flex-start', marginTop: 8, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border },
  clearBtnText: { fontSize: 12, color: C.muted, fontWeight: '600' },

  // Drag & drop
  dragPool: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 14, backgroundColor: C.card2, borderWidth: 2, borderStyle: 'dashed', borderColor: C.border, borderRadius: 12, minHeight: 70, marginBottom: 12, alignItems: 'center' },
  dragItem: { backgroundColor: C.surface, borderWidth: 2, borderColor: C.border, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  dragItemSel: { borderColor: C.pink, backgroundColor: '#2d1550' },
  dragItemOk: { borderColor: C.green, backgroundColor: C.okBg },
  dragItemBad: { borderColor: C.red, backgroundColor: C.failBg },
  dragItemText: { fontSize: 12, color: C.text, lineHeight: 17 },
  dropZoneLabel: { fontSize: 12, fontWeight: '700', color: C.pinkLight, marginBottom: 6 },
  dropZone: { minHeight: 70, padding: 12, borderWidth: 2, borderStyle: 'dashed', borderColor: C.border, borderRadius: 12, backgroundColor: C.card2, marginBottom: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' },
  dropZoneOver: { borderColor: C.pink, backgroundColor: '#2d1050' },

  // Sprint
  sprintBox: { backgroundColor: '#2d1060', borderWidth: 2, borderColor: C.pink, borderRadius: 16, padding: 22, alignItems: 'center', marginBottom: 12 },
  sprintInstruction: { textAlign: 'center', marginBottom: 6, fontSize: 13, lineHeight: 20, color: C.muted },
  timerText: { fontSize: 44, fontWeight: '800', color: C.pinkLight, fontVariant: ['tabular-nums'], marginVertical: 8 },
  timerWarning: { color: C.yellow },
  timerDanger: { color: C.red },

  // VF & Classify3
  vfItem: { marginBottom: 12, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 16 },
  vfStatement: { fontSize: 13, fontWeight: '600', marginBottom: 12, color: C.text, lineHeight: 20 },
  vfButtons: { flexDirection: 'row', gap: 8 },
  vfBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 2, borderColor: C.border, alignItems: 'center', backgroundColor: 'transparent' },
  vfBtnCorrect: { borderColor: C.green, backgroundColor: C.okBg },
  vfBtnWrong: { borderColor: C.red, backgroundColor: C.failBg },
  vfBtnText: { ...typography.bold, fontSize: 12, color: C.muted },

  // Botones
  btn: { backgroundColor: C.pink, padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 12 },
  btnText: { ...typography.bold, color: '#fff', fontSize: 14 },

  // Completado
  completionScreen: { alignItems: 'center', paddingVertical: 20 },
  completionIcon: { fontSize: 64, marginBottom: 12 },
  completionTitle: { ...typography.extraBold, fontSize: 26, color: C.pinkLight, textAlign: 'center', marginBottom: 4 },
  completionBadge: { ...typography.extraBold, fontSize: 20, color: C.pinkLight, marginVertical: 8 },
  completionText: { ...typography.regular, fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 16, color: C.muted },
  xpGained: { ...typography.extraBold, fontSize: 34, color: C.text, marginBottom: 16 },
  statsRow: { flexDirection: 'row', width: '100%', gap: 8, marginBottom: 16 },
  statItem: { flex: 1, alignItems: 'center', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 8 },
  statNum: { ...typography.extraBold, fontSize: 20, color: C.pinkLight },
  statLbl: { fontSize: 10, color: C.muted, marginTop: 2, textAlign: 'center' },
  nextLevelBox: { backgroundColor: C.card2, borderRadius: 10, padding: 13, marginBottom: 16, borderWidth: 1, borderColor: C.border, width: '100%' },
  nextLevelText: { fontSize: 12, color: C.muted, lineHeight: 20 },

  // Footer
  btnRow: { paddingHorizontal: 13, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.surface },
  btnRowInner: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  backBtn: { paddingHorizontal: 16, paddingVertical: 13, borderRadius: 10, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, minHeight: 48, justifyContent: 'center' },
  backBtnText: { fontSize: 14, fontWeight: '700', color: C.muted },
  mainBtn: { padding: 13, borderRadius: 10, backgroundColor: C.pink, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  mainBtnDisabled: { opacity: 0.35 },
  btnNote: { fontSize: 11, color: '#6d4a8a', textAlign: 'center', marginTop: 5, minHeight: 15 },
});
