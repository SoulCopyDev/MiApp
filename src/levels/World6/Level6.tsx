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
type SprintItem = { text: string; good: boolean };
type PathChoice = { title: string; text: string; correct: boolean; explain: string };

// ---------- Pools de datos ----------
const PROFILE_Q: QuizQ[] = [
  { q: "Cuando ves una idea nueva por primera vez, lo PRIMERO que piensas es:", opts: ["¿Cómo podría usarla yo creativamente?", "¿En qué situaciones esto resuelve algo importante?", "¿Cómo funciona realmente por dentro?", "¿Cómo lo construiría con mis propias manos?"], correct: -1, explain: "Las 4 respuestas son válidas — cada una refleja un perfil distinto: Creador / Estratega / Investigador / Constructor." },
  { q: "En el curso, lo que MÁS te emocionó hacer fue:", opts: ["Crear algo nuevo (imágenes, historias, apps)", "Decidir qué herramienta usar para cada tarea", "Entender cómo funciona la IA por dentro", "Construir algo paso a paso desde cero"], correct: -1, explain: "Tu emoción REVELA tu perfil. No la cambies — fortalécela." },
  { q: "Cuando algo no te sale, prefieres:", opts: ["Probar 5 enfoques creativos diferentes", "Pensar bien la estrategia y volver con plan claro", "Investigar a fondo la causa real del problema", "Construir prototipos rápidos para encontrar la solución"], correct: -1, explain: "Cómo respondes al fracaso revela quién eres." },
  { q: "Tu reacción a 'la IA va a cambiar el mundo' es:", opts: ["¡Genial! ¿Qué puedo crear con eso?", "Interesante. ¿Quién gana, quién pierde, qué se hace?", "Espera — ¿de qué exactamente estamos hablando?", "Bien. ¿Cómo lo construyo yo?"], correct: -1, explain: "Tu instinto inicial es la base de tu perfil." },
  { q: "Si tuvieras 1 año libre con presupuesto, lo gastarías en:", opts: ["Un proyecto creativo masivo (libro, película, app)", "Estudiar industrias y ver dónde IA tendría más impacto", "Investigación profunda en un tema específico", "Construir 10 prototipos rápidos para validar ideas"], correct: -1, explain: "Cómo gastarías tu tiempo libre revela qué te llena de verdad." }
];

const SKILLS_ITEMS: DragItem[] = [
  { text: "Escribir prompts efectivos con rol + contexto + formato", correct: "domina" },
  { text: "Distinguir IA estrecha de AGI", correct: "domina" },
  { text: "Crear imágenes con IA generativa (DALL-E, Midjourney)", correct: "mejora" },
  { text: "Diseñar un chatbot completo con system prompt", correct: "domina" },
  { text: "Hacer una app sin código (Lovable, Bubble)", correct: "mejora" },
  { text: "Programar manualmente en Python o JavaScript", correct: "aprender" },
  { text: "Identificar la herramienta correcta para cada tarea", correct: "domina" },
  { text: "Entender ética de IA y dilemas reales", correct: "domina" },
  { text: "Configurar automatizaciones con Zapier/Make", correct: "mejora" },
  { text: "Entender cómo funciona AlphaFold y CRISPR a nivel técnico", correct: "aprender" },
  { text: "Hacer un pitch profesional de 60 segundos", correct: "mejora" },
  { text: "Investigar y validar ideas con usuarios reales", correct: "mejora" },
  { text: "Construir un Foundation Model desde cero", correct: "aprender" },
  { text: "Identificar oportunidades de impacto con IA", correct: "domina" }
];

const LEARNING_Q: QuizQ[] = [
  { q: "Recurso GRATIS de altísima calidad para profundizar en IA:", opts: ["Solo libros caros", "Fast.ai (curso completo de deep learning gratis), DeepLearning.AI, Khan Academy", "Solo en universidades premium", "Inexistentes"], correct: 1, explain: "Fast.ai es legendario: el creador (Jeremy Howard) enseña de cero a profesional en meses." },
  { q: "Para programar de verdad con IA, deberías aprender:", opts: ["Solo HTML", "Python (más usado en IA) + APIs (OpenAI, Anthropic) + un framework como FastAPI o Flask", "Solo Excel", "Ningún lenguaje"], correct: 1, explain: "Python domina IA. Si vas en serio, empieza por Python básico → APIs → un proyecto real." },
  { q: "Para mantenerte ACTUALIZADO en IA:", opts: ["Solo Twitter", "Newsletters (The Batch, Import AI), papers en arXiv, podcasts (Lex Fridman, Dwarkesh)", "Solo TikTok", "Esperar a que enseñen en colegio"], correct: 1, explain: "The Batch (DeepLearning.AI) es excelente y gratis. Podcasts dan profundidad que redes no." },
  { q: "Cuando lees algo de IA y NO entiendes:", opts: ["Te rindes", "Le pides a Claude/ChatGPT que te lo explique simple. Iteras hasta entenderlo.", "Lo memorizas", "Solo lees Wikipedia"], correct: 1, explain: "Tienes IA para aprender IA. Úsala." },
  { q: "El mejor proyecto para aprender IA en serio es:", opts: ["Solo leer", "Construir algo real que TÚ uses — un chatbot personal, app que resuelve tu problema", "Solo tomar cursos", "Ver videos infinitos"], correct: 1, explain: "Aprender HACIENDO supera aprender CONSUMIENDO 10 a 1." }
];

const MATCH_PAIRS: MatchPair[] = [
  { left: "Creador (te emociona inventar)", right: "AI Artist / Diseñador con IA / Director de cine generativo" },
  { left: "Estratega (te emociona el por qué)", right: "AI Product Manager / Consultor IA / Analista políticas IA" },
  { left: "Investigador (te emociona el cómo)", right: "Investigador en alineación / Científico de datos / Bioinformática" },
  { left: "Constructor (te emociona hacer)", right: "Ingeniero ML / Desarrollador full-stack con IA / Fundador de startup" },
  { left: "Conector (te emociona unir disciplinas)", right: "Educador IA / Periodista tecnológico / Curador de contenido" },
  { left: "Sanador (te emociona ayudar)", right: "Médico con IA / Psicólogo digital / Educador en zonas vulnerables" }
];

const EXPLAIN_SPRINT_ITEMS: SprintItem[] = [
  { text: "\"IA es inteligencia artificial. Listo.\" (vacío)", good: false },
  { text: "\"Es como un cerebro hecho con números que aprendió de millones de textos\"", good: true },
  { text: "\"Hace cosas mágicas que no se explican\" (mistificación)", good: false },
  { text: "\"ChatGPT, Claude, Gemini son ejemplos famosos. Cada uno tiene fortalezas distintas\"", good: true },
  { text: "\"Va a destruirnos pronto\" (pesimismo simplista)", good: false },
  { text: "\"Puede ayudar con tareas, escribir, crear imágenes, analizar datos — pero NO es perfecta\"", good: true },
  { text: "\"Solo gente muy inteligente puede usarla\" (elitismo falso)", good: false },
  { text: "\"Lo importante es saber qué pedir y cómo. Dale contexto y ejemplos\"", good: true },
  { text: "\"Es solo un truco con números, no entiende nada\" (reduccionismo)", good: false },
  { text: "\"Puede equivocarse — siempre verifica lo importante. Como cualquier herramienta poderosa\"", good: true }
];

const PATHS_SCN: PathChoice[] = [
  { title: "CAMINO CREAR · Construir productos/contenido con IA", text: "Te dedicas a hacer cosas — apps, contenido, arte, herramientas — usando IA como copiloto.", correct: true, explain: "✅ Camino válido si tu emoción es construir. Lovable + Bolt + Bubble + Cursor son tu kit." },
  { title: "CAMINO ESTUDIAR · Profundizar académicamente", text: "Te dedicas a entender — universidad, posgrado, investigación. Te enfocas en alineación, ML técnico, ética.", correct: true, explain: "✅ Camino válido si tu emoción es entender a fondo. Recursos: Fast.ai gratis, MOOCs Coursera." },
  { title: "CAMINO ENSEÑAR · Conectar gente con IA", text: "Te dedicas a comunicar — videos, cursos, talleres, escritos. Tu valor es traducir complejidad.", correct: true, explain: "✅ Camino subestimado pero crítico. La IA cambia tan rápido que necesitamos comunicadores urgentemente." },
  { title: "CAMINO HÍBRIDO · Combinar caminos", text: "Quizás creas Y enseñas, o estudias Y construyes. Tu valor está en el cruce de disciplinas.", correct: true, explain: "✅ Probablemente el más realista. La diferenciación está en la combinación, no en la pureza." }
];

const BUILDER_LETTER: BuilderConfig = { xp: 30, rows: [
  { key: "edad", label: "Tu edad en 10 años", opts: ["22-25 años (universidad terminada, primer trabajo)", "26-30 años (carrera consolidándose)", "31-35 años (madurez profesional inicial)", "Otra edad"] },
  { key: "vida", label: "Cómo será tu vida cotidiana", opts: ["Construyo cosas con IA cada día — soy creador de soluciones reales", "Tomo decisiones estratégicas usando IA como herramienta", "Investigo y enseño sobre IA — soy referente intelectual", "Vivo con balance: uso IA pero priorizo conexiones humanas"] },
  { key: "logro", label: "El logro más importante que esperas", opts: ["Construir algo (app, proyecto, empresa) que mejore vida de muchos", "Tener voz/influencia en cómo se desarrolla la IA en LATAM", "Generar conocimiento original (libro, paper, descubrimiento)", "Vivir bien y tener tiempo para los que amo"] },
  { key: "consejo", label: "El consejo más importante que te darías HOY", opts: ["No esperes — empieza a construir AHORA, lo perfecto es enemigo de lo bueno", "Cuida la salud mental — la velocidad no es excusa para descuidarte", "Mantén curiosidad — el día que dejes de aprender, dejas de crecer", "No olvides quién eres — la tecnología es herramienta, no identidad"] }
]};

const BUILDER_MANIFESTO: BuilderConfig = { xp: 30, rows: [
  { key: "c1", label: "Compromiso 1 · Sobre HONESTIDAD", opts: ["Voy a SIEMPRE declarar cuando uso IA en algo que comparto", "No voy a presentar trabajo de IA como si fuera 100% mío", "Voy a verificar información antes de compartirla", "No voy a usar IA para engañar a personas que confían en mí"] },
  { key: "c2", label: "Compromiso 2 · Sobre RESPONSABILIDAD", opts: ["No voy a crear contenido dañino o sesgado con IA", "Voy a pensar en consecuencias antes de automatizar algo importante", "No voy a usar IA para reemplazar conexión humana real", "Voy a respetar privacidad — propia y de otros"] },
  { key: "c3", label: "Compromiso 3 · Sobre CRECIMIENTO", opts: ["Voy a seguir aprendiendo IA — no quedar atrapado en lo que ya sé", "Voy a CRITICAR la IA cuando se equivoque, no solo aceptarla", "Voy a aprender disciplinas humanas (filosofía, arte, historia)", "Voy a equilibrar IA con habilidades manuales/físicas/humanas"] },
  { key: "c4", label: "Compromiso 4 · Sobre IMPACTO", opts: ["Voy a usar IA para resolver problemas REALES, no solo entretenimiento", "Voy a ayudar a otros a aprender IA — no acaparar conocimiento", "Voy a apoyar IA accesible para LATAM, no solo para ricos", "Voy a construir al menos UN proyecto que ayude a alguien específico"] },
  { key: "c5", label: "Compromiso 5 · Sobre TI MISMO", opts: ["Voy a cuidar mi salud mental aunque la velocidad de IA sea agotadora", "Voy a recordar que SOY humano, no necesito competir con máquinas", "Voy a mantener relaciones reales — no solo digitales/IA", "Voy a celebrar mis logros, no solo perseguir el siguiente"] }
]};

const BUILDER_FAV: BuilderConfig = { xp: 22, rows: [
  { key: "tipo", label: "Tipo de proyecto que más te marcó", opts: ["Algo creativo (imagen, historia, app que diseñé)", "Algo estratégico (mi pitch, mi plan, mi análisis ético)", "Algo investigativo (entender LLMs, AGI, AlphaFold)", "Algo construido (chatbot, automatización, manifiesto)", "Algo reflexivo (mis cartas, mis decisiones, mi narrativa)"] },
  { key: "razon", label: "Por qué fue el más importante", opts: ["Cambió cómo veo la tecnología desde dentro", "Cambió cómo veo a la humanidad y su futuro", "Cambió cómo me veo a mí mismo y mis posibilidades", "Cambió mi visión sobre LATAM, mi país o mi comunidad", "Cambió mi sentido de propósito y dirección"] },
  { key: "uso", label: "Cómo lo voy a usar adelante", opts: ["Como referencia constante de estándar de calidad", "Como semilla para un proyecto más grande", "Como ejemplo cuando enseñe a otros", "Como recordatorio de quién soy en momentos difíciles", "Como punto de partida para mi siguiente etapa"] }
]};

const BUILDER_MURAL: BuilderConfig = { xp: 22, rows: [
  { key: "frase", label: "Frase central de TU misión", opts: ["Construir tecnología que cure, no solo entretenga", "Hacer la IA accesible en español para Latinoamérica", "Conectar arte humano y código artificial sin perder alma", "Educar a niños en IA antes de que la IA los eduque a ellos", "Otra frase"] },
  { key: "imagen", label: "Imagen visual de tu aporte", opts: ["Un puente entre dos mundos (humano y IA)", "Una mano que extiende algo a otra mano (compartir)", "Un árbol creciendo con raíces fuertes (paciencia)", "Un faro en la noche (orientar a otros)", "Otra imagen"] },
  { key: "promesa", label: "Tu promesa al mural", opts: ["Voy a usar IA para reducir desigualdad, no aumentarla", "Voy a enseñar lo que aprenda, no acaparar conocimiento", "Voy a construir aunque empiece pequeño", "Voy a recordar siempre que soy humano antes que tecnólogo", "Otra promesa"] }
]};

const BUILDER_SHARE: BuilderConfig = { xp: 22, rows: [
  { key: "hook", label: "Primera frase (gancho honesto)", opts: ["\"Acabo de terminar un curso de IA de 36 niveles. Esto fue lo más importante que aprendí:\"", "\"Hace 6 meses pensaba que la IA iba a destruirnos. Hoy sé que depende de mí (y de ti).\"", "\"Construí mi primer chatbot, mi primera app sin código, mi primer pitch.\"", "\"36 niveles después, sé MENOS de IA — pero entiendo más profundo.\""] },
  { key: "lesson", label: "Tu lección más valiosa (1 frase)", opts: ["La IA es herramienta poderosa pero NO sustituye juicio crítico, ética ni conexión humana", "Construir con IA es accesible — el límite ya NO es saber programar, es saber qué construir", "El futuro NO está escrito; las decisiones de los próximos 10 años nos tocan a TODOS", "Mi voz importa: hablo español, conozco LATAM, sé IA — esa combinación es valiosa"] },
  { key: "intent", label: "Lo que quieres crear ahora", opts: ["Un proyecto real con IA en los próximos 3 meses", "Una comunidad/grupo de gente aprendiendo IA con propósito", "Contenido educativo accesible en español para mi círculo", "Una decisión de carrera/estudios diferente"] },
  { key: "cta", label: "Tu llamada a otros", opts: ["\"Si te interesa empezar, comenta y te paso recursos\"", "\"¿Qué proyecto con IA quisieras construir? Cuéntame en comentarios.\"", "\"Comparto lo que aprendo. Sígueme si quieres ver mi viaje.\"", "\"Quiero conocer otros jóvenes en LATAM aprendiendo IA.\""] }
]};

const BUILDER_THANKS: BuilderConfig = { xp: 25, rows: [
  { key: "destinatario", label: "Tu carta es para", opts: ["Una persona que te enseñó algo crucial", "Tú mismo, niño/a, antes de empezar el curso", "Las personas que crearon las herramientas que usaste", "Tu yo del futuro en 10 años", "La IA misma — gratitud por el viaje compartido"] },
  { key: "agradecimiento", label: "Lo que más agradeces", opts: ["Por enseñarme a no rendirme cuando algo no salía", "Por mostrarme que podía construir cosas reales", "Por darme una herramienta que multiplica capacidades", "Por dejarme experimentar sin juicio ni costo", "Por hacerme sentir parte de algo importante"] },
  { key: "promesa", label: "Lo que prometes a cambio", opts: ["Voy a honrar lo que aprendí construyendo cosas que importen", "Voy a transmitir lo que recibí — no acaparar conocimiento", "Voy a ser honesto cuando use IA, sin esconderlo", "Voy a recordar de dónde vengo cuando llegue lejos", "Voy a usar lo aprendido para reducir desigualdad, no aumentarla"] }
]};

const TOTAL_STEPS = 23; // 0-22 (intro, 21 pasos de contenido, completion)
const pickN = <T,>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};

interface LevelProps { navigation?: any; setAllowBack?: (allow: boolean) => void; }

export default function World6Level6({ navigation: propsNavigation, setAllowBack }: LevelProps) {
  const nav = useNavigation();
  const navigation = propsNavigation || nav;
  const completeLevel = useGameStore(s => s.completeLevel);

  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);

  // Pools
  const profileQ = useRef(pickN(PROFILE_Q, 5)).current;
  const skillsItems = useRef(pickN(SKILLS_ITEMS, 8)).current;
  const learningQ = useRef(pickN(LEARNING_Q, 5)).current;
  const matchPairs = useRef(pickN(MATCH_PAIRS, 5)).current;

  // Quiz
  const [quizAnswers, setQuizAnswers] = useState<{ [key: number]: number }>({});
  const [quizChecked, setQuizChecked] = useState(false);

  // Matching
  const [matchSel, setMatchSel] = useState<number | null>(null);
  const [matchedLeft, setMatchedLeft] = useState<Set<number>>(new Set());
  const [matchedRight, setMatchedRight] = useState<Set<number>>(new Set());
  const [rightOrder] = useState(() => matchPairs.map(p => p.right).sort(() => Math.random() - 0.5));

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

  const theorySteps = new Set([0, 1, 6, 11]);
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
    let stars = 3; // El último nivel siempre merece 3 estrellas
    completeLevel(6, 6, stars, xp);
    router.back();
  };

  const resetActivity = () => {
    setQuizAnswers({}); setQuizChecked(false);
    setMatchSel(null); setMatchedLeft(new Set()); setMatchedRight(new Set());
    setDragPlaced({}); setDragSel(null);
    setBuilderState({});
    setSprintRunning(false); setSprintSec(90); setSprintPicks({}); setSprintDone(false);
    if (sprintTimer.current) clearInterval(sprintTimer.current);
    setScenarioSel(null); setScenarioChecked(false);
    setCompareChoice(null); setCompareChecked(false);
    setReflectText('');
  };

  // Quiz
  const checkQuiz = () => { setQuizChecked(true); addXP(Object.keys(quizAnswers).length * 8); };

  // Matching
  const handleMatchLeft = (i: number) => { if (!matchedLeft.has(i)) setMatchSel(i); };
  const handleMatchRight = (ri: number) => {
    if (matchSel === null || matchedRight.has(ri)) return;
    if (rightOrder[ri] === matchPairs[matchSel].right) {
      setMatchedLeft(prev => new Set(prev).add(matchSel));
      setMatchedRight(prev => new Set(prev).add(ri));
      setMatchSel(null);
    } else { Alert.alert('❌', 'Ese no es el par correcto.'); setMatchSel(null); }
  };
  const matchComplete = matchedLeft.size >= matchPairs.length;

  // Drag & Drop
  const handleDragDrop = (zone: string) => {
    if (dragSel === null) return;
    setDragPlaced(prev => ({ ...prev, [dragSel]: zone }));
    setDragSel(null);
  };
  const removeDragItem = (idx: number) => {
    setDragPlaced(prev => { const n = { ...prev }; delete n[idx]; return n; });
  };
  const checkDrag = () => {
    if (Object.keys(dragPlaced).length < skillsItems.length) {
      Alert.alert('Faltan tarjetas', 'Clasifica todas las tarjetas.');
      return;
    }
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
    const item = EXPLAIN_SPRINT_ITEMS[i];
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
    addXP(12);
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

  const renderBuilder = (cfg: BuilderConfig, sectionLabel: string) => (
    <View style={styles.stepContainer}>
      {cfg.rows.map(r => (
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
      <Text style={styles.builderLabel}>{sectionLabel}:</Text>
      <View style={styles.codeBox}>
        <Text style={styles.codeText}>{cfg.rows.map(r => `${r.label}: ${builderState[r.key] || 'elige una opción'}`).join('\n')}</Text>
      </View>
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
          <View style={styles.iconCircle}><Text style={styles.iconEmoji}>🌟</Text></View>
          {tt('Tú y la IA: Tu Misión en el Mundo')}
          {sub('Llegaste al último nivel. Has cruzado 35 niveles, 6 mundos, decenas de proyectos. Ya no eres el mismo que empezó.')}
          {body('Este nivel NO es un quiz más — es tu cierre, tu manifiesto, tu carta a ti mismo, tu mural de graduación. Aquí decides quién quieres ser en el mundo que viene.')}
          {btn('¡Vamos! Empecemos 🚀', nextStep)}
        </View>
      );
      case 1: return (
        <View style={styles.stepContainer}>
          {tag('📖 Módulo 1 · Teoría')}
          {tt('El cierre del viaje · Tu última lección teórica')}
          {body('Este nivel es tu cierre. Tu manifiesto. Tu carta a ti mismo. Tu mural de graduación. Aquí decides quién quieres ser en el mundo que viene.\n\nEl curso termina pero tu misión apenas comienza. La IA cambia rápido. Las herramientas que aprendiste hoy se actualizarán. Pero tu CAPACIDAD de aprenderlas, criticarlas, usarlas con propósito — eso es lo que se queda contigo.')}
          {btn('Entendido, sigamos →', nextStep)}
        </View>
      );
      case 2: return renderReflection('🤔 Tu emoción al llegar · +14 XP', 'Piensa tú',
        '¿Qué SIENTES llegando aquí? ¿Orgullo? ¿Vacío? ¿Miedo de que termine? ¿Ganas de seguir? Sé honesto.',
        'Llegando al final, siento...', 80, 14);
      case 3: return (
        <View style={styles.stepContainer}>
          {tag('❓ Módulo 3 · Quiz')}
          {tt('¿Qué tipo de explorador IA eres?')}
          {sub('5 preguntas SIN respuesta correcta. Tus respuestas revelan tu perfil único.')}
          {profileQ.map((q, qi) => (
            <View key={qi} style={{ marginBottom: 18 }}>
              <Text style={styles.quizQ}>{qi + 1}. {q.q}</Text>
              {q.opts.map((o, oi) => (
                <TouchableOpacity key={oi} style={[styles.quizOpt, quizAnswers[qi] === oi && styles.quizOptSel]}
                  onPress={() => setQuizAnswers(prev => ({ ...prev, [qi]: oi }))} disabled={quizChecked}>
                  <Text style={styles.quizOptText}>{String.fromCharCode(65 + oi)}. {o}</Text>
                </TouchableOpacity>
              ))}
              {quizChecked && <Text style={styles.fbGood}>{q.explain}</Text>}
            </View>
          ))}
          {!quizChecked ? btn('Comprobar respuestas', checkQuiz) : btn('Continuar →', nextStep)}
        </View>
      );
      case 4: return (
        <View style={styles.stepContainer}>
          {tag('🧩 Módulo 4 · Clasificar')}
          {tt('Tus habilidades IA actuales')}
          <View style={styles.chipWrap}>
            {skillsItems.map((item, i) => dragPlaced[i] === undefined && (
              <TouchableOpacity key={i} style={[styles.chip, dragSel === i && styles.chipOn]} onPress={() => setDragSel(dragSel === i ? null : i)}>
                <Text style={styles.chipText}>{item.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.dropRow}>
            {['domina', 'mejora'].map(zone => (
              <TouchableOpacity key={zone} style={styles.dropZone} onPress={() => handleDragDrop(zone)}>
                <Text style={styles.dropHeader}>{zone === 'domina' ? '✅ Domino' : '📈 Puedo mejorar'}</Text>
                {Object.entries(dragPlaced).map(([k, v]) => v === zone && (
                  <TouchableOpacity key={k} onPress={() => removeDragItem(parseInt(k))}>
                    <Text style={styles.dropChip}>{skillsItems[parseInt(k)].text} ✕</Text>
                  </TouchableOpacity>
                ))}
              </TouchableOpacity>
            ))}
          </View>
          {btn('Verificar clasificación', checkDrag, Object.keys(dragPlaced).length < skillsItems.length)}
        </View>
      );
      case 5: return renderReflection('🔮 Los 3 cambios que vendrán · +16 XP', 'Piensa tú',
        '¿Cuáles serán los 3 MAYORES cambios que la IA traerá a TU vida personal en los próximos 10 años? No los más grandes del mundo — los más grandes para TI. Sé específico.',
        '1. ... 2. ... 3. ...', 120, 16);
      case 6: return (
        <View style={styles.stepContainer}>
          {tag('🌎 Módulo 6 · Tu lugar')}
          {tt('Problemas que necesitan personas como TÚ')}
          {body('Salud: medicina con IA necesita éticos digitales.\nPlaneta: necesitamos científicos del clima con IA.\nEducación: tutores IA personalizados necesitan diseñadores pedagógicos.\nDesigualdad: reducir brechas con IA construida desde LATAM, no solo Silicon Valley.')}
          {btn('Sigamos →', nextStep)}
        </View>
      );
      case 7: return (
        <View style={styles.stepContainer}>
          {tag('❓ Módulo 7 · Quiz')}
          {tt('Cómo seguir aprendiendo después del curso')}
          {learningQ.map((q, qi) => (
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
          {!quizChecked ? btn('Comprobar respuestas', () => { setQuizChecked(true); let c = 0; learningQ.forEach((q, i) => { if (quizAnswers[i] === q.correct) c++; }); addXP(c * 8); }) : btn('Continuar →', nextStep)}
        </View>
      );
      case 8: return (
        <View style={styles.stepContainer}>
          {tag('🔗 Módulo 8 · Matching')}
          {tt('Tu perfil + tu carrera futura')}
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
      case 9: return (
        <View style={styles.stepContainer}>
          {tag('💌 Módulo 9 · Carta')}
          {tt('Carta a ti mismo en 10 años')}
          {renderBuilder(BUILDER_LETTER, 'Tu carta al futuro')}
          {btn('Terminar →', () => { addXP(BUILDER_LETTER.xp); nextStep(); }, !getBuilderComplete(BUILDER_LETTER))}
        </View>
      );
      case 10: return (
        <View style={styles.stepContainer}>
          {tag('📜 Módulo 10 · Manifiesto')}
          {tt('Tu manifiesto personal de IA')}
          {renderBuilder(BUILDER_MANIFESTO, 'Tu manifiesto firmado')}
          {btn('Terminar →', () => { addXP(BUILDER_MANIFESTO.xp); nextStep(); }, !getBuilderComplete(BUILDER_MANIFESTO))}
        </View>
      );
      case 11: return (
        <View style={styles.stepContainer}>
          {tag('🦸 Módulo 11 · Héroes')}
          {tt('Los héroes de la IA · Y TÚ entre ellos')}
          {body('Alan Turing: padre de la computación, perseguido por ser homosexual, héroe póstumo.\nGeoffrey Hinton: padre del deep learning, renunció a Google para advertir sobre riesgos.\nFei-Fei Li: creó ImageNet, defensora de IA human-centered.\nDemis Hassabis: cofundó DeepMind, Nobel de Química 2024.\n\nTÚ: aprendiste 36 niveles, 6 mundos, decenas de proyectos. Tu nombre podría estar aquí en 30 años.')}
          {btn('Sigamos →', nextStep)}
        </View>
      );
      case 12: return (
        <View style={styles.stepContainer}>
          {tag('⭐ Módulo 12 · Tu favorito')}
          {tt('Tu proyecto favorito del curso')}
          {renderBuilder(BUILDER_FAV, 'Tu proyecto que más te marcó')}
          {btn('Terminar →', () => { addXP(BUILDER_FAV.xp); nextStep(); }, !getBuilderComplete(BUILDER_FAV))}
        </View>
      );
      case 13: return (
        <View style={styles.stepContainer}>
          {tag('⏱ Módulo 13 · Sprint 90s')}
          {tt('Sprint: explica IA a alguien en 60 seg')}
          {!sprintRunning && !sprintDone ? btn('▶ Iniciar Sprint', startSprint) : sprintDone ? btn('Continuar →', nextStep) : (
            <>
              <Text style={styles.timer}>{Math.floor(sprintSec / 60)}:{String(sprintSec % 60).padStart(2, '0')}s</Text>
              <View style={styles.sprintItems}>
                {EXPLAIN_SPRINT_ITEMS.map((item, i) => (
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
      case 14: return renderReflection('💝 Tu compromiso ético · +18 XP', 'Piensa tú',
        '¿Vas a verificar información antes de compartirla? ¿Vas a declarar cuando algo lo hizo IA? ¿Vas a crear cosas dañinas si te pagaran? ¿Vas a ayudar a otros a aprender IA? ¿Vas a recordarte que la IA es herramienta, no identidad?',
        'Mis respuestas honestas: 1... 2... 3... 4... 5...', 140, 18);
      case 15: return (
        <View style={styles.stepContainer}>
          {tag('🎨 Módulo 15 · Mural colectivo')}
          {tt('Tu aporte al mural de graduación')}
          {renderBuilder(BUILDER_MURAL, 'Tu aporte al mural')}
          {btn('Terminar →', () => { addXP(BUILDER_MURAL.xp); nextStep(); }, !getBuilderComplete(BUILDER_MURAL))}
        </View>
      );
      case 16: return renderReflection('🔄 Tus 3 cambios reales · +20 XP', 'Piensa tú',
        'Identifica 3 cambios reales en ti:\n1. Una creencia sobre la IA que CAMBIÓ.\n2. Una habilidad que NO tenías y que ahora dominas.\n3. Una emoción sobre el futuro que evolucionó.',
        '1. La creencia que cambió: ... 2. La habilidad nueva: ... 3. La emoción que evolucionó: ...', 150, 20);
      case 17: return (
        <View style={styles.stepContainer}>
          {tag('📣 Módulo 17 · Tu post')}
          {tt('Comparte tu historia · Post de cierre')}
          {renderBuilder(BUILDER_SHARE, 'Tu post de cierre listo')}
          {btn('Terminar →', () => { addXP(BUILDER_SHARE.xp); nextStep(); }, !getBuilderComplete(BUILDER_SHARE))}
        </View>
      );
      case 18: return (
        <View style={styles.stepContainer}>
          {tag('🎯 Módulo 18 · Escenario')}
          {tt('Los 4 caminos posibles')}
          {PATHS_SCN.map((c, i) => (
            <TouchableOpacity key={i} style={[styles.scChoice, scenarioSel === i && styles.scChoiceSel, scenarioChecked && styles.scChoiceOk]}
              onPress={() => { if (!scenarioChecked) setScenarioSel(i); }} disabled={scenarioChecked}>
              <Text style={styles.scTitle}>{c.title}</Text>
              <Text style={styles.scText}>{c.text}</Text>
            </TouchableOpacity>
          ))}
          {!scenarioChecked ? btn('Verificar elección', checkScenario, scenarioSel === null) : btn('Continuar →', nextStep)}
          {scenarioChecked && <Text style={styles.fbGood}>{PATHS_SCN[scenarioSel!]?.explain}</Text>}
        </View>
      );
      case 19: return (
        <View style={styles.stepContainer}>
          {tag('🆚 Módulo 19 · Prompt Compare')}
          {tt('Tú antes vs tú después')}
          <View style={styles.card}><Text style={styles.cardText}>👤 TÚ ANTES: "Sabía que existía la IA. Pensaba que era para programadores. No sabía cómo funcionaba realmente."</Text></View>
          <View style={[styles.card, { borderColor: '#fecdd3' }]}><Text style={styles.cardText}>✨ TÚ DESPUÉS: "Sé qué es un prompt, un chatbot, un agente. Construí mi app, mi pitch. Tengo opinión informada sobre AGI. Estoy listo para construir."</Text></View>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.builderOpt, compareChoice === 'a' && styles.builderOptSel]} onPress={() => setCompareChoice('a')}><Text>Antes</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.builderOpt, compareChoice === 'b' && styles.builderOptSel]} onPress={() => setCompareChoice('b')}><Text>Después</Text></TouchableOpacity>
          </View>
          {!compareChecked ? btn('Ver explicación', () => { setCompareChecked(true); addXP(12); }, !compareChoice) : btn('Continuar →', nextStep)}
          {compareChecked && <Text style={styles.fbGood}>✅ La versión 'después' eres TÚ ahora. Reconócelo. Celebra. Sigue construyendo.</Text>}
        </View>
      );
      case 20: return (
        <View style={styles.stepContainer}>
          {tag('🙏 Módulo 20 · Gratitud')}
          {tt('Carta de agradecimiento')}
          {renderBuilder(BUILDER_THANKS, 'Tu carta de agradecimiento')}
          {btn('Terminar →', () => { addXP(BUILDER_THANKS.xp); nextStep(); }, !getBuilderComplete(BUILDER_THANKS))}
        </View>
      );
      case 21: return renderReflection('✍️ Tu cierre del curso completo · +30 XP', 'Piensa tú',
        '1. ¿Qué cambió en la forma en que ves el MUNDO después de IA Explorer?\n2. ¿Qué cambió en la forma en que te ves a TI MISMO?\n3. ¿Cuál es el primer paso CONCRETO que vas a dar la próxima semana?',
        '1. En cómo veo el mundo: ... 2. En cómo me veo a mí mismo: ... 3. Mi primer paso concreto: ...', 200, 30);
      case 22: return (
        <View style={styles.completeContainer}>
          <View style={styles.completeIcon}><Text style={styles.iconEmoji}>🌟</Text></View>
          {tt('¡Nivel 36 completado!')}
          {sub('Terminaste "Tú y la IA: Tu Misión en el Mundo". Ahora eres AI Explorer Graduado.')}
          <Text style={styles.xpBig}>⭐ {xp} XP ganados</Text>
          <View style={styles.skillsBox}>
            <Text style={styles.skillText}>✓ Identifico mi perfil de explorador IA</Text>
            <Text style={styles.skillText}>✓ Tengo mi manifiesto personal de IA con 5 compromisos</Text>
            <Text style={styles.skillText}>✓ Escribí mi carta a mí mismo en 10 años</Text>
            <Text style={styles.skillText}>✓ Conozco caminos concretos para seguir aprendiendo</Text>
            <Text style={styles.skillText}>✓ Cierro mi viaje con claridad, dirección y propósito</Text>
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
  fill: { height: '100%', backgroundColor: '#b45309', borderRadius: 3 },
  xpChip: { ...typography.bold, fontSize: 14, color: '#78350f' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  stepContainer: { flex: 1 },
  tag: { fontSize: 11, fontWeight: '600', color: '#78350f', backgroundColor: '#fef3c7', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 12, alignSelf: 'flex-start' },
  title: { ...typography.extraBold, fontSize: 19, color: colors.textPrimary, marginBottom: 8, textAlign: 'center' },
  subtitle: { ...typography.regular, fontSize: 13, color: colors.textSecondary, marginBottom: 14, lineHeight: 18, textAlign: 'center' },
  body: { ...typography.regular, fontSize: 13, color: colors.textPrimary, lineHeight: 22, marginBottom: 12 },
  iconCircle: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#fef3c7', justifyContent: 'center', alignItems: 'center', marginBottom: 14, alignSelf: 'center' },
  iconEmoji: { fontSize: 32 },
  btn: { backgroundColor: '#16a34a', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  btnAccent: { backgroundColor: '#b45309' },
  btnText: { ...typography.bold, color: '#fff', fontSize: 15 },
  btnOff: { opacity: 0.4 },
  card: { backgroundColor: '#f9fafb', borderRadius: 14, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#111827', marginBottom: 4 },
  cardText: { fontSize: 13, color: '#374151', lineHeight: 20 },
  textArea: { borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, minHeight: 100, fontSize: 13, backgroundColor: '#fafafa', marginBottom: 10, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: '#9ca3af', textAlign: 'right', marginTop: 4 },
  quizQ: { ...typography.bold, fontSize: 13, padding: 12, backgroundColor: '#f9fafb', borderRadius: 10, marginBottom: 8 },
  quizOpt: { padding: 12, borderRadius: 11, borderWidth: 1.5, borderColor: '#e5e7eb', marginBottom: 6 },
  quizOptSel: { borderColor: '#b45309', backgroundColor: '#fef3c7' },
  quizOptText: { fontSize: 12, color: '#374151' },
  fbGood: { fontSize: 11, marginTop: 4, color: '#065f46', backgroundColor: '#f0fdf4', padding: 6, borderRadius: 6 },
  fbBad: { fontSize: 11, marginTop: 4, color: '#991b1b', backgroundColor: '#fef2f2', padding: 6, borderRadius: 6 },
  matchRow: { flexDirection: 'row', gap: 10 },
  matchCard: { backgroundColor: '#fff', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 6 },
  matchSel: { borderColor: '#b45309', backgroundColor: '#fef3c7' },
  matchDone: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  matchText: { fontSize: 11, color: '#374151' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 10, backgroundColor: '#f9fafb', borderRadius: 12, marginBottom: 12 },
  chip: { padding: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#d1d5db' },
  chipOn: { borderColor: '#b45309', backgroundColor: '#fef3c7' },
  chipText: { fontSize: 11, color: '#374151' },
  dropRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  dropZone: { flex: 1, borderWidth: 2, borderStyle: 'dashed', borderColor: '#d1d5db', borderRadius: 12, padding: 8, minHeight: 100 },
  dropHeader: { fontSize: 11, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  dropChip: { fontSize: 10, padding: 4, backgroundColor: '#dbeafe', borderRadius: 6 },
  builderRow: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 11, marginBottom: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  builderLabel: { fontSize: 11, fontWeight: '700', color: '#78350f', marginBottom: 6 },
  builderOpts: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  builderOpt: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 9, borderWidth: 1.5, borderColor: '#e5e7eb' },
  builderOptSel: { borderColor: '#b45309', backgroundColor: '#fef3c7' },
  builderOptText: { fontSize: 12, color: '#374151' },
  codeBox: { backgroundColor: '#0f172a', padding: 12, borderRadius: 10, marginTop: 4 },
  codeText: { color: '#e2e8f0', fontFamily: 'monospace', fontSize: 11, lineHeight: 20 },
  timer: { fontSize: 36, fontWeight: '800', textAlign: 'center', color: '#c2410c', marginBottom: 10 },
  sprintItems: { gap: 7 },
  sprintItem: { padding: 10, backgroundColor: '#fff', borderRadius: 9, borderWidth: 1.5, borderColor: '#fed7aa' },
  sprintOk: { borderColor: '#16a34a', backgroundColor: '#dcfce7' },
  sprintBad: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  scChoice: { borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: '#e5e7eb', marginBottom: 8 },
  scChoiceSel: { borderColor: '#b45309', backgroundColor: '#fef3c7' },
  scChoiceOk: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  scTitle: { fontSize: 12, fontWeight: '700', color: '#111827', marginBottom: 4 },
  scText: { fontSize: 12, color: '#374151' },
  row: { flexDirection: 'row', gap: 10 },
  completeContainer: { alignItems: 'center', padding: 20 },
  completeIcon: { width: 86, height: 86, borderRadius: 24, backgroundColor: '#b45309', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  xpBig: { ...typography.bold, fontSize: 18, color: '#78350f', marginBottom: 16 },
  skillsBox: { backgroundColor: '#f0fdf4', borderRadius: 12, padding: 14, width: '100%', marginBottom: 16, borderWidth: 1, borderColor: '#bbf7d0', gap: 8 },
  skillText: { fontSize: 12, color: '#166534', lineHeight: 18 },
});