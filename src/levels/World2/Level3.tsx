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
type GenreItem = {
  theme: string;
  genres: { [key: string]: string };
};
type FillItem = {
  prompt: string;
  options: string[];
  correct: number;
  explain: string;
};
type ComparePrompt = {
  sin: string;
  con: string;
  question: string;
  opts: string[];
  correct: number;
  explain: string;
};
type StyleCompare = {
  tema: string;
  realista: string;
  surrealista: string;
  poetico: string;
  question: string;
  opts: string[];
  correct: number;
  explain: string;
};
type QuizInversoItem = {
  resultado: string;
  opts: string[];
  correct: number;
  explain: string;
};

const TOTAL_STEPS = 20; // 0:intro + 18 módulos + 1:complete
const CONTENT_STEPS = 18;

const pickN = <T,>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};

// ===================== POOLS =====================

const GENRE_POOL: GenreItem[] = [
  {
    theme: 'Un estudiante llega tarde al colegio',
    genres: {
      misterio: '¿Y si había algo oscuro esperándolo adentro?',
      comedia: 'El director lo vio todo... incluyendo la caída.',
      aventura: 'Tuvo que cruzar tres obstáculos épicos para llegar.',
      terror: 'La puerta estaba cerrada por dentro. Desde siempre.',
    },
  },
  {
    theme: 'Un robot encuentra una flor en el desierto',
    genres: {
      misterio: '¿Quién la plantó ahí sin agua ni tierra?',
      comedia: 'El robot pensó que era un cable de colores raros.',
      aventura: 'Decidió cruzar el desierto entero para encontrar más.',
      terror: 'La flor se movió. Y no había viento.',
    },
  },
  {
    theme: 'Una IA aprende a pintar',
    genres: {
      misterio: 'Sus cuadros mostraban lugares que nadie había visitado.',
      comedia: 'Interpretó "abstracto" como "accidente con pintura".',
      aventura: 'Viajó por internet buscando el estilo perfecto.',
      terror: 'En cada cuadro aparecía la misma figura mirando.',
    },
  },
  {
    theme: 'El último día de clases',
    genres: {
      misterio: 'Nadie recordaba haber visto al profesor antes.',
      comedia: 'El salón explotó en confeti que nadie compró.',
      aventura: 'Tres amigos prometieron una misión épica para el verano.',
      terror: 'El salón estaba vacío. El calendario decía que faltaba un mes.',
    },
  },
];

const FILLS_POOL: FillItem[] = [
  {
    prompt:
      'Una científica trabaja toda la noche en su laboratorio cuando...',
    options: [
      'se queda sin café.',
      'aparece un mensaje de un número desconocido diciendo solo: "Para. Ya es tarde."',
      'recuerda que mañana es lunes.',
      'apaga la computadora.',
    ],
    correct: 1,
    explain:
      'El giro "Para. Ya es tarde" de un número desconocido convierte una escena cotidiana en misterio. Los otros cierran la escena sin tensión.',
  },
  {
    prompt:
      'El robot entregó el paquete en la dirección incorrecta. Cuando la dueña de la casa abrió la puerta...',
    options: [
      'le dijo que no era para ella.',
      'vio que era exactamente lo que había perdido hace diez años.',
      'lo devolvió sin abrir.',
      'llamó a la empresa de mensajería.',
    ],
    correct: 1,
    explain:
      'El giro emocional — encontrar lo perdido hace años — convierte un error burocrático en un momento cargado de significado. Es el "y de repente" perfecto.',
  },
];

const COMPARE_PAIR: ComparePrompt = {
  sin: 'Escribe un cuento corto sobre la lluvia.',
  con: 'Escribe un cuento corto sobre una lluvia melancólica de domingo por la tarde que hace que una niña recuerde algo que perdió.',
  question: '¿Cuál prompt generará una historia más memorable y específica?',
  opts: [
    'El primero — es más corto y directo, la IA tiene más libertad creativa',
    'El segundo — los adjetivos emocionales guían la atmósfera y el foco narrativo',
    'Ambos dan resultados equivalentes, el largo solo desperdicia tokens',
    'El primero — los adjetivos confunden a la IA y reducen la calidad',
  ],
  correct: 1,
  explain:
    'Los adjetivos emocionales (melancólica, domingo, perdió) no son decoración — son instrucciones de atmósfera. La IA los usa para construir un registro específico imposible de obtener con el prompt genérico.',
};

const STYLE_COMPARE: StyleCompare = {
  tema: 'Un astronauta que encuentra una puerta en el espacio vacío',
  realista:
    'Describe técnicamente lo que haría un astronauta de la NASA al encontrar una estructura no identificada en órbita.',
  surrealista:
    'La puerta era de madera de roble y olía a lluvia aunque en el espacio no hay lluvia.',
  poetico:
    'Entre estrellas que aún no tienen nombre, una puerta esperaba — sin pared, sin casa, sin razón.',
  question:
    '¿Cuál estilo usarías para un cuento de ciencia ficción literaria?',
  opts: [
    'Realista — los detalles técnicos dan credibilidad a cualquier tipo de historia',
    'Poético — captura la extrañeza emocional mejor que la descripción técnica',
    'Surrealista — es el único que funciona para ciencia ficción por definición',
    'Los tres son equivalentes, solo cambia el vocabulario superficial',
  ],
  correct: 1,
  explain:
    'Para ciencia ficción literaria el tono poético crea asombro y resonancia emocional. El realista sirve para hard sci-fi técnico. El surrealista para ficción experimental. Elegir el estilo correcto es parte del prompting creativo.',
};

const SPRINT_TASKS = [
  '✍️ Prompt para un cuento de 3 líneas: un robot, una abuela y una receta secreta',
  '🎵 Prompt para una canción de reggaeton sobre estudiar para un examen de matemáticas',
  '🎮 Prompt para inventar las reglas de un juego de mesa que se juega con emojis',
];

const QUIZ_INVERSO: QuizInversoItem[] = [
  {
    resultado:
      '"Era una noche de tormenta épica cuando el detective más torpe del reino llegó tropezando a la escena del crimen... y pisó la única pista."',
    opts: [
      'Escribe un cuento de misterio.',
      'Actúa como narrador de comedia. Escribe el inicio de una historia de misterio donde el detective es desastroso. Tono: absurdo y exagerado.',
      'Cuento de terror con un detective.',
      'Describe una escena de crimen en una noche de tormenta.',
    ],
    correct: 1,
    explain:
      'El tono "absurdo y exagerado" + "detective desastroso" generó exactamente ese mix de misterio y comedia. El prompt genérico habría dado algo serio y sin humor.',
  },
  {
    resultado:
      '"🎸 CUANDO LAS MATEMÁTICAS TE LLAMAN / y tú no quieres contestar / pero el parcial es mañana / y toca ponerse a estudiar 🎸"',
    opts: [
      'Escribe algo gracioso sobre matemáticas.',
      'Haz una canción.',
      'Actúa como compositor de rock alternativo latinoamericano. Escribe el coro de una canción sobre la procrastinación ante un examen de matemáticas. Tono: dramático pero divertido.',
      'Prompt para una canción de rock.',
    ],
    correct: 2,
    explain:
      'El género (rock alternativo), la región (latinoamericano), el tema exacto (procrastinación + examen) y el tono (dramático pero divertido) son los ingredientes que generaron ese resultado específico.',
  },
];

const EMO_OPTIONS = [
  'melancólico',
  'épico',
  'íntimo',
  'caótico',
  'esperanzador',
  'oscuro',
  'juguetón',
  'solemne',
  'urgente',
  'nostálgico',
];

const COLLAB_STORIES = [
  {
    inicio:
      'La última librería del planeta tenía un problema: los libros empezaban a desaparecer de las páginas. Primero fueron las palabras difíciles. Luego los nombres propios. Una mañana, la bibliotecaria abrió el primer libro del estante y...',
    placeholder: 'Continúa la historia en 2-3 oraciones...',
  },
  {
    inicio:
      'El robot asistente de cocina aprendió a cocinar viendo millones de recetas. Pero la noche del gran concurso preparó algo que nadie había pedido: un plato que olía exactamente a...',
    placeholder: '¿A qué olía y qué pasó después?',
  },
];

const TONOS = [
  {
    base: 'Un estudiante no puede dormir la noche antes del examen.',
    versiones: {
      raro: 'El examen lo mira fijo desde la silla. Lleva tres horas mirándolo.',
      divertido:
        'Decidió estudiar con música de telenovela turca. Error épico.',
      serio:
        'Repasó cada concepto. Sabía que mañana cambiaría algo en él.',
    },
  },
];

// ===================== COMPONENTE =====================
interface LevelProps {
  navigation?: any;
  setAllowBack?: (allow: boolean) => void;
}

export default function World2Level3({ navigation: propsNavigation, setAllowBack }: LevelProps) {
  const navigationFromHook = useNavigation();
  const navigation = propsNavigation || navigationFromHook;
  const completeLevel = useGameStore((state) => state.completeLevel);

  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);

  // Pools aleatorios
  const [genreItem] = useState(() => pickN(GENRE_POOL, 1)[0]);
  const [fillItem] = useState(() => pickN(FILLS_POOL, 1)[0]);
  const [collabStory] = useState(() => pickN(COLLAB_STORIES, 1)[0]);

  // Estados de módulos
  const [w1, setW1] = useState('');
  const [w2, setW2] = useState('');
  const [w3, setW3] = useState('');
  const [wordsBuilt, setWordsBuilt] = useState(false);

  // Género matching (dropdown simulado)
  const genreKeys = Object.keys(genreItem.genres);
  const [shuffledGenres] = useState(() => [...genreKeys].sort(() => Math.random() - 0.5));
  const [genreAnswers, setGenreAnswers] = useState<Record<number, string>>({});

  // Fill-in-blank (módulo 3)
  const [fillAnswered, setFillAnswered] = useState(false);
  const [fillSel, setFillSel] = useState<number | null>(null);

  // Char builder (módulo 5)
  const [charW1, setCharW1] = useState('');
  const [charW2, setCharW2] = useState('');
  const [charW3, setCharW3] = useState('');
  const [charPoder, setCharPoder] = useState('');
  const [charDebilidad, setCharDebilidad] = useState('');
  const [charFrase, setCharFrase] = useState('');

  // Song builder (módulo 6)
  const [sgGenre, setSgGenre] = useState('');
  const [sgTema, setSgTema] = useState('');
  const [sgMood, setSgMood] = useState('');
  const [songBuilt, setSongBuilt] = useState(false);

  // Compare (módulo 7)
  const [compareAnswered, setCompareAnswered] = useState(false);
  const [compareSel, setCompareSel] = useState<number | null>(null);

  // Game builder (módulo 9)
  const [gmTipo, setGmTipo] = useState('');
  const [gmPers, setGmPers] = useState('');
  const [gmObj, setGmObj] = useState('');
  const [gmMec, setGmMec] = useState('');
  const [gameBuilt, setGameBuilt] = useState(false);

  // Historia colaborativa (módulo 10)
  const [storyCollab, setStoryCollab] = useState('');
  const [collabDone, setCollabDone] = useState(false);

  // Style compare (módulo 11)
  const [styleAnswered, setStyleAnswered] = useState(false);
  const [styleSel, setStyleSel] = useState<number | null>(null);

  // Emociones (módulo 12)
  const [emoTags, setEmoTags] = useState<string[]>([]);

  // Sprint (módulo 14)
  const [sprintIdx, setSprintIdx] = useState(0);
  const [sprintSec, setSprintSec] = useState(120);
  const [sprintDone, setSprintDone] = useState(false);
  const sprintTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Quiz inverso (módulo 16)
  const [quizInvIdx, setQuizInvIdx] = useState(0);
  const [quizInvScore, setQuizInvScore] = useState(0);
  const [quizInvDone, setQuizInvDone] = useState(false);
  const [quizInvSel, setQuizInvSel] = useState<number | null>(null);
  const [quizInvRevealed, setQuizInvRevealed] = useState(false);

  // Builder libre (módulo 17)
  const [wildText, setWildText] = useState('');
  const [wildDone, setWildDone] = useState(false);

  // Reflexión (módulo 18)
  const [reflectText, setReflectText] = useState('');
  const [reflectDone, setReflectDone] = useState(false);

  // Modo examen
  const examSteps = new Set([3, 7, 11, 14, 16]);
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
    if (step === 14) {
      setSprintIdx(0);
      setSprintSec(120);
      setSprintDone(false);
      if (sprintTimer.current) clearInterval(sprintTimer.current);
    }
  }, [step]);

  const addXP = (n: number) => setXp((prev) => prev + n);
  const goToNextStep = () => { if (step < TOTAL_STEPS - 1) setStep(step + 1); };

  const handleClose = () => {
    if (isExamMode) {
      Alert.alert('Actividad en curso', 'Si sales perderás el progreso. ¿Seguro?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Salir', style: 'destructive', onPress: () => navigation.goBack() },
      ]);
    } else {
      Alert.alert('Salir', '¿Seguro que quieres salir?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Salir', onPress: () => navigation.goBack() },
      ]);
    }
  };

  const handleFinish = () => {
    let stars = 0;
    if (xp >= 180) stars = 3;
    else if (xp >= 120) stars = 2;
    else if (xp >= 60) stars = 1;
    completeLevel(2, 3, stars, xp);
    navigation.goBack();
  };

  // ============ MECÁNICAS ============

  // Género matching (2)
  const selectGenre = (idx: number, val: string) => {
    setGenreAnswers((prev) => ({ ...prev, [idx]: val }));
  };

  const checkGenre = () => {
    if (Object.keys(genreAnswers).length < shuffledGenres.length) {
      Alert.alert('Incompleto', 'Asigna un género a cada descripción.');
      return false;
    }
    let correct = 0;
    shuffledGenres.forEach((k, i) => {
      if (genreAnswers[i] === k) correct++;
    });
    const earned = correct * 8;
    if (earned > 0) addXP(earned);
    Alert.alert(
      correct >= 3 ? '✅ ¡Bien!' : '⚠️ Revisa',
      `${correct}/${shuffledGenres.length} correctas. +${earned} XP\nCada género transforma el mismo tema en una historia completamente diferente.`,
      [{ text: 'OK', onPress: goToNextStep }]
    );
    return false;
  };

  // Fill-in-blank (3)
  const answerFill = (i: number) => {
    if (fillAnswered) return;
    setFillAnswered(true);
    setFillSel(i);
    const correct = i === fillItem.correct;
    if (correct) addXP(12);
    Alert.alert(correct ? '✅ ¡Correcto! +12 XP' : '❌ Incorrecto', fillItem.explain);
  };

  // Compare (7)
  const answerCompare = (i: number) => {
    if (compareAnswered) return;
    setCompareAnswered(true);
    setCompareSel(i);
    const correct = i === COMPARE_PAIR.correct;
    if (correct) addXP(12);
    Alert.alert(correct ? '✅ ¡Correcto! +12 XP' : '❌ Incorrecto', COMPARE_PAIR.explain);
  };

  // Style compare (11)
  const answerStyle = (i: number) => {
    if (styleAnswered) return;
    setStyleAnswered(true);
    setStyleSel(i);
    const correct = i === STYLE_COMPARE.correct;
    if (correct) addXP(12);
    Alert.alert(correct ? '✅ ¡Correcto! +12 XP' : '❌ Incorrecto', STYLE_COMPARE.explain);
  };

  // Emociones (12)
  const toggleEmo = (tag: string) => {
    setEmoTags((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      if (prev.length >= 3) {
        Alert.alert('Límite', 'Máximo 3 emociones.');
        return prev;
      }
      return [...prev, tag];
    });
  };

  // Sprint (14)
  const startSprint = () => {
    setSprintIdx(0);
    setSprintSec(120);
    setSprintDone(false);
    sprintTimer.current = setInterval(() => {
      setSprintSec((prev) => {
        if (prev <= 1) {
          clearInterval(sprintTimer.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const nextSprintTask = () => {
    if (sprintIdx + 1 >= SPRINT_TASKS.length) {
      clearInterval(sprintTimer.current!);
      const earned = 3 * 10;
      if (earned > 0) addXP(earned);
      setSprintDone(true);
    } else {
      setSprintIdx((prev) => prev + 1);
    }
  };

  // Quiz inverso (16)
  const answerQI = (i: number) => {
    if (quizInvRevealed) return;
    setQuizInvRevealed(true);
    setQuizInvSel(i);
    const item = QUIZ_INVERSO[quizInvIdx];
    const correct = i === item.correct;
    if (correct) setQuizInvScore((prev) => prev + 1);
    Alert.alert(correct ? '✅ ¡Correcto!' : '❌ Incorrecto', item.explain);
  };

  const nextQI = () => {
    if (quizInvIdx + 1 >= QUIZ_INVERSO.length) {
      const earned = (quizInvScore + (quizInvSel === QUIZ_INVERSO[quizInvIdx].correct ? 0 : 0)) * 15;
      // Recalculate score properly
      const finalScore = quizInvScore;
      const finalEarned = finalScore * 15;
      if (finalEarned > 0) addXP(finalEarned);
      setQuizInvDone(true);
    } else {
      setQuizInvIdx((prev) => prev + 1);
      setQuizInvRevealed(false);
      setQuizInvSel(null);
    }
  };

  // ============ RENDER ============
  const renderIntro = () => (
    <View>
      <View style={styles.iconCircle}><Text style={{ fontSize: 34 }}>✨</Text></View>
      <Text style={styles.title}>Prompts Creativos</Text>
      <Text style={styles.subtitle}>Ya sabes cómo funciona la IA por dentro. Ahora la usas para crear: historias, personajes, canciones, juegos, mundos enteros.</Text>
      <View style={styles.card}><Text style={styles.cardTitle}>🎯 Qué vas a aprender</Text><Text style={styles.cardText}>Cómo los adjetivos y el tono cambian todo · Técnica del "y de repente" · Personajes con 3 palabras · Sprint de 3 prompts creativos</Text></View>
      <View style={styles.card}><Text style={styles.cardTitle}>💡 La idea central</Text><Text style={styles.cardText}>La IA es un co-autor. Tú pones la visión y la dirección — ella construye. El prompt creativo es el guión del director.</Text></View>
    </View>
  );

  const renderThreeWords = () => {
    const ok = w1.trim().length >= 2 && w2.trim().length >= 2 && w3.trim().length >= 2;
    return (
      <View>
        <View style={[styles.tag, { backgroundColor: '#d1fae5' }]}><Text style={[styles.tagText, { color: '#065f46' }]}>📖 Módulo 1 · Builder</Text></View>
        <Text style={styles.title}>El prompt de 3 palabras</Text>
        <Text style={styles.subtitle}>3 palabras → prompt narrativo completo → historia.</Text>
        <TextInput style={styles.input} placeholder="Palabra 1 (personaje o lugar)" value={w1} onChangeText={(v) => { setW1(v); if (!wordsBuilt && w2.trim().length >= 2 && w3.trim().length >= 2 && v.trim().length >= 2 && !wordsBuilt) { addXP(5); setWordsBuilt(true); } }} />
        <TextInput style={styles.input} placeholder="Palabra 2 (objeto o elemento)" value={w2} onChangeText={(v) => { setW2(v); if (!wordsBuilt && w1.trim().length >= 2 && w3.trim().length >= 2 && v.trim().length >= 2 && !wordsBuilt) { addXP(5); setWordsBuilt(true); } }} />
        <TextInput style={styles.input} placeholder="Palabra 3 (emoción o acción)" value={w3} onChangeText={(v) => { setW3(v); if (!wordsBuilt && w1.trim().length >= 2 && w2.trim().length >= 2 && v.trim().length >= 2 && !wordsBuilt) { addXP(5); setWordsBuilt(true); } }} />
        {ok && (
          <View style={[styles.card, { backgroundColor: '#f0fdf4', marginTop: 10 }]}>
            <Text style={{ fontSize: 12, color: '#065f46' }}>
              Escribe el inicio de una historia donde {w1} encuentra {w2} en un momento de {w3}. Tono: evocador. Máximo 100 palabras.
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderGenreMatching = () => {
    const genreOpts = ['misterio', 'comedia', 'aventura', 'terror'];
    return (
      <View>
        <View style={[styles.tag, { backgroundColor: '#fef3c7' }]}><Text style={[styles.tagText, { color: '#92400e' }]}>🎭 Módulo 2 · Matching</Text></View>
        <Text style={styles.title}>Cambia el género</Text>
        <Text style={styles.subtitle}>Mismo tema, géneros distintos. Conecta cada descripción con su género.</Text>
        <View style={[styles.card, { backgroundColor: '#f8fafc' }]}>
          <Text style={{ fontWeight: 'bold', fontSize: 12 }}>📌 Tema base</Text>
          <Text style={{ fontStyle: 'italic', fontSize: 12 }}>{genreItem.theme}</Text>
        </View>
        {shuffledGenres.map((k, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            <View style={{ flex: 1, backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, borderWidth: 1.5, borderColor: '#e2e8f0' }}>
              <Text style={{ fontSize: 12, color: '#334155' }}>{genreItem.genres[k]}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap', width: 110 }}>
              {genreOpts.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.genreOpt, genreAnswers[i] === opt && { backgroundColor: '#ede9fe', borderColor: '#7c3aed' }]}
                  onPress={() => selectGenre(i, opt)}
                >
                  <Text style={{ fontSize: 10, fontWeight: '600', color: genreAnswers[i] === opt ? '#5b21b6' : '#64748b' }}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderFillBlank = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fff1f2' }]}><Text style={[styles.tagText, { color: '#9f1239' }]}>🌀 Módulo 3 · Fill-in-blank</Text></View>
      <Text style={styles.title}>El truco del "y de repente..."</Text>
      <Text style={styles.subtitle}>Un buen giro narrativo convierte una escena plana en una historia que engancha.</Text>
      <View style={[styles.card, { backgroundColor: '#faf5ff' }]}>
        <Text style={{ fontSize: 13, fontStyle: 'italic', color: '#334155' }}>{fillItem.prompt}</Text>
      </View>
      {fillItem.options.map((opt, i) => (
        <TouchableOpacity
          key={i}
          style={[styles.optionBtn, fillSel === i && { borderColor: fillItem.correct === i ? '#10b981' : '#ef4444', backgroundColor: fillItem.correct === i ? '#dcfce7' : '#fff1f2' }]}
          onPress={() => answerFill(i)}
          disabled={fillAnswered}
        >
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#334155' }}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderTonos = () => {
    const t = TONOS[0];
    return (
      <View>
        <View style={[styles.tag, { backgroundColor: '#dcfce7' }]}><Text style={[styles.tagText, { color: '#166534' }]}>🎨 Módulo 4 · Escenarios</Text></View>
        <Text style={styles.title}>Modifica el tono</Text>
        <Text style={styles.subtitle}>El tono lo cambia todo. Mismo escenario, tres versiones.</Text>
        <View style={[styles.card, { backgroundColor: '#f8fafc' }]}>
          <Text style={{ fontWeight: 'bold', fontSize: 12 }}>📌 Escenario base</Text>
          <Text style={{ fontStyle: 'italic', fontSize: 12 }}>{t.base}</Text>
        </View>
        <View style={[styles.card, { backgroundColor: '#faf5ff' }]}><Text style={styles.cardTitle}>🌀 Más raro</Text><Text style={{ fontStyle: 'italic', fontSize: 12 }}>{t.versiones.raro}</Text></View>
        <View style={[styles.card, { backgroundColor: '#f0fdf4' }]}><Text style={styles.cardTitle}>😄 Más divertido</Text><Text style={{ fontStyle: 'italic', fontSize: 12 }}>{t.versiones.divertido}</Text></View>
        <View style={[styles.card, { backgroundColor: '#eff6ff' }]}><Text style={styles.cardTitle}>🎯 Más serio</Text><Text style={{ fontStyle: 'italic', fontSize: 12 }}>{t.versiones.serio}</Text></View>
      </View>
    );
  };

  const renderCharBuilder = () => {
    const ok = charW1.trim().length >= 2 && charW2.trim().length >= 2 && charW3.trim().length >= 2 && charPoder.trim().length >= 5 && charDebilidad.trim().length >= 5 && charFrase.trim().length >= 10;
    return (
      <View>
        <View style={[styles.tag, { backgroundColor: '#eff6ff' }]}><Text style={[styles.tagText, { color: '#1e40af' }]}>🦸 Módulo 5 · Word-builder</Text></View>
        <Text style={styles.title}>Inventa un personaje</Text>
        <Text style={styles.subtitle}>3 palabras para el nombre + poder + debilidad + frase icónica.</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <TextInput style={[styles.input, { flex: 1 }]} placeholder="Adjetivo" value={charW1} onChangeText={setCharW1} />
          <TextInput style={[styles.input, { flex: 1 }]} placeholder="Animal/objeto" value={charW2} onChangeText={setCharW2} />
          <TextInput style={[styles.input, { flex: 1 }]} placeholder="Rol" value={charW3} onChangeText={setCharW3} />
        </View>
        <TextInput style={styles.input} placeholder="Poder único" value={charPoder} onChangeText={setCharPoder} />
        <TextInput style={styles.input} placeholder="Debilidad sorprendente" value={charDebilidad} onChangeText={setCharDebilidad} />
        <TextInput style={styles.input} placeholder="Frase icónica" value={charFrase} onChangeText={setCharFrase} />
        {ok && (
          <View style={[styles.card, { backgroundColor: '#f0fdf4', marginTop: 10 }]}>
            <Text style={{ fontSize: 12, color: '#065f46' }}>
              Nombre: {charW1} {charW2} {charW3}{'\n'}
              Poder: {charPoder}{'\n'}
              Debilidad: {charDebilidad}{'\n'}
              Frase: "{charFrase}"
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderSongBuilder = () => {
    const ok = sgGenre.trim().length >= 3 && sgTema.trim().length >= 5 && sgMood.trim().length >= 3;
    const checkSong = () => {
      if (ok && !songBuilt) { addXP(10); setSongBuilt(true); }
    };
    return (
      <View>
        <View style={[styles.tag, { backgroundColor: '#eff6ff' }]}><Text style={[styles.tagText, { color: '#1e40af' }]}>🎵 Módulo 6 · Builder</Text></View>
        <Text style={styles.title}>Prompt para una canción</Text>
        <TextInput style={styles.input} placeholder="Género musical" value={sgGenre} onChangeText={(v) => { setSgGenre(v); checkSong(); }} />
        <TextInput style={styles.input} placeholder="Tema de la canción" value={sgTema} onChangeText={(v) => { setSgTema(v); checkSong(); }} />
        <TextInput style={styles.input} placeholder="Mood / emoción dominante" value={sgMood} onChangeText={(v) => { setSgMood(v); checkSong(); }} />
        {ok && (
          <View style={[styles.card, { backgroundColor: '#f0fdf4', marginTop: 10 }]}>
            <Text style={{ fontSize: 12, color: '#065f46' }}>
              Actúa como compositor de {sgGenre}. Escribe la letra de una canción sobre {sgTema}. Mood: {sgMood}. Incluye: intro, dos estrofas y un coro pegajoso.
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderCompare = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fff1f2' }]}><Text style={[styles.tagText, { color: '#e11d48' }]}>✍️ Módulo 7 · Prompt-compare</Text></View>
      <Text style={styles.title}>Con vs. sin adjetivos</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
        <View style={{ flex: 1, backgroundColor: '#fff1f2', borderRadius: 10, padding: 10 }}>
          <Text style={{ fontWeight: 'bold', color: '#991b1b', marginBottom: 4 }}>❌ Sin adjetivos</Text>
          <Text style={{ fontFamily: 'monospace', fontSize: 11 }}>{COMPARE_PAIR.sin}</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: '#f0fdf4', borderRadius: 10, padding: 10 }}>
          <Text style={{ fontWeight: 'bold', color: '#166534', marginBottom: 4 }}>✅ Con adjetivos</Text>
          <Text style={{ fontFamily: 'monospace', fontSize: 11 }}>{COMPARE_PAIR.con}</Text>
        </View>
      </View>
      <Text style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 8 }}>{COMPARE_PAIR.question}</Text>
      {COMPARE_PAIR.opts.map((opt, i) => (
        <TouchableOpacity
          key={i}
          style={[styles.optionBtn, compareSel === i && { borderColor: COMPARE_PAIR.correct === i ? '#10b981' : '#ef4444', backgroundColor: COMPARE_PAIR.correct === i ? '#dcfce7' : '#fff1f2' }]}
          onPress={() => answerCompare(i)}
          disabled={compareAnswered}
        >
          <Text style={{ fontSize: 12 }}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderDirector = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#dcfce7' }]}><Text style={[styles.tagText, { color: '#166534' }]}>🎬 Módulo 8 · Casos reales</Text></View>
      <Text style={styles.title}>La IA como director de cine</Text>
      <View style={[styles.card, { backgroundColor: '#f8fafc' }]}>
        <Text style={styles.cardTitle}>🎥 Prompt de escena básico</Text>
        <Text style={{ fontStyle: 'italic', fontSize: 12 }}>"Describe una escena de persecución."</Text>
      </View>
      <View style={[styles.card, { backgroundColor: '#faf5ff' }]}>
        <Text style={styles.cardTitle}>🎬 Prompt de director</Text>
        <Text style={{ fontStyle: 'italic', fontSize: 12 }}>"Describe una persecución nocturna en una ciudad lluviosa. Ángulo: cámara baja. Luz: faroles amarillos. Emoción: desesperación. Sin música — solo zapatos y lluvia."</Text>
      </View>
    </View>
  );

  const renderGameBuilder = () => {
    const ok = gmTipo.trim().length >= 5 && gmPers.trim().length >= 5 && gmObj.trim().length >= 5 && gmMec.trim().length >= 5;
    const checkGame = () => {
      if (ok && !gameBuilt) { addXP(10); setGameBuilt(true); }
    };
    return (
      <View>
        <View style={[styles.tag, { backgroundColor: '#eff6ff' }]}><Text style={[styles.tagText, { color: '#1e40af' }]}>🎮 Módulo 9 · Builder</Text></View>
        <Text style={styles.title}>Prompt para inventar un juego</Text>
        <TextInput style={styles.input} placeholder="Tipo de juego" value={gmTipo} onChangeText={(v) => { setGmTipo(v); checkGame(); }} />
        <TextInput style={styles.input} placeholder="Personajes o elementos" value={gmPers} onChangeText={(v) => { setGmPers(v); checkGame(); }} />
        <TextInput style={styles.input} placeholder="Objetivo del juego" value={gmObj} onChangeText={(v) => { setGmObj(v); checkGame(); }} />
        <TextInput style={styles.input} placeholder="Mecánica especial" value={gmMec} onChangeText={(v) => { setGmMec(v); checkGame(); }} />
        {ok && (
          <View style={[styles.card, { backgroundColor: '#f0fdf4', marginTop: 10 }]}>
            <Text style={{ fontSize: 12, color: '#065f46' }}>
              Diseña las reglas de un {gmTipo}. Personajes: {gmPers}. Objetivo: {gmObj}. Mecánica especial: {gmMec}.
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderCollab = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fff1f2' }]}><Text style={[styles.tagText, { color: '#9f1239' }]}>📚 Módulo 10 · Colaborativo</Text></View>
      <Text style={styles.title}>Historia colaborativa</Text>
      <View style={[styles.card, { backgroundColor: '#faf5ff' }]}>
        <Text style={{ fontStyle: 'italic', fontSize: 13, lineHeight: 20 }}>{collabStory.inicio}</Text>
      </View>
      <TextInput
        style={styles.textArea}
        multiline
        placeholder={collabStory.placeholder}
        value={storyCollab}
        onChangeText={(v) => {
          setStoryCollab(v);
          if (v.trim().length >= 30 && !collabDone) { addXP(8); setCollabDone(true); }
        }}
      />
      <Text style={{ fontSize: 11, color: '#94a3b8', textAlign: 'right' }}>{storyCollab.length} / mínimo 30 caracteres</Text>
    </View>
  );

  const renderStyleCompare = () => {
    const s = STYLE_COMPARE;
    return (
      <View>
        <View style={[styles.tag, { backgroundColor: '#fff1f2' }]}><Text style={[styles.tagText, { color: '#e11d48' }]}>🎨 Módulo 11 · Prompt-compare</Text></View>
        <Text style={styles.title}>El mismo prompt en 3 estilos</Text>
        <View style={[styles.card, { backgroundColor: '#f8fafc' }]}>
          <Text style={{ fontWeight: 'bold', fontSize: 12 }}>📌 Tema</Text>
          <Text style={{ fontStyle: 'italic', fontSize: 12 }}>{s.tema}</Text>
        </View>
        <View style={[styles.card, { backgroundColor: '#eff6ff' }]}><Text style={styles.cardTitle}>📋 Realista</Text><Text style={{ fontStyle: 'italic', fontSize: 12 }}>{s.realista}</Text></View>
        <View style={[styles.card, { backgroundColor: '#faf5ff' }]}><Text style={styles.cardTitle}>🌀 Surrealista</Text><Text style={{ fontStyle: 'italic', fontSize: 12 }}>{s.surrealista}</Text></View>
        <View style={[styles.card, { backgroundColor: '#fffbeb' }]}><Text style={styles.cardTitle}>✨ Poético</Text><Text style={{ fontStyle: 'italic', fontSize: 12 }}>{s.poetico}</Text></View>
        <Text style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 8 }}>{s.question}</Text>
        {s.opts.map((opt, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.optionBtn, styleSel === i && { borderColor: s.correct === i ? '#10b981' : '#ef4444', backgroundColor: s.correct === i ? '#dcfce7' : '#fff1f2' }]}
            onPress={() => answerStyle(i)}
            disabled={styleAnswered}
          >
            <Text style={{ fontSize: 12 }}>{opt}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderEmociones = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fdf2f8' }]}><Text style={[styles.tagText, { color: '#9d174d' }]}>💜 Módulo 12 · Word-builder</Text></View>
      <Text style={styles.title}>Emociones en el prompt</Text>
      <Text style={styles.subtitle}>Selecciona hasta 3 adjetivos emocionales.</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 }}>
        {EMO_OPTIONS.map((emo) => (
          <TouchableOpacity
            key={emo}
            style={[styles.emoTag, emoTags.includes(emo) && { backgroundColor: '#ede9fe', borderColor: '#7c3aed' }]}
            onPress={() => toggleEmo(emo)}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: emoTags.includes(emo) ? '#5b21b6' : '#64748b' }}>{emo}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {emoTags.length > 0 && (
        <View style={[styles.card, { backgroundColor: '#f0fdf4' }]}>
          <Text style={{ fontSize: 12, color: '#065f46' }}>
            Escribe un poema sobre el paso del tiempo con tono {emoTags.join(', ')}. Que cada estrofa capture una emoción diferente.
          </Text>
        </View>
      )}
    </View>
  );

  const renderMemes = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#dcfce7' }]}><Text style={[styles.tagText, { color: '#166534' }]}>😂 Módulo 13 · Casos reales</Text></View>
      <Text style={styles.title}>Crea un meme con palabras</Text>
      <View style={styles.card}><Text style={styles.cardTitle}>💡 Fórmula del prompt-meme</Text><Text style={styles.cardText}>Genera un meme sobre [tema]. Imagen: [describe]. Texto superior: [frase 1]. Texto inferior: [frase 2]. Tono: [irónico / absurdo / motivacional]</Text></View>
      <View style={[styles.card, { backgroundColor: '#faf5ff' }]}><Text style={styles.cardTitle}>Ejemplo — Meme escolar</Text><Text style={{ fontSize: 11, fontStyle: 'italic' }}>Imagen: perro rodeado de llamas. Texto superior: "Yo cuando tengo 3 parciales mañana". Texto inferior: "Pero primero termino este video".</Text></View>
    </View>
  );

  const renderSprint = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fef3c7' }]}><Text style={[styles.tagText, { color: '#92400e' }]}>⚡ Módulo 14 · Sprint creativo</Text></View>
      <Text style={styles.title}>Sprint: 3 prompts en 2 minutos</Text>
      <Text style={{ fontSize: 28, fontWeight: 'bold', textAlign: 'center', color: '#7c3aed', marginVertical: 8 }}>
        {Math.floor(sprintSec / 60)}:{String(sprintSec % 60).padStart(2, '0')}
      </Text>
      <View style={{ height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}>
        <View style={{ height: '100%', width: `${(sprintSec / 120) * 100}%`, backgroundColor: '#7c3aed', borderRadius: 3 }} />
      </View>
      {sprintDone ? (
        <View style={{ padding: 14, backgroundColor: '#dcfce7', borderRadius: 10, marginTop: 8 }}>
          <Text style={{ fontWeight: 'bold', color: '#166534', textAlign: 'center' }}>🏁 3/3 prompts diseñados. +30 XP</Text>
        </View>
      ) : (
        <View>
          <View style={[styles.card, { backgroundColor: '#f5f3ff', borderColor: '#c4b5fd' }]}>
            <Text style={{ fontSize: 14, fontWeight: 'bold', textAlign: 'center' }}>{SPRINT_TASKS[sprintIdx]}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#7c3aed' }]} onPress={startSprint}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>▶ Iniciar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#f5f3ff', borderWidth: 1.5, borderColor: '#c4b5fd' }]} onPress={nextSprintTask}>
              <Text style={{ color: '#5b21b6', fontWeight: 'bold' }}>✓ Hecho →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  const renderEtica = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fdf4ff' }]}><Text style={[styles.tagText, { color: '#7e22ce' }]}>⚖️ Módulo 15 · Reflexión ética</Text></View>
      <Text style={styles.title}>¿Cuándo NO usar IA para crear?</Text>
      <View style={[styles.card, { backgroundColor: '#fff1f2' }]}>
        <Text style={styles.cardTitle}>🚫 El límite entre apoyarse y reemplazarse</Text>
        <Text style={styles.cardText}>❌ Trampa académica: entregar trabajo de IA como tuyo.{'\n'}❌ Perder tu voz: si todo lo que "creas" viene de la IA.{'\n'}✅ La regla: usa la IA para amplificar tu visión, no para reemplazarla.</Text>
      </View>
    </View>
  );

  const renderQuizInv = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#eef2ff' }]}><Text style={[styles.tagText, { color: '#3730a3' }]}>🔍 Módulo 16 · Quiz inverso ({quizInvIdx + 1}/{QUIZ_INVERSO.length})</Text></View>
      <Text style={styles.title}>¿Cuál prompt generó este resultado?</Text>
      <View style={[styles.card, { backgroundColor: '#f0fdf4', marginBottom: 10 }]}>
        <Text style={{ fontStyle: 'italic', fontSize: 13, lineHeight: 20 }}>{QUIZ_INVERSO[quizInvIdx].resultado}</Text>
      </View>
      {QUIZ_INVERSO[quizInvIdx].opts.map((opt, i) => (
        <TouchableOpacity
          key={i}
          style={[styles.optionBtn, quizInvRevealed && i === QUIZ_INVERSO[quizInvIdx].correct && { borderColor: '#10b981', backgroundColor: '#dcfce7' }, quizInvSel === i && !quizInvRevealed && { borderColor: '#7c3aed' }]}
          onPress={() => answerQI(i)}
          disabled={quizInvRevealed}
        >
          <Text style={{ fontSize: 12, fontWeight: '600' }}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderWild = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#eff6ff' }]}><Text style={[styles.tagText, { color: '#1e40af' }]}>🚀 Módulo 17 · Builder libre</Text></View>
      <Text style={styles.title}>Lo que nunca habrías escrito solo</Text>
      <TextInput
        style={styles.textArea}
        multiline
        placeholder="Escribe tu prompt más arriesgado (mín. 30 caracteres)..."
        value={wildText}
        onChangeText={(v) => {
          setWildText(v);
          if (v.trim().length >= 30 && !wildDone) { addXP(10); setWildDone(true); }
        }}
      />
      <Text style={{ fontSize: 11, color: '#94a3b8', textAlign: 'right' }}>{wildText.length} / mínimo 30 caracteres</Text>
    </View>
  );

  const renderReflect = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#f1f5f9' }]}><Text style={[styles.tagText, { color: '#475569' }]}>✨ Módulo 18 · Reflexión</Text></View>
      <Text style={styles.title}>¿La creación es tuya o de la IA?</Text>
      <TextInput
        style={styles.textArea}
        multiline
        placeholder="Escribe tu reflexión (mín. 50 caracteres)..."
        value={reflectText}
        onChangeText={(v) => {
          setReflectText(v);
          if (v.trim().length >= 50 && !reflectDone) { addXP(15); setReflectDone(true); }
        }}
      />
      <Text style={{ fontSize: 11, color: '#94a3b8', textAlign: 'right' }}>{reflectText.length} / mínimo 50 caracteres</Text>
    </View>
  );

  const renderCompletion = () => (
    <View style={{ alignItems: 'center', padding: 20 }}>
      <Text style={{ fontSize: 44, marginBottom: 14 }}>🏅</Text>
      <Text style={[styles.title, { textAlign: 'center' }]}>¡Nivel 9 completado!</Text>
      <Text style={[styles.subtitle, { textAlign: 'center' }]}>Terminaste "Prompts Creativos". Ahora no solo sabes escribir prompts — sabes dirigirlos.</Text>
      <Text style={{ fontWeight: 'bold', fontSize: 15, color: '#92400e', marginBottom: 14 }}>⭐ {xp} XP ganados</Text>
      <TouchableOpacity style={styles.finishButton} onPress={handleFinish}>
        <Text style={{ fontWeight: 'bold', color: '#fff' }}>Volver al mapa</Text>
      </TouchableOpacity>
    </View>
  );

  // ============ RENDER PRINCIPAL ============
  const renderStepContent = () => {
    switch (step) {
      case 0: return renderIntro();
      case 1: return renderThreeWords();
      case 2: return renderGenreMatching();
      case 3: return renderFillBlank();
      case 4: return renderTonos();
      case 5: return renderCharBuilder();
      case 6: return renderSongBuilder();
      case 7: return renderCompare();
      case 8: return renderDirector();
      case 9: return renderGameBuilder();
      case 10: return renderCollab();
      case 11: return renderStyleCompare();
      case 12: return renderEmociones();
      case 13: return renderMemes();
      case 14: return renderSprint();
      case 15: return renderEtica();
      case 16: return renderQuizInv();
      case 17: return renderWild();
      case 18: return renderReflect();
      case 19: return renderCompletion();
      default: return null;
    }
  };

  const progressPercent = (step / (TOTAL_STEPS - 1)) * 100;

  const handleMainBtn = () => {
    const handlers: Record<number, (() => boolean) | undefined> = {
      1: () => w1.trim().length >= 2 && w2.trim().length >= 2 && w3.trim().length >= 2,
      2: checkGenre,
      3: () => fillAnswered,
      5: () => charW1.trim().length >= 2 && charW2.trim().length >= 2 && charW3.trim().length >= 2 && charPoder.trim().length >= 5 && charDebilidad.trim().length >= 5 && charFrase.trim().length >= 10,
      6: () => sgGenre.trim().length >= 3 && sgTema.trim().length >= 5 && sgMood.trim().length >= 3,
      7: () => compareAnswered,
      9: () => gmTipo.trim().length >= 5 && gmPers.trim().length >= 5 && gmObj.trim().length >= 5 && gmMec.trim().length >= 5,
      10: () => storyCollab.trim().length >= 30,
      11: () => styleAnswered,
      12: () => emoTags.length >= 1,
      14: () => sprintDone,
      16: () => {
        if (quizInvDone) return true;
        if (quizInvRevealed) { nextQI(); return false; }
        Alert.alert('Elige una opción', 'Selecciona cuál prompt generó este resultado.');
        return false;
      },
     17: () => wildText.trim().length >= 30,
     18: () => reflectText.trim().length >= 50,
    };
    const handler = handlers[step];
    if (handler) {
      if (!handler()) return;
    }
    goToNextStep();
  };

  const showNextBtn = step < TOTAL_STEPS - 1 && ![1, 2, 3, 5, 6, 7, 9, 10, 11, 12, 14, 16, 17, 18].includes(step);
  const showCheckBtn = [1, 2, 3, 5, 6, 7, 9, 10, 11, 12, 14, 16, 17, 18].includes(step) && step < TOTAL_STEPS - 1;

  const getBtnLabel = () => {
    switch (step) {
      case 1: return 'Continuar →';
      case 2: return 'Verificar →';
      case 3: return 'Continuar →';
      case 5: return 'Continuar →';
      case 6: return 'Continuar →';
      case 7: return 'Continuar →';
      case 9: return 'Continuar →';
      case 10: return 'Continuar →';
      case 11: return 'Continuar →';
      case 12: return 'Continuar →';
      case 14: return sprintDone ? 'Continuar →' : 'Siguiente →';
      case 16: return quizInvDone ? 'Continuar →' : 'Siguiente →';
      case 17: return 'Continuar →';
      case 18: return 'Completar nivel →';
      default: return 'Continuar →';
    }
  };

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
        {renderStepContent()}
      </ScrollView>
      {showNextBtn && (
        <TouchableOpacity style={styles.nextButton} onPress={goToNextStep}>
          <Text style={styles.nextButtonText}>Continuar →</Text>
        </TouchableOpacity>
      )}
      {showCheckBtn && (
        <TouchableOpacity style={styles.nextButton} onPress={step === 14 && sprintIdx === 0 && sprintSec === 120 ? startSprint : handleMainBtn}>
          <Text style={styles.nextButtonText}>{getBtnLabel()}</Text>
        </TouchableOpacity>
      )}
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
  genreOpt: { padding: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#fff', marginBottom: 4 },
  emoTag: { padding: 8, paddingHorizontal: 13, borderRadius: 20, borderWidth: 2, borderColor: '#c4b5fd', backgroundColor: '#f5f3ff' },
  actionBtn: { flex: 1, padding: 11, borderRadius: 11, alignItems: 'center' },
  nextButton: { backgroundColor: '#10b981', padding: 14, margin: 16, borderRadius: 11, alignItems: 'center' },
  nextButtonText: { ...typography.bold, color: '#fff', fontSize: 15 },
  finishButton: { backgroundColor: '#10b981', padding: 14, borderRadius: 11, width: '100%', alignItems: 'center', marginTop: 14 },
});