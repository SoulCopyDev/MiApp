import { exitLevel } from '../../utils/exitLevel';
import { router } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useGameStore } from '../../store/gameStore';
import { useReportProgress } from '../../components/LevelProgress';
import { colors, typography } from '../../theme';
import XPToast from '../../components/XPToast';

// ---------- Tipos ----------
type QuizItem = { q: string; opts: string[]; correct: number; explain: string };
type FakeItem = { text: string; correct: string; explain: string };

const TOTAL_STEPS = 7; // 0:intro + 5 partes + 1:complete
// Máx XP real = 260: quiz 15×8 + reto 35 + fake detector 8×5 + legado 30 + pitch 35.
// (El HTML declara 250 y se contradice diciendo "3 partes" y "5 partes".)
const MAX_XP = 260;

const pickN = <T,>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};
// Las 32 preguntas de la pool traen correct:1 — barajar es obligatorio (§5).
const shuffleOpts = (q: QuizItem): QuizItem => {
  const paired = q.opts.map((opt, i) => ({ opt, isCorrect: i === q.correct }));
  for (let j = paired.length - 1; j > 0; j--) { const k = Math.floor(Math.random() * (j + 1)); [paired[j], paired[k]] = [paired[k], paired[j]]; }
  return { ...q, opts: paired.map((p) => p.opt), correct: paired.findIndex((p) => p.isCorrect) };
};

// ---------- Validación de texto libre (§14) ----------
const normalizeText = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const looksRandom = (text: string): boolean => {
  const words = normalizeText(text).split(/\s+/).filter((w) => w.length > 0);
  if (words.length < 5) return true;
  if (new Set(words).size / words.length < 0.5) return true;
  const noVowel = words.filter((w) => w.length >= 3 && !/[aeiou]/.test(w)).length;
  return noVowel / words.length > 0.3;
};
const COURSE_TERMS = ['ia', 'inteligencia artificial', 'curso', 'nivel', 'mundo', 'aprendi', 'aprender', 'aprendizaje', 'ensenar', 'proyecto', 'construi', 'construir', 'crear', 'cree', 'chatbot', 'bot', 'app', 'aplicacion', 'prompt', 'automatizacion', 'automatizar', 'herramienta', 'modelo', 'agi', 'etica', 'sesgo', 'privacidad', 'problema', 'solucion', 'impacto', 'usuario', 'usuarios', 'persona', 'personas', 'gente', 'comunidad', 'familia', 'colegio', 'estudiante', 'carrera', 'trabajo', 'futuro', 'proposito', 'mision', 'paso', 'plan', 'cambio', 'cambiar', 'habilidad', 'leccion', 'orgullo', 'siento', 'validar', 'mvp', 'pitch'];
const containsTopic = (text: string): boolean => {
  const n = normalizeText(text);
  const words = n.split(/[^a-z0-9]+/).filter(Boolean);
  return COURSE_TERMS.some((t) => (t.length <= 3 ? words.includes(t) : n.includes(t)));
};

// ===================== POOLS =====================

const MASTER_Q_POOL: QuizItem[] = [
  { q: 'Diferencia clave entre IA estrecha (hoy) e IA general (AGI):', opts: ['La IA estrecha resulta bastante más cara de entrenar y mantener', 'La estrecha domina UN dominio; la AGI dominaría cualquier tarea como un humano experto', 'Solo cambia el nombre comercial con que las empresas las venden', 'Son exactamente lo mismo descrito con dos términos distintos'], correct: 1, explain: 'Narrow AI: ChatGPT, Claude (lenguaje). AGI hipotética: cualquier dominio. ASI: supera a los humanos en TODO.' },
  { q: 'Cuando una IA inventa información falsa con tono seguro, se dice que:', opts: ['Está funcionando exactamente como fue diseñada para hacerlo', 'Alucina: predice el texto más probable sin verificar si es verdad', 'Se ha sobrecargado por exceso de consultas simultáneas', 'Ha dejado de funcionar y necesita reiniciarse por completo'], correct: 1, explain: 'Alucinación: limitación inherente de los LLM. Por eso siempre hay que verificar la información importante.' },
  { q: 'El uso ético de la IA implica:', opts: ['No usarla nunca para trabajos que vayan a ser evaluados', 'Verificar información, declarar cuándo la usaste y respetar la privacidad', 'Usarla para absolutamente todo y confiar en su criterio', 'Reservarla solo para tareas de entretenimiento personal'], correct: 1, explain: 'Ética práctica = honestidad sobre el uso + responsabilidad sobre las consecuencias + respeto a los demás.' },
  { q: 'Los datos sesgados producen:', opts: ['Modelos más precisos, porque reflejan el mundo tal cual es', 'Modelos sesgados que magnifican esos sesgos en sus salidas', 'Modelos neutros, porque el algoritmo corrige las desviaciones', 'Modelos más veloces, al reducir la variedad de los datos'], correct: 1, explain: 'Garbage in, garbage out. Si entrenas con datos sesgados por raza o género, el modelo amplifica esos sesgos.' },
  { q: 'Las apps que YA usas (Spotify, Maps, Netflix) tienen IA porque:', opts: ['Es una tendencia de mercado que atrae más usuarios nuevos', 'Permite recomendar, optimizar rutas y subtitular a una escala imposible para humanos', 'Es un elemento decorativo que mejora la imagen de marca', 'Se añadió por error en actualizaciones recientes del sistema'], correct: 1, explain: 'La IA invisible es la más común. Cada app moderna tiene capas de IA — solo que no las ves explícitamente.' },
  { q: 'Los 4 ingredientes de un prompt efectivo son:', opts: ['Color, tamaño de letra, idioma y tipografía del mensaje', 'Rol + Tarea + Contexto + Formato', 'Únicamente la pregunta, formulada de la manera más breve', 'Tiempo, lugar, persona y modo en que se hace la petición'], correct: 1, explain: 'Rol (eres X) + Tarea (haz Y) + Contexto (sabiendo Z) + Formato (en formato W). Es el núcleo del prompting.' },
  { q: '"Few-shot prompting" significa:', opts: ['Pedir el resultado sin dar ningún ejemplo previo al modelo', 'Dar al modelo 2-5 ejemplos del resultado esperado para que generalice', 'Hacer preguntas muy cortas para ahorrar tokens de contexto', 'Escribir el prompt en inglés para mejorar la precisión'], correct: 1, explain: 'Few-shot: "…y ahora aplica el mismo patrón a esto". Mejora la calidad de forma notable frente a zero-shot.' },
  { q: '"Chain-of-Thought" (CoT) sirve para:', opts: ['Que la redacción del modelo suene más elegante y natural', 'Que el modelo razone paso a paso, mejorando la precisión en problemas complejos', 'Cambiar automáticamente el idioma de la conversación', 'Realizar operaciones aritméticas con mayor rapidez'], correct: 1, explain: 'CoT: "piensa paso a paso". Reduce errores de razonamiento en matemáticas, lógica y decisiones.' },
  { q: 'El parámetro "temperatura" en una IA controla:', opts: ['La velocidad a la que el modelo devuelve la respuesta', 'Creatividad vs precisión: alta es más aleatoria, baja es más conservadora', 'La cantidad de recursos de servidor que consume la consulta', 'La longitud máxima que puede alcanzar la respuesta'], correct: 1, explain: 'Temperatura 0 = siempre la respuesta más probable. Temperatura 1 o más = más variación creativa.' },
  { q: 'Si un prompt falla, lo correcto es:', opts: ['Repetirlo exactamente igual varias veces hasta que funcione', 'Identificar qué le faltó (rol, contexto, formato, ejemplos) y reformular', 'Cambiar de modelo inmediatamente sin revisar el prompt', 'Asumir que la tarea excede las capacidades actuales del modelo'], correct: 1, explain: 'Iteración inteligente: diagnostica el fallo específico, ajusta y vuelve a intentarlo.' },
  { q: 'Al generar imágenes con IA, los "negative prompts" sirven para:', opts: ['Describir la escena con un tono dramático y sombrío', 'Decirle al modelo qué NO incluir (sin texto, sin manos extra, sin marca de agua)', 'Reducir el costo por imagen al acortar la petición', 'Forzar que el resultado se genere en blanco y negro'], correct: 1, explain: 'Negative prompts: "no quiero esto". Son críticos para obtener resultados de aspecto profesional.' },
  { q: 'Las herramientas líderes de imagen con IA en 2025-2026 son:', opts: ['Los editores de mapa de bits clásicos de cualquier sistema', 'Midjourney (estética), DALL-E (en ChatGPT), Stable Diffusion (open source) y Firefly (Adobe)', 'Únicamente Photoshop con sus filtros generativos incorporados', 'Todavía no existe ninguna con calidad realmente utilizable'], correct: 1, explain: 'Cada una tiene su fortaleza: Midjourney (arte), DALL-E (instrucciones complejas), SD (control técnico), Firefly (seguro legalmente).' },
  { q: 'ElevenLabs es famoso por:', opts: ['La edición avanzada de fotografías con retoque automático', 'La clonación de voz con IA: replica una voz con 30 segundos de audio', 'La generación de vídeo a partir de descripciones escritas', 'La asistencia a programadores dentro del editor de código'], correct: 1, explain: 'ElevenLabs lidera el voice cloning. Capacidades reales, pero también riesgos éticos con los deepfakes de voz.' },
  { q: 'AlphaFold (Nobel 2024) hizo qué exactamente:', opts: ['Generar obras de arte que se subastaron en galerías reconocidas', 'Predecir la estructura 3D de 200M de proteínas, acelerando la biomedicina 50 años en 4', 'Componer piezas musicales indistinguibles de las humanas', 'Producir largometrajes completos a partir de un guion escrito'], correct: 1, explain: 'AlphaFold democratizó la biomedicina. Cualquier estudiante accede hoy a estructuras antes imposibles.' },
  { q: 'El "pipeline multimodal" significa:', opts: ['Trabajar solo con texto pero en varios idiomas a la vez', 'Combinar IA de texto, imagen, audio y vídeo en un flujo coordinado', 'Generar únicamente vídeos a partir de otros vídeos previos', 'Producir música combinando varios instrumentos sintéticos'], correct: 1, explain: 'Pipeline multimodal: por ejemplo texto → guion → imágenes generadas → audio narrado → vídeo editado.' },
  { q: 'ChatGPT vs Claude · Diferencia clave:', opts: ['Solo cambian los colores y la disposición de su interfaz', 'ChatGPT es más generalista; Claude destaca en razonamiento, escritura larga y código', 'Son idénticos porque comparten exactamente el mismo modelo base', 'ChatGPT es gratuito mientras que Claude siempre requiere pago'], correct: 1, explain: 'Cada modelo tiene sus fortalezas. Claude prioriza calidad y seguridad; GPT prioriza versatilidad e integración.' },
  { q: 'Gemini destaca por:', opts: ['Ser la única alternativa completamente gratuita del mercado', 'Su integración con el ecosistema Google, ventana de contexto larga y multimodal nativo', 'Estar disponible solo en determinadas regiones de Asia', 'Funcionar sin conexión a internet en cualquier dispositivo'], correct: 1, explain: 'Gemini = la ventaja de Google: tus datos ya están ahí. Y su ventana de contexto supera a la de sus competidores.' },
  { q: 'Perplexity es ideal para:', opts: ['Generar contenido de entretenimiento y guiones de ficción', 'Búsqueda con IA: combina LLM y búsqueda web en tiempo real citando fuentes', 'Programar aplicaciones completas desde cero sin escribir código', 'Editar y renderizar vídeo con efectos generados por IA'], correct: 1, explain: 'Perplexity: búsqueda inteligente con citas. Reemplaza a Google en muchas consultas que exigen actualidad.' },
  { q: 'La elección de la herramienta correcta depende de:', opts: ['Nada en particular, porque todas ofrecen resultados equivalentes', 'Tarea + presupuesto + privacidad + capacidades del modelo + curva de aprendizaje', 'Únicamente del precio mensual de la suscripción', 'Solo de la cantidad de usuarios que ya tenga la plataforma'], correct: 1, explain: 'No existe la "mejor IA absoluta". Existe la "mejor IA para esta tarea, en este contexto".' },
  { q: 'Cuándo combinar varias IAs:', opts: ['Nunca, porque mezclar herramientas complica el flujo de trabajo', 'Cuando cada una aporta algo único (Perplexity busca, Claude analiza, Midjourney visualiza)', 'Solo si tienes contratado el plan premium de todas ellas', 'Solo cuando trabajas íntegramente en lengua inglesa'], correct: 1, explain: 'Los stacks de IA (Perplexity + Claude + Lovable + Zapier) son un combo habitual para construir productos rápido.' },
  { q: 'El "system prompt" de un chatbot es:', opts: ['El primer mensaje que envía el usuario al iniciar el chat', 'Las instrucciones invisibles que definen rol, tono, objetivo y límites', 'El nombre público con el que se presenta el asistente', 'El idioma por defecto en que responderá a las consultas'], correct: 1, explain: 'System prompt: reglas secretas. Por eso un mismo modelo puede ser "tutor amigable" o "asistente legal".' },
  { q: 'Zapier vs Make vs n8n · Diferencia:', opts: ['Son productos idénticos de una misma empresa matriz', 'Zapier es el más simple, Make el más visual y n8n es open source y autohospedable', 'Solo se diferencian en el precio de sus planes mensuales', 'Solo cambia el idioma en que está disponible su interfaz'], correct: 1, explain: 'Mismo objetivo (automatización), enfoques distintos según simplicidad, potencia visual y control de datos.' },
  { q: 'MVP (Minimum Viable Product) significa:', opts: ['El producto terminado y pulido, listo para su lanzamiento masivo', 'La versión más simple que VALIDA si tu idea resuelve un problema real', 'El producto que más ingresos genera dentro de un catálogo', 'Una maqueta visual sin ninguna funcionalidad implementada'], correct: 1, explain: 'MVP: lo más pequeño que prueba tu hipótesis con usuarios de verdad.' },
  { q: 'Lovable, Bolt y Bubble son herramientas de:', opts: ['Edición de audio y producción musical asistida por IA', 'No-code: construir apps web y móviles sin programar de forma tradicional', 'Análisis estadístico avanzado para investigación académica', 'Cálculo numérico y simulación de modelos científicos'], correct: 1, explain: 'El no-code de 2023-2026 lo cambió todo: construyes apps reales describiéndolas en lenguaje natural.' },
  { q: 'Un "elevator pitch" efectivo dura:', opts: ['Alrededor de 10 minutos, como una presentación formal breve', '30-60 segundos: problema, solución y por qué tú', 'Unos 5 segundos, apenas el nombre del proyecto', 'Cerca de una hora, para poder cubrir todos los detalles'], correct: 1, explain: 'Elevator pitch: si te cruzas con un inversor en un ascensor, ¿qué le dices en lo que dura el viaje?' },
  { q: 'Geoffrey Hinton (padre del deep learning) en 2023:', opts: ['Presentó una nueva arquitectura que superó a los transformers', 'Renunció a Google para hablar libremente sobre los riesgos de la IA', 'Se retiró definitivamente de la vida académica y pública', 'Cambió de campo para dedicarse a la biología computacional'], correct: 1, explain: 'Hinton, Premio Turing, dejó Google a los 75 años para advertir. Pasó de optimista a alertista público.' },
  { q: 'El "problema de alineación" en IA es:', opts: ['Corregir la orientación física de los sensores de un robot', 'Garantizar que los objetivos de una IA muy capaz sean compatibles con los valores humanos', 'Ajustar la calibración del color en las pantallas de salida', 'Sincronizar varios modelos para que respondan al mismo tiempo'], correct: 1, explain: 'La alineación es un campo de investigación entero. Es el corazón de la seguridad en IA.' },
  { q: 'Da Vinci (sistema robótico) ha realizado:', opts: ['Unas diez intervenciones dentro de ensayos clínicos controlados', '14 millones de cirugías reales: es el sistema quirúrgico robótico más usado del mundo', 'Solo demostraciones en ferias médicas, sin pacientes reales', 'Ninguna todavía, porque sigue pendiente de aprobación'], correct: 1, explain: '14M de cirugías reales en el mundo. En Colombia: Fundación Santa Fe, Imbanaco y Soma.' },
  { q: 'Waymo opera un servicio de robotaxi REAL en:', opts: ['Circuitos cerrados de prueba, sin pasajeros del público general', 'Phoenix, San Francisco, Los Ángeles y Austin, con más de 100.000 viajes semanales', 'Únicamente en algunas ciudades del sudeste asiático', 'Ningún sitio todavía: sigue siendo un proyecto experimental'], correct: 1, explain: 'Waymo no es ciencia ficción: es un producto comercial real y en operación.' },
  { q: 'Casgevy (medicamento CRISPR aprobado por la FDA en 2023) cura:', opts: ['Varios tipos de cáncer de sangre resistentes a la quimioterapia', 'La anemia falciforme: cura definitiva en el 90% de los pacientes', 'La diabetes tipo 1 restaurando la producción de insulina', 'Las secuelas prolongadas de la infección por COVID'], correct: 1, explain: 'Hito histórico: primera terapia CRISPR aprobada por la FDA. Costo: $2.2M USD por paciente.' },
  { q: 'El gran reto de la medicina del futuro NO es la tecnología, es:', opts: ['El idioma en que están escritos los sistemas clínicos', 'El acceso desigual: tratamientos millonarios frente a sistemas públicos colapsados', 'La velocidad de procesamiento de los equipos hospitalarios', 'La resistencia de los médicos a incorporar nuevas herramientas'], correct: 1, explain: 'La medicina avanza más rápido que los sistemas de salud pública. Sin políticas valientes, será solo para élites.' },
  { q: 'El balance neto de la IA para el planeta depende de:', opts: ['Nada: el resultado ya está determinado y es negativo', 'Cómo se use: optimizar redes y predecir el clima suma; el consumo masivo sin propósito resta', 'Únicamente del precio que alcance la energía renovable', 'Solo del país donde se instalen los centros de datos'], correct: 1, explain: 'Estudio del MIT: cada $1 invertido en IA optimizadora ahorra entre $5 y $10 en consumo global.' }
];

const FAKE_POOL: FakeItem[] = [
  { text: 'Las IAs actuales (ChatGPT, Claude, Gemini) son AGI (Inteligencia General Artificial)', correct: 'no', explain: 'MITO. Son IAs estrechas — muy capaces en lenguaje, pero NO general.' },
  { text: 'Una IA puede "alucinar" — inventar información falsa con tono seguro', correct: 'ok', explain: 'VERDAD. Limitación inherente. Por eso siempre verifica info importante.' },
  { text: 'AlphaFold ganó el Nobel de Química 2024 por predecir estructura de proteínas', correct: 'ok', explain: 'VERDAD. Hassabis y Jumper de DeepMind. Hito histórico.' },
  { text: 'Si una IA pasa el Test de Turing, es definitivamente consciente', correct: 'no', explain: 'MITO. Pasar el test = imitar conversación humana. NO implica consciencia.' },
  { text: 'Los autos Tesla Autopilot son técnicamente "totalmente autónomos" (Nivel 5)', correct: 'no', explain: 'MITO. Autopilot/FSD son Nivel 2 técnicamente, pese a marketing.' },
  { text: 'Casgevy (CRISPR) cura anemia falciforme con tratamiento único — pero cuesta $2.2M USD', correct: 'ok', explain: 'VERDAD. Hito histórico de medicina genética. Acceso desigual real.' },
  { text: 'Los chatbots terapéuticos como Woebot pueden REEMPLAZAR completamente a un terapeuta', correct: 'no', explain: 'MITO. Buen diseño = COMPLEMENTO + derivación a humano para casos serios.' },
  { text: 'DeepMind redujo 40% el consumo energético de los data centers de Google con IA', correct: 'ok', explain: 'VERDAD. Caso emblemático 2016. La misma IA que consume energía también optimiza.' },
  { text: 'Alan Turing inventó las bases de la computación moderna y descifró Enigma en la IIGM', correct: 'ok', explain: 'VERDAD. Padre fundacional del campo. Salvó millones de vidas.' },
  { text: 'Una imagen generada por IA pertenece automáticamente a quien la generó (sin restricciones legales)', correct: 'depende', explain: 'DEPENDE. Zona gris legal real. Varía por país.' },
  { text: 'El "problema de alineación" es el corazón de la investigación en seguridad de IA actual', correct: 'ok', explain: 'VERDAD. Anthropic, DeepMind Safety, MIRI invierten millones en esto.' },
  { text: 'Lovable, Bolt y Bubble son herramientas no-code que permiten construir apps reales sin programar', correct: 'ok', explain: 'VERDAD. Revolución 2023-2026. Personas sin saber programar ya construyen apps reales.' },
];

const BUILDER_TOOL = {
  xp: 35,
  rows: [
    { key: 'problema', label: 'Elige el PROBLEMA real a resolver', opts: ['Mi abuela no puede usar la app del banco', 'Mi colegio pierde tareas en WhatsApp', 'Quiero analizar 100 PDFs académicos', 'Mi negocio familiar no llega a clientes', 'Tengo idea de app para mi comunidad'] },
    { key: 'herramienta', label: 'Elige la HERRAMIENTA principal', opts: ['Claude (razonamiento profundo)', 'ChatGPT (generalista)', 'Gemini (Google ecosystem)', 'Perplexity (búsqueda con citas)', 'Lovable / Bolt (construir app)', 'NotebookLM (analizar documentos)', 'Zapier / Make (automatización)'] },
    { key: 'tecnica', label: 'Elige la TÉCNICA de prompting', opts: ['Zero-shot · pregunto directamente', 'Few-shot · doy 2-3 ejemplos', 'Chain-of-Thought · razono paso a paso', 'System prompt · defino rol y límites', 'Iterativo · refino con varias rondas'] },
    { key: 'plan', label: 'Tu PLAN de acción concreto', opts: ['Empezar HOY: probar herramienta', 'Esta semana: consultar a 3 personas', 'Plan 2 semanas: construir MVP', 'Plan mes: investigar + construir + probar', 'Plan trimestre: validar, escalar, documentar'] },
    { key: 'etica', label: 'Tu CHECK ético', opts: ['Verificaré información de IA', 'Declararé cuándo usé IA', 'No automatizaré decisiones emocionales', 'Respetaré privacidad', 'Pediré feedback honesto'] },
  ],
};

// ===================== COMPONENTE =====================
export default function World6Level7() {
  const completeLevel = useGameStore((s) => s.completeLevel);

  const [step, setStep] = useState(0);
  useReportProgress(step, TOTAL_STEPS);
  const [xp, setXp] = useState(0);
  const [xpToast, setXpToast] = useState<{ amount: number; id: number } | null>(null);

  // Pools aleatorios
  const [masterQItems] = useState(() => pickN(MASTER_Q_POOL, 15).map(shuffleOpts));
  const [fakeItems] = useState(() => pickN(FAKE_POOL, 8));
  const awarded = useRef<Set<string>>(new Set());

  // Estados de módulos
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizChecked, setQuizChecked] = useState(false);

  const [builderTool, setBuilderTool] = useState<Record<string, string>>({});

  const [fakeAnswers, setFakeAnswers] = useState<Record<number, string>>({});
  const [fakeDone, setFakeDone] = useState(false);

  const [reflectVal, setReflectVal] = useState('');

  // Feedback inline (§16: en web Alert no dispara sus botones)
  const [quizScore, setQuizScore] = useState<{ c: number; total: number } | null>(null);
  const [fakeScore, setFakeScore] = useState<{ c: number; total: number } | null>(null);
  const [reflectFb, setReflectFb] = useState<string | null>(null);

  useEffect(() => {
    if (step === 1) { setQuizAnswers({}); setQuizChecked(false); setQuizScore(null); }
    if (step === 2) { setBuilderTool({}); }
    if (step === 3) { setFakeAnswers({}); setFakeDone(false); setFakeScore(null); }
    if (step === 4 || step === 5) { setReflectVal(''); setReflectFb(null); }
  }, [step]);

  const addXP = (n: number) => { setXp((p) => p + n); if (n > 0) setXpToast((prev) => ({ amount: n, id: (prev?.id ?? 0) + 1 })); };
  // Cada parte premia una sola vez (§26)
  const awardOnce = (key: string, amount: number) => {
    if (awarded.current.has(key)) return;
    awarded.current.add(key);
    if (amount > 0) addXP(amount);
  };
  const goNext = () => { if (step < TOTAL_STEPS - 1) setStep(step + 1); };
  // Estrellas por desempeño real, no fijas (§22). Umbrales de eval: 85% / 65%.
  const handleFinish = () => {
    const pct = (xp / MAX_XP) * 100;
    const stars = pct >= 85 ? 3 : pct >= 65 ? 2 : 1;
    completeLevel(42, stars, xp);
    router.replace('/eval/final');
  };

  // Quiz
  const selQuiz = (qi: number, oi: number) => { if (!quizChecked) setQuizAnswers((p) => ({ ...p, [qi]: oi })); };
  const checkQuiz = () => {
    setQuizChecked(true);
    let c = 0;
    masterQItems.forEach((q, i) => { if (quizAnswers[i] === q.correct) c++; });
    setQuizScore({ c, total: masterQItems.length });
    awardOnce('quiz', c * 8);
  };

  // Builder
  const selBuilder = (key: string, val: string) => setBuilderTool((p) => ({ ...p, [key]: val }));
  const builderComplete = () => BUILDER_TOOL.rows.every((r) => builderTool[r.key]);

  // Fake detector
  const pickFake = (i: number, col: string) => { if (!fakeDone) setFakeAnswers((p) => ({ ...p, [i]: col })); };
  const checkFake = () => {
    setFakeDone(true);
    let c = 0;
    fakeItems.forEach((item, i) => { if (fakeAnswers[i] === item.correct) c++; });
    setFakeScore({ c, total: fakeItems.length });
    awardOnce('fake', c * 5);
  };

  // Reflexión — valida contenido real, no solo longitud (§14)
  const checkReflect = (key: string, minLen: number, xpAward: number) => {
    const t = reflectVal.trim();
    if (t.length < minLen) { setReflectFb(`Escribe al menos ${minLen} caracteres (llevas ${t.length}).`); return false; }
    if (looksRandom(t)) { setReflectFb('Parece texto al azar. Escribe tu respuesta real con tus propias palabras.'); return false; }
    if (!containsTopic(t)) { setReflectFb('Conéctalo con el curso: qué aprendiste, qué construiste y cuál es tu siguiente paso.'); return false; }
    setReflectFb(null);
    awardOnce(key, xpAward);
    return true;
  };

  // ============ RENDER ============
  const renderIntro = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fef3c7' }]}><Text style={[styles.tagText, { color: '#78350f' }]}>🎓 EVALUACIÓN FINAL · GRADUACIÓN</Text></View>
      <View style={styles.iconCircle}><Text style={{ fontSize: 34 }}>🎓</Text></View>
      <Text style={styles.title}>Evaluación Final · Graduación AI Expert</Text>
      <Text style={styles.subtitle}>Llegaste al final del camino. 36 niveles, 6 mundos, decenas de proyectos. Esta es tu prueba maestra.</Text>
      <View style={styles.card}><Text style={styles.cardTitle}>📚 Qué se evalúa</Text><Text style={styles.cardText}>Quiz maestro de 15 preguntas · Reto de herramientas integrador · Fake detector final · Builder de legado · Pitch de graduación.</Text></View>
      <View style={styles.card}><Text style={styles.cardTitle}>🎓 Qué obtienes</Text><Text style={styles.cardText}>Cerrar oficialmente AI Expert. Demostrar dominio integral de los 6 mundos. Recibir certificado de graduación.</Text></View>
      <View style={styles.card}><Text style={styles.cardTitle}>🏗️ 5 partes</Text><Text style={styles.cardText}>📝 Quiz Maestro · 🛠️ Reto de herramientas · 🔍 Fake Detector · 📚 Builder de Legado · 🎤 Pitch de Graduación</Text></View>
    </View>
  );

  const renderQuiz = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fef3c7' }]}><Text style={[styles.tagText, { color: '#92400e' }]}>📝 Parte 1 · Quiz Maestro</Text></View>
      <Text style={styles.title}>Quiz Maestro (15 preguntas)</Text>
      {quizScore && (
        <View style={[styles.scoreBar, quizScore.c >= quizScore.total * 0.6 ? styles.scoreOk : styles.scoreBad]}>
          <Text style={quizScore.c >= quizScore.total * 0.6 ? styles.scoreOkText : styles.scoreBadText}>
            {quizScore.c} de {quizScore.total} correctas · +{quizScore.c * 8} XP
          </Text>
        </View>
      )}
      {masterQItems.map((q, qi) => {
        const sel = quizAnswers[qi];
        return (
          <View key={qi} style={{ marginBottom: 14 }}>
            <Text style={styles.quizQ}>{qi + 1}. {q.q}</Text>
            {q.opts.map((opt, oi) => {
              const isSel = sel === oi;
              const showOk = quizChecked && oi === q.correct;
              const showWrong = quizChecked && isSel && oi !== q.correct;
              return (
                <TouchableOpacity key={oi} style={[styles.quizOpt, isSel && !quizChecked && { borderColor: '#b45309', backgroundColor: '#fef3c7' }, showOk && styles.optOk, showWrong && styles.optWrong]} onPress={() => selQuiz(qi, oi)} disabled={quizChecked}>
                  <Text style={styles.quizLetter}>{String.fromCharCode(65 + oi)}</Text>
                  <Text style={{ flex: 1, fontSize: 12 }}>{opt}</Text>
                </TouchableOpacity>
              );
            })}
            {quizChecked && (
              <Text style={sel === q.correct ? styles.fbGood : styles.fbBad}>
                {sel === q.correct ? '✓ ¡Correcto! — ' : `✗ Respuesta ${String.fromCharCode(65 + q.correct)} — `}{q.explain}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );

  const renderBuilder = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fef3c7' }]}><Text style={[styles.tagText, { color: '#78350f' }]}>🛠️ Parte 2 · Reto de herramientas</Text></View>
      <Text style={styles.title}>Reto de herramientas</Text>
      {BUILDER_TOOL.rows.map((row) => (
        <View key={row.key} style={{ marginBottom: 10 }}>
          <Text style={{ fontWeight: 'bold', color: '#78350f', marginBottom: 4 }}>{row.label}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
            {row.opts.map((opt) => (
              <TouchableOpacity key={opt} style={[styles.flowOpt, builderTool[row.key] === opt && { borderColor: '#b45309', backgroundColor: '#fef3c7' }]} onPress={() => selBuilder(row.key, opt)}>
                <Text style={{ fontSize: 11 }}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
    </View>
  );

  const renderFakeDetector = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fdf4ff' }]}><Text style={[styles.tagText, { color: '#7e22ce' }]}>🔍 Parte 3 · Fake Detector</Text></View>
      <Text style={styles.title}>Fake Detector Final</Text>
      {fakeScore && (
        <View style={[styles.scoreBar, fakeScore.c >= fakeScore.total * 0.6 ? styles.scoreOk : styles.scoreBad]}>
          <Text style={fakeScore.c >= fakeScore.total * 0.6 ? styles.scoreOkText : styles.scoreBadText}>
            {fakeScore.c} de {fakeScore.total} correctas · +{fakeScore.c * 5} XP
          </Text>
        </View>
      )}
      {fakeItems.map((item, i) => {
        const sel = fakeAnswers[i];
        return (
          <View key={i} style={[styles.card, { marginBottom: 8 }]}>
            <Text style={{ fontWeight: '600', marginBottom: 6 }}>{i + 1}. {item.text}</Text>
            <View style={{ flexDirection: 'row', gap: 5 }}>
              {['ok', 'no', 'depende'].map((col) => {
                const isSel = sel === col;
                const showOk = fakeDone && col === item.correct;
                const showWrong = fakeDone && isSel && col !== item.correct;
                return (
                  <TouchableOpacity key={col} style={[styles.ethOpt, isSel && !fakeDone && { borderColor: '#b45309', backgroundColor: '#fef3c7' }, showOk && styles.optOkSolid, showWrong && styles.optWrongSolid]} onPress={() => pickFake(i, col)} disabled={fakeDone}>
                    <Text style={[{ fontSize: 11, fontWeight: '600' }, (showOk || showWrong) && { color: '#fff' }]}>{col === 'ok' ? '✅ Verdad' : col === 'no' ? '❌ Mito' : '⚖️ Depende'}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {fakeDone && (
              <Text style={sel === item.correct ? styles.fbGood : styles.fbBad}>
                {sel === item.correct ? '✓ ¡Correcto! — ' : '✗ Incorrecto — '}{item.explain}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );

  const renderReflect = (tag: string, title: string, question: string, placeholder: string, minLen: number, xpLabel: string) => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#f3f4f6' }]}><Text style={[styles.tagText, { color: '#374151' }]}>{tag} · +{xpLabel} XP</Text></View>
      <Text style={styles.title}>{title}</Text>
      <View style={[styles.card, { backgroundColor: '#faf5ff' }]}>
        <Text style={styles.cardTitle}>🤔 Tu pregunta</Text>
        <Text style={styles.cardText}>{question}</Text>
      </View>
      <TextInput style={styles.textArea} multiline placeholderTextColor="#b8bcc0" placeholder={placeholder} value={reflectVal} onChangeText={(t) => { setReflectVal(t); if (reflectFb) setReflectFb(null); }} />
      <Text style={{ fontSize: 11, color: '#9ca3af', textAlign: 'right' }}>{reflectVal.trim().length} / {minLen} mínimo</Text>
      {reflectFb && <Text style={styles.fbBad}>{reflectFb}</Text>}
    </View>
  );

  const renderCompletion = () => (
    <View style={{ alignItems: 'center', padding: 20 }}>
      <Text style={{ fontSize: 90 }}>🎓</Text>
      <Text style={[styles.title, { textAlign: 'center', fontSize: 28 }]}>¡FELICITACIONES, GRADUADO!</Text>
      <Text style={[styles.subtitle, { textAlign: 'center', marginBottom: 16 }]}>
        Recibiste el certificado oficial: <Text style={{ fontWeight: 'bold' }}>AI Expert · Graduado</Text>. Eres ahora oficialmente miembro de la primera generación AI Expert. <Text style={{ fontStyle: 'italic' }}>El mundo necesita gente como tú.</Text>
      </Text>
      <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#854d0e', marginBottom: 16, padding: 12, backgroundColor: '#fef9c3', borderRadius: 12, borderWidth: 1, borderColor: '#fde047', width: '100%', textAlign: 'center' }}>⭐ {xp} XP ganados en la graduación</Text>
      {[
        'Demostré dominio integral de los 6 mundos del curso',
        'Resolví un problema real eligiendo herramienta + técnica de prompting + plan de acción',
        'Identifico verdades, mitos y zonas grises sobre IA con criterio propio',
        'Tengo mi portafolio de graduación documentado y articulado',
        'Cierro el curso oficialmente como AI Expert · Graduado',
      ].map((skill, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 9, paddingHorizontal: 11, backgroundColor: '#f0fdf4', borderRadius: 10, borderWidth: 1, borderColor: '#bbf7d0', width: '100%', marginBottom: 7 }}>
          <Text style={{ color: '#16a34a', fontSize: 15, marginTop: 1 }}>✓</Text>
          <Text style={{ fontSize: 12, color: '#166534', lineHeight: 18, fontWeight: '500', flex: 1 }}>{skill}</Text>
        </View>
      ))}
      <View style={[styles.card, { width: '100%', marginBottom: 14 }]}>
        <Text style={{ fontWeight: 'bold', fontSize: 12, color: '#374151', marginBottom: 5 }}>🎓 Has completado AI Expert oficialmente</Text>
        <Text style={{ fontSize: 12, color: '#374151', lineHeight: 18 }}>Eres ahora <Text style={{ fontWeight: 'bold' }}>graduado certificado</Text>. Tienes el conocimiento, las habilidades, y la responsabilidad. <Text style={{ fontStyle: 'italic' }}>Tu trabajo apenas empieza. Pero ya no estás en cero — empiezas con todo.</Text></Text>
      </View>
      <View style={{ width: '100%', marginBottom: 16 }}>
        <Text style={{ fontSize: 11, color: '#6b7280', marginBottom: 5, fontWeight: '700' }}>36 de 36 niveles · 100% completado · CURSO TERMINADO</Text>
        <View style={{ height: 7, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
          <View style={{ height: '100%', width: '100%', backgroundColor: '#b45309', borderRadius: 4 }} />
        </View>
      </View>
      <TouchableOpacity style={styles.finishBtn} onPress={handleFinish}>
        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>Ver mi certificado oficial 🏆</Text>
      </TouchableOpacity>
    </View>
  );

  // ============ RENDER PRINCIPAL ============
  const renderStep = () => {
    switch (step) {
      case 0: return renderIntro();
      case 1: return renderQuiz();
      case 2: return renderBuilder();
      case 3: return renderFakeDetector();
      case 4: return renderReflect('📚 Parte 4 · Tu Legado', 'Piensa tú', 'Mira atrás los 36 niveles. Responde con TODO lo que tengas:\n\n1. ¿Qué APRENDISTE? Las 3 lecciones más importantes.\n2. ¿Qué CREASTE? Los 3 proyectos que más te enorgullecen.\n3. ¿Qué HARÁS DIFERENTE ahora?', '1. APRENDÍ: ... | 2. CREÉ: ... | 3. HARÉ DIFERENTE: ...', 300, '30');
      case 5: return renderReflect('🎤 Parte 5 · Pitch de Graduación', 'Piensa tú', 'Tu pitch de graduación · 60 segundos escritos:\n\n🎯 Problema · 💡 Solución · 📊 Impacto · 🚀 Próximo paso', 'Problema: ... · Solución: ... · Impacto: ... · Próximo paso: ...', 250, '35');
      case 6: return renderCompletion();
      default: return null;
    }
  };

  const progress = (step / (TOTAL_STEPS - 1)) * 100;

  // Botón principal: etiqueta y estado dependen de la parte y de si ya se comprobó.
  const getPrimary = (): { label: string; enabled: boolean; onPress: () => void } => {
    switch (step) {
      case 1: return quizChecked
        ? { label: 'Continuar →', enabled: true, onPress: goNext }
        : { label: 'Comprobar respuestas', enabled: Object.keys(quizAnswers).length === masterQItems.length, onPress: checkQuiz };
      case 2: return { label: 'Terminar →', enabled: builderComplete(), onPress: () => { awardOnce('builder', BUILDER_TOOL.xp); goNext(); } };
      case 3: return fakeDone
        ? { label: 'Continuar →', enabled: true, onPress: goNext }
        : { label: 'Verificar clasificación', enabled: Object.keys(fakeAnswers).length === fakeItems.length, onPress: checkFake };
      case 4: return { label: 'Enviar respuesta →', enabled: reflectVal.trim().length >= 300, onPress: () => { if (checkReflect('legado', 300, 30)) goNext(); } };
      case 5: return { label: 'Sellar mi graduación →', enabled: reflectVal.trim().length >= 250, onPress: () => { if (checkReflect('pitch', 250, 35)) goNext(); } };
      default: return { label: 'Continuar →', enabled: true, onPress: goNext };
    }
  };
  const primary = getPrimary();
  const showPrimary = step < TOTAL_STEPS - 1;

  return (
    <View style={styles.screen}>
      <View style={styles.progressBar}>
        <TouchableOpacity onPress={() => exitLevel()} accessibilityLabel="Salir de la evaluación"><MaterialIcons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
        <Text style={styles.xpText}>{xp} XP</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>{renderStep()}</ScrollView>
      {showPrimary && (
        <TouchableOpacity style={[styles.nextBtn, !primary.enabled && { opacity: 0.35 }]} disabled={!primary.enabled} onPress={primary.onPress}>
          <Text style={styles.nextText}>{primary.label}</Text>
        </TouchableOpacity>
      )}
      {xpToast && <XPToast key={xpToast.id} amount={xpToast.amount} onHide={() => setXpToast(null)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  progressBar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  progressTrack: { flex: 1, height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, marginHorizontal: 12 },
  progressFill: { height: '100%', backgroundColor: '#b45309', borderRadius: 3 },
  xpText: { fontWeight: 'bold', fontSize: 14, color: '#854d0e' },
  scroll: { padding: 16, paddingBottom: 40 },
  tag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 12 },
  tagText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  iconCircle: { width: 60, height: 60, borderRadius: 18, backgroundColor: '#fef3c7', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  title: { ...typography.extraBold, fontSize: 19, color: '#111827', marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#6b7280', marginBottom: 14, lineHeight: 18 },
  card: { backgroundColor: '#f9fafb', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  cardTitle: { fontWeight: 'bold', fontSize: 13, color: '#111827', marginBottom: 4 },
  cardText: { fontSize: 13, color: '#374151', lineHeight: 20 },
  quizQ: { fontWeight: 'bold', fontSize: 13, padding: 11, backgroundColor: '#f9fafb', borderRadius: 10, marginBottom: 8 },
  quizOpt: { flexDirection: 'row', alignItems: 'center', padding: 10, borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10, marginBottom: 6, gap: 9 },
  optOk: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  optWrong: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  optOkSolid: { borderColor: '#16a34a', backgroundColor: '#16a34a' },
  optWrongSolid: { borderColor: '#dc2626', backgroundColor: '#dc2626' },
  fbGood: { fontSize: 11, marginTop: 4, color: '#065f46', backgroundColor: '#f0fdf4', padding: 7, borderRadius: 7, lineHeight: 16 },
  fbBad: { fontSize: 11, marginTop: 4, color: '#991b1b', backgroundColor: '#fef2f2', padding: 7, borderRadius: 7, lineHeight: 16 },
  scoreBar: { padding: 11, borderRadius: 10, marginBottom: 14, borderWidth: 1 },
  scoreOk: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  scoreBad: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  scoreOkText: { fontSize: 13, fontWeight: '700', color: '#166534', textAlign: 'center' },
  scoreBadText: { fontSize: 13, fontWeight: '700', color: '#991b1b', textAlign: 'center' },
  quizLetter: { width: 22, height: 22, borderRadius: 6, backgroundColor: '#f3f4f6', textAlign: 'center', lineHeight: 22, fontSize: 10, fontWeight: 'bold' },
  flowOpt: { padding: 7, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#fff', marginBottom: 4 },
  ethOpt: { padding: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  textArea: { borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 13, minHeight: 120, textAlignVertical: 'top', marginBottom: 8 },
  nextBtn: { backgroundColor: '#b45309', padding: 14, margin: 16, borderRadius: 11, alignItems: 'center' },
  nextText: { fontWeight: 'bold', color: '#fff', fontSize: 15 },
  finishBtn: { backgroundColor: '#b45309', padding: 14, borderRadius: 11, width: '100%', alignItems: 'center', marginTop: 14 },
});