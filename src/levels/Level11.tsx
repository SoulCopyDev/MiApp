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
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useGameStore } from '../store/gameStore';
import { colors, typography } from '../theme';

// ---------- Tipos ----------
type CompareCoT = {
  problema: string;
  directo: { prompt: string; resp: string };
  cot: { prompt: string; resp: string };
  q: string;
  opts: string[];
  correct: number;
  explain: string;
};
type TareaCompleja = {
  tarea: string;
  subtareas: string[];
  errorComun: string;
};
type FillCoT = {
  base: string;
  campos: string[];
  correcto: string;
};
type VFCoTItem = { stmt: string; correct: boolean; explain: string };
type ArbolItem = { condicion: string; accion: string; alternativa: string };
type RazonItem = { texto: string; tipo: string; label: string; explain: string };
type QuizCoTItem = { q: string; opts: string[]; correct: number; explain: string };

const TOTAL_STEPS = 20; // 0:intro + 18 módulos + 1:complete
const CONTENT_STEPS = 18;

const pickN = <T,>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};

// ===================== POOLS =====================

const COMPARE_COT: CompareCoT = {
  problema: '¿Cuántos segundos hay en una semana?',
  directo: {
    prompt: '¿Cuántos segundos hay en una semana?',
    resp: '604,800 segundos. [Sin mostrar cómo llegó ahí — puede ser incorrecto sin que lo notes]',
  },
  cot: {
    prompt:
      'Calcula cuántos segundos hay en una semana. Muéstrame cada paso del razonamiento: primero días, luego horas, luego minutos, luego segundos. Al final, verifica el resultado.',
    resp: 'Paso 1: 1 semana = 7 días. Paso 2: 7 × 24 = 168 horas. Paso 3: 168 × 60 = 10,080 minutos. Paso 4: 10,080 × 60 = 604,800 segundos. ✓ Verificación: 604,800 / 60 = 10,080 ✓',
  },
  q: '¿Por qué el segundo prompt es más valioso aunque el resultado numérico sea el mismo?',
  opts: [
    'Porque usa más palabras y la IA respeta los prompts más largos',
    'Porque muestra el razonamiento paso a paso — puedes detectar exactamente dónde hay un error si lo hay',
    'Porque pedir verificación activa un modo especial de precisión en el modelo',
    'Porque los prompts con la palabra \'primero, luego\' siempre dan mejores resultados',
  ],
  correct: 1,
  explain:
    'El valor del CoT no es el resultado — es la trazabilidad. Si hay un error, lo ves en el paso exacto donde ocurrió. Con el prompt directo, si el número fuera incorrecto, no tendrías forma de detectarlo sin recalcular tú mismo.',
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
];

const FILL_COT: FillCoT[] = [
  {
    base: 'Analiza los pros y contras de estudiar en el extranjero.',
    campos: [
      "Añade: 'Al terminar de analizar los pros, dime cuántos encontraste'",
      "Añade: 'Antes de los contras, resume los pros en una frase'",
      "Añade: 'Al final, dame tu conclusión más importante con un veredicto claro'",
    ],
    correcto:
      'Analiza los pros y contras de estudiar en el extranjero. Al terminar los pros, dime cuántos encontraste. Antes de pasar a los contras, resume los pros en una frase. Al terminar, dame tu conclusión más importante con un veredicto claro: ¿vale la pena o no?',
  },
  {
    base: 'Escribe un ensayo sobre el impacto de las redes sociales.',
    campos: [
      "Añade: 'Primero crea un esquema con las 3 ideas principales'",
      "Añade: 'Escríbelo párrafo a párrafo, confirmando al inicio de cada uno cuál idea desarrollas'",
      "Añade: 'Al terminar, identifica el argumento más débil y cómo reforzarlo'",
    ],
    correcto:
      'Escribe un ensayo sobre el impacto de las redes sociales. Primero crea un esquema con las 3 ideas principales. Luego escríbelo párrafo a párrafo, indicando al inicio de cada uno cuál idea desarrollas. Al terminar, identifica el argumento más débil y cómo reforzarlo.',
  },
];

const VF_COT_POOL: VFCoTItem[] = [
  { stmt: "Añadir 'piénsalo paso a paso' a un prompt mejora significativamente la precisión en problemas que requieren razonamiento.", correct: true, explain: 'Verdadero. Esta técnica (Chain-of-Thought prompting) fuerza al modelo a generar pasos intermedios que anclan el razonamiento y reducen errores.' },
  { stmt: 'Si un LLM muestra todos los pasos de su razonamiento, garantiza que el resultado final es correcto.', correct: false, explain: 'Falso. El modelo puede cometer errores en los pasos intermedios. El CoT mejora la probabilidad de corrección, no la garantiza.' },
  { stmt: 'Una cadena de prompts de 3 pasos siempre produce mejores resultados que un prompt único largo.', correct: false, explain: 'Falso. Para tareas simples, la cadena es sobreingeniería. El CoT es valioso para razonamiento multistep, no para todas las tareas.' },
  { stmt: "Pedir a la IA que 'verifique su propia respuesta' puede detectar algunos errores que cometió.", correct: true, explain: 'Verdadero. Agregar "revisa y corrige si hay error" detecta inconsistencias obvias y mejora la confiabilidad.' },
  { stmt: 'Los LLMs razonan de forma similar a como los humanos resuelven problemas de lógica.', correct: false, explain: 'Falso. Los LLMs generan texto probable dado el contexto — no "razonan" en el sentido cognitivo humano.' },
  { stmt: 'Dividir una tarea compleja en sub-prompts independientes generalmente produce mejor resultado que un mega-prompt.', correct: true, explain: 'Verdadero. Cada sub-tarea recibe toda la atención del modelo.' },
  { stmt: "Si le pido a la IA que 'piense en voz alta', siempre obtengo exactamente cómo llegó a su conclusión.", correct: false, explain: 'Falso. El modelo genera texto que parece razonamiento, pero no es necesariamente el proceso real.' },
  { stmt: 'Un prompt con checkpoints intermedios es especialmente útil para tareas de escritura larga.', correct: true, explain: 'Verdadero. Los checkpoints evitan que el modelo pierda el hilo o desvíe el tema.' },
];

const ARBOL_ITEMS: ArbolItem[] = [
  { condicion: 'Si el usuario escribe algo en otro idioma', accion: 'Responde en el mismo idioma que usó', alternativa: 'Cambia al español automáticamente' },
  { condicion: 'Si no entiendes la pregunta', accion: 'Pide una aclaración antes de responder', alternativa: 'Inventa una interpretación y responde' },
  { condicion: 'Si la respuesta requiere más de 300 palabras', accion: 'Divide en secciones con subtítulos', alternativa: 'Responde todo en un párrafo sin estructura' },
  { condicion: 'Si el usuario dice que tu respuesta está mal', accion: 'Reconsidera el razonamiento y admite el error si es válido', alternativa: 'Insiste en que tu respuesta original es correcta' },
];

const RAZON_ITEMS: RazonItem[] = [
  { texto: "La IA dice: 'Einstein fue el científico más importante del siglo XX, por lo tanto todas sus teorías son correctas.'", tipo: 'falacia', label: '⚠️ Falacia lógica', explain: 'Argumento de autoridad: que alguien sea importante no hace automáticamente correcta cada afirmación.' },
  { texto: "La IA dice: 'Los estudios muestran que el 60% de personas prefieren X. Por lo tanto, X es mejor para todo el mundo.'", tipo: 'salto', label: '🦘 Salto de conclusión', explain: "Salto de 'mayoría lo prefiere' a 'es mejor para todos'. La preferencia mayoritaria no implica superioridad universal." },
  { texto: "La IA dice: 'La capital de Australia es Sídney.' (La capital real es Canberra)", tipo: 'dato', label: '❌ Dato falso', explain: 'Alucinación clásica. Sídney es la ciudad más grande y conocida. Siempre verifica capitales, fechas y estadísticas.' },
  { texto: "La IA dice: 'Si X causa Y en ratas de laboratorio, entonces X causará exactamente lo mismo en humanos.'", tipo: 'falacia', label: '⚠️ Falacia lógica', explain: 'Generalización inválida: los resultados en modelos animales no se transfieren automáticamente a humanos.' },
  { texto: "La IA dice: 'Este autor publicó un artículo en 2019 argumentando Z.' (El artículo no existe)", tipo: 'dato', label: '❌ Dato falso', explain: 'Alucinación de cita bibliográfica. Nunca uses una cita de IA sin verificarla.' },
];

const QUIZ_COT: QuizCoTItem[] = [
  { q: '¿Qué significa CoT en el contexto del prompting?', opts: ['Copy of Text', 'Chain-of-Thought — técnica de pedir razonamiento paso a paso explícito', 'Context of Terms', 'Correction of Tone'], correct: 1, explain: 'CoT = Chain-of-Thought. Es la técnica de añadir "piénsalo paso a paso" para forzar razonamiento intermedio visible.' },
  { q: 'Tienes que analizar 50 páginas de un documento. ¿Cuál es la estrategia más efectiva?', opts: ['Pegar todo en un solo prompt', 'Dividir en secciones y hacer un prompt por sección, luego integrar', 'Pedirle a la IA que lo lea en múltiples conversaciones', 'Copiar solo las conclusiones'], correct: 1, explain: 'Dividir en secciones permite profundidad real en cada parte.' },
  { q: '¿Cuándo un prompt iterativo (ronda 1 → feedback → ronda 2) es más valioso que un único prompt?', opts: ['Siempre', 'Cuando la tarea requiere refinamiento progresivo: escritura, código, análisis complejo', 'Cuando el primer resultado fue completamente inútil', 'Cuando tienes más de 10 minutos'], correct: 1, explain: 'El prompting iterativo brilla en tareas donde la dirección inicial es correcta pero el resultado necesita pulirse.' },
  { q: "Añades 'verifica tu respuesta al final y corrígela si hay error'. ¿Qué hace el modelo?", opts: ['Accede a internet para verificar', 'Activa un modo de mayor precisión', 'Genera una segunda pasada por su propia respuesta buscando inconsistencias obvias', 'Consulta una base de datos de respuestas correctas'], correct: 2, explain: 'El modelo genera una segunda revisión de su texto buscando contradicciones internas — lo que sí puede detectar.' },
];

const SPRINT_CADENAS = [
  'Planifica una semana de estudio para un examen de química en 7 días',
  'Analiza las ventajas y desventajas de vivir en una ciudad grande vs. un pueblo',
  'Diseña un asistente de IA que ayude a estudiantes con tareas de matemáticas',
];

const ACERTIJOS = [
  {
    problema:
      'Tengo hermanos y hermanas. Mis padres tienen X hijos en total, donde X es el número de hijos que resulta de que cada hijo mío tiene el doble de hermanos que de hermanas — siendo yo mujer. ¿Cuántos hermanos y hermanas tengo?',
    hint: 'Usa variables. Sea H = hermanos, M = hermanas (incluyéndome). Para mí (mujer): hermanos = H, hermanas = M-1. La condición es H = 2(M-1).',
    solucion:
      'Si H = 4 y M = 3: para mí, hermanos = 4, hermanas = 2. ¿Se cumple 4 = 2×2? Sí. Total: 4 hermanos + 3 hermanas = 7 hijos.',
  },
];

// ===================== COMPONENTE =====================
interface LevelProps {
  navigation?: any;
  setAllowBack?: (allow: boolean) => void;
}

export default function World2Level5({ navigation: propsNavigation, setAllowBack }: LevelProps) {
  const navigationFromHook = useNavigation();
  const navigation = propsNavigation || navigationFromHook;
  const completeLevel = useGameStore((state) => state.completeLevel);

  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);
  const [stepResult, setStepResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Pools aleatorios
  const [fillCotItem] = useState(() => pickN(FILL_COT, 1)[0]);
  const [tareaCompleja] = useState(() => pickN(TAREAS_COMPLEJAS, 1)[0]);
  const [vfItems] = useState(() => pickN(VF_COT_POOL, 6));

  // Estados de módulos
  const [compareAnswered, setCompareAnswered] = useState(false);
  const [compareSel, setCompareSel] = useState<number | null>(null);

  // Builder 3 pasos (módulo 3)
  const [tema, setTema] = useState('');
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [p3, setP3] = useState('');
  const [chainBuilt, setChainBuilt] = useState(false);

  // Fill checkpoints (módulo 5)
  const [cpValues, setCpValues] = useState<string[]>(['', '', '']);
  const [cpDone, setCpDone] = useState(false);

  // V/F (módulo 6)
  const [vfIdx, setVfIdx] = useState(0);
  const [vfScore, setVfScore] = useState(0);
  const [vfDone, setVfDone] = useState(false);
  const [vfAnswered, setVfAnswered] = useState(false);
  const [vfSel, setVfSel] = useState<boolean | null>(null);

  // Matching árbol (módulo 8)
  const [arbolAnswers, setArbolAnswers] = useState<(number | null)[]>([null, null, null, null]);
  const [arbolChecked, setArbolChecked] = useState(false);

  // Prompt iterativo (módulo 9)
  const [iterRound, setIterRound] = useState(1);
  const [iterText, setIterText] = useState('');
  const [iterDone, setIterDone] = useState(false);

  // Sprint (módulo 11)
  const [sprintIdx, setSprintIdx] = useState(0);
  const [sprintSec, setSprintSec] = useState(90);
  const [sprintDone, setSprintDone] = useState(false);
  const [sprintModelo, setSprintModelo] = useState(false);
  const sprintTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Builder verificación (módulo 12)
  const [vpBase, setVpBase] = useState('');
  const [vpBuilt, setVpBuilt] = useState(false);

  // Clasificador errores (módulo 14)
  const [razonIdx, setRazonIdx] = useState(0);
  const [razonScore, setRazonScore] = useState(0);
  const [razonDone, setRazonDone] = useState(false);
  const [razonAnswered, setRazonAnswered] = useState(false);
  const [razonSel, setRazonSel] = useState<number | null>(null);

  // Acertijo (módulo 16)
  const [acertijoText, setAcertijoText] = useState('');
  const [acertijoDone, setAcertijoDone] = useState(false);

  // Quiz (módulo 17)
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizDone, setQuizDone] = useState(false);
  const [quizAnswered, setQuizAnswered] = useState(false);
  const [quizSel, setQuizSel] = useState<number | null>(null);

  // Reflexión (módulo 18)
  const [reflectText, setReflectText] = useState('');
  const [reflectDone, setReflectDone] = useState(false);

  const examSteps = new Set([2, 5, 6, 8, 9, 11, 14, 16, 17]);
  const isExamMode = examSteps.has(step);

  useEffect(() => { setAllowBack?.(!isExamMode); }, [isExamMode, setAllowBack]);

  useEffect(() => {
    const onBackPress = () => {
      if (isExamMode) {
        Alert.alert('Módulo en curso', 'No puedes regresar durante esta actividad.', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Salir', style: 'destructive', onPress: () => navigation.goBack() },
        ]);
        return true;
      }
      return false;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [isExamMode, navigation]);

  useEffect(() => {
    if (step === 6) { setVfIdx(0); setVfScore(0); setVfDone(false); setVfAnswered(false); setVfSel(null); }
    if (step === 11) { setSprintIdx(0); setSprintSec(90); setSprintDone(false); setSprintModelo(false); if (sprintTimer.current) clearInterval(sprintTimer.current); }
    if (step === 14) { setRazonIdx(0); setRazonScore(0); setRazonDone(false); setRazonAnswered(false); setRazonSel(null); }
    if (step === 17) { setQuizIdx(0); setQuizScore(0); setQuizDone(false); setQuizAnswered(false); setQuizSel(null); }
  }, [step]);

  const addXP = (n: number) => setXp((prev) => prev + n);
  const goToNextStep = () => { setStepResult(null); if (step < TOTAL_STEPS - 1) setStep(step + 1); };

  const showResult = (ok: boolean, msg: string, andAdvance = false) => {
    setStepResult({ ok, msg });
    if (andAdvance) setTimeout(() => goToNextStep(), 1800);
  };

  const handleClose = () => {
    Alert.alert('Salir', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', onPress: () => navigation.goBack() },
    ]);
  };

  const handleFinish = () => {
    let stars = 0;
    if (xp >= 180) stars = 3;
    else if (xp >= 120) stars = 2;
    else if (xp >= 60) stars = 1;
    completeLevel(11, stars, xp);
    navigation.goBack();
  };

  // ============ MECÁNICAS ============

  // Compare CoT (2)
  const answerCOT = (i: number) => {
    if (compareAnswered) return;
    setCompareAnswered(true);
    setCompareSel(i);
    const correct = i === COMPARE_COT.correct;
    if (correct) addXP(12);
    Alert.alert(correct ? '✅ ¡Correcto! +12 XP' : '❌ Incorrecto', COMPARE_COT.explain);
  };

  // Builder 3 pasos (3)
  const isChainOk = tema.trim().length >= 5 && p1.trim().length >= 5 && p2.trim().length >= 5 && p3.trim().length >= 5;
  const checkChain = () => { if (isChainOk && !chainBuilt) { addXP(10); setChainBuilt(true); } };
  useEffect(() => { checkChain(); }, [tema, p1, p2, p3]);

  // Fill checkpoints (5)
  const isCpOk = cpValues.every((v) => v.trim().length >= 10);
  const commitCp = () => {
    if (isCpOk && !cpDone) { addXP(15); setCpDone(true); }
  };

  // V/F (6)
  const answerVF = (ans: boolean) => {
    if (vfAnswered || vfDone) return;
    setVfAnswered(true);
    setVfSel(ans);
    const correct = ans === vfItems[vfIdx].correct;
    if (correct) setVfScore((prev) => prev + 1);
  };
  const nextVf = () => {
    if (vfIdx + 1 >= vfItems.length) {
      const earned = vfScore * 8;
      if (earned > 0) addXP(earned);
      setVfDone(true);
    } else {
      setVfIdx((prev) => prev + 1);
      setVfAnswered(false);
      setVfSel(null);
    }
  };

  // Matching árbol (8)
  const selArbol = (i: number, choice: number) => {
    if (arbolChecked) return;
    setArbolAnswers((prev) => { const n = [...prev]; n[i] = choice; return n; });
  };
  const checkArbol = () => {
    if (arbolChecked) return true;
    if (arbolAnswers.some((a) => a === null)) { Alert.alert('Incompleto', 'Elige una opción para cada condición.'); return false; }
    setArbolChecked(true);
    let correct = 0;
    ARBOL_ITEMS.forEach((_, i) => { if (arbolAnswers[i] === 0) correct++; });
    addXP(correct * 8);
    showResult(correct >= 3, `${correct >= 3 ? '✅ ¡Bien!' : '⚠️ Revisa'} ${correct}/4 correctas. +${correct * 8} XP`, true);
    return false;
  };

  // Prompt iterativo (9)
  const advanceIter = () => {
    if (iterText.trim().length < 20) { Alert.alert('Muy corto', 'Escribe al menos 20 caracteres.'); return; }
    addXP(iterRound === 3 ? 20 : 8);
    if (iterRound < 3) { setIterRound((prev) => prev + 1); setIterText(''); }
    else { setIterDone(true); Alert.alert('✅ Proceso iterativo completado', '+36 XP acumulados'); }
  };

  // Sprint (11)
  const SP_MODELOS = [
    'P1: Lista los 7 temas de química del examen. P2: Para cada tema, dame el concepto clave y una fórmula. P3: Diseña 2 ejercicios de práctica por tema con solución.',
    'P1: Analiza pros y contras de vivir en ciudad vs. pueblo (5 cada uno). P2: Pondera según: calidad de vida, oportunidades laborales, costo y relaciones sociales. P3: Dame una recomendación personalizada.',
    'P1: Define el perfil del estudiante ideal para este asistente. P2: Diseña el system prompt con rol, tono, límites y ejemplos. P3: Crea 5 preguntas de prueba para verificar que el asistente funciona bien.',
  ];
  const startSprint = () => {
    setSprintModelo(false);
    setSprintSec(90);
    sprintTimer.current = setInterval(() => {
      setSprintSec((prev) => { if (prev <= 1) { clearInterval(sprintTimer.current!); return 0; } return prev - 1; });
    }, 1000);
  };
  const verModelo = () => {
    clearInterval(sprintTimer.current!);
    setSprintModelo(true);
    addXP(10);
  };
  const nextSprint = () => {
    if (sprintIdx + 1 >= SPRINT_CADENAS.length) {
      setSprintDone(true);
    } else {
      setSprintIdx((prev) => prev + 1);
      setSprintModelo(false);
      setSprintSec(90);
    }
  };

  // Builder verificación (12)
  const isVpOk = vpBase.trim().length >= 15;
  const checkVp = () => { if (isVpOk && !vpBuilt) { addXP(10); setVpBuilt(true); } };
  useEffect(() => { checkVp(); }, [vpBase]);

  // Clasificador errores (14)
  const razonMap: Record<string, number> = { falacia: 0, salto: 1, dato: 2 };
  const answerRazon = (i: number) => {
    if (razonAnswered || razonDone) return;
    setRazonAnswered(true);
    setRazonSel(i);
    const item = RAZON_ITEMS[razonIdx];
    const correct = i === razonMap[item.tipo];
    if (correct) setRazonScore((prev) => prev + 1);
  };
  const nextRazon = () => {
    if (razonIdx + 1 >= RAZON_ITEMS.length) {
      const earned = razonScore * 10;
      if (earned > 0) addXP(earned);
      setRazonDone(true);
    } else {
      setRazonIdx((prev) => prev + 1);
      setRazonAnswered(false);
      setRazonSel(null);
    }
  };

  // Acertijo (16)
  const isAcertijoOk = acertijoText.trim().length >= 30;
  const checkAcertijo = () => { if (isAcertijoOk && !acertijoDone) { addXP(15); setAcertijoDone(true); } };
  useEffect(() => { checkAcertijo(); }, [acertijoText]);

  // Quiz (17)
  const answerQuiz = (i: number) => {
    if (quizAnswered || quizDone) return;
    setQuizAnswered(true);
    setQuizSel(i);
    const item = QUIZ_COT[quizIdx];
    const correct = i === item.correct;
    if (correct) setQuizScore((prev) => prev + 1);
  };
  const nextQuiz = () => {
    if (quizIdx + 1 >= QUIZ_COT.length) {
      const earned = quizScore * 12;
      if (earned > 0) addXP(earned);
      setQuizDone(true);
    } else {
      setQuizIdx((prev) => prev + 1);
      setQuizAnswered(false);
      setQuizSel(null);
    }
  };

  // Reflexión (18)
  const checkReflect = () => { if (reflectText.trim().length >= 50) { if (!reflectDone) { addXP(15); setReflectDone(true); } return true; } return false; };

  // ============ RENDER ============
  const renderIntro = () => (
    <View>
      <View style={styles.iconCircle}><Text style={{ fontSize: 34 }}>🔗</Text></View>
      <Text style={styles.title}>Prompts en Cadena</Text>
      <Text style={styles.subtitle}>Un solo prompt resuelve el 60% de los problemas. Una cadena bien diseñada resuelve el 100%.</Text>
      <View style={styles.card}><Text style={styles.cardTitle}>🎯 Qué vas a aprender</Text><Text style={styles.cardText}>Chain-of-Thought · Dividir tareas complejas · Prompts con checkpoints · Árbol de decisiones · Detectar errores de razonamiento</Text></View>
    </View>
  );

  const renderTheory1 = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#eef2ff' }]}><Text style={[styles.tagText, { color: '#4338ca' }]}>Nivel 11 · 18 módulos</Text></View>
      <View style={[styles.tag, { backgroundColor: '#dcfce7' }]}><Text style={[styles.tagText, { color: '#166534' }]}>📐 Módulo 1 · Casos reales</Text></View>
      <Text style={styles.title}>La magia del "piénsalo paso a paso"</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
        <View style={{ flex: 1, backgroundColor: '#fff1f2', borderRadius: 10, padding: 10 }}>
          <Text style={{ fontWeight: 'bold', color: '#991b1b', marginBottom: 4 }}>Sin cadena</Text>
          <Text style={{ fontSize: 11 }}>"Juan tiene 36 y María 12." [No hay forma de saber si llegó correctamente]</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: '#f0fdf4', borderRadius: 10, padding: 10 }}>
          <Text style={{ fontWeight: 'bold', color: '#166534', marginBottom: 4 }}>Con "paso a paso"</Text>
          <Text style={{ fontSize: 11 }}>"Paso 1: Sea M = manzanas de María. Paso 2: Juan tiene 3M. Paso 3: M + 3M = 48..."</Text>
        </View>
      </View>
    </View>
  );

  const renderCompare = () => {
    const p = COMPARE_COT;
    return (
      <View>
        <View style={[styles.tag, { backgroundColor: '#fff1f2' }]}><Text style={[styles.tagText, { color: '#e11d48' }]}>🔗 Módulo 2 · Prompt-compare</Text></View>
        <Text style={styles.title}>Antes vs. después del Chain-of-Thought</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          <View style={{ flex: 1, backgroundColor: '#fff7ed', borderRadius: 10, padding: 10 }}>
            <Text style={{ fontWeight: 'bold', color: '#c2410c', marginBottom: 4 }}>Prompt directo</Text>
            <Text style={{ fontFamily: 'monospace', fontSize: 11 }}>{p.directo.prompt}</Text>
            <Text style={{ fontSize: 10, marginTop: 4 }}>{p.directo.resp}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: '#f0fdf4', borderRadius: 10, padding: 10 }}>
            <Text style={{ fontWeight: 'bold', color: '#065f46', marginBottom: 4 }}>Prompt CoT</Text>
            <Text style={{ fontFamily: 'monospace', fontSize: 11 }}>{p.cot.prompt}</Text>
            <Text style={{ fontSize: 10, marginTop: 4 }}>{p.cot.resp}</Text>
          </View>
        </View>
        <Text style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 8 }}>{p.q}</Text>
        {p.opts.map((opt, i) => (
          <TouchableOpacity key={i} style={[styles.optionBtn, compareSel === i && { borderColor: p.correct === i ? '#10b981' : '#ef4444' }]} onPress={() => answerCOT(i)} disabled={compareAnswered}>
            <Text style={{ fontSize: 12 }}>{opt}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderBuilder = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#eff6ff' }]}><Text style={[styles.tagText, { color: '#1e40af' }]}>🛠️ Módulo 3 · Builder</Text></View>
      <Text style={styles.title}>Construye un prompt de 3 pasos</Text>
      <TextInput style={styles.input} placeholder="Tu tema o situación a resolver" value={tema} onChangeText={setTema} />
      <TextInput style={styles.input} placeholder="Paso 1 — ¿Qué debe analizar primero?" value={p1} onChangeText={setP1} />
      <TextInput style={styles.input} placeholder="Paso 2 — ¿Cuántas opciones y qué criterios?" value={p2} onChangeText={setP2} />
      <TextInput style={styles.input} placeholder="Paso 3 — ¿Qué tipo de recomendación final?" value={p3} onChangeText={setP3} />
      {isChainOk && (
        <View style={[styles.card, { backgroundColor: '#f0fdf4', marginTop: 10 }]}>
          <Text style={{ fontSize: 12, color: '#065f46', lineHeight: 20 }}>
            Prompt 1: Analiza mi situación de {tema}. Factores: {p1}.{'\n\n'}
            Prompt 2: Basándote en ese análisis, dame {p2}.{'\n\n'}
            Prompt 3: Con todo lo anterior, recomiéndame {p3}.
          </Text>
        </View>
      )}
    </View>
  );

  const renderDivide = () => {
    const t = tareaCompleja;
    return (
      <View>
        <View style={[styles.tag, { backgroundColor: '#dcfce7' }]}><Text style={[styles.tagText, { color: '#166534' }]}>📦 Módulo 4 · Divide y vencerás</Text></View>
        <Text style={styles.title}>Divide y vencerás</Text>
        <View style={[styles.card, { backgroundColor: '#f8fafc' }]}>
          <Text style={{ fontWeight: 'bold', fontSize: 12 }}>🎯 Tarea compleja</Text>
          <Text style={{ fontStyle: 'italic', fontSize: 12 }}>{t.tarea}</Text>
        </View>
        <View style={[styles.card, { backgroundColor: '#fff1f2' }]}>
          <Text style={{ fontWeight: 'bold', color: '#991b1b', fontSize: 11 }}>❌ Error común: {t.errorComun}</Text>
        </View>
        {t.subtareas.map((s, i) => (
          <View key={i} style={[styles.card, { backgroundColor: '#eff6ff' }]}>
            <Text style={{ fontWeight: 'bold', color: '#1e40af' }}>{i + 1}.</Text>
            <Text style={{ fontSize: 12 }}>{s}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderFillCp = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fff1f2' }]}><Text style={[styles.tagText, { color: '#9f1239' }]}>📍 Módulo 5 · Fill-in-blank</Text></View>
      <Text style={styles.title}>Añade checkpoints al prompt</Text>
      <View style={[styles.card, { backgroundColor: '#f8fafc' }]}>
        <Text style={{ fontStyle: 'italic', fontSize: 12 }}>"{fillCotItem.base}"</Text>
      </View>
      {fillCotItem.campos.map((c, i) => (
        <View key={i}>
          <Text style={{ fontWeight: 'bold', fontSize: 11, marginBottom: 4 }}>{c}</Text>
          <TextInput style={styles.input} placeholder="Escribe la instrucción de checkpoint..." value={cpValues[i]} onChangeText={(v) => setCpValues((prev) => { const n = [...prev]; n[i] = v; return n; })} />
        </View>
      ))}
      {isCpOk && (
        <TouchableOpacity style={styles.nextButton} onPress={commitCp}>
          <Text style={styles.nextButtonText}>Ver prompt mejorado →</Text>
        </TouchableOpacity>
      )}
      {cpDone && (
        <View style={[styles.card, { backgroundColor: '#f0fdf4', marginTop: 10 }]}>
          <Text style={{ fontSize: 12, color: '#065f46', fontStyle: 'italic' }}>Modelo: {fillCotItem.correcto}</Text>
        </View>
      )}
    </View>
  );

  const renderVF = () => {
    if (vfDone) {
      return (
        <View>
          <Text style={styles.title}>✅ V/F completado</Text>
          <Text style={{ textAlign: 'center', fontSize: 16, marginVertical: 8 }}>{vfScore}/{vfItems.length} correctas</Text>
        </View>
      );
    }
    const item = vfItems[vfIdx];
    return (
      <View>
        <View style={[styles.tag, { backgroundColor: '#ecfdf5' }]}><Text style={[styles.tagText, { color: '#065f46' }]}>✔ V/F · {vfIdx + 1}/{vfItems.length}</Text></View>
        <View style={[styles.card, { backgroundColor: '#f8fafc' }]}>
          <Text style={{ fontSize: 13, fontWeight: '600', lineHeight: 20 }}>{item.stmt}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          <TouchableOpacity style={[styles.vfBtn, { borderColor: '#bbf7d0', backgroundColor: vfSel === true ? '#f0fdf4' : '#f8fafc' }]} onPress={() => answerVF(true)} disabled={vfAnswered}>
            <Text style={{ fontWeight: 'bold', color: '#065f46' }}>✅ Verdadero</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.vfBtn, { borderColor: '#fecdd3', backgroundColor: vfSel === false ? '#fff1f2' : '#f8fafc' }]} onPress={() => answerVF(false)} disabled={vfAnswered}>
            <Text style={{ fontWeight: 'bold', color: '#991b1b' }}>❌ Falso</Text>
          </TouchableOpacity>
        </View>
        {vfAnswered && (
          <View style={{ padding: 10, backgroundColor: vfSel === item.correct ? '#dcfce7' : '#fff1f2', borderRadius: 10 }}>
            <Text style={{ fontSize: 12, color: vfSel === item.correct ? '#166534' : '#991b1b' }}>{item.explain}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderTheory3 = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#dcfce7' }]}><Text style={[styles.tagText, { color: '#166534' }]}>🌍 Módulo 7 · Casos reales</Text></View>
      <Text style={styles.title}>Chain-of-Thought en acción</Text>
      {[
        { title: 'Análisis de texto literario', text: 'Sin CoT: "Analiza el simbolismo en El Principito."\nCon CoT: "Identifica 3 símbolos. Para cada uno: objeto, significado y cita del libro."' },
        { title: 'Tomar una decisión compleja', text: 'Sin CoT: "¿Debería estudiar ingeniería o diseño?"\nCon CoT: "Lista 5 características. Compara por salida laboral, habilidades y tiempo. Recomienda."' },
      ].map((c, i) => (
        <View key={i} style={[styles.card, { backgroundColor: '#eff6ff' }]}><Text style={styles.cardTitle}>{c.title}</Text><Text style={styles.cardText}>{c.text}</Text></View>
      ))}
    </View>
  );

  const renderArbol = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fef3c7' }]}><Text style={[styles.tagText, { color: '#92400e' }]}>🌳 Módulo 8 · Matching</Text></View>
      <Text style={styles.title}>Árbol de decisiones para tu IA</Text>
      {ARBOL_ITEMS.map((item, i) => (
        <View key={i} style={[styles.card, { backgroundColor: '#eff6ff' }]}>
          <Text style={{ fontWeight: 'bold', color: '#1e40af', marginBottom: 6 }}>Si: {item.condicion}</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity style={[styles.treeOpt, arbolAnswers[i] === 0 && { borderColor: '#3b82f6', backgroundColor: '#dbeafe' }]} onPress={() => selArbol(i, 0)} disabled={arbolChecked}>
              <Text style={{ fontSize: 11, fontWeight: '600' }}>{item.accion}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.treeOpt, arbolAnswers[i] === 1 && { borderColor: '#ef4444', backgroundColor: '#fff1f2' }]} onPress={() => selArbol(i, 1)} disabled={arbolChecked}>
              <Text style={{ fontSize: 11, fontWeight: '600' }}>{item.alternativa}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );

  const renderIter = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fff1f2' }]}><Text style={[styles.tagText, { color: '#9f1239' }]}>🔄 Módulo 9 · Builder iterativo · Ronda {iterRound}/3</Text></View>
      {iterDone ? (
        <View>
          <Text style={styles.title}>✅ Prompt iterativo completado</Text>
          <Text style={{ textAlign: 'center', fontWeight: 'bold' }}>3 rondas completadas · +36 XP</Text>
        </View>
      ) : (
        <View>
          <Text style={{ fontSize: 13, marginBottom: 8 }}>
            {iterRound === 1 ? 'Ronda 1: Escribe el prompt inicial para un asistente de estudio de historia.' :
             iterRound === 2 ? 'Ronda 2: Pide refinamiento específico sobre el prompt anterior.' :
             'Ronda 3: Instrucción de cierre y verificación.'}
          </Text>
          <TextInput style={styles.textArea} multiline placeholder="Escribe tu prompt..." value={iterText} onChangeText={setIterText} />
          <Text style={{ fontSize: 11, color: '#94a3b8', textAlign: 'right' }}>{iterText.length} / 20 mín.</Text>
        </View>
      )}
    </View>
  );

  const renderTheory4 = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#dcfce7' }]}><Text style={[styles.tagText, { color: '#166534' }]}>⚖️ Módulo 10 · Escenarios</Text></View>
      <Text style={styles.title}>Cuándo usar cadenas y cuándo no</Text>
      {['✅ Útil: tarea de múltiples fases', '✅ Necesario: razonamiento lógico complejo', '⚠️ Sobreingeniería: pregunta factual simple', '⚠️ Innecesario: tarea creativa libre'].map((t, i) => (
        <View key={i} style={styles.card}><Text style={styles.cardText}>{t}</Text></View>
      ))}
    </View>
  );

  const renderSprint = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fef3c7' }]}><Text style={[styles.tagText, { color: '#92400e' }]}>⚡ Módulo 11 · Sprint</Text></View>
      <Text style={styles.title}>Sprint: diseña la cadena</Text>
      <Text style={{ fontSize: 26, fontWeight: 'bold', textAlign: 'center', color: '#1e40af' }}>
        {Math.floor(sprintSec / 60)}:{String(sprintSec % 60).padStart(2, '0')}
      </Text>
      <View style={{ height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden', marginBottom: 10 }}>
        <View style={{ height: '100%', width: `${(sprintSec / 90) * 100}%`, backgroundColor: '#3b82f6', borderRadius: 3 }} />
      </View>
      {sprintDone ? (
        <View style={{ padding: 14, backgroundColor: '#dcfce7', borderRadius: 10 }}>
          <Text style={{ fontWeight: 'bold', color: '#166534', textAlign: 'center' }}>🏁 3 cadenas diseñadas. +30 XP</Text>
        </View>
      ) : (
        <View>
          <View style={[styles.card, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
            <Text style={{ fontSize: 13, fontWeight: 'bold', textAlign: 'center' }}>{SPRINT_CADENAS[sprintIdx]}</Text>
          </View>
          {sprintModelo ? (
            <View style={[styles.card, { backgroundColor: '#f0fdf4', marginTop: 8 }]}>
              <Text style={{ fontSize: 12, color: '#065f46' }}>{SP_MODELOS[sprintIdx]}</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#1e40af' }]} onPress={startSprint}><Text style={{ color: '#fff', fontWeight: 'bold' }}>▶ Iniciar</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#eff6ff', borderWidth: 1.5, borderColor: '#bfdbfe' }]} onPress={verModelo}><Text style={{ color: '#1e40af', fontWeight: 'bold' }}>→ Ver modelo</Text></TouchableOpacity>
            </View>
          )}
          {sprintModelo && (
            <TouchableOpacity style={[styles.nextButton, { marginTop: 8 }]} onPress={nextSprint}><Text style={styles.nextButtonText}>Siguiente →</Text></TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );

  const renderVpBuilder = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#eff6ff' }]}><Text style={[styles.tagText, { color: '#1e40af' }]}>🔍 Módulo 12 · Builder</Text></View>
      <Text style={styles.title}>El prompt que se verifica a sí mismo</Text>
      <TextInput style={styles.textArea} multiline placeholder="Escribe tu instrucción principal..." value={vpBase} onChangeText={setVpBase} />
      {isVpOk && (
        <View style={[styles.card, { backgroundColor: '#f0fdf4', marginTop: 10 }]}>
          <Text style={{ fontSize: 12, color: '#065f46' }}>
            {vpBase.trim()}. Al terminar, revisa: 1) ¿respondiste exactamente lo que se pidió? 2) ¿hay contradicciones? 3) ¿los datos son precisos? Corrige cualquier error antes de terminar.
          </Text>
        </View>
      )}
    </View>
  );

  const renderTutor = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#dcfce7' }]}><Text style={[styles.tagText, { color: '#166534' }]}>🎓 Módulo 13 · Casos reales</Text></View>
      <Text style={styles.title}>La IA como tutor paso a paso</Text>
      {['🧪 Ciencias: Entender un concepto difícil', '📜 Historia: Análisis de evento', '🔢 Matemáticas: Resolver paso a paso'].map((t, i) => (
        <View key={i} style={styles.card}><Text style={styles.cardText}>{t}</Text></View>
      ))}
    </View>
  );

  const renderRazon = () => {
    if (razonDone) {
      return (
        <View>
          <Text style={styles.title}>✅ Clasificador completado</Text>
          <Text style={{ textAlign: 'center', fontSize: 16 }}>{razonScore}/{RAZON_ITEMS.length} correctas</Text>
        </View>
      );
    }
    const item = RAZON_ITEMS[razonIdx];
    return (
      <View>
        <View style={[styles.tag, { backgroundColor: '#fef3c7' }]}><Text style={[styles.tagText, { color: '#92400e' }]}>🔎 Módulo 14 · Clasificador · {razonIdx + 1}/{RAZON_ITEMS.length}</Text></View>
        <View style={[styles.card, { backgroundColor: '#f8fafc' }]}>
          <Text style={{ fontStyle: 'italic', fontSize: 13 }}>"{item.texto}"</Text>
        </View>
        <TouchableOpacity style={[styles.optionBtn, { borderColor: '#fde68a' }]} onPress={() => answerRazon(0)} disabled={razonAnswered}>
          <Text style={{ fontWeight: 'bold', color: '#92400e' }}>⚠️ Falacia lógica</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.optionBtn, { borderColor: '#bfdbfe' }]} onPress={() => answerRazon(1)} disabled={razonAnswered}>
          <Text style={{ fontWeight: 'bold', color: '#1e40af' }}>🦘 Salto de conclusión</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.optionBtn, { borderColor: '#fecdd3' }]} onPress={() => answerRazon(2)} disabled={razonAnswered}>
          <Text style={{ fontWeight: 'bold', color: '#991b1b' }}>❌ Dato falso</Text>
        </TouchableOpacity>
        {razonAnswered && (
          <View style={{ padding: 10, backgroundColor: razonSel === razonMap[item.tipo] ? '#dcfce7' : '#fff1f2', borderRadius: 10, marginTop: 6 }}>
            <Text style={{ fontSize: 12 }}>{item.label}: {item.explain}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderTheory5 = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#dcfce7' }]}><Text style={[styles.tagText, { color: '#166534' }]}>🧠 Módulo 15 · Reflexión conceptual</Text></View>
      <Text style={styles.title}>¿Qué tan profundo puede pensar un LLM?</Text>
      {['⚠️ Lo que el CoT NO resuelve: información fuera del entrenamiento.', '🔬 Lo que la ciencia dice: fallan en razonamiento espacial complejo.', '✅ La regla práctica: si requiere sentido común, el humano sigue siendo necesario.'].map((t, i) => (
        <View key={i} style={styles.card}><Text style={styles.cardText}>{t}</Text></View>
      ))}
    </View>
  );

  const renderAcertijo = () => {
    const ac = ACERTIJOS[0];
    return (
      <View>
        <View style={[styles.tag, { backgroundColor: '#eff6ff' }]}><Text style={[styles.tagText, { color: '#1e40af' }]}>🧩 Módulo 16 · Reto</Text></View>
        <Text style={styles.title}>Resuelve el acertijo con CoT</Text>
        <View style={[styles.card, { backgroundColor: '#f8fafc' }]}>
          <Text style={{ fontSize: 13, lineHeight: 20 }}>{ac.problema}</Text>
        </View>
        <View style={[styles.card, { backgroundColor: '#eff6ff' }]}>
          <Text style={{ fontWeight: 'bold', color: '#1e40af' }}>Pista: {ac.hint}</Text>
        </View>
        <TextInput style={styles.textArea} multiline placeholder="Tu razonamiento paso a paso..." value={acertijoText} onChangeText={setAcertijoText} />
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#eff6ff', borderWidth: 1.5, borderColor: '#bfdbfe', marginTop: 8 }]} onPress={() => Alert.alert('Solución', ac.solucion)}>
          <Text style={{ color: '#1e40af', fontWeight: 'bold' }}>Ver solución modelo</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderQuiz = () => {
    if (quizDone) {
      return (
        <View>
          <Text style={styles.title}>✅ Quiz completado</Text>
          <Text style={{ textAlign: 'center', fontSize: 16 }}>{quizScore}/{QUIZ_COT.length} correctas</Text>
        </View>
      );
    }
    const item = QUIZ_COT[quizIdx];
    return (
      <View>
        <View style={[styles.tag, { backgroundColor: '#fef3c7' }]}><Text style={[styles.tagText, { color: '#92400e' }]}>🧠 Módulo 17 · Quiz · {quizIdx + 1}/{QUIZ_COT.length}</Text></View>
        <View style={[styles.card, { backgroundColor: '#f8fafc' }]}>
          <Text style={{ fontSize: 13, fontWeight: '600' }}>{item.q}</Text>
        </View>
        {item.opts.map((opt, i) => (
          <TouchableOpacity key={i} style={[styles.optionBtn, quizSel === i && { borderColor: item.correct === i ? '#10b981' : '#ef4444' }]} onPress={() => answerQuiz(i)} disabled={quizAnswered}>
            <Text style={{ fontSize: 12 }}>{opt}</Text>
          </TouchableOpacity>
        ))}
        {quizAnswered && (
          <View style={{ padding: 10, backgroundColor: quizSel === item.correct ? '#dcfce7' : '#fff1f2', borderRadius: 10, marginTop: 6 }}>
            <Text style={{ fontSize: 12 }}>{item.explain}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderReflect = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#f1f5f9' }]}><Text style={[styles.tagText, { color: '#475569' }]}>💬 Módulo 18 · Reflexión</Text></View>
      <Text style={styles.title}>¿La diferencia importa?</Text>
      <TextInput style={styles.textArea} multiline placeholder="Escribe tu reflexión (mín. 50 caracteres)..." value={reflectText} onChangeText={setReflectText} />
      <Text style={{ fontSize: 11, color: '#94a3b8', textAlign: 'right' }}>{reflectText.length} / 50 mín.</Text>
    </View>
  );

  const renderCompletion = () => (
    <View style={{ alignItems: 'center', padding: 20 }}>
      <Text style={{ fontSize: 44, marginBottom: 14 }}>🏅</Text>
      <Text style={[styles.title, { textAlign: 'center' }]}>¡Nivel 11 completado!</Text>
      <Text style={[styles.subtitle, { textAlign: 'center' }]}>Badge: 🔗 Chain Master desbloqueado.</Text>
      <Text style={{ fontWeight: 'bold', fontSize: 15, color: '#92400e', marginBottom: 14 }}>⭐ {xp} XP ganados</Text>
      <TouchableOpacity style={styles.finishButton} onPress={handleFinish}><Text style={{ fontWeight: 'bold', color: '#fff' }}>Volver al mapa</Text></TouchableOpacity>
    </View>
  );

  // ============ RENDER PRINCIPAL ============
  const renderStepContent = () => {
    switch (step) {
      case 0: return renderIntro();
      case 1: return renderTheory1();
      case 2: return renderCompare();
      case 3: return renderBuilder();
      case 4: return renderDivide();
      case 5: return renderFillCp();
      case 6: return renderVF();
      case 7: return renderTheory3();
      case 8: return renderArbol();
      case 9: return renderIter();
      case 10: return renderTheory4();
      case 11: return renderSprint();
      case 12: return renderVpBuilder();
      case 13: return renderTutor();
      case 14: return renderRazon();
      case 15: return renderTheory5();
      case 16: return renderAcertijo();
      case 17: return renderQuiz();
      case 18: return renderReflect();
      case 19: return renderCompletion();
      default: return null;
    }
  };

  const progressPercent = (step / (TOTAL_STEPS - 1)) * 100;

  const handleMainBtn = () => {
    const handlers: Record<number, (() => boolean) | undefined> = {
      2: () => compareAnswered,
      3: () => isChainOk,
      5: () => { commitCp(); return cpDone; },
      6: () => { if (vfDone) return true; if (vfAnswered) { nextVf(); return false; } Alert.alert('Responde', 'Selecciona Verdadero o Falso.'); return false; },
      8: checkArbol,
      9: () => { advanceIter(); return iterDone; },
      11: () => sprintDone,
      12: () => isVpOk,
      14: () => { if (razonDone) return true; if (razonAnswered) { nextRazon(); return false; } Alert.alert('Elige', 'Clasifica el error.'); return false; },
      16: () => isAcertijoOk,
      17: () => { if (quizDone) return true; if (quizAnswered) { nextQuiz(); return false; } Alert.alert('Elige', 'Selecciona una respuesta.'); return false; },
      18: checkReflect,
    };
    const handler = handlers[step];
    if (handler) { if (!handler()) return; }
    goToNextStep();
  };

  const showNextBtn = step < TOTAL_STEPS - 1 && ![2, 3, 5, 6, 8, 9, 11, 12, 14, 16, 17, 18].includes(step);
  const showCheckBtn = [2, 3, 5, 6, 8, 9, 11, 12, 14, 16, 17, 18].includes(step) && step < TOTAL_STEPS - 1;

  const getBtnLabel = () => {
    switch (step) {
      case 2: return compareAnswered ? 'Continuar →' : 'Continuar →';
      case 3: return 'Continuar →';
      case 5: return cpDone ? 'Continuar →' : 'Ver prompt mejorado →';
      case 6: return vfDone ? 'Continuar →' : 'Siguiente →';
      case 8: return 'Verificar árbol →';
      case 9: return iterDone ? 'Continuar →' : (iterRound < 3 ? 'Siguiente ronda →' : 'Completar →');
      case 11: return sprintDone ? 'Continuar →' : 'Siguiente →';
      case 12: return isVpOk ? 'Continuar →' : 'Continuar →';
      case 14: return razonDone ? 'Continuar →' : 'Siguiente →';
      case 16: return isAcertijoOk ? 'Continuar →' : 'Continuar →';
      case 17: return quizDone ? 'Continuar →' : 'Siguiente →';
      case 18: return 'Completar nivel →';
      default: return 'Continuar →';
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.progressBar}>
        <TouchableOpacity onPress={handleClose} style={styles.closeBtn}><MaterialIcons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progressPercent}%` }]} /></View>
        <Text style={styles.xpText}>{xp} XP</Text>
      </View>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {renderStepContent()}
        {stepResult && (
          <View style={[styles.resultBanner, stepResult.ok ? styles.resultBannerOk : styles.resultBannerErr]}>
            <Text style={styles.resultBannerText}>{stepResult.ok ? '\u2705 ' : '\u274c '}{stepResult.msg}</Text>
          </View>
        )}
      </ScrollView>
      {showNextBtn && <TouchableOpacity style={styles.nextButton} onPress={goToNextStep}><Text style={styles.nextButtonText}>Continuar →</Text></TouchableOpacity>}
      {showCheckBtn && <TouchableOpacity style={styles.nextButton} onPress={handleMainBtn}><Text style={styles.nextButtonText}>{getBtnLabel()}</Text></TouchableOpacity>}
    </View>
  );
}

// ===================== ESTILOS =====================
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  progressBar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  closeBtn: { padding: 4 },
  progressTrack: { flex: 1, height: 6, backgroundColor: colors.borderLight, borderRadius: 3, marginHorizontal: 12 },
  progressFill: { height: '100%', backgroundColor: '#10b981', borderRadius: 3 },
  xpText: { ...typography.bold, fontSize: 14, color: '#92400e' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  tag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 12 },
  tagText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  iconCircle: { width: 60, height: 60, borderRadius: 18, backgroundColor: '#d1fae5', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  title: { ...typography.extraBold, fontSize: 19, color: colors.textPrimary, marginBottom: 6 },
  subtitle: { ...typography.regular, fontSize: 13, color: colors.textSecondary, marginBottom: 14, lineHeight: 18 },
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  cardTitle: { ...typography.bold, fontSize: 13, color: colors.textPrimary, marginBottom: 6 },
  cardText: { ...typography.regular, fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
  input: { borderWidth: 1.5, borderColor: '#a7f3d0', borderRadius: 10, padding: 10, fontSize: 13, backgroundColor: '#f0fdf4', color: '#334155', marginBottom: 8 },
  textArea: { borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 13, color: '#334155', textAlignVertical: 'top', minHeight: 80, backgroundColor: '#fafafa', marginBottom: 8 },
  optionBtn: { width: '100%', padding: 11, borderRadius: 11, borderWidth: 2, borderColor: '#e2e8f0', backgroundColor: '#f8fafc', marginBottom: 7 },
  vfBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 2, alignItems: 'center' },
  treeOpt: { flex: 1, padding: 8, borderRadius: 9, borderWidth: 2, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  actionBtn: { flex: 1, padding: 11, borderRadius: 11, alignItems: 'center' },
  nextButton: { backgroundColor: '#10b981', padding: 14, margin: 16, borderRadius: 11, alignItems: 'center' },
  nextButtonText: { ...typography.bold, color: '#fff', fontSize: 15 },
  finishButton: { backgroundColor: '#10b981', padding: 14, borderRadius: 11, width: '100%', alignItems: 'center', marginTop: 14 },
  resultBanner: { margin: 16, padding: 14, borderRadius: 14, borderWidth: 1 },
  resultBannerOk: { backgroundColor: '#dcfce7', borderColor: colors.success },
  resultBannerErr: { backgroundColor: '#fee2e2', borderColor: colors.error },
  resultBannerText: { ...typography.bold, fontSize: 13, color: colors.textPrimary, lineHeight: 20 },
});