import { useState, useEffect, useRef, type ReactNode } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  Alert, BackHandler, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useGameStore } from '../../store/gameStore';
import { useReportProgress } from '../../components/LevelProgress';
import { typography } from '../../theme';
import { exitLevel } from '../../utils/exitLevel';
import XPToast from '../../components/XPToast';

// ===================== PALETA (hex exactos del HTML eval-mundo3, tema oscuro degradado M3) =====================
const C = {
  bg: '#060010', surface: '#0e0018', card: '#160022', card2: '#1e002e',
  text: '#fdf4ff', muted: '#c084fc', border: '#3d006a',
  grad1: '#e91e8c', grad2: '#9333ea', grad3: '#3b82f6', grad4: '#06b6d4',
  fuchsiaLight: '#f0abfc',
  green2: '#22c55e', okBg: '#052e16', okBorder: '#16a34a', okText: '#86efac',
  red: '#ef4444', failBg: '#2d0707', failBorder: '#dc2626', failText: '#fca5a5',
  placeholder: '#7a5090',
};

// ===================== HELPERS =====================
const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function looksRandom(text: string): boolean {
  const words = normalize(text).split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return true;
  const noVowels = words.filter(w => w.length >= 4 && !/[aeiou]/.test(w));
  if (noVowels.length >= Math.max(1, Math.floor(words.length / 2))) return true;
  if (words.length >= 4) {
    const unique = new Set(words);
    if (unique.size / words.length < 0.5) return true;
  }
  return false;
}
function containsTopic(text: string, terms: string[]): boolean {
  const t = normalize(text);
  return terms.some(term => term.length <= 3 ? new RegExp(`\\b${term}\\b`).test(t) : t.includes(term));
}
const PIPELINE_TERMS = ['imagen', 'foto', 'audio', 'voz', 'video', 'web', 'app', 'herramienta', 'paso', 'genera', 'crear', 'crea', 'proyecto', 'publica', 'dall', 'suno', 'runway', 'pika', 'sora', 'eleven', 'lovable', 'idea', 'combina', 'narra'];
const REFLECT_TERMS = ['ia', 'crear', 'crea', 'crearia', 'mundo', 'imagen', 'audio', 'video', 'web', 'datos', 'multimodal', 'herramienta', 'herramientas', 'aprend', 'sorprend', 'imposible', 'creativ', 'proyecto', 'usar'];

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let j = a.length - 1; j > 0; j--) {
    const k = Math.floor(Math.random() * (j + 1));
    [a[j], a[k]] = [a[k], a[j]];
  }
  return a;
}
function shuffleOpts<T extends { opts: string[]; c: number }>(q: T): T {
  const paired = q.opts.map((opt, i) => ({ opt, isCorrect: i === q.c }));
  const sh = shuffle(paired);
  return { ...q, opts: sh.map(p => p.opt), c: sh.findIndex(p => p.isCorrect) };
}

// ===================== DATOS (fieles al HTML eval-mundo3, opciones balanceadas en longitud) =====================
type QuizQ = { q: string; opts: string[]; c: number; fb: string };
const QUIZ_POOL: QuizQ[] = [
  { q: '¿Cómo se llama el proceso que usan IAs como DALL-E para generar imágenes partiendo de "ruido" aleatorio?', opts: ['Compresión progresiva de los píxeles', 'Diffusion: va limpiando el ruido poco a poco', 'Mapeo directo de texto a píxeles', 'Renderizado neuronal por capas'], c: 1, fb: 'El proceso "diffusion" parte de ruido aleatorio y lo va "limpiando" guiado por tu descripción hasta crear una imagen coherente.' },
  { q: '¿Qué hace exactamente Whisper, de OpenAI?', opts: ['Genera música original a partir de texto', 'Convierte el audio hablado en texto escrito', 'Clona voces humanas para hacer audiolibros', 'Traduce idiomas en tiempo real con voz'], c: 1, fb: 'Whisper es un modelo de transcripción: convierte voz en texto con alta precisión en múltiples idiomas.' },
  { q: 'Sora (OpenAI) es conocida principalmente por:', opts: ['Generar imágenes fotorrealistas desde texto', 'Generar videos de alta calidad desde texto', 'Analizar documentos PDF muy extensos', 'Clonar voces con un minuto de audio'], c: 1, fb: 'Sora genera videos — es el modelo de generación de video de OpenAI presentado en 2024.' },
  { q: '¿Qué significa que una herramienta web sea "no-code"?', opts: ['Que no necesita conexión a internet para nada', 'Que describes la app y la IA escribe el código', 'Que solo sirve para hacer sitios de noticias', 'Que el código generado queda siempre oculto'], c: 1, fb: 'No-code significa que describes lo que quieres en lenguaje normal y la herramienta genera el código por ti.' },
  { q: 'NotebookLM se diferencia de ChatGPT sobre todo porque:', opts: ['Solo funciona en inglés y no en español', 'Responde solo con los documentos que tú le das', 'Además del texto, genera imágenes y videos', 'Es más barato que las demás IA del mercado'], c: 1, fb: 'NotebookLM solo responde basándose en los documentos que tú cargas, citando exactamente de dónde saca cada respuesta.' },
  { q: '¿Qué gráfica es mejor para mostrar cómo cambia la temperatura de una ciudad mes a mes durante un año?', opts: ['Gráfica de pie (porciones de un total)', 'Gráfica de líneas (evolución en el tiempo)', 'Diagrama de dispersión (dos variables)', 'Gráfica de barras (comparar categorías)'], c: 1, fb: 'Las líneas conectan puntos en el tiempo y hacen visible si hay tendencias al alza, a la baja o ciclos repetitivos.' },
  { q: 'La multimodalidad en una IA significa que:', opts: ['Puede responder en varios idiomas a la vez', 'Procesa y genera texto, imagen, audio y video', 'Tiene varias personalidades según el tema', 'Se conecta a varias páginas web a la vez'], c: 1, fb: 'Multimodal = múltiples modalidades de datos. Puede ver imágenes, escuchar audio, leer texto y generar cualquiera de esos formatos.' },
  { q: '¿Cuál es la señal más típica de una imagen generada por IA?', opts: ['Los colores son más brillantes que en fotos reales', 'Las manos con dedos deformes, de más o de menos', 'El fondo siempre aparece artificialmente borroso', 'Los textos dentro de la imagen se leen perfectos'], c: 1, fb: 'Las IAs generativas han tenido históricamente problemas para generar manos correctas. Es la señal más reconocible.' },
  { q: 'Un "pipeline multimodal" es:', opts: ['Una tubería inteligente para ciudades del futuro', 'Un flujo donde la salida de una IA alimenta a otra', 'Un programa que conecta tus redes sociales', 'Un sistema que traduce código de programación'], c: 1, fb: 'Un pipeline conecta herramientas en secuencia: texto → imagen → video → voz → web.' },
  { q: '¿Qué hace ElevenLabs con solo 1-3 minutos de audio de una persona?', opts: ['Transcribe automáticamente lo que dijo esa persona', 'Crea un clon de voz casi idéntico al original', 'Genera un video de esa persona hablando', 'Detecta las emociones presentes en su voz'], c: 1, fb: 'ElevenLabs es líder en clonación de voz. Con muy poco audio de muestra puede replicar la voz de una persona.' },
  { q: '¿Cuál de estos es un uso PROBLEMÁTICO de la clonación de voz?', opts: ['Un autor narra su propia novela con su voz clonada', 'Una empresa hace llamadas falsas del banco para robarte datos', 'Un estudiante con parálisis usa su voz para comunicarse', 'Una editorial narra libros de dominio público con IA'], c: 1, fb: 'Usar voz clonada para engañar y cometer fraude es ilegal en muchos países y causa daño real a las personas.' },
  { q: 'Que dos variables "correlacionen" en unos datos significa:', opts: ['Que una variable causa directamente a la otra', 'Que cambian juntas, pero una no causa a la otra', 'Que los datos fueron mal recolectados o medidos', 'Que las dos variables son totalmente independientes'], c: 1, fb: 'Correlación ≠ causalidad. El consumo de helados y los ahogamientos en verano correlacionan, pero el calor causa ambos.' },
  { q: 'GPT-4o (la "o" de "omni") se distingue sobre todo por:', opts: ['Ser completamente gratis y sin límites de uso', 'Manejar texto, imagen y audio con muy poca latencia', 'Ser la primera IA capaz de escribir código', 'Estar disponible solo para grandes empresas'], c: 1, fb: 'GPT-4o integra texto, imagen y audio de forma nativa con una latencia tan baja que se siente como hablar con un humano.' },
  { q: '¿Cuál es la diferencia entre "no-code" y "low-code"?', opts: ['No-code no usa internet; low-code sí lo usa', 'No-code: nada de código; low-code: algo de código', 'No-code es para imágenes; low-code para texto', 'No-code es gratis y low-code siempre de pago'], c: 1, fb: 'No-code = cero código manual. Low-code = la mayoría visual con algo de código para personalizaciones. Full-code = todo manual.' },
  { q: '¿Qué es un "negative prompt" al generar imágenes con IA?', opts: ['Un prompt escrito en tono pesimista o negativo', 'Indicarle a la IA qué NO quieres que aparezca', 'Un prompt que fuerza colores oscuros en la imagen', 'Un error frecuente al escribir prompts de imagen'], c: 1, fb: 'Los negative prompts le dicen a la IA qué excluir: "sin texto, sin blur, sin manos extras". Son muy útiles para refinar.' },
];

type ClassifyItem = { scenario: string; correct: 'real' | 'ia'; fb: string };
const CLASSIFY_DATA: ClassifyItem[] = [
  { scenario: 'Una foto de un mercado en Ghana donde las manos de los vendedores tienen 6 dedos en ambas manos', correct: 'ia', fb: 'Señal clásica de imagen IA: dedos deformes o en cantidad incorrecta.' },
  { scenario: 'Un video viral donde un cantante famoso hace declaraciones polémicas que nunca dijo públicamente', correct: 'ia', fb: 'Probable deepfake. La verificación cruzada con medios de confianza es esencial antes de compartir.' },
  { scenario: 'Un podcast donde el presentador comete errores naturales al hablar, se ríe de repente y hace una pausa larga', correct: 'real', fb: 'Las imperfecciones naturales (errores, risas espontáneas, pausas) son características humanas difíciles de replicar por IA.' },
  { scenario: 'Una canción pop con versos y coros exactamente iguales sin variación y una pronunciación absolutamente perfecta', correct: 'ia', fb: 'La perfección técnica absoluta y la falta de variación emocional pueden indicar música generada por IA.' },
  { scenario: 'Una portada de revista donde el texto del titular está perfectamente integrado y es completamente legible', correct: 'real', fb: 'Las IAs tienen problemas generando texto coherente dentro de imágenes. Un texto perfecto suele indicar edición humana.' },
  { scenario: 'Un noticiero digital donde el presentador parpadea exactamente cada 4 segundos con la misma duración', correct: 'ia', fb: 'El parpadeo demasiado regular o robótico es una señal de presentadores virtuales generados por IA.' },
  { scenario: 'Una foto grupal donde cada persona tiene una expresión natural distinta y el fondo es una ciudad real reconocible', correct: 'real', fb: 'Expresiones variadas y naturales + un fondo real reconocible hacen más probable que sea una foto real.' },
  { scenario: 'Un video de un perro en la playa donde el agua que salpica desafía la física y las patas no coinciden con el paso', correct: 'ia', fb: 'La física incorrecta (agua, movimiento de extremidades) es uno de los límites más evidentes del video con IA actual.' },
];

type DdItem = { id: string; text: string };
type DdZone = { label: string; correct: string[]; why: string };
const DD_ITEMS: DdItem[] = [
  { id: 'a', text: '🎵 Componer una canción desde cero con texto' },
  { id: 'b', text: '📝 Analizar tus PDF y hacer preguntas sobre ellos' },
  { id: 'c', text: '🖼️ Generar una imagen desde una descripción' },
  { id: 'd', text: '🎬 Crear un clip de video de 8s desde texto' },
  { id: 'e', text: '🌐 Construir una app web sin escribir código' },
  { id: 'f', text: '🗣️ Clonar tu voz para narrar un audiolibro' },
  { id: 'g', text: '📊 Preguntarle a una hoja de datos en lenguaje normal' },
  { id: 'h', text: '🔊 Transcribir un audio de 1 hora automáticamente' },
];
const DD_ZONES: DdZone[] = [
  { label: '🎨 DALL-E / Midjourney', correct: ['c'], why: 'Generan imágenes desde una descripción de texto.' },
  { label: '🎵 Suno / Udio', correct: ['a'], why: 'Componen canciones completas a partir de texto.' },
  { label: '🎬 Runway / Pika / Sora', correct: ['d'], why: 'Generan clips de video a partir de texto.' },
  { label: '🎤 ElevenLabs', correct: ['f'], why: 'Clona voces para narración y audiolibros.' },
  { label: '👂 Whisper', correct: ['h'], why: 'Transcribe audio a texto automáticamente.' },
  { label: '📓 NotebookLM', correct: ['b', 'g'], why: 'Analiza tus documentos y datos y responde preguntas sobre ellos.' },
  { label: '🔨 Lovable / Bubble', correct: ['e'], why: 'Construyen apps web sin escribir código.' },
];

const QUIZ_MAX = 80, CLASSIFY_MAX = 40, DD_MAX = 40, PIPELINE_XP = 30, REFLECT_XP = 10;
const TOTAL_ITEMS = QUIZ_POOL.length + CLASSIFY_DATA.length + DD_ZONES.length + 2; // 15+8+7+2 = 32

export default function Eval3() {
  const completeLevel = useGameStore(s => s.completeLevel);
  const devMode = useGameStore(s => s.devMode);

  const [part, setPart] = useState(1); // 1..5 partes, 6 = completado
  useReportProgress(part - 1, 6);
  const [xp, setXp] = useState(0);
  const [xpToast, setXpToast] = useState<{ amount: number; id: number } | null>(null);
  const [totalCorrect, setTotalCorrect] = useState(0);

  // Parte 1 — Quiz (barajado)
  const [quiz] = useState<QuizQ[]>(() => QUIZ_POOL.map(shuffleOpts));
  const [quizAns, setQuizAns] = useState<Record<number, number>>({});
  const [quizChecked, setQuizChecked] = useState(false);
  const [quizScore, setQuizScore] = useState(0);

  // Parte 2 — Clasificador
  const [clAns, setClAns] = useState<Record<number, 'real' | 'ia'>>({});
  const [clChecked, setClChecked] = useState(false);
  const [clScore, setClScore] = useState(0);

  // Parte 3 — Drag & drop
  const [ddPlaced, setDdPlaced] = useState<{ [idx: number]: number }>({});
  const [ddSel, setDdSel] = useState<number | null>(null);
  const [ddOverZone, setDdOverZone] = useState<number | null>(null);
  const [ddChecked, setDdChecked] = useState(false);
  const [ddScore, setDdScore] = useState(0);
  const ddPlacedRef = useRef(ddPlaced);
  useEffect(() => { ddPlacedRef.current = ddPlaced; }, [ddPlaced]);
  const ddIdxRef = useRef<number | null>(null);
  const ddAllPlaced = DD_ITEMS.every((_, i) => ddPlaced[i] !== undefined);

  // Parte 4 — Pipeline
  const [pipeText, setPipeText] = useState('');
  const [pipeDone, setPipeDone] = useState(false);
  const [pipeError, setPipeError] = useState<string | null>(null);

  // Parte 5 — Reflexión
  const [reflectText, setReflectText] = useState('');
  const [reflectDone, setReflectDone] = useState(false);
  const [reflectError, setReflectError] = useState<string | null>(null);

  const addXP = (v: number) => {
    if (v <= 0) return;
    setXp(p => p + v);
    setXpToast(prev => ({ amount: v, id: (prev?.id ?? 0) + 1 }));
  };

  const isExam = part >= 1 && part <= 5;

  // Hardware back (Android)
  useEffect(() => {
    const onBack = () => {
      if (isExam) {
        if (Platform.OS !== 'web') Alert.alert('Evaluación en curso', 'No puedes retroceder durante la evaluación.', [{ text: 'OK' }]);
        return true;
      }
      return false;
    };
    const h = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => h.remove();
  }, [isExam]);

  // Drag & drop web — soltar en cualquier zona
  useEffect(() => {
    if (Platform.OS !== 'web' || part !== 3 || ddChecked) return;
    const cleanups: (() => void)[] = [];
    const setup = () => {
      DD_ITEMS.forEach((_, idx) => {
        if (ddPlacedRef.current[idx] !== undefined) return;
        const el = document.getElementById(`e3-chip-${idx}`);
        if (!el) return;
        el.setAttribute('draggable', 'true');
        (el as HTMLElement).style.cursor = 'grab';
        const onDragStart = (e: DragEvent) => { ddIdxRef.current = idx; setDdSel(null); if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(idx)); } };
        const onDragEnd = () => { ddIdxRef.current = null; setDdOverZone(null); };
        el.addEventListener('dragstart', onDragStart);
        el.addEventListener('dragend', onDragEnd);
        cleanups.push(() => { el.removeEventListener('dragstart', onDragStart); el.removeEventListener('dragend', onDragEnd); });
      });
      DD_ZONES.forEach((_, zi) => {
        const el = document.getElementById(`e3-zone-${zi}`);
        if (!el) return;
        const onOver = (e: Event) => { e.preventDefault(); setDdOverZone(zi); };
        const onLeave = (e: DragEvent) => { if (!el.contains(e.relatedTarget as Node)) setDdOverZone(null); };
        const onDrop = (e: Event) => { e.preventDefault(); setDdOverZone(null); const idx = ddIdxRef.current; if (idx === null || ddPlacedRef.current[idx] !== undefined) return; setDdPlaced(p => ({ ...p, [idx]: zi })); ddIdxRef.current = null; };
        el.addEventListener('dragover', onOver);
        el.addEventListener('dragleave', onLeave);
        el.addEventListener('drop', onDrop);
        cleanups.push(() => { el.removeEventListener('dragover', onOver); el.removeEventListener('dragleave', onLeave); el.removeEventListener('drop', onDrop); });
      });
    };
    const t = setTimeout(setup, 50);
    return () => { clearTimeout(t); cleanups.forEach(fn => fn()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [part, ddPlaced, ddChecked]);

  const handleClose = () => {
    const msg = isExam ? 'Estás en la evaluación. Si sales perderás el progreso. ¿Seguro?' : '¿Seguro que quieres salir?';
    if (Platform.OS === 'web') { if (window.confirm(msg)) exitLevel({ confirm: false }); return; }
    Alert.alert('Salir', msg, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: () => exitLevel({ confirm: false }) },
    ]);
  };

  // ---------- Acciones ----------
  const checkQuiz = () => {
    if (quizChecked) return;
    let correct = 0;
    quiz.forEach((q, i) => { if (quizAns[i] === q.c) correct++; });
    setQuizScore(correct);
    setQuizChecked(true);
    setTotalCorrect(c => c + correct);
    addXP(Math.round((correct / quiz.length) * QUIZ_MAX));
  };

  const checkClassify = () => {
    if (clChecked) return;
    let correct = 0;
    CLASSIFY_DATA.forEach((it, i) => { if (clAns[i] === it.correct) correct++; });
    setClScore(correct);
    setClChecked(true);
    setTotalCorrect(c => c + correct);
    addXP(Math.round((correct / CLASSIFY_DATA.length) * CLASSIFY_MAX));
  };

  const ddPlace = (zi: number) => {
    if (ddSel === null || ddPlaced[ddSel] !== undefined || ddChecked) return;
    setDdPlaced(p => ({ ...p, [ddSel]: zi }));
    setDdSel(null);
  };
  const ddReturn = (idx: number) => {
    if (ddChecked) return;
    setDdPlaced(p => { const n = { ...p }; delete n[idx]; return n; });
  };
  const zoneCorrect = (zi: number) => {
    const placedIds = DD_ITEMS.filter((_, i) => ddPlaced[i] === zi).map(it => it.id);
    const z = DD_ZONES[zi];
    return z.correct.every(id => placedIds.includes(id)) && placedIds.every(id => z.correct.includes(id));
  };
  const checkDD = () => {
    if (ddChecked) return;
    let correct = 0;
    DD_ZONES.forEach((_, zi) => { if (zoneCorrect(zi)) correct++; });
    setDdScore(correct);
    setDdChecked(true);
    setTotalCorrect(c => c + correct);
    addXP(Math.round((correct / DD_ZONES.length) * DD_MAX));
  };

  const submitPipeline = () => {
    const t = pipeText.trim();
    if (t.length < 60) { setPipeError('Describe tu pipeline con más detalle (al menos 60 caracteres).'); return; }
    if (looksRandom(t)) { setPipeError('Tu texto parece escrito al azar. Describe un proyecto real paso a paso.'); return; }
    if (!containsTopic(t, PIPELINE_TERMS)) { setPipeError('⚠️ Menciona las herramientas o pasos: imagen, audio, video, web... y qué generas en cada uno.'); return; }
    setPipeError(null);
    setPipeDone(true);
    setTotalCorrect(c => c + 1);
    addXP(PIPELINE_XP);
  };

  const submitReflection = () => {
    const t = reflectText.trim();
    if (t.length < 40) { setReflectError('Escribe un poco más — al menos 40 caracteres.'); return; }
    if (looksRandom(t)) { setReflectError('Tu texto parece escrito al azar. Cuenta tu experiencia real con el Mundo 3.'); return; }
    if (!containsTopic(t, REFLECT_TERMS)) { setReflectError('⚠️ Habla del Mundo 3: qué crearías, qué herramienta te sorprendió o qué aprendiste con la IA.'); return; }
    setReflectError(null);
    setReflectDone(true);
    setTotalCorrect(c => c + 1);
    addXP(REFLECT_XP);
  };

  const pct = Math.round((totalCorrect / TOTAL_ITEMS) * 100);
  const finishEvaluation = () => {
    const stars = pct >= 85 ? 3 : pct >= 60 ? 2 : 1;
    completeLevel(39, stars, xp);
    router.replace('/level/19');
  };

  const nextPart = () => setPart(p => p + 1);

  // ---------- Bloques auxiliares ----------
  const Fb = ({ ok, children }: { ok: boolean; children: ReactNode }) => (
    <View style={[styles.fb, ok ? styles.fbOk : styles.fbFail]}>
      <Text style={[styles.fbText, { color: ok ? C.okText : C.failText }]}>{children}</Text>
    </View>
  );
  const PartHead = ({ label, title, desc }: { label: string; title: string; desc: string }) => (
    <>
      <View style={styles.partLabel}><Text style={styles.partLabelText}>{label}</Text></View>
      <Text style={styles.partTitle}>{title}</Text>
      <Text style={styles.partDesc}>{desc}</Text>
    </>
  );

  // ---------- Render por parte ----------
  const renderPart = (): ReactNode => {
    switch (part) {
      // ===== PARTE 1 · QUIZ =====
      case 1: return (
        <>
          <PartHead label="📝 Parte 1 de 5" title="Quiz — 15 preguntas" desc="Responde cada pregunta. Puedes continuar aunque no aciertes todas — lo importante es aprender." />
          {quiz.map((q, i) => (
            <View key={i} style={styles.qItem}>
              <Text style={styles.qNum}>Pregunta {i + 1} de {quiz.length}</Text>
              <Text style={styles.qText}>{q.q}</Text>
              {q.opts.map((o, j) => (
                <TouchableOpacity key={j}
                  style={[styles.qOpt, !quizChecked && quizAns[i] === j && styles.qOptSel, quizChecked && j === q.c && styles.optCorrect, quizChecked && quizAns[i] === j && j !== q.c && styles.optWrong]}
                  disabled={quizChecked}
                  onPress={() => setQuizAns(p => ({ ...p, [i]: j }))}>
                  <Text style={[styles.qOptText, quizChecked && j === q.c && { color: C.okText }, quizChecked && quizAns[i] === j && j !== q.c && { color: C.failText }]}>{['🅐', '🅑', '🅒', '🅓'][j]} {o}</Text>
                </TouchableOpacity>
              ))}
              {quizChecked && <Fb ok={quizAns[i] === q.c}>{quizAns[i] === q.c ? '✅ ' : quizAns[i] === undefined ? '⚠️ Sin responder. ' : '❌ '}{q.fb}</Fb>}
            </View>
          ))}
          {quizChecked && <Fb ok={quizScore >= 10}>{quizScore >= 10 ? `✅ ¡${quizScore}/15 correctas! Excelente dominio del Mundo 3.` : `📚 ${quizScore}/15 correctas. Repasa los niveles donde tuviste dificultades.`}</Fb>}
        </>
      );

      // ===== PARTE 2 · CLASIFICADOR =====
      case 2: return (
        <>
          <PartHead label="🔍 Parte 2 de 5" title="¿Real o generado por IA?" desc="Lee cada descripción y clasifica si es probable que sea REAL (creado por humanos) o GENERADO por IA." />
          {CLASSIFY_DATA.map((it, i) => (
            <View key={i} style={styles.clItem}>
              <Text style={styles.clScenario}>{it.scenario}</Text>
              <View style={styles.clBtns}>
                <TouchableOpacity style={[styles.clBtn, clAns[i] === 'real' && !clChecked && styles.clBtnSel, clChecked && it.correct === 'real' && styles.optCorrect, clChecked && clAns[i] === 'real' && it.correct !== 'real' && styles.optWrong]}
                  disabled={clChecked} onPress={() => setClAns(p => ({ ...p, [i]: 'real' }))}>
                  <Text style={[styles.clBtnText, clChecked && it.correct === 'real' && { color: C.okText }, clChecked && clAns[i] === 'real' && it.correct !== 'real' && { color: C.failText }]}>👤 Real / Humano</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.clBtn, clAns[i] === 'ia' && !clChecked && styles.clBtnSel, clChecked && it.correct === 'ia' && styles.optCorrect, clChecked && clAns[i] === 'ia' && it.correct !== 'ia' && styles.optWrong]}
                  disabled={clChecked} onPress={() => setClAns(p => ({ ...p, [i]: 'ia' }))}>
                  <Text style={[styles.clBtnText, clChecked && it.correct === 'ia' && { color: C.okText }, clChecked && clAns[i] === 'ia' && it.correct !== 'ia' && { color: C.failText }]}>🤖 Generado por IA</Text>
                </TouchableOpacity>
              </View>
              {clChecked && <Fb ok={clAns[i] === it.correct}>{clAns[i] === it.correct ? '✅ ' : '❌ '}{it.fb}</Fb>}
            </View>
          ))}
          {clChecked && <Fb ok={clScore >= 6}>{clScore >= 6 ? `✅ ${clScore}/8 correctas. ¡Buen ojo para detectar contenido de IA!` : `📚 ${clScore}/8 correctas. La detección de IA mejora con práctica.`}</Fb>}
        </>
      );

      // ===== PARTE 3 · DRAG & DROP =====
      case 3: return (
        <>
          <PartHead label="↕️ Parte 3 de 5" title="Herramienta correcta" desc="Lleva cada tarea creativa a la herramienta de IA más adecuada. Toca una y luego su zona (o arrástrala)." />
          <View style={styles.ddPool}>
            {DD_ITEMS.map((item, idx) => ddPlaced[idx] === undefined ? (
              <TouchableOpacity key={idx} id={`e3-chip-${idx}`} style={[styles.ddItem, ddSel === idx && styles.ddItemSel]} disabled={ddChecked} onPress={() => setDdSel(ddSel === idx ? null : idx)}>
                <Text style={styles.ddItemText}>{item.text}</Text>
              </TouchableOpacity>
            ) : null)}
            {ddAllPlaced && <Text style={{ color: C.placeholder, fontSize: 12 }}>Todas las tareas colocadas ✓</Text>}
          </View>
          {DD_ZONES.map((zone, zi) => {
            const zc = ddChecked && zoneCorrect(zi);
            const zw = ddChecked && !zoneCorrect(zi);
            return (
              <View key={zi}>
                <Text style={styles.ddZoneLabel}>{zone.label}</Text>
                <TouchableOpacity id={`e3-zone-${zi}`} activeOpacity={0.8}
                  style={[styles.ddZone, ddOverZone === zi && styles.ddZoneOver, zc && styles.ddZoneOk, zw && styles.ddZoneBad]}
                  disabled={ddChecked} onPress={() => ddPlace(zi)}>
                  {DD_ITEMS.map((item, idx) => ddPlaced[idx] === zi ? (
                    <TouchableOpacity key={idx} disabled={ddChecked} onPress={() => ddReturn(idx)} style={styles.ddPlaced}>
                      <Text style={styles.ddPlacedText}>{item.text}{ddChecked ? '' : ' ✕'}</Text>
                    </TouchableOpacity>
                  ) : null)}
                </TouchableOpacity>
              </View>
            );
          })}
          {ddChecked && (
            <>
              <Fb ok={ddScore >= 5}>{ddScore >= 5 ? `✅ ${ddScore}/${DD_ZONES.length} categorías correctas. ¡Conoces bien las herramientas!` : `📚 ${ddScore}/${DD_ZONES.length} correctas. Cada herramienta tiene su especialidad.`}</Fb>
              {DD_ZONES.map((zone, zi) => !zoneCorrect(zi) ? (
                <Fb key={zi} ok={false}>✕ <Text style={{ fontWeight: '700' }}>{zone.label}</Text>: {zone.why}</Fb>
              ) : null)}
            </>
          )}
        </>
      );

      // ===== PARTE 4 · PIPELINE =====
      case 4: return (
        <>
          <PartHead label="🔗 Parte 4 de 5" title="Diseña tu pipeline creativo" desc="Diseña el flujo de un proyecto creativo con IA usando al menos 4 herramientas: imagen → audio → video → web." />
          <View style={styles.pipeFlow}>
            {['💡 Idea', '🖼️ Imagen', '🎵 Audio', '🎬 Video', '🌐 Web'].map((n, i, arr) => (
              <View key={n} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.pipNode}><Text style={styles.pipNodeText}>{n}</Text></View>
                {i < arr.length - 1 && <Text style={styles.pipArrow}>→</Text>}
              </View>
            ))}
          </View>
          <Text style={styles.partDesc}>Describe tu proyecto específico que pase por todo ese pipeline. ¿Cuál es la idea? ¿Qué herramienta usas en cada paso? ¿Cuál es el resultado final?</Text>
          <TextInput
            style={styles.textArea}
            placeholder={'Mi proyecto se llama...\nPaso 1 — Imagen: [herramienta + qué generas]\nPaso 2 — Audio: [herramienta + qué generas]\nPaso 3 — Video: [herramienta + cómo combinas]\nPaso 4 — Web: [herramienta + cómo publicas]\nResultado final: ...'}
            placeholderTextColor={C.placeholder}
            value={pipeText} onChangeText={t => { setPipeText(t); setPipeError(null); }} multiline editable={!pipeDone}
          />
          {pipeError && <Fb ok={false}>{pipeError}</Fb>}
          {pipeDone && <Fb ok>🔗 ¡Pipeline diseñado! Un flujo multimodal completo demuestra que sabes conectar herramientas de IA.</Fb>}
        </>
      );

      // ===== PARTE 5 · REFLEXIÓN =====
      case 5: return (
        <>
          <PartHead label="💭 Parte 5 de 5" title="Reflexión sellada" desc="Esta es tu última respuesta del Mundo 3. Nadie la va a juzgar — es tuya. Sé honesto y piensa de verdad." />
          <View style={styles.reflectPrompt}>
            <Text style={styles.reflectPromptText}>"¿Qué quieres crear que antes sentías imposible para ti? ¿Cómo cambió este mundo tu manera de ver las herramientas de IA? ¿Cuál fue la herramienta o capacidad que más te sorprendió y por qué?"</Text>
          </View>
          <TextInput
            style={styles.textArea}
            placeholder="Escribe tu reflexión aquí. No hay respuestas correctas o incorrectas — solo tu experiencia real con el Mundo 3..."
            placeholderTextColor={C.placeholder}
            value={reflectText} onChangeText={t => { setReflectText(t); setReflectError(null); }} multiline editable={!reflectDone}
          />
          {reflectError && <Fb ok={false}>{reflectError}</Fb>}
          {reflectDone && <Fb ok>🔒 ¡Reflexión sellada! Este pensamiento es tuyo para siempre.</Fb>}
        </>
      );

      // ===== 6 · COMPLETADO =====
      case 6: return (
        <View style={styles.completion}>
          <View style={styles.scoreRing}>
            <Text style={styles.scorePct}>{pct}%</Text>
            <Text style={styles.scoreLbl}>acierto</Text>
          </View>
          <View style={styles.worldBadge}>
            <Text style={styles.worldBadgeIcon}>🎨</Text>
            <Text style={styles.worldBadgeTitle}>Insignia desbloqueada: Creador Multimodal</Text>
            <Text style={styles.worldBadgeSub}>Mundo 3 — IA Creativa completado · Niveles N13–N18</Text>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statItem}><Text style={styles.statNum}>{totalCorrect}</Text><Text style={styles.statLbl}>Correctas</Text></View>
            <View style={styles.statItem}><Text style={styles.statNum}>{xp}</Text><Text style={styles.statLbl}>XP ganados</Text></View>
            <View style={styles.statItem}><Text style={styles.statNum}>5</Text><Text style={styles.statLbl}>Partes</Text></View>
          </View>
          <Text style={styles.completionText}>¡Lo lograste! Ahora eres un creador multimodal: imágenes, audio, video, web, datos y pipelines completos con IA. El Mundo 4 te espera con las herramientas más poderosas del ecosistema.</Text>
          <TouchableOpacity style={[styles.mainBtn, { width: '100%' }]} onPress={finishEvaluation}>
            <Text style={styles.mainBtnText}>🚀 Ir al Mundo 4 →</Text>
          </TouchableOpacity>
        </View>
      );

      default: return null;
    }
  };

  // ---------- Botón principal ----------
  const getBtn = (): { label: string; enabled: boolean; note?: string; onPress: () => void } | null => {
    switch (part) {
      case 1:
        if (!quizChecked) return { label: 'Verificar respuestas →', enabled: Object.keys(quizAns).length > 0 || devMode, note: `Responde y verifica · hasta +${QUIZ_MAX} XP`, onPress: checkQuiz };
        return { label: 'Ir a la Parte 2 →', enabled: true, onPress: nextPart };
      case 2:
        if (!clChecked) return { label: 'Verificar →', enabled: Object.keys(clAns).length > 0 || devMode, note: `Clasifica y verifica · hasta +${CLASSIFY_MAX} XP`, onPress: checkClassify };
        return { label: 'Ir a la Parte 3 →', enabled: true, onPress: nextPart };
      case 3:
        if (!ddChecked) return { label: 'Verificar clasificación →', enabled: ddAllPlaced || devMode, note: `Coloca las ${DD_ITEMS.length} tareas · hasta +${DD_MAX} XP`, onPress: checkDD };
        return { label: 'Ir a la Parte 4 →', enabled: true, onPress: nextPart };
      case 4:
        if (!pipeDone) return { label: 'Enviar pipeline →', enabled: pipeText.trim().length >= 60 || devMode, note: `Describe tu pipeline creativo · +${PIPELINE_XP} XP`, onPress: submitPipeline };
        return { label: 'Ir a la Parte 5 →', enabled: true, onPress: nextPart };
      case 5:
        if (!reflectDone) return { label: '🔒 Sellar y completar', enabled: reflectText.trim().length >= 40 || devMode, note: `Tu reflexión de cierre · +${REFLECT_XP} XP`, onPress: submitReflection };
        return { label: 'Ver resultado →', enabled: true, onPress: nextPart };
      case 6: return null;
      default: return null;
    }
  };

  const btn = getBtn();
  const progress = Math.round((Math.min(part, 6) / 6) * 100);

  return (
    <View style={styles.screen}>
      {/* Barra superior */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={handleClose} style={styles.closeBtn}><Text style={styles.closeBtnText}>✕</Text></TouchableOpacity>
        <View style={{ flex: 1 }} />
        <View style={styles.xpChip}><Text style={styles.xpChipText}>{xp} XP</Text></View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container}>
        {/* Header de la evaluación */}
        <View style={styles.header}>
          <View style={styles.evalBadge}><Text style={styles.evalBadgeText}>🏆 EVALUACIÓN FINAL · MUNDO 3</Text></View>
          <Text style={styles.evalTitle}>IA Creativa</Text>
          <Text style={styles.evalSubtitle}>5 partes · Demuestra todo lo que aprendiste sobre IA creativa</Text>
          <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
          <View style={styles.progressLabelRow}>
            <Text style={styles.progressLabel}>{part <= 5 ? `Parte ${part} de 5` : '¡Completado!'}</Text>
            <Text style={styles.progressLabel}>{xp} / 200 XP</Text>
          </View>
        </View>

        {/* Tarjeta de la parte */}
        <View style={styles.partCard}>
          <View style={styles.partCardAccent} />
          {renderPart()}
        </View>
      </ScrollView>

      {/* Footer */}
      {btn && (
        <View style={styles.btnRow}>
          <TouchableOpacity style={[styles.mainBtn, !btn.enabled && styles.mainBtnDisabled]} onPress={btn.onPress} disabled={!btn.enabled}>
            <Text style={styles.mainBtnText}>{btn.label}</Text>
          </TouchableOpacity>
          {btn.note ? <Text style={styles.btnNote}>{btn.note}</Text> : null}
        </View>
      )}

      {xpToast && <XPToast key={xpToast.id} amount={xpToast.amount} onHide={() => setXpToast(null)} bgColor={C.grad1} textColor="#fff" />}
    </View>
  );
}

// ===================== ESTILOS (paleta oscura degradado del HTML eval-mundo3) =====================
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },

  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingTop: 11, paddingBottom: 8, backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.border },
  closeBtn: { minWidth: 42, minHeight: 42, borderRadius: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 12, color: C.fuchsiaLight, fontWeight: '800' },
  xpChip: { paddingHorizontal: 11, paddingVertical: 4, borderRadius: 12, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border },
  xpChipText: { fontSize: 12, color: C.fuchsiaLight, fontWeight: '700' },

  container: { padding: 16, paddingBottom: 28 },

  header: { marginBottom: 20, padding: 20, backgroundColor: '#14002a', borderRadius: 18, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  evalBadge: { backgroundColor: C.grad1, borderRadius: 99, paddingHorizontal: 16, paddingVertical: 6, marginBottom: 12 },
  evalBadgeText: { ...typography.bold, fontSize: 11, color: '#fff', letterSpacing: 0.5 },
  evalTitle: { ...typography.extraBold, fontSize: 26, color: C.text, textAlign: 'center' },
  evalSubtitle: { ...typography.regular, fontSize: 12, color: C.muted, marginTop: 6, textAlign: 'center' },
  progressBar: { width: '100%', height: 8, backgroundColor: C.border, borderRadius: 99, overflow: 'hidden', marginTop: 16 },
  progressFill: { height: '100%', backgroundColor: C.grad1, borderRadius: 99 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, width: '100%' },
  progressLabel: { fontSize: 11, color: C.muted, fontWeight: '500' },

  partCard: { backgroundColor: C.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  partCardAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: C.grad1 },
  partLabel: { alignSelf: 'flex-start', backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 12 },
  partLabelText: { fontSize: 11, fontWeight: '700', color: C.fuchsiaLight, letterSpacing: 0.5 },
  partTitle: { ...typography.extraBold, fontSize: 19, color: C.text, marginBottom: 6 },
  partDesc: { fontSize: 13, color: C.muted, marginBottom: 16, lineHeight: 19 },

  // Quiz
  qItem: { backgroundColor: C.card2, borderRadius: 12, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: C.border },
  qNum: { fontSize: 10, fontWeight: '700', color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  qText: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 12, lineHeight: 20 },
  qOpt: { backgroundColor: C.surface, borderWidth: 2, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 7 },
  qOptSel: { borderColor: C.grad2, backgroundColor: '#26003d' },
  qOptText: { fontSize: 13, color: C.text, lineHeight: 18 },
  optCorrect: { borderColor: C.green2, backgroundColor: C.okBg },
  optWrong: { borderColor: C.red, backgroundColor: C.failBg },

  // Feedback
  fb: { marginTop: 8, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 10, borderWidth: 1 },
  fbOk: { backgroundColor: C.okBg, borderColor: C.okBorder },
  fbFail: { backgroundColor: C.failBg, borderColor: C.failBorder },
  fbText: { fontSize: 12, lineHeight: 18, fontWeight: '500' },

  // Classify
  clItem: { backgroundColor: C.card2, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  clScenario: { fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 10, lineHeight: 19 },
  clBtns: { flexDirection: 'row', gap: 8 },
  clBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 2, borderColor: C.border, alignItems: 'center', backgroundColor: 'transparent' },
  clBtnSel: { borderColor: C.grad2, backgroundColor: '#26003d' },
  clBtnText: { fontSize: 12, fontWeight: '700', color: C.muted },

  // Drag & drop
  ddPool: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 14, backgroundColor: C.card2, borderWidth: 2, borderStyle: 'dashed', borderColor: C.border, borderRadius: 12, minHeight: 60, marginBottom: 12, alignItems: 'center' },
  ddItem: { backgroundColor: C.surface, borderWidth: 2, borderColor: C.border, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  ddItemSel: { borderColor: C.grad1, backgroundColor: '#38002e' },
  ddItemText: { fontSize: 12, color: C.text, lineHeight: 16 },
  ddZoneLabel: { fontSize: 12, fontWeight: '700', color: C.fuchsiaLight, marginBottom: 5, marginTop: 4 },
  ddZone: { minHeight: 50, padding: 10, borderWidth: 2, borderStyle: 'dashed', borderColor: C.border, borderRadius: 10, backgroundColor: C.card2, marginBottom: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'flex-start' },
  ddZoneOver: { borderColor: C.grad1, backgroundColor: '#26003d' },
  ddZoneOk: { borderColor: C.green2, backgroundColor: C.okBg, borderStyle: 'solid' },
  ddZoneBad: { borderColor: C.red, backgroundColor: C.failBg, borderStyle: 'solid' },
  ddPlaced: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 6, paddingVertical: 5, paddingHorizontal: 9 },
  ddPlacedText: { fontSize: 11, color: C.text },

  // Pipeline / Reflexión
  textArea: { backgroundColor: C.surface, borderWidth: 2, borderColor: C.border, borderRadius: 12, padding: 14, fontSize: 14, lineHeight: 21, color: C.text, minHeight: 120, marginVertical: 10, textAlignVertical: 'top' },
  pipeFlow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4, padding: 12, backgroundColor: C.card2, borderRadius: 12, marginBottom: 12 },
  pipNode: { backgroundColor: '#2d0050', borderWidth: 2, borderColor: C.grad2, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 10 },
  pipNodeText: { fontSize: 11, fontWeight: '700', color: C.fuchsiaLight },
  pipArrow: { color: C.muted, fontSize: 14, marginHorizontal: 1 },
  reflectPrompt: { backgroundColor: C.card2, borderLeftWidth: 4, borderLeftColor: C.grad1, borderTopRightRadius: 12, borderBottomRightRadius: 12, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 8 },
  reflectPromptText: { fontSize: 13, color: C.muted, fontStyle: 'italic', lineHeight: 21 },

  // Completado
  completion: { alignItems: 'center', paddingVertical: 12 },
  scoreRing: { width: 130, height: 130, borderRadius: 65, borderWidth: 8, borderColor: C.grad1, backgroundColor: C.card2, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  scorePct: { fontSize: 32, fontWeight: '800', color: C.fuchsiaLight },
  scoreLbl: { fontSize: 11, color: C.muted },
  worldBadge: { backgroundColor: C.grad2, borderRadius: 18, padding: 24, alignItems: 'center', marginBottom: 18, width: '100%' },
  worldBadgeIcon: { fontSize: 48, marginBottom: 8 },
  worldBadgeTitle: { fontSize: 15, fontWeight: '800', color: '#fff', textAlign: 'center' },
  worldBadgeSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 6, textAlign: 'center' },
  statsRow: { flexDirection: 'row', width: '100%', gap: 8, marginBottom: 16 },
  statItem: { flex: 1, alignItems: 'center', backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 8 },
  statNum: { ...typography.extraBold, fontSize: 20, color: C.fuchsiaLight },
  statLbl: { fontSize: 10, color: C.muted, marginTop: 2, textAlign: 'center' },
  completionText: { fontSize: 13, color: C.muted, textAlign: 'center', marginBottom: 20, lineHeight: 20 },

  // Botones
  btnRow: { paddingHorizontal: 13, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.surface },
  mainBtn: { padding: 14, borderRadius: 10, backgroundColor: C.grad1, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  mainBtnDisabled: { opacity: 0.35 },
  mainBtnText: { ...typography.bold, color: '#fff', fontSize: 14 },
  btnNote: { fontSize: 11, color: C.placeholder, textAlign: 'center', marginTop: 5, minHeight: 15 },
});
