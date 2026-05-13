import { router } from 'expo-router';
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, BackHandler, ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useGameStore } from '../../store/gameStore';
import { colors, typography } from '../../theme';

// ---------- Tipos ----------
type QuizItem = { q: string; opts: string[]; correct: number; fb: string };
type MatchPair = { a: string; b: string };
type VFItem = { s: string; correct: boolean; fb: string };
type ClassifyItem = { text: string; correct: string; fb: string };

// ---------- Datos ----------
const MODULE_COUNT = 21; // 0..20

// Módulo 2: Matching
const MATCH_PAIRS: MatchPair[] = [
  { a: '🎙️ Locutor de radio profesional', b: 'Voz humana entrenada, imperfecciones naturales' },
  { a: '🤖 ElevenLabs Clone', b: 'Voz sintética, aprende de grabaciones de una persona' },
  { a: '📱 Siri / Google Assistant', b: 'IA de voz simple, diseñada para comandos cortos' },
  { a: '🎧 AudioBook narrado por IA', b: 'Narración larga generada sin actor humano' },
];

// Módulo 4: Quiz Whisper
const QUIZ_WHISPER: QuizItem = {
  q: 'Lena, una estudiante de Alemania, quiere transcribir automáticamente las entrevistas de su proyecto de periodismo escolar. Whisper es perfecto para esto. ¿Qué hace exactamente Whisper?',
  opts: [
    'Genera música de fondo para el video de la entrevista',
    'Convierte el audio hablado en texto escrito automáticamente',
    'Traduce idiomas en tiempo real durante una llamada',
    'Mejora la calidad del audio eliminando el ruido de fondo',
  ],
  correct: 1,
  fb: '¡Correcto! Whisper es un modelo de transcripción: convierte lo que dices en texto. Es tan preciso que funciona bien con acentos variados, incluyendo el español latinoamericano.',
};

// Módulo 6: Classify usos buenos/malos
const CLASSIFY_ITEMS: ClassifyItem[] = [
  { text: 'Un escritor crea un audiolibro de su novela con su propia voz clonada', correct: 'ok', fb: '✅ Totalmente válido. El creador usa su propia voz con su propio permiso.' },
  { text: 'Alguien clona la voz de su abuela para que pueda "hablar" después de su muerte', correct: 'ok', fb: '✅ Con consentimiento previo, esto puede ser un bello proyecto de legado digital.' },
  { text: 'Una persona crea audio falso de un político diciendo cosas que nunca dijo', correct: 'bad', fb: '⚠️ Esto es desinformación y puede ser ilegal en muchos países.' },
  { text: 'Una empresa usa voz de IA para crear llamadas falsas de "tu banco" y robarte datos', correct: 'bad', fb: '🚨 Esto es una estafa. ¡Nunca des datos por teléfono sin verificar!' },
  { text: 'Un estudiante con parálisis usa IA para generar su voz y poder comunicarse', correct: 'ok', fb: '✅ Uso extraordinario. La IA de voz está transformando la vida de personas con discapacidades.' },
];

// Módulo 9: Quiz estafa de voz
const QUIZ_ESTAFA: QuizItem = {
  q: 'Sebastián en Chile recibe una llamada de alguien que suena exactamente como su papá, diciendo que está en un accidente y necesita dinero urgente. ¿Cuál es la respuesta más inteligente?',
  opts: [
    'Enviar el dinero inmediatamente porque suena igual a su papá',
    'Colgar y llamar directamente a su papá al número que él ya conoce para verificar',
    'Pedir que le manden una foto del accidente',
    'Preguntar el número de cuenta para hacer la transferencia',
  ],
  correct: 1,
  fb: '¡Exacto! Las estafas con voz clonada ya existen. La regla de oro: NUNCA actúes sobre información urgente sin verificar directamente con la persona.',
};

// Módulo 10: Quiz detectar voz IA
const QUIZ_DETECTAR: QuizItem = {
  q: '¿Cuál de estas señales es una pista real de que podrías estar escuchando una voz de IA?',
  opts: [
    'La persona habla sin acento (las IA no pueden imitar acentos)',
    'Hay una pequeña pausa o "clic" artificial al comenzar a hablar, y el ritmo es perfectamente uniforme sin las pequeñas imperfecciones humanas',
    'La persona dice palabras difíciles (las IA no saben vocabulario avanzado)',
    'El audio tiene demasiado ruido de fondo (las IA generan audio muy limpio)',
  ],
  correct: 1,
  fb: '¡Correcto! Las voces de IA a veces se delatan por el ritmo demasiado uniforme, sin las pequeñas vacilaciones y variaciones naturales del habla humana.',
};

// Módulo 12: VF 1
const VF_ITEMS_1: VFItem[] = [
  { s: 'Con ElevenLabs puedes clonar tu propia voz y está completamente prohibido.', correct: false, fb: 'FALSO. Clonar tu propia voz para uso personal es totalmente legal. Lo problemático es clonar la voz de OTRAS personas sin su permiso.' },
  { s: 'La IA puede crear música en géneros que ella misma "inventa", mezclando estilos que nunca existieron.', correct: true, fb: 'VERDADERO. Las IAs pueden generar estilos musicales híbridos completamente nuevos.' },
  { s: 'Una llamada telefónica con voz de IA siempre puede detectarse fácilmente.', correct: false, fb: 'FALSO. Las mejores IAs de voz son extremadamente difíciles de detectar, especialmente con conexiones telefónicas de baja calidad.' },
];

// Módulo 14: VF 2
const VF_ITEMS_2: VFItem[] = [
  { s: 'Usar la voz clonada de un cantante famoso para hacer que "cante" tu canción y venderla sin permiso.', correct: false, fb: 'FALSO que sea legal. Esto viola los derechos de imagen y voz del artista. Necesitas permiso explícito.' },
  { s: 'Crear un podcast donde usas tu propia voz clonada para que "lea" artículos mientras tú descansas.', correct: true, fb: 'VERDADERO que es legal. Tu voz, tu contenido, tu decisión.' },
  { s: 'Una empresa puede usar fragmentos de tu voz de una llamada de servicio al cliente para entrenar su IA.', correct: false, fb: 'FALSO. En muchos países esto requiere consentimiento explícito.' },
];

// Módulo 16: Quiz accesibilidad
const QUIZ_ACCESIBILIDAD: QuizItem = {
  q: 'Aisha tiene esclerosis lateral amiotrófica (ELA), una enfermedad que le quitó la capacidad de hablar. ¿Cómo podría ayudarle la IA de audio?',
  opts: [
    'No puede ayudarle porque la IA no entiende enfermedades',
    'Podría clonar su voz (cuando aún podía hablar) para que un lector de pantalla hable con SU voz real, no una voz genérica',
    'Solo podría traducir sus pensamientos al inglés',
    'La IA no puede comunicarse con personas con discapacidades motoras',
  ],
  correct: 1,
  fb: '¡Exacto! Esto es real: con IA, Aisha podría conservar SU voz original — su identidad vocal — para comunicarse. ElevenLabs tiene un programa especial para esto.',
};

// Módulo 17: Sort
const SORT_ITEMS = [
  'Primer sintetizador de voz mecánico (1939)',
  'IBM crea el primer sistema TTS básico para computadoras (1961)',
  'Nuance crea Dragon Dictation para reconocimiento de voz (1990)',
  'Siri se lanza como asistente de voz en iPhone (2011)',
  'ElevenLabs lanza clonación de voz de alta calidad (2022)',
  'Suno permite crear canciones completas con texto (2023)',
];

// Módulo 18: Quiz final
const QUIZ_FINAL: QuizItem = {
  q: 'Tu profesor de Arte quiere crear un audiolibro de los cuentos que escriben los estudiantes, con las voces de los propios estudiantes pero sin tener que grabar durante horas. ¿Cuál es la solución más inteligente con IA?',
  opts: [
    'Contratar actores de doblaje profesionales para cada cuento',
    'Grabar 2-3 minutos de la voz de cada estudiante, crear sus clones de voz con ElevenLabs, y usar esa voz para narrar automáticamente sus propios cuentos',
    'Usar solo voces genéricas de robot para todos los audiolibros',
    'Escribir los cuentos en texto y que alguien los lea en voz alta manualmente',
  ],
  correct: 1,
  fb: '¡Solución perfecta! Con los clones de voz de cada estudiante, el audiolibro final sonaría como si cada uno hubiera narrado su propio cuento.',
};

// ---------- Props ----------
interface LevelProps { navigation?: any; setAllowBack?: (allow: boolean) => void; }

export default function World3Level2({ navigation: propsNavigation, setAllowBack }: LevelProps) {
  const nav = useNavigation();
  const navigation = propsNavigation || nav;
  const completeLevel = useGameStore(s => s.completeLevel);

  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  // Quiz states
  const [quizAnswered, setQuizAnswered] = useState(false);
  const [quizChoice, setQuizChoice] = useState<number | null>(null);

  // Matching states
  const [matchSelectedA, setMatchSelectedA] = useState<number | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<Set<number>>(new Set());
  const [rightOrder] = useState(() => pickN(MATCH_PAIRS.map(p => p.b), 4).sort(() => Math.random() - 0.5));

  // Builder states
  const [builder5Text, setBuilder5Text] = useState('');
  const [builder8Text, setBuilder8Text] = useState('');
  const [builder19Text, setBuilder19Text] = useState('');

  // Classify states
  const [c2Answers, setC2Answers] = useState<{ [key: number]: string }>({});
  const [c2Checked, setC2Checked] = useState(false);

  // VF states
  const [vf1Answers, setVf1Answers] = useState<{ [key: number]: boolean }>({});
  const [vf1Checked, setVf1Checked] = useState(false);
  const [vf2Answers, setVf2Answers] = useState<{ [key: number]: boolean }>({});
  const [vf2Checked, setVf2Checked] = useState(false);

  // Sprint states
  const [sprintRunning, setSprintRunning] = useState(false);
  const [sprintSec, setSprintSec] = useState(60);
  const [sprintText, setSprintText] = useState('');
  const sprintTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sort states
  const [sortOrder, setSortOrder] = useState<number[]>(() => [0, 1, 2, 3, 4, 5].sort(() => Math.random() - 0.5));
  const [sortChecked, setSortChecked] = useState(false);

  // Theory steps allow back
  const theorySteps = new Set([0, 1, 3, 7, 11, 15]);

  useEffect(() => { setAllowBack?.(true); }, []);
  useEffect(() => { return () => { if (sprintTimerRef.current) clearInterval(sprintTimerRef.current); }; }, []);

  // Sprint timer
  useEffect(() => {
    if (!sprintRunning) return;
    if (sprintSec <= 0) {
      if (sprintTimerRef.current) clearInterval(sprintTimerRef.current);
      setSprintRunning(false);
      addXP(15);
      return;
    }
    sprintTimerRef.current = setTimeout(() => setSprintSec(s => s - 1), 1000);
    return () => { if (sprintTimerRef.current) clearInterval(sprintTimerRef.current); };
  }, [sprintRunning, sprintSec]);

  const addXP = (v: number) => { setXp(prev => prev + v); setCorrectCount(prev => prev + 1); };
  const nextStep = () => { if (step < MODULE_COUNT - 1) setStep(step + 1); };
  const prevStep = () => { if (step > 0) setStep(step - 1); };

  const finishLevel = () => {
    let stars = xp >= 180 ? 3 : xp >= 120 ? 2 : xp >= 50 ? 1 : 0;
    completeLevel(3, 2, stars, xp);
    router.back();
  };

  // Quiz handlers
  const handleQuiz = (choice: number, correct: number) => {
    if (quizAnswered) return;
    setQuizAnswered(true);
    setQuizChoice(choice);
    if (choice === correct) addXP(getCurrentXP());
  };

  // Matching handlers
  const handleMatchA = (i: number) => {
    if (matchedPairs.has(i)) return;
    setMatchSelectedA(i);
  };
  const handleMatchB = (val: number) => {
    if (matchSelectedA === null || matchedPairs.has(matchSelectedA)) return;
    if (matchSelectedA === val) {
      setMatchedPairs(prev => new Set(prev).add(val));
      setMatchSelectedA(null);
      if (matchedPairs.size + 1 >= MATCH_PAIRS.length) {
        addXP(15);
        Alert.alert('✅', '¡Todos los pares conectados!', [{ text: 'OK' }]);
      }
    } else {
      Alert.alert('❌', 'Ese no es el par correcto.');
      setMatchSelectedA(null);
    }
  };

  // Classify handlers
  const handleC2 = (idx: number, val: string) => {
    if (c2Answers[idx] !== undefined) return;
    setC2Answers(prev => ({ ...prev, [idx]: val }));
    if (Object.keys(c2Answers).length + 1 >= CLASSIFY_ITEMS.length) {
      setTimeout(() => {
        setC2Checked(true);
        addXP(15);
      }, 300);
    }
  };

  // VF handlers
  const handleVF1 = (idx: number, val: boolean) => {
    if (vf1Answers[idx] !== undefined) return;
    setVf1Answers(prev => ({ ...prev, [idx]: val }));
    if (Object.keys(vf1Answers).length + 1 >= VF_ITEMS_1.length) {
      setVf1Checked(true);
      addXP(15);
    }
  };
  const handleVF2 = (idx: number, val: boolean) => {
    if (vf2Answers[idx] !== undefined) return;
    setVf2Answers(prev => ({ ...prev, [idx]: val }));
    if (Object.keys(vf2Answers).length + 1 >= VF_ITEMS_2.length) {
      setVf2Checked(true);
      addXP(15);
    }
  };

  // Sprint handlers
  const startSprint = () => { setSprintRunning(true); setSprintSec(60); };
  const submitSprint = () => {
    if (sprintTimerRef.current) clearInterval(sprintTimerRef.current);
    setSprintRunning(false);
    addXP(15);
  };

  // Sort handlers
  const moveSort = (pos: number, dir: number) => {
    if (sortChecked) return;
    const newPos = pos + dir;
    if (newPos < 0 || newPos >= sortOrder.length) return;
    const newOrder = [...sortOrder];
    [newOrder[pos], newOrder[newPos]] = [newOrder[newPos], newOrder[pos]];
    setSortOrder(newOrder);
  };
  const checkSort = () => {
    const isOk = sortOrder.every((v, i) => v === i);
    if (isOk) {
      setSortChecked(true);
      addXP(15);
      Alert.alert('✅', '¡Línea del tiempo perfecta!', [{ text: 'OK' }]);
    } else {
      Alert.alert('❌', 'Algunos elementos no están en el orden correcto.');
    }
  };

  const getCurrentXP = () => {
    const xpMap: Record<number, number> = {
      0: 0, 1: 10, 2: 15, 3: 10, 4: 15, 5: 15, 6: 15, 7: 10, 8: 20, 9: 10,
      10: 15, 11: 10, 12: 15, 13: 15, 14: 15, 15: 10, 16: 15, 17: 15, 18: 20, 19: 15, 20: 0,
    };
    return xpMap[step] || 10;
  };

  // ---------- RENDER ----------
  const renderStep = () => {
    const btn = (label: string, onPress: () => void, disabled = false) => (
      <TouchableOpacity style={[styles.btn, disabled && styles.btnOff]} onPress={onPress} disabled={disabled}>
        <Text style={styles.btnText}>{label}</Text>
      </TouchableOpacity>
    );
    const card = (titleT: string, textT: string) => (
      <View style={styles.card}><Text style={styles.cardTitle}>{titleT}</Text><Text style={styles.cardText}>{textT}</Text></View>
    );
    const tag = (label: string) => <Text style={styles.tag}>{label}</Text>;
    const title = (t: string) => <Text style={styles.title}>{t}</Text>;
    const body = (t: string) => <Text style={styles.body}>{t}</Text>;
    const infoBox = (t: string) => <View style={styles.infoBox}><Text style={styles.infoText}>{t}</Text></View>;

    switch (step) {
      case 0: return (
        <View style={styles.stepContainer}>
          <View style={styles.iconCircle}><Text style={styles.iconEmoji}>🎵</Text></View>
          {title('¿Puede la IA tener voz?')}
          {body('Imagínate hablarle a tu computadora y que ella te responda con una voz que suena exactamente como la de tu artista favorito. Esto ya es posible hoy.')}
          {infoBox('🎤 ElevenLabs — clona voces humanas\n👂 Whisper — transcribe audio a texto\n🎵 Suno y Udio — compone canciones completas\n🌐 Google Translate Voice — traduce en tiempo real')}
          {btn('¡Comenzar! →', nextStep)}
        </View>
      );
      case 1: return (
        <View style={styles.stepContainer}>
          {tag('🧠 Teoría')}
          {title('¿Cómo convierte la IA texto en voz?')}
          {body('1. Entender el texto: analiza palabras, puntuación y contexto emocional.\n2. Generar el audio: construye la voz poco a poco con las características únicas de la voz que debe imitar.')}
          {infoBox('Analogía: el texto es la partitura y la IA es el músico que la toca.')}
          {btn('Entendido →', nextStep)}
        </View>
      );
      case 2: return (
        <View style={styles.stepContainer}>
          {tag('🔗 Matching')}
          {title('Voces reales vs IA')}
          <Text style={styles.subtitle}>Conecta cada elemento con su descripción correcta.</Text>
          <View style={styles.matchRow}>
            <View style={{ flex: 1 }}>
              {MATCH_PAIRS.map((p, i) => (
                <TouchableOpacity key={i} style={[styles.matchCard, matchSelectedA === i && styles.matchSelected, matchedPairs.has(i) && styles.matchDone]}
                  onPress={() => handleMatchA(i)} disabled={matchedPairs.has(i)}>
                  <Text style={styles.matchText}>{p.a}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flex: 1 }}>
              {rightOrder.map((b, i) => {
                const origIdx = MATCH_PAIRS.findIndex(p => p.b === b);
                return (
                  <TouchableOpacity key={i} style={[styles.matchCard, matchedPairs.has(origIdx) && styles.matchDone]}
                    onPress={() => handleMatchB(origIdx)} disabled={matchedPairs.has(origIdx)}>
                    <Text style={styles.matchText}>{b}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          {matchedPairs.size >= 4 && btn('Continuar →', nextStep)}
        </View>
      );
      case 3: return (
        <View style={styles.stepContainer}>
          {tag('🎤 Casos reales')}
          {title('ElevenLabs: la empresa que clona voces')}
          {body('Fundada en 2022. Con solo 1-3 minutos de audio de una persona, pueden crear un clon de voz casi indistinguible del original.')}
          {infoBox('Usos legítimos:\n🎬 Doblaje de películas\n📚 Audiolibros\n♿ Accesibilidad\n🎮 Voces de videojuegos')}
          {btn('Entendido →', nextStep)}
        </View>
      );
      case 4: return (
        <View style={styles.stepContainer}>
          {tag('❓ Quiz')}
          {title('Whisper en acción')}
          <Text style={styles.quizQ}>{QUIZ_WHISPER.q}</Text>
          {QUIZ_WHISPER.opts.map((o, i) => (
            <TouchableOpacity key={i} style={[styles.quizOpt, quizChoice === i && (i === QUIZ_WHISPER.correct ? styles.optCorrect : styles.optWrong)]}
              onPress={() => handleQuiz(i, QUIZ_WHISPER.correct)} disabled={quizAnswered}>
              <Text style={styles.optText}>{o}</Text>
            </TouchableOpacity>
          ))}
          {quizAnswered && <Text style={styles.feedback}>{QUIZ_WHISPER.fb}</Text>}
          {quizAnswered && btn('Continuar →', nextStep)}
        </View>
      );
      case 5: return (
        <View style={styles.stepContainer}>
          {tag('✏️ Constructor')}
          {title('Diseña tu voz de IA')}
          {body('Define: tono, velocidad, acento, emoción predominante, nombre y personalidad.')}
          <TextInput style={styles.textArea} placeholder="Describe la voz y personalidad de tu asistente de IA ideal..." value={builder5Text} onChangeText={setBuilder5Text} multiline />
          {builder5Text.trim().length > 15 && <Text style={styles.feedback}>🎤 ¡Diseño increíble! Eso es exactamente lo que hacen los ingenieros de producto.</Text>}
          {btn('Continuar →', () => { addXP(15); nextStep(); }, builder5Text.trim().length <= 15)}
        </View>
      );
      case 6: return (
        <View style={styles.stepContainer}>
          {tag('⚖️ Clasificador')}
          {title('¿Bueno o peligroso?')}
          {CLASSIFY_ITEMS.map((item, i) => (
            <View key={i} style={styles.classifyItem}>
              <Text style={styles.classifyText}>{item.text}</Text>
              <View style={styles.classifyRow}>
                <TouchableOpacity style={[styles.classifyBtn, c2Answers[i] === 'ok' && (item.correct === 'ok' ? styles.optCorrect : styles.optWrong)]}
                  onPress={() => handleC2(i, 'ok')} disabled={c2Answers[i] !== undefined}>
                  <Text style={styles.classifyBtnText}>✅ Uso válido</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.classifyBtn, c2Answers[i] === 'bad' && (item.correct === 'bad' ? styles.optCorrect : styles.optWrong)]}
                  onPress={() => handleC2(i, 'bad')} disabled={c2Answers[i] !== undefined}>
                  <Text style={styles.classifyBtnText}>⚠️ Problemático</Text>
                </TouchableOpacity>
              </View>
              {c2Answers[i] !== undefined && <Text style={styles.fbSmall}>{item.fb}</Text>}
            </View>
          ))}
          {c2Checked && btn('Continuar →', nextStep)}
        </View>
      );
      case 7: return (
        <View style={styles.stepContainer}>
          {tag('🎵 Casos reales')}
          {title('Suno y Udio: canciones desde cero')}
          {body('Escribe "canción de rock épico sobre un gato que quiere conquistar el mundo" y en 30 segundos tienes una canción completa. Manejan pop, rock, reggaeton, cumbia, jazz, electrónica...')}
          {infoBox('1. Describe el estilo y tema\n2. Opcionalmente escribe la letra\n3. En 30-60 segundos tienes una canción completa')}
          {btn('Entendido →', nextStep)}
        </View>
      );
      case 8: return (
        <View style={styles.stepContainer}>
          {tag('🎵 Constructor')}
          {title('Compone una canción')}
          {body('Incluye: género musical, tema de la letra, mood/emoción, primera estrofa (opcional).')}
          <TextInput style={styles.textArea} placeholder="Género + tema + mood + versos iniciales..." value={builder8Text} onChangeText={setBuilder8Text} multiline />
          {builder8Text.trim().length > 15 && <Text style={styles.feedback}>🎵 ¡Ese prompt generaría una canción increíble! Con Suno o Udio podrías escucharla en menos de un minuto.</Text>}
          {btn('Continuar →', () => { addXP(20); nextStep(); }, builder8Text.trim().length <= 15)}
        </View>
      );
      case 9: return (
        <View style={styles.stepContainer}>
          {tag('❓ Quiz')}
          {title('La voz falsa peligrosa')}
          <Text style={styles.quizQ}>{QUIZ_ESTAFA.q}</Text>
          {QUIZ_ESTAFA.opts.map((o, i) => (
            <TouchableOpacity key={i} style={[styles.quizOpt, quizChoice === i && (i === QUIZ_ESTAFA.correct ? styles.optCorrect : styles.optWrong)]}
              onPress={() => handleQuiz(i, QUIZ_ESTAFA.correct)} disabled={quizAnswered}>
              <Text style={styles.optText}>{o}</Text>
            </TouchableOpacity>
          ))}
          {quizAnswered && <Text style={styles.feedback}>{QUIZ_ESTAFA.fb}</Text>}
          {quizAnswered && btn('Continuar →', nextStep)}
        </View>
      );
      case 10: return (
        <View style={styles.stepContainer}>
          {tag('❓ Quiz')}
          {title('Detecta la voz artificial')}
          <Text style={styles.quizQ}>{QUIZ_DETECTAR.q}</Text>
          {QUIZ_DETECTAR.opts.map((o, i) => (
            <TouchableOpacity key={i} style={[styles.quizOpt, quizChoice === i && (i === QUIZ_DETECTAR.correct ? styles.optCorrect : styles.optWrong)]}
              onPress={() => handleQuiz(i, QUIZ_DETECTAR.correct)} disabled={quizAnswered}>
              <Text style={styles.optText}>{o}</Text>
            </TouchableOpacity>
          ))}
          {quizAnswered && <Text style={styles.feedback}>{QUIZ_DETECTAR.fb}</Text>}
          {quizAnswered && btn('Continuar →', nextStep)}
        </View>
      );
      case 11: return (
        <View style={styles.stepContainer}>
          {tag('📻 Casos reales')}
          {title('El audio de IA ya está en todas partes')}
          {body('Radios automatizadas, audiolibros narrados por IA, podcasts generados automáticamente, doblajes con IA.')}
          {infoBox('Impacto en empleos: Los actores de doblaje están preocupados por esta tendencia.')}
          {btn('Entendido →', nextStep)}
        </View>
      );
      case 12: return (
        <View style={styles.stepContainer}>
          {tag('✔️ Verdadero o Falso')}
          {VF_ITEMS_1.map((item, i) => (
            <View key={i} style={styles.classifyItem}>
              <Text style={styles.classifyText}>"{item.s}"</Text>
              <View style={styles.classifyRow}>
                <TouchableOpacity style={[styles.classifyBtn, vf1Answers[i] === true && (item.correct ? styles.optCorrect : styles.optWrong)]}
                  onPress={() => handleVF1(i, true)} disabled={vf1Answers[i] !== undefined}>
                  <Text style={styles.classifyBtnText}>✅ Verdadero</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.classifyBtn, vf1Answers[i] === false && (!item.correct ? styles.optCorrect : styles.optWrong)]}
                  onPress={() => handleVF1(i, false)} disabled={vf1Answers[i] !== undefined}>
                  <Text style={styles.classifyBtnText}>❌ Falso</Text>
                </TouchableOpacity>
              </View>
              {vf1Answers[i] !== undefined && <Text style={styles.fbSmall}>{item.fb}</Text>}
            </View>
          ))}
          {vf1Checked && btn('Continuar →', nextStep)}
        </View>
      );
      case 13: return (
        <View style={styles.stepContainer}>
          {tag('⚡ Sprint')}
          {title('Diseña personajes de audio')}
          {!sprintRunning ? (
            <>
              <Text style={styles.sprintTimer}>{Math.floor(sprintSec/60)}:{String(sprintSec%60).padStart(2,'0')}</Text>
              <TextInput style={styles.textArea} placeholder="Personaje 1: [Nombre] — [Personalidad] — [Tipo de voz]\nPersonaje 2: ...\nPersonaje 3: ..." value={sprintText} onChangeText={setSprintText} multiline />
              <View style={styles.sprintRow}>
                {btn('▶ Iniciar Sprint', startSprint)}
                <TouchableOpacity style={styles.btnSecondary} onPress={submitSprint}><Text>Entregar</Text></TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.sprintTimer}>{Math.floor(sprintSec/60)}:{String(sprintSec%60).padStart(2,'0')}</Text>
              <TextInput style={styles.textArea} placeholder="Personaje 1: [Nombre] — [Personalidad] — [Tipo de voz]\nPersonaje 2: ...\nPersonaje 3: ..." value={sprintText} onChangeText={setSprintText} multiline />
              {btn('Entregar sprint', submitSprint)}
            </>
          )}
          {sprintSec <= 0 && sprintRunning && btn('Continuar →', nextStep)}
        </View>
      );
      case 14: return (
        <View style={styles.stepContainer}>
          {tag('✔️ Verdadero o Falso')}
          {VF_ITEMS_2.map((item, i) => (
            <View key={i} style={styles.classifyItem}>
              <Text style={styles.classifyText}>"{item.s}"</Text>
              <View style={styles.classifyRow}>
                <TouchableOpacity style={[styles.classifyBtn, vf2Answers[i] === true && (item.correct ? styles.optCorrect : styles.optWrong)]}
                  onPress={() => handleVF2(i, true)} disabled={vf2Answers[i] !== undefined}>
                  <Text style={styles.classifyBtnText}>✅ Verdadero</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.classifyBtn, vf2Answers[i] === false && (!item.correct ? styles.optCorrect : styles.optWrong)]}
                  onPress={() => handleVF2(i, false)} disabled={vf2Answers[i] !== undefined}>
                  <Text style={styles.classifyBtnText}>❌ Falso</Text>
                </TouchableOpacity>
              </View>
              {vf2Answers[i] !== undefined && <Text style={styles.fbSmall}>{item.fb}</Text>}
            </View>
          ))}
          {vf2Checked && btn('Continuar →', nextStep)}
        </View>
      );
      case 15: return (
        <View style={styles.stepContainer}>
          {tag('🌐 Casos reales')}
          {title('El intérprete automático ya existe')}
          {body('HeyGen permite hacer videos donde una persona habla en un idioma y se genera automáticamente en otro. Seamless Communication de Meta traduce voz en tiempo real.')}
          {infoBox('Impacto educativo: Podrás tomar clases de un profesor en Finlandia y escucharlo perfectamente en español, con su voz original.')}
          {btn('Entendido →', nextStep)}
        </View>
      );
      case 16: return (
        <View style={styles.stepContainer}>
          {tag('❓ Quiz')}
          {title('IA de audio y accesibilidad')}
          <Text style={styles.quizQ}>{QUIZ_ACCESIBILIDAD.q}</Text>
          {QUIZ_ACCESIBILIDAD.opts.map((o, i) => (
            <TouchableOpacity key={i} style={[styles.quizOpt, quizChoice === i && (i === QUIZ_ACCESIBILIDAD.correct ? styles.optCorrect : styles.optWrong)]}
              onPress={() => handleQuiz(i, QUIZ_ACCESIBILIDAD.correct)} disabled={quizAnswered}>
              <Text style={styles.optText}>{o}</Text>
            </TouchableOpacity>
          ))}
          {quizAnswered && <Text style={styles.feedback}>{QUIZ_ACCESIBILIDAD.fb}</Text>}
          {quizAnswered && btn('Continuar →', nextStep)}
        </View>
      );
      case 17: return (
        <View style={styles.stepContainer}>
          {tag('📅 Ordena')}
          {title('Ordena la línea del tiempo')}
          <Text style={styles.subtitle}>Arrastra para ordenar estos hitos del más antiguo al más reciente.</Text>
          {sortOrder.map((origIdx, pos) => (
            <View key={pos} style={styles.sortRow}>
              <Text style={styles.sortNum}>{pos + 1}</Text>
              <Text style={styles.sortText}>{SORT_ITEMS[origIdx]}</Text>
              <View style={styles.sortArrows}>
                <TouchableOpacity onPress={() => moveSort(pos, -1)} disabled={pos === 0 || sortChecked}><MaterialIcons name="keyboard-arrow-up" size={20} /></TouchableOpacity>
                <TouchableOpacity onPress={() => moveSort(pos, 1)} disabled={pos === sortOrder.length - 1 || sortChecked}><MaterialIcons name="keyboard-arrow-down" size={20} /></TouchableOpacity>
              </View>
            </View>
          ))}
          {!sortChecked ? btn('Verificar orden', checkSort) : btn('Continuar →', nextStep)}
        </View>
      );
      case 18: return (
        <View style={styles.stepContainer}>
          {tag('❓ Quiz de cierre')}
          <Text style={styles.quizQ}>{QUIZ_FINAL.q}</Text>
          {QUIZ_FINAL.opts.map((o, i) => (
            <TouchableOpacity key={i} style={[styles.quizOpt, quizChoice === i && (i === QUIZ_FINAL.correct ? styles.optCorrect : styles.optWrong)]}
              onPress={() => handleQuiz(i, QUIZ_FINAL.correct)} disabled={quizAnswered}>
              <Text style={styles.optText}>{o}</Text>
            </TouchableOpacity>
          ))}
          {quizAnswered && <Text style={styles.feedback}>{QUIZ_FINAL.fb}</Text>}
          {quizAnswered && btn('Continuar →', nextStep)}
        </View>
      );
      case 19: return (
        <View style={styles.stepContainer}>
          {tag('💭 Reflexión final')}
          {title('El futuro del audio')}
          {body('¿Cuál es el uso de la IA de audio que más te emociona? ¿Y cuál te preocupa más?')}
          <TextInput style={styles.textArea} placeholder="Escribe tu reflexión..." value={builder19Text} onChangeText={setBuilder19Text} multiline />
          {builder19Text.trim().length > 15 && <Text style={styles.feedback}>💭 ¡Excelente reflexión! Las preguntas que haces son exactamente las que los legisladores están debatiendo ahora mismo.</Text>}
          {btn('Completar nivel →', () => { addXP(15); nextStep(); }, builder19Text.trim().length <= 15)}
        </View>
      );
      case 20: return (
        <View style={styles.completeContainer}>
          <View style={styles.completeIcon}><Text style={styles.iconEmoji}>🎵</Text></View>
          <Text style={styles.completeTitle}>¡Badge desbloqueado!</Text>
          <View style={styles.badgeBox}><Text style={styles.badgeText}>🏅 Sound Designer</Text></View>
          <Text style={styles.completeSub}>¡Nivel 14 completado! Ahora entiendes el mundo del audio con IA.</Text>
          <Text style={styles.xpBig}>⭐ {xp} XP ganados</Text>
          {btn('Volver al mapa', finishLevel)}
        </View>
      );
      default: return null;
    }
  };

  const progressPercent = (step / (MODULE_COUNT - 1)) * 100;

  return (
    <View style={styles.screen}>
      <View style={styles.bar}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialIcons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.track}><View style={[styles.fill, { width: `${progressPercent}%` }]} /></View>
        <Text style={styles.xpChip}>{xp} XP</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>{renderStep()}</ScrollView>
    </View>
  );
}

// Helper
function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  bar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  track: { flex: 1, height: 6, backgroundColor: colors.borderLight, borderRadius: 3, marginHorizontal: 12 },
  fill: { height: '100%', backgroundColor: colors.success, borderRadius: 3 },
  xpChip: { ...typography.bold, fontSize: 14, color: colors.accentDark },
  scrollContent: { padding: 16, paddingBottom: 40 },
  stepContainer: { flex: 1 },
  tag: { fontSize: 11, fontWeight: '600', color: '#0f766e', backgroundColor: '#f0fdfa', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 12 },
  iconCircle: { width: 80, height: 80, borderRadius: 24, backgroundColor: '#ccfbf1', justifyContent: 'center', alignItems: 'center', marginBottom: 14, alignSelf: 'center' },
  iconEmoji: { fontSize: 42 },
  title: { ...typography.extraBold, fontSize: 19, color: colors.textPrimary, marginBottom: 8, textAlign: 'center' },
  subtitle: { ...typography.regular, fontSize: 13, color: colors.textSecondary, marginBottom: 14, textAlign: 'center' },
  body: { ...typography.regular, fontSize: 13, color: colors.textPrimary, lineHeight: 20, marginBottom: 12 },
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  cardTitle: { ...typography.bold, fontSize: 13, color: colors.textPrimary, marginBottom: 4 },
  cardText: { ...typography.regular, fontSize: 12, color: colors.textSecondary },
  infoBox: { backgroundColor: '#f0fdfa', borderLeftWidth: 4, borderLeftColor: '#14b8a6', borderRadius: 4, padding: 14, marginVertical: 10 },
  infoText: { ...typography.regular, fontSize: 13, color: colors.textPrimary, lineHeight: 22 },
  btn: { backgroundColor: '#0d9488', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  btnText: { ...typography.bold, color: '#fff', fontSize: 15 },
  btnOff: { opacity: 0.4 },
  btnSecondary: { backgroundColor: colors.surface, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  quizQ: { ...typography.bold, fontSize: 13, padding: 10, backgroundColor: '#f0fdfa', borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#5eead4' },
  quizOpt: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 6 },
  optText: { fontSize: 13, color: colors.textPrimary },
  optCorrect: { borderColor: colors.success, backgroundColor: '#dcfce7' },
  optWrong: { borderColor: colors.error, backgroundColor: '#fff1f2' },
  feedback: { fontSize: 12, marginTop: 8, padding: 12, borderRadius: 10, backgroundColor: '#dcfce7', color: '#065f46', borderWidth: 1, borderColor: '#a7f3d0' },
  fbSmall: { fontSize: 11, marginTop: 6, color: '#065f46' },
  matchRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  matchCard: { backgroundColor: colors.surface, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 6 },
  matchSelected: { borderColor: '#06b6d4', backgroundColor: '#ecfeff' },
  matchDone: { borderColor: colors.success, backgroundColor: '#dcfce7' },
  matchText: { fontSize: 11, color: colors.textPrimary, textAlign: 'center' },
  textArea: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, minHeight: 80, fontSize: 13, backgroundColor: '#fafafa', marginBottom: 10 },
  classifyItem: { marginBottom: 14 },
  classifyText: { ...typography.bold, fontSize: 13, marginBottom: 8 },
  classifyRow: { flexDirection: 'row', gap: 8 },
  classifyBtn: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  classifyBtnText: { fontSize: 12, fontWeight: '600' },
  sprintTimer: { fontSize: 36, fontWeight: '800', textAlign: 'center', color: '#0d9488', marginBottom: 10 },
  sprintRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  sortRow: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, marginBottom: 6 },
  sortNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#0d9488', color: '#fff', textAlign: 'center', lineHeight: 26, fontWeight: '700', fontSize: 12, marginRight: 8 },
  sortText: { flex: 1, fontSize: 11, color: colors.textPrimary },
  sortArrows: { flexDirection: 'column' },
  completeContainer: { alignItems: 'center', padding: 20 },
  completeIcon: { width: 86, height: 86, borderRadius: 24, backgroundColor: '#ccfbf1', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  completeTitle: { ...typography.extraBold, fontSize: 22 },
  badgeBox: { backgroundColor: '#f0fdfa', borderWidth: 2, borderColor: '#5eead4', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8, marginVertical: 12 },
  badgeText: { fontSize: 16, fontWeight: '700', color: '#0f766e' },
  completeSub: { ...typography.regular, textAlign: 'center', marginBottom: 12 },
  xpBig: { ...typography.bold, fontSize: 18, color: colors.accentDark, marginBottom: 16 },
});