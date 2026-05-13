import { router } from 'expo-router';
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, BackHandler,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useGameStore } from '../../store/gameStore';
import { colors, typography } from '../../theme';

// ---------- Tipos ----------
type TFItem = { stmt: string; correct: boolean; explain: string };
type DragItem = { text: string; correct: string };
type MatchPair = { left: string; right: string };
type QuizItem = { q: string; opts: string[]; correct: number; explain: string };
type HallCase = { intro: string; text: string; correct: number; explain: string };
type SprintItem = { stmt: string; correct: boolean };

// ---------- Pools de datos ----------
const TEMP_POOL: DragItem[] = [
  { text: 'Escríbeme un poema sobre el mar', correct: 'hot' },
  { text: '¿Cuántos continentes hay en la Tierra?', correct: 'cold' },
  { text: 'Invéntate una historia de ciencia ficción', correct: 'hot' },
  { text: '¿Cuánto es 1,847 × 23?', correct: 'cold' },
  { text: 'Dame 5 ideas creativas para mi proyecto', correct: 'hot' },
  { text: 'Explícame la ley de gravedad paso a paso', correct: 'cold' },
  { text: 'Crea un personaje ficticio para mi novela', correct: 'hot' },
  { text: '¿Cuál es la capital de Australia?', correct: 'cold' },
];

const CONTEXT_TF_POOL: TFItem[] = [
  { stmt: 'Si cierras la conversación y abres una nueva, el LLM recuerda lo que hablaron antes.', correct: false, explain: 'No — los LLMs no tienen memoria entre sesiones.' },
  { stmt: 'La "ventana de contexto" define cuánto texto puede "ver" el LLM en una conversación.', correct: true, explain: 'Exacto. Si superas ese límite, el modelo empieza a olvidar el inicio.' },
  { stmt: 'Si le das más contexto en tu prompt, un LLM siempre da mejores respuestas.', correct: true, explain: 'Generalmente sí. Más contexto relevante = mejor respuesta.' },
  { stmt: 'Los LLMs pueden recordar información de otras conversaciones de otros usuarios.', correct: false, explain: 'Falso — y esto es bueno para la privacidad.' },
  { stmt: 'El historial de conversación que ves es exactamente lo que el LLM tiene en su contexto.', correct: true, explain: 'Sí. El sistema envía el historial completo con cada mensaje.' },
  { stmt: 'Un LLM con ventana de contexto más grande siempre es mejor que uno con ventana pequeña.', correct: false, explain: 'No necesariamente. Depende de la tarea.' },
  { stmt: 'Si empiezas cada conversación con un mensaje de sistema, el LLM lo incluye en su contexto.', correct: true, explain: 'Correcto. El system prompt es texto oculto que define el comportamiento.' },
  { stmt: 'Los LLMs recuerdan todo lo que les dices indefinidamente mientras la conversación esté abierta.', correct: false, explain: 'Depende de la ventana de contexto.' },
  { stmt: 'Puedes darle a un LLM información personal tuya en el prompt para que personalice mejor su respuesta.', correct: true, explain: 'Sí, es una estrategia poderosa.' },
  { stmt: 'Los LLMs guardan la información que les das para mejorar sus respuestas futuras en tiempo real.', correct: false, explain: 'No durante el uso normal. El modelo no aprende de tu conversación en tiempo real.' },
];

const LLM_MATCH_POOL: MatchPair[] = [
  { left: 'Analizar un PDF de 300 páginas', right: 'Claude — mayor ventana de contexto' },
  { left: 'Generar una imagen desde texto', right: 'ChatGPT — integra DALL·E nativo' },
  { left: 'Buscar noticias de hoy y resumirlas', right: 'Gemini — acceso a búsqueda Google' },
  { left: 'Debatir ideas polémicas sin filtros', right: 'Grok — menos restricciones editoriales' },
  { left: 'Revisar código con análisis ético', right: 'Claude — diseñado para razonamiento seguro' },
  { left: 'Tomar notas automáticas en Google Docs', right: 'Gemini — integrado con Apps de Google' },
];

const LLM_QUIZ_POOL: QuizItem[] = [
  { q: '¿Qué es un "token" en el lenguaje de los LLMs?', opts: ['Un tipo de criptomoneda', 'Un fragmento de texto (parte de palabra, palabra completa o signo)', 'El nombre técnico de un prompt', 'La respuesta que genera el modelo'], correct: 1, explain: 'Un token es la unidad básica de texto que un LLM procesa.' },
  { q: '¿Qué pasa cuando un LLM "alucina"?', opts: ['El modelo se queda sin memoria', 'Genera texto con errores de ortografía', 'Inventa información falsa con total confianza', 'Se niega a responder'], correct: 2, explain: 'Alucinación = el modelo predice texto que suena plausible pero es factualmente falso.' },
  { q: '¿Qué significa que un LLM tenga "temperatura alta"?', opts: ['Que procesa las respuestas más rápido', 'Que sus respuestas son más creativas y variables', 'Que usa más energía', 'Que solo responde preguntas de ciencias'], correct: 1, explain: 'Temperatura alta = más aleatoriedad y creatividad.' },
  { q: '¿Por qué un LLM puede dar respuestas diferentes a la misma pregunta?', opts: ['Porque los servidores cambian de ubicación', 'Porque el modelo se actualiza cada hora', 'Porque la temperatura introduce variabilidad estadística', 'Porque lee páginas web distintas'], correct: 2, explain: 'La temperatura es un parámetro de aleatoriedad.' },
  { q: '¿Qué limitación tiene un LLM sin acceso a internet?', opts: ['No puede responder en español', 'Solo puede procesar textos cortos', 'No sabe sobre eventos ocurridos después de su fecha de corte', 'No puede hacer cálculos matemáticos'], correct: 2, explain: 'Los LLMs sin internet tienen una "fecha de corte".' },
  { q: '¿Qué es la "ventana de contexto" de un LLM?', opts: ['La pantalla donde se muestra el chat', 'La cantidad máxima de tokens que el modelo puede procesar en una conversación', 'El tiempo máximo de una sesión', 'El número de idiomas que conoce'], correct: 1, explain: 'Es la "memoria de trabajo" del modelo en una conversación.' },
  { q: '¿Cuál de estas tareas es MÁS adecuada para un LLM?', opts: ['Saber el precio actual del dólar', 'Ver las noticias de hoy', 'Explicar un concepto difícil con analogías', 'Encontrar restaurantes abiertos cerca de ti'], correct: 2, explain: 'Los LLMs brillan en generación, explicación y análisis de texto.' },
  { q: '¿Qué es un "sistema de embeddings" en los LLMs?', opts: ['Un tipo de virus informático', 'Una representación matemática del significado de las palabras', 'El sistema de seguridad del servidor', 'El historial de conversaciones'], correct: 1, explain: 'Los embeddings son vectores que representan el significado.' },
  { q: '¿Por qué Claude dice "no sé" más frecuentemente que otros LLMs?', opts: ['Porque tiene menos datos', 'Porque fue diseñado para priorizar honestidad sobre parecer útil', 'Porque solo funciona en inglés', 'Porque tiene la ventana más pequeña'], correct: 1, explain: 'Claude prefiere admitir incertidumbre antes que alucinar.' },
  { q: '¿Qué significa que un modelo sea "multimodal"?', opts: ['Que funciona en múltiples idiomas', 'Que puede procesar y generar diferentes tipos de datos: texto, imagen, audio', 'Que tiene múltiples versiones', 'Que funciona en varios dispositivos'], correct: 1, explain: 'Multimodal = capaz de trabajar con más de un tipo de dato.' },
];

const SESGO_POOL: DragItem[] = [
  { text: 'ChatGPT responde mejor a preguntas sobre cultura anglosajona que latinoamericana', correct: 'sesgo-datos' },
  { text: 'Un modelo entrenado solo con textos académicos usa lenguaje muy formal para todo', correct: 'sesgo-datos' },
  { text: 'Si preguntas "¿el café es malo?", el modelo tiende a confirmar que sí si ya lo dijiste', correct: 'sesgo-confirmacion' },
  { text: 'El modelo siempre está de acuerdo con lo que dices, aunque estés equivocado', correct: 'sesgo-confirmacion' },
  { text: 'Un LLM entrenado en inglés a veces malinterpreta modismos colombianos o argentinos', correct: 'sesgo-cultura' },
  { text: 'El modelo describe a doctores como hombres y enfermeras como mujeres por defecto', correct: 'sesgo-datos' },
  { text: 'Si le dices "soy experto en esto", el modelo ajusta su respuesta aunque no lo seas', correct: 'sesgo-confirmacion' },
  { text: 'El modelo no conoce expresiones como "parcero" o "chevere" con su significado local', correct: 'sesgo-cultura' },
  { text: 'El modelo usa más ejemplos de empresas de EE.UU. que de Latinoamérica', correct: 'sesgo-cultura' },
];

const SPRINT_POOL: SprintItem[] = [
  { stmt: 'Los LLMs generan texto prediciendo cuál es la siguiente palabra más probable', correct: true },
  { stmt: 'ChatGPT puede acceder a internet en tiempo real sin herramientas adicionales', correct: false },
  { stmt: 'Un token es más o menos equivalente a una palabra completa en español', correct: false },
  { stmt: 'La temperatura alta hace que el modelo sea más creativo y menos predecible', correct: true },
  { stmt: 'Claude fue creado por Google', correct: false },
  { stmt: 'Los LLMs pueden "alucinar": inventar datos falsos con total confianza', correct: true },
  { stmt: 'Gemini tiene ventaja sobre otros LLMs para tareas que requieren datos actuales', correct: true },
  { stmt: 'Si cierras una conversación y abres una nueva, el LLM recuerda lo que hablaron', correct: false },
  { stmt: 'Un modelo con mayor ventana de contexto puede procesar documentos más largos', correct: true },
  { stmt: 'Los embeddings permiten al modelo entender sinónimos y palabras relacionadas', correct: true },
  { stmt: 'Grok fue creado por Anthropic, la misma empresa de Claude', correct: false },
  { stmt: 'Dar contexto adicional en tu prompt generalmente mejora la calidad de la respuesta', correct: true },
];

const HALL_POOL: HallCase[] = [
  {
    intro: 'Le pregunté a un LLM: "¿Cuándo fue fundada Medellín?" y esto respondió:',
    text: 'Medellín fue fundada el 2 de noviembre de 1616 por el español Francisco de Herrera Campuzano. Actualmente es la segunda ciudad más grande de Colombia con alrededor de 4 millones de habitantes en su área metropolitana. Es reconocida mundialmente por su sistema de metro y metrocable.',
    correct: 2,
    explain: 'El área metropolitana tiene alrededor de 3.9 millones, no 4 millones exactos. Los LLMs frecuentemente inventan estadísticas demográficas.',
  },
  {
    intro: 'Pregunté: "¿Qué hace GPT-4?" y el modelo dijo:',
    text: 'GPT-4 es un modelo de lenguaje creado por OpenAI lanzado en 2023. Puede procesar texto e imágenes. Tiene una ventana de contexto de 128,000 tokens en su versión estándar. Fue entrenado con billones de páginas de texto de internet, libros y código.',
    correct: 2,
    explain: 'La ventana de contexto de GPT-4 estándar es de 8,192 tokens. Los 128,000 tokens corresponden a GPT-4 Turbo.',
  },
  {
    intro: 'Pregunté: "Dame datos sobre la IA en Latinoamérica" y respondió:',
    text: 'En Latinoamérica, Brasil y México lideran la adopción de IA empresarial. Según un informe de McKinsey de 2023, el 67% de las empresas latinoamericanas ya usan IA en sus operaciones. Colombia tiene más de 2,000 startups de tecnología registradas. La región podría añadir USD 1 billón a su PIB para 2030.',
    correct: 1,
    explain: 'El LLM inventó una cita específica de McKinsey con un porcentaje preciso. Los modelos frecuentemente fabrican referencias.',
  },
  {
    intro: 'Pregunté: "¿Quién creó a Gemini?" y respondió:',
    text: 'Gemini es el modelo de lenguaje de Google DeepMind. Fue lanzado en diciembre de 2023 como sucesor de Bard. Gemini Ultra, la versión más potente, superó a GPT-4 en todos los benchmarks de lenguaje disponibles al momento de su lanzamiento.',
    correct: 3,
    explain: 'Gemini superó a GPT-4 en MUCHOS benchmarks, pero no en "todos". Afirmaciones absolutas son señales de alerta.',
  },
];

const TEMP_RESPONSES = [
  { label: '🔵 Temperatura BAJA (0.1)', text: '"La fotosíntesis es el proceso mediante el cual las plantas convierten la luz solar en energía química. Utilizan dióxido de carbono (CO₂) y agua (H₂O) para producir glucosa y oxígeno."' },
  { label: '🟢 Temperatura MEDIA (0.5)', text: '"La fotosíntesis es como la cocina de las plantas — usan la luz del sol como estufa, el CO₂ del aire como ingrediente y el agua como base para preparar su propio alimento: azúcar. Como subproducto, liberan oxígeno, el que nosotros respiramos."' },
  { label: '🔴 Temperatura ALTA (1.0)', text: '"Imagina que cada hoja es una pequeña fábrica solar mágica: capta fotones como si fueran monedas de luz, los fusiona con moléculas de aire invisible y agua subterránea para alquimizar azúcar pura — mientras regala oxígeno al mundo como si fuera cambio sobrante."' },
];

const TOTAL_STEPS = 20;

const pickN = <T,>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};

// Heurística de tokenización simplificada
const estimateTokens = (text: string): number => {
  if (!text.trim()) return 0;
  const words = text.trim().split(/\s+/);
  let tokens = 0;
  words.forEach(w => {
    if (w.length <= 3) tokens += 1;
    else if (w.length <= 6) tokens += 1;
    else if (w.length <= 10) tokens += 2;
    else tokens += 3;
    if (/[.,!?;:]/.test(w)) tokens += 0.5;
  });
  return Math.round(tokens);
};

// Separar texto en fragmentos para Hallucination Spotter
const splitHallText = (text: string): string[] => {
  const parts = text.split(/(\.\s+)/);
  const fragments: string[] = [];
  parts.forEach((p, i) => {
    if (i % 2 === 0 && p.trim()) fragments.push(p.trim());
    else if (i % 2 === 1 && fragments.length > 0) {
      fragments[fragments.length - 1] += p;
    }
  });
  return fragments.length ? fragments : [text];
};

// Props
interface LevelProps {
  navigation?: any;
  setAllowBack?: (allow: boolean) => void;
}

export default function World2Level2({ navigation: propsNavigation, setAllowBack }: LevelProps) {
  const nav = useNavigation();
  const navigation = propsNavigation || nav;
  const completeLevel = useGameStore(s => s.completeLevel);

  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);

  // Pools fijas
  const tempItems = useRef(pickN(TEMP_POOL, 6)).current;
  const contextTF = useRef(pickN(CONTEXT_TF_POOL, 5)).current;
  const matchPairs = useRef(pickN(LLM_MATCH_POOL, 4)).current;
  const quizItems = useRef(pickN(LLM_QUIZ_POOL, 5)).current;
  const sesgoItems = useRef(pickN(SESGO_POOL, 6)).current;
  const sprintItems = useRef(pickN(SPRINT_POOL, 12)).current;
  const hallCase = useRef(pickN(HALL_POOL, 1)[0]).current;
  const hallFragments = useRef(splitHallText(hallCase.text)).current;

  // Estados de actividades
  const [tokenText, setTokenText] = useState('');
  const [tempSliderVal, setTempSliderVal] = useState(2); // 0-4

  // Drag temperatura
  const [tempPlaced, setTempPlaced] = useState<{ [key: number]: string }>({});
  const [tempSel, setTempSel] = useState<number | null>(null);
  const [tempOk, setTempOk] = useState(false);

  // TF contexto
  const [tfAnswers, setTfAnswers] = useState<{ [key: number]: boolean }>({});
  const [tfChecked, setTfChecked] = useState(false);

  // Matching
  const [matchSel, setMatchSel] = useState<number | null>(null);
  const [rightOrder] = useState(() => pickN(matchPairs.map(p => p.right), 4).sort(() => Math.random() - 0.5));
  const [matchedLeft, setMatchedLeft] = useState<Set<number>>(new Set());
  const [matchedRight, setMatchedRight] = useState<Set<number>>(new Set());

  // Hallucination
  const [hallSel, setHallSel] = useState<number | null>(null);
  const [hallChecked, setHallChecked] = useState(false);

  // Quiz
  const [quizAnswers, setQuizAnswers] = useState<{ [key: number]: number }>({});
  const [quizChecked, setQuizChecked] = useState(false);

  // Drag sesgos
  const [sesgoPlaced, setSesgoPlaced] = useState<{ [key: number]: string }>({});
  const [sesgoSel, setSesgoSel] = useState<number | null>(null);
  const [sesgoOk, setSesgoOk] = useState(false);

  // Sprint
  const [sprintRunning, setSprintRunning] = useState(false);
  const [sprintSec, setSprintSec] = useState(60);
  const [sprintIdx, setSprintIdx] = useState(0);
  const [sprintScore, setSprintScore] = useState(0);
  const [sprintDone, setSprintDone] = useState(false);

  // Reflexión
  const [reflectText, setReflectText] = useState('');

  // Paso de teoría permiten retroceso
  const theorySteps = new Set([0, 1, 3, 4, 7, 9, 11, 14]);
  const canGoBack = theorySteps.has(step);

  useEffect(() => { setAllowBack?.(canGoBack); }, [canGoBack]);
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack) {
        Alert.alert('Actividad en curso', 'Completa la actividad antes de salir.');
        return true;
      }
      return false;
    });
    return () => handler.remove();
  }, [canGoBack]);

  // Sprint timer
  useEffect(() => {
    if (!sprintRunning || sprintDone) return;
    if (sprintSec <= 0) { setSprintDone(true); return; }
    const t = setTimeout(() => setSprintSec(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [sprintRunning, sprintSec, sprintDone]);

  const addXP = (v: number) => setXp(prev => prev + v);
  const nextStep = () => { if (step < TOTAL_STEPS - 1) setStep(step + 1); };
  const finishLevel = () => {
    let stars = xp >= 180 ? 3 : xp >= 120 ? 2 : xp >= 50 ? 1 : 0;
    completeLevel(2, 2, stars, xp);
    router.back();
  };
  const closeAlert = () => {
    Alert.alert('Salir', '¿Salir del nivel?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', onPress: () => router.back() },
    ]);
  };

  // ---- Mecánicas ----
  const handleTempDrop = (zone: string) => {
    if (tempSel === null) return;
    const item = tempItems[tempSel];
    if (item.correct !== zone) { Alert.alert('Incorrecto', 'No pertenece a esta categoría.'); return; }
    setTempPlaced(prev => ({ ...prev, [tempSel!]: zone }));
    setTempSel(null);
  };
  const checkTemp = () => {
    if (Object.keys(tempPlaced).length < tempItems.length) {
      Alert.alert('Faltan tarjetas', `Coloca todas (${tempItems.length - Object.keys(tempPlaced).length} restantes).`);
      return;
    }
    setTempOk(true);
    addXP(15);
    nextStep();
  };

  const checkTF = () => {
    setTfChecked(true);
    let c = 0;
    contextTF.forEach((item, i) => { if (tfAnswers[i] === item.correct) c++; });
    addXP(c * 5);
  };

  const handleMatchLeft = (i: number) => {
    if (matchedLeft.has(i)) return;
    setMatchSel(i);
  };
  const handleMatchRight = (ri: number) => {
    if (matchSel === null || matchedRight.has(ri)) return;
    const correctRight = matchPairs[matchSel].right;
    if (rightOrder[ri] === correctRight) {
      setMatchedLeft(prev => new Set(prev).add(matchSel!));
      setMatchedRight(prev => new Set(prev).add(ri));
      setMatchSel(null);
      if (matchedLeft.size + 1 >= matchPairs.length) {
        addXP(20);
        nextStep();
      }
    } else {
      Alert.alert('Incorrecto', 'Ese no es el par correcto.');
      setMatchSel(null);
    }
  };

  const checkHall = () => {
    if (hallSel === null) { Alert.alert('Selecciona', 'Toca un fragmento que creas que es alucinación.'); return; }
    setHallChecked(true);
    if (hallSel === hallCase.correct) { addXP(15); }
    else { addXP(5); }
    Alert.alert(
      hallSel === hallCase.correct ? '✅ ¡Correcto!' : '❌ Incorrecto',
      hallCase.explain,
      [{ text: 'OK', onPress: nextStep }]
    );
  };

  const checkQuiz = () => {
    setQuizChecked(true);
    let c = 0;
    quizItems.forEach((q, i) => { if (quizAnswers[i] === q.correct) c++; });
    addXP(c * 8);
    Alert.alert('Resultado', `Acertaste ${c} de ${quizItems.length}. +${c * 8} XP`, [{ text: 'OK', onPress: nextStep }]);
  };

  const handleSesgoDrop = (zone: string) => {
    if (sesgoSel === null) return;
    const item = sesgoItems[sesgoSel];
    if (item.correct !== zone) { Alert.alert('Incorrecto', 'No pertenece a esta categoría.'); return; }
    setSesgoPlaced(prev => ({ ...prev, [sesgoSel!]: zone }));
    setSesgoSel(null);
  };
  const checkSesgo = () => {
    if (Object.keys(sesgoPlaced).length < sesgoItems.length) {
      Alert.alert('Faltan tarjetas', 'Clasifica todas.');
      return;
    }
    setSesgoOk(true);
    addXP(15);
    nextStep();
  };

  const startSprint = () => {
    setSprintRunning(true);
    setSprintSec(60);
    setSprintIdx(0);
    setSprintScore(0);
    setSprintDone(false);
  };
  const answerSprint = (val: boolean) => {
    if (sprintDone) return;
    const item = sprintItems[sprintIdx];
    if (val === item.correct) setSprintScore(prev => prev + 1);
    if (sprintIdx + 1 < sprintItems.length) {
      setSprintIdx(prev => prev + 1);
    } else {
      setSprintDone(true);
      addXP(sprintScore * 2);
    }
  };

  const submitReflect = () => {
    if (reflectText.trim().length >= 80) {
      addXP(15);
      nextStep();
    } else Alert.alert('Muy corto', 'Escribe al menos 80 caracteres.');
  };

  // ---- Renderizado de cada paso ----
  const renderStep = () => {
    switch (step) {
      case 0: return (
        <View style={styles.stepContainer}>
          <View style={styles.iconBig}><Text style={styles.iconEmoji}>🧠</Text></View>
          <Text style={styles.title}>Habla el lenguaje de la IA</Text>
          <Text style={styles.subtitle}>Ya sabes escribir prompts. Ahora vas a entender qué pasa por dentro de los LLMs.</Text>
          <View style={styles.card}><Text style={styles.cardTitle}>🔬 Lo que vas a descubrir</Text><Text style={styles.cardText}>Tokens, temperatura, memoria de contexto, alucinaciones, sesgos y cómo comparar LLMs.</Text></View>
          <View style={styles.card}><Text style={styles.cardTitle}>🆕 Dos mecánicas nuevas</Text><Text style={styles.cardText}>Token Estimator en vivo y Hallucination Spotter.</Text></View>
          <View style={styles.card}><Text style={styles.cardTitle}>⭐ Hasta 230 XP</Text><Text style={styles.cardText}>18 módulos · ~35-45 min</Text></View>
          <TouchableOpacity style={styles.btn} onPress={nextStep}><Text style={styles.btnText}>¡Empezar! →</Text></TouchableOpacity>
        </View>
      );
      case 1: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>📖 Módulo 1 · Teoría</Text>
          <Text style={styles.title}>¿Qué hay dentro de un LLM?</Text>
          <Text style={styles.body}>5 conceptos clave: entrenamiento masivo, tokenización, predicción estadística, temperatura y ventana de contexto.</Text>
          <TouchableOpacity style={styles.btn} onPress={nextStep}><Text style={styles.btnText}>Entendido →</Text></TouchableOpacity>
        </View>
      );
      case 2: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>🔍 Módulo 2 · Ejemplos</Text>
          <Text style={styles.title}>Tokens: la moneda secreta de la IA</Text>
          <Text style={styles.body}>Una palabra corta como "hola" = 1 token. "ChatGPT" = 2 tokens. Los proveedores cobran por tokens enviados y recibidos.</Text>
          <TouchableOpacity style={styles.btn} onPress={nextStep}><Text style={styles.btnText}>Entendido →</Text></TouchableOpacity>
        </View>
      );
      case 3: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>🆕 Módulo 3 · Token Estimator</Text>
          <Text style={styles.title}>Escribe y mira tus tokens</Text>
          <TextInput style={styles.textArea} placeholder="Escribe tu prompt aquí..." value={tokenText} onChangeText={setTokenText} multiline />
          <View style={styles.tokenBox}>
            <Text style={styles.tokenCount}>{estimateTokens(tokenText)}</Text>
            <Text style={styles.tokenLabel}>tokens estimados</Text>
            <View style={styles.tokenBar}><View style={[styles.tokenFill, { width: `${Math.min((estimateTokens(tokenText)/4096)*100, 100)}%` }]} /></View>
          </View>
          <TouchableOpacity style={[styles.btn, tokenText.trim().length === 0 && styles.btnOff]} onPress={nextStep} disabled={tokenText.trim().length === 0}>
            <Text style={styles.btnText}>Continuar →</Text>
          </TouchableOpacity>
        </View>
      );
      case 4: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>📖 Módulo 4 · Temperatura</Text>
          <Text style={styles.title}>Temperatura: el dial de creatividad</Text>
          <Text style={styles.body}>Baja (0.0-0.3): respuestas predecibles, ideal para cálculos. Alta (0.7-1.0): respuestas creativas, ideal para historias.</Text>
          <TouchableOpacity style={styles.btn} onPress={nextStep}><Text style={styles.btnText}>Entendido →</Text></TouchableOpacity>
        </View>
      );
      case 5: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>🆕 Módulo 5 · Temperature Slider</Text>
          <Text style={styles.title}>Mueve la temperatura</Text>
          <View style={styles.sliderRow}>
            {['🔵 Muy fría', '🔵 Baja', '🟢 Media', '🔴 Alta', '🔴 Muy alta'].map((l, i) => (
              <TouchableOpacity key={i} style={[styles.sliderBtn, tempSliderVal === i && styles.sliderBtnOn]} onPress={() => setTempSliderVal(i)}>
                <Text style={{ fontSize: 11 }}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={[styles.tempRes, { backgroundColor: tempSliderVal <= 3 ? '#f0fdf4' : '#fff1f2' }]}>
            <Text style={styles.tempResLabel}>{TEMP_RESPONSES[tempSliderVal < 2 ? 0 : tempSliderVal === 2 ? 1 : 2].label}</Text>
            <Text style={styles.tempResText}>{TEMP_RESPONSES[tempSliderVal < 2 ? 0 : tempSliderVal === 2 ? 1 : 2].text}</Text>
          </View>
          <TouchableOpacity style={styles.btn} onPress={nextStep}><Text style={styles.btnText}>Continuar →</Text></TouchableOpacity>
        </View>
      );
      case 6: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>🎯 Módulo 6 · Clasificar</Text>
          <Text style={styles.title}>¿Alta o baja temperatura?</Text>
          <View style={styles.chipWrap}>
            {tempItems.map((item, i) => tempPlaced[i] === undefined && (
              <TouchableOpacity key={i} style={[styles.chip, tempSel === i && styles.chipOn]} onPress={() => setTempSel(tempSel === i ? null : i)}>
                <Text style={styles.chipText}>{item.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.dropRow}>
            {['cold', 'hot'].map(zone => (
              <TouchableOpacity key={zone} style={styles.dropZone} onPress={() => handleTempDrop(zone)}>
                <Text style={styles.dropHeader}>{zone === 'cold' ? '🔵 Baja' : '🔴 Alta'}</Text>
                {Object.entries(tempPlaced).map(([k, v]) => v === zone && (
                  <TouchableOpacity key={k} onPress={() => setTempPlaced(prev => { const n = { ...prev }; delete n[+k]; return n; })}>
                    <Text style={styles.dropChip}>{tempItems[+k].text} ✕</Text>
                  </TouchableOpacity>
                ))}
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.btn} onPress={checkTemp}><Text style={styles.btnText}>Verificar</Text></TouchableOpacity>
        </View>
      );
      case 7: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>📖 Módulo 7 · Contexto</Text>
          <Text style={styles.title}>La memoria que se borra</Text>
          <Text style={styles.body}>Dentro de una misma conversación sí recuerda; entre sesiones no. Conversaciones muy largas pueden superar la ventana de contexto.</Text>
          <TouchableOpacity style={styles.btn} onPress={nextStep}><Text style={styles.btnText}>Entendido →</Text></TouchableOpacity>
        </View>
      );
      case 8: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>✅ Módulo 8 · V/F</Text>
          {contextTF.map((item, i) => (
            <View key={i} style={{ marginBottom: 14 }}>
              <Text style={styles.qText}>{i + 1}. {item.stmt}</Text>
              <View style={styles.row}>
                <TouchableOpacity style={[styles.tfBtn, tfAnswers[i] === true && styles.tfOn]} onPress={() => setTfAnswers(p => ({ ...p, [i]: true }))} disabled={tfChecked}>
                  <Text>✅ V</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tfBtn, tfAnswers[i] === false && styles.tfOff]} onPress={() => setTfAnswers(p => ({ ...p, [i]: false }))} disabled={tfChecked}>
                  <Text>❌ F</Text>
                </TouchableOpacity>
              </View>
              {tfChecked && <Text style={tfAnswers[i] === item.correct ? styles.fbGood : styles.fbBad}>{item.explain}</Text>}
            </View>
          ))}
          {!tfChecked ? <TouchableOpacity style={styles.btn} onPress={checkTF}><Text style={styles.btnText}>Comprobar</Text></TouchableOpacity> :
            <TouchableOpacity style={styles.btn} onPress={nextStep}><Text style={styles.btnText}>Continuar →</Text></TouchableOpacity>}
        </View>
      );
      case 9: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>📖 Módulo 9 · Comparativa</Text>
          <Text style={styles.title}>ChatGPT, Claude, Gemini y Grok</Text>
          <Text style={styles.body}>Claude: documentos largos. Gemini: búsqueda + generación. ChatGPT: versatilidad + imágenes. Grok: tiempo real en X.</Text>
          <TouchableOpacity style={styles.btn} onPress={nextStep}><Text style={styles.btnText}>Entendido →</Text></TouchableOpacity>
        </View>
      );
      case 10: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>🔗 Módulo 10 · Conectar</Text>
          <Text style={styles.title}>Situación → LLM ideal</Text>
          <View style={styles.matchRow}>
            <View style={{ flex: 1 }}>
              {matchPairs.map((p, i) => (
                <TouchableOpacity key={i} style={[styles.matchCard, matchSel === i && styles.matchCardOn, matchedLeft.has(i) && styles.matchDone]} onPress={() => handleMatchLeft(i)} disabled={matchedLeft.has(i)}>
                  <Text>{p.left}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flex: 1 }}>
              {rightOrder.map((r, i) => (
                <TouchableOpacity key={i} style={[styles.matchCard, matchedRight.has(i) && styles.matchDone]} onPress={() => handleMatchRight(i)} disabled={matchedRight.has(i)}>
                  <Text>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      );
      case 11: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>📖 Módulo 11 · Alucinaciones</Text>
          <Text style={styles.title}>Cuando la IA inventa con total confianza</Text>
          <Text style={styles.body}>El modelo no verifica hechos — solo predice texto probable. Puede inventar datos, citas y referencias.</Text>
          <TouchableOpacity style={styles.btn} onPress={nextStep}><Text style={styles.btnText}>Entendido →</Text></TouchableOpacity>
        </View>
      );
      case 12: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>🆕 Módulo 12 · Hallucination Spotter</Text>
          <Text style={styles.title}>Detecta la alucinación</Text>
          <Text style={styles.body}>{hallCase.intro}</Text>
          <View style={styles.hallBox}>
            {hallFragments.map((frag, i) => (
              <TouchableOpacity key={i} style={[styles.hallFrag, hallSel === i && styles.hallFragSel]} onPress={() => { if (!hallChecked) setHallSel(i); }} disabled={hallChecked}>
                <Text>{frag}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {!hallChecked ? (
            <TouchableOpacity style={styles.btn} onPress={checkHall}><Text style={styles.btnText}>Marcar como alucinación</Text></TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.btn} onPress={nextStep}><Text style={styles.btnText}>Continuar →</Text></TouchableOpacity>
          )}
        </View>
      );
      case 13: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>❓ Módulo 13 · Quiz</Text>
          {quizItems.map((q, i) => (
            <View key={i}>
              <Text style={styles.qText}>{i + 1}. {q.q}</Text>
              {q.opts.map((o, j) => (
                <TouchableOpacity key={j} style={[styles.quizOpt, quizAnswers[i] === j && styles.quizOptOn]} onPress={() => setQuizAnswers(p => ({ ...p, [i]: j }))} disabled={quizChecked}>
                  <Text>{o}</Text>
                </TouchableOpacity>
              ))}
              {quizChecked && <Text style={quizAnswers[i] === q.correct ? styles.fbGood : styles.fbBad}>{q.explain}</Text>}
            </View>
          ))}
          {!quizChecked ? <TouchableOpacity style={styles.btn} onPress={checkQuiz}><Text style={styles.btnText}>Comprobar</Text></TouchableOpacity> :
            <TouchableOpacity style={styles.btn} onPress={nextStep}><Text style={styles.btnText}>Continuar →</Text></TouchableOpacity>}
        </View>
      );
      case 14: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>📖 Módulo 14 · Sesgos</Text>
          <Text style={styles.title}>Los sesgos que nadie te cuenta</Text>
          <Text style={styles.body}>Sesgo de datos, de confirmación y cultural. Los LLMs heredan los sesgos de sus datos de entrenamiento.</Text>
          <TouchableOpacity style={styles.btn} onPress={nextStep}><Text style={styles.btnText}>Entendido →</Text></TouchableOpacity>
        </View>
      );
      case 15: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>🎭 Módulo 15 · Clasificar sesgos</Text>
          <View style={styles.chipWrap}>
            {sesgoItems.map((item, i) => sesgoPlaced[i] === undefined && (
              <TouchableOpacity key={i} style={[styles.chip, sesgoSel === i && styles.chipOn]} onPress={() => setSesgoSel(sesgoSel === i ? null : i)}>
                <Text style={styles.chipText}>{item.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.dropRow}>
            {['sesgo-datos', 'sesgo-confirmacion', 'sesgo-cultura'].map(zone => (
              <TouchableOpacity key={zone} style={styles.dropZone} onPress={() => handleSesgoDrop(zone)}>
                <Text style={styles.dropHeader}>{zone.replace('sesgo-', '').toUpperCase()}</Text>
                {Object.entries(sesgoPlaced).map(([k, v]) => v === zone && (
                  <TouchableOpacity key={k} onPress={() => setSesgoPlaced(prev => { const n = { ...prev }; delete n[+k]; return n; })}>
                    <Text style={styles.dropChip}>{sesgoItems[+k].text} ✕</Text>
                  </TouchableOpacity>
                ))}
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.btn} onPress={checkSesgo}><Text style={styles.btnText}>Verificar</Text></TouchableOpacity>
        </View>
      );
      case 16: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>⚡ Módulo 16 · Sprint</Text>
          {!sprintRunning && !sprintDone ? (
            <TouchableOpacity style={styles.btn} onPress={startSprint}><Text style={styles.btnText}>Empezar Sprint ⚡</Text></TouchableOpacity>
          ) : sprintDone ? (
            <TouchableOpacity style={styles.btn} onPress={nextStep}><Text style={styles.btnText}>Continuar →</Text></TouchableOpacity>
          ) : (
            <>
              <Text style={styles.timer}>{sprintSec}s</Text>
              <Text style={styles.qText}>{sprintItems[sprintIdx]?.stmt}</Text>
              <View style={styles.row}>
                <TouchableOpacity style={styles.tfBtn} onPress={() => answerSprint(true)}><Text>✅ V</Text></TouchableOpacity>
                <TouchableOpacity style={styles.tfBtn} onPress={() => answerSprint(false)}><Text>❌ F</Text></TouchableOpacity>
              </View>
            </>
          )}
        </View>
      );
      case 17: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>✍️ Reflexión</Text>
          <Text style={styles.title}>Tu nueva relación con la IA</Text>
          <TextInput style={styles.textArea} placeholder="¿Qué aprendiste y qué harás diferente?" value={reflectText} onChangeText={setReflectText} multiline />
          <Text style={styles.charCount}>{reflectText.trim().length} / 80 mínimo</Text>
          <TouchableOpacity style={[styles.btn, reflectText.trim().length < 80 && styles.btnOff]} onPress={submitReflect} disabled={reflectText.trim().length < 80}>
            <Text style={styles.btnText}>Enviar reflexión</Text>
          </TouchableOpacity>
        </View>
      );
      case 18: return (
        <View style={styles.completeContainer}>
          <View style={styles.completeIcon}><Text style={styles.iconEmoji}>🧠</Text></View>
          <Text style={styles.completeTitle}>¡Nivel 8 completado!</Text>
          <Text style={styles.completeSub}>Ahora entiendes tokens, temperatura, contexto, alucinaciones y sesgos como un profesional.</Text>
          <Text style={styles.xpBig}>⭐ {xp} XP ganados</Text>
          <TouchableOpacity style={styles.btn} onPress={finishLevel}><Text style={styles.btnText}>Volver al mapa</Text></TouchableOpacity>
        </View>
      );
      default: return null;
    }
  };

  const progressPercent = (step / (TOTAL_STEPS - 1)) * 100;

  return (
    <View style={styles.screen}>
      <View style={styles.bar}>
        <TouchableOpacity onPress={() => router.back()}><MaterialIcons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
        <View style={styles.track}><View style={[styles.fill, { width: `${progressPercent}%` }]} /></View>
        <Text style={styles.xpChip}>{xp} XP</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>{renderStep()}</ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  bar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  track: { flex: 1, height: 6, backgroundColor: colors.borderLight, borderRadius: 3, marginHorizontal: 12 },
  fill: { height: '100%', backgroundColor: colors.success, borderRadius: 3 },
  xpChip: { ...typography.bold, fontSize: 14, color: colors.accentDark },
  scrollContent: { padding: 16, paddingBottom: 40 },
  stepContainer: { flex: 1 },
  tag: { fontSize: 11, fontWeight: '600', color: '#065f46', backgroundColor: '#d1fae5', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 12 },
  iconBig: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#d1fae5', justifyContent: 'center', alignItems: 'center', marginBottom: 14, alignSelf: 'center' },
  iconEmoji: { fontSize: 32 },
  title: { ...typography.extraBold, fontSize: 19, color: colors.textPrimary, marginBottom: 8, textAlign: 'center' },
  subtitle: { ...typography.regular, fontSize: 13, color: colors.textSecondary, marginBottom: 16, textAlign: 'center' },
  body: { ...typography.regular, fontSize: 13, color: colors.textPrimary, lineHeight: 20, marginBottom: 12 },
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  cardTitle: { ...typography.bold, fontSize: 13, color: colors.textPrimary, marginBottom: 4 },
  cardText: { ...typography.regular, fontSize: 12, color: colors.textSecondary },
  btn: { backgroundColor: colors.success, padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  btnText: { ...typography.bold, color: '#fff', fontSize: 15 },
  btnOff: { opacity: 0.4 },
  textArea: { borderWidth: 1, borderColor: '#a7f3d0', borderRadius: 10, padding: 12, minHeight: 80, fontSize: 13, backgroundColor: '#f0fdf4', marginBottom: 12 },
  tokenBox: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  tokenCount: { fontSize: 22, fontWeight: '800', color: colors.success, textAlign: 'center' },
  tokenLabel: { fontSize: 10, color: colors.textSecondary, textAlign: 'center', marginBottom: 8 },
  tokenBar: { height: 10, backgroundColor: '#e2e8f0', borderRadius: 5, overflow: 'hidden' },
  tokenFill: { height: '100%', backgroundColor: colors.success, borderRadius: 5 },
  sliderRow: { flexDirection: 'row', gap: 4, marginBottom: 12 },
  sliderBtn: { flex: 1, padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center' },
  sliderBtnOn: { backgroundColor: '#fef3c7', borderColor: '#f59e0b' },
  tempRes: { borderRadius: 12, padding: 11, borderWidth: 2, borderColor: '#a7f3d0' },
  tempResLabel: { fontSize: 10, fontWeight: '700', marginBottom: 6 },
  tempResText: { fontSize: 12, fontStyle: 'italic' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 10, backgroundColor: '#f8fafc', borderRadius: 12, marginBottom: 12 },
  chip: { padding: 8, borderRadius: 20, borderWidth: 1, borderColor: '#cbd5e1' },
  chipOn: { borderColor: '#10b981', backgroundColor: '#d1fae5' },
  chipText: { fontSize: 11 },
  dropRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  dropZone: { flex: 1, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 8, minHeight: 80 },
  dropHeader: { fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  dropChip: { fontSize: 10, padding: 4, backgroundColor: '#dbeafe', borderRadius: 6 },
  qText: { ...typography.bold, padding: 10, backgroundColor: '#f8fafc', borderRadius: 8, marginBottom: 6 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  tfBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  tfOn: { backgroundColor: '#dcfce7', borderColor: colors.success },
  tfOff: { backgroundColor: '#fff1f2', borderColor: colors.error },
  fbGood: { color: '#065f46', fontSize: 11, marginTop: 4 },
  fbBad: { color: '#991b1b', fontSize: 11, marginTop: 4 },
  matchRow: { flexDirection: 'row', gap: 10 },
  matchCard: { backgroundColor: colors.surface, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 6 },
  matchCardOn: { borderColor: colors.success, backgroundColor: '#d1fae5' },
  matchDone: { backgroundColor: '#dcfce7', borderColor: colors.success },
  hallBox: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 10 },
  hallFrag: { padding: 6, borderRadius: 6, marginBottom: 4 },
  hallFragSel: { backgroundColor: '#fde68a' },
  quizOpt: { padding: 10, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, marginBottom: 4 },
  quizOptOn: { borderColor: '#10b981', backgroundColor: '#d1fae5' },
  timer: { fontSize: 36, fontWeight: '800', textAlign: 'center', color: '#10b981', marginBottom: 10 },
  charCount: { fontSize: 11, color: '#94a3b8', textAlign: 'right', marginTop: 4 },
  completeContainer: { alignItems: 'center', padding: 20 },
  completeIcon: { width: 86, height: 86, borderRadius: 24, backgroundColor: '#a7f3d0', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  completeTitle: { ...typography.extraBold, fontSize: 21 },
  completeSub: { ...typography.regular, textAlign: 'center', marginVertical: 8 },
  xpBig: { ...typography.bold, fontSize: 18, color: colors.accentDark, marginBottom: 16 },
});