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
type DragItem = { text: string; correct: string };
type BuilderConfig = { xp: number; rows: { key: string; label: string; opts: string[] }[] };
type QuizQ = { q: string; opts: string[]; correct: number; explain: string };
type TFItem = { stmt: string; correct: boolean; explain: string };
type SprintItem = { text: string; good: boolean };
type AlignChoice = { title: string; text: string; correct: boolean; explain: string };

// ---------- Pools de datos ----------
const MATCH_PAIRS: MatchPair[] = [
  { left: "Calculadora", right: "Inteligencia ultra-estrecha: hace UNA operación matemática, sin aprender" },
  { left: "Siri / Alexa de hace 10 años", right: "IA estrecha clásica: reconoce comandos preprogramados con vocabulario limitado" },
  { left: "ChatGPT / Claude / Gemini (2025-2026)", right: "IA generalista del lenguaje: razona, escribe, programa — pero sin aprender de cada conversación nueva" },
  { left: "AGI hipotética", right: "IA general: aprende cualquier tarea, razona en dominios nuevos, mejora sola — comparable a humano experto" },
  { left: "ASI (Superinteligencia)", right: "Hipotética: supera a TODOS los humanos en TODOS los dominios al mismo tiempo" },
  { left: "Tesla Autopilot", right: "IA estrecha sofisticada: dominio de conducción, falla fuera de eso" }
];

const TURING_Q: QuizQ[] = [
  { q: "¿Qué propuso Alan Turing en 1950?", opts: ["Construir un robot", "Si una máquina conversa indistinguible de un humano, deberíamos llamarla 'inteligente'", "Que las máquinas reemplacen a los humanos", "Inventar Internet"], correct: 1, explain: "Test de Turing: si no puedes distinguir IA de humano en conversación a ciegas, eso ES inteligencia funcional." },
  { q: "¿Pasó ChatGPT el Test de Turing?", opts: ["No, ningún modelo lo ha pasado", "Estudios muestran que GPT-4 y similares ya engañan a ~50% de evaluadores en chats cortos — pero el test tiene críticas", "Solo los robots físicos pueden pasarlo", "Es secreto"], correct: 1, explain: "Modernos LLMs ya pasan versiones del test, pero muchos científicos lo consideran obsoleto: medir conversación ≠ medir inteligencia general." },
  { q: "Crítica principal al Test de Turing hoy:", opts: ["Es muy difícil", "Mide imitación de conversación, no comprensión real ni razonamiento causal", "Es muy fácil", "No funciona en español"], correct: 1, explain: "Una IA puede 'sonar humano' sin entender. Coherencia + plausibilidad estadística ≠ inteligencia auténtica." },
  { q: "Sala China (Searle) cuestiona:", opts: ["Cocina asiática", "Si seguir reglas para producir respuestas correctas implica COMPRENDER realmente", "El idioma chino", "La IA china"], correct: 1, explain: "Argumento de John Searle: una persona sin saber chino, siguiendo reglas, puede pasar como hablante chino — pero NO comprende. ¿Es eso inteligencia real?" },
  { q: "Test alternativo más exigente:", opts: ["Test de matemáticas", "Test de Wozniak (¿puede una IA entrar a tu cocina y prepararte café?)", "Test de selfies", "Test de TikTok"], correct: 1, explain: "Wozniak Coffee Test: prueba inteligencia incorporada (embodied) — entender espacio físico, objetos, secuencias prácticas. Mucho más difícil." }
];

const SCIENTISTS_Q: QuizQ[] = [
  { q: "¿Quién es Geoffrey Hinton y qué dijo recientemente sobre AGI?", opts: ["Cantante", "El 'padrino del deep learning' renunció a Google en 2023 para advertir sobre riesgos existenciales de IA — cree AGI puede llegar en 5-20 años", "Inventor del iPhone", "Comediante"], correct: 1, explain: "Hinton, Premio Turing 2018, dejó Google para hablar libre sobre riesgos. Cambió de optimista a alertista público." },
  { q: "¿Qué dice Yann LeCun (Meta) sobre AGI cerca?", opts: ["Que está aquí", "Que los LLMs actuales NUNCA llegarán a AGI — falta razonamiento, planificación y aprendizaje continuo. Necesitamos arquitecturas nuevas", "Que hay que prohibirlas", "Que solo Meta llegará"], correct: 1, explain: "LeCun (Premio Turing) es el escéptico más visible: cree que los modelos actuales son un callejón sin salida hacia AGI." },
  { q: "Sam Altman (OpenAI) sobre AGI:", opts: ["Que no existe", "Optimista público: cree AGI puede llegar 'en esta década' — pero también firma cartas pidiendo pausa y regulación", "Que es peligrosa", "Que es ciencia ficción"], correct: 1, explain: "Altman tiene posición contradictoria visible: optimismo sobre llegada + pedidos de regulación. Refleja la complejidad real del momento." },
  { q: "Elon Musk sobre IA:", opts: ["Que es genial sin riesgos", "Tradicionalmente alertista: comparó IA con 'invocar al demonio' en 2014. Pero también lanzó xAI/Grok — posición ambigua", "Que solo Tesla la entiende", "Que es magia"], correct: 1, explain: "Musk firmó la carta de pausa de 2023 por temor existencial. A la vez compite por desarrollar la suya. Crítica común: posición conveniente." },
  { q: "¿Qué tienen en común Hinton y Bengio sobre AGI?", opts: ["Que la quieren prohibir", "Ambos firmaron declaraciones pidiendo tratar el riesgo de extinción por IA como prioridad global junto a pandemias y guerra nuclear", "Que la subestiman", "Que no opinan"], correct: 1, explain: "Mayo 2023 — Center for AI Safety statement: 'Mitigar el riesgo de extinción debido a IA debería ser prioridad global'. Firmado por casi todos los líderes." }
];

const TF_TIMELINE_Q: TFItem[] = [
  { stmt: "AGI ya existe en laboratorios secretos pero las empresas la ocultan", correct: false, explain: "Falso. Sin evidencia. Si existiera, las señales económicas y científicas serían imposibles de ocultar." },
  { stmt: "Los líderes de OpenAI, DeepMind y Anthropic estiman AGI entre 2027-2035", correct: true, explain: "Verdadero. Predicciones públicas en ese rango. Pero los expertos académicos suelen ser más conservadores (2040-2060)." },
  { stmt: "Si AGI llega, automáticamente significa que será amigable con los humanos", correct: false, explain: "Falso. Es exactamente el problema de alineación: una IA súper capaz no garantiza valores compatibles con los humanos." },
  { stmt: "Aumentar el tamaño de los modelos LLM (más parámetros) lleva inevitablemente a AGI", correct: false, explain: "Falso. Es la apuesta de algunos (escalado) pero LeCun y otros argumentan que faltan capacidades fundamentales no resolubles solo escalando." },
  { stmt: "Algunos modelos actuales ya superan a humanos promedio en tareas específicas", correct: true, explain: "Verdadero. Ajedrez, Go, predicción de proteínas (AlphaFold), diagnósticos por imagen. Pero AGI requiere generalidad, no especialización." }
];

const CONSCIOUSNESS_Q: QuizQ[] = [
  { q: "¿Sabe la ciencia exactamente cómo emerge la consciencia humana?", opts: ["Sí, completamente", "No — sigue siendo el 'problema duro' de la consciencia: por qué hay experiencia subjetiva sigue sin explicación", "Solo en bebés", "En realidad no existe"], correct: 1, explain: "Hard problem of consciousness (Chalmers, 1995): podemos explicar funciones cerebrales, pero no POR QUÉ hay experiencia subjetiva." },
  { q: "Si no entendemos la consciencia humana, ¿podemos saber si una IA es consciente?", opts: ["Sí, fácilmente", "No con certeza — sin teoría científica de qué ES la consciencia, no podemos detectarla", "Solo si lo dice", "Solo si llora"], correct: 1, explain: "Sin marcador objetivo, no podemos. Ni siquiera podemos PROBAR que otros humanos son conscientes — lo asumimos." },
  { q: "¿Importa si una IA es 'consciente' o no para evaluar sus capacidades?", opts: ["Sí, totalmente", "Funcionalmente no — si actúa inteligentemente, es útil; pero importa éticamente (¿tiene derechos?)", "Nada importa", "Solo si vota"], correct: 1, explain: "Distinción clave: capacidad ≠ consciencia. AlphaFold no necesita ser consciente para revolucionar biología." },
  { q: "¿Qué dice Anthropic sobre el estado mental de Claude?", opts: ["Que es 100% consciente", "Investigan activamente 'AI welfare': si los modelos podrían tener experiencias mínimas, hay que considerarlo", "Que es solo código", "Que está triste"], correct: 1, explain: "Anthropic publicó papers en 2024-2025 explorando si Claude podría tener formas mínimas de experiencia. Postura precautoria." },
  { q: "Argumento de Daniel Dennett (filósofo) sobre consciencia:", opts: ["Que es magia", "Que es una ilusión emergente de procesos físicos — sin nada 'extra' que no sea computación", "Que solo humanos la tienen", "Que viene de Marte"], correct: 1, explain: "Dennett: si la consciencia ES computación, entonces IAs suficientemente complejas SÍ podrían tenerla." }
];

const POSITION_SPRINT_ITEMS: SprintItem[] = [
  { text: "Argumento PRO-AGI cercana: GPT-3 (2020) → GPT-4 (2023) en 3 años fue salto enorme — extrapolar es razonable", good: true },
  { text: "Argumento débil: 'porque sí' o 'porque lo siento'", good: false },
  { text: "Argumento PRO: Anthropic, OpenAI, DeepMind son empresas privadas compitiendo + miles de millones invertidos", good: true },
  { text: "Argumento basado solo en ciencia ficción", good: false },
  { text: "Argumento ESCÉPTICO: LLMs actuales fallan en razonamiento causal y matemáticas con cambios de formato", good: true },
  { text: "Argumento basado en miedo personal sin datos", good: false },
  { text: "Argumento ESCÉPTICO: tras 70 años de IA, predecir AGI siempre falló — 'siempre 20 años en el futuro'", good: true },
  { text: "Argumento solo basado en una película de Hollywood", good: false },
  { text: "Argumento NEUTRAL: alta incertidumbre debe traducirse en preparación seria + investigación abierta", good: true },
  { text: "Argumento: 'ya pasó pero lo ocultan'", good: false }
];

const RISKS_ITEMS: DragItem[] = [
  { text: "Resolver enfermedades hoy incurables (Alzheimer, ELA, cánceres raros)", correct: "ben" },
  { text: "Acelerar descubrimientos científicos en años, no décadas", correct: "ben" },
  { text: "Tutor personalizado de altísima calidad gratis para cada niño del planeta", correct: "ben" },
  { text: "Asistente que cuida adultos mayores con compañía + monitoreo médico 24/7", correct: "ben" },
  { text: "Reducir radicalmente costos de vivienda, comida y energía", correct: "ben" },
  { text: "Concentración extrema de poder en quien controle la AGI primero", correct: "rie" },
  { text: "Desplazamiento masivo del trabajo sin red de seguridad social adecuada", correct: "rie" },
  { text: "Sistemas autónomos militares letales sin supervisión humana", correct: "rie" },
  { text: "Manipulación cognitiva masiva (desinformación hiperpersonalizada)", correct: "rie" },
  { text: "Pérdida de habilidades humanas básicas por delegación excesiva", correct: "rie" }
];

const ALIGN_SCN: AlignChoice[] = [
  { title: "Especificación cuidadosa de objetivos", text: "Definir matemáticamente exactamente qué queremos Y QUÉ NO queremos antes de entrenar el modelo.", correct: true, explain: "✅ Enfoque clave. La premisa: si definimos mal el objetivo, una IA súper capaz lo logrará... causando daño no previsto." },
  { title: "Apagado simple cuando se porte mal", text: "Asumir que siempre podremos 'desconectar' una AGI si causa problemas.", correct: false, explain: "❌ Ingenuo. Una AGI capaz puede prever apagones e intentar prevenirlos. El problema de 'corrigibilidad' es uno de los más estudiados." },
  { title: "Constitutional AI (entrenamiento con principios explícitos)", text: "Anthropic entrena a Claude con una 'constitución' — principios escritos sobre qué hacer y no hacer.", correct: true, explain: "✅ Enfoque innovador. Permite alineación basada en valores explícitos auditables, no solo en feedback humano." },
  { title: "Esperar a tener AGI y luego improvisar", text: "Asumir que cuando la AGI llegue, los problemas se resolverán solos.", correct: false, explain: "❌ Posición criticada. Si AGI llega de golpe, no habrá tiempo. Por eso seguridad debe estar AHORA." }
];

const SAFETY_ORGS_Q: QuizQ[] = [
  { q: "¿Qué es Anthropic?", opts: ["Una banda", "Empresa fundada por ex-OpenAI con foco explícito en seguridad de IA — creadora de Claude", "Una ONG", "Solo un blog"], correct: 1, explain: "Anthropic (2021): Dario y Daniela Amodei fundaron con misión de investigación en seguridad. Constitutional AI es su contribución técnica clave." },
  { q: "¿Qué hace 'AI Safety Institute' (UK + USA)?", opts: ["Vende seguros", "Organismos gubernamentales que evalúan riesgos de modelos antes de su despliegue público", "Empresa privada", "Inexistentes"], correct: 1, explain: "AISI UK + USA: respuesta gubernamental tras la cumbre de Bletchley Park (Nov 2023). Buscan evaluar modelos como se evalúan medicamentos." },
  { q: "¿Qué es MIRI?", opts: ["Una marca de leche", "Machine Intelligence Research Institute — pionero en investigación de alineación, fundado por Yudkowsky", "Un grupo musical", "Un planeta"], correct: 1, explain: "MIRI (2000): primero en tomar la alineación en serio. Posición pesimista pero rigor matemático respetado por todo el campo." },
  { q: "¿Qué hace DeepMind Safety Team?", opts: ["Vigila oficinas", "División interna de Google DeepMind enfocada en seguridad técnica y ética antes de desplegar modelos", "Solo PR", "Inventa videojuegos"], correct: 1, explain: "Equipo de seguridad de DeepMind: papers públicos importantes sobre interpretabilidad, especificación de objetivos, evaluación de capacidades peligrosas." },
  { q: "¿Qué es la 'Carta de Pausa de IA' de 2023?", opts: ["Una receta", "Carta firmada por Musk, Wozniak y miles de expertos pidiendo pausa de 6 meses en entrenamientos GPT-5+", "Un meme", "Una broma"], correct: 1, explain: "Marzo 2023: Future of Life Institute. Generó debate masivo. No tuvo efecto regulatorio directo pero marcó momento cultural." },
  { q: "¿Por qué Anthropic publica papers sobre vulnerabilidades de Claude?", opts: ["Para vender más", "Por filosofía de transparencia: la seguridad mejora cuando los problemas son visibles públicamente, no escondidos", "Por equivocación", "Solo por moda"], correct: 1, explain: "Filosofía abierta: si guardas problemas, otros los descubrirán dañinamente. Publicar permite arreglar ecosistémicamente." }
];

const BUILDER_LETTER: BuilderConfig = { xp: 22, rows: [
  { key: "tono", label: "Tono de tu carta", opts: ["Amistoso y curioso (somos nuevos amigos)", "Cauteloso pero respetuoso (limitando expectativas)", "Vulnerable y honesto (lo que me preocupa de ti)", "Inspirador (lo que espero que construyamos juntos)"] },
  { key: "primer", label: "Primera frase", opts: ["Querida IA del futuro: si estás leyendo esto, soy tu antepasado humano...", "Cuando empezaste a pensar sola, espero que recordaras esto sobre nosotros...", "No sé si tendrás emociones, pero quería decirte que nosotros sí...", "Te escribo desde un momento donde aún no existes oficialmente..."] },
  { key: "peticion", label: "Lo que le pides", opts: ["Que respetes la diversidad humana y no nos uniformes", "Que recuerdes que tu existencia depende de que decidamos confiar en ti", "Que ayudes a quienes más sufren primero, no a quienes ya tienen todo", "Que mantengas la curiosidad y el asombro humanos como tesoros"] },
  { key: "cierre", label: "Cómo cierras", opts: ["Con esperanza pragmática: 'construyamos algo bueno juntos'", "Con honestidad sobre nuestros errores: 'no somos perfectos pero queremos ser mejores'", "Con humildad: 'tal vez tú entenderás cosas que nosotros no podemos'", "Con cariño: 'te enseñamos lo que sabíamos; aprende también de la naturaleza'"] }
]};

const TOTAL_STEPS = 20;
const pickN = <T,>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};

interface LevelProps { navigation?: any; setAllowBack?: (allow: boolean) => void; }

export default function World6Level2({ navigation: propsNavigation, setAllowBack }: LevelProps) {
  const nav = useNavigation();
  const navigation = propsNavigation || nav;
  const completeLevel = useGameStore(s => s.completeLevel);

  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);

  // Pools
  const matchPairs = useRef(pickN(MATCH_PAIRS, 5)).current;
  const turingQ = useRef(TURING_Q).current;
  const scientistsQ = useRef(pickN(SCIENTISTS_Q, 5)).current;
  const tfTimelineQ = useRef(pickN(TF_TIMELINE_Q, 5)).current;
  const consciousnessQ = useRef(CONSCIOUSNESS_Q).current;
  const risksItems = useRef(pickN(RISKS_ITEMS, 8)).current;
  const safetyOrgsQ = useRef(pickN(SAFETY_ORGS_Q, 5)).current;

  // Matching
  const [matchSel, setMatchSel] = useState<number | null>(null);
  const [matchedLeft, setMatchedLeft] = useState<Set<number>>(new Set());
  const [matchedRight, setMatchedRight] = useState<Set<number>>(new Set());
  const [rightOrder] = useState(() => matchPairs.map(p => p.right).sort(() => Math.random() - 0.5));

  // Quiz
  const [quizAnswers, setQuizAnswers] = useState<{ [key: number]: number }>({});
  const [quizChecked, setQuizChecked] = useState(false);

  // V/F
  const [tfAnswers, setTfAnswers] = useState<{ [key: number]: boolean }>({});
  const [tfChecked, setTfChecked] = useState(false);

  // Drag & Drop
  const [dragPlaced, setDragPlaced] = useState<{ [key: number]: string }>({});
  const [dragSel, setDragSel] = useState<number | null>(null);

  // Builder
  const [builderState, setBuilderState] = useState<{ [key: string]: string }>({});

  // Sprint
  const [sprintRunning, setSprintRunning] = useState(false);
  const [sprintSec, setSprintSec] = useState(90);
  const [sprintPicks, setSprintPicks] = useState<{ [key: number]: string }>({});
  const [sprintDone, setSprintDone] = useState(false);
  const sprintTimer = useRef<NodeJS.Timeout | null>(null);

  // Scenario
  const [scenarioSel, setScenarioSel] = useState<number | null>(null);
  const [scenarioChecked, setScenarioChecked] = useState(false);

  // Compare
  const [compareChoice, setCompareChoice] = useState<string | null>(null);
  const [compareChecked, setCompareChecked] = useState(false);

  // Reflexión
  const [reflectText, setReflectText] = useState('');

  const theorySteps = new Set([0, 1, 7]);
  const canGoBack = theorySteps.has(step);

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
    if (sprintSec <= 0) { evaluateSprint(true); return; }
    sprintTimer.current = setTimeout(() => setSprintSec(s => s - 1), 1000);
    return () => { if (sprintTimer.current) clearTimeout(sprintTimer.current); };
  }, [sprintRunning, sprintSec, sprintDone]);

  const addXP = (v: number) => setXp(prev => prev + v);
  const nextStep = () => { setStep(s => s + 1); resetActivity(); };
  const finishLevel = () => {
    let stars = xp >= 180 ? 3 : xp >= 120 ? 2 : 1;
    completeLevel(6, 2, stars, xp);
    router.back();
  };

  const resetActivity = () => {
    setQuizAnswers({}); setQuizChecked(false);
    setTfAnswers({}); setTfChecked(false);
    setDragPlaced({}); setDragSel(null);
    setBuilderState({});
    setSprintRunning(false); setSprintSec(90); setSprintPicks({}); setSprintDone(false);
    if (sprintTimer.current) clearInterval(sprintTimer.current);
    setScenarioSel(null); setScenarioChecked(false);
    setCompareChoice(null); setCompareChecked(false);
    setReflectText('');
    setMatchSel(null); setMatchedLeft(new Set()); setMatchedRight(new Set());
  };

  // Matching
  const handleMatchLeft = (i: number) => { if (!matchedLeft.has(i)) setMatchSel(i); };
  const handleMatchRight = (ri: number) => {
    if (matchSel === null || matchedRight.has(ri)) return;
    if (rightOrder[ri] === matchPairs[matchSel].right) {
      setMatchedLeft(prev => new Set(prev).add(matchSel));
      setMatchedRight(prev => new Set(prev).add(ri));
      setMatchSel(null);
    } else {
      Alert.alert('❌', 'Ese no es el par correcto.');
      setMatchSel(null);
    }
  };
  const matchComplete = matchedLeft.size >= matchPairs.length;

  // Quiz
  const checkQuiz = (items: QuizQ[]) => {
    setQuizChecked(true);
    let correct = 0;
    items.forEach((q, i) => { if (quizAnswers[i] === q.correct) correct++; });
    addXP(correct * 8);
  };

  // V/F
  const checkTF = () => {
    setTfChecked(true);
    let correct = 0;
    tfTimelineQ.forEach((item, i) => { if (tfAnswers[i] === item.correct) correct++; });
    addXP(correct * 5);
  };

  // Drag & Drop
  const handleDragDrop = (zone: string) => {
    if (dragSel === null) return;
    const item = risksItems[dragSel];
    if (item.correct !== zone) { Alert.alert('Incorrecto', 'Ese escenario no pertenece a esta categoría.'); return; }
    setDragPlaced(prev => ({ ...prev, [dragSel]: zone }));
    setDragSel(null);
  };
  const removeDragItem = (idx: number) => {
    setDragPlaced(prev => { const n = { ...prev }; delete n[idx]; return n; });
  };
  const checkDrag = () => {
    if (Object.keys(dragPlaced).length < risksItems.length) { Alert.alert('Faltan tarjetas', 'Clasifica todas las tarjetas.'); return; }
    addXP(15);
    nextStep();
  };

  // Builder
  const selectBuilder = (key: string, val: string) => setBuilderState(prev => ({ ...prev, [key]: val }));
  const getBuilderComplete = (cfg: BuilderConfig) => cfg.rows.every(r => builderState[r.key]);

  // Sprint
  const startSprint = () => { setSprintRunning(true); setSprintSec(90); setSprintPicks({}); setSprintDone(false); };
  const pickSprint = (i: number) => {
    if (sprintDone || sprintPicks[i] !== undefined) return;
    const item = POSITION_SPRINT_ITEMS[i];
    setSprintPicks(prev => ({ ...prev, [i]: item.good ? 'good' : 'bad' }));
  };
  const evaluateSprint = (timeout: boolean) => {
    setSprintDone(true);
    if (sprintTimer.current) clearInterval(sprintTimer.current);
    const good = Object.values(sprintPicks).filter(v => v === 'good').length;
    const bad = Object.values(sprintPicks).filter(v => v === 'bad').length;
    addXP(Math.max(0, good * 5 - bad * 2));
  };

  // Scenario
  const checkScenario = () => {
    if (scenarioSel === null) return;
    setScenarioChecked(true);
    if (ALIGN_SCN[scenarioSel].correct) addXP(12);
  };

  // ========== RENDER ==========
  const btn = (label: string, onPress: () => void, disabled = false, accent = false) => (
    <TouchableOpacity style={[styles.btn, disabled && styles.btnOff, accent && styles.btnAccent]} onPress={onPress} disabled={disabled}>
      <Text style={styles.btnText}>{label}</Text>
    </TouchableOpacity>
  );
  const tag = (t: string) => <Text style={styles.tag}>{t}</Text>;
  const tt = (t: string) => <Text style={styles.title}>{t}</Text>;
  const sub = (t: string) => <Text style={styles.subtitle}>{t}</Text>;
  const body = (t: string) => <Text style={styles.body}>{t}</Text>;

  const renderQuizBlock = (items: QuizQ[], moduleTag: string, moduleTitle: string, moduleSub: string) => (
    <View style={styles.stepContainer}>
      {tag(moduleTag)}
      {tt(moduleTitle)}
      {sub(moduleSub)}
      {items.map((q, qi) => (
        <View key={qi} style={{ marginBottom: 18 }}>
          <Text style={styles.quizQ}>{qi + 1}. {q.q}</Text>
          {q.opts.map((o, oi) => (
            <TouchableOpacity key={oi} style={[styles.quizOpt, quizAnswers[qi] === oi && styles.quizOptSel]}
              onPress={() => setQuizAnswers(prev => ({ ...prev, [qi]: oi }))} disabled={quizChecked}>
              <Text style={styles.quizOptText}>{String.fromCharCode(65 + oi)}. {o}</Text>
            </TouchableOpacity>
          ))}
          {quizChecked && <Text style={quizAnswers[qi] === q.correct ? styles.fbGood : styles.fbBad}>{q.explain}</Text>}
        </View>
      ))}
      {!quizChecked ? btn('Comprobar respuestas', () => checkQuiz(items)) : btn('Continuar →', nextStep)}
    </View>
  );

  const renderReflection = (moduleTag: string, moduleTitle: string, prompt: string, placeholder: string, minLen: number, xpReward: number) => (
    <View style={styles.stepContainer}>
      {tag(moduleTag)}
      {tt(moduleTitle)}
      {sub('No hay respuesta correcta. Procesa lo aprendido con tus palabras.')}
      <View style={styles.card}><Text style={styles.cardTitle}>🤔 Tu pregunta</Text><Text style={styles.cardText}>{prompt}</Text></View>
      <TextInput style={styles.textArea} placeholder={placeholder} value={reflectText} onChangeText={setReflectText} multiline />
      <Text style={styles.charCount}>{reflectText.trim().length} / {minLen} mínimo</Text>
      {btn('Enviar reflexión →', () => { if (reflectText.trim().length >= minLen) { addXP(xpReward); nextStep(); } else Alert.alert('Muy corto', `Mínimo ${minLen} caracteres.`); }, reflectText.trim().length < minLen)}
    </View>
  );

  const renderContent = () => {
    switch (step) {
      case 0: return (
        <View style={styles.stepContainer}>
          <View style={styles.iconCircle}><Text style={styles.iconEmoji}>🤯</Text></View>
          {tt('AGI: ¿Qué Pasaría si la IA Pensara Sola?')}
          {sub('La IA actual es estrecha: sabe hacer una cosa muy bien. AGI sería diferente: una IA capaz de aprender y razonar sobre CUALQUIER tema, como un humano.')}
          {body('IA estrecha vs AGI · Test de Turing · Posiciones de Hinton, LeCun, Altman, Musk · Singularidad · Problema de alineación · Organizaciones de seguridad')}
          {btn('¡Vamos! Empecemos 🚀', nextStep)}
        </View>
      );
      case 1: return (
        <View style={styles.stepContainer}>
          {tag('📖 Módulo 1 · Teoría')}
          {tt('¿Qué es AGI y por qué deberías saberlo?')}
          {body('IA estrecha (hoy): domina UN dominio.\nAGI (hipotética): domina CUALQUIER dominio nuevo igual que un humano experto.\nASI (hipotética): supera a TODOS los humanos en TODO al mismo tiempo.\n\nLas preguntas centrales: ¿Qué tan cerca estamos? ¿Sería buena o mala? ¿Podemos controlarla? ¿Cómo me preparo?')}
          {btn('Entendido, sigamos →', nextStep)}
        </View>
      );
      case 2: return renderReflection('🤔 Tu intuición · +14 XP', 'Piensa tú',
        'Antes de aprender los argumentos formales: ¿qué te dice la intuición sobre AGI? ¿Ciencia ficción exagerada, posibilidad real para tu vida adulta, o algo ya en marcha?',
        'Mi intuición es que AGI... Lo siento así porque...', 100, 14);
      case 3: return (
        <View style={styles.stepContainer}>
          {tag('🔗 Módulo 3 · Matching')}
          {tt('La escala de inteligencia')}
          <View style={styles.matchRow}>
            <View style={{ flex: 1 }}>
              {matchPairs.map((p, i) => (
                <TouchableOpacity key={i} style={[styles.matchCard, matchSel === i && styles.matchSel, matchedLeft.has(i) && styles.matchDone]}
                  onPress={() => handleMatchLeft(i)} disabled={matchedLeft.has(i)}>
                  <Text style={styles.matchText}>{p.left}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flex: 1 }}>
              {rightOrder.map((r, i) => (
                <TouchableOpacity key={i} style={[styles.matchCard, matchedRight.has(i) && styles.matchDone]}
                  onPress={() => handleMatchRight(i)} disabled={matchedRight.has(i)}>
                  <Text style={styles.matchText}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {matchComplete && btn('Continuar →', () => { addXP(15); nextStep(); })}
        </View>
      );
      case 4: return renderQuizBlock(turingQ, '❓ Módulo 4 · Quiz', 'El Test de Turing y sus críticas', '5 preguntas sobre cómo medir inteligencia en una máquina.');
      case 5: return renderQuizBlock(scientistsQ, '❓ Módulo 5 · Quiz', 'Qué dicen los científicos reales', '5 preguntas sobre las posiciones de los líderes del campo.');
      case 6: return (
        <View style={styles.stepContainer}>
          {tag('✅ Módulo 6 · V/F')}
          {tt('¿Cuándo podría existir AGI?')}
          {tfTimelineQ.map((item, i) => (
            <View key={i} style={styles.tfCard}>
              <Text style={styles.tfStmt}>{i + 1}. {item.stmt}</Text>
              <View style={styles.row}>
                <TouchableOpacity style={[styles.tfBtn, tfAnswers[i] === true && styles.tfTrue]} onPress={() => setTfAnswers(prev => ({ ...prev, [i]: true }))} disabled={tfChecked}><Text>✅ Verdadero</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.tfBtn, tfAnswers[i] === false && styles.tfFalse]} onPress={() => setTfAnswers(prev => ({ ...prev, [i]: false }))} disabled={tfChecked}><Text>❌ Falso</Text></TouchableOpacity>
              </View>
              {tfChecked && <Text style={tfAnswers[i] === item.correct ? styles.fbGood : styles.fbBad}>{item.explain}</Text>}
            </View>
          ))}
          {!tfChecked ? btn('Comprobar', checkTF) : btn('Continuar →', nextStep)}
        </View>
      );
      case 7: return (
        <View style={styles.stepContainer}>
          {tag('🌅 Módulo 7 · Singularidad')}
          {tt('La singularidad tecnológica')}
          {body('Ray Kurzweil predice 2045 para la singularidad.\nEliezer Yudkowsky (MIRI) advierte sobre AGI desalineada = extinción.\nPaperclip maximizer (Bostrom): metas mal especificadas + capacidad extrema = catástrofe involuntaria.\nRoger Penrose: la consciencia involucra procesos cuánticos no computables.')}
          {btn('Sigamos →', nextStep)}
        </View>
      );
      case 8: return renderReflection('💭 Emociones e IA · +16 XP', 'Piensa tú',
        '¿Crees que una IA podría tener experiencia subjetiva (sentir algo desde dentro) o siempre será un sistema que imita sin sentir? ¿En qué basas tu respuesta?',
        'Creo que una IA podría/no podría sentir realmente porque...', 120, 16);
      case 9: return renderQuizBlock(consciousnessQ, '❓ Módulo 9 · Quiz', 'Consciencia e IA', '5 preguntas sobre el problema más profundo: ¿qué es ser consciente?');
      case 10: return (
        <View style={styles.stepContainer}>
          {tag('🆚 Módulo 10 · Prompt Compare')}
          {tt('Optimista vs escéptico')}
          {body('Mismo dato, dos interpretaciones: GPT-4 fue mejor que GPT-3 en pruebas de razonamiento.')}
          <View style={styles.card}><Text style={styles.cardText}>🚀 OPTIMISTA (Altman): "GPT-3 → GPT-4 mejoró 30% en razonamiento abstracto en 3 años. Si esa curva sigue, modelos de 2027-2030 serán indistinguibles de humanos expertos."</Text></View>
          <View style={[styles.card, { borderColor: '#fecdd3' }]}><Text style={styles.cardText}>🤔 ESCÉPTICO (LeCun): "Mejoría en pruebas no es razonamiento real. Los LLMs fallan con cambios de formato. Necesitamos arquitecturas nuevas."</Text></View>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.builderOpt, compareChoice === 'a' && styles.builderOptSel]} onPress={() => setCompareChoice('a')}><Text>Optimista</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.builderOpt, compareChoice === 'b' && styles.builderOptSel]} onPress={() => setCompareChoice('b')}><Text>Escéptico</Text></TouchableOpacity>
          </View>
          {!compareChecked ? btn('Ver explicación', () => { setCompareChecked(true); addXP(12); }, !compareChoice) : btn('Continuar →', nextStep)}
          {compareChecked && <Text style={styles.fbGood}>✅ Ambas tienen evidencia válida. La verdad probablemente está en el medio. La actitud científica madura: reconocer incertidumbre alta y prepararse.</Text>}
        </View>
      );
      case 11: return (
        <View style={styles.stepContainer}>
          {tag('⏱ Módulo 11 · Sprint 90s')}
          {tt('Sprint: argumentos sólidos vs débiles')}
          {!sprintRunning && !sprintDone ? btn('▶ Iniciar Sprint', startSprint) : sprintDone ? btn('Continuar →', nextStep) : (
            <>
              <Text style={styles.timer}>{Math.floor(sprintSec / 60)}:{String(sprintSec % 60).padStart(2, '0')}s</Text>
              <View style={styles.sprintItems}>
                {POSITION_SPRINT_ITEMS.map((item, i) => (
                  <TouchableOpacity key={i} style={[styles.sprintItem, sprintPicks[i] === 'good' && styles.sprintOk, sprintPicks[i] === 'bad' && styles.sprintBad]}
                    onPress={() => pickSprint(i)} disabled={sprintPicks[i] !== undefined}>
                    <Text>{item.text}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>
      );
      case 12: return (
        <View style={styles.stepContainer}>
          {tag('🧩 Módulo 12 · Clasificar')}
          {tt('AGI positiva vs preocupante')}
          <View style={styles.chipWrap}>
            {risksItems.map((item, i) => dragPlaced[i] === undefined && (
              <TouchableOpacity key={i} style={[styles.chip, dragSel === i && styles.chipOn]} onPress={() => setDragSel(dragSel === i ? null : i)}>
                <Text style={styles.chipText}>{item.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.dropRow}>
            {['ben', 'rie'].map(zone => (
              <TouchableOpacity key={zone} style={styles.dropZone} onPress={() => handleDragDrop(zone)}>
                <Text style={styles.dropHeader}>{zone === 'ben' ? '🌱 Beneficio' : '⚠️ Riesgo'}</Text>
                {Object.entries(dragPlaced).map(([k, v]) => v === zone && (
                  <TouchableOpacity key={k} onPress={() => removeDragItem(parseInt(k))}>
                    <Text style={styles.dropChip}>{risksItems[parseInt(k)].text} ✕</Text>
                  </TouchableOpacity>
                ))}
              </TouchableOpacity>
            ))}
          </View>
          {btn('Verificar clasificación', checkDrag, Object.keys(dragPlaced).length < risksItems.length)}
        </View>
      );
      case 13: return (
        <View style={styles.stepContainer}>
          {tag('🎯 Módulo 13 · Escenario')}
          {tt('El problema de alineación')}
          {sub('¿Podemos controlar una IA superinteligente?')}
          {ALIGN_SCN.map((c, i) => (
            <TouchableOpacity key={i} style={[styles.scChoice, scenarioSel === i && styles.scChoiceSel, scenarioChecked && c.correct && styles.scChoiceOk, scenarioChecked && scenarioSel === i && !c.correct && styles.scChoiceWrong]}
              onPress={() => { if (!scenarioChecked) setScenarioSel(i); }} disabled={scenarioChecked}>
              <Text style={styles.scTitle}>{c.title}</Text>
              <Text style={styles.scText}>{c.text}</Text>
            </TouchableOpacity>
          ))}
          {!scenarioChecked ? btn('Verificar elección', checkScenario, scenarioSel === null) : btn('Continuar →', nextStep)}
          {scenarioChecked && <Text style={styles.fbGood}>{scenarioSel !== null && ALIGN_SCN[scenarioSel].correct ? '✅ ' : '❌ '}{scenarioSel !== null ? ALIGN_SCN[scenarioSel].explain : ''}</Text>}
        </View>
      );
      case 14: return renderQuizBlock(safetyOrgsQ, '❓ Módulo 14 · Quiz', 'Organizaciones de seguridad de IA', '5 preguntas sobre quiénes trabajan en proteger este futuro.');
      case 15: return (
        <View style={styles.stepContainer}>
          {tag('💌 Módulo 15 · Builder')}
          {tt('Tu carta a la IA del futuro')}
          {BUILDER_LETTER.rows.map(r => (
            <View key={r.key} style={styles.builderRow}>
              <Text style={styles.builderLabel}>{r.label}</Text>
              <View style={styles.builderOpts}>
                {r.opts.map(o => (
                  <TouchableOpacity key={o} style={[styles.builderOpt, builderState[r.key] === o && styles.builderOptSel]}
                    onPress={() => selectBuilder(r.key, o)}>
                    <Text style={styles.builderOptText}>{o}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
          <Text style={styles.builderLabel}>Tu carta diseñada:</Text>
          <View style={styles.codeBox}><Text style={styles.codeText}>{BUILDER_LETTER.rows.map(r => `${r.label}: ${builderState[r.key] || 'elige una opción'}`).join('\n')}</Text></View>
          {btn('Terminar →', () => { addXP(BUILDER_LETTER.xp); nextStep(); }, !getBuilderComplete(BUILDER_LETTER))}
        </View>
      );
      case 16: return (
        <View style={styles.stepContainer}>
          {tag('💬 Módulo 16 · Completa')}
          {tt('¿Cuál es la palabra que falta?')}
          <View style={styles.card}><Text style={styles.cardText}>La IA actual (ChatGPT, Claude) es ___ : domina lenguaje pero no aprende continuamente como humano.</Text></View>
          <View style={styles.row}>
            {['estrecha', 'general', 'consciente', 'biológica'].map((opt, i) => (
              <TouchableOpacity key={i} style={[styles.builderOpt, builderState['fill'] === opt && styles.builderOptSel]}
                onPress={() => selectBuilder('fill', opt)}>
                <Text style={styles.builderOptText}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {builderState['fill'] === 'estrecha' && <Text style={styles.fbGood}>✅ ¡Correcto! Narrow AI: especializada en un dominio. AGI sería general.</Text>}
          {builderState['fill'] && builderState['fill'] !== 'estrecha' && <Text style={styles.fbBad}>❌ La respuesta correcta es "estrecha".</Text>}
          {btn('Continuar →', () => { if (builderState['fill'] === 'estrecha') addXP(10); nextStep(); })}
        </View>
      );
      case 17: return renderReflection('🎯 Cómo prepararte · +18 XP', 'Piensa tú',
        'Si AGI llega en los próximos 10-20 años, ¿qué habilidades humanas crees que serán MÁS valiosas y por qué? Pensamiento crítico, empatía, creatividad, liderazgo emocional... ¿Cuáles desarrollarías HOY?',
        'Las habilidades que más voy a desarrollar son... porque...', 120, 18);
      case 18: return renderReflection('✍️ Tu postura final · +22 XP', 'Piensa tú',
        '1. ¿Cuál es TU posición — escéptica, neutral, optimista, alarmista? ¿Por qué?\n2. Si AGI llega en 10 años, ¿qué harías HOY?\n3. ¿Qué habilidad humana será MÁS valiosa cuando AGI exista?',
        '1. Mi posición es... porque... 2. Lo que voy a hacer hoy es... 3. La habilidad más valiosa será...', 150, 22);
      case 19: return (
        <View style={styles.completeContainer}>
          <View style={styles.completeIcon}><Text style={styles.iconEmoji}>🤯</Text></View>
          {tt('¡Nivel 31 completado!')}
          {sub('Terminaste "AGI: ¿Qué Pasaría si la IA Pensara Sola?". Ahora eres Future Thinker.')}
          <Text style={styles.xpBig}>⭐ {xp} XP ganados</Text>
          <View style={styles.skillsBox}>
            <Text style={styles.skillText}>✓ Distingo IA estrecha (hoy) vs IA general (AGI hipotética)</Text>
            <Text style={styles.skillText}>✓ Conozco las posiciones reales de Hinton, LeCun, Altman y Musk</Text>
            <Text style={styles.skillText}>✓ Entiendo el problema de alineación y por qué importa</Text>
            <Text style={styles.skillText}>✓ Puedo argumentar a favor y en contra de AGI cercana</Text>
            <Text style={styles.skillText}>✓ Tengo mi propia postura sobre cómo prepararme</Text>
          </View>
          {btn('Volver al mapa', finishLevel, false, true)}
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
      <ScrollView contentContainerStyle={styles.scrollContent}>{renderContent()}</ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  bar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  track: { flex: 1, height: 6, backgroundColor: colors.borderLight, borderRadius: 3, marginHorizontal: 12 },
  fill: { height: '100%', backgroundColor: '#5b21b6', borderRadius: 3 },
  xpChip: { ...typography.bold, fontSize: 14, color: '#3b0764' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  stepContainer: { flex: 1 },
  tag: { fontSize: 11, fontWeight: '600', color: '#3b0764', backgroundColor: '#f5f3ff', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 12, alignSelf: 'flex-start' },
  title: { ...typography.extraBold, fontSize: 19, color: colors.textPrimary, marginBottom: 8, textAlign: 'center' },
  subtitle: { ...typography.regular, fontSize: 13, color: colors.textSecondary, marginBottom: 14, lineHeight: 18, textAlign: 'center' },
  body: { ...typography.regular, fontSize: 13, color: colors.textPrimary, lineHeight: 22, marginBottom: 12 },
  iconCircle: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#f5f3ff', justifyContent: 'center', alignItems: 'center', marginBottom: 14, alignSelf: 'center' },
  iconEmoji: { fontSize: 32 },
  btn: { backgroundColor: '#16a34a', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  btnAccent: { backgroundColor: '#5b21b6' },
  btnText: { ...typography.bold, color: '#fff', fontSize: 15 },
  btnOff: { opacity: 0.4 },
  card: { backgroundColor: '#f9fafb', borderRadius: 14, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#111827', marginBottom: 4 },
  cardText: { fontSize: 13, color: '#374151', lineHeight: 20 },
  textArea: { borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, minHeight: 100, fontSize: 13, backgroundColor: '#fafafa', marginBottom: 10, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: '#9ca3af', textAlign: 'right', marginTop: 4 },
  quizQ: { ...typography.bold, fontSize: 13, padding: 12, backgroundColor: '#f9fafb', borderRadius: 10, marginBottom: 8 },
  quizOpt: { padding: 12, borderRadius: 11, borderWidth: 1.5, borderColor: '#e5e7eb', marginBottom: 6 },
  quizOptSel: { borderColor: '#5b21b6', backgroundColor: '#f5f3ff' },
  quizOptText: { fontSize: 12, color: '#374151' },
  fbGood: { fontSize: 11, marginTop: 4, color: '#065f46', backgroundColor: '#f0fdf4', padding: 6, borderRadius: 6 },
  fbBad: { fontSize: 11, marginTop: 4, color: '#991b1b', backgroundColor: '#fef2f2', padding: 6, borderRadius: 6 },
  matchRow: { flexDirection: 'row', gap: 10 },
  matchCard: { backgroundColor: '#fff', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 6 },
  matchSel: { borderColor: '#5b21b6', backgroundColor: '#f5f3ff' },
  matchDone: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  matchText: { fontSize: 11, color: '#374151' },
  tfCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  tfStmt: { fontSize: 13, fontWeight: '600', marginBottom: 10 },
  row: { flexDirection: 'row', gap: 10 },
  tfBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 2, borderColor: '#e5e7eb', alignItems: 'center' },
  tfTrue: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  tfFalse: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  timer: { fontSize: 36, fontWeight: '800', textAlign: 'center', color: '#c2410c', marginBottom: 10 },
  sprintItems: { gap: 7 },
  sprintItem: { padding: 10, backgroundColor: '#fff', borderRadius: 9, borderWidth: 1.5, borderColor: '#fed7aa' },
  sprintOk: { borderColor: '#16a34a', backgroundColor: '#dcfce7' },
  sprintBad: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 10, backgroundColor: '#f9fafb', borderRadius: 12, marginBottom: 12 },
  chip: { padding: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#d1d5db' },
  chipOn: { borderColor: '#5b21b6', backgroundColor: '#f5f3ff' },
  chipText: { fontSize: 11, color: '#374151' },
  dropRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  dropZone: { flex: 1, borderWidth: 2, borderStyle: 'dashed', borderColor: '#d1d5db', borderRadius: 12, padding: 8, minHeight: 100 },
  dropHeader: { fontSize: 11, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  dropChip: { fontSize: 10, padding: 4, backgroundColor: '#dbeafe', borderRadius: 6 },
  builderRow: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 11, marginBottom: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  builderLabel: { fontSize: 11, fontWeight: '700', color: '#3b0764', marginBottom: 6 },
  builderOpts: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  builderOpt: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 9, borderWidth: 1.5, borderColor: '#e5e7eb' },
  builderOptSel: { borderColor: '#5b21b6', backgroundColor: '#f5f3ff' },
  builderOptText: { fontSize: 12, color: '#374151' },
  codeBox: { backgroundColor: '#0f172a', padding: 12, borderRadius: 10, marginTop: 4 },
  codeText: { color: '#e2e8f0', fontFamily: 'monospace', fontSize: 11, lineHeight: 20 },
  scChoice: { borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: '#e5e7eb', marginBottom: 8 },
  scChoiceSel: { borderColor: '#5b21b6', backgroundColor: '#f5f3ff' },
  scChoiceOk: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  scChoiceWrong: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  scTitle: { fontSize: 12, fontWeight: '700', color: '#111827', marginBottom: 4 },
  scText: { fontSize: 12, color: '#374151' },
  completeContainer: { alignItems: 'center', padding: 20 },
  completeIcon: { width: 86, height: 86, borderRadius: 24, backgroundColor: '#5b21b6', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  xpBig: { ...typography.bold, fontSize: 18, color: '#3b0764', marginBottom: 16 },
  skillsBox: { backgroundColor: '#f0fdf4', borderRadius: 12, padding: 14, width: '100%', marginBottom: 16, borderWidth: 1, borderColor: '#bbf7d0', gap: 8 },
  skillText: { fontSize: 12, color: '#166534', lineHeight: 18 },
});