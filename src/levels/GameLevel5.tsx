// src/levels/GameLevel5.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useGameStore } from '../store/gameStore';
import { colors, typography } from '../theme';

// ---------- Tipos ----------
type EthicsItem = { scenario: string; correct: 'safe' | 'doubt' | 'bad'; explain: string };
type TrabajoItem = { text: string; correct: 'humano' | 'ia' | 'ambos' };
type TFItem = { stmt: string; correct: boolean; explain: string };
type FakeItem = { headline: string; source: string; isReal: boolean; explain: string };
type QuizItem = { q: string; opts: string[]; correct: number; explain: string };
type FillItem = { sentence: string; allOpts: string[]; correct: number; explain: string };
type SprintItem = { stmt: string; correct: boolean };

// ---------- Pools (copiados del HTML) ----------
const ETHICS_POOL: EthicsItem[] = [
  { scenario: 'Usas ChatGPT para que te explique un tema del colegio que no entendiste en clase.', correct: 'safe', explain: 'Uso ideal: aprender y entender contenidos. El LLM actúa como tutor personalizado disponible 24/7.' },
  { scenario: 'Pegas el examen de tu compañero en ChatGPT para copiarte las respuestas y entregarlo como propio.', correct: 'bad', explain: 'Esto es deshonestidad académica y viola las normas del colegio. Además, no aprendes nada — el objetivo del examen era que tú aprendieras.' },
  { scenario: 'Le pides a un LLM que genere una imagen realista de tu profesor haciendo algo vergonzoso.', correct: 'bad', explain: 'Crear contenido falso y dañino sobre personas reales es un uso problemático y potencialmente ilegal. Podría considerarse acoso o difamación.' },
  { scenario: 'Usas un LLM para revisar la gramática de tu ensayo antes de entregarlo.', correct: 'safe', explain: 'Excelente uso. Revisar y mejorar tu propio trabajo con ayuda de IA es una habilidad valiosa — siempre que el contenido original sea tuyo.' },
  { scenario: 'Le preguntas a Claude cuántas calorías tiene una manzana para un trabajo de nutrición.', correct: 'safe', explain: 'Consulta de información general para un proyecto educativo. Recuerda verificar datos importantes con fuentes especializadas.' },
  { scenario: 'Usas un LLM para escribir mensajes de texto fingiendo ser otra persona con el fin de engañar a alguien.', correct: 'bad', explain: 'Suplantar la identidad de otra persona para engañar es deshonesto y potencialmente ilegal, independientemente de si usas IA o no.' },
  { scenario: 'Le pides a un LLM que te ayude a planear un viaje con tu familia: itinerario, lugares y presupuesto.', correct: 'safe', explain: 'Uso práctico y legítimo. Los LLMs son excelentes para organizar información, generar ideas y hacer planes. Verifica detalles (horarios, precios) con fuentes actuales.' },
  { scenario: 'Generas una foto falsa de un candidato político haciendo algo que no hizo y la compartes en redes.', correct: 'bad', explain: 'Crear y difundir deepfakes de figuras políticas es desinformación deliberada. Puede influir en elecciones y tiene consecuencias legales en muchos países.' },
  { scenario: 'Usas un LLM para traducir instrucciones de un manual técnico que está en inglés.', correct: 'safe', explain: 'Traducción para comprensión personal: uso totalmente válido. Los LLMs son traductores muy efectivos para uso cotidiano.' },
  { scenario: 'Le preguntas a un LLM por los síntomas de una enfermedad que sientes para decidir si vas al médico.', correct: 'doubt', explain: 'Dudoso. Los LLMs pueden dar información general útil, pero NO reemplazan un diagnóstico médico. Úsalos para informarte, pero siempre consulta a un profesional de salud.' },
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

const PRIVACIDAD_TF_POOL: TFItem[] = [
  { stmt: 'Lo que le dices a ChatGPT puede ser usado para mejorar el modelo en el futuro.', correct: true, explain: 'Sí — en los planes gratuitos, las conversaciones pueden usarse para entrenamiento. En los planes de pago o con ajustes de privacidad, puedes desactivar esto. Revisa los términos de uso.' },
  { stmt: 'Puedes compartir la contraseña de tu cuenta bancaria con un LLM sin ningún riesgo.', correct: false, explain: 'Nunca compartas contraseñas, datos bancarios o información financiera con ningún servicio en línea, incluyendo LLMs.' },
  { stmt: 'Los LLMs guardan automáticamente toda tu información personal para venderla a anunciantes.', correct: false, explain: 'Falso como afirmación general. Anthropic, OpenAI y Google no venden datos directamente a anunciantes. Pero sí guardan conversaciones para mejorar el modelo — revisa la política de privacidad de cada uno.' },
  { stmt: 'Es seguro compartir tu nombre y ciudad con un LLM para que personalice mejor sus respuestas.', correct: true, explain: 'En general sí, con sentido común. Decir "Soy estudiante en Bogotá" es diferente a compartir tu dirección exacta o documento de identidad.' },
  { stmt: 'Si usas un LLM en modo incógnito del navegador, tus datos no se guardan en los servidores del proveedor.', correct: false, explain: 'El modo incógnito del navegador solo evita que el historial se guarde en tu dispositivo. Los servidores del proveedor siguen procesando y potencialmente guardando la conversación.' },
  { stmt: 'Nunca debes compartir el número de identificación (cédula/DNI) de otra persona con un LLM.', correct: true, explain: 'Correcto. Datos sensibles de terceros — especialmente documentos de identidad — no deben compartirse con ningún servicio externo sin consentimiento.' },
  { stmt: 'Los LLMs pueden acceder a tu cámara, micrófono y archivos del dispositivo sin permiso.', correct: false, explain: 'Falso. Los LLMs web no tienen acceso a tu dispositivo más allá de lo que tú compartes explícitamente en el chat.' },
  { stmt: 'Es posible que tus conversaciones con un LLM sean revisadas por personas del equipo del proveedor.', correct: true, explain: 'Sí — los proveedores pueden revisar conversaciones por seguridad, calidad y entrenamiento del modelo. Por eso no debes compartir información altamente confidencial.' },
  { stmt: 'Compartir el código fuente privado de una empresa en un LLM gratuito puede ser una violación de confidencialidad.', correct: true, explain: 'Correcto. Código propietario, secretos comerciales o información confidencial de una empresa no deben compartirse en servicios externos sin revisar las políticas de privacidad.' },
  { stmt: 'Una vez que cierras la conversación, el LLM olvida inmediatamente todo lo que dijiste.', correct: false, explain: 'No necesariamente. Los datos pueden almacenarse en los servidores por periodos variables según la política del proveedor.' },
];

const FAKE_POOL: FakeItem[] = [
  { headline: 'Colombia lanzó su primer satélite al espacio en 2023, el "Libertad 2".', source: 'Fuente: Agencia Espacial Colombiana', isReal: true, explain: 'Real. Colombia lanzó el CubeSat "Libertad 2" en 2023. Colombia tiene una historia legítima de pequeños satélites educativos desde 2007.' },
  { headline: 'El Papa Francisco declaró que la inteligencia artificial es "el mayor milagro tecnológico de la humanidad".', source: 'Fuente: Vatican News, marzo 2024', isReal: false, explain: 'Fabricado. El Papa ha hablado sobre IA con cautela y preocupación ética, no con ese entusiasmo absoluto. Titulares con citas que suenan extremas suelen ser señal de desinformación.' },
  { headline: 'OpenAI alcanzó 100 millones de usuarios en ChatGPT en solo dos meses, el crecimiento más rápido de una app en la historia.', source: 'Fuente: Reuters, febrero 2023', isReal: true, explain: 'Real. ChatGPT alcanzó 100 millones de usuarios en enero-febrero 2023, convirtiéndose en la aplicación de consumo de más rápido crecimiento de la historia hasta ese momento.' },
  { headline: 'Un juez de EE.UU. fue sancionado por presentar casos legales inventados por ChatGPT sin verificarlos.', source: 'Fuente: NY Times, 2023', isReal: false, explain: 'Casi real pero inexacto. Fue un ABOGADO (no un juez) quien presentó casos inventados por ChatGPT. Los titulares con pequeños cambios de detalle son una forma común de desinformación.' },
  { headline: 'Elon Musk demandó a OpenAI alegando que la empresa abandonó su misión sin fines de lucro.', source: 'Fuente: Bloomberg, marzo 2024', isReal: true, explain: 'Real. Elon Musk presentó una demanda contra OpenAI en marzo de 2024 por abandonar su misión original sin fines de lucro.' },
  { headline: 'China prohibió totalmente el uso de ChatGPT y todos los LLMs extranjeros para sus ciudadanos en 2024.', source: 'Fuente: CNBC Asia', isReal: false, explain: 'Parcialmente falso. China tiene restricciones sobre LLMs extranjeros, pero no una prohibición total. Tiene sus propios modelos aprobados (Ernie Bot, etc.).' },
  { headline: 'Google DeepMind desarrolló AlphaFold, un sistema de IA que predice la estructura de proteínas y ganó el Nobel de Química.', source: 'Fuente: Nature, octubre 2024', isReal: true, explain: 'Real. Los creadores de AlphaFold ganaron el Premio Nobel de Química 2024. Es considerado uno de los mayores avances científicos de la última década.' },
  { headline: 'Un modelo de IA generó automáticamente una vacuna funcional contra el dengue en 48 horas en un laboratorio de Medellín.', source: 'Fuente: El Colombiano, 2024', isReal: false, explain: 'Fabricado. La IA puede acelerar el diseño de candidatos a vacunas, pero el proceso completo (síntesis, pruebas, validación) toma años.' },
];

const ETICA_QUIZ_POOL: QuizItem[] = [
  { q: '¿Cuál es el mayor riesgo ético del uso de deepfakes de personas reales?', opts: ['Que son muy difíciles de crear técnicamente', 'Que pueden dañar la reputación de personas y manipular la opinión pública', 'Que usan demasiada energía en los servidores', 'Que solo funcionan con rostros humanos'], correct: 1, explain: 'Los deepfakes pueden destruir reputaciones, influir en elecciones y crear evidencia falsa.' },
  { q: 'Si una IA de contratación rechaza sistemáticamente candidatos de ciertas regiones del país, ¿qué tipo de problema es?', opts: ['Un error técnico que se arregla reiniciando', 'Un sesgo discriminatorio con consecuencias reales', 'Una decisión correcta basada en datos objetivos', 'Un problema de diseño de interfaz'], correct: 1, explain: 'Es sesgo algorítmico con impacto real. Las personas afectadas pierden oportunidades reales.' },
  { q: '¿Qué significa que un sistema de IA sea "transparente"?', opts: ['Que es de color claro en su interfaz', 'Que no guarda ningún dato de los usuarios', 'Que se puede entender cómo toma sus decisiones', 'Que funciona más rápido'], correct: 2, explain: 'Transparencia en IA significa que las decisiones del sistema son comprensibles y auditables.' },
  { q: '¿Por qué es problemático que los sistemas de IA sean entrenados casi exclusivamente con datos en inglés?', opts: ['Porque el inglés es un idioma muy complejo', 'Porque los otros idiomas se quedan sin hablantes', 'Porque el modelo funciona peor y tiene menos conocimiento de otras culturas e idiomas', 'Porque cuesta más computación'], correct: 2, explain: 'El sesgo lingüístico hace que el modelo sea menos útil para usuarios de otras culturas e idiomas.' },
  { q: '¿Cuál de estos es un uso legítimo y ético de IA generativa?', opts: ['Crear fotos falsas de un compañero para burlarse', 'Generar variaciones de tu propio diseño para elegir la mejor versión', 'Escribir el ensayo de otra persona y cobrárselo', 'Crear una voz falsa de un familiar para engañar'], correct: 1, explain: 'Usar IA para generar variaciones de tu propio trabajo creativo es un uso perfectamente ético.' },
  { q: '¿Qué es el "consentimiento informado" en el contexto de la IA?', opts: ['Que el usuario acepta las cookies del sitio', 'Que las personas saben cómo se usan sus datos y tienen control sobre eso', 'Que el sistema de IA pide permiso antes de generar cada respuesta', 'Que la empresa informa cuánta energía usa su servidor'], correct: 1, explain: 'Consentimiento informado = las personas comprenden qué datos se recopilan, para qué, y tienen la opción real de decidir.' },
  { q: '¿Qué debería hacer si encuentras una imagen claramente falsa (deepfake) de una persona pública circulando en redes?', opts: ['Compartirla con un comentario gracioso', 'Ignorarla porque no te afecta directamente', 'No compartirla y reportarla como desinformación', 'Guardarla para mostrarla después'], correct: 2, explain: 'No compartir es la acción mínima — compartir deepfakes los amplifica aunque sea con intención crítica.' },
  { q: 'Una empresa usa IA para monitorear las emociones de sus empleados durante las videollamadas sin avisarles. ¿Qué tipo de problema es?', opts: ['Una estrategia de recursos humanos innovadora', 'Una violación de privacidad y de derechos laborales', 'Un problema de conexión a internet', 'Una mejora en la productividad'], correct: 1, explain: 'Vigilancia sin consentimiento viola la privacidad y la dignidad de las personas.' },
  { q: '¿Por qué no basta con que la IA "funcione bien" para que sea ética?', opts: ['Porque los sistemas nunca funcionan bien del todo', 'Porque la eficiencia técnica no garantiza que el impacto social sea justo', 'Porque los usuarios siempre quieren más funciones', 'Porque los ingenieros prefieren sistemas complicados'], correct: 1, explain: 'Un sistema puede ser técnicamente perfecto y socialmente dañino.' },
  { q: '¿Qué significa el principio de "IA centrada en el humano"?', opts: ['Que la IA debe parecerse físicamente a un humano', 'Que el desarrollo de IA debe priorizar el bienestar, derechos y valores de las personas', 'Que solo humanos pueden programar sistemas de IA', 'Que la IA debe responder solo a preguntas sobre humanos'], correct: 1, explain: 'IA centrada en el humano pone a las personas — no la tecnología — en el centro de las decisiones de diseño.' },
];

const ETICA_FILL_POOL: FillItem[] = [
  { sentence: 'Cuando una IA toma decisiones que afectan a personas sin que nadie pueda entender por qué, se dice que es una "caja <b>___</b>".', allOpts: ['negra', 'rota', 'vacía', 'lenta'], correct: 0, explain: '"Caja negra" describe sistemas donde las decisiones no son transparentes ni explicables.' },
  { sentence: 'Crear imágenes o videos falsos y convincentes de personas reales usando IA se llama hacer un <b>___</b>.', allOpts: ['deepfake', 'backup', 'render', 'template'], correct: 0, explain: '"Deepfake" combina "deep learning" con "fake".' },
  { sentence: 'El principio que dice que los usuarios deben saber cómo se usan sus datos se llama <b>___</b> informado.', allOpts: ['consentimiento', 'acuerdo', 'registro', 'permiso'], correct: 0, explain: '"Consentimiento informado" es un derecho fundamental en privacidad digital.' },
  { sentence: 'Cuando una IA discrimina a ciertos grupos porque aprendió de datos históricos con prejuicios, se llama <b>___</b> algorítmico.', allOpts: ['sesgo', 'error', 'fallo', 'virus'], correct: 0, explain: '"Sesgo algorítmico" ocurre cuando los prejuicios humanos en los datos de entrenamiento se reproducen.' },
  { sentence: 'La capacidad de un sistema de IA de explicar cómo llegó a una conclusión se llama <b>___</b>.', allOpts: ['transparencia', 'velocidad', 'precisión', 'memoria'], correct: 0, explain: '"Transparencia" en IA significa que el proceso de decisión puede ser auditado.' },
  { sentence: 'Los datos personales como tu nombre, ubicación y hábitos digitales forman tu <b>___</b> digital.', allOpts: ['huella', 'perfil', 'sombra', 'código'], correct: 0, explain: '"Huella digital" es el rastro de datos que dejas al usar internet y aplicaciones.' },
];

const SPRINT_ETICA_POOL: SprintItem[] = [
  { stmt: 'Usar IA para copiar un examen completo y entregarlo como tuyo es una falta de honestidad académica', correct: true },
  { stmt: 'Los deepfakes son inofensivos porque todo el mundo sabe que son falsos', correct: false },
  { stmt: 'Compartir tu contraseña con un LLM para que acceda a tus cuentas es seguro', correct: false },
  { stmt: 'Los sesgos en los datos de entrenamiento pueden generar decisiones discriminatorias', correct: true },
  { stmt: 'Una IA que toma decisiones justas técnicamente siempre es ética', correct: false },
  { stmt: 'El consentimiento informado significa que los usuarios saben y aceptan cómo se usan sus datos', correct: true },
  { stmt: 'Reportar contenido falso generado por IA ayuda a reducir la desinformación', correct: true },
  { stmt: 'Es seguro compartir información confidencial de tu empresa en ChatGPT gratuito', correct: false },
  { stmt: 'Usar IA para revisar y mejorar tu propia escritura es un uso ético', correct: true },
  { stmt: 'Los modelos de IA son completamente neutrales y objetivos porque son máquinas', correct: false },
  { stmt: 'Crear una imagen falsa de alguien para dañar su reputación puede tener consecuencias legales', correct: true },
  { stmt: 'Si un sistema de IA discrimina, es culpa exclusiva del algoritmo, no de las personas que lo diseñaron', correct: false },
];

const SORT_SESGO = [
  'Datos de entrenamiento: La mayoría del texto en internet es de EE.UU. y Europa',
  'Sesgo emergente: El modelo conoce menos sobre cultura, historia y contextos latinoamericanos',
  'Respuesta sesgada: Al preguntar sobre "mejores universidades", solo menciona Harvard, MIT y Oxford',
  'Impacto real: Un estudiante colombiano cree que no hay buenas universidades en su país',
  'Consecuencia social: Se refuerza la idea de que lo bueno siempre viene de afuera',
];

const pickN = <T,>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};

export default function GameLevel5({ navigation }: any) {
  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);
  const completeLevel = useGameStore((state) => state.completeLevel);
  const devMode = useGameStore((state) => state.devMode);

  // Pools aleatorios
  const [ethicsItems] = useState(() => pickN(ETHICS_POOL, 5));
  const [trabajoItems] = useState(() => pickN(TRABAJO_POOL, 7));
  const [privTF] = useState(() => pickN(PRIVACIDAD_TF_POOL, 5));
  const [fakeItems] = useState(() => pickN(FAKE_POOL, 4));
  const [quizItems] = useState(() => pickN(ETICA_QUIZ_POOL, 5));
  const [fillItems] = useState(() => pickN(ETICA_FILL_POOL, 3));
  const [sprintItems] = useState(() => pickN(SPRINT_ETICA_POOL, SPRINT_ETICA_POOL.length));

  // Estados de actividades
  const [ethicsQ, setEthicsQ] = useState(0);
  const [ethicsCorrect, setEthicsCorrect] = useState(0);
  const [ethicsDone, setEthicsDone] = useState(false);

  const [trabajoPlaced, setTrabajoPlaced] = useState<{ [key: number]: string }>({});
  const [trabajoSel, setTrabajoSel] = useState<number | null>(null);
  const [trabajoAttempts, setTrabajoAttempts] = useState(0);
  const [trabajoOk, setTrabajoOk] = useState(false);

  const [tfAnswers, setTfAnswers] = useState<{ [key: number]: boolean }>({});
  const [tfChecked, setTfChecked] = useState(false);

  const [fakeAnswers, setFakeAnswers] = useState<{ [key: number]: boolean }>({});
  const [fakeChecked, setFakeChecked] = useState(false);

  const [sortOrder, setSortOrder] = useState<number[]>([]);
  const [sortOk, setSortOk] = useState(false);

  const [quizAnswers, setQuizAnswers] = useState<{ [key: number]: number }>({});
  const [quizChecked, setQuizChecked] = useState(false);

  const [fillAnswers, setFillAnswers] = useState<{ [key: number]: number }>({});
  const [fillChecked, setFillChecked] = useState<boolean[]>([]);

  const [sprintIdx, setSprintIdx] = useState(0);
  const [sprintTimeLeft, setSprintTimeLeft] = useState(60);
  const [sprintCorrect, setSprintCorrect] = useState(0);
  const [sprintDone, setSprintDone] = useState(false);
  const sprintTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [manifesto, setManifesto] = useState({ a: '', b: '', c: '' });

  // Efectos para reiniciar estados
  useEffect(() => {
    if (step === 3) { setEthicsQ(0); setEthicsCorrect(0); setEthicsDone(false); }
    if (step === 5) { setTrabajoPlaced({}); setTrabajoSel(null); setTrabajoOk(false); }
    if (step === 7) { setTfAnswers({}); setTfChecked(false); }
    if (step === 9) { setFakeAnswers({}); setFakeChecked(false); }
    if (step === 11) { setSortOrder(SORT_SESGO.map((_, i) => i).sort(() => Math.random() - 0.5)); setSortOk(false); }
    if (step === 13) { setQuizAnswers({}); setQuizChecked(false); }
    if (step === 14) { setFillAnswers({}); setFillChecked([]); }
    if (step === 15) { setSprintIdx(0); setSprintTimeLeft(60); setSprintCorrect(0); setSprintDone(false); }
    if (step === 17) { setManifesto({ a: '', b: '', c: '' }); }
  }, [step]);

  const addXP = (amount: number) => setXp(prev => prev + amount);
  const goToNextStep = () => { if (step < 19) setStep(step + 1); };
  const handleClose = () => {
    Alert.alert('Salir', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', onPress: () => navigation.goBack() },
    ]);
  };
  const handleFinish = () => {
    let stars = 0;
    if (xp >= 200) stars = 3; else if (xp >= 140) stars = 2; else if (xp >= 80) stars = 1;
    completeLevel(5, stars, xp);
    navigation.goBack();
  };

  // Ethics Judge
  const answerEthics = (val: 'safe' | 'doubt' | 'bad') => {
    const item = ethicsItems[ethicsQ];
    const isOk = val === item.correct;
    if (isOk) setEthicsCorrect(prev => prev + 1);
    if (ethicsQ + 1 >= ethicsItems.length) {
      setEthicsDone(true);
      const finalCorrect = ethicsCorrect + (isOk ? 1 : 0);
      const earned = finalCorrect >= 4 ? 25 : finalCorrect >= 3 ? 18 : finalCorrect >= 2 ? 12 : 5;
      addXP(earned);
      Alert.alert('Resultado', `${finalCorrect}/${ethicsItems.length} correctas. +${earned} XP`, [{ text: 'OK', onPress: goToNextStep }]);
    } else {
      setEthicsQ(prev => prev + 1);
    }
  };

  // Drag trabajo
  const handleDropTrabajo = (zone: string) => {
    if (trabajoSel === null) return;
    const item = trabajoItems[trabajoSel];
    if (item.correct === zone) {
      setTrabajoPlaced(prev => ({ ...prev, [trabajoSel]: zone }));
      setTrabajoSel(null);
    } else {
      Alert.alert('Incorrecto', `"${item.text}" no pertenece a esta categoría.`);
    }
  };
  const checkTrabajoDrag = () => {
    if (trabajoOk) return true;
    const placed = Object.keys(trabajoPlaced).length;
    if (placed < trabajoItems.length) { Alert.alert('Faltan tarjetas'); return false; }
    let correct = 0;
    Object.entries(trabajoPlaced).forEach(([idx, zone]) => {
      if (trabajoItems[+idx].correct === zone) correct++;
    });
    if (correct === trabajoItems.length) {
      setTrabajoOk(true);
      addXP(trabajoAttempts === 0 ? 20 : 12);
      Alert.alert('¡Perfecto!', `+${trabajoAttempts === 0 ? 20 : 12} XP`, [{ text: 'OK', onPress: goToNextStep }]);
      return false;
    } else {
      Alert.alert('Algunas incorrectas');
      setTrabajoPlaced({});
      setTrabajoAttempts(prev => prev + 1);
      return false;
    }
  };

  // TF
  const selectTF = (idx: number, val: boolean) => {
    if (tfChecked) return;
    setTfAnswers(prev => ({ ...prev, [idx]: val }));
  };
  const checkTF = () => {
    if (tfChecked) return true;
    if (Object.keys(tfAnswers).length < privTF.length) { Alert.alert('Responde todas'); return false; }
    setTfChecked(true);
    let correct = 0;
    privTF.forEach((item, i) => { if (tfAnswers[i] === item.correct) correct++; });
    const earned = correct * 5;
    addXP(earned);
    Alert.alert('Resultado', `${correct}/${privTF.length} correctas. +${earned} XP`, [{ text: 'OK', onPress: goToNextStep }]);
    return false;
  };

  // Fake Detector
  const answerFake = (idx: number, val: boolean) => {
    if (fakeAnswers[idx] !== undefined) return;
    setFakeAnswers(prev => ({ ...prev, [idx]: val }));
    const allDone = Object.keys({ ...fakeAnswers, [idx]: val }).length === fakeItems.length;
    if (allDone) {
      let correct = 0;
      fakeItems.forEach((item, i) => {
        const ans = i === idx ? val : fakeAnswers[i];
        if (ans === item.isReal) correct++;
      });
      addXP(correct * 5);
      setFakeChecked(true);
      Alert.alert('Resultado', `${correct}/${fakeItems.length} correctas. +${correct * 5} XP`, [{ text: 'OK', onPress: goToNextStep }]);
    }
  };

  // Sort
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
      addXP(15);
      Alert.alert('¡Exacto!', '+15 XP', [{ text: 'OK', onPress: goToNextStep }]);
      return false;
    } else {
      Alert.alert('Incorrecto', 'Algunos pasos fuera de lugar.');
      return false;
    }
  };

  // Quiz
  const selectQuiz = (qIdx: number, oIdx: number) => {
    if (quizChecked) return;
    setQuizAnswers(prev => ({ ...prev, [qIdx]: oIdx }));
  };
  const checkQuiz = () => {
    if (quizChecked) return true;
    if (Object.keys(quizAnswers).length < quizItems.length) { Alert.alert('Responde todas'); return false; }
    setQuizChecked(true);
    let correct = 0;
    quizItems.forEach((q, i) => { if (quizAnswers[i] === q.correct) correct++; });
    const earned = correct * 8;
    addXP(earned);
    Alert.alert('Resultado', `${correct}/${quizItems.length} correctas. +${earned} XP`, [{ text: 'OK', onPress: goToNextStep }]);
    return false;
  };

  // Fill blanks
  const selectFill = (idx: number, optIdx: number) => {
    if (fillChecked[idx]) return;
    const newChecked = [...fillChecked];
    newChecked[idx] = true;
    setFillChecked(newChecked);
    setFillAnswers(prev => ({ ...prev, [idx]: optIdx }));
    const item = fillItems[idx];
    const isOk = optIdx === item.correct;
    if (isOk) addXP(8);
    if (newChecked.filter(Boolean).length === fillItems.length) {
      Alert.alert('Completado', 'Has respondido todas las frases.', [{ text: 'OK', onPress: goToNextStep }]);
    }
  };

  // Sprint
  const startSprintTimer = () => {
    sprintTimerRef.current = setInterval(() => {
      setSprintTimeLeft(prev => {
        if (prev <= 1) { clearInterval(sprintTimerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };
  const answerSprint = (val: boolean) => {
    if (sprintDone || sprintIdx >= sprintItems.length) return;
    const item = sprintItems[sprintIdx];
    const isOk = val === item.correct;
    if (isOk) setSprintCorrect(prev => prev + 1);
    if (sprintIdx + 1 < sprintItems.length) {
      setSprintIdx(prev => prev + 1);
    } else {
      setSprintDone(true);
      clearInterval(sprintTimerRef.current!);
      const finalCorrect = sprintCorrect + (isOk ? 1 : 0);
      const earned = finalCorrect >= 10 ? 25 : finalCorrect >= 7 ? 18 : finalCorrect >= 4 ? 12 : 5;
      addXP(earned);
    }
  };
  useEffect(() => {
    if (step === 15 && !sprintDone && sprintIdx === 0 && sprintTimeLeft === 60) {
      startSprintTimer();
    }
    return () => { if (sprintTimerRef.current) clearInterval(sprintTimerRef.current); };
  }, [step, sprintDone]);

  // Manifiesto
  const checkManifiesto = () => {
    const ok = manifesto.a.trim().length >= 15 && manifesto.b.trim().length >= 15 && manifesto.c.trim().length >= 15;
    if (ok) { addXP(20); goToNextStep(); }
    else { Alert.alert('Incompleto', 'Completa las 3 frases (mín. 15 caracteres).'); }
  };

  // ------------------- RENDERIZADOS -------------------
  const renderIntro = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>Nivel 5 · 18 módulos</Text>
      <Text style={styles.title}>IA con conciencia</Text>
      <Text style={styles.subtitle}>Sabes cómo funciona la IA. Ahora la pregunta más importante: ¿cómo quieres usarla?</Text>
      <View style={styles.card}><Text>Cierras el Arco de Fundamentos (Niveles 1-5)</Text></View>
      <View style={styles.card}><Text>🆕 Fake Detector y Manifiesto Personal</Text></View>
      <View style={styles.card}><Text>⭐ Hasta 250 XP disponibles</Text></View>
    </View>
  );

  const renderTheory1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>📖 Módulo 1 · Riesgos reales</Text>
      <Text style={styles.title}>¿La IA puede equivocarse de forma peligrosa?</Text>
      <Text style={styles.bodyText}>Daño por alucinación, discriminación algorítmica, desinformación masiva, vigilancia sin consentimiento, dependencia excesiva.</Text>
      <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}><Text style={styles.checkButtonText}>Entendido →</Text></TouchableOpacity>
    </View>
  );

  const renderExamples = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>🌍 Módulo 2 · Casos reales</Text>
      <Text style={styles.title}>Cuando la IA falló en el mundo real</Text>
      <Text>Abogado y casos inventados, Amazon CV discriminatorio, deepfakes en elecciones LATAM, reconocimiento facial sesgado, IA médica.</Text>
      <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}><Text style={styles.checkButtonText}>Continuar →</Text></TouchableOpacity>
    </View>
  );

  const renderEthics = () => {
    const item = ethicsItems[ethicsQ];
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.tag}>⚖️ Módulo 3 · Ethics Judge</Text>
        <Text style={styles.title}>¿Seguro, dudoso o problemático?</Text>
        <Text>{ethicsQ+1}/{ethicsItems.length} · {ethicsCorrect} correctas</Text>
        <Text style={styles.promptBox}>{item.scenario}</Text>
        <View style={styles.row}>
          <TouchableOpacity style={[styles.ethBtn, styles.ethSafe]} onPress={() => answerEthics('safe')}><Text>✅ Seguro</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.ethBtn, styles.ethDoubt]} onPress={() => answerEthics('doubt')}><Text>🤔 Dudoso</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.ethBtn, styles.ethBad]} onPress={() => answerEthics('bad')}><Text>⛔ Problemático</Text></TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderTheory2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>📖 Módulo 4 · IA y trabajo</Text>
      <Text style={styles.title}>¿La IA nos va a quitar el trabajo?</Text>
      <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}><Text style={styles.checkButtonText}>Entendido →</Text></TouchableOpacity>
    </View>
  );

  const renderDragTrabajo = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>🧩 Módulo 5 · Clasificar</Text>
      <Text style={styles.title}>¿Humano, IA o ambos?</Text>
      <View style={styles.chipsPool}>
        {trabajoItems.map((item, idx) => trabajoPlaced[idx] === undefined && (
          <TouchableOpacity key={idx} style={[styles.chip, trabajoSel === idx && styles.chipSelected]} onPress={() => setTrabajoSel(trabajoSel === idx ? null : idx)}>
            <Text>{item.text}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.dropCols}>
        <TouchableOpacity style={styles.dropCol} onPress={() => handleDropTrabajo('humano')}><Text>🔵 Humano</Text></TouchableOpacity>
        <TouchableOpacity style={styles.dropCol} onPress={() => handleDropTrabajo('ia')}><Text>🟣 IA</Text></TouchableOpacity>
        <TouchableOpacity style={styles.dropCol} onPress={() => handleDropTrabajo('ambos')}><Text>🟢 Ambos</Text></TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.checkButton} onPress={checkTrabajoDrag}><Text style={styles.checkButtonText}>Verificar</Text></TouchableOpacity>
    </View>
  );

  const renderTheory3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>📖 Módulo 6 · Privacidad</Text>
      <Text style={styles.title}>Lo que le dices a la IA no desaparece</Text>
      <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}><Text style={styles.checkButtonText}>Entendido →</Text></TouchableOpacity>
    </View>
  );

  const renderTF = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>🔒 Módulo 7 · V/F Privacidad</Text>
      {privTF.map((item, idx) => (
        <View key={idx} style={styles.tfItem}>
          <Text>{idx+1}. {item.stmt}</Text>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.tfBtn, tfAnswers[idx] === true && styles.tfBtnTrue]} onPress={() => selectTF(idx, true)} disabled={tfChecked}><Text>V</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.tfBtn, tfAnswers[idx] === false && styles.tfBtnFalse]} onPress={() => selectTF(idx, false)} disabled={tfChecked}><Text>F</Text></TouchableOpacity>
          </View>
        </View>
      ))}
      <TouchableOpacity style={styles.checkButton} onPress={checkTF}><Text style={styles.checkButtonText}>Comprobar</Text></TouchableOpacity>
    </View>
  );

  const renderTheory4 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>📖 Módulo 8 · Deepfakes</Text>
      <Text style={styles.title}>Deepfakes: cuando ver ya no es creer</Text>
      <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}><Text style={styles.checkButtonText}>Entendido →</Text></TouchableOpacity>
    </View>
  );

  const renderFakeDetector = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>🆕 Módulo 9 · Fake Detector</Text>
      <Text style={styles.title}>¿Real o generado con IA?</Text>
      {fakeItems.map((item, idx) => (
        <View key={idx} style={styles.fakeCard}>
          <Text style={styles.bold}>{item.headline}</Text>
          <Text style={styles.italic}>{item.source}</Text>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.fakeBtn, fakeAnswers[idx] === true && styles.fakeBtnReal]} onPress={() => answerFake(idx, true)} disabled={fakeAnswers[idx] !== undefined}><Text>✅ Real</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.fakeBtn, fakeAnswers[idx] === false && styles.fakeBtnFake]} onPress={() => answerFake(idx, false)} disabled={fakeAnswers[idx] !== undefined}><Text>🤖 Fabricado</Text></TouchableOpacity>
          </View>
        </View>
      ))}
      {fakeChecked && <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}><Text>Continuar</Text></TouchableOpacity>}
    </View>
  );

  const renderTheory5 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>📖 Módulo 10 · Consecuencias</Text>
      <Text style={styles.title}>Cuando el sesgo se convierte en daño real</Text>
      <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}><Text style={styles.checkButtonText}>Entendido →</Text></TouchableOpacity>
    </View>
  );

  const renderSort = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>↕️ Módulo 11 · Ordenar</Text>
      <Text style={styles.title}>Del sesgo al daño</Text>
      {sortOrder.map((origIdx, pos) => (
        <View key={pos} style={styles.sortItem}>
          <Text style={styles.sortNum}>{pos+1}</Text>
          <Text style={styles.sortText}>{SORT_SESGO[origIdx]}</Text>
          <View>
            <TouchableOpacity disabled={pos===0} onPress={() => moveSort(pos, -1)}><MaterialIcons name="arrow-upward" /></TouchableOpacity>
            <TouchableOpacity disabled={pos===sortOrder.length-1} onPress={() => moveSort(pos, 1)}><MaterialIcons name="arrow-downward" /></TouchableOpacity>
          </View>
        </View>
      ))}
      <TouchableOpacity style={styles.checkButton} onPress={checkSort}><Text>Verificar</Text></TouchableOpacity>
    </View>
  );

  const renderTheory6 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>📖 Módulo 12 · Derechos</Text>
      <Text style={styles.title}>Los derechos digitales que ya tienes</Text>
      <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}><Text style={styles.checkButtonText}>Entendido →</Text></TouchableOpacity>
    </View>
  );

  const renderQuiz = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>❓ Módulo 13 · Quiz de ética</Text>
      {quizItems.map((q, qi) => (
        <View key={qi}>
          <Text>{qi+1}. {q.q}</Text>
          {q.opts.map((opt, oi) => (
            <TouchableOpacity key={oi} style={[styles.quizOption, quizAnswers[qi] === oi && styles.quizOptionSelected]} onPress={() => selectQuiz(qi, oi)} disabled={quizChecked}>
              <Text>{String.fromCharCode(65+oi)}. {opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
      <TouchableOpacity style={styles.checkButton} onPress={checkQuiz}><Text>Comprobar</Text></TouchableOpacity>
    </View>
  );

  const renderFill = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>💬 Módulo 14 · Vocabulario ético</Text>
      {fillItems.map((item, idx) => (
        <View key={idx} style={styles.fillSet}>
          <Text>{item.sentence.replace('<b>___</b>', '_____')}</Text>
          <View style={styles.row}>
            {item.allOpts.map((opt, oi) => (
              <TouchableOpacity key={oi} style={[styles.fillOpt, fillAnswers[idx] === oi && styles.fillOptSelected]} onPress={() => selectFill(idx, oi)} disabled={fillChecked[idx]}>
                <Text>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
      {fillChecked.filter(Boolean).length === fillItems.length && <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}><Text>Continuar</Text></TouchableOpacity>}
    </View>
  );

  const renderSprint = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>⚡ Módulo 15 · Sprint ético</Text>
      <Text>Tiempo: {sprintTimeLeft}s | Aciertos: {sprintCorrect}/{sprintItems.length}</Text>
      {!sprintDone && sprintIdx < sprintItems.length && (
        <>
          <Text>{sprintItems[sprintIdx].stmt}</Text>
          <TouchableOpacity style={styles.sprintBtn} onPress={() => answerSprint(true)}><Text>✅ Verdadero</Text></TouchableOpacity>
          <TouchableOpacity style={styles.sprintBtn} onPress={() => answerSprint(false)}><Text>❌ Falso</Text></TouchableOpacity>
        </>
      )}
      {sprintDone && <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}><Text>Continuar</Text></TouchableOpacity>}
    </View>
  );

  const renderTheory7 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>🌟 Módulo 16 · Tu futuro</Text>
      <Text style={styles.title}>Tu lugar en el futuro de la IA</Text>
      <TouchableOpacity style={styles.checkButton} onPress={goToNextStep}><Text style={styles.checkButtonText}>Entendido →</Text></TouchableOpacity>
    </View>
  );

  const renderManifiesto = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>✍️ Módulo 17 · Manifiesto</Text>
      <Text style={styles.title}>Tu Manifiesto Digital</Text>
      <TextInput style={styles.textArea} placeholder="⚠️ La IA me preocupa cuando..." value={manifesto.a} onChangeText={(v) => setManifesto(prev => ({ ...prev, a: v }))} />
      <TextInput style={styles.textArea} placeholder="✅ Voy a usarla responsablemente porque..." value={manifesto.b} onChangeText={(v) => setManifesto(prev => ({ ...prev, b: v }))} />
      <TextInput style={styles.textArea} placeholder="🌍 Mi compromiso digital es..." value={manifesto.c} onChangeText={(v) => setManifesto(prev => ({ ...prev, c: v }))} />
      <TouchableOpacity style={styles.checkButton} onPress={checkManifiesto}><Text>Publicar manifiesto (+20 XP)</Text></TouchableOpacity>
    </View>
  );

  const renderCompletion = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>¡Nivel 5 completado!</Text>
      <Text>⭐ {xp} XP ganados</Text>
      <Text>🎓 Arco de Fundamentos completado</Text>
      <TouchableOpacity style={styles.checkButton} onPress={handleFinish}><Text>Volver al mapa</Text></TouchableOpacity>
    </View>
  );

  const renderContent = () => {
    switch (step) {
      case 0: return renderIntro();
      case 1: return renderTheory1();
      case 2: return renderExamples();
      case 3: return renderEthics();
      case 4: return renderTheory2();
      case 5: return renderDragTrabajo();
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
      default: return <ActivityIndicator />;
    }
  };

  const progressPercent = (step / 18) * 100;
  const showNextButton = step < 18 && ![1,2,3,5,7,9,11,13,14,15,17].includes(step);

  return (
    <View style={styles.screen}>
      <View style={styles.progressBar}>
        <TouchableOpacity onPress={handleClose}><MaterialIcons name="close" size={24} /></TouchableOpacity>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progressPercent}%` }]} /></View>
        <Text style={styles.xpText}>{xp} XP</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {renderContent()}
      </ScrollView>
      {showNextButton && (
        <TouchableOpacity style={styles.nextButton} onPress={goToNextStep}>
          <Text style={styles.nextButtonText}>Continuar →</Text>
        </TouchableOpacity>
      )}
      {devMode && (
        <TouchableOpacity style={styles.skipButton} onPress={goToNextStep}>
          <Text style={styles.skipButtonText}>⏩ Saltar (Modo Dev)</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  progressBar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  progressTrack: { flex: 1, height: 6, backgroundColor: colors.borderLight, borderRadius: 3, marginHorizontal: 12 },
  progressFill: { height: '100%', backgroundColor: colors.success, borderRadius: 3 },
  xpText: { ...typography.bold, fontSize: 14, color: colors.accentDark },
  scrollContent: { padding: 16, paddingBottom: 40 },
  stepContainer: { flex: 1 },
  tag: { fontSize: 11, fontWeight: '600', color: colors.primary, backgroundColor: '#eef2ff', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 12 },
  title: { ...typography.extraBold, fontSize: 19, color: colors.textPrimary, marginBottom: 6 },
  subtitle: { ...typography.regular, fontSize: 13, color: colors.textSecondary, marginBottom: 14 },
  bodyText: { ...typography.regular, fontSize: 13, color: colors.textPrimary, marginBottom: 12 },
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  checkButton: { backgroundColor: colors.success, padding: 12, borderRadius: 11, alignItems: 'center', marginTop: 16 },
  checkButtonText: { ...typography.bold, color: '#fff' },
  nextButton: { backgroundColor: colors.success, padding: 14, margin: 16, borderRadius: 11, alignItems: 'center' },
  nextButtonText: { ...typography.bold, color: '#fff', fontSize: 15 },
  skipButton: { backgroundColor: colors.warning, padding: 12, borderRadius: 11, alignItems: 'center', marginHorizontal: 16, marginBottom: 10 },
  skipButtonText: { ...typography.bold, color: '#fff' },
  promptBox: { fontFamily: 'monospace', fontSize: 12, backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border, marginVertical: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ethBtn: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  ethSafe: { borderColor: colors.success, backgroundColor: '#f0fdf4' },
  ethDoubt: { borderColor: colors.accent, backgroundColor: '#fffbeb' },
  ethBad: { borderColor: colors.error, backgroundColor: '#fff1f2' },
  chipsPool: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  chip: { padding: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipSelected: { borderColor: colors.primary, backgroundColor: '#e0f2fe' },
  dropCols: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 16 },
  dropCol: { padding: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border, borderRadius: 8 },
  tfItem: { marginBottom: 16 },
  tfBtn: { padding: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 8, marginHorizontal: 4 },
  tfBtnTrue: { borderColor: colors.success, backgroundColor: '#f0fdf4' },
  tfBtnFalse: { borderColor: colors.error, backgroundColor: '#fff1f2' },
  fakeCard: { backgroundColor: colors.surface, padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  fakeBtn: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  fakeBtnReal: { borderColor: colors.success, backgroundColor: '#dcfce7' },
  fakeBtnFake: { borderColor: colors.secondary, backgroundColor: '#f5f3ff' },
  sortItem: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: colors.surface, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  sortNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, color: '#fff', textAlign: 'center', lineHeight: 24, marginRight: 10 },
  sortText: { flex: 1, fontSize: 12 },
  quizOption: { padding: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 8, marginVertical: 4 },
  quizOptionSelected: { borderColor: colors.primary, backgroundColor: '#eff6ff' },
  fillSet: { marginBottom: 20 },
  fillOpt: { padding: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border, margin: 4 },
  fillOptSelected: { borderColor: colors.primary, backgroundColor: '#ede9fe' },
  sprintBtn: { padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 8, marginVertical: 4, alignItems: 'center' },
  textArea: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, minHeight: 60, textAlignVertical: 'top', marginVertical: 6 },
  bold: { fontWeight: 'bold' },
  italic: { fontStyle: 'italic' },
});