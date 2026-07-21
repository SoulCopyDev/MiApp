import { exitLevel } from '../utils/exitLevel';
import { router } from 'expo-router';
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
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useGameStore } from '../store/gameStore';
import { useReportProgress } from '../components/LevelProgress';
import { colors, typography } from '../theme';
import XPToast from '../components/XPToast';
import { pickN, shuffle } from '../utils/shuffle';

type DragItem = { text: string; correct: string };
type MatchPair = { left: string; right: string };
type QuizQuestion = { q: string; opts: string[]; correct: number; explain: string };
type TFItem = { stmt: string; correct: boolean; explain: string };
type FillItem = {
  sentence: string;
  allOpts: string[];
  correct: { [blankId: string]: number };
  explain: string;
};

const TOTAL_STEPS = 13;

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
  { left: 'ChatGPT escribe texto en perfecto español', right: 'Aprendió los patrones de escritura de millones de textos en tu idioma' },
  { left: 'Google Maps predice el trancón antes de que empiece', right: 'Analizó años de datos GPS de millones de conductores en esa ruta' },
  { left: 'YouTube sabe exactamente cuándo te vas a aburrir de un video', right: 'Midió el segundo exacto donde millones de personas abandonan videos similares' },
  { left: 'Face ID te desbloquea en la oscuridad', right: 'Usa puntos de luz infrarrojos invisibles para mapear tu cara en 3D' },
  { left: 'Tu celular corrige automáticamente lo que escribes', right: 'Predice qué palabra es más probable que siga, millones de veces' },
  { left: 'Netflix sabe qué serie vas a ver después', right: 'Encontró usuarios con historial de series idéntico al tuyo y copió sus elecciones' },
];

const QUIZ_POOL: QuizQuestion[] = [
  {
    q: 'Una IA aprendió a reconocer perros viendo 5 millones de fotos. Ahora le muestras una foto de un lobo. ¿Qué pasa?',
    opts: ['La reconoce perfectamente porque un lobo se parece a un perro', 'Puede confundir el lobo con un perro — nunca vio lobos en su entrenamiento', 'Dice "no sé" porque sabe que no tiene suficiente información', 'Aprende sola en tiempo real que es un lobo con solo verlo una vez'],
    correct: 1,
    explain: 'La IA solo conoce lo que vio durante el entrenamiento. Sin lobos en los datos, predice lo más parecido que conoce (perro). No admite ignorancia — simplemente adivina lo más cercano.',
  },
  {
    q: '¿Cuál de estas cosas es IMPOSIBLE para cualquier IA de hoy?',
    opts: ['Componer una canción completa con letra y melodía en 3 minutos', 'Diagnosticar enfermedades analizando radiografías con 90% de precisión', 'Sentir genuinamente orgullo cuando ayuda a alguien', 'Traducir una novela de 400 páginas en menos de 10 minutos'],
    correct: 2,
    explain: 'La IA puede componer música, diagnosticar y traducir — ya lo hace. Pero sentir orgullo, amor o miedo de verdad es imposible. Solo genera texto que describe emociones. No hay nada dentro que sienta.',
  },
  {
    q: 'Tu amigo usó ChatGPT para un trabajo de historia y la profesora dice que varios datos están inventados. ¿Por qué pasó esto?',
    opts: ['ChatGPT tiene internet limitado y no encontró las fuentes', 'La profesora está equivocada, ChatGPT es más confiable que los libros', 'ChatGPT predice texto probable — no verifica si los datos son reales', 'ChatGPT solo tiene información reciente y los eventos eran muy antiguos'],
    correct: 2,
    explain: 'Esto se llama "alucinación". ChatGPT predice qué texto suena probable dado el contexto. Puede inventar fechas, nombres y estadísticas que suenan perfectamente reales pero son falsas. ¡Siempre verifica datos importantes!',
  },
  {
    q: 'Spotify te recomienda una canción que nunca escuchaste y te encanta. ¿Qué hizo la IA?',
    opts: ['Un músico humano de Spotify eligió la canción personalmente para ti', 'La IA buscó en internet la canción más popular del momento', 'Encontró miles de usuarios con gustos parecidos a ti y recomendó lo que a ellos les gustó', 'La IA leyó tu mente usando el micrófono del celular'],
    correct: 2,
    explain: 'Filtrado colaborativo: la IA encuentra personas con historial musical casi idéntico al tuyo y recomienda lo que a ellos les encantó. No lee mentes — lee patrones de comportamiento de millones de usuarios.',
  },
  {
    q: '¿Cuál es la diferencia más importante entre una IA y una calculadora?',
    opts: ['La calculadora es más rápida para sumar números', 'La IA aprendió de ejemplos sin que nadie le programara reglas exactas', 'La calculadora puede aprender sola con el tiempo', 'La IA solo funciona conectada a internet'],
    correct: 1,
    explain: 'La calculadora sigue reglas que alguien programó. La IA nunca tuvo reglas escritas — aprendió viendo millones de ejemplos y encontrando patrones por sí sola. Eso la hace flexible y poderosa.',
  },
  {
    q: 'Google Maps dice que llegarás en 20 minutos, pero hay un partido de fútbol esta noche. ¿Qué debería hacer la IA?',
    opts: ['Ignorar el partido porque no tiene relación con el tráfico', 'Tomar en cuenta el partido — los datos históricos muestran que hay más trancón esa noche', 'Preguntar al usuario si piensa ir al partido', 'Mostrar siempre 20 minutos extra por si acaso'],
    correct: 1,
    explain: 'Google Maps usa datos históricos de eventos: sabe que un martes con partido hay 40% más tráfico en ciertas vías. La IA combina múltiples factores, no solo el tráfico actual.',
  },
  {
    q: 'Una IA fue entrenada solo con votos de personas en Colombia. ¿Qué problema puede tener?',
    opts: ['Funcionará perfectamente en cualquier país del mundo', 'Solo podrá hacer predicciones sobre política colombiana', 'Puede ser muy imprecisa cuando la usen en otros países con contextos diferentes', 'La IA aprenderá sola a adaptarse a otros países sin necesitar más entrenamiento'],
    correct: 2,
    explain: 'La IA solo conoce lo que vio durante el entrenamiento. Si aprendió con datos de un solo país, sus predicciones en otros países pueden ser incorrectas. Los datos del entrenamiento definen sus límites.',
  },
  {
    q: 'TikTok te muestra videos de gatitos seguidos. ¿Qué información usó la IA para decidir esto?',
    opts: ['Leyó tu historial de búsquedas en Google', 'Un empleado de TikTok revisó tu perfil y eligió el contenido', 'Notó que pausas el scroll, repites videos y duras más tiempo con gatitos', 'La IA simplemente muestra lo más popular del momento'],
    correct: 2,
    explain: 'TikTok analiza más de 200 señales por usuario: cuántos segundos ves cada video, si lo repites, si pausas, qué hora es. Con esas señales detecta exactamente qué tipo de contenido te engancha más.',
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
  { sentence: 'La IA aprende mirando millones de ___, no siguiendo reglas escritas.', allOpts: ['ejemplos', 'instrucciones', 'libros', 'películas'], correct: { fb0: 0 }, explain: 'La IA aprende de ejemplos — no de reglas escritas. Eso es lo que la hace diferente de una calculadora.' },
  { sentence: 'ChatGPT no "piensa" — ___ qué palabras son más probables.', allOpts: ['predice', 'inventa', 'busca', 'copia'], correct: { fb0: 0 }, explain: 'ChatGPT predice probabilidades matemáticas. Por eso puede cometer errores — no verifica, solo predice.' },
  { sentence: 'Spotify usa datos de ___ de usuarios para recomendarte canciones.', allOpts: ['millones', 'decenas', 'cientos', 'miles'], correct: { fb0: 0 }, explain: 'El poder de la IA viene de escala — millones de datos permiten encontrar patrones imposibles de ver con pocos ejemplos.' },
  { sentence: 'La IA no puede sentir ___ reales — solo predice palabras sobre ellas.', allOpts: ['emociones', 'números', 'idiomas', 'datos'], correct: { fb0: 0 }, explain: 'Esta es la diferencia más importante: la IA no tiene experiencia interna. Todo lo que produce es predicción matemática.' },
  { sentence: 'Cuando la IA falla porque nunca vio ese tipo de dato, se llama error de ___.', allOpts: ['entrenamiento', 'código', 'memoria', 'internet'], correct: { fb0: 0 }, explain: 'El entrenamiento define los límites de la IA. Si nunca vio lobos, no puede reconocerlos aunque se parezcan a los perros que sí conoce.' },
];

// Texto bold + rest para renderizar con formato
const SORT_ITEMS = [
  { bold: 'Recopilar datos:', rest: ' Juntar millones de ejemplos (fotos, textos, audios)' },
  { bold: 'Etiquetar:', rest: ' Marcar cuáles son correctos ("esto SÍ es gato, esto NO")' },
  { bold: 'Entrenar:', rest: ' El modelo ve cada ejemplo e intenta predecir el resultado' },
  { bold: 'Corregir:', rest: ' Se le dice si acertó o falló, y ajusta sus números internos' },
  { bold: 'Desplegar:', rest: ' Ya entrenado, puede responder bien a situaciones nuevas' },
];


export default function GameLevel1() {
  const [step, setStep] = useState(0);
  useReportProgress(step, TOTAL_STEPS);
  const [xp, setXp] = useState(0);
  const completeLevel = useGameStore((state) => state.completeLevel);
  const devMode = useGameStore((state) => state.devMode);

  const [dragItems] = useState(() => pickN(DRAG_POOL, 8));
  const [matchPairs] = useState(() => pickN(MATCH_POOL, 4));
  const [quizQuestions] = useState(() => pickN(QUIZ_POOL, 4));
  const [tfItems] = useState(() => pickN(TF_POOL, 5));
  const [fillItem] = useState(() => pickN(FILL_POOL, 1)[0]);

  const [dragPlaced, setDragPlaced] = useState<{ [key: number]: string }>({});
  const [dragSel, setDragSel] = useState<number | null>(null);
  const [dragAttempts, setDragAttempts] = useState(0);
  const [dragOk, setDragOk] = useState(false);
  const dragIdxRef = useRef<number | null>(null);
  const [dragOverZone, setDragOverZone] = useState<string | null>(null);

  const [matchLeft, setMatchLeft] = useState<number | null>(null);
  const [matchDone, setMatchDone] = useState(0);
  const [rightOrder, setRightOrder] = useState<string[]>([]);
  const [matchedLeft, setMatchedLeft] = useState<Set<number>>(new Set());
  const [matchedRight, setMatchedRight] = useState<Set<number>>(new Set());

  const [sortOrder, setSortOrder] = useState<number[]>([]);
  const [sortOk, setSortOk] = useState(false);
  const [sortItemFeedback, setSortItemFeedback] = useState<{ [pos: number]: 'ok' | 'bad' }>({});

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

  useEffect(() => {
    const onBackPress = () => {
      if (isExamMode) {
        Alert.alert(
          'Examen en curso',
          'No puedes regresar mientras realizas el examen. Si sales, perderás el progreso no guardado.',
          [{ text: 'Cancelar', style: 'cancel' }, { text: 'Salir', style: 'destructive', onPress: () => exitLevel({ confirm: false }) }]
        );
        return true;
      }
      return false;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [isExamMode]);

  useEffect(() => {
    if (step === 5) {
      setRightOrder(shuffle(matchPairs.map(p => p.right)));
      setMatchLeft(null); setMatchDone(0);
      setMatchedLeft(new Set()); setMatchedRight(new Set());
    }
    if (step === 7) {
      const order = [0, 1, 2, 3, 4];
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      setSortOrder(order);
      setSortOk(false);
      setSortItemFeedback({});
    }
  }, [step, matchPairs]);

  // Mirror dragPlaced to a ref so drag handlers always see the latest value
  const dragPlacedRef = useRef(dragPlaced);
  useEffect(() => { dragPlacedRef.current = dragPlaced; }, [dragPlaced]);

  // Web-only: attach HTML5 drag & drop listeners directly to DOM nodes (guaranteed to work in RN Web)
  useEffect(() => {
    if (Platform.OS !== 'web' || step !== 4) return;
    const cleanups: (() => void)[] = [];

    const setup = () => {
      dragItems.forEach((_, idx) => {
        if (dragPlacedRef.current[idx] !== undefined) return;
        const el = document.getElementById(`drag-chip-${idx}`);
        if (!el) return;
        el.setAttribute('draggable', 'true');
        (el as HTMLElement).style.cursor = 'grab';
        const onDragStart = (e: DragEvent) => {
          dragIdxRef.current = idx;
          setDragSel(null);
          if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
        };
        const onDragEnd = () => { dragIdxRef.current = null; setDragOverZone(null); };
        el.addEventListener('dragstart', onDragStart);
        el.addEventListener('dragend', onDragEnd);
        cleanups.push(() => {
          el.removeEventListener('dragstart', onDragStart);
          el.removeEventListener('dragend', onDragEnd);
        });
      });

      (['ai', 'human'] as const).forEach(zone => {
        const el = document.getElementById(`drop-zone-${zone}`);
        if (!el) return;
        const onDragOver = (e: Event) => { e.preventDefault(); setDragOverZone(zone); };
        const onDragLeave = (e: DragEvent) => {
          if (!el.contains(e.relatedTarget as Node)) setDragOverZone(null);
        };
        const onDrop = (e: Event) => {
          e.preventDefault();
          setDragOverZone(null);
          const idx = dragIdxRef.current;
          if (idx === null || dragPlacedRef.current[idx] !== undefined) return;
          setDragPlaced(prev => ({ ...prev, [idx]: zone }));
          setStepResult(null);
          dragIdxRef.current = null;
        };
        el.addEventListener('dragover', onDragOver);
        el.addEventListener('dragleave', onDragLeave);
        el.addEventListener('drop', onDrop);
        cleanups.push(() => {
          el.removeEventListener('dragover', onDragOver);
          el.removeEventListener('dragleave', onDragLeave);
          el.removeEventListener('drop', onDrop);
        });
      });
    };

    // Small delay to ensure React has finished rendering DOM nodes
    const timer = setTimeout(setup, 50);
    return () => {
      clearTimeout(timer);
      cleanups.forEach(fn => fn());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, dragItems, dragPlaced]);

  const [xpToast, setXpToast] = useState<{ amount: number; id: number } | null>(null);
  const addXP = (amount: number) => {
    setXp(prev => prev + amount);
    if (amount > 0) setXpToast(prev => ({ amount, id: (prev?.id ?? 0) + 1 }));
  };

  const goToNextStep = () => { setStepResult(null); if (step < TOTAL_STEPS - 1) setStep(step + 1); };
  const showResult = (ok: boolean, msg: string) => setStepResult({ ok, msg });

  const handleClose = () => {
    if (Platform.OS === 'web') {
      const msg = isExamMode
        ? 'Estás en medio del examen. Si sales, perderás el progreso. ¿Seguro?'
        : '¿Seguro que quieres salir del nivel? Perderás el progreso no guardado.';
      if (window.confirm(msg)) exitLevel({ confirm: false });
      return;
    }
    if (isExamMode) {
      Alert.alert('Examen en curso', 'Estás en medio del examen. Si sales, perderás todo el progreso de este nivel. ¿Seguro que quieres salir?',
        [{ text: 'Cancelar', style: 'cancel' }, { text: 'Salir', style: 'destructive', onPress: () => exitLevel({ confirm: false }) }]);
    } else {
      Alert.alert('Salir', '¿Seguro que quieres salir del juego? Perderás el progreso no guardado.',
        [{ text: 'Cancelar', style: 'cancel' }, { text: 'Salir', onPress: () => exitLevel({ confirm: false }) }]);
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
    setDragPlaced(prev => ({ ...prev, [dragSel]: zone }));
    setDragSel(null); setStepResult(null);
  };

  const handleRemoveChip = (idx: number) => {
    setDragPlaced(prev => { const n = { ...prev }; delete n[idx]; return n; });
  };

  const checkDrag = () => {
    if (devMode) { setDragOk(true); addXP(20); return true; }
    if (dragOk) return true;
    const placedCount = Object.keys(dragPlaced).length;
    if (placedCount < dragItems.length) {
      showResult(false, `Faltan ${dragItems.length - placedCount} tarjetas. Toca un chip y luego toca la columna donde cae.`);
      return false;
    }
    setDragAttempts(prev => prev + 1);
    let correct = 0; const wrongIndices: number[] = [];
    Object.keys(dragPlaced).forEach(k => {
      const i = parseInt(k);
      if (dragPlaced[i] === dragItems[i].correct) correct++;
      else wrongIndices.push(i);
    });
    if (correct === dragItems.length) {
      setDragOk(true);
      const earned = dragAttempts === 0 ? 20 : 10;
      addXP(earned);
      showResult(true, `¡Genial! Clasificaste las ${dragItems.length} habilidades correctamente. +${earned} XP 🎉${dragAttempts === 0 ? ' (¡primer intento!)' : ''}`);
      return false;
    } else {
      showResult(false, `${correct} de ${dragItems.length} correctas. Las incorrectas vuelven al banco. ¡Inténtalo de nuevo!`);
      const newPlaced = { ...dragPlaced };
      wrongIndices.forEach(i => delete newPlaced[i]);
      setDragPlaced(newPlaced);
      return false;
    }
  };

  // ---------- Matching ----------
  const handleLeftClick = (idx: number) => {
    if (matchedLeft.has(idx)) return;
    setStepResult(null); setMatchLeft(idx);
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
        showResult(true, '¡Excelente! Conectaste todos los pares correctamente. +15 XP 🎉');
      } else {
        showResult(true, `¡Par correcto! ${newCount} de ${matchPairs.length} conectados. 🎯`);
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
      setSortOk(true); addXP(15);
      showResult(true, '¡Perfecto! Ese es exactamente el orden en que una IA aprende. +15 XP 🎉');
      return false;
    } else {
      const feedback: { [pos: number]: 'ok' | 'bad' } = {};
      sortOrder.forEach((v, i) => { feedback[i] = v === i ? 'ok' : 'bad'; });
      const wrongCount = sortOrder.filter((v, i) => v !== i).length;
      showResult(false, `${wrongCount} de 5 pasos fuera de lugar. Usa ▲▼ para ajustar. ¡Piensa: ¿qué necesitas hacer primero?`);
      setSortItemFeedback(feedback);
      setTimeout(() => setSortItemFeedback({}), 2200);
      return false;
    }
  };

  // ---------- Quiz ----------
  const selectQuiz = (qIdx: number, optIdx: number) => { if (quizChecked) return; setQuizAnswers(prev => ({ ...prev, [qIdx]: optIdx })); };

  const checkQuiz = () => {
    if (devMode) { setQuizChecked(true); addXP(32); return true; }
    if (quizChecked) return true;
    if (Object.keys(quizAnswers).length < quizQuestions.length) {
      showResult(false, 'Incompleto. Responde todas las preguntas primero.'); return false;
    }
    setQuizChecked(true);
    let correct = 0;
    quizQuestions.forEach((q, idx) => { if (quizAnswers[idx] === q.correct) correct++; });
    const earned = correct * 8;
    if (earned > 0) addXP(earned);
    showResult(true, `Resultado: ${correct} de ${quizQuestions.length} correctas. +${earned} XP`);
    return false;
  };

  // ---------- True/False ----------
  const selectTF = (qIdx: number, val: boolean) => { if (tfChecked) return; setTfAnswers(prev => ({ ...prev, [qIdx]: val })); };

  const checkTF = () => {
    if (devMode) { setTfChecked(true); addXP(25); return true; }
    if (tfChecked) return true;
    if (Object.keys(tfAnswers).length < tfItems.length) {
      showResult(false, 'Incompleto. Responde todas las afirmaciones.'); return false;
    }
    setTfChecked(true);
    let correct = 0;
    tfItems.forEach((item, idx) => { if (tfAnswers[idx] === item.correct) correct++; });
    const earned = correct * 5;
    if (earned > 0) addXP(earned);
    showResult(true, `Resultado: ${correct} de ${tfItems.length} correctas. +${earned} XP`);
    return false;
  };

  // ---------- Fill blank ----------
  const selectFill = (idx: number) => { if (fillChecked) return; setFillSel(idx); };

  const checkFill = () => {
    if (devMode) { setFillChecked(true); addXP(10); return true; }
    if (fillChecked) return true;
    if (fillSel === null) { showResult(false, 'Selecciona la palabra correcta.'); return false; }
    setFillChecked(true);
    const isOk = fillSel === fillItem.correct.fb0;
    if (isOk) {
      addXP(10);
      showResult(true, `✓ ¡Correcto! — ${fillItem.explain}`);
    } else {
      showResult(false, `✗ La palabra correcta es "${fillItem.allOpts[fillItem.correct.fb0]}" — ${fillItem.explain}`);
    }
    return false;
  };

  // ---------- Reflexión ----------
  const checkReflect = () => {
    if (reflectText.trim().length >= 60) { addXP(15); goToNextStep(); }
    else showResult(false, 'Muy corto. Escribe al menos 60 caracteres.');
  };

  // ---------- Step button texts ----------
  const getStepBtnText = () => {
    const map: { [k: number]: string } = {
      0: '¡Vamos! Empecemos 🚀',
      1: 'Entendido, sigamos →',
      2: '¡Visto todo! Sigamos →',
      3: 'Continuar →',
      6: '¡Entendido! Sigamos →',
    };
    return map[step] ?? 'Continuar →';
  };

  const getStepNote = () => {
    const map: { [k: number]: string } = {
      0: 'Tiempo estimado: 35-45 min · hasta 130 XP',
      2: 'Toca cada tarjeta para ver qué hace la IA por dentro 👆',
    };
    return map[step] ?? null;
  };

  // ---------- Render steps ----------
  const renderIntro = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.tag, styles.tagIntro]}>Nivel 1 · Módulo 1 de 10</Text>
      <View style={styles.iconContainer}><Text style={styles.iconEmoji}>🤖</Text></View>
      <Text style={styles.title}>Robots vs. Humanos</Text>
      <Text style={styles.subtitle}>
        Tu celular reconoce tu cara entre miles de personas en milésimas de segundo. Pero si le preguntas qué{' '}
        <Text style={{ fontStyle: 'italic' }}>significa</Text> una sonrisa... no tiene la menor idea. ¿Por qué puede hacer lo primero y no lo segundo? Eso es lo que vas a descubrir aquí.
      </Text>
      <View style={styles.cardBlue}>
        <View style={styles.cardRow}>
          <View style={[styles.cardIcon, { backgroundColor: '#dbeafe' }]}><Text style={styles.cardIconEmoji}>📚</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Qué vas a aprender</Text>
            <Text style={styles.cardText}>Qué es la IA y cómo aprende · Por qué no piensa ni siente · Cómo reconocerla en apps que ya usas · En qué supera a los humanos y en qué no puede competir</Text>
          </View>
        </View>
      </View>
      <View style={styles.cardGreen}>
        <View style={styles.cardRow}>
          <View style={[styles.cardIcon, { backgroundColor: '#dcfce7' }]}><Text style={styles.cardIconEmoji}>⚡</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Qué podrás HACER al terminar</Text>
            <Text style={styles.cardText}>Explicarle a cualquier persona qué es la IA con ejemplos reales de su vida — sin tecnicismos y sin mitos de películas.</Text>
          </View>
        </View>
      </View>
      <View style={styles.cardYellow}>
        <View style={styles.cardRow}>
          <View style={[styles.cardIcon, { backgroundColor: '#fef9c3' }]}><Text style={styles.cardIconEmoji}>🎮</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>10 módulos · hasta 130 XP</Text>
            <Text style={styles.cardText}>📖 Teoría · 🌍 Ejemplos reales · 🏥 Caso real · 🧩 Clasificar · 🔗 Conectar · 🔢 Ordenar pasos · ❓ Quiz · ✅ Verdadero/Falso · 💬 Completa la frase · ✍️ Reflexión</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderTheory = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.tag, styles.tagTheory]}>📖 Módulo 1 de 10 · Teoría</Text>
      <Text style={styles.title}>¿Qué es la Inteligencia Artificial?</Text>
      <Text style={styles.bodyText}>
        Cuando escuchas "Inteligencia Artificial" probablemente imaginas un robot de película con cara y a punto de rebelarse contra los humanos. Olvida eso por ahora.{' '}
        <Text style={{ fontWeight: 'bold' }}>La IA real ya está dentro de tu celular, en tus apps favoritas y en la música que escuchas</Text>
        {' '}— lleva años ahí, operando en silencio.
      </Text>
      <View style={styles.warningBox}>
        <Text style={styles.warningText}>
          <Text style={{ fontWeight: 'bold' }}>❌ El error más común:{'\n'}</Text>
          {'La IA NO piensa. NO siente. NO entiende nada de verdad.\n\nCuando ChatGPT te escribe algo brillante, no lo "pensó". Cuando Spotify te recomienda la canción perfecta, no "sintió" tu estado de ánimo. Los dos siguieron '}
          <Text style={{ fontStyle: 'italic' }}>patrones matemáticos</Text>
          {' a una velocidad que ningún humano puede igualar.'}
        </Text>
      </View>
      <View style={styles.highlightBox}>
        <Text style={styles.highlightText}>
          {'💡 '}
          <Text style={{ fontWeight: 'bold' }}>La definición fácil de recordar:{'\n'}</Text>
          {'La IA es un programa que aprendió a hacer cosas mirando millones de ejemplos hasta detectar los patrones que los explican. Sin reglas escritas. Sin intuición. Solo matemáticas repetidas millones de veces.'}
        </Text>
      </View>
      <Text style={styles.bodyText}>
        Para entenderlo mejor, piensa en cuando eras pequeño: nadie te explicó las reglas de gramática, ¿cierto? Pero escuchaste miles de frases y tu cerebro{' '}
        <Text style={{ fontWeight: 'bold' }}>detectó los patrones solo</Text>
        . Ahora hablas sin pensar en gramática. La IA hace exactamente lo mismo, pero con datos digitales y mucho más rápido.
      </Text>
      <Text style={styles.sectionTitle}>🧮 IA vs. Calculadora — la diferencia clave</Text>
      <View style={styles.vsGrid}>
        <View style={[styles.vsCol, { backgroundColor: '#eff6ff' }]}>
          <Text style={[styles.vsHeader, { backgroundColor: '#dbeafe', color: '#1e40af' }]}>🧮 Calculadora</Text>
          <Text style={styles.vsItem}>Alguien le programó reglas exactas</Text>
          <Text style={styles.vsItem}>5 + 3 = 8. Siempre. Sin excepción.</Text>
          <Text style={styles.vsItem}>No puede salirse de sus reglas</Text>
          <Text style={styles.vsItem}>Nunca aprende ni cambia</Text>
        </View>
        <View style={[styles.vsCol, { backgroundColor: '#f0fdf4' }]}>
          <Text style={[styles.vsHeader, { backgroundColor: '#dcfce7', color: '#166534' }]}>🤖 IA</Text>
          <Text style={styles.vsItem}>Nunca tuvo reglas escritas</Text>
          <Text style={styles.vsItem}>Vio millones de ejemplos y encontró patrones sola</Text>
          <Text style={styles.vsItem}>Reconoce caras sin saber qué es una nariz</Text>
          <Text style={styles.vsItem}>Mejora con más datos y correcciones</Text>
        </View>
      </View>
      <View style={styles.tipBox}>
        <Text style={styles.tipText}>
          {'✅ '}
          <Text style={{ fontWeight: 'bold' }}>Regla de oro para toda la vida:</Text>
          {' La IA no '}
          <Text style={{ fontStyle: 'italic' }}>sabe</Text>
          {' — '}
          <Text style={{ fontStyle: 'italic' }}>predice</Text>
          {'. Siempre calcula cuál es la respuesta más probable basándose en todo lo que vio. Eso explica por qué puede ser brillante en algunas cosas y completamente equivocada en otras.'}
        </Text>
      </View>
    </View>
  );

  const examples = [
    {
      emoji: '📱', name: 'TikTok', desc: 'El algoritmo más adictivo del mundo',
      detail: 'Cada vez que abres TikTok, una IA analiza más de 200 cosas de ti al mismo tiempo: cuántos segundos exactos viste el video, si lo repetiste, si pausaste, qué hora es, qué tipo de contenido viste las últimas horas...\n\n¿Lo mejor? Decide en los primeros 7 segundos si ese video te va a enganchar. Si nota que te aburres, cambia. Si nota que te quedas, anota: "este tipo de contenido funciona con esta persona".',
      fact: '⭐ TikTok tiene acceso a los patrones de más de 1,000 millones de usuarios. Por eso el tiempo promedio en la app pasó de 52 a más de 95 minutos diarios. ¡Y ahora ya sabes cómo lo hace!',
    },
    {
      emoji: '🎵', name: 'Spotify', desc: '30 canciones perfectas cada lunes',
      detail: 'Cada lunes aparece "Discover Weekly" — 30 canciones que nunca escuchaste pero van a gustarte. No hay ningún humano eligiéndolas. Una IA comparó tu historial con el de 600 millones de personas, encontró las que tienen gustos casi iguales a los tuyos, y lo que a ellas les encantó esta semana... te lo recomienda a ti.',
      fact: '⭐ El 98% de Discover Weekly es generado sin ninguna intervención humana. Quienes la usan escuchan 40% más música por semana. ¡Solo matemáticas, sin magia!',
    },
    {
      emoji: '📷', name: 'Modo retrato', desc: 'Tu cámara que "ve" personas',
      detail: 'En el modo retrato, tu celular no tiene sensor 3D ni rayos X. Lo que hace es usar una IA que analiza tu foto y separa tu cuerpo del fondo pixel por pixel, mientras mueves el celular, en tiempo real.\n\nNunca le explicaron qué es un "ser humano" o qué son "bordes". Aprendió solo mirando millones de fotos de personas en distintos fondos.',
      fact: '⭐ Apple entrenó esta IA con más de 100 millones de imágenes de personas. Analiza más de 100 capas de la imagen antes de que veas el resultado final en pantalla.',
    },
    {
      emoji: '💬', name: 'ChatGPT', desc: 'El que predice palabras con precisión increíble',
      detail: 'ChatGPT no "entiende" lo que escribes. Predice qué palabra es más probable que siga basándose en patrones de billones de textos. Lo hace tan bien y tan rápido que suena exactamente como si entendiera de verdad.\n\nPero es predicción matemática, no comprensión. Por eso puede escribir un poema perfecto Y al mismo tiempo inventar datos históricos que suenan reales pero son falsos.',
      fact: '⭐ Por eso nunca debes usar ChatGPT para datos importantes sin verificarlos. Puede inventar fechas, nombres y estadísticas con total confianza. ¡La IA no sabe que se está equivocando!',
    },
    {
      emoji: '🗺️', name: 'Google Maps', desc: 'Adivina el trancón antes de que exista',
      detail: 'Maps analiza los datos GPS de millones de celulares en tiempo real. Si detecta que 500 celulares van más lentos de lo normal en una vía... ya sabe que hay trancón. Si el patrón de un martes lluvioso a las 6pm coincide con martes lluviosos anteriores en los últimos 3 años... predice el trancón antes de que empiece.\n\nCombina datos históricos, tiempo real, clima, eventos locales y partidos de fútbol para estimar tu tiempo de llegada.',
      fact: '⭐ Google Maps procesa más de 1,000 millones de km de datos GPS al día. Su predicción de llegada tiene margen de error menor a 2 minutos en el 90% de los viajes. ¡Impresionante!',
    },
  ];

  const renderExamples = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.tag, styles.tagExample]}>🌍 Módulo 2 de 10 · Ejemplos reales</Text>
      <Text style={styles.title}>La IA que ya usas sin saberlo</Text>
      <Text style={styles.subtitle}>Estas apps las conoces. Lo que no sabías es qué está haciendo la IA por dentro. Toca cada una para descubrirlo.</Text>
      {examples.map((ex, idx) => (
        <TouchableOpacity key={idx} style={[styles.exampleCard, exampleExpanded === idx && styles.exampleCardActive]} onPress={() => setExampleExpanded(exampleExpanded === idx ? null : idx)} activeOpacity={0.7}>
          <View style={styles.exampleHeader}>
            <Text style={styles.exampleEmoji}>{ex.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.exampleName}>{ex.name}</Text>
              <Text style={styles.exampleApp}>{ex.desc}</Text>
            </View>
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
      <Text style={[styles.tag, styles.tagCase]}>🏥 Módulo 3 de 10 · Caso real</Text>
      <Text style={styles.title}>La IA que ayuda a salvar vidas</Text>
      <Text style={styles.subtitle}>¿Sabías que la IA ya trabaja en hospitales? Aquí una historia real de cómo funciona.</Text>
      <View style={styles.scenarioBox}>
        <Text style={styles.scenarioLabel}>🎬 La situación</Text>
        <Text style={styles.scenarioText}>
          Valentina es médica en una clínica de Bogotá. Su trabajo es mirar imágenes médicas llamadas{' '}
          <Text style={{ fontWeight: 'bold' }}>radiografías</Text>
          {' '}— fotos especiales en blanco y negro que muestran lo que hay dentro de tu cuerpo (tus pulmones, tu corazón, tus huesos). En un día normal, Valentina revisa más de{' '}
          <Text style={{ fontWeight: 'bold' }}>60 de estas imágenes</Text>
          . En cada una, tiene que encontrar manchas muy pequeñas que podrían indicar que algo no está bien.
        </Text>
      </View>
      <View style={styles.funBox}>
        <Text style={styles.funText}>
          {'🤔 '}
          <Text style={{ fontWeight: 'bold' }}>¿Por qué es tan difícil ese trabajo?{'\n'}</Text>
          {'Imagina pasar 8 horas mirando imágenes similares, una tras otra, buscando detalles del tamaño de una uña. El ojo humano se cansa. Un estudio médico encontró que los médicos pierden hasta el '}
          <Text style={{ fontWeight: 'bold' }}>22% de su capacidad de concentración</Text>
          {' en la segunda mitad del día. No es por descuido — es biología normal.'}
        </Text>
      </View>
      <Text style={styles.bodyText}>
        {'Hoy, Valentina trabaja con una IA llamada '}
        <Text style={{ fontWeight: 'bold' }}>CheXpert</Text>
        {'. Antes de que ella revise la imagen, la IA ya lo hizo. En '}
        <Text style={{ fontWeight: 'bold' }}>menos de 2 segundos</Text>
        {' — el tiempo que tardas en leer esta frase — CheXpert analizó miles de puntos de la imagen y marcó con colores las zonas que parecen sospechosas.'}
      </Text>
      <Text style={styles.bodyText}>
        {'¿Qué puede hacer Valentina que la IA no puede? '}
        <Text style={{ fontWeight: 'bold' }}>Conocer la historia del paciente</Text>
        {': sus síntomas, sus medicamentos, si fuma, si tuvo enfermedades antes, lo que le contó al médico y que no quedó escrito. Valentina aprendió eso con años de conversaciones con personas reales. Juntas — Valentina y la IA — son '}
        <Text style={{ fontStyle: 'italic' }}>más precisas que cualquiera sola</Text>
        {'.'}
      </Text>
      <View style={styles.curiosityBox}>
        <Text style={styles.curiosityText}>
          {'🔮 '}
          <Text style={{ fontWeight: 'bold' }}>Dato que te va a sorprender:{'\n'}</Text>
          {'La IA de Google Health detecta cáncer de pulmón en etapa temprana con '}
          <Text style={{ fontWeight: 'bold' }}>94% de precisión</Text>
          {', superando al promedio de médicos en estudios controlados. Pero en casos complejos con mucho contexto personal, los médicos siguen siendo más precisos. '}
          <Text style={{ fontWeight: 'bold' }}>La IA no reemplaza — amplifica.</Text>
        </Text>
      </View>
      <View style={styles.highlightBox}>
        <Text style={styles.highlightText}>
          {'🔗 '}
          <Text style={{ fontWeight: 'bold' }}>Conexión con lo que aprendiste:{'\n'}</Text>
          {'TikTok, Spotify y la IA médica hacen lo mismo matemáticamente: detectar patrones en millones de datos para predecir un resultado. Solo cambia qué datos usan — videos, canciones o imágenes médicas.'}
        </Text>
      </View>
    </View>
  );

  const renderDragDrop = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.tag, styles.tagActivity]}>🧩 Módulo 4 de 10 · Clasificar</Text>
      <Text style={styles.title}>¿Quién lo hace mejor?</Text>
      <Text style={styles.subtitle}>Clasifica cada habilidad: ¿la hace mejor la IA o el humano? Arrastra o toca un chip y luego toca la columna.</Text>
      <View style={styles.chipsPool}>
        {dragItems.map((item, idx) => {
          if (dragPlaced[idx] !== undefined) return null;
          return (
            <TouchableOpacity
              key={idx}
              id={`drag-chip-${idx}`}
              style={[styles.chip, dragSel === idx && styles.chipSelected]}
              onPress={() => handleChipPress(idx)}
            >
              <Text style={styles.chipText}>{item.text}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.dropCols}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.dropHeader, { backgroundColor: '#dbeafe', color: '#1e40af' }]}>🤖 IA</Text>
          <TouchableOpacity
            id="drop-zone-ai"
            style={[styles.dropCol, styles.dropAI, dragOverZone === 'ai' && styles.dropColDragOver]}
            onPress={() => handleDropZone('ai')}
          >
            <View style={styles.dropChips}>
              {Object.entries(dragPlaced).map(([idxStr, zone]) => {
                if (zone !== 'ai') return null;
                const i = parseInt(idxStr);
                return (
                  <TouchableOpacity key={i} style={styles.dropChipAI} onPress={() => handleRemoveChip(i)}>
                    <Text style={styles.dropChipTextAI}>{dragItems[i].text} ✕</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.dropHeader, { backgroundColor: '#dcfce7', color: '#166534' }]}>🧠 Humano</Text>
          <TouchableOpacity
            id="drop-zone-human"
            style={[styles.dropCol, styles.dropHuman, dragOverZone === 'human' && styles.dropColDragOver]}
            onPress={() => handleDropZone('human')}
          >
            <View style={styles.dropChips}>
              {Object.entries(dragPlaced).map(([idxStr, zone]) => {
                if (zone !== 'human') return null;
                const i = parseInt(idxStr);
                return (
                  <TouchableOpacity key={i} style={styles.dropChipHuman} onPress={() => handleRemoveChip(i)}>
                    <Text style={styles.dropChipTextHuman}>{dragItems[i].text} ✕</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        </View>
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
      <Text style={styles.btnNote}>Toca un chip → toca la columna. O arrastralo directamente. 👇</Text>
    </View>
  );

  const renderMatching = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.tag, styles.tagActivity]}>🔗 Módulo 5 de 10 · Conectar</Text>
      <Text style={styles.title}>¿Por qué puede hacer eso?</Text>
      <Text style={styles.subtitle}>Cada capacidad tiene una razón técnica. Conéctalas tocando primero la tarjeta azul y luego la morada que la explica.</Text>
      <View style={styles.instructionCard}>
        <Text style={styles.instructionText}>① Toca azul (izquierda) → ② Toca morada (derecha) que la explica → Si aciertas, ambas se vuelven verdes ✓</Text>
      </View>
      <View style={styles.matchColLabels}>
        <Text style={styles.matchColLabel}>¿Qué hace la IA?</Text>
        <Text style={styles.matchColLabel}>¿Por qué puede hacerlo?</Text>
      </View>
      <View style={styles.matchColumns}>
        <View style={styles.matchLeftColumn}>
          {matchPairs.map((pair, leftIdx) => (
            <TouchableOpacity
              key={leftIdx}
              style={[styles.matchLeftCard, matchLeft === leftIdx && styles.matchSelected, matchedLeft.has(leftIdx) && styles.matchMatched]}
              onPress={() => handleLeftClick(leftIdx)}
              disabled={matchedLeft.has(leftIdx)}
            >
              <Text style={styles.matchText}>{pair.left}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.matchRightColumn}>
          {rightOrder.map((rightText, rightIdx) => (
            <TouchableOpacity
              key={rightIdx}
              style={[styles.matchRightCard, matchedRight.has(rightIdx) && styles.matchMatched]}
              onPress={() => handleRightClick(rightIdx)}
              disabled={matchedRight.has(rightIdx)}
            >
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
      <Text style={[styles.tag, styles.tagTheory]}>🔢 Módulo 6 de 10 · Cómo aprende la IA</Text>
      <Text style={styles.title}>El secreto de cómo aprende una IA</Text>
      <Text style={styles.subtitle}>Antes de ordenar los pasos, es importante entender muy bien cómo aprende una IA por dentro. Lee esto con cuidado — lo vas a necesitar en el siguiente módulo.</Text>
      <View style={styles.funBox}>
        <Text style={styles.funText}>
          {'🐱 '}
          <Text style={{ fontWeight: 'bold' }}>El ejemplo del gato — para entenderlo de una vez{'\n'}</Text>
          {'Imagina que quieres enseñarle a una IA a reconocer gatos. ¿Cómo lo harías? No puedes escribir una regla como "los gatos tienen bigotes" porque hay gatos sin bigotes, y hay otras cosas con bigotes que no son gatos. En cambio, le muestras '}
          <Text style={{ fontWeight: 'bold' }}>millones de fotos</Text>
          {' — algunas de gatos, otras de cosas que NO son gatos — y le dices cuáles son cuáles. La IA empieza a encontrar los patrones sola.'}
        </Text>
      </View>
      <Text style={styles.sectionTitle}>Los 5 pasos del aprendizaje de una IA</Text>
      <View style={styles.stepList}>
        {[
          { bold: 'Recopilar datos:', rest: ' Juntar millones de ejemplos — fotos, textos, audios, videos. Sin datos, no hay nada que aprender.', ex: 'Ejemplo: 10 millones de fotos de gatos y de cosas que no son gatos.' },
          { bold: 'Etiquetar:', rest: ' Marcar cuáles datos son correctos. Alguien tiene que decirle: "esta SÍ es gato, esta NO". Sin etiquetas, la IA no sabe qué está aprendiendo.', ex: 'Ejemplo: personas que revisaron millones de fotos y las marcaron.' },
          { bold: 'Entrenar:', rest: ' El modelo ve cada ejemplo e intenta predecir si es un gato o no. Al principio falla mucho — ¡y está bien! Eso es normal.', ex: 'Ejemplo: la IA dice "esto es gato" y se equivoca 7 de cada 10 veces al inicio.' },
          { bold: 'Corregir:', rest: ' Se le dice si acertó o falló, y ajusta sus números internos. Esto pasa millones de veces hasta que los errores se reducen.', ex: 'Ejemplo: después de ver 50 millones de fotos, acierta 9 de cada 10 veces.' },
          { bold: 'Desplegar:', rest: ' Ya entrenado, puede responder bien a situaciones que nunca vio antes.', ex: 'Ejemplo: reconoce un gato en una foto nueva que nunca existió durante el entrenamiento.' },
        ].map((item, i) => (
          <View key={i} style={styles.stepItem}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepText}>
                <Text style={{ fontWeight: 'bold' }}>{item.bold}</Text>
                {item.rest}
              </Text>
              <Text style={styles.stepTextEx}>{item.ex}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={styles.curiosityBox}>
        <Text style={styles.curiosityText}>
          {'🔮 '}
          <Text style={{ fontWeight: 'bold' }}>¿Cuánto tiempo tarda esto?{'\n'}</Text>
          {'Entrenar una IA grande como GPT-4 tarda '}
          <Text style={{ fontWeight: 'bold' }}>semanas o meses</Text>
          {' usando miles de computadoras al mismo tiempo. El entrenamiento de un solo modelo puede costar más de 100 millones de dólares. Por eso las IAs no aprenden "en tiempo real" cuando las usas — ya vienen entrenadas.'}
        </Text>
      </View>
      <View style={styles.tipBox}>
        <Text style={styles.tipText}>
          {'💡 '}
          <Text style={{ fontWeight: 'bold' }}>El orden importa mucho:{'\n'}</Text>
          {'No puedes entrenar sin datos. No puedes desplegar sin entrenar. No puedes etiquetar sin datos. Cada paso necesita al anterior para funcionar. En el siguiente módulo vas a demostrar que entendiste este orden.'}
        </Text>
      </View>
    </View>
  );

  const renderSort = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.tag, styles.tagActivity]}>↕️ Módulo 7 de 10 · Ordenar</Text>
      <Text style={styles.title}>¿En qué orden aprende una IA?</Text>
      <Text style={styles.subtitle}>Estos 5 pasos están mezclados. Usa ▲▼ para ponerlos en el orden correcto. Recuerda: cada paso necesita al anterior.</Text>
      <View style={styles.instructionCardYellow}>
        <Text style={styles.instructionTextYellow}>💡 Recuerda el ejemplo del gato que leíste: ¿qué necesitas tener antes de poder entrenar? ¿Y antes de desplegar?</Text>
      </View>
      {sortOrder.map((stepIdx, pos) => (
        <View key={pos} style={[
          styles.sortItem,
          sortItemFeedback[pos] === 'ok' && styles.sortItemOk,
          sortItemFeedback[pos] === 'bad' && styles.sortItemBad,
        ]}>
          <Text style={styles.sortNum}>{pos + 1}</Text>
          <Text style={styles.sortText}>
            <Text style={{ fontWeight: 'bold' }}>{SORT_ITEMS[stepIdx].bold}</Text>
            {SORT_ITEMS[stepIdx].rest}
          </Text>
          <View style={styles.sortArrows}>
            <TouchableOpacity style={styles.sortBtn} onPress={() => moveSort(pos, -1)} disabled={pos === 0}>
              <MaterialIcons name="keyboard-arrow-up" size={20} color={pos === 0 ? '#d1d5db' : '#6b7280'} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.sortBtn} onPress={() => moveSort(pos, 1)} disabled={pos === sortOrder.length - 1}>
              <MaterialIcons name="keyboard-arrow-down" size={20} color={pos === sortOrder.length - 1 ? '#d1d5db' : '#6b7280'} />
            </TouchableOpacity>
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
      <Text style={[styles.tag, styles.tagQuiz]}>❓ Módulo 8 de 10 · Quiz</Text>
      <Text style={styles.title}>¿Cuánto entendiste?</Text>
      <Text style={styles.subtitle}>Estas situaciones aplican lo que aprendiste — no son para memorizar, sino para razonar. ¡Confía en ti!</Text>
      {quizQuestions.map((q, qIdx) => (
        <View key={qIdx} style={styles.quizCard}>
          <Text style={styles.quizQuestion}>{qIdx + 1}. {q.q}</Text>
          {q.opts.map((opt, optIdx) => {
            const isSelected = quizAnswers[qIdx] === optIdx;
            const isCorrect = optIdx === q.correct;
            const optStyle = !quizChecked
              ? [styles.quizOption, isSelected && styles.quizOptionSelected]
              : [styles.quizOption, isCorrect ? styles.quizOptionCorrect : isSelected ? styles.quizOptionWrong : null];
            return (
              <TouchableOpacity key={optIdx} style={optStyle} onPress={() => selectQuiz(qIdx, optIdx)} disabled={quizChecked}>
                <Text style={styles.quizLetter}>{String.fromCharCode(65 + optIdx)}</Text>
                <Text style={styles.quizOptText}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
          {quizChecked && (
            <Text style={styles.explainText}>
              {quizAnswers[qIdx] === q.correct ? '✓ ¡Correcto! — ' : `✗ Respuesta ${String.fromCharCode(65 + q.correct)} — `}
              {q.explain}
            </Text>
          )}
        </View>
      ))}
      {quizChecked ? (
        <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}>
          <Text style={styles.checkButtonText}>Ver resultado →</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.checkButton, Object.keys(quizAnswers).length < quizQuestions.length && styles.checkButtonDisabled]}
          onPress={checkQuiz}
          disabled={Object.keys(quizAnswers).length < quizQuestions.length}
        >
          <Text style={styles.checkButtonText}>Comprobar respuestas</Text>
        </TouchableOpacity>
      )}
      <Text style={styles.btnNote}>
        {quizChecked ? '' : `Responde las ${quizQuestions.length} preguntas para continuar · hasta ${quizQuestions.length * 8} XP`}
      </Text>
    </View>
  );

  const renderTF = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.tag, styles.tagActivity]}>✅ Módulo 9 de 10 · Verdadero o Falso</Text>
      <Text style={styles.title}>¿Verdad o mentira?</Text>
      <Text style={styles.subtitle}>Lee cada afirmación y decide si es verdadera o falsa. ¡Cuidado! Algunas parecen verdaderas pero no lo son.</Text>
      {tfItems.map((item, idx) => {
        const userPick = tfAnswers[idx];
        return (
          <View key={idx} style={styles.tfSet}>
            <Text style={styles.tfQuestion}>{idx + 1}. {item.stmt}</Text>
            <View style={styles.tfOpts}>
              <TouchableOpacity
                style={[styles.tfBtn,
                  !tfChecked && userPick === true && styles.tfBtnTrue,
                  tfChecked && item.correct === true && styles.tfBtnResultCorrect,
                  tfChecked && item.correct !== true && userPick === true && styles.tfBtnResultWrong,
                ]}
                onPress={() => selectTF(idx, true)}
                disabled={tfChecked}
              >
                <Text style={styles.tfBtnEmoji}>✅</Text>
                <Text style={styles.tfBtnLabel}>Verdadero</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tfBtn,
                  !tfChecked && userPick === false && styles.tfBtnFalse,
                  tfChecked && item.correct === false && styles.tfBtnResultCorrect,
                  tfChecked && item.correct !== false && userPick === false && styles.tfBtnResultWrong,
                ]}
                onPress={() => selectTF(idx, false)}
                disabled={tfChecked}
              >
                <Text style={styles.tfBtnEmoji}>❌</Text>
                <Text style={styles.tfBtnLabel}>Falso</Text>
              </TouchableOpacity>
            </View>
            {tfChecked && (
              <Text style={styles.explainText}>
                {tfAnswers[idx] === item.correct ? '✓ Correcto — ' : '✗ Incorrecto — '}
                {item.explain}
              </Text>
            )}
          </View>
        );
      })}
      {tfChecked ? (
        <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}>
          <Text style={styles.checkButtonText}>Continuar →</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.checkButton, Object.keys(tfAnswers).length < tfItems.length && styles.checkButtonDisabled]}
          onPress={checkTF}
          disabled={Object.keys(tfAnswers).length < tfItems.length}
        >
          <Text style={styles.checkButtonText}>Comprobar</Text>
        </TouchableOpacity>
      )}
      <Text style={styles.btnNote}>
        {tfChecked ? '' : `Responde las ${tfItems.length} afirmaciones · hasta ${tfItems.length * 5} XP`}
      </Text>
    </View>
  );

  const fillSentenceWithAnswer = () => {
    if (fillChecked) {
      const correctWord = fillItem.allOpts[fillItem.correct.fb0];
      return fillItem.sentence.replace('___', correctWord);
    }
    return fillItem.sentence;
  };

  const renderFill = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.tag, styles.tagBonus]}>💬 Módulo 10 de 10 · Completa la frase</Text>
      <Text style={styles.title}>¿Cuál es la palabra que falta?</Text>
      <Text style={styles.subtitle}>Lee la frase, encuentra el hueco y elige la palabra correcta de las opciones de abajo.</Text>
      <View style={styles.cardPurple}>
        <Text style={styles.cardTitle}>📝 Completa la frase:</Text>
        <Text style={styles.fillSentenceText}>{fillSentenceWithAnswer()}</Text>
      </View>
      <View style={styles.instructionCard}>
        <Text style={styles.instructionText}>👇 Elige la palabra que encaja mejor:</Text>
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
              <Text style={styles.fillOptText}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {fillChecked ? (
        <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}>
          <Text style={styles.checkButtonText}>Continuar →</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.checkButton, fillSel === null && styles.checkButtonDisabled]}
          onPress={checkFill}
          disabled={fillSel === null}
        >
          <Text style={styles.checkButtonText}>Verificar respuesta</Text>
        </TouchableOpacity>
      )}
      <Text style={styles.btnNote}>{fillChecked ? '' : 'Elige la palabra que completa correctamente la frase · +10 XP'}</Text>
    </View>
  );

  const renderReflect = () => {
    const reflectReady = reflectText.trim().length >= 60;
    return (
      <View style={styles.stepContainer}>
        <Text style={[styles.tag, styles.tagReflect]}>✍️ Reflexión final · +15 XP</Text>
        <Text style={styles.title}>Ahora piensa tú</Text>
        <Text style={styles.subtitle}>No hay respuesta correcta ni incorrecta. Solo queremos que proceses lo aprendido con tus propias palabras.</Text>
        <View style={styles.cardPurple}>
          <View style={styles.cardRow}>
            <View style={[styles.cardIcon, { backgroundColor: '#e9d5ff' }]}><Text style={styles.cardIconEmoji}>🤔</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Tu pregunta de reflexión</Text>
              <Text style={styles.cardText}>
                {'Aprendiste que la IA aprende de millones de ejemplos y predice patrones, pero no entiende nada de verdad.\n\n'}
                <Text style={{ fontWeight: 'bold' }}>Piensa en una app que usas todos los días. ¿Qué crees que está haciendo la IA en esa app? Y ahora que sabes cómo funciona por dentro, ¿cambia algo la manera en que la vas a usar?</Text>
              </Text>
            </View>
          </View>
        </View>
        <TextInput
          style={styles.textArea}
          multiline
          numberOfLines={6}
          placeholder="Ejemplo: Uso YouTube todos los días y ahora entiendo que la IA analiza exactamente cuántos segundos veo cada video para decidir qué recomendar. Antes no pensaba en eso. Ahora voy a notar cuando la IA me esté jalando hacia cierto tipo de contenido..."
          placeholderTextColor="#b8bcc0"
          value={reflectText}
          onChangeText={setReflectText}
        />
        <Text style={styles.charCount}>{reflectText.trim().length} / 60 mínimo</Text>
        <View style={styles.tipBox}>
          <Text style={styles.tipText}>
            {'✅ '}
            <Text style={{ fontWeight: 'bold' }}>¿Por qué pedimos esto?{'\n'}</Text>
            {'Escribir con tus propias palabras es la prueba real de que entendiste. Esta reflexión queda guardada en tu portafolio IA Explorer.'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.checkButton, !reflectReady && styles.checkButtonDisabled]}
          onPress={checkReflect}
          disabled={!reflectReady}
        >
          <Text style={styles.checkButtonText}>Enviar reflexión →</Text>
        </TouchableOpacity>
        <Text style={styles.btnNote}>{reflectReady ? '' : 'Escribe al menos 60 caracteres para continuar · +15 XP'}</Text>
      </View>
    );
  };

  const renderCompletion = () => (
    <View style={styles.completeContainer}>
      <View style={styles.completeBadge}>
        <Text style={styles.completeBadgeText}>🏅</Text>
      </View>
      <Text style={styles.completeTitle}>¡Nivel 1 completado!</Text>
      <Text style={styles.completeSub}>Terminaste "Robots vs. Humanos". Ahora entiendes algo que mucha gente confunde: qué puede la IA, por qué puede hacerlo, cómo aprende paso a paso, y en qué los humanos seguimos siendo únicos.</Text>
      <View style={styles.xpEarned}>
        <Text style={styles.xpEarnedText}>⭐ {xp} XP ganados en este nivel</Text>
      </View>
      <View style={styles.skillList}>
        {[
          'Puedo explicar qué es la IA con mis propias palabras y ejemplos reales',
          'Sé identificar qué hace la IA por dentro de TikTok, Spotify, Maps y otros',
          'Entiendo los 5 pasos exactos de cómo aprende una IA',
          'Sé en qué supera la IA a los humanos y en qué los humanos somos irremplazables',
          'Puedo identificar cuándo la IA puede equivocarse y por qué',
        ].map((skill, i) => (
          <View key={i} style={styles.skillRow}>
            <Text style={styles.skillCheck}>✓</Text>
            <Text style={styles.skillText}>{skill}</Text>
          </View>
        ))}
      </View>
      <View style={styles.nextHint}>
        <Text style={styles.nextHintText}>
          {'🚀 '}
          <Text style={{ fontWeight: 'bold' }}>Nivel 2: La IA vive en tus apps{'\n\n'}</Text>
          {'Vas a analizar apps de tu celular e identificar exactamente qué hace la IA en cada una — no en abstracto, sino pantalla por pantalla. Cuando termines, nunca más abrirás una app sin saber quién está operando detrás.'}
        </Text>
      </View>
      <View style={styles.lvlBarWrap}>
        <Text style={styles.lvlBarLabel}>Nivel 1 de 36 completado · Mundo 1 — ¿Qué es la IA?</Text>
        <View style={styles.lvlBarOuter}>
          <View style={styles.lvlBarInner} />
        </View>
      </View>
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
  const showNextButton = step < TOTAL_STEPS - 1 && ![4, 5, 7, 8, 9, 10, 11].includes(step);
  const stepNote = getStepNote();

  return (
    <View style={styles.screen}>
      <View style={styles.progressBar}>
        <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
          <MaterialIcons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` as any }]} />
        </View>
        <View style={styles.xpChip}>
          <Text style={styles.xpChipText}>{xp} XP</Text>
        </View>
      </View>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {renderContent()}
      </ScrollView>
      {stepResult && (
        <View style={[styles.resultBanner, stepResult.ok ? styles.resultBannerOk : styles.resultBannerErr]}>
          <Text style={styles.resultBannerText}>{stepResult.ok ? '✅ ' : '❌ '}{stepResult.msg}</Text>
        </View>
      )}
      {xpToast && <XPToast key={xpToast.id} amount={xpToast.amount} onHide={() => setXpToast(null)} bgColor="#fef9c3" textColor="#92400e" />}
      <View style={styles.footerRow}>
        {showBackButton && (
          <TouchableOpacity style={styles.backButton} onPress={goToPrevStep}>
            <Text style={styles.backButtonText}>← Volver</Text>
          </TouchableOpacity>
        )}
        {showNextButton && (
          <TouchableOpacity style={[styles.nextButton, showBackButton && styles.nextButtonFlex]} onPress={goToNextStep}>
            <Text style={styles.nextButtonText}>{getStepBtnText()}</Text>
          </TouchableOpacity>
        )}
      </View>
      {stepNote && <Text style={styles.footerNote}>{stepNote}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  progressBar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  closeBtn: { padding: 4 },
  progressTrack: { flex: 1, height: 8, backgroundColor: colors.borderLight, borderRadius: 4, marginHorizontal: 12 },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: '#8b5cf6' },
  xpChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: '#fde68a', borderWidth: 1, borderColor: '#fde047' },
  xpChipText: { ...typography.bold, fontSize: 12, color: '#854d0e' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  stepContainer: { flex: 1 },

  // Tags
  tag: { fontSize: 11, fontWeight: '700', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 12 },
  tagIntro: { backgroundColor: '#eef2ff', color: '#3730a3' },
  tagTheory: { backgroundColor: '#f0fdf4', color: '#166534' },
  tagExample: { backgroundColor: '#fff7ed', color: '#9a3412' },
  tagCase: { backgroundColor: '#fdf4ff', color: '#7e22ce' },
  tagActivity: { backgroundColor: '#eff6ff', color: '#1e40af' },
  tagQuiz: { backgroundColor: '#fef3c7', color: '#92400e' },
  tagReflect: { backgroundColor: '#f3f4f6', color: '#374151' },
  tagBonus: { backgroundColor: '#fce7f3', color: '#9d174d' },

  // Intro icon
  iconContainer: { width: 68, height: 68, borderRadius: 20, backgroundColor: '#eef2ff', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  iconEmoji: { fontSize: 34 },

  // Typography
  title: { ...typography.extraBold, fontSize: 20, color: colors.textPrimary, marginBottom: 8, lineHeight: 26 },
  subtitle: { ...typography.regular, fontSize: 13, color: colors.textSecondary, marginBottom: 14, lineHeight: 21 },
  bodyText: { ...typography.regular, fontSize: 13, color: colors.textPrimary, lineHeight: 21, marginBottom: 12 },
  sectionTitle: { ...typography.bold, fontSize: 14, color: colors.textPrimary, marginTop: 14, marginBottom: 8, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#f0f0f0' },

  // Cards
  cardBlue: { backgroundColor: '#eff6ff', borderRadius: 14, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: '#bfdbfe' },
  cardGreen: { backgroundColor: '#f0fdf4', borderRadius: 14, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: '#bbf7d0' },
  cardYellow: { backgroundColor: '#fefce8', borderRadius: 14, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: '#fde68a' },
  cardPurple: { backgroundColor: '#fdf4ff', borderRadius: 14, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: '#e9d5ff' },
  cardRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  cardIcon: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  cardIconEmoji: { fontSize: 20 },
  cardTitle: { ...typography.bold, fontSize: 13, color: colors.textPrimary, marginBottom: 4 },
  cardText: { ...typography.regular, fontSize: 13, color: colors.textSecondary, lineHeight: 20 },

  // Highlight / warning / tip / curiosity / fun boxes
  highlightBox: { borderLeftWidth: 3, borderLeftColor: '#6366f1', padding: 12, backgroundColor: '#eef2ff', borderRadius: 10, margin: 10, marginLeft: 0 },
  highlightText: { ...typography.regular, fontSize: 13, color: '#3730a3', lineHeight: 21 },
  warningBox: { borderLeftWidth: 3, borderLeftColor: colors.error, padding: 12, backgroundColor: '#fef2f2', borderRadius: 10, marginVertical: 10 },
  warningText: { ...typography.regular, fontSize: 13, color: '#991b1b', lineHeight: 21 },
  tipBox: { borderLeftWidth: 3, borderLeftColor: colors.success, padding: 12, backgroundColor: '#f0fdf4', borderRadius: 10, marginVertical: 10 },
  tipText: { ...typography.regular, fontSize: 13, color: '#166534', lineHeight: 21 },
  curiosityBox: { borderLeftWidth: 3, borderLeftColor: '#a855f7', padding: 12, backgroundColor: '#fdf4ff', borderRadius: 10, marginVertical: 10 },
  curiosityText: { ...typography.regular, fontSize: 13, color: '#5b21b6', lineHeight: 21 },
  funBox: { borderLeftWidth: 3, borderLeftColor: '#f59e0b', padding: 12, backgroundColor: '#fffbeb', borderRadius: 10, marginVertical: 10 },
  funText: { ...typography.regular, fontSize: 13, color: '#92400e', lineHeight: 21 },

  // VS Grid
  vsGrid: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  vsCol: { flex: 1, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border },
  vsHeader: { ...typography.bold, fontSize: 11, marginBottom: 8, textAlign: 'center', padding: 5, borderRadius: 7 },
  vsItem: { ...typography.regular, fontSize: 12, color: colors.textPrimary, marginBottom: 4, lineHeight: 18 },

  // Step list (theory)
  stepList: { marginTop: 8, marginBottom: 8 },
  stepItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 8 },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center', flexShrink: 0, marginTop: 1 },
  stepNumText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  stepText: { flex: 1, ...typography.regular, fontSize: 13, color: '#374151', lineHeight: 21 },
  stepTextEx: { ...typography.regular, fontSize: 12, color: '#6b7280', fontStyle: 'italic', lineHeight: 18, marginTop: 2 },

  // Scenario box
  scenarioBox: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 14, padding: 14, marginVertical: 10 },
  scenarioLabel: { ...typography.bold, fontSize: 10, color: '#92400e', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  scenarioText: { ...typography.regular, fontSize: 13, color: '#374151', lineHeight: 21 },

  // Drag & Drop
  chipsPool: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, backgroundColor: '#f9fafb', padding: 10, borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', minHeight: 54, marginBottom: 10 },
  chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20, backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#d1d5db', minHeight: 44, justifyContent: 'center', ...Platform.select({ web: { cursor: 'grab' as any } }) },
  chipSelected: { backgroundColor: '#eef2ff', borderColor: '#6366f1' },
  chipText: { ...typography.regular, fontSize: 12, color: '#374151', lineHeight: 17 },
  dropCols: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  dropCol: { flex: 1, borderWidth: 2, borderStyle: 'dashed', borderColor: '#d1d5db', borderRadius: 12, padding: 8, minHeight: 110 },
  dropAI: { backgroundColor: '#f0f7ff' },
  dropHuman: { backgroundColor: '#f0fdf4' },
  dropColDragOver: { borderStyle: 'solid', borderColor: '#6366f1', backgroundColor: '#eef2ff' },
  dropHeader: { ...typography.bold, fontSize: 11, textAlign: 'center', marginBottom: 7, padding: 5, borderRadius: 7 },
  dropChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, minHeight: 40 },
  dropChip: { backgroundColor: '#dbeafe', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 14, minHeight: 34, justifyContent: 'center' },
  dropChipText: { ...typography.regular, fontSize: 11, color: '#1e40af', lineHeight: 16 },
  dropChipAI: { backgroundColor: '#dbeafe', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 14, minHeight: 34, justifyContent: 'center' },
  dropChipTextAI: { ...typography.regular, fontSize: 11, color: '#1e40af', lineHeight: 16 },
  dropChipHuman: { backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 14, minHeight: 34, justifyContent: 'center' },
  dropChipTextHuman: { ...typography.regular, fontSize: 11, color: '#166534', lineHeight: 16 },

  // Matching
  instructionCard: { backgroundColor: '#eff6ff', borderRadius: 10, padding: 11, marginBottom: 10, borderWidth: 1, borderColor: '#bfdbfe' },
  instructionText: { ...typography.regular, fontSize: 12, color: '#1e40af' },
  instructionCardYellow: { backgroundColor: '#fefce8', borderRadius: 10, padding: 11, marginBottom: 12, borderWidth: 1, borderColor: '#fde68a' },
  instructionTextYellow: { ...typography.regular, fontSize: 12, color: '#92400e' },
  matchColLabels: { flexDirection: 'row', marginBottom: 4 },
  matchColLabel: { flex: 1, ...typography.bold, fontSize: 11, color: '#6b7280', textAlign: 'center' },
  matchColumns: { flexDirection: 'row', gap: 6, marginTop: 4 },
  matchLeftColumn: { flex: 1, gap: 6 },
  matchRightColumn: { flex: 1, gap: 6 },
  matchLeftCard: { backgroundColor: '#eff6ff', padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#bfdbfe', minHeight: 64, justifyContent: 'center' },
  matchRightCard: { backgroundColor: '#fdf4ff', padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#e9d5ff', minHeight: 64, justifyContent: 'center' },
  matchSelected: { borderColor: '#6366f1', borderWidth: 2 },
  matchMatched: { backgroundColor: '#dcfce7', borderColor: colors.success, borderWidth: 2 },
  matchText: { ...typography.regular, fontSize: 12, color: colors.textPrimary, lineHeight: 17 },

  // Sort
  sortItem: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#f9fafb', borderRadius: 12, borderWidth: 1.5, borderColor: '#e5e7eb', marginBottom: 7 },
  sortItemOk: { borderColor: '#86efac', backgroundColor: '#f0fdf4' },
  sortItemBad: { borderColor: '#fca5a5', backgroundColor: '#fef2f2' },
  sortNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#6366f1', color: '#fff', textAlign: 'center', lineHeight: 28, ...typography.bold, fontSize: 12, marginRight: 9, flexShrink: 0 },
  sortText: { flex: 1, ...typography.regular, fontSize: 12, color: '#374151', lineHeight: 18 },
  sortArrows: { flexDirection: 'column', gap: 3, flexShrink: 0 },
  sortBtn: { width: 30, height: 27, borderRadius: 7, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#ffffff', justifyContent: 'center', alignItems: 'center' },

  // Quiz
  quizCard: { marginBottom: 16 },
  quizQuestion: { ...typography.bold, fontSize: 13, color: colors.textPrimary, marginBottom: 8, padding: 12, backgroundColor: '#f9fafb', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', lineHeight: 20 },
  quizOption: { flexDirection: 'row', alignItems: 'flex-start', padding: 12, borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 11, marginBottom: 6, gap: 10, minHeight: 48 },
  quizOptionSelected: { borderColor: '#6366f1', backgroundColor: '#eef2ff' },
  quizOptionCorrect: { borderColor: colors.success, backgroundColor: '#dcfce7', borderWidth: 2 },
  quizOptionWrong: { borderColor: colors.error, backgroundColor: '#fef2f2', borderWidth: 2 },
  quizLetter: { width: 24, height: 24, borderRadius: 7, backgroundColor: '#f3f4f6', textAlign: 'center', lineHeight: 24, ...typography.bold, fontSize: 11, flexShrink: 0 },
  quizOptText: { flex: 1, ...typography.regular, fontSize: 12, color: colors.textPrimary, lineHeight: 18 },
  explainText: { ...typography.regular, fontSize: 12, color: '#374151', lineHeight: 18, marginTop: 6, paddingHorizontal: 4, fontStyle: 'italic' },

  // True/False
  tfSet: { marginBottom: 14 },
  tfQuestion: { ...typography.bold, fontSize: 13, color: colors.textPrimary, marginBottom: 8, padding: 11, backgroundColor: '#f9fafb', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', lineHeight: 20 },
  tfOpts: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  tfBtn: { flex: 1, padding: 12, borderRadius: 11, borderWidth: 2, borderColor: '#e5e7eb', backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', minHeight: 54 },
  tfBtnEmoji: { fontSize: 18, marginBottom: 4 },
  tfBtnLabel: { fontSize: 11, fontWeight: '700', color: '#374151' },
  tfBtnTrue: { borderColor: colors.success, backgroundColor: '#f0fdf4' },
  tfBtnFalse: { borderColor: colors.error, backgroundColor: '#fef2f2' },
  tfBtnResultCorrect: { borderColor: colors.success, backgroundColor: '#dcfce7', borderWidth: 2 },
  tfBtnResultWrong: { borderColor: colors.error, backgroundColor: '#fef2f2', borderWidth: 2 },

  // Fill blank
  fillSentenceText: { ...typography.regular, fontSize: 13, color: '#374151', lineHeight: 22, marginTop: 6 },
  fillOpts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  fillOpt: { padding: 8, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1.5, borderColor: '#d1d5db', backgroundColor: '#ffffff' },
  fillOptSelected: { borderColor: '#6366f1', backgroundColor: '#eef2ff' },
  fillOptCorrect: { borderColor: colors.success, backgroundColor: '#dcfce7', borderWidth: 2 },
  fillOptWrong: { borderColor: colors.error, backgroundColor: '#fef2f2', borderWidth: 2 },
  fillOptText: { ...typography.bold, fontSize: 12, color: '#374151' },

  // Reflect
  textArea: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, ...typography.regular, fontSize: 13, color: colors.textPrimary, textAlignVertical: 'top', minHeight: 120, backgroundColor: '#fafafa' },
  charCount: { ...typography.regular, fontSize: 11, color: colors.textSecondary, textAlign: 'right', marginTop: 4, marginBottom: 4 },

  // Completion
  completeContainer: { alignItems: 'center', padding: 20 },
  completeBadge: { width: 88, height: 88, borderRadius: 24, backgroundColor: '#fde68a', justifyContent: 'center', alignItems: 'center', marginBottom: 16, shadowColor: '#f59e0b', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  completeBadgeText: { fontSize: 46 },
  completeTitle: { ...typography.extraBold, fontSize: 22, color: colors.textPrimary, marginBottom: 6 },
  completeSub: { ...typography.regular, fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 21, marginBottom: 18 },
  xpEarned: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, backgroundColor: '#fefce8', borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#fde047', width: '100%' },
  xpEarnedText: { ...typography.bold, fontSize: 16, color: '#854d0e' },
  skillList: { backgroundColor: '#f0fdf4', borderRadius: 12, padding: 13, marginBottom: 14, borderWidth: 1, borderColor: '#bbf7d0', width: '100%' },
  skillRow: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: 9, marginBottom: 7 },
  skillCheck: { color: colors.success, fontWeight: '700' as const, fontSize: 15, marginTop: 1 },
  skillText: { ...typography.regular, fontSize: 12, color: '#166534', flex: 1, lineHeight: 18 },
  nextHint: { backgroundColor: '#f9fafb', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: colors.border, width: '100%', marginBottom: 14 },
  nextHintText: { ...typography.regular, fontSize: 12, color: colors.textSecondary, lineHeight: 19 },
  lvlBarWrap: { width: '100%', marginBottom: 16 },
  lvlBarLabel: { ...typography.regular, fontSize: 11, color: colors.textSecondary, marginBottom: 5 },
  lvlBarOuter: { height: 7, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden' },
  lvlBarInner: { height: '100%', backgroundColor: '#6366f1', borderRadius: 4, width: '2.78%' },
  nextLevelButton: { backgroundColor: '#6366f1', padding: 14, borderRadius: 12, width: '100%', alignItems: 'center' },
  nextLevelText: { ...typography.bold, color: '#fff', fontSize: 15 },

  // Buttons
  checkButton: { backgroundColor: colors.success, padding: 13, borderRadius: 11, alignItems: 'center', marginTop: 14 },
  checkButtonDisabled: { opacity: 0.35 },
  checkButtonText: { ...typography.bold, color: '#fff', fontSize: 14 },
  btnNote: { ...typography.regular, fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 6, minHeight: 16 },

  // Result banner
  resultBanner: { margin: 12, padding: 13, borderRadius: 12, borderWidth: 1 },
  resultBannerOk: { backgroundColor: '#dcfce7', borderColor: colors.success },
  resultBannerErr: { backgroundColor: '#fee2e2', borderColor: colors.error },
  resultBannerText: { ...typography.bold, fontSize: 13, color: colors.textPrimary, lineHeight: 20 },

  // Footer
  footerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 8 },
  footerNote: { ...typography.regular, fontSize: 11, color: '#9ca3af', textAlign: 'center', paddingBottom: 10, paddingHorizontal: 16 },
  backButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 14, borderRadius: 11, alignItems: 'center', paddingHorizontal: 20 },
  backButtonText: { ...typography.bold, color: colors.textSecondary, fontSize: 15 },
  nextButton: { backgroundColor: '#6366f1', padding: 14, borderRadius: 11, alignItems: 'center', flex: 1 },
  nextButtonText: { ...typography.bold, color: '#fff', fontSize: 15 },
  nextButtonFlex: { flex: 1 },

  // Example cards
  exampleCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, marginBottom: 8 },
  exampleCardActive: { borderColor: '#6366f1', backgroundColor: '#f8faff' },
  exampleHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exampleEmoji: { fontSize: 22, width: 40, height: 40, textAlign: 'center', lineHeight: 40, backgroundColor: '#f3f4f6', borderRadius: 10 },
  exampleName: { ...typography.bold, fontSize: 13, color: colors.textPrimary },
  exampleApp: { ...typography.regular, fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  exampleArrow: { fontSize: 18, color: colors.textSecondary },
  exampleDetail: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  exampleDetailText: { ...typography.regular, fontSize: 12, color: colors.textPrimary, lineHeight: 19 },
  exampleFact: { marginTop: 8, ...typography.regular, fontSize: 12, backgroundColor: '#fef9c3', padding: 8, borderRadius: 8, color: '#854d0e', borderWidth: 1, borderColor: '#fde68a60' },
});
