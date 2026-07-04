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
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { router } from 'expo-router';
import { useGameStore } from '../store/gameStore';
import { colors, typography } from '../theme';
import XPToast from '../components/XPToast';

// ---------- Tipos ----------
type EthicsItem = { scenario: string; correct: 'safe' | 'doubt' | 'bad'; explain: string };
type TrabajoItem = { text: string; correct: 'humano' | 'ia' | 'ambos' };
type PrivacidadTFItem = { stmt: string; correct: boolean; explain: string };
type FakeItem = { headline: string; source: string; isReal: boolean; explain: string };
type EticaQuizItem = { q: string; opts: string[]; correct: number; explain: string };
type EticaFillItem = { sentence: string; allOpts: string[]; correct: number; explain: string };
type SprintEticaItem = { stmt: string; correct: boolean };

const TOTAL_STEPS = 19; // 0:intro + 17 módulos + 1:complete

const pickN = <T,>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};

// ===================== POOLS DE DATOS =====================

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

const PRIVACIDAD_TF_POOL: PrivacidadTFItem[] = [
  { stmt: 'Lo que le dices a ChatGPT puede ser usado para mejorar el modelo en el futuro.', correct: true, explain: 'Sí — en los planes gratuitos, las conversaciones pueden usarse para entrenamiento. En los planes de pago o con ajustes de privacidad, puedes desactivar esto. Revisa los términos de uso.' },
  { stmt: 'Puedes compartir la contraseña de tu cuenta bancaria con un LLM sin ningún riesgo.', correct: false, explain: 'Nunca compartas contraseñas, datos bancarios o información financiera con ningún servicio en línea, incluyendo LLMs. Esto aplica a cualquier plataforma digital.' },
  { stmt: 'Los LLMs guardan automáticamente toda tu información personal para venderla a anunciantes.', correct: false, explain: 'Falso como afirmación general. Anthropic, OpenAI y Google no venden datos directamente a anunciantes. Pero sí guardan conversaciones para mejorar el modelo — revisa la política de privacidad de cada uno.' },
  { stmt: 'Es seguro compartir tu nombre y ciudad con un LLM para que personalice mejor sus respuestas.', correct: true, explain: 'En general sí, con sentido común. Decir "Soy estudiante en Bogotá" es diferente a compartir tu dirección exacta o documento de identidad. Información de contexto general es útil y relativamente segura.' },
  { stmt: 'Si usas un LLM en modo incógnito del navegador, tus datos no se guardan en los servidores del proveedor.', correct: false, explain: 'El modo incógnito del navegador solo evita que el historial se guarde en tu dispositivo. Los servidores del proveedor (OpenAI, Anthropic, Google) siguen procesando y potencialmente guardando la conversación.' },
  { stmt: 'Nunca debes compartir el número de identificación (cédula/DNI) de otra persona con un LLM.', correct: true, explain: 'Correcto. Datos sensibles de terceros — especialmente documentos de identidad — no deben compartirse con ningún servicio externo sin consentimiento.' },
  { stmt: 'Los LLMs pueden acceder a tu cámara, micrófono y archivos del dispositivo sin permiso.', correct: false, explain: 'Falso. Los LLMs web no tienen acceso a tu dispositivo más allá de lo que tú compartes explícitamente en el chat. No acceden a tu cámara, micrófono ni archivos sin que los cargues tú mismo.' },
  { stmt: 'Es posible que tus conversaciones con un LLM sean revisadas por personas del equipo del proveedor.', correct: true, explain: 'Sí — los proveedores pueden revisar conversaciones por seguridad, calidad y entrenamiento del modelo. Por eso no debes compartir información altamente confidencial o datos de terceros sin consentimiento.' },
  { stmt: 'Compartir el código fuente privado de una empresa en un LLM gratuito puede ser una violación de confidencialidad.', correct: true, explain: 'Correcto. Código propietario, secretos comerciales o información confidencial de una empresa no deben compartirse en servicios externos sin revisar las políticas de privacidad y obtener autorización.' },
  { stmt: 'Una vez que cierras la conversación, el LLM olvida inmediatamente todo lo que dijiste.', correct: false, explain: 'No necesariamente. Los datos pueden almacenarse en los servidores por periodos variables según la política del proveedor, incluso después de que cierres la sesión.' },
];

const FAKE_POOL: FakeItem[] = [
  { headline: 'Colombia lanzó su primer satélite al espacio en 2023, el "Libertad 2".', source: 'Fuente: Agencia Espacial Colombiana', isReal: true, explain: 'Real. Colombia lanzó el CubeSat "Libertad 2" en 2023. Colombia tiene una historia legítima de pequeños satélites educativos desde 2007.' },
  { headline: 'El Papa Francisco declaró que la inteligencia artificial es "el mayor milagro tecnológico de la humanidad".', source: 'Fuente: Vatican News, marzo 2024', isReal: false, explain: 'Fabricado. El Papa ha hablado sobre IA con cautela y preocupación ética, no con ese entusiasmo absoluto. Titulares con citas que suenan extremas suelen ser señal de desinformación.' },
  { headline: 'OpenAI alcanzó 100 millones de usuarios en ChatGPT en solo dos meses, el crecimiento más rápido de una app en la historia.', source: 'Fuente: Reuters, febrero 2023', isReal: true, explain: 'Real. ChatGPT alcanzó 100 millones de usuarios en enero-febrero 2023, convirtiéndose en la aplicación de consumo de más rápido crecimiento de la historia hasta ese momento.' },
  { headline: 'Un juez de EE.UU. fue sancionado por presentar casos legales inventados por ChatGPT sin verificarlos.', source: 'Fuente: NY Times, 2023', isReal: false, explain: 'Casi real pero inexacto. Fue un ABOGADO (no un juez) quien presentó casos inventados por ChatGPT. Los titulares con pequeños cambios de detalle son una forma común de desinformación.' },
  { headline: 'Elon Musk demandó a OpenAI alegando que la empresa abandonó su misión sin fines de lucro.', source: 'Fuente: Bloomberg, marzo 2024', isReal: true, explain: 'Real. Elon Musk presentó una demanda contra OpenAI en marzo de 2024 por abandonar su misión original sin fines de lucro. Fue noticia internacional ampliamente verificada.' },
  { headline: 'China prohibió totalmente el uso de ChatGPT y todos los LLMs extranjeros para sus ciudadanos en 2024.', source: 'Fuente: CNBC Asia', isReal: false, explain: 'Parcialmente falso. China tiene restricciones sobre LLMs extranjeros, pero no una prohibición total. Tiene sus propios modelos aprobados (Ernie Bot, etc.). Los titulares absolutistas suelen simplificar realidades complejas.' },
  { headline: 'Google DeepMind desarrolló AlphaFold, un sistema de IA que predice la estructura de proteínas y ganó el Nobel de Química.', source: 'Fuente: Nature, octubre 2024', isReal: true, explain: 'Real. Los creadores de AlphaFold ganaron el Premio Nobel de Química 2024. Es considerado uno de los mayores avances científicos de la última década.' },
  { headline: 'Un modelo de IA generó automáticamente una vacuna funcional contra el dengue en 48 horas en un laboratorio de Medellín.', source: 'Fuente: El Colombiano, 2024', isReal: false, explain: 'Fabricado. La IA puede acelerar el diseño de candidatos a vacunas, pero el proceso completo (síntesis, pruebas, validación) toma años. Titulares que exageran capacidades de IA son muy comunes.' },
];

const SORT_SESGO = [
  { b: 'Datos de entrenamiento:', r: ' La mayoría del texto en internet es de EE.UU. y Europa' },
  { b: 'Sesgo emergente:', r: ' El modelo conoce menos sobre cultura, historia y contextos latinoamericanos' },
  { b: 'Respuesta sesgada:', r: ' Al preguntar sobre "mejores universidades", solo menciona Harvard, MIT y Oxford' },
  { b: 'Impacto real:', r: ' Un estudiante colombiano cree que no hay buenas universidades en su país' },
  { b: 'Consecuencia social:', r: ' Se refuerza la idea de que lo bueno siempre viene de afuera' },
];

const ETICA_QUIZ_POOL: EticaQuizItem[] = [
  { q: '¿Cuál es el mayor riesgo ético del uso de deepfakes de personas reales?', opts: ['Que son muy difíciles de crear técnicamente', 'Que pueden dañar la reputación de personas y manipular la opinión pública', 'Que usan demasiada energía en los servidores', 'Que solo funcionan con rostros humanos'], correct: 1, explain: 'Los deepfakes pueden destruir reputaciones, influir en elecciones y crear evidencia falsa. El daño es real aunque la imagen sea digital — afecta vidas reales.' },
  { q: 'Si una IA de contratación rechaza sistemáticamente candidatos de ciertas regiones del país, ¿qué tipo de problema es?', opts: ['Un error técnico que se arregla reiniciando el sistema', 'Un sesgo discriminatorio con consecuencias reales para personas reales', 'Una decisión correcta basada en datos objetivos', 'Un problema de diseño de interfaz'], correct: 1, explain: 'Es sesgo algorítmico con impacto real. Si el modelo aprendió de datos históricos con discriminación, la reproduce y amplifica. Las personas afectadas pierden oportunidades reales.' },
  { q: '¿Qué significa que un sistema de IA sea "transparente"?', opts: ['Que es de color claro en su interfaz', 'Que no guarda ningún dato de los usuarios', 'Que se puede entender cómo toma sus decisiones y por qué', 'Que funciona más rápido que otros sistemas'], correct: 2, explain: 'Transparencia en IA significa que las decisiones del sistema son comprensibles y auditables. Opuesto a una "caja negra" donde no se sabe por qué la IA llegó a una conclusión.' },
  { q: '¿Por qué es problemático que los sistemas de IA sean entrenados casi exclusivamente con datos en inglés?', opts: ['Porque el inglés es un idioma muy complejo', 'Porque los otros idiomas se quedan sin hablantes', 'Porque el modelo funciona peor y tiene menos conocimiento de otras culturas e idiomas', 'Porque cuesta más computación procesar un idioma'], correct: 2, explain: 'El sesgo lingüístico en el entrenamiento hace que el modelo sea menos útil, menos preciso y potencialmente más dañino para usuarios que no hablan inglés o que vienen de culturas subrepresentadas.' },
  { q: '¿Cuál de estos es un uso legítimo y ético de IA generativa?', opts: ['Crear fotos falsas de un compañero para burlarse de él', 'Generar variaciones de tu propio diseño para elegir la mejor versión', 'Escribir el ensayo de otra persona y cobrárselo', 'Crear una voz falsa de un familiar para engañar a alguien'], correct: 1, explain: 'Usar IA para generar variaciones de tu propio trabajo creativo (ideas, diseños, texto) y elegir la mejor es un uso perfectamente ético y cada vez más común en industrias creativas.' },
  { q: '¿Qué es el "consentimiento informado" en el contexto de la IA?', opts: ['Que el usuario acepta las cookies del sitio', 'Que las personas saben cómo se usan sus datos y tienen control sobre eso', 'Que el sistema de IA pide permiso antes de generar cada respuesta', 'Que la empresa informa cuánta energía usa su servidor'], correct: 1, explain: 'Consentimiento informado = las personas comprenden qué datos se recopilan, para qué, y tienen la opción real de decidir. Es un principio fundamental de privacidad digital.' },
  { q: '¿Qué debería hacer si encuentras una imagen claramente falsa (deepfake) de una persona pública circulando en redes?', opts: ['Compartirla con un comentario gracioso', 'Ignorarla porque no te afecta directamente', 'No compartirla y reportarla como desinformación si la plataforma lo permite', 'Guardarla para mostrarla después'], correct: 2, explain: 'No compartir es la acción mínima — compartir deepfakes los amplifica aunque sea con intención crítica. Reportarlos ayuda a las plataformas a detectar y eliminar desinformación.' },
  { q: 'Una empresa usa IA para monitorear las emociones de sus empleados durante las videollamadas sin avisarles. ¿Qué tipo de problema es?', opts: ['Una estrategia de recursos humanos innovadora', 'Una violación de privacidad y de derechos laborales', 'Un problema de conexión a internet', 'Una mejora en la productividad del equipo'], correct: 1, explain: 'Vigilancia sin consentimiento viola la privacidad y la dignidad de las personas. En muchos países es ilegal. El hecho de que sea con IA no lo hace menos invasivo — lo hace más escalable y peligroso.' },
  { q: '¿Por qué no basta con que la IA "funcione bien" para que sea ética?', opts: ['Porque los sistemas nunca funcionan bien del todo', 'Porque la eficiencia técnica no garantiza que el impacto social sea justo, equitativo y respetuoso', 'Porque los usuarios siempre quieren más funciones', 'Porque los ingenieros prefieren sistemas complicados'], correct: 1, explain: 'Un sistema puede ser técnicamente perfecto y socialmente dañino. La ética en IA considera quién se beneficia, quién es perjudicado, qué valores refuerza y qué poder concentra.' },
  { q: '¿Qué significa el principio de "IA centrada en el humano"?', opts: ['Que la IA debe parecerse físicamente a un humano', 'Que el desarrollo de IA debe priorizar el bienestar, derechos y valores de las personas sobre la eficiencia técnica', 'Que solo humanos pueden programar sistemas de IA', 'Que la IA debe responder solo a preguntas sobre humanos'], correct: 1, explain: 'IA centrada en el humano pone a las personas — no la tecnología — en el centro de las decisiones de diseño. Pregunta: ¿este sistema mejora la vida de las personas? ¿Respeta su dignidad y autonomía?' },
];

const ETICA_FILL_POOL: EticaFillItem[] = [
  { sentence: 'Cuando una IA toma decisiones que afectan a personas sin que nadie pueda entender por qué, se dice que es una "caja _____".', allOpts: ['negra', 'rota', 'vacía', 'lenta'], correct: 0, explain: '"Caja negra" describe sistemas donde las decisiones no son transparentes ni explicables. Es uno de los mayores retos de ética en IA.' },
  { sentence: 'Crear imágenes o videos falsos y convincentes de personas reales usando IA se llama hacer un _____.', allOpts: ['deepfake', 'backup', 'render', 'template'], correct: 0, explain: '"Deepfake" combina "deep learning" (aprendizaje profundo) con "fake" (falso). Son cada vez más difíciles de detectar a simple vista.' },
  { sentence: 'El principio que dice que los usuarios deben saber cómo se usan sus datos se llama _____ informado.', allOpts: ['consentimiento', 'acuerdo', 'registro', 'permiso'], correct: 0, explain: '"Consentimiento informado" es un derecho fundamental en privacidad digital. Sin él, las empresas no deberían recopilar ni usar tus datos personales.' },
  { sentence: 'Cuando una IA discrimina a ciertos grupos porque aprendió de datos históricos con prejuicios, se llama _____ algorítmico.', allOpts: ['sesgo', 'error', 'fallo', 'virus'], correct: 0, explain: '"Sesgo algorítmico" ocurre cuando los prejuicios humanos en los datos de entrenamiento se reproducen y amplifican en el sistema de IA.' },
  { sentence: 'La capacidad de un sistema de IA de explicar cómo llegó a una conclusión se llama _____.', allOpts: ['transparencia', 'velocidad', 'precisión', 'memoria'], correct: 0, explain: '"Transparencia" en IA significa que el proceso de decisión puede ser auditado y comprendido. Es especialmente importante en sistemas que afectan salud, justicia o empleo.' },
  { sentence: 'Los datos personales como tu nombre, ubicación y hábitos digitales forman tu _____ digital.', allOpts: ['huella', 'perfil', 'sombra', 'código'], correct: 0, explain: '"Huella digital" es el rastro de datos que dejas al usar internet y aplicaciones. Las empresas pueden usar esta huella para crear perfiles muy detallados de ti.' },
];

const SPRINT_ETICA_POOL: SprintEticaItem[] = [
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

// ---------- Tags temáticos ----------
const TAG_STYLES: Record<string, { bg: string; color: string; border?: string }> = {
  theory: { bg: '#ede9fe', color: '#5b21b6' },
  example: { bg: '#fff7ed', color: '#9a3412' },
  activity: { bg: '#eff6ff', color: '#1e40af' },
  quiz: { bg: '#fef3c7', color: '#92400e' },
  vf: { bg: '#fef9ee', color: '#92400e' },
  sort: { bg: '#f5f3ff', color: '#5b21b6' },
  new: { bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd' },
  sprint: { bg: '#fef3c7', color: '#92400e' },
  ethics: { bg: '#fdf4ff', color: '#7e22ce' },
  fill: { bg: '#ecfdf5', color: '#065f46' },
  manifiesto: { bg: '#ede9fe', color: '#4f46e5' },
};

const CARD_STYLES: Record<string, { bg: string; border: string }> = {
  green: { bg: '#f0fdf4', border: '#bbf7d0' },
  amber: { bg: '#fffbeb', border: '#fde68a' },
  purple: { bg: '#faf5ff', border: '#e9d5ff' },
  violet: { bg: '#f5f3ff', border: '#ddd6fe' },
  indigo: { bg: '#eef2ff', border: '#c7d2fe' },
  slate: { bg: '#f8fafc', border: '#e2e8f0' },
  red: { bg: '#fff1f2', border: '#fecdd3' },
};

const HL_STYLES: Record<string, { border: string; bg: string; color: string }> = {
  blue: { border: '#0ea5e9', bg: '#f0f9ff', color: '#0369a1' },
  green: { border: '#10b981', bg: '#f0fdf4', color: '#065f46' },
  amber: { border: '#f59e0b', bg: '#fffbeb', color: '#92400e' },
  purple: { border: '#7c3aed', bg: '#f5f3ff', color: '#5b21b6' },
  indigo: { border: '#4f46e5', bg: '#eef2ff', color: '#3730a3' },
  red: { border: '#ef4444', bg: '#fff1f2', color: '#991b1b' },
};

// ---------- Subcomponentes ----------
function Tag({ variant, children }: { variant: keyof typeof TAG_STYLES; children: React.ReactNode }) {
  const t = TAG_STYLES[variant];
  return (
    <View style={[styles.tag, { backgroundColor: t.bg }, t.border ? { borderWidth: 1, borderColor: t.border } : null]}>
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

function FeedbackBar({ type, children }: { type: 'correct' | 'wrong'; children: React.ReactNode }) {
  const ok = type === 'correct';
  return (
    <View style={{ backgroundColor: ok ? '#dcfce7' : '#fff1f2', borderRadius: 10, padding: 10, marginTop: 7 }}>
      <Text style={{ fontSize: 12, color: ok ? '#166534' : '#991b1b', lineHeight: 18, fontWeight: '500' }}>{children}</Text>
    </View>
  );
}

function StepRow({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
      <View style={styles.stepNum}><Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{n}</Text></View>
      <Text style={{ flex: 1, fontSize: 12, color: '#334155', lineHeight: 19 }}>{children}</Text>
    </View>
  );
}

// ===================== COMPONENTE PRINCIPAL =====================
export default function World1Level5() {
  const navigation = useNavigation();
  const completeLevel = useGameStore((state) => state.completeLevel);
  const devMode = useGameStore((state) => state.devMode);

  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);
  const [xpToast, setXpToast] = useState<{ amount: number; id: number } | null>(null);

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
  const [ethicsAnswered, setEthicsAnswered] = useState(false);
  const [ethicsSel, setEthicsSel] = useState<string | null>(null);

  const [trabajoPlaced, setTrabajoPlaced] = useState<Record<number, string>>({});
  const [trabajoSel, setTrabajoSel] = useState<number | null>(null);
  const [trabajoOk, setTrabajoOk] = useState(false);
  const [trabajoAttempts, setTrabajoAttempts] = useState(0);
  const [trabajoFb, setTrabajoFb] = useState<{ type: 'correct' | 'wrong'; msg: string } | null>(null);

  const [tfAnswers, setTfAnswers] = useState<Record<number, boolean>>({});
  const [tfChecked, setTfChecked] = useState(false);

  const [fakeAnswers, setFakeAnswers] = useState<Record<number, boolean>>({});

  const [sortOrder, setSortOrder] = useState<number[]>([]);
  const [sortOk, setSortOk] = useState(false);
  const [sortMarks, setSortMarks] = useState<Record<number, 'ok' | 'bad'>>({});
  const [sortFb, setSortFb] = useState<{ type: 'correct' | 'wrong'; msg: string } | null>(null);

  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizChecked, setQuizChecked] = useState(false);

  const [fillAnswers, setFillAnswers] = useState<Record<number, number>>({});
  const [fillChecked, setFillChecked] = useState<Record<number, boolean>>({});

  const [sprintSec, setSprintSec] = useState(60);
  const [sprintQ, setSprintQ] = useState(0);
  const [sprintCorrect, setSprintCorrect] = useState(0);
  const [sprintDone, setSprintDone] = useState(false);
  const [sprintStarted, setSprintStarted] = useState(false);
  const [sprintAnswered, setSprintAnswered] = useState(false);
  const [sprintSel, setSprintSel] = useState<boolean | null>(null);
  const sprintTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [manifiesto, setManifiesto] = useState({ a: '', b: '', c: '' });

  const [expandedCard, setExpandedCard] = useState<number | null>(null);

  // Modo examen
  const examSteps = new Set([3, 5, 7, 9, 11, 13, 14, 15, 17]);
  const isExamMode = examSteps.has(step);

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
    if (step === 2) setExpandedCard(null);
    if (step === 3) { setEthicsQ(0); setEthicsCorrect(0); setEthicsDone(false); setEthicsAnswered(false); setEthicsSel(null); }
    if (step === 5) { setTrabajoPlaced({}); setTrabajoSel(null); setTrabajoOk(false); setTrabajoAttempts(0); setTrabajoFb(null); }
    if (step === 7) { setTfAnswers({}); setTfChecked(false); }
    if (step === 9) setFakeAnswers({});
    if (step === 11) {
      const order = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5);
      setSortOrder(order);
      setSortOk(false);
      setSortMarks({});
      setSortFb(null);
    }
    if (step === 13) { setQuizAnswers({}); setQuizChecked(false); }
    if (step === 14) { setFillAnswers({}); setFillChecked({}); }
    if (step === 15) {
      setSprintSec(60); setSprintQ(0); setSprintCorrect(0); setSprintDone(false); setSprintStarted(false); setSprintAnswered(false); setSprintSel(null);
      if (sprintTimer.current) clearInterval(sprintTimer.current);
    }
    if (step === 17) setManifiesto({ a: '', b: '', c: '' });
  }, [step]);

  const addXP = (amount: number) => {
    setXp((prev) => prev + amount);
    if (amount > 0) setXpToast((prev) => ({ amount, id: (prev?.id ?? 0) + 1 }));
  };
  const goToNextStep = () => { if (step < TOTAL_STEPS - 1) setStep(step + 1); };
  const goToPrevStep = () => setStep((s) => s - 1);

  const handleClose = () => {
    if (Platform.OS === 'web') {
      const msg = isExamMode ? 'Si sales perderás el progreso. ¿Seguro?' : '¿Seguro que quieres salir?';
      if (window.confirm(msg)) router.back();
      return;
    }
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
    completeLevel(5, stars, xp);
    router.replace('/level/6');
  };

  // ============ MECÁNICAS ============

  // Ethics Judge (3)
  const answerEthics = (val: 'safe' | 'doubt' | 'bad') => {
    if (ethicsAnswered || ethicsDone) return;
    const item = ethicsItems[ethicsQ];
    if (val === item.correct) setEthicsCorrect((prev) => prev + 1);
    setEthicsSel(val);
    setEthicsAnswered(true);
  };
  // El feedback permanece visible hasta que el usuario pulse "Entendido".
  const advanceEthics = () => {
    if (ethicsQ + 1 >= ethicsItems.length) {
      const earned = ethicsCorrect >= 4 ? 25 : ethicsCorrect >= 3 ? 18 : ethicsCorrect >= 2 ? 12 : 5;
      addXP(earned);
      setEthicsDone(true);
    } else {
      setEthicsQ((prev) => prev + 1);
      setEthicsAnswered(false);
      setEthicsSel(null);
    }
  };

  // Trabajo (5)
  const dropTrabajoChip = (idx: number, col: string) => {
    setTrabajoPlaced((prev) => ({ ...prev, [idx]: col }));
    setTrabajoSel(null);
  };
  const returnTrabajoChip = (idx: number) => {
    setTrabajoPlaced((prev) => { const n = { ...prev }; delete n[idx]; return n; });
  };
  const checkTrabajoDrag = () => {
    if (devMode) { setTrabajoOk(true); addXP(20); return true; }
    if (trabajoOk) return true;
    const placed = Object.keys(trabajoPlaced).length;
    if (placed < trabajoItems.length) {
      setTrabajoFb({ type: 'wrong', msg: `Faltan ${trabajoItems.length - placed} tarjetas.` });
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
      setTrabajoFb({ type: 'correct', msg: `¡Perfecto! ${correct} de ${trabajoItems.length} correctos. +${earned} XP 🎉` });
      return false;
    }
    setTrabajoFb({ type: 'wrong', msg: `${correct} de ${trabajoItems.length} correctos. Los incorrectos vuelven al banco.` });
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
    if (devMode) { setTfChecked(true); addXP(20); return true; }
    if (tfChecked) return true;
    if (Object.keys(tfAnswers).length < privTfItems.length) return false;
    setTfChecked(true);
    let correct = 0;
    privTfItems.forEach((item, idx) => { if (tfAnswers[idx] === item.correct) correct++; });
    addXP(correct * 5);
    return false;
  };

  // Fake Detector (9)
  const answerFake = (qi: number, val: boolean) => {
    if (fakeAnswers[qi] !== undefined) return;
    const newAnswers = { ...fakeAnswers, [qi]: val };
    setFakeAnswers(newAnswers);
    if (Object.keys(newAnswers).length >= fakeItems.length) {
      let correct = 0;
      fakeItems.forEach((it, i) => { if (newAnswers[i] === it.isReal) correct++; });
      addXP(correct * 5);
    }
  };
  const canProceedFake = () => Object.keys(fakeAnswers).length >= fakeItems.length;

  // Sort (11)
  const moveSort = (pos: number, dir: number) => {
    if (sortOk) return;
    const np = pos + dir;
    if (np < 0 || np >= sortOrder.length) return;
    const newOrder = [...sortOrder];
    [newOrder[pos], newOrder[np]] = [newOrder[np], newOrder[pos]];
    setSortOrder(newOrder);
    setSortMarks({});
    setSortFb(null);
  };
  const checkSort = () => {
    if (devMode) { setSortOk(true); addXP(15); return true; }
    if (sortOk) return true;
    const correct = sortOrder.every((v, i) => v === i);
    const marks: Record<number, 'ok' | 'bad'> = {};
    sortOrder.forEach((v, i) => { marks[i] = v === i ? 'ok' : 'bad'; });
    setSortMarks(marks);
    if (correct) {
      setSortOk(true);
      addXP(15);
      setSortFb({ type: 'correct', msg: '¡Exacto! Así es como un sesgo en los datos se convierte en daño real. +15 XP 🎉' });
      return false;
    }
    setSortFb({ type: 'wrong', msg: 'Todavía no está en el orden correcto. Piensa: ¿qué viene primero, la causa o el efecto?' });
    return false;
  };

  // Quiz (13)
  const selectQuiz = (qi: number, oi: number) => {
    if (quizChecked) return;
    setQuizAnswers((prev) => ({ ...prev, [qi]: oi }));
  };
  const checkQuiz = () => {
    if (devMode) { setQuizChecked(true); addXP(20); return true; }
    if (quizChecked) return true;
    if (Object.keys(quizAnswers).length < quizItems.length) return false;
    setQuizChecked(true);
    let correct = 0;
    quizItems.forEach((q, idx) => { if (quizAnswers[idx] === q.correct) correct++; });
    addXP(correct * 8);
    return false;
  };

  // Fill (14)
  const selectFill = (qi: number, oi: number) => {
    if (fillChecked[qi]) return;
    const item = fillItems[qi];
    setFillAnswers((prev) => ({ ...prev, [qi]: oi }));
    setFillChecked((prev) => ({ ...prev, [qi]: true }));
    if (oi === item.correct) addXP(8);
  };
  const canProceedFill = () => Object.keys(fillChecked).length >= fillItems.length;

  // Sprint (15)
  const startSprint = () => {
    setSprintStarted(true);
    setSprintSec(60);
    setSprintQ(0);
    setSprintCorrect(0);
    setSprintDone(false);
    setSprintAnswered(false);
    setSprintSel(null);
    sprintTimer.current = setInterval(() => {
      setSprintSec((prev) => {
        if (prev <= 1) { clearInterval(sprintTimer.current!); finishSprint(); return 0; }
        return prev - 1;
      });
    }, 1000);
  };
  const answerSprint = (val: boolean) => {
    if (sprintAnswered || sprintDone || sprintQ >= sprintItems.length) return;
    const item = sprintItems[sprintQ];
    const isOk = val === item.correct;
    setSprintAnswered(true);
    setSprintSel(val);
    if (isOk) setSprintCorrect((prev) => prev + 1);
    setTimeout(() => {
      if (sprintQ + 1 >= sprintItems.length) {
        const newCorrect = sprintCorrect + (isOk ? 1 : 0);
        const earned = newCorrect >= 10 ? 25 : newCorrect >= 7 ? 18 : newCorrect >= 4 ? 12 : 5;
        addXP(earned);
        finishSprint();
      } else {
        setSprintQ((prev) => prev + 1);
        setSprintAnswered(false);
        setSprintSel(null);
      }
    }, 600);
  };
  const finishSprint = () => {
    setSprintDone(true);
    if (sprintTimer.current) clearInterval(sprintTimer.current);
  };

  // Manifiesto (17)
  const updateManifiesto = (key: 'a' | 'b' | 'c', val: string) => {
    setManifiesto((prev) => ({ ...prev, [key]: val }));
  };
  const manifiestoOk = () => manifiesto.a.trim().length >= 15 && manifiesto.b.trim().length >= 15 && manifiesto.c.trim().length >= 15;
  const checkManifiesto = () => {
    if (devMode) { addXP(20); return true; }
    if (manifiestoOk()) { addXP(20); return true; }
    return false;
  };

  // ============ RENDERIZADO ============
  const renderIntro = () => (
    <View>
      <View style={styles.iconCircle}><Text style={{ fontSize: 34 }}>⚖️</Text></View>
      <Text style={styles.title}>IA con conciencia</Text>
      <Text style={styles.subtitle}>Sabes cómo funciona la IA. Ahora la pregunta más importante: ¿cómo quieres usarla? Este nivel cierra los Fundamentos y abre algo más grande.</Text>
      <InfoCard variant="violet" icon="🎓" iconBg="#ddd6fe" title="Cierras el Arco de Fundamentos">Completar los 5 niveles base te da el bagaje para todo lo que sigue: prompting avanzado, herramientas especializadas y construcción de apps.</InfoCard>
      <InfoCard variant="indigo" icon="🆕" iconBg="#c7d2fe" title="Dos mecánicas nuevas">Fake Detector para identificar desinformación generada con IA, y tu Manifiesto Personal de uso ético.</InfoCard>
      <InfoCard variant="slate" icon="⭐" iconBg="#e2e8f0" title="Hasta 250 XP disponibles">18 módulos · ~40-50 min · Nivel 5 de 30</InfoCard>
    </View>
  );

  const renderTheory1 = () => (
    <View>
      <Tag variant="theory">📖 Módulo 1 de 18 · Riesgos reales</Tag>
      <Text style={styles.title}>¿La IA puede equivocarse de forma peligrosa?</Text>
      <Text style={styles.bodyText}>La IA no es neutral ni infalible. Cuando se usa sin pensamiento crítico en contextos importantes, puede causar daño real. No es ciencia ficción — ya está ocurriendo.</Text>
      <StepRow n={1}><Text style={styles.b}>Daño por alucinación:</Text> El modelo inventa datos que parecen verídicos. Una persona toma una decisión basada en información falsa que el LLM generó con total confianza.</StepRow>
      <StepRow n={2}><Text style={styles.b}>Discriminación algorítmica:</Text> Sistemas de IA rechazando currículums de ciertos grupos, dando créditos más bajos a personas de ciertas zonas, o aplicando justicia de forma desigual.</StepRow>
      <StepRow n={3}><Text style={styles.b}>Desinformación masiva:</Text> Deepfakes y noticias falsas generadas con IA a escala que antes era imposible para un individuo. Puede influir en elecciones, mercados y opinión pública.</StepRow>
      <StepRow n={4}><Text style={styles.b}>Vigilancia sin consentimiento:</Text> IA usada para monitorear empleados, ciudadanos o estudiantes sin que sepan que están siendo observados y evaluados.</StepRow>
      <StepRow n={5}><Text style={styles.b}>Dependencia excesiva:</Text> Delegar decisiones importantes a la IA sin supervisión humana en contextos de salud, justicia o seguridad.</StepRow>
      <Hl variant="purple"><Text style={styles.b}>💡 La clave:</Text>{'\n'}El problema rara vez es la tecnología sola — es la combinación de tecnología + decisiones humanas sobre cómo y dónde usarla. Entender los riesgos te hace parte de la solución.</Hl>
    </View>
  );

  const CASES = [
    { emoji: '⚖️', title: 'El abogado y los casos inventados', sub: 'EE.UU., 2023', tag: 'ALUCINACIÓN', tagBg: '#fff1f2', tagColor: '#991b1b', body: 'Un abogado usó ChatGPT para investigar precedentes legales. El modelo citó 6 casos judiciales con nombres de jueces, fechas y veredictos. Ninguno de esos casos existía. El abogado los presentó ante el tribunal sin verificar.', fact: '📌 Consecuencia: el abogado fue sancionado por el tribunal. El juez calificó la presentación de "irresponsable". Lección: los LLMs nunca son fuentes primarias para decisiones legales o académicas.' },
    { emoji: '📄', title: 'Amazon y el CV discriminatorio', sub: 'EE.UU., 2018', tag: 'SESGO', tagBg: '#fdf4ff', tagColor: '#7e22ce', body: 'Amazon desarrolló un sistema de IA para filtrar currículums automáticamente. Entrenado con 10 años de contrataciones históricas — donde los empleados eran mayoritariamente hombres — el sistema aprendió a penalizar CVs que mencionaban la palabra "mujeres" (como "capitana del equipo de mujeres").', fact: '📌 Consecuencia: Amazon descartó el sistema. Los sesgos históricos se convierten en discriminación sistémica si no se auditan activamente.' },
    { emoji: '🗳️', title: 'Deepfakes en elecciones de LATAM', sub: 'Latinoamérica, 2023-2024', tag: 'DESINFORMACIÓN', tagBg: '#fef3c7', tagColor: '#92400e', body: 'En varios países latinoamericanos (Argentina, México, Venezuela) circularon audios y videos deepfake de candidatos y figuras políticas diciendo cosas que nunca dijeron. Algunos se viralizaron días antes de elecciones cuando es más difícil desmentirlos.', fact: '📌 El costo de crear un deepfake cayó de miles de dólares a cero con herramientas gratuitas. La escala del problema creció exponencialmente en 2023-2024.' },
    { emoji: '🚔', title: 'Reconocimiento facial y arrestos falsos', sub: 'EE.UU., 2020-2023', tag: 'SESGO RACIAL', tagBg: '#fff1f2', tagColor: '#991b1b', body: 'Al menos 6 personas en EE.UU. fueron arrestadas incorrectamente por sistemas de reconocimiento facial policial. Todos eran personas afroamericanas. Los modelos tienen tasas de error significativamente mayores en personas de piel oscura porque fueron entrenados con datasets con mayoría de personas blancas.', fact: '📌 La tecnología no es neutral — hereda los sesgos de quienes la construyen y de los datos que usan. Las consecuencias aquí fueron arrestos reales de personas inocentes.' },
    { emoji: '🏥', title: 'IA médica que daba prioridad incorrecta', sub: 'EE.UU., 2019', tag: 'SESGO SISTÉMICO', tagBg: '#fdf4ff', tagColor: '#7e22ce', body: 'Un algoritmo usado en hospitales para decidir qué pacientes necesitaban más atención médica usaba el gasto histórico en salud como indicador de necesidad. Pero los pacientes afroamericanos históricamente gastaban menos — no porque estuvieran más sanos, sino por barreras de acceso. El sistema sistemáticamente subestimaba su necesidad real.', fact: '📌 Afectó a decenas de millones de pacientes. El algoritmo reproducía inequidades estructurales haciéndolas invisibles dentro de un sistema "objetivo".' },
  ];

  const renderCases = () => (
    <View>
      <Tag variant="example">🌍 Módulo 2 de 18 · Casos reales</Tag>
      <Text style={styles.title}>Cuando la IA falló en el mundo real</Text>
      <Text style={styles.subtitle}>Toca cada caso para ver qué pasó y qué lección dejó.</Text>
      {CASES.map((c, i) => {
        const open = expandedCard === i;
        return (
          <TouchableOpacity key={i} style={[styles.exCard, open && styles.exCardOpen]} onPress={() => setExpandedCard(open ? null : i)} activeOpacity={0.9}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.exEmoji}><Text style={{ fontSize: 22 }}>{c.emoji}</Text></View>
              <View style={{ flex: 1 }}><Text style={{ fontWeight: '700', fontSize: 13, color: '#0f172a' }}>{c.title}</Text><Text style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{c.sub}</Text></View>
              <MaterialIcons name={open ? 'keyboard-arrow-down' : 'keyboard-arrow-right'} size={20} color="#94a3b8" />
            </View>
            {open && (
              <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#ddd6fe' }}>
                <View style={{ backgroundColor: c.tagBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 6 }}><Text style={{ fontSize: 10, fontWeight: '700', color: c.tagColor }}>{c.tag}</Text></View>
                <Text style={{ fontSize: 12, color: '#334155', lineHeight: 19, marginBottom: 8 }}>{c.body}</Text>
                <Text style={{ fontSize: 11, backgroundColor: '#fffbeb', padding: 9, borderRadius: 8, color: '#92400e', lineHeight: 16, borderWidth: 1, borderColor: '#fde68a80' }}>{c.fact}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
      <Hl variant="red"><Text style={styles.b}>🔑 El patrón común:</Text>{'\n'}En todos estos casos, el fallo no fue la IA funcionando "mal" técnicamente — fue que nadie cuestionó supuestos, auditó sesgos ni mantuvo supervisión humana real sobre decisiones que afectaban personas.</Hl>
    </View>
  );

  const renderEthics = () => {
    const item = ethicsItems[ethicsQ];
    const btn = (val: 'safe' | 'doubt' | 'bad', emoji: string, label: string, hint: string, activeColor: string, activeBg: string) => {
      const isSel = ethicsSel === val;
      const isCorrect = ethicsAnswered && item.correct === val;
      const isWrong = ethicsAnswered && isSel && val !== item.correct;
      return (
        <TouchableOpacity
          style={[styles.ethBtn, { borderColor: activeColor }, isCorrect && { backgroundColor: '#dcfce7', borderColor: '#10b981' }, isWrong && { backgroundColor: '#fff1f2', borderColor: '#ef4444' }, (isSel && !ethicsAnswered) && { backgroundColor: activeBg }]}
          onPress={() => answerEthics(val)}
          disabled={ethicsAnswered}
        >
          <Text style={{ fontSize: 18 }}>{emoji}</Text>
          <Text style={{ fontSize: 10, fontWeight: '700', textAlign: 'center' }}>{label}</Text>
          <Text style={{ fontSize: 9, color: '#94a3b8' }}>{hint}</Text>
        </TouchableOpacity>
      );
    };
    return (
      <View>
        <Tag variant="ethics">⚖️ Módulo 3 de 18 · Ethics Judge</Tag>
        <Text style={styles.title}>¿Seguro, dudoso o problemático?</Text>
        <Text style={styles.subtitle}>Lee cada situación y clasifícala. Piensa antes de responder.</Text>
        <Text style={styles.progressLine}>Situación {ethicsQ + 1} de {ethicsItems.length} · {ethicsCorrect} correctas</Text>
        <View style={styles.scenarioBox}><Text style={{ fontSize: 12, color: '#334155', lineHeight: 20, fontWeight: '500' }}>{item.scenario}</Text></View>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
          {btn('safe', '✅', 'Seguro', 'Uso correcto', '#10b981', '#dcfce7')}
          {btn('doubt', '🤔', 'Dudoso', 'Depende', '#f59e0b', '#fef3c7')}
          {btn('bad', '⛔', 'Problemático', 'No hacerlo', '#ef4444', '#fff1f2')}
        </View>
        {ethicsAnswered && <FeedbackBar type={ethicsSel === item.correct ? 'correct' : 'wrong'}>{ethicsSel === item.correct ? '✅ ' : '❌ '}{item.explain}</FeedbackBar>}
        {ethicsAnswered && !ethicsDone && (
          <TouchableOpacity style={styles.entendidoBtn} onPress={advanceEthics}>
            <Text style={styles.entendidoBtnText}>{ethicsQ + 1 >= ethicsItems.length ? 'Entendido, ver resultado →' : 'Entendido →'}</Text>
          </TouchableOpacity>
        )}
        {!ethicsAnswered && (
          <InfoCard variant="slate" icon="💡" iconBg="#e2e8f0" title="">
            <Text style={styles.b}>Hasta 25 XP</Text> según cuántas aciertes
          </InfoCard>
        )}
      </View>
    );
  };

  const renderTheory2 = () => (
    <View>
      <Tag variant="theory">📖 Módulo 4 de 18 · IA y trabajo</Tag>
      <Text style={styles.title}>¿La IA nos va a quitar el trabajo?</Text>
      <Text style={styles.bodyText}>Esta es la pregunta que más preocupa a adultos y adolescentes. La respuesta honesta: <Text style={styles.b}>algunos trabajos sí cambiarán, pero la historia nos muestra que la tecnología también crea empleos nuevos</Text>.</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 11 }}>
        <View style={[styles.vsCol, { backgroundColor: '#fff1f2' }]}>
          <Text style={[styles.vsHeader, { backgroundColor: '#fecdd3', color: '#991b1b' }]}>⚠️ Lo que la IA puede hacer</Text>
          {['Tareas repetitivas y predecibles', 'Procesamiento masivo de datos', 'Reconocimiento de patrones visuales', 'Traducción y transcripción', 'Generación de primer borrador de contenido'].map((t, i) => <Text key={i} style={styles.vsItem}>{t}</Text>)}
        </View>
        <View style={[styles.vsCol, { backgroundColor: '#f0fdf4' }]}>
          <Text style={[styles.vsHeader, { backgroundColor: '#bbf7d0', color: '#166534' }]}>✅ Lo que los humanos tenemos</Text>
          {['Empatía y conexión emocional real', 'Juicio ético en situaciones complejas', 'Creatividad impulsada por experiencia vivida', 'Liderazgo, negociación y persuasión', 'Responsabilidad y rendición de cuentas'].map((t, i) => <Text key={i} style={styles.vsItem}>{t}</Text>)}
        </View>
      </View>
      <Text style={styles.sectionTitle}>La habilidad que nunca se automatiza</Text>
      <InfoCard variant="violet" icon="🧠" iconBg="#ddd6fe" title="Saber usar la IA">Los trabajadores que saben colaborar con IA son más productivos. No compiten contra ella — la dirigen. La habilidad de <Text style={styles.b}>formular las preguntas correctas, evaluar resultados y tomar decisiones finales</Text> sigue siendo humana.</InfoCard>
      <InfoCard variant="indigo" icon="🔮" iconBg="#c7d2fe" title="Trabajos que nacen con la IA">Prompt engineer, auditor de sesgos, entrenador de modelos, evaluador ético de IA, especialista en seguridad de modelos. Estos roles no existían hace 5 años. Tú los puedes ocupar.</InfoCard>
      <Hl variant="indigo"><Text style={styles.b}>💡 Para recordar:</Text>{'\n'}La calculadora no "quitó" el trabajo a los matemáticos — los liberó para problemas más complejos. La IA está haciendo lo mismo a escala mayor y más rápido. La diferencia es prepararte ahora.</Hl>
    </View>
  );

  const renderTrabajoDrag = () => (
    <View>
      <Tag variant="activity">🧩 Módulo 5 de 18 · Clasificar</Tag>
      <Text style={styles.title}>¿Lo hace un humano, una IA o ambos?</Text>
      <Text style={styles.subtitle}>Clasifica cada tarea según quién puede hacerla mejor hoy en 2025.</Text>
      <InfoCard variant="slate" icon="🔎" iconBg="#e2e8f0" title="">
        🔵 <Text style={styles.b}>Humano:</Text> requiere empatía, ética o responsabilidad · 🟣 <Text style={styles.b}>IA:</Text> puede automatizarse bien · 🟢 <Text style={styles.b}>Ambos:</Text> colaboran
      </InfoCard>
      <View style={styles.chipsPool}>
        {trabajoItems.map((item, idx) => {
          if (trabajoPlaced[idx] !== undefined) return null;
          return (
            <TouchableOpacity
              key={idx}
              style={[styles.chip, trabajoSel === idx && { borderColor: '#7c3aed', backgroundColor: '#ede9fe' }]}
              onPress={() => setTrabajoSel(trabajoSel === idx ? null : idx)}
            >
              <Text style={{ fontSize: 11, color: trabajoSel === idx ? '#5b21b6' : '#334155', fontWeight: '500' }}>{item.text}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {(['humano', 'ia', 'ambos'] as const).map((col) => {
        const has = Object.values(trabajoPlaced).includes(col);
        const colBorder = col === 'humano' ? '#0ea5e9' : col === 'ia' ? '#7c3aed' : '#10b981';
        const colBg = col === 'humano' ? '#f0f9ff' : col === 'ia' ? '#f5f3ff' : '#f0fdf4';
        return (
          <TouchableOpacity
            key={col}
            style={[styles.dropCol, has && { borderStyle: 'solid', borderColor: colBorder, backgroundColor: colBg }]}
            onPress={() => { if (trabajoSel !== null) dropTrabajoChip(trabajoSel, col); }}
          >
            <Text style={[styles.dropHeader, { backgroundColor: col === 'humano' ? '#dbeafe' : col === 'ia' ? '#ede9fe' : '#dcfce7', color: col === 'humano' ? '#1e40af' : col === 'ia' ? '#5b21b6' : '#166534' }]}>
              {col === 'humano' ? '🔵 Humano' : col === 'ia' ? '🟣 IA' : '🟢 Ambos'}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
              {Object.entries(trabajoPlaced).filter(([, v]) => v === col).map(([k]) => (
                <TouchableOpacity key={k} style={{ backgroundColor: col === 'humano' ? '#dbeafe' : col === 'ia' ? '#ede9fe' : '#dcfce7', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12 }} onPress={() => returnTrabajoChip(parseInt(k))}>
                  <Text style={{ fontSize: 10, fontWeight: '600', color: col === 'humano' ? '#1e40af' : col === 'ia' ? '#5b21b6' : '#166534' }}>{trabajoItems[parseInt(k)].text} ✕</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        );
      })}
      {trabajoFb && <FeedbackBar type={trabajoFb.type}>{trabajoFb.msg}</FeedbackBar>}
    </View>
  );

  const renderTheory3 = () => (
    <View>
      <Tag variant="theory">📖 Módulo 6 de 18 · Privacidad</Tag>
      <Text style={styles.title}>Lo que le dices a la IA no desaparece</Text>
      <Text style={styles.bodyText}>Cuando usas un LLM gratuito, los datos que compartes pueden usarse para mejorar el modelo. Esto no es necesariamente malo — pero debes saber qué estás compartiendo.</Text>
      <InfoCard variant="red" icon="🚫" iconBg="#fecdd3" title="Nunca compartas con un LLM">Contraseñas · Números de tarjeta de crédito · Documentos de identidad (cédula, pasaporte) · Código fuente propietario de tu empresa · Información médica muy sensible de terceros · Datos personales de otras personas sin su permiso</InfoCard>
      <InfoCard variant="green" icon="✅" iconBg="#bbf7d0" title="Generalmente seguro compartir">Tu nombre y ciudad · Tu nivel educativo o profesión · El tema de tu proyecto o tarea · Texto que escribiste tú mismo · Preguntas generales sobre cualquier tema</InfoCard>
      <InfoCard variant="amber" icon="🤔" iconBg="#fde68a" title="Depende del contexto">Síntomas médicos (usa con cautela, verifica con médico) · Detalles de conflictos personales · Información laboral confidencial · Datos detallados de terceros</InfoCard>
      <Hl variant="purple"><Text style={styles.b}>💡 Regla práctica:</Text>{'\n'}Si no lo publicarías en una red social, piénsalo dos veces antes de escribirlo en un LLM. Cada proveedor tiene políticas de privacidad distintas — en planes de pago sueles tener más control sobre tus datos.</Hl>
      <Hl variant="indigo"><Text style={styles.b}>🔒 Tu huella digital:</Text>{'\n'}Todo lo que haces en internet deja rastro: búsquedas, clics, tiempo en cada página, conversaciones con IA. Esta información forma un perfil tuyo que las empresas usan para personalizar contenido y — en algunos casos — vender a terceros.</Hl>
    </View>
  );

  const renderTF = () => (
    <View>
      <Tag variant="vf">🔒 Módulo 7 de 18 · Verdadero o Falso</Tag>
      <Text style={styles.title}>Privacidad digital: mitos y realidades</Text>
      <Text style={styles.subtitle}>¿Sabes realmente qué es seguro compartir con un LLM?</Text>
      {privTfItems.map((item, idx) => {
        const sel = tfAnswers[idx];
        const tCorrect = tfChecked && item.correct === true;
        const fCorrect = tfChecked && item.correct === false;
        const tWrong = tfChecked && sel === true && item.correct !== true;
        const fWrong = tfChecked && sel === false && item.correct !== false;
        return (
          <View key={idx} style={{ marginBottom: 14 }}>
            <Text style={styles.tfQuestion}>{idx + 1}. {item.stmt}</Text>
            <View style={{ flexDirection: 'row', gap: 7 }}>
              <TouchableOpacity style={[styles.tfBtn, sel === true && !tfChecked && styles.tfSelT, tCorrect && styles.tfCorrect, tWrong && styles.tfWrong]} onPress={() => selectTF(idx, true)} disabled={tfChecked}>
                <Text style={{ fontWeight: '700', color: tCorrect ? '#166534' : tWrong ? '#991b1b' : sel === true ? '#5b21b6' : '#334155' }}>✅ Verdadero</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tfBtn, sel === false && !tfChecked && styles.tfSelF, fCorrect && styles.tfCorrect, fWrong && styles.tfWrong]} onPress={() => selectTF(idx, false)} disabled={tfChecked}>
                <Text style={{ fontWeight: '700', color: fCorrect ? '#166534' : fWrong ? '#991b1b' : sel === false ? '#991b1b' : '#334155' }}>❌ Falso</Text>
              </TouchableOpacity>
            </View>
            {tfChecked && <FeedbackBar type={sel === item.correct ? 'correct' : 'wrong'}>{sel === item.correct ? '✅ ' : '❌ '}{item.explain}</FeedbackBar>}
          </View>
        );
      })}
    </View>
  );

  const renderTheory4 = () => (
    <View>
      <Tag variant="theory">📖 Módulo 8 de 18 · Deepfakes</Tag>
      <Text style={styles.title}>Deepfakes: cuando ver ya no es creer</Text>
      <Text style={styles.bodyText}>Un <Text style={styles.b}>deepfake</Text> es contenido multimedia (imagen, audio o video) generado con IA que muestra a una persona real diciendo o haciendo algo que nunca ocurrió. En 2024, el costo de crear uno cayó a cero.</Text>
      <View style={styles.scenarioBoxAmber}>
        <Text style={styles.scenarioLabel}>🇨🇴 CASO LATINOAMERICANO</Text>
        <Text style={{ fontSize: 12, color: '#334155', lineHeight: 20 }}>Durante la campaña presidencial argentina de 2023, circuló un audio deepfake de un candidato mayor confesando haber robado fondos públicos. <Text style={styles.b}>Era completamente falso.</Text> Se viralizó en WhatsApp horas antes de un debate clave. Aunque fue desmentido, muchas personas nunca vieron la desmentida — solo el audio falso.</Text>
      </View>
      <Text style={styles.sectionTitle}>¿Cómo detectar un deepfake?</Text>
      <StepRow n={1}><Text style={styles.b}>Verifica la fuente:</Text> ¿El video viene de un canal oficial verificado? ¿Hay otras fuentes que lo confirmen?</StepRow>
      <StepRow n={2}><Text style={styles.b}>Busca en reverse image search:</Text> Sube la imagen a Google Images o TinEye para ver si aparece en otros contextos.</StepRow>
      <StepRow n={3}><Text style={styles.b}>Observa los bordes:</Text> En deepfakes de video, los bordes del pelo, orejas y cuello suelen tener artefactos visuales extraños.</StepRow>
      <StepRow n={4}><Text style={styles.b}>Escucha el audio:</Text> Voces sintéticas a veces suenan planas, sin respiración natural o con cambios abruptos de tono.</StepRow>
      <StepRow n={5}><Text style={styles.b}>Pregúntate: ¿quién se beneficia?</Text> Los deepfakes casi siempre se crean con un objetivo — dañar a alguien o manipular una situación.</StepRow>
      <Hl variant="red"><Text style={styles.b}>🚨 La regla más importante:</Text>{'\n'}No compartas contenido impactante que no hayas verificado. Compartir es amplificar — aunque lo hagas con la intención de criticarlo. El daño ocurre en la distribución, no solo en la creación.</Hl>
    </View>
  );

  const renderFakeDetector = () => (
    <View>
      <Tag variant="new">🆕 Módulo 9 de 18 · Fake Detector</Tag>
      <Text style={styles.title}>¿Real o generado con IA?</Text>
      <Text style={styles.subtitle}>Lee cada titular y decide: ¿es una noticia real o fue fabricada/manipulada?</Text>
      {fakeItems.map((item, idx) => {
        const answered = fakeAnswers[idx] !== undefined;
        const isOk = fakeAnswers[idx] === item.isReal;
        return (
          <View key={idx} style={[styles.fakeCard, answered && { backgroundColor: '#f8fafc' }]}>
            <Text style={{ fontWeight: '700', fontSize: 13, color: '#0f172a', lineHeight: 19, marginBottom: 8 }}>📰 {item.headline}</Text>
            <Text style={{ fontSize: 10, color: '#94a3b8', fontStyle: 'italic', marginBottom: 10 }}>{item.source}</Text>
            <View style={{ flexDirection: 'row', gap: 7 }}>
              <TouchableOpacity
                style={[styles.fakeBtn, { borderColor: '#e2e8f0' }, answered && item.isReal && styles.fakeCorrect, answered && !item.isReal && fakeAnswers[idx] === true && styles.fakeWrong]}
                onPress={() => answerFake(idx, true)}
                disabled={answered}
              >
                <Text style={{ fontWeight: '700', fontSize: 11 }}>✅ Real</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.fakeBtn, { borderColor: '#e2e8f0' }, answered && !item.isReal && styles.fakeCorrect, answered && item.isReal && fakeAnswers[idx] === false && styles.fakeWrong]}
                onPress={() => answerFake(idx, false)}
                disabled={answered}
              >
                <Text style={{ fontWeight: '700', fontSize: 11 }}>🤖 Fabricado con IA</Text>
              </TouchableOpacity>
            </View>
            {answered && <FeedbackBar type={isOk ? 'correct' : 'wrong'}>{isOk ? '✅ ' : '❌ '}{item.explain}</FeedbackBar>}
          </View>
        );
      })}
      <Hl variant="purple"><Text style={styles.b}>💡 Pista:</Text>{'\n'}Los titulares fabricados suelen usar citas absolutas ("el mayor de la historia"), afirmaciones que suenan demasiado perfectas para ser verdad, o atribuyen declaraciones exageradas a figuras reales.</Hl>
    </View>
  );

  const renderTheory5 = () => (
    <View>
      <Tag variant="theory">📖 Módulo 10 de 18 · Consecuencias</Tag>
      <Text style={styles.title}>Cuando el sesgo se convierte en daño real</Text>
      <Text style={styles.bodyText}>En el Nivel 4 aprendiste que los LLMs tienen sesgos. En este nivel entendemos que esos sesgos, cuando están en sistemas que toman decisiones, generan <Text style={styles.b}>daño real a personas reales</Text>.</Text>
      <InfoCard variant="purple" icon="🏦" iconBg="#e9d5ff" title="Crédito bancario">Un sistema de IA que decide quién recibe un préstamo. Si fue entrenado con datos históricos donde ciertos barrios o apellidos tenían más impagos (por razones estructurales, no por comportamiento individual), <Text style={styles.b}>seguirá negando crédito a personas de esas zonas hoy</Text>.</InfoCard>
      <InfoCard variant="red" icon="👮" iconBg="#fecdd3" title="Justicia predictiva">Algunos sistemas predicen la probabilidad de reincidencia de acusados. Si el modelo aprendió con datos donde ciertos grupos fueron más perseguidos históricamente, <Text style={styles.b}>reproduce y amplifica esa desigualdad</Text> con apariencia de objetividad.</InfoCard>
      <InfoCard variant="amber" icon="🎓" iconBg="#fde68a" title="Admisiones universitarias">Algoritmos de selección que aprenden de graduados exitosos previos pueden penalizar candidatos de colegios públicos o regiones específicas, <Text style={styles.b}>perpetuando ventajas estructurales existentes</Text> en lugar de identificar verdadero potencial.</InfoCard>
      <Hl variant="red"><Text style={styles.b}>⚠️ El problema invisible:</Text>{'\n'}Cuando un humano discrimina, hay un responsable visible. Cuando un algoritmo discrimina, el daño se diluye: "fue el sistema", "son los datos", "es el modelo". Esta invisibilidad hace que el sesgo algorítmico sea más difícil de combatir que el prejuicio humano explícito.</Hl>
    </View>
  );

  const renderSort = () => (
    <View>
      <Tag variant="sort">↕️ Módulo 11 de 18 · Ordenar</Tag>
      <Text style={styles.title}>Del sesgo al daño: la cadena completa</Text>
      <Text style={styles.subtitle}>Estos son los pasos por los que un sesgo en datos se convierte en daño social. Están mezclados — ponlos en el orden correcto con ▲▼.</Text>
      <InfoCard variant="violet" icon="💡" iconBg="#ddd6fe" title="">
        Piensa: ¿qué viene primero lógicamente? ¿Los datos, el modelo, la respuesta o el impacto?
      </InfoCard>
      {sortOrder.map((stepIdx, pos) => {
        const mark = sortMarks[pos];
        return (
          <View key={pos} style={[styles.sortItem, mark === 'ok' && styles.sortItemOk, mark === 'bad' && styles.sortItemBad]}>
            <View style={styles.sortNum}><Text style={{ color: '#fff', fontWeight: '700', fontSize: 11 }}>{pos + 1}</Text></View>
            <Text style={styles.sortText}><Text style={styles.b}>{SORT_SESGO[stepIdx].b}</Text>{SORT_SESGO[stepIdx].r}</Text>
            <View style={styles.sortArrows}>
              <TouchableOpacity style={[styles.sortBtn, pos === 0 && { opacity: 0.2 }]} onPress={() => moveSort(pos, -1)} disabled={pos === 0}><MaterialIcons name="keyboard-arrow-up" size={18} color="#64748b" /></TouchableOpacity>
              <TouchableOpacity style={[styles.sortBtn, pos === sortOrder.length - 1 && { opacity: 0.2 }]} onPress={() => moveSort(pos, 1)} disabled={pos === sortOrder.length - 1}><MaterialIcons name="keyboard-arrow-down" size={18} color="#64748b" /></TouchableOpacity>
            </View>
          </View>
        );
      })}
      {sortFb && <FeedbackBar type={sortFb.type}>{sortFb.msg}</FeedbackBar>}
    </View>
  );

  const renderTheory6 = () => (
    <View>
      <Tag variant="theory">📖 Módulo 12 de 18 · Derechos</Tag>
      <Text style={styles.title}>Los derechos digitales que ya tienes</Text>
      <Text style={styles.bodyText}>No eres solo un usuario — eres un ciudadano digital con derechos. En la mayoría de países latinoamericanos y en el mundo, ya existen leyes que te protegen.</Text>
      <InfoCard variant="violet" icon="👁️" iconBg="#ddd6fe" title="Derecho a saber">Tienes derecho a saber si una IA está tomando decisiones que te afectan. Si un algoritmo rechazó tu solicitud, en muchos países tienes derecho a pedir una explicación.</InfoCard>
      <InfoCard variant="indigo" icon="🗑️" iconBg="#c7d2fe" title="Derecho al olvido">En Colombia (Ley 1581) y muchos países, tienes derecho a pedir que borren tus datos personales de bases de datos de empresas. Esto incluye datos que plataformas digitales recopilaron de ti.</InfoCard>
      <InfoCard variant="purple" icon="🙅" iconBg="#e9d5ff" title="Derecho a no ser perfilado">Tienes derecho a que no te tomen decisiones exclusivamente automáticas que te afecten legalmente. Un humano debe poder revisar y apelar decisiones de IA en contextos importantes.</InfoCard>
      <InfoCard variant="green" icon="🏷️" iconBg="#bbf7d0" title="Derecho a saber si hablas con IA">Tienes derecho a que te avisen cuando interactúas con un bot o sistema de IA, no con un humano. Engañarte haciéndote creer que hablas con una persona viola este principio.</InfoCard>
      <Hl variant="purple"><Text style={styles.b}>💪 Tu poder como ciudadano digital:</Text>{'\n'}Conocer tus derechos es el primer paso para ejercerlos. El segundo es exigirlos — como consumidor, como usuario y como futuro profesional que tomará decisiones sobre cómo se usa la IA.</Hl>
    </View>
  );

  const renderQuiz = () => (
    <View>
      <Tag variant="quiz">❓ Módulo 13 de 18 · Quiz de ética</Tag>
      <Text style={styles.title}>Ética en IA: lo que ya debes saber</Text>
      <Text style={styles.subtitle}>Preguntas de nivel avanzado sobre todo lo que hemos visto.</Text>
      {quizItems.map((q, qi) => (
        <View key={qi} style={{ marginBottom: 16 }}>
          <Text style={styles.quizQ}>{qi + 1}. {q.q}</Text>
          {q.opts.map((opt, oi) => {
            const isSel = quizAnswers[qi] === oi;
            const showCorrect = quizChecked && oi === q.correct;
            const showWrong = quizChecked && isSel && oi !== q.correct;
            return (
              <TouchableOpacity key={oi} style={[styles.quizOpt, isSel && !quizChecked && styles.quizOptSel, showCorrect && styles.quizOptCorrect, showWrong && styles.quizOptWrong]} onPress={() => selectQuiz(qi, oi)} disabled={quizChecked}>
                <View style={[styles.quizLetter, isSel && !quizChecked && { backgroundColor: '#7c3aed', borderColor: '#7c3aed' }, showCorrect && { backgroundColor: '#10b981', borderColor: '#10b981' }, showWrong && { backgroundColor: '#ef4444', borderColor: '#ef4444' }]}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: (isSel && !quizChecked) || showCorrect || showWrong ? '#fff' : '#64748b' }}>{String.fromCharCode(65 + oi)}</Text>
                </View>
                <Text style={{ flex: 1, fontSize: 12, color: showCorrect ? '#166534' : showWrong ? '#991b1b' : '#334155', lineHeight: 17 }}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
          {quizChecked && <FeedbackBar type={quizAnswers[qi] === q.correct ? 'correct' : 'wrong'}>{quizAnswers[qi] === q.correct ? '✅ ' : '❌ '}{q.explain}</FeedbackBar>}
        </View>
      ))}
    </View>
  );

  const renderFill = () => (
    <View>
      <Tag variant="fill">💬 Módulo 14 de 18 · Vocabulario ético</Tag>
      <Text style={styles.title}>Completa los principios</Text>
      <Text style={styles.subtitle}>Las palabras correctas importan en ética. Elige la que corresponde a cada definición.</Text>
      {fillItems.map((item, qi) => {
        const answered = fillChecked[qi];
        const sel = fillAnswers[qi];
        const isOk = sel === item.correct;
        const filledWord = answered ? item.allOpts[sel] : '_____';
        return (
          <View key={qi} style={{ marginBottom: 18 }}>
            <View style={[styles.card, { backgroundColor: '#f5f3ff', borderColor: '#ddd6fe' }]}>
              <Text style={styles.cardTitle}>Frase {qi + 1}:</Text>
              <Text style={{ fontSize: 13, color: '#334155', lineHeight: 24 }}>
                {item.sentence.split('_____')[0]}
                <Text style={{ fontWeight: '700', color: answered ? (isOk ? '#166534' : '#991b1b') : '#5b21b6' }}>{filledWord}</Text>
                {item.sentence.split('_____')[1]}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {item.allOpts.map((opt, oi) => {
                const showCorrect = answered && oi === item.correct;
                const showWrong = answered && oi === sel && !isOk;
                return (
                  <TouchableOpacity key={oi} style={[styles.fillOpt, (sel === oi && !answered) && styles.fillOptSel, showCorrect && styles.fillOptCorrect, showWrong && styles.fillOptWrong]} onPress={() => selectFill(qi, oi)} disabled={answered}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: showCorrect ? '#166534' : showWrong ? '#991b1b' : '#334155' }}>{opt}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {answered && <FeedbackBar type={isOk ? 'correct' : 'wrong'}>{isOk ? '✅ ' : '❌ '}{item.explain}</FeedbackBar>}
          </View>
        );
      })}
    </View>
  );

  const renderSprint = () => (
    <View>
      <Tag variant="sprint">⚡ Módulo 15 de 18 · Sprint ético</Tag>
      <Text style={styles.title}>Sprint: ¿Ético o no ético?</Text>
      <Text style={styles.subtitle}>60 segundos para demostrar tu criterio ético. ¿Cuántas aciertas?</Text>
      {!sprintStarted && (
        <InfoCard variant="violet" icon="⚡" iconBg="#ddd6fe" title="">
          Presiona <Text style={styles.b}>"Empezar Sprint"</Text> y responde V/F lo más rápido posible
        </InfoCard>
      )}
      <Text style={[styles.sprintTimer, { color: sprintSec <= 10 ? '#ef4444' : '#7c3aed' }]}>{sprintSec}</Text>
      <View style={styles.sprintBarWrap}>
        <View style={[styles.sprintBar, { width: `${(sprintSec / 60) * 100}%` }]} />
      </View>
      {sprintDone ? (
        <View style={[styles.sprintResult, { backgroundColor: sprintCorrect >= 8 ? '#dcfce7' : sprintCorrect >= 5 ? '#fef3c7' : '#fff1f2' }]}>
          <Text style={{ fontSize: 28, marginBottom: 6 }}>{sprintCorrect >= 8 ? '🏆' : sprintCorrect >= 5 ? '⭐' : '💪'}</Text>
          <Text style={{ fontSize: 17, fontWeight: '800', marginBottom: 4, color: sprintCorrect >= 8 ? '#166534' : sprintCorrect >= 5 ? '#92400e' : '#991b1b' }}>{sprintCorrect} de {sprintItems.length} correctas</Text>
          <Text style={{ fontSize: 12, color: sprintCorrect >= 8 ? '#166534' : sprintCorrect >= 5 ? '#92400e' : '#991b1b' }}>+{sprintCorrect >= 10 ? 25 : sprintCorrect >= 7 ? 18 : sprintCorrect >= 4 ? 12 : 5} XP ganados</Text>
        </View>
      ) : sprintStarted && sprintQ < sprintItems.length ? (
        <View>
          <Text style={styles.sprintScore}>{sprintCorrect} correctas de {sprintQ} respondidas</Text>
          <Text style={styles.sprintQtext}>{sprintItems[sprintQ].stmt}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={[styles.sprintBtn, sprintAnswered && sprintItems[sprintQ].correct === true && styles.sprintBtnCorrect, sprintAnswered && sprintSel === true && sprintItems[sprintQ].correct !== true && styles.sprintBtnWrong]} onPress={() => answerSprint(true)} disabled={sprintAnswered}>
              <Text style={{ fontWeight: '700', fontSize: 12 }}>✅ Verdadero</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sprintBtn, sprintAnswered && sprintItems[sprintQ].correct === false && styles.sprintBtnCorrect, sprintAnswered && sprintSel === false && sprintItems[sprintQ].correct !== false && styles.sprintBtnWrong]} onPress={() => answerSprint(false)} disabled={sprintAnswered}>
              <Text style={{ fontWeight: '700', fontSize: 12 }}>❌ Falso</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <Text style={styles.sprintQtext}>Presiona el botón de abajo para empezar</Text>
      )}
    </View>
  );

  const renderTheory7 = () => (
    <View>
      <Tag variant="theory">🌟 Módulo 16 de 18 · Tu futuro</Tag>
      <Text style={styles.title}>Tu lugar en el futuro de la IA</Text>
      <Text style={styles.bodyText}>Eres parte de la primera generación que crece con estas herramientas desde temprana edad. Eso no es una ventaja menor — es una ventaja histórica.</Text>
      <InfoCard variant="violet" icon="🎓" iconBg="#ddd6fe" title="Lo que acabas de aprender (Niveles 1-5)">Fundamentos de IA, tipos de modelos, prompting, cómo funcionan los LLMs por dentro, y ahora ética. Tienes una base que la mayoría de adultos no tiene.</InfoCard>
      <InfoCard variant="indigo" icon="🛠️" iconBg="#c7d2fe" title="Lo que viene en los Niveles 7-36">Herramientas especializadas (NotebookLM, ElevenLabs, Midjourney), construcción de apps con Lovable y Supabase, y proyectos reales que puedes mostrar en un portafolio.</InfoCard>
      <InfoCard variant="green" icon="🌍" iconBg="#bbf7d0" title="El rol que puedes tomar">No solo usuario de IA — <Text style={styles.b}>constructor, evaluador y defensor</Text>. Alguien que sabe cómo funciona, cuándo usarla, cuándo cuestionarla, y cómo construir cosas con ella que solucionen problemas reales.</InfoCard>
      <Hl variant="purple"><Text style={styles.b}>💬 Una pregunta para llevarte:</Text>{'\n'}¿Qué problema real de tu comunidad, tu colegio o tu familia podrías empezar a resolver con las herramientas que vas a aprender en los próximos niveles? No tiene que ser grande. Tiene que ser tuyo.</Hl>
      <InfoCard variant="slate" icon="🤝" iconBg="#e2e8f0" title="El compromiso más importante">Usar la IA con honestidad, pensamiento crítico y respeto por las personas afectadas. Eso es lo que separa a un usuario poderoso de uno peligroso.</InfoCard>
    </View>
  );

  const MANIFIESTO_FIELDS = [
    { key: 'a' as const, prefix: '⚠️ La IA me preocupa cuando...', placeholder: '...la gente la usa sin pensar, cuando se usa para engañar, cuando toma decisiones sobre personas sin supervisión...' },
    { key: 'b' as const, prefix: '✅ Voy a usarla responsablemente porque...', placeholder: '...quiero aprender de verdad, porque el futuro depende de personas que la usen bien, porque me importa...' },
    { key: 'c' as const, prefix: '🌍 Mi compromiso digital es...', placeholder: '...verificar antes de compartir, no copiar trabajos, defender mi privacidad, usar la IA para crear cosas que ayuden...' },
  ];

  const renderManifiesto = () => (
    <View>
      <Tag variant="manifiesto">✍️ Módulo 17 de 18 · Manifiesto · +20 XP</Tag>
      <Text style={styles.title}>Tu Manifiesto Digital</Text>
      <Text style={styles.subtitle}>Completaste los Fundamentos de IA. Es momento de declarar cómo quieres usar este poder. Completa estas tres frases con honestidad.</Text>
      <InfoCard variant="violet" icon="💡" iconBg="#ddd6fe" title="">
        No hay respuestas correctas ni incorrectas — solo tuyas. Sé honesto/a.
      </InfoCard>
      {MANIFIESTO_FIELDS.map((f, idx) => (
        <View key={f.key} style={{ marginBottom: 12 }}>
          <Text style={styles.manifiestoLabel}>Frase {idx + 1} de 3</Text>
          <Text style={styles.manifiestoPrefix}>{f.prefix}</Text>
          <TextInput
            style={styles.manifiestoArea}
            multiline
            placeholder={f.placeholder}
            placeholderTextColor="#b8bcc0"
            value={manifiesto[f.key]}
            onChangeText={(val) => updateManifiesto(f.key, val)}
          />
          <Text style={{ fontSize: 11, color: '#94a3b8', textAlign: 'right', marginTop: 4 }}>{manifiesto[f.key].length} / 15 mín.</Text>
        </View>
      ))}
      <Hl variant="indigo">🎖️ <Text style={styles.b}>Este manifiesto es tuyo para siempre.</Text>{'\n'}Cada vez que uses IA, vuelve mentalmente a él. ¿Estás siendo fiel a lo que escribiste aquí?</Hl>
    </View>
  );

  const renderCompletion = () => (
    <View style={{ alignItems: 'center', padding: 8 }}>
      <View style={styles.completeBadge}><Text style={{ fontSize: 44 }}>🎓</Text></View>
      <Text style={[styles.title, { textAlign: 'center', fontSize: 21 }]}>¡Nivel 5 completado!</Text>
      <Text style={[styles.subtitle, { textAlign: 'center' }]}>Terminaste "IA con conciencia" y con eso cerraste el Arco de Fundamentos. Ahora eres un usuario consciente, crítico y ético de la inteligencia artificial.</Text>
      <View style={styles.arcBadge}>
        <Text style={styles.arcBadgeTitle}>🏆 ARCO COMPLETADO: Fundamentos de IA</Text>
        <Text style={styles.arcBadgeSub}>Niveles 1 a 5 completados · 5 badges desbloqueados{'\n'}Pasaste de no saber qué es la IA a entender cómo funciona, cómo usarla y cómo usarla bien.</Text>
      </View>
      <View style={styles.xpEarned}><Text style={{ fontSize: 15, fontWeight: '700', color: '#92400e' }}>⭐ {xp} XP ganados en este nivel</Text></View>
      <View style={{ width: '100%', marginBottom: 14 }}>
        {[
          'Identifico usos seguros, dudosos y problemáticos de la IA',
          'Sé qué nunca debo compartir con un LLM y por qué',
          'Puedo detectar señales de desinformación y deepfakes',
          'Entiendo cómo los sesgos algorítmicos generan daño real',
          'Conozco mis derechos digitales como ciudadano',
          'Tengo un manifiesto personal de uso ético de la IA',
        ].map((skill, i) => (
          <View key={i} style={styles.skillRow}>
            <Text style={styles.skillCheck}>✓</Text>
            <Text style={styles.skillText}>{skill}</Text>
          </View>
        ))}
      </View>
      <View style={styles.nextHint}>
        <Text style={{ fontSize: 12, color: '#334155', lineHeight: 18 }}>🛠️ <Text style={styles.b}>Nivel 6: Tu primer proyecto con IA</Text>{'\n\n'}Vamos a pasar de la teoría a la práctica. Usarás todo lo que aprendiste para construir algo real con LLMs: un asistente personalizado, un generador de contenido o una herramienta de estudio. ¡Tu primer proyecto en el portafolio IA Explorer!</Text>
      </View>
      <View style={{ width: '100%', marginBottom: 14 }}>
        <Text style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>Nivel 5 de 36 completado · Mundo 1 — ¿Qué es la IA?</Text>
        <View style={{ height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}><View style={{ height: '100%', width: '17%', backgroundColor: '#7c3aed', borderRadius: 3 }} /></View>
      </View>
      <TouchableOpacity style={styles.finishButton} onPress={handleFinish}>
        <Text style={{ fontWeight: '700', color: '#fff', fontSize: 15 }}>Siguiente nivel →</Text>
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
  const progLabel = step === 0 ? 'Introducción' : step < TOTAL_STEPS - 1 ? `Módulo ${step} de ${CONTENT_STEPS}` : '¡Nivel completado!';
  const stepsCounter = step === 0 ? '' : step < TOTAL_STEPS - 1 ? `${step} de ${CONTENT_STEPS} módulos completados` : `${CONTENT_STEPS} de ${CONTENT_STEPS} módulos completados`;

  const CHECK_STEPS = [3, 5, 7, 9, 11, 13, 14, 15, 17];
  const showNextBtn = step < TOTAL_STEPS - 1 && !CHECK_STEPS.includes(step);
  const showCheckBtn = CHECK_STEPS.includes(step);
  const THEORY_STEPS = new Set([1, 2, 4, 6, 8, 10, 12, 16]);
  const showBackButton = step > 0 && THEORY_STEPS.has(step) && showNextBtn;

  const handleMainBtn = () => {
    if (devMode) { goToNextStep(); return; }
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
    if (handler && !handler()) return;
    goToNextStep();
  };

  const nextBtnLabel = () => {
    if (step === 0) return '¡Empezar! →';
    if (step === 2) return 'Continuar →';
    return 'Entendido →';
  };

  const checkBtnLabel = () => {
    switch (step) {
      case 3: return ethicsDone ? 'Continuar →' : 'Evalúa cada situación';
      case 5: return trabajoOk ? 'Continuar →' : 'Verificar clasificación';
      case 7: return tfChecked ? 'Continuar →' : 'Comprobar';
      case 9: return canProceedFake() ? 'Continuar →' : 'Responde todos para continuar';
      case 11: return sortOk ? 'Continuar →' : 'Verificar orden';
      case 13: return quizChecked ? 'Continuar →' : 'Comprobar respuestas';
      case 14: return canProceedFill() ? 'Continuar →' : 'Responde todas para continuar';
      case 15: return sprintDone ? 'Continuar →' : 'Empezar Sprint ⚡';
      case 17: return 'Publicar manifiesto ✨';
      default: return 'Continuar →';
    }
  };

  const getNote = () => {
    switch (step) {
      case 5: return 'Toca un chip → luego toca la columna donde va';
      case 7: return `Responde las ${privTfItems.length} afirmaciones · hasta ${privTfItems.length * 5} XP`;
      case 9: return 'Marca cada titular: ¿ocurrió realmente o fue fabricado con IA? · hasta 20 XP';
      case 13: return `Responde las ${quizItems.length} preguntas · hasta ${quizItems.length * 8} XP`;
      case 14: return 'Elige la palabra correcta en cada frase · +8 XP cada una';
      case 15: return '60 segundos · Verdadero o Falso · hasta 25 XP';
      case 17: return 'Completa las 3 frases (mín. 15 caracteres cada una) · +20 XP';
      default: return '';
    }
  };

  // Botón check: acción y disabled
  const checkDisabled =
    (step === 3 && !ethicsDone) ||
    (step === 7 && !tfChecked && Object.keys(tfAnswers).length < privTfItems.length) ||
    (step === 9 && !canProceedFake()) ||
    (step === 13 && !quizChecked && Object.keys(quizAnswers).length < quizItems.length) ||
    (step === 14 && !canProceedFill()) ||
    (step === 17 && !manifiestoOk() && !devMode) ||
    (step === 15 && sprintStarted && !sprintDone);

  const onCheckPress = () => {
    if (step === 15 && !sprintStarted && !sprintDone) { startSprint(); return; }
    handleMainBtn();
  };

  const note = getNote();

  return (
    <View style={styles.screen}>
      <View style={styles.progressBar}>
        <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
          <MaterialIcons name="close" size={22} color="#5b21b6" />
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
        {renderStepContent()}
      </ScrollView>
      {xpToast && <XPToast key={xpToast.id} amount={xpToast.amount} onHide={() => setXpToast(null)} />}
      {step < TOTAL_STEPS - 1 && (
        <View style={styles.btnRow}>
          <View style={styles.footerRow}>
            {showBackButton && (
              <TouchableOpacity style={styles.backButton} onPress={goToPrevStep}>
                <Text style={styles.backButtonText}>← Volver</Text>
              </TouchableOpacity>
            )}
            {showNextBtn && (
              <TouchableOpacity style={[styles.nextButton, showBackButton && styles.nextButtonFlex]} onPress={handleMainBtn}>
                <Text style={styles.nextButtonText}>{nextBtnLabel()}</Text>
              </TouchableOpacity>
            )}
            {showCheckBtn && (
              <TouchableOpacity style={[styles.nextButton, styles.nextButtonFlex, checkDisabled && { opacity: 0.32 }]} onPress={onCheckPress} disabled={checkDisabled}>
                <Text style={styles.nextButtonText}>{checkBtnLabel()}</Text>
              </TouchableOpacity>
            )}
          </View>
          {!!note && <Text style={styles.btnNote}>{note}</Text>}
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

// ===================== ESTILOS =====================
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  progressBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#f5f3ff', backgroundColor: '#f5f3ff' },
  closeBtn: { minWidth: 42, minHeight: 42, borderRadius: 10, backgroundColor: '#ede9fe', borderWidth: 1, borderColor: '#ddd6fe', justifyContent: 'center', alignItems: 'center' },
  progWrap: { flex: 1, marginHorizontal: 9 },
  progressTrack: { height: 8, backgroundColor: '#ede9fe', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#7c3aed', borderRadius: 4 },
  progLabel: { fontSize: 10, color: '#94a3b8', marginTop: 3, fontWeight: '500' },
  xpText: { ...typography.bold, fontSize: 12, color: '#92400e', backgroundColor: '#fde68a', paddingHorizontal: 11, paddingVertical: 4, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#fcd34d' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 15, paddingBottom: 30 },
  tag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 11 },
  tagText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  iconCircle: { width: 66, height: 66, borderRadius: 20, backgroundColor: '#ede9fe', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  title: { ...typography.extraBold, fontSize: 19, color: '#0f172a', marginBottom: 7, lineHeight: 25 },
  subtitle: { ...typography.regular, fontSize: 13, color: '#64748b', marginBottom: 13, lineHeight: 20 },
  bodyText: { ...typography.regular, fontSize: 13, color: '#334155', lineHeight: 22, marginBottom: 11 },
  sectionTitle: { ...typography.bold, fontSize: 13, color: '#0f172a', marginTop: 13, marginBottom: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  b: { fontWeight: '700', color: '#0f172a' },
  progressLine: { fontSize: 11, color: '#64748b', textAlign: 'center', marginBottom: 6, fontWeight: '500' },
  card: { borderRadius: 14, padding: 13, marginBottom: 9, borderWidth: 1, borderColor: '#e2e8f0' },
  cardRow: { flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  cardIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  cardTitle: { ...typography.bold, fontSize: 12, color: '#0f172a', marginBottom: 3 },
  cardText: { ...typography.regular, fontSize: 12, color: '#334155', lineHeight: 18 },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#7c3aed', justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  exCard: { backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 8 },
  exCardOpen: { borderColor: '#7c3aed', backgroundColor: '#f5f3ff' },
  exEmoji: { width: 40, height: 40, backgroundColor: '#f1f5f9', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  scenarioBox: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, marginBottom: 10 },
  scenarioBoxAmber: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 13, padding: 13, marginVertical: 10 },
  scenarioLabel: { fontSize: 9, fontWeight: '700', color: '#92400e', letterSpacing: 0.8, marginBottom: 7, textTransform: 'uppercase' },
  ethBtn: { flex: 1, paddingVertical: 10, paddingHorizontal: 6, borderRadius: 11, borderWidth: 2, backgroundColor: '#fff', alignItems: 'center', minHeight: 56, justifyContent: 'center', gap: 3 },
  entendidoBtn: { backgroundColor: '#7c3aed', paddingVertical: 12, borderRadius: 11, alignItems: 'center', marginTop: 10 },
  entendidoBtnText: { ...typography.bold, color: '#fff', fontSize: 14 },
  vsCol: { flex: 1, borderRadius: 12, padding: 11, borderWidth: 1, borderColor: '#e2e8f0' },
  vsHeader: { fontSize: 10, fontWeight: '700', textAlign: 'center', paddingVertical: 4, paddingHorizontal: 6, borderRadius: 7, marginBottom: 7, textTransform: 'uppercase' },
  vsItem: { fontSize: 11, color: '#334155', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', lineHeight: 15 },
  chipsPool: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 10, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 9, minHeight: 52 },
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1.5, borderColor: '#cbd5e1', backgroundColor: '#fff' },
  dropCol: { borderWidth: 2, borderStyle: 'dashed', borderColor: '#cbd5e1', borderRadius: 12, padding: 7, minHeight: 74, backgroundColor: '#fafafa', marginBottom: 7 },
  dropHeader: { fontSize: 10, fontWeight: '700', textAlign: 'center', paddingVertical: 4, paddingHorizontal: 6, borderRadius: 7, marginBottom: 6, textTransform: 'uppercase', overflow: 'hidden' },
  tfQuestion: { fontWeight: '700', fontSize: 12, color: '#0f172a', padding: 11, backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 8, lineHeight: 18 },
  tfBtn: { flex: 1, padding: 12, borderRadius: 11, borderWidth: 2, borderColor: '#e2e8f0', backgroundColor: '#fff', alignItems: 'center', minHeight: 52, justifyContent: 'center' },
  tfSelT: { borderColor: '#7c3aed', backgroundColor: '#f5f3ff' },
  tfSelF: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },
  tfCorrect: { borderColor: '#10b981', backgroundColor: '#dcfce7' },
  tfWrong: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },
  fakeCard: { borderRadius: 14, padding: 13, borderWidth: 2, borderColor: '#e2e8f0', marginBottom: 10, backgroundColor: '#fafafa' },
  fakeBtn: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10, borderWidth: 2, backgroundColor: '#fff', alignItems: 'center', minHeight: 42, justifyContent: 'center' },
  fakeCorrect: { borderColor: '#10b981', backgroundColor: '#dcfce7' },
  fakeWrong: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },
  sortItem: { flexDirection: 'row', alignItems: 'center', padding: 11, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1.5, borderColor: '#e2e8f0', marginBottom: 6, gap: 9 },
  sortItemOk: { borderColor: '#86efac', backgroundColor: '#f0fdf4' },
  sortItemBad: { borderColor: '#fca5a5', backgroundColor: '#fff1f2' },
  sortNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#7c3aed', justifyContent: 'center', alignItems: 'center' },
  sortText: { flex: 1, fontSize: 11, color: '#334155', lineHeight: 16 },
  sortArrows: { flexDirection: 'column', gap: 3 },
  sortBtn: { width: 28, height: 26, borderRadius: 7, borderWidth: 1, borderColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  quizQ: { fontWeight: '700', fontSize: 12, color: '#0f172a', padding: 11, backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 9, lineHeight: 18 },
  quizOpt: { flexDirection: 'row', alignItems: 'flex-start', padding: 11, borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, marginBottom: 6, gap: 9, backgroundColor: '#fff' },
  quizOptSel: { borderColor: '#7c3aed', backgroundColor: '#ede9fe' },
  quizOptCorrect: { borderColor: '#10b981', backgroundColor: '#dcfce7' },
  quizOptWrong: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },
  quizLetter: { width: 22, height: 22, borderRadius: 6, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center', marginTop: 1 },
  fillOpt: { paddingVertical: 8, paddingHorizontal: 13, borderRadius: 10, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  fillOptSel: { borderColor: '#7c3aed', backgroundColor: '#ede9fe' },
  fillOptCorrect: { borderColor: '#10b981', backgroundColor: '#dcfce7' },
  fillOptWrong: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },
  sprintTimer: { fontSize: 36, fontWeight: '800', textAlign: 'center', marginTop: 8, marginBottom: 4 },
  sprintBarWrap: { height: 8, backgroundColor: '#e2e8f0', borderRadius: 4, overflow: 'hidden', marginBottom: 12 },
  sprintBar: { height: '100%', borderRadius: 4, backgroundColor: '#7c3aed' },
  sprintScore: { textAlign: 'center', fontSize: 12, color: '#64748b', marginBottom: 6 },
  sprintQtext: { fontSize: 13, fontWeight: '700', color: '#0f172a', padding: 12, backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 9, lineHeight: 20, minHeight: 52 },
  sprintBtn: { flex: 1, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 11, borderWidth: 2, borderColor: '#e2e8f0', backgroundColor: '#fff', alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  sprintBtnCorrect: { borderColor: '#10b981', backgroundColor: '#dcfce7' },
  sprintBtnWrong: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },
  sprintResult: { padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  manifiestoLabel: { fontSize: 11, fontWeight: '700', color: '#5b21b6', marginBottom: 4, paddingLeft: 2 },
  manifiestoPrefix: { fontSize: 13, color: '#0f172a', fontWeight: '700', paddingVertical: 9, paddingHorizontal: 11, backgroundColor: '#ede9fe', borderTopLeftRadius: 10, borderTopRightRadius: 10, borderWidth: 1.5, borderColor: '#c4b5fd', borderBottomWidth: 0 },
  manifiestoArea: { borderWidth: 1.5, borderColor: '#ddd6fe', borderTopWidth: 0, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, padding: 11, fontSize: 13, color: '#334155', textAlignVertical: 'top', minHeight: 76, backgroundColor: '#fafafa', lineHeight: 20 },
  completeBadge: { width: 86, height: 86, borderRadius: 24, backgroundColor: '#c4b5fd', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  arcBadge: { padding: 12, backgroundColor: '#eef2ff', borderRadius: 12, borderWidth: 1, borderColor: '#c4b5fd', marginBottom: 14, width: '100%', alignItems: 'center' },
  arcBadgeTitle: { fontSize: 12, fontWeight: '800', color: '#5b21b6', marginBottom: 3, textAlign: 'center' },
  arcBadgeSub: { fontSize: 11, color: '#6d28d9', lineHeight: 16, textAlign: 'center' },
  xpEarned: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 11, paddingHorizontal: 20, backgroundColor: '#fef9c3', borderRadius: 12, marginBottom: 14, borderWidth: 1, borderColor: '#fcd34d', width: '100%' },
  skillRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: '#f0fdf4', borderRadius: 9, borderWidth: 1, borderColor: '#bbf7d0', marginBottom: 6 },
  skillCheck: { color: '#10b981', fontSize: 14, marginTop: 1 },
  skillText: { flex: 1, fontSize: 11, color: '#166534', lineHeight: 15, fontWeight: '500' },
  nextHint: { padding: 11, backgroundColor: '#f8fafc', borderRadius: 10, width: '100%', borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 13 },
  btnRow: { paddingHorizontal: 13, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', backgroundColor: '#fafcff' },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nextButton: { flex: 1, backgroundColor: '#7c3aed', paddingVertical: 13, borderRadius: 12, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  nextButtonText: { ...typography.bold, color: '#fff', fontSize: 14 },
  nextButtonFlex: { flex: 1 },
  backButton: { backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#e2e8f0', paddingVertical: 13, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  backButtonText: { ...typography.bold, color: '#64748b', fontSize: 14 },
  btnNote: { fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 5 },
  finishButton: { backgroundColor: '#7c3aed', paddingVertical: 14, borderRadius: 12, width: '100%', alignItems: 'center' },
  dotsRow: { flexDirection: 'row', gap: 3, justifyContent: 'center', flexWrap: 'wrap', paddingTop: 9 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#cbd5e1' },
  dotActive: { backgroundColor: '#7c3aed', width: 16 },
  dotDone: { backgroundColor: '#a5b4fc' },
  stepsCounter: { fontSize: 10, color: '#94a3b8', textAlign: 'center', paddingTop: 4 },
});
