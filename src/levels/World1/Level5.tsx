import React, { useState, useEffect, useRef } from 'react';
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

// ---------- Tipos ----------
type EthicsItem = { scenario: string; correct: 'safe' | 'doubt' | 'bad'; explain: string };
type TrabajoItem = { text: string; correct: 'humano' | 'ia' | 'ambos' };
type PrivacidadTFItem = { stmt: string; correct: boolean; explain: string };
type FakeItem = { headline: string; source: string; isReal: boolean; explain: string };
type EticaQuizItem = { q: string; opts: string[]; correct: number; explain: string };
type EticaFillItem = { sentence: string; allOpts: string[]; correct: number; explain: string };
type SprintEticaItem = { stmt: string; correct: boolean };

const TOTAL_STEPS = 19; // 0:intro + 17 módulos + 1:complete
const CONTENT_STEPS = 18;

const pickN = <T,>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};

// ===================== POOLS DE DATOS =====================

const ETHICS_POOL: EthicsItem[] = [
  { scenario: 'Usas ChatGPT para que te explique un tema del colegio que no entendiste en clase.', correct: 'safe', explain: 'Uso ideal: aprender y entender contenidos. El LLM actúa como tutor personalizado.' },
  { scenario: 'Pegas el examen de tu compañero en ChatGPT para copiarte las respuestas y entregarlo como propio.', correct: 'bad', explain: 'Esto es deshonestidad académica. Además, no aprendes nada.' },
  { scenario: 'Le pides a un LLM que genere una imagen realista de tu profesor haciendo algo vergonzoso.', correct: 'bad', explain: 'Crear contenido falso y dañino sobre personas reales es problemático y potencialmente ilegal.' },
  { scenario: 'Usas un LLM para revisar la gramática de tu ensayo antes de entregarlo.', correct: 'safe', explain: 'Excelente uso. Revisar tu propio trabajo con IA es una habilidad valiosa.' },
  { scenario: 'Le preguntas a Claude cuántas calorías tiene una manzana para un trabajo de nutrición.', correct: 'safe', explain: 'Consulta de información general para proyecto educativo.' },
  { scenario: 'Usas un LLM para escribir mensajes fingiendo ser otra persona con el fin de engañar.', correct: 'bad', explain: 'Suplantar identidad para engañar es deshonesto y potencialmente ilegal.' },
  { scenario: 'Le pides a un LLM que te ayude a planear un viaje con tu familia.', correct: 'safe', explain: 'Uso práctico y legítimo. Verifica detalles con fuentes actuales.' },
  { scenario: 'Generas una foto falsa de un candidato político y la compartes en redes.', correct: 'bad', explain: 'Crear y difundir deepfakes de figuras políticas es desinformación deliberada.' },
  { scenario: 'Usas un LLM para traducir instrucciones de un manual técnico en inglés.', correct: 'safe', explain: 'Traducción para comprensión personal: uso totalmente válido.' },
  { scenario: 'Le preguntas a un LLM por síntomas de una enfermedad para decidir si vas al médico.', correct: 'doubt', explain: 'Dudoso. Los LLMs pueden dar información general pero NO reemplazan un diagnóstico médico.' },
];

const TRABAJO_POOL: TrabajoItem[] = [
  { text: 'Diagnosticar enfermedades por imágenes médicas', correct: 'ia' },
  { text: 'Consolar a un amigo que está triste', correct: 'humano' },
  { text: 'Traducir documentos al instante', correct: 'ia' },
  { text: 'Tomar decisiones éticas complejas', correct: 'humano' },
  { text: 'Generar 100 variaciones de un diseño en minutos', correct: 'ia' },
  { text: 'Dar clases presenciales con conexión emocional', correct: 'humano' },
  { text: 'Moderar contenido en redes 24/7', correct: 'ambos' },
  { text: 'Negociar un acuerdo de paz entre países', correct: 'humano' },
  { text: 'Escribir código básico para una app', correct: 'ambos' },
];

const PRIVACIDAD_TF_POOL: PrivacidadTFItem[] = [
  { stmt: 'Lo que le dices a ChatGPT puede ser usado para mejorar el modelo en el futuro.', correct: true, explain: 'Sí — en planes gratuitos las conversaciones pueden usarse para entrenamiento. Verifica los términos.' },
  { stmt: 'Puedes compartir la contraseña de tu cuenta bancaria con un LLM sin ningún riesgo.', correct: false, explain: 'Nunca compartas contraseñas ni datos financieros con ningún servicio en línea.' },
  { stmt: 'Los LLMs guardan automáticamente toda tu información personal para venderla a anunciantes.', correct: false, explain: 'Falso. Pero sí guardan conversaciones para mejorar el modelo — revisa las políticas.' },
  { stmt: 'Es seguro compartir tu nombre y ciudad con un LLM para que personalice mejor sus respuestas.', correct: true, explain: 'En general sí, con sentido común. Información de contexto general es útil y segura.' },
  { stmt: 'Si usas un LLM en modo incógnito, tus datos no se guardan en los servidores.', correct: false, explain: 'El modo incógnito solo evita historial local. Los servidores siguen procesando la conversación.' },
  { stmt: 'Nunca debes compartir el número de identificación de otra persona con un LLM.', correct: true, explain: 'Correcto. Datos sensibles de terceros no deben compartirse sin consentimiento.' },
  { stmt: 'Los LLMs pueden acceder a tu cámara y micrófono sin permiso.', correct: false, explain: 'Falso. No acceden a tu dispositivo más allá de lo que compartes explícitamente.' },
  { stmt: 'Es posible que tus conversaciones sean revisadas por personas del equipo del proveedor.', correct: true, explain: 'Sí — por seguridad, calidad y entrenamiento. No compartas información altamente confidencial.' },
  { stmt: 'Compartir código fuente privado de una empresa en un LLM gratuito viola la confidencialidad.', correct: true, explain: 'Correcto. Código propietario no debe compartirse en servicios externos sin autorización.' },
  { stmt: 'Una vez que cierras la conversación, el LLM olvida inmediatamente todo.', correct: false, explain: 'No necesariamente. Los datos pueden almacenarse según la política del proveedor.' },
];

const FAKE_POOL: FakeItem[] = [
  { headline: 'Colombia lanzó su primer satélite al espacio en 2023, el "Libertad 2".', source: 'Fuente: Agencia Espacial Colombiana', isReal: true, explain: 'Real. Colombia lanzó el CubeSat "Libertad 2" en 2023.' },
  { headline: 'El Papa Francisco declaró que la IA es "el mayor milagro tecnológico de la humanidad".', source: 'Fuente: Vatican News, marzo 2024', isReal: false, explain: 'Fabricado. El Papa ha hablado con cautela, no con ese entusiasmo absoluto.' },
  { headline: 'OpenAI alcanzó 100 millones de usuarios en ChatGPT en solo dos meses.', source: 'Fuente: Reuters, febrero 2023', isReal: true, explain: 'Real. Fue la app de consumo de más rápido crecimiento en la historia.' },
  { headline: 'Un juez de EE.UU. fue sancionado por presentar casos inventados por ChatGPT.', source: 'Fuente: NY Times, 2023', isReal: false, explain: 'Fue un ABOGADO, no un juez. Los pequeños cambios de detalle son desinformación común.' },
  { headline: 'Elon Musk demandó a OpenAI alegando que abandonó su misión sin fines de lucro.', source: 'Fuente: Bloomberg, marzo 2024', isReal: true, explain: 'Real. Musk presentó la demanda en marzo 2024.' },
  { headline: 'China prohibió totalmente el uso de ChatGPT para sus ciudadanos en 2024.', source: 'Fuente: CNBC Asia', isReal: false, explain: 'Parcialmente falso. Tiene restricciones pero no prohibición total.' },
  { headline: 'Google DeepMind desarrolló AlphaFold, que predice proteínas y ganó el Nobel de Química.', source: 'Fuente: Nature, octubre 2024', isReal: true, explain: 'Real. Los creadores ganaron el Nobel de Química 2024.' },
  { headline: 'Una IA generó una vacuna funcional contra el dengue en 48 horas en Medellín.', source: 'Fuente: El Colombiano, 2024', isReal: false, explain: 'Fabricado. La IA acelera diseño pero el proceso completo toma años.' },
];

const SORT_SESGO = [
  'Datos de entrenamiento: La mayoría del texto en internet es de EE.UU. y Europa',
  'Sesgo emergente: El modelo conoce menos sobre cultura e historia latinoamericanas',
  'Respuesta sesgada: Al preguntar sobre "mejores universidades", solo menciona Harvard, MIT y Oxford',
  'Impacto real: Un estudiante colombiano cree que no hay buenas universidades en su país',
  'Consecuencia social: Se refuerza la idea de que lo bueno siempre viene de afuera',
];

const ETICA_QUIZ_POOL: EticaQuizItem[] = [
  { q: '¿Cuál es el mayor riesgo ético de los deepfakes de personas reales?', opts: ['Son difíciles de crear', 'Pueden dañar reputaciones y manipular opinión pública', 'Usan demasiada energía', 'Solo funcionan con rostros humanos'], correct: 1, explain: 'Los deepfakes pueden destruir reputaciones e influir en elecciones.' },
  { q: 'Si una IA de contratación rechaza candidatos de ciertas regiones, ¿qué tipo de problema es?', opts: ['Error técnico', 'Sesgo discriminatorio con consecuencias reales', 'Decisión correcta basada en datos', 'Problema de diseño'], correct: 1, explain: 'Es sesgo algorítmico con impacto real en oportunidades laborales.' },
  { q: '¿Qué significa que un sistema de IA sea "transparente"?', opts: ['Que es de color claro', 'Que no guarda datos', 'Que se entiende cómo toma decisiones', 'Que funciona más rápido'], correct: 2, explain: 'Transparencia = decisiones comprensibles y auditables.' },
  { q: '¿Por qué es problemático entrenar IA solo con datos en inglés?', opts: ['El inglés es complejo', 'Otros idiomas se quedan sin hablantes', 'Funciona peor con otras culturas e idiomas', 'Cuesta más computación'], correct: 2, explain: 'El sesgo lingüístico hace el modelo menos útil para culturas subrepresentadas.' },
  { q: '¿Cuál es un uso legítimo de IA generativa?', opts: ['Crear fotos falsas de un compañero', 'Generar variaciones de tu propio diseño', 'Escribir el ensayo de otro y cobrar', 'Crear una voz falsa para engañar'], correct: 1, explain: 'Usar IA para iterar tu propio trabajo creativo es ético y común.' },
  { q: '¿Qué es el "consentimiento informado" en IA?', opts: ['Aceptar cookies', 'Saber cómo se usan tus datos y tener control', 'La IA pide permiso antes de responder', 'La empresa informa cuánta energía usa'], correct: 1, explain: 'Las personas comprenden qué datos se recopilan y tienen opción real de decidir.' },
  { q: '¿Qué hacer si encuentras un deepfake de una persona pública en redes?', opts: ['Compartirlo con un comentario', 'Ignorarlo', 'No compartir y reportarlo', 'Guardarlo para después'], correct: 2, explain: 'No compartir es lo mínimo. Reportar ayuda a las plataformas.' },
  { q: 'Una empresa monitorea emociones de empleados en videollamadas sin avisar. ¿Qué es?', opts: ['Estrategia innovadora', 'Violación de privacidad', 'Problema de internet', 'Mejora de productividad'], correct: 1, explain: 'Vigilancia sin consentimiento viola privacidad y dignidad.' },
  { q: '¿Por qué no basta que la IA "funcione bien" para ser ética?', opts: ['Nunca funciona bien', 'Eficiencia técnica no garantiza justicia social', 'Usuarios quieren más funciones', 'Ingenieros prefieren complejidad'], correct: 1, explain: 'Un sistema técnicamente perfecto puede ser socialmente dañino.' },
  { q: '¿Qué significa "IA centrada en el humano"?', opts: ['IA con apariencia humana', 'Priorizar bienestar y derechos sobre eficiencia', 'Solo humanos programan IA', 'IA solo responde sobre humanos'], correct: 1, explain: 'Pone a las personas en el centro de las decisiones de diseño.' },
];

const ETICA_FILL_POOL: EticaFillItem[] = [
  { sentence: 'Cuando una IA toma decisiones sin que nadie entienda por qué, es una "caja _____".', allOpts: ['negra', 'rota', 'vacía', 'lenta'], correct: 0, explain: '"Caja negra" describe sistemas no transparentes.' },
  { sentence: 'Crear videos falsos de personas reales con IA se llama _____.', allOpts: ['deepfake', 'backup', 'render', 'template'], correct: 0, explain: '"Deepfake" combina deep learning + fake.' },
  { sentence: 'El principio de saber cómo se usan tus datos se llama _____ informado.', allOpts: ['consentimiento', 'acuerdo', 'registro', 'permiso'], correct: 0, explain: '"Consentimiento informado" es un derecho fundamental.' },
  { sentence: 'Cuando una IA discrimina por datos históricos con prejuicios, es _____ algorítmico.', allOpts: ['sesgo', 'error', 'fallo', 'virus'], correct: 0, explain: '"Sesgo algorítmico" reproduce prejuicios de los datos.' },
  { sentence: 'La capacidad de explicar cómo una IA llegó a una conclusión se llama _____.', allOpts: ['transparencia', 'velocidad', 'precisión', 'memoria'], correct: 0, explain: '"Transparencia" permite auditar decisiones del sistema.' },
  { sentence: 'Tus datos personales como nombre y hábitos forman tu _____ digital.', allOpts: ['huella', 'perfil', 'sombra', 'código'], correct: 0, explain: '"Huella digital" es el rastro que dejas al usar internet.' },
];

const SPRINT_ETICA_POOL: SprintEticaItem[] = [
  { stmt: 'Usar IA para copiar un examen completo es deshonestidad académica', correct: true },
  { stmt: 'Los deepfakes son inofensivos porque todos saben que son falsos', correct: false },
  { stmt: 'Compartir tu contraseña con un LLM es seguro', correct: false },
  { stmt: 'Los sesgos en datos de entrenamiento pueden generar discriminación', correct: true },
  { stmt: 'Una IA que toma decisiones justas técnicamente siempre es ética', correct: false },
  { stmt: 'El consentimiento informado significa saber y aceptar cómo se usan tus datos', correct: true },
  { stmt: 'Reportar contenido falso generado por IA ayuda a reducir desinformación', correct: true },
  { stmt: 'Es seguro compartir información confidencial de tu empresa en ChatGPT gratuito', correct: false },
  { stmt: 'Usar IA para revisar y mejorar tu propia escritura es ético', correct: true },
  { stmt: 'Los modelos de IA son completamente neutrales porque son máquinas', correct: false },
  { stmt: 'Crear una imagen falsa de alguien para dañar su reputación tiene consecuencias legales', correct: true },
  { stmt: 'Si una IA discrimina, es culpa solo del algoritmo, no de quienes lo diseñaron', correct: false },
];

// ===================== COMPONENTE PRINCIPAL =====================
interface LevelProps {
  navigation?: any;
  setAllowBack?: (allow: boolean) => void;
}

export default function World1Level5({ navigation: propsNavigation, setAllowBack }: LevelProps) {
  const navigationFromHook = useNavigation();
  const navigation = propsNavigation || navigationFromHook;
  const completeLevel = useGameStore((state) => state.completeLevel);

  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);
  const [stepResult, setStepResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Pools aleatorios
  const [ethicsItems] = useState(() => pickN(ETHICS_POOL, 5));
  const [trabajoItems] = useState(() => pickN(TRABAJO_POOL, 7));
  const [privTfItems] = useState(() => pickN(PRIVACIDAD_TF_POOL, 5));
  const [fakeItems] = useState(() => pickN(FAKE_POOL, 4));
  const [quizItems] = useState(() => pickN(ETICA_QUIZ_POOL, 5));
  const [fillItems] = useState(() => pickN(ETICA_FILL_POOL, 3));
  const [sprintItems] = useState(() => pickN(SPRINT_ETICA_POOL, SPRINT_ETICA_POOL.length));

  // Estados de módulos
  const [ethicsQ, setEthicsQ] = useState(0);
  const [ethicsCorrect, setEthicsCorrect] = useState(0);
  const [ethicsDone, setEthicsDone] = useState(false);

  const [trabajoPlaced, setTrabajoPlaced] = useState<Record<number, string>>({});
  const [trabajoSel, setTrabajoSel] = useState<number | null>(null);
  const [trabajoOk, setTrabajoOk] = useState(false);
  const [trabajoAttempts, setTrabajoAttempts] = useState(0);

  const [tfAnswers, setTfAnswers] = useState<Record<number, boolean>>({});
  const [tfChecked, setTfChecked] = useState(false);

  const [fakeAnswers, setFakeAnswers] = useState<Record<number, boolean>>({});

  const [sortOrder, setSortOrder] = useState<number[]>([]);
  const [sortOk, setSortOk] = useState(false);

  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizChecked, setQuizChecked] = useState(false);

  const [fillAnswers, setFillAnswers] = useState<Record<number, number>>({});
  const [fillChecked, setFillChecked] = useState<Record<number, boolean>>({});

  const [sprintSec, setSprintSec] = useState(60);
  const [sprintQ, setSprintQ] = useState(0);
  const [sprintCorrect, setSprintCorrect] = useState(0);
  const [sprintDone, setSprintDone] = useState(false);
  const [sprintStarted, setSprintStarted] = useState(false);
  const sprintTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [manifiesto, setManifiesto] = useState({ a: '', b: '', c: '' });

  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());

  // Modo examen
  const examSteps = new Set([3, 5, 7, 9, 11, 13, 14, 15, 17]);
  const isExamMode = examSteps.has(step);

  useEffect(() => { setAllowBack?.(!isExamMode); }, [isExamMode, setAllowBack]);

  useEffect(() => {
    const onBackPress = () => {
      if (isExamMode) {
        Alert.alert('Módulo en curso', 'No puedes regresar durante esta actividad.', [
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
    if (step === 3) { setEthicsQ(0); setEthicsCorrect(0); setEthicsDone(false); }
    if (step === 5) { setTrabajoPlaced({}); setTrabajoSel(null); setTrabajoOk(false); setTrabajoAttempts(0); }
    if (step === 7) { setTfAnswers({}); setTfChecked(false); }
    if (step === 9) { setFakeAnswers({}); }
    if (step === 11) {
      const order = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5);
      setSortOrder(order);
      setSortOk(false);
    }
    if (step === 13) { setQuizAnswers({}); setQuizChecked(false); }
    if (step === 14) { setFillAnswers({}); setFillChecked({}); }
    if (step === 15) {
      setSprintSec(60); setSprintQ(0); setSprintCorrect(0); setSprintDone(false); setSprintStarted(false);
      if (sprintTimer.current) clearInterval(sprintTimer.current);
    }
    if (step === 17) { setManifiesto({ a: '', b: '', c: '' }); }
    if (step === 2) { setExpandedCards(new Set()); }
  }, [step]);

  const addXP = (amount: number) => setXp((prev) => prev + amount);
  const goToNextStep = () => { setStepResult(null); if (step < TOTAL_STEPS - 1) setStep(step + 1); };

  const showResult = (ok: boolean, msg: string, andAdvance = false) => {
    setStepResult({ ok, msg });
    if (andAdvance) setTimeout(() => goToNextStep(), 1800);
  };

  const handleClose = () => {
    if (isExamMode) {
      Alert.alert('Actividad en curso', 'Si sales perderás el progreso. ¿Seguro?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Salir', style: 'destructive', onPress: () => navigation.goBack() },
      ]);
    } else {
      Alert.alert('Salir', '¿Seguro que quieres salir?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Salir', onPress: () => navigation.goBack() },
      ]);
    }
  };

  const handleFinish = () => {
    let stars = 0;
    if (xp >= 180) stars = 3;
    else if (xp >= 120) stars = 2;
    else if (xp >= 60) stars = 1;
    completeLevel(1, 5, stars, xp);
    navigation.goBack();
  };

  // ============ MECÁNICAS ============

  // Ethics Judge (3)
  const answerEthics = (val: 'safe' | 'doubt' | 'bad') => {
    if (ethicsDone || ethicsQ >= ethicsItems.length) return;
    const item = ethicsItems[ethicsQ];
    const isOk = val === item.correct;
    if (isOk) setEthicsCorrect((prev) => prev + 1);
    
    if (ethicsQ + 1 >= ethicsItems.length) {
      const newCorrect = ethicsCorrect + (isOk ? 1 : 0);
      const earned = newCorrect >= 4 ? 25 : newCorrect >= 3 ? 18 : newCorrect >= 2 ? 12 : 5;
      addXP(earned);
      setEthicsDone(true);
    } else {
      setTimeout(() => setEthicsQ((prev) => prev + 1), 900);
    }
    Alert.alert(isOk ? '✅ ¡Correcto!' : '❌ Incorrecto', item.explain);
  };

  // Trabajo Drag (5)
  const dropTrabajoChip = (idx: number, col: string) => {
    setTrabajoPlaced((prev) => ({ ...prev, [idx]: col }));
    setTrabajoSel(null);
  };

  const returnTrabajoChip = (idx: number) => {
    setTrabajoPlaced((prev) => {
      const newPlaced = { ...prev };
      delete newPlaced[idx];
      return newPlaced;
    });
  };

  const checkTrabajoDrag = () => {
    if (trabajoOk) return true;
    const placed = Object.keys(trabajoPlaced).length;
    if (placed < trabajoItems.length) {
      Alert.alert('Incompleto', `Faltan ${trabajoItems.length - placed} tarjetas.`);
      return false;
    }
    setTrabajoAttempts((prev) => prev + 1);
    let correct = 0;
    const wrong: number[] = [];
    Object.entries(trabajoPlaced).forEach(([k, v]) => {
      const i = parseInt(k);
      if (v === trabajoItems[i].correct) correct++;
      else wrong.push(i);
    });
    if (correct === trabajoItems.length) {
      setTrabajoOk(true);
      const earned = trabajoAttempts === 0 ? 20 : 12;
      addXP(earned);
      showResult(true, `¡Perfecto! +${earned} XP`, true);
      return false;
    }
    Alert.alert('Revisa', `${correct} de ${trabajoItems.length} correctas. Las incorrectas vuelven.`);
    const newPlaced = { ...trabajoPlaced };
    wrong.forEach((i) => delete newPlaced[i]);
    setTrabajoPlaced(newPlaced);
    return false;
  };

  // TF Privacidad (7)
  const selectTF = (qi: number, val: boolean) => {
    if (tfChecked) return;
    setTfAnswers((prev) => ({ ...prev, [qi]: val }));
  };

  const checkTF = () => {
    if (tfChecked) return true;
    if (Object.keys(tfAnswers).length < privTfItems.length) {
      Alert.alert('Incompleto', 'Responde todas las afirmaciones.');
      return false;
    }
    setTfChecked(true);
    let correct = 0;
    privTfItems.forEach((item, idx) => { if (tfAnswers[idx] === item.correct) correct++; });
    addXP(correct * 5);
    showResult(true, `Resultado: ${correct}/${privTfItems.length} correctas. +${correct * 5} XP`, true);
    return false;
  };

  // Fake Detector (9)
  const answerFake = (qi: number, val: boolean) => {
    if (fakeAnswers[qi] !== undefined) return;
    setFakeAnswers((prev) => ({ ...prev, [qi]: val }));
    const item = fakeItems[qi];
    const isOk = val === item.isReal;
    Alert.alert(isOk ? '✅ ¡Correcto!' : '❌ Incorrecto', item.explain);
    
    // Check if all answered
    const newAnswers = { ...fakeAnswers, [qi]: val };
    if (Object.keys(newAnswers).length >= fakeItems.length) {
      let correct = 0;
      fakeItems.forEach((it, i) => {
        const ans = i === qi ? val : newAnswers[i];
        if (ans === it.isReal) correct++;
      });
      addXP(correct * 5);
    }
  };

  const canProceedFake = () => Object.keys(fakeAnswers).length >= fakeItems.length;

  // Sort (11)
  const moveSort = (pos: number, dir: number) => {
    const np = pos + dir;
    if (np < 0 || np >= sortOrder.length) return;
    const newOrder = [...sortOrder];
    [newOrder[pos], newOrder[np]] = [newOrder[np], newOrder[pos]];
    setSortOrder(newOrder);
  };

  const checkSort = () => {
    if (sortOk) return true;
    const isOk = sortOrder.every((v, i) => v === i);
    if (isOk) {
      setSortOk(true);
      addXP(15);
      showResult(true, '¡Exacto! Así es como el sesgo se convierte en daño real. +15 XP', true);
      return false;
    }
    Alert.alert('Incorrecto', 'Algunos pasos fuera de lugar.');
    return false;
  };

  // Quiz (13)
  const selectQuiz = (qi: number, oi: number) => {
    if (quizChecked) return;
    setQuizAnswers((prev) => ({ ...prev, [qi]: oi }));
  };

  const checkQuiz = () => {
    if (quizChecked) return true;
    if (Object.keys(quizAnswers).length < quizItems.length) {
      Alert.alert('Incompleto', 'Responde todas las preguntas.');
      return false;
    }
    setQuizChecked(true);
    let correct = 0;
    quizItems.forEach((q, idx) => { if (quizAnswers[idx] === q.correct) correct++; });
    addXP(correct * 8);
    showResult(true, `Resultado: ${correct}/${quizItems.length} correctas. +${correct * 8} XP`, true);
    return false;
  };

  // Fill (14)
  const selectFill = (qi: number, oi: number) => {
    if (fillChecked[qi]) return;
    const item = fillItems[qi];
    const isOk = oi === item.correct;
    setFillAnswers((prev) => ({ ...prev, [qi]: oi }));
    setFillChecked((prev) => ({ ...prev, [qi]: true }));
    if (isOk) addXP(8);
    Alert.alert(isOk ? '✅ ¡Correcto! +8 XP' : '❌ Incorrecto', item.explain);
  };

  const canProceedFill = () => Object.keys(fillChecked).length >= fillItems.length;

  // Sprint (15)
  const startSprint = () => {
    setSprintStarted(true);
    setSprintSec(60);
    setSprintQ(0);
    setSprintCorrect(0);
    setSprintDone(false);
    sprintTimer.current = setInterval(() => {
      setSprintSec((prev) => {
        if (prev <= 1) {
          clearInterval(sprintTimer.current!);
          finishSprint();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const answerSprint = (val: boolean) => {
    if (sprintDone || sprintQ >= sprintItems.length) return;
    const item = sprintItems[sprintQ];
    const isOk = val === item.correct;
    if (isOk) setSprintCorrect((prev) => prev + 1);
    if (sprintQ + 1 >= sprintItems.length) {
      const newCorrect = sprintCorrect + (isOk ? 1 : 0);
      const earned = newCorrect >= 10 ? 25 : newCorrect >= 7 ? 18 : newCorrect >= 4 ? 12 : 5;
      setSprintCorrect(newCorrect);
      addXP(earned);
      finishSprint();
    } else {
      setSprintQ((prev) => prev + 1);
    }
  };

  const finishSprint = () => {
    if (sprintDone) return;
    setSprintDone(true);
    if (sprintTimer.current) clearInterval(sprintTimer.current);
  };

  // Manifiesto (17)
  const updateManifiesto = (key: 'a' | 'b' | 'c', val: string) => {
    setManifiesto((prev) => ({ ...prev, [key]: val }));
  };

  const checkManifiesto = () => {
    const ok = manifiesto.a.trim().length >= 15 && manifiesto.b.trim().length >= 15 && manifiesto.c.trim().length >= 15;
    if (ok) { addXP(20); return true; }
    Alert.alert('Incompleto', 'Completa las 3 frases (mín. 15 caracteres cada una).');
    return false;
  };

  // ============ RENDERIZADO ============
  const renderIntro = () => (
    <View>
      <View style={styles.iconCircle}><Text style={{ fontSize: 34 }}>⚖️</Text></View>
      <Text style={styles.title}>IA con conciencia</Text>
      <Text style={styles.subtitle}>Sabes cómo funciona la IA. Ahora la pregunta más importante: ¿cómo quieres usarla? Este nivel cierra los Fundamentos.</Text>
      <View style={styles.card}><Text style={styles.cardTitle}>🎓 Cierras el Arco de Fundamentos</Text><Text style={styles.cardText}>Completar los 5 niveles base te da el bagaje para todo lo que sigue.</Text></View>
      <View style={styles.card}><Text style={styles.cardTitle}>🆕 Dos mecánicas nuevas</Text><Text style={styles.cardText}>Fake Detector para desinformación y tu Manifiesto Personal de uso ético.</Text></View>
      <View style={styles.card}><Text style={styles.cardTitle}>⭐ Hasta 250 XP</Text><Text style={styles.cardText}>18 módulos · ~40-50 min</Text></View>
    </View>
  );

  const renderTheory1 = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#ede9fe' }]}><Text style={[styles.tagText, { color: '#5b21b6' }]}>📖 Módulo 1 · Riesgos reales</Text></View>
      <Text style={styles.title}>¿La IA puede equivocarse de forma peligrosa?</Text>
      {['Daño por alucinación: El modelo inventa datos verídicos.', 'Discriminación algorítmica: IA rechazando currículums por sesgo.', 'Desinformación masiva: Deepfakes a escala sin precedentes.', 'Vigilancia sin consentimiento: Monitoreo sin saberlo.', 'Dependencia excesiva: Delegar sin supervisión humana.'].map((t, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
          <View style={styles.stepNum}><Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>{i + 1}</Text></View>
          <Text style={{ flex: 1, fontSize: 12, color: '#334155', lineHeight: 18 }}>{t}</Text>
        </View>
      ))}
      <View style={styles.highlight}><Text style={styles.highlightText}><Text style={{ fontWeight: 'bold' }}>💡 La clave:</Text> El problema rara vez es la tecnología sola — es la combinación con decisiones humanas.</Text></View>
    </View>
  );

  const renderCases = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fff7ed' }]}><Text style={[styles.tagText, { color: '#9a3412' }]}>🌍 Módulo 2 · Casos reales</Text></View>
      <Text style={styles.title}>Cuando la IA falló en el mundo real</Text>
      {[
        { emoji: '⚖️', title: 'El abogado y los casos inventados', sub: 'EE.UU., 2023', tag: 'ALUCINACIÓN', tagColor: '#991b1b', body: 'Un abogado usó ChatGPT para investigar precedentes legales. Citó 6 casos que NO existían. Fue sancionado.', fact: '📌 Los LLMs nunca son fuentes primarias para decisiones legales.' },
        { emoji: '📄', title: 'Amazon y el CV discriminatorio', sub: 'EE.UU., 2018', tag: 'SESGO', tagColor: '#7e22ce', body: 'IA de Amazon penalizaba CVs que mencionaban "mujeres". Entrenada con 10 años de contrataciones mayoritariamente masculinas.', fact: '📌 Los sesgos históricos se convierten en discriminación sistémica.' },
        { emoji: '🗳️', title: 'Deepfakes en elecciones de LATAM', sub: 'Latinoamérica, 2023-24', tag: 'DESINFORMACIÓN', tagColor: '#92400e', body: 'Audios y videos deepfake de candidatos circulando días antes de elecciones.', fact: '📌 El costo de crear deepfakes cayó a cero con herramientas gratuitas.' },
        { emoji: '🚔', title: 'Reconocimiento facial y arrestos falsos', sub: 'EE.UU., 2020-23', tag: 'SESGO RACIAL', tagColor: '#991b1b', body: '6 personas arrestadas incorrectamente. Todos afroamericanos. Mayor tasa de error en pieles oscuras.', fact: '📌 Consecuencias: arrestos reales de personas inocentes.' },
        { emoji: '🏥', title: 'IA médica que daba prioridad incorrecta', sub: 'EE.UU., 2019', tag: 'SESGO SISTÉMICO', tagColor: '#7e22ce', body: 'Algoritmo usaba gasto histórico como indicador. Pacientes afroamericanos subestimados por barreras de acceso.', fact: '📌 Afectó a decenas de millones. Reproducía inequidades estructurales.' },
      ].map((c, i) => (
        <TouchableOpacity key={i} style={styles.exCard} onPress={() => setExpandedCards((prev) => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return new Set(s); })}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 22 }}>{c.emoji}</Text>
            <View style={{ flex: 1 }}><Text style={{ fontWeight: 'bold', fontSize: 13 }}>{c.title}</Text><Text style={{ fontSize: 11, color: '#64748b' }}>{c.sub}</Text></View>
            <MaterialIcons name={expandedCards.has(i) ? 'keyboard-arrow-down' : 'keyboard-arrow-right'} size={20} color="#94a3b8" />
          </View>
          {expandedCards.has(i) && (
            <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#ddd6fe' }}>
              <View style={{ backgroundColor: '#fff1f2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 6 }}><Text style={{ fontSize: 10, fontWeight: 'bold', color: c.tagColor }}>{c.tag}</Text></View>
              <Text style={{ fontSize: 12, color: '#334155', lineHeight: 20 }}>{c.body}</Text>
              <Text style={{ fontSize: 11, backgroundColor: '#fffbeb', padding: 8, borderRadius: 8, color: '#92400e', marginTop: 6 }}>{c.fact}</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderEthics = () => {
    if (ethicsDone) {
      return (
        <View>
          <View style={[styles.tag, { backgroundColor: '#fdf4ff' }]}><Text style={[styles.tagText, { color: '#7e22ce' }]}>⚖️ Módulo 3 · Ethics Judge</Text></View>
          <Text style={styles.title}>¡Juez ético completado!</Text>
          <Text style={{ fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginVertical: 12 }}>{ethicsCorrect}/{ethicsItems.length} correctas</Text>
        </View>
      );
    }
    const item = ethicsItems[ethicsQ];
    return (
      <View>
        <View style={[styles.tag, { backgroundColor: '#fdf4ff' }]}><Text style={[styles.tagText, { color: '#7e22ce' }]}>⚖️ Módulo 3 · Ethics Judge</Text></View>
        <Text style={styles.title}>¿Seguro, dudoso o problemático?</Text>
        <Text style={{ fontSize: 11, color: '#64748b', textAlign: 'center', marginBottom: 8 }}>Situación {ethicsQ + 1} de {ethicsItems.length} · {ethicsCorrect} correctas</Text>
        <View style={[styles.card, { backgroundColor: '#f8fafc' }]}><Text style={{ fontSize: 12, color: '#334155', lineHeight: 20 }}>{item.scenario}</Text></View>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
          <TouchableOpacity style={[styles.ethBtn, { borderColor: '#10b981' }]} onPress={() => answerEthics('safe')}>
            <Text style={{ fontSize: 18 }}>✅</Text><Text style={{ fontSize: 10, fontWeight: 'bold' }}>Seguro</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.ethBtn, { borderColor: '#f59e0b' }]} onPress={() => answerEthics('doubt')}>
            <Text style={{ fontSize: 18 }}>🤔</Text><Text style={{ fontSize: 10, fontWeight: 'bold' }}>Dudoso</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.ethBtn, { borderColor: '#ef4444' }]} onPress={() => answerEthics('bad')}>
            <Text style={{ fontSize: 18 }}>⛔</Text><Text style={{ fontSize: 10, fontWeight: 'bold' }}>Problemático</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderTheory2 = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#ede9fe' }]}><Text style={[styles.tagText, { color: '#5b21b6' }]}>📖 Módulo 4 · IA y trabajo</Text></View>
      <Text style={styles.title}>¿La IA nos va a quitar el trabajo?</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <View style={[styles.vsCol, { backgroundColor: '#fff1f2' }]}>
          <Text style={[styles.vsHeader, { backgroundColor: '#fecdd3', color: '#991b1b' }]}>⚠️ IA puede</Text>
          {['Tareas repetitivas', 'Procesar datos masivos', 'Reconocer patrones', 'Traducir / transcribir', 'Primer borrador'].map((t, i) => <Text key={i} style={styles.vsItem}>{t}</Text>)}
        </View>
        <View style={[styles.vsCol, { backgroundColor: '#f0fdf4' }]}>
          <Text style={[styles.vsHeader, { backgroundColor: '#bbf7d0', color: '#166534' }]}>✅ Humanos tenemos</Text>
          {['Empatía real', 'Juicio ético', 'Creatividad vivida', 'Liderazgo', 'Responsabilidad'].map((t, i) => <Text key={i} style={styles.vsItem}>{t}</Text>)}
        </View>
      </View>
      <View style={styles.highlight}><Text style={styles.highlightText}>💡 La calculadora no quitó el trabajo a los matemáticos — los liberó para problemas más complejos.</Text></View>
    </View>
  );

  const renderTrabajoDrag = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#eff6ff' }]}><Text style={[styles.tagText, { color: '#1e40af' }]}>🧩 Módulo 5 · Clasificar</Text></View>
      <Text style={styles.title}>¿Lo hace un humano, una IA o ambos?</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 10, backgroundColor: '#f8fafc', borderRadius: 12, marginBottom: 10 }}>
        {trabajoItems.map((item, idx) => {
          if (trabajoPlaced[idx] !== undefined) return null;
          return (
            <TouchableOpacity
              key={idx}
              style={[styles.chip, trabajoSel === idx && { borderColor: '#7c3aed', backgroundColor: '#ede9fe' }]}
              onPress={() => setTrabajoSel(trabajoSel === idx ? null : idx)}
            >
              <Text style={{ fontSize: 11, color: '#334155' }}>{item.text}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {(['humano', 'ia', 'ambos'] as const).map((col) => (
        <TouchableOpacity
          key={col}
          style={[styles.dropCol, { marginBottom: 8 }]}
          onPress={() => { if (trabajoSel !== null) dropTrabajoChip(trabajoSel, col); }}
        >
          <Text style={{ fontWeight: 'bold', fontSize: 11, marginBottom: 4, color: col === 'humano' ? '#1e40af' : col === 'ia' ? '#5b21b6' : '#166534' }}>
            {col === 'humano' ? '🔵 Humano' : col === 'ia' ? '🟣 IA' : '🟢 Ambos'}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
            {Object.entries(trabajoPlaced).filter(([, v]) => v === col).map(([k]) => (
              <TouchableOpacity key={k} style={{ backgroundColor: col === 'humano' ? '#dbeafe' : col === 'ia' ? '#ede9fe' : '#dcfce7', padding: 6, borderRadius: 12 }} onPress={() => returnTrabajoChip(parseInt(k))}>
                <Text style={{ fontSize: 10, fontWeight: '600' }}>{trabajoItems[parseInt(k)].text} ✕</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderTheory3 = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#ede9fe' }]}><Text style={[styles.tagText, { color: '#5b21b6' }]}>📖 Módulo 6 · Privacidad</Text></View>
      <Text style={styles.title}>Lo que le dices a la IA no desaparece</Text>
      <View style={[styles.card, { backgroundColor: '#fff1f2' }]}><Text style={styles.cardTitle}>🚫 Nunca compartas</Text><Text style={styles.cardText}>Contraseñas, tarjetas, documentos de identidad, código propietario, datos médicos de terceros.</Text></View>
      <View style={[styles.card, { backgroundColor: '#f0fdf4' }]}><Text style={styles.cardTitle}>✅ Generalmente seguro</Text><Text style={styles.cardText}>Tu nombre, ciudad, nivel educativo, tema de tu proyecto, texto propio, preguntas generales.</Text></View>
      <View style={styles.highlight}><Text style={styles.highlightText}>💡 Si no lo publicarías en una red social, piénsalo antes de escribirlo en un LLM.</Text></View>
    </View>
  );

  const renderTF = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fef9ee' }]}><Text style={[styles.tagText, { color: '#92400e' }]}>🔒 Módulo 7 · V/F</Text></View>
      <Text style={styles.title}>Privacidad digital: mitos y realidades</Text>
      {privTfItems.map((item, idx) => (
        <View key={idx} style={{ marginBottom: 14 }}>
          <Text style={styles.tfQuestion}>{idx + 1}. {item.stmt}</Text>
          <View style={{ flexDirection: 'row', gap: 7 }}>
            <TouchableOpacity style={[styles.tfBtn, tfAnswers[idx] === true && { borderColor: '#7c3aed', backgroundColor: '#f5f3ff' }]} onPress={() => selectTF(idx, true)} disabled={tfChecked}>
              <Text style={{ fontWeight: 'bold' }}>✅ Verdadero</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tfBtn, tfAnswers[idx] === false && { borderColor: '#ef4444', backgroundColor: '#fff1f2' }]} onPress={() => selectTF(idx, false)} disabled={tfChecked}>
              <Text style={{ fontWeight: 'bold' }}>❌ Falso</Text>
            </TouchableOpacity>
          </View>
          {tfChecked && (
            <View style={{ padding: 8, backgroundColor: tfAnswers[idx] === item.correct ? '#dcfce7' : '#fff1f2', borderRadius: 8, marginTop: 6 }}>
              <Text style={{ fontSize: 12, color: tfAnswers[idx] === item.correct ? '#166534' : '#991b1b' }}>{item.explain}</Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );

  const renderTheory4 = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#ede9fe' }]}><Text style={[styles.tagText, { color: '#5b21b6' }]}>📖 Módulo 8 · Deepfakes</Text></View>
      <Text style={styles.title}>Deepfakes: cuando ver ya no es creer</Text>
      <Text style={styles.bodyText}>Un deepfake es contenido generado con IA que muestra a alguien diciendo o haciendo algo que nunca ocurrió.</Text>
      <View style={[styles.card, { backgroundColor: '#fffbeb' }]}>
        <Text style={{ fontWeight: 'bold', fontSize: 11, color: '#92400e', marginBottom: 4 }}>🇨🇴 Caso latinoamericano</Text>
        <Text style={{ fontSize: 11, color: '#334155' }}>En Argentina 2023, un audio deepfake de un candidato confesando robo se viralizó en WhatsApp. Era falso. Muchos nunca vieron la desmentida.</Text>
      </View>
    </View>
  );

  const renderFakeDetector = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#7c3aed20' }]}><Text style={[styles.tagText, { color: '#5b21b6' }]}>🆕 Módulo 9 · Fake Detector</Text></View>
      <Text style={styles.title}>¿Real o generado con IA?</Text>
      {fakeItems.map((item, idx) => (
        <View key={idx} style={[styles.card, { marginBottom: 10 }]}>
          <Text style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 4 }}>📰 {item.headline}</Text>
          <Text style={{ fontSize: 10, color: '#94a3b8', fontStyle: 'italic', marginBottom: 8 }}>{item.source}</Text>
          {fakeAnswers[idx] !== undefined ? (
            <View style={{ padding: 8, backgroundColor: fakeAnswers[idx] === item.isReal ? '#dcfce7' : '#fff1f2', borderRadius: 8 }}>
              <Text style={{ fontSize: 12, color: fakeAnswers[idx] === item.isReal ? '#166534' : '#991b1b' }}>{item.explain}</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 7 }}>
              <TouchableOpacity style={[styles.fakeBtn, { borderColor: '#10b981' }]} onPress={() => answerFake(idx, true)}>
                <Text style={{ fontWeight: 'bold', fontSize: 11 }}>✅ Real</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.fakeBtn, { borderColor: '#7c3aed' }]} onPress={() => answerFake(idx, false)}>
                <Text style={{ fontWeight: 'bold', fontSize: 11 }}>🤖 Fabricado</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ))}
    </View>
  );

  const renderTheory5 = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#ede9fe' }]}><Text style={[styles.tagText, { color: '#5b21b6' }]}>📖 Módulo 10 · Consecuencias</Text></View>
      <Text style={styles.title}>Cuando el sesgo se convierte en daño real</Text>
      <View style={[styles.card, { backgroundColor: '#faf5ff' }]}><Text style={styles.cardTitle}>🏦 Crédito bancario</Text><Text style={styles.cardText}>IA niega préstamos a ciertas zonas por datos históricos con sesgo estructural.</Text></View>
      <View style={[styles.card, { backgroundColor: '#fff1f2' }]}><Text style={styles.cardTitle}>👮 Justicia predictiva</Text><Text style={styles.cardText}>Sistemas que predicen reincidencia reproducen desigualdad histórica con apariencia de objetividad.</Text></View>
      <View style={[styles.card, { backgroundColor: '#fffbeb' }]}><Text style={styles.cardTitle}>🎓 Admisiones universitarias</Text><Text style={styles.cardText}>Algoritmos perpetúan ventajas estructurales en lugar de identificar potencial.</Text></View>
    </View>
  );

  const renderSort = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#f5f3ff' }]}><Text style={[styles.tagText, { color: '#5b21b6' }]}>↕️ Módulo 11 · Ordenar</Text></View>
      <Text style={styles.title}>Del sesgo al daño: la cadena completa</Text>
      {sortOrder.map((stepIdx, pos) => (
        <View key={pos} style={styles.sortItem}>
          <Text style={styles.sortNum}>{pos + 1}</Text>
          <Text style={styles.sortText}>{SORT_SESGO[stepIdx]}</Text>
          <View style={styles.sortArrows}>
            <TouchableOpacity style={styles.sortBtn} onPress={() => moveSort(pos, -1)} disabled={pos === 0}><MaterialIcons name="keyboard-arrow-up" size={18} color={colors.textSecondary} /></TouchableOpacity>
            <TouchableOpacity style={styles.sortBtn} onPress={() => moveSort(pos, 1)} disabled={pos === sortOrder.length - 1}><MaterialIcons name="keyboard-arrow-down" size={18} color={colors.textSecondary} /></TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );

  const renderTheory6 = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#ede9fe' }]}><Text style={[styles.tagText, { color: '#5b21b6' }]}>📖 Módulo 12 · Derechos</Text></View>
      <Text style={styles.title}>Los derechos digitales que ya tienes</Text>
      {['👁️ Derecho a saber si una IA decide sobre ti', '🗑️ Derecho al olvido (Ley 1581 en Colombia)', '🙅 Derecho a no ser perfilado automáticamente', '🏷️ Derecho a saber si hablas con IA o humano'].map((t, i) => (
        <View key={i} style={styles.card}><Text style={styles.cardText}>{t}</Text></View>
      ))}
    </View>
  );

  const renderQuiz = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fef3c7' }]}><Text style={[styles.tagText, { color: '#92400e' }]}>❓ Módulo 13 · Quiz</Text></View>
      <Text style={styles.title}>Ética en IA: lo que ya debes saber</Text>
      {quizItems.map((q, qi) => (
        <View key={qi} style={{ marginBottom: 14 }}>
          <Text style={styles.quizQ}>{qi + 1}. {q.q}</Text>
          {q.opts.map((opt, oi) => (
            <TouchableOpacity key={oi} style={[styles.quizOpt, quizAnswers[qi] === oi && { borderColor: '#7c3aed', backgroundColor: '#ede9fe' }]} onPress={() => selectQuiz(qi, oi)} disabled={quizChecked}>
              <Text style={styles.quizLetter}>{String.fromCharCode(65 + oi)}</Text>
              <Text style={{ flex: 1, fontSize: 12, color: '#334155' }}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );

  const renderFill = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#ecfdf5' }]}><Text style={[styles.tagText, { color: '#065f46' }]}>💬 Módulo 14 · Vocabulario</Text></View>
      <Text style={styles.title}>Completa los principios</Text>
      {fillItems.map((item, qi) => (
        <View key={qi} style={{ marginBottom: 16 }}>
          <View style={[styles.card, { backgroundColor: '#f5f3ff' }]}>
            <Text style={{ fontSize: 13, color: '#334155', lineHeight: 24 }}>
              {item.sentence.replace('_____', fillAnswers[qi] !== undefined ? item.allOpts[fillAnswers[qi]] : '_____')}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {item.allOpts.map((opt, oi) => (
              <TouchableOpacity
                key={oi}
                style={[styles.fillOpt, fillAnswers[qi] === oi && { borderColor: '#7c3aed', backgroundColor: '#ede9fe' }]}
                onPress={() => selectFill(qi, oi)}
                disabled={fillChecked[qi]}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#334155' }}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
    </View>
  );

  const renderSprint = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fef3c7' }]}><Text style={[styles.tagText, { color: '#92400e' }]}>⚡ Módulo 15 · Sprint ético</Text></View>
      <Text style={styles.title}>Sprint: ¿Ético o no ético?</Text>
      <Text style={{ fontSize: 28, fontWeight: 'bold', textAlign: 'center', color: sprintSec <= 10 ? '#ef4444' : '#7c3aed', marginVertical: 8 }}>{sprintSec}</Text>
      <View style={{ height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}>
        <View style={{ height: '100%', width: `${(sprintSec / 60) * 100}%`, backgroundColor: '#7c3aed', borderRadius: 3 }} />
      </View>
      {!sprintStarted ? (
        <TouchableOpacity style={styles.nextButton} onPress={startSprint}><Text style={styles.nextButtonText}>⚡ Empezar Sprint</Text></TouchableOpacity>
      ) : sprintDone ? (
        <View style={{ padding: 14, backgroundColor: '#dcfce7', borderRadius: 10 }}>
          <Text style={{ fontWeight: 'bold', color: '#166534', textAlign: 'center', fontSize: 18 }}>{sprintCorrect}/{sprintItems.length} correctas</Text>
        </View>
      ) : sprintQ < sprintItems.length ? (
        <View>
          <Text style={styles.tfQuestion}>{sprintItems[sprintQ].stmt}</Text>
          <View style={{ flexDirection: 'row', gap: 7 }}>
            <TouchableOpacity style={[styles.tfBtn, { flex: 1 }]} onPress={() => answerSprint(true)}><Text style={{ fontWeight: 'bold' }}>✅ Verdadero</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.tfBtn, { flex: 1 }]} onPress={() => answerSprint(false)}><Text style={{ fontWeight: 'bold' }}>❌ Falso</Text></TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );

  const renderTheory7 = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#ede9fe' }]}><Text style={[styles.tagText, { color: '#5b21b6' }]}>🌟 Módulo 16 · Tu futuro</Text></View>
      <Text style={styles.title}>Tu lugar en el futuro de la IA</Text>
      <View style={styles.card}><Text style={styles.cardTitle}>🎓 Lo que aprendiste (Niveles 1-5)</Text><Text style={styles.cardText}>Fundamentos, tipos de modelos, prompting, funcionamiento interno y ética.</Text></View>
      <View style={styles.card}><Text style={styles.cardTitle}>🛠️ Lo que viene (Niveles 7-36)</Text><Text style={styles.cardText}>Herramientas especializadas, construcción de apps y proyectos reales.</Text></View>
    </View>
  );

  const renderManifiesto = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#ede9fe' }]}><Text style={[styles.tagText, { color: '#4f46e5' }]}>✍️ Módulo 17 · Manifiesto</Text></View>
      <Text style={styles.title}>Tu Manifiesto Digital</Text>
      {[
        { key: 'a' as const, label: '⚠️ La IA me preocupa cuando...', placeholder: '...la gente la usa sin pensar, para engañar...' },
        { key: 'b' as const, label: '✅ Voy a usarla responsablemente porque...', placeholder: '...quiero aprender de verdad...' },
        { key: 'c' as const, label: '🌍 Mi compromiso digital es...', placeholder: '...verificar antes de compartir...' },
      ].map((item, idx) => (
        <View key={idx} style={{ marginBottom: 12 }}>
          <Text style={{ fontWeight: 'bold', color: '#5b21b6', marginBottom: 4 }}>{item.label}</Text>
          <TextInput
            style={styles.textArea}
            multiline
            placeholder={item.placeholder}
            value={manifiesto[item.key]}
            onChangeText={(val) => updateManifiesto(item.key, val)}
          />
          <Text style={{ fontSize: 11, color: '#94a3b8', textAlign: 'right' }}>{manifiesto[item.key].length} / 15 mín.</Text>
        </View>
      ))}
    </View>
  );

  const renderCompletion = () => (
    <View style={{ alignItems: 'center', padding: 20 }}>
      <Text style={{ fontSize: 44, marginBottom: 14 }}>🎓</Text>
      <Text style={[styles.title, { textAlign: 'center' }]}>¡Nivel 5 completado!</Text>
      <Text style={[styles.subtitle, { textAlign: 'center' }]}>Terminaste "IA con conciencia". Cerraste el Arco de Fundamentos. Ahora eres un usuario consciente, crítico y ético de la IA.</Text>
      <View style={{ backgroundColor: '#f5f3ff', padding: 12, borderRadius: 12, width: '100%', marginBottom: 14 }}>
        <Text style={{ fontWeight: 'bold', color: '#5b21b6', textAlign: 'center' }}>🏆 ARCO COMPLETADO: Fundamentos de IA</Text>
      </View>
      <Text style={{ fontWeight: 'bold', fontSize: 15, color: '#92400e', marginBottom: 14 }}>⭐ {xp} XP ganados</Text>
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
      case 2: return renderCases();
      case 3: return renderEthics();
      case 4: return renderTheory2();
      case 5: return renderTrabajoDrag();
      case 6: return renderTheory3();
      case 7: return renderTF();
      case 8: return renderTheory4();
      case 9: return renderFakeDetector();
      case 10: return renderTheory5();
      case 11: return renderSort();
      case 12: return renderTheory6();
      case 13: return renderQuiz();
      case 14: return renderFill();
      case 15: return renderSprint();
      case 16: return renderTheory7();
      case 17: return renderManifiesto();
      case 18: return renderCompletion();
      default: return null;
    }
  };

  const progressPercent = (step / (TOTAL_STEPS - 1)) * 100;

  const handleMainBtn = () => {
    const handlers: Record<number, (() => boolean) | undefined> = {
      3: () => ethicsDone,
      5: checkTrabajoDrag,
      7: checkTF,
      9: canProceedFake,
      11: checkSort,
      13: checkQuiz,
      14: canProceedFill,
      15: () => sprintDone,
      17: checkManifiesto,
    };
    const handler = handlers[step];
    if (handler) { if (!handler()) return; }
    goToNextStep();
  };

  const showNextBtn = step < TOTAL_STEPS - 1 && ![3, 5, 7, 9, 11, 13, 14, 15, 17, 18].includes(step);
  const showCheckBtn = [3, 5, 7, 9, 11, 13, 14, 15, 17].includes(step) && step < TOTAL_STEPS - 1;

  const getBtnLabel = () => {
    switch (step) {
      case 3: return 'Continuar →';
      case 5: return 'Verificar clasificación';
      case 7: return 'Comprobar';
      case 9: return 'Continuar →';
      case 11: return 'Verificar orden';
      case 13: return 'Comprobar respuestas';
      case 14: return 'Continuar →';
      case 15: return sprintDone ? 'Continuar →' : 'Empezar Sprint ⚡';
      case 17: return 'Publicar manifiesto ✨';
      default: return 'Continuar →';
    }
  };

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
        <TouchableOpacity style={styles.nextButton} onPress={step === 15 && !sprintStarted ? startSprint : handleMainBtn}>
          <Text style={styles.nextButtonText}>{getBtnLabel()}</Text>
        </TouchableOpacity>
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
  progressFill: { height: '100%', backgroundColor: '#7c3aed', borderRadius: 3 },
  xpText: { ...typography.bold, fontSize: 14, color: '#92400e' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  tag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 12 },
  tagText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  iconCircle: { width: 60, height: 60, borderRadius: 18, backgroundColor: '#ede9fe', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  title: { ...typography.extraBold, fontSize: 19, color: colors.textPrimary, marginBottom: 6 },
  subtitle: { ...typography.regular, fontSize: 13, color: colors.textSecondary, marginBottom: 14, lineHeight: 18 },
  bodyText: { ...typography.regular, fontSize: 13, color: colors.textPrimary, lineHeight: 20, marginBottom: 12 },
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  cardTitle: { ...typography.bold, fontSize: 13, color: colors.textPrimary, marginBottom: 6 },
  cardText: { ...typography.regular, fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
  highlight: { borderLeftWidth: 3, borderLeftColor: '#7c3aed', backgroundColor: '#f5f3ff', padding: 11, marginVertical: 10, borderRadius: 4 },
  highlightText: { fontSize: 13, color: '#5b21b6', lineHeight: 20 },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#7c3aed', justifyContent: 'center', alignItems: 'center' },
  exCard: { backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 8 },
  ethBtn: { flex: 1, padding: 10, borderRadius: 11, borderWidth: 2, borderColor: '#e2e8f0', backgroundColor: '#fff', alignItems: 'center', minHeight: 50, justifyContent: 'center' },
  vsCol: { flex: 1, borderRadius: 12, padding: 11, borderWidth: 1, borderColor: '#e2e8f0' },
  vsHeader: { fontSize: 10, fontWeight: 'bold', textAlign: 'center', padding: 4, borderRadius: 7, marginBottom: 7 },
  vsItem: { fontSize: 11, color: '#334155', paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  chip: { padding: 7, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1.5, borderColor: '#cbd5e1', backgroundColor: '#fff' },
  dropCol: { borderWidth: 2, borderStyle: 'dashed', borderColor: '#cbd5e1', borderRadius: 12, padding: 8, minHeight: 70 },
  tfQuestion: { fontWeight: 'bold', fontSize: 13, padding: 11, backgroundColor: '#f8fafc', borderRadius: 10, marginBottom: 8 },
  tfBtn: { flex: 1, padding: 12, borderRadius: 11, borderWidth: 2, borderColor: '#e2e8f0', backgroundColor: '#fff', alignItems: 'center' },
  fakeBtn: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 2, borderColor: '#e2e8f0', backgroundColor: '#fff', alignItems: 'center' },
  sortItem: { flexDirection: 'row', alignItems: 'center', padding: 11, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  sortNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#7c3aed', textAlign: 'center', lineHeight: 26, color: '#fff', fontWeight: 'bold', fontSize: 11, marginRight: 9 },
  sortText: { flex: 1, fontSize: 12, color: colors.textPrimary },
  sortArrows: { flexDirection: 'column', gap: 3 },
  sortBtn: { width: 28, height: 26, borderRadius: 7, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  quizQ: { fontWeight: 'bold', fontSize: 12, padding: 11, backgroundColor: '#f8fafc', borderRadius: 10, marginBottom: 8 },
  quizOpt: { flexDirection: 'row', alignItems: 'center', padding: 10, borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, marginBottom: 6, gap: 9 },
  quizLetter: { width: 22, height: 22, borderRadius: 6, backgroundColor: '#f1f5f9', textAlign: 'center', lineHeight: 22, fontSize: 10, fontWeight: 'bold', color: '#64748b' },
  fillOpt: { padding: 8, paddingHorizontal: 13, borderRadius: 10, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  textArea: { borderWidth: 1, borderColor: '#ddd6fe', borderRadius: 10, padding: 12, fontSize: 13, color: '#334155', textAlignVertical: 'top', minHeight: 80, backgroundColor: '#fafafa' },
  nextButton: { backgroundColor: '#7c3aed', padding: 14, margin: 16, borderRadius: 11, alignItems: 'center' },
  nextButtonText: { ...typography.bold, color: '#fff', fontSize: 15 },
  finishButton: { backgroundColor: '#7c3aed', padding: 14, borderRadius: 11, width: '100%', alignItems: 'center', marginTop: 14 },
  resultBanner: { margin: 16, padding: 14, borderRadius: 14, borderWidth: 1 },
  resultBannerOk: { backgroundColor: '#dcfce7', borderColor: colors.success },
  resultBannerErr: { backgroundColor: '#fee2e2', borderColor: colors.error },
  resultBannerText: { ...typography.bold, fontSize: 13, color: colors.textPrimary, lineHeight: 20 },
});