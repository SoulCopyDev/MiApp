import { exitLevel } from '../../utils/exitLevel';
import { router } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, BackHandler, Platform,
} from 'react-native';
import { useGameStore } from '../../store/gameStore';
import { useReportProgress } from '../../components/LevelProgress';
import { typography } from '../../theme';
import XPToast from '../../components/XPToast';

// ---------- Tipos ----------
type QuizItem = { q: string; opts: string[]; correct: number; explain: string };
type DDItem = { text: string; cat: 'ia' | 'noia' | 'etica' | 'noetica'; color: string; bg: string };
type Headline = { text: string; source: string; real: boolean; explain: string };

// ---------- Datos — Evaluación Mundo 1 (fuente: evaluacion-mundo-01.html) ----------
const QUIZ_POOL: QuizItem[] = [
  // N1 — IA básica
  { q: '¿Cuál de estas es la definición más precisa de Inteligencia Artificial?',
    opts: [
      'Sistemas que procesan datos y mejoran su desempeño con la experiencia, sin instrucciones explícitas para cada caso',
      'Cualquier software instalado en un dispositivo moderno conectado a internet o a una red local',
      'Robots físicos programados para imitar movimientos y gestos del cuerpo humano en entornos industriales',
      'Programas que ejecutan listas de instrucciones fijas definidas manualmente por un programador humano',
    ],
    correct: 0, explain: 'La IA aprende de datos y mejora con la experiencia, a diferencia del software tradicional que sigue reglas fijas escritas por humanos.' },
  { q: '¿Por qué la IA puede ganar al ajedrez mejor que los humanos pero no puede "sentir" orgullo por ganar?',
    opts: [
      'Porque los programadores bloquearon deliberadamente esa función para que el sistema no se vuelva peligroso',
      'Porque consume tanta energía eléctrica procesando jugadas que no le queda capacidad para las emociones',
      'Porque el ajedrez tiene reglas claras y medibles, mientras que las emociones humanas son mucho más sencillas',
      'Porque las emociones requieren experiencia subjetiva del mundo, algo que ningún sistema actual de IA posee',
    ],
    correct: 3, explain: 'La IA procesa patrones y optimiza objetivos numéricos. Las emociones requieren subjetividad y conciencia — algo que ningún sistema de IA actual posee.' },
  { q: '¿Cuál de estos hitos ocurrió primero en la historia de la IA?',
    opts: [
      'GPT-3 demuestra generación de texto coherente y extenso sin supervisión humana directa durante el proceso',
      'AlphaGo vence al campeón mundial de Go, un juego con más combinaciones posibles que átomos en el universo',
      'Deep Blue vence a Kasparov en una partida oficial de ajedrez de alto nivel reconocida mundialmente',
      'ChatGPT alcanza 100 millones de usuarios activos en menos de dos meses tras su lanzamiento público',
    ],
    correct: 2, explain: 'Deep Blue venció a Kasparov en 1997. AlphaGo fue en 2016, GPT-3 en 2020 y ChatGPT alcanzó 100M usuarios en 2023.' },
  // N2 — Apps
  { q: 'Cuando Spotify te recomienda una canción que nunca buscaste pero te encanta, ¿qué tipo de IA usa principalmente?',
    opts: [
      'Reconocimiento de voz que analiza lo que cantas o tarareas mientras escuchas música en tu dispositivo',
      'Generación de música original compuesta algorítmicamente y adaptada en tiempo real a tu estado de ánimo',
      'Sistema de recomendación que cruza tus patrones de escucha con los de millones de usuarios similares a ti',
      'Búsqueda avanzada por palabras clave ocultas en los títulos, letras y metadatos de cada canción disponible',
    ],
    correct: 2, explain: 'Los sistemas de recomendación comparan tus hábitos con los de usuarios similares (filtrado colaborativo) para predecir qué te gustará escuchar.' },
  { q: '¿Cuál de estas apps probablemente NO usa IA como componente central de su funcionamiento diario?',
    opts: [
      'Google Maps, que recalcula rutas en tiempo real evitando trancones reportados por millones de conductores',
      'Una calculadora básica de smartphone que suma, resta, multiplica y divide números ingresados por el usuario',
      'El filtro de spam del correo electrónico que aprende cuáles mensajes marcar como indeseados con el tiempo',
      'El autocorrector del teclado móvil que predice la siguiente palabra mientras redactas mensajes o notas',
    ],
    correct: 1, explain: 'Una calculadora básica ejecuta operaciones matemáticas con reglas fijas predefinidas. No aprende ni adapta su comportamiento — no es IA.' },
  { q: '¿Qué diferencia fundamental hay entre un LLM y un buscador como Google?',
    opts: [
      'Un LLM es un protocolo seguro de red corporativa; Google es un motor que indexa páginas en tiempo real',
      'Un LLM es un robot con capacidad de habla; Google es un sistema de almacenamiento de archivos en la nube',
      'Un LLM genera respuestas originales a partir de patrones aprendidos; Google recupera páginas que ya existen',
      'Un LLM es un tipo de malware que imita conversaciones reales; Google los detecta y bloquea automáticamente',
    ],
    correct: 2, explain: 'LLM (Modelo de Lenguaje Grande) genera texto nuevo basado en patrones aprendidos del entrenamiento. Google busca y enlaza contenido que ya existe en la web.' },
  // N3 — Prompting
  { q: '¿Cuáles son los 4 ingredientes de un prompt efectivo según el método que aprendiste en el curso?',
    opts: [
      'Velocidad de escritura, longitud total del mensaje, idioma elegido y puntuación correcta al final del texto',
      'Título del tema a tratar, cuerpo del argumento principal, conclusión esperada y fuentes de referencia citadas',
      'Rol que debe asumir la IA, tarea concreta a realizar, contexto de la situación y formato deseado de respuesta',
      'Pregunta inicial, respuesta de ejemplo, segundo ejemplo de referencia y resumen del objetivo final buscado',
    ],
    correct: 2, explain: 'Rol (quién es la IA), Tarea (qué debe hacer), Contexto (información de fondo relevante) y Formato (cómo quiero que entregue la respuesta).' },
  { q: 'Un estudiante escribe solo: "Explícame la fotosíntesis". ¿Qué le falta más a este prompt?',
    opts: [
      'El idioma en que quiere la respuesta, ya que la IA podría contestar en otro idioma completamente diferente',
      'La puntuación correcta y las mayúsculas al inicio para que el modelo lo procese y entienda de forma adecuada',
      'El rol de la IA, como escribir "actúa como maestro" para que el modelo active el modo de enseñanza correcto',
      'El contexto de quién pregunta y el formato esperado: para qué grado, con qué tipo de explicación y extensión',
    ],
    correct: 3, explain: 'Sin contexto (¿qué grado? ¿qué ya sabe?) y formato (¿con analogías? ¿en tabla? ¿cuántas palabras?), la IA genera algo demasiado genérico para ser útil.' },
  { q: '¿Qué es la "temperatura" en un LLM y cómo afecta directamente sus respuestas?',
    opts: [
      'El parámetro que regula la creatividad: temperatura alta da respuestas más variadas, temperatura baja más precisas',
      'El calor físico que generan los servidores al procesar solicitudes; más temperatura significa respuesta más lenta',
      'La cantidad máxima de palabras o tokens que el modelo puede leer en una conversación continua sin reiniciarse',
      'El idioma dominante del entrenamiento, que determina automáticamente en qué lengua responde el modelo por defecto',
    ],
    correct: 0, explain: 'Temperatura alta = respuestas más creativas e impredecibles. Temperatura baja = respuestas más precisas y consistentes. Es un parámetro clave del modelo.' },
  // N4 — Crear con IA
  { q: 'La IA te da una respuesta que no satisface tu necesidad real. ¿Qué debes hacer primero?',
    opts: [
      'Reformular el prompt añadiendo más contexto, especificando mejor el formato y detallando lo que necesitas',
      'Cerrar la aplicación inmediatamente y buscar la misma información en un buscador tradicional como Google',
      'Repetir exactamente el mismo prompt varias veces consecutivas hasta que el modelo genere algo diferente',
      'Aceptar que ese tema en particular supera las capacidades actuales de la IA y buscar un experto humano',
    ],
    correct: 0, explain: 'La iteración es la habilidad clave del prompting. Reformular añadiendo contexto, ajustando el formato o siendo más específico casi siempre mejora el resultado.' },
  { q: '¿Cuál de estos usos de la IA requiere obligatoriamente verificación humana adicional antes de actuar sobre el resultado?',
    opts: [
      'Generar el borrador inicial de un cuento de aventuras corto para compartir con amigos en redes sociales',
      'Resumir en cinco puntos claros un artículo largo de Wikipedia sobre un evento histórico para estudiar',
      'Obtener de la IA un posible diagnóstico médico detallado basándose en síntomas que describes en el chat',
      'Traducir un mensaje informal y breve de español a inglés para enviarlo a un compañero de intercambio escolar',
    ],
    correct: 2, explain: 'Los diagnósticos médicos requieren examen clínico presencial con un profesional. La IA puede inventar datos médicos con aparente confianza total, lo cual es peligroso.' },
  // N5 — Ética
  { q: '¿Qué es exactamente un "deepfake" y por qué representa un riesgo real para la sociedad?',
    opts: [
      'Un error técnico grave que ocurre cuando la IA no entiende el prompt y genera texto completamente sin sentido',
      'Un tipo de virus informático sofisticado que roba datos personales disfrazado de contenido multimedia legítimo',
      'Una técnica avanzada de cifrado digital usada para proteger datos privados en plataformas y redes sociales',
      'Contenido audiovisual sintético creado con IA que muestra personas diciendo o haciendo cosas que nunca hicieron',
    ],
    correct: 3, explain: 'Los deepfakes son videos, audios e imágenes generados con IA, muy difíciles de distinguir de contenido real. Se usan para desinformación, fraude y manipulación.' },
  { q: '¿Por qué un sistema de IA entrenado con datos históricos puede terminar reproduciendo discriminación?',
    opts: [
      'Porque los ingenieros de software programan reglas discriminatorias directamente en el código del modelo de IA',
      'Porque los datos históricos reflejan desigualdades reales del pasado, y el modelo aprende esos patrones implícitos',
      'Porque la IA no puede procesar correctamente nombres, imágenes o textos de personas de ciertos grupos étnicos',
      'Porque los gobiernos de muchos países exigen que los modelos incluyan ciertos sesgos para cumplir regulaciones',
    ],
    correct: 1, explain: 'Si los datos de entrenamiento reflejan discriminación histórica, el modelo la aprende y reproduce sin darse cuenta. Basura entra, basura sale — aplica al sesgo también.' },
  // N6 — Proyectos
  { q: '¿Cuál es la función real del "system prompt" al construir un asistente con IA?',
    opts: [
      'Es el código fuente completo del modelo que los desarrolladores escriben para definir su arquitectura técnica interna',
      'Es el primer mensaje visible que el usuario escribe cuando abre una conversación nueva con el asistente creado',
      'Son las instrucciones previas que definen la personalidad, el tono, los límites y el objetivo del asistente',
      'Es el resumen automático que la IA genera al cerrar cada conversación para recordar el contexto en la siguiente',
    ],
    correct: 2, explain: 'El system prompt define quién es tu IA: su rol, cómo habla, qué puede y qué no puede responder. Es la base invisible de cualquier asistente personalizado.' },
  { q: '¿Cuál de estos flujos representa correctamente el método para construir un proyecto con IA?',
    opts: [
      'Le pregunto a la IA qué proyecto debo hacer, sigo sus instrucciones al pie de la letra y publico el resultado',
      'Copio un proyecto que vi en internet, le cambio el nombre y los colores, y lo presento como trabajo propio',
      'Identifico un problema real, construyo un prompt inicial, pruebo el resultado, itero y documento el proceso',
      'Lanzo el producto al público desde el primer día sin probarlo, espero feedback y decido si continuar o no',
    ],
    correct: 2, explain: 'El método correcto es: problema real → prompt → prueba → iteración → documentación. Saltarse cualquier paso produce proyectos que nadie puede usar ni replicar.' },
];

const DD_ITEMS: DDItem[] = [
  { text: 'Spotify recomienda canciones nuevas', cat: 'ia', color: '#6366f1', bg: '#f5f3ff' },
  { text: 'Una calculadora suma 2+2', cat: 'noia', color: '#64748b', bg: '#f8fafc' },
  { text: 'Un chatbot médico diagnostica sin revisión', cat: 'etica', color: '#ef4444', bg: '#fff1f2' },
  { text: 'Netflix sugiere una serie que amarás', cat: 'ia', color: '#6366f1', bg: '#f5f3ff' },
  { text: 'Un semáforo cambia con un temporizador fijo', cat: 'noia', color: '#64748b', bg: '#f8fafc' },
  { text: 'Un deepfake del presidente dice algo falso', cat: 'etica', color: '#ef4444', bg: '#fff1f2' },
  { text: 'Google Maps evita el trancón en tiempo real', cat: 'ia', color: '#6366f1', bg: '#f5f3ff' },
  { text: 'Una app de IA ayuda a estudiantes ciegos a leer', cat: 'noetica', color: '#10b981', bg: '#ecfdf5' },
  { text: 'TikTok aprende qué videos te retienen más', cat: 'ia', color: '#6366f1', bg: '#f5f3ff' },
  { text: 'Un algoritmo rechaza solicitudes de trabajo por apellido', cat: 'etica', color: '#ef4444', bg: '#fff1f2' },
];

const DD_CATS = ['ia', 'noia', 'etica', 'noetica'] as const;
type DDCat = typeof DD_CATS[number];
const DD_HEADERS: Record<DDCat, { label: string; bg: string; color: string }> = {
  ia: { label: '🤖 Usa IA', bg: '#ede9fe', color: '#5b21b6' },
  noia: { label: '⚙️ No usa IA', bg: '#f1f5f9', color: '#475569' },
  etica: { label: '⚠️ Uso problemático', bg: '#fff1f2', color: '#991b1b' },
  noetica: { label: '✅ Uso positivo', bg: '#ecfdf5', color: '#065f46' },
};

const HEADLINES: Headline[] = [
  { text: '"Google DeepMind reduce el consumo energético de sus data centers un 40% usando IA para optimizar la refrigeración"',
    source: 'The Verge, 2016', real: true,
    explain: 'Real. DeepMind aplicó aprendizaje por refuerzo a los sistemas de refrigeración de Google, logrando una reducción del 40% en energía de refrigeración.' },
  { text: '"La IA ya diagnostica el cáncer de piel con mayor precisión que el dermatólogo promedio en estudios controlados"',
    source: 'Nature Medicine, 2018', real: true,
    explain: 'Real. Estudios publicados en Nature Medicine demostraron que modelos de visión computacional detectan melanoma con precisión comparable o superior a especialistas.' },
  { text: '"ChatGPT aprueba el examen de abogacía del estado de California con nota perfecta en todos los módulos"',
    source: 'Bloomberg Law, 2023', real: false,
    explain: 'Fabricado. GPT-4 aprobó el bar exam en percentil 90, no con nota perfecta. La versión "perfecta en todos los módulos" es una exageración sin respaldo.' },
  { text: '"AlphaFold de DeepMind predice la estructura de casi todas las proteínas conocidas, acelerando el desarrollo de medicamentos"',
    source: 'Science, 2021', real: true,
    explain: 'Real. AlphaFold 2 resolvió el "problema del plegamiento de proteínas" con precisión atómica, ganando el Nobel de Química 2024 para sus creadores.' },
  { text: '"Un modelo de IA reemplazó completamente al equipo legal de un bufete en Nueva York, dejando sin trabajo a 200 abogados de un día para otro"',
    source: 'Reuters, 2024', real: false,
    explain: 'Fabricado. Aunque la IA está transformando el trabajo legal, no ha reemplazado equipos completos de esta manera. Este tipo de titular suele ser desinformación sensacionalista.' },
];

// ---------- Helper ----------
// Fisher-Yates: `.sort(() => Math.random() - 0.5)` no baraja de forma uniforme.
const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const pickN = <T,>(arr: T[], n: number): T[] => shuffle(arr).slice(0, n);

// ── Validación de contenido (§14) ──
// Antes bastaba la longitud: el builder aceptaba 5 caracteres por campo y la
// reflexión se sellaba con 80 caracteres cualesquiera, cobrando los 25 XP. Ahora
// se valida que el texto sea real y esté en tema, como en Eval2–Eval6.
const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Campos cortos del builder (rol/tarea/contexto/formato): detecta relleno sin exigir frases largas. */
const looksGibberish = (text: string): boolean => {
  const n = normalize(text).trim();
  if (!/[aeiou]/.test(n)) return true;                       // "xkzqp"
  if (new Set(n.replace(/\s/g, '')).size <= 2) return true;  // "aaaaa", "ababab"
  return !/[a-z]{3,}/.test(n);                               // ninguna palabra de 3+ letras
};

/** Texto largo (reflexión): además de no ser relleno, debe tener variedad léxica. */
const looksRandom = (text: string): boolean => {
  const words = normalize(text).split(/\s+/).filter(Boolean);
  if (words.length < 8) return true;
  if (new Set(words).size / words.length < 0.5) return true; // repetir la misma palabra
  const noVowel = words.filter((w) => w.length >= 3 && !/[aeiou]/.test(w)).length;
  return noVowel / words.length > 0.3;
};

// Vocabulario del Mundo 1 (¿Qué es la IA?) — la reflexión pregunta qué cambió en
// cómo ves la tecnología, así que se acepta tanto el lenguaje del curso como los
// ejemplos cotidianos que el propio enunciado sugiere (Spotify, Maps, autocorrector).
const WORLD1_TERMS = ['ia', 'inteligencia artificial', 'tecnologia', 'algoritmo', 'dato', 'datos', 'sesgo', 'sesgos', 'entrena', 'entrenar', 'aprende', 'aprender', 'aprendizaje', 'modelo', 'prompt', 'chatgpt', 'claude', 'gemini', 'robot', 'automat', 'prediccion', 'predice', 'reconoc', 'recomienda', 'recomendacion', 'etica', 'privacidad', 'spotify', 'maps', 'netflix', 'autocorrector', 'traductor', 'filtro', 'camara', 'celular', 'app', 'aplicacion', 'internet', 'computador', 'computadora', 'maquina', 'humano', 'humanos', 'persona', 'personas', 'trabajo', 'colegio', 'estudiar', 'futuro', 'ciencia ficcion', 'pelicula', 'peliculas', 'sorprend', 'cambio', 'cambiar', 'antes', 'ahora', 'pensaba', 'creia', 'entender', 'entendi'];
const containsTopic = (text: string): boolean => {
  const n = normalize(text);
  const words = n.split(/[^a-z0-9]+/).filter(Boolean);
  // "ia" se busca como palabra completa: si no, "familia" o "materia" lo darían por bueno.
  return WORLD1_TERMS.some((t) => (t.length <= 3 ? words.includes(t) : n.includes(t)));
};

// Baraja las opciones de una pregunta y reubica el índice correcto (evita que la respuesta caiga siempre en la misma posición)
function shuffleOpts<T extends { opts: string[]; correct: number }>(q: T): T {
  const paired = q.opts.map((opt, i) => ({ opt, isCorrect: i === q.correct }));
  for (let j = paired.length - 1; j > 0; j--) {
    const k = Math.floor(Math.random() * (j + 1));
    [paired[j], paired[k]] = [paired[k], paired[j]];
  }
  return { ...q, opts: paired.map((p) => p.opt), correct: paired.findIndex((p) => p.isCorrect) };
}

const TOTAL_STEPS = 8; // 0:intro 1:quiz 2:drag 3:fake 4:builder 5:reflect 6:resultado 7:badge
const PROG_LABELS = ['Evaluación Mundo 1', 'Parte 1 — Quiz', 'Parte 2 — Drag-drop', 'Parte 3 — Fake Detector', 'Parte 4 — Builder', 'Parte 5 — Reflexión', 'Resultado', '🏆 Badge'];

// ---------- Componentes reutilizables ----------
function PartDots({ done, active }: { done: number; active: number }) {
  return (
    <View style={styles.partRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <View key={n} style={[styles.partDot, n <= done && styles.partDotDone, n === active && styles.partDotActive]} />
      ))}
    </View>
  );
}

export default function World1Eval() {
  const [step, setStep] = useState(0);
  useReportProgress(step, TOTAL_STEPS);
  const [xp, setXp] = useState(0);
  const [xpToast, setXpToast] = useState<{ amount: number; id: number } | null>(null);

  const completeLevel = useGameStore((s) => s.completeLevel);
  const devMode = useGameStore((s) => s.devMode);

  // Datos aleatorizados por sesión (preguntas y opciones barajadas)
  const [quizItems] = useState(() => pickN(QUIZ_POOL, 15).map(shuffleOpts));

  // Parte 1 — Quiz
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizSel, setQuizSel] = useState<number | null>(null);
  const [quizAnswered, setQuizAnswered] = useState(false);
  const [p1Score, setP1Score] = useState(0);

  // Parte 2 — Drag-drop
  const [ddPlaced, setDdPlaced] = useState<Record<number, DDCat>>({});
  const [ddSelected, setDdSelected] = useState<number | null>(null);
  const [ddChecked, setDdChecked] = useState(false);
  const [ddFb, setDdFb] = useState<{ ok: boolean; msg: string } | null>(null);
  const [p2Score, setP2Score] = useState(0);

  // Parte 3 — Fake Detector
  const [fakeIdx, setFakeIdx] = useState(0);
  const [fakeScore, setFakeScore] = useState(0);
  const [fakeAns, setFakeAns] = useState<boolean | null>(null);
  const [p3Score, setP3Score] = useState(0);

  // Parte 4 — Builder
  const [p4, setP4] = useState({ rol: '', tarea: '', ctx: '', fmt: '' });
  const [p4Fb, setP4Fb] = useState<string | null>(null);
  const [reflectFb, setReflectFb] = useState<string | null>(null);
  const [p4Done, setP4Done] = useState(false);

  // Parte 5 — Reflexión
  const [reflect, setReflect] = useState('');
  const [sealed, setSealed] = useState(false);

  const isExamMode = step >= 1 && step <= 5;

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

  const addXP = (n: number) => { setXp((p) => p + n); if (n > 0) setXpToast((prev) => ({ amount: n, id: (prev?.id ?? 0) + 1 })); };
  const next = () => setStep((s) => s + 1);

  // ----- Drag & drop web (además de tap para colocar) -----
  const ddPlacedRef = useRef(ddPlaced);
  useEffect(() => { ddPlacedRef.current = ddPlaced; }, [ddPlaced]);

  useEffect(() => {
    if (Platform.OS !== 'web' || step !== 2 || ddChecked) return;
    const cleanups: Array<() => void> = [];
    const setup = setTimeout(() => {
      DD_ITEMS.forEach((_, i) => {
        if (ddPlacedRef.current[i] !== undefined) return;
        const el = document.getElementById(`e1-chip-${i}`);
        if (!el) return;
        el.setAttribute('draggable', 'true');
        (el.style as any).cursor = 'grab';
        const onDragStart = (e: any) => {
          (window as any)._e1drag = i;
          if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(i)); } catch { /* noop */ } }
        };
        el.addEventListener('dragstart', onDragStart);
        cleanups.push(() => el.removeEventListener('dragstart', onDragStart));
      });
      DD_CATS.forEach((cat) => {
        const zoneEl = document.getElementById(`e1-zone-${cat}`);
        if (!zoneEl) return;
        const onDragOver = (e: any) => e.preventDefault();
        const onDrop = (e: any) => {
          e.preventDefault();
          const idx = (window as any)._e1drag;
          if (idx == null) return;
          setDdPlaced((prev) => ({ ...prev, [idx]: cat }));
          setDdSelected(null);
          (window as any)._e1drag = null;
        };
        zoneEl.addEventListener('dragover', onDragOver);
        zoneEl.addEventListener('drop', onDrop);
        cleanups.push(() => { zoneEl.removeEventListener('dragover', onDragOver); zoneEl.removeEventListener('drop', onDrop); });
      });
    }, 60);
    return () => { clearTimeout(setup); cleanups.forEach((c) => c()); };
  }, [step, ddPlaced, ddChecked]);

  const handleClose = () => {
    const msg = isExamMode ? 'Estás en la evaluación. Si sales perderás el progreso. ¿Seguro?' : '¿Seguro que quieres salir?';
    if (Platform.OS === 'web') { if (window.confirm(msg)) exitLevel({ confirm: false }); return; }
    Alert.alert('Salir', msg, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: () => exitLevel({ confirm: false }) },
    ]);
  };

  const handleFinish = () => {
    const overall = Math.round(((p1Score / 15) + (p2Score / 10) + (p3Score / 5)) / 3 * 100);
    const stars = overall >= 85 ? 3 : overall >= 60 ? 2 : 1;
    completeLevel(37, stars, xp);
    // Ir directo al primer nivel del Mundo 2 (N7)
    router.replace('/level/7');
  };

  // ----- Parte 1: Quiz -----
  const answerQuiz = (i: number) => {
    if (quizAnswered) return;
    setQuizAnswered(true);
    setQuizSel(i);
    if (i === quizItems[quizIdx].correct) setQuizScore((s) => s + 1);
  };
  const advanceQuiz = () => {
    if (quizIdx < quizItems.length - 1) {
      setQuizIdx((q) => q + 1);
      setQuizAnswered(false);
      setQuizSel(null);
    } else {
      // → pantalla resumen del quiz
      const finalScore = quizScore;
      setP1Score(finalScore);
      addXP(finalScore * 8);
      setQuizIdx(quizItems.length); // marca fin → muestra resumen
    }
  };

  // ----- Parte 2: Drag-drop -----
  const placeDD = (cat: DDCat) => {
    if (ddSelected === null || ddChecked) return;
    setDdPlaced((prev) => ({ ...prev, [ddSelected]: cat }));
    setDdSelected(null);
  };
  const removeDD = (idx: number) => {
    if (ddChecked) return;
    setDdPlaced((prev) => { const n = { ...prev }; delete n[idx]; return n; });
  };
  const verifyDD = () => {
    let correct = 0;
    DD_ITEMS.forEach((item, i) => { if (ddPlaced[i] === item.cat) correct++; });
    setP2Score(correct);
    setDdChecked(true);
    addXP(correct * 6);
    setDdFb({
      ok: correct >= 8,
      msg: (correct >= 8 ? '✅ ' : '⚠️ ') + `${correct}/${DD_ITEMS.length} clasificaciones correctas. +${correct * 6} XP. `
        + (correct < DD_ITEMS.length
          ? 'Tip: "No usa IA" = ejecuta instrucciones fijas sin aprender. "Uso problemático" = riesgo real de daño. "Uso positivo" = beneficio claro.'
          : '¡Clasificación perfecta!'),
    });
  };

  // ----- Parte 3: Fake Detector -----
  const answerFake = (ans: boolean) => {
    if (fakeAns !== null) return;
    setFakeAns(ans);
    if (ans === HEADLINES[fakeIdx].real) setFakeScore((s) => s + 1);
  };
  const advanceFake = () => {
    if (fakeIdx < HEADLINES.length - 1) {
      setFakeIdx((f) => f + 1);
      setFakeAns(null);
    } else {
      const finalScore = fakeScore;
      setP3Score(finalScore);
      addXP(finalScore * 10);
      setFakeIdx(HEADLINES.length);
    }
  };

  // ----- Parte 4: Builder -----
  // La longitud solo habilita el botón; el contenido se valida al pulsarlo (§14/§16),
  // así el usuario recibe una razón en vez de un botón muerto sin explicación.
  const p4Valid = Object.values(p4).every((v) => v.trim().length >= 5);
  const P4_LABELS: Record<string, string> = { rol: 'Rol', tarea: 'Tarea', ctx: 'Contexto', fmt: 'Formato' };
  const submitP4 = () => {
    const malos = Object.entries(p4)
      .filter(([, v]) => looksGibberish(v))
      .map(([k]) => P4_LABELS[k] ?? k);
    if (malos.length > 0) {
      setP4Fb(`Completa con palabras reales: ${malos.join(', ')}. Escribe lo que le pedirías de verdad a la IA.`);
      return;
    }
    setP4Fb(null);
    setP4Done(true);
    addXP(30);
  };

  // ----- Parte 5: Reflexión -----
  const reflectValid = reflect.trim().length >= 80;
  const sealReflect = () => {
    const t = reflect.trim();
    if (looksRandom(t)) {
      setReflectFb('Parece texto de relleno. Escribe tu respuesta real con tus propias palabras.');
      return;
    }
    if (!containsTopic(t)) {
      setReflectFb('Conéctalo con el Mundo 1: qué pensabas antes sobre la IA o la tecnología, y qué ves diferente ahora.');
      return;
    }
    setReflectFb(null);
    setSealed(true);
    addXP(25);
  };

  // ----- Resultado / Badge cálculos -----
  const quizPct = Math.round((p1Score / 15) * 100);
  const dragPct = Math.round((p2Score / 10) * 100);
  const fakePct = Math.round((p3Score / 5) * 100);
  const overall = Math.round((quizPct + dragPct + fakePct) / 3);

  // ---------- Botón inferior dinámico ----------
  const getBtn = (): { label: string; enabled: boolean; gold: boolean; onPress: () => void } | null => {
    switch (step) {
      case 0:
        return { label: '¡Comenzar evaluación! →', enabled: true, gold: true, onPress: next };
      case 1:
        if (quizIdx >= quizItems.length) return { label: 'Ir a Parte 2 →', enabled: true, gold: false, onPress: next };
        return { label: 'Siguiente →', enabled: quizAnswered || devMode, gold: false, onPress: advanceQuiz };
      case 2:
        if (ddChecked) return { label: 'Ir a Parte 3 →', enabled: true, gold: false, onPress: next };
        return { label: 'Verificar →', enabled: Object.keys(ddPlaced).length === DD_ITEMS.length || devMode, gold: false, onPress: verifyDD };
      case 3:
        if (fakeIdx >= HEADLINES.length) return { label: 'Ir a Parte 4 →', enabled: true, gold: false, onPress: next };
        return { label: 'Siguiente →', enabled: fakeAns !== null || devMode, gold: false, onPress: advanceFake };
      case 4:
        if (p4Done) return { label: 'Ir a Parte 5 →', enabled: true, gold: false, onPress: next };
        return { label: 'Enviar prompt →', enabled: p4Valid || devMode, gold: false, onPress: submitP4 };
      case 5:
        if (sealed) return { label: 'Ver mi resultado →', enabled: true, gold: true, onPress: next };
        return { label: 'Sellar reflexión →', enabled: reflectValid || devMode, gold: true, onPress: sealReflect };
      case 6:
        return { label: 'Reclamar mi badge 🏆 →', enabled: true, gold: true, onPress: next };
      default:
        return null; // step 7 (badge) usa botón propio
    }
  };
  const btn = getBtn();

  // ---------- Preview del prompt (Parte 4) ----------
  const renderPromptPreview = () => (
    <View style={styles.promptPreview}>
      <Text style={styles.promptLine}>
        Actúa como <Text style={p4.rol.trim() ? styles.pRol : styles.pEmpty}>{p4.rol.trim() || '[tu rol aquí]'}</Text>.
      </Text>
      <Text style={p4.tarea.trim() ? styles.pTask : styles.pEmpty}>{p4.tarea.trim() || '[tu tarea aquí]'}</Text>
      <Text style={styles.promptLine}>
        Contexto: <Text style={p4.ctx.trim() ? styles.pCtx : styles.pEmpty}>{p4.ctx.trim() || '[tu contexto aquí]'}</Text>
      </Text>
      <Text style={styles.promptLine}>
        Formato: <Text style={p4.fmt.trim() ? styles.pFmt : styles.pEmpty}>{p4.fmt.trim() || '[tu formato aquí]'}</Text>
      </Text>
    </View>
  );

  // ---------- Render de cada paso ----------
  const renderBody = () => {
    switch (step) {
      // ===== 0 INTRO =====
      case 0:
        return (
          <View>
            <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 4 }}>
              <View style={styles.lessonIcon}><Text style={{ fontSize: 42 }}>🏆</Text></View>
            </View>
            <Text style={[styles.lessonTitle, { textAlign: 'center' }]}>Evaluación Mundo 1</Text>
            <Text style={[styles.lessonSub, { textAlign: 'center' }]}>Completaste los 6 niveles de fundamentos. Ahora demostramos lo que aprendiste.</Text>
            <View style={[styles.card, styles.cardIndigo]}>
              <Text style={[styles.cardTitle, { marginBottom: 8 }]}>5 partes · ~15 minutos</Text>
              <Text style={styles.cardText}>🧠 <Text style={styles.b}>Parte 1:</Text> Quiz de 15 preguntas (N1–N6)</Text>
              <Text style={styles.cardText}>🎯 <Text style={styles.b}>Parte 2:</Text> Drag-drop — clasifica 10 situaciones</Text>
              <Text style={styles.cardText}>🔍 <Text style={styles.b}>Parte 3:</Text> Fake Detector — 5 titulares reales o fabricados</Text>
              <Text style={styles.cardText}>✍️ <Text style={styles.b}>Parte 4:</Text> Builder — construye un prompt con los 4 ingredientes</Text>
              <Text style={styles.cardText}>💬 <Text style={styles.b}>Parte 5:</Text> Reflexión sellada</Text>
            </View>
            <View style={[styles.card, styles.cardAmber, styles.cardRow]}>
              <View style={[styles.cardIcon, { backgroundColor: '#fde68a' }]}><Text style={{ fontSize: 19 }}>🎁</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Al completar</Text>
                <Text style={styles.cardText}>Desbloqueas la insignia <Text style={styles.b}>"Fundamentos Desbloqueados"</Text> y acceso al Mundo 2.</Text>
              </View>
            </View>
            <View style={[styles.hl, styles.hlIndigo]}>
              <Text style={styles.hlIndigoText}><Text style={styles.b}>No hay tiempo límite.</Text> Tómate el tiempo que necesites en cada parte.</Text>
            </View>
          </View>
        );

      // ===== 1 QUIZ =====
      case 1:
        if (quizIdx >= quizItems.length) {
          const label = p1Score >= 12 ? '¡Excelente dominio!' : p1Score >= 9 ? 'Buen trabajo, algunos conceptos a repasar.' : 'Sigue practicando — el conocimiento se consolida con la repetición.';
          const hlVariant = p1Score >= 12 ? styles.hlGreen : p1Score >= 9 ? styles.hlAmber : styles.hlRed;
          const hlText = p1Score >= 12 ? styles.hlGreenText : p1Score >= 9 ? styles.hlAmberText : styles.hlRedText;
          return (
            <View>
              <View style={[styles.tag, styles.tagQuiz]}><Text style={styles.tagQuizText}>✅ Parte 1 completada</Text></View>
              <Text style={[styles.lessonTitle, { fontSize: 17 }]}>Quiz finalizado</Text>
              <View style={styles.scoreRow}>
                <View style={styles.scoreItem}><Text style={styles.scoreNum}>{p1Score}</Text><Text style={styles.scoreLbl}>Correctas</Text></View>
                <View style={styles.scoreItem}><Text style={styles.scoreNum}>{quizItems.length}</Text><Text style={styles.scoreLbl}>Total</Text></View>
                <View style={styles.scoreItem}><Text style={styles.scoreNum}>{p1Score * 8}</Text><Text style={styles.scoreLbl}>XP ganados</Text></View>
              </View>
              <View style={[styles.hl, hlVariant]}><Text style={hlText}><Text style={styles.b}>{label}</Text></Text></View>
              <PartDots done={1} active={2} />
            </View>
          );
        } else {
          const item = quizItems[quizIdx];
          return (
            <View>
              <View style={[styles.tag, styles.tagQuiz]}><Text style={styles.tagQuizText}>🧠 Parte 1 · Quiz · {quizIdx + 1}/{quizItems.length}</Text></View>
              <PartDots done={0} active={1} />
              <View style={styles.quizQ}>
                <View style={styles.quizQNum}><Text style={styles.quizQNumText}>{quizIdx + 1}</Text></View>
                <Text style={styles.quizQText}>{item.q}</Text>
              </View>
              {item.opts.map((o, i) => {
                const correct = quizAnswered && i === item.correct;
                const wrong = quizAnswered && i === quizSel && i !== item.correct;
                const highlighted = correct || wrong;
                return (
                  <TouchableOpacity key={i} style={[styles.quizOpt, correct && styles.quizOptCorrect, wrong && styles.quizOptWrong]} onPress={() => answerQuiz(i)} disabled={quizAnswered}>
                    <View style={[styles.quizOptLetter, correct && styles.quizOptLetterOk, wrong && styles.quizOptLetterBad]}>
                      <Text style={[styles.quizOptLetterText, highlighted && { color: '#fff' }]}>{String.fromCharCode(65 + i)}</Text>
                    </View>
                    <Text style={[styles.quizOptText, correct && { color: '#065f46' }, wrong && { color: '#991b1b' }]}>{o}</Text>
                  </TouchableOpacity>
                );
              })}
              {quizAnswered && (
                <View style={[styles.feedbackBar, quizSel === item.correct ? styles.fbCorrect : styles.fbWrong]}>
                  <Text style={quizSel === item.correct ? styles.fbCorrectText : styles.fbWrongText}>{(quizSel === item.correct ? '✅ ' : '❌ ') + item.explain}</Text>
                </View>
              )}
            </View>
          );
        }

      // ===== 2 DRAG-DROP =====
      case 2:
        return (
          <View>
            <View style={[styles.tag, styles.tagDrag]}><Text style={styles.tagDragText}>🎯 Parte 2 · Drag-Drop</Text></View>
            <PartDots done={1} active={2} />
            <Text style={[styles.lessonSub, { marginBottom: 8 }]}>Arrastra cada situación a su categoría correcta.</Text>
            <View style={styles.chipPool}>
              {DD_ITEMS.map((item, i) => (ddPlaced[i] === undefined && (
                <TouchableOpacity
                  key={i}
                  {...({ nativeID: `e1-chip-${i}` } as any)}
                  style={[styles.chip, ddSelected === i && styles.chipActive]}
                  onPress={() => setDdSelected(ddSelected === i ? null : i)}
                  disabled={ddChecked}
                >
                  <Text style={[styles.chipText, ddSelected === i && styles.chipTextActive]}>{item.text}</Text>
                </TouchableOpacity>
              )))}
              {Object.keys(ddPlaced).length === DD_ITEMS.length && <Text style={{ fontSize: 11, color: '#94a3b8' }}>Todas las tarjetas ubicadas ✓</Text>}
            </View>
            <View style={styles.dropGrid}>
              {DD_CATS.map((cat) => {
                const head = DD_HEADERS[cat];
                const placedHere = Object.entries(ddPlaced).filter(([, c]) => c === cat).map(([k]) => parseInt(k));
                return (
                  <TouchableOpacity
                    key={cat}
                    {...({ nativeID: `e1-zone-${cat}` } as any)}
                    activeOpacity={0.9}
                    style={[styles.dropCol, placedHere.length > 0 && styles.dropColHas]}
                    onPress={() => placeDD(cat)}
                  >
                    <Text style={[styles.dropHeader, { backgroundColor: head.bg, color: head.color }]}>{head.label}</Text>
                    <View style={styles.dropArea}>
                      {placedHere.map((idx) => {
                        const it = DD_ITEMS[idx];
                        return (
                          <TouchableOpacity key={idx} onPress={() => removeDD(idx)} style={styles.dropChip}>
                            <Text style={styles.dropChipText}>{it.text} ✕</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            {ddFb && (
              <View style={[styles.feedbackBar, ddFb.ok ? styles.fbCorrect : styles.fbWrong]}>
                <Text style={ddFb.ok ? styles.fbCorrectText : styles.fbWrongText}>{ddFb.msg}</Text>
              </View>
            )}
          </View>
        );

      // ===== 3 FAKE DETECTOR =====
      case 3:
        if (fakeIdx >= HEADLINES.length) {
          const label = p3Score >= 4 ? '¡Excelente detector de desinformación!' : p3Score >= 3 ? 'Buen ojo crítico. Recuerda: busca la fuente original siempre.' : 'La desinformación sobre IA es un problema real. Practica verificar titulares.';
          const hlVariant = p3Score >= 4 ? styles.hlGreen : p3Score >= 3 ? styles.hlAmber : styles.hlRed;
          const hlText = p3Score >= 4 ? styles.hlGreenText : p3Score >= 3 ? styles.hlAmberText : styles.hlRedText;
          return (
            <View>
              <View style={[styles.tag, styles.tagFake]}><Text style={styles.tagFakeText}>✅ Parte 3 completada</Text></View>
              <Text style={[styles.lessonTitle, { fontSize: 17 }]}>Fake Detector: resultado</Text>
              <View style={styles.scoreRow}>
                <View style={styles.scoreItem}><Text style={styles.scoreNum}>{p3Score}</Text><Text style={styles.scoreLbl}>Correctas</Text></View>
                <View style={styles.scoreItem}><Text style={styles.scoreNum}>{HEADLINES.length}</Text><Text style={styles.scoreLbl}>Titulares</Text></View>
                <View style={styles.scoreItem}><Text style={styles.scoreNum}>{p3Score * 10}</Text><Text style={styles.scoreLbl}>XP</Text></View>
              </View>
              <View style={[styles.hl, hlVariant]}><Text style={hlText}><Text style={styles.b}>{label}</Text></Text></View>
              <PartDots done={3} active={4} />
            </View>
          );
        } else {
          const h = HEADLINES[fakeIdx];
          const correct = fakeAns !== null && fakeAns === h.real;
          return (
            <View>
              <View style={[styles.tag, styles.tagFake]}><Text style={styles.tagFakeText}>🔍 Parte 3 · Fake Detector · {fakeIdx + 1}/{HEADLINES.length}</Text></View>
              <PartDots done={2} active={3} />
              <View style={styles.headlineCard}>
                <Text style={styles.headlineText}>{h.text}</Text>
                <Text style={styles.headlineSource}>Fuente citada: {h.source}</Text>
                <View style={styles.fakeBtns}>
                  <TouchableOpacity style={[styles.fakeBtn, styles.fakeReal, fakeAns !== null && { opacity: 0.5 }]} onPress={() => answerFake(true)} disabled={fakeAns !== null}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#065f46' }}>✅ Real</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.fakeBtn, styles.fakeFab, fakeAns !== null && { opacity: 0.5 }]} onPress={() => answerFake(false)} disabled={fakeAns !== null}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#991b1b' }}>🚫 Fabricado</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {fakeAns !== null && (
                <View style={[styles.feedbackBar, correct ? styles.fbCorrect : styles.fbWrong]}>
                  <Text style={correct ? styles.fbCorrectText : styles.fbWrongText}>{(correct ? '✅ ' : '❌ ') + (h.real ? 'Real. ' : 'Fabricado. ') + h.explain}</Text>
                </View>
              )}
            </View>
          );
        }

      // ===== 4 BUILDER =====
      case 4:
        return (
          <View>
            <View style={[styles.tag, styles.tagBuild]}><Text style={styles.tagBuildText}>✍️ Parte 4 · Builder</Text></View>
            <PartDots done={3} active={4} />
            <Text style={[styles.lessonTitle, { fontSize: 16 }]}>Construye un prompt real</Text>
            <Text style={styles.lessonSub}>Elige un problema de tu vida real y construye el prompt con los 4 ingredientes.</Text>
            <Text style={styles.builderLabel}>🎭 Rol — ¿Quién debe ser la IA?</Text>
            <TextInput style={styles.builderInput} value={p4.rol} onChangeText={(v) => { setP4((p) => ({ ...p, rol: v })); if (p4Fb) setP4Fb(null); }} editable={!p4Done}
              placeholder="Ej: maestro de ciencias para bachillerato, coach de productividad..." placeholderTextColor="#b8bcc0" />
            <Text style={styles.builderLabel}>🎯 Tarea — ¿Qué debe hacer exactamente?</Text>
            <TextInput style={styles.builderInput} value={p4.tarea} onChangeText={(v) => { setP4((p) => ({ ...p, tarea: v })); if (p4Fb) setP4Fb(null); }} editable={!p4Done}
              placeholder="Ej: explícame los tipos de enlace químico, crea un plan de estudio..." placeholderTextColor="#b8bcc0" />
            <Text style={styles.builderLabel}>📋 Contexto — ¿Cuál es la situación?</Text>
            <TextInput style={styles.builderInput} value={p4.ctx} onChangeText={(v) => { setP4((p) => ({ ...p, ctx: v })); if (p4Fb) setP4Fb(null); }} editable={!p4Done}
              placeholder="Ej: soy de 10° grado, tengo examen mañana, trabajo mejor con analogías..." placeholderTextColor="#b8bcc0" />
            <Text style={styles.builderLabel}>📐 Formato — ¿Cómo quieres la respuesta?</Text>
            <TextInput style={styles.builderInput} value={p4.fmt} onChangeText={(v) => { setP4((p) => ({ ...p, fmt: v })); if (p4Fb) setP4Fb(null); }} editable={!p4Done}
              placeholder="Ej: lista de 5 puntos, máximo 150 palabras, con ejemplos al final..." placeholderTextColor="#b8bcc0" />
            <Text style={[styles.lessonSub, { marginTop: 12, marginBottom: 4 }]}>Vista previa de tu prompt:</Text>
            <View style={[p4Done && { borderWidth: 2, borderColor: '#10b981', borderRadius: 12 }]}>
              {renderPromptPreview()}
            </View>
            {p4Done && (
              <View style={[styles.feedbackBar, styles.fbCorrect, { marginTop: 12 }]}>
                <Text style={styles.fbCorrectText}>✅ ¡Prompt construido! Contiene los 4 ingredientes. Este es el tipo de prompt que obtiene resultados reales. +30 XP</Text>
              </View>
            )}
            {!p4Done && p4Fb && (
              <View style={[styles.feedbackBar, styles.fbWrong, { marginTop: 12 }]}>
                <Text style={styles.fbWrongText}>{p4Fb}</Text>
              </View>
            )}
          </View>
        );

      // ===== 5 REFLEXIÓN =====
      case 5:
        return (
          <View>
            <View style={[styles.tag, styles.tagReflect]}><Text style={styles.tagReflectText}>💬 Parte 5 · Reflexión sellada</Text></View>
            <PartDots done={4} active={5} />
            <Text style={[styles.lessonTitle, { fontSize: 16 }]}>Tu reflexión de cierre</Text>
            <Text style={[styles.lessonSub, { fontWeight: '700', color: '#0f172a', fontSize: 14 }]}>¿Qué cambió en cómo ves la tecnología después de este mundo?</Text>
            <Text style={styles.lessonSub}>Piensa en antes de empezar el Mundo 1 vs. ahora. ¿Qué ves diferente? ¿Qué te sorprendió? ¿Qué vas a hacer diferente?</Text>
            <TextInput
              style={[styles.reflectArea, sealed && { backgroundColor: '#f0fdf4', borderColor: '#10b981' }]}
              value={reflect}
              onChangeText={(v) => { setReflect(v); if (reflectFb) setReflectFb(null); }}
              editable={!sealed}
              multiline
              textAlignVertical="top"
              placeholder="Ej: Antes veía la IA como algo de películas de ciencia ficción. Ahora la veo en el autocorrector, en Spotify, en Maps... Lo que más me cambió fue entender que la IA aprende de datos y que los datos pueden tener sesgos. Eso me hace pensar en quién diseña estos sistemas y para quién..."
              placeholderTextColor="#b8bcc0"
            />
            <Text style={styles.charCount}>{reflect.length} / mínimo 80 caracteres</Text>
            {sealed && (
              <View style={[styles.feedbackBar, styles.fbCorrect, { marginTop: 4 }]}>
                <Text style={styles.fbCorrectText}>✅ Reflexión sellada. Queda guardada en tu portafolio IA Explorer. +25 XP</Text>
              </View>
            )}
            {!sealed && reflectFb && (
              <View style={[styles.feedbackBar, styles.fbWrong, { marginTop: 4 }]}>
                <Text style={styles.fbWrongText}>{reflectFb}</Text>
              </View>
            )}
            <View style={[styles.hl, styles.hlIndigo, { marginTop: 8 }]}>
              <Text style={styles.hlIndigoText}><Text style={styles.b}>Esta reflexión queda sellada en tu portafolio IA Explorer.</Text>{'\n'}Es evidencia de tu crecimiento — no hay respuesta correcta o incorrecta.</Text>
            </View>
          </View>
        );

      // ===== 6 RESULTADO =====
      case 6: {
        const medal = overall >= 85 ? '🥇' : overall >= 70 ? '🥈' : '🥉';
        const label = overall >= 85 ? 'Excelente — Fundamentos dominados' : overall >= 70 ? 'Bien — Base sólida con algunos gaps' : 'Aprobado — Repasa los niveles con menor puntaje';
        return (
          <View>
            <View style={[styles.tag, styles.tagEval]}><Text style={styles.tagEvalText}>🏁 Resultado final</Text></View>
            <Text style={[styles.lessonTitle, { fontSize: 17, textAlign: 'center' }]}>{medal} {label}</Text>
            <View style={styles.scoreRow}>
              <View style={styles.scoreItem}><Text style={styles.scoreNum}>{quizPct}%</Text><Text style={styles.scoreLbl}>Quiz</Text></View>
              <View style={styles.scoreItem}><Text style={styles.scoreNum}>{dragPct}%</Text><Text style={styles.scoreLbl}>Drag-drop</Text></View>
              <View style={styles.scoreItem}><Text style={styles.scoreNum}>{fakePct}%</Text><Text style={styles.scoreLbl}>Fake detector</Text></View>
            </View>
            <View style={[styles.card, styles.cardIndigo, styles.cardRow]}>
              <View style={[styles.cardIcon, { backgroundColor: '#ede9fe' }]}><Text style={{ fontSize: 19 }}>⭐</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>XP total acumulado</Text>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#4f46e5' }}>{xp} XP</Text>
              </View>
            </View>
            <View style={[styles.hl, styles.hlIndigo]}>
              <Text style={styles.hlIndigoText}><Text style={styles.b}>Partes completadas:</Text> Quiz ✅ · Drag-drop ✅ · Fake Detector ✅ · Builder ✅ · Reflexión ✅</Text>
            </View>
          </View>
        );
      }

      // ===== 7 BADGE =====
      case 7:
        return (
          <View style={{ alignItems: 'center', paddingVertical: 16, paddingHorizontal: 8 }}>
            <View style={styles.badgeRingOuter}>
              <View style={styles.badgeRingMid}>
                <View style={styles.badgeRing}><Text style={{ fontSize: 50 }}>🌍</Text></View>
              </View>
            </View>
            <Text style={styles.badgeTitle}>¡Badge desbloqueado!</Text>
            <View style={styles.badgeName}><Text style={styles.badgeNameText}>🌍 Fundamentos Desbloqueados</Text></View>
            <Text style={styles.badgeSub}>Completaste el Mundo 1 de IA Explorer.{'\n'}Pasaste de no saber qué es la IA a entenderla, usarla y cuestionarla.</Text>
            <View style={styles.scoreRow}>
              <View style={styles.scoreItem}><Text style={styles.scoreNum}>{overall}%</Text><Text style={styles.scoreLbl}>Puntaje global</Text></View>
              <View style={styles.scoreItem}><Text style={styles.scoreNum}>{xp}</Text><Text style={styles.scoreLbl}>XP total</Text></View>
            </View>
            <View style={styles.skillList}>
              {[
                'Entiendo qué es la IA y cómo aprende',
                'Identifico IA en apps cotidianas',
                'Construyo prompts con los 4 ingredientes',
                'Creé algo real con IA en mi primera sesión',
                'Entiendo los riesgos éticos y la desinformación sobre IA',
                'Conozco el método para construir un proyecto con IA',
              ].map((s, i) => (
                <View key={i} style={styles.skillRow}>
                  <Text style={styles.skillCheck}>✓</Text>
                  <Text style={styles.skillText}>{s}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity style={[styles.mainBtn, styles.mainBtnGold, { marginTop: 4 }]} onPress={handleFinish}>
              <Text style={styles.mainBtnText}>Ir al Mundo 2 → Domina el Prompting 🎯</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  const progressPercent = (step / (TOTAL_STEPS - 1)) * 100;

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.lessonBar}>
        <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
        <View style={styles.progWrap}>
          <View style={styles.progTrack}><View style={[styles.progFill, { width: `${progressPercent}%` as any }]} /></View>
          <Text style={styles.progLabel}>{PROG_LABELS[step]}</Text>
        </View>
        <View style={styles.xpChip}><Text style={styles.xpChipText}>{xp} XP</Text></View>
      </View>

      {/* Body */}
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {renderBody()}
      </ScrollView>

      {/* Botón inferior */}
      {btn && (
        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[styles.mainBtn, btn.gold && styles.mainBtnGold, !btn.enabled && styles.mainBtnDisabled]}
            onPress={btn.onPress}
            disabled={!btn.enabled}
          >
            <Text style={styles.mainBtnText}>{btn.label}</Text>
          </TouchableOpacity>
        </View>
      )}

      {xpToast && <XPToast key={xpToast.id} amount={xpToast.amount} onHide={() => setXpToast(null)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },

  // Header
  lessonBar: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13, paddingTop: 11, paddingBottom: 9, borderBottomWidth: 1, borderBottomColor: '#ede9fe', backgroundColor: '#f5f3ff' },
  closeBtn: { minWidth: 42, minHeight: 42, borderRadius: 10, backgroundColor: '#ede9fe', borderWidth: 1, borderColor: '#c4b5fd', alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 12, color: '#5b21b6', fontWeight: '800' },
  progWrap: { flex: 1 },
  progTrack: { height: 8, backgroundColor: '#ede9fe', borderRadius: 4, overflow: 'hidden' },
  progFill: { height: '100%', borderRadius: 4, backgroundColor: '#8b5cf6' },
  progLabel: { fontSize: 10, color: '#94a3b8', marginTop: 3, fontWeight: '500' },
  xpChip: { paddingHorizontal: 11, paddingVertical: 4, borderRadius: 12, backgroundColor: '#fde68a', borderWidth: 1, borderColor: '#fcd34d' },
  xpChipText: { fontSize: 12, color: '#92400e', fontWeight: '700' },

  body: { flex: 1 },
  bodyContent: { padding: 15, paddingBottom: 24 },

  // Tags
  tag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 11 },
  tagEval: { backgroundColor: '#f5f3ff' }, tagEvalText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4, color: '#5b21b6' },
  tagQuiz: { backgroundColor: '#eff6ff' }, tagQuizText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4, color: '#1e40af' },
  tagDrag: { backgroundColor: '#fef9c3' }, tagDragText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4, color: '#713f12' },
  tagFake: { backgroundColor: '#fff1f2' }, tagFakeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4, color: '#9f1239' },
  tagBuild: { backgroundColor: '#ecfdf5' }, tagBuildText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4, color: '#065f46' },
  tagReflect: { backgroundColor: '#f8fafc' }, tagReflectText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4, color: '#475569' },

  // Typography
  lessonIcon: { width: 80, height: 80, borderRadius: 24, backgroundColor: '#5b21b6', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  lessonTitle: { ...typography.extraBold, fontSize: 19, color: '#0f172a', lineHeight: 25, marginBottom: 7 },
  lessonSub: { ...typography.regular, fontSize: 13, color: '#64748b', lineHeight: 22, marginBottom: 13 },
  b: { fontWeight: '700', color: '#0f172a' },

  // Cards
  card: { borderRadius: 14, padding: 13, marginBottom: 9, borderWidth: 1 },
  cardIndigo: { backgroundColor: '#f5f3ff', borderColor: '#c4b5fd' },
  cardAmber: { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  cardRow: { flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  cardIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 12, fontWeight: '700', color: '#0f172a', marginBottom: 3 },
  cardText: { fontSize: 12, color: '#334155', lineHeight: 20 },

  // Highlight boxes
  hl: { paddingHorizontal: 14, paddingVertical: 12, borderTopRightRadius: 12, borderBottomRightRadius: 12, borderLeftWidth: 3, marginVertical: 9 },
  hlIndigo: { borderLeftColor: '#6366f1', backgroundColor: '#f5f3ff' }, hlIndigoText: { fontSize: 12, lineHeight: 20, fontWeight: '500', color: '#3730a3' },
  hlGreen: { borderLeftColor: '#10b981', backgroundColor: '#f0fdf4' }, hlGreenText: { fontSize: 12, lineHeight: 20, fontWeight: '500', color: '#065f46' },
  hlAmber: { borderLeftColor: '#f59e0b', backgroundColor: '#fffbeb' }, hlAmberText: { fontSize: 12, lineHeight: 20, fontWeight: '500', color: '#92400e' },
  hlRed: { borderLeftColor: '#ef4444', backgroundColor: '#fff1f2' }, hlRedText: { fontSize: 12, lineHeight: 20, fontWeight: '500', color: '#991b1b' },

  // Quiz
  quizQ: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 13, backgroundColor: '#f5f3ff', borderRadius: 12, borderWidth: 1.5, borderColor: '#c4b5fd', borderLeftWidth: 4, borderLeftColor: '#8b5cf6', marginBottom: 14 },
  quizQNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#8b5cf6', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  quizQNumText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  quizQText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#0f172a', lineHeight: 21 },
  quizOpt: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 13, paddingVertical: 12, borderRadius: 11, borderWidth: 2, borderColor: '#e2e8f0', backgroundColor: '#fff', marginBottom: 8 },
  quizOptLetter: { width: 26, height: 26, borderRadius: 8, backgroundColor: '#ede9fe', borderWidth: 1, borderColor: '#ddd6fe', alignItems: 'center', justifyContent: 'center' },
  quizOptLetterText: { fontSize: 12, fontWeight: '800', color: '#5b21b6' },
  quizOptLetterOk: { backgroundColor: '#10b981', borderColor: '#10b981' },
  quizOptLetterBad: { backgroundColor: '#ef4444', borderColor: '#ef4444' },
  quizOptText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#334155', lineHeight: 17 },
  quizOptCorrect: { borderColor: '#10b981', backgroundColor: '#ecfdf5' },
  quizOptWrong: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },

  // Feedback bar
  feedbackBar: { paddingHorizontal: 13, paddingVertical: 10, borderRadius: 10, marginTop: 4, borderWidth: 1 },
  fbCorrect: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }, fbCorrectText: { fontSize: 12, fontWeight: '600', color: '#065f46', lineHeight: 19 },
  fbWrong: { backgroundColor: '#fff1f2', borderColor: '#fecdd3' }, fbWrongText: { fontSize: 12, fontWeight: '600', color: '#991b1b', lineHeight: 19 },

  // Drag-drop
  chipPool: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10, marginBottom: 14, minHeight: 36, padding: 8, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#cbd5e1', alignItems: 'center' },
  chip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 14, borderWidth: 1.5, borderColor: '#cbd5e1', backgroundColor: '#f8fafc' },
  chipActive: { borderColor: '#6366f1', backgroundColor: '#eef2ff' },
  chipText: { fontSize: 11, fontWeight: '700', color: '#334155' },
  chipTextActive: { color: '#3730a3' },
  dropGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  dropCol: { width: '47.5%', flexGrow: 1, borderRadius: 12, borderWidth: 2, borderStyle: 'dashed', borderColor: '#cbd5e1', minHeight: 80, padding: 7, backgroundColor: '#fafafa' },
  dropColHas: { borderStyle: 'solid' },
  dropHeader: { fontSize: 10, fontWeight: '700', textAlign: 'center', marginBottom: 6, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 7, overflow: 'hidden' },
  dropArea: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  dropChip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12, borderWidth: 1.5, borderColor: '#cbd5e1', backgroundColor: '#f1f5f9' },
  dropChipText: { fontSize: 10, fontWeight: '600', color: '#334155' },

  // Fake detector
  headlineCard: { backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 13, padding: 13, marginBottom: 10 },
  headlineText: { fontSize: 13, fontWeight: '700', color: '#0f172a', lineHeight: 20, marginBottom: 10 },
  headlineSource: { fontSize: 10, color: '#94a3b8', marginBottom: 10, fontStyle: 'italic' },
  fakeBtns: { flexDirection: 'row', gap: 8 },
  fakeBtn: { flex: 1, padding: 10, borderRadius: 11, borderWidth: 2, alignItems: 'center' },
  fakeReal: { borderColor: '#10b981', backgroundColor: '#ecfdf5' },
  fakeFab: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },

  // Builder
  builderLabel: { fontSize: 11, fontWeight: '700', color: '#5b21b6', marginBottom: 4, marginTop: 10 },
  builderInput: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#c4b5fd', backgroundColor: '#f5f3ff', fontSize: 12, color: '#0f172a' },
  promptPreview: { backgroundColor: '#1e1b4b', borderRadius: 12, padding: 13, marginTop: 12, borderWidth: 1, borderColor: '#312e81' },
  promptLine: { color: '#c4b5fd', fontSize: 11, lineHeight: 20, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  pRol: { color: '#a5f3fc', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  pTask: { color: '#86efac', fontSize: 11, lineHeight: 20, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  pCtx: { color: '#fde68a', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  pFmt: { color: '#f9a8d4', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  pEmpty: { color: '#64748b', fontStyle: 'italic', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  // Reflect
  reflectArea: { padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#c4b5fd', backgroundColor: '#f5f3ff', fontSize: 13, color: '#0f172a', minHeight: 100, lineHeight: 20 },
  charCount: { fontSize: 10, color: '#94a3b8', textAlign: 'right', marginTop: 4 },

  // Score row
  scoreRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginVertical: 14 },
  scoreItem: { alignItems: 'center' },
  scoreNum: { fontSize: 28, fontWeight: '800', color: '#6366f1' },
  scoreLbl: { fontSize: 10, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', marginTop: 2 },

  // Part dots
  partRow: { flexDirection: 'row', gap: 6, marginBottom: 14, justifyContent: 'center' },
  partDot: { width: 32, height: 6, borderRadius: 3, backgroundColor: '#e2e8f0' },
  partDotDone: { backgroundColor: '#8b5cf6' },
  partDotActive: { backgroundColor: '#fbbf24' },

  // Badge
  badgeRingOuter: { width: 134, height: 134, borderRadius: 67, backgroundColor: '#fef3c7', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  badgeRingMid: { width: 122, height: 122, borderRadius: 61, backgroundColor: '#fde68a', alignItems: 'center', justifyContent: 'center' },
  badgeRing: { width: 110, height: 110, borderRadius: 55, backgroundColor: '#f59e0b', alignItems: 'center', justifyContent: 'center' },
  badgeTitle: { fontSize: 22, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  badgeName: { backgroundColor: '#f5f3ff', borderWidth: 2, borderColor: '#c4b5fd', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 16 },
  badgeNameText: { fontSize: 16, fontWeight: '700', color: '#5b21b6' },
  badgeSub: { fontSize: 13, color: '#64748b', marginBottom: 16, lineHeight: 21, textAlign: 'center' },
  skillList: { alignSelf: 'stretch', backgroundColor: '#f5f3ff', borderRadius: 12, padding: 13, marginBottom: 14, borderWidth: 1, borderColor: '#c4b5fd' },
  skillRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 7 },
  skillCheck: { color: '#6366f1', fontWeight: '700' },
  skillText: { flex: 1, fontSize: 12, color: '#334155', lineHeight: 18 },

  // Botón inferior
  btnRow: { paddingHorizontal: 13, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', backgroundColor: '#fafcff' },
  mainBtn: { width: '100%', padding: 14, borderRadius: 12, backgroundColor: '#4f46e5', alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  mainBtnGold: { backgroundColor: '#d97706' },
  mainBtnDisabled: { opacity: 0.32 },
  mainBtnText: { ...typography.bold, color: '#fff', fontSize: 14 },
});
