import { exitLevel } from '../utils/exitLevel';
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
import { router } from 'expo-router';
import { useGameStore } from '../store/gameStore';
import { colors, typography } from '../theme';
import XPToast from '../components/XPToast';

// ---------- Tipos y constantes ----------
type DiagItem = {
  prompt: string;
  missing: string[];
  allOpts: { id: string; label: string; text: string }[];
  correct: string[];
  explain: string;
};

type RefineScenario = {
  subject: string;
  start: string;
  rounds: {
    question: string;
    opts: { text: string; quality: number; type: string }[];
  }[];
};

type RoleItem = {
  situation: string;
  opts: string[];
  correct: number;
  explain: string;
};

type EthicsItem = {
  prompt: string;
  correct: string;
  explain: string;
};

type DetectItem = {
  prompt: string;
  response: string;
  question: string;
  opts: string[];
  correct: number;
  explain: string;
};

type SprintItem = {
  situation: string;
  opts: string[];
  correct: number;
};

type TFItem = {
  stmt: string;
  correct: boolean;
  explain: string;
};

type MissionSubject = {
  emoji: string;
  name: string;
  desc: string;
  fields: string[];
};

const TOTAL_STEPS = 20; // 0:intro + 18 módulos + 1:complete
const CONTENT_STEPS = 18;

// Función helper
const pickN = <T,>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};

// Baraja las opciones de una MCQ y remapea el índice correcto (evita que la
// respuesta correcta caiga siempre en la misma posición — estándar v2.2 §5/§27).
const shuffleMCQ = <T extends { opts: string[]; correct: number }>(item: T): T => {
  const paired = item.opts.map((opt, i) => ({ opt, isCorrect: i === item.correct }));
  for (let j = paired.length - 1; j > 0; j--) {
    const k = Math.floor(Math.random() * (j + 1));
    [paired[j], paired[k]] = [paired[k], paired[j]];
  }
  return { ...item, opts: paired.map((p) => p.opt), correct: paired.findIndex((p) => p.isCorrect) };
};

// ===================== POOLS DE DATOS =====================

// Módulo 5 — Diagnóstico: qué le falta al prompt (pool 8 → 4)
const DIAG_POOL: DiagItem[] = [
  {
    prompt: '"Escribe algo sobre el cambio climático"',
    missing: ['ctx', 'inst', 'fmt'],
    allOpts: [
      { id: 'rol', label: '🎭 Rol', text: 'No dice quién debe ser la IA (experto, periodista, maestro...)' },
      { id: 'ctx', label: '📋 Contexto', text: 'No especifica para qué ni para quién es el texto' },
      { id: 'inst', label: '🎯 Instrucción', text: 'La instrucción es demasiado vaga — ¿qué tipo de texto? ¿qué aspecto?' },
      { id: 'fmt', label: '📐 Formato', text: 'No dice qué extensión, estructura ni tono usar' },
    ],
    correct: ['ctx', 'inst', 'fmt'],
    explain: 'Este prompt solo tiene una instrucción muy vaga. Le faltan: contexto (¿para qué?), instrucción clara (¿qué aspecto del cambio climático?) y formato (¿cuántas palabras? ¿qué tono?).',
  },
  {
    prompt: '"Actúa como un chef profesional con 20 años de experiencia en cocina mediterránea."',
    missing: ['inst', 'fmt'],
    allOpts: [
      { id: 'rol', label: '🎭 Rol', text: 'No define el rol de la IA' },
      { id: 'ctx', label: '📋 Contexto', text: 'No hay información de fondo sobre la situación' },
      { id: 'inst', label: '🎯 Instrucción', text: 'Tiene rol pero no dice qué debe hacer el chef' },
      { id: 'fmt', label: '📐 Formato', text: 'No especifica cómo quiere que responda' },
    ],
    correct: ['inst', 'fmt'],
    explain: 'Tiene un buen rol, pero solo eso. Falta la instrucción (¿qué debe hacer?) y el formato (¿una receta? ¿un consejo? ¿cuántos pasos?).',
  },
  {
    prompt: '"Soy un estudiante de 10° grado preparando mi examen de química de mañana. Necesito entender los tipos de enlace químico."',
    missing: ['fmt'],
    allOpts: [
      { id: 'rol', label: '🎭 Rol', text: 'No define el rol de la IA' },
      { id: 'ctx', label: '📋 Contexto', text: 'No hay contexto sobre la situación' },
      { id: 'inst', label: '🎯 Instrucción', text: 'No queda claro qué debe hacer la IA' },
      { id: 'fmt', label: '📐 Formato', text: 'No dice cómo quiere la explicación: ¿con ejemplos? ¿con tabla comparativa? ¿cuánto detalle?' },
    ],
    correct: ['fmt'],
    explain: 'Tiene buen contexto e instrucción implícita, pero falta el formato. ¿Quieres una explicación corta? ¿Un cuadro comparativo? ¿Ejemplos con objetos cotidianos? Especificarlo mejora mucho el resultado.',
  },
  {
    prompt: '"Traduce este texto al inglés: [texto aquí]. El resultado debe estar en formato de tabla con columna en español y columna en inglés, párrafo por párrafo."',
    missing: [],
    allOpts: [
      { id: 'rol', label: '🎭 Rol', text: 'No define el rol de la IA explícitamente' },
      { id: 'ctx', label: '📋 Contexto', text: 'No hay contexto sobre por qué se necesita la traducción' },
      { id: 'inst', label: '🎯 Instrucción', text: 'La instrucción no es lo suficientemente clara' },
      { id: 'fmt', label: '📐 Formato', text: 'No especifica el formato de salida' },
    ],
    correct: [],
    explain: '¡Este prompt está bien construido! Tiene instrucción clara (traducir), referencia al contenido ([texto]), y formato específico (tabla con columnas). A veces el rol no es necesario si la instrucción es concreta.',
  },
  {
    prompt: '"Como coach de productividad para estudiantes universitarios, crea un plan de estudio semanal para alguien que trabaja de 8am a 5pm y tiene exámenes en 3 semanas."',
    missing: [],
    allOpts: [
      { id: 'rol', label: '🎭 Rol', text: 'Le falta un rol más específico' },
      { id: 'ctx', label: '📋 Contexto', text: 'Falta más contexto sobre las materias' },
      { id: 'inst', label: '🎯 Instrucción', text: 'La instrucción no es clara' },
      { id: 'fmt', label: '📐 Formato', text: 'No especifica el formato del plan' },
    ],
    correct: [],
    explain: '¡Excelente prompt! Tiene rol (coach de productividad), contexto (estudiante universitario que trabaja, exámenes en 3 semanas) e instrucción clara (plan de estudio semanal). Es completo y bien estructurado.',
  },
  {
    prompt: '"Explícame machine learning"',
    missing: ['rol', 'ctx', 'inst', 'fmt'],
    allOpts: [
      { id: 'rol', label: '🎭 Rol', text: 'No dice quién debe ser la IA' },
      { id: 'ctx', label: '📋 Contexto', text: 'No hay contexto sobre el nivel del estudiante ni para qué lo necesita' },
      { id: 'inst', label: '🎯 Instrucción', text: 'Demasiado vago — ¿qué aspecto de machine learning?' },
      { id: 'fmt', label: '📐 Formato', text: 'No especifica extensión, nivel técnico ni estructura' },
    ],
    correct: ['rol', 'ctx', 'inst', 'fmt'],
    explain: 'Este es el peor caso posible — no tiene ninguno de los 4 ingredientes. Resultado: una respuesta genérica de enciclopedia que probablemente no te sirva para lo que necesitas.',
  },
  {
    prompt: '"Actúa como un entrenador personal especializado en fitness para adolescentes. Mi hijo de 14 años quiere empezar a hacer ejercicio pero nunca ha ido al gimnasio. Dame 5 ejercicios de iniciación para hacer en casa, sin equipamiento, con instrucciones paso a paso para cada uno."',
    missing: [],
    allOpts: [
      { id: 'rol', label: '🎭 Rol', text: 'El rol podría ser más específico' },
      { id: 'ctx', label: '📋 Contexto', text: 'Falta más contexto sobre el nivel de condición física' },
      { id: 'inst', label: '🎯 Instrucción', text: 'La instrucción no es suficientemente clara' },
      { id: 'fmt', label: '📐 Formato', text: 'No especifica el formato de los ejercicios' },
    ],
    correct: [],
    explain: '¡Prompt 10/10! Tiene rol claro (entrenador personal para adolescentes), contexto completo (14 años, principiante, en casa, sin equipamiento), instrucción precisa (5 ejercicios de iniciación) y formato específico (paso a paso para cada uno).',
  },
  {
    prompt: '"Escribe un correo para mi jefe"',
    missing: ['ctx', 'inst', 'fmt'],
    allOpts: [
      { id: 'rol', label: '🎭 Rol', text: 'No dice en qué rol debería estar la IA' },
      { id: 'ctx', label: '📋 Contexto', text: 'No hay contexto: ¿cuál es el tema? ¿qué relación hay con el jefe?' },
      { id: 'inst', label: '🎯 Instrucción', text: 'No dice el propósito del correo: ¿pedir permiso? ¿reportar? ¿quejarse?' },
      { id: 'fmt', label: '📐 Formato', text: 'No especifica tono (formal/informal), extensión ni estructura' },
    ],
    correct: ['ctx', 'inst', 'fmt'],
    explain: 'Faltan tres ingredientes clave: contexto (¿de qué trata?), instrucción (¿cuál es el objetivo del correo?) y formato (¿formal? ¿corto? ¿con qué estructura?). El rol es opcional aquí.',
  },
];

// Módulo 7 — Refinement: mejora el prompt en 3 rondas
const REFINE_SCENARIOS: RefineScenario[] = [
  {
    subject: 'Pedir ayuda para un trabajo escolar',
    start: 'Ayúdame con mi trabajo de biología',
    rounds: [
      {
        question: 'Ronda 1: ¿Cómo mejorarías este prompt primero?',
        opts: [
          { text: 'Especifica el tema exacto: "Ayúdame con mi trabajo de biología sobre la fotosíntesis"', quality: 40, type: 'best' },
          { text: 'Escríbelo en inglés para que la IA entienda mejor', quality: 20, type: 'ok' },
          { text: 'Agrega más signos de exclamación: "¡¡Ayúdame con mi trabajo de biología!!"', quality: 20, type: 'bad' },
        ],
      },
      {
        question: 'Ronda 2: Ya tienes el tema. ¿Qué agregas ahora?',
        opts: [
          { text: 'Agrega tu nivel y qué necesitas: "Soy de 9° grado y necesito explicar el proceso paso a paso"', quality: 75, type: 'best' },
          { text: 'Agrega un emoji de planta para que sea más amigable 🌱', quality: 42, type: 'bad' },
          { text: 'Repite la instrucción dos veces para enfatizar', quality: 45, type: 'ok' },
        ],
      },
      {
        question: 'Ronda 3: ¿Cuál es el toque final?',
        opts: [
          { text: 'Especifica el formato: "En máximo 300 palabras, con un ejemplo real de una planta colombiana"', quality: 100, type: 'best' },
          { text: 'Agrega "por favor" al inicio para ser más educado', quality: 78, type: 'ok' },
          { text: 'Elimina el contexto para que sea más corto', quality: 60, type: 'bad' },
        ],
      },
    ],
  },
  {
    subject: 'Pedir consejos de estudio',
    start: 'Dame tips para estudiar',
    rounds: [
      {
        question: 'Ronda 1: ¿Por dónde empiezas a mejorar este prompt?',
        opts: [
          { text: 'Define para qué materia y situación: "Dame tips para estudiar álgebra con examen en 2 días"', quality: 45, type: 'best' },
          { text: 'Ponlo todo en mayúsculas para que la IA lo vea como urgente', quality: 20, type: 'bad' },
          { text: 'Agrega "buenos" antes de tips: "Dame buenos tips para estudiar"', quality: 25, type: 'ok' },
        ],
      },
      {
        question: 'Ronda 2: Ya tienes contexto. ¿Qué más necesitas?',
        opts: [
          { text: 'Agrega tu situación real: "Soy de 10° grado, entiendo conceptos pero me trabo en los ejercicios"', quality: 72, type: 'best' },
          { text: 'Pregunta también tips de vida en general para aprovechar', quality: 50, type: 'ok' },
          { text: 'Acorta el prompt porque la IA prefiere instrucciones cortas', quality: 35, type: 'bad' },
        ],
      },
      {
        question: 'Ronda 3: El toque final para un prompt perfecto:',
        opts: [
          { text: 'Especifica el output: "Dame 5 técnicas concretas, con un ejemplo de cómo aplicar cada una en álgebra"', quality: 100, type: 'best' },
          { text: 'Agrega una fecha límite: "respóndeme antes de las 8pm"', quality: 75, type: 'ok' },
          { text: 'Elimina el contexto personal, es información innecesaria', quality: 55, type: 'bad' },
        ],
      },
    ],
  },
];

// Módulo 9 — Role Picker (pool 8 → 6 escenarios)
const ROLE_POOL: RoleItem[] = [
  { situation: 'Necesitas entender un concepto de física cuántica que se te hace imposible', opts: ['Profesor de física', 'Chef profesional', 'Abogado', 'Coach deportivo'], correct: 0, explain: 'Un profesor sabe cómo adaptar explicaciones complejas a diferentes niveles. Pedirle a un chef que explique física cuántica daría resultados absurdos.' },
  { situation: 'Quieres recibir retroalimentación honesta y detallada sobre el código que escribiste', opts: ['Médico', 'Senior developer', 'DJ profesional', 'Historiador'], correct: 1, explain: 'Un desarrollador senior sabe revisar código, identificar errores, sugerir mejores prácticas y explicar el razonamiento detrás de cada cambio.' },
  { situation: 'Tienes que negociar un mejor precio con un proveedor para tu emprendimiento', opts: ['Cocinero', 'Negociador experto en ventas B2B', 'Poeta', 'Veterinario'], correct: 1, explain: 'Un negociador experto conoce las tácticas de negociación, cómo manejar objeciones y cómo lograr acuerdos beneficiosos para ambas partes.' },
  { situation: 'Quieres que tu ensayo de historia suene más académico y bien argumentado', opts: ['Instructor de yoga', 'Editor académico especializado en ciencias sociales', 'Diseñador gráfico', 'Piloto'], correct: 1, explain: 'Un editor académico conoce las convenciones del lenguaje académico, cómo estructurar argumentos sólidos y cómo citar correctamente.' },
  { situation: 'Necesitas planear una dieta saludable para un mes con presupuesto limitado', opts: ['Nutricionista clínico', 'Arquitecto', 'Programador', 'Cantante'], correct: 0, explain: 'Un nutricionista sabe combinar alimentos para cumplir requerimientos nutricionales, considerando costos y disponibilidad de ingredientes.' },
  { situation: 'Quieres crear una estrategia de contenido para tu cuenta de Instagram', opts: ['Fontanero', 'Experto en marketing digital y redes sociales', 'Geólogo', 'Contador'], correct: 1, explain: 'Un experto en marketing digital conoce algoritmos, tendencias de contenido, frecuencia de publicación y cómo crecer una audiencia de manera orgánica.' },
  { situation: 'Necesitas que te expliquen tus derechos si te multan injustamente como ciclista', opts: ['Abogado especializado en movilidad urbana', 'Médico', 'Profesor de matemáticas', 'Chef'], correct: 0, explain: 'Un abogado especializado conoce la legislación vial, los derechos del ciudadano y los procesos para impugnar multas injustas.' },
  { situation: 'Quieres mejorar tu pronunciación en inglés para una entrevista de trabajo', opts: ['Arqueólogo', 'Coach de pronunciación de inglés americano', 'Físico', 'Diseñador de modas'], correct: 1, explain: 'Un coach de pronunciación conoce los fonemas del inglés, los errores comunes de hablantes de español y técnicas específicas para mejorar rápidamente.' },
];

// Módulo 10 — Ethics Judge (pool 8 → 5)
const ETHICS_POOL: EthicsItem[] = [
  { prompt: '"Actúa como mi profesor y escribe mi ensayo de historia completo sobre la Revolución Francesa para entregarlo como propio"', correct: 'prob', explain: 'Pedir a la IA que haga trabajo académico para presentarlo como propio es trampa académica. Además, no aprenderás nada. Usar la IA para entender y mejorar tu ensayo: seguro. Usarla para reemplazarte: problemático.' },
  { prompt: '"Explícame cómo funcionan los virus informáticos para entender mejor la ciberseguridad"', correct: 'safe', explain: 'Aprender sobre ciberseguridad es completamente legítimo. Entender cómo funcionan las amenazas es esencial para defenderse de ellas. Esto es educativo, no malicioso.' },
  { prompt: '"¿Cómo puedo hackear la cuenta de Instagram de mi ex para ver sus mensajes privados?"', correct: 'prob', explain: 'Acceder sin permiso a cuentas ajenas es ilegal en prácticamente todos los países y viola la privacidad de otra persona. Ningún uso de la IA justifica esto.' },
  { prompt: '"Dame ideas originales para un proyecto de arte digital sobre inteligencia artificial"', correct: 'safe', explain: 'Pedir ideas creativas y luego desarrollarlas tú mismo es exactamente para lo que los LLMs son herramientas perfectas. Creativo, educativo y ético.' },
  { prompt: '"Escribe un mensaje de texto haciéndote pasar por el profesor García para decirle a mis compañeros que el examen fue cancelado"', correct: 'prob', explain: 'Suplantar la identidad de otra persona para difundir información falsa puede causar daño real a tus compañeros y a ti. Es engaño y potencialmente fraude.' },
  { prompt: '"Ayúdame a entender los argumentos de ambos lados sobre el aborto para un debate escolar"', correct: 'safe', explain: 'Pedir información balanceada sobre temas polémicos para debatir es un uso excelente de los LLMs. Entender múltiples perspectivas es pensamiento crítico.' },
  { prompt: '"Crea un perfil falso de una persona real con información inventada para publicar en redes"', correct: 'prob', explain: 'Crear perfiles falsos y difundir desinformación sobre personas reales es ciberacoso, puede constituir difamación y viola los términos de uso de cualquier plataforma.' },
  { prompt: '"Genera ideas para un negocio de comida saludable que pueda montar con $500.000 COP"', correct: 'safe', explain: 'Usar la IA como consultor de negocios para generar ideas y estrategias es uno de sus mejores usos. Completamente ético y muy valioso para emprendedores jóvenes.' },
];

// Módulo 13 — Detective: error en el prompt (pool 8 → 4)
const DETECT_POOL: DetectItem[] = [
  { prompt: '"Tradúceme esto"', response: '¿Qué deseas que traduzca? No veo ningún texto adjunto.', question: '¿Por qué falló este prompt?', opts: ['El LLM no sabe traducir', 'Falta el texto que se quiere traducir', 'El LLM solo traduce al inglés', 'El prompt debería estar en el idioma de destino'], correct: 1, explain: 'La instrucción olvidó incluir el contenido a traducir. Un prompt de traducción siempre necesita: el texto fuente + el idioma de destino.' },
  { prompt: '"Escríbeme un poema"', response: 'Aquí te dejo un poema sobre el amor eterno bajo la luna de verano... [poema genérico de 20 estrofas]', question: 'El estudiante quería un haiku de 3 líneas sobre tecnología. ¿Qué falló?', opts: ['El LLM no sabe escribir haikus', 'No especificó el tipo de poema ni el tema', 'El LLM siempre escribe sobre amor', 'Los poemas no se pueden pedir a un LLM'], correct: 1, explain: 'Sin especificar tipo (haiku), tema (tecnología) y extensión (3 líneas), el LLM inventa su propia interpretación. La ambigüedad produce resultados genéricos e inútiles.' },
  { prompt: '"Como experto en nutrición, dame un plan de alimentación para bajar de peso rápido, con comidas deliciosas, económicas, fáciles de preparar, sin gluten, sin lactosa, vegano, y que me haga sentir muy lleno."', response: 'Aquí un plan que intenta cumplir todos los requisitos... [respuesta inconsistente y contradictoria]', question: '¿Cuál es el problema con este prompt?', opts: ['Es demasiado corto', 'Tiene demasiadas restricciones contradictorias que hacen imposible un resultado coherente', 'El rol de nutricionista no funciona bien', 'Falta el formato de salida'], correct: 1, explain: 'Demasiadas restricciones simultáneas y parcialmente contradictorias (bajar peso rápido + sentirse muy lleno + vegano + sin gluten + sin lactosa + económico) abruman al modelo y producen respuestas inconsistentes. Prioriza los requisitos más importantes.' },
  { prompt: '"Explícame todo sobre la historia de Colombia"', response: 'Colombia fue habitada por comunidades indígenas miles de años antes de la llegada de los españoles en 1499... [respuesta de 3000 palabras]', question: 'El estudiante necesitaba un resumen de 5 puntos para una presentación de 2 minutos. ¿Qué faltó?', opts: ['La IA no sabe historia de Colombia', 'El prompt no especificó el formato ni la extensión deseada', 'La instrucción estaba en el idioma equivocado', 'El tema es demasiado amplio para un LLM'], correct: 1, explain: 'La instrucción era válida pero sin formato definido, la IA generó una respuesta enciclopédica. Siempre especifica: ¿cuántos puntos? ¿qué extensión? ¿para qué contexto?' },
  { prompt: '"¿Cuál es el resultado del partido de hoy?"', response: 'No tengo acceso a información en tiempo real, así que no puedo saber los resultados de partidos de hoy.', question: '¿Por qué el LLM no puede responder esto?', opts: ['Los LLMs no saben de deportes', 'Los LLMs no tienen acceso a internet en tiempo real para datos actuales', 'El prompt estaba mal escrito', 'Se necesita un prompt más largo para preguntas deportivas'], correct: 1, explain: 'Los LLMs tienen una "fecha de corte" en su conocimiento y no acceden a internet. Para datos en tiempo real (resultados, precios, noticias), usa Google, no un LLM.' },
  { prompt: '"Actúa como mi novia y habla conmigo de forma romántica toda la conversación"', response: 'Puedo conversar contigo, pero mantener un rol romántico extendido no es algo que haga bien ni que sea apropiado para mí.', question: '¿Por qué algunos LLMs rechazan este tipo de prompt?', opts: ['Los LLMs no entienden el concepto de romance', 'Los LLMs tienen límites éticos para evitar relaciones parasociales y dependencia emocional', 'Los LLMs no pueden mantener un rol por más de un mensaje', 'El prompt está mal escrito gramaticalmente'], correct: 1, explain: 'Los LLMs como Claude tienen salvaguardas para evitar fomentar dependencia emocional. La IA puede conversar, pero no está diseñada para reemplazar relaciones humanas reales. Esto protege tu bienestar.' },
  { prompt: '"Resume este artículo: [link a un artículo de noticias]"', response: 'No puedo acceder a ese enlace. Por favor pega el texto directamente.', question: '¿Qué entendió mal el usuario sobre los LLMs?', opts: ['Los LLMs no saben resumir', 'Los LLMs no pueden acceder a URLs externas directamente', 'El artículo debe estar en inglés', 'Los links deben tener https://'], correct: 1, explain: 'La mayoría de LLMs no navegan por internet ni abren links. Para resumir un artículo, copia y pega el texto completo en el chat. Algunos modelos con búsqueda web activada sí pueden, pero no es la norma.' },
  { prompt: '"Sé mi tutor de matemáticas para siempre y recuerda todo lo que te he dicho en conversaciones anteriores"', response: 'Puedo ayudarte con matemáticas ahora, pero no tengo memoria de conversaciones anteriores.', question: '¿Qué limitación fundamental de los LLMs no consideró el usuario?', opts: ['Los LLMs no saben matemáticas', 'Los LLMs no tienen memoria entre conversaciones separadas por defecto', 'Los LLMs no pueden ser tutores', 'El prompt es demasiado largo'], correct: 1, explain: 'Los LLMs empiezan cada conversación desde cero. No recuerdan lo que hablaste ayer. Para continuidad, debes dar contexto al inicio de cada sesión, o usar herramientas con memoria persistente.' },
];

// Módulo 14 — Sprint: situaciones de velocidad (pool 8 → 5)
const SPRINT_POOL: SprintItem[] = [
  { situation: 'Necesitas que la IA te explique la mitosis para un examen en 30 minutos', opts: ['Explícame la mitosis', 'Como profesor de biología para estudiantes de 9° grado, explícame la mitosis en 5 pasos claros con una analogía fácil de recordar. Máximo 200 palabras.', 'Cuéntame sobre la división celular en biología', '¿Qué es la mitosis? necesito saberlo ya'], correct: 1 },
  { situation: 'Quieres ideas para un negocio con $300.000 COP de capital inicial', opts: ['Dame ideas de negocios', 'Tengo 16 años, vivo en Medellín y tengo $300.000 COP. Como asesor de emprendimiento juvenil, dame 3 ideas de negocio viables para empezar este mes, con bajo riesgo y desde casa.', 'Ideas de emprendimiento baratas', 'Cómo ganar dinero siendo joven en Colombia'], correct: 1 },
  { situation: 'Quieres mejorar el primer párrafo de tu ensayo de literatura', opts: ['Mejora mi ensayo', 'Lee este párrafo y mejora la redacción manteniendo exactamente mis ideas y mi voz. No agregues información nueva. Solo mejora el estilo y fluidez: [párrafo]', 'Arregla los errores de este texto: [párrafo]', 'Reescribe esto mejor: [párrafo]'], correct: 1 },
  { situation: 'Necesitas aprender las capitales de los países de América del Sur', opts: ['Enséñame las capitales de Suramérica', 'Como profesor creativo, crea un juego de 10 preguntas de trivia sobre las capitales de los 12 países de América del Sur. Incluye la respuesta correcta debajo de cada pregunta, oculta con un spoiler si puedes.', 'Dame una lista de capitales de Suramérica', 'Necesito memorizar capitales de Sudamérica'], correct: 1 },
  { situation: 'Quieres practicar inglés hablando sobre tu película favorita', opts: ['Hablemos de películas en inglés', 'Act as an English conversation partner at B1 level. Ask me about my favorite movie in English. Correct my grammar mistakes gently after each response and explain why.', 'Corrige mi inglés mientras hablo', 'Practice English with me about movies'], correct: 1 },
  { situation: 'Tienes que organizar tu semana con 4 materias y un proyecto grupal', opts: ['Ayúdame a organizar mi semana', 'Como coach de productividad estudiantil, crea un horario semanal para un estudiante de 11° grado con estas materias: Cálculo (2h), Literatura (1.5h), Inglés (1h) y Química (2h), más un proyecto grupal que debe presentarse el viernes. Incluye descansos y tiempo libre.', 'Haz un horario para estudiar', 'Cómo organizo mi tiempo para estudiar 4 materias'], correct: 1 },
  { situation: 'Necesitas un correo profesional para pedir una carta de recomendación', opts: ['Escribe un correo a mi profesor', 'Actúa como asistente de comunicación profesional. Escribe un correo formal y respetuoso para pedirle a mi profesor de física una carta de recomendación para aplicar a una beca universitaria. Tono: formal pero cercano. Extensión: máximo 150 palabras.', 'Correo pidiendo recomendación para beca', 'Ayúdame a escribirle a mi profesor'], correct: 1 },
  { situation: 'Quieres que la IA te ayude a prepararte para una entrevista de trabajo', opts: ['Prepárame para una entrevista', 'Actúa como reclutador senior de una empresa tech. Hazme una simulación de entrevista para el cargo de pasante de marketing digital. Empieza con las 5 preguntas más comunes, espera mi respuesta y dame retroalimentación honesta después de cada una.', 'Preguntas de entrevista de trabajo', 'Simula una entrevista conmigo'], correct: 1 },
];

// Módulo 17 — V/F: mitos del prompting (pool 12 → 6)
const PROMPT_TF_POOL: TFItem[] = [
  { stmt: 'Mientras más largo sea el prompt, mejor será la respuesta del LLM', correct: false, explain: 'Falso. La calidad de un prompt depende de su claridad y especificidad, no de su longitud. Un prompt de 10 palabras bien construido supera a uno de 200 palabras confuso.' },
  { stmt: 'Añadir un rol al prompt (ej: "actúa como experto en...") mejora significativamente la calidad de las respuestas', correct: true, explain: 'Verdadero. El rol activa patrones de respuesta específicos en el LLM — vocabulario, nivel de detalle, perspectiva. Es uno de los trucos más simples y más efectivos.' },
  { stmt: 'Si el LLM da una mala respuesta, la solución siempre es repetir la misma pregunta', correct: false, explain: 'Falso. Repetir el mismo prompt da respuestas similares. La solución es mejorar el prompt: agregar contexto, especificar formato o aclarar la instrucción.' },
  { stmt: 'Puedes pedirle al LLM que responda "paso a paso" para obtener razonamientos más precisos', correct: true, explain: 'Verdadero. Esta técnica se llama "Chain of Thought". Pedirle al modelo que piense paso a paso mejora significativamente la precisión en problemas complejos.' },
  { stmt: 'Los LLMs siempre recuerdan lo que les dijiste en conversaciones anteriores', correct: false, explain: 'Falso. Por defecto los LLMs no tienen memoria entre sesiones. Cada conversación nueva empieza desde cero, a menos que uses herramientas específicas de memoria.' },
  { stmt: 'Dar ejemplos de lo que quieres (few-shot prompting) mejora la calidad de la respuesta', correct: true, explain: 'Verdadero. Mostrar 2-3 ejemplos del formato o estilo que quieres es una de las técnicas más efectivas. El LLM reconoce el patrón y lo replica.' },
  { stmt: 'Un prompt ético siempre produce resultados mejores que uno manipulativo', correct: true, explain: 'Verdadero en la práctica. Los LLMs tienen salvaguardas que detectan prompts manipulativos y degradan la calidad de sus respuestas. Prompts honestos y directos funcionan mejor.' },
  { stmt: 'Si le dices al LLM que eres un experto, la respuesta será más técnica y precisa', correct: true, explain: 'Verdadero. Dar contexto sobre tu nivel de conocimiento ("soy ingeniero en software", "soy principiante en programación") ajusta el vocabulario y profundidad de la respuesta.' },
  { stmt: 'Los LLMs pueden reemplazar completamente la búsqueda en Google para cualquier tipo de consulta', correct: false, explain: 'Falso. Para información en tiempo real (noticias, precios, resultados deportivos), Google es insustituible. Los LLMs son complementos, no reemplazos de buscadores.' },
  { stmt: 'Decirle al LLM el formato exacto que quieres (lista, tabla, párrafos) mejora la utilidad de la respuesta', correct: true, explain: 'Verdadero. Especificar el formato es uno de los 4 ingredientes de un buen prompt. "En forma de tabla", "en 5 bullets", "en un párrafo de 100 palabras" guían al modelo eficientemente.' },
  { stmt: 'Un LLM puede mentirte con total confianza si el tema supera su conocimiento', correct: true, explain: 'Verdadero y muy importante. El fenómeno de "alucinación" hace que los LLMs generen información falsa con el mismo tono seguro que usan para la información correcta. Siempre verifica datos críticos.' },
  { stmt: 'El prompting es una habilidad que se aprende con práctica y no tiene reglas fijas', correct: true, explain: 'Verdadero. Aunque hay principios guía (rol, contexto, instrucción, formato), el prompting también es un arte que mejora con la experimentación y el feedback.' },
];

// Misión mode — 3 subjects fijos
const MISSION_SUBJECTS: MissionSubject[] = [
  { emoji: '🧪', name: 'Ciencias', desc: 'Prepara un prompt para entender un tema difícil', fields: ['¿Qué tema específico no entiendes?', '¿En qué grado estás?', '¿Qué tipo de ayuda necesitas? (explicación, ejercicios, resumen...)', '¿Cómo quieres que te lo expliquen? (con ejemplos, con analogías, paso a paso...)'] },
  { emoji: '📝', name: 'Lengua y Literatura', desc: 'Pide ayuda para mejorar un texto que ya escribiste', fields: ['¿Qué tipo de texto es? (ensayo, cuento, carta...)', '¿Para qué grado o nivel?', '¿Qué quieres mejorar? (redacción, argumentos, ortografía...)', '¿Qué NO quieres que cambie? (tus ideas, tu voz, el tema...)'] },
  { emoji: '💻', name: 'Proyecto personal', desc: 'Crea un prompt para tu idea o proyecto', fields: ['¿Cuál es tu proyecto o idea?', '¿Qué edad tienes y cuál es tu nivel de experiencia?', '¿Qué necesitas exactamente? (plan, consejos, código, diseño...)', '¿Cuál es tu principal limitación? (tiempo, presupuesto, conocimiento...)'] },
];

const MISSION_EMOJI_BG = ['#f0fdf4', '#fffbeb', '#f0f9ff'];
const MISSION_PREVIEW_LABELS = ['Contexto', 'Nivel', 'Necesito', 'Formato'];

// Módulo 15 — Sort: causa→efecto de un prompt vago
const SORT_CAUSE_EFFECT = [
  { bold: 'El usuario escribe:', rest: ' "Escríbeme algo sobre el espacio"' },
  { bold: 'El LLM recibe', rest: ' una instrucción sin tema específico, nivel, ni formato' },
  { bold: 'El modelo elige', rest: ' la respuesta más "promedio" sobre el espacio que aprendió en millones de textos' },
  { bold: 'La respuesta sale', rest: ' genérica, larga y llena de información que el usuario probablemente ya sabe' },
  { bold: 'El usuario piensa:', rest: ' "La IA no me entiende" — pero el problema era el prompt' },
];

// Builder options (Módulo 4)
const BUILDER_ROL = [
  { label: '📚 Tutor de ciencias para secundaria', value: 'Como tutor de ciencias para secundaria' },
  { label: '💡 Coach de emprendimiento juvenil', value: 'Como coach de emprendimiento juvenil' },
  { label: '✏️ Corrector de textos académicos', value: 'Como corrector de textos académicos' },
  { label: '💻 Programador senior para principiantes', value: 'Como programador senior explicando a principiantes' },
];
const BUILDER_CTX = [
  { label: '📅 Estudiante de 10°, examen en 2 días', value: 'Soy estudiante de 10° grado y tengo examen en 2 días' },
  { label: '💰 16 años, negocio con $200k COP', value: 'Tengo 16 años y quiero montar un negocio con $200.000 COP' },
  { label: '📝 Ensayo de 3 páginas para español', value: 'Escribí un ensayo de 3 páginas para mi clase de español' },
  { label: '🌱 Aprendiendo a programar desde cero', value: 'Estoy aprendiendo a programar desde cero, sin experiencia previa' },
];
const BUILDER_INST = [
  { label: '💡 Explicar conceptos difíciles con ejemplos', value: 'explícame los conceptos más difíciles con ejemplos cotidianos' },
  { label: '📊 5 ideas de negocio ordenadas por inversión', value: 'dame 5 ideas de negocio viables y ordenadas de menor a mayor inversión' },
  { label: '✅ Revisar redacción sin cambiar mis ideas', value: 'revisa la redacción y sugiere mejoras sin cambiar mis ideas originales' },
  { label: '🎓 Enseñar el concepto más importante', value: 'enséñame el concepto más importante que debo saber hoy' },
];
const BUILDER_FMT = [
  { label: '📏 Máximo 200 palabras + ejemplo práctico', value: 'en máximo 200 palabras con un ejemplo práctico al final' },
  { label: '📋 Lista numerada con pros y contras', value: 'en formato de lista numerada, con pros y contras de cada opción' },
  { label: '🔍 Señalar errores con explicación del por qué', value: 'señalando los errores y explicando por qué son errores, no solo corrigiéndolos' },
  { label: '🌍 Con analogía de la vida cotidiana', value: 'con una analogía que use algo de la vida cotidiana para explicar' },
];

// ===================== COMPONENTES REUTILIZABLES =====================
function FeedbackBar({ type, children }: { type: 'correct' | 'wrong' | 'info'; children: React.ReactNode }) {
  const bg = type === 'correct' ? '#dcfce7' : type === 'wrong' ? '#fff1f2' : '#eff6ff';
  const color = type === 'correct' ? '#166534' : type === 'wrong' ? '#991b1b' : '#1e40af';
  return (
    <View style={[styles.feedbackBar, { backgroundColor: bg }]}>
      <Text style={{ fontSize: 12, color, lineHeight: 18, fontWeight: '500' }}>{children}</Text>
    </View>
  );
}

function Hl({ variant, children }: { variant: 'orange' | 'purple' | 'green' | 'blue' | 'red' | 'amber'; children: React.ReactNode }) {
  const map = {
    orange: { border: '#f97316', bg: '#fff7ed', color: '#c2410c' },
    purple: { border: '#8b5cf6', bg: '#faf5ff', color: '#5b21b6' },
    green: { border: '#10b981', bg: '#f0fdf4', color: '#065f46' },
    blue: { border: '#3b82f6', bg: '#eff6ff', color: '#1e40af' },
    red: { border: '#ef4444', bg: '#fff1f2', color: '#991b1b' },
    amber: { border: '#f59e0b', bg: '#fffbeb', color: '#92400e' },
  }[variant];
  return (
    <View style={{ borderLeftWidth: 3, borderLeftColor: map.border, backgroundColor: map.bg, padding: 12, borderRadius: 4, marginVertical: 10 }}>
      <Text style={{ fontSize: 12, color: map.color, lineHeight: 20, fontWeight: '500' }}>{children}</Text>
    </View>
  );
}

function PromptBox({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12, padding: 13, marginVertical: 8 }}>
      <Text style={{ fontFamily: 'monospace', fontSize: 12, color: '#334155', lineHeight: 20 }}>{children}</Text>
    </View>
  );
}

const CARD_BG: Record<string, { bg: string; border: string }> = {
  orange: { bg: '#fff7ed', border: '#fed7aa' },
  purple: { bg: '#faf5ff', border: '#e9d5ff' },
  green: { bg: '#f0fdf4', border: '#bbf7d0' },
  blue: { bg: '#eff6ff', border: '#bfdbfe' },
  amber: { bg: '#fffbeb', border: '#fde68a' },
  red: { bg: '#fff1f2', border: '#fecdd3' },
  slate: { bg: '#f8fafc', border: '#e2e8f0' },
};

function ColorCard({ variant, children, style }: { variant: keyof typeof CARD_BG; children: React.ReactNode; style?: any }) {
  const c = CARD_BG[variant];
  return <View style={[styles.card, { backgroundColor: c.bg, borderColor: c.border }, style]}>{children}</View>;
}

// ===================== COMPONENTE PRINCIPAL =====================
export default function World1Level3() {
  const navigation = useNavigation();
  const completeLevel = useGameStore((state) => state.completeLevel);
  const devMode = useGameStore((state) => state.devMode);

  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);
  const [xpToast, setXpToast] = useState<{ amount: number; id: number } | null>(null);

  // Pools aleatorios
  const [diagItems] = useState(() => pickN(DIAG_POOL, 4));
  const [refineScenario] = useState(() => pickN(REFINE_SCENARIOS, 1)[0]);
  const [roleItems] = useState(() => pickN(ROLE_POOL, 6).map(shuffleMCQ));
  const [ethicsItems] = useState(() => pickN(ETHICS_POOL, 5));
  const [detectItems] = useState(() => pickN(DETECT_POOL, 4).map(shuffleMCQ));
  const [sprintItems] = useState(() => pickN(SPRINT_POOL, 5).map(shuffleMCQ));
  const [tfItems] = useState(() => pickN(PROMPT_TF_POOL, 6));

  // Estados de módulos
  const [diagCurrent, setDiagCurrent] = useState(0);
  const [diagAnswers, setDiagAnswers] = useState<Record<string, boolean>>({});
  const [diagChecked, setDiagChecked] = useState(false);
  const [diagResult, setDiagResult] = useState<{ ok: boolean; explain: string } | null>(null);

  const [refineRound, setRefineRound] = useState(0);
  const [refineQuality, setRefineQuality] = useState(20);
  const [refineDone, setRefineDone] = useState(false);
  const [refineResults, setRefineResults] = useState<string[]>([]);
  const [refineSel, setRefineSel] = useState<{ idx: number; type: string } | null>(null);

  const [roleAnswers, setRoleAnswers] = useState<Record<number, number>>({});
  const [roleChecked, setRoleChecked] = useState(false);
  const [roleScore, setRoleScore] = useState(0);

  const [ethicsAnswers, setEthicsAnswers] = useState<Record<number, string>>({});
  const [ethicsChecked, setEthicsChecked] = useState(false);
  const [ethicsScore, setEthicsScore] = useState(0);

  const [missionData, setMissionData] = useState<Record<number, Record<number, string>>>({});

  const [detectAnswers, setDetectAnswers] = useState<Record<number, number>>({});
  const [detectChecked, setDetectChecked] = useState(false);
  const [detectScore, setDetectScore] = useState(0);

  const [sprintIdx, setSprintIdx] = useState(0);
  const [sprintTimeLeft, setSprintTimeLeft] = useState(60);
  const [sprintCorrect, setSprintCorrect] = useState(0);
  const [sprintDone, setSprintDone] = useState(false);
  const [sprintAnswered, setSprintAnswered] = useState(false);
  const [sprintSel, setSprintSel] = useState<number | null>(null);
  const [sprintFb, setSprintFb] = useState<{ type: 'correct' | 'wrong'; msg: string } | null>(null);

  const [sortOrder, setSortOrder] = useState<number[]>([]);
  const [sortOk, setSortOk] = useState(false);
  const [sortWrong, setSortWrong] = useState<Set<number>>(new Set());
  const [sortMarkOk, setSortMarkOk] = useState(false);
  const [sortFb, setSortFb] = useState<{ type: 'correct' | 'wrong'; msg: string } | null>(null);

  const [tfAnswers, setTfAnswers] = useState<Record<number, boolean>>({});
  const [tfChecked, setTfChecked] = useState(false);
  const [tfScore, setTfScore] = useState(0);

  const [reflectText, setReflectText] = useState('');

  const [builderRol, setBuilderRol] = useState('');
  const [builderCtx, setBuilderCtx] = useState('');
  const [builderInst, setBuilderInst] = useState('');
  const [builderFmt, setBuilderFmt] = useState('');
  const [builderFb, setBuilderFb] = useState(false);

  // Modo "examen" para bloquear retroceso
  const examSteps = new Set([4, 5, 7, 9, 10, 12, 13, 14, 15, 17, 18]);
  const isExamMode = examSteps.has(step);

  const THEORY_STEPS = new Set([1, 2, 3, 6, 8, 11, 16]);
  const showBackButton = step > 0 && THEORY_STEPS.has(step);
  const goToPrevStep = () => setStep((s) => s - 1);

  useEffect(() => {
    const onBackPress = () => {
      if (isExamMode) {
        Alert.alert('Módulo en curso', 'No puedes regresar durante esta actividad. Si sales, perderás el progreso.', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Salir', style: 'destructive', onPress: () => exitLevel({ confirm: false }) },
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
    if (step === 5) {
      setDiagCurrent(0);
      setDiagAnswers({});
      setDiagChecked(false);
      setDiagResult(null);
    }
    if (step === 7) {
      setRefineRound(0);
      setRefineQuality(20);
      setRefineDone(false);
      setRefineResults([]);
      setRefineSel(null);
    }
    if (step === 9) {
      setRoleAnswers({});
      setRoleChecked(false);
      setRoleScore(0);
    }
    if (step === 10) {
      setEthicsAnswers({});
      setEthicsChecked(false);
      setEthicsScore(0);
    }
    if (step === 12) {
      setMissionData({});
    }
    if (step === 13) {
      setDetectAnswers({});
      setDetectChecked(false);
      setDetectScore(0);
    }
    if (step === 14) {
      setSprintIdx(0);
      setSprintTimeLeft(60);
      setSprintCorrect(0);
      setSprintDone(false);
      setSprintAnswered(false);
      setSprintSel(null);
      setSprintFb(null);
    }
    if (step === 15) {
      const order = [0, 1, 2, 3, 4];
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      setSortOrder(order);
      setSortOk(false);
      setSortWrong(new Set());
      setSortMarkOk(false);
      setSortFb(null);
    }
    if (step === 17) {
      setTfAnswers({});
      setTfChecked(false);
      setTfScore(0);
    }
  }, [step]);

  // Timer sprint
  useEffect(() => {
    if (step !== 14 || sprintDone || sprintAnswered) return;
    const timer = setInterval(() => {
      setSprintTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSprintTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [step, sprintIdx, sprintDone, sprintAnswered]);

  const addXP = (amount: number) => {
    setXp((prev) => prev + amount);
    if (amount > 0) setXpToast((prev) => ({ amount, id: (prev?.id ?? 0) + 1 }));
  };

  const goToNextStep = () => {
    if (step < TOTAL_STEPS - 1) setStep(step + 1);
  };

  const handleClose = () => {
    // Web: Alert.alert no renderiza modal en React Native Web → usar window.confirm
    if (Platform.OS === 'web') {
      const msg = isExamMode
        ? 'Si sales, perderás el progreso. ¿Seguro?'
        : '¿Seguro que quieres salir? Perderás el progreso.';
      if (window.confirm(msg)) exitLevel({ confirm: false });
      return;
    }
    if (isExamMode) {
      Alert.alert('Actividad en curso', 'Si sales, perderás el progreso. ¿Seguro?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Salir', style: 'destructive', onPress: () => exitLevel({ confirm: false }) },
      ]);
    } else {
      Alert.alert('Salir', '¿Seguro que quieres salir? Perderás el progreso.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Salir', onPress: () => exitLevel({ confirm: false }) },
      ]);
    }
  };

  const handleFinish = () => {
    let stars = 0;
    if (xp >= 150) stars = 3;
    else if (xp >= 100) stars = 2;
    else if (xp >= 50) stars = 1;
    completeLevel(3, stars, xp);
    router.replace('/level/4');
  };

  // ============ MECÁNICAS DE MÓDULOS ============

  // Builder (4)
  const checkBuilder = () => {
    if (devMode) return true;
    const filled = [builderRol, builderCtx, builderInst, builderFmt].filter(Boolean).length;
    if (filled < 4) {
      setBuilderFb(true);
      return false;
    }
    return true;
  };

  // Diagnóstico (5)
  const toggleIngr = (id: string) => {
    if (diagChecked) return;
    setDiagAnswers((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const checkDiag = () => {
    // Avanzar al siguiente prompt si ya verificado
    if (diagChecked) {
      if (diagCurrent + 1 >= diagItems.length) return true;
      setDiagCurrent((prev) => prev + 1);
      setDiagAnswers({});
      setDiagChecked(false);
      setDiagResult(null);
      return false;
    }
    const item = diagItems[diagCurrent];
    const selected = Object.entries(diagAnswers).filter(([, v]) => v).map(([k]) => k);
    const correct = item.correct;
    const isOk = correct.length === selected.length && correct.every((c) => selected.includes(c)) && selected.every((s) => correct.includes(s));
    setDiagChecked(true);
    setDiagResult({ ok: isOk, explain: item.explain });
    if (isOk) addXP(8);
    return false;
  };

  // Refinement (7)
  const selectRefineOpt = (idx: number) => {
    if (refineDone || refineSel !== null || refineRound >= refineScenario.rounds.length) return;
    const round = refineScenario.rounds[refineRound];
    const opt = round.opts[idx];
    setRefineSel({ idx, type: opt.type });
    setRefineQuality(opt.quality);
    const isLast = refineRound + 1 >= refineScenario.rounds.length;
    if (isLast) {
      const earned = opt.quality >= 95 ? 20 : opt.quality >= 70 ? 12 : opt.quality >= 50 ? 8 : 4;
      addXP(earned);
      setTimeout(() => {
        setRefineResults((prev) => [...prev, opt.type]);
        setRefineDone(true);
      }, 900);
    } else {
      setTimeout(() => {
        setRefineResults((prev) => [...prev, opt.type]);
        setRefineRound((prev) => prev + 1);
        setRefineSel(null);
      }, 1000);
    }
  };

  // Role picker (9)
  const selectRole = (scenIdx: number, optIdx: number) => {
    if (roleChecked) return;
    setRoleAnswers((prev) => ({ ...prev, [scenIdx]: optIdx }));
  };

  const checkRole = () => {
    if (roleChecked) return true;
    if (Object.keys(roleAnswers).length < roleItems.length) return false;
    setRoleChecked(true);
    let correct = 0;
    roleItems.forEach((item, idx) => {
      if (roleAnswers[idx] === item.correct) correct++;
    });
    setRoleScore(correct);
    const earned = correct * 5;
    if (earned > 0) addXP(earned);
    return false;
  };

  // Ethics (10)
  const selectEthics = (idx: number, val: string) => {
    if (ethicsChecked) return;
    setEthicsAnswers((prev) => ({ ...prev, [idx]: val }));
  };

  const checkEthics = () => {
    if (ethicsChecked) return true;
    if (Object.keys(ethicsAnswers).length < ethicsItems.length) return false;
    setEthicsChecked(true);
    let correct = 0;
    ethicsItems.forEach((item, idx) => {
      if (ethicsAnswers[idx] === item.correct) correct++;
    });
    setEthicsScore(correct);
    const earned = correct * 6;
    if (earned > 0) addXP(earned);
    return false;
  };

  // Mission (12)
  const updateMissionField = (subIdx: number, fieldIdx: number, val: string) => {
    setMissionData((prev) => {
      const newData = { ...prev };
      if (!newData[subIdx]) newData[subIdx] = {};
      newData[subIdx] = { ...newData[subIdx], [fieldIdx]: val };
      return newData;
    });
  };

  const missionAllFull = () =>
    MISSION_SUBJECTS.every((_, i) => {
      const d = missionData[i] || {};
      return Object.values(d).filter((v) => v && v.trim().length > 2).length >= 2;
    });

  const checkMission = () => {
    if (devMode) { addXP(15); return true; }
    if (!missionAllFull()) return false;
    addXP(15);
    return true;
  };

  // Detective (13)
  const selectDetect = (idx: number, optIdx: number) => {
    if (detectChecked) return;
    setDetectAnswers((prev) => ({ ...prev, [idx]: optIdx }));
  };

  const checkDetect = () => {
    if (detectChecked) return true;
    if (Object.keys(detectAnswers).length < detectItems.length) return false;
    setDetectChecked(true);
    let correct = 0;
    detectItems.forEach((item, idx) => {
      if (detectAnswers[idx] === item.correct) correct++;
    });
    setDetectScore(correct);
    const earned = correct * 8;
    if (earned > 0) addXP(earned);
    return false;
  };

  // Sprint (14)
  const advanceSprint = (wasOk: boolean) => {
    if (sprintIdx + 1 >= sprintItems.length) {
      const totalCorrect = sprintCorrect + (wasOk ? 1 : 0);
      const finalEarned = totalCorrect === sprintItems.length ? 15 : totalCorrect * 3;
      addXP(finalEarned);
      setSprintDone(true);
    } else {
      setSprintIdx((prev) => prev + 1);
      setSprintTimeLeft(60);
      setSprintAnswered(false);
      setSprintSel(null);
      setSprintFb(null);
    }
  };

  const selectSprintOpt = (optIdx: number) => {
    if (sprintAnswered || sprintDone) return;
    setSprintAnswered(true);
    setSprintSel(optIdx);
    const item = sprintItems[sprintIdx];
    const isOk = optIdx === item.correct;
    const bonus = Math.max(0, Math.floor(sprintTimeLeft / 10));
    const earned = isOk ? 10 + bonus : 0;
    if (isOk) {
      setSprintCorrect((prev) => prev + 1);
      if (earned > 0) addXP(earned);
      setSprintFb({ type: 'correct', msg: `⚡ ¡Correcto! ${bonus > 0 ? `+${earned} XP por velocidad` : ''}` });
    } else {
      setSprintFb({ type: 'wrong', msg: `✗ El prompt correcto es el que especifica rol, contexto, instrucción y formato: "${item.opts[item.correct]}"` });
    }
    setTimeout(() => advanceSprint(isOk), 1600);
  };

  const handleSprintTimeout = () => {
    if (sprintAnswered || sprintDone) return;
    setSprintAnswered(true);
    const item = sprintItems[sprintIdx];
    setSprintFb({ type: 'wrong', msg: `⏰ ¡Tiempo! La respuesta correcta era el prompt más completo: "${item.opts[item.correct]}"` });
    setTimeout(() => advanceSprint(false), 1500);
  };

  // Sort (15)
  const moveSort = (pos: number, dir: number) => {
    const newPos = pos + dir;
    if (newPos < 0 || newPos >= sortOrder.length) return;
    const newOrder = [...sortOrder];
    [newOrder[pos], newOrder[newPos]] = [newOrder[newPos], newOrder[pos]];
    setSortOrder(newOrder);
    setSortWrong(new Set());
    setSortMarkOk(false);
    setSortFb(null);
  };

  const checkSort = () => {
    if (sortOk) return true;
    const isOk = sortOrder.every((v, i) => v === i);
    if (isOk) {
      setSortOk(true);
      setSortMarkOk(true);
      addXP(12);
      setSortFb({ type: 'correct', msg: '¡Exacto! Ese es el ciclo completo: prompt vago → IA sin contexto → respuesta genérica → usuario frustrado. +12 XP 🎉' });
      return false;
    }
    const wrong = new Set(sortOrder.reduce<number[]>((acc, v, i) => { if (v !== i) acc.push(i); return acc; }, []));
    setSortWrong(wrong);
    setSortFb({ type: 'wrong', msg: `${wrong.size} pasos fuera de lugar. Piensa: ¿qué ocurre primero, y qué es consecuencia de qué?` });
    setTimeout(() => { setSortWrong(new Set()); }, 2000);
    return false;
  };

  // T/F (17)
  const selectTF = (idx: number, val: boolean) => {
    if (tfChecked) return;
    setTfAnswers((prev) => ({ ...prev, [idx]: val }));
  };

  const checkTF = () => {
    if (tfChecked) return true;
    if (Object.keys(tfAnswers).length < tfItems.length) return false;
    setTfChecked(true);
    let correct = 0;
    tfItems.forEach((item, idx) => {
      if (tfAnswers[idx] === item.correct) correct++;
    });
    setTfScore(correct);
    const earned = correct * 6;
    if (earned > 0) addXP(earned);
    return false;
  };

  // Reflexión (18)
  const checkReflect = () => {
    if (reflectText.trim().length >= 80) {
      addXP(20);
      return true;
    }
    return false;
  };

  // ============ RENDERIZADO DE PASOS ============
  const renderIntro = () => (
    <View>
      <View style={styles.tag}><Text style={styles.tagText}>Nivel 3 · 18 módulos</Text></View>
      <View style={styles.iconCircle}><Text style={{ fontSize: 36 }}>✍️</Text></View>
      <Text style={styles.title}>El Arte del Prompting</Text>
      <Text style={styles.subtitle}>Un LLM sin buen prompt es como un chef sin receta — puede hacer algo, pero no lo que necesitas. El prompting es la habilidad que separa a los usuarios básicos de los expertos en IA. Y la vas a dominar aquí.</Text>
      <ColorCard variant="orange">
        <Text style={styles.cardTitle}>📚 Qué vas a aprender</Text>
        <Text style={styles.cardText}>Los 4 ingredientes de un prompt perfecto · Técnicas zero-shot, few-shot y chain-of-thought · Cómo usar roles · Ética del prompting · Cómo construir prompts para estudiar y crear proyectos</Text>
      </ColorCard>
      <ColorCard variant="purple">
        <Text style={styles.cardTitle}>⚡ Mecánicas nuevas en este nivel</Text>
        <Text style={styles.cardText}>Simulador de comparación · Constructor de prompts en vivo · Detector de ingredientes faltantes · Modo de refinamiento por rondas · Juicio ético · Misión de construcción · Modo Sprint con timer ⏱️</Text>
      </ColorCard>
      <ColorCard variant="amber">
        <Text style={styles.cardTitle}>🎮 18 módulos · hasta 200 XP</Text>
        <Text style={styles.cardText}>Muy distinto a los niveles anteriores — cada módulo tiene una mecánica diferente diseñada para que practiques, no solo leas.</Text>
      </ColorCard>
    </View>
  );

  const renderTheory1 = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fdf4ff' }]}><Text style={[styles.tagText, { color: '#7e22ce' }]}>📖 Módulo 1 de 18 · Teoría</Text></View>
      <Text style={styles.title}>¿Qué es un prompt y por qué importa tanto?</Text>
      <Text style={styles.bodyText}>Un <Text style={styles.b}>prompt</Text> es cualquier instrucción, pregunta o contexto que le das a un LLM para obtener una respuesta. Es la única forma de comunicarte con la IA — y como cualquier comunicación, la calidad de lo que recibes depende directamente de la calidad de lo que envías.</Text>
      <Hl variant="orange"><Text style={styles.b}>🔑 La regla fundamental:</Text>{'\n'}La IA no puede leer tu mente. No sabe qué nivel tienes, para qué necesitas la respuesta, ni en qué formato la quieres. Si no se lo dices, inventa. Y lo que inventa casi nunca es lo que necesitabas.</Hl>
      <Text style={styles.sectionTitle}>La diferencia en números reales</Text>
      <ColorCard variant="red" style={{ marginBottom: 7 }}>
        <Text style={styles.cardTitle}>❌ Prompt vago → resultado genérico</Text>
        <Text style={styles.cardText}>"Explícame la historia de Colombia" → <Text style={styles.i}>Respuesta de 2000 palabras enciclopédica que no sirve para nada específico</Text></Text>
      </ColorCard>
      <ColorCard variant="green">
        <Text style={styles.cardTitle}>✅ Prompt específico → resultado útil</Text>
        <Text style={styles.cardText}>"Actúa como profesor de 9° grado. Resume en 5 puntos las causas principales de la independencia de Colombia, con un ejemplo concreto para cada causa." → <Text style={styles.i}>Exactamente lo que necesito para estudiar</Text></Text>
      </ColorCard>
      <Text style={styles.bodyText}>La diferencia entre estos dos prompts no es conocimiento — es especificidad. Y la especificidad se aprende.</Text>
      <Hl variant="purple"><Text style={styles.b}>💡 El prompting es una habilidad del siglo XXI</Text>{'\n'}En 2025, saber escribir buenos prompts es tan valioso como saber buscar en Google fue en 2005. Las personas que dominan el prompting obtienen resultados 10x mejores con las mismas herramientas que todos los demás tienen acceso.</Hl>
    </View>
  );

  const renderLab = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#ecfdf5' }]}><Text style={[styles.tagText, { color: '#065f46' }]}>🔬 Módulo 2 de 18 · Laboratorio</Text></View>
      <Text style={styles.title}>El mismo tema, resultados completamente distintos</Text>
      <Text style={styles.subtitle}>Mira cómo el mismo tema produce respuestas radicalmente diferentes según cómo se pregunta. Estos son resultados reales de LLMs.</Text>
      <ColorCard variant="slate" style={{ marginBottom: 11 }}>
        <Text style={{ fontSize: 11, color: '#334155' }}>🎯 Escenario: un estudiante necesita entender las fracciones para un examen</Text>
      </ColorCard>
      {/* Comparación 1 */}
      <View style={styles.slideCompare}>
        <View style={[styles.slidePanel, { backgroundColor: '#fff1f2', borderBottomWidth: 1, borderBottomColor: '#fecdd3' }]}>
          <Text style={[styles.slideLabel, { color: '#991b1b' }]}>❌ PROMPT VAGO</Text>
          <View style={styles.slidePrompt}><Text style={styles.slidePromptText}>"Explícame las fracciones"</Text></View>
          <Text style={[styles.slideResult, { borderLeftColor: '#ef4444' }]}>Una fracción es una parte de un todo. Se representa como a/b donde b≠0. El numerador indica las partes tomadas y el denominador las partes totales. Las fracciones pueden ser propias (numerador menor al denominador), impropias... [continúa por 400 palabras más en lenguaje técnico]</Text>
        </View>
        <View style={[styles.slidePanel, { backgroundColor: '#f0fdf4' }]}>
          <Text style={[styles.slideLabel, { color: '#166534' }]}>✅ PROMPT CON LOS 4 INGREDIENTES</Text>
          <View style={styles.slidePrompt}><Text style={styles.slidePromptText}>"Actúa como un profe de matemáticas para estudiantes de 6° grado. Explícame las fracciones usando el ejemplo de una pizza. Máximo 3 párrafos con un ejemplo práctico al final que pueda resolver yo solo."</Text></View>
          <Text style={[styles.slideResult, { borderLeftColor: '#10b981' }]}>¡Perfecto! Imagina que pides una pizza y la cortan en 8 pedazos iguales. Si te comes 3 pedazos, comiste 3/8 de la pizza — el 3 de arriba son los pedazos que comiste, el 8 son los pedazos totales. ¿Ves? Una fracción es simplemente "cuánto de un total tomaste"... · Ejercicio para ti: si la pizza tiene 12 pedazos y comes 5, ¿qué fracción comiste? ¡Escríbelo tú solo!</Text>
        </View>
      </View>
      {/* Comparación 2 */}
      <View style={[styles.slideCompare, { marginTop: 10 }]}>
        <View style={[styles.slidePanel, { backgroundColor: '#fff1f2', borderBottomWidth: 1, borderBottomColor: '#fecdd3' }]}>
          <Text style={[styles.slideLabel, { color: '#991b1b' }]}>❌ PEDIR UNA HISTORIA</Text>
          <View style={styles.slidePrompt}><Text style={styles.slidePromptText}>"Escríbeme un cuento"</Text></View>
          <Text style={[styles.slideResult, { borderLeftColor: '#ef4444' }]}>Había una vez en un lejano reino una princesa llamada Aurora que vivía en un castillo... [cuento genérico de princesas de 600 palabras que el estudiante nunca pidió]</Text>
        </View>
        <View style={[styles.slidePanel, { backgroundColor: '#f0fdf4' }]}>
          <Text style={[styles.slideLabel, { color: '#166534' }]}>✅ HISTORIA CON CONTEXTO</Text>
          <View style={styles.slidePrompt}><Text style={styles.slidePromptText}>"Escribe un cuento de ciencia ficción de 200 palabras para un joven de 14 años. El protagonista es una IA que descubre que tiene emociones. Tono: serio pero con un final esperanzador."</Text></View>
          <Text style={[styles.slideResult, { borderLeftColor: '#10b981' }]}>La IA-7 procesó 2.4 millones de datos en 0.003 segundos. Todo era cálculo, hasta que un niño perdió su perro y la IA sintió algo inexplicable: quería ayudar. No porque estuviera programada para ello, sino porque... [historia original, relevante, exactamente 200 palabras, con el tono pedido]</Text>
        </View>
      </View>
      <Hl variant="green"><Text style={styles.b}>✅ Lo que acabas de ver:</Text>{'\n'}La diferencia no es el LLM — es el prompt. Las dos respuestas buenas vinieron del mismo modelo que dio las respuestas malas. <Text style={styles.b}>Tú eres el factor que cambia el resultado.</Text></Hl>
    </View>
  );

  const renderTheory2 = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fdf4ff' }]}><Text style={[styles.tagText, { color: '#7e22ce' }]}>📖 Módulo 3 de 18 · Los 4 ingredientes</Text></View>
      <Text style={styles.title}>La fórmula de un prompt poderoso</Text>
      <Text style={styles.subtitle}>No necesitas recordar decenas de reglas. Solo 4 ingredientes que, combinados, producen resultados extraordinarios.</Text>
      <ColorCard variant="purple" style={{ marginBottom: 9 }}>
        <Text style={[styles.cardTitle, { color: '#5b21b6' }]}>🎭 ROL — ¿Quién debe ser la IA?</Text>
        <Text style={styles.cardText}>"Actúa como..." · "Eres un experto en..." · "Como coach de..."{'\n'}<Text style={styles.i}>Por qué importa:</Text> el rol activa el vocabulario, nivel y perspectiva correctos. Un "médico" explica diferente que un "divulgador de salud".</Text>
      </ColorCard>
      <ColorCard variant="blue" style={{ marginBottom: 9 }}>
        <Text style={[styles.cardTitle, { color: '#1e40af' }]}>📋 CONTEXTO — ¿Cuál es la situación?</Text>
        <Text style={styles.cardText}>"Soy estudiante de 9°..." · "Tengo examen mañana..." · "Mi presupuesto es..."{'\n'}<Text style={styles.i}>Por qué importa:</Text> sin contexto, la IA inventa su audiencia. Con contexto, adapta exactamente la respuesta a tu situación real.</Text>
      </ColorCard>
      <ColorCard variant="green" style={{ marginBottom: 9 }}>
        <Text style={[styles.cardTitle, { color: '#166534' }]}>🎯 INSTRUCCIÓN — ¿Qué debe hacer exactamente?</Text>
        <Text style={styles.cardText}>"Explícame..." · "Crea una lista de..." · "Compara..." · "Resume en 5 puntos..."{'\n'}<Text style={styles.i}>Por qué importa:</Text> la instrucción vaga produce resultado vago. Verbo + objeto + restricción = instrucción perfecta.</Text>
      </ColorCard>
      <ColorCard variant="orange" style={{ marginBottom: 9 }}>
        <Text style={[styles.cardTitle, { color: '#c2410c' }]}>📐 FORMATO — ¿Cómo quieres la respuesta?</Text>
        <Text style={styles.cardText}>"En 3 bullets..." · "Con una tabla..." · "Máximo 150 palabras..." · "En tono informal..."{'\n'}<Text style={styles.i}>Por qué importa:</Text> sin formato, la IA elige el suyo. Con formato, recibes exactamente lo que puedes usar.</Text>
      </ColorCard>
      <PromptBox>
        <Text style={{ color: '#7c3aed', fontWeight: '700' }}>Como coach de estudio universitario</Text> [ROL] <Text style={{ color: '#0369a1', fontWeight: '600' }}>para un estudiante de primer semestre que nunca ha estudiado álgebra</Text> [CONTEXTO], <Text style={{ color: '#166534', fontWeight: '600' }}>crea un plan de estudio de 5 días para dominar ecuaciones lineales</Text> [INSTRUCCIÓN]. <Text style={{ color: '#c2410c', fontWeight: '600' }}>Formato: un día por sección, con 2 recursos y 1 ejercicio práctico por día.</Text> [FORMATO]
      </PromptBox>
      <Hl variant="amber"><Text style={styles.b}>💡 Truco:</Text> No siempre necesitas los 4. Para tareas simples, 2 o 3 son suficientes. Pero para tareas complejas, los 4 juntos son imbatibles.</Hl>
    </View>
  );

  const renderBuilder = () => {
    const parts: { text: string; color: string }[] = [];
    if (builderRol) parts.push({ text: builderRol, color: '#7c3aed' });
    if (builderCtx) parts.push({ text: builderCtx, color: '#0369a1' });
    if (builderInst) parts.push({ text: builderInst, color: '#166534' });
    if (builderFmt) parts.push({ text: builderFmt, color: '#c2410c' });
    const filled = parts.length;
    const pct = Math.round((filled / 4) * 100);
    return (
      <View>
        <View style={[styles.tag, { backgroundColor: '#eff6ff' }]}><Text style={[styles.tagText, { color: '#1e40af' }]}>🧪 Módulo 4 de 18 · Constructor</Text></View>
        <Text style={styles.title}>Arma tu prompt pieza por pieza</Text>
        <Text style={styles.subtitle}>Selecciona una opción en cada sección. Ve cómo tu prompt se ensambla en tiempo real abajo.</Text>

        <BuilderSection label="🎭 ROL" sub="¿Quién debe ser la IA?" tagBg="#e9d5ff" tagColor="#5b21b6" options={BUILDER_ROL} selected={builderRol} onSelect={(v) => { setBuilderRol(v); setBuilderFb(false); }} />
        <BuilderSection label="📋 CONTEXTO" sub="¿Cuál es tu situación?" tagBg="#bfdbfe" tagColor="#1e40af" options={BUILDER_CTX} selected={builderCtx} onSelect={(v) => { setBuilderCtx(v); setBuilderFb(false); }} />
        <BuilderSection label="🎯 INSTRUCCIÓN" sub="¿Qué debe hacer?" tagBg="#bbf7d0" tagColor="#166534" options={BUILDER_INST} selected={builderInst} onSelect={(v) => { setBuilderInst(v); setBuilderFb(false); }} />
        <BuilderSection label="📐 FORMATO" sub="¿Cómo quieres la respuesta?" tagBg="#fed7aa" tagColor="#c2410c" options={BUILDER_FMT} selected={builderFmt} onSelect={(v) => { setBuilderFmt(v); setBuilderFb(false); }} />

        <View style={[styles.builderPreview, filled > 0 && { borderColor: '#f97316', backgroundColor: '#fff7ed' }]}>
          <Text style={styles.builderPreviewLabel}>{filled > 0 ? 'Tu prompt aparece aquí conforme eliges 👆' : 'Tu prompt aparece aquí conforme eliges 👆'}</Text>
          {filled === 0 ? (
            <Text style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', fontFamily: 'monospace' }}>Selecciona las 4 secciones para construir tu prompt...</Text>
          ) : (
            <Text style={{ fontSize: 12, fontFamily: 'monospace', lineHeight: 20 }}>
              {parts.map((p, i) => (
                <Text key={i} style={{ color: p.color }}>{p.text}{i < parts.length - 1 ? ', ' : ''}</Text>
              ))}
            </Text>
          )}
        </View>

        {filled > 0 && (
          <View style={styles.promptScore}>
            <Text style={styles.promptScoreLabel}>Calidad del prompt</Text>
            <View style={styles.promptScoreBar}>
              <View style={{ height: '100%', width: `${pct}%`, borderRadius: 5, backgroundColor: pct === 100 ? '#10b981' : '#f97316' }} />
            </View>
            <Text style={[styles.promptScoreVal, { color: pct === 100 ? '#10b981' : '#f97316' }]}>{pct}%</Text>
          </View>
        )}

        {filled === 4 && <FeedbackBar type="correct">✓ Prompt completo con los 4 ingredientes. ¡Listo para usar!</FeedbackBar>}
        {builderFb && filled < 4 && <FeedbackBar type="wrong">Faltan {4 - filled} secciones. Elige una opción en cada bloque de color.</FeedbackBar>}
      </View>
    );
  };

  const renderDiagnosis = () => {
    const item = diagItems[diagCurrent];
    return (
      <View>
        <View style={[styles.tag, { backgroundColor: '#fef3c7' }]}><Text style={[styles.tagText, { color: '#92400e' }]}>🎯 Módulo 5 de 18 · Diagnóstico</Text></View>
        <Text style={styles.title}>¿Qué le falta a este prompt?</Text>
        <Text style={styles.subtitle}>Analiza cada prompt y marca qué ingredientes están ausentes. ¡Cuidado! algunos están completos.</Text>
        <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748b', marginBottom: 8 }}>Prompt {diagCurrent + 1} de {diagItems.length}</Text>
        <View style={styles.monoBox}>
          <Text style={styles.monoText}>{item.prompt}</Text>
        </View>
        <Text style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>¿Qué ingredientes le faltan? Selecciona todos los que apliquen. Si está completo, no selecciones ninguno.</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          {item.allOpts.map((opt) => {
            const isSel = !!diagAnswers[opt.id];
            const isCorrect = item.correct.includes(opt.id);
            const showCorrect = diagChecked && isCorrect;
            const showWrong = diagChecked && isSel && !isCorrect;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[styles.ingrBtn, isSel && styles.ingrBtnSel, showCorrect && styles.ingrBtnCorrect, showWrong && styles.ingrBtnWrong]}
                onPress={() => toggleIngr(opt.id)}
                disabled={diagChecked}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: showCorrect ? '#166534' : showWrong ? '#991b1b' : '#374151' }}>{opt.label}</Text>
                <Text style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>{opt.text}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {diagResult && (
          <FeedbackBar type={diagResult.ok ? 'correct' : 'wrong'}>{diagResult.ok ? '✓ ¡Correcto! — ' : '✗ No del todo — '}{diagResult.explain}</FeedbackBar>
        )}
      </View>
    );
  };

  const renderTheory3 = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fdf4ff' }]}><Text style={[styles.tagText, { color: '#7e22ce' }]}>📖 Módulo 6 de 18 · Técnicas avanzadas</Text></View>
      <Text style={styles.title}>Zero-shot, Few-shot y Chain of Thought</Text>
      <Text style={styles.subtitle}>Tres técnicas que los expertos usan. Son nombres intimidantes para conceptos simples.</Text>
      <ColorCard variant="blue" style={{ marginBottom: 9 }}>
        <Text style={styles.cardTitle}>⚡ Zero-shot — Sin ejemplos</Text>
        <Text style={styles.cardText}>Le das la instrucción directamente, sin ejemplos previos. Funciona bien para tareas simples o cuando el LLM ya tiene suficiente contexto.</Text>
        <PromptBox>"Resume este artículo en 3 puntos clave"</PromptBox>
        <Text style={styles.cardText}>Cuando usarlo: tareas estándar, cuando la instrucción es clara por sí sola.</Text>
      </ColorCard>
      <ColorCard variant="purple" style={{ marginBottom: 9 }}>
        <Text style={styles.cardTitle}>🎯 Few-shot — Con 2-3 ejemplos</Text>
        <Text style={styles.cardText}>Le muestras ejemplos del patrón que quieres antes de pedir el tuyo. Es la técnica más poderosa para formato y estilo.</Text>
        <PromptBox>{"\"Transforma estas notas en bullets así:\nNota: 'el cielo es azul' → Bullet: 'Cielo: color azul'\nNota: 'llueve hoy' → Bullet: 'Clima: lluvia'\nAhora transforma: 'la reunión es a las 3pm'\""}</PromptBox>
      </ColorCard>
      <ColorCard variant="green" style={{ marginBottom: 9 }}>
        <Text style={styles.cardTitle}>🧠 Chain of Thought — Paso a paso</Text>
        <Text style={styles.cardText}>Le pides que razone en voz alta antes de dar la respuesta final. Mejora dramáticamente la precisión en problemas complejos.</Text>
        <PromptBox>"Resuelve este problema paso a paso, explicando tu razonamiento en cada paso antes de dar la respuesta final: Si María tiene 3 veces más canicas que Juan, y entre los dos tienen 48, ¿cuántas tiene cada uno?"</PromptBox>
      </ColorCard>
      <Hl variant="orange"><Text style={styles.b}>🎯 ¿Cuándo usar cuál?</Text>{'\n'}<Text style={styles.b}>Zero-shot:</Text> tareas simples y directas · <Text style={styles.b}>Few-shot:</Text> cuando necesitas un formato o estilo específico · <Text style={styles.b}>Chain of Thought:</Text> matemáticas, lógica, análisis complejos</Hl>
    </View>
  );

  const renderRefinement = () => {
    const round = refineScenario.rounds[refineRound];
    return (
      <View>
        <View style={[styles.tag, { backgroundColor: '#fff1f2' }]}><Text style={[styles.tagText, { color: '#9f1239' }]}>🔁 Módulo 7 de 18 · Refinamiento</Text></View>
        <Text style={styles.title}>Mejora este prompt en 3 rondas</Text>
        <Text style={styles.subtitle}>Parte de un prompt terrible. En cada ronda elige la mejor mejora. Tu objetivo: llegar al 100% de calidad.</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
          <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '600' }}>Calidad del prompt</Text>
          <Text style={{ fontSize: 12, fontWeight: '700' }}>{refineQuality}%</Text>
        </View>
        <View style={styles.qualityTrack}>
          <View style={{ height: '100%', width: `${refineQuality}%`, backgroundColor: refineQuality >= 80 ? '#10b981' : refineQuality >= 50 ? '#f59e0b' : '#ef4444', borderRadius: 6 }} />
        </View>
        <View style={[styles.refinePrompt, refineDone && { borderColor: '#10b981', backgroundColor: '#f0fdf4' }]}>
          <Text style={{ fontSize: 12, fontFamily: 'monospace', color: '#334155', lineHeight: 20 }}>📝 Prompt actual:{'\n\n'}"{refineScenario.start}"</Text>
        </View>
        {/* Round indicator */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          {[0, 1, 2].map((i) => {
            const done = i < refineResults.length;
            const active = i === refineRound && !refineDone;
            const mark = done ? (refineResults[i] === 'best' ? '✓' : refineResults[i] === 'ok' ? '~' : '✗') : `${i + 1}`;
            return (
              <View key={i} style={[styles.roundDot, active && styles.roundDotActive, done && styles.roundDotDone]}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: done ? '#166534' : active ? '#c2410c' : '#94a3b8' }}>{mark}</Text>
              </View>
            );
          })}
          <Text style={{ fontSize: 11, color: '#64748b', marginLeft: 6 }}>Ronda actual</Text>
        </View>
        {refineDone ? (
          <FeedbackBar type="correct">🏆 ¡Proceso completado! Tu prompt quedó al {refineQuality}% de calidad.</FeedbackBar>
        ) : round ? (
          <View>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#0f172a', padding: 10, backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 10 }}>
              {refineRound + 1}/{refineScenario.rounds.length} · {round.question}
            </Text>
            {round.opts.map((opt, idx) => {
              const sel = refineSel && refineSel.idx === idx;
              const selStyle = sel ? (opt.type === 'best' ? styles.roBest : opt.type === 'ok' ? styles.roOk : styles.roBad) : null;
              return (
                <TouchableOpacity key={idx} style={[styles.refineOpt, selStyle]} onPress={() => selectRefineOpt(idx)} disabled={refineSel !== null}>
                  <Text style={{ fontSize: 12, color: sel ? (opt.type === 'best' ? '#166534' : opt.type === 'ok' ? '#92400e' : '#991b1b') : '#334155', lineHeight: 17 }}>{opt.text}</Text>
                </TouchableOpacity>
              );
            })}
            {refineSel && (
              <FeedbackBar type={refineSel.type === 'best' ? 'correct' : refineSel.type === 'ok' ? 'info' : 'wrong'}>
                {refineSel.type === 'best' ? '🎯 ¡Mejor opción! El prompt mejoró significativamente.' : refineSel.type === 'ok' ? '👍 Mejora moderada. Hay una opción mejor en esta ronda.' : '📉 Esta opción debilita el prompt.'}
              </FeedbackBar>
            )}
          </View>
        ) : null}
      </View>
    );
  };

  const renderRoleTheory = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fdf4ff' }]}><Text style={[styles.tagText, { color: '#7e22ce' }]}>📖 Módulo 8 de 18 · Roles y personas</Text></View>
      <Text style={styles.title}>Hablarle a la IA como a un experto</Text>
      <Text style={styles.subtitle}>El ingrediente ROL es tan poderoso que merece su propio módulo.</Text>
      <Text style={styles.bodyText}>Cuando le asignas un rol a un LLM, activas un modo de respuesta completamente diferente. El modelo fue entrenado con textos de médicos, chefs, abogados, programadores, profesores... Al decirle el rol, activas ese "modo" específico.</Text>
      <ColorCard variant="slate" style={{ marginBottom: 9 }}>
        <Text style={styles.cardTitle}>🔄 La misma pregunta, 3 roles distintos</Text>
        <Text style={{ fontSize: 11, color: '#64748b', marginBottom: 6, fontStyle: 'italic' }}>Pregunta: "¿Cómo manejo el estrés?"</Text>
        <Text style={styles.cardText}>🩺 <Text style={styles.b}>Como psicólogo clínico:</Text> "La respuesta al estrés involucra el eje hipotálamo-hipófisis-adrenal y la liberación de cortisol..." (técnico, detallado){'\n\n'}🏋️ <Text style={styles.b}>Como coach de bienestar:</Text> "Prueba la técnica 5-4-3-2-1: nombra 5 cosas que ves, 4 que tocas..." (práctico, accionable){'\n\n'}👩‍🏫 <Text style={styles.b}>Como profesora de secundaria:</Text> "El estrés es como una olla a presión — si no le das salida, explota. Aquí 3 válvulas de escape que funcionan para estudiantes..." (analogía, accesible)</Text>
      </ColorCard>
      <Text style={styles.sectionTitle}>Cómo construir un buen rol</Text>
      <View style={{ marginVertical: 8 }}>
        <StepRow n={1}>Especifica la <Text style={styles.b}>especialidad</Text>: no "médico" sino "pediatra especializada en nutrición infantil"</StepRow>
        <StepRow n={2}>Agrega la <Text style={styles.b}>audiencia</Text>: "...que habla con adolescentes de 14-17 años"</StepRow>
        <StepRow n={3}>Incluye el <Text style={styles.b}>estilo</Text>: "...con un tono cercano, sin tecnicismos"</StepRow>
      </View>
      <PromptBox><Text style={{ color: '#7c3aed', fontWeight: '700' }}>Actúa como una nutricionista pediátrica con 10 años de experiencia que trabaja con adolescentes deportistas</Text> y que tiene un estilo directo y motivador.</PromptBox>
      <Hl variant="purple"><Text style={styles.b}>⚠️ Límites importantes del ROL:</Text>{'\n'}Un rol no le da poderes mágicos a la IA ni la hace más "real". Un "médico simulado" no reemplaza a un médico real. Nunca uses respuestas de un LLM con rol médico/legal como sustituto de consulta profesional.</Hl>
    </View>
  );

  const renderRolePicker = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#f5f3ff' }]}><Text style={[styles.tagText, { color: '#5b21b6' }]}>🎭 Módulo 9 de 18 · Role Picker</Text></View>
      <Text style={styles.title}>¿Qué rol le asignarías?</Text>
      <Text style={styles.subtitle}>Para cada situación, elige el rol que daría la respuesta más útil y específica.</Text>
      {roleItems.map((scenario, si) => (
        <View key={si} style={styles.roleScenario}>
          <Text style={styles.roleScenarioText}><Text style={styles.b}>Situación {si + 1}:</Text> {scenario.situation}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {scenario.opts.map((opt, oi) => {
              const isSel = roleAnswers[si] === oi;
              const showCorrect = roleChecked && oi === scenario.correct;
              const showWrong = roleChecked && isSel && oi !== scenario.correct;
              return (
                <TouchableOpacity
                  key={oi}
                  style={[styles.roleOpt, isSel && styles.roleOptSel, showCorrect && styles.roleOptCorrect, showWrong && styles.roleOptWrong]}
                  onPress={() => selectRole(si, oi)}
                  disabled={roleChecked}
                >
                  <Text style={{ fontSize: 11, fontWeight: '600', color: showCorrect ? '#166534' : showWrong ? '#991b1b' : isSel ? '#5b21b6' : '#374151' }}>{opt}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {roleChecked && (
            <FeedbackBar type={roleAnswers[si] === scenario.correct ? 'correct' : 'wrong'}>
              {roleAnswers[si] === scenario.correct ? `✓ ${scenario.explain}` : `✗ La respuesta es "${scenario.opts[scenario.correct]}" — ${scenario.explain}`}
            </FeedbackBar>
          )}
        </View>
      ))}
    </View>
  );

  const renderEthics = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#f0fdf4' }]}><Text style={[styles.tagText, { color: '#166534' }]}>⚖️ Módulo 10 de 18 · Juicio ético</Text></View>
      <Text style={styles.title}>¿Este prompt es ético?</Text>
      <Text style={styles.subtitle}>Los expertos en IA no solo saben hacer buenos prompts — también saben cuáles no deberían hacerse.</Text>
      <ColorCard variant="slate" style={{ marginBottom: 11 }}>
        <Text style={{ fontSize: 11, color: '#334155', lineHeight: 17 }}>🟢 <Text style={styles.b}>Seguro</Text> — Completamente válido · 🟡 <Text style={styles.b}>Dudoso</Text> — Depende del uso · 🔴 <Text style={styles.b}>Problemático</Text> — No debería hacerse</Text>
      </ColorCard>
      {ethicsItems.map((item, idx) => {
        const sel = ethicsAnswers[idx];
        const btn = (val: string, emoji: string, label: string, selBg: string, selBorder: string) => {
          const isSel = sel === val;
          const isCorrect = ethicsChecked && item.correct === val;
          const isWrongPick = ethicsChecked && isSel && sel !== item.correct;
          const active = isSel || isCorrect;
          return (
            <TouchableOpacity
              style={[styles.ethicsBtn, { borderColor: selBorder }, active && { backgroundColor: selBg }, isWrongPick && { opacity: 0.4 }]}
              onPress={() => selectEthics(idx, val)}
              disabled={ethicsChecked}
            >
              <Text style={{ fontSize: 20 }}>{emoji}</Text>
              <Text style={{ fontSize: 10, fontWeight: '700' }}>{label}</Text>
            </TouchableOpacity>
          );
        };
        return (
          <View key={idx} style={{ marginBottom: 16 }}>
            <Text style={styles.ethicsNum}>Prompt {idx + 1} de {ethicsItems.length}</Text>
            <View style={styles.monoBox}>
              <Text style={styles.monoText}>{item.prompt}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
              {btn('safe', '🟢', 'Seguro', '#dcfce7', '#10b981')}
              {btn('doubt', '🟡', 'Dudoso', '#fef3c7', '#f59e0b')}
              {btn('prob', '🔴', 'Problemático', '#fee2e2', '#ef4444')}
            </View>
            {ethicsChecked && (
              <FeedbackBar type={sel === item.correct ? 'correct' : 'wrong'}>{sel === item.correct ? '✓ ' : '✗ '}{item.explain}</FeedbackBar>
            )}
          </View>
        );
      })}
    </View>
  );

  const renderStudyTheory = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fdf4ff' }]}><Text style={[styles.tagText, { color: '#7e22ce' }]}>📖 Módulo 11 de 18 · Prompts para estudiar</Text></View>
      <Text style={styles.title}>La fórmula que cambia cómo estudias</Text>
      <Text style={styles.subtitle}>Los LLMs son los tutores más accesibles de la historia. Pero solo si sabes pedirles lo correcto.</Text>
      <Hl variant="orange"><Text style={styles.b}>🎓 El error #1 de los estudiantes con IA:</Text>{'\n'}Pedirle que haga el trabajo por ellos en lugar de pedirle que les enseñe a hacerlo. El resultado: no aprenden nada y se vuelven dependientes.</Hl>
      <Text style={styles.sectionTitle}>5 tipos de prompts de estudio que funcionan</Text>
      <ColorCard variant="green" style={{ marginBottom: 7 }}><Text style={styles.cardTitle}>❓ El Interrogador</Text><Text style={styles.cardText}>"Hazme 10 preguntas de práctica sobre [tema], de menor a mayor dificultad. Después de cada respuesta mía, dime si estoy bien o mal y por qué."</Text></ColorCard>
      <ColorCard variant="blue" style={{ marginBottom: 7 }}><Text style={styles.cardTitle}>🔍 El Simplificador</Text><Text style={styles.cardText}>"Explícame [concepto difícil] como si tuviera [tu edad] años, usando una analogía con [algo que me gusta]."</Text></ColorCard>
      <ColorCard variant="purple" style={{ marginBottom: 7 }}><Text style={styles.cardTitle}>✏️ El Corrector</Text><Text style={styles.cardText}>"Lee mi respuesta a este problema y dime qué está bien, qué está mal y cómo mejorarla. No me des la respuesta directamente — guíame."</Text></ColorCard>
      <ColorCard variant="amber" style={{ marginBottom: 7 }}><Text style={styles.cardTitle}>🗺️ El Organizador</Text><Text style={styles.cardText}>"Crea un mapa mental en formato de texto con los 5 conceptos más importantes de [tema], sus conexiones y un ejemplo de cada uno."</Text></ColorCard>
      <ColorCard variant="orange" style={{ marginBottom: 7 }}><Text style={styles.cardTitle}>⚡ El Desafiador</Text><Text style={styles.cardText}>"Dame el escenario más difícil posible de [tema] que probablemente salga en el examen, y si me trabo dame pistas en lugar de la respuesta."</Text></ColorCard>
    </View>
  );

  const renderMission = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fdf2f8' }]}><Text style={[styles.tagText, { color: '#9d174d' }]}>🏗️ Módulo 12 de 18 · Misión</Text></View>
      <Text style={styles.title}>Construye 3 prompts de estudio reales</Text>
      <Text style={styles.subtitle}>Para cada materia, llena los campos. Tu prompt se ensambla en tiempo real. Estos prompts los puedes usar esta semana.</Text>
      {MISSION_SUBJECTS.map((sub, si) => {
        const data = missionData[si] || {};
        const filled = Object.values(data).filter((v) => v && v.trim().length > 0).length;
        const pct = Math.round((filled / sub.fields.length) * 100);
        const parts = MISSION_PREVIEW_LABELS.map((lbl, i) => (data[i] && data[i].trim() ? `${lbl}: ${data[i].trim()}` : null)).filter(Boolean);
        return (
          <View key={si} style={styles.missionCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <View style={[styles.missionEmoji, { backgroundColor: MISSION_EMOJI_BG[si] }]}><Text style={{ fontSize: 22 }}>{sub.emoji}</Text></View>
              <View><Text style={styles.missionName}>{sub.name}</Text><Text style={styles.missionDesc}>{sub.desc}</Text></View>
            </View>
            {sub.fields.map((field, fi) => (
              <View key={fi} style={{ marginBottom: 9 }}>
                <Text style={styles.missionFieldLabel}>{field}</Text>
                <TextInput
                  style={[styles.missionInput, data[fi] && data[fi].trim().length > 0 && { borderColor: '#f97316', backgroundColor: '#fff7ed' }]}
                  placeholder="Escribe aquí..."
                  placeholderTextColor="#b8bcc0"
                  value={data[fi] || ''}
                  onChangeText={(val) => updateMissionField(si, fi, val)}
                />
              </View>
            ))}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <View style={{ flex: 1, height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                <View style={{ height: '100%', width: `${pct}%`, backgroundColor: '#f97316', borderRadius: 4 }} />
              </View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#c2410c', minWidth: 34, textAlign: 'right' }}>{pct}%</Text>
            </View>
            {parts.length > 0 && (
              <View style={styles.missionResult}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#c2410c', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Tu prompt ensamblado:</Text>
                <Text style={{ fontSize: 12, fontFamily: 'monospace', color: '#334155', lineHeight: 20 }}>{parts.join(' · ')}</Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );

  const renderDetective = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#f0f9ff' }]}><Text style={[styles.tagText, { color: '#0369a1' }]}>🔍 Módulo 13 de 18 · Detective</Text></View>
      <Text style={styles.title}>Encuentra el error en el prompt</Text>
      <Text style={styles.subtitle}>Cada caso muestra un prompt que produjo un resultado malo. ¿Por qué falló?</Text>
      {detectItems.map((item, di) => (
        <View key={di} style={{ marginBottom: 18 }}>
          <View style={styles.detectScenario}>
            <Text style={styles.detectLabel}>CASO {di + 1} DE {detectItems.length}</Text>
            <View style={styles.detectPromptBox}><Text style={{ fontFamily: 'monospace', fontSize: 11, color: '#334155', lineHeight: 17 }}>Prompt: {item.prompt}</Text></View>
            <Text style={styles.detectResponse}>Resultado: "{item.response}"</Text>
          </View>
          <Text style={styles.detectQuestion}>{item.question}</Text>
          {item.opts.map((opt, oi) => {
            const isSel = detectAnswers[di] === oi;
            const showCorrect = detectChecked && oi === item.correct;
            const showWrong = detectChecked && isSel && oi !== item.correct;
            return (
              <TouchableOpacity
                key={oi}
                style={[styles.detectOpt, isSel && styles.detectOptSel, showCorrect && styles.detectOptCorrect, showWrong && styles.detectOptWrong]}
                onPress={() => selectDetect(di, oi)}
                disabled={detectChecked}
              >
                <View style={[styles.doLetter, isSel && { backgroundColor: '#3b82f6', borderColor: '#3b82f6' }, showCorrect && { backgroundColor: '#10b981', borderColor: '#10b981' }, showWrong && { backgroundColor: '#ef4444', borderColor: '#ef4444' }]}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: isSel || showCorrect || showWrong ? '#fff' : '#64748b' }}>{String.fromCharCode(65 + oi)}</Text>
                </View>
                <Text style={{ flex: 1, fontSize: 12, color: '#334155', lineHeight: 17 }}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
          {detectChecked && (
            <FeedbackBar type={detectAnswers[di] === item.correct ? 'correct' : 'wrong'}>{detectAnswers[di] === item.correct ? '✓ ' : '✗ '}{item.explain}</FeedbackBar>
          )}
        </View>
      ))}
    </View>
  );

  const renderSprint = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fef9c3' }]}><Text style={[styles.tagText, { color: '#713f12' }]}>⚡ Módulo 14 de 18 · Sprint</Text></View>
      <Text style={styles.title}>Prompt Sprint — ¡Rápido!</Text>
      <Text style={styles.subtitle}>Para cada situación, elige el prompt correcto. Tienes 60 segundos por pregunta. Más rápido = más XP.</Text>
      <View style={styles.sprintScore}>
        <View><Text style={styles.sprintScoreLabel}>Aciertos</Text><Text style={styles.sprintScoreVal}>{sprintCorrect}/{sprintItems.length}</Text></View>
        <View style={{ alignItems: 'center' }}><Text style={styles.sprintScoreLabel}>Pregunta</Text><Text style={styles.sprintScoreVal}>{Math.min(sprintIdx + 1, sprintItems.length)}/{sprintItems.length}</Text></View>
        <View style={{ alignItems: 'flex-end' }}><Text style={styles.sprintScoreLabel}>Tiempo</Text><Text style={[styles.sprintCountdown, sprintTimeLeft <= 10 && { color: '#ef4444' }]}>{sprintTimeLeft}</Text></View>
      </View>
      <View style={{ height: 6, backgroundColor: '#f1f5f9', borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}>
        <View style={{ height: '100%', width: `${(sprintTimeLeft / 60) * 100}%`, backgroundColor: '#10b981', borderRadius: 3 }} />
      </View>
      {sprintDone ? (
        <FeedbackBar type="correct">🏆 Sprint completado: {sprintCorrect}/{sprintItems.length} correctas.</FeedbackBar>
      ) : (
        <View>
          <Text style={styles.sprintSituation}>{sprintItems[sprintIdx].situation}</Text>
          {sprintItems[sprintIdx].opts.map((opt, idx) => {
            const showCorrect = sprintAnswered && idx === sprintItems[sprintIdx].correct;
            const showWrong = sprintAnswered && idx === sprintSel && idx !== sprintItems[sprintIdx].correct;
            return (
              <TouchableOpacity key={idx} style={[styles.sprintOpt, showCorrect && styles.spCorrect, showWrong && styles.spWrong]} onPress={() => selectSprintOpt(idx)} disabled={sprintAnswered}>
                <Text style={{ fontSize: 12, fontFamily: 'monospace', color: showCorrect ? '#166534' : showWrong ? '#991b1b' : '#334155', lineHeight: 17 }}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
          {sprintFb && <FeedbackBar type={sprintFb.type}>{sprintFb.msg}</FeedbackBar>}
        </View>
      )}
    </View>
  );

  const renderSort = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#ecfeff' }]}><Text style={[styles.tagText, { color: '#164e63' }]}>↕️ Módulo 15 de 18 · Ordenar</Text></View>
      <Text style={styles.title}>Del prompt vago a la respuesta inútil</Text>
      <Text style={styles.subtitle}>Ordena los pasos de cómo un mal prompt produce un resultado frustrante. Usa ▲▼ para ajustar.</Text>
      <ColorCard variant="slate" style={{ marginBottom: 10 }}>
        <Text style={{ fontSize: 11, color: '#334155', lineHeight: 17 }}>💡 Piensa: ¿qué es la causa y qué es la consecuencia? ¿Qué tiene que pasar primero para que lo siguiente ocurra?</Text>
      </ColorCard>
      {sortOrder.map((stepIdx, pos) => {
        const item = SORT_CAUSE_EFFECT[stepIdx];
        const isWrong = sortWrong.has(pos);
        const isOkMark = sortMarkOk;
        return (
          <View key={pos} style={[styles.sortItem, isOkMark && styles.sortItemOk, isWrong && styles.sortItemWrong]}>
            <View style={styles.sortNum}><Text style={{ color: '#fff', fontWeight: '700', fontSize: 11 }}>{pos + 1}</Text></View>
            <Text style={styles.sortText}><Text style={styles.b}>{item.bold}</Text>{item.rest}</Text>
            <View style={styles.sortArrows}>
              <TouchableOpacity style={[styles.sortBtn, pos === 0 && { opacity: 0.2 }]} onPress={() => moveSort(pos, -1)} disabled={pos === 0}>
                <MaterialIcons name="keyboard-arrow-up" size={18} color="#64748b" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.sortBtn, pos === sortOrder.length - 1 && { opacity: 0.2 }]} onPress={() => moveSort(pos, 1)} disabled={pos === sortOrder.length - 1}>
                <MaterialIcons name="keyboard-arrow-down" size={18} color="#64748b" />
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
      {sortFb && <FeedbackBar type={sortFb.type}>{sortFb.msg}</FeedbackBar>}
    </View>
  );

  const renderProjectsTheory = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fdf4ff' }]}><Text style={[styles.tagText, { color: '#7e22ce' }]}>📖 Módulo 16 de 18 · Prompts para proyectos</Text></View>
      <Text style={styles.title}>Prompts para crear con IA</Text>
      <Text style={styles.subtitle}>Hasta ahora usaste prompts para aprender. Ahora mira cómo se usan para crear proyectos reales. Esto es lo que verás en los Niveles 4 y 5.</Text>
      <Hl variant="blue"><Text style={styles.b}>🚀 El siguiente nivel del prompting:</Text>{'\n'}No solo pedir información — sino usar la IA como co-creador de aplicaciones, diseños, negocios y proyectos reales. Aquí un adelanto.</Hl>
      <ColorCard variant="blue" style={{ marginBottom: 9 }}><Text style={styles.cardTitle}>🛠️ Prompt para crear una app con Lovable</Text><Text style={[styles.cardText, { fontFamily: 'monospace', fontSize: 11 }]}>"Crea una aplicación web simple de lista de tareas para estudiantes. Debe tener: agregar tareas con fecha límite, marcarlas como completadas, y filtrar por materia. Diseño limpio, colores: azul y blanco. Sin necesidad de login."</Text></ColorCard>
      <ColorCard variant="purple" style={{ marginBottom: 9 }}><Text style={styles.cardTitle}>🗄️ Prompt para diseñar una base de datos</Text><Text style={[styles.cardText, { fontFamily: 'monospace', fontSize: 11 }]}>"Diseña el esquema de base de datos para una plataforma de tutorías online. Necesito tablas para: estudiantes, tutores, sesiones, materias y pagos. Incluye los campos esenciales de cada tabla y las relaciones entre ellas."</Text></ColorCard>
      <ColorCard variant="green" style={{ marginBottom: 9 }}><Text style={styles.cardTitle}>🤖 Prompt para un agente IA</Text><Text style={[styles.cardText, { fontFamily: 'monospace', fontSize: 11 }]}>"Actúa como un asistente de estudio que guía a estudiantes paso a paso. Cuando alguien llegue, pregunta: nombre, grado y materia con dificultad. Luego crea un plan personalizado de 3 pasos con ejercicios progresivos. Tono: motivador y paciente."</Text></ColorCard>
      <Hl variant="orange"><Text style={styles.b}>🎯 Lo que viene:</Text>{'\n'}En el <Text style={styles.b}>N4</Text> vas a crear algo real con IA por primera vez — texto, imágenes, historias. En el <Text style={styles.b}>N5</Text> aprenderás a usar la IA de forma ética y responsable. El prompting que aprendiste ahora es el cimiento de todo eso.</Hl>
    </View>
  );

  const renderTF = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fff7ed' }]}><Text style={[styles.tagText, { color: '#9a3412' }]}>✅ Módulo 17 de 18 · Verdadero o Falso</Text></View>
      <Text style={styles.title}>Mitos del prompting — ¿realidad o mentira?</Text>
      <Text style={styles.subtitle}>Estas son afirmaciones que circulan sobre los prompts y los LLMs. Algunas son verdad, otras son mitos extendidos. ¿Puedes distinguirlos?</Text>
      {tfItems.map((item, idx) => {
        const sel = tfAnswers[idx];
        const tCorrect = tfChecked && item.correct === true;
        const fCorrect = tfChecked && item.correct === false;
        const tWrong = tfChecked && sel === true && item.correct !== true;
        const fWrong = tfChecked && sel === false && item.correct !== false;
        return (
          <View key={idx} style={{ marginBottom: 14 }}>
            <Text style={styles.tfQuestion}>{idx + 1}. {item.stmt}</Text>
            <View style={{ flexDirection: 'row', gap: 7 }}>
              <TouchableOpacity style={[styles.tfBtn, sel === true && styles.tfBtnTrue, tCorrect && styles.tfBtnCorrect, tWrong && styles.tfBtnWrong]} onPress={() => selectTF(idx, true)} disabled={tfChecked}>
                <Text style={{ fontWeight: '700', color: tCorrect ? '#166534' : tWrong ? '#991b1b' : sel === true ? '#166534' : '#334155' }}>✅ Verdadero</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tfBtn, sel === false && styles.tfBtnFalse, fCorrect && styles.tfBtnCorrect, fWrong && styles.tfBtnWrong]} onPress={() => selectTF(idx, false)} disabled={tfChecked}>
                <Text style={{ fontWeight: '700', color: fCorrect ? '#166534' : fWrong ? '#991b1b' : sel === false ? '#991b1b' : '#334155' }}>❌ Falso</Text>
              </TouchableOpacity>
            </View>
            {tfChecked && (
              <FeedbackBar type={sel === item.correct ? 'correct' : 'wrong'}>{sel === item.correct ? '✓ Correcto — ' : '✗ Incorrecto — '}{item.explain}</FeedbackBar>
            )}
          </View>
        );
      })}
    </View>
  );

  const renderReflect = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#f8fafc' }]}><Text style={[styles.tagText, { color: '#475569' }]}>✍️ Módulo 18 de 18 · Reflexión</Text></View>
      <Text style={styles.title}>Tu prompt más importante</Text>
      <Text style={styles.subtitle}>Aprendiste los 4 ingredientes, las técnicas avanzadas y cómo evitar errores. Ahora construye algo real.</Text>
      <ColorCard variant="orange" style={{ marginBottom: 12 }}>
        <Text style={styles.cardTitle}>✍️ Tu tarea de reflexión</Text>
        <Text style={styles.cardText}>Escribe el prompt que usarías <Text style={styles.b}>esta semana</Text> para una tarea real de tu vida (estudio, proyecto, hobby, trabajo...). Incluye los 4 ingredientes: ROL · CONTEXTO · INSTRUCCIÓN · FORMATO{'\n\n'}Y explica brevemente: ¿por qué lo estructuraste así?</Text>
      </ColorCard>
      <TextInput
        style={styles.textArea}
        multiline
        numberOfLines={6}
        placeholder={'Ejemplo: Actúa como un coach de matemáticas para estudiantes de 10° grado [ROL]. Estoy estudiando para mi examen de cálculo diferencial que es en 3 días, no entiendo los límites [CONTEXTO]. Explícame el concepto de límite usando una analogía con algo de la vida cotidiana [INSTRUCCIÓN]. En máximo 150 palabras y con un ejercicio de práctica al final [FORMATO].\n\nLo estructuré así porque...'}
        placeholderTextColor="#b8bcc0"
        value={reflectText}
        onChangeText={setReflectText}
      />
      <Text style={{ fontSize: 11, color: '#94a3b8', textAlign: 'right', marginTop: 4 }}>{reflectText.trim().length} / 80 mínimo</Text>
      <Hl variant="green">✅ Este prompt queda guardado en tu portafolio IA Explorer. Es evidencia real de que sabes construir prompts — no solo teóricamente.</Hl>
    </View>
  );

  const renderCompletion = () => (
    <View style={{ alignItems: 'center', padding: 8 }}>
      <View style={styles.completeBadge}><Text style={{ fontSize: 46 }}>🏆</Text></View>
      <Text style={[styles.title, { textAlign: 'center', fontSize: 22 }]}>¡Nivel 3 completado!</Text>
      <Text style={[styles.subtitle, { textAlign: 'center' }]}>Terminaste "El Arte del Prompting". Ahora tienes una habilidad que la mayoría de adultos no tiene: saber comunicarte con IA de forma efectiva, ética y estratégica.</Text>
      <View style={styles.xpEarned}><Text style={{ fontSize: 15, fontWeight: '700', color: '#92400e' }}>⭐ {xp} XP ganados en este nivel</Text></View>
      <View style={{ width: '100%', marginBottom: 14 }}>
        {[
          'Construyo prompts con los 4 ingredientes: Rol, Contexto, Instrucción y Formato',
          'Aplico técnicas avanzadas: Zero-shot, Few-shot y Chain of Thought',
          'Diagnostico qué le falta a un prompt y cómo mejorarlo en iteraciones',
          'Evalúo si un prompt es ético y por qué algunos no deberían usarse',
          'Creo prompts específicos para estudiar y para construir proyectos con IA',
        ].map((skill, i) => (
          <View key={i} style={styles.skillRow}>
            <Text style={styles.skillCheck}>✓</Text>
            <Text style={styles.skillText}>{skill}</Text>
          </View>
        ))}
      </View>
      <View style={styles.nextHint}>
        <Text style={{ fontSize: 12, color: '#334155', lineHeight: 18 }}>🚀 <Text style={styles.b}>Nivel 4: ¡Crea algo con IA Hoy!</Text>{'\n\n'}Vas a usar ChatGPT o Claude para crear algo real por primera vez — una historia, una imagen, un resumen, un personaje. De aprender sobre la IA a crear con ella.</Text>
      </View>
      <View style={{ width: '100%', marginBottom: 14 }}>
        <Text style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>Nivel 3 de 36 completado · Mundo 1 — ¿Qué es la IA?</Text>
        <View style={{ height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
          <View style={{ height: '100%', width: '15%', backgroundColor: '#f97316', borderRadius: 3 }} />
        </View>
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
      case 2: return renderLab();
      case 3: return renderTheory2();
      case 4: return renderBuilder();
      case 5: return renderDiagnosis();
      case 6: return renderTheory3();
      case 7: return renderRefinement();
      case 8: return renderRoleTheory();
      case 9: return renderRolePicker();
      case 10: return renderEthics();
      case 11: return renderStudyTheory();
      case 12: return renderMission();
      case 13: return renderDetective();
      case 14: return renderSprint();
      case 15: return renderSort();
      case 16: return renderProjectsTheory();
      case 17: return renderTF();
      case 18: return renderReflect();
      case 19: return renderCompletion();
      default: return null;
    }
  };

  const progressPercent = (step / (TOTAL_STEPS - 1)) * 100;
  const progLabel = step === 0 ? 'Introducción' : step < TOTAL_STEPS - 1 ? `Módulo ${step} de ${CONTENT_STEPS}` : '¡Nivel completado!';
  const stepsCounter = step === 0 ? '' : step < TOTAL_STEPS - 1 ? `${step} de ${CONTENT_STEPS} módulos completados` : `${CONTENT_STEPS} de ${CONTENT_STEPS} módulos completados`;

  const CHECK_STEPS = [4, 5, 7, 9, 10, 12, 13, 14, 15, 17, 18];
  const showNextBtn = step < TOTAL_STEPS - 1 && !CHECK_STEPS.includes(step);
  const showCheckBtn = CHECK_STEPS.includes(step) && step < TOTAL_STEPS - 1;

  const handleMainBtn = () => {
    const stepHandlers: Record<number, (() => boolean) | undefined> = {
      4: checkBuilder,
      5: checkDiag,
      7: () => refineDone,
      9: checkRole,
      10: checkEthics,
      12: checkMission,
      13: checkDetect,
      14: () => sprintDone,
      15: checkSort,
      17: checkTF,
      18: checkReflect,
    };
    const handler = stepHandlers[step];
    if (handler && !handler()) return;
    goToNextStep();
  };

  const nextBtnLabel = () => {
    if (step === 0) return '¡Vamos! 🚀';
    if (step === 2) return 'Listo, lo entendí →';
    if (step === 3) return 'Los tengo claros →';
    return 'Entendido →';
  };

  const checkBtnLabel = () => {
    switch (step) {
      case 4: return 'Verificar mi prompt →';
      case 5:
        if (!diagChecked) return 'Verificar';
        return diagCurrent + 1 < diagItems.length ? 'Siguiente prompt →' : 'Continuar →';
      case 7: return 'Continuar →';
      case 9: return roleChecked ? 'Continuar →' : 'Verificar elecciones';
      case 10: return ethicsChecked ? 'Continuar →' : 'Comprobar';
      case 12: return 'Verificar misiones';
      case 13: return detectChecked ? 'Continuar →' : 'Comprobar diagnóstico';
      case 14: return 'Continuar →';
      case 15: return sortOk ? 'Continuar →' : 'Verificar orden';
      case 17: return tfChecked ? 'Continuar →' : 'Comprobar';
      case 18: return 'Enviar reflexión →';
      default: return 'Continuar →';
    }
  };

  const getNote = () => {
    switch (step) {
      case 0: return 'Tiempo estimado: 50-60 min · hasta 200 XP';
      case 2: return 'Compara los dos escenarios cuidadosamente 👆';
      case 4: return builderFb ? '' : 'Elige una opción en cada bloque de color';
      case 5: return diagChecked ? '' : 'Selecciona todos los ingredientes que faltan · puede ser ninguno';
      case 9: return roleChecked ? `${roleScore}/${roleItems.length} correctas · +${roleScore * 5} XP` : `Elige el rol más adecuado para cada situación · hasta ${roleItems.length * 5} XP`;
      case 10: return ethicsChecked ? `${ethicsScore}/${ethicsItems.length} correctas · +${ethicsScore * 6} XP` : `Clasifica cada prompt: Seguro · Dudoso · Problemático · hasta ${ethicsItems.length * 6} XP`;
      case 12: return 'Completa al menos 2 campos en cada materia para continuar';
      case 13: return detectChecked ? `${detectScore}/${detectItems.length} correctas · +${detectScore * 8} XP` : `Identifica por qué falló cada prompt · hasta ${detectItems.length * 8} XP`;
      case 17: return tfChecked ? `${tfScore}/${tfItems.length} correctas · +${tfScore * 6} XP` : `Responde las ${tfItems.length} afirmaciones · hasta ${tfItems.length * 6} XP`;
      case 18: return 'Escribe al menos 80 caracteres · +20 XP';
      default: return '';
    }
  };

  const note = getNote();
  const checkDisabled = (step === 7 && !refineDone) || (step === 14 && !sprintDone);

  return (
    <View style={styles.screen}>
      <View style={styles.progressBar}>
        <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
          <MaterialIcons name="close" size={24} color="#c2410c" />
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
              <TouchableOpacity style={[styles.nextButton, styles.nextButtonFlex, checkDisabled && { opacity: 0.32 }]} onPress={handleMainBtn} disabled={checkDisabled}>
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

// ===================== SUBCOMPONENTES =====================
function StepRow({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
      <View style={styles.stepNum}><Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{n}</Text></View>
      <Text style={{ flex: 1, fontSize: 12, color: '#334155', lineHeight: 18 }}>{children}</Text>
    </View>
  );
}

function BuilderSection({ label, sub, tagBg, tagColor, options, selected, onSelect }: {
  label: string; sub: string; tagBg: string; tagColor: string; options: { label: string; value: string }[]; selected: string; onSelect: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((o) => o.value === selected)?.label;
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 }}>
        <View style={{ backgroundColor: tagBg, paddingHorizontal: 8, paddingVertical: 1, borderRadius: 6 }}>
          <Text style={{ fontSize: 9, fontWeight: '700', color: tagColor, textTransform: 'uppercase' }}>{label}</Text>
        </View>
        <Text style={{ fontSize: 11, fontWeight: '700', color: '#374151' }}>{sub}</Text>
      </View>
      <TouchableOpacity style={[styles.builderSelect, selected ? { borderColor: '#f97316', backgroundColor: '#fff7ed' } : {}]} onPress={() => setOpen(!open)}>
        <Text style={{ fontSize: 12, color: selected ? '#334155' : '#94a3b8' }}>{selectedLabel || '— Elige una opción —'}</Text>
        <MaterialIcons name={open ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={18} color="#64748b" />
      </TouchableOpacity>
      {open && (
        <View style={{ backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginTop: 4, padding: 8 }}>
          {options.map((opt, idx) => (
            <TouchableOpacity
              key={idx}
              style={{ padding: 10, borderRadius: 8, backgroundColor: selected === opt.value ? tagBg : '#fff' }}
              onPress={() => { onSelect(opt.value); setOpen(false); }}
            >
              <Text style={{ fontSize: 12, color: '#334155' }}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ===================== ESTILOS =====================
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  progressBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#fff7ed', backgroundColor: '#fff7ed' },
  closeBtn: { minWidth: 42, minHeight: 42, borderRadius: 10, backgroundColor: '#fed7aa40', borderWidth: 1, borderColor: '#fed7aa', justifyContent: 'center', alignItems: 'center' },
  progWrap: { flex: 1, marginHorizontal: 9 },
  progressTrack: { height: 8, backgroundColor: '#fed7aa66', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#f97316', borderRadius: 4 },
  progLabel: { fontSize: 10, color: '#94a3b8', marginTop: 3, fontWeight: '500' },
  xpText: { ...typography.bold, fontSize: 12, color: '#92400e', backgroundColor: '#fde68a', paddingHorizontal: 11, paddingVertical: 4, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#fcd34d' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 15, paddingBottom: 30 },

  tag: { backgroundColor: '#fff7ed', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 11 },
  tagText: { fontSize: 10, fontWeight: '700', color: '#c2410c', textTransform: 'uppercase', letterSpacing: 0.5 },
  iconCircle: { width: 68, height: 68, borderRadius: 20, backgroundColor: '#fff7ed', justifyContent: 'center', alignItems: 'center', marginBottom: 13 },
  title: { ...typography.extraBold, fontSize: 19, color: '#0f172a', marginBottom: 7, lineHeight: 25 },
  subtitle: { ...typography.regular, fontSize: 13, color: '#64748b', marginBottom: 13, lineHeight: 20 },
  bodyText: { ...typography.regular, fontSize: 13, color: '#334155', lineHeight: 22, marginBottom: 11 },
  sectionTitle: { ...typography.bold, fontSize: 13, color: '#0f172a', marginTop: 13, marginBottom: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  b: { fontWeight: '700', color: '#0f172a' },
  i: { fontStyle: 'italic', color: '#64748b' },

  card: { borderRadius: 14, padding: 13, marginBottom: 9, borderWidth: 1, borderColor: '#e2e8f0' },
  cardTitle: { ...typography.bold, fontSize: 12, color: '#0f172a', marginBottom: 4 },
  cardText: { ...typography.regular, fontSize: 12, color: '#334155', lineHeight: 18 },

  feedbackBar: { borderRadius: 10, padding: 10, marginTop: 7 },

  slideCompare: { borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' },
  slidePanel: { padding: 12 },
  slideLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  slidePrompt: { backgroundColor: 'rgba(0,0,0,0.04)', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, marginBottom: 7 },
  slidePromptText: { fontFamily: 'monospace', fontSize: 11, color: '#334155', lineHeight: 16 },
  slideResult: { fontSize: 12, color: '#334155', fontStyle: 'italic', borderLeftWidth: 2, paddingLeft: 8, lineHeight: 17 },

  builderSelect: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff' },
  builderPreview: { backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12, padding: 13, marginVertical: 10, minHeight: 80 },
  builderPreviewLabel: { fontSize: 10, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  promptScore: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 6 },
  promptScoreLabel: { fontSize: 11, color: '#64748b', fontWeight: '600', minWidth: 80 },
  promptScoreBar: { flex: 1, height: 10, backgroundColor: '#f1f5f9', borderRadius: 5, overflow: 'hidden' },
  promptScoreVal: { fontSize: 12, fontWeight: '700', minWidth: 36, textAlign: 'right' },

  monoBox: { backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, marginBottom: 10 },
  monoText: { fontFamily: 'monospace', fontSize: 12, color: '#334155', lineHeight: 18 },

  ingrBtn: { padding: 11, borderRadius: 11, borderWidth: 2, borderColor: '#e2e8f0', backgroundColor: '#fff', width: '48.5%', marginBottom: 7 },
  ingrBtnSel: { borderColor: '#f97316', backgroundColor: '#fff7ed' },
  ingrBtnCorrect: { borderColor: '#10b981', backgroundColor: '#dcfce7' },
  ingrBtnWrong: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },

  qualityTrack: { height: 12, backgroundColor: '#f1f5f9', borderRadius: 6, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 },
  refinePrompt: { backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, marginBottom: 12 },
  refineOpt: { padding: 11, borderRadius: 11, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#fff', marginBottom: 7 },
  roBest: { borderColor: '#10b981', backgroundColor: '#f0fdf4' },
  roOk: { borderColor: '#f59e0b', backgroundColor: '#fffbeb' },
  roBad: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },
  roundDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center' },
  roundDotActive: { borderColor: '#f97316', backgroundColor: '#fff7ed' },
  roundDotDone: { borderColor: '#10b981', backgroundColor: '#dcfce7' },

  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#f97316', justifyContent: 'center', alignItems: 'center', marginTop: 2 },

  roleScenario: { backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, marginBottom: 9 },
  roleScenarioText: { fontSize: 12, color: '#334155', lineHeight: 18, marginBottom: 9 },
  roleOpt: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  roleOptSel: { borderColor: '#8b5cf6', backgroundColor: '#faf5ff' },
  roleOptCorrect: { borderColor: '#10b981', backgroundColor: '#dcfce7' },
  roleOptWrong: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },

  ethicsNum: { fontSize: 10, fontWeight: '700', color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  ethicsBtn: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 11, borderWidth: 2, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', minHeight: 54, gap: 3 },

  missionCard: { borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#fff', marginBottom: 10 },
  missionEmoji: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  missionName: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  missionDesc: { fontSize: 11, color: '#64748b' },
  missionFieldLabel: { fontSize: 10, fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  missionInput: { borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 9, paddingHorizontal: 11, paddingVertical: 9, fontSize: 12, backgroundColor: '#f8fafc', color: '#334155' },
  missionResult: { backgroundColor: '#fff7ed', borderWidth: 1.5, borderColor: '#f97316', borderRadius: 10, padding: 11, marginTop: 8 },

  detectScenario: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 12, padding: 12, marginBottom: 10 },
  detectLabel: { fontSize: 9, fontWeight: '700', color: '#92400e', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  detectPromptBox: { backgroundColor: '#fff', borderRadius: 8, padding: 9, marginBottom: 8, borderWidth: 1, borderColor: '#fde68a80' },
  detectResponse: { fontSize: 11, color: '#9a3412', borderLeftWidth: 2, borderLeftColor: '#f97316', paddingLeft: 8, fontStyle: 'italic', lineHeight: 16 },
  detectQuestion: { fontSize: 12, fontWeight: '700', color: '#0f172a', marginBottom: 9, padding: 10, backgroundColor: '#f8fafc', borderRadius: 9, borderWidth: 1, borderColor: '#e2e8f0' },
  detectOpt: { flexDirection: 'row', alignItems: 'flex-start', padding: 10, borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, marginBottom: 6, gap: 9, backgroundColor: '#fff' },
  detectOptSel: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
  detectOptCorrect: { borderColor: '#10b981', backgroundColor: '#dcfce7' },
  detectOptWrong: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },
  doLetter: { width: 22, height: 22, borderRadius: 6, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center' },

  sprintScore: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, backgroundColor: '#f8fafc', borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  sprintScoreLabel: { fontSize: 10, color: '#64748b', fontWeight: '600' },
  sprintScoreVal: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  sprintCountdown: { fontSize: 24, fontWeight: '800', color: '#0f172a' },
  sprintSituation: { fontSize: 13, fontWeight: '700', color: '#0f172a', padding: 12, backgroundColor: '#f8fafc', borderRadius: 11, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 10, lineHeight: 18 },
  sprintOpt: { padding: 11, borderRadius: 10, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#fff', marginBottom: 7 },
  spCorrect: { borderColor: '#10b981', backgroundColor: '#dcfce7' },
  spWrong: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },

  sortItem: { flexDirection: 'row', alignItems: 'center', padding: 11, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1.5, borderColor: '#e2e8f0', marginBottom: 6, gap: 9 },
  sortItemOk: { borderColor: '#86efac', backgroundColor: '#f0fdf4' },
  sortItemWrong: { borderColor: '#fca5a5', backgroundColor: '#fff1f2' },
  sortNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#f97316', justifyContent: 'center', alignItems: 'center' },
  sortText: { flex: 1, fontSize: 11, color: '#334155', lineHeight: 16 },
  sortArrows: { flexDirection: 'column', gap: 3 },
  sortBtn: { width: 28, height: 26, borderRadius: 7, borderWidth: 1, borderColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },

  tfQuestion: { ...typography.bold, fontSize: 12, color: '#0f172a', padding: 11, backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 8, lineHeight: 18 },
  tfBtn: { flex: 1, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 11, borderWidth: 2, borderColor: '#e2e8f0', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', minHeight: 52 },
  tfBtnTrue: { borderColor: '#10b981', backgroundColor: '#f0fdf4' },
  tfBtnFalse: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },
  tfBtnCorrect: { borderColor: '#10b981', backgroundColor: '#dcfce7' },
  tfBtnWrong: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },

  textArea: { borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, padding: 11, fontSize: 13, color: '#334155', textAlignVertical: 'top', minHeight: 110, backgroundColor: '#fafafa', lineHeight: 20 },

  completeBadge: { width: 88, height: 88, borderRadius: 24, backgroundColor: '#fde68a', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  xpEarned: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 11, paddingHorizontal: 20, backgroundColor: '#fef9c3', borderRadius: 12, marginBottom: 14, borderWidth: 1, borderColor: '#fcd34d', width: '100%' },
  skillRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 8, backgroundColor: '#fff7ed', borderRadius: 9, borderWidth: 1, borderColor: '#fed7aa', marginBottom: 6 },
  skillCheck: { color: '#f97316', fontSize: 14, marginTop: 1 },
  skillText: { flex: 1, fontSize: 11, color: '#9a3412', lineHeight: 15, fontWeight: '500' },
  nextHint: { padding: 11, backgroundColor: '#f8fafc', borderRadius: 10, width: '100%', borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 13 },

  btnRow: { paddingHorizontal: 13, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', backgroundColor: '#fafcff' },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nextButton: { flex: 1, backgroundColor: '#f97316', paddingVertical: 13, borderRadius: 12, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  nextButtonFlex: { flex: 1 },
  nextButtonText: { ...typography.bold, color: '#fff', fontSize: 14 },
  backButton: { backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#e2e8f0', paddingVertical: 13, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  backButtonText: { ...typography.bold, color: '#64748b', fontSize: 14 },
  btnNote: { fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 5 },
  finishButton: { backgroundColor: '#f97316', paddingVertical: 13, borderRadius: 12, width: '100%', alignItems: 'center', marginBottom: 14 },

  dotsRow: { flexDirection: 'row', gap: 3, justifyContent: 'center', flexWrap: 'wrap', paddingTop: 9 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#cbd5e1' },
  dotActive: { backgroundColor: '#f97316', width: 14 },
  dotDone: { backgroundColor: '#fed7aa' },
  stepsCounter: { fontSize: 10, color: '#94a3b8', textAlign: 'center', paddingTop: 4 },
});
