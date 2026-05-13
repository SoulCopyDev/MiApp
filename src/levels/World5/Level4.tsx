import { router } from 'expo-router';
import React, { useState, useEffect, useRef, type SetStateAction } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, BackHandler,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useGameStore } from '../../store/gameStore';
import { colors, typography } from '../../theme';

// ---------- Tipos ----------
type DragItem = { text: string; correct: string };
type QuizItem = { q: string; opts: string[]; correct: number; explain: string };
type TFItem = { stmt: string; correct: boolean; explain: string };
type FillItem = { sentence: string; allOpts: string[]; correct: Record<string, number>; explain: string };
type ScenarioChoice = { title: string; text: string; correct: boolean; explain: string };
type BuilderRow = { key: string; label: string; opts: string[] };

const TOTAL_STEPS = 22; // 0:intro + 19 módulos + 1:reflexión + 1:complete
const CONTENT_STEPS = 19;

const pickN = <T,>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};

// ===================== POOLS =====================

const NOCODE_Q_POOL: QuizItem[] = [
  { q: '¿Qué significa "no-code"?', opts: ['Programar sin computador', 'Construir software sin escribir código, usando interfaces visuales', 'Apps sin internet', 'Apps que solo funcionan en el celular'], correct: 1, explain: 'No-code = construir con interfaces visuales (drag-and-drop, prompts, configuración) sin sintaxis de programación.' },
  { q: '¿Cuál NO es una herramienta no-code real?', opts: ['Lovable', 'Bubble', 'Bolt', 'Pythonex'], correct: 3, explain: 'Pythonex no existe. Lovable, Bubble y Bolt sí.' },
  { q: '¿Cuál es la mayor ventaja de no-code para alguien que está empezando?', opts: ['Las apps son más rápidas', 'Validar ideas en horas en lugar de meses', 'Cuestan menos batería', 'Tienen mejor diseño automáticamente'], correct: 1, explain: 'Velocidad de validación. Lo que antes tomaba 6 meses hoy se prototipa en 2 horas.' },
  { q: 'Limitación real de las herramientas no-code:', opts: ['No pueden conectarse a internet', 'A escala muy grande pueden ser más caras o lentas que código propio', 'No funcionan en móvil', 'Solo sirven en inglés'], correct: 1, explain: 'Para 100 usuarios: perfectas. Para 100 millones: probablemente migrarás a código nativo.' },
  { q: '¿Es "low-code" lo mismo que "no-code"?', opts: ['Sí, son sinónimos', 'No: low-code permite escribir algo de código cuando lo necesitas', 'Low-code es para principiantes', 'No-code es solo para móviles'], correct: 1, explain: 'Low-code = mayoría visual + algo de código. No-code = 100% visual.' },
];

const DB_Q_POOL: QuizItem[] = [
  { q: 'Una "tabla" en una base de datos es como:', opts: ['Un archivo Word', 'Una hoja de Excel con columnas y filas', 'Una imagen', 'Un email'], correct: 1, explain: 'Tabla = Excel con superpoderes. Cada fila = un registro; cada columna = un atributo.' },
  { q: 'Si tu app tiene usuarios, ¿qué tabla SIEMPRE necesitas?', opts: ['users', 'colors', 'buttons', 'videos'], correct: 0, explain: 'La tabla "users" guarda nombre, email, contraseña, fecha de registro. Es la base de cualquier app con cuenta.' },
  { q: '¿Qué es una "relación" entre tablas?', opts: ['Cuando dos apps se enamoran', 'Conexión entre registros (ej: este pedido pertenece a este usuario)', 'Un error', 'Una copia de seguridad'], correct: 1, explain: 'Relación = conexión lógica. Ej: tabla "pedidos" tiene columna user_id que apunta a tabla "users".' },
  { q: 'Supabase, Firebase y Airtable son:', opts: ['Editores de fotos', 'Bases de datos en la nube fáciles de conectar a apps no-code', 'Lenguajes de programación', 'Modelos de IA'], correct: 1, explain: 'Las 3 son backends-as-a-service: bases de datos + autenticación listas para conectar.' },
  { q: '¿Qué hace "autenticación" en una app?', opts: ['Verifica que el wifi funciona', 'Confirma quién es el usuario (login con email/Google)', 'Dibuja botones', 'Genera imágenes'], correct: 1, explain: 'Autenticación = quién eres. Autorización = qué puedes hacer.' },
  { q: 'Cuando un usuario crea una publicación, esa info:', opts: ['Se queda solo en su pantalla', 'Se guarda en la base de datos para que otros la vean', 'Se borra al cerrar la app', 'Se envía por email'], correct: 1, explain: 'Sin base de datos, nada persiste. La BD es la memoria de tu app.' },
];

const MONEY_Q_POOL: QuizItem[] = [
  { q: 'Modelo "freemium" significa:', opts: ['Todo gratis siempre', 'Lo básico gratis, funciones premium pagas', 'Solo paga la primera vez', 'Ads obligatorios'], correct: 1, explain: 'Freemium = Spotify, Duolingo, Notion. Atrae con gratis, monetiza al 5-10% que paga premium.' },
  { q: '¿Cuál es la mayor desventaja de monetizar con ads?', opts: ['Es ilegal', 'Necesitas MUCHOS usuarios para que funcione + degrada experiencia', 'Solo funciona en móvil', 'Los usuarios no la entienden'], correct: 1, explain: 'Ads pagan poco por usuario. Necesitas escala (10K+ usuarios) para ganar dinero real.' },
  { q: 'Suscripción mensual vs. pago único:', opts: ['Pago único siempre es mejor', 'Suscripción genera ingresos predecibles para mantener y mejorar la app', 'Son lo mismo', 'Solo Apple permite suscripciones'], correct: 1, explain: 'Suscripción = ingresos recurrentes para sostener desarrollo. Modelo dominante en SaaS.' },
  { q: 'Tu app vende productos físicos. Mejor modelo:', opts: ['Suscripción', 'Comisión por venta (% de cada transacción)', 'Ads', 'Pago único por descarga'], correct: 1, explain: 'Marketplace clásico: Mercado Libre, Amazon, Rappi. % por transacción alinea incentivos.' },
  { q: 'Lovable, Vercel y Supabase usan plan:', opts: ['Solo gratis', 'Solo pago', 'Freemium con escalado por uso', 'Ads'], correct: 2, explain: 'Tier gratuito generoso para empezar; pagas cuando creces. Modelo dominante en herramientas para developers.' },
];

const PUBLISH_Q_POOL: QuizItem[] = [
  { q: '¿Qué es una PWA?', opts: ['Un tipo de virus', 'Progressive Web App: web que se instala como app sin pasar por App Store', 'Lenguaje de programación', 'Marca de celular'], correct: 1, explain: 'PWA = web instalable en móvil. Sin aprobación de Apple/Google. Ideal para MVP.' },
  { q: 'Publicar en App Store cuesta:', opts: ['Es gratis', '$99 USD/año + proceso de aprobación', '$0 pero tarda 1 año', 'Solo para empresas'], correct: 1, explain: 'Apple Developer = $99 USD/año. Google Play = $25 USD una vez.' },
  { q: 'Tu MVP necesita probarse rápido. ¿Dónde publicas primero?', opts: ['App Store', 'Play Store', 'PWA en web (sin gatekeepers)', 'Microsoft Store'], correct: 2, explain: 'PWA web = lanzas en horas, iteras al instante. App stores para cuando tengas tracción.' },
  { q: 'Vercel, Netlify y Lovable hosting hacen:', opts: ['Crear logos', 'Publicar tu web/PWA con un dominio en minutos', 'Editar fotos', 'Vender productos'], correct: 1, explain: 'Hosting moderno: conectas tu repo, push y queda online en segundos.' },
  { q: '¿Por qué App Store rechaza apps a veces?', opts: ['Por tener emojis', 'Calidad insuficiente, copia descarada, contenido inapropiado, bugs evidentes', 'Por usar IA', 'Por tener menos de 10 pantallas'], correct: 1, explain: 'Razones típicas: app rota, plagio, privacidad mal manejada, contenido prohibido.' },
];

const FINAL_Q_POOL: QuizItem[] = [
  { q: 'El orden correcto para construir una app no-code:', opts: ['Diseñar logo → publicar → hacer wireframe', 'Wireframe → flujos → diseño → BD → publicar', 'Publicar → diseñar → vender', 'Solo importa que funcione'], correct: 1, explain: 'Wireframe → flujos → diseño visual → datos (BD) → deploy. En ese orden.' },
  { q: 'Lovable vs. Bubble: ¿cuándo usar Lovable?', opts: ['Para apps complejas con 20 roles', 'Para MVPs rápidos donde describes con prompts y la IA construye', 'Solo para juegos', 'Cuando no hay internet'], correct: 1, explain: 'Lovable = velocidad por prompt. Bubble = lógica visual potente para apps complejas.' },
  { q: 'El "ciclo de mejora" después de lanzar:', opts: ['Lanzar y olvidar', 'Lanzar → escuchar → analizar → mejorar → repetir', 'Solo arreglar bugs', 'Esperar a tener millones de usuarios'], correct: 1, explain: 'Build-Measure-Learn de Lean Startup. Tu primera versión es solo el comienzo.' },
  { q: 'Buen feedback de usuarios viene de:', opts: ['Encuestas de 50 preguntas', '3 preguntas concretas + observar comportamiento real', 'Solo de tu familia', 'Promedio de likes en redes'], correct: 1, explain: 'Pocas preguntas + observar uso real. Las acciones revelan más que las opiniones.' },
  { q: 'Antes de pagar publicidad para tu app, debes:', opts: ['Tener logo bonito', 'Validar que sin publicidad ya hay usuarios que la usan recurrentemente', 'Pagar Apple Developer', 'Tener 100 features'], correct: 1, explain: 'Si sin publicidad nadie repite, con publicidad solo quemas plata.' },
];

const TF_Q_POOL: TFItem[] = [
  { stmt: 'Mostrar 50 botones en la pantalla principal hace tu app más completa', correct: false, explain: 'Sobrecarga cognitiva. Apps exitosas tienen 1-3 acciones primarias visibles.' },
  { stmt: 'Cada pantalla debe tener UN objetivo principal claro', correct: true, explain: 'Una decisión por pantalla = experiencia clara. Múltiples objetivos = confusión.' },
  { stmt: 'El registro debe pedir todos los datos del usuario el primer día', correct: false, explain: 'Pide solo lo mínimo (email + clave). Resto: progresivamente cuando lo necesites.' },
  { stmt: 'Probar tu app con 5 usuarios reales puede revelar el 80% de los problemas de UX', correct: true, explain: 'Ley clásica de Nielsen: 5 testers detectan ~85% de los problemas de usabilidad.' },
  { stmt: 'Si la app es para móvil, también debe verse bien en desktop', correct: true, explain: 'Responsive es estándar. Lovable/Bolt lo hacen automático, pero verifícalo.' },
  { stmt: 'Cuando lanzas, todo debe estar perfecto antes de mostrarlo a alguien', correct: false, explain: 'Reid Hoffman: "si no te da vergüenza, lanzaste tarde".' },
  { stmt: 'Los colores y tipografía elegidos al azar funcionan igual de bien que un sistema de diseño', correct: false, explain: 'Inconsistencia visual confunde y resta credibilidad.' },
  { stmt: 'Cargar muy lento es una de las razones #1 por las que los usuarios abandonan apps', correct: true, explain: '3+ segundos = pierdes ~40% de usuarios. Performance es UX.' },
];

const FILL_POOL: FillItem[] = [
  { sentence: 'Construir software con interfaces visuales sin escribir código se llama _____.', allOpts: ['no-code', 'freelance', 'open-source', 'agile'], correct: { fb0: 0 }, explain: 'No-code: democratiza la creación de software. Lovable, Bubble, Bolt son sus exponentes.' },
  { sentence: 'Una web instalable como app que no pasa por App Store se llama _____.', allOpts: ['PWA', 'API', 'SDK', 'VPN'], correct: { fb0: 0 }, explain: 'PWA (Progressive Web App): instalable, con notificaciones, sin gatekeeper.' },
  { sentence: 'El modelo donde lo básico es gratis y las funciones premium son pagas se llama _____.', allOpts: ['freemium', 'ad-tech', 'shareware', 'trial'], correct: { fb0: 0 }, explain: 'Freemium: Spotify, Notion, Duolingo.' },
  { sentence: 'La capa de tu app que verifica quién es el usuario se llama _____.', allOpts: ['autenticación', 'diseño', 'marketing', 'localización'], correct: { fb0: 0 }, explain: 'Autenticación: login con email/Google/Apple.' },
  { sentence: 'El servicio que hospeda tu app y la entrega a usuarios en internet se llama _____.', allOpts: ['hosting', 'branding', 'lobby', 'asset'], correct: { fb0: 0 }, explain: 'Hosting: Vercel, Netlify, Lovable Cloud. Sin esto, tu app vive solo en tu computador.' },
];

const SCREEN_ITEMS: DragItem[] = [
  { text: 'Hero + propuesta de valor + botón principal', correct: 'core' },
  { text: 'Formulario de email + clave + "crear cuenta"', correct: 'auth' },
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
  { title: 'Al presionar "Subir foto" → abrir cámara o galería + procesar con IA + guardar resultado', text: 'El botón principal lleva al usuario a su acción central de valor en máximo 2 toques.', correct: true, explain: 'Correcto. Acción primaria visible, fricción mínima. Patrón de apps exitosas.' },
  { title: 'Al presionar "Subir foto" → mostrar pantalla con 12 opciones de configuración primero', text: 'Antes de usar la función, el usuario decide formato, calidad, privacidad, etiquetas.', correct: false, explain: 'Mal patrón. Configuración antes de uso = abandono. Mejor: defaults inteligentes.' },
  { title: 'Al presionar "Subir foto" → la app se cierra sola sin explicación', text: 'Bug clásico cuando faltan permisos de cámara y no se manejan errores.', correct: false, explain: 'Crítico. Toda app debe manejar permisos negados con mensaje claro.' },
  { title: 'Al presionar "Subir foto" → muestra modal con permiso explicando POR QUÉ se necesita', text: 'Antes de pedir permiso del sistema, la app explica el beneficio para el usuario.', correct: true, explain: 'Excelente. Explicar beneficio antes del permiso duplica la tasa de aceptación.' },
];

const BUILD_STEPS_SORT = [
  'Wireframe: dibuja las 3-5 pantallas principales en papel o Figma',
  'Flujos: qué hace cada botón y cómo se conectan las pantallas',
  'Prompt a la herramienta: describe la app a Lovable/Bolt',
  'Genera el primer borrador: la IA crea la estructura inicial',
  'Ajusta diseño y conecta base de datos: Supabase, autenticación, tablas',
  'Prueba con 3-5 usuarios reales y publica: deploy a Vercel/Netlify',
];

const IMPROVE_CYCLE_SORT = [
  'Lanzar: versión funcional aunque imperfecta a manos de usuarios reales',
  'Escuchar: entrevistas, soporte, comentarios, mensajes directos',
  'Analizar: identifica patrones — qué se queja MÁS de una persona',
  'Priorizar: alto impacto + bajo esfuerzo primero',
  'Mejorar: implementa el cambio en una nueva iteración corta',
  'Repetir: el ciclo nunca se detiene mientras la app exista',
];

const BUILDER_WIRE = {
  xp: 22,
  rows: [
    { key: 'p1', label: 'Pantalla 1 · Inicio (lo primero que ven)', opts: ['Hero con propuesta de valor + botón "Empezar"', 'Lista de últimos elementos (feed)', 'Login directo + "Crear cuenta"', 'Onboarding interactivo de 3 pasos'] },
    { key: 'p2', label: 'Pantalla 2 · Acción principal', opts: ['Formulario corto para crear contenido nuevo', 'Cámara/upload de archivos con IA procesando', 'Búsqueda + filtros', 'Chat con asistente IA'] },
    { key: 'p3', label: 'Pantalla 3 · Resultado / perfil', opts: ['Galería de creaciones del usuario', 'Resumen / dashboard con métricas', 'Detalle de un elemento + acciones', 'Perfil con historial y configuración'] },
  ],
};

const BUILDER_STYLE = {
  xp: 18,
  rows: [
    { key: 'paleta', label: 'Paleta de color', opts: ['Cálidos (naranja/amarillo/rojo) — energía', 'Fríos (azul/cyan/verde) — confianza', 'Neutros (negro/blanco) — minimalismo', 'Vibrantes (rosa/violeta) — creatividad'] },
    { key: 'tipo', label: 'Tipografía', opts: ['Sans-serif moderna (Inter, Manrope) — tech', 'Serif clásica (Lora, Playfair) — editorial', 'Mono (JetBrains Mono) — técnica', 'Display redonda (Quicksand) — amigable'] },
    { key: 'estilo', label: 'Estilo general', opts: ['Minimalista (mucho blanco, pocos elementos)', 'Bold (colores fuertes, tipografía grande)', 'Glassmorphism (transparencias y blur)', 'Skeumórfico (sombras y profundidad)'] },
  ],
};

const BUILDER_AI = {
  xp: 20,
  rows: [
    { key: 'input', label: 'Entrada del usuario', opts: ['Sube un PDF/documento', 'Escribe un texto libre', 'Toma una foto / sube imagen', 'Llena un formulario corto'] },
    { key: 'ia', label: 'Lo que hace la IA', opts: ['Resume en 5 puntos clave', 'Genera variaciones creativas', 'Clasifica/categoriza automáticamente', 'Traduce o reformula al estilo deseado', 'Crea pasos accionables a partir de la entrada'] },
    { key: 'output', label: 'Resultado en pantalla', opts: ['Tarjeta visual con resumen + botones', 'Lista descargable como PDF', 'Audio que se puede escuchar', 'Texto editable que el usuario puede ajustar'] },
  ],
};

const BUILDER_SURVEY = {
  xp: 18,
  rows: [
    { key: 'q1', label: 'Pregunta 1 (medir si lo necesitan)', opts: ['¿Qué tan decepcionado estarías si esta app dejara de existir?', '¿Cómo resolvías este problema antes de usar la app?', '¿Recomendarías la app a un amigo? (1-10)'] },
    { key: 'q2', label: 'Pregunta 2 (medir uso real)', opts: ['¿Cuántas veces la usaste esta semana?', '¿En qué momento del día la abres?', '¿Qué pantalla usaste más?'] },
    { key: 'q3', label: 'Pregunta 3 (descubrir qué falta)', opts: ['¿Qué función te gustaría que añadiéramos?', '¿Qué te frustró al usarla?', 'Si tuvieras que cambiar UNA cosa, ¿cuál sería?'] },
  ],
};

const BUILDER_DESCRIBE = {
  xp: 20,
  rows: [
    { key: 'que', label: '¿Qué hace tu app en una frase?', opts: ['Convierte PDFs en resúmenes con IA', 'Conecta tutores y estudiantes por WhatsApp', 'Gamifica el reciclaje en tu barrio', 'Ayuda a adultos mayores a pagar servicios online', 'Genera plan de estudio personalizado con IA'] },
    { key: 'para', label: '¿Para quién es?', opts: ['Estudiantes 12-17', 'Adultos mayores 60+', 'Emprendedores pequeños', 'Familias con niños', 'Profesionales 25-40'] },
    { key: 'diff', label: '¿Por qué la elegirían?', opts: ['Es 10x más rápida', 'No requiere conocimiento técnico previo', 'Es la única en español de LATAM con IA real', 'Cuesta menos que la mitad de la competencia', 'Es la primera diseñada con la comunidad como aliada'] },
  ],
};

// ===================== COMPONENTE =====================
interface LevelProps {
  navigation?: any;
  setAllowBack?: (allow: boolean) => void;
}

export default function World5Level4({ navigation: propsNavigation, setAllowBack }: LevelProps) {
  const nav = useNavigation();
  const navigation = propsNavigation || nav;
  const completeLevel = useGameStore((s) => s.completeLevel);

  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);

  // Pools
  const [nocodeQItems] = useState(() => pickN(NOCODE_Q_POOL, 5));
  const [dbQItems] = useState(() => pickN(DB_Q_POOL, 5));
  const [moneyQItems] = useState(() => pickN(MONEY_Q_POOL, 5));
  const [publishQItems] = useState(() => pickN(PUBLISH_Q_POOL, 5));
  const [finalQItems] = useState(() => pickN(FINAL_Q_POOL, 5));
  const [tfItems] = useState(() => pickN(TF_Q_POOL, 5));
  const [fillItem] = useState(() => pickN(FILL_POOL, 1)[0]);
  const [screenItems] = useState(() => pickN(SCREEN_ITEMS, 8));

  // Estados
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizChecked, setQuizChecked] = useState(false);
  const [tfAnswers, setTfAnswers] = useState<Record<number, boolean>>({});
  const [tfChecked, setTfChecked] = useState(false);
  const [fillSel, setFillSel] = useState<number | null>(null);
  const [fillChecked, setFillChecked] = useState(false);
  const [scenarioSel, setScenarioSel] = useState<number | null>(null);
  const [scenarioDone, setScenarioDone] = useState(false);
  const [dragPlaced, setDragPlaced] = useState<Record<number, string>>({});
  const [dragSel, setDragSel] = useState<number | null>(null);
  const [dragAttempts, setDragAttempts] = useState(0);
  const [dragOk, setDragOk] = useState(false);
  const [sortOrder5, setSortOrder5] = useState<number[]>([]);
  const [sortOk5, setSortOk5] = useState(false);
  const [sortOrder18, setSortOrder18] = useState<number[]>([]);
  const [sortOk18, setSortOk18] = useState(false);
  const [builderWire, setBuilderWire] = useState<Record<string, string>>({});
  const [builderStyle, setBuilderStyle] = useState<Record<string, string>>({});
  const [builderDescribe, setBuilderDescribe] = useState<Record<string, string>>({});
  const [builderAi, setBuilderAi] = useState<Record<string, string>>({});
  const [builderSurvey, setBuilderSurvey] = useState<Record<string, string>>({});
  const [reflectVal, setReflectVal] = useState('');

  const examSteps = new Set([2, 5, 7, 9, 10, 13, 15, 17, 18, 19]);
  const isExam = examSteps.has(step);
  useEffect(() => { setAllowBack?.(!isExam); }, [isExam, setAllowBack]);
  useEffect(() => {
    const bh = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isExam) { Alert.alert('Actividad en curso', 'No puedes regresar ahora.'); return true; }
      return false;
    });
    return () => bh.remove();
  }, [isExam]);

  useEffect(() => {
    if (step === 5) { const o = [0, 1, 2, 3, 4, 5].sort(() => Math.random() - 0.5); setSortOrder5(o); setSortOk5(false); }
    if (step === 7) { setDragPlaced({}); setDragSel(null); setDragAttempts(0); setDragOk(false); }
    if (step === 9) { setScenarioSel(null); setScenarioDone(false); }
    if (step === 13) { setTfAnswers({}); setTfChecked(false); }
    if (step === 18) { const o = [0, 1, 2, 3, 4, 5].sort(() => Math.random() - 0.5); setSortOrder18(o); setSortOk18(false); }
  }, [step]);

  const addXP = (n: number) => setXp((p) => p + n);
  const goNext = () => { if (step < TOTAL_STEPS - 1) setStep(step + 1); };
  const handleClose = () => Alert.alert('Salir', '¿Seguro?', [{ text: 'Cancelar' }, { text: 'Salir', onPress: () => router.back() }]);
  const handleFinish = () => {
    let stars = 0;
    if (xp >= 180) stars = 3; else if (xp >= 120) stars = 2; else if (xp >= 60) stars = 1;
    completeLevel(5, 4, stars, xp);
    router.back();
  };

  // Quiz genérico
  const selQuiz = (qi: number, oi: number) => { if (!quizChecked) setQuizAnswers((p) => ({ ...p, [qi]: oi })); };
  const checkQuizGen = (items: QuizItem[]) => {
    if (quizChecked) return true;
    if (Object.keys(quizAnswers).length < items.length) { Alert.alert('Incompleto'); return false; }
    setQuizChecked(true);
    let c = 0;
    items.forEach((q, i) => { if (quizAnswers[i] === q.correct) c++; });
    addXP(c * 8);
    Alert.alert(`${c}/${items.length} correctas`, `+${c * 8} XP`, [{ text: 'OK', onPress: goNext }]);
    return false;
  };

  // TF
  const selTF = (qi: number, v: boolean) => { if (!tfChecked) setTfAnswers((p) => ({ ...p, [qi]: v })); };
  const checkTF = () => {
    if (tfChecked) return true;
    if (Object.keys(tfAnswers).length < tfItems.length) { Alert.alert('Incompleto'); return false; }
    setTfChecked(true);
    let c = 0;
    tfItems.forEach((q, i) => { if (tfAnswers[i] === q.correct) c++; });
    addXP(c * 5);
    Alert.alert(`${c}/${tfItems.length} correctas`, `+${c * 5} XP`, [{ text: 'OK', onPress: goNext }]);
    return false;
  };

  // Fill
  const selFill = (i: number) => { if (!fillChecked) setFillSel(i); };
  const checkFill = () => {
    if (fillChecked) return true;
    if (fillSel === null) { Alert.alert('Elige una opción'); return false; }
    setFillChecked(true);
    if (fillSel === fillItem.correct.fb0) addXP(10);
    Alert.alert(fillSel === fillItem.correct.fb0 ? '✅ +10 XP' : '❌', fillItem.explain);
    return false;
  };

  // Scenario
  const selScenario = (i: number) => { if (!scenarioDone) setScenarioSel(i); };
  const checkScenario = () => {
    if (scenarioDone) return true;
    if (scenarioSel === null) { Alert.alert('Elige una opción'); return false; }
    setScenarioDone(true);
    const correctIdx = BTN_SCN.findIndex((c) => c.correct);
    if (scenarioSel === correctIdx) addXP(12);
    Alert.alert(scenarioSel === correctIdx ? '✅ +12 XP' : '❌', BTN_SCN[correctIdx].explain);
    return false;
  };

  // Drag
  const dropDrag = (idx: number, col: string) => { setDragPlaced((p) => ({ ...p, [idx]: col })); setDragSel(null); };
  const retDrag = (idx: number) => { setDragPlaced((p) => { const n = { ...p }; delete n[idx]; return n; }); };
  const checkDrag = () => {
    if (dragOk) return true;
    if (Object.keys(dragPlaced).length < screenItems.length) { Alert.alert('Faltan'); return false; }
    setDragAttempts((p) => p + 1);
    let c = 0; const wrong: number[] = [];
    Object.entries(dragPlaced).forEach(([k, v]) => { const i = parseInt(k); if (v === screenItems[i].correct) c++; else wrong.push(i); });
    if (c === screenItems.length) { setDragOk(true); addXP(dragAttempts === 0 ? 20 : 10); Alert.alert('¡Genial!', `+${dragAttempts === 0 ? 20 : 10} XP`, [{ text: 'OK', onPress: goNext }]); return false; }
    Alert.alert('Revisa', `${c}/${screenItems.length} correctas.`);
    const np = { ...dragPlaced }; wrong.forEach((i) => delete np[i]); setDragPlaced(np);
    return false;
  };

  // Sort
  const moveSort = (pos: number, dir: number, order: number[], setter: (v: number[]) => void) => {
    const np = pos + dir; if (np < 0 || np >= order.length) return;
    const no = [...order]; [no[pos], no[np]] = [no[np], no[pos]]; setter(no);
  };
  const checkSortGen = (order: number[], ok: boolean, setOk: (v: boolean) => void, label: string) => {
    if (ok) return true;
    if (order.every((v, i) => v === i)) { setOk(true); addXP(15); Alert.alert('¡Perfecto!', '+15 XP', [{ text: 'OK', onPress: goNext }]); return false; }
    Alert.alert('Incorrecto', 'Algunos pasos fuera de lugar.'); return false;
  };

  // Builder genérico
  const selBuilder = (key: string, val: string, setter: (next: SetStateAction<Record<string, string>>) => void, cfg: { xp: number; rows: BuilderRow[] }) => {
    setter((p) => ({ ...p, [key]: val }));
  };
  const checkBuilder = (state: Record<string, string>, cfg: { xp: number; rows: BuilderRow[] }) => {
    if (Object.keys(state).length < cfg.rows.length) { Alert.alert('Completa todas las filas'); return false; }
    addXP(cfg.xp);
    return true;
  };

  // Reflexión
  const checkReflect = () => {
    if (reflectVal.trim().length >= 150) { addXP(20); return true; }
    Alert.alert('Mínimo 150 caracteres');
    return false;
  };

  // ============ RENDER ============
  const renderIntro = () => (
    <View>
      <View style={styles.iconCircle}><Text style={{ fontSize: 34 }}>📱</Text></View>
      <Text style={styles.title}>Diseña una App con IA — Sin Código</Text>
      <Text style={styles.subtitle}>Las apps que usas las diseñó alguien. Ahora puedes ser ese alguien — sin escribir una línea de código.</Text>
      <View style={styles.card}><Text style={styles.cardTitle}>📚 Qué vas a aprender</Text><Text style={styles.cardText}>Las 4 herramientas no-code · Wireframe con palabras · Pantallas y flujos · Bases de datos · Conectar IA · Modelos de monetización · PWA y publicación.</Text></View>
      <View style={styles.card}><Text style={styles.cardTitle}>⚡ Qué podrás HACER</Text><Text style={styles.cardText}>Diseñar el plano completo de tu propia app: 3 pantallas + flujo + estilo + IA conectada + plan de monetización + ruta de publicación.</Text></View>
    </View>
  );

  const renderTheory1 = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#faf5ff' }]}><Text style={[styles.tagText, { color: '#5b21b6' }]}>📖 Módulo 1 · Teoría</Text></View>
      <Text style={styles.title}>De usuario a constructor: tu app empieza hoy</Text>
      <Text style={styles.bodyText}>Las apps que usas todos los días alguien las diseñó. Hoy puedes hacerlo tú solo en una tarde.</Text>
      <View style={styles.highlight}><Text style={styles.highlightText}><Text style={{ fontWeight: 'bold' }}>💡 El cambio histórico:</Text> Antes: 6 meses + $20K + equipo. Hoy: 1 fin de semana + $0 + tú con Lovable.</Text></View>
      <View style={styles.card}><Text style={styles.cardTitle}>🛠️ Las 4 herramientas</Text><Text style={styles.cardText}>Lovable: describe tu app y la IA la construye. Bolt: más control técnico. Bubble: editor visual potente. Framer: webs hermosas con animaciones.</Text></View>
    </View>
  );

  const renderQuiz = (items: QuizItem[], tag: string) => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fef3c7' }]}><Text style={[styles.tagText, { color: '#92400e' }]}>{tag}</Text></View>
      {items.map((q, qi) => (
        <View key={qi} style={{ marginBottom: 14 }}>
          <Text style={styles.quizQ}>{qi + 1}. {q.q}</Text>
          {q.opts.map((opt, oi) => (
            <TouchableOpacity key={oi} style={[styles.quizOpt, quizAnswers[qi] === oi && { borderColor: '#7c3aed', backgroundColor: '#faf5ff' }]} onPress={() => selQuiz(qi, oi)} disabled={quizChecked}>
              <Text style={styles.quizLetter}>{String.fromCharCode(65 + oi)}</Text>
              <Text style={{ flex: 1, fontSize: 12 }}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );

  const renderExpandCards = (cards: { emoji: string; title: string; sub: string; body: string; fact: string }[], tag: string) => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fff7ed' }]}><Text style={[styles.tagText, { color: '#9a3412' }]}>{tag}</Text></View>
      {cards.map((c, i) => (
        <View key={i} style={styles.card}>
          <Text style={styles.cardTitle}>{c.emoji} {c.title}</Text>
          <Text style={styles.cardText}>{c.sub}</Text>
          <Text style={[styles.cardText, { marginTop: 4 }]}>{c.body}</Text>
          <View style={[styles.highlight, { backgroundColor: '#fffbeb', borderLeftColor: '#f59e0b', marginTop: 6 }]}>
            <Text style={{ color: '#92400e', fontSize: 11 }}>{c.fact}</Text>
          </View>
        </View>
      ))}
    </View>
  );

  const renderSort = (items: string[], order: number[], ok: boolean, onMove: (pos: number, dir: number) => void, tag: string) => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#f5f3ff' }]}><Text style={[styles.tagText, { color: '#5b21b6' }]}>{tag}</Text></View>
      <Text style={styles.title}>Ordena los pasos</Text>
      {order.map((stepIdx, pos) => (
        <View key={pos} style={styles.sortItem}>
          <Text style={styles.sortNum}>{pos + 1}</Text>
          <Text style={styles.sortText}>{items[stepIdx]}</Text>
          <View style={styles.sortArrows}>
            <TouchableOpacity style={styles.sortBtn} onPress={() => onMove(pos, -1)} disabled={pos === 0}><MaterialIcons name="keyboard-arrow-up" size={18} /></TouchableOpacity>
            <TouchableOpacity style={styles.sortBtn} onPress={() => onMove(pos, 1)} disabled={pos === order.length - 1}><MaterialIcons name="keyboard-arrow-down" size={18} /></TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );

  const renderBuilder = (state: Record<string, string>, cfg: { xp: number; rows: BuilderRow[] }, setter: (next: SetStateAction<Record<string, string>>) => void, tag: string, title: string) => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#faf5ff' }]}><Text style={[styles.tagText, { color: '#5b21b6' }]}>{tag}</Text></View>
      <Text style={styles.title}>{title}</Text>
      {cfg.rows.map((row) => (
        <View key={row.key} style={{ marginBottom: 10 }}>
          <Text style={{ fontWeight: 'bold', color: '#5b21b6', marginBottom: 4 }}>{row.label}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
            {row.opts.map((opt) => (
              <TouchableOpacity key={opt} style={[styles.flowOpt, state[row.key] === opt && { borderColor: '#7c3aed', backgroundColor: '#faf5ff' }]} onPress={() => selBuilder(row.key, opt, setter, cfg)}>
                <Text style={{ fontSize: 11 }}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
    </View>
  );

  const renderDrag = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#eff6ff' }]}><Text style={[styles.tagText, { color: '#1e40af' }]}>🧩 Módulo 7 · Clasificar</Text></View>
      <Text style={styles.title}>Pantallas de tu app</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {screenItems.map((item, idx) => (
          dragPlaced[idx] === undefined && (
            <TouchableOpacity key={idx} style={[styles.chip, dragSel === idx && { borderColor: '#7c3aed', backgroundColor: '#faf5ff' }]} onPress={() => setDragSel(dragSel === idx ? null : idx)}>
              <Text style={{ fontSize: 11 }}>{item.text}</Text>
            </TouchableOpacity>
          )
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['core', 'auth'] as const).map((col) => (
          <TouchableOpacity key={col} style={[styles.dropCol, { flex: 1 }]} onPress={() => { if (dragSel !== null) dropDrag(dragSel, col); }}>
            <Text style={{ fontWeight: 'bold', fontSize: 11, color: col === 'core' ? '#5b21b6' : '#92400e' }}>{col === 'core' ? '🎯 Núcleo' : '🔐 Acceso'}</Text>
            {Object.entries(dragPlaced).filter(([, v]) => v === col).map(([k]) => (
              <TouchableOpacity key={k} style={{ backgroundColor: col === 'core' ? '#e9d5ff' : '#fef3c7', padding: 4, borderRadius: 8, marginTop: 4 }} onPress={() => retDrag(parseInt(k))}>
                <Text style={{ fontSize: 10 }}>{screenItems[parseInt(k)].text} ✕</Text>
              </TouchableOpacity>
            ))}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderScenarioComp = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fdf4ff' }]}><Text style={[styles.tagText, { color: '#7e22ce' }]}>🎯 Módulo 9 · Escenario</Text></View>
      <Text style={styles.title}>Los botones hacen cosas</Text>
      {BTN_SCN.map((c, i) => (
        <TouchableOpacity key={i} style={[styles.optionBtn, scenarioSel === i && { borderColor: '#7c3aed', backgroundColor: '#faf5ff' }]} onPress={() => selScenario(i)} disabled={scenarioDone}>
          <Text style={{ fontWeight: 'bold', fontSize: 12 }}>{c.title}</Text>
          <Text style={{ fontSize: 11, color: '#6b7280' }}>{c.text}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderTF = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fef3c7' }]}><Text style={[styles.tagText, { color: '#92400e' }]}>✅ Módulo 13 · V/F</Text></View>
      <Text style={styles.title}>Errores comunes de diseño de apps</Text>
      {tfItems.map((item, idx) => (
        <View key={idx} style={{ marginBottom: 14 }}>
          <Text style={styles.tfQuestion}>{idx + 1}. {item.stmt}</Text>
          <View style={{ flexDirection: 'row', gap: 7 }}>
            <TouchableOpacity style={[styles.tfBtn, tfAnswers[idx] === true && { borderColor: '#16a34a', backgroundColor: '#f0fdf4' }]} onPress={() => selTF(idx, true)} disabled={tfChecked}><Text>✅ V</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.tfBtn, tfAnswers[idx] === false && { borderColor: '#dc2626', backgroundColor: '#fef2f2' }]} onPress={() => selTF(idx, false)} disabled={tfChecked}><Text>❌ F</Text></TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );

  const renderReflect = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#f3f4f6' }]}><Text style={[styles.tagText, { color: '#374151' }]}>✍️ Tu siguiente paso · +20 XP</Text></View>
      <Text style={styles.title}>Piensa tú</Text>
      <View style={[styles.card, { backgroundColor: '#faf5ff' }]}>
        <Text style={styles.cardTitle}>🤔 Tu pregunta</Text>
        <Text style={styles.cardText}>Si tuvieras que dedicar 4 horas el próximo fin de semana a construir SOLO un pedacito de tu app — el más importante de todos — ¿qué construirías primero y por qué empezarías por ahí?</Text>
      </View>
      <TextInput style={styles.textArea} multiline placeholder="Empezaría por..." value={reflectVal} onChangeText={setReflectVal} />
      <Text style={{ fontSize: 11, color: '#9ca3af', textAlign: 'right' }}>{reflectVal.length} / 150 mínimo</Text>
    </View>
  );

  const renderCompletion = () => (
    <View style={{ alignItems: 'center', padding: 20 }}>
      <Text style={{ fontSize: 56 }}>📱</Text>
      <Text style={[styles.title, { textAlign: 'center' }]}>¡Nivel 28 completado!</Text>
      <Text style={[styles.subtitle, { textAlign: 'center' }]}>Terminaste "Diseña una App con IA — Sin Código". Ahora eres App Designer.</Text>
      <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#7c3aed', marginVertical: 12 }}>⭐ {xp} XP</Text>
      <TouchableOpacity style={styles.finishBtn} onPress={handleFinish}><Text style={{ color: '#fff', fontWeight: 'bold' }}>Volver al mapa</Text></TouchableOpacity>
    </View>
  );

  // ============ RENDER PRINCIPAL ============
  const renderStep = () => {
    switch (step) {
      case 0: return renderIntro();
      case 1: return renderTheory1();
      case 2: return renderQuiz(nocodeQItems, '❓ Módulo 2 · Quiz no-code');
      case 3: return renderExpandCards([
        { emoji: '💜', title: 'Lovable', sub: 'Describe tu app y aparece', body: 'Funciona con prompts en lenguaje natural. Ideal para MVPs y prototipos rápidos.', fact: 'Conecta con Supabase y deploy a Vercel en un click.' },
        { emoji: '⚡', title: 'Bolt', sub: 'Constructor instantáneo', body: 'Similar a Lovable, más enfocado en desarrolladores.', fact: 'Mejor manejo de código generado.' },
        { emoji: '🔧', title: 'Bubble', sub: 'Editor visual con lógica compleja', body: 'Para apps muy completas con workflows y base de datos.', fact: 'Curva de aprendizaje mayor pero muy potente.' },
        { emoji: '🎨', title: 'Framer', sub: 'Webs hermosas', body: 'Experiencias web pulidísimas con animaciones profesionales.', fact: 'Ideal para landing de tu app + Lovable para la app real.' },
      ], '🛠️ Módulo 3 · Herramientas');
      case 4: return renderExpandCards([
        { emoji: '🎓', title: 'Flowdash', sub: 'De idea a $30K mensuales con Bubble', body: 'Pranjal empezó siendo estudiante con cero código.', fact: 'Validó con 5 usuarios pagos antes de invertir en marketing.' },
        { emoji: '🇲🇽', title: 'Memorias', sub: 'App de adultos mayores en LATAM', body: 'Sofía, 17 años, construyó con Lovable. 200+ usuarios reales.', fact: 'Caso real: 2 semanas de construcción, sin equipo técnico.' },
        { emoji: '🏘️', title: 'Mi Barrio', sub: 'Plataforma vecinal', body: 'Colectivo en Buenos Aires creó con Bubble. Vecinos reportan problemas, municipio responde.', fact: 'Sin programadores. Hoy lo usan en 4 barrios.' },
      ], '🇱🇦 Módulo 4 · Casos reales');
      case 5: return renderSort(BUILD_STEPS_SORT, sortOrder5, sortOk5, (pos, dir) => moveSort(pos, dir, sortOrder5, setSortOrder5), '↕️ Módulo 5 · Ordenar');
      case 6: return renderBuilder(builderWire, BUILDER_WIRE, setBuilderWire, '🛠️ Módulo 6 · Builder', 'Wireframe con palabras: tus 3 pantallas');
      case 7: return renderDrag();
      case 8: return renderBuilder(builderStyle, BUILDER_STYLE, setBuilderStyle, '🛠️ Módulo 8 · Builder', 'Colores, tipografía y estilo');
      case 9: return renderScenarioComp();
      case 10: return renderQuiz(dbQItems, '❓ Módulo 10 · Quiz BD');
      case 11: return renderBuilder(builderDescribe, BUILDER_DESCRIBE, setBuilderDescribe, '🛠️ Módulo 11 · Builder', 'Describe tu app en 3 decisiones');
      case 12: return renderBuilder(builderAi, BUILDER_AI, setBuilderAi, '🛠️ Módulo 12 · Builder', 'Conecta tu app a una IA');
      case 13: return renderTF();
      case 14: return renderExpandCards([
        { emoji: '📚', title: 'Stanford Studyspace', sub: '500 usuarios en 6 semanas', body: 'Estudiantes crearon app de salas de estudio con Lovable.', fact: 'Detectar dolor cercano + construir rápido + iterar con compañeros.' },
        { emoji: '🇨🇴', title: 'Tarea Express', sub: 'App de tutorías con IA', body: 'María, 16 años, Medellín. Lovable en 3 fines de semana. 60+ familias pagan suscripción.', fact: '$20.000 COP/mes por familia. Genera ingresos antes de cumplir 17.' },
        { emoji: '🌍', title: 'EcoBarrio', sub: 'Reciclaje gamificado', body: 'Tres estudiantes de Lima. Puntos, ranking, premios con tiendas locales.', fact: 'IA + impacto social: adolescentes construyendo lo que adultos no se atreven.' },
      ], '👨‍🎓 Módulo 14 · Casos jóvenes');
      case 15: return renderQuiz(moneyQItems, '❓ Módulo 15 · Quiz monetización');
      case 16: return renderBuilder(builderSurvey, BUILDER_SURVEY, setBuilderSurvey, '🛠️ Módulo 16 · Builder', 'Feedback de usuarios: la encuesta de 3 preguntas');
      case 17: return renderQuiz(publishQItems, '❓ Módulo 17 · Quiz publicación');
      case 18: return renderSort(IMPROVE_CYCLE_SORT, sortOrder18, sortOk18, (pos, dir) => moveSort(pos, dir, sortOrder18, setSortOrder18), '↕️ Módulo 18 · Ordenar');
      case 19: return renderQuiz(finalQItems, '❓ Módulo 19 · Quiz final');
      case 20: return renderReflect();
      case 21: return renderCompletion();
      default: return null;
    }
  };

  const progress = (step / (TOTAL_STEPS - 1)) * 100;

  const handleMain = () => {
    const handlers: Record<number, (() => boolean) | undefined> = {
      2: () => checkQuizGen(nocodeQItems),
      5: () => checkSortGen(sortOrder5, sortOk5, setSortOk5, '5'),
      6: () => checkBuilder(builderWire, BUILDER_WIRE),
      7: checkDrag,
      8: () => checkBuilder(builderStyle, BUILDER_STYLE),
      9: checkScenario,
      10: () => checkQuizGen(dbQItems),
      11: () => checkBuilder(builderDescribe, BUILDER_DESCRIBE),
      12: () => checkBuilder(builderAi, BUILDER_AI),
      13: checkTF,
      15: () => checkQuizGen(moneyQItems),
      16: () => checkBuilder(builderSurvey, BUILDER_SURVEY),
      17: () => checkQuizGen(publishQItems),
      18: () => checkSortGen(sortOrder18, sortOk18, setSortOk18, '18'),
      19: () => checkQuizGen(finalQItems),
      20: checkReflect,
    };
    const h = handlers[step];
    if (h) { if (!h()) return; }
    goNext();
  };

  const showNext = step < TOTAL_STEPS - 1 && ![2, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18, 19, 20].includes(step);
  const showCheck = [2, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18, 19, 20].includes(step) && step < TOTAL_STEPS - 1;

  return (
    <View style={styles.screen}>
      <View style={styles.progressBar}>
        <TouchableOpacity onPress={() => router.back()}><MaterialIcons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
        <Text style={styles.xpText}>{xp} XP</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>{renderStep()}</ScrollView>
      {showNext && <TouchableOpacity style={styles.nextBtn} onPress={goNext}><Text style={styles.nextText}>Continuar →</Text></TouchableOpacity>}
      {showCheck && <TouchableOpacity style={styles.nextBtn} onPress={handleMain}><Text style={styles.nextText}>Comprobar</Text></TouchableOpacity>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  progressBar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  progressTrack: { flex: 1, height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, marginHorizontal: 12 },
  progressFill: { height: '100%', backgroundColor: '#7c3aed', borderRadius: 3 },
  xpText: { fontWeight: 'bold', fontSize: 14, color: '#854d0e' },
  scroll: { padding: 16, paddingBottom: 40 },
  tag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 12 },
  tagText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  iconCircle: { width: 60, height: 60, borderRadius: 18, backgroundColor: '#faf5ff', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  title: { ...typography.extraBold, fontSize: 19, color: '#111827', marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#6b7280', marginBottom: 14, lineHeight: 18 },
  bodyText: { fontSize: 13, color: '#374151', lineHeight: 20, marginBottom: 12 },
  card: { backgroundColor: '#f9fafb', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  cardTitle: { fontWeight: 'bold', fontSize: 13, color: '#111827', marginBottom: 4 },
  cardText: { fontSize: 13, color: '#374151', lineHeight: 20 },
  highlight: { borderLeftWidth: 3, borderLeftColor: '#7c3aed', borderRadius: 4, padding: 11, marginVertical: 8 },
  highlightText: { color: '#5b21b6', fontSize: 13, lineHeight: 20 },
  chip: { padding: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#d1d5db', backgroundColor: '#fff', marginBottom: 4 },
  dropCol: { borderWidth: 2, borderStyle: 'dashed', borderColor: '#d1d5db', borderRadius: 12, padding: 8, minHeight: 60 },
  sortItem: { flexDirection: 'row', alignItems: 'center', padding: 11, backgroundColor: '#f9fafb', borderRadius: 12, borderWidth: 1.5, borderColor: '#e5e7eb', marginBottom: 8 },
  sortNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#7c3aed', textAlign: 'center', lineHeight: 26, color: '#fff', fontWeight: 'bold', fontSize: 11, marginRight: 9 },
  sortText: { flex: 1, fontSize: 12, color: '#374151' },
  sortArrows: { flexDirection: 'column', gap: 3 },
  sortBtn: { width: 28, height: 26, borderRadius: 7, borderWidth: 1, borderColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center' },
  quizQ: { fontWeight: 'bold', fontSize: 13, padding: 11, backgroundColor: '#f9fafb', borderRadius: 10, marginBottom: 8 },
  quizOpt: { flexDirection: 'row', alignItems: 'center', padding: 10, borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10, marginBottom: 6, gap: 9 },
  quizLetter: { width: 22, height: 22, borderRadius: 6, backgroundColor: '#f3f4f6', textAlign: 'center', lineHeight: 22, fontSize: 10, fontWeight: 'bold' },
  tfQuestion: { fontWeight: 'bold', fontSize: 13, padding: 11, backgroundColor: '#f9fafb', borderRadius: 10, marginBottom: 8 },
  tfBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 2, borderColor: '#e5e7eb', alignItems: 'center' },
  optionBtn: { padding: 12, borderRadius: 12, borderWidth: 2, borderColor: '#e5e7eb', marginBottom: 8, backgroundColor: '#f9fafb' },
  flowOpt: { padding: 7, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#fff', marginBottom: 4 },
  textArea: { borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 13, minHeight: 120, textAlignVertical: 'top', marginBottom: 8 },
  nextBtn: { backgroundColor: '#7c3aed', padding: 14, margin: 16, borderRadius: 11, alignItems: 'center' },
  nextText: { fontWeight: 'bold', color: '#fff', fontSize: 15 },
  finishBtn: { backgroundColor: '#7c3aed', padding: 14, borderRadius: 11, width: '100%', alignItems: 'center', marginTop: 14 },
});