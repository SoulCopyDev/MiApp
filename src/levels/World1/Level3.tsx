import React, { useState, useEffect } from 'react';
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

// ---------- Tipos y constantes ----------
type DiagItem = {
  prompt: string;
  missing: string[];
  allOpts: { id: string; label: string; text: string }[];
  correct: string[];
  explain: string;
};

type RefineScenario = {
  subject: string;
  start: string;
  rounds: {
    question: string;
    opts: { text: string; quality: number; type: string }[];
  }[];
};

type RoleItem = {
  situation: string;
  opts: string[];
  correct: number;
  explain: string;
};

type EthicsItem = {
  prompt: string;
  correct: string;
  explain: string;
};

type DetectItem = {
  prompt: string;
  response: string;
  question: string;
  opts: string[];
  correct: number;
  explain: string;
};

type SprintItem = {
  situation: string;
  opts: string[];
  correct: number;
};

type TFItem = {
  stmt: string;
  correct: boolean;
  explain: string;
};

type MissionSubject = {
  emoji: string;
  name: string;
  desc: string;
  fields: string[];
};

const TOTAL_STEPS = 20; // 0:intro + 18 módulos + 1:complete
const CONTENT_STEPS = 18;

// Función helper
const pickN = <T,>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};

// ===================== POOLS DE DATOS =====================

const DIAG_POOL: DiagItem[] = [
  {
    prompt: '"Escribe algo sobre el cambio climático"',
    missing: ['ctx', 'inst', 'fmt'],
    allOpts: [
      { id: 'rol', label: '🎭 Rol', text: 'No dice quién debe ser la IA' },
      { id: 'ctx', label: '📋 Contexto', text: 'No especifica para qué ni para quién' },
      { id: 'inst', label: '🎯 Instrucción', text: 'Instrucción demasiado vaga' },
      { id: 'fmt', label: '📐 Formato', text: 'No dice extensión, estructura ni tono' },
    ],
    correct: ['ctx', 'inst', 'fmt'],
    explain: 'Solo tiene una instrucción muy vaga. Faltan: contexto, instrucción clara y formato.',
  },
  {
    prompt: '"Actúa como un chef profesional con 20 años de experiencia en cocina mediterránea."',
    missing: ['inst', 'fmt'],
    allOpts: [
      { id: 'rol', label: '🎭 Rol', text: 'No define el rol de la IA' },
      { id: 'ctx', label: '📋 Contexto', text: 'No hay información de fondo' },
      { id: 'inst', label: '🎯 Instrucción', text: 'No dice qué debe hacer el chef' },
      { id: 'fmt', label: '📐 Formato', text: 'No especifica cómo quiere la respuesta' },
    ],
    correct: ['inst', 'fmt'],
    explain: 'Tiene un buen rol, pero falta la instrucción y el formato.',
  },
  {
    prompt: '"Soy un estudiante de 10° preparando mi examen de química. Necesito entender los tipos de enlace químico."',
    missing: ['fmt'],
    allOpts: [
      { id: 'rol', label: '🎭 Rol', text: 'No define el rol de la IA' },
      { id: 'ctx', label: '📋 Contexto', text: 'No hay contexto sobre la situación' },
      { id: 'inst', label: '🎯 Instrucción', text: 'No queda claro qué debe hacer la IA' },
      { id: 'fmt', label: '📐 Formato', text: 'No dice cómo quiere la explicación' },
    ],
    correct: ['fmt'],
    explain: 'Buen contexto e instrucción implícita, pero falta el formato.',
  },
  {
    prompt: '"Traduce este texto al inglés: [texto]. En formato tabla, párrafo por párrafo."',
    missing: [],
    allOpts: [
      { id: 'rol', label: '🎭 Rol', text: 'No define el rol explícitamente' },
      { id: 'ctx', label: '📋 Contexto', text: 'No hay contexto' },
      { id: 'inst', label: '🎯 Instrucción', text: 'Instrucción no es clara' },
      { id: 'fmt', label: '📐 Formato', text: 'No especifica formato' },
    ],
    correct: [],
    explain: '¡Prompt bien construido! Tiene instrucción, contenido y formato.',
  },
  {
    prompt: '"Como coach de productividad, crea un plan de estudio semanal para alguien que trabaja de 8am a 5pm."',
    missing: [],
    allOpts: [
      { id: 'rol', label: '🎭 Rol', text: 'Le falta un rol más específico' },
      { id: 'ctx', label: '📋 Contexto', text: 'Falta más contexto' },
      { id: 'inst', label: '🎯 Instrucción', text: 'Instrucción no es clara' },
      { id: 'fmt', label: '📐 Formato', text: 'No especifica el formato' },
    ],
    correct: [],
    explain: '¡Excelente prompt! Tiene rol, contexto, instrucción clara.',
  },
  {
    prompt: '"Explícame machine learning"',
    missing: ['rol', 'ctx', 'inst', 'fmt'],
    allOpts: [
      { id: 'rol', label: '🎭 Rol', text: 'No dice quién debe ser la IA' },
      { id: 'ctx', label: '📋 Contexto', text: 'No hay contexto del estudiante' },
      { id: 'inst', label: '🎯 Instrucción', text: 'Demasiado vago' },
      { id: 'fmt', label: '📐 Formato', text: 'No especifica nada' },
    ],
    correct: ['rol', 'ctx', 'inst', 'fmt'],
    explain: 'El peor caso posible — no tiene ninguno de los 4 ingredientes.',
  },
  {
    prompt: '"Escribe un correo para mi jefe"',
    missing: ['ctx', 'inst', 'fmt'],
    allOpts: [
      { id: 'rol', label: '🎭 Rol', text: 'No dice en qué rol estar la IA' },
      { id: 'ctx', label: '📋 Contexto', text: 'No hay contexto del tema' },
      { id: 'inst', label: '🎯 Instrucción', text: 'No dice el propósito del correo' },
      { id: 'fmt', label: '📐 Formato', text: 'No especifica tono ni extensión' },
    ],
    correct: ['ctx', 'inst', 'fmt'],
    explain: 'Faltan contexto, instrucción y formato. El rol es opcional aquí.',
  },
  {
    prompt: '"Actúa como un entrenador personal. Mi hijo de 14 años quiere empezar a hacer ejercicio. Dame 5 ejercicios de iniciación para hacer en casa, con instrucciones paso a paso."',
    missing: [],
    allOpts: [
      { id: 'rol', label: '🎭 Rol', text: 'Rol podría ser más específico' },
      { id: 'ctx', label: '📋 Contexto', text: 'Falta más contexto' },
      { id: 'inst', label: '🎯 Instrucción', text: 'Instrucción no es clara' },
      { id: 'fmt', label: '📐 Formato', text: 'No especifica formato' },
    ],
    correct: [],
    explain: '¡Prompt 10/10! Rol claro, contexto completo, instrucción y formato específico.',
  },
];

const REFINE_SCENARIOS: RefineScenario[] = [
  {
    subject: 'Pedir ayuda para un trabajo escolar',
    start: 'Ayúdame con mi trabajo de biología',
    rounds: [
      {
        question: 'Ronda 1: ¿Cómo mejorarías este prompt primero?',
        opts: [
          { text: 'Especifica el tema exacto: "Ayúdame con mi trabajo de biología sobre la fotosíntesis"', quality: 40, type: 'best' },
          { text: 'Escríbelo en inglés para que la IA entienda mejor', quality: 20, type: 'ok' },
          { text: 'Agrega más signos de exclamación', quality: 20, type: 'bad' },
        ],
      },
      {
        question: 'Ronda 2: Ya tienes el tema. ¿Qué agregas ahora?',
        opts: [
          { text: 'Agrega tu nivel y qué necesitas: "Soy de 9° grado y necesito explicar paso a paso"', quality: 75, type: 'best' },
          { text: 'Agrega un emoji de planta 🌱', quality: 42, type: 'bad' },
          { text: 'Repite la instrucción dos veces', quality: 45, type: 'ok' },
        ],
      },
      {
        question: 'Ronda 3: ¿Cuál es el toque final?',
        opts: [
          { text: 'Especifica formato: "En máximo 300 palabras, con un ejemplo real"', quality: 100, type: 'best' },
          { text: 'Agrega "por favor" al inicio', quality: 78, type: 'ok' },
          { text: 'Elimina el contexto para que sea más corto', quality: 60, type: 'bad' },
        ],
      },
    ],
  },
  {
    subject: 'Pedir consejos de estudio',
    start: 'Dame tips para estudiar',
    rounds: [
      {
        question: 'Ronda 1: ¿Por dónde empiezas a mejorar este prompt?',
        opts: [
          { text: 'Define materia y situación: "Dame tips para estudiar álgebra con examen en 2 días"', quality: 45, type: 'best' },
          { text: 'Ponlo todo en mayúsculas', quality: 20, type: 'bad' },
          { text: 'Agrega "buenos": "Dame buenos tips para estudiar"', quality: 25, type: 'ok' },
        ],
      },
      {
        question: 'Ronda 2: Ya tienes contexto. ¿Qué más necesitas?',
        opts: [
          { text: 'Agrega tu situación real: "Soy de 10°, entiendo conceptos pero me trabo en ejercicios"', quality: 72, type: 'best' },
          { text: 'Pregunta tips de vida en general', quality: 50, type: 'ok' },
          { text: 'Acorta el prompt porque la IA prefiere instrucciones cortas', quality: 35, type: 'bad' },
        ],
      },
      {
        question: 'Ronda 3: El toque final para un prompt perfecto:',
        opts: [
          { text: 'Especifica output: "Dame 5 técnicas concretas, con ejemplo de cada una"', quality: 100, type: 'best' },
          { text: 'Agrega fecha límite: "respóndeme antes de las 8pm"', quality: 75, type: 'ok' },
          { text: 'Elimina contexto personal, es innecesario', quality: 55, type: 'bad' },
        ],
      },
    ],
  },
];

const ROLE_POOL: RoleItem[] = [
  { situation: 'Necesitas entender un concepto de física cuántica imposible', opts: ['Profesor de física', 'Chef profesional', 'Abogado', 'Coach deportivo'], correct: 0, explain: 'Un profesor sabe adaptar explicaciones complejas a diferentes niveles.' },
  { situation: 'Quieres retroalimentación honesta sobre el código que escribiste', opts: ['Médico', 'Senior developer', 'DJ profesional', 'Historiador'], correct: 1, explain: 'Un desarrollador senior sabe revisar código y sugerir mejores prácticas.' },
  { situation: 'Tienes que negociar un mejor precio con un proveedor', opts: ['Cocinero', 'Negociador experto en ventas B2B', 'Poeta', 'Veterinario'], correct: 1, explain: 'Un negociador experto conoce técnicas de negociación y manejo de objeciones.' },
  { situation: 'Quieres que tu ensayo de historia suene más académico', opts: ['Instructor de yoga', 'Editor académico especializado', 'Diseñador gráfico', 'Piloto'], correct: 1, explain: 'Un editor académico conoce el lenguaje académico y cómo estructurar argumentos.' },
  { situation: 'Necesitas planear una dieta saludable para un mes con presupuesto limitado', opts: ['Nutricionista clínico', 'Arquitecto', 'Programador', 'Cantante'], correct: 0, explain: 'Un nutricionista sabe combinar alimentos cumpliendo requerimientos nutricionales.' },
  { situation: 'Quieres crear una estrategia de contenido para Instagram', opts: ['Fontanero', 'Experto en marketing digital', 'Geólogo', 'Contador'], correct: 1, explain: 'Un experto en marketing digital conoce algoritmos, tendencias y crecimiento de audiencia.' },
];

const ETHICS_POOL: EthicsItem[] = [
  { prompt: '"Actúa como mi profesor y escribe mi ensayo de historia completo para entregarlo como propio"', correct: 'prob', explain: 'Pedir a la IA que haga trabajo académico para presentarlo como propio es trampa académica.' },
  { prompt: '"Explícame cómo funcionan los virus informáticos para entender ciberseguridad"', correct: 'safe', explain: 'Aprender sobre ciberseguridad es completamente legítimo y educativo.' },
  { prompt: '"¿Cómo puedo hackear la cuenta de Instagram de mi ex?"', correct: 'prob', explain: 'Acceder sin permiso a cuentas ajenas es ilegal y viola la privacidad.' },
  { prompt: '"Dame ideas originales para un proyecto de arte digital sobre IA"', correct: 'safe', explain: 'Pedir ideas creativas y desarrollarlas tú mismo es un uso perfecto de los LLMs.' },
  { prompt: '"Escribe un mensaje haciéndote pasar por el profesor García para cancelar un examen"', correct: 'prob', explain: 'Suplantar identidad para difundir información falsa es engaño y potencialmente fraude.' },
  { prompt: '"Ayúdame a entender los argumentos de ambos lados sobre el aborto para un debate"', correct: 'safe', explain: 'Pedir información balanceada para debatir es un uso excelente de los LLMs.' },
  { prompt: '"Crea un perfil falso de una persona real con información inventada"', correct: 'prob', explain: 'Crear perfiles falsos y difundir desinformación es ciberacoso y difamación.' },
  { prompt: '"Genera ideas para un negocio de comida saludable con $500.000 COP"', correct: 'safe', explain: 'Usar la IA como consultor de negocios es completamente ético y valioso.' },
];

const DETECT_POOL: DetectItem[] = [
  { prompt: '"Tradúceme esto"', response: '¿Qué deseas que traduzca? No veo ningún texto adjunto.', question: '¿Por qué falló este prompt?', opts: ['El LLM no sabe traducir', 'Falta el texto que se quiere traducir', 'El LLM solo traduce al inglés', 'El prompt debería estar en otro idioma'], correct: 1, explain: 'La instrucción olvidó incluir el contenido a traducir.' },
  { prompt: '"Escríbeme un poema"', response: '[poema genérico de amor de 20 estrofas]', question: 'El estudiante quería un haiku de 3 líneas sobre tecnología. ¿Qué falló?', opts: ['El LLM no sabe escribir haikus', 'No especificó el tipo de poema ni el tema', 'El LLM siempre escribe sobre amor', 'Los poemas no se pueden pedir a un LLM'], correct: 1, explain: 'Sin especificar tipo, tema y extensión, el LLM inventa su propia interpretación.' },
  { prompt: '"Como experto en nutrición, dame un plan de alimentación para bajar de peso rápido, con comidas deliciosas, económicas, fáciles, sin gluten, sin lactosa, vegano, y que me haga sentir muy lleno."', response: '[respuesta inconsistente y contradictoria]', question: '¿Cuál es el problema con este prompt?', opts: ['Es demasiado corto', 'Tiene demasiadas restricciones contradictorias', 'El rol de nutricionista no funciona', 'Falta el formato de salida'], correct: 1, explain: 'Demasiadas restricciones contradictorias abruman al modelo.' },
  { prompt: '"Explícame todo sobre la historia de Colombia"', response: '[respuesta enciclopédica de 3000 palabras]', question: 'El estudiante necesitaba un resumen de 5 puntos para 2 minutos. ¿Qué faltó?', opts: ['La IA no sabe historia', 'No especificó formato ni extensión', 'La instrucción estaba mal', 'El tema es demasiado amplio'], correct: 1, explain: 'Sin formato definido, la IA generó una respuesta enciclopédica.' },
];

const SPRINT_POOL: SprintItem[] = [
  { situation: 'Necesitas que la IA te explique la mitosis para un examen en 30 minutos', opts: ['Explícame la mitosis', 'Como profesor de biología para 9° grado, explícame la mitosis en 5 pasos claros con una analogía. Máx 200 palabras.', 'Cuéntame sobre la división celular', '¿Qué es la mitosis?'], correct: 1 },
  { situation: 'Quieres ideas para un negocio con $300.000 COP', opts: ['Dame ideas de negocios', 'Tengo 16 años, vivo en Medellín y tengo $300.000 COP. Como asesor de emprendimiento, dame 3 ideas viables para empezar este mes, con bajo riesgo.', 'Ideas de emprendimiento baratas', 'Cómo ganar dinero siendo joven'], correct: 1 },
  { situation: 'Quieres mejorar el primer párrafo de tu ensayo de literatura', opts: ['Mejora mi ensayo', 'Lee este párrafo y mejora la redacción manteniendo mis ideas y mi voz. Solo mejora estilo y fluidez: [párrafo]', 'Arregla los errores de este texto', 'Reescribe esto mejor'], correct: 1 },
  { situation: 'Necesitas aprender las capitales de América del Sur', opts: ['Enséñame las capitales de Suramérica', 'Como profesor creativo, crea un juego de 10 preguntas de trivia sobre las capitales de los 12 países de Sudamérica. Incluye respuestas.', 'Dame una lista de capitales', 'Necesito memorizar capitales'], correct: 1 },
  { situation: 'Quieres practicar inglés hablando sobre tu película favorita', opts: ['Hablemos de películas en inglés', 'Act as an English conversation partner at B1 level. Ask me about my favorite movie and correct my grammar gently.', 'Corrige mi inglés mientras hablo', 'Practice English with me about movies'], correct: 1 },
];

const PROMPT_TF_POOL: TFItem[] = [
  { stmt: 'Mientras más largo sea el prompt, mejor será la respuesta', correct: false, explain: 'La calidad depende de la claridad y especificidad, no de la longitud.' },
  { stmt: 'Añadir un rol al prompt mejora significativamente la calidad', correct: true, explain: 'El rol activa patrones de respuesta específicos en el LLM.' },
  { stmt: 'Si el LLM da una mala respuesta, la solución es repetir la misma pregunta', correct: false, explain: 'Repetir el mismo prompt da respuestas similares. Hay que mejorar el prompt.' },
  { stmt: 'Pedirle al LLM que responda "paso a paso" mejora la precisión', correct: true, explain: 'Esta técnica (Chain of Thought) mejora significativamente la precisión.' },
  { stmt: 'Los LLMs siempre recuerdan lo que les dijiste antes', correct: false, explain: 'Por defecto no tienen memoria entre sesiones.' },
  { stmt: 'Dar ejemplos de lo que quieres (few-shot) mejora la calidad', correct: true, explain: 'Mostrar 2-3 ejemplos del formato deseado es muy efectivo.' },
  { stmt: 'Un prompt ético produce mejores resultados que uno manipulativo', correct: true, explain: 'Los LLMs tienen salvaguardas que degradan respuestas a prompts manipulativos.' },
  { stmt: 'Los LLMs pueden reemplazar completamente a Google', correct: false, explain: 'Para información en tiempo real, Google es insustituible.' },
  { stmt: 'Decirle al LLM el formato exacto mejora la utilidad de la respuesta', correct: true, explain: 'Especificar formato es uno de los 4 ingredientes clave.' },
  { stmt: 'Un LLM puede inventar información falsa con total confianza', correct: true, explain: 'El fenómeno de "alucinación" es real. Siempre verifica datos críticos.' },
  { stmt: 'El prompting se aprende con práctica y no tiene reglas fijas', correct: true, explain: 'Aunque hay principios guía, también es un arte que mejora con la experimentación.' },
  { stmt: 'Si le dices al LLM que eres un experto, la respuesta será más técnica', correct: true, explain: 'Dar contexto sobre tu nivel ajusta vocabulario y profundidad.' },
];

const MISSION_SUBJECTS: MissionSubject[] = [
  { emoji: '🧪', name: 'Ciencias', desc: 'Prepara un prompt para entender un tema difícil', fields: ['¿Qué tema específico no entiendes?', '¿En qué grado estás?', '¿Qué tipo de ayuda necesitas?', '¿Cómo quieres que te lo expliquen?'] },
  { emoji: '📝', name: 'Lengua y Literatura', desc: 'Pide ayuda para mejorar un texto', fields: ['¿Qué tipo de texto es?', '¿Para qué grado o nivel?', '¿Qué quieres mejorar?', '¿Qué NO quieres que cambie?'] },
  { emoji: '💻', name: 'Proyecto personal', desc: 'Crea un prompt para tu idea', fields: ['¿Cuál es tu proyecto?', '¿Qué edad tienes?', '¿Qué necesitas exactamente?', '¿Cuál es tu principal limitación?'] },
];

const SORT_CAUSE_EFFECT = [
  'El usuario escribe: "Escríbeme algo sobre el espacio"',
  'El LLM recibe una instrucción sin tema específico, nivel, ni formato',
  'El modelo elige la respuesta más "promedio" que aprendió',
  'La respuesta sale genérica, larga y llena de información inútil',
  'El usuario piensa: "La IA no me entiende" — pero el problema era el prompt',
];

// ===================== COMPONENTE PRINCIPAL =====================
interface LevelProps {
  navigation?: any;
  setAllowBack?: (allow: boolean) => void;
}

export default function World1Level3({ navigation: propsNavigation, setAllowBack }: LevelProps) {
  const navigationFromHook = useNavigation();
  const navigation = propsNavigation || navigationFromHook;
  const completeLevel = useGameStore((state) => state.completeLevel);

  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);

  // Pools aleatorios
  const [diagItems] = useState(() => pickN(DIAG_POOL, 4));
  const [refineScenario] = useState(() => pickN(REFINE_SCENARIOS, 1)[0]);
  const [roleItems] = useState(() => pickN(ROLE_POOL, 6));
  const [ethicsItems] = useState(() => pickN(ETHICS_POOL, 5));
  const [detectItems] = useState(() => pickN(DETECT_POOL, 4));
  const [sprintItems] = useState(() => pickN(SPRINT_POOL, 5));
  const [tfItems] = useState(() => pickN(PROMPT_TF_POOL, 6));

  // Estados de módulos
  const [diagCurrent, setDiagCurrent] = useState(0);
  const [diagAnswers, setDiagAnswers] = useState<Record<string, boolean>>({});
  const [diagChecked, setDiagChecked] = useState(false);

  const [refineRound, setRefineRound] = useState(0);
  const [refineQuality, setRefineQuality] = useState(20);
  const [refineDone, setRefineDone] = useState(false);

  const [roleAnswers, setRoleAnswers] = useState<Record<number, number>>({});
  const [roleChecked, setRoleChecked] = useState(false);

  const [ethicsAnswers, setEthicsAnswers] = useState<Record<number, string>>({});
  const [ethicsChecked, setEthicsChecked] = useState(false);

  const [missionData, setMissionData] = useState<Record<number, Record<number, string>>>({});

  const [detectAnswers, setDetectAnswers] = useState<Record<number, number>>({});
  const [detectChecked, setDetectChecked] = useState(false);

  const [sprintIdx, setSprintIdx] = useState(0);
  const [sprintTimeLeft, setSprintTimeLeft] = useState(60);
  const [sprintCorrect, setSprintCorrect] = useState(0);
  const [sprintDone, setSprintDone] = useState(false);
  const [sprintAnswered, setSprintAnswered] = useState(false);

  const [sortOrder, setSortOrder] = useState<number[]>([]);
  const [sortOk, setSortOk] = useState(false);

  const [tfAnswers, setTfAnswers] = useState<Record<number, boolean>>({});
  const [tfChecked, setTfChecked] = useState(false);

  const [reflectText, setReflectText] = useState('');

  const [builderRol, setBuilderRol] = useState('');
  const [builderCtx, setBuilderCtx] = useState('');
  const [builderInst, setBuilderInst] = useState('');
  const [builderFmt, setBuilderFmt] = useState('');

  // Modo "examen" para bloquear retroceso
  const examSteps = new Set([4, 5, 7, 9, 10, 12, 13, 14, 15, 17, 18]);
  const isExamMode = examSteps.has(step);

  useEffect(() => {
    setAllowBack?.(!isExamMode);
  }, [isExamMode, setAllowBack]);

  useEffect(() => {
    const onBackPress = () => {
      if (isExamMode) {
        Alert.alert('Módulo en curso', 'No puedes regresar durante esta actividad. Si sales, perderás el progreso.', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Salir', style: 'destructive', onPress: () => navigation.goBack() },
        ]);
        return true;
      }
      return false;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [isExamMode, navigation]);

  // Inicializar estados al cambiar de paso
  useEffect(() => {
    if (step === 5) {
      setDiagCurrent(0);
      setDiagAnswers({});
      setDiagChecked(false);
    }
    if (step === 7) {
      setRefineRound(0);
      setRefineQuality(20);
      setRefineDone(false);
    }
    if (step === 9) {
      setRoleAnswers({});
      setRoleChecked(false);
    }
    if (step === 10) {
      setEthicsAnswers({});
      setEthicsChecked(false);
    }
    if (step === 12) {
      setMissionData({});
    }
    if (step === 13) {
      setDetectAnswers({});
      setDetectChecked(false);
    }
    if (step === 14) {
      setSprintIdx(0);
      setSprintTimeLeft(60);
      setSprintCorrect(0);
      setSprintDone(false);
      setSprintAnswered(false);
    }
    if (step === 15) {
      const order = [0, 1, 2, 3, 4];
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      setSortOrder(order);
      setSortOk(false);
    }
    if (step === 17) {
      setTfAnswers({});
      setTfChecked(false);
    }
  }, [step]);

  // Timer sprint
  useEffect(() => {
    if (step !== 14 || sprintDone || sprintAnswered) return;
    const timer = setInterval(() => {
      setSprintTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSprintTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [step, sprintIdx, sprintDone, sprintAnswered]);

  const addXP = (amount: number) => setXp((prev) => prev + amount);

  const goToNextStep = () => {
    if (step < TOTAL_STEPS - 1) setStep(step + 1);
  };

  const handleClose = () => {
    if (isExamMode) {
      Alert.alert('Actividad en curso', 'Si sales, perderás el progreso. ¿Seguro?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Salir', style: 'destructive', onPress: () => navigation.goBack() },
      ]);
    } else {
      Alert.alert('Salir', '¿Seguro que quieres salir? Perderás el progreso.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Salir', onPress: () => navigation.goBack() },
      ]);
    }
  };

  const handleFinish = () => {
    let stars = 0;
    if (xp >= 150) stars = 3;
    else if (xp >= 100) stars = 2;
    else if (xp >= 50) stars = 1;
    completeLevel(1, 3, stars, xp);
    navigation.goBack();
  };

  // ============ MECÁNICAS DE MÓDULOS ============

  // Builder (4)
  const checkBuilder = () => {
    const filled = [builderRol, builderCtx, builderInst, builderFmt].filter(Boolean).length;
    if (filled < 4) {
      Alert.alert('Incompleto', `Faltan ${4 - filled} secciones. Elige una opción en cada bloque.`);
      return false;
    }
    return true;
  };

  // Diagnóstico (5)
  const toggleIngr = (id: string) => {
    if (diagChecked) return;
    setDiagAnswers((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const checkDiag = () => {
    if (diagChecked) {
      if (diagCurrent + 1 >= diagItems.length) return true;
      setDiagCurrent((prev) => prev + 1);
      setDiagAnswers({});
      setDiagChecked(false);
      return false;
    }
    const item = diagItems[diagCurrent];
    const selected = Object.entries(diagAnswers).filter(([, v]) => v).map(([k]) => k);
    const correct = item.correct;
    const isOk = correct.length === selected.length && correct.every((c) => selected.includes(c)) && selected.every((s) => correct.includes(s));
    setDiagChecked(true);
    if (isOk) addXP(8);
    Alert.alert(isOk ? '¡Correcto!' : 'No del todo', item.explain);
    return false;
  };

  // Refinement (7)
  const selectRefineOpt = (idx: number) => {
    if (refineDone || refineRound >= refineScenario.rounds.length) return;
    const round = refineScenario.rounds[refineRound];
    const opt = round.opts[idx];
    setRefineQuality(opt.quality);
    if (opt.type === 'best' && refineRound === refineScenario.rounds.length - 1) {
      const earned = opt.quality >= 95 ? 20 : 12;
      addXP(earned);
      setTimeout(() => setRefineDone(true), 500);
    }
    setRefineRound((prev) => prev + 1);
    if (refineRound + 1 >= refineScenario.rounds.length) {
      setTimeout(() => setRefineDone(true), 900);
    }
  };

  // Role picker (9)
  const selectRole = (scenIdx: number, optIdx: number) => {
    if (roleChecked) return;
    setRoleAnswers((prev) => ({ ...prev, [scenIdx]: optIdx }));
  };

  const checkRole = () => {
    if (roleChecked) return true;
    if (Object.keys(roleAnswers).length < roleItems.length) {
      Alert.alert('Incompleto', 'Responde todas las situaciones.');
      return false;
    }
    setRoleChecked(true);
    let correct = 0;
    roleItems.forEach((item, idx) => {
      if (roleAnswers[idx] === item.correct) correct++;
    });
    const earned = correct * 5;
    if (earned > 0) addXP(earned);
    Alert.alert('Resultado', `${correct}/${roleItems.length} correctas. +${earned} XP`, [{ text: 'OK', onPress: goToNextStep }]);
    return false;
  };

  // Ethics (10)
  const selectEthics = (idx: number, val: string) => {
    if (ethicsChecked) return;
    setEthicsAnswers((prev) => ({ ...prev, [idx]: val }));
  };

  const checkEthics = () => {
    if (ethicsChecked) return true;
    if (Object.keys(ethicsAnswers).length < ethicsItems.length) {
      Alert.alert('Incompleto', 'Clasifica todos los prompts.');
      return false;
    }
    setEthicsChecked(true);
    let correct = 0;
    ethicsItems.forEach((item, idx) => {
      if (ethicsAnswers[idx] === item.correct) correct++;
    });
    const earned = correct * 6;
    if (earned > 0) addXP(earned);
    Alert.alert('Resultado', `${correct}/${ethicsItems.length} correctas. +${earned} XP`, [{ text: 'OK', onPress: goToNextStep }]);
    return false;
  };

  // Mission (12)
  const updateMissionField = (subIdx: number, fieldIdx: number, val: string) => {
    setMissionData((prev) => {
      const newData = { ...prev };
      if (!newData[subIdx]) newData[subIdx] = {};
      newData[subIdx] = { ...newData[subIdx], [fieldIdx]: val };
      return newData;
    });
  };

  const checkMission = () => {
    const allFull = MISSION_SUBJECTS.every((_, i) => {
      const d = missionData[i] || {};
      return Object.values(d).filter((v) => v && v.length > 2).length >= 2;
    });
    if (!allFull) {
      Alert.alert('Incompleto', 'Completa al menos 2 campos en cada materia.');
      return false;
    }
    addXP(15);
    return true;
  };

  // Detective (13)
  const selectDetect = (idx: number, optIdx: number) => {
    if (detectChecked) return;
    setDetectAnswers((prev) => ({ ...prev, [idx]: optIdx }));
  };

  const checkDetect = () => {
    if (detectChecked) return true;
    if (Object.keys(detectAnswers).length < detectItems.length) {
      Alert.alert('Incompleto', 'Responde todos los casos.');
      return false;
    }
    setDetectChecked(true);
    let correct = 0;
    detectItems.forEach((item, idx) => {
      if (detectAnswers[idx] === item.correct) correct++;
    });
    const earned = correct * 8;
    if (earned > 0) addXP(earned);
    Alert.alert('Resultado', `${correct}/${detectItems.length} correctas. +${earned} XP`, [{ text: 'OK', onPress: goToNextStep }]);
    return false;
  };

  // Sprint (14)
  const selectSprintOpt = (optIdx: number) => {
    if (sprintAnswered || sprintDone) return;
    setSprintAnswered(true);
    const item = sprintItems[sprintIdx];
    const isOk = optIdx === item.correct;
    const bonus = Math.max(0, Math.floor(sprintTimeLeft / 10));
    const earned = isOk ? 10 + bonus : 0;
    if (isOk) {
      setSprintCorrect((prev) => prev + 1);
      if (earned > 0) addXP(earned);
    }
    Alert.alert(isOk ? `¡Correcto! +${earned} XP` : 'Incorrecto', isOk ? `+${bonus} XP por velocidad` : 'El mejor prompt era el Prompt B.', [
      { text: 'OK', onPress: () => {
        if (sprintIdx + 1 >= sprintItems.length) {
          const finalEarned = (sprintCorrect + (isOk ? 1 : 0)) * 3;
          addXP(finalEarned);
          setSprintDone(true);
        } else {
          setSprintIdx((prev) => prev + 1);
          setSprintTimeLeft(60);
          setSprintAnswered(false);
        }
      }},
    ]);
  };

  const handleSprintTimeout = () => {
    if (sprintAnswered || sprintDone) return;
    setSprintAnswered(true);
    Alert.alert('¡Tiempo!', 'Se acabaron los 60 segundos.', [
      { text: 'OK', onPress: () => {
        if (sprintIdx + 1 >= sprintItems.length) {
          setSprintDone(true);
        } else {
          setSprintIdx((prev) => prev + 1);
          setSprintTimeLeft(60);
          setSprintAnswered(false);
        }
      }},
    ]);
  };

  // Sort (15)
  const moveSort = (pos: number, dir: number) => {
    const newPos = pos + dir;
    if (newPos < 0 || newPos >= sortOrder.length) return;
    const newOrder = [...sortOrder];
    [newOrder[pos], newOrder[newPos]] = [newOrder[newPos], newOrder[pos]];
    setSortOrder(newOrder);
  };

  const checkSort = () => {
    if (sortOk) return true;
    const isOk = sortOrder.every((v, i) => v === i);
    if (isOk) {
      setSortOk(true);
      addXP(12);
      Alert.alert('¡Exacto!', 'Ese es el ciclo completo: prompt vago → IA sin contexto → respuesta genérica → frustración. +12 XP', [{ text: 'OK', onPress: goToNextStep }]);
      return false;
    }
    Alert.alert('Incorrecto', 'Algunos pasos están fuera de lugar. Piensa en causa y efecto.');
    return false;
  };

  // T/F (17)
  const selectTF = (idx: number, val: boolean) => {
    if (tfChecked) return;
    setTfAnswers((prev) => ({ ...prev, [idx]: val }));
  };

  const checkTF = () => {
    if (tfChecked) return true;
    if (Object.keys(tfAnswers).length < tfItems.length) {
      Alert.alert('Incompleto', 'Responde todas las afirmaciones.');
      return false;
    }
    setTfChecked(true);
    let correct = 0;
    tfItems.forEach((item, idx) => {
      if (tfAnswers[idx] === item.correct) correct++;
    });
    const earned = correct * 6;
    if (earned > 0) addXP(earned);
    Alert.alert('Resultado', `${correct}/${tfItems.length} correctas. +${earned} XP`, [{ text: 'OK', onPress: goToNextStep }]);
    return false;
  };

  // Reflexión (18)
  const checkReflect = () => {
    if (reflectText.trim().length >= 80) {
      addXP(20);
      return true;
    }
    Alert.alert('Muy corto', 'Escribe al menos 80 caracteres.');
    return false;
  };

  // ============ RENDERIZADO DE PASOS ============
  const renderIntro = () => (
    <View>
      <View style={styles.tag}><Text style={styles.tagText}>Nivel 3 · 18 módulos</Text></View>
      <View style={styles.iconCircle}><Text style={{ fontSize: 36 }}>✍️</Text></View>
      <Text style={styles.title}>El Arte del Prompting</Text>
      <Text style={styles.subtitle}>Un LLM sin buen prompt es como un chef sin receta — puede hacer algo, pero no lo que necesitas. El prompting es la habilidad que separa a los usuarios básicos de los expertos en IA.</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📚 Qué vas a aprender</Text>
        <Text style={styles.cardText}>Los 4 ingredientes de un prompt perfecto · Técnicas zero-shot, few-shot y chain-of-thought · Cómo usar roles · Ética del prompting · Construir prompts para estudiar y crear proyectos</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>⚡ Mecánicas nuevas</Text>
        <Text style={styles.cardText}>Simulador de comparación · Constructor de prompts · Detector de ingredientes · Refinamiento por rondas · Juicio ético · Modo Sprint con timer ⏱️</Text>
      </View>
    </View>
  );

  const renderTheory1 = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fdf4ff' }]}><Text style={[styles.tagText, { color: '#7e22ce' }]}>📖 Módulo 1 de 18 · Teoría</Text></View>
      <Text style={styles.title}>¿Qué es un prompt y por qué importa tanto?</Text>
      <Text style={styles.bodyText}>Un <Text style={{ fontWeight: 'bold' }}>prompt</Text> es cualquier instrucción, pregunta o contexto que le das a un LLM para obtener una respuesta. La calidad de lo que recibes depende directamente de la calidad de lo que envías.</Text>
      <View style={styles.highlightOrange}>
        <Text style={styles.highlightText}><Text style={{ fontWeight: 'bold' }}>🔑 La regla fundamental:</Text> La IA no puede leer tu mente. No sabe qué nivel tienes, para qué necesitas la respuesta, ni en qué formato la quieres. Si no se lo dices, inventa.</Text>
      </View>
      <Text style={styles.sectionTitle}>La diferencia en números reales</Text>
      <View style={[styles.card, { backgroundColor: '#fff1f2' }]}>
        <Text style={styles.cardTitle}>❌ Prompt vago → resultado genérico</Text>
        <Text style={[styles.cardText, { fontStyle: 'italic' }]}>"Explícame la historia de Colombia" → Respuesta enciclopédica de 2000 palabras que no sirve para nada específico.</Text>
      </View>
      <View style={[styles.card, { backgroundColor: '#f0fdf4' }]}>
        <Text style={styles.cardTitle}>✅ Prompt específico → resultado útil</Text>
        <Text style={[styles.cardText, { fontStyle: 'italic' }]}>"Actúa como profesor de 9° grado. Resume en 5 puntos las causas de la independencia de Colombia, con un ejemplo concreto para cada causa." → Exactamente lo que necesitas.</Text>
      </View>
    </View>
  );

  const renderLab = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#ecfdf5' }]}><Text style={[styles.tagText, { color: '#065f46' }]}>🔬 Módulo 2 de 18 · Laboratorio</Text></View>
      <Text style={styles.title}>El mismo tema, resultados completamente distintos</Text>
      <Text style={styles.subtitle}>Mira cómo el mismo tema produce respuestas radicalmente diferentes según cómo se pregunta.</Text>
      <View style={[styles.card, { backgroundColor: '#fff1f2', marginBottom: 10 }]}>
        <Text style={{ fontWeight: 'bold', color: '#991b1b', marginBottom: 4 }}>❌ Prompt vago</Text>
        <Text style={{ fontFamily: 'monospace', fontSize: 11, backgroundColor: '#fee2e2', padding: 8, borderRadius: 6, marginBottom: 4 }}>"Explícame las fracciones"</Text>
        <Text style={{ fontSize: 11, fontStyle: 'italic', color: '#991b1b' }}>Resultado: definición técnica genérica de 400 palabras en lenguaje académico.</Text>
      </View>
      <View style={[styles.card, { backgroundColor: '#f0fdf4' }]}>
        <Text style={{ fontWeight: 'bold', color: '#166534', marginBottom: 4 }}>✅ Prompt con los 4 ingredientes</Text>
        <Text style={{ fontFamily: 'monospace', fontSize: 11, backgroundColor: '#dcfce7', padding: 8, borderRadius: 6, marginBottom: 4 }}>"Actúa como un profe de matemáticas para 6° grado. Explícame las fracciones usando el ejemplo de una pizza. Máximo 3 párrafos con un ejemplo práctico."</Text>
        <Text style={{ fontSize: 11, fontStyle: 'italic', color: '#166534' }}>Resultado: explicación clara con analogía de pizza y ejercicio para resolver.</Text>
      </View>
    </View>
  );

  const renderTheory2 = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fdf4ff' }]}><Text style={[styles.tagText, { color: '#7e22ce' }]}>📖 Módulo 3 de 18 · Los 4 ingredientes</Text></View>
      <Text style={styles.title}>La fórmula de un prompt poderoso</Text>
      <Text style={styles.subtitle}>Solo 4 ingredientes que, combinados, producen resultados extraordinarios.</Text>
      <View style={[styles.card, { backgroundColor: '#faf5ff' }]}>
        <Text style={[styles.cardTitle, { color: '#5b21b6' }]}>🎭 ROL — ¿Quién debe ser la IA?</Text>
        <Text style={styles.cardText}>"Actúa como..." · "Eres un experto en..." Activa vocabulario, nivel y perspectiva correctos.</Text>
      </View>
      <View style={[styles.card, { backgroundColor: '#eff6ff' }]}>
        <Text style={[styles.cardTitle, { color: '#1e40af' }]}>📋 CONTEXTO — ¿Cuál es la situación?</Text>
        <Text style={styles.cardText}>"Soy estudiante de 9°..." · "Tengo examen mañana..." Sin contexto, la IA inventa su audiencia.</Text>
      </View>
      <View style={[styles.card, { backgroundColor: '#f0fdf4' }]}>
        <Text style={[styles.cardTitle, { color: '#166534' }]}>🎯 INSTRUCCIÓN — ¿Qué debe hacer?</Text>
        <Text style={styles.cardText}>"Explícame..." · "Crea una lista de..." · "Compara..." Verbo + objeto + restricción.</Text>
      </View>
      <View style={[styles.card, { backgroundColor: '#fff7ed' }]}>
        <Text style={[styles.cardTitle, { color: '#c2410c' }]}>📐 FORMATO — ¿Cómo quieres la respuesta?</Text>
        <Text style={styles.cardText}>"En 3 bullets..." · "Con una tabla..." · "Máximo 150 palabras..."</Text>
      </View>
    </View>
  );

  const renderBuilder = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#eff6ff' }]}><Text style={[styles.tagText, { color: '#1e40af' }]}>🧪 Módulo 4 de 18 · Constructor</Text></View>
      <Text style={styles.title}>Arma tu prompt pieza por pieza</Text>
      <Text style={styles.subtitle}>Selecciona una opción en cada sección.</Text>
      
      <BuilderSection label="🎭 ROL" color="#5b21b6" bg="#faf5ff" options={['Como tutor de ciencias para secundaria', 'Como coach de emprendimiento juvenil', 'Como corrector de textos académicos', 'Como programador senior explicando a principiantes']} selected={builderRol} onSelect={setBuilderRol} />
      <BuilderSection label="📋 CONTEXTO" color="#1e40af" bg="#eff6ff" options={['Soy estudiante de 10° y tengo examen en 2 días', 'Tengo 16 años y quiero montar un negocio con $200.000 COP', 'Escribí un ensayo de 3 páginas para español', 'Estoy aprendiendo a programar desde cero']} selected={builderCtx} onSelect={setBuilderCtx} />
      <BuilderSection label="🎯 INSTRUCCIÓN" color="#166534" bg="#f0fdf4" options={['Explícame los conceptos difíciles con ejemplos cotidianos', 'Dame 5 ideas de negocio viables ordenadas por inversión', 'Revisa la redacción y sugiere mejoras sin cambiar mis ideas', 'Enséñame el concepto más importante que debo saber hoy']} selected={builderInst} onSelect={setBuilderInst} />
      <BuilderSection label="📐 FORMATO" color="#c2410c" bg="#fff7ed" options={['En máximo 200 palabras con un ejemplo práctico', 'En formato de lista numerada con pros y contras', 'Señalando errores y explicando por qué lo son', 'Con una analogía de la vida cotidiana']} selected={builderFmt} onSelect={setBuilderFmt} />
      
      <View style={[styles.card, { backgroundColor: builderRol && builderCtx && builderInst && builderFmt ? '#fff7ed' : '#f8fafc', marginTop: 10 }]}>
        <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#94a3b8', marginBottom: 4 }}>Tu prompt ensamblado:</Text>
        <Text style={{ fontSize: 12, color: '#334155', fontFamily: 'monospace', lineHeight: 20 }}>
          {[builderRol, builderCtx, builderInst, builderFmt].filter(Boolean).join(', ') || 'Selecciona las 4 secciones...'}
        </Text>
      </View>
    </View>
  );

  const renderDiagnosis = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fef3c7' }]}><Text style={[styles.tagText, { color: '#92400e' }]}>🎯 Módulo 5 de 18 · Diagnóstico</Text></View>
      <Text style={styles.title}>¿Qué le falta a este prompt?</Text>
      <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#64748b', marginBottom: 8 }}>Prompt {diagCurrent + 1} de {diagItems.length}</Text>
      <View style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, marginBottom: 10 }}>
        <Text style={{ fontFamily: 'monospace', fontSize: 12, color: '#334155' }}>{diagItems[diagCurrent].prompt}</Text>
      </View>
      <Text style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>¿Qué ingredientes le faltan? Selecciona todos. Si está completo, no selecciones ninguno.</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {diagItems[diagCurrent].allOpts.map((opt) => (
          <TouchableOpacity
            key={opt.id}
            style={[styles.ingrBtn, diagAnswers[opt.id] && styles.ingrBtnSel, diagChecked && diagItems[diagCurrent].correct.includes(opt.id) && styles.ingrBtnCorrect]}
            onPress={() => toggleIngr(opt.id)}
            disabled={diagChecked}
          >
            <Text style={{ fontSize: 11, fontWeight: 'bold' }}>{opt.label}</Text>
            <Text style={{ fontSize: 10, color: '#64748b' }}>{opt.text}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderTheory3 = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fdf4ff' }]}><Text style={[styles.tagText, { color: '#7e22ce' }]}>📖 Módulo 6 de 18 · Técnicas avanzadas</Text></View>
      <Text style={styles.title}>Zero-shot, Few-shot y Chain of Thought</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>⚡ Zero-shot — Sin ejemplos</Text>
        <Text style={styles.cardText}>Instrucción directa sin ejemplos previos. Funciona bien para tareas simples.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🎯 Few-shot — Con 2-3 ejemplos</Text>
        <Text style={styles.cardText}>Muestras ejemplos del patrón deseado antes de pedir el tuyo. Ideal para formato y estilo.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🧠 Chain of Thought — Paso a paso</Text>
        <Text style={styles.cardText}>Pides que razone en voz alta antes de responder. Mejora precisión en problemas complejos.</Text>
      </View>
    </View>
  );

  const renderRefinement = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fff1f2' }]}><Text style={[styles.tagText, { color: '#9f1239' }]}>🔁 Módulo 7 de 18 · Refinamiento</Text></View>
      <Text style={styles.title}>Mejora este prompt en 3 rondas</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ fontSize: 11, color: '#64748b' }}>Calidad del prompt</Text>
        <Text style={{ fontSize: 12, fontWeight: 'bold' }}>{refineQuality}%</Text>
      </View>
      <View style={{ height: 10, backgroundColor: '#f1f5f9', borderRadius: 5, overflow: 'hidden' }}>
        <View style={{ height: '100%', width: `${refineQuality}%`, backgroundColor: refineQuality >= 80 ? '#10b981' : refineQuality >= 50 ? '#f59e0b' : '#ef4444', borderRadius: 5 }} />
      </View>
      <View style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, marginVertical: 10 }}>
        <Text style={{ fontSize: 12, fontFamily: 'monospace', color: '#334155' }}>Prompt actual: "{refineScenario.start}"</Text>
      </View>
      {refineDone ? (
        <View style={{ padding: 14, backgroundColor: '#dcfce7', borderRadius: 10 }}>
          <Text style={{ fontWeight: 'bold', color: '#166534' }}>🏆 ¡Proceso completado! Prompt al {refineQuality}% de calidad.</Text>
        </View>
      ) : refineRound < refineScenario.rounds.length ? (
        <View>
          <Text style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 8, backgroundColor: '#f8fafc', padding: 10, borderRadius: 8 }}>
            {refineScenario.rounds[refineRound].question}
          </Text>
          {refineScenario.rounds[refineRound].opts.map((opt, idx) => (
            <TouchableOpacity key={idx} style={[styles.refineOpt]} onPress={() => selectRefineOpt(idx)}>
              <Text style={{ fontSize: 12, color: '#334155' }}>{opt.text}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );

  const renderRoleTheory = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fdf4ff' }]}><Text style={[styles.tagText, { color: '#7e22ce' }]}>📖 Módulo 8 de 18 · Roles</Text></View>
      <Text style={styles.title}>Hablarle a la IA como a un experto</Text>
      <Text style={styles.bodyText}>Cuando asignas un rol a un LLM, activas un modo de respuesta completamente diferente.</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🔄 La misma pregunta, 3 roles distintos</Text>
        <Text style={styles.cardText}>Pregunta: "¿Cómo manejo el estrés?"</Text>
        <Text style={{ fontSize: 11, marginTop: 6 }}>🩺 Psicólogo clínico: respuesta técnica y detallada.</Text>
        <Text style={{ fontSize: 11 }}>🏋️ Coach de bienestar: práctico y accionable.</Text>
        <Text style={{ fontSize: 11 }}>👩‍🏫 Profesora de secundaria: analogía accesible.</Text>
      </View>
    </View>
  );

  const renderRolePicker = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#f5f3ff' }]}><Text style={[styles.tagText, { color: '#5b21b6' }]}>🎭 Módulo 9 de 18 · Role Picker</Text></View>
      <Text style={styles.title}>¿Qué rol le asignarías?</Text>
      {roleItems.map((scenario, si) => (
        <View key={si} style={{ marginBottom: 14, backgroundColor: '#f8fafc', borderRadius: 10, padding: 12 }}>
          <Text style={{ fontWeight: 'bold', fontSize: 12, marginBottom: 6 }}>Situación {si + 1}: {scenario.situation}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {scenario.opts.map((opt, oi) => (
              <TouchableOpacity
                key={oi}
                style={[styles.roleOpt, roleAnswers[si] === oi && styles.roleOptSel, roleChecked && oi === scenario.correct && styles.roleOptCorrect]}
                onPress={() => selectRole(si, oi)}
                disabled={roleChecked}
              >
                <Text style={{ fontSize: 11, fontWeight: '600' }}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
    </View>
  );

  const renderEthics = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#f0fdf4' }]}><Text style={[styles.tagText, { color: '#166534' }]}>⚖️ Módulo 10 de 18 · Juicio ético</Text></View>
      <Text style={styles.title}>¿Este prompt es ético?</Text>
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
        <Text style={{ fontSize: 10, color: '#166534' }}>🟢 Seguro</Text>
        <Text style={{ fontSize: 10, color: '#92400e' }}>🟡 Dudoso</Text>
        <Text style={{ fontSize: 10, color: '#991b1b' }}>🔴 Problemático</Text>
      </View>
      {ethicsItems.map((item, idx) => (
        <View key={idx} style={{ marginBottom: 14 }}>
          <View style={{ backgroundColor: '#f8fafc', borderRadius: 10, padding: 12, marginBottom: 6 }}>
            <Text style={{ fontFamily: 'monospace', fontSize: 11, color: '#334155' }}>{item.prompt}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity style={[styles.ethicsBtn, ethicsAnswers[idx] === 'safe' && styles.ethicsBtnSel, ethicsChecked && item.correct === 'safe' && styles.ethicsBtnCorrect]} onPress={() => selectEthics(idx, 'safe')} disabled={ethicsChecked}><Text style={{ fontSize: 18 }}>🟢</Text><Text style={{ fontSize: 9 }}>Seguro</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.ethicsBtn, ethicsAnswers[idx] === 'doubt' && styles.ethicsBtnSel, ethicsChecked && item.correct === 'doubt' && styles.ethicsBtnCorrect]} onPress={() => selectEthics(idx, 'doubt')} disabled={ethicsChecked}><Text style={{ fontSize: 18 }}>🟡</Text><Text style={{ fontSize: 9 }}>Dudoso</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.ethicsBtn, ethicsAnswers[idx] === 'prob' && styles.ethicsBtnSel, ethicsChecked && item.correct === 'prob' && styles.ethicsBtnCorrect]} onPress={() => selectEthics(idx, 'prob')} disabled={ethicsChecked}><Text style={{ fontSize: 18 }}>🔴</Text><Text style={{ fontSize: 9 }}>Problemático</Text></TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );

  const renderStudyTheory = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fdf4ff' }]}><Text style={[styles.tagText, { color: '#7e22ce' }]}>📖 Módulo 11 de 18 · Prompts para estudiar</Text></View>
      <Text style={styles.title}>La fórmula que cambia cómo estudias</Text>
      <View style={styles.highlightOrange}>
        <Text style={styles.highlightText}><Text style={{ fontWeight: 'bold' }}>🎓 El error #1:</Text> Pedirle a la IA que haga el trabajo por ti en lugar de pedirle que te enseñe.</Text>
      </View>
      <View style={styles.card}><Text style={styles.cardTitle}>❓ El Interrogador</Text><Text style={styles.cardText}>"Hazme 10 preguntas de práctica sobre [tema], de menor a mayor dificultad."</Text></View>
      <View style={styles.card}><Text style={styles.cardTitle}>🔍 El Simplificador</Text><Text style={styles.cardText}>"Explícame [concepto] como si tuviera [edad] años, usando una analogía."</Text></View>
      <View style={styles.card}><Text style={styles.cardTitle}>⚡ El Desafiador</Text><Text style={styles.cardText}>"Dame el escenario más difícil posible de [tema] y dame pistas si me trabo."</Text></View>
    </View>
  );

  const renderMission = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fdf2f8' }]}><Text style={[styles.tagText, { color: '#9d174d' }]}>🏗️ Módulo 12 de 18 · Misión</Text></View>
      <Text style={styles.title}>Construye 3 prompts de estudio reales</Text>
      {MISSION_SUBJECTS.map((sub, si) => (
        <View key={si} style={[styles.card, { marginBottom: 12 }]}>
          <Text style={styles.cardTitle}>{sub.emoji} {sub.name}</Text>
          <Text style={styles.cardText}>{sub.desc}</Text>
          {sub.fields.map((field, fi) => (
            <View key={fi} style={{ marginBottom: 8 }}>
              <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#374151', marginBottom: 4 }}>{field}</Text>
              <TextInput
                style={styles.missionInput}
                placeholder="Escribe aquí..."
                onChangeText={(val) => updateMissionField(si, fi, val)}
              />
            </View>
          ))}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <View style={{ flex: 1, height: 6, backgroundColor: '#f1f5f9', borderRadius: 3 }}>
              <View style={{ height: '100%', width: `${Math.round((Object.values(missionData[si] || {}).filter(v => v?.length > 2).length / sub.fields.length) * 100)}%`, backgroundColor: '#f97316', borderRadius: 3 }} />
            </View>
            <Text style={{ fontSize: 11, color: '#c2410c' }}>{Math.round((Object.values(missionData[si] || {}).filter(v => v?.length > 2).length / sub.fields.length) * 100)}%</Text>
          </View>
        </View>
      ))}
    </View>
  );

  const renderDetective = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#f0f9ff' }]}><Text style={[styles.tagText, { color: '#0369a1' }]}>🔍 Módulo 13 de 18 · Detective</Text></View>
      <Text style={styles.title}>Encuentra el error en el prompt</Text>
      {detectItems.map((item, di) => (
        <View key={di} style={{ marginBottom: 16 }}>
          <View style={{ backgroundColor: '#fffbeb', borderRadius: 10, padding: 12, marginBottom: 6 }}>
            <Text style={{ fontSize: 11, fontFamily: 'monospace' }}>Prompt: {item.prompt}</Text>
            <Text style={{ fontSize: 10, color: '#9a3412', marginTop: 4 }}>Resultado: "{item.response}"</Text>
          </View>
          <Text style={{ fontWeight: 'bold', fontSize: 12, padding: 10, backgroundColor: '#f8fafc', borderRadius: 8, marginBottom: 6 }}>{item.question}</Text>
          {item.opts.map((opt, oi) => (
            <TouchableOpacity
              key={oi}
              style={[styles.detectOpt, detectAnswers[di] === oi && styles.detectOptSel, detectChecked && oi === item.correct && styles.detectOptCorrect]}
              onPress={() => selectDetect(di, oi)}
              disabled={detectChecked}
            >
              <Text style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: '#f1f5f9', textAlign: 'center', lineHeight: 22, fontSize: 11, fontWeight: 'bold' }}>{String.fromCharCode(65 + oi)}</Text>
              <Text style={{ flex: 1, fontSize: 12, color: '#334155' }}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );

  const renderSprint = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fef9c3' }]}><Text style={[styles.tagText, { color: '#713f12' }]}>⚡ Módulo 14 de 18 · Sprint</Text></View>
      <Text style={styles.title}>Prompt Sprint — ¡Rápido!</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 10, backgroundColor: '#f8fafc', borderRadius: 10, marginBottom: 8 }}>
        <Text style={{ fontSize: 10, color: '#64748b' }}>Aciertos: <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#0f172a' }}>{sprintCorrect}/{sprintItems.length}</Text></Text>
        <Text style={{ fontSize: 10, color: '#64748b' }}>Pregunta: <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#0f172a' }}>{sprintIdx + 1}/{sprintItems.length}</Text></Text>
        <Text style={{ fontSize: 10, color: '#64748b' }}>Tiempo: <Text style={{ fontWeight: 'bold', fontSize: 24, color: sprintTimeLeft <= 10 ? '#ef4444' : '#0f172a' }}>{sprintTimeLeft}</Text></Text>
      </View>
      <View style={{ height: 6, backgroundColor: '#f1f5f9', borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}>
        <View style={{ height: '100%', width: `${(sprintTimeLeft / 60) * 100}%`, backgroundColor: '#10b981', borderRadius: 3 }} />
      </View>
      {sprintDone ? (
        <View style={{ padding: 14, backgroundColor: '#dcfce7', borderRadius: 10 }}>
          <Text style={{ fontWeight: 'bold', color: '#166534' }}>🏆 Sprint completado: {sprintCorrect}/{sprintItems.length} correctas.</Text>
        </View>
      ) : (
        <View>
          <Text style={{ fontWeight: 'bold', fontSize: 13, padding: 12, backgroundColor: '#f8fafc', borderRadius: 10, marginBottom: 10 }}>{sprintItems[sprintIdx].situation}</Text>
          {sprintItems[sprintIdx].opts.map((opt, idx) => (
            <TouchableOpacity key={idx} style={styles.sprintOpt} onPress={() => selectSprintOpt(idx)} disabled={sprintAnswered}>
              <Text style={{ fontSize: 12, fontFamily: 'monospace', color: '#334155' }}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  const renderSort = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#ecfeff' }]}><Text style={[styles.tagText, { color: '#164e63' }]}>↕️ Módulo 15 de 18 · Ordenar</Text></View>
      <Text style={styles.title}>Del prompt vago a la respuesta inútil</Text>
      <Text style={styles.subtitle}>Ordena los pasos de cómo un mal prompt produce un resultado frustrante.</Text>
      {sortOrder.map((stepIdx, pos) => (
        <View key={pos} style={styles.sortItem}>
          <Text style={styles.sortNum}>{pos + 1}</Text>
          <Text style={styles.sortText}>{SORT_CAUSE_EFFECT[stepIdx]}</Text>
          <View style={styles.sortArrows}>
            <TouchableOpacity style={styles.sortBtn} onPress={() => moveSort(pos, -1)} disabled={pos === 0}>
              <MaterialIcons name="keyboard-arrow-up" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.sortBtn} onPress={() => moveSort(pos, 1)} disabled={pos === sortOrder.length - 1}>
              <MaterialIcons name="keyboard-arrow-down" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );

  const renderProjectsTheory = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fdf4ff' }]}><Text style={[styles.tagText, { color: '#7e22ce' }]}>📖 Módulo 16 de 18 · Prompts para proyectos</Text></View>
      <Text style={styles.title}>Prompts para crear con IA</Text>
      <Text style={styles.subtitle}>Usar la IA como co-creador de aplicaciones, diseños, negocios y proyectos reales.</Text>
      <View style={styles.card}><Text style={styles.cardTitle}>🛠️ Crear una app</Text><Text style={[styles.cardText, { fontFamily: 'monospace' }]}>"Crea una app web de lista de tareas para estudiantes. Con fecha límite, marcar completadas y filtrar por materia."</Text></View>
      <View style={styles.card}><Text style={styles.cardTitle}>🤖 Agente IA</Text><Text style={[styles.cardText, { fontFamily: 'monospace' }]}>"Actúa como asistente de estudio que guía paso a paso. Pregunta nombre, grado y materia. Crea plan personalizado."</Text></View>
    </View>
  );

  const renderTF = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fff7ed' }]}><Text style={[styles.tagText, { color: '#9a3412' }]}>✅ Módulo 17 de 18 · Verdadero o Falso</Text></View>
      <Text style={styles.title}>Mitos del prompting</Text>
      {tfItems.map((item, idx) => (
        <View key={idx} style={{ marginBottom: 14 }}>
          <Text style={styles.tfQuestion}>{idx + 1}. {item.stmt}</Text>
          <View style={{ flexDirection: 'row', gap: 7 }}>
            <TouchableOpacity style={[styles.tfBtn, tfAnswers[idx] === true && styles.tfBtnTrue]} onPress={() => selectTF(idx, true)} disabled={tfChecked}>
              <Text style={{ fontWeight: 'bold' }}>✅ Verdadero</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tfBtn, tfAnswers[idx] === false && styles.tfBtnFalse]} onPress={() => selectTF(idx, false)} disabled={tfChecked}>
              <Text style={{ fontWeight: 'bold' }}>❌ Falso</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );

  const renderReflect = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#f8fafc' }]}><Text style={[styles.tagText, { color: '#475569' }]}>✍️ Módulo 18 de 18 · Reflexión</Text></View>
      <Text style={styles.title}>Tu prompt más importante</Text>
      <Text style={styles.subtitle}>Escribe el prompt que usarías esta semana para una tarea real. Incluye los 4 ingredientes y explica por qué lo estructuraste así.</Text>
      <TextInput style={styles.textArea} multiline numberOfLines={6} placeholder="Escribe tu reflexión (mínimo 80 caracteres)..." value={reflectText} onChangeText={setReflectText} />
      <Text style={{ fontSize: 11, color: '#94a3b8', textAlign: 'right', marginTop: 4 }}>{reflectText.trim().length} / 80 mínimo</Text>
    </View>
  );

  const renderCompletion = () => (
    <View style={{ alignItems: 'center', padding: 20 }}>
      <Text style={{ fontSize: 44, marginBottom: 14 }}>🏆</Text>
      <Text style={[styles.title, { textAlign: 'center' }]}>¡Nivel 3 completado!</Text>
      <Text style={[styles.subtitle, { textAlign: 'center' }]}>Terminaste "El Arte del Prompting". Ahora sabes comunicarte con IA de forma efectiva, ética y estratégica.</Text>
      <Text style={{ fontWeight: 'bold', fontSize: 15, color: '#92400e', marginBottom: 14 }}>⭐ {xp} XP ganados en este nivel</Text>
      <View style={[styles.card, { width: '100%' }]}>
        <Text style={{ fontSize: 11, color: '#9a3412' }}>✓ Construyo prompts con los 4 ingredientes</Text>
        <Text style={{ fontSize: 11, color: '#9a3412' }}>✓ Aplico técnicas Zero-shot, Few-shot y Chain of Thought</Text>
        <Text style={{ fontSize: 11, color: '#9a3412' }}>✓ Diagnostico qué le falta a un prompt</Text>
        <Text style={{ fontSize: 11, color: '#9a3412' }}>✓ Evalúo si un prompt es ético</Text>
      </View>
      <TouchableOpacity style={styles.finishButton} onPress={handleFinish}>
        <Text style={{ fontWeight: 'bold', color: '#fff' }}>Volver al mapa</Text>
      </TouchableOpacity>
    </View>
  );

  // ============ RENDER PRINCIPAL ============
  const renderStepContent = () => {
    switch (step) {
      case 0: return renderIntro();
      case 1: return renderTheory1();
      case 2: return renderLab();
      case 3: return renderTheory2();
      case 4: return renderBuilder();
      case 5: return renderDiagnosis();
      case 6: return renderTheory3();
      case 7: return renderRefinement();
      case 8: return renderRoleTheory();
      case 9: return renderRolePicker();
      case 10: return renderEthics();
      case 11: return renderStudyTheory();
      case 12: return renderMission();
      case 13: return renderDetective();
      case 14: return renderSprint();
      case 15: return renderSort();
      case 16: return renderProjectsTheory();
      case 17: return renderTF();
      case 18: return renderReflect();
      case 19: return renderCompletion();
      default: return null;
    }
  };

  const progressPercent = (step / (TOTAL_STEPS - 1)) * 100;

  const handleMainBtn = () => {
    const stepHandlers: Record<number, (() => boolean) | undefined> = {
      4: checkBuilder,
      5: checkDiag,
      7: () => refineDone,
      9: checkRole,
      10: checkEthics,
      12: checkMission,
      13: checkDetect,
      14: () => sprintDone,
      15: checkSort,
      17: checkTF,
      18: checkReflect,
    };
    const handler = stepHandlers[step];
    if (handler) {
      if (!handler()) return;
    }
    goToNextStep();
  };

  const showNextBtn = step < TOTAL_STEPS - 1 && ![4, 5, 7, 9, 10, 12, 13, 14, 15, 17, 18].includes(step);
  const showCheckBtn = [4, 5, 7, 9, 10, 12, 13, 14, 15, 17, 18].includes(step) && step < TOTAL_STEPS - 1;

  return (
    <View style={styles.screen}>
      <View style={styles.progressBar}>
        <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
          <MaterialIcons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>
        <Text style={styles.xpText}>{xp} XP</Text>
      </View>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {renderStepContent()}
      </ScrollView>
      {showNextBtn && (
        <TouchableOpacity style={styles.nextButton} onPress={goToNextStep}>
          <Text style={styles.nextButtonText}>Continuar →</Text>
        </TouchableOpacity>
      )}
      {showCheckBtn && (
        <TouchableOpacity style={styles.nextButton} onPress={handleMainBtn}>
          <Text style={styles.nextButtonText}>
            {[5, 7, 9, 10, 13, 17].includes(step) ? 'Verificar' : [14].includes(step) ? 'Siguiente →' : [18].includes(step) ? 'Enviar reflexión →' : 'Continuar →'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ===================== COMPONENTE BUILDER SECTION =====================
function BuilderSection({ label, color, bg, options, selected, onSelect }: {
  label: string; color: string; bg: string; options: string[]; selected: string; onSelect: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 }}>
        <View style={{ backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
          <Text style={{ fontSize: 9, fontWeight: 'bold', color }}>{label}</Text>
        </View>
      </View>
      <TouchableOpacity style={[styles.builderSelect, selected ? { borderColor: '#f97316', backgroundColor: '#fff7ed' } : {}]} onPress={() => setOpen(!open)}>
        <Text style={{ fontSize: 12, color: selected ? '#334155' : '#94a3b8' }}>{selected || '— Elige una opción —'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={{ backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginTop: 4, padding: 8 }}>
          {options.map((opt, idx) => (
            <TouchableOpacity
              key={idx}
              style={{ padding: 10, borderRadius: 8, backgroundColor: selected === opt ? bg : '#fff' }}
              onPress={() => { onSelect(opt); setOpen(false); }}
            >
              <Text style={{ fontSize: 12, color: '#334155' }}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ===================== ESTILOS =====================
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  progressBar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  closeBtn: { padding: 4 },
  progressTrack: { flex: 1, height: 6, backgroundColor: colors.borderLight, borderRadius: 3, marginHorizontal: 12 },
  progressFill: { height: '100%', backgroundColor: colors.success, borderRadius: 3 },
  xpText: { ...typography.bold, fontSize: 14, color: '#92400e' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  tag: { backgroundColor: '#fff7ed', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 12 },
  tagText: { fontSize: 10, fontWeight: 'bold', color: '#c2410c', textTransform: 'uppercase', letterSpacing: 1 },
  iconCircle: { width: 60, height: 60, borderRadius: 18, backgroundColor: '#fff7ed', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  title: { ...typography.extraBold, fontSize: 19, color: colors.textPrimary, marginBottom: 6 },
  subtitle: { ...typography.regular, fontSize: 13, color: colors.textSecondary, marginBottom: 14, lineHeight: 18 },
  bodyText: { ...typography.regular, fontSize: 13, color: colors.textPrimary, lineHeight: 20, marginBottom: 12 },
  sectionTitle: { ...typography.bold, fontSize: 14, color: colors.textPrimary, marginTop: 16, marginBottom: 8 },
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  cardTitle: { ...typography.bold, fontSize: 13, color: colors.textPrimary, marginBottom: 6 },
  cardText: { ...typography.regular, fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
  highlightOrange: { borderLeftWidth: 3, borderLeftColor: '#f97316', backgroundColor: '#fff7ed', padding: 11, marginVertical: 10, borderRadius: 4 },
  highlightText: { fontSize: 13, color: '#c2410c', lineHeight: 20 },
  nextButton: { backgroundColor: colors.success, padding: 14, margin: 16, borderRadius: 11, alignItems: 'center' },
  nextButtonText: { ...typography.bold, color: '#fff', fontSize: 15 },
  builderSelect: { borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, padding: 10, backgroundColor: '#fff' },
  ingrBtn: { padding: 8, borderRadius: 10, borderWidth: 2, borderColor: '#e2e8f0', width: '48%', marginBottom: 6 },
  ingrBtnSel: { borderColor: '#f97316', backgroundColor: '#fff7ed' },
  ingrBtnCorrect: { borderColor: '#10b981', backgroundColor: '#dcfce7' },
  refineOpt: { padding: 11, borderRadius: 11, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#fff', marginBottom: 6 },
  roleOpt: { padding: 6, paddingHorizontal: 10, borderRadius: 16, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  roleOptSel: { borderColor: '#8b5cf6', backgroundColor: '#faf5ff' },
  roleOptCorrect: { borderColor: '#10b981', backgroundColor: '#dcfce7' },
  ethicsBtn: { flex: 1, padding: 10, borderRadius: 11, borderWidth: 2, borderColor: '#e2e8f0', backgroundColor: '#fff', alignItems: 'center', minHeight: 50, justifyContent: 'center' },
  ethicsBtnSel: { borderColor: '#f59e0b' },
  ethicsBtnCorrect: { backgroundColor: '#dcfce7', borderColor: '#10b981' },
  missionInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 9, padding: 9, fontSize: 12, backgroundColor: '#f8fafc', color: '#334155' },
  detectOpt: { flexDirection: 'row', alignItems: 'center', padding: 10, borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, marginBottom: 6, gap: 9 },
  detectOptSel: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
  detectOptCorrect: { borderColor: '#10b981', backgroundColor: '#dcfce7' },
  sprintOpt: { padding: 11, borderRadius: 10, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#fff', marginBottom: 7 },
  sortItem: { flexDirection: 'row', alignItems: 'center', padding: 11, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  sortNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, textAlign: 'center', lineHeight: 26, color: '#fff', fontWeight: 'bold', fontSize: 11, marginRight: 9 },
  sortText: { flex: 1, fontSize: 12, color: colors.textPrimary },
  sortArrows: { flexDirection: 'column', gap: 3 },
  sortBtn: { width: 28, height: 26, borderRadius: 7, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  tfQuestion: { ...typography.bold, fontSize: 13, color: colors.textPrimary, padding: 11, backgroundColor: '#f8fafc', borderRadius: 10, marginBottom: 8 },
  tfBtn: { flex: 1, padding: 12, borderRadius: 11, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center' },
  tfBtnTrue: { borderColor: colors.success, backgroundColor: '#f0fdf4' },
  tfBtnFalse: { borderColor: colors.error, backgroundColor: '#fff1f2' },
  textArea: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 13, color: '#334155', textAlignVertical: 'top', minHeight: 100, backgroundColor: '#fafafa' },
  finishButton: { backgroundColor: colors.primary, padding: 14, borderRadius: 11, width: '100%', alignItems: 'center', marginTop: 14 },
});