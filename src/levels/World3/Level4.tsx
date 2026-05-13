// src/levels/World3/Level4.tsx
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
  render?: () => React.ReactElement; // algunos builders tienen contenido adicional
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
  correct: Record<string, number>; // id -> zone index
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
        <ModuleType icon="💻" label="Introducción" />
        <ModuleTitle>De usuario a constructor</ModuleTitle>
        <BodyText>
          ¿Sabías que muchas de las apps y sitios web que usas hoy fueron construidos por personas que empezaron exactamente como tú? La diferencia es que ahora tienes algo que ellos no tenían: <Bold>inteligencia artificial que escribe código por ti</Bold>.
        </BodyText>
        <BodyText>
          Con herramientas como <Bold>Lovable</Bold>, <Bold>Bolt</Bold> o <Bold>Bubble</Bold>, puedes describir en español lo que quieres construir y la IA lo convierte en una aplicación funcional en minutos. No necesitas saber programar.
        </BodyText>
        <InfoBox>
          <Bold>¿Qué vas a aprender hoy?</Bold>{'\n'}
          🔨 Qué son las herramientas no-code e IA-code{'\n'}
          🌐 Cómo funciona una página web por dentro (lo básico){'\n'}
          ✏️ Cómo describir tu app con palabras para que la IA la construya{'\n'}
          🚀 Cómo publican sus apps jóvenes como tú en todo el mundo
        </InfoBox>
      </>
    ),
  },
  // 1 THEORY
  {
    type: 'theory', title: 'Herramientas no-code', xp: 10,
    render: () => (
      <>
        <ModuleType icon="🧠" label="Teoría" />
        <ModuleTitle>No-code, low-code y full-code</ModuleTitle>
        <BodyText>Existen tres formas de construir aplicaciones web hoy:</BodyText>
        <InfoBox>
          <Bold>No-code:</Bold> Describes lo que quieres con palabras o arrastras elementos visuales. La IA o la plataforma genera todo el código. Ejemplos: Lovable, Bubble, Framer.{'\n'}
          <Bold>Low-code:</Bold> Usas bloques visuales pero también escribes algo de código para personalizar. Requiere conocimientos básicos de programación.{'\n'}
          <Bold>Full-code:</Bold> Escribes todo el código tú mismo en lenguajes como HTML, CSS, JavaScript o Python. Máximo control, máximo aprendizaje requerido.
        </InfoBox>
        <InfoBox>
          <Bold>La tendencia en 2025:</Bold> Las empresas más innovadoras usan las tres. Un fundador no-técnico usa no-code para prototipar rápido, y cuando la app crece, un programador la mejora con full-code. La IA está haciendo que la línea entre las tres sea cada vez más difusa.
        </InfoBox>
      </>
    ),
  },
  // 2 MATCHING
  {
    type: 'matching', title: 'Herramientas no-code', xp: 15,
    pairs: [
      { left: '🔨 Lovable', right: 'Describe tu app en texto y genera React + código completo' },
      { left: '⚡ Bolt (StackBlitz)', right: 'Crea apps web en el navegador con IA en tiempo real' },
      { left: '🫧 Bubble', right: 'Constructor visual con base de datos integrada, sin código' },
      { left: '🎨 Framer', right: 'Diseño web profesional con animaciones y IA para copy' },
    ],
  },
  // 3 BUILDER (descripción de app)
  {
    type: 'builder', title: 'Describe tu app', xp: 15,
    placeholder: 'Describe tu app ideal aquí...',
    contentText: 'El primer paso para construir cualquier app es saber exactamente qué hace. Responde estas preguntas en tu descripción:\n\n¿Qué hace tu app? ¿Para qué sirve exactamente?\n¿Para quién es? ¿Qué tipo de persona la usaría?\n¿Cómo se ve? Colores, estilo, si es seria o divertida\n¿Qué acción principal realiza? ¿Guardar algo, mostrar info, conectar personas?\n\nEjemplo: "Una app para estudiantes de secundaria en México que permite guardar frases motivadoras, compartirlas con amigos y votar cuál es la mejor. Diseño colorido y juvenil, fondo oscuro con acentos neón."',
  },
  // 4 THEORY: HTML básico
  {
    type: 'theory', title: '¿Qué es HTML?', xp: 10,
    render: () => (
      <>
        <ModuleType icon="🌐" label="Teoría" />
        <ModuleTitle>Lo mínimo que debes saber de una web</ModuleTitle>
        <BodyText>Toda página web está hecha de tres ingredientes básicos:</BodyText>
        <InfoBox>
          <Bold>HTML:</Bold> La estructura. Como el esqueleto del cuerpo — define qué elementos existen (títulos, párrafos, botones, imágenes).{'\n'}
          <Bold>CSS:</Bold> El estilo. Como la ropa — decide colores, tamaños, fuentes y cómo se ve todo.{'\n'}
          <Bold>JavaScript:</Bold> El comportamiento. Como los músculos — hace que las cosas se muevan, respondan a clicks y funcionen.
        </InfoBox>
        <CodeBlock>
          {'<h1>Hola, soy un título</h1>\n<p>Soy un párrafo de texto.</p>\n<button style="color:green">¡Haz clic!</button>'}
        </CodeBlock>
        <BodyText>Cuando usas Lovable o Bolt, la IA genera este código por ti automáticamente. Pero entender qué hace cada parte te ayuda a pedir exactamente lo que quieres.</BodyText>
      </>
    ),
  },
  // 5 QUIZ
  {
    type: 'quiz', title: 'HTML, CSS y JavaScript', xp: 15,
    question: 'Amir, un estudiante de Irán, quiere que el botón de su app cambie de color cuando alguien lo toca con el dedo. ¿Qué tecnología es la responsable de ese comportamiento interactivo?',
    options: [
      'HTML (estructura la página)',
      'CSS (da estilo visual)',
      'JavaScript (maneja interacciones y comportamiento)',
      'El servidor donde está guardada la app',
    ],
    correct: 2,
    feedback: '¡Correcto! JavaScript es el que hace que las cosas pasen: clics, animaciones, cambios en tiempo real. HTML es la estructura y CSS es el estilo.',
  },
  // 6 THEORY: Copilot y Cursor
  {
    type: 'theory', title: 'IA que escribe código', xp: 10,
    render: () => (
      <>
        <ModuleType icon="🤖" label="Casos reales" />
        <ModuleTitle>GitHub Copilot y Cursor</ModuleTitle>
        <BodyText>Para quienes sí saben algo de programación, existen IAs que actúan como "co-pilotos" que completan el código automáticamente:</BodyText>
        <InfoBox>
          <Bold>🤖 GitHub Copilot:</Bold> Desarrollado por Microsoft y OpenAI. Predice la siguiente línea de código que vas a escribir y la completa en tiempo real. Es como el autocorrector del teléfono, pero para código.{'\n'}
          <Bold>🎯 Cursor:</Bold> Un editor de código completo con IA integrada. Puedes decirle en español "añade un botón que guarde el formulario" y lo hace automáticamente.
        </InfoBox>
        <InfoBox>
          <Bold>Dato real:</Bold> En 2024, GitHub reportó que el 55% del código de los proyectos que usan Copilot fue escrito por la IA, no por humanos. Los programadores ahora supervisan y dirigen más de lo que escriben manualmente.
        </InfoBox>
      </>
    ),
  },
  // 7 THEORY: pasos para hacer una web
  {
    type: 'theory', title: 'Los 5 pasos', xp: 10,
    render: () => (
      <>
        <ModuleType icon="📋" label="Teoría" />
        <ModuleTitle>Cómo se construye una web con IA</ModuleTitle>
        <BodyText>El proceso para crear una app con IA no-code tiene siempre estos pasos:</BodyText>
        <InfoBox>
          <Bold>1. 💡 Idea:</Bold> ¿Qué problema resuelve tu app?{'\n'}
          <Bold>2. 📝 Wireframe:</Bold> Dibuja o describe las pantallas principales{'\n'}
          <Bold>3. 🤖 Prompt:</Bold> Escríbele a la IA exactamente lo que quieres{'\n'}
          <Bold>4. 🧪 Genera y prueba:</Bold> La IA construye, tú pruebas y corriges{'\n'}
          <Bold>5. 🌐 Publica:</Bold> Con un clic, tu app está en internet para el mundo
        </InfoBox>
        <BodyText>Lo más importante: <Bold>el paso 3 es donde tu habilidad de prompting hace toda la diferencia</Bold>. Todo lo que aprendiste en M2 aplica directamente aquí.</BodyText>
      </>
    ),
  },
  // 8 SORT
  {
    type: 'sort', title: 'Ordena los pasos', xp: 15,
    instruction: 'Toca un elemento para seleccionarlo, luego toca otro para intercambiarlos. Ordena correctamente los pasos:',
    correctOrder: [
      'Identificar el problema que va a resolver la app',
      'Describir las pantallas y funciones principales (wireframe)',
      'Escribir el prompt detallado para la IA',
      'La IA genera el código; tú lo revisas y corriges',
      'Publicar la app en internet con un dominio',
    ],
  },
  // 9 BUILDER (estilo visual)
  {
    type: 'builder', title: 'El prompt de diseño', xp: 15,
    placeholder: 'Describe el estilo visual de tu app ideal...',
    contentText: 'El diseño visual es tan importante como la funcionalidad. La IA puede seguir instrucciones de estilo si las describes bien:\n\n🎨 Paleta: "Fondo oscuro navy, acentos azul eléctrico, texto blanco"\n✍️ Tipografía: "Fuente moderna sans-serif para títulos, clara para texto"\n📐 Estilo general: "Minimalista", "Colorido y juvenil", "Profesional y serio"\n📱 Dispositivo: "Primero para móvil" o "Diseñado para pantalla grande"\n\nEjemplo: "Fondo negro con gradiente púrpura oscuro, botones color coral, tipografía Poppins moderna, estilo juvenil y energético como las apps de música, optimizado para móvil."',
  },
  // 10 THEORY: debugging
  {
    type: 'theory', title: 'La IA como asistente de código', xp: 10,
    render: () => (
      <>
        <ModuleType icon="🐛" label="Casos reales" />
        <ModuleTitle>Cuando algo no funciona, la IA lo arregla</ModuleTitle>
        <BodyText>
          Uno de los superpoderes de usar IA para construir apps es que también puede encontrar y corregir errores. A esto se le llama <Bold>debugging</Bold>.
        </BodyText>
        <InfoBox>
          <Bold>Flujo de trabajo real:</Bold>{'\n'}
          1. Describes el bug en lenguaje normal{'\n'}
          2. La IA analiza el código y encuentra la causa{'\n'}
          3. Propone la corrección y explica por qué ocurrió{'\n'}
          4. Tú apruebas el cambio y el error desaparece
        </InfoBox>
        <BodyText>Este flujo reduce horas de trabajo a minutos. Por eso los programadores junior que saben usar IA son ahora tan productivos como seniors que no la usan.</BodyText>
      </>
    ),
  },
  // 11 QUIZ
  {
    type: 'quiz', title: 'No-code vs low-code', xp: 15,
    question: 'Valentina quiere crear una app para su colegio en Chile que permita a los estudiantes reportar si hay basura en el patio y que un administrador la vea en tiempo real. No sabe programar nada. ¿Cuál es la mejor opción para ella?',
    options: [
      'Aprender Python durante 2 años antes de empezar',
      'Usar Lovable o Bubble — describen la app con palabras y la IA genera todo el código',
      'Contratar a un programador profesional',
      'Las apps de este tipo solo pueden hacerlas empresas grandes',
    ],
    correct: 1,
    feedback: '¡Correcto! Herramientas como Lovable o Bubble son perfectas para este caso. Valentina puede tener una versión funcional en horas, no años, y luego mejorarla sin saber programar.',
  },
  // 12 SPRINT
  {
    type: 'sprint', title: 'Sprint: describe tu app', xp: 20,
    duration: 60,
    instruction: '⚡ ¡60 segundos! Describe tu app perfecta: qué hace + para quién es + cómo se ve + acción principal.',
    placeholder: 'Mi app se llama... Sirve para... La usarían... Se ve... La acción principal es...',
  },
  // 13 THEORY: apps de jóvenes
  {
    type: 'theory', title: 'Apps hechas por jóvenes', xp: 10,
    render: () => (
      <>
        <ModuleType icon="🌍" label="Casos reales" />
        <ModuleTitle>Jóvenes que ya construyeron con IA</ModuleTitle>
        <BodyText>
          🇺🇸 <Bold>Caleb Jhay (17 años, EE.UU.):</Bold> Construyó una app de estudio con IA que genera tarjetas de memoria desde apuntes. La publicó en Product Hunt y consiguió 2,000 usuarios en su primera semana.{'\n\n'}
          🇳🇬 <Bold>Amaka Obi (16 años, Nigeria):</Bold> Creó un directorio web de negocios locales de su barrio usando Bubble. El ayuntamiento la contactó para expandir el proyecto.{'\n\n'}
          🇧🇷 <Bold>Pedro Alves (15 años, Brasil):</Bold> Hizo un bot de Telegram para su colegio que responde preguntas del reglamento escolar. Lo construyó en un fin de semana con ChatGPT y Python básico.
        </BodyText>
        <InfoBox>
          <Bold>Lo que tienen en común:</Bold> Ninguno esperó a ser "experto" para empezar. Identificaron un problema real, lo describieron bien y usaron las herramientas disponibles. <Bold>Tú puedes hacer lo mismo hoy.</Bold>
        </InfoBox>
      </>
    ),
  },
  // 14 THEORY: no-code vs low-code decisión
  {
    type: 'theory', title: '¿Cuándo uso cada cosa?', xp: 10,
    render: () => (
      <>
        <ModuleType icon="🗺️" label="Teoría" />
        <ModuleTitle>Elige la herramienta correcta</ModuleTitle>
        <BodyText>No todas las situaciones requieren el mismo enfoque. Aquí está la guía rápida:</BodyText>
        <InfoBox>
          <Bold>Usa no-code (Lovable, Bubble) cuando:</Bold>{'\n'}
          → Quieres un prototipo rápido en horas{'\n'}
          → El proyecto es relativamente simple{'\n'}
          → No tienes tiempo de aprender a programar ahora{'\n\n'}
          <Bold>Usa low-code (con algo de JS/Python) cuando:</Bold>{'\n'}
          → Necesitas funcionalidades muy específicas{'\n'}
          → Quieres tener más control sobre cómo funciona{'\n\n'}
          <Bold>Aprende full-code cuando:</Bold>{'\n'}
          → Quieres construir cosas muy complejas o escalables{'\n'}
          → Quieres trabajar profesionalmente en tecnología
        </InfoBox>
      </>
    ),
  },
  // 15 DRAG DROP
  {
    type: 'dragdrop', title: '¿Qué herramienta uso?', xp: 15,
    instruction: 'Clasifica cada proyecto en la herramienta más adecuada:',
    zones: ['🔨 No-code (Lovable/Bubble)', '🐍 Requiere programación real'],
    items: [
      { id: 'a', text: 'Un sitio web sencillo para mostrar tu portafolio personal' },
      { id: 'b', text: 'Un sistema bancario que maneja millones de transacciones por día' },
      { id: 'c', text: 'Una app para reservar canchas deportivas en tu barrio' },
      { id: 'd', text: 'Un sistema operativo nuevo para computadoras' },
      { id: 'e', text: 'Una encuesta digital para tu proyecto de ciencias' },
      { id: 'f', text: 'Un motor de IA que aprende con millones de datos en tiempo real' },
    ],
    correct: { a: 0, b: 1, c: 0, d: 1, e: 0, f: 1 },
  },
  // 16 QUIZ: necesidad de programar
  {
    type: 'quiz', title: 'El debate: ¿necesito programar?', xp: 15,
    question: 'Si la IA ya escribe código por mí, ¿para qué aprendería a programar? ¿Cuál es la respuesta más inteligente?',
    options: [
      'No necesito programar para nada — la IA lo hace todo mejor',
      'Debo aprender todo el código posible porque la IA nunca lo reemplazará',
      'Entender los fundamentos de programación me ayuda a dar mejores instrucciones a la IA, detectar errores y construir cosas más complejas — es una ventaja, no una obligación',
      'Solo los genios pueden programar; el resto debemos conformarnos con no-code',
    ],
    correct: 2,
    feedback: '¡Exacto! La programación y la IA no son opuestos. Quien entiende cómo funciona el código puede sacarle mucho más provecho a las IAs de programación. Es como cocinar: no necesitas ser chef para comer bien, pero entender ingredientes te hace mejor.',
  },
  // 17 VF
  {
    type: 'vf', title: 'Verdadero o Falso', xp: 15,
    statements: [
      { text: 'Con Lovable puedes publicar una app funcional en internet sin tocar ni una línea de código.', correct: true, feedback: 'VERDADERO. Lovable genera el código y tiene integración directa con servicios de publicación. Con un clic tu app está online.' },
      { text: 'Las apps hechas con herramientas no-code nunca pueden crecer para tener miles de usuarios.', correct: false, feedback: 'FALSO. Apps como Notion, Webflow y muchas otras startups exitosas empezaron con herramientas no-code o low-code. Cuando crecen, migran gradualmente a código más personalizado.' },
      { text: 'GitHub Copilot puede escribir código en más de 10 lenguajes de programación diferentes.', correct: true, feedback: 'VERDADERO. Copilot funciona en Python, JavaScript, TypeScript, Ruby, Go, Java, C++, PHP, y más. Aprende los patrones de millones de proyectos de código abierto.' },
    ],
  },
  // 18 BUILDER (wireframe con palabras)
  {
    type: 'builder', title: 'Las 3 pantallas de tu app', xp: 15,
    placeholder: 'Describe las 3 pantallas principales de tu app...',
    contentText: 'Antes de pedirle a la IA que construya tu app, es útil describir las pantallas principales. Esto se llama wireframe textual.\n\nPantalla 1 — Inicio: Lo primero que ve el usuario\nPantalla 2 — Acción principal: Lo que hace el usuario en la app\nPantalla 3 — Resultado: Lo que ve después de completar la acción\n\nEjemplo: "Pantalla 1: Bienvenida con logo y botón Empezar. Pantalla 2: Formulario donde el estudiante escribe su meta del día. Pantalla 3: Tarjeta motivacional generada por IA con su meta y un emoji aleatorio."',
  },
  // 19 REFLEXIÓN (builder)
  {
    type: 'builder', title: 'Reflexión final', xp: 15,
    placeholder: 'Describe tu primera app y por qué sería útil para alguien...',
    contentText: 'Tú eres el arquitecto, la IA es el constructor\n\nHay una frase que resume muy bien el futuro del desarrollo de software con IA:\n\n"La IA escribe el código, pero tú decides qué construir, para quién y por qué. La creatividad, la empatía y la visión siguen siendo 100% tuyas."\n\n¿Qué app construirías primero si tuvieras una hora libre ahora mismo? ¿Por qué esa y no otra?',
  },
  // 20 COMPLETION
  { type: 'completion', title: '¡Completado!', xp: 0 },
];

const MAX_XP = 240;

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
const CodeBlock = ({ children }: { children: string }) => (
  <View style={styles.codeBlock}>
    <Text style={styles.codeText}>{children}</Text>
  </View>
);

// ─── COMPONENTE PRINCIPAL ──────────────────────────────────
export default function World3Level4() {
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
    if (xp >= 220) stars = 3;
    else if (xp >= 160) stars = 2;
    completeLevel(3, 4, stars, xp);
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
      <BodyText style={{ marginBottom: 12 }}>Conecta cada herramienta con su descripción. Toca una de la izquierda y luego la correcta de la derecha.</BodyText>
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
        numberOfLines={4}
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
          <Text style={styles.feedbackText}>💻 ¡Esa descripción es suficiente para que Lovable o Bolt generen una primera versión funcional!</Text>
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
        // Intercambiar posiciones
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
                ? '✅ ¡Orden correcto! Conoces bien el proceso de construir una web con IA.'
                : '❌ Algunos pasos no están en el orden correcto. ¡Intenta de nuevo!'}
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
          <Text style={[styles.timerText, sprintTime <= 15 && styles.timerDanger, sprintTime <= 30 && sprintTime > 15 && styles.timerWarning]}>
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
      <Text style={styles.completionIcon}>💻</Text>
      <Text style={styles.completionTitle}>¡Badge desbloqueado!</Text>
      <Text style={styles.completionBadge}>🏅 Web Builder</Text>
      <Text style={styles.completionText}>
        ¡Nivel 16 completado! Ahora sabes cómo construir apps web con IA, conoces las herramientas no-code y entiendes cómo describir tus ideas para que la IA las construya.
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
          <Text style={styles.statNum}>N17</Text>
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
        <Text style={styles.levelBadge}>💻 MUNDO 3 · NIVEL 4</Text>
        <Text style={styles.levelTitle}>
          Haz tu Primera <Text style={{ color: '#84cc16' }}>Web con IA</Text>
        </Text>
        <Text style={styles.subtitle}>De usuario a constructor: crea sin programar</Text>
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

// ─── ESTILOS (paleta verde lima) ───────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#040d00' },
  container: { padding: 16, paddingBottom: 40 },
  header: { marginBottom: 24, alignItems: 'center' },
  levelBadge: { ...typography.bold, fontSize: 13, color: '#84cc16', marginBottom: 8 },
  levelTitle: { ...typography.heading1, fontSize: 28, color: '#f0fde4', textAlign: 'center' },
  subtitle: { ...typography.body, color: '#86a85a', marginTop: 4, marginBottom: 16 },
  progressBar: { width: '100%', height: 6, backgroundColor: '#1e3a00', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#84cc16', borderRadius: 3 },
  progressLabel: { ...typography.caption, color: '#86a85a', marginTop: 6 },
  moduleCard: {
    backgroundColor: '#0d1f00',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e3a00',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    elevation: 3,
  },
  moduleType: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  moduleTypeText: { ...typography.bold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#84cc16', marginLeft: 6 },
  moduleTitle: { ...typography.heading3, fontSize: 20, color: '#f0fde4', marginBottom: 16 },
  bodyText: { ...typography.body, fontSize: 15, lineHeight: 24, color: '#86a85a', marginBottom: 12 },
  bold: { fontWeight: '700', color: '#f0fde4' },
  infoBox: {
    backgroundColor: '#142800',
    borderLeftWidth: 4,
    borderLeftColor: '#84cc16',
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  infoBoxText: { ...typography.body, fontSize: 14, lineHeight: 22, color: '#86a85a' },
  codeBlock: {
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: '#1e3a00',
    borderRadius: 10,
    padding: 16,
    marginVertical: 12,
  },
  codeText: { fontFamily: 'monospace', fontSize: 13, color: '#a8ff78', lineHeight: 24 },
  // Quiz
  option: {
    flexDirection: 'row',
    backgroundColor: '#142800',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#1e3a00',
    alignItems: 'center',
  },
  optionIcon: { marginRight: 10, fontSize: 16 },
  optionText: { flex: 1, ...typography.body, color: '#f0fde4' },
  optionCorrect: { borderColor: '#22c55e', backgroundColor: '#052e16' },
  optionWrong: { borderColor: '#ef4444', backgroundColor: '#2d0707' },
  feedback: { marginTop: 14, padding: 14, borderRadius: 12 },
  feedbackOk: { backgroundColor: '#052e16', borderWidth: 1, borderColor: '#16a34a' },
  feedbackFail: { backgroundColor: '#2d0707', borderWidth: 1, borderColor: '#dc2626' },
  feedbackText: { ...typography.body, fontSize: 14, color: '#f0fde4' },
  // Matching
  matchGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  matchCol: { flex: 1, marginHorizontal: 4 },
  matchItem: {
    backgroundColor: '#142800',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#1e3a00',
    alignItems: 'center',
  },
  matchItemSelected: { borderColor: '#84cc16', backgroundColor: '#1a3500' },
  matchItemMatched: { borderColor: '#22c55e', backgroundColor: '#052e16' },
  matchItemSelectable: { borderColor: '#84cc16' },
  // Builder
  builderInput: {
    backgroundColor: '#071500',
    borderWidth: 2,
    borderColor: '#1e3a00',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#f0fde4',
    minHeight: 100,
    marginVertical: 10,
    textAlignVertical: 'top',
  },
  btn: {
    backgroundColor: '#84cc16',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  btnText: { ...typography.bold, color: '#fff', fontSize: 15 },
  // Sort
  sortItem: {
    flexDirection: 'row',
    backgroundColor: '#142800',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#1e3a00',
    alignItems: 'center',
  },
  sortItemSelected: { borderColor: '#84cc16', backgroundColor: '#1a3500' },
  sortItemCorrect: { borderColor: '#22c55e', backgroundColor: '#052e16' },
  sortItemWrong: { borderColor: '#ef4444', backgroundColor: '#2d0707' },
  sortHandle: { marginRight: 10, fontSize: 18, color: '#86a85a' },
  sortItemText: { fontSize: 14, color: '#f0fde4', flex: 1 },
  // DragDrop
  classifyRow: { marginBottom: 10 },
  classifyText: { ...typography.body, color: '#f0fde4', marginBottom: 6 },
  classifyButtons: { flexDirection: 'row', gap: 8 },
  classifyBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#1e3a00',
    backgroundColor: '#142800',
  },
  classifyBtnSelected: { borderColor: '#84cc16' },
  classifyBtnText: { ...typography.bold, fontSize: 12, color: '#86a85a' },
  // Sprint
  sprintBox: {
    backgroundColor: '#0d2200',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  sprintInstruction: { textAlign: 'center', marginBottom: 10, color: '#86a85a' },
  timerText: { fontSize: 36, fontWeight: '800', color: '#84cc16', marginBottom: 12 },
  timerWarning: { color: '#f59e0b' },
  timerDanger: { color: '#ef4444' },
  // VF
  vfItem: { marginBottom: 16, backgroundColor: '#142800', borderRadius: 12, padding: 14 },
  vfStatement: { ...typography.body, fontWeight: '600', color: '#f0fde4', marginBottom: 10 },
  vfButtons: { flexDirection: 'row', gap: 8 },
  vfBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#1e3a00',
    alignItems: 'center',
    backgroundColor: '#071500',
  },
  vfBtnCorrect: { borderColor: '#22c55e', backgroundColor: '#052e16' },
  vfBtnWrong: { borderColor: '#ef4444', backgroundColor: '#2d0707' },
  vfBtnText: { ...typography.bold, fontSize: 13, color: '#86a85a' },
  // Completion
  completionScreen: { alignItems: 'center', paddingVertical: 30 },
  completionIcon: { fontSize: 60, marginBottom: 10 },
  completionTitle: { ...typography.heading1, fontSize: 26, color: '#84cc16', textAlign: 'center' },
  completionBadge: { ...typography.heading3, fontSize: 22, color: '#f59e0b', marginVertical: 6 },
  completionText: { ...typography.body, textAlign: 'center', marginBottom: 20, color: '#86a85a' },
  xpGained: { ...typography.heading2, fontSize: 30, color: '#f0fde4', marginBottom: 20 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginBottom: 20 },
  statItem: { alignItems: 'center', backgroundColor: '#0d1f00', borderRadius: 12, padding: 12, flex: 1, marginHorizontal: 4 },
  statNum: { ...typography.heading3, fontSize: 20, color: '#84cc16' },
  statLbl: { ...typography.caption, color: '#86a85a' },
  navButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  navBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#142800',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e3a00',
  },
  navBtnHidden: { opacity: 0 },
  navBtnText: { ...typography.bold, color: '#f0fde4' },
  thanksText: { ...typography.heading2, textAlign: 'center', marginTop: 40, color: '#f0fde4' },
});