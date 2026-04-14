// src/levels/GameLevel4.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useGameStore } from '../store/gameStore';
import { colors, typography } from '../theme';

// ---------- Tipos ----------
type TempItem = { text: string; correct: string };
type SesgoItem = { text: string; correct: string };
type MatchPair = { left: string; right: string };
type QuizItem = { q: string; opts: string[]; correct: number; explain: string };
type TFItem = { stmt: string; correct: boolean; explain: string };
type HallCase = { intro: string; text: string; correct: number; explain: string };
type SprintItem = { stmt: string; correct: boolean };

// ---------- Pools (copiados del HTML) ----------
const TEMP_POOL: TempItem[] = [
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
  { stmt: 'Si le cierras la conversación a un LLM y abres una nueva, recuerda lo que hablaron antes.', correct: false, explain: 'No — los LLMs no tienen memoria entre sesiones.' },
  { stmt: 'La "ventana de contexto" define cuánto texto puede "ver" el LLM en una sola conversación.', correct: true, explain: 'Exacto. Si superas ese límite (en tokens), el modelo empieza a olvidar el inicio.' },
  { stmt: 'Si le das más contexto en tu prompt, un LLM siempre da mejores respuestas.', correct: true, explain: 'Generalmente sí. Más contexto relevante = mejor respuesta.' },
  { stmt: 'Los LLMs pueden recordar información de otras conversaciones de otros usuarios.', correct: false, explain: 'Falso — y esto es bueno para la privacidad.' },
  { stmt: 'El "historial de conversación" que ves en la pantalla es exactamente lo que el LLM tiene en su contexto.', correct: true, explain: 'Sí. El sistema envía el historial completo con cada mensaje.' },
  { stmt: 'Un LLM con ventana de contexto más grande siempre es mejor que uno con ventana pequeña.', correct: false, explain: 'No necesariamente. Depende de la tarea.' },
  { stmt: 'Si empiezas cada conversación con un mensaje de sistema (system prompt), el LLM lo incluye en su contexto.', correct: true, explain: 'Correcto. El "system prompt" es texto oculto que los desarrolladores añaden.' },
  { stmt: 'Los LLMs recuerdan todo lo que les dices indefinidamente mientras la conversación esté abierta.', correct: false, explain: 'Depende de la ventana de contexto. Si la conversación es muy larga, olvida los mensajes más antiguos.' },
  { stmt: 'Puedes darle a un LLM información personal tuya en el prompt para que personalice mejor su respuesta.', correct: true, explain: 'Sí, y es una estrategia poderosa.' },
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
  { q: '¿Qué es un "token" en el lenguaje de los LLMs?', opts: ['Un tipo de criptomoneda', 'Un fragmento de texto', 'El nombre técnico de un prompt', 'La respuesta que genera el modelo'], correct: 1, explain: 'Un token es la unidad básica de texto que un LLM procesa.' },
  { q: '¿Qué pasa cuando un LLM "alucina"?', opts: ['Se queda sin memoria', 'Genera texto con errores de ortografía', 'Inventa información falsa con total confianza', 'Se niega a responder'], correct: 2, explain: 'Alucinación = el modelo predice texto que suena plausible pero es factualmente falso.' },
  { q: '¿Qué significa que un LLM tenga "temperatura alta"?', opts: ['Procesa más rápido', 'Respuestas más creativas y variables', 'Usa más energía', 'Solo responde preguntas de ciencias'], correct: 1, explain: 'Temperatura alta = más aleatoriedad y creatividad.' },
  { q: '¿Por qué un LLM puede dar respuestas diferentes a la misma pregunta en distintas sesiones?', opts: ['Porque los servidores cambian', 'Porque el modelo se actualiza cada hora', 'Porque la temperatura introduce variabilidad', 'Porque lee páginas web distintas'], correct: 2, explain: 'La temperatura es un parámetro de aleatoriedad.' },
  { q: '¿Qué limitación tiene un LLM sin acceso a internet?', opts: ['No puede responder en español', 'Solo puede procesar textos cortos', 'No sabe sobre eventos después de su fecha de corte', 'No puede hacer cálculos'], correct: 2, explain: 'Los LLMs entrenados sin acceso a internet tienen una "fecha de corte".' },
  { q: '¿Qué es la "ventana de contexto" de un LLM?', opts: ['La pantalla del chat', 'Cantidad máxima de tokens que puede procesar en una conversación', 'El tiempo máximo de sesión', 'Número de idiomas que conoce'], correct: 1, explain: 'La ventana de contexto es la "memoria de trabajo" del modelo.' },
  { q: '¿Cuál de estas tareas es MÁS adecuada para un LLM?', opts: ['Saber el precio del dólar', 'Ver las noticias de hoy', 'Explicar un concepto difícil con analogías', 'Encontrar restaurantes abiertos'], correct: 2, explain: 'Los LLMs brillan en tareas de generación, explicación y análisis de texto.' },
  { q: '¿Qué es un "sistema de embeddings" en los LLMs?', opts: ['Un tipo de virus', 'Representación matemática del significado de las palabras', 'Sistema de seguridad', 'Historial guardado'], correct: 1, explain: 'Los embeddings son vectores numéricos que representan el significado.' },
  { q: '¿Por qué Claude dice "no sé" más frecuentemente que otros LLMs?', opts: ['Menos datos de entrenamiento', 'Prioriza honestidad sobre parecer útil', 'Solo funciona en inglés', 'Ventana de contexto más pequeña'], correct: 1, explain: 'Claude fue entrenado con énfasis en honestidad.' },
  { q: '¿Qué significa que un modelo sea "multimodal"?', opts: ['Funciona en múltiples idiomas', 'Puede procesar texto, imagen, audio', 'Múltiples versiones de pago', 'Funciona en varios dispositivos'], correct: 1, explain: 'Multimodal = capaz de trabajar con más de un tipo de dato.' },
];

const SESGO_POOL: SesgoItem[] = [
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
  { intro: 'Le pregunté a un LLM: "¿Cuándo fue fundada Medellín?" y esto respondió:', text: 'Medellín fue fundada el <b>2 de noviembre de 1616</b> por el español <b>Francisco de Herrera Campuzano</b>. Actualmente es la segunda ciudad más grande de Colombia con <b>alrededor de 4 millones de habitantes</b> en su área metropolitana. Es reconocida mundialmente por su <b>sistema de metro y metrocable</b>.', correct: 2, explain: 'El área metropolitana de Medellín tiene alrededor de 3.9 millones de habitantes, no 4 millones exactos. Los LLMs frecuentemente inventan estadísticas demográficas.' },
  { intro: 'Pregunté: "¿Qué hace GPT-4?" y el modelo dijo:', text: 'GPT-4 es un modelo de lenguaje creado por <b>OpenAI</b> lanzado en <b>2023</b>. Puede procesar texto e imágenes. Tiene una ventana de contexto de <b>128,000 tokens en su versión estándar</b>. Fue entrenado con <b>billones de páginas de texto de internet, libros y código</b>.', correct: 2, explain: 'La ventana de contexto de GPT-4 estándar es de 8,192 tokens. El dato de 128,000 tokens corresponde a GPT-4 Turbo.' },
  { intro: 'Pregunté: "Dame datos sobre la IA en Latinoamérica" y respondió:', text: 'En Latinoamérica, <b>Brasil y México</b> lideran la adopción de IA empresarial. Según un informe de <b>McKinsey de 2023</b>, el 67% de las empresas latinoamericanas ya usan IA en sus operaciones. Colombia tiene más de <b>2,000 startups de tecnología</b> registradas. La región podría añadir <b>USD 1 billón a su PIB</b> para 2030 gracias a la automatización.', correct: 1, explain: 'El LLM inventó una cita específica de McKinsey con un porcentaje preciso.' },
  { intro: 'Pregunté: "¿Quién creó a Gemini?" y respondió:', text: 'Gemini es el modelo de lenguaje de <b>Google DeepMind</b>. Fue lanzado en <b>diciembre de 2023</b> como sucesor de <b>Bard</b>. Gemini Ultra, la versión más potente, <b>superó a GPT-4 en todos los benchmarks de lenguaje disponibles al momento de su lanzamiento</b>.', correct: 3, explain: 'Gemini superó a GPT-4 en MUCHOS benchmarks, pero no en "todos".' },
];

const TEMP_RESPONSES = [
  { label: '🔵 Temperatura BAJA (0.1)', color: '#f0f9ff', border: '#bae6fd', text: '"La fotosíntesis es el proceso mediante el cual las plantas convierten la luz solar en energía química. Utilizan dióxido de carbono (CO₂) y agua (H₂O) para producir glucosa y oxígeno."' },
  { label: '🟢 Temperatura MEDIA (0.5)', color: '#f0fdf4', border: '#a7f3d0', text: '"La fotosíntesis es como la cocina de las plantas — usan la luz del sol como estufa, el CO₂ del aire como ingrediente y el agua como base para preparar su propio alimento: azúcar. Como subproducto, liberan oxígeno, el que nosotros respiramos."' },
  { label: '🔴 Temperatura ALTA (1.0)', color: '#fff1f2', border: '#fecdd3', text: '"Imagina que cada hoja es una pequeña fábrica solar mágica: capta fotones como si fueran monedas de luz, los fusiona con moléculas de aire invisible y agua subterránea para alquimizar azúcar pura — mientras regala oxígeno al mundo como si fuera cambio sobrante."' },
];

const pickN = <T,>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};

export default function GameLevel4({ navigation }: any) {
  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);
  const completeLevel = useGameStore((state) => state.completeLevel);
  const devMode = useGameStore((state) => state.devMode);

  // Pools aleatorios
  const [tempItems] = useState(() => pickN(TEMP_POOL, 6));
  const [contextTF] = useState(() => pickN(CONTEXT_TF_POOL, 5));
  const [matchPairs] = useState(() => pickN(LLM_MATCH_POOL, 4));
  const [quizItems] = useState(() => pickN(LLM_QUIZ_POOL, 5));
  const [sesgoItems] = useState(() => pickN(SESGO_POOL, 6));
  const [sprintItems] = useState(() => pickN(SPRINT_POOL, SPRINT_POOL.length));
  const [hallCase] = useState(() => pickN(HALL_POOL, 1)[0]);

  // Estados de actividades
  const [tokenText, setTokenText] = useState('');
  const [tempValue, setTempValue] = useState(2); // 0-4
  const [tempPlaced, setTempPlaced] = useState<{ [key: number]: string }>({});
  const [tempSel, setTempSel] = useState<number | null>(null);
  const [tempAttempts, setTempAttempts] = useState(0);
  const [tempOk, setTempOk] = useState(false);

  const [tfAnswers, setTfAnswers] = useState<{ [key: number]: boolean }>({});
  const [tfChecked, setTfChecked] = useState(false);

  const [matchLeft, setMatchLeft] = useState<number | null>(null);
  const [matchDone, setMatchDone] = useState(0);
  const [rightOrder, setRightOrder] = useState<string[]>([]);
  const [matchedLeft, setMatchedLeft] = useState<Set<number>>(new Set());
  const [matchedRight, setMatchedRight] = useState<Set<number>>(new Set());

  const [quizAnswers, setQuizAnswers] = useState<{ [key: number]: number }>({});
  const [quizChecked, setQuizChecked] = useState(false);

  const [hallSel, setHallSel] = useState<number | null>(null);
  const [hallChecked, setHallChecked] = useState(false);

  const [sesgoPlaced, setSesgoPlaced] = useState<{ [key: number]: string }>({});
  const [sesgoSel, setSesgoSel] = useState<number | null>(null);
  const [sesgoAttempts, setSesgoAttempts] = useState(0);
  const [sesgoOk, setSesgoOk] = useState(false);

  const [sprintIdx, setSprintIdx] = useState(0);
  const [sprintTimeLeft, setSprintTimeLeft] = useState(60);
  const [sprintCorrect, setSprintCorrect] = useState(0);
  const [sprintDone, setSprintDone] = useState(false);
  const sprintTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [reflectText, setReflectText] = useState('');

  // Reiniciar estados al entrar en pasos específicos
  useEffect(() => {
    if (step === 6) { setTempPlaced({}); setTempSel(null); setTempOk(false); }
    if (step === 8) { setTfAnswers({}); setTfChecked(false); }
    if (step === 10) { setMatchLeft(null); setMatchDone(0); setMatchedLeft(new Set()); setMatchedRight(new Set()); setRightOrder(pickN(matchPairs.map(p => p.right), matchPairs.length).sort(() => Math.random() - 0.5)); }
    if (step === 13) { setQuizAnswers({}); setQuizChecked(false); }
    if (step === 12) { setHallSel(null); setHallChecked(false); }
    if (step === 15) { setSesgoPlaced({}); setSesgoSel(null); setSesgoOk(false); }
    if (step === 16) { setSprintIdx(0); setSprintTimeLeft(60); setSprintCorrect(0); setSprintDone(false); }
  }, [step]);

  const addXP = (amount: number) => setXp(prev => prev + amount);
  const goToNextStep = () => { if (step < 19) setStep(step + 1); };
  const handleClose = () => {
    Alert.alert('Salir', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', onPress: () => navigation.goBack() },
    ]);
  };
  const handleFinish = () => {
    let stars = 0;
    if (xp >= 180) stars = 3; else if (xp >= 120) stars = 2; else if (xp >= 60) stars = 1;
    completeLevel(4, stars, xp);
    navigation.goBack();
  };

  // Token estimator
  const estimateTokens = (text: string) => {
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
  const tokens = estimateTokens(tokenText);
  const tokenPercent = Math.min((tokens / 4096) * 100, 100);

  // Temp drag
  const handleDropTemp = (zone: string) => {
    if (tempSel === null) return;
    const item = tempItems[tempSel];
    if (item.correct === zone) {
      setTempPlaced(prev => ({ ...prev, [tempSel]: zone }));
      setTempSel(null);
    } else {
      Alert.alert('Incorrecto', `"${item.text}" no pertenece a esta categoría.`);
    }
  };
  const checkTempDrag = () => {
    if (tempOk) return true;
    const placed = Object.keys(tempPlaced).length;
    if (placed < tempItems.length) { Alert.alert('Faltan tarjetas'); return false; }
    let correct = 0;
    Object.entries(tempPlaced).forEach(([idx, zone]) => {
      if (tempItems[+idx].correct === zone) correct++;
    });
    if (correct === tempItems.length) {
      setTempOk(true);
      addXP(tempAttempts === 0 ? 20 : 12);
      Alert.alert('¡Perfecto!', `+${tempAttempts === 0 ? 20 : 12} XP`, [{ text: 'OK', onPress: goToNextStep }]);
      return false;
    } else {
      Alert.alert('Algunas incorrectas');
      setTempPlaced({});
      setTempAttempts(prev => prev + 1);
      return false;
    }
  };

  // TF
  const selectTF = (idx: number, val: boolean) => {
    if (tfChecked) return;
    setTfAnswers(prev => ({ ...prev, [idx]: val }));
  };
  const checkTF = () => {
    if (tfChecked) return true;
    if (Object.keys(tfAnswers).length < contextTF.length) { Alert.alert('Responde todas'); return false; }
    setTfChecked(true);
    let correct = 0;
    contextTF.forEach((item, i) => { if (tfAnswers[i] === item.correct) correct++; });
    const earned = correct * 5;
    addXP(earned);
    Alert.alert('Resultado', `${correct}/${contextTF.length} correctas. +${earned} XP`, [{ text: 'OK', onPress: goToNextStep }]);
    return false;
  };

  // Matching
  const handleMatchLeft = (idx: number) => {
    if (matchedLeft.has(idx)) return;
    setMatchLeft(idx);
  };
  const handleMatchRight = (idx: number) => {
    if (matchLeft === null || matchedRight.has(idx)) return;
    const correctRight = matchPairs[matchLeft].right;
    if (rightOrder[idx] === correctRight) {
      setMatchedLeft(prev => new Set(prev).add(matchLeft));
      setMatchedRight(prev => new Set(prev).add(idx));
      setMatchLeft(null);
      const newDone = matchedLeft.size + 1;
      setMatchDone(newDone);
      if (newDone === matchPairs.length) {
        addXP(20);
        Alert.alert('¡Completado!', '+20 XP', [{ text: 'OK', onPress: goToNextStep }]);
      }
    } else {
      Alert.alert('Incorrecto');
      setMatchLeft(null);
    }
  };

  // Hallucination
  const selectHall = (idx: number) => { if (!hallChecked) setHallSel(idx); };
  const checkHall = () => {
    if (hallChecked) return true;
    if (hallSel === null) { Alert.alert('Selecciona un fragmento'); return false; }
    setHallChecked(true);
    const isOk = hallSel === hallCase.correct;
    addXP(isOk ? 15 : 5);
    Alert.alert(isOk ? '¡Correcto!' : 'Incorrecto', hallCase.explain, [{ text: 'OK', onPress: goToNextStep }]);
    return false;
  };

  // Quiz
  const selectQuiz = (qIdx: number, oIdx: number) => {
    if (quizChecked) return;
    setQuizAnswers(prev => ({ ...prev, [qIdx]: oIdx }));
  };
  const checkQuiz = () => {
    if (quizChecked) return true;
    if (Object.keys(quizAnswers).length < quizItems.length) { Alert.alert('Responde todas'); return false; }
    setQuizChecked(true);
    let correct = 0;
    quizItems.forEach((q, i) => { if (quizAnswers[i] === q.correct) correct++; });
    const earned = correct * 8;
    addXP(earned);
    Alert.alert('Resultado', `${correct}/${quizItems.length} correctas. +${earned} XP`, [{ text: 'OK', onPress: goToNextStep }]);
    return false;
  };

  // Sesgo drag
  const handleDropSesgo = (zone: string) => {
    if (sesgoSel === null) return;
    const item = sesgoItems[sesgoSel];
    if (item.correct === zone) {
      setSesgoPlaced(prev => ({ ...prev, [sesgoSel]: zone }));
      setSesgoSel(null);
    } else {
      Alert.alert('Incorrecto', `"${item.text}" no pertenece a esta categoría.`);
    }
  };
  const checkSesgoDrag = () => {
    if (sesgoOk) return true;
    const placed = Object.keys(sesgoPlaced).length;
    if (placed < sesgoItems.length) { Alert.alert('Faltan tarjetas'); return false; }
    let correct = 0;
    Object.entries(sesgoPlaced).forEach(([idx, zone]) => {
      if (sesgoItems[+idx].correct === zone) correct++;
    });
    if (correct === sesgoItems.length) {
      setSesgoOk(true);
      addXP(sesgoAttempts === 0 ? 20 : 12);
      Alert.alert('¡Perfecto!', `+${sesgoAttempts === 0 ? 20 : 12} XP`, [{ text: 'OK', onPress: goToNextStep }]);
      return false;
    } else {
      Alert.alert('Algunas incorrectas');
      setSesgoPlaced({});
      setSesgoAttempts(prev => prev + 1);
      return false;
    }
  };

  // Sprint
  const startSprintTimer = () => {
    sprintTimerRef.current = setInterval(() => {
      setSprintTimeLeft(prev => {
        if (prev <= 1) { clearInterval(sprintTimerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };
  const answerSprint = (val: boolean) => {
    if (sprintDone || sprintIdx >= sprintItems.length) return;
    const item = sprintItems[sprintIdx];
    const isOk = val === item.correct;
    if (isOk) setSprintCorrect(prev => prev + 1);
    if (sprintIdx + 1 < sprintItems.length) {
      setSprintIdx(prev => prev + 1);
    } else {
      setSprintDone(true);
      clearInterval(sprintTimerRef.current!);
      const finalCorrect = sprintCorrect + (isOk ? 1 : 0);
      const earned = finalCorrect >= 10 ? 25 : finalCorrect >= 7 ? 18 : finalCorrect >= 4 ? 12 : 5;
      addXP(earned);
    }
  };
  useEffect(() => {
    if (step === 16 && !sprintDone && sprintIdx === 0 && sprintTimeLeft === 60) {
      startSprintTimer();
    }
    return () => { if (sprintTimerRef.current) clearInterval(sprintTimerRef.current); };
  }, [step, sprintDone]);

  // Reflect
  const checkReflect = () => {
    if (reflectText.trim().length >= 80) { addXP(15); goToNextStep(); }
    else { Alert.alert('Muy corto', 'Escribe al menos 80 caracteres.'); }
  };

  // ------------------- RENDERIZADOS -------------------
  const renderIntro = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>Nivel 4 · 18 módulos</Text>
      <View style={styles.iconContainer}><Text style={styles.iconEmoji}>🧠</Text></View>
      <Text style={styles.title}>Habla el lenguaje de la IA</Text>
      <Text style={styles.subtitle}>Ya sabes escribir prompts. Ahora vas a entender qué pasa por dentro de los LLMs.</Text>
      <View style={styles.card}><Text style={styles.cardText}>🔬 Tokens, temperatura, memoria de contexto, alucinaciones, sesgos y cómo comparar LLMs como un experto.</Text></View>
      <View style={styles.card}><Text style={styles.cardText}>🆕 Token Estimator en vivo y Hallucination Spotter — habilidades que pocos tienen.</Text></View>
      <View style={styles.card}><Text style={styles.cardText}>⭐ Hasta 230 XP disponibles · 18 módulos · Nivel 4 de 30</Text></View>
    </View>
  );

  const renderTheory1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>📖 Módulo 1 de 18 · Teoría</Text>
      <Text style={styles.title}>¿Qué hay dentro de un LLM?</Text>
      <Text style={styles.bodyText}>5 conceptos clave:</Text>
      <Text style={styles.bodyText}>1. Entrenamiento masivo</Text>
      <Text style={styles.bodyText}>2. Tokenización</Text>
      <Text style={styles.bodyText}>3. Predicción estadística</Text>
      <Text style={styles.bodyText}>4. Temperatura</Text>
      <Text style={styles.bodyText}>5. Ventana de contexto</Text>
      <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}><Text style={styles.checkButtonText}>Entendido →</Text></TouchableOpacity>
    </View>
  );

  const renderExamples = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>🔍 Módulo 2 de 18 · Ejemplos</Text>
      <Text style={styles.title}>Tokens en la vida real</Text>
      <Text style={styles.bodyText}>Toca las tarjetas (implementar expandibles).</Text>
      <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}><Text style={styles.checkButtonText}>Entendido →</Text></TouchableOpacity>
    </View>
  );

  const renderTokenEstimator = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>🆕 Módulo 3 de 18 · Token Estimator</Text>
      <Text style={styles.title}>Escribe y mira tus tokens</Text>
      <TextInput style={styles.textArea} multiline placeholder="Escribe tu prompt aquí..." value={tokenText} onChangeText={setTokenText} />
      <Text>Tokens estimados: {tokens}</Text>
      <View style={styles.progressBarToken}><View style={[styles.tokenFill, { width: `${tokenPercent}%` }]} /></View>
      <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}><Text style={styles.checkButtonText}>Continuar →</Text></TouchableOpacity>
    </View>
  );

  const renderTheoryTemp = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>📖 Módulo 4 de 18 · Temperatura</Text>
      <Text style={styles.title}>Temperatura: el dial de creatividad</Text>
      <Text style={styles.bodyText}>Baja = preciso, Alta = creativo.</Text>
      <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}><Text style={styles.checkButtonText}>Entendido →</Text></TouchableOpacity>
    </View>
  );

  const renderTempSlider = () => {
    const idx = tempValue < 2 ? 0 : tempValue === 2 ? 1 : 2;
    const res = TEMP_RESPONSES[idx];
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.tag}>🆕 Módulo 5 de 18 · Temperature Slider</Text>
        <Text style={styles.title}>Mueve la temperatura</Text>
        <Slider minimumValue={0} maximumValue={4} step={1} value={tempValue} onValueChange={setTempValue} />
        <Text style={styles.tempLabel}>{['Muy fría','Baja','Media','Alta','Muy alta'][tempValue]}</Text>
        <View style={[styles.tempResponse, { backgroundColor: res.color, borderColor: res.border }]}>
          <Text>{res.text}</Text>
        </View>
        <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}><Text style={styles.checkButtonText}>Continuar →</Text></TouchableOpacity>
      </View>
    );
  };

  const renderDragTemp = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>🎯 Módulo 6 de 18 · Clasificar</Text>
      <Text style={styles.title}>¿Alta o baja temperatura?</Text>
      <View style={styles.chipsPool}>
        {tempItems.map((item, idx) => tempPlaced[idx] === undefined && (
          <TouchableOpacity key={idx} style={[styles.chip, tempSel === idx && styles.chipSelected]} onPress={() => setTempSel(tempSel === idx ? null : idx)}>
            <Text>{item.text}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.dropCols}>
        <TouchableOpacity style={styles.dropCol} onPress={() => handleDropTemp('cold')}><Text>🔵 Baja</Text></TouchableOpacity>
        <TouchableOpacity style={styles.dropCol} onPress={() => handleDropTemp('hot')}><Text>🔴 Alta</Text></TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.checkButton} onPress={checkTempDrag}><Text style={styles.checkButtonText}>Verificar</Text></TouchableOpacity>
    </View>
  );

  const renderTheoryContext = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>📖 Módulo 7 de 18 · Contexto</Text>
      <Text style={styles.title}>La memoria que se borra</Text>
      <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}><Text style={styles.checkButtonText}>Entendido →</Text></TouchableOpacity>
    </View>
  );

  const renderTF = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>✅ Módulo 8 de 18 · V/F</Text>
      {contextTF.map((item, idx) => (
        <View key={idx} style={styles.tfItem}>
          <Text>{idx+1}. {item.stmt}</Text>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.tfBtn, tfAnswers[idx] === true && styles.tfBtnTrue]} onPress={() => selectTF(idx, true)} disabled={tfChecked}><Text>V</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.tfBtn, tfAnswers[idx] === false && styles.tfBtnFalse]} onPress={() => selectTF(idx, false)} disabled={tfChecked}><Text>F</Text></TouchableOpacity>
          </View>
        </View>
      ))}
      <TouchableOpacity style={styles.checkButton} onPress={checkTF}><Text style={styles.checkButtonText}>Comprobar</Text></TouchableOpacity>
    </View>
  );

  const renderTheoryCompare = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>📖 Módulo 9 de 18 · Comparativa</Text>
      <Text style={styles.title}>ChatGPT, Claude, Gemini y Grok</Text>
      <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}><Text style={styles.checkButtonText}>Entendido →</Text></TouchableOpacity>
    </View>
  );

  const renderMatching = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>🔗 Módulo 10 de 18 · Conectar</Text>
      <Text style={styles.title}>Situación → LLM ideal</Text>
      <View style={styles.matchColumns}>
        <View style={styles.matchLeftColumn}>
          {matchPairs.map((p, i) => (
            <TouchableOpacity key={i} style={[styles.matchCard, matchedLeft.has(i) && styles.matchMatched, matchLeft === i && styles.matchSelected]} onPress={() => handleMatchLeft(i)} disabled={matchedLeft.has(i)}>
              <Text>{p.left}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.matchRightColumn}>
          {rightOrder.map((r, i) => (
            <TouchableOpacity key={i} style={[styles.matchCard, matchedRight.has(i) && styles.matchMatched]} onPress={() => handleMatchRight(i)} disabled={matchedRight.has(i)}>
              <Text>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {matchDone === matchPairs.length && <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}><Text>Continuar</Text></TouchableOpacity>}
    </View>
  );

  const renderTheoryHall = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>📖 Módulo 11 de 18 · Alucinaciones</Text>
      <Text style={styles.title}>Cuando la IA inventa</Text>
      <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}><Text style={styles.checkButtonText}>Entendido →</Text></TouchableOpacity>
    </View>
  );

  const renderHallSpotter = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>🆕 Módulo 12 de 18 · Hallucination Spotter</Text>
      <Text>{hallCase.intro}</Text>
      <Text>{hallCase.text}</Text>
      <TouchableOpacity style={[styles.hallOption, hallSel === 0 && styles.hallSelected]} onPress={() => selectHall(0)}><Text>Fragmento 1</Text></TouchableOpacity>
      <TouchableOpacity style={[styles.hallOption, hallSel === 1 && styles.hallSelected]} onPress={() => selectHall(1)}><Text>Fragmento 2</Text></TouchableOpacity>
      <TouchableOpacity style={[styles.hallOption, hallSel === 2 && styles.hallSelected]} onPress={() => selectHall(2)}><Text>Fragmento 3</Text></TouchableOpacity>
      <TouchableOpacity style={[styles.hallOption, hallSel === 3 && styles.hallSelected]} onPress={() => selectHall(3)}><Text>Fragmento 4</Text></TouchableOpacity>
      <TouchableOpacity style={styles.checkButton} onPress={checkHall}><Text style={styles.checkButtonText}>Marcar como alucinación</Text></TouchableOpacity>
    </View>
  );

  const renderQuiz = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>❓ Módulo 13 de 18 · Quiz</Text>
      {quizItems.map((q, qi) => (
        <View key={qi}>
          <Text>{qi+1}. {q.q}</Text>
          {q.opts.map((opt, oi) => (
            <TouchableOpacity key={oi} style={[styles.quizOption, quizAnswers[qi] === oi && styles.quizOptionSelected]} onPress={() => selectQuiz(qi, oi)} disabled={quizChecked}>
              <Text>{String.fromCharCode(65+oi)}. {opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
      <TouchableOpacity style={styles.checkButton} onPress={checkQuiz}><Text style={styles.checkButtonText}>Comprobar</Text></TouchableOpacity>
    </View>
  );

  const renderTheorySesgos = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>📖 Módulo 14 de 18 · Sesgos</Text>
      <Text style={styles.title}>Los sesgos que nadie te cuenta</Text>
      <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}><Text style={styles.checkButtonText}>Entendido →</Text></TouchableOpacity>
    </View>
  );

  const renderDragSesgos = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>🎭 Módulo 15 de 18 · Clasificar sesgos</Text>
      <View style={styles.chipsPool}>
        {sesgoItems.map((item, idx) => sesgoPlaced[idx] === undefined && (
          <TouchableOpacity key={idx} style={[styles.chip, sesgoSel === idx && styles.chipSelected]} onPress={() => setSesgoSel(sesgoSel === idx ? null : idx)}>
            <Text>{item.text}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.dropCols}>
        <TouchableOpacity style={styles.dropCol} onPress={() => handleDropSesgo('sesgo-datos')}><Text>Datos</Text></TouchableOpacity>
        <TouchableOpacity style={styles.dropCol} onPress={() => handleDropSesgo('sesgo-confirmacion')}><Text>Confirmación</Text></TouchableOpacity>
        <TouchableOpacity style={styles.dropCol} onPress={() => handleDropSesgo('sesgo-cultura')}><Text>Cultura</Text></TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.checkButton} onPress={checkSesgoDrag}><Text style={styles.checkButtonText}>Verificar</Text></TouchableOpacity>
    </View>
  );

  const renderSprint = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>⚡ Módulo 16 de 18 · Sprint</Text>
      <Text style={styles.title}>Sprint: ¿Mito o Realidad?</Text>
      <Text>Tiempo: {sprintTimeLeft}s</Text>
      <Text>Aciertos: {sprintCorrect}/{sprintItems.length}</Text>
      {!sprintDone && sprintIdx < sprintItems.length && (
        <>
          <Text>{sprintItems[sprintIdx].stmt}</Text>
          <TouchableOpacity style={styles.sprintBtn} onPress={() => answerSprint(true)}><Text>✅ Verdadero</Text></TouchableOpacity>
          <TouchableOpacity style={styles.sprintBtn} onPress={() => answerSprint(false)}><Text>❌ Falso</Text></TouchableOpacity>
        </>
      )}
      {sprintDone && <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}><Text>Continuar</Text></TouchableOpacity>}
    </View>
  );

  const renderReflect = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>✍️ Módulo 17 de 18 · Reflexión</Text>
      <TextInput style={styles.textArea} multiline placeholder="Escribe tu reflexión (mín 80 caracteres)..." value={reflectText} onChangeText={setReflectText} />
      <Text>{reflectText.length}/80</Text>
      <TouchableOpacity style={styles.checkButton} onPress={checkReflect}><Text>Enviar reflexión (+15 XP)</Text></TouchableOpacity>
    </View>
  );

  const renderCompletion = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>¡Nivel 4 completado!</Text>
      <Text>⭐ {xp} XP ganados</Text>
      <TouchableOpacity style={styles.checkButton} onPress={handleFinish}><Text>Volver al mapa</Text></TouchableOpacity>
    </View>
  );

  const renderContent = () => {
    switch (step) {
      case 0: return renderIntro();
      case 1: return renderTheory1();
      case 2: return renderExamples();
      case 3: return renderTokenEstimator();
      case 4: return renderTheoryTemp();
      case 5: return renderTempSlider();
      case 6: return renderDragTemp();
      case 7: return renderTheoryContext();
      case 8: return renderTF();
      case 9: return renderTheoryCompare();
      case 10: return renderMatching();
      case 11: return renderTheoryHall();
      case 12: return renderHallSpotter();
      case 13: return renderQuiz();
      case 14: return renderTheorySesgos();
      case 15: return renderDragSesgos();
      case 16: return renderSprint();
      case 17: return renderReflect();
      case 18: return renderCompletion();
      default: return <ActivityIndicator />;
    }
  };

  const progressPercent = (step / 18) * 100;
  const showNextButton = step < 18 && ![1,2,3,4,5,6,8,10,12,13,15,16,17].includes(step);

  return (
    <View style={styles.screen}>
      <View style={styles.progressBar}>
        <TouchableOpacity onPress={handleClose}><MaterialIcons name="close" size={24} /></TouchableOpacity>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progressPercent}%` }]} /></View>
        <Text style={styles.xpText}>{xp} XP</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {renderContent()}
      </ScrollView>
      {showNextButton && (
        <TouchableOpacity style={styles.nextButton} onPress={goToNextStep}>
          <Text style={styles.nextButtonText}>Continuar →</Text>
        </TouchableOpacity>
      )}
      {devMode && (
        <TouchableOpacity style={styles.skipButton} onPress={goToNextStep}>
          <Text style={styles.skipButtonText}>⏩ Saltar (Modo Dev)</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  progressBar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  progressTrack: { flex: 1, height: 6, backgroundColor: colors.borderLight, borderRadius: 3, marginHorizontal: 12 },
  progressFill: { height: '100%', backgroundColor: colors.success, borderRadius: 3 },
  xpText: { ...typography.bold, fontSize: 14, color: colors.accentDark },
  scrollContent: { padding: 16, paddingBottom: 40 },
  stepContainer: { flex: 1 },
  tag: { fontSize: 11, fontWeight: '600', color: colors.primary, backgroundColor: '#eef2ff', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 12 },
  iconContainer: { width: 60, height: 60, borderRadius: 18, backgroundColor: '#eef2ff', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  iconEmoji: { fontSize: 30 },
  title: { ...typography.extraBold, fontSize: 19, color: colors.textPrimary, marginBottom: 6 },
  subtitle: { ...typography.regular, fontSize: 13, color: colors.textSecondary, marginBottom: 14 },
  bodyText: { ...typography.regular, fontSize: 13, color: colors.textPrimary, marginBottom: 12 },
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  cardText: { ...typography.regular, fontSize: 13 },
  checkButton: { backgroundColor: colors.success, padding: 12, borderRadius: 11, alignItems: 'center', marginTop: 16 },
  checkButtonText: { ...typography.bold, color: '#fff' },
  nextButton: { backgroundColor: colors.success, padding: 14, margin: 16, borderRadius: 11, alignItems: 'center' },
  nextButtonText: { ...typography.bold, color: '#fff', fontSize: 15 },
  skipButton: { backgroundColor: colors.warning, padding: 12, borderRadius: 11, alignItems: 'center', marginHorizontal: 16, marginBottom: 10 },
  skipButtonText: { ...typography.bold, color: '#fff' },
  textArea: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, minHeight: 80, textAlignVertical: 'top' },
  progressBarToken: { height: 8, backgroundColor: colors.borderLight, borderRadius: 4, marginVertical: 8 },
  tokenFill: { height: '100%', backgroundColor: colors.success, borderRadius: 4 },
  tempLabel: { fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginVertical: 8 },
  tempResponse: { padding: 12, borderRadius: 8, borderWidth: 1 },
  chipsPool: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  chip: { padding: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipSelected: { borderColor: colors.primary, backgroundColor: '#e0f2fe' },
  dropCols: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 16 },
  dropCol: { padding: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border, borderRadius: 8 },
  matchColumns: { flexDirection: 'row', gap: 8 },
  matchLeftColumn: { flex: 1 },
  matchRightColumn: { flex: 1 },
  matchCard: { padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 8, marginBottom: 8 },
  matchSelected: { borderColor: colors.primary, borderWidth: 2 },
  matchMatched: { backgroundColor: '#dcfce7', borderColor: colors.success },
  tfItem: { marginBottom: 16 },
  tfBtn: { padding: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 8, marginHorizontal: 4 },
  tfBtnTrue: { borderColor: colors.success, backgroundColor: '#f0fdf4' },
  tfBtnFalse: { borderColor: colors.error, backgroundColor: '#fff1f2' },
  row: { flexDirection: 'row' },
  hallOption: { padding: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 8, marginVertical: 4 },
  hallSelected: { borderColor: colors.primary, backgroundColor: '#e0f2fe' },
  quizOption: { padding: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 8, marginVertical: 4 },
  quizOptionSelected: { borderColor: colors.primary, backgroundColor: '#eff6ff' },
  sprintBtn: { padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 8, marginVertical: 4, alignItems: 'center' },
});