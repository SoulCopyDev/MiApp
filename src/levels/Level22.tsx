import { router } from 'expo-router';
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, BackHandler,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useGameStore } from '../store/gameStore';
import { colors, typography } from '../theme';

// ---------- Tipos ----------
type DragItem = { t: string; c: string };
type MatchPair = { l: string; r: string };
type QuizItem = { q: string; o: string[]; c: number; e: string };
type TFItem = { s: string; c: boolean; e: string };
type FillItem = { s: string; o: string[]; c: number; e: string };
type PromptItem = { t: string; bad: string; good: string; e: string };
type ScenarioItem = {
  ctx: string;
  ch: { lb: string; tx: string; ok: boolean }[];
  e: string;
};
type WBItem = { q: string; cw: string[]; d: string[] };

const TOTAL_STEPS = 22; // 0:intro + 20 módulos + 1:complete
const CONTENT_STEPS = 20;

const pickN = <T,>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};

// ===================== POOLS =====================

const DRAG_POOL: DragItem[] = [
  { t: 'Que esta siendo tendencia en X ahora mismo', c: 'f' },
  { t: 'Analizar un PDF academico de 80 paginas', c: 'c' },
  { t: 'Entender por que un meme se hizo viral', c: 'f' },
  { t: 'Integrar IA directamente en Google Docs', c: 'c' },
  { t: 'Feedback directo y sin rodeos sobre tu idea', c: 'f' },
  { t: 'Buscar vuelos baratos para esta semana', c: 'c' },
  { t: 'Explorar noticias de tecnologia de las ultimas horas', c: 'f' },
  { t: 'Generar una imagen artistica con Aurora', c: 'f' },
  { t: 'Entender debates virales en X en tiempo real', c: 'f' },
  { t: 'Recordar conversaciones de sesiones anteriores', c: 'c' },
  { t: 'Opinion honesta sobre tu proyecto de startup', c: 'f' },
  { t: 'Resumir video de YouTube con su link', c: 'c' },
  { t: 'Analizar sentimiento de X sobre tu app', c: 'f' },
  { t: 'Pedir comida a domicilio desde el chat', c: 'c' },
  { t: 'Crear imagen de referencia para un proyecto', c: 'f' },
  { t: 'Investigar tema academico con fuentes verificadas', c: 'c' },
];

const MATCH_POOL: MatchPair[] = [
  { l: 'Acceso a X en tiempo real', r: 'Lee tweets y debates virales mientras responde' },
  { l: 'Modo divertido (fun mode)', r: 'Responde con humor y sin restricciones tipicas' },
  { l: 'Creado por xAI', r: 'Empresa de IA fundada por Elon Musk en 2023' },
  { l: 'Integrado en X Premium', r: 'Disponible para suscriptores de pago de X' },
  { l: 'Respuestas directas', r: 'Va al punto sin disculpas ni rodeos innecesarios' },
  { l: 'Aurora', r: 'Modelo de generacion de imagenes integrado en Grok' },
  { l: 'Codigo abierto (base)', r: 'Versiones base descargables y modificables' },
  { l: 'Cultura de internet', r: 'Entiende memes, jerga y humor de X nativamente' },
  { l: 'Analisis de sentimiento', r: 'Lee miles de posts para resumir la opinion del publico' },
  { l: 'Nombre Grok', r: 'Viene de novela sci-fi: entender algo muy profundamente' },
];

const GROK_SORT = [
  '<strong>Recibes el prompt:</strong> Haces una pregunta sobre tendencias o cultura de internet',
  '<strong>Consulta X en tiempo real:</strong> Analiza los posts mas recientes sobre tu tema',
  '<strong>Filtra el ruido:</strong> Distingue tendencias reales de bots o spam irrelevante',
  '<strong>Sintetiza con contexto:</strong> Combina lo de X con su conocimiento de entrenamiento',
  '<strong>Responde con estilo:</strong> Entrega la respuesta directa, con humor si lo pediste',
];

const QUIZ_POOL: QuizItem[] = [
  { q: 'Cual es la ventaja mas unica de Grok frente a Claude y Gemini?', o: ['Tiene la ventana de contexto mas grande', 'Acceso en tiempo real a X', 'Es completamente gratuito', 'Mejor capacidad para analisis cientifico'], c: 1, e: 'El acceso en tiempo real a X es su caracteristica mas distintiva.' },
  { q: 'Un estudiante en Tokio quiere saber por que un meme de IA es viral en X. Que LLM elige?', o: ['Claude', 'Gemini', 'Grok', 'ChatGPT'], c: 2, e: 'Grok entiende el humor y la jerga de internet como ninguno.' },
  { q: 'Que empresa creo a Grok?', o: ['OpenAI', 'xAI', 'X Corp', 'Tesla AI'], c: 1, e: 'xAI es una empresa independiente fundada por Elon Musk en 2023.' },
  { q: 'Para que tarea Grok es claramente inferior a Claude?', o: ['Entender tendencias en X', 'Analizar un ensayo literario de 50 paginas', 'Dar opinion directa', 'Explicar un meme viral'], c: 1, e: 'Claude tiene ventana de contexto superior para textos largos.' },
  { q: 'Que significa el modo divertido de Grok?', o: ['Genera juegos interactivos', 'Responde con humor y menos restricciones', 'Usa emojis automaticamente', 'Solo responde sobre entretenimiento'], c: 1, e: 'Fun mode permite sarcasmo e irreverencia sin cautelas excesivas.' },
  { q: 'Como se accede a Grok actualmente?', o: ['Completamente gratuito', 'Solo para empresas', 'Con suscripcion X Premium o grok.com', 'Descarga gratuita en iOS/Android'], c: 2, e: 'Principalmente con suscripcion X Premium y en grok.com.' },
  { q: 'Un emprendedor en Lagos quiere saber que opina X sobre su startup. Por que Grok?', o: ['Habla mas idiomas africanos', 'Puede leer tweets actuales y resumir sentimiento real', 'Tiene bases de datos privadas', 'Es el mas barato'], c: 1, e: 'Grok analiza la conversacion actual en X en tiempo real.' },
  { q: 'Que es Aurora en el ecosistema de Grok?', o: ['Modo oscuro', 'Modelo de generacion de imagenes', 'Sistema de busqueda web', 'CEO de xAI'], c: 1, e: 'Aurora es el generador de imagenes integrado en Grok.' },
  { q: 'Cual es una limitacion real de Grok comparado con Gemini?', o: ['No puede escribir texto', 'No tiene acceso a internet', 'No tiene integracion con Gmail/Docs/Sheets', 'Solo funciona en ingles'], c: 2, e: 'La integracion con Google es la ventaja de Gemini.' },
  { q: 'Por que el acceso a X es una limitacion a la vez que fortaleza?', o: ['X tiene virus', 'X solo representa a ciertos usuarios, no a toda la sociedad', 'X solo funciona en ingles', 'X es muy lento'], c: 1, e: 'La audiencia de X es especifica y sesgada.' },
  { q: 'Que significa que versiones base de Grok sean codigo abierto?', o: ['Uso sin conexion', 'Codigo fuente disponible para descargar y modificar', 'Sin restricciones', 'Suscripciones gratis para estudiantes'], c: 1, e: 'Codigo abierto: descargable y modificable por desarrolladores.' },
  { q: 'Cual es la diferencia entre Grok y Google para informacion actual?', o: ['Google da respuestas conversacionales', 'Grok lee X; Google indexa toda la web', 'Son iguales', 'Google no tiene info actual'], c: 1, e: 'Fuentes distintas: X vs toda la web.' },
];

const TF_POOL: TFItem[] = [
  { s: 'Grok puede leer y analizar tweets en tiempo real mientras te responde', c: true, e: 'El acceso a X en tiempo real es su caracteristica mas distintiva.' },
  { s: 'Grok fue creado por la misma empresa que desarrollo ChatGPT', c: false, e: 'ChatGPT es de OpenAI. Grok es de xAI.' },
  { s: 'Grok tiene un modo mas directo y con menos restricciones que Claude', c: true, e: 'Fun mode permite respuestas con humor sin cautelas excesivas.' },
  { s: 'Grok puede analizar documentos PDF de 100 paginas mejor que Claude', c: false, e: 'Claude tiene ventana de contexto superior.' },
  { s: 'Versiones base del codigo de Grok estan disponibles como codigo abierto', c: true, e: 'xAI publico versiones base como open source.' },
  { s: 'Grok puede generar imagenes directamente dentro del chat con Aurora', c: true, e: 'Aurora esta integrado en Grok.' },
  { s: 'Grok funciona perfectamente sin conexion a internet', c: false, e: 'El acceso a X requiere conexion.' },
  { s: 'Grok entiende el humor, la jerga y los memes de internet mejor que Claude', c: true, e: 'Entrenado con datos masivos de X.' },
  { s: 'El modo divertido de Grok hace que sus respuestas sean incorrectas', c: false, e: 'Cambia el tono, no la precision.' },
  { s: 'Grok es la mejor herramienta para investigacion academica con fuentes verificadas', c: false, e: 'Para fuentes verificadas, Gemini o Claude son mejores.' },
  { s: 'El nombre Grok viene de una novela de ciencia ficcion clasica', c: true, e: 'De Stranger in a Strange Land de Robert Heinlein.' },
  { s: 'Grok puede acceder directamente a tus archivos de Google Drive', c: false, e: 'Esa integracion es de Gemini.' },
  { s: 'Elon Musk fue cofundador de OpenAI antes de crear xAI', c: true, e: 'Musk cofundo OpenAI en 2015, salio en 2018.' },
  { s: 'Grok puede transcribir y resumir reuniones de Google Meet automaticamente', c: false, e: 'Esa capacidad es de Gemini.' },
];

const FILL_POOL: FillItem[] = [
  { s: 'La empresa que creo a Grok se llama _____.', o: ['xAI', 'OpenAI', 'X Corp', 'DeepMind'], c: 0, e: 'xAI es la empresa de IA fundada por Elon Musk en 2023.' },
  { s: 'La caracteristica mas unica de Grok es su acceso en tiempo real a la red social _____.', o: ['X', 'Google', 'YouTube', 'Reddit'], c: 0, e: 'X (antes Twitter) es su fuente de informacion en tiempo real.' },
  { s: 'El modo de respuesta de Grok con humor y menos restricciones se llama modo _____.', o: ['divertido', 'creativo', 'abierto', 'libre'], c: 0, e: 'Fun mode o modo divertido.' },
  { s: 'El modelo de generacion de imagenes integrado en Grok se llama _____.', o: ['Aurora', 'DALL-E', 'Imagen', 'Firefly'], c: 0, e: 'Aurora es el modelo de imagenes de xAI.' },
  { s: 'Una ventaja de Grok es que versiones base de su codigo son de acceso _____.', o: ['abierto', 'gratuito', 'premium', 'limitado'], c: 0, e: 'Codigo abierto (open source).' },
  { s: 'Grok fue disenado especialmente para entender memes, jerga y cultura de _____.', o: ['internet', 'peliculas', 'deportes', 'musica'], c: 0, e: 'Cultura de internet.' },
  { s: 'El nombre Grok significa entender algo de forma muy _____.', o: ['profunda', 'rapida', 'literal', 'amplia'], c: 0, e: 'En la novela de Heinlein, grok significa entender profundamente.' },
  { s: 'Cuando Grok analiza posts de X para conocer la opinion del publico, hace un analisis de _____.', o: ['sentimiento', 'contenido', 'frecuencia', 'popularidad'], c: 0, e: 'Analisis de sentimiento.' },
];

const PROMPT_POOL: PromptItem[] = [
  { t: 'Pedir a Grok analisis de tendencias en X sobre IA', bad: 'Busca en X los tweets de las ultimas 12 horas... dame todos los hashtags, usuarios mas activos, lista de tweets con mas likes y resumen de cada conversacion.', good: 'Busca en X las opiniones de las ultimas 6 horas sobre IA. Cuales son las 3 posturas mas repetidas? Resumen en 5 lineas.', e: 'Menos es mas cuando usas X en tiempo real.' },
  { t: 'Usar el modo directo de Grok para evaluar una idea de negocio', bad: 'Tengo 14 anos... dime si es viable, que estrategia de marketing, como conseguir inversores y que errores cometen las startups.', good: 'Tengo 14 anos y quiero crear una app... Dame tu opinion directa: cual es el problema mas critico que puede matar esta idea antes de lanzarla.', e: 'Una sola pregunta clave activa el modo directo de Grok.' },
  { t: 'Pedir a Grok que explique la cultura detras de un meme viral de X', bad: 'Explicame que significa, de donde viene, cuantos tweets tiene, quienes fueron los primeros...', good: 'Explicame que estan criticando realmente los usuarios y por que este formato conecta con la audiencia de X.', e: 'Grok entiende cultura de internet, no es un buscador de estadisticas exactas.' },
  { t: 'Investigar el sentimiento de X sobre un producto tecnologico', bad: 'Quiero las 3 quejas mas comunes, los 2 aspectos mas elogiados, si el sentimiento es positivo y que influencers hablan.', good: 'Identifica las 3 quejas mas repetidas y los 2 aspectos mas elogiados. Concluye si el sentimiento es positivo o negativo.', e: 'Ambos piden lo mismo pero el bueno es mas limpio.' },
  { t: 'Pedir a Grok que genere una imagen de personaje con Aurora', bad: 'Genera un personaje con ropa moderna, fondo urbano, colores vibrantes, estilo anime pero realista...', good: 'Genera con Aurora: estudiante de 15 anos con ropa streetwear, sentado en azotea urbana de noche, rodeado de pantallas flotantes. Estilo anime con iluminacion neon.', e: 'Especificidad del escenario y luz valen mas que lista de cualidades abstractas.' },
  { t: 'Usar Grok para entender un debate polarizado en X', bad: 'Resumeme el debate, explicame los dos lados, dime quien tiene razon, busca estudios...', good: 'Resume los 2 argumentos principales de cada lado tal como los expresan los usuarios de X ahora mismo. No me digas quien tiene razon.', e: 'Usa la fortaleza de Grok: capturar el debate en X, no ser juez.' },
];

const SCENARIO_POOL: ScenarioItem[] = [
  { ctx: 'Kenji, 13 anos, Osaka. Vio que un videojuego que le gusta esta siendo atacado en X pero no entiende por que.', ch: [{ lb: 'Usar Gemini', tx: 'Buscar en Google articulos sobre controversias', ok: false }, { lb: 'Usar Grok', tx: 'Leer los tweets actuales del debate para entender el contexto real', ok: true }, { lb: 'Usar Claude', tx: 'Pegar un articulo largo para analisis profundo', ok: false }], e: 'Grok es ideal: el debate esta en X ahora mismo.' },
  { ctx: 'Aisha, 14 anos, Lagos. Necesita datos actualizados de 2024 con fuentes verificables sobre contaminacion del mar.', ch: [{ lb: 'Usar Grok', tx: 'Buscar en X que dicen los usuarios', ok: false }, { lb: 'Usar Claude', tx: 'Analizar un paper cientifico largo', ok: false }, { lb: 'Usar Gemini', tx: 'Buscar estadisticas de 2024 en Google con fuentes academicas', ok: true }], e: 'Gemini: busqueda con fuentes verificables y citas.' },
  { ctx: 'Mateo, 12 anos, Buenos Aires. Esta escribiendo una novela de 10 capitulos y necesita personajes consistentes.', ch: [{ lb: 'Usar Grok', tx: 'Buscar en X tendencias de narrativa', ok: false }, { lb: 'Usar Claude', tx: 'Mantener toda la informacion de personajes en sesion para coherencia', ok: true }, { lb: 'Usar Gemini', tx: 'Integrar con Google Docs', ok: false }], e: 'Claude: ventana de contexto extensa para escritura creativa.' },
  { ctx: 'Zara, 13 anos, Londres. Quiere feedback honesto sobre su idea de negocio. Sus amigos solo le dicen que esta genial.', ch: [{ lb: 'Usar Gemini', tx: 'Buscar si ya existen apps similares', ok: false }, { lb: 'Usar Grok modo directo', tx: 'Pedirle feedback sin filtros sobre que puede fallar', ok: true }, { lb: 'Usar Claude', tx: 'Analizar el mercado en profundidad', ok: false }], e: 'Grok en modo directo: feedback honesto sin halagos.' },
  { ctx: 'Tomas, 14 anos, Lisboa. Necesita crear una imagen de un robot futurista para su presentacion.', ch: [{ lb: 'Usar Claude', tx: 'Describir el robot con detalle en texto', ok: false }, { lb: 'Usar Grok con Aurora', tx: 'Generar la imagen desde una descripcion detallada', ok: true }, { lb: 'Usar Gemini', tx: 'Buscar imagenes de robots en Google', ok: false }], e: 'Aurora crea imagenes desde texto directamente.' },
  { ctx: 'Priya, 12 anos, Mumbai. Hay un debate enorme esta semana sobre IA en escuelas. Quiere entender los dos lados.', ch: [{ lb: 'Usar Grok', tx: 'Analizar el debate en X de las ultimas 48 horas y resumir los dos lados', ok: true }, { lb: 'Usar Claude', tx: 'Explicar el debate de forma general', ok: false }, { lb: 'Usar Gemini', tx: 'Buscar articulos academicos sobre IA y educacion', ok: false }], e: 'Grok lee el debate actual en X en tiempo real.' },
];

const WB_POOL: WBItem[] = [
  { q: 'Cuales son los 3 rasgos principales que definen a Grok segun xAI?', cw: ['Directo y sin rodeos', 'Conectado a X en tiempo real', 'Con sentido del humor'], d: ['Anticuado y conservador', 'Sin acceso a internet', 'Muy formal y cauteloso', 'Lento para responder'] },
  { q: 'Cuales son 3 caracteristicas tecnicas que hacen unico a Grok entre los LLMs?', cw: ['Acceso a X en tiempo real', 'Modo divertido (fun mode)', 'Aurora para generar imagenes'], d: ['Integracion con Google Drive', 'Ventana de contexto infinita', 'Sin limites de ningun tipo'] },
  { q: 'Completa: Grok fue creado por ___, integrado con ___, y puede generar ___ con Aurora.', cw: ['xAI', 'X (Twitter)', 'imagenes'], d: ['Google', 'YouTube', 'videos', 'solo texto'] },
  { q: 'Cuales son 3 cosas que puede hacer Grok que lo diferencian claramente de Claude?', cw: ['Leer X en tiempo real', 'Generar imagenes con Aurora', 'Modo sin filtros conservadores'], d: ['Analizar PDFs muy largos', 'Integrar Google Docs', 'Recordar sesiones anteriores'] },
];

// ===================== COMPONENTE =====================
interface LevelProps {
  navigation?: any;
  setAllowBack?: (allow: boolean) => void;
}

export default function World4Level4({ navigation: propsNavigation, setAllowBack }: LevelProps) {
  const nav = useNavigation();
  const navigation = propsNavigation || nav;
  const completeLevel = useGameStore((s) => s.completeLevel);

  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);

  // Pools
  const [dragItems] = useState(() => pickN(DRAG_POOL, 10));
  const [matchPairs] = useState(() => pickN(MATCH_POOL, 4));
  const [quizItems] = useState(() => pickN(QUIZ_POOL, 4));
  const [tfItems] = useState(() => pickN(TF_POOL, 5));
  const [fillItems] = useState(() => pickN(FILL_POOL, 3));
  const [promptItems] = useState(() => {
    const items = pickN(PROMPT_POOL, 3);
    return items.map((it) => ({ ...it, _flip: Math.random() < 0.5 }));
  });
  const [scenarioItems] = useState(() => pickN(SCENARIO_POOL, 3));
  const [wbItem] = useState(() => {
    const wb = pickN(WB_POOL, 1)[0];
    const allWords = [...wb.cw, ...wb.d].sort(() => Math.random() - 0.5);
    return { ...wb, aw: allWords };
  });

  // Estados de módulos
  const [dragPlaced, setDragPlaced] = useState<Record<number, string>>({});
  const [dragSel, setDragSel] = useState<number | null>(null);
  const [dragAttempts, setDragAttempts] = useState(0);
  const [dragOk, setDragOk] = useState(false);

  const [matchLeft, setMatchLeft] = useState<number | null>(null);
  const [matchDone, setMatchDone] = useState(0);
  const [rightOrder] = useState(() => matchPairs.map((p) => p.r).sort(() => Math.random() - 0.5));

  const [sortOrder, setSortOrder] = useState<number[]>([]);
  const [sortOk, setSortOk] = useState(false);

  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizChecked, setQuizChecked] = useState(false);

  const [tfAnswers, setTfAnswers] = useState<Record<number, boolean>>({});
  const [tfChecked, setTfChecked] = useState(false);

  const [fillAnswers, setFillAnswers] = useState<Record<number, number>>({});
  const [fillChecked, setFillChecked] = useState(false);

  const [promptSels, setPromptSels] = useState<Record<number, string>>({});
  const [promptsChecked, setPromptsChecked] = useState(false);

  const [scenSel, setScenSel] = useState<(number | null)[]>([null, null, null]);
  const [scenDone, setScenDone] = useState<boolean[]>([false, false, false]);

  const [wbAnswer, setWbAnswer] = useState<{ w: string; i: number }[]>([]);
  const [wbChecked, setWbChecked] = useState(false);

  const [reflectVal, setReflectVal] = useState('');

  const examSteps = new Set([2, 5, 6, 8, 9, 10, 11, 13, 14, 16, 17]);
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
    if (step === 8) { const o = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5); setSortOrder(o); setSortOk(false); }
    if (step === 9) { setQuizAnswers({}); setQuizChecked(false); }
    if (step === 11) { setTfAnswers({}); setTfChecked(false); }
    if (step === 13) { setFillAnswers({}); setFillChecked(false); }
    if (step === 14) { setWbAnswer([]); setWbChecked(false); }
    if (step === 17) { setPromptSels({}); setPromptsChecked(false); }
    if (step === 2) { setDragPlaced({}); setDragSel(null); setDragAttempts(0); setDragOk(false); }
    if (step === 5) { setMatchLeft(null); setMatchDone(0); }
  }, [step]);

  const addXP = (n: number) => setXp((p) => p + n);
  const goNext = () => { if (step < TOTAL_STEPS - 1) setStep(step + 1); };
  const handleClose = () => Alert.alert('Salir', '¿Seguro?', [{ text: 'Cancelar' }, { text: 'Salir', onPress: () => router.back() }]);
  const handleFinish = () => {
    let stars = 0;
    if (xp >= 140) stars = 3; else if (xp >= 90) stars = 2; else if (xp >= 40) stars = 1;
    completeLevel(22, stars, xp);
    router.back();
  };

  // Drag
  const dropDrag = (idx: number, col: string) => { setDragPlaced((p) => ({ ...p, [idx]: col })); setDragSel(null); };
  const retDrag = (idx: number) => { setDragPlaced((p) => { const n = { ...p }; delete n[idx]; return n; }); };
  const checkDrag = () => {
    if (dragOk) return true;
    if (Object.keys(dragPlaced).length < dragItems.length) { Alert.alert('Faltan', 'Clasifica todas.'); return false; }
    setDragAttempts((p) => p + 1);
    let correct = 0; const wrong: number[] = [];
    Object.entries(dragPlaced).forEach(([k, v]) => { const i = parseInt(k); if (v === dragItems[i].c) correct++; else wrong.push(i); });
    if (correct === dragItems.length) {
      setDragOk(true); addXP(dragAttempts === 0 ? 20 : 12);
      Alert.alert('¡Perfecto!', `+${dragAttempts === 0 ? 20 : 12} XP`, [{ text: 'OK', onPress: goNext }]); return false;
    }
    Alert.alert('Revisa', `${correct}/${dragItems.length} correctas.`);
    const np = { ...dragPlaced }; wrong.forEach((i) => delete np[i]); setDragPlaced(np);
    return false;
  };

  // Matching
  const matchLeftClick = (i: number) => setMatchLeft(i);
  const matchRightClick = (i: number) => {
    if (matchLeft === null) return;
    if (rightOrder[i] === matchPairs[matchLeft].r) {
      const nd = matchDone + 1; setMatchDone(nd); setMatchLeft(null);
      if (nd >= matchPairs.length) addXP(15);
    } else { Alert.alert('Incorrecto'); setMatchLeft(null); }
  };

  // Sort
  const moveSort = (pos: number, dir: number) => {
    const np = pos + dir; if (np < 0 || np >= sortOrder.length) return;
    const no = [...sortOrder]; [no[pos], no[np]] = [no[np], no[pos]]; setSortOrder(no);
  };
  const checkSort = () => {
    if (sortOk) return true;
    if (sortOrder.every((v, i) => v === i)) { setSortOk(true); addXP(15); Alert.alert('¡Exacto!', '+15 XP', [{ text: 'OK', onPress: goNext }]); return false; }
    Alert.alert('Incorrecto', 'Algunos pasos fuera de lugar.'); return false;
  };

  // Quiz
  const selQuiz = (qi: number, oi: number) => { if (!quizChecked) setQuizAnswers((p) => ({ ...p, [qi]: oi })); };
  const checkQuiz = () => {
    if (quizChecked) return true;
    if (Object.keys(quizAnswers).length < quizItems.length) { Alert.alert('Incompleto'); return false; }
    setQuizChecked(true); let c = 0;
    quizItems.forEach((q, i) => { if (quizAnswers[i] === q.c) c++; });
    addXP(c * 8); Alert.alert(`${c}/${quizItems.length} correctas`, `+${c * 8} XP`, [{ text: 'OK', onPress: goNext }]); return false;
  };

  // TF
  const selTF = (qi: number, v: boolean) => { if (!tfChecked) setTfAnswers((p) => ({ ...p, [qi]: v })); };
  const checkTF = () => {
    if (tfChecked) return true;
    if (Object.keys(tfAnswers).length < tfItems.length) { Alert.alert('Incompleto'); return false; }
    setTfChecked(true); let c = 0;
    tfItems.forEach((q, i) => { if (tfAnswers[i] === q.c) c++; });
    addXP(c * 6); Alert.alert(`${c}/${tfItems.length} correctas`, `+${c * 6} XP`, [{ text: 'OK', onPress: goNext }]); return false;
  };

  // Fill
  const selFill = (qi: number, oi: number) => { if (!fillChecked) setFillAnswers((p) => ({ ...p, [qi]: oi })); };
  const checkFill = () => {
    if (fillChecked) return true;
    if (Object.keys(fillAnswers).length < fillItems.length) { Alert.alert('Incompleto'); return false; }
    setFillChecked(true); let c = 0;
    fillItems.forEach((q, i) => { if (fillAnswers[i] === q.c) c++; });
    addXP(c * 8); Alert.alert(`${c}/${fillItems.length} correctas`, `+${c * 8} XP`, [{ text: 'OK', onPress: goNext }]); return false;
  };

  // Scenario
  const selectScen = (si: number, ci: number) => { if (!scenDone[si]) setScenSel((p) => { const n = [...p]; n[si] = ci; return n; }); };
  const checkScen = (si: number) => {
    if (scenDone[si]) return true;
    if (scenSel[si] === null) { Alert.alert('Elige una opción'); return false; }
    setScenDone((p) => { const n = [...p]; n[si] = true; return n; });
    const sc = scenarioItems[si];
    if (sc.ch[scenSel[si]!].ok) addXP(10);
    return false;
  };

  // Word Builder
  const addWB = (w: string, i: number) => {
    if (wbChecked || wbAnswer.some((a) => a.i === i)) return;
    setWbAnswer((p) => [...p, { w, i }]);
  };
  const removeWB = (i: number) => setWbAnswer((p) => p.filter((a) => a.i !== i));
  const checkWB = () => {
    if (wbChecked) return true;
    if (wbAnswer.length < wbItem.cw.length) { Alert.alert('Selecciona todas las correctas'); return false; }
    setWbChecked(true);
    const sel = wbAnswer.map((a) => a.w).sort();
    const correct = [...wbItem.cw].sort();
    if (sel.length === correct.length && sel.every((v, i) => v === correct[i])) { addXP(15); Alert.alert('¡Correcto! +15 XP'); }
    else Alert.alert('No todas correctas', `Correctas: ${wbItem.cw.join(', ')}`);
    return false;
  };

  // Prompts
  const selPrompt = (qi: number, which: string) => { if (!promptsChecked) setPromptSels((p) => ({ ...p, [qi]: which })); };
  const checkPrompts = () => {
    if (promptsChecked) return true;
    if (Object.keys(promptSels).length < promptItems.length) { Alert.alert('Incompleto'); return false; }
    setPromptsChecked(true); let c = 0;
    promptItems.forEach((item, i) => {
      const goodKey = item._flip ? 'good' : 'bad';
      const badKey = item._flip ? 'bad' : 'good';
      // El "good" siempre es el correcto, pero está en posición aleatoria
      if (promptSels[i] === goodKey) c++;
    });
    addXP(c * 10); Alert.alert(`${c}/${promptItems.length} correctas`, `+${c * 10} XP`, [{ text: 'OK', onPress: goNext }]); return false;
  };

  // Reflexión
  const checkReflect = () => { if (reflectVal.trim().length >= 70) { addXP(15); return true; } Alert.alert('Mínimo 70 caracteres'); return false; };

  // ============ RENDER ============
  const renderIntro = () => (
    <View>
      <View style={styles.iconCircle}><Text style={{ fontSize: 34 }}>⚡</Text></View>
      <Text style={styles.title}>Grok - La IA con personalidad propia</Text>
      <Text style={styles.subtitle}>Conoce al más irreverente: sin filtros innecesarios, conectado a X en tiempo real, capaz de generarte imágenes con Aurora.</Text>
      <View style={styles.card}><Text style={styles.cardTitle}>📚 Qué vas a aprender</Text><Text style={styles.cardText}>xAI · Acceso a X · Modo directo y fun mode · Aurora para imágenes · Cuándo usar Grok vs Claude vs Gemini</Text></View>
      <View style={styles.card}><Text style={styles.cardTitle}>🎲 Preguntas aleatorias</Text><Text style={styles.cardText}>Este nivel selecciona preguntas diferentes cada vez que lo abres.</Text></View>
    </View>
  );

  const renderTheory1 = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#eef2ff' }]}><Text style={[styles.tagText, { color: '#4338ca' }]}>Nivel 22 · 20 módulos</Text></View>
      <View style={[styles.tag, { backgroundColor: '#f0fdf4' }]}><Text style={[styles.tagText, { color: '#166534' }]}>📖 Módulo 1 · Teoría</Text></View>
      <Text style={styles.title}>xAI y el origen de Grok</Text>
      <Text style={styles.bodyText}>En 2023, Elon Musk fundó <Text style={{ fontWeight: 'bold' }}>xAI</Text> con una promesa: IA que dijera la verdad sin censura innecesaria, conectada al mundo real.</Text>
      <View style={styles.card}><Text style={styles.cardTitle}>⚡ xAI</Text><Text style={styles.cardText}>Fundada en julio 2023, San Francisco. Grok viene de una novela de ciencia ficción: entender algo tan profundamente que se convierte en parte de ti.</Text></View>
      <Text style={styles.bodyText}>Los 3 rasgos: Directo y sin rodeos · Conectado a X en tiempo real · Con sentido del humor.</Text>
    </View>
  );

  const renderDrag = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#e6faf3' }]}><Text style={[styles.tagText, { color: '#065f46' }]}>🎯 Módulo 2 · Clasificar</Text></View>
      <Text style={styles.title}>¿Cuándo Grok brilla y cuándo no?</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {dragItems.map((item, idx) => (
          dragPlaced[idx] === undefined && (
            <TouchableOpacity key={idx} style={[styles.chip, dragSel === idx && { borderColor: '#00ba7c', backgroundColor: '#e6faf3' }]} onPress={() => setDragSel(dragSel === idx ? null : idx)}>
              <Text style={{ fontSize: 11 }}>{item.t}</Text>
            </TouchableOpacity>
          )
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['f', 'c'] as const).map((col) => (
          <TouchableOpacity key={col} style={[styles.dropCol, { flex: 1 }]} onPress={() => { if (dragSel !== null) dropDrag(dragSel, col); }}>
            <Text style={{ fontWeight: 'bold', fontSize: 11, color: col === 'f' ? '#065f46' : '#991b1b' }}>{col === 'f' ? '⚡ Fortaleza' : '⚠️ Usa otra'}</Text>
            {Object.entries(dragPlaced).filter(([, v]) => v === col).map(([k]) => (
              <TouchableOpacity key={k} style={{ backgroundColor: col === 'f' ? '#ecfdf5' : '#fef2f2', padding: 4, borderRadius: 8, marginTop: 4 }} onPress={() => retDrag(parseInt(k))}>
                <Text style={{ fontSize: 10 }}>{dragItems[parseInt(k)].t} ✕</Text>
              </TouchableOpacity>
            ))}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderExamples = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fff7ed' }]}><Text style={[styles.tagText, { color: '#9a3412' }]}>🌍 Módulo 3 · Casos reales</Text></View>
      <Text style={styles.title}>Grok en el mundo real</Text>
      {['📷 Niran, Bangkok: detectar tendencias virales para su canal', '💡 Emma, Ámsterdam: feedback honesto sobre su startup', '🎨 Amahle, Johannesburgo: crear imágenes de referencia con Aurora'].map((t, i) => <View key={i} style={styles.card}><Text style={styles.cardText}>{t}</Text></View>)}
    </View>
  );

  const renderTheory2 = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#f0fdf4' }]}><Text style={[styles.tagText, { color: '#166534' }]}>📖 Módulo 4 · Teoría</Text></View>
      <Text style={styles.title}>El superpoder: leer X en tiempo real</Text>
      <Text style={styles.bodyText}>Claude y ChatGPT saben lo que aprendieron hace meses. Grok puede leer X ahora mismo.</Text>
    </View>
  );

  const renderMatching = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#e6faf3' }]}><Text style={[styles.tagText, { color: '#065f46' }]}>🔗 Módulo 5 · Conectar</Text></View>
      <Text style={styles.title}>Características de Grok</Text>
      <View style={{ flexDirection: 'row', gap: 5 }}>
        <View style={{ flex: 1 }}>
          {matchPairs.map((p, i) => (
            <TouchableOpacity key={i} style={[styles.matchItem, matchLeft === i && { borderColor: '#00ba7c', backgroundColor: '#e6faf3' }]} onPress={() => matchLeftClick(i)}>
              <Text style={{ fontSize: 11 }}>{p.l}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ flex: 1 }}>
          {rightOrder.map((r, i) => (
            <TouchableOpacity key={i} style={[styles.matchItem]} onPress={() => matchRightClick(i)}>
              <Text style={{ fontSize: 10 }}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {matchDone >= matchPairs.length && <Text style={{ textAlign: 'center', color: '#166534' }}>✅ +15 XP</Text>}
    </View>
  );

  const renderScenario = (si: number) => {
    const sc = scenarioItems[si];
    return (
      <View>
        <View style={[styles.tag, { backgroundColor: '#fef3c7' }]}><Text style={[styles.tagText, { color: '#92400e' }]}>🎯 Módulo {6 + si * 5} · Escenario</Text></View>
        <Text style={styles.title}>¿Qué herramienta elige?</Text>
        <View style={[styles.card, { backgroundColor: '#f8fafc' }]}><Text style={{ fontSize: 13, fontWeight: '500' }}>{sc.ctx}</Text></View>
        {sc.ch.map((c, ci) => (
          <TouchableOpacity key={ci} style={[styles.optionBtn, scenSel[si] === ci && { borderColor: '#00ba7c', backgroundColor: '#e6faf3' }]} onPress={() => selectScen(si, ci)} disabled={scenDone[si]}>
            <Text style={{ fontWeight: 'bold', fontSize: 11 }}>{c.lb}</Text>
            <Text style={{ fontSize: 11, color: '#6b7280' }}>{c.tx}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderTheory3 = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#f0fdf4' }]}><Text style={[styles.tagText, { color: '#166534' }]}>📖 Módulo 7 · Teoría</Text></View>
      <Text style={styles.title}>Los dos modos de Grok</Text>
      <View style={styles.card}><Text style={styles.cardTitle}>Modo Normal</Text><Text style={styles.cardText}>Directo pero balanceado. Bueno para la mayoría de tareas.</Text></View>
      <View style={styles.card}><Text style={styles.cardTitle}>Modo Divertido (Fun Mode)</Text><Text style={styles.cardText}>Irreverente, con humor y sarcasmo. Menos restricciones conservadoras.</Text></View>
    </View>
  );

  const renderSort = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#e6faf3' }]}><Text style={[styles.tagText, { color: '#065f46' }]}>↕️ Módulo 8 · Ordenar</Text></View>
      <Text style={styles.title}>¿Cómo procesa Grok una pregunta sobre tendencias?</Text>
      {sortOrder.map((stepIdx, pos) => (
        <View key={pos} style={styles.sortItem}>
          <Text style={styles.sortNum}>{pos + 1}</Text>
          <Text style={styles.sortText}>{GROK_SORT[stepIdx].replace(/<[^>]+>/g, '')}</Text>
          <View style={styles.sortArrows}>
            <TouchableOpacity style={styles.sortBtn} onPress={() => moveSort(pos, -1)} disabled={pos === 0}><MaterialIcons name="keyboard-arrow-up" size={18} /></TouchableOpacity>
            <TouchableOpacity style={styles.sortBtn} onPress={() => moveSort(pos, 1)} disabled={pos === sortOrder.length - 1}><MaterialIcons name="keyboard-arrow-down" size={18} /></TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );

  const renderQuiz = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fef3c7' }]}><Text style={[styles.tagText, { color: '#92400e' }]}>🧠 Módulo 9 · Quiz</Text></View>
      <Text style={styles.title}>Demuestra lo que sabes</Text>
      {quizItems.map((q, qi) => (
        <View key={qi} style={{ marginBottom: 14 }}>
          <Text style={styles.quizQ}>{q.q}</Text>
          {q.o.map((opt, oi) => (
            <TouchableOpacity key={oi} style={[styles.quizOpt, quizAnswers[qi] === oi && { borderColor: '#00ba7c', backgroundColor: '#e6faf3' }]} onPress={() => selQuiz(qi, oi)} disabled={quizChecked}>
              <Text style={styles.quizLetter}>{String.fromCharCode(65 + oi)}</Text>
              <Text style={{ flex: 1, fontSize: 12 }}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );

  const renderTF = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fef3c7' }]}><Text style={[styles.tagText, { color: '#92400e' }]}>✓✗ Módulo 11 · V/F</Text></View>
      <Text style={styles.title}>¿Verdadero o Falso?</Text>
      {tfItems.map((item, idx) => (
        <View key={idx} style={{ marginBottom: 14 }}>
          <Text style={styles.tfQuestion}>{item.s}</Text>
          <View style={{ flexDirection: 'row', gap: 7 }}>
            <TouchableOpacity style={[styles.tfBtn, tfAnswers[idx] === true && { borderColor: '#16a34a', backgroundColor: '#f0fdf4' }]} onPress={() => selTF(idx, true)} disabled={tfChecked}><Text>✅ V</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.tfBtn, tfAnswers[idx] === false && { borderColor: '#dc2626', backgroundColor: '#fef2f2' }]} onPress={() => selTF(idx, false)} disabled={tfChecked}><Text>❌ F</Text></TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );

  const renderTheory4 = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#f0fdf4' }]}><Text style={[styles.tagText, { color: '#166534' }]}>📖 Módulo 12 · Teoría</Text></View>
      <Text style={styles.title}>Aurora y ética</Text>
      <Text style={styles.bodyText}>Aurora es el generador de imágenes integrado en Grok. Menos filtros no significa sin ética.</Text>
    </View>
  );

  const renderFill = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#e6faf3' }]}><Text style={[styles.tagText, { color: '#065f46' }]}>📝 Módulo 13 · Vocabulario</Text></View>
      <Text style={styles.title}>Completa las frases</Text>
      {fillItems.map((q, qi) => (
        <View key={qi} style={{ marginBottom: 14 }}>
          <Text style={{ fontSize: 13, lineHeight: 24, marginBottom: 8 }}>{q.s.replace('_____', fillAnswers[qi] !== undefined ? q.o[fillAnswers[qi]] : '_____')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {q.o.map((opt, oi) => (
              <TouchableOpacity key={oi} style={[styles.fillOpt, fillAnswers[qi] === oi && { borderColor: '#00ba7c', backgroundColor: '#e6faf3' }]} onPress={() => selFill(qi, oi)} disabled={fillChecked}>
                <Text style={{ fontSize: 12 }}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
    </View>
  );

  const renderWB = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#e6faf3' }]}><Text style={[styles.tagText, { color: '#065f46' }]}>🧩 Módulo 14 · Construir</Text></View>
      <Text style={styles.title}>Selecciona las respuestas correctas</Text>
      <View style={[styles.card, { backgroundColor: '#f0fdf4' }]}><Text style={{ fontWeight: 'bold' }}>{wbItem.q}</Text></View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {wbItem.aw.map((w, i) => (
          <TouchableOpacity key={i} style={[styles.wordTile, wbAnswer.some((a) => a.i === i) && { opacity: 0.3 }]} onPress={() => addWB(w, i)} disabled={wbAnswer.some((a) => a.i === i) || wbChecked}>
            <Text style={{ fontSize: 12 }}>{w}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, minHeight: 40, padding: 8, borderWidth: 2, borderStyle: 'dashed', borderColor: wbAnswer.length > 0 ? '#00ba7c' : '#d1d5db', borderRadius: 12 }}>
        {wbAnswer.map((a) => (
          <TouchableOpacity key={a.i} style={{ backgroundColor: '#00ba7c', padding: 8, borderRadius: 16 }} onPress={() => removeWB(a.i)}>
            <Text style={{ color: '#fff', fontSize: 12 }}>{a.w} ✕</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderTheory5 = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#f0fdf4' }]}><Text style={[styles.tagText, { color: '#166534' }]}>📖 Módulo 15 · Teoría</Text></View>
      <Text style={styles.title}>Grok vs Claude vs Gemini</Text>
      <Text style={styles.bodyText}>⚡ Grok: tendencias X, feedback directo, Aurora. ⭐ Claude: textos largos, análisis profundo. ✦ Gemini: ecosistema Google, fuentes verificables.</Text>
    </View>
  );

  const renderPrompts = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#e6faf3' }]}><Text style={[styles.tagText, { color: '#065f46' }]}>🔍 Módulo 17 · Prompts</Text></View>
      <Text style={styles.title}>¿Cuál prompt activa lo mejor de Grok?</Text>
      {promptItems.map((item, qi) => {
        const aKey = item._flip ? 'good' : 'bad';
        const bKey = item._flip ? 'bad' : 'good';
        return (
          <View key={qi} style={{ marginBottom: 16 }}>
            <Text style={{ fontWeight: 'bold', fontSize: 12, marginBottom: 6 }}>🎯 {item.t}</Text>
            <TouchableOpacity style={[styles.promptCard, promptSels[qi] === aKey && { borderColor: '#00ba7c', backgroundColor: '#e6faf3' }]} onPress={() => selPrompt(qi, aKey)} disabled={promptsChecked}>
              <Text style={{ fontWeight: 'bold', fontSize: 10, marginBottom: 4 }}>PROMPT A</Text>
              <Text style={{ fontSize: 11 }}>{item[aKey]}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.promptCard, promptSels[qi] === bKey && { borderColor: '#00ba7c', backgroundColor: '#e6faf3' }]} onPress={() => selPrompt(qi, bKey)} disabled={promptsChecked}>
              <Text style={{ fontWeight: 'bold', fontSize: 10, marginBottom: 4 }}>PROMPT B</Text>
              <Text style={{ fontSize: 11 }}>{item[bKey]}</Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );

  const renderBonus = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fce7f3' }]}><Text style={[styles.tagText, { color: '#9d174d' }]}>🚀 Módulo 18 · Bonus</Text></View>
      <Text style={styles.title}>Hacia dónde va Grok</Text>
      <Text style={styles.bodyText}>xAI crece rápido: video, robots físicos, integración total con X, código abierto.</Text>
    </View>
  );

  const renderCase = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fff7ed' }]}><Text style={[styles.tagText, { color: '#9a3412' }]}>📖 Módulo 19 · Caso real</Text></View>
      <Text style={styles.title}>Kofi necesita entender el mercado de su app</Text>
      <Text style={styles.bodyText}>Kofi, 14 años, Accra. Usó Grok para investigar tendencias en X, validar su idea con modo directo y hacer análisis competitivo. 2 horas y $0.</Text>
    </View>
  );

  const renderReflect = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#f3f4f6' }]}><Text style={[styles.tagText, { color: '#374151' }]}>✍️ Módulo 20 · Reflexión</Text></View>
      <Text style={styles.title}>¿Qué lugar tiene Grok en tu kit?</Text>
      <TextInput style={styles.textArea} multiline placeholder="1. Una situación donde Grok sea la mejor opción y por qué. 2. Una situación donde NO usarías Grok..." value={reflectVal} onChangeText={setReflectVal} />
      <Text style={{ fontSize: 11, color: '#9ca3af', textAlign: 'right' }}>{reflectVal.length} / 70 mín.</Text>
    </View>
  );

  const renderComplete = () => (
    <View style={{ alignItems: 'center', padding: 20 }}>
      <Text style={{ fontSize: 44 }}>⚡</Text>
      <Text style={[styles.title, { textAlign: 'center' }]}>¡Nivel 22 completado!</Text>
      <Text style={styles.subtitle}>Ya dominas los tres LLMs principales: Claude, Gemini y Grok.</Text>
      <Text style={{ fontWeight: 'bold', fontSize: 15, color: '#854d0e', marginBottom: 14 }}>⭐ {xp} XP</Text>
      <TouchableOpacity style={styles.finishBtn} onPress={handleFinish}><Text style={{ color: '#fff', fontWeight: 'bold' }}>Volver al mapa</Text></TouchableOpacity>
    </View>
  );

  // ============ RENDER PRINCIPAL ============
  const renderStep = () => {
    switch (step) {
      case 0: return renderIntro();
      case 1: return renderTheory1();
      case 2: return renderDrag();
      case 3: return renderExamples();
      case 4: return renderTheory2();
      case 5: return renderMatching();
      case 6: return renderScenario(0);
      case 7: return renderTheory3();
      case 8: return renderSort();
      case 9: return renderQuiz();
      case 10: return renderScenario(1);
      case 11: return renderTF();
      case 12: return renderTheory4();
      case 13: return renderFill();
      case 14: return renderWB();
      case 15: return renderTheory5();
      case 16: return renderScenario(2);
      case 17: return renderPrompts();
      case 18: return renderBonus();
      case 19: return renderCase();
      case 20: return renderReflect();
      case 21: return renderComplete();
      default: return null;
    }
  };

  const progress = (step / (TOTAL_STEPS - 1)) * 100;
  const handleMain = () => {
    const handlers: Record<number, (() => boolean) | undefined> = {
      2: checkDrag,
      5: () => matchDone >= matchPairs.length,
      6: () => checkScen(0),
      8: checkSort,
      9: checkQuiz,
      10: () => checkScen(1),
      11: checkTF,
      13: checkFill,
      14: checkWB,
      16: () => checkScen(2),
      17: checkPrompts,
      20: checkReflect,
    };
    const h = handlers[step];
    if (h) { if (!h()) return; }
    goNext();
  };

  const showNext = step < TOTAL_STEPS - 1 && ![2, 5, 6, 8, 9, 10, 11, 13, 14, 16, 17, 20].includes(step);
  const showCheck = [2, 5, 6, 8, 9, 10, 11, 13, 14, 16, 17, 20].includes(step) && step < TOTAL_STEPS - 1;

  return (
    <View style={styles.screen}>
      <View style={styles.progressBar}>
        <TouchableOpacity onPress={() => router.back()}><MaterialIcons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
        <Text style={styles.xpText}>{xp} XP</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>{renderStep()}</ScrollView>
      {showNext && <TouchableOpacity style={styles.nextBtn} onPress={goNext}><Text style={styles.nextText}>Continuar →</Text></TouchableOpacity>}
      {showCheck && <TouchableOpacity style={styles.nextBtn} onPress={handleMain}><Text style={styles.nextText}>{step === 5 || step === 6 || step === 10 || step === 16 ? 'Verificar' : step === 14 ? 'Verificar respuesta' : step === 20 ? 'Enviar reflexión' : 'Comprobar'}</Text></TouchableOpacity>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  progressBar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  progressTrack: { flex: 1, height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, marginHorizontal: 12 },
  progressFill: { height: '100%', backgroundColor: '#00ba7c', borderRadius: 3 },
  xpText: { fontWeight: 'bold', fontSize: 14, color: '#854d0e' },
  scroll: { padding: 16, paddingBottom: 40 },
  tag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 12 },
  tagText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  iconCircle: { width: 60, height: 60, borderRadius: 18, backgroundColor: '#e6faf3', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  title: { ...typography.extraBold, fontSize: 19, color: '#111827', marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#6b7280', marginBottom: 14, lineHeight: 18 },
  bodyText: { fontSize: 13, color: '#374151', lineHeight: 20, marginBottom: 12 },
  card: { backgroundColor: '#f9fafb', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  cardTitle: { fontWeight: 'bold', fontSize: 13, color: '#111827', marginBottom: 4 },
  cardText: { fontSize: 13, color: '#374151', lineHeight: 20 },
  chip: { padding: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#d1d5db', backgroundColor: '#fff', marginBottom: 4 },
  dropCol: { borderWidth: 2, borderStyle: 'dashed', borderColor: '#d1d5db', borderRadius: 12, padding: 8, minHeight: 60 },
  matchItem: { padding: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#e5e7eb', marginBottom: 4, minHeight: 50, justifyContent: 'center', backgroundColor: '#fff' },
  sortItem: { flexDirection: 'row', alignItems: 'center', padding: 11, backgroundColor: '#f9fafb', borderRadius: 12, borderWidth: 1.5, borderColor: '#e5e7eb', marginBottom: 8 },
  sortNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#00ba7c', textAlign: 'center', lineHeight: 26, color: '#fff', fontWeight: 'bold', fontSize: 11, marginRight: 9 },
  sortText: { flex: 1, fontSize: 12, color: '#374151' },
  sortArrows: { flexDirection: 'column', gap: 3 },
  sortBtn: { width: 28, height: 26, borderRadius: 7, borderWidth: 1, borderColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center' },
  quizQ: { fontWeight: 'bold', fontSize: 13, padding: 11, backgroundColor: '#f9fafb', borderRadius: 10, marginBottom: 8 },
  quizOpt: { flexDirection: 'row', alignItems: 'center', padding: 10, borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10, marginBottom: 6, gap: 9 },
  quizLetter: { width: 22, height: 22, borderRadius: 6, backgroundColor: '#f3f4f6', textAlign: 'center', lineHeight: 22, fontSize: 10, fontWeight: 'bold' },
  tfQuestion: { fontWeight: 'bold', fontSize: 13, padding: 11, backgroundColor: '#f9fafb', borderRadius: 10, marginBottom: 8 },
  tfBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 2, borderColor: '#e5e7eb', alignItems: 'center' },
  fillOpt: { padding: 8, borderRadius: 10, borderWidth: 1.5, borderColor: '#d1d5db', backgroundColor: '#fff' },
  wordTile: { padding: 8, borderRadius: 16, borderWidth: 2, borderColor: '#d1d5db', backgroundColor: '#fff' },
  optionBtn: { padding: 12, borderRadius: 12, borderWidth: 2, borderColor: '#e5e7eb', marginBottom: 8 },
  promptCard: { padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#e5e7eb', marginBottom: 8, backgroundColor: '#fff' },
  textArea: { borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 13, minHeight: 100, textAlignVertical: 'top', marginBottom: 8 },
  nextBtn: { backgroundColor: '#00ba7c', padding: 14, margin: 16, borderRadius: 11, alignItems: 'center' },
  nextText: { fontWeight: 'bold', color: '#fff', fontSize: 15 },
  finishBtn: { backgroundColor: '#00ba7c', padding: 14, borderRadius: 11, width: '100%', alignItems: 'center' },
});