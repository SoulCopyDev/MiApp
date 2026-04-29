// src/levels/World3/Level1.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Animated,
  Vibration,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useGameStore } from '../../store/gameStore';
import { colors, typography } from '../../theme';
import { RootStackParamList } from '../../types/navigation';

type Nav = StackNavigationProp<RootStackParamList, 'GameLevel'>;

// ─── TIPOS ──────────────────────────────────────────────
type ModuleType = 'theory' | 'quiz' | 'matching' | 'builder' | 'dragdrop' |
  'wordbuilder' | 'sprint' | 'classify3' | 'vf' | 'completion';

interface QuizModule {
  type: 'quiz';
  title: string;
  xp: number;
  question: string;
  options: string[];
  correct: number;
  feedback: string;
}

interface MatchingModule {
  type: 'matching';
  title: string;
  xp: number;
  pairs: { left: string; right: string }[]; // left already in order, right shuffled on render
}

interface BuilderModule {
  type: 'builder';
  title: string;
  xp: number;
  content: { __html: string }; // we'll use a render function instead
  // We'll handle builder with a TextInput
}

// ... etc. We'll define a unified module interface
interface Module {
  type: ModuleType;
  title: string;
  xp: number;
  // additional properties per type
}

// ─── DATOS DE LOS MÓDULOS ──────────────────────────────
// (misma información que el HTML)
const MODULES = [
  // 0 INTRO (theory)
  {
    type: 'theory' as const,
    title: 'Introducción',
    xp: 0,
    render: () => (
      <>
        <ModuleType icon="🎨" label="Introducción" />
        <ModuleTitle>¿Puede la IA ser artista?</ModuleTitle>
        <BodyText>
          Imagínate que pudieras describir con palabras la imagen perfecta que tienes en tu cabeza y que en segundos aparezca en tu pantalla exactamente como la soñaste.{'\n'}
          <Bold>Eso es exactamente lo que hacen las IAs de generación de imágenes</Bold>.
        </BodyText>
        <InfoBox>
          <Bold>¿Cómo funciona?</Bold> Estas IAs aprendieron viendo millones de imágenes y sus descripciones. Ahora pueden "imaginar" imágenes nuevas cuando les describes lo que quieres.
        </InfoBox>
        <BodyText>
          En este nivel vas a aprender a dominar los <Bold>prompts de imagen</Bold>, conocer los mejores estilos artísticos, y entender los límites éticos de esta tecnología increíble.
        </BodyText>
      </>
    ),
  },
  // 1 THEORY: Cómo funciona
  {
    type: 'theory' as const,
    title: '¿Cómo funciona?',
    xp: 10,
    render: () => (
      <>
        <ModuleType icon="🧠" label="Teoría" />
        <ModuleTitle>La magia detrás de las imágenes</ModuleTitle>
        <BodyText>
          Los modelos de generación de imágenes usan un proceso llamado <Bold>diffusion</Bold> (difusión). Funciona así:{'\n'}
          {'\n'}<Bold>1.</Bold> El modelo parte de una imagen completamente aleatoria (como estática de televisión).{'\n'}
          <Bold>2.</Bold> Poco a poco va "limpiando" esa estática, guiado por tu descripción en texto.{'\n'}
          <Bold>3.</Bold> Después de miles de pequeños pasos, aparece una imagen coherente que coincide con lo que escribiste.
        </BodyText>
        <InfoBox>
          <Bold>Analogía:</Bold> Es como esculpir en mármol. No creas desde cero, sino que vas quitando lo que no va hasta revelar la figura final. La IA parte del "caos" y lo convierte en arte.
        </InfoBox>
        <BodyText>
          Por eso los prompts de imagen más específicos y detallados generalmente producen mejores resultados. <Bold>Cuanto más preciso seas, mejor entiende la IA lo que quieres</Bold>.
        </BodyText>
      </>
    ),
  },
  // 2 QUIZ analógico: cómo funciona
  {
    type: 'quiz' as const,
    title: '¿Cómo funciona?',
    xp: 15,
    question:
      'Un estudiante en Seúl, Corea del Sur, pregunta: "Si la IA parte de ruido aleatorio para crear imágenes, ¿qué determina hacia dónde va transformando ese ruido?"',
    options: [
      'El número de megapíxeles de tu pantalla',
      'Tu descripción en texto (el prompt)',
      'La velocidad de tu internet',
      'El color más popular en internet ese día',
    ],
    correct: 1,
    feedback:
      '¡Exacto! Tu texto (el prompt) es el "mapa" que guía a la IA para transformar el ruido en algo coherente. Sin un buen prompt, la imagen puede salir de cualquier manera.',
  },
  // 3 BUILDER: tu primer prompt de imagen
  {
    type: 'builder' as const,
    title: 'Tu primer prompt de imagen',
    xp: 10,
    placeholder: 'Escribe aquí tu prompt de imagen. Por ejemplo: Un astronauta en la playa de Río de Janeiro...',
    contentText: `Un buen prompt de imagen tiene 5 ingredientes:\n\n🎯 Sujeto: ¿Qué o quién aparece?\n🌍 Escenario: ¿Dónde está?\n🎨 Estilo artístico: ¿Foto realista? ¿Anime? ¿Acuarela?\n💡 Iluminación/mood: ¿Atardecer dorado? ¿Oscuro y misterioso?\n📐 Detalles extras: Colores, texturas, ángulo de cámara\n\nEjemplo: "Una niña con trenzas y ropa colorida en un mercado de Ciudad de México, estilo acuarela vibrante, luz cálida de atardecer, colores naranja y rosa, vista desde arriba"`,
  },
  // 4 MATCHING: estilos artísticos
  {
    type: 'matching' as const,
    title: 'Estilos artísticos',
    xp: 15,
    pairs: [
      { left: '📸 Foto realista', right: 'Parece una fotografía real, muy detallada' },
      { left: '🎌 Anime', right: 'Estilo japonés con ojos grandes y colores vivos' },
      { left: '🖌️ Acuarela', right: 'Colores suaves que parecen pintados con agua' },
      { left: '👾 Pixel art', right: 'Imágenes hechas de cuadraditos de colores' },
    ],
  },
  // 5 THEORY: palabras mágicas
  {
    type: 'theory' as const,
    title: 'Palabras mágicas',
    xp: 10,
    render: () => (
      <>
        <ModuleType icon="✨" label="Teoría" />
        <ModuleTitle>Las palabras que mejoran todo</ModuleTitle>
        <BodyText>Existen palabras especiales que los artistas digitales usan para mejorar dramáticamente sus prompts. ¡Apréndetelas de memoria!</BodyText>
        <InfoBox>
          🎬 Cinematic – Da aspecto de película de cine{'\n'}
          🌈 Vibrant – Colores muy vivos e intensos{'\n'}
          ⬜ Minimalist – Simple, sin elementos de más{'\n'}
          🔍 Hyper-detailed – Nivel de detalle extremo{'\n'}
          💫 Soft light – Iluminación suave y agradable{'\n'}
          🎭 Dramatic lighting – Sombras fuertes y contrastes{'\n'}
          🌅 Golden hour – Luz cálida del atardecer{'\n'}
          🔮 Ethereal – Aspecto mágico y etéreo
        </InfoBox>
        <BodyText>
          Prueba añadir estas palabras al final de cualquier prompt y verás cómo cambia el resultado. <Bold>A veces una sola palabra transforma completamente la imagen</Bold>.
        </BodyText>
      </>
    ),
  },
  // 6 WORD BUILDER: palabras mágicas en acción
  {
    type: 'wordbuilder' as const,
    title: 'Palabras mágicas en acción',
    xp: 15,
    instruction: 'Construye un prompt añadiendo las palabras que harían esta imagen más impresionante:',
    scenario: '"Un tigre blanco en la selva de India"',
    words: ['cinematic', 'vibrant', 'hyper-detailed', 'soft light', 'dramatic lighting', 'golden hour', 'minimalist', 'ethereal', '4K resolution', 'award-winning photo'],
  },
  // 7 QUIZ: aspectos de imagen
  {
    type: 'quiz' as const,
    title: 'Aspectos de imagen',
    xp: 10,
    question:
      'Sofía quiere crear imágenes para publicar en Instagram Stories (formato vertical). ¿Qué proporción de aspecto debería pedir en su prompt?',
    options: [
      '1:1 (cuadrado, para el feed normal)',
      '16:9 (panorámico, para videos de YouTube)',
      '9:16 (vertical, perfecto para Stories)',
      '4:3 (antiguo, como fotos de cámara)',
    ],
    correct: 2,
    feedback:
      '¡Correcto! El formato 9:16 es vertical y perfecto para Instagram Stories, TikTok y Reels. El 16:9 es para pantallas anchas, y el 1:1 para el feed cuadrado.',
  },
  // 8 QUIZ: ángulo de cámara
  {
    type: 'quiz' as const,
    title: 'Ángulo de cámara',
    xp: 15,
    question:
      'Amara está creando una imagen de una ciudad en Nigeria para su proyecto escolar. Quiere que se vea toda la ciudad desde lejos, como si estuviera en un helicóptero. ¿Qué término debe añadir a su prompt?',
    options: [
      'Close-up (primer plano extremo)',
      "Bird's eye view (vista aérea desde arriba)",
      'Macro shot (foto muy cercana de detalles)',
      'Low angle (ángulo bajo, desde el suelo)',
    ],
    correct: 1,
    feedback:
      '¡Perfecto! "Bird\'s eye view" significa literalmente "vista de pájaro" — como ver desde arriba. Si Amara quisiera destacar el rostro de alguien, usaría "close-up".',
  },
  // 9 BUILDER: personaje de videojuego
  {
    type: 'builder' as const,
    title: 'Crea un personaje de videojuego',
    xp: 20,
    placeholder: 'Describe tu personaje con todos los detalles...',
    contentText: `Una de las cosas más divertidas de las IAs de imagen es crear personajes únicos. Tienes que describir:\n\n👤 Nombre y origen: ¿De dónde viene tu personaje?\n👕 Apariencia: Ropa, color de cabello, rasgos físicos\n⚔️ Poderes o habilidades: ¿Qué puede hacer?\n🎨 Paleta de colores: ¿Qué colores lo representan?\n🎭 Estilo visual: ¿Anime? ¿Comic americano? ¿Pixel art?\n\nEjemplo: "Hiroshi, un ninja de Kioto con armadura azul y dorado, capa que controla el viento, ojos que brillan plateados, estilo anime moderno, hyper-detailed"`,
  },
  // 10 THEORY: IA en el mundo real
  {
    type: 'theory' as const,
    title: 'IA en el mundo real',
    xp: 15,
    render: () => (
      <>
        <ModuleType icon="🌍" label="Casos reales" />
        <ModuleTitle>¿Quién ya usa esto?</ModuleTitle>
        <BodyText>La generación de imágenes con IA ya está transformando industrias enteras:</BodyText>
        <InfoBox>
          🎬 <Bold>Entretenimiento:</Bold> Marvel y Disney usan IA para generar conceptos visuales iniciales.{'\n'}
          📚 <Bold>Editorial:</Bold> Editoriales en Argentina y España ya publican libros infantiles con ilustraciones 100% generadas por IA.{'\n'}
          🛒 <Bold>E-commerce:</Bold> Empresas en México generan fotos de productos que nunca han existido físicamente para probar diseños.{'\n'}
          🎮 <Bold>Videojuegos:</Bold> Estudios indie en todo el mundo crean assets visuales sin necesidad de diseñadores gráficos.
        </InfoBox>
        <InfoBox>
          <Bold>¿Sabías que?</Bold> El ganador de un concurso de fotografía en Colorado, USA, en 2022 resultó ser una imagen generada con IA. ¡Causó un debate enorme sobre el arte y la tecnología!
        </InfoBox>
      </>
    ),
  },
  // 11 DRAG DROP: copyright (simplificado como toggles)
  {
    type: 'dragdrop' as const,
    title: '¿Qué está permitido?',
    xp: 10,
    instruction: 'Clasifica cada situación según si está generalmente permitida o puede ser problemática con imágenes de IA.',
    items: [
      { id: 'a', text: 'Generar un paisaje de fantasía para tu novela', correctZone: 'allowed' },
      { id: 'b', text: 'Crear imágenes en el "estilo de" un artista vivo sin su permiso', correctZone: 'problem' },
      { id: 'c', text: 'Diseñar el logo de tu proyecto escolar con IA', correctZone: 'allowed' },
      { id: 'd', text: 'Generar fotos falsas de una persona real en situaciones inventadas', correctZone: 'problem' },
      { id: 'e', text: 'Crear ilustraciones para un cuento que escribiste', correctZone: 'allowed' },
      { id: 'f', text: 'Vender imágenes de IA haciéndolas pasar por fotos reales', correctZone: 'problem' },
    ],
  },
  // 12 FILL IN BLANK: negative prompts (quiz)
  {
    type: 'quiz' as const,
    title: 'Negative prompts',
    xp: 10,
    question:
      'Valentina en Buenos Aires quiere generar una imagen de un gato naranja, pero la IA sigue añadiendo fondos feos y borrosos. ¿Qué debería añadir a su prompt para evitar esto?',
    options: [
      'Escribir el prompt en mayúsculas',
      'Usar un "negative prompt" con: blurry background, ugly, low quality',
      'Pedirlo en otro idioma',
      'Reiniciar la computadora y volver a intentarlo',
    ],
    correct: 1,
    feedback:
      '¡Exacto! Los "negative prompts" le dicen a la IA qué NO quieres. Es como decirle "todo bien, pero sin fondo borroso ni baja calidad". ¡Son súper útiles!',
  },
  // 13 SPRINT: prompts visuales
  {
    type: 'sprint' as const,
    title: 'Sprint Visual',
    xp: 15,
    duration: 120, // seconds
    instruction: '🎨 ¡Sprint creativo! En 2 minutos, escribe 3 prompts de imagen diferentes. Cada uno debe tener: sujeto + escenario + estilo artístico.',
    placeholder: 'Prompt 1:\nPrompt 2:\nPrompt 3:',
  },
  // 14 BUILDER: mashup de estilos
  {
    type: 'builder' as const,
    title: 'Mashup de estilos',
    xp: 10,
    placeholder: 'Estilo 1 + Estilo 2 + Concepto inesperado = ...',
    contentText: 'Los prompts más creativos mezclan estilos que nadie esperaría combinar. Prueba estas combinaciones locas:\n\n🎌 Anime + Renacimiento italiano\n🖼️ Impressionismo + Cyberpunk\n👾 Pixel art + Fotografía de naturaleza\n🏛️ Arquitectura antigua + Ciencia ficción\n\nEjemplo: "El Coliseo Romano reconstruido en el año 3000, estilo anime con naves espaciales sobrevolando, colores néon, hyper-detailed, cinematic"',
  },
  // 15 THEORY: portadas de libros
  {
    type: 'theory' as const,
    title: 'IA en portadas',
    xp: 15,
    render: () => (
      <>
        <ModuleType icon="📚" label="Casos reales" />
        <ModuleTitle>La IA en el mundo editorial</ModuleTitle>
        <BodyText>
          El mundo de los libros está siendo transformado por la IA. Algunos ejemplos reales:{'\n\n'}
          🇩🇪 <Bold>Alemania:</Bold> La editorial Carlsen publicó en 2023 uno de los primeros libros infantiles con ilustraciones generadas con IA.{'\n'}
          🇺🇸 <Bold>EE.UU.:</Bold> Amazon KDP recibe miles de libros por semana con portadas e ilustraciones generadas con IA.{'\n'}
          🇨🇴 <Bold>Colombia:</Bold> Algunas agencias de publicidad ya usan DALL-E y Midjourney para crear campañas visuales completas en horas, no semanas.
        </BodyText>
        <InfoBox>
          <Bold>El debate:</Bold> ¿Los ilustradores humanos están en peligro? Muchos expertos creen que la IA será una herramienta que complementa a los artistas, no que los reemplaza. ¡Los artistas que saben usar IA serán los más valiosos!
        </InfoBox>
      </>
    ),
  },
  // 16 CLASSIFIER: real o generada
  {
    type: 'classify3' as const,
    title: '¿Real o generada por IA?',
    xp: 15,
    instruction: 'Identifica estas características de imágenes. ¿Son señales de que una imagen fue generada por IA?',
    items: [
      { text: 'Manos con 6 dedos o dedos deformes', correct: true, feedback: '¡Correcto! Las IAs tienen problemas históricos con las manos. Ver dedos raros es una señal clásica.' },
      { text: 'Texto ilegible o con letras mezcladas en carteles y letreros', correct: true, feedback: '¡Exacto! Las IAs de imagen luchan mucho con el texto coherente.' },
      { text: 'Sombras que no coinciden con la dirección de la luz', correct: true, feedback: '¡Bien detectado! Las inconsistencias de iluminación son un indicador frecuente.' },
      { text: 'Colores muy vivos y saturados', correct: false, feedback: 'No necesariamente. Las fotos reales también pueden tener colores vivos. No es un indicador confiable.' },
      { text: 'Fondos con patrones repetidos o extraños', correct: true, feedback: '¡Correcto! Los fondos de las imágenes de IA a veces tienen patrones que no tienen sentido lógico.' },
    ],
  },
  // 17 VF: deepfakes
  {
    type: 'vf' as const,
    title: 'Verdadero o Falso',
    xp: 15,
    statements: [
      { text: 'Los deepfakes visuales solo pueden crearse con supercomputadoras muy caras.', correct: false, feedback: 'FALSO. Hoy existen apps gratuitas y fáciles de usar que pueden crear deepfakes convincentes. Por eso la educación en detección es tan importante.' },
      { text: 'Si una imagen fue generada por IA, su creador no tiene derechos de autor sobre ella.', correct: true, feedback: 'VERDADERO. En muchos países, las leyes de derechos de autor requieren autoría humana. Las imágenes de IA están en zona legal gris.' },
      { text: 'Solo los expertos en tecnología pueden detectar imágenes falsas.', correct: false, feedback: 'FALSO. Con práctica y conociendo las señales (manos raras, texto ilegible, sombras inconsistentes), cualquiera puede mejorar en detectarlas.' },
    ],
  },
  // 18 REFLEXIÓN ética (builder)
  {
    type: 'builder' as const,
    title: 'Reflexión ética',
    xp: 20,
    placeholder: '¿Crees que la IA puede ser verdaderamente artística? ¿Los humanos que usan IA son artistas? ¿Qué piensas sobre el copyright? Escribe tu opinión...',
    contentText: 'Has aprendido que la IA puede crear imágenes increíbles. Pero esto genera preguntas importantes que los adultos y expertos aún están debatiendo.\n\n🤔 ¿Una imagen generada por IA es "arte"?\n🎨 ¿El artista que escribe el prompt merece crédito por la imagen?\n⚖️ ¿Es justo que la IA haya aprendido de imágenes de artistas sin pedirles permiso?\n\nNo hay respuestas correctas o incorrectas aquí. Escribe lo que piensas tú:',
  },
  // 19 QUIZ CIERRE
  {
    type: 'quiz' as const,
    title: 'Quiz de cierre',
    xp: 15,
    question:
      'Kenji en Japón quiere crear una imagen de "un samurái en Tokio moderno". Quiere que parezca una fotografía real, con mucho detalle y buena iluminación. ¿Qué versión de su prompt sería mejor?',
    options: [
      '"Un samurái en Tokio"',
      '"Samurái japonés caminando por el barrio de Shinjuku en Tokio moderno, foto realista, hyper-detailed, cinematic lighting, 4K, award-winning photography, rainy night atmosphere"',
      '"SAMURÁI TOKIO FOTO REAL BUENA"',
      '"Por favor genera una imagen muy buena de un samurái que esté en la ciudad de Tokio con mucho detalle"',
    ],
    correct: 1,
    feedback:
      '¡Exacto! El segundo prompt tiene todos los elementos: sujeto específico, escenario detallado, estilo (foto realista), calidad (4K) y ambiente (noche lluviosa). Los detalles específicos siempre ganan.',
  },
  // 20 COMPLETION (manejado aparte)
  {
    type: 'completion' as const,
    title: '¡Nivel completado!',
    xp: 0,
  },
];

// Constantes para el cálculo de estrellas
const MAX_XP = 230;

export default function World3Level1() {
  const navigation = useNavigation<Nav>();
  const completeLevel = useGameStore((s) => s.completeLevel);
  const addXPToStore = useGameStore((s) => s.addXP);

  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [completed, setCompleted] = useState(false);

  // Estados para quizzes
  const [quizAnswered, setQuizAnswered] = useState(false);
  const [quizResult, setQuizResult] = useState<'correct' | 'wrong' | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  // Matching
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<Set<string>>(new Set());
  const [shuffledRight, setShuffledRight] = useState<{ idx: number; text: string }[]>([]);

  // Builder
  const [builderText, setBuilderText] = useState('');
  const [builderDone, setBuilderDone] = useState(false);

  // Word builder
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [wbDone, setWbDone] = useState(false);

  // Sprint
  const [sprintActive, setSprintActive] = useState(false);
  const [sprintTime, setSprintTime] = useState(0);
  const [sprintText, setSprintText] = useState('');
  const sprintInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // DragDrop (clasificación con botones)
  const [classifications, setClassifications] = useState<Record<string, 'allowed' | 'problem' | null>>({});

  // Classify3
  const [classifyAnswers, setClassifyAnswers] = useState<Record<number, boolean | null>>({});

  // VF
  const [vfAnswers, setVFAnswers] = useState<Record<number, boolean | null>>({});

  // Resetear estados al cambiar de módulo
  useEffect(() => {
    if (step < MODULES.length) {
      const mod = MODULES[step];
      setQuizAnswered(false);
      setQuizResult(null);
      setSelectedOption(null);
      setSelectedLeft(null);
      setMatchedPairs(new Set());
      setBuilderText('');
      setBuilderDone(false);
      setSelectedWords([]);
      setWbDone(false);
      setSprintActive(false);
      setSprintTime(0);
      setSprintText('');
      setClassifications({});
      setClassifyAnswers({});
      setVFAnswers({});

      if (mod.type === 'matching') {
        // Shuffle right side
        const shuffled = mod.pairs.map((p, i) => ({ idx: i, text: p.right })).sort(() => Math.random() - 0.5);
        setShuffledRight(shuffled);
      }
    }
  }, [step]);

  // Limpiar sprint timer al desmontar
  useEffect(() => {
    return () => {
      if (sprintInterval.current) clearInterval(sprintInterval.current);
    };
  }, []);

  const addXP = useCallback(
    (amount: number) => {
      setXp((prev) => prev + amount);
      addXPToStore(amount);
    },
    [addXPToStore]
  );

  const handleNext = () => {
    if (step >= MODULES.length - 1) return;
    const mod = MODULES[step];
    // Verificar si es momento de avanzar automático o manual
    let canAdvance = true;
    if (mod.type === 'quiz' && !quizAnswered) canAdvance = false;
    if (mod.type === 'matching' && matchedPairs.size < mod.pairs.length) canAdvance = false;
    if (mod.type === 'builder' && !builderDone) canAdvance = false;
    if (mod.type === 'wordbuilder' && !wbDone) canAdvance = false;
    if (mod.type === 'dragdrop' && Object.keys(classifications).length !== mod.items.length) canAdvance = false;
    if (mod.type === 'sprint' && sprintActive) canAdvance = false;
    if (mod.type === 'classify3' && Object.keys(classifyAnswers).length !== mod.items.length) canAdvance = false;
    if (mod.type === 'vf' && Object.keys(vfAnswers).length !== mod.statements.length) canAdvance = false;

    if (canAdvance) {
      setStep((s) => s + 1);
    }
  };

  const handlePrev = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const finishLevel = () => {
    // Calcular estrellas según XP
    let stars = 1;
    if (xp >= 200) stars = 3;
    else if (xp >= 150) stars = 2;
    completeLevel(3, 1, stars, xp);
    setCompleted(true);
  };

  // ── RENDERIZADORES POR TIPO ──────────────────────────────

  // Teoría (sin interacción)
  const renderTheory = (mod: any) => {
    if (mod.render) return mod.render();
    return (
      <>
        <ModuleType icon="📖" label={mod.title} />
        <ModuleTitle>{mod.title}</ModuleTitle>
        <BodyText>{mod.content || 'Contenido no disponible.'}</BodyText>
      </>
    );
  };

  // Quiz
  const renderQuiz = (mod: any) => (
    <>
      <ModuleType icon="❓" label="Quiz" />
      <ModuleTitle>{mod.title}</ModuleTitle>
      <BodyText style={{ marginBottom: 16 }}>{mod.question}</BodyText>
      {mod.options.map((opt: string, i: number) => (
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
              setCorrectCount((c) => c + 1);
            } else {
              setQuizResult('wrong');
            }
            // Vibración opcional
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

  // Matching
  const renderMatching = (mod: any) => (
    <>
      <ModuleType icon="🔗" label="Matching" />
      <ModuleTitle>{mod.title}</ModuleTitle>
      <BodyText style={{ marginBottom: 16 }}>Conecta cada estilo con su descripción. Toca un elemento de la izquierda, luego el correcto de la derecha.</BodyText>
      <View style={styles.matchGrid}>
        <View style={styles.matchCol}>
          {mod.pairs.map((pair: any, i: number) => (
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
            const correctIdx = mod.pairs.findIndex((p: any) => p.right === item.text);
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
                    newMatched.add(`l${selectedLeft}`);
                    setMatchedPairs(newMatched);
                    setSelectedLeft(null);
                    if (newMatched.size === mod.pairs.length) {
                      addXP(mod.xp);
                      setCorrectCount((c) => c + 1);
                    }
                  } else {
                    // Error
                    setSelectedLeft(null);
                    // Animación de error
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
          <Text style={styles.feedbackText}>✅ ¡Perfecto! Conectaste todos los pares correctamente.</Text>
        </View>
      )}
    </>
  );

  // Builder (TextInput con validación)
  const renderBuilder = (mod: any) => (
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
      {builderDone && (
        <View style={[styles.feedback, styles.feedbackOk]}>
          <Text style={styles.feedbackText}>🎨 ¡Excelente prompt! Cuanto más detallado, mejor será la imagen resultante.</Text>
        </View>
      )}
      {!builderDone && builderText.trim().length > 15 && (
        <TouchableOpacity
          style={styles.btn}
          onPress={() => {
            setBuilderDone(true);
            addXP(mod.xp);
            setCorrectCount((c) => c + 1);
          }}
        >
          <Text style={styles.btnText}>Confirmar prompt</Text>
        </TouchableOpacity>
      )}
    </>
  );

  // Word Builder
  const renderWordBuilder = (mod: any) => (
    <>
      <ModuleType icon="🔤" label="Constructor de palabras" />
      <ModuleTitle>{mod.title}</ModuleTitle>
      <BodyText>{mod.instruction}</BodyText>
      <InfoBox><Bold>Prompt base:</Bold> {mod.scenario}</InfoBox>
      <View style={styles.sentenceBox}>
        {selectedWords.length === 0 ? (
          <Text style={{ color: colors.textDisabled, fontSize: 13 }}>Toca las palabras para añadirlas...</Text>
        ) : (
          selectedWords.map((w, i) => (
            <TouchableOpacity key={i} onPress={() => setSelectedWords((prev) => prev.filter((x) => x !== w))}>
              <Text style={styles.builtChip}>{w} ✕</Text>
            </TouchableOpacity>
          ))
        )}
      </View>
      <View style={styles.wordPool}>
        {mod.words.map((word: string) => {
          const used = selectedWords.includes(word);
          return (
            <TouchableOpacity
              key={word}
              disabled={used}
              style={[styles.wordChip, used && styles.wordChipUsed]}
              onPress={() => setSelectedWords((prev) => [...prev, word])}
            >
              <Text style={[styles.wordChipText, used && styles.wordChipTextUsed]}>{word}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {selectedWords.length >= 3 && !wbDone && (
        <TouchableOpacity
          style={styles.btn}
          onPress={() => {
            setWbDone(true);
            addXP(mod.xp);
            setCorrectCount((c) => c + 1);
          }}
        >
          <Text style={styles.btnText}>Confirmar palabras</Text>
        </TouchableOpacity>
      )}
      {wbDone && (
        <View style={[styles.feedback, styles.feedbackOk]}>
          <Text style={styles.feedbackText}>
            ✅ ¡Excelente! Tu prompt mejorado: "{mod.scenario.replace(/"/g, '')} — {selectedWords.join(', ')}"
          </Text>
        </View>
      )}
    </>
  );

  // DragDrop (usando botones de clasificación)
  const renderDragDrop = (mod: any) => {
    const allClassified = Object.keys(classifications).length === mod.items.length;
    return (
      <>
        <ModuleType icon="↕️" label="Clasifica" />
        <ModuleTitle>{mod.title}</ModuleTitle>
        <BodyText>{mod.instruction}</BodyText>
        {mod.items.map((item: any) => (
          <View key={item.id} style={styles.classifyRow}>
            <Text style={styles.classifyText}>{item.text}</Text>
            <View style={styles.classifyButtons}>
              <TouchableOpacity
                style={[
                  styles.classifyBtn,
                  classifications[item.id] === 'allowed' && styles.classifyBtnAllowed,
                ]}
                onPress={() => setClassifications((prev) => ({ ...prev, [item.id]: 'allowed' }))}
              >
                <Text style={styles.classifyBtnText}>✅ Permitido</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.classifyBtn,
                  classifications[item.id] === 'problem' && styles.classifyBtnProblem,
                ]}
                onPress={() => setClassifications((prev) => ({ ...prev, [item.id]: 'problem' }))}
              >
                <Text style={styles.classifyBtnText}>⚠️ Problemático</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        {allClassified && (
          <View style={[styles.feedback, styles.feedbackOk]}>
            <Text style={styles.feedbackText}>✅ Clasificación registrada.</Text>
          </View>
        )}
        <TouchableOpacity
          disabled={!allClassified}
          style={[styles.btn, !allClassified && styles.btnDisabled]}
          onPress={() => {
            // Verificar respuestas y dar XP
            const allCorrect = mod.items.every((item: any) => classifications[item.id] === item.correctZone);
            addXP(mod.xp);
            if (allCorrect) setCorrectCount((c) => c + 1);
          }}
        >
          <Text style={styles.btnText}>Verificar</Text>
        </TouchableOpacity>
      </>
    );
  };

  // Sprint
  const startSprint = (duration: number) => {
    setSprintActive(true);
    setSprintTime(duration);
    sprintInterval.current = setInterval(() => {
      setSprintTime((prev) => {
        if (prev <= 1) {
          clearInterval(sprintInterval.current!);
          setSprintActive(false);
          addXP(MODULES[step].xp);
          setCorrectCount((c) => c + 1);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const renderSprint = (mod: any) => {
    const minutes = Math.floor(sprintTime / 60);
    const seconds = sprintTime % 60;
    return (
      <>
        <ModuleType icon="⚡" label="Sprint" />
        <ModuleTitle>{mod.title}</ModuleTitle>
        <View style={styles.sprintBox}>
          <Text style={styles.sprintInstruction}>{mod.instruction}</Text>
          <Text style={[styles.timerText, sprintTime <= 30 && styles.timerDanger, sprintTime <= 60 && sprintTime > 30 && styles.timerWarning]}>
            {sprintActive ? `${minutes}:${seconds.toString().padStart(2, '0')}` : '0:00'}
          </Text>
          {!sprintActive && (
            <TouchableOpacity style={styles.btn} onPress={() => startSprint(mod.duration)}>
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
        {!sprintActive && sprintTime === 0 && sprintTime !== undefined && sprintActive === false && (
          <View style={[styles.feedback, styles.feedbackOk]}>
            <Text style={styles.feedbackText}>⚡ ¡Sprint terminado!</Text>
          </View>
        )}
      </>
    );
  };

  // Classify3
  const renderClassify3 = (mod: any) => (
    <>
      <ModuleType icon="🔍" label="Detector" />
      <ModuleTitle>{mod.title}</ModuleTitle>
      <BodyText>{mod.instruction}</BodyText>
      {mod.items.map((item: any, idx: number) => (
        <View key={idx} style={styles.vfItem}>
          <Text style={styles.vfStatement}>{item.text}</Text>
          <View style={styles.vfButtons}>
            <TouchableOpacity
              style={[
                styles.vfBtn,
                classifyAnswers[idx] === true && (item.correct ? styles.vfBtnCorrect : styles.vfBtnWrong),
              ]}
              disabled={classifyAnswers[idx] !== undefined}
              onPress={() => {
                setClassifyAnswers((prev) => ({ ...prev, [idx]: true }));
                if (true === item.correct) {
                  // correct
                }
              }}
            >
              <Text style={styles.vfBtnText}>✅ Sí es señal de IA</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.vfBtn,
                classifyAnswers[idx] === false && (!item.correct ? styles.vfBtnCorrect : styles.vfBtnWrong),
              ]}
              disabled={classifyAnswers[idx] !== undefined}
              onPress={() => {
                setClassifyAnswers((prev) => ({ ...prev, [idx]: false }));
                if (false === item.correct) {
                  // correct
                }
              }}
            >
              <Text style={styles.vfBtnText}>❌ No es señal de IA</Text>
            </TouchableOpacity>
          </View>
          {classifyAnswers[idx] !== undefined && (
            <View style={[styles.feedback, classifyAnswers[idx] === item.correct ? styles.feedbackOk : styles.feedbackFail]}>
              <Text style={styles.feedbackText}>{item.feedback}</Text>
            </View>
          )}
        </View>
      ))}
      {Object.keys(classifyAnswers).length === mod.items.length && (
        <TouchableOpacity
          style={styles.btn}
          onPress={() => {
            addXP(mod.xp);
            setCorrectCount((c) => c + 1);
          }}
        >
          <Text style={styles.btnText}>Continuar</Text>
        </TouchableOpacity>
      )}
    </>
  );

  // VF
  const renderVF = (mod: any) => (
    <>
      <ModuleType icon="✔️" label="Verdadero o Falso" />
      <ModuleTitle>{mod.title}</ModuleTitle>
      {mod.statements.map((item: any, idx: number) => (
        <View key={idx} style={styles.vfItem}>
          <Text style={styles.vfStatement}>"{item.text}"</Text>
          <View style={styles.vfButtons}>
            <TouchableOpacity
              style={[
                styles.vfBtn,
                vfAnswers[idx] === true && (item.correct ? styles.vfBtnCorrect : styles.vfBtnWrong),
              ]}
              disabled={vfAnswers[idx] !== undefined}
              onPress={() => setVFAnswers((prev) => ({ ...prev, [idx]: true }))}
            >
              <Text style={styles.vfBtnText}>✅ Verdadero</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.vfBtn,
                vfAnswers[idx] === false && (!item.correct ? styles.vfBtnCorrect : styles.vfBtnWrong),
              ]}
              disabled={vfAnswers[idx] !== undefined}
              onPress={() => setVFAnswers((prev) => ({ ...prev, [idx]: false }))}
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
            setCorrectCount((c) => c + 1);
          }}
        >
          <Text style={styles.btnText}>Continuar</Text>
        </TouchableOpacity>
      )}
    </>
  );

  // Completion
  const renderCompletion = () => (
    <View style={styles.completionScreen}>
      <Text style={styles.completionIcon}>🎨</Text>
      <Text style={styles.completionTitle}>¡Badge desbloqueado!</Text>
      <Text style={styles.completionBadge}>🏅 AI Artist</Text>
      <Text style={styles.completionText}>
        ¡Completaste el Nivel 13! Ahora sabes crear prompts de imagen, conoces los estilos artísticos y entiendes cómo funciona la IA generativa visual.
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
          <Text style={styles.statNum}>N14</Text>
          <Text style={styles.statLbl}>Próximo</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.btn} onPress={finishLevel}>
        <Text style={styles.btnText}>Terminar nivel</Text>
      </TouchableOpacity>
    </View>
  );

  // ── RENDERIZADO PRINCIPAL ─────────────────────────────────
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
        <Text style={styles.levelBadge}>🖼️ MUNDO 3 · NIVEL 1</Text>
        <Text style={styles.levelTitle}>
          IA que <Text style={{ color: colors.primary }}>Dibuja</Text>
        </Text>
        <Text style={styles.subtitle}>Genera imágenes con palabras</Text>
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
        {currentMod.type === 'wordbuilder' && renderWordBuilder(currentMod)}
        {currentMod.type === 'dragdrop' && renderDragDrop(currentMod)}
        {currentMod.type === 'sprint' && renderSprint(currentMod)}
        {currentMod.type === 'classify3' && renderClassify3(currentMod)}
        {currentMod.type === 'vf' && renderVF(currentMod)}
        {currentMod.type === 'completion' && renderCompletion()}
      </View>

      {/* Navegación */}
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

// ─── ESTILOS ────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  levelBadge: {
    ...typography.bold,
    fontSize: 13,
    color: colors.primary,
    marginBottom: 8,
  },
  levelTitle: {
    ...typography.heading1,
    fontSize: 28,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: 16,
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: colors.borderLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  progressLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 6,
  },
  moduleCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    elevation: 2,
  },
  moduleType: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  moduleTypeText: {
    ...typography.bold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.primary,
    marginLeft: 6,
  },
  moduleTitle: {
    ...typography.heading3,
    fontSize: 20,
    color: colors.textPrimary,
    marginBottom: 16,
  },
  bodyText: {
    ...typography.body,
    fontSize: 15,
    lineHeight: 24,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  bold: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  infoBox: {
    backgroundColor: colors.surfaceVariant,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  infoBoxText: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  // Quiz
  option: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceVariant,
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: colors.borderLight,
    alignItems: 'center',
  },
  optionIcon: {
    marginRight: 10,
    fontSize: 16,
  },
  optionText: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
  },
  optionCorrect: {
    borderColor: colors.success,
    backgroundColor: '#e6f7e6',
  },
  optionWrong: {
    borderColor: colors.error,
    backgroundColor: '#fde0e0',
  },
  feedback: {
    marginTop: 14,
    padding: 14,
    borderRadius: 12,
  },
  feedbackOk: {
    backgroundColor: '#e6f7e6',
    borderWidth: 1,
    borderColor: colors.success,
  },
  feedbackFail: {
    backgroundColor: '#fde0e0',
    borderWidth: 1,
    borderColor: colors.error,
  },
  feedbackText: {
    ...typography.body,
    fontSize: 14,
    color: colors.textPrimary,
  },
  // Matching
  matchGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  matchCol: {
    flex: 1,
    marginHorizontal: 4,
  },
  matchItem: {
    backgroundColor: colors.surfaceVariant,
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: colors.borderLight,
    alignItems: 'center',
  },
  matchItemSelected: {
    borderColor: colors.primary,
    backgroundColor: '#e8eaf6',
  },
  matchItemMatched: {
    borderColor: colors.success,
    backgroundColor: '#e6f7e6',
  },
  matchItemSelectable: {
    borderColor: colors.primary,
  },
  // Builder
  builderInput: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.borderLight,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: colors.textPrimary,
    minHeight: 100,
    marginVertical: 10,
    textAlignVertical: 'top',
  },
  btn: {
    backgroundColor: colors.primary,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  btnText: {
    ...typography.bold,
    color: '#fff',
    fontSize: 15,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  // Word builder
  sentenceBox: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.borderLight,
    borderRadius: 12,
    padding: 14,
    minHeight: 50,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 12,
  },
  builtChip: {
    backgroundColor: colors.surfaceVariant,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    margin: 2,
    fontSize: 14,
    color: colors.textSecondary,
  },
  wordPool: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    backgroundColor: colors.surfaceVariant,
    borderRadius: 12,
  },
  wordChip: {
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
    margin: 4,
  },
  wordChipUsed: {
    opacity: 0.3,
  },
  wordChipText: {
    color: colors.primary,
    fontWeight: '600',
  },
  wordChipTextUsed: {
    color: colors.textDisabled,
  },
  // Drag drop
  classifyRow: {
    marginBottom: 10,
  },
  classifyText: {
    ...typography.body,
    marginBottom: 6,
  },
  classifyButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  classifyBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.borderLight,
    backgroundColor: colors.surfaceVariant,
  },
  classifyBtnAllowed: {
    borderColor: colors.success,
    backgroundColor: '#e6f7e6',
  },
  classifyBtnProblem: {
    borderColor: colors.error,
    backgroundColor: '#fde0e0',
  },
  classifyBtnText: {
    ...typography.bold,
    fontSize: 12,
  },
  // Sprint
  sprintBox: {
    backgroundColor: '#ede7f6',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  sprintInstruction: {
    textAlign: 'center',
    marginBottom: 10,
    ...typography.body,
  },
  timerText: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.primary,
    fontVariant: ['tabular-nums'],
    marginBottom: 12,
  },
  timerWarning: {
    color: colors.accent,
  },
  timerDanger: {
    color: colors.error,
  },
  // VF & Classify3
  vfItem: {
    marginBottom: 16,
    backgroundColor: colors.surfaceVariant,
    borderRadius: 12,
    padding: 14,
  },
  vfStatement: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: 10,
  },
  vfButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  vfBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.borderLight,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  vfBtnCorrect: {
    borderColor: colors.success,
    backgroundColor: '#e6f7e6',
  },
  vfBtnWrong: {
    borderColor: colors.error,
    backgroundColor: '#fde0e0',
  },
  vfBtnText: {
    ...typography.bold,
    fontSize: 13,
  },
  // Completion
  completionScreen: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  completionIcon: {
    fontSize: 60,
    marginBottom: 10,
  },
  completionTitle: {
    ...typography.heading1,
    fontSize: 26,
    color: colors.primary,
    textAlign: 'center',
  },
  completionBadge: {
    ...typography.heading3,
    fontSize: 22,
    color: colors.accent,
    marginVertical: 6,
  },
  completionText: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: 20,
    color: colors.textSecondary,
  },
  xpGained: {
    ...typography.heading2,
    fontSize: 30,
    color: colors.textPrimary,
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    borderRadius: 12,
    padding: 12,
    flex: 1,
    marginHorizontal: 4,
  },
  statNum: {
    ...typography.heading3,
    fontSize: 20,
    color: colors.primary,
  },
  statLbl: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  navButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  navBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: colors.surfaceVariant,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  navBtnHidden: {
    opacity: 0,
  },
  navBtnText: {
    ...typography.bold,
    color: colors.textPrimary,
  },
  thanksText: {
    ...typography.heading2,
    textAlign: 'center',
    marginTop: 40,
  },
});