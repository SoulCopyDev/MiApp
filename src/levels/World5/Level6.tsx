import React, { useState, useEffect, useRef, type SetStateAction } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, BackHandler,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useGameStore } from '../../store/gameStore';
import { colors, typography } from '../../theme';

// ---------- Tipos ----------
type DragItem = { text: string; correct: string };
type QuizItem = { q: string; opts: string[]; correct: number; explain: string };
type TFItem = { stmt: string; correct: boolean; explain: string };
type FillItem = { sentence: string; allOpts: string[]; correct: Record<string, number>; explain: string };
type ScenarioChoice = { title: string; text: string; correct: boolean; explain: string };
type BuilderRow = { key: string; label: string; opts: string[] };
type SprintItem = { text: string; good: boolean };

const TOTAL_STEPS = 20; // 0:intro + 19 módulos
const CONTENT_STEPS = 19;

const pickN = <T,>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};

// ===================== POOLS =====================

const WINNING_STRUCTURE = [
  'Problema: el dolor real, específico, dimensionado con UN dato impactante',
  'Solución: qué construiste, en una frase clara, sin jerga',
  'Demo: mostrar funcionando — 30-60 seg de la magia real',
  'Impacto: métricas concretas, testimonios o validación de mercado',
  'Llamada a la acción: qué necesitas (usuarios, capital, equipo, partners)',
];

const GAMMA_Q_POOL: QuizItem[] = [
  { q: '¿Qué es Gamma.app?', opts: ['Un editor de fotos', 'Plataforma que genera presentaciones desde un prompt usando IA', 'Una red social', 'Un antivirus'], correct: 1, explain: 'Gamma: escribes "pitch deck para mi app" y genera 8 slides con diseño profesional en 30 segundos.' },
  { q: 'Ventaja real de Gamma vs PowerPoint tradicional:', opts: ['Más colores disponibles', 'Velocidad: pasas de prompt a deck listo en minutos, no horas', 'Funciona sin internet', 'Solo es estética'], correct: 1, explain: 'Lo que tomaba 4 horas en PowerPoint ahora toma 5 minutos en Gamma.' },
  { q: 'Otras alternativas IA para presentaciones:', opts: ['Solo Gamma existe', 'Tome.app, Beautiful.ai, Pitch.com, Canva con IA — el mercado es competitivo', 'ChatGPT no sirve para esto', 'Solo en inglés'], correct: 1, explain: 'Mercado activo. Tome.app y Pitch.com también funcionan bien.' },
  { q: 'Cuándo NO usar IA para tu presentación:', opts: ['Nunca', 'Cuando la presentación es altamente técnica/médica/legal y necesita revisión humana experta', 'Cuando hay más de 100 personas', 'Si no eres americano'], correct: 1, explain: 'IA = borrador rápido. Para contenido sensible, siempre revisión humana experta.' },
  { q: 'Estrategia recomendada con Gamma:', opts: ['Aceptar el resultado tal cual', 'Generar borrador con IA → personalizar con TUS datos reales y fotos auténticas', 'Solo cambiar el color', 'Imprimirlo sin revisar'], correct: 1, explain: 'Gamma da estructura. Tú aportas autenticidad: fotos reales, datos de TU proyecto.' },
  { q: '¿Cuántos slides es ideal para un pitch de 5 minutos?', opts: ['20+ slides', '5-7 slides — uno por idea principal, sin saturar', 'Solo 1', 'Mínimo 30'], correct: 1, explain: 'Regla de oro: 1 idea por slide. Para 5 min, 5-7 slides.' },
];

const FEEDBACK_Q_POOL: QuizItem[] = [
  { q: 'Mejor pregunta para feedback honesto:', opts: ['¿Te gustó?', '¿Qué cambiarías si fueras yo y por qué?', '¿Está bien?', '¿Ya?'], correct: 1, explain: '"¿Qué cambiarías?" obliga a la persona a pensar concretamente.' },
  { q: 'Si pides feedback a 5 personas y todas dan respuestas distintas:', opts: ['Sigue a la mayoría', 'Busca el patrón en lo que NO te dijeron — los silencios coincidentes son señales', 'Ignora todo', 'Cambia todo'], correct: 1, explain: 'Lo que NADIE menciona también es información.' },
  { q: '¿A quién NO pedirle feedback antes de presentar?', opts: ['A nadie', 'A familia y amigos cercanos — son demasiado amables y sesgados positivamente', 'A desconocidos', 'A inversores'], correct: 1, explain: 'Familia/amigos = sesgo positivo. Busca personas que NO te conocen pero entienden el dominio.' },
  { q: 'Pregunta poderosa para detectar lo que no funciona:', opts: ['¿Te gusta?', 'Si tuvieras que cortar UN slide, ¿cuál sería y por qué?', '¿Está perfecto?', '¿Y?'], correct: 1, explain: 'Forzar a cortar revela lo más débil.' },
  { q: '¿Cuántas rondas de feedback antes de presentar?', opts: ['1 ronda es suficiente', '2-3 rondas con personas distintas — itera entre cada una', '10+ rondas', 'Ninguna, confía en ti'], correct: 1, explain: '1 ronda = sesgo individual. 2-3 rondas iterativas = balance óptimo.' },
];

const TF_PRES_Q_POOL: TFItem[] = [
  { stmt: 'Memorizar palabra por palabra es la mejor forma de prepararse', correct: false, explain: 'Falso. Memorizar = robótico. Mejor: dominar la estructura + frases ancla, improvisar dentro de eso.' },
  { stmt: 'Los nervios son señal de que te importa — no son enemigos', correct: true, explain: 'Verdadero. Los nervios canalizados se vuelven energía.' },
  { stmt: 'Si el público no aplaude, fue mala presentación', correct: false, explain: 'Falso. A veces los pitches más serios generan silencio reflexivo, no aplausos.' },
  { stmt: 'Empezar pidiendo perdón destruye tu autoridad inmediatamente', correct: true, explain: 'Verdadero. Nunca pidas perdón al iniciar. La audiencia decide tu valor en los primeros 10 segundos.' },
  { stmt: 'Las pausas estratégicas son más poderosas que hablar rápido', correct: true, explain: 'Verdadero. Las pausas crean tensión y muestran control.' },
  { stmt: 'Decir "como dije anteriormente" o "básicamente" es señal de inseguridad', correct: true, explain: 'Verdadero. Muletillas restan autoridad.' },
  { stmt: 'Mirar al techo o piso al hablar es perfectamente normal', correct: false, explain: 'Falso. La conexión visual con la audiencia es crítica.' },
  { stmt: 'Ensayar 3 veces es suficiente', correct: false, explain: 'Falso. Pitches ganadores se ensayan 20-50 veces.' },
];

const FILL_POOL: FillItem[] = [
  { sentence: 'Una versión muy corta (30-60 seg) de tu pitch para situaciones inesperadas se llama _____.', allOpts: ['elevator pitch', 'podcast', 'vlog', 'demo'], correct: { fb0: 0 }, explain: 'Elevator pitch: si te encuentras a un inversor en un ascensor, ¿qué le dices en lo que dura el viaje?' },
  { sentence: 'Las palabras de relleno como "osea", "básicamente", "pues" que restan autoridad se llaman _____.', allOpts: ['muletillas', 'verbos', 'adjetivos', 'interjecciones'], correct: { fb0: 0 }, explain: 'Muletillas: las eliminas grabándote y revisando.' },
  { sentence: 'El cierre final de un pitch debe ser una _____ a la acción específica.', allOpts: ['llamada', 'burla', 'queja', 'imitación'], correct: { fb0: 0 }, explain: 'CTA: si terminas con "gracias", perdiste. Termina con qué QUIERES que hagan.' },
];

const HARD_Q_SCN: ScenarioChoice[] = [
  { title: '"¿Por qué nadie ha hecho esto antes?"', text: 'Responder con honestidad: "Sí lo han intentado — empresa X y Y lo tocaron. La diferencia es Z. Aquí está la evidencia de por qué este momento es diferente."', correct: true, explain: '✅ Reconocer competidores genera credibilidad. Negar que existen te quema.' },
  { title: '"Eso ya existe, ¿no?"', text: 'Responder con defensividad: "No es lo mismo, ustedes no entienden, mi proyecto es totalmente diferente y especial."', correct: false, explain: '❌ Defensividad = pierdes credibilidad.' },
  { title: '"¿Cómo vas a ganar dinero?"', text: 'Responder claro: "Modelo freemium: gratis hasta X usuarios, $Y/mes después. Validamos con N usuarios pagando ya."', correct: true, explain: '✅ Modelo + validación + proyección = respuesta seria.' },
  { title: '"¿Y si Google/Meta/Apple lo copian?"', text: 'Responder con sinceridad: "Es un riesgo real. Pero nuestra ventaja es velocidad de iteración + nicho específico."', correct: true, explain: '✅ Reconocer riesgos reales + plan defensivo = madurez.' },
  { title: '"No me convences"', text: 'Responder pidiendo retroalimentación: "Entiendo. ¿Qué pieza específica necesitarías ver para convencerte?"', correct: true, explain: '✅ Conviertes objeción en información. Eso es oro gratis.' },
];

const SLIDES_ITEMS: DragItem[] = [
  { text: 'Slide con 50 palabras de texto, 4 viñetas y 2 imágenes pequeñas', correct: 'bad' },
  { text: 'Slide con UN número grande ("240 usuarios") y una frase de contexto debajo', correct: 'good' },
  { text: 'Slide con tu rostro feliz al lado del logo, sin contexto del problema', correct: 'bad' },
  { text: 'Slide con gráfica simple de UN dato relevante (uso/crecimiento/retención)', correct: 'good' },
  { text: 'Slide con jerarquía visual clara: título grande, subtítulo mediano, dato pequeño', correct: 'good' },
  { text: 'Slide con 7 colores diferentes y 3 tipografías mezcladas', correct: 'bad' },
  { text: 'Slide con screenshot de la app con UN elemento destacado (círculo/flecha)', correct: 'good' },
  { text: 'Slide en gris claro sobre blanco con texto pequeño difícil de leer', correct: 'bad' },
  { text: 'Slide con cita textual de un usuario real entre comillas, en grande', correct: 'good' },
  { text: 'Slide con 4 logos de competidores y tu logo en el centro con flecha', correct: 'good' },
];

const PRESENTATION_CHECKLIST = [
  'Llega 30 min antes: probar audio, video, conexión, micrófono y deck',
  'Plan B del deck: versión PDF en USB + en email + en cloud (3 backups)',
  'Usa el baño antes: obvio pero crítico',
  'Bebe agua, no café: el café tiembla las manos y reseca la boca',
  'Respira 4-7-8: 4s inhalar, 7s sostener, 8s exhalar — calma instantánea',
  'Recuerda quién eres: tienes algo que decir que importa',
  'Conecta con UNA persona: no hables al "público" — habla a un humano',
  'Tiempo medido: reloj o cronómetro discreto',
  'Cierre poderoso: tu última frase es la que se queda — ensáyala 10x',
  'Manos visibles, postura abierta: el cuerpo comunica antes que las palabras',
];

const PITCH_SPRINT_ITEMS: SprintItem[] = [
  { text: '"Hola, mi nombre es X y voy a contarles un poco de mi proyecto..."', good: false },
  { text: '"7 de cada 10 estudiantes pierden tareas. Yo construí esto. Funciona así. Necesito esto. Gracias."', good: true },
  { text: '"Es revolucionario, increíble, va a cambiar el mundo, es lo más nuevo..."', good: false },
  { text: '"Hace 2 años vi a mi abuela llorar usando una app. Hoy lanzo SU solución → demo → 240 usuarios → necesito 5 testers más"', good: true },
  { text: '"Bueno, ehhh, no sé bien por dónde empezar, mi proyecto es como, así, complicado..."', good: false },
  { text: '"Problema: X. Solución: Y. Demo en 30 seg. Impacto: 240 usuarios reales. Llamada: necesito a Z."', good: true },
  { text: 'Lectura monótona del slide sin contacto visual con el público', good: false },
  { text: '"Cada día, miles de familias latinas pierden un contacto importante para siempre. Construí algo que arregla eso."', good: true },
  { text: 'Memorizado palabra por palabra, robótico, sin emoción', good: false },
  { text: 'Personal, claro, dato impactante de entrada, demo en vivo, cierre con CTA específico', good: true },
];

const BUILDER_DECK = {
  xp: 22,
  rows: [
    { key: 'slide1', label: 'Slide 1: Título', opts: ['Logo + tagline emotivo de 5 palabras', 'Tu rostro + nombre del proyecto', 'Frase contundente que cuenta la transformación', 'Logo simple sobre fondo blanco minimalista'] },
    { key: 'slide2', label: 'Slide 2: Problema', opts: ['UN número grande dimensionando el dolor', 'Foto auténtica de alguien viviendo el problema', 'Cita textual de usuario real entre comillas', 'Stat + cita + foto en composición vertical'] },
    { key: 'slide3', label: 'Slide 3: Solución', opts: ['Frase clara sin jerga + screenshot del producto', 'Diagrama simple de cómo funciona', 'Demo de 30 seg embebida en el slide', 'Antes/después visual lado a lado'] },
    { key: 'slide4', label: 'Slide 4: Demo / Tracción', opts: ['Video corto del producto funcionando', 'Métrica clave con gráfica simple', 'Lista de logros: usuarios, partners, hitos', 'Quote de usuario real con foto'] },
    { key: 'slide5', label: 'Slide 5: Próximos pasos / CTA', opts: ['"Necesitamos X para llegar a Y"', 'Roadmap visual a 6 meses', 'Llamada con tu contacto e info', 'El equipo + qué les falta cubrir'] },
  ],
};

const BUILDER_PITCH = {
  xp: 25,
  rows: [
    { key: 'problema', label: '1. Problema (10 palabras)', opts: ['7 de cada 10 estudiantes pierden tareas por desorganización', 'Adultos mayores se sienten excluidos del mundo digital', 'Pequeños emprendedores no saben usar IA para crecer', 'Familias latinas pierden el legado de sus mayores'] },
    { key: 'solucion', label: '2. Solución (10 palabras)', opts: ['Una app que organiza tareas con IA en WhatsApp', 'Chatbot guía paso a paso por audios cálidos', 'Plataforma con cursos gratuitos de IA para emprendedoras', 'Sistema que preserva voz e historia de seres queridos'] },
    { key: 'razon', label: '3. Por qué tú (5 palabras)', opts: ['Lo viví y lo entiendo', 'Tengo el equipo correcto', 'Mi research lo respalda', 'Ya tengo usuarios reales'] },
  ],
};

const BUILDER_STORY = {
  xp: 22,
  rows: [
    { key: 'antes', label: 'ANTES (1 frase, problema vivido)', opts: ['Hace 2 años, mi abuela lloraba al abrir la app del banco', 'Pasé 30 horas/semana organizando tareas en WhatsApp', 'Mi mamá perdió un negocio por no saber usar IA', 'Mi familia perdió la voz de mi abuelo cuando murió'] },
    { key: 'encuentro', label: 'ENCUENTRO (1 frase, momento de claridad)', opts: ['Descubrí que con 4 herramientas podía resolverlo en 1 fin de semana', 'Probé Lovable y construí el primer prototipo en 3 horas', 'Entrevisté a 10 personas y todas vivían lo mismo', 'Aprendí que era posible — y nadie lo estaba haciendo bien'] },
    { key: 'despues', label: 'DESPUÉS (1 frase, transformación real)', opts: ['Hoy 240 personas lo usan cada semana', 'Hoy ahorro 25 horas/semana y mis usuarios también', 'Hoy 50 emprendedoras dominan IA y duplicaron ingresos', 'Hoy las familias preservan recuerdos para siempre'] },
  ],
};

const BUILDER_HARDQ = {
  xp: 18,
  rows: [
    { key: 'categoria', label: 'Tipo de pregunta a entrenar', opts: ['Mercado: ¿quién más lo hace?', 'Producto: ¿qué pasa cuando falla?', 'Negocio: ¿cómo ganas dinero?', 'Equipo: ¿por qué tú?', 'Riesgo: ¿qué te tumba mañana?'] },
    { key: 'respuesta', label: 'Estructura de tu respuesta', opts: ['Validar + dato concreto + mostrar que YA lo pensaste', 'Honestidad sobre lo que no sabes + plan para descubrirlo', 'Reformular si tiene supuesto erróneo', 'Pedir 30 segundos si te toma por sorpresa'] },
    { key: 'tono', label: 'Tono al responder', opts: ['Confiado pero humilde — sin defensividad', 'Curioso — "buena pregunta, esto sé..."', 'Directo y conciso — sin rodeos', 'Apasionado pero técnico'] },
  ],
};

// ===================== COMPONENTE =====================
interface LevelProps {
  navigation?: any;
  setAllowBack?: (allow: boolean) => void;
}

export default function World5Level6({ navigation: propsNavigation, setAllowBack }: LevelProps) {
  const nav = useNavigation();
  const navigation = propsNavigation || nav;
  const completeLevel = useGameStore((s) => s.completeLevel);

  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);

  // Pools
  const [gammaQItems] = useState(() => pickN(GAMMA_Q_POOL, 5));
  const [feedbackQItems] = useState(() => pickN(FEEDBACK_Q_POOL, 5));
  const [tfItems] = useState(() => pickN(TF_PRES_Q_POOL, 5));
  const [fillItem] = useState(() => pickN(FILL_POOL, 1)[0]);
  const [slidesItems] = useState(() => pickN(SLIDES_ITEMS, 8));

  // Estados
  const [sortOrder2, setSortOrder2] = useState<number[]>([]);
  const [sortOk2, setSortOk2] = useState(false);
  const [sortOrder14, setSortOrder14] = useState<number[]>([]);
  const [sortOk14, setSortOk14] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizChecked, setQuizChecked] = useState(false);
  const [tfAnswers, setTfAnswers] = useState<Record<number, boolean>>({});
  const [tfChecked, setTfChecked] = useState(false);
  const [fillSel, setFillSel] = useState<number | null>(null);
  const [fillChecked, setFillChecked] = useState(false);
  const [scenarioSel, setScenarioSel] = useState<number | null>(null);
  const [scenarioDone, setScenarioDone] = useState(false);
  const [dragPlaced, setDragPlaced] = useState<Record<number, string>>({});
  const [dragSel, setDragSel] = useState<number | null>(null);
  const [dragAttempts, setDragAttempts] = useState(0);
  const [dragOk, setDragOk] = useState(false);
  const [builderDeck, setBuilderDeck] = useState<Record<string, string>>({});
  const [builderPitch, setBuilderPitch] = useState<Record<string, string>>({});
  const [builderStory, setBuilderStory] = useState<Record<string, string>>({});
  const [builderHardQ, setBuilderHardQ] = useState<Record<string, string>>({});
  const [sprintPicks, setSprintPicks] = useState<Record<number, string>>({});
  const [sprintSec, setSprintSec] = useState(90);
  const [sprintStarted, setSprintStarted] = useState(false);
  const [sprintDone, setSprintDone] = useState(false);
  const sprintTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [compareChoice, setCompareChoice] = useState<string | null>(null);
  const [compareChecked, setCompareChecked] = useState(false);
  const [reflectVal, setReflectVal] = useState('');
  const [reflectMinLen, setReflectMinLen] = useState(120);

  const examSteps = new Set([2, 3, 4, 5, 6, 7, 9, 10, 11, 13, 14, 15, 16, 17]);
  const isExam = examSteps.has(step);
  useEffect(() => { setAllowBack?.(!isExam); }, [isExam, setAllowBack]);
  useEffect(() => {
    const bh = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isExam) { Alert.alert('Actividad en curso', 'No puedes regresar ahora.'); return true; }
      return false;
    });
    return () => bh.remove();
  }, [isExam]);

  useEffect(() => {
    if (step === 2) { const o = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5); setSortOrder2(o); setSortOk2(false); }
    if (step === 3) { setQuizAnswers({}); setQuizChecked(false); }
    if (step === 4) { setBuilderDeck({}); }
    if (step === 5) { setBuilderPitch({}); }
    if (step === 6) { setBuilderStory({}); }
    if (step === 7) { setBuilderHardQ({}); }
    if (step === 9) { setSprintPicks({}); setSprintSec(90); setSprintStarted(false); setSprintDone(false); if (sprintTimer.current) clearInterval(sprintTimer.current); }
    if (step === 10) { setScenarioSel(null); setScenarioDone(false); }
    if (step === 11) { setDragPlaced({}); setDragSel(null); setDragAttempts(0); setDragOk(false); }
    if (step === 13) { setQuizAnswers({}); setQuizChecked(false); }
    if (step === 14) { const o = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5); setSortOrder14(o); setSortOk14(false); }
    if (step === 15) { setTfAnswers({}); setTfChecked(false); }
    if (step === 16) { setFillSel(null); setFillChecked(false); }
    if (step === 17) { setCompareChoice(null); setCompareChecked(false); }
    if (step === 12) { setReflectMinLen(120); setReflectVal(''); }
    if (step === 18) { setReflectMinLen(150); setReflectVal(''); }
  }, [step]);

  const addXP = (n: number) => setXp((p) => p + n);
  const goNext = () => { if (step < TOTAL_STEPS - 1) setStep(step + 1); };
  const handleClose = () => Alert.alert('Salir', '¿Seguro?', [{ text: 'Cancelar' }, { text: 'Salir', onPress: () => navigation.goBack() }]);
  const handleFinish = () => {
    let stars = 0;
    if (xp >= 190) stars = 3; else if (xp >= 125) stars = 2; else if (xp >= 60) stars = 1;
    completeLevel(5, 6, stars, xp);
    navigation.goBack();
  };

  // Sort genérico
  const moveSort = (pos: number, dir: number, order: number[], setter: (v: number[]) => void) => {
    const np = pos + dir; if (np < 0 || np >= order.length) return;
    const no = [...order]; [no[pos], no[np]] = [no[np], no[pos]]; setter(no);
  };
  const checkSortGen = (order: number[], ok: boolean, setOk: (v: boolean) => void) => {
    if (ok) return true;
    if (order.every((v, i) => v === i)) { setOk(true); addXP(15); Alert.alert('¡Perfecto!', '+15 XP', [{ text: 'OK', onPress: goNext }]); return false; }
    Alert.alert('Incorrecto', 'Algunos pasos fuera de lugar.'); return false;
  };

  // Quiz genérico
  const selQuiz = (qi: number, oi: number) => { if (!quizChecked) setQuizAnswers((p) => ({ ...p, [qi]: oi })); };
  const checkQuizGen = (items: QuizItem[]) => {
    if (quizChecked) return true;
    if (Object.keys(quizAnswers).length < items.length) { Alert.alert('Incompleto'); return false; }
    setQuizChecked(true);
    let c = 0;
    items.forEach((q, i) => { if (quizAnswers[i] === q.correct) c++; });
    addXP(c * 8);
    Alert.alert(`${c}/${items.length} correctas`, `+${c * 8} XP`, [{ text: 'OK', onPress: goNext }]);
    return false;
  };

  // Builder genérico
  const selBuilder = (key: string, val: string, setter: (next: SetStateAction<Record<string, string>>) => void) => setter((p) => ({ ...p, [key]: val }));
  const checkBuilder = (state: Record<string, string>, cfg: { xp: number; rows: BuilderRow[] }) => {
    if (Object.keys(state).length < cfg.rows.length) { Alert.alert('Completa todas las filas'); return false; }
    addXP(cfg.xp);
    return true;
  };

  // Sprint
  const startSprint = () => {
    setSprintStarted(true); setSprintSec(90);
    sprintTimer.current = setInterval(() => {
      setSprintSec((prev) => { if (prev <= 1) { clearInterval(sprintTimer.current!); endSprint(); return 0; } return prev - 1; });
    }, 1000);
  };
  const pickSprint = (i: number) => {
    if (sprintDone || sprintPicks[i] !== undefined) return;
    const item = PITCH_SPRINT_ITEMS[i];
    setSprintPicks((p) => ({ ...p, [i]: item.good ? 'good' : 'bad' }));
    const newPicks = { ...sprintPicks, [i]: item.good ? 'good' : 'bad' };
    const good = Object.values(newPicks).filter((v) => v === 'good').length;
    const totalGood = PITCH_SPRINT_ITEMS.filter((x) => x.good).length;
    if (good >= 5 || good === totalGood) endSprint();
  };
  const endSprint = () => {
    if (sprintDone) return;
    setSprintDone(true);
    if (sprintTimer.current) clearInterval(sprintTimer.current);
    const good = Object.values(sprintPicks).filter((v) => v === 'good').length;
    const bad = Object.values(sprintPicks).filter((v) => v === 'bad').length;
    const earned = Math.max(0, good * 5 - bad * 2);
    if (earned > 0) addXP(earned);
    Alert.alert(good >= 5 ? '¡Sprint logrado!' : 'No alcanzaste la meta', `${good} buenas, ${bad} malas. +${earned} XP`);
  };

  // Scenario
  const selScenario = (i: number) => { if (!scenarioDone) setScenarioSel(i); };
  const checkScenario = () => {
    if (scenarioDone) return true;
    if (scenarioSel === null) { Alert.alert('Elige una opción'); return false; }
    setScenarioDone(true);
    const correctIdx = HARD_Q_SCN.findIndex((c) => c.correct);
    if (scenarioSel === correctIdx) addXP(12);
    Alert.alert(scenarioSel === correctIdx ? '✅ +12 XP' : '❌', HARD_Q_SCN[correctIdx].explain);
    return false;
  };

  // Drag
  const dropDrag = (idx: number, col: string) => { setDragPlaced((p) => ({ ...p, [idx]: col })); setDragSel(null); };
  const retDrag = (idx: number) => { setDragPlaced((p) => { const n = { ...p }; delete n[idx]; return n; }); };
  const checkDrag = () => {
    if (dragOk) return true;
    if (Object.keys(dragPlaced).length < slidesItems.length) { Alert.alert('Faltan'); return false; }
    setDragAttempts((p) => p + 1);
    let c = 0; const wrong: number[] = [];
    Object.entries(dragPlaced).forEach(([k, v]) => { const i = parseInt(k); if (v === slidesItems[i].correct) c++; else wrong.push(i); });
    if (c === slidesItems.length) { setDragOk(true); addXP(dragAttempts === 0 ? 20 : 10); Alert.alert('¡Genial!', `+${dragAttempts === 0 ? 20 : 10} XP`, [{ text: 'OK', onPress: goNext }]); return false; }
    Alert.alert('Revisa', `${c}/${slidesItems.length} correctas.`);
    const np = { ...dragPlaced }; wrong.forEach((i) => delete np[i]); setDragPlaced(np);
    return false;
  };

  // TF
  const selTF = (qi: number, v: boolean) => { if (!tfChecked) setTfAnswers((p) => ({ ...p, [qi]: v })); };
  const checkTF = () => {
    if (tfChecked) return true;
    if (Object.keys(tfAnswers).length < tfItems.length) { Alert.alert('Incompleto'); return false; }
    setTfChecked(true);
    let c = 0;
    tfItems.forEach((q, i) => { if (tfAnswers[i] === q.correct) c++; });
    addXP(c * 5);
    Alert.alert(`${c}/${tfItems.length} correctas`, `+${c * 5} XP`, [{ text: 'OK', onPress: goNext }]);
    return false;
  };

  // Fill
  const selFill = (i: number) => { if (!fillChecked) setFillSel(i); };
  const checkFill = () => {
    if (fillChecked) return true;
    if (fillSel === null) { Alert.alert('Elige una opción'); return false; }
    setFillChecked(true);
    if (fillSel === fillItem.correct.fb0) addXP(10);
    Alert.alert(fillSel === fillItem.correct.fb0 ? '✅ +10 XP' : '❌', fillItem.explain);
    return false;
  };

  // Compare
  const pickCompare = (which: string) => { if (!compareChecked) setCompareChoice(which); };
  const checkCompare = () => {
    if (compareChecked) return true;
    if (!compareChoice) { Alert.alert('Elige uno'); return false; }
    setCompareChecked(true);
    if (compareChoice === 'b') addXP(12);
    Alert.alert(compareChoice === 'b' ? '✅ +12 XP' : '❌', 'El B gana en TODO: dato impactante de entrada, métrica concreta, CTA específica. El A es palabras vacías sin sustento.');
    return false;
  };

  // Reflexión
  const checkReflect = (minLen: number) => {
    if (reflectVal.trim().length >= minLen) { addXP(minLen >= 150 ? 22 : 18); return true; }
    Alert.alert(`Mínimo ${minLen} caracteres`);
    return false;
  };

  // ============ RENDER ============
  const renderIntro = () => (
    <View>
      <View style={styles.iconCircle}><Text style={{ fontSize: 34 }}>🎤</Text></View>
      <Text style={styles.title}>Presenta tu Proyecto</Text>
      <Text style={styles.subtitle}>Presentar es la habilidad que multiplica todo lo demás. La idea más brillante muere en una mala presentación.</Text>
      <View style={styles.card}><Text style={styles.cardTitle}>📚 Qué vas a aprender</Text><Text style={styles.cardText}>Estructura ganadora · Decks con Gamma · Elevator pitch · Manejo de preguntas incómodas · Storytelling · Checklist día D.</Text></View>
      <View style={styles.card}><Text style={styles.cardTitle}>⚡ Qué podrás HACER</Text><Text style={styles.cardText}>Tener tu pitch de 60 segundos, deck de 5 slides, respuestas a preguntas hostiles, y mentalidad de presentador profesional.</Text></View>
    </View>
  );

  const renderTheory1 = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#eef2ff' }]}><Text style={[styles.tagText, { color: '#312e81' }]}>📖 Módulo 1 · Teoría</Text></View>
      <Text style={styles.title}>Por qué presentar bien multiplica todo</Text>
      <Text style={styles.bodyText}>Presentar es <Text style={{ fontWeight: 'bold' }}>la habilidad que multiplica todo lo demás</Text>. La idea más brillante muere en una mala presentación.</Text>
      <View style={styles.highlight}><Text style={styles.highlightText}><Text style={{ fontWeight: 'bold' }}>💡 La verdad incómoda:</Text> Los pitches ganadores no son los más originales. Son los más claros + emocionalmente honestos + demostrables.</Text></View>
      <View style={styles.card}><Text style={styles.cardTitle}>🎯 Las 5 preguntas del público</Text><Text style={styles.cardText}>1. "¿Por qué debería importarme?" → Problema con dato.{'\n'}2. "¿Qué hiciste?" → Solución clara.{'\n'}3. "¿Funciona?" → Demo.{'\n'}4. "¿Tiene tracción?" → Métricas.{'\n'}5. "¿Qué quieres de mí?" → CTA específico.</Text></View>
    </View>
  );

  const renderSort = (items: string[], order: number[], ok: boolean, onMove: (pos: number, dir: number) => void, tag: string, title: string) => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#f5f3ff' }]}><Text style={[styles.tagText, { color: '#5b21b6' }]}>{tag}</Text></View>
      <Text style={styles.title}>{title}</Text>
      {order.map((stepIdx, pos) => (
        <View key={pos} style={styles.sortItem}>
          <Text style={styles.sortNum}>{pos + 1}</Text>
          <Text style={styles.sortText}>{items[stepIdx]}</Text>
          <View style={styles.sortArrows}>
            <TouchableOpacity style={styles.sortBtn} onPress={() => onMove(pos, -1)} disabled={pos === 0}><MaterialIcons name="keyboard-arrow-up" size={18} /></TouchableOpacity>
            <TouchableOpacity style={styles.sortBtn} onPress={() => onMove(pos, 1)} disabled={pos === order.length - 1}><MaterialIcons name="keyboard-arrow-down" size={18} /></TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );

  const renderQuiz = (items: QuizItem[], tag: string) => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fef3c7' }]}><Text style={[styles.tagText, { color: '#92400e' }]}>{tag}</Text></View>
      {items.map((q, qi) => (
        <View key={qi} style={{ marginBottom: 14 }}>
          <Text style={styles.quizQ}>{qi + 1}. {q.q}</Text>
          {q.opts.map((opt, oi) => (
            <TouchableOpacity key={oi} style={[styles.quizOpt, quizAnswers[qi] === oi && { borderColor: '#4338ca', backgroundColor: '#eef2ff' }]} onPress={() => selQuiz(qi, oi)} disabled={quizChecked}>
              <Text style={styles.quizLetter}>{String.fromCharCode(65 + oi)}</Text>
              <Text style={{ flex: 1, fontSize: 12 }}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );

  const renderBuilder = (state: Record<string, string>, cfg: { xp: number; rows: BuilderRow[] }, setter: (next: SetStateAction<Record<string, string>>) => void, tag: string, title: string) => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#eef2ff' }]}><Text style={[styles.tagText, { color: '#312e81' }]}>{tag}</Text></View>
      <Text style={styles.title}>{title}</Text>
      {cfg.rows.map((row) => (
        <View key={row.key} style={{ marginBottom: 10 }}>
          <Text style={{ fontWeight: 'bold', color: '#312e81', marginBottom: 4 }}>{row.label}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
            {row.opts.map((opt) => (
              <TouchableOpacity key={opt} style={[styles.flowOpt, state[row.key] === opt && { borderColor: '#4338ca', backgroundColor: '#eef2ff' }]} onPress={() => selBuilder(row.key, opt, setter)}>
                <Text style={{ fontSize: 11 }}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
    </View>
  );

  const renderExpandCards = (cards: { emoji: string; title: string; sub: string; body: string; fact: string }[], tag: string) => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fff7ed' }]}><Text style={[styles.tagText, { color: '#9a3412' }]}>{tag}</Text></View>
      {cards.map((c, i) => (
        <View key={i} style={styles.card}>
          <Text style={styles.cardTitle}>{c.emoji} {c.title}</Text>
          <Text style={styles.cardText}>{c.body}</Text>
          <View style={[styles.highlight, { backgroundColor: '#fffbeb', borderLeftColor: '#f59e0b', marginTop: 6 }]}>
            <Text style={{ color: '#92400e', fontSize: 11 }}>{c.fact}</Text>
          </View>
        </View>
      ))}
    </View>
  );

  const renderSprint = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fee2e2' }]}><Text style={[styles.tagText, { color: '#991b1b' }]}>⏱ Módulo 9 · Sprint</Text></View>
      <Text style={styles.title}>Sprint: ¿buen o mal pitch?</Text>
      <Text style={{ fontSize: 22, fontWeight: 'bold', textAlign: 'center', color: sprintSec <= 10 ? '#dc2626' : '#c2410c', marginVertical: 8 }}>{Math.floor(sprintSec / 60)}:{String(sprintSec % 60).padStart(2, '0')}</Text>
      {!sprintStarted && !sprintDone && (
        <TouchableOpacity style={styles.nextBtn} onPress={startSprint}><Text style={styles.nextText}>⚡ Iniciar Sprint</Text></TouchableOpacity>
      )}
      {(sprintStarted || sprintDone) && PITCH_SPRINT_ITEMS.map((item, i) => (
        <TouchableOpacity
          key={i}
          style={[styles.sprintItem, sprintPicks[i] === 'good' && { borderColor: '#16a34a', backgroundColor: '#dcfce7' }, sprintPicks[i] === 'bad' && { borderColor: '#dc2626', backgroundColor: '#fef2f2' }]}
          onPress={() => pickSprint(i)}
          disabled={sprintDone || sprintPicks[i] !== undefined}
        >
          <Text style={{ flex: 1, fontSize: 11 }}>{item.text}</Text>
          <Text style={{ fontWeight: 'bold', fontSize: 11 }}>{sprintPicks[i] === 'good' ? '✅' : sprintPicks[i] === 'bad' ? '❌' : ''}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderScenarioComp = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fdf4ff' }]}><Text style={[styles.tagText, { color: '#7e22ce' }]}>🎯 Módulo 10 · Escenario</Text></View>
      <Text style={styles.title}>Preguntas incómodas: ¿cómo respondes?</Text>
      {HARD_Q_SCN.map((c, i) => (
        <TouchableOpacity key={i} style={[styles.optionBtn, scenarioSel === i && { borderColor: '#4338ca', backgroundColor: '#eef2ff' }]} onPress={() => selScenario(i)} disabled={scenarioDone}>
          <Text style={{ fontWeight: 'bold', fontSize: 12 }}>{c.title}</Text>
          <Text style={{ fontSize: 11, color: '#6b7280' }}>{c.text}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderDrag = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#eff6ff' }]}><Text style={[styles.tagText, { color: '#1e40af' }]}>🧩 Módulo 11 · Clasificar</Text></View>
      <Text style={styles.title}>Slides buenas vs malas</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {slidesItems.map((item, idx) => (
          dragPlaced[idx] === undefined && (
            <TouchableOpacity key={idx} style={[styles.chip, dragSel === idx && { borderColor: '#4338ca', backgroundColor: '#eef2ff' }]} onPress={() => setDragSel(dragSel === idx ? null : idx)}>
              <Text style={{ fontSize: 11 }}>{item.text}</Text>
            </TouchableOpacity>
          )
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['good', 'bad'] as const).map((col) => (
          <TouchableOpacity key={col} style={[styles.dropCol, { flex: 1 }]} onPress={() => { if (dragSel !== null) dropDrag(dragSel, col); }}>
            <Text style={{ fontWeight: 'bold', fontSize: 11, color: col === 'good' ? '#166534' : '#991b1b' }}>{col === 'good' ? '✅ Buena práctica' : '❌ Desastre'}</Text>
            {Object.entries(dragPlaced).filter(([, v]) => v === col).map(([k]) => (
              <TouchableOpacity key={k} style={{ backgroundColor: col === 'good' ? '#dcfce7' : '#fee2e2', padding: 4, borderRadius: 8, marginTop: 4 }} onPress={() => retDrag(parseInt(k))}>
                <Text style={{ fontSize: 10 }}>{slidesItems[parseInt(k)].text} ✕</Text>
              </TouchableOpacity>
            ))}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderReflect = (title: string, question: string, placeholder: string, minLen: number, tag: string, xpLabel: string) => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#f3f4f6' }]}><Text style={[styles.tagText, { color: '#374151' }]}>{tag} · +{xpLabel} XP</Text></View>
      <Text style={styles.title}>{title}</Text>
      <View style={[styles.card, { backgroundColor: '#faf5ff' }]}>
        <Text style={styles.cardTitle}>🤔 Tu pregunta</Text>
        <Text style={styles.cardText}>{question}</Text>
      </View>
      <TextInput style={styles.textArea} multiline placeholder={placeholder} value={reflectVal} onChangeText={setReflectVal} />
      <Text style={{ fontSize: 11, color: '#9ca3af', textAlign: 'right' }}>{reflectVal.length} / {minLen} mínimo</Text>
    </View>
  );

  const renderTF = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fef3c7' }]}><Text style={[styles.tagText, { color: '#92400e' }]}>✅ Módulo 15 · V/F</Text></View>
      <Text style={styles.title}>Mitos sobre presentar bien</Text>
      {tfItems.map((item, idx) => (
        <View key={idx} style={{ marginBottom: 14 }}>
          <Text style={styles.tfQuestion}>{idx + 1}. {item.stmt}</Text>
          <View style={{ flexDirection: 'row', gap: 7 }}>
            <TouchableOpacity style={[styles.tfBtn, tfAnswers[idx] === true && { borderColor: '#16a34a', backgroundColor: '#f0fdf4' }]} onPress={() => selTF(idx, true)} disabled={tfChecked}><Text>✅ V</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.tfBtn, tfAnswers[idx] === false && { borderColor: '#dc2626', backgroundColor: '#fef2f2' }]} onPress={() => selTF(idx, false)} disabled={tfChecked}><Text>❌ F</Text></TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );

  const renderCompare = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fef3c7' }]}><Text style={[styles.tagText, { color: '#92400e' }]}>🆚 Módulo 17 · Prompt Compare</Text></View>
      <Text style={styles.title}>Pitch genérico vs pitch ganador</Text>
      <View style={[styles.card, { backgroundColor: '#f9fafb' }]}>
        <Text style={{ fontSize: 12, lineHeight: 20 }}>🤖 PITCH GENÉRICO:{'\n'}"Hola, soy X. Construí una app revolucionaria con IA para estudiantes que les va a cambiar la vida..."</Text>
      </View>
      <View style={[styles.card, { backgroundColor: '#fff1f2', borderColor: '#fecdd3' }]}>
        <Text style={{ fontSize: 12, lineHeight: 20 }}>🎯 PITCH GANADOR:{'\n'}"7 de cada 10 estudiantes pierden tareas por desorganización. Construí Tareo. 240 estudiantes lo usan. -85% tareas tarde. Necesito 5 colegios piloto más."</Text>
      </View>
      <Text style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 8 }}>¿Cuál se queda en la mente del público?</Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <TouchableOpacity style={[styles.optionBtn, { flex: 1 }, compareChoice === 'a' && { borderColor: '#4338ca', backgroundColor: '#eef2ff' }]} onPress={() => pickCompare('a')} disabled={compareChecked}>
          <Text style={{ textAlign: 'center', fontWeight: 'bold' }}>Bot A</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.optionBtn, { flex: 1 }, compareChoice === 'b' && { borderColor: '#4338ca', backgroundColor: '#eef2ff' }]} onPress={() => pickCompare('b')} disabled={compareChecked}>
          <Text style={{ textAlign: 'center', fontWeight: 'bold' }}>Bot B</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCompletion = () => (
    <View style={{ alignItems: 'center', padding: 20 }}>
      <Text style={{ fontSize: 56 }}>🎤</Text>
      <Text style={[styles.title, { textAlign: 'center' }]}>¡Nivel 30 completado!</Text>
      <Text style={[styles.subtitle, { textAlign: 'center' }]}>Terminaste "Presenta tu Proyecto". Ahora eres Speaker Pro.</Text>
      <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#4338ca', marginVertical: 12 }}>⭐ {xp} XP</Text>
      <View style={[styles.card, { width: '100%', backgroundColor: '#eef2ff', borderColor: '#c7d2fe' }]}>
        <Text style={{ textAlign: 'center', fontWeight: 'bold', color: '#312e81' }}>🏆 Mundo 5 completado</Text>
        <Text style={{ textAlign: 'center', color: '#4338ca', fontSize: 12, marginTop: 4 }}>Construiste chatbot, automatización, idea, app, contenido y presentación.</Text>
      </View>
      <TouchableOpacity style={styles.finishBtn} onPress={handleFinish}><Text style={{ color: '#fff', fontWeight: 'bold' }}>Volver al mapa</Text></TouchableOpacity>
    </View>
  );

  // ============ RENDER PRINCIPAL ============
  const renderStep = () => {
    switch (step) {
      case 0: return renderIntro();
      case 1: return renderTheory1();
      case 2: return renderSort(WINNING_STRUCTURE, sortOrder2, sortOk2, (pos, dir) => moveSort(pos, dir, sortOrder2, setSortOrder2), '↕️ Módulo 2 · Ordenar', 'Estructura ganadora');
      case 3: return renderQuiz(gammaQItems, '❓ Módulo 3 · Quiz Gamma');
      case 4: return renderBuilder(builderDeck, BUILDER_DECK, setBuilderDeck, '🛠️ Módulo 4 · Builder', 'El deck de tu proyecto: 5 slides');
      case 5: return renderBuilder(builderPitch, BUILDER_PITCH, setBuilderPitch, '🛠️ Módulo 5 · Builder', 'Elevator pitch · 30 palabras');
      case 6: return renderBuilder(builderStory, BUILDER_STORY, setBuilderStory, '🛠️ Módulo 6 · Builder', 'Storytelling: el héroe ERES tú');
      case 7: return renderBuilder(builderHardQ, BUILDER_HARDQ, setBuilderHardQ, '🛠️ Módulo 7 · Builder', 'La IA como audiencia difícil');
      case 8: return renderExpandCards([
        { emoji: '🇨🇴', title: 'Diego, Hackathon Bogotá', sub: '', body: '17 años. Empezó con video de 15 seg de su abuelo agricultor. Después: dato, demo, cifras con 30 agricultores reales.', fact: '⭐ Premio: $5,000 USD + mentoría.' },
        { emoji: '🇲🇽', title: 'Sofía, Premio Emprendedora Joven', sub: '', body: '16 años. Cuando un jurado dijo "eso ya existe", reconoció 3 competidores, mostró diferencias y data de 60 usuarias.', fact: '⭐ La diferencia ganadora: madurez al manejar la objeción.' },
        { emoji: '🌎', title: 'Equipo de 14 años, Global Finalist', sub: '', body: 'Pitch de 4:48 exacto. Practicaron 47 veces. Cada palabra medida, cada transición ensayada.', fact: '⭐ La maestría parece natural porque está hiper-ensayada.' },
      ], '🏆 Módulo 8 · Casos ganadores');
      case 9: return renderSprint();
      case 10: return renderScenarioComp();
      case 11: return renderDrag();
      case 12: return renderReflect('Piensa tú', 'Los 3 datos que convencen: 1 dato del problema, 1 dato de tu solución, 1 dato de impacto. Identifica los TUYOS.', 'Mi dato del problema: ... Mi dato de la solución: ... Mi dato de impacto: ...', 120, '📊 Tus 3 datos clave', '18');
      case 13: return renderQuiz(feedbackQItems, '❓ Módulo 13 · Quiz feedback');
      case 14: return renderSort(PRESENTATION_CHECKLIST, sortOrder14, sortOk14, (pos, dir) => moveSort(pos, dir, sortOrder14, setSortOrder14), '↕️ Módulo 14 · Ordenar', 'El día D: checklist de 10 cosas');
      case 15: return renderTF();
      case 16: return (
        <View>
          <View style={[styles.tag, { backgroundColor: '#fce7f3' }]}><Text style={[styles.tagText, { color: '#9d174d' }]}>💬 Módulo 16 · Vocabulario</Text></View>
          <Text style={styles.title}>¿Cuál es la palabra que falta?</Text>
          <View style={[styles.card, { backgroundColor: '#faf5ff' }]}>
            <Text style={{ fontSize: 13, lineHeight: 24 }}>{fillItem.sentence.replace('_____', '_____')}</Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {fillItem.allOpts.map((opt, i) => (
              <TouchableOpacity key={i} style={[styles.fillOpt, fillSel === i && { borderColor: '#4338ca', backgroundColor: '#eef2ff' }]} onPress={() => selFill(i)} disabled={fillChecked}>
                <Text style={{ fontSize: 12, fontWeight: '600' }}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
      case 17: return renderCompare();
      case 18: return renderReflect('Piensa tú', '¿Qué lograste en este mundo que NO creías posible cuando empezaste? ¿Qué vas a hacer la próxima semana con todo lo que aprendiste?', 'Lo que logré que NO creía posible: ... Lo que voy a hacer: ...', 150, '🎓 Cierre Mundo 5', '22');
      case 19: return renderCompletion();
      default: return null;
    }
  };

  const progress = (step / (TOTAL_STEPS - 1)) * 100;

  const handleMain = () => {
    const handlers: Record<number, (() => boolean) | undefined> = {
      2: () => checkSortGen(sortOrder2, sortOk2, setSortOk2),
      3: () => checkQuizGen(gammaQItems),
      4: () => checkBuilder(builderDeck, BUILDER_DECK),
      5: () => checkBuilder(builderPitch, BUILDER_PITCH),
      6: () => checkBuilder(builderStory, BUILDER_STORY),
      7: () => checkBuilder(builderHardQ, BUILDER_HARDQ),
      9: () => sprintDone,
      10: checkScenario,
      11: checkDrag,
      12: () => checkReflect(120),
      13: () => checkQuizGen(feedbackQItems),
      14: () => checkSortGen(sortOrder14, sortOk14, setSortOk14),
      15: checkTF,
      16: checkFill,
      17: checkCompare,
      18: () => checkReflect(150),
    };
    const h = handlers[step];
    if (h) { if (!h()) return; }
    goNext();
  };

  const showNext = step < TOTAL_STEPS - 1 && ![2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].includes(step);
  const showCheck = [2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].includes(step) && step < TOTAL_STEPS - 1;

  return (
    <View style={styles.screen}>
      <View style={styles.progressBar}>
        <TouchableOpacity onPress={handleClose}><MaterialIcons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
        <Text style={styles.xpText}>{xp} XP</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>{renderStep()}</ScrollView>
      {showNext && <TouchableOpacity style={styles.nextBtn} onPress={goNext}><Text style={styles.nextText}>Continuar →</Text></TouchableOpacity>}
      {showCheck && <TouchableOpacity style={styles.nextBtn} onPress={handleMain}><Text style={styles.nextText}>Comprobar</Text></TouchableOpacity>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  progressBar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  progressTrack: { flex: 1, height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, marginHorizontal: 12 },
  progressFill: { height: '100%', backgroundColor: '#4338ca', borderRadius: 3 },
  xpText: { fontWeight: 'bold', fontSize: 14, color: '#854d0e' },
  scroll: { padding: 16, paddingBottom: 40 },
  tag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 12 },
  tagText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  iconCircle: { width: 60, height: 60, borderRadius: 18, backgroundColor: '#eef2ff', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  title: { ...typography.extraBold, fontSize: 19, color: '#111827', marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#6b7280', marginBottom: 14, lineHeight: 18 },
  bodyText: { fontSize: 13, color: '#374151', lineHeight: 20, marginBottom: 12 },
  card: { backgroundColor: '#f9fafb', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  cardTitle: { fontWeight: 'bold', fontSize: 13, color: '#111827', marginBottom: 4 },
  cardText: { fontSize: 13, color: '#374151', lineHeight: 20 },
  highlight: { borderLeftWidth: 3, borderLeftColor: '#4338ca', borderRadius: 4, padding: 11, marginVertical: 8 },
  highlightText: { color: '#312e81', fontSize: 13, lineHeight: 20 },
  chip: { padding: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#d1d5db', backgroundColor: '#fff', marginBottom: 4 },
  dropCol: { borderWidth: 2, borderStyle: 'dashed', borderColor: '#d1d5db', borderRadius: 12, padding: 8, minHeight: 60 },
  sortItem: { flexDirection: 'row', alignItems: 'center', padding: 11, backgroundColor: '#f9fafb', borderRadius: 12, borderWidth: 1.5, borderColor: '#e5e7eb', marginBottom: 8 },
  sortNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#4338ca', textAlign: 'center', lineHeight: 26, color: '#fff', fontWeight: 'bold', fontSize: 11, marginRight: 9 },
  sortText: { flex: 1, fontSize: 12, color: '#374151' },
  sortArrows: { flexDirection: 'column', gap: 3 },
  sortBtn: { width: 28, height: 26, borderRadius: 7, borderWidth: 1, borderColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center' },
  quizQ: { fontWeight: 'bold', fontSize: 13, padding: 11, backgroundColor: '#f9fafb', borderRadius: 10, marginBottom: 8 },
  quizOpt: { flexDirection: 'row', alignItems: 'center', padding: 10, borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10, marginBottom: 6, gap: 9 },
  quizLetter: { width: 22, height: 22, borderRadius: 6, backgroundColor: '#f3f4f6', textAlign: 'center', lineHeight: 22, fontSize: 10, fontWeight: 'bold' },
  tfQuestion: { fontWeight: 'bold', fontSize: 13, padding: 11, backgroundColor: '#f9fafb', borderRadius: 10, marginBottom: 8 },
  tfBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 2, borderColor: '#e5e7eb', alignItems: 'center' },
  optionBtn: { padding: 12, borderRadius: 12, borderWidth: 2, borderColor: '#e5e7eb', marginBottom: 8, backgroundColor: '#f9fafb' },
  flowOpt: { padding: 7, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#fff', marginBottom: 4 },
  sprintItem: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#fed7aa', marginBottom: 6, backgroundColor: '#fff' },
  fillOpt: { padding: 8, paddingHorizontal: 13, borderRadius: 10, borderWidth: 1.5, borderColor: '#d1d5db', backgroundColor: '#fff' },
  textArea: { borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 13, minHeight: 100, textAlignVertical: 'top', marginBottom: 8 },
  nextBtn: { backgroundColor: '#4338ca', padding: 14, margin: 16, borderRadius: 11, alignItems: 'center' },
  nextText: { fontWeight: 'bold', color: '#fff', fontSize: 15 },
  finishBtn: { backgroundColor: '#4338ca', padding: 14, borderRadius: 11, width: '100%', alignItems: 'center', marginTop: 14 },
});