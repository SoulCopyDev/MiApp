import { exitLevel } from '../../utils/exitLevel';
import { router } from 'expo-router';
import { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useGameStore } from '../../store/gameStore';
import { typography } from '../../theme';
import XPToast from '../../components/XPToast';

// ═══════════════════════════════════════════════════════════
// Evaluación Mundo 4 · El Gran Torneo de Herramientas (N40)
// TEMA OSCURO cyan (bg #000818, texto #ecfeff).
// Reconstruido vs eval-mundo4.html (estándar v2.2).
// ═══════════════════════════════════════════════════════════

// ── Paleta (dark cyan) ──
const C = {
  bg: '#000818', surface: '#001225', card: '#001a30', card2: '#00243d',
  text: '#ecfeff', muted: '#7dd3fc', border: '#003a5f',
  cyan: '#06b6d4', blue: '#3b82f6', indigo: '#6366f1', cyanLight: '#67e8f9',
  okBg: '#052e16', okBorder: '#16a34a', okText: '#86efac',
  failBg: '#2d0707', failBorder: '#dc2626', failText: '#fca5a5',
  warnBg: '#2d1a05', warnBorder: '#d97706', warnText: '#fcd34d',
};

// ── Tipos ──
type QuizQ = { q: string; opts: string[]; c: number; fb: string };
type TourItem = { task: string; opts: { t: string; ok: boolean }[]; fb: string };
type PCItem = { task: string; responses: { who: string; text: string }[]; q: string; opts: { t: string; ok: boolean }[]; fb: string };

// ── Helpers ──
const pickN = <T,>(arr: T[], n: number): T[] => [...arr].sort(() => Math.random() - 0.5).slice(0, n);

// ── Validación de contenido (§14) ──
const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const TOOL_NAMES = ['chatgpt', 'claude', 'gemini', 'grok', 'perplexity', 'notebooklm', 'copilot', 'meta ai', 'meta', 'midjourney', 'dall-e', 'dalle', 'suno', 'elevenlabs', 'eleven labs', 'runway', 'llama', 'ollama', 'sora', 'pika', 'firefly', 'cursor'];
const looksRandom = (text: string) => {
  const words = normalize(text).split(/\s+/).filter((w) => w.length > 0);
  if (words.length < 3) return true;
  const unique = new Set(words);
  if (unique.size / words.length < 0.5) return true; // mucha repetición
  const noVowel = words.filter((w) => w.length >= 3 && !/[aeiou]/.test(w));
  if (noVowel.length >= 2) return true; // teclazos "asdf jkl"
  return false;
};
const countTools = (text: string) => {
  const n = normalize(text);
  return TOOL_NAMES.filter((t) => n.includes(t)).length;
};
const REFLECTION_TERMS = ['herramienta', 'herramientas', 'ia', 'inteligencia', 'elegir', 'elijo', 'usar', 'uso', 'criterio', 'tarea', 'familia', 'amigos', 'aprend', 'mundo', 'app', 'aplicacion'];
const mentionsTopic = (text: string) => {
  const n = normalize(text);
  if (countTools(text) > 0) return true;
  return REFLECTION_TERMS.some((t) => {
    if (t.length <= 3) return new RegExp(`(^|\\s)${t}(\\s|$|,|\\.)`).test(n); // "ia" palabra completa
    return n.includes(t);
  });
};

// ═══════════════════════════════════════════════════════════
// POOLS — distractores alargados para que la correcta no sea la más larga (§15/27)
// ═══════════════════════════════════════════════════════════
const QUIZ_POOL: QuizQ[] = [
  { q: '¿Cuál fue la principal razón por la que ChatGPT se volvió viral en 2022-2023?', opts: ['Era la primera inteligencia artificial en existir en toda la historia de la computación', 'Fue la primera IA generativa con interfaz conversacional fácil y gratuita para el público general', 'Solo funcionaba en inglés, lo que la hacía exclusiva y muy deseada por todos', 'La desarrolló Google como respuesta directa a su buscador y a la competencia'], c: 1, fb: 'ChatGPT (noviembre 2022) no fue la primera IA, pero sí la primera en hacer accesible la IA generativa al público masivo con una interfaz tan simple como un chat. Llegó a 100 millones de usuarios en solo 2 meses.' },
  { q: '¿Cuál es la principal fortaleza de Claude (Anthropic) comparado con ChatGPT?', opts: ['Genera mejores imágenes artísticas y videos que cualquier otra IA del mercado', 'Análisis cuidado de textos largos, razonamiento profundo y escritura con tono personal', 'Es completamente gratis y sin ningún límite de uso para todos los usuarios', 'Solo funciona para programar y crear código, no para escribir textos largos'], c: 1, fb: 'Claude destaca en razonamiento largo, análisis de documentos extensos y escritura que respeta el tono que el usuario pide. Anthropic se enfoca en la seguridad del modelo.' },
  { q: 'Gemini (Google) tiene una ventaja única que otras IAs no tienen:', opts: ['Integración nativa con todo el ecosistema Google: Docs, Gmail, YouTube y Maps', 'Es la IA más barata del mercado y por eso la usa mucha más gente', 'Solo funciona en dispositivos Apple como el iPhone y las computadoras Mac', 'No usa internet para nada y funciona completamente sin ninguna conexión'], c: 0, fb: 'Gemini está integrado en Gmail, Google Docs, YouTube, Maps, etc. Puedes pedirle que resuma un correo dentro de Gmail, analice un Doc compartido o busque en videos de YouTube directamente.' },
  { q: 'Grok (xAI, de Elon Musk) tiene una característica distintiva principal:', opts: ['Acceso en tiempo real a los datos y las conversaciones de X (Twitter)', 'Es la IA con la mayor cantidad de idiomas disponibles en todo el planeta', 'Solo la pueden usar empresas grandes que firmen un contrato especial', 'Es 100% open source y cualquiera puede descargar y modificar su código'], c: 0, fb: 'Grok está integrado con X y tiene acceso a las conversaciones en tiempo real de la plataforma. Esto le da ventaja para eventos actuales, pero también hereda los sesgos y el ruido de X.' },
  { q: 'Perplexity se diferencia principalmente de ChatGPT en que:', opts: ['Es bastante más barata que ChatGPT y por eso la eligen tantas personas', 'Busca en internet en tiempo real y cita fuentes verificables con links clickeables', 'Solo responde preguntas académicas de ciencias, historia y matemáticas', 'Pertenece a Microsoft, igual que el buscador Bing y el paquete Office'], c: 1, fb: 'Perplexity combina búsqueda web real con síntesis de IA, y siempre cita sus fuentes con [1][2][3] clickeables. Es la herramienta ideal cuando necesitas datos verificables.' },
  { q: '¿Qué significa que Llama (Meta) sea "open source"?', opts: ['Que el código es abierto pero solo para los empleados internos de la empresa Meta', 'Cualquier persona puede descargar el modelo gratis, modificarlo y ejecutarlo en su servidor', 'Que la herramienta es totalmente gratis pero únicamente durante los primeros 30 días', 'Que solo funciona con datos públicos que ya estén libres y disponibles en internet'], c: 1, fb: 'Open source significa código abierto: Meta publica el modelo completo y cualquiera puede descargarlo, ejecutarlo localmente, modificarlo y crear versiones propias sin pedir permiso ni pagar.' },
  { q: 'NotebookLM (de Google) es especialmente útil para:', opts: ['Generar imágenes artísticas con estilo cinematográfico para portadas y miniaturas', 'Estudiar sobre tus propios materiales: subes PDFs/apuntes y solo responde con ellos', 'Clonar voces humanas a partir de una muestra corta de audio de la persona', 'Hacer videos de TikTok con transiciones, música y efectos totalmente automáticos'], c: 1, fb: 'NotebookLM está diseñado para que subas tus materiales de estudio y te responda citando páginas específicas de tus documentos. Solo usa lo que le das — no inventa.' },
  { q: '¿Qué es Microsoft Copilot?', opts: ['Una IA creada por Google que compite directamente contra Gemini y contra Bard', 'La IA de OpenAI (GPT-4) integrada dentro de Word, Excel, PowerPoint, Teams y Outlook', 'Una inteligencia artificial hecha exclusivamente para videojuegos y consolas modernas', 'Un asistente de voz para la consola Xbox que responde a órdenes por micrófono'], c: 1, fb: 'Copilot es GPT-4 de OpenAI integrado dentro de las apps de Microsoft Office. Microsoft pagó más de $13 mil millones a OpenAI para lograrlo. No es una app aparte — vive dentro del programa que ya usas.' },
  { q: 'Si necesitas datos actualizados con fuentes para un trabajo de colegio, ¿cuál es la herramienta ideal?', opts: ['ChatGPT — porque es la más famosa y la que usa prácticamente todo el mundo', 'Perplexity — porque cita fuentes reales verificables con links clickeables', 'Meta AI — porque está integrada dentro de WhatsApp y es muy cómoda de usar', 'Grok — porque tiene acceso directo a todo lo que se comenta en la red X'], c: 1, fb: 'Perplexity siempre cita sus fuentes con links clickeables. Ideal para trabajos académicos donde necesitas referencias reales. ChatGPT puede inventar datos (alucinar) si le preguntas sobre hechos específicos.' },
  { q: 'Para escribir código de programación, la combinación más usada actualmente es:', opts: ['Word combinado con ChatGPT para ir escribiendo el código dentro de un documento', 'Cursor o GitHub Copilot (dentro del editor de código) + ChatGPT/Claude para aprender', 'Solo Grok, porque tiene acceso en tiempo real a la información de la red X', 'Excel con fórmulas complejas y macros para automatizar todo el trabajo repetitivo'], c: 1, fb: 'Cursor y GitHub Copilot viven dentro del editor mientras programas, sugiriendo código en tiempo real. Para aprender o entender código, ChatGPT o Claude son excelentes tutores.' },
  { q: '¿Qué herramientas gratis puedes usar hoy si quieres hacer un trabajo escolar completo (investigar + escribir + imagen)?', opts: ['Solo ChatGPT gratis, porque ya trae absolutamente todo lo necesario incluido', 'Perplexity (investigar) + Claude (escribir) + DALL-E dentro de ChatGPT (imagen), TODO gratis', 'Solo Copilot, pero pagando la versión empresarial que cuesta bastante dinero', 'Ninguna herramienta sirve gratis, porque hoy en día absolutamente todo cuesta dinero'], c: 1, fb: 'Perplexity tiene plan gratis, Claude tiene plan gratis, y DALL-E está incluido en ChatGPT gratis. Con ese kit — sin pagar nada — puedes hacer trabajos escolares profesionales.' },
  { q: '¿Cuál es el principal error que comete la gente al elegir IA?', opts: ['Pagar demasiado dinero por planes premium que en realidad casi nunca necesitan', 'Usar ChatGPT para TODO en lugar de elegir la herramienta especializada para cada tarea', 'No conocer Llama ni las otras IAs de código abierto que ya existen hoy', 'Usar la inteligencia artificial en lugar de leer libros y estudiar de verdad'], c: 1, fb: '"La herramienta equivocada hace la tarea en 2 horas con mal resultado. La correcta la hace en 10 minutos perfecta". Usar ChatGPT para investigar con fuentes, o Perplexity para escribir creativamente, es el error más común.' },
  { q: '¿Qué pasa si le pides a ChatGPT que te cite fuentes específicas y reales para un trabajo?', opts: ['Siempre lo hace perfecto y cita fuentes reales sin equivocarse absolutamente nunca', 'Puede inventar referencias, nombres de autores y años: un problema real llamado "alucinación"', 'Solo cita artículos de Wikipedia, porque es la única fuente de datos que conoce', 'Te pide permiso primero antes de darte cualquier tipo de referencia académica'], c: 1, fb: '"Alucinar" en IA significa inventar información con apariencia de real. ChatGPT puede generar referencias con autores, años y títulos que suenan creíbles pero no existen. Por eso, para fuentes REALES, se usa Perplexity.' },
  { q: '¿Qué combinación es ideal para crear un TikTok educativo corto?', opts: ['Perplexity (datos) + Claude (guión) + ElevenLabs (voz) + Midjourney (visuales) + Runway (clips)', 'Solo ChatGPT, porque puede encargarse de absolutamente todas las partes él solo', 'Word junto con PowerPoint para armar las diapositivas, el guión y las imágenes', 'Solo Grok y listo, porque tiene acceso directo a las tendencias de la red X'], c: 0, fb: 'Esa es la forma moderna de crear: cada herramienta hace la parte que hace mejor. Una sola IA trataría de hacer todo mal. Este flujo produce contenido profesional en menos de 1 hora.' },
  { q: '¿Cuál es la habilidad más valiosa que te llevas del Mundo 4?', opts: ['Memorizar de memoria el nombre exacto de las 20 IAs más usadas hoy en día', 'Saber elegir la herramienta correcta según la tarea: el criterio sirve aunque las IAs cambien', 'Usar siempre solamente la IA más popular sin importar para qué la necesites', 'Evitar pagar por cualquier IA aunque el proyecto de verdad lo requiera'], c: 1, fb: 'Las IAs cambiarán constantemente. Dentro de 2 años habrá nuevas dominantes y otras desaparecerán. Pero tu criterio para evaluarlas y elegir la correcta se queda contigo para siempre. Eso es lo valioso.' },
  { q: 'Meta AI dentro de WhatsApp usa por detrás el modelo:', opts: ['ChatGPT, el modelo estrella de la empresa estadounidense OpenAI', 'Llama, el modelo de código abierto de la propia empresa Meta', 'Gemini, el modelo de inteligencia artificial desarrollado por Google', 'Grok, el modelo creado por la empresa xAI de Elon Musk'], c: 1, fb: 'Meta AI es la interfaz de chat; por debajo corre el modelo Llama, que es el propio de Meta. Por eso Meta AI es gratis en WhatsApp: Meta controla todo el stack.' },
  { q: 'Una IA corriendo "localmente" en tu PC significa:', opts: ['Que la herramienta solo funciona dentro de los límites de tu propia ciudad', 'Que el modelo se ejecuta en tu propio computador sin mandar datos a un servidor externo', 'Que necesitas firmar un contrato especial y pagar una licencia a la empresa dueña', 'Que la IA solamente funciona durante el horario de oficina de lunes a viernes'], c: 1, fb: 'Ejecutar localmente (con Ollama, LM Studio, etc.) significa que el modelo vive en tu máquina. No hay internet en la ecuación, tus datos no salen. Requiere un PC con buena tarjeta gráfica.' },
  { q: 'Si pagas ChatGPT Plus ($20/mes), ¿qué obtienes que no tiene la versión gratis?', opts: ['Nada verdaderamente útil, es solo publicidad para que pagues de más cada mes', 'Acceso a GPT-4o, generación de imágenes, modo de voz avanzado y análisis de archivos', 'Únicamente un distintivo de color en tu perfil y nada más de valor real', 'El mismo ChatGPT gratis pero traducido y disponible también en otro idioma'], c: 1, fb: 'Plus te da el modelo más avanzado de OpenAI, imagen incluida, modo de voz conversacional y puedes subir PDFs/Excel para que los analice. La versión gratis tiene muchas de esas funciones limitadas o bloqueadas.' },
  { q: 'Sofía quiere lanzar un canal de YouTube sobre animales exóticos: investigar con fuentes, escribir guion, hacer miniaturas y música. ¿Qué stack elegir?', opts: ['Solo ChatGPT para absolutamente todo el proceso, de principio a fin del canal', 'Perplexity (investigar) + Claude (guion) + Midjourney (miniaturas) + Suno (música)', 'Word junto con PowerPoint para organizar todas las ideas y armar los guiones', 'Grok para todo, aprovechando que tiene acceso directo a la red social X'], c: 1, fb: 'Cada herramienta en su mejor categoría. Perplexity nunca inventa datos, Claude escribe con tono cuidado, Midjourney hace las mejores miniaturas artísticas, Suno hace música real. Juntas: producto profesional.' },
  { q: '¿Qué significa que una IA "alucine"?', opts: ['Que la IA se apaga sola cuando no sabe muy bien cómo responder algo', 'Que inventa información que suena totalmente real pero que en verdad no lo es', 'Que traduce mal los textos cuando los pasa de un idioma a otro distinto', 'Que le pide permiso al usuario antes de responder cada una de las preguntas'], c: 1, fb: 'Alucinar = inventar datos con apariencia de verdad. La IA genera nombres, fechas, autores o referencias que suenan creíbles pero no existen. Por eso, cuando el dato importa, hay que verificar o usar Perplexity.' },
  { q: 'NotebookLM tiene una función sorprendente para repasar:', opts: ['Genera memes graciosos a partir de todo el contenido que le subes al sistema', 'Genera un podcast de 15 minutos con dos voces IA discutiendo tus propios documentos', 'Te manda recordatorios y mensajes directamente a tu propio número de WhatsApp', 'Traduce automáticamente todos tus apuntes escaneados del español al inglés'], c: 1, fb: 'NotebookLM genera un podcast de audio donde dos presentadores (IA) conversan sobre tu material. Ideal para repasar en el bus, mientras haces ejercicio o antes de un examen.' },
  { q: 'Si un abogado usa ChatGPT para buscar casos legales y los presenta en un juicio, el mayor riesgo es:', opts: ['Que el proceso tarde demasiado tiempo y termine retrasando todo el juicio', 'Que ChatGPT invente casos legales inexistentes (ya pasó en Nueva York en 2023)', 'Que el servicio resulte tan caro que al final no valga la pena usarlo', 'Que las respuestas no estén disponibles en español para el tribunal local'], c: 1, fb: 'Es un caso real: un abogado de Nueva York presentó 6 casos legales inventados por ChatGPT. El juez detectó el fraude y el abogado fue multado. Para datos verificables → Perplexity o IA legal especializada (Lexis+AI).' },
  { q: 'La integración más usada de IA dentro de un editor de código se llama:', opts: ['Google Docs', 'GitHub Copilot', 'Netflix', 'Spotify'], c: 1, fb: 'GitHub Copilot (de GitHub + OpenAI) vive dentro de Visual Studio Code y otros editores. Mientras escribes código, te sugiere la siguiente línea automáticamente. Cursor es otro editor construido alrededor de IA con funciones parecidas.' },
  { q: '¿Por qué se dice que las 4 grandes IAs (ChatGPT, Claude, Gemini, Grok) "se parecen cada vez más"?', opts: ['Porque comparten los mismos servidores en la nube y por eso responden tan parecido', 'Porque todas terminan haciendo casi lo mismo, aunque cada una brilla en algo específico', 'Porque en el fondo las fabrica una sola empresa que solo les cambia el nombre', 'Porque por debajo todas funcionan usando exactamente el mismo modelo base entrenado'], c: 1, fb: 'Los expertos le llaman "convergencia". Todas pueden hacer tareas básicas similares. La diferencia real está en dónde brilla cada una: Claude (escritura), Gemini (Google), Grok (X en tiempo real), ChatGPT (versatilidad general).' },
  { q: 'Si un creador de contenido quiere clonar su propia voz para narrar videos, debe usar:', opts: ['ChatGPT con su modo de voz conversacional que ya viene incorporado', 'ElevenLabs, que es hoy el líder indiscutido de la clonación de voz', 'Meta AI, la inteligencia artificial que vive dentro de la app de WhatsApp', 'Perplexity, la que busca y cita fuentes verificables en tiempo real'], c: 1, fb: 'ElevenLabs es la referencia. Con solo 1-3 minutos de muestra de audio puede replicar una voz con calidad profesional. ChatGPT tiene modo de voz pero no clona la tuya — usa voces predefinidas.' },
];

const TOUR_POOL: TourItem[] = [
  { task: 'Escribir un ensayo literario de 1500 palabras sobre "La casa de los espíritus" con análisis cuidado y tono personal.', opts: [{ t: '🟣 Claude', ok: true }, { t: '🌑 Grok', ok: false }], fb: 'Claude es el rey de la escritura larga con tono cuidado. Grok tiene más personalidad irreverente — útil para humor, no para ensayos literarios.' },
  { task: 'Investigar las últimas noticias sobre los incendios forestales de California citando medios reales.', opts: [{ t: '💬 ChatGPT (versión gratis)', ok: false }, { t: '🔎 Perplexity', ok: true }], fb: 'Perplexity siempre cita fuentes reales y busca en tiempo real. ChatGPT gratis puede tener datos desactualizados o inventar referencias.' },
  { task: 'Crear una imagen artística para la portada de un libro de fantasía, con estética cinematográfica.', opts: [{ t: '🎨 Midjourney', ok: true }, { t: '💬 ChatGPT (DALL-E)', ok: false }], fb: 'Midjourney tiene la estética más artística y cinematográfica del mercado. DALL-E en ChatGPT es más literal y menos estilizado.' },
  { task: 'Resumir un PDF corporativo de 60 páginas directamente dentro de Microsoft Word, sin salir del programa.', opts: [{ t: '💼 Microsoft Copilot', ok: true }, { t: '💬 Meta AI en WhatsApp', ok: false }], fb: 'Copilot vive dentro de Word y puede procesar el documento ahí mismo. Meta AI en WhatsApp no tiene esa integración con Office.' },
  { task: 'Preguntar a tus propios apuntes de clase de química (ya escaneados en PDF) sin que la IA invente información fuera de ellos.', opts: [{ t: '📓 NotebookLM', ok: true }, { t: '✨ Gemini', ok: false }], fb: 'NotebookLM fue diseñado exactamente para esto: solo responde basándose en tus documentos cargados, citando páginas exactas. Gemini busca en toda la web y puede mezclar info.' },
  { task: 'Generar una canción completa con letra en español sobre un viaje a Cartagena.', opts: [{ t: '🎵 Suno', ok: true }, { t: '🎨 Midjourney', ok: false }], fb: 'Suno genera música completa con letra. Midjourney es para imágenes — no genera audio.' },
  { task: 'Consultar la última declaración de Elon Musk en X hoy mismo y ver qué están comentando los usuarios.', opts: [{ t: '🌑 Grok', ok: true }, { t: '🟣 Claude', ok: false }], fb: 'Grok tiene integración directa con X y acceso en tiempo real a la plataforma. Claude no puede ver X en tiempo real.' },
  { task: 'Clonar la voz de un estudiante con parálisis para que pueda comunicarse con su propio timbre de voz.', opts: [{ t: '🎤 ElevenLabs', ok: true }, { t: '🔎 Perplexity', ok: false }], fb: 'ElevenLabs es líder en clonación de voz. Con 1-3 minutos de audio de muestra puede replicar la voz de la persona. Perplexity solo busca información.' },
  { task: 'Charlar rápido por WhatsApp con una IA para pedir una receta de pasta, sin descargar otra app.', opts: [{ t: '💬 Meta AI (dentro de WhatsApp)', ok: true }, { t: '🖥️ Ollama local', ok: false }], fb: 'Meta AI vive dentro de WhatsApp — no necesitas descargar nada. Ollama es para correr IAs localmente en tu computador, para casos técnicos.' },
  { task: 'Generar un clip de video de 6 segundos donde un dragón vuela sobre montañas para tu video corto.', opts: [{ t: '🎬 Runway o Sora', ok: true }, { t: '🟣 Claude', ok: false }], fb: 'Runway y Sora generan video desde texto. Claude es solo texto e imágenes — no genera video.' },
  { task: 'Analizar en Gmail los correos de la última semana y hacer un resumen de los más importantes, sin salir de Gmail.', opts: [{ t: '✨ Gemini (integrado a Gmail)', ok: true }, { t: '🟣 Claude', ok: false }], fb: 'Gemini vive dentro del ecosistema Google. Puede resumir correos, buscar en Docs, ver YouTube — todo sin salir. Claude no tiene esa integración.' },
  { task: 'Programar una función en Python mientras trabajas dentro del editor Visual Studio Code.', opts: [{ t: '💬 Meta AI', ok: false }, { t: '🐙 GitHub Copilot', ok: true }], fb: 'GitHub Copilot vive dentro del editor, sugiriendo código en tiempo real mientras programas. Meta AI es para chat general, no se integra a editores de código.' },
  { task: 'Crear una miniatura llamativa con estilo cinematográfico para un video de YouTube sobre misterios de las pirámides.', opts: [{ t: '🎨 Midjourney', ok: true }, { t: '🎤 ElevenLabs', ok: false }], fb: 'Midjourney es referencia en estética cinematográfica. ElevenLabs es solo para voz — no genera imágenes.' },
  { task: 'Un escritor quiere que una IA analice las últimas 150 páginas de su novela y le dé feedback detallado sin perder contexto.', opts: [{ t: '🟣 Claude', ok: true }, { t: '💬 Meta AI', ok: false }], fb: 'Claude maneja textos MUY largos sin olvidar lo del principio. Es famoso por su memoria larga y análisis cuidado. Meta AI en WhatsApp no maneja bien documentos extensos.' },
  { task: 'Un adolescente quiere probar una IA totalmente gratis, sin descargar nada, desde el celular de su mamá.', opts: [{ t: '💼 Copilot empresarial', ok: false }, { t: '💬 Meta AI en WhatsApp', ok: true }], fb: 'Meta AI en WhatsApp es gratis, no requiere descargas ni cuentas nuevas. Copilot empresarial cuesta dinero y requiere contrato.' },
  { task: 'Una diseñadora gráfica quiere quitar el fondo a una foto y rellenar partes que faltan, dentro de Photoshop.', opts: [{ t: '🖌️ Adobe Firefly (en Photoshop)', ok: true }, { t: '🌑 Grok', ok: false }], fb: 'Firefly está integrado a Photoshop con herramientas como "relleno generativo". Grok es un chat general — no edita fotos dentro de Photoshop.' },
  { task: 'Crear un podcast de 15 minutos con dos voces IA que discutan tus propios apuntes escolares.', opts: [{ t: '📓 NotebookLM', ok: true }, { t: '🎵 Suno', ok: false }], fb: 'NotebookLM tiene una función única: genera un podcast realista con dos voces IA discutiendo los documentos que subiste. Suno es para canciones con letra, no podcasts educativos.' },
  { task: 'Un estudiante de arquitectura quiere ver varias ideas visuales de una casa con estilo japonés moderno antes de diseñarla.', opts: [{ t: '🎨 Midjourney', ok: true }, { t: '🔎 Perplexity', ok: false }], fb: 'Midjourney es ideal para generar referencias visuales rápidas con estilos específicos. Perplexity busca y cita, no genera imágenes.' },
  { task: 'Un youtuber quiere narrar sus videos con una voz profesional sin tener que grabarse él mismo, y que suene natural.', opts: [{ t: '🎤 ElevenLabs', ok: true }, { t: '🐙 GitHub Copilot', ok: false }], fb: 'ElevenLabs es la mejor para narraciones profesionales con voces naturales (propias o predefinidas). GitHub Copilot es solo para programación.' },
  { task: 'Analizar un Excel enorme con miles de filas de ventas y sacar un resumen con gráficos, sin salir del Excel.', opts: [{ t: '💼 Microsoft Copilot (en Excel)', ok: true }, { t: '🌑 Grok', ok: false }], fb: 'Copilot vive dentro de Excel y puede analizar tablas, crear gráficos y extraer insights sin que salgas del archivo. Grok no se integra con Office.' },
];

const PC_DATA: PCItem[] = [
  {
    task: 'Resume "Cien años de soledad" en 5 líneas manteniendo el tono mágico del libro.',
    responses: [
      { who: '💬 ChatGPT', text: 'Cien años de soledad es una novela de Gabriel García Márquez que narra la historia de la familia Buendía en el pueblo ficticio de Macondo. La obra explora temas como el amor, la guerra y el destino. Los personajes repiten nombres y patrones a lo largo de generaciones. La novela se destaca por su realismo mágico. Es considerada una obra maestra de la literatura latinoamericana.' },
      { who: '🟣 Claude', text: 'En Macondo, pueblo nacido de la niebla y los sueños, siete generaciones de Buendía cargan el peso de sus propios fantasmas. Los mismos nombres se repiten como ecos, los mismos amores se prohíben y se consuman, la misma soledad se hereda como maldición. Un gitano trae imanes y hielo; una mujer asciende al cielo tendiendo sábanas. Y al final, cuando se lea el último renglón, Macondo será barrido por el viento como si nunca hubiera existido.' },
      { who: '🔎 Perplexity', text: 'Según Wikipedia [1] y la Real Academia Española [2], "Cien años de soledad" es una novela publicada en 1967 por el escritor colombiano Gabriel García Márquez. Narra la historia de la familia Buendía durante siete generaciones en el pueblo ficticio de Macondo. La obra es considerada una de las más importantes del realismo mágico [3].' },
    ],
    q: '¿Cuál respuesta captó mejor el tono mágico que pedía la tarea?',
    opts: [{ t: '💬 ChatGPT — informativo pero plano', ok: false }, { t: '🟣 Claude — literario y evocador', ok: true }, { t: '🔎 Perplexity — precisa pero fría', ok: false }],
    fb: 'Claude capturó el tono mágico porque escribe con atmósfera propia. ChatGPT dio un resumen correcto pero genérico. Perplexity dio datos verificados (con fuentes) pero sin alma literaria. Para tareas creativas con tono específico, Claude gana.',
  },
  {
    task: '¿Cuántas medallas de oro ganó Colombia en los Juegos Olímpicos de París 2024?',
    responses: [
      { who: '💬 ChatGPT (versión gratis, datos 2023)', text: 'Lo siento, mi información tiene fecha de corte anterior y no tengo datos específicos sobre los Juegos Olímpicos de París 2024. Te sugiero consultar fuentes actualizadas.' },
      { who: '🟣 Claude', text: 'No tengo información confirmada sobre el medallero final de Colombia en París 2024. Para datos actuales y verificables, te recomiendo consultar fuentes oficiales como el COI o medios deportivos.' },
      { who: '🔎 Perplexity', text: 'Según El Tiempo [1], Marca [2] y el sitio oficial del COI [3], Colombia obtuvo 1 medalla de oro en los Juegos Olímpicos de París 2024, conseguida por Ángel Barajas en gimnasia artística (barra fija). El total de medallas colombianas fue de 4 (1 oro, 1 plata, 2 bronces).' },
    ],
    q: '¿Cuál respuesta es la más útil para un estudiante haciendo un trabajo con fuentes citables?',
    opts: [{ t: '💬 ChatGPT — admite no saber', ok: false }, { t: '🟣 Claude — admite no saber', ok: false }, { t: '🔎 Perplexity — da el dato con fuentes', ok: true }],
    fb: 'Para datos factuales recientes con fuentes citables, Perplexity es la única que cumple: busca en tiempo real y cita fuentes reales. ChatGPT y Claude son honestos al admitir que no tienen datos actuales — eso es mejor que inventar — pero no resuelven la tarea.',
  },
];

const TOOLKIT_PILLS = ['ChatGPT', 'Claude', 'Gemini', 'Grok', 'Perplexity', 'NotebookLM', 'Copilot', 'Meta AI', 'Midjourney', 'DALL-E', 'Suno', 'ElevenLabs', 'Runway'];

// ═══════════════════════════════════════════════════════════
export default function World4Eval() {
  const completeLevel = useGameStore((s) => s.completeLevel);

  const [currentPart, setCurrentPart] = useState(1);
  const [xp, setXp] = useState(0);
  const [xpToast, setXpToast] = useState<{ amount: number; id: number } | null>(null);
  const [totalCorrect, setTotalCorrect] = useState(0);

  // Pools barajadas (fijadas al montar) — opciones de quiz barajadas (§5/27)
  const quizData = useRef(
    pickN(QUIZ_POOL, 15).map((q) => {
      const correctText = q.opts[q.c];
      const shuffled = [...q.opts].sort(() => Math.random() - 0.5);
      return { ...q, opts: shuffled, c: shuffled.indexOf(correctText) };
    })
  ).current;
  const tourData = useRef(
    pickN(TOUR_POOL, 10).map((t) => ({ ...t, opts: [...t.opts].sort(() => Math.random() - 0.5) }))
  ).current;

  const TOTAL_ITEMS = quizData.length + tourData.length + PC_DATA.length + 2; // +toolkit +reflexión

  // Estados por parte
  const [quizAnswers, setQuizAnswers] = useState<{ [k: number]: number }>({});
  const [quizChecked, setQuizChecked] = useState(false);
  const [quizScore, setQuizScore] = useState(0);

  const [tourAnswers, setTourAnswers] = useState<{ [k: number]: number }>({});
  const [tourChecked, setTourChecked] = useState(false);
  const [tourScore, setTourScore] = useState(0);

  const [pcAnswers, setPcAnswers] = useState<{ [k: number]: number }>({});
  const [pcChecked, setPcChecked] = useState(false);
  const [pcScore, setPcScore] = useState(0);

  const [toolkitText, setToolkitText] = useState('');
  const [toolkitDone, setToolkitDone] = useState(false);
  const [toolkitError, setToolkitError] = useState<string | null>(null);

  const [reflectionText, setReflectionText] = useState('');
  const [reflectionDone, setReflectionDone] = useState(false);
  const [reflectionError, setReflectionError] = useState<string | null>(null);

  const addXP = (v: number) => { setXp((p) => p + v); if (v > 0) setXpToast((prev) => ({ amount: v, id: (prev?.id ?? 0) + 1 })); };

  // ── Quiz ──
  const selectQuiz = (i: number, j: number) => { if (!quizChecked) setQuizAnswers((p) => ({ ...p, [i]: j })); };
  const checkQuiz = () => {
    setQuizChecked(true);
    let correct = 0;
    quizData.forEach((q, i) => { if (quizAnswers[i] === q.c) correct++; });
    setQuizScore(correct);
    setTotalCorrect((p) => p + correct);
    addXP(Math.round((correct / quizData.length) * 80));
  };

  // ── Torneo ──
  const selectTour = (i: number, j: number) => { if (!tourChecked) setTourAnswers((p) => ({ ...p, [i]: j })); };
  const checkTour = () => {
    setTourChecked(true);
    let correct = 0;
    tourData.forEach((t, i) => { const a = tourAnswers[i]; if (a !== undefined && t.opts[a].ok) correct++; });
    setTourScore(correct);
    setTotalCorrect((p) => p + correct);
    addXP(Math.round((correct / tourData.length) * 50));
  };

  // ── Prompt Compare ──
  const selectPC = (i: number, j: number) => { if (!pcChecked) setPcAnswers((p) => ({ ...p, [i]: j })); };
  const checkPC = () => {
    setPcChecked(true);
    let correct = 0;
    PC_DATA.forEach((p, i) => { const a = pcAnswers[i]; if (a !== undefined && p.opts[a].ok) correct++; });
    setPcScore(correct);
    setTotalCorrect((p) => p + correct);
    addXP(Math.round((correct / PC_DATA.length) * 40));
  };

  // ── Toolkit (validación de contenido §14) ──
  const checkToolkit = () => {
    const val = toolkitText.trim();
    if (looksRandom(val)) { setToolkitError('Escribe tu kit con ideas reales, no texto al azar.'); return; }
    const tools = countTools(val);
    if (tools < 2) { setToolkitError('Nombra al menos 2 herramientas del kit (ChatGPT, Claude, Perplexity…).'); return; }
    if (val.split(/\s+/).length < 20) { setToolkitError('Justifica cada elección: para qué la usarías y por qué es la mejor.'); return; }
    setToolkitError(null);
    setToolkitDone(true);
    setTotalCorrect((p) => p + 1);
    addXP(30);
  };

  // ── Reflexión (validación de contenido §14) ──
  const submitReflection = () => {
    const val = reflectionText.trim();
    if (looksRandom(val)) { setReflectionError('Escribe una reflexión real, no texto al azar.'); return; }
    if (val.split(/\s+/).length < 12) { setReflectionError('Cuéntanos un poco más — al menos un par de frases honestas.'); return; }
    if (!mentionsTopic(val)) { setReflectionError('Menciona qué herramienta o idea del Mundo 4 te marcó.'); return; }
    setReflectionError(null);
    setReflectionDone(true);
    setTotalCorrect((p) => p + 1);
    addXP(20);
  };

  const goToNextPart = () => setCurrentPart((p) => (p < 5 ? p + 1 : 6));

  const finish = () => {
    const pct = Math.round((totalCorrect / TOTAL_ITEMS) * 100);
    const stars = pct >= 85 ? 3 : pct >= 65 ? 2 : 1;
    completeLevel(40, stars, xp);
    router.replace('/level/25');
  };

  const canAdvance =
    currentPart === 1 ? quizChecked :
    currentPart === 2 ? tourChecked :
    currentPart === 3 ? pcChecked :
    currentPart === 4 ? toolkitDone :
    currentPart === 5 ? reflectionDone : false;

  // ═══════════ RENDER PARTES ═══════════
  const renderPart1 = () => (
    <View style={styles.partCard}>
      <View style={styles.cardAccent} />
      <View style={styles.partLabel}><Text style={styles.partLabelText}>📝 Parte 1 de 5</Text></View>
      <Text style={styles.partTitle}>Quiz — 15 preguntas del torneo</Text>
      <Text style={styles.partDesc}>Preguntas sobre ChatGPT, Claude, Gemini, Grok y el ecosistema completo. Responde todas y al final verificas.</Text>
      {quizData.map((q, i) => (
        <View key={i} style={styles.qItem}>
          <Text style={styles.qNum}>Pregunta {i + 1} de {quizData.length}</Text>
          <Text style={styles.qText}>{q.q}</Text>
          {q.opts.map((o, j) => {
            const sel = quizAnswers[i] === j;
            const showCorrect = quizChecked && j === q.c;
            const showWrong = quizChecked && sel && j !== q.c;
            return (
              <TouchableOpacity key={j} style={[styles.qOpt, sel && !quizChecked && styles.qOptSel, showCorrect && styles.optCorrect, showWrong && styles.optWrong]} onPress={() => selectQuiz(i, j)} disabled={quizChecked}>
                <Text style={styles.qOptText}>{['🅐', '🅑', '🅒', '🅓'][j]}  {o}</Text>
              </TouchableOpacity>
            );
          })}
          {quizChecked && (
            <View style={[styles.fbBox, quizAnswers[i] === q.c ? styles.fbOk : quizAnswers[i] === undefined ? styles.fbWarn : styles.fbFail]}>
              <Text style={quizAnswers[i] === q.c ? styles.fbOkText : quizAnswers[i] === undefined ? styles.fbWarnText : styles.fbFailText}>
                {quizAnswers[i] === q.c ? '✅ ' : quizAnswers[i] === undefined ? '⚠️ No respondiste. ' : '❌ Casi. '}{q.fb}
              </Text>
            </View>
          )}
        </View>
      ))}
      {!quizChecked ? (
        <TouchableOpacity style={styles.btnPrimary} onPress={checkQuiz}><Text style={styles.btnText}>Verificar respuestas →</Text></TouchableOpacity>
      ) : (
        <View style={[styles.fbBox, quizScore >= 10 ? styles.fbOk : styles.fbWarn]}>
          <Text style={quizScore >= 10 ? styles.fbOkText : styles.fbWarnText}>{quizScore >= 10 ? `✅ ¡${quizScore}/${quizData.length} correctas! Dominas el torneo.` : `📚 ${quizScore}/${quizData.length} correctas. Revisa los niveles donde fallaste.`}</Text>
        </View>
      )}
    </View>
  );

  const renderPart2 = () => (
    <View style={styles.partCard}>
      <View style={styles.cardAccent} />
      <View style={styles.partLabel}><Text style={styles.partLabelText}>⚔️ Parte 2 de 5</Text></View>
      <Text style={styles.partTitle}>Torneo — 10 rondas de decisión</Text>
      <Text style={styles.partDesc}>Para cada tarea te presento 2 herramientas. Elige la correcta. No hay empate — siempre hay una mejor que la otra para ese caso.</Text>
      {tourData.map((t, i) => {
        const correctIdx = t.opts.findIndex((o) => o.ok);
        return (
          <View key={i} style={styles.qItem}>
            <Text style={styles.tourRound}>Ronda {i + 1} de {tourData.length}</Text>
            <Text style={styles.qText}>{t.task}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {t.opts.map((o, j) => {
                const sel = tourAnswers[i] === j;
                const showOk = tourChecked && j === correctIdx;
                const showFail = tourChecked && sel && !o.ok;
                return (
                  <TouchableOpacity key={j} style={[styles.tourBtn, sel && !tourChecked && styles.qOptSel, showOk && styles.optCorrect, showFail && styles.optWrong]} onPress={() => selectTour(i, j)} disabled={tourChecked}>
                    <Text style={styles.tourBtnText}>{o.t}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {tourChecked && (
              <View style={[styles.fbBox, tourAnswers[i] !== undefined && t.opts[tourAnswers[i]].ok ? styles.fbOk : tourAnswers[i] === undefined ? styles.fbWarn : styles.fbFail]}>
                <Text style={tourAnswers[i] !== undefined && t.opts[tourAnswers[i]].ok ? styles.fbOkText : tourAnswers[i] === undefined ? styles.fbWarnText : styles.fbFailText}>
                  {tourAnswers[i] === undefined ? '⚠️ No respondiste. ' : t.opts[tourAnswers[i]].ok ? '✅ ' : '❌ '}{t.fb}
                </Text>
              </View>
            )}
          </View>
        );
      })}
      {!tourChecked ? (
        <TouchableOpacity style={styles.btnPrimary} onPress={checkTour}><Text style={styles.btnText}>Verificar →</Text></TouchableOpacity>
      ) : (
        <View style={[styles.fbBox, tourScore >= 7 ? styles.fbOk : styles.fbWarn]}>
          <Text style={tourScore >= 7 ? styles.fbOkText : styles.fbWarnText}>{tourScore >= 7 ? `✅ ${tourScore}/${tourData.length} rondas ganadas. ¡Eres un estratega!` : `📚 ${tourScore}/${tourData.length} rondas. Elegir la IA correcta mejora con práctica.`}</Text>
        </View>
      )}
    </View>
  );

  const renderPart3 = () => (
    <View style={styles.partCard}>
      <View style={styles.cardAccent} />
      <View style={styles.partLabel}><Text style={styles.partLabelText}>🔬 Parte 3 de 5</Text></View>
      <Text style={styles.partTitle}>Prompt Compare — Misma tarea, 3 herramientas</Text>
      <Text style={styles.partDesc}>Te muestro la misma tarea ejecutada por 3 IAs distintas. Analiza los resultados y elige cuál respondió mejor para este caso.</Text>
      {PC_DATA.map((p, i) => {
        const correctIdx = p.opts.findIndex((o) => o.ok);
        return (
          <View key={i} style={styles.pcTask}>
            <Text style={styles.pcTaskTitle}>Tarea {i + 1}</Text>
            <Text style={styles.qText}>{p.task}</Text>
            {p.responses.map((r, j) => (
              <View key={j} style={styles.pcCard}>
                <Text style={styles.pcCardWho}>{r.who}</Text>
                <Text style={styles.pcCardText}>"{r.text}"</Text>
              </View>
            ))}
            <Text style={styles.pcQ}>{p.q}</Text>
            {p.opts.map((o, j) => {
              const sel = pcAnswers[i] === j;
              const showOk = pcChecked && j === correctIdx;
              const showFail = pcChecked && sel && !o.ok;
              return (
                <TouchableOpacity key={j} style={[styles.qOpt, sel && !pcChecked && styles.qOptSel, showOk && styles.optCorrect, showFail && styles.optWrong]} onPress={() => selectPC(i, j)} disabled={pcChecked}>
                  <Text style={styles.qOptText}>{['🅐', '🅑', '🅒'][j]}  {o.t}</Text>
                </TouchableOpacity>
              );
            })}
            {pcChecked && (
              <View style={[styles.fbBox, pcAnswers[i] !== undefined && p.opts[pcAnswers[i]].ok ? styles.fbOk : pcAnswers[i] === undefined ? styles.fbWarn : styles.fbFail]}>
                <Text style={pcAnswers[i] !== undefined && p.opts[pcAnswers[i]].ok ? styles.fbOkText : pcAnswers[i] === undefined ? styles.fbWarnText : styles.fbFailText}>
                  {pcAnswers[i] === undefined ? '⚠️ No respondiste. ' : p.opts[pcAnswers[i]].ok ? '✅ ' : '❌ '}{p.fb}
                </Text>
              </View>
            )}
          </View>
        );
      })}
      {!pcChecked ? (
        <TouchableOpacity style={styles.btnPrimary} onPress={checkPC}><Text style={styles.btnText}>Verificar análisis →</Text></TouchableOpacity>
      ) : (
        <View style={[styles.fbBox, pcScore >= 1 ? styles.fbOk : styles.fbWarn]}>
          <Text style={pcScore >= 1 ? styles.fbOkText : styles.fbWarnText}>{pcScore >= 1 ? `✅ ${pcScore}/${PC_DATA.length} análisis correctos. Sabes leer entre líneas.` : `📚 ${pcScore}/${PC_DATA.length}. El análisis comparativo es el skill pro.`}</Text>
        </View>
      )}
    </View>
  );

  const renderPart4 = () => (
    <View style={styles.partCard}>
      <View style={styles.cardAccent} />
      <View style={styles.partLabel}><Text style={styles.partLabelText}>🧰 Parte 4 de 5</Text></View>
      <Text style={styles.partTitle}>Builder — Tu toolkit definitivo</Text>
      <Text style={styles.partDesc}>Arma el kit perfecto para un estudiante de tu edad. Máximo 4 herramientas. Justifica cada elección con 1-2 líneas.</Text>
      <View style={styles.pills}>
        {TOOLKIT_PILLS.map((t) => (<View key={t} style={styles.pill}><Text style={styles.pillText}>{t}</Text></View>))}
      </View>
      <TextInput style={styles.textArea} placeholder={'Mi toolkit:\n1. [Herramienta] — [Para qué la uso y por qué es la mejor]\n2. ...\n3. ...\n4. ...'} placeholderTextColor="#4a7a95" value={toolkitText} onChangeText={(t) => { setToolkitText(t); setToolkitError(null); }} multiline editable={!toolkitDone} textAlignVertical="top" />
      {toolkitError && <View style={[styles.fbBox, styles.fbFail]}><Text style={styles.fbFailText}>⚠️ {toolkitError}</Text></View>}
      {!toolkitDone ? (
        <TouchableOpacity style={styles.btnPrimary} onPress={checkToolkit}><Text style={styles.btnText}>Enviar toolkit →</Text></TouchableOpacity>
      ) : (
        <View style={[styles.fbBox, styles.fbOk]}><Text style={styles.fbOkText}>🧰 ¡Toolkit diseñado! Un kit pensado con criterio demuestra que entiendes el mundo de IAs actual. Este toolkit te acompaña en los próximos años.</Text></View>
      )}
    </View>
  );

  const renderPart5 = () => (
    <View style={styles.partCard}>
      <View style={styles.cardAccent} />
      <View style={styles.partLabel}><Text style={styles.partLabelText}>💭 Parte 5 de 5</Text></View>
      <Text style={styles.partTitle}>Reflexión sellada</Text>
      <Text style={styles.partDesc}>Esta es tu última respuesta del Mundo 4. Nadie la va a juzgar — es tuya. Sé honesto.</Text>
      <View style={styles.reflectionPrompt}>
        <Text style={styles.reflectionPromptText}>"¿Cómo cambió este mundo tu manera de usar las herramientas digitales? ¿Qué herramienta de las que conociste NO sabías que existía y ahora vas a usar? ¿Y cuál piensas que usarías con tu familia o amigos?"</Text>
      </View>
      <TextInput style={styles.textArea} placeholder="Escribe tu reflexión aquí. No hay respuestas correctas o incorrectas — solo tu experiencia real con el Mundo 4..." placeholderTextColor="#4a7a95" value={reflectionText} onChangeText={(t) => { setReflectionText(t); setReflectionError(null); }} multiline editable={!reflectionDone} textAlignVertical="top" />
      {reflectionError && <View style={[styles.fbBox, styles.fbFail]}><Text style={styles.fbFailText}>⚠️ {reflectionError}</Text></View>}
      {!reflectionDone ? (
        <TouchableOpacity style={styles.btnPrimary} onPress={submitReflection}><Text style={styles.btnText}>🔒 Sellar y completar</Text></TouchableOpacity>
      ) : (
        <View style={[styles.fbBox, styles.fbOk]}><Text style={styles.fbOkText}>🔒 ¡Reflexión sellada! Este pensamiento es tuyo para siempre.</Text></View>
      )}
    </View>
  );

  const renderCompletion = () => {
    const pct = Math.round((totalCorrect / TOTAL_ITEMS) * 100);
    return (
      <View style={styles.completion}>
        <View style={styles.scoreRing}><Text style={styles.scorePct}>{pct}%</Text><Text style={styles.scoreLbl}>acierto</Text></View>
        <View style={styles.worldBadge}>
          <Text style={{ fontSize: 52, marginBottom: 8 }}>⚡</Text>
          <Text style={styles.worldBadgeTitle}>Insignia: Campeón del Torneo</Text>
          <Text style={styles.worldBadgeSub}>Mundo 4 — El Gran Torneo de Herramientas completado · N19–N24</Text>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statItem}><Text style={styles.statNum}>{totalCorrect}</Text><Text style={styles.statLbl}>Correctas</Text></View>
          <View style={styles.statItem}><Text style={styles.statNum}>{xp}</Text><Text style={styles.statLbl}>XP ganados</Text></View>
          <View style={styles.statItem}><Text style={styles.statNum}>5</Text><Text style={styles.statLbl}>Partes</Text></View>
        </View>
        <Text style={styles.completionText}>¡Eres Campeón del Torneo! Conoces los 4 modelos líderes a fondo, el ecosistema completo, y sabes elegir la IA correcta para cada tarea. Ahora al Mundo 5: es hora de crear tu propio proyecto con impacto real.</Text>
        <TouchableOpacity style={styles.btnPrimary} onPress={finish}><Text style={styles.btnText}>🚀 Ir al Mundo 5 →</Text></TouchableOpacity>
      </View>
    );
  };

  const renderPart = () => {
    switch (currentPart) {
      case 1: return renderPart1();
      case 2: return renderPart2();
      case 3: return renderPart3();
      case 4: return renderPart4();
      case 5: return renderPart5();
      case 6: return renderCompletion();
      default: return null;
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.bar}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => exitLevel()} accessibilityLabel="Salir de la evaluación"><Text style={styles.closeBtnText}>✕</Text></TouchableOpacity>
        <View style={styles.track}><View style={[styles.fill, { width: `${(Math.min(currentPart, 5) / 5) * 100}%` }]} /></View>
        <Text style={styles.xpChip}>{xp} XP</Text>
      </View>
      {currentPart <= 5 && <Text style={styles.progLabel}>Parte {currentPart} de 5</Text>}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.cardAccent} />
          <View style={styles.headerBadge}><Text style={styles.headerBadgeText}>🏆 EVALUACIÓN FINAL · MUNDO 4</Text></View>
          <Text style={styles.headerTitle}>El Gran Torneo de Herramientas</Text>
          <Text style={styles.headerSub}>5 partes · Demuestra que sabes elegir la IA correcta para cada tarea</Text>
        </View>
        {renderPart()}
        {canAdvance && currentPart <= 5 && (
          <TouchableOpacity style={[styles.btnPrimary, { alignSelf: 'center', marginTop: 8, paddingHorizontal: 32 }]} onPress={goToNextPart}>
            <Text style={styles.btnText}>{currentPart === 5 ? 'Ver resultado →' : 'Siguiente parte →'}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      {xpToast && <XPToast key={xpToast.id} amount={xpToast.amount} onHide={() => setXpToast(null)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  bar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  closeBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 15, fontWeight: '800', color: C.muted },
  track: { flex: 1, height: 6, backgroundColor: C.border, borderRadius: 3, marginHorizontal: 12 },
  fill: { height: '100%', backgroundColor: C.cyan, borderRadius: 3 },
  xpChip: { ...typography.bold, fontSize: 14, color: C.cyanLight },
  progLabel: { ...typography.caption, color: C.muted, textAlign: 'center', paddingTop: 6 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 20, padding: 22, backgroundColor: C.surface, borderRadius: 20, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  headerBadge: { backgroundColor: C.cyan, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 99, marginBottom: 12 },
  headerBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  headerTitle: { ...typography.extraBold, fontSize: 22, color: C.text, textAlign: 'center' },
  headerSub: { color: C.muted, fontSize: 13, marginTop: 6, textAlign: 'center' },
  partCard: { backgroundColor: C.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  cardAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: C.cyan },
  partLabel: { alignSelf: 'flex-start', backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 12 },
  partLabelText: { color: C.cyanLight, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  partTitle: { ...typography.extraBold, fontSize: 18, color: C.text, marginBottom: 4 },
  partDesc: { fontSize: 13, color: C.muted, marginBottom: 16, lineHeight: 19 },
  qItem: { backgroundColor: C.card2, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  qNum: { fontSize: 10, fontWeight: '700', color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  tourRound: { fontSize: 10, fontWeight: '700', color: C.cyan, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  qText: { fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 10, lineHeight: 20 },
  qOpt: { backgroundColor: C.surface, borderWidth: 2, borderColor: C.border, borderRadius: 10, padding: 11, marginBottom: 6 },
  qOptSel: { borderColor: C.blue, backgroundColor: '#00243d' },
  qOptText: { fontSize: 13, color: C.text, lineHeight: 19 },
  optCorrect: { borderColor: C.okBorder, backgroundColor: C.okBg },
  optWrong: { borderColor: C.failBorder, backgroundColor: C.failBg },
  tourBtn: { flex: 1, padding: 11, borderRadius: 8, borderWidth: 2, borderColor: C.border, alignItems: 'center', backgroundColor: C.surface },
  tourBtnText: { fontSize: 12, fontWeight: '600', color: C.text },
  fbBox: { borderRadius: 10, padding: 12, marginTop: 8, borderWidth: 1 },
  fbOk: { backgroundColor: C.okBg, borderColor: C.okBorder },
  fbFail: { backgroundColor: C.failBg, borderColor: C.failBorder },
  fbWarn: { backgroundColor: C.warnBg, borderColor: C.warnBorder },
  fbOkText: { fontSize: 12, color: C.okText, lineHeight: 18 },
  fbFailText: { fontSize: 12, color: C.failText, lineHeight: 18 },
  fbWarnText: { fontSize: 12, color: C.warnText, lineHeight: 18 },
  pcTask: { backgroundColor: C.card2, borderRadius: 12, padding: 16, marginBottom: 14, borderWidth: 2, borderColor: C.blue },
  pcTaskTitle: { fontSize: 11, fontWeight: '700', color: C.cyan, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  pcCard: { backgroundColor: C.surface, borderRadius: 10, padding: 12, marginTop: 8, borderWidth: 1, borderColor: C.border },
  pcCardWho: { fontSize: 12, fontWeight: '700', color: C.cyanLight, marginBottom: 4 },
  pcCardText: { fontSize: 11, color: C.muted, lineHeight: 17, fontStyle: 'italic' },
  pcQ: { fontSize: 13, fontWeight: '600', color: C.text, marginTop: 12, marginBottom: 8, lineHeight: 19 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 12, backgroundColor: C.card2, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  pill: { backgroundColor: C.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1.5, borderColor: C.blue },
  pillText: { fontSize: 11, fontWeight: '700', color: C.cyanLight },
  textArea: { borderWidth: 2, borderColor: C.border, borderRadius: 12, padding: 14, minHeight: 130, fontSize: 13, backgroundColor: C.surface, color: C.text, marginBottom: 10 },
  reflectionPrompt: { backgroundColor: C.card2, borderLeftWidth: 4, borderLeftColor: C.cyan, borderRadius: 8, padding: 14, marginBottom: 12 },
  reflectionPromptText: { fontSize: 13, color: C.muted, fontStyle: 'italic', lineHeight: 20 },
  btnPrimary: { backgroundColor: C.cyan, padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  btnText: { ...typography.bold, color: '#00131f', fontSize: 15 },
  completion: { alignItems: 'center', paddingTop: 8 },
  scoreRing: { width: 130, height: 130, borderRadius: 65, backgroundColor: C.card, borderWidth: 6, borderColor: C.cyan, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  scorePct: { fontSize: 30, fontWeight: '800', color: C.cyanLight },
  scoreLbl: { fontSize: 11, color: C.muted },
  worldBadge: { backgroundColor: C.card2, borderRadius: 20, padding: 28, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: C.cyan, width: '100%' },
  worldBadgeTitle: { fontSize: 18, fontWeight: '800', color: C.text, textAlign: 'center' },
  worldBadgeSub: { fontSize: 12, color: C.muted, marginTop: 6, textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20, flexWrap: 'wrap', justifyContent: 'center' },
  statItem: { backgroundColor: C.card2, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center', borderWidth: 1, borderColor: C.border, minWidth: 90 },
  statNum: { fontSize: 20, fontWeight: '800', color: C.cyanLight },
  statLbl: { fontSize: 10, color: C.muted, marginTop: 2 },
  completionText: { fontSize: 13, color: C.muted, textAlign: 'center', marginBottom: 18, lineHeight: 20 },
});
