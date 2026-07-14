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

// ===================== PALETA (hex exactos del HTML nivel-18, tema oscuro fucsia M3) =====================
const C = {
  bg: '#0f0014', surface: '#180020', card: '#200030', card2: '#2a0040',
  text: '#fdf4ff', muted: '#c084fc', border: '#4a0070',
  fuchsia: '#d946ef', fuchsiaLight: '#f0abfc', purple: '#9333ea', violet: '#7c3aed', pink: '#ec4899',
  green2: '#22c55e', okBg: '#052e16', okBorder: '#16a34a', okText: '#86efac',
  red: '#ef4444', failBg: '#2d0707', failBorder: '#dc2626', failText: '#fca5a5',
  yellow: '#f59e0b',
  placeholder: '#7a5090',
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

const MULTI_TERMS = ['ia', 'imagen', 'imagenes', 'foto', 'fotos', 'texto', 'audio', 'voz', 'video', 'multimodal', 'modalidad', 'modalidades', 'pipeline', 'analiza', 'analizar', 'pantalla', 'documento', 'pdf', 'camara', 'proyecto', 'entrada', 'salida', 'proceso', 'identifi', 'describe', 'traduce', 'traducir', 'error', 'sintoma', 'sintomas', 'planta', 'diagnostic'];
const REFLECT_TERMS = ['ia', 'crear', 'crea', 'crearia', 'mundo', 'imagen', 'audio', 'video', 'web', 'datos', 'multimodal', 'aprend', 'sorprend', 'poderosa', 'poderoso', 'habilidad', 'creativ', 'creativa', 'proyecto', 'usar'];

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

// ===================== DATOS (fieles al HTML nivel-18) =====================
type QuizMod = { title: string; question: string; options: string[]; correct: number; feedback: string };

// Quizzes con opciones balanceadas en longitud (la correcta no debe ser la más larga)
const QUIZZES: Record<number, QuizMod> = {
  6: {
    title: 'Voice mode en ChatGPT',
    question: 'Kenji está en Tokio y quiere practicar inglés de conversación. No quiere escribir, quiere hablar y recibir corrección en tiempo real. ¿Qué capacidad de GPT-4o le sería más útil?',
    options: [
      'El modo de generación de imágenes, para visualizar el vocabulario nuevo que aprende',
      'El Voice Mode: hablar directamente y recibir respuestas habladas con correcciones al instante',
      'El modo de análisis de documentos, para subir textos largos escritos en inglés',
      'El modo de código, para practicar programando pequeños programas en inglés',
    ],
    correct: 1,
    feedback: 'El Voice Mode de GPT-4o permite conversación de voz fluida, con latencia tan baja que se siente como hablar con un humano. Para practicar idiomas en tiempo real es revolucionario.',
  },
  10: {
    title: 'La combinación perfecta',
    question: 'Amara en Ghana tiene una planta de cacao que parece enferma. Quiere identificar qué tiene y cuánto cuesta el tratamiento. ¿Qué combinación multimodal sería la más útil?',
    options: [
      'Solo texto: describir la planta con palabras y esperar que la IA lo adivine todo',
      'Solo imagen: subir la foto de la planta sin ningún contexto ni explicación adicional',
      'Imagen + texto: la foto de la planta junto con los síntomas y la región',
      'Solo audio: grabar el sonido del viento que sopla alrededor de la planta enferma',
    ],
    correct: 2,
    feedback: 'La combinación imagen + texto contextual siempre da mejores resultados. La foto muestra los síntomas visuales; el texto da el contexto que la imagen no puede mostrar (región, clima, tiempo). Juntos, la IA diagnostica con mucha más precisión.',
  },
  14: {
    title: 'Privacidad y multimodalidad',
    question: 'Sofía quiere usar una IA multimodal para analizar los documentos médicos de su abuela (diagnósticos, medicamentos y datos personales). ¿Cuál es la consideración más importante?',
    options: [
      'No hay ningún problema, porque las IA son totalmente seguras y siempre respetan tu privacidad',
      'Los datos médicos son muy sensibles: revisa la privacidad y anonimiza lo que puedas',
      'Solo puede subirlos si su abuela ya tiene más de sesenta años de edad cumplidos',
      'Es mejor imprimir los documentos y pedirle a otra persona que los lea manualmente',
    ],
    correct: 1,
    feedback: 'Los datos de salud están entre los más sensibles que existen. Antes de subirlos a cualquier IA pública: verifica la política de privacidad, usa modos sin historial si están disponibles y anonimiza cuando sea posible.',
  },
};

// Módulo 2 · Matching
const MATCH_PAIRS = [
  { left: '⚡ GPT-4o', right: 'Texto + imagen + audio en tiempo real, voz con emociones' },
  { left: '✦ Gemini 2.0', right: 'Texto + imagen + audio + video nativo, integrado con Google' },
  { left: '🔗 Claude 3.5', right: 'Texto + imagen, análisis profundo de documentos y código' },
  { left: '🌑 Grok 2', right: 'Texto + imagen, con datos en tiempo real de X/Twitter' },
];

// Módulo 5 · Sort (pipeline de video con IA). Índice = posición correcta.
const SORT_ITEMS = [
  'Recopilar la información del evento en texto (noticias, fuentes)',
  'Usar IA para generar el guión del noticiero en formato de presentador',
  'Generar imágenes o clips de video con IA para ilustrar la noticia',
  'Clonar la voz del presentador con ElevenLabs y narrar el guión',
  'Combinar video + audio + subtítulos en el editor final y publicar',
];

// Módulo 9 · Verdadero/Falso (qué puede y qué no)
const VF_ITEMS_1 = [
  { text: 'Una IA multimodal puede ver una imagen y entender perfectamente las emociones de todas las personas en ella.', correct: false, feedback: 'FALSO. Las IA pueden detectar expresiones faciales, pero interpretarlas con precisión es difícil y propenso a errores, con riesgo de sesgo según el origen de las personas.' },
  { text: 'Con GPT-4o en voice mode, puedo tener una conversación de voz en tiempo real sobre casi cualquier tema.', correct: true, feedback: 'VERDADERO. El Voice Mode permite conversación fluida sobre casi cualquier tema, con latencia muy baja. Tiene restricciones sobre contenido inapropiado, pero el rango temático es amplísimo.' },
  { text: 'Si le muestro a una IA multimodal una foto de mi habitación, la recordará en futuras conversaciones.', correct: false, feedback: 'FALSO. Las IA actuales no tienen memoria persistente entre conversaciones por defecto. Cada nueva conversación empieza desde cero: lo que ve en una sesión no lo "recuerda" en la siguiente.' },
];

// Módulo 17 · Verdadero/Falso (multimodalidad)
const VF_ITEMS_2 = [
  { text: 'Las IA multimodales siempre dan mejores resultados que las especializadas en todas las tareas.', correct: false, feedback: 'FALSO. Para tareas muy específicas (análisis de código o diagnóstico médico), un modelo entrenado a propósito puede superar a uno general. La multimodalidad es ventaja de versatilidad, no de profundidad.' },
  { text: 'Puedo mostrarle a una IA multimodal los ingredientes que tengo en casa y pedirle una receta con ellos.', correct: true, feedback: 'VERDADERO. Es un uso práctico excelente: le muestras fotos de tu nevera y despensa, la IA identifica los ingredientes y sugiere recetas con lo que tienes.' },
  { text: 'En 2025, todas las IA multimodales pueden generar video nativo desde texto.', correct: false, feedback: 'FALSO. Muchas pueden analizar video, pero generar video nativo desde cero sigue siendo una capacidad separada en herramientas como Sora, Runway o Pika. La línea se difumina cada año.' },
];

// Módulo 13 · Drag & drop. zone 0 = necesita multimodalidad, 1 = solo texto basta.
const DD_ITEMS: { text: string; zone: 0 | 1; why: string }[] = [
  { text: 'Identificar qué planta aparece en una fotografía', zone: 0, why: 'Necesita "ver" la imagen: es una tarea visual, no de texto.' },
  { text: 'Preguntar cuándo fue la Revolución Francesa', zone: 1, why: 'Es un dato de texto: la IA lo responde sin imágenes ni audio.' },
  { text: 'Traducir en tiempo real lo que dice alguien hablando en chino', zone: 0, why: 'Necesita oír el audio (y a veces ver): es multimodal.' },
  { text: 'Pedir que la IA escriba un poema sobre el otoño', zone: 1, why: 'Es pura generación de texto: no hace falta imagen ni audio.' },
  { text: 'Analizar el estado de daño de un auto en una foto de accidente', zone: 0, why: 'Necesita analizar la imagen del auto: es una tarea visual.' },
  { text: 'Preguntar cuánto es 245 dividido entre 7', zone: 1, why: 'Es un cálculo de texto: la IA lo resuelve sin otras modalidades.' },
];
const DD_ZONES = ['🔗 Necesita múltiples modalidades', '💬 Solo texto es suficiente'];

// Builders y reflexión
const BUILDERS: Record<number, { icon: string; label: string; title: string; intro: string; box: string; example?: string; placeholder: string; fb: string; terms: string[]; topicMsg: string; worldBadge?: boolean }> = {
  3: {
    icon: '✏️', label: 'Constructor', title: 'El prompt perfecto para analizar imágenes',
    intro: 'Una de las capacidades más útiles de la IA multimodal es analizar imágenes que tú le das. Diseña el prompt para estas situaciones:',
    box: '🌱 Situación A: le muestras la foto de una planta enferma de tu jardín\n🔢 Situación B: le muestras un ejercicio de matemáticas que no entiendes\n💻 Situación C: le muestras una captura de un error en tu computadora',
    example: '"En esta imagen hay una planta de tomate. Las hojas tienen manchas amarillas y el tallo se ve delgado. ¿Qué enfermedad o deficiencia podría ser y qué hago para salvarla?"',
    placeholder: 'Escribe el prompt para las situaciones B y C: ¿qué le dirías a la IA además de mostrarle la imagen?',
    fb: '🖼️ ¡Excelente! Esos prompts aprovechan la capacidad multimodal: combinar la imagen con contexto en texto da respuestas mucho más precisas.',
    terms: MULTI_TERMS, topicMsg: 'Escribe un prompt que combine la imagen con contexto en texto (síntomas, error, ejercicio...).',
  },
  7: {
    icon: '📄', label: 'Constructor', title: 'Analiza documentos extensos',
    intro: 'Una capacidad muy útil para estudiantes: subir un PDF largo y hacer preguntas específicas. Diseña el prompt para una de estas situaciones:',
    box: '📚 Tienes un libro de historia de 300 páginas y un examen mañana.\n📋 Tienes el reglamento escolar en PDF y quieres saber tus derechos.\n🔬 Tienes un artículo científico en inglés y necesitas entenderlo en español.',
    example: '"Te subo el capítulo 7 de mi libro de historia. Quiero que: 1) resumas los 5 eventos más importantes, 2) crees 10 preguntas de examen con respuestas, 3) expliques qué causó la guerra en términos simples para alguien de 12 años."',
    placeholder: 'Escribe el prompt para analizar el reglamento escolar o el artículo científico en inglés...',
    fb: '📄 ¡Ese prompt es justo lo que haría un estudiante inteligente! Pedir resumen + preguntas de examen + explicación simple aprovecha al máximo la IA multimodal.',
    terms: MULTI_TERMS, topicMsg: 'Escribe un prompt sobre el documento: pide resumen, preguntas, explicación o traducción.',
  },
  18: {
    icon: '🔗', label: 'Constructor', title: 'Diseña un proyecto multimodal completo',
    intro: 'Es hora de combinar todo lo que aprendiste en el Mundo 3. Diseña un proyecto que use varias modalidades de IA para resolver un problema real:',
    box: '❓ Problema real: ¿qué situación de tu vida o comunidad quieres mejorar?\n📥 Entradas: ¿qué tipos de datos usa? (texto/imagen/audio/video)\n🔄 Pipeline: ¿qué hace la IA con cada tipo de dato en secuencia?\n📤 Salida: ¿qué recibe el usuario final?\n💥 Impacto: ¿a quién ayuda y cómo?',
    example: '"App de patrimonio para Colombia: los turistas fotografían un monumento → la IA lo identifica y genera un audio explicativo en español e inglés → el usuario le pregunta por voz → la app guarda favoritos y crea un mapa de su recorrido."',
    placeholder: 'Describe tu proyecto multimodal: problema + entradas + pipeline + salida + impacto...',
    fb: '🔗 ¡Ese proyecto tiene todos los elementos de un producto real! Problema claro, varias modalidades bien justificadas y un impacto concreto. ¡Listo para un hackatón!',
    terms: MULTI_TERMS, topicMsg: 'Describe tu proyecto: el problema, las modalidades que usa (texto/imagen/audio/video) y el impacto.',
  },
  19: {
    icon: '💭', label: 'Reflexión de cierre', title: '¿Qué cambió en ti?',
    intro: 'Has pasado por 6 niveles increíbles del Mundo 3. Reflexiona sobre tu experiencia:',
    box: '🎨 ¿Cuál de las 6 IA creativas del Mundo 3 te parece más poderosa?\n✨ ¿Qué habilidad creativa con IA te emociona más aprender a usar?\n🚀 ¿Qué quieres crear que antes sentías imposible para ti?',
    placeholder: 'Escribe tu reflexión sobre el Mundo 3: qué aprendiste, qué te sorprendió más y qué vas a crear...',
    fb: '🎨 ¡Esa reflexión muestra un salto enorme en tu visión de lo que puedes crear con IA! El Mundo 4 te espera con las herramientas más poderosas del ecosistema.',
    terms: REFLECT_TERMS, topicMsg: 'Comparte tu reflexión del Mundo 3: qué te pareció más poderoso, qué te emociona y qué crearías.',
    worldBadge: true,
  },
};

// XP por módulo (campo xp real del HTML). Suma real = 265 (el header del HTML decía 250 — el conteo real manda)
const MODULE_XP: number[] = [0, 10, 15, 15, 10, 15, 15, 15, 10, 15, 15, 20, 10, 15, 15, 10, 10, 15, 20, 15, 0];
const MAX_XP = MODULE_XP.reduce((a, b) => a + b, 0); // 265
const TOTAL_STEPS = 21;   // 0=intro … 20=completado
const CONTENT_STEPS = 19; // módulos de contenido (1..19)
const SPRINT_DURATION = 90;

export default function Level18() {
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

  // VF (9, 17)
  const [vf1Answers, setVf1Answers] = useState<Record<number, boolean>>({});
  const [vf2Answers, setVf2Answers] = useState<Record<number, boolean>>({});

  // Sprint
  const [sprintPhase, setSprintPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [sprintSec, setSprintSec] = useState(SPRINT_DURATION);
  const [sprintText, setSprintText] = useState('');
  const [sprintValid, setSprintValid] = useState(false);

  // Sort (reordenar con flechas; resaltar mal ubicados al verificar)
  const [sortOrder, setSortOrder] = useState<number[]>(() => shuffle([0, 1, 2, 3, 4]));
  const [sortSolved, setSortSolved] = useState(false);
  const [sortWrong, setSortWrong] = useState<Set<number>>(new Set());

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
      const valid = sprintText.trim().length > 25 && !looksRandom(sprintText);
      setSprintValid(valid);
      setSprintPhase('done');
      if (valid) awardStep(MODULE_XP[11]);
      return;
    }
    const t = setTimeout(() => setSprintSec(s => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sprintPhase, sprintSec]);

  // Módulos puramente informativos (clasificación propia — el THEORY_STEPS del HTML omite el 15)
  const theorySteps = new Set([1, 4, 8, 12, 15, 16]);
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
    if (Platform.OS !== 'web' || step !== 13 || ddSolved) return;
    const cleanups: (() => void)[] = [];
    const setup = () => {
      DD_ITEMS.forEach((_, idx) => {
        if (ddPlacedRef.current[idx] !== undefined) return;
        const el = document.getElementById(`dd18-chip-${idx}`);
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
        const el = document.getElementById(`dd18-zone-${zone}`);
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
    const stars = xp >= 185 ? 3 : xp >= 120 ? 2 : 1;
    completeLevel(18, stars, xp);
    router.replace('/level/19');
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

  const answerVf1 = (idx: number, ans: boolean) => {
    if (vf1Answers[idx] !== undefined) return;
    const n = { ...vf1Answers, [idx]: ans };
    setVf1Answers(n);
    if (Object.keys(n).length === VF_ITEMS_1.length) awardStep(MODULE_XP[9]);
  };
  const answerVf2 = (idx: number, ans: boolean) => {
    if (vf2Answers[idx] !== undefined) return;
    const n = { ...vf2Answers, [idx]: ans };
    setVf2Answers(n);
    if (Object.keys(n).length === VF_ITEMS_2.length) awardStep(MODULE_XP[17]);
  };

  const submitSprint = () => {
    if (sprintPhase !== 'running') return;
    const valid = sprintText.trim().length > 25 && !looksRandom(sprintText);
    setSprintValid(valid);
    setSprintPhase('done');
    if (valid) awardStep(MODULE_XP[11]);
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
      awardStep(MODULE_XP[5]);
    } else {
      const wrong = new Set(sortOrder.reduce<number[]>((acc, v, i) => { if (v !== i) acc.push(i); return acc; }, []));
      setSortWrong(wrong);
      setTimeout(() => setSortWrong(new Set()), 3000);
    }
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
      awardStep(MODULE_XP[13]);
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
  const WorldBadge = () => (
    <View style={styles.worldBadge}>
      <Text style={styles.worldBadgeIcon}>🎨</Text>
      <Text style={styles.worldBadgeTitle}>¡Completaste el Mundo 3: IA Creativa!</Text>
      <Text style={styles.worldBadgeSub}>Imágenes · Audio · Video · Web · Datos · Multimodal</Text>
    </View>
  );

  // ---------- Render de módulos ----------
  const renderBuilder = () => {
    const b = BUILDERS[step];
    return (
      <>
        <ModuleType icon={b.icon} label={b.label} />
        <Title>{b.title}</Title>
        {b.worldBadge && <WorldBadge />}
        <Body>{b.intro}</Body>
        <InfoBox>{b.box}</InfoBox>
        {b.example && (
          <View style={styles.builderExample}>
            <Text style={styles.builderExampleText}><Text style={styles.builderExampleLabel}>Ejemplo: </Text>{b.example}</Text>
          </View>
        )}
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

  const renderVF = (items: typeof VF_ITEMS_1, answers: Record<number, boolean>, answer: (i: number, a: boolean) => void) => (
    <>
      {items.map((item, idx) => {
        const ans = answers[idx];
        return (
          <View key={idx} style={styles.vfItem}>
            <Text style={styles.vfStatement}>"{item.text}"</Text>
            <View style={styles.vfButtons}>
              <TouchableOpacity style={[styles.vfBtn, ans === true && (item.correct ? styles.vfBtnCorrect : styles.vfBtnWrong)]} disabled={ans !== undefined} onPress={() => answer(idx, true)}>
                <Text style={[styles.vfBtnText, ans === true && { color: item.correct ? C.okText : C.failText }]}>✅ Verdadero</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.vfBtn, ans === false && (!item.correct ? styles.vfBtnCorrect : styles.vfBtnWrong)]} disabled={ans !== undefined} onPress={() => answer(idx, false)}>
                <Text style={[styles.vfBtnText, ans === false && { color: !item.correct ? C.okText : C.failText }]}>❌ Falso</Text>
              </TouchableOpacity>
            </View>
            {ans !== undefined && <Fb ok={ans === item.correct}>{ans === item.correct ? '✅ ' : '❌ Incorrecto. '}{item.feedback}</Fb>}
          </View>
        );
      })}
    </>
  );

  const renderStep = (): ReactNode => {
    switch (step) {
      // ===== 0 · INTRO (con diagrama de flujo) =====
      case 0: return (
        <>
          <ModuleType icon="🔗" label="Introducción" />
          <Title>¿Qué significa multimodal?</Title>
          <Body>Imagina un asistente que puede ver lo que le muestras, escuchar lo que le dices, leer lo que escribes y responderte con texto, voz o imágenes — todo en la misma conversación. <B>Eso es una IA multimodal.</B></Body>
          <Body>Antes, las IA eran especializadas: una para texto, otra para imágenes, otra para voz. Ahora los modelos más avanzados como GPT-4o, Gemini 2.0 y Claude 3.5 manejan varias "modalidades" a la vez.</Body>
          <View style={styles.flowRow}>
            <View style={styles.flowNode}><Text style={styles.flowNodeText}>📝 Texto</Text></View>
            <Text style={styles.flowArrow}>+</Text>
            <View style={styles.flowNode}><Text style={styles.flowNodeText}>🖼️ Imagen</Text></View>
            <Text style={styles.flowArrow}>+</Text>
            <View style={styles.flowNode}><Text style={styles.flowNodeText}>🎵 Audio</Text></View>
            <Text style={styles.flowArrow}>+</Text>
            <View style={styles.flowNode}><Text style={styles.flowNodeText}>🎬 Video</Text></View>
            <Text style={styles.flowArrow}>→</Text>
            <View style={[styles.flowNode, { borderColor: C.green2 }]}><Text style={[styles.flowNodeText, { color: C.okText }]}>🤖 Una sola IA</Text></View>
          </View>
          <InfoBox><B>Analogía:</B> es la diferencia entre hablar con un especialista (un médico que solo sabe de huesos) y con un médico general (que evalúa todo tu cuerpo y conecta síntomas). La IA multimodal es el médico general.</InfoBox>
        </>
      );

      // ===== 1 · TEORÍA: GPT-4o =====
      case 1: return (
        <>
          <ModuleType icon="⚡" label="Casos reales" />
          <Title>GPT-4o: el modelo que lo ve y oye todo</Title>
          <Body>En mayo de 2024, OpenAI presentó <B>GPT-4o</B> (la "o" es de "omni", que significa "todo"). En la demo en vivo mostraron algo nunca visto:</Body>
          <Body>Un investigador sostenía una cámara en vivo y le pedía a GPT-4o que describiera lo que veía. La IA veía el ambiente en tiempo real, respondía con voz natural, reía con los chistes y ajustaba su tono según la emoción de la conversación.</Body>
          <Body>Luego le mostraron una ecuación escrita en papel y GPT-4o la resolvió paso a paso — sin tocar un teclado.</Body>
          <InfoBox><B>Lo que cambió:</B> antes, una IA de voz tardaba ~3 segundos en responder. GPT-4o responde en menos de 0.3 segundos, tan rápido como un humano en una conversación normal. Eso cambia todo sobre cómo interactuamos con la IA.</InfoBox>
        </>
      );

      // ===== 2 · MATCHING =====
      case 2: return (
        <>
          <ModuleType icon="🔗" label="Matching" />
          <Title>Capacidades multimodales</Title>
          <Body style={{ marginBottom: 16 }}>Conecta cada modelo con lo que puede hacer. Toca uno del lado izquierdo, luego el correcto del lado derecho.</Body>
          <View style={styles.matchGrid}>
            <View style={styles.matchCol}>
              {MATCH_PAIRS.map((pair, i) => (
                <TouchableOpacity
                  key={`l${i}`}
                  style={[styles.matchItem, selectedLeft === i && styles.matchItemSelected, matched.has(i) && styles.matchItemMatched, wrongFlash?.left === i && styles.matchItemWrong]}
                  disabled={matched.has(i)}
                  onPress={() => setSelectedLeft(i)}
                >
                  <Text style={[styles.matchItemText, selectedLeft === i && { color: C.fuchsiaLight }, matched.has(i) && { color: C.okText }, wrongFlash?.left === i && { color: C.failText }]}>{pair.left}</Text>
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
          {matched.size === MATCH_PAIRS.length && <Fb ok>✅ ¡Todos los pares conectados! Conoces las capacidades de cada modelo.</Fb>}
        </>
      );

      // ===== 3, 7, 18 · CONSTRUCTOR · 19 · REFLEXIÓN =====
      case 3: case 7: case 18: case 19: return renderBuilder();

      // ===== 4 · TEORÍA: pipeline =====
      case 4: return (
        <>
          <ModuleType icon="🔄" label="Teoría" />
          <Title>Cómo se conectan los modos</Title>
          <Body>Un <B>pipeline multimodal</B> es un flujo donde varios tipos de entrada y salida de IA se conectan en secuencia. Cada paso usa la salida del anterior como entrada.</Body>
          <InfoBox>
            <B>Ejemplo de pipeline para un proyecto de historia:</B>{'\n'}
            1. Fotografías tu libro → la IA lee el texto de la imagen (OCR){'\n'}
            2. Le pides que resuma el capítulo → genera texto{'\n'}
            3. Le pides imágenes históricas del período → DALL-E las crea{'\n'}
            4. Le pides narrar el resumen con voz → ElevenLabs genera el audio{'\n'}
            5. Combinas imágenes + audio → un video explicativo de 2 minutos
          </InfoBox>
          <Body>Lo que antes tomaba horas de trabajo manual, ahora se hace en minutos con el pipeline correcto. <B>El arquitecto del pipeline eres tú</B>; la IA ejecuta cada paso.</Body>
        </>
      );

      // ===== 5 · SORT =====
      case 5: return (
        <>
          <ModuleType icon="📋" label="Ordena" />
          <Title>Ordena el pipeline</Title>
          <Body style={{ marginBottom: 12 }}>Ordena los pasos de un pipeline para crear un video de noticias con IA, del primero al último. Usa las flechas.</Body>
          {sortOrder.map((origIdx, pos) => (
            <View key={pos} style={[styles.sortRow, sortWrong.has(pos) && styles.sortRowWrong, sortSolved && styles.sortRowOk]}>
              <Text style={styles.sortNum}>{pos + 1}</Text>
              <Text style={styles.sortText}>{SORT_ITEMS[origIdx]}</Text>
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
          {sortSolved && <Fb ok>✅ ¡Pipeline correcto! Así se construye un video de noticias con IA, paso a paso.</Fb>}
          {!sortSolved && sortWrong.size > 0 && <Fb ok={false}>❌ Los pasos en rojo aún no están en orden. Piensa qué necesitas primero para poder hacer el siguiente.</Fb>}
        </>
      );

      // ===== 6, 10, 14 · QUIZ =====
      case 6: case 10: case 14: return renderQuiz();

      // ===== 8 · TEORÍA: Gemini =====
      case 8: return (
        <>
          <ModuleType icon="✦" label="Casos reales" />
          <Title>Gemini Live: la IA que ve tu pantalla</Title>
          <Body><B>Gemini 2.0</B> de Google lleva la multimodalidad a otro nivel. Con <B>Gemini Live</B> puedes:</Body>
          <Body><B>📱 Compartir tu pantalla:</B> Gemini ve en tiempo real lo que haces en tu teléfono y te ayuda a navegar o resolver problemas.</Body>
          <Body><B>📷 Activar la cámara:</B> apunta a cualquier objeto y Gemini lo identifica, explica su historia o traduce texto en tiempo real.</Body>
          <Body><B>🌍 Traducción en vivo:</B> hablas en español mientras Gemini traduce en tiempo real a otro idioma.</Body>
          <InfoBox><B>Caso real:</B> un estudiante de Bogotá está en un mercado en China y no habla mandarín. Activa Gemini Live, apunta la cámara a los letreros y Gemini se los lee y traduce mientras camina. ¡La barrera del idioma desaparece!</InfoBox>
        </>
      );

      // ===== 9 · VF qué puede/no =====
      case 9: return (
        <>
          <ModuleType icon="✔️" label="Verdadero o Falso" />
          <Title>¿Qué puede y qué no?</Title>
          {renderVF(VF_ITEMS_1, vf1Answers, answerVf1)}
        </>
      );

      // ===== 11 · SPRINT =====
      case 11: {
        const minutes = Math.floor(sprintSec / 60);
        const seconds = String(sprintSec % 60).padStart(2, '0');
        return (
          <>
            <ModuleType icon="⚡" label="Sprint" />
            <Title>Sprint multimodal</Title>
            <View style={styles.sprintBox}>
              <Text style={styles.sprintInstruction}>⚡ ¡90 segundos! Diseña un proyecto que use AL MENOS 3 modalidades de IA. Describe: qué entra, qué procesa y qué sale.</Text>
              <Text style={[styles.timerText, sprintPhase === 'running' && sprintSec <= 20 ? styles.timerDanger : sprintPhase === 'running' && sprintSec <= 45 ? styles.timerWarning : null]}>
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
              placeholder={'Mi proyecto se llama: ...\nEntrada: (texto + imagen + audio + video)\nProceso: (qué hace la IA con cada modalidad)\nSalida final: ...'}
              placeholderTextColor={C.placeholder}
              multiline
              value={sprintText}
              onChangeText={setSprintText}
              editable={sprintPhase === 'running'}
            />
            {sprintPhase === 'running' && (
              <TouchableOpacity style={[styles.btn, sprintText.trim().length <= 25 && styles.mainBtnDisabled]} onPress={submitSprint} disabled={sprintText.trim().length <= 25}>
                <Text style={styles.btnText}>Entregar ✓</Text>
              </TouchableOpacity>
            )}
            {sprintPhase === 'done' && (
              <Fb ok={sprintValid}>⚡ ¡Sprint terminado! {sprintValid ? 'Proyecto multimodal diseñado: combinaste varias modalidades en un flujo coherente.' : 'La próxima vez intenta describir 3 modalidades y el flujo completo.'}</Fb>
            )}
          </>
        );
      }

      // ===== 12 · TEORÍA: accesibilidad =====
      case 12: return (
        <>
          <ModuleType icon="♿" label="Impacto real" />
          <Title>La IA que describe el mundo</Title>
          <Body>Uno de los usos más hermosos de la IA multimodal es la accesibilidad para personas con discapacidad:</Body>
          <Body><B>👁️ Discapacidad visual:</B> Be My Eyes + GPT-4o permite que personas ciegas apunten su cámara a algo y reciban una descripción en voz: "Tienes delante una lata de atún de 400g, vence el 12 de marzo de 2026".</Body>
          <Body><B>👂 Discapacidad auditiva:</B> la transcripción en tiempo real convierte cualquier audio o video en subtítulos instantáneos, identificando quién habla.</Body>
          <Body><B>🗣️ Discapacidad del habla:</B> interfaces que permiten comunicarse por imagen o texto y que la IA "hable" por la persona con su propia voz clonada.</Body>
          <InfoBox><B>Impacto real:</B> tras integrar GPT-4o, Be My Eyes reportó que muchas más personas ciegas pueden navegar de forma independiente en lugares desconocidos. La IA multimodal literalmente devuelve autonomía.</InfoBox>
        </>
      );

      // ===== 13 · DRAG & DROP =====
      case 13: return (
        <>
          <ModuleType icon="↕️" label="Clasifica" />
          <Title>¿Necesita multimodalidad?</Title>
          <Body>Clasifica cada tarea: ¿necesita varias modalidades o solo texto basta? Toca una y luego su zona (o arrástrala).</Body>
          <View style={styles.dragPool}>
            {DD_ITEMS.map((item, idx) => ddPlaced[idx] === undefined ? (
              <TouchableOpacity key={idx} id={`dd18-chip-${idx}`} style={[styles.dragItem, ddSel === idx && styles.dragItemSel]} disabled={ddSolved} onPress={() => setDdSel(ddSel === idx ? null : idx)}>
                <Text style={styles.dragItemText}>{item.text}</Text>
              </TouchableOpacity>
            ) : null)}
            {ddAllPlaced && <Text style={{ color: C.placeholder, fontSize: 12 }}>Todas las tareas clasificadas ✓</Text>}
          </View>
          {([0, 1] as const).map(zone => (
            <View key={zone}>
              <Text style={styles.dropZoneLabel}>{DD_ZONES[zone]}</Text>
              <TouchableOpacity id={`dd18-zone-${zone}`} activeOpacity={0.8} style={[styles.dropZone, ddOverZone === zone && styles.dropZoneOver]} disabled={ddSolved} onPress={() => ddPlace(zone)}>
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
          {ddChecked && ddSolved && <Fb ok>✅ ¡Clasificación perfecta! Sabes cuándo una tarea necesita varias modalidades y cuándo basta el texto.</Fb>}
          {ddChecked && !ddSolved && (
            <>
              <Fb ok={false}>❌ Algunas no están bien. Toca las marcadas con ✕ para devolverlas y vuelve a intentarlo.</Fb>
              {DD_ITEMS.map((item, idx) => ddPlaced[idx] !== undefined && ddPlaced[idx] !== item.zone ? (
                <Fb key={idx} ok={false}>✕ "{item.text}" va en <Text style={{ fontWeight: '700' }}>{DD_ZONES[item.zone]}</Text>. {item.why}</Fb>
              ) : null)}
            </>
          )}
        </>
      );

      // ===== 15 · TEORÍA: proyectos reales =====
      case 15: return (
        <>
          <ModuleType icon="🌍" label="Casos reales" />
          <Title>Aplicaciones que ya cambian vidas</Title>
          <Body><B>🌾 Plantix (Alemania/India):</B> agricultores fotografían sus cultivos enfermos y reciben diagnóstico y tratamiento en segundos. La usan más de 30 millones de agricultores en 90 países, incluyendo zonas rurales de Colombia y México.</Body>
          <Body><B>🏥 DeepMind + NHS (Reino Unido):</B> una IA analiza imágenes de retina e identifica más de 50 condiciones médicas con precisión comparable a especialistas: detecta diabetes, glaucoma y degeneración macular.</Body>
          <Body><B>📚 Duolingo + IA multimodal:</B> corrige la pronunciación en tiempo real, analiza expresiones durante las conversaciones y personaliza el ritmo de aprendizaje.</Body>
          <InfoBox><B>El patrón común:</B> los mejores proyectos multimodales combinan una necesidad humana real + varios tipos de datos + IA, para crear algo que antes era imposible o demasiado caro.</InfoBox>
        </>
      );

      // ===== 16 · TEORÍA: el futuro =====
      case 16: return (
        <>
          <ModuleType icon="🔮" label="El futuro" />
          <Title>¿Hacia dónde va la multimodalidad?</Title>
          <Body>La tendencia es clara: los modelos convergen hacia sistemas cada vez más unificados que manejan todos los tipos de datos a la vez.</Body>
          <Body><B>Project Astra</B> (Google DeepMind, 2024): un agente que "ve" el mundo por la cámara del teléfono de forma continua, recuerda lo que vio antes en la misma sesión y actúa como asistente proactivo, sugiriendo antes de que preguntes.</Body>
          <Body><B>Operator</B> (OpenAI, 2025): una IA que no solo responde, sino que actúa — navega webs, rellena formularios y completa tareas por ti.</Body>
          <InfoBox><B>La pregunta importante:</B> a medida que las IA se vuelven más autónomas y multimodales, ¿cómo mantenemos el control? ¿Dónde termina la herramienta y empieza algo que actúa por su cuenta? Es uno de los debates más importantes de la IA hoy.</InfoBox>
        </>
      );

      // ===== 17 · VF multimodalidad =====
      case 17: return (
        <>
          <ModuleType icon="✔️" label="Verdadero o Falso" />
          <Title>Multimodalidad: ¿verdadero o falso?</Title>
          {renderVF(VF_ITEMS_2, vf2Answers, answerVf2)}
        </>
      );

      // ===== 20 · COMPLETADO (cierre del Mundo 3) =====
      case 20: return (
        <View style={styles.completionScreen}>
          <Text style={styles.completionIcon}>🔗</Text>
          <Text style={styles.completionTitle}>¡Mundo 3 completado!</Text>
          <Text style={styles.completionBadge}>🏅 Multimodal Explorer</Text>
          <WorldBadge />
          <Text style={styles.completionText}>
            ¡Completaste los 6 niveles del Mundo 3! Ahora eres un creador multimodal: imágenes, audio, video, web, datos y flujos completos con IA.
          </Text>
          <Text style={styles.xpGained}>+<Text style={{ color: C.fuchsiaLight }}>{xp}</Text> XP</Text>
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
              <Text style={styles.statNum}>M4</Text>
              <Text style={styles.statLbl}>Próximo mundo</Text>
            </View>
          </View>
          <View style={styles.nextLevelBox}>
            <Text style={styles.nextLevelText}>
              🏆 <Text style={{ fontWeight: '700', color: C.text }}>Mundo 4: El Gran Torneo de Herramientas{'\n\n'}</Text>
              Empiezas un mundo nuevo comparando y dominando las herramientas de IA más poderosas del ecosistema.
            </Text>
          </View>
          <TouchableOpacity style={[styles.btn, { width: '100%' }]} onPress={finishLevel}>
            <Text style={styles.btnText}>Siguiente mundo →</Text>
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
      case 1: case 4: case 8: case 12: case 15: case 16:
        return { label: 'Continuar →', enabled: true, onPress: () => { awardStep(MODULE_XP[step]); next(); } };
      case 6: case 10: case 14:
        return { label: 'Continuar →', enabled: quizSel !== null || devMode, note: quizSel === null ? `Responde para continuar · +${MODULE_XP[step]} XP` : undefined, onPress: next };
      case 3: case 7: case 18: case 19: {
        const isReflect = step === 19;
        if (!builderDone) return { label: isReflect ? 'Enviar reflexión →' : 'Confirmar →', enabled: builderText.trim().length > 15 || devMode, note: `Escribe al menos 16 caracteres · +${MODULE_XP[step]} XP`, onPress: confirmBuilder };
        return { label: step === 19 ? 'Completar Mundo 3 →' : 'Continuar →', enabled: true, onPress: next };
      }
      case 2: return { label: 'Continuar →', enabled: matched.size === MATCH_PAIRS.length || devMode, note: matched.size < MATCH_PAIRS.length ? `Conecta los ${MATCH_PAIRS.length} pares · +${MODULE_XP[step]} XP` : undefined, onPress: next };
      case 5:
        if (!sortSolved) return { label: 'Verificar orden →', enabled: true, note: `Ordena el pipeline del primer paso al último · +${MODULE_XP[step]} XP`, onPress: checkSort };
        return { label: 'Continuar →', enabled: true, onPress: next };
      case 9: return { label: 'Continuar →', enabled: Object.keys(vf1Answers).length === VF_ITEMS_1.length || devMode, note: `Responde las ${VF_ITEMS_1.length} afirmaciones · +${MODULE_XP[step]} XP`, onPress: next };
      case 11: return { label: 'Continuar →', enabled: sprintPhase === 'done' || devMode, note: sprintPhase !== 'done' ? 'Diseña tu proyecto y pulsa "Entregar" · +20 XP' : undefined, onPress: next };
      case 13:
        if (!ddChecked || (!ddSolved && !ddAllCorrect)) return { label: 'Verificar →', enabled: ddAllPlaced || devMode, note: `Clasifica las ${DD_ITEMS.length} tareas · +${MODULE_XP[step]} XP`, onPress: verifyDd };
        return { label: 'Continuar →', enabled: true, onPress: next };
      case 17: return { label: 'Continuar →', enabled: Object.keys(vf2Answers).length === VF_ITEMS_2.length || devMode, note: `Responde las ${VF_ITEMS_2.length} afirmaciones · +${MODULE_XP[step]} XP`, onPress: next };
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
          <View style={styles.levelBadge}><Text style={styles.levelBadgeText}>🔗 MUNDO 3 · NIVEL 18</Text></View>
          <Text style={styles.levelTitle}>IA <Text style={{ color: C.fuchsiaLight }}>Multimodal</Text>: Todo al Mismo Tiempo</Text>
          <Text style={styles.subtitle}>Texto + imagen + audio + video en una sola IA</Text>
          <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
          <View style={styles.progressLabelRow}>
            <Text style={styles.progressLabel}>{step === 0 ? 'Introducción' : step < TOTAL_STEPS - 1 ? `Módulo ${step} de ${CONTENT_STEPS}` : '¡Mundo 3 completado!'}</Text>
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

      {xpToast && <XPToast key={xpToast.id} amount={xpToast.amount} onHide={() => setXpToast(null)} bgColor={C.fuchsia} textColor="#fff" />}
    </View>
  );
}

// ===================== ESTILOS (paleta oscura fucsia del HTML nivel-18) =====================
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },

  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingTop: 11, paddingBottom: 8, backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.border },
  closeBtn: { minWidth: 42, minHeight: 42, borderRadius: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 12, color: C.fuchsiaLight, fontWeight: '800' },
  xpChip: { paddingHorizontal: 11, paddingVertical: 4, borderRadius: 12, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border },
  xpChipText: { fontSize: 12, color: C.fuchsiaLight, fontWeight: '700' },

  container: { padding: 16, paddingBottom: 28 },

  // Header del nivel
  header: { marginBottom: 20 },
  levelBadge: { alignSelf: 'flex-start', backgroundColor: C.violet, borderRadius: 99, paddingHorizontal: 16, paddingVertical: 6, marginBottom: 12 },
  levelBadgeText: { ...typography.bold, fontSize: 12, color: '#fff', letterSpacing: 0.6 },
  levelTitle: { ...typography.extraBold, fontSize: 26, color: C.text, lineHeight: 32 },
  subtitle: { ...typography.regular, fontSize: 13, color: C.muted, marginTop: 4, marginBottom: 14 },
  progressBar: { width: '100%', height: 8, backgroundColor: C.border, borderRadius: 99, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: C.fuchsia, borderRadius: 99 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  progressLabel: { fontSize: 11, color: C.muted, fontWeight: '500' },

  // Tarjeta del módulo
  moduleCard: { backgroundColor: C.card, borderRadius: 16, padding: 22, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  moduleCardAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: C.fuchsia },
  moduleXpBadge: { position: 'absolute', top: 14, right: 14, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  moduleXpBadgeText: { fontSize: 11, fontWeight: '700', color: C.fuchsiaLight },
  moduleType: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  moduleTypeText: { ...typography.bold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: C.fuchsiaLight },
  moduleTitle: { ...typography.extraBold, fontSize: 19, color: C.text, marginBottom: 14, lineHeight: 25 },
  bodyText: { ...typography.regular, fontSize: 14, lineHeight: 23, color: C.muted, marginBottom: 12 },
  bold: { fontWeight: '700', color: C.text },
  infoBox: { backgroundColor: C.card2, borderLeftWidth: 4, borderLeftColor: C.fuchsia, borderTopRightRadius: 12, borderBottomRightRadius: 12, paddingHorizontal: 16, paddingVertical: 13, marginBottom: 14 },
  infoBoxText: { ...typography.regular, fontSize: 13, lineHeight: 24, color: C.muted },

  // Flow diagram (intro)
  flowRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', gap: 4, marginBottom: 14 },
  flowNode: { backgroundColor: C.card2, borderWidth: 2, borderColor: C.fuchsia, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 },
  flowNodeText: { fontSize: 12, fontWeight: '700', color: C.fuchsiaLight, textAlign: 'center' },
  flowArrow: { color: C.muted, fontSize: 16, marginHorizontal: 1 },

  // World badge
  worldBadge: { backgroundColor: C.purple, borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 14 },
  worldBadgeIcon: { fontSize: 42, marginBottom: 6 },
  worldBadgeTitle: { fontSize: 15, fontWeight: '800', color: '#fff', textAlign: 'center' },
  worldBadgeSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4, textAlign: 'center' },

  // Quiz
  option: { flexDirection: 'row', backgroundColor: C.card2, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 12, marginBottom: 10, borderWidth: 2, borderColor: C.border, alignItems: 'center' },
  optionCorrect: { borderColor: C.green2, backgroundColor: C.okBg },
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
  matchItemSelected: { borderColor: C.fuchsiaLight, backgroundColor: '#380055' },
  matchItemMatched: { borderColor: C.green2, backgroundColor: C.okBg },
  matchItemWrong: { borderColor: C.red, backgroundColor: C.failBg },
  matchItemText: { fontSize: 12, color: C.text, textAlign: 'center', lineHeight: 17, fontWeight: '500' },

  // Builder
  builderInput: { backgroundColor: C.surface, borderWidth: 2, borderColor: C.border, borderRadius: 12, padding: 14, fontSize: 14, lineHeight: 21, color: C.text, minHeight: 100, marginVertical: 10, textAlignVertical: 'top' },
  builderExample: { backgroundColor: C.card2, borderLeftWidth: 3, borderLeftColor: C.fuchsiaLight, borderTopRightRadius: 10, borderBottomRightRadius: 10, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12 },
  builderExampleText: { fontSize: 13, color: C.muted, lineHeight: 20, fontStyle: 'italic' },
  builderExampleLabel: { color: C.fuchsiaLight, fontWeight: '700', fontStyle: 'normal' },

  // Sprint
  sprintBox: { backgroundColor: '#200030', borderWidth: 2, borderColor: C.fuchsia, borderRadius: 16, padding: 22, alignItems: 'center', marginBottom: 12 },
  sprintInstruction: { textAlign: 'center', marginBottom: 6, fontSize: 13, lineHeight: 20, color: C.muted },
  timerText: { fontSize: 44, fontWeight: '800', color: C.fuchsiaLight, fontVariant: ['tabular-nums'], marginVertical: 8 },
  timerWarning: { color: C.yellow },
  timerDanger: { color: C.red },

  // VF
  vfItem: { marginBottom: 12, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 16 },
  vfStatement: { fontSize: 13, fontWeight: '600', marginBottom: 12, color: C.text, lineHeight: 20 },
  vfButtons: { flexDirection: 'row', gap: 8 },
  vfBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 2, borderColor: C.border, alignItems: 'center', backgroundColor: 'transparent' },
  vfBtnCorrect: { borderColor: C.green2, backgroundColor: C.okBg },
  vfBtnWrong: { borderColor: C.red, backgroundColor: C.failBg },
  vfBtnText: { ...typography.bold, fontSize: 12, color: C.muted },

  // Sort
  sortRow: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: C.card2, borderRadius: 10, borderWidth: 2, borderColor: C.border, marginBottom: 8 },
  sortRowWrong: { borderColor: C.red, backgroundColor: C.failBg },
  sortRowOk: { borderColor: C.green2, backgroundColor: C.okBg },
  sortNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: C.fuchsia, color: '#2a0040', textAlign: 'center', lineHeight: 26, fontWeight: '800', fontSize: 12, marginRight: 10, overflow: 'hidden' },
  sortText: { flex: 1, fontSize: 12, color: C.text, lineHeight: 17 },
  sortArrows: { flexDirection: 'column', marginLeft: 8 },
  sortArrow: { fontSize: 14, color: C.fuchsiaLight, paddingVertical: 2, paddingHorizontal: 4 },

  // Drag & drop
  dragPool: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 14, backgroundColor: C.card2, borderWidth: 2, borderStyle: 'dashed', borderColor: C.border, borderRadius: 12, minHeight: 70, marginBottom: 12, alignItems: 'center' },
  dragItem: { backgroundColor: C.surface, borderWidth: 2, borderColor: C.border, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  dragItemSel: { borderColor: C.fuchsia, backgroundColor: '#380055' },
  dragItemOk: { borderColor: C.green2, backgroundColor: C.okBg },
  dragItemBad: { borderColor: C.red, backgroundColor: C.failBg },
  dragItemText: { fontSize: 12, color: C.text, lineHeight: 17 },
  dropZoneLabel: { fontSize: 12, fontWeight: '700', color: C.fuchsiaLight, marginBottom: 6 },
  dropZone: { minHeight: 60, padding: 12, borderWidth: 2, borderStyle: 'dashed', borderColor: C.border, borderRadius: 12, backgroundColor: C.card2, marginBottom: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' },
  dropZoneOver: { borderColor: C.fuchsia, backgroundColor: '#380055' },

  // Botones
  btn: { backgroundColor: C.fuchsia, padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 12 },
  btnText: { ...typography.bold, color: '#fff', fontSize: 14 },

  // Completado
  completionScreen: { alignItems: 'center', paddingVertical: 20 },
  completionIcon: { fontSize: 64, marginBottom: 12 },
  completionTitle: { ...typography.extraBold, fontSize: 26, color: C.fuchsiaLight, textAlign: 'center', marginBottom: 4 },
  completionBadge: { ...typography.extraBold, fontSize: 20, color: C.fuchsiaLight, marginVertical: 8 },
  completionText: { ...typography.regular, fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 16, color: C.muted },
  xpGained: { ...typography.extraBold, fontSize: 34, color: C.text, marginBottom: 16 },
  statsRow: { flexDirection: 'row', width: '100%', gap: 8, marginBottom: 16 },
  statItem: { flex: 1, alignItems: 'center', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 8 },
  statNum: { ...typography.extraBold, fontSize: 20, color: C.fuchsiaLight },
  statLbl: { fontSize: 10, color: C.muted, marginTop: 2, textAlign: 'center' },
  nextLevelBox: { backgroundColor: C.card2, borderRadius: 10, padding: 13, marginBottom: 16, borderWidth: 1, borderColor: C.border, width: '100%' },
  nextLevelText: { fontSize: 12, color: C.muted, lineHeight: 20 },

  // Footer
  btnRow: { paddingHorizontal: 13, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.surface },
  btnRowInner: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  backBtn: { paddingHorizontal: 16, paddingVertical: 13, borderRadius: 10, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, minHeight: 48, justifyContent: 'center' },
  backBtnText: { fontSize: 14, fontWeight: '700', color: C.muted },
  mainBtn: { padding: 13, borderRadius: 10, backgroundColor: C.fuchsia, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  mainBtnDisabled: { opacity: 0.35 },
  btnNote: { fontSize: 11, color: C.placeholder, textAlign: 'center', marginTop: 5, minHeight: 15 },
});
