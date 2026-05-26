// src/levels/World4/Level2.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
} from 'react-native';
import { useGameStore } from '../store/gameStore';
import { colors, typography } from '../theme';

// ─── Tipos de módulo ──────────────────────────────────────
interface TheoryStep {
  type: 'theory';
  title: string;
  xp: number;
  render: () => React.ReactElement;
}

interface DragDropStep {
  type: 'dragdrop';
  title: string;
  xp: number;
  instruction: string;
  zones: string[];
  items: { id: string; text: string; correct: string }[];
  colClass: string[];
}

interface MatchingStep {
  type: 'matching';
  title: string;
  xp: number;
  pairs: { left: string; right: string }[];
}

interface SortStep {
  type: 'sort';
  title: string;
  xp: number;
  instruction: string;
  correctOrder: string[];
}

interface QuizStep {
  type: 'quiz';
  title: string;
  xp: number;
  questions: { question: string; options: string[]; correct: number; explain: string }[];
}

interface VFStep {
  type: 'vf';
  title: string;
  xp: number;
  statements: { text: string; correct: boolean; feedback: string }[];
}

interface FillBlanksStep {
  type: 'fillblanks';
  title: string;
  xp: number;
  items: { sentence: (blank: string) => string; options: string[]; correct: number; explain: string }[];
}

interface PromptCompareStep {
  type: 'promptcompare';
  title: string;
  xp: number;
  tasks: { task: string; bad: string; good: string; explain: string }[];
}

interface ReflectStep {
  type: 'reflect';
  title: string;
  xp: number;
  placeholder: string;
  minChars: number;
}

interface CompletionStep {
  type: 'completion';
  title: string;
  xp: number;
}

type Step =
  | TheoryStep
  | DragDropStep
  | MatchingStep
  | SortStep
  | QuizStep
  | VFStep
  | FillBlanksStep
  | PromptCompareStep
  | ReflectStep
  | CompletionStep;

// ─── Pools de datos (extraídos del HTML) ──────────────────
const pickRandom = <T,>(arr: T[], count: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};

const DRAG_POOL = [
  { text: 'Analizar un texto largo de 50 páginas', correct: 'fortaleza' },
  { text: 'Buscar el precio del euro hoy', correct: 'cuidado' },
  { text: 'Revisar y mejorar tu ensayo escolar', correct: 'fortaleza' },
  { text: 'Explicar un concepto difícil paso a paso', correct: 'fortaleza' },
  { text: 'Darte el resultado del partido de anoche', correct: 'cuidado' },
  { text: 'Ayudarte a planear un proyecto de ciencias', correct: 'fortaleza' },
  { text: 'Decirte si llovió ayer en Tokio', correct: 'cuidado' },
  { text: 'Generar ideas creativas para tu historia', correct: 'fortaleza' },
  { text: 'Encontrar restaurantes abiertos cerca de ti', correct: 'cuidado' },
  { text: 'Resumir un artículo científico complejo', correct: 'fortaleza' },
  { text: 'Decirte quién ganó las elecciones de ayer', correct: 'cuidado' },
  { text: 'Ayudarte a entender un error en tu código', correct: 'fortaleza' },
];

const MATCH_POOL = [
  { left: 'Puede mantener el hilo de una conversación larga', right: 'Ventana de contexto extensa' },
  { left: 'Explica temas con honestidad sobre sus límites', right: 'Calibración de incertidumbre' },
  { left: 'Puede leer y analizar imágenes enviadas', right: 'Visión multimodal' },
  { left: 'Genera código funcional en varios lenguajes', right: 'Capacidad de programación' },
  { left: 'Adaptada para no hacer daño ni engañar', right: 'Entrenamiento con seguridad (RLHF)' },
  { left: 'Puede analizar documentos PDF muy largos', right: 'Procesamiento de documentos' },
  { left: 'Escribe en el estilo y tono que le pidas', right: 'Adaptación de voz y estilo' },
  { left: 'Responde diferente según el país o cultura', right: 'Sensibilidad cultural' },
];

const QUIZ_POOL = [
  { q: 'Tienes un ensayo de 8 páginas y necesitas que te den retroalimentación detallada de estructura, argumentos y estilo. ¿Qué LLM eliges?',
    opts: ['ChatGPT — porque es más popular', 'Claude — por su ventana de contexto extensa y análisis de textos largos', 'Google — porque tiene acceso a internet', 'Ambos son exactamente iguales'],
    correct: 1, explain: 'Claude tiene una de las ventanas de contexto más grandes, perfecta para documentos largos.' },
  { q: 'Necesitas que el LLM te diga si una afirmación que leíste es verdadera o falsa. ¿Qué característica de Claude es más útil?',
    opts: ['Su velocidad de respuesta', 'Su calibración de incertidumbre — te dice cuando no está seguro', 'Su acceso a internet', 'Su capacidad para generar imágenes'],
    correct: 1, explain: 'Claude expresa su nivel de confianza, no inventa respuestas.' },
  { q: 'Estás escribiendo una novela de ciencia ficción y quieres un asistente que mantenga la coherencia. ¿Cuál es la ventaja clave?',
    opts: ['Claude tiene acceso a todas las novelas', 'Claude recuerda toda la conversación y mantiene contexto narrativo extenso', 'Claude genera imágenes de los personajes', 'Claude traduce la novela a 50 idiomas'],
    correct: 1, explain: 'La ventana de contexto extensa es ideal para proyectos creativos largos.' },
  { q: '¿Qué empresa creó a Claude?',
    opts: ['OpenAI', 'Google DeepMind', 'Anthropic, fundada por ex-investigadores de seguridad en IA', 'Meta'],
    correct: 2, explain: 'Anthropic fue fundada en 2021 por Dario y Daniela Amodei.' },
  { q: 'Estás en Japón y quieres que Claude te ayude con noticias locales. ¿Qué afirmación es correcta?',
    opts: ['Claude solo funciona en inglés y español', 'Claude es multilingüe y puede trabajar con japonés, coreano, árabe y más', 'Claude necesita conexión a internet para traducir', 'Claude traduce bien pero no entiende preguntas en japonés'],
    correct: 1, explain: 'Claude es multilingüe y funciona en decenas de idiomas.' },
  { q: '¿Cuál describe mejor la filosofía de diseño de Claude?',
    opts: ['Maximizar la velocidad', 'Ser útil, inocuo y honesto', 'Generar la respuesta más larga posible', 'Acceder a internet siempre'],
    correct: 1, explain: 'Los tres principios de Claude: útil, inocuo y honesto.' },
  { q: 'Eres estudiante en Australia y necesitas ayuda con un trabajo de investigación. ¿Cómo deberías usar Claude?',
    opts: ['Pedirle que escriba todo el trabajo por ti', 'Usarlo para entender conceptos, organizar ideas y mejorar redacción, escribiendo tú', 'Copiarlo directamente', 'No usarlo porque los LLMs están prohibidos en escuelas australianas'],
    correct: 1, explain: 'Claude como tutor: te ayuda a aprender, no a hacer trampa.' },
  { q: '¿Qué significa que Claude tiene "calibración de incertidumbre"?',
    opts: ['Da respuestas siempre en el mismo formato', 'Ajusta su nivel de confianza — te dice cuando no está seguro', 'Tarda más en responder', 'Mide los caracteres de la respuesta'],
    correct: 1, explain: 'Calibración = expresar nivel de certeza en las respuestas.' },
];

const TF_POOL = [
  { stmt: 'Claude puede acceder a internet para buscar información en tiempo real', correct: false, explain: 'Claude no tiene acceso a internet por defecto.' },
  { stmt: 'Claude puede analizar y responder preguntas sobre imágenes que le envías', correct: true, explain: 'Claude es multimodal y puede analizar imágenes.' },
  { stmt: 'Claude fue creado por la misma empresa que hizo ChatGPT', correct: false, explain: 'ChatGPT es de OpenAI; Claude es de Anthropic.' },
  { stmt: 'Claude puede inventar información que suena verdadera aunque no lo sea', correct: true, explain: 'Es una limitación conocida como "alucinación".' },
  { stmt: 'Puedes usar Claude en varios idiomas, no solo en inglés', correct: true, explain: 'Claude es multilingüe.' },
  { stmt: 'Claude siempre da la misma respuesta exacta a la misma pregunta', correct: false, explain: 'Los LLMs tienen variabilidad.' },
  { stmt: 'Claude está diseñado para evitar generar contenido dañino', correct: true, explain: 'Principio de seguridad (harmless).' },
  { stmt: 'Claude recuerda todas las conversaciones que has tenido con él en sesiones anteriores', correct: false, explain: 'Por defecto no tiene memoria entre sesiones.' },
  { stmt: 'Puedes pedirle a Claude que adopte el rol de un personaje o experto', correct: true, explain: 'Role prompting mejora las respuestas.' },
  { stmt: 'Claude puede escribir código funcional en Python o JavaScript', correct: true, explain: 'Claude es muy capaz con programación.' },
];

const FILL_POOL = [
  { sentence: (w: string) => `La empresa que creó a Claude se llama ${w}.`, opts: ['Anthropic', 'OpenAI', 'Google', 'Meta'], correct: 0, explain: 'Anthropic fue fundada en 2021.' },
  { sentence: (w: string) => `La capacidad de Claude de procesar documentos muy largos se llama ventana de ${w}.`, opts: ['contexto', 'memoria', 'almacenamiento', 'caché'], correct: 0, explain: 'La "ventana de contexto" es la cantidad de texto que puede ver.' },
  { sentence: (w: string) => `Cuando Claude dice "no estoy completamente seguro", está mostrando ${w} de incertidumbre.`, opts: ['calibración', 'confusión', 'error', 'alucinación'], correct: 0, explain: '"Calibración" = ajustar nivel de confianza.' },
  { sentence: (w: string) => `Los tres principios de Claude son: útil, inocuo y ${w}.`, opts: ['honesto', 'rápido', 'preciso', 'creativo'], correct: 0, explain: '"Honesto" es el tercer principio.' },
  { sentence: (w: string) => `Pedirle a Claude que actúe como un personaje se llama ${w} prompting.`, opts: ['role', 'zero-shot', 'chain', 'few-shot'], correct: 0, explain: 'Role prompting mejora las respuestas.' },
  { sentence: (w: string) => `Cuando Claude inventa datos con confianza aunque sean falsos, eso se llama ${w}.`, opts: ['alucinación', 'traducción', 'calibración', 'razonamiento'], correct: 0, explain: '"Alucinación" es generar información incorrecta.' },
];

const USECASE_POOL = [
  { text: 'Revisar la gramática de tu tarea', correct: 'usa' },
  { text: 'Ver si hay tráfico en tu ciudad ahora', correct: 'no-usa' },
  { text: 'Crear un plan de estudio personalizado', correct: 'usa' },
  { text: 'Saber qué películas están en cines esta semana', correct: 'no-usa' },
  { text: 'Entender por qué falla tu código de Python', correct: 'usa' },
  { text: 'Ver el saldo de tu cuenta bancaria', correct: 'no-usa' },
  { text: 'Generar ideas para una presentación creativa', correct: 'usa' },
  { text: 'Pedir un domicilio de comida a tu casa', correct: 'no-usa' },
  { text: 'Aprender cómo funciona el sistema solar', correct: 'usa' },
  { text: 'Saber si hay vuelos baratos para mañana', correct: 'no-usa' },
];

const PROMPT_POOL = [
  { task: 'Pedir ayuda para preparar un examen de historia',
    bad: 'Ayúdame con historia',
    good: 'Tengo un examen de Historia Mundial sobre la Segunda Guerra Mundial mañana. Soy estudiante de 12 años. Crea 8 preguntas de práctica tipo opción múltiple, de menor a mayor dificultad, con respuestas al final.',
    explain: 'El prompt bueno especifica el tema, nivel, tipo de actividad y formato.' },
  { task: 'Pedir que explique un concepto de ciencias',
    bad: '¿Cómo funciona la fotosíntesis?',
    good: 'Explícame cómo funciona la fotosíntesis como si tuvieras 12 años. Usa una analogía con algo cotidiano. Máximo 3 párrafos con un ejemplo al final.',
    explain: 'El prompt bueno especifica nivel, pide analogía y limita el largo.' },
  { task: 'Pedir ayuda para una historia creativa',
    bad: 'Escríbeme una historia',
    good: 'Escribe el inicio de una historia de ciencia ficción. El protagonista es una chica de 13 años en Seúl en 2087. Hay una IA que se conectó a todos los celulares. Estilo emocionante, con diálogos. Solo el primer capítulo, unas 300 palabras.',
    explain: 'El prompt bueno especifica personaje, lugar, tiempo, conflicto, estilo y largo.' },
  { task: 'Pedir retroalimentación de tu trabajo escrito',
    bad: '¿Está bien mi texto?',
    good: 'Revisa este texto que escribí. Busca errores de ortografía y gramática. No cambies mi estilo ni reescribas nada — solo señala los errores con una explicación de por qué es un error y cómo corregirlo.',
    explain: 'El prompt bueno define exactamente qué revisar y cómo presentar correcciones.' },
  { task: 'Pedir que te enseñe a usar una herramienta digital',
    bad: 'Enséñame a usar Canva',
    good: 'Nunca he usado Canva. Soy estudiante de secundaria en México y quiero crear una infografía sobre el cambio climático. Explícame los pasos básicos desde cero, como un tutorial para principiantes.',
    explain: 'El prompt bueno da contexto, objetivo y formato deseado.' },
];

// ─── Construcción de módulos (22 pasos) ───────────────────
const buildSteps = (): Step[] => {
  return [
    // 0 INTRO
    {
      type: 'theory', title: 'Introducción', xp: 0,
      render: () => (
        <View>
          <StepTag color="#fff3ee" textColor="#9a3412" label="Nivel 20 · 20 módulos" />
          <View style={[styles.lessonIcon, { backgroundColor: '#fff3ee' }]}>
            <Text style={{ fontSize: 34 }}>🌟</Text>
          </View>
          <Text style={styles.lessonTitle}>Claude — El asistente que piensa contigo</Text>
          <Text style={styles.bodyText}>
            Ya conoces los LLMs en general. Ahora es tiempo de conocer a fondo a Claude: quién lo creó, cómo funciona, en qué brilla y cómo sacarle el máximo provecho para tus estudios y proyectos.
          </Text>
          <Card color="#fdd9c8" icon="📚" title="Qué vas a aprender" text="Historia de Anthropic · Fortalezas y límites · Claude vs ChatGPT · Prompts efectivos · Ética de uso" />
          <Card color="#bbf7d0" icon="⚡" title="Lo nuevo en este nivel" text="Conocerás a Claude como tu herramienta principal de estudio." />
          <Card color="#fde68a" icon="🎮" title="20 módulos · hasta 175 XP" text="Teoría · Casos · Clasificar · Conectar · Ordenar · Quiz · V/F · Vocabulario · Prompts · Reflexión" />
        </View>
      ),
    },
    // 1 TEORÍA
    {
      type: 'theory', title: '¿Qué es Claude y quién lo creó?', xp: 10,
      render: () => (
        <View>
          <StepTag color="#f0fdf4" textColor="#166534" label="Módulo 1 · Teoría" />
          <Text style={styles.lessonTitle}>¿Qué es Claude y quién lo creó?</Text>
          <Text style={styles.bodyText}>En 2021, un grupo de investigadores salió de OpenAI con una pregunta diferente: ¿qué pasaría si construimos un LLM poniendo la seguridad y la honestidad primero? Así nació Anthropic.</Text>
          <Card color="#fdd9c8" icon="🏢" title="Anthropic" text="Fundada en San Francisco, EE.UU., por Dario y Daniela Amodei. Su misión: desarrollo de IA para el beneficio a largo plazo de la humanidad." />
          <Text style={styles.sectionTitle}>Los tres principios que guían a Claude</Text>
          <Card color="#bbf7d0" icon="🤝" title="1. Útil (Helpful)" text="Claude intenta ayudar de manera práctica y completa." />
          <Card color="#bfdbfe" icon="🛡️" title="2. Inocuo (Harmless)" text="Evita generar contenido que pueda causar daño." />
          <Card color="#fde68a" icon="💬" title="3. Honesto (Honest)" text="No miente ni inventa; si no sabe, lo dice." />
          <HLBox color="#fff3ee" borderColor="#da7756">
            <Text style={styles.hlBoxText}><Bold>¿Por qué importa?</Bold> Cuando usas Claude para estudiar, sabes que si te dice "no estoy seguro", es verdad. No te va a dar una respuesta falsa.</Text>
          </HLBox>
        </View>
      ),
    },
    // 2 CASOS (ejemplos expandibles)
    {
      type: 'theory', title: 'Claude en el mundo real', xp: 10,
      render: () => <ExampleCards />,
    },
    // 3 DRAG DROP: fortalezas vs cuidados
    {
      type: 'dragdrop', title: 'Fortalezas vs Cuidados', xp: 20,
      instruction: 'Clasifica cada caso según sea una fortaleza de Claude o mejor usar otra herramienta.',
      zones: ['💪 Fortaleza de Claude', '⚠️ Usa otra herramienta'],
      items: pickRandom(DRAG_POOL, 10).map((item, idx) => ({ id: `d${idx}`, text: item.text, correct: item.correct })),
      colClass: ['fortaleza', 'cuidado'],
    },
    // 4 TEORÍA: ventana de contexto
    {
      type: 'theory', title: 'La superpower de Claude', xp: 10,
      render: () => (
        <View>
          <StepTag color="#f0fdf4" textColor="#166534" label="Módulo 4 · Teoría" />
          <Text style={styles.lessonTitle}>La ventana de contexto</Text>
          <HLBox color="#fff3ee" borderColor="#da7756">
            <Text style={styles.hlBoxText}><Bold>Ventana de contexto:</Bold> La cantidad de texto que Claude puede "ver" en una conversación. Claude tiene una de las más grandes.</Text>
          </HLBox>
          <Card color="#fdd9c8" icon="📄" title="Analizar documentos largos" text="Puedes pegar el texto de un libro y Claude lo procesa sin perder detalles." />
          <Card color="#bfdbfe" icon="💬" title="Conversaciones largas" text="Recuerda lo que dijiste al principio sin repetir contexto." />
          <Card color="#bbf7d0" icon="📝" title="Proyectos creativos" text="Mantiene personajes, trama y estilo durante toda la sesión." />
          <HLBox color="#fef2f2" borderColor="#dc2626">
            <Text style={styles.hlBoxText}><Bold>⚠️ Límite:</Bold> Al cerrar la conversación, Claude empieza desde cero. Cada sesión es nueva.</Text>
          </HLBox>
        </View>
      ),
    },
    // 5 MATCHING
    {
      type: 'matching', title: 'Capacidades de Claude', xp: 15,
      pairs: pickRandom(MATCH_POOL, 4).map(p => ({ left: p.left, right: p.right })),
    },
    // 6 TEORÍA: Claude vs ChatGPT
    {
      type: 'theory', title: 'Claude vs ChatGPT', xp: 10,
      render: () => <ClaudeVsChatGPT />,
    },
    // 7 TEORÍA: Cómo hablarle a Claude
    {
      type: 'theory', title: 'Cómo hablarle a Claude', xp: 10,
      render: () => (
        <View>
          <StepTag color="#f0fdf4" textColor="#166534" label="Módulo 7 · Teoría" />
          <Text style={styles.lessonTitle}>Cómo hablarle para que brille</Text>
          <StepList items={[
            '<b>Rol:</b> Dile quién debe ser. "Actúa como profesor de química".',
            '<b>Contexto:</b> Dile quién eres. "Soy estudiante de 12 años en Australia".',
            '<b>Tarea específica:</b> "Explícame X", "Resume Y".',
            '<b>Formato:</b> "En una lista de 5 puntos", "Con ejemplos al final".',
          ]} />
          <HLBox color="#f0fdf4" borderColor="#16a34a">
            <Text style={styles.hlBoxText}><Bold>Ejemplo completo:</Bold> "Actúa como tutor de matemáticas. Soy estudiante de 7° grado en Nueva Zelanda. No entiendo fracciones. Explícame cómo sumar fracciones usando una analogía con pizza. Máximo 4 pasos con un ejemplo."</Text>
          </HLBox>
        </View>
      ),
    },
    // 8 TEORÍA: honestidad
    {
      type: 'theory', title: 'La honestidad de Claude', xp: 10,
      render: () => (
        <View>
          <StepTag color="#f0fdf4" textColor="#166534" label="Módulo 8 · Teoría" />
          <Text style={styles.lessonTitle}>Por qué Claude dice "no sé"</Text>
          <HLBox color="#fef2f2" borderColor="#dc2626">
            <Text style={styles.hlBoxText}><Bold>Alucinación:</Bold> Cuando un LLM inventa una respuesta con confianza.</Text>
          </HLBox>
          <Card color="#bbf7d0" icon="✅" title="Cuando sabe con certeza" text="Responde directo y claro." />
          <Card color="#fde68a" icon="🤔" title="Cuando no está seguro" text="Usa frases como 'creo que...', 'esto podría haber cambiado...'" />
          <Card color="#fed7aa" icon="❓" title="Cuando no sabe" text="Te dice claramente que no tiene información suficiente." />
          <HLBox color="#fff3ee" borderColor="#da7756">
            <Text style={styles.hlBoxText}><Bold>Para ti:</Bold> Cuando Claude duda, es señal de verificar.</Text>
          </HLBox>
        </View>
      ),
    },
    // 9 SORT
    {
      type: 'sort', title: 'Pasos para una sesión productiva', xp: 15,
      instruction: 'Ordena correctamente los pasos para aprovechar al máximo una sesión con Claude.',
      correctOrder: [
        '<b>Define tu objetivo:</b> ¿Qué quieres lograr exactamente?',
        '<b>Dale contexto:</b> Quién eres, qué nivel tienes y para qué necesitas la ayuda',
        '<b>Escribe el prompt:</b> Claro, específico, con el formato de respuesta que necesitas',
        '<b>Evalúa la respuesta:</b> ¿Respondió lo que pediste? ¿Es correcta?',
        '<b>Itera y refina:</b> Pide correcciones, más detalle o un enfoque diferente si hace falta',
      ],
    },
    // 10 QUIZ
    {
      type: 'quiz', title: '¿Claude o ChatGPT?', xp: 32,
      questions: pickRandom(QUIZ_POOL, 4).map((q) => ({
        question: q.q,
        options: q.opts,
        correct: q.correct,
        explain: q.explain,
      })),
    },
    // 11 TEORÍA: Claude como tutor
    {
      type: 'theory', title: 'Claude como tutor', xp: 10,
      render: () => (
        <View>
          <StepTag color="#f0fdf4" textColor="#166534" label="Módulo 11 · Teoría" />
          <Text style={styles.lessonTitle}>Claude como tu tutor personal de estudio</Text>
          <Card color="#fdd9c8" icon="❓" title="Método Socrático" text='"No me des la respuesta directa. Hazme preguntas para que yo llegue a entenderlo."' />
          <Card color="#bbf7d0" icon="🔁" title="Preguntas personalizadas" text='"Crea 10 preguntas de práctica sobre este tema, de fácil a difícil, con respuestas."' />
          <Card color="#bfdbfe" icon="🔍" title="Explica lo que no entendiste" text='"Explícame este concepto de 3 formas diferentes: definición, analogía y ejemplo."' />
          <Card color="#fed7aa" icon="✍️" title="Retroalimentación" text='"Aquí está mi ensayo. No lo reescribas. Solo dime los 3 errores más importantes."' />
          <HLBox color="#f0fdf4" borderColor="#16a34a">
            <Text style={styles.hlBoxText}><Bold>La regla de oro:</Bold> Si al terminar tú entiendes mejor, lo usaste bien.</Text>
          </HLBox>
        </View>
      ),
    },
    // 12 V/F
    {
      type: 'vf', title: 'Verdadero o Falso sobre Claude', xp: 30,
      statements: pickRandom(TF_POOL, 5).map(s => ({ text: s.stmt, correct: s.correct, feedback: s.explain })),
    },
    // 13 CASO Yuki
    {
      type: 'theory', title: 'Caso: Yuki estudia con Claude', xp: 10,
      render: () => (
        <View>
          <StepTag color="#eff6ff" textColor="#1e40af" label="Módulo 13 · Caso real" />
          <Text style={styles.lessonTitle}>Yuki tiene un examen en 24 horas</Text>
          <Card color="#fde68a" icon="📍" title="Situación" text="Yuki, 12 años, Tokio. Examen de biología mañana sobre células. Solo tiene una tarde." />
          <HLBox color="#fef2f2" borderColor="#dc2626">
            <Text style={styles.hlBoxText}>Yuki NO le pidió a Claude que escribiera el resumen para copiar.</Text>
          </HLBox>
          <Text style={styles.sectionTitle}>Lo que SÍ hizo</Text>
          <StepList items={[
            'Pidió los 5 conceptos más importantes del examen.',
            'Para cada concepto, pidió explicación con analogía cotidiana.',
            'Pidió 6 preguntas de práctica tipo examen con respuestas al final.',
            'Donde se equivocó, volvió a pedir explicación específica.',
          ]} />
          <HLBox color="#f0fdf4" borderColor="#16a34a">
            <Text style={styles.hlBoxText}><Bold>Resultado:</Bold> Estudió 2 horas con Claude como tutor activo. Entendió los conceptos en vez de memorizarlos.</Text>
          </HLBox>
        </View>
      ),
    },
    // 14 FILL BLANKS
    {
      type: 'fillblanks', title: 'Vocabulario de Claude', xp: 24,
      items: pickRandom(FILL_POOL, 3).map(s => ({
        sentence: (blank: string) => s.sentence(blank),
        options: s.opts,
        correct: s.correct,
        explain: s.explain,
      })),
    },
    // 15 TEORÍA: ética
    {
      type: 'theory', title: 'Usar Claude con responsabilidad', xp: 10,
      render: () => (
        <View>
          <StepTag color="#f0fdf4" textColor="#166534" label="Módulo 15 · Teoría" />
          <Text style={styles.lessonTitle}>Ética al usar Claude</Text>
          <Card color="#bbf7d0" icon="✅" title="Apoyo, no sustituto" text="Pide explicaciones, revisión, práctica. El aprendizaje es tuyo." />
          <Card color="#bbf7d0" icon="✅" title="Verificar información importante" text="Nunca uses datos de Claude sin verificar fuentes confiables." />
          <Card color="#bbf7d0" icon="✅" title="Ser honesto sobre cómo lo usas" text="Si hay reglas en tu escuela sobre IA, respétalas." />
          <HLBox color="#fef2f2" borderColor="#dc2626">
            <Text style={styles.hlBoxText}><Bold>⚠️ Hacer trampa:</Bold> Entregar trabajo generado por Claude como tuyo es trampa académica.</Text>
          </HLBox>
          <HLBox color="#f0fdf4" borderColor="#16a34a">
            <Text style={styles.hlBoxText}><Bold>La regla de los 5 segundos:</Bold> Antes de usar una respuesta, pregúntate: ¿Entiendo por qué esto es correcto?</Text>
          </HLBox>
        </View>
      ),
    },
    // 16 DRAG DROP: casos de uso
    {
      type: 'dragdrop', title: '¿Cuándo usar Claude?', xp: 20,
      instruction: 'Clasifica cada tarea: ¿Claude es la herramienta correcta o hay una mejor opción?',
      zones: ['✅ Claude es ideal', '🔄 Hay mejor herramienta'],
      items: pickRandom(USECASE_POOL, 8).map((item, idx) => ({ id: `u${idx}`, text: item.text, correct: item.correct })),
      colClass: ['usa', 'no-usa'],
    },
    // 17 PROMPT COMPARE
    {
      type: 'promptcompare', title: '¿Cuál prompt es mejor?', xp: 30,
      tasks: pickRandom(PROMPT_POOL, 3).map(p => ({
        task: p.task,
        bad: p.bad,
        good: p.good,
        explain: p.explain,
      })),
    },
    // 18 BONUS: futuro
    {
      type: 'theory', title: 'Hacia dónde va Claude', xp: 10,
      render: () => (
        <View>
          <StepTag color="#fce7f3" textColor="#9d174d" label="Módulo 18 · Bonus" />
          <Text style={styles.lessonTitle}>El futuro de Claude</Text>
          <Card color="#fdd9c8" icon="🖼️" title="Visión multimodal" text="Análisis de imágenes cada vez mejor." />
          <Card color="#bfdbfe" icon="🔧" title="Agente autónomo" text="Ejecutar tareas de varios pasos con menos supervisión." />
          <Card color="#bbf7d0" icon="🧠" title="Memoria entre sesiones" text="Posibilidad de recordar conversaciones anteriores." />
          <Card color="#fed7aa" icon="🌐" title="Integración con herramientas" text="Conectarse a bases de datos, archivos en la nube, etc." />
          <HLBox color="#fff3ee" borderColor="#da7756">
            <Text style={styles.hlBoxText}><Bold>Importante:</Bold> Las habilidades que estás aprendiendo (escribir prompts, evaluar respuestas) serán más valiosas a medida que la IA avanza.</Text>
          </HLBox>
        </View>
      ),
    },
    // 19 MINI-DESAFÍO (teoría)
    {
      type: 'theory', title: 'Construye el prompt perfecto', xp: 10,
      render: () => (
        <View>
          <StepTag color="#fff3ee" textColor="#9a3412" label="Módulo 19 · Desafío" />
          <Text style={styles.lessonTitle}>Construye el prompt perfecto</Text>
          <PromptExamples />
        </View>
      ),
    },
    // 20 REFLEXIÓN
    {
      type: 'reflect', title: 'Reflexión final', xp: 15,
      placeholder: 'Esta semana tengo que hacer una exposición sobre el cambio climático. Voy a usar Claude así: ... Lo que más me sorprendió fue ...',
      minChars: 70,
    },
    // 21 COMPLETION
    { type: 'completion', title: '¡Nivel completado!', xp: 0 },
  ];
};

// ─── Componentes auxiliares ───────────────────────────────
const StepTag = ({ color, textColor, label }: { color: string; textColor: string; label: string }) => (
  <View style={[styles.stepTag, { backgroundColor: color }]}>
    <Text style={[styles.stepTagText, { color: textColor }]}>{label}</Text>
  </View>
);
const Card = ({ color, icon, title, text }: { color: string; icon: string; title: string; text: string }) => (
  <View style={[styles.card, { borderColor: color }]}>
    <View style={styles.cardRow}>
      <View style={[styles.cardIcon, { backgroundColor: color }]}>
        <Text style={styles.cardIconText}>{icon}</Text>
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardText}>{text}</Text>
      </View>
    </View>
  </View>
);
const HLBox = ({ color, borderColor, children }: { color: string; borderColor: string; children: React.ReactNode }) => (
  <View style={[styles.hlBox, { backgroundColor: color, borderLeftColor: borderColor }]}>
    {children}
  </View>
);
const Bold = ({ children }: { children: React.ReactNode }) => <Text style={{ fontWeight: '700' }}>{children}</Text>;
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
const ExampleCards = () => {
  const [open, setOpen] = useState<number | null>(null);
  const examples = [
    { emoji: '👩‍⚕️', title: 'Médicos en India', sub: 'Analizar historias clínicas', how: 'Resumir expedientes de 200 páginas.', fact: '⭐ Puede procesar >100,000 palabras.' },
    { emoji: '🧑‍💻', title: 'Estudiantes en Finlandia', sub: 'Aprender a programar', how: 'Tutor que hace preguntas sin dar el código.', fact: '⭐ Detecta errores en 30+ lenguajes.' },
    { emoji: '✍️', title: 'Escritores en Argentina', sub: 'Novelas coherentes', how: 'Recuerda personajes y trama en sesiones largas.', fact: '⭐ Mantiene miles de palabras en contexto.' },
    { emoji: '🏛️', title: 'Investigadores en Alemania', sub: 'Documentos históricos', how: 'Analiza textos en latín, francés antiguo y alemán.', fact: '⭐ Entrenado en 50+ idiomas.' },
    { emoji: '🏢', title: 'Empresa japonesa', sub: 'Propuestas culturales', how: 'Adapta tono y formalidad según cultura del cliente.', fact: '⭐ Sensibilidad cultural.' },
  ];
  return (
    <View>
      <StepTag color="#fff7ed" textColor="#9a3412" label="Módulo 2 · Casos del mundo" />
      <Text style={styles.lessonTitle}>Claude en el mundo real</Text>
      {examples.map((ex, idx) => (
        <TouchableOpacity key={idx} style={styles.exCard} onPress={() => setOpen(open === idx ? null : idx)}>
          <View style={styles.exHead}>
            <View style={styles.exEmoji}><Text style={{ fontSize: 22 }}>{ex.emoji}</Text></View>
            <View style={styles.exInfo}>
              <Text style={styles.exName}>{ex.title}</Text>
              <Text style={styles.exSub}>{ex.sub}</Text>
            </View>
            <Text style={styles.exArrow}>{open === idx ? '↓' : '›'}</Text>
          </View>
          {open === idx && (
            <View style={styles.exBody}>
              <Text style={styles.exHow}>{ex.how}</Text>
              <View style={styles.exFact}><Text style={{ color: '#854d0e', fontSize: 12 }}>{ex.fact}</Text></View>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
};
const ClaudeVsChatGPT = () => (
  <View>
    <StepTag color="#f0fdf4" textColor="#166534" label="Módulo 6 · Teoría" />
    <Text style={styles.lessonTitle}>Claude vs ChatGPT</Text>
    <View style={styles.vsGrid}>
      <View style={[styles.vsCol, { backgroundColor: '#fff3ee', borderColor: '#fdd9c8' }]}>
        <View style={[styles.vsHeader, { backgroundColor: '#fdd9c8' }]}>
          <Text style={styles.vsHeaderText}>🌟 Claude</Text>
        </View>
        <Text style={styles.vsItem}>✅ Ventana de contexto extensa</Text>
        <Text style={styles.vsItem}>✅ Más cauteloso con información incierta</Text>
        <Text style={styles.vsItem}>✅ Excelente con textos largos</Text>
        <Text style={styles.vsItem}>⚠️ Sin acceso a internet por defecto</Text>
        <Text style={styles.vsItem}>⚠️ Sin generación de imágenes nativa</Text>
      </View>
      <View style={[styles.vsCol, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
        <View style={[styles.vsHeader, { backgroundColor: '#bbf7d0' }]}>
          <Text style={styles.vsHeaderText}>💬 ChatGPT</Text>
        </View>
        <Text style={styles.vsItem}>✅ Puede buscar en internet</Text>
        <Text style={styles.vsItem}>✅ Genera imágenes con DALL·E</Text>
        <Text style={styles.vsItem}>✅ Más familiar para la mayoría</Text>
        <Text style={styles.vsItem}>⚠️ A veces "alucina" con más confianza</Text>
        <Text style={styles.vsItem}>⚠️ Ventana de contexto menor</Text>
      </View>
    </View>
  </View>
);
const PromptExamples = () => (
  <View>
    <PromptExampleCard
      title="Prompt 1 — Le falta contexto"
      bad="Ayúdame a entender álgebra."
      good="Soy estudiante de 8° grado en Perú. No entiendo cómo factorizar expresiones algebraicas como x²+5x+6. Explícame el proceso paso a paso con 2 ejemplos."
    />
    <PromptExampleCard
      title="Prompt 2 — Le falta formato"
      bad="Dime los países de Europa."
      good="Lista los 5 países más grandes de Europa por área, en una tabla simple con: nombre, capital y área en km²."
    />
    <PromptExampleCard
      title="Prompt 3 — Sin rol definido"
      bad="Explícame la revolución francesa."
      good="Actúa como un profesor de historia de secundaria. Explícame las 3 causas principales de la Revolución Francesa de forma sencilla, con un dato sorprendente al final. Para estudiante de 12 años."
    />
  </View>
);
const PromptExampleCard = ({ title, bad, good }: { title: string; bad: string; good: string }) => (
  <View style={styles.promptCard}>
    <Text style={styles.promptCardTitle}>{title}</Text>
    <View style={[styles.promptBox, { backgroundColor: '#fff7ed', borderColor: '#fed7aa' }]}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: '#ef4444', marginBottom: 4 }}>❌ Prompt A:</Text>
      <Text style={{ fontSize: 13, color: '#374151' }}>{bad}</Text>
    </View>
    <View style={[styles.promptBox, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: '#16a34a', marginBottom: 4 }}>✅ Prompt B:</Text>
      <Text style={{ fontSize: 13, color: '#374151' }}>{good}</Text>
    </View>
  </View>
);

// ─── Componente principal del nivel ───────────────────────
export default function World4Level2() {
  const completeLevel = useGameStore(s => s.completeLevel);
  const addXPToStore = useGameStore(s => s.addXP);

  const steps = useRef(buildSteps()).current;
  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);
  const [completed, setCompleted] = useState(false);

  // Estados de arrastre
  const [dPlaced, setDPlaced] = useState<Record<string, string>>({});
  const [dSelected, setDSelected] = useState<string | null>(null);
  const [dAttempts, setDAttempts] = useState(0);
  const [dOk, setDOk] = useState(false);

  // Matching
  const [mLeft, setMLeft] = useState<number | null>(null);
  const [mDone, setMDone] = useState<Set<number>>(new Set());
  const [mRightOrder, setMRightOrder] = useState<string[]>([]);
  const [mOk, setMOk] = useState(false);

  // Sort
  const [sOrder, setSOrder] = useState<number[]>([]);
  const [sOk, setSOk] = useState(false);

  // Quiz
  const [qAnswers, setQAnswers] = useState<Record<number, number>>({});
  const [qChecked, setQChecked] = useState(false);

  // VF
  const [vfAnswers, setVFAnswers] = useState<Record<number, boolean>>({});
  const [vfChecked, setVFChecked] = useState(false);

  // Fill blanks
  const [fAnswers, setFAnswers] = useState<Record<number, number>>({});
  const [fChecked, setFChecked] = useState(false);

  // Prompt compare
  const [pPicks, setPPicks] = useState<Record<number, 'bad' | 'good'>>({});
  const [pChecked, setPChecked] = useState(false);

  // Reflect
  const [reflectText, setReflectText] = useState('');

  // Reset al cambiar de paso
  useEffect(() => {
    const current = steps[step];
    setDPlaced({}); setDSelected(null); setDAttempts(0); setDOk(false);
    setMLeft(null); setMDone(new Set()); setMRightOrder([]); setMOk(false);
    setSOrder([]); setSOk(false);
    setQAnswers({}); setQChecked(false);
    setVFAnswers({}); setVFChecked(false);
    setFAnswers({}); setFChecked(false);
    setPPicks({}); setPChecked(false);
    setReflectText('');

    if (current.type === 'sort') {
      setSOrder([...Array(5).keys()].sort(() => Math.random() - 0.5));
    }
    if (current.type === 'matching') {
      const pairs = (current as MatchingStep).pairs;
      setMRightOrder(pairs.map(p => p.right).sort(() => Math.random() - 0.5));
    }
  }, [step]);

  const addXP = useCallback((amount: number) => {
    setXp(prev => prev + amount);
    addXPToStore(amount);
  }, [addXPToStore]);

  const handleNext = () => {
    if (step >= steps.length - 1) return;
    const current = steps[step];

    let canAdvance = true;
    if (current.type === 'dragdrop' && !dOk) {
      const drag = current as DragDropStep;
      const placed = Object.keys(dPlaced).length;
      if (placed < drag.items.length) return;
      const allCorrect = drag.items.every(item => dPlaced[item.id] === item.correct);
      if (allCorrect) {
        const earned = dAttempts === 0 ? 20 : 12;
        addXP(earned);
        setDOk(true);
      } else {
        setDPlaced(prev => {
          const next = { ...prev };
          drag.items.forEach(item => { if (next[item.id] !== item.correct) delete next[item.id]; });
          return next;
        });
        setDAttempts(a => a + 1);
        return;
      }
    }
    if (current.type === 'matching' && !mOk) {
      if (mDone.size !== (current as MatchingStep).pairs.length) return;
      addXP(current.xp);
      setMOk(true);
    }
    if (current.type === 'sort' && !sOk) {
      const correct = sOrder.every((v, i) => v === i);
      if (!correct) { setSOk(false); return; }
      addXP(current.xp);
      setSOk(true);
    }
    if (current.type === 'quiz' && !qChecked) {
      if (Object.keys(qAnswers).length < (current as QuizStep).questions.length) return;
      setQChecked(true);
      const quiz = current as QuizStep;
      let correct = 0;
      quiz.questions.forEach((q, qi) => { if (qAnswers[qi] === q.correct) correct++; });
      addXP(correct * 8);
    }
    if (current.type === 'vf' && !vfChecked) {
      if (Object.keys(vfAnswers).length < (current as VFStep).statements.length) return;
      setVFChecked(true);
      const vf = current as VFStep;
      let correct = 0;
      vf.statements.forEach((s, qi) => { if (vfAnswers[qi] === s.correct) correct++; });
      addXP(correct * 6);
    }
    if (current.type === 'fillblanks' && !fChecked) {
      if (Object.keys(fAnswers).length < (current as FillBlanksStep).items.length) return;
      setFChecked(true);
      const fill = current as FillBlanksStep;
      let correct = 0;
      fill.items.forEach((item, qi) => { if (fAnswers[qi] === item.correct) correct++; });
      addXP(correct * 8);
    }
    if (current.type === 'promptcompare' && !pChecked) {
      if (Object.keys(pPicks).length < (current as PromptCompareStep).tasks.length) return;
      setPChecked(true);
      const prompt = current as PromptCompareStep;
      let correct = 0;
      prompt.tasks.forEach((_, qi) => { if (pPicks[qi] === 'good') correct++; });
      addXP(correct * 10);
    }
    if (current.type === 'reflect') {
      const refl = current as ReflectStep;
      if (reflectText.trim().length < refl.minChars) return;
      addXP(refl.xp);
    }

    setStep(s => s + 1);
  };

  const handlePrev = () => { if (step > 0) setStep(s => s - 1); };

  const finishLevel = () => {
    const stars = xp >= 160 ? 3 : xp >= 120 ? 2 : 1;
    completeLevel(20, stars, xp);
    setCompleted(true);
  };

  if (completed) {
    return (
      <View style={styles.screen}>
        <Text style={styles.thanksText}>¡Nivel completado! Redirigiendo...</Text>
      </View>
    );
  }

  const current = steps[step];
  const progress = Math.round((step / (steps.length - 1)) * 100);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.levelBadge}>🌟 MUNDO 4 · NIVEL 2</Text>
        <Text style={styles.levelTitle}>Claude</Text>
        <Text style={styles.subtitle}>El asistente que piensa contigo</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressLabel}>Módulo {step} de {steps.length - 1} · {xp} XP</Text>
      </View>

      <View style={styles.moduleCard}>
        {current.type === 'theory' && current.render()}
        {current.type === 'dragdrop' && (
          <DragDropComponent
            mod={current as DragDropStep}
            dPlaced={dPlaced}
            dSelected={dSelected}
            onSelect={setDSelected}
            onDrop={(zone: string) => { if (dSelected) { setDPlaced(p => ({ ...p, [dSelected]: zone })); setDSelected(null); } }}
            onRemove={(id: string) => { setDPlaced(p => { const n = { ...p }; delete n[id]; return n; }); }}
            dOk={dOk}
          />
        )}
        {current.type === 'matching' && (
          <MatchingComponent
            mod={current as MatchingStep}
            mLeft={mLeft}
            mDone={mDone}
            mRightOrder={mRightOrder}
            onSelectLeft={setMLeft}
            onSelectRight={(ri: number) => {
              if (mLeft === null) return;
              const leftIdx = mLeft;
              const correctRight = (current as MatchingStep).pairs[leftIdx].right;
              if (mRightOrder[ri] === correctRight) {
                setMDone(prev => new Set(prev).add(leftIdx));
                setMLeft(null);
                if (mDone.size + 1 === (current as MatchingStep).pairs.length) {
                  addXP(current.xp);
                  setMOk(true);
                }
              } else { setMLeft(null); }
            }}
            mOk={mOk}
          />
        )}
        {current.type === 'sort' && (
          <SortComponent
            mod={current as SortStep}
            sOrder={sOrder}
            moveSort={(pos: number, dir: number) => {
              const np = pos + dir;
              if (np < 0 || np >= sOrder.length) return;
              setSOrder(prev => { const n = [...prev]; [n[pos], n[np]] = [n[np], n[pos]]; return n; });
            }}
            checkSort={() => {
              const correct = sOrder.every((v, i) => v === i);
              setSOk(correct);
              if (correct) addXP(current.xp);
            }}
            sOk={sOk}
          />
        )}
        {current.type === 'quiz' && (
          <QuizComponent
            mod={current as QuizStep}
            qAnswers={qAnswers}
            qChecked={qChecked}
            onSelect={(qi: number, oi: number) => setQAnswers(p => ({ ...p, [qi]: oi }))}
          />
        )}
        {current.type === 'vf' && (
          <VFComponent
            mod={current as VFStep}
            vfAnswers={vfAnswers}
            vfChecked={vfChecked}
            onSelect={(qi: number, val: boolean) => setVFAnswers(p => ({ ...p, [qi]: val }))}
          />
        )}
        {current.type === 'fillblanks' && (
          <FillBlanksComponent
            mod={current as FillBlanksStep}
            fAnswers={fAnswers}
            fChecked={fChecked}
            onSelect={(qi: number, oi: number) => setFAnswers(p => ({ ...p, [qi]: oi }))}
          />
        )}
        {current.type === 'promptcompare' && (
          <PromptCompareComponent
            mod={current as PromptCompareStep}
            pPicks={pPicks}
            pChecked={pChecked}
            onSelect={(qi: number, which: 'bad' | 'good') => setPPicks(p => ({ ...p, [qi]: which }))}
          />
        )}
        {current.type === 'reflect' && (
          <View>
            <StepTag color="#f3f4f6" textColor="#374151" label="Reflexión final" />
            <Text style={styles.lessonTitle}>{(current as ReflectStep).title}</Text>
            <TextInput
              style={styles.reflectInput}
              placeholder={(current as ReflectStep).placeholder}
              multiline
              numberOfLines={5}
              value={reflectText}
              onChangeText={setReflectText}
            />
            <Text style={styles.charCount}>{reflectText.trim().length} / {(current as ReflectStep).minChars} mínimo</Text>
          </View>
        )}
        {current.type === 'completion' && (
          <View style={styles.completionScreen}>
            <Text style={styles.completionIcon}>🌟</Text>
            <Text style={styles.completionTitle}>¡Nivel 20 completado!</Text>
            <Text style={styles.completionText}>Conoces a Claude por dentro: sus orígenes, principios, fortalezas reales y cómo hablarle.</Text>
            <Text style={styles.xpGained}>⭐ {xp} XP ganados</Text>
            <TouchableOpacity style={styles.finishBtn} onPress={finishLevel}>
              <Text style={styles.finishBtnText}>Terminar nivel</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {current.type !== 'completion' && (
        <View style={styles.navButtons}>
          <TouchableOpacity style={[styles.navBtn, step === 0 && styles.navBtnHidden]} onPress={handlePrev} disabled={step === 0}>
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

// ─── Componentes de módulos interactivos ─────────────────
const DragDropComponent = ({ mod, dPlaced, dSelected, onSelect, onDrop, onRemove, dOk }: any) => (
  <View>
    <StepTag color="#fff3ee" textColor="#9a3412" label="Módulo · Clasificar" />
    <Text style={styles.lessonTitle}>{mod.title}</Text>
    <Text style={styles.bodyText}>{mod.instruction}</Text>
    <View style={styles.chipsPool}>
      {mod.items.filter((item: any) => !dPlaced[item.id]).map((item: any) => (
        <TouchableOpacity key={item.id} style={[styles.chip, dSelected === item.id && styles.chipSelected]} onPress={() => onSelect(item.id)}>
          <Text style={styles.chipText}>{item.text}</Text>
        </TouchableOpacity>
      ))}
    </View>
    <View style={styles.dropCols}>
      {mod.zones.map((zone: string, zi: number) => (
        <TouchableOpacity key={zi} style={[styles.dropCol, Object.values(dPlaced).includes(zone) && styles.dropColHasItem]} onPress={() => onDrop(zone)}>
          <Text style={[styles.dropHeader, { backgroundColor: zi === 0 ? '#eef2ff' : '#fef2f2', color: zi === 0 ? '#3730a3' : '#991b1b' }]}>{zone}</Text>
          <View style={styles.dropArea}>
            {Object.entries(dPlaced).filter(([, z]) => z === zone).map(([id]) => {
              const item = mod.items.find((i: any) => i.id === id);
              return (
                <TouchableOpacity key={id} style={[styles.dropChip, { backgroundColor: zi === 0 ? '#eef2ff' : '#fef2f2' }]} onPress={() => onRemove(id)}>
                  <Text style={{ fontSize: 12, color: zi === 0 ? '#3730a3' : '#991b1b' }}>{item.text} ✕</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      ))}
    </View>
    {dOk && <View style={styles.feedbackOk}><Text style={styles.feedbackText}>✅ ¡Clasificación correcta!</Text></View>}
  </View>
);

const MatchingComponent = ({ mod, mLeft, mDone, mRightOrder, onSelectLeft, onSelectRight, mOk }: any) => (
  <View>
    <StepTag color="#fff3ee" textColor="#9a3412" label="Módulo · Conectar" />
    <Text style={styles.lessonTitle}>{mod.title}</Text>
    <Text style={styles.bodyText}>Toca una descripción de la izquierda y luego su nombre técnico correcto.</Text>
    <View style={styles.matchGrid}>
      <View style={styles.matchCol}>
        {mod.pairs.map((p: any, i: number) => (
          <TouchableOpacity
            key={`l${i}`}
            style={[styles.matchItem, mLeft === i && styles.matchItemSelected, mDone.has(i) && styles.matchItemMatched]}
            disabled={mDone.has(i)}
            onPress={() => onSelectLeft(i)}
          >
            <Text style={styles.matchItemText}>{p.left}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.matchCol}>
        {mRightOrder.map((right: string, i: number) => {
          const matchedIdx = mod.pairs.findIndex((p: any) => p.right === right);
          const isMatched = mDone.has(matchedIdx);
          return (
            <TouchableOpacity
              key={`r${i}`}
              style={[styles.matchItem, isMatched && styles.matchItemMatched]}
              disabled={isMatched}
              onPress={() => onSelectRight(i)}
            >
              <Text style={styles.matchItemText}>{right}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
    {mOk && <View style={styles.feedbackOk}><Text style={styles.feedbackText}>✅ ¡Todos los pares conectados!</Text></View>}
  </View>
);

const SortComponent = ({ mod, sOrder, moveSort, checkSort, sOk }: any) => {
  const correctOrder = mod.correctOrder;
  return (
    <View>
      <StepTag color="#fff3ee" textColor="#9a3412" label="Módulo · Ordenar" />
      <Text style={styles.lessonTitle}>{mod.title}</Text>
      <Text style={styles.bodyText}>{mod.instruction}</Text>
      {sOrder.map((origIdx: number, pos: number) => (
        <View key={pos} style={[styles.sortItem, sOk && origIdx === pos && styles.sortItemCorrect, sOk && origIdx !== pos && styles.sortItemWrong]}>
          <View style={styles.sortNum}><Text style={styles.sortNumText}>{pos + 1}</Text></View>
          <Text style={styles.sortText}>{correctOrder[origIdx]}</Text>
          <View style={styles.sortArrows}>
            <TouchableOpacity style={styles.sortBtn} disabled={pos === 0} onPress={() => moveSort(pos, -1)}>
              <Text style={styles.sortBtnText}>▲</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sortBtn} disabled={pos === sOrder.length - 1} onPress={() => moveSort(pos, 1)}>
              <Text style={styles.sortBtnText}>▼</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
      {!sOk && (
        <TouchableOpacity style={styles.checkBtn} onPress={checkSort}>
          <Text style={styles.checkBtnText}>Verificar orden</Text>
        </TouchableOpacity>
      )}
      {sOk && <View style={styles.feedbackOk}><Text style={styles.feedbackText}>✅ ¡Orden correcto!</Text></View>}
    </View>
  );
};

const QuizComponent = ({ mod, qAnswers, qChecked, onSelect }: any) => (
  <View>
    <StepTag color="#fef3c7" textColor="#92400e" label="Quiz" />
    <Text style={styles.lessonTitle}>{mod.title}</Text>
    {mod.questions.map((q: any, qi: number) => (
      <View key={qi} style={{ marginBottom: 20 }}>
        <Text style={styles.quizQuestion}>{q.question}</Text>
        {q.options.map((opt: string, oi: number) => {
          let optionStyle = styles.quizOption;
          if (qChecked && oi === q.correct) optionStyle = { ...optionStyle, ...styles.quizOptionCorrect };
          if (qChecked && qAnswers[qi] === oi && oi !== q.correct) optionStyle = { ...optionStyle, ...styles.quizOptionWrong };
          return (
            <TouchableOpacity
              key={oi}
              style={[optionStyle, qAnswers[qi] === oi && !qChecked && styles.quizOptionSelected]}
              disabled={qChecked}
              onPress={() => onSelect(qi, oi)}
            >
              <Text style={styles.quizOptionText}>{opt}</Text>
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
    <StepTag color="#fef3c7" textColor="#92400e" label="Verdadero o Falso" />
    <Text style={styles.lessonTitle}>{mod.title}</Text>
    {mod.statements.map((s: any, qi: number) => (
      <View key={qi} style={{ marginBottom: 16 }}>
        <Text style={styles.tfQuestion}>"{s.text}"</Text>
        <View style={styles.tfButtons}>
          <TouchableOpacity
            style={[styles.tfBtn, vfAnswers[qi] === true && styles.tfBtnSelectedTrue, vfChecked && s.correct === true && styles.tfBtnCorrect, vfChecked && vfAnswers[qi] === true && !s.correct && styles.tfBtnWrong]}
            disabled={vfChecked}
            onPress={() => onSelect(qi, true)}
          >
            <Text style={styles.tfBtnText}>✅ Verdadero</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tfBtn, vfAnswers[qi] === false && styles.tfBtnSelectedFalse, vfChecked && s.correct === false && styles.tfBtnCorrect, vfChecked && vfAnswers[qi] === false && !s.correct && styles.tfBtnWrong]}
            disabled={vfChecked}
            onPress={() => onSelect(qi, false)}
          >
            <Text style={styles.tfBtnText}>❌ Falso</Text>
          </TouchableOpacity>
        </View>
        {vfChecked && (
          <View style={[styles.feedback, vfAnswers[qi] === s.correct ? styles.feedbackOk : styles.feedbackFail]}>
            <Text style={styles.feedbackText}>{s.feedback}</Text>
          </View>
        )}
      </View>
    ))}
  </View>
);

const FillBlanksComponent = ({ mod, fAnswers, fChecked, onSelect }: any) => (
  <View>
    <StepTag color="#fff3ee" textColor="#9a3412" label="Completar" />
    <Text style={styles.lessonTitle}>{mod.title}</Text>
    {mod.items.map((item: any, qi: number) => (
      <View key={qi} style={{ marginBottom: 16 }}>
        <Text style={styles.fillSentence}>{item.sentence(fAnswers[qi] !== undefined ? item.options[fAnswers[qi]] : '___')}</Text>
        <View style={styles.fillOpts}>
          {item.options.map((opt: string, oi: number) => (
            <TouchableOpacity
              key={oi}
              style={[styles.fillOpt, fAnswers[qi] === oi && styles.fillOptSelected, fChecked && oi === item.correct && styles.fillOptCorrect, fChecked && fAnswers[qi] === oi && oi !== item.correct && styles.fillOptWrong]}
              disabled={fChecked}
              onPress={() => onSelect(qi, oi)}
            >
              <Text style={styles.fillOptText}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {fChecked && (
          <View style={[styles.feedback, fAnswers[qi] === item.correct ? styles.feedbackOk : styles.feedbackFail]}>
            <Text style={styles.feedbackText}>{item.explain}</Text>
          </View>
        )}
      </View>
    ))}
  </View>
);

const PromptCompareComponent = ({ mod, pPicks, pChecked, onSelect }: any) => (
  <View>
    <StepTag color="#ecfdf5" textColor="#065f46" label="Comparar prompts" />
    <Text style={styles.lessonTitle}>{mod.title}</Text>
    {mod.tasks.map((task: any, qi: number) => (
      <View key={qi} style={{ marginBottom: 20 }}>
        <Text style={styles.promptTaskTitle}>🎯 {task.task}</Text>
        <TouchableOpacity
          style={[styles.promptCard, pPicks[qi] === 'bad' && styles.promptCardSelectedBad, pChecked && styles.promptCardRevealBad]}
          disabled={pChecked}
          onPress={() => onSelect(qi, 'bad')}
        >
          <Text style={[styles.promptLabel, { color: '#ef4444' }]}>Prompt A:</Text>
          <Text style={styles.promptText}>{task.bad}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.promptCard, pPicks[qi] === 'good' && styles.promptCardSelectedGood, pChecked && styles.promptCardRevealGood]}
          disabled={pChecked}
          onPress={() => onSelect(qi, 'good')}
        >
          <Text style={[styles.promptLabel, { color: '#16a34a' }]}>Prompt B:</Text>
          <Text style={styles.promptText}>{task.good}</Text>
        </TouchableOpacity>
        {pChecked && (
          <View style={[styles.feedback, pPicks[qi] === 'good' ? styles.feedbackOk : styles.feedbackFail]}>
            <Text style={styles.feedbackText}>{task.explain}</Text>
          </View>
        )}
      </View>
    ))}
  </View>
);

// ─── Estilos ──────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fdf6f0' },
  container: { padding: 16, paddingBottom: 40 },
  header: { marginBottom: 20, alignItems: 'center' },
  levelBadge: { ...typography.bold, fontSize: 14, color: '#da7756', marginBottom: 6 },
  levelTitle: { ...typography.heading1, fontSize: 28, color: '#111827', textAlign: 'center' },
  subtitle: { ...typography.body, color: '#6b7280', marginBottom: 12 },
  progressBar: { width: '100%', height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#da7756', borderRadius: 3 },
  progressLabel: { ...typography.caption, color: '#9ca3af', marginTop: 6 },
  moduleCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#d1d5db',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    elevation: 2,
  },
  stepTag: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 10, alignSelf: 'flex-start', marginBottom: 12 },
  stepTagText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  lessonIcon: { width: 68, height: 68, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  lessonTitle: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 8, lineHeight: 26 },
  bodyText: { fontSize: 14, color: '#374151', lineHeight: 22, marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginTop: 14, marginBottom: 8, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  hlBox: { borderLeftWidth: 3, borderRadius: 8, padding: 12, marginBottom: 14 },
  hlBoxText: { fontSize: 13, lineHeight: 22, color: '#7c2d12' },
  bold: { fontWeight: '700' },
  card: { borderRadius: 14, padding: 13, marginBottom: 10, borderWidth: 1, backgroundColor: '#f9fafb' },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardIconText: { fontSize: 20 },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#111827', marginBottom: 4 },
  cardText: { fontSize: 13, color: '#374151', lineHeight: 20 },
  // Drag drop
  chipsPool: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12, backgroundColor: '#f9fafb', borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 12 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1.5, borderColor: '#d1d5db', backgroundColor: '#ffffff' },
  chipSelected: { borderColor: '#da7756', backgroundColor: '#fff3ee' },
  chipText: { fontSize: 13, color: '#374151' },
  dropCols: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  dropCol: { flex: 1, borderRadius: 12, borderWidth: 2, borderColor: '#d1d5db', borderStyle: 'dashed', backgroundColor: '#fafafa', minHeight: 100, padding: 8 },
  dropColHasItem: { borderStyle: 'solid' },
  dropHeader: { fontSize: 11, fontWeight: '700', textAlign: 'center', marginBottom: 6, padding: 6, borderRadius: 7 },
  dropArea: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  dropChip: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 14, alignSelf: 'flex-start' },
  // Matching
  matchGrid: { flexDirection: 'row', gap: 8 },
  matchCol: { flex: 1 },
  matchItem: { padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#e5e7eb', marginBottom: 6, minHeight: 64, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' },
  matchItemSelected: { borderColor: '#da7756', backgroundColor: '#fff3ee' },
  matchItemMatched: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  matchItemText: { fontSize: 12, color: '#374151', textAlign: 'center', lineHeight: 18 },
  // Sort
  sortItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: '#f9fafb', borderRadius: 12, borderWidth: 1.5, borderColor: '#e5e7eb', marginBottom: 8 },
  sortItemCorrect: { borderColor: '#86efac', backgroundColor: '#f0fdf4' },
  sortItemWrong: { borderColor: '#fca5a5', backgroundColor: '#fef2f2' },
  sortNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#da7756', alignItems: 'center', justifyContent: 'center' },
  sortNumText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  sortText: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 20 },
  sortArrows: { flexDirection: 'column', gap: 3 },
  sortBtn: { width: 30, height: 27, borderRadius: 7, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  sortBtnText: { fontSize: 11, color: '#6b7280' },
  // Check btn
  checkBtn: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: '#da7756', alignItems: 'center' },
  checkBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  // Feedback
  feedback: { marginTop: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  feedbackOk: { backgroundColor: '#dcfce7', borderColor: '#86efac' },
  feedbackFail: { backgroundColor: '#fef2f2', borderColor: '#fca5a5' },
  feedbackText: { fontSize: 13, lineHeight: 20, color: '#374151' },
  // Quiz
  quizQuestion: { fontSize: 13, fontWeight: '700', color: '#111827', lineHeight: 20, marginBottom: 8, padding: 12, backgroundColor: '#f9fafb', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  quizOption: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 11, borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#ffffff', marginBottom: 6 },
  quizOptionSelected: { borderColor: '#da7756', backgroundColor: '#fff3ee' },
  quizOptionCorrect: { borderColor: '#16a34a', backgroundColor: '#dcfce7' },
  quizOptionWrong: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  quizOptionText: { fontSize: 13, color: '#374151', lineHeight: 20 },
  // VF
  tfQuestion: { fontSize: 13, fontWeight: '700', color: '#111827', lineHeight: 20, padding: 12, backgroundColor: '#f9fafb', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 8 },
  tfButtons: { flexDirection: 'row', gap: 8 },
  tfBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 2, borderColor: '#e5e7eb', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', minHeight: 54 },
  tfBtnSelectedTrue: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  tfBtnSelectedFalse: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  tfBtnCorrect: { borderColor: '#16a34a', backgroundColor: '#dcfce7' },
  tfBtnWrong: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  tfBtnText: { fontSize: 14, fontWeight: '700', color: '#374151' },
  // Fill blanks
  fillSentence: { fontSize: 14, color: '#374151', lineHeight: 24, marginBottom: 8 },
  fillOpts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  fillOpt: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1.5, borderColor: '#d1d5db', backgroundColor: '#fff' },
  fillOptSelected: { borderColor: '#da7756', backgroundColor: '#fff3ee' },
  fillOptCorrect: { borderColor: '#16a34a', backgroundColor: '#dcfce7' },
  fillOptWrong: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  fillOptText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  // Prompt compare
  promptTaskTitle: { fontSize: 13, fontWeight: '700', color: '#111827', marginBottom: 8, padding: 8, backgroundColor: '#fff3ee', borderRadius: 9, borderWidth: 1, borderColor: '#fdd9c8' },
  promptCard: { borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#fff', marginBottom: 8 },
  promptCardSelectedBad: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  promptCardSelectedGood: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  promptCardRevealBad: { borderColor: '#dc2626', backgroundColor: '#fef2f2', opacity: 0.7 },
  promptCardRevealGood: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  promptLabel: { fontSize: 11, fontWeight: '700', marginBottom: 4 },
  promptText: { fontSize: 13, color: '#374151', lineHeight: 20 },
  // Reflect
  reflectInput: { borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 14, minHeight: 120, textAlignVertical: 'top', backgroundColor: '#fafafa', color: '#374151' },
  charCount: { fontSize: 11, color: '#9ca3af', textAlign: 'right', marginTop: 4 },
  // Completion
  completionScreen: { alignItems: 'center', paddingVertical: 30 },
  completionIcon: { fontSize: 60, marginBottom: 10 },
  completionTitle: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 6 },
  completionText: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  xpGained: { fontSize: 16, fontWeight: '700', color: '#854d0e', marginBottom: 20 },
  finishBtn: { paddingVertical: 14, paddingHorizontal: 40, borderRadius: 12, backgroundColor: '#da7756', alignItems: 'center' },
  finishBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  // Nav
  navButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  navBtn: { paddingVertical: 12, paddingHorizontal: 20, backgroundColor: '#f1f5f9', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  navBtnHidden: { opacity: 0 },
  navBtnText: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  thanksText: { fontSize: 18, textAlign: 'center', marginTop: 40, color: '#374151' },
  // Example expandable
  exCard: { borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 8, backgroundColor: '#fff' },
  exHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exEmoji: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  exInfo: { flex: 1 },
  exName: { fontSize: 13, fontWeight: '700', color: '#111827' },
  exSub: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  exArrow: { fontSize: 18, color: '#9ca3af' },
  exBody: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  exHow: { fontSize: 12, color: '#374151', lineHeight: 20, marginBottom: 8 },
  exFact: { backgroundColor: '#fef9c3', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#fde68a' },
  // VS grid
  vsGrid: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  vsCol: { flex: 1, borderRadius: 12, padding: 12, borderWidth: 1 },
  vsHeader: { paddingVertical: 5, borderRadius: 7, marginBottom: 8, alignItems: 'center' },
  vsHeaderText: { fontSize: 11, fontWeight: '700' },
  vsItem: { fontSize: 12, color: '#374151', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#f3f3f3', lineHeight: 18 },
  // Step list
  stepList: { gap: 9, marginBottom: 14 },
  stepItem: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#da7756', alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  stepText: { fontSize: 13, color: '#374151', lineHeight: 22, flex: 1 },
  // Prompt examples
  promptCardTitle: { fontSize: 13, fontWeight: '700', color: '#9a3412', marginBottom: 6 },
  promptBox: { borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: 1 },
});
