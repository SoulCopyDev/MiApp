import { exitLevel } from '../utils/exitLevel';
import { router } from 'expo-router';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { useReportProgress } from '../components/LevelProgress';
import { typography } from '../theme';
import XPToast from '../components/XPToast';
import { pickN, shuffle } from '../utils/shuffle';

// ═══════════════════════════════════════════════════════════
// Nivel 27 · Tu Idea para Cambiar Algo
// Mundo 5 · TEMA CLARO (ámbar/oro: #d97706 → #f59e0b).
// Reconstruido vs nivel-27.html (estándar v2.2). 19 módulos.
// ═══════════════════════════════════════════════════════════

const P = {
  screen: '#ffffff',
  ink: '#111827', body: '#374151', muted: '#6b7280', faint: '#9ca3af',
  amber: '#d97706', amberText: '#92400e', amberBg: '#fffbeb', amberBorder: '#fde68a', gold: '#f59e0b',
  border: '#e5e7eb', cardBg: '#f9fafb',
  green: '#16a34a', greenBg: '#dcfce7', greenText: '#166534', greenSoft: '#f0fdf4', greenBorder: '#bbf7d0',
  red: '#dc2626', redBg: '#fef2f2', redText: '#991b1b',
  blueBg: '#eff6ff', blueBorder: '#bfdbfe', blueText: '#1e40af',
  purpleBg: '#fdf4ff', purpleBorder: '#e9d5ff', purpleText: '#5b21b6',
  mvpChip: '#fef3c7', mvpText: '#92400e', grandeBg: '#e0e7ff', grandeText: '#3730a3',
  amberQ: '#fef3c7',
  codeBg: '#0f172a', codeText: '#e2e8f0', codeKey: '#fcd34d', codeEmpty: '#64748b',
};

const TOTAL_STEPS = 21;
const CONTENT_STEPS = 19;
const THEORY_STEPS = new Set([0, 1, 10, 17]);

type MatchPair = { left: string; right: string };
type DragItem = { text: string; correct: 'mvp' | 'grande' };
type QuizQ = { q: string; opts: string[]; correct: number; explain: string };
type TFItem = { stmt: string; correct: boolean; explain: string };
type BuilderConfig = { xp: number; rows: { key: string; label: string; opts: string[] }[] };

const shuffleOpts = (q: QuizQ): QuizQ => {
  const paired = q.opts.map((opt, i) => ({ opt, isCorrect: i === q.correct }));
  for (let j = paired.length - 1; j > 0; j--) { const k = Math.floor(Math.random() * (j + 1)); [paired[j], paired[k]] = [paired[k], paired[j]]; }
  return { ...q, opts: paired.map((p) => p.opt), correct: paired.findIndex((p) => p.isCorrect) };
};
const normalizeText = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const looksRandom = (text: string): boolean => {
  const words = normalizeText(text).split(/\s+/).filter((w) => w.length > 0);
  if (words.length < 6) return true;
  if (new Set(words).size / words.length < 0.5) return true;
  const noVowel = words.filter((w) => w.length >= 3 && !/[aeiou]/.test(w)).length;
  return noVowel / words.length > 0.3;
};
const REFLECT_TERMS = ['problema', 'idea', 'proyecto', 'usuario', 'mvp', 'valid', 'herramienta', 'whatsapp', 'app', 'ciudad', 'barrio', 'persona', 'gente', 'resolver', 'construir', 'solucion', 'abuel', 'colegio', 'razon', 'importa', 'crear', 'ayud', 'ia', 'frustr', 'nombre', 'pitch', 'canva', 'forms', 'notion'];
const containsTopic = (text: string): boolean => {
  const n = normalizeText(text);
  const words = n.split(/[^a-z0-9]+/).filter(Boolean);
  return REFLECT_TERMS.some((t) => (t.length <= 3 ? words.includes(t) : n.includes(t)));
};

// ── Pools (fuente: nivel-27.html) — distractores alargados (§15/27) ──
const CRITERIA_POOL: QuizQ[] = [
  { q: "Tu idea es 'una app para resolver la contaminación del planeta'. ¿Qué falla?", opts: ['Es demasiado específica y solo sirve para un caso', 'Es demasiado amplia — imposible saber por dónde empezar', 'Ya existe una solución perfecta para eso', 'Requiere demasiada programación para poder hacerla'], correct: 1, explain: "Ideas tan grandes que no sabes dónde empezar. Acota: 'reciclar en mi edificio'." },
  { q: '¿Cuál es un MVP (versión mínima funcional)?', opts: ['Una app nativa con 15 funciones y pagos integrados', 'Un grupo de WhatsApp + un formulario de cuidado de mascotas', 'Un sistema completo integrado con el gobierno nacional', 'Una red social entera con todas sus funciones'], correct: 1, explain: 'MVP = lo mínimo que resuelve + permite aprender. Validable en 1 semana.' },
  { q: 'Antes de construir, ¿qué haces PRIMERO?', opts: ['Contratar de inmediato a un buen programador', 'Registrar la marca y el nombre legalmente', 'Hablar con 5 personas que vivan ese problema', 'Crear las redes sociales del proyecto primero'], correct: 2, explain: 'Validar antes de construir. 5 entrevistas honestas > 6 meses de código sin usuarios.' },
  { q: "Tu amiga dice 'qué idea tan genial'. ¿Validación suficiente?", opts: ['Sí, porque ella te conoce muy bien', 'No — los amigos son amables; busca feedback de desconocidos', 'Sí, sobre todo si te lo dice dos veces', 'Sí, pero solo si lo comparte en sus redes'], correct: 1, explain: 'Sesgo de validación social. Valida con gente que NO te conozca.' },
  { q: '¿Por qué ideas simples como Post-it o Uber funcionaron?', opts: ['Tenían muchísimo dinero para invertir desde el inicio', 'Problema específico + mucha gente con él + ejecución simple', 'Copiaron ideas que ya existían en el mercado', 'Tuvieron pura suerte en el momento correcto'], correct: 1, explain: 'Problema específico + audiencia grande + ejecución limpia = patrón repetible.' },
  { q: "'Plataforma para adultos mayores compartir recetas'. ¿Qué pregunta crítica falta?", opts: ['De qué color debería ser el logotipo', 'Cuántos usuarios tendrá en el primer mes', '¿La necesitan de verdad o les basta el WhatsApp familiar?', 'En qué país conviene lanzarla primero'], correct: 2, explain: "Validar necesidad real. Muchas 'buenas ideas' fracasan por asumir un problema." },
  { q: '¿Mínimo de dinero para un MVP con IA hoy?', opts: ['Más de 50 millones de pesos como mínimo', 'Básicamente cero: WhatsApp, Forms, Notion y chatbot gratis', 'Necesitas sí o sí un inversionista grande', 'Es obligatorio saber programar en Python'], correct: 1, explain: 'MVP de cero pesos existe. Validar cuesta tiempo, no dinero.' },
  { q: 'Al pedir feedback, la mejor pregunta es:', opts: ['¿Te gusta mi idea? Dime que sí, por favor', '¿Usarías esto que estoy pensando en crear?', '¿Cómo resuelves hoy el problema? ¿Qué funciona y qué no?', '¿Dónde firmo para que empieces ya mismo?'], correct: 2, explain: 'Preguntas abiertas sobre comportamiento real > opiniones sobre el futuro.' },
];

const EXAMPLES_POOL: QuizQ[] = [
  { q: '¿Qué tienen en común Post-it, Uber, WhatsApp y Airbnb?', opts: ['Fueron las primeras en aparecer en su categoría', 'Resolvieron un problema específico con una solución simple', 'Tuvieron inversión millonaria desde el primer día', 'Usaron inteligencia artificial desde el inicio'], correct: 1, explain: 'Patrón común: problema concreto + solución simple + ejecución clara.' },
  { q: 'El creador de Google Maps quería resolver:', opts: ['Impulsar el turismo en las grandes ciudades', 'El problema de perderse en una ciudad nueva', 'Vender publicidad digital a las empresas', 'Mostrar fotos satelitales de todo el mundo'], correct: 1, explain: 'Un problema personal universal: no saber cómo llegar de A a B.' },
  { q: 'WhatsApp empezó siendo:', opts: ['Una app de red social parecida a Facebook', 'Un sistema de estados para mostrar tu disponibilidad', 'Un juego de fiesta para reunirse con amigos', 'Una herramienta de trabajo para empresas grandes'], correct: 1, explain: "'Disponible / en reunión / sin batería'. El chat masivo vino como evolución." },
  { q: 'La idea original de Airbnb:', opts: ['Reemplazar a todos los hoteles del mundo entero', 'Alquilar 3 colchones inflables durante una conferencia', 'Competir directamente contra la empresa Booking', 'Crear una red social para viajeros frecuentes'], correct: 1, explain: 'MVP radicalmente pequeño: 3 colchones inflables por un fin de semana.' },
];

const MATCH_POOL: MatchPair[] = [
  { left: 'Mis abuelos no entienden cómo pedir medicinas por internet', right: 'Chatbot en WhatsApp que los guía paso a paso con audios' },
  { left: 'Mi grupo de estudio pierde tiempo buscando resúmenes de cada tema', right: 'Bot que recibe PDFs del colegio y devuelve resúmenes por tema' },
  { left: 'En mi barrio nadie sabe qué días pasa el camión de reciclaje', right: 'Canal automático que avisa por Telegram antes de cada recolección' },
  { left: 'Los niños de una fundación no tienen tutor de inglés', right: 'Chatbot educativo con voz adaptado a su edad y nivel' },
  { left: 'Los emprendedores de mi mamá no saben redactar facturas', right: 'Formulario + IA que genera factura profesional en PDF' },
  { left: 'Mi colegio desperdicia comida porque nadie calcula porciones', right: 'Sistema que predice asistencia y ajusta cantidades diariamente' },
];

const MVP_POOL: DragItem[] = [
  { text: 'Grupo WhatsApp con formulario de pedidos + PDF menú', correct: 'mvp' },
  { text: "Landing con botón 'únete a la lista de espera'", correct: 'mvp' },
  { text: 'Bot de Telegram que responde 3 preguntas clave', correct: 'mvp' },
  { text: 'Página simple donde alguien agenda 30 min de asesoría', correct: 'mvp' },
  { text: 'Google Sheet público con info útil actualizada a mano', correct: 'mvp' },
  { text: 'App móvil con 30 pantallas + pagos + notificaciones + logros', correct: 'grande' },
  { text: 'Plataforma completa con 5 roles y dashboard administrativo', correct: 'grande' },
  { text: 'Sistema con IA propia entrenada desde cero en 12 idiomas', correct: 'grande' },
  { text: 'Red social con feed + chat + stories + live + marketplace', correct: 'grande' },
  { text: 'Marketplace con vendedores verificados + pagos protegidos + seguro', correct: 'grande' },
];

const TF_POOL: TFItem[] = [
  { stmt: 'Necesitas una idea 100% original para que valga la pena construirla', correct: false, explain: 'Google no fue el primer buscador. Ejecutar mejor > ser primero.' },
  { stmt: 'Para validar una idea hoy puedes empezar con cero pesos', correct: true, explain: 'WhatsApp + Forms + IA gratuita = suficiente antes de invertir un peso.' },
  { stmt: 'Si no sabes programar, no puedes crear nada con IA', correct: false, explain: 'Lovable, Bolt, Bubble, Airtable y Zapier permiten construir sin código.' },
  { stmt: 'Hablar con 5 usuarios potenciales antes de construir ahorra meses perdidos', correct: true, explain: '5 conversaciones honestas te dicen si resuelves algo real.' },
  { stmt: 'Si tu primera versión te da vergüenza, lanzaste demasiado tarde', correct: true, explain: 'Reid Hoffman (LinkedIn). El perfeccionismo mata más proyectos que la mediocridad.' },
  { stmt: 'Un buen nombre garantiza el éxito del proyecto', correct: false, explain: "Ayuda pero no salva. 'Google' sonaba raro al inicio." },
  { stmt: 'El peor error es no lanzar nunca por miedo a fallar', correct: true, explain: 'Un proyecto imperfecto lanzado enseña 100x más que uno perfecto que nunca existió.' },
  { stmt: 'La IA puede reemplazar tu motivación y convicción por el proyecto', correct: false, explain: 'La IA escribe, resume, diseña. Pero por qué te importa — eso es tuyo.' },
];

const SORT_MVP = [
  "Idea cruda: 'quiero resolver X problema'",
  "Problema específico: 'X para usuario Y en contexto Z'",
  "Hipótesis de valor: 'si X pasara, Y ahorraría Z'",
  'MVP diseñado: la versión más chica que prueba la hipótesis',
  'Lanza a 5 personas: datos reales > opiniones',
  'Itera o pivotea: ajusta según lo aprendido',
];

const BUILDER_USER: BuilderConfig = { xp: 22, rows: [
  { key: 'edad', label: 'Edad de tu usuario', opts: ['Niños 6-11', 'Adolescentes 12-17', 'Jóvenes 18-25', 'Adultos 26-50', 'Adultos mayores 55+'] },
  { key: 'contexto', label: '¿Dónde vive / qué hace?', opts: ['Estudiante colegio público', 'Emprendedor pequeño', 'Trabajador de oficina', 'Cuidador/a en casa', 'Profesional independiente'] },
  { key: 'problema', label: '¿Qué problema específico vive?', opts: ['Le cuesta entender un tema técnico solo', 'Pierde tiempo en tareas repetitivas', 'No encuentra información confiable', 'Se siente solo/a o sin apoyo', 'No sabe por dónde empezar un proyecto'] },
  { key: 'canal', label: '¿Dónde lo alcanzas?', opts: ['WhatsApp (lo usa todos los días)', 'Instagram / TikTok', 'Web + Google', 'App móvil', 'Boca a boca'] },
] };
const BUILDER_PROTO: BuilderConfig = { xp: 22, rows: [
  { key: 'momento', label: '¿Cuándo se usa?', opts: ['Al despertar (necesidad de rutina)', 'Durante el estudio/trabajo', 'En una crisis o urgencia', 'Por la noche (reflexión)'] },
  { key: 'accion', label: '¿Qué hace el usuario?', opts: ['Pregunta algo y recibe respuesta en 10 seg', 'Sube un documento y recibe resumen', 'Elige entre 3 opciones y el sistema lo guía', 'Agenda algo automáticamente'] },
  { key: 'salida', label: '¿Qué obtiene?', opts: ['Texto corto y claro', 'Audio que puede escuchar', 'Lista con próximos pasos accionables', 'Confirmación visual con emoji'] },
] };
const BUILDER_PITCH: BuilderConfig = { xp: 22, rows: [
  { key: 'hook', label: '1. Gancho (5s)', opts: ['¿Sabías que 7 de cada 10 estudiantes dicen que no entienden IA?', 'Hace 2 años vi a mi abuela llorar de frustración con una app.', 'Cada día, miles de familias latinas pierden un contacto importante para siempre.'] },
  { key: 'problem', label: '2. Problema (15s)', opts: ['La gente mayor se siente excluida del mundo digital.', 'Los estudiantes pierden horas buscando resúmenes confiables.', 'Los emprendedores pequeños no saben usar IA a su favor.'] },
  { key: 'solution', label: '3. Solución (25s)', opts: ['Un chatbot en WhatsApp que guía paso a paso con audios simples.', 'Una plataforma que recibe PDFs y devuelve resúmenes por tema.', 'Una herramienta que genera plan de contenido semanal con IA.'] },
  { key: 'cta', label: '4. Llamada a acción (10s)', opts: ['Busco 5 personas dispuestas a probarlo esta semana.', 'Necesito un cofundador técnico para construir el MVP.', 'Si te interesa, déjame tu WhatsApp y te mando el primer demo.'] },
] };
const BUILDER_NAME_PROJ: BuilderConfig = { xp: 18, rows: [
  { key: 'concepto', label: 'Concepto central', opts: ['Aprende', 'Conecta', 'Cuida', 'Impulsa', 'Guía', 'Crea'] },
  { key: 'publico', label: 'Público / categoría', opts: ['Joven', 'Abuelos', 'Futuro', 'Mi gente', 'Estudiantes', 'Barrio'] },
  { key: 'emocion', label: 'Emoción / promesa', opts: ['Fácil', 'Contigo', 'Seguro', 'Libre', 'Juntos', 'Hoy'] },
] };
const BUILDER_LOGO: BuilderConfig = { xp: 15, rows: [
  { key: 'estilo', label: 'Estilo visual', opts: ['Minimalista (líneas simples)', 'Ilustración cálida (trazos dibujados)', 'Geométrico moderno', 'Orgánico / natural'] },
  { key: 'color', label: 'Paleta de color', opts: ['Cálidos (naranja/amarillo/rojo)', 'Fríos (azul/cyan/verde)', 'Neutros (negro/blanco/gris)', 'Vibrantes (rosa/violeta)'] },
  { key: 'simbolo', label: 'Símbolo central', opts: ['Una mano', 'Una planta creciendo', 'Un corazón', 'Un puente', 'Una flecha hacia adelante', 'Un círculo con personas'] },
  { key: 'mensaje', label: 'Mensaje/emoción en una palabra', opts: ['Esperanza', 'Claridad', 'Fuerza', 'Calma', 'Cambio'] },
] };

const BUILDERS: { [k: number]: { cfg: BuilderConfig; header: string } } = {
  3: { cfg: BUILDER_USER, header: 'Tu usuario:' },
  9: { cfg: BUILDER_PROTO, header: 'Tu prototipo descrito:' },
  11: { cfg: BUILDER_PITCH, header: 'Tu pitch de 60 segundos:' },
  13: { cfg: BUILDER_NAME_PROJ, header: 'Tu nombre candidato:' },
  14: { cfg: BUILDER_LOGO, header: 'Prompt de logo generado:' },
};

const REFLECTS: { [k: number]: { min: number; xp: number; tag: string; ph: string; question: () => React.ReactNode } } = {
  2: { min: 100, xp: 14, tag: 'Tus 3 problemas', ph: '1. Mi abuela no sabe usar la app del banco, se estresa cada vez... 2. Mi colegio pierde 30 min diarios pasando lista... 3. ...', question: () => <Text>Lista 3 problemas que HAS VIVIDO tú mismo (o alguien cercano). No 'el hambre mundial' — cosas concretas que te frustraron esta semana, este mes, este año. <B>Escribe cada uno en 1 frase, con la situación exacta donde sucedió.</B></Text> },
  12: { min: 100, xp: 15, tag: 'MVP cero pesos', ph: 'Elegiría validar... Con estas 3 herramientas gratuitas: 1) WhatsApp Business... 2)... 3)...', question: () => <Text>Hoy tienes herramientas que hace 5 años costaban miles de dólares: Canva, ChatGPT, Google Forms, Lovable, Notion. <B>Si tuvieras que validar UNA idea esta semana sin gastar un solo peso, ¿cuál elegirías y con qué 3 herramientas gratis la construirías?</B></Text> },
  15: { min: 120, xp: 18, tag: 'Tu ciudad', ph: 'En mi ciudad lo que más me frustra es... Quien más lo vive es... Mi solución con IA sería...', question: () => <Text>Elige UN problema urgente real de tu ciudad o barrio — NO global, algo que tú mismo ves cuando caminas afuera. <B>Descríbelo en una frase, di quién lo vive más fuerte, y propón una solución con IA que podría empezar a construirse esta semana.</B></Text> },
  18: { min: 120, xp: 18, tag: 'Tu convicción', ph: 'Mi razón es... Me importan estas personas porque... El problema que jamás dejaría sin resolver es...', question: () => <Text>La IA puede refinar una idea, buscar referencias, redactar mejor. Pero no puede darte la razón personal por la que vale luchar 2 años cuando todo falla. <B>¿Cuál es TU razón? ¿Qué problema o personas te importan lo suficiente para no rendirte?</B></Text> },
  19: { min: 150, xp: 20, tag: 'Tu plano final', ph: 'Voy a construir... Para... Porque importa ahora que...', question: () => <Text>Después de este nivel tu idea ya tiene forma. <B>Si tuvieras que explicarle a tu mejor amigo — en 3 frases — qué vas a construir, para quién, y por qué importa ahora: ¿qué le dirías?</B></Text> },
};

const tagVariants = {
  intro: { box: { backgroundColor: P.amberBg }, text: { color: P.amberText } },
  theory: { box: { backgroundColor: P.greenSoft }, text: { color: P.greenText } },
  activity: { box: { backgroundColor: P.blueBg }, text: { color: P.blueText } },
  build: { box: { backgroundColor: P.amberBg }, text: { color: P.amberText } },
  example: { box: { backgroundColor: '#fff7ed' }, text: { color: '#9a3412' } },
  quiz: { box: { backgroundColor: P.amberQ }, text: { color: P.amberText } },
  reflect: { box: { backgroundColor: '#f3f4f6' }, text: { color: '#374151' } },
} as const;
const Tag = ({ icon, label, variant }: { icon: string; label: string; variant: keyof typeof tagVariants }) => (
  <View style={[styles.tag, tagVariants[variant].box]}><Text style={[styles.tagText, tagVariants[variant].text]}>{icon}  {label}</Text></View>
);
const Title = ({ children }: { children: React.ReactNode }) => <Text style={styles.title}>{children}</Text>;
const Sub = ({ children }: { children: React.ReactNode }) => <Text style={styles.sub}>{children}</Text>;
const Body = ({ children }: { children: React.ReactNode }) => <Text style={styles.bodyText}>{children}</Text>;
const B = ({ children }: { children: React.ReactNode }) => <Text style={styles.bold}>{children}</Text>;

// ═══════════════════════════════════════════════════════════
export default function World5Level3() {
  const completeLevel = useGameStore((s) => s.completeLevel);

  const [step, setStep] = useState(0);
  useReportProgress(step, TOTAL_STEPS);
  const [xp, setXp] = useState(0);
  const [xpToast, setXpToast] = useState<{ amount: number; id: number } | null>(null);
  const awarded = useRef<Set<number>>(new Set());

  const criteriaQ = useRef(pickN(CRITERIA_POOL, 5).map(shuffleOpts)).current;
  const examplesQ = useRef(pickN(EXAMPLES_POOL, 4).map(shuffleOpts)).current;
  const matchPairs = useRef(pickN(MATCH_POOL, 4)).current;
  const mvpItems = useRef(pickN(MVP_POOL, 8)).current;
  const tfQ = useRef(pickN(TF_POOL, 5)).current;
  const rightOrder = useRef(shuffle(matchPairs.map((p) => p.right))).current;

  // Matching
  const [matchSel, setMatchSel] = useState<number | null>(null);
  const [matchedLeft, setMatchedLeft] = useState<Set<number>>(new Set());
  const [matchedRight, setMatchedRight] = useState<Set<number>>(new Set());
  const [matchFlash, setMatchFlash] = useState<number | null>(null);

  // Drag
  const [dragPlaced, setDragPlaced] = useState<{ [k: number]: 'mvp' | 'grande' }>({});
  const [dragSel, setDragSel] = useState<number | null>(null);
  const [dragSolved, setDragSolved] = useState(false);
  const [dragFb, setDragFb] = useState<{ ok: boolean; msg: string } | null>(null);
  const [dragFlash, setDragFlash] = useState<Set<number>>(new Set());
  const dragAttempts = useRef(0);

  // Sort
  const [sortOrder, setSortOrder] = useState<number[]>([]);
  const [sortSolved, setSortSolved] = useState(false);
  const [sortFb, setSortFb] = useState<{ ok: boolean; msg: string } | null>(null);
  const [sortWrong, setSortWrong] = useState<Set<number>>(new Set());

  // Builder
  const [builderState, setBuilderState] = useState<{ [k: string]: string }>({});

  // Quiz
  const [quizAnswers, setQuizAnswers] = useState<{ [k: number]: number }>({});
  const [quizChecked, setQuizChecked] = useState(false);

  // TF
  const [tfAnswers, setTfAnswers] = useState<{ [k: number]: boolean }>({});
  const [tfChecked, setTfChecked] = useState(false);

  // Reflexión
  const [reflectText, setReflectText] = useState('');
  const [reflectFb, setReflectFb] = useState<string | null>(null);

  const [expandedEx, setExpandedEx] = useState<number | null>(null);

  const isTheory = THEORY_STEPS.has(step);
  const currentQuiz = step === 4 ? criteriaQ : step === 5 ? examplesQ : null;
  const currentBuilder = BUILDERS[step];
  const currentReflect = REFLECTS[step];

  useEffect(() => {
    setMatchSel(null); setMatchedLeft(new Set()); setMatchedRight(new Set()); setMatchFlash(null);
    setDragPlaced({}); setDragSel(null); setDragSolved(false); setDragFb(null); setDragFlash(new Set()); dragAttempts.current = 0;
    if (step === 7) setSortOrder(shuffledSort());
    setSortSolved(false); setSortFb(null); setSortWrong(new Set());
    setBuilderState({});
    setQuizAnswers({}); setQuizChecked(false);
    setTfAnswers({}); setTfChecked(false);
    setReflectText(''); setReflectFb(null);
    setExpandedEx(null);
  }, [step]);

  const addXP = useCallback((amount: number) => {
    setXp((p) => p + amount);
    if (amount > 0) setXpToast((prev) => ({ amount, id: (prev?.id ?? 0) + 1 }));
  }, []);
  const awardOnce = (amount: number) => { if (!awarded.current.has(step)) { awarded.current.add(step); if (amount > 0) addXP(amount); } };

  function shuffledSort(): number[] {
    let o = shuffle([0, 1, 2, 3, 4, 5]);
    if (o.every((v, i) => v === i)) o = [1, 0, 2, 3, 4, 5];
    return o;
  }

  // Matching
  const handleMatchLeft = (i: number) => { if (!matchedLeft.has(i)) setMatchSel(i); };
  const handleMatchRight = (ri: number) => {
    if (matchSel === null || matchedRight.has(ri)) return;
    if (rightOrder[ri] === matchPairs[matchSel].right) {
      const nl = new Set(matchedLeft).add(matchSel);
      const nr = new Set(matchedRight).add(ri);
      setMatchedLeft(nl); setMatchedRight(nr); setMatchSel(null);
      if (nl.size === matchPairs.length) awardOnce(15);
    } else { setMatchFlash(ri); setMatchSel(null); setTimeout(() => setMatchFlash(null), 500); }
  };
  const matchComplete = matchedLeft.size >= matchPairs.length;

  // Drag
  const placeDrag = (zone: 'mvp' | 'grande') => { if (dragSel === null || dragSolved) return; setDragPlaced((prev) => ({ ...prev, [dragSel]: zone })); setDragSel(null); setDragFb(null); };
  const removeDrag = (idx: number) => { if (dragSolved) return; setDragPlaced((prev) => { const n = { ...prev }; delete n[idx]; return n; }); };
  const checkDrag = () => {
    const placedCount = Object.keys(dragPlaced).length;
    if (placedCount < mvpItems.length) { setDragFb({ ok: false, msg: `Faltan ${mvpItems.length - placedCount} tarjetas. Toca un chip y luego la columna.` }); return; }
    dragAttempts.current += 1;
    const wrong: number[] = []; let correct = 0;
    mvpItems.forEach((it, i) => { if (dragPlaced[i] === it.correct) correct++; else wrong.push(i); });
    if (correct === mvpItems.length) {
      setDragSolved(true);
      const earned = dragAttempts.current === 1 ? 20 : 10;
      awardOnce(earned);
      setDragFb({ ok: true, msg: `¡Genial! ${mvpItems.length} correctas. +${earned} XP 🎉${dragAttempts.current === 1 ? ' (¡primer intento!)' : ''}` });
    } else {
      setDragPlaced((prev) => { const n = { ...prev }; wrong.forEach((i) => delete n[i]); return n; });
      setDragFlash(new Set(wrong));
      setTimeout(() => setDragFlash(new Set()), 700);
      setDragFb({ ok: false, msg: `${correct} de ${mvpItems.length} correctas. Las incorrectas vuelven al banco.` });
    }
  };

  // Sort
  const moveSort = (pos: number, dir: number) => {
    const np = pos + dir; if (np < 0 || np >= sortOrder.length || sortSolved) return;
    const no = [...sortOrder]; [no[pos], no[np]] = [no[np], no[pos]]; setSortOrder(no);
    setSortWrong(new Set()); setSortFb(null);
  };
  const checkSort = () => {
    if (sortOrder.every((v, i) => v === i)) { setSortSolved(true); awardOnce(15); setSortFb({ ok: true, msg: '¡Perfecto! Ese es el orden correcto. +15 XP 🎉' }); return; }
    const wrong = new Set(sortOrder.reduce<number[]>((acc, v, i) => { if (v !== i) acc.push(i); return acc; }, []));
    setSortWrong(wrong);
    setSortFb({ ok: false, msg: `${wrong.size} pasos fuera de lugar. Usa ▲▼ para ajustar.` });
    setTimeout(() => setSortWrong(new Set()), 2200);
  };

  // Builder
  const builderComplete = (cfg: BuilderConfig) => cfg.rows.every((r) => builderState[r.key]);

  // Quiz
  const checkQuiz = () => { if (!currentQuiz) return; setQuizChecked(true); let c = 0; currentQuiz.forEach((q, i) => { if (quizAnswers[i] === q.correct) c++; }); awardOnce(c * 8); };
  // TF
  const checkTF = () => { setTfChecked(true); let c = 0; tfQ.forEach((it, i) => { if (tfAnswers[i] === it.correct) c++; }); awardOnce(c * 5); };

  // Reflexión
  const sendReflection = (): boolean => {
    if (!currentReflect) return true;
    const t = reflectText.trim();
    if (t.length < currentReflect.min) { setReflectFb(`Escribe al menos ${currentReflect.min} caracteres (llevas ${t.length}).`); return false; }
    if (looksRandom(t)) { setReflectFb('Parece texto al azar. Escribe una idea real con tus propias palabras.'); return false; }
    if (!containsTopic(t)) { setReflectFb('Conéctalo con el tema: describe el problema, a quién ayuda o tu idea/solución.'); return false; }
    setReflectFb(null); awardOnce(currentReflect.xp); return true;
  };

  // Botón primario
  type Primary = { label: string; enabled: boolean; onPress: () => void; accent?: boolean };
  const advance = () => setStep((s) => s + 1);
  const getPrimary = (): Primary => {
    if (currentReflect) return { label: 'Enviar reflexión →', enabled: reflectText.trim().length >= currentReflect.min, onPress: () => { if (sendReflection()) advance(); } };
    if (currentBuilder) return { label: 'Terminar →', enabled: builderComplete(currentBuilder.cfg), onPress: () => { awardOnce(currentBuilder.cfg.xp); advance(); } };
    switch (step) {
      case 0: return { label: '¡Vamos! Empecemos 🚀', enabled: true, onPress: advance };
      case 1: return { label: 'Entendido, sigamos →', enabled: true, onPress: advance };
      case 10: case 17: return { label: 'Sigamos →', enabled: true, onPress: advance };
      case 6: return { label: 'Continuar →', enabled: matchComplete, onPress: advance };
      case 8: return dragSolved
        ? { label: 'Continuar →', enabled: true, onPress: advance }
        : { label: 'Verificar clasificación', enabled: Object.keys(dragPlaced).length > 0, onPress: checkDrag, accent: true };
      case 7: return sortSolved
        ? { label: 'Continuar →', enabled: true, onPress: advance }
        : { label: 'Verificar orden', enabled: true, onPress: checkSort, accent: true };
      case 4: case 5: return quizChecked
        ? { label: 'Ver resultado →', enabled: true, onPress: advance }
        : { label: 'Comprobar respuestas', enabled: !!currentQuiz && Object.keys(quizAnswers).length === currentQuiz.length, onPress: checkQuiz, accent: true };
      case 16: return tfChecked
        ? { label: 'Continuar →', enabled: true, onPress: advance }
        : { label: 'Comprobar', enabled: Object.keys(tfAnswers).length === tfQ.length, onPress: checkTF, accent: true };
      default: return { label: 'Continuar →', enabled: true, onPress: advance };
    }
  };

  const finishLevel = () => {
    const stars = xp >= 200 ? 3 : xp >= 125 ? 2 : 1; // máx real ~331 XP
    completeLevel(27, stars, xp);
    router.replace('/level/28');
  };

  // ── Sub-renders ──
  const renderExCard = (i: number, emoji: string, name: string, sub: string, how: React.ReactNode, fact: string) => {
    const open = expandedEx === i;
    return (
      <TouchableOpacity key={i} activeOpacity={0.9} style={[styles.exCard, open && styles.exCardOpen]} onPress={() => setExpandedEx(open ? null : i)}>
        <View style={styles.exHeader}>
          <View style={styles.exEmoji}><Text style={{ fontSize: 20 }}>{emoji}</Text></View>
          <View style={{ flex: 1 }}><Text style={styles.exName}>{name}</Text>{!!sub && <Text style={styles.exSub}>{sub}</Text>}</View>
          <Text style={styles.exArrow}>{open ? '↓' : '›'}</Text>
        </View>
        {open && <View style={styles.exBody}><Text style={styles.exHow}>{how}</Text><View style={styles.exFact}><Text style={styles.exFactText}>{fact}</Text></View></View>}
      </TouchableOpacity>
    );
  };

  const renderQuiz = (items: QuizQ[], tag: string, mTitle: string, mSub: string) => (
    <View>
      <Tag icon="❓" label={tag} variant="quiz" />
      <Title>{mTitle}</Title>
      <Sub>{mSub}</Sub>
      {items.map((q, qi) => (
        <View key={qi} style={{ marginBottom: 18 }}>
          <Text style={styles.quizQ}>{qi + 1}. {q.q}</Text>
          {q.opts.map((o, oi) => {
            const sel = quizAnswers[qi] === oi;
            const showOk = quizChecked && oi === q.correct;
            const showWrong = quizChecked && sel && oi !== q.correct;
            return (
              <TouchableOpacity key={oi} disabled={quizChecked}
                style={[styles.qopt, sel && !quizChecked && styles.qoptSel, showOk && styles.qoptOk, showWrong && styles.qoptWrong]}
                onPress={() => setQuizAnswers((prev) => ({ ...prev, [qi]: oi }))}>
                <View style={[styles.qLetter, sel && !quizChecked && styles.qLetterSel, showOk && styles.qLetterOk, showWrong && styles.qLetterWrong]}>
                  <Text style={[styles.qLetterText, (sel || showOk || showWrong) && { color: '#fff' }]}>{String.fromCharCode(65 + oi)}</Text>
                </View>
                <Text style={styles.qoptText}>{o}</Text>
              </TouchableOpacity>
            );
          })}
          {quizChecked && (
            <View style={[styles.fb, quizAnswers[qi] === q.correct ? styles.fbOk : styles.fbBad]}>
              <Text style={quizAnswers[qi] === q.correct ? styles.fbOkText : styles.fbBadText}>{quizAnswers[qi] === q.correct ? '✓ ¡Correcto! — ' : `✗ Respuesta ${String.fromCharCode(65 + q.correct)} — `}{q.explain}</Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );

  const renderBuilder = (cfg: BuilderConfig, header: string) => (
    <View>
      <View style={styles.builderWrap}>
        {cfg.rows.map((r) => (
          <View key={r.key} style={styles.builderRow}>
            <Text style={styles.builderLabel}>{r.label}</Text>
            <View style={styles.builderOpts}>
              {r.opts.map((o) => (
                <TouchableOpacity key={o} style={[styles.builderOpt, builderState[r.key] === o && styles.builderOptSel]} onPress={() => setBuilderState((prev) => ({ ...prev, [r.key]: o }))}>
                  <Text style={[styles.builderOptText, builderState[r.key] === o && styles.builderOptTextSel]}>{o}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </View>
      <Text style={[styles.builderLabel, { marginTop: 12, marginBottom: 4 }]}>{header}</Text>
      <View style={styles.codeBox}>
        {cfg.rows.map((r) => (
          <Text key={r.key} style={styles.codeLine}>
            <Text style={styles.codeKey}>{r.label}: </Text>
            {builderState[r.key] ? <Text style={styles.codeText}>{builderState[r.key]}</Text> : <Text style={styles.codeEmpty}>elige una opción</Text>}
          </Text>
        ))}
      </View>
    </View>
  );

  const renderReflect = () => {
    const c = currentReflect!;
    return (
      <View>
        <Tag icon="✍️" label={`${c.tag} · +${c.xp} XP`} variant="reflect" />
        <Title>Piensa tú</Title>
        <Sub>No hay respuesta correcta. Procesa lo aprendido con tus palabras.</Sub>
        <View style={[styles.card, styles.cardPurple]}><Text style={styles.cardTitle}>🤔  Tu pregunta</Text><Text style={styles.cardText}>{c.question()}</Text></View>
        <TextInput style={styles.reflectArea} multiline value={reflectText} onChangeText={(t) => { setReflectText(t); if (reflectFb) setReflectFb(null); }} placeholder={c.ph} placeholderTextColor="#b8bcc0" />
        <Text style={styles.charCount}>{reflectText.trim().length} / {c.min} mínimo</Text>
        {reflectFb && <View style={[styles.fb, styles.fbBad]}><Text style={styles.fbBadText}>{reflectFb}</Text></View>}
      </View>
    );
  };

  const renderContent = () => {
    if (currentReflect) return renderReflect();
    if (currentBuilder) {
      const titles: { [k: number]: [string, string] } = {
        3: ['¿A quién ayuda tu idea exactamente?', 'Define tu usuario con 4 decisiones. Mientras más específico, mejor.'],
        9: ['Prototipa con palabras', 'Describe cómo funciona tu idea en 3 decisiones clave.'],
        11: ['Sprint: tu pitch en 60 segundos', '4 bloques: gancho + problema + solución + CTA. Arma tu pitch.'],
        13: ['El nombre de tu proyecto', 'Concepto + público + emoción = nombre memorable.'],
        14: ['El logo de tu proyecto', '4 decisiones para guiar la generación del logo con IA.'],
      };
      const labels: { [k: number]: string } = { 3: 'Módulo 3 de 19 · Builder', 9: 'Módulo 9 de 19 · Builder', 11: 'Módulo 11 de 19 · Builder', 13: 'Módulo 13 de 19 · Builder', 14: 'Módulo 14 de 19 · Builder' };
      return (<View><Tag icon="🛠️" label={labels[step]} variant="build" /><Title>{titles[step][0]}</Title><Sub>{titles[step][1]}</Sub>{renderBuilder(currentBuilder.cfg, currentBuilder.header)}</View>);
    }
    switch (step) {
      case 0: return (
        <View>
          <View style={styles.introIcon}><Text style={{ fontSize: 34 }}>💡</Text></View>
          <Tag icon="✨" label="Nivel 27 · Mundo 5" variant="intro" />
          <Title>Tu Idea para Cambiar Algo</Title>
          <Sub>Los mejores inventos empezaron con una frustración personal. En este nivel vas a pasar de 'tengo ideas vagas' a 'tengo el plano completo de mi propio proyecto'.</Sub>
          <View style={[styles.card, styles.cardAccent]}><Text style={styles.cardTitle}>📚  Qué vas a aprender</Text><Text style={styles.cardText}>Cómo pasar de idea vaga a proyecto con plano · Criterios de una buena idea · MVP · Validación real · Ideas simples que cambiaron el mundo · Tu primer pitch</Text></View>
          <View style={[styles.card, styles.cardGreen]}><Text style={styles.cardTitle}>⚡  Qué podrás HACER al terminar</Text><Text style={styles.cardText}>Tener el plano completo de tu idea: problema + solución + usuario + nombre + pitch de 60 segundos listo para presentar.</Text></View>
          <View style={[styles.card, styles.cardYellow]}><Text style={styles.cardTitle}>🎮  19 módulos · 45-60 min · hasta 230 XP</Text><Text style={styles.cardText}>📖 Teoría · ✍️ Problemas · 👤 Builder usuario · ❓ Criterios · 🔗 Match · ↕️ MVP sort · 🧩 MVP vs grande · 🎨 Prototipa · 🗣️ Valida con 5 · 🏷️ Nombre · 🎨 Logo · ✅ V/F · 🇱🇦 Casos LATAM</Text></View>
        </View>
      );
      case 1: return (
        <View>
          <Tag icon="📖" label="Módulo 1 de 19 · Teoría" variant="theory" />
          <Title>Los mejores inventos empezaron con una frustración</Title>
          <Body>Los proyectos que cambian el mundo no empiezan con una idea genial. Empiezan con <B>una frustración personal</B> que alguien no quiso aguantar más. Post-it nació porque un químico no podía marcar páginas. Uber nació en una noche fría en París sin taxi.</Body>
          <View style={styles.highlightBox}><Text style={styles.highlightText}>💡 <B>La fórmula que sí funciona:</B>{'\n'}1. Detecta un problema que TÚ vives (no uno abstracto).{'\n'}2. Confirma que otras personas también lo viven.{'\n'}3. Diseña la versión más pequeña posible.{'\n'}4. Lanza y aprende.</Text></View>
          <Body>Este nivel NO es sobre ideas millonarias. Es sobre <B>pensar como creador</B>: ver oportunidades donde otros ven quejas. La plata puede venir después. El impacto primero.</Body>
          <Text style={styles.sectionTitle}>🎯 Los 5 filtros de una idea que vale la pena</Text>
          {[['1', 'Específica:', "'niños 8-10 zona rural con celular compartido', no 'educación'."], ['2', 'Resoluble:', 'se puede construir con herramientas actuales.'], ['3', 'Relevante:', 'alguien más que tú lo sufre de verdad.'], ['4', 'Posible hoy:', 'MVP en menos de 2 semanas.'], ['5', 'Tuya:', 'te importa aunque nadie pague — ahí está el combustible.']].map(([n, t, d]) => (
            <View key={n} style={styles.stepLi}><View style={styles.stepNum}><Text style={styles.stepNumText}>{n}</Text></View><Text style={styles.stepLiText}><B>{t}</B> {d}</Text></View>
          ))}
          <View style={styles.tipBox}><Text style={styles.tipText}>✅ <B>La gran diferencia:</B> la IA combina ideas existentes. Pero solo TÚ conoces el problema específico que te quita el sueño. La idea no se delega.</Text></View>
        </View>
      );
      case 4: return renderQuiz(criteriaQ, 'Módulo 4 de 19 · Quiz', '¿Cómo sé si mi idea es buena?', '5 situaciones reales. Aplica los 5 filtros.');
      case 5: return renderQuiz(examplesQ, 'Módulo 5 de 19 · Quiz', 'Ideas simples que cambiaron el mundo', '4 productos famosos. ¿Cómo empezaron en realidad?');
      case 6: return (
        <View>
          <Tag icon="🔗" label="Módulo 6 de 19 · Matching" variant="activity" />
          <Title>Problema → Solución con IA</Title>
          <Sub>Conecta un problema real con la solución que lo resuelve: toca uno de la izquierda y luego su par a la derecha.</Sub>
          <View style={styles.matchHeaderRow}><Text style={styles.matchColLabel}>Problema real</Text><Text style={styles.matchColLabel}>Solución con IA</Text></View>
          {matchPairs.map((p, i) => (
            <View key={i} style={styles.matchRow}>
              <TouchableOpacity disabled={matchedLeft.has(i)} style={[styles.matchItem, styles.matchLeft, matchSel === i && styles.matchItemSel, matchedLeft.has(i) && styles.matchItemDone]} onPress={() => handleMatchLeft(i)}>
                <Text style={[styles.matchItemText, matchedLeft.has(i) && styles.matchItemTextDone]}>{p.left}</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={matchedRight.has(i)} style={[styles.matchItem, styles.matchRight, matchedRight.has(i) && styles.matchItemDone, matchFlash === i && styles.matchItemFlash]} onPress={() => handleMatchRight(i)}>
                <Text style={[styles.matchItemText, matchedRight.has(i) && styles.matchItemTextDone]}>{rightOrder[i]}</Text>
              </TouchableOpacity>
            </View>
          ))}
          {matchComplete
            ? <View style={[styles.fb, styles.fbOk]}><Text style={styles.fbOkText}>¡Excelente! Todos los pares conectados. +15 XP 🎉</Text></View>
            : <View style={[styles.fb, styles.fbNeutral]}><Text style={styles.fbNeutralText}>{matchedLeft.size} de {matchPairs.length} conectados.</Text></View>}
        </View>
      );
      case 7: return (
        <View>
          <Tag icon="↕️" label="Módulo 7 de 19 · Ordenar" variant="activity" />
          <Title>El MVP: la versión más simple</Title>
          <Sub>Ordena los 6 pasos para pasar de idea cruda a MVP validado.</Sub>
          {sortOrder.map((itemIdx, pos) => {
            const [label, ...rest] = SORT_MVP[itemIdx].split(':');
            return (
              <View key={pos} style={[styles.sortItem, sortWrong.has(pos) && styles.sortItemWrong, sortSolved && styles.sortItemOk]}>
                <View style={styles.sortNum}><Text style={styles.sortNumText}>{pos + 1}</Text></View>
                <Text style={styles.sortText}><B>{label}:</B>{rest.join(':')}</Text>
                <View style={styles.sortArrows}>
                  <TouchableOpacity disabled={pos === 0 || sortSolved} style={[styles.sortBtn, (pos === 0 || sortSolved) && styles.sortBtnOff]} onPress={() => moveSort(pos, -1)}><Text style={styles.sortBtnText}>▲</Text></TouchableOpacity>
                  <TouchableOpacity disabled={pos === sortOrder.length - 1 || sortSolved} style={[styles.sortBtn, (pos === sortOrder.length - 1 || sortSolved) && styles.sortBtnOff]} onPress={() => moveSort(pos, 1)}><Text style={styles.sortBtnText}>▼</Text></TouchableOpacity>
                </View>
              </View>
            );
          })}
          {sortFb && <View style={[styles.fb, sortFb.ok ? styles.fbOk : styles.fbBad]}><Text style={sortFb.ok ? styles.fbOkText : styles.fbBadText}>{sortFb.msg}</Text></View>}
        </View>
      );
      case 8: {
        const cols = (['mvp', 'grande'] as const).map((zone) => {
          const placedHere = Object.keys(dragPlaced).map(Number).filter((k) => dragPlaced[k] === zone);
          const hasItem = placedHere.length > 0;
          return (
            <TouchableOpacity key={zone} activeOpacity={0.9} disabled={dragSel === null || dragSolved} style={[styles.dropCol, zone === 'mvp' ? (hasItem && styles.dropColMvpFull) : (hasItem && styles.dropColGrandeFull)]} onPress={() => placeDrag(zone)}>
              <View style={[styles.dropHeader, zone === 'mvp' ? styles.dropHeaderMvp : styles.dropHeaderGrande]}>
                <Text style={[styles.dropHeaderText, { color: zone === 'mvp' ? P.mvpText : P.grandeText }]}>{zone === 'mvp' ? '🌱 MVP (simple)' : '🏛️ Idea grande'}</Text>
              </View>
              <View style={styles.dropArea}>
                {placedHere.map((k) => (
                  <TouchableOpacity key={k} disabled={dragSolved} onPress={() => removeDrag(k)} style={[styles.dropChip, zone === 'mvp' ? styles.dropChipMvp : styles.dropChipGrande]}>
                    <Text style={[styles.dropChipText, { color: zone === 'mvp' ? P.mvpText : P.grandeText }]}>{mvpItems[k].text}  ✕</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          );
        });
        return (
          <View>
            <Tag icon="🧩" label="Módulo 8 de 19 · Clasificar" variant="activity" />
            <Title>MVP vs Idea completa</Title>
            <Sub>Clasifica: ¿es un MVP validable en 1 semana, o una idea grande que requiere meses? Toca un chip y luego la columna.</Sub>
            <View style={styles.chipsPool}>
              {mvpItems.map((it, i) => dragPlaced[i] === undefined && (
                <TouchableOpacity key={i} disabled={dragSolved} style={[styles.chip, dragSel === i && styles.chipSel, dragFlash.has(i) && styles.chipFlash]} onPress={() => setDragSel(dragSel === i ? null : i)}>
                  <Text style={[styles.chipText, dragSel === i && { color: P.amberText }]}>{it.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.dropCols}>{cols}</View>
            {dragFb && <View style={[styles.fb, dragFb.ok ? styles.fbOk : styles.fbBad]}><Text style={dragFb.ok ? styles.fbOkText : styles.fbBadText}>{dragFb.msg}</Text></View>}
          </View>
        );
      }
      case 10: return (
        <View>
          <Tag icon="🗣️" label="Módulo 10 de 19 · Validación" variant="example" />
          <Title>Valida con 5 personas reales</Title>
          <Sub>3 casos sobre cómo hacer entrevistas de validación que realmente sirvan. Toca cada tarjeta 👆</Sub>
          {renderExCard(0, '📋', 'Las 3 preguntas oro', 'Lo que preguntas en la entrevista', <Text><B>1. ¿Cómo resuelves hoy este problema?</B> Si no tiene workaround, quizás no es tan doloroso. <B>2. ¿Qué es lo más frustrante?</B> Buscas la emoción real. <B>3. ¿Pagarías por una solución?</B> Distingue interés de intención.</Text>, "⭐ Evita '¿te gustaría una app de X?'. Siempre dicen que sí. Busca comportamiento real, no opinión futura.")}
          {renderExCard(1, '🎯', 'Encuentra 5 personas reales', 'Dónde los buscas', <Text><B>No pidas a tus amigos</B> (sesgo). Busca personas que viven el problema HOY: grupos de Facebook, subreddits, foros, vecinos. Si no conoces a 5 con ese problema, quizás no es tan grande como creías.</Text>, '⭐ Si encuentras 5 fácil y todas sufren igual → señal verde. Si cuesta encontrar 5 → idea muy nicho o mal planteada.')}
          {renderExCard(2, '🗣️', 'Escucha más de lo que hablas', 'La regla del 80/20', <Text>En la entrevista: <B>80% el usuario habla, 20% tú</B>. No defiendas tu idea, no vendas — solo escucha. Si el usuario te pregunta '¿cómo lo uso?' espontáneamente, es de las mejores señales.</Text>, "⭐ Paul Graham (YC): 'habla con usuarios'. No con inversionistas ni amigos — con usuarios reales del problema.")}
        </View>
      );
      case 16: return (
        <View>
          <Tag icon="✅" label="Módulo 16 de 19 · Verdadero o Falso" variant="activity" />
          <Title>Mitos de emprender con IA</Title>
          <Sub>5 afirmaciones populares. ¿Cuáles son verdad y cuáles mito?</Sub>
          {tfQ.map((it, i) => {
            const ans = tfAnswers[i];
            return (
              <View key={i} style={styles.tfSet}>
                <Text style={styles.tfQ}>{i + 1}. {it.stmt}</Text>
                <View style={styles.tfOpts}>
                  <TouchableOpacity disabled={tfChecked} style={[styles.tfBtn, ans === true && !tfChecked && styles.tfBtnTrue, tfChecked && it.correct === true && styles.tfBtnCorrect, tfChecked && ans === true && !it.correct && styles.tfBtnWrong]} onPress={() => setTfAnswers((prev) => ({ ...prev, [i]: true }))}><Text style={styles.tfBtnText}>✅ Verdadero</Text></TouchableOpacity>
                  <TouchableOpacity disabled={tfChecked} style={[styles.tfBtn, ans === false && !tfChecked && styles.tfBtnFalse, tfChecked && it.correct === false && styles.tfBtnCorrect, tfChecked && ans === false && it.correct && styles.tfBtnWrong]} onPress={() => setTfAnswers((prev) => ({ ...prev, [i]: false }))}><Text style={styles.tfBtnText}>❌ Falso</Text></TouchableOpacity>
                </View>
                {tfChecked && (
                  <View style={[styles.fb, ans === it.correct ? styles.fbOk : styles.fbBad]}>
                    <Text style={ans === it.correct ? styles.fbOkText : styles.fbBadText}>{ans === it.correct ? '✅ Correcto. ' : `❌ Incorrecto. La respuesta correcta es "${it.correct ? 'Verdadero' : 'Falso'}". `}{it.explain}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      );
      case 17: return (
        <View>
          <Tag icon="🌎" label="Módulo 17 de 19 · Casos reales" variant="example" />
          <Title>Jóvenes latinoamericanos que cambiaron algo</Title>
          <Sub>3 historias reales: de una frustración personal a impacto masivo. Toca cada tarjeta 👆</Sub>
          {renderExCard(0, '🇨🇴', 'Simón Borrero (Colombia)', 'De aburrirse en clase a construir Rappi', <Text>Simón detectó un problema simple: en Bogotá pedir algo a domicilio <B>era pesadilla</B>. Empezó resolviendo una sola zona de la ciudad. No intentó cubrir el país desde el día 1. Validó con calles, riders y restaurantes reales.</Text>, '⭐ Rappi hoy opera en 9 países. Pero empezó con un barrio, 5 restaurantes y unos mensajeros. Empezar pequeño es la única forma de empezar.')}
          {renderExCard(1, '🇦🇷', 'Alec Oxenford (Argentina)', 'Mercado Libre empezó resolviendo UNA cosa', <Text>Alec vio que en 1999 no había plataforma confiable para comprar y vender usado en LATAM. Su primer producto era rudimentario — <B>ni aceptaba pagos online</B>. Pero resolvía lo más doloroso: conectar vendedor y comprador con confianza.</Text>, '⭐ Mercado Libre hoy vale ~90 mil millones USD. Patrón: dolor + MVP + iteración durante 20+ años.')}
          {renderExCard(2, '🇲🇽', 'Elisa Velázquez (México)', 'Cursos gratuitos de IA para mujeres latinas', <Text>Elisa notó que en el auge de IA <B>casi ninguna mujer latina entraba al campo</B>. No creó una startup millonaria — creó comunidad con cursos gratuitos. Empezó con Instagram, Discord y 12 alumnas.</Text>, '⭐ El impacto no siempre es plata. A veces es que tu primera alumna hoy enseñe su propio taller.')}
        </View>
      );
      case 20: {
        const pct = Math.round((27 / 36) * 100);
        return (
          <View style={styles.completeContainer}>
            <View style={styles.completeBadge}><Text style={{ fontSize: 44 }}>💡</Text></View>
            <Text style={styles.completeTitle}>¡Nivel 27 completado!</Text>
            <Text style={styles.completeSub}>Terminaste "Tu Idea para Cambiar Algo". Ahora eres Changemaker.</Text>
            <View style={styles.xpEarned}><Text style={styles.xpEarnedText}>⭐ {xp} XP ganados en este nivel</Text></View>
            <View style={styles.skillsList}>
              {['Puedo identificar un problema real de mi entorno que valga la pena resolver', 'Sé diferenciar MVP de idea completa — y por qué empezar pequeño', 'Tengo el plano: problema + solución + usuario + nombre + pitch', 'Entiendo que la IA es herramienta — la idea y la motivación son mías', 'Puedo presentar mi idea en 60s con estructura clara y pitch memorable'].map((s, i) => (
                <View key={i} style={styles.skillRow}><Text style={styles.skillCheck}>✓</Text><Text style={styles.skillText}>{s}</Text></View>
              ))}
            </View>
            <View style={styles.nextHint}><Text style={styles.nextHintText}><B>Nivel 28: Diseña una App con IA — Sin Código</B>{'\n'}Ya tienes la idea. Ahora vas a convertirla en app real usando Lovable, Bolt o Bubble. De la idea al prototipo sin escribir código.</Text></View>
            <View style={styles.lvlBarWrap}>
              <Text style={styles.lvlBarLabel}>Nivel 27 de 36 completado · {pct}% del camino</Text>
              <View style={styles.lvlBarOuter}><View style={[styles.lvlBarInner, { width: `${pct}%` }]} /></View>
            </View>
            <TouchableOpacity style={[styles.primaryBtn, styles.primaryBtnAccent, { width: '100%' }]} onPress={finishLevel}><Text style={styles.primaryBtnText}>Siguiente nivel →</Text></TouchableOpacity>
          </View>
        );
      }
      default: return null;
    }
  };

  const primary = getPrimary();
  const progress = (step / (TOTAL_STEPS - 1)) * 100;
  const progLabel = step === 0 ? 'Introducción' : step < TOTAL_STEPS - 1 ? `Módulo ${step} de ${CONTENT_STEPS}` : '¡Nivel completado!';

  return (
    <View style={styles.screen}>
      <View style={styles.bar}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => exitLevel()} accessibilityLabel="Salir del nivel"><Text style={styles.closeBtnText}>✕</Text></TouchableOpacity>
        <View style={styles.track}><View style={[styles.fill, { width: `${progress}%` }]} /></View>
        <Text style={styles.xpChip}>{xp} XP</Text>
      </View>
      {step < TOTAL_STEPS - 1 && <Text style={styles.progLabel}>{progLabel}</Text>}
      <ScrollView contentContainerStyle={styles.scrollContent}>{renderContent()}</ScrollView>

      {step !== TOTAL_STEPS - 1 && (
        <View style={styles.navRow}>
          {isTheory && step > 0 && <TouchableOpacity style={styles.backBtn} onPress={() => setStep((s) => s - 1)}><Text style={styles.backBtnText}>← Volver</Text></TouchableOpacity>}
          <TouchableOpacity style={[styles.primaryBtn, primary.accent && styles.primaryBtnAccent, { flex: 1 }, !primary.enabled && styles.primaryBtnOff]} disabled={!primary.enabled} onPress={primary.onPress}>
            <Text style={styles.primaryBtnText}>{primary.label}</Text>
          </TouchableOpacity>
        </View>
      )}
      {xpToast && <XPToast key={xpToast.id} amount={xpToast.amount} onHide={() => setXpToast(null)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.screen },
  bar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: P.border, backgroundColor: '#fafafa' },
  closeBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: P.border, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 15, fontWeight: '800', color: P.muted },
  track: { flex: 1, height: 8, backgroundColor: P.border, borderRadius: 4, marginHorizontal: 12, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: P.amber, borderRadius: 4 },
  xpChip: { ...typography.bold, fontSize: 13, color: '#854d0e', backgroundColor: '#fde68a', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
  progLabel: { ...typography.regular, fontSize: 11, color: P.faint, textAlign: 'center', paddingTop: 6 },
  scrollContent: { padding: 16, paddingBottom: 30 },

  tag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginBottom: 12 },
  tagText: { fontSize: 11, fontWeight: '700' },

  introIcon: { width: 68, height: 68, borderRadius: 20, backgroundColor: P.amberBg, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  title: { ...typography.extraBold, fontSize: 20, color: P.ink, marginBottom: 8, lineHeight: 26 },
  sub: { ...typography.regular, fontSize: 13, color: P.muted, lineHeight: 20, marginBottom: 12 },
  bodyText: { ...typography.regular, fontSize: 13, color: P.body, lineHeight: 22, marginBottom: 12 },
  bold: { fontWeight: '700', color: P.ink },
  sectionTitle: { ...typography.bold, fontSize: 14, color: P.ink, marginTop: 10, marginBottom: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f0f0f0' },

  card: { backgroundColor: P.cardBg, borderRadius: 14, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: P.border },
  cardAccent: { backgroundColor: P.amberBg, borderColor: P.amberBorder },
  cardGreen: { backgroundColor: P.greenSoft, borderColor: P.greenBorder },
  cardYellow: { backgroundColor: '#fefce8', borderColor: P.amberBorder },
  cardPurple: { backgroundColor: P.purpleBg, borderColor: P.purpleBorder },
  cardTitle: { ...typography.bold, fontSize: 13, color: P.ink, marginBottom: 4 },
  cardText: { ...typography.regular, fontSize: 13, color: P.body, lineHeight: 21 },

  highlightBox: { borderLeftWidth: 3, borderLeftColor: P.amber, backgroundColor: P.amberBg, borderRadius: 8, padding: 12, marginBottom: 12 },
  highlightText: { fontSize: 13, color: P.amberText, lineHeight: 21 },
  tipBox: { borderLeftWidth: 3, borderLeftColor: P.green, backgroundColor: P.greenSoft, borderRadius: 8, padding: 12, marginTop: 4 },
  tipText: { fontSize: 13, color: P.greenText, lineHeight: 21 },
  stepLi: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 9 },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: P.amber, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  stepLiText: { flex: 1, fontSize: 13, color: P.body, lineHeight: 20 },

  matchHeaderRow: { flexDirection: 'row', gap: 6, marginBottom: 5 },
  matchColLabel: { flex: 1, fontSize: 11, fontWeight: '700', color: P.muted, textAlign: 'center' },
  matchRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  matchItem: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1.5, minHeight: 60, justifyContent: 'center' },
  matchLeft: { backgroundColor: P.blueBg, borderColor: P.blueBorder },
  matchRight: { backgroundColor: P.purpleBg, borderColor: P.purpleBorder },
  matchItemSel: { borderColor: P.amber, backgroundColor: P.amberBg },
  matchItemDone: { borderColor: P.green, backgroundColor: P.greenSoft },
  matchItemFlash: { borderColor: P.red, backgroundColor: P.redBg },
  matchItemText: { fontSize: 12, color: P.body, lineHeight: 16, textAlign: 'center' },
  matchItemTextDone: { color: P.greenText, fontWeight: '600' },

  chipsPool: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, padding: 10, backgroundColor: P.cardBg, borderRadius: 14, borderWidth: 1, borderColor: P.border, marginBottom: 10, minHeight: 54 },
  chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#d1d5db', backgroundColor: '#fff' },
  chipSel: { borderColor: P.amber, backgroundColor: P.amberBg },
  chipFlash: { borderColor: '#fca5a5', backgroundColor: P.redBg },
  chipText: { fontSize: 12, color: P.body, lineHeight: 16 },
  dropCols: { flexDirection: 'row', gap: 8 },
  dropCol: { flex: 1, borderRadius: 12, borderWidth: 2, borderColor: '#d1d5db', borderStyle: 'dashed', minHeight: 110, padding: 8, backgroundColor: '#fafafa' },
  dropColMvpFull: { borderStyle: 'solid', borderColor: P.amberBorder, backgroundColor: P.amberBg },
  dropColGrandeFull: { borderStyle: 'solid', borderColor: '#c7d2fe', backgroundColor: '#eef2ff' },
  dropHeader: { paddingVertical: 5, borderRadius: 7, marginBottom: 7 },
  dropHeaderMvp: { backgroundColor: P.amberBg },
  dropHeaderGrande: { backgroundColor: P.grandeBg },
  dropHeaderText: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  dropArea: { gap: 5 },
  dropChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14 },
  dropChipMvp: { backgroundColor: P.mvpChip },
  dropChipGrande: { backgroundColor: P.grandeBg },
  dropChipText: { fontSize: 11, fontWeight: '500', lineHeight: 15 },

  sortItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: P.cardBg, borderRadius: 12, borderWidth: 1.5, borderColor: P.border, marginBottom: 7 },
  sortItemOk: { borderColor: '#86efac', backgroundColor: P.greenSoft },
  sortItemWrong: { borderColor: '#fca5a5', backgroundColor: P.redBg },
  sortNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: P.amber, alignItems: 'center', justifyContent: 'center' },
  sortNumText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  sortText: { flex: 1, fontSize: 12, color: P.body, lineHeight: 17 },
  sortArrows: { gap: 3 },
  sortBtn: { width: 30, height: 26, borderRadius: 7, borderWidth: 1, borderColor: P.border, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  sortBtnOff: { opacity: 0.25 },
  sortBtnText: { fontSize: 11, color: P.muted },

  builderWrap: { gap: 10 },
  builderRow: { backgroundColor: P.cardBg, borderWidth: 1, borderColor: P.border, borderRadius: 12, padding: 11 },
  builderLabel: { fontSize: 11, fontWeight: '700', color: P.amberText, marginBottom: 6, letterSpacing: 0.3, textTransform: 'uppercase' },
  builderOpts: { gap: 5 },
  builderOpt: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 9, borderWidth: 1.5, borderColor: P.border, backgroundColor: '#fff' },
  builderOptSel: { borderColor: P.amber, backgroundColor: P.amberBg },
  builderOptText: { fontSize: 12, color: P.body, fontWeight: '500', lineHeight: 16 },
  builderOptTextSel: { color: P.amberText, fontWeight: '700' },
  codeBox: { backgroundColor: P.codeBg, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#1e293b' },
  codeLine: { fontSize: 12, lineHeight: 20, marginBottom: 2 },
  codeText: { color: P.codeText, fontFamily: 'monospace' },
  codeKey: { color: P.codeKey, fontWeight: '700', fontFamily: 'monospace' },
  codeEmpty: { color: P.codeEmpty, fontStyle: 'italic', fontFamily: 'monospace' },

  quizQ: { ...typography.bold, fontSize: 13, color: P.ink, padding: 12, backgroundColor: P.cardBg, borderRadius: 10, borderWidth: 1, borderColor: P.border, marginBottom: 8, lineHeight: 19 },
  qopt: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 11, borderWidth: 1.5, borderColor: P.border, backgroundColor: '#fff', marginBottom: 7 },
  qoptSel: { borderColor: P.amber, backgroundColor: P.amberBg },
  qoptOk: { borderColor: P.green, backgroundColor: P.greenBg },
  qoptWrong: { borderColor: P.red, backgroundColor: P.redBg },
  qLetter: { width: 24, height: 24, borderRadius: 7, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: P.border, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  qLetterSel: { backgroundColor: P.amber, borderColor: P.amber },
  qLetterOk: { backgroundColor: P.green, borderColor: P.green },
  qLetterWrong: { backgroundColor: P.red, borderColor: P.red },
  qLetterText: { fontSize: 11, fontWeight: '700', color: P.muted },
  qoptText: { flex: 1, fontSize: 12, color: P.body, lineHeight: 17 },

  tfSet: { marginBottom: 16 },
  tfQ: { fontSize: 13, fontWeight: '700', color: P.ink, padding: 12, backgroundColor: P.cardBg, borderRadius: 10, borderWidth: 1, borderColor: P.border, marginBottom: 10, lineHeight: 19 },
  tfOpts: { flexDirection: 'row', gap: 8 },
  tfBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 2, borderColor: P.border, backgroundColor: '#fff', alignItems: 'center' },
  tfBtnTrue: { borderColor: P.green, backgroundColor: P.greenSoft },
  tfBtnFalse: { borderColor: P.red, backgroundColor: P.redBg },
  tfBtnCorrect: { borderColor: P.green, backgroundColor: P.greenBg },
  tfBtnWrong: { borderColor: P.red, backgroundColor: P.redBg },
  tfBtnText: { fontSize: 13, fontWeight: '700', color: P.body },

  reflectArea: { minHeight: 120, padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: P.border, backgroundColor: '#fafafa', fontSize: 13, color: P.body, lineHeight: 22, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: P.faint, textAlign: 'right', marginTop: 4 },

  exCard: { borderRadius: 14, padding: 12, borderWidth: 1, borderColor: P.border, marginBottom: 8, backgroundColor: '#fff' },
  exCardOpen: { borderColor: P.amber, backgroundColor: P.amberBg },
  exHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exEmoji: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  exName: { fontSize: 13, fontWeight: '700', color: P.ink },
  exSub: { fontSize: 11, color: P.muted, marginTop: 1 },
  exArrow: { fontSize: 18, color: P.faint },
  exBody: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: P.border },
  exHow: { fontSize: 12, color: P.body, lineHeight: 19, marginBottom: 8 },
  exFact: { backgroundColor: '#fef9c3', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#fde68a' },
  exFactText: { fontSize: 12, color: '#854d0e', fontWeight: '500', lineHeight: 17 },

  fb: { borderRadius: 10, padding: 11, marginTop: 8 },
  fbOk: { backgroundColor: P.greenBg },
  fbBad: { backgroundColor: P.redBg },
  fbNeutral: { backgroundColor: P.cardBg, borderWidth: 1, borderColor: P.border },
  fbOkText: { fontSize: 12, color: P.greenText, lineHeight: 18, fontWeight: '500' },
  fbBadText: { fontSize: 12, color: P.redText, lineHeight: 18, fontWeight: '500' },
  fbNeutralText: { fontSize: 12, color: P.muted, lineHeight: 18 },

  completeContainer: { alignItems: 'center', paddingTop: 8 },
  completeBadge: { width: 88, height: 88, borderRadius: 24, backgroundColor: P.amber, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  completeTitle: { ...typography.extraBold, fontSize: 22, color: P.ink, marginBottom: 6, textAlign: 'center' },
  completeSub: { fontSize: 13, color: P.muted, textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  xpEarned: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 20, backgroundColor: '#fef9c3', borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#fde047', width: '100%' },
  xpEarnedText: { fontSize: 16, fontWeight: '700', color: '#854d0e' },
  skillsList: { gap: 7, marginBottom: 16, width: '100%' },
  skillRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 10, backgroundColor: P.greenSoft, borderRadius: 10, borderWidth: 1, borderColor: P.greenBorder },
  skillCheck: { color: P.green, fontSize: 15, fontWeight: '800' },
  skillText: { flex: 1, fontSize: 12, color: P.greenText, lineHeight: 17, fontWeight: '500' },
  nextHint: { padding: 12, backgroundColor: P.cardBg, borderRadius: 10, borderWidth: 1, borderColor: P.border, width: '100%', marginBottom: 14 },
  nextHintText: { fontSize: 12, color: P.body, lineHeight: 20 },
  lvlBarWrap: { width: '100%', marginBottom: 16 },
  lvlBarLabel: { fontSize: 11, color: P.muted, marginBottom: 5 },
  lvlBarOuter: { height: 7, backgroundColor: P.border, borderRadius: 4, overflow: 'hidden' },
  lvlBarInner: { height: '100%', backgroundColor: P.amber, borderRadius: 4 },

  navRow: { flexDirection: 'row', gap: 8, padding: 14, borderTopWidth: 1, borderTopColor: '#f0f0f0', backgroundColor: '#fafafa' },
  backBtn: { paddingHorizontal: 16, paddingVertical: 13, borderRadius: 12, backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#e2e8f0', justifyContent: 'center' },
  backBtnText: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  primaryBtn: { backgroundColor: P.green, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
  primaryBtnAccent: { backgroundColor: P.amber },
  primaryBtnOff: { opacity: 0.35 },
  primaryBtnText: { ...typography.bold, color: '#fff', fontSize: 15 },
});
