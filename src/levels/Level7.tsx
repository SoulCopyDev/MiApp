import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, BackHandler, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useGameStore } from '../store/gameStore';
import { typography } from '../theme';
import XPToast from '../components/XPToast';

// ---------- Tipos ----------
type CompareItem = { task: string; bad: string; good: string; badWhy: string; goodWhy: string };
type MatchPair = { left: string; right: string };
type TFItem = { stmt: string; correct: boolean; explain: string };
type QuizItem = { q: string; opts: string[]; correct: number; explain: string };
type FillItem = { sentence: string; allOpts: string[]; correct: number; explain: string };
type SprintItem = { stmt: string; correct: boolean };
type TecnicaItem = { scenario: string; opciones: string[]; correct: number; promptHint: string; explain: string };
type RankerPrompt = { id: string; text: string; level: number; label: string };
type RankerSet = { task: string; prompts: RankerPrompt[]; explain: string };
type SortStep = { b: string; t: string };

const TOTAL_STEPS = 22;
const CONTENT_STEPS = 20;

const pickN = <T,>(arr: T[], n: number): T[] => [...arr].sort(() => Math.random() - 0.5).slice(0, n);

// ===================== POOLS (fuente: nivel-07.html) =====================

const COMPARE_POOL: CompareItem[] = [
  { task: 'Pedir ayuda con matemáticas', bad: 'Ayúdame con matemáticas', good: 'Eres un tutor paciente de matemáticas para estudiantes de 10° grado. Tengo dificultades con ecuaciones cuadráticas. Explícame la fórmula cuadrática paso a paso y luego dame 2 ejercicios de práctica similares a: 2x²+5x-3=0. Formato: explicación + ejercicios numerados.', badWhy: 'Vago — no dice qué tipo de ayuda, qué nivel, qué tema exacto ni qué formato quiere.', goodWhy: 'Rol + contexto + tarea específica + ejemplo concreto + formato deseado.' },
  { task: 'Pedir una historia creativa', bad: 'Escríbeme una historia', good: 'Escribe una historia corta de ciencia ficción (máximo 300 palabras) sobre un adolescente colombiano de 15 años que descubre que su ciudad tiene una IA que controla el tráfico pero que ha desarrollado emociones. Tono: misterioso pero esperanzador. Termina en un punto de giro.', badWhy: 'Sin género, sin longitud, sin personajes, sin tono. El resultado será genérico y aburrido.', goodWhy: 'Género + longitud + personaje específico + contexto cultural + tono + instrucción de final.' },
  { task: 'Pedir revisión de texto', bad: 'Revisa este texto', good: 'Revisa este párrafo ÚNICAMENTE para: 1) errores de ortografía y tildes, 2) coherencia entre oraciones. NO cambies el vocabulario ni la estructura. NO reescribas frases completas. Devuelve el texto corregido y una lista de los cambios que hiciste con explicación breve de cada uno.', badWhy: 'No dice qué revisar, qué no cambiar, ni en qué formato quiere la respuesta.', goodWhy: 'Lista exacta de qué hacer, restricciones explícitas de qué NO hacer, formato de entrega especificado.' },
  { task: 'Pedir análisis de un problema', bad: 'Analiza este problema', good: 'Analiza este problema de diseño de producto desde 3 perspectivas distintas: 1) el usuario final, 2) el equipo de desarrollo, 3) el negocio. Para cada perspectiva: identifica el problema central, da 2 posibles soluciones y evalúa pros y contras. Máximo 150 palabras por perspectiva.', badWhy: '¿Qué tipo de análisis? ¿Desde qué perspectiva? ¿En qué formato? Completamente abierto.', goodWhy: 'Número de perspectivas + cuáles son + estructura interna de cada una + límite de palabras.' },
  { task: 'Pedir un plan de estudios', bad: 'Dame un plan de estudio', good: 'Crea un plan de estudio de 2 semanas para el examen de química de grado 11 (Colombia). Temas: estequiometría, equilibrio químico y termoquímica. Disponibilidad: 1 hora diaria de lunes a viernes. Incluye: qué estudiar cada día, recursos sugeridos (tipo de material, no links) y un mini-quiz de 3 preguntas para verificar comprensión al final de cada semana.', badWhy: 'Sin materia, sin nivel, sin tiempo disponible, sin temas, sin formato.', goodWhy: 'Materia + nivel + duración + temas exactos + tiempo disponible + estructura del entregable.' },
];

const MATCH_POOL: MatchPair[] = [
  { left: 'Chain of Thought', right: 'Problema de lógica complejo que requiere razonamiento paso a paso' },
  { left: 'Few-shot (ejemplos)', right: 'Quieres que el modelo replique exactamente un formato o estilo' },
  { left: 'Negative Prompting', right: 'El modelo sigue incluyendo algo que no quieres aunque lo pides' },
  { left: 'Role System', right: 'Necesitas que el modelo mantenga una personalidad o expertise específica' },
  { left: 'Multi-step', right: 'La tarea es demasiado compleja para un solo prompt' },
  { left: 'Zero-shot directo', right: 'La tarea es simple y clara sin necesidad de guía adicional' },
];

const SORT_COT: SortStep[] = [
  { b: 'Enuncia el problema completo:', t: ' Escribe la pregunta o tarea con todos sus detalles' },
  { b: 'Pide razonamiento explícito:', t: ' Agrega "Piensa paso a paso antes de responder"' },
  { b: 'El modelo expone su proceso:', t: ' El LLM muestra cada paso de su razonamiento' },
  { b: 'Llega a una conclusión:', t: ' El modelo da la respuesta final basada en el razonamiento' },
  { b: 'Evalúas la lógica:', t: ' Puedes identificar exactamente en qué paso se equivocó, si lo hizo' },
];

const TF_POOL: TFItem[] = [
  { stmt: 'Un prompt más largo siempre produce mejores resultados que uno corto.', correct: false, explain: 'Falso. La longitud no determina la calidad — la precisión sí. Un prompt corto y preciso supera a uno largo y vago. El exceso de texto puede diluir las instrucciones clave.' },
  { stmt: 'El "Chain of Thought" es útil especialmente para problemas matemáticos y de lógica.', correct: true, explain: 'Correcto. Cuando le pides al modelo que razone paso a paso, comete menos errores en problemas que requieren múltiples pasos de inferencia, cálculo o lógica.' },
  { stmt: 'Dar ejemplos de lo que NO quieres (negative prompting) puede ser tan útil como dar ejemplos de lo que sí quieres.', correct: true, explain: 'Sí. Los ejemplos negativos son muy efectivos para acotar el espacio de respuestas. Decir "no uses jerga técnica" es a veces más claro que describir el tono que sí quieres.' },
  { stmt: 'Si el modelo no da la respuesta correcta, siempre es culpa del modelo y no del prompt.', correct: false, explain: 'Falso. La mayoría de respuestas pobres son producto de prompts vagos o incompletos. Antes de culpar al modelo, refina el prompt: agrega contexto, ejemplos o restricciones.' },
  { stmt: 'El Few-shot prompting consiste en darle al modelo ejemplos del tipo de respuesta que esperas.', correct: true, explain: 'Exacto. En lugar de describir lo que quieres, le muestras ejemplos. "Aquí hay 2 ejemplos del formato que necesito: [ejemplo 1] [ejemplo 2]. Ahora haz lo mismo con: [tu tarea]."' },
  { stmt: 'El role prompting (asignar un rol) solo funciona con roles de profesiones reales como médico o abogado.', correct: false, explain: 'Falso. Puedes asignar cualquier rol: "eres un estudiante escéptico", "eres un crítico literario del siglo XVIII", "eres un niño de 8 años explicando algo". Los roles creativos también cambian el comportamiento del modelo.' },
  { stmt: 'Un prompt con instrucciones contradictorias generalmente produce respuestas impredecibles.', correct: true, explain: 'Correcto. Si le dices "sé conciso pero exhaustivo" o "sé formal pero divertido" sin más contexto, el modelo no sabe qué priorizar y el resultado varía. Las instrucciones deben ser consistentes entre sí.' },
  { stmt: 'Pedir al modelo que "tome un respiro" o "piense cuidadosamente" antes de responder mejora la calidad.', correct: true, explain: 'Sí, y está documentado experimentalmente. Frases como "tómate el tiempo que necesites" o "piensa paso a paso" mejoran el rendimiento, especialmente en tareas complejas.' },
  { stmt: 'El multi-step prompting significa simplemente dividir tu pregunta en varias líneas.', correct: false, explain: 'Falso. Multi-step prompting es usar el output de un prompt como input del siguiente — son conversaciones encadenadas donde cada respuesta construye sobre la anterior. No es formato, es estrategia.' },
  { stmt: 'Un prompt con el contexto del usuario (edad, nivel, objetivo) siempre produce mejores respuestas que uno sin él.', correct: true, explain: 'Generalmente sí. El contexto del usuario permite al modelo calibrar vocabulario, profundidad y ejemplos. "Explícame la relatividad" vs "Explícame la relatividad, soy estudiante de 14 años" produce resultados muy diferentes.' },
];

const RANKER_SETS: RankerSet[] = [
  { task: 'Pedir un resumen de un artículo', prompts: [
    { id: 'A', text: 'Resume esto.', level: 0, label: 'Malo' },
    { id: 'B', text: 'Resume este artículo en 5 puntos clave. Usa lenguaje simple, sin jerga técnica. Cada punto en máximo una oración.', level: 2, label: 'Excelente' },
    { id: 'C', text: 'Haz un resumen del artículo de arriba con los puntos más importantes.', level: 1, label: 'Regular' },
  ], explain: 'Malo: sin formato ni restricciones. Regular: pide puntos pero sin longitud ni nivel de lenguaje. Excelente: puntos + límite de oraciones + nivel de lenguaje especificado.' },
  { task: 'Pedir feedback sobre un ensayo', prompts: [
    { id: 'A', text: 'Dame feedback de este ensayo sobre el argumento principal, la evidencia que lo soporta y la claridad de la conclusión. Para cada uno: señala lo que funciona bien y una sugerencia concreta de mejora. No corrijas gramática — eso lo haré yo después.', level: 2, label: 'Excelente' },
    { id: 'B', text: '¿Qué piensas de mi ensayo?', level: 0, label: 'Malo' },
    { id: 'C', text: 'Dame feedback del ensayo. Dime qué está bien y qué puede mejorar.', level: 1, label: 'Regular' },
  ], explain: 'Malo: vaga, subjetiva, sin instrucción clara. Regular: mejor estructura pero sin especificar qué dimensiones evaluar. Excelente: 3 dimensiones específicas + estructura de feedback + restricción explícita.' },
];

const TECNICA_POOL: TecnicaItem[] = [
  { scenario: 'Necesitas que el LLM te explique un concepto difícil de filosofía pero cada vez que lo preguntas te da una respuesta con palabras muy técnicas y difíciles de entender.', opciones: ['Zero-shot directo', 'Role System', 'Few-shot con ejemplos', 'Chain of Thought'], correct: 2, promptHint: 'Ejemplo: "Aquí hay 2 explicaciones del estilo que quiero: [ejemplo simple] [ejemplo simple]. Ahora explícame el libre albedrío de la misma manera."', explain: 'Few-shot: mostrarle ejemplos del estilo que quieres es más efectivo que describir el estilo. El modelo replica el patrón de tus ejemplos.' },
  { scenario: 'Quieres que el LLM resuelva un problema de lógica complejo: hay 5 personas con diferentes trabajos, casas de colores y mascotas. ¿Quién tiene el pez?', opciones: ['Zero-shot directo', 'Chain of Thought', 'Negative Prompting', 'Role System'], correct: 1, promptHint: 'Ejemplo: "Resuelve este acertijo pensando paso a paso. Primero lista las pistas, luego infiere cada elemento de forma lógica antes de dar la respuesta final."', explain: 'Chain of Thought: forzar el razonamiento explícito paso a paso reduce drásticamente los errores en problemas de lógica y deducción.' },
  { scenario: 'Tu asistente de estudio sigue respondiendo en un tono muy formal y aburrido aunque ya le pediste que sea más amigable dos veces.', opciones: ['Negative Prompting', 'Chain of Thought', 'Multi-step', 'Zero-shot directo'], correct: 0, promptHint: 'Ejemplo: "Responde como si fueras un compañero de clase, NO como un profesor. EVITA: palabras como \'asimismo\', \'cabe destacar\', \'en consecuencia\'. USA: contracciones, emojis ocasionales, referencias a la vida escolar."', explain: 'Negative Prompting: listar explícitamente qué NO hacer y qué palabras evitar es más efectivo que solo decir "sé más amigable".' },
  { scenario: 'Quieres escribir un artículo completo de 1500 palabras sobre inteligencia artificial. Cada vez que lo intentas en un solo prompt, el resultado es superficial y desorganizado.', opciones: ['Zero-shot directo', 'Few-shot', 'Multi-step', 'Role System'], correct: 2, promptHint: 'Ejemplo: Prompt 1: "Crea el esquema con 5 secciones y sus subtemas." → Prompt 2: "Escribe la sección 1 basándote en este esquema: [resultado anterior]." → Prompt 3: "Escribe la sección 2..." etc.', explain: 'Multi-step: tareas complejas se dividen en pasos secuenciales donde el output de cada prompt alimenta el siguiente. Resultado más coherente y profundo.' },
  { scenario: 'Necesitas que el LLM actúe como un evaluador crítico de startups para que revise tu idea de negocio con el mismo rigor que un inversionista real de Silicon Valley.', opciones: ['Zero-shot directo', 'Chain of Thought', 'Few-shot', 'Role System'], correct: 3, promptHint: 'Ejemplo: "Eres un socio de capital de riesgo con 20 años de experiencia evaluando startups en Silicon Valley. Eres brutalmente honesto, data-driven y no te dejas llevar por el entusiasmo. Evalúa esta idea: [idea]."', explain: 'Role System: asignar un rol específico y detallado calibra el tono, el nivel de expertise y el tipo de respuesta. Un rol bien descrito cambia completamente el carácter de la respuesta.' },
];

const QUIZ_POOL: QuizItem[] = [
  { q: '¿Cuál es la diferencia principal entre Zero-shot y Few-shot prompting?', opts: ['Zero-shot usa ejemplos; Few-shot no', 'Few-shot da ejemplos al modelo; Zero-shot pide la tarea directamente sin ejemplos', 'Zero-shot es más lento; Few-shot es más rápido', 'Few-shot solo funciona con imágenes'], correct: 1, explain: 'Zero-shot: haces la tarea directa. Few-shot: das 1-3 ejemplos del resultado que quieres antes de pedir la tarea. Los ejemplos guían el formato y el estilo de la respuesta.' },
  { q: 'Quieres que el LLM resuelva: "Si A implica B, y B implica C, ¿A implica C? Explica tu razonamiento." ¿Qué técnica usarías?', opts: ['Negative Prompting', 'Role System', 'Chain of Thought', 'Few-shot'], correct: 2, explain: 'Chain of Thought es ideal para problemas de lógica y deducción. Pedirle que razone paso a paso expone su proceso y reduce errores.' },
  { q: '¿En qué consiste el "negative prompting" aplicado a texto?', opts: ['Escribir el prompt en formato negativo gramatical', 'Decirle al modelo explícitamente qué NO debe hacer, incluir o usar en su respuesta', 'Pedirle al modelo que critique su propia respuesta', 'Usar prompts más cortos de lo normal'], correct: 1, explain: 'Negative prompting = restricciones explícitas de lo que NO quieres. "No uses bullets", "no menciones marcas", "no seas condescendiente". Muy efectivo cuando el modelo ignora instrucciones positivas.' },
  { q: 'Estás construyendo un asistente para tu abuela de 75 años. ¿Qué combinación de técnicas tiene más sentido?', opts: ['Chain of Thought + Multi-step', 'Role System + Few-shot para definir tono simple y ejemplificar respuestas cortas', 'Negative Prompting solo', 'Zero-shot directo siempre'], correct: 1, explain: 'Role System ("eres un asistente paciente para personas mayores") + Few-shot (ejemplos de respuestas simples) define tanto la personalidad como el estilo concreto que necesitas.' },
  { q: '¿Cuándo es más útil el Multi-step prompting?', opts: ['Cuando tienes prisa y quieres una respuesta rápida', 'Cuando la tarea es tan compleja que un solo prompt produce resultados superficiales o desorganizados', 'Cuando el modelo es muy lento', 'Cuando usas el plan gratuito del LLM'], correct: 1, explain: 'Multi-step divide tareas complejas en fases donde cada output alimenta el siguiente prompt. Ideal para: artículos largos, análisis profundos, código complejo, proyectos de investigación.' },
  { q: 'Un estudiante dice: "Le puse todo el contexto al prompt y sigue dando malas respuestas." ¿Qué le recomendarías revisar?', opts: ['Cambiar de LLM inmediatamente', 'Si el "contexto" es relevante o si hay instrucciones contradictorias o poco claras en el prompt', 'Pagar el plan premium', 'Repetir el mismo prompt varias veces'], correct: 1, explain: 'Más contexto no siempre es mejor contexto. Revisar si las instrucciones son contradictorias, si el contexto es realmente relevante y si el formato de salida está especificado.' },
  { q: '¿Qué hace el Role System prompting a nivel técnico en un LLM?', opts: ['Cambia el modelo de IA que se usa', 'Ajusta los parámetros estadísticos del modelo hacia respuestas más coherentes con ese rol', 'Bloquea ciertos tipos de respuestas del modelo', 'Acelera el tiempo de respuesta'], correct: 1, explain: 'El rol calibra la distribución de probabilidades del modelo hacia tokens más consistentes con ese perfil. Un "experto en derecho" usa vocabulario legal; un "niño de 7 años" usa vocabulario simple.' },
  { q: '¿Cuál es la principal ventaja de los ejemplos Few-shot sobre las instrucciones descriptivas?', opts: ['Son más cortos de escribir', 'Mostrar es más preciso que describir: el modelo replica el patrón exacto del ejemplo', 'Son más baratos en tokens', 'Solo funcionan con ChatGPT'], correct: 1, explain: 'Las instrucciones describen; los ejemplos demuestran. Describir "tono amigable y conciso" es subjetivo. Mostrar 2 ejemplos de respuestas amigables y concisas es concreto e inequívoco.' },
];

const FILL_POOL: FillItem[] = [
  { sentence: 'La técnica de darle al modelo 2 o 3 ejemplos del resultado que quieres antes de hacer la tarea se llama prompting de ___ ejemplos.', allOpts: ['pocos (few-shot)', 'muchos', 'cero', 'varios'], correct: 0, explain: '"Few-shot" (pocos ejemplos) es la técnica de mostrar 2-3 ejemplos para que el modelo replique el patrón. "Zero-shot" sería sin ningún ejemplo.' },
  { sentence: 'Pedir al modelo que piense y razone ___ antes de dar la respuesta final se llama cadena de pensamiento.', allOpts: ['paso a paso', 'rápido', 'en silencio', 'al revés'], correct: 0, explain: '"Chain of Thought" o cadena de pensamiento: pedirle explícitamente que razone paso a paso mejora la calidad en tareas de lógica y matemáticas.' },
  { sentence: 'Cuando le dices explícitamente al modelo lo que NO debe hacer o incluir en su respuesta, estás usando ___ negativo.', allOpts: ['prompting', 'código', 'feedback', 'sorting'], correct: 0, explain: '"Negative prompting" = restricciones explícitas. Tan importante como decir qué SÍ quieres es decir claramente qué NO quieres.' },
  { sentence: 'Asignarle al modelo una identidad específica como "eres un experto en nutrición" se llama prompting de ___.', allOpts: ['rol', 'texto', 'imagen', 'código'], correct: 0, explain: '"Role prompting" o prompting de rol. Calibra el tono, vocabulario y enfoque del modelo hacia ese perfil específico.' },
  { sentence: 'Usar la respuesta de un prompt como entrada del siguiente, encadenando varias conversaciones, se llama prompting de ___ pasos.', allOpts: ['múltiples', 'cero', 'pocos', 'solos'], correct: 0, explain: '"Multi-step prompting": divide tareas complejas en etapas secuenciales. El output de cada paso alimenta el siguiente prompt.' },
  { sentence: 'Un prompt que no incluye ejemplos y hace la tarea directamente se llama prompting de ___ ejemplos.', allOpts: ['cero (zero-shot)', 'pocos', 'muchos', 'todos los'], correct: 0, explain: '"Zero-shot": ningún ejemplo previo — la tarea directa. Funciona bien para tareas simples y claras donde no se necesita guía adicional de formato.' },
];

const SPRINT_POOL: SprintItem[] = [
  { stmt: 'El Chain of Thought es útil para problemas de lógica y matemáticas', correct: true },
  { stmt: 'Un prompt más largo siempre produce mejores respuestas', correct: false },
  { stmt: 'Few-shot prompting consiste en dar ejemplos antes de pedir la tarea', correct: true },
  { stmt: 'El negative prompting solo funciona con imágenes, no con texto', correct: false },
  { stmt: 'El Role System calibra el tono y el nivel de expertise del modelo', correct: true },
  { stmt: 'Si el modelo falla, casi siempre es culpa del modelo y no del prompt', correct: false },
  { stmt: 'El multi-step prompting divide tareas complejas en varios prompts encadenados', correct: true },
  { stmt: 'Dar ejemplos de lo que NO quieres puede ser tan útil como dar ejemplos de lo que sí quieres', correct: true },
  { stmt: 'Zero-shot significa darle cero instrucciones al modelo', correct: false },
  { stmt: 'Agregar contexto del usuario (edad, nivel, objetivo) generalmente mejora la respuesta', correct: true },
  { stmt: 'Instrucciones contradictorias en un prompt producen resultados predecibles', correct: false },
  { stmt: 'El few-shot prompting muestra es más preciso que describir el resultado esperado', correct: true },
];

// ===================== Estilos-token de cards / hl / tags =====================
const CARD_VARIANTS: Record<string, { bg: string; border: string }> = {
  sky: { bg: '#f0f9ff', border: '#bae6fd' },
  green: { bg: '#f0fdf4', border: '#bbf7d0' },
  amber: { bg: '#fffbeb', border: '#fde68a' },
  rose: { bg: '#fff1f2', border: '#fecdd3' },
  red: { bg: '#fff1f2', border: '#fecdd3' },
  pink: { bg: '#fdf2f8', border: '#fbcfe8' },
  purple: { bg: '#faf5ff', border: '#e9d5ff' },
  slate: { bg: '#f8fafc', border: '#e2e8f0' },
  orange: { bg: '#fff7ed', border: '#fed7aa' },
};
const HL_VARIANTS: Record<string, { border: string; bg: string; color: string }> = {
  rose: { border: '#e11d48', bg: '#fff1f2', color: '#9f1239' },
  green: { border: '#10b981', bg: '#f0fdf4', color: '#065f46' },
  amber: { border: '#f59e0b', bg: '#fffbeb', color: '#92400e' },
  purple: { border: '#7c3aed', bg: '#f5f3ff', color: '#5b21b6' },
  blue: { border: '#0ea5e9', bg: '#f0f9ff', color: '#0369a1' },
  red: { border: '#ef4444', bg: '#fff1f2', color: '#991b1b' },
};
const TAG_VARIANTS: Record<string, { bg: string; color: string; border?: string }> = {
  theory: { bg: '#ffe4e6', color: '#9f1239' },
  example: { bg: '#fff7ed', color: '#9a3412' },
  activity: { bg: '#eff6ff', color: '#1e40af' },
  quiz: { bg: '#fef3c7', color: '#92400e' },
  reflect: { bg: '#f1f5f9', color: '#475569' },
  vf: { bg: '#fef9ee', color: '#92400e' },
  match: { bg: '#eef2ff', color: '#3730a3' },
  sort: { bg: '#f5f3ff', color: '#5b21b6' },
  case: { bg: '#fdf4ff', color: '#7e22ce' },
  fill: { bg: '#ecfdf5', color: '#065f46' },
  sprint: { bg: '#fef3c7', color: '#92400e' },
  new: { bg: '#fbe1e6', color: '#9f1239', border: '#fecdd3' },
  compare: { bg: '#fff1f2', color: '#e11d48' },
};

// ---------- Componentes reutilizables ----------
const B = ({ children }: { children: React.ReactNode }) => <Text style={styles.bold}>{children}</Text>;

function Tag({ variant, children }: { variant: string; children: React.ReactNode }) {
  const v = TAG_VARIANTS[variant];
  return (
    <View style={[styles.tag, { backgroundColor: v.bg }, v.border ? { borderWidth: 1, borderColor: v.border } : null]}>
      <Text style={[styles.tagText, { color: v.color }]}>{children}</Text>
    </View>
  );
}
function Hl({ variant, children }: { variant: string; children: React.ReactNode }) {
  const v = HL_VARIANTS[variant];
  return (
    <View style={[styles.hlBox, { borderLeftColor: v.border, backgroundColor: v.bg }]}>
      <Text style={[styles.hlText, { color: v.color }]}>{children}</Text>
    </View>
  );
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}
function InfoCard({ variant, iconBg, icon, title, children }: { variant: string; iconBg?: string; icon?: string; title?: string; children?: React.ReactNode }) {
  const v = CARD_VARIANTS[variant];
  return (
    <View style={[styles.card, { backgroundColor: v.bg, borderColor: v.border }]}>
      <View style={styles.cardRow}>
        {icon !== undefined && <View style={[styles.cardIcon, { backgroundColor: iconBg || '#e2e8f0' }]}><Text style={{ fontSize: 19 }}>{icon}</Text></View>}
        <View style={{ flex: 1 }}>
          {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
          {children ? <Text style={styles.cardText}>{children}</Text> : null}
        </View>
      </View>
    </View>
  );
}
function FeedbackBar({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <View style={[styles.feedbackBar, ok ? styles.fbOk : styles.fbWrong]}>
      <Text style={[styles.feedbackText, { color: ok ? '#166534' : '#991b1b' }]}>{children}</Text>
    </View>
  );
}

// ===================== COMPONENTE =====================
export default function World2Level1() {
  const navigation = useNavigation();
  const completeLevel = useGameStore((state) => state.completeLevel);
  const devMode = useGameStore((state) => state.devMode);

  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);
  const [xpToast, setXpToast] = useState<{ amount: number; id: number } | null>(null);

  const [compareItems] = useState(() => pickN(COMPARE_POOL, 3));
  const [matchPairs] = useState(() => pickN(MATCH_POOL, 4));
  const [tfItems] = useState(() => pickN(TF_POOL, 5));
  const [quizItems] = useState(() => pickN(QUIZ_POOL, 5));
  const [fillItems] = useState(() => pickN(FILL_POOL, 3));
  const [sprintItems] = useState(() => pickN(SPRINT_POOL, SPRINT_POOL.length));
  const [rankerSet] = useState(() => pickN(RANKER_SETS, 1)[0]);
  const [tecnicaItems] = useState(() => pickN(TECNICA_POOL, 4));

  // Módulo 2 — ejemplos expandibles
  const [expandedEx, setExpandedEx] = useState<number | null>(null);

  // Módulo 3 — compare
  const [compareIdx, setCompareIdx] = useState(0);

  // Módulo 5 — matching
  const [matchLeft, setMatchLeft] = useState<number | null>(null);
  const [matchedL, setMatchedL] = useState<Set<number>>(new Set());
  const [matchedR, setMatchedR] = useState<Set<number>>(new Set());
  const [wrongFlash, setWrongFlash] = useState<{ l: number; r: number } | null>(null);
  const [rightOrder, setRightOrder] = useState<string[]>([]);
  const [matchFb, setMatchFb] = useState<{ ok: boolean; msg: string } | null>(null);

  // Módulo 7 — sort
  const [sortOrder, setSortOrder] = useState<number[]>([]);
  const [sortOk, setSortOk] = useState(false);
  const [sortMarks, setSortMarks] = useState<Record<number, 'ok' | 'bad'>>({});
  const [sortFb, setSortFb] = useState<{ ok: boolean; msg: string } | null>(null);

  // Módulo 8 — V/F
  const [tfAnswers, setTfAnswers] = useState<Record<number, boolean>>({});
  const [tfChecked, setTfChecked] = useState(false);

  // Módulo 10 — ranker
  const [rankerOrder, setRankerOrder] = useState<number[]>([0, 1, 2].sort(() => Math.random() - 0.5));
  const [rankerChecked, setRankerChecked] = useState(false);
  const [rankerSwapA, setRankerSwapA] = useState<number | null>(null);
  const [rankerFb, setRankerFb] = useState<{ ok: boolean; msg: string } | null>(null);

  // Módulo 12 — técnica picker
  const [tecnicaQ, setTecnicaQ] = useState(0);
  const [tecnicaAnswered, setTecnicaAnswered] = useState(false);
  const [tecnicaSel, setTecnicaSel] = useState<number | null>(null);
  const [tecnicaDone, setTecnicaDone] = useState(false);
  const [tecnicaCorrect, setTecnicaCorrect] = useState(0);
  const [tecnicaPromptVal, setTecnicaPromptVal] = useState('');

  // Módulo 14 — quiz
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizChecked, setQuizChecked] = useState(false);

  // Módulo 16 — fill
  const [fillSel, setFillSel] = useState<Record<number, number>>({});
  const [fillChecked, setFillChecked] = useState<Record<number, boolean>>({});

  // Módulo 18 — sprint
  const [sprintSec, setSprintSec] = useState(60);
  const [sprintQ, setSprintQ] = useState(0);
  const [sprintCorrect, setSprintCorrect] = useState(0);
  const [sprintDone, setSprintDone] = useState(false);
  const [sprintStarted, setSprintStarted] = useState(false);
  const [sprintPick, setSprintPick] = useState<boolean | null>(null);
  const sprintTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const sprintCorrectRef = useRef(0);

  // Módulo 20 — reflexión
  const [reflectVal, setReflectVal] = useState('');

  const examSteps = new Set([5, 7, 8, 10, 12, 14, 16, 18, 20]);
  const isExamMode = examSteps.has(step);
  const theorySteps = new Set([1, 2, 4, 6, 9, 11, 13, 15]);

  useEffect(() => {
    const onBackPress = () => {
      if (isExamMode) {
        if (Platform.OS !== 'web') Alert.alert('Módulo en curso', 'Completa la actividad antes de salir.', [{ text: 'OK' }]);
        return true;
      }
      return false;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [isExamMode]);

  // Reset por módulo al entrar
  useEffect(() => {
    if (step === 3) setCompareIdx(0);
    if (step === 5) { setMatchLeft(null); setMatchedL(new Set()); setMatchedR(new Set()); setMatchFb(null); setWrongFlash(null); setRightOrder(matchPairs.map((p) => p.right).sort(() => Math.random() - 0.5)); }
    if (step === 7) { setSortOrder([0, 1, 2, 3, 4].sort(() => Math.random() - 0.5)); setSortOk(false); setSortMarks({}); setSortFb(null); }
    if (step === 8) { setTfAnswers({}); setTfChecked(false); }
    if (step === 10) { setRankerOrder([0, 1, 2].sort(() => Math.random() - 0.5)); setRankerChecked(false); setRankerSwapA(null); setRankerFb(null); }
    if (step === 12) { setTecnicaQ(0); setTecnicaAnswered(false); setTecnicaSel(null); setTecnicaDone(false); setTecnicaCorrect(0); setTecnicaPromptVal(''); }
    if (step === 14) { setQuizAnswers({}); setQuizChecked(false); }
    if (step === 16) { setFillSel({}); setFillChecked({}); }
    if (step === 18) { setSprintSec(60); setSprintQ(0); setSprintCorrect(0); sprintCorrectRef.current = 0; setSprintDone(false); setSprintStarted(false); setSprintPick(null); if (sprintTimer.current) clearInterval(sprintTimer.current); }
  }, [step]);

  useEffect(() => () => { if (sprintTimer.current) clearInterval(sprintTimer.current); }, []);

  const addXP = (n: number) => { setXp((p) => p + n); if (n > 0) setXpToast((prev) => ({ amount: n, id: (prev?.id ?? 0) + 1 })); };
  const next = () => { if (step < TOTAL_STEPS - 1) setStep(step + 1); };
  const prev = () => setStep((s) => s - 1);

  const handleClose = () => {
    const msg = isExamMode ? 'Estás en una actividad. Si sales perderás el progreso. ¿Seguro?' : '¿Seguro que quieres salir?';
    if (Platform.OS === 'web') { if (window.confirm(msg)) navigation.goBack(); return; }
    Alert.alert('Salir', msg, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Salir', style: 'destructive', onPress: () => navigation.goBack() }]);
  };

  const handleFinish = () => {
    let stars = 0;
    if (xp >= 200) stars = 3;
    else if (xp >= 130) stars = 2;
    else if (xp >= 60) stars = 1;
    completeLevel(7, stars, xp);
    navigation.goBack();
  };

  // ============ MECÁNICAS ============
  // M5 Matching
  const handleMatchLeft = (i: number) => { if (matchedL.has(i)) return; setMatchLeft(i); };
  const handleMatchRight = (i: number) => {
    if (matchLeft === null || matchedR.has(i)) return;
    const correctRight = matchPairs[matchLeft].right;
    if (rightOrder[i] === correctRight) {
      const nl = new Set(matchedL); nl.add(matchLeft);
      const nr = new Set(matchedR); nr.add(i);
      setMatchedL(nl); setMatchedR(nr);
      setMatchFb({ ok: true, msg: `✅ Correcto: ${matchPairs[matchLeft].left} ↔ ${correctRight}` });
      if (nl.size >= matchPairs.length) addXP(20);
      setMatchLeft(null);
    } else {
      setWrongFlash({ l: matchLeft, r: i });
      setMatchFb({ ok: false, msg: '❌ Esa combinación no es correcta. Sigue intentando.' });
      setTimeout(() => setWrongFlash(null), 600);
      setMatchLeft(null);
    }
  };

  // M7 Sort
  const moveSort = (pos: number, dir: number) => {
    if (sortOk) return;
    const np = pos + dir;
    if (np < 0 || np >= sortOrder.length) return;
    const n = [...sortOrder];
    [n[pos], n[np]] = [n[np], n[pos]];
    setSortOrder(n);
    setSortMarks({});
    setSortFb(null);
  };
  const checkSort = () => {
    if (sortOk) return true;
    const marks: Record<number, 'ok' | 'bad'> = {};
    sortOrder.forEach((v, i) => { marks[i] = v === i ? 'ok' : 'bad'; });
    setSortMarks(marks);
    const ok = sortOrder.every((v, i) => v === i);
    if (ok) { setSortOk(true); addXP(15); setSortFb({ ok: true, msg: '¡Exacto! Así fluye el Chain of Thought. +15 XP 🎉' }); }
    else setSortFb({ ok: false, msg: 'No está en el orden correcto todavía. Piensa: ¿qué paso hace posible el siguiente?' });
    return false;
  };

  // M8 V/F
  const selectTF = (qi: number, val: boolean) => { if (!tfChecked) setTfAnswers((p) => ({ ...p, [qi]: val })); };
  const checkTF = () => {
    if (tfChecked) return true;
    if (!devMode && Object.keys(tfAnswers).length < tfItems.length) return false;
    setTfChecked(true);
    let correct = 0;
    tfItems.forEach((item, qi) => { if (tfAnswers[qi] === item.correct) correct++; });
    addXP(correct * 5);
    return false;
  };

  // M10 Ranker
  const handleRankerTap = (pos: number) => {
    if (rankerChecked) return;
    if (rankerSwapA === null) { setRankerSwapA(pos); return; }
    if (rankerSwapA !== pos) {
      const n = [...rankerOrder];
      [n[rankerSwapA], n[pos]] = [n[pos], n[rankerSwapA]];
      setRankerOrder(n);
    }
    setRankerSwapA(null);
  };
  const checkRanker = () => {
    if (rankerChecked) return true;
    setRankerChecked(true);
    const correct = rankerOrder.every((pi, pos) => rankerSet.prompts[pi].level === pos);
    if (correct) { addXP(20); setRankerFb({ ok: true, msg: '🏆 ¡Orden perfecto! Del peor al mejor. +20 XP' }); }
    else {
      addXP(8);
      const co = [...rankerSet.prompts].sort((a, b) => a.level - b.level);
      setRankerFb({ ok: false, msg: `❌ No del todo. El orden correcto: 1º "${co[0].text.substring(0, 30)}..." 2º "${co[1].text.substring(0, 30)}..." 3º el más completo. ${rankerSet.explain}` });
    }
    return false;
  };

  // M12 Técnica Picker
  const selectTecnica = (i: number) => {
    if (tecnicaAnswered) return;
    setTecnicaAnswered(true);
    setTecnicaSel(i);
    if (i === tecnicaItems[tecnicaQ].correct) setTecnicaCorrect((p) => p + 1);
  };
  const advanceTecnica = () => {
    if (tecnicaQ + 1 >= tecnicaItems.length) {
      const earned = tecnicaCorrect >= 3 ? 25 : tecnicaCorrect >= 2 ? 15 : 8;
      addXP(earned);
      setTecnicaDone(true);
    } else {
      setTecnicaQ((p) => p + 1);
      setTecnicaAnswered(false);
      setTecnicaSel(null);
      setTecnicaPromptVal('');
    }
  };

  // M14 Quiz
  const selectQuiz = (qi: number, oi: number) => { if (!quizChecked) setQuizAnswers((p) => ({ ...p, [qi]: oi })); };
  const checkQuiz = () => {
    if (quizChecked) return true;
    if (!devMode && Object.keys(quizAnswers).length < quizItems.length) return false;
    setQuizChecked(true);
    let correct = 0;
    quizItems.forEach((q, qi) => { if (quizAnswers[qi] === q.correct) correct++; });
    addXP(correct * 8);
    return false;
  };

  // M16 Fill
  const selectFill = (qi: number, oi: number) => {
    if (fillChecked[qi]) return;
    setFillSel((p) => ({ ...p, [qi]: oi }));
    setFillChecked((p) => ({ ...p, [qi]: true }));
    if (oi === fillItems[qi].correct) addXP(6);
  };

  // M18 Sprint
  const startSprint = () => {
    setSprintStarted(true); setSprintSec(60); setSprintQ(0); setSprintCorrect(0); sprintCorrectRef.current = 0; setSprintDone(false); setSprintPick(null);
    sprintTimer.current = setInterval(() => {
      setSprintSec((prev) => { if (prev <= 1) { finishSprint(); return 0; } return prev - 1; });
    }, 1000);
  };
  const answerSprint = (val: boolean) => {
    if (sprintDone || sprintPick !== null || sprintQ >= sprintItems.length) return;
    setSprintPick(val);
    const item = sprintItems[sprintQ];
    if (val === item.correct) { sprintCorrectRef.current += 1; setSprintCorrect(sprintCorrectRef.current); }
    setTimeout(() => {
      if (sprintQ + 1 >= sprintItems.length) finishSprint();
      else { setSprintQ((p) => p + 1); setSprintPick(null); }
    }, 600);
  };
  const finishSprint = () => {
    if (sprintDone) return;
    setSprintDone(true);
    if (sprintTimer.current) clearInterval(sprintTimer.current);
    const c = sprintCorrectRef.current;
    const earned = c >= 10 ? 25 : c >= 7 ? 18 : c >= 4 ? 12 : 5;
    addXP(earned);
  };

  // M20 Reflexión
  const checkReflect = () => { if (reflectVal.trim().length >= 80) { addXP(15); return true; } return false; };

  // ============ RENDERS ============
  const renderStepContent = () => {
    switch (step) {
      // ---- 0 INTRO ----
      case 0:
        return (
          <View>
            <View style={[styles.lessonIcon, { backgroundColor: '#fecdd3' }]}><Text style={{ fontSize: 34 }}>✍️</Text></View>
            <Text style={styles.title}>¡Aprende a hablarle a la IA como un experto!</Text>
            <Text style={styles.subtitle}>Ya sabes los ingredientes básicos de un prompt. Ahora vas a aprender los trucos secretos que usan los profesionales para conseguir respuestas increíbles. 🚀</Text>
            <InfoCard variant="rose" icon="🧠" iconBg="#fecdd3" title="Vas a aprender 5 trucos pro">Pensar en voz alta · Dar ejemplos · Decir qué NO hacer · Darle una identidad · Dividir tareas grandes en partes. ¡Cada truco es una superpoder!</InfoCard>
            <InfoCard variant="pink" icon="🆕" iconBg="#fbcfe8" title="Dos mecánicas nuevas">Prompt Ranker — ¿cuál prompt es mejor? — y Técnica Picker — elige el truco correcto para cada situación.</InfoCard>
            <InfoCard variant="slate" icon="⭐" iconBg="#e2e8f0" title="Hasta 270 XP · 20 módulos · N7 de 36" />
          </View>
        );

      // ---- 1 TEORÍA ----
      case 1:
        return (
          <View>
            <Tag variant="theory">📖 Módulo 1 de 20</Tag>
            <Text style={styles.title}>¿Por qué hay prompts que funcionan mucho mejor?</Text>
            <Text style={styles.bodyText}>Imagina que le pides a tu amigo que te ayude con una tarea. Si le dices "ayúdame", probablemente no sabe por dónde empezar. Pero si le dices exactamente qué necesitas, cómo quieres que te explique y qué NO quieres que haga... ¡la ayuda es perfecta!</Text>
            <Text style={styles.bodyText}>Con la IA pasa exactamente lo mismo. En el Nivel 3 aprendiste los 4 ingredientes básicos. Ahora vienen los <B>5 trucos avanzados</B> que hacen que tus prompts sean increíbles:</Text>
            {[
              { n: 1, t: '🔗 Pensar en voz alta (Chain of Thought):', d: ' Le pides que explique su proceso paso a paso, como cuando haces matemáticas mostrando el procedimiento.' },
              { n: 2, t: '📸 Dar ejemplos (Few-shot):', d: ' Muestras cómo quieres la respuesta con ejemplos. ¡Mostrar es más fácil que explicar!' },
              { n: 3, t: '🚫 Decir qué NO (Negative Prompting):', d: ' Le dices lo que NO quieres que haga. Así evitas respuestas que no te sirven.' },
              { n: 4, t: '🎭 Darle una identidad (Role System):', d: ' Le dices quién debe ser. ¡La IA cambia completamente según el personaje que le asignas!' },
              { n: 5, t: '⛓️ Dividir en partes (Multi-step):', d: ' Las tareas muy grandes salen mejor cuando las divides en pasos pequeños.' },
            ].map((it) => (
              <View key={it.n} style={styles.stepRow}>
                <View style={styles.stepNum}><Text style={styles.stepNumText}>{it.n}</Text></View>
                <Text style={styles.stepListText}><B>{it.t}</B>{it.d}</Text>
              </View>
            ))}
            <Hl variant="red"><B>💡 El secreto:</B>{'\n'}No tienes que memorizar los nombres en inglés. Lo importante es saber cuándo usar cada truco. ¡Eso es lo que aprenderás hoy!</Hl>
          </View>
        );

      // ---- 2 EJEMPLOS ----
      case 2:
        return (
          <View>
            <Tag variant="example">🔬 Módulo 2 de 20 · Los 5 trucos</Tag>
            <Text style={styles.title}>Los 5 trucos en acción</Text>
            <Text style={styles.subtitle}>Toca cada truco para ver un ejemplo real. ¡Son más fáciles de lo que parecen!</Text>
            {[
              { emoji: '🔗', name: 'Truco 1: Pensar en voz alta', sub: 'Para problemas de lógica y matemáticas', tag: 'CHAIN OF THOUGHT',
                body: <Text style={styles.exHow}><B>Sin el truco:</B> "¿Cuántos segundos hay en 2 horas?"{'\n'}La IA puede equivocarse sin mostrar cómo pensó.{'\n\n'}<B>Con el truco:</B> "¿Cuántos segundos hay en 2 horas? <B>Piensa paso a paso</B>: primero convierte horas a minutos, luego minutos a segundos."{'\n'}¡Ahora puedes ver si se equivocó en algún paso!</Text>,
                fact: '⚡ Es como en el colegio cuando el profe pide "muestra el procedimiento". Si te equivocas, sabes exactamente dónde.' },
              { emoji: '📸', name: 'Truco 2: Dar ejemplos', sub: 'Para conseguir el formato exacto que quieres', tag: 'FEW-SHOT',
                body: <Text style={styles.exHow}><B>Sin el truco:</B> "Escríbeme una frase motivadora sobre estudiar."{'\n'}Resultado: puede salir muy formal o muy rara.{'\n\n'}<B>Con el truco:</B> "Mira estos ejemplos que me gustan:{'\n'}Ej1: 'Cada vez que estudias, tu cerebro se vuelve más fuerte.'{'\n'}Ej2: 'No estudias para el profe — estudias para tu yo del futuro.'{'\n'}Escríbeme 2 frases con ese mismo estilo."{'\n'}¡Ahora sí sabe exactamente qué quieres!</Text>,
                fact: '⚡ ¿Recuerdas cuando aprendiste a dibujar copiando? Así funciona este truco — le muestras el modelo y la IA lo replica.' },
              { emoji: '🚫', name: 'Truco 3: Decir qué NO quieres', sub: 'Para evitar respuestas aburridas o incorrectas', tag: 'NEGATIVE PROMPTING',
                body: <Text style={styles.exHow}><B>Sin el truco:</B> "Explícame la lluvia de forma divertida."{'\n'}Resultado: usa palabras difíciles como "precipitación" o "evaporación".{'\n\n'}<B>Con el truco:</B> "Explícame cómo se forma la lluvia de forma divertida para un niño de 10 años. <B>NO uses</B> palabras difíciles como 'precipitación'. <B>NO hagas</B> una lista con puntos — cuéntalo como una historia."{'\n'}¡Mucho mejor resultado!</Text>,
                fact: '⚡ Es como cuando le dices a alguien "quiero pizza, pero SIN aceitunas y SIN picante". ¡Las restricciones ayudan!' },
              { emoji: '🎭', name: 'Truco 4: Darle una identidad', sub: 'Para que responda desde un personaje específico', tag: 'ROLE SYSTEM',
                body: <Text style={styles.exHow}><B>Sin el truco:</B> "Ayúdame a entender la historia de Colombia."{'\n'}Resultado: respuesta aburrida como de enciclopedia.{'\n\n'}<B>Con el truco:</B> "Eres un narrador de historias emocionantes para jóvenes de 11 años. Cuentas la historia de Colombia como si fuera una aventura llena de personajes increíbles. Eres entusiasta y usas comparaciones con videojuegos y películas de superhéroes cuando puedes."{'\n'}¡La IA cambia completamente!</Text>,
                fact: '⚡ Es como en un juego de rol: le asignas un personaje y la IA actúa como ese personaje. Cuanto más detallado sea el personaje, mejor funciona.' },
              { emoji: '⛓️', name: 'Truco 5: Dividir en partes', sub: 'Para tareas muy grandes', tag: 'MULTI-STEP',
                body: <Text style={styles.exHow}><B>Sin el truco:</B> "Escríbeme una historia completa de 5 páginas sobre un robot que salva el mundo."{'\n'}Resultado: historia superficial y sin coherencia.{'\n\n'}<B>Con el truco:</B>{'\n'}Prompt 1: "Invéntame los personajes de una historia sobre un robot que salva el mundo."{'\n'}Prompt 2: "Con esos personajes, crea el plan de la historia en 5 capítulos."{'\n'}Prompt 3: "Escribe el capítulo 1 con ese plan."{'\n'}¡Cada parte sale mucho mejor!</Text>,
                fact: '⚡ Es como hacer un trabajo escolar: primero el esquema, luego el borrador, luego corriges. No intentas hacer todo de una vez.' },
            ].map((c, i) => {
              const open = expandedEx === i;
              return (
                <TouchableOpacity key={i} activeOpacity={0.9} style={[styles.exCard, open && styles.exCardOpen]} onPress={() => setExpandedEx(open ? null : i)}>
                  <View style={styles.exHead}>
                    <View style={styles.exEmoji}><Text style={{ fontSize: 22 }}>{c.emoji}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.exName}>{c.name}</Text>
                      <Text style={styles.exSub}>{c.sub}</Text>
                    </View>
                    <MaterialIcons name={open ? 'keyboard-arrow-down' : 'chevron-right'} size={20} color="#94a3b8" />
                  </View>
                  {open && (
                    <View style={styles.exBody}>
                      <View style={styles.exTag}><Text style={styles.exTagText}>{c.tag}</Text></View>
                      {c.body}
                      <View style={styles.exFact}><Text style={styles.exFactText}>{c.fact}</Text></View>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
            <Hl variant="red"><B>🎯 Puedes combinarlos:</B>{'\n'}Los mejores prompts usan 2 o 3 trucos juntos. Por ejemplo: darle una identidad + pedir que piense paso a paso + decirle qué no hacer. ¡Lo aprenderás más adelante!</Hl>
          </View>
        );

      // ---- 3 COMPARE ----
      case 3: {
        const item = compareItems[compareIdx];
        return (
          <View>
            <Tag variant="compare">🔍 Módulo 3 de 20 · Compara</Tag>
            <Text style={styles.title}>Básico vs. Profesional</Text>
            <Text style={[styles.subtitle, { marginBottom: 9 }]}>El mismo objetivo, dos prompts muy diferentes. Analiza las diferencias.</Text>
            <Text style={styles.centerNote}>Comparación {compareIdx + 1} de {compareItems.length} · Tarea: {item.task}</Text>
            <View style={styles.compareWrap}>
              <View style={[styles.compareCol, { backgroundColor: '#fff1f2', borderColor: '#fecdd3' }]}>
                <Text style={[styles.compareLabel, { color: '#e11d48' }]}>❌ PROMPT BÁSICO</Text>
                <View style={styles.comparePrompt}><Text style={styles.compareMono}>{item.bad}</Text></View>
                <Text style={styles.compareWhy}>{item.badWhy}</Text>
              </View>
              <View style={[styles.compareCol, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                <Text style={[styles.compareLabel, { color: '#166534' }]}>✅ PROMPT PROFESIONAL</Text>
                <View style={styles.comparePrompt}><Text style={styles.compareMono}>{item.good}</Text></View>
                <Text style={styles.compareWhy}>{item.goodWhy}</Text>
              </View>
            </View>
            <InfoCard variant="rose">💡 Observa: el prompt profesional tiene <B>rol, contexto, tarea específica, formato y restricciones</B>. No es más largo por el largo — es más largo porque tiene más información útil.</InfoCard>
          </View>
        );
      }

      // ---- 4 TEORÍA ¿cuándo usar cuál? ----
      case 4:
        return (
          <View>
            <Tag variant="theory">📖 Módulo 4 de 20 · ¿Cuándo usar cuál?</Tag>
            <Text style={styles.title}>¿Cuándo uso cada truco?</Text>
            <Text style={styles.bodyText}>Conocer los trucos no es suficiente. Lo importante es saber <B>cuándo usar cada uno</B>. Es como tener una caja de herramientas: tienes que elegir la herramienta correcta para cada trabajo.</Text>
            <InfoCard variant="rose" icon="🔗" iconBg="#fecdd3" title="Pensar en voz alta → cuando necesitas que razone bien">Problemas de matemáticas, lógica, decisiones difíciles. Úsalo cuando quieres que explique CÓMO llegó a la respuesta, no solo cuál es.</InfoCard>
            <InfoCard variant="pink" icon="📸" iconBg="#fbcfe8" title="Dar ejemplos → cuando quieres un formato exacto">La IA sigue dando respuestas en un estilo que no quieres aunque se lo expliques. Mostrar es más fácil que describir con palabras.</InfoCard>
            <InfoCard variant="red" icon="🚫" iconBg="#fecdd3" title="Decir qué NO → cuando la IA repite cosas que no te sirven">Usa palabras difíciles siempre, hace listas cuando no las quieres, incluye información que no necesitas. ¡Díselo explícitamente!</InfoCard>
            <InfoCard variant="purple" icon="🎭" iconBg="#e9d5ff" title="Darle identidad → cuando necesitas un experto o un estilo especial">Quieres que hable como un científico, como un amigo, como un maestro divertido, o como un personaje específico.</InfoCard>
            <InfoCard variant="amber" icon="⛓️" iconBg="#fde68a" title="Dividir en partes → cuando la tarea es muy grande">Historias largas, proyectos complejos, trabajos con muchas secciones. Si el resultado sale superficial, ¡divídelo!</InfoCard>
            <Hl variant="red"><B>🔑 La señal de que debes cambiar de truco:</B>{'\n'}Si intentas lo mismo 3 veces y la IA sigue dando respuestas que no te sirven, es momento de cambiar de estrategia. Prueba un truco diferente — no solo cambies las palabras.</Hl>
          </View>
        );

      // ---- 5 MATCHING ----
      case 5:
        return (
          <View>
            <Tag variant="match">🔗 Módulo 5 de 20 · Conectar</Tag>
            <Text style={styles.title}>¿Cuándo usar cada truco?</Text>
            <Text style={[styles.subtitle, { marginBottom: 9 }]}>Conecta cada truco con la situación donde funciona mejor.</Text>
            <InfoCard variant="rose">① Toca la tarjeta izquierda (truco) → ② Toca la derecha (cuándo usarlo) → Si conectas bien, ambas se vuelven ✅</InfoCard>
            <View style={{ flexDirection: 'row', gap: 5, marginBottom: 4 }}>
              <Text style={styles.matchColLabel}>El truco</Text>
              <Text style={styles.matchColLabel}>Cuándo usarlo</Text>
            </View>
            {matchPairs.map((p, i) => {
              const lMatched = matchedL.has(i), rMatched = matchedR.has(i);
              const lSel = matchLeft === i;
              const lFlash = wrongFlash?.l === i, rFlash = wrongFlash?.r === i;
              return (
                <View key={i} style={{ flexDirection: 'row', gap: 5, marginBottom: 5 }}>
                  <TouchableOpacity style={[styles.matchItem, lMatched && styles.matchOk, lSel && styles.matchSel, lFlash && styles.matchWrong]} onPress={() => handleMatchLeft(i)} disabled={lMatched}>
                    <Text style={[styles.matchText, lMatched && { color: '#166534' }]}>{p.left}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.matchItem, styles.matchItemRight, rMatched && styles.matchOk, rFlash && styles.matchWrong]} onPress={() => handleMatchRight(i)} disabled={rMatched}>
                    <Text style={[styles.matchTextSm, rMatched && { color: '#166534' }]}>{rightOrder[i]}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
            {matchFb && <FeedbackBar ok={matchFb.ok}>{matchFb.msg}</FeedbackBar>}
          </View>
        );

      // ---- 6 TEORÍA pensar en voz alta ----
      case 6:
        return (
          <View>
            <Tag variant="theory">📖 Módulo 6 de 20 · Pensar en voz alta</Tag>
            <Text style={styles.title}>Truco 1: Hacerla pensar en voz alta</Text>
            <Text style={styles.bodyText}>¿Alguna vez le pediste a alguien que explique cómo resolvió un problema de matemáticas? Cuando explican el proceso, es más fácil detectar si se equivocaron. ¡Con la IA funciona igual!</Text>
            <InfoCard variant="rose" icon="❓" iconBg="#fecdd3" title="¿Por qué funciona este truco?">Cuando la IA escribe sus pasos de razonamiento, ¡eso le ayuda a pensar mejor! Es como cuando tú escribes el procedimiento en un examen — te ayuda a organizarte y a no cometer errores.</InfoCard>
            <SectionTitle>Tres formas de activar este truco</SectionTitle>
            <InfoCard variant="amber" icon="1️⃣" iconBg="#fde68a" title="La forma simple">Agrega al final: <B>"Piensa paso a paso antes de responder."</B> ¡Así de fácil! Esta frase sola mejora mucho las respuestas en problemas difíciles.</InfoCard>
            <InfoCard variant="green" icon="2️⃣" iconBg="#bbf7d0" title="La forma guiada">Tú le dices los pasos: <B>"Primero identifica el problema. Luego encuentra los datos. Finalmente calcula la respuesta."</B> Le indicas exactamente cómo pensar.</InfoCard>
            <InfoCard variant="sky" icon="3️⃣" iconBg="#bae6fd" title="La forma con revisión">Agrega: <B>"Antes de darme la respuesta final, verifica que sea correcta."</B> ¡Le pides que revise su propio trabajo!</InfoCard>
            <Hl variant="red"><B>⚠️ Ojo: no siempre funciona</B>{'\n'}Si la pregunta es muy fácil, este truco puede hacer que la IA se complique innecesariamente. Úsalo para problemas que de verdad requieren pensar, no para preguntas simples como "¿cuál es la capital de Colombia?"</Hl>
          </View>
        );

      // ---- 7 SORT ----
      case 7:
        return (
          <View>
            <Tag variant="sort">↕️ Módulo 7 de 20 · Ordenar</Tag>
            <Text style={styles.title}>¿Cómo piensa la IA paso a paso?</Text>
            <Text style={[styles.subtitle, { marginBottom: 9 }]}>Cuando usas el truco de "pensar en voz alta", la IA sigue estos pasos. Están mezclados — ¡ordénalos con ▲▼!</Text>
            <InfoCard variant="rose">💡 Piensa: ¿qué necesita hacer la IA primero para poder calcular? ¿Y qué hace al final para confirmar?</InfoCard>
            {sortOrder.map((idx, pos) => {
              const mark = sortMarks[pos];
              return (
                <View key={pos} style={[styles.sortItem, mark === 'ok' && styles.sortOk, mark === 'bad' && styles.sortBad]}>
                  <View style={styles.sortNum}><Text style={styles.sortNumText}>{pos + 1}</Text></View>
                  <Text style={styles.sortText}><B>{SORT_COT[idx].b}</B>{SORT_COT[idx].t}</Text>
                  <View style={styles.sortArrows}>
                    <TouchableOpacity style={[styles.sortBtn, pos === 0 && styles.sortBtnDisabled]} onPress={() => moveSort(pos, -1)} disabled={pos === 0}><MaterialIcons name="keyboard-arrow-up" size={18} color="#64748b" /></TouchableOpacity>
                    <TouchableOpacity style={[styles.sortBtn, pos === sortOrder.length - 1 && styles.sortBtnDisabled]} onPress={() => moveSort(pos, 1)} disabled={pos === sortOrder.length - 1}><MaterialIcons name="keyboard-arrow-down" size={18} color="#64748b" /></TouchableOpacity>
                  </View>
                </View>
              );
            })}
            {sortFb && <FeedbackBar ok={sortFb.ok}>{sortFb.msg}</FeedbackBar>}
          </View>
        );

      // ---- 8 V/F ----
      case 8:
        return (
          <View>
            <Tag variant="vf">✅ Módulo 8 de 20 · ¿Verdad o mentira?</Tag>
            <Text style={styles.title}>¿Cuáles de estas ideas son verdad?</Text>
            <Text style={[styles.subtitle, { marginBottom: 12 }]}>Hay muchas ideas incorrectas sobre los prompts avanzados. ¿Cuáles son reales?</Text>
            {tfItems.map((item, qi) => {
              const sel = tfAnswers[qi];
              const tCorrect = tfChecked && item.correct === true;
              const fCorrect = tfChecked && item.correct === false;
              const tWrong = tfChecked && sel === true && item.correct !== true;
              const fWrong = tfChecked && sel === false && item.correct !== false;
              const isOk = sel === item.correct;
              return (
                <View key={qi} style={{ marginBottom: 14 }}>
                  <Text style={styles.tfQuestion}>{qi + 1}. {item.stmt}</Text>
                  <View style={styles.tfOpts}>
                    <TouchableOpacity style={[styles.tfBtn, sel === true && !tfChecked && styles.tfSelT, tCorrect && styles.tfCorrect, tWrong && styles.tfWrong]} onPress={() => selectTF(qi, true)} disabled={tfChecked}>
                      <Text style={styles.tfBtnEmoji}>✅</Text><Text style={styles.tfBtnLabel}>Verdadero</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.tfBtn, sel === false && !tfChecked && styles.tfSelF, fCorrect && styles.tfCorrect, fWrong && styles.tfWrong]} onPress={() => selectTF(qi, false)} disabled={tfChecked}>
                      <Text style={styles.tfBtnEmoji}>❌</Text><Text style={styles.tfBtnLabel}>Falso</Text>
                    </TouchableOpacity>
                  </View>
                  {tfChecked && <FeedbackBar ok={isOk}>{isOk ? `✅ ${item.explain}` : `❌ Incorrecto. La respuesta correcta es «${item.correct ? 'Verdadero' : 'Falso'}». ${item.explain}`}</FeedbackBar>}
                </View>
              );
            })}
          </View>
        );

      // ---- 9 TEORÍA ejemplos e identidad ----
      case 9:
        return (
          <View>
            <Tag variant="theory">📖 Módulo 9 de 20 · Ejemplos e identidad</Tag>
            <Text style={styles.title}>Trucos 2 y 4: Mostrar y dar un personaje</Text>
            <Text style={styles.bodyText}>Estos dos trucos tienen algo en común: en lugar de explicar lo que quieres con palabras, se lo demuestras directamente o le creas un personaje.</Text>
            <SectionTitle>🎯 Truco 2 — Dar ejemplos: cómo hacerlo bien</SectionTitle>
            <View style={[styles.card, { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }]}>
              <Text style={[styles.cardTitle, { marginBottom: 7 }]}>📋 La fórmula:</Text>
              <View style={styles.formulaBox}>
                <Text style={styles.formulaText}>
                  Mira estos ejemplos de cómo quiero la respuesta:{'\n\n'}
                  <Text style={{ color: '#e11d48', fontWeight: '700' }}>Ejemplo 1:</Text>{'\n'}Si me dices: [lo que el usuario escribe]{'\n'}Quiero que respondas: [cómo quieres la respuesta]{'\n\n'}
                  <Text style={{ color: '#e11d48', fontWeight: '700' }}>Ejemplo 2:</Text>{'\n'}Si me dices: [otro ejemplo]{'\n'}Quiero que respondas: [otro ejemplo de respuesta]{'\n\n'}
                  Ahora haz lo mismo con: [tu pregunta real]
                </Text>
              </View>
            </View>
            <SectionTitle>🎭 Truco 4 — Darle identidad: básico vs completo</SectionTitle>
            <InfoCard variant="rose" icon="😐" iconBg="#fecdd3" title="Identidad básica (funciona regular)">"Eres un maestro de matemáticas."{'\n'}→ Respuesta: normal y aburrida.</InfoCard>
            <InfoCard variant="green" icon="🤩" iconBg="#bbf7d0" title="Identidad completa (funciona mucho mejor)">"Eres un maestro de matemáticas súper divertido que lleva 10 años enseñando a niños de 10-12 años. Te encantan los videojuegos y siempre explicas los números con ejemplos de Minecraft y Roblox. Eres muy paciente y festivas cada pequeño progreso con un '¡Crack!'"{'\n'}→ ¡Respuesta completamente diferente!</InfoCard>
            <Hl variant="red"><B>💡 El secreto de la identidad:</B>{'\n'}Cuanto más detallada sea la descripción del personaje — sus gustos, su experiencia, su forma de hablar — mejor funciona el truco. No digas solo "eres un experto". ¡Dile quién es, qué le gusta y cómo habla!</Hl>
          </View>
        );

      // ---- 10 RANKER ----
      case 10:
        return (
          <View>
            <Tag variant="new">🆕 Módulo 10 de 20 · Prompt Ranker</Tag>
            <Text style={styles.title}>¿Cuál prompt es mejor?</Text>
            <Text style={[styles.subtitle, { marginBottom: 9 }]}>Los 3 prompts de abajo tienen el mismo objetivo: <B>{rankerSet.task}</B>. Ordénalos del peor (arriba) al mejor (abajo).</Text>
            <InfoCard variant="rose">🔼 Posición 1 = peor · 🔽 Posición 3 = mejor · Toca dos tarjetas para intercambiarlas</InfoCard>
            {rankerOrder.map((pi, pos) => {
              const p = rankerSet.prompts[pi];
              const isSwap = rankerSwapA === pos;
              const okColor = rankerChecked && p.level === pos;
              const badColor = rankerChecked && p.level !== pos;
              return (
                <TouchableOpacity key={pos} activeOpacity={0.9} disabled={rankerChecked}
                  style={[styles.rankCard, isSwap && styles.rankCardSel, okColor && { borderColor: '#10b981', backgroundColor: '#f0fdf4' }, badColor && { borderColor: '#ef4444', backgroundColor: '#fff1f2' }]}
                  onPress={() => handleRankerTap(pos)}>
                  <View style={styles.rankHeader}>
                    <View style={[styles.rankBadge, okColor && { backgroundColor: '#10b981' }, badColor && { backgroundColor: '#ef4444' }]}>
                      <Text style={[styles.rankBadgeText, (okColor || badColor) && { color: '#fff' }]}>{pos + 1}</Text>
                    </View>
                    <Text style={styles.rankHint}>Opción {pos + 1} — tócala para ordenarla</Text>
                  </View>
                  <View style={styles.rankPromptBox}><Text style={styles.rankPromptText}>{p.text}</Text></View>
                </TouchableOpacity>
              );
            })}
            {rankerFb && <FeedbackBar ok={rankerFb.ok}>{rankerFb.msg}</FeedbackBar>}
          </View>
        );

      // ---- 11 TEORÍA decir qué NO y dividir ----
      case 11:
        return (
          <View>
            <Tag variant="theory">📖 Módulo 11 de 20 · Los trucos del NO y de dividir</Tag>
            <Text style={styles.title}>Trucos 3 y 5: Decir qué NO quieres y dividir tareas</Text>
            <SectionTitle>🚫 Truco 3 — Decir qué NO: ¿cómo funciona?</SectionTitle>
            <Text style={styles.bodyText}>La IA tiene respuestas "automáticas" que repite siempre que no le dices lo contrario. Por ejemplo: siempre usa listas con puntos, siempre usa palabras complicadas, siempre empieza con "¡Claro!" Este truco rompe esos hábitos.</Text>
            <View style={[styles.card, { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }]}>
              <Text style={[styles.cardTitle, { marginBottom: 7 }]}>📋 Cómo escribir el truco:</Text>
              <View style={styles.formulaBox}>
                <Text style={styles.formulaText}>[Lo que quieres que haga]{'\n\n'}EVITA: [cosas específicas que no quieres]{'\n'}NO uses: [palabras o frases concretas]{'\n'}NO hagas: [formatos o estructuras que no quieres]{'\n'}NO empieces con: [frases típicas que no te gustan]</Text>
              </View>
            </View>
            <SectionTitle>⛓️ Truco 5 — Dividir en partes: ¿por qué funciona mejor?</SectionTitle>
            <Text style={styles.bodyText}>Imagina que le pides a tu compañero que te ayude con un proyecto de ciencias que tiene 5 secciones. ¿Le pides todo de una vez o sección por sección? ¡Sección por sección sale mucho mejor! Con la IA es igual.</Text>
            <InfoCard variant="amber" icon="⛓️" iconBg="#fde68a" title="El patrón de los pasos"><B>Paso 1 — El esquema:</B> Pide primero el plan o estructura{'\n'}<B>Paso 2 — El desarrollo:</B> Trabaja sección por sección{'\n'}<B>Paso 3 — La mejora:</B> Mejora lo que no quedó bien{'\n'}<B>Paso 4 — La revisión:</B> Pide que revise todo junto</InfoCard>
            <Hl variant="red"><B>🔑 ¿Cuándo dividir?</B>{'\n'}Si le pides algo muy largo y la respuesta sale superficial o sin profundidad, ¡es la señal! Divide la tarea en partes más pequeñas. La IA funciona mejor cuando se concentra en una cosa a la vez.</Hl>
          </View>
        );

      // ---- 12 TÉCNICA PICKER ----
      case 12: {
        if (tecnicaDone) {
          return (
            <View>
              <Tag variant="new">🆕 Módulo 12 de 20 · Técnica Picker</Tag>
              <Text style={styles.title}>¡Técnica Picker completado!</Text>
              <Text style={[styles.subtitle, { textAlign: 'center', marginTop: 8 }]}>{tecnicaCorrect} de {tecnicaItems.length} situaciones acertadas.</Text>
              <FeedbackBar ok>Aplicaste las técnicas en cada mini-prompt. ¡Así se domina el prompting avanzado!</FeedbackBar>
            </View>
          );
        }
        const item = tecnicaItems[tecnicaQ];
        return (
          <View>
            <Tag variant="new">🆕 Módulo 12 de 20 · Técnica Picker</Tag>
            <Text style={styles.title}>¿Qué técnica usarías?</Text>
            <Text style={[styles.subtitle, { marginBottom: 9 }]}>Lee la situación y elige la técnica más adecuada. Luego aplícala en un mini-prompt.</Text>
            <Text style={styles.centerNote}>Situación {tecnicaQ + 1} de {tecnicaItems.length}</Text>
            <View style={styles.tecnicaBox}>
              <Text style={styles.tecnicaScenLabel}>📋 LA SITUACIÓN</Text>
              <Text style={styles.tecnicaScen}>{item.scenario}</Text>
            </View>
            <Text style={styles.tecnicaQ}>¿Qué técnica aplicas?</Text>
            <View style={styles.tecnicaOpts}>
              {item.opciones.map((op, i) => {
                const okColor = tecnicaAnswered && i === item.correct;
                const badColor = tecnicaAnswered && i === tecnicaSel && i !== item.correct;
                return (
                  <TouchableOpacity key={i} style={[styles.tecnicaOpt, okColor && styles.tecnicaOptOk, badColor && styles.tecnicaOptBad]} onPress={() => selectTecnica(i)} disabled={tecnicaAnswered}>
                    <Text style={[styles.tecnicaOptText, okColor && { color: '#166534' }, badColor && { color: '#991b1b' }]}>{op}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {tecnicaAnswered && (
              <FeedbackBar ok={tecnicaSel === item.correct}>{(tecnicaSel === item.correct ? '✅ ' : '❌ ') + item.explain}</FeedbackBar>
            )}
            {tecnicaAnswered && (
              <View style={{ marginTop: 10 }}>
                <Text style={styles.tecnicaStep2Label}>Ahora escribe un mini-prompt aplicando esa técnica:</Text>
                <InfoCard variant="rose">💡 Pista: {item.promptHint}</InfoCard>
                <TextInput style={styles.tecnicaTextarea} multiline textAlignVertical="top" placeholder="Escribe aquí tu prompt aplicando la técnica correcta..." placeholderTextColor="#b8bcc0" value={tecnicaPromptVal} onChangeText={setTecnicaPromptVal} />
                <Text style={styles.charCount}>{tecnicaPromptVal.length} / 30 mín.</Text>
              </View>
            )}
          </View>
        );
      }

      // ---- 13 CASO REAL ----
      case 13:
        return (
          <View>
            <Tag variant="case">🎯 Módulo 13 de 20 · Historia real</Tag>
            <Text style={styles.title}>Historia real: cómo Valentina mejoró su prompt</Text>
            <Text style={[styles.subtitle, { marginBottom: 11 }]}>Valentina, 14 años, estudiante de Bogotá. Necesitaba que la IA le ayudara a analizar las opiniones de usuarios de una app para su proyecto escolar.</Text>
            <View style={[styles.card, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
              <Text style={styles.scenLabel}>📋 LA SITUACIÓN</Text>
              <Text style={styles.cardText}>Valentina tenía 30 opiniones de usuarios de una app. Para su proyecto necesitaba encontrar los 3 problemas más comunes y proponer soluciones.</Text>
            </View>
            <SectionTitle>Intento 1 (sin trucos):</SectionTitle>
            <View style={[styles.promptBoxBad]}><Text style={styles.promptBoxMono}>"Analiza estas opiniones y dime qué problemas tienen los usuarios."</Text></View>
            <InfoCard variant="red">❌ Resultado: lista genérica sin orden, sin soluciones, sin nada útil para el proyecto. Valentina tuvo que empezar de nuevo.</InfoCard>
            <SectionTitle>Intento 4 (con 3 trucos combinados):</SectionTitle>
            <View style={[styles.promptBoxGood]}>
              <Text style={styles.promptBoxMono}>
                <Text style={{ color: '#7c3aed', fontWeight: '700' }}>[IDENTIDAD]</Text> Eres un investigador experto en aplicaciones móviles para estudiantes. Eres muy organizado y te gustan las respuestas claras y directas.{'\n\n'}
                <Text style={{ color: '#e11d48', fontWeight: '700' }}>[PASO A PASO]</Text> Analiza estas opiniones en orden: primero agrupa los problemas por tema, luego cuenta cuántas personas mencionan cada problema, luego evalúa cuál afecta más a los usuarios.{'\n\n'}
                <Text style={{ color: '#0ea5e9', fontWeight: '700' }}>[FORMATO]</Text> Dame una tabla con los 3 problemas más comunes, cuántas personas los mencionaron y una idea de solución en 2 líneas.{'\n\n'}
                <Text style={{ color: '#ef4444', fontWeight: '700' }}>[QUÉ NO]</Text> NO incluyas problemas que solo menciona 1 persona. NO uses palabras difíciles — el proyecto es para 9° grado.
              </Text>
            </View>
            <InfoCard variant="green">✅ Resultado: tabla perfecta lista para presentar. ¡Valentina la usó directamente en su proyecto y sacó excelente!</InfoCard>
            <Hl variant="red"><B>🔑 Lo que hizo diferente:</B>{'\n'}Combinó 3 trucos: Identidad (experto específico) + Paso a paso (analizar en orden) + Decir qué NO (sin problemas raros ni palabras difíciles). Tardó 4 intentos — ¡nadie llega al prompt perfecto de una vez!</Hl>
          </View>
        );

      // ---- 14 QUIZ ----
      case 14:
        return (
          <View>
            <Tag variant="quiz">❓ Módulo 14 de 20 · Quiz de trucos</Tag>
            <Text style={styles.title}>¿Qué truco usar en cada situación?</Text>
            <Text style={[styles.subtitle, { marginBottom: 12 }]}>Situaciones reales. ¿Qué truco de prompting usarías?</Text>
            {quizItems.map((q, qi) => (
              <View key={qi} style={{ marginBottom: 16 }}>
                <Text style={styles.quizQ}>{qi + 1}. {q.q}</Text>
                {q.opts.map((o, oi) => {
                  const sel = quizAnswers[qi] === oi;
                  const okColor = quizChecked && oi === q.correct;
                  const badColor = quizChecked && sel && oi !== q.correct;
                  return (
                    <TouchableOpacity key={oi} style={[styles.qopt, sel && !quizChecked && styles.qoptSel, okColor && styles.qoptOk, badColor && styles.qoptBad]} onPress={() => selectQuiz(qi, oi)} disabled={quizChecked}>
                      <View style={[styles.qoptLetter, sel && !quizChecked && styles.qoptLetterSel, okColor && styles.qoptLetterOk, badColor && styles.qoptLetterBad]}>
                        <Text style={[styles.qoptLetterText, (sel && !quizChecked) || okColor || badColor ? { color: '#fff' } : null]}>{String.fromCharCode(65 + oi)}</Text>
                      </View>
                      <Text style={[styles.qoptText, okColor && { color: '#166534' }, badColor && { color: '#991b1b' }, sel && !quizChecked && { color: '#9f1239' }]}>{o}</Text>
                    </TouchableOpacity>
                  );
                })}
                {quizChecked && <FeedbackBar ok={quizAnswers[qi] === q.correct}>{(quizAnswers[qi] === q.correct ? '✅ ' : '❌ ') + q.explain}</FeedbackBar>}
              </View>
            ))}
          </View>
        );

      // ---- 15 TEORÍA combinar ----
      case 15:
        return (
          <View>
            <Tag variant="theory">📖 Módulo 15 de 20 · Combinar trucos</Tag>
            <Text style={styles.title}>El poder de combinar trucos</Text>
            <Text style={styles.bodyText}>Los 5 trucos son como ingredientes de una receta. Solos son buenos, pero combinados pueden crear algo increíble. Lo importante es no mezclar demasiados — 2 o 3 es suficiente.</Text>
            <SectionTitle>Las combinaciones que mejor funcionan</SectionTitle>
            <InfoCard variant="rose" icon="🔗+🎭" iconBg="#fecdd3" title="Paso a paso + Identidad">Para preguntas difíciles que necesitan un experto que explique bien. Ejemplo: "Eres un profe de física que explica paso a paso para estudiantes de 11°..."</InfoCard>
            <InfoCard variant="pink" icon="📸+🚫" iconBg="#fbcfe8" title="Ejemplos + Qué NO">Para cuando necesitas un formato muy específico. Los ejemplos muestran el patrón y el "qué NO" evita que se salga del estilo que quieres.</InfoCard>
            <InfoCard variant="amber" icon="🎭+⛓️" iconBg="#fde68a" title="Identidad + Dividir en partes">Para proyectos grandes con un personaje consistente. Le das la identidad una vez y la mantiene en todos los pasos.</InfoCard>
            <InfoCard variant="green" icon="🔗📸🚫" iconBg="#bbf7d0" title="Paso a paso + Ejemplos + Qué NO">La combinación más potente para análisis complejos. Razona en pasos, muestra el formato con ejemplos, y le dices qué evitar.</InfoCard>
            <Hl variant="red"><B>⚠️ No combines demasiado:</B>{'\n'}Si usas los 5 trucos al mismo tiempo, el prompt puede confundir a la IA con demasiadas instrucciones. Elige los 2-3 que realmente necesitas para esa tarea específica. ¡Menos es más!</Hl>
          </View>
        );

      // ---- 16 FILL ----
      case 16:
        return (
          <View>
            <Tag variant="fill">💬 Módulo 16 de 20 · Vocabulario</Tag>
            <Text style={styles.title}>¿Cuál palabra va ahí?</Text>
            <Text style={[styles.subtitle, { marginBottom: 12 }]}>Completa estas frases sobre los trucos de prompting.</Text>
            {fillItems.map((item, qi) => {
              const parts = item.sentence.split('___');
              const isOk = fillChecked[qi] && fillSel[qi] === item.correct;
              return (
                <View key={qi} style={{ marginBottom: 18 }}>
                  <View style={[styles.card, { backgroundColor: '#fff1f2', borderColor: '#fecdd3', marginBottom: 8 }]}>
                    <Text style={[styles.cardTitle, { marginBottom: 6 }]}>Frase {qi + 1}:</Text>
                    <View style={styles.fillSentence}>
                      <Text style={styles.fillSentenceText}>{parts[0]}<Text style={styles.fillBlank}> ___ </Text>{parts[1]}</Text>
                    </View>
                  </View>
                  <View style={styles.fillOpts}>
                    {item.allOpts.map((opt, oi) => {
                      const okColor = fillChecked[qi] && oi === item.correct;
                      const badColor = fillChecked[qi] && fillSel[qi] === oi && oi !== item.correct;
                      return (
                        <TouchableOpacity key={oi} style={[styles.fillOpt, okColor && styles.fillOptOk, badColor && styles.fillOptBad]} onPress={() => selectFill(qi, oi)} disabled={!!fillChecked[qi]}>
                          <Text style={[styles.fillOptText, okColor && { color: '#166534' }, badColor && { color: '#991b1b' }]}>{opt}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {fillChecked[qi] && <FeedbackBar ok={isOk}>{(isOk ? '✅ ' : '❌ ') + item.explain}</FeedbackBar>}
                </View>
              );
            })}
          </View>
        );

      // ---- 17 TEORÍA errores ----
      case 17:
        return (
          <View>
            <Tag variant="theory">📖 Módulo 17 de 20 · Errores frecuentes</Tag>
            <Text style={styles.title}>Errores que comete casi todo el mundo al principio</Text>
            <Text style={styles.bodyText}>Ahora que conoces los trucos, te cuento los errores más comunes que cometen las personas cuando los están aprendiendo. ¡Así te los saltas!</Text>
            <InfoCard variant="red" icon="📏" iconBg="#fecdd3" title="Error 1: Escribir demasiado sin organizar">Agregar mucho texto no significa más ayuda si está todo mezclado. La IA se confunde igual que tú si te dan instrucciones larguísimas sin orden. Usa números o secciones para organizar las instrucciones.</InfoCard>
            <InfoCard variant="red" icon="⚡" iconBg="#fecdd3" title='Error 2: Usar "piensa paso a paso" para todo'>Este truco no sirve para preguntas fáciles. Si le preguntas "¿qué día es hoy?" con "piensa paso a paso", la IA se complica sin razón. Úsalo solo cuando la pregunta de verdad necesita razonamiento.</InfoCard>
            <InfoCard variant="red" icon="🔄" iconBg="#fecdd3" title="Error 3: Cambiar todo cuando algo falla">Si el prompt no funcionó, primero identifica exactamente qué parte falló. ¿El formato? ¿El razonamiento? ¿Incluyó algo que no querías? Cambia solo eso — no reescribas todo desde cero.</InfoCard>
            <InfoCard variant="red" icon="🎭" iconBg="#fecdd3" title="Error 4: Dar identidad sin restricciones">Darle un personaje sin decirle límites puede tener resultados raros. Siempre que le des una identidad, agrega qué NO debe hacer dentro de ese personaje.</InfoCard>
            <Hl variant="red"><B>💡 Cuando algo falle, hazte estas preguntas:</B>{'\n'}¿Entendió lo que le pedí? ¿Tiene toda la información necesaria? ¿Le especifiqué el formato? ¿Hay instrucciones que se contradicen? ¿Elegí el truco correcto para esta tarea?</Hl>
          </View>
        );

      // ---- 18 SPRINT ----
      case 18: {
        const item = sprintItems[sprintQ];
        const showEmoji = sprintCorrect >= 8 ? '🏆' : sprintCorrect >= 5 ? '⭐' : '💪';
        const resBg = sprintCorrect >= 8 ? '#dcfce7' : sprintCorrect >= 5 ? '#fef3c7' : '#fff1f2';
        const resCol = sprintCorrect >= 8 ? '#166534' : sprintCorrect >= 5 ? '#92400e' : '#991b1b';
        const vOk = sprintPick !== null && item && item.correct === true;
        const fOk = sprintPick !== null && item && item.correct === false;
        const vBad = sprintPick === true && item && item.correct !== true;
        const fBad = sprintPick === false && item && item.correct !== false;
        return (
          <View>
            <Tag variant="sprint">⚡ Módulo 18 de 20 · Sprint</Tag>
            <Text style={styles.title}>Sprint: ¿verdad o mito?</Text>
            <Text style={[styles.subtitle, { marginBottom: 9 }]}>60 segundos para demostrar que dominas los trucos de prompting. ¡Responde lo más rápido que puedas!</Text>
            {!sprintStarted && <InfoCard variant="rose">⚡ Toca <B>"Empezar Sprint"</B> y responde Verdadero o Falso lo más rápido posible</InfoCard>}
            <Text style={styles.sprintTimer}>{sprintSec}</Text>
            <View style={styles.sprintBarWrap}><View style={[styles.sprintBar, { width: `${(sprintSec / 60) * 100}%` }]} /></View>
            {sprintDone ? (
              <View style={[styles.sprintResult, { backgroundColor: resBg, borderColor: resCol + '40' }]}>
                <Text style={{ fontSize: 28, marginBottom: 6 }}>{showEmoji}</Text>
                <Text style={{ fontSize: 17, fontWeight: '800', color: resCol, marginBottom: 4 }}>{sprintCorrect} de {sprintItems.length} correctas</Text>
                <Text style={{ fontSize: 12, color: resCol }}>+{sprintCorrect >= 10 ? 25 : sprintCorrect >= 7 ? 18 : sprintCorrect >= 4 ? 12 : 5} XP ganados</Text>
              </View>
            ) : (
              <>
                <Text style={styles.sprintScore}>{sprintCorrect} correctas de {sprintQ} respondidas</Text>
                <View style={styles.sprintQBox}><Text style={styles.sprintQText}>{sprintStarted && item ? item.stmt : 'Presiona el botón de abajo para empezar'}</Text></View>
                <View style={styles.sprintOpts}>
                  <TouchableOpacity style={[styles.sprintBtn, vOk && styles.sprintBtnOk, vBad && styles.sprintBtnBad]} onPress={() => answerSprint(true)} disabled={!sprintStarted || sprintPick !== null}><Text style={styles.sprintBtnText}>✅ Verdadero</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.sprintBtn, fOk && styles.sprintBtnOk, fBad && styles.sprintBtnBad]} onPress={() => answerSprint(false)} disabled={!sprintStarted || sprintPick !== null}><Text style={styles.sprintBtnText}>❌ Falso</Text></TouchableOpacity>
                </View>
              </>
            )}
          </View>
        );
      }

      // ---- 19 GUÍA ----
      case 19:
        return (
          <View>
            <Tag variant="theory">📖 Módulo 19 de 20 · Tu guía</Tag>
            <Text style={styles.title}>Tu guía de trucos — ¡guárdala!</Text>
            <Text style={styles.bodyText}>Completaste los 5 trucos. Aquí tienes una guía rápida que puedes consultar cada vez que vayas a escribir un prompt importante.</Text>
            <View style={styles.guideTable}>
              <View style={[styles.guideRow, styles.guideHead]}>
                <Text style={[styles.guideCell, styles.guideHeadText, { flex: 1.1 }]}>Truco</Text>
                <Text style={[styles.guideCell, styles.guideHeadText, { flex: 1.4 }]}>¿Cuándo usarlo?</Text>
                <Text style={[styles.guideCell, styles.guideHeadText, { flex: 1.3 }]}>Frase mágica</Text>
              </View>
              {[
                { t: '🔗 Paso a paso', c: 'Lógica, matemáticas, análisis', f: '"Piensa paso a paso"' },
                { t: '📸 Dar ejemplos', c: 'Formato o estilo exacto', f: '"Mira estos ejemplos..."' },
                { t: '🚫 Decir qué NO', c: 'La IA repite cosas no deseadas', f: '"EVITA: / NO hagas:"' },
                { t: '🎭 Darle identidad', c: 'Necesitas un estilo especial', f: '"Eres un [personaje detallado]..."' },
                { t: '⛓️ Dividir en partes', c: 'La tarea es muy grande', f: 'Prompts separados por fase' },
              ].map((r, i) => (
                <View key={i} style={styles.guideRow}>
                  <Text style={[styles.guideCell, styles.guideCellBold, { flex: 1.1 }]}>{r.t}</Text>
                  <Text style={[styles.guideCell, { flex: 1.4, color: '#64748b' }]}>{r.c}</Text>
                  <Text style={[styles.guideCell, { flex: 1.3, color: '#9f1239', fontStyle: 'italic' }]}>{r.f}</Text>
                </View>
              ))}
            </View>
            <Hl variant="red"><B>🎯 La pregunta mágica antes de escribir un prompt:</B>{'\n'}"¿Qué podría salir mal?" · Si puede equivocarse razonando → usa paso a paso. · Si puede usar el formato incorrecto → da ejemplos. · Si puede incluir cosas que no quieres → di qué NO. · Si necesita un estilo especial → dale identidad. · Si es muy complejo → divídelo en partes.</Hl>
          </View>
        );

      // ---- 20 REFLEXIÓN ----
      case 20:
        return (
          <View>
            <Tag variant="reflect">✍️ Módulo 20 de 20 · Reflexión · +15 XP</Tag>
            <Text style={styles.title}>Tu truco favorito y por qué</Text>
            <Text style={styles.subtitle}>¡Aprendiste 5 trucos! Ahora piensa cuál es el que más te gusta.</Text>
            <View style={[styles.card, { backgroundColor: '#fff1f2', borderColor: '#fecdd3' }]}>
              <View style={styles.cardRow}>
                <View style={[styles.cardIcon, { backgroundColor: '#fecdd3' }]}><Text style={{ fontSize: 19 }}>🤔</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Tu reflexión</Text>
                  <Text style={styles.cardText}>Responde esto con honestidad:{'\n\n'}<B>1. ¿Cuál de los 5 trucos crees que vas a usar más? ¿Por qué ese y no los otros?</B>{'\n\n'}<B>2. Piensa en algo que intentaste hacer con una IA y no salió bien. ¿Qué truco usarías ahora para mejorar ese prompt?</B></Text>
                </View>
              </View>
            </View>
            <TextInput style={styles.reflectArea} multiline textAlignVertical="top" placeholder="Ejemplo: El truco que más me gusta es darle identidad, porque una vez le pedí ayuda a ChatGPT para entender la Guerra Fría y me dio una explicación muy aburrida. Si lo hubiera convertido en un narrador de aventuras para jóvenes, hubiera sido mucho más fácil de entender. La próxima vez que tenga que estudiar historia lo voy a intentar así..." placeholderTextColor="#b8bcc0" value={reflectVal} onChangeText={setReflectVal} />
            <Text style={styles.charCount}>{reflectVal.length} / 80 mínimo</Text>
            <Hl variant="green">🎯 <B>¡Lo que aprendiste hoy sirve en cualquier IA!</B>{'\n'}En el N8 vas a entender cómo funciona la IA por dentro: tokens, transformers, temperatura y alucinaciones — todo lo que hace que tus prompts funcionen (o fallen).</Hl>
          </View>
        );

      // ---- 21 COMPLETADO ----
      case 21:
        return (
          <View style={{ alignItems: 'center', paddingHorizontal: 13, paddingTop: 18 }}>
            <View style={styles.completeBadge}><Text style={{ fontSize: 44 }}>✍️</Text></View>
            <Text style={styles.completeTitle}>¡Nivel 7 completado!</Text>
            <Text style={styles.completeSub}>Terminaste "Prompting como un profesional". ¡Ahora tienes 5 trucos avanzados que muy poca gente conoce! Eso te hace un usuario experto de IA.</Text>
            <View style={styles.xpEarned}><Text style={styles.xpEarnedText}>⭐ {xp} XP ganados en este nivel</Text></View>
            <View style={{ alignSelf: 'stretch' }}>
              {[
                'Sé usar "piensa paso a paso" para que la IA resuelva problemas difíciles',
                'Puedo dar ejemplos para conseguir el formato exacto que quiero',
                'Sé decirle qué NO hacer para evitar respuestas que no me sirven',
                'Sé darle una identidad detallada para que cambie su forma de responder',
                'Puedo dividir tareas grandes en pasos pequeños para mejores resultados',
                'Sé combinar trucos y diagnosticar qué falla cuando un prompt no funciona',
              ].map((s, i) => (
                <View key={i} style={styles.skillRow}>
                  <Text style={styles.skillCheck}>✓</Text>
                  <Text style={styles.skillText}>{s}</Text>
                </View>
              ))}
            </View>
            <View style={styles.nextHint}>
              <Text style={styles.cardText}>🧠 <B>Nivel 8: El Cerebro Secreto de la IA</B>{'\n\n'}Ahora que dominas el prompting intermedio, vas a abrir el capó: tokens, transformers, temperatura, alucinaciones. Entender cómo funciona la IA por dentro hace que todos tus prompts tengan más sentido.</Text>
            </View>
            <View style={styles.lvlBarWrap}>
              <Text style={styles.lvlBarLabel}>Nivel 7 de 36 completado · Mundo 2 — Domina el Prompting</Text>
              <View style={styles.lvlBarOuter}><View style={[styles.lvlBarInner, { width: '23%' }]} /></View>
            </View>
            <TouchableOpacity style={styles.mainBtn} onPress={handleFinish}><Text style={styles.mainBtnText}>Siguiente nivel →</Text></TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  // ============ BOTÓN INFERIOR DINÁMICO ============
  const getBtn = (): { label: string; enabled: boolean; green: boolean; onPress: () => void; note?: string } | null => {
    switch (step) {
      case 0: return { label: '¡Empezar! →', enabled: true, green: false, onPress: next };
      case 1: case 2: case 4: case 6: case 9: case 11: case 13: case 15: case 17: case 19:
        return { label: 'Entendido →', enabled: true, green: false, onPress: next };
      case 3:
        return { label: compareIdx < compareItems.length - 1 ? 'Ver siguiente →' : '¡Completado! Continuar →', enabled: true, green: compareIdx >= compareItems.length - 1,
          onPress: () => { if (compareIdx < compareItems.length - 1) setCompareIdx((c) => c + 1); else { addXP(15); next(); } } };
      case 5: {
        const done = matchedL.size >= matchPairs.length;
        return { label: done ? 'Continuar →' : 'Conecta todos los pares', enabled: done, green: done, onPress: next };
      }
      case 7:
        return { label: sortOk ? 'Continuar →' : 'Verificar orden', enabled: true, green: false, onPress: () => { if (!sortOk) checkSort(); else next(); } };
      case 8: {
        const answered = Object.keys(tfAnswers).length >= tfItems.length || devMode;
        return { label: tfChecked ? 'Continuar →' : 'Comprobar', enabled: tfChecked || answered, green: false, note: `Responde las ${tfItems.length} afirmaciones · hasta ${tfItems.length * 5} XP`,
          onPress: () => { if (!tfChecked) checkTF(); else next(); } };
      }
      case 10:
        return { label: rankerChecked ? 'Continuar →' : 'Verificar orden', enabled: true, green: false, note: 'Toca dos tarjetas para intercambiarlas · del peor al mejor',
          onPress: () => { if (!rankerChecked) checkRanker(); else next(); } };
      case 12: {
        if (tecnicaDone) return { label: 'Continuar →', enabled: true, green: true, onPress: next };
        if (!tecnicaAnswered) return { label: 'Selecciona el truco', enabled: false, green: false, onPress: () => {} };
        const last = tecnicaQ >= tecnicaItems.length - 1;
        return { label: last ? 'Completar →' : 'Siguiente situación →', enabled: tecnicaPromptVal.trim().length >= 30 || devMode, green: false, onPress: advanceTecnica };
      }
      case 14: {
        const answered = Object.keys(quizAnswers).length >= quizItems.length || devMode;
        return { label: quizChecked ? 'Continuar →' : 'Comprobar respuestas', enabled: quizChecked || answered, green: quizChecked, note: `Responde las ${quizItems.length} preguntas · hasta ${quizItems.length * 8} XP`,
          onPress: () => { if (!quizChecked) checkQuiz(); else next(); } };
      }
      case 16: {
        const allDone = Object.keys(fillChecked).length >= fillItems.length || devMode;
        return { label: 'Continuar →', enabled: allDone, green: false, note: 'Elige la palabra correcta en cada frase · +6 XP cada una', onPress: next };
      }
      case 18:
        if (!sprintStarted) return { label: 'Empezar Sprint ⚡', enabled: true, green: false, note: '60 segundos · Verdadero o Falso · hasta 25 XP', onPress: startSprint };
        return { label: sprintDone ? 'Continuar →' : 'Sprint en curso...', enabled: sprintDone, green: false, onPress: next };
      case 20:
        return { label: 'Enviar reflexión →', enabled: reflectVal.trim().length >= 80 || devMode, green: false, note: 'Escribe al menos 80 caracteres · +15 XP',
          onPress: () => { if (checkReflect()) next(); } };
      default:
        return null; // 21 usa botón propio
    }
  };

  const btn = getBtn();
  const showBack = theorySteps.has(step);
  const progressPercent = (step / (TOTAL_STEPS - 1)) * 100;

  return (
    <View style={styles.screen}>
      <View style={styles.lessonBar}>
        <TouchableOpacity onPress={handleClose} style={styles.closeBtn}><Text style={styles.closeBtnText}>✕</Text></TouchableOpacity>
        <View style={styles.progWrap}>
          <View style={styles.progTrack}><View style={[styles.progFill, { width: `${progressPercent}%` }]} /></View>
          <Text style={styles.progLabel}>{step === 0 ? 'Introducción' : step < TOTAL_STEPS - 1 ? `Módulo ${step} de ${CONTENT_STEPS}` : '¡Nivel completado!'}</Text>
        </View>
        <View style={styles.xpChip}><Text style={styles.xpChipText}>{xp} XP</Text></View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {renderStepContent()}
      </ScrollView>

      {btn && (
        <View style={styles.btnRow}>
          <View style={styles.btnRowInner}>
            {showBack && (
              <TouchableOpacity style={styles.backBtn} onPress={prev}><Text style={styles.backBtnText}>← Volver</Text></TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.mainBtn, btn.green && styles.mainBtnGreen, !btn.enabled && styles.mainBtnDisabled, showBack && { flex: 1 }]} onPress={btn.onPress} disabled={!btn.enabled}>
              <Text style={styles.mainBtnText}>{btn.label}</Text>
            </TouchableOpacity>
          </View>
          {btn.note ? <Text style={styles.btnNote}>{btn.note}</Text> : null}
        </View>
      )}

      {xpToast && <XPToast key={xpToast.id} amount={xpToast.amount} onHide={() => setXpToast(null)} bgColor="#e11d48" textColor="#fff" />}
    </View>
  );
}

// ===================== ESTILOS =====================
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },

  // Header
  lessonBar: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13, paddingTop: 11, paddingBottom: 9, borderBottomWidth: 1, borderBottomColor: '#fff1f2', backgroundColor: '#fff1f2' },
  closeBtn: { minWidth: 42, minHeight: 42, borderRadius: 10, backgroundColor: '#ffe4e6', borderWidth: 1, borderColor: '#fecdd3', alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 12, color: '#9f1239', fontWeight: '800' },
  progWrap: { flex: 1 },
  progTrack: { height: 8, backgroundColor: '#ffe4e6', borderRadius: 4, overflow: 'hidden' },
  progFill: { height: '100%', borderRadius: 4, backgroundColor: '#e11d48' },
  progLabel: { fontSize: 10, color: '#94a3b8', marginTop: 3, fontWeight: '500' },
  xpChip: { paddingHorizontal: 11, paddingVertical: 4, borderRadius: 12, backgroundColor: '#fde68a', borderWidth: 1, borderColor: '#fcd34d' },
  xpChipText: { fontSize: 12, color: '#92400e', fontWeight: '700' },

  scrollView: { flex: 1 },
  scrollContent: { padding: 15, paddingBottom: 28 },

  // Tags / tipografía
  tag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 11 },
  tagText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  lessonIcon: { width: 66, height: 66, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { ...typography.extraBold, fontSize: 19, color: '#0f172a', marginBottom: 7, lineHeight: 25 },
  subtitle: { ...typography.regular, fontSize: 13, color: '#64748b', marginBottom: 13, lineHeight: 22 },
  bodyText: { ...typography.regular, fontSize: 13, color: '#334155', lineHeight: 23, marginBottom: 11 },
  bold: { fontWeight: '700', color: '#0f172a' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#0f172a', marginTop: 13, marginBottom: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  centerNote: { fontSize: 11, color: '#64748b', textAlign: 'center', marginBottom: 9, fontWeight: '500' },

  // Cards
  card: { borderRadius: 14, padding: 13, marginBottom: 9, borderWidth: 1 },
  cardRow: { flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  cardIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 12, fontWeight: '700', color: '#0f172a', marginBottom: 3 },
  cardText: { fontSize: 12, color: '#334155', lineHeight: 20 },

  // Step list (M1)
  stepRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 8 },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#e11d48', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  stepNumText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  stepListText: { flex: 1, fontSize: 12, color: '#334155', lineHeight: 20 },

  // Highlight boxes
  hlBox: { paddingHorizontal: 14, paddingVertical: 12, borderTopRightRadius: 12, borderBottomRightRadius: 12, borderLeftWidth: 3, marginVertical: 9 },
  hlText: { fontSize: 12, lineHeight: 20, fontWeight: '500' },

  // Ejemplos expandibles
  exCard: { borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 8, backgroundColor: '#fff' },
  exCardOpen: { borderColor: '#e11d48', backgroundColor: '#fff1f2' },
  exHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exEmoji: { width: 40, height: 40, backgroundColor: '#f1f5f9', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  exName: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  exSub: { fontSize: 11, color: '#64748b', marginTop: 1 },
  exBody: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#fecdd3' },
  exTag: { alignSelf: 'flex-start', backgroundColor: '#ffe4e6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginBottom: 6 },
  exTagText: { fontSize: 10, fontWeight: '700', color: '#9f1239' },
  exHow: { fontSize: 12, color: '#334155', lineHeight: 21, marginBottom: 8 },
  exFact: { backgroundColor: '#fffbeb', padding: 9, borderRadius: 8, borderWidth: 1, borderColor: '#fde68a' },
  exFactText: { fontSize: 11, color: '#92400e', fontWeight: '500', lineHeight: 16 },

  // Compare
  compareWrap: { flexDirection: 'row', gap: 8, marginBottom: 11 },
  compareCol: { flex: 1, borderRadius: 12, padding: 11, borderWidth: 2 },
  compareLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 7 },
  comparePrompt: { backgroundColor: 'rgba(255,255,255,0.6)', padding: 8, borderRadius: 7 },
  compareMono: { fontSize: 11, color: '#334155', lineHeight: 18, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  compareWhy: { fontSize: 10, color: '#64748b', marginTop: 7, lineHeight: 15, fontStyle: 'italic' },

  // Matching
  matchColLabel: { flex: 1, fontSize: 10, fontWeight: '700', color: '#64748b', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.3 },
  matchItem: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#fecdd3', backgroundColor: '#fff1f2', minHeight: 60, alignItems: 'center', justifyContent: 'center' },
  matchItemRight: { borderColor: '#fda4af' },
  matchText: { fontSize: 11, fontWeight: '500', color: '#9f1239', textAlign: 'center', lineHeight: 15 },
  matchTextSm: { fontSize: 11, fontWeight: '500', color: '#9f1239', textAlign: 'center', lineHeight: 15 },
  matchSel: { borderColor: '#e11d48', backgroundColor: '#ffe4e6' },
  matchOk: { borderColor: '#10b981', backgroundColor: '#dcfce7' },
  matchWrong: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },

  // Feedback bar
  feedbackBar: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 7 },
  fbOk: { backgroundColor: '#dcfce7' },
  fbWrong: { backgroundColor: '#fff1f2' },
  feedbackText: { fontSize: 12, lineHeight: 18, fontWeight: '500' },

  // Sort
  sortItem: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 11, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1.5, borderColor: '#e2e8f0', marginBottom: 6 },
  sortOk: { borderColor: '#86efac', backgroundColor: '#f0fdf4' },
  sortBad: { borderColor: '#fca5a5', backgroundColor: '#fff1f2' },
  sortNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#e11d48', alignItems: 'center', justifyContent: 'center' },
  sortNumText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  sortText: { flex: 1, fontSize: 11, color: '#334155', lineHeight: 17 },
  sortArrows: { gap: 3 },
  sortBtn: { width: 28, height: 26, borderRadius: 7, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  sortBtnDisabled: { opacity: 0.2 },

  // TF
  tfQuestion: { fontSize: 12, fontWeight: '700', color: '#0f172a', lineHeight: 19, padding: 11, backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 8 },
  tfOpts: { flexDirection: 'row', gap: 7 },
  tfBtn: { flex: 1, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 11, borderWidth: 2, borderColor: '#e2e8f0', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', minHeight: 52 },
  tfBtnEmoji: { fontSize: 15 },
  tfBtnLabel: { fontSize: 10, fontWeight: '600', color: '#334155', marginTop: 3 },
  tfSelT: { borderColor: '#e11d48', backgroundColor: '#ffe4e6' },
  tfSelF: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },
  tfCorrect: { borderColor: '#10b981', backgroundColor: '#dcfce7' },
  tfWrong: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },

  // Formula box (M9, M11)
  formulaBox: { backgroundColor: '#fff1f2', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#fecdd3' },
  formulaText: { fontSize: 11, color: '#334155', lineHeight: 20, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  // Ranker
  rankCard: { borderRadius: 13, borderWidth: 2, borderColor: '#e2e8f0', padding: 12, marginBottom: 8, backgroundColor: '#fafafa' },
  rankCardSel: { borderColor: '#e11d48', backgroundColor: '#ffe4e6' },
  rankHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  rankBadge: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  rankBadgeText: { fontSize: 13, fontWeight: '800', color: '#64748b' },
  rankHint: { fontSize: 10, fontWeight: '600', color: '#64748b' },
  rankPromptBox: { backgroundColor: 'rgba(255,255,255,0.7)', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#f1f5f9' },
  rankPromptText: { fontSize: 11, color: '#334155', lineHeight: 18, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  // Técnica picker
  tecnicaBox: { backgroundColor: '#fff1f2', borderWidth: 1, borderColor: '#fecdd3', borderRadius: 13, padding: 13, marginBottom: 11 },
  tecnicaScenLabel: { fontSize: 9, fontWeight: '700', color: '#9f1239', letterSpacing: 0.7, marginBottom: 6 },
  tecnicaScen: { fontSize: 12, color: '#334155', lineHeight: 21, fontWeight: '500' },
  tecnicaQ: { fontSize: 11, fontWeight: '700', color: '#334155', marginBottom: 6 },
  tecnicaOpts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  tecnicaOpt: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  tecnicaOptText: { fontSize: 11, fontWeight: '600', color: '#334155' },
  tecnicaOptOk: { borderColor: '#10b981', backgroundColor: '#dcfce7' },
  tecnicaOptBad: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },
  tecnicaStep2Label: { fontSize: 11, fontWeight: '700', color: '#334155', marginBottom: 5, marginTop: 6 },
  tecnicaTextarea: { minHeight: 72, padding: 9, borderRadius: 9, borderWidth: 1.5, borderColor: '#fecdd3', fontSize: 12, color: '#334155', lineHeight: 18, backgroundColor: '#fafafa' },
  charCount: { fontSize: 10, color: '#94a3b8', textAlign: 'right', marginTop: 3 },
  reflectArea: { minHeight: 110, padding: 11, borderRadius: 10, borderWidth: 1.5, borderColor: '#e2e8f0', fontSize: 13, color: '#334155', lineHeight: 20, backgroundColor: '#fafafa' },

  // Caso real
  scenLabel: { fontSize: 9, fontWeight: '700', color: '#92400e', letterSpacing: 0.7, marginBottom: 5 },
  promptBoxBad: { backgroundColor: '#fff1f2', borderRadius: 10, padding: 11, borderWidth: 1, borderColor: '#fecdd3', marginBottom: 9 },
  promptBoxGood: { backgroundColor: '#f0fdf4', borderRadius: 10, padding: 11, borderWidth: 1, borderColor: '#bbf7d0', marginBottom: 9 },
  promptBoxMono: { fontSize: 11, color: '#334155', lineHeight: 19, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  // Quiz
  quizQ: { fontSize: 12, fontWeight: '700', color: '#0f172a', lineHeight: 18, padding: 11, backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 9 },
  qopt: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 10, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#fff', marginBottom: 6, minHeight: 44 },
  qoptSel: { borderColor: '#e11d48', backgroundColor: '#ffe4e6' },
  qoptOk: { borderColor: '#10b981', backgroundColor: '#dcfce7' },
  qoptBad: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },
  qoptLetter: { width: 22, height: 22, borderRadius: 6, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  qoptLetterSel: { backgroundColor: '#e11d48', borderColor: '#e11d48' },
  qoptLetterOk: { backgroundColor: '#10b981', borderColor: '#10b981' },
  qoptLetterBad: { backgroundColor: '#ef4444', borderColor: '#ef4444' },
  qoptLetterText: { fontSize: 10, fontWeight: '700', color: '#64748b' },
  qoptText: { flex: 1, fontSize: 11, color: '#334155', lineHeight: 17, fontWeight: '500' },

  // Fill
  fillSentence: { backgroundColor: '#fff1f2', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#fecdd3' },
  fillSentenceText: { fontSize: 13, color: '#334155', lineHeight: 26 },
  fillBlank: { fontWeight: '700', color: '#9f1239' },
  fillOpts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  fillOpt: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  fillOptText: { fontSize: 12, fontWeight: '600', color: '#334155' },
  fillOptOk: { borderColor: '#10b981', backgroundColor: '#dcfce7' },
  fillOptBad: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },

  // Sprint
  sprintTimer: { fontSize: 36, fontWeight: '800', textAlign: 'center', color: '#e11d48', marginTop: 8, marginBottom: 4 },
  sprintBarWrap: { height: 8, backgroundColor: '#e2e8f0', borderRadius: 4, overflow: 'hidden', marginBottom: 12 },
  sprintBar: { height: '100%', borderRadius: 4, backgroundColor: '#e11d48' },
  sprintScore: { textAlign: 'center', fontSize: 12, color: '#64748b', marginBottom: 6 },
  sprintQBox: { padding: 12, backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 9, minHeight: 52, justifyContent: 'center' },
  sprintQText: { fontSize: 13, fontWeight: '700', color: '#0f172a', lineHeight: 18 },
  sprintOpts: { flexDirection: 'row', gap: 8 },
  sprintBtn: { flex: 1, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 11, borderWidth: 2, borderColor: '#e2e8f0', backgroundColor: '#fff', alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  sprintBtnOk: { borderColor: '#10b981', backgroundColor: '#dcfce7' },
  sprintBtnBad: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },
  sprintBtnText: { fontSize: 12, fontWeight: '700', color: '#334155' },
  sprintResult: { padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 8, borderWidth: 1 },

  // Guía tabla
  guideTable: { borderRadius: 10, overflow: 'hidden', marginVertical: 10, borderWidth: 1, borderColor: '#f1f5f9' },
  guideRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  guideHead: { backgroundColor: '#fff1f2', borderBottomWidth: 2, borderBottomColor: '#fecdd3' },
  guideCell: { paddingHorizontal: 8, paddingVertical: 8, fontSize: 11, lineHeight: 15 },
  guideHeadText: { color: '#9f1239', fontWeight: '700' },
  guideCellBold: { fontWeight: '700', color: '#0f172a' },

  // Completado
  completeBadge: { width: 86, height: 86, borderRadius: 24, backgroundColor: '#fecdd3', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  completeTitle: { fontSize: 21, fontWeight: '800', color: '#0f172a', marginBottom: 6, textAlign: 'center' },
  completeSub: { fontSize: 12, color: '#64748b', lineHeight: 20, marginBottom: 16, textAlign: 'center' },
  xpEarned: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 11, paddingHorizontal: 20, backgroundColor: '#fef9c3', borderRadius: 12, marginBottom: 14, borderWidth: 1, borderColor: '#fcd34d', alignSelf: 'stretch' },
  xpEarnedText: { fontSize: 15, fontWeight: '700', color: '#92400e' },
  skillRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: '#f0fdf4', borderRadius: 9, borderWidth: 1, borderColor: '#bbf7d0', marginBottom: 6 },
  skillCheck: { color: '#10b981', fontSize: 14, fontWeight: '700', marginTop: 1 },
  skillText: { flex: 1, fontSize: 11, color: '#166534', lineHeight: 16, fontWeight: '500' },
  nextHint: { alignSelf: 'stretch', padding: 11, backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginTop: 8, marginBottom: 13 },
  lvlBarWrap: { alignSelf: 'stretch', marginBottom: 14 },
  lvlBarLabel: { fontSize: 10, color: '#94a3b8', marginBottom: 4 },
  lvlBarOuter: { height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden' },
  lvlBarInner: { height: '100%', backgroundColor: '#e11d48', borderRadius: 3 },

  // Botón inferior
  btnRow: { paddingHorizontal: 13, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', backgroundColor: '#fafcff' },
  btnRowInner: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  backBtn: { paddingVertical: 13, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#e2e8f0', minHeight: 48, justifyContent: 'center' },
  backBtnText: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  mainBtn: { flex: 1, padding: 13, borderRadius: 12, backgroundColor: '#e11d48', alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  mainBtnGreen: { backgroundColor: '#10b981' },
  mainBtnDisabled: { opacity: 0.32 },
  mainBtnText: { ...typography.bold, color: '#fff', fontSize: 14 },
  btnNote: { fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 5 },
});
