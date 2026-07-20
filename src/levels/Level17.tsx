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

// ===================== PALETA (hex exactos del HTML nivel-17, tema oscuro índigo M3) =====================
const C = {
  bg: '#02020f', surface: '#05051a', card: '#0a0a24', card2: '#10102e',
  text: '#eef2ff', muted: '#818cf8', border: '#1e1e4a',
  indigo: '#6366f1', indigoLight: '#a5b4fc', blue: '#3b82f6', blueLight: '#93c5fd', violet: '#7c3aed', cyan: '#06b6d4',
  green2: '#22c55e', okBg: '#052e16', okBorder: '#16a34a', okText: '#86efac',
  red: '#ef4444', failBg: '#2d0707', failBorder: '#dc2626', failText: '#fca5a5',
  yellow: '#f59e0b',
  placeholder: '#4a4a80',
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

const DATA_TERMS = ['dato', 'datos', 'grafica', 'graficas', 'barra', 'barras', 'linea', 'lineas', 'pie', 'dispersion', 'tabla', 'promedio', 'nota', 'notas', 'materia', 'materias', 'comparar', 'mostrar', 'analizar', 'analisis', 'tendencia', 'porcentaje', 'indicador', 'dashboard', 'tablero', 'evolucion', 'relacion', 'trimestre', 'pregunta', 'mejor', 'peor', 'promedios'];
const REFLECT_TERMS = ['dato', 'datos', 'ia', 'analizar', 'descubrir', 'pregunta', 'grafica', 'comunidad', 'vida', 'secreto', 'secretos', 'patron', 'patrones', 'util', 'saber', 'entender'];

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

// ===================== DATOS (fieles al HTML nivel-17) =====================
type QuizMod = { title: string; question: string; options: string[]; correct: number; feedback: string };

// El módulo 2 (chart) y los quizzes comparten la misma lógica (opciones balanceadas + barajadas)
const QUIZZES: Record<number, QuizMod> = {
  2: {
    title: 'Lee esta gráfica',
    question: '¿Cuál es la conclusión más correcta de esta gráfica?',
    options: [
      'Alemania casi no tiene acceso a internet, por eso sus jóvenes usan menos la IA',
      'El uso de IA varía mucho entre países; los países asiáticos lideran la adopción',
      'Colombia tiene la peor educación tecnológica del mundo según esta gráfica',
      'Los jóvenes de Nigeria no pueden pagar las herramientas de inteligencia artificial',
    ],
    correct: 1,
    feedback: 'La gráfica muestra diferencias de adopción, pero NO explica las causas: puede ser por acceso, cultura o educación. Un buen analista de datos nunca salta a conclusiones sin más evidencia.',
  },
  6: {
    title: 'Spotify Wrapped',
    question: 'Spotify Wrapped te muestra a fin de año cuántas horas escuchaste música, tu canción más escuchada y tu artista favorito. ¿Qué tipo de análisis hace Spotify con tus datos?',
    options: [
      'Predicción del futuro: adivina qué canciones vas a escuchar el próximo año',
      'Análisis de patrones históricos: resume lo que ya ocurrió con tus datos del año',
      'Generación de contenido: crea música nueva basada en tus gustos personales',
      'Comparación con otros usuarios para mostrarte si tu gusto es normal o raro',
    ],
    correct: 1,
    feedback: 'Wrapped es análisis descriptivo: cuenta, suma y visualiza lo que YA pasó. Es distinto del análisis predictivo (qué pasará) o prescriptivo (qué deberías hacer).',
  },
  10: {
    title: 'IA y ciencia',
    question: 'El telescopio Kepler de la NASA generó tantos datos sobre estrellas que los científicos no podían analizarlos todos. ¿Cómo ayudó la IA a resolver este problema?',
    options: [
      'Construyó telescopios más potentes para reemplazar por completo al telescopio Kepler',
      'Analizó los patrones de luz de miles de estrellas y detectó variaciones que revelan planetas',
      'Publicó los datos en internet para que millones de personas los revisaran a mano',
      'Borró los datos que no parecían importantes para reducir la cantidad total',
    ],
    correct: 1,
    feedback: 'El sistema de machine learning de Kepler identificó patrones de "dimming" (oscurecimiento) que indican cuando un planeta pasa frente a una estrella. Descubrió planetas que llevaría siglos encontrar a mano.',
  },
  14: {
    title: 'Elige la gráfica correcta',
    question: 'Valentina quiere mostrar cómo han cambiado las temperaturas de su ciudad cada mes durante 3 años. ¿Qué tipo de gráfica es la más adecuada?',
    options: [
      'Gráfica de pie: para mostrar el porcentaje que representa cada uno de los meses',
      'Gráfica de líneas: muestra la evolución de un valor a lo largo del tiempo',
      'Diagrama de dispersión: para comparar dos variables sin relación con el tiempo',
      'Gráfica de barras en 3D: porque se ve más profesional, moderna y llamativa',
    ],
    correct: 1,
    feedback: 'Para mostrar cambios a lo largo del tiempo, la gráfica de líneas es la mejor: conecta los puntos y hace obvio si hay tendencia al alza, a la baja o ciclos. La de pie es para partes de un total.',
  },
  18: {
    title: 'Quiz de datos',
    question: 'Eres el analista de datos de tu colegio. La directora quiere saber si los estudiantes que leen más libros al mes sacan mejores calificaciones. ¿Qué gráfica usarías para mostrar esa relación?',
    options: [
      'Gráfica de pie: para ver el porcentaje de estudiantes lectores en todo el colegio',
      'Gráfica de barras: para comparar el promedio de notas de cada grado escolar',
      'Diagrama de dispersión: para ver si se relacionan libros leídos y calificaciones',
      'Gráfica de líneas: para mostrar cómo cambian las notas mes a mes durante el año',
    ],
    correct: 2,
    feedback: 'El diagrama de dispersión es perfecto para ver si dos variables numéricas se relacionan. Cada punto es un estudiante: en X los libros leídos, en Y su promedio. Si los puntos suben, hay correlación positiva.',
  },
};

// Módulo 2 · datos de la gráfica de barras
const CHART_ROWS = [
  { label: 'Corea del Sur', pct: 87 },
  { label: 'EE.UU.', pct: 79 },
  { label: 'Brasil', pct: 72 },
  { label: 'México', pct: 68 },
  { label: 'Nigeria', pct: 61 },
  { label: 'Colombia', pct: 54 },
  { label: 'Alemania', pct: 48 },
];

// Módulo 3 · tabla de datos (calificaciones)
const TABLE_HEAD = ['Materia', 'Trim 1', 'Trim 2', 'Trim 3'];
const TABLE_ROWS = [
  ['Matemáticas', '6.2', '5.8', '6.9'],
  ['Ciencias', '7.1', '7.4', '7.8'],
  ['Español', '8.0', '7.5', '8.2'],
  ['Historia', '6.8', '6.1', '5.9'],
  ['Inglés', '5.5', '6.2', '7.0'],
];

// Módulo 5 · Matching
const MATCH_PAIRS = [
  { left: '📊 Gráfica de barras', right: 'Comparar valores entre categorías distintas' },
  { left: '📈 Gráfica de líneas', right: 'Mostrar cómo algo cambia a lo largo del tiempo' },
  { left: '🥧 Gráfica de pie', right: 'Mostrar partes de un total (porcentajes que suman 100%)' },
  { left: '⚫ Diagrama de dispersión', right: 'Ver si existe relación entre dos variables numéricas' },
];

// Módulo 9 · Verdadero/Falso (privacidad)
const VF_ITEMS_1 = [
  { text: 'Puedo subir a ChatGPT documentos con mis datos personales completos (nombre, dirección, teléfono) sin ningún riesgo.', correct: false, feedback: 'FALSO. Los datos personales sensibles (nombre completo, dirección, contraseñas, datos bancarios) nunca deben compartirse con IA públicas. Pueden quedar guardados y usarse para entrenar modelos.' },
  { text: 'Es seguro subir un documento con datos anónimos (sin nombres) de una encuesta de mi clase para que la IA lo analice.', correct: true, feedback: 'VERDADERO. Los datos que no identifican a personas concretas son generalmente seguros de analizar con IA. La clave es que nadie pueda identificarse a partir de ellos.' },
  { text: 'Una vez que borras un chat con una IA, todos los datos que compartiste desaparecen para siempre.', correct: false, feedback: 'FALSO. Cada empresa tiene su política de retención. En la mayoría, los datos de entrenamiento se guardan aunque borres el chat. ¡Lee siempre los términos de servicio!' },
];

// Módulo 16 · Verdadero/Falso (predicción)
const VF_ITEMS_2 = [
  { text: 'La IA puede predecir el futuro con 100% de certeza si tiene suficientes datos.', correct: false, feedback: 'FALSO. La IA trabaja con probabilidades, no con certezas. Siempre hay incertidumbre en una predicción. Quien diga que la IA "sabe" el futuro con certeza, te está engañando.' },
  { text: 'Los modelos predictivos pueden cometer errores sistemáticos si los datos con que se entrenaron son sesgados.', correct: true, feedback: 'VERDADERO. Si entrenas un modelo con datos históricos sesgados, aprenderá ese sesgo y lo repetirá. Basura entra, basura sale.' },
  { text: 'Una correlación entre dos variables en los datos siempre significa que una causa a la otra.', correct: false, feedback: 'FALSO. Correlación ≠ causalidad. Ejemplo famoso: las películas de Nicolas Cage por año y las muertes por ahogamiento tienen correlación alta. ¡Obviamente una no causa la otra!' },
];

// Módulo 13 · Drag & drop de 3 zonas. zone 0 = normal, 1 = interesante, 2 = anomalía.
const DD_ITEMS: { text: string; zone: 0 | 1 | 2; why: string }[] = [
  { text: 'Los viernes a las 3pm hay el doble de logins que el resto de la semana', zone: 1, why: 'Es un patrón repetido y curioso: vale la pena investigar por qué.' },
  { text: 'Un estudiante tiene 200 horas de uso en un solo día (solo hay 24h en un día)', zone: 2, why: 'Es imposible: 200 horas no caben en un día. Es un error en los datos.' },
  { text: 'Las notas suben en promedio entre el primer y el tercer trimestre', zone: 0, why: 'Es lo esperado: los estudiantes suelen mejorar durante el año.' },
  { text: 'El 98% de los usuarios son de Colombia en una app colombiana', zone: 0, why: 'Es normal: una app colombiana tiene sobre todo usuarios colombianos.' },
  { text: 'Las notas de una materia caen 3 puntos exactos cada vez que hay un partido importante', zone: 1, why: 'Es un patrón sospechosamente exacto: interesante para analizar más a fondo.' },
];
const DD_ZONES = ['✅ Patrón normal / esperado', '🔍 Patrón interesante / analizar más', '🚨 Anomalía / posible error'];

// Builders y reflexión
const BUILDERS: Record<number, { icon: string; label: string; title: string; intro: string; box: string; example?: string; placeholder: string; fb: string; terms: string[]; topicMsg: string; table?: boolean }> = {
  3: {
    icon: '✏️', label: 'Constructor', title: 'Sé el analista de datos',
    intro: 'Imagina que tienes los promedios de tu clase durante un semestre. Escribe 3 preguntas que le harías a una IA para analizar estos datos. ¡Sé específico!',
    box: '💡 Ideas: ¿qué materia mejoró más entre el Trim 1 y el Trim 3? ¿Cuál bajó? ¿En qué trimestre les fue peor a todos? ¿Qué materia deberían priorizar?',
    placeholder: 'Pregunta 1: ¿Qué materia tuvo la mayor mejora entre el Trim 1 y el Trim 3?\nPregunta 2: ...\nPregunta 3: ...',
    fb: '📊 ¡Excelentes preguntas! Una IA como ChatGPT con Code Interpreter puede responderlas y generar gráficas automáticamente.',
    terms: DATA_TERMS, topicMsg: 'Escribe preguntas sobre los datos: materias, promedios, mejoras, trimestres o gráficas.',
    table: true,
  },
  7: {
    icon: '📊', label: 'Constructor', title: 'Tus datos escolares',
    intro: 'Piensa en tus propias calificaciones o actividades. Diseña un mini-análisis que le pedirías a una IA:',
    box: '📋 ¿Qué datos tienes? Calificaciones, asistencia, libros leídos, actividades...\n🎯 ¿Qué quieres descubrir? ¿En qué materia mejoraste más? ¿Cuándo rendiste mejor?\n📈 ¿Qué gráfica pides? ¿Barras para comparar? ¿Líneas para ver evolución?',
    example: '"Tengo mis notas de los últimos 3 trimestres en 5 materias. Quiero saber en cuál mejoré más, una gráfica de barras comparando el primer y último trimestre, y qué materia debería priorizar."',
    placeholder: 'Describe tu mini-análisis: qué datos tienes + qué quieres descubrir + qué gráfica quieres...',
    fb: '📈 ¡Análisis bien pensado! Con esos datos y ese prompt, una IA podría darte insights reales sobre tu rendimiento en segundos.',
    terms: DATA_TERMS, topicMsg: 'Describe tu análisis: qué datos tienes, qué quieres descubrir y qué gráfica pedirías.',
  },
  17: {
    icon: '📊', label: 'Constructor', title: 'Diseña tu tablero de datos ideal',
    intro: 'Un dashboard (tablero) es una pantalla que muestra los datos más importantes de un vistazo. Diseña uno para algo que te importa:',
    box: '🎯 Elige tu tema: rendimiento escolar, actividad física, goles de tu equipo, consumo de agua en casa...\n🔢 Define 3 indicadores clave: los 3 números más importantes\n📈 Elige las gráficas: ¿barras, líneas, pie? ¿Por qué esas?',
    example: '"Dashboard de mi equipo de fútbol: Indicador 1: goles marcados vs. recibidos (barras). Indicador 2: posición en la tabla a lo largo de la temporada (líneas). Indicador 3: % de victorias/empates/derrotas (pie)."',
    placeholder: 'Describe tu dashboard: tema + 3 indicadores + tipo de gráfica para cada uno...',
    fb: '📊 ¡Ese dashboard tiene sentido! Un diseñador de datos elige los indicadores más relevantes y la visualización correcta para cada uno.',
    terms: DATA_TERMS, topicMsg: 'Describe tu dashboard: el tema, 3 indicadores y qué gráfica usarías para cada uno.',
  },
  19: {
    icon: '💭', label: 'Reflexión', title: 'Los datos como superpoder',
    intro: 'Quien sabe hacer las preguntas correctas a los datos tiene un superpoder en el mundo moderno. Las empresas más valiosas del planeta lo son en gran parte porque saben leer y usar datos mejor que nadie.',
    box: '🔍 ¿Qué dato de tu vida o tu comunidad te gustaría analizar con IA?\n💡 ¿Qué secretos crees que revelaría ese análisis?\n❓ ¿Qué pregunta específica le harías a la IA?',
    placeholder: 'Escribe qué datos analizarías y qué esperas descubrir...',
    fb: '🔍 ¡Esa curiosidad por los datos es justo lo que buscan hoy empresas, gobiernos e instituciones! Los analistas de datos son uno de los perfiles más demandados.',
    terms: REFLECT_TERMS, topicMsg: 'Cuenta qué datos analizarías, qué secretos revelaría y qué le preguntarías a la IA.',
  },
};

// XP por módulo (campo xp real del HTML). Suma real = 270 (el header del HTML decía 245 — el conteo real manda)
const MODULE_XP: number[] = [0, 10, 15, 15, 10, 15, 15, 15, 10, 15, 15, 20, 10, 15, 15, 10, 15, 15, 20, 15, 0];
const MAX_XP = MODULE_XP.reduce((a, b) => a + b, 0); // 270
const TOTAL_STEPS = 21;   // 0=intro … 20=completado
const CONTENT_STEPS = 19; // módulos de contenido (1..19)
const SPRINT_DURATION = 60;

export default function Level17() {
  const completeLevel = useGameStore(s => s.completeLevel);
  const devMode = useGameStore(s => s.devMode);

  const [step, setStep] = useState(0);
  useReportProgress(step, TOTAL_STEPS);
  const [xp, setXp] = useState(0);
  const [xpToast, setXpToast] = useState<{ amount: number; id: number } | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const awardedSteps = useRef<Set<number>>(new Set());

  // Quizzes + chart con opciones barajadas (la correcta no debe tener posición fija)
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

  // VF (9, 16)
  const [vf1Answers, setVf1Answers] = useState<Record<number, boolean>>({});
  const [vf2Answers, setVf2Answers] = useState<Record<number, boolean>>({});

  // Sprint
  const [sprintPhase, setSprintPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [sprintSec, setSprintSec] = useState(SPRINT_DURATION);
  const [sprintText, setSprintText] = useState('');
  const [sprintValid, setSprintValid] = useState(false);

  // Drag & drop de 3 zonas (array fijo + mapa placed con índice ORIGINAL)
  const [ddPlaced, setDdPlaced] = useState<{ [idx: number]: 0 | 1 | 2 }>({});
  const [ddSel, setDdSel] = useState<number | null>(null);
  const [ddOverZone, setDdOverZone] = useState<0 | 1 | 2 | null>(null);
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
  }, [step]);

  // Sprint timer
  useEffect(() => {
    if (sprintPhase !== 'running') return;
    if (sprintSec <= 0) {
      const valid = sprintText.trim().length > 20 && !looksRandom(sprintText);
      setSprintValid(valid);
      setSprintPhase('done');
      if (valid) awardStep(MODULE_XP[11]);
      return;
    }
    const t = setTimeout(() => setSprintSec(s => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sprintPhase, sprintSec]);

  // Módulos puramente informativos (clasificación propia)
  const theorySteps = new Set([1, 4, 8, 12, 15]);
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
        const el = document.getElementById(`dd17-chip-${idx}`);
        if (!el) return;
        el.setAttribute('draggable', 'true');
        (el as HTMLElement).style.cursor = 'grab';
        const onDragStart = (e: DragEvent) => { ddIdxRef.current = idx; setDdSel(null); if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(idx)); } };
        const onDragEnd = () => { ddIdxRef.current = null; setDdOverZone(null); };
        el.addEventListener('dragstart', onDragStart);
        el.addEventListener('dragend', onDragEnd);
        cleanups.push(() => { el.removeEventListener('dragstart', onDragStart); el.removeEventListener('dragend', onDragEnd); });
      });
      ([0, 1, 2] as const).forEach(zone => {
        const el = document.getElementById(`dd17-zone-${zone}`);
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
    const stars = xp >= 190 ? 3 : xp >= 120 ? 2 : 1;
    completeLevel(17, stars, xp);
    router.replace('/level/18');
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
      if (n.size === MATCH_PAIRS.length) awardStep(MODULE_XP[5]);
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
    if (Object.keys(n).length === VF_ITEMS_2.length) awardStep(MODULE_XP[16]);
  };

  const submitSprint = () => {
    if (sprintPhase !== 'running') return;
    const valid = sprintText.trim().length > 20 && !looksRandom(sprintText);
    setSprintValid(valid);
    setSprintPhase('done');
    if (valid) awardStep(MODULE_XP[11]);
  };

  const ddPlace = (zone: 0 | 1 | 2) => {
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

  // ---------- Render de módulos ----------
  const renderBuilder = () => {
    const b = BUILDERS[step];
    return (
      <>
        <ModuleType icon={b.icon} label={b.label} />
        <Title>{b.title}</Title>
        <Body>{b.intro}</Body>
        {b.table && (
          <View style={styles.table}>
            <View style={styles.tableHeadRow}>
              {TABLE_HEAD.map((h, i) => <Text key={i} style={[styles.tableHead, i === 0 && { flex: 1.6, textAlign: 'left' }]}>{h}</Text>)}
            </View>
            {TABLE_ROWS.map((row, ri) => (
              <View key={ri} style={styles.tableRow}>
                {row.map((cell, ci) => <Text key={ci} style={[styles.tableCell, ci === 0 && { flex: 1.6, textAlign: 'left', color: C.text }]}>{cell}</Text>)}
              </View>
            ))}
          </View>
        )}
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

  const renderQuizOptions = (q: QuizMod) => (
    <>
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

  const renderStep = (): ReactNode => {
    switch (step) {
      // ===== 0 · INTRO =====
      case 0: return (
        <>
          <ModuleType icon="📊" label="Introducción" />
          <Title>Los datos son el nuevo superpoder</Title>
          <Body>Hay una frase famosa: <B>"Los datos son el petróleo del siglo XXI"</B>. Pero a diferencia del petróleo, los datos no se terminan: crecen cada segundo.</Body>
          <Body>Cada vez que usas una app, buscas en Google o publicas en redes, generas datos. La pregunta es: <B>¿quién sabe leer esos datos y qué secretos revelan?</B></Body>
          <Body>La IA puede analizar millones de datos en segundos y encontrar patrones que un humano tardaría años en descubrir. En este nivel vas a aprender a ser tú quien haga las preguntas correctas.</Body>
          <InfoBox>
            <B>¿Qué vas a aprender?</B>{'\n'}
            📊 Cómo la IA lee tablas y encuentra patrones{'\n'}
            📓 NotebookLM: la IA que analiza tus documentos{'\n'}
            📈 Qué tipo de gráfica usar para cada tipo de dato{'\n'}
            🔍 Cómo detectar cuando los datos mienten
          </InfoBox>
        </>
      );

      // ===== 1 · TEORÍA: la IA lee tablas =====
      case 1: return (
        <>
          <ModuleType icon="🧠" label="Teoría" />
          <Title>Cuando la IA analiza números</Title>
          <Body>Una de las habilidades más poderosas de los modelos de lenguaje modernos es que pueden <B>leer y analizar datos estructurados</B>: tablas, hojas de cálculo y bases de datos.</Body>
          <Body>Le subes una tabla (por ejemplo, las calificaciones de tu clase durante el año) y le haces preguntas en lenguaje normal:</Body>
          <InfoBox>
            ¿Cuál materia tiene el promedio más bajo?{'\n'}
            ¿En qué mes bajaron más las calificaciones?{'\n'}
            ¿Hay relación entre los días que llovió y las notas?{'\n'}
            ¿Qué estudiante tuvo la mayor mejora del año?
          </InfoBox>
          <Body>La IA responde todo eso en segundos e incluso genera gráficas. Antes esto requería saber Excel o Python. <B>Ahora solo necesitas saber qué pregunta hacer.</B></Body>
        </>
      );

      // ===== 2 · CHART + MCQ =====
      case 2: {
        const q = quizzes[2];
        return (
          <>
            <ModuleType icon="📈" label="Interpreta datos" />
            <Title>¿Qué dice esta gráfica?</Title>
            <Body style={{ marginBottom: 12 }}>Esta gráfica muestra el % de jóvenes de 12-17 años que usan IA en distintos países. Obsérvala y responde:</Body>
            <View style={styles.chartWrap}>
              {CHART_ROWS.map((row, i) => (
                <View key={i} style={styles.chartRow}>
                  <Text style={styles.chartLabel}>{row.label}</Text>
                  <View style={styles.chartBarBg}><View style={[styles.chartBarFill, { width: `${row.pct}%` }]} /></View>
                  <Text style={styles.chartVal}>{row.pct}%</Text>
                </View>
              ))}
            </View>
            <Body style={{ marginBottom: 4 }}><B>{q.question}</B></Body>
            {renderQuizOptions(q)}
          </>
        );
      }

      // ===== 3, 7, 17 · CONSTRUCTOR · 19 · REFLEXIÓN =====
      case 3: case 7: case 17: case 19: return renderBuilder();

      // ===== 4 · TEORÍA: NotebookLM =====
      case 4: return (
        <>
          <ModuleType icon="📓" label="Casos reales" />
          <Title>La IA que estudia tus documentos</Title>
          <Body><B>NotebookLM</B> es una herramienta gratuita de Google que te permite cargar tus propios documentos (PDFs, apuntes, artículos) y hacerle preguntas a una IA que los ha "leído" completos.</Body>
          <Body>Imagina que tienes que hacer un trabajo sobre el cambio climático. Subes 5 artículos científicos y luego preguntas:</Body>
          <InfoBox>
            "¿Qué dicen estos artículos sobre el nivel del mar?"{'\n'}
            "¿Hay contradicciones entre los datos de los artículos?"{'\n'}
            "Resume los 3 puntos en que todos los autores coinciden"{'\n'}
            "Crea un podcast de 2 minutos con los puntos clave"
          </InfoBox>
          <Body>Lo extraordinario es que NotebookLM <B>cita exactamente de qué parte de tus documentos</B> sacó cada respuesta. No inventa ni alucina: solo trabaja con lo que tú le diste.</Body>
        </>
      );

      // ===== 5 · MATCHING =====
      case 5: return (
        <>
          <ModuleType icon="🔗" label="Matching" />
          <Title>¿Qué gráfica usar?</Title>
          <Body style={{ marginBottom: 16 }}>Conecta cada tipo de gráfica con su mejor uso. Toca una del lado izquierdo, luego la correcta del lado derecho.</Body>
          <View style={styles.matchGrid}>
            <View style={styles.matchCol}>
              {MATCH_PAIRS.map((pair, i) => (
                <TouchableOpacity
                  key={`l${i}`}
                  style={[styles.matchItem, selectedLeft === i && styles.matchItemSelected, matched.has(i) && styles.matchItemMatched, wrongFlash?.left === i && styles.matchItemWrong]}
                  disabled={matched.has(i)}
                  onPress={() => setSelectedLeft(i)}
                >
                  <Text style={[styles.matchItemText, selectedLeft === i && { color: C.indigoLight }, matched.has(i) && { color: C.okText }, wrongFlash?.left === i && { color: C.failText }]}>{pair.left}</Text>
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
          {matched.size === MATCH_PAIRS.length && <Fb ok>✅ ¡Todos los pares conectados! Ya sabes elegir la gráfica correcta.</Fb>}
        </>
      );

      // ===== 6, 10, 14, 18 · QUIZ =====
      case 6: case 10: case 14: case 18: {
        const q = quizzes[step];
        return (
          <>
            <ModuleType icon="❓" label="Quiz" />
            <Title>{q.title}</Title>
            <Body style={{ marginBottom: 16 }}><B>{q.question}</B></Body>
            {renderQuizOptions(q)}
          </>
        );
      }

      // ===== 8 · TEORÍA: privacidad =====
      case 8: return (
        <>
          <ModuleType icon="🔐" label="Privacidad" />
          <Title>¿Qué saben de ti las apps?</Title>
          <Body>Cada vez que usas TikTok, Instagram o cualquier red social, generas datos que la plataforma recolecta:</Body>
          <Body><B>📍 Dónde estás:</B> tu ubicación cuando abres la app.</Body>
          <Body><B>⏱️ Cuánto tiempo:</B> exactamente cuántos segundos viste cada video.</Body>
          <Body><B>👆 Qué tocas:</B> en qué parte de la pantalla haces clic y cuántas veces.</Body>
          <Body><B>🔄 Tus patrones:</B> a qué hora usas la app, con qué frecuencia y desde qué dispositivo.</Body>
          <InfoBox><B>Un número que sorprende:</B> TikTok recolecta más de 120 puntos de datos distintos de cada usuario. Con eso, su algoritmo puede predecir tu estado de ánimo y cuánto tiempo más seguirás usando la app.</InfoBox>
          <Body>No es malo que existan estas tecnologías, pero sí es importante que <B>tú sepas que están ahí</B> y decidas conscientemente qué compartes.</Body>
        </>
      );

      // ===== 9 · VF privacidad =====
      case 9: return (
        <>
          <ModuleType icon="✔️" label="Verdadero o Falso" />
          <Title>¿Qué puedo compartir con la IA?</Title>
          {VF_ITEMS_1.map((item, idx) => {
            const ans = vf1Answers[idx];
            return (
              <View key={idx} style={styles.vfItem}>
                <Text style={styles.vfStatement}>"{item.text}"</Text>
                <View style={styles.vfButtons}>
                  <TouchableOpacity style={[styles.vfBtn, ans === true && (item.correct ? styles.vfBtnCorrect : styles.vfBtnWrong)]} disabled={ans !== undefined} onPress={() => answerVf1(idx, true)}>
                    <Text style={[styles.vfBtnText, ans === true && { color: item.correct ? C.okText : C.failText }]}>✅ Verdadero</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.vfBtn, ans === false && (!item.correct ? styles.vfBtnCorrect : styles.vfBtnWrong)]} disabled={ans !== undefined} onPress={() => answerVf1(idx, false)}>
                    <Text style={[styles.vfBtnText, ans === false && { color: !item.correct ? C.okText : C.failText }]}>❌ Falso</Text>
                  </TouchableOpacity>
                </View>
                {ans !== undefined && <Fb ok={ans === item.correct}>{ans === item.correct ? '✅ ' : '❌ Incorrecto. '}{item.feedback}</Fb>}
              </View>
            );
          })}
        </>
      );

      // ===== 11 · SPRINT =====
      case 11: {
        const minutes = Math.floor(sprintSec / 60);
        const seconds = String(sprintSec % 60).padStart(2, '0');
        return (
          <>
            <ModuleType icon="⚡" label="Sprint" />
            <Title>Sprint: saca 3 conclusiones</Title>
            <View style={styles.sprintBox}>
              <Text style={styles.sprintInstruction}>⚡ ¡60 segundos! Observa estos datos y escribe 3 conclusiones. En 2024, jóvenes que usan IA a diario: Asia 73%, Latinoamérica 58%, Europa 41%, África 34%.</Text>
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
              placeholder={'Conclusión 1: ...\nConclusión 2: ...\nConclusión 3: ...'}
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
              <Fb ok={sprintValid}>⚡ ¡Sprint terminado! {sprintValid ? 'Tres conclusiones listas: buen análisis rápido.' : 'La próxima vez intenta escribir 3 conclusiones distintas.'}</Fb>
            )}
          </>
        );
      }

      // ===== 12 · TEORÍA: datos que engañan =====
      case 12: return (
        <>
          <ModuleType icon="⚠️" label="Pensamiento crítico" />
          <Title>Los datos pueden mentir</Title>
          <Body>Una habilidad clave del siglo XXI es saber cuándo los datos o las gráficas se usan para engañar. Técnicas comunes:</Body>
          <Body><B>🔍 Eje Y truncado:</B> una gráfica que empieza en 97% en vez de 0% hace que una diferencia de 3% parezca enorme.</Body>
          <Body><B>📊 Muestra sesgada:</B> "el 90% prefiere la nueva metodología"... pero solo encuestaron a los que ya estaban satisfechos.</Body>
          <Body><B>🔗 Correlación ≠ causalidad:</B> en verano suben tanto el consumo de helados como los ahogamientos. ¿El helado causa ahogamientos? No: el calor causa ambos.</Body>
          <InfoBox><B>La pregunta que siempre debes hacerte:</B> "¿A quién beneficia que yo crea esta estadística?" Si alguien tiene interés en que la creas, verifica la fuente original.</InfoBox>
        </>
      );

      // ===== 13 · DRAG & DROP (3 zonas) =====
      case 13: return (
        <>
          <ModuleType icon="↕️" label="Clasifica" />
          <Title>¿Normal, patrón o anomalía?</Title>
          <Body>Clasifica estos hallazgos de una app escolar. Toca uno y luego su zona (o arrástralo).</Body>
          <View style={styles.dragPool}>
            {DD_ITEMS.map((item, idx) => ddPlaced[idx] === undefined ? (
              <TouchableOpacity key={idx} id={`dd17-chip-${idx}`} style={[styles.dragItem, ddSel === idx && styles.dragItemSel]} disabled={ddSolved} onPress={() => setDdSel(ddSel === idx ? null : idx)}>
                <Text style={styles.dragItemText}>{item.text}</Text>
              </TouchableOpacity>
            ) : null)}
            {ddAllPlaced && <Text style={{ color: C.placeholder, fontSize: 12 }}>Todos los hallazgos clasificados ✓</Text>}
          </View>
          {([0, 1, 2] as const).map(zone => (
            <View key={zone}>
              <Text style={styles.dropZoneLabel}>{DD_ZONES[zone]}</Text>
              <TouchableOpacity id={`dd17-zone-${zone}`} activeOpacity={0.8} style={[styles.dropZone, ddOverZone === zone && styles.dropZoneOver]} disabled={ddSolved} onPress={() => ddPlace(zone)}>
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
          {ddChecked && ddSolved && <Fb ok>✅ ¡Clasificación perfecta! Sabes distinguir un patrón normal, uno interesante y una anomalía.</Fb>}
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

      // ===== 15 · TEORÍA: pronóstico del clima =====
      case 15: return (
        <>
          <ModuleType icon="🌦️" label="Casos reales" />
          <Title>Cómo la IA predice el clima</Title>
          <Body>Los modelos modernos de predicción del clima son uno de los mejores ejemplos de IA analizando datos masivos para salvar vidas.</Body>
          <Body><B>GraphCast</B> (DeepMind, 2023) predice el clima global de los próximos 10 días con más precisión que los modelos tradicionales de supercomputadora, y lo hace en menos de un minuto.</Body>
          <Body>Funciona analizando 40 años de datos históricos del clima: temperaturas, presiones, vientos y humedad de millones de puntos del planeta a la vez.</Body>
          <InfoBox><B>Impacto real:</B> en 2023, GraphCast predijo con 9 días de anticipación que el huracán Lee tomaría un giro inesperado — 5 días antes que los modelos tradicionales. Esa diferencia puede significar evacuar a tiempo o una tragedia.</InfoBox>
        </>
      );

      // ===== 16 · VF predicción =====
      case 16: return (
        <>
          <ModuleType icon="✔️" label="Verdadero o Falso" />
          <Title>¿Puede la IA predecir el futuro?</Title>
          {VF_ITEMS_2.map((item, idx) => {
            const ans = vf2Answers[idx];
            return (
              <View key={idx} style={styles.vfItem}>
                <Text style={styles.vfStatement}>"{item.text}"</Text>
                <View style={styles.vfButtons}>
                  <TouchableOpacity style={[styles.vfBtn, ans === true && (item.correct ? styles.vfBtnCorrect : styles.vfBtnWrong)]} disabled={ans !== undefined} onPress={() => answerVf2(idx, true)}>
                    <Text style={[styles.vfBtnText, ans === true && { color: item.correct ? C.okText : C.failText }]}>✅ Verdadero</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.vfBtn, ans === false && (!item.correct ? styles.vfBtnCorrect : styles.vfBtnWrong)]} disabled={ans !== undefined} onPress={() => answerVf2(idx, false)}>
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
          <Text style={styles.completionIcon}>📊</Text>
          <Text style={styles.completionTitle}>¡Badge desbloqueado!</Text>
          <Text style={styles.completionBadge}>🏅 Data Detective</Text>
          <Text style={styles.completionText}>
            ¡Nivel 17 completado! Ahora sabes cómo la IA analiza datos, conoces NotebookLM, sabes elegir la gráfica correcta y puedes detectar cuando los datos te quieren engañar.
          </Text>
          <Text style={styles.xpGained}>+<Text style={{ color: C.indigoLight }}>{xp}</Text> XP</Text>
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
              <Text style={styles.statNum}>N18</Text>
              <Text style={styles.statLbl}>Próximo nivel</Text>
            </View>
          </View>
          <View style={styles.nextLevelBox}>
            <Text style={styles.nextLevelText}>
              🔗 <Text style={{ fontWeight: '700', color: C.text }}>Nivel 18: IA Multimodal{'\n\n'}</Text>
              El gran cierre del Mundo 3: IA que combina texto, imagen, audio y video al mismo tiempo. Todo lo que aprendiste, junto.
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
      case 1: case 4: case 8: case 12: case 15:
        return { label: 'Continuar →', enabled: true, onPress: () => { awardStep(MODULE_XP[step]); next(); } };
      case 2: case 6: case 10: case 14: case 18:
        return { label: 'Continuar →', enabled: quizSel !== null || devMode, note: quizSel === null ? `Responde para continuar · +${MODULE_XP[step]} XP` : undefined, onPress: next };
      case 3: case 7: case 17: case 19: {
        const isReflect = step === 19;
        if (!builderDone) return { label: isReflect ? 'Enviar reflexión →' : 'Confirmar →', enabled: builderText.trim().length > 15 || devMode, note: `Escribe al menos 16 caracteres · +${MODULE_XP[step]} XP`, onPress: confirmBuilder };
        return { label: step === 19 ? 'Completar nivel →' : 'Continuar →', enabled: true, onPress: next };
      }
      case 5: return { label: 'Continuar →', enabled: matched.size === MATCH_PAIRS.length || devMode, note: matched.size < MATCH_PAIRS.length ? `Conecta los ${MATCH_PAIRS.length} pares · +${MODULE_XP[step]} XP` : undefined, onPress: next };
      case 9: return { label: 'Continuar →', enabled: Object.keys(vf1Answers).length === VF_ITEMS_1.length || devMode, note: `Responde las ${VF_ITEMS_1.length} afirmaciones · +${MODULE_XP[step]} XP`, onPress: next };
      case 11: return { label: 'Continuar →', enabled: sprintPhase === 'done' || devMode, note: sprintPhase !== 'done' ? 'Escribe tus conclusiones y pulsa "Entregar" · +20 XP' : undefined, onPress: next };
      case 13:
        if (!ddChecked || (!ddSolved && !ddAllCorrect)) return { label: 'Verificar →', enabled: ddAllPlaced || devMode, note: `Clasifica los ${DD_ITEMS.length} hallazgos · +${MODULE_XP[step]} XP`, onPress: verifyDd };
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
          <View style={styles.levelBadge}><Text style={styles.levelBadgeText}>📊 MUNDO 3 · NIVEL 17</Text></View>
          <Text style={styles.levelTitle}>Descubre <Text style={{ color: C.indigoLight }}>Secretos en los Datos</Text></Text>
          <Text style={styles.subtitle}>Cómo la IA lee tablas, gráficas y documentos</Text>
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

      {xpToast && <XPToast key={xpToast.id} amount={xpToast.amount} onHide={() => setXpToast(null)} bgColor={C.indigo} textColor="#fff" />}
    </View>
  );
}

// ===================== ESTILOS (paleta oscura índigo del HTML nivel-17) =====================
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },

  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingTop: 11, paddingBottom: 8, backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.border },
  closeBtn: { minWidth: 42, minHeight: 42, borderRadius: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 12, color: C.indigoLight, fontWeight: '800' },
  xpChip: { paddingHorizontal: 11, paddingVertical: 4, borderRadius: 12, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border },
  xpChipText: { fontSize: 12, color: C.indigoLight, fontWeight: '700' },

  container: { padding: 16, paddingBottom: 28 },

  // Header del nivel
  header: { marginBottom: 20 },
  levelBadge: { alignSelf: 'flex-start', backgroundColor: C.violet, borderRadius: 99, paddingHorizontal: 16, paddingVertical: 6, marginBottom: 12 },
  levelBadgeText: { ...typography.bold, fontSize: 12, color: '#fff', letterSpacing: 0.6 },
  levelTitle: { ...typography.extraBold, fontSize: 28, color: C.text, lineHeight: 34 },
  subtitle: { ...typography.regular, fontSize: 13, color: C.muted, marginTop: 4, marginBottom: 14 },
  progressBar: { width: '100%', height: 8, backgroundColor: C.border, borderRadius: 99, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: C.indigo, borderRadius: 99 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  progressLabel: { fontSize: 11, color: C.muted, fontWeight: '500' },

  // Tarjeta del módulo
  moduleCard: { backgroundColor: C.card, borderRadius: 16, padding: 22, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  moduleCardAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: C.indigo },
  moduleXpBadge: { position: 'absolute', top: 14, right: 14, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  moduleXpBadgeText: { fontSize: 11, fontWeight: '700', color: C.indigoLight },
  moduleType: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  moduleTypeText: { ...typography.bold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: C.indigoLight },
  moduleTitle: { ...typography.extraBold, fontSize: 19, color: C.text, marginBottom: 14, lineHeight: 25 },
  bodyText: { ...typography.regular, fontSize: 14, lineHeight: 23, color: C.muted, marginBottom: 12 },
  bold: { fontWeight: '700', color: C.text },
  infoBox: { backgroundColor: C.card2, borderLeftWidth: 4, borderLeftColor: C.indigo, borderTopRightRadius: 12, borderBottomRightRadius: 12, paddingHorizontal: 16, paddingVertical: 13, marginBottom: 14 },
  infoBoxText: { ...typography.regular, fontSize: 13, lineHeight: 24, color: C.muted },

  // Tabla de datos
  table: { borderWidth: 1, borderColor: C.border, borderRadius: 10, overflow: 'hidden', marginBottom: 14 },
  tableHeadRow: { flexDirection: 'row', backgroundColor: C.indigo },
  tableHead: { flex: 1, color: '#fff', fontWeight: '700', fontSize: 12, paddingVertical: 8, paddingHorizontal: 8, textAlign: 'center' },
  tableRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.border },
  tableCell: { flex: 1, color: C.muted, fontSize: 12, paddingVertical: 8, paddingHorizontal: 8, textAlign: 'center' },

  // Chart
  chartWrap: { backgroundColor: C.card2, borderRadius: 12, padding: 14, marginBottom: 14 },
  chartRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  chartLabel: { width: 84, fontSize: 11, color: C.muted, textAlign: 'right' },
  chartBarBg: { flex: 1, backgroundColor: C.border, borderRadius: 4, height: 20, overflow: 'hidden' },
  chartBarFill: { height: '100%', borderRadius: 4, backgroundColor: C.indigo },
  chartVal: { width: 38, fontSize: 11, color: C.indigoLight, fontWeight: '700' },

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
  matchItemSelected: { borderColor: C.blueLight, backgroundColor: '#1a1a40' },
  matchItemMatched: { borderColor: C.green2, backgroundColor: C.okBg },
  matchItemWrong: { borderColor: C.red, backgroundColor: C.failBg },
  matchItemText: { fontSize: 12, color: C.text, textAlign: 'center', lineHeight: 17, fontWeight: '500' },

  // Builder
  builderInput: { backgroundColor: C.surface, borderWidth: 2, borderColor: C.border, borderRadius: 12, padding: 14, fontSize: 14, lineHeight: 21, color: C.text, minHeight: 100, marginVertical: 10, textAlignVertical: 'top' },
  builderExample: { backgroundColor: C.card2, borderLeftWidth: 3, borderLeftColor: C.indigoLight, borderTopRightRadius: 10, borderBottomRightRadius: 10, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12 },
  builderExampleText: { fontSize: 13, color: C.muted, lineHeight: 20, fontStyle: 'italic' },
  builderExampleLabel: { color: C.indigoLight, fontWeight: '700', fontStyle: 'normal' },

  // Sprint
  sprintBox: { backgroundColor: '#0a0a24', borderWidth: 2, borderColor: C.indigo, borderRadius: 16, padding: 22, alignItems: 'center', marginBottom: 12 },
  sprintInstruction: { textAlign: 'center', marginBottom: 6, fontSize: 13, lineHeight: 20, color: C.muted },
  timerText: { fontSize: 44, fontWeight: '800', color: C.indigoLight, fontVariant: ['tabular-nums'], marginVertical: 8 },
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

  // Drag & drop
  dragPool: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 14, backgroundColor: C.card2, borderWidth: 2, borderStyle: 'dashed', borderColor: C.border, borderRadius: 12, minHeight: 70, marginBottom: 12, alignItems: 'center' },
  dragItem: { backgroundColor: C.surface, borderWidth: 2, borderColor: C.border, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  dragItemSel: { borderColor: C.indigo, backgroundColor: '#1a1a40' },
  dragItemOk: { borderColor: C.green2, backgroundColor: C.okBg },
  dragItemBad: { borderColor: C.red, backgroundColor: C.failBg },
  dragItemText: { fontSize: 12, color: C.text, lineHeight: 17 },
  dropZoneLabel: { fontSize: 12, fontWeight: '700', color: C.indigoLight, marginBottom: 6 },
  dropZone: { minHeight: 60, padding: 12, borderWidth: 2, borderStyle: 'dashed', borderColor: C.border, borderRadius: 12, backgroundColor: C.card2, marginBottom: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' },
  dropZoneOver: { borderColor: C.indigo, backgroundColor: '#1a1a40' },

  // Botones
  btn: { backgroundColor: C.indigo, padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 12 },
  btnText: { ...typography.bold, color: '#fff', fontSize: 14 },

  // Completado
  completionScreen: { alignItems: 'center', paddingVertical: 20 },
  completionIcon: { fontSize: 64, marginBottom: 12 },
  completionTitle: { ...typography.extraBold, fontSize: 26, color: C.indigoLight, textAlign: 'center', marginBottom: 4 },
  completionBadge: { ...typography.extraBold, fontSize: 20, color: C.indigoLight, marginVertical: 8 },
  completionText: { ...typography.regular, fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 16, color: C.muted },
  xpGained: { ...typography.extraBold, fontSize: 34, color: C.text, marginBottom: 16 },
  statsRow: { flexDirection: 'row', width: '100%', gap: 8, marginBottom: 16 },
  statItem: { flex: 1, alignItems: 'center', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 8 },
  statNum: { ...typography.extraBold, fontSize: 20, color: C.indigoLight },
  statLbl: { fontSize: 10, color: C.muted, marginTop: 2, textAlign: 'center' },
  nextLevelBox: { backgroundColor: C.card2, borderRadius: 10, padding: 13, marginBottom: 16, borderWidth: 1, borderColor: C.border, width: '100%' },
  nextLevelText: { fontSize: 12, color: C.muted, lineHeight: 20 },

  // Footer
  btnRow: { paddingHorizontal: 13, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.surface },
  btnRowInner: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  backBtn: { paddingHorizontal: 16, paddingVertical: 13, borderRadius: 10, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, minHeight: 48, justifyContent: 'center' },
  backBtnText: { fontSize: 14, fontWeight: '700', color: C.muted },
  mainBtn: { padding: 13, borderRadius: 10, backgroundColor: C.indigo, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  mainBtnDisabled: { opacity: 0.35 },
  btnNote: { fontSize: 11, color: C.placeholder, textAlign: 'center', marginTop: 5, minHeight: 15 },
});
