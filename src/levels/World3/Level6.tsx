// src/levels/World3/Level6.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Vibration,
  Platform,
} from 'react-native';
import { useGameStore } from '../../store/gameStore';
import { colors, typography } from '../../theme';

// ─── TIPOS DE MÓDULO ──────────────────────────────────────
interface BaseModule {
  type: 'theory' | 'quiz' | 'matching' | 'builder' | 'sort' | 'dragdrop' | 'sprint' | 'vf' | 'completion';
  title: string;
  xp: number;
}

interface TheoryModule extends BaseModule {
  type: 'theory';
  render: () => React.ReactElement;
}

interface QuizModule extends BaseModule {
  type: 'quiz';
  question: string;
  options: string[];
  correct: number;
  feedback: string;
}

interface MatchingModule extends BaseModule {
  type: 'matching';
  pairs: { left: string; right: string }[];
}

interface BuilderModule extends BaseModule {
  type: 'builder';
  placeholder: string;
  contentText?: string;
}

interface SortModule extends BaseModule {
  type: 'sort';
  instruction: string;
  correctOrder: string[];
}

interface DragDropModule extends BaseModule {
  type: 'dragdrop';
  instruction: string;
  zones: string[];
  items: { id: string; text: string }[];
  correct: Record<string, number>;
}

interface SprintModule extends BaseModule {
  type: 'sprint';
  duration: number;
  instruction: string;
  placeholder: string;
}

interface VFModule extends BaseModule {
  type: 'vf';
  statements: { text: string; correct: boolean; feedback: string }[];
}

type Module = TheoryModule | QuizModule | MatchingModule | BuilderModule | SortModule | DragDropModule | SprintModule | VFModule | { type: 'completion'; title: string; xp: number };

// ─── MÓDULOS (datos) ──────────────────────────────────────
const MODULES: Module[] = [
  // 0 INTRO (theory)
  {
    type: 'theory', title: 'Introducción', xp: 0,
    render: () => (
      <>
        <ModuleType icon="🔗" label="Introducción" />
        <ModuleTitle>¿Qué significa multimodal?</ModuleTitle>
        <BodyText>
          Imagina un asistente que puede ver lo que le muestras, escuchar lo que le dices, leer lo que le escribes y responderte con texto, voz o generando imágenes — todo en la misma conversación. <Bold>Eso es una IA multimodal</Bold>.
        </BodyText>
        <BodyText>
          Hasta hace poco, las IAs eran especializadas: una para texto, otra para imágenes, otra para voz. Ahora los modelos más avanzados como GPT-4o, Gemini 2.0 y Claude 3.5 pueden manejar múltiples "modalidades" simultáneamente.
        </BodyText>
        <View style={[styles.flowRow, { marginVertical: 16 }]}>
          <FlowNode text="📝 Texto" />
          <Text style={styles.flowArrow}>+</Text>
          <FlowNode text="🖼️ Imagen" />
          <Text style={styles.flowArrow}>+</Text>
          <FlowNode text="🎵 Audio" />
          <Text style={styles.flowArrow}>+</Text>
          <FlowNode text="🎬 Video" />
          <Text style={styles.flowArrow}>→</Text>
          <FlowNode text="🤖 Una sola IA" style={{ borderColor: '#22c55e' }} textColor="#86efac" />
        </View>
        <InfoBox>
          <Bold>Analogía:</Bold> Es como la diferencia entre hablar con un especialista (un médico que solo sabe de huesos) y hablar con un médico general (que puede evaluar todo tu cuerpo y conectar síntomas de diferentes sistemas). La IA multimodal es el médico general.
        </InfoBox>
      </>
    ),
  },
  // 1 THEORY: GPT-4o
  {
    type: 'theory', title: 'GPT-4o en acción', xp: 10,
    render: () => (
      <>
        <ModuleType icon="⚡" label="Casos reales" />
        <ModuleTitle>GPT-4o: el modelo que lo ve y oye todo</ModuleTitle>
        <BodyText>
          En mayo de 2024, OpenAI presentó <Bold>GPT-4o</Bold> (la "o" es de "omni", que significa "todo"). En la demo en vivo, mostraron algo nunca visto:
        </BodyText>
        <BodyText>
          Un investigador sostenía una cámara en vivo. Le pedía a GPT-4o que describiera lo que veía. La IA veía el ambiente en tiempo real, respondía con voz natural, reía cuando el investigador contaba un chiste, y ajustaba el tono de su voz según la emoción de la conversación.
        </BodyText>
        <InfoBox>
          <Bold>Lo que cambió:</Bold> Antes, una IA de voz tardaba ~3 segundos en responder (transcribía, procesaba, sintetizaba). GPT-4o responde en menos de 0.3 segundos — tan rápido como un humano en conversación normal. Eso cambia todo sobre cómo interactuamos con la IA.
        </InfoBox>
      </>
    ),
  },
  // 2 MATCHING
  {
    type: 'matching', title: 'Capacidades multimodales', xp: 15,
    pairs: [
      { left: '⚡ GPT-4o', right: 'Texto + imagen + audio en tiempo real, voice mode con emociones' },
      { left: '✦ Gemini 2.0', right: 'Texto + imagen + audio + video nativo, integrado con Google' },
      { left: '🔗 Claude 3.5', right: 'Texto + imagen, análisis profundo de documentos y código' },
      { left: '🌑 Grok 2', right: 'Texto + imagen, acceso a datos en tiempo real de X/Twitter' },
    ],
  },
  // 3 BUILDER (analiza imagen)
  {
    type: 'builder', title: 'Analiza una imagen', xp: 15,
    placeholder: 'Escribe el prompt para las situaciones B y C...',
    contentText: 'Una de las capacidades más útiles de la IA multimodal es analizar imágenes que tú le proporcionas. Diseña el prompt para estas situaciones:\n\n📸 Situación A: Le muestras una foto de una planta enferma de tu jardín\n📸 Situación B: Le muestras un ejercicio de matemáticas que no entiendes\n📸 Situación C: Le muestras una captura de pantalla de un error en tu computadora\n\nEjemplo para A: "En esta imagen hay una planta de tomate. Las hojas tienen manchas amarillas en los bordes y el tallo se ve delgado. ¿Qué enfermedad o deficiencia podría ser? ¿Qué debo hacer para salvarla?"',
  },
  // 4 THEORY: pipeline multimodal
  {
    type: 'theory', title: 'El pipeline multimodal', xp: 10,
    render: () => (
      <>
        <ModuleType icon="🔄" label="Teoría" />
        <ModuleTitle>Cómo se conectan los modos</ModuleTitle>
        <BodyText>
          Un <Bold>pipeline multimodal</Bold> es un flujo de trabajo donde varios tipos de entrada y salida de IA se conectan en secuencia. Cada paso usa la salida del anterior como entrada.
        </BodyText>
        <InfoBox>
          <Bold>Ejemplo de pipeline para un proyecto de historia:</Bold>{'\n'}
          1. Tomas una foto de tu libro de texto → IA lee el texto de la imagen (OCR){'\n'}
          2. Le pides a la IA que resuma el capítulo → Genera texto{'\n'}
          3. Le pides que genere imágenes históricas de ese período → DALL-E crea visualizaciones{'\n'}
          4. Le pides que narre el resumen con voz → ElevenLabs genera el audio{'\n'}
          5. Combinas imágenes + audio → Video explicativo de 2 minutos
        </InfoBox>
        <BodyText>Lo que antes habría tomado horas de trabajo manual, ahora puede hacerse en minutos con el pipeline correcto. <Bold>El arquitecto del pipeline eres tú</Bold> — la IA es quien ejecuta cada paso.</BodyText>
      </>
    ),
  },
  // 5 SORT: el pipeline completo
  {
    type: 'sort', title: 'Ordena el pipeline', xp: 15,
    instruction: 'Ordena los pasos de un pipeline para crear un video de noticias con IA:',
    correctOrder: [
      'Recopilar la información del evento en texto (noticias, fuentes)',
      'Usar IA para generar el guión del noticiero en formato de presentador',
      'Generar imágenes o clips de video con IA para ilustrar la noticia',
      'Clonar la voz del presentador con ElevenLabs y narrar el guión',
      'Combinar video + audio + subtítulos en el editor final y publicar',
    ],
  },
  // 6 QUIZ: voice mode
  {
    type: 'quiz', title: 'Voice mode en ChatGPT', xp: 15,
    question: 'Kenji está en Tokio y quiere practicar inglés de conversación. No quiere escribir — quiere hablar directamente y recibir corrección en tiempo real. ¿Qué capacidad de GPT-4o le sería más útil?',
    options: [
      'El modo de generación de imágenes — para visualizar vocabulario',
      'El Voice Mode — para hablar directamente y recibir respuestas habladas con correcciones en tiempo real',
      'El modo de análisis de documentos — para subir textos en inglés',
      'El modo de código — para programar en inglés',
    ],
    correct: 1,
    feedback: '¡Exacto! El Voice Mode de GPT-4o permite conversación de voz fluida, con latencia tan baja que se siente como hablar con un humano. Para práctica de idiomas en tiempo real, es revolucionario. Kenji puede hablar en inglés y recibir correcciones inmediatas.',
  },
  // 7 BUILDER: lee documentos
  {
    type: 'builder', title: 'IA que lee PDFs', xp: 15,
    placeholder: 'Escribe el prompt para analizar el reglamento escolar...',
    contentText: 'Una capacidad multimodal muy útil para estudiantes: subir un PDF largo y hacer preguntas específicas. Diseña el prompt para estas situaciones:\n\n📚 Tienes un libro de historia de 300 páginas y un examen mañana.\n📜 Tienes el reglamento escolar en PDF y quieres saber tus derechos.\n🔬 Tienes un artículo científico en inglés y necesitas entenderlo en español.\n\nEjemplo — libro de historia: "Te subo el capítulo 7 de mi libro de historia. Quiero que: 1) Hagas un resumen de los 5 eventos más importantes, 2) Crees 10 preguntas de examen con sus respuestas, 3) Expliques qué causó la guerra mencionada en la página 4 en términos simples para alguien de 12 años."',
  },
  // 8 THEORY: Gemini Live
  {
    type: 'theory', title: 'Gemini 2.0 Multimodal', xp: 10,
    render: () => (
      <>
        <ModuleType icon="✦" label="Casos reales" />
        <ModuleTitle>Gemini Live: la IA que ve tu pantalla</ModuleTitle>
        <BodyText>
          <Bold>Gemini 2.0</Bold> de Google lleva la multimodalidad a otro nivel. Con <Bold>Gemini Live</Bold>, puedes:
        </BodyText>
        <InfoBox>
          📱 <Bold>Compartir tu pantalla:</Bold> Gemini ve en tiempo real lo que estás haciendo en tu teléfono y puede ayudarte a navegar, encontrar información o resolver problemas.{'\n'}
          📷 <Bold>Activar la cámara:</Bold> Apunta tu cámara a cualquier objeto y Gemini lo identifica, explica su historia, da información nutricional (si es comida) o traduce texto en tiempo real.{'\n'}
          🌍 <Bold>Traducción en vivo:</Bold> Puedes hablar en español mientras Gemini traduce en tiempo real a cualquier idioma.
        </InfoBox>
        <InfoBox>
          <Bold>Caso de uso real:</Bold> Un estudiante de Bogotá está en un mercado en China. No habla mandarín. Activa Gemini Live, apunta la cámara a los letreros y Gemini le lee y traduce todo en tiempo real mientras él camina. ¡La barrera del idioma desaparece!
        </InfoBox>
      </>
    ),
  },
  // 9 VF
  {
    type: 'vf', title: '¿Qué puede y qué no?', xp: 15,
    statements: [
      { text: 'Una IA multimodal puede ver una imagen y entender perfectamente las emociones de todas las personas en ella.', correct: false, feedback: 'FALSO. Las IAs multimodales pueden detectar expresiones faciales, pero interpretarlas con precisión es difícil y propenso a errores. También existe el riesgo de sesgo según el origen étnico o cultural de las personas.' },
      { text: 'Con GPT-4o en voice mode, puedo tener una conversación de voz en tiempo real sobre cualquier tema.', correct: true, feedback: 'VERDADERO. GPT-4o Voice Mode permite conversación fluida sobre prácticamente cualquier tema, con latencia muy baja. Tiene restricciones sobre ciertos contenidos inapropiados, pero el rango temático es muy amplio.' },
      { text: 'Si le muestro a una IA multimodal una foto de mi habitación, ella puede recordarla en futuras conversaciones.', correct: false, feedback: 'FALSO. Las IAs actuales no tienen memoria persistente entre conversaciones por defecto. Cada nueva conversación comienza desde cero. Lo que ves en una sesión, no lo "recuerda" en la siguiente.' },
    ],
  },
  // 10 QUIZ: texto+código+imagen juntos
  {
    type: 'quiz', title: 'La combinación perfecta', xp: 15,
    question: 'Amara en Ghana tiene una planta de cacao que parece enferma. Quiere identificar qué tiene y cuánto cuesta el tratamiento. ¿Qué combinación multimodal sería la más útil?',
    options: [
      'Solo texto: describir la planta con palabras y esperar que la IA lo adivine',
      'Solo imagen: subir la foto sin ningún contexto adicional',
      'Imagen + texto: subir la foto de la planta Y explicar síntomas, región, temperatura local y tamaño del cultivo para un diagnóstico preciso',
      'Audio: grabar el sonido del viento alrededor de la planta',
    ],
    correct: 2,
    feedback: '¡Exacto! La combinación imagen + texto contextual siempre da mejores resultados que cualquiera solo. La foto muestra los síntomas visuales; el texto da el contexto que la imagen no puede mostrar (temperatura, región, tiempo de síntomas). Juntos, la IA puede dar un diagnóstico mucho más preciso.',
  },
  // 11 SPRINT
  {
    type: 'sprint', title: 'Sprint multimodal', xp: 20,
    duration: 90,
    instruction: '⚡ ¡90 segundos! Diseña un proyecto que use AL MENOS 3 modalidades diferentes de IA. Describe: qué entra, qué procesa, qué sale.',
    placeholder: 'Mi proyecto se llama: ...\nEntrada: (texto + imagen + audio + video)\nProceso: (qué hace la IA con cada modalidad)\nSalida final: ...',
  },
  // 12 THEORY: accesibilidad
  {
    type: 'theory', title: 'IA multimodal y accesibilidad', xp: 10,
    render: () => (
      <>
        <ModuleType icon="♿" label="Impacto real" />
        <ModuleTitle>La IA que describe el mundo</ModuleTitle>
        <BodyText>Uno de los usos más hermosos de la IA multimodal es en accesibilidad para personas con discapacidades:</BodyText>
        <InfoBox>
          👁️ <Bold>Discapacidad visual:</Bold> Be My Eyes + GPT-4o permite que personas ciegas apunten su cámara a cualquier cosa y reciban una descripción detallada en voz.{'\n'}
          👂 <Bold>Discapacidad auditiva:</Bold> La transcripción en tiempo real convierte cualquier audio o video en subtítulos instantáneos, con identificación de quién habla.{'\n'}
          🗣️ <Bold>Discapacidad del habla:</Bold> Interfaces que permiten comunicarse por imagen o texto y que la IA "hable" por la persona con su propia voz clonada.
        </InfoBox>
        <InfoBox>
          <Bold>Impacto real:</Bold> Be My Eyes reportó que después de integrar GPT-4o, el número de personas ciegas que pueden navegar independientemente en ambientes desconocidos aumentó significativamente. La IA multimodal literalmente devuelve autonomía.
        </InfoBox>
      </>
    ),
  },
  // 13 DRAG DROP
  {
    type: 'dragdrop', title: '¿Necesita multimodalidad?', xp: 15,
    instruction: 'Clasifica estas tareas: ¿necesitan múltiples modalidades o solo texto es suficiente?',
    zones: ['🔗 Necesita múltiples modalidades', '💬 Solo texto es suficiente'],
    items: [
      { id: 'a', text: 'Identificar qué planta aparece en una fotografía' },
      { id: 'b', text: 'Preguntar cuándo fue la Revolución Francesa' },
      { id: 'c', text: 'Traducir en tiempo real lo que dice alguien hablando en chino' },
      { id: 'd', text: 'Pedir que la IA escriba un poema sobre el otoño' },
      { id: 'e', text: 'Analizar el estado de daño de un auto en una foto de accidente' },
      { id: 'f', text: 'Preguntar cuánto es 245 dividido entre 7' },
    ],
    correct: { a: 0, b: 1, c: 0, d: 1, e: 0, f: 1 },
  },
  // 14 QUIZ: privacidad
  {
    type: 'quiz', title: 'Privacidad y multimodalidad', xp: 15,
    question: 'Sofia está considerando usar una IA multimodal para analizar los documentos médicos de su abuela (con diagnósticos, medicamentos y datos personales). ¿Cuál es la consideración más importante?',
    options: [
      'No hay ningún problema — las IAs son totalmente seguras y privadas',
      'Los datos médicos son extremadamente sensibles. Debe verificar la política de privacidad, preferir una IA con modo privado, y evitar subir información que identifique a la persona si puede evitarlo',
      'Solo puede hacerlo si la abuela tiene más de 60 años',
      'Es mejor imprimir los documentos y pedirle a alguien que los lea manualmente',
    ],
    correct: 1,
    feedback: '¡Correcto! Los datos de salud son entre los más sensibles que existen. Antes de subirlos a cualquier IA pública, verificar la política de privacidad, usar modos sin historial si están disponibles, y anonimizar cuando sea posible son pasos esenciales.',
  },
  // 15 THEORY: proyectos increíbles
  {
    type: 'theory', title: 'Proyectos multimodales reales', xp: 10,
    render: () => (
      <>
        <ModuleType icon="🌍" label="Casos reales" />
        <ModuleTitle>Aplicaciones que ya cambian vidas</ModuleTitle>
        <BodyText>
          🌾 <Bold>Plantix (Alemania/India):</Bold> App que permite a agricultores fotografiar sus cultivos enfermos y recibir diagnóstico y tratamiento en segundos. Usada por más de 30 millones de agricultores en 90 países.{'\n\n'}
          🏥 <Bold>Google DeepMind + NHS (Reino Unido):</Bold> IA que analiza imágenes de retina e identifica más de 50 condiciones médicas con precisión comparable a especialistas humanos.{'\n\n'}
          📚 <Bold>Duolingo + IA multimodal:</Bold> La app de idiomas usa IA para corregir pronunciación en tiempo real, analizar expresiones faciales y personalizar el aprendizaje.
        </BodyText>
        <InfoBox>
          <Bold>El patrón común:</Bold> Los mejores proyectos multimodales combinan una necesidad humana real + múltiples tipos de datos + IA para crear algo que antes era imposible o demasiado caro para ser accesible.
        </InfoBox>
      </>
    ),
  },
  // 16 THEORY: el futuro
  {
    type: 'theory', title: 'El modelo que lo hace todo', xp: 10,
    render: () => (
      <>
        <ModuleType icon="🔮" label="El futuro" />
        <ModuleTitle>¿Hacia dónde va la multimodalidad?</ModuleTitle>
        <BodyText>
          La tendencia es clara: los modelos de IA convergen hacia sistemas cada vez más unificados que manejan todos los tipos de datos simultáneamente.
        </BodyText>
        <InfoBox>
          <Bold>Project Astra</Bold> (Google DeepMind, 2024): Un agente de IA que puede "ver" el mundo a través de la cámara de un teléfono de forma continua, recordar lo que ha visto antes en la misma sesión, y actuar como un asistente proactivo.{'\n\n'}
          <Bold>Operator</Bold> (OpenAI, 2025): Una IA que no solo responde sino que actúa — navega sitios web, rellena formularios, hace reservaciones, y completa tareas en tu nombre mientras tú te dedicas a otras cosas.
        </InfoBox>
        <InfoBox>
          <Bold>La pregunta importante:</Bold> A medida que las IAs se vuelven más autónomas y multimodales, ¿cómo mantenemos el control? ¿Dónde termina la herramienta y dónde empieza algo que actúa por su cuenta? Este es uno de los debates más importantes de la IA en 2025.
        </InfoBox>
      </>
    ),
  },
  // 17 VF
  {
    type: 'vf', title: 'Multimodalidad: verdadero o falso', xp: 15,
    statements: [
      { text: 'Las IAs multimodales siempre dan mejores resultados que las especializadas en todas las tareas.', correct: false, feedback: 'FALSO. Para tareas muy específicas (como análisis de código o diagnóstico médico especializado), un modelo entrenado específicamente puede superar a un modelo general. La multimodalidad es una ventaja de versatilidad, no de profundidad.' },
      { text: 'Puedo usar una IA multimodal para aprender a cocinar mostrándole los ingredientes que tengo en casa y pidiéndole una receta con ellos.', correct: true, feedback: 'VERDADERO. Este es un uso práctico excelente. Le muestras fotos de tu nevera y despensa, y la IA multimodal puede identificar los ingredientes y sugerir recetas con lo que tienes disponible.' },
      { text: 'En 2025, todas las IAs multimodales pueden generar video nativo desde texto.', correct: false, feedback: 'FALSO. Aunque muchos modelos pueden analizar video, la generación de video nativo (crear video desde cero) aún es una capacidad separada en herramientas especializadas como Sora, Runway o Pika. La línea se difumina cada año.' },
    ],
  },
  // 18 BUILDER: diseña tu proyecto multimodal
  {
    type: 'builder', title: 'Tu proyecto multimodal', xp: 20,
    placeholder: 'Describe tu proyecto multimodal: problema + entradas + pipeline + salida + impacto...',
    contentText: 'Es hora de combinar todo lo que aprendiste en el Mundo 3. Diseña un proyecto que use múltiples modalidades de IA para resolver un problema real:\n\n🔍 Problema real: ¿Qué situación de tu vida o comunidad quieres mejorar?\n📥 Entradas multimodales: ¿Qué tipos de datos usa? (texto/imagen/audio/video)\n🔄 Pipeline: ¿Qué hace la IA con cada tipo de dato en secuencia?\n📤 Salida: ¿Qué recibe el usuario final?\n💡 Impacto: ¿A quién ayuda y cómo?\n\nEjemplo: "App de patrimonio cultural para Colombia: los turistas fotografían monumentos o artesanías → IA identifica el objeto y genera un audio explicativo en español e inglés → el usuario puede hacerle preguntas por voz → la app guarda sus favoritos y crea un mapa personalizado de su recorrido."',
  },
  // 19 REFLEXIÓN (builder)
  {
    type: 'builder', title: 'Reflexión de cierre — Mundo 3', xp: 15,
    placeholder: 'Escribe tu reflexión sobre el Mundo 3...',
    contentText: '¿Qué cambió en ti?\n\n🎨 ¡Completaste el Mundo 3: IA Creativa!\nImágenes · Audio · Video · Web · Datos · Multimodal\n\nHas pasado por 6 niveles increíbles. Reflexiona sobre tu experiencia en este mundo:\n\n¿Cuál de las 6 IA creativas del Mundo 3 te parece más poderosa?\n¿Qué habilidad creativa con IA te emociona más aprender a usar?\n¿Qué quieres crear que antes sentías imposible para ti?',
  },
  // 20 COMPLETION
  { type: 'completion', title: '¡Mundo 3 completado!', xp: 0 },
];

const MAX_XP = 250;

// ─── COMPONENTES AUXILIARES ────────────────────────────────
const ModuleType = ({ icon, label }: { icon: string; label: string }) => (
  <View style={styles.moduleType}>
    <Text>{icon}</Text>
    <Text style={styles.moduleTypeText}>{label}</Text>
  </View>
);
const ModuleTitle = ({ children }: { children: string }) => (
  <Text style={styles.moduleTitle}>{children}</Text>
);
const BodyText = ({ children, style }: any) => (
  <Text style={[styles.bodyText, style]}>{children}</Text>
);
const Bold = ({ children }: { children: string }) => (
  <Text style={styles.bold}>{children}</Text>
);
const InfoBox = ({ children }: { children: any }) => (
  <View style={styles.infoBox}>
    <Text style={styles.infoBoxText}>{children}</Text>
  </View>
);
const FlowNode = ({ text, style, textColor }: { text: string; style?: any; textColor?: string }) => (
  <View style={[styles.flowNode, style]}>
    <Text style={[styles.flowNodeText, textColor ? { color: textColor } : {}]}>{text}</Text>
  </View>
);

// ─── COMPONENTE PRINCIPAL ──────────────────────────────────
export default function World3Level6() {
  const completeLevel = useGameStore((s) => s.completeLevel);
  const addXPToStore = useGameStore((s) => s.addXP);

  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [completed, setCompleted] = useState(false);

  // Estados para quizzes
  const [quizAnswered, setQuizAnswered] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [quizResult, setQuizResult] = useState<'correct' | 'wrong' | null>(null);

  // Matching
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<Set<string>>(new Set());
  const [shuffledRight, setShuffledRight] = useState<{ idx: number; text: string }[]>([]);

  // Builder
  const [builderText, setBuilderText] = useState('');
  const [builderDone, setBuilderDone] = useState(false);

  // Sort
  const [sortOrder, setSortOrder] = useState<string[]>([]);
  const [sortSelectedIdx, setSortSelectedIdx] = useState<number | null>(null);
  const [sortChecked, setSortChecked] = useState(false);

  // DragDrop
  const [classifications, setClassifications] = useState<Record<string, number | null>>({});

  // Sprint
  const [sprintActive, setSprintActive] = useState(false);
  const [sprintTime, setSprintTime] = useState(0);
  const [sprintText, setSprintText] = useState('');
  const sprintInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // VF
  const [vfAnswers, setVFAnswers] = useState<Record<number, boolean | null>>({});

  // Resetear estados al cambiar de módulo
  useEffect(() => {
    const mod = MODULES[step];
    setQuizAnswered(false);
    setSelectedOption(null);
    setQuizResult(null);
    setSelectedLeft(null);
    setMatchedPairs(new Set());
    setBuilderText('');
    setBuilderDone(false);
    setSortOrder([]);
    setSortSelectedIdx(null);
    setSortChecked(false);
    setClassifications({});
    setSprintActive(false);
    setSprintTime(0);
    setSprintText('');
    setVFAnswers({});

    if (mod.type === 'matching') {
      const shuffled = mod.pairs.map((p, i) => ({ idx: i, text: p.right })).sort(() => Math.random() - 0.5);
      setShuffledRight(shuffled);
    }
    if (mod.type === 'sort') {
      const initial = [...mod.correctOrder].sort(() => Math.random() - 0.5);
      setSortOrder(initial);
    }
    return () => {
      if (sprintInterval.current) clearInterval(sprintInterval.current);
    };
  }, [step]);

  const addXP = useCallback((amount: number) => {
    setXp(prev => prev + amount);
    addXPToStore(amount);
  }, [addXPToStore]);

  const handleNext = () => {
    if (step >= MODULES.length - 1) return;
    const mod = MODULES[step];
    let canAdvance = true;
    if (mod.type === 'quiz' && !quizAnswered) canAdvance = false;
    if (mod.type === 'matching' && matchedPairs.size < mod.pairs.length) canAdvance = false;
    if (mod.type === 'builder' && !builderDone) canAdvance = false;
    if (mod.type === 'sort' && !sortChecked) canAdvance = false;
    if (mod.type === 'dragdrop' && Object.keys(classifications).length !== mod.items.length) canAdvance = false;
    if (mod.type === 'sprint' && sprintActive) canAdvance = false;
    if (mod.type === 'vf' && Object.keys(vfAnswers).length !== mod.statements.length) canAdvance = false;
    if (canAdvance) setStep(s => s + 1);
  };

  const handlePrev = () => {
    if (step > 0) setStep(s => s - 1);
  };

  const finishLevel = () => {
    let stars = 1;
    if (xp >= 230) stars = 3;
    else if (xp >= 170) stars = 2;
    completeLevel(3, 6, stars, xp);
    setCompleted(true);
  };

  // ── RENDERIZADORES POR TIPO ──────────────────────────────

  const renderTheory = (mod: TheoryModule) => mod.render();

  const renderQuiz = (mod: QuizModule) => (
    <>
      <ModuleType icon="❓" label="Quiz" />
      <ModuleTitle>{mod.title}</ModuleTitle>
      <BodyText style={{ marginBottom: 16 }}>{mod.question}</BodyText>
      {mod.options.map((opt, i) => (
        <TouchableOpacity
          key={i}
          style={[
            styles.option,
            selectedOption === i && i === mod.correct && styles.optionCorrect,
            selectedOption === i && i !== mod.correct && styles.optionWrong,
            selectedOption !== null && i === mod.correct && styles.optionCorrect,
          ]}
          disabled={quizAnswered}
          onPress={() => {
            if (quizAnswered) return;
            setSelectedOption(i);
            setQuizAnswered(true);
            if (i === mod.correct) {
              setQuizResult('correct');
              addXP(mod.xp);
              setCorrectCount(c => c + 1);
            } else {
              setQuizResult('wrong');
            }
            if (Platform.OS === 'android') Vibration.vibrate(100);
          }}
        >
          <Text style={styles.optionIcon}>{['🅐', '🅑', '🅒', '🅓'][i]}</Text>
          <Text style={styles.optionText}>{opt}</Text>
        </TouchableOpacity>
      ))}
      {quizAnswered && (
        <View style={[styles.feedback, quizResult === 'correct' ? styles.feedbackOk : styles.feedbackFail]}>
          <Text style={styles.feedbackText}>
            {quizResult === 'correct' ? '✅ ¡Correcto! ' : '❌ Incorrecto. '}
            {mod.feedback}
          </Text>
        </View>
      )}
    </>
  );

  const renderMatching = (mod: MatchingModule) => (
    <>
      <ModuleType icon="🔗" label="Matching" />
      <ModuleTitle>{mod.title}</ModuleTitle>
      <BodyText style={{ marginBottom: 12 }}>Conecta cada modelo con su descripción. Toca uno de la izquierda y luego el correcto de la derecha.</BodyText>
      <View style={styles.matchGrid}>
        <View style={styles.matchCol}>
          {mod.pairs.map((pair, i) => (
            <TouchableOpacity
              key={`l${i}`}
              style={[
                styles.matchItem,
                selectedLeft === i && styles.matchItemSelected,
                matchedPairs.has(`l${i}`) && styles.matchItemMatched,
              ]}
              disabled={matchedPairs.has(`l${i}`)}
              onPress={() => setSelectedLeft(i)}
            >
              <Text>{pair.left}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.matchCol}>
          {shuffledRight.map((item, i) => {
            const correctIdx = mod.pairs.findIndex(p => p.right === item.text);
            const isMatched = matchedPairs.has(`l${correctIdx}`);
            return (
              <TouchableOpacity
                key={`r${i}`}
                style={[
                  styles.matchItem,
                  selectedLeft !== null && !isMatched && styles.matchItemSelectable,
                  isMatched && styles.matchItemMatched,
                ]}
                disabled={isMatched || selectedLeft === null}
                onPress={() => {
                  if (selectedLeft === null) return;
                  if (selectedLeft === correctIdx) {
                    const newMatched = new Set(matchedPairs);
                    newMatched.add(`l${correctIdx}`);
                    setMatchedPairs(newMatched);
                    setSelectedLeft(null);
                    if (newMatched.size === mod.pairs.length) {
                      addXP(mod.xp);
                      setCorrectCount(c => c + 1);
                    }
                  } else {
                    setSelectedLeft(null);
                  }
                }}
              >
                <Text>{item.text}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      {matchedPairs.size === mod.pairs.length && (
        <View style={[styles.feedback, styles.feedbackOk]}>
          <Text style={styles.feedbackText}>✅ ¡Todos los pares conectados!</Text>
        </View>
      )}
    </>
  );

  const renderBuilder = (mod: BuilderModule) => (
    <>
      <ModuleType icon="✏️" label="Constructor" />
      <ModuleTitle>{mod.title}</ModuleTitle>
      {mod.contentText && <BodyText>{mod.contentText}</BodyText>}
      <TextInput
        style={styles.builderInput}
        placeholder={mod.placeholder}
        multiline
        numberOfLines={5}
        value={builderText}
        onChangeText={setBuilderText}
      />
      {!builderDone && builderText.trim().length > 15 && (
        <TouchableOpacity
          style={styles.btn}
          onPress={() => {
            setBuilderDone(true);
            addXP(mod.xp);
            setCorrectCount(c => c + 1);
          }}
        >
          <Text style={styles.btnText}>Confirmar</Text>
        </TouchableOpacity>
      )}
      {builderDone && (
        <View style={[styles.feedback, styles.feedbackOk]}>
          <Text style={styles.feedbackText}>✅ ¡Excelente prompt! Aprovechaste perfectamente la capacidad multimodal.</Text>
        </View>
      )}
    </>
  );

  const renderSort = (mod: SortModule) => {
    const handleSortPress = (index: number) => {
      if (sortChecked) return;
      if (sortSelectedIdx === null) {
        setSortSelectedIdx(index);
      } else {
        const newOrder = [...sortOrder];
        const temp = newOrder[sortSelectedIdx];
        newOrder[sortSelectedIdx] = newOrder[index];
        newOrder[index] = temp;
        setSortOrder(newOrder);
        setSortSelectedIdx(null);
      }
    };

    const handleCheckSort = () => {
      const isCorrect = sortOrder.every((item, idx) => item === mod.correctOrder[idx]);
      setSortChecked(true);
      if (isCorrect) {
        addXP(mod.xp);
        setCorrectCount(c => c + 1);
      }
    };

    return (
      <>
        <ModuleType icon="📋" label="Ordena" />
        <ModuleTitle>{mod.title}</ModuleTitle>
        <BodyText style={{ marginBottom: 12 }}>{mod.instruction}</BodyText>
        {sortOrder.map((item, idx) => (
          <TouchableOpacity
            key={idx}
            style={[
              styles.sortItem,
              sortSelectedIdx === idx && styles.sortItemSelected,
              sortChecked && item === mod.correctOrder[idx] && styles.sortItemCorrect,
              sortChecked && item !== mod.correctOrder[idx] && styles.sortItemWrong,
            ]}
            onPress={() => handleSortPress(idx)}
          >
            <Text style={styles.sortHandle}>⠿</Text>
            <Text style={styles.sortItemText}>{item}</Text>
          </TouchableOpacity>
        ))}
        {!sortChecked && (
          <TouchableOpacity style={styles.btn} onPress={handleCheckSort}>
            <Text style={styles.btnText}>Verificar orden</Text>
          </TouchableOpacity>
        )}
        {sortChecked && (
          <View style={[styles.feedback, sortOrder.every((it, i) => it === mod.correctOrder[i]) ? styles.feedbackOk : styles.feedbackFail]}>
            <Text style={styles.feedbackText}>
              {sortOrder.every((it, i) => it === mod.correctOrder[i])
                ? '✅ ¡Pipeline correcto! Así es exactamente como se construye un video con IA.'
                : '❌ El orden no es correcto aún. ¡Piensa en qué necesitas primero para continuar!'}
            </Text>
          </View>
        )}
      </>
    );
  };

  const renderDragDrop = (mod: DragDropModule) => {
    const allClassified = Object.keys(classifications).length === mod.items.length;
    return (
      <>
        <ModuleType icon="↕️" label="Clasifica" />
        <ModuleTitle>{mod.title}</ModuleTitle>
        <BodyText>{mod.instruction}</BodyText>
        {mod.items.map(item => (
          <View key={item.id} style={styles.classifyRow}>
            <Text style={styles.classifyText}>{item.text}</Text>
            <View style={styles.classifyButtons}>
              {mod.zones.map((zone, zi) => (
                <TouchableOpacity
                  key={zi}
                  style={[
                    styles.classifyBtn,
                    classifications[item.id] === zi && styles.classifyBtnSelected,
                  ]}
                  onPress={() => setClassifications(prev => ({ ...prev, [item.id]: zi }))}
                >
                  <Text style={styles.classifyBtnText}>{zone.split(' ')[0]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
        {allClassified && (
          <TouchableOpacity
            style={styles.btn}
            onPress={() => {
              const allCorrect = mod.items.every(item => classifications[item.id] === mod.correct[item.id]);
              addXP(mod.xp);
              if (allCorrect) setCorrectCount(c => c + 1);
            }}
          >
            <Text style={styles.btnText}>Verificar</Text>
          </TouchableOpacity>
        )}
      </>
    );
  };

  const renderSprint = (mod: SprintModule) => {
    const startSprint = () => {
      setSprintActive(true);
      setSprintTime(mod.duration);
      sprintInterval.current = setInterval(() => {
        setSprintTime(prev => {
          if (prev <= 1) {
            clearInterval(sprintInterval.current!);
            setSprintActive(false);
            addXP(mod.xp);
            setCorrectCount(c => c + 1);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    };

    const minutes = Math.floor(sprintTime / 60);
    const seconds = sprintTime % 60;

    return (
      <>
        <ModuleType icon="⚡" label="Sprint" />
        <ModuleTitle>{mod.title}</ModuleTitle>
        <View style={styles.sprintBox}>
          <Text style={styles.sprintInstruction}>{mod.instruction}</Text>
          <Text style={[styles.timerText, sprintTime <= 20 && styles.timerDanger, sprintTime <= 45 && sprintTime > 20 && styles.timerWarning]}>
            {sprintActive ? `${minutes}:${seconds.toString().padStart(2, '0')}` : '0:00'}
          </Text>
          {!sprintActive && (
            <TouchableOpacity style={styles.btn} onPress={startSprint}>
              <Text style={styles.btnText}>▶ Iniciar Sprint</Text>
            </TouchableOpacity>
          )}
        </View>
        {sprintActive && (
          <TextInput
            style={styles.builderInput}
            placeholder={mod.placeholder}
            multiline
            numberOfLines={5}
            value={sprintText}
            onChangeText={setSprintText}
          />
        )}
        {!sprintActive && sprintTime === 0 && sprintTime !== undefined && (
          <View style={[styles.feedback, styles.feedbackOk]}>
            <Text style={styles.feedbackText}>⚡ ¡Sprint terminado!</Text>
          </View>
        )}
      </>
    );
  };

  const renderVF = (mod: VFModule) => (
    <>
      <ModuleType icon="✔️" label="Verdadero o Falso" />
      <ModuleTitle>{mod.title}</ModuleTitle>
      {mod.statements.map((item, idx) => (
        <View key={idx} style={styles.vfItem}>
          <Text style={styles.vfStatement}>"{item.text}"</Text>
          <View style={styles.vfButtons}>
            <TouchableOpacity
              style={[styles.vfBtn, vfAnswers[idx] === true && (item.correct ? styles.vfBtnCorrect : styles.vfBtnWrong)]}
              disabled={vfAnswers[idx] !== undefined}
              onPress={() => setVFAnswers(prev => ({ ...prev, [idx]: true }))}
            >
              <Text style={styles.vfBtnText}>✅ Verdadero</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.vfBtn, vfAnswers[idx] === false && (!item.correct ? styles.vfBtnCorrect : styles.vfBtnWrong)]}
              disabled={vfAnswers[idx] !== undefined}
              onPress={() => setVFAnswers(prev => ({ ...prev, [idx]: false }))}
            >
              <Text style={styles.vfBtnText}>❌ Falso</Text>
            </TouchableOpacity>
          </View>
          {vfAnswers[idx] !== undefined && (
            <View style={[styles.feedback, vfAnswers[idx] === item.correct ? styles.feedbackOk : styles.feedbackFail]}>
              <Text style={styles.feedbackText}>{item.feedback}</Text>
            </View>
          )}
        </View>
      ))}
      {Object.keys(vfAnswers).length === mod.statements.length && (
        <TouchableOpacity
          style={styles.btn}
          onPress={() => {
            addXP(mod.xp);
            setCorrectCount(c => c + 1);
          }}
        >
          <Text style={styles.btnText}>Continuar</Text>
        </TouchableOpacity>
      )}
    </>
  );

  const renderCompletion = () => (
    <View style={styles.completionScreen}>
      <Text style={styles.completionIcon}>🔗</Text>
      <Text style={styles.completionTitle}>¡Mundo 3 completado!</Text>
      <Text style={styles.completionBadge}>🏅 Multimodal Explorer</Text>
      <View style={styles.worldBadge}>
        <Text style={styles.worldBadgeIcon}>🎨</Text>
        <Text style={styles.worldBadgeTitle}>Insignia: Creador Multimodal</Text>
        <Text style={styles.worldBadgeSub}>N13 · N14 · N15 · N16 · N17 · N18</Text>
      </View>
      <Text style={styles.completionText}>
        ¡Completaste los 6 niveles del Mundo 3! Ahora eres un creador multimodal: imágenes, audio, video, web, datos y flujos completos con IA.
      </Text>
      <Text style={styles.xpGained}>+{xp} XP</Text>
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{correctCount}</Text>
          <Text style={styles.statLbl}>Correctas</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>21</Text>
          <Text style={styles.statLbl}>Módulos</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>M4</Text>
          <Text style={styles.statLbl}>Próximo</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.btn} onPress={finishLevel}>
        <Text style={styles.btnText}>Terminar nivel</Text>
      </TouchableOpacity>
    </View>
  );

  if (completed) {
    return (
      <View style={styles.screen}>
        <Text style={styles.thanksText}>¡Gracias por jugar! Redirigiendo...</Text>
      </View>
    );
  }

  const currentMod = MODULES[step];
  if (!currentMod) return null;

  const progress = Math.round((step / (MODULES.length - 1)) * 100);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.levelBadge}>🔗 MUNDO 3 · NIVEL 6</Text>
        <Text style={styles.levelTitle}>
          IA <Text style={{ color: '#d946ef' }}>Multimodal</Text>
        </Text>
        <Text style={styles.subtitle}>Todo al Mismo Tiempo</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressLabel}>
          Módulo {step} de {MODULES.length - 1} · {xp} / {MAX_XP} XP
        </Text>
      </View>

      <View style={styles.moduleCard}>
        {currentMod.type === 'theory' && renderTheory(currentMod)}
        {currentMod.type === 'quiz' && renderQuiz(currentMod)}
        {currentMod.type === 'matching' && renderMatching(currentMod)}
        {currentMod.type === 'builder' && renderBuilder(currentMod)}
        {currentMod.type === 'sort' && renderSort(currentMod)}
        {currentMod.type === 'dragdrop' && renderDragDrop(currentMod)}
        {currentMod.type === 'sprint' && renderSprint(currentMod)}
        {currentMod.type === 'vf' && renderVF(currentMod)}
        {currentMod.type === 'completion' && renderCompletion()}
      </View>

      {currentMod.type !== 'completion' && (
        <View style={styles.navButtons}>
          <TouchableOpacity
            style={[styles.navBtn, step === 0 && styles.navBtnHidden]}
            onPress={handlePrev}
            disabled={step === 0}
          >
            <Text style={styles.navBtnText}>← Anterior</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navBtn} onPress={handleNext}>
            <Text style={styles.navBtnText}>Siguiente →</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

// ─── ESTILOS (paleta fucsia/púrpura) ───────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0f0014' },
  container: { padding: 16, paddingBottom: 40 },
  header: { marginBottom: 24, alignItems: 'center' },
  levelBadge: { ...typography.bold, fontSize: 13, color: '#d946ef', marginBottom: 8 },
  levelTitle: { ...typography.heading1, fontSize: 28, color: '#fdf4ff', textAlign: 'center' },
  subtitle: { ...typography.body, color: '#c084fc', marginTop: 4, marginBottom: 16 },
  progressBar: { width: '100%', height: 6, backgroundColor: '#4a0070', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#d946ef', borderRadius: 3 },
  progressLabel: { ...typography.caption, color: '#c084fc', marginTop: 6 },
  moduleCard: {
    backgroundColor: '#200030',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#4a0070',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    elevation: 3,
  },
  moduleType: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  moduleTypeText: { ...typography.bold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#d946ef', marginLeft: 6 },
  moduleTitle: { ...typography.heading3, fontSize: 20, color: '#fdf4ff', marginBottom: 16 },
  bodyText: { ...typography.body, fontSize: 15, lineHeight: 24, color: '#c084fc', marginBottom: 12 },
  bold: { fontWeight: '700', color: '#fdf4ff' },
  infoBox: {
    backgroundColor: '#2a0040',
    borderLeftWidth: 4,
    borderLeftColor: '#d946ef',
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  infoBoxText: { ...typography.body, fontSize: 14, lineHeight: 22, color: '#c084fc' },
  // FlowRow
  flowRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' },
  flowNode: {
    backgroundColor: '#2a0040',
    borderWidth: 2,
    borderColor: '#d946ef',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    margin: 4,
  },
  flowNodeText: { fontSize: 13, fontWeight: '700', color: '#f0abfc', textAlign: 'center' },
  flowArrow: { color: '#c084fc', fontSize: 18, marginHorizontal: 2 },
  // Quiz
  option: {
    flexDirection: 'row',
    backgroundColor: '#2a0040',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#4a0070',
    alignItems: 'center',
  },
  optionIcon: { marginRight: 10, fontSize: 16 },
  optionText: { flex: 1, ...typography.body, color: '#fdf4ff' },
  optionCorrect: { borderColor: '#22c55e', backgroundColor: '#052e16' },
  optionWrong: { borderColor: '#ef4444', backgroundColor: '#2d0707' },
  feedback: { marginTop: 14, padding: 14, borderRadius: 12 },
  feedbackOk: { backgroundColor: '#052e16', borderWidth: 1, borderColor: '#16a34a' },
  feedbackFail: { backgroundColor: '#2d0707', borderWidth: 1, borderColor: '#dc2626' },
  feedbackText: { ...typography.body, fontSize: 14, color: '#fdf4ff' },
  // Matching
  matchGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  matchCol: { flex: 1, marginHorizontal: 4 },
  matchItem: {
    backgroundColor: '#2a0040',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#4a0070',
    alignItems: 'center',
  },
  matchItemSelected: { borderColor: '#d946ef', backgroundColor: '#380055' },
  matchItemMatched: { borderColor: '#22c55e', backgroundColor: '#052e16' },
  matchItemSelectable: { borderColor: '#d946ef' },
  // Builder
  builderInput: {
    backgroundColor: '#180020',
    borderWidth: 2,
    borderColor: '#4a0070',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#fdf4ff',
    minHeight: 100,
    marginVertical: 10,
    textAlignVertical: 'top',
  },
  btn: {
    backgroundColor: '#d946ef',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  btnText: { ...typography.bold, color: '#fff', fontSize: 15 },
  // Sort
  sortItem: {
    flexDirection: 'row',
    backgroundColor: '#2a0040',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#4a0070',
    alignItems: 'center',
  },
  sortItemSelected: { borderColor: '#d946ef', backgroundColor: '#380055' },
  sortItemCorrect: { borderColor: '#22c55e', backgroundColor: '#052e16' },
  sortItemWrong: { borderColor: '#ef4444', backgroundColor: '#2d0707' },
  sortHandle: { marginRight: 10, fontSize: 18, color: '#c084fc' },
  sortItemText: { fontSize: 14, color: '#fdf4ff', flex: 1 },
  // DragDrop
  classifyRow: { marginBottom: 10 },
  classifyText: { ...typography.body, color: '#fdf4ff', marginBottom: 6 },
  classifyButtons: { flexDirection: 'row', gap: 8 },
  classifyBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#4a0070',
    backgroundColor: '#2a0040',
  },
  classifyBtnSelected: { borderColor: '#d946ef' },
  classifyBtnText: { ...typography.bold, fontSize: 12, color: '#c084fc' },
  // Sprint
  sprintBox: {
    backgroundColor: '#200030',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#d946ef',
  },
  sprintInstruction: { textAlign: 'center', marginBottom: 10, color: '#c084fc' },
  timerText: { fontSize: 36, fontWeight: '800', color: '#d946ef', marginBottom: 12 },
  timerWarning: { color: '#f59e0b' },
  timerDanger: { color: '#ef4444' },
  // VF
  vfItem: { marginBottom: 16, backgroundColor: '#2a0040', borderRadius: 12, padding: 14 },
  vfStatement: { ...typography.body, fontWeight: '600', color: '#fdf4ff', marginBottom: 10 },
  vfButtons: { flexDirection: 'row', gap: 8 },
  vfBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#4a0070',
    alignItems: 'center',
    backgroundColor: '#180020',
  },
  vfBtnCorrect: { borderColor: '#22c55e', backgroundColor: '#052e16' },
  vfBtnWrong: { borderColor: '#ef4444', backgroundColor: '#2d0707' },
  vfBtnText: { ...typography.bold, fontSize: 13, color: '#c084fc' },
  // Completion
  completionScreen: { alignItems: 'center', paddingVertical: 30 },
  completionIcon: { fontSize: 60, marginBottom: 10 },
  completionTitle: { ...typography.heading1, fontSize: 26, color: '#d946ef', textAlign: 'center' },
  completionBadge: { ...typography.heading3, fontSize: 22, color: '#f0abfc', marginVertical: 6 },
  worldBadge: {
    backgroundColor: '#2a0040',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginVertical: 16,
    borderWidth: 2,
    borderColor: '#d946ef',
  },
  worldBadgeIcon: { fontSize: 40, marginBottom: 8 },
  worldBadgeTitle: { ...typography.bold, fontSize: 16, color: '#fff' },
  worldBadgeSub: { ...typography.body, fontSize: 13, color: '#c084fc', marginTop: 4 },
  completionText: { ...typography.body, textAlign: 'center', marginBottom: 20, color: '#c084fc' },
  xpGained: { ...typography.heading2, fontSize: 30, color: '#fdf4ff', marginBottom: 20 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginBottom: 20 },
  statItem: { alignItems: 'center', backgroundColor: '#200030', borderRadius: 12, padding: 12, flex: 1, marginHorizontal: 4 },
  statNum: { ...typography.heading3, fontSize: 20, color: '#d946ef' },
  statLbl: { ...typography.caption, color: '#c084fc' },
  navButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  navBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#2a0040',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#4a0070',
  },
  navBtnHidden: { opacity: 0 },
  navBtnText: { ...typography.bold, color: '#fdf4ff' },
  thanksText: { ...typography.heading2, textAlign: 'center', marginTop: 40, color: '#fdf4ff' },
});