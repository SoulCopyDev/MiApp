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

// ===================== PALETA (hex exactos del HTML nivel-15, tema oscuro dorado M3) =====================
const C = {
  bg: '#0f0800', surface: '#1a1100', card: '#241700', card2: '#2e1d00',
  text: '#fef9ed', muted: '#c9a84c', border: '#3d2800',
  gold: '#f59e0b', goldLight: '#fcd34d', warm: '#fbbf24', amber: '#d97706', orange: '#ea580c',
  green: '#22c55e', okBg: '#052e16', okBorder: '#16a34a', okText: '#86efac',
  red: '#ef4444', failBg: '#2d0707', failBorder: '#dc2626', failText: '#fca5a5',
  yellow: '#fbbf24',
  placeholder: '#7a5f28',
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

const VIDEO_TERMS = ['video', 'escena', 'camara', 'plano', 'personaje', 'accion', 'mueve', 'movimiento', 'estilo', 'segundos', 'zoom', 'paneo', 'cinematic', 'cinematico', 'realista', 'animacion', 'luz', 'graba', 'guion', 'dialogo', 'musica', 'mensaje', 'corto', 'pelicula'];
const REFLECT_TERMS = ['ia', 'video', 'arte', 'artista', 'artistas', 'cine', 'pelicula', 'peliculas', 'actor', 'actores', 'deepfake', 'copyright', 'derechos', 'futuro', 'tecnologia', 'creativ', 'creatividad', 'humano', 'humanos', 'opinion', 'pienso', 'creo', 'emociona', 'preocupa', 'sorprend', 'proyecto', 'peligro', 'peligroso'];

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

// ===================== DATOS (fieles al HTML nivel-15) =====================
type QuizMod = { title: string; question: string; options: string[]; correct: number; feedback: string };

// Quizzes con opciones balanceadas en longitud (la correcta no debe ser la más larga)
const QUIZZES: Record<number, QuizMod> = {
  8: {
    title: 'IA en las noticias',
    question: 'Un periódico en India publica un video que supuestamente muestra a un político haciendo declaraciones polémicas. Antes de compartirlo, ¿cuál es la acción más inteligente?',
    options: [
      'Compartirlo de inmediato con todos tus contactos porque el video parece muy real',
      'Verificar la fuente original y buscar el video en medios de confianza antes de compartir',
      'Compartirlo solo si ya tiene más de un millón de reproducciones en internet',
      'Preguntarle a un chatbot de IA si cree que el video es verdadero o falso',
    ],
    correct: 1,
    feedback: 'Esta es la regla de oro del periodismo digital: verificar antes de compartir. Los deepfakes de políticos ya han causado crisis reales en elecciones de varios países de Asia y África.',
  },
  10: {
    title: 'Hollywood y la IA',
    question: '¿Para qué usa Hollywood principalmente la IA de video en este momento (no para reemplazar actores completos)?',
    options: [
      'Para eliminar por completo a los actores humanos y ahorrar dinero en sus salarios',
      'Para previsualizar escenas antes de filmarlas y mejorar los efectos en la post-producción',
      'Para crear películas enteras sin que ningún ser humano participe en el proceso',
      'Solo para anuncios de publicidad en televisión, nunca para películas de cine',
    ],
    correct: 1,
    feedback: 'Por ahora, Hollywood usa la IA como herramienta creativa de apoyo: visualizar escenas antes de filmarlas y mejorar efectos especiales. Los actores humanos siguen siendo esenciales para la actuación principal.',
  },
  14: {
    title: 'El pipeline completo',
    question: 'Valentina quiere crear un video completo para su proyecto escolar: necesita un video animado, una narración con su voz y música de fondo. ¿Cuál es el pipeline correcto de herramientas de IA?',
    options: [
      'Solo ChatGPT puede encargarse del video, la narración y la música, todo al mismo tiempo',
      'Pika o Runway para el video, ElevenLabs para la voz y Suno para la música',
      'Únicamente se puede lograr contratando a un equipo profesional de producción audiovisual',
      'Usar Midjourney primero y luego ir convirtiendo todas las imágenes a video a mano',
    ],
    correct: 1,
    feedback: 'Este es el flujo de trabajo real que usan los creadores hoy: IA de video + IA de voz + IA de música = una producción audiovisual completa con herramientas accesibles para cualquiera.',
  },
  18: {
    title: 'Quiz final de video',
    question: 'Tomás en Argentina quiere hacer un video corto para el proyecto de historia de su colegio, animando imágenes de la época colonial. Tiene presupuesto cero. ¿Cuál es la mejor opción?',
    options: [
      'Contratar a una productora de video profesional para que haga todo el proyecto completo',
      'Usar Pika o Luma (plan gratuito) para animar las imágenes y editarlas en CapCut',
      'Esperar unos cinco años hasta que la IA de video sea totalmente gratuita para todos',
      'Hacerlo únicamente con software profesional de pago, como Adobe Premiere Pro',
    ],
    correct: 1,
    feedback: 'Pika y Luma tienen planes gratuitos suficientes para proyectos escolares. Con CapCut (también gratuito) puede editar, añadir texto y música. ¡Tomás puede hacer un video increíble sin gastar un peso!',
  },
};

// Módulo 2 · Matching
const MATCH_PAIRS = [
  { left: '🎬 Veo (Google)', right: 'Genera video y sonido a la vez, integrado con las apps de Google' },
  { left: '✂️ Runway ML', right: 'Especialista en edición: quita fondos y añade efectos especiales con IA' },
  { left: '🎥 Pika Labs', right: 'Anima imágenes estáticas y crea cortos artísticos animados' },
  { left: '🇨🇳 Kling AI', right: 'Genera videos ultra realistas, fuerte en movimientos de personas' },
];

// Módulo 6 · Verdadero/Falso (deepfakes)
const VF_ITEMS_1 = [
  { text: 'Un deepfake de video siempre se puede detectar fácilmente porque la imagen se ve borrosa.', correct: false, feedback: 'FALSO. Los deepfakes modernos son extremadamente convincentes. Los mejores modelos pueden crear videos falsos que la mayoría de personas no distingue de lo real.' },
  { text: 'Los deepfakes de video solo pueden hacer que una persona diga cosas que nunca dijo.', correct: false, feedback: 'FALSO. Los deepfakes pueden cambiar la apariencia física, la voz, el contexto del video y más. No solo las palabras.' },
  { text: 'Existen leyes en varios países que hacen ilegal crear deepfakes de personas sin su permiso.', correct: true, feedback: 'VERDADERO. EE.UU., Reino Unido, Australia y la Unión Europea tienen leyes contra los deepfakes no consentidos, especialmente los de desinformación.' },
];

// Módulo 7 · Detector (señal real / no confiable)
const CLASSIFY_ITEMS = [
  { text: 'Los ojos se mueven de forma demasiado perfecta o los parpadeos no ocurren en momentos naturales', correct: 'real', feedback: '✅ Señal real. Los videos de IA de personas frecuentemente fallan con el parpadeo y los movimientos oculares.' },
  { text: 'El video tiene colores muy brillantes y vivos (la IA siempre genera colores brillantes)', correct: 'falsa', feedback: 'No es confiable. Los colores brillantes también aparecen en videos reales editados; la IA puede tener cualquier paleta.' },
  { text: 'Las manos de las personas se ven extrañas, con demasiados o muy pocos dedos', correct: 'real', feedback: '✅ Señal real. Igual que en imágenes, las IA de video tienen problemas con las manos. Es de las señales más confiables.' },
  { text: 'El fondo del video es perfectamente estático, sin ningún elemento que se mueva', correct: 'real', feedback: '✅ Señal real. Algunos modelos generan fondos estáticos aunque en una escena real habría movimiento (hojas, nubes...).' },
];

// Módulo 16 · Verdadero/Falso (límites)
const VF_ITEMS_2 = [
  { text: 'Las IA de video de hoy pueden generar perfectamente cualquier texto escrito dentro del video.', correct: false, feedback: 'FALSO. Igual que con imágenes, las IA de video tienen grandes dificultades generando texto legible dentro del video. Es uno de sus límites más evidentes.' },
  { text: 'Una IA de video puede generar escenas con física perfectamente realista (agua que cae, fuego que arde bien).', correct: false, feedback: 'FALSO. La física es uno de los mayores desafíos. A veces el agua "flota", las sombras no coinciden o los objetos se comportan de forma imposible.' },
  { text: 'Es posible generar un video de 5 segundos con IA desde texto en menos de 2 minutos.', correct: true, feedback: 'VERDADERO. Herramientas como Pika y Luma Dream Machine generan clips cortos en 1-3 minutos con hardware estándar en la nube.' },
];

// Módulo 15 · Drag & drop (gratis vs de pago). zone 0 = gratis, 1 = pago.
const DD_ITEMS: { text: string; zone: 0 | 1; why: string }[] = [
  { text: 'Pika Labs — plan gratuito limitado', zone: 0, why: 'Pika ofrece un plan gratuito (con límites) para empezar.' },
  { text: 'Kling — plan de pago para clips largos', zone: 1, why: 'Kling da unos pocos créditos gratis; para clips largos o en alta calidad hay que pagar.' },
  { text: 'CapCut AI — gratuito con funciones de IA', zone: 0, why: 'CapCut incluye funciones de IA en su plan gratuito.' },
  { text: 'Runway Pro — plan de pago profesional', zone: 1, why: 'Runway Pro es un plan de pago para uso profesional.' },
  { text: 'Luma Dream Machine — plan gratuito básico', zone: 0, why: 'Luma Dream Machine tiene un plan gratuito básico.' },
  { text: 'Adobe Firefly Video — requiere suscripción Adobe', zone: 1, why: 'Firefly Video necesita una suscripción de Adobe.' },
];
const DD_ZONES = ['🆓 Gratis / Plan gratuito disponible', '💰 Solo de pago / Muy limitado gratis'];

// Builders y reflexiones
const BUILDERS: Record<number, { icon: string; label: string; title: string; intro: string; box: string; example?: string; outro?: string; placeholder: string; fb: string; terms: string[]; topicMsg: string }> = {
  3: {
    icon: '✏️', label: 'Constructor', title: 'Escribe el guión de tu escena',
    intro: 'Un buen prompt de video necesita más elementos que uno de imagen. La clave: el movimiento debe ser claro.',
    box: '🎭 Personaje/sujeto: ¿quién o qué aparece?\n🎬 Acción: ¿qué hace? ¿cómo se mueve?\n🌍 Escenario: ¿dónde ocurre?\n🎨 Estilo visual: ¿realista? ¿animación? ¿cinemático?\n⏱️ Duración: ¿cuántos segundos?\n🎥 Movimiento de cámara: ¿zoom? ¿paneo? ¿vuelo?',
    example: '"Una joven estudiante de Nigeria corriendo en cámara lenta por un mercado colorido de Lagos, luz cálida de atardecer, la cámara la sigue desde atrás, 8 segundos, estilo documental artístico"',
    placeholder: 'Escribe tu prompt de video: personaje + acción + escenario + estilo + movimiento de cámara...',
    fb: '🎬 ¡Ese prompt tiene todos los elementos! Un director de cine de IA trabajaría muy bien con esta descripción.',
    terms: VIDEO_TERMS, topicMsg: 'Describe una escena de video: personaje, acción, escenario, estilo o movimiento de cámara.',
  },
  5: {
    icon: '💭', label: 'Reflexión', title: 'La pregunta del millón',
    intro: 'En 2024, el video musical "The Hardest Part" de Washed Out fue el primer video de un artista importante hecho completamente con IA. Se generó con Sora — la herramienta que cerró dos años después. El video sigue existiendo; la herramienta que lo hizo, no.',
    box: '🤔 ¿Quién es el "artista": quien escribe el prompt o la IA que lo genera?\n🎬 ¿Puede una IA "sentir" lo que quiere expresar artísticamente?\n⚖️ ¿Es justo que una IA compita con animadores que estudian años su oficio?',
    placeholder: '¿Crees que un video creado con IA es arte verdadero? ¿Por qué sí o por qué no?',
    fb: '💭 ¡Tu reflexión toca aspectos muy importantes! Filósofos, artistas y tecnólogos debaten esto exactamente ahora mismo.',
    terms: REFLECT_TERMS, topicMsg: 'Habla del tema: si el video con IA es arte, el papel del artista, los animadores o la creatividad.',
  },
  12: {
    icon: '🎬', label: 'Constructor', title: 'Crea tu guión de 30 segundos',
    intro: 'Ahora vas a ser director de cine. Escribe el guión detallado para un cortometraje de 30 segundos usando IA. Incluye:',
    box: '🎬 Escena: descripción visual detallada\n💬 Diálogo (si hay): lo que dicen los personajes\n🎨 Estilo visual: realista, anime, documental, ciencia ficción...\n🎵 Música/sonido: ¿qué se escucha?\n📌 Mensaje: ¿qué quieres que sienta el espectador?',
    example: '"Un niño de 8 años en Cartagena ve un mural enorme de mariposas. Se detiene. Las mariposas cobran vida y vuelan. El niño sonríe. Estilo realista-mágico. Música: marimba suave. Mensaje: la magia existe en lo cotidiano."',
    placeholder: 'Escribe tu guión de 30 segundos: escena + diálogo + estilo + música + mensaje...',
    fb: '🎬 ¡Ese guión tiene potencial! Escena clara, estilo definido y un mensaje. Con Veo, Runway o la herramienta que esté de moda cuando leas esto, podrías verlo hecho video en minutos.',
    terms: VIDEO_TERMS, topicMsg: 'Escribe un guión: escena, estilo, música o mensaje de tu cortometraje.',
  },
  17: {
    icon: '🔮', label: 'Reflexión', title: '¿Cine sin actores en 10 años?',
    intro: 'SAG-AFTRA (el sindicato de actores de Hollywood) negoció en 2023 acuerdos para proteger a los actores del uso de IA. Pero la tecnología avanza más rápido que las leyes.',
    box: '🎬 ¿Querrías ver una película donde todos los "actores" son generados por IA?\n👤 ¿Perdería algo especial una actuación si no hay un ser humano real detrás?\n💼 ¿Qué crees que deberían hacer actores, directores y guionistas para adaptarse?',
    placeholder: '¿Cómo imaginas el cine y la televisión en 2035 con la IA de video?',
    fb: '🎬 ¡Tu visión del futuro del cine muestra que piensas en las implicaciones humanas de la tecnología! Eso es lo que hacen los mejores innovadores.',
    terms: REFLECT_TERMS, topicMsg: 'Habla del futuro del cine: actores, películas, la IA de video o cómo adaptarse.',
  },
  19: {
    icon: '💭', label: 'Reflexión final', title: 'Tú y el video con IA',
    intro: 'Has recorrido un mundo increíble: cómo funciona el video de IA, deepfakes, copyright, herramientas y el futuro del cine. Ahora te preguntamos:',
    box: '🎬 ¿Qué proyecto de video con IA harías hoy si tuvieras la mejor herramienta a mano?\n✨ ¿Qué fue lo que más te sorprendió de este nivel?\n⚖️ ¿El video de IA hace el mundo más interesante o más peligroso?',
    placeholder: 'Escribe tu reflexión final sobre la IA que filma...',
    fb: '🎬 ¡Esa reflexión demuestra que eres un pensador crítico sobre la tecnología! Esa mezcla de creatividad y pensamiento crítico es justo lo que el mundo necesita.',
    terms: REFLECT_TERMS, topicMsg: 'Comparte tu reflexión: qué proyecto harías, qué te sorprendió, o si el video con IA es más interesante o peligroso.',
  },
};

// XP por módulo (campo xp real del HTML). Suma real = 265 (el header del HTML decía 250 — el conteo real manda)
const MODULE_XP: number[] = [0, 10, 15, 15, 10, 10, 15, 15, 10, 10, 15, 20, 15, 10, 15, 15, 15, 15, 20, 15, 0];
const MAX_XP = MODULE_XP.reduce((a, b) => a + b, 0); // 265
const TOTAL_STEPS = 21;   // 0=intro … 20=completado
const CONTENT_STEPS = 19; // módulos de contenido (1..19)
const SPRINT_DURATION = 90;

export default function Level15() {
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

  // VF (6, 16) y Classify (7)
  const [vf1Answers, setVf1Answers] = useState<Record<number, boolean>>({});
  const [vf2Answers, setVf2Answers] = useState<Record<number, boolean>>({});
  const [c3Answers, setC3Answers] = useState<Record<number, string>>({});

  // Sprint
  const [sprintPhase, setSprintPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [sprintSec, setSprintSec] = useState(SPRINT_DURATION);
  const [sprintText, setSprintText] = useState('');
  const [sprintValid, setSprintValid] = useState(false);

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
    setC3Answers({});
    setSprintPhase('idle');
    setSprintSec(SPRINT_DURATION);
    setSprintText('');
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

  // Módulos puramente informativos (clasificación propia — el THEORY_STEPS del HTML marca mal reflexiones)
  const theorySteps = new Set([1, 4, 9, 13]);
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
    if (Platform.OS !== 'web' || step !== 15 || ddSolved) return;
    const cleanups: (() => void)[] = [];
    const setup = () => {
      DD_ITEMS.forEach((_, idx) => {
        if (ddPlacedRef.current[idx] !== undefined) return;
        const el = document.getElementById(`dd15-chip-${idx}`);
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
        const el = document.getElementById(`dd15-zone-${zone}`);
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
    completeLevel(15, stars, xp);
    router.replace('/level/16');
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
    if (Object.keys(n).length === VF_ITEMS_1.length) awardStep(MODULE_XP[6]);
  };
  const answerVf2 = (idx: number, ans: boolean) => {
    if (vf2Answers[idx] !== undefined) return;
    const n = { ...vf2Answers, [idx]: ans };
    setVf2Answers(n);
    if (Object.keys(n).length === VF_ITEMS_2.length) awardStep(MODULE_XP[16]);
  };
  const answerC3 = (idx: number, ans: string) => {
    if (c3Answers[idx] !== undefined) return;
    const n = { ...c3Answers, [idx]: ans };
    setC3Answers(n);
    if (Object.keys(n).length === CLASSIFY_ITEMS.length) awardStep(MODULE_XP[7]);
  };

  const submitSprint = () => {
    if (sprintPhase !== 'running') return;
    const valid = sprintText.trim().length > 25 && !looksRandom(sprintText);
    setSprintValid(valid);
    setSprintPhase('done');
    if (valid) awardStep(MODULE_XP[11]);
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
      awardStep(MODULE_XP[15]);
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

  const renderVF = (items: typeof VF_ITEMS_1, answers: Record<number, boolean>, answer: (i: number, a: boolean) => void) => (
    <>
      {items.map((item, idx) => {
        const ans = answers[idx];
        return (
          <View key={idx} style={styles.vfItem}>
            <Text style={styles.vfStatement}>"{item.text}"</Text>
            <View style={styles.vfButtons}>
              <TouchableOpacity
                style={[styles.vfBtn, ans === true && (item.correct ? styles.vfBtnCorrect : styles.vfBtnWrong)]}
                disabled={ans !== undefined}
                onPress={() => answer(idx, true)}
              >
                <Text style={[styles.vfBtnText, ans === true && { color: item.correct ? C.okText : C.failText }]}>✅ Verdadero</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.vfBtn, ans === false && (!item.correct ? styles.vfBtnCorrect : styles.vfBtnWrong)]}
                disabled={ans !== undefined}
                onPress={() => answer(idx, false)}
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

  const renderStep = (): ReactNode => {
    switch (step) {
      // ===== 0 · INTRO =====
      case 0: return (
        <>
          <ModuleType icon="🎬" label="Introducción" />
          <Title>¿Puede la IA hacer una película?</Title>
          <Body>En 2024, el mundo se quedó sin palabras con <B>Sora</B>, de OpenAI: videos de hasta un minuto con calidad de cine. Perros en la nieve, ciudades futuristas, océanos en tormenta — todo desde texto, sin cámaras ni actores.</Body>
          <Body>En <B>abril de 2026, Sora cerró.</B> No porque funcionara mal: costaba cerca de un millón de dólares al día y casi nadie pagaba por él. La herramienta más asombrosa del momento desapareció en dos años.</Body>
          <InfoBox>
            <B>Empieza este nivel con esa idea en la cabeza:</B> las herramientas van y vienen. Los nombres de esta lista van a cambiar — puede que alguno ya no exista cuando leas esto. Lo que no caduca es saber <B>qué pedirle</B> a una IA de video y <B>cómo detectar</B> cuándo te están engañando con una.
          </InfoBox>
          <Body>En este nivel vas a entender cómo funciona la <B>generación de video con IA</B>, conocer las herramientas del momento y explorar su potencial creativo y sus riesgos más serios.</Body>
          <InfoBox>
            <B>Herramientas del momento:</B>{'\n'}
            🎬 <B>Veo</B> (Google) — video con sonido incluido{'\n'}
            🎞️ <B>Runway ML</B> — edición y generación creativa{'\n'}
            🎥 <B>Pika Labs</B> — animación y efectos especiales{'\n'}
            🇨🇳 <B>Kling AI</B> (China) — videos ultra realistas
          </InfoBox>
        </>
      );

      // ===== 1 · TEORÍA: cómo funciona =====
      case 1: return (
        <>
          <ModuleType icon="🧠" label="Teoría" />
          <Title>Imágenes que se mueven: el secreto técnico</Title>
          <Body>Un video es una secuencia de imágenes (fotogramas) que se muestran muy rápido — normalmente <B>24 a 60 por segundo</B>. La IA no solo debe crear cada imagen perfecta, sino lograr que cada una tenga sentido respecto a la anterior y la siguiente.</Body>
          <Body><B>El proceso simplificado:</B></Body>
          <Body>1. Analiza tu descripción en texto{'\n'}2. Genera el primer fotograma{'\n'}3. Predice cómo se mueve cada elemento en el siguiente{'\n'}4. Repite miles de veces para crear movimiento fluido</Body>
          <InfoBox><B>¿Por qué es tan difícil?</B> Para un video de 5 segundos a 24 fps, la IA genera 120 imágenes coherentes entre sí. Si falla en una sola, el video se ve "roto". Por eso el video de IA es mucho más difícil que las imágenes.</InfoBox>
        </>
      );

      // ===== 2 · MATCHING =====
      case 2: return (
        <>
          <ModuleType icon="🔗" label="Matching" />
          <Title>Veo, Runway y Pika</Title>
          <Body style={{ marginBottom: 16 }}>Conecta cada herramienta con su descripción. Toca una del lado izquierdo, luego la correcta del lado derecho.</Body>
          <View style={styles.matchGrid}>
            <View style={styles.matchCol}>
              {MATCH_PAIRS.map((pair, i) => (
                <TouchableOpacity
                  key={`l${i}`}
                  style={[styles.matchItem, selectedLeft === i && styles.matchItemSelected, matched.has(i) && styles.matchItemMatched, wrongFlash?.left === i && styles.matchItemWrong]}
                  disabled={matched.has(i)}
                  onPress={() => setSelectedLeft(i)}
                >
                  <Text style={[styles.matchItemText, selectedLeft === i && { color: C.goldLight }, matched.has(i) && { color: C.okText }, wrongFlash?.left === i && { color: C.failText }]}>{pair.left}</Text>
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
          {matched.size === MATCH_PAIRS.length && <Fb ok>✅ ¡Todos los pares conectados! Conoces bien las herramientas de video con IA.</Fb>}
        </>
      );

      // ===== 3, 12 · CONSTRUCTOR · 5, 17, 19 · REFLEXIÓN =====
      case 3: case 5: case 12: case 17: case 19: return renderBuilder();

      // ===== 4 · TEORÍA: publicidad =====
      case 4: return (
        <>
          <ModuleType icon="📺" label="Casos reales" />
          <Title>Las marcas ya lo usan</Title>
          <Body>Grandes marcas del mundo ya incorporan la generación de video con IA en sus campañas:</Body>
          <Body><B>🥤 Coca-Cola:</B> en 2024 lanzó un comercial navideño co-creado con IA. Fue tan controversial que a muchos les encantó y otros lo odiaron.</Body>
          <Body><B>👟 Nike:</B> usa IA para generar variaciones de comerciales adaptadas a distintos países y culturas.</Body>
          <Body><B>🎬 Hollywood:</B> varios estudios usan IA para "concept videos" — borradores visuales de escenas antes de filmarlas.</Body>
          <InfoBox><B>El debate económico:</B> un comercial tradicional de 30 segundos cuesta entre $200,000 y $2,000,000 USD. Una IA puede generar uno similar por unos pocos dólares. ¿Qué pasará con directores, actores y equipos de producción?</InfoBox>
        </>
      );

      // ===== 6 · VF deepfakes =====
      case 6: return (
        <>
          <ModuleType icon="✔️" label="Verdadero o Falso" />
          <Title>Deepfakes de video</Title>
          {renderVF(VF_ITEMS_1, vf1Answers, answerVf1)}
        </>
      );

      // ===== 7 · DETECTOR (real / no confiable) =====
      case 7: return (
        <>
          <ModuleType icon="🔍" label="Detector" />
          <Title>¿Real o generado por IA?</Title>
          <Body style={{ marginBottom: 4 }}>Estas son señales que podrían delatar un video hecho con IA. Marca si cada una es una <B>señal real</B> o <B>no confiable</B>:</Body>
          {CLASSIFY_ITEMS.map((item, idx) => {
            const ans = c3Answers[idx];
            return (
              <View key={idx} style={styles.vfItem}>
                <Text style={styles.vfStatement}>{item.text}</Text>
                <View style={styles.vfButtons}>
                  <TouchableOpacity
                    style={[styles.vfBtn, ans === 'real' && (item.correct === 'real' ? styles.vfBtnCorrect : styles.vfBtnWrong)]}
                    disabled={ans !== undefined}
                    onPress={() => answerC3(idx, 'real')}
                  >
                    <Text style={[styles.vfBtnText, ans === 'real' && { color: item.correct === 'real' ? C.okText : C.failText }]}>✅ Señal real</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.vfBtn, ans === 'falsa' && (item.correct === 'falsa' ? styles.vfBtnCorrect : styles.vfBtnWrong)]}
                    disabled={ans !== undefined}
                    onPress={() => answerC3(idx, 'falsa')}
                  >
                    <Text style={[styles.vfBtnText, ans === 'falsa' && { color: item.correct === 'falsa' ? C.okText : C.failText }]}>❌ No confiable</Text>
                  </TouchableOpacity>
                </View>
                {ans !== undefined && <Fb ok={ans === item.correct}>{item.feedback}</Fb>}
              </View>
            );
          })}
        </>
      );

      // ===== 8, 10, 14, 18 · QUIZ =====
      case 8: case 10: case 14: case 18: return renderQuiz();

      // ===== 9 · TEORÍA: animación =====
      case 9: return (
        <>
          <ModuleType icon="✨" label="Casos reales" />
          <Title>De foto estática a video en segundos</Title>
          <Body>Una de las aplicaciones más asombrosas es la <B>animación de imágenes estáticas</B>. Con Runway o Pika puedes:</Body>
          <Body><B>🖼️ Foto → Video:</B> tomar una foto familiar y hacer que las personas "se muevan" suavemente.</Body>
          <Body><B>🎨 Arte → Animación:</B> convertir un dibujo o pintura en una animación corta.</Body>
          <Body><B>📸 Retrato → Hablante:</B> hacer que una foto "hable" sincronizando los labios con un audio.</Body>
          <InfoBox><B>Uso inspirador:</B> en Japón, varios museos han "animado" cuadros famosos para que el "artista" explique su obra. El Museo del Prado en España ya experimenta con esto para conectar con audiencias jóvenes.</InfoBox>
          <Body>Pero esta misma tecnología puede crear videos falsos de personas fallecidas o hacer que figuras históricas "digan" cosas que nunca dijeron.</Body>
        </>
      );

      // ===== 11 · SPRINT =====
      case 11: {
        const minutes = Math.floor(sprintSec / 60);
        const seconds = String(sprintSec % 60).padStart(2, '0');
        return (
          <>
            <ModuleType icon="⚡" label="Sprint" />
            <Title>Sprint: tu cortometraje</Title>
            <View style={styles.sprintBox}>
              <Text style={styles.sprintInstruction}>🎬 ¡90 segundos! Escribe las 3 escenas de un cortometraje de IA de 30 segundos. Cada escena con: descripción visual + acción + duración aproximada.</Text>
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
              placeholder={'Escena 1 (0-10s): ...\nEscena 2 (10-20s): ...\nEscena 3 (20-30s): ...'}
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
              <Fb ok={sprintValid}>⚡ ¡Sprint terminado! {sprintValid ? 'Guión de 3 escenas completado — un director de IA trabajaría con eso.' : 'La próxima vez intenta describir las 3 escenas con más detalle.'}</Fb>
            )}
          </>
        );
      }

      // ===== 13 · TEORÍA: copyright =====
      case 13: return (
        <>
          <ModuleType icon="⚖️" label="Copyright y ética" />
          <Title>El problema del copyright en video de IA</Title>
          <Body>¿De quién es un video generado con IA? Es una pregunta compleja que se debate en tribunales de todo el mundo:</Body>
          <Body><B>🤖 ¿La IA?</B> No. Las leyes de copyright requieren autoría humana; una IA no puede ser propietaria de nada.</Body>
          <Body><B>👤 ¿Tú (el usuario)?</B> Depende de los términos de servicio de cada herramienta.</Body>
          <Body><B>🏢 ¿La empresa que hizo la IA?</B> Muchas (Runway, Pika) reclaman derechos sobre lo generado en sus plataformas.</Body>
          <InfoBox><B>Caso real:</B> en 2023, el sindicato de actores de Hollywood (SAG-AFTRA) hizo huelga en parte por esto: temían que los estudios clonaran sus imágenes sin pagarles. Lograron un acuerdo que exige consentimiento y pago. ¡Los actores ganaron esa batalla!</InfoBox>
        </>
      );

      // ===== 15 · DRAG & DROP =====
      case 15: return (
        <>
          <ModuleType icon="↕️" label="Clasifica" />
          <Title>¿Gratis o de pago?</Title>
          <Body>Clasifica estas herramientas de video con IA según su modelo de acceso. Toca una y luego su zona (o arrástrala).</Body>
          <View style={styles.dragPool}>
            {DD_ITEMS.map((item, idx) => ddPlaced[idx] === undefined ? (
              <TouchableOpacity key={idx} id={`dd15-chip-${idx}`} style={[styles.dragItem, ddSel === idx && styles.dragItemSel]} disabled={ddSolved} onPress={() => setDdSel(ddSel === idx ? null : idx)}>
                <Text style={styles.dragItemText}>{item.text}</Text>
              </TouchableOpacity>
            ) : null)}
            {ddAllPlaced && <Text style={{ color: C.placeholder, fontSize: 12 }}>Todas las herramientas clasificadas ✓</Text>}
          </View>
          {([0, 1] as const).map(zone => (
            <View key={zone}>
              <Text style={styles.dropZoneLabel}>{DD_ZONES[zone]}</Text>
              <TouchableOpacity id={`dd15-zone-${zone}`} activeOpacity={0.8} style={[styles.dropZone, ddOverZone === zone && styles.dropZoneOver]} disabled={ddSolved} onPress={() => ddPlace(zone)}>
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
          {ddChecked && ddSolved && <Fb ok>✅ ¡Clasificación perfecta! Conoces bien los modelos de acceso de las herramientas de IA.</Fb>}
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

      // ===== 16 · VF límites =====
      case 16: return (
        <>
          <ModuleType icon="✔️" label="Verdadero o Falso" />
          <Title>¿Qué puede y qué no?</Title>
          {renderVF(VF_ITEMS_2, vf2Answers, answerVf2)}
        </>
      );

      // ===== 20 · COMPLETADO =====
      case 20: return (
        <View style={styles.completionScreen}>
          <Text style={styles.completionIcon}>🎬</Text>
          <Text style={styles.completionTitle}>¡Badge desbloqueado!</Text>
          <Text style={styles.completionBadge}>🏅 Film Director</Text>
          <Text style={styles.completionText}>
            ¡Completaste el Nivel 15 y el Módulo 3! Ahora entiendes el mundo del video con IA: cómo funciona, quién lo usa, deepfakes, copyright y el futuro del cine.
          </Text>
          <Text style={styles.xpGained}>+<Text style={{ color: C.goldLight }}>{xp}</Text> XP</Text>
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
              <Text style={styles.statNum}>N16</Text>
              <Text style={styles.statLbl}>Próximo nivel</Text>
            </View>
          </View>
          <View style={styles.nextLevelBox}>
            <Text style={styles.nextLevelText}>
              💻 <Text style={{ fontWeight: '700', color: C.text }}>Nivel 16: Tu Primera Web con IA{'\n\n'}</Text>
              Construirás apps web con herramientas no-code: Lovable, Bolt, Bubble. Aprenderás a describir tus ideas para que la IA las construya.
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
      case 1: case 4: case 9: case 13:
        return { label: 'Continuar →', enabled: true, onPress: () => { awardStep(MODULE_XP[step]); next(); } };
      case 8: case 10: case 14: case 18:
        return { label: 'Continuar →', enabled: quizSel !== null || devMode, note: quizSel === null ? `Responde para continuar · +${MODULE_XP[step]} XP` : undefined, onPress: next };
      case 3: case 5: case 12: case 17: case 19: {
        const isReflect = step === 5 || step === 17 || step === 19;
        if (!builderDone) return { label: isReflect ? 'Enviar reflexión →' : 'Confirmar →', enabled: builderText.trim().length > 15 || devMode, note: `Escribe al menos 16 caracteres · +${MODULE_XP[step]} XP`, onPress: confirmBuilder };
        return { label: step === 19 ? 'Completar nivel →' : 'Continuar →', enabled: true, onPress: next };
      }
      case 2: return { label: 'Continuar →', enabled: matched.size === MATCH_PAIRS.length || devMode, note: matched.size < MATCH_PAIRS.length ? `Conecta los ${MATCH_PAIRS.length} pares · +${MODULE_XP[step]} XP` : undefined, onPress: next };
      case 6: return { label: 'Continuar →', enabled: Object.keys(vf1Answers).length === VF_ITEMS_1.length || devMode, note: `Responde las ${VF_ITEMS_1.length} afirmaciones · +${MODULE_XP[step]} XP`, onPress: next };
      case 7: return { label: 'Continuar →', enabled: Object.keys(c3Answers).length === CLASSIFY_ITEMS.length || devMode, note: `Responde las ${CLASSIFY_ITEMS.length} señales · +${MODULE_XP[step]} XP`, onPress: next };
      case 11: return { label: 'Continuar →', enabled: sprintPhase === 'done' || devMode, note: sprintPhase !== 'done' ? 'Escribe tus escenas y pulsa "Entregar" · +20 XP' : undefined, onPress: next };
      case 15:
        if (!ddChecked || (!ddSolved && !ddAllCorrect)) return { label: 'Verificar →', enabled: ddAllPlaced || devMode, note: `Clasifica las ${DD_ITEMS.length} herramientas · +${MODULE_XP[step]} XP`, onPress: verifyDd };
        return { label: 'Continuar →', enabled: true, onPress: next };
      case 16: return { label: 'Continuar →', enabled: Object.keys(vf2Answers).length === VF_ITEMS_2.length || devMode, note: `Responde las ${VF_ITEMS_2.length} afirmaciones · +${MODULE_XP[step]} XP`, onPress: next };
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
          <View style={styles.levelBadge}><Text style={styles.levelBadgeText}>🎬 MUNDO 3 · NIVEL 15</Text></View>
          <Text style={styles.levelTitle}>IA que <Text style={{ color: C.goldLight }}>Filma</Text></Text>
          <Text style={styles.subtitle}>Genera videos con inteligencia artificial</Text>
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

      {xpToast && <XPToast key={xpToast.id} amount={xpToast.amount} onHide={() => setXpToast(null)} bgColor={C.gold} textColor="#fff" />}
    </View>
  );
}

// ===================== ESTILOS (paleta oscura dorada del HTML nivel-15) =====================
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },

  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingTop: 11, paddingBottom: 8, backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.border },
  closeBtn: { minWidth: 42, minHeight: 42, borderRadius: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 12, color: C.goldLight, fontWeight: '800' },
  xpChip: { paddingHorizontal: 11, paddingVertical: 4, borderRadius: 12, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border },
  xpChipText: { fontSize: 12, color: C.goldLight, fontWeight: '700' },

  container: { padding: 16, paddingBottom: 28 },

  // Header del nivel
  header: { marginBottom: 20 },
  levelBadge: { alignSelf: 'flex-start', backgroundColor: C.amber, borderRadius: 99, paddingHorizontal: 16, paddingVertical: 6, marginBottom: 12 },
  levelBadgeText: { ...typography.bold, fontSize: 12, color: '#fff', letterSpacing: 0.6 },
  levelTitle: { ...typography.extraBold, fontSize: 28, color: C.text, lineHeight: 34 },
  subtitle: { ...typography.regular, fontSize: 13, color: C.muted, marginTop: 4, marginBottom: 14 },
  progressBar: { width: '100%', height: 8, backgroundColor: C.border, borderRadius: 99, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: C.gold, borderRadius: 99 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  progressLabel: { fontSize: 11, color: C.muted, fontWeight: '500' },

  // Tarjeta del módulo
  moduleCard: { backgroundColor: C.card, borderRadius: 16, padding: 22, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  moduleCardAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: C.gold },
  moduleXpBadge: { position: 'absolute', top: 14, right: 14, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  moduleXpBadgeText: { fontSize: 11, fontWeight: '700', color: C.goldLight },
  moduleType: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  moduleTypeText: { ...typography.bold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: C.goldLight },
  moduleTitle: { ...typography.extraBold, fontSize: 19, color: C.text, marginBottom: 14, lineHeight: 25 },
  bodyText: { ...typography.regular, fontSize: 14, lineHeight: 23, color: C.muted, marginBottom: 12 },
  bold: { fontWeight: '700', color: C.text },
  infoBox: { backgroundColor: C.card2, borderLeftWidth: 4, borderLeftColor: C.gold, borderTopRightRadius: 12, borderBottomRightRadius: 12, paddingHorizontal: 16, paddingVertical: 13, marginBottom: 14 },
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
  matchItemSelected: { borderColor: C.warm, backgroundColor: '#3d2200' },
  matchItemMatched: { borderColor: C.green, backgroundColor: C.okBg },
  matchItemWrong: { borderColor: C.red, backgroundColor: C.failBg },
  matchItemText: { fontSize: 12, color: C.text, textAlign: 'center', lineHeight: 17, fontWeight: '500' },

  // Builder
  builderInput: { backgroundColor: C.surface, borderWidth: 2, borderColor: C.border, borderRadius: 12, padding: 14, fontSize: 14, lineHeight: 21, color: C.text, minHeight: 100, marginVertical: 10, textAlignVertical: 'top' },
  builderExample: { backgroundColor: C.card2, borderLeftWidth: 3, borderLeftColor: C.goldLight, borderTopRightRadius: 10, borderBottomRightRadius: 10, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12 },
  builderExampleText: { fontSize: 13, color: C.muted, lineHeight: 20, fontStyle: 'italic' },
  builderExampleLabel: { color: C.goldLight, fontWeight: '700', fontStyle: 'normal' },

  // Sprint
  sprintBox: { backgroundColor: '#241200', borderWidth: 2, borderColor: C.gold, borderRadius: 16, padding: 22, alignItems: 'center', marginBottom: 12 },
  sprintInstruction: { textAlign: 'center', marginBottom: 6, fontSize: 13, lineHeight: 20, color: C.muted },
  timerText: { fontSize: 44, fontWeight: '800', color: C.goldLight, fontVariant: ['tabular-nums'], marginVertical: 8 },
  timerWarning: { color: C.warm },
  timerDanger: { color: C.red },

  // VF & Detector
  vfItem: { marginBottom: 12, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 16 },
  vfStatement: { fontSize: 13, fontWeight: '600', marginBottom: 12, color: C.text, lineHeight: 20 },
  vfButtons: { flexDirection: 'row', gap: 8 },
  vfBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 2, borderColor: C.border, alignItems: 'center', backgroundColor: 'transparent' },
  vfBtnCorrect: { borderColor: C.green, backgroundColor: C.okBg },
  vfBtnWrong: { borderColor: C.red, backgroundColor: C.failBg },
  vfBtnText: { ...typography.bold, fontSize: 12, color: C.muted },

  // Drag & drop
  dragPool: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 14, backgroundColor: C.card2, borderWidth: 2, borderStyle: 'dashed', borderColor: C.border, borderRadius: 12, minHeight: 70, marginBottom: 12, alignItems: 'center' },
  dragItem: { backgroundColor: C.surface, borderWidth: 2, borderColor: C.border, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  dragItemSel: { borderColor: C.gold, backgroundColor: '#2e1a00' },
  dragItemOk: { borderColor: C.green, backgroundColor: C.okBg },
  dragItemBad: { borderColor: C.red, backgroundColor: C.failBg },
  dragItemText: { fontSize: 12, color: C.text, lineHeight: 17 },
  dropZoneLabel: { fontSize: 12, fontWeight: '700', color: C.goldLight, marginBottom: 6 },
  dropZone: { minHeight: 70, padding: 12, borderWidth: 2, borderStyle: 'dashed', borderColor: C.border, borderRadius: 12, backgroundColor: C.card2, marginBottom: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' },
  dropZoneOver: { borderColor: C.gold, backgroundColor: '#2e1a00' },

  // Botones
  btn: { backgroundColor: C.gold, padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 12 },
  btnText: { ...typography.bold, color: '#fff', fontSize: 14 },

  // Completado
  completionScreen: { alignItems: 'center', paddingVertical: 20 },
  completionIcon: { fontSize: 64, marginBottom: 12 },
  completionTitle: { ...typography.extraBold, fontSize: 26, color: C.goldLight, textAlign: 'center', marginBottom: 4 },
  completionBadge: { ...typography.extraBold, fontSize: 20, color: C.goldLight, marginVertical: 8 },
  completionText: { ...typography.regular, fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 16, color: C.muted },
  xpGained: { ...typography.extraBold, fontSize: 34, color: C.text, marginBottom: 16 },
  statsRow: { flexDirection: 'row', width: '100%', gap: 8, marginBottom: 16 },
  statItem: { flex: 1, alignItems: 'center', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 8 },
  statNum: { ...typography.extraBold, fontSize: 20, color: C.goldLight },
  statLbl: { fontSize: 10, color: C.muted, marginTop: 2, textAlign: 'center' },
  nextLevelBox: { backgroundColor: C.card2, borderRadius: 10, padding: 13, marginBottom: 16, borderWidth: 1, borderColor: C.border, width: '100%' },
  nextLevelText: { fontSize: 12, color: C.muted, lineHeight: 20 },

  // Footer
  btnRow: { paddingHorizontal: 13, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.surface },
  btnRowInner: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  backBtn: { paddingHorizontal: 16, paddingVertical: 13, borderRadius: 10, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, minHeight: 48, justifyContent: 'center' },
  backBtnText: { fontSize: 14, fontWeight: '700', color: C.muted },
  mainBtn: { padding: 13, borderRadius: 10, backgroundColor: C.gold, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  mainBtnDisabled: { opacity: 0.35 },
  btnNote: { fontSize: 11, color: C.placeholder, textAlign: 'center', marginTop: 5, minHeight: 15 },
});
