import { exitLevel } from '../utils/exitLevel';
import { router } from 'expo-router';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { typography } from '../theme';
import XPToast from '../components/XPToast';

// ═══════════════════════════════════════════════════════════
// Nivel 21 · Gemini — La IA que vive en el ecosistema Google
// Mundo 4 · tema claro azul Google (#1a73e8). 20 módulos.
// Reconstruido vs nivel-21.html (estándar v2.2).
// ═══════════════════════════════════════════════════════════

// ── Tipos de paso ──
interface TheoryStep { type: 'theory'; title: string; xp: number; render: () => React.ReactNode; }
interface DragDropStep { type: 'dragdrop'; title: string; xp: number; instruction: string; zones: string[]; colClass: string[]; items: { id: string; text: string; correct: string }[]; }
interface MatchingStep { type: 'matching'; title: string; xp: number; instruction: string; leftLabel: string; rightLabel: string; pairs: { left: string; right: string }[]; }
interface SortStep { type: 'sort'; title: string; xp: number; instruction: string; correctOrder: string[]; }
interface QuizStep { type: 'quiz'; title: string; xp: number; questions: { question: string; options: string[]; correct: number; explain: string }[]; }
interface VFStep { type: 'vf'; title: string; xp: number; statements: { text: string; correct: boolean; feedback: string }[]; }
interface FillBlanksStep { type: 'fillblanks'; title: string; xp: number; items: { sentence: (blank: string) => string; options: string[]; correct: number; explain: string }[]; }
interface PromptCompareStep { type: 'promptcompare'; title: string; xp: number; tasks: { task: string; bad: string; good: string; explain: string; flip: boolean }[]; }
interface ReflectStep { type: 'reflect'; title: string; xp: number; placeholder: string; minChars: number; }
interface CompletionStep { type: 'completion'; title: string; xp: number; }
type Step = TheoryStep | DragDropStep | MatchingStep | SortStep | QuizStep | VFStep | FillBlanksStep | PromptCompareStep | ReflectStep | CompletionStep;

// ── Helpers ──
const pickRandom = <T,>(arr: T[], count: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};
// Baraja las opciones de una MCQ y remapea el índice correcto (§5/§27).
const shuffleOpts = <T extends { opts: string[]; correct: number }>(item: T): T => {
  const paired = item.opts.map((opt, i) => ({ opt, isCorrect: i === item.correct }));
  for (let j = paired.length - 1; j > 0; j--) {
    const k = Math.floor(Math.random() * (j + 1));
    [paired[j], paired[k]] = [paired[k], paired[j]];
  }
  return { ...item, opts: paired.map((p) => p.opt), correct: paired.findIndex((p) => p.isCorrect) };
};

// ── Pools de datos (extraídos del HTML) ──
const DRAG_POOL = [
  { text: 'Buscar noticias de hoy en tiempo real', correct: 'fortaleza' },
  { text: 'Analizar un PDF de 300 páginas en detalle', correct: 'cuidado' },
  { text: 'Resumir un video de YouTube con un link', correct: 'fortaleza' },
  { text: 'Generar una imagen artística detallada', correct: 'cuidado' },
  { text: 'Buscar vuelos baratos para la próxima semana', correct: 'fortaleza' },
  { text: 'Crear un documento en Google Docs con IA', correct: 'fortaleza' },
  { text: 'Escribir código en Python paso a paso', correct: 'fortaleza' },
  { text: 'Pedir comida a domicilio en tu barrio', correct: 'cuidado' },
  { text: 'Buscar artículos académicos recientes', correct: 'fortaleza' },
  { text: 'Recordar conversaciones de hace 3 meses', correct: 'cuidado' },
  { text: 'Responder preguntas sobre un PDF de Google Drive', correct: 'fortaleza' },
  { text: 'Darte resultados deportivos en vivo en este momento', correct: 'fortaleza' },
];

const MATCH_POOL = [
  { left: 'Gmail', right: 'Redacta y resume correos' },
  { left: 'Google Docs', right: 'Sugiere texto y mejora la redacción' },
  { left: 'YouTube', right: 'Resume videos y responde sobre ellos' },
  { left: 'Google Fotos', right: 'Describe imágenes y encuentra momentos' },
  { left: 'Google Maps', right: 'Sugiere rutas con contexto conversacional' },
  { left: 'Google Meet', right: 'Transcribe y resume reuniones' },
  { left: 'Google Sheets', right: 'Analiza datos y crea fórmulas desde texto' },
  { left: 'Google Buscador', right: 'Genera resúmenes de IA en los resultados' },
];

const GEMINI_SORT = [
  'Detecta que necesita info actual: reconoce que su entrenamiento no tiene la respuesta',
  'Ejecuta una búsqueda en Google: genera consultas y obtiene los resultados más relevantes',
  'Lee y analiza las fuentes: procesa el texto completo de las páginas, no solo los títulos',
  'Sintetiza con IA: combina la información encontrada en una respuesta conversacional',
  'Cita las fuentes: te dice de dónde viene cada dato, con links a las fuentes consultadas',
];

const QUIZ_POOL = [
  { q: '¿Cuál es la ventaja más importante de Gemini sobre Claude y ChatGPT?',
    opts: ['Tiene la ventana de contexto más grande de todos los modelos', 'Está integrado con el ecosistema de Google: Búsqueda, Docs, Gmail, YouTube y más', 'Es completamente gratuito sin ningún límite de uso', 'Puede generar videos largos directamente desde texto'],
    correct: 1, explain: 'La integración con el ecosistema Google (Búsqueda, Gmail, Docs, YouTube) es la fortaleza clave de Gemini frente a otros LLMs.' },
  { q: 'Un estudiante en Corea del Sur quiere resumir un video de YouTube para su clase. ¿Qué LLM elige?',
    opts: ['Claude, porque analiza textos muy largos con más detalle', 'ChatGPT, porque es el más usado y popular del mundo', 'Gemini — puede procesar videos de YouTube directamente con el link', 'Cualquiera de los tres lo hace exactamente igual de bien'],
    correct: 2, explain: 'Gemini tiene integración nativa con YouTube. Puedes pegarle el link de un video y pedirle que lo resuma o responda preguntas sobre él.' },
  { q: '¿Cuál es la diferencia entre Gemini y Google Búsqueda?',
    opts: ['Son exactamente la misma herramienta con distinto nombre', 'Google Búsqueda devuelve links; Gemini genera respuestas conversacionales sintetizando la información', 'Gemini solo funciona en inglés y Búsqueda en todos los idiomas', 'Gemini es una versión más antigua de Google Búsqueda'],
    correct: 1, explain: 'Google Búsqueda te da links para que tú leas. Gemini lee esas fuentes por ti y te da una respuesta directa y conversacional con citas.' },
  { q: '¿Para qué tarea Gemini Advanced sería claramente mejor que Claude o ChatGPT?',
    opts: ['Analizar un ensayo de 15 páginas aplicando crítica literaria profunda', 'Revisar tus correos de Gmail y sugerir cómo mejorar el tono de una respuesta', 'Escribir una novela de ciencia ficción con personajes consistentes', 'Explicar un concepto abstracto de matemáticas con analogías'],
    correct: 1, explain: 'Gemini puede integrarse con tu Gmail (con permiso) y leer tus correos. Puede analizar el tono de un correo específico — algo que Claude y ChatGPT no hacen de forma nativa.' },
];

const TF_POOL = [
  { stmt: 'Gemini puede resumir videos de YouTube directamente con el link del video', correct: true, explain: 'Correcto. Gemini tiene integración nativa con YouTube: le pegas el link y lo resume.' },
  { stmt: 'Gemini y Google Búsqueda son exactamente la misma herramienta', correct: false, explain: 'Falso. Google Búsqueda devuelve links; Gemini es un LLM conversacional que sintetiza la información por ti.' },
  { stmt: 'Gemini puede acceder a tus archivos de Google Drive si le das permiso', correct: true, explain: 'Sí. Con los permisos correctos, Gemini puede leer documentos de tu Drive para ayudarte con ellos.' },
  { stmt: 'Gemini fue creado por la misma empresa que hizo ChatGPT', correct: false, explain: 'Falso. ChatGPT fue creado por OpenAI. Gemini fue creado por Google DeepMind.' },
  { stmt: 'Gemini puede trabajar directamente dentro de Google Docs para ayudarte a redactar', correct: true, explain: 'Correcto. Google Docs tiene a Gemini integrado: escribe, mejora y resume sin salir del editor.' },
  { stmt: 'Gemini nunca comete errores porque siempre busca en internet en tiempo real', correct: false, explain: 'Falso. Aunque cite fuentes, Gemini puede equivocarse o traer datos desactualizados. Siempre verifica lo importante en la fuente.' },
  { stmt: 'Puedes pedirle a Gemini que busque información de un período de tiempo específico', correct: true, explain: 'Correcto. Decirle "de 2024" o "de los últimos 6 meses" le da instrucciones exactas sobre qué tan reciente debe ser la información.' },
];

const FILL_POOL = [
  { sentence: (w: string) => `El LLM de Google que reemplazó a Bard se llama ${w}.`, opts: ['Gemini', 'Copilot', 'Claude', 'Grok'], correct: 0, explain: 'Gemini es el nombre oficial del LLM de Google desde 2024, cuando reemplazó a Bard.' },
  { sentence: (w: string) => `La ventaja más importante de Gemini es su integración con el ${w} de Google.`, opts: ['ecosistema', 'hardware', 'algoritmo', 'servidor'], correct: 0, explain: '"Ecosistema" es la palabra clave: Gmail, Docs, Drive, YouTube, Sheets y Maps trabajando juntos.' },
  { sentence: (w: string) => `Cuando Gemini consulta Google para responder con datos de hoy, accede a información en tiempo ${w}.`, opts: ['real', 'libre', 'digital', 'programado'], correct: 0, explain: '"Tiempo real" significa información actual — de hoy, de esta semana — que Gemini busca mientras responde.' },
  { sentence: (w: string) => `La división de Google que creó a Gemini se llama Google ${w}.`, opts: ['DeepMind', 'Brain', 'Cloud', 'Labs'], correct: 0, explain: 'Google DeepMind (fusión de Google Brain y DeepMind en 2023) desarrolló los modelos Gemini.' },
  { sentence: (w: string) => `El nivel más potente de Gemini para usuarios individuales se llama Gemini ${w}.`, opts: ['Advanced', 'Flash', 'Turbo', 'Max'], correct: 0, explain: 'Gemini Advanced incluye integración completa con Gmail, Docs, Drive y Sheets (en Google One AI Premium).' },
];

const PROMPT_POOL = [
  { task: 'Pedir a Gemini información sobre un tema actual',
    bad: 'Dime qué pasa en el mundo hoy con la ciencia',
    good: 'Busca las 3 noticias más importantes de ciencia y tecnología de esta semana. Para cada una: título, resumen de 2 líneas, por qué importa para un estudiante de 12 años y la fuente.',
    explain: 'El prompt bueno especifica el tema, el período (esta semana), la cantidad, el formato y pide fuentes — activa la búsqueda en tiempo real de Gemini.' },
  { task: 'Usar Gemini para preparar una presentación escolar',
    bad: 'Ayúdame con mi presentación del cole por favor',
    good: 'Estoy en 7° grado en México. Tengo que hacer una presentación de 5 slides sobre el calentamiento global. Busca datos actualizados de 2024. Para cada slide: título, 3 puntos clave y una estadística reciente con su fuente.',
    explain: 'El prompt especifica grado, país, tema, formato y pide datos recientes CON fuentes — justo donde Gemini brilla frente a un LLM sin internet.' },
  { task: 'Pedirle a Gemini que resuma un video educativo',
    bad: 'Resume este video que te voy a pasar ahorita',
    good: 'Aquí está el link del video de YouTube de mi clase de historia: [link]. Resume los 5 puntos más importantes en orden de aparición. Luego dame 3 preguntas de práctica para estudiar.',
    explain: 'El prompt aprovecha la integración con YouTube: da la fuente (link), el formato (5 puntos) y pide un paso extra útil (preguntas de práctica).' },
  { task: 'Investigar fuentes académicas actualizadas',
    bad: 'Info sobre energía renovable para mi tarea',
    good: 'Actúa como asistente de investigación. Busca 3 estudios o reportes de 2024 sobre energía solar. Para cada uno: hallazgo principal en 2 líneas, quién lo publicó y el link. Que sean fuentes confiables.',
    explain: 'El prompt define rol, período (2024), cantidad, formato y exige fuentes verificables con link — un flujo de investigación que solo un LLM con búsqueda hace bien.' },
];

const USECASE_POOL = [
  { text: 'Buscar qué pasó en las noticias hoy', correct: 'usa' },
  { text: 'Analizar un texto literario de 40 páginas en detalle', correct: 'no-usa' },
  { text: 'Resumir un video de YouTube de tu clase', correct: 'usa' },
  { text: 'Pedir una pizza a domicilio', correct: 'no-usa' },
  { text: 'Editar un documento en Google Docs con IA', correct: 'usa' },
  { text: 'Ver el saldo de tu cuenta bancaria', correct: 'no-usa' },
  { text: 'Buscar artículos académicos recientes sobre un tema', correct: 'usa' },
  { text: 'Hacer una llamada telefónica por ti', correct: 'no-usa' },
  { text: 'Resumir los correos de Gmail que no has leído', correct: 'usa' },
  { text: 'Analizar datos en tu hoja de Google Sheets', correct: 'usa' },
];

// ═══════════════════════════════════════════════════════════
// buildSteps — 0:intro + 20 módulos + 21:completion
// ═══════════════════════════════════════════════════════════
const buildSteps = (): Step[] => {
  return [
    // 0 INTRO
    {
      type: 'theory', title: 'Gemini', xp: 0,
      render: () => (
        <View>
          <View style={styles.introIcon}><Text style={{ fontSize: 34 }}>✦</Text></View>
          <StepTag color="#e8f0fe" textColor="#1a56db" label="Nivel 21 · 20 módulos" />
          <Text style={styles.lessonTitle}>Gemini — La IA que vive en el ecosistema Google</Text>
          <Text style={styles.lessonSub}>Ya conoces a Claude. Ahora conoce a Gemini: el LLM de Google que no solo responde preguntas — busca en internet, trabaja dentro de Gmail, Docs, Drive y YouTube, y conecta todo el universo de herramientas que ya usas todos los días.</Text>
          <Card color="#c2ddfb" icon="📚" title="Qué vas a aprender" text="La historia de Bard → Gemini · Por qué la integración con Google es su superpower · Qué puede hacer que Claude y ChatGPT no · Cuándo usarlo y cuándo no · Cómo escribir prompts que aprovechan la búsqueda en tiempo real" />
          <Card color="#bbf7d0" icon="⚡" title="Lo nuevo en este nivel" text="Aprenderás por primera vez qué significa tener un LLM con acceso real a internet en tiempo real. Eso cambia completamente las preguntas que puedes hacerle." />
          <Card color="#fde68a" icon="🎮" title="20 módulos · hasta 175 XP" text="Teoría · Ecosistema Google · Casos del mundo · Clasificar · Conectar · Ordenar · Quiz · V/F · Casos de uso · Vocabulario · Comparar prompts · Reflexión final" />
        </View>
      ),
    },
    // 1 TEORÍA: de Bard a Gemini
    {
      type: 'theory', title: 'De Bard a Gemini', xp: 0,
      render: () => (
        <View>
          <StepTag color="#f0fdf4" textColor="#166534" label="📖 Módulo 1 de 20 · Teoría" />
          <Text style={styles.lessonTitle}>De Bard a Gemini — La historia del LLM de Google</Text>
          <Text style={styles.bodyText}>Cuando OpenAI lanzó ChatGPT en noviembre de 2022, el mundo se sorprendió. Google también — porque llevaba años trabajando en tecnología de IA pero no la había convertido en un producto para el público. En 2023, Google respondió con <Bold>Bard</Bold>, su primer chatbot de IA.</Text>
          <Card color="#c2ddfb" icon="🏢" title="Google DeepMind" text="El equipo detrás de Gemini. En 2023, Google fusionó dos de sus divisiones de IA — Google Brain y DeepMind — para crear Google DeepMind. Este superequipo desarrolló los modelos Gemini, que en 2024 reemplazaron completamente a Bard." />
          <Text style={styles.bodyText}>Gemini no es solo un chatbot. Es la <Bold>inteligencia artificial central de todo el ecosistema Google</Bold>: está dentro de tu Gmail, tu Google Docs, tus Google Fotos, YouTube y Google Búsqueda.</Text>
          <Text style={styles.sectionTitle}>Los modelos de Gemini</Text>
          <Card color="#bfdbfe" icon="⚡" title="Gemini Flash — Rápido y eficiente" text="El modelo más veloz. Ideal para tareas rápidas: responder preguntas, generar ideas, resumir textos cortos. Disponible de forma gratuita." />
          <Card color="#c2ddfb" icon="✦" title="Gemini Pro — El equilibrio" text="Balance entre velocidad y capacidad. Es el modelo de la versión gratuita en gemini.google.com. Buen rendimiento para la mayoría de tareas." />
          <Card color="#e9d5ff" icon="🚀" title="Gemini Advanced — El más poderoso" text="El modelo más capaz de Google para uso individual. Incluye integración completa con Gmail, Docs, Drive y Sheets (suscripción Google One AI Premium)." />
          <HLBox color="#e8f0fe" borderColor="#1a73e8">
            <Text style={styles.hlBoxText}><Bold>💡 La diferencia clave con Claude y ChatGPT:</Bold>{'\n'}Mientras Claude y ChatGPT son principalmente chatbots, Gemini está diseñado desde el inicio para vivir <Italic>dentro</Italic> de las herramientas que ya usas. No tienes que salir de Gmail para usarlo — está ahí adentro.</Text>
          </HLBox>
        </View>
      ),
    },
    // 2 EJEMPLOS
    {
      type: 'theory', title: 'Gemini en el mundo real', xp: 0,
      render: () => (
        <View>
          <StepTag color="#fff7ed" textColor="#9a3412" label="🌍 Módulo 2 de 20 · Casos del mundo" />
          <Text style={styles.lessonTitle}>Gemini en el mundo real</Text>
          <Text style={styles.lessonSub}>Gemini ya está siendo usado en situaciones que van mucho más allá de "preguntarle cosas".</Text>
          <ExampleCard emoji="🎓" name="Estudiante en Kenya" sub="Investigar con fuentes actualizadas para su tesis"
            how="Amara, en Nairobi, necesitaba datos actualizados sobre el cambio climático en la agricultura africana. Le dio la pregunta a Gemini, que buscó en Google, encontró artículos de 2024 y le entregó un resumen estructurado con citas de cada fuente."
            fact="⭐ Un proceso que antes tomaba 3 horas de búsqueda manual, en 15 minutos — y con fuentes verificables." />
          <ExampleCard emoji="💼" name="Emprendedor en Singapur" sub="Gestionar correos y reuniones con IA integrada"
            how="Kai recibe 150 correos por día. Usa Gemini en Gmail para que cada mañana le resuma los importantes, priorice los urgentes y sugiera borradores. Tras sus Google Meet, Gemini genera el resumen y la lista de tareas."
            fact="⭐ Esta integración con Gmail y Meet es algo que Claude y ChatGPT no hacen de forma nativa — habría que copiar y pegar todo manualmente." />
          <ExampleCard emoji="🎬" name="Creadora en Brasil" sub="Investigar y planear videos con YouTube + Gemini"
            how="Isabela le pasa a Gemini los links de los 5 mejores videos de YouTube sobre su tema. Gemini los resume, identifica qué tienen en común y qué ángulos no han cubierto, para que su canal ofrezca algo nuevo."
            fact="⭐ Analizar varios videos de YouTube directamente con sus links es una de las capacidades más únicas de Gemini." />
          <ExampleCard emoji="🏫" name="Profesor en Finlandia" sub="Crear materiales de clase con datos actualizados"
            how="Mikael usa Gemini en Google Docs para buscar estadísticas nuevas sobre deforestación, incorporarlas al documento y luego convertirlo en una presentación de Google Slides lista para clase — sin salir del ecosistema Google."
            fact="⭐ La integración entre Docs, Slides, Búsqueda y Gemini crea flujos de trabajo imposibles de replicar igual con otros LLMs." />
          <ExampleCard emoji="📊" name="Analista en Australia" sub="Analizar datos de Google Sheets con lenguaje natural"
            how="Sophie le describe a Gemini en lenguaje normal lo que quiere calcular y Gemini escribe la fórmula exacta, la explica y la aplica en la hoja. También genera gráficos con un simple pedido en texto."
            fact='⭐ "Hablarle" a una hoja de cálculo en vez de aprender fórmulas complejas cambia quién puede trabajar con datos — no solo los expertos.' />
        </View>
      ),
    },
    // 3 DRAG: fortalezas
    {
      type: 'dragdrop', title: '¿Cuándo Gemini brilla y cuándo no?', xp: 20,
      instruction: 'Gemini tiene fortalezas únicas — pero también limitaciones. Clasifica cada situación correctamente.',
      zones: ['✦ Fortaleza de Gemini', '⚠️ Usa otra herramienta'], colClass: ['fortaleza', 'cuidado'],
      items: pickRandom(DRAG_POOL, 10).map((it, i) => ({ id: `d${i}`, text: it.text, correct: it.correct })),
    },
    // 4 TEORÍA: ecosistema
    {
      type: 'theory', title: 'El ecosistema Google', xp: 0,
      render: () => (
        <View>
          <StepTag color="#f0fdf4" textColor="#166534" label="📖 Módulo 4 de 20 · Teoría" />
          <Text style={styles.lessonTitle}>La superpower de Gemini: el ecosistema Google</Text>
          <Text style={styles.bodyText}>Imagina que cada herramienta de Google — Búsqueda, Gmail, Docs, Drive, YouTube, Sheets, Maps — tuviera un asistente súper inteligente adentro, ya conectado a todo tu trabajo. Eso es lo que Gemini hace.</Text>
          <HLBox color="#e8f0fe" borderColor="#1a73e8">
            <Text style={styles.hlBoxText}><Bold>🔑 La diferencia fundamental:</Bold>{'\n'}Claude y ChatGPT son <Italic>destinos</Italic> — vas a ellos para hacer algo. Gemini es un <Italic>ingrediente</Italic> — ya está dentro de las herramientas donde trabajas. Esa diferencia cambia todo.</Text>
          </HLBox>
          <Text style={styles.sectionTitle}>Qué puede hacer dentro de cada app</Text>
          <Card color="#c2ddfb" icon="📧" title="En Gmail" text="Redacta correos desde cero, cambia el tono (formal/casual), resume hilos largos, sugiere respuestas rápidas y prioriza tu bandeja de entrada." />
          <Card color="#bfdbfe" icon="📄" title="En Google Docs" text="Escribe secciones completas desde una descripción, mejora tu redacción, cambia el estilo, genera tablas y resume documentos largos sin salir del editor." />
          <Card color="#bbf7d0" icon="📊" title="En Google Sheets" text='Crea fórmulas desde lenguaje natural ("calcula el promedio de ventas por mes"), genera gráficos, analiza tendencias y limpia datos.' />
          <Card color="#fde68a" icon="🎬" title="Con YouTube" text="Resume videos con el link, responde preguntas sobre el contenido, extrae los puntos clave y compara información de varios videos." />
          <HLBox color="#f0fdf4" borderColor="#16a34a">
            <Text style={styles.hlBoxText}>Si usas Google Workspace para estudiar o trabajar — y la mayoría del mundo lo hace — Gemini no es un LLM más: es un asistente que ya vive en tu flujo de trabajo. <Bold>Eso reduce la fricción a casi cero.</Bold></Text>
          </HLBox>
        </View>
      ),
    },
    // 5 MATCHING
    {
      type: 'matching', title: 'Producto Google → ¿Qué hace Gemini ahí?', xp: 15,
      instruction: 'Conecta cada producto de Google con la capacidad que Gemini tiene integrada en él.',
      leftLabel: 'Producto Google', rightLabel: 'Gemini hace esto aquí',
      pairs: pickRandom(MATCH_POOL, 4),
    },
    // 6 TEORÍA: triángulo
    {
      type: 'theory', title: 'Gemini vs Claude vs ChatGPT', xp: 0,
      render: () => (
        <View>
          <StepTag color="#f0fdf4" textColor="#166534" label="📖 Módulo 6 de 20 · Teoría" />
          <Text style={styles.lessonTitle}>Gemini vs Claude vs ChatGPT — El triángulo de los LLMs</Text>
          <Text style={styles.bodyText}>Los tres son poderosos. Pero cada uno tiene una zona donde claramente gana. Entender el triángulo te permite elegir la herramienta correcta para cada tarea.</Text>
          <View style={styles.vsGrid}>
            <View style={[styles.vsCol, { backgroundColor: '#e8f0fe', borderColor: '#c2ddfb' }]}>
              <Text style={[styles.vsHeader, { backgroundColor: '#c2ddfb', color: '#1e3a8a' }]}>✦ Gemini gana en</Text>
              <Text style={styles.vsItem}>✅ Internet en tiempo real</Text>
              <Text style={styles.vsItem}>✅ Integración Gmail/Docs/Sheets</Text>
              <Text style={styles.vsItem}>✅ Resumir videos de YouTube</Text>
              <Text style={styles.vsItem}>✅ Búsqueda académica con citas</Text>
              <Text style={styles.vsItem}>⚠️ Contexto para texto muy largo</Text>
            </View>
            <View style={[styles.vsCol, { backgroundColor: '#fff3ee', borderColor: '#fdd9c8' }]}>
              <Text style={[styles.vsHeader, { backgroundColor: '#fdd9c8', color: '#7c2d12' }]}>🌟 Claude gana en</Text>
              <Text style={styles.vsItem}>✅ Análisis de textos muy largos</Text>
              <Text style={styles.vsItem}>✅ Calibración de incertidumbre</Text>
              <Text style={styles.vsItem}>✅ Respuestas reflexivas y matizadas</Text>
              <Text style={styles.vsItem}>✅ Proyectos creativos extensos</Text>
              <Text style={styles.vsItem}>⚠️ Sin integración nativa con apps</Text>
            </View>
          </View>
          <Card color="#bbf7d0" icon="💬" title="ChatGPT gana en" text="Generación de imágenes nativa (DALL·E) · Ecosistema de plugins · Familiaridad y adopción masiva · Intérprete de Python integrado." />
          <HLBox color="#e8f0fe" borderColor="#1a73e8">
            <Text style={styles.hlBoxText}><Bold>📌 Cuándo usar cuál:</Bold>{'\n'}🔍 Info de hoy → Gemini{'\n'}📄 Analizar texto muy largo → Claude{'\n'}🎨 Crear una imagen desde texto → ChatGPT{'\n'}🧠 Aprender un concepto → cualquiera, con el prompt correcto</Text>
          </HLBox>
        </View>
      ),
    },
    // 7 TEORÍA: búsqueda tiempo real
    {
      type: 'theory', title: 'La búsqueda en tiempo real', xp: 0,
      render: () => (
        <View>
          <StepTag color="#f0fdf4" textColor="#166534" label="📖 Módulo 7 de 20 · Teoría" />
          <Text style={styles.lessonTitle}>¿Cómo busca Gemini en internet mientras te responde?</Text>
          <Text style={styles.bodyText}>Cuando le haces una pregunta que necesita información actual, no adivina ni inventa. <Bold>Hace una búsqueda real en Google en ese momento</Bold>, analiza los resultados y los sintetiza para ti.</Text>
          <Text style={styles.sectionTitle}>El proceso paso a paso</Text>
          <StepList items={[
            'Detecta que necesita info actual: sabe que su entrenamiento no tiene la respuesta a "¿cuánto cuesta el dólar hoy?".',
            'Ejecuta una búsqueda en Google: genera consultas y obtiene los resultados más relevantes.',
            'Lee y analiza las fuentes: procesa el texto completo de las páginas, no solo los títulos.',
            'Sintetiza y cita: combina la información en una respuesta conversacional con links a las fuentes.',
          ]} />
          <Card color="#c2ddfb" icon="📰" title="Trabajos de investigación" text="En vez de abrir 10 pestañas y leer cada artículo, le das el tema a Gemini y hace la investigación inicial por ti — con fuentes verificables." />
          <Card color="#bfdbfe" icon="📊" title="Datos actualizados" text="Estadísticas, precios, resultados, noticias — cosas que cambian. Gemini puede dártelas con fecha y fuente, no con datos de hace 2 años." />
          <HLBox color="#fffbeb" borderColor="#d97706">
            <Text style={styles.hlBoxText}><Bold>⚠️ Una limitación importante:</Bold>{'\n'}Aunque Gemini cita fuentes, <Bold>siempre verifica la información importante directamente en la fuente</Bold>. A veces los artículos tienen errores o están desactualizados aunque sean recientes.</Text>
          </HLBox>
        </View>
      ),
    },
    // 8 TEORÍA: cómo hablarle
    {
      type: 'theory', title: 'Cómo hablarle a Gemini', xp: 0,
      render: () => (
        <View>
          <StepTag color="#f0fdf4" textColor="#166534" label="📖 Módulo 8 de 20 · Teoría" />
          <Text style={styles.lessonTitle}>Cómo sacarle el máximo a Gemini</Text>
          <Text style={styles.bodyText}>Los mismos principios de buenos prompts que aprendiste con Claude aplican a Gemini. Pero hay <Bold>elementos adicionales específicos de Gemini</Bold> que cambian el nivel de la respuesta.</Text>
          <Text style={styles.sectionTitle}>Lo que funciona igual que con cualquier LLM</Text>
          <Card color="#bbf7d0" icon="✅" title="Rol + Contexto + Tarea + Formato" text="La fórmula básica sigue igual: dile quién debe ser, quién eres tú, qué necesitas exactamente y cómo quieres la respuesta." />
          <Text style={styles.sectionTitle}>Lo que es específico de Gemini</Text>
          <Card color="#c2ddfb" icon="📅" title="Especifica el período de tiempo" text='Como puede buscar en tiempo real, decirle "de 2024" o "de los últimos 6 meses" le da instrucciones exactas sobre qué tan reciente debe ser la información.' />
          <Card color="#bfdbfe" icon="🔗" title="Dale links directamente" text="Puedes pegarle el link de un video de YouTube, un artículo web o un documento de tu Drive. Gemini lo leerá y trabajará con ese contenido." />
          <Card color="#fde68a" icon="📋" title="Pide citas y fuentes" text='Agrega "incluye las fuentes de cada dato". Gemini no solo te da la información — te dice exactamente de dónde viene.' />
          <HLBox color="#e8f0fe" borderColor="#1a73e8">
            <Text style={styles.hlBoxText}><Bold>✅ Ejemplo de prompt poderoso:</Bold>{'\n'}"Busca los 5 descubrimientos científicos más importantes de 2024 sobre el clima. Para cada uno: nombre, qué significa para un estudiante de 12 años, y la fuente. Formato: lista numerada."{'\n'}Ese prompt usa: período + audiencia + formato + fuentes → Gemini brillará.</Text>
          </HLBox>
        </View>
      ),
    },
    // 9 SORT
    {
      type: 'sort', title: 'Proceso de búsqueda de Gemini', xp: 15,
      instruction: 'Ordena los 5 pasos de lo que ocurre cuando Gemini necesita buscar en internet para responderte.',
      correctOrder: GEMINI_SORT,
    },
    // 10 QUIZ
    {
      type: 'quiz', title: 'Demuestra lo que sabes sobre Gemini', xp: 32,
      questions: pickRandom(QUIZ_POOL, 4).map(shuffleOpts).map((q) => ({ question: q.q, options: q.opts, correct: q.correct, explain: q.explain })),
    },
    // 11 TEORÍA: asistente de investigación
    {
      type: 'theory', title: 'Gemini como asistente de investigación', xp: 0,
      render: () => (
        <View>
          <StepTag color="#f0fdf4" textColor="#166534" label="📖 Módulo 11 de 20 · Teoría" />
          <Text style={styles.lessonTitle}>Gemini como tu asistente de investigación</Text>
          <Text style={styles.bodyText}>Hay una tarea donde Gemini supera a cualquier otro LLM para estudiantes: <Bold>investigar temas que necesitan información actual</Bold>. No abres 10 pestañas ni lees 10 artículos: Gemini lo hace por ti y te dice de dónde viene cada cosa.</Text>
          <Text style={styles.sectionTitle}>El flujo de trabajo ideal</Text>
          <StepList items={[
            'Define el tema y el período: "IA y educación, enfocado en noticias y estudios de 2024".',
            'Pide un mapa del tema: "Dame los 5 subtemas más importantes para elegir en cuál profundizar".',
            'Profundiza con fuentes: "Sobre el subtema X, dame los 3 hallazgos más importantes de los últimos 12 meses con sus fuentes".',
            'Verifica lo más importante: haz clic en las fuentes citadas para confirmar antes de usar la información.',
            'Pide que lo estructure: "Organiza todo en un esquema con introducción, 3 secciones y conclusión".',
          ]} />
          <HLBox color="#f0fdf4" borderColor="#16a34a">
            <Text style={styles.hlBoxText}><Bold>✅ Lo más importante:</Bold>{'\n'}Gemini hace la búsqueda, pero <Italic>la investigación sigue siendo tuya</Italic>. Tú decides qué explorar, qué fuentes verificar y cómo estructurar tu argumento. Gemini es el motor de búsqueda que trabaja para ti, no el investigador que piensa por ti.</Text>
          </HLBox>
        </View>
      ),
    },
    // 12 V/F
    {
      type: 'vf', title: '¿Verdadero o Falso sobre Gemini?', xp: 30,
      statements: pickRandom(TF_POOL, 5).map((s) => ({ text: s.stmt, correct: s.correct, feedback: s.explain })),
    },
    // 13 CASO Aiko
    {
      type: 'theory', title: 'Caso: Aiko investiga energía solar', xp: 0,
      render: () => (
        <View>
          <StepTag color="#e8f0fe" textColor="#1e40af" label="📚 Módulo 13 de 20 · Caso real" />
          <Text style={styles.lessonTitle}>Aiko tiene 48 horas para una investigación</Text>
          <Card color="#fde68a" icon="📍" title="La situación" text="Aiko, 13 años, Osaka. Presentación de ciencias sobre avances en energía solar. Necesita datos de 2024, no de libros viejos. Tiene 48 horas." />
          <Text style={styles.sectionTitle}>Lo que hizo con Gemini — Paso a paso</Text>
          <StepList items={[
            'Búsqueda amplia: "Busca los 5 avances más importantes en energía solar de 2024, con fuente" → Gemini trajo 5 hallazgos reales con citas.',
            'Profundizó en el más interesante (celdas de perovskita): pidió más detalles y 2 fuentes confiables → obtuvo datos con números concretos.',
            'Lo convirtió a su nivel: "Explícame esto como a un estudiante de 13 años, sin términos técnicos, con analogías cotidianas".',
            'Estructuró la presentación: "Organiza todo en 5 slides: intro, 3 avances y conclusión".',
          ]} />
          <HLBox color="#f0fdf4" borderColor="#16a34a">
            <Text style={styles.hlBoxText}><Bold>Resultado:</Bold> Aiko terminó en 3 horas en vez de 2 días. Datos de 2024 verificados con fuentes reales, presentación con estructura profesional, y entendió el tema porque Gemini se lo explicó a su nivel.</Text>
          </HLBox>
        </View>
      ),
    },
    // 14 FILL
    {
      type: 'fillblanks', title: 'Completa las frases sobre Gemini', xp: 24,
      items: pickRandom(FILL_POOL, 3).map(shuffleOpts).map((s) => ({ sentence: (blank: string) => s.sentence(blank), options: s.opts, correct: s.correct, explain: s.explain })),
    },
    // 15 TEORÍA: privacidad
    {
      type: 'theory', title: 'Gemini y tu privacidad', xp: 0,
      render: () => (
        <View>
          <StepTag color="#f0fdf4" textColor="#166534" label="📖 Módulo 15 de 20 · Teoría" />
          <Text style={styles.lessonTitle}>Gemini y tu privacidad — Lo que debes saber</Text>
          <Text style={styles.bodyText}>Cuando usas Gemini dentro de Gmail o Google Drive, le das acceso a información personal — tus correos, documentos y archivos. Eso tiene beneficios enormes pero también implica responsabilidad.</Text>
          <Text style={styles.sectionTitle}>¿Qué pasa con tu información?</Text>
          <Card color="#bbf7d0" icon="✅" title="Lo que Google dice que hace" text="Google afirma que en las cuentas de Workspace for Education (las de las escuelas), tu contenido no se usa para entrenar los modelos de IA. Tus datos permanecen en tu cuenta." />
          <Card color="#fed7aa" icon="⚠️" title="Lo que debes tener en cuenta" text="Gemini puede ver el contenido de tus correos y documentos cuando lo autorizas. No compartas información extremadamente sensible (contraseñas, datos bancarios, datos privados de otras personas)." />
          <Card color="#bfdbfe" icon="🔒" title="Controla tus permisos" text="En la configuración de tu cuenta Google puedes ver y controlar qué permisos tiene Gemini, revisar el historial de actividad y desactivar funciones." />
          <HLBox color="#fffbeb" borderColor="#d97706">
            <Text style={styles.hlBoxText}><Bold>💡 Regla práctica:</Bold>{'\n'}Antes de darle acceso a tus correos o documentos, pregúntate: <Italic>"¿Estaría cómodo si alguien más viera este contenido?"</Italic> Si la respuesta es no, no lo compartas con ningún LLM — no solo con Gemini. Aplica a Claude, ChatGPT y cualquier IA.</Text>
          </HLBox>
        </View>
      ),
    },
    // 16 DRAG 2
    {
      type: 'dragdrop', title: '¿Gemini es ideal o hay algo mejor?', xp: 20,
      instruction: 'Para cada tarea, decide: ¿Gemini es la herramienta correcta, o hay una opción claramente mejor?',
      zones: ['✦ Gemini es ideal', '🔄 Hay mejor herramienta'], colClass: ['usa', 'no-usa'],
      items: pickRandom(USECASE_POOL, 8).map((it, i) => ({ id: `u${i}`, text: it.text, correct: it.correct })),
    },
    // 17 PROMPT COMPARE
    {
      type: 'promptcompare', title: '¿Cuál prompt aprovecha mejor a Gemini?', xp: 30,
      tasks: pickRandom(PROMPT_POOL, 3).map((p) => ({ task: p.task, bad: p.bad, good: p.good, explain: p.explain, flip: Math.random() < 0.5 })),
    },
    // 18 BONUS
    {
      type: 'theory', title: 'Hacia dónde va Gemini', xp: 0,
      render: () => (
        <View>
          <StepTag color="#fce7f3" textColor="#9d174d" label="🚀 Módulo 18 de 20 · Bonus" />
          <Text style={styles.lessonTitle}>Hacia dónde va Gemini</Text>
          <Text style={styles.bodyText}>Google tiene acceso a más datos, más infraestructura y más productos integrados que cualquier otra empresa tech. El potencial de Gemini es difícil de imaginar, pero hay tendencias claras ya visibles.</Text>
          <Text style={styles.sectionTitle}>Lo que ya existe o viene muy pronto</Text>
          <Card color="#c2ddfb" icon="🎬" title="Generación de video con Veo" text='Google ya tiene Veo, su modelo de generación de video. Con Gemini podrás pedir "crea un video corto explicando la fotosíntesis" y obtener un video real en segundos.' />
          <Card color="#bfdbfe" icon="🗺️" title="Google Maps conversacional" text='En vez de buscar "restaurantes italianos cerca", dirás "quiero cenar italiano, que no sea caro, de camino a casa". Gemini + Maps responde en lenguaje natural.' />
          <Card color="#bbf7d0" icon="📱" title="Gemini en tu Android" text="Gemini ya es el asistente principal en Android, reemplazando a Google Assistant. Controla apps, lee tu pantalla y hace tareas desde voz o texto." />
          <Card color="#fde68a" icon="🎓" title="Google Classroom + Gemini" text="Google integra Gemini en Classroom para ayudar a profesores a crear evaluaciones, dar retroalimentación personalizada y analizar el progreso de la clase." />
          <HLBox color="#e8f0fe" borderColor="#1a73e8">
            <Text style={styles.hlBoxText}><Bold>💡 La tendencia más grande:</Bold>{'\n'}Google está convirtiendo a Gemini en el sistema nervioso central de toda su plataforma. En 2-3 años probablemente no pensarás en "usar Gemini" — simplemente será la IA que ya está en todas tus herramientas de Google.</Text>
          </HLBox>
        </View>
      ),
    },
    // 19 DESAFÍO
    {
      type: 'theory', title: 'Elige la herramienta correcta', xp: 0,
      render: () => (
        <View>
          <StepTag color="#e8f0fe" textColor="#1a56db" label="🏆 Módulo 19 de 20 · Desafío" />
          <Text style={styles.lessonTitle}>Elige la herramienta correcta</Text>
          <Text style={styles.lessonSub}>Tienes acceso a Claude, ChatGPT y Gemini. Para cada situación, mira cuál conviene y por qué.</Text>
          <View style={[styles.caseBox, { backgroundColor: '#e8f0fe', borderColor: '#c2ddfb' }]}>
            <Text style={[styles.caseTitle, { color: '#1e3a8a' }]}>Situación 1 — La tarea de ciencias</Text>
            <Text style={styles.caseText}>Sofia, 12 años, Milán. Necesita datos actualizados sobre contaminación del Mediterráneo para mañana.</Text>
            <Text style={[styles.caseAnswer, { color: '#1e3a8a' }]}><Bold>✦ Respuesta: Gemini.</Bold> Necesita datos recientes y verificables. Gemini busca estadísticas de 2024, cita fuentes y estructura el trabajo. Claude o ChatGPT no tienen esos datos sin internet.</Text>
          </View>
          <View style={[styles.caseBox, { backgroundColor: '#fff3ee', borderColor: '#fdd9c8' }]}>
            <Text style={[styles.caseTitle, { color: '#9a3412' }]}>Situación 2 — La novela de aventuras</Text>
            <Text style={styles.caseText}>Arjun, 13 años, Mumbai. Escribe una novela de 10 capítulos y necesita personajes consistentes a lo largo de toda la historia.</Text>
            <Text style={[styles.caseAnswer, { color: '#7c2d12' }]}><Bold>🌟 Respuesta: Claude.</Bold> Su ventana de contexto extensa mantiene toda la información de los personajes durante una sesión larga de escritura, mejor que los otros modelos.</Text>
          </View>
          <View style={[styles.caseBox, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
            <Text style={[styles.caseTitle, { color: '#166534' }]}>Situación 3 — La imagen para la presentación</Text>
            <Text style={styles.caseText}>Liu, 11 años, Shanghái. Necesita una imagen de un sistema solar futurista y no sabe dibujar.</Text>
            <Text style={[styles.caseAnswer, { color: '#166534' }]}><Bold>💬 Respuesta: ChatGPT con DALL·E.</Bold> Tiene generación de imágenes integrada y crea exactamente la imagen desde texto. Ni Claude ni Gemini tienen esta capacidad nativa.</Text>
          </View>
          <HLBox color="#e8f0fe" borderColor="#1a73e8">
            <Text style={styles.hlBoxText}><Bold>🎯 La habilidad más valiosa:</Bold>{'\n'}No es saber usar uno solo muy bien. Es saber cuándo usar cada uno. Los profesionales de IA en 2025 dominan los tres y eligen según la tarea. Eso es lo que estás aprendiendo.</Text>
          </HLBox>
        </View>
      ),
    },
    // 20 REFLEXIÓN
    {
      type: 'reflect', title: '¿Cómo vas a integrar Gemini a tu vida?', xp: 15,
      placeholder: 'Ejemplo: Usaría Gemini para investigar trabajos escolares porque necesito datos de 2024 con fuentes verificables. En cambio usaría Claude cuando tenga que analizar un texto largo o escribir una historia, porque su ventana de contexto mantiene mejor el hilo...',
      minChars: 70,
    },
    // 21 COMPLETION
    { type: 'completion', title: '¡Nivel 21 completado!', xp: 0 },
  ];
};

// ── Componentes auxiliares ──
const StepTag = ({ color, textColor, label }: { color: string; textColor: string; label: string }) => (
  <View style={[styles.stepTag, { backgroundColor: color }]}><Text style={[styles.stepTagText, { color: textColor }]}>{label}</Text></View>
);
const Card = ({ color, icon, title, text }: { color: string; icon: string; title: string; text: string }) => (
  <View style={[styles.card, { borderColor: color }]}>
    <View style={styles.cardRow}>
      <View style={[styles.cardIcon, { backgroundColor: color }]}><Text style={{ fontSize: 20 }}>{icon}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardText}>{text}</Text>
      </View>
    </View>
  </View>
);
const ExampleCard = ({ emoji, name, sub, how, fact }: { emoji: string; name: string; sub: string; how: string; fact: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <TouchableOpacity style={[styles.exCard, open && styles.exCardOpen]} onPress={() => setOpen(o => !o)} activeOpacity={0.85}>
      <View style={styles.cardRow}>
        <View style={styles.exEmoji}><Text style={{ fontSize: 22 }}>{emoji}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{name}</Text>
          <Text style={styles.exSub}>{sub}</Text>
        </View>
        <Text style={styles.exArrow}>{open ? '▾' : '▸'}</Text>
      </View>
      {open && (
        <View style={styles.exBody}>
          <Text style={styles.exHow}>{how}</Text>
          <View style={styles.exFact}><Text style={styles.exFactText}>{fact}</Text></View>
        </View>
      )}
    </TouchableOpacity>
  );
};
const HLBox = ({ color, borderColor, children }: { color: string; borderColor: string; children: React.ReactNode }) => (
  <View style={[styles.hlBox, { backgroundColor: color, borderLeftColor: borderColor }]}>{children}</View>
);
const Bold = ({ children }: { children: React.ReactNode }) => <Text style={{ fontWeight: '700' }}>{children}</Text>;
const Italic = ({ children }: { children: React.ReactNode }) => <Text style={{ fontStyle: 'italic' }}>{children}</Text>;
const StepList = ({ items }: { items: string[] }) => (
  <View style={styles.stepList}>
    {items.map((item, idx) => (
      <View key={idx} style={styles.stepItem}>
        <View style={styles.stepNum}><Text style={styles.stepNumText}>{idx + 1}</Text></View>
        <Text style={styles.stepText}>{item}</Text>
      </View>
    ))}
  </View>
);

// ═══════════════════════════════════════════════════════════
// Componente principal
// ═══════════════════════════════════════════════════════════
export default function World4Level3() {
  const completeLevel = useGameStore(s => s.completeLevel);

  const steps = useRef(buildSteps()).current;
  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);
  const [xpToast, setXpToast] = useState<{ amount: number; id: number } | null>(null);

  // Drag
  const [dPlaced, setDPlaced] = useState<Record<string, string>>({});
  const [dSelected, setDSelected] = useState<string | null>(null);
  const [dAttempts, setDAttempts] = useState(0);
  const [dOk, setDOk] = useState(false);
  // Matching
  const [mLeft, setMLeft] = useState<number | null>(null);
  const [mDone, setMDone] = useState<Set<number>>(new Set());
  const [mRightOrder, setMRightOrder] = useState<string[]>([]);
  const [mWrong, setMWrong] = useState<number | null>(null);
  const [mOk, setMOk] = useState(false);
  // Sort
  const [sOrder, setSOrder] = useState<number[]>([]);
  const [sWrong, setSWrong] = useState<Set<number>>(new Set());
  const [sOk, setSOk] = useState(false);
  const [sFb, setSFb] = useState<string | null>(null);
  // Quiz / VF / Fill / Prompt
  const [qAnswers, setQAnswers] = useState<Record<number, number>>({});
  const [qChecked, setQChecked] = useState(false);
  const [vfAnswers, setVFAnswers] = useState<Record<number, boolean>>({});
  const [vfChecked, setVFChecked] = useState(false);
  const [fAnswers, setFAnswers] = useState<Record<number, number>>({});
  const [fChecked, setFChecked] = useState(false);
  const [pPicks, setPPicks] = useState<Record<number, 'bad' | 'good'>>({});
  const [pChecked, setPChecked] = useState(false);
  // Reflect
  const [reflectText, setReflectText] = useState('');

  useEffect(() => {
    const cur = steps[step];
    setDPlaced({}); setDSelected(null); setDAttempts(0); setDOk(false);
    setMLeft(null); setMDone(new Set()); setMRightOrder([]); setMWrong(null); setMOk(false);
    setSOrder([]); setSWrong(new Set()); setSOk(false); setSFb(null);
    setQAnswers({}); setQChecked(false);
    setVFAnswers({}); setVFChecked(false);
    setFAnswers({}); setFChecked(false);
    setPPicks({}); setPChecked(false);
    setReflectText('');
    if (cur.type === 'sort') setSOrder([...Array(5).keys()].sort(() => Math.random() - 0.5));
    if (cur.type === 'matching') setMRightOrder((cur as MatchingStep).pairs.map(p => p.right).sort(() => Math.random() - 0.5));
  }, [step]);

  // Solo XP local (display + toast). El store se actualiza UNA vez en completeLevel al final (§26).
  const addXP = useCallback((amount: number) => {
    setXp(prev => prev + amount);
    if (amount > 0) setXpToast(prev => ({ amount, id: (prev?.id ?? 0) + 1 }));
  }, []);

  const handleNext = () => {
    if (step >= steps.length - 1) return;
    const cur = steps[step];

    if (cur.type === 'dragdrop' && !dOk) {
      const drag = cur as DragDropStep;
      if (Object.keys(dPlaced).length < drag.items.length) return;
      const allCorrect = drag.items.every(it => dPlaced[it.id] === it.correct);
      if (allCorrect) { addXP(dAttempts === 0 ? 20 : 12); setDOk(true); return; }
      // devolver los incorrectos al pool (flash implícito por reaparición)
      setDPlaced(prev => { const n = { ...prev }; drag.items.forEach(it => { if (n[it.id] !== it.correct) delete n[it.id]; }); return n; });
      setDAttempts(a => a + 1);
      return;
    }
    if (cur.type === 'matching' && !mOk) {
      if (mDone.size !== (cur as MatchingStep).pairs.length) return;
      addXP(cur.xp); setMOk(true); return;
    }
    if (cur.type === 'sort' && !sOk) {
      const correct = sOrder.every((v, i) => v === i);
      if (!correct) {
        const wrong = new Set(sOrder.reduce<number[]>((a, v, i) => { if (v !== i) a.push(i); return a; }, []));
        setSWrong(wrong); setSFb('Revisa el orden: ¿qué ocurre primero y qué es consecuencia de qué?');
        setTimeout(() => setSWrong(new Set()), 2000);
        return;
      }
      addXP(cur.xp); setSOk(true); setSFb('¡Orden perfecto! Ese es el flujo de una búsqueda de Gemini.'); return;
    }
    if (cur.type === 'quiz' && !qChecked) {
      if (Object.keys(qAnswers).length < (cur as QuizStep).questions.length) return;
      setQChecked(true);
      let c = 0; (cur as QuizStep).questions.forEach((q, i) => { if (qAnswers[i] === q.correct) c++; });
      addXP(c * 8); return; // feedback inline; siguiente clic avanza (§16/§29)
    }
    if (cur.type === 'vf' && !vfChecked) {
      if (Object.keys(vfAnswers).length < (cur as VFStep).statements.length) return;
      setVFChecked(true);
      let c = 0; (cur as VFStep).statements.forEach((s, i) => { if (vfAnswers[i] === s.correct) c++; });
      addXP(c * 6); return;
    }
    if (cur.type === 'fillblanks' && !fChecked) {
      if (Object.keys(fAnswers).length < (cur as FillBlanksStep).items.length) return;
      setFChecked(true);
      let c = 0; (cur as FillBlanksStep).items.forEach((it, i) => { if (fAnswers[i] === it.correct) c++; });
      addXP(c * 8); return;
    }
    if (cur.type === 'promptcompare' && !pChecked) {
      if (Object.keys(pPicks).length < (cur as PromptCompareStep).tasks.length) return;
      setPChecked(true);
      let c = 0; (cur as PromptCompareStep).tasks.forEach((_, i) => { if (pPicks[i] === 'good') c++; });
      addXP(c * 10); return;
    }
    if (cur.type === 'reflect') {
      if (reflectText.trim().length < (cur as ReflectStep).minChars) return;
      addXP((cur as ReflectStep).xp);
    }
    setStep(s => s + 1);
  };

  // Módulos de solo-lectura (teoría/casos/bonus/desafío) — llevan "← Anterior" (§19).
  const THEORY_STEPS = new Set([0, 1, 2, 4, 6, 7, 8, 11, 13, 15, 18, 19]);
  const showBack = THEORY_STEPS.has(step) && step > 0;
  const handlePrev = () => { if (step > 0) setStep(s => s - 1); };

  const finishLevel = () => {
    const stars = xp >= 140 ? 3 : xp >= 90 ? 2 : 1; // máx real ~201 XP
    completeLevel(21, stars, xp);
    router.replace('/level/22');
  };

  const cur = steps[step];
  const CONTENT_STEPS = steps.length - 2; // = 20
  const progress = Math.round((step / (steps.length - 1)) * 100);

  // ¿el botón principal debe estar deshabilitado?
  const primaryDisabled = (() => {
    if (cur.type === 'quiz' && !qChecked) return Object.keys(qAnswers).length < (cur as QuizStep).questions.length;
    if (cur.type === 'vf' && !vfChecked) return Object.keys(vfAnswers).length < (cur as VFStep).statements.length;
    if (cur.type === 'fillblanks' && !fChecked) return Object.keys(fAnswers).length < (cur as FillBlanksStep).items.length;
    if (cur.type === 'promptcompare' && !pChecked) return Object.keys(pPicks).length < (cur as PromptCompareStep).tasks.length;
    if (cur.type === 'reflect') return reflectText.trim().length < (cur as ReflectStep).minChars;
    return false;
  })();

  const primaryLabel = (() => {
    if (cur.type === 'quiz') return qChecked ? 'Continuar →' : 'Comprobar respuestas';
    if (cur.type === 'vf') return vfChecked ? 'Continuar →' : 'Comprobar respuestas';
    if (cur.type === 'fillblanks') return fChecked ? 'Continuar →' : 'Comprobar';
    if (cur.type === 'promptcompare') return pChecked ? 'Continuar →' : 'Comprobar elecciones';
    if (cur.type === 'dragdrop') return dOk ? 'Continuar →' : 'Verificar';
    if (cur.type === 'matching') return mOk ? 'Continuar →' : 'Continuar →';
    if (cur.type === 'sort') return sOk ? 'Continuar →' : 'Verificar orden';
    if (cur.type === 'reflect') return 'Enviar reflexión →';
    if (step === 0) return '¡Empecemos! 🚀';
    return 'Entendido →';
  })();

  return (
    <View style={styles.screen}>
      <View style={styles.bar}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => exitLevel()} accessibilityLabel="Salir del nivel">
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
        <View style={styles.track}><View style={[styles.fill, { width: `${progress}%` }]} /></View>
        <Text style={styles.xpChip}>{xp} XP</Text>
      </View>
      {step > 0 && step < steps.length - 1 && (
        <Text style={styles.progLabel}>Módulo {step} de {CONTENT_STEPS}</Text>
      )}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {cur.type === 'theory' && (cur as TheoryStep).render()}
        {cur.type === 'dragdrop' && (
          <DragDropComponent mod={cur as DragDropStep} dPlaced={dPlaced} dSelected={dSelected}
            onSelect={setDSelected}
            onDrop={(col: string) => { if (dSelected) { setDPlaced(p => ({ ...p, [dSelected]: col })); setDSelected(null); } }}
            onRemove={(id: string) => setDPlaced(p => { const n = { ...p }; delete n[id]; return n; })}
            dOk={dOk} />
        )}
        {cur.type === 'matching' && (
          <MatchingComponent mod={cur as MatchingStep} mLeft={mLeft} mDone={mDone} mRightOrder={mRightOrder} mWrong={mWrong}
            onSelectLeft={(i: number) => { if (!mDone.has(i)) setMLeft(i); }}
            onSelectRight={(ri: number) => {
              if (mLeft === null) return;
              const correctRight = (cur as MatchingStep).pairs[mLeft].right;
              if (mRightOrder[ri] === correctRight) {
                const nd = new Set(mDone).add(mLeft); setMDone(nd); setMLeft(null);
                if (nd.size === (cur as MatchingStep).pairs.length) { addXP(cur.xp); setMOk(true); }
              } else { setMWrong(ri); setTimeout(() => setMWrong(null), 500); setMLeft(null); }
            }} />
        )}
        {cur.type === 'sort' && (
          <SortComponent mod={cur as SortStep} sOrder={sOrder} sWrong={sWrong} sOk={sOk} sFb={sFb}
            moveSort={(pos: number, dir: number) => { const np = pos + dir; if (np < 0 || np >= sOrder.length) return; setSOrder(prev => { const n = [...prev]; [n[pos], n[np]] = [n[np], n[pos]]; return n; }); setSWrong(new Set()); setSFb(null); }} />
        )}
        {cur.type === 'quiz' && (
          <QuizComponent mod={cur as QuizStep} qAnswers={qAnswers} qChecked={qChecked} onSelect={(qi: number, oi: number) => setQAnswers(p => ({ ...p, [qi]: oi }))} />
        )}
        {cur.type === 'vf' && (
          <VFComponent mod={cur as VFStep} vfAnswers={vfAnswers} vfChecked={vfChecked} onSelect={(qi: number, val: boolean) => setVFAnswers(p => ({ ...p, [qi]: val }))} />
        )}
        {cur.type === 'fillblanks' && (
          <FillBlanksComponent mod={cur as FillBlanksStep} fAnswers={fAnswers} fChecked={fChecked} onSelect={(qi: number, oi: number) => setFAnswers(p => ({ ...p, [qi]: oi }))} />
        )}
        {cur.type === 'promptcompare' && (
          <PromptCompareComponent mod={cur as PromptCompareStep} pPicks={pPicks} pChecked={pChecked} onSelect={(qi: number, which: 'bad' | 'good') => setPPicks(p => ({ ...p, [qi]: which }))} />
        )}
        {cur.type === 'reflect' && (
          <View>
            <StepTag color="#f3f4f6" textColor="#374151" label="✍️ Módulo 20 de 20 · Reflexión final · +15 XP" />
            <Text style={styles.lessonTitle}>{(cur as ReflectStep).title}</Text>
            <Text style={styles.lessonSub}>Ya conoces a Claude y a Gemini en profundidad. Piensa en: 1) una tarea donde Gemini sería claramente mejor que Claude y por qué; 2) una situación donde usarías Claude en vez de Gemini y la razón técnica.</Text>
            <TextInput style={styles.textArea} placeholder={(cur as ReflectStep).placeholder} placeholderTextColor="#b8bcc0" multiline value={reflectText} onChangeText={setReflectText} />
            <Text style={styles.charCount}>{reflectText.trim().length} / {(cur as ReflectStep).minChars} mínimo</Text>
          </View>
        )}
        {cur.type === 'completion' && (
          <View style={styles.completeContainer}>
            <View style={styles.completeIcon}><Text style={{ fontSize: 46 }}>✦</Text></View>
            <Text style={styles.completeTitle}>¡Nivel 21 completado!</Text>
            <Text style={styles.completeSub}>Terminaste "Gemini — La IA que vive en el ecosistema Google". Ahora tienes dos LLMs dominados: Claude para análisis profundo y contexto extenso, Gemini para búsqueda en tiempo real e integración con Google.</Text>
            <Text style={styles.xpBig}>⭐ {xp} XP ganados</Text>
            <View style={styles.skillsBox}>
              {[
                'Sé la historia de Gemini y por qué Google lo creó',
                'Entiendo la integración con Gmail, Docs, Drive y YouTube como fortaleza clave',
                'Sé cuándo Gemini supera a Claude y cuándo Claude supera a Gemini',
                'Puedo escribir prompts que aprovechan la búsqueda en tiempo real de Gemini',
                'Entiendo los aspectos de privacidad al usar Gemini con mis cuentas de Google',
              ].map((skill, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: i < 4 ? 7 : 0 }}>
                  <Text style={{ color: '#10b981', fontWeight: '700', fontSize: 14 }}>✓</Text>
                  <Text style={{ fontSize: 12, color: '#334155', lineHeight: 18, flex: 1 }}>{skill}</Text>
                </View>
              ))}
            </View>
            <View style={styles.nextHint}>
              <Text style={{ fontSize: 12, color: '#334155', lineHeight: 20 }}>
                ⚡ <Text style={{ fontWeight: '700' }}>Nivel 22: Grok — La IA con personalidad propia{'\n\n'}</Text>
                Conocerás a Grok, el LLM de xAI creado por Elon Musk. Tiene acceso en tiempo real a X (Twitter) y una personalidad que ningún otro LLM tiene.
              </Text>
            </View>
            <Text style={{ fontSize: 10, color: '#94a3b8', marginBottom: 8 }}>Nivel 21 de 36 completado · 58% del camino a IA Explorer</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={finishLevel}>
              <Text style={styles.primaryBtnText}>Siguiente nivel →</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {cur.type !== 'completion' && (
        <View style={styles.navRow}>
          {showBack && (
            <TouchableOpacity style={styles.backBtn} onPress={handlePrev}>
              <Text style={styles.backBtnText}>← Anterior</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.primaryBtn, { flex: 1 }, primaryDisabled && styles.primaryBtnOff]} onPress={handleNext} disabled={primaryDisabled}>
            <Text style={styles.primaryBtnText}>{primaryLabel}</Text>
          </TouchableOpacity>
        </View>
      )}
      {xpToast && <XPToast key={xpToast.id} amount={xpToast.amount} onHide={() => setXpToast(null)} />}
    </View>
  );
}

// ── Componentes interactivos ──
const DragDropComponent = ({ mod, dPlaced, dSelected, onSelect, onDrop, onRemove }: any) => (
  <View>
    <StepTag color="#e8f0fe" textColor="#1a56db" label="🎯 Clasificar" />
    <Text style={styles.lessonTitle}>{mod.title}</Text>
    <Text style={styles.bodyText}>{mod.instruction}</Text>
    <View style={styles.chipsPool}>
      {mod.items.filter((it: any) => !dPlaced[it.id]).map((it: any) => (
        <TouchableOpacity key={it.id} style={[styles.chip, dSelected === it.id && styles.chipSel]} onPress={() => onSelect(dSelected === it.id ? null : it.id)}>
          <Text style={styles.chipText}>{it.text}</Text>
        </TouchableOpacity>
      ))}
    </View>
    <View style={styles.dropCols}>
      {mod.zones.map((zone: string, zi: number) => {
        const col = mod.colClass[zi];
        const has = Object.values(dPlaced).includes(col);
        return (
          <TouchableOpacity key={zi} style={[styles.dropCol, has && styles.dropColHas]} onPress={() => onDrop(col)}>
            <Text style={[styles.dropHeader, { backgroundColor: zi === 0 ? '#e8f0fe' : '#fef2f2', color: zi === 0 ? '#1e3a8a' : '#991b1b' }]}>{zone}</Text>
            <View style={styles.dropArea}>
              {Object.entries(dPlaced).filter(([, z]) => z === col).map(([id]) => {
                const item = mod.items.find((i: any) => i.id === id);
                return (
                  <TouchableOpacity key={id} style={[styles.dropChip, { backgroundColor: zi === 0 ? '#e8f0fe' : '#fef2f2' }]} onPress={() => onRemove(id)}>
                    <Text style={{ fontSize: 11, color: zi === 0 ? '#1e3a8a' : '#991b1b' }}>{item.text} ✕</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  </View>
);

const MatchingComponent = ({ mod, mLeft, mDone, mRightOrder, mWrong, onSelectLeft, onSelectRight }: any) => (
  <View>
    <StepTag color="#e8f0fe" textColor="#1a56db" label="🔗 Conectar" />
    <Text style={styles.lessonTitle}>{mod.title}</Text>
    <Text style={styles.bodyText}>{mod.instruction}</Text>
    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 4 }}>
      <Text style={[styles.matchColLabel, { flex: 1 }]}>{mod.leftLabel}</Text>
      <Text style={[styles.matchColLabel, { flex: 1 }]}>{mod.rightLabel}</Text>
    </View>
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <View style={{ flex: 1 }}>
        {mod.pairs.map((p: any, i: number) => (
          <TouchableOpacity key={i} style={[styles.matchItem, mLeft === i && styles.matchItemSel, mDone.has(i) && styles.matchItemDone]} disabled={mDone.has(i)} onPress={() => onSelectLeft(i)}>
            <Text style={styles.matchText}>{p.left}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ flex: 1 }}>
        {mRightOrder.map((r: string, i: number) => {
          const done = mod.pairs.some((p: any, pi: number) => mDone.has(pi) && p.right === r);
          return (
            <TouchableOpacity key={i} style={[styles.matchItem, done && styles.matchItemDone, mWrong === i && styles.matchItemWrong]} disabled={done} onPress={() => onSelectRight(i)}>
              <Text style={styles.matchText}>{r}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  </View>
);

const SortComponent = ({ mod, sOrder, sWrong, sOk, sFb, moveSort }: any) => (
  <View>
    <StepTag color="#e8f0fe" textColor="#1a56db" label="🔢 Ordenar" />
    <Text style={styles.lessonTitle}>{mod.title}</Text>
    <Text style={styles.bodyText}>{mod.instruction}</Text>
    {sOrder.map((val: number, pos: number) => (
      <View key={pos} style={[styles.sortRow, sOk && styles.sortRowOk, sWrong.has(pos) && styles.sortRowBad]}>
        <View style={styles.sortNum}><Text style={styles.sortNumText}>{pos + 1}</Text></View>
        <Text style={styles.sortText}>{mod.correctOrder[val]}</Text>
        <View style={styles.arrowCol}>
          <TouchableOpacity onPress={() => moveSort(pos, -1)} disabled={pos === 0}><Text style={[styles.arrow, pos === 0 && styles.arrowOff]}>▲</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => moveSort(pos, 1)} disabled={pos === sOrder.length - 1}><Text style={[styles.arrow, pos === sOrder.length - 1 && styles.arrowOff]}>▼</Text></TouchableOpacity>
        </View>
      </View>
    ))}
    {sFb && <View style={[styles.feedback, sOk ? styles.feedbackOk : styles.feedbackFail]}><Text style={styles.feedbackText}>{sFb}</Text></View>}
  </View>
);

const QuizComponent = ({ mod, qAnswers, qChecked, onSelect }: any) => (
  <View>
    <StepTag color="#fef3c7" textColor="#92400e" label="🧠 Quiz" />
    <Text style={styles.lessonTitle}>{mod.title}</Text>
    {mod.questions.map((q: any, qi: number) => (
      <View key={qi} style={{ marginBottom: 18 }}>
        <Text style={styles.quizQ}>{q.question}</Text>
        {q.options.map((opt: string, oi: number) => {
          let s = styles.quizOpt as any;
          if (qChecked && oi === q.correct) s = { ...s, ...styles.quizOptCorrect };
          else if (qChecked && qAnswers[qi] === oi && oi !== q.correct) s = { ...s, ...styles.quizOptWrong };
          else if (qAnswers[qi] === oi) s = { ...s, ...styles.quizOptSel };
          return (
            <TouchableOpacity key={oi} style={s} disabled={qChecked} onPress={() => onSelect(qi, oi)}>
              <Text style={styles.quizOptText}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
        {qChecked && (
          <View style={[styles.feedback, qAnswers[qi] === q.correct ? styles.feedbackOk : styles.feedbackFail]}>
            <Text style={styles.feedbackText}>{qAnswers[qi] === q.correct ? '✓ ¡Correcto! ' : '✗ '}{q.explain}</Text>
          </View>
        )}
      </View>
    ))}
  </View>
);

const VFComponent = ({ mod, vfAnswers, vfChecked, onSelect }: any) => (
  <View>
    <StepTag color="#fef3c7" textColor="#92400e" label="✅❌ Verdadero o Falso" />
    <Text style={styles.lessonTitle}>{mod.title}</Text>
    {mod.statements.map((s: any, qi: number) => (
      <View key={qi} style={{ marginBottom: 16 }}>
        <Text style={styles.quizQ}>{s.text}</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity style={[styles.tfBtn, vfAnswers[qi] === true && styles.tfSelTrue, vfChecked && s.correct === true && styles.tfCorrect, vfChecked && vfAnswers[qi] === true && !s.correct && styles.tfWrong]} disabled={vfChecked} onPress={() => onSelect(qi, true)}>
            <Text style={styles.tfBtnText}>✅ Verdadero</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tfBtn, vfAnswers[qi] === false && styles.tfSelFalse, vfChecked && s.correct === false && styles.tfCorrect, vfChecked && vfAnswers[qi] === false && !s.correct && styles.tfWrong]} disabled={vfChecked} onPress={() => onSelect(qi, false)}>
            <Text style={styles.tfBtnText}>❌ Falso</Text>
          </TouchableOpacity>
        </View>
        {vfChecked && (
          <View style={[styles.feedback, vfAnswers[qi] === s.correct ? styles.feedbackOk : styles.feedbackFail]}>
            <Text style={styles.feedbackText}>{vfAnswers[qi] === s.correct ? '✓ ' : '✗ '}{s.feedback}</Text>
          </View>
        )}
      </View>
    ))}
  </View>
);

const FillBlanksComponent = ({ mod, fAnswers, fChecked, onSelect }: any) => (
  <View>
    <StepTag color="#e8f0fe" textColor="#1a56db" label="📝 Vocabulario" />
    <Text style={styles.lessonTitle}>{mod.title}</Text>
    {mod.items.map((it: any, qi: number) => {
      const blank = fAnswers[qi] !== undefined ? it.options[fAnswers[qi]] : '_____';
      return (
        <View key={qi} style={{ marginBottom: 16 }}>
          <Text style={styles.fillSentence}>{it.sentence(blank)}</Text>
          <View style={styles.optWrap}>
            {it.options.map((o: string, oi: number) => {
              let s = styles.fillOpt as any;
              if (fChecked && oi === it.correct) s = { ...s, ...styles.fillOptCorrect };
              else if (fChecked && fAnswers[qi] === oi && oi !== it.correct) s = { ...s, ...styles.fillOptWrong };
              else if (fAnswers[qi] === oi) s = { ...s, ...styles.fillOptSel };
              return (
                <TouchableOpacity key={oi} style={s} disabled={fChecked} onPress={() => onSelect(qi, oi)}>
                  <Text style={styles.fillOptText}>{o}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {fChecked && (
            <View style={[styles.feedback, fAnswers[qi] === it.correct ? styles.feedbackOk : styles.feedbackFail]}>
              <Text style={styles.feedbackText}>{fAnswers[qi] === it.correct ? '✓ ' : '✗ '}{it.explain}</Text>
            </View>
          )}
        </View>
      );
    })}
  </View>
);

const PromptCompareComponent = ({ mod, pPicks, pChecked, onSelect }: any) => (
  <View>
    <StepTag color="#ecfdf5" textColor="#065f46" label="🔍 Comparar prompts" />
    <Text style={styles.lessonTitle}>{mod.title}</Text>
    {mod.tasks.map((task: any, qi: number) => {
      const order: ('bad' | 'good')[] = task.flip ? ['good', 'bad'] : ['bad', 'good'];
      return (
        <View key={qi} style={{ marginBottom: 18 }}>
          <Text style={styles.promptTask}>🎯 {task.task}</Text>
          {order.map((which, pos) => {
            const isGood = which === 'good';
            const sel = pPicks[qi] === which;
            let s = styles.promptCard as any;
            if (pChecked) s = { ...s, ...(isGood ? styles.promptCardGood : styles.promptCardBad) };
            else if (sel) s = { ...s, ...styles.promptCardSel };
            const labelColor = !pChecked ? '#64748b' : isGood ? '#16a34a' : '#ef4444';
            return (
              <TouchableOpacity key={which} style={s} disabled={pChecked} onPress={() => onSelect(qi, which)}>
                <Text style={[styles.promptLabel, { color: labelColor }]}>Prompt {String.fromCharCode(65 + pos)}:</Text>
                <Text style={styles.promptText}>{isGood ? task.good : task.bad}</Text>
              </TouchableOpacity>
            );
          })}
          {pChecked && (
            <View style={[styles.feedback, pPicks[qi] === 'good' ? styles.feedbackOk : styles.feedbackFail]}>
              <Text style={styles.feedbackText}>{pPicks[qi] === 'good' ? '✓ ¡Correcto! ' : '✗ El prompt más específico y completo era el mejor. '}{task.explain}</Text>
            </View>
          )}
        </View>
      );
    })}
  </View>
);

// ── Estilos ──
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  bar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  closeBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 15, fontWeight: '800', color: '#6b7280' },
  track: { flex: 1, height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, marginHorizontal: 12 },
  fill: { height: '100%', backgroundColor: '#1a73e8', borderRadius: 3 },
  xpChip: { ...typography.bold, fontSize: 14, color: '#1a56db' },
  progLabel: { ...typography.caption, color: '#9ca3af', textAlign: 'center', paddingTop: 6 },
  scrollContent: { padding: 16, paddingBottom: 30 },
  introIcon: { width: 68, height: 68, borderRadius: 20, backgroundColor: '#e8f0fe', justifyContent: 'center', alignItems: 'center', marginBottom: 12, alignSelf: 'flex-start' },
  stepTag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 12 },
  stepTagText: { fontSize: 11, fontWeight: '700' },
  lessonTitle: { ...typography.extraBold, fontSize: 20, color: '#111827', marginBottom: 8, lineHeight: 26 },
  lessonSub: { ...typography.regular, fontSize: 13, color: '#6b7280', marginBottom: 14, lineHeight: 19 },
  bodyText: { ...typography.regular, fontSize: 13, color: '#374151', lineHeight: 21, marginBottom: 12 },
  sectionTitle: { ...typography.bold, fontSize: 14, color: '#111827', marginTop: 8, marginBottom: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  card: { backgroundColor: '#f9fafb', borderRadius: 14, padding: 13, marginBottom: 10, borderWidth: 1 },
  cardRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  cardIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { ...typography.bold, fontSize: 13, color: '#111827', marginBottom: 4 },
  cardText: { ...typography.regular, fontSize: 12, color: '#374151', lineHeight: 18 },
  exCard: { backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  exCardOpen: { borderColor: '#4285f4', backgroundColor: '#f8fbff' },
  exEmoji: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  exSub: { fontSize: 11, color: '#6b7280', marginTop: 1 },
  exArrow: { fontSize: 16, color: '#9ca3af' },
  exBody: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  exHow: { fontSize: 12, color: '#374151', lineHeight: 19, marginBottom: 8 },
  exFact: { backgroundColor: '#fef9c3', borderRadius: 8, padding: 9, borderWidth: 1, borderColor: '#fde68a' },
  exFactText: { fontSize: 12, color: '#854d0e', lineHeight: 17, fontWeight: '500' },
  hlBox: { padding: 12, borderRadius: 10, borderLeftWidth: 3, marginTop: 10, marginBottom: 6 },
  hlBoxText: { fontSize: 13, color: '#1e3a8a', lineHeight: 20 },
  stepList: { marginVertical: 8, gap: 9 },
  stepItem: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#1a73e8', alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  stepText: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 20 },
  vsGrid: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  vsCol: { flex: 1, borderRadius: 12, padding: 10, borderWidth: 1 },
  vsHeader: { fontSize: 11, fontWeight: '700', textAlign: 'center', padding: 5, borderRadius: 7, marginBottom: 8 },
  vsItem: { fontSize: 11, color: '#374151', paddingVertical: 4, lineHeight: 15 },
  caseBox: { borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1 },
  caseTitle: { ...typography.bold, fontSize: 13, marginBottom: 6 },
  caseText: { fontSize: 12, color: '#374151', lineHeight: 18, marginBottom: 8, backgroundColor: '#ffffff90', padding: 8, borderRadius: 8 },
  caseAnswer: { fontSize: 12, lineHeight: 18 },
  chipsPool: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, padding: 10, backgroundColor: '#f9fafb', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 10, minHeight: 54 },
  chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#d1d5db', backgroundColor: '#fff' },
  chipSel: { borderColor: '#1a73e8', backgroundColor: '#e8f0fe' },
  chipText: { fontSize: 12, color: '#374151' },
  dropCols: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  dropCol: { flex: 1, borderRadius: 12, borderWidth: 2, borderStyle: 'dashed', borderColor: '#d1d5db', minHeight: 80, padding: 8, backgroundColor: '#fafafa' },
  dropColHas: { borderStyle: 'solid', borderColor: '#93c5fd', backgroundColor: '#eff6ff' },
  dropHeader: { fontSize: 11, fontWeight: '700', textAlign: 'center', padding: 5, borderRadius: 7, marginBottom: 7, overflow: 'hidden' },
  dropArea: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  dropChip: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12 },
  matchColLabel: { fontSize: 11, fontWeight: '700', color: '#6b7280', textAlign: 'center' },
  matchItem: { padding: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#e5e7eb', marginBottom: 6, minHeight: 58, justifyContent: 'center', backgroundColor: '#f9fafb' },
  matchItemSel: { borderColor: '#1a73e8', backgroundColor: '#e8f0fe' },
  matchItemDone: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  matchItemWrong: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  matchText: { fontSize: 11, color: '#374151', textAlign: 'center', lineHeight: 15 },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, backgroundColor: '#f9fafb', borderRadius: 12, borderWidth: 1.5, borderColor: '#e5e7eb', marginBottom: 6 },
  sortRowOk: { borderColor: '#86efac', backgroundColor: '#f0fdf4' },
  sortRowBad: { borderColor: '#fca5a5', backgroundColor: '#fef2f2' },
  sortNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#1a73e8', alignItems: 'center', justifyContent: 'center' },
  sortNumText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  sortText: { flex: 1, fontSize: 12, color: '#374151', lineHeight: 17 },
  arrowCol: { flexDirection: 'column', gap: 2 },
  arrow: { fontSize: 13, color: '#1a73e8', paddingHorizontal: 6 },
  arrowOff: { color: '#cbd5e1' },
  quizQ: { ...typography.bold, fontSize: 13, color: '#111827', padding: 12, backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 8, lineHeight: 18 },
  quizOpt: { padding: 12, borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 11, marginBottom: 6, backgroundColor: '#fff' },
  quizOptSel: { borderColor: '#1a73e8', backgroundColor: '#e8f0fe' },
  quizOptCorrect: { borderColor: '#16a34a', backgroundColor: '#dcfce7' },
  quizOptWrong: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  quizOptText: { fontSize: 12, color: '#374151', lineHeight: 17 },
  tfBtn: { flex: 1, padding: 13, borderRadius: 11, borderWidth: 2, borderColor: '#e5e7eb', alignItems: 'center', backgroundColor: '#fff' },
  tfSelTrue: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  tfSelFalse: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  tfCorrect: { borderColor: '#16a34a', backgroundColor: '#dcfce7' },
  tfWrong: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  tfBtnText: { fontSize: 13, fontWeight: '700', color: '#374151' },
  fillSentence: { fontSize: 13, color: '#111827', padding: 12, backgroundColor: '#f9fafb', borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 8, ...typography.bold, lineHeight: 20 },
  optWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  fillOpt: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: '#d1d5db', backgroundColor: '#fff' },
  fillOptSel: { borderColor: '#1a73e8', backgroundColor: '#e8f0fe' },
  fillOptCorrect: { borderColor: '#16a34a', backgroundColor: '#dcfce7' },
  fillOptWrong: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  fillOptText: { fontSize: 12, color: '#374151', fontWeight: '600' },
  promptTask: { fontSize: 12, fontWeight: '700', color: '#111827', padding: 9, backgroundColor: '#e8f0fe', borderRadius: 9, borderWidth: 1, borderColor: '#c2ddfb', marginBottom: 8 },
  promptCard: { borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: '#e5e7eb', marginBottom: 8, backgroundColor: '#fff' },
  promptCardSel: { borderColor: '#1a73e8', backgroundColor: '#e8f0fe' },
  promptCardGood: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  promptCardBad: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  promptLabel: { fontSize: 10, fontWeight: '700', marginBottom: 4 },
  promptText: { fontSize: 12, color: '#374151', lineHeight: 18 },
  feedback: { borderRadius: 10, padding: 11, marginTop: 8 },
  feedbackOk: { backgroundColor: '#dcfce7' },
  feedbackFail: { backgroundColor: '#fef2f2' },
  feedbackText: { fontSize: 12, lineHeight: 17, color: '#334155' },
  textArea: { borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, minHeight: 110, fontSize: 13, backgroundColor: '#fafafa', marginBottom: 6, textAlignVertical: 'top', color: '#374151' },
  charCount: { fontSize: 11, color: '#9ca3af', textAlign: 'right' },
  navRow: { flexDirection: 'row', gap: 8, padding: 14, borderTopWidth: 1, borderTopColor: '#f0f0f0', backgroundColor: '#fafafa' },
  backBtn: { paddingHorizontal: 16, paddingVertical: 13, borderRadius: 12, backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#e2e8f0', justifyContent: 'center' },
  backBtnText: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  primaryBtn: { backgroundColor: '#1a73e8', padding: 14, borderRadius: 12, alignItems: 'center' },
  primaryBtnOff: { backgroundColor: '#e5e7eb' },
  primaryBtnText: { ...typography.bold, color: '#fff', fontSize: 15 },
  completeContainer: { alignItems: 'center', paddingTop: 10 },
  completeIcon: { width: 86, height: 86, borderRadius: 24, backgroundColor: '#e8f0fe', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  completeTitle: { ...typography.extraBold, fontSize: 22, color: '#111827', marginBottom: 6, textAlign: 'center' },
  completeSub: { ...typography.regular, fontSize: 13, color: '#6b7280', textAlign: 'center', marginBottom: 16, lineHeight: 19 },
  xpBig: { ...typography.bold, fontSize: 16, color: '#854d0e', backgroundColor: '#fef9c3', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#fde047', overflow: 'hidden' },
  skillsBox: { backgroundColor: '#f0fdf4', borderRadius: 12, padding: 13, marginBottom: 14, borderWidth: 1, borderColor: '#bbf7d0', width: '100%' },
  nextHint: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 11, marginBottom: 14, borderWidth: 1, borderColor: '#e2e8f0', width: '100%' },
});
