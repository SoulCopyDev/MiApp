import { router } from 'expo-router';
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, BackHandler,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useGameStore } from '../store/gameStore';
import { colors, typography } from '../theme';

// ---------- Tipos ----------
type ModuleData = {
  type: 'theory' | 'quiz' | 'matching' | 'builder' | 'vf' | 'classify3ext' | 'sprint' | 'dragdrop' | 'completion';
  title: string;
  xp: number;
  q?: string;
  opts?: string[];
  correct?: number;
  fb?: string;
  pairs?: { a: string; b: string }[];
  items?: { s?: string; text?: string; correct: boolean | string; fb: string }[];
  instruction?: string;
  duration?: number;
  placeholder?: string;
  zones?: string[];
  correctMap?: { [key: string]: number };
};

// ---------- Datos de módulos ----------
const MODULES: ModuleData[] = [
  // 0 INTRO
  { type: 'theory', title: 'Introducción', xp: 0 },
  // 1 THEORY: cómo funciona
  { type: 'theory', title: '¿Cómo funciona?', xp: 10 },
  // 2 MATCHING
  { type: 'matching', title: 'Sora, Runway y Pika', xp: 15,
    pairs: [
      { a: '🎬 Sora (OpenAI)', b: 'Genera videos de hasta 60s desde texto con calidad cinematográfica' },
      { a: '✂️ Runway ML', b: 'Especialista en edición: elimina fondos, añade efectos especiales con IA' },
      { a: '🎥 Pika Labs', b: 'Anima imágenes estáticas y crea cortos artísticos animados' },
      { a: '🇨🇳 Kling AI', b: 'Genera videos ultra realistas, fuerte en movimientos de personas' }
    ] },
  // 3 BUILDER
  { type: 'builder', title: 'Tu primer prompt de video', xp: 15 },
  // 4 THEORY: publicidad
  { type: 'theory', title: 'Video IA en publicidad', xp: 10 },
  // 5 REFLEXIÓN
  { type: 'builder', title: '¿Es arte un video de IA?', xp: 10 },
  // 6 VF: deepfakes
  { type: 'vf', title: 'Verdadero o Falso: deepfakes', xp: 15,
    items: [
      { s: 'Un deepfake de video siempre se puede detectar fácilmente porque la imagen se ve borrosa.', correct: false, fb: 'FALSO. Los deepfakes modernos son extremadamente convincentes.' },
      { s: 'Los deepfakes de video solo pueden hacer que una persona diga cosas que nunca dijo.', correct: false, fb: 'FALSO. Pueden cambiar apariencia física, voz, contexto del video y más.' },
      { s: 'Existen leyes en varios países que hacen ilegal crear deepfakes de personas sin su permiso.', correct: true, fb: 'VERDADERO. EE.UU., Reino Unido, Australia y la UE tienen leyes contra deepfakes no consentidos.' }
    ] },
  // 7 CLASSIFY
  { type: 'classify3ext', title: '¿Real o generado por IA?', xp: 15,
    instruction: 'Identifica si cada señal es REAL (sí existe) o FALSA (no es confiable):',
    items: [
      { text: 'Los movimientos de los ojos son demasiado perfectos o los parpadeos no ocurren en momentos naturales', correct: 'real', fb: '✅ Señal real. Las IAs de video frecuentemente fallan con parpadeos y movimientos oculares.' },
      { text: 'El video tiene colores muy brillantes y vivos (la IA siempre genera colores brillantes)', correct: 'falsa', fb: 'No es una señal confiable. Los videos de IA pueden tener cualquier paleta de colores.' },
      { text: 'Las manos de las personas en el video se ven extrañas, con demasiados o pocos dedos', correct: 'real', fb: '✅ Señal real. Al igual que en imágenes, las IAs tienen problemas con las manos.' },
      { text: 'El fondo del video es perfectamente estático sin ningún elemento que se mueva', correct: 'real', fb: '✅ Señal real. Algunos modelos generan fondos estáticos cuando en la realidad tendrían movimiento.' }
    ] },
  // 8 QUIZ
  { type: 'quiz', title: 'IA en las noticias', xp: 10,
    q: 'Un periódico publica un video de un político haciendo declaraciones polémicas. Antes de compartirlo, ¿cuál es la acción más inteligente?',
    opts: ['Compartirlo inmediatamente porque parece muy real', 'Verificar la fuente original, buscar en medios de confianza, y usar herramientas de detección de deepfakes antes de compartir', 'Solo compartirlo si tiene más de 1 millón de vistas', 'Preguntarle a la IA si el video es falso o real'],
    correct: 1, fb: '¡Exacto! Verificar antes de compartir. Los deepfakes de políticos ya han causado crisis reales en elecciones de varios países.' },
  // 9 THEORY: animación
  { type: 'theory', title: 'Anima lo que quieras', xp: 10 },
  // 10 QUIZ
  { type: 'quiz', title: 'Hollywood y la IA', xp: 15,
    q: '¿Para qué usa Hollywood principalmente la IA de video en este momento?',
    opts: ['Para eliminar completamente a los actores humanos', 'Para generar concept videos y previzualización de escenas antes de filmarlas, y añadir efectos en post-producción', 'Para crear películas completas sin ningún ser humano', 'Solo para anuncios publicitarios'],
    correct: 1, fb: '¡Correcto! Hollywood usa la IA como herramienta creativa de apoyo: visualizar escenas y mejorar efectos especiales.' },
  // 11 SPRINT
  { type: 'sprint', title: 'Sprint: tu cortometraje', xp: 20, duration: 90,
    instruction: '🎬 ¡90 segundos! Escribe las 3 escenas de un cortometraje de 30 segundos.',
    placeholder: 'Escena 1 (0-10s): ...\nEscena 2 (10-20s): ...\nEscena 3 (20-30s): ...' },
  // 12 BUILDER
  { type: 'builder', title: 'El director de IA', xp: 15 },
  // 13 THEORY: copyright
  { type: 'theory', title: '¿A quién pertenece?', xp: 10 },
  // 14 QUIZ
  { type: 'quiz', title: 'El pipeline completo', xp: 15,
    q: 'Valentina quiere crear un video para su proyecto escolar: animación, narración con su voz, y música de fondo. ¿Cuál es el pipeline correcto?',
    opts: ['Solo ChatGPT puede hacer todo eso', 'Pika/Runway para video → ElevenLabs para narración → Suno para música → unirlos en editor', 'Solo se puede con equipos profesionales', 'Midjourney primero, luego convertir manualmente'],
    correct: 1, fb: '¡Exacto! IA de video + IA de voz + IA de música = producción audiovisual completa con herramientas accesibles.' },
  // 15 DRAG DROP
  { type: 'dragdrop', title: '¿Gratis o de pago?', xp: 15,
    instruction: 'Clasifica estas herramientas según su modelo de acceso:',
    zones: ['🆓 Gratis / Plan gratuito', '💰 Solo de pago / Limitado'],
    items: [
      { text: 'Pika Labs — plan gratuito limitado', correct: '0', fb: 'Pika Labs ofrece un plan gratuito limitado.' },
      { text: 'Sora Pro — acceso de pago ($20/mes)', correct: '1', fb: 'Sora Pro requiere suscripción de pago.' },
      { text: 'CapCut AI — gratuito con funciones de IA', correct: '0', fb: 'CapCut incluye funciones de IA en su plan gratuito.' },
      { text: 'Runway Pro — plan de pago profesional', correct: '1', fb: 'Runway Pro es un plan de pago orientado a uso profesional.' },
      { text: 'Luma Dream Machine — plan gratuito básico', correct: '0', fb: 'Luma Dream Machine tiene plan gratuito básico.' },
      { text: 'Adobe Firefly Video — requiere suscripción Adobe', correct: '1', fb: 'Firefly Video requiere una suscripción de Adobe.' }
    ] },
  // 16 VF
  { type: 'vf', title: '¿Qué puede y qué no?', xp: 15,
    items: [
      { s: 'Las IAs de video de 2024 pueden generar perfectamente cualquier texto escrito dentro del video.', correct: false, fb: 'FALSO. Las IAs de video tienen grandes dificultades generando texto legible dentro del video.' },
      { s: 'Una IA de video puede generar escenas con física perfectamente realista.', correct: false, fb: 'FALSO. La física es uno de los mayores desafíos. A veces el agua "flota" o las sombras no coinciden.' },
      { s: 'Es posible generar un video de 5 segundos con IA desde texto en menos de 2 minutos.', correct: true, fb: 'VERDADERO. Herramientas como Pika y Luma generan clips cortos en 1-3 minutos.' }
    ] },
  // 17 REFLEXIÓN
  { type: 'builder', title: 'El futuro del cine', xp: 15 },
  // 18 QUIZ
  { type: 'quiz', title: 'Quiz final de video', xp: 20,
    q: 'Tomás en Argentina quiere hacer un video corto para historia, animando imágenes de la época colonial. Presupuesto cero. ¿Mejor opción?',
    opts: ['Contratar una productora profesional', 'Usar Pika Labs o Luma (plan gratuito) para animar imágenes y CapCut AI para editar', 'Esperar 5 años hasta que sea gratuito', 'Solo es posible con Adobe Premiere'],
    correct: 1, fb: '¡Perfecto! Pika y Luma tienen planes gratuitos para proyectos escolares. CapCut también es gratuito.' },
  // 19 REFLEXIÓN FINAL
  { type: 'builder', title: 'Reflexión de cierre', xp: 15 },
  // 20 COMPLETION
  { type: 'completion', title: '¡Nivel completado!', xp: 0 }
];

const TOTAL_STEPS = MODULES.length;

interface LevelProps { navigation?: any; setAllowBack?: (allow: boolean) => void; }

export default function World3Level3({ navigation: propsNavigation, setAllowBack }: LevelProps) {
  const nav = useNavigation();
  const navigation = propsNavigation || nav;
  const completeLevel = useGameStore(s => s.completeLevel);

  const [current, setCurrent] = useState(0);
  const [xp, setXp] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);

  // Quiz
  const [quizSelected, setQuizSelected] = useState<number | null>(null);
  const [quizDone, setQuizDone] = useState(false);

  // Matching
  const [matchSel, setMatchSel] = useState<number | null>(null);
  const [matchedLeft, setMatchedLeft] = useState<Set<number>>(new Set());
  const [matchedRight, setMatchedRight] = useState<Set<number>>(new Set());
  const [rightOrder] = useState(() => {
    if (MODULES[2]?.pairs) {
      return MODULES[2].pairs.map(p => p.b).sort(() => Math.random() - 0.5);
    }
    return [];
  });

  // Builder
  const [builderText, setBuilderText] = useState('');
  const [builderDone, setBuilderDone] = useState(false);

  // VF / Classify
  const [vfAnswers, setVfAnswers] = useState<{ [key: number]: boolean | string }>({});
  const [vfLocked, setVfLocked] = useState<Set<number>>(new Set());

  // Sprint
  const [sprintRunning, setSprintRunning] = useState(false);
  const [sprintSec, setSprintSec] = useState(0);
  const [sprintText, setSprintText] = useState('');
  const [sprintDone, setSprintDone] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Drag drop
  const [ddPlaced, setDdPlaced] = useState<{ [key: number]: number }>({});
  const [ddSel, setDdSel] = useState<number | null>(null);
  const ddItems = MODULES[15]?.items || [];

  const theorySteps = new Set([0, 1, 4, 9, 13]);

  useEffect(() => { setAllowBack?.(theorySteps.has(current)); }, [current]);
  useEffect(() => {
    const h = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!theorySteps.has(current)) {
        Alert.alert('Actividad en curso', 'Completa la actividad antes de salir.');
        return true;
      }
      return false;
    });
    return () => h.remove();
  }, [current]);

  // Sprint timer
  useEffect(() => {
    if (!sprintRunning || sprintDone) return;
    if (sprintSec <= 0) {
      setSprintDone(true);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setTimeout(() => setSprintSec(s => s - 1), 1000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [sprintRunning, sprintSec, sprintDone]);

  const addXP = (v: number) => setXp(prev => prev + v);
  const nextModule = () => {
    if (current < MODULES.length - 1) {
      setCurrent(c => c + 1);
      resetActivityStates();
    }
  };
  const prevModule = () => {
    if (current > 0) {
      setCurrent(c => c - 1);
      resetActivityStates();
    }
  };

  const resetActivityStates = () => {
    setQuizSelected(null); setQuizDone(false);
    setMatchSel(null); setMatchedLeft(new Set()); setMatchedRight(new Set());
    setBuilderText(''); setBuilderDone(false);
    setVfAnswers({}); setVfLocked(new Set());
    setSprintRunning(false); setSprintSec(0); setSprintText(''); setSprintDone(false);
    if (timerRef.current) clearInterval(timerRef.current);
    setDdPlaced({}); setDdSel(null);
  };

  // Quiz
  const answerQuiz = (idx: number) => {
    if (quizDone) return;
    setQuizSelected(idx);
    setQuizDone(true);
    const m = MODULES[current];
    if (idx === m.correct) {
      setCorrectAnswers(c => c + 1);
      addXP(m.xp);
    }
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
        setCorrectAnswers(c => c + 1);
        addXP(m.xp);
        Alert.alert('✅', '¡Todos los pares conectados!');
      }
    } else {
      Alert.alert('❌', 'Ese no es el par correcto. Intenta de nuevo.');
      setMatchSel(null);
    }
  };

  // Builder
  const handleBuilderNext = () => {
    if (builderText.trim().length > 15 && !builderDone) {
      setBuilderDone(true);
      const m = MODULES[current];
      setCorrectAnswers(c => c + 1);
      addXP(m.xp);
    }
  };

  // VF / Classify
  const answerVF = (idx: number, answer: boolean | string) => {
    if (vfLocked.has(idx)) return;
    setVfLocked(prev => new Set(prev).add(idx));
    setVfAnswers(prev => ({ ...prev, [idx]: answer }));
    const m = MODULES[current];
    const items = m.items || [];
    if (vfLocked.size + 1 >= items.length) {
      setCorrectAnswers(c => c + 1);
      addXP(m.xp);
    }
  };

  // Sprint
  const startSprint = () => {
    const m = MODULES[current];
    setSprintRunning(true);
    setSprintSec(m.duration || 60);
    setSprintText('');
    setSprintDone(false);
  };
  const handleSprintNext = () => {
    if (sprintText.trim().length > 30) {
      setCorrectAnswers(c => c + 1);
    }
    addXP(MODULES[current].xp);
    nextModule();
  };

  // Drag drop
  const handleDdDrop = (zoneIdx: number) => {
    if (ddSel === null) return;
    setDdPlaced(prev => ({ ...prev, [ddSel]: zoneIdx }));
    setDdSel(null);
  };
  const removeDdItem = (itemIdx: number) => {
    setDdPlaced(prev => {
      const n = { ...prev };
      delete n[itemIdx];
      return n;
    });
  };
  const checkDrag = () => {
    const m = MODULES[current];
    let correct = true;
    m.items?.forEach((item, i) => {
      if (ddPlaced[i] !== parseInt(item.correct as string)) correct = false;
    });
    if (correct) {
      setCorrectAnswers(c => c + 1);
      addXP(m.xp);
      Alert.alert('✅', '¡Clasificación perfecta!');
    } else {
      Alert.alert('❌', 'Algunas clasificaciones no son correctas. Intenta de nuevo.');
    }
  };

  // Finish
  const finishLevel = () => {
    let stars = xp >= 200 ? 3 : xp >= 130 ? 2 : 1;
    completeLevel(15, stars, xp);
    router.back();
  };

  // ========== RENDER ==========
  const renderTheory = (m: ModuleData) => {
    const texts: Record<number, { title: string; body: string; info?: string }> = {
      0: { title: '¿Puede la IA hacer una película?', body: 'En 2023 OpenAI mostró Sora: una IA que genera videos de hasta un minuto con calidad cinematográfica. Perros jugando en la nieve, ciudades futuristas, océanos en tormenta — todo desde texto, sin cámaras ni actores.', info: '🎬 Sora (OpenAI) · 🎞️ Runway ML · 🎥 Pika Labs · 🇨🇳 Kling AI' },
      1: { title: 'Imágenes que se mueven: el secreto técnico', body: 'Un video es una secuencia de imágenes (24-60 por segundo). La IA debe crear cada fotograma y asegurar coherencia entre todos. Para un video de 5 segundos a 24fps, la IA genera 120 imágenes coherentes.', info: 'Por eso el video de IA es mucho más difícil que las imágenes estáticas.' },
      4: { title: 'Las marcas ya lo usan', body: 'Coca-Cola lanzó un comercial navideño con IA en 2024. Nike genera variaciones de comerciales para diferentes países. Hollywood usa IA para "concept videos" antes de filmar con actores reales.', info: 'Un comercial tradicional cuesta $200K-$2M USD. Una IA puede generar uno similar por unos pocos dólares.' },
      9: { title: 'De foto estática a video en segundos', body: 'Con Runway o Pika puedes: animar fotos familiares, convertir dibujos en animaciones, hacer que retratos "hablen". En Japón, museos usan IA para "animar" cuadros famosos.', info: 'El Museo del Prado en España experimenta con esto para conectar con audiencias jóvenes.' },
      13: { title: 'El problema del copyright en video de IA', body: '¿De quién es un video generado con IA? La IA no puede ser propietaria legal. El usuario depende de los términos de servicio. Muchas empresas reclaman derechos sobre lo generado en sus plataformas.', info: 'En 2023, el Sindicato de Actores de Hollywood hizo huelga por esto. ¡Los actores ganaron: ahora se requiere consentimiento y pago!' }
    };
    const t = texts[current] || { title: m.title, body: '' };
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.tag}>📖 {m.type === 'theory' && current === 0 ? 'Introducción' : current === 4 || current === 9 || current === 13 ? 'Casos reales' : 'Teoría'}</Text>
        <Text style={styles.title}>{t.title}</Text>
        <Text style={styles.body}>{t.body}</Text>
        {t.info && <View style={styles.infoBox}><Text style={styles.infoText}>{t.info}</Text></View>}
      </View>
    );
  };

  const renderQuiz = (m: ModuleData) => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>❓ Quiz</Text>
      <Text style={styles.title}>{m.title}</Text>
      <Text style={styles.quizQ}>{m.q}</Text>
      {m.opts!.map((o, i) => (
        <TouchableOpacity key={i} style={[styles.quizOpt, quizSelected === i && (i === m.correct ? styles.optCorrect : styles.optWrong)]}
          onPress={() => answerQuiz(i)} disabled={quizDone}>
          <Text style={quizSelected === i ? styles.optTextActive : styles.optText}>{['🅐', '🅑', '🅒', '🅓'][i]} {o}</Text>
        </TouchableOpacity>
      ))}
      {quizDone && <Text style={styles.feedback}>{quizSelected === m.correct ? '✅ ¡Correcto! ' : '❌ Casi. '}{m.fb}</Text>}
    </View>
  );

  const renderMatching = (m: ModuleData) => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>🔗 Matching</Text>
      <Text style={styles.title}>{m.title}</Text>
      <Text style={styles.subtitle}>Conecta cada herramienta con su descripción.</Text>
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

  const renderBuilder = (m: ModuleData) => {
    const placeholders: Record<number, string> = {
      3: 'Describe tu escena: personaje + acción + escenario + estilo + movimiento de cámara...',
      5: '¿Crees que un video creado con IA es arte verdadero? ¿Por qué?',
      12: 'Escribe tu guión de 30 segundos: escena + diálogo + estilo + música + mensaje...',
      17: '¿Cómo imaginas el cine y la televisión en 2035 con la IA de video?',
      19: '¿Qué proyecto harías con Sora? ¿Qué te sorprendió más? ¿El video de IA hace el mundo más interesante o peligroso?'
    };
    const examples: Record<number, string> = {
      3: 'Ej: "Una joven estudiante corriendo en cámara lenta por un mercado colorido de Lagos, luz cálida de atardecer, 8 segundos, estilo documental"',
      12: 'Ej: "Un niño en Cartagena ve un mural de mariposas que cobran vida. Estilo realista-mágico. Música de marimba."'
    };
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.tag}>✏️ {current === 5 || current === 17 || current === 19 ? 'Reflexión' : 'Constructor'}</Text>
        <Text style={styles.title}>{m.title}</Text>
        {examples[current] && <View style={styles.exampleBox}><Text style={styles.exampleText}>{examples[current]}</Text></View>}
        <TextInput style={styles.textArea} placeholder={placeholders[current] || 'Escribe aquí...'} value={builderText}
          onChangeText={setBuilderText} multiline editable={!builderDone} />
        {builderDone && <Text style={styles.feedback}>✅ ¡Respuesta registrada! +{m.xp} XP</Text>}
      </View>
    );
  };

  const renderVF = (m: ModuleData) => (
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

  const renderClassify = (m: ModuleData) => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>🔍 Detecta</Text>
      <Text style={styles.title}>{m.title}</Text>
      <Text style={styles.subtitle}>{m.instruction}</Text>
      {m.items!.map((item, i) => (
        <View key={i} style={styles.vfCard}>
          <Text style={styles.vfStmt}>{item.text}</Text>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.vfBtn, vfAnswers[i] === 'real' && styles.vfTrue, vfLocked.has(i) && item.correct === 'real' && styles.vfCorrect]}
              onPress={() => answerVF(i, 'real')} disabled={vfLocked.has(i)}>
              <Text>✅ Es señal real</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.vfBtn, vfAnswers[i] === 'falsa' && styles.vfFalse, vfLocked.has(i) && item.correct === 'falsa' && styles.vfCorrect]}
              onPress={() => answerVF(i, 'falsa')} disabled={vfLocked.has(i)}>
              <Text>❌ No es confiable</Text>
            </TouchableOpacity>
          </View>
          {vfLocked.has(i) && <Text style={styles.feedback}>{item.fb}</Text>}
        </View>
      ))}
    </View>
  );

  const renderSprint = (m: ModuleData) => (
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
          <View style={styles.sprintBox}>
            <Text style={styles.timer}>{Math.floor(sprintSec / 60)}:{String(sprintSec % 60).padStart(2, '0')}</Text>
          </View>
          <TextInput style={styles.textArea} placeholder={m.placeholder} value={sprintText} onChangeText={setSprintText} multiline />
          <TouchableOpacity style={styles.btnPrimary} onPress={handleSprintNext}><Text style={styles.btnText}>Entregar y continuar →</Text></TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity style={styles.btnPrimary} onPress={handleSprintNext}><Text style={styles.btnText}>Continuar →</Text></TouchableOpacity>
      )}
    </View>
  );

  const renderDragDrop = (m: ModuleData) => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>↕️ Clasifica</Text>
      <Text style={styles.title}>{m.title}</Text>
      <Text style={styles.subtitle}>{m.instruction}</Text>
      <View style={styles.chipWrap}>
        {ddItems.map((item, i) => ddPlaced[i] === undefined && (
          <TouchableOpacity key={i} style={[styles.chip, ddSel === i && styles.chipOn]}
            onPress={() => setDdSel(ddSel === i ? null : i)}>
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
                <Text style={styles.dropChip}>{ddItems[parseInt(k)].text} ✕</Text>
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
      <View style={styles.completeIcon}><Text style={styles.iconEmoji}>🎬</Text></View>
      <Text style={styles.completeTitle}>¡Badge desbloqueado!</Text>
      <View style={styles.badgeBox}><Text style={styles.badgeText}>🏅 Film Director</Text></View>
      <Text style={styles.completeSub}>¡Completaste el Nivel 15 y el Módulo 3! Ahora entiendes el mundo del video con IA.</Text>
      <Text style={styles.xpBig}>⭐ {xp} XP ganados</Text>
      <View style={styles.statsRow}>
        <View style={styles.statItem}><Text style={styles.statNum}>{correctAnswers}</Text><Text style={styles.statLbl}>Correctas</Text></View>
        <View style={styles.statItem}><Text style={styles.statNum}>20</Text><Text style={styles.statLbl}>Módulos</Text></View>
      </View>
      <TouchableOpacity style={styles.btnPrimary} onPress={finishLevel}><Text style={styles.btnText}>Volver al mapa</Text></TouchableOpacity>
    </View>
  );

  const renderModule = () => {
    const m = MODULES[current];
    const isTheory = theorySteps.has(current);
    const isCompletion = m.type === 'completion';

    return (
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {renderContent(m)}
        {!isCompletion && (
          <View style={styles.navRow}>
            <TouchableOpacity style={[styles.btnNav, !isTheory && styles.btnHidden]} onPress={prevModule} disabled={!isTheory}>
              <Text style={styles.btnNavText}>← Volver</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnPrimary} onPress={() => {
              if (m.type === 'builder' && !builderDone) handleBuilderNext();
              nextModule();
            }} disabled={m.type === 'builder' && builderText.trim().length <= 15 && !builderDone}>
              <Text style={styles.btnText}>Continuar →</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    );
  };

  const renderContent = (m: ModuleData) => {
    switch (m.type) {
      case 'theory': return renderTheory(m);
      case 'quiz': return renderQuiz(m);
      case 'matching': return renderMatching(m);
      case 'builder': return renderBuilder(m);
      case 'vf': return renderVF(m);
      case 'classify3ext': return renderClassify(m);
      case 'sprint': return renderSprint(m);
      case 'dragdrop': return renderDragDrop(m);
      case 'completion': return renderCompletion();
      default: return null;
    }
  };

  const progressPercent = (current / (TOTAL_STEPS - 1)) * 100;

  return (
    <View style={styles.screen}>
      <View style={styles.bar}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialIcons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.track}><View style={[styles.fill, { width: `${progressPercent}%` }]} /></View>
        <Text style={styles.xpChip}>{xp} XP</Text>
      </View>
      <Text style={styles.tag}>Nivel 15 · 21 módulos</Text>
      {renderModule()}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  bar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  track: { flex: 1, height: 6, backgroundColor: colors.borderLight, borderRadius: 3, marginHorizontal: 12 },
  fill: { height: '100%', backgroundColor: '#f59e0b', borderRadius: 3 },
  xpChip: { ...typography.bold, fontSize: 14, color: '#92400e' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  stepContainer: { flex: 1 },
  tag: { fontSize: 11, fontWeight: '600', color: '#92400e', backgroundColor: '#fef3c7', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 12 },
  title: { ...typography.extraBold, fontSize: 19, color: colors.textPrimary, marginBottom: 8, textAlign: 'center' },
  subtitle: { ...typography.regular, fontSize: 13, color: colors.textSecondary, marginBottom: 14, lineHeight: 18 },
  body: { ...typography.regular, fontSize: 13, color: colors.textPrimary, lineHeight: 22, marginBottom: 12 },
  infoBox: { backgroundColor: '#fffbeb', borderLeftWidth: 4, borderLeftColor: '#f59e0b', borderRadius: 4, padding: 14, marginVertical: 10 },
  infoText: { fontSize: 12, color: '#92400e', lineHeight: 20 },
  quizQ: { ...typography.bold, fontSize: 13, padding: 12, backgroundColor: '#f8fafc', borderRadius: 10, marginBottom: 10 },
  quizOpt: { padding: 14, borderRadius: 11, borderWidth: 2, borderColor: '#e2e8f0', marginBottom: 7, flexDirection: 'row', alignItems: 'center', gap: 10 },
  optText: { fontSize: 12, color: '#334155', flex: 1 },
  optTextActive: { fontSize: 12, color: '#0f172a', fontWeight: '600', flex: 1 },
  optCorrect: { borderColor: '#22c55e', backgroundColor: '#f0fdf4' },
  optWrong: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },
  feedback: { marginTop: 10, padding: 12, borderRadius: 10, fontSize: 12, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#22c55e', color: '#065f46' },
  matchRow: { flexDirection: 'row', gap: 10 },
  matchCard: { backgroundColor: '#fff', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 6 },
  matchCardSel: { borderColor: '#f59e0b', backgroundColor: '#fef3c7' },
  matchCardDone: { borderColor: '#22c55e', backgroundColor: '#f0fdf4' },
  matchText: { fontSize: 12, color: '#334155' },
  textArea: { borderWidth: 1.5, borderColor: '#f59e0b', borderRadius: 12, padding: 14, minHeight: 100, fontSize: 13, backgroundColor: '#fffbeb', marginBottom: 10, textAlignVertical: 'top' },
  exampleBox: { backgroundColor: '#fffbeb', borderLeftWidth: 3, borderLeftColor: '#fcd34d', borderRadius: 4, padding: 12, marginBottom: 10 },
  exampleText: { fontSize: 11, color: '#92400e', fontStyle: 'italic' },
  vfCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  vfStmt: { fontSize: 13, color: colors.textPrimary, marginBottom: 10, lineHeight: 20 },
  row: { flexDirection: 'row', gap: 10 },
  vfBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 2, borderColor: '#e2e8f0', alignItems: 'center' },
  vfTrue: { borderColor: '#22c55e', backgroundColor: '#f0fdf4' },
  vfFalse: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },
  vfCorrect: { borderColor: '#22c55e', backgroundColor: '#dcfce7' },
  sprintBox: { alignItems: 'center', backgroundColor: '#fffbeb', borderRadius: 16, padding: 20, marginBottom: 12, borderWidth: 2, borderColor: '#f59e0b' },
  sprintInstr: { fontSize: 12, color: '#92400e', textAlign: 'center', marginBottom: 8 },
  timer: { fontSize: 40, fontWeight: '800', color: '#f59e0b', marginVertical: 8 },
  btnPrimary: { backgroundColor: '#f59e0b', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  btnText: { ...typography.bold, color: '#fff', fontSize: 15 },
  btnSecondary: { backgroundColor: '#fff', padding: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', marginTop: 12 },
  btnSecondaryText: { ...typography.bold, color: '#92400e', fontSize: 14 },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, gap: 12 },
  btnNav: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  btnNavText: { fontSize: 14, color: '#64748b', fontWeight: '600' },
  btnHidden: { opacity: 0 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 12, backgroundColor: '#fffbeb', borderRadius: 12, borderWidth: 1, borderColor: '#fde68a', marginBottom: 12 },
  chip: { padding: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#fcd34d', backgroundColor: '#fff' },
  chipOn: { backgroundColor: '#fef3c7', borderColor: '#f59e0b' },
  chipText: { fontSize: 11, color: '#92400e' },
  zoneLabel: { ...typography.bold, fontSize: 12, color: '#92400e', marginBottom: 4, marginTop: 8 },
  dropZone: { minHeight: 50, borderWidth: 2, borderStyle: 'dashed', borderColor: '#fcd34d', borderRadius: 12, padding: 10, backgroundColor: '#fff', flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dropChip: { fontSize: 10, padding: 6, backgroundColor: '#fef3c7', borderRadius: 8, color: '#92400e' },
  completeContainer: { alignItems: 'center', padding: 20 },
  completeIcon: { width: 90, height: 90, borderRadius: 24, backgroundColor: '#fef3c7', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  iconEmoji: { fontSize: 44 },
  completeTitle: { ...typography.extraBold, fontSize: 22, marginBottom: 4 },
  badgeBox: { backgroundColor: '#fffbeb', borderWidth: 2, borderColor: '#f59e0b', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 12 },
  badgeText: { fontSize: 16, fontWeight: '700', color: '#92400e' },
  completeSub: { ...typography.regular, textAlign: 'center', marginVertical: 8, color: colors.textSecondary },
  xpBig: { ...typography.bold, fontSize: 20, color: '#92400e', marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 20, marginBottom: 16 },
  statItem: { backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  statNum: { fontSize: 22, fontWeight: '800', color: '#f59e0b' },
  statLbl: { fontSize: 11, color: '#64748b', marginTop: 2 },
});