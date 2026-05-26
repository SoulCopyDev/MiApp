import { router } from 'expo-router';

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, BackHandler,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useGameStore } from '../store/gameStore';
import { colors, typography } from '../theme';

// ---------- Tipos ----------
type MatchPair = { left: string; right: string };
type TFItem = { stmt: string; correct: boolean; explain: string };
type QuizItem = { q: string; opts: string[]; correct: number; explain: string };
type FillItem = { sentence: string; allOpts: string[]; correct: number; explain: string };
type PromptItem = { task: string; bad: string; good: string; explain: string };
type DragItemG = { text: string; correct: string };

// ---------- Datos ----------
const DRAG_POOL: DragItemG[] = [
  { text: 'Buscar noticias de hoy en tiempo real', correct: 'fortaleza' },
  { text: 'Analizar un PDF de 300 páginas en detalle', correct: 'cuidado' },
  { text: 'Resumir un video de YouTube con un link', correct: 'fortaleza' },
  { text: 'Generar una imagen artística detallada', correct: 'cuidado' },
  { text: 'Buscar vuelos baratos para la próxima semana', correct: 'cuidado' },
  { text: 'Crear un documento en Google Docs con IA', correct: 'fortaleza' },
  { text: 'Escribir código en Python paso a paso', correct: 'fortaleza' },
  { text: 'Pedir comida a domicilio en tu barrio', correct: 'cuidado' },
  { text: 'Buscar artículos académicos recientes', correct: 'fortaleza' },
  { text: 'Recordar conversaciones de hace 3 meses', correct: 'cuidado' },
  { text: 'Responder preguntas sobre un PDF de Google Drive', correct: 'fortaleza' },
  { text: 'Darte resultados deportivos en vivo en este momento', correct: 'cuidado' }
];

const MATCH_POOL: MatchPair[] = [
  { left: 'Gmail', right: 'Gemini redacta y resume correos' },
  { left: 'Google Docs', right: 'Gemini sugiere texto y mejora redacción' },
  { left: 'YouTube', right: 'Gemini resume videos y responde preguntas sobre ellos' },
  { left: 'Google Fotos', right: 'Gemini describe imágenes y encuentra momentos' },
  { left: 'Google Maps', right: 'Gemini sugiere rutas con contexto conversacional' },
  { left: 'Google Meet', right: 'Gemini transcribe y resume reuniones automáticamente' },
  { left: 'Google Sheets', right: 'Gemini analiza datos y crea fórmulas desde texto' },
  { left: 'Google Buscador', right: 'Gemini genera resúmenes de IA al inicio de resultados' }
];

const GEMINI_SORT = [
  'Recibes el prompt: Le haces una pregunta o solicitud a Gemini',
  'Búsqueda en Google: Gemini consulta Google para obtener información actualizada',
  'Análisis de fuentes: Evalúa los resultados y selecciona la información más relevante',
  'Síntesis con IA: Combina la información encontrada con su conocimiento de entrenamiento',
  'Respuesta con citas: Te entrega el resultado con referencias a las fuentes consultadas'
];

const QUIZ_POOL: QuizItem[] = [
  { q: '¿Cuál es la ventaja más importante de Gemini sobre Claude y ChatGPT?',
    opts: ['Tiene la ventana de contexto más grande', 'Está integrado con el ecosistema de Google: Búsqueda, Docs, Gmail, YouTube y más', 'Es completamente gratuito sin límites', 'Puede generar videos directamente desde texto'],
    correct: 1, explain: 'La integración con el ecosistema Google es la fortaleza clave de Gemini.' },
  { q: 'Un estudiante en Corea del Sur quiere resumir un video de YouTube. ¿Qué LLM elige?',
    opts: ['Claude', 'ChatGPT', 'Gemini — puede procesar videos de YouTube directamente con el link', 'Todos pueden hacerlo igual'],
    correct: 2, explain: 'Gemini tiene integración nativa con YouTube. Puedes pegarle el link de un video y pedirle que lo resuma.' },
  { q: '¿Cuál es la diferencia entre Gemini y Google Búsqueda?',
    opts: ['Son la misma herramienta', 'Google Búsqueda devuelve links; Gemini genera respuestas conversacionales sintetizando información', 'Gemini solo funciona en inglés', 'Gemini es más antiguo'],
    correct: 1, explain: 'Google Búsqueda te da links para leer. Gemini lee esas fuentes por ti y da una respuesta directa y conversacional.' },
  { q: '¿Para qué tarea Gemini Advanced sería claramente mejor que Claude o ChatGPT?',
    opts: ['Analizar un ensayo de 15 páginas con crítica literaria', 'Pedirle que revise tu correo de Gmail y sugiera cómo mejorar el tono', 'Escribir una novela de ciencia ficción', 'Explicar un concepto de matemáticas'],
    correct: 1, explain: 'Gemini puede integrarse con tu Gmail y leer tus correos (con permiso). Puede analizar el tono de un correo específico.' }
];

const TF_POOL: TFItem[] = [
  { stmt: 'Gemini puede resumir videos de YouTube directamente con el link del video', correct: true, explain: 'Correcto. Gemini tiene integración nativa con YouTube.' },
  { stmt: 'Gemini y Google Búsqueda son exactamente la misma herramienta', correct: false, explain: 'Son diferentes. Google Búsqueda devuelve links; Gemini es un LLM conversacional.' },
  { stmt: 'Gemini puede acceder a tus archivos de Google Drive si le das permiso', correct: true, explain: 'Sí. Con los permisos correctos, Gemini puede leer documentos de tu Drive.' },
  { stmt: 'Gemini fue creado por la misma empresa que hizo ChatGPT', correct: false, explain: 'Falso. ChatGPT fue creado por OpenAI. Gemini fue creado por Google DeepMind.' },
  { stmt: 'Gemini puede trabajar directamente dentro de Google Docs para ayudarte a redactar', correct: true, explain: 'Correcto. Google Docs tiene a Gemini integrado.' }
];

const FILL_POOL: FillItem[] = [
  { sentence: 'El LLM de Google que reemplazó a Bard se llama _____.', allOpts: ['Gemini','Copilot','Claude','Grok'], correct: 0, explain: 'Gemini es el nombre oficial del LLM de Google desde 2024.' },
  { sentence: 'La ventaja más importante de Gemini es su integración con el _____ de Google.', allOpts: ['ecosistema','hardware','algoritmo','servidor'], correct: 0, explain: '"Ecosistema" es la palabra clave.' },
  { sentence: 'Cuando Gemini consulta Google para responder con datos de hoy, accede a información en tiempo _____.', allOpts: ['real','libre','digital','programado'], correct: 0, explain: '"Tiempo real" significa información actual — de hoy, de esta semana.' }
];

const PROMPT_POOL: PromptItem[] = [
  { task: 'Pedir a Gemini información sobre un tema actual',
    bad: 'Dime qué pasa en el mundo',
    good: 'Busca las 3 noticias más importantes de ciencia y tecnología de esta semana. Para cada una: título, resumen de 2 líneas y por qué importa para un estudiante de 12 años.',
    explain: 'El prompt bueno especifica el tema, el período, la cantidad y el formato exacto.' },
  { task: 'Usar Gemini para preparar una presentación escolar',
    bad: 'Ayúdame con mi presentación',
    good: 'Estoy en 7° grado en México. Tengo que hacer una presentación de 5 slides sobre el calentamiento global. Busca datos actualizados de 2024. Para cada slide: título, 3 puntos clave y una estadística reciente con su fuente.',
    explain: 'El prompt especifica grado, país, tema, formato y pide datos recientes con fuentes.' },
  { task: 'Pedirle a Gemini que resuma un video educativo',
    bad: 'Resume este video',
    good: 'Aquí está el link del video de YouTube de mi clase de historia: [link]. Resume los 5 puntos más importantes en orden de aparición. Luego dame 3 preguntas de práctica.',
    explain: 'El prompt especifica la fuente (YouTube), formato (5 puntos) y pide un paso adicional útil.' }
];

const USECASE_POOL: DragItemG[] = [
  { text: 'Buscar qué pasó en las noticias hoy', correct: 'usa' },
  { text: 'Analizar un texto literario de 40 páginas en detalle', correct: 'no-usa' },
  { text: 'Resumir un video de YouTube de tu clase', correct: 'usa' },
  { text: 'Pedir una pizza a domicilio', correct: 'no-usa' },
  { text: 'Editar un documento en Google Docs con IA', correct: 'usa' },
  { text: 'Ver el saldo de tu cuenta bancaria', correct: 'no-usa' },
  { text: 'Buscar artículos académicos recientes sobre un tema', correct: 'usa' },
  { text: 'Hacer una llamada telefónica', correct: 'no-usa' },
  { text: 'Resumir los correos de Gmail que no has leído', correct: 'usa' },
  { text: 'Analizar datos en tu hoja de Google Sheets', correct: 'usa' }
];

const TOTAL_STEPS = 22;
const pickN = <T,>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};

interface LevelProps { navigation?: any; setAllowBack?: (allow: boolean) => void; }

export default function World4Level3({ navigation: propsNavigation, setAllowBack }: LevelProps) {
  const nav = useNavigation();
  const navigation = propsNavigation || nav;
  const completeLevel = useGameStore(s => s.completeLevel);

  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);

  // Pools fijas
  const drag1Items = useRef(pickN(DRAG_POOL, 10)).current;
  const matchPairs = useRef(pickN(MATCH_POOL, 4)).current;
  const quizItems = useRef(pickN(QUIZ_POOL, 4)).current;
  const tfItems = useRef(pickN(TF_POOL, 5)).current;
  const fillItems = useRef(pickN(FILL_POOL, 3)).current;
  const promptItems = useRef(pickN(PROMPT_POOL, 3)).current;
  const drag2Items = useRef(pickN(USECASE_POOL, 8)).current;

  // Drag 1 (fortalezas)
  const [d1Placed, setD1Placed] = useState<{ [key: number]: string }>({});
  const [d1Sel, setD1Sel] = useState<number | null>(null);
  const [d1Ok, setD1Ok] = useState(false);

  // Matching
  const [matchSel, setMatchSel] = useState<number | null>(null);
  const [matchedLeft, setMatchedLeft] = useState<Set<number>>(new Set());
  const [matchedRight, setMatchedRight] = useState<Set<number>>(new Set());
  const [rightOrder] = useState(() => matchPairs.map(p => p.right).sort(() => Math.random() - 0.5));

  // Sort
  const [sortOrder, setSortOrder] = useState<number[]>([]);
  const [sortOk, setSortOk] = useState(false);

  // Quiz
  const [quizAns, setQuizAns] = useState<{ [key: number]: number }>({});
  const [quizChecked, setQuizChecked] = useState(false);

  // TF
  const [tfAns, setTfAns] = useState<{ [key: number]: boolean }>({});
  const [tfChecked, setTfChecked] = useState(false);

  // Fill
  const [fillAns, setFillAns] = useState<{ [key: number]: number }>({});
  const [fillDone, setFillDone] = useState<Set<number>>(new Set());

  // Drag 2 (casos de uso)
  const [d2Placed, setD2Placed] = useState<{ [key: number]: string }>({});
  const [d2Sel, setD2Sel] = useState<number | null>(null);
  const [d2Ok, setD2Ok] = useState(false);

  // Prompts
  const [promptSels, setPromptSels] = useState<{ [key: number]: string }>({});
  const [promptsChecked, setPromptsChecked] = useState(false);

  // Reflexión
  const [reflectText, setReflectText] = useState('');

  const theorySteps = new Set([0, 1, 2, 4, 6, 7, 8, 11, 15, 13, 18, 19]);
  const canGoBack = theorySteps.has(step);

  useEffect(() => { setAllowBack?.(canGoBack); }, [canGoBack]);
  useEffect(() => {
    const h = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack) { Alert.alert('Actividad en curso', 'Completa la actividad.'); return true; }
      return false;
    });
    return () => h.remove();
  }, [canGoBack]);
  useEffect(() => { if (step === 9) setSortOrder([0, 1, 2, 3, 4].sort(() => Math.random() - 0.5)); }, [step]);

  const addXP = (v: number) => setXp(p => p + v);
  const nextStep = () => { if (step < TOTAL_STEPS - 1) setStep(step + 1); };
  const finish = () => {
    let stars = xp >= 140 ? 3 : xp >= 90 ? 2 : 1;
    completeLevel(21, stars, xp);
    router.back();
  };

  // Drag 1
  const handleD1Drop = (zone: string) => { if (d1Sel === null) return; setD1Placed(p => ({ ...p, [d1Sel]: zone })); setD1Sel(null); };
  const removeD1 = (idx: number) => { setD1Placed(p => { const n = { ...p }; delete n[idx]; return n; }); };
  const checkD1 = () => {
    let correct = 0; drag1Items.forEach((item, i) => { if (d1Placed[i] === item.correct) correct++; });
    if (correct === drag1Items.length) { setD1Ok(true); addXP(20); Alert.alert('✅', '¡Perfecto!'); }
    else Alert.alert('❌', `${correct}/${drag1Items.length} correctos.`);
  };

  // Matching
  const handleMatchLeft = (i: number) => { if (matchedLeft.has(i)) return; setMatchSel(i); };
  const handleMatchRight = (ri: number) => {
    if (matchSel === null || matchedRight.has(ri)) return;
    if (rightOrder[ri] === matchPairs[matchSel].right) {
      setMatchedLeft(p => new Set(p).add(matchSel)); setMatchedRight(p => new Set(p).add(ri)); setMatchSel(null);
      if (matchedLeft.size + 1 >= matchPairs.length) { addXP(15); }
    } else { Alert.alert('❌', 'Esa combinación no es correcta.'); setMatchSel(null); }
  };

  // Sort
  const moveSort = (pos: number, dir: number) => {
    const np = pos + dir; if (np < 0 || np >= 5) return;
    const no = [...sortOrder]; [no[pos], no[np]] = [no[np], no[pos]]; setSortOrder(no);
  };
  const checkSort = () => {
    const ok = sortOrder.every((v, i) => v === i);
    if (ok) { setSortOk(true); addXP(15); Alert.alert('✅', '¡Orden perfecto!'); }
    else Alert.alert('❌', 'Revisa el orden.');
  };

  // Quiz
  const checkQuiz = () => { setQuizChecked(true); let c = 0; quizItems.forEach((q, i) => { if (quizAns[i] === q.correct) c++; }); addXP(c * 8); };
  // TF
  const checkTF = () => { setTfChecked(true); let c = 0; tfItems.forEach((q, i) => { if (tfAns[i] === q.correct) c++; }); addXP(c * 6); };
  // Fill
  const selectFill = (qi: number, oi: number) => { if (fillDone.has(qi)) return; setFillDone(p => new Set(p).add(qi)); setFillAns(p => ({ ...p, [qi]: oi })); if (oi === fillItems[qi].correct) addXP(8); };
  // Drag 2
  const handleD2Drop = (zone: string) => { if (d2Sel === null) return; setD2Placed(p => ({ ...p, [d2Sel]: zone })); setD2Sel(null); };
  const removeD2 = (idx: number) => { setD2Placed(p => { const n = { ...p }; delete n[idx]; return n; }); };
  const checkD2 = () => {
    let correct = 0; drag2Items.forEach((item, i) => { if (d2Placed[i] === item.correct) correct++; });
    if (correct === drag2Items.length) { setD2Ok(true); addXP(20); Alert.alert('✅', '¡Excelente!'); }
    else Alert.alert('❌', `${correct}/${drag2Items.length} correctos.`);
  };
  // Prompts
  const selectPrompt = (qi: number, which: string) => { if (promptsChecked) return; setPromptSels(p => ({ ...p, [qi]: which })); };
  const checkPrompts = () => { setPromptsChecked(true); let c = 0; promptItems.forEach((_, i) => { if (promptSels[i] === 'good') c++; }); addXP(c * 10); };
  // Reflexión
  const submitReflect = () => { if (reflectText.trim().length >= 70) { addXP(15); nextStep(); } else Alert.alert('Muy corto', 'Mínimo 70 caracteres.'); };

  // Botón helper
  const btn = (label: string, onPress: () => void, disabled = false) => (
    <TouchableOpacity style={[styles.btn, disabled && styles.btnOff]} onPress={onPress} disabled={disabled}>
      <Text style={styles.btnText}>{label}</Text>
    </TouchableOpacity>
  );

  const renderStep = () => {
    switch (step) {
      case 0: return (
        <View style={styles.stepContainer}>
          <View style={styles.iconCircle}><Text style={styles.iconEmoji}>✦</Text></View>
          <Text style={styles.title}>Gemini — La IA que vive en el ecosistema Google</Text>
          <Text style={styles.subtitle}>El LLM de Google que busca en internet, trabaja dentro de Gmail, Docs, Drive y YouTube, y conecta todo el universo Google.</Text>
          <View style={styles.card}><Text style={styles.cardTitle}>📚 Qué vas a aprender</Text><Text style={styles.cardText}>Historia de Bard→Gemini, integración con Google, cuándo usarlo y cuándo no, prompts con búsqueda en tiempo real.</Text></View>
          <View style={styles.card}><Text style={styles.cardTitle}>⚡ Lo nuevo</Text><Text style={styles.cardText}>Un LLM con acceso real a internet en tiempo real. Eso cambia completamente las preguntas que puedes hacerle.</Text></View>
          {btn('¡Empecemos! 🚀', nextStep)}
        </View>
      );
      case 1: return (<View style={styles.stepContainer}><Text style={styles.tag}>Nivel 21 · 19 módulos</Text><Text style={styles.tag}>📖 Módulo 1 · Teoría</Text><Text style={styles.title}>De Bard a Gemini</Text><Text style={styles.body}>Google lanzó Bard en 2023 como respuesta a ChatGPT. En 2024 lo reemplazó con Gemini, desarrollado por Google DeepMind. Gemini no es solo un chatbot: es la IA central de todo el ecosistema Google.</Text><Text style={styles.body}>Modelos: Flash (rápido), Pro (equilibrado), Advanced (más potente, con integración completa a Workspace).</Text>{btn('Entendido →', nextStep)}</View>);
      case 2: return (<View style={styles.stepContainer}><Text style={styles.tag}>🌍 Módulo 2 · Casos del mundo</Text><Text style={styles.title}>Gemini en el mundo real</Text><Text style={styles.body}>🎓 Estudiante en Kenya investigando con fuentes actualizadas{'\n'}💼 Emprendedor en Singapur gestionando correos con IA{'\n'}🎬 Creadora en Brasil analizando videos de YouTube{'\n'}🏫 Profesor en Finlandia creando materiales con datos actualizados{'\n'}📊 Analista en Australia trabajando con Sheets en lenguaje natural</Text>{btn('¡Los vi todos! →', nextStep)}</View>);
      case 3: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>🎯 Módulo 3 · Clasificar</Text>
          <Text style={styles.title}>¿Cuándo Gemini brilla y cuándo no?</Text>
          <View style={styles.chipWrap}>
            {drag1Items.map((item, i) => d1Placed[i] === undefined && (
              <TouchableOpacity key={i} style={[styles.chip, d1Sel === i && styles.chipOn]} onPress={() => setD1Sel(d1Sel === i ? null : i)}>
                <Text style={styles.chipText}>{item.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.dropRow}>
            {['fortaleza', 'cuidado'].map(zone => (
              <TouchableOpacity key={zone} style={styles.dropZone} onPress={() => handleD1Drop(zone)}>
                <Text style={styles.dropHeader}>{zone === 'fortaleza' ? '✦ Fortaleza' : '⚠️ Usa otra'}</Text>
                {Object.entries(d1Placed).map(([k, v]) => v === zone && (
                  <TouchableOpacity key={k} onPress={() => removeD1(parseInt(k))}>
                    <Text style={styles.dropChip}>{drag1Items[parseInt(k)].text} ✕</Text>
                  </TouchableOpacity>
                ))}
              </TouchableOpacity>
            ))}
          </View>
          {btn('Verificar', checkD1)}
        </View>
      );
      case 4: return (<View style={styles.stepContainer}><Text style={styles.tag}>📖 Módulo 4 · Teoría</Text><Text style={styles.title}>El ecosistema Google</Text><Text style={styles.body}>Gemini vive dentro de Gmail, Docs, Sheets, YouTube, Drive y Maps. No tienes que salir de tus herramientas para usarlo. Claude y ChatGPT son destinos — Gemini es un ingrediente que ya está donde trabajas.</Text>{btn('Entendido →', nextStep)}</View>);
      case 5: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>🔗 Módulo 5 · Conectar</Text>
          <Text style={styles.title}>Producto Google → ¿Qué hace Gemini ahí?</Text>
          <View style={styles.matchRow}>
            <View style={{ flex: 1 }}>
              {matchPairs.map((p, i) => (
                <TouchableOpacity key={i} style={[styles.matchCard, matchSel === i && styles.matchCardSel, matchedLeft.has(i) && styles.matchCardDone]} onPress={() => handleMatchLeft(i)} disabled={matchedLeft.has(i)}>
                  <Text style={styles.matchText}>{p.left}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flex: 1 }}>
              {rightOrder.map((r, i) => (
                <TouchableOpacity key={i} style={[styles.matchCard, matchedRight.has(i) && styles.matchCardDone]} onPress={() => handleMatchRight(i)} disabled={matchedRight.has(i)}>
                  <Text style={styles.matchText}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      );
      case 6: return (<View style={styles.stepContainer}><Text style={styles.tag}>📖 Módulo 6 · Teoría</Text><Text style={styles.title}>Gemini vs Claude vs ChatGPT</Text><Text style={styles.body}>Gemini gana en: internet en tiempo real, integración Google, resumir YouTube. Claude gana en: textos muy largos, honestidad, análisis profundo. ChatGPT gana en: imágenes (DALL·E), plugins, adopción masiva.</Text>{btn('Entendido →', nextStep)}</View>);
      case 7: return (<View style={styles.stepContainer}><Text style={styles.tag}>📖 Módulo 7 · Teoría</Text><Text style={styles.title}>¿Cómo busca Gemini en internet?</Text><Text style={styles.body}>1. Detecta que necesita info actual{'\n'}2. Ejecuta una búsqueda en Google{'\n'}3. Lee y analiza las fuentes{'\n'}4. Sintetiza y cita con links a las fuentes</Text>{btn('Entendido →', nextStep)}</View>);
      case 8: return (<View style={styles.stepContainer}><Text style={styles.tag}>📖 Módulo 8 · Teoría</Text><Text style={styles.title}>Cómo hablarle a Gemini</Text><Text style={styles.body}>Usa la fórmula de siempre (Rol + Contexto + Tarea + Formato) y añade: período de tiempo, links directos, y pide citas/fuentes. Gemini puede buscar en Google mientras responde.</Text>{btn('Entendido →', nextStep)}</View>);
      case 9: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>🔢 Módulo 9 · Ordenar</Text>
          <Text style={styles.title}>Proceso de búsqueda de Gemini</Text>
          {sortOrder.map((val, pos) => (
            <View key={pos} style={styles.sortRow}>
              <Text style={styles.sortText}>{pos + 1}. {GEMINI_SORT[val]}</Text>
              <View style={styles.arrowCol}>
                <TouchableOpacity onPress={() => moveSort(pos, -1)} disabled={pos === 0}><Text>▲</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => moveSort(pos, 1)} disabled={pos === 4}><Text>▼</Text></TouchableOpacity>
              </View>
            </View>
          ))}
          {btn('Verificar orden', checkSort)}
        </View>
      );
      case 10: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>🧠 Módulo 10 · Quiz</Text>
          {quizItems.map((q, i) => (
            <View key={i}>
              <Text style={styles.qText}>{q.q}</Text>
              {q.opts.map((o, j) => (
                <TouchableOpacity key={j} style={[styles.quizOpt, quizAns[i] === j && styles.quizOptOn]} onPress={() => setQuizAns(p => ({ ...p, [i]: j }))} disabled={quizChecked}>
                  <Text>{o}</Text>
                </TouchableOpacity>
              ))}
              {quizChecked && <Text style={quizAns[i] === q.correct ? styles.fbGood : styles.fbBad}>{q.explain}</Text>}
            </View>
          ))}
          {!quizChecked ? btn('Comprobar', checkQuiz) : btn('Continuar →', nextStep)}
        </View>
      );
      case 11: return (<View style={styles.stepContainer}><Text style={styles.tag}>📖 Módulo 11 · Teoría</Text><Text style={styles.title}>Gemini como asistente de investigación</Text><Text style={styles.body}>Flujo ideal: 1) Define tema y período, 2) Pide mapa del tema, 3) Profundiza con fuentes, 4) Verifica fuentes, 5) Pide estructura. Gemini hace la búsqueda, pero la investigación sigue siendo tuya.</Text>{btn('Entendido →', nextStep)}</View>);
      case 12: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>✅❌ Módulo 12 · V/F</Text>
          {tfItems.map((q, i) => (
            <View key={i} style={{ marginBottom: 14 }}>
              <Text style={styles.qText}>{q.stmt}</Text>
              <View style={styles.row}>
                <TouchableOpacity style={[styles.tfBtn, tfAns[i] === true && styles.tfOn]} onPress={() => setTfAns(p => ({ ...p, [i]: true }))} disabled={tfChecked}><Text>✅ V</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.tfBtn, tfAns[i] === false && styles.tfOff]} onPress={() => setTfAns(p => ({ ...p, [i]: false }))} disabled={tfChecked}><Text>❌ F</Text></TouchableOpacity>
              </View>
              {tfChecked && <Text style={tfAns[i] === q.correct ? styles.fbGood : styles.fbBad}>{q.explain}</Text>}
            </View>
          ))}
          {!tfChecked ? btn('Comprobar', checkTF) : btn('Continuar →', nextStep)}
        </View>
      );
      case 13: return (<View style={styles.stepContainer}><Text style={styles.tag}>📚 Módulo 13 · Caso real</Text><Text style={styles.title}>Aiko investiga energía solar</Text><Text style={styles.body}>Aiko, 13 años, Osaka. Tenía 48h para investigar avances en energía solar. Con Gemini: buscó datos 2024, profundizó en el hallazgo más interesante, lo convirtió a su nivel y estructuró 5 slides. Terminó en 3h en vez de 2 días.</Text>{btn('Entendido →', nextStep)}</View>);
      case 14: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>📝 Módulo 14 · Vocabulario</Text>
          {fillItems.map((q, qi) => (
            <View key={qi}>
              <Text style={styles.fillSentence}>{q.sentence}</Text>
              <View style={styles.optWrap}>
                {q.allOpts.map((o, oi) => (
                  <TouchableOpacity key={oi} style={[styles.fillOpt, fillAns[qi] === oi && styles.fillOptOn]} onPress={() => selectFill(qi, oi)} disabled={fillDone.has(qi)}>
                    <Text>{o}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
          {fillDone.size >= fillItems.length && btn('Continuar →', nextStep)}
        </View>
      );
      case 15: return (<View style={styles.stepContainer}><Text style={styles.tag}>📖 Módulo 15 · Teoría</Text><Text style={styles.title}>Gemini y tu privacidad</Text><Text style={styles.body}>Cuando usas Gemini en Gmail o Drive, le das acceso a información personal. Google afirma que en cuentas educativas tus datos no se usan para entrenar modelos. Regla: no compartas información extremadamente sensible con ningún LLM.</Text>{btn('Entendido →', nextStep)}</View>);
      case 16: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>🎯 Módulo 16 · Clasificar</Text>
          <Text style={styles.title}>¿Gemini es ideal o hay algo mejor?</Text>
          <View style={styles.chipWrap}>
            {drag2Items.map((item, i) => d2Placed[i] === undefined && (
              <TouchableOpacity key={i} style={[styles.chip, d2Sel === i && styles.chipOn]} onPress={() => setD2Sel(d2Sel === i ? null : i)}>
                <Text style={styles.chipText}>{item.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.dropRow}>
            {['usa', 'no-usa'].map(zone => (
              <TouchableOpacity key={zone} style={styles.dropZone} onPress={() => handleD2Drop(zone)}>
                <Text style={styles.dropHeader}>{zone === 'usa' ? '✦ Gemini ideal' : '🔄 Hay mejor'}</Text>
                {Object.entries(d2Placed).map(([k, v]) => v === zone && (
                  <TouchableOpacity key={k} onPress={() => removeD2(parseInt(k))}>
                    <Text style={styles.dropChip}>{drag2Items[parseInt(k)].text} ✕</Text>
                  </TouchableOpacity>
                ))}
              </TouchableOpacity>
            ))}
          </View>
          {btn('Verificar', checkD2)}
        </View>
      );
      case 17: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>🔍 Módulo 17 · Prompts</Text>
          <Text style={styles.title}>¿Cuál prompt aprovecha mejor a Gemini?</Text>
          {promptItems.map((item, qi) => (
            <View key={qi}>
              <Text style={styles.qText}>🎯 {item.task}</Text>
              <TouchableOpacity style={[styles.promptCard, promptSels[qi] === 'bad' && styles.promptCardBad]} onPress={() => selectPrompt(qi, 'bad')} disabled={promptsChecked}>
                <Text style={styles.promptLabel}>Prompt A:</Text><Text style={styles.promptText}>{item.bad}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.promptCard, promptSels[qi] === 'good' && styles.promptCardGood]} onPress={() => selectPrompt(qi, 'good')} disabled={promptsChecked}>
                <Text style={styles.promptLabel}>Prompt B:</Text><Text style={styles.promptText}>{item.good}</Text>
              </TouchableOpacity>
              {promptsChecked && <Text style={promptSels[qi] === 'good' ? styles.fbGood : styles.fbBad}>{item.explain}</Text>}
            </View>
          ))}
          {!promptsChecked ? btn('Comprobar elecciones', checkPrompts) : btn('Continuar →', nextStep)}
        </View>
      );
      case 18: return (<View style={styles.stepContainer}><Text style={styles.tag}>🚀 Módulo 18 · Bonus</Text><Text style={styles.title}>Hacia dónde va Gemini</Text><Text style={styles.body}>Generación de video con Veo, Google Maps conversacional, Gemini en Android como asistente principal, Google Classroom + Gemini. Google está convirtiendo a Gemini en el sistema nervioso de toda su plataforma.</Text>{btn('Entendido →', nextStep)}</View>);
      case 19: return (<View style={styles.stepContainer}><Text style={styles.tag}>🏆 Módulo 19 · Desafío</Text><Text style={styles.title}>Elige la herramienta correcta</Text><Text style={styles.body}>Situación 1 (datos actuales) → Gemini{'\n'}Situación 2 (novela larga) → Claude{'\n'}Situación 3 (imagen) → ChatGPT con DALL·E{'\n'}La habilidad más valiosa no es dominar uno, sino saber cuándo usar cada uno.</Text>{btn('Entendido →', nextStep)}</View>);
      case 20: return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>✍️ Reflexión final</Text>
          <Text style={styles.title}>¿Cómo vas a integrar Gemini a tu vida?</Text>
          <TextInput style={styles.textArea} placeholder="¿Cuándo usarías Gemini en vez de Claude? ¿Y al revés?" value={reflectText} onChangeText={setReflectText} multiline />
          {btn('Enviar reflexión →', submitReflect, reflectText.trim().length < 70)}
        </View>
      );
      case 21: return (
        <View style={styles.completeContainer}>
          <View style={styles.completeIcon}><Text style={styles.iconEmoji}>✦</Text></View>
          <Text style={styles.completeTitle}>¡Nivel 21 completado!</Text>
          <Text style={styles.completeSub}>Ahora dominas Gemini: búsqueda en tiempo real, integración Google, y sabes cuándo usarlo vs Claude vs ChatGPT.</Text>
          <Text style={styles.xpBig}>⭐ {xp} XP ganados</Text>
          {btn('Volver al mapa', finish)}
        </View>
      );
      default: return null;
    }
  };

  const progressPercent = (step / (TOTAL_STEPS - 1)) * 100;

  return (
    <View style={styles.screen}>
      <View style={styles.bar}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialIcons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.track}><View style={[styles.fill, { width: `${progressPercent}%` }]} /></View>
        <Text style={styles.xpChip}>{xp} XP</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>{renderStep()}</ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  bar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  track: { flex: 1, height: 6, backgroundColor: colors.borderLight, borderRadius: 3, marginHorizontal: 12 },
  fill: { height: '100%', backgroundColor: '#1a73e8', borderRadius: 3 },
  xpChip: { ...typography.bold, fontSize: 14, color: '#1a56db' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  stepContainer: { flex: 1 },
  tag: { fontSize: 11, fontWeight: '600', color: '#1a56db', backgroundColor: '#e8f0fe', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 12, alignSelf: 'flex-start' },
  iconCircle: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#e8f0fe', justifyContent: 'center', alignItems: 'center', marginBottom: 14, alignSelf: 'center' },
  iconEmoji: { fontSize: 32 },
  title: { ...typography.extraBold, fontSize: 19, color: colors.textPrimary, marginBottom: 8, textAlign: 'center' },
  subtitle: { ...typography.regular, fontSize: 13, color: colors.textSecondary, marginBottom: 14, lineHeight: 18, textAlign: 'center' },
  body: { ...typography.regular, fontSize: 13, color: colors.textPrimary, lineHeight: 20, marginBottom: 12 },
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  cardTitle: { ...typography.bold, fontSize: 13, color: colors.textPrimary, marginBottom: 4 },
  cardText: { ...typography.regular, fontSize: 12, color: colors.textSecondary },
  btn: { backgroundColor: '#1a73e8', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  btnText: { ...typography.bold, color: '#fff', fontSize: 15 },
  btnOff: { opacity: 0.4 },
  qText: { ...typography.bold, padding: 10, backgroundColor: '#f8fafc', borderRadius: 8, marginBottom: 6 },
  quizOpt: { padding: 10, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, marginBottom: 4 },
  quizOptOn: { borderColor: '#1a73e8', backgroundColor: '#e8f0fe' },
  fbGood: { color: '#166534', fontSize: 11, marginTop: 4 },
  fbBad: { color: '#991b1b', fontSize: 11, marginTop: 4 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  tfBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  tfOn: { backgroundColor: '#f0fdf4', borderColor: '#16a34a' },
  tfOff: { backgroundColor: '#fef2f2', borderColor: '#dc2626' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 10, backgroundColor: '#f8fafc', borderRadius: 12, marginBottom: 12 },
  chip: { padding: 8, borderRadius: 20, borderWidth: 1, borderColor: '#cbd5e1' },
  chipOn: { borderColor: '#1a73e8', backgroundColor: '#e8f0fe' },
  chipText: { fontSize: 11 },
  dropRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  dropZone: { flex: 1, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 8, minHeight: 80 },
  dropHeader: { fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  dropChip: { fontSize: 10, padding: 4, backgroundColor: '#e8f0fe', borderRadius: 6 },
  matchRow: { flexDirection: 'row', gap: 10 },
  matchCard: { backgroundColor: colors.surface, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 6 },
  matchCardSel: { borderColor: '#1a73e8', backgroundColor: '#e8f0fe' },
  matchCardDone: { backgroundColor: '#f0fdf4', borderColor: '#16a34a' },
  matchText: { fontSize: 11 },
  sortRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 10, backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, marginBottom: 6 },
  sortText: { flex: 1, fontSize: 12 },
  arrowCol: { flexDirection: 'column' },
  fillSentence: { padding: 12, backgroundColor: '#f9fafb', borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 8, ...typography.bold },
  optWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  fillOpt: { padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  fillOptOn: { borderColor: '#1a73e8', backgroundColor: '#e8f0fe' },
  promptCard: { borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: '#e5e7eb', marginBottom: 8 },
  promptCardBad: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  promptCardGood: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  promptLabel: { fontSize: 10, fontWeight: '700', marginBottom: 4 },
  promptText: { fontSize: 12, color: '#374151', lineHeight: 18 },
  textArea: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, minHeight: 100, fontSize: 13, backgroundColor: '#fafafa', marginBottom: 10 },
  completeContainer: { alignItems: 'center', padding: 20 },
  completeIcon: { width: 86, height: 86, borderRadius: 24, backgroundColor: '#e8f0fe', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  completeTitle: { ...typography.extraBold, fontSize: 21 },
  completeSub: { ...typography.regular, textAlign: 'center', marginVertical: 8 },
  xpBig: { ...typography.bold, fontSize: 18, color: '#1a56db', marginBottom: 16 },
});