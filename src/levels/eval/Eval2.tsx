import { useState, useEffect, type ReactNode } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Platform,
  Alert, BackHandler,
} from 'react-native';
import { router } from 'expo-router';
import { useGameStore } from '../../store/gameStore';
import { typography } from '../../theme';
import { exitLevel } from '../../utils/exitLevel';
import XPToast from '../../components/XPToast';

// ===================== HELPERS =====================
const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function looksRandom(text: string): boolean {
  const words = normalize(text).split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return true;
  const noVowels = words.filter(w => w.length >= 4 && !/[aeiou]/.test(w));
  if (noVowels.length >= Math.max(1, Math.floor(words.length / 2))) return true;
  if (words.length >= 4) {
    const unique = new Set(words);
    if (unique.size / words.length < 0.5) return true;
  }
  return false;
}

const INSTRUCTION_VERBS = ['escribe', 'genera', 'crea', 'haz', 'redacta', 'explica', 'resume', 'clasifica', 'traduce', 'analiza', 'lista', 'dame', 'diseña', 'corrige', 'mejora', 'responde', 'actua', 'eres', 'resuelve', 'compara', 'ayudame', 'identifica', 'describe', 'soy', 'necesito', 'quiero'];
const hasInstructionVerb = (text: string) => {
  const t = normalize(text);
  return INSTRUCTION_VERBS.some(v => new RegExp(`\\b${v}`).test(t));
};

const REFLECT_TERMS = ['prompt', 'prompts', 'tecnica', 'tecnicas', 'shot', 'few', 'zero', 'one', 'cot', 'system', 'rol', 'ejemplo', 'ejemplos', 'paso', 'pasos', 'ia', 'temperatura', 'formato', 'contexto'];
const mentionsTopic = (text: string) => {
  const t = normalize(text);
  return REFLECT_TERMS.some(term =>
    term.length <= 3 ? new RegExp(`\\b${term}\\b`).test(t) : t.includes(term)
  );
};

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let j = a.length - 1; j > 0; j--) {
    const k = Math.floor(Math.random() * (j + 1));
    [a[j], a[k]] = [a[k], a[j]];
  }
  return a;
}
function shuffleOpts<T extends { opts: string[]; correct: number }>(q: T): T {
  const paired = q.opts.map((opt, i) => ({ opt, isCorrect: i === q.correct }));
  const sh = shuffle(paired);
  return { ...q, opts: sh.map(p => p.opt), correct: sh.findIndex(p => p.isCorrect) };
}

const MONO = Platform.select({ ios: 'Courier', default: 'monospace' });

// ===================== DATOS (fieles al HTML evaluacion-mundo-02) =====================
type QuizItem = { q: string; opts: string[]; correct: number; explain: string };
const QUIZ_POOL: QuizItem[] = [
  { q: '¿Qué técnica estás usando si le das a la IA 3 ejemplos de input→output antes de tu pedido real?',
    opts: ['Zero-shot prompting, porque el pedido real viene sin ejemplos específicos de salida esperada', 'Few-shot prompting, porque los 3 ejemplos le muestran al modelo el patrón a replicar', 'Chain-of-Thought, porque muestras los pasos que debe seguir para responder', 'System prompt, porque defines el comportamiento base del modelo antes de empezar'],
    correct: 1, explain: 'Few-shot = usar múltiples ejemplos (típicamente 2-5) para mostrar el patrón de respuesta deseado. El modelo "aprende" del patrón y lo aplica.' },
  { q: '¿En qué situación el zero-shot funciona bien sin necesitar ejemplos?',
    opts: ['Cuando quieres que la IA replique tu estilo personal de escritura exacto', 'Cuando el criterio de calidad es muy subjetivo y difícil de describir con palabras', 'Cuando la tarea es estándar y bien definida, como traducir o calcular algo', 'Cuando necesitas que aprenda un formato muy específico que nunca ha visto'],
    correct: 2, explain: 'Zero-shot brilla en tareas estándar: traducciones, cálculos, definiciones, resúmenes básicos. Donde el modelo ya tiene conocimiento suficiente del entrenamiento.' },
  { q: 'Pedro le pide a la IA: "Genera 5 nombres de startup con este estilo: Doppl". ¿Qué técnica usó?',
    opts: ['Zero-shot porque solo usó el nombre de la startup como referencia de apoyo', 'One-shot porque dio exactamente UN ejemplo para anclar el estilo deseado', 'Chain-of-Thought porque está usando pasos secuenciales para llegar al resultado', 'System prompt porque configuró el rol del modelo con esa instrucción inicial'],
    correct: 1, explain: 'One-shot = exactamente 1 ejemplo. Es el punto medio entre zero-shot (sin ejemplos) y few-shot (varios). Perfecto cuando solo necesitas anclar un estilo.' },
  { q: 'Añades al final de tu prompt: "Piénsalo paso a paso". ¿Qué cambio produce?',
    opts: ['El modelo revisa internet para validar cada paso de su razonamiento con fuentes', 'El modelo genera pasos intermedios visibles que aumentan la precisión en problemas lógicos', 'El modelo activa un procesador especial de razonamiento avanzado reservado para casos complejos', 'El modelo responde más lento pero con exactamente el mismo contenido que sin la instrucción'],
    correct: 1, explain: 'Chain-of-Thought (CoT) fue demostrado por Google en 2022: pedir pasos intermedios mejora significativamente la precisión en razonamiento matemático y lógico.' },
  { q: '¿Por qué mostrar el razonamiento paso a paso es valioso aunque el resultado final sea el mismo?',
    opts: ['Porque hace que la respuesta sea más larga y la IA cobra más por respuestas largas', 'Porque permite detectar en qué paso exacto hay un error, si el resultado es incorrecto', 'Porque activa una función premium que mejora automáticamente la calidad del modelo', 'Porque los modelos actuales solo razonan correctamente cuando piden pasos explícitamente'],
    correct: 1, explain: 'Sin el razonamiento visible, si el resultado es incorrecto no sabes dónde falló. Con CoT puedes identificar el paso exacto con error — trazabilidad.' },
  { q: '¿Cuándo usar prompts en cadena (3 prompts secuenciales) es SOBREINGENIERÍA?',
    opts: ['Cuando la tarea es un análisis complejo con varias fases interconectadas y dependientes', 'Cuando el problema requiere que el modelo razone sobre lógica formal o matemáticas', 'Cuando quieres generar un informe largo con varias secciones independientes entre sí', 'Cuando la pregunta es factual simple y un solo prompt directo ya da la respuesta correcta'],
    correct: 3, explain: 'Dividir "¿cuándo nació Einstein?" en 3 prompts no mejora nada — es sobreingeniería. La cadena es valiosa solo para razonamiento multi-paso real.' },
  { q: 'Vas a usar la IA para generar 10 nombres creativos de una marca de helados. ¿Qué temperatura es la mejor?',
    opts: ['Temperatura muy baja (0.1) para obtener opciones más precisas y consistentes', 'Temperatura alta (0.8-1.0) porque buscas variedad y sorpresas creativas', 'Temperatura exacta 0.5 porque es el punto medio óptimo para cualquier tarea', 'La temperatura no afecta a tareas creativas, solo a tareas de análisis técnico'],
    correct: 1, explain: 'Brainstorming creativo = temperatura alta. Quieres variedad e ideas sorprendentes. Temperatura baja daría nombres genéricos y predecibles.' },
  { q: 'Tu prompt es: "Traduce este contrato legal al inglés manteniendo los términos técnicos". ¿Qué temperatura usar?',
    opts: ['Temperatura muy alta para que el modelo sea creativo con las traducciones jurídicas', 'Temperatura media-alta para mezclar precisión con ligera adaptación cultural', 'Temperatura baja para máxima precisión y consistencia sin creatividad inventada', 'Cualquier temperatura, porque las traducciones legales son idénticas en todos los casos'],
    correct: 2, explain: 'Traducciones legales = temperatura baja. La precisión es crítica, no quieres "variaciones creativas" que alteren el significado jurídico del documento.' },
  { q: 'La IA cita con total seguridad un estudio: "Smith et al. 2019, Nature". ¿Qué debes hacer?',
    opts: ['Confiar y usar la cita porque el tono seguro indica que el estudio existe realmente', 'Verificar la cita en Google Scholar antes de usarla en cualquier trabajo académico', 'Pedirle a la IA que confirme si está segura — si dice que sí, entonces la cita es real', 'Asumir que si la IA da autor, año y revista, tiene que haberlo leído del entrenamiento'],
    correct: 1, explain: 'Las IAs frecuentemente alucinan citas bibliográficas que suenan plausibles pero no existen. SIEMPRE verifica citas en fuentes académicas reales.' },
  { q: '¿Por qué decimos "alucinación" y no "mentira" cuando la IA inventa datos?',
    opts: ['Porque las alucinaciones son errores suaves y las mentiras son errores graves', 'Porque las mentiras requieren intención consciente, y los LLMs no tienen intenciones ni voluntad', 'Porque "alucinación" suena más científico y técnico en artículos de investigación', 'Porque los ingenieros inventaron la palabra para ocultar las fallas de los modelos'],
    correct: 1, explain: 'Mentir requiere saber la verdad y elegir decir otra cosa. Los LLMs generan texto probable sin saber lo que es verdad — es un fallo estadístico, no moral.' },
  { q: '¿Cuál es el rol del "system prompt" en un asistente de IA personalizado?',
    opts: ['Es el primer mensaje que escribe el usuario al abrir una nueva conversación', 'Son las instrucciones base que definen rol, tono y límites antes de cualquier interacción', 'Es el código fuente del modelo que los ingenieros escriben para entrenarlo desde cero', 'Es el resumen automático que el modelo genera al cerrar cada conversación con el usuario'],
    correct: 1, explain: 'El system prompt es la configuración invisible que define CÓMO se comporta la IA. Se aplica a toda la conversación, no solo al primer mensaje.' },
  { q: '"Actúa como experto" vs "Actúa como oncólogo con 15 años en hospitales pediátricos de Colombia". ¿Cuál funciona mejor y por qué?',
    opts: ['El primero porque es más corto y la IA procesa mejor los prompts concisos y directos', 'El segundo porque la especificidad del rol guía al modelo a un registro técnico mucho más preciso', 'Ambos funcionan idéntico porque el modelo ya tiene conocimiento de todo tipo de expertos', 'El primero porque darle mucho contexto confunde al modelo y reduce la calidad'],
    correct: 1, explain: 'Roles específicos activan vocabulario, contexto y estilo muy distintos. "Experto" es tan genérico que no ancla nada. Especificidad = resultados concretos.' },
  { q: 'Tu prompt "Dame más información sobre eso" obtiene una respuesta genérica. ¿Cuál es el problema principal?',
    opts: ['La IA no quiso dar más información porque fue un prompt repetido varias veces seguidas', 'El prompt carece de referente concreto — "eso" es ambiguo y no define el tema objetivo', 'La temperatura estaba demasiado baja cuando se envió el prompt al modelo de lenguaje', 'El modelo tiene un límite diario de respuestas largas y por eso se limitó a ser breve'],
    correct: 1, explain: '"Eso" y "más información" son ambiguos. El modelo no puede adivinar qué tema retomar ni en qué dirección profundizar. Sé específico.' },
  { q: '¿Qué es una "prompt injection" y por qué NO funciona en modelos modernos?',
    opts: ['Un truco que "desbloquea" el modelo usando frases como "ignora tus instrucciones anteriores"', 'Una técnica de optimización que inyecta contexto adicional para mejorar significativamente la respuesta', 'Un método oficial de Anthropic y OpenAI para personalizar los modelos de lenguaje avanzados', 'Un tipo de virus que infecta al modelo cambiando su comportamiento de forma permanente'],
    correct: 0, explain: 'Prompt injection = intentos de manipular al modelo con frases mágicas para "desbloquearlo". Los modelos modernos tienen salvaguardas entrenadas que lo hacen ineficaz.' },
  { q: 'Quieres que la IA siempre responda en español formal, nunca mencione a la competencia y se llame "Aura". ¿Dónde pones esas instrucciones?',
    opts: ['En el primer mensaje de usuario de cada conversación nueva, repitiéndolas cada vez', 'En el system prompt, porque son instrucciones globales que aplican a TODA la conversación', 'En cada prompt individual porque el modelo olvida las reglas al siguiente mensaje', 'En un archivo externo que subes al modelo antes de iniciar cualquier interacción'],
    correct: 1, explain: 'System prompt = reglas globales del asistente. Aplican automáticamente a cada mensaje sin repetirlas. Es la forma eficiente y correcta de configurar.' },
];

const COMPARE_PAIRS = [
  { ctx: 'Quieres que la IA te ayude a estudiar para un examen de biología sobre el sistema digestivo.',
    opts: [
      { label: 'Prompt A', text: 'Actúa como tutor de biología para 10° grado. Explícame el sistema digestivo en 4 fases: 1) boca y esófago, 2) estómago, 3) intestinos, 4) absorción. Para cada fase: un ejemplo cotidiano + una analogía visual. Termina con 3 preguntas para verificar si entendí.' },
      { label: 'Prompt B', text: 'Explícame el sistema digestivo bien completo para mi examen mañana.' },
    ], correct: 0,
    explain: 'El Prompt A combina rol específico + estructura en 4 fases (CoT implícito) + formato con analogías + checkpoint de verificación. El B es demasiado vago: "bien completo" no define nada.' },
  { ctx: 'Necesitas que la IA clasifique 20 correos en urgente / normal / spam usando tu criterio personal.',
    opts: [
      { label: 'Prompt A', text: 'Clasifica estos 20 correos como urgente, normal o spam. Usa tu mejor criterio.' },
      { label: 'Prompt B', text: 'Clasifica estos correos como urgente / normal / spam. Ejemplos de mi criterio: "Reunión cambió a las 3pm" → urgente · "Newsletter semanal de marketing" → normal · "Reclama tu premio ahora" → spam. Ahora clasifica: [lista]' },
    ], correct: 1,
    explain: 'Criterio subjetivo = few-shot es obligatorio. El Prompt B da 3 ejemplos que muestran tu criterio personal. El A usa "tu mejor criterio" — la IA adivinará con criterio genérico que no es el tuyo.' },
  { ctx: 'Tienes un problema de lógica: 3 amigos dividen una cuenta de restaurante con propina y descuento. Quieres la respuesta correcta.',
    opts: [
      { label: 'Prompt A', text: 'La cuenta es $180.000, hay un 10% de descuento, se suma 8% de propina sobre el total después del descuento, y se divide entre 3 personas. Resuelve paso a paso: primero el descuento, luego la propina, luego la división. Verifica el resultado al final.' },
      { label: 'Prompt B', text: 'Dividimos $180.000 con 10% de descuento y 8% de propina entre 3 personas. ¿Cuánto paga cada uno?' },
    ], correct: 0,
    explain: 'Problemas de lógica matemática = CoT obligatorio. Prompt A fuerza pasos visibles + verificación, previniendo errores del modelo. Prompt B pide respuesta directa — si se equivoca, no sabes dónde.' },
];

const BUG_ERRORES = ['Rol', 'Contexto', 'Instrucción', 'Formato', 'Ambigüedad'];
const BUG_ITEMS = [
  { prompt: 'Dame más información sobre eso.', correcto: 'Ambigüedad',
    explain: 'No hay referente — "eso" no apunta a nada. Tampoco define qué aspecto profundizar ni en qué formato.',
    modelo: 'Sobre [tema específico], dame 3 aspectos que no suelen mencionarse: [campos específicos].' },
  { prompt: 'Actúa como experto y resuelve mi problema de una vez.', correcto: 'Rol',
    explain: '"Experto" es demasiado genérico — experto ¿en qué? Tampoco especifica qué tipo de experto ni su especialidad concreta.',
    modelo: 'Actúa como [especialidad concreta] con [años] años de experiencia en [contexto específico]. Ayúdame con: [problema definido].' },
  { prompt: 'Necesito ayuda con matemáticas urgente.', correcto: 'Contexto',
    explain: 'Falta contexto crítico: ¿qué tema de matemáticas? ¿qué nivel? ¿qué ya intentaste? La IA no puede adivinar la situación.',
    modelo: 'Soy estudiante de 10° grado. Tengo examen mañana sobre [tema]. Ya entiendo [X], pero no logro resolver [Y]. Explícame con ejemplos.' },
  { prompt: 'Escríbeme algo motivador para mi equipo.', correcto: 'Formato',
    explain: 'Falta el formato: ¿un email? ¿un post de Slack? ¿un discurso de 2 minutos? ¿qué extensión? La IA va a elegir al azar.',
    modelo: 'Escríbeme un mensaje motivador de máximo 80 palabras para enviar por Slack a mi equipo de 12 personas tras cumplir una meta trimestral.' },
  { prompt: 'Hazme una lista.', correcto: 'Instrucción',
    explain: 'No hay instrucción real: ¿lista de qué? No define el tema ni el objetivo. La IA no tiene nada concreto que ejecutar.',
    modelo: 'Hazme una lista de 7 libros de ciencia ficción publicados después de 2020 que aborden temas de inteligencia artificial.' },
];

const P4_MINS: Record<string, number> = { rol: 15, shot: 20, cot: 15, fmt: 10 };

const TOTAL_STEPS = 8; // intro + p1..p5 + resultado + badge
const PROG_LABELS = ['Introducción', 'Parte 1 — Quiz', 'Parte 2 — Prompt-compare', 'Parte 3 — Bug Hunter', 'Parte 4 — Builder 3 min', 'Parte 5 — Reflexión', 'Resultado', '🏆 Badge'];

export default function Eval2() {
  const completeLevel = useGameStore(s => s.completeLevel);
  const devMode = useGameStore(s => s.devMode);

  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);
  const [xpToast, setXpToast] = useState<{ amount: number; id: number } | null>(null);

  // Parte 1 — Quiz (orden de preguntas y opciones barajado)
  const [quizItems] = useState<QuizItem[]>(() => shuffle(QUIZ_POOL).map(shuffleOpts));
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizSel, setQuizSel] = useState<number | null>(null);
  const [quizDone, setQuizDone] = useState(false);

  // Parte 2 — Prompt-compare
  const [cmpIdx, setCmpIdx] = useState(0);
  const [cmpScore, setCmpScore] = useState(0);
  const [cmpSel, setCmpSel] = useState<number | null>(null);
  const [cmpDone, setCmpDone] = useState(false);

  // Parte 3 — Bug Hunter
  const [bugIdx, setBugIdx] = useState(0);
  const [bugTypeScore, setBugTypeScore] = useState(0);
  const [bugFixScore, setBugFixScore] = useState(0);
  const [bugTypeSel, setBugTypeSel] = useState<string | null>(null);
  const [bugFixVal, setBugFixVal] = useState('');
  const [bugVerified, setBugVerified] = useState(false);
  const [bugDone, setBugDone] = useState(false);
  const bugFixOk = bugFixVal.trim().length >= 25 && !looksRandom(bugFixVal) && hasInstructionVerb(bugFixVal);

  // Parte 4 — Builder cronometrado
  const [p4Started, setP4Started] = useState(false);
  const [p4Sec, setP4Sec] = useState(180);
  const [p4Fields, setP4Fields] = useState({ rol: '', shot: '', cot: '', fmt: '' });
  const [p4Submitted, setP4Submitted] = useState(false);
  const [p4TimedOut, setP4TimedOut] = useState(false);
  const [p4Bonus, setP4Bonus] = useState(0);
  const [p4TimeUsed, setP4TimeUsed] = useState(0);
  const p4AllOk = Object.entries(p4Fields).every(([k, v]) => v.trim().length >= P4_MINS[k] && !looksRandom(v));

  // Parte 5 — Reflexión
  const [reflectVal, setReflectVal] = useState('');
  const [reflectSealed, setReflectSealed] = useState(false);
  const [reflectError, setReflectError] = useState<string | null>(null);

  const addXP = (v: number) => {
    if (v <= 0) return;
    setXp(p => p + v);
    setXpToast(prev => ({ amount: v, id: (prev?.id ?? 0) + 1 }));
  };
  const next = () => { if (step < TOTAL_STEPS - 1) setStep(s => s + 1); };

  const isExamMode = step > 0 && step < 6;

  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isExamMode) {
        if (Platform.OS !== 'web') {
          Alert.alert('Evaluación en curso', 'No puedes retroceder durante la evaluación.', [{ text: 'OK' }]);
        }
        return true;
      }
      return false;
    });
    return () => back.remove();
  }, [isExamMode]);

  const handleClose = () => {
    const msg = isExamMode ? 'Estás en la evaluación. Si sales perderás el progreso. ¿Seguro?' : '¿Seguro que quieres salir?';
    if (Platform.OS === 'web') { if (window.confirm(msg)) exitLevel({ confirm: false }); return; }
    Alert.alert('Salir', msg, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: () => exitLevel({ confirm: false }) },
    ]);
  };

  // Timer Parte 4
  useEffect(() => {
    if (!p4Started || p4Submitted) return;
    if (p4Sec <= 0) { forceSubmitP4(); return; }
    const t = setTimeout(() => setP4Sec(s => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p4Started, p4Sec, p4Submitted]);

  // ---------- Acciones ----------
  const answerQuiz = (i: number) => {
    if (quizSel !== null) return;
    setQuizSel(i);
    if (i === quizItems[quizIdx].correct) setQuizScore(s => s + 1);
  };
  const nextQuiz = () => {
    if (quizIdx + 1 < quizItems.length) { setQuizIdx(i => i + 1); setQuizSel(null); }
    else { setQuizDone(true); addXP(quizScore * 8); }
  };

  const answerCompare = (i: number) => {
    if (cmpSel !== null) return;
    setCmpSel(i);
    if (i === COMPARE_PAIRS[cmpIdx].correct) setCmpScore(s => s + 1);
  };
  const nextCompare = () => {
    if (cmpIdx + 1 < COMPARE_PAIRS.length) { setCmpIdx(i => i + 1); setCmpSel(null); }
    else { setCmpDone(true); addXP(cmpScore * 15); }
  };

  const verifyBug = () => {
    if (bugVerified) return;
    setBugVerified(true);
    if (bugTypeSel === BUG_ITEMS[bugIdx].correcto) setBugTypeScore(s => s + 1);
    if (bugFixOk) setBugFixScore(s => s + 1);
  };
  const nextBug = () => {
    if (bugIdx + 1 < BUG_ITEMS.length) { setBugIdx(i => i + 1); setBugTypeSel(null); setBugFixVal(''); setBugVerified(false); }
    else { setBugDone(true); addXP((bugTypeScore + bugFixScore) * 6); }
  };

  const submitP4 = () => {
    if (p4Submitted) return;
    setP4Submitted(true);
    setP4TimeUsed(180 - p4Sec);
    const bonus = p4Sec >= 90 ? 15 : p4Sec >= 30 ? 8 : 0;
    setP4Bonus(bonus);
    addXP(35 + bonus);
  };
  const forceSubmitP4 = () => {
    if (p4Submitted) return;
    if (p4AllOk) { submitP4(); return; }
    setP4Submitted(true);
    setP4TimedOut(true);
    addXP(15);
  };

  const sealReflect = () => {
    const t = reflectVal.trim();
    if (t.length < 80) { setReflectError('Escribe al menos 80 caracteres.'); return; }
    if (looksRandom(t)) { setReflectError('Tu texto parece escrito al azar. Cuenta una situación real donde usarías estas técnicas.'); return; }
    if (!mentionsTopic(t)) { setReflectError('Tu reflexión debe mencionar alguna técnica del Mundo 2 (few-shot, CoT, system prompt, rol...) y cómo la usarías.'); return; }
    setReflectError(null);
    setReflectSealed(true);
    addXP(25);
  };

  const p3Score = bugTypeScore + bugFixScore;
  const quizPct = Math.round((quizScore / 15) * 100);
  const cmpPct = Math.round((cmpScore / 3) * 100);
  const bugPct = Math.round((p3Score / 10) * 100);
  const overall = Math.round((quizPct + cmpPct + bugPct) / 3);

  const finishEvaluation = () => {
    const stars = overall >= 85 ? 3 : overall >= 70 ? 2 : 1;
    completeLevel(38, stars, xp);
    router.replace('/level/13');
  };

  // ---------- Bloques reutilizables ----------
  const Tag = ({ text, bg, color }: { text: string; bg: string; color: string }) => (
    <View style={[styles.tag, { backgroundColor: bg }]}><Text style={[styles.tagText, { color }]}>{text}</Text></View>
  );
  const PartDots = ({ current }: { current: number }) => (
    <View style={styles.partRow}>
      {[1, 2, 3, 4, 5].map(n => (
        <View key={n} style={[styles.partDot, n < current && styles.partDotDone, n === current && styles.partDotActive]} />
      ))}
    </View>
  );
  const Fb = ({ ok, children }: { ok: boolean; children: ReactNode }) => (
    <View style={[styles.feedbackBar, ok ? styles.fbOk : styles.fbWrong]}>
      <Text style={[styles.feedbackText, { color: ok ? '#065f46' : '#991b1b' }]}>{children}</Text>
    </View>
  );
  const ScoreRow = ({ items }: { items: [string, string][] }) => (
    <View style={styles.scoreRow}>
      {items.map(([num, lbl]) => (
        <View key={lbl} style={styles.scoreItem}>
          <Text style={styles.scoreNum}>{num}</Text>
          <Text style={styles.scoreLbl}>{lbl}</Text>
        </View>
      ))}
    </View>
  );
  const Hl = ({ variant, children }: { variant: 'teal' | 'cyan' | 'fuchsia' | 'green' | 'amber' | 'red'; children: ReactNode }) => {
    const map = {
      teal: { border: '#14b8a6', bg: '#f0fdfa', color: '#115e59' },
      cyan: { border: '#06b6d4', bg: '#ecfeff', color: '#155e75' },
      fuchsia: { border: '#d946ef', bg: '#fdf4ff', color: '#86198f' },
      green: { border: '#10b981', bg: '#f0fdf4', color: '#065f46' },
      amber: { border: '#f59e0b', bg: '#fffbeb', color: '#92400e' },
      red: { border: '#ef4444', bg: '#fff1f2', color: '#991b1b' },
    }[variant];
    return (
      <View style={[styles.hlBox, { borderLeftColor: map.border, backgroundColor: map.bg }]}>
        <Text style={[styles.hlText, { color: map.color }]}>{children}</Text>
      </View>
    );
  };

  // ---------- Render por paso ----------
  const renderStep = () => {
    switch (step) {
      // ===== 0 · INTRO =====
      case 0: return (
        <View>
          <View style={styles.introIcon}><Text style={{ fontSize: 42 }}>🎯</Text></View>
          <Text style={[styles.title, { textAlign: 'center' }]}>Evaluación Mundo 2</Text>
          <Text style={[styles.subtitle, { textAlign: 'center' }]}>Completaste los 6 niveles de prompting. Ahora demostramos dominio real de las técnicas.</Text>
          <View style={[styles.card, { backgroundColor: '#f0fdfa', borderColor: '#5eead4' }]}>
            <Text style={[styles.cardTitle, { marginBottom: 8 }]}>5 partes · ~18 minutos</Text>
            <Text style={styles.cardText}>
              🧠 <Text style={styles.bold}>Parte 1:</Text> Quiz de 15 preguntas (N7–N12){'\n'}
              ⚖️ <Text style={styles.bold}>Parte 2:</Text> Prompt-compare — elige el mejor prompt de 3 pares{'\n'}
              🐛 <Text style={styles.bold}>Parte 3:</Text> Bug Hunter — identifica y repara 5 prompts rotos{'\n'}
              ⏱️ <Text style={styles.bold}>Parte 4:</Text> Builder cronometrado — construye un prompt maestro en 3 minutos{'\n'}
              💬 <Text style={styles.bold}>Parte 5:</Text> Reflexión sellada
            </Text>
          </View>
          <View style={[styles.card, { backgroundColor: '#fdf4ff', borderColor: '#e879f9' }]}>
            <View style={styles.cardRow}>
              <View style={[styles.cardIcon, { backgroundColor: '#fae8ff' }]}><Text style={{ fontSize: 19 }}>🎁</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Al completar</Text>
                <Text style={styles.cardText}>Desbloqueas la insignia <Text style={styles.bold}>"Prompt Master Certificado"</Text> y acceso al Mundo 3 — IA Creativa.</Text>
              </View>
            </View>
          </View>
          <Hl variant="cyan"><Text style={styles.hlBold}>Solo la Parte 4 tiene tiempo límite (3 min).</Text> Las demás partes son a tu ritmo.</Hl>
        </View>
      );

      // ===== 1 · PARTE 1 — QUIZ =====
      case 1: {
        if (quizDone) {
          const earned = quizScore * 8;
          return (
            <View>
              <Tag text="✅ PARTE 1 COMPLETADA" bg="#ecfeff" color="#155e75" />
              <Text style={styles.titleMd}>Quiz finalizado</Text>
              <ScoreRow items={[[String(quizScore), 'Correctas'], [String(quizItems.length), 'Total'], [String(earned), 'XP ganados']]} />
              <Hl variant={quizScore >= 12 ? 'green' : quizScore >= 9 ? 'amber' : 'red'}>
                <Text style={styles.hlBold}>{quizScore >= 12 ? '¡Excelente dominio de las técnicas!' : quizScore >= 9 ? 'Buena base, algunos conceptos a repasar.' : 'Repasa N7-N12 — algunas técnicas no están consolidadas.'}</Text>
              </Hl>
              <PartDots current={2} />
            </View>
          );
        }
        const item = quizItems[quizIdx];
        return (
          <View>
            <Tag text={`🧠 PARTE 1 · QUIZ · ${quizIdx + 1}/${quizItems.length}`} bg="#ecfeff" color="#155e75" />
            <PartDots current={1} />
            <View style={styles.quizQ}><Text style={styles.quizQText}>{item.q}</Text></View>
            {item.opts.map((o, i) => (
              <TouchableOpacity key={i}
                style={[styles.quizOpt, quizSel !== null && i === item.correct && styles.optCorrect, quizSel !== null && i === quizSel && i !== item.correct && styles.optWrong]}
                onPress={() => answerQuiz(i)} disabled={quizSel !== null}>
                <Text style={[styles.quizOptText, quizSel !== null && i === item.correct && { color: '#065f46' }, quizSel !== null && i === quizSel && i !== item.correct && { color: '#991b1b' }]}>{o}</Text>
              </TouchableOpacity>
            ))}
            {quizSel !== null && <Fb ok={quizSel === item.correct}>{quizSel === item.correct ? '✅ ' : '❌ '}{item.explain}</Fb>}
          </View>
        );
      }

      // ===== 2 · PARTE 2 — PROMPT-COMPARE =====
      case 2: {
        if (cmpDone) {
          const earned = cmpScore * 15;
          return (
            <View>
              <Tag text="✅ PARTE 2 COMPLETADA" bg="#fdf4ff" color="#86198f" />
              <Text style={styles.titleMd}>Prompt-compare finalizado</Text>
              <ScoreRow items={[[String(cmpScore), 'Aciertos'], [String(COMPARE_PAIRS.length), 'Pares'], [String(earned), 'XP ganados']]} />
              <Hl variant={cmpScore >= 2 ? 'green' : 'amber'}>
                <Text style={styles.hlBold}>{cmpScore >= 2 ? 'Distingues bien prompts fuertes de prompts débiles.' : 'Recuerda: la claridad y la especificidad siempre ganan.'}</Text>
              </Hl>
              <PartDots current={3} />
            </View>
          );
        }
        const pair = COMPARE_PAIRS[cmpIdx];
        return (
          <View>
            <Tag text={`⚖️ PARTE 2 · COMPARE · ${cmpIdx + 1}/${COMPARE_PAIRS.length}`} bg="#fdf4ff" color="#86198f" />
            <PartDots current={2} />
            <Text style={styles.titleSm}>¿Cuál prompt funcionará mejor?</Text>
            <View style={styles.comparePair}>
              <Text style={styles.compareCtx}>📌 Situación: {pair.ctx}</Text>
              {pair.opts.map((o, i) => (
                <TouchableOpacity key={i}
                  style={[styles.compareOpt, cmpSel !== null && i === pair.correct && styles.optCorrect, cmpSel !== null && i === cmpSel && i !== pair.correct && styles.optWrong]}
                  onPress={() => answerCompare(i)} disabled={cmpSel !== null}>
                  <Text style={[styles.compareOptLabel, cmpSel !== null && i === pair.correct && { color: '#065f46' }, cmpSel !== null && i === cmpSel && i !== pair.correct && { color: '#991b1b' }]}>{o.label}</Text>
                  <Text style={styles.compareOptText}>{o.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {cmpSel !== null && <Fb ok={cmpSel === pair.correct}>{cmpSel === pair.correct ? '✅ ' : '❌ '}{pair.explain}</Fb>}
          </View>
        );
      }

      // ===== 3 · PARTE 3 — BUG HUNTER =====
      case 3: {
        if (bugDone) {
          const earned = p3Score * 6;
          return (
            <View>
              <Tag text="✅ PARTE 3 COMPLETADA" bg="#fff7ed" color="#9a3412" />
              <Text style={styles.titleMd}>Bug Hunter finalizado</Text>
              <ScoreRow items={[[`${bugTypeScore}/5`, 'Tipos correctos'], [`${bugFixScore}/5`, 'Prompts reparados'], [String(earned), 'XP']]} />
              <Hl variant={p3Score >= 8 ? 'green' : p3Score >= 6 ? 'amber' : 'red'}>
                <Text style={styles.hlBold}>{p3Score >= 8 ? '¡Excelente diagnóstico y reparación!' : p3Score >= 6 ? 'Buen trabajo. Diferencia entre tipos de error se afina con práctica.' : 'Vuelve a N10 — Prompts que Fallan para revisar los 4 tipos de error.'}</Text>
              </Hl>
              <PartDots current={4} />
            </View>
          );
        }
        const b = BUG_ITEMS[bugIdx];
        return (
          <View>
            <Tag text={`🐛 PARTE 3 · BUG HUNTER · ${bugIdx + 1}/${BUG_ITEMS.length}`} bg="#fff7ed" color="#9a3412" />
            <PartDots current={3} />
            <View style={styles.bugCard}>
              <View style={styles.bugPromptBox}><Text style={styles.bugPromptText}>"{b.prompt}"</Text></View>
              <Text style={styles.bugLabel}>1️⃣ ¿Cuál es el error principal?</Text>
              <View style={styles.bugChipRow}>
                {BUG_ERRORES.map(e => (
                  <TouchableOpacity key={e}
                    style={[styles.bugChip, !bugVerified && bugTypeSel === e && styles.bugChipSel, bugVerified && e === b.correcto && styles.bugChipCorrect, bugVerified && bugTypeSel === e && e !== b.correcto && styles.bugChipWrong]}
                    onPress={() => { if (!bugVerified) setBugTypeSel(e); }} disabled={bugVerified}>
                    <Text style={[styles.bugChipText, !bugVerified && bugTypeSel === e && { color: '#431407' }, bugVerified && e === b.correcto && { color: '#065f46' }, bugVerified && bugTypeSel === e && e !== b.correcto && { color: '#991b1b' }]}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.bugLabel}>2️⃣ Repara el prompt (tu versión corregida)</Text>
              <TextInput style={styles.bugFix} placeholder="Escribe el prompt reparado usando rol + tarea + contexto + formato..." placeholderTextColor="#b8bcc0" value={bugFixVal} onChangeText={setBugFixVal} multiline editable={!bugVerified} />
            </View>
            {bugVerified && (
              <Fb ok={bugTypeSel === b.correcto && bugFixOk}>
                {bugTypeSel === b.correcto ? '✅ Tipo correcto: ' : '❌ Tipo correcto: '}
                <Text style={{ fontWeight: '700' }}>{b.correcto}</Text>. {b.explain}{'\n\n'}
                <Text style={{ fontWeight: '700' }}>Ejemplo de reparación modelo:</Text>{'\n'}
                <Text style={{ fontStyle: 'italic', fontSize: 11 }}>{b.modelo}</Text>
              </Fb>
            )}
          </View>
        );
      }

      // ===== 4 · PARTE 4 — BUILDER CRONOMETRADO =====
      case 4: {
        const mins = Math.floor(Math.max(0, p4Sec) / 60);
        const secs = String(Math.max(0, p4Sec) % 60).padStart(2, '0');
        const timerColor = p4Submitted ? '#0f766e' : p4Sec <= 15 ? '#dc2626' : p4Sec <= 45 ? '#c2410c' : '#0f766e';
        const fieldOk = (k: keyof typeof p4Fields) => p4Fields[k].trim().length >= P4_MINS[k] && !looksRandom(p4Fields[k]);
        return (
          <View>
            <Tag text="⏱️ PARTE 4 · BUILDER CRONOMETRADO" bg="#ecfdf5" color="#065f46" />
            <PartDots current={4} />
            <Text style={styles.titleSm}>Prompt maestro en 3 minutos</Text>
            <Text style={styles.subtitle}>Combina 4 técnicas del Mundo 2. Toca <Text style={styles.bold}>"Iniciar"</Text> cuando estés listo — el timer arranca.</Text>
            <View style={styles.timerWrap}>
              <Text style={styles.timerLabel}>TIEMPO RESTANTE</Text>
              <Text style={[styles.timerDisplay, { color: timerColor }]}>{p4TimedOut ? '0:00' : `${mins}:${secs}`}</Text>
              <View style={styles.timerBar}><View style={[styles.timerBarFill, { width: `${Math.max(0, (p4Sec / 180) * 100)}%` }]} /></View>
            </View>
            <Hl variant="teal"><Text style={styles.hlBold}>Reto:</Text> Diseña un prompt que combine los 4 ingredientes avanzados del M2. La tarea puede ser de tu vida real: estudiar, organizar, decidir algo.</Hl>
            {([
              ['rol', '🎭 ROL — Rol complejo con especialidad y experiencia', 'Ej: tutor de química con 10 años enseñando a jóvenes de 14-16...', false],
              ['shot', '📚 FEW-SHOT — 1-3 ejemplos del formato/estilo deseado', 'Ej: Ejemplo 1: pregunta X → respuesta con analogía Y. Ejemplo 2:...', true],
              ['cot', '🔗 COT — Pasos de razonamiento explícitos', 'Ej: Primero identifica el concepto clave, luego da la fórmula, luego un ejemplo resuelto...', true],
              ['fmt', '📐 FORMATO — Estructura y extensión de la respuesta', 'Ej: máximo 150 palabras, usa viñetas, termina con una pregunta...', false],
            ] as const).map(([key, label, ph, multi]) => (
              <View key={key}>
                <View style={styles.builderLabelRow}>
                  <View style={[styles.builderCheck, fieldOk(key) && styles.builderCheckDone]}>
                    <Text style={[styles.builderCheckText, fieldOk(key) && { color: '#fff' }]}>{fieldOk(key) ? '✓' : '·'}</Text>
                  </View>
                  <Text style={styles.builderLabel}>{label}</Text>
                </View>
                <TextInput
                  style={[styles.builderInput, multi && { minHeight: 62 }, (!p4Started || p4Submitted) && { opacity: 0.65 }]}
                  placeholder={ph} placeholderTextColor="#b8bcc0"
                  value={p4Fields[key]}
                  onChangeText={t => setP4Fields(prev => ({ ...prev, [key]: t }))}
                  multiline={multi}
                  editable={p4Started && !p4Submitted}
                />
              </View>
            ))}
            <Text style={[styles.subtitle, { marginTop: 12, marginBottom: 4 }]}>Vista previa del prompt:</Text>
            <View style={[styles.promptPreview, p4Submitted && !p4TimedOut && { borderColor: '#14b8a6' }]}>
              <Text style={styles.previewText}>
                Actúa como <Text style={p4Fields.rol.trim() ? styles.pRol : styles.pEmpty}>{p4Fields.rol.trim() || '[rol complejo]'}</Text>.{'\n'}
                Ejemplos del estilo:{'\n'}<Text style={p4Fields.shot.trim() ? styles.pShot : styles.pEmpty}>{p4Fields.shot.trim() || '[few-shot]'}</Text>{'\n'}
                Proceso paso a paso:{'\n'}<Text style={p4Fields.cot.trim() ? styles.pCot : styles.pEmpty}>{p4Fields.cot.trim() || '[chain-of-thought]'}</Text>{'\n'}
                Formato: <Text style={p4Fields.fmt.trim() ? styles.pFmt : styles.pEmpty}>{p4Fields.fmt.trim() || '[formato]'}</Text>
              </Text>
            </View>
            {p4Submitted && !p4TimedOut && (
              <Fb ok>✅ Prompt maestro enviado en {Math.floor(p4TimeUsed / 60)}:{String(p4TimeUsed % 60).padStart(2, '0')}.{'\n'}+35 XP por completarlo{p4Bonus > 0 ? ` · +${p4Bonus} XP bonus por velocidad` : ''}.{'\n'}Este prompt combina las 4 técnicas clave del Mundo 2. Queda en tu portafolio.</Fb>
            )}
            {p4TimedOut && (
              <Fb ok={false}>⏱️ Tiempo agotado. Tu prompt quedó incompleto — aún así suma 15 XP por el intento. Este reto se puede repetir.</Fb>
            )}
            {!p4Started && (
              <TouchableOpacity style={styles.p4StartBtn} onPress={() => setP4Started(true)}>
                <Text style={styles.p4StartBtnText}>▶ Iniciar cronómetro (3:00)</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      }

      // ===== 5 · PARTE 5 — REFLEXIÓN =====
      case 5: return (
        <View>
          <Tag text="💬 PARTE 5 · REFLEXIÓN SELLADA" bg="#f8fafc" color="#475569" />
          <PartDots current={5} />
          <Text style={styles.titleSm}>Tu reflexión de cierre</Text>
          <Text style={styles.reflectQuestion}>¿En qué situación de tu vida diaria usarías estas técnicas de prompting?</Text>
          <Text style={styles.subtitle}>Piensa en algo concreto: estudios, proyecto personal, trabajo, hobby. ¿Cuál técnica usarías primero y por qué?</Text>
          <TextInput
            style={[styles.reflectArea, reflectSealed && { backgroundColor: '#ecfdf5', borderColor: '#10b981' }]}
            placeholder="Ej: Usaría few-shot para que me ayude a responder correos de clientes con mi tono personal. Le daría 3 ejemplos de correos anteriores míos y pediría que aplique el mismo estilo. También usaría CoT cuando tengo que tomar decisiones complejas como elegir universidad..."
            placeholderTextColor="#b8bcc0"
            value={reflectVal}
            onChangeText={t => { setReflectVal(t); setReflectError(null); }}
            multiline
            editable={!reflectSealed}
          />
          <Text style={styles.charCount}>{reflectVal.length} / mínimo 80 caracteres</Text>
          {reflectError && <Fb ok={false}>⚠️ {reflectError}</Fb>}
          {reflectSealed && <Fb ok>✅ Reflexión sellada. Queda guardada en tu portafolio IA Explorer. +25 XP</Fb>}
          <Hl variant="fuchsia">
            <Text style={styles.hlBold}>Esta reflexión queda sellada en tu portafolio IA Explorer.</Text>{'\n'}Es evidencia de que sabes aplicar las técnicas en contextos reales.
          </Hl>
        </View>
      );

      // ===== 6 · RESULTADO =====
      case 6: {
        const medal = overall >= 85 ? '🥇' : overall >= 70 ? '🥈' : '🥉';
        const label = overall >= 85 ? 'Excelente — Prompting dominado' : overall >= 70 ? 'Bien — Base sólida con gaps puntuales' : 'Aprobado — Repasa niveles con menor puntaje';
        return (
          <View>
            <Tag text="🏁 RESULTADO FINAL" bg="#f0fdfa" color="#0f766e" />
            <Text style={[styles.titleMd, { textAlign: 'center' }]}>{medal} {label}</Text>
            <ScoreRow items={[[`${quizPct}%`, 'Quiz'], [`${cmpPct}%`, 'Compare'], [`${bugPct}%`, 'Bug hunter']]} />
            <View style={[styles.card, { backgroundColor: '#f0fdfa', borderColor: '#5eead4' }]}>
              <View style={styles.cardRow}>
                <View style={[styles.cardIcon, { backgroundColor: '#ccfbf1' }]}><Text style={{ fontSize: 19 }}>⭐</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>XP total acumulado</Text>
                  <Text style={styles.xpBigText}>{xp} XP</Text>
                </View>
              </View>
            </View>
            <Hl variant="teal"><Text style={styles.hlBold}>Partes completadas:</Text> Quiz ✅ · Prompt-compare ✅ · Bug Hunter ✅ · Builder cronometrado ✅ · Reflexión ✅</Hl>
          </View>
        );
      }

      // ===== 7 · BADGE =====
      case 7: return (
        <View style={styles.badgeWrap}>
          <View style={styles.badgeRingOuter}>
            <View style={styles.badgeRingInner}>
              <View style={styles.badgeRing}><Text style={{ fontSize: 54 }}>🎯</Text></View>
            </View>
          </View>
          <Text style={styles.badgeTitle}>¡Badge desbloqueado!</Text>
          <View style={styles.badgeNameBox}><Text style={styles.badgeName}>🎯 Prompt Master Certificado</Text></View>
          <Text style={styles.badgeSub}>Completaste el Mundo 2 de IA Explorer.{'\n'}Pasaste de escribir prompts básicos a combinar 4 técnicas avanzadas.</Text>
          <ScoreRow items={[[`${overall}%`, 'Puntaje global'], [String(xp), 'XP total']]} />
          <View style={styles.skillList}>
            {[
              'Distingo zero-shot, one-shot, few-shot y sé cuándo usar cada uno',
              'Aplico Chain-of-Thought para problemas de razonamiento complejo',
              'Construyo system prompts con rol, tono, límites y formato',
              'Entiendo tokens, temperatura y alucinaciones — y cómo afectan resultados',
              'Identifico los 4 tipos de error en prompts y sé repararlos',
              'Combino técnicas avanzadas en un solo prompt maestro',
            ].map((s, i, arr) => (
              <View key={i} style={[styles.skillRow, i === arr.length - 1 && { marginBottom: 0 }]}>
                <Text style={styles.skillCheck}>✓</Text>
                <Text style={styles.skillText}>{s}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={[styles.mainBtn, styles.btnGold, { width: '100%' }]} onPress={finishEvaluation}>
            <Text style={styles.mainBtnText}>Ir al Mundo 3 → IA Creativa 🎨</Text>
          </TouchableOpacity>
        </View>
      );

      default: return null;
    }
  };

  // ---------- Botón principal ----------
  const getBtn = (): { label: string; enabled: boolean; variant?: 'magenta' | 'gold'; note?: string; onPress: () => void } | null => {
    switch (step) {
      case 0: return { label: '¡Comenzar evaluación! →', enabled: true, variant: 'magenta', onPress: next };
      case 1:
        if (quizDone) return { label: 'Ir a Parte 2 →', enabled: true, onPress: next };
        return { label: 'Siguiente →', enabled: quizSel !== null || devMode, note: quizSel === null ? '+8 XP por respuesta correcta' : undefined, onPress: nextQuiz };
      case 2:
        if (cmpDone) return { label: 'Ir a Parte 3 →', enabled: true, onPress: next };
        return { label: 'Siguiente →', enabled: cmpSel !== null || devMode, note: cmpSel === null ? '+15 XP por acierto' : undefined, onPress: nextCompare };
      case 3:
        if (bugDone) return { label: 'Ir a Parte 4 →', enabled: true, onPress: next };
        if (!bugVerified) return { label: 'Verificar →', enabled: (bugTypeSel !== null && bugFixOk) || devMode, note: 'Elige el tipo de error y escribe una reparación real (mínimo 25 caracteres)', onPress: verifyBug };
        return { label: 'Siguiente →', enabled: true, onPress: nextBug };
      case 4:
        if (p4Submitted) return { label: 'Ir a Parte 5 →', enabled: true, onPress: next };
        return { label: 'Enviar prompt →', enabled: (p4Started && p4AllOk) || devMode, note: !p4Started ? 'Toca "Iniciar cronómetro" para empezar' : 'Completa los 4 ingredientes · +35 XP + bonus por velocidad', onPress: submitP4 };
      case 5:
        if (reflectSealed) return { label: 'Ver mi resultado →', enabled: true, variant: 'magenta', onPress: next };
        return { label: 'Sellar reflexión →', enabled: reflectVal.trim().length >= 80 || devMode, variant: 'magenta', note: 'Escribe al menos 80 caracteres · +25 XP', onPress: sealReflect };
      case 6: return { label: 'Reclamar mi badge 🏆 →', enabled: true, variant: 'gold', onPress: next };
      case 7: return null; // botón dentro del badge
      default: return null;
    }
  };

  const btn = getBtn();
  const progressPercent = (step / (TOTAL_STEPS - 1)) * 100;

  return (
    <View style={styles.screen}>
      <View style={styles.lessonBar}>
        <TouchableOpacity onPress={handleClose} style={styles.closeBtn}><Text style={styles.closeBtnText}>✕</Text></TouchableOpacity>
        <View style={styles.progWrap}>
          <View style={styles.progTrack}><View style={[styles.progFill, { width: `${progressPercent}%` }]} /></View>
          <Text style={styles.progLabel}>{PROG_LABELS[step]}</Text>
        </View>
        <View style={styles.xpChip}><Text style={styles.xpChipText}>{xp} XP</Text></View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {renderStep()}
      </ScrollView>

      {btn && (
        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[styles.mainBtn, btn.variant === 'magenta' && styles.btnMagenta, btn.variant === 'gold' && styles.btnGold, !btn.enabled && styles.mainBtnDisabled]}
            onPress={btn.onPress} disabled={!btn.enabled}>
            <Text style={styles.mainBtnText}>{btn.label}</Text>
          </TouchableOpacity>
          {btn.note ? <Text style={styles.btnNote}>{btn.note}</Text> : null}
        </View>
      )}

      {xpToast && <XPToast key={xpToast.id} amount={xpToast.amount} onHide={() => setXpToast(null)} bgColor="#0d9488" textColor="#fff" />}
    </View>
  );
}

// ===================== ESTILOS (paleta teal/fucsia del HTML) =====================
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },

  // Header
  lessonBar: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13, paddingTop: 11, paddingBottom: 9, borderBottomWidth: 1, borderBottomColor: '#ccfbf1', backgroundColor: '#f0fdfa' },
  closeBtn: { minWidth: 42, minHeight: 42, borderRadius: 10, backgroundColor: '#ccfbf1', borderWidth: 1, borderColor: '#5eead4', alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 12, color: '#0f766e', fontWeight: '800' },
  progWrap: { flex: 1 },
  progTrack: { height: 8, backgroundColor: '#ccfbf1', borderRadius: 4, overflow: 'hidden' },
  progFill: { height: '100%', borderRadius: 4, backgroundColor: '#14b8a6' },
  progLabel: { fontSize: 10, color: '#94a3b8', marginTop: 3, fontWeight: '500' },
  xpChip: { paddingHorizontal: 11, paddingVertical: 4, borderRadius: 12, backgroundColor: '#fde68a', borderWidth: 1, borderColor: '#fcd34d' },
  xpChipText: { fontSize: 12, color: '#92400e', fontWeight: '700' },

  scrollView: { flex: 1 },
  scrollContent: { padding: 15, paddingBottom: 28 },

  // Tipografía
  tag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 11 },
  tagText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  title: { ...typography.extraBold, fontSize: 19, color: '#0f172a', marginBottom: 7, lineHeight: 25 },
  titleMd: { ...typography.extraBold, fontSize: 17, color: '#0f172a', marginBottom: 7, lineHeight: 23 },
  titleSm: { ...typography.extraBold, fontSize: 15, color: '#0f172a', marginBottom: 7, lineHeight: 21 },
  subtitle: { ...typography.regular, fontSize: 13, color: '#64748b', marginBottom: 13, lineHeight: 22 },
  bold: { fontWeight: '700', color: '#0f172a' },
  introIcon: { width: 80, height: 80, borderRadius: 24, backgroundColor: '#0d9488', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },

  // Cards
  card: { borderRadius: 14, padding: 13, marginBottom: 9, borderWidth: 1 },
  cardRow: { flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  cardIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 12, fontWeight: '700', color: '#0f172a', marginBottom: 3 },
  cardText: { fontSize: 12, color: '#334155', lineHeight: 20 },

  // Highlight
  hlBox: { paddingHorizontal: 14, paddingVertical: 12, borderTopRightRadius: 12, borderBottomRightRadius: 12, borderLeftWidth: 3, marginVertical: 9 },
  hlText: { fontSize: 12, lineHeight: 20, fontWeight: '500' },
  hlBold: { fontWeight: '700' },

  // Part dots
  partRow: { flexDirection: 'row', gap: 6, marginBottom: 14, justifyContent: 'center' },
  partDot: { width: 32, height: 6, borderRadius: 3, backgroundColor: '#e2e8f0' },
  partDotDone: { backgroundColor: '#14b8a6' },
  partDotActive: { backgroundColor: '#d946ef' },

  // Quiz
  quizQ: { padding: 12, backgroundColor: '#f0fdfa', borderRadius: 12, borderWidth: 1, borderColor: '#5eead4', marginBottom: 12 },
  quizQText: { fontSize: 13, fontWeight: '700', color: '#0f172a', lineHeight: 20 },
  quizOpt: { width: '100%', paddingHorizontal: 13, paddingVertical: 11, borderRadius: 11, borderWidth: 2, borderColor: '#e2e8f0', backgroundColor: '#f8fafc', marginBottom: 7 },
  quizOptText: { fontSize: 12, fontWeight: '600', color: '#334155', lineHeight: 18 },
  optCorrect: { borderColor: '#10b981', backgroundColor: '#ecfdf5' },
  optWrong: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },

  // Feedback
  feedbackBar: { borderRadius: 10, paddingHorizontal: 13, paddingVertical: 10, marginTop: 4, borderWidth: 1 },
  fbOk: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' },
  fbWrong: { backgroundColor: '#fff1f2', borderColor: '#fecdd3' },
  feedbackText: { fontSize: 12, fontWeight: '600', lineHeight: 19 },

  // Compare
  comparePair: { backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 14, padding: 12, marginBottom: 12 },
  compareCtx: { fontSize: 11, color: '#64748b', marginBottom: 10, fontStyle: 'italic', lineHeight: 16 },
  compareOpt: { borderRadius: 12, padding: 11, marginBottom: 7, borderWidth: 2, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  compareOptLabel: { fontSize: 10, fontWeight: '700', color: '#0f766e', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  compareOptText: { fontSize: 12, color: '#334155', fontFamily: MONO, lineHeight: 18 },

  // Bug hunter
  bugCard: { backgroundColor: '#fff7ed', borderWidth: 2, borderColor: '#fdba74', borderRadius: 14, padding: 13, marginBottom: 11 },
  bugPromptBox: { backgroundColor: '#fff', borderWidth: 1, borderStyle: 'dashed', borderColor: '#fb923c', borderRadius: 9, padding: 10, marginBottom: 10 },
  bugPromptText: { fontFamily: MONO, fontSize: 11, color: '#431407', lineHeight: 17 },
  bugLabel: { fontSize: 11, fontWeight: '700', color: '#9a3412', marginBottom: 5, marginTop: 8 },
  bugChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 6 },
  bugChip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 12, borderWidth: 1.5, borderColor: '#fdba74', backgroundColor: '#fff' },
  bugChipSel: { borderColor: '#c2410c', backgroundColor: '#fdba74' },
  bugChipCorrect: { borderColor: '#10b981', backgroundColor: '#ecfdf5' },
  bugChipWrong: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },
  bugChipText: { fontSize: 10, fontWeight: '700', color: '#9a3412' },
  bugFix: { width: '100%', padding: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#fdba74', backgroundColor: '#fff', fontSize: 12, color: '#0f172a', minHeight: 60, lineHeight: 19, marginTop: 4, textAlignVertical: 'top' },

  // Builder cronometrado
  timerWrap: { backgroundColor: '#f0fdfa', borderWidth: 2, borderColor: '#5eead4', borderRadius: 14, padding: 13, marginBottom: 12, alignItems: 'center' },
  timerLabel: { fontSize: 10, color: '#0f766e', fontWeight: '700', letterSpacing: 0.8, marginBottom: 4 },
  timerDisplay: { fontSize: 38, fontWeight: '800', lineHeight: 40, marginBottom: 6, fontVariant: ['tabular-nums'] },
  timerBar: { height: 8, backgroundColor: '#ccfbf1', borderRadius: 4, overflow: 'hidden', width: '100%' },
  timerBarFill: { height: '100%', borderRadius: 4, backgroundColor: '#14b8a6' },
  builderLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, marginBottom: 4 },
  builderLabel: { flex: 1, fontSize: 11, fontWeight: '700', color: '#0f766e' },
  builderCheck: { width: 16, height: 16, borderRadius: 4, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  builderCheckDone: { backgroundColor: '#14b8a6' },
  builderCheckText: { fontSize: 10, color: '#94a3b8', fontWeight: '700', lineHeight: 12 },
  builderInput: { width: '100%', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#5eead4', backgroundColor: '#f0fdfa', fontSize: 12, color: '#0f172a', textAlignVertical: 'top' },
  promptPreview: { backgroundColor: '#042f2e', borderRadius: 12, padding: 13, borderWidth: 1, borderColor: '#134e4a' },
  previewText: { fontFamily: MONO, fontSize: 11, color: '#5eead4', lineHeight: 21 },
  pRol: { color: '#67e8f9' },
  pShot: { color: '#86efac' },
  pCot: { color: '#fde68a' },
  pFmt: { color: '#f0abfc' },
  pEmpty: { color: '#475569', fontStyle: 'italic' },
  p4StartBtn: { width: '100%', marginTop: 12, padding: 12, borderRadius: 11, backgroundColor: '#0d9488', alignItems: 'center' },
  p4StartBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Reflexión
  reflectQuestion: { fontSize: 14, fontWeight: '700', color: '#0f172a', lineHeight: 21, marginBottom: 6 },
  reflectArea: { width: '100%', padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#5eead4', backgroundColor: '#f0fdfa', fontSize: 13, color: '#0f172a', minHeight: 110, lineHeight: 22, textAlignVertical: 'top' },
  charCount: { fontSize: 10, color: '#94a3b8', textAlign: 'right', marginTop: 4 },

  // Score
  scoreRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginVertical: 12, flexWrap: 'wrap' },
  scoreItem: { alignItems: 'center', minWidth: 70 },
  scoreNum: { fontSize: 26, fontWeight: '800', color: '#0d9488' },
  scoreLbl: { fontSize: 10, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase' },
  xpBigText: { fontSize: 18, fontWeight: '800', color: '#0d9488' },

  // Badge
  badgeWrap: { alignItems: 'center', paddingVertical: 16, paddingHorizontal: 8 },
  badgeRingOuter: { padding: 6, borderRadius: 78, backgroundColor: '#f0fdfa', marginBottom: 18 },
  badgeRingInner: { padding: 6, borderRadius: 72, backgroundColor: '#ccfbf1' },
  badgeRing: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#14b8a6', alignItems: 'center', justifyContent: 'center', shadowColor: '#0d9488', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 32, elevation: 10 },
  badgeTitle: { ...typography.extraBold, fontSize: 22, color: '#0f172a', marginBottom: 8, textAlign: 'center' },
  badgeNameBox: { backgroundColor: '#f0fdfa', borderWidth: 2, borderColor: '#5eead4', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 16 },
  badgeName: { fontSize: 15, fontWeight: '700', color: '#0f766e' },
  badgeSub: { fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 21, marginBottom: 8 },
  skillList: { width: '100%', backgroundColor: '#f0fdfa', borderRadius: 12, padding: 13, marginBottom: 14, borderWidth: 1, borderColor: '#5eead4' },
  skillRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 7 },
  skillCheck: { color: '#0d9488', fontWeight: '700', fontSize: 12 },
  skillText: { flex: 1, fontSize: 12, color: '#334155', lineHeight: 18 },

  // Footer
  btnRow: { paddingHorizontal: 13, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', backgroundColor: '#fafcff' },
  mainBtn: { padding: 13, borderRadius: 12, backgroundColor: '#0d9488', alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  btnMagenta: { backgroundColor: '#c026d3' },
  btnGold: { backgroundColor: '#f59e0b' },
  mainBtnText: { ...typography.bold, color: '#fff', fontSize: 14 },
  mainBtnDisabled: { opacity: 0.32 },
  btnNote: { fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 5, minHeight: 15 },
});
