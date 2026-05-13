import { router } from 'expo-router';
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, BackHandler, Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useGameStore } from '../../store/gameStore';
import { colors, typography } from '../../theme';

// ---------- Tipos ----------
type PairItem = { a: string; b: string };
type VFItem = { s: string; correct: boolean; fb: string };
type DragItemData = { id: string; text: string };
type ModuleDef = {
  type: 'theory' | 'quiz' | 'chart' | 'builder' | 'matching' | 'vf' | 'sprint' | 'dragdrop' | 'completion';
  title: string;
  xp: number;
  q?: string; opts?: string[]; correct?: number; fb?: string;
  pairs?: PairItem[];
  items?: VFItem[];
  dragItems?: DragItemData[];
  zones?: string[];
  dragCorrect?: { [id: string]: number };
  duration?: number;
  instruction?: string;
  placeholder?: string;
};

// ---------- Datos ----------
const MODULES: ModuleDef[] = [
  // 0 INTRO
  { type: 'theory', title: 'Introducción', xp: 0 },
  // 1 THEORY
  { type: 'theory', title: 'La IA lee tablas', xp: 10 },
  // 2 CHART + QUIZ
  { type: 'chart', title: 'Lee esta gráfica', xp: 15,
    q: '¿Cuál es la conclusión más correcta de esta gráfica?',
    opts: [
      'Alemania no tiene acceso a internet para usar IA',
      'El uso de IA entre jóvenes varía significativamente por país; los asiáticos lideran la adopción',
      'Colombia tiene la peor educación del mundo en tecnología',
      'Los jóvenes de Nigeria no pueden pagar herramientas de IA'
    ], correct: 1,
    fb: '¡Correcto! La gráfica muestra diferencias de adopción, pero NO explica las causas. Un buen analista de datos nunca salta a conclusiones sin más evidencia.' },
  // 3 BUILDER
  { type: 'builder', title: 'Carga datos y haz preguntas', xp: 15 },
  // 4 THEORY
  { type: 'theory', title: 'NotebookLM', xp: 10 },
  // 5 MATCHING
  { type: 'matching', title: '¿Qué gráfica usar?', xp: 15,
    pairs: [
      { a: '📊 Gráfica de barras', b: 'Comparar valores entre categorías distintas' },
      { a: '📈 Gráfica de líneas', b: 'Mostrar cómo algo cambia a lo largo del tiempo' },
      { a: '🥧 Gráfica de pie', b: 'Mostrar partes de un total (porcentajes que suman 100%)' },
      { a: '⚫ Diagrama de dispersión', b: 'Ver si existe relación entre dos variables numéricas' }
    ] },
  // 6 QUIZ
  { type: 'quiz', title: 'Spotify Wrapped', xp: 15,
    q: 'Spotify Wrapped te muestra al final del año cuántas horas escuchaste música. ¿Qué tipo de análisis está haciendo Spotify con tus datos?',
    opts: ['Predicción del futuro', 'Análisis de patrones históricos — resume lo que ya ocurrió', 'Generación de contenido nuevo', 'Comparación con otros usuarios'],
    correct: 1, fb: '¡Correcto! Wrapped es análisis descriptivo: cuenta, suma y visualiza lo que ya pasó.' },
  // 7 BUILDER
  { type: 'builder', title: 'Analiza tus propios datos', xp: 15 },
  // 8 THEORY
  { type: 'theory', title: 'Redes sociales y tus datos', xp: 10 },
  // 9 VF
  { type: 'vf', title: '¿Qué puedo compartir con la IA?', xp: 15,
    items: [
      { s: 'Puedo subir a ChatGPT documentos con mis datos personales completos (nombre, dirección, teléfono) sin ningún riesgo.', correct: false, fb: 'FALSO. Los datos personales sensibles nunca deben compartirse con IAs públicas.' },
      { s: 'Es seguro subir un documento con datos anónimos (sin nombres) de una encuesta de mi clase para que la IA lo analice.', correct: true, fb: 'VERDADERO. Datos que no identifican personas son generalmente seguros de analizar.' },
      { s: 'Una vez que borras un chat con una IA, todos los datos que compartiste desaparecen para siempre.', correct: false, fb: 'FALSO. Cada empresa tiene su política de retención de datos. ¡Lee los términos de servicio!' }
    ] },
  // 10 QUIZ
  { type: 'quiz', title: 'IA y ciencia', xp: 15,
    q: 'El telescopio Kepler generó tantos datos que los científicos no podían analizarlos todos. ¿Cómo ayudó la IA?',
    opts: ['Construyó telescopios más potentes', 'Analizó patrones de luz automáticamente y detectó exoplanetas que los humanos nunca habrían encontrado manualmente', 'Publicó los datos en internet para que millones los analizaran', 'Borró los datos que no parecían importantes'],
    correct: 1, fb: '¡Exacto! El sistema de ML de Kepler identificó patrones de oscurecimiento que indican planetas orbitando estrellas.' },
  // 11 SPRINT
  { type: 'sprint', title: 'Sprint: saca 3 conclusiones', xp: 20, duration: 60,
    instruction: '⚡ ¡60 segundos! Escribe 3 conclusiones: En 2024, el 73% de jóvenes en Asia usan IA diariamente. Europa: 41%. Latinoamérica: 58%. África: 34%.',
    placeholder: 'Conclusión 1: ...\nConclusión 2: ...\nConclusión 3: ...' },
  // 12 THEORY
  { type: 'theory', title: 'Cuando los datos engañan', xp: 10 },
  // 13 DRAG DROP
  { type: 'dragdrop', title: '¿Normal, patrón o anomalía?', xp: 15,
    instruction: 'Clasifica estos hallazgos en los datos de una app escolar:',
    zones: ['✅ Patrón normal', '🔍 Patrón interesante', '🚨 Anomalía / error'],
    dragItems: [
      { id: 'a', text: 'Los viernes a las 3pm hay el doble de logins' },
      { id: 'b', text: 'Un estudiante tiene 200 horas de uso en un día' },
      { id: 'c', text: 'Las notas suben entre el primer y tercer trimestre' },
      { id: 'd', text: 'El 98% de usuarios son de Colombia en app colombiana' },
      { id: 'e', text: 'Las notas caen 3 puntos cada vez que hay partido importante' }
    ],
    dragCorrect: { a: 1, b: 2, c: 0, d: 0, e: 1 } },
  // 14 QUIZ
  { type: 'quiz', title: 'Elige la gráfica correcta', xp: 15,
    q: 'Valentina quiere mostrar cómo han cambiado las temperaturas en su ciudad cada mes durante 3 años. ¿Qué gráfica es la más adecuada?',
    opts: ['Gráfica de pie', 'Gráfica de líneas', 'Diagrama de dispersión', 'Gráfica de barras 3D'],
    correct: 1, fb: '¡Correcto! Para cambios a lo largo del tiempo, la gráfica de líneas es la mejor opción.' },
  // 15 THEORY
  { type: 'theory', title: 'IA y el pronóstico del tiempo', xp: 10 },
  // 16 VF
  { type: 'vf', title: '¿Puede la IA predecir el futuro?', xp: 15,
    items: [
      { s: 'La IA puede predecir el futuro con 100% de certeza si tiene suficientes datos.', correct: false, fb: 'FALSO. La IA trabaja con probabilidades, no certezas absolutas.' },
      { s: 'Los modelos predictivos de IA pueden cometer errores sistemáticos si los datos de entrenamiento son sesgados.', correct: true, fb: 'VERDADERO. Basura entra, basura sale. El sesgo en los datos se transfiere al modelo.' },
      { s: 'Una correlación entre dos variables siempre significa que una causa a la otra.', correct: false, fb: 'FALSO. Correlación ≠ Causalidad. Ejemplo: películas de Nicolas Cage y ahogamientos en piscinas.' }
    ] },
  // 17 BUILDER
  { type: 'builder', title: 'Tu dashboard de datos', xp: 15 },
  // 18 QUIZ
  { type: 'quiz', title: 'Quiz de datos', xp: 20,
    q: 'Eres analista de datos de tu colegio. ¿Los estudiantes que leen más libros obtienen mejores calificaciones? ¿Qué gráfica usarías?',
    opts: ['Gráfica de pie', 'Gráfica de barras', 'Diagrama de dispersión', 'Gráfica de líneas'],
    correct: 2, fb: '¡Exacto! El diagrama de dispersión es perfecto para ver si dos variables numéricas se relacionan.' },
  // 19 REFLEXIÓN
  { type: 'builder', title: 'Reflexión final', xp: 15 },
  // 20 COMPLETION
  { type: 'completion', title: '¡Completado!', xp: 0 }
];

const TOTAL_STEPS = MODULES.length;
const CHART_DATA = [
  { label: 'Corea del Sur', pct: 87 }, { label: 'EE.UU.', pct: 79 },
  { label: 'Brasil', pct: 72 }, { label: 'México', pct: 68 },
  { label: 'Nigeria', pct: 61 }, { label: 'Colombia', pct: 54 },
  { label: 'Alemania', pct: 48 }
];

interface LevelProps { navigation?: any; setAllowBack?: (allow: boolean) => void; }

export default function World3Level5({ navigation: propsNavigation, setAllowBack }: LevelProps) {
  const nav = useNavigation();
  const navigation = propsNavigation || nav;
  const completeLevel = useGameStore(s => s.completeLevel);

  const [current, setCurrent] = useState(0);
  const [xp, setXp] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  // Quiz / Chart
  const [quizSelected, setQuizSelected] = useState<number | null>(null);
  const [quizLocked, setQuizLocked] = useState(false);
  // Chart bars animation
  const chartAnims = useRef(CHART_DATA.map(() => new Animated.Value(0))).current;

  // Matching
  const [matchSel, setMatchSel] = useState<number | null>(null);
  const [matchedLeft, setMatchedLeft] = useState<Set<number>>(new Set());
  const [matchedRight, setMatchedRight] = useState<Set<number>>(new Set());
  const [rightOrder] = useState(() => {
    const m = MODULES[5];
    if (m?.pairs) return m.pairs.map(p => p.b).sort(() => Math.random() - 0.5);
    return [];
  });

  // Builder
  const [builderText, setBuilderText] = useState('');
  const [builderDone, setBuilderDone] = useState(false);

  // VF
  const [vfAnswers, setVfAnswers] = useState<{ [key: number]: boolean }>({});
  const [vfLocked, setVfLocked] = useState<Set<number>>(new Set());

  // Sprint
  const [sprintRunning, setSprintRunning] = useState(false);
  const [sprintSec, setSprintSec] = useState(0);
  const [sprintText, setSprintText] = useState('');
  const [sprintDone, setSprintDone] = useState(false);
  const sprintTimer = useRef<NodeJS.Timeout | null>(null);

  // Drag & Drop
  const [ddPlaced, setDdPlaced] = useState<{ [key: number]: number }>({});
  const [ddSel, setDdSel] = useState<number | null>(null);
  const [ddDone, setDdDone] = useState(false);

  const theorySteps = new Set([0, 1, 4, 8, 12, 15]);
  const canGoBack = theorySteps.has(current);

  useEffect(() => { setAllowBack?.(canGoBack); }, [canGoBack]);
  useEffect(() => {
    const h = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack) { Alert.alert('Actividad en curso', 'Completa la actividad antes de salir.'); return true; }
      return false;
    });
    return () => h.remove();
  }, [canGoBack]);

  // Sprint timer
  useEffect(() => {
    if (!sprintRunning || sprintDone) return;
    if (sprintSec <= 0) {
      setSprintDone(true);
      if (sprintTimer.current) clearInterval(sprintTimer.current);
      return;
    }
    sprintTimer.current = setTimeout(() => setSprintSec(s => s - 1), 1000);
    return () => { if (sprintTimer.current) clearInterval(sprintTimer.current); };
  }, [sprintRunning, sprintSec, sprintDone]);

  // Animate chart on step 2
  useEffect(() => {
    if (current === 2 && !quizLocked) {
      const animations = CHART_DATA.map((item, i) =>
        Animated.timing(chartAnims[i], { toValue: item.pct, duration: 800, useNativeDriver: false, delay: i * 100 })
      );
      Animated.stagger(100, animations).start();
    } else if (current !== 2) {
      chartAnims.forEach(a => a.setValue(0));
    }
  }, [current, quizLocked]);

  const addXP = (v: number) => setXp(prev => prev + v);
  const nextModule = () => {
    if (current < MODULES.length - 1) {
      setCurrent(c => c + 1);
      resetActivityStates();
    }
  };
  const prevModule = () => { if (current > 0) { setCurrent(c => c - 1); resetActivityStates(); } };

  const resetActivityStates = () => {
    setQuizSelected(null); setQuizLocked(false);
    setMatchSel(null); setMatchedLeft(new Set()); setMatchedRight(new Set());
    setBuilderText(''); setBuilderDone(false);
    setVfAnswers({}); setVfLocked(new Set());
    setSprintRunning(false); setSprintSec(0); setSprintText(''); setSprintDone(false);
    if (sprintTimer.current) clearInterval(sprintTimer.current);
    setDdPlaced({}); setDdSel(null); setDdDone(false);
  };

  // Quiz
  const answerQuiz = (idx: number) => {
    if (quizLocked) return;
    setQuizSelected(idx);
    setQuizLocked(true);
    const m = MODULES[current];
    if (idx === m.correct) { setCorrectCount(c => c + 1); addXP(m.xp); }
  };

  // Matching
  const handleMatchLeft = (idx: number) => {
    if (matchedLeft.has(idx)) return;
    setMatchSel(idx);
  };
  const handleMatchRight = (ri: number) => {
    if (matchSel === null || matchedRight.has(ri)) return;
    const m = MODULES[current];
    const correctRight = m.pairs![matchSel].b;
    if (rightOrder[ri] === correctRight) {
      setMatchedLeft(prev => new Set(prev).add(matchSel));
      setMatchedRight(prev => new Set(prev).add(ri));
      setMatchSel(null);
      if (matchedLeft.size + 1 >= m.pairs!.length) {
        setCorrectCount(c => c + 1);
        addXP(m.xp);
      }
    } else {
      Alert.alert('❌', 'Ese no es el par correcto.');
      setMatchSel(null);
    }
  };

  // Builder
  const handleBuilder = () => {
    if (builderText.trim().length > 15 && !builderDone) {
      setBuilderDone(true);
      const m = MODULES[current];
      setCorrectCount(c => c + 1);
      addXP(m.xp);
    }
  };

  // VF
  const answerVF = (idx: number, answer: boolean) => {
    if (vfLocked.has(idx)) return;
    setVfLocked(prev => new Set(prev).add(idx));
    setVfAnswers(prev => ({ ...prev, [idx]: answer }));
    const m = MODULES[current];
    const items = m.items || [];
    if (vfLocked.size + 1 >= items.length) {
      setCorrectCount(c => c + 1);
      addXP(m.xp);
    }
  };

  // Sprint
  const startSprint = () => {
    setSprintRunning(true);
    setSprintSec(MODULES[current].duration || 60);
    setSprintText('');
    setSprintDone(false);
  };
  const handleSprintNext = () => {
    if (sprintText.trim().length > 20) setCorrectCount(c => c + 1);
    addXP(MODULES[current].xp);
    nextModule();
  };

  // Drag & Drop
  const handleDdDrop = (zoneIdx: number) => {
    if (ddSel === null) return;
    setDdPlaced(prev => ({ ...prev, [ddSel]: zoneIdx }));
    setDdSel(null);
  };
  const removeDdItem = (itemIdx: number) => {
    setDdPlaced(prev => { const n = { ...prev }; delete n[itemIdx]; return n; });
  };
  const checkDrag = () => {
    const m = MODULES[current];
    let correct = true;
    m.dragItems?.forEach((item, i) => {
      if (ddPlaced[i] !== m.dragCorrect![item.id]) correct = false;
    });
    if (correct) {
      setCorrectCount(c => c + 1);
      addXP(m.xp);
      Alert.alert('✅', '¡Clasificación perfecta!');
    } else {
      Alert.alert('❌', 'Algunas clasificaciones no son correctas. Intenta de nuevo.');
    }
    setDdDone(true);
  };

  // Finish
  const finishLevel = () => {
    let stars = xp >= 200 ? 3 : xp >= 130 ? 2 : 1;
    completeLevel(3, 5, stars, xp);
    router.back();
  };

  // ========== RENDER ==========
  const renderTheory = (idx: number) => {
    const texts: Record<number, { tag: string; title: string; body: string; info?: string }> = {
      0: { tag: '📊 Introducción', title: 'Los datos son el nuevo superpoder', body: 'Cada vez que usas una app, compras en línea o publicas en redes, generas datos. La IA puede analizar millones de datos en segundos y encontrar patrones que un humano tardaría años en descubrir.', info: '📊 Cómo la IA lee tablas · 📓 NotebookLM · 📈 Qué gráfica usar · 🔍 Detectar datos engañosos' },
      1: { tag: '🧠 Teoría', title: 'Cuando la IA analiza números', body: 'Los modelos de lenguaje modernos pueden leer tablas, hojas de cálculo y bases de datos. Le subes datos y le haces preguntas en lenguaje normal. La IA responde en segundos, incluso genera gráficas automáticamente.', info: '¿Cuál materia tiene el promedio más bajo? ¿En qué mes bajaron más las notas? ¿Hay relación entre lluvia y calificaciones? ¿Quién mejoró más?' },
      4: { tag: '📓 Casos reales', title: 'La IA que estudia tus documentos', body: 'NotebookLM (Google) te permite cargar tus PDFs, apuntes y artículos para que una IA los "lea" y responda preguntas. Lo extraordinario: cita exactamente de qué parte sacó cada respuesta. No inventa ni alucina.', info: '"¿Qué dicen estos artículos sobre el nivel del mar?" "¿Hay contradicciones entre los datos?" "Resume los 3 puntos donde todos están de acuerdo"' },
      8: { tag: '🔐 Privacidad', title: '¿Qué saben de ti las apps?', body: 'TikTok, Instagram y otras apps recolectan tu ubicación, tiempo exacto en cada video, dónde tocas la pantalla, tus patrones de uso. TikTok recolecta más de 120 puntos de datos de cada usuario.', info: 'No es malo que existan — pero debes saber que están ahí y decidir conscientemente qué compartes.' },
      12: { tag: '⚠️ Pensamiento crítico', title: 'Los datos pueden mentir', body: 'Eje Y truncado puede magnificar diferencias pequeñas. Muestras sesgadas distorsionan conclusiones. Correlación no implica causalidad (helados y ahogamientos suben en verano, pero uno no causa el otro).', info: 'Pregunta clave: "¿A quién beneficia que yo crea esta estadística?" Si alguien tiene interés, verifica la fuente.' },
      15: { tag: '🌦️ Casos reales', title: 'Cómo la IA predice el clima', body: 'GraphCast (DeepMind, 2023) predice el clima global para 10 días con más precisión que supercomputadoras, en menos de un minuto. Analiza 40 años de datos históricos de millones de puntos del planeta.', info: 'En 2023, GraphCast predijo el giro del huracán Lee con 9 días de anticipación — 5 días antes que modelos tradicionales. Esa diferencia salva vidas.' }
    };
    const t = texts[idx] || { tag: '📖', title: MODULES[idx].title, body: '' };
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.tag}>{t.tag}</Text>
        <Text style={styles.title}>{t.title}</Text>
        <Text style={styles.body}>{t.body}</Text>
        {t.info && <View style={styles.infoBox}><Text style={styles.infoText}>{t.info}</Text></View>}
      </View>
    );
  };

  const renderChart = (m: ModuleDef) => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>📈 Interpreta datos</Text>
      <Text style={styles.title}>{m.title}</Text>
      <Text style={styles.subtitle}>Porcentaje de jóvenes (12-17) que usan IA en diferentes países:</Text>
      <View style={styles.chartWrap}>
        {CHART_DATA.map((item, i) => (
          <View key={i} style={styles.chartRow}>
            <Text style={styles.chartLabel}>{item.label}</Text>
            <View style={styles.chartBarBg}>
              <Animated.View style={[styles.chartBarFill, { width: quizLocked ? `${item.pct}%` : chartAnims[i].interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]} />
            </View>
            <Text style={styles.chartVal}>{item.pct}%</Text>
          </View>
        ))}
      </View>
      <Text style={styles.quizQ}>{m.q}</Text>
      {m.opts!.map((o, i) => (
        <TouchableOpacity key={i} style={[styles.quizOpt, quizSelected === i && (i === m.correct ? styles.optCorrect : styles.optWrong)]}
          onPress={() => answerQuiz(i)} disabled={quizLocked}>
          <Text style={quizSelected === i ? styles.optTextActive : styles.optText}>{['🅐', '🅑', '🅒', '🅓'][i]} {o}</Text>
        </TouchableOpacity>
      ))}
      {quizLocked && <Text style={styles.feedback}>✅ {m.fb}</Text>}
    </View>
  );

  const renderQuiz = (m: ModuleDef) => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>❓ Quiz</Text>
      <Text style={styles.title}>{m.title}</Text>
      <Text style={styles.quizQ}>{m.q}</Text>
      {m.opts!.map((o, i) => (
        <TouchableOpacity key={i} style={[styles.quizOpt, quizSelected === i && (i === m.correct ? styles.optCorrect : styles.optWrong)]}
          onPress={() => answerQuiz(i)} disabled={quizLocked}>
          <Text style={quizSelected === i ? styles.optTextActive : styles.optText}>{['🅐', '🅑', '🅒', '🅓'][i]} {o}</Text>
        </TouchableOpacity>
      ))}
      {quizLocked && <Text style={styles.feedback}>{quizSelected === m.correct ? '✅ ¡Correcto! ' : '❌ Casi. '}{m.fb}</Text>}
    </View>
  );

  const renderBuilder = (m: ModuleDef) => {
    const placeholders: Record<number, string> = {
      3: 'Pregunta 1: ¿Qué materia tiene la mayor mejora?\nPregunta 2: ...\nPregunta 3: ...',
      7: 'Describe tu mini-análisis: qué datos tienes + qué quieres descubrir + qué gráfica quieres...',
      17: 'Describe tu dashboard: tema + 3 indicadores + tipo de gráfica para cada uno...',
      19: 'Escribe qué datos analizarías y qué esperas descubrir...'
    };
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.tag}>✏️ {current === 19 ? 'Reflexión' : 'Constructor'}</Text>
        <Text style={styles.title}>{m.title}</Text>
        {current === 3 && <Text style={styles.body}>Materias: Matemáticas (6.2→5.8→6.9), Ciencias (7.1→7.4→7.8), Español (8.0→7.5→8.2), Historia (6.8→6.1→5.9), Inglés (5.5→6.2→7.0)</Text>}
        <TextInput style={styles.textArea} placeholder={placeholders[current] || 'Escribe aquí...'} value={builderText}
          onChangeText={setBuilderText} multiline editable={!builderDone} />
        {builderDone && <Text style={styles.feedback}>✅ ¡Respuesta registrada! +{m.xp} XP</Text>}
      </View>
    );
  };

  const renderMatching = (m: ModuleDef) => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>🔗 Matching</Text>
      <Text style={styles.title}>{m.title}</Text>
      <Text style={styles.subtitle}>Conecta cada gráfica con su descripción correcta.</Text>
      <View style={styles.matchRow}>
        <View style={{ flex: 1 }}>
          {m.pairs!.map((p, i) => (
            <TouchableOpacity key={i} style={[styles.matchCard, matchSel === i && styles.matchCardSel, matchedLeft.has(i) && styles.matchCardDone]}
              onPress={() => handleMatchLeft(i)} disabled={matchedLeft.has(i)}>
              <Text style={styles.matchText}>{p.a}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ flex: 1 }}>
          {rightOrder.map((r, i) => (
            <TouchableOpacity key={i} style={[styles.matchCard, matchedRight.has(i) && styles.matchCardDone]}
              onPress={() => handleMatchRight(i)} disabled={matchedRight.has(i)}>
              <Text style={styles.matchText}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  const renderVF = (m: ModuleDef) => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>✔️ Verdadero o Falso</Text>
      <Text style={styles.title}>{m.title}</Text>
      {m.items!.map((item, i) => (
        <View key={i} style={styles.vfCard}>
          <Text style={styles.vfStmt}>"{item.s}"</Text>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.vfBtn, vfAnswers[i] === true && styles.vfTrue, vfLocked.has(i) && item.correct === true && styles.vfCorrect]}
              onPress={() => answerVF(i, true)} disabled={vfLocked.has(i)}>
              <Text>✅ Verdadero</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.vfBtn, vfAnswers[i] === false && styles.vfFalse, vfLocked.has(i) && item.correct === false && styles.vfCorrect]}
              onPress={() => answerVF(i, false)} disabled={vfLocked.has(i)}>
              <Text>❌ Falso</Text>
            </TouchableOpacity>
          </View>
          {vfLocked.has(i) && <Text style={styles.feedback}>{item.fb}</Text>}
        </View>
      ))}
    </View>
  );

  const renderSprint = (m: ModuleDef) => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>⚡ Sprint</Text>
      <Text style={styles.title}>{m.title}</Text>
      {!sprintRunning && !sprintDone ? (
        <>
          <View style={styles.sprintBox}>
            <Text style={styles.sprintInstr}>{m.instruction}</Text>
            <Text style={styles.timer}>{Math.floor((m.duration || 60) / 60)}:{String((m.duration || 60) % 60).padStart(2, '0')}</Text>
            <TouchableOpacity style={styles.btnPrimary} onPress={startSprint}><Text style={styles.btnText}>▶ Iniciar Sprint</Text></TouchableOpacity>
          </View>
          <TextInput style={styles.textArea} placeholder={m.placeholder} value={sprintText} onChangeText={setSprintText} multiline />
        </>
      ) : sprintRunning && !sprintDone ? (
        <>
          <View style={styles.sprintBox}><Text style={styles.timer}>{Math.floor(sprintSec / 60)}:{String(sprintSec % 60).padStart(2, '0')}</Text></View>
          <TextInput style={styles.textArea} placeholder={m.placeholder} value={sprintText} onChangeText={setSprintText} multiline />
          <TouchableOpacity style={styles.btnPrimary} onPress={handleSprintNext}><Text style={styles.btnText}>Entregar y continuar →</Text></TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity style={styles.btnPrimary} onPress={handleSprintNext}><Text style={styles.btnText}>Continuar →</Text></TouchableOpacity>
      )}
    </View>
  );

  const renderDragDrop = (m: ModuleDef) => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>↕️ Clasifica</Text>
      <Text style={styles.title}>{m.title}</Text>
      <Text style={styles.subtitle}>{m.instruction}</Text>
      <View style={styles.chipWrap}>
        {m.dragItems!.map((item, i) => ddPlaced[i] === undefined && (
          <TouchableOpacity key={i} style={[styles.chip, ddSel === i && styles.chipOn]} onPress={() => setDdSel(ddSel === i ? null : i)}>
            <Text style={styles.chipText}>{item.text}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {m.zones!.map((zone, zi) => (
        <View key={zi}>
          <Text style={styles.zoneLabel}>{zone}</Text>
          <TouchableOpacity style={styles.dropZone} onPress={() => handleDdDrop(zi)}>
            {Object.entries(ddPlaced).map(([k, v]) => v === zi && (
              <TouchableOpacity key={k} onPress={() => removeDdItem(parseInt(k))}>
                <Text style={styles.dropChip}>{m.dragItems![parseInt(k)].text} ✕</Text>
              </TouchableOpacity>
            ))}
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity style={styles.btnSecondary} onPress={checkDrag}><Text style={styles.btnSecondaryText}>Verificar</Text></TouchableOpacity>
    </View>
  );

  const renderCompletion = () => (
    <View style={styles.completeContainer}>
      <View style={styles.completeIcon}><Text style={styles.iconEmoji}>📊</Text></View>
      <Text style={styles.completeTitle}>¡Badge desbloqueado!</Text>
      <View style={styles.badgeBox}><Text style={styles.badgeText}>🏅 Data Detective</Text></View>
      <Text style={styles.completeSub}>¡Nivel 17 completado! Sabes cómo la IA analiza datos, conoces NotebookLM, eliges la gráfica correcta y detectas datos engañosos.</Text>
      <Text style={styles.xpBig}>⭐ {xp} XP ganados</Text>
      <View style={styles.statsRow}>
        <View style={styles.statItem}><Text style={styles.statNum}>{correctCount}</Text><Text style={styles.statLbl}>Correctas</Text></View>
        <View style={styles.statItem}><Text style={styles.statNum}>20</Text><Text style={styles.statLbl}>Módulos</Text></View>
      </View>
      <TouchableOpacity style={styles.btnPrimary} onPress={finishLevel}><Text style={styles.btnText}>Volver al mapa</Text></TouchableOpacity>
    </View>
  );

  const renderContent = () => {
    const m = MODULES[current];
    switch (m.type) {
      case 'theory': return renderTheory(current);
      case 'chart': return renderChart(m);
      case 'quiz': return renderQuiz(m);
      case 'builder': return renderBuilder(m);
      case 'matching': return renderMatching(m);
      case 'vf': return renderVF(m);
      case 'sprint': return renderSprint(m);
      case 'dragdrop': return renderDragDrop(m);
      case 'completion': return renderCompletion();
      default: return null;
    }
  };

  const progressPercent = (current / (TOTAL_STEPS - 1)) * 100;
  const m = MODULES[current];
  const isCompletion = m.type === 'completion';
  const showNext = !['chart', 'quiz', 'matching', 'vf', 'sprint', 'dragdrop'].includes(m.type) ||
    (m.type === 'chart' && quizLocked) || (m.type === 'quiz' && quizLocked) ||
    (m.type === 'matching' && matchedLeft.size >= (m.pairs?.length || 4)) ||
    (m.type === 'vf' && vfLocked.size >= (m.items?.length || 3)) ||
    (m.type === 'sprint' && sprintDone) || (m.type === 'builder' && builderDone) ||
    (m.type === 'dragdrop' && ddDone);

  return (
    <View style={styles.screen}>
      <View style={styles.bar}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialIcons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.track}><View style={[styles.fill, { width: `${progressPercent}%` }]} /></View>
        <Text style={styles.xpChip}>{xp} XP</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {renderContent()}
        {!isCompletion && (
          <View style={styles.navRow}>
            <TouchableOpacity style={[styles.btnNav, !canGoBack && { opacity: 0 }]} onPress={prevModule} disabled={!canGoBack}>
              <Text style={styles.btnNavText}>← Volver</Text>
            </TouchableOpacity>
            {showNext && (
              <TouchableOpacity style={styles.btnPrimary} onPress={() => {
                if (m.type === 'builder' && !builderDone) handleBuilder();
                nextModule();
              }}>
                <Text style={styles.btnText}>Continuar →</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  bar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  track: { flex: 1, height: 6, backgroundColor: colors.borderLight, borderRadius: 3, marginHorizontal: 12 },
  fill: { height: '100%', backgroundColor: '#6366f1', borderRadius: 3 },
  xpChip: { ...typography.bold, fontSize: 14, color: '#6366f1' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  stepContainer: { flex: 1 },
  tag: { fontSize: 11, fontWeight: '600', color: '#6366f1', backgroundColor: '#eef2ff', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 12, alignSelf: 'flex-start' },
  title: { ...typography.extraBold, fontSize: 19, color: colors.textPrimary, marginBottom: 8, textAlign: 'center' },
  subtitle: { ...typography.regular, fontSize: 13, color: colors.textSecondary, marginBottom: 14, lineHeight: 18 },
  body: { ...typography.regular, fontSize: 13, color: colors.textPrimary, lineHeight: 22, marginBottom: 12 },
  infoBox: { backgroundColor: '#eef2ff', borderLeftWidth: 4, borderLeftColor: '#6366f1', borderRadius: 4, padding: 14, marginVertical: 10 },
  infoText: { fontSize: 12, color: '#3730a3', lineHeight: 20 },
  quizQ: { ...typography.bold, fontSize: 13, padding: 12, backgroundColor: '#f8fafc', borderRadius: 10, marginBottom: 10 },
  quizOpt: { padding: 14, borderRadius: 11, borderWidth: 2, borderColor: '#e2e8f0', marginBottom: 7, flexDirection: 'row', alignItems: 'center', gap: 10 },
  optText: { fontSize: 12, color: '#334155', flex: 1 },
  optTextActive: { fontSize: 12, color: '#0f172a', fontWeight: '600', flex: 1 },
  optCorrect: { borderColor: '#22c55e', backgroundColor: '#f0fdf4' },
  optWrong: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },
  feedback: { marginTop: 10, padding: 12, borderRadius: 10, fontSize: 12, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#22c55e', color: '#065f46' },
  chartWrap: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 14, marginBottom: 16 },
  chartRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  chartLabel: { width: 80, fontSize: 11, color: '#64748b', textAlign: 'right' },
  chartBarBg: { flex: 1, backgroundColor: '#e2e8f0', borderRadius: 4, height: 18, overflow: 'hidden' },
  chartBarFill: { height: '100%', borderRadius: 4, backgroundColor: '#6366f1' },
  chartVal: { width: 35, fontSize: 11, fontWeight: '700', color: '#6366f1' },
  matchRow: { flexDirection: 'row', gap: 10 },
  matchCard: { backgroundColor: '#fff', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 6 },
  matchCardSel: { borderColor: '#6366f1', backgroundColor: '#eef2ff' },
  matchCardDone: { borderColor: '#22c55e', backgroundColor: '#f0fdf4' },
  matchText: { fontSize: 12, color: '#334155' },
  textArea: { borderWidth: 1.5, borderColor: '#6366f1', borderRadius: 12, padding: 14, minHeight: 100, fontSize: 13, backgroundColor: '#eef2ff', marginBottom: 10, textAlignVertical: 'top' },
  vfCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  vfStmt: { fontSize: 13, color: colors.textPrimary, marginBottom: 10, lineHeight: 20 },
  row: { flexDirection: 'row', gap: 10 },
  vfBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 2, borderColor: '#e2e8f0', alignItems: 'center' },
  vfTrue: { borderColor: '#22c55e', backgroundColor: '#f0fdf4' },
  vfFalse: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },
  vfCorrect: { borderColor: '#22c55e', backgroundColor: '#dcfce7' },
  sprintBox: { alignItems: 'center', backgroundColor: '#eef2ff', borderRadius: 16, padding: 20, marginBottom: 12, borderWidth: 2, borderColor: '#6366f1' },
  sprintInstr: { fontSize: 12, color: '#3730a3', textAlign: 'center', marginBottom: 8 },
  timer: { fontSize: 40, fontWeight: '800', color: '#6366f1', marginVertical: 8 },
  btnPrimary: { backgroundColor: '#6366f1', padding: 14, borderRadius: 12, alignItems: 'center' },
  btnText: { ...typography.bold, color: '#fff', fontSize: 15 },
  btnSecondary: { backgroundColor: '#fff', padding: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', marginTop: 12 },
  btnSecondaryText: { ...typography.bold, color: '#3730a3', fontSize: 14 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 12, backgroundColor: '#eef2ff', borderRadius: 12, borderWidth: 1, borderColor: '#a5b4fc', marginBottom: 12 },
  chip: { padding: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#a5b4fc', backgroundColor: '#fff' },
  chipOn: { backgroundColor: '#eef2ff', borderColor: '#6366f1' },
  chipText: { fontSize: 11, color: '#3730a3' },
  zoneLabel: { ...typography.bold, fontSize: 12, color: '#3730a3', marginBottom: 4, marginTop: 8 },
  dropZone: { minHeight: 50, borderWidth: 2, borderStyle: 'dashed', borderColor: '#a5b4fc', borderRadius: 12, padding: 10, backgroundColor: '#fff', flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dropChip: { fontSize: 10, padding: 6, backgroundColor: '#eef2ff', borderRadius: 8, color: '#3730a3' },
  completeContainer: { alignItems: 'center', padding: 20 },
  completeIcon: { width: 90, height: 90, borderRadius: 24, backgroundColor: '#eef2ff', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  iconEmoji: { fontSize: 44 },
  completeTitle: { ...typography.extraBold, fontSize: 22, marginBottom: 4 },
  badgeBox: { backgroundColor: '#eef2ff', borderWidth: 2, borderColor: '#6366f1', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 12 },
  badgeText: { fontSize: 16, fontWeight: '700', color: '#3730a3' },
  completeSub: { ...typography.regular, textAlign: 'center', marginVertical: 8, color: colors.textSecondary },
  xpBig: { ...typography.bold, fontSize: 20, color: '#6366f1', marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 20, marginBottom: 16 },
  statItem: { backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  statNum: { fontSize: 22, fontWeight: '800', color: '#6366f1' },
  statLbl: { fontSize: 11, color: '#64748b', marginTop: 2 },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, gap: 12 },
  btnNav: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  btnNavText: { fontSize: 14, color: '#64748b', fontWeight: '600' },
});