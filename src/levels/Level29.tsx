import { exitLevel } from '../utils/exitLevel';
import { router } from 'expo-router';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { typography } from '../theme';
import XPToast from '../components/XPToast';

// ═══════════════════════════════════════════════════════════
// Nivel 29 · Comparte tu Creación con el Mundo
// Mundo 5 · TEMA CLARO (teal: #0d9488 → #14b8a6).
// Reconstruido vs nivel-29.html (estándar v2.2).
// 19 módulos de contenido (steps 1-19) + intro + completado.
// ═══════════════════════════════════════════════════════════

const P = {
  screen: '#ffffff',
  ink: '#111827', body: '#374151', muted: '#6b7280', faint: '#9ca3af',
  teal: '#0d9488', tealMid: '#14b8a6', tealText: '#134e4a', tealBg: '#f0fdfa', tealBorder: '#99f6e4',
  border: '#e5e7eb', cardBg: '#f9fafb',
  green: '#16a34a', greenBg: '#dcfce7', greenText: '#166534', greenSoft: '#f0fdf4', greenBorder: '#bbf7d0',
  red: '#dc2626', redBg: '#fef2f2', redText: '#991b1b', redBorder: '#fecaca',
  blueBg: '#eff6ff', blueBorder: '#bfdbfe', blueText: '#1e40af',
  purpleBg: '#fdf4ff', purpleBorder: '#e9d5ff', purpleText: '#5b21b6',
  amberBg: '#fef3c7', amberText: '#92400e', amberBorder: '#fde68a',
  orangeBg: '#fff7ed', orangeText: '#9a3412', orangeBorder: '#fed7aa',
  codeBg: '#0f172a', codeText: '#e2e8f0', codeKey: '#5eead4', codeEmpty: '#64748b',
};

const TOTAL_STEPS = 21;   // 0 intro · 1-19 módulos · 20 completado
const CONTENT_STEPS = 19;
const THEORY_STEPS = new Set([0, 1, 11]); // solo lecturas → "Volver"

type MatchPair = { left: string; right: string };
type DragItem = { text: string; correct: 'share' | 'protect' };
type QuizQ = { q: string; opts: string[]; correct: number; explain: string };
type TFItem = { stmt: string; correct: boolean; explain: string };
type SprintItem = { text: string; good: boolean };
type TribeChoice = { title: string; text: string; correct: boolean; explain: string };
type SortItem = { l: string; r: string };
type BuilderConfig = { xp: number; rows: { key: string; label: string; opts: string[] }[] };

const pickN = <T,>(arr: T[], n: number): T[] => [...arr].sort(() => Math.random() - 0.5).slice(0, n);
const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);
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
const REFLECT_TERMS = ['compartir', 'comparto', 'historia', 'audiencia', 'publicar', 'publico', 'post', 'red', 'redes', 'critica', 'troll', 'seguidor', 'impacto', 'gancho', 'hook', 'cta', 'plataforma', 'contenido', 'proyecto', 'miedo', 'impostor', 'verguenza', 'vender', 'marca', 'comunidad', 'tribu', 'feedback', 'viral', 'like', 'metrica', 'app', 'idea', 'usuario', 'voz', 'video', 'reel', 'gente', 'ia', 'mensaje', 'accion'];
const containsTopic = (text: string): boolean => {
  const n = normalizeText(text);
  const words = n.split(/[^a-z0-9]+/).filter(Boolean);
  return REFLECT_TERMS.some((t) => (t.length <= 3 ? words.includes(t) : n.includes(t)));
};

// ── Pools (fuente: nivel-29.html) — distractores alargados (§15/27) ──
const COMMS_POOL: QuizQ[] = [
  { q: '¿Por qué los primeros 3 segundos de un video corto son LOS más importantes?', opts: ['Porque el algoritmo decide si seguir mostrando tu video según la retención de esos 3 segundos', 'Porque las cámaras de los celulares solo graban bien durante los primeros segundos', 'Porque es una moda pasajera que impuso una red social hace muy poco tiempo', 'Porque las reglas de YouTube obligan a que el gancho dure exactamente 3 segundos'], correct: 0, explain: 'Hook crítico. Si la gente sale en 3 seg, el algoritmo deja de distribuir. Si se queda, viraliza.' },
  { q: "¿Qué es 'CTA' (call to action)?", opts: ['Una llamada a la acción específica al final del contenido (suscríbete, prueba, compra)', 'El Centro de Tecnología Avanzada donde se editan todos los videos que se vuelven virales', 'Un emoji nuevo que las plataformas agregan para aumentar el engagement de los posts', 'Un error de grabación que aparece cuando la cámara pierde el foco de repente'], correct: 0, explain: 'CTA: sin él, la gente consume tu contenido pero no actúa. Siempre cierra con UNA acción clara.' },
  { q: '¿Cuándo es un buen momento para usar IA al crear contenido?', opts: ['Para generar borradores, variaciones y miniaturas — pero la voz auténtica sigue siendo tuya', 'Para reemplazar por completo tu voz y tu estilo personal con el de la inteligencia artificial', 'Solamente para generar imágenes, nunca para escribir textos ni para pensar ideas nuevas', 'Nunca, porque usar IA en la creación de contenido siempre se considera hacer trampa'], correct: 0, explain: 'IA = co-piloto. Acelera el trabajo mecánico. Pero tu autenticidad es el diferencial — eso no se delega.' },
  { q: '¿Por qué adaptar el contenido por plataforma en vez de copiar/pegar el mismo?', opts: ['Cada plataforma tiene su lenguaje, audiencia y formato — el algoritmo penaliza lo no nativo', 'Por un simple capricho de los creadores que quieren trabajar el doble sin necesidad', 'Porque copiar y pegar el mismo contenido en varias plataformas es completamente ilegal', 'Solo vale la pena adaptarlo si ya tienes muchísimos seguidores muy fieles y activos'], correct: 0, explain: 'Twitter no es LinkedIn no es TikTok. Adaptar = más alcance + más engagement. Copiar = quemar tu trabajo.' },
  { q: 'Si recibes una crítica dura pero válida sobre tu proyecto, ¿qué haces?', opts: ['Agradecer públicamente, considerar el punto y ajustar si la persona tiene razón', 'Bloquear de inmediato al usuario para que no vuelva a comentar en tu contenido nunca', 'Responder atacando de vuelta con más fuerza para defender tu proyecto ante todos', 'Borrar el comentario en silencio y hacer como que jamás lo llegaste a leer'], correct: 0, explain: 'Las críticas válidas son oro gratis. La gente que te dice la verdad sin filtro vale más que 100 fans aduladores.' },
  { q: 'Mejor estrategia para encontrar tu primera audiencia real:', opts: ['Encontrar 10 personas que MUY específicamente sufren el problema y construir desde ahí', 'Pagar publicidad masiva desde el primer día para llegar a millones de personas rápido', 'Esperar pacientemente a que un video se viralice solo, por pura suerte del algoritmo', 'Compartirlo únicamente con tu familia y tus amigos más cercanos, sin salir de ahí'], correct: 0, explain: '10 fanáticos > 10,000 indiferentes. Empieza en un nicho súper específico y expande después.' },
];

const TF_POOL: TFItem[] = [
  { stmt: '100,000 likes en un post valen más que 100 usuarios que pagan por tu app', correct: false, explain: 'Los likes son vanity metrics. Los usuarios que pagan o usan = impacto real. No te confundas.' },
  { stmt: "Una sola persona que diga 'esto cambió mi vida' vale más que 10K likes vacíos", correct: true, explain: 'Testimonios reales > likes superficiales. Una historia transforma decisiones; un like se olvida en 3 segundos.' },
  { stmt: 'Si tu video viraliza a 1M de views pero NADIE prueba tu producto, sirvió de algo', correct: false, explain: 'Views sin acción = vanity. La pregunta real: ¿cuántos hicieron click? ¿cuántos volvieron?' },
  { stmt: 'Es mejor tener 500 seguidores que SÍ usan tu producto que 50K que solo te miran', correct: true, explain: 'La calidad de la audiencia > la cantidad. 500 fans reales construyen un negocio; 50K observadores no.' },
  { stmt: 'Las métricas de retención (¿vuelven en 7 días?) son más importantes que los downloads', correct: true, explain: 'Apps con 1M downloads y 5% retención mueren. Apps con 10K downloads y 60% retención escalan.' },
  { stmt: 'Si nadie comenta tu post, automáticamente fue un mal post', correct: false, explain: 'A veces un post hace que la gente DESCARGUE tu app sin comentar. La métrica real está en tus servidores.' },
  { stmt: 'Pedirle a tus amigos que le den like a todo lo que publicas es una buena estrategia', correct: false, explain: 'Vanity metrics inflados. Distorsionan tu lectura del mercado real y los algoritmos lo detectan.' },
  { stmt: "Una métrica brutal pero útil: '¿cuánta gente paga por algo que antes era gratis?'", correct: true, explain: 'La disposición a pagar es el termómetro más honesto del valor real que entregas.' },
];

const MATCH_POOL: MatchPair[] = [
  { left: 'Instagram (Reels y posts)', right: 'Visual primero, captions cortas, hashtags estratégicos, estética cuidada' },
  { left: 'TikTok', right: 'Hook en los primeros 3 seg, vertical, autenticidad sobre producción, audio tendencia' },
  { left: 'YouTube', right: 'Títulos optimizados para búsqueda, miniaturas con contraste, retención > likes' },
  { left: 'LinkedIn', right: 'Profesional pero humano, párrafos cortos, primera línea que engancha, sin emojis excesivos' },
  { left: 'Twitter/X', right: 'Hilos numerados, opinión clara, 1 idea por tweet, ritmo punzante' },
  { left: 'WhatsApp/Telegram (canales)', right: 'Mensajes cortos y directos, audios cuando aportan, sin hashtags, comunidad cercana' },
];

const POST_SPRINT_ITEMS: SprintItem[] = [
  { text: '"Construí esto. Pruébalo si quieres." + link', good: false },
  { text: '"7 de cada 10 estudiantes pierden tareas por desorganización. Construí algo que lo arregla. Hilo ↓"', good: true },
  { text: '"Mi app es revolucionaria, increíble, única, especial, novedosa"', good: false },
  { text: '"Hace 2 años vi a mi abuela llorar usando una app del banco. Hoy lanzo SU solución →"', good: true },
  { text: '"COMPRA YA!!!! 🚨🚨🚨 OFERTA LIMITADA!!!!"', good: false },
  { text: '"Pasé 3 meses entrevistando a 30 emprendedoras. Esto fue lo que me dijeron sobre IA →"', good: true },
  { text: 'Solo emojis sin contexto: 🚀💡🔥💯⚡', good: false },
  { text: '"Dato real: pasamos 2.3h/día buscando archivos en Drive. Mi app lo reduce a 12 min. Así funciona ↓"', good: true },
  { text: '"Dejen de scrollear y vean esto, no se van a arrepentir, es lo mejor de hoy"', good: false },
  { text: '"Antes: 240 estudiantes con tareas perdidas. Después: cero. Esto fue lo que cambié →"', good: true },
];

const PRIVACY_POOL: DragItem[] = [
  { text: 'El problema general que resuelve tu app', correct: 'share' },
  { text: 'El video demo del flujo principal', correct: 'share' },
  { text: 'El nombre, logo y URL pública de tu proyecto', correct: 'share' },
  { text: 'Tu propia historia de por qué lo construiste', correct: 'share' },
  { text: 'Las métricas generales (usuarios, retención)', correct: 'share' },
  { text: 'El código fuente completo si tienes ventaja competitiva', correct: 'protect' },
  { text: 'Datos personales de usuarios reales sin consentimiento', correct: 'protect' },
  { text: 'Tus credenciales de API o claves privadas (¡nunca!)', correct: 'protect' },
  { text: 'El plan financiero detallado antes de levantar capital', correct: 'protect' },
  { text: 'La lista exacta de clientes/usuarios early adopters sin permiso', correct: 'protect' },
];

// §6: sin el número de orden en el texto (el círculo numerado es el único número).
const VIRAL_SORT: SortItem[] = [
  { l: 'Emoción primero, datos después:', r: ' sin conexión emocional, no se comparte' },
  { l: 'Útil + memorable:', r: ' que sirva HOY y se recuerde mañana' },
  { l: 'Original auténtico:', r: ' no copiar tendencias — adaptarlas a tu voz' },
  { l: 'Específico, no genérico:', r: " 'estudiantes de medicina en Bogotá' > 'estudiantes'" },
  { l: 'Llamada a acción clara:', r: ' ¿qué hago ahora? Si no es obvio, no lo harán' },
  { l: 'Constancia:', r: ' 1 viral no construye marca, 50 buenos posts sí' },
];

const TRIBE_SCN: TribeChoice[] = [
  { title: 'Subreddits específicos del nicho', text: 'Buscar comunidades en Reddit donde la gente YA discute exactamente tu problema. Aportar valor antes de promocionar.', correct: true, explain: 'Reddit es oro para encontrar tribus. Pero respeta la cultura: aporta primero, promociona después (ratio 9:1).' },
  { title: 'Spam masivo en grupos de Facebook sin contexto', text: 'Postear el mismo mensaje promocional en 50 grupos de FB sin participar antes en ninguno.', correct: false, explain: 'Te van a banear. La regla es ser miembro real antes de promocionar — humanos, no robots.' },
  { title: 'Discord de comunidad de practicantes', text: 'Unirse a Discords donde tu audiencia ideal ya conversa, participar genuinamente y compartir tu trabajo cuando aporte.', correct: true, explain: 'Los Discords de nicho son los nuevos foros pro. Conexión genuina + paciencia = audiencia leal.' },
  { title: 'Pagar influencers grandes desde el día 1', text: 'Invertir todo el presupuesto en 1 influencer macro de 1M+ seguidores antes de validar el producto.', correct: false, explain: 'Mal ROI sin validación. Mejor 10 micro-influencers nicho ($50-200 c/u) que 1 macro ($5,000+) sin garantías.' },
];

const BUILDER_HOOK: BuilderConfig = { xp: 18, rows: [
  { key: 'tipo', label: 'Tipo de gancho', opts: ['Dato impactante (números reales que sorprenden)', 'Pregunta provocadora (que da curiosidad)', 'Anécdota personal de 1 frase (humano, no abstracto)', 'Confesión incómoda (vulnerabilidad genera conexión)', 'Contraste sorprendente (antes/después extremo)'] },
  { key: 'emocion', label: 'Emoción que provoca', opts: ["Curiosidad — '¿qué pasó después?'", "Reconocimiento — 'eso me pasó a mí'", "Urgencia — 'tengo que saber esto YA'", "Asombro — 'no creo lo que estoy leyendo'"] },
  { key: 'tono', label: 'Tono', opts: ['Conversacional cercano (como amigo)', 'Profesional con datos', 'Humorístico inteligente', 'Vulnerable y honesto'] },
] };
const BUILDER_MULTI: BuilderConfig = { xp: 20, rows: [
  { key: 'texto', label: 'Texto del post', opts: ['Hook + 3 puntos + CTA con link', 'Historia personal de 1 párrafo emocional', 'Hilo numerado de 5-7 ideas conectadas', 'Pregunta abierta + invitación a debatir'] },
  { key: 'imagen', label: 'Imagen acompañante', opts: ['Screenshot de la app con anotaciones', 'Foto tuya o del equipo trabajando', 'Imagen generada con IA del concepto abstracto', 'Gráfica simple con UN dato impactante', 'Meme adaptado al tema (con cuidado de tono)'] },
  { key: 'extra', label: 'Elemento extra', opts: ['Audio corto explicando el detrás', 'Video de 30 seg con demo del producto', 'Encuesta nativa de la plataforma', 'GIF que explica el flujo completo'] },
] };
const BUILDER_DESC: BuilderConfig = { xp: 18, rows: [
  { key: 'audiencia', label: 'Audiencia específica', opts: ['Estudiantes universitarios 18-24', 'Emprendedoras LATAM 25-40', 'Padres de familia con hijos en colegio', 'Profesionales corporativos 30-50', 'Adultos mayores 55+ con poco contexto digital'] },
  { key: 'plataforma', label: 'Plataforma destino', opts: ['Instagram caption (visual + emocional)', 'LinkedIn post (profesional con datos)', 'TikTok caption (corta + hashtags virales)', 'Twitter thread (1 idea por tweet)'] },
  { key: 'objetivo', label: 'Objetivo concreto', opts: ['Conseguir 100 personas que prueben mi MVP', 'Generar conversación en comentarios', 'Atraer un cofundador técnico', 'Validar si el problema resuena con más gente'] },
  { key: 'tono', label: 'Tono', opts: ['Cercano y conversacional', 'Profesional con autoridad', 'Vulnerable y auténtico', 'Humorístico e inteligente'] },
] };
const BUILDER_THUMB: BuilderConfig = { xp: 15, rows: [
  { key: 'elemento', label: 'Elemento central', opts: ['Tu rostro con expresión clara (curiosidad/sorpresa)', 'Producto/screenshot con flecha o círculo destacando', 'Texto enorme con UNA palabra impactante', 'Antes/después dividido en dos mitades'] },
  { key: 'color', label: 'Paleta dominante', opts: ['Alto contraste (negro + 1 color vibrante)', 'Cálidos llamativos (naranja, rojo, amarillo)', 'Fríos profesionales (azules + blanco)', 'Pasteles suaves para audiencia femenina'] },
  { key: 'texto', label: 'Texto sobre la imagen (máx 4 palabras)', opts: ["Pregunta intrigante: '¿Y si pudieras...?'", "Beneficio claro: '+50% productividad'", "Urgencia: 'Probado en 90 días'", "Misterio: 'Lo que nadie dice'"] },
] };
const BUILDER_HASHTAG: BuilderConfig = { xp: 15, rows: [
  { key: 'amplio', label: 'Hashtag amplio (alto volumen)', opts: ['#emprendimiento', '#tecnologia', '#educacion', '#productividad', '#startups', '#marketing'] },
  { key: 'nicho', label: 'Hashtag nicho específico', opts: ['#emprendedoreslatam', '#nocodelatino', '#estudiantescolombia', '#mujeresentech', '#startupsmexico', '#educacionrural'] },
  { key: 'branded', label: 'Hashtag de tu marca', opts: ['#LumiApp', '#ConectaConIA', '#MiPrimerProyecto', '#ConstruidoEnLATAM', '#YoCreoConIA'] },
] };
const BUILDER_VIDEO: BuilderConfig = { xp: 22, rows: [
  { key: 'hook', label: 'Hook (5 seg)', opts: ['"7 de cada 10 estudiantes hacen esto MAL" + zoom', '"Esto cambió mi forma de estudiar" + screenshot', '"Si tienes [problema X], tienes que ver esto" + cara curiosa', 'Estadística impactante en pantalla + voz que la explica'] },
  { key: 'problema', label: 'Problema (15 seg)', opts: ['Enseñar el dolor con ejemplo concreto y emocional', "Mostrar el 'antes' de un usuario real", 'Explicar cuánto tiempo/dinero se pierde sin la solución', "Confesión: 'a mí también me pasó esto'"] },
  { key: 'solucion', label: 'Solución (30 seg)', opts: ['Demo en pantalla del flujo principal de la app', "Animación simple del 'cómo funciona'", 'Testimonios cortos de usuarios reales', 'Tutorial de 3 pasos súper claros'] },
  { key: 'cta', label: 'CTA (10 seg)', opts: ['"Link en bio para probarla gratis"', '"Comenta YO si te interesa"', '"Etiqueta a alguien que necesite esto"', '"Sígueme para más como esto"'] },
] };

const BUILDERS: { [k: number]: { cfg: BuilderConfig; header: string; label: string; title: string; sub: string } } = {
  3: { cfg: BUILDER_HOOK, header: 'Tu hook diseñado:', label: 'Módulo 3 de 19 · Builder', title: 'El gancho: la primera frase', sub: '3 decisiones para construir un hook que detenga el scroll.' },
  4: { cfg: BUILDER_MULTI, header: 'Tu post multimodal:', label: 'Módulo 4 de 19 · Builder', title: 'Contenido multimodal: post completo', sub: 'Texto + imagen + extra. Combina formatos para máximo impacto.' },
  7: { cfg: BUILDER_DESC, header: 'Tu prompt para IA:', label: 'Módulo 7 de 19 · Builder', title: 'IA para escribir descripciones', sub: 'Audiencia + plataforma + objetivo + tono. Así se construye el prompt para la IA.' },
  8: { cfg: BUILDER_THUMB, header: 'Tu miniatura diseñada:', label: 'Módulo 8 de 19 · Builder', title: 'La miniatura perfecta', sub: '3 elementos visuales que detienen el scroll en feeds saturados.' },
  12: { cfg: BUILDER_HASHTAG, header: 'Tus hashtags estratégicos:', label: 'Módulo 12 de 19 · Builder', title: 'Hashtags y SEO básico con IA', sub: '3 niveles: amplio, nicho y de marca. La estrategia de los que saben.' },
  13: { cfg: BUILDER_VIDEO, header: 'Tu guion de video:', label: 'Módulo 13 de 19 · Builder', title: 'El video de 60 segundos', sub: 'Hook + problema + solución + CTA. Estructura que funciona en TikTok, Reels y Shorts.' },
};

const tagVariants = {
  intro: { box: { backgroundColor: P.tealBg }, text: { color: P.tealText } },
  theory: { box: { backgroundColor: P.greenSoft }, text: { color: P.greenText } },
  activity: { box: { backgroundColor: P.blueBg }, text: { color: P.blueText } },
  build: { box: { backgroundColor: P.tealBg }, text: { color: P.tealText } },
  case: { box: { backgroundColor: P.purpleBg }, text: { color: '#7e22ce' } },
  example: { box: { backgroundColor: P.orangeBg }, text: { color: P.orangeText } },
  quiz: { box: { backgroundColor: P.amberBg }, text: { color: P.amberText } },
  reflect: { box: { backgroundColor: '#f3f4f6' }, text: { color: '#374151' } },
  sprint: { box: { backgroundColor: '#fee2e2' }, text: { color: P.redText } },
} as const;
const Tag = ({ icon, label, variant }: { icon: string; label: string; variant: keyof typeof tagVariants }) => (
  <View style={[styles.tag, tagVariants[variant].box]}><Text style={[styles.tagText, tagVariants[variant].text]}>{icon}  {label}</Text></View>
);
const Title = ({ children }: { children: React.ReactNode }) => <Text style={styles.title}>{children}</Text>;
const Sub = ({ children }: { children: React.ReactNode }) => <Text style={styles.sub}>{children}</Text>;
const Body = ({ children }: { children: React.ReactNode }) => <Text style={styles.bodyText}>{children}</Text>;
const B = ({ children }: { children: React.ReactNode }) => <Text style={styles.bold}>{children}</Text>;

const REFLECTIONS: { [k: number]: { tag: string; icon: string; question: React.ReactNode; placeholder: string; min: number; xp: number } } = {
  2: { tag: 'Reflexión honesta · +14 XP', icon: '🤔', min: 100, xp: 14, placeholder: 'Me incomoda compartir porque... Lo que más me detiene es...', question: <>Antes de aprender técnicas: <B>¿Por qué te incomoda (o emociona) compartir lo que creas? ¿Qué te detiene — el miedo a que te critiquen, el síndrome del impostor, el qué dirán?</B> Escribe honestamente lo que sientes sobre 'ponerte en el escaparate'.</> },
  9: { tag: 'Reflexión sobre seguidores · +15 XP', icon: '💭', min: 120, xp: 15, placeholder: 'Realmente necesito... porque mi objetivo es... y mi audiencia ideal son...', question: <>Hay un mito: 'no soy influencer, no debería compartir'. La verdad: <B>los proyectos que cambian vidas suelen empezar con 50 seguidores apasionados, no con 1M de espectadores indiferentes.</B> ¿Cuántas personas REALMENTE necesitas para considerar que tu proyecto tiene impacto — y por qué ese número?</> },
  15: { tag: 'Críticas y trolls · +16 XP', icon: '💭', min: 120, xp: 16, placeholder: 'Una crítica vale la pena escuchar cuando... Mis 3 reglas para no perder mi norte mental serán...', question: <>Cuando lanzas algo en internet, vas a recibir críticas. Algunas constructivas, otras tóxicas, otras de trolls. <B>¿Cómo distinguirías una crítica que vale la pena escuchar de una que vale la pena ignorar — y qué reglas vas a darte para no perder tu norte mental cuando llueva el feedback negativo?</B></> },
  19: { tag: 'Tu post real · +18 XP', icon: '✍️', min: 150, xp: 18, placeholder: "Mi primera frase sería: '...' Mi llamado a acción sería: '...'", question: <>Ya tienes las herramientas para contar tu historia, encontrar tu audiencia, manejar críticas y crear contenido. <B>Si tuvieras que escribir UN solo post hoy sobre tu proyecto — dirigido a la persona que más necesita conocerlo — ¿qué pondrías en la primera frase y cuál sería el llamado a acción?</B></> },
};

// ═══════════════════════════════════════════════════════════
export default function World5Level5() {
  const completeLevel = useGameStore((s) => s.completeLevel);

  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);
  const [xpToast, setXpToast] = useState<{ amount: number; id: number } | null>(null);
  const awarded = useRef<Set<number>>(new Set());

  const commsQ = useRef(pickN(COMMS_POOL, 5).map(shuffleOpts)).current;
  const tfQ = useRef(pickN(TF_POOL, 5)).current;
  const matchPairs = useRef(pickN(MATCH_POOL, 5)).current;
  const rightOrder = useRef(shuffle(matchPairs.map((p) => p.right))).current;
  const privacyItems = useRef(pickN(PRIVACY_POOL, 8)).current;
  const scnOrder = useRef(shuffle(TRIBE_SCN.map((_, i) => i))).current;

  // Reflexión
  const [reflectText, setReflectText] = useState('');
  const [reflectFb, setReflectFb] = useState<string | null>(null);

  // Sort
  const [sortOrder, setSortOrder] = useState<number[]>([]);
  const [sortSolved, setSortSolved] = useState(false);
  const [sortFb, setSortFb] = useState<{ ok: boolean; msg: string } | null>(null);
  const [sortWrong, setSortWrong] = useState<Set<number>>(new Set());

  // Matching
  const [matchSel, setMatchSel] = useState<number | null>(null);
  const [matchedLeft, setMatchedLeft] = useState<Set<number>>(new Set());
  const [matchedRight, setMatchedRight] = useState<Set<number>>(new Set());
  const [matchWrong, setMatchWrong] = useState<{ l: number; r: number } | null>(null);
  const [matchFb, setMatchFb] = useState<{ ok: boolean; msg: string } | null>(null);

  // Sprint
  const [sprintRunning, setSprintRunning] = useState(false);
  const [sprintDone, setSprintDone] = useState(false);
  const [sprintTime, setSprintTime] = useState(90);
  const [sprintPicks, setSprintPicks] = useState<{ [k: number]: 'good' | 'bad' }>({});
  const [sprintFb, setSprintFb] = useState<{ ok: boolean; msg: string } | null>(null);
  const sprintPicksRef = useRef<{ [k: number]: 'good' | 'bad' }>({});
  const sprintDoneRef = useRef(false);

  // Builder
  const [builderState, setBuilderState] = useState<{ [k: string]: string }>({});

  // Drag
  const [dragPlaced, setDragPlaced] = useState<{ [k: number]: 'share' | 'protect' }>({});
  const [dragSel, setDragSel] = useState<number | null>(null);
  const [dragSolved, setDragSolved] = useState(false);
  const [dragFb, setDragFb] = useState<{ ok: boolean; msg: string } | null>(null);
  const [dragFlash, setDragFlash] = useState<Set<number>>(new Set());
  const dragAttempts = useRef(0);

  // Quiz
  const [quizAnswers, setQuizAnswers] = useState<{ [k: number]: number }>({});
  const [quizChecked, setQuizChecked] = useState(false);

  // V/F
  const [tfAnswers, setTfAnswers] = useState<{ [k: number]: boolean }>({});
  const [tfChecked, setTfChecked] = useState(false);

  // Scenario
  const [scenarioSel, setScenarioSel] = useState<number | null>(null);
  const [scenarioChecked, setScenarioChecked] = useState(false);

  // Casos virales (expandibles)
  const [expandedEx, setExpandedEx] = useState<number | null>(null);

  const isTheory = THEORY_STEPS.has(step);
  const currentBuilder = BUILDERS[step];
  const currentReflection = REFLECTIONS[step];

  // Reset por step
  useEffect(() => {
    setReflectText(''); setReflectFb(null);
    if (step === 5) setSortOrder(shuffledSort());
    setSortSolved(false); setSortFb(null); setSortWrong(new Set());
    setMatchSel(null); setMatchedLeft(new Set()); setMatchedRight(new Set()); setMatchWrong(null); setMatchFb(null);
    setSprintRunning(false); setSprintDone(false); setSprintTime(90); setSprintPicks({}); setSprintFb(null);
    sprintPicksRef.current = {}; sprintDoneRef.current = false;
    setBuilderState({});
    setDragPlaced({}); setDragSel(null); setDragSolved(false); setDragFb(null); setDragFlash(new Set()); dragAttempts.current = 0;
    setQuizAnswers({}); setQuizChecked(false);
    setTfAnswers({}); setTfChecked(false);
    setScenarioSel(null); setScenarioChecked(false);
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

  function shuffledSort(): number[] {
    let o = [0, 1, 2, 3, 4, 5].sort(() => Math.random() - 0.5);
    if (o.every((v, i) => v === i)) o = [1, 0, 2, 3, 4, 5];
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

  // Matching
  const matchLeft = (i: number) => { if (matchedLeft.has(i)) return; setMatchSel(i); };
  const matchRight = (ri: number) => {
    if (matchSel === null || matchedRight.has(ri)) return;
    if (rightOrder[ri] === matchPairs[matchSel].right) {
      const nl = new Set(matchedLeft).add(matchSel);
      const nr = new Set(matchedRight).add(ri);
      setMatchedLeft(nl); setMatchedRight(nr); setMatchSel(null);
      if (nl.size === matchPairs.length) { awardOnce(15); setMatchFb({ ok: true, msg: '¡Excelente! Todos los pares conectados. +15 XP 🎉' }); }
      else setMatchFb({ ok: true, msg: `¡Par correcto! ${nl.size} de ${matchPairs.length} conectados. 🎯` });
    } else {
      setMatchWrong({ l: matchSel, r: ri });
      setTimeout(() => { setMatchWrong(null); setMatchSel(null); }, 500);
    }
  };
  const matchComplete = matchedLeft.size === matchPairs.length;

  // Sprint
  const startSprint = () => {
    sprintPicksRef.current = {}; sprintDoneRef.current = false;
    setSprintPicks({}); setSprintDone(false); setSprintFb(null); setSprintTime(90); setSprintRunning(true);
  };
  const pickSprint = (i: number) => {
    if (sprintDoneRef.current || sprintPicksRef.current[i] !== undefined) return;
    const next = { ...sprintPicksRef.current, [i]: POST_SPRINT_ITEMS[i].good ? 'good' as const : 'bad' as const };
    sprintPicksRef.current = next; setSprintPicks(next);
    const good = Object.values(next).filter((v) => v === 'good').length;
    const totalGood = POST_SPRINT_ITEMS.filter((x) => x.good).length;
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

  // Builder
  const builderComplete = (cfg: BuilderConfig) => cfg.rows.every((r) => builderState[r.key]);

  // Drag
  const placeDrag = (zone: 'share' | 'protect') => { if (dragSel === null || dragSolved) return; setDragPlaced((prev) => ({ ...prev, [dragSel]: zone })); setDragSel(null); setDragFb(null); };
  const removeDrag = (idx: number) => { if (dragSolved) return; setDragPlaced((prev) => { const n = { ...prev }; delete n[idx]; return n; }); };
  const checkDrag = () => {
    const placedCount = Object.keys(dragPlaced).length;
    if (placedCount < privacyItems.length) { setDragFb({ ok: false, msg: `Faltan ${privacyItems.length - placedCount} tarjetas. Toca un chip y luego la columna.` }); return; }
    dragAttempts.current += 1;
    const wrong: number[] = []; let correct = 0;
    privacyItems.forEach((it, i) => { if (dragPlaced[i] === it.correct) correct++; else wrong.push(i); });
    if (correct === privacyItems.length) {
      setDragSolved(true);
      const earned = dragAttempts.current === 1 ? 20 : 10;
      awardOnce(earned);
      setDragFb({ ok: true, msg: `¡Genial! ${privacyItems.length} correctas. +${earned} XP 🎉${dragAttempts.current === 1 ? ' (¡primer intento!)' : ''}` });
    } else {
      setDragPlaced((prev) => { const n = { ...prev }; wrong.forEach((i) => delete n[i]); return n; });
      setDragFlash(new Set(wrong));
      setTimeout(() => setDragFlash(new Set()), 700);
      setDragFb({ ok: false, msg: `${correct} de ${privacyItems.length} correctas. Las incorrectas vuelven al banco.` });
    }
  };

  // Quiz / VF / Scenario
  const checkQuiz = () => { setQuizChecked(true); let c = 0; commsQ.forEach((q, i) => { if (quizAnswers[i] === q.correct) c++; }); awardOnce(c * 8); };
  const checkTF = () => { setTfChecked(true); let c = 0; tfQ.forEach((it, i) => { if (tfAnswers[i] === it.correct) c++; }); awardOnce(c * 5); };
  const checkScenario = () => { if (scenarioSel === null) return; setScenarioChecked(true); if (TRIBE_SCN[scenarioSel].correct) awardOnce(12); };

  const sendReflection = (): boolean => {
    if (!currentReflection) return false;
    const t = reflectText.trim();
    if (t.length < currentReflection.min) { setReflectFb(`Escribe al menos ${currentReflection.min} caracteres (llevas ${t.length}).`); return false; }
    if (looksRandom(t)) { setReflectFb('Parece texto al azar. Escribe una idea real con tus propias palabras.'); return false; }
    if (!containsTopic(t)) { setReflectFb('Conéctalo con el tema: compartir tu proyecto, tu audiencia, tu historia o las críticas.'); return false; }
    setReflectFb(null); awardOnce(currentReflection.xp); return true;
  };

  // Footer button
  type Primary = { label: string; enabled: boolean; onPress: () => void; accent?: boolean };
  const advance = () => setStep((s) => s + 1);
  const getPrimary = (): Primary => {
    if (currentBuilder) return { label: 'Terminar →', enabled: builderComplete(currentBuilder.cfg), onPress: () => { awardOnce(currentBuilder.cfg.xp); advance(); } };
    if (currentReflection) return { label: 'Enviar reflexión →', enabled: reflectText.trim().length >= currentReflection.min, onPress: () => { if (sendReflection()) advance(); } };
    switch (step) {
      case 0: return { label: '¡Vamos! Empecemos 🚀', enabled: true, onPress: advance };
      case 1: return { label: 'Entendido, sigamos →', enabled: true, onPress: advance };
      case 5: return sortSolved ? { label: 'Continuar →', enabled: true, onPress: advance } : { label: 'Verificar orden', enabled: true, onPress: checkSort, accent: true };
      case 6: return { label: matchComplete ? 'Continuar →' : 'Conecta todos los pares', enabled: matchComplete, onPress: advance };
      case 10:
        if (sprintDone) return { label: 'Continuar →', enabled: true, onPress: advance };
        if (sprintRunning) return { label: 'Elige los buenos posts…', enabled: false, onPress: () => {} };
        return { label: '▶ Iniciar Sprint (90s)', enabled: true, onPress: startSprint, accent: true };
      case 11: return { label: 'Sigamos →', enabled: true, onPress: advance };
      case 14: return scenarioChecked ? { label: 'Continuar →', enabled: true, onPress: advance } : { label: 'Verificar elección', enabled: scenarioSel !== null, onPress: checkScenario, accent: true };
      case 16: return dragSolved ? { label: 'Continuar →', enabled: true, onPress: advance } : { label: 'Verificar clasificación', enabled: Object.keys(dragPlaced).length > 0, onPress: checkDrag, accent: true };
      case 17: return tfChecked ? { label: 'Continuar →', enabled: true, onPress: advance } : { label: 'Comprobar', enabled: Object.keys(tfAnswers).length === tfQ.length, onPress: checkTF, accent: true };
      case 18: return quizChecked ? { label: 'Ver resultado →', enabled: true, onPress: advance } : { label: 'Comprobar respuestas', enabled: Object.keys(quizAnswers).length === commsQ.length, onPress: checkQuiz, accent: true };
      default: return { label: 'Continuar →', enabled: true, onPress: advance };
    }
  };

  const finishLevel = () => {
    const stars = xp >= 230 ? 3 : xp >= 150 ? 2 : 1; // máx real ~323 XP
    completeLevel(29, stars, xp);
    router.replace('/level/30');
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
    switch (step) {
      case 0: return (
        <View>
          <View style={styles.introIcon}><Text style={{ fontSize: 34 }}>📣</Text></View>
          <Tag icon="✨" label="Nivel 29 · Mundo 5" variant="intro" />
          <Title>Comparte tu Creación con el Mundo</Title>
          <Sub>El proyecto más brillante muere si nadie lo descubre. Aprende a contar tu historia, encontrar tu audiencia y compartir con propósito — sin volverte adicto a likes vacíos.</Sub>
          <View style={[styles.card, styles.cardAccent]}><Text style={styles.cardTitle}>📚  Qué vas a aprender</Text><Text style={styles.cardText}>Storytelling con problema/héroe/solución · Lenguaje de cada plataforma · Cómo usar IA para crear contenido · Hashtags y SEO · Manejo de críticas · Vanity vs impacto real</Text></View>
          <View style={[styles.card, styles.cardGreen]}><Text style={styles.cardTitle}>⚡  Qué podrás HACER al terminar</Text><Text style={styles.cardText}>Tener UN post real listo para publicar sobre tu proyecto, con la estrategia para encontrar tu primera audiencia genuina (no comprada).</Text></View>
          <View style={[styles.card, styles.cardYellow]}><Text style={styles.cardTitle}>🎮  19 módulos · 45-60 min · hasta 230 XP</Text><Text style={styles.cardText}>📖 Teoría · 🤔 Reflexión · 🪝 Hook · 🎨 Multimodal · ↕️ Sort viral · 🔗 Plataformas · ✍️ Descripción · 🖼️ Miniatura · 💭 Seguidores · ⏱ Sprint posts · 🌟 Casos virales · 🏷️ Hashtags · 🎬 Video · 🎯 Tribu · 💭 Críticas · 🛡️ Privacidad · ✅ V/F métricas · ❓ Quiz · ✍️ Tu post</Text></View>
        </View>
      );
      case 1: return (
        <View>
          <Tag icon="📖" label="Módulo 1 de 19 · Teoría" variant="theory" />
          <Title>Por qué compartir lo que creas multiplica el impacto</Title>
          <Body>El proyecto más brillante muere en silencio si nadie lo descubre. <B>Compartir no es opcional</B> — es parte del trabajo. Pero hay una diferencia entre <B>vender</B> (que se siente raro) y <B>contar tu historia</B> (que conecta).</Body>
          <View style={styles.highlightBox}><Text style={styles.highlightText}>💡 <B>La fórmula universal de toda historia que engancha:</B>{'\n\n'}<B>1. Problema</B> doloroso y específico.{'\n'}<B>2. Héroe</B> con quien la audiencia se identifica.{'\n'}<B>3. Solución</B> concreta que cambia su realidad.</Text></View>
          <Body>Esta fórmula la usan desde Hollywood hasta las TED talks. Funciona porque <B>el cerebro humano está cableado para historias</B>, no para datos sueltos.</Body>
          <Text style={styles.sectionTitle}>🔑 Las 3 reglas para no sonar a vendedor</Text>
          {[['1', 'El héroe es tu USUARIO,', ' no tu producto. Tu app es solo la espada.'], ['2', 'Empieza por el dolor,', ' no por ti. Nadie se conecta con tu CV.'], ['3', 'Datos concretos,', " no palabras vagas. '240 estudiantes' > 'mucha gente'."]].map(([n, t, d]) => (
            <View key={n} style={styles.stepLi}><View style={styles.stepNum}><Text style={styles.stepNumText}>{n}</Text></View><Text style={styles.stepLiText}><B>{t}</B>{d}</Text></View>
          ))}
          <View style={styles.tipBox}><Text style={styles.tipText}>✅ <B>Verdad incómoda:</B> compartir no es marketing — es responsabilidad. Si construiste algo útil y nadie lo conoce, le fallaste a la gente que lo necesitaba.</Text></View>
        </View>
      );
      case 5: return (
        <View>
          <Tag icon="↕️" label="Módulo 5 de 19 · Ordenar" variant="activity" />
          <Title>Viral por buenas razones</Title>
          <Sub>6 principios. Ordénalos del más fundamental al menos crítico.</Sub>
          {sortOrder.map((itemIdx, pos) => (
            <View key={pos} style={[styles.sortItem, sortWrong.has(pos) && styles.sortItemWrong, sortSolved && styles.sortItemOk]}>
              <View style={styles.sortNum}><Text style={styles.sortNumText}>{pos + 1}</Text></View>
              <Text style={styles.sortText}><B>{VIRAL_SORT[itemIdx].l}</B>{VIRAL_SORT[itemIdx].r}</Text>
              <View style={styles.sortArrows}>
                <TouchableOpacity disabled={pos === 0 || sortSolved} style={[styles.sortBtn, (pos === 0 || sortSolved) && styles.sortBtnOff]} onPress={() => moveSort(pos, -1)}><Text style={styles.sortBtnText}>▲</Text></TouchableOpacity>
                <TouchableOpacity disabled={pos === sortOrder.length - 1 || sortSolved} style={[styles.sortBtn, (pos === sortOrder.length - 1 || sortSolved) && styles.sortBtnOff]} onPress={() => moveSort(pos, 1)}><Text style={styles.sortBtnText}>▼</Text></TouchableOpacity>
              </View>
            </View>
          ))}
          {sortFb && <View style={[styles.fb, sortFb.ok ? styles.fbOk : styles.fbBad]}><Text style={sortFb.ok ? styles.fbOkText : styles.fbBadText}>{sortFb.msg}</Text></View>}
        </View>
      );
      case 6: return (
        <View>
          <Tag icon="🔗" label="Módulo 6 de 19 · Matching" variant="activity" />
          <Title>El lenguaje de cada plataforma</Title>
          <Sub>Cada red tiene su propio dialecto. Conéctalo correctamente: toca una plataforma y luego su lenguaje.</Sub>
          <View style={styles.matchHeaderRow}><Text style={styles.matchColLabel}>Plataforma</Text><Text style={styles.matchColLabel}>Lenguaje específico</Text></View>
          {matchPairs.map((p, i) => (
            <View key={i} style={styles.matchRow}>
              <TouchableOpacity disabled={matchedLeft.has(i)} style={[styles.matchItem, styles.matchLeft, matchSel === i && styles.matchItemSel, matchedLeft.has(i) && styles.matchItemDone, matchWrong?.l === i && styles.matchItemWrong]} onPress={() => matchLeft(i)}>
                <Text style={[styles.matchText, styles.matchLeftText, matchedLeft.has(i) && styles.matchTextDone]}>{p.left}</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={matchedRight.has(i)} style={[styles.matchItem, styles.matchRightBox, matchedRight.has(i) && styles.matchItemDone, matchWrong?.r === i && styles.matchItemWrong]} onPress={() => matchRight(i)}>
                <Text style={[styles.matchText, styles.matchRightText, matchedRight.has(i) && styles.matchTextDone]}>{rightOrder[i]}</Text>
              </TouchableOpacity>
            </View>
          ))}
          {matchFb && <View style={[styles.fb, styles.fbOk]}><Text style={styles.fbOkText}>{matchFb.msg}</Text></View>}
        </View>
      );
      case 10: return (
        <View>
          <Tag icon="⏱" label="Módulo 10 de 19 · Sprint 90s" variant="sprint" />
          <Title>Sprint: ¿buen o mal post?</Title>
          <Sub>Toca solo los buenos posts en 90 segundos. Meta: 5 buenos.</Sub>
          <View style={styles.sprintBox}>
            <View style={styles.sprintTimer}>
              <Text style={[styles.sprintTime, sprintTime <= 10 && { color: P.red }]}>{Math.floor(sprintTime / 60)}:{String(sprintTime % 60).padStart(2, '0')}</Text>
              <Text style={styles.sprintLabel}>{sprintDone ? 'Sprint terminado' : sprintRunning ? `${Object.values(sprintPicks).filter((v) => v === 'good').length} buenos · ${Object.keys(sprintPicks).length} elegidos` : 'Meta: 5 buenos'}</Text>
            </View>
            <View style={{ gap: 7 }}>
              {POST_SPRINT_ITEMS.map((it, i) => {
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
      case 11: return (
        <View>
          <Tag icon="🌟" label="Módulo 11 de 19 · Casos virales" variant="example" />
          <Title>Viral por buenas razones (casos reales)</Title>
          <Sub>3 historias de creadores que viralizaron sin vender humo. Toca cada tarjeta 👆</Sub>
          {renderExCard(0, '🎓', 'Khan Academy · de aula a 18M', <Text>Sal Khan empezó subiendo videos de matemáticas en YouTube en 2007. <B>Sin estética profesional, sin equipo.</B> Pero cada video resolvía UN problema específico. Hoy: 18M de suscriptores y millones aprenden gratis.</Text>, '⭐ La fórmula: explicar algo difícil de forma simple, una y otra vez. La constancia + utilidad real superan cualquier tendencia.')}
          {renderExCard(1, '🌍', 'Mariana Costa · Laboratoria', <Text>Mariana cuenta la historia de mujeres latinas aprendiendo a programar. <B>No habla de su startup — habla de las graduadas:</B> madres solteras, ex-trabajadoras informales, ahora desarrolladoras con ingresos formales.</Text>, '⭐ Viraliza porque las heroínas son las graduadas, no ella. Gracias a esa narrativa: $50M+ recaudados y 4,000+ graduadas en LATAM.')}
          {renderExCard(2, '🎨', 'Nas Daily · 1 minuto diario', <Text>Nuseir Yassin construyó una audiencia de 60M+ con videos de exactamente 1 minuto contando historias humanas por el mundo. <B>Su clave: nunca empezar con datos, siempre con un humano específico.</B></Text>, '⭐ Patrón replicable: 1 humano + 1 problema + 1 solución + 1 lección, en 60 segundos. Funciona en cualquier nicho.')}
        </View>
      );
      case 14: return (
        <View>
          <Tag icon="🎯" label="Módulo 14 de 19 · Escenario" variant="case" />
          <Title>Comunidad: encuentra tu tribu</Title>
          <View style={styles.scenarioBox}><Text style={styles.scenarioLabel}>🎬 LA SITUACIÓN</Text><Text style={styles.scenarioText}>4 estrategias para encontrar tu primera audiencia real. ¿Cuál SÍ funciona?</Text></View>
          <Sub><B>Elige la mejor opción</B></Sub>
          {scnOrder.map((idx, pos) => {
            const c = TRIBE_SCN[idx];
            const showOk = scenarioChecked && c.correct;
            const showWrong = scenarioChecked && scenarioSel === idx && !c.correct;
            return (
              <TouchableOpacity key={pos} disabled={scenarioChecked} style={[styles.scChoice, scenarioSel === idx && !scenarioChecked && styles.scChoiceSel, showOk && styles.scChoiceOk, showWrong && styles.scChoiceWrong]} onPress={() => setScenarioSel(idx)}>
                <Text style={styles.scTitle}>{c.title}</Text>
                <Text style={styles.scText}>{c.text}</Text>
              </TouchableOpacity>
            );
          })}
          {scenarioChecked && scenarioSel !== null && (
            <View style={[styles.fb, TRIBE_SCN[scenarioSel].correct ? styles.fbOk : styles.fbBad]}>
              <Text style={TRIBE_SCN[scenarioSel].correct ? styles.fbOkText : styles.fbBadText}>{TRIBE_SCN[scenarioSel].correct ? `✅ ¡Correcto! ${TRIBE_SCN[scenarioSel].explain}` : `❌ Mejor opción: ${TRIBE_SCN[scnOrder.find((i) => TRIBE_SCN[i].correct)!].title} — ${TRIBE_SCN[scnOrder.find((i) => TRIBE_SCN[i].correct)!].explain}`}</Text>
            </View>
          )}
        </View>
      );
      case 16: {
        const zones: { k: 'share' | 'protect'; label: string }[] = [
          { k: 'share', label: '📢 Compartir libre' },
          { k: 'protect', label: '🔒 Proteger' },
        ];
        return (
          <View>
            <Tag icon="🛡️" label="Módulo 16 de 19 · Clasificar" variant="activity" />
            <Title>Privacidad al compartir tu proyecto</Title>
            <Sub>8 elementos. ¿Cuáles puedes compartir libremente y cuáles debes proteger? Toca un chip y luego su columna.</Sub>
            <View style={styles.chipsPool}>
              {privacyItems.map((it, i) => dragPlaced[i] === undefined && (
                <TouchableOpacity key={i} disabled={dragSolved} style={[styles.chip, dragSel === i && styles.chipSel, dragFlash.has(i) && styles.chipFlash]} onPress={() => setDragSel(dragSel === i ? null : i)}>
                  <Text style={[styles.chipText, dragSel === i && { color: P.tealText }]}>{it.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.dropCols}>
              {zones.map((z) => {
                const placedHere = Object.keys(dragPlaced).map(Number).filter((k) => dragPlaced[k] === z.k);
                const hasItem = placedHere.length > 0;
                const zStyle = z.k === 'share' ? styles.zoneShare : styles.zoneProtect;
                const zColor = z.k === 'share' ? P.greenText : P.redText;
                return (
                  <TouchableOpacity key={z.k} activeOpacity={0.9} disabled={dragSel === null || dragSolved} style={[styles.dropCol, hasItem && zStyle]} onPress={() => placeDrag(z.k)}>
                    <View style={[styles.dropHeader, z.k === 'share' ? styles.dropHeaderShare : styles.dropHeaderProtect]}><Text style={[styles.dropHeaderText, { color: zColor }]}>{z.label}</Text></View>
                    <View style={styles.dropArea}>
                      {placedHere.map((k) => (
                        <TouchableOpacity key={k} disabled={dragSolved} onPress={() => removeDrag(k)} style={[styles.dropChip, z.k === 'share' ? styles.dropChipShare : styles.dropChipProtect]}>
                          <Text style={[styles.dropChipText, { color: zColor }]}>{privacyItems[k].text}  ✕</Text>
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
      case 17: return (
        <View>
          <Tag icon="✅" label="Módulo 17 de 19 · Verdadero o Falso" variant="activity" />
          <Title>Impacto real vs vanity metrics</Title>
          <Sub>5 afirmaciones sobre métricas. ¿Cuáles son verdad y cuáles trampa?</Sub>
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
      case 18: return (
        <View>
          <Tag icon="❓" label="Módulo 18 de 19 · Quiz" variant="quiz" />
          <Title>Quiz · Comunicación digital</Title>
          <Sub>5 preguntas sobre los fundamentos. Demuestra lo aprendido.</Sub>
          {commsQ.map((q, qi) => (
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
      case 20: {
        const pct = Math.round((29 / 36) * 100);
        return (
          <View style={styles.completeContainer}>
            <View style={styles.completeBadge}><Text style={{ fontSize: 44 }}>📣</Text></View>
            <Text style={styles.completeTitle}>¡Nivel 29 completado!</Text>
            <Text style={styles.completeSub}>Terminaste "Comparte tu Creación con el Mundo". Ahora eres Content Creator.</Text>
            <View style={styles.xpEarned}><Text style={styles.xpEarnedText}>⭐ {xp} XP ganados en este nivel</Text></View>
            <View style={styles.skillsList}>
              {['Sé los 3 elementos de una historia que engancha (problema, héroe, solución)', 'Adapto el contenido al lenguaje específico de cada plataforma', 'Uso IA para escribir descripciones, miniaturas y guiones de video', 'Distingo impacto real de vanity metrics y respondo sin ego ni miedo a las críticas', 'Tengo 1 post real listo para publicar sobre mi proyecto'].map((s, i) => (
                <View key={i} style={styles.skillRow}><Text style={styles.skillCheck}>✓</Text><Text style={styles.skillText}>{s}</Text></View>
              ))}
            </View>
            <View style={styles.nextHint}><Text style={styles.nextHintText}><B>Nivel 30: Presenta tu Proyecto</B>{'\n'}Ya sabes contarla en redes. Ahora vas a aprender a presentarla en vivo: deck, elevator pitch y manejo de preguntas difíciles. La habilidad final que multiplica todo lo demás.</Text></View>
            <View style={styles.lvlBarWrap}>
              <Text style={styles.lvlBarLabel}>Nivel 29 de 36 completado · {pct}% del camino</Text>
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
  fill: { height: '100%', backgroundColor: P.teal, borderRadius: 4 },
  xpChip: { ...typography.bold, fontSize: 13, color: '#854d0e', backgroundColor: '#fde68a', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
  progLabel: { ...typography.regular, fontSize: 11, color: P.faint, textAlign: 'center', paddingTop: 6 },
  scrollContent: { padding: 16, paddingBottom: 30 },

  tag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginBottom: 12 },
  tagText: { fontSize: 11, fontWeight: '700' },

  introIcon: { width: 68, height: 68, borderRadius: 20, backgroundColor: P.tealBg, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  title: { ...typography.extraBold, fontSize: 20, color: P.ink, marginBottom: 8, lineHeight: 26 },
  sub: { ...typography.regular, fontSize: 13, color: P.muted, lineHeight: 20, marginBottom: 12 },
  bodyText: { ...typography.regular, fontSize: 13, color: P.body, lineHeight: 22, marginBottom: 12 },
  bold: { fontWeight: '700', color: P.ink },
  sectionTitle: { ...typography.bold, fontSize: 14, color: P.ink, marginTop: 10, marginBottom: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f0f0f0' },

  card: { backgroundColor: P.cardBg, borderRadius: 14, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: P.border },
  cardAccent: { backgroundColor: P.tealBg, borderColor: P.tealBorder },
  cardGreen: { backgroundColor: P.greenSoft, borderColor: P.greenBorder },
  cardYellow: { backgroundColor: '#fefce8', borderColor: P.amberBorder },
  cardPurple: { backgroundColor: P.purpleBg, borderColor: P.purpleBorder },
  cardTitle: { ...typography.bold, fontSize: 13, color: P.ink, marginBottom: 4 },
  cardText: { ...typography.regular, fontSize: 13, color: P.body, lineHeight: 21 },

  highlightBox: { borderLeftWidth: 3, borderLeftColor: P.teal, backgroundColor: P.tealBg, borderRadius: 8, padding: 12, marginBottom: 12 },
  highlightText: { fontSize: 13, color: P.tealText, lineHeight: 21 },
  tipBox: { borderLeftWidth: 3, borderLeftColor: P.green, backgroundColor: P.greenSoft, borderRadius: 8, padding: 12, marginTop: 4 },
  tipText: { fontSize: 13, color: P.greenText, lineHeight: 21 },
  stepLi: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 9 },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: P.teal, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  stepLiText: { flex: 1, fontSize: 13, color: P.body, lineHeight: 20 },

  chipsPool: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, padding: 10, backgroundColor: P.cardBg, borderRadius: 14, borderWidth: 1, borderColor: P.border, marginBottom: 10, minHeight: 54 },
  chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#d1d5db', backgroundColor: '#fff' },
  chipSel: { borderColor: P.teal, backgroundColor: P.tealBg },
  chipFlash: { borderColor: '#fca5a5', backgroundColor: P.redBg },
  chipText: { fontSize: 12, color: P.body, lineHeight: 16 },
  dropCols: { flexDirection: 'row', gap: 8 },
  dropCol: { flex: 1, borderRadius: 12, borderWidth: 2, borderColor: '#d1d5db', borderStyle: 'dashed', minHeight: 110, padding: 8, backgroundColor: '#fafafa' },
  zoneShare: { borderStyle: 'solid', borderColor: P.greenBorder, backgroundColor: P.greenSoft },
  zoneProtect: { borderStyle: 'solid', borderColor: P.redBorder, backgroundColor: P.redBg },
  dropHeader: { paddingVertical: 5, paddingHorizontal: 6, borderRadius: 7, marginBottom: 7, alignItems: 'center' },
  dropHeaderShare: { backgroundColor: P.greenBg },
  dropHeaderProtect: { backgroundColor: '#fee2e2' },
  dropHeaderText: { fontSize: 11, fontWeight: '700' },
  dropArea: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  dropChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14 },
  dropChipShare: { backgroundColor: P.greenBg },
  dropChipProtect: { backgroundColor: '#fee2e2' },
  dropChipText: { fontSize: 11, fontWeight: '500', lineHeight: 15 },

  sortItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: P.cardBg, borderRadius: 12, borderWidth: 1.5, borderColor: P.border, marginBottom: 7 },
  sortItemOk: { borderColor: '#86efac', backgroundColor: P.greenSoft },
  sortItemWrong: { borderColor: '#fca5a5', backgroundColor: P.redBg },
  sortNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: P.teal, alignItems: 'center', justifyContent: 'center' },
  sortNumText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  sortText: { flex: 1, fontSize: 12, color: P.body, lineHeight: 17 },
  sortArrows: { gap: 3 },
  sortBtn: { width: 30, height: 26, borderRadius: 7, borderWidth: 1, borderColor: P.border, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  sortBtnOff: { opacity: 0.25 },
  sortBtnText: { fontSize: 11, color: P.muted },

  matchHeaderRow: { flexDirection: 'row', gap: 6, marginBottom: 5 },
  matchColLabel: { flex: 1, fontSize: 11, fontWeight: '700', color: P.muted, textAlign: 'center' },
  matchRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  matchItem: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', minHeight: 64 },
  matchLeft: { borderColor: P.blueBorder, backgroundColor: P.blueBg },
  matchRightBox: { borderColor: P.purpleBorder, backgroundColor: P.purpleBg },
  matchItemSel: { borderColor: P.teal, backgroundColor: P.tealBg },
  matchItemDone: { borderColor: P.green, backgroundColor: P.greenSoft },
  matchItemWrong: { borderColor: P.red, backgroundColor: P.redBg },
  matchText: { fontSize: 12, textAlign: 'center', lineHeight: 16 },
  matchLeftText: { color: P.blueText, fontWeight: '700' },
  matchRightText: { color: P.purpleText },
  matchTextDone: { color: P.greenText },

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

  builderWrap: { gap: 10 },
  builderRow: { backgroundColor: P.cardBg, borderWidth: 1, borderColor: P.border, borderRadius: 12, padding: 11 },
  builderLabel: { fontSize: 11, fontWeight: '700', color: P.tealText, marginBottom: 6, letterSpacing: 0.3, textTransform: 'uppercase' },
  builderOpts: { gap: 5 },
  builderOpt: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 9, borderWidth: 1.5, borderColor: P.border, backgroundColor: '#fff' },
  builderOptSel: { borderColor: P.teal, backgroundColor: P.tealBg },
  builderOptText: { fontSize: 12, color: P.body, fontWeight: '500', lineHeight: 16 },
  builderOptTextSel: { color: P.tealText, fontWeight: '700' },
  codeBox: { backgroundColor: P.codeBg, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#1e293b' },
  codeLine: { fontSize: 12, lineHeight: 20, marginBottom: 2 },
  codeText: { color: P.codeText, fontFamily: 'monospace' },
  codeKey: { color: P.codeKey, fontWeight: '700', fontFamily: 'monospace' },
  codeEmpty: { color: P.codeEmpty, fontStyle: 'italic', fontFamily: 'monospace' },

  quizQ: { ...typography.bold, fontSize: 13, color: P.ink, padding: 12, backgroundColor: P.cardBg, borderRadius: 10, borderWidth: 1, borderColor: P.border, marginBottom: 8, lineHeight: 19 },
  qopt: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 11, borderWidth: 1.5, borderColor: P.border, backgroundColor: '#fff', marginBottom: 7 },
  qoptSel: { borderColor: P.teal, backgroundColor: P.tealBg },
  qoptOk: { borderColor: P.green, backgroundColor: P.greenBg },
  qoptWrong: { borderColor: P.red, backgroundColor: P.redBg },
  qLetter: { width: 24, height: 24, borderRadius: 7, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: P.border, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  qLetterSel: { backgroundColor: P.teal, borderColor: P.teal },
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

  scenarioBox: { backgroundColor: '#fffbeb', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: P.amberBorder },
  scenarioLabel: { fontSize: 10, fontWeight: '700', color: P.amberText, marginBottom: 8, letterSpacing: 0.7 },
  scenarioText: { fontSize: 13, color: P.body, lineHeight: 21 },
  scChoice: { borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: P.border, marginBottom: 8, backgroundColor: '#fff' },
  scChoiceSel: { borderColor: P.teal, backgroundColor: P.tealBg },
  scChoiceOk: { borderColor: P.green, backgroundColor: P.greenSoft },
  scChoiceWrong: { borderColor: P.red, backgroundColor: P.redBg },
  scTitle: { fontSize: 12, fontWeight: '700', color: P.ink, marginBottom: 4 },
  scText: { fontSize: 12, color: P.body, lineHeight: 17 },

  reflectArea: { minHeight: 120, padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: P.border, backgroundColor: '#fafafa', fontSize: 13, color: P.body, lineHeight: 22, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: P.faint, textAlign: 'right', marginTop: 4 },

  exCard: { borderRadius: 14, padding: 12, borderWidth: 1, borderColor: P.border, marginBottom: 8, backgroundColor: '#fff' },
  exCardOpen: { borderColor: P.teal, backgroundColor: P.tealBg },
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
  completeBadge: { width: 88, height: 88, borderRadius: 24, backgroundColor: P.teal, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
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
  lvlBarInner: { height: '100%', backgroundColor: P.teal, borderRadius: 4 },

  navRow: { flexDirection: 'row', gap: 8, padding: 14, borderTopWidth: 1, borderTopColor: '#f0f0f0', backgroundColor: '#fafafa' },
  backBtn: { paddingHorizontal: 16, paddingVertical: 13, borderRadius: 12, backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#e2e8f0', justifyContent: 'center' },
  backBtnText: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  primaryBtn: { backgroundColor: P.green, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
  primaryBtnAccent: { backgroundColor: P.teal },
  primaryBtnOff: { opacity: 0.35 },
  primaryBtnText: { ...typography.bold, color: '#fff', fontSize: 15 },
});
