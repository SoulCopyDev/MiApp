import { exitLevel } from '../utils/exitLevel';
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
import { useNavigation } from '@react-navigation/native';
import { useGameStore } from '../store/gameStore';
import { colors, typography } from '../theme';
import XPToast from '../components/XPToast';

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
type MCQ = {
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
// El botón "Volver" solo aparece en módulos puramente informativos (leer + Continuar,
// sin input ni ejercicio puntuado). NO en actividades/ejercicios/evaluaciones.
// (El HTML clasificaba mal: marcaba builders como teoría y omitía el módulo 4.)
// 4 = Modifica el tono · 8 = IA como director · 13 = Crea un meme · 15 = ¿Cuándo no usar IA?
const THEORY_STEPS = new Set([4, 8, 13, 15]);

const pickN = <T,>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};

// Baraja las opciones de un MCQ preservando cuál es la correcta (evita que la
// respuesta correcta caiga siempre en la misma posición).
function shuffleMCQ<T extends { opts: string[]; correct: number }>(q: T): T {
  const paired = q.opts.map((opt, i) => ({ opt, ok: i === q.correct }));
  for (let j = paired.length - 1; j > 0; j--) {
    const k = Math.floor(Math.random() * (j + 1));
    [paired[j], paired[k]] = [paired[k], paired[j]];
  }
  return { ...q, opts: paired.map((p) => p.opt), correct: paired.findIndex((p) => p.ok) };
}
function shuffleFill(f: FillItem): FillItem {
  const paired = f.options.map((opt, i) => ({ opt, ok: i === f.correct }));
  for (let j = paired.length - 1; j > 0; j--) {
    const k = Math.floor(Math.random() * (j + 1));
    [paired[j], paired[k]] = [paired[k], paired[j]];
  }
  return { ...f, options: paired.map((p) => p.opt), correct: paired.findIndex((p) => p.ok) };
}

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

// Por qué cada frase pertenece a su género (feedback para ~12 años).
const GENRE_REASONS: Record<string, string> = {
  misterio: 'deja una pregunta sin resolver que da intriga',
  comedia: 'busca hacerte reír con algo inesperado o ridículo',
  aventura: 'propone acción, un viaje o un reto por superar',
  terror: 'crea miedo o tensión con algo inquietante',
};

// Opciones de longitud pareja (la correcta NO es la más larga) + se barajan.
const FILLS_POOL: FillItem[] = [
  {
    prompt: 'Una científica trabaja toda la noche en su laboratorio cuando',
    options: [
      'recibe un mensaje de un número desconocido: "Para. Ya es tarde."',
      'decide tomar un descanso y se prepara otro café bien cargado para seguir.',
      'revisa sus notas, apaga las luces y se marcha a su casa a dormir.',
      'recuerda que mañana debe madrugar para llegar temprano a otra clase.',
    ],
    correct: 0,
    explain:
      'El mensaje de un número desconocido ("Para. Ya es tarde.") abre una pregunta inquietante y convierte una escena normal en misterio. Las otras cierran la escena sin tensión.',
  },
  {
    prompt: 'El robot entregó el paquete en la dirección equivocada. Cuando la dueña de la casa abrió la puerta,',
    options: [
      'descubrió que dentro estaba lo que había perdido hacía diez años.',
      'le explicó con calma al robot que ese paquete claramente no era para ella.',
      'revisó la etiqueta, cerró la puerta y llamó a la empresa de envíos.',
      'lo dejó en la entrada y siguió con su día como cualquier otro día.',
    ],
    correct: 0,
    explain:
      'Encontrar lo que se perdió hace años convierte un error de reparto en un momento lleno de emoción. Ese giro inesperado es el "y de repente" perfecto.',
  },
];

// Módulo 5 — personaje por chips (Misión guiada + IA simulada)
const CHAR_ESPECIES = [
  { chip: '🦊 Zorro', art: 'un zorro', name: 'Chispa' },
  { chip: '🤖 Robot', art: 'un robot', name: 'Tuerca' },
  { chip: '🐉 Dragón', art: 'un dragón', name: 'Ígnea' },
  { chip: '🌱 Planta', art: 'una planta', name: 'Brote' },
  { chip: '🌑 Sombra', art: 'una sombra', name: 'Umbra' },
  { chip: '🐱 Gato', art: 'un gato', name: 'Michi' },
];
const CHAR_PODERES = [
  'volar',
  'volverse invisible',
  'leer mentes',
  'controlar el tiempo',
  'hablar con animales',
  'crear fuego',
];
const CHAR_MIEDOS = [
  'la lluvia',
  'la oscuridad',
  'los ruidos fuertes',
  'quedarse solo',
  'las alturas',
  'el silencio',
];

// Módulo 7 — ¿qué le falta al prompt? (neutral, no revela la respuesta)
const MISSING_PROMPT = {
  weak: 'Escribe un cuento corto sobre la lluvia.',
  question: '¿Qué le falta a este prompt para dar una historia más rica y específica?',
  opts: [
    'Detalles de emoción y atmósfera que guíen el tono',
    'Nada, un prompt corto ya es perfecto así',
    'Palabras más difíciles para que suene inteligente',
    'Quitarle todo para darle libertad total a la IA',
  ],
  correct: 0,
  explain:
    'Los adjetivos de emoción y atmósfera (melancólica, domingo, nostalgia) le dicen a la IA qué "clima" quieres. Con ellos el cuento tiene un foco claro; sin ellos, sale genérico.',
  better:
    'Escribe un cuento sobre una lluvia melancólica de domingo que hace que una niña recuerde algo que perdió.',
};

// Módulo 11 — elegir el estilo correcto (opciones parejas + barajadas)
const STYLE_COMPARE = {
  tema: 'Un astronauta que encuentra una puerta en el espacio vacío',
  realista:
    'Describe técnicamente lo que haría un astronauta de la NASA al encontrar una estructura no identificada en órbita.',
  surrealista: 'La puerta era de madera de roble y olía a lluvia aunque en el espacio no hay lluvia.',
  poetico: 'Entre estrellas que aún no tienen nombre, una puerta esperaba — sin pared, sin casa, sin razón.',
  question: '¿Cuál estilo usarías para un cuento de ciencia ficción literaria?',
  opts: [
    'Realista — los detalles técnicos dan credibilidad a la historia',
    'Poético — capta la extrañeza y la emoción del momento',
    'Surrealista — es el único válido para ciencia ficción',
    'Los tres dan exactamente el mismo resultado al final',
  ],
  correct: 1,
  explain:
    'Para ciencia ficción literaria el tono poético crea asombro y resonancia emocional. El realista sirve para hard sci-fi técnico y el surrealista para ficción experimental. Elegir el estilo correcto es parte del prompting creativo.',
};

// Módulo 16 — quiz inverso (ahora hay distractores LARGOS pero incorrectos:
// la respuesta correcta ya no es "la más larga").
const QUIZ_INVERSO: QuizInversoItem[] = [
  {
    resultado:
      '"Era una noche de tormenta épica cuando el detective más torpe del reino llegó tropezando a la escena del crimen... y pisó la única pista."',
    opts: [
      'Escribe un cuento de misterio.',
      'Actúa como narrador de comedia. Escribe el inicio de una historia de misterio donde el detective es desastroso. Tono: absurdo y exagerado.',
      'Actúa como escritor de terror. Describe la llegada de un detective a una escena del crimen en una noche de tormenta. Tono: sombrío y tenso.',
      'Describe una escena de crimen.',
    ],
    correct: 1,
    explain:
      'El tono "absurdo y exagerado" + "detective desastroso" generó exactamente ese mix de misterio y comedia. La opción de terror también es detallada, pero pide un tono sombrío: por eso no encaja.',
  },
  {
    resultado:
      '"🎸 CUANDO LAS MATEMÁTICAS TE LLAMAN / y tú no quieres contestar / pero el parcial es mañana / y toca ponerse a estudiar 🎸"',
    opts: [
      'Haz una canción sobre matemáticas.',
      'Actúa como poeta clásico. Escribe un soneto sobre la belleza de los números. Tono: solemne y elegante.',
      'Actúa como compositor de rock latinoamericano. Escribe el coro de una canción sobre la procrastinación ante un examen de matemáticas. Tono: dramático pero divertido.',
      'Escribe una canción de rock.',
    ],
    correct: 2,
    explain:
      'El género (rock latinoamericano), el tema exacto (procrastinación + examen) y el tono (dramático pero divertido) generaron ese resultado. El soneto también es un prompt largo, pero pide algo solemne y sin humor.',
  },
];

// Módulo 14 — Sprint: completar el prompt rellenando huecos
const SPRINT_ROUNDS = [
  {
    titulo: '✍️ Reto 1 · Un cuento',
    parts: ['Actúa como ', ', escribe un cuento sobre ', ', con un tono ', ' y de ', '.'],
    labels: ['Rol', 'Tema', 'Tono', 'Extensión'],
    blanks: [
      ['un cuentacuentos', 'un narrador de aventuras', 'un escritor de misterio'],
      ['un robot y su abuela', 'una receta secreta', 'un viaje a la Luna'],
      ['divertido', 'emocionante', 'misterioso'],
      ['3 líneas', 'un párrafo', 'media página'],
    ],
  },
  {
    titulo: '🎵 Reto 2 · Una canción',
    parts: ['Actúa como ', ', compón una canción sobre ', ', con un mood ', ' e incluye ', '.'],
    labels: ['Rol', 'Tema', 'Mood', 'Incluye'],
    blanks: [
      ['un compositor de reggaeton', 'un cantautor pop', 'un rapero'],
      ['estudiar para un examen', 'el primer día de clases', 'una amistad'],
      ['divertido', 'motivador', 'nostálgico'],
      ['un coro pegajoso', 'dos estrofas', 'una intro corta'],
    ],
  },
  {
    titulo: '🎮 Reto 3 · Un juego',
    parts: ['Diseña ', ' donde los jugadores usan ', ', el objetivo es ', ' y la regla especial es ', '.'],
    labels: ['Tipo', 'Usan', 'Objetivo', 'Regla'],
    blanks: [
      ['un juego de mesa', 'un videojuego', 'un juego de cartas'],
      ['emojis', 'cartas de colores', 'dados'],
      ['llegar primero a la meta', 'resolver un misterio', 'reunir a todo el equipo'],
      ['solo se gana cooperando', 'cada turno cambia una regla', 'no se puede hablar'],
    ],
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
      divertido: 'Decidió estudiar con música de telenovela turca. Error épico.',
      serio: 'Repasó cada concepto. Sabía que mañana cambiaría algo en él.',
    },
  },
];

// Detectores para el checklist del Módulo 17
const detectInstr = (t: string) =>
  /\b(escribe|crea|act[uú]a|haz|dise[nñ]a|describe|inventa|genera|imagina|cuenta|comp[oó]n|redacta|narra)\b/i.test(t);
const detectTono = (t: string) =>
  /\b(tono|mood|divertido|serio|misterioso|[eé]pico|triste|alegre|dram[aá]tico|oscuro|melanc[oó]lico|absurdo|solemne|nost[aá]lgico|gracioso|terror[ií]fico|rom[aá]ntico|inspirador|c[oó]mico|po[eé]tico|surrealista)\b/i.test(t);
const detectFormato = (t: string) =>
  /\b(l[ií]nea|l[ií]neas|p[aá]rrafo|estrofa|coro|palabras|lista|pasos?|p[aá]gina|verso|cap[ií]tulo|estilo de|formato|columnas?|di[aá]logo)\b/i.test(t);
const detectTema = (t: string) => t.trim().split(/\s+/).filter(Boolean).length >= 6 || /\bsobre\b/i.test(t);

// ===================== HELPERS DE UI =====================
const HL_COLORS: Record<string, { border: string; bg: string; color: string }> = {
  purple: { border: '#8b5cf6', bg: '#faf5ff', color: '#5b21b6' },
  green: { border: '#10b981', bg: '#f0fdf4', color: '#065f46' },
  amber: { border: '#f59e0b', bg: '#fffbeb', color: '#92400e' },
  blue: { border: '#0ea5e9', bg: '#f0f9ff', color: '#0369a1' },
  red: { border: '#ef4444', bg: '#fff1f2', color: '#991b1b' },
};
const Bold = ({ children }: { children: React.ReactNode }) => (
  <Text style={{ fontWeight: '700', color: '#0f172a' }}>{children}</Text>
);
function Hl({ variant = 'purple', children }: { variant?: string; children: React.ReactNode }) {
  const v = HL_COLORS[variant];
  return (
    <View style={[styles.hlBox, { borderLeftColor: v.border, backgroundColor: v.bg }]}>
      <Text style={[styles.hlText, { color: v.color }]}>{children}</Text>
    </View>
  );
}
function TipBox({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.tipBox}>
      <Text style={styles.tipText}>{children}</Text>
    </View>
  );
}
function FeedbackBar({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <View style={[styles.fbBar, ok ? styles.fbOk : styles.fbWrong]}>
      <Text style={[styles.fbText, { color: ok ? '#166534' : '#991b1b' }]}>{children}</Text>
    </View>
  );
}
function BuilderLabel({ children }: { children: React.ReactNode }) {
  return <Text style={[styles.builderLabel, { color: '#7e22ce' }]}>{children}</Text>;
}

// ===================== COMPONENTE =====================
export default function World2Level3() {
  const navigation = useNavigation();
  const completeLevel = useGameStore((state) => state.completeLevel);

  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);
  const [xpToast, setXpToast] = useState<{ amount: number; id: number } | null>(null);

  // Pools aleatorios
  const [genreItem] = useState(() => pickN(GENRE_POOL, 1)[0]);
  const [fillItem] = useState(() => shuffleFill(pickN(FILLS_POOL, 1)[0]));
  const [collabStory] = useState(() => pickN(COLLAB_STORIES, 1)[0]);
  const [missingQ] = useState(() => shuffleMCQ(MISSING_PROMPT as MCQ));
  const [styleQ] = useState(() => shuffleMCQ(STYLE_COMPARE as unknown as MCQ));
  const [quizItems] = useState(() => QUIZ_INVERSO.map(shuffleMCQ));

  // Módulo 1
  const [w1, setW1] = useState('');
  const [w2, setW2] = useState('');
  const [w3, setW3] = useState('');
  const [wordsBuilt, setWordsBuilt] = useState(false);

  // Módulo 2 — matching con dropdown
  const genreKeys = Object.keys(genreItem.genres);
  const [shuffledGenres] = useState(() => [...genreKeys].sort(() => Math.random() - 0.5));
  const [genreAnswers, setGenreAnswers] = useState<Record<number, string>>({});
  const [openGenreDropdown, setOpenGenreDropdown] = useState<number | null>(null);
  const [genreChecked, setGenreChecked] = useState(false);
  const [genreScore, setGenreScore] = useState(0);

  // Módulo 3
  const [fillAnswered, setFillAnswered] = useState(false);
  const [fillSel, setFillSel] = useState<number | null>(null);

  // Módulo 5 — personaje por chips
  const [charEspecie, setCharEspecie] = useState<number | null>(null);
  const [charPoder, setCharPoder] = useState<string | null>(null);
  const [charMiedo, setCharMiedo] = useState<string | null>(null);
  const [charDone, setCharDone] = useState(false);

  // Módulo 6
  const [sgGenre, setSgGenre] = useState('');
  const [sgTema, setSgTema] = useState('');
  const [sgMood, setSgMood] = useState('');
  const [songBuilt, setSongBuilt] = useState(false);

  // Módulo 7 — ¿qué le falta?
  const [missingAnswered, setMissingAnswered] = useState(false);
  const [missingSel, setMissingSel] = useState<number | null>(null);

  // Módulo 9
  const [gmTipo, setGmTipo] = useState('');
  const [gmPers, setGmPers] = useState('');
  const [gmObj, setGmObj] = useState('');
  const [gmMec, setGmMec] = useState('');
  const [gameBuilt, setGameBuilt] = useState(false);

  // Módulo 10
  const [storyCollab, setStoryCollab] = useState('');
  const [collabDone, setCollabDone] = useState(false);

  // Módulo 11
  const [styleAnswered, setStyleAnswered] = useState(false);
  const [styleSel, setStyleSel] = useState<number | null>(null);

  // Módulo 12
  const [emoTags, setEmoTags] = useState<string[]>([]);

  // Módulo 14 — Sprint (completar el prompt)
  const [sprintStarted, setSprintStarted] = useState(false);
  const [sprintReto, setSprintReto] = useState(0);
  const [sprintFills, setSprintFills] = useState<Record<number, number>>({});
  const [sprintScore, setSprintScore] = useState(0);
  const [sprintSec, setSprintSec] = useState(120);
  const [sprintDone, setSprintDone] = useState(false);
  const sprintTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const sprintScoreRef = useRef(0);

  // Módulo 16 — quiz inverso
  const [quizInvIdx, setQuizInvIdx] = useState(0);
  const [quizInvScore, setQuizInvScore] = useState(0);
  const [quizInvDone, setQuizInvDone] = useState(false);
  const [quizInvSel, setQuizInvSel] = useState<number | null>(null);
  const [quizInvRevealed, setQuizInvRevealed] = useState(false);

  // Módulo 17 — checklist auto-evaluable
  const [wildText, setWildText] = useState('');
  const [wildChecklist, setWildChecklist] = useState<Record<string, boolean>>({});
  const [wildAwarded, setWildAwarded] = useState(false);

  // Módulo 18
  const [reflectText, setReflectText] = useState('');
  const [reflectDone, setReflectDone] = useState(false);

  // Modo actividad (para confirmación al salir)
  const examSteps = new Set([2, 3, 7, 11, 14, 16]);
  const isExamMode = examSteps.has(step);

  useEffect(() => {
    const onBackPress = () => {
      if (isExamMode) {
        Alert.alert('Módulo en curso', 'No puedes regresar durante esta actividad.', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Salir', style: 'destructive', onPress: () => exitLevel({ confirm: false }) },
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
      setSprintStarted(false);
      setSprintReto(0);
      setSprintFills({});
      setSprintScore(0);
      sprintScoreRef.current = 0;
      setSprintSec(120);
      setSprintDone(false);
      if (sprintTimer.current) clearInterval(sprintTimer.current);
    }
    return () => {
      if (sprintTimer.current) clearInterval(sprintTimer.current);
    };
  }, [step]);

  const addXP = (n: number) => {
    setXp((prev) => prev + n);
    if (n > 0) setXpToast((prev) => ({ amount: n, id: (prev?.id ?? 0) + 1 }));
  };
  const goToNextStep = () => {
    if (step < TOTAL_STEPS - 1) setStep(step + 1);
  };
  const goToPrevStep = () => setStep((s) => s - 1);

  const handleClose = () => {
    Alert.alert('Salir', 'Si sales perderás el progreso de este nivel. ¿Seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: () => exitLevel({ confirm: false }) },
    ]);
  };

  const handleFinish = () => {
    let stars = 0;
    if (xp >= 180) stars = 3;
    else if (xp >= 120) stars = 2;
    else if (xp >= 60) stars = 1;
    completeLevel(9, stars, xp);
    exitLevel({ confirm: false });
  };

  // ============ MECÁNICAS ============
  const threeWordsOk = w1.trim().length >= 2 && w2.trim().length >= 2 && w3.trim().length >= 2;

  const selectGenre = (idx: number, val: string) => {
    if (genreChecked) return;
    setGenreAnswers((prev) => ({ ...prev, [idx]: val }));
  };
  const allGenresFilled = shuffledGenres.every((_, i) => genreAnswers[i]);
  const checkGenre = () => {
    if (genreChecked || !allGenresFilled) return;
    let correct = 0;
    shuffledGenres.forEach((k, i) => {
      if (genreAnswers[i] === k) correct++;
    });
    setGenreScore(correct);
    setGenreChecked(true);
    setOpenGenreDropdown(null);
    if (correct > 0) addXP(correct * 8);
  };

  const answerFill = (i: number) => {
    if (fillAnswered) return;
    setFillAnswered(true);
    setFillSel(i);
    if (i === fillItem.correct) addXP(12);
  };

  // Módulo 5
  const maybeAwardChar = (e: number | null, p: string | null, m: string | null) => {
    if (e !== null && p !== null && m !== null && !charDone) {
      addXP(10);
      setCharDone(true);
    }
  };

  const answerMissing = (i: number) => {
    if (missingAnswered) return;
    setMissingAnswered(true);
    setMissingSel(i);
    if (i === missingQ.correct) addXP(12);
  };

  const answerStyle = (i: number) => {
    if (styleAnswered) return;
    setStyleAnswered(true);
    setStyleSel(i);
    if (i === styleQ.correct) addXP(12);
  };

  const toggleEmo = (tag: string) => {
    setEmoTags((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      if (prev.length >= 3) return prev;
      return [...prev, tag];
    });
  };

  // Sprint
  const startSprint = () => {
    setSprintStarted(true);
    setSprintReto(0);
    setSprintFills({});
    setSprintScore(0);
    sprintScoreRef.current = 0;
    setSprintSec(120);
    setSprintDone(false);
    if (sprintTimer.current) clearInterval(sprintTimer.current);
    sprintTimer.current = setInterval(() => {
      setSprintSec((prev) => {
        if (prev <= 1) {
          finishSprint(sprintScoreRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };
  const finishSprint = (retosDone: number) => {
    if (sprintTimer.current) clearInterval(sprintTimer.current);
    const done = Math.min(retosDone, SPRINT_ROUNDS.length);
    setSprintScore(done);
    sprintScoreRef.current = done;
    setSprintDone(true);
    if (done > 0) addXP(done * 10);
  };
  const pickSprintBlank = (blankIdx: number, optIdx: number) => {
    setSprintFills((prev) => ({ ...prev, [blankIdx]: optIdx }));
  };
  const currentRetoFilled =
    Object.keys(sprintFills).length === SPRINT_ROUNDS[sprintReto].blanks.length;
  const completeReto = () => {
    if (!currentRetoFilled) return;
    const done = sprintReto + 1;
    if (done >= SPRINT_ROUNDS.length) {
      finishSprint(done);
    } else {
      setSprintReto(done);
      setSprintFills({});
      setSprintScore(done);
      sprintScoreRef.current = done;
    }
  };

  // Quiz inverso
  const answerQI = (i: number) => {
    if (quizInvRevealed) return;
    setQuizInvRevealed(true);
    setQuizInvSel(i);
    if (i === quizItems[quizInvIdx].correct) setQuizInvScore((prev) => prev + 1);
  };
  const nextQI = () => {
    if (quizInvIdx + 1 >= quizItems.length) {
      const finalEarned = quizInvScore * 15;
      if (finalEarned > 0) addXP(finalEarned);
      setQuizInvDone(true);
    } else {
      setQuizInvIdx((prev) => prev + 1);
      setQuizInvRevealed(false);
      setQuizInvSel(null);
    }
  };

  // Módulo 17
  const wildIngredients = [
    { key: 'instr', label: 'Una instrucción (Escribe, Crea, Actúa como…)', detect: detectInstr },
    { key: 'tema', label: 'Un personaje o tema', detect: detectTema },
    { key: 'tono', label: 'Un tono o estilo', detect: detectTono },
    { key: 'formato', label: 'Un formato o extensión', detect: detectFormato },
  ];
  const wildDetected = (key: string) => {
    const ing = wildIngredients.find((x) => x.key === key);
    return ing ? ing.detect(wildText) : false;
  };
  const wildRealIngredients = wildIngredients.filter((x) => x.detect(wildText)).length;
  const wildValid =
    detectInstr(wildText) && wildText.trim().length >= 15 && wildRealIngredients >= 2;
  const toggleWildCheck = (key: string) => {
    setWildChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  useEffect(() => {
    if (wildValid && !wildAwarded) {
      addXP(10);
      setWildAwarded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wildValid]);

  // ============ RENDERS ============
  const renderIntro = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#d1fae5' }]}>
        <Text style={[styles.tagText, { color: '#065f46' }]}>N9 · 18 módulos</Text>
      </View>
      <View style={[styles.iconCircle, { backgroundColor: '#e9d5ff' }]}>
        <Text style={{ fontSize: 34 }}>✨</Text>
      </View>
      <Text style={styles.title}>Prompts Creativos</Text>
      <Text style={styles.subtitle}>
        Ya sabes cómo funciona la IA por dentro. Ahora la usas para crear: historias, personajes,
        canciones, juegos, mundos enteros.
      </Text>
      <View style={[styles.card, { backgroundColor: '#faf5ff', borderColor: '#e9d5ff' }]}>
        <Text style={styles.cardTitle}>🎯 Qué vas a aprender</Text>
        <Text style={styles.cardText}>
          Cómo los adjetivos y el tono cambian todo · Técnica del "y de repente" · Personajes con
          chips · Comparar estilos narrativos · Sprint de 3 prompts creativos
        </Text>
      </View>
      <View style={[styles.card, { backgroundColor: '#f0f9ff', borderColor: '#bae6fd' }]}>
        <Text style={styles.cardTitle}>💡 La idea central</Text>
        <Text style={styles.cardText}>
          La IA es un co-autor. Tú pones la visión y la dirección — ella construye.{' '}
          <Bold>El prompt creativo es el guión del director.</Bold>
        </Text>
      </View>
      <Hl variant="purple">
        <Bold>Un prompt bien escrito no describe lo que quieres.</Bold> Crea las condiciones para que
        la IA lo descubra contigo.
      </Hl>
    </View>
  );

  const renderThreeWords = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#faf5ff' }]}>
        <Text style={[styles.tagText, { color: '#7e22ce' }]}>📖 Módulo 1 · Builder</Text>
      </View>
      <Text style={styles.title}>El prompt de 3 palabras</Text>
      <Text style={styles.subtitle}>
        3 palabras → prompt narrativo completo → historia. Así de poderoso es el contexto.
      </Text>
      <View style={styles.compareWrap}>
        <View style={[styles.comparePanel, { backgroundColor: '#fff7ed', borderColor: '#fed7aa' }]}>
          <Text style={[styles.compareLabel, { color: '#c2410c' }]}>Solo 3 palabras</Text>
          <Text style={styles.compareMono}>robot · lluvia · espejo</Text>
        </View>
        <View style={[styles.comparePanel, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
          <Text style={[styles.compareLabel, { color: '#065f46' }]}>Prompt expandido</Text>
          <Text style={styles.compareResp}>
            Escribe el primer párrafo de una historia donde un robot descubre su propio reflejo bajo
            la lluvia por primera vez. Tono: contemplativo. Máximo 80 palabras.
          </Text>
        </View>
      </View>
      <Hl variant="purple">
        <Bold>El truco:</Bold> Toma tus 3 palabras → añade Quién + Qué descubre/hace + Tono +
        Extensión. En 30 segundos tienes un prompt narrativo completo.
      </Hl>
      <BuilderLabel>Elige tus 3 palabras</BuilderLabel>
      <TextInput
        style={styles.input}
        placeholder="Palabra 1 (personaje o lugar)"
        placeholderTextColor="#b8bcc0"
        value={w1}
        onChangeText={(v) => {
          setW1(v);
          if (!wordsBuilt && w2.trim().length >= 2 && w3.trim().length >= 2 && v.trim().length >= 2) {
            addXP(5);
            setWordsBuilt(true);
          }
        }}
      />
      <TextInput
        style={styles.input}
        placeholder="Palabra 2 (objeto o elemento)"
        placeholderTextColor="#b8bcc0"
        value={w2}
        onChangeText={(v) => {
          setW2(v);
          if (!wordsBuilt && w1.trim().length >= 2 && w3.trim().length >= 2 && v.trim().length >= 2) {
            addXP(5);
            setWordsBuilt(true);
          }
        }}
      />
      <TextInput
        style={styles.input}
        placeholder="Palabra 3 (emoción o acción)"
        placeholderTextColor="#b8bcc0"
        value={w3}
        onChangeText={(v) => {
          setW3(v);
          if (!wordsBuilt && w1.trim().length >= 2 && w2.trim().length >= 2 && v.trim().length >= 2) {
            addXP(5);
            setWordsBuilt(true);
          }
        }}
      />
      {threeWordsOk && (
        <View style={[styles.card, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', marginTop: 10 }]}>
          <Text style={{ fontSize: 12, color: '#065f46', lineHeight: 18 }}>
            Escribe el inicio de una historia donde {w1} encuentra {w2} en un momento de {w3}. Tono:
            evocador. Máximo 100 palabras.
          </Text>
        </View>
      )}
    </View>
  );

  const renderGenreMatching = () => {
    const genreOpts = ['misterio', 'comedia', 'aventura', 'terror'];
    return (
      <View>
        <View style={[styles.tag, { backgroundColor: '#eef2ff' }]}>
          <Text style={[styles.tagText, { color: '#3730a3' }]}>🎭 Módulo 2 · Matching</Text>
        </View>
        <Text style={styles.title}>Cambia el género</Text>
        <Text style={styles.subtitle}>
          Mismo tema, géneros distintos. Elige en cada lista el género que corresponde a la
          descripción.
        </Text>
        <View style={[styles.card, { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }]}>
          <Text style={{ fontWeight: '700', fontSize: 12, color: '#0f172a' }}>📌 Tema base</Text>
          <Text style={{ fontStyle: 'italic', fontSize: 12, color: '#334155' }}>{genreItem.theme}</Text>
        </View>
        {shuffledGenres.map((k, i) => {
          const sel = genreAnswers[i];
          const correct = genreChecked && sel === k;
          const wrong = genreChecked && sel !== k;
          return (
            <View key={i} style={{ marginBottom: 8, zIndex: openGenreDropdown === i ? 20 : 1 }}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                <View style={styles.genreDesc}>
                  <Text style={{ fontSize: 12, color: '#334155', lineHeight: 17 }}>
                    {genreItem.genres[k]}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.genreSelect,
                    sel && !genreChecked && { borderColor: '#8b5cf6', backgroundColor: '#f5f3ff' },
                    correct && { borderColor: '#10b981', backgroundColor: '#dcfce7' },
                    wrong && { borderColor: '#ef4444', backgroundColor: '#fff1f2' },
                  ]}
                  onPress={() => setOpenGenreDropdown(openGenreDropdown === i ? null : i)}
                  disabled={genreChecked}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: correct ? '#166534' : wrong ? '#991b1b' : sel ? '#5b21b6' : '#94a3b8',
                    }}
                  >
                    {sel || '— género'}
                  </Text>
                  {!genreChecked && <Text style={{ fontSize: 10, color: '#94a3b8' }}>▾</Text>}
                </TouchableOpacity>
              </View>
              {openGenreDropdown === i && !genreChecked && (
                <View style={styles.dropdownList}>
                  {genreOpts.map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={styles.dropdownItem}
                      onPress={() => {
                        selectGenre(i, opt);
                        setOpenGenreDropdown(null);
                      }}
                    >
                      <Text style={{ fontSize: 12, color: '#334155', fontWeight: '600' }}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {genreChecked && (
                <Text style={{ fontSize: 11, marginTop: 3, color: correct ? '#166534' : '#991b1b', lineHeight: 15 }}>
                  {correct
                    ? `✅ ${k} — ${GENRE_REASONS[k]}.`
                    : `❌ Elegiste "${sel}". Era ${k} — ${GENRE_REASONS[k]}.`}
                </Text>
              )}
            </View>
          );
        })}
        {genreChecked && (
          <FeedbackBar ok={genreScore >= 3}>
            {(genreScore >= 3 ? '✅ ' : '⚠️ ') +
              `${genreScore}/${shuffledGenres.length} correctas. +${genreScore * 8} XP.\n`}
            Cada género transforma el mismo tema en una historia completamente diferente — ese es el
            poder del prompting creativo.
          </FeedbackBar>
        )}
      </View>
    );
  };

  const renderFillBlank = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#f5f3ff' }]}>
        <Text style={[styles.tagText, { color: '#5b21b6' }]}>🌀 Módulo 3 · Fill-in-blank</Text>
      </View>
      <Text style={styles.title}>El truco del "y de repente..."</Text>
      <Text style={styles.subtitle}>
        Un buen giro narrativo convierte una escena plana en una historia que engancha.
      </Text>
      <Text style={styles.instruction}>
        👇 Completa el espacio en blanco con la opción que crea el mejor giro narrativo.
      </Text>
      <View style={[styles.card, { backgroundColor: '#faf5ff', borderColor: '#e9d5ff' }]}>
        <Text style={{ fontSize: 13, fontStyle: 'italic', color: '#334155', lineHeight: 20 }}>
          {fillItem.prompt}{' '}
        </Text>
        <View style={styles.blankBox}>
          <Text
            style={[
              styles.blankText,
              fillAnswered && {
                color: fillSel === fillItem.correct ? '#166534' : '#991b1b',
                fontStyle: 'italic',
              },
            ]}
          >
            {fillAnswered && fillSel !== null ? fillItem.options[fillSel] : '________________________'}
          </Text>
        </View>
      </View>
      {fillItem.options.map((opt, i) => {
        const okColor = fillAnswered && i === fillItem.correct;
        const badColor = fillAnswered && fillSel === i && i !== fillItem.correct;
        return (
          <TouchableOpacity
            key={i}
            style={[styles.optionBtn, okColor && styles.optOk, badColor && styles.optBad]}
            onPress={() => answerFill(i)}
            disabled={fillAnswered}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: okColor ? '#166534' : badColor ? '#991b1b' : '#334155',
              }}
            >
              {opt}
            </Text>
          </TouchableOpacity>
        );
      })}
      {fillAnswered && (
        <FeedbackBar ok={fillSel === fillItem.correct}>
          {(fillSel === fillItem.correct ? '✅ ' : '❌ ') + fillItem.explain}
        </FeedbackBar>
      )}
    </View>
  );

  const renderTonos = () => {
    const t = TONOS[0];
    return (
      <View>
        <View style={[styles.tag, { backgroundColor: '#dcfce7' }]}>
          <Text style={[styles.tagText, { color: '#166534' }]}>🎨 Módulo 4 · Escenarios</Text>
        </View>
        <Text style={styles.title}>Modifica el tono</Text>
        <Text style={styles.subtitle}>El tono lo cambia todo. Mismo escenario, tres versiones.</Text>
        <View style={[styles.card, { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }]}>
          <Text style={{ fontWeight: '700', fontSize: 12, color: '#0f172a' }}>📌 Escenario base</Text>
          <Text style={{ fontStyle: 'italic', fontSize: 12, color: '#334155' }}>{t.base}</Text>
        </View>
        <View style={[styles.card, { backgroundColor: '#faf5ff', borderColor: '#e9d5ff' }]}>
          <Text style={styles.cardTitle}>🌀 Más raro</Text>
          <Text style={{ fontStyle: 'italic', fontSize: 12, color: '#334155' }}>{t.versiones.raro}</Text>
        </View>
        <View style={[styles.card, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
          <Text style={styles.cardTitle}>😄 Más divertido</Text>
          <Text style={{ fontStyle: 'italic', fontSize: 12, color: '#334155' }}>{t.versiones.divertido}</Text>
        </View>
        <View style={[styles.card, { backgroundColor: '#f0f9ff', borderColor: '#bae6fd' }]}>
          <Text style={styles.cardTitle}>🎯 Más serio</Text>
          <Text style={{ fontStyle: 'italic', fontSize: 12, color: '#334155' }}>{t.versiones.serio}</Text>
        </View>
        <Hl variant="purple">
          <Bold>Cómo pedirle el tono a la IA:</Bold>
          {'\n'}Añade al final del prompt: "Tono: absurdo y surrealista" / "Tono: cómico exagerado" /
          "Tono: contemplativo y serio"
        </Hl>
      </View>
    );
  };

  const renderCharBuilder = () => {
    const esp = charEspecie !== null ? CHAR_ESPECIES[charEspecie] : null;
    const ok = esp !== null && charPoder !== null && charMiedo !== null;
    return (
      <View>
        <View style={[styles.tag, { backgroundColor: '#eff6ff' }]}>
          <Text style={[styles.tagText, { color: '#1e40af' }]}>🦸 Módulo 5 · Misión creativa</Text>
        </View>
        <Text style={styles.title}>Crea tu compañero de aventura</Text>
        <Text style={styles.subtitle}>
          Elige 3 cosas tocando las tarjetas. Cada elección se convierte en una instrucción para la
          IA. Al final, mira lo que crea con tus decisiones.
        </Text>

        <BuilderLabel>Especie</BuilderLabel>
        <View style={styles.chipRow}>
          {CHAR_ESPECIES.map((e, i) => (
            <TouchableOpacity
              key={e.chip}
              style={[styles.choiceChip, charEspecie === i && styles.choiceChipSel]}
              onPress={() => {
                setCharEspecie(i);
                maybeAwardChar(i, charPoder, charMiedo);
              }}
            >
              <Text style={[styles.choiceChipText, charEspecie === i && styles.choiceChipTextSel]}>{e.chip}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <BuilderLabel>Superpoder</BuilderLabel>
        <View style={styles.chipRow}>
          {CHAR_PODERES.map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.choiceChip, charPoder === p && styles.choiceChipSel]}
              onPress={() => {
                setCharPoder(p);
                maybeAwardChar(charEspecie, p, charMiedo);
              }}
            >
              <Text style={[styles.choiceChipText, charPoder === p && styles.choiceChipTextSel]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <BuilderLabel>Miedo secreto</BuilderLabel>
        <View style={styles.chipRow}>
          {CHAR_MIEDOS.map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.choiceChip, charMiedo === m && styles.choiceChipSel]}
              onPress={() => {
                setCharMiedo(m);
                maybeAwardChar(charEspecie, charPoder, m);
              }}
            >
              <Text style={[styles.choiceChipText, charMiedo === m && styles.choiceChipTextSel]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {ok && esp && (
          <>
            <View style={[styles.card, { backgroundColor: '#faf5ff', borderColor: '#e9d5ff', marginTop: 6 }]}>
              <Text style={[styles.builderLabel, { color: '#7e22ce', marginTop: 0 }]}>Tu prompt</Text>
              <Text style={{ fontSize: 12, color: '#334155', lineHeight: 18 }}>
                Crea a {esp.art} que puede {charPoder} pero le teme a {charMiedo}. Dale un nombre y una
                frase icónica.
              </Text>
            </View>
            <View style={[styles.card, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
              <Text style={{ fontSize: 12, color: '#065f46', marginBottom: 4 }}>
                🤖 <Bold>La IA responde:</Bold>
              </Text>
              <Text style={{ fontSize: 12, color: '#334155', fontStyle: 'italic', lineHeight: 18 }}>
                Conoce a {esp.name}, {esp.art} capaz de {charPoder}. Pero guarda un secreto: le teme a{' '}
                {charMiedo}. En su primera aventura tendrá que enfrentar justo eso para proteger a
                quienes ama.
              </Text>
            </View>
            <Hl variant="purple">
              <Bold>¿Ves?</Bold> Cambia una sola elección y la IA crea un personaje distinto. Tus
              decisiones SON el prompt.
            </Hl>
          </>
        )}
      </View>
    );
  };

  const renderSongBuilder = () => {
    const ok = sgGenre.trim().length >= 3 && sgTema.trim().length >= 5 && sgMood.trim().length >= 3;
    const checkSong = (g: string, t: string, m: string) => {
      if (g.trim().length >= 3 && t.trim().length >= 5 && m.trim().length >= 3 && !songBuilt) {
        addXP(10);
        setSongBuilt(true);
      }
    };
    return (
      <View>
        <View style={[styles.tag, { backgroundColor: '#eff6ff' }]}>
          <Text style={[styles.tagText, { color: '#1e40af' }]}>🎵 Módulo 6 · Builder</Text>
        </View>
        <Text style={styles.title}>Prompt para una canción</Text>
        <Text style={styles.subtitle}>
          Género + tema + mood + estrofa de ejemplo = la IA escribe la canción correcta.
        </Text>
        <BuilderLabel>Género musical</BuilderLabel>
        <TextInput
          style={styles.input}
          placeholder="Ej: balada pop latinoamericana, trap melódico, cumbia electrónica..."
          placeholderTextColor="#b8bcc0"
          value={sgGenre}
          onChangeText={(v) => {
            setSgGenre(v);
            checkSong(v, sgTema, sgMood);
          }}
        />
        <BuilderLabel>Tema de la canción</BuilderLabel>
        <TextInput
          style={styles.input}
          placeholder="Ej: despedirse de una etapa, el primer trabajo, una amistad que se fue..."
          placeholderTextColor="#b8bcc0"
          value={sgTema}
          onChangeText={(v) => {
            setSgTema(v);
            checkSong(sgGenre, v, sgMood);
          }}
        />
        <BuilderLabel>Mood / emoción dominante</BuilderLabel>
        <TextInput
          style={styles.input}
          placeholder="Ej: melancólico pero esperanzador, rabioso pero liberador..."
          placeholderTextColor="#b8bcc0"
          value={sgMood}
          onChangeText={(v) => {
            setSgMood(v);
            checkSong(sgGenre, sgTema, v);
          }}
        />
        {ok && (
          <View style={[styles.card, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', marginTop: 10 }]}>
            <Text style={{ fontSize: 12, color: '#065f46', lineHeight: 18 }}>
              Actúa como compositor de {sgGenre}. Escribe la letra de una canción sobre {sgTema}. Mood:{' '}
              {sgMood}. Incluye: intro, dos estrofas y un coro pegajoso. El lenguaje debe sentirse
              auténtico para alguien de 15 años.
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderMissing = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#faf5ff' }]}>
        <Text style={[styles.tagText, { color: '#7e22ce' }]}>✍️ Módulo 7 · Prompt-detective</Text>
      </View>
      <Text style={styles.title}>¿Qué le falta a este prompt?</Text>
      <Text style={styles.subtitle}>
        Un buen prompt no solo pide algo — le da a la IA emoción, detalle y estilo. Lee este prompt y
        detecta qué le falta.
      </Text>
      <View style={[styles.card, { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }]}>
        <Text style={{ fontSize: 10, fontWeight: '700', color: '#64748b', marginBottom: 4 }}>PROMPT DÉBIL</Text>
        <Text style={styles.compareMono}>{missingQ ? MISSING_PROMPT.weak : ''}</Text>
      </View>
      <Text style={{ fontWeight: '700', fontSize: 13, color: '#0f172a', marginBottom: 8 }}>
        {missingQ.question}
      </Text>
      {missingQ.opts.map((opt, i) => {
        const okColor = missingAnswered && i === missingQ.correct;
        const badColor = missingAnswered && missingSel === i && i !== missingQ.correct;
        return (
          <TouchableOpacity
            key={i}
            style={[styles.optionBtn, okColor && styles.optOk, badColor && styles.optBad]}
            onPress={() => answerMissing(i)}
            disabled={missingAnswered}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: okColor ? '#166534' : badColor ? '#991b1b' : '#334155',
              }}
            >
              {opt}
            </Text>
          </TouchableOpacity>
        );
      })}
      {missingAnswered && (
        <>
          <FeedbackBar ok={missingSel === missingQ.correct}>
            {(missingSel === missingQ.correct ? '✅ ' : '❌ ') + missingQ.explain}
          </FeedbackBar>
          <View style={[styles.card, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', marginTop: 8 }]}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#166534', marginBottom: 4 }}>PROMPT MEJORADO</Text>
            <Text style={{ fontSize: 12, color: '#334155', lineHeight: 18 }}>{MISSING_PROMPT.better}</Text>
          </View>
        </>
      )}
    </View>
  );

  const renderDirector = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fdf4ff' }]}>
        <Text style={[styles.tagText, { color: '#7e22ce' }]}>🎬 Módulo 8 · Casos reales</Text>
      </View>
      <Text style={styles.title}>La IA como director de cine</Text>
      <Text style={styles.subtitle}>
        Un director no dice "haz algo bonito" — da instrucciones técnicas de atmósfera. Tú haces lo
        mismo con la IA.
      </Text>
      <View style={[styles.card, { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }]}>
        <Text style={styles.cardTitle}>🎥 Prompt de escena básico</Text>
        <Text style={{ fontStyle: 'italic', fontSize: 12, color: '#334155' }}>
          "Describe una escena de persecución."
        </Text>
      </View>
      <View style={[styles.card, { backgroundColor: '#faf5ff', borderColor: '#e9d5ff' }]}>
        <Text style={styles.cardTitle}>🎬 Prompt de director</Text>
        <Text style={{ fontStyle: 'italic', fontSize: 12, color: '#334155', lineHeight: 19 }}>
          "Describe una persecución nocturna en una ciudad lluviosa. Ángulo: cámara baja, casi al
          suelo. Luz: solo faroles amarillos que parpadean. Emoción dominante: desesperación a punto
          de convertirse en rabia. Sin música — solo el sonido de zapatos y lluvia."
        </Text>
      </View>
      <Hl variant="purple">
        <Bold>Los 4 ingredientes de una escena visual:</Bold>
        {'\n'}📍 Ángulo de cámara · 💡 Luz / paleta · 😤 Emoción dominante · 🔊 Sonido / silencio
      </Hl>
      <View style={[styles.card, { backgroundColor: '#f0f9ff', borderColor: '#bae6fd' }]}>
        <Text style={styles.cardTitle}>🌍 Caso real</Text>
        <Text style={styles.cardText}>
          Escritores de guiones en Hollywood ya usan IA para generar descripciones de escenas con
          este nivel de detalle. No reemplaza al escritor — acelera el borrador para que el creador se
          enfoque en la revisión.
        </Text>
      </View>
    </View>
  );

  const renderGameBuilder = () => {
    const ok =
      gmTipo.trim().length >= 5 && gmPers.trim().length >= 5 && gmObj.trim().length >= 5 && gmMec.trim().length >= 5;
    const checkGame = (a: string, b: string, c: string, d: string) => {
      if (a.trim().length >= 5 && b.trim().length >= 5 && c.trim().length >= 5 && d.trim().length >= 5 && !gameBuilt) {
        addXP(10);
        setGameBuilt(true);
      }
    };
    return (
      <View>
        <View style={[styles.tag, { backgroundColor: '#eff6ff' }]}>
          <Text style={[styles.tagText, { color: '#1e40af' }]}>🎮 Módulo 9 · Builder</Text>
        </View>
        <Text style={styles.title}>Prompt para inventar un juego</Text>
        <Text style={styles.subtitle}>Define las 4 partes del juego y construimos el prompt completo.</Text>
        <BuilderLabel>Tipo de juego</BuilderLabel>
        <TextInput
          style={styles.input}
          placeholder="Ej: juego de cartas, videojuego de plataformas, juego de mesa cooperativo..."
          placeholderTextColor="#b8bcc0"
          value={gmTipo}
          onChangeText={(v) => {
            setGmTipo(v);
            checkGame(v, gmPers, gmObj, gmMec);
          }}
        />
        <BuilderLabel>Personajes o elementos principales</BuilderLabel>
        <TextInput
          style={styles.input}
          placeholder="Ej: 4 elementos de la naturaleza con personalidades opuestas..."
          placeholderTextColor="#b8bcc0"
          value={gmPers}
          onChangeText={(v) => {
            setGmPers(v);
            checkGame(gmTipo, v, gmObj, gmMec);
          }}
        />
        <BuilderLabel>Objetivo del juego</BuilderLabel>
        <TextInput
          style={styles.input}
          placeholder="Ej: reconstruir el mundo antes de que el caos lo consuma..."
          placeholderTextColor="#b8bcc0"
          value={gmObj}
          onChangeText={(v) => {
            setGmObj(v);
            checkGame(gmTipo, gmPers, v, gmMec);
          }}
        />
        <BuilderLabel>Mecánica especial</BuilderLabel>
        <TextInput
          style={styles.input}
          placeholder="Ej: cada jugador tiene habilidades que solo funcionan si cooperan..."
          placeholderTextColor="#b8bcc0"
          value={gmMec}
          onChangeText={(v) => {
            setGmMec(v);
            checkGame(gmTipo, gmPers, gmObj, v);
          }}
        />
        {ok && (
          <View style={[styles.card, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', marginTop: 10 }]}>
            <Text style={{ fontSize: 12, color: '#065f46', lineHeight: 18 }}>
              Diseña las reglas de un {gmTipo}. Los personajes son: {gmPers}. El objetivo es: {gmObj}. La
              mecánica especial que lo hace único: {gmMec}. Entrega: nombre del juego, reglas en 5 pasos,
              y cómo se gana.
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderCollab = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#f0fdfa' }]}>
        <Text style={[styles.tagText, { color: '#0f766e' }]}>📚 Módulo 10 · Colaborativo</Text>
      </View>
      <Text style={styles.title}>Historia colaborativa</Text>
      <Text style={styles.subtitle}>
        La IA escribió el inicio. Tú escribes el siguiente fragmento. Así funciona la co-creación.
      </Text>
      <View style={[styles.card, { backgroundColor: '#faf5ff', borderColor: '#e9d5ff' }]}>
        <Text style={{ fontStyle: 'italic', fontSize: 13, lineHeight: 20, color: '#334155' }}>{collabStory.inicio}</Text>
      </View>
      <BuilderLabel>Tu continuación (mínimo 30 caracteres)</BuilderLabel>
      <TextInput
        style={styles.textArea}
        multiline
        textAlignVertical="top"
        placeholder={collabStory.placeholder}
        placeholderTextColor="#b8bcc0"
        value={storyCollab}
        onChangeText={(v) => {
          setStoryCollab(v);
          if (v.trim().length >= 30 && !collabDone) {
            addXP(8);
            setCollabDone(true);
          }
        }}
      />
      <Text style={{ fontSize: 11, color: '#94a3b8', textAlign: 'right' }}>
        {storyCollab.length} / mínimo 30 caracteres
      </Text>
    </View>
  );

  const renderStyleCompare = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#faf5ff' }]}>
        <Text style={[styles.tagText, { color: '#7e22ce' }]}>🎨 Módulo 11 · Prompt-compare</Text>
      </View>
      <Text style={styles.title}>El mismo prompt en 3 estilos</Text>
      <Text style={styles.subtitle}>Mismo tema, misma escena — tres registros narrativos distintos.</Text>
      <View style={[styles.card, { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }]}>
        <Text style={{ fontWeight: '700', fontSize: 12, color: '#0f172a' }}>📌 Tema</Text>
        <Text style={{ fontStyle: 'italic', fontSize: 12, color: '#334155' }}>{STYLE_COMPARE.tema}</Text>
      </View>
      <View style={[styles.card, { backgroundColor: '#f0f9ff', borderColor: '#bae6fd' }]}>
        <Text style={styles.cardTitle}>📋 Realista</Text>
        <Text style={{ fontStyle: 'italic', fontSize: 12, color: '#334155' }}>{STYLE_COMPARE.realista}</Text>
      </View>
      <View style={[styles.card, { backgroundColor: '#faf5ff', borderColor: '#e9d5ff' }]}>
        <Text style={styles.cardTitle}>🌀 Surrealista</Text>
        <Text style={{ fontStyle: 'italic', fontSize: 12, color: '#334155' }}>{STYLE_COMPARE.surrealista}</Text>
      </View>
      <View style={[styles.card, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
        <Text style={styles.cardTitle}>✨ Poético</Text>
        <Text style={{ fontStyle: 'italic', fontSize: 12, color: '#334155' }}>{STYLE_COMPARE.poetico}</Text>
      </View>
      <Text style={{ fontWeight: '700', fontSize: 13, color: '#0f172a', marginBottom: 8 }}>{styleQ.question}</Text>
      {styleQ.opts.map((opt, i) => {
        const okColor = styleAnswered && i === styleQ.correct;
        const badColor = styleAnswered && styleSel === i && i !== styleQ.correct;
        return (
          <TouchableOpacity
            key={i}
            style={[styles.optionBtn, okColor && styles.optOk, badColor && styles.optBad]}
            onPress={() => answerStyle(i)}
            disabled={styleAnswered}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: okColor ? '#166534' : badColor ? '#991b1b' : '#334155',
              }}
            >
              {opt}
            </Text>
          </TouchableOpacity>
        );
      })}
      {styleAnswered && (
        <FeedbackBar ok={styleSel === styleQ.correct}>
          {(styleSel === styleQ.correct ? '✅ ' : '❌ ') + styleQ.explain}
        </FeedbackBar>
      )}
    </View>
  );

  const renderEmociones = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fdf2f8' }]}>
        <Text style={[styles.tagText, { color: '#9d174d' }]}>💜 Módulo 12 · Word-builder</Text>
      </View>
      <Text style={styles.title}>Emociones en el prompt</Text>
      <Text style={styles.subtitle}>Selecciona hasta 3 adjetivos emocionales y construimos un prompt de poesía.</Text>
      <View style={styles.chipRow}>
        {EMO_OPTIONS.map((emo) => (
          <TouchableOpacity
            key={emo}
            style={[styles.choiceChip, emoTags.includes(emo) && styles.choiceChipSel]}
            onPress={() => toggleEmo(emo)}
          >
            <Text style={[styles.choiceChipText, emoTags.includes(emo) && styles.choiceChipTextSel]}>{emo}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {emoTags.length > 0 && (
        <View style={[styles.card, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', marginTop: 6 }]}>
          <Text style={{ fontSize: 12, color: '#065f46', lineHeight: 18 }}>
            Escribe un poema sobre el paso del tiempo con tono {emoTags.join(', ')}. Que cada estrofa
            capture una emoción diferente.
          </Text>
        </View>
      )}
    </View>
  );

  const renderMemes = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fdf4ff' }]}>
        <Text style={[styles.tagText, { color: '#7e22ce' }]}>😂 Módulo 13 · Casos reales</Text>
      </View>
      <Text style={styles.title}>Crea un meme con palabras</Text>
      <Text style={styles.subtitle}>
        Los memes también son prompts. Texto + imagen descrita + tono = instrucción completa.
      </Text>
      <View style={[styles.card, { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }]}>
        <Text style={styles.cardTitle}>💡 Fórmula del prompt-meme</Text>
        <Text style={styles.cardText}>
          Genera un meme sobre [tema]. Imagen: [describe la imagen]. Texto superior: [frase 1]. Texto
          inferior: [frase 2]. Tono: [irónico / absurdo / motivacional]
        </Text>
      </View>
      <View style={[styles.card, { backgroundColor: '#faf5ff', borderColor: '#e9d5ff' }]}>
        <Text style={styles.cardTitle}>Ejemplo 1 — Meme escolar</Text>
        <Text style={{ fontSize: 11, fontStyle: 'italic', color: '#334155', lineHeight: 17 }}>
          Imagen: un perro sentado tranquilamente rodeado de llamas.{'\n'}Texto superior: "Yo cuando
          tengo 3 parciales mañana"{'\n'}Texto inferior: "Pero primero termino este video"{'\n'}Tono:
          absurdo y reconocible.
        </Text>
      </View>
      <View style={[styles.card, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
        <Text style={styles.cardTitle}>Ejemplo 2 — Meme de IA</Text>
        <Text style={{ fontSize: 11, fontStyle: 'italic', color: '#334155', lineHeight: 17 }}>
          Imagen: un botón rojo gigante con la etiqueta "Prompt genérico".{'\n'}Texto superior: "Saber
          que hay una forma mejor"{'\n'}Texto inferior: "Pero escribir igual que siempre"{'\n'}Tono:
          autocrítico y divertido.
        </Text>
      </View>
      <Hl variant="amber">
        <Bold>Por qué esto es prompting:</Bold> Describes una imagen que no existe, defines qué debe
        decir y con qué tono. Le estás dando a la IA las instrucciones exactas de un director creativo.
      </Hl>
    </View>
  );

  const renderSprint = () => {
    const reto = SPRINT_ROUNDS[sprintReto];
    return (
      <View>
        <View style={[styles.tag, { backgroundColor: '#fef3c7' }]}>
          <Text style={[styles.tagText, { color: '#92400e' }]}>⚡ Módulo 14 · Sprint creativo</Text>
        </View>
        <Text style={styles.title}>Sprint: completa 3 prompts</Text>
        <Text style={styles.subtitle}>
          Contra el reloj, rellena cada hueco tocando la mejor opción. Cada prompt completo suma XP.
        </Text>
        <Text style={{ fontSize: 30, fontWeight: 'bold', textAlign: 'center', color: '#7c3aed', marginVertical: 6 }}>
          {Math.floor(sprintSec / 60)}:{String(sprintSec % 60).padStart(2, '0')}
        </Text>
        <View style={{ height: 8, backgroundColor: '#e2e8f0', borderRadius: 4, overflow: 'hidden', marginBottom: 12 }}>
          <View style={{ height: '100%', width: `${(sprintSec / 120) * 100}%`, backgroundColor: '#7c3aed', borderRadius: 4 }} />
        </View>

        {sprintDone ? (
          <View style={{ padding: 14, backgroundColor: '#dcfce7', borderRadius: 12, borderWidth: 1, borderColor: '#86efac' }}>
            <Text style={{ fontWeight: 'bold', color: '#166534', textAlign: 'center', fontSize: 15 }}>
              🏁 {sprintScore}/3 prompts completados. +{sprintScore * 10} XP
            </Text>
            <Text style={{ fontSize: 12, color: '#166534', textAlign: 'center', marginTop: 6, lineHeight: 17 }}>
              Cada uno de esos prompts sería una instrucción real para una IA. Cuanto más los
              practicas, más rápido los construyes.
            </Text>
          </View>
        ) : !sprintStarted ? (
          <View>
            <View style={[styles.card, { backgroundColor: '#f5f3ff', borderColor: '#c4b5fd' }]}>
              <Text style={{ fontSize: 13, color: '#5b21b6', textAlign: 'center', lineHeight: 18 }}>
                Vas a completar 3 plantillas de prompt tocando la mejor opción en cada hueco. ¡Listo!
              </Text>
            </View>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#7c3aed', marginTop: 8 }]} onPress={startSprint}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>▶ Iniciar sprint</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#7c3aed', marginBottom: 8 }}>{reto.titulo}</Text>
            <View style={[styles.card, { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }]}>
              <Text style={{ fontSize: 13, color: '#334155', lineHeight: 24 }}>
                {reto.parts.map((part, i) => (
                  <Text key={i}>
                    {part}
                    {i < reto.blanks.length &&
                      (sprintFills[i] !== undefined ? (
                        <Text style={{ fontWeight: '700', color: '#7c3aed' }}>{reto.blanks[i][sprintFills[i]]}</Text>
                      ) : (
                        <Text style={{ color: '#c4b5fd', fontWeight: '700' }}>______</Text>
                      ))}
                  </Text>
                ))}
              </Text>
            </View>
            {reto.blanks.map((opts, bi) => (
              <View key={bi} style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#7e22ce', marginBottom: 4 }}>{reto.labels[bi]}</Text>
                <View style={styles.chipRow}>
                  {opts.map((opt, oi) => (
                    <TouchableOpacity
                      key={oi}
                      style={[styles.choiceChip, sprintFills[bi] === oi && styles.choiceChipSel]}
                      onPress={() => pickSprintBlank(bi, oi)}
                    >
                      <Text style={[styles.choiceChipText, sprintFills[bi] === oi && styles.choiceChipTextSel]}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: currentRetoFilled ? '#7c3aed' : '#e2e8f0', marginTop: 4 }]}
              onPress={completeReto}
              disabled={!currentRetoFilled}
            >
              <Text style={{ color: currentRetoFilled ? '#fff' : '#94a3b8', fontWeight: 'bold', fontSize: 14 }}>
                {sprintReto + 1 >= SPRINT_ROUNDS.length ? '✓ Terminar sprint' : '✓ Siguiente reto →'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderEtica = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fdf4ff' }]}>
        <Text style={[styles.tagText, { color: '#7e22ce' }]}>⚖️ Módulo 15 · Reflexión ética</Text>
      </View>
      <Text style={styles.title}>¿Cuándo NO usar IA para crear?</Text>
      <Text style={styles.subtitle}>La IA es un co-autor poderoso. Pero hay momentos donde usarla resta, no suma.</Text>
      <View style={[styles.card, { backgroundColor: '#fff1f2', borderColor: '#fecdd3' }]}>
        <Text style={styles.cardTitle}>🚫 El límite entre apoyarse y reemplazarse</Text>
        <Text style={[styles.cardText, { lineHeight: 20 }]}>
          ❌ <Bold>Trampa académica:</Bold> Entregar trabajo de la IA como tuyo sin contribución real.
          {'\n\n'}❌ <Bold>Perder tu voz:</Bold> Si todo lo que "creas" viene de la IA, ¿qué queda de ti
          como creador?{'\n\n'}❌ <Bold>Saltarse el aprendizaje:</Bold> Escribir mal y mejorar es parte
          del proceso. La IA no puede sentir eso por ti.{'\n\n'}✅ <Bold>La regla:</Bold> Usa la IA para
          amplificar tu visión, no para reemplazarla.
        </Text>
      </View>
      <Hl variant="purple">
        <Bold>La pregunta clave:</Bold> ¿Este prompt está llevando mi idea más lejos — o está creando
        en mi lugar?
      </Hl>
    </View>
  );

  const renderQuizInv = () => {
    if (quizInvDone) {
      const perfect = quizInvScore === quizItems.length;
      return (
        <View>
          <View style={[styles.tag, { backgroundColor: '#faf5ff' }]}>
            <Text style={[styles.tagText, { color: '#7e22ce' }]}>🏁 Quiz inverso — resultado</Text>
          </View>
          <Text style={[styles.title, { textAlign: 'center' }]}>
            {quizInvScore}/{quizItems.length} correctas 🎯
          </Text>
          <Hl variant="green">
            <Bold>+{quizInvScore * 15} XP.</Bold>{' '}
            {perfect
              ? '¡Lees prompts como un experto!'
              : 'Con práctica, identificar el prompt correcto se vuelve instintivo.'}
          </Hl>
        </View>
      );
    }
    const item = quizItems[quizInvIdx];
    return (
      <View>
        <View style={[styles.tag, { backgroundColor: '#faf5ff' }]}>
          <Text style={[styles.tagText, { color: '#7e22ce' }]}>
            🔍 Módulo 16 · Quiz inverso · {quizInvIdx + 1}/{quizItems.length}
          </Text>
        </View>
        <Text style={styles.title}>¿Cuál prompt generó este resultado?</Text>
        <Text style={styles.subtitle}>Lee el resultado. ¿Cuál prompt lo generó?</Text>
        <View style={[styles.card, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', marginBottom: 10 }]}>
          <Text style={{ fontStyle: 'italic', fontSize: 13, lineHeight: 20, color: '#334155' }}>{item.resultado}</Text>
        </View>
        {item.opts.map((opt, i) => {
          const okColor = quizInvRevealed && i === item.correct;
          const badColor = quizInvRevealed && quizInvSel === i && i !== item.correct;
          return (
            <TouchableOpacity
              key={i}
              style={[styles.optionBtn, okColor && styles.optOk, badColor && styles.optBad]}
              onPress={() => answerQI(i)}
              disabled={quizInvRevealed}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: okColor ? '#166534' : badColor ? '#991b1b' : '#334155',
                }}
              >
                {opt}
              </Text>
            </TouchableOpacity>
          );
        })}
        {quizInvRevealed && (
          <FeedbackBar ok={quizInvSel === item.correct}>
            {(quizInvSel === item.correct ? '✅ ' : '❌ ') + item.explain}
          </FeedbackBar>
        )}
      </View>
    );
  };

  const renderWild = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#faf5ff' }]}>
        <Text style={[styles.tagText, { color: '#7e22ce' }]}>🚀 Módulo 17 · Builder libre</Text>
      </View>
      <Text style={styles.title}>Lo que nunca habrías escrito solo</Text>
      <Text style={styles.subtitle}>El prompt más arriesgado y creativo que puedas imaginar. Sin filtro. Sin miedo.</Text>
      <Hl variant="purple">
        <Bold>Desafío:</Bold> Escribe un prompt para crear algo que te parece imposible, ridículo,
        demasiado raro — o simplemente algo que nunca habrías pensado hacer sin la IA.
      </Hl>
      <BuilderLabel>Tu prompt más arriesgado</BuilderLabel>
      <TextInput
        style={styles.textArea}
        multiline
        textAlignVertical="top"
        placeholder="Ej: Actúa como narrador de documentales de los años 80. Narra mi lunes como si fuera la migración épica de los ñus por el Serengeti..."
        placeholderTextColor="#b8bcc0"
        value={wildText}
        onChangeText={setWildText}
      />
      <Text style={styles.instruction}>Marca los ingredientes que incluiste — el sistema los comprueba en tu texto:</Text>
      {wildIngredients.map((ing) => {
        const checked = !!wildChecklist[ing.key];
        const detected = wildDetected(ing.key);
        return (
          <View key={ing.key}>
            <TouchableOpacity style={styles.checkRow} onPress={() => toggleWildCheck(ing.key)}>
              <Text style={{ fontSize: 15, color: checked ? '#7c3aed' : '#94a3b8' }}>{checked ? '☑' : '☐'}</Text>
              <Text style={{ fontSize: 12, color: '#334155', flex: 1 }}>{ing.label}</Text>
            </TouchableOpacity>
            {checked && (
              <Text style={{ fontSize: 11, marginLeft: 26, marginTop: -2, marginBottom: 4, color: detected ? '#166534' : '#b45309' }}>
                {detected ? '✓ detectado en tu texto' : '🤔 no lo veo aún en tu texto'}
              </Text>
            )}
          </View>
        );
      })}
      {!wildValid && wildText.trim().length > 0 && (
        <FeedbackBar ok={false}>
          {detectInstr(wildText)
            ? 'Casi. Añade al menos un ingrediente más (un tema, un tono o un formato) para que sea un prompt completo.'
            : '⚠️ No detecto una instrucción. Empieza con un verbo como Escribe, Crea o Actúa como...'}
        </FeedbackBar>
      )}
      <TipBox>
        ✅ <Bold>Esta idea queda en tu portafolio IA Explorer.</Bold>
        {'\n'}Los mejores prompts creativos suelen ser los que primero parecen absurdos.
      </TipBox>
    </View>
  );

  const renderReflect = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#f1f5f9' }]}>
        <Text style={[styles.tagText, { color: '#475569' }]}>✨ Módulo 18 · Reflexión</Text>
      </View>
      <Text style={styles.title}>¿La creación es tuya o de la IA?</Text>
      <Text style={styles.subtitle}>Piensa en todo lo que construiste hoy.</Text>
      <TextInput
        style={styles.textArea}
        multiline
        textAlignVertical="top"
        placeholder="Ej: Creo que la creación sigue siendo mía porque yo puse la visión, el tono y la dirección. La IA construyó con mis instrucciones — como un músico que toca la canción que yo compuse..."
        placeholderTextColor="#b8bcc0"
        value={reflectText}
        onChangeText={(v) => {
          setReflectText(v);
          if (v.trim().length >= 50 && !reflectDone) {
            addXP(15);
            setReflectDone(true);
          }
        }}
      />
      <Text style={{ fontSize: 11, color: '#94a3b8', textAlign: 'right' }}>{reflectText.length} / mínimo 50 caracteres</Text>
      <TipBox>
        ✅ <Bold>Esta reflexión queda en tu portafolio IA Explorer.</Bold>
        {'\n'}No hay respuesta correcta. Lo que importa es que la pregunta ya no te parezca obvia.
      </TipBox>
    </View>
  );

  const renderCompletion = () => (
    <View style={{ alignItems: 'center', padding: 20 }}>
      <View style={{ width: 86, height: 86, borderRadius: 24, backgroundColor: '#c4b5fd', justifyContent: 'center', alignItems: 'center', marginBottom: 14 }}>
        <Text style={{ fontSize: 44 }}>🏅</Text>
      </View>
      <Text style={[styles.title, { textAlign: 'center' }]}>¡Nivel 9 completado!</Text>
      <Text style={[styles.subtitle, { textAlign: 'center', marginBottom: 14 }]}>
        Terminaste "Prompts Creativos". Ahora no solo sabes escribir prompts — sabes dirigirlos. Con
        tono, con estilo, con intención.
      </Text>
      <View style={{ backgroundColor: '#fef9c3', borderRadius: 12, padding: 11, marginBottom: 14, borderWidth: 1, borderColor: '#fcd34d', width: '100%' }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#92400e', textAlign: 'center' }}>⭐ {xp} XP ganados</Text>
      </View>
      <View style={{ backgroundColor: '#f5f3ff', borderRadius: 12, padding: 13, marginBottom: 14, borderWidth: 1, borderColor: '#c4b5fd', width: '100%' }}>
        {[
          'Construí prompts narrativos con 3 palabras como punto de partida',
          'Aprendí cómo el tono y los adjetivos emocionales cambian el resultado',
          'Creé personajes, canciones y juegos con prompts estructurados',
          'Comparé estilos narrativos y elegí el correcto para cada tipo de historia',
          'Reflexioné sobre el límite entre co-crear y depender de la IA',
        ].map((skill, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: i < 4 ? 7 : 0 }}>
            <Text style={{ color: '#7c3aed', fontWeight: '700', fontSize: 14 }}>✓</Text>
            <Text style={{ fontSize: 12, color: '#334155', lineHeight: 18, flex: 1 }}>{skill}</Text>
          </View>
        ))}
      </View>
      <View style={{ backgroundColor: '#f8fafc', borderRadius: 10, padding: 11, marginBottom: 14, borderWidth: 1, borderColor: '#e2e8f0', width: '100%' }}>
        <Text style={{ fontSize: 12, color: '#334155', lineHeight: 20 }}>
          🐛 <Text style={{ fontWeight: '700' }}>Nivel 10: Prompts que Fallan{'\n\n'}</Text>
          Ahora que sabes crear, vas a aprender a depurar. Prompts ambiguos, alucinaciones, errores de
          contexto y cómo corregirlos. El nivel donde te conviertes en detective de la IA.
        </Text>
      </View>
      <View style={{ width: '100%', marginBottom: 8 }}>
        <Text style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>Nivel 9 de 36 completado · Mundo 2 — Domina el Prompting</Text>
        <View style={{ height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
          <View style={{ height: '100%', width: '25%', backgroundColor: '#7c3aed', borderRadius: 3 }} />
        </View>
      </View>
      <TouchableOpacity style={styles.finishButton} onPress={handleFinish}>
        <Text style={{ fontWeight: 'bold', color: '#fff', fontSize: 15 }}>Siguiente nivel →</Text>
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
      case 7: return renderMissing();
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
  const progressLabel =
    step === 0 ? 'Introducción' : step < TOTAL_STEPS - 1 ? `Módulo ${step} de ${CONTENT_STEPS}` : '¡Nivel completado!';

  // Habilitación del botón principal por paso
  const canProceed = (() => {
    switch (step) {
      case 1: return threeWordsOk;
      case 2: return genreChecked || allGenresFilled;
      case 3: return fillAnswered;
      case 5: return charEspecie !== null && charPoder !== null && charMiedo !== null;
      case 6: return sgGenre.trim().length >= 3 && sgTema.trim().length >= 5 && sgMood.trim().length >= 3;
      case 7: return missingAnswered;
      case 9:
        return gmTipo.trim().length >= 5 && gmPers.trim().length >= 5 && gmObj.trim().length >= 5 && gmMec.trim().length >= 5;
      case 10: return storyCollab.trim().length >= 30;
      case 11: return styleAnswered;
      case 12: return emoTags.length >= 1;
      case 14: return sprintDone;
      case 16: return quizInvDone || quizInvRevealed;
      case 17: return wildValid;
      case 18: return reflectText.trim().length >= 50;
      default: return true; // teoría/lectura
    }
  })();

  const handleMainBtn = () => {
    if (step === 2 && !genreChecked) {
      checkGenre();
      return;
    }
    if (step === 16 && !quizInvDone) {
      if (quizInvRevealed) nextQI();
      return;
    }
    if (!canProceed) return;
    goToNextStep();
  };

  const getBtnLabel = () => {
    switch (step) {
      case 0: return '¡Empezar! →';
      case 2: return genreChecked ? 'Continuar →' : 'Verificar →';
      case 16: return quizInvDone ? 'Continuar →' : 'Siguiente →';
      case 18: return 'Completar nivel →';
      default: return 'Continuar →';
    }
  };

  const showBackButton = THEORY_STEPS.has(step);
  const showFooter = step < TOTAL_STEPS - 1;

  return (
    <View style={styles.screen}>
      <View style={styles.progressBar}>
        <TouchableOpacity onPress={() => exitLevel()} style={styles.closeBtn}>
          <MaterialIcons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.progressCol}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>
          <Text style={styles.progressLabel}>{progressLabel}</Text>
        </View>
        <Text style={styles.xpText}>{xp} XP</Text>
      </View>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {renderStepContent()}
      </ScrollView>
      {xpToast && (
        <XPToast key={xpToast.id} amount={xpToast.amount} onHide={() => setXpToast(null)} bgColor="#10b981" textColor="#fff" />
      )}
      {showFooter && (
        <View style={styles.footerRow}>
          {showBackButton && (
            <TouchableOpacity style={styles.backButton} onPress={goToPrevStep}>
              <Text style={styles.backButtonText}>← Volver</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.mainButton, !canProceed && styles.mainButtonDisabled]}
            onPress={handleMainBtn}
            disabled={!canProceed}
            activeOpacity={0.85}
          >
            <Text style={styles.mainButtonText}>{getBtnLabel()}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ===================== ESTILOS =====================
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  progressBar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  closeBtn: { padding: 4 },
  progressCol: { flex: 1, marginHorizontal: 12 },
  progressTrack: { height: 8, backgroundColor: colors.borderLight, borderRadius: 4 },
  progressFill: { height: '100%', backgroundColor: '#10b981', borderRadius: 4 },
  progressLabel: { fontSize: 10, color: '#94a3b8', marginTop: 3, fontWeight: '500' },
  xpText: { ...typography.bold, fontSize: 14, color: '#92400e' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  tag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 12 },
  tagText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  iconCircle: { width: 60, height: 60, borderRadius: 18, backgroundColor: '#d1fae5', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  title: { ...typography.extraBold, fontSize: 19, color: colors.textPrimary, marginBottom: 6 },
  subtitle: { ...typography.regular, fontSize: 13, color: colors.textSecondary, marginBottom: 14, lineHeight: 18 },
  instruction: { fontSize: 12, color: '#5b21b6', fontWeight: '600', marginBottom: 8, lineHeight: 17 },
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  cardTitle: { ...typography.bold, fontSize: 13, color: colors.textPrimary, marginBottom: 6 },
  cardText: { ...typography.regular, fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
  input: { borderWidth: 1.5, borderColor: '#a7f3d0', borderRadius: 10, padding: 10, fontSize: 13, backgroundColor: '#f0fdf4', color: '#334155', marginBottom: 8 },
  textArea: { borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 13, color: '#334155', textAlignVertical: 'top', minHeight: 90, backgroundColor: '#fafafa', marginBottom: 8 },
  optionBtn: { width: '100%', padding: 11, borderRadius: 11, borderWidth: 2, borderColor: '#e2e8f0', backgroundColor: '#f8fafc', marginBottom: 7 },
  optOk: { borderColor: '#10b981', backgroundColor: '#dcfce7' },
  optBad: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },
  builderLabel: { fontSize: 11, fontWeight: '700', marginBottom: 4, marginTop: 6 },
  // Highlight boxes
  hlBox: { paddingHorizontal: 14, paddingVertical: 12, borderTopRightRadius: 12, borderBottomRightRadius: 12, borderLeftWidth: 3, marginVertical: 9 },
  hlText: { fontSize: 12, lineHeight: 20, fontWeight: '500' },
  // Tip box
  tipBox: { marginTop: 10, backgroundColor: '#f5f3ff', borderWidth: 1, borderColor: '#c4b5fd', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 11 },
  tipText: { fontSize: 12, color: '#5b21b6', lineHeight: 18 },
  // Feedback bar
  fbBar: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 7 },
  fbOk: { backgroundColor: '#dcfce7' },
  fbWrong: { backgroundColor: '#fff1f2' },
  fbText: { fontSize: 12, fontWeight: '500', lineHeight: 18 },
  // Compare panels
  compareWrap: { flexDirection: 'row', gap: 8, marginBottom: 11 },
  comparePanel: { flex: 1, borderRadius: 12, padding: 11, borderWidth: 1 },
  compareLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 7 },
  compareMono: { fontSize: 11, color: '#334155', lineHeight: 17, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  compareResp: { fontSize: 11, color: '#334155', lineHeight: 17 },
  // Blank (fill-in-blank)
  blankBox: { marginTop: 8, borderBottomWidth: 2, borderBottomColor: '#c4b5fd', borderStyle: 'dashed', paddingVertical: 4, minHeight: 26, justifyContent: 'center' },
  blankText: { fontSize: 12, color: '#c4b5fd', letterSpacing: 1 },
  // Genre dropdown
  genreDesc: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, borderWidth: 1.5, borderColor: '#e2e8f0' },
  genreSelect: { width: 118, minHeight: 40, borderRadius: 9, borderWidth: 1.5, borderColor: '#c4b5fd', backgroundColor: '#f5f3ff', paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropdownList: { marginTop: 4, alignSelf: 'flex-end', width: 118, backgroundColor: '#fff', borderRadius: 9, borderWidth: 1.5, borderColor: '#c4b5fd', overflow: 'hidden' },
  dropdownItem: { paddingVertical: 9, paddingHorizontal: 11, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  // Choice chips (personaje, emociones, sprint)
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 10 },
  choiceChip: { paddingVertical: 8, paddingHorizontal: 13, borderRadius: 20, borderWidth: 2, borderColor: '#c4b5fd', backgroundColor: '#f5f3ff' },
  choiceChipSel: { borderColor: '#7c3aed', backgroundColor: '#ede9fe' },
  choiceChipText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  choiceChipTextSel: { color: '#5b21b6' },
  // Checklist (módulo 17)
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7 },
  // Buttons
  actionBtn: { width: '100%', padding: 12, borderRadius: 11, alignItems: 'center' },
  footerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 8, borderTopWidth: 1, borderTopColor: colors.borderLight, backgroundColor: colors.background },
  backButton: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, paddingVertical: 14, paddingHorizontal: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  backButtonText: { ...typography.bold, color: colors.textSecondary, fontSize: 14 },
  mainButton: { flex: 1, backgroundColor: '#10b981', paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  mainButtonDisabled: { opacity: 0.35 },
  mainButtonText: { ...typography.bold, color: '#fff', fontSize: 15 },
  finishButton: { backgroundColor: '#10b981', paddingVertical: 14, borderRadius: 12, width: '100%', alignItems: 'center', marginTop: 6 },
});
