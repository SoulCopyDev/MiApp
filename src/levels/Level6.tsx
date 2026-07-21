import { exitLevel } from '../utils/exitLevel';
import { router } from 'expo-router';
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
import { useGameStore } from '../store/gameStore';
import { useReportProgress } from '../components/LevelProgress';
import { colors, typography } from '../theme';
import XPToast from '../components/XPToast';
import { pickN, shuffleDistinct } from '../utils/shuffle';

// ---------- Tipos ----------
type TFItem = { stmt: string; correct: boolean; explain: string };
type TipoItem = { text: string; correct: 'generador' | 'asistente' | 'automatizador' };
type QuizItem = { q: string; opts: string[]; correct: number; explain: string };
type ReadmeSection = { parts: string[]; blanks: { opts: string[]; correct: number }[]; explain: string };
type EthicsItem = { scenario: string; correct: 'safe' | 'doubt' | 'bad'; explain: string };
type Mission = { id: string; icon: string; name: string; desc: string };
type SprintItem = { stmt: string; correct: boolean };

// ---------- Constantes ----------
const TOTAL_STEPS = 19; // 0..18
const CONTENT_STEPS = 18;

// ---------- Pools de datos ----------
const VIABLE_TF_POOL: TFItem[] = [
  { stmt: 'Puedo usar un LLM para crear un asistente que responda preguntas frecuentes de mi colegio.', correct: true, explain: '¡Proyecto perfecto! Es concreto, tiene una audiencia definida y un problema real. Los LLMs son ideales para responder preguntas sobre documentos y contextos específicos.' },
  { stmt: 'Puedo pedirle a ChatGPT que construya una app completa de delivery como Rappi, lista para publicar.', correct: false, explain: 'No con solo un prompt. Una app de delivery requiere equipos, meses de desarrollo, servidores, pagos, mapas, etc. Los LLMs ayudan en partes del proceso, no reemplazan todo el trabajo.' },
  { stmt: 'Puedo usar Claude para que me ayude a crear el guion completo de un cortometraje.', correct: true, explain: '¡Sí! Guiones, historias, diálogos — los LLMs son excelentes para contenido creativo estructurado. Puedes iterar y mejorar con el modelo hasta tener algo que te guste.' },
  { stmt: 'Puedo usar un LLM para generar automáticamente las respuestas de mis exámenes del colegio y entregarlas.', correct: false, explain: 'Técnicamente posible, éticamente problemático. Entregarlas como propias es deshonestidad académica. Los LLMs deben usarse para aprender, no para hacer trampa.' },
  { stmt: 'Puedo construir un generador de ideas para proyectos de ciencias basado en los temas del grado.', correct: true, explain: 'Proyecto muy concreto y útil. Le das contexto (grado, temas, materiales disponibles) y el LLM genera ideas variadas. Puedes mejorar el prompt para hacerlo más preciso.' },
  { stmt: 'Puedo pedirle a un LLM que hackee la red wifi de mi vecino para mí.', correct: false, explain: 'No, y definitivamente no. Los LLMs están diseñados para rechazar solicitudes de actividades ilegales. El hacking sin autorización es ilegal y no ético en ningún contexto.' },
  { stmt: 'Puedo usar un LLM para crear un resumen diario personalizado de noticias sobre un tema que me interesa.', correct: true, explain: 'Proyecto práctico y realista. Con los LLMs adecuados que tienen acceso a internet (Gemini), puedes construir flujos de información personalizados sobre cualquier tema.' },
  { stmt: 'Puedo usar IA para que prediga exactamente qué va a pasar en el mercado de acciones mañana con 100% de precisión.', correct: false, explain: 'Imposible. Ningún sistema puede predecir mercados financieros con certeza — hay demasiadas variables y aleatoriedad. Desconfía de cualquier herramienta que prometa esto.' },
];

const TIPO_POOL: TipoItem[] = [
  { text: 'Asistente de preguntas frecuentes del colegio', correct: 'asistente' },
  { text: 'Generador de ideas para proyectos de arte', correct: 'generador' },
  { text: 'Resumidor automático de noticias por tema', correct: 'automatizador' },
  { text: 'Chatbot que explica conceptos de física', correct: 'asistente' },
  { text: 'Creador de guiones para videos de YouTube', correct: 'generador' },
  { text: 'Sistema que convierte mis apuntes en flashcards', correct: 'automatizador' },
  { text: 'Tutor personalizado de matemáticas con preguntas adaptadas', correct: 'asistente' },
  { text: 'Generador de nombres creativos para un proyecto', correct: 'generador' },
  { text: 'Herramienta que clasifica y organiza mis tareas del día', correct: 'automatizador' },
];

const SORT_METODO = [
  { b: 'Define el problema:', r: ' ¿Qué problema concreto vas a resolver? ¿Para quién?' },
  { b: 'Diseña el prompt base:', r: ' Escribe el primer prompt que describe lo que necesitas al LLM' },
  { b: 'Prueba y evalúa:', r: ' Ejecuta el prompt real y revisa si el resultado es útil' },
  { b: 'Itera y mejora:', r: ' Ajusta el prompt según lo que falló o se puede mejorar' },
  { b: 'Documenta y comparte:', r: ' Escribe qué hiciste, cómo funciona y para qué sirve' },
];

const ITER_QUIZ_POOL: QuizItem[] = [
  { q: 'Pruebas tu prompt y el LLM da una respuesta demasiado larga y técnica. ¿Qué haces primero?', opts: ['Borrar el prompt entero y empezar otra vez desde cero probando con un modelo distinto', 'Agregar al prompt que responda en máximo 3 oraciones simples, pensadas para alguien de 14 años', 'Aceptar la respuesta tal como está, porque el modelo sabe mejor que tú qué formato conviene', 'Pedirle al mismo modelo que evalúe su propia respuesta y decida solo si debería acortarla'], correct: 1, explain: 'La iteración inteligente es agregar instrucciones específicas de formato y audiencia al prompt. Raramente necesitas empezar desde cero — casi siempre es más eficiente refinar lo que tienes.' },
  { q: 'Tu asistente de preguntas frecuentes da respuestas incorrectas sobre el horario del colegio. ¿Por qué ocurre esto?', opts: ['El modelo está defectuoso o dañado, así que lo mejor es reemplazarlo por otro diferente', 'El modelo no tiene el horario — necesitas incluir esa información en el prompt o el contexto', 'Los LLMs no están capacitados para responder preguntas sobre horarios ni fechas de ningún tipo', 'Necesitas pagar la versión premium del modelo para que pueda acceder a los datos del colegio'], correct: 1, explain: 'Los LLMs solo saben lo que les dices. Si el horario del colegio no está en el prompt o en documentos adjuntos, el modelo no puede saberlo. La solución es incluir la información relevante en el contexto.' },
  { q: '¿Cuántas veces deberías iterar un prompt antes de considerarlo "terminado"?', opts: ['Exactamente 3 veces, porque esa es la cantidad ideal para cualquier proyecto sin excepción', 'Hasta que la respuesta sea realmente útil para el usuario final, sin importar cuántas veces tome', 'Solo una vez: si no funciona a la primera, significa que el proyecto simplemente no es viable', 'Siempre 5 veces exactas, tal como lo indica la metodología estándar de todos los proyectos'], correct: 1, explain: 'No hay un número mágico. Iteras hasta que la respuesta sea genuinamente útil. Proyectos simples pueden tomar 2-3 iteraciones; proyectos complejos pueden tomar 10-20.' },
  { q: 'Tienes un generador de ideas para proyectos de arte que funciona bien en general. ¿Cómo lo harías más específico para tu colegio?', opts: ['No se puede hacer más específico una vez que el generador ya funciona bien de forma general', 'Agregar al prompt el grado, los materiales disponibles en el colegio y el tiempo de entrega típico', 'Cambiar por completo el tipo de proyecto y empezar de nuevo con una idea totalmente distinta', 'Pedirle al modelo que sea mucho más creativo, sin darle ningún contexto ni detalle adicional'], correct: 1, explain: 'La especificidad del contexto mejora exponencialmente la calidad. Cuanto más sabe el modelo sobre tu situación específica (grado, recursos, restricciones), más útiles serán las ideas que genera.' },
  { q: 'Alguien te dice que su proyecto de IA "no funciona". ¿Cuál es la primera pregunta que deberías hacerle?', opts: ['¿Qué modelo de IA usaste y por qué elegiste precisamente ese en lugar de cualquier otro?', '¿Cuánto dinero gastaste en total y qué plan de pago contrataste para armar tu proyecto?', '¿Qué prompt exacto usaste y qué resultado esperabas comparado con el que realmente obtuviste?', '¿Cuántos años llevas programando y qué lenguajes de programación dominas mejor hasta ahora?'], correct: 2, explain: 'El diagnóstico siempre comienza por entender la diferencia entre expectativa y resultado real. Sin saber el prompt exacto y la expectativa, es imposible saber qué mejorar.' },
  { q: 'Tu prompt para un generador de nombres creativos da siempre el mismo tipo de nombres. ¿Qué ajuste haría la mayor diferencia?', opts: ['Copiar el prompt completo y pegarlo dos veces seguidas para reforzar tu pedido ante el modelo', 'Agregar ejemplos de nombres en estilos distintos que NO quieres, para que el modelo los evite', 'Cambiar de un modelo a otro, por ejemplo de Claude a ChatGPT, esperando obtener más variedad', 'Usar muchas más mayúsculas en el prompt para que el modelo entienda mejor lo que le pides'], correct: 1, explain: 'Los ejemplos negativos (lo que NO quieres) son muy efectivos para guiar la creatividad. También puedes agregar "dame 10 opciones en estilos muy diferentes entre sí" para forzar variedad.' },
  { q: '¿Qué significa que un proyecto de IA sea "iterativo"?', opts: ['Que utiliza muchos modelos de IA distintos, funcionando todos al mismo tiempo en paralelo', 'Que se construye en ciclos: probar, evaluar, ajustar y volver a probar hasta que funcione bien', 'Que soporta a muchísimos usuarios usándolo todos a la vez sin que el sistema falle nunca', 'Que el código del proyecto se ejecuta dentro de un bucle que se repite de forma infinita'], correct: 1, explain: 'Iterativo viene de "iterar" — repetir. En proyectos de IA, construyes una versión mínima, la pruebas, aprendes qué falla, mejoras y repites. Es el método más efectivo para llegar a algo que realmente funcione.' },
  { q: 'Construiste un asistente de estudio con LLM que responde sobre historia de Colombia. Un amigo lo prueba y le pregunta sobre química. El asistente intenta responder pero da información incorrecta. ¿Qué harías?', opts: ['Expandir el asistente para que aprenda y responda absolutamente todos los temas de todas las materias', 'Agregar al prompt una regla: si la pregunta no es de historia de Colombia, que lo avise y sugiera buscarlo en otro lado', 'Eliminar el proyecto por completo, porque evidentemente no funciona bien ni sirve para nada útil', 'Permitir que el asistente intente responder cualquier materia, aunque a veces entregue datos incorrectos'], correct: 1, explain: 'Limitar el alcance del proyecto es una decisión de diseño inteligente. Es mejor un asistente excelente en un tema que uno mediocre en todos. Las restricciones explícitas en el prompt controlan el comportamiento del modelo.' },
];

const README_SECTIONS: ReadmeSection[] = [
  { parts: ['Mi proyecto se llama ', ' y está diseñado para ayudar a ', '.'], blanks: [{ opts: ['Asistente de Estudio', 'Código malicioso', 'Virus automático', 'Sistema de hackeo'], correct: 0 }, { opts: ['estudiantes a estudiar mejor', 'hackear sistemas ajenos', 'robar contraseñas', 'engañar a profesores'], correct: 0 }], explain: 'El nombre y la audiencia son lo primero. Una buena Ficha del proyecto siempre empieza con para qué sirve y para quién.' },
  { parts: ['Para usarlo, debes escribir tu pregunta en el chat y el modelo responderá usando el ', ' que le diste como contexto.'], blanks: [{ opts: ['contexto', 'virus', 'token', 'deepfake'], correct: 0 }], explain: 'El "contexto" es la información que incluyes en el prompt para que el modelo pueda responder con precisión sobre tu tema específico.' },
  { parts: ['Este proyecto fue construido usando ', ' como herramienta de IA y puede mejorarse ', ' el prompt con más instrucciones.'], blanks: [{ opts: ['un LLM', 'una impresora', 'una calculadora', 'un virus'], correct: 0 }, { opts: ['iterando', 'borrando', 'copiando', 'ignorando'], correct: 0 }], explain: 'Toda Ficha del proyecto menciona las herramientas usadas y cómo se puede mejorar el proyecto en el futuro.' },
];

const PROJ_ETHICS_POOL: EthicsItem[] = [
  { scenario: 'Vas a publicar tu asistente de preguntas frecuentes del colegio. Los usuarios son estudiantes de 12-15 años.', correct: 'safe', explain: 'Proyecto educativo, audiencia clara, propósito definido. Solo asegúrate de incluir en el prompt que no dé información médica ni personal sensible.' },
  { scenario: 'Quieres hacer un generador de memes de tus compañeros de clase usando fotos que ellos publicaron.', correct: 'bad', explain: 'Usar fotos de personas reales sin su consentimiento para crear contenido que podría usarse para burlarse de ellas viola su privacidad y puede ser acoso digital.' },
  { scenario: 'Construiste un asistente de estudio que no tiene respuestas para algunas preguntas. Le pones un mensaje: "Consulta con tu profesor para esta pregunta."', correct: 'safe', explain: 'Excelente diseño ético. Reconocer los límites del sistema y redirigir a un humano cuando el modelo no sabe es exactamente lo que debe hacerse.' },
  { scenario: 'Tu proyecto genera resúmenes de noticias. Decides no incluir ningún filtro y que el LLM resuma cualquier noticia, incluyendo contenido violento o engañoso.', correct: 'doubt', explain: 'Dudoso. Para una audiencia joven, no incluir filtros de contenido es un riesgo. Agrega al prompt instrucciones para rechazar contenido violento, sexual o extremista.' },
  { scenario: 'Quieres que tu asistente de estudio recuerde el nombre y las notas de cada estudiante que lo usa.', correct: 'doubt', explain: 'Recopilar datos personales de menores (notas, información personal) requiere consentimiento de padres/tutores en la mayoría de países. Para un proyecto escolar, considera no guardar datos personales.' },
  { scenario: 'Publicas tu generador de ideas con una advertencia clara: "Las ideas generadas por IA deben ser revisadas y adaptadas por el usuario. No somos responsables del uso que se haga de ellas."', correct: 'safe', explain: 'Incluir disclaimers sobre las limitaciones de la IA y la responsabilidad del usuario es una práctica ética estándar en proyectos con IA generativa.' },
];

const BUILD_QUIZ_POOL: QuizItem[] = [
  { q: '¿Cuál es el primer paso para construir un proyecto con IA?', opts: ['Elegir el modelo de IA más caro y potente que puedas encontrar disponible en el mercado', 'Definir con claridad el problema concreto que vas a resolver y para quién lo vas a resolver', 'Escribir de inmediato todo el código de la aplicación antes de ponerte a pensar en otra cosa', 'Crear primero el diseño visual completo, los colores y los botones de la interfaz del proyecto'], correct: 1, explain: 'Siempre primero el problema, luego la solución. Sin un problema claro y una audiencia definida, cualquier proyecto de IA será una solución en busca de problema.' },
  { q: '¿Qué es un "prompt base" en el contexto de un proyecto con LLM?', opts: ['El código fuente interno con el que fue programado y entrenado originalmente el modelo de lenguaje', 'El prompt inicial que define el comportamiento del sistema y las reglas para todos los usuarios', 'La interfaz gráfica con los botones que el usuario ve al abrir la aplicación de tu proyecto', 'El nombre y el logotipo que le pones a tu proyecto para presentarlo mejor ante los demás'], correct: 1, explain: 'El prompt base (o system prompt) es las instrucciones que le das al LLM para que se comporte como tu asistente específico. Define el rol, el tono, el alcance y las restricciones del sistema.' },
  { q: '¿Por qué es importante probar tu proyecto con usuarios reales antes de publicarlo?', opts: ['Para que muchas más personas se enteren de que tu proyecto existe y empiecen a usarlo pronto', 'Porque los usuarios reales hacen preguntas inesperadas que revelan fallos que tú no habías previsto', 'Para aumentar tu número de seguidores en redes sociales y volverte más popular en internet', 'Porque los LLMs necesitan una gran cantidad de usuarios conectados a la vez para funcionar bien'], correct: 1, explain: 'Los usuarios reales hacen preguntas de formas que nunca imaginaste. Sus "fallos" son los datos más valiosos para mejorar el proyecto. Siempre prueba con al menos 3-5 personas reales antes de publicar.' },
  { q: '¿Qué información debería incluir la Ficha de tu proyecto de IA?', opts: ['Únicamente el nombre del proyecto, sin ningún otro detalle ni información adicional que lo acompañe', 'Para qué sirve, quién lo usa, cómo usarlo, qué LLM usa y cómo se puede mejorar en el futuro', 'Solamente el código fuente completo, sin explicaciones ni instrucciones de uso de ningún tipo', 'Solamente los créditos con los nombres de todas las personas que participaron en construirlo'], correct: 1, explain: 'Una buena Ficha del proyecto permite que cualquier persona entienda tu proyecto en 2 minutos sin preguntarte nada. Incluye propósito, audiencia, instrucciones de uso, tecnología y posibles mejoras.' },
  { q: 'Tu asistente funciona bien para preguntas en español pero muy mal en inglés. ¿Qué solución es más directa?', opts: ['Cambiar por completo el modelo de IA por otro distinto que maneje mejor los dos idiomas', 'Agregar en el prompt base una instrucción para que responda siempre en español, sin importar el idioma de la pregunta', 'Contratar a un traductor profesional que revise y traduzca cada una de las respuestas del asistente', 'Publicar el proyecto únicamente en países hispanohablantes para que nadie lo use nunca en inglés'], correct: 1, explain: 'El prompt base controla el comportamiento del modelo. Especificar el idioma de respuesta es una instrucción simple y efectiva que resuelve el problema en un solo ajuste.' },
  { q: '¿Qué significa "documentar" un proyecto de IA?', opts: ['Filmar un video largo mostrando todo el proceso de construcción del proyecto de principio a fin', 'Escribir con claridad qué hace el proyecto, cómo funciona, cómo se usa y cómo se puede mejorar', 'Guardar el historial completo de todas las conversaciones que tuviste con el modelo de IA usado', 'Crear un folleto publicitario de marketing para promocionar y vender el proyecto ante el público'], correct: 1, explain: 'Documentar es dejar un registro claro para que otros (o tu yo del futuro) puedan entender, usar y mejorar el proyecto. Es una habilidad profesional fundamental en tecnología.' },
  { q: '¿Cuál de estos describe mejor un proyecto de IA bien diseñado para estudiantes?', opts: ['Resuelve automáticamente todos los problemas del mundo sin que nadie tenga que intervenir nunca', 'Tiene propósito específico, audiencia definida, prompt refinado, documentación y cuidado ético', 'Es el proyecto más complejo y difícil técnicamente que se pueda construir con la tecnología actual', 'Usa la mayor cantidad posible de herramientas de IA distintas funcionando todas al mismo tiempo'], correct: 1, explain: 'La simplicidad enfocada vence a la complejidad difusa. Un proyecto bien diseñado hace una cosa muy bien, para una audiencia clara, con límites éticos definidos.' },
  { q: 'Alguien te dice que tu asistente "da respuestas muy formales y aburridas". ¿Cómo lo mejoras?', opts: ['Cambiar de inmediato a un modelo de IA completamente diferente, esperando que hable más divertido', 'Agregar al prompt una instrucción de tono: que responda de forma amigable, casual y motivadora, como un compañero de clase', 'Eliminar el proyecto entero y empezar otro desde cero con una idea totalmente distinta a esta', 'Explicarle a la persona que los modelos de IA siempre hablan formal y que eso no se puede cambiar'], correct: 1, explain: 'El tono y el estilo se controlan con el prompt. Describir la persona del asistente ("como un compañero de clase") es más efectivo que simplemente pedir "sé amigable".' },
];

const SPRINT_PROJ: SprintItem[] = [
  { stmt: 'Antes de publicar tu proyecto, debes probarlo con usuarios reales', correct: true },
  { stmt: 'Si el prompt funciona a la primera, no hace falta iterarlo', correct: false },
  { stmt: 'La Ficha del proyecto explica qué hace el proyecto y cómo usarlo', correct: true },
  { stmt: 'Puedes usar fotos de tus compañeros sin permiso en tu proyecto de IA', correct: false },
  { stmt: 'Incluir el contexto relevante en el prompt mejora las respuestas del LLM', correct: true },
  { stmt: 'Un proyecto de IA que no define su audiencia generalmente funciona mejor', correct: false },
  { stmt: 'Limitar el alcance de un asistente es una buena práctica de diseño', correct: true },
  { stmt: 'Si el LLM da respuestas incorrectas, siempre es culpa del modelo, no del prompt', correct: false },
  { stmt: 'Documentar tu proyecto ayuda a que otros puedan entenderlo y mejorarlo', correct: true },
  { stmt: 'Un generador de contenido sin filtros de ética es suficientemente seguro para menores', correct: false },
  { stmt: 'Iterar un prompt significa ajustarlo en base a los resultados reales', correct: true },
  { stmt: 'Es ético usar un LLM para hacer el trabajo de otro sin su conocimiento y presentarlo como tuyo', correct: false },
];

const MISSIONS: Mission[] = [
  { id: 'study', icon: '📚', name: 'Asistente de Estudio', desc: 'Un LLM que te ayuda a estudiar para exámenes de cualquier materia, explicando conceptos y haciendo preguntas de práctica.' },
  { id: 'ideas', icon: '💡', name: 'Generador de Ideas', desc: 'Un LLM que genera ideas creativas para proyectos, tareas, actividades o eventos según el contexto que le des.' },
  { id: 'checklist', icon: '✅', name: 'Creador de Checklists', desc: 'Un LLM que convierte cualquier objetivo o proyecto en una lista de pasos ordenados y accionables.' },
];

const BUILDER_OPTIONS: Record<string, string[]> = {
  tipo: ['Asistente de preguntas y respuestas', 'Generador de ideas creativas', 'Automatizador de tareas repetitivas', 'Tutor personalizado de un tema', 'Creador de contenido'],
  audiencia: ['estudiantes de mi colegio', 'mi familia', 'emprendedores locales', 'profesores', 'cualquier persona interesada'],
  modelo: ['Claude (análisis y textos largos)', 'ChatGPT (versatilidad general)', 'Gemini (info actualizada de Google)', 'cualquier LLM disponible'],
  formato: ['respuestas cortas de máximo 3 oraciones', 'listas de 5 puntos concretos', 'texto narrativo conversacional', 'tabla comparativa', 'preguntas y respuestas'],
  etica: ['No des información médica ni legal definitiva', 'No menciones marcas ni productos específicos', 'Redirige a un humano si la pregunta es muy sensible', 'Mantén siempre un tono respetuoso y positivo'],
};
const BUILDER_LABELS: Record<string, string> = {
  tipo: '① Tipo de proyecto',
  audiencia: '② Audiencia principal',
  modelo: '③ Modelo de IA a usar',
  formato: '④ Formato de respuesta',
  etica: '⑤ Restricción ética',
};


// Baraja las opciones de una pregunta y recalcula el índice correcto,
// para que la respuesta correcta no caiga siempre en la misma posición.
const shuffleOpts = <T extends { opts: string[]; correct: number }>(q: T): T => {
  const paired = q.opts.map((opt, i) => ({ opt, isCorrect: i === q.correct }));
  for (let j = paired.length - 1; j > 0; j--) {
    const k = Math.floor(Math.random() * (j + 1));
    [paired[j], paired[k]] = [paired[k], paired[j]];
  }
  return { ...q, opts: paired.map((p) => p.opt), correct: paired.findIndex((p) => p.isCorrect) };
};

// ---------- Tags / cards / hl ----------
const TAG_STYLES: Record<string, { bg: string; color: string; border?: string }> = {
  theory: { bg: '#fef3c7', color: '#92400e' },
  vf: { bg: '#fef9ee', color: '#92400e' },
  activity: { bg: '#eff6ff', color: '#1e40af' },
  sort: { bg: '#f5f3ff', color: '#5b21b6' },
  builder: { bg: '#fef3c7', color: '#d97706' },
  quiz: { bg: '#fef3c7', color: '#92400e' },
  fill: { bg: '#ecfdf5', color: '#065f46' },
  ethics: { bg: '#fdf4ff', color: '#7e22ce' },
  mission: { bg: '#fff7ed', color: '#c2410c' },
  sprint: { bg: '#fef3c7', color: '#92400e' },
  reflect: { bg: '#f1f5f9', color: '#475569' },
};
const CARD_STYLES: Record<string, { bg: string; border: string }> = {
  amber: { bg: '#fffbeb', border: '#fde68a' },
  orange: { bg: '#fff7ed', border: '#fed7aa' },
  red: { bg: '#fff1f2', border: '#fecdd3' },
  sky: { bg: '#f0f9ff', border: '#bae6fd' },
  green: { bg: '#f0fdf4', border: '#bbf7d0' },
  purple: { bg: '#faf5ff', border: '#e9d5ff' },
  slate: { bg: '#f8fafc', border: '#e2e8f0' },
};
const HL_STYLES: Record<string, { border: string; bg: string; color: string }> = {
  blue: { border: '#0ea5e9', bg: '#f0f9ff', color: '#0369a1' },
  green: { border: '#10b981', bg: '#f0fdf4', color: '#065f46' },
  amber: { border: '#f59e0b', bg: '#fffbeb', color: '#92400e' },
  orange: { border: '#d97706', bg: '#fff7ed', color: '#c2410c' },
  red: { border: '#ef4444', bg: '#fff1f2', color: '#991b1b' },
};

function Tag({ variant, children }: { variant: keyof typeof TAG_STYLES; children: React.ReactNode }) {
  const t = TAG_STYLES[variant];
  return (
    <View style={[styles.tag, { backgroundColor: t.bg }]}><Text style={[styles.tagText, { color: t.color }]}>{children}</Text></View>
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
        <View style={{ flex: 1 }}>{title ? <Text style={styles.cardTitle}>{title}</Text> : null}<Text style={styles.cardText}>{children}</Text></View>
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
      <View style={styles.stepNumCircle}><Text style={styles.stepNumText}>{n}</Text></View>
      <Text style={{ flex: 1, fontSize: 12, color: '#334155', lineHeight: 19 }}>{children}</Text>
    </View>
  );
}
function ExCard({ emoji, name, sub, tagText, tagBg, tagColor, open, onPress, children, fact }: { emoji: string; name: string; sub: string; tagText: string; tagBg: string; tagColor: string; open: boolean; onPress: () => void; children: React.ReactNode; fact: string }) {
  return (
    <TouchableOpacity style={[styles.exCard, open && styles.exCardOpen]} onPress={onPress} activeOpacity={0.9}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={styles.exEmoji}><Text style={{ fontSize: 22 }}>{emoji}</Text></View>
        <View style={{ flex: 1 }}><Text style={{ fontWeight: '700', fontSize: 13, color: '#0f172a' }}>{name}</Text><Text style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{sub}</Text></View>
        <MaterialIcons name={open ? 'keyboard-arrow-down' : 'keyboard-arrow-right'} size={20} color="#94a3b8" />
      </View>
      {open && (
        <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#fde68a' }}>
          <View style={{ backgroundColor: tagBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 6 }}><Text style={{ fontSize: 10, fontWeight: '700', color: tagColor }}>{tagText}</Text></View>
          <Text style={{ fontSize: 12, color: '#334155', lineHeight: 19, marginBottom: 8 }}>{children}</Text>
          <Text style={{ fontSize: 11, backgroundColor: '#fffbeb', padding: 9, borderRadius: 8, color: '#92400e', lineHeight: 16, borderWidth: 1, borderColor: '#fde68a80' }}>{fact}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ---------- Componente principal ----------
interface Props {
  navigation?: any;
  setAllowBack?: (allow: boolean) => void;
}

export default function World1Level6({ navigation: propsNavigation, setAllowBack }: Props) {
  const hookNavigation = useNavigation();
  const navigation = propsNavigation || hookNavigation;

  const completeLevel = useGameStore((state) => state.completeLevel);
  const devMode = useGameStore((state) => state.devMode);

  const [step, setStep] = useState(0);
  useReportProgress(step, TOTAL_STEPS);
  const [xp, setXp] = useState(0);
  const [xpToast, setXpToast] = useState<{ amount: number; id: number } | null>(null);

  // Pools aleatorias (fijas al montar)
  const viableTF = useRef(pickN(VIABLE_TF_POOL, 5)).current;
  const tipoItems = useRef(pickN(TIPO_POOL, 7)).current;
  const iterQuiz = useRef(pickN(ITER_QUIZ_POOL, 4).map(shuffleOpts)).current;
  const buildQuiz = useRef(pickN(BUILD_QUIZ_POOL, 5).map(shuffleOpts)).current;
  const ethicsItems = useRef(pickN(PROJ_ETHICS_POOL, 4)).current;
  // Barajado: el pool viene alternado V/F/V/F; sin mezclar, el usuario acierta solo alternando.
  const sprintItems = useRef(pickN(SPRINT_PROJ, SPRINT_PROJ.length)).current;

  // ----- Estados de actividades -----
  const [tfAnswers, setTfAnswers] = useState<{ [key: number]: boolean }>({});
  const [tfChecked, setTfChecked] = useState(false);

  const [tipoPlaced, setTipoPlaced] = useState<{ [key: number]: string }>({});
  const [tipoSelected, setTipoSelected] = useState<number | null>(null);
  const [tipoOk, setTipoOk] = useState(false);
  const [tipoAttempts, setTipoAttempts] = useState(0);
  const [tipoFb, setTipoFb] = useState<{ type: 'correct' | 'wrong'; msg: string } | null>(null);

  const [sortOrder, setSortOrder] = useState<number[]>(() => shuffleDistinct([0, 1, 2, 3, 4]));
  const [sortOk, setSortOk] = useState(false);
  const [sortMarks, setSortMarks] = useState<Record<number, 'ok' | 'bad'>>({});
  const [sortFb, setSortFb] = useState<{ type: 'correct' | 'wrong'; msg: string } | null>(null);

  const [expandedEx, setExpandedEx] = useState<number | null>(null);

  const [builder, setBuilder] = useState({ tipo: '', audiencia: '', modelo: '', formato: '', etica: '' });

  const [iterAns, setIterAns] = useState<{ [key: number]: number }>({});
  const [iterChecked, setIterChecked] = useState(false);

  const [readmeAns, setReadmeAns] = useState<{ [key: string]: number }>({});
  const [readmeDone, setReadmeDone] = useState<Set<string>>(new Set());

  const [ethicsIdx, setEthicsIdx] = useState(0);
  const [ethicsCorrect, setEthicsCorrect] = useState(0);
  const [ethicsDone, setEthicsDone] = useState(false);
  const [ethicsAnswered, setEthicsAnswered] = useState(false);
  const [ethicsSel, setEthicsSel] = useState<string | null>(null);

  const [buildAns, setBuildAns] = useState<{ [key: number]: number }>({});
  const [buildChecked, setBuildChecked] = useState(false);

  const [missionSelected, setMissionSelected] = useState<number | null>(null);
  const [missionPhases, setMissionPhases] = useState({ a: '', b: '', c: '' });

  const [sprintRunning, setSprintRunning] = useState(false);
  const [sprintSec, setSprintSec] = useState(60);
  const [sprintIdx, setSprintIdx] = useState(0);
  const [sprintCorrectCount, setSprintCorrectCount] = useState(0);
  const [sprintOver, setSprintOver] = useState(false);
  const [sprintAnswered, setSprintAnswered] = useState(false);
  const [sprintSel, setSprintSel] = useState<boolean | null>(null);

  const [reflectText, setReflectText] = useState('');

  // ----- Bloqueo de retroceso -----
  const THEORY_STEPS = new Set([1, 3, 5, 7, 9, 11]);
  const allowedBackSteps = new Set([0, 1, 3, 5, 7, 9, 11]);
  const canGoBack = allowedBackSteps.has(step);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack) {
        Alert.alert('Actividad en curso', 'No puedes salir mientras realizas esta actividad.', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Salir', style: 'destructive', onPress: () => exitLevel({ confirm: false }) },
        ]);
        return true;
      }
      return false;
    });
    return () => backHandler.remove();
  }, [canGoBack]);

  // Temporizador del sprint
  useEffect(() => {
    if (!sprintRunning || sprintOver) return;
    if (sprintSec <= 0) { setSprintOver(true); addXP(sprintEarned(sprintCorrectCount)); return; }
    const timer = setTimeout(() => setSprintSec((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [sprintRunning, sprintSec, sprintOver]);

  // ----- M4: drag & drop en web (además del tap-para-colocar) -----
  const tipoPlacedRef = useRef(tipoPlaced);
  useEffect(() => { tipoPlacedRef.current = tipoPlaced; }, [tipoPlaced]);

  useEffect(() => {
    if (Platform.OS !== 'web' || step !== 4) return;
    const cleanups: Array<() => void> = [];
    const setup = setTimeout(() => {
      // Chips arrastrables
      tipoItems.forEach((_, i) => {
        const el = document.getElementById(`l6-chip-${i}`);
        if (!el) return;
        el.setAttribute('draggable', 'true');
        (el.style as any).cursor = 'grab';
        const onDragStart = (e: any) => {
          (window as any)._l6drag = i;
          if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            try { e.dataTransfer.setData('text/plain', String(i)); } catch { /* noop */ }
          }
        };
        el.addEventListener('dragstart', onDragStart);
        cleanups.push(() => el.removeEventListener('dragstart', onDragStart));
      });
      // Zonas receptoras
      (['generador', 'asistente', 'automatizador'] as const).forEach((zone) => {
        const zoneEl = document.getElementById(`l6-zone-${zone}`);
        if (!zoneEl) return;
        const onDragOver = (e: any) => e.preventDefault();
        const onDrop = (e: any) => {
          e.preventDefault();
          const idx = (window as any)._l6drag;
          if (idx == null) return;
          if (tipoPlacedRef.current[idx] !== undefined) return;
          setTipoPlaced((prev) => ({ ...prev, [idx]: zone }));
          setTipoSelected(null);
          setTipoFb(null);
          (window as any)._l6drag = null;
        };
        zoneEl.addEventListener('dragover', onDragOver);
        zoneEl.addEventListener('drop', onDrop);
        cleanups.push(() => { zoneEl.removeEventListener('dragover', onDragOver); zoneEl.removeEventListener('drop', onDrop); });
      });
    }, 60);
    return () => { clearTimeout(setup); cleanups.forEach((c) => c()); };
  }, [step, tipoPlaced, tipoItems]);

  // ----- Helpers -----
  const addXP = (amount: number) => {
    setXp((prev) => prev + amount);
    if (amount > 0) setXpToast((prev) => ({ amount, id: (prev?.id ?? 0) + 1 }));
  };
  const nextStep = () => { if (step < TOTAL_STEPS - 1) setStep(step + 1); };
  const prevStep = () => setStep((s) => s - 1);

  const handleFinish = () => {
    let stars = 0;
    if (xp >= 200) stars = 3;
    else if (xp >= 130) stars = 2;
    else if (xp >= 60) stars = 1;
    completeLevel(6, stars, xp);
    // Fin del Mundo 1 → evaluación del Mundo 1 (luego se abre el Mundo 2, N7-N12)
    router.replace('/eval/1');
  };

  const handleClose = () => {
    if (Platform.OS === 'web') {
      if (!canGoBack) { window.alert('Actividad en curso. Completa la actividad antes de salir.'); return; }
      if (window.confirm('¿Seguro que quieres salir del nivel?')) exitLevel({ confirm: false });
      return;
    }
    if (!canGoBack) { Alert.alert('Actividad en curso', 'Completa la actividad antes de salir.', [{ text: 'OK' }]); return; }
    Alert.alert('Salir', '¿Seguro que quieres salir del nivel?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', onPress: () => exitLevel({ confirm: false }) },
    ]);
  };

  // ----- M2: V/F Viable -----
  const checkTF = () => {
    if (devMode) { setTfChecked(true); addXP(20); return true; }
    if (tfChecked) return true;
    if (Object.keys(tfAnswers).length < viableTF.length) return false;
    setTfChecked(true);
    let correct = 0;
    viableTF.forEach((item, i) => { if (tfAnswers[i] === item.correct) correct++; });
    addXP(correct * 5);
    return false;
  };

  // ----- M4: Clasificar (colocar libre, validar al verificar) -----
  const dropTipoChip = (zone: string) => {
    if (tipoSelected === null) return;
    setTipoPlaced((prev) => ({ ...prev, [tipoSelected]: zone }));
    setTipoSelected(null);
    setTipoFb(null);
  };
  const removeTipoChip = (idx: number) => {
    setTipoPlaced((prev) => { const n = { ...prev }; delete n[idx]; return n; });
  };
  const checkTipo = () => {
    if (devMode) { setTipoOk(true); addXP(20); return true; }
    if (tipoOk) return true;
    const placed = Object.keys(tipoPlaced).length;
    if (placed < tipoItems.length) {
      setTipoFb({ type: 'wrong', msg: `Faltan ${tipoItems.length - placed} tarjetas.` });
      return false;
    }
    setTipoAttempts((prev) => prev + 1);
    let correct = 0;
    const wrong: number[] = [];
    Object.entries(tipoPlaced).forEach(([k, v]) => {
      const i = parseInt(k);
      if (v === tipoItems[i].correct) correct++;
      else wrong.push(i);
    });
    if (correct === tipoItems.length) {
      setTipoOk(true);
      const earned = tipoAttempts === 0 ? 20 : 12;
      addXP(earned);
      setTipoFb({ type: 'correct', msg: `¡Perfecto! +${earned} XP 🎉` });
      return false;
    }
    setTipoFb({ type: 'wrong', msg: `${correct} de ${tipoItems.length} correctos. Los incorrectos vuelven al banco.` });
    const newPlaced = { ...tipoPlaced };
    wrong.forEach((i) => delete newPlaced[i]);
    setTipoPlaced(newPlaced);
    return false;
  };

  // ----- M6: Ordenar -----
  const moveSort = (pos: number, dir: number) => {
    if (sortOk) return;
    const newPos = pos + dir;
    if (newPos < 0 || newPos >= 5) return;
    const newOrder = [...sortOrder];
    [newOrder[pos], newOrder[newPos]] = [newOrder[newPos], newOrder[pos]];
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
      setSortFb({ type: 'correct', msg: '¡Exacto! Ese es el método correcto. +15 XP 🎉' });
      return false;
    }
    setSortFb({ type: 'wrong', msg: 'No está en el orden correcto. Piensa: ¿qué viene lógicamente primero?' });
    return false;
  };

  // ----- M8: Builder (sin XP) -----
  const builderComplete = Object.values(builder).every((v) => v.length > 0);

  // ----- M10: Quiz iteración -----
  const checkIterQuiz = () => {
    if (devMode) { setIterChecked(true); addXP(20); return true; }
    if (iterChecked) return true;
    if (Object.keys(iterAns).length < iterQuiz.length) return false;
    setIterChecked(true);
    let correct = 0;
    iterQuiz.forEach((q, i) => { if (iterAns[i] === q.correct) correct++; });
    addXP(correct * 8);
    return false;
  };

  // ----- M12: README fill -----
  const totalBlanks = README_SECTIONS.reduce((acc, s) => acc + s.blanks.length, 0);
  const selectReadme = (si: number, bi: number, oi: number) => {
    const key = `${si}-${bi}`;
    if (readmeDone.has(key)) return;
    setReadmeAns((prev) => ({ ...prev, [key]: oi }));
    setReadmeDone((prev) => new Set(prev).add(key));
    if (oi === README_SECTIONS[si].blanks[bi].correct) addXP(6);
  };
  const allReadmeDone = totalBlanks === readmeDone.size;

  // ----- M13: Ethics -----
  const answerEthics = (val: 'safe' | 'doubt' | 'bad') => {
    if (ethicsAnswered || ethicsDone) return;
    const item = ethicsItems[ethicsIdx];
    if (val === item.correct) setEthicsCorrect((prev) => prev + 1);
    setEthicsSel(val);
    setEthicsAnswered(true);
  };
  // El feedback permanece visible hasta que el usuario pulse "Entendido".
  const advanceEthics = () => {
    if (ethicsIdx + 1 >= ethicsItems.length) {
      const earned = ethicsCorrect >= 3 ? 20 : ethicsCorrect >= 2 ? 12 : 5;
      addXP(earned);
      setEthicsDone(true);
    } else {
      setEthicsIdx((prev) => prev + 1);
      setEthicsAnswered(false);
      setEthicsSel(null);
    }
  };

  // ----- M14: Quiz construcción -----
  const checkBuildQuiz = () => {
    if (devMode) { setBuildChecked(true); addXP(20); return true; }
    if (buildChecked) return true;
    if (Object.keys(buildAns).length < buildQuiz.length) return false;
    setBuildChecked(true);
    let correct = 0;
    buildQuiz.forEach((q, i) => { if (buildAns[i] === q.correct) correct++; });
    addXP(correct * 8);
    return false;
  };

  // ----- M15: Mission Mode -----
  const missionValid = missionSelected !== null && missionPhases.a.trim().length >= 40 && missionPhases.b.trim().length >= 40 && missionPhases.c.trim().length >= 40;
  const submitMission = () => {
    if (devMode) { addXP(25); return true; }
    if (!missionValid) return false;
    addXP(25);
    return true;
  };

  // ----- M16: Sprint -----
  const sprintEarned = (c: number) => (c >= 10 ? 25 : c >= 7 ? 18 : c >= 4 ? 12 : 5);
  const startSprint = () => {
    setSprintRunning(true);
    setSprintSec(60);
    setSprintIdx(0);
    setSprintCorrectCount(0);
    setSprintOver(false);
    setSprintAnswered(false);
    setSprintSel(null);
  };
  const answerSprint = (val: boolean) => {
    if (sprintOver || sprintAnswered) return;
    const item = sprintItems[sprintIdx];
    const isOk = val === item.correct;
    setSprintAnswered(true);
    setSprintSel(val);
    if (isOk) setSprintCorrectCount((c) => c + 1);
    setTimeout(() => {
      if (sprintIdx + 1 >= sprintItems.length) {
        const newCorrect = sprintCorrectCount + (isOk ? 1 : 0);
        addXP(sprintEarned(newCorrect));
        setSprintOver(true);
      } else {
        setSprintIdx((prev) => prev + 1);
        setSprintAnswered(false);
        setSprintSel(null);
      }
    }, 600);
  };

  // ----- M17: Reflexión -----
  const checkReflect = () => {
    if (devMode) { addXP(15); return true; }
    if (reflectText.trim().length >= 90) { addXP(15); return true; }
    return false;
  };

  // ========== RENDER POR PASO ==========
  const renderStepContent = () => {
    switch (step) {
      case 0:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.iconCircle}><Text style={styles.iconEmoji}>🧪</Text></View>
            <Text style={styles.title}>Tu primera misión real</Text>
            <Text style={styles.subtitle}>Ya tienes los fundamentos. Este nivel es diferente: vas a construir algo real. No solo aprenderás — crearás.</Text>
            <InfoCard variant="amber" icon="🎯" iconBg="#fde68a" title="El objetivo de este nivel">Aprender el método para construir proyectos con LLMs: definir, diseñar, probar, iterar y documentar. Al final tendrás un prompt de proyecto funcional.</InfoCard>
            <InfoCard variant="orange" icon="🆕" iconBg="#fed7aa" title="Dos mecánicas nuevas">Project Builder con 5 selectores que ensamblan un prompt real, y Mission Mode Pro donde completas un proyecto en 3 fases guiadas.</InfoCard>
            <InfoCard variant="slate" icon="⭐" iconBg="#e2e8f0" title="Hasta 260 XP disponibles">18 módulos · ~40-50 min · Nivel 6 de 30</InfoCard>
          </View>
        );

      case 1:
        return (
          <View style={styles.stepContainer}>
            <Tag variant="theory">📖 Módulo 1 de 18 · Proyectos con IA</Tag>
            <Text style={styles.titleL}>¿Qué es un "proyecto con IA"?</Text>
            <Text style={styles.bodyText}>Un proyecto con IA no es descargar una app ni copiar un tutorial. Es usar herramientas de IA —especialmente LLMs— para <Text style={styles.bold}>construir algo útil que resuelve un problema real</Text> para ti o para alguien más.</Text>
            <InfoCard variant="amber" icon="💡" iconBg="#fde68a" title="Qué SÍ es un proyecto con IA">Un asistente que responde preguntas de tu colegio · Un generador de ideas para un curso · Una herramienta que convierte apuntes en resúmenes · Un chatbot para ayudar a tu familia con algo específico.</InfoCard>
            <InfoCard variant="red" icon="❌" iconBg="#fecdd3" title="Qué NO es (todavía)">Una app completa con base de datos, pagos y usuarios — eso requiere más habilidades técnicas. Por ahora nos enfocamos en la parte de inteligencia: el prompt y la lógica del LLM.</InfoCard>
            <View style={{ marginVertical: 8 }}>
              <StepRow n={1}><Text style={styles.bold}>Tiene un problema claro:</Text> "Los estudiantes de 9° no entienden los conceptos de álgebra antes del examen."</StepRow>
              <StepRow n={2}><Text style={styles.bold}>Tiene una audiencia definida:</Text> "Estudiantes de 9° grado en Colombia."</StepRow>
              <StepRow n={3}><Text style={styles.bold}>Tiene una solución concreta:</Text> "Un LLM configurado para explicar álgebra con ejemplos y generar ejercicios de práctica."</StepRow>
              <StepRow n={4}><Text style={styles.bold}>Puede mejorarse:</Text> "Voy a iterar el prompt hasta que las explicaciones sean claras para alguien de 14 años."</StepRow>
            </View>
            <Hl variant="amber"><Text style={styles.bold}>🎯 La habilidad más valiosa:</Text>{'\n'}Saber convertir un problema del mundo real en instrucciones claras para un LLM. Eso es exactamente lo que vas a practicar hoy.</Hl>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContainer}>
            <Tag variant="vf">✅ Módulo 2 de 18 · Viable o no viable</Tag>
            <Text style={styles.titleL}>¿Este proyecto es viable con IA?</Text>
            <Text style={styles.subtitle}>No todos los proyectos son posibles — ni todos los que son posibles son éticos. ¿Cuáles de estos son realmente viables?</Text>
            {viableTF.map((item, i) => {
              const sel = tfAnswers[i];
              const tCorrect = tfChecked && item.correct === true;
              const fCorrect = tfChecked && item.correct === false;
              const tWrong = tfChecked && sel === true && item.correct !== true;
              const fWrong = tfChecked && sel === false && item.correct !== false;
              return (
                <View key={i} style={{ marginBottom: 14 }}>
                  <Text style={styles.tfQuestion}>{i + 1}. {item.stmt}</Text>
                  <View style={{ flexDirection: 'row', gap: 7 }}>
                    <TouchableOpacity style={[styles.tfBtn, sel === true && !tfChecked && styles.tfSelT, tCorrect && styles.tfCorrect, tWrong && styles.tfWrong]} onPress={() => !tfChecked && setTfAnswers((p) => ({ ...p, [i]: true }))} disabled={tfChecked}>
                      <Text style={{ fontWeight: '700', color: tCorrect ? '#166534' : tWrong ? '#991b1b' : sel === true ? '#92400e' : '#334155' }}>✅ Sí, viable</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.tfBtn, sel === false && !tfChecked && styles.tfSelF, fCorrect && styles.tfCorrect, fWrong && styles.tfWrong]} onPress={() => !tfChecked && setTfAnswers((p) => ({ ...p, [i]: false }))} disabled={tfChecked}>
                      <Text style={{ fontWeight: '700', color: fCorrect ? '#166534' : fWrong ? '#991b1b' : sel === false ? '#991b1b' : '#334155' }}>❌ No viable</Text>
                    </TouchableOpacity>
                  </View>
                  {tfChecked && <FeedbackBar type={sel === item.correct ? 'correct' : 'wrong'}>{sel === item.correct ? '✅ ' : '❌ '}{item.explain}</FeedbackBar>}
                </View>
              );
            })}
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContainer}>
            <Tag variant="theory">📖 Módulo 3 de 18 · Tipos de proyectos</Tag>
            <Text style={styles.titleL}>Los 3 tipos de proyectos con LLMs</Text>
            <Text style={styles.subtitle}>Toca cada tipo para ver ejemplos reales que puedes construir hoy.</Text>
            <ExCard emoji="💡" name="Generador" sub="Crea contenido nuevo según instrucciones" tagText="TIPO: GENERADOR" tagBg="#fef3c7" tagColor="#92400e" open={expandedEx === 0} onPress={() => setExpandedEx(expandedEx === 0 ? null : 0)} fact="⚡ Fácil de empezar: define bien el tipo de contenido que quieres y el nivel de detalle. El LLM hace el resto.">
              Le das contexto y parámetros, el LLM genera algo nuevo. <Text style={styles.bold}>Ejemplos reales:</Text>{'\n'}• Generador de ideas para proyectos de ciencias{'\n'}• Creador de nombres creativos para equipos o proyectos{'\n'}• Generador de preguntas de examen sobre cualquier tema{'\n'}• Creador de guiones para videos o podcasts
            </ExCard>
            <ExCard emoji="🤖" name="Asistente" sub="Responde preguntas sobre un tema específico" tagText="TIPO: ASISTENTE" tagBg="#ede9fe" tagColor="#5b21b6" open={expandedEx === 1} onPress={() => setExpandedEx(expandedEx === 1 ? null : 1)} fact="⚡ Clave del éxito: dale al LLM toda la información que necesita en el prompt (horarios, reglas, documentos). Lo que no sabe, no puede responder.">
              El LLM actúa como experto en un dominio específico y responde preguntas. <Text style={styles.bold}>Ejemplos reales:</Text>{'\n'}• Asistente de preguntas frecuentes del colegio{'\n'}• Tutor de matemáticas para un grado específico{'\n'}• Chatbot de orientación para nuevos estudiantes{'\n'}• Asistente de recetas para las restricciones dietéticas de tu familia
            </ExCard>
            <ExCard emoji="⚙️" name="Automatizador" sub="Convierte texto de un formato a otro" tagText="TIPO: AUTOMATIZADOR" tagBg="#dbeafe" tagColor="#1e40af" open={expandedEx === 2} onPress={() => setExpandedEx(expandedEx === 2 ? null : 2)} fact="⚡ Más eficiente: el automatizador hace en segundos lo que toma minutos hacer manualmente. Ideal para tareas repetitivas que haces seguido.">
              Toma contenido existente y lo transforma automáticamente. <Text style={styles.bold}>Ejemplos reales:</Text>{'\n'}• Convertidor de apuntes a flashcards para memorización{'\n'}• Resumidor de artículos largos en puntos clave{'\n'}• Clasificador de tareas por prioridad y materia{'\n'}• Traductor de instrucciones técnicas a lenguaje simple
            </ExCard>
            <Hl variant="orange"><Text style={styles.bold}>🔑 Un proyecto puede ser más de uno:</Text>{'\n'}Un buen asistente de estudio es también un generador (crea preguntas de práctica) y puede automatizar (convierte tus apuntes en resúmenes). Los tipos se combinan en proyectos más completos.</Hl>
          </View>
        );

      case 4:
        return (
          <View style={styles.stepContainer}>
            <Tag variant="activity">🧩 Módulo 4 de 18 · Clasificar</Tag>
            <Text style={styles.titleL}>¿Qué tipo de proyecto es?</Text>
            <Text style={styles.subtitle}>Clasifica cada proyecto según su tipo principal.</Text>
            <InfoCard variant="slate" icon="🔎" iconBg="#e2e8f0" title="">
              🟡 <Text style={styles.bold}>Generador:</Text> crea contenido · 🟣 <Text style={styles.bold}>Asistente:</Text> responde preguntas · 🔵 <Text style={styles.bold}>Automatizador:</Text> transforma texto
            </InfoCard>
            <View style={styles.chipsPool}>
              {tipoItems.map((item, i) => (tipoPlaced[i] === undefined && (
                <TouchableOpacity key={i} {...({ nativeID: `l6-chip-${i}` } as any)} style={[styles.chip, tipoSelected === i && styles.chipActive]} onPress={() => setTipoSelected(tipoSelected === i ? null : i)}>
                  <Text style={{ fontSize: 11, color: tipoSelected === i ? '#92400e' : '#334155', fontWeight: '500' }}>{item.text}</Text>
                </TouchableOpacity>
              )))}
            </View>
            {(['generador', 'asistente', 'automatizador'] as const).map((zone) => {
              const has = Object.values(tipoPlaced).includes(zone);
              const zBorder = zone === 'generador' ? '#d97706' : zone === 'asistente' ? '#7c3aed' : '#0ea5e9';
              const zBg = zone === 'generador' ? '#fffbeb' : zone === 'asistente' ? '#faf5ff' : '#f0f9ff';
              return (
                <TouchableOpacity key={zone} {...({ nativeID: `l6-zone-${zone}` } as any)} style={[styles.dropCol, has && { borderStyle: 'solid', borderColor: zBorder, backgroundColor: zBg }]} onPress={() => dropTipoChip(zone)}>
                  <Text style={[styles.dropHeader, { backgroundColor: zone === 'generador' ? '#fef3c7' : zone === 'asistente' ? '#ede9fe' : '#dbeafe', color: zone === 'generador' ? '#92400e' : zone === 'asistente' ? '#5b21b6' : '#1e40af' }]}>
                    {zone === 'generador' ? '🟡 Generador' : zone === 'asistente' ? '🟣 Asistente' : '🔵 Automatizador'}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                    {Object.entries(tipoPlaced).filter(([, z]) => z === zone).map(([idx]) => (
                      <TouchableOpacity key={idx} style={{ backgroundColor: zone === 'generador' ? '#fef3c7' : zone === 'asistente' ? '#ede9fe' : '#dbeafe', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12 }} onPress={() => removeTipoChip(parseInt(idx))}>
                        <Text style={{ fontSize: 10, fontWeight: '600', color: zone === 'generador' ? '#92400e' : zone === 'asistente' ? '#5b21b6' : '#1e40af' }}>{tipoItems[parseInt(idx)].text} ✕</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </TouchableOpacity>
              );
            })}
            {tipoFb && <FeedbackBar type={tipoFb.type}>{tipoFb.msg}</FeedbackBar>}
          </View>
        );

      case 5:
        return (
          <View style={styles.stepContainer}>
            <Tag variant="theory">📖 Módulo 5 de 18 · El método</Tag>
            <Text style={styles.titleL}>El método de 5 pasos para construir con IA</Text>
            <Text style={styles.bodyText}>Construir un buen proyecto con LLMs no es magia — es un proceso. Seguirlo te ahorra horas de frustración.</Text>
            <View style={{ marginVertical: 8 }}>
              <StepRow n={1}><Text style={styles.bold}>Define el problema:</Text> ¿Qué problema concreto resuelves? ¿Para quién? ¿Qué pasa si no se resuelve? Sé específico — "ayudar a estudiar" es vago; "generar preguntas de práctica de biología para 9° grado" es concreto.</StepRow>
              <StepRow n={2}><Text style={styles.bold}>Diseña el prompt base:</Text> Escribe el primer prompt con rol, contexto, tarea y formato. No tiene que ser perfecto — tiene que ser un punto de partida.</StepRow>
              <StepRow n={3}><Text style={styles.bold}>Prueba y evalúa:</Text> Ejecuta el prompt en un LLM real. ¿La respuesta es útil para el usuario final? ¿Qué falla específicamente?</StepRow>
              <StepRow n={4}><Text style={styles.bold}>Itera y mejora:</Text> Ajusta el prompt según lo que falló. Prueba de nuevo. Repite hasta que funcione bien. Promedio: 3-5 iteraciones para un proyecto simple.</StepRow>
              <StepRow n={5}><Text style={styles.bold}>Documenta y comparte:</Text> Escribe una Ficha del proyecto clara. ¿Qué hace? ¿Para quién? ¿Cómo se usa? ¿Qué LLM usar? ¿Cómo se puede mejorar?</StepRow>
            </View>
            <Hl variant="amber"><Text style={styles.bold}>💡 El paso que más se salta:</Text>{'\n'}El paso 3 — probar con usuarios reales. Es tentador asumir que si a ti te funciona, funciona para todos. Siempre prueba con al menos 3 personas que no saben cómo hiciste el proyecto.</Hl>
            <InfoCard variant="orange" icon="⚡" iconBg="#fed7aa" title="¿Cuánto tarda un proyecto básico?">Con práctica: <Text style={styles.bold}>30-60 minutos</Text> para tener la versión 1 funcionando. Las primeras iteraciones toman más. Con el tiempo, el proceso se vuelve natural e intuitivo.</InfoCard>
          </View>
        );

      case 6:
        return (
          <View style={styles.stepContainer}>
            <Tag variant="sort">↕️ Módulo 6 de 18 · Ordenar</Tag>
            <Text style={styles.titleL}>El método en el orden correcto</Text>
            <Text style={styles.subtitle}>Los 5 pasos del método están mezclados. Ponlos en el orden correcto usando ▲▼.</Text>
            <InfoCard variant="amber" icon="💡" iconBg="#fde68a" title="">
              Piensa: ¿qué necesitas saber antes de poder escribir el prompt? ¿Y qué haces después de que el prompt funciona?
            </InfoCard>
            {sortOrder.map((origIdx, pos) => {
              const mark = sortMarks[pos];
              return (
                <View key={pos} style={[styles.sortItem, mark === 'ok' && styles.sortItemOk, mark === 'bad' && styles.sortItemBad]}>
                  <View style={styles.sortNum}><Text style={{ color: '#fff', fontWeight: '700', fontSize: 11 }}>{pos + 1}</Text></View>
                  <Text style={styles.sortText}><Text style={styles.bold}>{SORT_METODO[origIdx].b}</Text>{SORT_METODO[origIdx].r}</Text>
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

      case 7:
        return (
          <View style={styles.stepContainer}>
            <Tag variant="theory">📖 Módulo 7 de 18 · Prompt de proyecto</Tag>
            <Text style={styles.titleL}>El prompt que define tu proyecto</Text>
            <Text style={styles.bodyText}>El prompt base de un proyecto no es como un prompt casual de conversación. Es más parecido a un <Text style={styles.bold}>contrato de comportamiento</Text> — le dices al LLM exactamente quién es, qué hace y qué límites tiene.</Text>
            <Text style={styles.sectionTitle}>Los 5 ingredientes de un prompt de proyecto</Text>
            <InfoCard variant="amber" icon="👤" iconBg="#fde68a" title="1. Rol">"Eres un asistente de estudio para estudiantes de secundaria en Colombia." Define quién ES el LLM dentro de tu proyecto.</InfoCard>
            <InfoCard variant="orange" icon="🎯" iconBg="#fed7aa" title="2. Propósito">"Tu función es explicar conceptos de manera simple y generar ejercicios de práctica." Define QUÉ hace exactamente.</InfoCard>
            <InfoCard variant="sky" icon="📋" iconBg="#bae6fd" title="3. Formato">"Responde siempre en máximo 3 oraciones claras, sin términos técnicos." Define CÓMO presenta las respuestas.</InfoCard>
            <InfoCard variant="green" icon="🧠" iconBg="#bbf7d0" title="4. Contexto">"Los usuarios son estudiantes de 9° a 11° grado. No tienen conocimiento previo avanzado." Define A QUIÉN le habla.</InfoCard>
            <InfoCard variant="red" icon="🚫" iconBg="#fecdd3" title="5. Restricciones éticas">"No hagas las tareas por el estudiante — guíalos para que encuentren la respuesta solos. Si no sabes algo, di que no sabes." Define lo que NO hace.</InfoCard>
            <Hl variant="orange"><Text style={styles.bold}>💡 El error más común:</Text>{'\n'}Olvidar las restricciones. Sin ellas, el LLM intentará responder TODO, incluyendo cosas que salen del alcance de tu proyecto, lo cual genera respuestas incorrectas o inapropiadas.</Hl>
          </View>
        );

      case 8: {
        const b = builder;
        return (
          <View style={styles.stepContainer}>
            <Tag variant="builder">🆕 Módulo 8 de 18 · Project Builder</Tag>
            <Text style={styles.titleL}>Construye tu prompt de proyecto</Text>
            <Text style={styles.subtitle}>Elige una opción en cada selector. Tu prompt se ensamblará automáticamente — listo para copiar y usar en cualquier LLM.</Text>
            <View style={styles.builderWrap}>
              {(Object.keys(BUILDER_OPTIONS) as Array<keyof typeof builder>).map((key) => (
                <View key={key} style={{ marginBottom: 8 }}>
                  <Text style={styles.builderLabel}>{BUILDER_LABELS[key]}</Text>
                  <View style={styles.optionGrid}>
                    {BUILDER_OPTIONS[key].map((opt, idx) => (
                      <TouchableOpacity key={idx} style={[styles.optionChip, builder[key] === opt && styles.optionChipActive]} onPress={() => setBuilder((prev) => ({ ...prev, [key]: opt }))}>
                        <Text style={{ fontSize: 12, color: builder[key] === opt ? '#92400e' : '#334155', fontWeight: '600' }}>{opt}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </View>
            <View style={[styles.builderOut, builderComplete && { borderColor: '#d97706' }]}>
              {builderComplete ? (
                <>
                  <Text style={styles.builderOutLabel}>✅ Tu prompt de proyecto:</Text>
                  <View>
                    <Text style={[styles.builderOutText, { color: '#7c3aed' }]}>Eres un {b.tipo} diseñado especialmente para {b.audiencia}.</Text>
                    <Text style={[styles.builderOutText, { color: '#0ea5e9' }]}>{'\n'}Debes actuar como una herramienta útil, honesta y amigable que entiende bien su contexto.</Text>
                    <Text style={[styles.builderOutText, { color: '#d97706' }]}>{'\n'}Cuando el usuario te haga una pregunta o solicitud relacionada con tu función, responde de forma útil y directa.</Text>
                    <Text style={[styles.builderOutText, { color: '#10b981' }]}>{'\n'}Formato de respuesta: {b.formato}.</Text>
                    <Text style={[styles.builderOutText, { color: '#ef4444' }]}>{'\n'}Restricción ética: {b.etica}.</Text>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.builderOutLabel}>Tu prompt se irá construyendo aquí...</Text>
                  <Text style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>Selecciona todas las opciones para ver el prompt completo.</Text>
                </>
              )}
            </View>
          </View>
        );
      }

      case 9:
        return (
          <View style={styles.stepContainer}>
            <Tag variant="theory">📖 Módulo 9 de 18 · Iterar</Tag>
            <Text style={styles.titleL}>Iterar: el ciclo que hace la diferencia</Text>
            <Text style={styles.bodyText}>"Iterar" significa probar → evaluar → ajustar → volver a probar. Es el secreto de todos los buenos proyectos de tecnología, incluyendo los de IA.</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 11 }}>
              <View style={[styles.vsCol, { backgroundColor: '#fff1f2' }]}>
                <Text style={[styles.vsHeader, { backgroundColor: '#fecdd3', color: '#991b1b' }]}>❌ Sin iteración</Text>
                {['Escribes un prompt de una vez', 'Lo pruebas tú solo', 'Si no funciona perfecto, abandonas', 'El proyecto nunca mejora', 'Resultado: proyecto mediocre o abandonado'].map((t, i) => <Text key={i} style={styles.vsItem}>{t}</Text>)}
              </View>
              <View style={[styles.vsCol, { backgroundColor: '#f0fdf4' }]}>
                <Text style={[styles.vsHeader, { backgroundColor: '#bbf7d0', color: '#166534' }]}>✅ Con iteración</Text>
                {['Escribes un prompt base rápido', 'Lo pruebas con usuarios reales', 'Cada fallo es información valiosa', 'Ajustas y mejoras continuamente', 'Resultado: proyecto que realmente funciona'].map((t, i) => <Text key={i} style={styles.vsItem}>{t}</Text>)}
              </View>
            </View>
            <Text style={styles.sectionTitle}>Qué evaluar en cada iteración</Text>
            <InfoCard variant="amber" icon="🎯" iconBg="#fde68a" title="Precisión">¿La respuesta es correcta y relevante para la pregunta del usuario?</InfoCard>
            <InfoCard variant="orange" icon="📏" iconBg="#fed7aa" title="Formato">¿El formato es el adecuado? ¿Demasiado largo/corto? ¿Las listas ayudan o estorban?</InfoCard>
            <InfoCard variant="green" icon="😊" iconBg="#bbf7d0" title="Tono">¿El tono es apropiado para la audiencia? ¿Muy formal, muy informal, muy técnico?</InfoCard>
            <InfoCard variant="red" icon="🚧" iconBg="#fecdd3" title="Casos límite">¿Qué pasa cuando el usuario hace una pregunta que está fuera del alcance del proyecto? ¿El LLM lo maneja bien?</InfoCard>
            <Hl variant="amber"><Text style={styles.bold}>💡 La regla del 80/20 de la iteración:</Text>{'\n'}El 80% de las mejoras vienen de las primeras 3 iteraciones. Después de eso, los ajustes son cada vez más pequeños. No esperes perfección — busca "suficientemente bueno para el usuario real".</Hl>
          </View>
        );

      case 10:
        return (
          <View style={styles.stepContainer}>
            <Tag variant="quiz">❓ Módulo 10 de 18 · Quiz de iteración</Tag>
            <Text style={styles.titleL}>¿Cómo iterar bien un proyecto?</Text>
            <Text style={styles.subtitle}>Situaciones reales de proyectos con LLMs. ¿Cuál es la mejor decisión?</Text>
            {iterQuiz.map((q, i) => (
              <View key={i} style={{ marginBottom: 16 }}>
                <Text style={styles.quizQ}>{i + 1}. {q.q}</Text>
                {q.opts.map((opt, j) => {
                  const isSel = iterAns[i] === j;
                  const showCorrect = iterChecked && j === q.correct;
                  const showWrong = iterChecked && isSel && j !== q.correct;
                  return (
                    <TouchableOpacity key={j} style={[styles.qopt, isSel && !iterChecked && styles.qoptSel, showCorrect && styles.qoptCorrect, showWrong && styles.qoptWrong]} onPress={() => setIterAns((p) => ({ ...p, [i]: j }))} disabled={iterChecked}>
                      <View style={[styles.qoptLetter, isSel && !iterChecked && { backgroundColor: '#d97706', borderColor: '#d97706' }, showCorrect && { backgroundColor: '#10b981', borderColor: '#10b981' }, showWrong && { backgroundColor: '#ef4444', borderColor: '#ef4444' }]}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: (isSel && !iterChecked) || showCorrect || showWrong ? '#fff' : '#64748b' }}>{String.fromCharCode(65 + j)}</Text>
                      </View>
                      <Text style={{ flex: 1, fontSize: 12, color: showCorrect ? '#166534' : showWrong ? '#991b1b' : '#334155', lineHeight: 17 }}>{opt}</Text>
                    </TouchableOpacity>
                  );
                })}
                {iterChecked && <FeedbackBar type={iterAns[i] === q.correct ? 'correct' : 'wrong'}>{iterAns[i] === q.correct ? '✅ ' : '❌ '}{q.explain}</FeedbackBar>}
              </View>
            ))}
          </View>
        );

      case 11:
        return (
          <View style={styles.stepContainer}>
            <Tag variant="theory">📖 Módulo 11 de 18 · Ficha del proyecto</Tag>
            <Text style={styles.titleL}>La Ficha del proyecto: la tarjeta de presentación de tu proyecto</Text>
            <Text style={styles.bodyText}>Una Ficha del proyecto es el documento que explica tu proyecto. Es lo primero que alguien ve cuando llega a tu proyecto. Una buena Ficha puede hacer que otros lo usen, lo mejoren o te inviten a colaborar.</Text>
            <View style={[styles.card, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
              <Text style={[styles.cardTitle, { marginBottom: 8 }]}>📄 Plantilla de Ficha del proyecto:</Text>
              <View style={{ backgroundColor: '#fff', borderRadius: 8, padding: 11, borderWidth: 1, borderColor: '#fde68a' }}>
                <Text style={styles.readmeMono}><Text style={{ color: '#d97706', fontWeight: '700' }}># Nombre del proyecto</Text>{'\n'}Una descripción de una oración de qué hace y para quién.{'\n\n'}<Text style={{ color: '#d97706', fontWeight: '700' }}>## ¿Para qué sirve?</Text>{'\n'}Explica el problema que resuelve en 2-3 oraciones.{'\n\n'}<Text style={{ color: '#d97706', fontWeight: '700' }}>## ¿Cómo usarlo?</Text>{'\n'}1. Abre [LLM] y empieza una conversación nueva{'\n'}2. Pega el prompt base al inicio{'\n'}3. Escribe tu pregunta y obtén la respuesta{'\n\n'}<Text style={{ color: '#d97706', fontWeight: '700' }}>## Tecnología</Text>{'\n'}LLM: Claude / ChatGPT / Gemini{'\n'}Prompt base: [incluir el prompt aquí]{'\n\n'}<Text style={{ color: '#d97706', fontWeight: '700' }}>## Mejoras futuras</Text>{'\n'}- Agregar más contexto sobre [tema]{'\n'}- Iterar el formato de respuesta</Text>
              </View>
            </View>
            <Hl variant="orange"><Text style={styles.bold}>💡 Por qué documentar importa:</Text>{'\n'}Sin una Ficha, tu proyecto solo existe en tu cabeza. Con una buena Ficha del proyecto, cualquier persona puede usarlo, cualquier colaborador puede mejorarlo, y tú en 6 meses puedes recordar cómo funciona.</Hl>
          </View>
        );

      case 12:
        return (
          <View style={styles.stepContainer}>
            <Tag variant="fill">📄 Módulo 12 de 18 · Completa la Ficha</Tag>
            <Text style={styles.titleL}>¿Qué va en cada sección?</Text>
            <Text style={styles.subtitle}>Completa las frases de la Ficha del proyecto eligiendo la palabra correcta.</Text>
            {README_SECTIONS.map((section, si) => {
              const sectionDone = section.blanks.every((_, bi) => readmeDone.has(`${si}-${bi}`));
              return (
                <View key={si} style={{ marginBottom: 18 }}>
                  <View style={[styles.card, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
                    <Text style={[styles.cardTitle, { marginBottom: 6 }]}>Sección {si + 1}:</Text>
                    <Text style={styles.fillSentence}>
                      {section.parts.map((part, pi) => {
                        const bi = pi; // blank index between part pi and pi+1
                        const hasBlank = bi < section.blanks.length;
                        const done = readmeDone.has(`${si}-${bi}`);
                        const word = done ? section.blanks[bi].opts[readmeAns[`${si}-${bi}`]] : '_____';
                        const isOk = done && readmeAns[`${si}-${bi}`] === section.blanks[bi].correct;
                        return (
                          <Text key={pi}>
                            {part}
                            {hasBlank && <Text style={{ fontWeight: '700', color: done ? (isOk ? '#166534' : '#991b1b') : '#92400e' }}>{word}</Text>}
                          </Text>
                        );
                      })}
                    </Text>
                  </View>
                  {section.blanks.map((blank, bi) => {
                    const key = `${si}-${bi}`;
                    const done = readmeDone.has(key);
                    const sel = readmeAns[key];
                    return (
                      <View key={bi} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                        {blank.opts.map((opt, oi) => {
                          const showCorrect = done && oi === blank.correct;
                          const showWrong = done && oi === sel && oi !== blank.correct;
                          return (
                            <TouchableOpacity key={oi} style={[styles.fillOpt, showCorrect && styles.fillOptCorrect, showWrong && styles.fillOptWrong]} onPress={() => selectReadme(si, bi, oi)} disabled={done}>
                              <Text style={{ fontSize: 12, fontWeight: '600', color: showCorrect ? '#166534' : showWrong ? '#991b1b' : '#334155' }}>{opt}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    );
                  })}
                  {sectionDone && <FeedbackBar type="correct">✅ {section.explain}</FeedbackBar>}
                </View>
              );
            })}
          </View>
        );

      case 13: {
        const item = ethicsItems[ethicsIdx];
        const ethBtn = (val: 'safe' | 'doubt' | 'bad', emoji: string, label: string, hint: string, color: string, bg: string) => {
          const isSel = ethicsSel === val;
          const isCorrect = ethicsAnswered && item.correct === val;
          const isWrong = ethicsAnswered && isSel && val !== item.correct;
          return (
            <TouchableOpacity style={[styles.ethBtn, { borderColor: color }, isCorrect && { backgroundColor: '#dcfce7', borderColor: '#10b981' }, isWrong && { backgroundColor: '#fff1f2', borderColor: '#ef4444' }, (isSel && !ethicsAnswered) && { backgroundColor: bg }]} onPress={() => answerEthics(val)} disabled={ethicsAnswered}>
              <Text style={{ fontSize: 18 }}>{emoji}</Text>
              <Text style={{ fontSize: 10, fontWeight: '700', textAlign: 'center' }}>{label}</Text>
              <Text style={{ fontSize: 9, color: '#94a3b8' }}>{hint}</Text>
            </TouchableOpacity>
          );
        };
        return (
          <View style={styles.stepContainer}>
            <Tag variant="ethics">⚖️ Módulo 13 de 18 · Ethics Check</Tag>
            <Text style={styles.titleL}>¿Tu proyecto pasa el check ético?</Text>
            <Text style={styles.subtitle}>Antes de publicar, cada proyecto necesita pasar un filtro ético. Evalúa estas situaciones.</Text>
            <Text style={styles.progressLine}>Situación {ethicsIdx + 1} de {ethicsItems.length}</Text>
            <View style={styles.scenarioBox}><Text style={{ fontSize: 12, color: '#334155', lineHeight: 20, fontWeight: '500' }}>{item.scenario}</Text></View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {ethBtn('safe', '✅', 'Seguro', 'Publicar', '#10b981', '#dcfce7')}
              {ethBtn('doubt', '🤔', 'Revisar', 'Ajustar antes', '#f59e0b', '#fef3c7')}
              {ethBtn('bad', '⛔', 'No publicar', 'Problema serio', '#ef4444', '#fff1f2')}
            </View>
            {ethicsAnswered && <FeedbackBar type={ethicsSel === item.correct ? 'correct' : 'wrong'}>{ethicsSel === item.correct ? '✅ ' : '❌ '}{item.explain}</FeedbackBar>}
            {ethicsAnswered && !ethicsDone && (
              <TouchableOpacity style={styles.entendidoBtn} onPress={advanceEthics}>
                <Text style={styles.entendidoBtnText}>{ethicsIdx + 1 >= ethicsItems.length ? 'Entendido, ver resultado →' : 'Entendido →'}</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      }

      case 14:
        return (
          <View style={styles.stepContainer}>
            <Tag variant="quiz">❓ Módulo 14 de 18 · Quiz de construcción</Tag>
            <Text style={styles.titleL}>Construir con IA: ¿qué aprendiste?</Text>
            <Text style={styles.subtitle}>Todo lo del método, el prompt, la iteración y la Ficha del proyecto en un quiz.</Text>
            {buildQuiz.map((q, i) => (
              <View key={i} style={{ marginBottom: 16 }}>
                <Text style={styles.quizQ}>{i + 1}. {q.q}</Text>
                {q.opts.map((opt, j) => {
                  const isSel = buildAns[i] === j;
                  const showCorrect = buildChecked && j === q.correct;
                  const showWrong = buildChecked && isSel && j !== q.correct;
                  return (
                    <TouchableOpacity key={j} style={[styles.qopt, isSel && !buildChecked && styles.qoptSel, showCorrect && styles.qoptCorrect, showWrong && styles.qoptWrong]} onPress={() => setBuildAns((p) => ({ ...p, [i]: j }))} disabled={buildChecked}>
                      <View style={[styles.qoptLetter, isSel && !buildChecked && { backgroundColor: '#d97706', borderColor: '#d97706' }, showCorrect && { backgroundColor: '#10b981', borderColor: '#10b981' }, showWrong && { backgroundColor: '#ef4444', borderColor: '#ef4444' }]}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: (isSel && !buildChecked) || showCorrect || showWrong ? '#fff' : '#64748b' }}>{String.fromCharCode(65 + j)}</Text>
                      </View>
                      <Text style={{ flex: 1, fontSize: 12, color: showCorrect ? '#166534' : showWrong ? '#991b1b' : '#334155', lineHeight: 17 }}>{opt}</Text>
                    </TouchableOpacity>
                  );
                })}
                {buildChecked && <FeedbackBar type={buildAns[i] === q.correct ? 'correct' : 'wrong'}>{buildAns[i] === q.correct ? '✅ ' : '❌ '}{q.explain}</FeedbackBar>}
              </View>
            ))}
          </View>
        );

      case 15: {
        const m = missionSelected !== null ? MISSIONS[missionSelected] : null;
        return (
          <View style={styles.stepContainer}>
            <Tag variant="mission">🆕 Módulo 15 de 18 · Mission Mode Pro</Tag>
            <Text style={styles.titleL}>Elige tu misión</Text>
            <Text style={styles.subtitle}>Selecciona un tipo de proyecto y completa las 3 fases del método. Este es tu primer proyecto de IA real.</Text>
            <InfoCard variant="slate" icon="🗺️" iconBg="#e2e8f0" title="">
              ① Elige el proyecto → ② Define el problema → ③ Escribe el prompt → ④ Evalúa y mejora
            </InfoCard>
            {MISSIONS.map((mi, i) => {
              const isSel = missionSelected === i;
              const disabled = missionSelected !== null && !isSel;
              return (
                <TouchableOpacity key={i} style={[styles.missionCard, isSel && styles.missionCardActive, disabled && { opacity: 0.35 }]} onPress={() => setMissionSelected(i)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <Text style={{ fontSize: 24 }}>{mi.icon}</Text>
                    <Text style={styles.missionName}>{mi.name}</Text>
                  </View>
                  <Text style={styles.missionDesc}>{mi.desc}</Text>
                </TouchableOpacity>
              );
            })}
            {m && (
              <View style={{ marginTop: 4 }}>
                <View style={styles.missionPhase}>
                  <Text style={styles.missionPhaseLabel}>Fase 1 de 3 — Define el problema</Text>
                  <Text style={styles.missionPhasePrompt}>¿Qué problema exacto resuelve tu <Text style={styles.bold}>{m.name}</Text>? Describe en detalle quién lo usaría y qué haría por ellos.</Text>
                  <TextInput style={styles.missionTextarea} placeholder="Ejemplo: Mi asistente ayudaría a estudiantes de 9° grado que tienen dificultad para entender los temas de historia antes de los exámenes. El LLM explicaría los conceptos con analogías y haría preguntas de práctica adaptadas al nivel..." placeholderTextColor="#b8bcc0" value={missionPhases.a} onChangeText={(t) => setMissionPhases((p) => ({ ...p, a: t }))} multiline />
                  <Text style={styles.missionChar}>{missionPhases.a.length} / 40 mín.</Text>
                </View>
                <View style={styles.missionPhase}>
                  <Text style={styles.missionPhaseLabel}>Fase 2 de 3 — Escribe el prompt base</Text>
                  <Text style={styles.missionPhasePrompt}>Escribe el prompt que le darías al LLM para que se comporte como tu <Text style={styles.bold}>{m.name}</Text>. Incluye rol, contexto y restricciones.</Text>
                  <TextInput style={styles.missionTextarea} placeholder="Ejemplo: Eres un asistente de estudio para estudiantes de 9° grado en Colombia. Tu función es explicar temas de historia de forma clara y amigable, usando ejemplos del contexto latinoamericano. Cuando el estudiante lo pida, genera preguntas de práctica de menor a mayor dificultad. No hagas el trabajo del estudiante — guíalo para que llegue a la respuesta solo..." placeholderTextColor="#b8bcc0" value={missionPhases.b} onChangeText={(t) => setMissionPhases((p) => ({ ...p, b: t }))} multiline />
                  <Text style={styles.missionChar}>{missionPhases.b.length} / 40 mín.</Text>
                </View>
                <View style={styles.missionPhase}>
                  <Text style={styles.missionPhaseLabel}>Fase 3 de 3 — Evalúa el resultado</Text>
                  <Text style={styles.missionPhasePrompt}>Si usaras ese prompt, ¿qué crees que funcionaría bien y qué mejorarías en la siguiente iteración?</Text>
                  <TextInput style={styles.missionTextarea} placeholder="Ejemplo: Creo que funcionaría bien porque le di un contexto claro (Colombia, grado 9) y especifiqué que no haga el trabajo sino que guíe. Mejoraría agregando el formato exacto de las preguntas de práctica y pidiendo que incluya la respuesta correcta al final para que pueda verificar..." placeholderTextColor="#b8bcc0" value={missionPhases.c} onChangeText={(t) => setMissionPhases((p) => ({ ...p, c: t }))} multiline />
                  <Text style={styles.missionChar}>{missionPhases.c.length} / 40 mín.</Text>
                </View>
              </View>
            )}
            <Hl variant="amber"><Text style={styles.bold}>💡 No hay respuesta perfecta:</Text>{'\n'}Lo que importa es que las 3 fases estén completas y reflexionadas. Tu prompt será único — igual que tu proyecto.</Hl>
          </View>
        );
      }

      case 16:
        return (
          <View style={styles.stepContainer}>
            <Tag variant="sprint">⚡ Módulo 16 de 18 · Sprint</Tag>
            <Text style={styles.titleL}>Sprint: ¿Buena o mala práctica?</Text>
            <Text style={styles.subtitle}>60 segundos para demostrar que dominas las buenas prácticas de proyectos con IA.</Text>
            {!sprintRunning && !sprintOver && (
              <InfoCard variant="amber" icon="⚡" iconBg="#fde68a" title="">
                Toca <Text style={styles.bold}>"Empezar Sprint"</Text> y responde V/F lo más rápido posible
              </InfoCard>
            )}
            <Text style={[styles.sprintTimer, { color: sprintSec <= 10 ? '#ef4444' : '#d97706' }]}>{sprintSec}</Text>
            <View style={styles.sprintBarWrap}><View style={[styles.sprintBar, { width: `${(sprintSec / 60) * 100}%` }]} /></View>
            {sprintOver ? (
              <View style={[styles.sprintResult, { backgroundColor: sprintCorrectCount >= 8 ? '#dcfce7' : sprintCorrectCount >= 5 ? '#fef3c7' : '#fff1f2' }]}>
                <Text style={{ fontSize: 28, marginBottom: 6 }}>{sprintCorrectCount >= 8 ? '🏆' : sprintCorrectCount >= 5 ? '⭐' : '💪'}</Text>
                <Text style={{ fontSize: 17, fontWeight: '800', marginBottom: 4, color: sprintCorrectCount >= 8 ? '#166534' : sprintCorrectCount >= 5 ? '#92400e' : '#991b1b' }}>{sprintCorrectCount} de {sprintItems.length} correctas</Text>
                <Text style={{ fontSize: 12, color: sprintCorrectCount >= 8 ? '#166534' : sprintCorrectCount >= 5 ? '#92400e' : '#991b1b' }}>+{sprintEarned(sprintCorrectCount)} XP ganados</Text>
              </View>
            ) : sprintRunning ? (
              <View>
                <Text style={styles.sprintScore}>{sprintCorrectCount} correctas de {sprintIdx} respondidas</Text>
                <Text style={styles.sprintQtext}>{sprintItems[sprintIdx].stmt}</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity style={[styles.sprintBtn, sprintAnswered && sprintItems[sprintIdx].correct === true && styles.sprintBtnCorrect, sprintAnswered && sprintSel === true && sprintItems[sprintIdx].correct !== true && styles.sprintBtnWrong]} onPress={() => answerSprint(true)} disabled={sprintAnswered}><Text style={{ fontWeight: '700', fontSize: 12 }}>✅ Verdadero</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.sprintBtn, sprintAnswered && sprintItems[sprintIdx].correct === false && styles.sprintBtnCorrect, sprintAnswered && sprintSel === false && sprintItems[sprintIdx].correct !== false && styles.sprintBtnWrong]} onPress={() => answerSprint(false)} disabled={sprintAnswered}><Text style={{ fontWeight: '700', fontSize: 12 }}>❌ Falso</Text></TouchableOpacity>
                </View>
              </View>
            ) : (
              <Text style={styles.sprintQtext}>Presiona el botón de abajo para empezar</Text>
            )}
          </View>
        );

      case 17:
        return (
          <View style={styles.stepContainer}>
            <Tag variant="reflect">✍️ Módulo 17 de 18 · Reflexión · +15 XP</Tag>
            <Text style={styles.titleL}>Tu proyecto soñado</Text>
            <Text style={styles.subtitle}>Completaste el método. Ahora la pregunta más importante de este nivel.</Text>
            <InfoCard variant="amber" icon="🚀" iconBg="#fde68a" title="Tu reflexión de cierre">
              Responde esto con honestidad:{'\n\n'}<Text style={styles.bold}>¿Cuál es el proyecto con IA que te gustaría construir de verdad?</Text> No importa si es ambicioso. Describe el problema que resuelve, para quién, y por qué te importa ese problema en particular. Cuanto más específico, mejor.
            </InfoCard>
            <TextInput style={styles.reflectArea} placeholder="Ejemplo: Quiero construir un asistente que ayude a mi abuela a entender los resultados de sus exámenes médicos. Ella llega del médico con un papel lleno de términos que no entiende y siempre tiene que esperar semanas para la siguiente cita para preguntar. Si pudiera fotografiar el resultado y preguntarle a un LLM en lenguaje simple qué significa cada cosa, sería enorme para ella..." placeholderTextColor="#b8bcc0" value={reflectText} onChangeText={setReflectText} multiline />
            <Text style={styles.charCount}>{reflectText.trim().length} / 90 mínimo</Text>
            <Hl variant="amber">🎯 <Text style={styles.bold}>Este es tu punto de partida.</Text>{'\n'}En los niveles siguientes vas a ganar las habilidades para construir exactamente lo que describiste. Guarda esta reflexión — en unos meses vas a poder releerla y sonreír.</Hl>
          </View>
        );

      case 18:
        return (
          <View style={styles.completeContainer}>
            <View style={styles.completeBadgeCircle}><Text style={{ fontSize: 44 }}>🧪</Text></View>
            <Text style={styles.completeTitle}>¡Nivel 6 completado!</Text>
            <Text style={styles.completeSub}>Terminaste "Tu primera misión real". Ya sabes definir, diseñar, iterar y documentar proyectos con IA. Ahora las puertas del arco de prompting avanzado están abiertas.</Text>
            <View style={styles.xpEarnedBox}><Text style={{ fontSize: 15, fontWeight: '700', color: '#92400e' }}>⭐ {xp} XP ganados en este nivel</Text></View>
            <View style={{ width: '100%', marginBottom: 14 }}>
              {[
                'Identifico proyectos viables con LLMs y los distingo por tipo',
                'Aplico el método de 5 pasos para construir proyectos con IA',
                'Construyo prompts base con rol, propósito, formato, contexto y restricciones',
                'Itero prompts de forma sistemática basándome en resultados reales',
                'Documento proyectos con una Ficha del proyecto clara y completa',
                'Evalúo proyectos antes de publicar con un filtro ético',
              ].map((skill, i) => (
                <View key={i} style={styles.skillRow}><Text style={styles.skillCheck}>✓</Text><Text style={styles.skillText}>{skill}</Text></View>
              ))}
            </View>
            <View style={styles.nextHint}>
              <Text style={{ fontSize: 12, color: '#334155', lineHeight: 18 }}>🏁 <Text style={styles.bold}>¡Completaste el Mundo 1!</Text>{'\n\n'}Ahora te espera la <Text style={styles.bold}>Evaluación del Mundo 1</Text>, donde repasarás todo lo que aprendiste en los niveles 1 al 6.{'\n\n'}Al superarla se abre el <Text style={styles.bold}>Mundo 2: Domina el Prompting</Text>, con <Text style={styles.bold}>6 niveles nuevos</Text> (N7 a N12) para convertirte en un experto del prompting.</Text>
            </View>
            <View style={{ width: '100%', marginBottom: 14 }}>
              <Text style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>Nivel 6 de 36 completado · Mundo 1 terminado · Sigue la Evaluación del Mundo 1</Text>
              <View style={{ height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}><View style={{ height: '100%', width: '20%', backgroundColor: '#d97706', borderRadius: 3 }} /></View>
            </View>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleFinish}><Text style={styles.primaryBtnText}>Vamos a la evaluación del Mundo 1 →</Text></TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  const progressPercent = (step / (TOTAL_STEPS - 1)) * 100;
  const progLabel = step === 0 ? 'Introducción' : step < TOTAL_STEPS - 1 ? `Módulo ${step} de ${CONTENT_STEPS}` : '¡Nivel completado!';
  const stepsCounter = step === 0 ? '' : step < TOTAL_STEPS - 1 ? `${step} de ${CONTENT_STEPS} módulos completados` : `${CONTENT_STEPS} de ${CONTENT_STEPS} módulos completados`;

  const CHECK_STEPS = [2, 4, 6, 8, 10, 12, 13, 14, 15, 16, 17];
  const showNextBtn = step < TOTAL_STEPS - 1 && !CHECK_STEPS.includes(step);
  const showCheckBtn = CHECK_STEPS.includes(step);
  const showBackButton = step > 0 && THEORY_STEPS.has(step) && showNextBtn;

  const handleMainBtn = () => {
    if (devMode && step !== 8) { /* dev fast paths handled per module */ }
    const handlers: Record<number, (() => boolean) | undefined> = {
      2: checkTF,
      4: checkTipo,
      6: checkSort,
      8: () => builderComplete,
      10: checkIterQuiz,
      12: () => allReadmeDone,
      13: () => ethicsDone,
      14: checkBuildQuiz,
      15: submitMission,
      16: () => sprintOver,
      17: checkReflect,
    };
    const handler = handlers[step];
    if (handler && !handler()) return;
    nextStep();
  };

  const onCheckPress = () => {
    if (step === 16 && !sprintRunning && !sprintOver) { startSprint(); return; }
    handleMainBtn();
  };

  const nextBtnLabel = () => (step === 0 ? '¡Comenzar misión! →' : 'Entendido →');

  const checkBtnLabel = () => {
    switch (step) {
      case 2: return tfChecked ? 'Continuar →' : 'Comprobar';
      case 4: return tipoOk ? 'Continuar →' : 'Verificar clasificación';
      case 6: return sortOk ? 'Continuar →' : 'Verificar orden';
      case 8: return 'Continuar →';
      case 10: return iterChecked ? 'Continuar →' : 'Comprobar respuestas';
      case 12: return 'Continuar →';
      case 13: return ethicsDone ? 'Continuar →' : 'Evalúa cada proyecto';
      case 14: return buildChecked ? 'Continuar →' : 'Comprobar respuestas';
      case 15: return 'Completar misión ✨';
      case 16: return sprintOver ? 'Continuar →' : 'Empezar Sprint ⚡';
      case 17: return 'Enviar reflexión →';
      default: return 'Continuar →';
    }
  };

  const checkDisabled =
    (step === 8 && !builderComplete) ||
    (step === 12 && !allReadmeDone && !devMode) ||
    (step === 13 && !ethicsDone) ||
    (step === 15 && !missionValid && !devMode) ||
    (step === 16 && sprintRunning && !sprintOver) ||
    (step === 17 && reflectText.trim().length < 90 && !devMode) ||
    (step === 2 && !tfChecked && Object.keys(tfAnswers).length < viableTF.length) ||
    (step === 10 && !iterChecked && Object.keys(iterAns).length < iterQuiz.length) ||
    (step === 14 && !buildChecked && Object.keys(buildAns).length < buildQuiz.length);

  const getNote = () => {
    switch (step) {
      case 2: return `Responde las ${viableTF.length} situaciones · hasta ${viableTF.length * 5} XP`;
      case 4: return 'Arrastra un chip a su columna · o toca el chip y luego la columna';
      case 8: return builderComplete ? '¡Prompt listo! Puedes copiarlo y usarlo en cualquier LLM' : 'Completa los 5 selectores para ensamblar tu prompt';
      case 10: return `Responde las ${iterQuiz.length} preguntas · hasta ${iterQuiz.length * 8} XP`;
      case 12: return 'Completa todos los espacios · +6 XP cada uno';
      case 15: return 'Elige un proyecto → completa las 3 fases · +25 XP';
      case 16: return '60 segundos · Verdadero o Falso · hasta 25 XP';
      case 17: return 'Escribe al menos 90 caracteres · +15 XP';
      default: return '';
    }
  };
  const note = getNote();

  return (
    <View style={styles.screen}>
      <View style={styles.progressBar}>
        <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
          <MaterialIcons name="close" size={22} color="#92400e" />
        </TouchableOpacity>
        <View style={styles.progWrap}>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progressPercent}%` }]} /></View>
          <Text style={styles.progLabel}>{progLabel}</Text>
        </View>
        <Text style={styles.xpCounter}>{xp} XP</Text>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {renderStepContent()}
      </ScrollView>

      {xpToast && <XPToast key={xpToast.id} amount={xpToast.amount} onHide={() => setXpToast(null)} />}

      {step < TOTAL_STEPS - 1 && (
        <View style={styles.btnRow}>
          <View style={styles.footerRow}>
            {showBackButton && (
              <TouchableOpacity style={styles.backButton} onPress={prevStep}><Text style={styles.backButtonText}>← Volver</Text></TouchableOpacity>
            )}
            {showNextBtn && (
              <TouchableOpacity style={[styles.primaryBtnFlex, showBackButton && styles.nextBtnFlex]} onPress={handleMainBtn}><Text style={styles.primaryBtnText}>{nextBtnLabel()}</Text></TouchableOpacity>
            )}
            {showCheckBtn && (
              <TouchableOpacity style={[styles.primaryBtnFlex, styles.nextBtnFlex, checkDisabled && { opacity: 0.32 }]} onPress={onCheckPress} disabled={checkDisabled}><Text style={styles.primaryBtnText}>{checkBtnLabel()}</Text></TouchableOpacity>
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

// ---------- Estilos ----------
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  progressBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#fffbeb', backgroundColor: '#fffbeb' },
  closeBtn: { minWidth: 42, minHeight: 42, borderRadius: 10, backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fde68a', justifyContent: 'center', alignItems: 'center' },
  progWrap: { flex: 1, marginHorizontal: 9 },
  progressTrack: { height: 8, backgroundColor: '#fef3c7', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#d97706', borderRadius: 4 },
  progLabel: { fontSize: 10, color: '#94a3b8', marginTop: 3, fontWeight: '500' },
  xpCounter: { ...typography.bold, fontSize: 12, color: '#92400e', backgroundColor: '#fef3c7', paddingHorizontal: 11, paddingVertical: 4, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#fcd34d' },
  body: { flex: 1 },
  bodyContent: { padding: 15, paddingBottom: 30 },
  stepContainer: { flex: 1 },
  iconCircle: { width: 66, height: 66, borderRadius: 20, backgroundColor: '#fef3c7', justifyContent: 'center', alignItems: 'center', marginBottom: 13, alignSelf: 'center' },
  iconEmoji: { fontSize: 34 },
  tag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 11 },
  tagText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  title: { ...typography.extraBold, fontSize: 19, color: '#0f172a', marginBottom: 8, textAlign: 'center', lineHeight: 25 },
  titleL: { ...typography.extraBold, fontSize: 19, color: '#0f172a', marginBottom: 7, lineHeight: 25 },
  subtitle: { ...typography.regular, fontSize: 13, color: '#64748b', marginBottom: 13, lineHeight: 20 },
  bodyText: { ...typography.regular, fontSize: 13, color: '#334155', lineHeight: 22, marginBottom: 11 },
  sectionTitle: { ...typography.bold, fontSize: 13, color: '#0f172a', marginTop: 13, marginBottom: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  bold: { fontWeight: '700', color: '#0f172a' },
  progressLine: { fontSize: 11, color: '#64748b', textAlign: 'center', marginBottom: 6, fontWeight: '500' },
  card: { borderRadius: 14, padding: 13, marginBottom: 9, borderWidth: 1, borderColor: '#e2e8f0' },
  cardRow: { flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  cardIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  cardTitle: { ...typography.bold, fontSize: 12, color: '#0f172a', marginBottom: 3 },
  cardText: { ...typography.regular, fontSize: 12, color: '#334155', lineHeight: 18 },
  readmeMono: { fontFamily: 'monospace', fontSize: 11, color: '#334155', lineHeight: 20 },
  stepNumCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#d97706', justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  stepNumText: { color: '#fff', fontWeight: '700', fontSize: 10 },
  exCard: { backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 8 },
  exCardOpen: { borderColor: '#d97706', backgroundColor: '#fffbeb' },
  exEmoji: { width: 40, height: 40, backgroundColor: '#f1f5f9', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  chipsPool: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 10, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 9, minHeight: 52 },
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1.5, borderColor: '#cbd5e1', backgroundColor: '#fff' },
  chipActive: { borderColor: '#d97706', backgroundColor: '#fef3c7' },
  dropCol: { borderWidth: 2, borderStyle: 'dashed', borderColor: '#cbd5e1', borderRadius: 12, padding: 7, minHeight: 74, backgroundColor: '#fafafa', marginBottom: 7 },
  dropHeader: { fontSize: 10, fontWeight: '700', textAlign: 'center', paddingVertical: 4, paddingHorizontal: 6, borderRadius: 7, marginBottom: 6, textTransform: 'uppercase', overflow: 'hidden' },
  sortItem: { flexDirection: 'row', alignItems: 'center', padding: 11, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1.5, borderColor: '#e2e8f0', marginBottom: 6, gap: 9 },
  sortItemOk: { borderColor: '#86efac', backgroundColor: '#f0fdf4' },
  sortItemBad: { borderColor: '#fca5a5', backgroundColor: '#fff1f2' },
  sortNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#d97706', justifyContent: 'center', alignItems: 'center' },
  sortText: { flex: 1, fontSize: 11, color: '#334155', lineHeight: 16 },
  sortArrows: { flexDirection: 'column', gap: 3 },
  sortBtn: { width: 28, height: 26, borderRadius: 7, borderWidth: 1, borderColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  vsCol: { flex: 1, borderRadius: 12, padding: 11, borderWidth: 1, borderColor: '#e2e8f0' },
  vsHeader: { fontSize: 10, fontWeight: '700', textAlign: 'center', paddingVertical: 4, paddingHorizontal: 6, borderRadius: 7, marginBottom: 7, textTransform: 'uppercase' },
  vsItem: { fontSize: 11, color: '#334155', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', lineHeight: 15 },
  tfQuestion: { fontWeight: '700', fontSize: 12, color: '#0f172a', padding: 11, backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 8, lineHeight: 18 },
  tfBtn: { flex: 1, padding: 12, borderRadius: 11, borderWidth: 2, borderColor: '#e2e8f0', backgroundColor: '#fff', alignItems: 'center', minHeight: 52, justifyContent: 'center' },
  tfSelT: { borderColor: '#d97706', backgroundColor: '#fef3c7' },
  tfSelF: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },
  tfCorrect: { borderColor: '#10b981', backgroundColor: '#dcfce7' },
  tfWrong: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },
  quizQ: { fontWeight: '700', fontSize: 12, color: '#0f172a', padding: 11, backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 9, lineHeight: 18 },
  qopt: { flexDirection: 'row', alignItems: 'flex-start', padding: 11, borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, marginBottom: 6, gap: 9, backgroundColor: '#fff' },
  qoptSel: { borderColor: '#d97706', backgroundColor: '#fef3c7' },
  qoptCorrect: { borderColor: '#10b981', backgroundColor: '#dcfce7' },
  qoptWrong: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },
  qoptLetter: { width: 22, height: 22, borderRadius: 6, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center', marginTop: 1 },
  fillSentence: { fontSize: 13, color: '#334155', lineHeight: 26 },
  fillOpt: { paddingVertical: 8, paddingHorizontal: 13, borderRadius: 10, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  fillOptCorrect: { borderColor: '#10b981', backgroundColor: '#dcfce7' },
  fillOptWrong: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },
  scenarioBox: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, marginBottom: 10 },
  ethBtn: { flex: 1, paddingVertical: 10, paddingHorizontal: 6, borderRadius: 11, borderWidth: 2, backgroundColor: '#fff', alignItems: 'center', minHeight: 56, justifyContent: 'center', gap: 3 },
  entendidoBtn: { backgroundColor: '#d97706', paddingVertical: 12, borderRadius: 11, alignItems: 'center', marginTop: 10 },
  entendidoBtnText: { ...typography.bold, color: '#fff', fontSize: 14 },
  builderWrap: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 14, padding: 13, marginBottom: 11 },
  builderLabel: { fontSize: 10, fontWeight: '700', color: '#92400e', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  optionChip: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: '#fcd34d', backgroundColor: '#fff' },
  optionChipActive: { backgroundColor: '#fef3c7', borderColor: '#d97706' },
  builderOut: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#fcd34d', borderRadius: 12, padding: 12, minHeight: 80 },
  builderOutLabel: { fontSize: 9, fontWeight: '700', color: '#d97706', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 7 },
  builderOutText: { fontSize: 11, fontFamily: 'monospace', lineHeight: 18, fontWeight: '700' },
  missionCard: { borderRadius: 14, borderWidth: 2, borderColor: '#e2e8f0', padding: 13, marginBottom: 10, backgroundColor: '#fff' },
  missionCardActive: { borderColor: '#d97706', backgroundColor: '#fffbeb' },
  missionName: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  missionDesc: { fontSize: 11, color: '#64748b', lineHeight: 16 },
  missionPhase: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 12, padding: 12, marginBottom: 10 },
  missionPhaseLabel: { fontSize: 10, fontWeight: '700', color: '#d97706', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  missionPhasePrompt: { fontSize: 12, color: '#334155', lineHeight: 18, marginBottom: 8, fontWeight: '500' },
  missionTextarea: { minHeight: 80, padding: 10, borderRadius: 9, borderWidth: 1.5, borderColor: '#fde68a', fontSize: 12, color: '#334155', lineHeight: 19, backgroundColor: '#fafafa', textAlignVertical: 'top' },
  missionChar: { fontSize: 10, color: '#94a3b8', textAlign: 'right', marginTop: 3 },
  sprintTimer: { fontSize: 36, fontWeight: '800', textAlign: 'center', marginTop: 8, marginBottom: 4 },
  sprintBarWrap: { height: 8, backgroundColor: '#e2e8f0', borderRadius: 4, overflow: 'hidden', marginBottom: 12 },
  sprintBar: { height: '100%', borderRadius: 4, backgroundColor: '#d97706' },
  sprintScore: { textAlign: 'center', fontSize: 12, color: '#64748b', marginBottom: 6 },
  sprintQtext: { fontSize: 13, fontWeight: '700', color: '#0f172a', padding: 12, backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 9, lineHeight: 20, minHeight: 52 },
  sprintBtn: { flex: 1, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 11, borderWidth: 2, borderColor: '#e2e8f0', backgroundColor: '#fff', alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  sprintBtnCorrect: { borderColor: '#10b981', backgroundColor: '#dcfce7' },
  sprintBtnWrong: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },
  sprintResult: { padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  reflectArea: { minHeight: 110, padding: 11, borderRadius: 10, borderWidth: 1.5, borderColor: '#e2e8f0', fontSize: 13, color: '#334155', lineHeight: 20, backgroundColor: '#fafafa', textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: '#94a3b8', textAlign: 'right', marginTop: 4 },
  completeContainer: { alignItems: 'center', padding: 8 },
  completeBadgeCircle: { width: 86, height: 86, borderRadius: 24, backgroundColor: '#fde68a', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  completeTitle: { ...typography.extraBold, fontSize: 21, color: '#0f172a', marginBottom: 6, textAlign: 'center' },
  completeSub: { ...typography.regular, fontSize: 12, color: '#64748b', textAlign: 'center', lineHeight: 18, marginBottom: 16 },
  xpEarnedBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 11, paddingHorizontal: 20, backgroundColor: '#fef9c3', borderRadius: 12, marginBottom: 14, borderWidth: 1, borderColor: '#fcd34d', width: '100%' },
  skillRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: '#f0fdf4', borderRadius: 9, borderWidth: 1, borderColor: '#bbf7d0', marginBottom: 6 },
  skillCheck: { color: '#10b981', fontSize: 14, marginTop: 1 },
  skillText: { flex: 1, fontSize: 11, color: '#166534', lineHeight: 15, fontWeight: '500' },
  nextHint: { padding: 11, backgroundColor: '#f8fafc', borderRadius: 10, width: '100%', borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 13 },
  btnRow: { paddingHorizontal: 13, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', backgroundColor: '#fafcff' },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primaryBtn: { backgroundColor: '#d97706', paddingVertical: 13, borderRadius: 12, alignItems: 'center', width: '100%', minHeight: 48, justifyContent: 'center' },
  primaryBtnFlex: { flex: 1, backgroundColor: '#d97706', paddingVertical: 13, borderRadius: 12, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  primaryBtnText: { ...typography.bold, color: '#fff', fontSize: 14 },
  nextBtnFlex: { flex: 1 },
  backButton: { backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#e2e8f0', paddingVertical: 13, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  backButtonText: { ...typography.bold, color: '#64748b', fontSize: 14 },
  btnNote: { fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 5 },
  dotsRow: { flexDirection: 'row', gap: 3, justifyContent: 'center', flexWrap: 'wrap', paddingTop: 9 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#cbd5e1' },
  dotActive: { backgroundColor: '#d97706', width: 16 },
  dotDone: { backgroundColor: '#fcd34d' },
  stepsCounter: { fontSize: 10, color: '#94a3b8', textAlign: 'center', paddingTop: 4 },
});
