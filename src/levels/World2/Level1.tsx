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
import { useGameStore } from '../../store/gameStore';
import { colors, typography } from '../../theme';

// ---------- Tipos ----------
type CompareItem = { task: string; bad: string; good: string; badWhy: string; goodWhy: string };
type MatchPair = { left: string; right: string };
type TFItem = { stmt: string; correct: boolean; explain: string };
type QuizItem = { q: string; opts: string[]; correct: number; explain: string };
type FillItem = { sentence: string; allOpts: string[]; correct: number; explain: string };
type SprintItem = { stmt: string; correct: boolean };
type TecnicaItem = { scenario: string; opciones: string[]; correct: number; promptHint: string; explain: string };
type RankerPrompt = { id: string; text: string; level: number; label: string };
type RankerSet = { task: string; prompts: RankerPrompt[]; explain: string };

const TOTAL_STEPS = 22;
const CONTENT_STEPS = 20;

const pickN = <T,>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};

// ===================== POOLS =====================

const COMPARE_POOL: CompareItem[] = [
  { task: 'Pedir ayuda con matemáticas', bad: 'Ayúdame con matemáticas', good: 'Eres un tutor paciente de matemáticas para estudiantes de 10° grado. Tengo dificultades con ecuaciones cuadráticas. Explícame la fórmula cuadrática paso a paso y luego dame 2 ejercicios de práctica similares a: 2x²+5x-3=0. Formato: explicación + ejercicios numerados.', badWhy: 'Vago — no dice qué tipo de ayuda, qué nivel, qué tema exacto ni qué formato quiere.', goodWhy: 'Rol + contexto + tarea específica + ejemplo concreto + formato deseado.' },
  { task: 'Pedir una historia creativa', bad: 'Escríbeme una historia', good: 'Escribe una historia corta de ciencia ficción (máximo 300 palabras) sobre un adolescente colombiano de 15 años que descubre que su ciudad tiene una IA que controla el tráfico pero que ha desarrollado emociones. Tono: misterioso pero esperanzador. Termina en un punto de giro.', badWhy: 'Sin género, sin longitud, sin personajes, sin tono. El resultado será genérico y aburrido.', goodWhy: 'Género + longitud + personaje específico + contexto cultural + tono + instrucción de final.' },
  { task: 'Pedir revisión de texto', bad: 'Revisa este texto', good: 'Revisa este párrafo ÚNICAMENTE para: 1) errores de ortografía y tildes, 2) coherencia entre oraciones. NO cambies el vocabulario ni la estructura. NO reescribas frases completas. Devuelve el texto corregido y una lista de los cambios que hiciste con explicación breve de cada uno.', badWhy: 'No dice qué revisar, qué no cambiar, ni en qué formato quiere la respuesta.', goodWhy: 'Lista exacta de qué hacer, restricciones explícitas de qué NO hacer, formato de entrega especificado.' },
  { task: 'Pedir análisis de un problema', bad: 'Analiza este problema', good: 'Analiza este problema de diseño de producto desde 3 perspectivas distintas: 1) el usuario final, 2) el equipo de desarrollo, 3) el negocio. Para cada perspectiva: identifica el problema central, da 2 posibles soluciones y evalúa pros y contras. Máximo 150 palabras por perspectiva.', badWhy: '¿Qué tipo de análisis? ¿Desde qué perspectiva? ¿En qué formato? Completamente abierto.', goodWhy: 'Número de perspectivas + cuáles son + estructura interna de cada una + límite de palabras.' },
  { task: 'Pedir un plan de estudios', bad: 'Dame un plan de estudio', good: 'Crea un plan de estudio de 2 semanas para el examen de química de grado 11 (Colombia). Temas: estequiometría, equilibrio químico y termoquímica. Disponibilidad: 1 hora diaria de lunes a viernes. Incluye: qué estudiar cada día, recursos sugeridos (tipo de material, no links) y un mini-quiz de 3 preguntas para verificar comprensión al final de cada semana.', badWhy: 'Sin materia, sin nivel, sin tiempo disponible, sin temas, sin formato.', goodWhy: 'Materia + nivel + duración + temas exactos + tiempo disponible + estructura del entregable.' },
];

const MATCH_POOL: MatchPair[] = [
  { left: 'Chain of Thought', right: 'Problema de lógica complejo que requiere razonamiento paso a paso' },
  { left: 'Few-shot (ejemplos)', right: 'Quieres que el modelo replique exactamente un formato o estilo' },
  { left: 'Negative Prompting', right: 'El modelo sigue incluyendo algo que no quieres aunque lo pides' },
  { left: 'Role System', right: 'Necesitas que el modelo mantenga una personalidad o expertise específica' },
  { left: 'Multi-step', right: 'La tarea es demasiado compleja para un solo prompt' },
  { left: 'Zero-shot directo', right: 'La tarea es simple y clara sin necesidad de guía adicional' },
];

const SORT_COT = [
  'Enuncia el problema completo: Escribe la pregunta o tarea con todos sus detalles',
  'Pide razonamiento explícito: Agrega "Piensa paso a paso antes de responder"',
  'El modelo expone su proceso: El LLM muestra cada paso de su razonamiento',
  'Llega a una conclusión: El modelo da la respuesta final basada en el razonamiento',
  'Evalúas la lógica: Puedes identificar exactamente en qué paso se equivocó, si lo hizo',
];

const TF_POOL: TFItem[] = [
  { stmt: 'Un prompt más largo siempre produce mejores resultados que uno corto.', correct: false, explain: 'Falso. La longitud no determina la calidad — la precisión sí. Un prompt corto y preciso supera a uno largo y vago.' },
  { stmt: 'El "Chain of Thought" es útil especialmente para problemas matemáticos y de lógica.', correct: true, explain: 'Correcto. Pedir que razone paso a paso reduce errores en problemas que requieren múltiples pasos de inferencia.' },
  { stmt: 'Dar ejemplos de lo que NO quieres (negative prompting) puede ser tan útil como dar ejemplos de lo que sí quieres.', correct: true, explain: 'Sí. Los ejemplos negativos son muy efectivos para acotar el espacio de respuestas.' },
  { stmt: 'Si el modelo no da la respuesta correcta, siempre es culpa del modelo y no del prompt.', correct: false, explain: 'Falso. La mayoría de respuestas pobres son producto de prompts vagos o incompletos.' },
  { stmt: 'El Few-shot prompting consiste en darle al modelo ejemplos del tipo de respuesta que esperas.', correct: true, explain: 'Exacto. Le muestras ejemplos del formato que necesitas antes de pedir tu tarea.' },
  { stmt: 'El role prompting solo funciona con roles de profesiones reales como médico o abogado.', correct: false, explain: 'Falso. Puedes asignar cualquier rol creativo y cambia el comportamiento del modelo.' },
  { stmt: 'Un prompt con instrucciones contradictorias generalmente produce respuestas impredecibles.', correct: true, explain: 'Correcto. Si das instrucciones que se contradicen, el modelo no sabe qué priorizar.' },
  { stmt: 'Pedir al modelo que "tome un respiro" o "piense cuidadosamente" antes de responder mejora la calidad.', correct: true, explain: 'Sí, documentado experimentalmente. Frases así mejoran el rendimiento en tareas complejas.' },
  { stmt: 'El multi-step prompting significa simplemente dividir tu pregunta en varias líneas.', correct: false, explain: 'Falso. Es usar el output de un prompt como input del siguiente — conversaciones encadenadas.' },
  { stmt: 'Un prompt con el contexto del usuario (edad, nivel, objetivo) siempre produce mejores respuestas.', correct: true, explain: 'Generalmente sí. El contexto permite al modelo calibrar vocabulario, profundidad y ejemplos.' },
];

const RANKER_SETS: RankerSet[] = [
  { task: 'Pedir un resumen de un artículo', prompts: [
    { id: 'A', text: 'Resume esto.', level: 0, label: 'Malo' },
    { id: 'B', text: 'Resume este artículo en 5 puntos clave. Usa lenguaje simple, sin jerga técnica. Cada punto en máximo una oración.', level: 2, label: 'Excelente' },
    { id: 'C', text: 'Haz un resumen del artículo de arriba con los puntos más importantes.', level: 1, label: 'Regular' },
  ], explain: 'Malo: sin formato ni restricciones. Regular: pide puntos pero sin longitud ni nivel. Excelente: puntos + límite + lenguaje especificado.' },
  { task: 'Pedir feedback sobre un ensayo', prompts: [
    { id: 'A', text: 'Dame feedback de este ensayo sobre el argumento principal, la evidencia que lo soporta y la claridad de la conclusión. Para cada uno: señala lo que funciona bien y una sugerencia concreta de mejora. No corrijas gramática.', level: 2, label: 'Excelente' },
    { id: 'B', text: '¿Qué piensas de mi ensayo?', level: 0, label: 'Malo' },
    { id: 'C', text: 'Dame feedback del ensayo. Dime qué está bien y qué puede mejorar.', level: 1, label: 'Regular' },
  ], explain: 'Malo: vaga, subjetiva. Regular: mejor estructura pero sin dimensiones específicas. Excelente: 3 dimensiones + estructura + restricción.' },
];

const TECNICA_POOL: TecnicaItem[] = [
  { scenario: 'Necesitas que el LLM te explique un concepto difícil de filosofía pero cada vez te da una respuesta con palabras muy técnicas y difíciles.', opciones: ['Zero-shot directo', 'Role System', 'Few-shot con ejemplos', 'Chain of Thought'], correct: 2, promptHint: 'Muestra 2 ejemplos del estilo simple que quieres antes de pedir la explicación.', explain: 'Few-shot: mostrar ejemplos del estilo que quieres es más efectivo que describirlo.' },
  { scenario: 'Quieres que el LLM resuelva un problema de lógica complejo: hay 5 personas con diferentes trabajos, casas de colores y mascotas.', opciones: ['Zero-shot directo', 'Chain of Thought', 'Negative Prompting', 'Role System'], correct: 1, promptHint: 'Pídele que piense paso a paso, liste las pistas e infiera lógicamente.', explain: 'Chain of Thought: forzar el razonamiento explícito reduce errores en problemas de lógica.' },
  { scenario: 'Tu asistente de estudio sigue respondiendo en un tono muy formal y aburrido aunque ya le pediste que sea más amigable.', opciones: ['Negative Prompting', 'Chain of Thought', 'Multi-step', 'Zero-shot directo'], correct: 0, promptHint: 'Lista palabras que NO debe usar y describe el tono que SÍ quieres.', explain: 'Negative Prompting: decir explícitamente qué evitar es más efectivo que solo pedir "sé más amigable".' },
  { scenario: 'Quieres escribir un artículo completo de 1500 palabras. En un solo prompt sale superficial y desorganizado.', opciones: ['Zero-shot directo', 'Few-shot', 'Multi-step', 'Role System'], correct: 2, promptHint: 'Primero pide el esquema, luego escribe cada sección por separado.', explain: 'Multi-step: divide la tarea en fases donde el output de cada prompt alimenta el siguiente.' },
  { scenario: 'Necesitas que el LLM actúe como un evaluador crítico de startups con el rigor de un inversionista de Silicon Valley.', opciones: ['Zero-shot directo', 'Chain of Thought', 'Few-shot', 'Role System'], correct: 3, promptHint: 'Describe al personaje con detalle: experiencia, personalidad, estilo.', explain: 'Role System: un rol bien descrito cambia completamente el carácter de la respuesta.' },
];

const QUIZ_POOL: QuizItem[] = [
  { q: '¿Cuál es la diferencia principal entre Zero-shot y Few-shot prompting?', opts: ['Zero-shot usa ejemplos; Few-shot no', 'Few-shot da ejemplos al modelo; Zero-shot pide la tarea directamente sin ejemplos', 'Zero-shot es más lento; Few-shot es más rápido', 'Few-shot solo funciona con imágenes'], correct: 1, explain: 'Zero-shot: tarea directa. Few-shot: das 1-3 ejemplos del resultado que quieres antes de pedir la tarea.' },
  { q: 'Quieres que el LLM resuelva: "Si A implica B, y B implica C, ¿A implica C? Explica tu razonamiento." ¿Qué técnica usarías?', opts: ['Negative Prompting', 'Role System', 'Chain of Thought', 'Few-shot'], correct: 2, explain: 'Chain of Thought es ideal para problemas de lógica y deducción.' },
  { q: '¿En qué consiste el "negative prompting" aplicado a texto?', opts: ['Escribir el prompt en formato negativo gramatical', 'Decirle al modelo explícitamente qué NO debe hacer, incluir o usar', 'Pedirle al modelo que critique su propia respuesta', 'Usar prompts más cortos'], correct: 1, explain: 'Negative prompting = restricciones explícitas de lo que NO quieres. Muy efectivo cuando el modelo ignora instrucciones positivas.' },
  { q: 'Estás construyendo un asistente para tu abuela de 75 años. ¿Qué combinación tiene más sentido?', opts: ['Chain of Thought + Multi-step', 'Role System + Few-shot para definir tono simple y ejemplificar respuestas cortas', 'Negative Prompting solo', 'Zero-shot directo siempre'], correct: 1, explain: 'Role System + Few-shot define tanto la personalidad como el estilo concreto que necesitas.' },
  { q: '¿Cuándo es más útil el Multi-step prompting?', opts: ['Cuando tienes prisa', 'Cuando la tarea es tan compleja que un solo prompt produce resultados superficiales', 'Cuando el modelo es muy lento', 'Cuando usas el plan gratuito'], correct: 1, explain: 'Multi-step divide tareas complejas en fases donde cada output alimenta el siguiente prompt.' },
  { q: 'Un estudiante dice: "Le puse todo el contexto al prompt y sigue dando malas respuestas." ¿Qué le recomendarías?', opts: ['Cambiar de LLM inmediatamente', 'Revisar si hay instrucciones contradictorias o poco claras en el prompt', 'Pagar el plan premium', 'Repetir el mismo prompt varias veces'], correct: 1, explain: 'Más contexto no siempre es mejor. Revisar si las instrucciones son contradictorias o si el formato está especificado.' },
  { q: '¿Qué hace el Role System a nivel técnico en un LLM?', opts: ['Cambia el modelo de IA que se usa', 'Ajusta los parámetros estadísticos del modelo hacia respuestas coherentes con ese rol', 'Bloquea ciertos tipos de respuestas', 'Acelera el tiempo de respuesta'], correct: 1, explain: 'El rol calibra la distribución de probabilidades del modelo hacia tokens más consistentes con ese perfil.' },
  { q: '¿Cuál es la principal ventaja de los ejemplos Few-shot sobre las instrucciones descriptivas?', opts: ['Son más cortos de escribir', 'Mostrar es más preciso que describir: el modelo replica el patrón exacto del ejemplo', 'Son más baratos en tokens', 'Solo funcionan con ChatGPT'], correct: 1, explain: 'Las instrucciones describen; los ejemplos demuestran. Mostrar 2 ejemplos es concreto e inequívoco.' },
];

const FILL_POOL: FillItem[] = [
  { sentence: 'La técnica de darle 2 o 3 ejemplos al modelo antes de pedir la tarea se llama prompting de _____ ejemplos.', allOpts: ['pocos (few-shot)', 'muchos', 'cero', 'varios'], correct: 0, explain: '"Few-shot": mostrar 2-3 ejemplos para que el modelo replique el patrón.' },
  { sentence: 'Pedir al modelo que razone _____ antes de dar la respuesta final se llama cadena de pensamiento.', allOpts: ['paso a paso', 'rápido', 'en silencio', 'al revés'], correct: 0, explain: '"Chain of Thought": pedir que razone paso a paso mejora la calidad en tareas de lógica.' },
  { sentence: 'Cuando le dices al modelo lo que NO debe hacer, estás usando _____ negativo.', allOpts: ['prompting', 'código', 'feedback', 'sorting'], correct: 0, explain: '"Negative prompting" = restricciones explícitas de qué evitar.' },
  { sentence: 'Asignarle al modelo una identidad como "eres un experto en nutrición" se llama prompting de _____.', allOpts: ['rol', 'texto', 'imagen', 'código'], correct: 0, explain: '"Role prompting" calibra tono, vocabulario y enfoque hacia ese perfil.' },
  { sentence: 'Usar la respuesta de un prompt como entrada del siguiente se llama prompting de _____ pasos.', allOpts: ['múltiples', 'cero', 'pocos', 'solos'], correct: 0, explain: '"Multi-step prompting": divide tareas complejas en etapas secuenciales.' },
  { sentence: 'Un prompt sin ejemplos que hace la tarea directamente se llama prompting de _____ ejemplos.', allOpts: ['cero (zero-shot)', 'pocos', 'muchos', 'todos los'], correct: 0, explain: '"Zero-shot": ningún ejemplo previo — la tarea directa.' },
];

const SPRINT_POOL: SprintItem[] = [
  { stmt: 'El Chain of Thought es útil para problemas de lógica y matemáticas', correct: true },
  { stmt: 'Un prompt más largo siempre produce mejores respuestas', correct: false },
  { stmt: 'Few-shot prompting consiste en dar ejemplos antes de pedir la tarea', correct: true },
  { stmt: 'El negative prompting solo funciona con imágenes, no con texto', correct: false },
  { stmt: 'El Role System calibra el tono y el nivel de expertise del modelo', correct: true },
  { stmt: 'Si el modelo falla, casi siempre es culpa del modelo y no del prompt', correct: false },
  { stmt: 'El multi-step prompting divide tareas complejas en varios prompts encadenados', correct: true },
  { stmt: 'Dar ejemplos de lo que NO quieres puede ser tan útil como dar ejemplos de lo que sí quieres', correct: true },
  { stmt: 'Zero-shot significa darle cero instrucciones al modelo', correct: false },
  { stmt: 'Agregar contexto del usuario generalmente mejora la respuesta', correct: true },
  { stmt: 'Instrucciones contradictorias en un prompt producen resultados predecibles', correct: false },
  { stmt: 'El few-shot: mostrar es más preciso que describir', correct: true },
];

// ===================== COMPONENTE =====================
interface LevelProps {
  navigation?: any;
  setAllowBack?: (allow: boolean) => void;
}

export default function World2Level1({ navigation: propsNavigation, setAllowBack }: LevelProps) {
  const navigationFromHook = useNavigation();
  const navigation = propsNavigation || navigationFromHook;
  const completeLevel = useGameStore((state) => state.completeLevel);

  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);
  const [stepResult, setStepResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const [compareItems] = useState(() => pickN(COMPARE_POOL, 3));
  const [matchPairs] = useState(() => pickN(MATCH_POOL, 4));
  const [tfItems] = useState(() => pickN(TF_POOL, 5));
  const [quizItems] = useState(() => pickN(QUIZ_POOL, 5));
  const [fillItems] = useState(() => pickN(FILL_POOL, 3));
  const [sprintItems] = useState(() => pickN(SPRINT_POOL, SPRINT_POOL.length));
  const [rankerSet] = useState(() => pickN(RANKER_SETS, 1)[0]);
  const [tecnicaItems] = useState(() => pickN(TECNICA_POOL, 4));

  // Estados de módulos
  const [compareIdx, setCompareIdx] = useState(0);
  const [matchLeft, setMatchLeft] = useState<number | null>(null);
  const [matchDone, setMatchDone] = useState(0);
  const [rightOrder, setRightOrder] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState<number[]>([]);
  const [sortOk, setSortOk] = useState(false);
  const [tfAnswers, setTfAnswers] = useState<Record<number, boolean>>({});
  const [tfChecked, setTfChecked] = useState(false);
  const [rankerOrder, setRankerOrder] = useState<number[]>([0, 1, 2].sort(() => Math.random() - 0.5));
  const [rankerChecked, setRankerChecked] = useState(false);
  const [tecnicaQ, setTecnicaQ] = useState(0);
  const [tecnicaAnswered, setTecnicaAnswered] = useState(false);
  const [tecnicaDone, setTecnicaDone] = useState(false);
  const [tecnicaCorrect, setTecnicaCorrect] = useState(0);
  const [tecnicaPromptVal, setTecnicaPromptVal] = useState('');
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizChecked, setQuizChecked] = useState(false);
  const [fillChecked, setFillChecked] = useState<Record<number, boolean>>({});
  const [sprintSec, setSprintSec] = useState(60);
  const [sprintQ, setSprintQ] = useState(0);
  const [sprintCorrect, setSprintCorrect] = useState(0);
  const [sprintDone, setSprintDone] = useState(false);
  const [sprintStarted, setSprintStarted] = useState(false);
  const sprintTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [reflectVal, setReflectVal] = useState('');
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());

  const examSteps = new Set([5, 7, 8, 10, 12, 14, 16, 18]);
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
    if (step === 5) { setMatchLeft(null); setMatchDone(0); setRightOrder(matchPairs.map(p => p.right).sort(() => Math.random() - 0.5)); }
    if (step === 7) { const o = [0,1,2,3,4].sort(() => Math.random() - 0.5); setSortOrder(o); setSortOk(false); }
    if (step === 8) { setTfAnswers({}); setTfChecked(false); }
    if (step === 10) { setRankerOrder([0,1,2].sort(() => Math.random() - 0.5)); setRankerChecked(false); }
    if (step === 12) { setTecnicaQ(0); setTecnicaAnswered(false); setTecnicaDone(false); setTecnicaCorrect(0); setTecnicaPromptVal(''); }
    if (step === 14) { setQuizAnswers({}); setQuizChecked(false); }
    if (step === 16) { setFillChecked({}); }
    if (step === 18) { setSprintSec(60); setSprintQ(0); setSprintCorrect(0); setSprintDone(false); setSprintStarted(false); if (sprintTimer.current) clearInterval(sprintTimer.current); }
  }, [step]);

  const addXP = (n: number) => setXp(prev => prev + n);
  const goToNextStep = () => { setStepResult(null); if (step < TOTAL_STEPS - 1) setStep(step + 1); };

  const showResult = (ok: boolean, msg: string, andAdvance = false) => {
    setStepResult({ ok, msg });
    if (andAdvance) setTimeout(() => goToNextStep(), 1800);
  };

  const handleClose = () => {
    if (isExamMode) Alert.alert('Actividad en curso', 'Si sales perderás el progreso. ¿Seguro?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Salir', style: 'destructive', onPress: () => navigation.goBack() }]);
    else Alert.alert('Salir', '¿Seguro que quieres salir?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Salir', onPress: () => navigation.goBack() }]);
  };

  const handleFinish = () => {
    let stars = 0;
    if (xp >= 200) stars = 3;
    else if (xp >= 130) stars = 2;
    else if (xp >= 60) stars = 1;
    completeLevel(2, 1, stars, xp);
    navigation.goBack();
  };

  // ============ MECÁNICAS ============

  // Matching (5)
  const handleMatchLeft = (i: number) => setMatchLeft(i);
  const handleMatchRight = (i: number) => {
    if (matchLeft === null) return;
    const correctRight = matchPairs[matchLeft].right;
    if (rightOrder[i] === correctRight) {
      const newDone = matchDone + 1;
      setMatchDone(newDone); setMatchLeft(null);
      if (newDone >= matchPairs.length) addXP(20);
    } else {
      Alert.alert('Incorrecto', 'Esa combinación no es correcta.');
      setMatchLeft(null);
    }
  };

  // Sort (7)
  const moveSort = (pos: number, dir: number) => {
    const np = pos + dir;
    if (np < 0 || np >= sortOrder.length) return;
    const newOrder = [...sortOrder];
    [newOrder[pos], newOrder[np]] = [newOrder[np], newOrder[pos]];
    setSortOrder(newOrder);
  };
  const checkSort = () => {
    if (sortOk) return true;
    const isOk = sortOrder.every((v, i) => v === i);
    if (isOk) { setSortOk(true); addXP(15); showResult(true, '¡Exacto! Así fluye el Chain of Thought. +15 XP', true); return false; }
    Alert.alert('Incorrecto', 'Algunos pasos fuera de lugar.');
    return false;
  };

  // TF (8)
  const selectTF = (qi: number, val: boolean) => { if (!tfChecked) setTfAnswers(prev => ({ ...prev, [qi]: val })); };
  const checkTF = () => {
    if (tfChecked) return true;
    if (Object.keys(tfAnswers).length < tfItems.length) { Alert.alert('Incompleto', 'Responde todas.'); return false; }
    setTfChecked(true);
    let correct = 0;
    tfItems.forEach((item, idx) => { if (tfAnswers[idx] === item.correct) correct++; });
    addXP(correct * 5);
    showResult(true, `Resultado: ${correct}/${tfItems.length} correctas. +${correct * 5} XP`, true);
    return false;
  };

  // Ranker (10)
  const swapRanker = (a: number, b: number) => {
    const newOrder = [...rankerOrder];
    [newOrder[a], newOrder[b]] = [newOrder[b], newOrder[a]];
    setRankerOrder(newOrder);
  };
  const [rankerSwapA, setRankerSwapA] = useState<number | null>(null);
  const handleRankerTap = (pos: number) => {
    if (rankerChecked) return;
    if (rankerSwapA === null) { setRankerSwapA(pos); return; }
    if (rankerSwapA !== pos) swapRanker(rankerSwapA, pos);
    setRankerSwapA(null);
  };
  const checkRanker = () => {
    if (rankerChecked) return true;
    setRankerChecked(true);
    const correct = rankerOrder.every((pi, pos) => rankerSet.prompts[pi].level === pos);
    if (correct) { addXP(20); Alert.alert('🏆 ¡Orden perfecto!', 'Del peor al mejor. +20 XP'); }
    else addXP(8);
    showResult(correct, correct ? `¡Perfecto! ${rankerSet.explain}` : `No del todo. ${rankerSet.explain}`, true);
    return false;
  };

  // Técnica Picker (12)
  const selectTecnica = (i: number) => {
    if (tecnicaAnswered) return;
    setTecnicaAnswered(true);
    const item = tecnicaItems[tecnicaQ];
    const isOk = i === item.correct;
    if (isOk) setTecnicaCorrect(prev => prev + 1);
    Alert.alert(isOk ? '✅ ¡Correcto!' : '❌ Incorrecto', item.explain);
  };
  const advanceTecnica = () => {
    if (tecnicaQ + 1 >= tecnicaItems.length) {
      const newCorrect = tecnicaCorrect;
      const earned = newCorrect >= 3 ? 25 : newCorrect >= 2 ? 15 : 8;
      addXP(earned);
      setTecnicaDone(true);
    } else {
      setTecnicaQ(prev => prev + 1);
      setTecnicaAnswered(false);
      setTecnicaPromptVal('');
    }
  };

  // Quiz (14)
  const selectQuiz = (qi: number, oi: number) => { if (!quizChecked) setQuizAnswers(prev => ({ ...prev, [qi]: oi })); };
  const checkQuiz = () => {
    if (quizChecked) return true;
    if (Object.keys(quizAnswers).length < quizItems.length) { Alert.alert('Incompleto', 'Responde todas.'); return false; }
    setQuizChecked(true);
    let correct = 0;
    quizItems.forEach((q, idx) => { if (quizAnswers[idx] === q.correct) correct++; });
    addXP(correct * 8);
    showResult(true, `Resultado: ${correct}/${quizItems.length} correctas. +${correct * 8} XP`, true);
    return false;
  };

  // Fill (16)
  const selectFill = (qi: number, oi: number) => {
    if (fillChecked[qi]) return;
    const item = fillItems[qi];
    const isOk = oi === item.correct;
    setFillChecked(prev => ({ ...prev, [qi]: true }));
    if (isOk) addXP(6);
    Alert.alert(isOk ? '✅ +6 XP' : '❌', item.explain);
  };

  // Sprint (18)
  const startSprint = () => {
    setSprintStarted(true); setSprintSec(60); setSprintQ(0); setSprintCorrect(0); setSprintDone(false);
    sprintTimer.current = setInterval(() => {
      setSprintSec(prev => { if (prev <= 1) { clearInterval(sprintTimer.current!); finishSprint(); return 0; } return prev - 1; });
    }, 1000);
  };
  const answerSprint = (val: boolean) => {
    if (sprintDone || sprintQ >= sprintItems.length) return;
    const item = sprintItems[sprintQ];
    const isOk = val === item.correct;
    if (isOk) setSprintCorrect(prev => prev + 1);
    if (sprintQ + 1 >= sprintItems.length) {
      const newCorrect = sprintCorrect + (isOk ? 1 : 0);
      const earned = newCorrect >= 10 ? 25 : newCorrect >= 7 ? 18 : newCorrect >= 4 ? 12 : 5;
      setSprintCorrect(newCorrect); addXP(earned); finishSprint();
    } else setSprintQ(prev => prev + 1);
  };
  const finishSprint = () => { if (!sprintDone) { setSprintDone(true); if (sprintTimer.current) clearInterval(sprintTimer.current); } };

  // Reflexión (20)
  const checkReflect = () => { if (reflectVal.trim().length >= 80) { addXP(15); return true; } Alert.alert('Muy corto', 'Escribe al menos 80 caracteres.'); return false; };

  // ============ RENDER ============
  const renderIntro = () => (
    <View>
      <View style={styles.iconCircle}><Text style={{ fontSize: 34 }}>✍️</Text></View>
      <Text style={styles.title}>¡Aprende a hablarle a la IA como un experto!</Text>
      <Text style={styles.subtitle}>Ya sabes los ingredientes básicos. Ahora los 5 trucos secretos que usan los profesionales. 🚀</Text>
      <View style={styles.card}><Text style={styles.cardTitle}>🧠 Vas a aprender 5 trucos pro</Text><Text style={styles.cardText}>Pensar en voz alta · Dar ejemplos · Decir qué NO · Darle identidad · Dividir tareas grandes.</Text></View>
      <View style={styles.card}><Text style={styles.cardTitle}>🆕 Dos mecánicas nuevas</Text><Text style={styles.cardText}>Prompt Ranker — ordena prompts del peor al mejor — y Técnica Picker — elige el truco correcto.</Text></View>
      <View style={styles.card}><Text style={styles.cardTitle}>⭐ Hasta 270 XP · 20 módulos</Text></View>
    </View>
  );

  const renderTheory1 = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#ffe4e6' }]}><Text style={[styles.tagText, { color: '#9f1239' }]}>📖 Módulo 1</Text></View>
      <Text style={styles.title}>¿Por qué hay prompts que funcionan mucho mejor?</Text>
      <Text style={styles.bodyText}>Con la IA pasa igual que con un amigo: si le dices exactamente qué necesitas, cómo y qué NO quieres... ¡la ayuda es perfecta!</Text>
      {['🔗 Pensar en voz alta (Chain of Thought)', '📸 Dar ejemplos (Few-shot)', '🚫 Decir qué NO (Negative Prompting)', '🎭 Darle una identidad (Role System)', '⛓️ Dividir en partes (Multi-step)'].map((t, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
          <View style={styles.stepNum}><Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>{i + 1}</Text></View>
          <Text style={{ flex: 1, fontSize: 12, color: '#334155', lineHeight: 18 }}>{t}</Text>
        </View>
      ))}
    </View>
  );

  const renderExamples = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fff7ed' }]}><Text style={[styles.tagText, { color: '#9a3412' }]}>🔬 Módulo 2 · Los 5 trucos</Text></View>
      <Text style={styles.title}>Los 5 trucos en acción</Text>
      {[
        { emoji: '🔗', title: 'Truco 1: Pensar en voz alta', sub: 'Para problemas de lógica y matemáticas', tag: 'CHAIN OF THOUGHT', body: 'Sin el truco: "¿Cuántos segundos hay en 2 horas?"\nCon el truco: "¿Cuántos segundos hay en 2 horas? Piensa paso a paso: convierte horas a minutos, luego a segundos."', fact: '⚡ Es como cuando el profe pide "muestra el procedimiento".' },
        { emoji: '📸', title: 'Truco 2: Dar ejemplos', sub: 'Para conseguir el formato exacto', tag: 'FEW-SHOT', body: 'Sin el truco: "Escríbeme una frase motivadora."\nCon el truco: "Mira estos ejemplos: [Ej1] [Ej2]. Escríbeme 2 frases con ese mismo estilo."', fact: '⚡ Como cuando aprendiste a dibujar copiando — le muestras el modelo.' },
        { emoji: '🚫', title: 'Truco 3: Decir qué NO quieres', sub: 'Para evitar respuestas que no sirven', tag: 'NEGATIVE PROMPTING', body: 'Sin el truco: "Explícame la lluvia de forma divertida."\nCon el truco: "NO uses palabras difíciles. NO hagas lista con puntos — cuéntalo como una historia."', fact: '⚡ Como decir "quiero pizza, pero SIN aceitunas".' },
        { emoji: '🎭', title: 'Truco 4: Darle una identidad', sub: 'Para que responda desde un personaje', tag: 'ROLE SYSTEM', body: 'Sin el truco: "Ayúdame a entender la historia de Colombia."\nCon el truco: "Eres un narrador de historias para jóvenes de 11 años. Comparas con videojuegos y superhéroes."', fact: '⚡ Cuanto más detallado sea el personaje, mejor funciona.' },
        { emoji: '⛓️', title: 'Truco 5: Dividir en partes', sub: 'Para tareas muy grandes', tag: 'MULTI-STEP', body: 'Sin el truco: "Escríbeme una historia de 5 páginas."\nCon el truco: Prompt 1: personajes → Prompt 2: plan → Prompt 3: capítulo 1...', fact: '⚡ Como un trabajo escolar: esquema, borrador, corrección.' },
      ].map((c, i) => (
        <TouchableOpacity key={i} style={styles.exCard} onPress={() => setExpandedCards(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return new Set(s); })}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 22 }}>{c.emoji}</Text>
            <View style={{ flex: 1 }}><Text style={{ fontWeight: 'bold', fontSize: 13 }}>{c.title}</Text><Text style={{ fontSize: 11, color: '#64748b' }}>{c.sub}</Text></View>
            <MaterialIcons name={expandedCards.has(i) ? 'keyboard-arrow-down' : 'keyboard-arrow-right'} size={20} color="#94a3b8" />
          </View>
          {expandedCards.has(i) && (
            <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#fecdd3' }}>
              <View style={{ backgroundColor: '#ffe4e6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 6 }}><Text style={{ fontSize: 10, fontWeight: 'bold', color: '#9f1239' }}>{c.tag}</Text></View>
              <Text style={{ fontSize: 12, color: '#334155', lineHeight: 20 }}>{c.body}</Text>
              <Text style={{ fontSize: 11, backgroundColor: '#fffbeb', padding: 8, borderRadius: 8, color: '#92400e', marginTop: 6 }}>{c.fact}</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderCompare = () => {
    const item = compareItems[compareIdx];
    return (
      <View>
        <View style={[styles.tag, { backgroundColor: '#fff1f2' }]}><Text style={[styles.tagText, { color: '#e11d48' }]}>🔍 Módulo 3 · Compara ({compareIdx + 1}/{compareItems.length})</Text></View>
        <Text style={styles.title}>Básico vs. Profesional</Text>
        <Text style={{ fontSize: 11, color: '#64748b', textAlign: 'center', marginBottom: 8 }}>Tarea: {item.task}</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          <View style={{ flex: 1, backgroundColor: '#fff1f2', borderRadius: 12, padding: 11, borderWidth: 2, borderColor: '#fecdd3' }}>
            <Text style={{ fontWeight: 'bold', color: '#e11d48', marginBottom: 6 }}>❌ Prompt básico</Text>
            <Text style={{ fontSize: 11, fontFamily: 'monospace', color: '#334155', marginBottom: 6 }}>{item.bad}</Text>
            <Text style={{ fontSize: 10, color: '#64748b', fontStyle: 'italic' }}>{item.badWhy}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: '#f0fdf4', borderRadius: 12, padding: 11, borderWidth: 2, borderColor: '#bbf7d0' }}>
            <Text style={{ fontWeight: 'bold', color: '#166534', marginBottom: 6 }}>✅ Prompt profesional</Text>
            <Text style={{ fontSize: 11, fontFamily: 'monospace', color: '#334155', marginBottom: 6 }}>{item.good}</Text>
            <Text style={{ fontSize: 10, color: '#64748b', fontStyle: 'italic' }}>{item.goodWhy}</Text>
          </View>
        </View>
      </View>
    );
  };
  const nextCompare = () => {
    if (compareIdx + 1 >= compareItems.length) { addXP(15); goToNextStep(); }
    else setCompareIdx(prev => prev + 1);
  };

  const renderTheory2 = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#ffe4e6' }]}><Text style={[styles.tagText, { color: '#9f1239' }]}>📖 Módulo 4 · ¿Cuándo usar cuál?</Text></View>
      <Text style={styles.title}>¿Cuándo uso cada truco?</Text>
      {[
        { icon: '🔗', title: 'Pensar en voz alta → cuando necesitas que razone bien', text: 'Matemáticas, lógica, decisiones difíciles.' },
        { icon: '📸', title: 'Dar ejemplos → cuando quieres un formato exacto', text: 'La IA no capta el estilo que quieres con palabras.' },
        { icon: '🚫', title: 'Decir qué NO → cuando repite cosas que no sirven', text: 'Usa palabras difíciles, hace listas no deseadas.' },
        { icon: '🎭', title: 'Darle identidad → cuando necesitas un estilo especial', text: 'Que hable como científico, amigo, maestro divertido.' },
        { icon: '⛓️', title: 'Dividir en partes → cuando la tarea es muy grande', text: 'Historias largas, proyectos complejos.' },
      ].map((c, i) => (
        <View key={i} style={styles.card}><Text style={styles.cardTitle}>{c.icon} {c.title}</Text><Text style={styles.cardText}>{c.text}</Text></View>
      ))}
    </View>
  );

  const renderMatching = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#eef2ff' }]}><Text style={[styles.tagText, { color: '#3730a3' }]}>🔗 Módulo 5 · Conectar</Text></View>
      <Text style={styles.title}>¿Cuándo usar cada truco?</Text>
      <View style={[styles.card, { backgroundColor: '#fff1f2' }]}><Text style={{ fontSize: 11 }}>① Toca tarjeta izquierda → ② Toca la derecha</Text></View>
      <View style={{ flexDirection: 'row', gap: 5 }}>
        <View style={{ flex: 1 }}>
          {matchPairs.map((p, i) => (
            <TouchableOpacity key={i} style={[styles.matchItem, { backgroundColor: matchLeft === i ? '#ffe4e6' : '#fff1f2' }]} onPress={() => handleMatchLeft(i)}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#9f1239', textAlign: 'center' }}>{p.left}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ flex: 1 }}>
          {rightOrder.map((r, i) => (
            <TouchableOpacity key={i} style={[styles.matchItem, { backgroundColor: '#fff1f2' }]} onPress={() => handleMatchRight(i)}>
              <Text style={{ fontSize: 10, color: '#9f1239', textAlign: 'center' }}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {matchDone >= matchPairs.length && <Text style={{ textAlign: 'center', color: '#166534', marginTop: 8 }}>✅ ¡Todos conectados! +20 XP</Text>}
    </View>
  );

  const renderTheory3 = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#ffe4e6' }]}><Text style={[styles.tagText, { color: '#9f1239' }]}>📖 Módulo 6 · Pensar en voz alta</Text></View>
      <Text style={styles.title}>Truco 1: Hacerla pensar en voz alta</Text>
      <View style={styles.card}><Text style={styles.cardTitle}>❓ ¿Por qué funciona?</Text><Text style={styles.cardText}>Cuando la IA escribe sus pasos, ¡eso le ayuda a pensar mejor! Como tú escribiendo el procedimiento en un examen.</Text></View>
      {['Forma simple: "Piensa paso a paso antes de responder."', 'Forma guiada: Tú le dices los pasos.', 'Forma con revisión: "Antes de responder, verifica que sea correcta."'].map((t, i) => (
        <View key={i} style={styles.card}><Text style={styles.cardText}>{i + 1}️⃣ {t}</Text></View>
      ))}
    </View>
  );

  const renderSort = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#f5f3ff' }]}><Text style={[styles.tagText, { color: '#5b21b6' }]}>↕️ Módulo 7 · Ordenar</Text></View>
      <Text style={styles.title}>¿Cómo piensa la IA paso a paso?</Text>
      {sortOrder.map((stepIdx, pos) => (
        <View key={pos} style={styles.sortItem}>
          <Text style={styles.sortNum}>{pos + 1}</Text>
          <Text style={styles.sortText}>{SORT_COT[stepIdx]}</Text>
          <View style={styles.sortArrows}>
            <TouchableOpacity style={styles.sortBtn} onPress={() => moveSort(pos, -1)} disabled={pos === 0}><MaterialIcons name="keyboard-arrow-up" size={18} color={colors.textSecondary} /></TouchableOpacity>
            <TouchableOpacity style={styles.sortBtn} onPress={() => moveSort(pos, 1)} disabled={pos === sortOrder.length - 1}><MaterialIcons name="keyboard-arrow-down" size={18} color={colors.textSecondary} /></TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );

  const renderTF = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fef9ee' }]}><Text style={[styles.tagText, { color: '#92400e' }]}>✅ Módulo 8 · V/F</Text></View>
      <Text style={styles.title}>¿Cuáles de estas ideas son verdad?</Text>
      {tfItems.map((item, idx) => (
        <View key={idx} style={{ marginBottom: 14 }}>
          <Text style={styles.tfQuestion}>{idx + 1}. {item.stmt}</Text>
          <View style={{ flexDirection: 'row', gap: 7 }}>
            <TouchableOpacity style={[styles.tfBtn, tfAnswers[idx] === true && { borderColor: '#e11d48', backgroundColor: '#ffe4e6' }]} onPress={() => selectTF(idx, true)} disabled={tfChecked}><Text style={{ fontWeight: 'bold' }}>✅ Verdadero</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.tfBtn, tfAnswers[idx] === false && { borderColor: '#ef4444', backgroundColor: '#fff1f2' }]} onPress={() => selectTF(idx, false)} disabled={tfChecked}><Text style={{ fontWeight: 'bold' }}>❌ Falso</Text></TouchableOpacity>
          </View>
          {tfChecked && (
            <View style={{ padding: 8, backgroundColor: tfAnswers[idx] === item.correct ? '#dcfce7' : '#fff1f2', borderRadius: 8, marginTop: 6 }}>
              <Text style={{ fontSize: 12, color: tfAnswers[idx] === item.correct ? '#166534' : '#991b1b' }}>{item.explain}</Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );

  const renderTheory4 = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#ffe4e6' }]}><Text style={[styles.tagText, { color: '#9f1239' }]}>📖 Módulo 9 · Ejemplos e identidad</Text></View>
      <Text style={styles.title}>Trucos 2 y 4: Mostrar y dar un personaje</Text>
      <View style={styles.card}><Text style={styles.cardTitle}>🎯 Truco 2 — Dar ejemplos</Text><Text style={styles.cardText}>Muestras cómo quieres la respuesta con ejemplos. ¡Mostrar es más fácil que explicar!</Text></View>
      <View style={styles.card}><Text style={styles.cardTitle}>🎭 Truco 4 — Darle identidad</Text><Text style={styles.cardText}>Básico: "Eres un maestro." · Completo: "Eres un maestro divertido que lleva 10 años enseñando a niños, te encantan los videojuegos..." ¡Resultado completamente diferente!</Text></View>
    </View>
  );

  const renderRanker = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#e11d4820' }]}><Text style={[styles.tagText, { color: '#9f1239' }]}>🆕 Módulo 10 · Prompt Ranker</Text></View>
      <Text style={styles.title}>¿Cuál prompt es mejor?</Text>
      <Text style={{ fontSize: 11, color: '#64748b', textAlign: 'center', marginBottom: 8 }}>Objetivo: {rankerSet.task}</Text>
      <Text style={{ fontSize: 10, color: '#94a3b8', textAlign: 'center', marginBottom: 10 }}>🔼 Posición 1 = peor · 🔽 Posición 3 = mejor · Toca dos para intercambiar</Text>
      {rankerOrder.map((pi, pos) => {
        const p = rankerSet.prompts[pi];
        return (
          <TouchableOpacity
            key={pos}
            style={[styles.rankerCard, rankerSwapA === pos && { borderColor: '#e11d48', backgroundColor: '#ffe4e6' }]}
            onPress={() => handleRankerTap(pos)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <View style={styles.rankerBadge}><Text style={{ fontWeight: 'bold', color: '#64748b' }}>{pos + 1}</Text></View>
              <Text style={{ fontSize: 10, color: '#64748b' }}>Opción {pos + 1}</Text>
            </View>
            <Text style={{ fontSize: 11, fontFamily: 'monospace', color: '#334155', lineHeight: 18 }}>{p.text}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderTheory5 = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#ffe4e6' }]}><Text style={[styles.tagText, { color: '#9f1239' }]}>📖 Módulo 11 · Decir qué NO y dividir</Text></View>
      <Text style={styles.title}>Trucos 3 y 5</Text>
      <View style={styles.card}><Text style={styles.cardTitle}>🚫 Truco 3 — Decir qué NO</Text><Text style={styles.cardText}>La IA tiene hábitos automáticos. Rompelos con: EVITA, NO uses, NO hagas, NO empieces con.</Text></View>
      <View style={styles.card}><Text style={styles.cardTitle}>⛓️ Truco 5 — Dividir en partes</Text><Text style={styles.cardText}>Paso 1: esquema → Paso 2: desarrollo → Paso 3: mejora → Paso 4: revisión.</Text></View>
    </View>
  );

  const renderTecnicaPicker = () => {
    if (tecnicaDone) return <View><Text style={styles.title}>¡Técnica Picker completado!</Text><Text style={{ textAlign: 'center', marginTop: 8 }}>{tecnicaCorrect}/{tecnicaItems.length} correctas</Text></View>;
    const item = tecnicaItems[tecnicaQ];
    return (
      <View>
        <View style={[styles.tag, { backgroundColor: '#e11d4820' }]}><Text style={[styles.tagText, { color: '#9f1239' }]}>🆕 Módulo 12 · Técnica Picker ({tecnicaQ + 1}/{tecnicaItems.length})</Text></View>
        <Text style={styles.title}>¿Qué técnica usarías?</Text>
        <View style={[styles.card, { backgroundColor: '#fff1f2' }]}><Text style={{ fontSize: 12, color: '#334155', lineHeight: 20 }}>{item.scenario}</Text></View>
        <Text style={{ fontWeight: 'bold', fontSize: 11, marginBottom: 6 }}>¿Qué técnica aplicas?</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {item.opciones.map((op, i) => (
            <TouchableOpacity key={i} style={[styles.tecnicaOpt, tecnicaAnswered && i === item.correct && { borderColor: '#10b981', backgroundColor: '#dcfce7' }]} onPress={() => selectTecnica(i)} disabled={tecnicaAnswered}>
              <Text style={{ fontSize: 11, fontWeight: '600' }}>{op}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {tecnicaAnswered && (
          <View>
            <View style={[styles.card, { backgroundColor: '#fff1f2' }]}><Text style={{ fontSize: 11 }}>💡 Pista: {item.promptHint}</Text></View>
            <TextInput style={styles.textArea} multiline placeholder="Escribe tu prompt aplicando la técnica..." value={tecnicaPromptVal} onChangeText={setTecnicaPromptVal} />
            <Text style={{ fontSize: 10, color: '#94a3b8', textAlign: 'right' }}>{tecnicaPromptVal.length} / 30 mín.</Text>
          </View>
        )}
      </View>
    );
  };

  const renderCase = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fdf4ff' }]}><Text style={[styles.tagText, { color: '#7e22ce' }]}>🎯 Módulo 13 · Historia real</Text></View>
      <Text style={styles.title}>Cómo Valentina mejoró su prompt</Text>
      <Text style={styles.bodyText}>Valentina, 14 años, Bogotá. Necesitaba analizar 30 opiniones de usuarios de una app.</Text>
      <View style={[styles.card, { backgroundColor: '#fff1f2' }]}><Text style={styles.cardTitle}>❌ Intento 1 (sin trucos)</Text><Text style={[styles.cardText, { fontFamily: 'monospace' }]}>"Analiza estas opiniones y dime qué problemas tienen." → Lista genérica, sin soluciones.</Text></View>
      <View style={[styles.card, { backgroundColor: '#f0fdf4' }]}><Text style={styles.cardTitle}>✅ Intento 4 (con 3 trucos)</Text><Text style={[styles.cardText, { fontFamily: 'monospace' }]}>[Identidad: investigador experto] + [Paso a paso: agrupa, cuenta, evalúa] + [Qué NO: sin problemas de 1 persona, sin palabras difíciles] → ¡Tabla perfecta!</Text></View>
    </View>
  );

  const renderQuiz = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fef3c7' }]}><Text style={[styles.tagText, { color: '#92400e' }]}>❓ Módulo 14 · Quiz</Text></View>
      <Text style={styles.title}>¿Qué truco usar en cada situación?</Text>
      {quizItems.map((q, qi) => (
        <View key={qi} style={{ marginBottom: 14 }}>
          <Text style={styles.quizQ}>{qi + 1}. {q.q}</Text>
          {q.opts.map((opt, oi) => (
            <TouchableOpacity key={oi} style={[styles.quizOpt, quizAnswers[qi] === oi && { borderColor: '#e11d48', backgroundColor: '#ffe4e6' }]} onPress={() => selectQuiz(qi, oi)} disabled={quizChecked}>
              <Text style={styles.quizLetter}>{String.fromCharCode(65 + oi)}</Text>
              <Text style={{ flex: 1, fontSize: 12, color: '#334155' }}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );

  const renderTheory6 = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#ffe4e6' }]}><Text style={[styles.tagText, { color: '#9f1239' }]}>📖 Módulo 15 · Combinar trucos</Text></View>
      <Text style={styles.title}>El poder de combinar trucos</Text>
      {['🔗+🎭 Paso a paso + Identidad', '📸+🚫 Ejemplos + Qué NO', '🎭+⛓️ Identidad + Dividir', '🔗+📸+🚫 La combinación más potente'].map((t, i) => (
        <View key={i} style={styles.card}><Text style={styles.cardText}>{t}</Text></View>
      ))}
    </View>
  );

  const renderFill = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#ecfdf5' }]}><Text style={[styles.tagText, { color: '#065f46' }]}>💬 Módulo 16 · Vocabulario</Text></View>
      <Text style={styles.title}>¿Cuál palabra va ahí?</Text>
      {fillItems.map((item, qi) => (
        <View key={qi} style={{ marginBottom: 16 }}>
          <View style={[styles.card, { backgroundColor: '#fff1f2' }]}>
            <Text style={{ fontSize: 13, color: '#334155', lineHeight: 24 }}>{item.sentence.replace('_____', '_____')}</Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {item.allOpts.map((opt, oi) => (
              <TouchableOpacity key={oi} style={[styles.fillOpt, fillChecked[qi] && oi === item.correct && { borderColor: '#10b981', backgroundColor: '#dcfce7' }]} onPress={() => selectFill(qi, oi)} disabled={fillChecked[qi]}>
                <Text style={{ fontSize: 12, fontWeight: '600' }}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
    </View>
  );

  const renderTheory7 = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#ffe4e6' }]}><Text style={[styles.tagText, { color: '#9f1239' }]}>📖 Módulo 17 · Errores frecuentes</Text></View>
      <Text style={styles.title}>Errores que comete casi todo el mundo</Text>
      {['Escribir demasiado sin organizar', 'Usar "piensa paso a paso" para todo', 'Cambiar todo cuando algo falla', 'Dar identidad sin restricciones'].map((t, i) => (
        <View key={i} style={styles.card}><Text style={styles.cardText}>⚠️ {t}</Text></View>
      ))}
    </View>
  );

  const renderSprint = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fef3c7' }]}><Text style={[styles.tagText, { color: '#92400e' }]}>⚡ Módulo 18 · Sprint</Text></View>
      <Text style={styles.title}>Sprint: ¿verdad o mito?</Text>
      <Text style={{ fontSize: 28, fontWeight: 'bold', textAlign: 'center', color: sprintSec <= 10 ? '#ef4444' : '#e11d48', marginVertical: 8 }}>{sprintSec}</Text>
      <View style={{ height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}>
        <View style={{ height: '100%', width: `${(sprintSec / 60) * 100}%`, backgroundColor: '#e11d48', borderRadius: 3 }} />
      </View>
      {!sprintStarted ? (
        <TouchableOpacity style={styles.nextButton} onPress={startSprint}><Text style={styles.nextButtonText}>⚡ Empezar Sprint</Text></TouchableOpacity>
      ) : sprintDone ? (
        <View style={{ padding: 14, backgroundColor: '#dcfce7', borderRadius: 10 }}><Text style={{ fontWeight: 'bold', color: '#166534', textAlign: 'center', fontSize: 18 }}>{sprintCorrect}/{sprintItems.length} correctas</Text></View>
      ) : sprintQ < sprintItems.length ? (
        <View>
          <Text style={styles.tfQuestion}>{sprintItems[sprintQ].stmt}</Text>
          <View style={{ flexDirection: 'row', gap: 7 }}>
            <TouchableOpacity style={[styles.tfBtn, { flex: 1 }]} onPress={() => answerSprint(true)}><Text style={{ fontWeight: 'bold' }}>✅ Verdadero</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.tfBtn, { flex: 1 }]} onPress={() => answerSprint(false)}><Text style={{ fontWeight: 'bold' }}>❌ Falso</Text></TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );

  const renderGuide = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#ffe4e6' }]}><Text style={[styles.tagText, { color: '#9f1239' }]}>📖 Módulo 19 · Tu guía</Text></View>
      <Text style={styles.title}>Tu guía de trucos — ¡guárdala!</Text>
      {[
        { truco: '🔗 Paso a paso', cuando: 'Lógica, matemáticas', frase: '"Piensa paso a paso"' },
        { truco: '📸 Dar ejemplos', cuando: 'Formato exacto', frase: '"Mira estos ejemplos..."' },
        { truco: '🚫 Decir qué NO', cuando: 'IA repite cosas', frase: '"EVITA / NO hagas:"' },
        { truco: '🎭 Darle identidad', cuando: 'Necesitas estilo especial', frase: '"Eres un [personaje]..."' },
        { truco: '⛓️ Dividir en partes', cuando: 'Tarea muy grande', frase: 'Prompts por fase' },
      ].map((t, i) => (
        <View key={i} style={styles.card}>
          <Text style={styles.cardTitle}>{t.truco}</Text>
          <Text style={styles.cardText}>Cuándo: {t.cuando} · Frase: {t.frase}</Text>
        </View>
      ))}
    </View>
  );

  const renderReflect = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#f1f5f9' }]}><Text style={[styles.tagText, { color: '#475569' }]}>✍️ Módulo 20 · Reflexión</Text></View>
      <Text style={styles.title}>Tu truco favorito y por qué</Text>
      <View style={styles.card}><Text style={styles.cardText}>1. ¿Cuál de los 5 trucos vas a usar más? ¿Por qué ese?</Text></View>
      <View style={styles.card}><Text style={styles.cardText}>2. Piensa en algo que intentaste con IA y no salió bien. ¿Qué truco usarías ahora?</Text></View>
      <TextInput style={styles.textArea} multiline placeholder="Escribe tu reflexión (mín. 80 caracteres)..." value={reflectVal} onChangeText={setReflectVal} />
      <Text style={{ fontSize: 11, color: '#94a3b8', textAlign: 'right' }}>{reflectVal.length} / 80 mín.</Text>
    </View>
  );

  const renderCompletion = () => (
    <View style={{ alignItems: 'center', padding: 20 }}>
      <Text style={{ fontSize: 44, marginBottom: 14 }}>✍️</Text>
      <Text style={[styles.title, { textAlign: 'center' }]}>¡Nivel 7 completado!</Text>
      <Text style={[styles.subtitle, { textAlign: 'center' }]}>Terminaste "Prompting como un profesional". ¡5 trucos avanzados que muy poca gente conoce!</Text>
      <Text style={{ fontWeight: 'bold', fontSize: 15, color: '#92400e', marginBottom: 14 }}>⭐ {xp} XP ganados</Text>
      <TouchableOpacity style={styles.finishButton} onPress={handleFinish}><Text style={{ fontWeight: 'bold', color: '#fff' }}>Volver al mapa</Text></TouchableOpacity>
    </View>
  );

  // ============ RENDER PRINCIPAL ============
  const renderStepContent = () => {
    switch (step) {
      case 0: return renderIntro();
      case 1: return renderTheory1();
      case 2: return renderExamples();
      case 3: return renderCompare();
      case 4: return renderTheory2();
      case 5: return renderMatching();
      case 6: return renderTheory3();
      case 7: return renderSort();
      case 8: return renderTF();
      case 9: return renderTheory4();
      case 10: return renderRanker();
      case 11: return renderTheory5();
      case 12: return renderTecnicaPicker();
      case 13: return renderCase();
      case 14: return renderQuiz();
      case 15: return renderTheory6();
      case 16: return renderFill();
      case 17: return renderTheory7();
      case 18: return renderSprint();
      case 19: return renderGuide();
      case 20: return renderReflect();
      case 21: return renderCompletion();
      default: return null;
    }
  };

  const progressPercent = (step / (TOTAL_STEPS - 1)) * 100;

  const handleMainBtn = () => {
    const handlers: Record<number, (() => boolean) | undefined> = {
      3: () => { nextCompare(); return false; },
      5: () => matchDone >= matchPairs.length,
      7: checkSort,
      8: checkTF,
      10: checkRanker,
      12: () => {
        if (tecnicaDone) return true;
        if (!tecnicaAnswered) {
          Alert.alert('Elige una técnica', 'Selecciona una técnica primero.');
          return false;
        }
        if (tecnicaPromptVal.trim().length < 30) {
          Alert.alert('Prompt muy corto', 'Escribe al menos 30 caracteres aplicando la técnica.');
          return false;
        }
        advanceTecnica();
        return false; // No avanza de paso hasta que todas las situaciones estén completas
      },
      14: checkQuiz,
      16: () => Object.keys(fillChecked).length >= fillItems.length,
      18: () => sprintDone,
      20: checkReflect,
    };
    const handler = handlers[step];
    if (handler) {
      if (!handler()) return;
    }
    goToNextStep();
  };

  const showNextBtn = step < TOTAL_STEPS - 1 && ![3, 5, 7, 8, 10, 12, 14, 16, 18, 20, 21].includes(step);
  const showCheckBtn = [3, 5, 7, 8, 10, 12, 14, 16, 18, 20].includes(step) && step < TOTAL_STEPS - 1;

  const getBtnLabel = () => {
    switch (step) { case 3: return 'Ver siguiente →'; case 5: return matchDone >= matchPairs.length ? 'Continuar →' : 'Conecta todos los pares'; case 7: return 'Verificar orden'; case 8: return 'Comprobar'; case 10: return 'Verificar orden'; case 12: return tecnicaDone ? 'Continuar →' : (tecnicaAnswered ? 'Siguiente →' : 'Selecciona el truco'); case 14: return 'Comprobar respuestas'; case 16: return 'Continuar →'; case 18: return sprintDone ? 'Continuar →' : 'Empezar Sprint ⚡'; case 20: return 'Enviar reflexión →'; default: return 'Continuar →'; }
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
      {showCheckBtn && <TouchableOpacity style={styles.nextButton} onPress={step === 18 && !sprintStarted ? startSprint : handleMainBtn}><Text style={styles.nextButtonText}>{getBtnLabel()}</Text></TouchableOpacity>}
    </View>
  );
}

// ===================== ESTILOS =====================
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  progressBar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  closeBtn: { padding: 4 },
  progressTrack: { flex: 1, height: 6, backgroundColor: colors.borderLight, borderRadius: 3, marginHorizontal: 12 },
  progressFill: { height: '100%', backgroundColor: '#e11d48', borderRadius: 3 },
  xpText: { ...typography.bold, fontSize: 14, color: '#92400e' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  tag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 12 },
  tagText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  iconCircle: { width: 60, height: 60, borderRadius: 18, backgroundColor: '#ffe4e6', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  title: { ...typography.extraBold, fontSize: 19, color: colors.textPrimary, marginBottom: 6 },
  subtitle: { ...typography.regular, fontSize: 13, color: colors.textSecondary, marginBottom: 14, lineHeight: 18 },
  bodyText: { ...typography.regular, fontSize: 13, color: colors.textPrimary, lineHeight: 20, marginBottom: 12 },
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  cardTitle: { ...typography.bold, fontSize: 13, color: colors.textPrimary, marginBottom: 6 },
  cardText: { ...typography.regular, fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#e11d48', justifyContent: 'center', alignItems: 'center' },
  exCard: { backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 8 },
  matchItem: { padding: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#fecdd3', marginBottom: 4, minHeight: 55, justifyContent: 'center' },
  sortItem: { flexDirection: 'row', alignItems: 'center', padding: 11, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  sortNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#e11d48', textAlign: 'center', lineHeight: 26, color: '#fff', fontWeight: 'bold', fontSize: 11, marginRight: 9 },
  sortText: { flex: 1, fontSize: 12, color: colors.textPrimary },
  sortArrows: { flexDirection: 'column', gap: 3 },
  sortBtn: { width: 28, height: 26, borderRadius: 7, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  tfQuestion: { fontWeight: 'bold', fontSize: 13, padding: 11, backgroundColor: '#f8fafc', borderRadius: 10, marginBottom: 8 },
  tfBtn: { flex: 1, padding: 12, borderRadius: 11, borderWidth: 2, borderColor: '#e2e8f0', backgroundColor: '#fff', alignItems: 'center' },
  rankerCard: { borderRadius: 13, borderWidth: 2, borderColor: '#e2e8f0', padding: 12, marginBottom: 8, backgroundColor: '#fafafa' },
  rankerBadge: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center' },
  tecnicaOpt: { padding: 8, paddingHorizontal: 13, borderRadius: 10, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  quizQ: { fontWeight: 'bold', fontSize: 12, padding: 11, backgroundColor: '#f8fafc', borderRadius: 10, marginBottom: 8 },
  quizOpt: { flexDirection: 'row', alignItems: 'center', padding: 10, borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, marginBottom: 6, gap: 9 },
  quizLetter: { width: 22, height: 22, borderRadius: 6, backgroundColor: '#f1f5f9', textAlign: 'center', lineHeight: 22, fontSize: 10, fontWeight: 'bold', color: '#64748b' },
  fillOpt: { padding: 8, paddingHorizontal: 13, borderRadius: 10, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  textArea: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 13, color: '#334155', textAlignVertical: 'top', minHeight: 80, backgroundColor: '#fafafa' },
  nextButton: { backgroundColor: '#e11d48', padding: 14, margin: 16, borderRadius: 11, alignItems: 'center' },
  nextButtonText: { ...typography.bold, color: '#fff', fontSize: 15 },
  finishButton: { backgroundColor: '#e11d48', padding: 14, borderRadius: 11, width: '100%', alignItems: 'center', marginTop: 14 },
  resultBanner: { margin: 16, padding: 14, borderRadius: 14, borderWidth: 1 },
  resultBannerOk: { backgroundColor: '#dcfce7', borderColor: colors.success },
  resultBannerErr: { backgroundColor: '#fee2e2', borderColor: colors.error },
  resultBannerText: { ...typography.bold, fontSize: 13, color: colors.textPrimary, lineHeight: 20 },
});