import { exitLevel } from '../utils/exitLevel';
import { router } from 'expo-router';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { typography } from '../theme';
import XPToast from '../components/XPToast';

// ═══════════════════════════════════════════════════════════
// Nivel 28 · Diseña una App con IA — Sin Código
// Mundo 5 · TEMA CLARO (violeta/púrpura: #7c3aed → #a855f7).
// Reconstruido vs nivel-28.html (estándar v2.2).
// 20 módulos de contenido (19 numerados + reflexión final).
// ═══════════════════════════════════════════════════════════

const P = {
  screen: '#ffffff',
  ink: '#111827', body: '#374151', muted: '#6b7280', faint: '#9ca3af',
  violet: '#7c3aed', violetText: '#5b21b6', violetBg: '#faf5ff', violetBorder: '#e9d5ff', violetSoft: '#fdf4ff', lilac: '#a855f7',
  border: '#e5e7eb', cardBg: '#f9fafb',
  green: '#16a34a', greenBg: '#dcfce7', greenText: '#166534', greenSoft: '#f0fdf4', greenBorder: '#bbf7d0',
  red: '#dc2626', redBg: '#fef2f2', redText: '#991b1b',
  blueBg: '#eff6ff', blueBorder: '#bfdbfe', blueText: '#1e40af',
  amberBg: '#fef3c7', amberText: '#92400e', amberBorder: '#fde68a',
  slateBg: '#f1f5f9', slateText: '#475569', slateBorder: '#cbd5e1',
  codeBg: '#0f172a', codeText: '#e2e8f0', codeKey: '#c4b5fd', codeEmpty: '#64748b',
};

const TOTAL_STEPS = 22;   // 0 intro · 1-19 módulos + 20 reflexión · 21 completado
const CONTENT_STEPS = 19;
const THEORY_STEPS = new Set([0, 1, 3, 4, 14]);

type DragItem = { text: string; correct: 'core' | 'auth' | 'settings' };
type QuizQ = { q: string; opts: string[]; correct: number; explain: string };
type TFItem = { stmt: string; correct: boolean; explain: string };
type ScenarioChoice = { title: string; text: string; correct: boolean; explain: string };
type BuilderConfig = { xp: number; rows: { key: string; label: string; opts: string[] }[] };

const pickN = <T,>(arr: T[], n: number): T[] => [...arr].sort(() => Math.random() - 0.5).slice(0, n);
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
const REFLECT_TERMS = ['app', 'pantalla', 'construir', 'usuario', 'wireframe', 'funcion', 'base de datos', 'ia', 'publicar', 'lovable', 'bolt', 'bubble', 'disen', 'boton', 'pieza', 'empezar', 'prototipo', 'monetiz', 'feature', 'idea', 'flujo', 'proyecto', 'valor'];
const containsTopic = (text: string): boolean => {
  const n = normalizeText(text);
  const words = n.split(/[^a-z0-9]+/).filter(Boolean);
  return REFLECT_TERMS.some((t) => (t.length <= 3 ? words.includes(t) : n.includes(t)));
};

// ── Pools (fuente: nivel-28.html) — distractores alargados (§15/27) ──
const NOCODE_POOL: QuizQ[] = [
  { q: "¿Qué significa 'no-code'?", opts: ['Programar software pero sin usar un computador', 'Construir software sin escribir código, usando interfaces visuales', 'Aplicaciones que funcionan totalmente sin internet', 'Aplicaciones que solo funcionan dentro del celular'], correct: 1, explain: 'No-code = construir con interfaces visuales (drag-and-drop, prompts) sin sintaxis de programación.' },
  { q: '¿Cuál NO es una herramienta no-code real?', opts: ['Lovable', 'Bubble', 'Bolt', 'Pythonex'], correct: 3, explain: 'Pythonex no existe. Lovable, Bubble y Bolt sí — construyen apps con prompts y visual.' },
  { q: '¿Cuál es la mayor ventaja de no-code para alguien que empieza?', opts: ['Las apps que produce son mucho más rápidas', 'Validar tus ideas en horas en lugar de en meses', 'Las apps consumen bastante menos batería', 'Las apps tienen mejor diseño de forma automática'], correct: 1, explain: 'Velocidad de validación. Lo que tomaba 6 meses con un dev hoy se prototipa en 2 horas.' },
  { q: 'Limitación real de las herramientas no-code:', opts: ['No se pueden conectar a internet de ninguna manera', 'A escala muy grande pueden ser más caras o lentas que el código propio', 'No funcionan en dispositivos móviles, solo en computador', 'Solamente sirven si las usas en idioma inglés'], correct: 1, explain: 'Para 100 usuarios: perfectas. Para 100 millones: probablemente migrarás a código nativo.' },
  { q: "¿Es 'low-code' lo mismo que 'no-code'?", opts: ['Sí, low-code y no-code son exactamente sinónimos', 'No: low-code permite escribir algo de código cuando hace falta', 'Low-code es una versión pensada solo para principiantes', 'No-code sirve únicamente para crear apps móviles'], correct: 1, explain: 'Low-code = mayoría visual + algo de código. No-code = 100% visual. Bubble es low-code; Lovable es no-code puro.' },
];

const DB_POOL: QuizQ[] = [
  { q: "Una 'tabla' en una base de datos es como:", opts: ['Un documento de texto de Microsoft Word', 'Una hoja de Excel con columnas y filas', 'Una imagen o fotografía guardada en el teléfono', 'Un correo electrónico que envías a alguien'], correct: 1, explain: 'Tabla = Excel con superpoderes. Cada fila = un registro; cada columna = un atributo.' },
  { q: 'Si tu app tiene usuarios, ¿qué tabla SIEMPRE necesitas?', opts: ['users', 'colors', 'buttons', 'videos'], correct: 0, explain: "La tabla 'users' guarda nombre, email, contraseña, fecha de registro. Base de cualquier app con cuenta." },
  { q: "¿Qué es una 'relación' entre tablas?", opts: ['Es cuando dos aplicaciones distintas se enamoran', 'Una conexión entre registros: este pedido pertenece a este usuario', 'Un error que ocurre dentro de la base de datos', 'Una copia de seguridad de toda la información'], correct: 1, explain: "Relación = conexión lógica. Ej: 'pedidos' tiene una columna user_id que apunta a 'users'." },
  { q: 'Supabase, Firebase y Airtable son:', opts: ['Editores de fotos y de imágenes profesionales', 'Bases de datos en la nube fáciles de conectar a apps no-code', 'Lenguajes de programación para crear aplicaciones', 'Modelos de inteligencia artificial muy avanzados'], correct: 1, explain: 'Las 3 son backends-as-a-service: bases de datos + autenticación listas para conectar.' },
  { q: "¿Qué hace la 'autenticación' en una app?", opts: ['Verifica que la conexión wifi esté funcionando bien', 'Confirma quién es el usuario con login por email o Google', 'Dibuja los botones y elementos visuales de la app', 'Genera imágenes automáticamente usando inteligencia artificial'], correct: 1, explain: 'Autenticación = quién eres. Autorización = qué puedes hacer. Toda app con cuenta las necesita.' },
  { q: 'Cuando un usuario crea una publicación, esa info:', opts: ['Se queda solo en la pantalla de esa persona', 'Se guarda en la base de datos para que otros la vean', 'Se borra automáticamente al cerrar la aplicación', 'Se envía por correo electrónico a los contactos'], correct: 1, explain: 'Sin base de datos, nada persiste. La BD es la memoria de tu app.' },
];

const MONEY_POOL: QuizQ[] = [
  { q: "El modelo 'freemium' significa:", opts: ['Que absolutamente todo es siempre gratis', 'Lo básico gratis y las funciones premium son de pago', 'Que solo pagas una vez, la primera que entras', 'Que muestra anuncios de forma obligatoria a todos'], correct: 1, explain: 'Freemium = Spotify, Duolingo, Notion. Atrae con gratis, monetiza al 5-10% que paga premium.' },
  { q: '¿Cuál es la mayor desventaja de monetizar con ads?', opts: ['Que mostrar anuncios es completamente ilegal', 'Necesitas muchísimos usuarios para que funcione y empeora la experiencia', 'Que la publicidad solo funciona en teléfonos móviles', 'Que los usuarios no entienden cómo funcionan los anuncios'], correct: 1, explain: 'Ads pagan poco por usuario. Necesitas escala (10K+) para ganar dinero real, y muchos odian la experiencia.' },
  { q: 'Suscripción mensual vs. pago único:', opts: ['El pago único siempre es la mejor opción posible', 'La suscripción genera ingresos predecibles para mantener y mejorar la app', 'El pago único y la suscripción son exactamente lo mismo', 'Solamente Apple permite cobrar por suscripciones mensuales'], correct: 1, explain: 'Suscripción = ingresos recurrentes para sostener desarrollo. Modelo dominante en SaaS hoy.' },
  { q: 'Tu app vende productos físicos. Mejor modelo:', opts: ['Una suscripción mensual fija para todos los usuarios', 'Una comisión por venta: un % de cada transacción', 'Mostrar anuncios publicitarios dentro de la aplicación', 'Un pago único que se cobra al descargar la app'], correct: 1, explain: 'Marketplace clásico: Mercado Libre, Amazon, Rappi. El % por transacción alinea incentivos.' },
  { q: 'Lovable, Vercel y Supabase usan plan:', opts: ['Son completamente gratis para siempre, sin costo', 'Freemium: gratis al inicio y con escalado por uso', 'Son de pago obligatorio desde el primer momento', 'Se financian únicamente mostrando anuncios publicitarios'], correct: 1, explain: 'Tier gratuito generoso para empezar; pagas cuando creces. Modelo dominante en herramientas dev.' },
];

const PUBLISH_POOL: QuizQ[] = [
  { q: '¿Qué es una PWA?', opts: ['Un tipo de virus que infecta los teléfonos', 'Progressive Web App: una web que se instala como app sin pasar por la App Store', 'Un lenguaje de programación para crear páginas web', 'Una marca reconocida de teléfonos celulares modernos'], correct: 1, explain: 'PWA = web instalable en móvil, sin aprobación de Apple/Google. Notificaciones, offline, ícono. Ideal para MVP.' },
  { q: 'Publicar en App Store cuesta:', opts: ['Es completamente gratis para cualquier persona', '99 USD al año más un proceso de aprobación de varios días', 'Cero pesos, pero el proceso tarda cerca de un año', 'Solamente pueden publicar empresas grandes registradas'], correct: 1, explain: 'Apple Developer = 99 USD/año. Google Play = 25 USD una vez. Apple es más estricto en aprobación.' },
  { q: 'Tu MVP necesita probarse rápido. ¿Dónde publicas primero?', opts: ['En la App Store de Apple directamente', 'En una PWA web, sin intermediarios ni aprobaciones', 'En la Play Store de Google directamente', 'En la Microsoft Store para computadores Windows'], correct: 1, explain: 'PWA web = lanzas en horas, iteras al instante. Las app stores las dejas para cuando tengas tracción.' },
  { q: 'Vercel, Netlify y el hosting de Lovable hacen:', opts: ['Crear logotipos y elementos de marca para tu app', 'Publicar tu web o PWA con un dominio en minutos', 'Editar fotografías y darles retoques profesionales', 'Vender productos físicos a través de un catálogo'], correct: 1, explain: 'Hosting moderno: conectas tu repo, haces push y queda online en segundos. Ideal para PWA y webs.' },
  { q: '¿Por qué la App Store rechaza apps a veces?', opts: ['Por incluir emojis en el nombre de la app', 'Por baja calidad, plagio evidente, contenido inapropiado o bugs claros', 'Por usar inteligencia artificial dentro de la app', 'Por tener menos de diez pantallas en total'], correct: 1, explain: 'Razones típicas: app rota, plagio, privacidad mal manejada, contenido prohibido.' },
];

const FINAL_POOL: QuizQ[] = [
  { q: 'El orden correcto para construir una app no-code:', opts: ['Diseñar el logo, luego publicar y al final hacer el wireframe', 'Wireframe, luego flujos, luego diseño, luego base de datos y publicar', 'Publicar primero, después diseñar y luego ponerse a vender', 'No importa el orden, solo que al final la app funcione'], correct: 1, explain: 'Wireframe (estructura) → flujos → diseño → datos (BD) → deploy. En ese orden.' },
  { q: 'Lovable vs. Bubble: ¿cuándo usar Lovable?', opts: ['Para apps muy complejas con más de 20 roles distintos', 'Para MVPs rápidos donde describes con prompts y la IA construye', 'Únicamente para construir videojuegos y experiencias 3D', 'Para cuando no tienes ninguna conexión a internet'], correct: 1, explain: 'Lovable = velocidad por prompt. Bubble = lógica visual potente para apps complejas.' },
  { q: "El 'ciclo de mejora' después de lanzar:", opts: ['Lanzar la app una vez y luego olvidarse de ella', 'Lanzar, escuchar, analizar, mejorar y volver a repetir', 'Dedicarse solo a arreglar los errores que aparezcan', 'Esperar a tener millones de usuarios antes de cambiar nada'], correct: 1, explain: 'Build-Measure-Learn de Lean Startup. Tu primera versión es solo el comienzo de la conversación.' },
  { q: 'Buen feedback de usuarios viene de:', opts: ['De encuestas larguísimas de 50 preguntas cada una', 'De 3 preguntas concretas más observar el comportamiento real', 'Únicamente de tu familia y tus amigos más cercanos', 'Del promedio de likes que recibes en las redes sociales'], correct: 1, explain: 'Pocas preguntas + observar uso real. Las acciones revelan más que las opiniones.' },
  { q: 'Antes de pagar publicidad para tu app, debes:', opts: ['Tener un logotipo bonito y bien diseñado', 'Validar que sin publicidad ya hay usuarios que la usan seguido', 'Haber pagado la cuenta de Apple Developer primero', 'Tener al menos 100 funciones distintas en la app'], correct: 1, explain: 'Si sin publicidad nadie repite, con publicidad solo quemas plata. Valida retención primero.' },
];

const TF_POOL: TFItem[] = [
  { stmt: 'Mostrar 50 botones en la pantalla principal hace tu app más completa', correct: false, explain: 'Sobrecarga cognitiva. Las apps exitosas tienen 1-3 acciones primarias visibles. Lo demás se esconde.' },
  { stmt: 'Cada pantalla debe tener UN objetivo principal claro', correct: true, explain: 'Una decisión por pantalla = experiencia clara. Múltiples objetivos = confusión.' },
  { stmt: 'El registro debe pedir todos los datos del usuario el primer día', correct: false, explain: 'Pide solo lo mínimo (email + clave). El resto: progresivamente, cuando lo necesites.' },
  { stmt: 'Probar tu app con 5 usuarios reales puede revelar el 80% de los problemas de UX', correct: true, explain: 'Ley clásica de Nielsen: 5 testers detectan ~85% de los problemas de usabilidad.' },
  { stmt: 'Si la app es para móvil, también debe verse bien en desktop', correct: true, explain: 'Responsive es estándar. Lovable/Bolt lo hacen automático, pero verifícalo.' },
  { stmt: 'Cuando lanzas, todo debe estar perfecto antes de mostrarlo a alguien', correct: false, explain: "Reid Hoffman: 'si no te da vergüenza, lanzaste tarde'. MVP imperfecto > app perfecta que nunca sale." },
  { stmt: 'Los colores y tipografía elegidos al azar funcionan igual que un sistema de diseño', correct: false, explain: 'Inconsistencia visual confunde y resta credibilidad. Un sistema simple (3 colores, 2 tipografías) basta.' },
  { stmt: 'Cargar muy lento es una de las razones #1 por las que los usuarios abandonan apps', correct: true, explain: '3+ segundos = pierdes ~40% de usuarios. Performance es UX, no un detalle técnico.' },
];

const SCREEN_POOL: DragItem[] = [
  { text: 'Hero + propuesta de valor + botón principal', correct: 'core' },
  { text: "Formulario de email + clave + 'crear cuenta'", correct: 'auth' },
  { text: 'Galería de las creaciones del usuario', correct: 'core' },
  { text: 'Configuración + cerrar sesión + cambiar idioma', correct: 'settings' },
  { text: 'Login con Google / Apple / email', correct: 'auth' },
  { text: 'Detalle de un elemento con botones de acción', correct: 'core' },
  { text: 'Notificaciones + privacidad + suscripción', correct: 'settings' },
  { text: 'Onboarding inicial de 3 pasos', correct: 'auth' },
  { text: 'Búsqueda + filtros + resultados', correct: 'core' },
  { text: 'Política de privacidad + términos + soporte', correct: 'settings' },
];

const BTN_SCN: ScenarioChoice[] = [
  { title: "Al presionar 'Subir foto' → abrir cámara/galería + procesar con IA + guardar", text: 'El botón principal lleva al usuario a su acción central de valor en máximo 2 toques.', correct: true, explain: 'Acción primaria visible, fricción mínima. Patrón de apps exitosas.' },
  { title: "Al presionar 'Subir foto' → mostrar 12 opciones de configuración primero", text: 'Antes de usar la función, el usuario decide formato, calidad, privacidad, etiquetas.', correct: false, explain: 'Configuración antes de uso = abandono. Mejor: defaults inteligentes + ajustar después.' },
  { title: "Al presionar 'Subir foto' → la app se cierra sola sin explicación", text: 'Bug clásico cuando faltan permisos de cámara y no se manejan errores.', correct: false, explain: 'Toda app debe manejar permisos negados con un mensaje claro y una ruta para resolverlo.' },
  { title: "Al presionar 'Subir foto' → modal que explica POR QUÉ se necesita el permiso", text: 'Antes de pedir el permiso del sistema, la app explica el beneficio para el usuario.', correct: true, explain: 'Explicar el beneficio antes del permiso del sistema duplica la tasa de aceptación.' },
];

const BUILD_SORT = [
  'Wireframe: dibuja las 3-5 pantallas principales en papel o Figma',
  'Flujos: qué hace cada botón y cómo se conectan las pantallas',
  'Prompt a la herramienta: describe la app a Lovable/Bolt',
  'Genera el primer borrador: la IA crea la estructura inicial',
  'Ajusta diseño y conecta base de datos: Supabase, autenticación, tablas',
  'Prueba con 3-5 usuarios reales y publica: deploy a Vercel/Netlify',
];
const IMPROVE_SORT = [
  'Lanzar: versión funcional aunque imperfecta a manos de usuarios reales',
  'Escuchar: entrevistas, soporte, comentarios, mensajes directos',
  'Analizar: identifica patrones — qué se queja más de una persona',
  'Priorizar: alto impacto + bajo esfuerzo primero',
  'Mejorar: implementa el cambio en una nueva iteración corta',
  'Repetir: el ciclo nunca se detiene mientras la app exista',
];

const BUILDER_WIRE: BuilderConfig = { xp: 22, rows: [
  { key: 'p1', label: 'Pantalla 1 · Inicio (lo primero que ven)', opts: ["Hero con propuesta de valor + botón 'Empezar'", 'Lista de últimos elementos (feed)', "Login directo + 'Crear cuenta'", 'Onboarding interactivo de 3 pasos'] },
  { key: 'p2', label: 'Pantalla 2 · Acción principal', opts: ['Formulario corto para crear contenido nuevo', 'Cámara/upload de archivos con IA procesando', 'Búsqueda + filtros', 'Chat con asistente IA'] },
  { key: 'p3', label: 'Pantalla 3 · Resultado / perfil', opts: ['Galería de creaciones del usuario', 'Resumen / dashboard con métricas', 'Detalle de un elemento + acciones', 'Perfil con historial y configuración'] },
] };
const BUILDER_STYLE: BuilderConfig = { xp: 18, rows: [
  { key: 'paleta', label: 'Paleta de color', opts: ['Cálidos (naranja/amarillo/rojo) — energía', 'Fríos (azul/cyan/verde) — confianza', 'Neutros (negro/blanco) — minimalismo', 'Vibrantes (rosa/violeta) — creatividad'] },
  { key: 'tipo', label: 'Tipografía', opts: ['Sans-serif moderna (Inter, Manrope) — tech', 'Serif clásica (Lora, Playfair) — editorial', 'Mono (JetBrains Mono) — técnica', 'Display redonda (Quicksand) — amigable'] },
  { key: 'estilo', label: 'Estilo general', opts: ['Minimalista (mucho blanco, pocos elementos)', 'Bold (colores fuertes, tipografía grande)', 'Glassmorphism (transparencias y blur)', 'Skeumórfico (sombras y profundidad)'] },
] };
const BUILDER_DESCRIBE: BuilderConfig = { xp: 20, rows: [
  { key: 'que', label: '¿Qué hace tu app en una frase?', opts: ['Convierte PDFs en resúmenes con IA', 'Conecta tutores y estudiantes por WhatsApp', 'Gamifica el reciclaje en tu barrio', 'Ayuda a adultos mayores a pagar servicios online', 'Genera plan de estudio personalizado con IA'] },
  { key: 'para', label: '¿Para quién es?', opts: ['Estudiantes 12-17', 'Adultos mayores 60+', 'Emprendedores pequeños', 'Familias con niños', 'Profesionales 25-40'] },
  { key: 'diff', label: '¿Por qué la elegirían?', opts: ['Es 10x más rápida', 'No requiere conocimiento técnico previo', 'Es la única en español de LATAM con IA real', 'Cuesta menos que la mitad de la competencia', 'Es la primera diseñada con la comunidad como aliada'] },
] };
const BUILDER_AI: BuilderConfig = { xp: 20, rows: [
  { key: 'input', label: 'Entrada del usuario', opts: ['Sube un PDF/documento', 'Escribe un texto libre', 'Toma una foto / sube imagen', 'Llena un formulario corto'] },
  { key: 'ia', label: 'Lo que hace la IA', opts: ['Resume en 5 puntos clave', 'Genera variaciones creativas', 'Clasifica/categoriza automáticamente', 'Traduce o reformula al estilo deseado', 'Crea pasos accionables a partir de la entrada'] },
  { key: 'output', label: 'Resultado en pantalla', opts: ['Tarjeta visual con resumen + botones', 'Lista descargable como PDF', 'Audio que se puede escuchar', 'Texto editable que el usuario puede ajustar'] },
] };
const BUILDER_SURVEY: BuilderConfig = { xp: 18, rows: [
  { key: 'q1', label: 'Pregunta 1 (medir si lo necesitan)', opts: ['¿Qué tan decepcionado estarías si esta app dejara de existir?', '¿Cómo resolvías este problema antes de usar la app?', '¿Recomendarías la app a un amigo? (1-10)'] },
  { key: 'q2', label: 'Pregunta 2 (medir uso real)', opts: ['¿Cuántas veces la usaste esta semana?', '¿En qué momento del día la abres?', '¿Qué pantalla usaste más?'] },
  { key: 'q3', label: 'Pregunta 3 (descubrir qué falta)', opts: ['¿Qué función te gustaría que añadiéramos?', '¿Qué te frustró al usarla?', 'Si tuvieras que cambiar UNA cosa, ¿cuál sería?'] },
] };

const BUILDERS: { [k: number]: { cfg: BuilderConfig; header: string; label: string; title: string; sub: string } } = {
  6: { cfg: BUILDER_WIRE, header: 'Tus 3 pantallas:', label: 'Módulo 6 de 19 · Builder', title: 'Wireframe con palabras: tus 3 pantallas', sub: 'Define las 3 pantallas principales de tu app.' },
  8: { cfg: BUILDER_STYLE, header: 'Tu estilo visual:', label: 'Módulo 8 de 19 · Builder', title: 'Colores, tipografía y estilo', sub: '3 decisiones que definen la identidad visual de tu app.' },
  11: { cfg: BUILDER_DESCRIBE, header: 'Tu pitch técnico:', label: 'Módulo 11 de 19 · Builder', title: 'Sprint: describe tu app en 90 segundos', sub: '3 decisiones que serán el núcleo de tu pitch.' },
  12: { cfg: BUILDER_AI, header: 'Tu feature con IA:', label: 'Módulo 12 de 19 · Builder', title: 'Conecta tu app a una IA', sub: '3 decisiones para integrar IA con sentido en tu app.' },
  16: { cfg: BUILDER_SURVEY, header: 'Tu encuesta de validación:', label: 'Módulo 16 de 19 · Builder', title: 'Feedback de usuarios: la encuesta de 3 preguntas', sub: 'Diseña la encuesta corta para tus primeros 10 usuarios.' },
};

const tagVariants = {
  intro: { box: { backgroundColor: P.violetBg }, text: { color: P.violetText } },
  theory: { box: { backgroundColor: P.greenSoft }, text: { color: P.greenText } },
  activity: { box: { backgroundColor: P.blueBg }, text: { color: P.blueText } },
  build: { box: { backgroundColor: P.violetBg }, text: { color: P.violetText } },
  case: { box: { backgroundColor: P.violetSoft }, text: { color: '#7e22ce' } },
  example: { box: { backgroundColor: '#fff7ed' }, text: { color: '#9a3412' } },
  quiz: { box: { backgroundColor: P.amberBg }, text: { color: P.amberText } },
  reflect: { box: { backgroundColor: '#f3f4f6' }, text: { color: '#374151' } },
} as const;
const Tag = ({ icon, label, variant }: { icon: string; label: string; variant: keyof typeof tagVariants }) => (
  <View style={[styles.tag, tagVariants[variant].box]}><Text style={[styles.tagText, tagVariants[variant].text]}>{icon}  {label}</Text></View>
);
const Title = ({ children }: { children: React.ReactNode }) => <Text style={styles.title}>{children}</Text>;
const Sub = ({ children }: { children: React.ReactNode }) => <Text style={styles.sub}>{children}</Text>;
const Body = ({ children }: { children: React.ReactNode }) => <Text style={styles.bodyText}>{children}</Text>;
const B = ({ children }: { children: React.ReactNode }) => <Text style={styles.bold}>{children}</Text>;

// ═══════════════════════════════════════════════════════════
export default function World5Level4() {
  const completeLevel = useGameStore((s) => s.completeLevel);

  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);
  const [xpToast, setXpToast] = useState<{ amount: number; id: number } | null>(null);
  const awarded = useRef<Set<number>>(new Set());

  const nocodeQ = useRef(pickN(NOCODE_POOL, 5).map(shuffleOpts)).current;
  const dbQ = useRef(pickN(DB_POOL, 5).map(shuffleOpts)).current;
  const moneyQ = useRef(pickN(MONEY_POOL, 5).map(shuffleOpts)).current;
  const publishQ = useRef(pickN(PUBLISH_POOL, 5).map(shuffleOpts)).current;
  const finalQ = useRef(pickN(FINAL_POOL, 5).map(shuffleOpts)).current;
  const tfQ = useRef(pickN(TF_POOL, 5)).current;
  const screenItems = useRef(pickN(SCREEN_POOL, 8)).current;
  const scnOrder = useRef(BTN_SCN.map((_, i) => i).sort(() => Math.random() - 0.5)).current;

  // Drag (3 categorías)
  const [dragPlaced, setDragPlaced] = useState<{ [k: number]: 'core' | 'auth' | 'settings' }>({});
  const [dragSel, setDragSel] = useState<number | null>(null);
  const [dragSolved, setDragSolved] = useState(false);
  const [dragFb, setDragFb] = useState<{ ok: boolean; msg: string } | null>(null);
  const [dragFlash, setDragFlash] = useState<Set<number>>(new Set());
  const dragAttempts = useRef(0);

  // Sort
  const [sortOrder, setSortOrder] = useState<number[]>([]);
  const [sortSolved, setSortSolved] = useState(false);
  const [sortFb, setSortFb] = useState<{ ok: boolean; msg: string } | null>(null);
  const [sortWrong, setSortWrong] = useState<Set<number>>(new Set());

  // Builder
  const [builderState, setBuilderState] = useState<{ [k: string]: string }>({});

  // Quiz
  const [quizAnswers, setQuizAnswers] = useState<{ [k: number]: number }>({});
  const [quizChecked, setQuizChecked] = useState(false);

  // TF
  const [tfAnswers, setTfAnswers] = useState<{ [k: number]: boolean }>({});
  const [tfChecked, setTfChecked] = useState(false);

  // Scenario
  const [scenarioSel, setScenarioSel] = useState<number | null>(null);
  const [scenarioChecked, setScenarioChecked] = useState(false);

  // Reflexión
  const [reflectText, setReflectText] = useState('');
  const [reflectFb, setReflectFb] = useState<string | null>(null);

  const [expandedEx, setExpandedEx] = useState<number | null>(null);

  const isTheory = THEORY_STEPS.has(step);
  const currentQuiz = step === 2 ? nocodeQ : step === 10 ? dbQ : step === 15 ? moneyQ : step === 17 ? publishQ : step === 19 ? finalQ : null;
  const currentBuilder = BUILDERS[step];
  const currentSort = step === 5 ? BUILD_SORT : step === 18 ? IMPROVE_SORT : null;
  const reflectMin = 150;

  useEffect(() => {
    setDragPlaced({}); setDragSel(null); setDragSolved(false); setDragFb(null); setDragFlash(new Set()); dragAttempts.current = 0;
    if (step === 5 || step === 18) setSortOrder(shuffledSort());
    setSortSolved(false); setSortFb(null); setSortWrong(new Set());
    setBuilderState({});
    setQuizAnswers({}); setQuizChecked(false);
    setTfAnswers({}); setTfChecked(false);
    setScenarioSel(null); setScenarioChecked(false);
    setReflectText(''); setReflectFb(null);
    setExpandedEx(null);
  }, [step]);

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

  // Drag
  const placeDrag = (zone: 'core' | 'auth' | 'settings') => { if (dragSel === null || dragSolved) return; setDragPlaced((prev) => ({ ...prev, [dragSel]: zone })); setDragSel(null); setDragFb(null); };
  const removeDrag = (idx: number) => { if (dragSolved) return; setDragPlaced((prev) => { const n = { ...prev }; delete n[idx]; return n; }); };
  const checkDrag = () => {
    const placedCount = Object.keys(dragPlaced).length;
    if (placedCount < screenItems.length) { setDragFb({ ok: false, msg: `Faltan ${screenItems.length - placedCount} tarjetas. Toca un chip y luego la columna.` }); return; }
    dragAttempts.current += 1;
    const wrong: number[] = []; let correct = 0;
    screenItems.forEach((it, i) => { if (dragPlaced[i] === it.correct) correct++; else wrong.push(i); });
    if (correct === screenItems.length) {
      setDragSolved(true);
      const earned = dragAttempts.current === 1 ? 20 : 10;
      awardOnce(earned);
      setDragFb({ ok: true, msg: `¡Genial! ${screenItems.length} correctas. +${earned} XP 🎉${dragAttempts.current === 1 ? ' (¡primer intento!)' : ''}` });
    } else {
      setDragPlaced((prev) => { const n = { ...prev }; wrong.forEach((i) => delete n[i]); return n; });
      setDragFlash(new Set(wrong));
      setTimeout(() => setDragFlash(new Set()), 700);
      setDragFb({ ok: false, msg: `${correct} de ${screenItems.length} correctas. Las incorrectas vuelven al banco.` });
    }
  };

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

  const builderComplete = (cfg: BuilderConfig) => cfg.rows.every((r) => builderState[r.key]);
  const checkQuiz = () => { if (!currentQuiz) return; setQuizChecked(true); let c = 0; currentQuiz.forEach((q, i) => { if (quizAnswers[i] === q.correct) c++; }); awardOnce(c * 8); };
  const checkTF = () => { setTfChecked(true); let c = 0; tfQ.forEach((it, i) => { if (tfAnswers[i] === it.correct) c++; }); awardOnce(c * 5); };
  const checkScenario = () => { if (scenarioSel === null) return; setScenarioChecked(true); if (BTN_SCN[scenarioSel].correct) awardOnce(12); };

  const sendReflection = (): boolean => {
    const t = reflectText.trim();
    if (t.length < reflectMin) { setReflectFb(`Escribe al menos ${reflectMin} caracteres (llevas ${t.length}).`); return false; }
    if (looksRandom(t)) { setReflectFb('Parece texto al azar. Escribe una idea real con tus propias palabras.'); return false; }
    if (!containsTopic(t)) { setReflectFb('Conéctalo con el tema: qué pieza de tu app construirías primero y por qué.'); return false; }
    setReflectFb(null); awardOnce(20); return true;
  };

  type Primary = { label: string; enabled: boolean; onPress: () => void; accent?: boolean };
  const advance = () => setStep((s) => s + 1);
  const getPrimary = (): Primary => {
    if (currentBuilder) return { label: 'Terminar →', enabled: builderComplete(currentBuilder.cfg), onPress: () => { awardOnce(currentBuilder.cfg.xp); advance(); } };
    if (currentSort) return sortSolved ? { label: 'Continuar →', enabled: true, onPress: advance } : { label: 'Verificar orden', enabled: true, onPress: checkSort, accent: true };
    if (currentQuiz) return quizChecked ? { label: 'Ver resultado →', enabled: true, onPress: advance } : { label: 'Comprobar respuestas', enabled: Object.keys(quizAnswers).length === currentQuiz.length, onPress: checkQuiz, accent: true };
    switch (step) {
      case 0: return { label: '¡Vamos! Empecemos 🚀', enabled: true, onPress: advance };
      case 1: return { label: 'Entendido, sigamos →', enabled: true, onPress: advance };
      case 3: case 4: case 14: return { label: 'Sigamos →', enabled: true, onPress: advance };
      case 7: return dragSolved
        ? { label: 'Continuar →', enabled: true, onPress: advance }
        : { label: 'Verificar clasificación', enabled: Object.keys(dragPlaced).length > 0, onPress: checkDrag, accent: true };
      case 9: return scenarioChecked
        ? { label: 'Continuar →', enabled: true, onPress: advance }
        : { label: 'Verificar elección', enabled: scenarioSel !== null, onPress: checkScenario, accent: true };
      case 13: return tfChecked
        ? { label: 'Continuar →', enabled: true, onPress: advance }
        : { label: 'Comprobar', enabled: Object.keys(tfAnswers).length === tfQ.length, onPress: checkTF, accent: true };
      case 20: return { label: 'Enviar reflexión →', enabled: reflectText.trim().length >= reflectMin, onPress: () => { if (sendReflection()) advance(); } };
      default: return { label: 'Continuar →', enabled: true, onPress: advance };
    }
  };

  const finishLevel = () => {
    const stars = xp >= 230 ? 3 : xp >= 145 ? 2 : 1; // máx real ~405 XP
    completeLevel(28, stars, xp);
    router.replace('/level/29');
  };

  // ── Sub-renders ──
  const renderExCard = (i: number, emoji: string, name: string, sub: string, how: React.ReactNode, fact: string) => {
    const open = expandedEx === i;
    return (
      <TouchableOpacity key={i} activeOpacity={0.9} style={[styles.exCard, open && styles.exCardOpen]} onPress={() => setExpandedEx(open ? null : i)}>
        <View style={styles.exHeader}>
          <View style={styles.exEmoji}><Text style={{ fontSize: 20 }}>{emoji}</Text></View>
          <View style={{ flex: 1 }}><Text style={styles.exName}>{name}</Text>{!!sub && <Text style={styles.exSub}>{sub}</Text>}</View>
          <Text style={styles.exArrow}>{open ? '↓' : '›'}</Text>
        </View>
        {open && <View style={styles.exBody}><Text style={styles.exHow}>{how}</Text><View style={styles.exFact}><Text style={styles.exFactText}>{fact}</Text></View></View>}
      </TouchableOpacity>
    );
  };

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
              <TouchableOpacity key={oi} disabled={quizChecked}
                style={[styles.qopt, sel && !quizChecked && styles.qoptSel, showOk && styles.qoptOk, showWrong && styles.qoptWrong]}
                onPress={() => setQuizAnswers((prev) => ({ ...prev, [qi]: oi }))}>
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

  const renderSort = (items: string[], label: string, mTitle: string, mSub: string) => (
    <View>
      <Tag icon="↕️" label={label} variant="activity" />
      <Title>{mTitle}</Title>
      <Sub>{mSub}</Sub>
      {sortOrder.map((itemIdx, pos) => {
        const [lab, ...rest] = items[itemIdx].split(':');
        return (
          <View key={pos} style={[styles.sortItem, sortWrong.has(pos) && styles.sortItemWrong, sortSolved && styles.sortItemOk]}>
            <View style={styles.sortNum}><Text style={styles.sortNumText}>{pos + 1}</Text></View>
            <Text style={styles.sortText}><B>{lab}:</B>{rest.join(':')}</Text>
            <View style={styles.sortArrows}>
              <TouchableOpacity disabled={pos === 0 || sortSolved} style={[styles.sortBtn, (pos === 0 || sortSolved) && styles.sortBtnOff]} onPress={() => moveSort(pos, -1)}><Text style={styles.sortBtnText}>▲</Text></TouchableOpacity>
              <TouchableOpacity disabled={pos === sortOrder.length - 1 || sortSolved} style={[styles.sortBtn, (pos === sortOrder.length - 1 || sortSolved) && styles.sortBtnOff]} onPress={() => moveSort(pos, 1)}><Text style={styles.sortBtnText}>▼</Text></TouchableOpacity>
            </View>
          </View>
        );
      })}
      {sortFb && <View style={[styles.fb, sortFb.ok ? styles.fbOk : styles.fbBad]}><Text style={sortFb.ok ? styles.fbOkText : styles.fbBadText}>{sortFb.msg}</Text></View>}
    </View>
  );

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
            <Text style={styles.codeKey}>{r.label.split('(')[0].split('·')[0].trim()}: </Text>
            {builderState[r.key] ? <Text style={styles.codeText}>{builderState[r.key]}</Text> : <Text style={styles.codeEmpty}>elige una opción</Text>}
          </Text>
        ))}
      </View>
    </View>
  );

  const renderContent = () => {
    if (currentBuilder) return (<View><Tag icon="🛠️" label={currentBuilder.label} variant="build" /><Title>{currentBuilder.title}</Title><Sub>{currentBuilder.sub}</Sub>{renderBuilder(currentBuilder.cfg, currentBuilder.header)}</View>);
    if (currentSort) {
      return step === 5
        ? renderSort(BUILD_SORT, 'Módulo 5 de 19 · Ordenar', 'Los 6 pasos para construir tu app', 'Ordena del 1 al 6 cómo se construye una app no-code de principio a fin.')
        : renderSort(IMPROVE_SORT, 'Módulo 18 de 19 · Ordenar', 'El ciclo de mejora continua', 'Lanzar una app es solo el inicio. Ordena los 6 pasos del ciclo Build-Measure-Learn.');
    }
    if (currentQuiz) {
      const q = ({ 2: ['Módulo 2 de 19 · Quiz', '¿Qué es no-code?', '5 preguntas sobre construir software sin programar.'], 10: ['Módulo 10 de 19 · Quiz', 'Base de datos: la memoria de tu app', '5 preguntas para entender cómo se guardan los datos.'], 15: ['Módulo 15 de 19 · Quiz', '¿Cómo se gana dinero con una app?', '5 modelos de monetización: cuál sirve para qué.'], 17: ['Módulo 17 de 19 · Quiz', '¿Dónde publico mi app?', '5 preguntas sobre PWA, App Store, Play Store y hosting.'], 19: ['Módulo 19 de 19 · Quiz', 'Quiz final · Diseña tu app', '5 preguntas avanzadas que integran todo lo aprendido.'] } as { [k: number]: string[] })[step];
      return renderQuiz(currentQuiz, q[0], q[1], q[2]);
    }
    switch (step) {
      case 0: return (
        <View>
          <View style={styles.introIcon}><Text style={{ fontSize: 34 }}>📱</Text></View>
          <Tag icon="✨" label="Nivel 28 · Mundo 5" variant="intro" />
          <Title>Diseña una App con IA — Sin Código</Title>
          <Sub>Las apps que usas las diseñó alguien. Ahora puedes ser ese alguien — sin escribir una línea de código.</Sub>
          <View style={[styles.card, styles.cardAccent]}><Text style={styles.cardTitle}>📚  Qué vas a aprender</Text><Text style={styles.cardText}>Las 4 herramientas no-code · Wireframe con palabras · Pantallas y flujos · Bases de datos · Conectar IA · Modelos de monetización · PWA y publicación</Text></View>
          <View style={[styles.card, styles.cardGreen]}><Text style={styles.cardTitle}>⚡  Qué podrás HACER al terminar</Text><Text style={styles.cardText}>Diseñar el plano completo de tu app: 3 pantallas + flujo + estilo + IA conectada + plan de monetización + ruta de publicación.</Text></View>
          <View style={[styles.card, styles.cardYellow]}><Text style={styles.cardTitle}>🎮  19 módulos · 45-60 min · hasta 230 XP</Text><Text style={styles.cardText}>📖 Teoría · 💻 No-code · 🛠️ Herramientas · 🌎 Apps reales · ↕️ Pasos · 📐 Wireframe · 🧩 Pantallas · 🎨 Estilo · ⚡ Botones · 📊 Base datos · 🤖 Conecta IA · ✅ V/F · 💰 Monetización · 📱 Publicar · 🔄 Mejora · ❓ Quiz final</Text></View>
        </View>
      );
      case 1: return (
        <View>
          <Tag icon="📖" label="Módulo 1 de 19 · Teoría" variant="theory" />
          <Title>De usuario a constructor: tu app empieza hoy</Title>
          <Body>Las apps que usas todos los días — Spotify, Instagram, WhatsApp, Rappi — alguien las diseñó. Eligió las pantallas, los colores, los botones, el flujo. <B>Y ese alguien hace 10 años necesitaba un equipo de programadores.</B> Hoy puedes hacerlo tú solo en una tarde.</Body>
          <View style={styles.highlightBox}><Text style={styles.highlightText}>💡 <B>El cambio histórico:</B>{'\n'}Una app móvil hace 5 años: 6 meses + $20K USD + equipo técnico.{'\n'}Una app móvil hoy: 1 fin de semana + $0 + tú con Lovable.</Text></View>
          <Body>Esto no significa que cualquier app sirva. Una buena app resuelve <B>un problema específico</B>, tiene un flujo claro, una identidad visual coherente y un modelo de monetización honesto. Vas a aprender a diseñar todo eso aquí.</Body>
          <Text style={styles.sectionTitle}>🛠️ Las 4 herramientas que vas a conocer</Text>
          {[['1', 'Lovable:', 'describe tu app y la IA la construye.'], ['2', 'Bolt:', 'similar a Lovable, más control técnico.'], ['3', 'Bubble:', 'editor visual potente para apps complejas.'], ['4', 'Framer:', 'webs hermosas con animaciones profesionales.']].map(([n, t, d]) => (
            <View key={n} style={styles.stepLi}><View style={styles.stepNum}><Text style={styles.stepNumText}>{n}</Text></View><Text style={styles.stepLiText}><B>{t}</B> {d}</Text></View>
          ))}
          <View style={styles.tipBox}><Text style={styles.tipText}>✅ <B>Mentalidad clave:</B> no vas a aprender a usar UNA herramienta. Vas a aprender a pensar como diseñador de apps: pantallas, flujos, datos, monetización. La herramienta es solo el lápiz.</Text></View>
        </View>
      );
      case 3: return (
        <View>
          <Tag icon="🛠️" label="Módulo 3 de 19 · Herramientas" variant="example" />
          <Title>Las 4 herramientas a conocer</Title>
          <Sub>Lovable, Bolt, Bubble, Framer: cuándo usar cada una. Toca cada tarjeta 👆</Sub>
          {renderExCard(0, '💜', 'Lovable · Describe tu app y aparece', 'Prompts → app funcional', <Text>Lovable funciona con <B>prompts en lenguaje natural</B>. Escribes 'una app de tracking de gastos con dashboard mensual' y construye una versión funcional en minutos. Ideal para MVPs.</Text>, '⭐ Conecta automáticamente con Supabase y permite deploy a Vercel en un click. La opción más rápida hoy.')}
          {renderExCard(1, '⚡', 'Bolt · Constructor instantáneo', 'Similar a Lovable, distinto enfoque', <Text>Bolt (de StackBlitz) compite con Lovable. Más enfocado en <B>desarrolladores</B> que también quieren velocidad. Mejor manejo del código generado y permite editarlo directamente.</Text>, '⭐ Si tienes base técnica, Bolt te da más control. Si solo quieres describir y obtener app, Lovable es más fluido.')}
          {renderExCard(2, '🔧', 'Bubble · Cuando quieres más control', 'Editor visual con lógica compleja', <Text>Bubble es low-code pesado: <B>editor visual con workflows, base de datos y lógica condicional</B>. Curva mayor, pero construye apps muy completas (marketplaces, plataformas SaaS).</Text>, '⭐ Si tu MVP necesita 20+ pantallas, roles y lógica compleja: Bubble. Si algo simple en 1 día: Lovable.')}
          {renderExCard(3, '🎨', 'Framer · Webs hermosas que se sienten apps', 'Landing y sitios con animaciones', <Text>Framer no construye apps con base de datos compleja, pero crea <B>experiencias web pulidísimas</B> con animaciones y diseño profesional. Ideal para la landing de tu app.</Text>, '⭐ Combina: Framer para la landing + Lovable/Bubble para la app real. Cada una hace bien su parte.')}
        </View>
      );
      case 4: return (
        <View>
          <Tag icon="🌎" label="Módulo 4 de 19 · Casos reales" variant="example" />
          <Title>Apps reales hechas con no-code</Title>
          <Sub>3 casos: de idea a usuarios reales sin programar. Toca cada tarjeta 👆</Sub>
          {renderExCard(0, '🎓', 'Flowdash · Estudiante construye un SaaS', 'De idea a $30K/mes con Bubble', <Text>Un estudiante empezó Flowdash con cero código, solo Bubble. <B>Validó con 5 usuarios pagos</B> antes de invertir en marketing. Hoy es una herramienta de operaciones que factura ~$30K USD/mes.</Text>, '⭐ Lección: empezar pequeño + validar con pagos reales antes de escalar. Bubble bastó para 6 cifras anuales.')}
          {renderExCard(1, '🇲🇽', 'Memorias · App para adultos mayores', 'Estudiante de 17 con Lovable', <Text>Sofía construyó <B>Memorias</B>, una app que ayuda a adultos mayores a guardar historias familiares con audio. Empezó como tarea escolar, validó con 3 abuelos del barrio, hoy tiene 200+ usuarios.</Text>, '⭐ Construida en 2 semanas que ya impacta vidas. Sin equipo técnico. Solo Lovable + Supabase.')}
          {renderExCard(2, '🏘️', 'Mi Barrio · Plataforma vecinal', 'Apps cívicas con no-code', <Text>Un colectivo creó <B>Mi Barrio</B> con Bubble: los vecinos reportan problemas (basura, alumbrado, ruido) y el municipio responde. 3 meses de construcción, sin programadores. Hoy en 4 barrios.</Text>, '⭐ El no-code está democratizando soluciones cívicas que antes requerían contratos millonarios.')}
        </View>
      );
      case 7: {
        const zones: { k: 'core' | 'auth' | 'settings'; label: string }[] = [
          { k: 'core', label: '🎯 Núcleo (acción principal)' },
          { k: 'auth', label: '🔐 Acceso / Onboarding' },
          { k: 'settings', label: '⚙️ Ajustes / Legal' },
        ];
        return (
          <View>
            <Tag icon="🧩" label="Módulo 7 de 19 · Clasificar" variant="activity" />
            <Title>Pantallas de tu app</Title>
            <Sub>Toda app tiene 3 tipos de pantalla. Clasifica cada una: toca un chip y luego su columna.</Sub>
            <View style={styles.chipsPool}>
              {screenItems.map((it, i) => dragPlaced[i] === undefined && (
                <TouchableOpacity key={i} disabled={dragSolved} style={[styles.chip, dragSel === i && styles.chipSel, dragFlash.has(i) && styles.chipFlash]} onPress={() => setDragSel(dragSel === i ? null : i)}>
                  <Text style={[styles.chipText, dragSel === i && { color: P.violetText }]}>{it.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {zones.map((z) => {
              const placedHere = Object.keys(dragPlaced).map(Number).filter((k) => dragPlaced[k] === z.k);
              const hasItem = placedHere.length > 0;
              const zStyle = z.k === 'core' ? styles.zoneCore : z.k === 'auth' ? styles.zoneAuth : styles.zoneSettings;
              const zColor = z.k === 'core' ? P.violetText : z.k === 'auth' ? P.amberText : P.slateText;
              return (
                <TouchableOpacity key={z.k} activeOpacity={0.9} disabled={dragSel === null || dragSolved} style={[styles.dropRow, hasItem && zStyle]} onPress={() => placeDrag(z.k)}>
                  <View style={[styles.dropHeader, zStyle]}><Text style={[styles.dropHeaderText, { color: zColor }]}>{z.label}</Text></View>
                  <View style={styles.dropArea}>
                    {placedHere.map((k) => (
                      <TouchableOpacity key={k} disabled={dragSolved} onPress={() => removeDrag(k)} style={[styles.dropChip, zStyle]}>
                        <Text style={[styles.dropChipText, { color: zColor }]}>{screenItems[k].text}  ✕</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </TouchableOpacity>
              );
            })}
            {dragFb && <View style={[styles.fb, dragFb.ok ? styles.fbOk : styles.fbBad]}><Text style={dragFb.ok ? styles.fbOkText : styles.fbBadText}>{dragFb.msg}</Text></View>}
          </View>
        );
      }
      case 9: return (
        <View>
          <Tag icon="🎯" label="Módulo 9 de 19 · Escenario" variant="case" />
          <Title>Los botones hacen cosas</Title>
          <View style={styles.scenarioBox}><Text style={styles.scenarioLabel}>🎬 LA SITUACIÓN</Text><Text style={styles.scenarioText}>Tu app tiene un botón principal: 'Subir foto y procesar'. ¿Cuál de estos comportamientos es correcto?</Text></View>
          <Sub><B>Elige la mejor opción</B></Sub>
          {scnOrder.map((idx, pos) => {
            const c = BTN_SCN[idx];
            const showOk = scenarioChecked && c.correct;
            const showWrong = scenarioChecked && scenarioSel === idx && !c.correct;
            return (
              <TouchableOpacity key={pos} disabled={scenarioChecked}
                style={[styles.scChoice, scenarioSel === idx && !scenarioChecked && styles.scChoiceSel, showOk && styles.scChoiceOk, showWrong && styles.scChoiceWrong]}
                onPress={() => setScenarioSel(idx)}>
                <Text style={styles.scTitle}>{c.title}</Text>
                <Text style={styles.scText}>{c.text}</Text>
              </TouchableOpacity>
            );
          })}
          {scenarioChecked && scenarioSel !== null && (
            <View style={[styles.fb, BTN_SCN[scenarioSel].correct ? styles.fbOk : styles.fbBad]}>
              <Text style={BTN_SCN[scenarioSel].correct ? styles.fbOkText : styles.fbBadText}>{BTN_SCN[scenarioSel].correct ? `✅ ¡Correcto! ${BTN_SCN[scenarioSel].explain}` : `❌ ${BTN_SCN[scenarioSel].explain}`}</Text>
            </View>
          )}
        </View>
      );
      case 13: return (
        <View>
          <Tag icon="✅" label="Módulo 13 de 19 · Verdadero o Falso" variant="activity" />
          <Title>Errores comunes de diseño de apps</Title>
          <Sub>5 afirmaciones sobre lo que SÍ y lo que NO funciona en UX.</Sub>
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
      case 14: return (
        <View>
          <Tag icon="🎓" label="Módulo 14 de 19 · Casos" variant="example" />
          <Title>Jóvenes que construyeron apps reales</Title>
          <Sub>3 casos: estudiantes que pasaron de usuarios a creadores con no-code. Toca cada tarjeta 👆</Sub>
          {renderExCard(0, '📚', 'Studyspace · De estudiantes para estudiantes', 'App de salas de estudio', <Text>Un grupo de estudiantes creó <B>Studyspace</B> con Lovable: app de salas de estudio compartidas. De idea en clase a 500 usuarios en 6 semanas. Sin programar.</Text>, '⭐ El patrón: detectar dolor cercano + construir rápido + iterar con compañeros como primeros usuarios.')}
          {renderExCard(1, '🇨🇴', 'Tarea Express · Adolescente colombiana', 'App de tutorías con IA', <Text>María, 16 años, Medellín. Construyó <B>Tarea Express</B>: WhatsApp + IA que ayuda a niños de primaria con tareas. Lo hizo con Lovable en 3 fines de semana. Hoy 60+ familias pagan suscripción.</Text>, '⭐ Modelo simple: ~$20.000 COP/mes por familia. María genera ingresos antes de cumplir 17.')}
          {renderExCard(2, '🌍', 'EcoBarrio · Reciclaje gamificado', 'Adolescentes resuelven un problema local', <Text>Tres estudiantes de Lima crearon <B>EcoBarrio</B>: app que gamifica el reciclaje en su barrio. Puntos, ranking, premios reales con tiendas locales. Bubble + Supabase. Lo usan 8 cuadras hoy.</Text>, '⭐ IA + impacto social es donde los adolescentes construyen cosas que muchos adultos no se atreven.')}
        </View>
      );
      case 20: return (
        <View>
          <Tag icon="✍️" label="Tu siguiente paso · +20 XP" variant="reflect" />
          <Title>Piensa tú</Title>
          <Sub>No hay respuesta correcta. Procesa lo aprendido con tus palabras.</Sub>
          <View style={[styles.card, styles.cardPurple]}><Text style={styles.cardTitle}>🤔  Tu pregunta</Text><Text style={styles.cardText}>Después de este nivel, tu app ya tiene plano. <Text style={styles.bold}>Si tuvieras que dedicar 4 horas el próximo fin de semana a construir SOLO un pedacito de tu app — el más importante — ¿qué construirías primero y por qué empezarías por ahí?</Text></Text></View>
          <TextInput style={styles.reflectArea} multiline value={reflectText} onChangeText={(t) => { setReflectText(t); if (reflectFb) setReflectFb(null); }} placeholder="Empezaría por... porque sin esa pieza la app no tiene sentido. En 4 horas construiría: 1)... 2)... 3)..." placeholderTextColor="#b8bcc0" />
          <Text style={styles.charCount}>{reflectText.trim().length} / {reflectMin} mínimo</Text>
          {reflectFb && <View style={[styles.fb, styles.fbBad]}><Text style={styles.fbBadText}>{reflectFb}</Text></View>}
        </View>
      );
      case 21: {
        const pct = Math.round((28 / 36) * 100);
        return (
          <View style={styles.completeContainer}>
            <View style={styles.completeBadge}><Text style={{ fontSize: 44 }}>📱</Text></View>
            <Text style={styles.completeTitle}>¡Nivel 28 completado!</Text>
            <Text style={styles.completeSub}>Terminaste "Diseña una App con IA — Sin Código". Ahora eres App Designer.</Text>
            <View style={styles.xpEarned}><Text style={styles.xpEarnedText}>⭐ {xp} XP ganados en este nivel</Text></View>
            <View style={styles.skillsList}>
              {['Conozco las 4 herramientas no-code clave: Lovable, Bolt, Bubble, Framer', 'Puedo describir mi app con palabras: pantallas + flujos + estilo', 'Sé qué es una base de datos y cómo se conecta a una app', 'Entiendo modelos de monetización: freemium, suscripción, ads', 'Tengo el plano completo de mi app: 3 pantallas + flujo + estilo + plan'].map((s, i) => (
                <View key={i} style={styles.skillRow}><Text style={styles.skillCheck}>✓</Text><Text style={styles.skillText}>{s}</Text></View>
              ))}
            </View>
            <View style={styles.nextHint}><Text style={styles.nextHintText}><B>Nivel 29: Comparte tu Creación</B>{'\n'}Ya tienes el plano de tu app. Ahora aprende a mostrarla al mundo: landing, redes, comunidad y primeros usuarios reales.</Text></View>
            <View style={styles.lvlBarWrap}>
              <Text style={styles.lvlBarLabel}>Nivel 28 de 36 completado · {pct}% del camino</Text>
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
  const progLabel = step === 0 ? 'Introducción' : step === 20 ? 'Reflexión final' : step < TOTAL_STEPS - 1 ? `Módulo ${step} de ${CONTENT_STEPS}` : '¡Nivel completado!';

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
  fill: { height: '100%', backgroundColor: P.violet, borderRadius: 4 },
  xpChip: { ...typography.bold, fontSize: 13, color: '#854d0e', backgroundColor: '#fde68a', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
  progLabel: { ...typography.regular, fontSize: 11, color: P.faint, textAlign: 'center', paddingTop: 6 },
  scrollContent: { padding: 16, paddingBottom: 30 },

  tag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginBottom: 12 },
  tagText: { fontSize: 11, fontWeight: '700' },

  introIcon: { width: 68, height: 68, borderRadius: 20, backgroundColor: P.violetBg, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  title: { ...typography.extraBold, fontSize: 20, color: P.ink, marginBottom: 8, lineHeight: 26 },
  sub: { ...typography.regular, fontSize: 13, color: P.muted, lineHeight: 20, marginBottom: 12 },
  bodyText: { ...typography.regular, fontSize: 13, color: P.body, lineHeight: 22, marginBottom: 12 },
  bold: { fontWeight: '700', color: P.ink },
  sectionTitle: { ...typography.bold, fontSize: 14, color: P.ink, marginTop: 10, marginBottom: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f0f0f0' },

  card: { backgroundColor: P.cardBg, borderRadius: 14, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: P.border },
  cardAccent: { backgroundColor: P.violetBg, borderColor: P.violetBorder },
  cardGreen: { backgroundColor: P.greenSoft, borderColor: P.greenBorder },
  cardYellow: { backgroundColor: '#fefce8', borderColor: P.amberBorder },
  cardPurple: { backgroundColor: P.violetSoft, borderColor: P.violetBorder },
  cardTitle: { ...typography.bold, fontSize: 13, color: P.ink, marginBottom: 4 },
  cardText: { ...typography.regular, fontSize: 13, color: P.body, lineHeight: 21 },

  highlightBox: { borderLeftWidth: 3, borderLeftColor: P.violet, backgroundColor: P.violetBg, borderRadius: 8, padding: 12, marginBottom: 12 },
  highlightText: { fontSize: 13, color: P.violetText, lineHeight: 21 },
  tipBox: { borderLeftWidth: 3, borderLeftColor: P.green, backgroundColor: P.greenSoft, borderRadius: 8, padding: 12, marginTop: 4 },
  tipText: { fontSize: 13, color: P.greenText, lineHeight: 21 },
  stepLi: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 9 },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: P.violet, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  stepLiText: { flex: 1, fontSize: 13, color: P.body, lineHeight: 20 },

  chipsPool: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, padding: 10, backgroundColor: P.cardBg, borderRadius: 14, borderWidth: 1, borderColor: P.border, marginBottom: 10, minHeight: 54 },
  chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#d1d5db', backgroundColor: '#fff' },
  chipSel: { borderColor: P.violet, backgroundColor: P.violetBg },
  chipFlash: { borderColor: '#fca5a5', backgroundColor: P.redBg },
  chipText: { fontSize: 12, color: P.body, lineHeight: 16 },
  dropRow: { borderRadius: 12, borderWidth: 2, borderColor: '#d1d5db', borderStyle: 'dashed', minHeight: 58, padding: 8, backgroundColor: '#fafafa', marginBottom: 8 },
  zoneCore: { borderStyle: 'solid', borderColor: P.violetBorder, backgroundColor: P.violetBg },
  zoneAuth: { borderStyle: 'solid', borderColor: P.amberBorder, backgroundColor: P.amberBg },
  zoneSettings: { borderStyle: 'solid', borderColor: P.slateBorder, backgroundColor: P.slateBg },
  dropHeader: { paddingVertical: 5, paddingHorizontal: 6, borderRadius: 7, marginBottom: 7, alignSelf: 'flex-start' },
  dropHeaderText: { fontSize: 11, fontWeight: '700' },
  dropArea: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  dropChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14 },
  dropChipText: { fontSize: 11, fontWeight: '500', lineHeight: 15 },

  sortItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: P.cardBg, borderRadius: 12, borderWidth: 1.5, borderColor: P.border, marginBottom: 7 },
  sortItemOk: { borderColor: '#86efac', backgroundColor: P.greenSoft },
  sortItemWrong: { borderColor: '#fca5a5', backgroundColor: P.redBg },
  sortNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: P.violet, alignItems: 'center', justifyContent: 'center' },
  sortNumText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  sortText: { flex: 1, fontSize: 12, color: P.body, lineHeight: 17 },
  sortArrows: { gap: 3 },
  sortBtn: { width: 30, height: 26, borderRadius: 7, borderWidth: 1, borderColor: P.border, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  sortBtnOff: { opacity: 0.25 },
  sortBtnText: { fontSize: 11, color: P.muted },

  builderWrap: { gap: 10 },
  builderRow: { backgroundColor: P.cardBg, borderWidth: 1, borderColor: P.border, borderRadius: 12, padding: 11 },
  builderLabel: { fontSize: 11, fontWeight: '700', color: P.violetText, marginBottom: 6, letterSpacing: 0.3, textTransform: 'uppercase' },
  builderOpts: { gap: 5 },
  builderOpt: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 9, borderWidth: 1.5, borderColor: P.border, backgroundColor: '#fff' },
  builderOptSel: { borderColor: P.violet, backgroundColor: P.violetBg },
  builderOptText: { fontSize: 12, color: P.body, fontWeight: '500', lineHeight: 16 },
  builderOptTextSel: { color: P.violetText, fontWeight: '700' },
  codeBox: { backgroundColor: P.codeBg, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#1e293b' },
  codeLine: { fontSize: 12, lineHeight: 20, marginBottom: 2 },
  codeText: { color: P.codeText, fontFamily: 'monospace' },
  codeKey: { color: P.codeKey, fontWeight: '700', fontFamily: 'monospace' },
  codeEmpty: { color: P.codeEmpty, fontStyle: 'italic', fontFamily: 'monospace' },

  quizQ: { ...typography.bold, fontSize: 13, color: P.ink, padding: 12, backgroundColor: P.cardBg, borderRadius: 10, borderWidth: 1, borderColor: P.border, marginBottom: 8, lineHeight: 19 },
  qopt: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 11, borderWidth: 1.5, borderColor: P.border, backgroundColor: '#fff', marginBottom: 7 },
  qoptSel: { borderColor: P.violet, backgroundColor: P.violetBg },
  qoptOk: { borderColor: P.green, backgroundColor: P.greenBg },
  qoptWrong: { borderColor: P.red, backgroundColor: P.redBg },
  qLetter: { width: 24, height: 24, borderRadius: 7, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: P.border, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  qLetterSel: { backgroundColor: P.violet, borderColor: P.violet },
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
  scChoiceSel: { borderColor: P.violet, backgroundColor: P.violetBg },
  scChoiceOk: { borderColor: P.green, backgroundColor: P.greenSoft },
  scChoiceWrong: { borderColor: P.red, backgroundColor: P.redBg },
  scTitle: { fontSize: 12, fontWeight: '700', color: P.ink, marginBottom: 4 },
  scText: { fontSize: 12, color: P.body, lineHeight: 17 },

  reflectArea: { minHeight: 120, padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: P.border, backgroundColor: '#fafafa', fontSize: 13, color: P.body, lineHeight: 22, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: P.faint, textAlign: 'right', marginTop: 4 },

  exCard: { borderRadius: 14, padding: 12, borderWidth: 1, borderColor: P.border, marginBottom: 8, backgroundColor: '#fff' },
  exCardOpen: { borderColor: P.violet, backgroundColor: P.violetBg },
  exHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exEmoji: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  exName: { fontSize: 13, fontWeight: '700', color: P.ink },
  exSub: { fontSize: 11, color: P.muted, marginTop: 1 },
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
  completeBadge: { width: 88, height: 88, borderRadius: 24, backgroundColor: P.violet, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
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
  lvlBarInner: { height: '100%', backgroundColor: P.violet, borderRadius: 4 },

  navRow: { flexDirection: 'row', gap: 8, padding: 14, borderTopWidth: 1, borderTopColor: '#f0f0f0', backgroundColor: '#fafafa' },
  backBtn: { paddingHorizontal: 16, paddingVertical: 13, borderRadius: 12, backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#e2e8f0', justifyContent: 'center' },
  backBtnText: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  primaryBtn: { backgroundColor: P.green, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
  primaryBtnAccent: { backgroundColor: P.violet },
  primaryBtnOff: { opacity: 0.35 },
  primaryBtnText: { ...typography.bold, color: '#fff', fontSize: 15 },
});
