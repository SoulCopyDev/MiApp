import { router } from 'expo-router';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  BackHandler,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useGameStore } from '../store/gameStore';
import { colors, typography } from '../theme';
import XPToast from '../components/XPToast';

// ---------- Tipos y constantes ----------
type DragItem = { text: string; correct: string };
type MatchPair = { left: string; right: string };
type QuizQuestion = {
  q: string;
  opts: string[];
  correct: number;
  explain: string;
};
type TFItem = { stmt: string; correct: boolean; explain: string };
type FillItem = {
  sentence: string;
  allOpts: string[];
  correct: { [blankId: string]: number };
  explain: string;
};

const TOTAL_STEPS = 13; // 0:intro + 10 módulos + 1:complete
const CONTENT_STEPS = 10;

// Pools de datos (los mismos del HTML mejorado)
const DRAG_POOL: DragItem[] = [
  { text: 'Analizar 500,000 partidas de ajedrez en 1 hora', correct: 'ai' },
  { text: 'Reconocer tu cara entre miles de personas en 0.3 segundos', correct: 'ai' },
  { text: 'Traducir un texto largo de un idioma a otro en segundos', correct: 'ai' },
  { text: 'Predecir qué video abrirás en TikTok en los próximos segundos', correct: 'ai' },
  { text: 'Detectar si hay cáncer en una radiografía con 94% de precisión', correct: 'ai' },
  { text: 'Recordar la letra de 10,000 canciones sin equivocarse', correct: 'ai' },
  { text: 'Jugar ajedrez mejor que cualquier humano del mundo', correct: 'ai' },
  { text: 'Responder 1 millón de preguntas al mismo tiempo sin cansarse', correct: 'ai' },
  { text: 'Notar que tu amigo está triste aunque diga que está bien', correct: 'human' },
  { text: 'Improvisar y cambiar de plan cuando todo salió diferente', correct: 'human' },
  { text: 'Decidir si algo es justo o injusto para otra persona', correct: 'human' },
  { text: 'Inventar un chiste completamente original que nunca existió', correct: 'human' },
  { text: 'Sentir genuinamente emoción al ver a tu familia después de mucho tiempo', correct: 'human' },
  { text: 'Entender por qué un chiste es gracioso y no solo repetirlo', correct: 'human' },
  { text: 'Consolar a alguien que está llorando de verdad', correct: 'human' },
  { text: 'Aprender algo nuevo con UN solo ejemplo', correct: 'human' },
];

const MATCH_POOL: MatchPair[] = [
  { left: 'Spotify predice qué canción te va a gustar mañana', right: 'Comparó tu historial con 600M de usuarios parecidos a ti' },
  { left: 'Tu cámara desenfoca el fondo en modo retrato', right: 'Una IA entrenada con millones de fotos detecta los bordes de tu cuerpo' },
  { left: 'ChatGPT escribe texto en perfecto español', right: 'Predice qué palabra es más probable que siga, millones de veces' },
  { left: 'Google Maps predice el trancón antes de que empiece', right: 'Analizó años de datos GPS de millones de conductores en esa ruta' },
  { left: 'YouTube sabe exactamente cuándo te vas a aburrir de un video', right: 'Midió el segundo exacto donde millones de personas abandonan videos similares' },
  { left: 'Face ID te desbloquea en la oscuridad', right: 'Usa puntos de luz infrarrojos invisibles para mapear tu cara en 3D' },
  { left: 'Tu celular corrige automáticamente lo que escribes', right: 'Aprendió los patrones de escritura de millones de textos en tu idioma' },
  { left: 'Netflix sabe qué serie vas a ver después', right: 'Encontró usuarios con historial de series idéntico al tuyo y copió sus elecciones' },
];

const QUIZ_POOL: QuizQuestion[] = [
  {
    q: 'Una IA aprendió a reconocer perros viendo 5 millones de fotos. Ahora le muestras una foto de un lobo. ¿Qué pasa?',
    opts: ['La reconoce perfectamente porque un lobo se parece a un perro', 'Puede confundir el lobo con un perro — nunca vio lobos en su entrenamiento', 'Dice "no sé" porque sabe que no tiene suficiente información', 'Aprende sola en tiempo real que es un lobo con solo verlo una vez'],
    correct: 1,
    explain: 'La IA solo conoce lo que vio durante el entrenamiento. Sin lobos en los datos, predice lo más parecido que conoce (perro). No admite ignorancia — simplemente adivina lo más cercano.'
  },
  {
    q: '¿Cuál de estas cosas es IMPOSIBLE para cualquier IA de hoy?',
    opts: ['Componer una canción completa con letra y melodía en 3 minutos', 'Diagnosticar enfermedades analizando radiografías con 90% de precisión', 'Sentir genuinamente orgullo cuando ayuda a alguien', 'Traducir una novela de 400 páginas en menos de 10 minutos'],
    correct: 2,
    explain: 'La IA puede componer música, diagnosticar y traducir — ya lo hace. Pero sentir orgullo, amor o miedo de verdad es imposible. Solo genera texto que describe emociones. No hay nada dentro que sienta.'
  },
  {
    q: 'Tu amigo usó ChatGPT para un trabajo de historia y la profesora dice que varios datos están inventados. ¿Por qué pasó esto?',
    opts: ['ChatGPT tiene internet limitado y no encontró las fuentes', 'La profesora está equivocada, ChatGPT es más confiable que los libros', 'ChatGPT predice texto probable — no verifica si los datos son reales', 'ChatGPT solo tiene información reciente y los eventos eran muy antiguos'],
    correct: 2,
    explain: 'Esto se llama "alucinación". ChatGPT predice qué texto suena probable dado el contexto. Puede inventar fechas, nombres y estadísticas que suenan perfectamente reales pero son falsas. ¡Siempre verifica datos importantes!'
  },
  {
    q: 'Spotify te recomienda una canción que nunca escuchaste y te encanta. ¿Qué hizo la IA?',
    opts: ['Un músico humano de Spotify eligió la canción personalmente para ti', 'La IA buscó en internet la canción más popular del momento', 'Encontró miles de usuarios con gustos parecidos a ti y recomendó lo que a ellos les gustó', 'La IA leyó tu mente usando el micrófono del celular'],
    correct: 2,
    explain: 'Filtrado colaborativo: la IA encuentra personas con historial musical casi idéntico al tuyo y recomienda lo que a ellos les encantó. No lee mentes — lee patrones de comportamiento de millones de usuarios.'
  },
  {
    q: '¿Cuál es la diferencia más importante entre una IA y una calculadora?',
    opts: ['La calculadora es más rápida para sumar números', 'La IA aprendió de ejemplos sin que nadie le programara reglas exactas', 'La calculadora puede aprender sola con el tiempo', 'La IA solo funciona conectada a internet'],
    correct: 1,
    explain: 'La calculadora sigue reglas que alguien programó. La IA nunca tuvo reglas escritas — aprendió viendo millones de ejemplos y encontrando patrones por sí sola. Eso la hace flexible y poderosa.'
  },
  {
    q: 'Google Maps dice que llegarás en 20 minutos, pero hay un partido de fútbol esta noche. ¿Qué debería hacer la IA?',
    opts: ['Ignorar el partido porque no tiene relación con el tráfico', 'Tomar en cuenta el partido — los datos históricos muestran que hay más trancón esa noche', 'Preguntar al usuario si piensa ir al partido', 'Mostrar siempre 20 minutos extra por si acaso'],
    correct: 1,
    explain: 'Google Maps usa datos históricos de eventos: sabe que un martes con partido hay 40% más tráfico en ciertas vías. La IA combina múltiples factores, no solo el tráfico actual.'
  },
  {
    q: 'Una IA fue entrenada solo con votos de personas en Colombia. ¿Qué problema puede tener?',
    opts: ['Funcionará perfectamente en cualquier país del mundo', 'Solo podrá hacer predicciones sobre política colombiana', 'Puede ser muy imprecisa cuando la usen en otros países con contextos diferentes', 'La IA aprenderá sola a adaptarse a otros países sin necesitar más entrenamiento'],
    correct: 2,
    explain: 'La IA solo conoce lo que vio durante el entrenamiento. Si aprendió con datos de un solo país, sus predicciones en otros países pueden ser incorrectas. Los datos del entrenamiento definen sus límites.'
  },
  {
    q: 'TikTok te muestra videos de gatitos seguidos. ¿Qué información usó la IA para decidir esto?',
    opts: ['Leyó tu historial de búsquedas en Google', 'Un empleado de TikTok revisó tu perfil y eligió el contenido', 'Notó que pausas el scroll, repites videos y duras más tiempo con gatitos', 'La IA simplemente muestra lo más popular del momento'],
    correct: 2,
    explain: 'TikTok analiza más de 200 señales por usuario: cuántos segundos ves cada video, si lo repites, si pausas, qué hora es. Con esas señales detecta exactamente qué tipo de contenido te engancha más.'
  },
];

const TF_POOL: TFItem[] = [
  { stmt: 'La IA puede sentir emociones reales como tristeza o alegría', correct: false, explain: 'La IA solo predice palabras o patrones. No tiene experiencias internas ni emociones reales.' },
  { stmt: 'ChatGPT puede inventar datos históricos que suenan completamente reales', correct: true, explain: 'Se llama "alucinación". ChatGPT predice texto probable, no verifica si los datos son reales. ¡Siempre confirma información importante!' },
  { stmt: 'Una IA entrenada con fotos de perros puede reconocer perfectamente a los lobos', correct: false, explain: 'La IA solo reconoce lo que vio en su entrenamiento. Sin ejemplos de lobos, intentará clasificarlos como perros.' },
  { stmt: 'Spotify usa datos de millones de usuarios para recomendar canciones', correct: true, explain: 'Correcto. El filtrado colaborativo compara tu historial con el de cientos de millones de oyentes similares.' },
  { stmt: 'Una calculadora y una IA aprenden de la misma manera', correct: false, explain: 'La calculadora sigue reglas programadas que nunca cambian. La IA aprende de ejemplos sin que nadie le escriba reglas.' },
  { stmt: 'La IA de tu cámara usa rayos X para detectar tu cuerpo en el modo retrato', correct: false, explain: 'La IA analiza millones de píxeles para detectar los bordes de tu cuerpo basándose en patrones aprendidos, sin rayos X ni sensor 3D.' },
  { stmt: 'La IA puede mejorar su rendimiento si recibe más datos de entrenamiento', correct: true, explain: 'Exacto. Más datos y más correcciones = mejor rendimiento. Por eso las IAs mejoran con el tiempo.' },
  { stmt: 'Después de entrenarse, la IA siempre dará respuestas 100% correctas', correct: false, explain: 'La IA siempre trabaja con probabilidades, nunca con certeza absoluta. Puede equivocarse, especialmente con casos que nunca vio en el entrenamiento.' },
  { stmt: 'Google Maps predice el tiempo de llegada usando datos GPS de millones de celulares', correct: true, explain: 'Correcto. Analiza velocidades de millones de dispositivos en tiempo real para calcular el estado del tráfico.' },
  { stmt: 'Si le preguntas a la IA qué significan las emociones, realmente las entiende', correct: false, explain: 'La IA puede explicar emociones con palabras perfectas — pero no las siente ni las entiende. Solo predice qué texto es adecuado para esa pregunta.' },
];

const FILL_POOL: FillItem[] = [
  { sentence: 'La IA aprende mirando millones de <b>___</b>, no siguiendo reglas escritas.', allOpts: ['ejemplos', 'instrucciones', 'libros', 'películas'], correct: { fb0: 0 }, explain: 'La IA aprende de ejemplos — no de reglas escritas. Eso es lo que la hace diferente de una calculadora.' },
  { sentence: 'ChatGPT no "piensa" — <b>___</b> qué palabras son más probables.', allOpts: ['predice', 'inventa', 'busca', 'copia'], correct: { fb0: 0 }, explain: 'ChatGPT predice probabilidades matemáticas. Por eso puede cometer errores — no verifica, solo predice.' },
  { sentence: 'Spotify usa datos de <b>___</b> de usuarios para recomendarte canciones.', allOpts: ['millones', 'decenas', 'cientos', 'miles'], correct: { fb0: 0 }, explain: 'El poder de la IA viene de escala — millones de datos permiten encontrar patrones imposibles de ver con pocos ejemplos.' },
  { sentence: 'La IA no puede sentir <b>___</b> reales — solo predice palabras sobre ellas.', allOpts: ['emociones', 'números', 'idiomas', 'datos'], correct: { fb0: 0 }, explain: 'Esta es la diferencia más importante: la IA no tiene experiencia interna. Todo lo que produce es predicción matemática.' },
  { sentence: 'Cuando la IA falla porque nunca vio ese tipo de dato, se llama error de <b>___</b>.', allOpts: ['entrenamiento', 'código', 'memoria', 'internet'], correct: { fb0: 0 }, explain: 'El entrenamiento define los límites de la IA. Si nunca vio lobos, no puede reconocerlos aunque se parezcan a los perros que sí conoce.' },
];

const SORT_ITEMS = [
  'Recopilar datos: Juntar millones de ejemplos (fotos, textos, audios)',
  'Etiquetar: Marcar cuáles son correctos ("esto SÍ es gato, esto NO")',
  'Entrenar: El modelo ve cada ejemplo e intenta predecir el resultado',
  'Corregir: Se le dice si acertó o falló, y ajusta sus números internos',
  'Desplegar: Ya entrenado, puede responder bien a situaciones nuevas',
];

// Helper para elegir N elementos aleatorios
const pickN = <T,>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};

interface LevelProps {
  navigation?: any;
  setAllowBack?: (allow: boolean) => void;
}

export default function GameLevel1({ navigation: propsNavigation, setAllowBack }: LevelProps) {
  // Si no nos pasan navigation, usamos el hook
  const navigationFromHook = useNavigation();
  const navigation = propsNavigation || navigationFromHook;

  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);
  const completeLevel = useGameStore((state) => state.completeLevel);
  const devMode = useGameStore((state) => state.devMode);

  // Pools aleatorios
  const [dragItems] = useState(() => pickN(DRAG_POOL, 8));
  const [matchPairs] = useState(() => pickN(MATCH_POOL, 4));
  const [quizQuestions] = useState(() => pickN(QUIZ_POOL, 4));
  const [tfItems] = useState(() => pickN(TF_POOL, 5));
  const [fillItem] = useState(() => pickN(FILL_POOL, 1)[0]);

  // Estados de actividades
  const [dragPlaced, setDragPlaced] = useState<{ [key: number]: string }>({});
  const [dragSel, setDragSel] = useState<number | null>(null);
  const [dragAttempts, setDragAttempts] = useState(0);
  const [dragOk, setDragOk] = useState(false);

  const [matchLeft, setMatchLeft] = useState<number | null>(null);
  const [matchDone, setMatchDone] = useState(0);
  const [rightOrder, setRightOrder] = useState<string[]>([]);
  const [matchedLeft, setMatchedLeft] = useState<Set<number>>(new Set());
  const [matchedRight, setMatchedRight] = useState<Set<number>>(new Set());

  const [sortOrder, setSortOrder] = useState<number[]>([]);
  const [sortOk, setSortOk] = useState(false);

  const [quizAnswers, setQuizAnswers] = useState<{ [key: number]: number }>({});
  const [quizChecked, setQuizChecked] = useState(false);

  const [tfAnswers, setTfAnswers] = useState<{ [key: number]: boolean }>({});
  const [tfChecked, setTfChecked] = useState(false);

  const [fillSel, setFillSel] = useState<number | null>(null);
  const [fillChecked, setFillChecked] = useState(false);

  const [reflectText, setReflectText] = useState('');
  const [exampleExpanded, setExampleExpanded] = useState<number | null>(null);
  const [stepResult, setStepResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const isExamMode = step >= 4 && step <= 11;
  const THEORY_STEPS = new Set([1, 2, 3, 6]);
  const showBackButton = step > 0 && THEORY_STEPS.has(step);
  const goToPrevStep = () => { setStepResult(null); setStep(s => s - 1); };

  // Notificar al padre si se puede hacer retroceso o no (para control global)
  useEffect(() => {
    setAllowBack?.(!isExamMode);
  }, [isExamMode, setAllowBack]);

  // Manejo del botón físico de retroceso (Android)
  useEffect(() => {
    const onBackPress = () => {
      if (isExamMode) {
        Alert.alert(
          'Examen en curso',
          'No puedes regresar mientras realizas el examen. Si sales, perderás el progreso no guardado.',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Salir', style: 'destructive', onPress: () => router.back() }
          ]
        );
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [isExamMode, navigation]);

  // Inicializar rightOrder y sortOrder al entrar en sus pasos
  useEffect(() => {
    if (step === 5) {
      setRightOrder(pickN(matchPairs.map(p => p.right), matchPairs.length).sort(() => Math.random() - 0.5));
      setMatchLeft(null);
      setMatchDone(0);
      setMatchedLeft(new Set());
      setMatchedRight(new Set());
    }
    if (step === 7) {
      const order = [0, 1, 2, 3, 4];
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      setSortOrder(order);
      setSortOk(false);
    }
  }, [step, matchPairs]);

  const [xpToast, setXpToast] = useState<{ amount: number; id: number } | null>(null);
  const addXP = (amount: number) => {
    setXp(prev => prev + amount);
    if (amount > 0) setXpToast(prev => ({ amount, id: (prev?.id ?? 0) + 1 }));
  };

  const goToNextStep = () => {
    setStepResult(null);
    if (step < TOTAL_STEPS - 1) setStep(step + 1);
  };

  const showResult = (ok: boolean, msg: string) => {
    setStepResult({ ok, msg });
  };

  const handleClose = () => {
    // Web: Alert.alert no renderiza modal en React Native Web → usar window.confirm
    if (Platform.OS === 'web') {
      const msg = isExamMode
        ? 'Estás en medio del examen. Si sales, perderás el progreso. ¿Seguro?'
        : '¿Seguro que quieres salir del nivel? Perderás el progreso no guardado.';
      if (window.confirm(msg)) router.back();
      return;
    }
    if (isExamMode) {
      Alert.alert(
        'Examen en curso',
        'Estás en medio del examen. Si sales, perderás todo el progreso de este nivel. ¿Seguro que quieres salir?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Salir', style: 'destructive', onPress: () => router.back() },
        ]
      );
    } else {
      Alert.alert('Salir', '¿Seguro que quieres salir del juego? Perderás el progreso no guardado.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Salir', onPress: () => router.back() },
      ]);
    }
  };

  const handleFinish = () => {
    let stars = 0;
    if (xp >= 80) stars = 3;
    else if (xp >= 50) stars = 2;
    else if (xp >= 20) stars = 1;
    completeLevel(1, stars, xp);
    router.replace('/level/2');
  };

  // ---------- Drag & Drop ----------
  const handleChipPress = (idx: number) => {
    if (dragPlaced[idx] !== undefined) return;
    setDragSel(dragSel === idx ? null : idx);
  };

  const handleDropZone = (zone: string) => {
    if (dragSel === null) return;
    if (dragPlaced[dragSel] !== undefined) return;
    const item = dragItems[dragSel];
    if (item.correct === zone) {
      setDragPlaced(prev => ({ ...prev, [dragSel]: zone }));
      setDragSel(null);
      setStepResult(null);
    } else {
      showResult(false, `"${item.text}" no pertenece a esta categoría.`);
    }
  };

  const handleRemoveChip = (idx: number) => {
    setDragPlaced(prev => {
      const newPlaced = { ...prev };
      delete newPlaced[idx];
      return newPlaced;
    });
  };

  const checkDrag = () => {
    if (devMode) { setDragOk(true); addXP(20); return true; }
    if (dragOk) return true;
    const placedCount = Object.keys(dragPlaced).length;
    if (placedCount < dragItems.length) {
      showResult(false, `Faltan habilidades. Coloca todas (${dragItems.length - placedCount} restantes).`);
      return false;
    }
    setDragAttempts(prev => prev + 1);
    let correct = 0;
    const wrongIndices: number[] = [];
    Object.keys(dragPlaced).forEach(k => {
      const i = parseInt(k);
      if (dragPlaced[i] === dragItems[i].correct) correct++;
      else wrongIndices.push(i);
    });
    if (correct === dragItems.length) {
      setDragOk(true);
      const earned = dragAttempts === 0 ? 20 : 10;
      addXP(earned);
      showResult(true, `¡Genial! Clasificaste las ${dragItems.length} habilidades correctamente. +${earned} XP`);
      return false;
    } else {
      showResult(false, `${correct} de ${dragItems.length} correctas. Las incorrectas vuelven al banco.`);
      const newPlaced = { ...dragPlaced };
      wrongIndices.forEach(i => delete newPlaced[i]);
      setDragPlaced(newPlaced);
      return false;
    }
  };

  // ---------- Matching ----------
  const handleLeftClick = (idx: number) => {
    if (matchedLeft.has(idx)) return;
    setStepResult(null);
    setMatchLeft(idx);
  };

  const handleRightClick = (rightIdx: number) => {
    if (matchLeft === null) return;
    if (matchedRight.has(rightIdx)) return;
    const correctRightText = matchPairs[matchLeft].right;
    const selectedRightText = rightOrder[rightIdx];
    if (selectedRightText === correctRightText) {
      setMatchedLeft(prev => new Set(prev).add(matchLeft));
      setMatchedRight(prev => new Set(prev).add(rightIdx));
      setMatchLeft(null);
      const newCount = matchedLeft.size + 1;
      setMatchDone(newCount);
      if (newCount === matchPairs.length) {
        addXP(15);
        showResult(true, '¡Excelente! Conectaste todos los pares correctamente. +15 XP');
      }
    } else {
      showResult(false, 'Ese par no es correcto. Intenta de nuevo.');
      setMatchLeft(null);
    }
  };

  // ---------- Sort ----------
  const moveSort = (pos: number, dir: number) => {
    const newPos = pos + dir;
    if (newPos < 0 || newPos >= sortOrder.length) return;
    const newOrder = [...sortOrder];
    [newOrder[pos], newOrder[newPos]] = [newOrder[newPos], newOrder[pos]];
    setSortOrder(newOrder);
  };

  const checkSort = () => {
    if (devMode) { setSortOk(true); addXP(15); return true; }
    if (sortOk) return true;
    const isOk = sortOrder.every((v, i) => v === i);
    if (isOk) {
      setSortOk(true);
      addXP(15);
      showResult(true, '¡Perfecto! Ese es exactamente el orden en que una IA aprende. +15 XP');
      return false;
    } else {
      showResult(false, 'Algunos pasos están fuera de lugar. ¡Piensa en el orden lógico!');
      return false;
    }
  };

  // ---------- Quiz ----------
  const selectQuiz = (qIdx: number, optIdx: number) => {
    if (quizChecked) return;
    setQuizAnswers(prev => ({ ...prev, [qIdx]: optIdx }));
  };

  const checkQuiz = () => {
    if (devMode) { setQuizChecked(true); addXP(32); return true; }
    if (quizChecked) return true;
    if (Object.keys(quizAnswers).length < quizQuestions.length) {
      showResult(false, 'Incompleto. Responde todas las preguntas primero.');
      return false;
    }
    setQuizChecked(true);
    let correct = 0;
    quizQuestions.forEach((q, idx) => {
      if (quizAnswers[idx] === q.correct) correct++;
    });
    const earned = correct * 8;
    if (earned > 0) addXP(earned);
    showResult(true, `Resultado: ${correct} de ${quizQuestions.length} correctas. +${earned} XP`);
    return false;
  };

  // ---------- True/False ----------
  const selectTF = (qIdx: number, val: boolean) => {
    if (tfChecked) return;
    setTfAnswers(prev => ({ ...prev, [qIdx]: val }));
  };

  const checkTF = () => {
    if (devMode) { setTfChecked(true); addXP(25); return true; }
    if (tfChecked) return true;
    if (Object.keys(tfAnswers).length < tfItems.length) {
      showResult(false, 'Incompleto. Responde todas las afirmaciones.');
      return false;
    }
    setTfChecked(true);
    let correct = 0;
    tfItems.forEach((item, idx) => {
      if (tfAnswers[idx] === item.correct) correct++;
    });
    const earned = correct * 5;
    if (earned > 0) addXP(earned);
    showResult(true, `Resultado: ${correct} de ${tfItems.length} correctas. +${earned} XP`);
    return false;
  };

  // ---------- Fill blank ----------
  const selectFill = (idx: number) => {
    if (fillChecked) return;
    setFillSel(idx);
  };

  const checkFill = () => {
    if (devMode) { setFillChecked(true); addXP(10); return true; }
    if (fillChecked) return true;
    if (fillSel === null) {
      showResult(false, 'Selecciona la palabra correcta.');
      return false;
    }
    setFillChecked(true);
    const isOk = fillSel === fillItem.correct.fb0;
    if (isOk) {
      addXP(10);
      showResult(true, `¡Correcto! +10 XP. ${fillItem.explain}`);
    } else {
      showResult(false, `Incorrecto. La respuesta correcta es "${fillItem.allOpts[fillItem.correct.fb0]}". ${fillItem.explain}`);
    }
    return false;
  };

  // ---------- Reflexión ----------
  const checkReflect = () => {
    if (reflectText.trim().length >= 60) {
      addXP(15);
      goToNextStep();
    } else {
      showResult(false, 'Muy corto. Escribe al menos 60 caracteres.');
    }
  };

  // ---------- Renderizado de pasos ----------
  const renderIntro = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>Nivel 1 · Módulo 1 de 10</Text>
      <View style={styles.iconContainer}><Text style={styles.iconEmoji}>🤖</Text></View>
      <Text style={styles.title}>Robots vs. Humanos</Text>
      <Text style={styles.subtitle}>Tu celular reconoce tu cara entre miles de personas en milésimas de segundo. Pero si le preguntas qué <Text style={{ fontStyle: 'italic' }}>significa</Text> una sonrisa... no tiene la menor idea. ¿Por qué puede hacer lo primero y no lo segundo? Eso es lo que vas a descubrir aquí.</Text>
      <View style={styles.cardBlue}>
        <Text style={styles.cardTitle}>📚 Qué vas a aprender</Text>
        <Text style={styles.cardText}>Qué es la IA y cómo aprende · Por qué no piensa ni siente · Cómo reconocerla en apps que ya usas · En qué supera a los humanos y en qué no puede competir</Text>
      </View>
      <View style={styles.cardGreen}>
        <Text style={styles.cardTitle}>⚡ Qué podrás HACER al terminar</Text>
        <Text style={styles.cardText}>Explicarle a cualquier persona qué es la IA con ejemplos reales de su vida — sin tecnicismos y sin mitos de películas.</Text>
      </View>
      <View style={styles.cardYellow}>
        <Text style={styles.cardTitle}>🎮 10 módulos · hasta 130 XP</Text>
        <Text style={styles.cardText}>📖 Teoría · 🌍 Ejemplos reales · 🏥 Caso real · 🧩 Clasificar · 🔗 Conectar · 🔢 Ordenar pasos · ❓ Quiz · ✅ Verdadero/Falso · 💬 Completa la frase · ✍️ Reflexión</Text>
      </View>
    </View>
  );

  const renderTheory = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>📖 Módulo 1 de 10 · Teoría</Text>
      <Text style={styles.title}>¿Qué es la Inteligencia Artificial?</Text>
      <Text style={styles.bodyText}>Cuando escuchas "Inteligencia Artificial" probablemente imaginas un robot de película con cara y a punto de rebelarse contra los humanos. Olvida eso por ahora. <Text style={{ fontWeight: 'bold' }}>La IA real ya está dentro de tu celular, en tus apps favoritas y en la música que escuchas</Text> — lleva años ahí, operando en silencio.</Text>
      <View style={styles.warningBox}>
        <Text style={styles.warningText}><Text style={{ fontWeight: 'bold' }}>❌ El error más común:</Text> La IA NO piensa. NO siente. NO entiende nada de verdad. Cuando ChatGPT te escribe algo brillante, no lo "pensó". Cuando Spotify te recomienda la canción perfecta, no "sintió" tu estado de ánimo. Los dos siguieron <Text style={{ fontStyle: 'italic' }}>patrones matemáticos</Text> a una velocidad que ningún humano puede igualar.</Text>
      </View>
      <View style={styles.highlightBox}>
        <Text style={styles.highlightText}>💡 <Text style={{ fontWeight: 'bold' }}>La definición fácil de recordar:</Text> La IA es un programa que aprendió a hacer cosas mirando millones de ejemplos hasta detectar los patrones que los explican. Sin reglas escritas. Sin intuición. Solo matemáticas repetidas millones de veces.</Text>
      </View>
      <Text style={styles.sectionTitle}>🧮 IA vs. Calculadora — la diferencia clave</Text>
      <View style={styles.vsGrid}>
        <View style={styles.vsCol}><Text style={styles.vsHeader}>🧮 Calculadora</Text><Text style={styles.vsItem}>Alguien le programó reglas exactas</Text><Text style={styles.vsItem}>5 + 3 = 8. Siempre. Sin excepción.</Text><Text style={styles.vsItem}>No puede salirse de sus reglas</Text><Text style={styles.vsItem}>Nunca aprende ni cambia</Text></View>
        <View style={styles.vsCol}><Text style={styles.vsHeader}>🤖 IA</Text><Text style={styles.vsItem}>Nunca tuvo reglas escritas</Text><Text style={styles.vsItem}>Vio millones de ejemplos y encontró patrones sola</Text><Text style={styles.vsItem}>Reconoce caras sin saber qué es una nariz</Text><Text style={styles.vsItem}>Mejora con más datos y correcciones</Text></View>
      </View>
      <View style={styles.tipBox}>
        <Text style={styles.tipText}>✅ <Text style={{ fontWeight: 'bold' }}>Regla de oro para toda la vida:</Text> La IA no <Text style={{ fontStyle: 'italic' }}>sabe</Text> — <Text style={{ fontStyle: 'italic' }}>predice</Text>. Siempre calcula cuál es la respuesta más probable basándose en todo lo que vio. Eso explica por qué puede ser brillante en algunas cosas y completamente equivocada en otras.</Text>
      </View>
    </View>
  );

  const examples = [
    { emoji: '📱', name: 'TikTok', desc: 'El algoritmo más adictivo del mundo', detail: 'Cada vez que abres TikTok, una IA analiza más de 200 cosas de ti al mismo tiempo: cuántos segundos exactos viste el video, si lo repetiste, si pausaste, qué hora es, qué tipo de contenido viste las últimas horas... Decide en los primeros 7 segundos si ese video te va a enganchar.', fact: '⭐ TikTok tiene acceso a los patrones de más de 1,000 millones de usuarios. El tiempo promedio en la app pasó de 52 a más de 95 minutos diarios.' },
    { emoji: '🎵', name: 'Spotify', desc: '30 canciones perfectas cada lunes', detail: 'Cada lunes aparece "Discover Weekly" — 30 canciones que nunca escuchaste pero van a gustarte. Una IA comparó tu historial con el de 600 millones de personas, encontró las que tienen gustos casi iguales a los tuyos, y lo que a ellas les encantó esta semana... te lo recomienda a ti.', fact: '⭐ El 98% de Discover Weekly es generado sin ninguna intervención humana. Quienes la usan escuchan 40% más música por semana.' },
    { emoji: '📷', name: 'Modo retrato', desc: 'Tu cámara que "ve" personas', detail: 'En el modo retrato, tu celular no tiene sensor 3D ni rayos X. Una IA analiza tu foto y separa tu cuerpo del fondo pixel por pixel, en tiempo real. Aprendió solo mirando millones de fotos de personas en distintos fondos.', fact: '⭐ Apple entrenó esta IA con más de 100 millones de imágenes de personas. Analiza más de 100 capas de la imagen antes de que veas el resultado final.' },
    { emoji: '💬', name: 'ChatGPT', desc: 'El que predice palabras con precisión increíble', detail: 'ChatGPT no "entiende" lo que escribes. Predice qué palabra es más probable que siga basándose en patrones de billones de textos. Por eso puede escribir un poema perfecto Y al mismo tiempo inventar datos históricos que suenan reales pero son falsos.', fact: '⭐ Nunca uses ChatGPT para datos importantes sin verificarlos. Puede inventar fechas, nombres y estadísticas con total confianza.' },
    { emoji: '🗺️', name: 'Google Maps', desc: 'Adivina el trancón antes de que exista', detail: 'Maps analiza los datos GPS de millones de celulares en tiempo real. Si detecta que 500 celulares van más lentos de lo normal en una vía... ya sabe que hay trancón. Combina datos históricos, clima, eventos y partidos de fútbol.', fact: '⭐ Google Maps procesa más de 1,000 millones de km de datos GPS al día. Su predicción de llegada tiene margen de error menor a 2 minutos en el 90% de los viajes.' },
  ];

  const renderExamples = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>🌍 Módulo 2 de 10 · Ejemplos reales</Text>
      <Text style={styles.title}>La IA que ya usas sin saberlo</Text>
      <Text style={styles.subtitle}>Estas apps las conoces. Lo que no sabías es qué está haciendo la IA por dentro. Toca cada una para descubrirlo.</Text>
      {examples.map((ex, idx) => (
        <TouchableOpacity key={idx} style={[styles.exampleCard, exampleExpanded === idx && styles.exampleCardActive]} onPress={() => setExampleExpanded(exampleExpanded === idx ? null : idx)} activeOpacity={0.7}>
          <View style={styles.exampleHeader}>
            <Text style={styles.exampleEmoji}>{ex.emoji}</Text>
            <View style={{ flex: 1 }}><Text style={styles.exampleName}>{ex.name}</Text><Text style={styles.exampleApp}>{ex.desc}</Text></View>
            <Text style={styles.exampleArrow}>{exampleExpanded === idx ? '↓' : '›'}</Text>
          </View>
          {exampleExpanded === idx && (
            <View style={styles.exampleDetail}>
              <Text style={styles.exampleDetailText}>{ex.detail}</Text>
              <Text style={styles.exampleFact}>{ex.fact}</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderCase = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>🏥 Módulo 3 de 10 · Caso real</Text>
      <Text style={styles.title}>La IA que ayuda a salvar vidas</Text>
      <Text style={styles.subtitle}>¿Sabías que la IA ya trabaja en hospitales? Aquí una historia real de cómo funciona.</Text>
      <View style={styles.scenarioBox}>
        <Text style={styles.scenarioLabel}>🎬 La situación</Text>
        <Text style={styles.scenarioText}>Valentina es médica en una clínica de Bogotá. Su trabajo es mirar imágenes médicas llamadas <Text style={{ fontWeight: 'bold' }}>radiografías</Text>. En un día normal, revisa más de 60 de estas imágenes buscando manchas muy pequeñas que podrían indicar que algo no está bien.</Text>
      </View>
      <View style={styles.funBox}>
        <Text style={styles.funText}>🤔 <Text style={{ fontWeight: 'bold' }}>¿Por qué es tan difícil ese trabajo?</Text> Imagina pasar 8 horas mirando imágenes similares buscando detalles del tamaño de una uña. El ojo humano se cansa. Un estudio encontró que los médicos pierden hasta el 22% de su capacidad de concentración en la segunda mitad del día.</Text>
      </View>
      <Text style={styles.bodyText}>Hoy, Valentina trabaja con una IA llamada <Text style={{ fontWeight: 'bold' }}>CheXpert</Text>. Antes de que ella revise la imagen, la IA ya lo hizo. En menos de 2 segundos, CheXpert analizó miles de puntos y marcó las zonas sospechosas. Valentina aporta lo que la IA no puede: conocer la historia del paciente, sus síntomas, lo que le contó y que no quedó escrito. Juntas son más precisas que cualquiera sola.</Text>
      <View style={styles.curiosityBox}>
        <Text style={styles.curiosityText}>🔮 <Text style={{ fontWeight: 'bold' }}>Dato que te va a sorprender:</Text> La IA de Google Health detecta cáncer de pulmón en etapa temprana con 94% de precisión, superando al promedio de médicos en estudios controlados. Pero en casos complejos con mucho contexto personal, los médicos siguen siendo más precisos. La IA no reemplaza — amplifica.</Text>
      </View>
    </View>
  );

  const renderDragDrop = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>🧩 Módulo 4 de 10 · Clasificar</Text>
      <Text style={styles.title}>¿Quién lo hace mejor?</Text>
      <Text style={styles.subtitle}>Clasifica cada habilidad: ¿la hace mejor la IA o el humano?</Text>
      <View style={styles.chipsPool}>
        {dragItems.map((item, idx) => {
          if (dragPlaced[idx] !== undefined) return null;
          return (
            <TouchableOpacity key={idx} style={[styles.chip, dragSel === idx && styles.chipSelected]} onPress={() => handleChipPress(idx)}>
              <Text style={styles.chipText}>{item.text}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.dropCols}>
        <TouchableOpacity style={[styles.dropCol, styles.dropAI]} onPress={() => handleDropZone('ai')}>
          <Text style={styles.dropHeader}>🤖 IA</Text>
          <View style={styles.dropChips}>
            {Object.entries(dragPlaced).map(([idx, zone]) => {
              if (zone === 'ai') {
                const i = parseInt(idx);
                return (
                  <TouchableOpacity key={i} style={styles.dropChip} onPress={() => handleRemoveChip(i)}>
                    <Text style={styles.dropChipText}>{dragItems[i].text} ✕</Text>
                  </TouchableOpacity>
                );
              }
              return null;
            })}
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.dropCol, styles.dropHuman]} onPress={() => handleDropZone('human')}>
          <Text style={styles.dropHeader}>🧠 Humano</Text>
          <View style={styles.dropChips}>
            {Object.entries(dragPlaced).map(([idx, zone]) => {
              if (zone === 'human') {
                const i = parseInt(idx);
                return (
                  <TouchableOpacity key={i} style={styles.dropChip} onPress={() => handleRemoveChip(i)}>
                    <Text style={styles.dropChipText}>{dragItems[i].text} ✕</Text>
                  </TouchableOpacity>
                );
              }
              return null;
            })}
          </View>
        </TouchableOpacity>
      </View>
      {dragOk ? (
        <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}>
          <Text style={styles.checkButtonText}>Continuar →</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.checkButton, Object.keys(dragPlaced).length < dragItems.length && styles.checkButtonDisabled]}
          onPress={checkDrag}
          disabled={Object.keys(dragPlaced).length < dragItems.length}
        >
          <Text style={styles.checkButtonText}>Verificar clasificación</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderMatching = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>🔗 Módulo 5 de 10 · Conectar</Text>
      <Text style={styles.title}>¿Por qué puede hacer eso?</Text>
      <Text style={styles.subtitle}>Conecta cada capacidad con la razón técnica.</Text>
      <View style={styles.matchColumns}>
        <View style={styles.matchLeftColumn}>
          {matchPairs.map((pair, leftIdx) => (
            <TouchableOpacity key={leftIdx} style={[styles.matchLeftCard, matchLeft === leftIdx && styles.matchSelected, matchedLeft.has(leftIdx) && styles.matchMatched]} onPress={() => handleLeftClick(leftIdx)} disabled={matchedLeft.has(leftIdx)}>
              <Text style={styles.matchText}>{pair.left}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.matchRightColumn}>
          {rightOrder.map((rightText, rightIdx) => (
            <TouchableOpacity key={rightIdx} style={[styles.matchRightCard, matchedRight.has(rightIdx) && styles.matchMatched]} onPress={() => handleRightClick(rightIdx)} disabled={matchedRight.has(rightIdx)}>
              <Text style={styles.matchText}>{rightText}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {matchDone >= matchPairs.length && (
        <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}>
          <Text style={styles.checkButtonText}>Continuar →</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderHowAIlearns = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>🔢 Módulo 6 de 10 · Cómo aprende la IA</Text>
      <Text style={styles.title}>El secreto de cómo aprende una IA</Text>
      <Text style={styles.subtitle}>Antes de ordenar los pasos, entiende muy bien cómo aprende una IA por dentro.</Text>
      <View style={styles.funBox}>
        <Text style={styles.funText}>🐱 <Text style={{ fontWeight: 'bold' }}>El ejemplo del gato</Text> Imagina que quieres enseñarle a una IA a reconocer gatos. No puedes escribir una regla como "los gatos tienen bigotes". Le muestras millones de fotos — algunas de gatos, otras no — y le dices cuáles son cuáles. La IA empieza a encontrar los patrones sola.</Text>
      </View>
      <Text style={styles.sectionTitle}>Los 5 pasos del aprendizaje de una IA</Text>
      <View style={styles.stepList}>
        <View style={styles.stepItem}><View style={styles.stepNum}><Text style={styles.stepNumText}>1</Text></View><Text style={styles.stepText}><Text style={{ fontWeight: 'bold' }}>Recopilar datos:</Text> Juntar millones de ejemplos.</Text></View>
        <View style={styles.stepItem}><View style={styles.stepNum}><Text style={styles.stepNumText}>2</Text></View><Text style={styles.stepText}><Text style={{ fontWeight: 'bold' }}>Etiquetar:</Text> Marcar cuáles son correctos.</Text></View>
        <View style={styles.stepItem}><View style={styles.stepNum}><Text style={styles.stepNumText}>3</Text></View><Text style={styles.stepText}><Text style={{ fontWeight: 'bold' }}>Entrenar:</Text> El modelo ve cada ejemplo e intenta predecir.</Text></View>
        <View style={styles.stepItem}><View style={styles.stepNum}><Text style={styles.stepNumText}>4</Text></View><Text style={styles.stepText}><Text style={{ fontWeight: 'bold' }}>Corregir:</Text> Se le dice si acertó o falló, y ajusta.</Text></View>
        <View style={styles.stepItem}><View style={styles.stepNum}><Text style={styles.stepNumText}>5</Text></View><Text style={styles.stepText}><Text style={{ fontWeight: 'bold' }}>Desplegar:</Text> Ya entrenado, responde a situaciones nuevas.</Text></View>
      </View>
    </View>
  );

  const renderSort = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>↕️ Módulo 7 de 10 · Ordenar</Text>
      <Text style={styles.title}>¿En qué orden aprende una IA?</Text>
      <Text style={styles.subtitle}>Estos 5 pasos están mezclados. Ponlos en el orden correcto.</Text>
      {sortOrder.map((stepIdx, pos) => (
        <View key={pos} style={styles.sortItem}>
          <Text style={styles.sortNum}>{pos+1}</Text>
          <Text style={styles.sortText}>{SORT_ITEMS[stepIdx]}</Text>
          <View style={styles.sortArrows}>
            <TouchableOpacity style={styles.sortBtn} onPress={() => moveSort(pos, -1)} disabled={pos === 0}><MaterialIcons name="keyboard-arrow-up" size={20} /></TouchableOpacity>
            <TouchableOpacity style={styles.sortBtn} onPress={() => moveSort(pos, 1)} disabled={pos === sortOrder.length-1}><MaterialIcons name="keyboard-arrow-down" size={20} /></TouchableOpacity>
          </View>
        </View>
      ))}
      {sortOk ? (
        <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}>
          <Text style={styles.checkButtonText}>Continuar →</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.checkButton} onPress={checkSort}>
          <Text style={styles.checkButtonText}>Verificar orden</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderQuiz = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>❓ Módulo 8 de 10 · Quiz</Text>
      <Text style={styles.title}>¿Cuánto entendiste?</Text>
      {quizQuestions.map((q, qIdx) => (
        <View key={qIdx} style={styles.quizCard}>
          <Text style={styles.quizQuestion}>{qIdx+1}. {q.q}</Text>
          {q.opts.map((opt, optIdx) => {
            const isSelected = quizAnswers[qIdx] === optIdx;
            const isCorrect = optIdx === q.correct;
            const optStyle = !quizChecked
              ? [styles.quizOption, isSelected && styles.quizOptionSelected]
              : [styles.quizOption, isCorrect ? styles.quizOptionCorrect : isSelected ? styles.quizOptionWrong : null];
            return (
              <TouchableOpacity key={optIdx} style={optStyle} onPress={() => selectQuiz(qIdx, optIdx)} disabled={quizChecked}>
                <Text style={styles.quizLetter}>{String.fromCharCode(65+optIdx)}</Text>
                <Text style={styles.quizOptText}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
          {quizChecked && <Text style={styles.explainText}>{q.explain}</Text>}
        </View>
      ))}
      {quizChecked ? (
        <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}>
          <Text style={styles.checkButtonText}>Continuar →</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.checkButton} onPress={checkQuiz}>
          <Text style={styles.checkButtonText}>Comprobar respuestas</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderTF = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>✅ Módulo 9 de 10 · Verdadero o Falso</Text>
      <Text style={styles.title}>¿Verdad o mentira?</Text>
      {tfItems.map((item, idx) => {
        const userPick = tfAnswers[idx];
        return (
          <View key={idx} style={styles.tfSet}>
            <Text style={styles.tfQuestion}>{idx+1}. {item.stmt}</Text>
            <View style={styles.tfOpts}>
              <TouchableOpacity
                style={[styles.tfBtn,
                  !tfChecked && userPick === true && styles.tfBtnTrue,
                  tfChecked && item.correct === true && styles.tfBtnResultCorrect,
                  tfChecked && item.correct !== true && userPick === true && styles.tfBtnResultWrong,
                ]}
                onPress={() => selectTF(idx, true)}
                disabled={tfChecked}
              ><Text>✅ Verdadero</Text></TouchableOpacity>
              <TouchableOpacity
                style={[styles.tfBtn,
                  !tfChecked && userPick === false && styles.tfBtnFalse,
                  tfChecked && item.correct === false && styles.tfBtnResultCorrect,
                  tfChecked && item.correct !== false && userPick === false && styles.tfBtnResultWrong,
                ]}
                onPress={() => selectTF(idx, false)}
                disabled={tfChecked}
              ><Text>❌ Falso</Text></TouchableOpacity>
            </View>
            {tfChecked && <Text style={styles.explainText}>{item.explain}</Text>}
          </View>
        );
      })}
      {tfChecked ? (
        <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}>
          <Text style={styles.checkButtonText}>Continuar →</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.checkButton} onPress={checkTF}>
          <Text style={styles.checkButtonText}>Comprobar</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderFill = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>💬 Módulo 10 de 10 · Completa la frase</Text>
      <Text style={styles.title}>¿Cuál es la palabra que falta?</Text>
      <View style={styles.fillSentence}>
        <Text>{fillItem.sentence.replace('<b>___</b>', '_____')}</Text>
      </View>
      <View style={styles.fillOpts}>
        {fillItem.allOpts.map((opt, idx) => {
          const isSelected = fillSel === idx;
          const isCorrect = idx === fillItem.correct.fb0;
          const optStyle = !fillChecked
            ? [styles.fillOpt, isSelected && styles.fillOptSelected]
            : [styles.fillOpt, isCorrect ? styles.fillOptCorrect : isSelected ? styles.fillOptWrong : null];
          return (
            <TouchableOpacity key={idx} style={optStyle} onPress={() => selectFill(idx)} disabled={fillChecked}>
              <Text>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {fillChecked ? (
        <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}>
          <Text style={styles.checkButtonText}>Continuar →</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.checkButton} onPress={checkFill}>
          <Text style={styles.checkButtonText}>Verificar respuesta</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderReflect = () => {
    const reflectReady = reflectText.trim().length >= 60;
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.tag}>✍️ Reflexión final · +15 XP</Text>
        <Text style={styles.title}>Ahora piensa tú</Text>
        <Text style={styles.subtitle}>Piensa en una app que usas todos los días. ¿Qué crees que está haciendo la IA en esa app? Y ahora que sabes cómo funciona por dentro, ¿cambia algo la manera en que la vas a usar?</Text>
        <TextInput style={styles.textArea} multiline numberOfLines={6} placeholder="Escribe tu reflexión (mínimo 60 caracteres)..." value={reflectText} onChangeText={setReflectText} />
        <Text style={styles.charCount}>{reflectText.trim().length} / 60 mínimo</Text>
        <TouchableOpacity
          style={[styles.checkButton, !reflectReady && styles.checkButtonDisabled]}
          onPress={checkReflect}
          disabled={!reflectReady}
        >
          <Text style={styles.checkButtonText}>Enviar reflexión</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderCompletion = () => (
    <View style={styles.completeContainer}>
      <Text style={styles.completeBadgeText}>🏅</Text>
      <Text style={styles.completeTitle}>¡Nivel 1 completado!</Text>
      <Text style={styles.completeSub}>Terminaste "Robots vs. Humanos". Ahora entiendes algo que mucha gente confunde: qué puede la IA, por qué puede hacerlo, cómo aprende paso a paso, y en qué los humanos seguimos siendo únicos.</Text>
      <Text style={styles.xpEarnedText}>⭐ {xp} XP ganados en este nivel</Text>
      <TouchableOpacity style={styles.nextLevelButton} onPress={handleFinish}>
        <Text style={styles.nextLevelText}>Siguiente nivel →</Text>
      </TouchableOpacity>
    </View>
  );

  const renderContent = () => {
    switch (step) {
      case 0: return renderIntro();
      case 1: return renderTheory();
      case 2: return renderExamples();
      case 3: return renderCase();
      case 4: return renderDragDrop();
      case 5: return renderMatching();
      case 6: return renderHowAIlearns();
      case 7: return renderSort();
      case 8: return renderQuiz();
      case 9: return renderTF();
      case 10: return renderFill();
      case 11: return renderReflect();
      case 12: return renderCompletion();
      default: return null;
    }
  };

  const progressPercent = (step / (TOTAL_STEPS - 1)) * 100;
  const showNextButton = step < TOTAL_STEPS - 1 && ![4,5,7,8,9,10,11].includes(step);

  return (
    <View style={styles.screen}>
      <View style={styles.progressBar}>
        <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
          <MaterialIcons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>
        <Text style={styles.xpText}>{xp} XP</Text>
      </View>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {renderContent()}
      </ScrollView>
      {stepResult && (
        <View style={[styles.resultBanner, stepResult.ok ? styles.resultBannerOk : styles.resultBannerErr]}>
          <Text style={styles.resultBannerText}>{stepResult.ok ? '✅ ' : '❌ '}{stepResult.msg}</Text>
        </View>
      )}
      {xpToast && <XPToast key={xpToast.id} amount={xpToast.amount} onHide={() => setXpToast(null)} />}
      <View style={styles.footerRow}>
        {showBackButton && (
          <TouchableOpacity style={styles.backButton} onPress={goToPrevStep}>
            <Text style={styles.backButtonText}>← Volver</Text>
          </TouchableOpacity>
        )}
        {showNextButton && (
          <TouchableOpacity style={[styles.nextButton, showBackButton && styles.nextButtonFlex]} onPress={goToNextStep}>
            <Text style={styles.nextButtonText}>Continuar →</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// Estilos
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  progressBar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  closeBtn: { padding: 4 },
  progressTrack: { flex: 1, height: 6, backgroundColor: colors.borderLight, borderRadius: 3, marginHorizontal: 12 },
  progressFill: { height: '100%', backgroundColor: colors.success, borderRadius: 3 },
  xpText: { ...typography.bold, fontSize: 14, color: colors.accentDark },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  stepContainer: { flex: 1 },
  tag: { fontSize: 11, fontWeight: '600', color: colors.primary, backgroundColor: '#eef2ff', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 12 },
  iconContainer: { width: 60, height: 60, borderRadius: 18, backgroundColor: '#eef2ff', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  iconEmoji: { fontSize: 30 },
  title: { ...typography.extraBold, fontSize: 19, color: colors.textPrimary, marginBottom: 6 },
  subtitle: { ...typography.regular, fontSize: 13, color: colors.textSecondary, marginBottom: 14, lineHeight: 18 },
  bodyText: { ...typography.regular, fontSize: 13, color: colors.textPrimary, lineHeight: 20, marginBottom: 12 },
  sectionTitle: { ...typography.bold, fontSize: 14, color: colors.textPrimary, marginTop: 16, marginBottom: 8 },
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  cardBlue: { backgroundColor: '#eff6ff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#bfdbfe' },
  cardGreen: { backgroundColor: '#f0fdf4', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#bbf7d0' },
  cardYellow: { backgroundColor: '#fefce8', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#fde68a' },
  cardTitle: { ...typography.bold, fontSize: 13, color: colors.textPrimary, marginBottom: 6 },
  cardText: { ...typography.regular, fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
  highlightBox: { borderLeftWidth: 3, borderLeftColor: colors.primary, padding: 11, backgroundColor: '#eff6ff', marginVertical: 10, borderRadius: 4 },
  highlightText: { ...typography.regular, fontSize: 13, color: colors.primaryDark, lineHeight: 20 },
  warningBox: { borderLeftWidth: 3, borderLeftColor: colors.error, padding: 11, backgroundColor: '#fef2f2', marginVertical: 10, borderRadius: 4 },
  warningText: { ...typography.regular, fontSize: 13, color: '#991b1b', lineHeight: 20 },
  tipBox: { borderLeftWidth: 3, borderLeftColor: colors.success, padding: 11, backgroundColor: '#f0fdf4', marginVertical: 10, borderRadius: 4 },
  tipText: { ...typography.regular, fontSize: 13, color: '#166534', lineHeight: 20 },
  curiosityBox: { borderLeftWidth: 3, borderLeftColor: colors.secondary, padding: 11, backgroundColor: '#fdf4ff', marginVertical: 10, borderRadius: 4 },
  curiosityText: { ...typography.regular, fontSize: 13, color: colors.secondaryDark, lineHeight: 20 },
  funBox: { borderLeftWidth: 3, borderLeftColor: colors.accent, padding: 11, backgroundColor: '#fffbeb', marginVertical: 10, borderRadius: 4 },
  funText: { ...typography.regular, fontSize: 13, color: colors.accentDark, lineHeight: 20 },
  stepList: { marginTop: 8 },
  stepItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, gap: 8 },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  stepNumText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  stepText: { flex: 1, ...typography.regular, fontSize: 13, color: colors.textPrimary, lineHeight: 20 },
  vsGrid: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  vsCol: { flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border },
  vsHeader: { ...typography.bold, fontSize: 12, marginBottom: 8, textAlign: 'center' },
  vsItem: { ...typography.regular, fontSize: 11, color: colors.textPrimary, marginBottom: 4 },
  scenarioBox: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 12, padding: 14, marginVertical: 10 },
  scenarioLabel: { ...typography.bold, fontSize: 10, color: colors.accentDark, marginBottom: 4, textTransform: 'uppercase' },
  scenarioText: { ...typography.regular, fontSize: 13, color: colors.textPrimary, lineHeight: 20 },
  chipsPool: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, backgroundColor: colors.surfaceVariant, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, minHeight: 60 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight },
  chipSelected: { backgroundColor: '#dbeafe', borderColor: colors.primary },
  chipText: { ...typography.regular, fontSize: 12, color: colors.textPrimary },
  dropCols: { flexDirection: 'row', gap: 8, marginTop: 12 },
  dropCol: { flex: 1, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.borderLight, borderRadius: 12, padding: 8, minHeight: 100 },
  dropAI: { backgroundColor: '#f0f7ff' },
  dropHuman: { backgroundColor: '#f0fdf4' },
  dropHeader: { ...typography.bold, fontSize: 11, textAlign: 'center', marginBottom: 6 },
  dropChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  dropChip: { backgroundColor: '#dbeafe', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  dropChipText: { ...typography.regular, fontSize: 11, color: colors.primary },
  checkButton: { backgroundColor: colors.success, padding: 12, borderRadius: 11, alignItems: 'center', marginTop: 16 },
  checkButtonDisabled: { opacity: 0.4 },
  checkButtonText: { ...typography.bold, color: '#fff' },
  matchColumns: { flexDirection: 'row', gap: 12, marginTop: 12 },
  matchLeftColumn: { flex: 1, gap: 8 },
  matchRightColumn: { flex: 1, gap: 8 },
  matchLeftCard: { backgroundColor: '#eff6ff', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#bfdbfe' },
  matchRightCard: { backgroundColor: '#fdf4ff', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e9d5ff' },
  matchSelected: { borderColor: colors.primary, borderWidth: 2 },
  matchMatched: { backgroundColor: '#dcfce7', borderColor: colors.success },
  matchText: { ...typography.regular, fontSize: 12, color: colors.textPrimary },
  sortItem: { flexDirection: 'row', alignItems: 'center', padding: 11, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  sortNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, color: '#fff', textAlign: 'center', lineHeight: 26, ...typography.bold, fontSize: 11, marginRight: 9 },
  sortText: { flex: 1, ...typography.regular, fontSize: 12, color: colors.textPrimary },
  sortArrows: { flexDirection: 'column', gap: 3 },
  sortBtn: { width: 28, height: 26, borderRadius: 7, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
  quizCard: { marginBottom: 16 },
  quizQuestion: { ...typography.bold, fontSize: 14, color: colors.textPrimary, marginBottom: 8, padding: 12, backgroundColor: colors.surfaceVariant, borderRadius: 10 },
  quizOption: { flexDirection: 'row', alignItems: 'center', padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 11, marginBottom: 6, gap: 10 },
  quizOptionSelected: { borderColor: colors.primary, backgroundColor: '#eff6ff' },
  quizOptionCorrect: { borderColor: colors.success, backgroundColor: '#dcfce7', borderWidth: 2 },
  quizOptionWrong: { borderColor: colors.error, backgroundColor: '#fee2e2', borderWidth: 2 },
  explainText: { ...typography.regular, fontSize: 12, color: '#374151', lineHeight: 18, marginTop: 6, paddingHorizontal: 4, fontStyle: 'italic' },
  quizLetter: { width: 26, height: 26, borderRadius: 8, backgroundColor: '#f3f4f6', textAlign: 'center', lineHeight: 26, ...typography.bold },
  quizOptText: { flex: 1, ...typography.regular, fontSize: 13, color: colors.textPrimary },
  tfSet: { marginBottom: 14 },
  tfQuestion: { ...typography.bold, fontSize: 13, color: colors.textPrimary, marginBottom: 8, padding: 11, backgroundColor: colors.surfaceVariant, borderRadius: 10 },
  tfOpts: { flexDirection: 'row', gap: 7 },
  tfBtn: { flex: 1, padding: 12, borderRadius: 11, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center' },
  tfBtnTrue: { borderColor: colors.success, backgroundColor: '#f0fdf4' },
  tfBtnFalse: { borderColor: colors.error, backgroundColor: '#fff1f2' },
  tfBtnResultCorrect: { borderColor: colors.success, backgroundColor: '#dcfce7', borderWidth: 2 },
  tfBtnResultWrong: { borderColor: colors.error, backgroundColor: '#fee2e2', borderWidth: 2 },
  fillSentence: { backgroundColor: '#f0f9ff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#bae6fd', marginBottom: 11 },
  fillOpts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  fillOpt: { padding: 8, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  fillOptSelected: { borderColor: colors.primary, backgroundColor: '#e0f2fe' },
  fillOptCorrect: { borderColor: colors.success, backgroundColor: '#dcfce7', borderWidth: 2 },
  fillOptWrong: { borderColor: colors.error, backgroundColor: '#fee2e2', borderWidth: 2 },
  textArea: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, ...typography.regular, fontSize: 13, color: colors.textPrimary, textAlignVertical: 'top', minHeight: 100, backgroundColor: '#fafafa' },
  charCount: { ...typography.regular, fontSize: 11, color: colors.textSecondary, textAlign: 'right', marginTop: 4 },
  completeContainer: { alignItems: 'center', padding: 20 },
  completeBadgeText: { fontSize: 44, marginBottom: 14 },
  completeTitle: { ...typography.extraBold, fontSize: 21, color: colors.textPrimary, marginBottom: 6 },
  completeSub: { ...typography.regular, fontSize: 12, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  xpEarnedText: { ...typography.bold, fontSize: 15, color: colors.accentDark, marginBottom: 14 },
  nextLevelButton: { backgroundColor: colors.primary, padding: 14, borderRadius: 11, width: '100%', alignItems: 'center' },
  nextLevelText: { ...typography.bold, color: '#fff' },
  nextButton: { backgroundColor: colors.success, padding: 14, margin: 16, borderRadius: 11, alignItems: 'center' },
  nextButtonText: { ...typography.bold, color: '#fff', fontSize: 15 },
  footerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  backButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 14, borderRadius: 11, alignItems: 'center', paddingHorizontal: 20 },
  backButtonText: { ...typography.bold, color: colors.textSecondary, fontSize: 15 },
  nextButtonFlex: { flex: 1, margin: 0 },
  exampleCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, marginBottom: 8 },
  exampleCardActive: { borderColor: colors.primary, backgroundColor: '#eff6ff' },
  exampleHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exampleEmoji: { fontSize: 24, width: 38, height: 38, textAlign: 'center', lineHeight: 38, backgroundColor: '#f3f4f6', borderRadius: 10 },
  exampleName: { ...typography.bold, fontSize: 13, color: colors.textPrimary },
  exampleApp: { ...typography.regular, fontSize: 11, color: colors.textSecondary },
  exampleArrow: { fontSize: 18, color: colors.textSecondary },
  exampleDetail: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#bfdbfe' },
  exampleDetailText: { ...typography.regular, fontSize: 12, color: colors.textPrimary, lineHeight: 18 },
  exampleFact: { marginTop: 8, ...typography.regular, fontSize: 12, backgroundColor: '#fef9c3', padding: 7, borderRadius: 8, color: colors.accentDark },
  resultBanner: { margin: 16, padding: 14, borderRadius: 14, borderWidth: 1 },
  resultBannerOk: { backgroundColor: '#dcfce7', borderColor: colors.success },
  resultBannerErr: { backgroundColor: '#fee2e2', borderColor: colors.error },
  resultBannerText: { ...typography.bold, fontSize: 13, color: colors.textPrimary, lineHeight: 20 },
});