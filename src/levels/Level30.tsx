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
// Nivel 30 · Presenta tu Proyecto (cierre Mundo 5)
// Mundo 5 · TEMA CLARO (índigo: #4338ca → #6366f1).
// Reconstruido vs nivel-30.html (estándar v2.2).
// 18 módulos de contenido (steps 1-18) — el HTML dice "19", miente (§21).
// ═══════════════════════════════════════════════════════════

const P = {
  screen: '#ffffff',
  ink: '#111827', body: '#374151', muted: '#6b7280', faint: '#9ca3af',
  indigo: '#4338ca', indigoMid: '#6366f1', indigoText: '#312e81', indigoBg: '#eef2ff', indigoBorder: '#c7d2fe',
  border: '#e5e7eb', cardBg: '#f9fafb',
  green: '#16a34a', greenBg: '#dcfce7', greenText: '#166534', greenSoft: '#f0fdf4', greenBorder: '#bbf7d0',
  red: '#dc2626', redBg: '#fef2f2', redText: '#991b1b', redBorder: '#fecaca',
  blueBg: '#eff6ff', blueBorder: '#bfdbfe', blueText: '#1e40af',
  purpleBg: '#fdf4ff', purpleBorder: '#e9d5ff', purpleText: '#5b21b6',
  amberBg: '#fef3c7', amberText: '#92400e', amberBorder: '#fde68a',
  orangeBg: '#fff7ed', orangeText: '#9a3412', orangeBorder: '#fed7aa',
  pinkBg: '#fce7f3', pinkText: '#9d174d', pinkBorder: '#fbcfe8',
  codeBg: '#0f172a', codeText: '#e2e8f0', codeKey: '#a5b4fc', codeEmpty: '#64748b',
};

const TOTAL_STEPS = 20;   // 0 intro · 1-18 módulos · 19 completado
const CONTENT_STEPS = 18;
const THEORY_STEPS = new Set([0, 1, 8]); // solo lecturas → "Volver"

type QuizQ = { q: string; opts: string[]; correct: number; explain: string };
type TFItem = { stmt: string; correct: boolean; explain: string };
type DragItem = { text: string; correct: 'good' | 'bad' };
type ScenarioChoice = { title: string; text: string; correct: boolean; explain: string };
type SprintItem = { text: string; good: boolean };
type SortItem = { l: string; r: string };
type FillItem = { before: string; after: string; opts: string[]; correct: number; explain: string };
type BuilderConfig = { xp: number; rows: { key: string; label: string; opts: string[] }[] };

const shuffleOpts = (q: QuizQ): QuizQ => {
  const paired = q.opts.map((opt, i) => ({ opt, isCorrect: i === q.correct }));
  for (let j = paired.length - 1; j > 0; j--) { const k = Math.floor(Math.random() * (j + 1)); [paired[j], paired[k]] = [paired[k], paired[j]]; }
  return { ...q, opts: paired.map((p) => p.opt), correct: paired.findIndex((p) => p.isCorrect) };
};
const normalizeText = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const looksRandom = (text: string): boolean => {
  const words = normalizeText(text).split(/\s+/).filter((w) => w.length > 0);
  if (words.length < 6) return true;
  if (new Set(words).size / words.length < 0.5) return true;
  const noVowel = words.filter((w) => w.length >= 3 && !/[aeiou]/.test(w)).length;
  return noVowel / words.length > 0.3;
};
const REFLECT_TERMS = ['pitch', 'presentar', 'presentacion', 'dato', 'problema', 'solucion', 'impacto', 'deck', 'slide', 'gamma', 'elevator', 'historia', 'proyecto', 'feedback', 'publico', 'audiencia', 'ensayar', 'nervios', 'mundo', 'aprender', 'logre', 'semana', 'app', 'usuario', 'demo', 'metrica', 'cta', 'idea', 'ia', 'construir', 'validar', 'escenario'];
const containsTopic = (text: string): boolean => {
  const n = normalizeText(text);
  const words = n.split(/[^a-z0-9]+/).filter(Boolean);
  return REFLECT_TERMS.some((t) => (t.length <= 3 ? words.includes(t) : n.includes(t)));
};

// ── Pools (fuente: nivel-30.html) — distractores alargados (§15/27) ──
const GAMMA_POOL: QuizQ[] = [
  { q: '¿Qué es Gamma.app?', opts: ['Una plataforma que genera presentaciones completas desde un prompt usando IA', 'Un editor de fotos profesional con filtros y retoque automático avanzado', 'Una red social para compartir presentaciones con otros creadores del mundo', 'Un antivirus que protege tus archivos de presentación contra el malware'], correct: 0, explain: "Gamma: escribes 'pitch deck para mi app de turnos' y genera 8 slides con diseño profesional en 30 segundos." },
  { q: 'Ventaja real de Gamma vs PowerPoint tradicional:', opts: ['Velocidad: pasas de un prompt a un deck listo en minutos, no en horas', 'Que trae muchísimos más colores y plantillas prediseñadas disponibles', 'Que funciona por completo sin conexión a internet en cualquier lugar', 'Que solo mejora la estética, pero el contenido lo escribes igual tú'], correct: 0, explain: 'Lo que tomaba 4 horas en PowerPoint ahora toma 5 minutos en Gamma. La estética también es superior.' },
  { q: 'Otras alternativas IA para presentaciones:', opts: ['Tome.app, Beautiful.ai, Pitch.com y Canva con IA — el mercado es competitivo', 'Solo Gamma existe hoy en día; no hay ninguna otra herramienta parecida', 'ChatGPT no sirve para nada relacionado con crear presentaciones visuales', 'Estas herramientas solo funcionan en inglés y no soportan bien el español'], correct: 0, explain: 'Mercado activo. Tome.app y Pitch.com también funcionan bien. Canva añadió IA generativa en 2024.' },
  { q: 'Cuándo NO usar IA para tu presentación:', opts: ['Cuando es altamente técnica/médica/legal y necesita revisión humana experta', 'Nunca; la IA siempre es mejor que cualquier revisión humana experta posible', 'Cuando hay más de 100 personas en la sala escuchando el pitch en vivo', 'Solamente si no eres de Estados Unidos ni hablas inglés de forma nativa'], correct: 0, explain: 'IA = borrador rápido. Para contenido sensible o de alto riesgo, siempre revisión humana experta antes de presentar.' },
  { q: 'Estrategia recomendada con Gamma:', opts: ['Generar el borrador con IA y personalizar con TUS datos reales y fotos auténticas', 'Aceptar el resultado tal cual lo genera la IA, sin cambiar absolutamente nada', 'Cambiar únicamente el color de fondo de las diapositivas y dejar el resto igual', 'Imprimirlo de inmediato sin revisar ni personalizar ningún detalle del deck'], correct: 0, explain: 'Gamma da estructura. Tú aportas autenticidad: fotos reales, datos de TU proyecto, tono propio.' },
  { q: '¿Cuántos slides es ideal para un pitch de 5 minutos?', opts: ['5-7 slides — uno por idea principal, sin saturar a la audiencia con texto', '20 o más slides para cubrir absolutamente todos los detalles posibles', 'Solo 1 slide gigante con toda la información comprimida encima del otro', 'Un mínimo de 30 slides para que se vea completo, serio y muy profesional'], correct: 0, explain: 'Regla de oro: 1 idea por slide. Para 5 min, 5-7 slides. Para 10 min, 8-10. Menos es más.' },
];

const FEEDBACK_POOL: QuizQ[] = [
  { q: 'Mejor pregunta para obtener feedback honesto:', opts: ['¿Qué cambiarías si fueras yo y por qué exactamente lo harías?', '¿Te gustó todo lo que viste en la presentación completa que hice?', '¿Está bien así o prefieres que no cambie absolutamente nada de esto?', '¿Ya terminaste de revisarlo todo con calma y con mucho detenimiento?'], correct: 0, explain: "'¿Qué cambiarías?' obliga a la persona a pensar concretamente. '¿Te gustó?' invita a respuesta vacía." },
  { q: 'Si pides feedback a 5 personas y todas dan respuestas distintas:', opts: ['Busca el patrón en lo que NO te dijeron — los silencios coincidentes son señales', 'Simplemente sigue al pie de la letra lo que opine la mayoría de las personas', 'Ignora todo el feedback recibido porque son solo opiniones muy subjetivas', 'Cambia por completo tu proyecto según el primer comentario que escuchaste'], correct: 0, explain: 'Lo que NADIE menciona también es información. Y los patrones de feedback negativo recurrente sí tienen peso.' },
  { q: '¿A quién NO pedirle feedback antes de presentar?', opts: ['A familia y amigos cercanos — son demasiado amables y sesgados positivamente', 'A absolutamente nadie; el feedback antes de presentar sobra y solo te confunde', 'A desconocidos en la calle que no conocen nada del tema de tu proyecto', 'A los inversores, justo el mismo día en que vas a presentarles la idea'], correct: 0, explain: 'Familia/amigos = sesgo positivo. Para feedback real, busca personas que NO te conocen pero entienden el dominio.' },
  { q: 'Pregunta poderosa para detectar lo que no funciona:', opts: ['Si tuvieras que cortar UN solo slide, ¿cuál sería y por qué ese?', '¿Te gusta cómo se ve el diseño general de todas las diapositivas?', '¿Está perfecto tal como está o le falta algún detalle muy menor?', '¿Y qué opinas en general de todo lo que acabas de ver ahora mismo?'], correct: 0, explain: 'Forzar a cortar revela lo más débil. La gente NO te dice qué quitar a menos que se lo pidas explícitamente.' },
  { q: '¿Cuántas rondas de feedback antes de presentar?', opts: ['2-3 rondas con personas distintas — iterando tu deck entre cada una', 'Una sola ronda de feedback siempre es más que suficiente para pulir todo', 'Diez o más rondas seguidas con las mismas personas cercanas de siempre', 'Ninguna ronda; confía plenamente en tu propio criterio y presenta ya'], correct: 0, explain: '1 ronda = sesgo individual. 10+ rondas = parálisis. 2-3 rondas iterativas = balance óptimo.' },
];

const TF_POOL: TFItem[] = [
  { stmt: 'Memorizar palabra por palabra es la mejor forma de prepararse', correct: false, explain: 'Memorizar = robótico. Mejor: dominar la estructura + frases ancla, e improvisar dentro de eso.' },
  { stmt: 'Los nervios son señal de que te importa — no son enemigos', correct: true, explain: 'Los nervios canalizados se vuelven energía. La gente sin nervios suele aburrir.' },
  { stmt: 'Si el público no aplaude, fue una mala presentación', correct: false, explain: 'A veces los pitches más serios generan silencio reflexivo, no aplausos. Mide por preguntas y conversaciones después.' },
  { stmt: "Empezar pidiendo perdón ('disculpen, soy nuevo en esto') destruye tu autoridad al instante", correct: true, explain: 'Nunca pidas perdón al iniciar. La audiencia decide tu valor en los primeros 10 segundos.' },
  { stmt: 'Las pausas estratégicas son más poderosas que hablar rápido', correct: true, explain: 'Las pausas crean tensión, dan espacio para procesar y muestran control. Hablar rápido = nervios visibles.' },
  { stmt: 'Decir "como dije anteriormente" o "básicamente" es señal de inseguridad', correct: true, explain: 'Las muletillas restan autoridad. Otras: "o sea", "este", "cosa". Practica eliminándolas.' },
  { stmt: 'Mirar al techo o al piso al hablar es perfectamente normal', correct: false, explain: 'La conexión visual con la audiencia es crítica. Mira a personas reales — no al techo.' },
  { stmt: 'Ensayar 3 veces es suficiente para un pitch importante', correct: false, explain: 'Los pitches ganadores se ensayan 20-50 veces. Lo que parece natural está hiperensayado.' },
];

const HARD_Q_SCN: ScenarioChoice[] = [
  { title: '"¿Por qué nadie ha hecho esto antes?"', text: 'Responder con honestidad: "Sí lo han intentado — empresa X y empresa Y lo tocaron. La diferencia es Z. Aquí está la evidencia de por qué este momento es diferente."', correct: true, explain: 'Reconocer competidores genera credibilidad. Negar que existen te quema. Diferencia tu enfoque con datos.' },
  { title: '"Eso ya existe, ¿no?"', text: 'Responder con defensividad: "No es lo mismo, ustedes no entienden, mi proyecto es totalmente diferente y especial."', correct: false, explain: 'Defensividad = pierdes credibilidad. Lo correcto: "Tienes razón en que existen alternativas. Mira qué hago diferente: A, B, C."' },
  { title: '"¿Cómo vas a ganar dinero?"', text: 'Responder claro: "Modelo freemium: gratis hasta X usuarios, $Y/mes después. Validamos con N usuarios pagando ya. Proyectamos llegar a Z en 12 meses."', correct: true, explain: 'Modelo + validación + proyección = respuesta seria. La gente respeta a quien sabe sus números.' },
  { title: '"¿Y si Google/Meta/Apple lo copian?"', text: 'Responder con sinceridad: "Es un riesgo real. Nuestra ventaja es velocidad de iteración + nicho específico + relación directa con usuarios. Si llegan, ya tendremos comunidad y data."', correct: true, explain: 'Reconocer riesgos reales + plan defensivo concreto = madurez. Negar el riesgo = ingenuidad ante el inversor.' },
  { title: '"No me convences"', text: 'Responder pidiendo retroalimentación: "Entiendo. ¿Qué pieza específica necesitarías ver para convencerte? ¿Validación, ROI, equipo?"', correct: true, explain: 'Conviertes la objeción en información. El que objeta te dice qué le falta — eso es oro gratis.' },
];

const SLIDES_POOL: DragItem[] = [
  { text: 'UN número grande ("240 usuarios") con una frase de contexto debajo', correct: 'good' },
  { text: 'Gráfica simple de UN dato relevante (uso/crecimiento/retención)', correct: 'good' },
  { text: 'Jerarquía visual clara: título grande, subtítulo mediano, dato pequeño', correct: 'good' },
  { text: 'Screenshot de la app con UN elemento destacado (círculo/flecha)', correct: 'good' },
  { text: 'Cita textual de un usuario real entre comillas, en grande', correct: 'good' },
  { text: '4 logos de competidores y tu logo en el centro con una flecha', correct: 'good' },
  { text: '50 palabras de texto, 4 viñetas y 2 imágenes pequeñas apretadas', correct: 'bad' },
  { text: 'Tu rostro feliz al lado del logo, sin contexto del problema', correct: 'bad' },
  { text: '7 colores diferentes y 3 tipografías mezcladas sin criterio', correct: 'bad' },
  { text: 'Gris claro sobre blanco con texto pequeño difícil de leer al fondo', correct: 'bad' },
];

const PITCH_SPRINT_ITEMS: SprintItem[] = [
  { text: '"Hola, mi nombre es X y voy a contarles un poco de mi proyecto que llevo desde hace tiempo trabajando"', good: false },
  { text: '"7 de cada 10 estudiantes pierden tareas. Yo construí esto. Funciona así. Necesito esto. Gracias."', good: true },
  { text: '"Es revolucionario, increíble, va a cambiar el mundo, es lo más nuevo, único, novedoso"', good: false },
  { text: '"Hace 2 años vi a mi abuela llorar usando una app. Hoy lanzo SU solución → demo → 240 usuarios → necesito 5 testers más"', good: true },
  { text: '"Bueno, ehhh, no sé bien por dónde empezar, mi proyecto es como, así, complicado de explicar"', good: false },
  { text: '"Problema: X. Solución: Y. Demo en 30 seg. Impacto: 240 usuarios reales. Llamada: necesito a Z." — claro y directo', good: true },
  { text: 'Lectura monótona del slide sin contacto visual con el público', good: false },
  { text: '"Cada día, miles de familias latinas pierden un contacto importante para siempre. Construí algo que arregla eso."', good: true },
  { text: 'Memorizado palabra por palabra, robótico, sin emoción', good: false },
  { text: 'Personal, claro, dato impactante de entrada, demo en vivo, cierre con CTA específico', good: true },
];

// §6: sin el número de orden en el texto (el círculo numerado es el único número).
const WINNING_SORT: SortItem[] = [
  { l: 'Problema:', r: ' el dolor real, específico, dimensionado con UN dato impactante' },
  { l: 'Solución:', r: ' qué construiste, en una frase clara, sin jerga' },
  { l: 'Demo:', r: ' mostrar funcionando — 30-60 seg de la magia real' },
  { l: 'Impacto:', r: ' métricas concretas, testimonios o validación de mercado' },
  { l: 'Llamada a la acción:', r: ' qué necesitas (usuarios, capital, equipo, partners)' },
];
const CHECKLIST_SORT: SortItem[] = [
  { l: 'Llega 30 min antes:', r: ' probar audio, video, conexión, micrófono y la versión final del deck' },
  { l: 'Plan B del deck:', r: ' versión PDF en USB + en email + en cloud (3 backups)' },
  { l: 'Usa el baño antes:', r: ' obvio pero crítico; nada de pánico de último minuto' },
  { l: 'Bebe agua, no café:', r: ' el café tiembla las manos y reseca la boca' },
  { l: 'Respira 4-7-8:', r: ' 4 seg inhalar, 7 seg sostener, 8 seg exhalar — calma instantánea' },
  { l: 'Recuerda quién eres:', r: ' tienes algo que decir que importa, no estás pidiendo permiso' },
  { l: 'Conecta con UNA persona:', r: ' no hables al "público" — habla a un humano que asiente' },
  { l: 'Tiempo medido:', r: ' reloj o cronómetro discreto, NO termines con afán' },
  { l: 'Cierre poderoso:', r: ' tu última frase es la que se queda — ensáyala 10x' },
  { l: 'Manos visibles, postura abierta:', r: ' el cuerpo comunica antes que las palabras' },
];

const FILL_POOL: FillItem[] = [
  { before: 'Una versión muy corta (30-60 seg) de tu pitch para situaciones inesperadas se llama ', after: '.', opts: ['elevator pitch', 'podcast', 'vlog', 'demo'], correct: 0, explain: 'Elevator pitch: si te encuentras a un inversor en un ascensor, ¿qué le dices en lo que dura el viaje?' },
  { before: "Las palabras de relleno como 'osea', 'básicamente' o 'pues' que restan autoridad se llaman ", after: '.', opts: ['muletillas', 'verbos', 'adjetivos', 'interjecciones'], correct: 0, explain: 'Muletillas: las eliminas grabándote y revisando. Cada minuto debería tener cero o máximo una.' },
  { before: 'El cierre final de un pitch debe ser una ', after: ' a la acción específica.', opts: ['llamada', 'burla', 'queja', 'imitación'], correct: 0, explain: "CTA: si terminas con 'gracias', perdiste. Termina con qué QUIERES que hagan." },
];

const BUILDER_DECK: BuilderConfig = { xp: 22, rows: [
  { key: 'slide1', label: 'Slide 1: Título', opts: ['Logo + tagline emotivo de 5 palabras', 'Tu rostro + nombre del proyecto', 'Frase contundente que cuenta la transformación', 'Logo simple sobre fondo blanco minimalista'] },
  { key: 'slide2', label: 'Slide 2: Problema', opts: ['UN número grande dimensionando el dolor ("240 millones afectados")', 'Foto auténtica de alguien viviendo el problema', 'Cita textual de usuario real entre comillas', 'Stat + cita + foto en composición vertical'] },
  { key: 'slide3', label: 'Slide 3: Solución', opts: ['Frase clara sin jerga + screenshot del producto', 'Diagrama simple de cómo funciona', 'Demo de 30 seg embebida en el slide', 'Antes/después visual lado a lado'] },
  { key: 'slide4', label: 'Slide 4: Demo / Tracción', opts: ['Video corto del producto funcionando', 'Métrica clave con gráfica simple (crecimiento o retención)', 'Lista de logros: usuarios, partners, hitos', 'Quote de usuario real con foto'] },
  { key: 'slide5', label: 'Slide 5: Próximos pasos / CTA', opts: ['"Necesitamos X para llegar a Y" — específico', 'Roadmap visual a 6 meses', 'Llamada con tu contacto y forma de involucrarse', 'El equipo + qué les falta cubrir'] },
] };
const BUILDER_PITCH: BuilderConfig = { xp: 25, rows: [
  { key: 'problema', label: '1. Problema (10 palabras)', opts: ['7 de cada 10 estudiantes pierden tareas por desorganización digital', 'Adultos mayores se sienten excluidos del mundo digital diariamente', 'Pequeños emprendedores no saben usar IA para crecer su negocio', 'Familias latinas pierden el legado de sus mayores cada año'] },
  { key: 'solucion', label: '2. Solución (10 palabras)', opts: ['Una app que organiza tareas con IA en WhatsApp simple', 'Chatbot que guía paso a paso por audios cálidos para abuelos', 'Plataforma con cursos gratuitos de IA para emprendedoras LATAM', 'Sistema que preserva voz e historia de seres queridos para siempre'] },
  { key: 'razon', label: '3. Por qué tú (5 palabras)', opts: ['Lo viví y lo entiendo', 'Tengo el equipo correcto', 'Mi research lo respalda', 'Ya tengo usuarios reales'] },
] };
const BUILDER_STORY: BuilderConfig = { xp: 22, rows: [
  { key: 'antes', label: 'ANTES (1 frase, problema vivido)', opts: ['Hace 2 años, mi abuela lloraba cada vez que abría la app del banco', 'El año pasado pasé 30 horas/semana organizando tareas en WhatsApp', 'En 2024, mi mamá perdió un negocio por no saber usar IA para marketing', 'Mi familia perdió la voz de mi abuelo cuando murió y nadie la grabó'] },
  { key: 'encuentro', label: 'ENCUENTRO (1 frase, momento de claridad)', opts: ['Descubrí que con 4 herramientas podía resolverlo en 1 fin de semana', 'Probé Lovable y construí el primer prototipo en 3 horas', 'Entrevisté a 10 personas y todas vivían exactamente lo mismo', 'Aprendí que era posible — y que nadie estaba haciéndolo bien'] },
  { key: 'despues', label: 'DESPUÉS (1 frase, transformación real)', opts: ['Hoy 240 personas lo usan cada semana sin frustrarse', 'Hoy ahorro 25 horas/semana y mis usuarios también', 'Hoy 50 emprendedoras dominan IA y duplicaron sus ingresos', 'Hoy las familias preservan recuerdos para siempre'] },
] };
const BUILDER_HARDQ: BuilderConfig = { xp: 18, rows: [
  { key: 'categoria', label: 'Tipo de pregunta a entrenar', opts: ["Mercado: '¿Quién más hace esto y por qué tú ganarías?'", "Producto: '¿Qué pasa cuando falla?'", "Negocio: '¿Cómo vas a ganar dinero realmente?'", "Equipo: '¿Por qué TÚ y no otra persona?'", "Riesgo: '¿Qué te tumba el negocio mañana?'"] },
  { key: 'respuesta', label: 'Estructura de tu respuesta', opts: ['Validar la pregunta + dar dato concreto + mostrar que YA lo pensaste', 'Responder con honestidad sobre lo que aún no sabes — y tu plan para descubrirlo', 'Reformular la pregunta si tiene un supuesto erróneo, con respeto', 'Pedir 30 segundos para responder bien si te toma por sorpresa'] },
  { key: 'tono', label: 'Tono al responder', opts: ['Confiado pero humilde — sin defensividad', "Curioso — 'buena pregunta, esto es lo que sé...'", 'Directo y conciso — sin rodeos', 'Apasionado pero técnico'] },
] };

const BUILDERS: { [k: number]: { cfg: BuilderConfig; header: string; label: string; title: string; sub: string } } = {
  4: { cfg: BUILDER_DECK, header: 'Tu deck en 5 slides:', label: 'Módulo 4 de 18 · Builder', title: 'El deck de tu proyecto: 5 slides', sub: 'Una decisión por slide. Esto es tu pitch deck base.' },
  5: { cfg: BUILDER_PITCH, header: 'Tu elevator pitch:', label: 'Módulo 5 de 18 · Builder', title: 'Elevator pitch · 30 palabras totales', sub: 'Problema (10) + Solución (10) + Por qué tú (5). Tu arma para situaciones inesperadas.' },
  6: { cfg: BUILDER_STORY, header: 'Tu narrativa heroica:', label: 'Módulo 6 de 18 · Builder', title: 'Storytelling: el héroe ERES tú', sub: 'Antes / Encuentro / Después. La narrativa que conecta emocionalmente.' },
  7: { cfg: BUILDER_HARDQ, header: 'Tu protocolo de respuesta:', label: 'Módulo 7 de 18 · Builder', title: 'La IA como audiencia difícil', sub: 'Pídele a la IA las 5 preguntas más incómodas. Aquí entrenas tu respuesta.' },
};

const tagVariants = {
  intro: { box: { backgroundColor: P.indigoBg }, text: { color: P.indigoText } },
  theory: { box: { backgroundColor: P.greenSoft }, text: { color: P.greenText } },
  activity: { box: { backgroundColor: P.blueBg }, text: { color: P.blueText } },
  build: { box: { backgroundColor: P.indigoBg }, text: { color: P.indigoText } },
  case: { box: { backgroundColor: P.purpleBg }, text: { color: '#7e22ce' } },
  example: { box: { backgroundColor: P.orangeBg }, text: { color: P.orangeText } },
  quiz: { box: { backgroundColor: P.amberBg }, text: { color: P.amberText } },
  reflect: { box: { backgroundColor: '#f3f4f6' }, text: { color: '#374151' } },
  sprint: { box: { backgroundColor: '#fee2e2' }, text: { color: P.redText } },
  bonus: { box: { backgroundColor: P.pinkBg }, text: { color: P.pinkText } },
} as const;
const Tag = ({ icon, label, variant }: { icon: string; label: string; variant: keyof typeof tagVariants }) => (
  <View style={[styles.tag, tagVariants[variant].box]}><Text style={[styles.tagText, tagVariants[variant].text]}>{icon}  {label}</Text></View>
);
const Title = ({ children }: { children: React.ReactNode }) => <Text style={styles.title}>{children}</Text>;
const Sub = ({ children }: { children: React.ReactNode }) => <Text style={styles.sub}>{children}</Text>;
const Body = ({ children }: { children: React.ReactNode }) => <Text style={styles.bodyText}>{children}</Text>;
const B = ({ children }: { children: React.ReactNode }) => <Text style={styles.bold}>{children}</Text>;

const REFLECTIONS: { [k: number]: { tag: string; icon: string; question: React.ReactNode; placeholder: string; min: number; xp: number } } = {
  12: { tag: 'Tus 3 datos clave · +18 XP', icon: '📊', min: 120, xp: 18, placeholder: 'Mi dato del problema: ... Mi dato de la solución: ... Mi dato de impacto: ...', question: <>Los 3 datos que convencen son: <B>1 dato del problema</B> (qué tan grande es), <B>1 dato de tu solución</B> (qué tan bien la resuelve) y <B>1 dato de impacto</B> (la transformación real medible). Identifica los TUYOS — para tu proyecto, ¿cuáles son esos 3 datos que vas a memorizar y citar siempre que presentes?</> },
  18: { tag: 'Cierre Mundo 5 · +22 XP', icon: '🎓', min: 150, xp: 22, placeholder: 'Lo que logré que NO creía posible: ... Lo que voy a hacer la próxima semana con esto: ...', question: <>Terminaste el Mundo 5. Construiste chatbot, automatización, idea, app, contenido y ahora pitch. Pero más importante: <B>cambiaste de espectador a creador</B>. ¿Qué lograste en este mundo que NO creías posible cuando empezaste? ¿Qué vas a hacer la próxima semana con todo lo que aprendiste — concreto, no abstracto?</> },
};

// ═══════════════════════════════════════════════════════════
export default function World5Level6() {
  const completeLevel = useGameStore((s) => s.completeLevel);

  const [step, setStep] = useState(0);
  useReportProgress(step, TOTAL_STEPS);
  const [xp, setXp] = useState(0);
  const [xpToast, setXpToast] = useState<{ amount: number; id: number } | null>(null);
  const awarded = useRef<Set<number>>(new Set());

  const gammaQ = useRef(pickN(GAMMA_POOL, 5).map(shuffleOpts)).current;
  const feedbackQ = useRef(pickN(FEEDBACK_POOL, 5).map(shuffleOpts)).current;
  const tfQ = useRef(pickN(TF_POOL, 5)).current;
  const slidesItems = useRef(pickN(SLIDES_POOL, 8)).current;
  const fillItem = useRef(pickN(FILL_POOL, 1)[0]).current;
  const scnOrder = useRef(shuffle([...HARD_Q_SCN.keys()])).current;

  // Reflexión
  const [reflectText, setReflectText] = useState('');
  const [reflectFb, setReflectFb] = useState<string | null>(null);

  // Sort
  const [sortOrder, setSortOrder] = useState<number[]>([]);
  const [sortSolved, setSortSolved] = useState(false);
  const [sortFb, setSortFb] = useState<{ ok: boolean; msg: string } | null>(null);
  const [sortWrong, setSortWrong] = useState<Set<number>>(new Set());

  // Quiz
  const [quizAnswers, setQuizAnswers] = useState<{ [k: number]: number }>({});
  const [quizChecked, setQuizChecked] = useState(false);

  // V/F
  const [tfAnswers, setTfAnswers] = useState<{ [k: number]: boolean }>({});
  const [tfChecked, setTfChecked] = useState(false);

  // Builder
  const [builderState, setBuilderState] = useState<{ [k: string]: string }>({});

  // Sprint
  const [sprintRunning, setSprintRunning] = useState(false);
  const [sprintDone, setSprintDone] = useState(false);
  const [sprintTime, setSprintTime] = useState(90);
  const [sprintPicks, setSprintPicks] = useState<{ [k: number]: 'good' | 'bad' }>({});
  const [sprintFb, setSprintFb] = useState<{ ok: boolean; msg: string } | null>(null);
  const sprintPicksRef = useRef<{ [k: number]: 'good' | 'bad' }>({});
  const sprintDoneRef = useRef(false);

  // Scenario
  const [scenarioSel, setScenarioSel] = useState<number | null>(null);
  const [scenarioChecked, setScenarioChecked] = useState(false);

  // Drag
  const [dragPlaced, setDragPlaced] = useState<{ [k: number]: 'good' | 'bad' }>({});
  const [dragSel, setDragSel] = useState<number | null>(null);
  const [dragSolved, setDragSolved] = useState(false);
  const [dragFb, setDragFb] = useState<{ ok: boolean; msg: string } | null>(null);
  const [dragFlash, setDragFlash] = useState<Set<number>>(new Set());
  const dragAttempts = useRef(0);

  // Fill
  const [fillSel, setFillSel] = useState<number | null>(null);
  const [fillChecked, setFillChecked] = useState(false);

  // Compare
  const [compareSel, setCompareSel] = useState<'a' | 'b' | null>(null);
  const [compareChecked, setCompareChecked] = useState(false);

  // Casos (expandibles)
  const [expandedEx, setExpandedEx] = useState<number | null>(null);

  const isTheory = THEORY_STEPS.has(step);
  const currentBuilder = BUILDERS[step];
  const currentReflection = REFLECTIONS[step];
  const currentSort = step === 2 ? WINNING_SORT : step === 14 ? CHECKLIST_SORT : null;
  const currentQuiz = step === 3 ? gammaQ : step === 13 ? feedbackQ : null;

  // Reset por step
  useEffect(() => {
    setReflectText(''); setReflectFb(null);
    if (step === 2) setSortOrder(shuffledSort(5));
    if (step === 14) setSortOrder(shuffledSort(10));
    setSortSolved(false); setSortFb(null); setSortWrong(new Set());
    setQuizAnswers({}); setQuizChecked(false);
    setTfAnswers({}); setTfChecked(false);
    setBuilderState({});
    setSprintRunning(false); setSprintDone(false); setSprintTime(90); setSprintPicks({}); setSprintFb(null);
    sprintPicksRef.current = {}; sprintDoneRef.current = false;
    setScenarioSel(null); setScenarioChecked(false);
    setDragPlaced({}); setDragSel(null); setDragSolved(false); setDragFb(null); setDragFlash(new Set()); dragAttempts.current = 0;
    setFillSel(null); setFillChecked(false);
    setCompareSel(null); setCompareChecked(false);
    setExpandedEx(null);
  }, [step]);

  // Sprint timer
  useEffect(() => {
    if (!sprintRunning || sprintDone) return;
    if (sprintTime <= 0) { evaluateSprint(true); return; }
    const t = setTimeout(() => setSprintTime((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [sprintRunning, sprintTime, sprintDone]);

  const addXP = useCallback((amount: number) => {
    setXp((p) => p + amount);
    if (amount > 0) setXpToast((prev) => ({ amount, id: (prev?.id ?? 0) + 1 }));
  }, []);
  const awardOnce = (amount: number) => { if (!awarded.current.has(step)) { awarded.current.add(step); if (amount > 0) addXP(amount); } };

  function shuffledSort(n: number): number[] {
    const base = Array.from({ length: n }, (_, i) => i);
    let o = shuffle(base);
    if (o.every((v, i) => v === i)) { [o[0], o[1]] = [o[1], o[0]]; }
    return o;
  }

  // Sort
  const moveSort = (pos: number, dir: number) => {
    const np = pos + dir; if (np < 0 || np >= sortOrder.length || sortSolved) return;
    const no = [...sortOrder]; [no[pos], no[np]] = [no[np], no[pos]]; setSortOrder(no);
    setSortWrong(new Set()); setSortFb(null);
  };
  const checkSort = () => {
    if (sortOrder.every((v, i) => v === i)) { setSortSolved(true); awardOnce(15); setSortFb({ ok: true, msg: '¡Perfecto! Ese es el orden correcto. +15 XP 🎉' }); return; }
    const wrong = new Set(sortOrder.reduce<number[]>((acc, v, i) => { if (v !== i) acc.push(i); return acc; }, []));
    setSortWrong(wrong);
    setSortFb({ ok: false, msg: `${wrong.size} pasos fuera de lugar. Usa ▲▼ para ajustar.` });
    setTimeout(() => setSortWrong(new Set()), 2200);
  };

  // Quiz / VF
  const checkQuiz = () => { if (!currentQuiz) return; setQuizChecked(true); let c = 0; currentQuiz.forEach((q, i) => { if (quizAnswers[i] === q.correct) c++; }); awardOnce(c * 8); };
  const checkTF = () => { setTfChecked(true); let c = 0; tfQ.forEach((it, i) => { if (tfAnswers[i] === it.correct) c++; }); awardOnce(c * 5); };

  // Builder
  const builderComplete = (cfg: BuilderConfig) => cfg.rows.every((r) => builderState[r.key]);

  // Sprint
  const startSprint = () => {
    sprintPicksRef.current = {}; sprintDoneRef.current = false;
    setSprintPicks({}); setSprintDone(false); setSprintFb(null); setSprintTime(90); setSprintRunning(true);
  };
  const pickSprint = (i: number) => {
    if (sprintDoneRef.current || sprintPicksRef.current[i] !== undefined) return;
    const next = { ...sprintPicksRef.current, [i]: PITCH_SPRINT_ITEMS[i].good ? 'good' as const : 'bad' as const };
    sprintPicksRef.current = next; setSprintPicks(next);
    const good = Object.values(next).filter((v) => v === 'good').length;
    const totalGood = PITCH_SPRINT_ITEMS.filter((x) => x.good).length;
    if (good >= 5 || good === totalGood) evaluateSprint(false);
  };
  const evaluateSprint = (timeout: boolean) => {
    if (sprintDoneRef.current) return;
    sprintDoneRef.current = true; setSprintDone(true); setSprintRunning(false);
    const picks = sprintPicksRef.current;
    const good = Object.values(picks).filter((v) => v === 'good').length;
    const bad = Object.values(picks).filter((v) => v === 'bad').length;
    const earned = Math.max(0, good * 5 - bad * 2);
    awardOnce(earned);
    setSprintFb(good >= 5
      ? { ok: true, msg: `¡Sprint logrado! ${good} elecciones correctas${bad > 0 ? ` (${bad} errores)` : ''}. +${earned} XP 🎉` }
      : { ok: false, msg: `${timeout ? '⏱ Tiempo agotado. ' : ''}Solo ${good} correctas (meta: 5). +${earned} XP` });
  };

  // Scenario: el objetivo es señalar la respuesta MAL manejada (la única correct:false)
  const firstBadScn = scnOrder.find((i) => !HARD_Q_SCN[i].correct)!;
  const checkScenario = () => { if (scenarioSel === null) return; setScenarioChecked(true); if (!HARD_Q_SCN[scenarioSel].correct) awardOnce(12); };

  // Drag
  const placeDrag = (zone: 'good' | 'bad') => { if (dragSel === null || dragSolved) return; setDragPlaced((prev) => ({ ...prev, [dragSel]: zone })); setDragSel(null); setDragFb(null); };
  const removeDrag = (idx: number) => { if (dragSolved) return; setDragPlaced((prev) => { const n = { ...prev }; delete n[idx]; return n; }); };
  const checkDrag = () => {
    const placedCount = Object.keys(dragPlaced).length;
    if (placedCount < slidesItems.length) { setDragFb({ ok: false, msg: `Faltan ${slidesItems.length - placedCount} tarjetas. Toca un chip y luego la columna.` }); return; }
    dragAttempts.current += 1;
    const wrong: number[] = []; let correct = 0;
    slidesItems.forEach((it, i) => { if (dragPlaced[i] === it.correct) correct++; else wrong.push(i); });
    if (correct === slidesItems.length) {
      setDragSolved(true);
      const earned = dragAttempts.current === 1 ? 20 : 10;
      awardOnce(earned);
      setDragFb({ ok: true, msg: `¡Genial! ${slidesItems.length} correctas. +${earned} XP 🎉${dragAttempts.current === 1 ? ' (¡primer intento!)' : ''}` });
    } else {
      setDragPlaced((prev) => { const n = { ...prev }; wrong.forEach((i) => delete n[i]); return n; });
      setDragFlash(new Set(wrong));
      setTimeout(() => setDragFlash(new Set()), 700);
      setDragFb({ ok: false, msg: `${correct} de ${slidesItems.length} correctas. Las incorrectas vuelven al banco.` });
    }
  };

  // Fill
  const checkFill = () => { if (fillSel === null) return; setFillChecked(true); if (fillSel === fillItem.correct) awardOnce(10); };

  // Compare
  const checkCompare = () => { if (compareSel === null) return; setCompareChecked(true); if (compareSel === 'b') awardOnce(12); };

  const sendReflection = (): boolean => {
    if (!currentReflection) return false;
    const t = reflectText.trim();
    if (t.length < currentReflection.min) { setReflectFb(`Escribe al menos ${currentReflection.min} caracteres (llevas ${t.length}).`); return false; }
    if (looksRandom(t)) { setReflectFb('Parece texto al azar. Escribe una idea real con tus propias palabras.'); return false; }
    if (!containsTopic(t)) { setReflectFb('Conéctalo con el tema: tu pitch, tus datos, tu proyecto o lo que lograste.'); return false; }
    setReflectFb(null); awardOnce(currentReflection.xp); return true;
  };

  // Footer button
  type Primary = { label: string; enabled: boolean; onPress: () => void; accent?: boolean };
  const advance = () => setStep((s) => s + 1);
  const getPrimary = (): Primary => {
    if (currentBuilder) return { label: 'Terminar →', enabled: builderComplete(currentBuilder.cfg), onPress: () => { awardOnce(currentBuilder.cfg.xp); advance(); } };
    if (currentReflection) return { label: 'Enviar reflexión →', enabled: reflectText.trim().length >= currentReflection.min, onPress: () => { if (sendReflection()) advance(); } };
    if (currentSort) return sortSolved ? { label: 'Continuar →', enabled: true, onPress: advance } : { label: 'Verificar orden', enabled: true, onPress: checkSort, accent: true };
    if (currentQuiz) return quizChecked ? { label: 'Ver resultado →', enabled: true, onPress: advance } : { label: 'Comprobar respuestas', enabled: Object.keys(quizAnswers).length === currentQuiz.length, onPress: checkQuiz, accent: true };
    switch (step) {
      case 0: return { label: '¡Vamos! Empecemos 🚀', enabled: true, onPress: advance };
      case 1: return { label: 'Entendido, sigamos →', enabled: true, onPress: advance };
      case 8: return { label: 'Sigamos →', enabled: true, onPress: advance };
      case 9:
        if (sprintDone) return { label: 'Continuar →', enabled: true, onPress: advance };
        if (sprintRunning) return { label: 'Elige los buenos pitches…', enabled: false, onPress: () => {} };
        return { label: '▶ Iniciar Sprint (90s)', enabled: true, onPress: startSprint, accent: true };
      case 10: return scenarioChecked ? { label: 'Continuar →', enabled: true, onPress: advance } : { label: 'Verificar elección', enabled: scenarioSel !== null, onPress: checkScenario, accent: true };
      case 11: return dragSolved ? { label: 'Continuar →', enabled: true, onPress: advance } : { label: 'Verificar clasificación', enabled: Object.keys(dragPlaced).length > 0, onPress: checkDrag, accent: true };
      case 15: return tfChecked ? { label: 'Continuar →', enabled: true, onPress: advance } : { label: 'Comprobar', enabled: Object.keys(tfAnswers).length === tfQ.length, onPress: checkTF, accent: true };
      case 16: return fillChecked ? { label: 'Continuar →', enabled: true, onPress: advance } : { label: 'Verificar respuesta', enabled: fillSel !== null, onPress: checkFill, accent: true };
      case 17: return compareChecked ? { label: 'Continuar →', enabled: true, onPress: advance } : { label: 'Ver explicación', enabled: compareSel !== null, onPress: checkCompare, accent: true };
      default: return { label: 'Continuar →', enabled: true, onPress: advance };
    }
  };

  const finishLevel = () => {
    const stars = xp >= 230 ? 3 : xp >= 150 ? 2 : 1; // máx real ~341 XP
    completeLevel(30, stars, xp);
    router.replace('/level/31');
  };

  // ── Sub-renders ──
  const renderExCard = (i: number, emoji: string, name: string, how: React.ReactNode, fact: string) => {
    const open = expandedEx === i;
    return (
      <TouchableOpacity key={i} activeOpacity={0.9} style={[styles.exCard, open && styles.exCardOpen]} onPress={() => setExpandedEx(open ? null : i)}>
        <View style={styles.exHeader}>
          <View style={styles.exEmoji}><Text style={{ fontSize: 20 }}>{emoji}</Text></View>
          <View style={{ flex: 1 }}><Text style={styles.exName}>{name}</Text></View>
          <Text style={styles.exArrow}>{open ? '↓' : '›'}</Text>
        </View>
        {open && <View style={styles.exBody}><Text style={styles.exHow}>{how}</Text><View style={styles.exFact}><Text style={styles.exFactText}>{fact}</Text></View></View>}
      </TouchableOpacity>
    );
  };

  const renderBuilder = (cfg: BuilderConfig, header: string) => (
    <View>
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
      <Text style={[styles.builderLabel, { marginTop: 12, marginBottom: 4 }]}>{header}</Text>
      <View style={styles.codeBox}>
        {cfg.rows.map((r) => (
          <Text key={r.key} style={styles.codeLine}>
            <Text style={styles.codeKey}>{r.label.split('(')[0].trim()}: </Text>
            {builderState[r.key] ? <Text style={styles.codeText}>{builderState[r.key]}</Text> : <Text style={styles.codeEmpty}>elige una opción</Text>}
          </Text>
        ))}
      </View>
    </View>
  );

  const renderSort = (items: SortItem[], label: string, mTitle: string, mSub: string) => (
    <View>
      <Tag icon="↕️" label={label} variant="activity" />
      <Title>{mTitle}</Title>
      <Sub>{mSub}</Sub>
      {sortOrder.map((itemIdx, pos) => (
        <View key={pos} style={[styles.sortItem, sortWrong.has(pos) && styles.sortItemWrong, sortSolved && styles.sortItemOk]}>
          <View style={styles.sortNum}><Text style={styles.sortNumText}>{pos + 1}</Text></View>
          <Text style={styles.sortText}><B>{items[itemIdx].l}</B>{items[itemIdx].r}</Text>
          <View style={styles.sortArrows}>
            <TouchableOpacity disabled={pos === 0 || sortSolved} style={[styles.sortBtn, (pos === 0 || sortSolved) && styles.sortBtnOff]} onPress={() => moveSort(pos, -1)}><Text style={styles.sortBtnText}>▲</Text></TouchableOpacity>
            <TouchableOpacity disabled={pos === sortOrder.length - 1 || sortSolved} style={[styles.sortBtn, (pos === sortOrder.length - 1 || sortSolved) && styles.sortBtnOff]} onPress={() => moveSort(pos, 1)}><Text style={styles.sortBtnText}>▼</Text></TouchableOpacity>
          </View>
        </View>
      ))}
      {sortFb && <View style={[styles.fb, sortFb.ok ? styles.fbOk : styles.fbBad]}><Text style={sortFb.ok ? styles.fbOkText : styles.fbBadText}>{sortFb.msg}</Text></View>}
    </View>
  );

  const renderQuiz = (items: QuizQ[], label: string, mTitle: string, mSub: string) => (
    <View>
      <Tag icon="❓" label={label} variant="quiz" />
      <Title>{mTitle}</Title>
      <Sub>{mSub}</Sub>
      {items.map((q, qi) => (
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

  const renderContent = () => {
    if (currentBuilder) return (<View><Tag icon="🛠️" label={currentBuilder.label} variant="build" /><Title>{currentBuilder.title}</Title><Sub>{currentBuilder.sub}</Sub>{renderBuilder(currentBuilder.cfg, currentBuilder.header)}</View>);
    if (currentReflection) return (
      <View>
        <Tag icon={currentReflection.icon} label={currentReflection.tag} variant="reflect" />
        <Title>Piensa tú</Title>
        <Sub>No hay respuesta correcta. Procesa lo aprendido con tus palabras.</Sub>
        <View style={[styles.card, styles.cardPurple]}><Text style={styles.cardTitle}>🤔  Tu pregunta</Text><Text style={styles.cardText}>{currentReflection.question}</Text></View>
        <TextInput style={styles.reflectArea} multiline value={reflectText} onChangeText={(t) => { setReflectText(t); if (reflectFb) setReflectFb(null); }} placeholder={currentReflection.placeholder} placeholderTextColor="#b8bcc0" />
        <Text style={styles.charCount}>{reflectText.trim().length} / {currentReflection.min} mínimo</Text>
        {reflectFb && <View style={[styles.fb, styles.fbBad]}><Text style={styles.fbBadText}>{reflectFb}</Text></View>}
      </View>
    );
    if (currentSort) {
      return step === 2
        ? renderSort(WINNING_SORT, 'Módulo 2 de 18 · Ordenar', 'Estructura ganadora', 'Ordena los 5 momentos clave de un pitch que funciona, del primero al último.')
        : renderSort(CHECKLIST_SORT, 'Módulo 14 de 18 · Ordenar', 'El día D: checklist de 10 cosas', 'Ordena las 10 cosas que verificas antes de subir al escenario, de la más crítica a la menos.');
    }
    if (currentQuiz) {
      return step === 3
        ? renderQuiz(gammaQ, 'Módulo 3 de 18 · Quiz', 'Gamma y herramientas IA para presentaciones', '5 preguntas sobre cómo acelerar tu deck con IA.')
        : renderQuiz(feedbackQ, 'Módulo 13 de 18 · Quiz', 'Cómo pedir feedback bien', '5 preguntas sobre obtener retroalimentación útil sin sesgos.');
    }
    switch (step) {
      case 0: return (
        <View>
          <View style={styles.introIcon}><Text style={{ fontSize: 34 }}>🎤</Text></View>
          <Tag icon="✨" label="Nivel 30 · Mundo 5" variant="intro" />
          <Title>Presenta tu Proyecto</Title>
          <Sub>Presentar es la habilidad que multiplica todo lo demás. La idea más brillante muere en una mala presentación. La idea promedio gana cuando se presenta con maestría.</Sub>
          <View style={[styles.card, styles.cardAccent]}><Text style={styles.cardTitle}>📚  Qué vas a aprender</Text><Text style={styles.cardText}>Estructura ganadora · Decks con Gamma · Elevator pitch · Manejo de preguntas incómodas · Storytelling héroe-tú · Slides buenas vs malas · Checklist día D</Text></View>
          <View style={[styles.card, styles.cardGreen]}><Text style={styles.cardTitle}>⚡  Qué podrás HACER al terminar</Text><Text style={styles.cardText}>Tener tu pitch de 60 segundos, deck de 5 slides listo, 5 respuestas a preguntas hostiles, y mentalidad de presentador profesional.</Text></View>
          <View style={[styles.card, styles.cardYellow]}><Text style={styles.cardTitle}>🎮  18 módulos · 50-65 min · hasta 250 XP</Text><Text style={styles.cardText}>📖 Estructura · ↕️ Sort ganadora · ❓ Quiz Gamma · 📊 Builder deck · 🚀 Elevator pitch · 🎭 Storytelling · 🤖 Builder preguntas · 🏆 Casos ganadores · ⏱ Sprint pitch · 🤔 Preguntas incómodas · 🎨 Slides · 📊 Tus datos · ❓ Quiz feedback · 🔁 Checklist · ✅ V/F mitos · 💬 Vocabulario · 🆚 Compare · ✍️ Cierre</Text></View>
        </View>
      );
      case 1: return (
        <View>
          <Tag icon="📖" label="Módulo 1 de 18 · Teoría" variant="theory" />
          <Title>Por qué presentar bien multiplica todo</Title>
          <Body>Presentar es <B>la habilidad que multiplica todo lo demás</B>. La idea más brillante muere en una mala presentación. La idea promedio gana cuando se presenta con maestría.</Body>
          <View style={styles.highlightBox}><Text style={styles.highlightText}>💡 <B>La verdad incómoda:</B> los pitches ganadores no son los más originales. Son los más <B>claros + emocionalmente honestos + demostrables</B>. Estructura + autenticidad + datos.</Text></View>
          <Body>Después de cientos de pitches estudiados, hay un patrón: los que ganan dominan <B>5 momentos</B> en orden. Cada momento responde a una pregunta que la audiencia se hace en silencio.</Body>
          <Text style={styles.sectionTitle}>🎯 Las 5 preguntas mentales del público</Text>
          {[['1', '"¿Por qué debería importarme?"', ' → Problema con dato impactante.'], ['2', '"¿Qué hiciste?"', ' → Solución en una frase clara.'], ['3', '"¿Funciona?"', ' → Demo o prueba visual concreta.'], ['4', '"¿Tiene tracción?"', ' → Métricas/testimonios reales.'], ['5', '"¿Qué quieres de mí?"', ' → CTA específico.']].map(([n, t, d]) => (
            <View key={n} style={styles.stepLi}><View style={styles.stepNum}><Text style={styles.stepNumText}>{n}</Text></View><Text style={styles.stepLiText}><B>{t}</B>{d}</Text></View>
          ))}
          <View style={styles.tipBox}><Text style={styles.tipText}>✅ <B>Verdad operativa:</B> los pitches que parecen naturales fueron ensayados 20-50 veces. La maestría se ve fácil porque está hiperensayada.</Text></View>
        </View>
      );
      case 8: return (
        <View>
          <Tag icon="🏆" label="Módulo 8 de 18 · Casos ganadores" variant="example" />
          <Title>Proyectos jóvenes que ganaron concursos</Title>
          <Sub>3 historias reales de pitches ganadores en LATAM y global. Toca cada tarjeta 👆</Sub>
          {renderExCard(0, '🇨🇴', 'Diego · ganador de Hackathon Bogotá', <Text>Diego, 17 años, ganó un hackathon con 5 minutos de pitch impecable. <B>Su clave: no habló de él.</B> Empezó con un video de 15 seg de su abuelo agricultor perdiendo cosechas. Después: dato (40% de pérdida regional), demo, y cifras con 30 agricultores reales.</Text>, '⭐ Premio: $5,000 USD + mentoría. Su fórmula: la audiencia no quiere conocerte — quiere conocer al héroe que ayudaste.')}
          {renderExCard(1, '🇲🇽', 'Sofía · Premio Emprendedora Joven', <Text>Sofía, 16 años, ganó un concurso nacional con un pitch de 3 minutos. <B>Su clave: respondió 1 pregunta hostil con maestría.</B> Cuando un jurado dijo "esto ya existe", reconoció 3 competidores, mostró diferencias específicas y data de 60 usuarias que pagaban.</Text>, '⭐ La diferencia ganadora no fue la idea — fue la madurez al manejar la objeción. Premio: $10,000 MXN + incubadora.')}
          {renderExCard(2, '🌎', 'Equipo de 14 años · Global Finalist', <Text>Un equipo mexicano-colombiano-argentino llegó a finales globales con un pitch que duraba exactamente 4:48. <B>Su clave: practicaron 47 veces antes.</B> Cada palabra medida, cada transición ensayada — sin verse robóticos, todo lo contrario.</Text>, '⭐ La maestría parece natural porque está hiper-ensayada. Practica más de lo que crees necesario.')}
        </View>
      );
      case 9: return (
        <View>
          <Tag icon="⏱" label="Módulo 9 de 18 · Sprint 90s" variant="sprint" />
          <Title>Sprint: ¿buen o mal pitch?</Title>
          <Sub>Toca solo las líneas de pitch BUENAS en 90 segundos. Meta: 5 buenos.</Sub>
          <View style={styles.sprintBox}>
            <View style={styles.sprintTimer}>
              <Text style={[styles.sprintTime, sprintTime <= 10 && { color: P.red }]}>{Math.floor(sprintTime / 60)}:{String(sprintTime % 60).padStart(2, '0')}</Text>
              <Text style={styles.sprintLabel}>{sprintDone ? 'Sprint terminado' : sprintRunning ? `${Object.values(sprintPicks).filter((v) => v === 'good').length} buenos · ${Object.keys(sprintPicks).length} elegidos` : 'Meta: 5 buenos'}</Text>
            </View>
            <View style={{ gap: 7 }}>
              {PITCH_SPRINT_ITEMS.map((it, i) => {
                const pick = sprintPicks[i];
                return (
                  <TouchableOpacity key={i} activeOpacity={0.8} disabled={!sprintRunning || sprintDone || pick !== undefined} style={[styles.sprintItem, pick === 'good' && styles.sprintItemOk, pick === 'bad' && styles.sprintItemBad]} onPress={() => pickSprint(i)}>
                    <View style={[styles.sprintMarker, pick === 'good' && styles.sprintMarkerOk, pick === 'bad' && styles.sprintMarkerBad]}><Text style={[styles.sprintMarkerText, pick && { color: '#fff' }]}>{i + 1}</Text></View>
                    <Text style={styles.sprintItemText}>{it.text}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          {sprintFb && <View style={[styles.fb, sprintFb.ok ? styles.fbOk : styles.fbBad]}><Text style={sprintFb.ok ? styles.fbOkText : styles.fbBadText}>{sprintFb.msg}</Text></View>}
        </View>
      );
      case 10: return (
        <View>
          <Tag icon="🎯" label="Módulo 10 de 18 · Escenario" variant="case" />
          <Title>Preguntas incómodas: ¿cómo respondes?</Title>
          <View style={styles.scenarioBox}><Text style={styles.scenarioLabel}>🎬 LA SITUACIÓN</Text><Text style={styles.scenarioText}>5 preguntas que te van a hacer. ¿Cuál de estas respuestas está MAL manejada?</Text></View>
          <Sub><B>Elige la que NO deberías dar</B></Sub>
          {scnOrder.map((idx, pos) => {
            const c = HARD_Q_SCN[idx];
            // "correcto" = detectar la respuesta MAL manejada (la única correct:false)
            const isTarget = !c.correct; // la que hay que señalar
            const showOk = scenarioChecked && isTarget;
            const showWrong = scenarioChecked && scenarioSel === idx && !isTarget;
            return (
              <TouchableOpacity key={pos} disabled={scenarioChecked} style={[styles.scChoice, scenarioSel === idx && !scenarioChecked && styles.scChoiceSel, showOk && styles.scChoiceOk, showWrong && styles.scChoiceWrong]} onPress={() => setScenarioSel(idx)}>
                <Text style={styles.scTitle}>{c.title}</Text>
                <Text style={styles.scText}>{c.text}</Text>
              </TouchableOpacity>
            );
          })}
          {scenarioChecked && scenarioSel !== null && (
            <View style={[styles.fb, !HARD_Q_SCN[scenarioSel].correct ? styles.fbOk : styles.fbBad]}>
              <Text style={!HARD_Q_SCN[scenarioSel].correct ? styles.fbOkText : styles.fbBadText}>{!HARD_Q_SCN[scenarioSel].correct ? `✅ ¡Correcto! Esa respuesta está mal manejada. ${HARD_Q_SCN[scenarioSel].explain}` : `❌ Esa respuesta SÍ está bien manejada. La mal manejada es "${HARD_Q_SCN[firstBadScn].title}" — ${HARD_Q_SCN[firstBadScn].explain}`}</Text>
            </View>
          )}
        </View>
      );
      case 11: {
        const zones: { k: 'good' | 'bad'; label: string }[] = [
          { k: 'good', label: '✅ Buena práctica' },
          { k: 'bad', label: '❌ Desastre visual' },
        ];
        return (
          <View>
            <Tag icon="🧩" label="Módulo 11 de 18 · Clasificar" variant="activity" />
            <Title>Slides buenas vs malas</Title>
            <Sub>8 descripciones de slides reales. ¿Buena práctica o desastre? Toca un chip y luego su columna.</Sub>
            <View style={styles.chipsPool}>
              {slidesItems.map((it, i) => dragPlaced[i] === undefined && (
                <TouchableOpacity key={i} disabled={dragSolved} style={[styles.chip, dragSel === i && styles.chipSel, dragFlash.has(i) && styles.chipFlash]} onPress={() => setDragSel(dragSel === i ? null : i)}>
                  <Text style={[styles.chipText, dragSel === i && { color: P.indigoText }]}>{it.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.dropCols}>
              {zones.map((z) => {
                const placedHere = Object.keys(dragPlaced).map(Number).filter((k) => dragPlaced[k] === z.k);
                const hasItem = placedHere.length > 0;
                const zStyle = z.k === 'good' ? styles.zoneGood : styles.zoneBad;
                const zColor = z.k === 'good' ? P.greenText : P.redText;
                return (
                  <TouchableOpacity key={z.k} activeOpacity={0.9} disabled={dragSel === null || dragSolved} style={[styles.dropCol, hasItem && zStyle]} onPress={() => placeDrag(z.k)}>
                    <View style={[styles.dropHeader, z.k === 'good' ? styles.dropHeaderGood : styles.dropHeaderBad]}><Text style={[styles.dropHeaderText, { color: zColor }]}>{z.label}</Text></View>
                    <View style={styles.dropArea}>
                      {placedHere.map((k) => (
                        <TouchableOpacity key={k} disabled={dragSolved} onPress={() => removeDrag(k)} style={[styles.dropChip, z.k === 'good' ? styles.dropChipGood : styles.dropChipBad]}>
                          <Text style={[styles.dropChipText, { color: zColor }]}>{slidesItems[k].text}  ✕</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            {dragFb && <View style={[styles.fb, dragFb.ok ? styles.fbOk : styles.fbBad]}><Text style={dragFb.ok ? styles.fbOkText : styles.fbBadText}>{dragFb.msg}</Text></View>}
          </View>
        );
      }
      case 15: return (
        <View>
          <Tag icon="✅" label="Módulo 15 de 18 · Verdadero o Falso" variant="quiz" />
          <Title>Mitos sobre presentar bien</Title>
          <Sub>5 afirmaciones populares sobre el arte de presentar. ¿Cuáles son verdad?</Sub>
          {tfQ.map((it, i) => {
            const ans = tfAnswers[i];
            return (
              <View key={i} style={styles.tfSet}>
                <Text style={styles.tfQ}>{i + 1}. {it.stmt}</Text>
                <View style={styles.tfOpts}>
                  <TouchableOpacity disabled={tfChecked} style={[styles.tfBtn, ans === true && !tfChecked && styles.tfBtnTrue, tfChecked && it.correct === true && styles.tfBtnCorrect, tfChecked && ans === true && !it.correct && styles.tfBtnWrong]} onPress={() => setTfAnswers((prev) => ({ ...prev, [i]: true }))}><Text style={styles.tfBtnText}>✅ Verdadero</Text></TouchableOpacity>
                  <TouchableOpacity disabled={tfChecked} style={[styles.tfBtn, ans === false && !tfChecked && styles.tfBtnFalse, tfChecked && it.correct === false && styles.tfBtnCorrect, tfChecked && ans === false && it.correct && styles.tfBtnWrong]} onPress={() => setTfAnswers((prev) => ({ ...prev, [i]: false }))}><Text style={styles.tfBtnText}>❌ Falso</Text></TouchableOpacity>
                </View>
                {tfChecked && (
                  <View style={[styles.fb, ans === it.correct ? styles.fbOk : styles.fbBad]}>
                    <Text style={ans === it.correct ? styles.fbOkText : styles.fbBadText}>{ans === it.correct ? '✅ Correcto. ' : `❌ Incorrecto. La respuesta correcta es "${it.correct ? 'Verdadero' : 'Falso'}". `}{it.explain}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      );
      case 16: return (
        <View>
          <Tag icon="💬" label="Módulo 16 de 18 · Completa la frase" variant="bonus" />
          <Title>¿Cuál es la palabra que falta?</Title>
          <Sub>Lee la frase y elige la palabra correcta para el hueco.</Sub>
          <View style={[styles.card, styles.cardPurple]}>
            <Text style={styles.cardTitle}>📝  Completa la frase:</Text>
            <Text style={styles.fillSentence}>
              {fillItem.before}
              <Text style={styles.fillBlank}>{fillChecked ? fillItem.opts[fillItem.correct] : fillSel !== null ? fillItem.opts[fillSel] : '  _____  '}</Text>
              {fillItem.after}
            </Text>
          </View>
          <View style={styles.fillOpts}>
            {fillItem.opts.map((o, i) => {
              const sel = fillSel === i;
              const showOk = fillChecked && i === fillItem.correct;
              const showWrong = fillChecked && sel && i !== fillItem.correct;
              return (
                <TouchableOpacity key={i} disabled={fillChecked} style={[styles.fillOpt, sel && !fillChecked && styles.fillOptSel, showOk && styles.fillOptOk, showWrong && styles.fillOptWrong]} onPress={() => setFillSel(i)}>
                  <Text style={[styles.fillOptText, sel && !fillChecked && { color: P.indigoText }, (showOk) && { color: P.greenText }, showWrong && { color: P.redText }]}>{o}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {fillChecked && (
            <View style={[styles.fb, fillSel === fillItem.correct ? styles.fbOk : styles.fbBad]}>
              <Text style={fillSel === fillItem.correct ? styles.fbOkText : styles.fbBadText}>{fillSel === fillItem.correct ? '✓ ¡Correcto! — ' : `✗ La palabra correcta es "${fillItem.opts[fillItem.correct]}" — `}{fillItem.explain}</Text>
            </View>
          )}
        </View>
      );
      case 17: return (
        <View>
          <Tag icon="🆚" label="Módulo 17 de 18 · Compara pitches" variant="quiz" />
          <Title>Pitch genérico vs pitch ganador</Title>
          <View style={styles.scenarioBox}><Text style={styles.scenarioLabel}>MISMO PROYECTO</Text><Text style={styles.scenarioText}>Una app educativa con IA. ¿Cuál pitch se queda en la mente del público?</Text></View>
          <TouchableOpacity activeOpacity={0.9} disabled={compareChecked} style={[styles.compareCard, compareSel === 'a' && !compareChecked && styles.compareSel, compareChecked && styles.compareCardDim]} onPress={() => setCompareSel('a')}>
            <Text style={styles.compareLabel}>🤖 PITCH A</Text>
            <Text style={styles.compareText}>"Hola, soy X. Construí una app revolucionaria con IA para estudiantes que les va a cambiar la vida. Es muy innovadora y única. Si quieren saber más, pregúntenme."</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.9} disabled={compareChecked} style={[styles.compareCard, compareSel === 'b' && !compareChecked && styles.compareSel, compareChecked && styles.compareCardOk]} onPress={() => setCompareSel('b')}>
            <Text style={styles.compareLabel}>🎯 PITCH B</Text>
            <Text style={styles.compareText}>"7 de cada 10 estudiantes pierden tareas por desorganización. Construí Tareo: un bot en WhatsApp que organiza todo. 240 estudiantes lo usan en 8 meses. -85% tareas tarde. Necesito 5 colegios piloto más."</Text>
          </TouchableOpacity>
          <Text style={styles.compareQ}>¿Cuál se queda en la mente y por qué?</Text>
          <View style={styles.compareBtns}>
            <TouchableOpacity disabled={compareChecked} style={[styles.compareBtn, compareSel === 'a' && !compareChecked && styles.compareBtnSel]} onPress={() => setCompareSel('a')}><Text style={styles.compareBtnText}>Pitch A</Text></TouchableOpacity>
            <TouchableOpacity disabled={compareChecked} style={[styles.compareBtn, compareSel === 'b' && !compareChecked && styles.compareBtnSel]} onPress={() => setCompareSel('b')}><Text style={styles.compareBtnText}>Pitch B</Text></TouchableOpacity>
          </View>
          {compareChecked && (
            <View style={[styles.fb, compareSel === 'b' ? styles.fbOk : styles.fbBad]}>
              <Text style={compareSel === 'b' ? styles.fbOkText : styles.fbBadText}>{compareSel === 'b' ? '✓ ¡Correcto! ' : '✗ Gana el Pitch B. '}El B tiene dato impactante de entrada, nombre del producto, métrica concreta de tracción, dato de impacto medible y CTA específica. El A son palabras vacías sin sustento.</Text>
            </View>
          )}
        </View>
      );
      case 19: {
        const pct = Math.round((30 / 36) * 100);
        return (
          <View style={styles.completeContainer}>
            <View style={styles.completeBadge}><Text style={{ fontSize: 44 }}>🎤</Text></View>
            <Text style={styles.completeTitle}>¡Nivel 30 completado!</Text>
            <Text style={styles.completeSub}>Terminaste "Presenta tu Proyecto". Ahora eres Speaker Pro.</Text>
            <View style={styles.xpEarned}><Text style={styles.xpEarnedText}>⭐ {xp} XP ganados en este nivel</Text></View>
            <View style={styles.skillsList}>
              {['Sé estructurar un pitch ganador: problema/solución/demo/impacto/CTA', 'Puedo construir un deck de 5-7 slides con Gamma o herramientas similares', 'Tengo mi elevator pitch de 30 palabras listo para cualquier momento', 'Manejo preguntas incómodas sin desarmarme y respondo con autoridad', 'Conozco las 10 cosas que verifico antes de subir al escenario'].map((s, i) => (
                <View key={i} style={styles.skillRow}><Text style={styles.skillCheck}>✓</Text><Text style={styles.skillText}>{s}</Text></View>
              ))}
            </View>
            <View style={styles.nextHint}><Text style={styles.nextHintText}><B>🏆 Mundo 5 completado</B>{'\n'}Terminaste "Tu Proyecto de Impacto": chatbot, automatización, idea, app, contenido y presentación. Sigue el <B>Mundo 6: El Futuro de la IA</B> — el mundo que TÚ vas a vivir.</Text></View>
            <View style={styles.lvlBarWrap}>
              <Text style={styles.lvlBarLabel}>Nivel 30 de 36 completado · {pct}% del camino</Text>
              <View style={styles.lvlBarOuter}><View style={[styles.lvlBarInner, { width: `${pct}%` }]} /></View>
            </View>
            <TouchableOpacity style={[styles.primaryBtn, styles.primaryBtnAccent, { width: '100%' }]} onPress={finishLevel}><Text style={styles.primaryBtnText}>Siguiente nivel →</Text></TouchableOpacity>
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
  fill: { height: '100%', backgroundColor: P.indigo, borderRadius: 4 },
  xpChip: { ...typography.bold, fontSize: 13, color: '#854d0e', backgroundColor: '#fde68a', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
  progLabel: { ...typography.regular, fontSize: 11, color: P.faint, textAlign: 'center', paddingTop: 6 },
  scrollContent: { padding: 16, paddingBottom: 30 },

  tag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginBottom: 12 },
  tagText: { fontSize: 11, fontWeight: '700' },

  introIcon: { width: 68, height: 68, borderRadius: 20, backgroundColor: P.indigoBg, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  title: { ...typography.extraBold, fontSize: 20, color: P.ink, marginBottom: 8, lineHeight: 26 },
  sub: { ...typography.regular, fontSize: 13, color: P.muted, lineHeight: 20, marginBottom: 12 },
  bodyText: { ...typography.regular, fontSize: 13, color: P.body, lineHeight: 22, marginBottom: 12 },
  bold: { fontWeight: '700', color: P.ink },
  sectionTitle: { ...typography.bold, fontSize: 14, color: P.ink, marginTop: 10, marginBottom: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f0f0f0' },

  card: { backgroundColor: P.cardBg, borderRadius: 14, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: P.border },
  cardAccent: { backgroundColor: P.indigoBg, borderColor: P.indigoBorder },
  cardGreen: { backgroundColor: P.greenSoft, borderColor: P.greenBorder },
  cardYellow: { backgroundColor: '#fefce8', borderColor: P.amberBorder },
  cardPurple: { backgroundColor: P.purpleBg, borderColor: P.purpleBorder },
  cardTitle: { ...typography.bold, fontSize: 13, color: P.ink, marginBottom: 4 },
  cardText: { ...typography.regular, fontSize: 13, color: P.body, lineHeight: 21 },

  highlightBox: { borderLeftWidth: 3, borderLeftColor: P.indigo, backgroundColor: P.indigoBg, borderRadius: 8, padding: 12, marginBottom: 12 },
  highlightText: { fontSize: 13, color: P.indigoText, lineHeight: 21 },
  tipBox: { borderLeftWidth: 3, borderLeftColor: P.green, backgroundColor: P.greenSoft, borderRadius: 8, padding: 12, marginTop: 4 },
  tipText: { fontSize: 13, color: P.greenText, lineHeight: 21 },
  stepLi: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 9 },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: P.indigo, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  stepLiText: { flex: 1, fontSize: 13, color: P.body, lineHeight: 20 },

  chipsPool: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, padding: 10, backgroundColor: P.cardBg, borderRadius: 14, borderWidth: 1, borderColor: P.border, marginBottom: 10, minHeight: 54 },
  chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#d1d5db', backgroundColor: '#fff' },
  chipSel: { borderColor: P.indigo, backgroundColor: P.indigoBg },
  chipFlash: { borderColor: '#fca5a5', backgroundColor: P.redBg },
  chipText: { fontSize: 12, color: P.body, lineHeight: 16 },
  dropCols: { flexDirection: 'row', gap: 8 },
  dropCol: { flex: 1, borderRadius: 12, borderWidth: 2, borderColor: '#d1d5db', borderStyle: 'dashed', minHeight: 110, padding: 8, backgroundColor: '#fafafa' },
  zoneGood: { borderStyle: 'solid', borderColor: P.greenBorder, backgroundColor: P.greenSoft },
  zoneBad: { borderStyle: 'solid', borderColor: P.redBorder, backgroundColor: P.redBg },
  dropHeader: { paddingVertical: 5, paddingHorizontal: 6, borderRadius: 7, marginBottom: 7, alignItems: 'center' },
  dropHeaderGood: { backgroundColor: P.greenBg },
  dropHeaderBad: { backgroundColor: '#fee2e2' },
  dropHeaderText: { fontSize: 11, fontWeight: '700' },
  dropArea: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  dropChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14 },
  dropChipGood: { backgroundColor: P.greenBg },
  dropChipBad: { backgroundColor: '#fee2e2' },
  dropChipText: { fontSize: 11, fontWeight: '500', lineHeight: 15 },

  sortItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: P.cardBg, borderRadius: 12, borderWidth: 1.5, borderColor: P.border, marginBottom: 7 },
  sortItemOk: { borderColor: '#86efac', backgroundColor: P.greenSoft },
  sortItemWrong: { borderColor: '#fca5a5', backgroundColor: P.redBg },
  sortNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: P.indigo, alignItems: 'center', justifyContent: 'center' },
  sortNumText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  sortText: { flex: 1, fontSize: 12, color: P.body, lineHeight: 17 },
  sortArrows: { gap: 3 },
  sortBtn: { width: 30, height: 26, borderRadius: 7, borderWidth: 1, borderColor: P.border, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  sortBtnOff: { opacity: 0.25 },
  sortBtnText: { fontSize: 11, color: P.muted },

  builderWrap: { gap: 10 },
  builderRow: { backgroundColor: P.cardBg, borderWidth: 1, borderColor: P.border, borderRadius: 12, padding: 11 },
  builderLabel: { fontSize: 11, fontWeight: '700', color: P.indigoText, marginBottom: 6, letterSpacing: 0.3, textTransform: 'uppercase' },
  builderOpts: { gap: 5 },
  builderOpt: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 9, borderWidth: 1.5, borderColor: P.border, backgroundColor: '#fff' },
  builderOptSel: { borderColor: P.indigo, backgroundColor: P.indigoBg },
  builderOptText: { fontSize: 12, color: P.body, fontWeight: '500', lineHeight: 16 },
  builderOptTextSel: { color: P.indigoText, fontWeight: '700' },
  codeBox: { backgroundColor: P.codeBg, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#1e293b' },
  codeLine: { fontSize: 12, lineHeight: 20, marginBottom: 2 },
  codeText: { color: P.codeText, fontFamily: 'monospace' },
  codeKey: { color: P.codeKey, fontWeight: '700', fontFamily: 'monospace' },
  codeEmpty: { color: P.codeEmpty, fontStyle: 'italic', fontFamily: 'monospace' },

  quizQ: { ...typography.bold, fontSize: 13, color: P.ink, padding: 12, backgroundColor: P.cardBg, borderRadius: 10, borderWidth: 1, borderColor: P.border, marginBottom: 8, lineHeight: 19 },
  qopt: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 11, borderWidth: 1.5, borderColor: P.border, backgroundColor: '#fff', marginBottom: 7 },
  qoptSel: { borderColor: P.indigo, backgroundColor: P.indigoBg },
  qoptOk: { borderColor: P.green, backgroundColor: P.greenBg },
  qoptWrong: { borderColor: P.red, backgroundColor: P.redBg },
  qLetter: { width: 24, height: 24, borderRadius: 7, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: P.border, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  qLetterSel: { backgroundColor: P.indigo, borderColor: P.indigo },
  qLetterOk: { backgroundColor: P.green, borderColor: P.green },
  qLetterWrong: { backgroundColor: P.red, borderColor: P.red },
  qLetterText: { fontSize: 11, fontWeight: '700', color: P.muted },
  qoptText: { flex: 1, fontSize: 12, color: P.body, lineHeight: 17 },

  tfSet: { marginBottom: 16 },
  tfQ: { fontSize: 13, fontWeight: '700', color: P.ink, padding: 12, backgroundColor: P.cardBg, borderRadius: 10, borderWidth: 1, borderColor: P.border, marginBottom: 10, lineHeight: 19 },
  tfOpts: { flexDirection: 'row', gap: 8 },
  tfBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 2, borderColor: P.border, backgroundColor: '#fff', alignItems: 'center' },
  tfBtnTrue: { borderColor: P.green, backgroundColor: P.greenSoft },
  tfBtnFalse: { borderColor: P.red, backgroundColor: P.redBg },
  tfBtnCorrect: { borderColor: P.green, backgroundColor: P.greenBg },
  tfBtnWrong: { borderColor: P.red, backgroundColor: P.redBg },
  tfBtnText: { fontSize: 13, fontWeight: '700', color: P.body },

  sprintBox: { backgroundColor: P.orangeBg, borderWidth: 2, borderColor: P.orangeBorder, borderRadius: 14, padding: 14 },
  sprintTimer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, padding: 8, paddingHorizontal: 12, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: P.orangeBorder },
  sprintTime: { fontSize: 22, fontWeight: '800', color: '#c2410c' },
  sprintLabel: { flex: 1, fontSize: 11, color: P.orangeText },
  sprintItem: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, backgroundColor: '#fff', borderWidth: 1.5, borderColor: P.orangeBorder, borderRadius: 9 },
  sprintItemOk: { borderColor: P.green, backgroundColor: P.greenBg },
  sprintItemBad: { borderColor: P.red, backgroundColor: P.redBg },
  sprintMarker: { width: 22, height: 22, borderRadius: 6, backgroundColor: P.orangeBorder, alignItems: 'center', justifyContent: 'center' },
  sprintMarkerOk: { backgroundColor: P.green },
  sprintMarkerBad: { backgroundColor: P.red },
  sprintMarkerText: { fontSize: 11, fontWeight: '700', color: P.orangeText },
  sprintItemText: { flex: 1, fontSize: 12, color: P.body, lineHeight: 17 },

  scenarioBox: { backgroundColor: '#fffbeb', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: P.amberBorder },
  scenarioLabel: { fontSize: 10, fontWeight: '700', color: P.amberText, marginBottom: 8, letterSpacing: 0.7 },
  scenarioText: { fontSize: 13, color: P.body, lineHeight: 21 },
  scChoice: { borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: P.border, marginBottom: 8, backgroundColor: '#fff' },
  scChoiceSel: { borderColor: P.indigo, backgroundColor: P.indigoBg },
  scChoiceOk: { borderColor: P.green, backgroundColor: P.greenSoft },
  scChoiceWrong: { borderColor: P.red, backgroundColor: P.redBg },
  scTitle: { fontSize: 12, fontWeight: '700', color: P.ink, marginBottom: 4 },
  scText: { fontSize: 12, color: P.body, lineHeight: 17 },

  fillSentence: { fontSize: 14, color: P.body, lineHeight: 28 },
  fillBlank: { fontWeight: '700', color: P.indigoText, textDecorationLine: 'underline' },
  fillOpts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  fillOpt: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, borderColor: '#d1d5db', backgroundColor: '#fff' },
  fillOptSel: { borderColor: P.indigo, backgroundColor: P.indigoBg },
  fillOptOk: { borderColor: P.green, backgroundColor: P.greenBg },
  fillOptWrong: { borderColor: P.red, backgroundColor: P.redBg },
  fillOptText: { fontSize: 13, fontWeight: '600', color: P.body },

  compareCard: { borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: P.border, marginBottom: 8, backgroundColor: P.cardBg },
  compareSel: { borderColor: P.indigo, backgroundColor: P.indigoBg },
  compareCardDim: { opacity: 0.6 },
  compareCardOk: { borderColor: P.green, backgroundColor: P.greenSoft },
  compareLabel: { fontSize: 11, fontWeight: '700', color: P.indigoText, marginBottom: 5, letterSpacing: 0.4 },
  compareText: { fontSize: 12, color: P.body, lineHeight: 19 },
  compareQ: { fontSize: 13, fontWeight: '700', color: P.ink, marginTop: 4, marginBottom: 8 },
  compareBtns: { flexDirection: 'row', gap: 10 },
  compareBtn: { flex: 1, padding: 12, borderRadius: 11, borderWidth: 1.5, borderColor: P.border, backgroundColor: '#fff', alignItems: 'center' },
  compareBtnSel: { borderColor: P.indigo, backgroundColor: P.indigoBg },
  compareBtnText: { fontSize: 13, fontWeight: '700', color: P.indigoText },

  reflectArea: { minHeight: 120, padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: P.border, backgroundColor: '#fafafa', fontSize: 13, color: P.body, lineHeight: 22, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: P.faint, textAlign: 'right', marginTop: 4 },

  exCard: { borderRadius: 14, padding: 12, borderWidth: 1, borderColor: P.border, marginBottom: 8, backgroundColor: '#fff' },
  exCardOpen: { borderColor: P.indigo, backgroundColor: P.indigoBg },
  exHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exEmoji: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  exName: { fontSize: 13, fontWeight: '700', color: P.ink },
  exArrow: { fontSize: 18, color: P.faint },
  exBody: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: P.border },
  exHow: { fontSize: 12, color: P.body, lineHeight: 19, marginBottom: 8 },
  exFact: { backgroundColor: '#fef9c3', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#fde68a' },
  exFactText: { fontSize: 12, color: '#854d0e', fontWeight: '500', lineHeight: 17 },

  fb: { borderRadius: 10, padding: 11, marginTop: 8 },
  fbOk: { backgroundColor: P.greenBg },
  fbBad: { backgroundColor: P.redBg },
  fbOkText: { fontSize: 12, color: P.greenText, lineHeight: 18, fontWeight: '500' },
  fbBadText: { fontSize: 12, color: P.redText, lineHeight: 18, fontWeight: '500' },

  completeContainer: { alignItems: 'center', paddingTop: 8 },
  completeBadge: { width: 88, height: 88, borderRadius: 24, backgroundColor: P.indigo, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  completeTitle: { ...typography.extraBold, fontSize: 22, color: P.ink, marginBottom: 6, textAlign: 'center' },
  completeSub: { fontSize: 13, color: P.muted, textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  xpEarned: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 20, backgroundColor: '#fef9c3', borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#fde047', width: '100%' },
  xpEarnedText: { fontSize: 16, fontWeight: '700', color: '#854d0e' },
  skillsList: { gap: 7, marginBottom: 16, width: '100%' },
  skillRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 10, backgroundColor: P.greenSoft, borderRadius: 10, borderWidth: 1, borderColor: P.greenBorder },
  skillCheck: { color: P.green, fontSize: 15, fontWeight: '800' },
  skillText: { flex: 1, fontSize: 12, color: P.greenText, lineHeight: 17, fontWeight: '500' },
  nextHint: { padding: 12, backgroundColor: P.cardBg, borderRadius: 10, borderWidth: 1, borderColor: P.border, width: '100%', marginBottom: 14 },
  nextHintText: { fontSize: 12, color: P.body, lineHeight: 20 },
  lvlBarWrap: { width: '100%', marginBottom: 16 },
  lvlBarLabel: { fontSize: 11, color: P.muted, marginBottom: 5 },
  lvlBarOuter: { height: 7, backgroundColor: P.border, borderRadius: 4, overflow: 'hidden' },
  lvlBarInner: { height: '100%', backgroundColor: P.indigo, borderRadius: 4 },

  navRow: { flexDirection: 'row', gap: 8, padding: 14, borderTopWidth: 1, borderTopColor: '#f0f0f0', backgroundColor: '#fafafa' },
  backBtn: { paddingHorizontal: 16, paddingVertical: 13, borderRadius: 12, backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#e2e8f0', justifyContent: 'center' },
  backBtnText: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  primaryBtn: { backgroundColor: P.green, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
  primaryBtnAccent: { backgroundColor: P.indigo },
  primaryBtnOff: { opacity: 0.35 },
  primaryBtnText: { ...typography.bold, color: '#fff', fontSize: 15 },
});
