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

// ===================== PALETA (hex exactos del HTML nivel-16, tema oscuro lima M3) =====================
const C = {
  bg: '#040d00', surface: '#071500', card: '#0d1f00', card2: '#142800',
  text: '#f0fde4', muted: '#86a85a', border: '#1e3a00',
  lime: '#84cc16', limeLight: '#bef264', green: '#16a34a', emerald: '#059669', limeDark: '#65a30d',
  green2: '#22c55e', okBg: '#052e16', okBorder: '#16a34a', okText: '#86efac',
  red: '#ef4444', failBg: '#2d0707', failBorder: '#dc2626', failText: '#fca5a5',
  yellow: '#f59e0b',
  placeholder: '#4a6a2a',
  codeBg: '#000000', codeText: '#a8ff78',
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

const APP_TERMS = ['app', 'aplicacion', 'web', 'sitio', 'usuario', 'usuarios', 'pantalla', 'pantallas', 'boton', 'botones', 'color', 'colores', 'estilo', 'diseño', 'diseno', 'funcion', 'sirve', 'guarda', 'muestra', 'formulario', 'fondo', 'movil', 'moderno', 'minimalista', 'menu', 'lista', 'registro', 'inicio'];
const REFLECT_TERMS = ['app', 'aplicacion', 'web', 'construir', 'crear', 'idea', 'util', 'ia', 'programar', 'codigo', 'proyecto', 'resolver', 'problema', 'ayudar', 'persona', 'personas', 'sirve', 'usuario'];

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

// ===================== DATOS (fieles al HTML nivel-16) =====================
type QuizMod = { title: string; question: string; options: string[]; correct: number; feedback: string };

// Quizzes con opciones balanceadas en longitud (la correcta no debe ser la más larga)
const QUIZZES: Record<number, QuizMod> = {
  5: {
    title: 'HTML, CSS y JavaScript',
    question: 'Amir, un estudiante de Irán, quiere que el botón de su app cambie de color cuando alguien lo toca. ¿Qué tecnología es la responsable de ese comportamiento interactivo?',
    options: [
      'HTML — estructura y organiza la página',
      'CSS — da el estilo visual y los colores',
      'JavaScript — maneja las interacciones y el comportamiento',
      'El servidor donde está guardada la app',
    ],
    correct: 2,
    feedback: 'JavaScript es el que hace que las cosas pasen: clics, animaciones y cambios en tiempo real. HTML es la estructura y CSS es el estilo.',
  },
  11: {
    title: 'No-code vs low-code',
    question: 'Valentina quiere una app para su colegio en Chile donde los estudiantes reporten si hay basura en el patio y un administrador lo vea en tiempo real. No sabe programar. ¿Cuál es su mejor opción?',
    options: [
      'Aprender a programar en Python durante unos dos años antes de empezar el proyecto',
      'Usar Lovable o Bubble: describe la app con palabras y la IA genera el código',
      'Contratar a un programador profesional para que construya toda la app por ella',
      'Este tipo de apps solo pueden crearlas las grandes empresas de tecnología',
    ],
    correct: 1,
    feedback: 'Herramientas como Lovable o Bubble son perfectas para este caso. Valentina puede tener una versión funcional en horas, no años, y luego mejorarla sin saber programar.',
  },
  16: {
    title: 'El debate: ¿necesito programar?',
    question: 'Si la IA ya escribe código por mí, ¿para qué aprendería a programar? ¿Cuál es la respuesta más inteligente?',
    options: [
      'No necesito programar nada, porque la IA de código ya lo hace todo mucho mejor que yo',
      'Debo aprender todo el código posible, porque la IA jamás podrá reemplazar a un humano',
      'Entender lo básico de programación te ayuda a guiar a la IA y detectar sus errores',
      'Solo los genios pueden programar, así que mejor me conformo con las herramientas no-code',
    ],
    correct: 2,
    feedback: 'La programación y la IA no son opuestos. Quien entiende cómo funciona el código le saca mucho más provecho a las IA de programación: da mejores instrucciones, detecta errores y construye cosas más complejas.',
  },
};

// Módulo 2 · Matching
const MATCH_PAIRS = [
  { left: '🔨 Lovable', right: 'Describe tu app en texto y genera React + código completo' },
  { left: '⚡ Bolt (StackBlitz)', right: 'Crea apps web en el navegador con IA en tiempo real' },
  { left: '🫧 Bubble', right: 'Constructor visual con base de datos integrada, sin código' },
  { left: '🎨 Framer', right: 'Diseño web profesional con animaciones y IA para el texto' },
];

// Módulo 8 · Sort (proceso de crear una web con IA). Índice = posición correcta.
const SORT_ITEMS = [
  'Identificar el problema que va a resolver la app',
  'Describir las pantallas y funciones principales (wireframe)',
  'Escribir el prompt detallado para la IA',
  'La IA genera el código; tú lo revisas y corriges',
  'Publicar la app en internet con un dominio',
];

// Módulo 15 · Drag & drop. zone 0 = no-code, 1 = requiere programación real.
const DD_ITEMS: { text: string; zone: 0 | 1; why: string }[] = [
  { text: 'Un sitio web sencillo para mostrar tu portafolio personal', zone: 0, why: 'Un portafolio simple se hace fácil y rápido con no-code.' },
  { text: 'Un sistema bancario que maneja millones de transacciones por día', zone: 1, why: 'Un banco necesita programación real, seguridad y control total.' },
  { text: 'Una app para reservar canchas deportivas en tu barrio', zone: 0, why: 'Una app de reservas sencilla es ideal para no-code.' },
  { text: 'Un sistema operativo nuevo para computadoras', zone: 1, why: 'Un sistema operativo requiere programación avanzada de bajo nivel.' },
  { text: 'Una encuesta digital para tu proyecto de ciencias', zone: 0, why: 'Una encuesta simple se arma en minutos con no-code.' },
  { text: 'Un motor de IA que aprende con millones de datos en tiempo real', zone: 1, why: 'Un motor de IA necesita programación y mucho cómputo especializado.' },
];
const DD_ZONES = ['🔨 No-code (Lovable/Bubble)', '🐍 Requiere programación real'];

// Módulo 17 · Verdadero/Falso
const VF_ITEMS = [
  { text: 'Con Lovable puedes publicar una app funcional en internet sin tocar ni una línea de código.', correct: true, feedback: 'VERDADERO. Lovable genera el código y tiene integración directa con servicios de publicación. Con un clic tu app está online.' },
  { text: 'Las apps hechas con herramientas no-code nunca pueden crecer para tener miles de usuarios.', correct: false, feedback: 'FALSO. Apps como Notion y muchas startups exitosas empezaron con no-code o low-code. Cuando crecen, migran gradualmente a código más personalizado.' },
  { text: 'GitHub Copilot puede escribir código en más de 10 lenguajes de programación diferentes.', correct: true, feedback: 'VERDADERO. Copilot funciona en Python, JavaScript, TypeScript, Ruby, Go, Java, C++, PHP y más. Aprende de millones de proyectos de código abierto.' },
];

// Builders y reflexión
const BUILDERS: Record<number, { icon: string; label: string; title: string; intro: string; box: string; example?: string; placeholder: string; fb: string; terms: string[]; topicMsg: string }> = {
  3: {
    icon: '✏️', label: 'Constructor', title: 'Describe tu web con palabras',
    intro: 'El primer paso para construir cualquier app es saber exactamente qué hace. Responde estas preguntas en tu descripción:',
    box: '❓ ¿Qué hace tu app? ¿Para qué sirve exactamente?\n👤 ¿Para quién es? ¿Qué tipo de persona la usaría?\n🎨 ¿Cómo se ve? Colores, estilo, si es seria o divertida\n⚡ ¿Cuál es su acción principal? ¿Guardar algo, mostrar info, conectar personas?',
    example: '"Una app para estudiantes de secundaria en México que permite guardar frases motivadoras, compartirlas con amigos y votar cuál es la mejor. Diseño colorido y juvenil, fondo oscuro con acentos neón."',
    placeholder: 'Describe tu app ideal aquí: qué hace, para quién, cómo se ve y su acción principal...',
    fb: '💻 ¡Esa descripción es suficiente para que Lovable o Bolt generen una primera versión funcional en minutos!',
    terms: APP_TERMS, topicMsg: 'Describe tu app: qué hace, para quién es, cómo se ve o su acción principal.',
  },
  9: {
    icon: '🎨', label: 'Constructor', title: 'Describe el estilo visual de tu app',
    intro: 'El diseño visual es tan importante como la funcionalidad. La IA puede seguir instrucciones de estilo si las describes bien:',
    box: '🎨 Paleta: "Fondo oscuro navy, acentos azul eléctrico, texto blanco"\n✍️ Tipografía: "Fuente moderna sans-serif para títulos"\n📐 Estilo general: "Minimalista", "Colorido y juvenil", "Profesional"\n📱 Dispositivo: "Primero para móvil" o "Para pantalla grande"',
    example: '"Fondo negro con gradiente púrpura oscuro, botones color coral, tipografía moderna, estilo juvenil y energético como las apps de música, optimizado para móvil."',
    placeholder: 'Describe el estilo visual de tu app: paleta, tipografía, estilo, dispositivo...',
    fb: '🎨 ¡Con esa descripción de estilo la IA generaría una app con identidad visual clara!',
    terms: APP_TERMS, topicMsg: 'Describe el estilo: colores, tipografía, estilo general o dispositivo.',
  },
  18: {
    icon: '📱', label: 'Constructor', title: 'Diseña tu app en palabras',
    intro: 'Antes de pedirle a la IA que construya tu app, describe las pantallas principales. Esto se llama wireframe textual.',
    box: '🏠 Pantalla 1 — Inicio: lo primero que ve el usuario\n⚡ Pantalla 2 — Acción principal: lo que hace el usuario\n✅ Pantalla 3 — Resultado: lo que ve al completar la acción',
    example: '"Pantalla 1: bienvenida con logo y botón Empezar. Pantalla 2: formulario donde el estudiante escribe su meta del día. Pantalla 3: tarjeta motivacional generada por IA con su meta y un emoji."',
    placeholder: 'Describe las 3 pantallas principales de tu app: inicio, acción y resultado...',
    fb: '📱 ¡Wireframe listo! Con esa descripción, una IA como Lovable podría generar las 3 pantallas funcionando en minutos.',
    terms: APP_TERMS, topicMsg: 'Describe las pantallas de tu app: inicio, acción principal y resultado.',
  },
  19: {
    icon: '💭', label: 'Reflexión', title: 'Tú eres el arquitecto, la IA es el constructor',
    intro: 'Hay una frase que resume el futuro del desarrollo con IA: "La IA escribe el código, pero tú decides qué construir, para quién y por qué. La creatividad, la empatía y la visión siguen siendo 100% tuyas."',
    box: '💡 ¿Qué app construirías primero si tuvieras una hora libre ahora mismo?\n🤔 ¿Por qué esa y no otra?\n👥 ¿A quién le serviría?',
    placeholder: 'Describe tu primera app y por qué sería útil para alguien...',
    fb: '💻 ¡Esa idea tiene potencial real! El próximo paso es abrir Lovable y empezar a construirla.',
    terms: REFLECT_TERMS, topicMsg: 'Cuenta qué app construirías, para quién y por qué sería útil.',
  },
};

// XP por módulo (campo xp real del HTML). Suma real = 255 (el header del HTML decía 240 — el conteo real manda)
const MODULE_XP: number[] = [0, 10, 15, 15, 10, 15, 10, 10, 15, 15, 10, 15, 20, 10, 10, 15, 15, 15, 15, 15, 0];
const MAX_XP = MODULE_XP.reduce((a, b) => a + b, 0); // 255
const TOTAL_STEPS = 21;   // 0=intro … 20=completado
const CONTENT_STEPS = 19; // módulos de contenido (1..19)
const SPRINT_DURATION = 60;

export default function Level16() {
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

  // VF (17)
  const [vfAnswers, setVfAnswers] = useState<Record<number, boolean>>({});

  // Sprint
  const [sprintPhase, setSprintPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [sprintSec, setSprintSec] = useState(SPRINT_DURATION);
  const [sprintText, setSprintText] = useState('');
  const [sprintValid, setSprintValid] = useState(false);

  // Sort (reordenar con flechas; resaltar mal ubicados al verificar)
  const [sortOrder, setSortOrder] = useState<number[]>(() => shuffleDistinct([0, 1, 2, 3, 4]));
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
    setVfAnswers({});
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
      if (valid) awardStep(MODULE_XP[12]);
      return;
    }
    const t = setTimeout(() => setSprintSec(s => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sprintPhase, sprintSec]);

  // Módulos puramente informativos (clasificación propia — el THEORY_STEPS del HTML omite módulos de teoría reales)
  const theorySteps = new Set([1, 4, 6, 7, 10, 13, 14]);
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
        const el = document.getElementById(`dd16-chip-${idx}`);
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
        const el = document.getElementById(`dd16-zone-${zone}`);
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
    const stars = xp >= 180 ? 3 : xp >= 115 ? 2 : 1;
    completeLevel(16, stars, xp);
    router.replace('/level/17');
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

  const answerVf = (idx: number, ans: boolean) => {
    if (vfAnswers[idx] !== undefined) return;
    const n = { ...vfAnswers, [idx]: ans };
    setVfAnswers(n);
    if (Object.keys(n).length === VF_ITEMS.length) awardStep(MODULE_XP[17]);
  };

  const submitSprint = () => {
    if (sprintPhase !== 'running') return;
    const valid = sprintText.trim().length > 20 && !looksRandom(sprintText);
    setSprintValid(valid);
    setSprintPhase('done');
    if (valid) awardStep(MODULE_XP[12]);
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
      awardStep(MODULE_XP[8]);
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
          <ModuleType icon="💻" label="Introducción" />
          <Title>De usuario a constructor</Title>
          <Body>¿Sabías que muchas de las apps y sitios web que usas hoy fueron construidos por personas que empezaron exactamente como tú? La diferencia es que ahora tienes algo que ellos no tenían: <B>inteligencia artificial que escribe código por ti</B>.</Body>
          <Body>Con herramientas como <B>Lovable</B>, <B>Bolt</B> o <B>Bubble</B>, puedes describir en español lo que quieres construir y la IA lo convierte en una aplicación funcional en minutos. No necesitas saber programar.</Body>
          <InfoBox>
            <B>¿Qué vas a aprender hoy?</B>{'\n'}
            🔨 Qué son las herramientas no-code e IA-code{'\n'}
            🌐 Cómo funciona una página web por dentro (lo básico){'\n'}
            ✏️ Cómo describir tu app con palabras para que la IA la construya{'\n'}
            🚀 Cómo publican sus apps jóvenes como tú en todo el mundo
          </InfoBox>
        </>
      );

      // ===== 1 · TEORÍA: no-code / low-code / full-code =====
      case 1: return (
        <>
          <ModuleType icon="🧠" label="Teoría" />
          <Title>No-code, low-code y full-code</Title>
          <Body>Existen tres formas de construir aplicaciones web hoy:</Body>
          <Body><B>No-code:</B> describes lo que quieres con palabras o arrastras elementos visuales. La IA o la plataforma genera todo el código. Ejemplos: Lovable, Bubble, Framer.</Body>
          <Body><B>Low-code:</B> usas bloques visuales pero también escribes algo de código para personalizar. Requiere conocimientos básicos de programación.</Body>
          <Body><B>Full-code:</B> escribes todo el código tú mismo (HTML, CSS, JavaScript, Python...). Máximo control, máximo aprendizaje requerido.</Body>
          <InfoBox><B>La tendencia en 2025:</B> las empresas más innovadoras usan las tres. Un fundador no-técnico usa no-code para prototipar rápido, y cuando la app crece, un programador la mejora con full-code. La IA hace que la línea entre las tres sea cada vez más difusa.</InfoBox>
        </>
      );

      // ===== 2 · MATCHING =====
      case 2: return (
        <>
          <ModuleType icon="🔗" label="Matching" />
          <Title>Herramientas no-code</Title>
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
                  <Text style={[styles.matchItemText, selectedLeft === i && { color: C.limeLight }, matched.has(i) && { color: C.okText }, wrongFlash?.left === i && { color: C.failText }]}>{pair.left}</Text>
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
          {matched.size === MATCH_PAIRS.length && <Fb ok>✅ ¡Todos los pares conectados! Conoces bien las herramientas no-code.</Fb>}
        </>
      );

      // ===== 3, 9, 18 · CONSTRUCTOR · 19 · REFLEXIÓN =====
      case 3: case 9: case 18: case 19: return renderBuilder();

      // ===== 4 · TEORÍA: HTML/CSS/JS =====
      case 4: return (
        <>
          <ModuleType icon="🌐" label="Teoría" />
          <Title>Lo mínimo que debes saber de una web</Title>
          <Body>Toda página web está hecha de tres ingredientes básicos:</Body>
          <Body><B>HTML:</B> la estructura. Como el esqueleto — define qué elementos existen (títulos, párrafos, botones, imágenes).</Body>
          <Body><B>CSS:</B> el estilo. Como la ropa — decide colores, tamaños, fuentes y cómo se ve todo.</Body>
          <Body><B>JavaScript:</B> el comportamiento. Como los músculos — hace que las cosas se muevan y respondan a los clics.</Body>
          <View style={styles.codeBlock}>
            <Text style={styles.codeText}>{'<h1>'}Hola, soy un título{'</h1>'}</Text>
            <Text style={styles.codeText}>{'<p>'}Soy un párrafo de texto.{'</p>'}</Text>
            <Text style={styles.codeText}>{'<button style="color:green">'}¡Haz clic!{'</button>'}</Text>
          </View>
          <Body>Cuando usas Lovable o Bolt, la IA genera este código por ti. Pero entender qué hace cada parte te ayuda a pedir exactamente lo que quieres.</Body>
        </>
      );

      // ===== 5, 11, 16 · QUIZ =====
      case 5: case 11: case 16: return renderQuiz();

      // ===== 6 · TEORÍA: Copilot / Cursor =====
      case 6: return (
        <>
          <ModuleType icon="🤖" label="Casos reales" />
          <Title>GitHub Copilot y Cursor</Title>
          <Body>Para quienes sí saben algo de programación, existen IA que actúan como "co-pilotos" que completan el código automáticamente:</Body>
          <Body><B>🤖 GitHub Copilot:</B> desarrollado por Microsoft y OpenAI. Predice la siguiente línea que vas a escribir y la completa en tiempo real. Es como el autocorrector del teléfono, pero para código.</Body>
          <Body><B>🎯 Cursor:</B> un editor de código con IA integrada. Puedes decirle en español "añade un botón que guarde el formulario" y lo hace automáticamente.</Body>
          <InfoBox><B>Dato real:</B> en 2024, GitHub reportó que el 55% del código de los proyectos que usan Copilot fue escrito por la IA, no por humanos. Los programadores ahora supervisan y dirigen más de lo que escriben a mano.</InfoBox>
        </>
      );

      // ===== 7 · TEORÍA: los 5 pasos =====
      case 7: return (
        <>
          <ModuleType icon="📋" label="Teoría" />
          <Title>Cómo se construye una web con IA</Title>
          <Body>El proceso para crear una app con IA no-code tiene siempre estos pasos:</Body>
          <InfoBox>
            <B>1. 💡 Idea:</B> ¿qué problema resuelve tu app?{'\n'}
            <B>2. 📝 Wireframe:</B> dibuja o describe las pantallas principales{'\n'}
            <B>3. 🤖 Prompt:</B> escríbele a la IA exactamente lo que quieres{'\n'}
            <B>4. 🧪 Genera y prueba:</B> la IA construye, tú pruebas y corriges{'\n'}
            <B>5. 🌐 Publica:</B> con un clic, tu app está en internet
          </InfoBox>
          <Body>Lo más importante: <B>el paso 3 es donde tu habilidad de prompting hace toda la diferencia</B>. Todo lo que aprendiste en el Mundo 2 aplica directamente aquí.</Body>
        </>
      );

      // ===== 8 · SORT =====
      case 8: return (
        <>
          <ModuleType icon="📋" label="Ordena" />
          <Title>Ordena los pasos</Title>
          <Body style={{ marginBottom: 12 }}>Ordena correctamente los pasos de crear una web con IA, del primero al último. Usa las flechas para mover cada uno.</Body>
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
          {sortSolved && <Fb ok>✅ ¡Orden correcto! Conoces bien el proceso de construir una web con IA.</Fb>}
          {!sortSolved && sortWrong.size > 0 && <Fb ok={false}>❌ Los pasos en rojo aún no están en el orden correcto. Piensa qué va primero: ¿la idea o el código?</Fb>}
        </>
      );

      // ===== 10 · TEORÍA: debugging =====
      case 10: return (
        <>
          <ModuleType icon="🐛" label="Casos reales" />
          <Title>Cuando algo no funciona, la IA lo arregla</Title>
          <Body>Uno de los superpoderes de usar IA para construir apps es que también puede encontrar y corregir errores. A esto se le llama <B>debugging</B>.</Body>
          <Body>En lugar de buscar el error a mano entre miles de líneas, puedes decirle a la IA: "el botón de guardar no funciona cuando el nombre tiene más de 20 letras" — y ella encuentra y arregla el problema.</Body>
          <InfoBox>
            <B>Flujo de trabajo real:</B>{'\n'}
            1. Describes el bug en lenguaje normal{'\n'}
            2. La IA analiza el código y encuentra la causa{'\n'}
            3. Propone la corrección y explica por qué ocurrió{'\n'}
            4. Tú apruebas el cambio y el error desaparece
          </InfoBox>
          <Body>Este flujo reduce horas de trabajo a minutos. Por eso los programadores junior que saben usar IA son ahora tan productivos como seniors que no la usan.</Body>
        </>
      );

      // ===== 12 · SPRINT =====
      case 12: {
        const minutes = Math.floor(sprintSec / 60);
        const seconds = String(sprintSec % 60).padStart(2, '0');
        return (
          <>
            <ModuleType icon="⚡" label="Sprint" />
            <Title>Sprint: describe tu app</Title>
            <View style={styles.sprintBox}>
              <Text style={styles.sprintInstruction}>⚡ ¡60 segundos! Describe tu app perfecta: qué hace + para quién es + cómo se ve + acción principal.</Text>
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
              placeholder={'Mi app se llama... Sirve para... La usarían... Se ve... La acción principal es...'}
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
              <Fb ok={sprintValid}>⚡ ¡Sprint terminado! {sprintValid ? 'Esa app ya puede construirse hoy con Lovable o Bolt.' : 'La próxima vez intenta incluir todos los detalles.'}</Fb>
            )}
          </>
        );
      }

      // ===== 13 · TEORÍA: apps de jóvenes =====
      case 13: return (
        <>
          <ModuleType icon="🌍" label="Casos reales" />
          <Title>Jóvenes que ya construyeron con IA</Title>
          <Body><B>🇺🇸 Caleb (17 años, EE.UU.):</B> construyó una app de estudio con IA que genera tarjetas de memoria desde apuntes. La publicó y consiguió 2,000 usuarios en su primera semana.</Body>
          <Body><B>🇳🇬 Amaka (16 años, Nigeria):</B> creó un directorio web de negocios locales de su barrio usando Bubble. El ayuntamiento la contactó para expandir el proyecto.</Body>
          <Body><B>🇧🇷 Pedro (15 años, Brasil):</B> hizo un bot de Telegram que responde preguntas del reglamento de su colegio. Lo construyó en un fin de semana con ChatGPT y Python básico.</Body>
          <InfoBox><B>Lo que tienen en común:</B> ninguno esperó a ser "experto" para empezar. Identificaron un problema real, lo describieron bien y usaron las herramientas disponibles. <B>Tú puedes hacer lo mismo hoy.</B></InfoBox>
        </>
      );

      // ===== 14 · TEORÍA: elige la herramienta =====
      case 14: return (
        <>
          <ModuleType icon="🗺️" label="Teoría" />
          <Title>Elige la herramienta correcta</Title>
          <Body>No todas las situaciones requieren el mismo enfoque. Esta es la guía rápida:</Body>
          <InfoBox>
            <B>Usa no-code (Lovable, Bubble) cuando:</B>{'\n'}
            → quieres un prototipo rápido en horas{'\n'}
            → el proyecto es relativamente simple{'\n'}
            → no tienes tiempo de aprender a programar ahora
          </InfoBox>
          <InfoBox>
            <B>Usa low-code (con algo de JS/Python) cuando:</B>{'\n'}
            → necesitas funcionalidades muy específicas{'\n'}
            → quieres más control sobre cómo funciona
          </InfoBox>
          <InfoBox>
            <B>Aprende full-code cuando:</B>{'\n'}
            → quieres construir cosas complejas o escalables{'\n'}
            → quieres trabajar profesionalmente en tecnología
          </InfoBox>
        </>
      );

      // ===== 15 · DRAG & DROP =====
      case 15: return (
        <>
          <ModuleType icon="↕️" label="Clasifica" />
          <Title>¿Qué herramienta uso?</Title>
          <Body>Clasifica cada proyecto según la herramienta más adecuada. Toca uno y luego su zona (o arrástralo).</Body>
          <View style={styles.dragPool}>
            {DD_ITEMS.map((item, idx) => ddPlaced[idx] === undefined ? (
              <TouchableOpacity key={idx} id={`dd16-chip-${idx}`} style={[styles.dragItem, ddSel === idx && styles.dragItemSel]} disabled={ddSolved} onPress={() => setDdSel(ddSel === idx ? null : idx)}>
                <Text style={styles.dragItemText}>{item.text}</Text>
              </TouchableOpacity>
            ) : null)}
            {ddAllPlaced && <Text style={{ color: C.placeholder, fontSize: 12 }}>Todos los proyectos clasificados ✓</Text>}
          </View>
          {([0, 1] as const).map(zone => (
            <View key={zone}>
              <Text style={styles.dropZoneLabel}>{DD_ZONES[zone]}</Text>
              <TouchableOpacity id={`dd16-zone-${zone}`} activeOpacity={0.8} style={[styles.dropZone, ddOverZone === zone && styles.dropZoneOver]} disabled={ddSolved} onPress={() => ddPlace(zone)}>
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
          {ddChecked && ddSolved && <Fb ok>✅ ¡Clasificación perfecta! Sabes cuándo usar no-code y cuándo hace falta programar.</Fb>}
          {ddChecked && !ddSolved && (
            <>
              <Fb ok={false}>❌ Algunos no están bien. Toca los marcados con ✕ para devolverlos y vuelve a intentarlo.</Fb>
              {DD_ITEMS.map((item, idx) => ddPlaced[idx] !== undefined && ddPlaced[idx] !== item.zone ? (
                <Fb key={idx} ok={false}>✕ "{item.text}" va en <Text style={{ fontWeight: '700' }}>{DD_ZONES[item.zone]}</Text>. {item.why}</Fb>
              ) : null)}
            </>
          )}
        </>
      );

      // ===== 17 · VF =====
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
                {ans !== undefined && <Fb ok={ans === item.correct}>{ans === item.correct ? '✅ ' : '❌ Incorrecto. '}{item.feedback}</Fb>}
              </View>
            );
          })}
        </>
      );

      // ===== 20 · COMPLETADO =====
      case 20: return (
        <View style={styles.completionScreen}>
          <Text style={styles.completionIcon}>💻</Text>
          <Text style={styles.completionTitle}>¡Badge desbloqueado!</Text>
          <Text style={styles.completionBadge}>🏅 Web Builder</Text>
          <Text style={styles.completionText}>
            ¡Nivel 16 completado! Ahora sabes cómo construir apps web con IA, conoces las herramientas no-code y entiendes cómo describir tus ideas para que la IA las construya.
          </Text>
          <Text style={styles.xpGained}>+<Text style={{ color: C.limeLight }}>{xp}</Text> XP</Text>
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
              <Text style={styles.statNum}>N17</Text>
              <Text style={styles.statLbl}>Próximo nivel</Text>
            </View>
          </View>
          <View style={styles.nextLevelBox}>
            <Text style={styles.nextLevelText}>
              📊 <Text style={{ fontWeight: '700', color: C.text }}>Nivel 17: Descubre Secretos en los Datos{'\n\n'}</Text>
              Ahora que sabes construir apps, vas a analizar datos con IA: NotebookLM, gráficas y cómo detectar cuando los datos te quieren engañar.
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
      case 1: case 4: case 6: case 7: case 10: case 13: case 14:
        return { label: 'Continuar →', enabled: true, onPress: () => { awardStep(MODULE_XP[step]); next(); } };
      case 5: case 11: case 16:
        return { label: 'Continuar →', enabled: quizSel !== null || devMode, note: quizSel === null ? `Responde para continuar · +${MODULE_XP[step]} XP` : undefined, onPress: next };
      case 3: case 9: case 18: case 19: {
        const isReflect = step === 19;
        if (!builderDone) return { label: isReflect ? 'Enviar reflexión →' : 'Confirmar →', enabled: builderText.trim().length > 15 || devMode, note: `Escribe al menos 16 caracteres · +${MODULE_XP[step]} XP`, onPress: confirmBuilder };
        return { label: step === 19 ? 'Completar nivel →' : 'Continuar →', enabled: true, onPress: next };
      }
      case 2: return { label: 'Continuar →', enabled: matched.size === MATCH_PAIRS.length || devMode, note: matched.size < MATCH_PAIRS.length ? `Conecta los ${MATCH_PAIRS.length} pares · +${MODULE_XP[step]} XP` : undefined, onPress: next };
      case 8:
        if (!sortSolved) return { label: 'Verificar orden →', enabled: true, note: `Ordena del primer paso al último · +${MODULE_XP[step]} XP`, onPress: checkSort };
        return { label: 'Continuar →', enabled: true, onPress: next };
      case 12: return { label: 'Continuar →', enabled: sprintPhase === 'done' || devMode, note: sprintPhase !== 'done' ? 'Describe tu app y pulsa "Entregar" · +20 XP' : undefined, onPress: next };
      case 15:
        if (!ddChecked || (!ddSolved && !ddAllCorrect)) return { label: 'Verificar →', enabled: ddAllPlaced || devMode, note: `Clasifica los ${DD_ITEMS.length} proyectos · +${MODULE_XP[step]} XP`, onPress: verifyDd };
        return { label: 'Continuar →', enabled: true, onPress: next };
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
          <View style={styles.levelBadge}><Text style={styles.levelBadgeText}>💻 MUNDO 3 · NIVEL 16</Text></View>
          <Text style={styles.levelTitle}>Haz tu Primera <Text style={{ color: C.limeLight }}>Web con IA</Text></Text>
          <Text style={styles.subtitle}>De usuario a constructor: crea sin programar</Text>
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

      {xpToast && <XPToast key={xpToast.id} amount={xpToast.amount} onHide={() => setXpToast(null)} bgColor={C.lime} textColor="#04220a" />}
    </View>
  );
}

// ===================== ESTILOS (paleta oscura lima del HTML nivel-16) =====================
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },

  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingTop: 11, paddingBottom: 8, backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.border },
  closeBtn: { minWidth: 42, minHeight: 42, borderRadius: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 12, color: C.limeLight, fontWeight: '800' },
  xpChip: { paddingHorizontal: 11, paddingVertical: 4, borderRadius: 12, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border },
  xpChipText: { fontSize: 12, color: C.limeLight, fontWeight: '700' },

  container: { padding: 16, paddingBottom: 28 },

  // Header del nivel
  header: { marginBottom: 20 },
  levelBadge: { alignSelf: 'flex-start', backgroundColor: C.green, borderRadius: 99, paddingHorizontal: 16, paddingVertical: 6, marginBottom: 12 },
  levelBadgeText: { ...typography.bold, fontSize: 12, color: '#fff', letterSpacing: 0.6 },
  levelTitle: { ...typography.extraBold, fontSize: 28, color: C.text, lineHeight: 34 },
  subtitle: { ...typography.regular, fontSize: 13, color: C.muted, marginTop: 4, marginBottom: 14 },
  progressBar: { width: '100%', height: 8, backgroundColor: C.border, borderRadius: 99, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: C.lime, borderRadius: 99 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  progressLabel: { fontSize: 11, color: C.muted, fontWeight: '500' },

  // Tarjeta del módulo
  moduleCard: { backgroundColor: C.card, borderRadius: 16, padding: 22, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  moduleCardAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: C.lime },
  moduleXpBadge: { position: 'absolute', top: 14, right: 14, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  moduleXpBadgeText: { fontSize: 11, fontWeight: '700', color: C.limeLight },
  moduleType: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  moduleTypeText: { ...typography.bold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: C.limeLight },
  moduleTitle: { ...typography.extraBold, fontSize: 19, color: C.text, marginBottom: 14, lineHeight: 25 },
  bodyText: { ...typography.regular, fontSize: 14, lineHeight: 23, color: C.muted, marginBottom: 12 },
  bold: { fontWeight: '700', color: C.text },
  infoBox: { backgroundColor: C.card2, borderLeftWidth: 4, borderLeftColor: C.lime, borderTopRightRadius: 12, borderBottomRightRadius: 12, paddingHorizontal: 16, paddingVertical: 13, marginBottom: 14 },
  infoBoxText: { ...typography.regular, fontSize: 13, lineHeight: 24, color: C.muted },
  codeBlock: { backgroundColor: C.codeBg, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 14, marginBottom: 14 },
  codeText: { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 12, color: C.codeText, lineHeight: 22 },

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
  matchItemSelected: { borderColor: C.limeLight, backgroundColor: '#1a3500' },
  matchItemMatched: { borderColor: C.green2, backgroundColor: C.okBg },
  matchItemWrong: { borderColor: C.red, backgroundColor: C.failBg },
  matchItemText: { fontSize: 12, color: C.text, textAlign: 'center', lineHeight: 17, fontWeight: '500' },

  // Builder
  builderInput: { backgroundColor: C.surface, borderWidth: 2, borderColor: C.border, borderRadius: 12, padding: 14, fontSize: 14, lineHeight: 21, color: C.text, minHeight: 100, marginVertical: 10, textAlignVertical: 'top' },
  builderExample: { backgroundColor: C.card2, borderLeftWidth: 3, borderLeftColor: C.limeLight, borderTopRightRadius: 10, borderBottomRightRadius: 10, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12 },
  builderExampleText: { fontSize: 13, color: C.muted, lineHeight: 20, fontStyle: 'italic' },
  builderExampleLabel: { color: C.limeLight, fontWeight: '700', fontStyle: 'normal' },

  // Sprint
  sprintBox: { backgroundColor: '#0d2200', borderWidth: 2, borderColor: C.lime, borderRadius: 16, padding: 22, alignItems: 'center', marginBottom: 12 },
  sprintInstruction: { textAlign: 'center', marginBottom: 6, fontSize: 13, lineHeight: 20, color: C.muted },
  timerText: { fontSize: 44, fontWeight: '800', color: C.limeLight, fontVariant: ['tabular-nums'], marginVertical: 8 },
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
  sortNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: C.lime, color: '#04220a', textAlign: 'center', lineHeight: 26, fontWeight: '800', fontSize: 12, marginRight: 10, overflow: 'hidden' },
  sortText: { flex: 1, fontSize: 12, color: C.text, lineHeight: 17 },
  sortArrows: { flexDirection: 'column', marginLeft: 8 },
  sortArrow: { fontSize: 14, color: C.limeLight, paddingVertical: 2, paddingHorizontal: 4 },

  // Drag & drop
  dragPool: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 14, backgroundColor: C.card2, borderWidth: 2, borderStyle: 'dashed', borderColor: C.border, borderRadius: 12, minHeight: 70, marginBottom: 12, alignItems: 'center' },
  dragItem: { backgroundColor: C.surface, borderWidth: 2, borderColor: C.border, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  dragItemSel: { borderColor: C.lime, backgroundColor: '#1a3500' },
  dragItemOk: { borderColor: C.green2, backgroundColor: C.okBg },
  dragItemBad: { borderColor: C.red, backgroundColor: C.failBg },
  dragItemText: { fontSize: 12, color: C.text, lineHeight: 17 },
  dropZoneLabel: { fontSize: 12, fontWeight: '700', color: C.limeLight, marginBottom: 6 },
  dropZone: { minHeight: 70, padding: 12, borderWidth: 2, borderStyle: 'dashed', borderColor: C.border, borderRadius: 12, backgroundColor: C.card2, marginBottom: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' },
  dropZoneOver: { borderColor: C.lime, backgroundColor: '#1a3500' },

  // Botones
  btn: { backgroundColor: C.lime, padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 12 },
  btnText: { ...typography.bold, color: '#04220a', fontSize: 14 },

  // Completado
  completionScreen: { alignItems: 'center', paddingVertical: 20 },
  completionIcon: { fontSize: 64, marginBottom: 12 },
  completionTitle: { ...typography.extraBold, fontSize: 26, color: C.limeLight, textAlign: 'center', marginBottom: 4 },
  completionBadge: { ...typography.extraBold, fontSize: 20, color: C.limeLight, marginVertical: 8 },
  completionText: { ...typography.regular, fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 16, color: C.muted },
  xpGained: { ...typography.extraBold, fontSize: 34, color: C.text, marginBottom: 16 },
  statsRow: { flexDirection: 'row', width: '100%', gap: 8, marginBottom: 16 },
  statItem: { flex: 1, alignItems: 'center', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 8 },
  statNum: { ...typography.extraBold, fontSize: 20, color: C.limeLight },
  statLbl: { fontSize: 10, color: C.muted, marginTop: 2, textAlign: 'center' },
  nextLevelBox: { backgroundColor: C.card2, borderRadius: 10, padding: 13, marginBottom: 16, borderWidth: 1, borderColor: C.border, width: '100%' },
  nextLevelText: { fontSize: 12, color: C.muted, lineHeight: 20 },

  // Footer
  btnRow: { paddingHorizontal: 13, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.surface },
  btnRowInner: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  backBtn: { paddingHorizontal: 16, paddingVertical: 13, borderRadius: 10, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, minHeight: 48, justifyContent: 'center' },
  backBtnText: { fontSize: 14, fontWeight: '700', color: C.muted },
  mainBtn: { padding: 13, borderRadius: 10, backgroundColor: C.lime, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  mainBtnDisabled: { opacity: 0.35 },
  btnNote: { fontSize: 11, color: C.placeholder, textAlign: 'center', marginTop: 5, minHeight: 15 },
});
