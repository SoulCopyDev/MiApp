import { exitLevel } from '../utils/exitLevel';
import { router } from 'expo-router';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { useReportProgress } from '../components/LevelProgress';
import { typography } from '../theme';
import XPToast from '../components/XPToast';
import { pickN, shuffle } from '../utils/shuffle';

// ═══════════════════════════════════════════════════════════
// Nivel 36 · Tú y la IA: Tu Misión en el Mundo (Mundo 6 · cierre del curso)
// Mundo 6 · TEMA CLARO (dorado/ámbar #d97706 + violeta #7c3aed).
// Reconstruido vs nivel-36.html (estándar v2.2). Fuente de verdad = HTML.
// 21 módulos de contenido (steps 1-21) — el HTML dice "19" y rotula
// "Módulo 20 de 19" (§21). Máx XP real = 413; el HTML dice 250 (§25).
// Al terminar navega a /eval/6 (Evaluación Mundo 6), no al mapa.
// ═══════════════════════════════════════════════════════════

const P = {
  screen: '#ffffff',
  ink: '#111827', body: '#374151', muted: '#6b7280', faint: '#9ca3af',
  gold: '#d97706', goldDark: '#92400e', goldBright: '#f59e0b',
  goldBg: '#fffbeb', goldBorder: '#fde68a',
  violet: '#7c3aed', violetDark: '#5b21b6', violetBg: '#faf5ff', violetBorder: '#e9d5ff',
  border: '#e5e7eb', cardBg: '#f9fafb',
  green: '#16a34a', greenBg: '#dcfce7', greenText: '#166534', greenSoft: '#f0fdf4', greenBorder: '#bbf7d0',
  red: '#dc2626', redBg: '#fef2f2', redText: '#991b1b', redBorder: '#fecaca',
  amberBg: '#fef3c7', amberText: '#92400e', amberBorder: '#fde68a',
  orangeBg: '#fff7ed', orangeText: '#9a3412',
  skyBg: '#eff6ff', skyText: '#1e40af',
  codeBg: '#0f172a', codeText: '#e2e8f0', codeKey: '#fcd34d', codeEmpty: '#64748b',
};

const TOTAL_STEPS = 23;   // 0 intro · 1-21 módulos · 22 completado
const CONTENT_STEPS = 21;
// "Volver" solo en lecturas puras: teoría (1) + tarjetas expandibles (6, 11)
const THEORY_STEPS = new Set([0, 1, 6, 11]);
const MAX_XP = 413;       // 98 reflexiones + 40 perfil + 20 drag + 40 quiz + 15 match + 151 builders + 25 sprint + 12 escenario + 12 compare

type QuizQ = { q: string; opts: string[]; correct: number; explain: string };
type ProfileQ = { q: string; opts: string[] };   // sin respuesta correcta: el índice revela perfil
type SkillItem = { text: string; correct: 'domina' | 'mejora' | 'aprender' };
type MatchPair = { left: string; right: string };
type SprintItem = { text: string; good: boolean };
type PathChoice = { title: string; text: string; explain: string };
type BuilderConfig = { xp: number; rows: { key: string; label: string; opts: string[] }[] };
type ExCard = { emoji: string; name: string; how: React.ReactNode; fact: string };

const shuffleOpts = (q: QuizQ): QuizQ => {
  const paired = q.opts.map((opt, i) => ({ opt, isCorrect: i === q.correct }));
  for (let j = paired.length - 1; j > 0; j--) { const k = Math.floor(Math.random() * (j + 1)); [paired[j], paired[k]] = [paired[k], paired[j]]; }
  return { ...q, opts: paired.map((p) => p.opt), correct: paired.findIndex((p) => p.isCorrect) };
};
const normalizeText = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const looksRandom = (text: string): boolean => {
  const words = normalizeText(text).split(/\s+/).filter((w) => w.length > 0);
  if (words.length < 5) return true;
  if (new Set(words).size / words.length < 0.5) return true;
  const noVowel = words.filter((w) => w.length >= 3 && !/[aeiou]/.test(w)).length;
  return noVowel / words.length > 0.3;
};
// Diccionario del tema: cierre del curso, identidad, propósito, IA (§14)
const REFLECT_TERMS = ['ia', 'inteligencia artificial', 'curso', 'nivel', 'aprender', 'aprendi', 'aprendizaje', 'ensenar', 'estudiar', 'proyecto', 'construir', 'construi', 'crear', 'cree', 'herramienta', 'prompt', 'chatbot', 'app', 'codigo', 'programar', 'automatizacion', 'futuro', 'carrera', 'trabajo', 'profesion', 'estudio', 'universidad', 'mision', 'proposito', 'meta', 'sueno', 'cambio', 'cambiar', 'cambio', 'crecer', 'crecimiento', 'etica', 'honestidad', 'responsabilidad', 'compromiso', 'valores', 'impacto', 'ayudar', 'comunidad', 'gente', 'personas', 'familia', 'latam', 'latinoamerica', 'colombia', 'pais', 'mundo', 'sociedad', 'desigualdad', 'oportunidad', 'miedo', 'orgullo', 'esperanza', 'confianza', 'siento', 'sentir', 'creencia', 'habilidad', 'identidad', 'yo', 'mi'];
const containsTopic = (text: string): boolean => {
  const n = normalizeText(text);
  const words = n.split(/[^a-z0-9]+/).filter(Boolean);
  return REFLECT_TERMS.some((t) => (t.length <= 3 ? words.includes(t) : n.includes(t)));
};

// ── Test de perfil (sin respuesta correcta) ──
// El ÍNDICE de la opción es el perfil: 0 Creador · 1 Estratega · 2 Investigador · 3 Constructor.
// Por eso este módulo NO se baraja: el orden lleva el significado.
const PROFILES = [
  { emoji: '🎨', name: 'CREADOR', desc: 'Te emociona inventar. Tu instinto es preguntarte qué puedes hacer con cada idea nueva.' },
  { emoji: '🧭', name: 'ESTRATEGA', desc: 'Te emociona el porqué. Tu instinto es ver quién gana, quién pierde y qué decisión conviene.' },
  { emoji: '🔬', name: 'INVESTIGADOR', desc: 'Te emociona el cómo. Tu instinto es abrir la caja y entender el mecanismo por dentro.' },
  { emoji: '🛠️', name: 'CONSTRUCTOR', desc: 'Te emociona hacer. Tu instinto es levantar un prototipo y aprender construyendo.' },
];

const PROFILE_Q: ProfileQ[] = [
  { q: 'Cuando ves una idea nueva por primera vez, lo PRIMERO que piensas es:', opts: ['¿Cómo podría usarla yo creativamente?', '¿En qué situaciones esto resuelve algo importante?', '¿Cómo funciona realmente por dentro?', '¿Cómo lo construiría con mis propias manos?'] },
  { q: 'En el curso, lo que MÁS te emocionó hacer fue:', opts: ['Crear algo nuevo (imágenes, historias, apps)', 'Decidir qué herramienta usar para cada tarea', 'Entender cómo funciona la IA por dentro', 'Construir algo paso a paso desde cero'] },
  { q: 'Cuando algo no te sale, prefieres:', opts: ['Probar 5 enfoques creativos diferentes', 'Pensar bien la estrategia y volver con un plan claro', 'Investigar a fondo la causa real del problema', 'Construir prototipos rápidos hasta dar con la solución'] },
  { q: "Tu reacción a 'la IA va a cambiar el mundo' es:", opts: ['¡Genial! ¿Qué puedo crear con eso?', 'Interesante. ¿Quién gana, quién pierde, qué se hace?', 'Espera — ¿de qué exactamente estamos hablando?', 'Bien. ¿Cómo lo construyo yo?'] },
  { q: 'Si tuvieras 1 año libre con presupuesto, lo gastarías en:', opts: ['Un proyecto creativo masivo (libro, película, app)', 'Estudiar industrias y ver dónde la IA tendría más impacto', 'Investigación profunda en un tema específico', 'Construir 10 prototipos rápidos para validar ideas'] },
  { q: 'Lo que más te costó del curso fue:', opts: ['Elegir una sola idea entre todas las que se me ocurrían', 'Decidir qué herramienta convenía en cada situación', 'Entender bien los conceptos técnicos de fondo', 'Terminar lo que empezaba en vez de saltar a lo siguiente'] },
  { q: 'Si tuvieras que enseñar IA mañana, empezarías por:', opts: ['Mostrar algo espectacular hecho con IA para enganchar', 'Explicar para qué sirve y cuándo conviene usarla', 'Explicar cómo funciona antes de tocar nada', 'Poner a la gente a construir algo desde el minuto uno'] },
  { q: 'El elogio que más te gustaría recibir es:', opts: ['"Nunca se me habría ocurrido algo así"', '"Tenías razón en cómo había que enfocarlo"', '"Nadie lo había entendido tan a fondo"', '"Lo hiciste realidad, y funciona"'] },
];

const SKILLS_ITEMS: SkillItem[] = [
  { text: 'Escribir prompts efectivos con rol + contexto + formato', correct: 'domina' },
  { text: 'Distinguir IA estrecha de AGI', correct: 'domina' },
  { text: 'Crear imágenes con IA generativa (DALL-E, Midjourney)', correct: 'mejora' },
  { text: 'Diseñar un chatbot completo con system prompt', correct: 'domina' },
  { text: 'Hacer una app sin código (Lovable, Bubble)', correct: 'mejora' },
  { text: 'Programar manualmente en Python o JavaScript', correct: 'aprender' },
  { text: 'Identificar la herramienta correcta para cada tarea', correct: 'domina' },
  { text: 'Entender la ética de la IA y sus dilemas reales', correct: 'domina' },
  { text: 'Configurar automatizaciones con Zapier o Make', correct: 'mejora' },
  { text: 'Entender AlphaFold y CRISPR a nivel técnico', correct: 'aprender' },
  { text: 'Hacer un pitch profesional de 60 segundos', correct: 'mejora' },
  { text: 'Investigar y validar ideas con usuarios reales', correct: 'mejora' },
  { text: 'Construir un Foundation Model desde cero', correct: 'aprender' },
  { text: 'Identificar oportunidades de impacto con IA', correct: 'domina' },
];
const SKILL_ZONES: { key: 'domina' | 'mejora' | 'aprender'; label: string }[] = [
  { key: 'domina', label: '✅ Domino bien' },
  { key: 'mejora', label: '📈 Puedo mejorar' },
  { key: 'aprender', label: '🎯 Quiero aprender' },
];

const LEARNING_Q: QuizQ[] = [
  { q: 'Recurso GRATIS de altísima calidad para profundizar en IA:', opts: ['Fast.ai (deep learning completo y gratis), DeepLearning.AI y Khan Academy', 'Solo libros universitarios caros, porque el material bueno nunca es gratuito', 'Solo los cursos de universidades premium con matrícula de varios miles', 'No existen: todo el material serio está detrás de un muro de pago'], correct: 0, explain: 'Fast.ai es legendario: Jeremy Howard te lleva de cero a nivel profesional en meses, gratis.' },
  { q: 'Para programar de verdad con IA, deberías aprender:', opts: ['Python (el más usado en IA) + APIs (OpenAI, Anthropic) + un framework como FastAPI', 'Solo HTML y CSS, que son la base de cualquier desarrollo moderno serio', 'Solo Excel avanzado con macros, suficiente para procesar datos de modelos', 'Ningún lenguaje: hoy basta con escribir buenos prompts en lenguaje natural'], correct: 0, explain: 'Python domina la IA. Si vas en serio: Python básico → APIs → un proyecto real.' },
  { q: 'Para mantenerte ACTUALIZADO en IA:', opts: ['Newsletters (The Batch, Import AI), papers en arXiv y podcasts (Lex Fridman, Dwarkesh)', 'Solo Twitter/X, donde los investigadores publican todo lo importante primero', 'Solo TikTok e Instagram, que resumen los avances de forma rápida y clara', 'Esperar a que lo enseñen en el colegio o la universidad de forma estructurada'], correct: 0, explain: 'The Batch (DeepLearning.AI) es excelente y gratis. Los podcasts dan la profundidad que las redes no.' },
  { q: 'Cuando lees algo de IA y NO lo entiendes:', opts: ['Le pides a Claude o ChatGPT que te lo explique simple, e iteras hasta entenderlo', 'Te rindes y pasas a otro tema más sencillo para no perder el tiempo', 'Lo memorizas tal cual, aunque no captes el significado de fondo', 'Lees solo el resumen de Wikipedia y das el tema por entendido'], correct: 0, explain: 'Tienes IA para aprender IA. Úsala: pídele que baje el nivel hasta que te haga clic.' },
  { q: 'El mejor proyecto para aprender IA en serio es:', opts: ['Construir algo real que TÚ uses: un chatbot personal o una app para tu problema', 'Leer todos los libros de referencia antes de tocar una sola línea de código', 'Tomar la mayor cantidad de cursos posible y coleccionar certificados', 'Ver videos y tutoriales de forma continua hasta sentirte preparado'], correct: 0, explain: 'Aprender HACIENDO supera a aprender CONSUMIENDO, 10 a 1.' },
];

const MATCH_PAIRS: MatchPair[] = [
  { left: 'Creador (te emociona inventar)', right: 'AI Artist · Diseñador con IA · Director de cine generativo' },
  { left: 'Estratega (te emociona el porqué)', right: 'AI Product Manager · Consultor IA · Analista de políticas' },
  { left: 'Investigador (te emociona el cómo)', right: 'Investigador en alineación · Científico de datos · Bioinformática' },
  { left: 'Constructor (te emociona hacer)', right: 'Ingeniero ML · Desarrollador full-stack con IA · Fundador' },
  { left: 'Conector (te emociona unir disciplinas)', right: 'Educador IA · Periodista tecnológico · Curador de contenido' },
  { left: 'Sanador (te emociona ayudar)', right: 'Médico con IA · Psicólogo digital · Educador en zonas vulnerables' },
];

const EXPLAIN_SPRINT_ITEMS: SprintItem[] = [
  { text: '"IA es inteligencia artificial. Listo." (vacío)', good: false },
  { text: '"Es como un cerebro hecho con números que aprendió de millones de textos"', good: true },
  { text: '"Hace cosas mágicas que no se explican" (mistificación)', good: false },
  { text: '"ChatGPT, Claude y Gemini son ejemplos famosos. Cada uno tiene fortalezas distintas"', good: true },
  { text: '"Va a destruirnos pronto" (pesimismo simplista)', good: false },
  { text: '"Puede ayudar con tareas, escribir, crear imágenes y analizar datos, pero NO es perfecta"', good: true },
  { text: '"Solo gente muy inteligente puede usarla" (elitismo falso)', good: false },
  { text: '"Lo importante es saber qué pedir y cómo. Dale contexto y ejemplos"', good: true },
  { text: '"Es solo un truco con números, no entiende nada" (reduccionismo)', good: false },
  { text: '"Puede equivocarse: siempre verifica lo importante, como con cualquier herramienta potente"', good: true },
];
const SPRINT_GOAL = 5;
const SPRINT_SECONDS = 90;

// Los 4 caminos son TODOS válidos por diseño: se premia elegir y justificar, no acertar.
const PATHS_SCN: PathChoice[] = [
  { title: 'CAMINO CREAR · Construir productos y contenido con IA', text: 'Te dedicas a hacer cosas — apps, contenido, arte, herramientas — usando la IA como copiloto.', explain: 'Camino válido si tu emoción es construir. Lovable, Bolt, Bubble y Cursor son tu kit natural.' },
  { title: 'CAMINO ESTUDIAR · Profundizar académicamente', text: 'Te dedicas a entender — universidad, posgrado, investigación. Te enfocas en alineación, ML técnico y ética.', explain: 'Camino válido si tu emoción es entender a fondo. Recursos: Fast.ai gratis, MOOCs de Coursera.' },
  { title: 'CAMINO ENSEÑAR · Conectar a la gente con la IA', text: 'Te dedicas a comunicar — videos, cursos, talleres, escritos. Tu valor es traducir la complejidad.', explain: 'Camino subestimado pero crítico. La IA cambia tan rápido que necesitamos comunicadores con urgencia.' },
  { title: 'CAMINO HÍBRIDO · Combinar varios caminos', text: 'Quizás creas Y enseñas, o estudias Y construyes. Tu valor está en el cruce de disciplinas.', explain: 'Probablemente el más realista. La diferenciación está en la combinación, no en la pureza.' },
];
const COMPARE_EXPLAIN = "La versión 'después' eres TÚ ahora. El cambio NO es trivial: requirió tiempo, esfuerzo y decisiones de seguir cuando algo no salía. Reconócelo. Celebra. Sigue construyendo.";

const BUILDER_LETTER: BuilderConfig = { xp: 30, rows: [
  { key: 'edad', label: 'Tu edad en 10 años', opts: ['22-25 años (universidad terminada, primer trabajo)', '26-30 años (carrera consolidándose)', '31-35 años (madurez profesional inicial)', 'Otra edad'] },
  { key: 'vida', label: 'Cómo será tu vida cotidiana', opts: ['Construyo cosas con IA cada día — soy creador de soluciones reales', 'Tomo decisiones estratégicas usando la IA como herramienta', 'Investigo y enseño sobre IA — soy referente intelectual', 'Vivo con balance: uso IA pero priorizo las conexiones humanas'] },
  { key: 'logro', label: 'El logro más importante que esperas', opts: ['Construir algo (app, proyecto, empresa) que mejore la vida de muchos', 'Tener voz e influencia en cómo se desarrolla la IA en LATAM', 'Generar conocimiento original (libro, paper, descubrimiento)', 'Vivir bien y tener tiempo para los que amo'] },
  { key: 'consejo', label: 'El consejo más importante que te darías HOY', opts: ['No esperes: empieza a construir AHORA, lo perfecto es enemigo de lo bueno', 'Cuida tu salud mental: la velocidad no es excusa para descuidarte', 'Mantén la curiosidad: el día que dejes de aprender, dejas de crecer', 'No olvides quién eres: la tecnología es herramienta, no identidad'] },
] };

const BUILDER_MANIFESTO: BuilderConfig = { xp: 30, rows: [
  { key: 'c1', label: 'Compromiso 1 · Sobre HONESTIDAD', opts: ['Voy a declarar SIEMPRE cuando use IA en algo que comparto', 'No voy a presentar trabajo de IA como si fuera 100% mío', 'Voy a verificar la información antes de compartirla', 'No voy a usar IA para engañar a personas que confían en mí'] },
  { key: 'c2', label: 'Compromiso 2 · Sobre RESPONSABILIDAD', opts: ['No voy a crear contenido dañino o sesgado con IA', 'Voy a pensar en las consecuencias antes de automatizar algo importante', 'No voy a usar IA para reemplazar la conexión humana real', 'Voy a respetar la privacidad, la propia y la de otros'] },
  { key: 'c3', label: 'Compromiso 3 · Sobre CRECIMIENTO', opts: ['Voy a seguir aprendiendo IA, sin quedar atrapado en lo que ya sé', 'Voy a CRITICAR la IA cuando se equivoque, no solo aceptarla', 'Voy a aprender disciplinas humanas (filosofía, arte, historia)', 'Voy a equilibrar la IA con habilidades manuales, físicas y humanas'] },
  { key: 'c4', label: 'Compromiso 4 · Sobre IMPACTO', opts: ['Voy a usar IA para resolver problemas REALES, no solo entretenimiento', 'Voy a ayudar a otros a aprender IA, sin acaparar el conocimiento', 'Voy a apoyar una IA accesible para LATAM, no solo para ricos', 'Voy a construir al menos UN proyecto que ayude a alguien concreto'] },
  { key: 'c5', label: 'Compromiso 5 · Sobre TI MISMO', opts: ['Voy a cuidar mi salud mental aunque la velocidad de la IA agote', 'Voy a recordar que SOY humano: no necesito competir con máquinas', 'Voy a mantener relaciones reales, no solo digitales o con IA', 'Voy a celebrar mis logros, no solo perseguir el siguiente'] },
] };

const BUILDER_FAV: BuilderConfig = { xp: 22, rows: [
  { key: 'tipo', label: 'Tipo de proyecto que más te marcó', opts: ['Algo creativo (una imagen, una historia, una app que diseñé)', 'Algo estratégico (mi pitch, mi plan, mi análisis ético)', 'Algo investigativo (entender LLMs, AGI, AlphaFold)', 'Algo construido (chatbot, automatización, manifiesto)', 'Algo reflexivo (mis cartas, mis decisiones, mi narrativa)'] },
  { key: 'razon', label: 'Por qué fue el más importante', opts: ['Cambió cómo veo la tecnología desde dentro', 'Cambió cómo veo a la humanidad y su futuro', 'Cambió cómo me veo a mí mismo y mis posibilidades', 'Cambió mi visión sobre LATAM, mi país o mi comunidad', 'Cambió mi sentido de propósito y dirección'] },
  { key: 'uso', label: 'Cómo lo voy a usar de aquí en adelante', opts: ['Como referencia constante de mi estándar de calidad', 'Como semilla para un proyecto más grande', 'Como ejemplo cuando le enseñe a otros', 'Como recordatorio de quién soy en momentos difíciles', 'Como punto de partida para mi siguiente etapa'] },
] };

const BUILDER_MURAL: BuilderConfig = { xp: 22, rows: [
  { key: 'frase', label: 'Frase central de TU misión', opts: ['Construir tecnología que cure, no solo que entretenga', 'Hacer la IA accesible en español para Latinoamérica', 'Conectar arte humano y código artificial sin perder el alma', 'Educar a los niños en IA antes de que la IA los eduque a ellos', 'Otra frase'] },
  { key: 'imagen', label: 'Imagen visual de tu aporte', opts: ['Un puente entre dos mundos (humano e IA)', 'Una mano que extiende algo a otra mano (compartir)', 'Un árbol creciendo con raíces fuertes (paciencia)', 'Un faro en la noche (orientar a otros)', 'Otra imagen'] },
  { key: 'promesa', label: 'Tu promesa al mural', opts: ['Voy a usar IA para reducir la desigualdad, no para aumentarla', 'Voy a enseñar lo que aprenda, sin acaparar el conocimiento', 'Voy a construir aunque empiece pequeño', 'Voy a recordar siempre que soy humano antes que tecnólogo', 'Otra promesa'] },
] };

const BUILDER_SHARE: BuilderConfig = { xp: 22, rows: [
  { key: 'hook', label: 'Primera frase (gancho honesto)', opts: ['"Acabo de terminar un curso de IA de 36 niveles. Esto fue lo más importante que aprendí:"', '"Hace 6 meses pensaba que la IA iba a destruirnos. Hoy sé que depende de mí (y de ti)."', '"Construí mi primer chatbot, mi primera app sin código y mi primer pitch."', '"36 niveles después sé MENOS de IA, pero lo entiendo mucho más profundo."'] },
  { key: 'lesson', label: 'Tu lección más valiosa (1 frase)', opts: ['La IA es una herramienta potente, pero NO sustituye el juicio crítico ni la ética', 'Construir con IA es accesible: el límite ya no es saber programar, es saber qué construir', 'El futuro NO está escrito; las decisiones de los próximos 10 años nos tocan a TODOS', 'Mi voz importa: hablo español, conozco LATAM y sé de IA. Esa combinación vale'] },
  { key: 'intent', label: 'Lo que quieres crear ahora', opts: ['Un proyecto real con IA en los próximos 3 meses', 'Una comunidad de gente aprendiendo IA con propósito', 'Contenido educativo accesible en español para mi círculo', 'Una decisión de carrera o de estudios diferente'] },
  { key: 'cta', label: 'Tu llamada a otros', opts: ['"Si te interesa empezar, comenta y te paso recursos"', '"¿Qué proyecto con IA quisieras construir? Cuéntame en comentarios."', '"Comparto lo que aprendo. Sígueme si quieres ver mi viaje."', '"Quiero conocer a otros jóvenes en LATAM aprendiendo IA."'] },
] };

const BUILDER_THANKS: BuilderConfig = { xp: 25, rows: [
  { key: 'destinatario', label: 'Tu carta es para', opts: ['Una persona que te enseñó algo crucial', 'Tú mismo, más pequeño, antes de empezar el curso', 'Las personas que crearon las herramientas que usaste', 'Tu yo del futuro, dentro de 10 años', 'La IA misma, por el viaje compartido'] },
  { key: 'agradecimiento', label: 'Lo que más agradeces', opts: ['Por enseñarme a no rendirme cuando algo no salía', 'Por mostrarme que podía construir cosas reales', 'Por darme una herramienta que multiplica mis capacidades', 'Por dejarme experimentar sin juicio y sin costo', 'Por hacerme sentir parte de algo importante'] },
  { key: 'promesa', label: 'Lo que prometes a cambio', opts: ['Voy a honrar lo que aprendí construyendo cosas que importen', 'Voy a transmitir lo que recibí, sin acaparar el conocimiento', 'Voy a ser honesto cuando use IA, sin esconderlo', 'Voy a recordar de dónde vengo cuando llegue lejos', 'Voy a usar lo aprendido para reducir la desigualdad'] },
] };

const tagVariants = {
  intro: { box: { backgroundColor: P.goldBg }, text: { color: P.goldDark } },
  theory: { box: { backgroundColor: P.greenSoft }, text: { color: P.greenText } },
  example: { box: { backgroundColor: P.orangeBg }, text: { color: P.orangeText } },
  quiz: { box: { backgroundColor: P.amberBg }, text: { color: P.amberText } },
  reflect: { box: { backgroundColor: '#f3f4f6' }, text: { color: '#374151' } },
  sprint: { box: { backgroundColor: '#fee2e2' }, text: { color: '#991b1b' } },
  activity: { box: { backgroundColor: P.skyBg }, text: { color: P.skyText } },
  build: { box: { backgroundColor: P.violetBg }, text: { color: P.violetDark } },
} as const;
const Tag = ({ icon, label, variant }: { icon: string; label: string; variant: keyof typeof tagVariants }) => (
  <View style={[styles.tag, tagVariants[variant].box]}><Text style={[styles.tagText, tagVariants[variant].text]}>{icon}  {label}</Text></View>
);
const Title = ({ children }: { children: React.ReactNode }) => <Text style={styles.title}>{children}</Text>;
const Sub = ({ children }: { children: React.ReactNode }) => <Text style={styles.sub}>{children}</Text>;
const Body = ({ children }: { children: React.ReactNode }) => <Text style={styles.bodyText}>{children}</Text>;
const B = ({ children }: { children: React.ReactNode }) => <Text style={styles.bold}>{children}</Text>;

const EXAMPLES: { [k: number]: { icon: string; label: string; title: string; sub: string; cards: ExCard[] } } = {
  6: {
    icon: '🌎', label: 'Módulo 6 de 21 · Tu lugar', title: 'Problemas que necesitan personas como TÚ', sub: '4 áreas críticas con vacíos reales que tu generación puede llenar. Toca cada tarjeta 👆',
    cards: [
      { emoji: '🏥', name: 'Salud · La medicina del futuro necesita éticos digitales', how: <>Lo viste en N35: medicina con IA, CRISPR, longevidad. Pero <B>hace falta gente que piense bioética con base sólida</B>. No abogados que no entienden tecnología. No técnicos que no entienden ética. Personas con AMBOS lados.</>, fact: '⭐ Tu generación tiene una oportunidad única: aprende ética desde la adolescencia (este curso) y crece con IA. Esa combinación es escasa hoy y será valiosísima en 10 años.' },
      { emoji: '🌍', name: 'Planeta · Necesitamos científicos del clima con IA', how: <>N34 mostró agricultura precisa, predicción de desastres y optimización energética. Pero <B>se necesita gente que conecte ciencia climática REAL con IA REAL</B>. No solo programadores, no solo biólogos: híbridos.</>, fact: '⭐ Mariana Mazzucato lo llama "misiones": resolver problemas grandes exige gente que cruce disciplinas. Tu generación es la primera con herramientas de IA naturales, y eso es ventaja decisiva.' },
      { emoji: '📚', name: 'Educación · Tutores IA personalizados', how: <>N4 enseñó a usar IA para aprender. Imagina <B>cada niño del planeta con un tutor personalizado de altísima calidad</B>. Khan Academy lo intenta. Hace falta gente que diseñe experiencias educativas con IA, no programadores haciendo apps aburridas.</>, fact: '⭐ El obstáculo no es técnico, es pedagógico. Personas que entiendan cómo aprenden los humanos + diseñen con IA = revolución educativa real.' },
      { emoji: '⚖️', name: 'Desigualdad · Reducir brechas con IA', how: <>Entre todo lo aprendido hay una verdad incómoda: <B>la IA puede magnificar la desigualdad o reducirla</B>. Depende de quién la use y para qué. Se necesita gente joven, latina y diversa construyendo soluciones para LATAM, no solo para Silicon Valley.</>, fact: '⭐ Estás en una posición única: hablas español, conoces realidades latinoamericanas y sabes de IA con base ética. Muy poca gente reúne las tres cosas.' },
    ],
  },
  11: {
    icon: '🦸', label: 'Módulo 11 de 21 · Héroes', title: 'Los héroes de la IA · Y TÚ entre ellos', sub: '4 figuras históricas y una más: tú. La cadena no termina. Toca cada tarjeta 👆',
    cards: [
      { emoji: '🇬🇧', name: 'Alan Turing (1912-1954) · El padre', how: <>Matemático inglés. <B>Inventó las bases teóricas de toda la computación moderna</B>. En la Segunda Guerra Mundial descifró Enigma, el código nazi, salvando millones de vidas. Propuso el Test de Turing. Fue perseguido por ser homosexual y murió a los 41 años.</>, fact: '⭐ Lección humana: el genio NO basta — necesita una sociedad que lo acepte. Hoy Turing es recordado como héroe. Quizás el primer mártir de la era informática.' },
      { emoji: '🇨🇦', name: 'Geoffrey Hinton (1947-) · El padrino', how: <><B>Padre del deep learning</B> y Premio Turing 2018. Trabajó en Google durante 10 años. En 2023, a los 75, <B>renunció para poder hablar libremente sobre los riesgos de la IA</B>. Sigue activo, advirtiendo y orientando.</>, fact: '⭐ Lección de carácter: tener la convicción de advertir incluso sobre tu propia creación. Su renuncia generó un debate global. Es modelo de científico íntegro.' },
      { emoji: '🇨🇳', name: 'Fei-Fei Li (1976-) · La diversa', how: <>Profesora de Stanford, inmigrante china en EE.UU. <B>Creó ImageNet</B>, el dataset que detonó la revolución del deep learning en 2012. Defensora de una IA con valores humanos y líder visible del movimiento "Human-Centered AI".</>, fact: '⭐ Lección de diversidad: los grandes avances vienen de mentes diversas. Fei-Fei demuestra que la IA no debería ser exclusivamente blanca, masculina ni de Silicon Valley.' },
      { emoji: '🇬🇧', name: 'Demis Hassabis (1976-) · El soñador', how: <>Británico de origen chipriota-singapurense. Cofundó DeepMind y <B>llevó AlphaGo y AlphaFold hasta el Nobel de Química 2024</B>. Su misión declarada: "resolver la inteligencia y después usarla para resolver todo lo demás".</>, fact: '⭐ Lección de visión: tener un norte claro a más de 20 años. Hassabis lleva desde 2010 con la misma misión. Esa coherencia es lo que permite ejecutar lo imposible.' },
      { emoji: '🌎', name: 'TÚ (futuro inmediato)', how: <>Quizás no tienes un Premio Turing. Pero <B>recorriste 36 niveles, 6 mundos y decenas de proyectos</B>. Estás en una posición única para tu generación: hablas español, vives realidades latinoamericanas y sabes de IA con base sólida y ética.</>, fact: '⭐ Tu lección: los héroes empezaron como tú — curiosos, sin garantías, con voluntad. Tu nombre podría estar en esta lista dentro de 30 años. La cadena no termina aquí.' },
    ],
  },
};

const REFLECTIONS: { [k: number]: { tag: string; icon: string; question: React.ReactNode; placeholder: string; min: number; xp: number } } = {
  2: { tag: 'Tu emoción al llegar · +14 XP', icon: '🤔', min: 80, xp: 14, placeholder: 'Llegando al final, siento... Esta mezcla viene de... Lo que más resuena ahora es...', question: <><B>El último nivel del curso. Antes de cualquier reflexión guiada, hazte la pregunta más honesta:</B> ¿qué SIENTES llegando aquí? ¿Orgullo? ¿Vacío? ¿Miedo de que termine? ¿Ganas de seguir? ¿Cansancio mezclado con satisfacción? Sé honesto: esta es tu última reflexión antes del cierre formal.</> },
  5: { tag: 'Los 3 cambios que vendrán · +16 XP', icon: '🔮', min: 120, xp: 16, placeholder: '1. ... 2. ... 3. ...', question: <>¿Cuáles serán los <B>3 MAYORES cambios que la IA traerá a TU vida personal</B> en los próximos 10 años? No los más grandes del mundo — los más grandes para TI: tu forma de estudiar, tu trabajo, tu manera de crear, tus relaciones, tu salud.{'\n\n'}Sé específico y concreto. No vale "todo va a cambiar": di QUÉ cambia y CÓMO lo notarías.</> },
  14: { tag: 'Tu compromiso ético · +18 XP', icon: '💝', min: 140, xp: 18, placeholder: 'Mis respuestas honestas: 1... 2... 3... 4... 5...', question: <>Ya construiste tu manifiesto eligiendo opciones. Ahora escríbelo con tus propias palabras y responde honestamente:{'\n\n'}<B>¿Vas a verificar la información antes de compartirla? ¿Vas a declarar cuando algo lo hizo la IA? ¿Crearías cosas dañinas si te pagaran bien? ¿Vas a ayudar a otros a aprender IA o te lo vas a guardar? ¿Cómo te vas a recordar que la IA es herramienta, no identidad?</B></> },
  16: { tag: 'Tus 3 cambios reales · +20 XP', icon: '🔄', min: 150, xp: 20, placeholder: '1. La creencia que cambió: ... 2. La habilidad nueva: ... 3. La emoción que evolucionó: ...', question: <>Mira hacia atrás, a quien eras cuando empezaste el nivel 1. Identifica <B>3 cambios reales en ti</B>:{'\n\n'}<B>1.</B> Una creencia sobre la IA que CAMBIÓ (¿qué pensabas antes y qué piensas ahora?).{'\n'}<B>2.</B> Una habilidad que NO tenías y que ahora manejas.{'\n'}<B>3.</B> Una emoción sobre el futuro que evolucionó (miedo → curiosidad, indiferencia → urgencia...).</> },
  21: { tag: 'Tu cierre del curso completo · +30 XP', icon: '✍️', min: 200, xp: 30, placeholder: '1. En cómo veo el mundo: ... 2. En cómo me veo a mí mismo: ... 3. Mi primer paso concreto: ...', question: <>Última reflexión del curso completo. Tómate el tiempo que necesites:{'\n\n'}<B>1.</B> ¿Qué cambió en la forma en que ves el MUNDO después de AI Explorer?{'\n'}<B>2.</B> ¿Qué cambió en la forma en que te ves a TI MISMO?{'\n'}<B>3.</B> ¿Cuál es el primer paso CONCRETO que vas a dar la próxima semana? No una intención vaga: algo que puedas marcar como hecho.</> },
};

// ═══════════════════════════════════════════════════════════
export default function World6Level6() {
  const completeLevel = useGameStore((s) => s.completeLevel);

  const [step, setStep] = useState(0);
  useReportProgress(step, TOTAL_STEPS);
  const [xp, setXp] = useState(0);
  const [xpToast, setXpToast] = useState<{ amount: number; id: number } | null>(null);
  const awarded = useRef<Set<number>>(new Set());

  const profileQ = useRef(pickN(PROFILE_Q, 5)).current;          // NO se baraja: el índice es el perfil
  const skillsItems = useRef(pickN(SKILLS_ITEMS, 8)).current;
  const learningQ = useRef(pickN(LEARNING_Q, 5).map(shuffleOpts)).current;
  const matchPairs = useRef(pickN(MATCH_PAIRS, 5)).current;
  const rightOrder = useRef(shuffle(matchPairs.map((p) => p.right))).current;

  // Reflexión
  const [reflectText, setReflectText] = useState('');
  const [reflectFb, setReflectFb] = useState<string | null>(null);

  // Quiz / perfil
  const [quizAnswers, setQuizAnswers] = useState<{ [k: number]: number }>({});
  const [quizChecked, setQuizChecked] = useState(false);

  // Clasificar habilidades
  const [placed, setPlaced] = useState<{ [k: number]: 'domina' | 'mejora' | 'aprender' }>({});
  const [chipSel, setChipSel] = useState<number | null>(null);
  const [dragFb, setDragFb] = useState<{ ok: boolean; msg: string } | null>(null);
  const [dragAttempts, setDragAttempts] = useState(0);
  const [dragSolved, setDragSolved] = useState(false);

  // Matching
  const [matchSel, setMatchSel] = useState<number | null>(null);
  const [matchedLeft, setMatchedLeft] = useState<Set<number>>(new Set());
  const [matchedRight, setMatchedRight] = useState<Set<number>>(new Set());
  const [matchFb, setMatchFb] = useState<{ ok: boolean; msg: string } | null>(null);
  const [matchWrong, setMatchWrong] = useState<number | null>(null);

  // Sprint
  const [sprintPicks, setSprintPicks] = useState<{ [k: number]: 'good' | 'bad' }>({});
  const [sprintSec, setSprintSec] = useState(SPRINT_SECONDS);
  const [sprintStarted, setSprintStarted] = useState(false);
  const [sprintDone, setSprintDone] = useState(false);
  const [sprintFb, setSprintFb] = useState<{ ok: boolean; msg: string } | null>(null);
  const sprintTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const sprintPicksRef = useRef(sprintPicks);
  const sprintDoneRef = useRef(sprintDone);
  useEffect(() => { sprintPicksRef.current = sprintPicks; }, [sprintPicks]);
  useEffect(() => { sprintDoneRef.current = sprintDone; }, [sprintDone]);

  // Escenario / compare
  const [scenarioSel, setScenarioSel] = useState<number | null>(null);
  const [scenarioChecked, setScenarioChecked] = useState(false);
  const [compareChoice, setCompareChoice] = useState<'antes' | 'despues' | null>(null);
  const [compareChecked, setCompareChecked] = useState(false);

  // Builder
  const [builderState, setBuilderState] = useState<{ [k: string]: string }>({});

  // Tarjetas expandibles
  const [expandedEx, setExpandedEx] = useState<number | null>(null);

  const isTheory = THEORY_STEPS.has(step);
  const currentReflection = REFLECTIONS[step];
  const currentExample = EXAMPLES[step];

  const clearSprintTimer = () => { if (sprintTimer.current) { clearInterval(sprintTimer.current); sprintTimer.current = null; } };

  useEffect(() => {
    setReflectText(''); setReflectFb(null);
    setQuizAnswers({}); setQuizChecked(false);
    setPlaced({}); setChipSel(null); setDragFb(null); setDragAttempts(0); setDragSolved(false);
    setMatchSel(null); setMatchedLeft(new Set()); setMatchedRight(new Set()); setMatchFb(null); setMatchWrong(null);
    setSprintPicks({}); setSprintSec(SPRINT_SECONDS); setSprintStarted(false); setSprintDone(false); setSprintFb(null);
    setScenarioSel(null); setScenarioChecked(false);
    setCompareChoice(null); setCompareChecked(false);
    setBuilderState({});
    setExpandedEx(null);
    clearSprintTimer();
  }, [step]);

  useEffect(() => () => clearSprintTimer(), []);

  const addXP = useCallback((amount: number) => {
    setXp((p) => p + amount);
    if (amount > 0) setXpToast((prev) => ({ amount, id: (prev?.id ?? 0) + 1 }));
  }, []);
  const awardOnce = (amount: number) => { if (!awarded.current.has(step)) { awarded.current.add(step); if (amount > 0) addXP(amount); } };

  // ── Test de perfil: sin correcto/incorrecto, XP por completarlo ──
  const dominantProfile = () => {
    const counts = [0, 0, 0, 0];
    Object.values(quizAnswers).forEach((oi) => { if (oi >= 0 && oi < 4) counts[oi]++; });
    let best = 0;
    counts.forEach((c, i) => { if (c > counts[best]) best = i; });
    return { profile: PROFILES[best], count: counts[best], total: profileQ.length };
  };
  const checkProfile = () => { setQuizChecked(true); awardOnce(profileQ.length * 8); };

  const checkLearningQuiz = () => {
    setQuizChecked(true);
    let c = 0;
    learningQ.forEach((q, i) => { if (quizAnswers[i] === q.correct) c++; });
    awardOnce(c * 8);
  };

  // ── Clasificar habilidades: 3 zonas (los datos tienen 3 categorías) ──
  const placeChip = (zone: 'domina' | 'mejora' | 'aprender') => {
    if (chipSel === null || placed[chipSel] !== undefined) return;
    setPlaced((prev) => ({ ...prev, [chipSel]: zone }));
    setChipSel(null);
    setDragFb(null);
  };
  const removeChip = (idx: number) => {
    if (dragSolved) return;
    setPlaced((prev) => { const n = { ...prev }; delete n[idx]; return n; });
    setDragFb(null);
  };
  const checkSkills = () => {
    const attempts = dragAttempts + 1;
    setDragAttempts(attempts);
    const wrong = skillsItems.reduce<number[]>((acc, it, i) => { if (placed[i] !== it.correct) acc.push(i); return acc; }, []);
    if (wrong.length === 0) {
      setDragSolved(true);
      const earned = attempts === 1 ? 20 : 10;
      awardOnce(earned);
      setDragFb({ ok: true, msg: `¡Genial! Las ${skillsItems.length} bien clasificadas. +${earned} XP 🎉${attempts === 1 ? ' (¡primer intento!)' : ''}` });
    } else {
      setPlaced((prev) => { const n = { ...prev }; wrong.forEach((i) => delete n[i]); return n; });
      setDragFb({ ok: false, msg: `${wrong.length} ${wrong.length === 1 ? 'tarjeta volvió' : 'tarjetas volvieron'} al banco. Piensa si de verdad la dominas, si puedes mejorarla o si aún quieres aprenderla.` });
    }
  };

  // ── Matching ──
  const pickLeft = (i: number) => { if (!matchedLeft.has(i)) { setMatchSel(i); setMatchFb(null); } };
  const pickRight = (ri: number) => {
    if (matchSel === null || matchedRight.has(ri)) return;
    if (rightOrder[ri] === matchPairs[matchSel].right) {
      const nextLeft = new Set(matchedLeft).add(matchSel);
      const nextRight = new Set(matchedRight).add(ri);
      setMatchedLeft(nextLeft); setMatchedRight(nextRight); setMatchSel(null);
      if (nextLeft.size === matchPairs.length) {
        awardOnce(15);
        setMatchFb({ ok: true, msg: '¡Excelente! Todos los pares conectados. +15 XP 🎉' });
      } else {
        setMatchFb({ ok: true, msg: `¡Par correcto! ${nextLeft.size} de ${matchPairs.length} conectados. 🎯` });
      }
    } else {
      setMatchWrong(ri);
      setMatchFb({ ok: false, msg: 'Ese no es el par correcto. Vuelve a leer el perfil de la izquierda y prueba otra carrera.' });
      setTimeout(() => setMatchWrong(null), 1200);
      setMatchSel(null);
    }
  };
  const matchComplete = matchedLeft.size >= matchPairs.length;

  // ── Sprint ──
  const finishSprint = useCallback((timeout: boolean) => {
    if (sprintDoneRef.current) return;
    sprintDoneRef.current = true;
    setSprintDone(true);
    clearSprintTimer();
    const vals = Object.values(sprintPicksRef.current);
    const good = vals.filter((v) => v === 'good').length;
    const bad = vals.filter((v) => v === 'bad').length;
    const earned = Math.max(0, good * 5 - bad * 2);
    if (!awarded.current.has(13)) { awarded.current.add(13); if (earned > 0) addXP(earned); }
    setSprintFb(good >= SPRINT_GOAL
      ? { ok: true, msg: `¡Sprint logrado! ${good} frases buenas${bad > 0 ? ` (${bad} ${bad === 1 ? 'error' : 'errores'})` : ''}. +${earned} XP 🎉` }
      : { ok: false, msg: `${timeout ? '⏱ Tiempo agotado. ' : ''}Solo ${good} buenas (meta: ${SPRINT_GOAL}). +${earned} XP` });
  }, [addXP]);

  const startSprint = () => {
    setSprintStarted(true); setSprintSec(SPRINT_SECONDS);
    clearSprintTimer();
    sprintTimer.current = setInterval(() => {
      setSprintSec((prev) => { if (prev <= 1) { finishSprint(true); return 0; } return prev - 1; });
    }, 1000);
  };
  const pickSprint = (i: number) => {
    if (sprintDoneRef.current || sprintPicksRef.current[i] !== undefined) return;
    const val: 'good' | 'bad' = EXPLAIN_SPRINT_ITEMS[i].good ? 'good' : 'bad';
    const next = { ...sprintPicksRef.current, [i]: val };
    sprintPicksRef.current = next;
    setSprintPicks(next);
    const good = Object.values(next).filter((v) => v === 'good').length;
    const totalGood = EXPLAIN_SPRINT_ITEMS.filter((x) => x.good).length;
    if (good >= SPRINT_GOAL || good === totalGood) finishSprint(false);
  };

  const builderComplete = (cfg: BuilderConfig) => cfg.rows.every((r) => builderState[r.key]);

  const sendReflection = (): boolean => {
    if (!currentReflection) return false;
    const t = reflectText.trim();
    if (t.length < currentReflection.min) { setReflectFb(`Escribe al menos ${currentReflection.min} caracteres (llevas ${t.length}).`); return false; }
    if (looksRandom(t)) { setReflectFb('Parece texto al azar. Escribe una idea real con tus propias palabras.'); return false; }
    if (!containsTopic(t)) { setReflectFb('Conéctalo con el tema: lo que aprendiste, la IA, tu propósito o lo que cambió en ti.'); return false; }
    setReflectFb(null); awardOnce(currentReflection.xp); return true;
  };

  // ── Footer ──
  type Primary = { label: string; enabled: boolean; onPress: () => void; accent?: boolean };
  const advance = () => setStep((s) => s + 1);
  const getPrimary = (): Primary => {
    if (currentExample) return { label: 'Sigamos →', enabled: true, onPress: advance };
    if (currentReflection) return { label: 'Enviar reflexión →', enabled: reflectText.trim().length >= currentReflection.min, onPress: () => { if (sendReflection()) advance(); } };
    switch (step) {
      case 0: return { label: '¡Vamos! Empecemos 🚀', enabled: true, onPress: advance };
      case 1: return { label: 'Entendido, sigamos →', enabled: true, onPress: advance };
      case 3: return quizChecked
        ? { label: 'Continuar →', enabled: true, onPress: advance }
        : { label: 'Ver mi perfil', enabled: Object.keys(quizAnswers).length === profileQ.length, onPress: checkProfile, accent: true };
      case 4: return dragSolved
        ? { label: 'Continuar →', enabled: true, onPress: advance }
        : { label: 'Verificar clasificación', enabled: Object.keys(placed).length === skillsItems.length, onPress: checkSkills, accent: true };
      case 7: return quizChecked
        ? { label: 'Continuar →', enabled: true, onPress: advance }
        : { label: 'Comprobar respuestas', enabled: Object.keys(quizAnswers).length === learningQ.length, onPress: checkLearningQuiz, accent: true };
      case 8: return { label: 'Continuar →', enabled: matchComplete, onPress: advance };
      case 9: return { label: 'Terminar →', enabled: builderComplete(BUILDER_LETTER), onPress: () => { awardOnce(BUILDER_LETTER.xp); advance(); } };
      case 10: return { label: 'Terminar →', enabled: builderComplete(BUILDER_MANIFESTO), onPress: () => { awardOnce(BUILDER_MANIFESTO.xp); advance(); } };
      case 12: return { label: 'Terminar →', enabled: builderComplete(BUILDER_FAV), onPress: () => { awardOnce(BUILDER_FAV.xp); advance(); } };
      case 13: return { label: 'Continuar →', enabled: sprintDone, onPress: advance };
      case 15: return { label: 'Terminar →', enabled: builderComplete(BUILDER_MURAL), onPress: () => { awardOnce(BUILDER_MURAL.xp); advance(); } };
      case 17: return { label: 'Terminar →', enabled: builderComplete(BUILDER_SHARE), onPress: () => { awardOnce(BUILDER_SHARE.xp); advance(); } };
      case 18: return scenarioChecked
        ? { label: 'Continuar →', enabled: true, onPress: advance }
        : { label: 'Confirmar mi camino', enabled: scenarioSel !== null, onPress: () => { setScenarioChecked(true); awardOnce(12); }, accent: true };
      case 19: return compareChecked
        ? { label: 'Continuar →', enabled: true, onPress: advance }
        : { label: 'Ver explicación', enabled: compareChoice !== null, onPress: () => { setCompareChecked(true); awardOnce(12); }, accent: true };
      case 20: return { label: 'Terminar →', enabled: builderComplete(BUILDER_THANKS), onPress: () => { awardOnce(BUILDER_THANKS.xp); advance(); } };
      default: return { label: 'Continuar →', enabled: true, onPress: advance };
    }
  };

  const finishLevel = () => {
    const stars = xp >= MAX_XP * 0.7 ? 3 : xp >= MAX_XP * 0.45 ? 2 : 1;   // ~289 / ~186
    completeLevel(36, stars, xp);
    router.replace('/eval/6');
  };

  // ── Sub-renders ──
  const renderExCard = (i: number, c: ExCard) => {
    const open = expandedEx === i;
    return (
      <TouchableOpacity key={i} activeOpacity={0.9} style={[styles.exCard, open && styles.exCardOpen]} onPress={() => setExpandedEx(open ? null : i)}>
        <View style={styles.exHeader}>
          <View style={styles.exEmoji}><Text style={{ fontSize: 20 }}>{c.emoji}</Text></View>
          <View style={{ flex: 1 }}><Text style={styles.exName}>{c.name}</Text></View>
          <Text style={styles.exArrow}>{open ? '↓' : '›'}</Text>
        </View>
        {open && <View style={styles.exBody}><Text style={styles.exHow}>{c.how}</Text><View style={styles.exFact}><Text style={styles.exFactText}>{c.fact}</Text></View></View>}
      </TouchableOpacity>
    );
  };

  const renderBuilder = (cfg: BuilderConfig, previewLabel: string) => (
    <>
      <View style={styles.builderWrap}>
        {cfg.rows.map((r) => (
          <View key={r.key} style={styles.builderRow}>
            <Text style={styles.builderLabel}>{r.label}</Text>
            <View style={styles.builderOpts}>
              {r.opts.map((o) => (
                <TouchableOpacity key={o} style={[styles.builderOpt, builderState[r.key] === o && styles.builderOptSel]} onPress={() => setBuilderState((prev) => ({ ...prev, [r.key]: o }))}>
                  <Text style={[styles.builderOptText, builderState[r.key] === o && styles.builderOptTextSel]}>{o}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </View>
      <Text style={[styles.builderLabel, { marginTop: 12, marginBottom: 4 }]}>{previewLabel}:</Text>
      <View style={styles.codeBox}>
        {cfg.rows.map((r) => (
          <Text key={r.key} style={styles.codeLine}>
            <Text style={styles.codeKey}>{r.label}: </Text>
            {builderState[r.key] ? <Text style={styles.codeText}>{builderState[r.key]}</Text> : <Text style={styles.codeEmpty}>elige una opción</Text>}
          </Text>
        ))}
      </View>
    </>
  );

  const renderContent = () => {
    if (currentExample) return (
      <View>
        <Tag icon={currentExample.icon} label={currentExample.label} variant="example" />
        <Title>{currentExample.title}</Title>
        <Sub>{currentExample.sub}</Sub>
        {currentExample.cards.map((c, i) => renderExCard(i, c))}
      </View>
    );
    if (currentReflection) return (
      <View>
        <Tag icon={currentReflection.icon} label={currentReflection.tag} variant="reflect" />
        <Title>Piensa tú</Title>
        <Sub>No hay respuesta correcta. Procesa lo aprendido con tus palabras.</Sub>
        <View style={[styles.card, styles.cardViolet]}><Text style={styles.cardTitle}>🤔  Tu pregunta</Text><Text style={styles.cardText}>{currentReflection.question}</Text></View>
        <TextInput style={styles.reflectArea} multiline value={reflectText} onChangeText={(t) => { setReflectText(t); if (reflectFb) setReflectFb(null); }} placeholder={currentReflection.placeholder} placeholderTextColor="#b8bcc0" />
        <Text style={styles.charCount}>{reflectText.trim().length} / {currentReflection.min} mínimo</Text>
        {reflectFb && <View style={[styles.fb, styles.fbBad]}><Text style={styles.fbBadText}>{reflectFb}</Text></View>}
      </View>
    );
    switch (step) {
      case 0: return (
        <View>
          <View style={styles.introIcon}><Text style={{ fontSize: 34 }}>🌟</Text></View>
          <Tag icon="✨" label="Nivel 36 · Mundo 6" variant="intro" />
          <Title>Tú y la IA: Tu Misión en el Mundo</Title>
          <Sub>Llegaste al último nivel. Has cruzado 35 niveles, 6 mundos y decenas de proyectos. Ya no eres el mismo que empezó. Este nivel NO es un quiz más: es tu cierre, tu manifiesto, tu carta a ti mismo, tu mural de graduación. Aquí decides quién quieres ser en el mundo que viene.</Sub>
          <View style={[styles.card, styles.cardAccent]}><Text style={styles.cardTitle}>📚  Qué vas a aprender</Text><Text style={styles.cardText}>Test de perfil de explorador IA · Habilidades dominadas · Cambios en TU mundo · Recursos para seguir aprendiendo · Carrera futura · Carta a ti mismo en 10 años · Manifiesto personal · Héroes de la IA · Tu post de cierre · 4 caminos posibles · Carta de agradecimiento</Text></View>
          <View style={[styles.card, styles.cardGreen]}><Text style={styles.cardTitle}>⚡  Qué podrás HACER al terminar</Text><Text style={styles.cardText}>Cerrar tu viaje de 36 niveles con claridad, dirección y propósito. Tener tu manifiesto personal de IA. Escribir tu carta al futuro. Definir tu primer paso concreto. Recibir el certificado al completar la Evaluación Final.</Text></View>
          <View style={[styles.card, styles.cardYellow]}><Text style={styles.cardTitle}>🎮  21 módulos · 50-70 min · hasta 413 XP</Text><Text style={styles.cardText}>📖 Cierre del viaje · 🤔 Sentimiento inicial · 🎭 Test de perfil · 🧩 Habilidades · 🔮 3 cambios · 🌎 Problemas necesarios · 📚 Cómo seguir aprendiendo · 🔗 Carreras · 💌 Carta al futuro · 📜 Manifiesto · 🦸 Héroes · ⭐ Tu favorito · ⏱ Explica IA · 💝 Compromiso ético · 🎨 Mural · 🔄 Cambios en ti · 📣 Post de cierre · 🛤️ 4 caminos · 🆚 Antes y después · 🙏 Agradecimiento · ✍️ Reflexión final</Text></View>
        </View>
      );
      case 1: return (
        <View>
          <Tag icon="📖" label="Módulo 1 de 21 · Teoría" variant="theory" />
          <Title>El cierre del viaje · Tu última lección teórica</Title>
          <Body>Llegaste al último nivel. <B>36 niveles. 6 mundos. Decenas de proyectos. Cientos de decisiones.</B> Ya no eres el mismo que empezó. Tomaste hace meses la decisión de aprender, y la honraste hasta aquí.</Body>
          <View style={styles.highlightBox}><Text style={styles.highlightText}>💡 <B>Este nivel NO es un quiz más:</B>{'\n\n'}Es tu cierre. Tu manifiesto. Tu carta a ti mismo. Tu mural de graduación. Aquí decides quién quieres ser en el mundo que viste en N31-N35: el que TÚ vas a construir o a defender.</Text></View>
          <Body>El curso termina pero <B>tu misión apenas comienza</B>. La IA cambia rápido y las herramientas que aprendiste se actualizarán. Pero tu CAPACIDAD de aprenderlas, criticarlas y usarlas con propósito: eso se queda contigo.</Body>
          <Text style={styles.sectionTitle}>🌟 Las 4 cosas que te llevas de este viaje</Text>
          {[['1', 'Conocimiento técnico:', ' de prompts a AGI, de chatbots a CRISPR.'], ['2', 'Capacidad de hacer:', ' chatbot, app, automatización, pitch — los construiste tú.'], ['3', 'Brújula ética:', ' pensaste dilemas reales y formaste opinión propia.'], ['4', 'Identidad de creador:', ' ya no eres consumidor pasivo. Eres alguien que construye.']].map(([n, t, d]) => (
            <View key={n} style={styles.stepLi}><View style={styles.stepNum}><Text style={styles.stepNumText}>{n}</Text></View><Text style={styles.stepLiText}><B>{t}</B>{d}</Text></View>
          ))}
          <View style={styles.tipBox}><Text style={styles.tipText}>✅ <B>El mensaje final del curso:</B> el mundo NO necesita más expertos en IA que solo critican. Necesita gente con TU combinación: habilidad + ética + capacidad de actuar. Esa eres TÚ ahora. Tu trabajo apenas empieza.</Text></View>
        </View>
      );
      case 3: {
        const res = quizChecked ? dominantProfile() : null;
        return (
          <View>
            <Tag icon="🎭" label="Módulo 3 de 21 · Tu perfil" variant="quiz" />
            <Title>¿Qué tipo de explorador IA eres?</Title>
            <Sub>{profileQ.length} preguntas SIN respuesta correcta. Tus respuestas revelan tu perfil único. +{profileQ.length * 8} XP por completarlo.</Sub>
            {profileQ.map((q, qi) => (
              <View key={qi} style={{ marginBottom: 18 }}>
                <Text style={styles.quizQ}>{qi + 1}. {q.q}</Text>
                {q.opts.map((o, oi) => {
                  const sel = quizAnswers[qi] === oi;
                  return (
                    <TouchableOpacity key={oi} disabled={quizChecked} style={[styles.qopt, sel && styles.qoptSel]} onPress={() => setQuizAnswers((prev) => ({ ...prev, [qi]: oi }))}>
                      <View style={[styles.qLetter, sel && styles.qLetterSel]}>
                        <Text style={[styles.qLetterText, sel && { color: '#fff' }]}>{String.fromCharCode(65 + oi)}</Text>
                      </View>
                      <Text style={styles.qoptText}>{o}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
            {res && (
              <View style={styles.profileBox}>
                <Text style={styles.profileEmoji}>{res.profile.emoji}</Text>
                <Text style={styles.profileName}>Tu perfil: {res.profile.name}</Text>
                <Text style={styles.profileDesc}>{res.profile.desc}</Text>
                <Text style={styles.profileCount}>{res.count} de {res.total} respuestas apuntan a este perfil.</Text>
                <Text style={styles.profileNote}>Ningún perfil es mejor que otro: las 4 respuestas de cada pregunta eran válidas. En el módulo 8 vas a conectar estos perfiles con carreras reales.</Text>
              </View>
            )}
          </View>
        );
      }
      case 4: {
        const pool = skillsItems.map((_, i) => i).filter((i) => placed[i] === undefined);
        return (
          <View>
            <Tag icon="🧩" label="Módulo 4 de 21 · Clasificar" variant="activity" />
            <Title>Tus habilidades IA actuales</Title>
            <Sub>{skillsItems.length} habilidades. Clasifica con honestidad: ¿la domino bien, puedo mejorarla o quiero aprenderla? Toca un chip y luego una columna.</Sub>
            <View style={styles.chipPool}>
              {pool.length === 0 ? <Text style={styles.poolEmpty}>Banco vacío · verifica tu clasificación</Text> : pool.map((i) => (
                <TouchableOpacity key={i} style={[styles.chip, chipSel === i && styles.chipSel]} onPress={() => setChipSel(chipSel === i ? null : i)}>
                  <Text style={[styles.chipText, chipSel === i && styles.chipTextSel]}>{skillsItems[i].text}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {SKILL_ZONES.map((z) => (
              <TouchableOpacity key={z.key} activeOpacity={0.9} style={[styles.zone, chipSel !== null && styles.zoneActive]} onPress={() => placeChip(z.key)}>
                <Text style={styles.zoneLabel}>{z.label}</Text>
                {Object.keys(placed).filter((k) => placed[Number(k)] === z.key).map((k) => (
                  <TouchableOpacity key={k} onPress={() => removeChip(Number(k))} disabled={dragSolved}>
                    <Text style={styles.zoneChip}>{skillsItems[Number(k)].text}{dragSolved ? '' : '  ✕'}</Text>
                  </TouchableOpacity>
                ))}
              </TouchableOpacity>
            ))}
            {dragFb && <View style={[styles.fb, dragFb.ok ? styles.fbOk : styles.fbBad]}><Text style={dragFb.ok ? styles.fbOkText : styles.fbBadText}>{dragFb.msg}</Text></View>}
          </View>
        );
      }
      case 7: return (
        <View>
          <Tag icon="❓" label="Módulo 7 de 21 · Quiz" variant="quiz" />
          <Title>Cómo seguir aprendiendo después del curso</Title>
          <Sub>5 preguntas sobre recursos reales para no detenerte aquí.</Sub>
          {learningQ.map((q, qi) => (
            <View key={qi} style={{ marginBottom: 18 }}>
              <Text style={styles.quizQ}>{qi + 1}. {q.q}</Text>
              {q.opts.map((o, oi) => {
                const sel = quizAnswers[qi] === oi;
                const showOk = quizChecked && oi === q.correct;
                const showWrong = quizChecked && sel && oi !== q.correct;
                return (
                  <TouchableOpacity key={oi} disabled={quizChecked} style={[styles.qopt, sel && !quizChecked && styles.qoptSel, showOk && styles.qoptOk, showWrong && styles.qoptWrong]} onPress={() => setQuizAnswers((prev) => ({ ...prev, [qi]: oi }))}>
                    <View style={[styles.qLetter, sel && !quizChecked && styles.qLetterSel, showOk && styles.qLetterOk, showWrong && styles.qLetterWrong]}>
                      <Text style={[styles.qLetterText, (sel || showOk || showWrong) && { color: '#fff' }]}>{String.fromCharCode(65 + oi)}</Text>
                    </View>
                    <Text style={styles.qoptText}>{o}</Text>
                  </TouchableOpacity>
                );
              })}
              {quizChecked && (
                <View style={[styles.fb, quizAnswers[qi] === q.correct ? styles.fbOk : styles.fbBad]}>
                  <Text style={quizAnswers[qi] === q.correct ? styles.fbOkText : styles.fbBadText}>{quizAnswers[qi] === q.correct ? '✓ ¡Correcto! — ' : `✗ Respuesta ${String.fromCharCode(65 + q.correct)} — `}{q.explain}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      );
      case 8: return (
        <View>
          <Tag icon="🔗" label="Módulo 8 de 21 · Matching" variant="activity" />
          <Title>Tu perfil + tu carrera futura</Title>
          <Sub>Conecta cada perfil con las carreras que le encajan. Toca uno de la izquierda y luego su pareja a la derecha.</Sub>
          <View style={styles.matchRow}>
            <View style={styles.matchCol}>
              {matchPairs.map((p, i) => (
                <TouchableOpacity key={i} disabled={matchedLeft.has(i)} style={[styles.matchCard, matchSel === i && styles.matchCardSel, matchedLeft.has(i) && styles.matchCardDone]} onPress={() => pickLeft(i)}>
                  <Text style={[styles.matchText, matchedLeft.has(i) && styles.matchTextDone]}>{p.left}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.matchCol}>
              {rightOrder.map((r, i) => (
                <TouchableOpacity key={i} disabled={matchedRight.has(i)} style={[styles.matchCard, matchedRight.has(i) && styles.matchCardDone, matchWrong === i && styles.matchCardWrong]} onPress={() => pickRight(i)}>
                  <Text style={[styles.matchText, matchedRight.has(i) && styles.matchTextDone]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {matchFb && <View style={[styles.fb, matchFb.ok ? styles.fbOk : styles.fbBad]}><Text style={matchFb.ok ? styles.fbOkText : styles.fbBadText}>{matchFb.msg}</Text></View>}
        </View>
      );
      case 9: return (
        <View>
          <Tag icon="💌" label="Módulo 9 de 21 · Carta" variant="build" />
          <Title>Carta a ti mismo en 10 años</Title>
          <Sub>4 decisiones que definen la carta que abrirás en una década.</Sub>
          {renderBuilder(BUILDER_LETTER, 'Tu carta al futuro')}
        </View>
      );
      case 10: return (
        <View>
          <Tag icon="📜" label="Módulo 10 de 21 · Manifiesto" variant="build" />
          <Title>Tu manifiesto personal de IA</Title>
          <Sub>5 compromisos éticos que firmas contigo mismo.</Sub>
          {renderBuilder(BUILDER_MANIFESTO, 'Tu manifiesto firmado')}
        </View>
      );
      case 12: return (
        <View>
          <Tag icon="⭐" label="Módulo 12 de 21 · Tu favorito" variant="build" />
          <Title>Tu proyecto favorito del curso</Title>
          <Sub>El que más te marcó, por qué, y cómo lo vas a seguir usando.</Sub>
          {renderBuilder(BUILDER_FAV, 'Tu proyecto que más te marcó')}
        </View>
      );
      case 13: return (
        <View>
          <Tag icon="⏱" label="Módulo 13 de 21 · Sprint 90s" variant="sprint" />
          <Title>Explica la IA a alguien en 60 segundos</Title>
          <Sub>10 frases posibles. Toca solo las que SÍ usarías para explicar la IA a alguien que no sabe nada. Meta: {SPRINT_GOAL} buenas.</Sub>
          <View style={styles.sprintBox}>
            <Text style={[styles.sprintTime, sprintSec <= 10 && !sprintDone && { color: P.red }]}>{Math.floor(sprintSec / 60)}:{String(sprintSec % 60).padStart(2, '0')}</Text>
            <Text style={styles.sprintLabel}>
              {sprintDone ? 'Sprint terminado' : sprintStarted ? `${Object.values(sprintPicks).filter((v) => v === 'good').length} buenas · ${Object.keys(sprintPicks).length} elegidas` : `Meta: ${SPRINT_GOAL} buenas en ${SPRINT_SECONDS}s`}
            </Text>
          </View>
          {!sprintStarted && !sprintDone && (
            <TouchableOpacity style={[styles.primaryBtn, styles.primaryBtnAccent, { marginBottom: 12 }]} onPress={startSprint}><Text style={styles.primaryBtnText}>⚡ Iniciar Sprint</Text></TouchableOpacity>
          )}
          {(sprintStarted || sprintDone) && EXPLAIN_SPRINT_ITEMS.map((item, i) => {
            const pick = sprintPicks[i];
            const missed = sprintDone && pick === undefined && item.good;
            return (
              <TouchableOpacity key={i} disabled={sprintDone || pick !== undefined}
                style={[styles.sprintItem, pick === 'good' && styles.sprintItemGood, pick === 'bad' && styles.sprintItemBad, missed && styles.sprintItemMissed]}
                onPress={() => pickSprint(i)}>
                <View style={styles.sprintMarker}><Text style={styles.sprintMarkerText}>{i + 1}</Text></View>
                <Text style={styles.sprintItemText}>{item.text}</Text>
                <Text style={styles.sprintMark}>{pick === 'good' ? '✅' : pick === 'bad' ? '❌' : missed ? '·' : ''}</Text>
              </TouchableOpacity>
            );
          })}
          {sprintFb && <View style={[styles.fb, sprintFb.ok ? styles.fbOk : styles.fbBad]}><Text style={sprintFb.ok ? styles.fbOkText : styles.fbBadText}>{sprintFb.msg}</Text></View>}
          {sprintDone && <Text style={styles.sprintNote}>Las marcadas con · eran buenas y no alcanzaste a elegirlas.</Text>}
        </View>
      );
      case 15: return (
        <View>
          <Tag icon="🎨" label="Módulo 15 de 21 · Mural colectivo" variant="build" />
          <Title>Tu aporte al mural de graduación</Title>
          <Sub>Tu frase, tu imagen y tu promesa en el mural de la generación.</Sub>
          {renderBuilder(BUILDER_MURAL, 'Tu aporte al mural')}
        </View>
      );
      case 17: return (
        <View>
          <Tag icon="📣" label="Módulo 17 de 21 · Tu post" variant="build" />
          <Title>Comparte tu historia · Post de cierre</Title>
          <Sub>Arma el post con el que le cuentas al mundo lo que hiciste.</Sub>
          {renderBuilder(BUILDER_SHARE, 'Tu post de cierre listo')}
        </View>
      );
      case 18: return (
        <View>
          <Tag icon="🛤️" label="Módulo 18 de 21 · Escenario" variant="activity" />
          <Title>Los 4 caminos posibles</Title>
          <Sub>Los cuatro son válidos: no hay respuesta incorrecta. Elige el que más se parece a ti hoy.</Sub>
          {PATHS_SCN.map((c, i) => {
            const sel = scenarioSel === i;
            return (
              <TouchableOpacity key={i} disabled={scenarioChecked} style={[styles.scChoice, sel && styles.scChoiceSel, scenarioChecked && sel && styles.scChoiceOk]} onPress={() => setScenarioSel(i)}>
                <Text style={styles.scTitle}>{c.title}</Text>
                <Text style={styles.scText}>{c.text}</Text>
              </TouchableOpacity>
            );
          })}
          {scenarioChecked && scenarioSel !== null && (
            <View style={[styles.fb, styles.fbOk]}><Text style={styles.fbOkText}>✅ {PATHS_SCN[scenarioSel].explain}{'\n\n'}Y recuerda: puedes cambiar de camino. Nadie firma esto para siempre.</Text></View>
          )}
        </View>
      );
      case 19: return (
        <View>
          <Tag icon="🆚" label="Módulo 19 de 21 · Antes y después" variant="quiz" />
          <Title>Tú antes vs tú después</Title>
          <Sub>Mismo individuo, dos versiones. Lee las dos y responde con honestidad.</Sub>
          <View style={[styles.card, styles.cardNeutral]}><Text style={styles.cardTitle}>👤  TÚ ANTES DEL CURSO</Text><Text style={styles.cardText}>"Sabía que existía la IA. La había usado un par de veces. Pensaba que era para programadores o para divertirse haciendo imágenes raras. No sabía cómo funcionaba realmente. La veía como una caja negra mística o como una amenaza vaga del futuro."</Text></View>
          <View style={[styles.card, styles.cardAccent]}><Text style={styles.cardTitle}>✨  TÚ DESPUÉS DEL CURSO</Text><Text style={styles.cardText}>"Sé qué es un prompt, un chatbot, un agente y un foundation model. Construí mi app, mi automatización y mi pitch. Conozco AlphaFold, CRISPR, Tesla FSD y Waymo. Tengo opinión informada sobre AGI. Sé que el futuro NO está escrito y que mi voz puede influir."</Text></View>
          <Text style={styles.compareQ}>¿Cuál de las dos versiones eres TÚ ahora?</Text>
          <View style={styles.compareRow}>
            {([['antes', 'Yo antes'], ['despues', 'Yo después']] as const).map(([k, label]) => (
              <TouchableOpacity key={k} disabled={compareChecked} style={[styles.compareOpt, compareChoice === k && styles.compareOptSel]} onPress={() => setCompareChoice(k)}>
                <Text style={[styles.compareOptText, compareChoice === k && styles.compareOptTextSel]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {compareChecked && <View style={[styles.fb, styles.fbOk]}><Text style={styles.fbOkText}>✅ {COMPARE_EXPLAIN}</Text></View>}
        </View>
      );
      case 20: return (
        <View>
          <Tag icon="🙏" label="Módulo 20 de 21 · Gratitud" variant="build" />
          <Title>Carta de agradecimiento</Title>
          <Sub>A quién le escribes, qué agradeces y qué prometes a cambio.</Sub>
          {renderBuilder(BUILDER_THANKS, 'Tu carta de agradecimiento')}
        </View>
      );
      case 22: {
        const pct = 100;
        return (
          <View style={styles.completeContainer}>
            <View style={styles.completeBadge}><Text style={{ fontSize: 44 }}>🌟</Text></View>
            <Text style={styles.completeTitle}>¡Nivel 36 completado!</Text>
            <Text style={styles.completeSub}>Terminaste "Tú y la IA: Tu Misión en el Mundo". Ahora eres AI Explorer Graduado.</Text>
            <View style={styles.xpEarned}><Text style={styles.xpEarnedText}>⭐ {xp} XP ganados en este nivel</Text></View>
            <View style={styles.skillsList}>
              {['Identifico mi perfil de explorador IA y las habilidades que ya domino', 'Tengo mi manifiesto personal de IA con 5 compromisos éticos firmes', 'Escribí mi carta a mí mismo en 10 años — visión clara de mi futuro', 'Conozco caminos concretos para seguir aprendiendo por mi cuenta', 'Cierro mi viaje con claridad, dirección y propósito'].map((s, i) => (
                <View key={i} style={styles.skillRow}><Text style={styles.skillCheck}>✓</Text><Text style={styles.skillText}>{s}</Text></View>
              ))}
            </View>
            <View style={styles.nextHint}><Text style={styles.nextHintText}><B>🎓 Has terminado AI Explorer</B>{'\n'}Después de la Evaluación Final del Mundo 6 recibirás el <B>Certificado de Graduación</B>. Pero esto no es un fin: es el comienzo. El mundo te necesita. La IA es tu herramienta. Tu misión apenas comienza.</Text></View>
            <View style={styles.lvlBarWrap}>
              <Text style={styles.lvlBarLabel}>Nivel 36 de 36 completado · {pct}% del camino 🎉</Text>
              <View style={styles.lvlBarOuter}><View style={[styles.lvlBarInner, { width: `${pct}%` }]} /></View>
            </View>
            <TouchableOpacity style={[styles.primaryBtn, styles.primaryBtnAccent, { width: '100%' }]} onPress={finishLevel}><Text style={styles.primaryBtnText}>Ir a la Evaluación del Mundo 6 →</Text></TouchableOpacity>
          </View>
        );
      }
      default: return null;
    }
  };

  const primary = getPrimary();
  const progress = (step / (TOTAL_STEPS - 1)) * 100;
  const progLabel = step === 0 ? 'Introducción' : step < TOTAL_STEPS - 1 ? `Módulo ${step} de ${CONTENT_STEPS}` : '¡Nivel completado!';

  return (
    <View style={styles.screen}>
      <View style={styles.bar}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => exitLevel()} accessibilityLabel="Salir del nivel"><Text style={styles.closeBtnText}>✕</Text></TouchableOpacity>
        <View style={styles.track}><View style={[styles.fill, { width: `${progress}%` }]} /></View>
        <Text style={styles.xpChip}>{xp} XP</Text>
      </View>
      {step < TOTAL_STEPS - 1 && <Text style={styles.progLabel}>{progLabel}</Text>}
      <ScrollView contentContainerStyle={styles.scrollContent}>{renderContent()}</ScrollView>

      {step !== TOTAL_STEPS - 1 && (
        <View style={styles.navRow}>
          {isTheory && step > 0 && <TouchableOpacity style={styles.backBtn} onPress={() => setStep((s) => s - 1)}><Text style={styles.backBtnText}>← Volver</Text></TouchableOpacity>}
          <TouchableOpacity style={[styles.primaryBtn, primary.accent && styles.primaryBtnAccent, { flex: 1 }, !primary.enabled && styles.primaryBtnOff]} disabled={!primary.enabled} onPress={primary.onPress}>
            <Text style={styles.primaryBtnText}>{primary.label}</Text>
          </TouchableOpacity>
        </View>
      )}
      {xpToast && <XPToast key={xpToast.id} amount={xpToast.amount} onHide={() => setXpToast(null)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.screen },
  bar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: P.border, backgroundColor: '#fafafa' },
  closeBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: P.border, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 15, fontWeight: '800', color: P.muted },
  track: { flex: 1, height: 8, backgroundColor: P.border, borderRadius: 4, marginHorizontal: 12, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: P.gold, borderRadius: 4 },
  xpChip: { ...typography.bold, fontSize: 13, color: '#854d0e', backgroundColor: '#fde68a', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
  progLabel: { ...typography.regular, fontSize: 11, color: P.faint, textAlign: 'center', paddingTop: 6 },
  scrollContent: { padding: 16, paddingBottom: 30 },

  tag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginBottom: 12 },
  tagText: { ...typography.bold, fontSize: 11 },
  introIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: P.goldBg, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { ...typography.extraBold, fontSize: 20, color: P.ink, marginBottom: 8, lineHeight: 27 },
  sub: { fontSize: 13, color: P.muted, marginBottom: 14, lineHeight: 20 },
  bodyText: { fontSize: 13.5, color: P.body, lineHeight: 22, marginBottom: 12 },
  bold: { ...typography.bold, color: P.ink },
  sectionTitle: { ...typography.bold, fontSize: 14, color: P.ink, marginTop: 6, marginBottom: 10 },

  card: { borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: P.border, backgroundColor: P.cardBg },
  cardAccent: { backgroundColor: P.goldBg, borderColor: P.goldBorder },
  cardGreen: { backgroundColor: P.greenSoft, borderColor: P.greenBorder },
  cardYellow: { backgroundColor: '#fefce8', borderColor: '#fde68a' },
  cardViolet: { backgroundColor: P.violetBg, borderColor: P.violetBorder },
  cardNeutral: { backgroundColor: P.cardBg, borderColor: P.border },
  cardTitle: { ...typography.bold, fontSize: 13, color: P.ink, marginBottom: 5 },
  cardText: { fontSize: 13, color: P.body, lineHeight: 20 },

  highlightBox: { backgroundColor: P.goldBg, borderLeftWidth: 3, borderLeftColor: P.gold, borderRadius: 8, padding: 12, marginBottom: 14 },
  highlightText: { fontSize: 13, color: P.goldDark, lineHeight: 21 },
  tipBox: { backgroundColor: P.greenSoft, borderWidth: 1, borderColor: P.greenBorder, borderRadius: 10, padding: 12, marginTop: 6 },
  tipText: { fontSize: 12.5, color: P.greenText, lineHeight: 20 },
  stepLi: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 9 },
  stepNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: P.gold, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { ...typography.bold, color: '#fff', fontSize: 11 },
  stepLiText: { flex: 1, fontSize: 13, color: P.body, lineHeight: 20 },

  exCard: { borderWidth: 1, borderColor: P.border, borderRadius: 12, marginBottom: 9, backgroundColor: '#fff', overflow: 'hidden' },
  exCardOpen: { borderColor: P.goldBorder, backgroundColor: P.goldBg },
  exHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12 },
  exEmoji: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: P.border, alignItems: 'center', justifyContent: 'center' },
  exName: { ...typography.bold, fontSize: 13, color: P.ink, lineHeight: 18 },
  exArrow: { fontSize: 17, color: P.faint, fontWeight: '700' },
  exBody: { paddingHorizontal: 12, paddingBottom: 12 },
  exHow: { fontSize: 12.5, color: P.body, lineHeight: 20 },
  exFact: { marginTop: 9, backgroundColor: '#fff', borderWidth: 1, borderColor: P.amberBorder, borderRadius: 8, padding: 10 },
  exFactText: { fontSize: 12, color: P.amberText, lineHeight: 18 },

  quizQ: { ...typography.bold, fontSize: 13, color: P.ink, backgroundColor: P.cardBg, borderRadius: 10, padding: 11, marginBottom: 9, lineHeight: 19 },
  qopt: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderWidth: 1.5, borderColor: P.border, borderRadius: 11, marginBottom: 7, backgroundColor: '#fff' },
  qoptSel: { borderColor: P.gold, backgroundColor: P.goldBg },
  qoptOk: { borderColor: P.green, backgroundColor: P.greenSoft },
  qoptWrong: { borderColor: P.red, backgroundColor: P.redBg },
  qLetter: { width: 24, height: 24, borderRadius: 7, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  qLetterSel: { backgroundColor: P.gold },
  qLetterOk: { backgroundColor: P.green },
  qLetterWrong: { backgroundColor: P.red },
  qLetterText: { ...typography.bold, fontSize: 11, color: P.muted },
  qoptText: { flex: 1, fontSize: 12.5, color: P.body, lineHeight: 18 },

  profileBox: { backgroundColor: P.violetBg, borderWidth: 1.5, borderColor: P.violetBorder, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 4 },
  profileEmoji: { fontSize: 38, marginBottom: 6 },
  profileName: { ...typography.extraBold, fontSize: 17, color: P.violetDark, marginBottom: 6, textAlign: 'center' },
  profileDesc: { fontSize: 13, color: P.body, lineHeight: 20, textAlign: 'center', marginBottom: 8 },
  profileCount: { ...typography.bold, fontSize: 12, color: P.violet, marginBottom: 8 },
  profileNote: { fontSize: 11.5, color: P.muted, lineHeight: 17, textAlign: 'center' },

  chipPool: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 10, backgroundColor: P.cardBg, borderWidth: 1, borderColor: P.border, borderRadius: 12, marginBottom: 12, minHeight: 54 },
  poolEmpty: { fontSize: 12, color: P.faint, fontStyle: 'italic', padding: 6 },
  chip: { paddingVertical: 8, paddingHorizontal: 11, borderRadius: 9, borderWidth: 1.5, borderColor: P.border, backgroundColor: '#fff' },
  chipSel: { borderColor: P.gold, backgroundColor: P.goldBg },
  chipText: { fontSize: 11.5, color: P.body },
  chipTextSel: { color: P.goldDark, fontWeight: '700' },
  zone: { borderWidth: 1.5, borderColor: P.border, borderStyle: 'dashed', borderRadius: 12, padding: 11, marginBottom: 9, backgroundColor: '#fff', minHeight: 66 },
  zoneActive: { borderColor: P.gold, backgroundColor: P.goldBg },
  zoneLabel: { ...typography.bold, fontSize: 12, color: P.ink, marginBottom: 7 },
  zoneChip: { fontSize: 11.5, color: P.goldDark, backgroundColor: P.goldBg, borderWidth: 1, borderColor: P.goldBorder, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 9, marginBottom: 5, overflow: 'hidden' },

  matchRow: { flexDirection: 'row', gap: 8 },
  matchCol: { flex: 1, gap: 7 },
  matchCard: { borderWidth: 1.5, borderColor: P.border, borderRadius: 11, padding: 10, backgroundColor: '#fff', minHeight: 62, justifyContent: 'center' },
  matchCardSel: { borderColor: P.gold, backgroundColor: P.goldBg },
  matchCardDone: { borderColor: P.green, backgroundColor: P.greenSoft },
  matchCardWrong: { borderColor: P.red, backgroundColor: P.redBg },
  matchText: { fontSize: 11.5, color: P.body, lineHeight: 16 },
  matchTextDone: { color: P.greenText, fontWeight: '600' },

  sprintBox: { backgroundColor: P.cardBg, borderWidth: 1, borderColor: P.border, borderRadius: 12, padding: 12, alignItems: 'center', marginBottom: 12 },
  sprintTime: { ...typography.extraBold, fontSize: 30, color: P.goldBright },
  sprintLabel: { fontSize: 12, color: P.muted, marginTop: 3 },
  sprintItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderWidth: 1.5, borderColor: P.border, borderRadius: 11, marginBottom: 7, backgroundColor: '#fff' },
  sprintItemGood: { borderColor: P.green, backgroundColor: P.greenSoft },
  sprintItemBad: { borderColor: P.red, backgroundColor: P.redBg },
  sprintItemMissed: { borderColor: P.amberBorder, backgroundColor: P.goldBg },
  sprintMarker: { width: 24, height: 24, borderRadius: 7, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  sprintMarkerText: { ...typography.bold, fontSize: 11, color: P.muted },
  sprintItemText: { flex: 1, fontSize: 12.5, color: P.body, lineHeight: 18 },
  sprintMark: { fontSize: 13 },
  sprintNote: { fontSize: 11, color: P.faint, marginTop: 8, lineHeight: 16 },

  scChoice: { borderWidth: 1.5, borderColor: P.border, borderRadius: 12, padding: 12, marginBottom: 9, backgroundColor: '#fff' },
  scChoiceSel: { borderColor: P.gold, backgroundColor: P.goldBg },
  scChoiceOk: { borderColor: P.green, backgroundColor: P.greenSoft },
  scTitle: { ...typography.bold, fontSize: 12.5, color: P.ink, marginBottom: 4, lineHeight: 18 },
  scText: { fontSize: 12, color: P.body, lineHeight: 18 },

  compareQ: { ...typography.bold, fontSize: 13.5, color: P.ink, marginTop: 4, marginBottom: 10, lineHeight: 20 },
  compareRow: { flexDirection: 'row', gap: 8 },
  compareOpt: { flex: 1, paddingVertical: 12, borderRadius: 11, borderWidth: 1.5, borderColor: P.border, backgroundColor: '#fff', alignItems: 'center' },
  compareOptSel: { borderColor: P.gold, backgroundColor: P.goldBg },
  compareOptText: { fontSize: 13, color: P.body, fontWeight: '600' },
  compareOptTextSel: { color: P.goldDark, fontWeight: '800' },

  builderWrap: { gap: 12 },
  builderRow: { backgroundColor: P.cardBg, borderWidth: 1, borderColor: P.border, borderRadius: 12, padding: 12 },
  builderLabel: { ...typography.bold, fontSize: 12, color: P.violetDark, marginBottom: 8, textTransform: 'uppercase' },
  builderOpts: { gap: 6 },
  builderOpt: { paddingVertical: 9, paddingHorizontal: 11, borderRadius: 9, borderWidth: 1.5, borderColor: P.border, backgroundColor: '#fff' },
  builderOptSel: { borderColor: P.violet, backgroundColor: P.violetBg },
  builderOptText: { fontSize: 12, color: P.body, lineHeight: 17 },
  builderOptTextSel: { color: P.violetDark, fontWeight: '600' },
  codeBox: { backgroundColor: P.codeBg, borderRadius: 12, padding: 13 },
  codeLine: { fontSize: 11.5, lineHeight: 19, marginBottom: 3 },
  codeKey: { color: P.codeKey, fontWeight: '700' },
  codeText: { color: P.codeText },
  codeEmpty: { color: P.codeEmpty, fontStyle: 'italic' },

  reflectArea: { borderWidth: 1.5, borderColor: P.border, borderRadius: 12, padding: 12, fontSize: 13, minHeight: 110, textAlignVertical: 'top', backgroundColor: '#fff', color: P.ink },
  charCount: { fontSize: 11, color: P.faint, textAlign: 'right', marginTop: 5 },

  fb: { borderRadius: 10, padding: 11, marginTop: 4 },
  fbOk: { backgroundColor: P.greenBg },
  fbBad: { backgroundColor: P.redBg },
  fbOkText: { fontSize: 12, color: P.greenText, lineHeight: 18, fontWeight: '500' },
  fbBadText: { fontSize: 12, color: P.redText, lineHeight: 18, fontWeight: '500' },

  completeContainer: { alignItems: 'center', paddingTop: 8 },
  completeBadge: { width: 88, height: 88, borderRadius: 24, backgroundColor: P.gold, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  completeTitle: { ...typography.extraBold, fontSize: 22, color: P.ink, marginBottom: 6, textAlign: 'center' },
  completeSub: { fontSize: 13, color: P.muted, textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  xpEarned: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 20, backgroundColor: '#fef9c3', borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#fde047', width: '100%' },
  xpEarnedText: { fontSize: 16, fontWeight: '700', color: '#854d0e' },
  skillsList: { gap: 7, marginBottom: 16, width: '100%' },
  skillRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 10, backgroundColor: P.greenSoft, borderRadius: 10, borderWidth: 1, borderColor: P.greenBorder },
  skillCheck: { color: P.green, fontSize: 15, fontWeight: '800' },
  skillText: { flex: 1, fontSize: 12, color: P.greenText, lineHeight: 17, fontWeight: '500' },
  nextHint: { padding: 12, backgroundColor: P.goldBg, borderRadius: 10, borderWidth: 1, borderColor: P.goldBorder, width: '100%', marginBottom: 14 },
  nextHintText: { fontSize: 12, color: P.goldDark, lineHeight: 20 },
  lvlBarWrap: { width: '100%', marginBottom: 16 },
  lvlBarLabel: { fontSize: 11, color: P.muted, marginBottom: 5 },
  lvlBarOuter: { height: 7, backgroundColor: P.border, borderRadius: 4, overflow: 'hidden' },
  lvlBarInner: { height: '100%', backgroundColor: P.gold, borderRadius: 4 },

  navRow: { flexDirection: 'row', gap: 8, padding: 14, borderTopWidth: 1, borderTopColor: '#f0f0f0', backgroundColor: '#fafafa' },
  backBtn: { paddingHorizontal: 16, paddingVertical: 13, borderRadius: 12, backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#e2e8f0', justifyContent: 'center' },
  backBtnText: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  primaryBtn: { backgroundColor: P.gold, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
  primaryBtnAccent: { backgroundColor: P.goldBright },
  primaryBtnOff: { opacity: 0.35 },
  primaryBtnText: { ...typography.bold, color: '#fff', fontSize: 15 },
});
