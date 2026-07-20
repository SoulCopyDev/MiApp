import { exitLevel } from '../utils/exitLevel';
import { router } from 'expo-router';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { useReportProgress } from '../components/LevelProgress';
import { typography } from '../theme';
import XPToast from '../components/XPToast';

// ═══════════════════════════════════════════════════════════
// Nivel 22 · Grok — La IA con personalidad propia
// Mundo 4 · tema claro con acento verde xAI (#00ba7c) + cards oscuras.
// Reconstruido vs nivel-22.html (estándar v2.2).
// ═══════════════════════════════════════════════════════════

// ── Tipos de paso ──
interface TheoryStep { type: 'theory'; xp: number; render: () => React.ReactNode; }
interface DragDropStep { type: 'dragdrop'; title: string; xp: number; instruction: string; zones: string[]; colClass: string[]; items: { id: string; text: string; correct: string }[]; }
interface MatchingStep { type: 'matching'; title: string; xp: number; instruction: string; pairs: { left: string; right: string }[]; }
interface SortStep { type: 'sort'; title: string; xp: number; instruction: string; correctOrder: string[]; }
interface QuizStep { type: 'quiz'; title: string; xp: number; questions: { question: string; options: string[]; correct: number; explain: string }[]; }
interface VFStep { type: 'vf'; title: string; xp: number; statements: { text: string; correct: boolean; feedback: string }[]; }
interface FillBlanksStep { type: 'fillblanks'; title: string; xp: number; items: { sentence: (blank: string) => string; options: string[]; correct: number; explain: string }[]; }
interface PromptCompareStep { type: 'promptcompare'; title: string; xp: number; tasks: { task: string; bad: string; good: string; explain: string; flip: boolean }[]; }
interface ScenarioStep { type: 'scenario'; num: number; xp: number; context: string; choices: { label: string; text: string; ok: boolean }[]; explain: string; }
interface WordBuilderStep { type: 'wordbuilder'; xp: number; question: string; correct: string[]; words: string[]; }
interface ReflectStep { type: 'reflect'; xp: number; placeholder: string; minChars: number; }
interface CompletionStep { type: 'completion'; xp: number; }
type Step = TheoryStep | DragDropStep | MatchingStep | SortStep | QuizStep | VFStep | FillBlanksStep | PromptCompareStep | ScenarioStep | WordBuilderStep | ReflectStep | CompletionStep;

// ── Helpers ──
const pickN = <T,>(arr: T[], n: number): T[] => [...arr].sort(() => Math.random() - 0.5).slice(0, n);
// Baraja opciones de una MCQ y remapea el índice correcto (§5/§27).
const shuffleOptions = <T extends { options: string[]; correct: number }>(item: T): T => {
  const paired = item.options.map((opt, i) => ({ opt, isCorrect: i === item.correct }));
  for (let j = paired.length - 1; j > 0; j--) {
    const k = Math.floor(Math.random() * (j + 1));
    [paired[j], paired[k]] = [paired[k], paired[j]];
  }
  return { ...item, options: paired.map((p) => p.opt), correct: paired.findIndex((p) => p.isCorrect) };
};

// ── Pools (extraídas del HTML) ──
const DRAG_POOL = [
  { t: 'Qué está siendo tendencia en X ahora mismo', c: 'f' },
  { t: 'Analizar un PDF académico de 80 páginas', c: 'c' },
  { t: 'Entender por qué un meme se hizo viral', c: 'f' },
  { t: 'Integrar IA directamente en Google Docs', c: 'c' },
  { t: 'Feedback directo y sin rodeos sobre tu idea', c: 'f' },
  { t: 'Buscar vuelos baratos para esta semana', c: 'c' },
  { t: 'Explorar noticias de tecnología de las últimas horas', c: 'f' },
  { t: 'Generar una imagen artística con Aurora', c: 'f' },
  { t: 'Entender debates virales en X en tiempo real', c: 'f' },
  { t: 'Recordar conversaciones de sesiones anteriores', c: 'c' },
  { t: 'Opinión honesta sobre tu proyecto de startup', c: 'f' },
  { t: 'Resumir un video de YouTube con su link', c: 'c' },
  { t: 'Analizar el sentimiento de X sobre tu app', c: 'f' },
  { t: 'Pedir comida a domicilio desde el chat', c: 'c' },
  { t: 'Crear una imagen de referencia para un proyecto', c: 'f' },
  { t: 'Investigar un tema académico con fuentes verificadas', c: 'c' },
];

const MATCH_POOL = [
  { l: 'Acceso a X en tiempo real', r: 'Lee tweets y debates virales mientras responde' },
  { l: 'Modo divertido (fun mode)', r: 'Responde con humor y sin restricciones típicas' },
  { l: 'Creado por xAI', r: 'Empresa de IA fundada por Elon Musk en 2023' },
  { l: 'Integrado en X Premium', r: 'Disponible para suscriptores de pago de X' },
  { l: 'Respuestas directas', r: 'Va al punto sin disculpas ni rodeos innecesarios' },
  { l: 'Aurora', r: 'Modelo de generación de imágenes integrado en Grok' },
  { l: 'Código abierto (base)', r: 'Versiones base descargables y modificables' },
  { l: 'Cultura de internet', r: 'Entiende memes, jerga y humor de X nativamente' },
  { l: 'Análisis de sentimiento', r: 'Lee miles de posts para resumir la opinión del público' },
  { l: 'Nombre "Grok"', r: 'De una novela sci-fi: entender algo muy profundamente' },
];

const GROK_SORT = [
  'Recibes el prompt: haces una pregunta sobre tendencias o cultura de internet',
  'Consulta X en tiempo real: analiza los posts más recientes sobre tu tema',
  'Filtra el ruido: distingue tendencias reales de bots o spam irrelevante',
  'Sintetiza con contexto: combina lo de X con su conocimiento de entrenamiento',
  'Responde con estilo: entrega la respuesta directa, con humor si lo pediste',
];

const QUIZ_POOL = [
  { q: '¿Cuál es la ventaja más única de Grok frente a Claude y Gemini?', o: ['Tiene la ventana de contexto más grande', 'Acceso en tiempo real a X', 'Es completamente gratuito', 'Mejor capacidad para análisis científico'], c: 1, e: 'El acceso en tiempo real a X (leer tweets y tendencias ahora mismo) es su característica más distintiva.' },
  { q: 'Un estudiante en Tokio quiere saber por qué un meme de IA es viral en X. ¿Qué LLM elige?', o: ['Claude', 'Gemini', 'Grok', 'ChatGPT'], c: 2, e: 'Grok entiende el humor y la jerga de internet como ninguno, y lee X en tiempo real.' },
  { q: '¿Qué empresa creó a Grok?', o: ['OpenAI', 'xAI', 'X Corp', 'Tesla AI'], c: 1, e: 'xAI es una empresa independiente fundada por Elon Musk en 2023.' },
  { q: '¿Para qué tarea Grok es claramente inferior a Claude?', o: ['Entender tendencias en X', 'Analizar un ensayo literario de 50 páginas', 'Dar opinión directa', 'Explicar un meme viral'], c: 1, e: 'Claude tiene una ventana de contexto superior para textos largos.' },
  { q: '¿Qué significa el "modo divertido" de Grok?', o: ['Genera juegos interactivos', 'Responde con humor y menos restricciones', 'Usa emojis automáticamente', 'Solo responde sobre entretenimiento'], c: 1, e: 'El fun mode permite sarcasmo e irreverencia sin cautelas excesivas — cambia el tono, no la precisión.' },
  { q: '¿Cómo se accede a Grok actualmente?', o: ['Es completamente gratuito y sin límites', 'Solo disponible para empresas grandes', 'Con suscripción X Premium o en grok.com', 'Descarga gratuita en iOS y Android'], c: 2, e: 'Principalmente con suscripción X Premium y en grok.com.' },
  { q: 'Un emprendedor en Lagos quiere saber qué opina X sobre su startup. ¿Por qué Grok?', o: ['Habla más idiomas africanos', 'Puede leer tweets actuales y resumir el sentimiento real', 'Tiene bases de datos privadas exclusivas', 'Es simplemente el más barato'], c: 1, e: 'Grok analiza la conversación actual en X en tiempo real (análisis de sentimiento).' },
  { q: '¿Qué es Aurora en el ecosistema de Grok?', o: ['Un modo oscuro de la interfaz', 'El modelo de generación de imágenes', 'Un sistema de búsqueda web', 'La CEO de xAI'], c: 1, e: 'Aurora es el generador de imágenes integrado en Grok.' },
  { q: '¿Cuál es una limitación real de Grok comparado con Gemini?', o: ['No puede escribir texto largo', 'No tiene acceso a ningún dato de internet', 'No tiene integración con Gmail/Docs/Sheets', 'Solo funciona en inglés'], c: 2, e: 'La integración con el ecosistema Google (Gmail, Docs, Sheets) es la ventaja de Gemini, no de Grok.' },
  { q: '¿Por qué el acceso a X es a la vez fortaleza y limitación?', o: ['Porque X tiene muchos virus', 'Porque X solo representa a ciertos usuarios, no a toda la sociedad', 'Porque X solo funciona en inglés', 'Porque X es muy lento de cargar'], c: 1, e: 'La audiencia de X es específica y sesgada: su sentimiento no representa a toda la sociedad.' },
  { q: '¿Qué significa que las versiones base de Grok sean de código abierto?', o: ['Que se usan sin conexión a internet', 'Que su código fuente está disponible para descargar y modificar', 'Que no tienen ninguna restricción de uso', 'Que las suscripciones son gratis para estudiantes'], c: 1, e: 'Código abierto: el código base es descargable y modificable por desarrolladores.' },
  { q: '¿Cuál es la diferencia entre Grok y Google para información actual?', o: ['Google da respuestas conversacionales y Grok no', 'Grok lee X; Google indexa toda la web', 'Son exactamente iguales', 'Google no tiene información actual'], c: 1, e: 'Fuentes distintas: Grok lee la conversación de X; Google indexa toda la web.' },
];

const TF_POOL = [
  { s: 'Grok puede leer y analizar tweets en tiempo real mientras te responde', c: true, e: 'El acceso a X en tiempo real es su característica más distintiva.' },
  { s: 'Grok fue creado por la misma empresa que desarrolló ChatGPT', c: false, e: 'ChatGPT es de OpenAI. Grok es de xAI, la empresa de Elon Musk.' },
  { s: 'Grok tiene un modo más directo y con menos restricciones que Claude', c: true, e: 'El fun mode permite respuestas con humor y sin cautelas excesivas.' },
  { s: 'Grok puede analizar documentos PDF de 100 páginas mejor que Claude', c: false, e: 'Claude tiene una ventana de contexto superior para textos muy largos.' },
  { s: 'Las versiones base del código de Grok están disponibles como código abierto', c: true, e: 'xAI publicó versiones base de Grok como open source.' },
  { s: 'Grok puede generar imágenes directamente dentro del chat con Aurora', c: true, e: 'Aurora, el generador de imágenes de xAI, está integrado en Grok.' },
  { s: 'Grok funciona perfectamente sin ninguna conexión a internet', c: false, e: 'El acceso a X en tiempo real requiere conexión.' },
  { s: 'Grok entiende el humor, la jerga y los memes de internet mejor que Claude', c: true, e: 'Fue entrenado con datos masivos de X, la fuente de la cultura de internet.' },
  { s: 'El modo divertido de Grok hace que sus respuestas sean incorrectas', c: false, e: 'Cambia el tono (más humor), no la precisión de la información.' },
  { s: 'Grok es la mejor herramienta para investigación académica con fuentes verificadas', c: false, e: 'Para fuentes verificadas, Gemini o Claude son mejores. X no es una fuente académica.' },
  { s: 'El nombre "Grok" viene de una novela de ciencia ficción clásica', c: true, e: 'De "Stranger in a Strange Land" de Robert Heinlein: significa entender profundamente.' },
  { s: 'Grok puede acceder directamente a tus archivos de Google Drive', c: false, e: 'Esa integración con Google es de Gemini, no de Grok.' },
  { s: 'Elon Musk fue cofundador de OpenAI antes de crear xAI', c: true, e: 'Musk cofundó OpenAI en 2015 y salió en 2018; fundó xAI en 2023.' },
  { s: 'Grok puede transcribir y resumir reuniones de Google Meet automáticamente', c: false, e: 'Esa capacidad es de Gemini, integrado en el ecosistema Google.' },
];

const FILL_POOL = [
  { s: 'La empresa que creó a Grok se llama ', o: ['xAI', 'OpenAI', 'X Corp', 'DeepMind'], c: 0, e: 'xAI es la empresa de IA fundada por Elon Musk en 2023.' },
  { s: 'La característica más única de Grok es su acceso en tiempo real a la red social ', o: ['X', 'Google', 'YouTube', 'Reddit'], c: 0, e: 'X (antes Twitter) es su fuente de información en tiempo real.' },
  { s: 'El modo de respuesta de Grok con humor y menos restricciones se llama modo ', o: ['divertido', 'creativo', 'abierto', 'libre'], c: 0, e: 'El fun mode o "modo divertido".' },
  { s: 'El modelo de generación de imágenes integrado en Grok se llama ', o: ['Aurora', 'DALL-E', 'Imagen', 'Firefly'], c: 0, e: 'Aurora es el modelo de imágenes de xAI.' },
  { s: 'Una ventaja de Grok es que versiones base de su código son de acceso ', o: ['abierto', 'gratuito', 'premium', 'limitado'], c: 0, e: 'Código abierto (open source).' },
  { s: 'Grok fue diseñado especialmente para entender memes, jerga y cultura de ', o: ['internet', 'películas', 'deportes', 'música'], c: 0, e: 'La cultura de internet, que vive sobre todo en X.' },
  { s: 'El nombre "Grok" significa entender algo de forma muy ', o: ['profunda', 'rápida', 'literal', 'amplia'], c: 0, e: 'En la novela de Heinlein, "grok" significa entender profundamente.' },
  { s: 'Cuando Grok analiza posts de X para conocer la opinión del público, hace un análisis de ', o: ['sentimiento', 'contenido', 'frecuencia', 'popularidad'], c: 0, e: 'Análisis de sentimiento: leer posts para conocer la opinión del público.' },
];

const PROMPT_POOL = [
  { t: 'Pedir a Grok análisis de tendencias en X sobre IA', bad: 'Busca en X todos los tweets de las últimas 12 horas sobre IA: dame TODOS los hashtags, los usuarios más activos, la lista completa de tweets con más likes y un resumen de cada conversación.', good: 'Busca en X las opiniones de las últimas 6 horas sobre IA. ¿Cuáles son las 3 posturas más repetidas? Resúmelas en 5 líneas.', e: 'Con X en tiempo real, menos es más: una pregunta enfocada da un resultado preciso; pedir "todo" diluye la respuesta.' },
  { t: 'Usar el modo directo de Grok para evaluar una idea de negocio', bad: 'Tengo 14 años y una idea de app: dime si es viable, qué estrategia de marketing usar, cómo conseguir inversores, qué precio poner y qué errores cometen todas las startups.', good: 'Tengo 14 años y quiero crear una app de estudio. Dame tu opinión directa: ¿cuál es el problema más crítico que podría matar esta idea antes de lanzarla?', e: 'Una sola pregunta clave activa el modo directo de Grok; una lista enorme de pedidos diluye el feedback honesto.' },
  { t: 'Pedir a Grok que explique la cultura detrás de un meme viral de X', bad: 'Explícame qué significa este meme, de dónde viene exactamente, cuántos tweets tiene, quiénes fueron los primeros en publicarlo y las estadísticas completas.', good: 'Explícame qué están criticando realmente los usuarios con este meme y por qué este formato conecta con la audiencia de X.', e: 'Grok entiende la cultura de internet, no es un buscador de estadísticas exactas: pídele el "por qué", no cifras.' },
  { t: 'Investigar el sentimiento de X sobre un producto tecnológico', bad: 'Quiero las 3 quejas más comunes, los 2 aspectos más elogiados, si el sentimiento general es positivo, qué influencers hablan de esto y cuántos seguidores tienen cada uno.', good: 'Identifica las 3 quejas más repetidas y los 2 aspectos más elogiados sobre este producto en X. Concluye si el sentimiento general es positivo o negativo.', e: 'Ambos piden un análisis de sentimiento, pero el bueno es más limpio y enfocado en lo que Grok hace mejor.' },
  { t: 'Pedir a Grok que genere una imagen de personaje con Aurora', bad: 'Genera un personaje con ropa moderna, fondo urbano, colores vibrantes, estilo anime pero también realista, bien detallado, épico y original.', good: 'Genera con Aurora: un estudiante de 15 años con ropa streetwear, sentado en una azotea urbana de noche, rodeado de pantallas flotantes. Estilo anime con iluminación neón.', e: 'La especificidad del escenario y la luz vale más que una lista de cualidades abstractas ("épico", "original").' },
  { t: 'Usar Grok para entender un debate polarizado en X', bad: 'Resúmeme el debate, explícame los dos lados, dime quién tiene razón, busca estudios académicos que lo respalden y dame tu conclusión final.', good: 'Resume los 2 argumentos principales de cada lado, tal como los expresan los usuarios de X ahora mismo. No me digas quién tiene razón.', e: 'Usa la fortaleza de Grok (capturar el debate real en X), no le pidas ser juez ni buscar estudios académicos.' },
];

const SCENARIO_POOL = [
  { ctx: 'Kenji, 13 años, Osaka. Vio que un videojuego que le gusta está siendo atacado en X pero no entiende por qué.', ch: [{ lb: 'Usar Gemini', tx: 'Buscar en Google artículos sobre la controversia', ok: false }, { lb: 'Usar Grok', tx: 'Leer los tweets actuales del debate para entender el contexto real', ok: true }, { lb: 'Usar Claude', tx: 'Pegar un artículo largo para un análisis profundo', ok: false }], e: 'Grok es ideal: el debate está pasando en X ahora mismo, y Grok lo lee en tiempo real.' },
  { ctx: 'Aisha, 14 años, Lagos. Necesita datos actualizados de 2024 con fuentes verificables sobre la contaminación del mar para su tarea.', ch: [{ lb: 'Usar Grok', tx: 'Buscar en X qué dicen los usuarios', ok: false }, { lb: 'Usar Claude', tx: 'Analizar un paper científico largo', ok: false }, { lb: 'Usar Gemini', tx: 'Buscar estadísticas de 2024 en Google con fuentes académicas', ok: true }], e: 'Gemini: para datos verificables con citas, su búsqueda web con fuentes gana. X no es una fuente académica.' },
  { ctx: 'Mateo, 12 años, Buenos Aires. Está escribiendo una novela de 10 capítulos y necesita que los personajes sean consistentes en toda la historia.', ch: [{ lb: 'Usar Grok', tx: 'Buscar en X tendencias de narrativa', ok: false }, { lb: 'Usar Claude', tx: 'Mantener toda la información de los personajes en sesión para dar coherencia', ok: true }, { lb: 'Usar Gemini', tx: 'Integrar la escritura con Google Docs', ok: false }], e: 'Claude: su ventana de contexto extensa es perfecta para mantener el hilo de una escritura creativa larga.' },
  { ctx: 'Zara, 13 años, Londres. Quiere feedback honesto sobre su idea de negocio. Sus amigos solo le dicen que está genial.', ch: [{ lb: 'Usar Gemini', tx: 'Buscar si ya existen apps similares', ok: false }, { lb: 'Usar Grok (modo directo)', tx: 'Pedirle feedback sin filtros sobre qué puede fallar', ok: true }, { lb: 'Usar Claude', tx: 'Analizar el mercado en profundidad', ok: false }], e: 'Grok en modo directo: feedback honesto y sin halagos, justo lo que sus amigos no le dan.' },
  { ctx: 'Tomás, 14 años, Lisboa. Necesita crear una imagen de un robot futurista para su presentación y no sabe dibujar.', ch: [{ lb: 'Usar Claude', tx: 'Describir el robot con detalle en texto', ok: false }, { lb: 'Usar Grok (Aurora)', tx: 'Generar la imagen desde una descripción detallada', ok: true }, { lb: 'Usar Gemini', tx: 'Buscar imágenes de robots en Google', ok: false }], e: 'Aurora crea la imagen desde texto directamente en la conversación de Grok.' },
  { ctx: 'Priya, 12 años, Mumbai. Hay un debate enorme esta semana sobre la IA en las escuelas. Quiere entender los dos lados.', ch: [{ lb: 'Usar Grok', tx: 'Analizar el debate en X de las últimas 48 horas y resumir los dos lados', ok: true }, { lb: 'Usar Claude', tx: 'Explicar el debate de forma general', ok: false }, { lb: 'Usar Gemini', tx: 'Buscar artículos académicos sobre IA y educación', ok: false }], e: 'Grok lee el debate actual en X en tiempo real y captura los argumentos como se están dando ahora.' },
];

const WB_POOL = [
  { q: '¿Cuáles son los 3 rasgos principales que definen a Grok según xAI?', cw: ['Directo y sin rodeos', 'Conectado a X en tiempo real', 'Con sentido del humor'], d: ['Anticuado y conservador', 'Sin acceso a internet', 'Muy formal y cauteloso'] },
  { q: '¿Cuáles son 3 características técnicas que hacen único a Grok entre los LLMs?', cw: ['Acceso a X en tiempo real', 'Modo divertido (fun mode)', 'Aurora para generar imágenes'], d: ['Integración con Google Drive', 'Ventana de contexto infinita', 'Sin límites de ningún tipo'] },
  { q: '¿Cuáles son 3 cosas que puede hacer Grok que lo diferencian claramente de Claude?', cw: ['Leer X en tiempo real', 'Generar imágenes con Aurora', 'Feedback sin filtros conservadores'], d: ['Analizar PDFs muy largos', 'Integrar Google Docs', 'Recordar sesiones anteriores'] },
];

// ═══════════════════════════════════════════════════════════
// buildSteps — 0:intro + 20 módulos + 21:completion
// ═══════════════════════════════════════════════════════════
const buildSteps = (): Step[] => {
  const scenarios = pickN(SCENARIO_POOL, 3);
  const wb = pickN(WB_POOL, 1)[0];
  const mkScenario = (num: number, s: typeof SCENARIO_POOL[number]): ScenarioStep => ({
    type: 'scenario', num, xp: 10, context: s.ctx,
    // baraja el orden de las opciones y mapea a {label,text,ok}
    choices: pickN(s.ch, s.ch.length).map((c) => ({ label: c.lb, text: c.tx, ok: c.ok })),
    explain: s.e,
  });
  return [
    // 0 INTRO
    {
      type: 'theory', xp: 0,
      render: () => (
        <View>
          <View style={styles.introIcon}><Text style={{ fontSize: 34 }}>⚡</Text></View>
          <StepTag color="#e6faf3" textColor="#065f46" label="Nivel 22 · 20 módulos" />
          <Text style={styles.lessonTitle}>Grok — La IA con personalidad propia</Text>
          <Text style={styles.lessonSub}>Ya dominas Claude y Gemini. Ahora conoce al más irreverente: Grok. Sin filtros innecesarios, conectado a X en tiempo real, capaz de generarte imágenes, y diseñado para ir directo al punto.</Text>
          <Card color="#a7f3d0" icon="📚" title="Qué vas a aprender" text="La historia de xAI · Acceso a X en tiempo real · Modo directo y fun mode · Aurora para imágenes · Cuándo usar Grok vs Claude vs Gemini · Ética de una IA sin filtros" />
          <DarkCard icon="🎲" title="Preguntas aleatorias cada vez" text="Este nivel selecciona preguntas diferentes de pools grandes cada vez que lo abres. Si lo repites, verás actividades distintas." />
          <Card color="#fde68a" icon="🎮" title="20 módulos · hasta 175 XP" text="Teoría · Casos · Clasificar · Conectar · 3 Escenarios · Ordenar · Quiz · V/F · Vocabulario · Construir respuesta · Prompts · Reflexión" />
        </View>
      ),
    },
    // 1 TEORÍA: xAI
    {
      type: 'theory', xp: 0,
      render: () => (
        <View>
          <StepTag color="#f0fdf4" textColor="#166534" label="📖 Módulo 1 de 20 · Teoría" />
          <Text style={styles.lessonTitle}>xAI y el origen de Grok</Text>
          <Text style={styles.bodyText}>En 2023, Elon Musk fundó <Bold>xAI</Bold> con una promesa diferente: crear una IA que dijera la verdad sin censura innecesaria y estuviera conectada al mundo real.</Text>
          <DarkCard icon="⚡" title="xAI — La empresa detrás de Grok" text='Fundada en julio de 2023, en San Francisco. El nombre "Grok" viene de una novela de ciencia ficción clásica y significa entender algo tan profundamente que se convierte en parte de ti.' />
          <Text style={styles.bodyText}>Grok nació integrado a X (antes Twitter), dándole desde el inicio una ventaja que ningún otro LLM tenía: <Bold>acceso en tiempo real a lo que el mundo está pensando ahora</Bold>.</Text>
          <Text style={styles.sectionTitle}>Los 3 rasgos que definen a Grok</Text>
          <Card color="#a7f3d0" icon="⚡" title="Directo y sin rodeos" text="Diseñado para responder de forma directa, sin advertencias excesivas. Si le preguntas algo, va al punto." />
          <Card color="#a7f3d0" icon="🕐" title="Conectado a X en tiempo real" text="Mientras Claude y ChatGPT dependen de su entrenamiento, Grok puede consultar X ahora mismo y ver tendencias actuales." />
          <Card color="#a7f3d0" icon="😄" title="Con sentido del humor" text="Puede ser sarcástico y usar el humor de internet de forma natural. Entiende la cultura de X mejor que cualquier otro LLM." />
          <HLBox color="#e6faf3" borderColor="#00ba7c"><Text style={styles.hlBoxText}><Bold>Por qué importa para ti:</Bold> Grok te da acceso a la conversación que está pasando en internet ahora mismo. Para tendencias, cultura pop y debates actuales, eso cambia todo.</Text></HLBox>
        </View>
      ),
    },
    // 2 DRAG
    {
      type: 'dragdrop', title: '¿Cuándo Grok brilla y cuándo no?', xp: 20,
      instruction: 'Grok es increíble en su zona, pero hay tareas para las que no es la herramienta correcta. Clasifica cada situación.',
      zones: ['⚡ Fortaleza de Grok', '⚠️ Usa otra herramienta'], colClass: ['f', 'c'],
      items: pickN(DRAG_POOL, 10).map((it, i) => ({ id: `d${i}`, text: it.t, correct: it.c })),
    },
    // 3 EJEMPLOS
    {
      type: 'theory', xp: 0,
      render: () => (
        <View>
          <StepTag color="#fff7ed" textColor="#9a3412" label="🌍 Módulo 3 de 20 · Casos del mundo" />
          <Text style={styles.lessonTitle}>Grok en el mundo real</Text>
          <Text style={styles.lessonSub}>Grok ya está siendo usado de formas que ningún otro LLM puede replicar.</Text>
          <ExampleCard emoji="📷" name="Niran · Bangkok" sub="Detectar tendencias virales para su canal"
            how="Niran crea videos de tecnología. Antes de grabar, le pregunta a Grok qué debates dominan X en las últimas horas. Grok lee los tweets actuales e identifica los 3 temas más candentes. Su engagement subió 40%."
            fact="⭐ Ningún otro LLM puede leer X en tiempo real y resumirlo para que decidas tu contenido hoy, no mañana." />
          <ExampleCard emoji="💡" name="Emma · Ámsterdam" sub="Feedback honesto sobre su startup"
            how="Emma, 14 años, le mostró su pitch a Grok en modo directo. Grok le dijo exactamente qué no funcionaba: modelo de negocio sin sostenibilidad, propuesta poco clara y 3 competidores que ignoraba. Sus profesores solo le decían que estaba muy bien."
            fact="⭐ El valor de una respuesta directa y honesta es enorme cuando todos los demás dan halagos. Grok lo activa por diseño." />
          <ExampleCard emoji="🎨" name="Amahle · Johannesburgo" sub="Crear imágenes de referencia con Aurora"
            how="Amahle, fotógrafa, usa Grok para generar imágenes de referencia antes de una sesión. Le describe el mood y el estilo, y Aurora crea las imágenes en segundos. Las muestra a sus clientes para alinear expectativas."
            fact="⭐ Aurora, el generador de imágenes de xAI, está en la misma conversación: no requiere herramienta separada." />
          <ExampleCard emoji="💼" name="Diego · Ciudad de México" sub="Investigar el sentimiento de mercado"
            how="Antes de gastar en encuestas, Diego le preguntó a Grok qué opinaban los usuarios de X sobre apps de finanzas para jóvenes. Grok leyó miles de tweets, identificó quejas (interfaz complicada) y elogios (gamificación). Cambió 3 características antes de lanzar."
            fact="⭐ Una investigación de mercado tradicional habría costado miles de dólares. Grok la entregó en minutos con datos reales." />
        </View>
      ),
    },
    // 4 TEORÍA: acceso X
    {
      type: 'theory', xp: 0,
      render: () => (
        <View>
          <StepTag color="#f0fdf4" textColor="#166534" label="📖 Módulo 4 de 20 · Teoría" />
          <Text style={styles.lessonTitle}>El superpoder de Grok: leer X en tiempo real</Text>
          <Text style={styles.bodyText}>Imagina un amigo procesando millones de tweets por segundo, identificando qué es genuinamente viral vs qué es ruido, y resumiéndote todo en segundos. Eso es lo que Grok hace con X.</Text>
          <HLBox color="#e6faf3" borderColor="#00ba7c"><Text style={styles.hlBoxText}><Bold>La diferencia fundamental:</Bold> Claude y ChatGPT saben lo que aprendieron durante su entrenamiento (meses de antigüedad). Grok puede leer X ahora mismo. Para ciertas preguntas, esa diferencia vale muchísimo.</Text></HLBox>
          <Text style={styles.sectionTitle}>Para qué sirve el acceso a X</Text>
          <Card color="#a7f3d0" icon="📈" title="Tendencias en tiempo real" text="¿Qué hashtag está explotando ahora? ¿Qué noticia acaba de generar debate? Grok lo sabe." />
          <Card color="#a7f3d0" icon="😂" title="Cultura de internet y memes" text="Grok entiende de dónde viene un meme, qué está criticando y por qué es gracioso. No da una explicación robótica y literal." />
          <Card color="#a7f3d0" icon="📊" title="Análisis de sentimiento" text="Lee miles de tweets y da el sentimiento general (positivo, negativo, dividido) con ejemplos reales." />
          <HLBox color="#fffbeb" borderColor="#d97706"><Text style={styles.hlBoxText}><Bold>⚠️ Límite importante:</Bold> X tiene una audiencia específica y sesgada. El sentimiento de X no representa a toda la sociedad, solo a los usuarios activos de esa plataforma. Esa diferencia importa.</Text></HLBox>
        </View>
      ),
    },
    // 5 MATCHING
    {
      type: 'matching', title: 'Características de Grok con su descripción', xp: 15,
      instruction: 'Toca una característica a la izquierda, luego la descripción correcta a la derecha.',
      pairs: pickN(MATCH_POOL, 4).map((p) => ({ left: p.l, right: p.r })),
    },
    // 6 ESCENARIO 0
    mkScenario(6, scenarios[0]),
    // 7 TEORÍA: modos
    {
      type: 'theory', xp: 0,
      render: () => (
        <View>
          <StepTag color="#f0fdf4" textColor="#166534" label="📖 Módulo 7 de 20 · Teoría" />
          <Text style={styles.lessonTitle}>Los dos modos de Grok</Text>
          <Text style={styles.bodyText}>Grok tiene algo que ningún otro LLM tiene por defecto: <Bold>dos modos que cambian el tono y el nivel de restricciones</Bold>.</Text>
          <Text style={styles.sectionTitle}>Modo Normal</Text>
          <Card color="#bbf7d0" icon="📋" title="Directo pero balanceado" text="Responde de forma clara sin rodeos innecesarios, con tono profesional. Bueno para la mayoría de tareas." />
          <Text style={styles.sectionTitle}>Modo Divertido (Fun Mode)</Text>
          <Card color="#a7f3d0" icon="😄" title="Irreverente y con humor" text="Permite sarcasmo, humor y estilo informal. Las restricciones conservadoras se reducen. Más parecido a hablar con un amigo." />
          <Card color="#fde68a" icon="💬" title='Ejemplo: "¿Es buena mi idea de negocio?"' text='Modo normal: "Tu idea tiene potencial, aunque hay desafíos que considerar..."  ·  Modo divertido: "Hay 3 razones por las que esto podría fallar estrepitosamente. Escúchalas antes de gastar tu mesada."' />
          <HLBox color="#fffbeb" borderColor="#d97706"><Text style={styles.hlBoxText}><Bold>Cuándo usar cuál:</Bold> Modo normal para tareas serias o cuando compartes el resultado. Modo divertido para feedback honesto, entender memes o conversación casual. El modo divertido no significa respuestas incorrectas, solo un tono diferente.</Text></HLBox>
        </View>
      ),
    },
    // 8 SORT
    {
      type: 'sort', title: 'Cómo procesa Grok una pregunta sobre tendencias', xp: 15,
      instruction: 'Ordena los 5 pasos de lo que ocurre cuando le preguntas a Grok sobre algo que está pasando en X ahora mismo.',
      correctOrder: GROK_SORT,
    },
    // 9 QUIZ
    {
      type: 'quiz', title: 'Demuestra lo que sabes sobre Grok', xp: 32,
      questions: pickN(QUIZ_POOL, 4).map((q) => shuffleOptions({ question: q.q, options: q.o, correct: q.c, explain: q.e })),
    },
    // 10 ESCENARIO 1
    mkScenario(10, scenarios[1]),
    // 11 V/F
    {
      type: 'vf', title: '¿Verdadero o Falso sobre Grok?', xp: 30,
      statements: pickN(TF_POOL, 5).map((s) => ({ text: s.s, correct: s.c, feedback: s.e })),
    },
    // 12 TEORÍA: Aurora y ética
    {
      type: 'theory', xp: 0,
      render: () => (
        <View>
          <StepTag color="#f0fdf4" textColor="#166534" label="📖 Módulo 12 de 20 · Teoría" />
          <Text style={styles.lessonTitle}>Aurora y la ética de una IA sin filtros</Text>
          <Text style={styles.bodyText}><Bold>Aurora</Bold> es el generador de imágenes de xAI integrado en Grok. Creas imágenes desde texto directamente en la conversación, sin cambiar de herramienta.</Text>
          <Text style={styles.sectionTitle}>Cómo pedir buenas imágenes a Aurora</Text>
          <StepList items={[
            'Sujeto: ¿qué hay en la imagen? "Un robot amigable de 12 años estudiando".',
            'Estilo: ¿cómo se ve? "Ilustración digital", "anime", "pixel art", "fotorrealista".',
            'Ambiente: ¿qué sensación? "Luces de neón azules", "tonos cálidos al atardecer".',
            'Composición: ¿cómo está encuadrado? "Primer plano", "formato cuadrado".',
          ]} />
          <Text style={styles.sectionTitle}>Ética al usar Grok sin filtros</Text>
          <Card color="#fed7aa" icon="⚠️" title="Menos filtros no es sin ética" text="Grok fue diseñado con menos restricciones innecesarias, pero sigue teniendo límites importantes: no genera contenido que cause daño real. Sin filtros significa sin cautela excesiva, no sin responsabilidad." />
          <HLBox color="#fef2f2" borderColor="#dc2626"><Text style={styles.hlBoxText}><Bold>Usos problemáticos:</Bold> usar fun mode para atacar personas reales · usar el análisis de X para ridiculizar a alguien · usar Aurora para crear contenido falso o manipulador · asumir que Grok siempre tiene razón (puede alucinar como cualquier LLM).</Text></HLBox>
          <HLBox color="#e6faf3" borderColor="#00ba7c"><Text style={styles.hlBoxText}><Bold>La regla de los 3 segundos:</Bold> antes de compartir algo que Grok generó, pregúntate: ¿es esto verdad? ¿podría malinterpretarse? ¿le haría daño a alguien? Si la respuesta a cualquiera es "tal vez", verifica primero.</Text></HLBox>
        </View>
      ),
    },
    // 13 FILL
    {
      type: 'fillblanks', title: 'Completa las frases sobre Grok', xp: 24,
      items: pickN(FILL_POOL, 3).map((f) => {
        const shuffled = shuffleOptions({ options: f.o, correct: f.c });
        return { sentence: (blank: string) => `${f.s}${blank}.`, options: shuffled.options, correct: shuffled.correct, explain: f.e };
      }),
    },
    // 14 WORD BUILDER
    {
      type: 'wordbuilder', xp: 15, question: wb.q,
      correct: wb.cw, words: pickN([...wb.cw, ...wb.d], wb.cw.length + wb.d.length),
    },
    // 15 TEORÍA: comparación 3 LLMs
    {
      type: 'theory', xp: 0,
      render: () => (
        <View>
          <StepTag color="#f0fdf4" textColor="#166534" label="📖 Módulo 15 de 20 · Teoría" />
          <Text style={styles.lessonTitle}>Grok vs Claude vs Gemini: el mapa completo</Text>
          <Text style={styles.bodyText}>Ahora que conoces los tres LLMs principales, puedes construir el mapa final. Cada uno tiene su zona donde claramente gana.</Text>
          <View style={styles.vsGrid}>
            <View style={[styles.vsCol, { backgroundColor: '#1e2130', borderColor: '#2d3148' }]}>
              <Text style={[styles.vsHeader, { backgroundColor: '#2d3148', color: '#6ee7b7' }]}>⚡ Grok</Text>
              <Text style={[styles.vsItem, { color: '#94a3b8' }]}>✓ Tendencias X ahora mismo</Text>
              <Text style={[styles.vsItem, { color: '#94a3b8' }]}>✓ Memes y cultura de internet</Text>
              <Text style={[styles.vsItem, { color: '#94a3b8' }]}>✓ Feedback directo sin rodeos</Text>
              <Text style={[styles.vsItem, { color: '#94a3b8' }]}>✓ Imágenes con Aurora</Text>
              <Text style={[styles.vsItem, { color: '#94a3b8' }]}>⚠ Análisis académico extenso</Text>
            </View>
            <View style={[styles.vsCol, { backgroundColor: '#fff3ee', borderColor: '#fdd9c8' }]}>
              <Text style={[styles.vsHeader, { backgroundColor: '#fdd9c8', color: '#7c2d12' }]}>⭐ Claude</Text>
              <Text style={styles.vsItem}>✓ Textos y documentos muy largos</Text>
              <Text style={styles.vsItem}>✓ Calibración de incertidumbre</Text>
              <Text style={styles.vsItem}>✓ Proyectos creativos extensos</Text>
              <Text style={styles.vsItem}>✓ Respuestas reflexivas y matizadas</Text>
              <Text style={styles.vsItem}>⚠ Sin acceso a tendencias actuales</Text>
            </View>
          </View>
          <Card color="#a7f3d0" icon="✦" title="Gemini gana en:" text="Gmail, Docs, Drive, Sheets integrados · Búsqueda web con fuentes verificables · Resumir videos de YouTube · Datos actuales de Google con citas" />
          <HLBox color="#e6faf3" borderColor="#00ba7c"><Text style={styles.hlBoxText}><Bold>Guía rápida de los 4 LLMs:</Bold>{'\n'}⚡ Tendencias X / feedback directo / imágenes Aurora → Grok{'\n'}⭐ Texto largo / análisis profundo → Claude{'\n'}✦ Búsqueda web con fuentes / ecosistema Google → Gemini{'\n'}💬 Imágenes DALL·E / plugins → ChatGPT</Text></HLBox>
        </View>
      ),
    },
    // 16 ESCENARIO 2
    mkScenario(16, scenarios[2]),
    // 17 PROMPTS
    {
      type: 'promptcompare', title: '¿Cuál prompt activa lo mejor de Grok?', xp: 30,
      tasks: pickN(PROMPT_POOL, 3).map((p) => ({ task: p.t, bad: p.bad, good: p.good, explain: p.e, flip: Math.random() < 0.5 })),
    },
    // 18 BONUS
    {
      type: 'theory', xp: 0,
      render: () => (
        <View>
          <StepTag color="#fce7f3" textColor="#9d174d" label="🚀 Módulo 18 de 20 · Bonus" />
          <Text style={styles.lessonTitle}>Hacia dónde va Grok</Text>
          <Text style={styles.bodyText}>xAI es una de las empresas de IA que crece más rápido. Con acceso a la infraestructura de X y los recursos de Elon Musk, las actualizaciones de Grok son frecuentes y ambiciosas.</Text>
          <DarkCard icon="🎞️" title="Generación de video" text="xAI trabaja en capacidades de video. La integración con X haría posible crear clips virales desde texto directamente en la plataforma." />
          <DarkCard icon="🤖" title="Grok en robots físicos" text="xAI explora integrar Grok en robots físicos. La misma IA que responde tus preguntas podría controlar robots que interactúan con el mundo real." />
          <DarkCard icon="📱" title="Mayor integración con X" text="Grok se incorpora cada vez más en X: resume hilos, explica el contexto de posts y responde preguntas sobre tu feed sin salir de la app." />
          <DarkCard icon="🔓" title="Expansión del código abierto" text="xAI publicó versiones base de Grok como código abierto. Desarrolladores de todo el mundo pueden construir aplicaciones usando Grok como base." />
          <HLBox color="#e6faf3" borderColor="#00ba7c"><Text style={styles.hlBoxText}><Bold>El patrón más importante:</Bold> Grok se actualiza más rápido que Claude o Gemini. Sus limitaciones actuales probablemente se resuelvan antes de lo que crees. Aprender a usar nuevas versiones es tan importante como usar bien la actual.</Text></HLBox>
        </View>
      ),
    },
    // 19 CASO
    {
      type: 'theory', xp: 0,
      render: () => (
        <View>
          <StepTag color="#fff7ed" textColor="#9a3412" label="📚 Módulo 19 de 20 · Caso real" />
          <Text style={styles.lessonTitle}>Kofi necesita entender el mercado de su app</Text>
          <Card color="#fde68a" icon="📍" title="La situación" text="Kofi, 14 años, Accra, Ghana. Desarrolló una app para ayudar a estudiantes a encontrar grupos de estudio. Antes de lanzarla quiere saber qué piensan los jóvenes sobre apps de estudio colaborativo. No tiene dinero para investigadores." />
          <StepList items={[
            'Pregunta de tendencias: "¿Qué dicen los usuarios de X en las últimas 24h sobre apps de estudio colaborativo? Las 3 quejas más repetidas y los 2 elogios" → queja: demasiado complicado para empezar; elogio: encontré amigos reales para estudiar.',
            'Validación con modo directo: "¿Qué podrían criticar los usuarios de mi app? Sé directo" → Grok señaló seguridad al conocer desconocidos, privacidad de datos de menores y el problema de la comunidad vacía.',
            'Análisis competitivo: "¿Qué apps de estudio se mencionan positivamente en X ahora?" → Grok identificó 3 apps y el patrón común: gamificación de las sesiones y recompensas por consistencia.',
          ]} />
          <HLBox color="#e6faf3" borderColor="#00ba7c"><Text style={styles.hlBoxText}><Bold>Resultado:</Bold> Kofi cambió 2 decisiones de diseño antes del lanzamiento. La investigación tomó 2 horas y $0. Y los problemas que encontró eran reales, no ideas de un modelo entrenado hace meses.</Text></HLBox>
        </View>
      ),
    },
    // 20 REFLEXIÓN
    {
      type: 'reflect', xp: 15, minChars: 70,
      placeholder: 'Ejemplo: Usaría Grok cuando quiero entender una tendencia viral en X, como un debate de tecnología, para conocer los argumentos reales antes de opinar — el acceso en tiempo real es perfecto para eso. En cambio, para analizar los libros de mi clase usaría Claude, porque necesito que recuerde 300 páginas de contexto durante toda la sesión...',
    },
    // 21 COMPLETION
    { type: 'completion', xp: 0 },
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
      <View style={{ flex: 1 }}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.cardText}>{text}</Text></View>
    </View>
  </View>
);
const DarkCard = ({ icon, title, text }: { icon: string; title: string; text: string }) => (
  <View style={styles.darkCard}>
    <View style={styles.cardRow}>
      <View style={[styles.cardIcon, { backgroundColor: '#2d3148' }]}><Text style={{ fontSize: 20 }}>{icon}</Text></View>
      <View style={{ flex: 1 }}><Text style={[styles.cardTitle, { color: '#e2e8f0' }]}>{title}</Text><Text style={[styles.cardText, { color: '#94a3b8' }]}>{text}</Text></View>
    </View>
  </View>
);
const ExampleCard = ({ emoji, name, sub, how, fact }: { emoji: string; name: string; sub: string; how: string; fact: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <TouchableOpacity style={[styles.exCard, open && styles.exCardOpen]} onPress={() => setOpen(o => !o)} activeOpacity={0.85}>
      <View style={styles.cardRow}>
        <View style={styles.exEmoji}><Text style={{ fontSize: 22 }}>{emoji}</Text></View>
        <View style={{ flex: 1 }}><Text style={styles.cardTitle}>{name}</Text><Text style={styles.exSub}>{sub}</Text></View>
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
export default function World4Level4() {
  const completeLevel = useGameStore((s) => s.completeLevel);
  const steps = useRef(buildSteps()).current;
  const [step, setStep] = useState(0);
  useReportProgress(step, steps.length);
  const [xp, setXp] = useState(0);
  const [xpToast, setXpToast] = useState<{ amount: number; id: number } | null>(null);

  const [dPlaced, setDPlaced] = useState<Record<string, string>>({});
  const [dSel, setDSel] = useState<string | null>(null);
  const [dAttempts, setDAttempts] = useState(0);
  const [dOk, setDOk] = useState(false);
  const [mLeft, setMLeft] = useState<number | null>(null);
  const [mDone, setMDone] = useState<Set<number>>(new Set());
  const [mRightOrder, setMRightOrder] = useState<string[]>([]);
  const [mWrong, setMWrong] = useState<number | null>(null);
  const [mOk, setMOk] = useState(false);
  const [sOrder, setSOrder] = useState<number[]>([]);
  const [sWrong, setSWrong] = useState<Set<number>>(new Set());
  const [sOk, setSOk] = useState(false);
  const [sFb, setSFb] = useState<string | null>(null);
  const [qAnswers, setQAnswers] = useState<Record<number, number>>({});
  const [qChecked, setQChecked] = useState(false);
  const [vfAnswers, setVFAnswers] = useState<Record<number, boolean>>({});
  const [vfChecked, setVFChecked] = useState(false);
  const [fAnswers, setFAnswers] = useState<Record<number, number>>({});
  const [fChecked, setFChecked] = useState(false);
  const [pPicks, setPPicks] = useState<Record<number, 'bad' | 'good'>>({});
  const [pChecked, setPChecked] = useState(false);
  const [scSel, setScSel] = useState<number | null>(null);
  const [scChecked, setScChecked] = useState(false);
  const [wbSel, setWbSel] = useState<number[]>([]); // índices seleccionados del pool
  const [wbChecked, setWbChecked] = useState(false);
  const [reflectText, setReflectText] = useState('');

  useEffect(() => {
    const cur = steps[step];
    setDPlaced({}); setDSel(null); setDAttempts(0); setDOk(false);
    setMLeft(null); setMDone(new Set()); setMRightOrder([]); setMWrong(null); setMOk(false);
    setSOrder([]); setSWrong(new Set()); setSOk(false); setSFb(null);
    setQAnswers({}); setQChecked(false);
    setVFAnswers({}); setVFChecked(false);
    setFAnswers({}); setFChecked(false);
    setPPicks({}); setPChecked(false);
    setScSel(null); setScChecked(false);
    setWbSel([]); setWbChecked(false);
    setReflectText('');
    if (cur.type === 'sort') setSOrder([...Array(5).keys()].sort(() => Math.random() - 0.5));
    if (cur.type === 'matching') setMRightOrder((cur as MatchingStep).pairs.map(p => p.right).sort(() => Math.random() - 0.5));
  }, [step]);

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
        setSWrong(new Set(sOrder.reduce<number[]>((a, v, i) => { if (v !== i) a.push(i); return a; }, [])));
        setSFb('Revisa el orden: ¿qué ocurre primero y qué es consecuencia de qué?');
        setTimeout(() => setSWrong(new Set()), 2000);
        return;
      }
      addXP(cur.xp); setSOk(true); setSFb('¡Exacto! Ese es el flujo de una consulta de Grok a X.'); return;
    }
    if (cur.type === 'quiz' && !qChecked) {
      if (Object.keys(qAnswers).length < (cur as QuizStep).questions.length) return;
      setQChecked(true);
      let c = 0; (cur as QuizStep).questions.forEach((q, i) => { if (qAnswers[i] === q.correct) c++; });
      addXP(c * 8); return;
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
    if (cur.type === 'scenario' && !scChecked) {
      if (scSel === null) return;
      setScChecked(true);
      if ((cur as ScenarioStep).choices[scSel].ok) addXP(cur.xp);
      return;
    }
    if (cur.type === 'wordbuilder' && !wbChecked) {
      const wbs = cur as WordBuilderStep;
      if (wbSel.length < wbs.correct.length) return;
      setWbChecked(true);
      const selWords = wbSel.map(i => wbs.words[i]);
      const allCorrect = selWords.length === wbs.correct.length && selWords.every(w => wbs.correct.includes(w));
      if (allCorrect) addXP(cur.xp);
      return;
    }
    if (cur.type === 'reflect') {
      if (reflectText.trim().length < (cur as ReflectStep).minChars) return;
      addXP((cur as ReflectStep).xp);
    }
    setStep(s => s + 1);
  };

  // Módulos de solo-lectura → "← Anterior" (§19).
  const THEORY_STEPS = new Set([0, 1, 3, 4, 7, 12, 15, 18, 19]);
  const showBack = THEORY_STEPS.has(step) && step > 0;

  const finishLevel = () => {
    const stars = xp >= 155 ? 3 : xp >= 100 ? 2 : 1; // máx real ~226 XP
    completeLevel(22, stars, xp);
    router.replace('/level/23');
  };

  const cur = steps[step];
  const CONTENT_STEPS = steps.length - 2; // 20
  const progress = Math.round((step / (steps.length - 1)) * 100);

  const primaryDisabled = (() => {
    if (cur.type === 'quiz' && !qChecked) return Object.keys(qAnswers).length < (cur as QuizStep).questions.length;
    if (cur.type === 'vf' && !vfChecked) return Object.keys(vfAnswers).length < (cur as VFStep).statements.length;
    if (cur.type === 'fillblanks' && !fChecked) return Object.keys(fAnswers).length < (cur as FillBlanksStep).items.length;
    if (cur.type === 'promptcompare' && !pChecked) return Object.keys(pPicks).length < (cur as PromptCompareStep).tasks.length;
    if (cur.type === 'scenario' && !scChecked) return scSel === null;
    if (cur.type === 'wordbuilder' && !wbChecked) return wbSel.length < (cur as WordBuilderStep).correct.length;
    if (cur.type === 'reflect') return reflectText.trim().length < (cur as ReflectStep).minChars;
    return false;
  })();

  const primaryLabel = (() => {
    if (cur.type === 'quiz') return qChecked ? 'Continuar →' : 'Comprobar respuestas';
    if (cur.type === 'vf') return vfChecked ? 'Continuar →' : 'Comprobar respuestas';
    if (cur.type === 'fillblanks') return fChecked ? 'Continuar →' : 'Comprobar';
    if (cur.type === 'promptcompare') return pChecked ? 'Continuar →' : 'Comprobar elecciones';
    if (cur.type === 'scenario') return scChecked ? 'Continuar →' : 'Verificar elección';
    if (cur.type === 'wordbuilder') return wbChecked ? 'Continuar →' : 'Verificar respuesta';
    if (cur.type === 'matching') return 'Continuar →';
    if (cur.type === 'dragdrop') return dOk ? 'Continuar →' : 'Verificar';
    if (cur.type === 'sort') return sOk ? 'Continuar →' : 'Verificar orden';
    if (cur.type === 'reflect') return 'Enviar reflexión →';
    if (step === 0) return '¡Empecemos! ⚡';
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
      {step > 0 && step < steps.length - 1 && <Text style={styles.progLabel}>Módulo {step} de {CONTENT_STEPS}</Text>}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {cur.type === 'theory' && (cur as TheoryStep).render()}
        {cur.type === 'dragdrop' && (
          <DragDropComponent mod={cur as DragDropStep} dPlaced={dPlaced} dSel={dSel}
            onSelect={setDSel}
            onDrop={(col: string) => { if (dSel) { setDPlaced(p => ({ ...p, [dSel]: col })); setDSel(null); } }}
            onRemove={(id: string) => setDPlaced(p => { const n = { ...p }; delete n[id]; return n; })} />
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
        {cur.type === 'quiz' && <QuizComponent mod={cur as QuizStep} qAnswers={qAnswers} qChecked={qChecked} onSelect={(qi: number, oi: number) => setQAnswers(p => ({ ...p, [qi]: oi }))} />}
        {cur.type === 'vf' && <VFComponent mod={cur as VFStep} vfAnswers={vfAnswers} vfChecked={vfChecked} onSelect={(qi: number, val: boolean) => setVFAnswers(p => ({ ...p, [qi]: val }))} />}
        {cur.type === 'fillblanks' && <FillBlanksComponent mod={cur as FillBlanksStep} fAnswers={fAnswers} fChecked={fChecked} onSelect={(qi: number, oi: number) => setFAnswers(p => ({ ...p, [qi]: oi }))} />}
        {cur.type === 'promptcompare' && <PromptCompareComponent mod={cur as PromptCompareStep} pPicks={pPicks} pChecked={pChecked} onSelect={(qi: number, which: 'bad' | 'good') => setPPicks(p => ({ ...p, [qi]: which }))} />}
        {cur.type === 'scenario' && <ScenarioComponent mod={cur as ScenarioStep} scSel={scSel} scChecked={scChecked} onSelect={setScSel} />}
        {cur.type === 'wordbuilder' && (
          <WordBuilderComponent mod={cur as WordBuilderStep} wbSel={wbSel} wbChecked={wbChecked}
            onAdd={(i: number) => { if (!wbChecked && !wbSel.includes(i)) setWbSel(p => [...p, i]); }}
            onRemove={(i: number) => { if (!wbChecked) setWbSel(p => p.filter(x => x !== i)); }} />
        )}
        {cur.type === 'reflect' && (
          <View>
            <StepTag color="#f3f4f6" textColor="#374151" label="✍️ Módulo 20 de 20 · Reflexión final · +15 XP" />
            <Text style={styles.lessonTitle}>¿Qué lugar tiene Grok en tu kit?</Text>
            <Text style={styles.lessonSub}>Ya tienes tres LLMs dominados. Piensa en: 1) una situación donde Grok sería claramente la mejor opción y por qué (acceso a X, modo directo, Aurora...); 2) una situación donde NO usarías Grok, qué LLM elegirías y la razón técnica.</Text>
            <TextInput style={styles.textArea} placeholder={(cur as ReflectStep).placeholder} placeholderTextColor="#b8bcc0" multiline value={reflectText} onChangeText={setReflectText} />
            <Text style={styles.charCount}>{reflectText.trim().length} / {(cur as ReflectStep).minChars} mínimo</Text>
          </View>
        )}
        {cur.type === 'completion' && (
          <View style={styles.completeContainer}>
            <View style={styles.completeIcon}><Text style={{ fontSize: 46 }}>⚡</Text></View>
            <Text style={styles.completeTitle}>¡Nivel 22 completado!</Text>
            <Text style={styles.completeSub}>Terminaste "Grok: La IA con personalidad propia". Ya dominas los tres LLMs principales: Claude para profundidad, Gemini para el ecosistema Google, y Grok para la conversación que está pasando ahora mismo en X.</Text>
            <Text style={styles.xpBig}>⭐ {xp} XP ganados</Text>
            <View style={styles.skillsBox}>
              {[
                'Sé quién creó a Grok y qué hace único a xAI',
                'Entiendo el acceso en tiempo real a X como fortaleza clave',
                'Conozco la diferencia entre modo normal y modo divertido',
                'Sé cómo usar Aurora para generar imágenes con prompts detallados',
                'Puedo elegir entre Claude, Gemini y Grok según cada situación real',
              ].map((skill, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: i < 4 ? 7 : 0 }}>
                  <Text style={{ color: '#10b981', fontWeight: '700', fontSize: 14 }}>✓</Text>
                  <Text style={{ fontSize: 12, color: '#334155', lineHeight: 18, flex: 1 }}>{skill}</Text>
                </View>
              ))}
            </View>
            <View style={styles.nextHint}>
              <Text style={{ fontSize: 12, color: '#334155', lineHeight: 20 }}>
                🏆 <Text style={{ fontWeight: '700' }}>Nivel 23: El Gran Torneo{'\n\n'}</Text>
                Ya conoces a los 4 LLMs principales: ChatGPT, Claude, Gemini y Grok. Ahora viene el reto: un torneo donde tu misión es elegir la herramienta correcta para cada situación real. Sin pistas.
              </Text>
            </View>
            <Text style={{ fontSize: 10, color: '#94a3b8', marginBottom: 8 }}>Nivel 22 de 36 completado · 61% del camino a IA Explorer</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={finishLevel}><Text style={styles.primaryBtnText}>Siguiente nivel →</Text></TouchableOpacity>
          </View>
        )}
      </ScrollView>
      {cur.type !== 'completion' && (
        <View style={styles.navRow}>
          {showBack && <TouchableOpacity style={styles.backBtn} onPress={() => setStep(s => s - 1)}><Text style={styles.backBtnText}>← Anterior</Text></TouchableOpacity>}
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
const DragDropComponent = ({ mod, dPlaced, dSel, onSelect, onDrop, onRemove }: any) => (
  <View>
    <StepTag color="#e6faf3" textColor="#065f46" label="🎯 Clasificar" />
    <Text style={styles.lessonTitle}>{mod.title}</Text>
    <Text style={styles.bodyText}>{mod.instruction}</Text>
    <View style={styles.chipsPool}>
      {mod.items.filter((it: any) => !dPlaced[it.id]).map((it: any) => (
        <TouchableOpacity key={it.id} style={[styles.chip, dSel === it.id && styles.chipSel]} onPress={() => onSelect(dSel === it.id ? null : it.id)}>
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
            <Text style={[styles.dropHeader, { backgroundColor: zi === 0 ? '#e6faf3' : '#fef2f2', color: zi === 0 ? '#065f46' : '#991b1b' }]}>{zone}</Text>
            <View style={styles.dropArea}>
              {Object.entries(dPlaced).filter(([, z]) => z === col).map(([id]) => {
                const item = mod.items.find((i: any) => i.id === id);
                return (
                  <TouchableOpacity key={id} style={[styles.dropChip, { backgroundColor: zi === 0 ? '#e6faf3' : '#fef2f2' }]} onPress={() => onRemove(id)}>
                    <Text style={{ fontSize: 11, color: zi === 0 ? '#065f46' : '#991b1b' }}>{item.text} ✕</Text>
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
    <StepTag color="#e6faf3" textColor="#065f46" label="🔗 Conectar" />
    <Text style={styles.lessonTitle}>{mod.title}</Text>
    <Text style={styles.bodyText}>{mod.instruction}</Text>
    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 4 }}>
      <Text style={[styles.matchColLabel, { flex: 1 }]}>Característica</Text>
      <Text style={[styles.matchColLabel, { flex: 1 }]}>¿Qué significa?</Text>
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
    <StepTag color="#e6faf3" textColor="#065f46" label="🔢 Ordenar" />
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
          return <TouchableOpacity key={oi} style={s} disabled={qChecked} onPress={() => onSelect(qi, oi)}><Text style={styles.quizOptText}>{opt}</Text></TouchableOpacity>;
        })}
        {qChecked && <View style={[styles.feedback, qAnswers[qi] === q.correct ? styles.feedbackOk : styles.feedbackFail]}><Text style={styles.feedbackText}>{qAnswers[qi] === q.correct ? '✓ ¡Correcto! ' : '✗ '}{q.explain}</Text></View>}
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
          <TouchableOpacity style={[styles.tfBtn, vfAnswers[qi] === true && styles.tfSelTrue, vfChecked && s.correct === true && styles.tfCorrect, vfChecked && vfAnswers[qi] === true && !s.correct && styles.tfWrong]} disabled={vfChecked} onPress={() => onSelect(qi, true)}><Text style={styles.tfBtnText}>✅ Verdadero</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.tfBtn, vfAnswers[qi] === false && styles.tfSelFalse, vfChecked && s.correct === false && styles.tfCorrect, vfChecked && vfAnswers[qi] === false && !s.correct && styles.tfWrong]} disabled={vfChecked} onPress={() => onSelect(qi, false)}><Text style={styles.tfBtnText}>❌ Falso</Text></TouchableOpacity>
        </View>
        {vfChecked && <View style={[styles.feedback, vfAnswers[qi] === s.correct ? styles.feedbackOk : styles.feedbackFail]}><Text style={styles.feedbackText}>{vfAnswers[qi] === s.correct ? '✓ ' : '✗ '}{s.feedback}</Text></View>}
      </View>
    ))}
  </View>
);

const FillBlanksComponent = ({ mod, fAnswers, fChecked, onSelect }: any) => (
  <View>
    <StepTag color="#e6faf3" textColor="#065f46" label="📝 Vocabulario" />
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
              return <TouchableOpacity key={oi} style={s} disabled={fChecked} onPress={() => onSelect(qi, oi)}><Text style={styles.fillOptText}>{o}</Text></TouchableOpacity>;
            })}
          </View>
          {fChecked && <View style={[styles.feedback, fAnswers[qi] === it.correct ? styles.feedbackOk : styles.feedbackFail]}><Text style={styles.feedbackText}>{fAnswers[qi] === it.correct ? '✓ ' : '✗ '}{it.explain}</Text></View>}
        </View>
      );
    })}
  </View>
);

const PromptCompareComponent = ({ mod, pPicks, pChecked, onSelect }: any) => (
  <View>
    <StepTag color="#e6faf3" textColor="#065f46" label="🔍 Comparar prompts" />
    <Text style={styles.lessonTitle}>{mod.title}</Text>
    <Text style={styles.bodyText}>Los dos prompts son largos — la diferencia está en el enfoque. Piensa cuál aprovecha mejor las capacidades reales de Grok.</Text>
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
          {pChecked && <View style={[styles.feedback, pPicks[qi] === 'good' ? styles.feedbackOk : styles.feedbackFail]}><Text style={styles.feedbackText}>{pPicks[qi] === 'good' ? '✓ ¡Correcto! ' : '✗ El prompt más enfocado era mejor. '}{task.explain}</Text></View>}
        </View>
      );
    })}
  </View>
);

const ScenarioComponent = ({ mod, scSel, scChecked, onSelect }: any) => (
  <View>
    <StepTag color="#fef3c7" textColor="#92400e" label={`🎯 Módulo ${mod.num} de 20 · Escenario`} />
    <Text style={styles.lessonTitle}>¿Qué herramienta elige?</Text>
    <View style={styles.scenarioBox}>
      <Text style={styles.scenarioLabel}>📍 Situación</Text>
      <Text style={styles.scenarioText}>{mod.context}</Text>
    </View>
    {mod.choices.map((c: any, ci: number) => {
      let s = styles.scChoice as any;
      if (scChecked && c.ok) s = { ...s, ...styles.scChoiceCorrect };
      else if (scChecked && scSel === ci && !c.ok) s = { ...s, ...styles.scChoiceWrong };
      else if (scSel === ci) s = { ...s, ...styles.scChoiceSel };
      return (
        <TouchableOpacity key={ci} style={s} disabled={scChecked} onPress={() => onSelect(ci)}>
          <Text style={styles.scChoiceLabel}>{c.label}</Text>
          <Text style={styles.scChoiceText}>{c.text}</Text>
        </TouchableOpacity>
      );
    })}
    {scChecked && (
      <View style={[styles.feedback, mod.choices[scSel!].ok ? styles.feedbackOk : styles.feedbackFail]}>
        <Text style={styles.feedbackText}>{mod.choices[scSel!].ok ? '✓ ¡Correcto! ' : '✗ '}{mod.explain}</Text>
      </View>
    )}
  </View>
);

const WordBuilderComponent = ({ mod, wbSel, wbChecked, onAdd, onRemove }: any) => (
  <View>
    <StepTag color="#e6faf3" textColor="#065f46" label="🧩 Construir respuesta" />
    <Text style={styles.lessonTitle}>Selecciona las respuestas correctas</Text>
    <Text style={styles.bodyText}>Toca las {mod.correct.length} opciones que responden correctamente. Toca una seleccionada para quitarla.</Text>
    <View style={styles.wbQuestion}><Text style={styles.wbQuestionText}>{mod.question}</Text></View>
    <Text style={styles.wbLabel}>Opciones — toca para seleccionar</Text>
    <View style={styles.wbPool}>
      {mod.words.map((w: string, i: number) => {
        const picked = wbSel.includes(i);
        const isCorrect = mod.correct.includes(w);
        let s = styles.wbTile as any;
        if (wbChecked && picked) s = { ...s, ...(isCorrect ? styles.wbTileCorrect : styles.wbTileWrong) };
        else if (picked) s = { ...s, ...styles.wbTileSel };
        return (
          <TouchableOpacity key={i} style={s} disabled={wbChecked || picked} onPress={() => onAdd(i)}>
            <Text style={[styles.wbTileText, wbChecked && picked && { color: '#fff' }]}>{w}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
    <Text style={styles.wbLabel}>Tu selección — toca para quitar</Text>
    <View style={styles.wbAnswerRow}>
      {wbSel.length === 0 && <Text style={{ fontSize: 11, color: '#9ca3af' }}>Toca opciones arriba…</Text>}
      {wbSel.map((i: number) => (
        <TouchableOpacity key={i} style={styles.wbChip} disabled={wbChecked} onPress={() => onRemove(i)}>
          <Text style={styles.wbChipText}>{mod.words[i]} ✕</Text>
        </TouchableOpacity>
      ))}
    </View>
    {wbChecked && (() => {
      const selWords = wbSel.map((i: number) => mod.words[i]);
      const allCorrect = selWords.length === mod.correct.length && selWords.every((w: string) => mod.correct.includes(w));
      return <View style={[styles.feedback, allCorrect ? styles.feedbackOk : styles.feedbackFail]}><Text style={styles.feedbackText}>{allCorrect ? '✓ ¡Correcto! +15 XP' : `✗ Las respuestas correctas eran: ${mod.correct.join(', ')}.`}</Text></View>;
    })()}
  </View>
);

// ── Estilos ──
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  bar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  closeBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 15, fontWeight: '800', color: '#6b7280' },
  track: { flex: 1, height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, marginHorizontal: 12 },
  fill: { height: '100%', backgroundColor: '#00ba7c', borderRadius: 3 },
  xpChip: { ...typography.bold, fontSize: 14, color: '#065f46' },
  progLabel: { ...typography.caption, color: '#9ca3af', textAlign: 'center', paddingTop: 6 },
  scrollContent: { padding: 16, paddingBottom: 30 },
  introIcon: { width: 68, height: 68, borderRadius: 20, backgroundColor: '#1e2130', justifyContent: 'center', alignItems: 'center', marginBottom: 12, alignSelf: 'flex-start' },
  stepTag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 12 },
  stepTagText: { fontSize: 11, fontWeight: '700' },
  lessonTitle: { ...typography.extraBold, fontSize: 20, color: '#111827', marginBottom: 8, lineHeight: 26 },
  lessonSub: { ...typography.regular, fontSize: 13, color: '#6b7280', marginBottom: 14, lineHeight: 19 },
  bodyText: { ...typography.regular, fontSize: 13, color: '#374151', lineHeight: 21, marginBottom: 12 },
  sectionTitle: { ...typography.bold, fontSize: 14, color: '#111827', marginTop: 8, marginBottom: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  card: { backgroundColor: '#f9fafb', borderRadius: 14, padding: 13, marginBottom: 10, borderWidth: 1 },
  darkCard: { backgroundColor: '#1e2130', borderRadius: 14, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: '#2d3148' },
  cardRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  cardIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { ...typography.bold, fontSize: 13, color: '#111827', marginBottom: 4 },
  cardText: { ...typography.regular, fontSize: 12, color: '#374151', lineHeight: 18 },
  exCard: { backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  exCardOpen: { borderColor: '#00ba7c', backgroundColor: '#f5fffb' },
  exEmoji: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  exSub: { fontSize: 11, color: '#6b7280', marginTop: 1 },
  exArrow: { fontSize: 16, color: '#9ca3af' },
  exBody: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  exHow: { fontSize: 12, color: '#374151', lineHeight: 19, marginBottom: 8 },
  exFact: { backgroundColor: '#e6faf3', borderRadius: 8, padding: 9, borderWidth: 1, borderColor: '#a7f3d0' },
  exFactText: { fontSize: 12, color: '#065f46', lineHeight: 17, fontWeight: '500' },
  hlBox: { padding: 12, borderRadius: 10, borderLeftWidth: 3, marginTop: 10, marginBottom: 6 },
  hlBoxText: { fontSize: 13, color: '#334155', lineHeight: 20 },
  stepList: { marginVertical: 8, gap: 9 },
  stepItem: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#00ba7c', alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  stepText: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 20 },
  vsGrid: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  vsCol: { flex: 1, borderRadius: 12, padding: 10, borderWidth: 1 },
  vsHeader: { fontSize: 11, fontWeight: '700', textAlign: 'center', padding: 5, borderRadius: 7, marginBottom: 8 },
  vsItem: { fontSize: 11, color: '#374151', paddingVertical: 4, lineHeight: 15 },
  chipsPool: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, padding: 10, backgroundColor: '#f9fafb', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 10, minHeight: 54 },
  chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#d1d5db', backgroundColor: '#fff' },
  chipSel: { borderColor: '#00ba7c', backgroundColor: '#e6faf3' },
  chipText: { fontSize: 12, color: '#374151' },
  dropCols: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  dropCol: { flex: 1, borderRadius: 12, borderWidth: 2, borderStyle: 'dashed', borderColor: '#d1d5db', minHeight: 80, padding: 8, backgroundColor: '#fafafa' },
  dropColHas: { borderStyle: 'solid', borderColor: '#6ee7b7', backgroundColor: '#f0fdf4' },
  dropHeader: { fontSize: 11, fontWeight: '700', textAlign: 'center', padding: 5, borderRadius: 7, marginBottom: 7, overflow: 'hidden' },
  dropArea: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  dropChip: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12 },
  matchColLabel: { fontSize: 11, fontWeight: '700', color: '#6b7280', textAlign: 'center' },
  matchItem: { padding: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#e5e7eb', marginBottom: 6, minHeight: 58, justifyContent: 'center', backgroundColor: '#f9fafb' },
  matchItemSel: { borderColor: '#00ba7c', backgroundColor: '#e6faf3' },
  matchItemDone: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  matchItemWrong: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  matchText: { fontSize: 11, color: '#374151', textAlign: 'center', lineHeight: 15 },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, backgroundColor: '#f9fafb', borderRadius: 12, borderWidth: 1.5, borderColor: '#e5e7eb', marginBottom: 6 },
  sortRowOk: { borderColor: '#6ee7b7', backgroundColor: '#f0fdf4' },
  sortRowBad: { borderColor: '#fca5a5', backgroundColor: '#fef2f2' },
  sortNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#00ba7c', alignItems: 'center', justifyContent: 'center' },
  sortNumText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  sortText: { flex: 1, fontSize: 12, color: '#374151', lineHeight: 17 },
  arrowCol: { flexDirection: 'column', gap: 2 },
  arrow: { fontSize: 13, color: '#00ba7c', paddingHorizontal: 6 },
  arrowOff: { color: '#cbd5e1' },
  quizQ: { ...typography.bold, fontSize: 13, color: '#111827', padding: 12, backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 8, lineHeight: 18 },
  quizOpt: { padding: 12, borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 11, marginBottom: 6, backgroundColor: '#fff' },
  quizOptSel: { borderColor: '#00ba7c', backgroundColor: '#e6faf3' },
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
  fillOptSel: { borderColor: '#00ba7c', backgroundColor: '#e6faf3' },
  fillOptCorrect: { borderColor: '#16a34a', backgroundColor: '#dcfce7' },
  fillOptWrong: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  fillOptText: { fontSize: 12, color: '#374151', fontWeight: '600' },
  promptTask: { fontSize: 12, fontWeight: '700', color: '#064e3b', padding: 9, backgroundColor: '#e6faf3', borderRadius: 9, borderWidth: 1, borderColor: '#a7f3d0', marginBottom: 8 },
  promptCard: { borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: '#e5e7eb', marginBottom: 8, backgroundColor: '#fff' },
  promptCardSel: { borderColor: '#00ba7c', backgroundColor: '#e6faf3' },
  promptCardGood: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  promptCardBad: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  promptLabel: { fontSize: 10, fontWeight: '700', marginBottom: 4 },
  promptText: { fontSize: 12, color: '#374151', lineHeight: 18 },
  scenarioBox: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 12 },
  scenarioLabel: { fontSize: 11, fontWeight: '700', color: '#6b7280', marginBottom: 4 },
  scenarioText: { fontSize: 13, color: '#111827', lineHeight: 19, fontWeight: '500' },
  scChoice: { padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#e5e7eb', marginBottom: 8, backgroundColor: '#fff' },
  scChoiceSel: { borderColor: '#00ba7c', backgroundColor: '#e6faf3' },
  scChoiceCorrect: { borderColor: '#16a34a', backgroundColor: '#dcfce7' },
  scChoiceWrong: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  scChoiceLabel: { fontSize: 12, fontWeight: '700', color: '#111827', marginBottom: 3 },
  scChoiceText: { fontSize: 12, color: '#6b7280', lineHeight: 17 },
  wbQuestion: { backgroundColor: '#e6faf3', borderRadius: 12, padding: 13, borderLeftWidth: 4, borderLeftColor: '#00ba7c', marginBottom: 14 },
  wbQuestionText: { fontSize: 13, fontWeight: '700', color: '#064e3b', lineHeight: 19 },
  wbLabel: { fontSize: 11, fontWeight: '700', color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  wbPool: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  wbTile: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 16, borderWidth: 2, borderColor: '#d1d5db', backgroundColor: '#fff' },
  wbTileSel: { opacity: 0.3 },
  wbTileCorrect: { borderColor: '#16a34a', backgroundColor: '#16a34a' },
  wbTileWrong: { borderColor: '#dc2626', backgroundColor: '#dc2626' },
  wbTileText: { fontSize: 12, color: '#374151' },
  wbAnswerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, minHeight: 44, padding: 8, borderWidth: 2, borderStyle: 'dashed', borderColor: '#00ba7c', borderRadius: 12, alignItems: 'center' },
  wbChip: { backgroundColor: '#00ba7c', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 16 },
  wbChipText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  feedback: { borderRadius: 10, padding: 11, marginTop: 8 },
  feedbackOk: { backgroundColor: '#dcfce7' },
  feedbackFail: { backgroundColor: '#fef2f2' },
  feedbackText: { fontSize: 12, lineHeight: 17, color: '#334155' },
  textArea: { borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, minHeight: 110, fontSize: 13, backgroundColor: '#fafafa', marginBottom: 6, textAlignVertical: 'top', color: '#374151' },
  charCount: { fontSize: 11, color: '#9ca3af', textAlign: 'right' },
  navRow: { flexDirection: 'row', gap: 8, padding: 14, borderTopWidth: 1, borderTopColor: '#f0f0f0', backgroundColor: '#fafafa' },
  backBtn: { paddingHorizontal: 16, paddingVertical: 13, borderRadius: 12, backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#e2e8f0', justifyContent: 'center' },
  backBtnText: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  primaryBtn: { backgroundColor: '#00ba7c', padding: 14, borderRadius: 12, alignItems: 'center' },
  primaryBtnOff: { backgroundColor: '#e5e7eb' },
  primaryBtnText: { ...typography.bold, color: '#fff', fontSize: 15 },
  completeContainer: { alignItems: 'center', paddingTop: 10 },
  completeIcon: { width: 86, height: 86, borderRadius: 24, backgroundColor: '#1e2130', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  completeTitle: { ...typography.extraBold, fontSize: 22, color: '#111827', marginBottom: 6, textAlign: 'center' },
  completeSub: { ...typography.regular, fontSize: 13, color: '#6b7280', textAlign: 'center', marginBottom: 16, lineHeight: 19 },
  xpBig: { ...typography.bold, fontSize: 16, color: '#065f46', backgroundColor: '#e6faf3', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#a7f3d0', overflow: 'hidden' },
  skillsBox: { backgroundColor: '#f0fdf4', borderRadius: 12, padding: 13, marginBottom: 14, borderWidth: 1, borderColor: '#bbf7d0', width: '100%' },
  nextHint: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 11, marginBottom: 14, borderWidth: 1, borderColor: '#e2e8f0', width: '100%' },
});
