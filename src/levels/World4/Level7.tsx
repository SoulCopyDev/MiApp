import { router } from 'expo-router';
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, BackHandler,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useGameStore } from '../../store/gameStore';
import { colors, typography } from '../../theme';

// ---------- Tipos ----------
type QuizQ = { q: string; opts: string[]; c: number; fb: string };
type TourItem = { task: string; opts: { t: string; ok: boolean }[]; fb: string };
type PCItem = {
  task: string;
  responses: { who: string; text: string }[];
  q: string;
  opts: { t: string; ok: boolean }[];
  fb: string;
};

// ---------- Pools de datos ----------
const QUIZ_POOL: QuizQ[] = [
  { q: '¿Cuál fue la principal razón por la que ChatGPT se volvió viral en 2022-2023?', opts: ['Era la primera IA en existir', 'Fue la primera IA generativa con interfaz conversacional fácil y gratuita para el público general', 'Solo funcionaba en inglés', 'La desarrolló Google'], c: 1, fb: 'ChatGPT (noviembre 2022) no fue la primera IA, pero sí la primera en hacer accesible la IA generativa al público masivo. Llegó a 100 millones de usuarios en solo 2 meses.' },
  { q: '¿Cuál es la principal fortaleza de Claude (Anthropic) comparado con ChatGPT?', opts: ['Genera mejores imágenes', 'Análisis cuidado de textos largos, razonamiento profundo y escritura con tono personal', 'Es completamente gratis sin límites', 'Solo funciona para programar'], c: 1, fb: 'Claude destaca en razonamiento largo, análisis de documentos extensos y escritura que respeta el tono que el usuario pide.' },
  { q: 'Gemini (Google) tiene una ventaja única que otras IAs no tienen:', opts: ['Integración nativa con todo el ecosistema Google: Docs, Gmail, YouTube, Maps', 'Es la IA más barata del mercado', 'Solo funciona en dispositivos Apple', 'No usa internet'], c: 0, fb: 'Gemini está integrado en Gmail, Google Docs, YouTube, Maps, etc. Puedes pedirle que resuma un correo dentro de Gmail o analice un video de YouTube directamente.' },
  { q: 'Grok (xAI, Elon Musk) tiene una característica distintiva principal:', opts: ['Acceso en tiempo real a datos y conversaciones de X (Twitter)', 'Es la IA con más idiomas disponibles', 'Solo la pueden usar empresas', 'Es 100% open source'], c: 0, fb: 'Grok está integrado con X y tiene acceso a las conversaciones en tiempo real de la plataforma.' },
  { q: 'Perplexity se diferencia principalmente de ChatGPT en que:', opts: ['Es más barata', 'Busca en internet en tiempo real y cita fuentes verificables con links clickeables', 'Solo responde preguntas académicas', 'Pertenece a Microsoft'], c: 1, fb: 'Perplexity combina búsqueda web real con síntesis de IA, y siempre cita sus fuentes con [1][2][3] clickeables.' },
  { q: '¿Qué significa que Llama (Meta) sea "open source"?', opts: ['Que el código es abierto solo para empleados de Meta', 'Cualquier persona puede descargar el modelo gratis, modificarlo y ejecutarlo en su propio servidor', 'Que es gratis solo por 30 días', 'Que solo funciona con datos públicos'], c: 1, fb: 'Open source significa código abierto: Meta publica el modelo completo y cualquiera puede descargarlo, ejecutarlo localmente, modificarlo y crear versiones propias.' },
  { q: 'NotebookLM (de Google) es especialmente útil para:', opts: ['Generar imágenes artísticas', 'Estudiar sobre tus propios materiales: subes PDFs/apuntes y solo responde basándose en ellos', 'Clonar voces', 'Hacer videos de TikTok'], c: 1, fb: 'NotebookLM está diseñado para que subas tus materiales de estudio y te responda citando páginas específicas de tus documentos. Solo usa lo que le das — no inventa.' },
  { q: '¿Qué es Microsoft Copilot?', opts: ['Una IA de Google que compite con Gemini', 'La IA de OpenAI (GPT-4) integrada dentro de Word, Excel, PowerPoint, Teams y Outlook', 'Una IA solo para videojuegos', 'Un asistente de voz para Xbox'], c: 1, fb: 'Copilot es GPT-4 de OpenAI integrado dentro de las apps de Microsoft Office. Microsoft pagó más de $13 mil millones a OpenAI para lograrlo.' },
  { q: 'Si necesitas datos actualizados con fuentes para un trabajo de colegio, ¿cuál es la herramienta ideal?', opts: ['ChatGPT — porque es la más famosa', 'Perplexity — porque cita fuentes reales verificables', 'Meta AI — porque está en WhatsApp', 'Grok — porque tiene acceso a X'], c: 1, fb: 'Perplexity siempre cita sus fuentes con links clickeables. Ideal para trabajos académicos donde necesitas referencias reales.' },
  { q: 'Para escribir código de programación, la combinación más usada actualmente es:', opts: ['Word + ChatGPT', 'Cursor o GitHub Copilot (dentro del editor de código) + ChatGPT/Claude para aprender', 'Solo Grok', 'Excel con fórmulas'], c: 1, fb: 'Cursor y GitHub Copilot viven dentro del editor mientras programas. Para aprender, ChatGPT o Claude son excelentes tutores.' },
  { q: '¿Qué herramientas gratis puedes usar hoy si quieres hacer un trabajo escolar completo (investigar + escribir + imagen)?', opts: ['Solo ChatGPT gratis', 'Perplexity (investigar) + Claude (escribir) + DALL-E dentro de ChatGPT (imagen) — TODO gratis', 'Solo Copilot, pero pagado', 'Ninguna, todo cuesta dinero'], c: 1, fb: 'Perplexity y Claude tienen planes gratis, y DALL-E está incluido en ChatGPT gratis. Con ese kit — sin pagar — puedes hacer trabajos escolares profesionales.' },
  { q: '¿Cuál es el principal error que comete la gente al elegir IA?', opts: ['Pagar demasiado por planes premium', 'Usar ChatGPT para TODO en lugar de elegir la herramienta especializada para cada tarea', 'No conocer Llama', 'Usar IA en lugar de libros'], c: 1, fb: '"La herramienta equivocada hace la tarea en 2 horas con mal resultado. La correcta la hace en 10 minutos perfecta".' },
  { q: '¿Qué pasa si le pides a ChatGPT que te cite fuentes específicas y reales para un trabajo?', opts: ['Siempre lo hace perfecto', 'Puede inventar referencias, nombres de autores, años — es un problema real llamado "alucinación"', 'Solo cita Wikipedia', 'Pide permiso primero'], c: 1, fb: '"Alucinar" en IA significa inventar información con apariencia de real. ChatGPT puede generar referencias que suenan creíbles pero no existen.' },
  { q: '¿Qué combinación es ideal para crear un TikTok educativo corto?', opts: ['Perplexity (datos) + Claude (guión) + ElevenLabs (voz) + Midjourney (visuales) + Runway (clips)', 'Solo ChatGPT', 'Word + PowerPoint', 'Solo Grok y listo'], c: 0, fb: 'Esa es la forma moderna de crear: cada herramienta hace la parte que hace mejor. Una sola IA trataría de hacer todo mal.' },
  { q: '¿Cuál es la habilidad más valiosa que te llevas del Mundo 4?', opts: ['Memorizar el nombre de 20 IAs', 'Saber elegir la herramienta correcta según la tarea — el criterio se mantiene aunque las IAs cambien', 'Usar solo la IA más popular', 'Evitar pagar cualquier IA'], c: 1, fb: 'Las IAs cambiarán constantemente. Pero tu criterio para evaluarlas y elegir la correcta se queda contigo para siempre.' },
  { q: 'Meta AI dentro de WhatsApp usa por detrás el modelo:', opts: ['ChatGPT de OpenAI', 'Llama (de la propia Meta)', 'Gemini de Google', 'Grok de xAI'], c: 1, fb: 'Meta AI es la interfaz de chat; por debajo corre el modelo Llama, el propio de Meta.' },
  { q: 'Una IA corriendo "localmente" en tu PC significa:', opts: ['Que solo funciona en tu ciudad', 'Que el modelo se ejecuta en tu propio computador sin mandar datos a un servidor externo', 'Que necesitas un contrato especial', 'Que solo funciona en horario de oficina'], c: 1, fb: 'Ejecutar localmente (con Ollama, LM Studio, etc.) significa que el modelo vive en tu máquina. Tus datos no salen.' },
  { q: 'Si pagas ChatGPT Plus ($20/mes), ¿qué obtienes que no tiene la versión gratis?', opts: ['Nada, es solo publicidad', 'Acceso a GPT-4o, generación de imágenes, modo de voz avanzado y análisis de archivos', 'Una USB gratis', 'El mismo ChatGPT pero en otro idioma'], c: 1, fb: 'Plus te da el modelo más avanzado de OpenAI, imagen incluida, modo de voz y análisis de PDFs/Excel.' },
  { q: 'Sofía quiere lanzar un canal de YouTube sobre animales exóticos. ¿Qué stack elegir?', opts: ['Solo ChatGPT para todo', 'Perplexity (investigar) + Claude (guion) + Midjourney (miniaturas) + Suno (música)', 'Word + PowerPoint', 'Grok para todo'], c: 1, fb: 'Cada herramienta en su mejor categoría. Juntas: producto profesional.' },
  { q: '¿Qué significa que una IA "alucine"?', opts: ['Que se apaga sola', 'Que inventa información que suena real pero no lo es', 'Que traduce mal', 'Que pide permiso para responder'], c: 1, fb: 'Alucinar = inventar datos con apariencia de verdad. La IA genera nombres, fechas o referencias que suenan creíbles pero no existen.' },
  { q: 'NotebookLM tiene una función sorprendente para repasar:', opts: ['Genera memes', 'Genera un podcast de 15 minutos con dos voces IA discutiendo tus documentos', 'Te manda mensajes al WhatsApp', 'Traduce al inglés'], c: 1, fb: 'NotebookLM genera un podcast de audio donde dos presentadores (IA) conversan sobre tu material. Ideal para repasar en el bus.' },
  { q: 'Si un abogado usa ChatGPT para buscar casos legales y los presenta en un juicio, el mayor riesgo es:', opts: ['Que tarde mucho', 'Que ChatGPT invente casos inexistentes (ya pasó en Nueva York en 2023)', 'Que sea muy caro', 'Que no esté en español'], c: 1, fb: 'Es un caso real: un abogado de Nueva York presentó 6 casos legales inventados por ChatGPT. El juez lo multó.' },
  { q: 'La integración más usada de IA dentro de un editor de código se llama:', opts: ['Google Docs', 'GitHub Copilot', 'Netflix', 'Spotify'], c: 1, fb: 'GitHub Copilot (de GitHub + OpenAI) vive dentro de Visual Studio Code y otros editores.' },
  { q: '¿Por qué se dice que las 4 grandes IAs "se parecen cada vez más"?', opts: ['Porque comparten servidores', 'Porque todas llegan a hacer casi lo mismo aunque cada una brilla en algo específico', 'Porque la misma empresa las hace', 'Porque usan el mismo modelo'], c: 1, fb: 'Los expertos le llaman "convergencia". La diferencia real está en dónde brilla cada una.' },
  { q: 'Si un creador de contenido quiere clonar su propia voz para narrar videos, debe usar:', opts: ['ChatGPT con modo de voz', 'ElevenLabs (es el líder de clonación de voz)', 'Meta AI', 'Perplexity'], c: 1, fb: 'ElevenLabs es la referencia. Con solo 1-3 minutos de muestra de audio puede replicar una voz con calidad profesional.' }
];

const TOUR_POOL: TourItem[] = [
  { task: 'Escribir un ensayo literario de 1500 palabras sobre "La casa de los espíritus" con análisis cuidado y tono personal.', opts: [{ t: '🟣 Claude', ok: true }, { t: '🌑 Grok', ok: false }], fb: 'Claude es el rey de la escritura larga con tono cuidado. Grok tiene más personalidad irreverente.' },
  { task: 'Investigar las últimas noticias sobre los incendios forestales de California citando medios reales.', opts: [{ t: '💬 ChatGPT (versión gratis)', ok: false }, { t: '🔎 Perplexity', ok: true }], fb: 'Perplexity siempre cita fuentes reales y busca en tiempo real.' },
  { task: 'Crear una imagen artística para la portada de un libro de fantasía, con estética cinematográfica.', opts: [{ t: '🎨 Midjourney', ok: true }, { t: '💬 ChatGPT (DALL-E)', ok: false }], fb: 'Midjourney tiene la estética más artística y cinematográfica del mercado.' },
  { task: 'Resumir un PDF corporativo de 60 páginas directamente dentro de Microsoft Word, sin salir del programa.', opts: [{ t: '💼 Microsoft Copilot', ok: true }, { t: '💬 Meta AI en WhatsApp', ok: false }], fb: 'Copilot vive dentro de Word y puede procesar el documento ahí mismo.' },
  { task: 'Preguntar a tus propios apuntes de clase de química (PDF) sin que la IA invente información fuera de ellos.', opts: [{ t: '📓 NotebookLM', ok: true }, { t: '✨ Gemini', ok: false }], fb: 'NotebookLM fue diseñado exactamente para esto: solo responde basándose en tus documentos.' },
  { task: 'Generar una canción completa con letra en español sobre un viaje a Cartagena.', opts: [{ t: '🎵 Suno', ok: true }, { t: '🎨 Midjourney', ok: false }], fb: 'Suno genera música completa con letra. Midjourney es para imágenes.' },
  { task: 'Consultar la última declaración de Elon Musk en X hoy mismo y ver qué están comentando los usuarios.', opts: [{ t: '🌑 Grok', ok: true }, { t: '🟣 Claude', ok: false }], fb: 'Grok tiene integración directa con X y acceso en tiempo real a la plataforma.' },
  { task: 'Clonar la voz de un estudiante con parálisis para que pueda comunicarse con su propio timbre de voz.', opts: [{ t: '🎤 ElevenLabs', ok: true }, { t: '🔎 Perplexity', ok: false }], fb: 'ElevenLabs es líder en clonación de voz. Con 1-3 minutos de audio replica la voz.' },
  { task: 'Charlar rápido por WhatsApp con una IA para pedir una receta de pasta, sin descargar otra app.', opts: [{ t: '💬 Meta AI (dentro de WhatsApp)', ok: true }, { t: '🖥️ Ollama local', ok: false }], fb: 'Meta AI vive dentro de WhatsApp — no necesitas descargar nada.' },
  { task: 'Generar un clip de video de 6 segundos donde un dragón vuela sobre montañas para tu video corto.', opts: [{ t: '🎬 Runway o Sora', ok: true }, { t: '🟣 Claude', ok: false }], fb: 'Runway y Sora generan video desde texto. Claude es solo texto e imágenes.' },
  { task: 'Analizar en Gmail los correos de la última semana y hacer un resumen de los más importantes, sin salir de Gmail.', opts: [{ t: '✨ Gemini (integrado a Gmail)', ok: true }, { t: '🟣 Claude', ok: false }], fb: 'Gemini vive dentro del ecosistema Google. Puede resumir correos sin salir de Gmail.' },
  { task: 'Programar una función en Python mientras trabajas dentro del editor Visual Studio Code.', opts: [{ t: '💬 Meta AI', ok: false }, { t: '🐙 GitHub Copilot', ok: true }], fb: 'GitHub Copilot vive dentro del editor, sugiriendo código en tiempo real.' },
  { task: 'Crear una miniatura llamativa con estilo cinematográfico para un video de YouTube sobre misterios de las pirámides.', opts: [{ t: '🎨 Midjourney', ok: true }, { t: '🎤 ElevenLabs', ok: false }], fb: 'Midjourney es referencia en estética cinematográfica. ElevenLabs es solo para voz.' },
  { task: 'Un escritor quiere que una IA analice las últimas 150 páginas de su novela y le dé feedback detallado sin perder contexto.', opts: [{ t: '🟣 Claude', ok: true }, { t: '💬 Meta AI', ok: false }], fb: 'Claude maneja textos MUY largos sin olvidar lo del principio.' },
  { task: 'Un adolescente quiere probar una IA totalmente gratis, sin descargar nada, desde el celular de su mamá.', opts: [{ t: '💼 Copilot empresarial', ok: false }, { t: '💬 Meta AI en WhatsApp', ok: true }], fb: 'Meta AI en WhatsApp es gratis, no requiere descargas ni cuentas nuevas.' },
  { task: 'Una diseñadora gráfica quiere quitar el fondo a una foto y rellenar partes que faltan, dentro de Photoshop.', opts: [{ t: '🖌️ Adobe Firefly (en Photoshop)', ok: true }, { t: '🌑 Grok', ok: false }], fb: 'Firefly está integrado a Photoshop con herramientas como "relleno generativo".' },
  { task: 'Crear un podcast de 15 minutos con dos voces IA que discutan tus propios apuntes escolares.', opts: [{ t: '📓 NotebookLM', ok: true }, { t: '🎵 Suno', ok: false }], fb: 'NotebookLM genera un podcast realista con dos voces IA discutiendo tus documentos.' },
  { task: 'Un estudiante de arquitectura quiere ver varias ideas visuales de una casa con estilo japonés moderno antes de diseñarla.', opts: [{ t: '🎨 Midjourney', ok: true }, { t: '🔎 Perplexity', ok: false }], fb: 'Midjourney es ideal para generar referencias visuales rápidas con estilos específicos.' },
  { task: 'Un youtuber quiere narrar sus videos con una voz profesional sin tener que grabarse él mismo.', opts: [{ t: '🎤 ElevenLabs', ok: true }, { t: '🐙 GitHub Copilot', ok: false }], fb: 'ElevenLabs es la mejor para narraciones profesionales con voces naturales.' },
  { task: 'Analizar un Excel enorme con miles de filas de ventas y sacar un resumen con gráficos, sin salir del Excel.', opts: [{ t: '💼 Microsoft Copilot (en Excel)', ok: true }, { t: '🌑 Grok', ok: false }], fb: 'Copilot vive dentro de Excel y puede analizar tablas, crear gráficos y extraer insights.' }
];

const PC_DATA: PCItem[] = [
  {
    task: 'Resume "Cien años de soledad" en 5 líneas manteniendo el tono mágico del libro.',
    responses: [
      { who: '💬 ChatGPT', text: 'Cien años de soledad es una novela de Gabriel García Márquez que narra la historia de la familia Buendía en Macondo. Explora temas como el amor, la guerra y el destino. Los personajes repiten nombres y patrones. Se destaca por su realismo mágico. Es una obra maestra de la literatura latinoamericana.' },
      { who: '🟣 Claude', text: 'En Macondo, pueblo nacido de la niebla y los sueños, siete generaciones de Buendía cargan el peso de sus propios fantasmas. Los mismos nombres se repiten como ecos, la misma soledad se hereda como maldición. Un gitano trae imanes y hielo; una mujer asciende al cielo tendiendo sábanas. Y al final, Macondo será barrido por el viento como si nunca hubiera existido.' },
      { who: '🔎 Perplexity', text: 'Según Wikipedia [1] y la RAE [2], "Cien años de soledad" es una novela publicada en 1967 por Gabriel García Márquez. Narra la historia de la familia Buendía durante siete generaciones en Macondo. Es considerada una de las más importantes del realismo mágico [3].' }
    ],
    q: '¿Cuál respuesta captó mejor el tono mágico que pedía la tarea?',
    opts: [{ t: '💬 ChatGPT — informativo pero plano', ok: false }, { t: '🟣 Claude — literario y evocador', ok: true }, { t: '🔎 Perplexity — precisa pero fría', ok: false }],
    fb: 'Claude capturó el tono mágico porque escribe con atmósfera propia. Para tareas creativas con tono específico, Claude gana.'
  },
  {
    task: '¿Cuántas medallas de oro ganó Colombia en los Juegos Olímpicos de París 2024?',
    responses: [
      { who: '💬 ChatGPT (datos 2023)', text: 'Lo siento, mi información tiene fecha de corte anterior y no tengo datos específicos sobre los Juegos Olímpicos de París 2024.' },
      { who: '🟣 Claude', text: 'No tengo información confirmada sobre el medallero final de Colombia en París 2024. Te recomiendo consultar fuentes oficiales.' },
      { who: '🔎 Perplexity', text: 'Según El Tiempo [1], Marca [2] y el COI [3], Colombia obtuvo 1 medalla de oro en París 2024 (Ángel Barajas en gimnasia artística). Total: 4 medallas (1 oro, 1 plata, 2 bronces).' }
    ],
    q: '¿Cuál respuesta es la más útil para un estudiante haciendo un trabajo con fuentes citables?',
    opts: [{ t: '💬 ChatGPT — admite no saber', ok: false }, { t: '🟣 Claude — admite no saber', ok: false }, { t: '🔎 Perplexity — da el dato con fuentes', ok: true }],
    fb: 'Para datos factuales recientes con fuentes citables, Perplexity es la única que cumple.'
  }
];

interface LevelProps { navigation?: any; setAllowBack?: (allow: boolean) => void; }

export default function World4Level7({ navigation: propsNavigation, setAllowBack }: LevelProps) {
  const nav = useNavigation();
  const navigation = propsNavigation || nav;
  const completeLevel = useGameStore(s => s.completeLevel);

  const [currentPart, setCurrentPart] = useState(1);
  const [xp, setXp] = useState(0);
  const [totalCorrect, setTotalCorrect] = useState(0);

  // Pools barajadas (se fijan al montar)
  const quizData = useRef([...QUIZ_POOL].sort(() => Math.random() - 0.5).slice(0, 15)).current;
  const tourData = useRef([...TOUR_POOL].sort(() => Math.random() - 0.5).slice(0, 10)).current;

  // Barajar opciones de cada quiz y actualizar índice correcto
  const quizDataShuffled = useRef(quizData.map(q => {
    const correctText = q.opts[q.c];
    const shuffled = [...q.opts].sort(() => Math.random() - 0.5);
    return { ...q, opts: shuffled, c: shuffled.indexOf(correctText) };
  })).current;

  // Barajar opciones de torneo
  const tourDataShuffled = useRef(tourData.map(t => ({
    ...t,
    opts: [...t.opts].sort(() => Math.random() - 0.5)
  }))).current;

  // Part 1 - Quiz
  const [quizAnswers, setQuizAnswers] = useState<{ [key: number]: number }>({});
  const [quizChecked, setQuizChecked] = useState(false);

  // Part 2 - Torneo
  const [tourAnswers, setTourAnswers] = useState<{ [key: number]: number }>({});
  const [tourChecked, setTourChecked] = useState(false);

  // Part 3 - Prompt Compare
  const [pcAnswers, setPcAnswers] = useState<{ [key: number]: number }>({});
  const [pcChecked, setPcChecked] = useState(false);

  // Part 4 - Toolkit Builder
  const [toolkitText, setToolkitText] = useState('');
  const [toolkitDone, setToolkitDone] = useState(false);

  // Part 5 - Reflection
  const [reflectionText, setReflectionText] = useState('');
  const [reflectionDone, setReflectionDone] = useState(false);

  useEffect(() => { setAllowBack?.(true); }, []);
  useEffect(() => {
    const h = BackHandler.addEventListener('hardwareBackPress', () => {
      Alert.alert('Salir', '¿Abandonar la evaluación?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Salir', onPress: () => router.back() }]);
      return true;
    });
    return () => h.remove();
  }, []);

  const addXP = (v: number) => setXp(p => p + v);

  // Quiz
  const selectQuiz = (i: number, j: number) => {
    if (quizChecked) return;
    setQuizAnswers(p => ({ ...p, [i]: j }));
  };
  const checkQuiz = () => {
    setQuizChecked(true);
    let correct = 0;
    quizDataShuffled.forEach((q, i) => { if (quizAnswers[i] === q.c) correct++; });
    setTotalCorrect(p => p + correct);
    addXP(Math.round((correct / 15) * 80));
    Alert.alert('Resultado', `${correct}/15 correctas. +${Math.round((correct/15)*80)} XP`, [{ text: 'OK' }]);
  };

  // Torneo
  const selectTour = (i: number, j: number) => {
    if (tourChecked) return;
    setTourAnswers(p => ({ ...p, [i]: j }));
  };
  const checkTour = () => {
    setTourChecked(true);
    let correct = 0;
    tourDataShuffled.forEach((t, i) => {
      const ans = tourAnswers[i];
      if (ans !== undefined && t.opts[ans].ok) correct++;
    });
    setTotalCorrect(p => p + correct);
    addXP(Math.round((correct / 10) * 50));
    Alert.alert('Resultado', `${correct}/10 rondas ganadas. +${Math.round((correct/10)*50)} XP`, [{ text: 'OK' }]);
  };

  // Prompt Compare
  const selectPC = (i: number, j: number) => {
    if (pcChecked) return;
    setPcAnswers(p => ({ ...p, [i]: j }));
  };
  const checkPC = () => {
    setPcChecked(true);
    let correct = 0;
    PC_DATA.forEach((p, i) => {
      const ans = pcAnswers[i];
      if (ans !== undefined && p.opts[ans].ok) correct++;
    });
    setTotalCorrect(p => p + correct);
    addXP(Math.round((correct / 2) * 40));
    Alert.alert('Resultado', `${correct}/2 análisis correctos. +${Math.round((correct/2)*40)} XP`, [{ text: 'OK' }]);
  };

  // Toolkit
  const checkToolkit = () => {
    if (toolkitText.trim().length < 80) return;
    setToolkitDone(true);
    setTotalCorrect(p => p + 1);
    addXP(30);
    Alert.alert('✅', '¡Toolkit diseñado!', [{ text: 'OK' }]);
  };

  // Reflection
  const submitReflection = () => {
    if (reflectionText.trim().length < 40) return;
    setReflectionDone(true);
    addXP(20);
    Alert.alert('🔒', '¡Reflexión sellada!', [{ text: 'OK' }]);
  };

  const goToNextPart = () => {
    if (currentPart < 5) setCurrentPart(p => p + 1);
    else setCurrentPart(6); // completion
  };

  const finish = () => {
    const total = 15 + 10 + 2 + 2; // quiz + tour + pc + builder + reflection
    const pct = Math.round((totalCorrect / total) * 100);
    let stars = pct >= 85 ? 3 : pct >= 70 ? 2 : 1;
    completeLevel(4, 7, stars, xp);
    router.back();
  };

  const canAdvance = currentPart === 1 ? quizChecked : currentPart === 2 ? tourChecked : currentPart === 3 ? pcChecked : currentPart === 4 ? toolkitDone : currentPart === 5 ? reflectionDone : false;

  // ========== RENDER ==========
  const renderPart1 = () => (
    <View style={styles.partContainer}>
      <View style={styles.partBadge}><Text style={styles.partBadgeText}>📝 Parte 1 de 5</Text></View>
      <Text style={styles.partTitle}>Quiz — 15 preguntas del torneo</Text>
      <Text style={styles.partDesc}>Preguntas sobre ChatGPT, Claude, Gemini, Grok y el ecosistema completo.</Text>
      {quizDataShuffled.map((q, i) => (
        <View key={i} style={styles.quizItem}>
          <Text style={styles.quizNum}>Pregunta {i+1} de 15</Text>
          <Text style={styles.quizText}>{q.q}</Text>
          {q.opts.map((o, j) => (
            <TouchableOpacity key={j} style={[styles.quizOpt, quizAnswers[i] === j && styles.quizOptSel, quizChecked && j === q.c && styles.optCorrect, quizChecked && quizAnswers[i] === j && j !== q.c && styles.optWrong]}
              onPress={() => selectQuiz(i, j)} disabled={quizChecked}>
              <Text style={styles.quizOptText}>{['🅐','🅑','🅒','🅓'][j]} {o}</Text>
            </TouchableOpacity>
          ))}
          {quizChecked && <Text style={styles.feedbackSmall}>{quizAnswers[i] === q.c ? '✅ ' : '❌ '}{q.fb}</Text>}
        </View>
      ))}
      {!quizChecked && (
        <TouchableOpacity style={styles.btnPrimary} onPress={checkQuiz}>
          <Text style={styles.btnText}>Verificar respuestas →</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderPart2 = () => (
    <View style={styles.partContainer}>
      <View style={styles.partBadge}><Text style={styles.partBadgeText}>⚔️ Parte 2 de 5</Text></View>
      <Text style={styles.partTitle}>Torneo — 10 rondas de decisión</Text>
      <Text style={styles.partDesc}>Para cada tarea, 2 herramientas. Elige la correcta.</Text>
      {tourDataShuffled.map((t, i) => (
        <View key={i} style={styles.tourItem}>
          <Text style={styles.tourRound}>Ronda {i+1} de 10</Text>
          <Text style={styles.tourTask}>{t.task}</Text>
          <View style={styles.tourBtns}>
            {t.opts.map((o, j) => (
              <TouchableOpacity key={j} style={[styles.tourBtn, tourAnswers[i] === j && styles.tourBtnSel, tourChecked && o.ok && styles.tourBtnOk, tourChecked && tourAnswers[i] === j && !o.ok && styles.tourBtnFail]}
                onPress={() => selectTour(i, j)} disabled={tourChecked}>
                <Text style={styles.tourBtnText}>{o.t}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {tourChecked && <Text style={styles.feedbackSmall}>{t.opts[tourAnswers[i]]?.ok ? '✅ ' : '❌ '}{t.fb}</Text>}
        </View>
      ))}
      {!tourChecked && (
        <TouchableOpacity style={styles.btnPrimary} onPress={checkTour}>
          <Text style={styles.btnText}>Verificar →</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderPart3 = () => (
    <View style={styles.partContainer}>
      <View style={styles.partBadge}><Text style={styles.partBadgeText}>🔬 Parte 3 de 5</Text></View>
      <Text style={styles.partTitle}>Prompt Compare — Misma tarea, 3 herramientas</Text>
      <Text style={styles.partDesc}>Analiza los resultados y elige cuál respondió mejor.</Text>
      {PC_DATA.map((p, i) => (
        <View key={i} style={styles.pcTask}>
          <Text style={styles.pcTaskTitle}>Tarea {i+1}</Text>
          <Text style={styles.pcTaskText}>{p.task}</Text>
          {p.responses.map((r, j) => (
            <View key={j} style={styles.pcCard}>
              <Text style={styles.pcCardWho}>{r.who}</Text>
              <Text style={styles.pcCardText}>"{r.text}"</Text>
            </View>
          ))}
          <Text style={styles.pcQ}>{p.q}</Text>
          {p.opts.map((o, j) => (
            <TouchableOpacity key={j} style={[styles.quizOpt, pcAnswers[i] === j && styles.quizOptSel, pcChecked && o.ok && styles.optCorrect, pcChecked && pcAnswers[i] === j && !o.ok && styles.optWrong]}
              onPress={() => selectPC(i, j)} disabled={pcChecked}>
              <Text style={styles.quizOptText}>{o.t}</Text>
            </TouchableOpacity>
          ))}
          {pcChecked && <Text style={styles.feedbackSmall}>{p.opts[pcAnswers[i]]?.ok ? '✅ ' : '❌ '}{p.fb}</Text>}
        </View>
      ))}
      {!pcChecked && (
        <TouchableOpacity style={styles.btnPrimary} onPress={checkPC}>
          <Text style={styles.btnText}>Verificar análisis →</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderPart4 = () => (
    <View style={styles.partContainer}>
      <View style={styles.partBadge}><Text style={styles.partBadgeText}>🧰 Parte 4 de 5</Text></View>
      <Text style={styles.partTitle}>Builder — Tu toolkit definitivo</Text>
      <Text style={styles.partDesc}>Arma el kit perfecto para un estudiante. Máximo 4 herramientas. Justifica cada elección.</Text>
      <View style={styles.toolkitPills}>
        {['ChatGPT','Claude','Gemini','Grok','Perplexity','NotebookLM','Copilot','Meta AI','Midjourney','DALL-E','Suno','ElevenLabs','Runway'].map(t => (
          <View key={t} style={styles.toolkitPill}><Text style={styles.toolkitPillText}>{t}</Text></View>
        ))}
      </View>
      <TextInput style={styles.textArea} placeholder="Mi toolkit:&#10;1. [Herramienta] — [Para qué y por qué]&#10;2. ...&#10;3. ...&#10;4. ..." value={toolkitText} onChangeText={setToolkitText} multiline editable={!toolkitDone} />
      {!toolkitDone && (
        <TouchableOpacity style={[styles.btnPrimary, toolkitText.trim().length < 80 && styles.btnDisabled]} onPress={checkToolkit} disabled={toolkitText.trim().length < 80}>
          <Text style={styles.btnText}>Enviar toolkit →</Text>
        </TouchableOpacity>
      )}
      {toolkitDone && <Text style={styles.feedback}>🧰 ¡Toolkit diseñado y guardado!</Text>}
    </View>
  );

  const renderPart5 = () => (
    <View style={styles.partContainer}>
      <View style={styles.partBadge}><Text style={styles.partBadgeText}>💭 Parte 5 de 5</Text></View>
      <Text style={styles.partTitle}>Reflexión sellada</Text>
      <Text style={styles.partDesc}>Tu última respuesta del Mundo 4. Sé honesto.</Text>
      <View style={styles.reflectionPrompt}>
        <Text style={styles.reflectionPromptText}>"¿Cómo cambió este mundo tu manera de usar las herramientas digitales? ¿Qué herramienta NO sabías que existía y ahora vas a usar? ¿Cuál usarías con tu familia?"</Text>
      </View>
      <TextInput style={styles.textArea} placeholder="Escribe tu reflexión aquí..." value={reflectionText} onChangeText={setReflectionText} multiline editable={!reflectionDone} />
      {!reflectionDone && (
        <TouchableOpacity style={[styles.btnPrimary, reflectionText.trim().length < 40 && styles.btnDisabled]} onPress={submitReflection} disabled={reflectionText.trim().length < 40}>
          <Text style={styles.btnText}>🔒 Sellar y completar</Text>
        </TouchableOpacity>
      )}
      {reflectionDone && <Text style={styles.feedback}>🔒 ¡Reflexión sellada!</Text>}
    </View>
  );

  const renderCompletion = () => {
    const total = 15 + 10 + 2 + 2;
    const pct = Math.round((totalCorrect / total) * 100);
    return (
      <View style={styles.completionContainer}>
        <View style={styles.completionCircle}>
          <Text style={styles.completionPct}>{pct}%</Text>
          <Text style={styles.completionLbl}>acierto</Text>
        </View>
        <View style={styles.badgeBox}>
          <Text style={styles.badgeIcon}>⚡</Text>
          <Text style={styles.badgeTitle}>Insignia: Campeón del Torneo</Text>
          <Text style={styles.badgeSub}>Mundo 4 — El Gran Torneo de Herramientas completado · N19–N24</Text>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statItem}><Text style={styles.statNum}>{totalCorrect}</Text><Text style={styles.statLbl}>Correctas</Text></View>
          <View style={styles.statItem}><Text style={styles.statNum}>{xp}</Text><Text style={styles.statLbl}>XP</Text></View>
          <View style={styles.statItem}><Text style={styles.statNum}>5</Text><Text style={styles.statLbl}>Partes</Text></View>
        </View>
        <Text style={styles.completionText}>¡Eres Campeón del Torneo! Conoces los 4 modelos líderes a fondo, el ecosistema completo, y sabes elegir la IA correcta para cada tarea.</Text>
        <TouchableOpacity style={styles.btnPrimary} onPress={finish}>
          <Text style={styles.btnText}>Volver al mapa</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderCurrentPart = () => {
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
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialIcons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.track}><View style={[styles.fill, { width: `${(currentPart/5)*100}%` }]} /></View>
        <Text style={styles.xpChip}>{xp} XP</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerSection}>
          <View style={styles.headerBadge}><Text style={styles.headerBadgeText}>🏆 EVALUACIÓN FINAL · MUNDO 4</Text></View>
          <Text style={styles.headerTitle}>El Gran Torneo de Herramientas</Text>
          <Text style={styles.headerSub}>5 partes · Demuestra que sabes elegir la IA correcta para cada tarea</Text>
        </View>
        {renderCurrentPart()}
        {canAdvance && currentPart <= 5 && (
          <TouchableOpacity style={[styles.btnPrimary, { alignSelf: 'center', marginTop: 16 }]} onPress={goToNextPart}>
            <Text style={styles.btnText}>Siguiente parte →</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  bar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  track: { flex: 1, height: 6, backgroundColor: colors.borderLight, borderRadius: 3, marginHorizontal: 12 },
  fill: { height: '100%', backgroundColor: '#06b6d4', borderRadius: 3 },
  xpChip: { ...typography.bold, fontSize: 14, color: '#06b6d4' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  headerSection: { alignItems: 'center', marginBottom: 24, padding: 20, backgroundColor: '#001225', borderRadius: 20, borderWidth: 1, borderColor: '#003a5f' },
  headerBadge: { backgroundColor: '#06b6d4', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 99, marginBottom: 12 },
  headerBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  headerTitle: { ...typography.extraBold, fontSize: 24, color: '#ecfeff' },
  headerSub: { color: '#7dd3fc', fontSize: 13, marginTop: 6 },
  partContainer: { flex: 1 },
  partBadge: { backgroundColor: '#002048', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 12, borderWidth: 1, borderColor: '#003a5f' },
  partBadgeText: { color: '#67e8f9', fontSize: 11, fontWeight: '700' },
  partTitle: { ...typography.extraBold, fontSize: 18, color: colors.textPrimary, marginBottom: 4 },
  partDesc: { fontSize: 13, color: colors.textSecondary, marginBottom: 16, lineHeight: 18 },
  quizItem: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  quizNum: { fontSize: 10, fontWeight: '700', color: '#64748b', marginBottom: 4, textTransform: 'uppercase' },
  quizText: { fontSize: 13, fontWeight: '600', color: '#0f172a', marginBottom: 10, lineHeight: 20 },
  quizOpt: { padding: 10, borderRadius: 10, borderWidth: 2, borderColor: '#e2e8f0', marginBottom: 4, flexDirection: 'row', alignItems: 'center', gap: 6 },
  quizOptSel: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
  quizOptText: { fontSize: 12, color: '#334155' },
  optCorrect: { borderColor: '#22c55e', backgroundColor: '#f0fdf4' },
  optWrong: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },
  feedbackSmall: { fontSize: 11, marginTop: 6, color: '#065f46', backgroundColor: '#f0fdf4', padding: 6, borderRadius: 6 },
  feedback: { marginTop: 10, padding: 12, borderRadius: 10, fontSize: 12, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#22c55e', color: '#065f46' },
  tourItem: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  tourRound: { fontSize: 10, fontWeight: '700', color: '#06b6d4', marginBottom: 4, textTransform: 'uppercase' },
  tourTask: { fontSize: 13, fontWeight: '600', color: '#0f172a', marginBottom: 8, lineHeight: 18 },
  tourBtns: { flexDirection: 'row', gap: 8 },
  tourBtn: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 2, borderColor: '#e2e8f0', alignItems: 'center' },
  tourBtnSel: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
  tourBtnOk: { borderColor: '#22c55e', backgroundColor: '#f0fdf4' },
  tourBtnFail: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },
  tourBtnText: { fontSize: 12, fontWeight: '600' },
  pcTask: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  pcTaskTitle: { fontSize: 11, fontWeight: '700', color: '#06b6d4', marginBottom: 4, textTransform: 'uppercase' },
  pcTaskText: { fontSize: 13, fontWeight: '600', color: '#0f172a', marginBottom: 10, lineHeight: 18 },
  pcCard: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  pcCardWho: { fontSize: 12, fontWeight: '700', color: '#06b6d4', marginBottom: 4 },
  pcCardText: { fontSize: 11, color: '#475569', lineHeight: 16, fontStyle: 'italic' },
  pcQ: { fontSize: 13, fontWeight: '600', color: '#0f172a', marginTop: 8, marginBottom: 8 },
  toolkitPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 12, backgroundColor: '#f8fafc', borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  toolkitPill: { backgroundColor: '#002048', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#3b82f6' },
  toolkitPillText: { fontSize: 11, fontWeight: '700', color: '#67e8f9' },
  textArea: { borderWidth: 1.5, borderColor: '#06b6d4', borderRadius: 12, padding: 14, minHeight: 120, fontSize: 13, backgroundColor: '#f0f9ff', marginBottom: 10, textAlignVertical: 'top' },
  reflectionPrompt: { backgroundColor: '#f0f9ff', borderLeftWidth: 4, borderLeftColor: '#06b6d4', borderRadius: 4, padding: 14, marginBottom: 12 },
  reflectionPromptText: { fontSize: 13, color: '#0e7490', fontStyle: 'italic', lineHeight: 20 },
  btnPrimary: { backgroundColor: '#06b6d4', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  btnText: { ...typography.bold, color: '#fff', fontSize: 15 },
  btnDisabled: { opacity: 0.4 },
  completionContainer: { alignItems: 'center', padding: 20 },
  completionCircle: { width: 130, height: 130, borderRadius: 65, backgroundColor: '#f0f9ff', borderWidth: 4, borderColor: '#06b6d4', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  completionPct: { fontSize: 28, fontWeight: '800', color: '#06b6d4' },
  completionLbl: { fontSize: 11, color: '#7dd3fc' },
  badgeBox: { backgroundColor: '#f0f9ff', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#06b6d4' },
  badgeIcon: { fontSize: 48, marginBottom: 8 },
  badgeTitle: { fontSize: 16, fontWeight: '800', color: '#0e7490', textAlign: 'center' },
  badgeSub: { fontSize: 12, color: '#06b6d4', marginTop: 4, textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: 16, marginBottom: 20 },
  statItem: { backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', minWidth: 80 },
  statNum: { fontSize: 20, fontWeight: '800', color: '#06b6d4' },
  statLbl: { fontSize: 10, color: '#64748b', marginTop: 2 },
  completionText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginBottom: 16, lineHeight: 20 },
});