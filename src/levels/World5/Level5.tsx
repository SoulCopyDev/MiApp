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
type TribeChoice = { title: string; text: string; correct: boolean; explain: string };

// ---------- Pools de datos ----------
const STORY_Q: QuizQ[] = [
  { q: "¿Cuáles son los 3 elementos esenciales de una historia que engancha?", opts: ["Personajes, escenario, estilo", "Problema, héroe, solución", "Inicio, mitad, final", "Hechos, datos, fuentes"], correct: 1, explain: "Problema doloroso → héroe identificable → solución concreta. Patrón usado desde Hollywood hasta TED talks." },
  { q: "Si tu post empieza con 'Soy desarrollador y construí una app', ¿qué le falta?", opts: ["Más palabras", "El gancho del problema — empieza por el dolor que resolviste, no por ti", "Emojis", "Tu nombre"], correct: 1, explain: "La gente no se conecta con vos. Se conecta con su propio problema — el que vos resolviste. Empieza ahí." },
  { q: "El 'héroe' de tu historia idealmente es:", opts: ["Tú mismo", "El usuario que sufría el problema y ahora tiene la solución", "La empresa", "El producto"], correct: 1, explain: "Tu usuario es el héroe. Tu producto es la espada que le diste." },
  { q: "¿Cuánto debería durar un buen 'gancho' (primera frase) en redes?", opts: ["3 párrafos", "1 frase corta — máximo 12 palabras", "10 segundos", "Una imagen complicada"], correct: 1, explain: "Si la primera frase no engancha en <3 segundos, perdiste al 80% de lectores." },
  { q: "Una historia con datos concretos vs. una historia con palabras vagas:", opts: ["Vagas conectan más emocionalmente", "Datos concretos son más memorables y creíbles", "Da igual", "Las vagas son más cortas"], correct: 1, explain: "'Ahorré tiempo' vs '240 estudiantes la usan en 8 meses'. El número se queda; lo vago se olvida." }
];

const COMMS_Q: QuizQ[] = [
  { q: "¿Por qué los primeros 3 segundos de un video corto son LOS más importantes?", opts: ["Porque después la cámara se daña", "Porque el algoritmo decide si seguir mostrando tu video según retention de esos 3 seg", "Por moda", "Porque YouTube lo exige"], correct: 1, explain: "Hook crítico. Si la gente sale en 3 seg, el algoritmo deja de distribuir." },
  { q: "¿Qué es 'CTA' (call to action)?", opts: ["Centro de Tecnología Avanzada", "Una llamada a acción específica al final del contenido (suscríbete, prueba, compra)", "Un emoji nuevo", "Un error de cámara"], correct: 1, explain: "CTA: sin él, la gente consume tu contenido pero no actúa." },
  { q: "¿Cuándo es un buen momento para usar IA al crear contenido?", opts: ["Para reemplazar tu voz completamente", "Para generar borradores, variaciones, miniaturas — pero la voz auténtica es tuya", "Solo para imágenes", "Nunca"], correct: 1, explain: "IA = co-piloto. Acelera el trabajo mecánico. Pero tu autenticidad es el diferencial." },
  { q: "¿Por qué adaptar contenido por plataforma en vez de copiar/pegar?", opts: ["Por capricho", "Cada plataforma tiene su lenguaje, audiencia y formato — el algoritmo penaliza contenido no nativo", "Es ilegal copiar", "Solo si tienes muchos seguidores"], correct: 1, explain: "Twitter no es LinkedIn no es TikTok. Adaptar = más alcance + más engagement." },
  { q: "Si recibes una crítica dura pero válida sobre tu proyecto, ¿qué haces?", opts: ["Bloquear al usuario", "Agradecer públicamente, considerar el punto, ajustar si tiene razón", "Atacar de vuelta", "Borrar el comentario"], correct: 1, explain: "Las críticas válidas son oro gratis. La gente que te dice la verdad sin filtro vale más que 100 fans aduladores." }
];

const TF_IMPACT_Q: TFItem[] = [
  { stmt: "100,000 likes en un post valen más que 100 usuarios que pagan tu app", correct: false, explain: "Falso. Los likes son vanity metrics. Los usuarios que pagan o usan = impacto real." },
  { stmt: "Una sola persona que diga 'esto cambió mi vida' vale más que 10K likes vacíos", correct: true, explain: "Verdadero. Testimonios reales > likes superficiales." },
  { stmt: "Si tu video viraliza a 1M de views pero NADIE prueba tu producto, sirvió de algo", correct: false, explain: "Falso. Views sin acción = vanity. La pregunta real: ¿cuántos hicieron click?" },
  { stmt: "Es mejor tener 500 seguidores que SÍ usan tu producto que 50K que solo te miran", correct: true, explain: "Verdadero. La calidad de la audiencia > la cantidad." },
  { stmt: "Las métricas de retención (¿vuelven en 7 días?) son más importantes que los downloads", correct: true, explain: "Verdadero. Apps con 1M downloads y 5% retención mueren." }
];

const MATCH_PAIRS: MatchPair[] = [
  { left: "Instagram (Reels y posts)", right: "Visual primero, captions cortas, hashtags estratégicos, estética cuidada" },
  { left: "TikTok", right: "Hook en primeros 3 seg, vertical, autenticidad sobre producción, audio tendencia" },
  { left: "YouTube", right: "Títulos optimizados para búsqueda, miniaturas con contraste, retención > likes" },
  { left: "LinkedIn", right: "Profesional pero humano, párrafos cortos, primera línea engancha, sin emojis excesivos" },
  { left: "Twitter/X", right: "Hilos numerados, opinión clara, 1 idea por tweet, ritmo punzante" },
  { left: "WhatsApp/Telegram (canales)", right: "Mensajes cortos directos, audios cuando aporta, sin hashtags, comunidad cercana" }
];

const POST_SPRINT_ITEMS: SprintItem[] = [
  { text: "\"Construí esto. Pruébalo si quieres.\" + link", good: false },
  { text: "\"7 de cada 10 estudiantes pierden tareas por desorganización. Construí algo que lo arregla. Hilo ↓\"", good: true },
  { text: "\"Mi app es revolucionaria, increíble, única, especial, novedosa\"", good: false },
  { text: "\"Hace 2 años vi a mi abuela llorar usando una app del banco. Hoy lanzo SU solución →\"", good: true },
  { text: "\"COMPRA YA!!!! 🚨🚨🚨 OFERTA LIMITADA!!!!\"", good: false },
  { text: "\"Pasé 3 meses entrevistando a 30 emprendedoras. Esto fue lo que me dijeron sobre IA →\"", good: true },
  { text: "Solo emojis sin contexto: 🚀💡🔥💯⚡", good: false },
  { text: "\"Dato real: pasamos 2.3h/día buscando archivos en Drive. Mi app lo reduce a 12 min. Así funciona ↓\"", good: true },
  { text: "\"Dejen de scrollear y vean esto, no se van a arrepentir, es lo mejor de hoy\"", good: false },
  { text: "\"Antes: 240 estudiantes con tareas perdidas. Después: cero. Esto fue lo que cambié →\"", good: true }
];

const PRIVACY_ITEMS: DragItem[] = [
  { text: "Compartir: el problema general que resuelve tu app", correct: "share" },
  { text: "Compartir: el video demo del flujo principal", correct: "share" },
  { text: "Compartir: el nombre, logo y URL pública de tu proyecto", correct: "share" },
  { text: "Compartir: tu propia historia de por qué lo construiste", correct: "share" },
  { text: "Compartir: las métricas generales (usuarios, retención)", correct: "share" },
  { text: "NO compartir: el código fuente completo si tienes ventaja competitiva", correct: "protect" },
  { text: "NO compartir: datos personales de usuarios reales sin consentimiento", correct: "protect" },
  { text: "NO compartir: tus credenciales de API o claves privadas (¡nunca!)", correct: "protect" },
  { text: "NO compartir: el plan financiero detallado antes de levantar capital", correct: "protect" },
  { text: "NO compartir: la lista exacta de clientes/usuarios early adopters sin permiso", correct: "protect" }
];

const VIRAL_REASONS_SORT = [
  "1 · Emoción primero, datos después: sin conexión emocional, no se comparte",
  "2 · Útil + memorable: que sirva HOY y se recuerde mañana",
  "3 · Original auténtico: no copiar tendencias — adaptarlas a tu voz",
  "4 · Específico, no genérico: 'estudiantes de medicina en Bogotá' > 'estudiantes'",
  "5 · Llamada a acción clara: ¿qué hago ahora? Si no es obvio, no lo harán",
  "6 · Constancia: 1 viral no construye marca, 50 buenos posts sí"
];

const TRIBE_SCN: TribeChoice[] = [
  { title: "Subreddits específicos del nicho", text: "Buscar comunidades en Reddit donde la gente YA discute exactamente tu problema. Aportar valor antes de promocionar.", correct: true, explain: "✅ Reddit es oro para encontrar tribus. Pero respeta cultura: aporta primero, promociona después (ratio 9:1)." },
  { title: "Spam masivo en grupos de Facebook sin contexto", text: "Postear el mismo mensaje promocional en 50 grupos de FB sin participar antes en ninguno.", correct: false, explain: "❌ Te van a banear. La regla es ser miembro real antes de promocionar — humanos no robots." },
  { title: "Discord de comunidad de practicantes", text: "Unirse a Discords donde tu audiencia ideal ya conversa, participar genuinamente, eventualmente compartir tu trabajo cuando aporte.", correct: true, explain: "✅ Discords nicho son los nuevos foros pro. Conexión genuina + paciencia = audiencia leal." },
  { title: "Pagar influencers grandes desde el día 1", text: "Invertir todo el presupuesto en 1 influencer macro de 1M+ seguidores antes de validar el producto.", correct: false, explain: "❌ Mal ROI sin validación. Mejor 10 micro-influencers nicho ($50-200 c/u) que 1 macro ($5,000+) sin garantías." }
];

const BUILDER_HOOK: BuilderConfig = { xp: 18, rows: [
  { key: "tipo", label: "Tipo de gancho", opts: ["Dato impactante (números reales que sorprenden)", "Pregunta provocadora (que da curiosidad)", "Anécdota personal de 1 frase (humano, no abstracto)", "Confesión incómoda (vulnerabilidad genera conexión)", "Contraste sorprendente (antes/después extremo)"] },
  { key: "emocion", label: "Emoción que provoca", opts: ["Curiosidad — '¿qué pasó después?'", "Reconocimiento — 'eso me pasó a mí'", "Urgencia — 'tengo que saber esto YA'", "Asombro — 'no creo lo que estoy leyendo'"] },
  { key: "tono", label: "Tono", opts: ["Conversacional cercano (como amigo)", "Profesional con datos", "Humorístico inteligente", "Vulnerable y honesto"] }
]};

const BUILDER_MULTI: BuilderConfig = { xp: 20, rows: [
  { key: "texto", label: "Texto del post", opts: ["Hook + 3 puntos + CTA con link", "Historia personal de 1 párrafo emocional", "Hilo numerado de 5-7 ideas conectadas", "Pregunta abierta + invitación a debatir"] },
  { key: "imagen", label: "Imagen acompañante", opts: ["Screenshot de la app con anotaciones", "Foto tuya o del equipo trabajando", "Imagen generada con IA del concepto abstracto", "Gráfica simple con UN dato impactante", "Meme adaptado al tema (con cuidado de tono)"] },
  { key: "extra", label: "Elemento extra", opts: ["Audio corto explicando el detrás", "Video de 30 seg con demo del producto", "Encuesta nativa de la plataforma", "GIF que explica el flujo completo"] }
]};

const BUILDER_DESC: BuilderConfig = { xp: 18, rows: [
  { key: "audiencia", label: "Audiencia específica", opts: ["Estudiantes universitarios 18-24", "Emprendedoras LATAM 25-40", "Padres de familia con hijos en colegio", "Profesionales corporativos 30-50", "Adultos mayores 55+ con poco contexto digital"] },
  { key: "plataforma", label: "Plataforma destino", opts: ["Instagram caption (visual + emocional)", "LinkedIn post (profesional con datos)", "TikTok caption (corta + hashtags virales)", "Twitter thread (1 idea por tweet)"] },
  { key: "objetivo", label: "Objetivo concreto", opts: ["Conseguir 100 personas que prueben mi MVP", "Generar conversación en comentarios", "Atraer un cofundador técnico", "Validar si el problema resuena con más gente"] },
  { key: "tono", label: "Tono", opts: ["Cercano y conversacional", "Profesional con autoridad", "Vulnerable y auténtico", "Humorístico e inteligente"] }
]};

const BUILDER_THUMB: BuilderConfig = { xp: 15, rows: [
  { key: "elemento", label: "Elemento central", opts: ["Tu rostro con expresión clara (curiosidad/sorpresa)", "Producto/screenshot con flecha o círculo destacando", "Texto enorme con UNA palabra impactante", "Antes/después dividido en dos mitades"] },
  { key: "color", label: "Paleta dominante", opts: ["Alto contraste (negro + 1 color vibrante)", "Cálidos llamativos (naranja, rojo, amarillo)", "Fríos profesionales (azules + blanco)", "Pasteles suaves para audiencia femenina"] },
  { key: "texto", label: "Texto sobre la imagen (máx 4 palabras)", opts: ["Pregunta intrigante: '¿Y si pudieras...?'", "Beneficio claro: '+50% productividad'", "Urgencia: 'Probado en 90 días'", "Misterio: 'Lo que nadie dice'"] }
]};

const BUILDER_HASHTAG: BuilderConfig = { xp: 15, rows: [
  { key: "amplio", label: "Hashtag amplio (alto volumen)", opts: ["#emprendimiento", "#tecnologia", "#educacion", "#productividad", "#startups", "#marketing"] },
  { key: "nicho", label: "Hashtag nicho específico", opts: ["#emprendedoreslatam", "#nocodelatino", "#estudiantescolombia", "#mujeresentech", "#startupsmexico", "#educacionrural"] },
  { key: "branded", label: "Hashtag de tu marca", opts: ["#LumiApp", "#ConectaConIA", "#MiPrimerProyecto", "#ConstruidoEnLATAM", "#YoCreoConIA"] }
]};

const BUILDER_VIDEO: BuilderConfig = { xp: 22, rows: [
  { key: "hook", label: "Hook (5 seg)", opts: ["\"7 de cada 10 estudiantes hacen esto MAL\" + zoom", "\"Esto cambió mi forma de estudiar\" + screenshot", "\"Si tienes [problema X], tienes que ver esto\" + cara curiosa", "Estadística impactante en pantalla + voz que la explica"] },
  { key: "problema", label: "Problema (15 seg)", opts: ["Enseñar el dolor con ejemplo concreto y emocional", "Mostrar el 'antes' de un usuario real", "Explicar cuánto tiempo/dinero se pierde sin la solución", "Confesión: 'a mí también me pasó esto'"] },
  { key: "solucion", label: "Solución (30 seg)", opts: ["Demo en pantalla del flujo principal de la app", "Animación simple del 'cómo funciona'", "Testimonios cortos de usuarios reales", "Tutorial de 3 pasos súper claros"] },
  { key: "cta", label: "CTA (10 seg)", opts: ["\"Link en bio para probarla gratis\"", "\"Comenta YO si te interesa\"", "\"Etiqueta a alguien que necesite esto\"", "\"Sígueme para más como esto\""] }
]};

const TOTAL_STEPS = 21;
const pickN = <T,>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};

interface LevelProps { navigation?: any; setAllowBack?: (allow: boolean) => void; }

export default function World5Level5({ navigation: propsNavigation, setAllowBack }: LevelProps) {
  const nav = useNavigation();
  const navigation = propsNavigation || nav;
  const completeLevel = useGameStore(s => s.completeLevel);

  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);

  // Pools
  const storyQ = useRef(pickN(STORY_Q, 5)).current;
  const commsQ = useRef(pickN(COMMS_Q, 5)).current;
  const tfImpactQ = useRef(pickN(TF_IMPACT_Q, 5)).current;
  const matchPairs = useRef(pickN(MATCH_PAIRS, 5)).current;
  const privacyItems = useRef(pickN(PRIVACY_ITEMS, 8)).current;

  // Quiz
  const [quizAnswers, setQuizAnswers] = useState<{ [key: number]: number }>({});
  const [quizChecked, setQuizChecked] = useState(false);

  // Matching
  const [matchSel, setMatchSel] = useState<number | null>(null);
  const [matchedLeft, setMatchedLeft] = useState<Set<number>>(new Set());
  const [matchedRight, setMatchedRight] = useState<Set<number>>(new Set());
  const [rightOrder] = useState(() => matchPairs.map(p => p.right).sort(() => Math.random() - 0.5));

  // Sort
  const [sortOrder, setSortOrder] = useState<number[]>([]);
  const [sortOk, setSortOk] = useState(false);

  // Drag & Drop
  const [dragPlaced, setDragPlaced] = useState<{ [key: number]: string }>({});
  const [dragSel, setDragSel] = useState<number | null>(null);

  // Builders
  const [builderState, setBuilderState] = useState<{ [key: string]: string }>({});

  // V/F
  const [tfAnswers, setTfAnswers] = useState<{ [key: number]: boolean }>({});
  const [tfChecked, setTfChecked] = useState(false);

  // Sprint
  const [sprintRunning, setSprintRunning] = useState(false);
  const [sprintSec, setSprintSec] = useState(90);
  const [sprintPicks, setSprintPicks] = useState<{ [key: number]: string }>({});
  const [sprintDone, setSprintDone] = useState(false);
  const sprintTimer = useRef<NodeJS.Timeout | null>(null);

  // Scenario (tribe)
  const [scenarioSel, setScenarioSel] = useState<number | null>(null);
  const [scenarioChecked, setScenarioChecked] = useState(false);

  // Reflexión
  const [reflectText, setReflectText] = useState('');

  const theorySteps = new Set([0, 1, 11]);
  const canGoBack = theorySteps.has(step);

  useEffect(() => { setAllowBack?.(canGoBack); }, [canGoBack]);
  useEffect(() => {
    const h = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack) { Alert.alert('Actividad en curso', 'Completa la actividad antes de salir.'); return true; }
      return false;
    });
    return () => h.remove();
  }, [canGoBack]);

  // Sort init
  useEffect(() => {
    if (step === 5) {
      const order = VIRAL_REASONS_SORT.map((_, i) => i).sort(() => Math.random() - 0.5);
      if (order.every((v, i) => v === i)) { [order[0], order[1]] = [order[1], order[0]]; }
      setSortOrder(order);
      setSortOk(false);
    }
  }, [step]);

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
    completeLevel(5, 5, stars, xp);
    router.back();
  };

  const resetActivity = () => {
    setQuizAnswers({}); setQuizChecked(false);
    setMatchSel(null); setMatchedLeft(new Set()); setMatchedRight(new Set());
    setSortOrder([]); setSortOk(false);
    setDragPlaced({}); setDragSel(null);
    setBuilderState({});
    setTfAnswers({}); setTfChecked(false);
    setSprintRunning(false); setSprintSec(90); setSprintPicks({}); setSprintDone(false);
    if (sprintTimer.current) clearInterval(sprintTimer.current);
    setReflectText('');
    setScenarioSel(null); setScenarioChecked(false);
  };

  // Quiz
  const checkQuiz = (items: QuizQ[]) => {
    setQuizChecked(true);
    let correct = 0;
    items.forEach((q, i) => { if (quizAnswers[i] === q.correct) correct++; });
    addXP(correct * 8);
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

  // Sort
  const moveSort = (pos: number, dir: number) => {
    const newPos = pos + dir;
    if (newPos < 0 || newPos >= sortOrder.length) return;
    const newOrder = [...sortOrder];
    [newOrder[pos], newOrder[newPos]] = [newOrder[newPos], newOrder[pos]];
    setSortOrder(newOrder);
  };
  const checkSort = () => {
    const isOk = sortOrder.every((v, i) => v === i);
    if (isOk) { setSortOk(true); addXP(15); }
    else Alert.alert('Incorrecto', 'Algunos pasos están fuera de lugar.');
  };

  // Drag & Drop
  const handleDragDrop = (zone: string) => {
    if (dragSel === null) return;
    const item = privacyItems[dragSel];
    if (item.correct !== zone) { Alert.alert('Incorrecto', 'Esa no pertenece a esta categoría.'); return; }
    setDragPlaced(prev => ({ ...prev, [dragSel]: zone }));
    setDragSel(null);
  };
  const removeDragItem = (idx: number) => {
    setDragPlaced(prev => { const n = { ...prev }; delete n[idx]; return n; });
  };
  const checkDrag = () => {
    if (Object.keys(dragPlaced).length < privacyItems.length) { Alert.alert('Faltan tarjetas', 'Clasifica todas las tarjetas.'); return; }
    addXP(15);
    nextStep();
  };

  // Builder
  const selectBuilder = (key: string, val: string) => setBuilderState(prev => ({ ...prev, [key]: val }));
  const getBuilderComplete = (cfg: BuilderConfig) => cfg.rows.every(r => builderState[r.key]);

  // V/F
  const checkTF = () => {
    setTfChecked(true);
    let correct = 0;
    tfImpactQ.forEach((item, i) => { if (tfAnswers[i] === item.correct) correct++; });
    addXP(correct * 5);
  };

  // Sprint
  const startSprint = () => { setSprintRunning(true); setSprintSec(90); setSprintPicks({}); setSprintDone(false); };
  const pickSprint = (i: number) => {
    if (sprintDone || sprintPicks[i] !== undefined) return;
    const item = POST_SPRINT_ITEMS[i];
    setSprintPicks(prev => ({ ...prev, [i]: item.good ? 'good' : 'bad' }));
  };
  const evaluateSprint = (timeout: boolean) => {
    setSprintDone(true);
    if (sprintTimer.current) clearInterval(sprintTimer.current);
    const good = Object.values(sprintPicks).filter(v => v === 'good').length;
    const bad = Object.values(sprintPicks).filter(v => v === 'bad').length;
    const earned = Math.max(0, good * 5 - bad * 2);
    addXP(earned);
  };

  // Scenario
  const checkScenario = () => {
    if (scenarioSel === null) return;
    setScenarioChecked(true);
    if (TRIBE_SCN[scenarioSel].correct) addXP(12);
  };

  // ========== RENDER ==========
  const btn = (label: string, onPress: () => void, disabled = false, accent = false) => (
    <TouchableOpacity style={[styles.btn, disabled && styles.btnOff, accent && styles.btnAccent]} onPress={onPress} disabled={disabled}>
      <Text style={styles.btnText}>{label}</Text>
    </TouchableOpacity>
  );
  const tag = (t: string) => <Text style={styles.tag}>{t}</Text>;
  const title = (t: string) => <Text style={styles.title}>{t}</Text>;
  const sub = (t: string) => <Text style={styles.subtitle}>{t}</Text>;
  const body = (t: string) => <Text style={styles.body}>{t}</Text>;

  const renderBuilder = (cfg: BuilderConfig) => (
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
      <Text style={styles.builderLabel}>Vista previa:</Text>
      <View style={styles.codeBox}>
        <Text style={styles.codeText}>{cfg.rows.map(r => `${r.label}: ${builderState[r.key] || 'elige una opción'}`).join('\n')}</Text>
      </View>
    </View>
  );

  const renderQuizBlock = (items: QuizQ[], moduleTag: string, moduleTitle: string, moduleSub: string) => (
    <View style={styles.stepContainer}>
      {tag(moduleTag)}
      {title(moduleTitle)}
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
      {title(moduleTitle)}
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
          <View style={styles.iconCircle}><Text style={styles.iconEmoji}>📣</Text></View>
          {title('Comparte tu Creación con el Mundo')}
          {sub('El proyecto más brillante muere si nadie lo descubre. Aprende a contar tu historia, encontrar tu audiencia y compartir con propósito.')}
          {body('Storytelling con problema/héroe/solución · Lenguaje de cada plataforma · IA para crear contenido · Hashtags y SEO · Manejo de críticas · Vanity vs impacto real')}
          {btn('¡Vamos! Empecemos 🚀', nextStep)}
        </View>
      );
      case 1: return (
        <View style={styles.stepContainer}>
          {tag('📖 Módulo 1 · Teoría')}
          {title('Por qué compartir lo que creas multiplica el impacto')}
          {body('Fórmula universal: 1) Problema doloroso y específico. 2) Héroe con quien la audiencia se identifica. 3) Solución concreta que cambia su realidad.\n\nReglas: El héroe es tu USUARIO. Empieza por el dolor. Datos concretos, no palabras vagas.')}
          {btn('Entendido, sigamos →', nextStep)}
        </View>
      );
      case 2: return renderReflection('🤔 Reflexión honesta · +14 XP', 'Piensa tú',
        '¿Por qué te incomoda (o emociona) compartir lo que creas? ¿Qué te detiene — el miedo a que te critiquen, el síndrome del impostor?',
        'Me incomoda compartir porque... Lo que más me detiene es...', 100, 14);
      case 3: return (
        <View style={styles.stepContainer}>
          {tag('🛠️ Módulo 3 · Builder')}
          {title('El gancho: la primera frase')}
          {renderBuilder(BUILDER_HOOK)}
          {btn('Terminar →', () => { addXP(BUILDER_HOOK.xp); nextStep(); }, !getBuilderComplete(BUILDER_HOOK))}
        </View>
      );
      case 4: return (
        <View style={styles.stepContainer}>
          {tag('🛠️ Módulo 4 · Builder')}
          {title('Contenido multimodal: post completo')}
          {renderBuilder(BUILDER_MULTI)}
          {btn('Terminar →', () => { addXP(BUILDER_MULTI.xp); nextStep(); }, !getBuilderComplete(BUILDER_MULTI))}
        </View>
      );
      case 5: return (
        <View style={styles.stepContainer}>
          {tag('↕️ Módulo 5 · Ordenar')}
          {title('Viral por buenas razones')}
          {sortOrder.map((origIdx, pos) => (
            <View key={pos} style={styles.sortRow}>
              <View style={styles.sortNum}><Text style={styles.sortNumText}>{pos + 1}</Text></View>
              <Text style={styles.sortText}>{VIRAL_REASONS_SORT[origIdx]}</Text>
              <View style={styles.sortArrows}>
                <TouchableOpacity onPress={() => moveSort(pos, -1)} disabled={pos === 0}><MaterialIcons name="keyboard-arrow-up" size={20} /></TouchableOpacity>
                <TouchableOpacity onPress={() => moveSort(pos, 1)} disabled={pos === sortOrder.length - 1}><MaterialIcons name="keyboard-arrow-down" size={20} /></TouchableOpacity>
              </View>
            </View>
          ))}
          {!sortOk ? btn('Verificar orden', checkSort) : btn('Continuar →', nextStep)}
        </View>
      );
      case 6: return (
        <View style={styles.stepContainer}>
          {tag('🔗 Módulo 6 · Matching')}
          {title('El lenguaje de cada plataforma')}
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
      case 7: return (
        <View style={styles.stepContainer}>
          {tag('🛠️ Módulo 7 · Builder')}
          {title('IA para escribir descripciones')}
          {renderBuilder(BUILDER_DESC)}
          {btn('Terminar →', () => { addXP(BUILDER_DESC.xp); nextStep(); }, !getBuilderComplete(BUILDER_DESC))}
        </View>
      );
      case 8: return (
        <View style={styles.stepContainer}>
          {tag('🛠️ Módulo 8 · Builder')}
          {title('La miniatura perfecta')}
          {renderBuilder(BUILDER_THUMB)}
          {btn('Terminar →', () => { addXP(BUILDER_THUMB.xp); nextStep(); }, !getBuilderComplete(BUILDER_THUMB))}
        </View>
      );
      case 9: return renderReflection('💭 Reflexión sobre seguidores · +15 XP', 'Piensa tú',
        '¿Cuántas personas REALMENTE necesitas para considerar que tu proyecto está teniendo impacto — y por qué ese número?',
        'Realmente necesito... porque mi objetivo es... y mi audiencia ideal son...', 120, 15);
      case 10: return (
        <View style={styles.stepContainer}>
          {tag('⏱ Módulo 10 · Sprint 90s')}
          {title('Sprint: ¿buen o mal post?')}
          {!sprintRunning && !sprintDone ? btn('▶ Iniciar Sprint', startSprint) : sprintDone ? btn('Continuar →', nextStep) : (
            <>
              <Text style={styles.timer}>{Math.floor(sprintSec / 60)}:{String(sprintSec % 60).padStart(2, '0')}s</Text>
              <View style={styles.sprintItems}>
                {POST_SPRINT_ITEMS.map((item, i) => (
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
      case 11: return (
        <View style={styles.stepContainer}>
          {tag('🌟 Módulo 11 · Casos virales')}
          {title('Viral por buenas razones (casos reales)')}
          {body('Khan Academy: explicar algo difícil de forma simple, una y otra vez.\nLaboratoria (Mariana Costa): las heroínas son las graduadas, no ella.\nNas Daily: 1 humano + 1 problema + 1 solución + 1 lección, en 60 segundos.')}
          {btn('Sigamos →', nextStep)}
        </View>
      );
      case 12: return (
        <View style={styles.stepContainer}>
          {tag('🛠️ Módulo 12 · Builder')}
          {title('Hashtags y SEO básico con IA')}
          {renderBuilder(BUILDER_HASHTAG)}
          {btn('Terminar →', () => { addXP(BUILDER_HASHTAG.xp); nextStep(); }, !getBuilderComplete(BUILDER_HASHTAG))}
        </View>
      );
      case 13: return (
        <View style={styles.stepContainer}>
          {tag('🛠️ Módulo 13 · Builder')}
          {title('El video de 60 segundos')}
          {renderBuilder(BUILDER_VIDEO)}
          {btn('Terminar →', () => { addXP(BUILDER_VIDEO.xp); nextStep(); }, !getBuilderComplete(BUILDER_VIDEO))}
        </View>
      );
      case 14: return (
        <View style={styles.stepContainer}>
          {tag('🎯 Módulo 14 · Escenario')}
          {title('Comunidad: encuentra tu tribu')}
          {sub('4 estrategias para encontrar tu primera audiencia real.')}
          {TRIBE_SCN.map((c, i) => (
            <TouchableOpacity key={i} style={[styles.scChoice, scenarioSel === i && styles.scChoiceSel, scenarioChecked && c.correct && styles.scChoiceOk, scenarioChecked && scenarioSel === i && !c.correct && styles.scChoiceWrong]}
              onPress={() => { if (!scenarioChecked) setScenarioSel(i); }} disabled={scenarioChecked}>
              <Text style={styles.scTitle}>{c.title}</Text>
              <Text style={styles.scText}>{c.text}</Text>
            </TouchableOpacity>
          ))}
          {!scenarioChecked ? btn('Verificar elección', checkScenario, scenarioSel === null) : btn('Continuar →', nextStep)}
          {scenarioChecked && <Text style={styles.fbGood}>{scenarioSel !== null && TRIBE_SCN[scenarioSel].correct ? '✅ ' : '❌ '}{scenarioSel !== null ? TRIBE_SCN[scenarioSel].explain : ''}</Text>}
        </View>
      );
      case 15: return renderReflection('💭 Críticas y trolls · +16 XP', 'Piensa tú',
        '¿Cómo distinguirías una crítica que vale la pena escuchar de una que vale la pena ignorar — y qué reglas te darías para no perder tu norte?',
        'Una crítica vale la pena escuchar cuando... Mis 3 reglas para no perder mi norte mental serán...', 120, 16);
      case 16: return (
        <View style={styles.stepContainer}>
          {tag('🧩 Módulo 16 · Clasificar')}
          {title('Privacidad al compartir tu proyecto')}
          <View style={styles.chipWrap}>
            {privacyItems.map((item, i) => dragPlaced[i] === undefined && (
              <TouchableOpacity key={i} style={[styles.chip, dragSel === i && styles.chipOn]} onPress={() => setDragSel(dragSel === i ? null : i)}>
                <Text style={styles.chipText}>{item.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.dropRow}>
            {['share', 'protect'].map(zone => (
              <TouchableOpacity key={zone} style={styles.dropZone} onPress={() => handleDragDrop(zone)}>
                <Text style={styles.dropHeader}>{zone === 'share' ? '📢 Compartir' : '🔒 Proteger'}</Text>
                {Object.entries(dragPlaced).map(([k, v]) => v === zone && (
                  <TouchableOpacity key={k} onPress={() => removeDragItem(parseInt(k))}>
                    <Text style={styles.dropChip}>{privacyItems[parseInt(k)].text} ✕</Text>
                  </TouchableOpacity>
                ))}
              </TouchableOpacity>
            ))}
          </View>
          {btn('Verificar clasificación', checkDrag, Object.keys(dragPlaced).length < privacyItems.length)}
        </View>
      );
      case 17: return (
        <View style={styles.stepContainer}>
          {tag('✅ Módulo 17 · V/F')}
          {title('Impacto real vs vanity metrics')}
          {tfImpactQ.map((item, i) => (
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
      case 18: return renderQuizBlock(commsQ, '❓ Módulo 18 · Quiz', 'Quiz · Comunicación digital', '5 preguntas sobre los fundamentos.');
      case 19: return renderReflection('✍️ Tu post real · +18 XP', 'Piensa tú',
        'Si tuvieras que escribir UN solo post hoy sobre tu proyecto — ¿qué pondrías en la primera frase y cuál sería el llamado a acción?',
        "Mi primera frase sería: '...' Mi llamado a acción sería: '...'", 150, 18);
      case 20: return (
        <View style={styles.completeContainer}>
          <View style={styles.completeIcon}><Text style={styles.iconEmoji}>📣</Text></View>
          {title('¡Nivel 29 completado!')}
          {sub('Terminaste "Comparte tu Creación con el Mundo". Ahora eres Content Creator.')}
          <Text style={styles.xpBig}>⭐ {xp} XP ganados</Text>
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
  fill: { height: '100%', backgroundColor: '#0d9488', borderRadius: 3 },
  xpChip: { ...typography.bold, fontSize: 14, color: '#134e4a' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  stepContainer: { flex: 1 },
  tag: { fontSize: 11, fontWeight: '600', color: '#134e4a', backgroundColor: '#f0fdfa', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 12, alignSelf: 'flex-start' },
  title: { ...typography.extraBold, fontSize: 19, color: colors.textPrimary, marginBottom: 8, textAlign: 'center' },
  subtitle: { ...typography.regular, fontSize: 13, color: colors.textSecondary, marginBottom: 14, lineHeight: 18, textAlign: 'center' },
  body: { ...typography.regular, fontSize: 13, color: colors.textPrimary, lineHeight: 22, marginBottom: 12 },
  iconCircle: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#f0fdfa', justifyContent: 'center', alignItems: 'center', marginBottom: 14, alignSelf: 'center' },
  iconEmoji: { fontSize: 32 },
  btn: { backgroundColor: '#16a34a', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  btnAccent: { backgroundColor: '#0d9488' },
  btnText: { ...typography.bold, color: '#fff', fontSize: 15 },
  btnOff: { opacity: 0.4 },
  card: { backgroundColor: '#f9fafb', borderRadius: 14, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#111827', marginBottom: 4 },
  cardText: { fontSize: 13, color: '#374151', lineHeight: 20 },
  textArea: { borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, minHeight: 100, fontSize: 13, backgroundColor: '#fafafa', marginBottom: 10, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: '#9ca3af', textAlign: 'right', marginTop: 4 },
  quizQ: { ...typography.bold, fontSize: 13, padding: 12, backgroundColor: '#f9fafb', borderRadius: 10, marginBottom: 8 },
  quizOpt: { padding: 12, borderRadius: 11, borderWidth: 1.5, borderColor: '#e5e7eb', marginBottom: 6 },
  quizOptSel: { borderColor: '#0d9488', backgroundColor: '#f0fdfa' },
  quizOptText: { fontSize: 12, color: '#374151' },
  fbGood: { fontSize: 11, marginTop: 4, color: '#065f46' },
  fbBad: { fontSize: 11, marginTop: 4, color: '#991b1b' },
  matchRow: { flexDirection: 'row', gap: 10 },
  matchCard: { backgroundColor: '#fff', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 6 },
  matchSel: { borderColor: '#0d9488', backgroundColor: '#f0fdfa' },
  matchDone: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  matchText: { fontSize: 11, color: '#374151' },
  sortRow: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 6, gap: 8 },
  sortNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#0d9488', justifyContent: 'center', alignItems: 'center' },
  sortNumText: { color: '#fff', fontWeight: '700', fontSize: 11 },
  sortText: { flex: 1, fontSize: 11, color: '#374151' },
  sortArrows: { gap: 2 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 10, backgroundColor: '#f9fafb', borderRadius: 12, marginBottom: 12 },
  chip: { padding: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#d1d5db' },
  chipOn: { borderColor: '#0d9488', backgroundColor: '#f0fdfa' },
  chipText: { fontSize: 11, color: '#374151' },
  dropRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  dropZone: { flex: 1, borderWidth: 2, borderStyle: 'dashed', borderColor: '#d1d5db', borderRadius: 12, padding: 8, minHeight: 100 },
  dropHeader: { fontSize: 11, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  dropChip: { fontSize: 10, padding: 4, backgroundColor: '#dbeafe', borderRadius: 6 },
  builderRow: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 11, marginBottom: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  builderLabel: { fontSize: 11, fontWeight: '700', color: '#134e4a', marginBottom: 6 },
  builderOpts: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  builderOpt: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 9, borderWidth: 1.5, borderColor: '#e5e7eb' },
  builderOptSel: { borderColor: '#0d9488', backgroundColor: '#f0fdfa' },
  builderOptText: { fontSize: 12, color: '#374151' },
  codeBox: { backgroundColor: '#0f172a', padding: 12, borderRadius: 10, marginTop: 4 },
  codeText: { color: '#e2e8f0', fontFamily: 'monospace', fontSize: 11, lineHeight: 20 },
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
  scChoice: { borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: '#e5e7eb', marginBottom: 8 },
  scChoiceSel: { borderColor: '#0d9488', backgroundColor: '#f0fdfa' },
  scChoiceOk: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  scChoiceWrong: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  scTitle: { fontSize: 12, fontWeight: '700', color: '#111827', marginBottom: 4 },
  scText: { fontSize: 12, color: '#374151' },
  completeContainer: { alignItems: 'center', padding: 20 },
  completeIcon: { width: 86, height: 86, borderRadius: 24, backgroundColor: '#0d9488', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  completeTitle: { ...typography.extraBold, fontSize: 21 },
  xpBig: { ...typography.bold, fontSize: 18, color: '#134e4a', marginBottom: 16 },
});