import { exitLevel } from '../utils/exitLevel';
import { router } from 'expo-router';
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
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useGameStore } from '../store/gameStore';
import { colors, typography } from '../theme';
import XPToast from '../components/XPToast';

// ---------- Tipos y constantes ----------
interface TFItem {
  stmt: string;
  correct: boolean;
  explain: string;
}

interface CreationType {
  icon: string;
  label: string;
  desc: string;
}

interface BuilderArea {
  emoji: string;
  name: string;
  placeholder: string;
  rol: string;
  tarea: string;
}

const TOTAL_STEPS = 20; // 0:intro, 1-18: módulos, 19: complete
const CONTENT_STEPS = 18;

// Pools de datos extraídos del HTML
const CREATION_TYPES: CreationType[] = [
  { icon: '📝', label: 'Texto', desc: 'Redactar, resumir, argumentar' },
  { icon: '🖼️', label: 'Imagen', desc: 'Describir lo que quieres ver' },
  { icon: '🎵', label: 'Canción', desc: 'Letra + estilo musical' },
  { icon: '📖', label: 'Historia', desc: 'Personajes, trama, mundo' },
  { icon: '🌍', label: 'Traducción', desc: 'Cambiar idioma con contexto' },
  { icon: '💡', label: 'Ideas', desc: 'Brainstorming creativo' },
  { icon: '📊', label: 'Análisis', desc: 'Entender datos o textos' },
  { icon: '🤖', label: 'Asistente', desc: 'Responde sobre un tema' },
];

const BUILDER_AREAS: BuilderArea[] = [
  { emoji: '📚', name: 'Tarea escolar', placeholder: 'Ej: explícame las fracciones como si tuviera 10 años', rol: 'maestro paciente que usa analogías simples', tarea: 'explícame [tema] de forma clara y con ejemplos' },
  { emoji: '🎮', name: 'Hobby o juego', placeholder: 'Ej: dame estrategias para mejorar en ajedrez siendo principiante', rol: 'entrenador experto y motivador', tarea: 'dame 5 consejos concretos para mejorar en [hobby]' },
  { emoji: '🎨', name: 'Proyecto creativo', placeholder: 'Ej: ayúdame a inventar un superhéroe original para un cómic', rol: 'co-creador creativo y entusiasta', tarea: 'ayúdame a desarrollar [idea] con detalles originales' },
  { emoji: '🏠', name: 'Vida cotidiana', placeholder: 'Ej: necesito organizar mis actividades de la semana', rol: 'asistente personal organizado', tarea: 'ayúdame a planificar [situación]' },
];

const STUDY_PROMPTS = [
  { emoji: '➗', subject: 'Matemáticas', bad: '"Explícame las fracciones"', good: '"Actúa como maestro de matemáticas de 7° grado. Explícame qué son las fracciones con 3 analogías cotidianas y dame 2 ejercicios simples con respuestas al final."', why: 'El prompt efectivo especifica rol, audiencia, método (analogías) y formato (ejercicios con respuestas).' },
  { emoji: '🌍', subject: 'Historia', bad: '"Cuéntame sobre la Segunda Guerra Mundial"', good: '"Eres historiador que explica eventos a adolescentes. Resume las 5 causas principales de la 2GM en lista numerada, con una frase ejemplo por causa. Máximo 200 palabras."', why: 'Limitar extensión y pedir formato lista hace la respuesta directamente usable para un resumen escolar.' },
  { emoji: '🧪', subject: 'Ciencias', bad: '"¿Qué es la fotosíntesis?"', good: '"Actúa como biólogo que enseña en bachillerato. Explícame la fotosíntesis usando la analogía de una fábrica: materias primas, proceso y producto. Incluye la ecuación química al final."', why: 'La analogía concreta hace el concepto memorable. Pedir la ecuación al final no interrumpe la explicación.' },
];

const COMPARE_TASK = {
  task: 'Ayúdame a escribir una disculpa sincera para un amigo con el que me peleé',
  resultA: 'Lamentablemente, entiendo que hayan tenido un conflicto. Te sugiero expresar tus sentimientos de forma honesta y empática, reconociendo tu parte en el malentendido.',
  resultB: '"Oye, quería hablar contigo. Sé que dije cosas que te hirieron y no era mi intención. Valoro mucho nuestra amistad. ¿Podemos hablar?"',
  options: ['Respuesta A — más formal y elaborada', 'Respuesta B — directa y lista para usar', 'Ambas son igual de útiles', 'Ninguna, el prompt era malo'],
  correct: 1, // B es correcta
  explain: 'La B es directamente usable — ya es el texto que se pidió. La A da consejos en lugar de escribir la disculpa. El mismo prompt en distintas herramientas puede dar utilidades muy diferentes.',
};

const VF_POOL: TFItem[] = [
  { stmt: 'Si la IA da una respuesta que no te gusta, no tiene sentido intentarlo de nuevo.', correct: false, explain: 'Falso. Reformular el prompt o pedir que "mejore" la respuesta anterior casi siempre da mejores resultados. La iteración es parte fundamental del proceso.' },
  { stmt: 'La IA puede crear imágenes con solo una descripción en texto.', correct: true, explain: 'Verdadero. Herramientas como DALL-E, Midjourney o Adobe Firefly generan imágenes a partir de texto. Más detalle = mejor resultado.' },
  { stmt: 'Es imposible usar IA para estudiar materias escolares.', correct: false, explain: 'Falso. La IA es una de las mejores herramientas para estudiar: explica conceptos de formas distintas, da ejemplos, hace preguntas de práctica y resume textos largos.' },
  { stmt: 'Pedirle a la IA que "mejore" su propia respuesta puede dar mejores resultados.', correct: true, explain: 'Verdadero. Frases como "hazlo más corto" o "agrega un ejemplo práctico" activan el refinamiento. Es una de las habilidades más útiles del prompting.' },
  { stmt: 'La IA recuerda todo lo que le contaste en sesiones anteriores.', correct: false, explain: 'Falso. Cada sesión nueva empieza desde cero. Si cierras la ventana, la IA no recuerda la conversación anterior.' },
  { stmt: 'Cuanto más específico es tu prompt, más útil suele ser la respuesta.', correct: true, explain: 'Verdadero. Especificar rol, audiencia, formato y objetivo es la regla de oro del prompting.' },
  { stmt: 'Si le pides a la IA información del futuro, dirá claramente que no sabe.', correct: false, explain: 'Falso. Este es el fenómeno de alucinación. La IA puede generar texto que suena plausible pero es inventado. Siempre verifica datos factuales importantes.' },
  { stmt: 'Solo adultos con conocimientos técnicos pueden usar herramientas de IA generativa.', correct: false, explain: 'Falso. Las interfaces de ChatGPT, Claude y Gemini están diseñadas para cualquier persona. Solo necesitas una cuenta y saber escribir lo que quieres.' },
  { stmt: 'Un prompt muy largo siempre da mejor resultado que uno corto.', correct: false, explain: 'Falso. La calidad depende de la claridad, no del largo. Un prompt de 15 palabras bien construido supera a uno de 200 palabras confuso.' },
  { stmt: 'La IA puede ayudarte a crear un personaje de videojuego con poderes, historia y apariencia.', correct: true, explain: 'Verdadero. Es uno de los usos más creativos. Puedes pedir nombre, backstory, habilidades, debilidades y frase icónica — todo en un prompt.' },
];

const SPRINT_TASKS_1 = [
  '✍️ Escribe el prompt para que la IA haga un chiste sobre la escuela',
  '🍕 Pide que invente una receta con ingredientes imposibles (helado + papas + limón)',
  '🎮 Describe un personaje de videojuego con un poder único que nadie haya inventado',
  '🌙 Pide una historia de 3 líneas que ocurra en la Luna esta noche',
  '🦁 Prompt para que la IA explique qué sueñan los leones',
];

const GIFTS = [
  '🎁 Regalo 1: ¿Para quién? Diseña el prompt de su regalo digital',
  '🎁 Regalo 2: Otra persona querida — ¿qué le crearías con IA?',
  '🎁 Regalo 3: Un mensaje especial — construye el prompt para sorprenderle',
];

const pickN = <T,>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};


const TAG_STYLES: Record<string, { bg: string; color: string }> = {
  intro: { bg: '#ecfdf5', color: '#065f46' },
  theory: { bg: '#fdf4ff', color: '#7e22ce' },
  lab: { bg: '#eff6ff', color: '#1e40af' },
  build: { bg: '#fef9c3', color: '#713f12' },
  cases: { bg: '#fff7ed', color: '#c2410c' },
  sprint: { bg: '#fdf2f8', color: '#9d174d' },
  compare: { bg: '#f0fdf4', color: '#166534' },
  vf: { bg: '#fff1f2', color: '#9f1239' },
  reflect: { bg: '#f8fafc', color: '#475569' },
  gallery: { bg: '#f5f3ff', color: '#5b21b6' },
};

const CARD_STYLES: Record<string, { bg: string; border: string }> = {
  green: { bg: '#f0fdf4', border: '#bbf7d0' },
  blue: { bg: '#eff6ff', border: '#bfdbfe' },
  purple: { bg: '#faf5ff', border: '#e9d5ff' },
  amber: { bg: '#fffbeb', border: '#fde68a' },
  orange: { bg: '#fff7ed', border: '#fed7aa' },
  red: { bg: '#fff1f2', border: '#fecdd3' },
  slate: { bg: '#f8fafc', border: '#e2e8f0' },
};

const HL_STYLES: Record<string, { border: string; bg: string; color: string }> = {
  green: { border: '#10b981', bg: '#f0fdf4', color: '#065f46' },
  purple: { border: '#8b5cf6', bg: '#faf5ff', color: '#5b21b6' },
  orange: { border: '#f97316', bg: '#fff7ed', color: '#c2410c' },
  blue: { border: '#3b82f6', bg: '#eff6ff', color: '#1e40af' },
  amber: { border: '#f59e0b', bg: '#fffbeb', color: '#92400e' },
  red: { border: '#ef4444', bg: '#fff1f2', color: '#991b1b' },
};

// ---------- Subcomponentes ----------
function Tag({ variant, children }: { variant: keyof typeof TAG_STYLES; children: React.ReactNode }) {
  const t = TAG_STYLES[variant];
  return (
    <View style={[styles.tag, { backgroundColor: t.bg }]}>
      <Text style={[styles.tagText, { color: t.color }]}>{children}</Text>
    </View>
  );
}

function Hl({ variant, children }: { variant: keyof typeof HL_STYLES; children: React.ReactNode }) {
  const h = HL_STYLES[variant];
  return (
    <View style={{ borderLeftWidth: 3, borderLeftColor: h.border, backgroundColor: h.bg, padding: 12, borderRadius: 4, marginVertical: 10 }}>
      <Text style={{ fontSize: 12, color: h.color, lineHeight: 20, fontWeight: '500' }}>{children}</Text>
    </View>
  );
}

function InfoCard({ variant, icon, iconBg, title, children }: { variant: keyof typeof CARD_STYLES; icon: string; iconBg: string; title: string; children: React.ReactNode }) {
  const c = CARD_STYLES[variant];
  return (
    <View style={[styles.card, { backgroundColor: c.bg, borderColor: c.border }]}>
      <View style={styles.cardRow}>
        <View style={[styles.cardIcon, { backgroundColor: iconBg }]}><Text style={{ fontSize: 18 }}>{icon}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardText}>{children}</Text>
        </View>
      </View>
    </View>
  );
}

function TipBox({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.tipBox}>
      <Text style={styles.tipBoxText}>{children}</Text>
    </View>
  );
}

interface LevelProps {
  navigation?: any;
  setAllowBack?: (allow: boolean) => void;
}

export default function World1Level4({ navigation: propsNavigation, setAllowBack }: LevelProps) {
  const navigationFromHook = useNavigation();
  const navigation = propsNavigation || navigationFromHook;


  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);
  const completeLevel = useGameStore((state) => state.completeLevel);
  const devMode = useGameStore((state) => state.devMode);

  // Pools aleatorios
  const [vfItems] = useState(() => pickN(VF_POOL, 6));

  // Estados de actividades
  const [creationSel, setCreationSel] = useState<number[]>([]);

  // Builder área (step 3)
  const [builderAreaIdx, setBuilderAreaIdx] = useState<number | null>(null);
  const [builderText, setBuilderText] = useState('');

  // Builder historia (step 4)
  const [storyGenre, setStoryGenre] = useState('');
  const [storyChar, setStoryChar] = useState('');
  const [storyPlace, setStoryPlace] = useState('');
  const [storyTwist, setStoryTwist] = useState('');
  const [storyGenerated, setStoryGenerated] = useState('');

  // Builder imagen (step 5)
  const [imgText, setImgText] = useState('');

  // Study case (step 6)
  const [studyIdx, setStudyIdx] = useState(0);

  // Builder explica (step 7)
  const [explainTopic, setExplainTopic] = useState('');
  const [explainGenerated, setExplainGenerated] = useState('');

  // Sprint 1 (step 8)
  const [sprint1Started, setSprint1Started] = useState(false);
  const [sprint1Done, setSprint1Done] = useState(0);
  const [sprint1Sec, setSprint1Sec] = useState(120);
  const [sprint1Finished, setSprint1Finished] = useState(false);

  // Compare (step 9)
  const [compareSelected, setCompareSelected] = useState<number | null>(null);
  const [compareAnswered, setCompareAnswered] = useState(false);

  // Reflexión 1 (step 10)
  const [reflect1, setReflect1] = useState('');

  // V/F (step 12)
  const [vfIdx, setVfIdx] = useState(0);
  const [vfScore, setVfScore] = useState(0);
  const [vfAnswered, setVfAnswered] = useState(false);
  const [vfSelected, setVfSelected] = useState<boolean | null>(null);
  const [vfDone, setVfDone] = useState(false);

  // Builder iteración (step 13)
  const [iterText, setIterText] = useState('');
  const [iterGenerated, setIterGenerated] = useState('');

  // Sprint 2 (step 14)
  const [sprint2Started, setSprint2Started] = useState(false);
  const [sprint2Done, setSprint2Done] = useState(0);
  const [sprint2Sec, setSprint2Sec] = useState(180);
  const [sprint2Finished, setSprint2Finished] = useState(false);

  // Galería (step 15)
  const [galleryTexts, setGalleryTexts] = useState<string[]>(['', '', '']);

  // Reflexión 2 (step 17)
  const [reflect2, setReflect2] = useState('');

  // Reflexión cierre (step 18)
  const [reflect3, setReflect3] = useState('');

  // Modo examen (bloquear retroceso) — coincide con THEORY_STEPS del HTML
  const NON_EXAM = [0, 1, 2, 6, 11, 16];
  const isExamMode = !NON_EXAM.includes(step);
  const THEORY_STEPS = new Set([1, 2, 6, 11, 16]);
  const goToPrevStep = () => { setStep(s => s - 1); };

  useEffect(() => {
    const onBackPress = () => {
      if (isExamMode) {
        Alert.alert(
          'Actividad en curso',
          'No puedes regresar mientras realizas esta actividad. Si sales, perderás el progreso.',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Salir', style: 'destructive', onPress: () => exitLevel({ confirm: false }) }
          ]
        );
        return true;
      }
      return false;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [isExamMode]);

  // Sprint 1 timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (sprint1Started && !sprint1Finished) {
      timer = setInterval(() => {
        setSprint1Sec(prev => {
          if (prev <= 1) {
            setSprint1Finished(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [sprint1Started, sprint1Finished]);

  // Sprint 2 timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (sprint2Started && !sprint2Finished) {
      timer = setInterval(() => {
        setSprint2Sec(prev => {
          if (prev <= 1) {
            setSprint2Finished(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [sprint2Started, sprint2Finished]);

  const [xpToast, setXpToast] = useState<{ amount: number; id: number } | null>(null);
  const addXP = (amount: number) => {
    setXp(prev => prev + amount);
    if (amount > 0) setXpToast(prev => ({ amount, id: (prev?.id ?? 0) + 1 }));
  };

  const goToNextStep = () => {
    if (step < TOTAL_STEPS - 1) setStep(step + 1);
  };

  const handleClose = () => {
    // Web: Alert.alert no renderiza modal en React Native Web → usar window.confirm
    if (Platform.OS === 'web') {
      const msg = isExamMode
        ? 'Estás en medio de una actividad. Si sales, perderás el progreso. ¿Seguro?'
        : '¿Seguro que quieres salir del nivel?';
      if (window.confirm(msg)) exitLevel({ confirm: false });
      return;
    }
    if (isExamMode) {
      Alert.alert(
        'Actividad en curso',
        'Estás en medio de una actividad. Si sales, perderás el progreso. ¿Seguro?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Salir', style: 'destructive', onPress: () => exitLevel({ confirm: false }) },
        ]
      );
    } else {
      Alert.alert('Salir', '¿Seguro que quieres salir del nivel?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Salir', onPress: () => exitLevel({ confirm: false }) },
      ]);
    }
  };

  const handleFinish = () => {
    let stars = 0;
    if (xp >= 130) stars = 3;
    else if (xp >= 80) stars = 2;
    else if (xp >= 40) stars = 1;
    completeLevel(4, stars, xp);
    router.replace('/level/5');
  };

  // Helpers para builders
  const allStoryFilled = storyGenre.trim().length >= 2 && storyChar.trim().length >= 2 && storyPlace.trim().length >= 2 && storyTwist.trim().length >= 2;
  const generateStoryPrompt = () => {
    const prompt = `Escribe una historia corta de máximo 150 palabras. Género: ${storyGenre}. Personaje principal: ${storyChar}. Lugar: ${storyPlace}. Giro final: ${storyTwist}. Tono entretenido para adolescentes.`;
    setStoryGenerated(prompt);
    addXP(10);
  };

  const generateExplainPrompt = () => {
    const prompt = `Explícame "${explainTopic}" como si tuviera 10 años. Usa una analogía cotidiana y un ejemplo concreto al final. Máximo 3 párrafos cortos.`;
    setExplainGenerated(prompt);
    addXP(10);
  };

  const generateIterPrompt = () => {
    const prompt = iterText + '\n\n→ Pídele a la IA: "Eso está bien, pero quiero que también incluyas un ejemplo práctico, que sea más corto (máximo 100 palabras) y con tono más amigable para alguien de mi edad."';
    setIterGenerated(prompt);
    addXP(10);
  };

  // V/F handlers (secuencial)
  const answerVF = (ans: boolean) => {
    if (vfAnswered) return;
    setVfSelected(ans);
    setVfAnswered(true);
    if (ans === vfItems[vfIdx].correct) setVfScore(prev => prev + 1);
  };
  const nextVF = () => {
    if (vfIdx + 1 >= vfItems.length) {
      setVfDone(true);
      addXP(vfScore * 8);
    } else {
      setVfIdx(prev => prev + 1);
      setVfAnswered(false);
      setVfSelected(null);
    }
  };

  // Sprint handlers
  const sprint1Next = () => {
    setSprint1Done(prev => {
      const n = prev + 1;
      if (n >= SPRINT_TASKS_1.length) setSprint1Finished(true);
      return n;
    });
  };
  const sprint2Next = () => {
    setSprint2Done(prev => {
      const n = prev + 1;
      if (n >= GIFTS.length) setSprint2Finished(true);
      return n;
    });
  };

  // ========== RENDERIZADO DE CADA PASO ==========

  const renderIntro = () => (
    <View style={styles.stepContainer}>
      <Tag variant="intro">Nivel 4 · 18 módulos</Tag>
      <View style={styles.iconContainer}><Text style={styles.iconEmoji}>🚀</Text></View>
      <Text style={styles.title}>¡Crea algo con IA Hoy!</Text>
      <Text style={styles.subtitle}>Hasta ahora aprendiste <Text style={styles.italic}>qué</Text> es la IA y <Text style={styles.italic}>cómo</Text> hablarle. Hoy das el siguiente paso: crear algo real con ella.</Text>
      <InfoCard variant="green" icon="🎯" iconBg="#bbf7d0" title="Qué vas a hacer hoy">Crear una historia · Generar una imagen con palabras · Pedir que te explique algo difícil · Comparar dos herramientas · Guardar tu galería de creaciones</InfoCard>
      <InfoCard variant="blue" icon="⚡" iconBg="#bfdbfe" title="Lo que necesitas">Una cuenta en <Text style={styles.bold}>ChatGPT</Text> o <Text style={styles.bold}>Claude</Text> (gratis). Si aún no tienes, el módulo 2 te guía paso a paso.</InfoCard>
      <Hl variant="green"><Text style={styles.bold}>De aprender sobre la IA a crear con ella.</Text> Este es el cambio más importante del curso.</Hl>
    </View>
  );

  const renderCreationSelector = () => (
    <View style={styles.stepContainer}>
      <Tag variant="lab">🎨 Módulo 1 · Clasificador</Tag>
      <Text style={styles.titleSm}>¿Qué puedo crear con IA?</Text>
      <Text style={styles.subtitle}>Toca los tipos de creación que más te llamen la atención.</Text>
      <View style={styles.grid2Cols}>
        {CREATION_TYPES.map((t, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.classBtn, creationSel.includes(i) && styles.classBtnSelected]}
            onPress={() => {
              setCreationSel(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
            }}
          >
            <Text style={styles.classIcon}>{t.icon}</Text>
            <Text style={styles.classLabel}>{t.label}</Text>
            <Text style={styles.classDesc}>{t.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {creationSel.length > 0 && (
        <Hl variant="green"><Text style={styles.bold}>{creationSel.length} tipo{creationSel.length > 1 ? 's' : ''} seleccionado{creationSel.length > 1 ? 's' : ''}.</Text> Todos estos los crearás antes de terminar el curso.</Hl>
      )}
      <View style={styles.inlineFooter}>
        <TouchableOpacity style={styles.backButton} onPress={goToPrevStep}>
          <Text style={styles.backButtonText}>← Volver</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.checkButtonFlex, (creationSel.length === 0 && !devMode) && styles.disabledButton]}
          onPress={() => { if (devMode || creationSel.length > 0) goToNextStep(); }}
          disabled={creationSel.length === 0 && !devMode}
        >
          <Text style={styles.checkButtonText}>Continuar →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderAccountGuide = () => (
    <View style={styles.stepContainer}>
      <Tag variant="cases">📱 Módulo 2 · Guía práctica</Tag>
      <Text style={styles.titleSm}>Tu primera cuenta en ChatGPT o Claude</Text>
      <Text style={styles.subtitle}>Ambas son gratuitas. Elige una y sigue los pasos.</Text>
      <View style={styles.stepList}>
        {[
          <Text key="s1"><Text style={styles.bold}>chat.openai.com</Text> (ChatGPT) o <Text style={styles.bold}>claude.ai</Text> (Claude)</Text>,
          <Text key="s2">Toca <Text style={styles.bold}>"Sign up"</Text> o <Text style={styles.bold}>"Registrarse"</Text></Text>,
          <Text key="s3">Ingresa tu correo y crea contraseña. No necesitas tarjeta.</Text>,
          <Text key="s4">Confirma tu correo (revisa tu bandeja de entrada)</Text>,
          <Text key="s5">¡Listo! Escribe tu primer mensaje</Text>,
        ].map((s, i) => (
          <View key={i} style={styles.stepRow}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
            <Text style={styles.stepText}>{s}</Text>
          </View>
        ))}
      </View>
      <InfoCard variant="green" icon="💡" iconBg="#bbf7d0" title="¿Cuál escoger?"><Text style={styles.bold}>ChatGPT</Text>: el más popular, genera imágenes. <Text style={styles.bold}>Claude</Text>: excelente para textos y razonamiento. Puedes tener ambas cuentas gratis.</InfoCard>
      <Hl variant="amber"><Text style={styles.bold}>📌 Si eres menor de 13 años,</Text> pídele a un adulto que te ayude a crear la cuenta.</Hl>
    </View>
  );

  const renderBuilderArea = () => (
    <View style={styles.stepContainer}>
      <Tag variant="build">🛠️ Módulo 3 · Builder</Tag>
      <Text style={styles.titleSm}>Pídele que te ayude con algo real</Text>
      <Text style={styles.subtitle}>Elige un área y escribe un prompt usando los 4 ingredientes del N3.</Text>
      <View style={styles.grid2Cols}>
        {BUILDER_AREAS.map((a, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.classBtn, builderAreaIdx === i && styles.classBtnSelected]}
            onPress={() => setBuilderAreaIdx(i)}
          >
            <Text style={styles.classIcon}>{a.emoji}</Text>
            <Text style={styles.classLabel}>{a.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {builderAreaIdx !== null && (
        <View style={{ marginTop: 12 }}>
          <Text style={styles.builderLabel}>✍️ Escribe tu prompt</Text>
          <TextInput
            style={styles.textArea}
            placeholder={BUILDER_AREAS[builderAreaIdx].placeholder}
            placeholderTextColor="#b8bcc0"
            value={builderText}
            onChangeText={setBuilderText}
            multiline
          />
          <Hl variant="green"><Text style={styles.bold}>💡 Plantilla sugerida:</Text>{'\n'}Actúa como un {BUILDER_AREAS[builderAreaIdx].rol}. {BUILDER_AREAS[builderAreaIdx].tarea}</Hl>
        </View>
      )}
      <TouchableOpacity
        style={[styles.checkButton, !devMode && (builderAreaIdx === null || builderText.trim().length < 15) && styles.disabledButton]}
        onPress={goToNextStep}
        disabled={!devMode && (builderAreaIdx === null || builderText.trim().length < 15)}
      >
        <Text style={styles.checkButtonText}>Continuar →</Text>
      </TouchableOpacity>
    </View>
  );

  const renderBuilderStory = () => (
    <View style={styles.stepContainer}>
      <Tag variant="build">📖 Módulo 4 · Builder</Tag>
      <Text style={styles.titleSm}>Crea una historia corta</Text>
      <Text style={styles.subtitle}>Completa los 4 ingredientes y armaremos el prompt.</Text>
      <Text style={styles.builderLabel}>🎭 Género</Text>
      <TextInput style={styles.input} placeholder="misterio, aventura, comedia, terror..." placeholderTextColor="#b8bcc0" value={storyGenre} onChangeText={setStoryGenre} />
      <Text style={styles.builderLabel}>🦸 Personaje principal</Text>
      <TextInput style={styles.input} placeholder="una científica de 14 años, un robot perdido..." placeholderTextColor="#b8bcc0" value={storyChar} onChangeText={setStoryChar} />
      <Text style={styles.builderLabel}>🌍 Lugar</Text>
      <TextInput style={styles.input} placeholder="el metro de Bogotá, una estación espacial..." placeholderTextColor="#b8bcc0" value={storyPlace} onChangeText={setStoryPlace} />
      <Text style={styles.builderLabel}>🌀 Giro final sorpresivo</Text>
      <TextInput style={styles.input} placeholder="resulta que el villano era su mejor amigo..." placeholderTextColor="#b8bcc0" value={storyTwist} onChangeText={setStoryTwist} />
      {storyGenerated ? (
        <View style={styles.resultBox}>
          <Text style={styles.resultText}>{storyGenerated}</Text>
        </View>
      ) : (
        <View style={styles.resultBoxEmpty}>
          <Text style={styles.resultEmptyText}>Tu prompt aparecerá aquí...</Text>
        </View>
      )}
      {!storyGenerated ? (
        <TouchableOpacity
          style={[styles.checkButton, !allStoryFilled && styles.disabledButton]}
          onPress={generateStoryPrompt}
          disabled={!allStoryFilled}
        >
          <Text style={styles.checkButtonText}>Generar prompt →</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}>
          <Text style={styles.checkButtonText}>Continuar →</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderBuilderImage = () => (
    <View style={styles.stepContainer}>
      <Tag variant="build">🖼️ Módulo 5 · Builder</Tag>
      <Text style={styles.titleSm}>Describe la imagen que quieres ver</Text>
      <Text style={styles.subtitle}>IAs como DALL-E o Midjourney generan imágenes desde texto. Practica el prompt aquí.</Text>
      <InfoCard variant="purple" icon="🎨" iconBg="#e9d5ff" title="Fórmula de un prompt de imagen"><Text style={styles.bold}>Objeto/personaje</Text> + <Text style={styles.bold}>estilo visual</Text> + <Text style={styles.bold}>colores</Text> + <Text style={styles.bold}>mood</Text></InfoCard>
      <Text style={styles.builderLabel}>Describe tu imagen en detalle (mínimo 20 palabras)</Text>
      <TextInput
        style={styles.textArea}
        placeholder="Ej: Un gato astronauta flotando en el espacio, estilo ilustración infantil, colores pastel suaves, mood tranquilo y soñador"
        placeholderTextColor="#b8bcc0"
        value={imgText}
        onChangeText={setImgText}
        multiline
      />
      <Hl variant="purple"><Text style={styles.bold}>💡 Palabras que potencian el prompt:</Text>{'\n'}<Text style={styles.italic}>cinematic · vibrant · minimalist · hyper-detailed · soft light · watercolor · anime style</Text></Hl>
      <TouchableOpacity
        style={[styles.checkButton, (imgText.trim().length < 20 && !devMode) && styles.disabledButton]}
        onPress={goToNextStep}
        disabled={imgText.trim().length < 20 && !devMode}
      >
        <Text style={styles.checkButtonText}>Continuar →</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStudyCases = () => {
    const p = STUDY_PROMPTS[studyIdx];
    return (
      <View style={styles.stepContainer}>
        <Tag variant="cases">📚 Módulo 6 · Casos reales</Tag>
        <Text style={styles.titleSm}>La IA como compañero de estudio</Text>
        <Text style={styles.subtitle}>El mismo tema, prompts distintos = resultados completamente diferentes.</Text>
        <View style={[styles.card, { backgroundColor: '#f8fafc', borderColor: '#e2e8f0', marginBottom: 8 }]}>
          <View style={styles.cardRow}>
            <View style={[styles.cardIcon, { backgroundColor: '#e2e8f0' }]}><Text style={{ fontSize: 18 }}>{p.emoji}</Text></View>
            <Text style={[styles.cardTitle, { alignSelf: 'center' }]}>{p.subject}</Text>
          </View>
        </View>
        <View style={styles.compareWrap}>
          <View style={[styles.comparePanel, styles.comparePanelA]}>
            <Text style={[styles.compareLabel, { color: '#c2410c' }]}>❌ PROMPT BÁSICO</Text>
            <Text style={styles.compareText}>{p.bad}</Text>
          </View>
          <View style={[styles.comparePanel, styles.comparePanelB]}>
            <Text style={[styles.compareLabel, { color: '#065f46' }]}>✅ PROMPT EFECTIVO</Text>
            <Text style={styles.compareText}>{p.good}</Text>
          </View>
        </View>
        <Hl variant="green"><Text style={styles.bold}>¿Por qué funciona mejor?</Text>{'\n'}{p.why}</Hl>
        {studyIdx < STUDY_PROMPTS.length - 1 && (
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStudyIdx(prev => Math.min(prev + 1, STUDY_PROMPTS.length - 1))}>
            <Text style={styles.secondaryBtnText}>Ver siguiente materia →</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderBuilderExplain = () => (
    <View style={styles.stepContainer}>
      <Tag variant="build">💡 Módulo 7 · Builder</Tag>
      <Text style={styles.titleSm}>Haz que la IA te enseñe algo difícil</Text>
      <Text style={styles.subtitle}>El prompt <Text style={styles.italic}>"explícame X como si tuviera 10 años"</Text> es uno de los más poderosos.</Text>
      <Text style={styles.builderLabel}>¿Qué tema no entiendes bien?</Text>
      <TextInput style={styles.input} placeholder="la relatividad especial, las derivadas, la guerra fría..." placeholderTextColor="#b8bcc0" value={explainTopic} onChangeText={setExplainTopic} />
      {explainGenerated ? (
        <View style={styles.resultBox}>
          <Text style={styles.resultText}>{explainGenerated}</Text>
        </View>
      ) : (
        <View style={styles.resultBoxEmpty}>
          <Text style={styles.resultEmptyText}>Tu prompt aparecerá aquí...</Text>
        </View>
      )}
      <Hl variant="blue"><Text style={styles.bold}>🧠 Por qué funciona:</Text>{'\n'}Pedir explicación "para alguien de 10 años" obliga a la IA a eliminar jerga técnica y usar analogías. La misma técnica que usan los mejores maestros del mundo.</Hl>
      {!explainGenerated ? (
        <TouchableOpacity
          style={[styles.checkButton, explainTopic.trim().length < 3 && styles.disabledButton]}
          onPress={generateExplainPrompt}
          disabled={explainTopic.trim().length < 3}
        >
          <Text style={styles.checkButtonText}>Ver prompt →</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}>
          <Text style={styles.checkButtonText}>Continuar →</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderSprint1 = () => (
    <View style={styles.stepContainer}>
      <Tag variant="sprint">⚡ Módulo 8 · Sprint creativo</Tag>
      {sprint1Finished ? (
        <View>
          <Text style={styles.sprintDoneText}>🎉 {Math.min(sprint1Done, SPRINT_TASKS_1.length)} de {SPRINT_TASKS_1.length} tareas. +{Math.min(sprint1Done, 5) * 8} XP</Text>
          <Hl variant="green"><Text style={styles.bold}>¡Cada prompt que escribiste fue una orden real a la IA.</Text> Cuantas más veces practiques, más rápido y preciso te vuelves.</Hl>
          <TouchableOpacity style={styles.checkButton} onPress={() => { addXP(Math.min(sprint1Done, 5) * 8); goToNextStep(); }}>
            <Text style={styles.checkButtonText}>Continuar →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View>
          <Text style={styles.titleSm}>Sprint: 5 ideas en 2 minutos</Text>
          <Text style={styles.subtitle}>Para cada tarea, escribe mentalmente el prompt que le darías a la IA.</Text>
          <Text style={styles.sprintTimer}>{Math.floor(sprint1Sec / 60)}:{String(sprint1Sec % 60).padStart(2, '0')}</Text>
          <View style={styles.sprintBar}>
            <View style={[styles.sprintBarFill, { width: `${(sprint1Sec / 120) * 100}%` }]} />
          </View>
          <View style={styles.sprintTaskCard}>
            <Text style={styles.sprintTaskText}>{sprint1Started ? SPRINT_TASKS_1[sprint1Done] : 'Toca "Iniciar" para comenzar'}</Text>
          </View>
          <View style={styles.sprintBtns}>
            <TouchableOpacity style={[styles.sprintStartBtn, sprint1Started && styles.disabledButton]} onPress={() => setSprint1Started(true)} disabled={sprint1Started}>
              <Text style={styles.sprintBtnText}>▶ Iniciar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sprintNextBtn} onPress={sprint1Next} disabled={!sprint1Started}>
              <Text style={styles.sprintNextBtnText}>✓ Hecha →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  const renderCompare = () => (
    <View style={styles.stepContainer}>
      <Tag variant="compare">⚡ Módulo 9 · Compara herramientas</Tag>
      <Text style={styles.subtitle}>Le pedimos lo <Text style={styles.bold}>mismo</Text> a dos herramientas. ¿Cuál fue más útil?</Text>
      <View style={[styles.card, { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }]}>
        <View style={styles.cardRow}>
          <View style={[styles.cardIcon, { backgroundColor: '#dbeafe' }]}><Text style={{ fontSize: 18 }}>📋</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>El prompt</Text>
            <Text style={styles.cardText}>{COMPARE_TASK.task}</Text>
          </View>
        </View>
      </View>
      <View style={styles.compareWrap}>
        <View style={[styles.comparePanel, styles.comparePanelA]}>
          <Text style={[styles.compareLabel, { color: '#c2410c' }]}>🟠 HERRAMIENTA A</Text>
          <Text style={styles.compareText}>{COMPARE_TASK.resultA}</Text>
        </View>
        <View style={[styles.comparePanel, styles.comparePanelB]}>
          <Text style={[styles.compareLabel, { color: '#065f46' }]}>🟢 HERRAMIENTA B</Text>
          <Text style={styles.compareText}>{COMPARE_TASK.resultB}</Text>
        </View>
      </View>
      <Text style={[styles.subtitle, { marginBottom: 8 }]}><Text style={styles.bold}>¿Cuál fue más útil y por qué?</Text></Text>
      {COMPARE_TASK.options.map((opt, i) => {
        const dimmed = compareAnswered && compareSelected !== i;
        return (
          <TouchableOpacity
            key={i}
            style={[styles.quizOption, compareSelected === i && styles.quizOptionSelected, dimmed && { opacity: 0.45 }]}
            onPress={() => {
              if (compareAnswered) return;
              setCompareSelected(i);
              setCompareAnswered(true);
              if (i === COMPARE_TASK.correct) addXP(15);
            }}
            disabled={compareAnswered}
          >
            <Text style={styles.quizOptText}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
      {compareAnswered && (
        <View style={[styles.feedbackBar, compareSelected === COMPARE_TASK.correct ? styles.feedbackCorrect : styles.feedbackWrong]}>
          <Text style={compareSelected === COMPARE_TASK.correct ? styles.feedbackCorrectText : styles.feedbackWrongText}>
            {compareSelected === COMPARE_TASK.correct ? '✅ ' : '❌ '}{COMPARE_TASK.explain}
          </Text>
        </View>
      )}
      <TouchableOpacity
        style={[styles.checkButton, !compareAnswered && styles.disabledButton]}
        onPress={goToNextStep}
        disabled={!compareAnswered}
      >
        <Text style={styles.checkButtonText}>Continuar →</Text>
      </TouchableOpacity>
    </View>
  );

  const renderReflect1 = () => (
    <View style={styles.stepContainer}>
      <Tag variant="reflect">💬 Módulo 10 · Reflexión</Tag>
      <Text style={styles.titleSm}>Lo que más te sorprendió</Text>
      <Text style={styles.subtitle}>¿Cuál fue la cosa más increíble o inesperada que la IA hizo por ti hoy?</Text>
      <TextInput
        style={styles.reflectArea}
        placeholder="Ej: Me sorprendió que pudiera escribir una historia con exactamente los personajes que pedí, con un giro que no esperaba..."
        placeholderTextColor="#b8bcc0"
        value={reflect1}
        onChangeText={setReflect1}
        multiline
      />
      <Text style={styles.charCount}>{reflect1.trim().length} / mínimo 50 caracteres</Text>
      <TipBox>✅ Lo que te sorprende es donde está el aprendizaje real.</TipBox>
      <TouchableOpacity
        style={[styles.checkButton, (reflect1.trim().length < 50 && !devMode) && styles.disabledButton]}
        onPress={() => { addXP(10); goToNextStep(); }}
        disabled={reflect1.trim().length < 50 && !devMode}
      >
        <Text style={styles.checkButtonText}>Continuar →</Text>
      </TouchableOpacity>
    </View>
  );

  const renderFailedPrompts = () => (
    <View style={styles.stepContainer}>
      <Tag variant="cases">⚠️ Módulo 11 · Casos reales</Tag>
      <Text style={styles.titleSm}>Lo que no funcionó y por qué</Text>
      <Text style={styles.subtitle}>3 prompts que dan resultados decepcionantes — y la razón exacta.</Text>
      <InfoCard variant="red" icon="❌" iconBg="#fecdd3" title='"Hazme una presentación"'>No dice el <Text style={styles.bold}>tema</Text>, la <Text style={styles.bold}>audiencia</Text>, el <Text style={styles.bold}>número de slides</Text> ni el <Text style={styles.bold}>tono</Text>. La IA hace algo genérico inútil.</InfoCard>
      <InfoCard variant="red" icon="❌" iconBg="#fecdd3" title='"Dame información sobre Colombia"'>Colombia tiene historia, geografía, economía, cultura... La IA no sabe <Text style={styles.bold}>qué aspecto</Text> te interesa.</InfoCard>
      <InfoCard variant="red" icon="❌" iconBg="#fecdd3" title='"Escríbeme algo bonito"'>"Bonito" no significa nada para la IA. ¿Poema? ¿Carta? ¿Para quién? ¿Qué emoción?</InfoCard>
      <Hl variant="orange"><Text style={styles.bold}>Regla de oro:</Text> Si tú mismo no sabes exactamente qué quieres al escribir el prompt, la IA tampoco lo sabrá.</Hl>
    </View>
  );

  const renderVF = () => {
    if (vfDone) {
      const earned = vfScore * 8;
      return (
        <View style={styles.stepContainer}>
          <Tag variant="vf">✅ Resultado</Tag>
          <View style={styles.vfResultBox}><Text style={styles.vfResultText}>{vfScore}/{vfItems.length} correctas 🎯</Text></View>
          <Hl variant="green"><Text style={styles.bold}>+{earned} XP.</Text> {vfScore >= 4 ? 'Tienes una visión clara de lo que la IA puede y no puede hacer.' : 'Con la práctica esto se vuelve instintivo.'}</Hl>
          <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}>
            <Text style={styles.checkButtonText}>Continuar →</Text>
          </TouchableOpacity>
        </View>
      );
    }
    const item = vfItems[vfIdx];
    const correct = vfAnswered && vfSelected === item.correct;
    return (
      <View style={styles.stepContainer}>
        <Tag variant="vf">✔ Verdadero o Falso · {vfIdx + 1}/{vfItems.length}</Tag>
        <View style={styles.vfStmt}><Text style={styles.vfStmtText}>{item.stmt}</Text></View>
        <View style={styles.tfOpts}>
          <TouchableOpacity style={[styles.vfBtn, styles.vfTrue, vfAnswered && styles.disabledButton]} onPress={() => answerVF(true)} disabled={vfAnswered}>
            <Text style={styles.vfTrueText}>✅ Verdadero</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.vfBtn, styles.vfFalse, vfAnswered && styles.disabledButton]} onPress={() => answerVF(false)} disabled={vfAnswered}>
            <Text style={styles.vfFalseText}>❌ Falso</Text>
          </TouchableOpacity>
        </View>
        {vfAnswered && (
          <View style={[styles.feedbackBar, correct ? styles.feedbackCorrect : styles.feedbackWrong]}>
            <Text style={correct ? styles.feedbackCorrectText : styles.feedbackWrongText}>{correct ? '✅ ' : '❌ '}{item.explain}</Text>
          </View>
        )}
        {vfAnswered && (
          <TouchableOpacity style={styles.checkButton} onPress={nextVF}>
            <Text style={styles.checkButtonText}>{vfIdx + 1 >= vfItems.length ? 'Ver resultado →' : 'Siguiente →'}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderBuilderIter = () => (
    <View style={styles.stepContainer}>
      <Tag variant="build">🔄 Módulo 13 · Builder</Tag>
      <Text style={styles.titleSm}>Pídele que mejore su propia respuesta</Text>
      <Text style={styles.subtitle}>La iteración es la habilidad más subestimada del prompting. No te quedes con la primera respuesta.</Text>
      <Hl variant="green"><Text style={styles.bold}>Cómo funciona:</Text> Describes la respuesta que ya tienes + le dices exactamente cómo mejorarla.</Hl>
      <Text style={styles.builderLabel}>Describe una respuesta que la IA te haya dado (o inventa una)</Text>
      <TextInput
        style={styles.textArea}
        placeholder="Ej: La IA me explicó la fotosíntesis en 4 párrafos técnicos muy largos con mucha jerga..."
        placeholderTextColor="#b8bcc0"
        value={iterText}
        onChangeText={setIterText}
        multiline
      />
      {iterGenerated ? (
        <View style={styles.resultBox}>
          <Text style={styles.resultText}>{iterGenerated}</Text>
        </View>
      ) : (
        <View style={styles.resultBoxEmpty}>
          <Text style={styles.resultEmptyText}>Tu prompt de mejora aparecerá aquí...</Text>
        </View>
      )}
      {!iterGenerated ? (
        <TouchableOpacity
          style={[styles.checkButton, iterText.trim().length < 10 && styles.disabledButton]}
          onPress={generateIterPrompt}
          disabled={iterText.trim().length < 10}
        >
          <Text style={styles.checkButtonText}>Ver prompt de mejora →</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}>
          <Text style={styles.checkButtonText}>Continuar →</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderSprint2 = () => (
    <View style={styles.stepContainer}>
      <Tag variant="sprint">🎁 Módulo 14 · Sprint</Tag>
      <Text style={styles.titleSm}>Crea algo para alguien que quieres</Text>
      <Text style={styles.subtitle}>3 minutos para diseñar prompts de 3 regalos digitales.</Text>
      <InfoCard variant="green" icon="💡" iconBg="#bbf7d0" title="Ideas de regalos digitales">Poema personalizado · Historia con su nombre · Mensaje de cumpleaños único · Receta inventada en su honor</InfoCard>
      <Text style={styles.sprintTimer}>{Math.floor(sprint2Sec / 60)}:{String(sprint2Sec % 60).padStart(2, '0')}</Text>
      <View style={styles.sprintBar}>
        <View style={[styles.sprintBarFill, { width: `${(sprint2Sec / 180) * 100}%` }]} />
      </View>
      <View style={styles.sprintTaskCard}>
        <Text style={styles.sprintTaskText}>
          {sprint2Finished ? '¡Completaste los 3 regalos! 🎉' : sprint2Started ? GIFTS[sprint2Done] : 'Piensa: ¿para quién creas el primer regalo?'}
        </Text>
      </View>
      {sprint2Finished ? (
        <TouchableOpacity style={styles.checkButton} onPress={() => { addXP(Math.min(sprint2Done, 3) * 8); goToNextStep(); }}>
          <Text style={styles.checkButtonText}>Continuar →</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.sprintBtns}>
          <TouchableOpacity style={[styles.sprintStartBtn, sprint2Started && styles.disabledButton]} onPress={() => setSprint2Started(true)} disabled={sprint2Started}>
            <Text style={styles.sprintBtnText}>▶ Iniciar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sprintNextBtn} onPress={sprint2Next} disabled={!sprint2Started}>
            <Text style={styles.sprintNextBtnText}>✓ Listo →</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderGallery = () => (
    <View style={styles.stepContainer}>
      <Tag variant="gallery">🖼️ Módulo 15 · Galería</Tag>
      <Text style={styles.titleSm}>Tu primera galería de creaciones</Text>
      <Text style={styles.subtitle}>Guarda las 3 creaciones de las que más te enorgulleces hoy.</Text>
      {[0, 1, 2].map(i => (
        <View key={i} style={[styles.galleryItem, galleryTexts[i].trim().length >= 10 && styles.galleryItemFilled]}>
          <Text style={styles.galleryNum}>Creación {i + 1}</Text>
          <TextInput
            style={[styles.textArea, { marginBottom: 0 }]}
            placeholder="¿Qué pediste a la IA? ¿Qué resultado obtuviste?"
            placeholderTextColor="#b8bcc0"
            value={galleryTexts[i]}
            onChangeText={t => {
              const newTexts = [...galleryTexts];
              newTexts[i] = t;
              setGalleryTexts(newTexts);
            }}
            multiline
          />
        </View>
      ))}
      <TipBox><Text style={styles.bold}>✅ Esta galería queda en tu portafolio IA Explorer.</Text>{'\n'}Es evidencia real de que creaste con IA — no solo aprendiste sobre ella.</TipBox>
      <TouchableOpacity
        style={[styles.checkButton, (galleryTexts.filter(t => t.trim().length >= 10).length < 2 && !devMode) ? styles.disabledButton : {}]}
        onPress={() => { addXP(20); goToNextStep(); }}
        disabled={galleryTexts.filter(t => t.trim().length >= 10).length < 2 && !devMode}
      >
        <Text style={styles.checkButtonText}>Guardar galería →</Text>
      </TouchableOpacity>
    </View>
  );

  const renderWhenNotAI = () => (
    <View style={styles.stepContainer}>
      <Tag variant="vf">⚖️ Módulo 16 · Cuándo NO usar la IA</Tag>
      <Text style={styles.titleSm}>La IA no siempre es la respuesta</Text>
      <View style={[styles.card, { borderColor: '#fecdd3', backgroundColor: '#fff1f2' }]}>
        <View style={styles.cardRow}>
          <View style={[styles.cardIcon, { backgroundColor: '#fecdd3' }]}><Text style={{ fontSize: 18 }}>🚫</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Situaciones donde la IA NO ayuda bien</Text>
            <Text style={styles.cardText}>
              ❌ Información en tiempo real (noticias de hoy, precios actuales){'\n'}
              ❌ Apoyo emocional en crisis personal (duelo, emergencias){'\n'}
              ❌ Diagnósticos médicos sin revisión profesional{'\n'}
              ❌ Aprender algo de verdad (copiarle la tarea ≠ entenderla){'\n'}
              ❌ Cuando el proceso de hacerlo es parte del valor (dibujo a mano para regalar)
            </Text>
          </View>
        </View>
      </View>
      <Hl variant="amber"><Text style={styles.bold}>La regla:</Text> La IA amplifica lo que ya sabes hacer. Si no entiendes el resultado, no puedes saber si es bueno o malo.</Hl>
    </View>
  );

  const renderReflect2 = () => (
    <View style={styles.stepContainer}>
      <Tag variant="reflect">🤝 Módulo 17 · Reflexión</Tag>
      <Text style={styles.titleSm}>Muéstrale algo a alguien hoy</Text>
      <Text style={styles.subtitle}>¿A quién le mostrarías una de tus creaciones y por qué?</Text>
      <TextInput
        style={styles.reflectArea}
        placeholder="Ej: Le mostraría a mi mamá el poema que la IA escribió para ella. Le diría cómo armé el prompt..."
        placeholderTextColor="#b8bcc0"
        value={reflect2}
        onChangeText={setReflect2}
        multiline
      />
      <Text style={styles.charCount}>{reflect2.trim().length} / mínimo 50 caracteres</Text>
      <Hl variant="green"><Text style={styles.bold}>💡 Por qué importa compartir:</Text>{'\n'}Cuando le explicas a alguien lo que hiciste, consolidas lo que aprendiste.</Hl>
      <TouchableOpacity
        style={[styles.checkButton, (reflect2.trim().length < 50 && !devMode) && styles.disabledButton]}
        onPress={() => { addXP(10); goToNextStep(); }}
        disabled={reflect2.trim().length < 50 && !devMode}
      >
        <Text style={styles.checkButtonText}>Continuar →</Text>
      </TouchableOpacity>
    </View>
  );

  const renderReflect3 = () => (
    <View style={styles.stepContainer}>
      <Tag variant="reflect">✨ Módulo 18 · Reflexión de cierre</Tag>
      <Text style={styles.titleSm}>¿Qué creaste hoy que antes sentías imposible?</Text>
      <TextInput
        style={styles.reflectArea}
        placeholder="Ej: Nunca creí que podría inventar una historia con mis propios personajes tan rápido. Hoy lo hice en 3 minutos. También noté que el prompt importa más de lo que pensaba..."
        placeholderTextColor="#b8bcc0"
        value={reflect3}
        onChangeText={setReflect3}
        multiline
      />
      <Text style={styles.charCount}>{reflect3.trim().length} / mínimo 50 caracteres</Text>
      <TipBox><Text style={styles.bold}>✅ Esta reflexión queda en tu portafolio IA Explorer.</Text>{'\n'}Es la prueba de que hoy no solo aprendiste — creaste.</TipBox>
      <TouchableOpacity
        style={[styles.checkButtonBlue, (reflect3.trim().length < 50 && !devMode) && styles.disabledButton]}
        onPress={goToNextStep}
        disabled={reflect3.trim().length < 50 && !devMode}
      >
        <Text style={styles.checkButtonText}>Completar nivel →</Text>
      </TouchableOpacity>
    </View>
  );

  const renderCompletion = () => (
    <View style={styles.completeContainer}>
      <View style={styles.completeBadge}><Text style={styles.completeBadgeText}>🚀</Text></View>
      <Text style={styles.completeTitle}>¡Nivel 4 completado!</Text>
      <Text style={styles.completeSub}>Terminaste "¡Crea algo con IA Hoy!". Hoy no solo aprendiste — creaste. Con texto, con prompts, con intención. Eso es lo que hacen los creadores.</Text>
      <View style={styles.skillList}>
        {['Sé que puedo crear historias, imágenes, análisis y asistentes con IA', 'Escribí prompts reales con los 4 ingredientes del N3', 'Entiendo que iterar el prompt mejora el resultado', 'Sé cuándo la IA ayuda y cuándo no es la herramienta correcta', 'Guardé mi primera galería de creaciones'].map((skill, i) => (
          <View key={i} style={styles.skillRow}>
            <Text style={styles.skillCheck}>✓</Text>
            <Text style={styles.skillText}>{skill}</Text>
          </View>
        ))}
      </View>
      <View style={styles.nextHint}>
        <Text style={styles.nextHintText}>⚖️ <Text style={styles.bold}>Nivel 5: IA y Ética</Text>{'\n\n'}Ahora que ya creas con IA, vas a explorar las preguntas más importantes: ¿Qué usos son problemáticos? ¿Cómo te afecta la privacidad? ¿Qué pasa con los deepfakes?</Text>
      </View>
      <View style={styles.lvlBarWrap}>
        <Text style={styles.lvlBarLabel}>Nivel 4 de 36 completado · Mundo 1 — ¿Qué es la IA?</Text>
        <View style={styles.lvlBarOuter}><View style={styles.lvlBarInner} /></View>
      </View>
      <TouchableOpacity style={styles.finishButton} onPress={handleFinish}>
        <Text style={styles.finishButtonText}>Siguiente nivel →</Text>
      </TouchableOpacity>
    </View>
  );

  const renderContent = () => {
    switch (step) {
      case 0: return renderIntro();
      case 1: return renderCreationSelector();
      case 2: return renderAccountGuide();
      case 3: return renderBuilderArea();
      case 4: return renderBuilderStory();
      case 5: return renderBuilderImage();
      case 6: return renderStudyCases();
      case 7: return renderBuilderExplain();
      case 8: return renderSprint1();
      case 9: return renderCompare();
      case 10: return renderReflect1();
      case 11: return renderFailedPrompts();
      case 12: return renderVF();
      case 13: return renderBuilderIter();
      case 14: return renderSprint2();
      case 15: return renderGallery();
      case 16: return renderWhenNotAI();
      case 17: return renderReflect2();
      case 18: return renderReflect3();
      case 19: return renderCompletion();
      default: return null;
    }
  };

  const progressPercent = (step / (TOTAL_STEPS - 1)) * 100;
  const progLabel = step === 0 ? 'Introducción' : step < TOTAL_STEPS - 1 ? `Módulo ${step} de ${CONTENT_STEPS}` : '¡Nivel completado!';
  const stepsCounter = step === 0 ? '' : step < TOTAL_STEPS - 1 ? `${step} de ${CONTENT_STEPS} módulos completados` : `${CONTENT_STEPS} de ${CONTENT_STEPS} módulos completados`;

  // Steps de teoría con botón de footer (Continuar). Módulo 1 tiene su propio footer inline.
  const FOOTER_STEPS = [0, 2, 6, 11, 16];
  const showNextButton = FOOTER_STEPS.includes(step);
  const showBackButton = step > 0 && THEORY_STEPS.has(step) && showNextButton;

  const nextBtnLabel = () => {
    if (step === 0) return '¡Empezar! →';
    if (step === 2) return '¡Ya tengo mi cuenta! →';
    return 'Continuar →';
  };

  return (
    <View style={styles.screen}>
      <View style={styles.progressBar}>
        <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
          <MaterialIcons name="close" size={22} color="#065f46" />
        </TouchableOpacity>
        <View style={styles.progWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>
          <Text style={styles.progLabel}>{progLabel}</Text>
        </View>
        <Text style={styles.xpText}>{xp} XP</Text>
      </View>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {renderContent()}
      </ScrollView>
      {xpToast && <XPToast key={xpToast.id} amount={xpToast.amount} onHide={() => setXpToast(null)} />}
      {step < TOTAL_STEPS - 1 && (
        <View style={styles.btnRow}>
          {(showNextButton || step !== 19) && (
            <View style={styles.footerRow}>
              {showBackButton && (
                <TouchableOpacity style={styles.backButton} onPress={goToPrevStep}>
                  <Text style={styles.backButtonText}>← Volver</Text>
                </TouchableOpacity>
              )}
              {showNextButton && (
                <TouchableOpacity style={[styles.nextButton, showBackButton && styles.nextButtonFlex]} onPress={goToNextStep}>
                  <Text style={styles.nextButtonText}>{nextBtnLabel()}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          <View style={styles.dotsRow}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <View key={i} style={[styles.dot, i === step && styles.dotActive, i < step && styles.dotDone]} />
            ))}
          </View>
          {!!stepsCounter && <Text style={styles.stepsCounter}>{stepsCounter}</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  progressBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#ecfdf5', backgroundColor: '#ecfdf5' },
  closeBtn: { minWidth: 42, minHeight: 42, borderRadius: 10, backgroundColor: '#a7f3d040', borderWidth: 1, borderColor: '#a7f3d0', justifyContent: 'center', alignItems: 'center' },
  progWrap: { flex: 1, marginHorizontal: 9 },
  progressTrack: { height: 8, backgroundColor: '#a7f3d066', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#10b981', borderRadius: 4 },
  progLabel: { fontSize: 10, color: '#94a3b8', marginTop: 3, fontWeight: '500' },
  xpText: { ...typography.bold, fontSize: 12, color: '#065f46', backgroundColor: '#a7f3d0', paddingHorizontal: 11, paddingVertical: 4, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#6ee7b7' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 15, paddingBottom: 30 },
  stepContainer: { flex: 1 },
  tag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 11 },
  tagText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  iconContainer: { width: 68, height: 68, borderRadius: 20, backgroundColor: '#a7f3d0', justifyContent: 'center', alignItems: 'center', marginBottom: 13 },
  iconEmoji: { fontSize: 34 },
  title: { ...typography.extraBold, fontSize: 19, color: '#0f172a', marginBottom: 7, lineHeight: 25 },
  titleSm: { ...typography.extraBold, fontSize: 16, color: '#0f172a', marginBottom: 7, lineHeight: 22 },
  subtitle: { ...typography.regular, fontSize: 13, color: '#64748b', marginBottom: 13, lineHeight: 20 },
  bold: { fontWeight: '700', color: '#0f172a' },
  italic: { fontStyle: 'italic', color: '#64748b' },
  card: { borderRadius: 14, padding: 13, marginBottom: 9, borderWidth: 1, borderColor: '#e2e8f0' },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  cardIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  cardTitle: { ...typography.bold, fontSize: 12, color: '#0f172a', marginBottom: 3 },
  cardText: { ...typography.regular, fontSize: 12, color: '#334155', lineHeight: 18 },
  tipBox: { backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0', borderRadius: 10, padding: 11, marginTop: 10 },
  tipBoxText: { fontSize: 12, color: '#065f46', lineHeight: 18 },
  grid2Cols: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  classBtn: { width: '48.5%', padding: 11, borderRadius: 12, borderWidth: 2, borderColor: '#e2e8f0', backgroundColor: '#f8fafc', alignItems: 'center', marginBottom: 8 },
  classBtnSelected: { borderColor: '#10b981', backgroundColor: '#ecfdf5' },
  classIcon: { fontSize: 22, marginBottom: 5 },
  classLabel: { ...typography.bold, fontSize: 11, color: '#334155' },
  classDesc: { fontSize: 10, color: '#64748b', textAlign: 'center', fontWeight: '400' },
  stepList: { gap: 8, marginBottom: 12 },
  stepRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#10b981', justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  stepNumText: { color: '#fff', fontWeight: '700', fontSize: 10 },
  stepText: { flex: 1, ...typography.regular, fontSize: 12, color: '#334155', lineHeight: 18 },
  builderLabel: { ...typography.bold, fontSize: 11, color: '#065f46', marginBottom: 4, marginTop: 10 },
  input: { borderWidth: 1.5, borderColor: '#a7f3d0', borderRadius: 10, padding: 10, fontSize: 12, color: '#0f172a', backgroundColor: '#f0fdf4', marginBottom: 8 },
  textArea: { borderWidth: 1.5, borderColor: '#a7f3d0', borderRadius: 10, padding: 12, ...typography.regular, fontSize: 13, color: '#0f172a', textAlignVertical: 'top', minHeight: 80, backgroundColor: '#f0fdf4', marginBottom: 8 },
  reflectArea: { borderWidth: 1.5, borderColor: '#a7f3d0', borderRadius: 12, padding: 12, ...typography.regular, fontSize: 13, color: '#0f172a', textAlignVertical: 'top', minHeight: 90, backgroundColor: '#f0fdf4', lineHeight: 20 },
  resultBox: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0', borderWidth: 1.5, borderRadius: 12, padding: 12, marginBottom: 10, marginTop: 10 },
  resultText: { ...typography.regular, fontSize: 12, color: '#065f46', lineHeight: 18 },
  resultBoxEmpty: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0', borderWidth: 1.5, borderRadius: 12, padding: 12, marginBottom: 10, marginTop: 10, minHeight: 60, justifyContent: 'center' },
  resultEmptyText: { ...typography.regular, fontSize: 12, color: '#94a3b8', fontStyle: 'italic' },
  checkButton: { backgroundColor: '#10b981', padding: 13, borderRadius: 12, alignItems: 'center', marginTop: 16, minHeight: 48, justifyContent: 'center' },
  checkButtonBlue: { backgroundColor: '#2563eb', padding: 13, borderRadius: 12, alignItems: 'center', marginTop: 16, minHeight: 48, justifyContent: 'center' },
  checkButtonFlex: { flex: 1, backgroundColor: '#10b981', padding: 13, borderRadius: 12, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  checkButtonText: { ...typography.bold, color: '#fff', fontSize: 14 },
  disabledButton: { opacity: 0.4 },
  inlineFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  nextButton: { flex: 1, backgroundColor: '#10b981', padding: 14, borderRadius: 12, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  nextButtonText: { ...typography.bold, color: '#fff', fontSize: 15 },
  secondaryBtn: { padding: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#a7f3d0', backgroundColor: '#ecfdf5', alignItems: 'center', marginTop: 4 },
  secondaryBtnText: { ...typography.bold, fontSize: 12, color: '#065f46' },
  compareWrap: { flexDirection: 'column', gap: 8, marginVertical: 10 },
  comparePanel: { borderRadius: 12, padding: 12, borderWidth: 1.5 },
  comparePanelA: { backgroundColor: '#fff7ed', borderColor: '#fed7aa' },
  comparePanelB: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' },
  compareLabel: { ...typography.bold, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  compareText: { ...typography.regular, fontSize: 11, color: '#334155', fontStyle: 'italic', lineHeight: 16 },
  quizOption: { padding: 12, borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 11, marginBottom: 7, backgroundColor: '#f8fafc' },
  quizOptionSelected: { borderColor: '#10b981', backgroundColor: '#ecfdf5' },
  quizOptText: { ...typography.regular, fontSize: 12, color: '#334155', fontWeight: '600' },
  feedbackBar: { padding: 11, borderRadius: 10, marginTop: 8 },
  feedbackCorrect: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0', borderWidth: 1 },
  feedbackCorrectText: { color: '#065f46', fontSize: 12, fontWeight: '600', lineHeight: 18 },
  feedbackWrong: { backgroundColor: '#fff1f2', borderColor: '#fecdd3', borderWidth: 1 },
  feedbackWrongText: { color: '#991b1b', fontSize: 12, fontWeight: '600', lineHeight: 18 },
  charCount: { ...typography.regular, fontSize: 10, color: '#94a3b8', textAlign: 'right', marginTop: 4 },
  sprintTimer: { fontSize: 28, fontWeight: '800', color: '#10b981', textAlign: 'center', marginTop: 8, marginBottom: 4 },
  sprintBar: { height: 8, backgroundColor: '#e2e8f0', borderRadius: 4, overflow: 'hidden', marginBottom: 12 },
  sprintBarFill: { height: '100%', backgroundColor: '#10b981', borderRadius: 4 },
  sprintTaskCard: { backgroundColor: '#f0fdf4', borderRadius: 12, borderWidth: 1.5, borderColor: '#a7f3d0', padding: 14, marginBottom: 10 },
  sprintTaskText: { ...typography.bold, fontSize: 14, color: '#0f172a', textAlign: 'center', lineHeight: 20 },
  sprintDoneText: { textAlign: 'center', fontSize: 14, fontWeight: '700', color: '#065f46', paddingVertical: 16 },
  sprintBtns: { flexDirection: 'row', gap: 8, marginTop: 8 },
  sprintStartBtn: { flex: 1, padding: 11, borderRadius: 11, backgroundColor: '#10b981', alignItems: 'center' },
  sprintBtnText: { ...typography.bold, color: '#fff' },
  sprintNextBtn: { flex: 1, padding: 11, borderRadius: 11, backgroundColor: '#ecfdf5', borderWidth: 1.5, borderColor: '#a7f3d0', alignItems: 'center' },
  sprintNextBtnText: { ...typography.bold, color: '#065f46' },
  vfStmt: { padding: 13, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 },
  vfStmtText: { fontSize: 13, color: '#0f172a', fontWeight: '600', lineHeight: 20 },
  tfOpts: { flexDirection: 'row', gap: 10 },
  vfBtn: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 2, alignItems: 'center' },
  vfTrue: { borderColor: '#10b981', backgroundColor: '#ecfdf5' },
  vfTrueText: { fontWeight: '700', fontSize: 14, color: '#065f46' },
  vfFalse: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },
  vfFalseText: { fontWeight: '700', fontSize: 14, color: '#991b1b' },
  vfResultBox: { padding: 16, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 4 },
  vfResultText: { textAlign: 'center', fontSize: 15, fontWeight: '700', color: '#0f172a' },
  galleryItem: { backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, marginBottom: 10 },
  galleryItemFilled: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' },
  galleryNum: { fontSize: 10, fontWeight: '700', color: '#10b981', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  completeContainer: { alignItems: 'center', padding: 8 },
  completeBadge: { width: 88, height: 88, borderRadius: 24, backgroundColor: '#a7f3d0', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  completeBadgeText: { fontSize: 46 },
  completeTitle: { ...typography.extraBold, fontSize: 20, color: '#0f172a', marginBottom: 8, textAlign: 'center' },
  completeSub: { ...typography.regular, fontSize: 12, color: '#64748b', textAlign: 'center', lineHeight: 18, marginBottom: 16 },
  skillList: { backgroundColor: '#f0fdf4', borderRadius: 12, padding: 13, marginBottom: 14, borderWidth: 1, borderColor: '#a7f3d0', width: '100%' },
  skillRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 7 },
  skillCheck: { color: '#10b981', fontWeight: '700' },
  skillText: { ...typography.regular, fontSize: 12, color: '#334155', flex: 1, lineHeight: 18 },
  nextHint: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 11, borderWidth: 1, borderColor: '#e2e8f0', width: '100%', marginBottom: 14 },
  nextHintText: { ...typography.regular, fontSize: 12, color: '#334155', lineHeight: 18 },
  lvlBarWrap: { width: '100%', marginBottom: 14 },
  lvlBarLabel: { fontSize: 10, color: '#94a3b8', marginBottom: 4 },
  lvlBarOuter: { height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden' },
  lvlBarInner: { height: '100%', backgroundColor: '#10b981', borderRadius: 3, width: '11%' },
  finishButton: { backgroundColor: '#2563eb', padding: 14, borderRadius: 12, width: '100%', alignItems: 'center' },
  finishButtonText: { ...typography.bold, color: '#fff', fontSize: 15 },
  btnRow: { paddingHorizontal: 13, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', backgroundColor: '#fafcff' },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backButton: { backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#e2e8f0', paddingVertical: 13, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  backButtonText: { ...typography.bold, color: '#64748b', fontSize: 14 },
  nextButtonFlex: { flex: 1 },
  dotsRow: { flexDirection: 'row', gap: 3, justifyContent: 'center', flexWrap: 'wrap', paddingTop: 9 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#cbd5e1' },
  dotActive: { backgroundColor: '#10b981', width: 14 },
  dotDone: { backgroundColor: '#a7f3d0' },
  stepsCounter: { fontSize: 10, color: '#94a3b8', textAlign: 'center', paddingTop: 4 },
});
