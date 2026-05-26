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
import { useGameStore } from '../../store/gameStore';
import { colors, typography } from '../../theme';
import XPToast from '../../components/XPToast';

// ---------- Tipos y constantes ----------
interface Question {
  q: string;
  opts: string[];
  correct: number;
  explain: string;
}

interface TFItem {
  stmt: string;
  correct: boolean;
  explain: string;
}

interface PromptItem {
  task: string;
  bad: string;
  good: string;
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
  correct: 1, // B es correcta
  explain: 'La B es directamente usable — ya es el texto que se pidió. La A da consejos en lugar de escribir la disculpa. El mismo prompt en distintas herramientas puede dar utilidades muy diferentes.',
};

const VF_POOL: TFItem[] = [
  { stmt: 'Si la IA da una respuesta que no te gusta, no tiene sentido intentarlo de nuevo.', correct: false, explain: 'Falso. Reformular el prompt o pedir que "mejore" la respuesta anterior casi siempre da mejores resultados.' },
  { stmt: 'La IA puede crear imágenes con solo una descripción en texto.', correct: true, explain: 'Verdadero. Herramientas como DALL-E, Midjourney o Adobe Firefly generan imágenes a partir de texto.' },
  { stmt: 'Es imposible usar IA para estudiar materias escolares.', correct: false, explain: 'Falso. La IA es una de las mejores herramientas para estudiar: explica conceptos, da ejemplos, hace preguntas de práctica.' },
  { stmt: 'Pedirle a la IA que "mejore" su propia respuesta puede dar mejores resultados.', correct: true, explain: 'Verdadero. Frases como "hazlo más corto" o "agrega un ejemplo práctico" activan el refinamiento.' },
  { stmt: 'La IA recuerda todo lo que le contaste en sesiones anteriores.', correct: false, explain: 'Falso. Cada sesión nueva empieza desde cero.' },
  { stmt: 'Cuanto más específico es tu prompt, más útil suele ser la respuesta.', correct: true, explain: 'Verdadero. Especificar rol, audiencia, formato y objetivo es la regla de oro del prompting.' },
  { stmt: 'Si le pides a la IA información del futuro, dirá claramente que no sabe.', correct: false, explain: 'Falso. La IA puede alucinar información inventada. Siempre verifica datos factuales.' },
  { stmt: 'Solo adultos con conocimientos técnicos pueden usar herramientas de IA generativa.', correct: false, explain: 'Falso. Las interfaces están diseñadas para cualquier persona.' },
  { stmt: 'Un prompt muy largo siempre da mejor resultado que uno corto.', correct: false, explain: 'Falso. La calidad depende de la claridad, no del largo.' },
  { stmt: 'La IA puede ayudarte a crear un personaje de videojuego con poderes, historia y apariencia.', correct: true, explain: 'Verdadero. Puedes pedir nombre, backstory, habilidades, debilidades y frase icónica.' },
];

const SPRINT_TASKS_1 = [
  '✍️ Escribe el prompt para que la IA haga un chiste sobre la escuela',
  '🍕 Pide que invente una receta con ingredientes imposibles (helado + papas + limón)',
  '🎮 Describe un personaje de videojuego con un poder único que nadie haya inventado',
  '🌙 Pide una historia de 3 líneas que ocurra en la Luna esta noche',
  '🦁 Prompt para que la IA explique qué sueñan los leones',
];

const pickN = <T,>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};

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
  const [sprint1Idx, setSprint1Idx] = useState(0);
  const [sprint1Sec, setSprint1Sec] = useState(120);
  const [sprint1Finished, setSprint1Finished] = useState(false);

  // Compare (step 9)
  const [compareSelected, setCompareSelected] = useState<number | null>(null);
  const [compareChecked, setCompareChecked] = useState(false);

  // Reflexión 1 (step 10)
  const [reflect1, setReflect1] = useState('');

  // V/F (step 12)
  const [tfAnswers, setTfAnswers] = useState<{ [key: number]: boolean }>({});
  const [tfChecked, setTfChecked] = useState(false);

  // Builder iteración (step 13)
  const [iterText, setIterText] = useState('');
  const [iterGenerated, setIterGenerated] = useState('');

  // Sprint 2 (step 14)
  const [sprint2Started, setSprint2Started] = useState(false);
  const [sprint2Idx, setSprint2Idx] = useState(0);
  const [sprint2Sec, setSprint2Sec] = useState(180);
  const [sprint2Finished, setSprint2Finished] = useState(false);

  // Galería (step 15)
  const [galleryTexts, setGalleryTexts] = useState<string[]>(['', '', '']);

  // Reflexión 2 (step 17)
  const [reflect2, setReflect2] = useState('');

  // Reflexión cierre (step 18)
  const [reflect3, setReflect3] = useState('');

  // Modo examen (bloquear retroceso)
  const isExamMode = ![0, 2, 6, 11, 16, 19].includes(step);
  const THEORY_STEPS = new Set([1, 2, 6, 11, 16]);
  const goToPrevStep = () => { setStep(s => s - 1); };

  useEffect(() => {
    setAllowBack?.(!isExamMode);
  }, [isExamMode, setAllowBack]);

  useEffect(() => {
    const onBackPress = () => {
      if (isExamMode) {
        Alert.alert(
          'Actividad en curso',
          'No puedes regresar mientras realizas esta actividad. Si sales, perderás el progreso.',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Salir', style: 'destructive', onPress: () => router.back() }
          ]
        );
        return true;
      }
      return false;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [isExamMode, navigation]);

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
      if (window.confirm(msg)) router.back();
      return;
    }
    if (isExamMode) {
      Alert.alert(
        'Actividad en curso',
        'Estás en medio de una actividad. Si sales, perderás el progreso. ¿Seguro?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Salir', style: 'destructive', onPress: () => router.back() },
        ]
      );
    } else {
      Alert.alert('Salir', '¿Seguro que quieres salir del nivel?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Salir', onPress: () => router.back() },
      ]);
    }
  };

  const handleFinish = () => {
    let stars = 0;
    if (xp >= 130) stars = 3;
    else if (xp >= 80) stars = 2;
    else if (xp >= 40) stars = 1;
    completeLevel(1, 4, stars, xp);
    router.replace('/level/1/5');
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

  // ========== RENDERIZADO DE CADA PASO ==========

  const renderIntro = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>Nivel 4 · 18 módulos</Text>
      <View style={styles.iconContainer}><Text style={styles.iconEmoji}>🚀</Text></View>
      <Text style={styles.title}>¡Crea algo con IA Hoy!</Text>
      <Text style={styles.subtitle}>Hasta ahora aprendiste qué es la IA y cómo hablarle. Hoy das el siguiente paso: crear algo real con ella.</Text>
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <Text style={styles.cardIcon}>🎯</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Qué vas a hacer hoy</Text>
            <Text style={styles.cardText}>Crear una historia · Generar una imagen con palabras · Pedir que te explique algo difícil · Comparar dos herramientas · Guardar tu galería de creaciones</Text>
          </View>
        </View>
      </View>
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <Text style={styles.cardIcon}>⚡</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Lo que necesitas</Text>
            <Text style={styles.cardText}>Una cuenta en ChatGPT o Claude (gratis). Si aún no tienes, el módulo 2 te guía paso a paso.</Text>
          </View>
        </View>
      </View>
      <View style={styles.highlightBox}>
        <Text style={styles.highlightText}><Text style={styles.bold}>De aprender sobre la IA a crear con ella.</Text> Este es el cambio más importante del curso.</Text>
      </View>
    </View>
  );

  const renderCreationSelector = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>🎨 Módulo 1 · Clasificador</Text>
      <Text style={styles.title}>¿Qué puedo crear con IA?</Text>
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
        <View style={styles.highlightBox}>
          <Text style={styles.highlightText}><Text style={styles.bold}>{creationSel.length} tipo(s) seleccionado(s).</Text> Todos estos los crearás antes de terminar el curso.</Text>
        </View>
      )}
      <TouchableOpacity
        style={[styles.checkButton, (creationSel.length === 0 && !devMode) && styles.disabledButton]}
        onPress={() => { if (devMode || creationSel.length > 0) { addXP(5); goToNextStep(); } }}
        disabled={creationSel.length === 0 && !devMode}
      >
        <Text style={styles.checkButtonText}>Continuar →</Text>
      </TouchableOpacity>
    </View>
  );

  const renderAccountGuide = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>📱 Módulo 2 · Guía práctica</Text>
      <Text style={styles.title}>Tu primera cuenta en ChatGPT o Claude</Text>
      <Text style={styles.subtitle}>Ambas son gratuitas. Elige una y sigue los pasos.</Text>
      <View style={styles.stepList}>
        {['Ve a chat.openai.com (ChatGPT) o claude.ai (Claude)', 'Toca "Sign up" o "Registrarse"', 'Ingresa tu correo y crea contraseña. No necesitas tarjeta.', 'Confirma tu correo (revisa tu bandeja de entrada)', '¡Listo! Escribe tu primer mensaje'].map((s, i) => (
          <View key={i} style={styles.stepRow}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
            <Text style={styles.stepText}>{s}</Text>
          </View>
        ))}
      </View>
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <Text style={styles.cardIcon}>💡</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>¿Cuál escoger?</Text>
            <Text style={styles.cardText}>ChatGPT: el más popular, genera imágenes. Claude: excelente para textos y razonamiento. Puedes tener ambas cuentas gratis.</Text>
          </View>
        </View>
      </View>
      <View style={[styles.highlightBox, styles.highlightAmber]}>
        <Text style={styles.highlightTextAmber}><Text style={styles.bold}>📌 Si eres menor de 13 años,</Text> pídele a un adulto que te ayude a crear la cuenta.</Text>
      </View>
    </View>
  );

  const renderBuilderArea = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>🛠️ Módulo 3 · Builder</Text>
      <Text style={styles.title}>Pídele que te ayude con algo real</Text>
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
            value={builderText}
            onChangeText={setBuilderText}
            multiline
          />
          <View style={styles.highlightBox}>
            <Text style={styles.highlightText}>
              <Text style={styles.bold}>💡 Plantilla sugerida:</Text>
              {'\n'}Actúa como un {BUILDER_AREAS[builderAreaIdx].rol}. {BUILDER_AREAS[builderAreaIdx].tarea}
            </Text>
          </View>
        </View>
      )}
      <TouchableOpacity
        style={[styles.checkButton, !devMode && (builderAreaIdx === null || builderText.trim().length < 15) && styles.disabledButton]}
        onPress={() => { addXP(10); goToNextStep(); }}
        disabled={!devMode && (builderAreaIdx === null || builderText.trim().length < 15)}
      >
        <Text style={styles.checkButtonText}>Continuar →</Text>
      </TouchableOpacity>
    </View>
  );

  const renderBuilderStory = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>📖 Módulo 4 · Builder</Text>
      <Text style={styles.title}>Crea una historia corta</Text>
      <Text style={styles.subtitle}>Completa los 4 ingredientes y armaremos el prompt.</Text>
      <Text style={styles.builderLabel}>🎭 Género</Text>
      <TextInput style={styles.input} placeholder="misterio, aventura, comedia, terror..." value={storyGenre} onChangeText={setStoryGenre} />
      <Text style={styles.builderLabel}>🦸 Personaje principal</Text>
      <TextInput style={styles.input} placeholder="una científica de 14 años, un robot perdido..." value={storyChar} onChangeText={setStoryChar} />
      <Text style={styles.builderLabel}>🌍 Lugar</Text>
      <TextInput style={styles.input} placeholder="el metro de Bogotá, una estación espacial..." value={storyPlace} onChangeText={setStoryPlace} />
      <Text style={styles.builderLabel}>🌀 Giro final sorpresivo</Text>
      <TextInput style={styles.input} placeholder="resulta que el villano era su mejor amigo..." value={storyTwist} onChangeText={setStoryTwist} />
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
      <Text style={styles.tag}>🖼️ Módulo 5 · Builder</Text>
      <Text style={styles.title}>Describe la imagen que quieres ver</Text>
      <Text style={styles.subtitle}>IAs como DALL-E o Midjourney generan imágenes desde texto. Practica el prompt aquí.</Text>
      <View style={[styles.card, { backgroundColor: '#faf5ff', borderColor: '#e9d5ff' }]}>
        <View style={styles.cardRow}>
          <Text style={styles.cardIcon}>🎨</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Fórmula de un prompt de imagen</Text>
            <Text style={styles.cardText}>Objeto/personaje + estilo visual + colores + mood</Text>
          </View>
        </View>
      </View>
      <Text style={styles.builderLabel}>Describe tu imagen en detalle (mínimo 20 palabras)</Text>
      <TextInput
        style={styles.textArea}
        placeholder="Ej: Un gato astronauta flotando en el espacio, estilo ilustración infantil, colores pastel suaves, mood tranquilo y soñador"
        value={imgText}
        onChangeText={setImgText}
        multiline
      />
      <View style={[styles.highlightBox, styles.highlightPurple]}>
        <Text style={styles.highlightTextPurple}>
          <Text style={styles.bold}>💡 Palabras que potencian el prompt:</Text>
          {'\n'}cinematic · vibrant · minimalist · hyper-detailed · soft light · watercolor · anime style
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.checkButton, (imgText.trim().length < 20 && !devMode) && styles.disabledButton]}
        onPress={() => { addXP(10); goToNextStep(); }}
        disabled={imgText.trim().length < 20 && !devMode}
      >
        <Text style={styles.checkButtonText}>Continuar →</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStudyCases = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>📚 Módulo 6 · Casos reales</Text>
      <Text style={styles.title}>La IA como compañero de estudio</Text>
      <Text style={styles.subtitle}>El mismo tema, prompts distintos = resultados completamente diferentes.</Text>
      {(() => {
        const p = STUDY_PROMPTS[studyIdx];
        return (
          <View>
            <View style={styles.cardRow}>
              <Text style={styles.cardIcon}>{p.emoji}</Text>
              <Text style={styles.cardTitle}>{p.subject}</Text>
            </View>
            <View style={styles.compareRow}>
              <View style={[styles.comparePanel, styles.comparePanelBad]}>
                <Text style={styles.compareLabel}>❌ Prompt básico</Text>
                <Text style={styles.compareText}>{p.bad}</Text>
              </View>
              <View style={[styles.comparePanel, styles.comparePanelGood]}>
                <Text style={styles.compareLabel}>✅ Prompt efectivo</Text>
                <Text style={styles.compareText}>{p.good}</Text>
              </View>
            </View>
            <View style={styles.highlightBox}>
              <Text style={styles.highlightText}><Text style={styles.bold}>¿Por qué funciona mejor?</Text>{'\n'}{p.why}</Text>
            </View>
            {studyIdx < STUDY_PROMPTS.length - 1 && (
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStudyIdx(prev => Math.min(prev + 1, STUDY_PROMPTS.length - 1))}>
                <Text style={styles.secondaryBtnText}>Ver siguiente materia →</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })()}
    </View>
  );

  const renderBuilderExplain = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>💡 Módulo 7 · Builder</Text>
      <Text style={styles.title}>Haz que la IA te enseñe algo difícil</Text>
      <Text style={styles.subtitle}>El prompt "explícame X como si tuviera 10 años" es uno de los más poderosos.</Text>
      <Text style={styles.builderLabel}>¿Qué tema no entiendes bien?</Text>
      <TextInput style={styles.input} placeholder="la relatividad especial, las derivadas, la guerra fría..." value={explainTopic} onChangeText={setExplainTopic} />
      {explainGenerated ? (
        <View style={styles.resultBox}>
          <Text style={styles.resultText}>{explainGenerated}</Text>
        </View>
      ) : (
        <View style={styles.resultBoxEmpty}>
          <Text style={styles.resultEmptyText}>Tu prompt aparecerá aquí...</Text>
        </View>
      )}
      <View style={[styles.highlightBox, styles.highlightBlue]}>
        <Text style={styles.highlightTextBlue}>
          <Text style={styles.bold}>🧠 Por qué funciona:</Text>
          {'\n'}Pedir explicación "para alguien de 10 años" obliga a la IA a eliminar jerga técnica y usar analogías.
        </Text>
      </View>
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
      <Text style={styles.tag}>⚡ Módulo 8 · Sprint creativo</Text>
      <Text style={styles.title}>Sprint: 5 ideas en 2 minutos</Text>
      <Text style={styles.subtitle}>Para cada tarea, escribe mentalmente el prompt que le darías a la IA.</Text>
      <Text style={styles.sprintTimer}>
        {Math.floor(sprint1Sec / 60)}:{String(sprint1Sec % 60).padStart(2, '0')}
      </Text>
      <View style={styles.sprintBar}>
        <View style={[styles.sprintBarFill, { width: `${(sprint1Sec / 120) * 100}%` }]} />
      </View>
      <View style={styles.sprintTaskCard}>
        <Text style={styles.sprintTaskText}>
          {sprint1Finished ? '¡Completaste todas las tareas! 🎉' : SPRINT_TASKS_1[sprint1Idx] || '¡Completaste todas las tareas! 🎉'}
        </Text>
      </View>
      <View style={styles.sprintBtns}>
        {!sprint1Started && !sprint1Finished && (
          <TouchableOpacity style={styles.sprintStartBtn} onPress={() => setSprint1Started(true)}>
            <Text style={styles.sprintBtnText}>▶ Iniciar</Text>
          </TouchableOpacity>
        )}
        {sprint1Started && !sprint1Finished && (
          <TouchableOpacity
            style={styles.sprintNextBtn}
            onPress={() => {
              if (sprint1Idx < SPRINT_TASKS_1.length - 1) {
                setSprint1Idx(prev => prev + 1);
              } else {
                setSprint1Finished(true);
              }
            }}
          >
            <Text style={styles.sprintNextBtnText}>✓ Hecha →</Text>
          </TouchableOpacity>
        )}
        {sprint1Finished && (
          <TouchableOpacity style={styles.checkButton} onPress={() => { addXP(Math.min(sprint1Idx, 5) * 8); goToNextStep(); }}>
            <Text style={styles.checkButtonText}>Continuar →</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderCompare = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>⚡ Módulo 9 · Compara herramientas</Text>
      <Text style={styles.subtitle}>Le pedimos lo <Text style={styles.bold}>mismo</Text> a dos herramientas. ¿Cuál fue más útil?</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📋 El prompt</Text>
        <Text style={styles.cardText}>{COMPARE_TASK.task}</Text>
      </View>
      <View style={styles.compareRow}>
        <View style={[styles.comparePanel, styles.comparePanelBad]}>
          <Text style={styles.compareLabel}>🟠 Herramienta A</Text>
          <Text style={styles.compareText}>{COMPARE_TASK.resultA}</Text>
        </View>
        <View style={[styles.comparePanel, styles.comparePanelGood]}>
          <Text style={styles.compareLabel}>🟢 Herramienta B</Text>
          <Text style={styles.compareText}>{COMPARE_TASK.resultB}</Text>
        </View>
      </View>
      <Text style={styles.subtitle}><Text style={styles.bold}>¿Cuál fue más útil y por qué?</Text></Text>
      {['Respuesta A — más formal y elaborada', 'Respuesta B — directa y lista para usar', 'Ambas son igual de útiles', 'Ninguna, el prompt era malo'].map((opt, i) => (
        <TouchableOpacity
          key={i}
          style={[styles.quizOption, compareSelected === i && styles.quizOptionSelected]}
          onPress={() => { if (!compareChecked) setCompareSelected(i); }}
          disabled={compareChecked}
        >
          <Text style={styles.quizOptText}>{opt}</Text>
        </TouchableOpacity>
      ))}
      {compareChecked && (
        <View style={[styles.feedbackBar, compareSelected === COMPARE_TASK.correct ? styles.feedbackCorrect : styles.feedbackWrong]}>
          <Text style={compareSelected === COMPARE_TASK.correct ? styles.feedbackCorrectText : styles.feedbackWrongText}>
            {compareSelected === COMPARE_TASK.correct ? '✅ ¡Correcto! ' : '❌ Incorrecto. '}
            {COMPARE_TASK.explain}
          </Text>
        </View>
      )}
      {!compareChecked ? (
        <TouchableOpacity
          style={[styles.checkButton, compareSelected === null && styles.disabledButton]}
          onPress={() => {
            setCompareChecked(true);
            if (compareSelected === COMPARE_TASK.correct) addXP(15);
          }}
          disabled={compareSelected === null}
        >
          <Text style={styles.checkButtonText}>Comprobar</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}>
          <Text style={styles.checkButtonText}>Continuar →</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderReflect1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>💬 Módulo 10 · Reflexión</Text>
      <Text style={styles.title}>Lo que más te sorprendió</Text>
      <Text style={styles.subtitle}>¿Cuál fue la cosa más increíble o inesperada que la IA hizo por ti hoy?</Text>
      <TextInput
        style={styles.textArea}
        placeholder="Ej: Me sorprendió que pudiera escribir una historia con exactamente los personajes que pedí..."
        value={reflect1}
        onChangeText={setReflect1}
        multiline
      />
      <Text style={styles.charCount}>{reflect1.trim().length} / mínimo 50 caracteres</Text>
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
      <Text style={styles.tag}>⚠️ Módulo 11 · Casos reales</Text>
      <Text style={styles.title}>Lo que no funcionó y por qué</Text>
      <Text style={styles.subtitle}>3 prompts que dan resultados decepcionantes — y la razón exacta.</Text>
      {[
        { title: '"Hazme una presentación"', text: 'No dice el tema, la audiencia, el número de slides ni el tono. La IA hace algo genérico inútil.' },
        { title: '"Dame información sobre Colombia"', text: 'Colombia tiene historia, geografía, economía, cultura... La IA no sabe qué aspecto te interesa.' },
        { title: '"Escríbeme algo bonito"', text: '"Bonito" no significa nada para la IA. ¿Poema? ¿Carta? ¿Para quién? ¿Qué emoción?' },
      ].map((item, i) => (
        <View key={i} style={[styles.card, { borderColor: '#fecdd3', backgroundColor: '#fff1f2' }]}>
          <View style={styles.cardRow}>
            <Text style={styles.cardIcon}>❌</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardText}>{item.text}</Text>
            </View>
          </View>
        </View>
      ))}
      <View style={[styles.highlightBox, styles.highlightOrange]}>
        <Text style={styles.highlightTextOrange}>
          <Text style={styles.bold}>Regla de oro:</Text> Si tú mismo no sabes exactamente qué quieres al escribir el prompt, la IA tampoco lo sabrá.
        </Text>
      </View>
    </View>
  );

  const renderVF = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>✅ Módulo 12 · V/F</Text>
      <Text style={styles.title}>Mitos y realidades de la creación con IA</Text>
      {vfItems.map((item, idx) => (
        <View key={idx} style={styles.tfSet}>
          <Text style={styles.tfQuestion}>{idx + 1}. {item.stmt}</Text>
          <View style={styles.tfOpts}>
            <TouchableOpacity
              style={[styles.tfBtn, tfAnswers[idx] === true && styles.tfBtnTrue]}
              onPress={() => { if (!tfChecked) setTfAnswers(prev => ({ ...prev, [idx]: true })); }}
              disabled={tfChecked}
            >
              <Text>✅ Verdadero</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tfBtn, tfAnswers[idx] === false && styles.tfBtnFalse]}
              onPress={() => { if (!tfChecked) setTfAnswers(prev => ({ ...prev, [idx]: false })); }}
              disabled={tfChecked}
            >
              <Text>❌ Falso</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
      {!tfChecked ? (
        <TouchableOpacity
          style={[styles.checkButton, (Object.keys(tfAnswers).length < vfItems.length && !devMode) && styles.disabledButton]}
          onPress={() => {
            if (devMode) { setTfChecked(true); addXP(20); return; }
            setTfChecked(true);
            let correct = 0;
            vfItems.forEach((item, idx) => { if (tfAnswers[idx] === item.correct) correct++; });
            const earned = correct * 5;
            if (earned > 0) addXP(earned);
          }}
          disabled={Object.keys(tfAnswers).length < vfItems.length && !devMode}
        >
          <Text style={styles.checkButtonText}>Comprobar</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}>
          <Text style={styles.checkButtonText}>Continuar →</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderBuilderIter = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>🔄 Módulo 13 · Builder</Text>
      <Text style={styles.title}>Pídele que mejore su propia respuesta</Text>
      <Text style={styles.subtitle}>La iteración es la habilidad más subestimada del prompting.</Text>
      <View style={styles.highlightBox}>
        <Text style={styles.highlightText}>Cómo funciona: Describes la respuesta que ya tienes + le dices exactamente cómo mejorarla.</Text>
      </View>
      <Text style={styles.builderLabel}>Describe una respuesta que la IA te haya dado (o inventa una)</Text>
      <TextInput
        style={styles.textArea}
        placeholder="Ej: La IA me explicó la fotosíntesis en 4 párrafos técnicos muy largos con mucha jerga..."
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
      <Text style={styles.tag}>🎁 Módulo 14 · Sprint</Text>
      <Text style={styles.title}>Crea algo para alguien que quieres</Text>
      <Text style={styles.subtitle}>3 minutos para diseñar prompts de 3 regalos digitales.</Text>
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <Text style={styles.cardIcon}>💡</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Ideas de regalos digitales</Text>
            <Text style={styles.cardText}>Poema personalizado · Historia con su nombre · Mensaje de cumpleaños único · Receta inventada en su honor</Text>
          </View>
        </View>
      </View>
      <Text style={styles.sprintTimer}>
        {Math.floor(sprint2Sec / 60)}:{String(sprint2Sec % 60).padStart(2, '0')}
      </Text>
      <View style={styles.sprintBar}>
        <View style={[styles.sprintBarFill, { width: `${(sprint2Sec / 180) * 100}%` }]} />
      </View>
      <View style={styles.sprintTaskCard}>
        <Text style={styles.sprintTaskText}>
          {sprint2Finished
            ? '¡Completaste los 3 regalos! 🎉'
            : `🎁 Regalo ${sprint2Idx + 1}: ¿Para quién? Diseña el prompt de su regalo digital`
          }
        </Text>
      </View>
      <View style={styles.sprintBtns}>
        {!sprint2Started && !sprint2Finished && (
          <TouchableOpacity style={styles.sprintStartBtn} onPress={() => setSprint2Started(true)}>
            <Text style={styles.sprintBtnText}>▶ Iniciar</Text>
          </TouchableOpacity>
        )}
        {sprint2Started && !sprint2Finished && (
          <TouchableOpacity
            style={styles.sprintNextBtn}
            onPress={() => {
              if (sprint2Idx < 2) {
                setSprint2Idx(prev => prev + 1);
              } else {
                setSprint2Finished(true);
              }
            }}
          >
            <Text style={styles.sprintNextBtnText}>✓ Listo →</Text>
          </TouchableOpacity>
        )}
        {sprint2Finished && (
          <TouchableOpacity style={styles.checkButton} onPress={() => { addXP(Math.min(sprint2Idx, 3) * 8); goToNextStep(); }}>
            <Text style={styles.checkButtonText}>Continuar →</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderGallery = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>🖼️ Módulo 15 · Galería</Text>
      <Text style={styles.title}>Tu primera galería de creaciones</Text>
      <Text style={styles.subtitle}>Guarda las 3 creaciones de las que más te enorgulleces hoy.</Text>
      {[0, 1, 2].map(i => (
        <View key={i} style={[styles.card, galleryTexts[i].trim().length >= 10 && styles.cardFilled]}>
          <Text style={styles.galleryNum}>Creación {i + 1}</Text>
          <TextInput
            style={styles.textArea}
            placeholder="¿Qué pediste a la IA? ¿Qué resultado obtuviste?"
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
      <Text style={styles.tag}>⚖️ Módulo 16 · Cuándo NO usar la IA</Text>
      <Text style={styles.title}>La IA no siempre es la respuesta</Text>
      <View style={[styles.card, { borderColor: '#fecdd3', backgroundColor: '#fff1f2' }]}>
        <View style={styles.cardRow}>
          <Text style={styles.cardIcon}>🚫</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Situaciones donde la IA NO ayuda bien</Text>
            <Text style={styles.cardText}>
              ❌ Información en tiempo real (noticias de hoy, precios actuales){'\n'}
              ❌ Apoyo emocional en crisis personal{'\n'}
              ❌ Diagnósticos médicos sin revisión profesional{'\n'}
              ❌ Aprender algo de verdad (copiarle la tarea ≠ entenderla){'\n'}
              ❌ Cuando el proceso de hacerlo es parte del valor
            </Text>
          </View>
        </View>
      </View>
      <View style={[styles.highlightBox, styles.highlightAmber]}>
        <Text style={styles.highlightTextAmber}>
          <Text style={styles.bold}>La regla:</Text> La IA amplifica lo que ya sabes hacer. Si no entiendes el resultado, no puedes saber si es bueno o malo.
        </Text>
      </View>
    </View>
  );

  const renderReflect2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>🤝 Módulo 17 · Reflexión</Text>
      <Text style={styles.title}>Muéstrale algo a alguien hoy</Text>
      <Text style={styles.subtitle}>¿A quién le mostrarías una de tus creaciones y por qué?</Text>
      <TextInput
        style={styles.textArea}
        placeholder="Ej: Le mostraría a mi mamá el poema que la IA escribió para ella..."
        value={reflect2}
        onChangeText={setReflect2}
        multiline
      />
      <Text style={styles.charCount}>{reflect2.trim().length} / mínimo 50 caracteres</Text>
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
      <Text style={styles.tag}>✨ Módulo 18 · Reflexión de cierre</Text>
      <Text style={styles.title}>¿Qué creaste hoy que antes sentías imposible?</Text>
      <TextInput
        style={styles.textArea}
        placeholder="Ej: Nunca creí que podría inventar una historia con mis propios personajes tan rápido..."
        value={reflect3}
        onChangeText={setReflect3}
        multiline
      />
      <Text style={styles.charCount}>{reflect3.trim().length} / mínimo 50 caracteres</Text>
      <TouchableOpacity
        style={[styles.checkButton, (reflect3.trim().length < 50 && !devMode) && styles.disabledButton]}
        onPress={() => { addXP(10); goToNextStep(); }}
        disabled={reflect3.trim().length < 50 && !devMode}
      >
        <Text style={styles.checkButtonText}>Completar nivel →</Text>
      </TouchableOpacity>
    </View>
  );

  const renderCompletion = () => (
    <View style={styles.completeContainer}>
      <Text style={styles.completeBadgeText}>🚀</Text>
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
        <Text style={styles.nextHintText}>⚖️ Nivel 5: IA y Ética{'\n\n'}Ahora que ya creas con IA, vas a explorar las preguntas más importantes: ¿Qué usos son problemáticos? ¿Cómo te afecta la privacidad? ¿Qué pasa con los deepfakes?</Text>
      </View>
      <Text style={styles.xpEarnedText}>⭐ {xp} XP ganados en este nivel</Text>
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
  const showNextButton = step !== 19 && [0, 2, 6, 11, 16].includes(step);
  const showBackButton = step > 0 && THEORY_STEPS.has(step) && showNextButton;

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
        {renderContent()}
      </ScrollView>
      {xpToast && <XPToast key={xpToast.id} amount={xpToast.amount} onHide={() => setXpToast(null)} />}
      <View style={styles.footerRow}>
        {showBackButton && (
          <TouchableOpacity style={styles.backButton} onPress={goToPrevStep}>
            <Text style={styles.backButtonText}>← Volver</Text>
          </TouchableOpacity>
        )}
        {showNextButton && (
          <TouchableOpacity style={[styles.nextButton, showBackButton && styles.nextButtonFlex]} onPress={goToNextStep}>
            <Text style={styles.nextButtonText}>Continuar →</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  progressBar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  closeBtn: { padding: 4 },
  progressTrack: { flex: 1, height: 6, backgroundColor: colors.borderLight, borderRadius: 3, marginHorizontal: 12 },
  progressFill: { height: '100%', backgroundColor: colors.success, borderRadius: 3 },
  xpText: { ...typography.bold, fontSize: 14, color: colors.accentDark },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  stepContainer: { flex: 1 },
  tag: { fontSize: 11, fontWeight: '600', color: colors.primary, backgroundColor: '#eef2ff', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 12 },
  iconContainer: { width: 60, height: 60, borderRadius: 18, backgroundColor: '#dcfce7', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  iconEmoji: { fontSize: 30 },
  title: { ...typography.extraBold, fontSize: 19, color: colors.textPrimary, marginBottom: 6 },
  subtitle: { ...typography.regular, fontSize: 13, color: colors.textSecondary, marginBottom: 14, lineHeight: 18 },
  bodyText: { ...typography.regular, fontSize: 13, color: colors.textPrimary, lineHeight: 20, marginBottom: 12 },
  bold: { fontWeight: 'bold' },
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#dbeafe', textAlign: 'center', lineHeight: 36, fontSize: 18 },
  cardTitle: { ...typography.bold, fontSize: 13, color: colors.textPrimary, marginBottom: 4 },
  cardText: { ...typography.regular, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  cardFilled: { borderColor: colors.success, backgroundColor: '#f0fdf4' },
  highlightBox: { borderLeftWidth: 3, borderLeftColor: colors.success, padding: 11, backgroundColor: '#f0fdf4', marginVertical: 10, borderRadius: 4 },
  highlightText: { ...typography.regular, fontSize: 13, color: '#065f46', lineHeight: 20 },
  highlightAmber: { borderLeftColor: '#f59e0b', backgroundColor: '#fffbeb' },
  highlightTextAmber: { ...typography.regular, fontSize: 13, color: '#92400e', lineHeight: 20 },
  highlightPurple: { borderLeftColor: '#8b5cf6', backgroundColor: '#faf5ff' },
  highlightTextPurple: { ...typography.regular, fontSize: 13, color: '#5b21b6', lineHeight: 20 },
  highlightBlue: { borderLeftColor: '#3b82f6', backgroundColor: '#eff6ff' },
  highlightTextBlue: { ...typography.regular, fontSize: 13, color: '#1e40af', lineHeight: 20 },
  highlightOrange: { borderLeftColor: '#f97316', backgroundColor: '#fff7ed' },
  highlightTextOrange: { ...typography.regular, fontSize: 13, color: '#c2410c', lineHeight: 20 },
  grid2Cols: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  classBtn: { width: '48%', padding: 11, borderRadius: 12, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center' },
  classBtnSelected: { borderColor: colors.success, backgroundColor: '#ecfdf5' },
  classIcon: { fontSize: 24, marginBottom: 4 },
  classLabel: { ...typography.bold, fontSize: 11, color: colors.textPrimary },
  classDesc: { fontSize: 10, color: colors.textSecondary, textAlign: 'center' },
  stepList: { gap: 8, marginBottom: 14 },
  stepRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.success, justifyContent: 'center', alignItems: 'center' },
  stepNumText: { color: '#fff', fontWeight: '700', fontSize: 10 },
  stepText: { flex: 1, ...typography.regular, fontSize: 12, color: colors.textPrimary, lineHeight: 18 },
  builderLabel: { ...typography.bold, fontSize: 11, color: '#065f46', marginBottom: 4, marginTop: 10 },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, padding: 10, fontSize: 12, color: colors.textPrimary, backgroundColor: '#f0fdf4', marginBottom: 8 },
  textArea: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, ...typography.regular, fontSize: 13, color: colors.textPrimary, textAlignVertical: 'top', minHeight: 80, backgroundColor: '#fafafa', marginBottom: 8 },
  resultBox: { backgroundColor: '#ecfdf5', borderColor: colors.success, borderWidth: 1.5, borderRadius: 12, padding: 12, marginBottom: 10 },
  resultText: { ...typography.regular, fontSize: 12, color: '#065f46', lineHeight: 18 },
  resultBoxEmpty: { backgroundColor: '#f8fafc', borderColor: colors.border, borderWidth: 1.5, borderRadius: 12, padding: 12, marginBottom: 10, minHeight: 60, justifyContent: 'center' },
  resultEmptyText: { ...typography.regular, fontSize: 12, color: '#94a3b8', fontStyle: 'italic' },
  checkButton: { backgroundColor: colors.success, padding: 12, borderRadius: 11, alignItems: 'center', marginTop: 16 },
  checkButtonText: { ...typography.bold, color: '#fff' },
  disabledButton: { opacity: 0.4 },
  nextButton: { backgroundColor: colors.success, padding: 14, margin: 16, borderRadius: 11, alignItems: 'center' },
  nextButtonText: { ...typography.bold, color: '#fff', fontSize: 15 },
  secondaryBtn: { padding: 10, borderRadius: 10, borderWidth: 1.5, borderColor: colors.success, backgroundColor: '#ecfdf5', alignItems: 'center', marginTop: 8 },
  secondaryBtnText: { ...typography.bold, fontSize: 12, color: '#065f46' },
  compareRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  comparePanel: { flex: 1, borderRadius: 12, padding: 12, borderWidth: 1.5 },
  comparePanelBad: { backgroundColor: '#fff7ed', borderColor: '#fed7aa' },
  comparePanelGood: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' },
  compareLabel: { ...typography.bold, fontSize: 10, textTransform: 'uppercase', marginBottom: 6 },
  compareText: { ...typography.regular, fontSize: 11, color: colors.textPrimary, fontStyle: 'italic', lineHeight: 16 },
  quizOption: { padding: 12, borderWidth: 1.5, borderColor: colors.border, borderRadius: 11, marginBottom: 6, backgroundColor: colors.surface },
  quizOptionSelected: { borderColor: colors.success, backgroundColor: '#ecfdf5' },
  quizOptText: { ...typography.regular, fontSize: 12, color: colors.textPrimary },
  feedbackBar: { padding: 10, borderRadius: 10, marginTop: 8 },
  feedbackCorrect: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0', borderWidth: 1 },
  feedbackCorrectText: { color: '#065f46', ...typography.bold, fontSize: 12 },
  feedbackWrong: { backgroundColor: '#fff1f2', borderColor: '#fecdd3', borderWidth: 1 },
  feedbackWrongText: { color: '#991b1b', ...typography.bold, fontSize: 12 },
  charCount: { ...typography.regular, fontSize: 10, color: colors.textSecondary, textAlign: 'right', marginTop: 4 },
  sprintTimer: { fontSize: 28, fontWeight: '800', color: colors.success, textAlign: 'center', marginVertical: 8 },
  sprintBar: { height: 6, backgroundColor: colors.borderLight, borderRadius: 3, overflow: 'hidden', marginBottom: 12 },
  sprintBarFill: { height: '100%', backgroundColor: colors.success, borderRadius: 3 },
  sprintTaskCard: { backgroundColor: '#f0fdf4', borderRadius: 12, borderWidth: 1.5, borderColor: '#a7f3d0', padding: 14, marginBottom: 10 },
  sprintTaskText: { ...typography.bold, fontSize: 14, color: colors.textPrimary, textAlign: 'center', lineHeight: 20 },
  sprintBtns: { flexDirection: 'row', gap: 8, marginTop: 8 },
  sprintStartBtn: { flex: 1, padding: 11, borderRadius: 11, backgroundColor: colors.success, alignItems: 'center' },
  sprintBtnText: { ...typography.bold, color: '#fff' },
  sprintNextBtn: { flex: 1, padding: 11, borderRadius: 11, backgroundColor: '#ecfdf5', borderWidth: 1.5, borderColor: '#a7f3d0', alignItems: 'center' },
  sprintNextBtnText: { ...typography.bold, color: '#065f46' },
  tfSet: { marginBottom: 14 },
  tfQuestion: { ...typography.bold, fontSize: 13, color: colors.textPrimary, marginBottom: 8, padding: 11, backgroundColor: colors.surfaceVariant, borderRadius: 10 },
  tfOpts: { flexDirection: 'row', gap: 7 },
  tfBtn: { flex: 1, padding: 12, borderRadius: 11, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center' },
  tfBtnTrue: { borderColor: colors.success, backgroundColor: '#f0fdf4' },
  tfBtnFalse: { borderColor: colors.error, backgroundColor: '#fff1f2' },
  galleryNum: { fontSize: 10, fontWeight: '700', color: colors.success, textTransform: 'uppercase', marginBottom: 6 },
  completeContainer: { alignItems: 'center', padding: 20 },
  completeBadgeText: { fontSize: 44, marginBottom: 14 },
  completeTitle: { ...typography.extraBold, fontSize: 21, color: colors.textPrimary, marginBottom: 6 },
  completeSub: { ...typography.regular, fontSize: 12, color: colors.textSecondary, textAlign: 'center', lineHeight: 1.7, marginBottom: 16 },
  skillList: { backgroundColor: '#f0fdf4', borderRadius: 12, padding: 13, marginBottom: 14, borderWidth: 1, borderColor: '#a7f3d0', width: '100%' },
  skillRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  skillCheck: { color: colors.success, fontWeight: '700' },
  skillText: { ...typography.regular, fontSize: 12, color: colors.textPrimary, flex: 1, lineHeight: 18 },
  nextHint: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 11, borderWidth: 1, borderColor: colors.border, width: '100%', marginBottom: 12 },
  nextHintText: { ...typography.regular, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  xpEarnedText: { ...typography.bold, fontSize: 15, color: colors.accentDark, marginBottom: 14 },
  finishButton: { backgroundColor: colors.primary, padding: 14, borderRadius: 11, width: '100%', alignItems: 'center' },
  finishButtonText: { ...typography.bold, color: '#fff' },
  footerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  backButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 14, borderRadius: 11, alignItems: 'center', paddingHorizontal: 20 },
  backButtonText: { ...typography.bold, color: colors.textSecondary, fontSize: 15 },
  nextButtonFlex: { flex: 1, margin: 0 },
});