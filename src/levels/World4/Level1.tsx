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
type MatchPair = { left: string; right: string };
type TFItem = { stmt: string; correct: boolean; explain: string };
type QuizItem = { q: string; opts: string[]; correct: number; explain: string };
type FillItem = { sentence: string; allOpts: string[]; correct: number; explain: string };
type DetectiveItem = { task: string; respA: { text: string; hint: string }; respB: { text: string; hint: string }; cual4o: string; explain: string };
type EthicsItem = { scenario: string; correct: string; explain: string };
type SesionStep = { label: string; q: string; opts: string[]; correct: number; fb_ok: string; fb_no: string };
type DragItemN19 = { text: string; correct: string };

// ---------- Datos ----------
const MATCH_POOL: MatchPair[] = [
  { left: 'Crear una imagen desde cero con palabras', right: 'DALL-E (generador de imágenes)' },
  { left: 'Hablarle con voz y escuchar su respuesta', right: 'Modo de voz de ChatGPT' },
  { left: 'Un ChatGPT especial solo para matemáticas', right: 'GPTs personalizados' },
  { left: 'Subir un PDF y hacerle preguntas', right: 'Analizar archivos y documentos' },
  { left: 'Pedirle que programe una app sencilla', right: 'ChatGPT escribiendo código' }
];

const SORT_SESION = [
  'Abre ChatGPT y empieza una conversación nueva',
  'Define tu objetivo: "quiero estudiar las capitales de Europa para mi examen del viernes"',
  'Pide el plan: "hazme un plan de 3 días con actividades divertidas cada día"',
  'Elige lo que más te gusta del plan y pide que lo desarrolle en detalle',
  'Practica con preguntas: "hazme un quiz de 10 preguntas de menor a mayor dificultad"',
  'Termina con resumen: "resume en 5 puntos lo más importante que estudié hoy"'
];

const TF_POOL: TFItem[] = [
  { stmt: 'ChatGPT puede buscar noticias de hoy en internet sin ninguna configuración extra.', correct: false, explain: 'Mito! La versión básica no busca en internet. Para noticias de hoy, usa Google o Gemini.' },
  { stmt: 'Puedes subir fotos a ChatGPT y pedirle que las describa o analice.', correct: true, explain: 'Verdad! Con GPT-4o puedes subir imágenes. ChatGPT puede explicar lo que ve.' },
  { stmt: 'ChatGPT recuerda todo lo que hablaste en conversaciones de días anteriores.', correct: false, explain: 'Mito! Cada conversación nueva empieza desde cero.' },
  { stmt: 'Los GPTs personalizados son versiones de ChatGPT entrenadas para temas específicos.', correct: true, explain: 'Verdad! Los GPTs son como apps dentro de ChatGPT.' },
  { stmt: 'GPT-4o es exactamente igual que GPT-3.5, solo con diferente nombre.', correct: false, explain: 'Mito! GPT-4o puede ver imágenes, usar voz, generar imágenes y razona mucho mejor.' },
  { stmt: 'DALL-E es la herramienta de ChatGPT para generar imágenes desde texto.', correct: true, explain: 'Verdad! Describes lo que quieres ver y DALL-E crea la imagen.' },
  { stmt: 'Si ChatGPT te da una estadística, siempre es correcta y no necesitas verificar.', correct: false, explain: 'Cuidado! ChatGPT puede alucinar e inventar datos.' },
  { stmt: 'Puedes usar ChatGPT para practicar un idioma nuevo conversando con él.', correct: true, explain: 'Verdad! Uno de sus mejores usos.' },
  { stmt: 'ChatGPT puede escribir código de programación y explicar cómo funciona.', correct: true, explain: 'Verdad! Puedes pedirle que escriba código en Python.' },
  { stmt: 'Copiar la respuesta de ChatGPT y entregarla como tu tarea es una buena forma de aprender.', correct: false, explain: 'Mito peligroso! Copiar no es aprender.' }
];

const DETECTIVE_POOL: DetectiveItem[] = [
  { task: 'Le preguntaron: ¿Qué es la fotosíntesis?',
    respA: { text: 'La fotosíntesis es el proceso por el cual las plantas convierten luz solar en energía... Es como si las plantas tuvieran una fábrica solar dentro de cada hoja.', hint: 'Usa metáforas y lenguaje accesible' },
    respB: { text: 'La fotosíntesis es un proceso bioquímico en los cloroplastos. Ecuación: 6CO2 + 6H2O + luz → C6H12O6 + 6O2.', hint: 'Respuesta técnica y formal' },
    cual4o: 'A', explain: 'La A es GPT-4o: usa analogías y lenguaje claro. La B es correcta pero muy técnica.' },
  { task: 'Le pidieron: Ayúdame a planear mis vacaciones en Brasil',
    respA: { text: 'Para tus vacaciones en Brasil considera: 1) Destino: playa o naturaleza? 2) Época: evita enero-marzo en Río por lluvias. 3) Presupuesto... ¿Cuántos días tienes?', hint: 'Hace preguntas personalizadas' },
    respB: { text: 'Brasil es un país hermoso. Río tiene el Cristo Redentor. São Paulo es la ciudad más grande. El Amazonas es la selva más grande.', hint: 'Información genérica' },
    cual4o: 'A', explain: 'La A es GPT-4o: da consejos específicos y hace preguntas. La B es genérica.' },
  { task: 'Le preguntaron: ¿Por qué el cielo es azul?',
    respA: { text: 'El cielo es azul porque el aire dispersa la luz azul más que otros colores... Por eso al atardecer el cielo es naranja.', hint: 'Conecta con el atardecer también' },
    respB: { text: 'El cielo es azul por la dispersión de Rayleigh. Las moléculas de gas dispersan longitudes de onda cortas (azul) más que las largas (rojo).', hint: 'Explicación correcta pero básica' },
    cual4o: 'A', explain: 'La A es GPT-4o: anticipa la pregunta del atardecer y usa analogía.' }
];

const QUIZ_POOL: QuizItem[] = [
  { q: 'Yuki, 11 años, de Tokio quiere aprender inglés con ChatGPT. ¿Cuál es el mejor prompt?',
    opts: ['Enséñame inglés', 'Eres un profesor de inglés paciente y divertido para niños de 11 años. Hablemos sobre videojuegos y corrígeme si me equivoco.', 'Tradúceme palabras', 'Dame lecciones de inglés'],
    correct: 1, explain: 'El segundo usa identidad y contexto específico. ChatGPT sabe exactamente cómo ayudar.' },
  { q: 'Sofía, 10 años, de Madrid tiene tarea de historia. ¿Qué NO debe hacer?',
    opts: ['Pedirle que explique el tema con ejemplos', 'Pedirle preguntas de práctica', 'Copiar la respuesta completa y entregarla como su tarea', 'Pedirle que simplifique un texto'],
    correct: 2, explain: 'Copiar es trampa. ChatGPT debe ser el profe que te guía, no el que hace la tarea.' },
  { q: 'Lucas, 12 años, de Buenos Aires quiere crear una imagen de un dinosaurio. ¿Qué herramienta usa?',
    opts: ['El modo de voz', 'DALL-E, el generador de imágenes de ChatGPT', 'Los GPTs personalizados', 'La función de código'],
    correct: 1, explain: 'DALL-E convierte texto en imágenes. Solo funciona con GPT-4o.' },
  { q: '¿Para qué sirven los GPTs personalizados de ChatGPT?',
    opts: ['Para hacer ChatGPT más rápido', 'Para tener versiones entrenadas en temas específicos', 'Para guardar conversaciones', 'Para traducir mejor'],
    correct: 1, explain: 'Los GPTs son como apps dentro de ChatGPT especializadas en temas concretos.' },
  { q: 'Amara, 11 años, de Ghana quiere practicar matemáticas. ¿Cuál prompt es mejor?',
    opts: ['Ayúdame con mates', 'Hazme 5 problemas de multiplicación de fracciones para 5to grado. Cuando me equivoque, dame una pista.', 'Explícame matemáticas', 'Quiero aprender matemáticas'],
    correct: 1, explain: 'Especifica tema, nivel, cantidad y cómo quiere la ayuda. Cuanto más específico, mejor.' },
  { q: 'ChatGPT dice que un personaje histórico dijo una frase famosa. ¿Qué debes hacer?',
    opts: ['Publicarlo de inmediato', 'Creérselo porque ChatGPT siempre tiene razón', 'Buscar la cita en una fuente confiable para verificarla', 'Pedirle más citas'],
    correct: 2, explain: 'Siempre verifica! ChatGPT puede alucinar e inventar citas.' },
  { q: '¿Qué ventaja tiene GPT-4o sobre GPT-3.5?',
    opts: ['Es completamente gratis siempre', 'Puede ver imágenes, razona mejor y tiene acceso a DALL-E', 'Recuerda todas tus conversaciones', 'Nunca se equivoca'],
    correct: 1, explain: 'GPT-4o puede ver imágenes, generar con DALL-E y razona mejor.' },
  { q: 'Kai, 10 años, quiere un juego de preguntas sobre animales. ¿Cuál prompt es mejor?',
    opts: ['Preguntas de animales', 'Hazme un juego de 10 preguntas sobre animales salvajes de África para niños de 10 años. Incluye 4 opciones y respuesta.', 'Dame información', 'Animales África'],
    correct: 1, explain: 'Especifica tipo, tema, audiencia, cantidad y formato.' }
];

const FILL_POOL: FillItem[] = [
  { sentence: 'La herramienta de ChatGPT que convierte texto en imágenes se llama _____.', allOpts: ['DALL-E', 'Google', 'Bing', 'Stable'], correct: 0, explain: 'DALL-E es la herramienta de OpenAI para generar imágenes.' },
  { sentence: 'Los _____ son versiones de ChatGPT entrenadas para tareas específicas.', allOpts: ['GPTs', 'Bots', 'Apps', 'Modos'], correct: 0, explain: 'GPTs son como apps dentro de ChatGPT.' },
  { sentence: 'Cuando ChatGPT inventa información falsa con total confianza, se llama _____.', allOpts: ['alucinación', 'error', 'bug', 'trampa'], correct: 0, explain: '"Alucinación" es el término técnico.' },
  { sentence: 'La versión más avanzada de ChatGPT actualmente se llama GPT-_____.', allOpts: ['4o', '3.5', '5', 'Ultra'], correct: 0, explain: 'GPT-4o (o de omni) puede procesar texto, imágenes y voz.' },
  { sentence: 'La empresa que creó ChatGPT se llama _____.', allOpts: ['OpenAI', 'Google', 'Microsoft', 'Apple'], correct: 0, explain: 'OpenAI fundó ChatGPT en 2022.' },
  { sentence: 'Para que ChatGPT responda como un experto, le das una _____ como "eres un profe de física divertido".', allOpts: ['identidad', 'contraseña', 'imagen', 'canción'], correct: 0, explain: 'Darle una identidad específica cambia completamente su forma de responder.' }
];

const ETHICS_POOL: EthicsItem[] = [
  { scenario: 'Emma, 11 años, le pide a ChatGPT que explique la Revolución Francesa como una historia de superhéroes.', correct: 'safe', explain: 'Uso perfecto! Pedir explicaciones creativas ayuda a entender temas difíciles.' },
  { scenario: 'Ryo, 12 años, usa ChatGPT para que le escriba su ensayo completo y lo entrega como suyo.', correct: 'bad', explain: 'Trampa académica. Lo correcto es pedirle que explique y ayude a organizar ideas.' },
  { scenario: 'Valentina, 10 años, le pregunta a ChatGPT si un hongo que encontró es venenoso para decidir si se lo come.', correct: 'bad', explain: 'Peligroso! Para temas de salud, siempre consulta a un adulto real.' },
  { scenario: 'Oliver, 11 años, usa ChatGPT para practicar conversación en español y pide que corrija sus errores.', correct: 'safe', explain: 'Uso excelente! Practicar idiomas con ChatGPT es uno de sus mejores usos.' },
  { scenario: 'Priya, 12 años, le pide a ChatGPT su contraseña del correo porque la olvidó.', correct: 'bad', explain: 'ChatGPT no puede recuperar contraseñas. Nunca compartas contraseñas con ninguna app.' }
];

const SESION_STEPS: SesionStep[] = [
  { label: 'Paso 1 de 4 - El objetivo', q: 'Tienes un examen de geografía sobre continentes en 3 días. ¿Cómo empiezas la sesión con ChatGPT?',
    opts: ['Hazme el examen ya', 'Tengo un examen sobre los 7 continentes en 3 días. ¿Puedes ayudarme a crear un plan de estudio divertido?', 'Dime los continentes', 'Estudia geografía conmigo'],
    correct: 1, fb_ok: 'Perfecto! Le das contexto completo: tema, tiempo y pides un plan estructurado.', fb_no: 'Ese prompt es muy vago. Sin saber el tema exacto y el tiempo, ChatGPT no puede ayudar bien.' },
  { label: 'Paso 2 de 4 - El truco', q: 'ChatGPT te da el plan pero las explicaciones son muy aburridas. ¿Qué haces?',
    opts: ['Cierro ChatGPT y estudio con mi libro', 'Eres un explorador geográfico para niños de 11 años. Explícame cada continente como si fuera un mundo de videojuego.', 'Explícame mejor', 'Dame más información'],
    correct: 1, fb_ok: 'Brillante! Usas el Truco 4 (identidad) para hacer las explicaciones divertidas.', fb_no: 'Puedes hacerlo mejor. Darle una identidad específica cambia completamente cómo explica.' },
  { label: 'Paso 3 de 4 - La práctica', q: 'Ya entendiste los continentes. ¿Cómo practicas?',
    opts: ['Hazme el examen completo con todas las respuestas', 'Hazme un quiz de 10 preguntas sobre los 7 continentes de menor a mayor dificultad. Si me equivoco, dame una pista.', 'Dame un resumen', '¿Cuáles son las respuestas?'],
    correct: 1, fb_ok: 'Excelente! Pides quiz con dificultad progresiva y pistas en lugar de respuestas directas.', fb_no: 'Pedir las respuestas no es estudiar. El cerebro aprende cuando se esfuerza.' },
  { label: 'Paso 4 de 4 - El cierre', q: 'Terminaste de estudiar. ¿Cómo cierras la sesión de forma inteligente?',
    opts: ['Cierro el chat sin más', 'Resume en 5 puntos lo más importante que estudié hoy y dime qué debo repasar mañana.', 'Gracias, adiós', '¿Cuándo es mi examen?'],
    correct: 1, fb_ok: 'Cierre perfecto! Pides un resumen y planeas el siguiente día.', fb_no: 'Cerrar sin revisar es perder lo aprendido. Un resumen final fija mejor la información.' }
];

const DRAG_ITEMS_N19: DragItemN19[] = [
  { text: 'Subir una foto de mi examen para que la corrija', correct: '4o' },
  { text: 'Preguntar cuánto es 15% de 200 pesos', correct: '35' },
  { text: 'Pedirle que genere una imagen de un volcán', correct: '4o' },
  { text: 'Hacer un resumen de texto que le pego', correct: '35' },
  { text: 'Analizar un gráfico de mi trabajo de ciencias', correct: '4o' },
  { text: 'Pedir ideas para un proyecto escolar', correct: '35' },
  { text: 'Hablarle por voz y que me responda con voz', correct: '4o' },
  { text: 'Preguntar cómo se dice "hola" en japonés', correct: '35' }
];

const IMG_OPTIONS = {
  estilo: ['Dibujo animado colorido estilo anime', 'Pintura realista como fotografía', 'Arte digital con colores neón', 'Acuarela suave con colores pastel', 'Ilustración de libro infantil'],
  objeto: ['un robot bailando salsa', 'un gato astronauta explorando Marte', 'un dragón leyendo libros', 'un pingüino haciendo surf', 'una tortuga volando con globos'],
  ambiente: ['en una ciudad futurista de luces', 'en un bosque mágico encantado', 'en el fondo del océano entre peces', 'en el espacio con planetas de colores', 'en un mercado medieval con castillos'],
  emocion: ['con expresión alegre y emocionada', 'con cara de sorpresa y ojos enormes', 'con sonrisa tranquila y relajada', 'con cara de concentración total', 'con expresión de misterio y curiosidad']
};

const TOTAL_STEPS = 22;
const pickN = <T,>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};

interface LevelProps { navigation?: any; setAllowBack?: (allow: boolean) => void; }

export default function World4Level1({ navigation: propsNavigation, setAllowBack }: LevelProps) {
  const nav = useNavigation();
  const navigation = propsNavigation || nav;
  const completeLevel = useGameStore(s => s.completeLevel);

  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);

  // Pools
  const matchPairs = useRef(pickN(MATCH_POOL, 4)).current;
  const tfItems = useRef(pickN(TF_POOL, 5)).current;
  const quizItems = useRef(pickN(QUIZ_POOL, 5)).current;
  const fillItems = useRef(pickN(FILL_POOL, 4)).current;
  const ethicsItems = useRef(pickN(ETHICS_POOL, 5)).current;
  const dragItems = useRef(pickN(DRAG_ITEMS_N19, 6)).current;

  // Detective
  const [detQ, setDetQ] = useState(0);
  const [detCorrect, setDetCorrect] = useState(0);
  const [detDone, setDetDone] = useState(false);

  // Drag & Drop
  const [ddPlaced, setDdPlaced] = useState<{ [key: number]: string }>({});
  const [ddSel, setDdSel] = useState<number | null>(null);
  const [ddOk, setDdOk] = useState(false);

  // Matching
  const [matchSel, setMatchSel] = useState<number | null>(null);
  const [matchedLeft, setMatchedLeft] = useState<Set<number>>(new Set());
  const [matchedRight, setMatchedRight] = useState<Set<number>>(new Set());
  const [rightOrder] = useState(() => matchPairs.map(p => p.right).sort(() => Math.random() - 0.5));

  // Image Builder
  const [imgState, setImgState] = useState({ estilo: '', objeto: '', ambiente: '', emocion: '' });

  // Sort
  const [sortOrder, setSortOrder] = useState<number[]>([]);
  
  // VF
  const [vfAnswers, setVfAnswers] = useState<{ [key: number]: boolean }>({});
  const [vfChecked, setVfChecked] = useState(false);

  // Quiz
  const [quizAns, setQuizAns] = useState<{ [key: number]: number }>({});
  const [quizChecked, setQuizChecked] = useState(false);

  // Ethics
  const [ethicsQ, setEthicsQ] = useState(0);
  const [ethicsDone, setEthicsDone] = useState(false);

  // Fill
  const [fillDone, setFillDone] = useState<Set<number>>(new Set());
  const [fillAns, setFillAns] = useState<{ [key: number]: number }>({});

  // Sprint
  const [sprintRunning, setSprintRunning] = useState(false);
  const [sprintSec, setSprintSec] = useState(60);
  const [sprintIdx, setSprintIdx] = useState(0);
  const [sprintScore, setSprintScore] = useState(0);
  const [sprintDone, setSprintDone] = useState(false);
  const sprintTimer = useRef<NodeJS.Timeout | null>(null);

  // Sesión
  const [sesionQ, setSesionQ] = useState(0);
  const [sesionCor, setSesionCor] = useState(0);
  const [sesionDone, setSesionDone] = useState(false);

  // Reflexión
  const [reflectText, setReflectText] = useState('');

  const theorySteps = new Set([0, 1, 2, 4, 6, 8, 11, 13, 15]);
  const canGoBack = theorySteps.has(step);

  useEffect(() => { setAllowBack?.(canGoBack); }, [canGoBack]);
  useEffect(() => {
    const h = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack) { Alert.alert('Actividad en curso', 'Completa la actividad.'); return true; }
      return false;
    });
    return () => h.remove();
  }, [canGoBack]);

  // Init sort on step 10
  useEffect(() => {
    if (step === 10) {
      setSortOrder([0, 1, 2, 3, 4, 5].sort(() => Math.random() - 0.5));
    }
  }, [step]);

  // Sprint timer
  useEffect(() => {
    if (!sprintRunning || sprintDone) return;
    if (sprintSec <= 0) { setSprintDone(true); return; }
    sprintTimer.current = setTimeout(() => setSprintSec(s => s - 1), 1000);
    return () => { if (sprintTimer.current) clearTimeout(sprintTimer.current); };
  }, [sprintRunning, sprintSec, sprintDone]);

  const addXP = (v: number) => setXp(p => p + v);
  const nextStep = () => { if (step < TOTAL_STEPS - 1) setStep(step + 1); };
  const finish = () => {
    let stars = xp >= 220 ? 3 : xp >= 150 ? 2 : 1;
    completeLevel(4, 1, stars, xp);
    router.back();
  };

  // Detective
  const answerDet = (side: string) => {
    const item = DETECTIVE_POOL[detQ];
    const ok = side === item.cual4o;
    if (ok) setDetCorrect(c => c + 1);
    if (detQ + 1 < DETECTIVE_POOL.length) {
      setTimeout(() => setDetQ(q => q + 1), 800);
    } else {
      setDetDone(true);
      addXP(ok ? 20 : 12);
    }
  };

  // Drag
  const handleDdDrop = (zone: string) => {
    if (ddSel === null) return;
    setDdPlaced(p => ({ ...p, [ddSel]: zone }));
    setDdSel(null);
  };
  const removeDd = (idx: number) => {
    setDdPlaced(p => { const n = { ...p }; delete n[idx]; return n; });
  };
  const checkDd = () => {
    let correct = 0;
    dragItems.forEach((item, i) => { if (ddPlaced[i] === item.correct) correct++; });
    if (correct === dragItems.length) { setDdOk(true); addXP(20); Alert.alert('✅', '¡Perfecto!'); }
    else Alert.alert('❌', `${correct}/${dragItems.length} correctos.`);
  };

  // Matching
  const handleMatchLeft = (i: number) => {
    if (matchedLeft.has(i)) return;
    setMatchSel(i);
  };
  const handleMatchRight = (ri: number) => {
    if (matchSel === null || matchedRight.has(ri)) return;
    if (rightOrder[ri] === matchPairs[matchSel].right) {
      setMatchedLeft(p => new Set(p).add(matchSel));
      setMatchedRight(p => new Set(p).add(ri));
      setMatchSel(null);
      if (matchedLeft.size + 1 >= matchPairs.length) {
        addXP(20);
      }
    } else {
      Alert.alert('❌', 'Esa combinación no es correcta.');
      setMatchSel(null);
    }
  };

  // Image Builder
  const imgComplete = Object.values(imgState).every(v => v.length > 0);
  const imgPrompt = imgComplete ? `${imgState.estilo}, ${imgState.objeto} ${imgState.ambiente}, ${imgState.emocion}. Alta calidad, detallado.` : '';

  // Sort
  const moveSort = (pos: number, dir: number) => {
    const np = pos + dir;
    if (np < 0 || np >= 6) return;
    const no = [...sortOrder];
    [no[pos], no[np]] = [no[np], no[pos]];
    setSortOrder(no);
  };
  const checkSort = () => {
    const ok = sortOrder.every((v, i) => v === i);
    if (ok) { addXP(15); Alert.alert('✅', '¡Orden perfecto!'); }
    else Alert.alert('❌', 'Revisa el orden.');
  };

  // VF
  const checkVF = () => {
    setVfChecked(true);
    let c = 0;
    tfItems.forEach((item, i) => { if (vfAnswers[i] === item.correct) c++; });
    addXP(c * 5);
  };

  // Quiz
  const checkQuiz = () => {
    setQuizChecked(true);
    let c = 0;
    quizItems.forEach((q, i) => { if (quizAns[i] === q.correct) c++; });
    addXP(c * 8);
  };

  // Ethics
  const answerEthics = (val: string) => {
    const item = ethicsItems[ethicsQ];
    const ok = val === item.correct;
    Alert.alert(ok ? '✅' : '❌', item.explain, [{ text: 'OK', onPress: () => {
      if (ethicsQ + 1 < ethicsItems.length) setEthicsQ(q => q + 1);
      else { setEthicsDone(true); addXP(20); nextStep(); }
    }}]);
  };

  // Fill
  const selectFill = (qi: number, oi: number) => {
    if (fillDone.has(qi)) return;
    setFillDone(p => new Set(p).add(qi));
    setFillAns(p => ({ ...p, [qi]: oi }));
    if (oi === fillItems[qi].correct) addXP(7);
  };

  // Sprint
  const startSprint = () => { setSprintRunning(true); setSprintSec(60); setSprintIdx(0); setSprintScore(0); };
  const answerSprint = (val: boolean) => {
    if (sprintDone) return;
    const items = SPRINT_POOL_N19;
    if (val === items[sprintIdx].correct) setSprintScore(s => s + 1);
    if (sprintIdx + 1 < items.length) setSprintIdx(i => i + 1);
    else { setSprintDone(true); addXP(sprintScore * 2); }
  };

  // Sesión
  const answerSesion = (oi: number) => {
    const s = SESION_STEPS[sesionQ];
    if (oi === s.correct) setSesionCor(c => c + 1);
    Alert.alert(oi === s.correct ? '✅' : '❌', oi === s.correct ? s.fb_ok : s.fb_no, [{ text: 'OK', onPress: () => {
      if (sesionQ + 1 < SESION_STEPS.length) setSesionQ(q => q + 1);
      else { setSesionDone(true); addXP(25); nextStep(); }
    }}]);
  };

  // Reflexión
  const submitReflect = () => {
    if (reflectText.trim().length >= 80) { addXP(15); nextStep(); }
    else Alert.alert('Muy corto', 'Mínimo 80 caracteres.');
  };

  const SPRINT_POOL_N19 = [
    { stmt: 'ChatGPT puede generar imágenes usando DALL-E', correct: true },
    { stmt: 'ChatGPT recuerda automáticamente todas tus conversaciones anteriores', correct: false },
    { stmt: 'GPT-4o puede analizar imágenes que le envías', correct: true },
    { stmt: 'Copiar la respuesta de ChatGPT y entregarla como tu tarea es correcto', correct: false },
    { stmt: 'Los GPTs personalizados son versiones especializadas de ChatGPT', correct: true },
    { stmt: 'ChatGPT siempre dice la verdad y nunca se equivoca', correct: false },
    { stmt: 'Puedes hablarle a ChatGPT con tu voz usando el modo de voz', correct: true },
    { stmt: 'ChatGPT puede ayudarte a escribir código de programación', correct: true },
    { stmt: 'GPT-3.5 y GPT-4o son exactamente iguales en capacidades', correct: false },
    { stmt: 'Es buena idea verificar los datos importantes que te da ChatGPT', correct: true },
    { stmt: 'Puedes pedirle a ChatGPT que te haga un quiz para estudiar', correct: true },
    { stmt: 'ChatGPT conoce resultados de partidos de ayer sin buscar en internet', correct: false }
  ];

  // ========== RENDER ==========
  const btn = (label: string, onPress: () => void, disabled = false) => (
    <TouchableOpacity style={[styles.btn, disabled && styles.btnOff]} onPress={onPress} disabled={disabled}>
      <Text style={styles.btnText}>{label}</Text>
    </TouchableOpacity>
  );

  const renderStep = () => {
    switch (step) {
      case 0: return (
        <View style={styles.stepContainer}>
          <View style={styles.iconCircle}><Text style={styles.iconEmoji}>💬</Text></View>
          <Text style={styles.title}>ChatGPT: tu compañero de aventuras!</Text>
          <Text style={styles.subtitle}>Conoce a fondo el LLM más famoso del mundo y todas sus herramientas secretas.</Text>
          <View style={styles.card}><Text style={styles.cardTitle}>🌟 ¿Por qué es tan famoso?</Text><Text style={styles.cardText}>Más de 100 millones de personas lo usan cada mes en más de 180 países.</Text></View>
          <View style={styles.card}><Text style={styles.cardTitle}>🆕 3 mecánicas nuevas</Text><Text style={styles.cardText}>Modo Detective · Constructor de Imagen · Mi Sesión Perfecta</Text></View>
          {btn('¡Vamos! 🚀', nextStep)}
        </View>
      );
      case 1: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>📖 Módulo 1 · ¿Por qué ChatGPT?</Text>
          <Text style={styles.title}>Qué hace especial a ChatGPT</Text>
          <Text style={styles.body}>5 superpoderes: genera imágenes (DALL-E), modo de voz, GPTs personalizados, analiza archivos y escribe código.</Text>
          {btn('Entendido →', nextStep)}
        </View>
      );
      case 2: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>📖 Módulo 2 · Los 5 superpoderes</Text>
          <Text style={styles.title}>Toca cada superpoder</Text>
          {['🎨 Crear imágenes (DALL-E)', '🎤 Modo de voz', '🧩 GPTs personalizados', '📄 Analizar archivos', '💻 Escribir código'].map((s, i) => (
            <View key={i} style={styles.card}><Text style={styles.cardText}>{s}</Text></View>
          ))}
          {btn('Continuar →', nextStep)}
        </View>
      );
      case 3: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>🆕 Módulo 3 · Modo Detective</Text>
          {!detDone ? (
            <>
              <Text style={styles.title}>¿Cuál es GPT-4o?</Text>
              <Text style={styles.quizQ}>{DETECTIVE_POOL[detQ].task}</Text>
              {['A', 'B'].map(side => {
                const resp = side === 'A' ? DETECTIVE_POOL[detQ].respA : DETECTIVE_POOL[detQ].respB;
                return (
                  <TouchableOpacity key={side} style={styles.detCard} onPress={() => answerDet(side)}>
                    <Text style={styles.detLabel}>Respuesta {side}</Text>
                    <Text style={styles.detText}>{resp.text}</Text>
                    <Text style={styles.detHint}>Pista: {resp.hint}</Text>
                  </TouchableOpacity>
                );
              })}
            </>
          ) : btn('Continuar →', nextStep)}
        </View>
      );
      case 4: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>📖 Módulo 4 · GPT-3.5 vs GPT-4o</Text>
          <Text style={styles.title}>¿Cuál usar?</Text>
          <View style={styles.compareRow}>
            <View style={[styles.comparePanel, { backgroundColor: '#f8fafc' }]}><Text style={styles.compareLabel}>GPT-3.5</Text><Text style={styles.compareText}>Gratis, rápido, bueno para texto. No ve imágenes, no tiene voz nativa.</Text></View>
            <View style={[styles.comparePanel, { backgroundColor: '#f0fdf4' }]}><Text style={styles.compareLabel}>GPT-4o</Text><Text style={styles.compareText}>Analiza imágenes, modo de voz, DALL-E, razona mejor. Versión gratis limitada.</Text></View>
          </View>
          {btn('Entendido →', nextStep)}
        </View>
      );
      case 5: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>🧩 Módulo 5 · Clasificar</Text>
          <Text style={styles.title}>¿GPT-3.5 o GPT-4o?</Text>
          <View style={styles.chipWrap}>
            {dragItems.map((item, i) => ddPlaced[i] === undefined && (
              <TouchableOpacity key={i} style={[styles.chip, ddSel === i && styles.chipOn]} onPress={() => setDdSel(ddSel === i ? null : i)}>
                <Text style={styles.chipText}>{item.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.dropRow}>
            {['35', '4o'].map(zone => (
              <TouchableOpacity key={zone} style={styles.dropZone} onPress={() => handleDdDrop(zone)}>
                <Text style={styles.dropHeader}>{zone === '35' ? 'GPT-3.5' : 'GPT-4o'}</Text>
                {Object.entries(ddPlaced).map(([k, v]) => v === zone && (
                  <TouchableOpacity key={k} onPress={() => removeDd(parseInt(k))}>
                    <Text style={styles.dropChip}>{dragItems[parseInt(k)].text} ✕</Text>
                  </TouchableOpacity>
                ))}
              </TouchableOpacity>
            ))}
          </View>
          {btn('Verificar', checkDd)}
        </View>
      );
      case 6: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>📖 Módulo 6 · GPTs personalizados</Text>
          <Text style={styles.title}>La tienda de apps de ChatGPT</Text>
          <Text style={styles.body}>Hay miles de GPTs: para estudiar, crear y explorar. Encuéntralos en "Explorar GPTs".</Text>
          {btn('Entendido →', nextStep)}
        </View>
      );
      case 7: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>🔗 Módulo 7 · Conectar</Text>
          <Text style={styles.title}>¿Para qué sirve cada herramienta?</Text>
          <View style={styles.matchRow}>
            <View style={{ flex: 1 }}>
              {matchPairs.map((p, i) => (
                <TouchableOpacity key={i} style={[styles.matchCard, matchSel === i && styles.matchCardSel, matchedLeft.has(i) && styles.matchCardDone]} onPress={() => handleMatchLeft(i)} disabled={matchedLeft.has(i)}>
                  <Text style={styles.matchText}>{p.left}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flex: 1 }}>
              {rightOrder.map((r, i) => (
                <TouchableOpacity key={i} style={[styles.matchCard, matchedRight.has(i) && styles.matchCardDone]} onPress={() => handleMatchRight(i)} disabled={matchedRight.has(i)}>
                  <Text style={styles.matchText}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      );
      case 8: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>📖 Módulo 8 · DALL-E</Text>
          <Text style={styles.title}>Cuando las palabras se vuelven imágenes</Text>
          <Text style={styles.body}>Estilo + sujeto + ambiente + emoción = prompt de imagen perfecto. Solo funciona con GPT-4o.</Text>
          {btn('Entendido →', nextStep)}
        </View>
      );
      case 9: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>🆕 Módulo 9 · Constructor de Imagen</Text>
          <Text style={styles.title}>Construye tu prompt para DALL-E</Text>
          {Object.entries(IMG_OPTIONS).map(([key, opts]) => (
            <View key={key} style={{ marginBottom: 12 }}>
              <Text style={styles.selectorLabel}>{key.toUpperCase()}</Text>
              <View style={styles.selectorRow}>
                {opts.map((opt, i) => (
                  <TouchableOpacity key={i} style={[styles.optChip, imgState[key as keyof typeof imgState] === opt && styles.optChipOn]} onPress={() => setImgState(p => ({ ...p, [key]: opt }))}>
                    <Text style={{ fontSize: 10 }}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
          {imgComplete && <View style={styles.codeBox}><Text style={styles.codeText}>{imgPrompt}</Text></View>}
          {btn('Continuar →', () => { addXP(12); nextStep(); }, !imgComplete)}
        </View>
      );
      case 10: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>↕️ Módulo 10 · Ordenar</Text>
          <Text style={styles.title}>El orden perfecto para estudiar</Text>
          {sortOrder.map((val, pos) => (
            <View key={pos} style={styles.sortRow}>
              <Text style={styles.sortText}>{pos + 1}. {SORT_SESION[val]}</Text>
              <View style={styles.arrowCol}>
                <TouchableOpacity onPress={() => moveSort(pos, -1)} disabled={pos === 0}><Text>▲</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => moveSort(pos, 1)} disabled={pos === 5}><Text>▼</Text></TouchableOpacity>
              </View>
            </View>
          ))}
          {btn('Verificar orden', checkSort)}
        </View>
      );
      case 11: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>📖 Módulo 11 · Estudiar con ChatGPT</Text>
          <Text style={styles.title}>5 formas que funcionan</Text>
          <Text style={styles.body}>1. Pide preguntas, no respuestas{'\n'}2. Dale una identidad divertida{'\n'}3. Pide que explique tus errores{'\n'}4. Pide ejemplos de tu país{'\n'}5. Pide resúmenes al final</Text>
          {btn('Entendido →', nextStep)}
        </View>
      );
      case 12: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>✅ Módulo 12 · V/F</Text>
          {tfItems.map((item, i) => (
            <View key={i} style={{ marginBottom: 14 }}>
              <Text style={styles.qText}>{i + 1}. {item.stmt}</Text>
              <View style={styles.row}>
                <TouchableOpacity style={[styles.tfBtn, vfAnswers[i] === true && styles.tfOn]} onPress={() => setVfAnswers(p => ({ ...p, [i]: true }))} disabled={vfChecked}><Text>✅ V</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.tfBtn, vfAnswers[i] === false && styles.tfOff]} onPress={() => setVfAnswers(p => ({ ...p, [i]: false }))} disabled={vfChecked}><Text>❌ F</Text></TouchableOpacity>
              </View>
              {vfChecked && <Text style={vfAnswers[i] === item.correct ? styles.fbGood : styles.fbBad}>{item.explain}</Text>}
            </View>
          ))}
          {!vfChecked ? btn('Comprobar', checkVF) : btn('Continuar →', nextStep)}
        </View>
      );
      case 13: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>📖 Módulo 13 · Historia real</Text>
          <Text style={styles.title}>Yuki: de no saber inglés a conversarlo</Text>
          <Text style={styles.body}>Yuki, 11 años, de Tokio, practicó 15 min diarios con el modo de voz de ChatGPT. En 3 meses pasó de entender 10% a fluidez básica.</Text>
          {btn('Entendido →', nextStep)}
        </View>
      );
      case 14: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>❓ Módulo 14 · Quiz</Text>
          {quizItems.map((q, i) => (
            <View key={i}>
              <Text style={styles.qText}>{i + 1}. {q.q}</Text>
              {q.opts.map((o, j) => (
                <TouchableOpacity key={j} style={[styles.quizOpt, quizAns[i] === j && styles.quizOptOn]} onPress={() => setQuizAns(p => ({ ...p, [i]: j }))} disabled={quizChecked}>
                  <Text>{o}</Text>
                </TouchableOpacity>
              ))}
              {quizChecked && <Text style={quizAns[i] === q.correct ? styles.fbGood : styles.fbBad}>{q.explain}</Text>}
            </View>
          ))}
          {!quizChecked ? btn('Comprobar', checkQuiz) : btn('Continuar →', nextStep)}
        </View>
      );
      case 15: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>📖 Módulo 15 · Límites</Text>
          <Text style={styles.title}>Cuándo NO usar ChatGPT</Text>
          <Text style={styles.body}>Noticias de hoy, emergencias médicas, cálculos muy precisos, información local en tiempo real.</Text>
          {btn('Entendido →', nextStep)}
        </View>
      );
      case 16: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>⚖️ Módulo 16 · ¿Está bien?</Text>
          {!ethicsDone && ethicsQ < ethicsItems.length ? (
            <>
              <Text style={styles.qText}>{ethicsItems[ethicsQ].scenario}</Text>
              <View style={styles.row}>
                {['safe', 'doubt', 'bad'].map(v => (
                  <TouchableOpacity key={v} style={styles.tfBtn} onPress={() => answerEthics(v)}>
                    <Text>{v === 'safe' ? '✅ OK' : v === 'doubt' ? '🤔 Cuidado' : '⛔ Mal'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : btn('Continuar →', nextStep)}
        </View>
      );
      case 17: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>📄 Módulo 17 · Completa</Text>
          {fillItems.map((item, qi) => (
            <View key={qi}>
              <Text style={styles.fillSentence}>{item.sentence}</Text>
              <View style={styles.optWrap}>
                {item.allOpts.map((opt, oi) => (
                  <TouchableOpacity key={oi} style={[styles.fillOpt, fillAns[qi] === oi && styles.fillOptOn]} onPress={() => selectFill(qi, oi)} disabled={fillDone.has(qi)}>
                    <Text>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
          {fillDone.size >= fillItems.length && btn('Continuar →', nextStep)}
        </View>
      );
      case 18: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>⚡ Módulo 18 · Sprint</Text>
          {!sprintRunning && !sprintDone ? btn('Empezar Sprint!', startSprint) : sprintDone ? btn('Continuar →', nextStep) : (
            <>
              <Text style={styles.timer}>{sprintSec}s</Text>
              <Text style={styles.qText}>{SPRINT_POOL_N19[sprintIdx]?.stmt}</Text>
              <View style={styles.row}>
                <TouchableOpacity style={styles.tfBtn} onPress={() => answerSprint(true)}><Text>✅ V</Text></TouchableOpacity>
                <TouchableOpacity style={styles.tfBtn} onPress={() => answerSprint(false)}><Text>❌ F</Text></TouchableOpacity>
              </View>
            </>
          )}
        </View>
      );
      case 19: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>🆕 Módulo 19 · Mi sesión perfecta</Text>
          {!sesionDone && sesionQ < SESION_STEPS.length ? (
            <>
              <Text style={styles.qText}>{SESION_STEPS[sesionQ].q}</Text>
              {SESION_STEPS[sesionQ].opts.map((o, i) => (
                <TouchableOpacity key={i} style={styles.quizOpt} onPress={() => answerSesion(i)}>
                  <Text>{o}</Text>
                </TouchableOpacity>
              ))}
            </>
          ) : btn('Continuar →', nextStep)}
        </View>
      );
      case 20: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>💬 Reflexión</Text>
          <Text style={styles.title}>¿Para qué lo vas a usar tú?</Text>
          <TextInput style={styles.textArea} placeholder="¿Cuál superpoder te parece más útil? ¿Cómo usarías ChatGPT esta semana?" value={reflectText} onChangeText={setReflectText} multiline />
          {btn('Enviar reflexión', submitReflect, reflectText.trim().length < 80)}
        </View>
      );
      case 21: return (
        <View style={styles.completeContainer}>
          <View style={styles.completeIcon}><Text style={styles.iconEmoji}>💬</Text></View>
          <Text style={styles.completeTitle}>¡Nivel 1 completado!</Text>
          <Text style={styles.completeSub}>Ahora eres un experto en ChatGPT y sabes usar todas sus herramientas secretas.</Text>
          <Text style={styles.xpBig}>⭐ {xp} XP ganados</Text>
          {btn('Volver al mapa', finish)}
        </View>
      );
      default: return null;
    }
  };

  const progressPercent = (step / (TOTAL_STEPS - 1)) * 100;

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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  bar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  track: { flex: 1, height: 6, backgroundColor: colors.borderLight, borderRadius: 3, marginHorizontal: 12 },
  fill: { height: '100%', backgroundColor: '#16a34a', borderRadius: 3 },
  xpChip: { ...typography.bold, fontSize: 14, color: '#166534' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  stepContainer: { flex: 1 },
  tag: { fontSize: 11, fontWeight: '600', color: '#166534', backgroundColor: '#dcfce7', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 12, alignSelf: 'flex-start' },
  iconCircle: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#dcfce7', justifyContent: 'center', alignItems: 'center', marginBottom: 14, alignSelf: 'center' },
  iconEmoji: { fontSize: 32 },
  title: { ...typography.extraBold, fontSize: 19, color: colors.textPrimary, marginBottom: 8, textAlign: 'center' },
  subtitle: { ...typography.regular, fontSize: 13, color: colors.textSecondary, marginBottom: 14, lineHeight: 18, textAlign: 'center' },
  body: { ...typography.regular, fontSize: 13, color: colors.textPrimary, lineHeight: 20, marginBottom: 12 },
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  cardTitle: { ...typography.bold, fontSize: 13, color: colors.textPrimary, marginBottom: 4 },
  cardText: { ...typography.regular, fontSize: 12, color: colors.textSecondary },
  btn: { backgroundColor: '#16a34a', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  btnText: { ...typography.bold, color: '#fff', fontSize: 15 },
  btnOff: { opacity: 0.4 },
  qText: { ...typography.bold, padding: 10, backgroundColor: '#f8fafc', borderRadius: 8, marginBottom: 6 },
  quizQ: { ...typography.bold, fontSize: 13, padding: 12, backgroundColor: '#f0fdf4', borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#bbf7d0' },
  quizOpt: { padding: 10, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, marginBottom: 4 },
  quizOptOn: { borderColor: '#16a34a', backgroundColor: '#dcfce7' },
  fbGood: { color: '#166534', fontSize: 11, marginTop: 4 },
  fbBad: { color: '#991b1b', fontSize: 11, marginTop: 4 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  tfBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  tfOn: { backgroundColor: '#dcfce7', borderColor: '#16a34a' },
  tfOff: { backgroundColor: '#fff1f2', borderColor: '#ef4444' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 10, backgroundColor: '#f8fafc', borderRadius: 12, marginBottom: 12 },
  chip: { padding: 8, borderRadius: 20, borderWidth: 1, borderColor: '#cbd5e1' },
  chipOn: { borderColor: '#16a34a', backgroundColor: '#dcfce7' },
  chipText: { fontSize: 11 },
  dropRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  dropZone: { flex: 1, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 8, minHeight: 80 },
  dropHeader: { fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  dropChip: { fontSize: 10, padding: 4, backgroundColor: '#dcfce7', borderRadius: 6 },
  matchRow: { flexDirection: 'row', gap: 10 },
  matchCard: { backgroundColor: colors.surface, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 6 },
  matchCardSel: { borderColor: '#16a34a', backgroundColor: '#dcfce7' },
  matchCardDone: { backgroundColor: '#dcfce7', borderColor: '#16a34a' },
  matchText: { fontSize: 11 },
  compareRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  comparePanel: { flex: 1, borderRadius: 12, padding: 12, borderWidth: 1 },
  compareLabel: { fontWeight: '700', marginBottom: 4 },
  compareText: { fontSize: 11 },
  detCard: { borderRadius: 12, padding: 12, borderWidth: 2, borderColor: '#e2e8f0', marginBottom: 8 },
  detLabel: { fontSize: 10, fontWeight: '700', color: '#64748b', marginBottom: 4 },
  detText: { fontSize: 11, color: '#334155', lineHeight: 18 },
  detHint: { fontSize: 10, color: '#94a3b8', fontStyle: 'italic', marginTop: 4 },
  selectorLabel: { ...typography.bold, fontSize: 12, color: '#166534', marginBottom: 4 },
  selectorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  optChip: { padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#86efac' },
  optChipOn: { backgroundColor: '#dcfce7', borderColor: '#16a34a' },
  codeBox: { backgroundColor: '#1e1e1e', padding: 12, borderRadius: 10, marginTop: 10 },
  codeText: { color: '#86efac', fontFamily: 'monospace', fontSize: 12 },
  sortRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 10, backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, marginBottom: 6 },
  sortText: { flex: 1, fontSize: 12 },
  arrowCol: { flexDirection: 'column' },
  fillSentence: { padding: 12, backgroundColor: '#f0fdf4', borderRadius: 8, borderWidth: 1, borderColor: '#bbf7d0', marginBottom: 8, ...typography.bold },
  optWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  fillOpt: { padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  fillOptOn: { borderColor: '#16a34a', backgroundColor: '#dcfce7' },
  timer: { fontSize: 36, fontWeight: '800', textAlign: 'center', color: '#16a34a', marginBottom: 10 },
  textArea: { borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 10, padding: 12, minHeight: 100, fontSize: 13, backgroundColor: '#f0fdf4', marginBottom: 10 },
  completeContainer: { alignItems: 'center', padding: 20 },
  completeIcon: { width: 86, height: 86, borderRadius: 24, backgroundColor: '#86efac', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  completeTitle: { ...typography.extraBold, fontSize: 21 },
  completeSub: { ...typography.regular, textAlign: 'center', marginVertical: 8 },
  xpBig: { ...typography.bold, fontSize: 18, color: '#166534', marginBottom: 16 },
});