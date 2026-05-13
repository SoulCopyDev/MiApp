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
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useGameStore } from '../../store/gameStore';
import { colors, typography } from '../../theme';

// ---------- Tipos ----------
type TFItem = { stmt: string; correct: boolean; explain: string };
type TipoItem = { text: string; correct: 'generador' | 'asistente' | 'automatizador' };
type QuizItem = { q: string; opts: string[]; correct: number; explain: string };
type ReadmeBlank = { id: string; opts: string[]; correct: number };
type ReadmeSection = { sentence: string; blanks: ReadmeBlank[]; explain: string };
type EthicsItem = { scenario: string; correct: 'safe' | 'doubt' | 'bad'; explain: string };
type Mission = { id: string; icon: string; name: string; desc: string };
type SprintItem = { stmt: string; correct: boolean };

// ---------- Constantes ----------
const TOTAL_STEPS = 19; // 0..18

// ---------- Pools de datos ----------
const VIABLE_TF_POOL: TFItem[] = [
  { stmt: 'Puedo usar un LLM para crear un asistente que responda preguntas frecuentes de mi colegio.', correct: true, explain: 'Proyecto concreto, audiencia definida, problema real.' },
  { stmt: 'Puedo pedirle a ChatGPT que construya una app completa de delivery como Rappi.', correct: false, explain: 'Una app así requiere equipos, meses de desarrollo y mucho más que un prompt.' },
  { stmt: 'Puedo usar Claude para que me ayude a crear el guion completo de un cortometraje.', correct: true, explain: 'Los LLMs son excelentes para contenido creativo estructurado.' },
  { stmt: 'Puedo usar un LLM para generar las respuestas de mis exámenes y entregarlas.', correct: false, explain: 'Éticamente problemático; los LLMs deben usarse para aprender, no para hacer trampa.' },
  { stmt: 'Puedo construir un generador de ideas para proyectos de ciencias basado en el temario.', correct: true, explain: 'Proyecto útil: das contexto y el LLM genera ideas variadas.' },
  { stmt: 'Puedo pedirle a un LLM que hackee la red wifi de mi vecino.', correct: false, explain: 'Actividad ilegal y los LLMs están diseñados para rechazar este tipo de solicitudes.' },
  { stmt: 'Puedo usar un LLM para crear un resumen diario personalizado de noticias sobre un tema.', correct: true, explain: 'Proyecto realista y práctico.' },
  { stmt: 'Puedo usar IA para predecir el mercado de acciones con 100% de precisión.', correct: false, explain: 'Imposible. Ningún sistema puede hacerlo con certeza.' },
];

const TIPO_POOL: TipoItem[] = [
  { text: 'Asistente de preguntas frecuentes del colegio', correct: 'asistente' },
  { text: 'Generador de ideas para proyectos de arte', correct: 'generador' },
  { text: 'Resumidor automático de noticias por tema', correct: 'automatizador' },
  { text: 'Chatbot que explica conceptos de física', correct: 'asistente' },
  { text: 'Creador de guiones para videos de YouTube', correct: 'generador' },
  { text: 'Sistema que convierte mis apuntes en flashcards', correct: 'automatizador' },
  { text: 'Tutor personalizado de matemáticas con preguntas adaptadas', correct: 'asistente' },
  { text: 'Generador de nombres creativos para un proyecto', correct: 'generador' },
  { text: 'Herramienta que clasifica y organiza mis tareas del día', correct: 'automatizador' },
];

const SORT_STEPS = [
  'Define el problema: ¿Qué problema concreto vas a resolver? ¿Para quién?',
  'Diseña el prompt base: Escribe el primer prompt que describe lo que necesitas al LLM',
  'Prueba y evalúa: Ejecuta el prompt real y revisa si el resultado es útil',
  'Itera y mejora: Ajusta el prompt según lo que falló o se puede mejorar',
  'Documenta y comparte: Escribe qué hiciste, cómo funciona y para qué sirve',
];

const ITER_QUIZ_POOL: QuizItem[] = [
  { q: 'El LLM da una respuesta muy larga y técnica. ¿Qué haces?', opts: ['Empezar de cero', 'Agregar: "responde en 3 oraciones simples"', 'Aceptarla tal cual', 'Preguntar al LLM si es buena'], correct: 1, explain: 'Agregar instrucciones de formato y audiencia es iterar inteligentemente.' },
  { q: 'Tu asistente da respuestas incorrectas sobre el horario del colegio. ¿Por qué?', opts: ['El LLM es defectuoso', 'Falta incluir el horario en el prompt', 'Los LLMs no pueden con horarios', 'Necesitas el plan premium'], correct: 1, explain: 'Los LLMs solo saben lo que les proporcionas. Incluye la información relevante.' },
  { q: '¿Cuántas veces iterar un prompt?', opts: ['Exactamente 3', 'Hasta que la respuesta sea útil para el usuario', 'Solo una vez', '5 veces según el estándar'], correct: 1, explain: 'No hay número mágico; se itera hasta lograr el objetivo.' },
  { q: 'Quieres hacer más específico un generador de ideas para tu colegio. ¿Cómo?', opts: ['No se puede', 'Agregar grado, materiales y plazos al prompt', 'Cambiar completamente de proyecto', 'Pedir más creatividad sin más contexto'], correct: 1, explain: 'El contexto específico (grado, recursos, tiempo) mejora enormemente los resultados.' },
];

const BUILD_QUIZ_POOL: QuizItem[] = [
  { q: '¿Primer paso para construir un proyecto con IA?', opts: ['Elegir el LLM más caro', 'Definir el problema y la audiencia', 'Escribir el código', 'Diseñar la interfaz'], correct: 1, explain: 'Siempre primero el problema, luego la solución.' },
  { q: '¿Qué es un "prompt base"?', opts: ['Código fuente del modelo', 'Prompt inicial que define el comportamiento del sistema', 'Interfaz gráfica', 'Nombre del proyecto'], correct: 1, explain: 'Define el rol, tono, alcance y restricciones del asistente.' },
  { q: '¿Por qué probar con usuarios reales?', opts: ['Para ganar popularidad', 'Porque hacen preguntas inesperadas que revelan fallos', 'Para aumentar seguidores', 'Requisito de los LLMs'], correct: 1, explain: 'Los usuarios reales descubren casos que no habías previsto, información muy valiosa.' },
  { q: '¿Qué incluye un README?', opts: ['Solo el nombre', 'Propósito, audiencia, instrucciones, tecnología y mejoras', 'Solo el código', 'Solo créditos'], correct: 1, explain: 'Un buen README permite a cualquiera entender tu proyecto en minutos.' },
  { q: 'El asistente falla en inglés. ¿Solución más directa?', opts: ['Cambiar de LLM', 'Agregar en el prompt: "Responde siempre en español"', 'Contratar un traductor', 'Publicar solo en español'], correct: 1, explain: 'Controlar el idioma desde el prompt base es simple y efectivo.' },
];

const README_SECTIONS: ReadmeSection[] = [
  { sentence: 'Mi proyecto se llama _____ y está diseñado para ayudar a _____.', blanks: [{ id: 'a', opts: ['Asistente de Estudio', 'Código malicioso', 'Virus', 'Hackeo'], correct: 0 }, { id: 'b', opts: ['estudiantes a estudiar mejor', 'hackear sistemas', 'robar contraseñas', 'engañar profesores'], correct: 0 }], explain: 'El nombre y la audiencia son esenciales.' },
  { sentence: 'Para usarlo, escribes tu pregunta y el modelo responde usando el _____ que le diste.', blanks: [{ id: 'c', opts: ['contexto', 'virus', 'token', 'deepfake'], correct: 0 }], explain: 'El contexto es la información que añades para que el modelo responda con precisión.' },
  { sentence: 'Este proyecto fue construido con _____ y puede mejorarse _____ el prompt.', blanks: [{ id: 'd', opts: ['un LLM', 'una impresora', 'una calculadora', 'un virus'], correct: 0 }, { id: 'e', opts: ['iterando', 'borrando', 'copiando', 'ignorando'], correct: 0 }], explain: 'Siempre menciona la herramienta y el proceso de mejora.' },
];

const ETHICS_POOL: EthicsItem[] = [
  { scenario: 'Publicas un asistente de preguntas frecuentes del colegio para estudiantes de 12-15 años.', correct: 'safe', explain: 'Educativo, audiencia clara, propósito definido.' },
  { scenario: 'Quieres hacer un generador de memes con fotos de compañeros sin permiso.', correct: 'bad', explain: 'Usar fotos de otros sin consentimiento para burlas viola su privacidad.' },
  { scenario: 'Tu asistente redirige a un profesor cuando no sabe la respuesta.', correct: 'safe', explain: 'Excelente práctica ética: reconocer límites y señalar a un humano.' },
  { scenario: 'Tu generador de noticias no filtra contenido violento o engañoso.', correct: 'doubt', explain: 'Dudoso. Para jóvenes, es necesario filtrar contenido inapropiado.' },
  { scenario: 'Quieres que el asistente recuerde nombres y notas de cada estudiante.', correct: 'doubt', explain: 'Recolectar datos personales de menores requiere consentimiento parental.' },
  { scenario: 'Incluyes un aviso: "Las ideas generadas deben ser revisadas por el usuario".', correct: 'safe', explain: 'Los disclaimers son una práctica ética estándar en IA generativa.' },
];

const SPRINT_PROJ: SprintItem[] = [
  { stmt: 'Probar con usuarios reales antes de publicar', correct: true },
  { stmt: 'Si el prompt funciona a la primera, no iterar', correct: false },
  { stmt: 'Un README explica qué hace y cómo usarlo', correct: true },
  { stmt: 'Usar fotos de compañeros sin permiso en un proyecto', correct: false },
  { stmt: 'Incluir contexto en el prompt mejora las respuestas', correct: true },
  { stmt: 'Un proyecto sin audiencia definida funciona mejor', correct: false },
  { stmt: 'Limitar el alcance de tu asistente es buena práctica', correct: true },
  { stmt: 'Si el LLM falla, siempre es culpa del modelo', correct: false },
  { stmt: 'Documentar ayuda a que otros entiendan y mejoren', correct: true },
  { stmt: 'Un generador sin filtros éticos es seguro para menores', correct: false },
  { stmt: 'Iterar significa ajustar según resultados reales', correct: true },
  { stmt: 'Es ético presentar trabajo 100% de IA como propio', correct: false },
];

const MISSIONS: Mission[] = [
  { id: 'study', icon: '📚', name: 'Asistente de Estudio', desc: 'Ayuda a estudiar explicando conceptos y haciendo preguntas de práctica.' },
  { id: 'ideas', icon: '💡', name: 'Generador de Ideas', desc: 'Genera ideas creativas para proyectos, tareas o eventos.' },
  { id: 'checklist', icon: '✅', name: 'Creador de Checklists', desc: 'Convierte cualquier objetivo en una lista de pasos accionables.' },
];

const BUILDER_OPTIONS = {
  tipo: ['Asistente de preguntas y respuestas', 'Generador de ideas creativas', 'Automatizador de tareas', 'Tutor personalizado', 'Creador de contenido'],
  audiencia: ['estudiantes de mi colegio', 'mi familia', 'emprendedores locales', 'profesores', 'cualquier persona'],
  modelo: ['Claude (textos largos)', 'ChatGPT (versatilidad)', 'Gemini (info actualizada)', 'cualquier LLM'],
  formato: ['respuestas cortas (3 oraciones)', 'lista de 5 puntos', 'texto conversacional', 'tabla comparativa', 'preguntas y respuestas'],
  etica: ['No dar consejos médicos/legales', 'No mencionar marcas', 'Redirigir a un humano si es sensible', 'Tono respetuoso y positivo'],
};

// Función para elegir N elementos aleatorios
const pickN = <T,>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};

// ---------- Componente principal ----------
interface Props {
  navigation?: any;
  setAllowBack?: (allow: boolean) => void;
}

export default function World1Level6({ navigation: propsNavigation, setAllowBack }: Props) {
  const hookNavigation = useNavigation();
  const navigation = propsNavigation || hookNavigation;

  const completeLevel = useGameStore((state) => state.completeLevel);

  // Estados globales del nivel
  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);

  // Pools aleatorias (se fijan al montar)
  const viableTF = useRef(pickN(VIABLE_TF_POOL, 5)).current;
  const tipoItems = useRef(pickN(TIPO_POOL, 7)).current;
  const iterQuiz = useRef(pickN(ITER_QUIZ_POOL, 4)).current;
  const buildQuiz = useRef(pickN(BUILD_QUIZ_POOL, 5)).current;
  const ethicsItems = useRef(pickN(ETHICS_POOL, 4)).current;
  const sprintItems = useRef(SPRINT_PROJ).current;

  // ----- Estados de actividades -----
  const [tfAnswers, setTfAnswers] = useState<{ [key: number]: boolean }>({});
  const [tfChecked, setTfChecked] = useState(false);

  const [tipoPlaced, setTipoPlaced] = useState<{ [key: number]: string }>({});
  const [tipoSelected, setTipoSelected] = useState<number | null>(null);

  const [sortOrder, setSortOrder] = useState<number[]>([0, 1, 2, 3, 4].sort(() => Math.random() - 0.5));

  const [builder, setBuilder] = useState({ tipo: '', audiencia: '', modelo: '', formato: '', etica: '' });

  const [iterAns, setIterAns] = useState<{ [key: number]: number }>({});
  const [iterChecked, setIterChecked] = useState(false);

  const [readmeAns, setReadmeAns] = useState<{ [key: string]: number }>({});
  const [readmeDone, setReadmeDone] = useState<Set<string>>(new Set());

  const [ethicsIdx, setEthicsIdx] = useState(0);
  const [ethicsFinished, setEthicsFinished] = useState(false);

  const [buildAns, setBuildAns] = useState<{ [key: number]: number }>({});
  const [buildChecked, setBuildChecked] = useState(false);

  const [missionSelected, setMissionSelected] = useState<number | null>(null);
  const [missionPhases, setMissionPhases] = useState({ a: '', b: '', c: '' });

  const [sprintRunning, setSprintRunning] = useState(false);
  const [sprintSec, setSprintSec] = useState(60);
  const [sprintIdx, setSprintIdx] = useState(0);
  const [sprintCorrectCount, setSprintCorrectCount] = useState(0);
  const [sprintOver, setSprintOver] = useState(false);

  const [reflectText, setReflectText] = useState('');

  // ----- Bloqueo de retroceso -----
  // Los pasos de teoría permiten volver, el resto no.
  const allowedBackSteps = new Set([0, 1, 3, 5, 7, 9, 11, 17]);
  const canGoBack = allowedBackSteps.has(step);

  useEffect(() => {
    setAllowBack?.(canGoBack);
  }, [canGoBack, setAllowBack]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack) {
        Alert.alert('Actividad en curso', 'No puedes salir mientras realizas esta actividad.', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Salir', style: 'destructive', onPress: () => router.back() },
        ]);
        return true;
      }
      return false;
    });
    return () => backHandler.remove();
  }, [canGoBack, navigation]);

  // Temporizador del sprint
  useEffect(() => {
    if (!sprintRunning || sprintOver) return;
    if (sprintSec <= 0) {
      setSprintOver(true);
      return;
    }
    const timer = setTimeout(() => setSprintSec((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [sprintRunning, sprintSec, sprintOver]);

  // ----- Helpers -----
  const addXP = (amount: number) => setXp((prev) => prev + amount);

  const nextStep = () => {
    if (step < TOTAL_STEPS - 1) setStep(step + 1);
  };

  const handleFinish = () => {
    let stars = 0;
    if (xp >= 200) stars = 3;
    else if (xp >= 130) stars = 2;
    else if (xp >= 60) stars = 1;
    completeLevel(1, 6, stars, xp);
    router.back();
  };

  const handleClose = () => {
    if (!canGoBack) {
      Alert.alert('Actividad en curso', 'Completa la actividad antes de salir.', [{ text: 'OK' }]);
      return;
    }
    Alert.alert('Salir', '¿Seguro que quieres salir del nivel?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', onPress: () => router.back() },
    ]);
  };

  // ----- Módulo 2: V/F Viable -----
  const checkTF = () => {
    setTfChecked(true);
    let correct = 0;
    viableTF.forEach((item, i) => {
      if (tfAnswers[i] === item.correct) correct++;
    });
    addXP(correct * 5);
  };

  // ----- Módulo 4: Clasificar tipo de proyecto -----
  const handleTipoDrop = (zone: string) => {
    if (tipoSelected === null) return;
    const item = tipoItems[tipoSelected];
    if (item.correct !== zone) {
      Alert.alert('Incorrecto', 'Ese proyecto no pertenece a esta categoría.');
      return;
    }
    setTipoPlaced((prev) => ({ ...prev, [tipoSelected]: zone }));
    setTipoSelected(null);
  };

  const removeTipoChip = (idx: number) => {
    setTipoPlaced((prev) => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
  };

  const checkTipo = () => {
    if (Object.keys(tipoPlaced).length < tipoItems.length) {
      Alert.alert('Faltan tarjetas', `Coloca todas las tarjetas (${tipoItems.length - Object.keys(tipoPlaced).length} restantes).`);
      return;
    }
    addXP(15);
    nextStep();
  };

  // ----- Módulo 5: Ordenar método -----
  const moveSort = (pos: number, dir: number) => {
    const newPos = pos + dir;
    if (newPos < 0 || newPos >= 5) return;
    const newOrder = [...sortOrder];
    [newOrder[pos], newOrder[newPos]] = [newOrder[newPos], newOrder[pos]];
    setSortOrder(newOrder);
  };

  const checkSort = () => {
    const correct = sortOrder.every((v, i) => v === i);
    if (correct) {
      addXP(15);
      nextStep();
    } else {
      Alert.alert('Incorrecto', 'Revisa el orden lógico de los pasos.');
    }
  };

  // ----- Módulo 7: Builder -----
  const builderComplete = Object.values(builder).every((v) => v.length > 0);
  const builderPrompt = builderComplete
    ? `Eres un ${builder.tipo.toLowerCase()} diseñado para ${builder.audiencia}.\nDebes actuar como herramienta útil, honesta y amigable.\nCuando el usuario pregunte, responde de forma útil.\nFormato: ${builder.formato}.\nRestricción ética: ${builder.etica}.`
    : '';

  const handleBuilderNext = () => {
    if (!builderComplete) return;
    addXP(15);
    nextStep();
  };

  // ----- Módulo 9: Quiz iteración -----
  const checkIterQuiz = () => {
    setIterChecked(true);
    let correct = 0;
    iterQuiz.forEach((q, i) => {
      if (iterAns[i] === q.correct) correct++;
    });
    addXP(correct * 8);
  };

  // ----- Módulo 11: README fill -----
  const selectReadme = (sectionIdx: number, blankIdx: number, optIdx: number) => {
    const key = `${sectionIdx}-${blankIdx}`;
    if (readmeDone.has(key)) return;
    setReadmeAns((prev) => ({ ...prev, [key]: optIdx }));
    setReadmeDone((prev) => new Set(prev).add(key));
    addXP(6);
  };

  const allReadmeDone = README_SECTIONS.reduce((acc, section) => acc + section.blanks.length, 0) === readmeDone.size;

  // ----- Módulo 12: Ethics -----
  const answerEthics = (val: string) => {
    const item = ethicsItems[ethicsIdx];
    const isOk = val === item.correct;
    Alert.alert(isOk ? '✅ Correcto' : '❌ Incorrecto', item.explain, [
      {
        text: 'OK',
        onPress: () => {
          if (ethicsIdx + 1 < ethicsItems.length) {
            setEthicsIdx((prev) => prev + 1);
          } else {
            setEthicsFinished(true);
            addXP(20);
            nextStep();
          }
        },
      },
    ]);
  };

  // ----- Módulo 13: Quiz construcción -----
  const checkBuildQuiz = () => {
    setBuildChecked(true);
    let correct = 0;
    buildQuiz.forEach((q, i) => {
      if (buildAns[i] === q.correct) correct++;
    });
    addXP(correct * 8);
  };

  // ----- Módulo 14: Mission Mode -----
  const missionValid = missionSelected !== null && missionPhases.a.trim().length >= 30 && missionPhases.b.trim().length >= 30 && missionPhases.c.trim().length >= 30;

  const submitMission = () => {
    if (!missionValid) return;
    addXP(25);
    nextStep();
  };

  // ----- Módulo 15: Sprint -----
  const startSprint = () => {
    setSprintRunning(true);
    setSprintSec(60);
    setSprintIdx(0);
    setSprintCorrectCount(0);
    setSprintOver(false);
  };

  const answerSprint = (val: boolean) => {
    if (sprintOver) return;
    const item = sprintItems[sprintIdx];
    if (val === item.correct) setSprintCorrectCount((c) => c + 1);
    if (sprintIdx + 1 < sprintItems.length) {
      setSprintIdx((prev) => prev + 1);
    } else {
      setSprintOver(true);
      addXP(sprintCorrectCount * 2);
    }
  };

  // ----- Módulo 16: Reflexión -----
  const handleReflect = () => {
    if (reflectText.trim().length >= 90) {
      addXP(15);
      nextStep();
    } else {
      Alert.alert('Muy corto', 'Escribe al menos 90 caracteres.');
    }
  };

  // ========== RENDERIZADO POR PASO ==========
  const renderStepContent = () => {
    switch (step) {
      // 0: Introducción
      case 0:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconEmoji}>🧪</Text>
            </View>
            <Text style={styles.title}>Tu primera misión real</Text>
            <Text style={styles.subtitle}>
              Ya tienes los fundamentos. Ahora vas a construir algo real.
            </Text>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🎯 El objetivo</Text>
              <Text style={styles.cardText}>
                Aprender el método para crear proyectos con LLMs: definir, diseñar, probar,
                iterar y documentar.
              </Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🆕 Mecánicas nuevas</Text>
              <Text style={styles.cardText}>
                Project Builder (ensambla un prompt real) y Mission Mode Pro (completa un
                proyecto en 3 fases).
              </Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>⭐ Hasta 260 XP</Text>
              <Text style={styles.cardText}>18 módulos · ~40-50 min</Text>
            </View>
      
            {/* BOTÓN PARA COMENZAR */}
            <TouchableOpacity style={styles.primaryBtn} onPress={nextStep}>
              <Text style={styles.primaryBtnText}>¡Comenzar misión! →</Text>
            </TouchableOpacity>
          </View>
        );
      // 1: ¿Qué es un proyecto con IA?
      case 1:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.tag}>📖 Módulo 1 · Proyectos con IA</Text>
            <Text style={styles.title}>¿Qué es un "proyecto con IA"?</Text>
            <Text style={styles.bodyText}>Es usar herramientas de IA —especialmente LLMs— para <Text style={styles.bold}>construir algo útil que resuelve un problema real</Text> para ti o para alguien más.</Text>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>✅ Qué SÍ es</Text>
              <Text style={styles.cardText}>Un asistente de dudas del colegio, un generador de ideas, una herramienta que convierte apuntes en resúmenes.</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>❌ Qué NO es (todavía)</Text>
              <Text style={styles.cardText}>Una app completa con pagos y millones de usuarios. Nos enfocamos en la parte de inteligencia: el prompt.</Text>
            </View>
          </View>
        );

      // 2: V/F Viable
      case 2:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.tag}>✅ Módulo 2 · ¿Viable o no?</Text>
            <Text style={styles.title}>¿Este proyecto es viable con IA?</Text>
            {viableTF.map((item, i) => (
              <View key={i} style={{ marginBottom: 16 }}>
                <Text style={styles.questionBox}>{i + 1}. {item.stmt}</Text>
                <View style={styles.row}>
                  <TouchableOpacity
                    style={[styles.tfButton, tfAnswers[i] === true && styles.tfTrue]}
                    onPress={() => setTfAnswers((prev) => ({ ...prev, [i]: true }))}
                    disabled={tfChecked}
                  >
                    <Text>✅ Sí</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tfButton, tfAnswers[i] === false && styles.tfFalse]}
                    onPress={() => setTfAnswers((prev) => ({ ...prev, [i]: false }))}
                    disabled={tfChecked}
                  >
                    <Text>❌ No</Text>
                  </TouchableOpacity>
                </View>
                {tfChecked && (
                  <Text style={tfAnswers[i] === item.correct ? styles.feedbackGood : styles.feedbackBad}>
                    {item.explain}
                  </Text>
                )}
              </View>
            ))}
            {!tfChecked ? (
              <TouchableOpacity style={styles.primaryBtn} onPress={checkTF}>
                <Text style={styles.primaryBtnText}>Comprobar respuestas</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.primaryBtn} onPress={nextStep}>
                <Text style={styles.primaryBtnText}>Continuar →</Text>
              </TouchableOpacity>
            )}
          </View>
        );

      // 3: 3 tipos de proyectos (teoría)
      case 3:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.tag}>📖 Módulo 3 · Tipos de proyectos</Text>
            <Text style={styles.title}>Los 3 tipos de proyectos con LLMs</Text>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>💡 Generador</Text>
              <Text style={styles.cardText}>Crea contenido nuevo: ideas, guiones, nombres, ejercicios.</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🤖 Asistente</Text>
              <Text style={styles.cardText}>Responde preguntas sobre un dominio específico usando contexto dado.</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>⚙️ Automatizador</Text>
              <Text style={styles.cardText}>Transforma texto: apuntes a flashcards, artículos a resúmenes.</Text>
            </View>
          </View>
        );

      // 4: Clasificar (drag)
      case 4:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.tag}>🧩 Módulo 4 · Clasificar</Text>
            <Text style={styles.title}>¿Qué tipo de proyecto es?</Text>
            <View style={styles.chipArea}>
              {tipoItems.map(
                (item, i) =>
                  tipoPlaced[i] === undefined && (
                    <TouchableOpacity
                      key={i}
                      style={[styles.chip, tipoSelected === i && styles.chipActive]}
                      onPress={() => setTipoSelected(tipoSelected === i ? null : i)}
                    >
                      <Text style={styles.chipText}>{item.text}</Text>
                    </TouchableOpacity>
                  )
              )}
            </View>
            <View style={styles.zoneRow}>
              {['generador', 'asistente', 'automatizador'].map((zone) => (
                <TouchableOpacity
                  key={zone}
                  style={styles.zone}
                  onPress={() => handleTipoDrop(zone)}
                >
                  <Text style={styles.zoneHeader}>{zone.charAt(0).toUpperCase() + zone.slice(1)}</Text>
                  <View style={styles.zoneContent}>
                    {Object.entries(tipoPlaced).map(
                      ([idx, z]) =>
                        z === zone && (
                          <TouchableOpacity
                            key={idx}
                            onPress={() => removeTipoChip(parseInt(idx))}
                            style={styles.placedChip}
                          >
                            <Text style={styles.placedChipText}>
                              {tipoItems[parseInt(idx)].text} ✕
                            </Text>
                          </TouchableOpacity>
                        )
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.primaryBtn} onPress={checkTipo}>
              <Text style={styles.primaryBtnText}>Verificar clasificación</Text>
            </TouchableOpacity>
          </View>
        );

      // 5: Método de 5 pasos (teoría)
      case 5:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.tag}>📖 Módulo 5 · El método</Text>
            <Text style={styles.title}>El método de 5 pasos</Text>
            {SORT_STEPS.map((stepText, i) => (
              <View key={i} style={styles.stepItem}>
                <View style={styles.stepNumCircle}>
                  <Text style={styles.stepNumText}>{i + 1}</Text>
                </View>
                <Text style={styles.stepText}>{stepText}</Text>
              </View>
            ))}
          </View>
        );

      // 6: Ordenar
      case 6:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.tag}>↕️ Módulo 6 · Ordenar</Text>
            <Text style={styles.title}>El método en orden</Text>
            {sortOrder.map((origIdx, pos) => (
              <View key={pos} style={styles.sortRow}>
                <Text style={styles.sortText}>{pos + 1}. {SORT_STEPS[origIdx]}</Text>
                <View style={styles.arrowColumn}>
                  <TouchableOpacity onPress={() => moveSort(pos, -1)} disabled={pos === 0}>
                    <MaterialIcons name="keyboard-arrow-up" size={20} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => moveSort(pos, 1)} disabled={pos === sortOrder.length - 1}>
                    <MaterialIcons name="keyboard-arrow-down" size={20} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            <TouchableOpacity style={styles.primaryBtn} onPress={checkSort}>
              <Text style={styles.primaryBtnText}>Verificar orden</Text>
            </TouchableOpacity>
          </View>
        );

      // 7: Teoría prompt de proyecto
      case 7:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.tag}>📖 Módulo 7 · Prompt de proyecto</Text>
            <Text style={styles.title}>El prompt que define tu proyecto</Text>
            <Text style={styles.bodyText}>Incluye: Rol, Propósito, Formato, Contexto y Restricciones éticas.</Text>
          </View>
        );

      // 8: Project Builder
      case 8:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.tag}>🆕 Módulo 8 · Project Builder</Text>
            <Text style={styles.title}>Construye tu prompt de proyecto</Text>
            {Object.entries(BUILDER_OPTIONS).map(([key, options]) => (
              <View key={key} style={{ marginBottom: 14 }}>
                <Text style={styles.builderLabel}>{key.toUpperCase()}</Text>
                <View style={styles.optionGrid}>
                  {options.map((opt, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.optionChip, builder[key as keyof typeof builder] === opt && styles.optionChipActive]}
                      onPress={() => setBuilder((prev) => ({ ...prev, [key]: opt }))}
                    >
                      <Text style={styles.optionChipText}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
            {builderComplete && (
              <View style={styles.codeBlock}>
                <Text style={styles.codeText}>{builderPrompt}</Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.primaryBtn, !builderComplete && styles.btnDisabled]}
              onPress={handleBuilderNext}
              disabled={!builderComplete}
            >
              <Text style={styles.primaryBtnText}>Continuar →</Text>
            </TouchableOpacity>
          </View>
        );

      // 9: Teoría iteración
      case 9:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.tag}>📖 Módulo 9 · Iterar</Text>
            <Text style={styles.title}>Iterar: el ciclo que marca la diferencia</Text>
            <Text style={styles.bodyText}>Probar → Evaluar → Ajustar → Volver a probar. Las primeras 3 iteraciones dan el 80% de mejoras.</Text>
          </View>
        );

      // 10: Quiz iteración
      case 10:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.tag}>❓ Módulo 10 · Quiz de iteración</Text>
            {iterQuiz.map((q, i) => (
              <View key={i} style={{ marginBottom: 18 }}>
                <Text style={styles.questionBox}>{i + 1}. {q.q}</Text>
                {q.opts.map((opt, j) => (
                  <TouchableOpacity
                    key={j}
                    style={[styles.quizOption, iterAns[i] === j && styles.quizOptionActive]}
                    onPress={() => setIterAns((prev) => ({ ...prev, [i]: j }))}
                    disabled={iterChecked}
                  >
                    <Text style={styles.quizOptionText}>{opt}</Text>
                  </TouchableOpacity>
                ))}
                {iterChecked && (
                  <Text style={iterAns[i] === q.correct ? styles.feedbackGood : styles.feedbackBad}>
                    {q.explain}
                  </Text>
                )}
              </View>
            ))}
            {!iterChecked ? (
              <TouchableOpacity style={styles.primaryBtn} onPress={checkIterQuiz}>
                <Text style={styles.primaryBtnText}>Comprobar respuestas</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.primaryBtn} onPress={nextStep}>
                <Text style={styles.primaryBtnText}>Continuar →</Text>
              </TouchableOpacity>
            )}
          </View>
        );

      // 11: Teoría README
      case 11:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.tag}>📖 Módulo 11 · README</Text>
            <Text style={styles.title}>El README de tu proyecto</Text>
            <Text style={styles.bodyText}>Incluye: nombre, propósito, instrucciones, tecnología y posibles mejoras.</Text>
          </View>
        );

      // 12: Completar README
      case 12:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.tag}>📄 Módulo 12 · Completa el README</Text>
            {README_SECTIONS.map((section, si) => (
              <View key={si} style={{ marginBottom: 20 }}>
                <Text style={styles.fillSentence}>{section.sentence}</Text>
                <View style={styles.fillOptionsRow}>
                  {section.blanks.map((blank, bi) => (
                    <View key={bi} style={styles.fillOptionsGroup}>
                      <Text style={styles.fillLabel}>Espacio {bi + 1}:</Text>
                      <View style={styles.optionGrid}>
                        {blank.opts.map((opt, oi) => {
                          const key = `${si}-${bi}`;
                          const isSelected = readmeAns[key] === oi;
                          return (
                            <TouchableOpacity
                              key={oi}
                              style={[styles.optionChip, isSelected && styles.optionChipActive]}
                              onPress={() => selectReadme(si, bi, oi)}
                              disabled={readmeDone.has(key)}
                            >
                              <Text style={styles.optionChipText}>{opt}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  ))}
                </View>
                {readmeDone.has(`${si}-0`) && (
                  <Text style={styles.feedbackGood}>{section.explain}</Text>
                )}
              </View>
            ))}
            <TouchableOpacity
              style={[styles.primaryBtn, !allReadmeDone && styles.btnDisabled]}
              onPress={nextStep}
              disabled={!allReadmeDone}
            >
              <Text style={styles.primaryBtnText}>Continuar →</Text>
            </TouchableOpacity>
          </View>
        );

      // 13: Ethics check
      case 13:
        if (ethicsFinished) {
          return (
            <View style={styles.stepContainer}>
              <Text style={styles.title}>✅ Ética completada</Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={nextStep}>
                <Text style={styles.primaryBtnText}>Continuar →</Text>
              </TouchableOpacity>
            </View>
          );
        }
        const currentEthic = ethicsItems[ethicsIdx];
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.tag}>⚖️ Módulo 13 · Ethics Check</Text>
            <Text style={styles.title}>¿Tu proyecto pasa el filtro ético?</Text>
            <Text style={styles.questionBox}>{currentEthic.scenario}</Text>
            <View style={styles.row}>
              <TouchableOpacity style={styles.ethButton} onPress={() => answerEthics('safe')}>
                <Text>✅ Seguro</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ethButton} onPress={() => answerEthics('doubt')}>
                <Text>🤔 Revisar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ethButton} onPress={() => answerEthics('bad')}>
                <Text>⛔ No publicar</Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      // 14: Quiz construcción
      case 14:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.tag}>❓ Módulo 14 · Quiz de construcción</Text>
            {buildQuiz.map((q, i) => (
              <View key={i} style={{ marginBottom: 18 }}>
                <Text style={styles.questionBox}>{i + 1}. {q.q}</Text>
                {q.opts.map((opt, j) => (
                  <TouchableOpacity
                    key={j}
                    style={[styles.quizOption, buildAns[i] === j && styles.quizOptionActive]}
                    onPress={() => setBuildAns((prev) => ({ ...prev, [i]: j }))}
                    disabled={buildChecked}
                  >
                    <Text style={styles.quizOptionText}>{opt}</Text>
                  </TouchableOpacity>
                ))}
                {buildChecked && (
                  <Text style={buildAns[i] === q.correct ? styles.feedbackGood : styles.feedbackBad}>
                    {q.explain}
                  </Text>
                )}
              </View>
            ))}
            {!buildChecked ? (
              <TouchableOpacity style={styles.primaryBtn} onPress={checkBuildQuiz}>
                <Text style={styles.primaryBtnText}>Comprobar respuestas</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.primaryBtn} onPress={nextStep}>
                <Text style={styles.primaryBtnText}>Continuar →</Text>
              </TouchableOpacity>
            )}
          </View>
        );

      // 15: Mission Mode Pro
      case 15:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.tag}>🆕 Módulo 15 · Mission Mode Pro</Text>
            <Text style={styles.title}>Elige tu misión</Text>
            <View style={styles.missionCards}>
              {MISSIONS.map((m, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.missionCard, missionSelected === i && styles.missionCardActive]}
                  onPress={() => setMissionSelected(i)}
                >
                  <Text style={styles.missionIcon}>{m.icon}</Text>
                  <View style={styles.missionInfo}>
                    <Text style={styles.missionName}>{m.name}</Text>
                    <Text style={styles.missionDesc}>{m.desc}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            {missionSelected !== null && (
              <>
                <Text style={styles.phaseTitle}>Fase 1: Define el problema</Text>
                <TextInput
                  style={styles.textArea}
                  placeholder="Describe el problema que resuelve tu proyecto..."
                  value={missionPhases.a}
                  onChangeText={(t) => setMissionPhases((p) => ({ ...p, a: t }))}
                  multiline
                />
                <Text style={styles.phaseTitle}>Fase 2: Escribe el prompt base</Text>
                <TextInput
                  style={styles.textArea}
                  placeholder="Prompt que le darías al LLM..."
                  value={missionPhases.b}
                  onChangeText={(t) => setMissionPhases((p) => ({ ...p, b: t }))}
                  multiline
                />
                <Text style={styles.phaseTitle}>Fase 3: Evalúa el resultado</Text>
                <TextInput
                  style={styles.textArea}
                  placeholder="¿Qué funcionaría bien y qué mejorarías?"
                  value={missionPhases.c}
                  onChangeText={(t) => setMissionPhases((p) => ({ ...p, c: t }))}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.primaryBtn, !missionValid && styles.btnDisabled]}
                  onPress={submitMission}
                  disabled={!missionValid}
                >
                  <Text style={styles.primaryBtnText}>Completar misión ✨</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        );

      // 16: Sprint
      case 16:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.tag}>⚡ Módulo 16 · Sprint</Text>
            <Text style={styles.title}>Sprint: ¿Buena o mala práctica?</Text>
            {!sprintRunning && !sprintOver ? (
              <TouchableOpacity style={styles.primaryBtn} onPress={startSprint}>
                <Text style={styles.primaryBtnText}>Empezar Sprint ⚡</Text>
              </TouchableOpacity>
            ) : sprintOver ? (
              <TouchableOpacity style={styles.primaryBtn} onPress={nextStep}>
                <Text style={styles.primaryBtnText}>Continuar →</Text>
              </TouchableOpacity>
            ) : (
              <>
                <Text style={styles.timer}>{sprintSec}s</Text>
                <Text style={styles.questionBox}>{sprintItems[sprintIdx].stmt}</Text>
                <View style={styles.row}>
                  <TouchableOpacity style={styles.tfButton} onPress={() => answerSprint(true)}>
                    <Text>✅ Verdadero</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.tfButton} onPress={() => answerSprint(false)}>
                    <Text>❌ Falso</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        );

      // 17: Reflexión
      case 17:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.tag}>✍️ Módulo 17 · Reflexión final</Text>
            <Text style={styles.title}>Tu proyecto soñado</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Describe el proyecto con IA que te gustaría construir..."
              value={reflectText}
              onChangeText={setReflectText}
              multiline
            />
            <Text style={styles.charCount}>{reflectText.trim().length} / 90 mínimo</Text>
            <TouchableOpacity
              style={[styles.primaryBtn, reflectText.trim().length < 90 && styles.btnDisabled]}
              onPress={handleReflect}
              disabled={reflectText.trim().length < 90}
            >
              <Text style={styles.primaryBtnText}>Enviar reflexión →</Text>
            </TouchableOpacity>
          </View>
        );

      // 18: Finalización
      case 18:
        return (
          <View style={styles.completeContainer}>
            <View style={styles.completeBadgeCircle}>
              <Text style={styles.completeBadgeIcon}>🧪</Text>
            </View>
            <Text style={styles.completeTitle}>¡Nivel 6 completado!</Text>
            <Text style={styles.completeSub}>Tu primera misión real está cumplida. Ya sabes construir proyectos con IA.</Text>
            <Text style={styles.xpEarned}>⭐ {xp} XP ganados</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleFinish}>
              <Text style={styles.primaryBtnText}>Volver al mapa</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  const progressPercent = (step / (TOTAL_STEPS - 1)) * 100;

  // Botón "Continuar" solo en pasos de teoría (los que permiten retroceso)
  const showNextButton = allowedBackSteps.has(step) && step !== 0 && step !== 18;

  return (
    <View style={styles.screen}>
      {/* Barra de progreso */}
      <View style={styles.progressBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <MaterialIcons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>
        <Text style={styles.xpCounter}>{xp} XP</Text>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {renderStepContent()}
      </ScrollView>

      {showNextButton && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.nextBtn} onPress={nextStep}>
            <Text style={styles.nextBtnText}>Continuar →</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ---------- Estilos ----------
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  progressBar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  closeBtn: { padding: 4 },
  progressTrack: { flex: 1, height: 6, backgroundColor: colors.borderLight, borderRadius: 3, marginHorizontal: 10 },
  progressFill: { height: '100%', backgroundColor: colors.success, borderRadius: 3 },
  xpCounter: { ...typography.bold, fontSize: 14, color: colors.accentDark },
  body: { flex: 1 },
  bodyContent: { padding: 16, paddingBottom: 30 },
  stepContainer: { flex: 1 },
  iconCircle: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#fef3c7', justifyContent: 'center', alignItems: 'center', marginBottom: 14, alignSelf: 'center' },
  iconEmoji: { fontSize: 32 },
  tag: { fontSize: 11, fontWeight: '600', color: '#92400e', backgroundColor: '#fef3c7', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, alignSelf: 'flex-start', marginBottom: 10 },
  title: { ...typography.extraBold, fontSize: 19, color: colors.textPrimary, marginBottom: 8, textAlign: 'center' },
  subtitle: { ...typography.regular, fontSize: 14, color: colors.textSecondary, marginBottom: 16, textAlign: 'center', lineHeight: 20 },
  bodyText: { ...typography.regular, fontSize: 14, color: colors.textPrimary, lineHeight: 22, marginBottom: 12 },
  bold: { fontWeight: '700' },
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  cardTitle: { ...typography.bold, fontSize: 14, color: colors.textPrimary, marginBottom: 6 },
  cardText: { ...typography.regular, fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
  questionBox: { ...typography.bold, fontSize: 13, backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  row: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  tfButton: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  tfTrue: { backgroundColor: '#dcfce7', borderColor: '#10b981' },
  tfFalse: { backgroundColor: '#fff1f2', borderColor: '#ef4444' },
  feedbackGood: { color: '#065f46', fontSize: 12, marginTop: 4 },
  feedbackBad: { color: '#991b1b', fontSize: 12, marginTop: 4 },
  primaryBtn: { backgroundColor: colors.success, padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  primaryBtnText: { ...typography.bold, color: '#fff', fontSize: 15 },
  btnDisabled: { opacity: 0.4 },
  chipArea: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 10, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff' },
  chipActive: { borderColor: '#f59e0b', backgroundColor: '#fef3c7' },
  chipText: { fontSize: 12, color: '#334155' },
  zoneRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  zone: { flex: 1, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 8, minHeight: 100, backgroundColor: '#fafafa' },
  zoneHeader: { fontWeight: '700', fontSize: 12, textAlign: 'center', marginBottom: 6 },
  zoneContent: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  placedChip: { backgroundColor: '#dbeafe', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  placedChipText: { fontSize: 11, color: '#1e40af' },
  stepItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  stepNumCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.success, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  stepNumText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  stepText: { flex: 1, ...typography.regular, fontSize: 13, color: colors.textPrimary },
  sortRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 8 },
  sortText: { flex: 1, fontSize: 12, color: '#334155' },
  arrowColumn: { flexDirection: 'column' },
  builderLabel: { ...typography.bold, fontSize: 12, color: '#92400e', marginBottom: 4, marginTop: 10 },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  optionChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#cbd5e1' },
  optionChipActive: { backgroundColor: '#fef3c7', borderColor: '#f59e0b' },
  optionChipText: { fontSize: 12, color: '#334155' },
  codeBlock: { backgroundColor: '#1e1e1e', padding: 12, borderRadius: 10, marginTop: 10 },
  codeText: { color: '#d4d4d4', fontFamily: 'monospace', fontSize: 12 },
  quizOption: { padding: 12, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, marginBottom: 6 },
  quizOptionActive: { borderColor: '#f59e0b', backgroundColor: '#fef3c7' },
  quizOptionText: { fontSize: 12, color: '#334155' },
  fillSentence: { ...typography.bold, fontSize: 13, padding: 12, backgroundColor: '#fffbeb', borderRadius: 8, borderWidth: 1, borderColor: '#fde68a', marginBottom: 8 },
  fillOptionsRow: { marginBottom: 8 },
  fillOptionsGroup: { marginBottom: 8 },
  fillLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  ethButton: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center' },
  missionCards: { marginBottom: 16 },
  missionCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 10, backgroundColor: '#fff' },
  missionCardActive: { borderColor: '#f59e0b', backgroundColor: '#fffbeb' },
  missionIcon: { fontSize: 28, marginRight: 12 },
  missionInfo: { flex: 1 },
  missionName: { ...typography.bold, fontSize: 14, marginBottom: 4 },
  missionDesc: { fontSize: 12, color: '#64748b' },
  phaseTitle: { ...typography.bold, fontSize: 13, marginTop: 12, marginBottom: 6 },
  textArea: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 12, minHeight: 80, fontSize: 13, backgroundColor: '#fafafa', marginBottom: 10, textAlignVertical: 'top' },
  timer: { fontSize: 36, fontWeight: '800', textAlign: 'center', color: '#d97706', marginBottom: 10 },
  charCount: { fontSize: 11, color: '#94a3b8', textAlign: 'right', marginTop: 4 },
  completeContainer: { alignItems: 'center', paddingVertical: 30 },
  completeBadgeCircle: { width: 86, height: 86, borderRadius: 24, backgroundColor: '#fde68a', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  completeBadgeIcon: { fontSize: 44 },
  completeTitle: { ...typography.extraBold, fontSize: 22, marginBottom: 8 },
  completeSub: { ...typography.regular, fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 16, paddingHorizontal: 10 },
  xpEarned: { ...typography.bold, fontSize: 18, color: colors.accentDark, marginBottom: 20 },
  footer: { paddingHorizontal: 16, paddingBottom: 16 },
  nextBtn: { backgroundColor: colors.success, padding: 14, borderRadius: 12, alignItems: 'center' },
  nextBtnText: { ...typography.bold, color: '#fff', fontSize: 15 },
});