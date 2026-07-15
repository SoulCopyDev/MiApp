import { useState, useEffect, useRef, type ReactNode } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  Alert, BackHandler, Vibration, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useGameStore } from '../store/gameStore';
import { typography } from '../theme';
import { exitLevel } from '../utils/exitLevel';
import XPToast from '../components/XPToast';

// ===================== PALETA (tema claro verde/lima, Mundo 4 "El Gran Torneo") =====================
const C = {
  bg: '#f0fdf4', card: '#ffffff', card2: '#f8fafc',
  text: '#0f172a', muted: '#64748b', border: '#e2e8f0',
  green: '#16a34a', greenDark: '#15803d', greenLight: '#dcfce7', greenBorder: '#bbf7d0', lime: '#84cc16',
  okBg: '#dcfce7', okText: '#166534', okBorder: '#16a34a',
  failBg: '#fff1f2', failText: '#991b1b', failBorder: '#ef4444',
  amber: '#f59e0b', amberBg: '#fef3c7', amberText: '#92400e',
  placeholder: '#94a3b8',
};

// ===================== HELPERS =====================
const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function looksRandom(text: string): boolean {
  const words = normalize(text).split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return true;
  const noVowels = words.filter(w => w.length >= 4 && !/[aeiou]/.test(w));
  if (noVowels.length >= Math.max(1, Math.floor(words.length / 2))) return true;
  if (words.length >= 4) { const u = new Set(words); if (u.size / words.length < 0.5) return true; }
  return false;
}
function containsTopic(text: string, terms: string[]): boolean {
  const t = normalize(text);
  return terms.some(term => term.length <= 3 ? new RegExp(`\\b${term}\\b`).test(t) : t.includes(term));
}
const REFLECT_TERMS = ['chatgpt', 'ia', 'imagen', 'imagenes', 'voz', 'gpt', 'dall', 'estudiar', 'aprender', 'idioma', 'idiomas', 'codigo', 'archivo', 'usar', 'usaria', 'superpoder', 'herramienta', 'tarea', 'examen', 'practicar'];

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let j = a.length - 1; j > 0; j--) { const k = Math.floor(Math.random() * (j + 1)); [a[j], a[k]] = [a[k], a[j]]; }
  return a;
}
function shuffleOpts<T extends { opts: string[]; correct: number }>(q: T): T {
  const paired = q.opts.map((opt, i) => ({ opt, isCorrect: i === q.correct }));
  const sh = shuffle(paired);
  return { ...q, opts: sh.map(p => p.opt), correct: sh.findIndex(p => p.isCorrect) };
}
const pickN = <T,>(arr: T[], n: number): T[] => shuffle(arr).slice(0, n);

// ===================== DATOS (fieles al HTML nivel-19) =====================
type MatchPair = { left: string; right: string };
const MATCH_POOL: MatchPair[] = [
  { left: 'Crear una imagen desde cero con palabras', right: 'DALL-E (generador de imágenes)' },
  { left: 'Hablarle con voz y escuchar su respuesta', right: 'Modo de voz de ChatGPT' },
  { left: 'Un ChatGPT especial solo para matemáticas', right: 'GPTs personalizados' },
  { left: 'Subir un PDF y hacerle preguntas', right: 'Analizar archivos y documentos' },
  { left: 'Pedirle que programe una app sencilla', right: 'ChatGPT escribiendo código' },
];

const SORT_SESION = [
  'Abre ChatGPT y empieza una conversación nueva',
  'Define tu objetivo: quiero estudiar las capitales de Europa para mi examen del viernes',
  'Pide el plan: hazme un plan de 3 días con actividades divertidas cada día',
  'Elige lo que más te gusta del plan y pide que lo desarrolle en detalle',
  'Practica con preguntas: hazme un quiz de 10 preguntas de menor a mayor dificultad',
  'Termina con resumen: resume en 5 puntos lo más importante que estudié hoy',
];

type TFItem = { stmt: string; correct: boolean; explain: string };
const TF_POOL: TFItem[] = [
  { stmt: 'ChatGPT puede buscar noticias de hoy en internet sin ninguna configuración extra.', correct: false, explain: '¡Mito! La versión básica no busca en internet. Para noticias de hoy, usa Google o Gemini con búsqueda activada.' },
  { stmt: 'Puedes subir fotos a ChatGPT y pedirle que las describa o analice.', correct: true, explain: '¡Verdad! Con GPT-4o puedes subir imágenes. ChatGPT puede explicar lo que ve, analizar un gráfico o leer texto en una foto.' },
  { stmt: 'ChatGPT recuerda todo lo que hablaste en conversaciones de días anteriores.', correct: false, explain: '¡Mito! Cada conversación nueva empieza desde cero. Tienes que darle el contexto de nuevo cada vez.' },
  { stmt: 'Los GPTs personalizados son versiones de ChatGPT entrenadas para temas específicos.', correct: true, explain: '¡Verdad! Los GPTs son como apps dentro de ChatGPT. Hay GPTs para idiomas, matemáticas, cocina y miles de temas más.' },
  { stmt: 'GPT-4o es exactamente igual que GPT-3.5, solo con diferente nombre.', correct: false, explain: '¡Mito! Son muy diferentes. GPT-4o puede ver imágenes, usar voz, generar imágenes con DALL-E y razona mucho mejor.' },
  { stmt: 'DALL-E es la herramienta de ChatGPT para generar imágenes desde texto.', correct: true, explain: '¡Verdad! Describes lo que quieres ver y DALL-E crea la imagen en segundos. Solo disponible con GPT-4o.' },
  { stmt: 'Si ChatGPT te da una estadística, siempre es correcta y no necesitas verificar.', correct: false, explain: '¡Cuidado! ChatGPT puede alucinar e inventar datos que suenan reales. Siempre verifica los datos importantes.' },
  { stmt: 'Puedes usar ChatGPT para practicar un idioma nuevo conversando con él.', correct: true, explain: '¡Verdad! Uno de sus mejores usos. Puedes hablar en inglés, francés o cualquier idioma y pedirle que corrija tus errores.' },
  { stmt: 'ChatGPT puede escribir código de programación y explicar cómo funciona.', correct: true, explain: '¡Verdad! Puedes pedirle que escriba código en Python, que lo explique línea por línea o que encuentre errores.' },
  { stmt: 'Copiar la respuesta de ChatGPT y entregarla como tu tarea es una buena forma de aprender.', correct: false, explain: '¡Mito peligroso! Copiar no es aprender. Lo correcto es pedirle que te EXPLIQUE los conceptos para escribir con tus propias palabras.' },
];

type DetectiveItem = { task: string; respA: { text: string; hint: string }; respB: { text: string; hint: string }; cual4o: 'A' | 'B'; explain: string };
const DETECTIVE_POOL: DetectiveItem[] = [
  { task: 'Le preguntaron: ¿Qué es la fotosíntesis?',
    respA: { text: 'La fotosíntesis es el proceso por el cual las plantas convierten luz solar en energía. Toman CO2 del aire y agua del suelo, y con la luz producen glucosa y liberan oxígeno. Es como si las plantas tuvieran una fábrica solar dentro de cada hoja.', hint: 'Usa metáforas y lenguaje accesible' },
    respB: { text: 'La fotosíntesis es un proceso bioquímico en los cloroplastos. Involucra las fotorreacciones en los tilacoides y el ciclo de Calvin en el estroma. Ecuación general: 6CO2 + 6H2O + luz → C6H12O6 + 6O2.', hint: 'Respuesta técnica y formal' },
    cual4o: 'A', explain: 'La respuesta A es GPT-4o: usa analogías (fábrica solar), lenguaje claro y adapta la explicación. La B es correcta pero muy técnica, sin considerar quién pregunta.' },
  { task: 'Le pidieron: Ayúdame a planear mis vacaciones en Brasil',
    respA: { text: 'Para tus vacaciones en Brasil considera: 1) ¿Destino: playa (Río, Florianópolis) o naturaleza (Amazonas)? 2) Época: evita enero-marzo en Río por lluvias. 3) Presupuesto: hay opciones económicas fuera de zonas turísticas. ¿Cuántos días tienes y qué te emociona más?', hint: 'Hace preguntas personalizadas' },
    respB: { text: 'Brasil es un país hermoso. Río de Janeiro tiene el Cristo Redentor y Copacabana. São Paulo es la ciudad más grande. El Amazonas es la selva más grande del mundo. Hay muchas cosas para ver y hacer.', hint: 'Información genérica sin personalización' },
    cual4o: 'A', explain: 'La respuesta A es GPT-4o: da consejos específicos, anticipa problemas (lluvias) y hace preguntas para personalizar. La B es genérica y no te ayuda a planear nada concreto.' },
  { task: 'Le preguntaron: ¿Por qué el cielo es azul?',
    respA: { text: 'El cielo es azul porque el aire dispersa la luz azul más que otros colores. Es como si el aire fuera un filtro que esparce el azul en todas direcciones. Por eso al atardecer el cielo es naranja: la luz viaja más lejos y el azul ya no llega a tus ojos.', hint: 'Conecta con el atardecer también' },
    respB: { text: 'El cielo es azul por la dispersión de Rayleigh. Las moléculas de gas dispersan longitudes de onda cortas (azul) más que las largas (rojo). Por eso cuando miramos el cielo vemos luz azul dispersada en todas direcciones.', hint: 'Explicación correcta pero básica' },
    cual4o: 'A', explain: 'La respuesta A es GPT-4o: anticipa la pregunta del atardecer y usa una analogía del filtro. La B es correcta pero no va más allá de la pregunta inicial.' },
];

type QuizItem = { q: string; opts: string[]; correct: number; explain: string };
const QUIZ_POOL: QuizItem[] = [
  { q: 'Yuki, 11 años, de Tokio quiere aprender inglés con ChatGPT. ¿Cuál es el mejor prompt?',
    opts: ['Enséñame inglés', 'Eres un profesor de inglés paciente y divertido para niños de 11 años. Hablemos en inglés sobre videojuegos y corrígeme si me equivoco de forma amable.', 'Tradúceme palabras en inglés', 'Dame lecciones de inglés'],
    correct: 1, explain: 'El segundo usa la identidad (Truco 4) y el contexto específico. ChatGPT sabe exactamente cómo ayudar a Yuki.' },
  { q: 'Sofía, 10 años, de Madrid tiene tarea de historia. ¿Qué NO debe hacer con ChatGPT?',
    opts: ['Pedirle que explique el tema con ejemplos divertidos', 'Pedirle preguntas de práctica', 'Copiar la respuesta completa y entregarla como su tarea', 'Pedirle que simplifique un texto difícil'],
    correct: 2, explain: 'Copiar es trampa y no sirve para aprender. ChatGPT debe ser el profe que te guía, no el que hace la tarea por ti.' },
  { q: 'Lucas, 12 años, de Buenos Aires quiere crear una imagen de un dinosaurio en la ciudad. ¿Qué herramienta usa?',
    opts: ['El modo de voz', 'DALL-E, el generador de imágenes de ChatGPT', 'Los GPTs personalizados', 'La función de código'],
    correct: 1, explain: 'DALL-E convierte texto en imágenes. Lucas escribe la descripción y ChatGPT genera la imagen automáticamente. Solo funciona con GPT-4o.' },
  { q: '¿Para qué sirven los GPTs personalizados de ChatGPT?',
    opts: ['Para hacer ChatGPT más rápido', 'Para tener versiones entrenadas en temas específicos', 'Para guardar conversaciones entre sesiones', 'Para traducir textos mejor'],
    correct: 1, explain: 'Los GPTs son como apps dentro de ChatGPT. Hay miles especializados en cocina, idiomas, programación, matemáticas y mucho más.' },
  { q: 'Amara, 11 años, de Ghana quiere practicar matemáticas. ¿Cuál prompt es mejor?',
    opts: ['Ayúdame con mates', 'Hazme 5 problemas de multiplicación de fracciones para 5º grado. Cuando me equivoque no me des la respuesta, dame una pista para que yo lo descubra.', 'Explícame las matemáticas', 'Quiero aprender matemáticas'],
    correct: 1, explain: 'El segundo especifica el tema, el nivel, la cantidad y cómo quiere la ayuda (pistas, no respuestas). Cuanto más específico, mejor resultado.' },
  { q: 'ChatGPT dice que un personaje histórico dijo una frase famosa. ¿Qué debes hacer?',
    opts: ['Publicarlo de inmediato en redes sociales', 'Creértelo porque ChatGPT siempre tiene razón', 'Buscar la cita en una fuente confiable para verificarla', 'Pedirle más citas del mismo personaje'],
    correct: 2, explain: '¡Siempre verifica! ChatGPT puede alucinar e inventar citas que suenan reales. Para datos históricos, confirma en fuentes confiables.' },
  { q: '¿Qué ventaja tiene GPT-4o sobre GPT-3.5?',
    opts: ['Es completamente gratis siempre', 'Puede ver imágenes, razona mejor y tiene acceso a DALL-E', 'Recuerda todas tus conversaciones anteriores', 'Nunca se equivoca en ningún tema'],
    correct: 1, explain: 'GPT-4o puede ver imágenes, generar imágenes con DALL-E y razona mejor. Pero ninguna versión recuerda conversaciones anteriores y todas pueden equivocarse.' },
  { q: 'Kai, 10 años, de Japón quiere un juego de preguntas sobre animales. ¿Cuál prompt es mejor?',
    opts: ['Preguntas de animales', 'Hazme un juego de 10 preguntas sobre animales salvajes de África para niños de 10 años. Incluye 4 opciones y la respuesta correcta al final.', 'Dame información de animales', 'Animales salvajes África'],
    correct: 1, explain: 'Excelente prompt: especifica el tipo (juego), el tema, la audiencia (10 años), la cantidad (10) y el formato. Cuanto más específico, mejor resultado.' },
];

type FillItem = { before: string; after: string; opts: string[]; correct: number; explain: string };
const FILL_POOL: FillItem[] = [
  { before: 'La herramienta de ChatGPT que convierte texto en imágenes se llama ', after: '.', opts: ['DALL-E', 'Google', 'Bing', 'Stable'], correct: 0, explain: '"DALL-E" es la herramienta de OpenAI para generar imágenes. Está integrada en ChatGPT con GPT-4o.' },
  { before: 'Los ', after: ' son versiones de ChatGPT entrenadas para tareas específicas, como aprender idiomas.', opts: ['GPTs', 'Bots', 'Apps', 'Modos'], correct: 0, explain: '"GPTs" son como apps dentro de ChatGPT. Hay miles creados por la comunidad y por OpenAI.' },
  { before: 'Cuando ChatGPT inventa información falsa con total confianza, se llama ', after: '.', opts: ['alucinación', 'error', 'bug', 'trampa'], correct: 0, explain: '"Alucinación" es el término técnico. La IA predice texto que suena real pero puede ser completamente falso.' },
  { before: 'La versión más avanzada de ChatGPT actualmente se llama GPT-', after: '.', opts: ['4o', '3.5', '5', 'Ultra'], correct: 0, explain: '"GPT-4o" (la "o" es de "omni", que significa "todo") puede procesar texto, imágenes y voz.' },
  { before: 'La empresa que creó ChatGPT se llama ', after: '.', opts: ['OpenAI', 'Google', 'Microsoft', 'Apple'], correct: 0, explain: '"OpenAI" fundó ChatGPT en 2022. Microsoft invirtió en ellos, por eso Bing y Copilot usan su tecnología.' },
  { before: 'Para que ChatGPT responda como un experto, le das una ', after: ' como "eres un profe de física divertido".', opts: ['identidad', 'contraseña', 'imagen', 'canción'], correct: 0, explain: '"Identidad" o rol. Darle una identidad específica cambia completamente su forma de responder. ¡Es el Truco 4 del Nivel 7!' },
];

const SPRINT_POOL: TFItem[] = [
  { stmt: 'ChatGPT puede generar imágenes usando DALL-E', correct: true, explain: '' },
  { stmt: 'ChatGPT recuerda automáticamente todas tus conversaciones anteriores', correct: false, explain: '' },
  { stmt: 'GPT-4o puede analizar imágenes que le envías', correct: true, explain: '' },
  { stmt: 'Copiar la respuesta de ChatGPT y entregarla como tu tarea es correcto', correct: false, explain: '' },
  { stmt: 'Los GPTs personalizados son versiones especializadas de ChatGPT', correct: true, explain: '' },
  { stmt: 'ChatGPT siempre dice la verdad y nunca se equivoca', correct: false, explain: '' },
  { stmt: 'Puedes hablarle a ChatGPT con tu voz usando el modo de voz', correct: true, explain: '' },
  { stmt: 'ChatGPT puede ayudarte a escribir código de programación', correct: true, explain: '' },
  { stmt: 'GPT-3.5 y GPT-4o son exactamente iguales en capacidades', correct: false, explain: '' },
  { stmt: 'Es buena idea verificar los datos importantes que te da ChatGPT', correct: true, explain: '' },
  { stmt: 'Puedes pedirle a ChatGPT que te haga un quiz para estudiar', correct: true, explain: '' },
  { stmt: 'ChatGPT conoce resultados de partidos de ayer sin buscar en internet', correct: false, explain: '' },
];

type EthicsItem = { scenario: string; correct: 'safe' | 'doubt' | 'bad'; explain: string };
const ETHICS_POOL: EthicsItem[] = [
  { scenario: 'Emma, 11, de París le pide a ChatGPT que explique la Revolución Francesa como una historia de superhéroes para entenderla mejor.', correct: 'safe', explain: '¡Uso perfecto! Pedir explicaciones creativas ayuda a entender temas difíciles. Emma va a aprender mucho más así.' },
  { scenario: 'Ryo, 12, de Tokio usa ChatGPT para que le escriba su ensayo completo sobre el medio ambiente y lo entrega como si fuera suyo.', correct: 'bad', explain: 'Trampa académica. Ryo no aprende nada y engaña a su profe. Lo correcto: pedirle que explique y ayude a organizar ideas, pero escribir con sus palabras.' },
  { scenario: 'Valentina, 10, de Lima le pregunta a ChatGPT si un hongo que encontró en el bosque es venenoso para decidir si se lo come.', correct: 'bad', explain: '¡Peligroso! ChatGPT puede equivocarse identificando plantas y hongos. Para salud y seguridad, siempre consulta a un adulto real.' },
  { scenario: 'Oliver, 11, de Londres usa ChatGPT para practicar conversación en español y le pide que corrija sus errores de gramática.', correct: 'safe', explain: '¡Uso excelente! Practicar idiomas con ChatGPT es de sus mejores usos. Oliver tiene un compañero de conversación infinitamente paciente.' },
  { scenario: 'Priya, 12, de Mumbai le pide a ChatGPT la contraseña de su correo porque la olvidó.', correct: 'bad', explain: 'ChatGPT no puede recuperar contraseñas de cuentas externas. Nunca compartas contraseñas con ninguna app. Usa "olvidé mi contraseña".' },
];

const IMG_OPTIONS: Record<'estilo' | 'objeto' | 'ambiente' | 'emocion', string[]> = {
  estilo: ['Dibujo animado colorido estilo anime', 'Pintura realista como fotografía', 'Arte digital con colores neón brillantes', 'Acuarela suave con colores pastel', 'Ilustración de libro infantil'],
  objeto: ['un robot bailando salsa', 'un gato astronauta explorando Marte', 'un dragón leyendo libros en una biblioteca', 'un pingüino haciendo surf en el Ártico', 'una tortuga volando con globos de colores'],
  ambiente: ['en una ciudad futurista llena de luces', 'en un bosque mágico encantado', 'en el fondo del océano entre peces tropicales', 'en el espacio con planetas de colores', 'en un mercado medieval con castillos al fondo'],
  emocion: ['con expresión alegre y emocionada', 'con cara de sorpresa y ojos enormes', 'con sonrisa tranquila y relajada', 'con cara de concentración total', 'con expresión de misterio y curiosidad'],
};
const IMG_LABELS: Record<'estilo' | 'objeto' | 'ambiente' | 'emocion', string> = {
  estilo: 'El estilo artístico', objeto: 'El personaje u objeto', ambiente: 'El lugar o ambiente', emocion: 'La emoción o atmósfera',
};

type SesionStep = { label: string; q: string; opts: string[]; correct: number; fb_ok: string; fb_no: string };
const SESION_STEPS: SesionStep[] = [
  { label: 'Paso 1 de 4 · El objetivo', q: 'Tienes un examen de geografía sobre continentes en 3 días. ¿Cómo empiezas la sesión con ChatGPT?',
    opts: ['Hazme el examen ya', 'Tengo un examen sobre los 7 continentes en 3 días. ¿Puedes ayudarme a crear un plan de estudio divertido de 3 días con actividades diferentes cada día?', 'Dime los continentes', 'Estudia geografía conmigo'],
    correct: 1, fb_ok: '¡Perfecto! Le das el contexto completo: tema, tiempo disponible y pides un plan estructurado. ¡ChatGPT puede crear algo genial con eso!', fb_no: 'Ese prompt es muy vago. Sin saber el tema exacto y el tiempo disponible, ChatGPT no puede ayudarte tan bien.' },
  { label: 'Paso 2 de 4 · El truco', q: 'ChatGPT te da el plan pero las explicaciones son muy aburridas. ¿Qué haces?',
    opts: ['Cierro ChatGPT y estudio con mi libro', 'Eres un explorador geográfico para niños de 11 años. Explícame cada continente como si fuera un mundo diferente en un videojuego con sus características únicas.', 'Explícame mejor', 'Dame más información'],
    correct: 1, fb_ok: '¡Brillante! Usas el Truco 4 (darle identidad) para hacer las explicaciones mucho más divertidas. ¡ChatGPT transforma los continentes en mundos de videojuego!', fb_no: 'Puedes hacerlo mejor. Recuerda el Truco 4: darle una identidad específica cambia completamente cómo explica las cosas.' },
  { label: 'Paso 3 de 4 · La práctica', q: 'Ya entendiste los continentes. ¿Cómo practicas con ChatGPT?',
    opts: ['Hazme el examen completo con todas las respuestas', 'Hazme un quiz de 10 preguntas sobre los 7 continentes de menor a mayor dificultad. Cuando me equivoque, dame una pista antes de la respuesta correcta.', 'Dame un resumen de todo', '¿Cuáles son las respuestas del examen?'],
    correct: 1, fb_ok: '¡Excelente estrategia! Pides un quiz con dificultad progresiva y pistas en lugar de respuestas directas. Así tu cerebro trabaja y aprende de verdad.', fb_no: 'Pedir las respuestas no es estudiar. El cerebro aprende cuando se esfuerza. Pide preguntas de práctica, no las respuestas.' },
  { label: 'Paso 4 de 4 · El cierre', q: 'Terminaste de estudiar. ¿Cómo cierras la sesión de forma inteligente?',
    opts: ['Cierro el chat sin más', 'Resume en 5 puntos las cosas más importantes que estudié hoy sobre los continentes y dime qué temas debo repasar mañana.', 'Gracias, adiós', '¿Cuándo es mi examen?'],
    correct: 1, fb_ok: '¡Cierre perfecto! Pides un resumen que consolida lo aprendido y planeas el siguiente día. ¡Eso es estudiar de forma inteligente con IA!', fb_no: 'Cerrar sin revisar es perder lo aprendido. Un buen resumen al final fija mejor la información en tu memoria.' },
];

// Módulo 2 · 5 superpoderes (tarjetas expandibles con historia real, fieles al HTML)
type ExCardItem = { emoji: string; name: string; sub: string; tag: string; how: string; howBold: string; fact: string };
const EX_CARDS: ExCardItem[] = [
  { emoji: '🎨', name: 'Superpoder 1: Crear imágenes', sub: 'Dibuja cualquier cosa con DALL-E', tag: 'DALL-E',
    how: 'Lena, 11 años, de Berlín necesitaba una imagen de un volcán para su presentación de geografía. Le escribió a ChatGPT: "Dibuja un volcán en erupción visto desde arriba, estilo ilustración científica colorida." En 10 segundos tenía la imagen perfecta. ',
    howBold: '¡Sin saber dibujar, sin buscar en Google!',
    fact: 'Para usar DALL-E necesitas GPT-4o. Cuanto más detallada sea tu descripción, mejor sale la imagen.' },
  { emoji: '🎤', name: 'Superpoder 2: Modo de voz', sub: 'Habla y escucha como una conversación real', tag: 'VOZ',
    how: 'Yuki, 11 años, de Tokio quiere mejorar su inglés. Activa el modo de voz y le dice en inglés: "Hablemos sobre mi anime favorito. Corrígeme si me equivoco." ChatGPT responde en voz y lo corrige suavemente. ',
    howBold: '¡Mejor que muchas clases!',
    fact: 'El modo de voz está en la app móvil de ChatGPT. Pulsa el ícono de ondas de audio para activarlo.' },
  { emoji: '🧩', name: 'Superpoder 3: GPTs personalizados', sub: 'Apps especializadas dentro de ChatGPT', tag: 'GPTs',
    how: 'Carlos, 12 años, de Ciudad de México descubrió el GPT "Math Tutor". En lugar de dar respuestas directas, hace preguntas para que Carlos llegue solo a la solución. ',
    howBold: 'Aprendió más en 20 minutos que en una hora con el libro.',
    fact: 'Hay miles de GPTs. Haz clic en "Explorar GPTs" en el menú de ChatGPT. ¡Hay GPTs de cocina, idiomas, arte, programación y mucho más!' },
  { emoji: '📄', name: 'Superpoder 4: Leer y analizar archivos', sub: 'Sube documentos o fotos para que los analice', tag: 'ARCHIVOS',
    how: 'Amara, 12 años, de Ghana tenía que leer un artículo científico de 20 páginas para su clase. Subió el PDF a ChatGPT y escribió: "Resume este artículo en 5 puntos para alguien de 12 años." ',
    howBold: 'En 30 segundos tenía el resumen perfecto.',
    fact: 'Puedes subir PDFs, imágenes, archivos de texto y fotos de tu cuaderno. ¡Pero lee el original también para aprender de verdad!' },
  { emoji: '💻', name: 'Superpoder 5: Escribir código', sub: 'Para crear apps, juegos y programas', tag: 'CÓDIGO',
    how: 'Oliver, 11 años, de Londres quería hacer un juego de "adivina el número" en Python. Le pidió a ChatGPT: "Escribe el juego y explícame cada línea del código." ',
    howBold: '¡Oliver aprendió a programar jugando!',
    fact: 'ChatGPT puede escribir código en más de 50 lenguajes. También puede encontrar errores en tu código y explicarte cómo arreglarlos.' },
];

const DRAG_POOL: { text: string; correct: '35' | '4o' }[] = [
  { text: 'Subir una foto de mi examen para que la corrija', correct: '4o' },
  { text: 'Preguntar cuánto es 15% de 200 pesos', correct: '35' },
  { text: 'Pedirle que genere una imagen de un volcán', correct: '4o' },
  { text: 'Hacer un resumen de un texto que le pego', correct: '35' },
  { text: 'Analizar un gráfico de mi trabajo de ciencias', correct: '4o' },
  { text: 'Pedir ideas para un proyecto escolar', correct: '35' },
  { text: 'Hablarle por voz y que me responda con voz', correct: '4o' },
  { text: 'Preguntar cómo se dice "hola" en japonés', correct: '35' },
];

const TOTAL_STEPS = 22;   // 0=intro … 21=completado
const CONTENT_STEPS = 20;
const SPRINT_DURATION = 60;

export default function Level19() {
  const completeLevel = useGameStore(s => s.completeLevel);
  const devMode = useGameStore(s => s.devMode);

  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);
  const [xpToast, setXpToast] = useState<{ amount: number; id: number } | null>(null);
  const awardedSteps = useRef<Set<number>>(new Set());

  // Pools (fijos por sesión)
  const [matchPairs] = useState(() => pickN(MATCH_POOL, 4));
  const [tfItems] = useState(() => pickN(TF_POOL, 5));
  const [quizItems] = useState(() => pickN(QUIZ_POOL, 5).map(shuffleOpts));
  const [fillItems] = useState(() => pickN(FILL_POOL, 4).map(shuffleOpts));
  const [ethicsItems] = useState(() => pickN(ETHICS_POOL, 5));
  const [sesSteps] = useState(() => SESION_STEPS.map(shuffleOpts));
  const [dragItems] = useState(() => pickN(DRAG_POOL, 6));
  const [rightOrder] = useState(() => shuffle(matchPairs.map((p, i) => ({ idx: i, text: p.right }))));

  // Detective
  const [detQ, setDetQ] = useState(0);
  const [detSel, setDetSel] = useState<'A' | 'B' | null>(null);
  const [detCorrect, setDetCorrect] = useState(0);
  const [detDone, setDetDone] = useState(false);

  // Drag
  const [ddPlaced, setDdPlaced] = useState<{ [idx: number]: '35' | '4o' }>({});
  const [ddSel, setDdSel] = useState<number | null>(null);
  const [ddChecked, setDdChecked] = useState(false);
  const [ddSolved, setDdSolved] = useState(false);
  const [ddOverZone, setDdOverZone] = useState<'35' | '4o' | null>(null);
  const ddPlacedRef = useRef(ddPlaced);
  useEffect(() => { ddPlacedRef.current = ddPlaced; }, [ddPlaced]);
  const ddIdxRef = useRef<number | null>(null);
  const ddAllPlaced = dragItems.every((_, i) => ddPlaced[i] !== undefined);

  // Matching
  const [matchSel, setMatchSel] = useState<number | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [matchWrong, setMatchWrong] = useState<{ left: number; right: number } | null>(null);

  // Módulo 2 · acordeón de superpoderes
  const [openEx, setOpenEx] = useState<number | null>(null);

  // Image builder
  const [imgState, setImgState] = useState({ estilo: '', objeto: '', ambiente: '', emocion: '' });

  // Sort
  const [sortOrder, setSortOrder] = useState<number[]>(() => shuffle([0, 1, 2, 3, 4, 5]));
  const [sortSolved, setSortSolved] = useState(false);
  const [sortWrong, setSortWrong] = useState<Set<number>>(new Set());

  // VF / Quiz
  const [vfAns, setVfAns] = useState<Record<number, boolean>>({});
  const [vfChecked, setVfChecked] = useState(false);
  const [vfScore, setVfScore] = useState(0);
  const [quizAns, setQuizAns] = useState<Record<number, number>>({});
  const [quizChecked, setQuizChecked] = useState(false);
  const [quizScore, setQuizScore] = useState(0);

  // Ethics
  const [ethQ, setEthQ] = useState(0);
  const [ethSel, setEthSel] = useState<string | null>(null);
  const [ethCorrect, setEthCorrect] = useState(0);
  const [ethDone, setEthDone] = useState(false);

  // Fill
  const [fillAns, setFillAns] = useState<Record<number, number>>({});

  // Sprint
  const [sprintItems] = useState(() => shuffle(SPRINT_POOL));
  const [sprintPhase, setSprintPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [sprintSec, setSprintSec] = useState(SPRINT_DURATION);
  const [sprintIdx, setSprintIdx] = useState(0);
  const [sprintAns, setSprintAns] = useState<boolean | null>(null);
  const sprintScoreRef = useRef(0);
  const [sprintScore, setSprintScore] = useState(0);

  // Sesión
  const [sesQ, setSesQ] = useState(0);
  const [sesSel, setSesSel] = useState<number | null>(null);
  const [sesCorrect, setSesCorrect] = useState(0);
  const [sesDone, setSesDone] = useState(false);

  // Reflexión
  const [reflectText, setReflectText] = useState('');
  const [reflectDone, setReflectDone] = useState(false);
  const [reflectError, setReflectError] = useState<string | null>(null);

  const addXP = (v: number) => {
    if (v <= 0) return;
    setXp(p => p + v);
    setXpToast(prev => ({ amount: v, id: (prev?.id ?? 0) + 1 }));
  };
  const awardStep = (amount: number) => {
    if (awardedSteps.current.has(step)) return;
    awardedSteps.current.add(step);
    addXP(amount);
  };

  const theorySteps = new Set([1, 2, 4, 6, 8, 11, 13, 15]);
  const showBack = theorySteps.has(step);

  useEffect(() => {
    const onBack = () => {
      if (showBack && step > 0) { setStep(s => s - 1); return true; }
      if (step > 0 && step < TOTAL_STEPS - 1) {
        Alert.alert('Módulo en curso', 'No puedes regresar durante esta actividad.', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Salir', style: 'destructive', onPress: () => exitLevel({ confirm: false }) },
        ]);
        return true;
      }
      return false;
    };
    const h = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => h.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, showBack]);

  // Sprint timer
  useEffect(() => {
    if (sprintPhase !== 'running') return;
    if (sprintSec <= 0) { finishSprint(); return; }
    const t = setTimeout(() => setSprintSec(s => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sprintPhase, sprintSec]);

  // Drag & drop web (mouse) — el shim táctil global se apoya en estos listeners para móvil
  useEffect(() => {
    if (Platform.OS !== 'web' || step !== 5 || ddSolved) return;
    const cleanups: (() => void)[] = [];
    const setup = () => {
      dragItems.forEach((_, idx) => {
        if (ddPlacedRef.current[idx] !== undefined) return;
        const el = document.getElementById(`dd-chip-${idx}`);
        if (!el) return;
        el.setAttribute('draggable', 'true');
        (el as HTMLElement).style.cursor = 'grab';
        const onDragStart = (e: DragEvent) => { ddIdxRef.current = idx; setDdSel(null); if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(idx)); } };
        const onDragEnd = () => { ddIdxRef.current = null; setDdOverZone(null); };
        el.addEventListener('dragstart', onDragStart);
        el.addEventListener('dragend', onDragEnd);
        cleanups.push(() => { el.removeEventListener('dragstart', onDragStart); el.removeEventListener('dragend', onDragEnd); });
      });
      (['35', '4o'] as const).forEach(zone => {
        const el = document.getElementById(`dd-zone-${zone}`);
        if (!el) return;
        const onOver = (e: Event) => { e.preventDefault(); setDdOverZone(zone); };
        const onLeave = (e: DragEvent) => { if (!el.contains(e.relatedTarget as Node)) setDdOverZone(null); };
        const onDrop = (e: Event) => { e.preventDefault(); setDdOverZone(null); const idx = ddIdxRef.current; if (idx === null || ddPlacedRef.current[idx] !== undefined) return; setDdPlaced(p => ({ ...p, [idx]: zone })); ddIdxRef.current = null; };
        el.addEventListener('dragover', onOver);
        el.addEventListener('dragleave', onLeave);
        el.addEventListener('drop', onDrop);
        cleanups.push(() => { el.removeEventListener('dragover', onOver); el.removeEventListener('dragleave', onLeave); el.removeEventListener('drop', onDrop); });
      });
    };
    const t = setTimeout(setup, 50);
    return () => { clearTimeout(t); cleanups.forEach(fn => fn()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, ddPlaced, ddSolved]);

  const next = () => { if (step < TOTAL_STEPS - 1) setStep(s => s + 1); };
  const prev = () => { if (step > 0) setStep(s => s - 1); };
  const finish = () => {
    const stars = xp >= 190 ? 3 : xp >= 120 ? 2 : 1;
    completeLevel(19, stars, xp);
    router.replace('/level/20');
  };

  // ---------- Acciones ----------
  const answerDet = (side: 'A' | 'B') => {
    if (detSel !== null) return;
    setDetSel(side);
    const item = DETECTIVE_POOL[detQ];
    const ok = side === item.cual4o;
    const running = detCorrect + (ok ? 1 : 0);
    if (ok) setDetCorrect(running);
    if (Platform.OS === 'android') Vibration.vibrate(60);
    setTimeout(() => {
      if (detQ + 1 < DETECTIVE_POOL.length) { setDetQ(q => q + 1); setDetSel(null); }
      else { setDetDone(true); awardStep(running >= 3 ? 20 : running >= 2 ? 12 : 5); }
    }, 1400);
  };

  const ddPlace = (zone: '35' | '4o') => {
    if (ddSel === null || ddPlaced[ddSel] !== undefined || ddSolved) return;
    setDdPlaced(p => ({ ...p, [ddSel]: zone }));
    setDdSel(null);
  };
  const ddReturn = (idx: number) => {
    if (ddSolved) return;
    setDdChecked(false);
    setDdPlaced(p => { const n = { ...p }; delete n[idx]; return n; });
  };
  const ddAllCorrect = dragItems.every((it, i) => ddPlaced[i] === it.correct);
  const verifyDd = () => {
    setDdChecked(true);
    if (dragItems.every((it, i) => ddPlaced[i] === it.correct)) { setDdSolved(true); awardStep(20); }
  };

  const pressRight = (correctIdx: number, rightPos: number) => {
    if (matchSel === null) return;
    if (matchSel === correctIdx) {
      const n = new Set(matched); n.add(matchSel); setMatched(n); setMatchSel(null);
      if (n.size === matchPairs.length) awardStep(20);
    } else {
      const l = matchSel; setMatchWrong({ left: l, right: rightPos });
      setTimeout(() => { setMatchWrong(null); setMatchSel(null); }, 600);
    }
  };

  const imgComplete = Object.values(imgState).every(v => v.length > 0);
  const imgPrompt = imgComplete ? `${imgState.estilo}, ${imgState.objeto} ${imgState.ambiente}, ${imgState.emocion}. Alta calidad, detallado.` : '';

  const moveSort = (pos: number, dir: number) => {
    if (sortSolved) return;
    const np = pos + dir; if (np < 0 || np >= sortOrder.length) return;
    const n = [...sortOrder]; [n[pos], n[np]] = [n[np], n[pos]]; setSortOrder(n); setSortWrong(new Set());
  };
  const checkSort = () => {
    if (sortOrder.every((v, i) => v === i)) { setSortSolved(true); awardStep(15); }
    else {
      const w = new Set(sortOrder.reduce<number[]>((a, v, i) => { if (v !== i) a.push(i); return a; }, []));
      setSortWrong(w); setTimeout(() => setSortWrong(new Set()), 3000);
    }
  };

  const checkVF = () => {
    setVfChecked(true);
    const c = tfItems.reduce((a, it, i) => a + (vfAns[i] === it.correct ? 1 : 0), 0);
    setVfScore(c); awardStep(c * 5);
  };
  const checkQuiz = () => {
    setQuizChecked(true);
    const c = quizItems.reduce((a, q, i) => a + (quizAns[i] === q.correct ? 1 : 0), 0);
    setQuizScore(c); awardStep(c * 8);
  };

  const answerEth = (val: string) => {
    if (ethSel !== null) return;
    setEthSel(val);
    const item = ethicsItems[ethQ];
    const ok = val === item.correct;
    const running = ethCorrect + (ok ? 1 : 0);
    if (ok) setEthCorrect(running);
    setTimeout(() => {
      if (ethQ + 1 < ethicsItems.length) { setEthQ(q => q + 1); setEthSel(null); }
      else { setEthDone(true); awardStep(running >= 4 ? 20 : running >= 3 ? 12 : 5); }
    }, 1400);
  };

  const selectFill = (qi: number, oi: number) => {
    if (fillAns[qi] !== undefined) return;
    setFillAns(p => ({ ...p, [qi]: oi }));
    if (oi === fillItems[qi].correct) addXP(7);
  };

  const answerSprint = (val: boolean) => {
    if (sprintPhase !== 'running' || sprintAns !== null) return;
    setSprintAns(val);
    if (val === sprintItems[sprintIdx].correct) { sprintScoreRef.current += 1; setSprintScore(sprintScoreRef.current); }
    setTimeout(() => {
      if (sprintIdx + 1 < sprintItems.length) { setSprintIdx(i => i + 1); setSprintAns(null); }
      else finishSprint();
    }, 500);
  };
  function finishSprint() {
    if (sprintPhase === 'done') return;
    setSprintPhase('done');
    const s = sprintScoreRef.current;
    awardStep(s >= 10 ? 25 : s >= 7 ? 18 : s >= 4 ? 12 : 5);
  }

  const answerSes = (oi: number) => {
    if (sesSel !== null) return;
    setSesSel(oi);
    const s = sesSteps[sesQ];
    const ok = oi === s.correct;
    const running = sesCorrect + (ok ? 1 : 0);
    if (ok) setSesCorrect(running);
    setTimeout(() => {
      if (sesQ + 1 < sesSteps.length) { setSesQ(q => q + 1); setSesSel(null); }
      else { setSesDone(true); awardStep(running >= 3 ? 25 : running >= 2 ? 15 : 8); }
    }, 1600);
  };

  const submitReflect = () => {
    const t = reflectText.trim();
    if (t.length < 80) { setReflectError('Escribe un poco más — al menos 80 caracteres.'); return; }
    if (looksRandom(t)) { setReflectError('Tu texto parece escrito al azar. Cuéntalo con tus propias palabras.'); return; }
    if (!containsTopic(t, REFLECT_TERMS)) { setReflectError('⚠️ Habla de ChatGPT: qué superpoder usarías (imágenes, voz, estudiar, idiomas...) y para qué.'); return; }
    setReflectError(null); setReflectDone(true); awardStep(15);
  };

  // ---------- Bloques auxiliares ----------
  const Tag = ({ children }: { children: ReactNode }) => (
    <View style={styles.tag}><Text style={styles.tagText}>{children}</Text></View>
  );
  const Title = ({ children }: { children: ReactNode }) => <Text style={styles.title}>{children}</Text>;
  const Body = ({ children }: { children: ReactNode }) => <Text style={styles.body}>{children}</Text>;
  const B = ({ children }: { children: ReactNode }) => <Text style={styles.bold}>{children}</Text>;
  const Card = ({ children, tint }: { children: ReactNode; tint?: string }) => (
    <View style={[styles.infoCard, tint ? { backgroundColor: tint } : null]}>{children}</View>
  );
  const Fb = ({ ok, children }: { ok: boolean; children: ReactNode }) => (
    <View style={[styles.fb, ok ? styles.fbOk : styles.fbFail]}>
      <Text style={[styles.fbText, { color: ok ? C.okText : C.failText }]}>{children}</Text>
    </View>
  );
  const SectionTitle = ({ children }: { children: ReactNode }) => <Text style={styles.sectionTitle}>{children}</Text>;
  const StepItem = ({ n, children }: { n: number; children: ReactNode }) => (
    <View style={styles.stepRow}>
      <View style={styles.stepNum}><Text style={styles.stepNumText}>{n}</Text></View>
      <Text style={styles.stepText}>{children}</Text>
    </View>
  );
  // Tarjeta con chip de ícono (card-row del HTML)
  const CardRow = ({ icon, iconBg, title, tint, tintBorder, children }: { icon: string; iconBg: string; title?: string; tint?: string; tintBorder?: string; children: ReactNode }) => (
    <View style={[styles.crCard, tint ? { backgroundColor: tint } : null, tintBorder ? { borderColor: tintBorder } : null]}>
      <View style={styles.crRow}>
        <View style={[styles.crIcon, { backgroundColor: iconBg }]}><Text style={styles.crIconText}>{icon}</Text></View>
        <View style={{ flex: 1 }}>
          {title ? <Text style={styles.crTitle}>{title}</Text> : null}
          <Text style={styles.crText}>{children}</Text>
        </View>
      </View>
    </View>
  );
  const HL_TEXT: Record<string, string> = { green: '#166534', lime: '#365314', amber: '#92400e', red: '#991b1b' };
  const HL_BG: Record<string, string> = { green: '#f0fdf4', lime: '#f7fee7', amber: '#fffbeb', red: '#fff1f2' };
  const HL_BORDER: Record<string, string> = { green: C.green, lime: C.lime, amber: C.amber, red: C.failBorder };
  const HlBox = ({ variant, children }: { variant: 'green' | 'lime' | 'amber' | 'red'; children: ReactNode }) => (
    <View style={[styles.hlBox, { backgroundColor: HL_BG[variant], borderLeftColor: HL_BORDER[variant] }]}>
      <Text style={[styles.hlText, { color: HL_TEXT[variant] }]}>{children}</Text>
    </View>
  );

  const renderStep = (): ReactNode => {
    switch (step) {
      case 0: return (
        <>
          <View style={styles.iconCircle}><Text style={styles.iconEmoji}>💬</Text></View>
          <Title>¡ChatGPT: tu compañero de aventuras!</Title>
          <Text style={styles.subtitle}>Ya conoces los trucos del prompting. Ahora vas a conocer a fondo a ChatGPT, el LLM más famoso del mundo, y todas sus herramientas secretas.</Text>
          <CardRow icon="🌟" iconBg="#86efac" tint={C.greenLight} tintBorder={C.greenBorder} title="¿Por qué ChatGPT es tan famoso?">Lo usa gente de más de 180 países, desde niños aprendiendo idiomas en Japón hasta científicos en Australia. ¡Más de 100 millones de personas lo usan cada mes!</CardRow>
          <CardRow icon="🆕" iconBg="#d9f99d" tint="#f7fee7" tintBorder="#d9f99d" title="3 mecánicas nuevas hoy">Modo Detective (detecta cuál es GPT-4o) + Constructor de Imagen para DALL-E + Mi Sesión Perfecta de estudio</CardRow>
          <CardRow icon="⭐" iconBg="#e2e8f0" tint={C.card2} title="Hasta 265 XP · 20 módulos · Nivel 19 de 36">{'Mundo 4: El Gran Torneo de Herramientas'}</CardRow>
        </>
      );

      case 1: return (
        <>
          <Tag>📖 Módulo 1 · ¿Por qué ChatGPT?</Tag>
          <Title>¿Qué hace especial a ChatGPT?</Title>
          <Body>ChatGPT no es solo un asistente, es como una navaja suiza digital. Puede hacer muchísimas cosas que otros LLMs no hacen igual. Lo creó la empresa <B>OpenAI</B> en 2022 y cambió el mundo para siempre.</Body>
          <StepItem n={1}><B>Genera imágenes:</B> Con DALL-E puedes pedirle que dibuje cualquier cosa que imagines. ¡Escribe la descripción y aparece la imagen!</StepItem>
          <StepItem n={2}><B>Habla con tu voz:</B> El modo de voz te permite hablar y escuchar a ChatGPT como si fuera un amigo. Perfecto para practicar idiomas.</StepItem>
          <StepItem n={3}><B>GPTs personalizados:</B> Son como apps dentro de ChatGPT. Hay GPTs para cocinar, aprender matemáticas, hacer arte y miles de cosas más.</StepItem>
          <StepItem n={4}><B>Analiza archivos:</B> Puedes subir un PDF o una foto de tu tarea y pedirle que lo explique, resuma o corrija.</StepItem>
          <StepItem n={5}><B>Escribe código:</B> Si algún día quieres crear una app, ChatGPT puede escribir el código y explicarte cómo funciona.</StepItem>
          <HlBox variant="green"><B>¿Gratis o de pago?</B>{'\n'}La versión gratuita (GPT-3.5 y algo de GPT-4o) ya es muy poderosa. La versión de pago (Plus) te da acceso completo a GPT-4o sin límites.</HlBox>
        </>
      );

      case 2: return (
        <>
          <Tag>🌟 Módulo 2 · Los superpoderes</Tag>
          <Title>Los 5 superpoderes de ChatGPT</Title>
          <Text style={styles.subtitle}>¡Toca cada superpoder para ver cómo usarlo en tu vida real!</Text>
          {EX_CARDS.map((ex, i) => {
            const open = openEx === i;
            return (
              <View key={i} style={[styles.exCard, open && styles.exCardOpen]}>
                <TouchableOpacity activeOpacity={0.8} style={styles.exHead} onPress={() => setOpenEx(open ? null : i)}>
                  <View style={styles.exEmoji}><Text style={styles.exEmojiText}>{ex.emoji}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.exName}>{ex.name}</Text>
                    <Text style={styles.exSub}>{ex.sub}</Text>
                  </View>
                  <Text style={[styles.exArr, open && { transform: [{ rotate: '90deg' }] }]}>›</Text>
                </TouchableOpacity>
                {open && (
                  <View style={styles.exBody}>
                    <View style={styles.exTag}><Text style={styles.exTagText}>{ex.tag}</Text></View>
                    <Text style={styles.exHow}>{ex.how}<B>{ex.howBold}</B></Text>
                    <View style={styles.exFact}><Text style={styles.exFactText}>{ex.fact}</Text></View>
                  </View>
                )}
              </View>
            );
          })}
        </>
      );

      case 3: {
        const item = DETECTIVE_POOL[detQ];
        return (
          <>
            <Tag>🆕 Módulo 3 · Modo Detective</Tag>
            <Title>Detective: ¿cuál es GPT-4o?</Title>
            {!detDone ? (
              <>
                <Text style={styles.progressNote}>Caso {detQ + 1} de {DETECTIVE_POOL.length} · {detCorrect} correctos</Text>
                <View style={styles.scenarioBox}><Text style={styles.scenarioLabel}>La pregunta</Text><Text style={styles.scenarioText}>{item.task}</Text></View>
                {(['A', 'B'] as const).map(side => {
                  const resp = side === 'A' ? item.respA : item.respB;
                  const sel = detSel === side;
                  const isCorrect = detSel !== null && side === item.cual4o;
                  const isWrong = sel && side !== item.cual4o;
                  return (
                    <TouchableOpacity key={side} style={[styles.detCard, isCorrect && styles.optCorrect, isWrong && styles.optWrong]} disabled={detSel !== null} onPress={() => answerDet(side)}>
                      <Text style={styles.detLabel}>Respuesta {side}</Text>
                      <Text style={styles.detText}>{resp.text}</Text>
                      <Text style={styles.detHint}>Pista: {resp.hint}</Text>
                    </TouchableOpacity>
                  );
                })}
                {detSel !== null && <Fb ok={detSel === item.cual4o}>{detSel === item.cual4o ? '✅ ¡Correcto detective! ' : '❌ ¡Casi! '}{item.explain}</Fb>}
              </>
            ) : <Fb ok>🕵️ Detective completado: {detCorrect}/{DETECTIVE_POOL.length}. GPT-4o suele usar analogías, anticipar preguntas y adaptar el tono.</Fb>}
          </>
        );
      }

      case 4: return (
        <>
          <Tag>📖 Módulo 4 · GPT-3.5 vs GPT-4o</Tag>
          <Title>GPT-3.5 vs GPT-4o: ¿cuál usar?</Title>
          <Body>ChatGPT tiene dos versiones principales. No son iguales, GPT-4o es la versión profesional. Pero GPT-3.5 sigue siendo muy útil para muchas cosas.</Body>
          <View style={styles.vsGrid}>
            <View style={[styles.vsCol, { backgroundColor: C.card2 }]}>
              <View style={[styles.vsHeader, { backgroundColor: '#e2e8f0' }]}><Text style={[styles.vsHeaderText, { color: '#475569' }]}>GPT-3.5</Text></View>
              {['✅ Completamente gratis', '✅ Muy rápido', '✅ Bueno para texto', '❌ No ve imágenes', '❌ No tiene voz nativa', '⚠️ Más errores en lógica'].map((t, i) => (
                <Text key={i} style={styles.vsItem}>{t}</Text>
              ))}
            </View>
            <View style={[styles.vsCol, { backgroundColor: C.greenLight }]}>
              <View style={[styles.vsHeader, { backgroundColor: C.greenBorder }]}><Text style={[styles.vsHeaderText, { color: C.okText }]}>GPT-4o</Text></View>
              {['✅ Analiza imágenes', '✅ Modo de voz', '✅ DALL-E integrado', '✅ Razona mucho mejor', '✅ Menos errores', '⚠️ Versión gratis limitada'].map((t, i) => (
                <Text key={i} style={styles.vsItem}>{t}</Text>
              ))}
            </View>
          </View>
          <CardRow icon="💡" iconBg="#86efac" tint={C.greenLight} tintBorder={C.greenBorder} title="¿Cuándo usar GPT-3.5?">Para escribir textos, resumir, pedir explicaciones, traducir y practicar idiomas. ¡Para la mayoría de tareas escolares es más que suficiente!</CardRow>
          <CardRow icon="🚀" iconBg="#d9f99d" tint="#f7fee7" tintBorder="#d9f99d" title="¿Cuándo necesitas GPT-4o?">Para analizar imágenes o fotos, generar imágenes con DALL-E, usar el modo de voz, o resolver problemas de lógica y matemáticas muy complejos.</CardRow>
          <HlBox variant="green"><B>Truco de experto:</B>{'\n'}Empieza siempre con GPT-3.5 (es gratis). Si la respuesta no es suficientemente buena, cambia a GPT-4o. ¡Aprovecha los límites gratuitos de cada versión!</HlBox>
        </>
      );

      case 5: return (
        <>
          <Tag>🧩 Módulo 5 · ¿Cuál versión usas?</Tag>
          <Title>¿GPT-3.5 o GPT-4o?</Title>
          <Text style={styles.subtitle}>Clasifica cada tarea según qué versión de ChatGPT usarías. Toca un chip y luego su columna (o arrástralo).</Text>
          <Card><Text style={styles.cardText}>GPT-3.5 para texto, resúmenes, preguntas simples. GPT-4o para imágenes, voz, lógica compleja.</Text></Card>
          <View style={styles.chipWrap}>
            {dragItems.map((item, i) => ddPlaced[i] === undefined ? (
              <TouchableOpacity key={i} id={`dd-chip-${i}`} style={[styles.chip, ddSel === i && styles.chipOn]} disabled={ddSolved} onPress={() => setDdSel(ddSel === i ? null : i)}>
                <Text style={styles.chipText}>{item.text}</Text>
              </TouchableOpacity>
            ) : null)}
            {ddAllPlaced && <Text style={{ color: C.placeholder, fontSize: 11 }}>Todas clasificadas ✓</Text>}
          </View>
          <View style={styles.dropRow}>
            {(['35', '4o'] as const).map(zone => (
              <TouchableOpacity key={zone} id={`dd-zone-${zone}`} activeOpacity={0.85} style={[styles.dropZone, ddOverZone === zone && styles.dropZoneOver]} disabled={ddSolved} onPress={() => ddPlace(zone)}>
                <Text style={styles.dropHeader}>{zone === '35' ? '⚡ GPT-3.5' : '🌟 GPT-4o'}</Text>
                {dragItems.map((item, idx) => ddPlaced[idx] === zone ? (
                  <TouchableOpacity key={idx} disabled={ddSolved} onPress={() => ddReturn(idx)} style={[styles.dropChip, ddChecked && (item.correct === zone ? styles.dropChipOk : styles.dropChipBad)]}>
                    <Text style={[styles.dropChipText, ddChecked && { color: item.correct === zone ? C.okText : C.failText }]}>{ddChecked ? (item.correct === zone ? '✓ ' : '✕ ') : ''}{item.text}</Text>
                  </TouchableOpacity>
                ) : null)}
              </TouchableOpacity>
            ))}
          </View>
          {ddChecked && ddSolved && <Fb ok>✅ ¡Perfecto! Sabes cuándo cada versión es la mejor.</Fb>}
          {ddChecked && !ddSolved && <Fb ok={false}>❌ Algunas no están bien (en rojo). Recuerda: imágenes, voz y análisis visual → GPT-4o; texto simple y cálculos → GPT-3.5. Toca las ✕ para reintentar.</Fb>}
        </>
      );

      case 6: return (
        <>
          <Tag>📖 Módulo 6 · GPTs personalizados</Tag>
          <Title>GPTs: la tienda de apps de ChatGPT</Title>
          <Body>Imagina que ChatGPT tiene una tienda de apps. Cada app es un GPT entrenado para hacer algo específico muy bien. ¡Hay miles y puedes usar los que quieras!</Body>
          <CardRow icon="📚" iconBg="#86efac" tint={C.greenLight} tintBorder={C.greenBorder} title="GPTs para estudiar"><B>Math Tutor:</B> te hace preguntas hasta que entiendes la matemática solo.{'\n'}<B>Language Coach:</B> practica inglés, francés o cualquier idioma contigo.{'\n'}<B>Science Explainer:</B> explica física y química con ejemplos del mundo real.</CardRow>
          <CardRow icon="🎨" iconBg="#d9f99d" tint="#f7fee7" tintBorder="#d9f99d" title="GPTs para crear"><B>Logo Maker:</B> diseña logos para tus proyectos.{'\n'}<B>Story Writer:</B> te ayuda a escribir historias y novelas.{'\n'}<B>Code Buddy:</B> aprende a programar con ejercicios adaptados a tu nivel.</CardRow>
          <CardRow icon="🌍" iconBg="#bae6fd" tint="#f0f9ff" tintBorder="#bae6fd" title="GPTs para explorar"><B>Travel Guide:</B> planea viajes con rutas, tips y presupuestos.{'\n'}<B>Chef GPT:</B> recetas con los ingredientes que tienes en casa.{'\n'}<B>Quiz Master:</B> crea quizzes de cualquier tema para estudiar.</CardRow>
          <HlBox variant="green"><B>Cómo encontrarlos:</B>{'\n'}En ChatGPT, haz clic en "Explorar GPTs" en el menú. Puedes buscar por tema o ver los más populares. ¡Cuando seas más avanzado, puedes crear el tuyo propio!</HlBox>
        </>
      );

      case 7: return (
        <>
          <Tag>🔗 Módulo 7 · Conecta</Tag>
          <Title>¿Para qué sirve cada herramienta?</Title>
          <Body>Toca una tarea de la izquierda y luego su herramienta a la derecha.</Body>
          <View style={styles.matchRow}>
            <View style={styles.matchCol}>
              {matchPairs.map((p, i) => (
                <TouchableOpacity key={i} style={[styles.matchCard, matchSel === i && styles.matchCardSel, matched.has(i) && styles.matchCardDone, matchWrong?.left === i && styles.matchCardWrong]} disabled={matched.has(i)} onPress={() => setMatchSel(i)}>
                  <Text style={[styles.matchText, matched.has(i) && { color: C.okText }]}>{p.left}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.matchCol}>
              {rightOrder.map((item, pos) => {
                const isM = matched.has(item.idx);
                return (
                  <TouchableOpacity key={pos} style={[styles.matchCard, isM && styles.matchCardDone, matchWrong?.right === pos && styles.matchCardWrong]} disabled={isM || matchSel === null} onPress={() => pressRight(item.idx, pos)}>
                    <Text style={[styles.matchText, isM && { color: C.okText }]}>{item.text}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          {matched.size === matchPairs.length && <Fb ok>✅ ¡Todo conectado! Conoces las herramientas de ChatGPT.</Fb>}
        </>
      );

      case 8: return (
        <>
          <Tag>📖 Módulo 8 · DALL-E</Tag>
          <Title>DALL-E: ¡cuando las palabras se convierten en imágenes!</Title>
          <Body>DALL-E es como tener un artista dentro de ChatGPT. Le describes lo que quieres ver y en segundos crea la imagen. ¡Cuanto más detallado sea tu prompt de imagen, mejor será el resultado!</Body>
          <SectionTitle>¿Cómo hacer un buen prompt de imagen?</SectionTitle>
          <StepItem n={1}><B>El estilo:</B> ¿Es un dibujo animado, una foto realista, una acuarela, un arte digital? Dilo primero.</StepItem>
          <StepItem n={2}><B>El sujeto:</B> ¿Qué o quién aparece? Sé específico: "un gato" vs "un gato naranja con sombrero de chef cocinando ramen".</StepItem>
          <StepItem n={3}><B>El ambiente:</B> ¿Dónde está? ¿De noche, en el espacio, en un mercado, bajo el agua?</StepItem>
          <StepItem n={4}><B>La emoción:</B> ¿Alegre, misterioso, épico, tranquilo? Esto cambia los colores y el estado de ánimo de la imagen.</StepItem>
          <Card tint={C.greenLight}>
            <Text style={styles.cardTitle}>Ejemplo de prompt de imagen bien hecho:</Text>
            <View style={styles.exampleMono}>
              <Text style={styles.exampleMonoText}>"Ilustración digital colorida estilo anime, un robot azul pequeño bailando tango en una plaza de Buenos Aires de noche, con expresión alegre y luces de colores reflejadas en el suelo mojado."</Text>
            </View>
          </Card>
          <HlBox variant="green"><B>Solo con GPT-4o:</B>{'\n'}DALL-E solo funciona con GPT-4o. Si estás en GPT-3.5, ChatGPT te dirá que no puede generar imágenes. ¡Así puedes saber en qué versión estás!</HlBox>
        </>
      );

      case 9: return (
        <>
          <Tag>🆕 Módulo 9 · Constructor de Imagen</Tag>
          <Title>¡Construye tu prompt de imagen!</Title>
          <Text style={styles.subtitle}>Elige una opción en cada paso y tu prompt para DALL-E se arma solo. ¡Listo para copiar y usar en ChatGPT!</Text>
          {(Object.keys(IMG_OPTIONS) as (keyof typeof IMG_OPTIONS)[]).map(key => (
            <View key={key} style={{ marginBottom: 10 }}>
              <Text style={styles.selectorLabel}>{IMG_LABELS[key]}</Text>
              <View style={styles.selectorRow}>
                {IMG_OPTIONS[key].map((opt, i) => (
                  <TouchableOpacity key={i} style={[styles.optChip, imgState[key] === opt && styles.optChipOn]} onPress={() => setImgState(p => ({ ...p, [key]: opt }))}>
                    <Text style={[styles.optChipText, imgState[key] === opt && { color: C.okText, fontWeight: '700' }]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
          <View style={styles.imgOutput}>
            <Text style={styles.imgOutputLabel}>Tu prompt para DALL-E</Text>
            {imgComplete ? <Text style={styles.imgOutputText}>{imgPrompt}</Text> : <Text style={[styles.imgOutputText, { color: C.placeholder, fontStyle: 'italic' }]}>Selecciona las 4 opciones para ver el prompt completo.</Text>}
          </View>
          <HlBox variant="lime"><B>Pruébalo de verdad:</B>{'\n'}Copia el prompt y abre ChatGPT con GPT-4o. Pega el prompt y escribe "crea esta imagen". ¡Tendrás tu ilustración en segundos!</HlBox>
        </>
      );

      case 10: return (
        <>
          <Tag>↕️ Módulo 10 · Ordenar</Tag>
          <Title>¿Cuál es el orden perfecto para estudiar con ChatGPT?</Title>
          <Text style={styles.subtitle}>Estos son los 6 pasos de una sesión de estudio perfecta. Están mezclados, ¡ordénalos con las flechas!</Text>
          <Card tint={C.greenLight}><Text style={styles.cardText}>Piensa: ¿qué necesitas hacer primero para que ChatGPT te pueda ayudar bien? ¿Y qué haces al final para que recuerdes todo?</Text></Card>
          {sortOrder.map((origIdx, pos) => (
            <View key={pos} style={[styles.sortRow, sortWrong.has(pos) && styles.sortRowWrong, sortSolved && styles.sortRowOk]}>
              <Text style={styles.sortNum}>{pos + 1}</Text>
              <Text style={styles.sortText}>{SORT_SESION[origIdx]}</Text>
              <View style={styles.sortArrows}>
                <TouchableOpacity onPress={() => moveSort(pos, -1)} disabled={pos === 0 || sortSolved}><Text style={[styles.sortArrow, (pos === 0 || sortSolved) && { opacity: 0.25 }]}>▲</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => moveSort(pos, 1)} disabled={pos === sortOrder.length - 1 || sortSolved}><Text style={[styles.sortArrow, (pos === sortOrder.length - 1 || sortSolved) && { opacity: 0.25 }]}>▼</Text></TouchableOpacity>
              </View>
            </View>
          ))}
          {sortSolved && <Fb ok>✅ ¡Ese es el orden perfecto para estudiar con ChatGPT!</Fb>}
          {!sortSolved && sortWrong.size > 0 && <Fb ok={false}>❌ Los pasos en rojo no están en orden. Piensa qué necesitas hacer primero.</Fb>}
        </>
      );

      case 11: return (
        <>
          <Tag>📖 Módulo 11 · Estudiar con ChatGPT</Tag>
          <Title>5 formas de estudiar con ChatGPT que de verdad funcionan</Title>
          <Body>ChatGPT puede ser el mejor profesor particular que hayas tenido. Gratis, disponible 24 horas, infinitamente paciente. ¡Pero hay que saber cómo pedirle ayuda!</Body>
          <CardRow icon="❓" iconBg="#86efac" tint={C.greenLight} tintBorder={C.greenBorder} title="1. Pídele que te haga preguntas, no respuestas">"Hazme un quiz de 10 preguntas sobre la Segunda Guerra Mundial de menor a mayor dificultad." Tu cerebro aprende más cuando busca las respuestas solo.</CardRow>
          <CardRow icon="🎭" iconBg="#d9f99d" tint="#f7fee7" tintBorder="#d9f99d" title="2. Dale una identidad divertida">"Eres un explorador del tiempo que vivió en la Antigua Roma. Cuéntame cómo era un día normal." ¡Las explicaciones se vuelven aventuras!</CardRow>
          <CardRow icon="🔍" iconBg="#99f6e4" tint="#f0fdfa" tintBorder="#99f6e4" title="3. Pídele que explique tus errores">"Resolví este ejercicio así: [tu respuesta]. ¿Qué hice mal y por qué?" Aprendes el doble entendiendo dónde fallaste.</CardRow>
          <CardRow icon="🌍" iconBg="#bae6fd" tint="#f0f9ff" tintBorder="#bae6fd" title="4. Pide ejemplos de tu país o ciudad">"Explícame la inflación con un ejemplo de lo que costaría una pizza en Argentina." Los ejemplos locales son más fáciles de entender.</CardRow>
          <CardRow icon="📝" iconBg="#e9d5ff" tint="#faf5ff" tintBorder="#e9d5ff" title="5. Pide resúmenes al final">"Resume en 5 puntos lo que estudié hoy. Luego dime qué debo repasar mañana." Consolida lo aprendido y planea el siguiente día.</CardRow>
          <HlBox variant="red"><B>El error más común:</B>{'\n'}Pedirle que haga la tarea completa. ChatGPT puede hacerlo, pero tú no aprendes nada. Úsalo como un tutor que te guía, no como un copista que trabaja por ti.</HlBox>
        </>
      );

      case 12: return (
        <>
          <Tag>✅ Módulo 12 · ¿Verdad o mentira?</Tag>
          <Title>¿Cuánto sabes ya de ChatGPT?</Title>
          <Text style={styles.subtitle}>Hay muchos mitos sobre ChatGPT. ¿Puedes distinguir qué es verdad y qué es mentira?</Text>
          {tfItems.map((item, i) => (
            <View key={i} style={styles.vfItem}>
              <Text style={styles.qText}>{item.stmt}</Text>
              <View style={styles.row}>
                <TouchableOpacity style={[styles.tfBtn, vfAns[i] === true && !vfChecked && styles.tfSel, vfChecked && item.correct && styles.optCorrect, vfChecked && vfAns[i] === true && !item.correct && styles.optWrong]} disabled={vfChecked} onPress={() => setVfAns(p => ({ ...p, [i]: true }))}><Text style={styles.tfText}>✅ Verdad</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.tfBtn, vfAns[i] === false && !vfChecked && styles.tfSel, vfChecked && !item.correct && styles.optCorrect, vfChecked && vfAns[i] === false && item.correct && styles.optWrong]} disabled={vfChecked} onPress={() => setVfAns(p => ({ ...p, [i]: false }))}><Text style={styles.tfText}>❌ Mito</Text></TouchableOpacity>
              </View>
              {vfChecked && <Fb ok={vfAns[i] === item.correct}>{vfAns[i] === item.correct ? '✅ ' : '❌ '}{item.explain}</Fb>}
            </View>
          ))}
          {vfChecked && <Fb ok={vfScore >= 3}>{vfScore}/{tfItems.length} correctas.</Fb>}
        </>
      );

      case 13: return (
        <>
          <Tag>🗺️ Módulo 13 · Historia real</Tag>
          <Title>La historia de Yuki: de no saber inglés a conversarlo</Title>
          <Text style={styles.subtitle}>Yuki, 11 años, vive en Tokio. En Japón aprender inglés es muy difícil porque pocas personas lo hablan en la calle. Pero Yuki encontró una solución.</Text>
          <View style={styles.scenarioBox}>
            <Text style={styles.scenarioLabel}>El problema</Text>
            <Text style={styles.scenarioText}>Yuki quería ver sus series de anime favoritas en inglés para mejorar su vocabulario. Pero no entendía nada y se frustraba. Sus clases de inglés en la escuela eran muy formales y aburridas. <Text style={styles.bold}>Necesitaba práctica real y conversacional.</Text></Text>
          </View>
          <CardRow icon="📅" iconBg="#86efac" tint={C.greenLight} tintBorder={C.greenBorder} title="Lo que hizo Yuki - Mes 1">Activó el modo de voz y le dijo en inglés: "You are a friendly English teacher for Japanese kids. Let's talk about My Hero Academia. Speak slowly and correct my mistakes gently." Practicaba 15 minutos cada noche.</CardRow>
          <CardRow icon="📱" iconBg="#86efac" tint={C.greenLight} tintBorder={C.greenBorder} title="Lo que hizo Yuki - Mes 2">Empezó a subir capturas de sus series favoritas a ChatGPT con GPT-4o y preguntaba: "What does this character say here? Explain the expression." <B>Aprendía vocabulario del contexto que ya le encantaba.</B></CardRow>
          <CardRow icon="🏆" iconBg="#d9f99d" tint="#f7fee7" tintBorder="#d9f99d" title="El resultado - 3 meses después">Yuki pasó de entender 10% del inglés a conversarlo con fluidez básica. En su siguiente examen sacó la nota más alta de su clase. <B>30 minutos diarios con ChatGPT hicieron más que 2 años de clases tradicionales.</B></CardRow>
          <HlBox variant="green"><B>Lo que puedes aprender de Yuki:</B>{'\n'}La clave fue la consistencia (todos los días), el contexto que le gustaba (anime) y pedir correcciones sin vergüenza. ¡ChatGPT nunca se ríe de tus errores, siempre te ayuda a mejorar!</HlBox>
        </>
      );

      case 14: return (
        <>
          <Tag>❓ Módulo 14 · Quiz de ChatGPT</Tag>
          <Title>¿ChatGPT puede hacer eso?</Title>
          <Text style={styles.subtitle}>Situaciones reales de niños de todo el mundo usando ChatGPT. ¿Cuál es la mejor decisión?</Text>
          {quizItems.map((q, i) => (
            <View key={i} style={styles.vfItem}>
              <Text style={styles.qText}>{i + 1}. {q.q}</Text>
              {q.opts.map((o, j) => (
                <TouchableOpacity key={j} style={[styles.quizOpt, quizAns[i] === j && !quizChecked && styles.quizOptOn, quizChecked && j === q.correct && styles.optCorrect, quizChecked && quizAns[i] === j && j !== q.correct && styles.optWrong]} disabled={quizChecked} onPress={() => setQuizAns(p => ({ ...p, [i]: j }))}>
                  <Text style={[styles.quizOptText, quizChecked && j === q.correct && { color: C.okText }, quizChecked && quizAns[i] === j && j !== q.correct && { color: C.failText }]}>{['🅐', '🅑', '🅒', '🅓'][j]} {o}</Text>
                </TouchableOpacity>
              ))}
              {quizChecked && <Fb ok={quizAns[i] === q.correct}>{quizAns[i] === q.correct ? '✅ ' : '❌ '}{q.explain}</Fb>}
            </View>
          ))}
          {quizChecked && <Fb ok={quizScore >= 3}>{quizScore}/{quizItems.length} correctas.</Fb>}
        </>
      );

      case 15: return (
        <>
          <Tag>📖 Módulo 15 · Límites de ChatGPT</Tag>
          <Title>¿Cuándo ChatGPT NO es la mejor opción?</Title>
          <Body>ChatGPT es increíble, pero no es perfecto para todo. Ser un usuario inteligente significa saber también cuándo usar otra herramienta.</Body>
          <CardRow icon="📰" iconBg="#fecdd3" tint="#fff1f2" tintBorder="#fecdd3" title="Noticias y eventos de hoy">ChatGPT no sabe qué pasó ayer en el mundo (sin búsqueda activada). Para noticias recientes, usa Google o Gemini con internet activado.</CardRow>
          <CardRow icon="🏥" iconBg="#fecdd3" tint="#fff1f2" tintBorder="#fecdd3" title="Emergencias médicas">Si te duele algo o hay una emergencia, llama a un adulto o médico. ChatGPT puede dar info general de salud, pero nunca reemplaza a un doctor de verdad.</CardRow>
          <CardRow icon="🔢" iconBg="#fecdd3" tint="#fff1f2" tintBorder="#fecdd3" title="Cálculos matemáticos muy precisos">ChatGPT puede cometer errores en operaciones largas. Para cálculos exactos usa una calculadora. ChatGPT es mejor para explicar conceptos que para calcular.</CardRow>
          <CardRow icon="📍" iconBg="#fecdd3" tint="#fff1f2" tintBorder="#fecdd3" title="Información local en tiempo real">Restaurantes abiertos cerca, horario del metro, tráfico de hoy: eso es para Google Maps. ChatGPT no conoce tu ciudad en tiempo real.</CardRow>
          <HlBox variant="green"><B>La regla de oro:</B>{'\n'}ChatGPT brilla en crear, explicar, analizar, traducir y practicar. Google brilla en encontrar información en tiempo real. ¡Los mejores usuarios usan ambos en el momento correcto!</HlBox>
        </>
      );

      case 16: {
        const item = ethicsItems[ethQ];
        return (
          <>
            <Tag>⚖️ Módulo 16 · ¿Está bien?</Tag>
            <Title>¿Está bien o mal usar ChatGPT así?</Title>
            {!ethDone ? (
              <>
                <Text style={styles.subtitle}>Lee la situación y decide si el uso es correcto, hay que tener cuidado, o está mal.</Text>
                <Text style={styles.progressNote}>Situación {ethQ + 1} de {ethicsItems.length}</Text>
                <View style={styles.scenarioBox}><Text style={styles.scenarioText}>{item.scenario}</Text></View>
                <View style={styles.ethRow}>
                  {([['safe', '✅ OK', 'Buen uso'], ['doubt', '🤔 Cuidado', 'Depende'], ['bad', '⛔ Mal', 'No hacerlo']] as const).map(([v, t, s]) => {
                    const isCorrect = ethSel !== null && v === item.correct;
                    const isWrong = ethSel === v && v !== item.correct;
                    return (
                      <TouchableOpacity key={v} style={[styles.ethBtn, isCorrect && styles.optCorrect, isWrong && styles.optWrong]} disabled={ethSel !== null} onPress={() => answerEth(v)}>
                        <Text style={styles.ethBtnText}>{t}</Text>
                        <Text style={styles.ethBtnSub}>{s}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {ethSel !== null && <Fb ok={ethSel === item.correct}>{ethSel === item.correct ? '✅ ¡Correcto! ' : '❌ '}{item.explain}</Fb>}
              </>
            ) : <Fb ok>⚖️ Completado: {ethCorrect}/{ethicsItems.length} correctas. Usar ChatGPT para aprender = ✅; para hacer trampa o decisiones de seguridad = ⛔.</Fb>}
          </>
        );
      }

      case 17: return (
        <>
          <Tag>📄 Módulo 17 · Completa las frases</Tag>
          <Title>El vocabulario de ChatGPT</Title>
          <Text style={styles.subtitle}>Completa cada frase con la palabra correcta. ¡Es más fácil de lo que parece!</Text>
          {fillItems.map((item, qi) => {
            const ans = fillAns[qi];
            return (
              <View key={qi} style={styles.vfItem}>
                <Text style={styles.fillSentence}>{item.before}<Text style={styles.fillBlank}>{ans !== undefined ? item.opts[ans] : '_____'}</Text>{item.after}</Text>
                <View style={styles.optWrap}>
                  {item.opts.map((opt, oi) => (
                    <TouchableOpacity key={oi} style={[styles.fillOpt, ans !== undefined && oi === item.correct && styles.optCorrect, ans === oi && oi !== item.correct && styles.optWrong]} disabled={ans !== undefined} onPress={() => selectFill(qi, oi)}>
                      <Text style={[styles.fillOptText, ans !== undefined && oi === item.correct && { color: C.okText }, ans === oi && oi !== item.correct && { color: C.failText }]}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {ans !== undefined && <Fb ok={ans === item.correct}>{ans === item.correct ? '✅ ' : '❌ '}{item.explain}</Fb>}
              </View>
            );
          })}
        </>
      );

      case 18: {
        const item = sprintItems[sprintIdx];
        return (
          <>
            <Tag>⚡ Módulo 18 · Sprint</Tag>
            <Title>¡Sprint de ChatGPT!</Title>
            {sprintPhase === 'idle' && (
              <>
                <Text style={styles.subtitle}>60 segundos para demostrar que ya eres un experto en ChatGPT. ¡Responde lo más rápido que puedas!</Text>
                <Card tint={C.greenLight}><Text style={styles.cardText}>Toca "¡Empezar Sprint!" y responde Verdadero o Falso a toda velocidad.</Text></Card>
                <View style={styles.sprintBox}><Text style={styles.timerText}>1:00</Text></View>
                <TouchableOpacity style={styles.btn} onPress={() => { sprintScoreRef.current = 0; setSprintScore(0); setSprintIdx(0); setSprintAns(null); setSprintSec(SPRINT_DURATION); setSprintPhase('running'); }}>
                  <Text style={styles.btnText}>▶ ¡Empezar Sprint!</Text>
                </TouchableOpacity>
              </>
            )}
            {sprintPhase === 'running' && item && (
              <>
                <View style={styles.sprintBox}>
                  <Text style={[styles.timerText, sprintSec <= 10 && { color: C.failBorder }, sprintSec <= 20 && sprintSec > 10 && { color: C.amber }]}>0:{String(Math.max(0, sprintSec)).padStart(2, '0')}</Text>
                  <Text style={styles.sprintScore}>{sprintScore} correctas · {sprintIdx}/{sprintItems.length}</Text>
                </View>
                <View style={styles.sprintQ}><Text style={styles.sprintQText}>{item.stmt}</Text></View>
                <View style={styles.row}>
                  <TouchableOpacity style={[styles.tfBtn, sprintAns === true && (item.correct ? styles.optCorrect : styles.optWrong)]} disabled={sprintAns !== null} onPress={() => answerSprint(true)}><Text style={styles.tfText}>✅ Verdad</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.tfBtn, sprintAns === false && (!item.correct ? styles.optCorrect : styles.optWrong)]} disabled={sprintAns !== null} onPress={() => answerSprint(false)}><Text style={styles.tfText}>❌ Mito</Text></TouchableOpacity>
                </View>
              </>
            )}
            {sprintPhase === 'done' && (
              <Fb ok={sprintScore >= 8}>{sprintScore >= 8 ? '🏆' : sprintScore >= 5 ? '⭐' : '💪'} {sprintScore} de {sprintItems.length} correctas. ¡Bien hecho!</Fb>
            )}
          </>
        );
      }

      case 19: {
        const s = sesSteps[sesQ];
        return (
          <>
            <Tag>🆕 Módulo 19 · Mi sesión perfecta</Tag>
            <Title>{sesDone ? '¡Sesión completada!' : 'Diseña tu sesión perfecta con ChatGPT'}</Title>
            {!sesDone ? (
              <>
                <Text style={styles.subtitle}>Eres Kai, 10 años, de Japón con un examen de geografía en 3 días. ¡Toma las mejores decisiones!</Text>
                <Card tint={C.greenLight}><Text style={styles.sesLabel}>{s.label}</Text><Text style={styles.sesQ}>{s.q}</Text></Card>
                {s.opts.map((o, i) => {
                  const isCorrect = sesSel !== null && i === s.correct;
                  const isWrong = sesSel === i && i !== s.correct;
                  return (
                    <TouchableOpacity key={i} style={[styles.sesOpt, isCorrect && styles.optCorrect, isWrong && styles.optWrong]} disabled={sesSel !== null} onPress={() => answerSes(i)}>
                      <Text style={[styles.sesOptText, isCorrect && { color: C.okText }, isWrong && { color: C.failText }]}>{o}</Text>
                    </TouchableOpacity>
                  );
                })}
                {sesSel !== null && <Fb ok={sesSel === s.correct}>{sesSel === s.correct ? '✅ ' : '❌ '}{sesSel === s.correct ? s.fb_ok : s.fb_no}</Fb>}
              </>
            ) : (
              <>
                <Card tint={C.greenLight}><Text style={styles.cardText}><B>{sesCorrect} de {sesSteps.length} decisiones perfectas</B>.</Text></Card>
                <HlBox variant="green"><B>La sesión perfecta tiene 4 fases:</B>{'\n'}1. Dar contexto completo → 2. Usar trucos para hacerla divertida → 3. Practicar con preguntas (no respuestas) → 4. Cerrar con resumen y plan del día siguiente.</HlBox>
                <Card tint="#f7fee7"><Text style={styles.cardText}>¡Kai pasó su examen de geografía con excelente! Estudiando con ChatGPT de forma inteligente aprendió más en menos tiempo.</Text></Card>
              </>
            )}
          </>
        );
      }

      case 20: return (
        <>
          <Tag>💬 Módulo 20 · Reflexión · +15 XP</Tag>
          <Title>¿Para qué lo vas a usar tú?</Title>
          <Text style={styles.subtitle}>Conociste todos los superpoderes de ChatGPT. Ahora piensa en tu vida real.</Text>
          <CardRow icon="🤔" iconBg="#86efac" tint={C.greenLight} tintBorder={C.greenBorder} title="Tu reflexión de cierre"><B>1. ¿Cuál de los 5 superpoderes de ChatGPT te parece más útil para tu vida? ¿Por qué ese en particular?</B>{'\n\n'}<B>2. Piensa en algo que tienes que hacer esta semana. ¿Cómo usarías ChatGPT para hacerlo mejor?</B></CardRow>
          <TextInput style={styles.textArea} placeholder="Ejemplo: El superpoder que más me gusta es el modo de voz porque quiero mejorar mi inglés igual que Yuki. Esta semana tengo que estudiar para mi examen de ciencias sobre el sistema solar. Voy a pedirle a ChatGPT que sea un astronauta que me explique cada planeta como si fuera una aventura espacial, y al final me haga 10 preguntas de práctica..." placeholderTextColor={C.placeholder} value={reflectText} onChangeText={t => { setReflectText(t); setReflectError(null); }} multiline editable={!reflectDone} />
          <Text style={styles.charCount}>{reflectText.trim().length} / 80 mínimo</Text>
          {reflectError && <Fb ok={false}>{reflectError}</Fb>}
          {reflectDone && <Fb ok>💬 ¡Buena reflexión! Ese es exactamente el tipo de uso que te convierte en un experto de ChatGPT.</Fb>}
          <HlBox variant="green"><B>El siguiente nivel:</B>{'\n'}En el Nivel 20 vas a conocer a Claude, el LLM creado por Anthropic. ¡Claude tiene superpoderes diferentes a ChatGPT y es increíble para ciertas tareas!</HlBox>
        </>
      );

      case 21: return (
        <View style={styles.completeScreen}>
          <View style={styles.completeIcon}><Text style={styles.iconEmoji}>💬</Text></View>
          <Text style={styles.completeTitle}>¡Nivel 19 completado!</Text>
          <Text style={styles.completeBadge}>🏅 Experto en ChatGPT</Text>
          <Text style={styles.completeSub}>Terminaste "ChatGPT: tu compañero de aventuras". ¡Ahora eres un experto en ChatGPT y sabes usar todas sus herramientas secretas!</Text>
          <Text style={styles.xpGained}>+<Text style={{ color: C.green }}>{xp}</Text> XP</Text>
          <View style={styles.skillsBox}>
            {['Conozco los 5 superpoderes de ChatGPT: imágenes, voz, GPTs, archivos y código', 'Sé cuándo usar GPT-3.5 y cuándo necesito GPT-4o', 'Puedo crear prompts detallados para DALL-E y generar imágenes', 'Sé usar ChatGPT para estudiar de forma inteligente sin trampa', 'Detecto las alucinaciones y sé cuándo verificar información', 'Sé cuándo ChatGPT no es la herramienta correcta y cuál usar'].map((s, i, arr) => (
              <View key={i} style={[styles.skillRow, i === arr.length - 1 && { marginBottom: 0 }]}>
                <Text style={styles.skillCheck}>✓</Text><Text style={styles.skillText}>{s}</Text>
              </View>
            ))}
          </View>
          <View style={styles.nextBox}>
            <Text style={styles.nextText}><B>Nivel 20: Claude, el LLM honesto</B>{'\n\n'}Claude fue creado por Anthropic con una misión especial: ser honesto y seguro. Tiene superpoderes únicos para leer documentos largos, razonar de forma ética y admitir cuando no sabe algo. ¡Es diferente a ChatGPT de formas muy interesantes!</Text>
          </View>
          <View style={styles.lvlBarWrap}>
            <Text style={styles.lvlBarLabel}>Nivel 19 de 36 completado · 53% del camino a IA Explorer</Text>
            <View style={styles.lvlBarOuter}><View style={styles.lvlBarInner} /></View>
          </View>
          <TouchableOpacity style={[styles.btn, { width: '100%' }]} onPress={finish}><Text style={styles.btnText}>Siguiente nivel →</Text></TouchableOpacity>
        </View>
      );

      default: return null;
    }
  };

  // ---------- Botón principal ----------
  const getBtn = (): { label: string; enabled: boolean; note?: string; onPress: () => void } | null => {
    switch (step) {
      case 0: return { label: '¡Vamos! 🚀', enabled: true, onPress: next };
      case 2: return { label: 'Continuar →', enabled: true, onPress: next };
      case 1: case 4: case 6: case 8: case 11: case 13: case 15:
        return { label: 'Entendido →', enabled: true, onPress: next };
      case 3: return detDone ? { label: 'Continuar →', enabled: true, onPress: next } : { label: 'Elige una respuesta', enabled: false, note: 'Toca la que creas que es GPT-4o', onPress: () => {} };
      case 5:
        if (!ddChecked || (!ddSolved && !ddAllCorrect)) return { label: 'Verificar →', enabled: ddAllPlaced || devMode, note: `Clasifica las ${dragItems.length} tareas · +20 XP`, onPress: verifyDd };
        return { label: 'Continuar →', enabled: true, onPress: next };
      case 7: return { label: 'Continuar →', enabled: matched.size === matchPairs.length || devMode, note: matched.size < matchPairs.length ? `Conecta los ${matchPairs.length} pares · +20 XP` : undefined, onPress: next };
      case 9: return { label: 'Continuar →', enabled: imgComplete || devMode, note: imgComplete ? undefined : 'Elige las 4 opciones · +12 XP', onPress: () => { awardStep(12); next(); } };
      case 10: return sortSolved ? { label: 'Continuar →', enabled: true, onPress: next } : { label: 'Verificar orden →', enabled: true, note: 'Ordena del primer paso al último · +15 XP', onPress: checkSort };
      case 12: return quizVfBtn(vfChecked, Object.keys(vfAns).length === tfItems.length, checkVF, next, 'Comprobar →', 'Responde las 5 · hasta +25 XP');
      case 14: return quizVfBtn(quizChecked, Object.keys(quizAns).length === quizItems.length, checkQuiz, next, 'Comprobar respuestas →', 'Responde las 5 · hasta +40 XP');
      case 16: return ethDone ? { label: 'Continuar →', enabled: true, onPress: next } : { label: 'Elige una opción', enabled: false, note: 'Decide si el uso es OK, con cuidado o mal', onPress: () => {} };
      case 17: return { label: 'Continuar →', enabled: Object.keys(fillAns).length === fillItems.length || devMode, note: `Completa las ${fillItems.length} frases · +7 XP c/u`, onPress: next };
      case 18: return sprintPhase === 'done' ? { label: 'Continuar →', enabled: true, onPress: next } : { label: 'Continuar →', enabled: devMode, note: sprintPhase === 'idle' ? 'Pulsa "¡Empezar Sprint!"' : 'Responde hasta que acabe el tiempo', onPress: next };
      case 19: return sesDone ? { label: 'Completar nivel →', enabled: true, onPress: next } : { label: 'Elige la opción', enabled: false, note: 'Toma la mejor decisión de estudio', onPress: () => {} };
      case 20:
        if (!reflectDone) return { label: 'Enviar reflexión →', enabled: reflectText.trim().length >= 80 || devMode, note: 'Escribe al menos 80 caracteres · +15 XP', onPress: submitReflect };
        return { label: 'Ver resumen →', enabled: true, onPress: next };
      case 21: return null;
      default: return null;
    }
  };
  function quizVfBtn(checked: boolean, allAns: boolean, check: () => void, adv: () => void, label: string, note: string) {
    if (checked) return { label: 'Continuar →', enabled: true, onPress: adv };
    return { label, enabled: allAns || devMode, note: allAns ? undefined : note, onPress: check };
  }

  const btn = getBtn();
  const progress = Math.round((step / (TOTAL_STEPS - 1)) * 100);
  const progLabel = step === 0 ? 'Introducción' : step < TOTAL_STEPS - 1 ? `Módulo ${step} de ${CONTENT_STEPS}` : '¡Nivel completado!';

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => exitLevel()} style={styles.closeBtn}><Text style={styles.closeBtnText}>✕</Text></TouchableOpacity>
        <View style={styles.progWrap}>
          <View style={styles.progTrack}><View style={[styles.progFill, { width: `${progress}%` }]} /></View>
          <Text style={styles.progLabel}>{progLabel}</Text>
        </View>
        <View style={styles.xpChip}><Text style={styles.xpChipText}>{xp} XP</Text></View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container}>
        <View style={styles.moduleCard}>{renderStep()}</View>
      </ScrollView>

      {btn && (
        <View style={styles.btnRow}>
          <View style={styles.btnRowInner}>
            {showBack && <TouchableOpacity style={styles.backBtn} onPress={prev}><Text style={styles.backBtnText}>← Volver</Text></TouchableOpacity>}
            <TouchableOpacity style={[styles.mainBtn, { flex: 1 }, !btn.enabled && styles.mainBtnDisabled]} onPress={btn.onPress} disabled={!btn.enabled}>
              <Text style={styles.btnText}>{btn.label}</Text>
            </TouchableOpacity>
          </View>
          {btn.note ? <Text style={styles.btnNote}>{btn.note}</Text> : null}
        </View>
      )}

      {xpToast && <XPToast key={xpToast.id} amount={xpToast.amount} onHide={() => setXpToast(null)} bgColor={C.green} textColor="#fff" />}
    </View>
  );
}

// ===================== ESTILOS (tema claro verde M4) =====================
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13, paddingTop: 11, paddingBottom: 9, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.greenBorder },
  closeBtn: { minWidth: 42, minHeight: 42, borderRadius: 10, backgroundColor: C.greenLight, borderWidth: 1, borderColor: C.greenBorder, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 12, color: C.okText, fontWeight: '800' },
  progWrap: { flex: 1 },
  progTrack: { height: 8, backgroundColor: C.greenLight, borderRadius: 4, overflow: 'hidden' },
  progFill: { height: '100%', borderRadius: 4, backgroundColor: C.green },
  progLabel: { fontSize: 10, color: C.placeholder, marginTop: 3, fontWeight: '500' },
  xpChip: { paddingHorizontal: 11, paddingVertical: 4, borderRadius: 12, backgroundColor: C.amberBg, borderWidth: 1, borderColor: '#fcd34d' },
  xpChipText: { fontSize: 12, color: C.amberText, fontWeight: '700' },

  container: { padding: 14, paddingBottom: 24 },
  moduleCard: { backgroundColor: C.card, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: C.border },

  tag: { alignSelf: 'flex-start', backgroundColor: C.greenLight, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 12 },
  tagText: { fontSize: 10, fontWeight: '700', color: C.okText, textTransform: 'uppercase', letterSpacing: 0.4 },
  iconCircle: { width: 66, height: 66, borderRadius: 20, backgroundColor: C.greenLight, justifyContent: 'center', alignItems: 'center', marginBottom: 12, alignSelf: 'center' },
  iconEmoji: { fontSize: 34 },
  title: { ...typography.extraBold, fontSize: 19, color: C.text, marginBottom: 8, lineHeight: 25 },
  subtitle: { ...typography.regular, fontSize: 13, color: C.muted, marginBottom: 13, lineHeight: 20 },
  body: { ...typography.regular, fontSize: 14, color: '#334155', lineHeight: 23, marginBottom: 11 },
  bold: { fontWeight: '700', color: C.text },
  infoCard: { backgroundColor: C.card2, borderRadius: 14, padding: 13, marginBottom: 9, borderWidth: 1, borderColor: C.border },
  cardTitle: { ...typography.bold, fontSize: 13, color: C.text, marginBottom: 3 },
  cardText: { ...typography.regular, fontSize: 12.5, color: '#334155', lineHeight: 18 },

  // Section title (border-top)
  sectionTitle: { ...typography.bold, fontSize: 13, color: C.text, marginTop: 13, marginBottom: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' },

  // Lista numerada (step-list)
  stepRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 8 },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  stepNumText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  stepText: { flex: 1, ...typography.regular, fontSize: 12.5, color: '#334155', lineHeight: 19 },

  // Card-row (chip de ícono + columna)
  crCard: { backgroundColor: C.card, borderRadius: 14, padding: 13, marginBottom: 9, borderWidth: 1, borderColor: C.border },
  crRow: { flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  crIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  crIconText: { fontSize: 19 },
  crTitle: { ...typography.bold, fontSize: 12.5, color: C.text, marginBottom: 3 },
  crText: { ...typography.regular, fontSize: 12.5, color: '#334155', lineHeight: 19 },

  // Highlight box (borde izquierdo)
  hlBox: { paddingVertical: 12, paddingHorizontal: 14, borderTopRightRadius: 12, borderBottomRightRadius: 12, borderLeftWidth: 3, marginTop: 9, marginBottom: 13 },
  hlText: { fontSize: 12, lineHeight: 20, fontWeight: '500' },

  // VS grid (GPT-3.5 vs GPT-4o)
  vsGrid: { flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 11 },
  vsCol: { flex: 1, borderRadius: 12, padding: 11, borderWidth: 1, borderColor: C.border },
  vsHeader: { marginBottom: 7, paddingVertical: 4, paddingHorizontal: 6, borderRadius: 7, alignItems: 'center' },
  vsHeaderText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  vsItem: { fontSize: 11, color: '#334155', paddingVertical: 4, lineHeight: 16 },

  // Ex-card (acordeón de superpoderes)
  exCard: { backgroundColor: C.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: C.border, marginBottom: 8 },
  exCardOpen: { borderColor: C.green, backgroundColor: C.greenLight },
  exHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exEmoji: { width: 40, height: 40, backgroundColor: '#f1f5f9', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  exEmojiText: { fontSize: 22 },
  exName: { ...typography.bold, fontSize: 13, color: C.text },
  exSub: { fontSize: 11, color: C.muted, marginTop: 1 },
  exArr: { fontSize: 17, color: C.placeholder, paddingHorizontal: 4, fontWeight: '700' },
  exBody: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.greenBorder },
  exTag: { alignSelf: 'flex-start', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 6, backgroundColor: C.greenLight, marginBottom: 6 },
  exTagText: { fontSize: 10, fontWeight: '700', color: C.okText, letterSpacing: 0.3 },
  exHow: { fontSize: 12, color: '#334155', lineHeight: 20, marginBottom: 8 },
  exFact: { backgroundColor: '#fffbeb', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: '#fde68a' },
  exFactText: { fontSize: 11, color: C.amberText, fontWeight: '500', lineHeight: 16 },

  // Ejemplo monospace (prompt DALL-E)
  exampleMono: { backgroundColor: C.greenLight, borderRadius: 8, padding: 9, borderWidth: 1, borderColor: '#86efac', marginTop: 6 },
  exampleMonoText: { fontSize: 11, color: C.okText, lineHeight: 19, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },

  // Char count reflexión
  charCount: { fontSize: 11, color: C.placeholder, textAlign: 'right', marginTop: 4 },

  // Barra de nivel (pantalla final)
  lvlBarWrap: { width: '100%', marginBottom: 14 },
  lvlBarLabel: { fontSize: 10, color: C.placeholder, marginBottom: 4 },
  lvlBarOuter: { height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden' },
  lvlBarInner: { height: '100%', width: '53%', backgroundColor: C.green, borderRadius: 3 },

  progressNote: { fontSize: 11, color: C.muted, textAlign: 'center', marginBottom: 8, fontWeight: '500' },
  scenarioBox: { backgroundColor: C.amberBg, borderRadius: 12, padding: 13, marginBottom: 11, borderWidth: 1, borderColor: '#fde68a' },
  scenarioLabel: { fontSize: 9, fontWeight: '700', color: C.amberText, letterSpacing: 0.6, marginBottom: 6, textTransform: 'uppercase' },
  scenarioText: { fontSize: 12.5, color: '#334155', lineHeight: 20, fontWeight: '500' },

  // Feedback
  fb: { marginTop: 8, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  fbOk: { backgroundColor: C.okBg, borderColor: C.greenBorder },
  fbFail: { backgroundColor: C.failBg, borderColor: '#fecdd3' },
  fbText: { fontSize: 12, lineHeight: 18, fontWeight: '500' },

  optCorrect: { borderColor: C.okBorder, backgroundColor: C.okBg },
  optWrong: { borderColor: C.failBorder, backgroundColor: C.failBg },

  // Detective
  detCard: { borderRadius: 12, padding: 12, borderWidth: 2, borderColor: C.border, marginBottom: 8, backgroundColor: C.card },
  detLabel: { fontSize: 10, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  detText: { fontSize: 12, color: '#334155', lineHeight: 18 },
  detHint: { fontSize: 10.5, color: C.placeholder, fontStyle: 'italic', marginTop: 6 },

  // Compare
  compareRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  comparePanel: { flex: 1, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border },
  compareLabel: { fontSize: 11, fontWeight: '700', color: C.muted, marginBottom: 6, textTransform: 'uppercase' },
  compareText: { fontSize: 11.5, color: '#334155', lineHeight: 17 },

  // Chips / drag
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 10, backgroundColor: C.card2, borderRadius: 12, borderWidth: 1, borderColor: C.border, marginBottom: 10, minHeight: 52, alignItems: 'center' },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1.5, borderColor: '#cbd5e1', backgroundColor: C.card },
  chipOn: { borderColor: C.green, backgroundColor: C.greenLight },
  chipText: { fontSize: 11, color: '#334155', lineHeight: 15 },
  dropRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  dropZone: { flex: 1, borderWidth: 2, borderStyle: 'dashed', borderColor: '#cbd5e1', borderRadius: 12, padding: 8, minHeight: 100, backgroundColor: '#fafafa' },
  dropZoneOver: { borderColor: C.green, backgroundColor: C.greenLight },
  dropHeader: { fontSize: 11, fontWeight: '700', textAlign: 'center', marginBottom: 6, color: C.text },
  dropChip: { backgroundColor: C.greenLight, borderRadius: 10, paddingVertical: 5, paddingHorizontal: 8, marginBottom: 4 },
  dropChipOk: { backgroundColor: C.okBg },
  dropChipBad: { backgroundColor: C.failBg },
  dropChipText: { fontSize: 10.5, color: C.okText, lineHeight: 14 },

  // Match
  matchRow: { flexDirection: 'row', gap: 8 },
  matchCol: { flex: 1, gap: 6 },
  matchCard: { backgroundColor: C.card, padding: 10, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, minHeight: 58, justifyContent: 'center' },
  matchCardSel: { borderColor: C.green, backgroundColor: C.greenLight },
  matchCardDone: { borderColor: C.okBorder, backgroundColor: C.okBg },
  matchCardWrong: { borderColor: C.failBorder, backgroundColor: C.failBg },
  matchText: { fontSize: 11, color: '#334155', textAlign: 'center', lineHeight: 15 },

  // Img builder
  selectorLabel: { fontSize: 10, fontWeight: '700', color: C.okText, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 },
  selectorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  optChip: { paddingVertical: 7, paddingHorizontal: 10, borderRadius: 9, borderWidth: 1.5, borderColor: C.greenBorder, backgroundColor: C.card },
  optChipOn: { borderColor: C.green, backgroundColor: C.greenLight },
  optChipText: { fontSize: 10.5, color: '#334155' },
  imgOutput: { backgroundColor: C.card, borderWidth: 2, borderColor: C.greenBorder, borderRadius: 12, padding: 12, marginTop: 6 },
  imgOutputLabel: { fontSize: 9, fontWeight: '700', color: C.green, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 7 },
  imgOutputText: { fontSize: 12, color: '#334155', lineHeight: 20, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },

  // Sort
  sortRow: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: C.card2, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, marginBottom: 6 },
  sortRowWrong: { borderColor: C.failBorder, backgroundColor: C.failBg },
  sortRowOk: { borderColor: C.greenBorder, backgroundColor: C.okBg },
  sortNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: C.green, color: '#fff', textAlign: 'center', lineHeight: 26, fontWeight: '800', fontSize: 11, marginRight: 9, overflow: 'hidden' },
  sortText: { flex: 1, fontSize: 11.5, color: '#334155', lineHeight: 16 },
  sortArrows: { flexDirection: 'column', marginLeft: 8 },
  sortArrow: { fontSize: 13, color: C.green, paddingVertical: 2, paddingHorizontal: 5 },

  // VF / Quiz / Sprint
  vfItem: { marginBottom: 14 },
  qText: { fontSize: 12.5, fontWeight: '700', color: C.text, lineHeight: 18, padding: 11, backgroundColor: C.card2, borderRadius: 10, borderWidth: 1, borderColor: C.border, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8 },
  tfBtn: { flex: 1, paddingVertical: 12, borderRadius: 11, borderWidth: 2, borderColor: C.border, alignItems: 'center', backgroundColor: C.card },
  tfSel: { borderColor: C.green, backgroundColor: C.greenLight },
  tfText: { fontSize: 13, fontWeight: '700', color: C.text },
  quizOpt: { paddingVertical: 11, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, marginBottom: 6, backgroundColor: C.card },
  quizOptOn: { borderColor: C.green, backgroundColor: C.greenLight },
  quizOptText: { fontSize: 12, color: '#334155', lineHeight: 17 },

  // Fill
  fillSentence: { fontSize: 13, color: '#334155', lineHeight: 24, padding: 11, backgroundColor: C.greenLight, borderRadius: 10, borderWidth: 1, borderColor: C.greenBorder, marginBottom: 8 },
  fillBlank: { fontWeight: '800', color: C.okText },
  optWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  fillOpt: { paddingVertical: 8, paddingHorizontal: 13, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.card },
  fillOptText: { fontSize: 12, fontWeight: '600', color: '#334155' },

  // Ethics
  ethRow: { flexDirection: 'row', gap: 6 },
  ethBtn: { flex: 1, paddingVertical: 11, paddingHorizontal: 4, borderRadius: 11, borderWidth: 2, borderColor: C.border, alignItems: 'center', backgroundColor: C.card },
  ethBtnText: { fontSize: 11, fontWeight: '700', color: C.text, textAlign: 'center' },
  ethBtnSub: { fontSize: 9, color: C.muted, marginTop: 2 },

  // Sprint
  sprintBox: { alignItems: 'center', backgroundColor: C.card2, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  timerText: { fontSize: 40, fontWeight: '800', color: C.green, fontVariant: ['tabular-nums'] },
  sprintScore: { fontSize: 12, color: C.muted, marginTop: 4 },
  sprintQ: { backgroundColor: C.card2, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border, marginBottom: 8, minHeight: 52, justifyContent: 'center' },
  sprintQText: { fontSize: 13, fontWeight: '700', color: C.text, lineHeight: 18 },

  // Sesión
  sesLabel: { fontSize: 10, fontWeight: '700', color: C.okText, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 },
  sesQ: { fontSize: 12.5, fontWeight: '600', color: '#334155', lineHeight: 18 },
  sesOpt: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, marginBottom: 6, backgroundColor: C.card },
  sesOptText: { fontSize: 11.5, color: '#334155', lineHeight: 16 },

  // Reflexión
  textArea: { backgroundColor: C.card2, borderWidth: 2, borderColor: C.greenBorder, borderRadius: 12, padding: 13, fontSize: 14, lineHeight: 21, color: C.text, minHeight: 110, marginVertical: 8, textAlignVertical: 'top' },

  // Botones
  btn: { backgroundColor: C.green, padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  btnText: { ...typography.bold, color: '#fff', fontSize: 14 },

  // Completado
  completeScreen: { alignItems: 'center', paddingVertical: 8 },
  completeIcon: { width: 84, height: 84, borderRadius: 24, backgroundColor: '#86efac', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  completeTitle: { ...typography.extraBold, fontSize: 22, color: C.text, textAlign: 'center', marginBottom: 4 },
  completeBadge: { ...typography.extraBold, fontSize: 17, color: C.green, marginBottom: 8 },
  completeSub: { ...typography.regular, fontSize: 13, color: C.muted, textAlign: 'center', marginBottom: 14, lineHeight: 20 },
  xpGained: { ...typography.extraBold, fontSize: 30, color: C.text, marginBottom: 14 },
  skillsBox: { width: '100%', backgroundColor: C.greenLight, borderRadius: 12, padding: 13, borderWidth: 1, borderColor: C.greenBorder, marginBottom: 12 },
  skillRow: { flexDirection: 'row', gap: 8, marginBottom: 7 },
  skillCheck: { color: C.green, fontWeight: '800', fontSize: 13 },
  skillText: { flex: 1, fontSize: 11.5, color: C.okText, lineHeight: 17, fontWeight: '500' },
  nextBox: { width: '100%', backgroundColor: C.card2, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border, marginBottom: 14 },
  nextText: { fontSize: 12, color: '#334155', lineHeight: 19 },

  btnRow: { paddingHorizontal: 13, paddingVertical: 11, borderTopWidth: 1, borderTopColor: C.greenBorder, backgroundColor: C.card },
  btnRowInner: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  backBtn: { paddingHorizontal: 16, paddingVertical: 13, borderRadius: 12, backgroundColor: C.card2, borderWidth: 1.5, borderColor: C.border, minHeight: 48, justifyContent: 'center' },
  backBtnText: { fontSize: 14, fontWeight: '700', color: C.muted },
  mainBtn: { padding: 13, borderRadius: 12, backgroundColor: C.green, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  mainBtnDisabled: { opacity: 0.35 },
  btnNote: { fontSize: 11, color: C.placeholder, textAlign: 'center', marginTop: 5, minHeight: 15 },
});
