import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, BackHandler,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useGameStore } from '../../store/gameStore';
import { colors, typography } from '../../theme';

// ---------- Tipos ----------
type CompareItem = {
  tarea: string; sinEj: { prompt: string; resp: string }; conEj: { prompt: string; resp: string };
  q: string; opts: string[]; correct: number; explain: string;
};
type MatchItem = { situacion: string; tecnica: string; razon: string };
type FillRole = { incompleto: string; campos: string[]; correcto: string };
type ShotsCompare = {
  tarea: string; cero: any; uno: any; tres: any; q: string; opts: string[]; correct: number; explain: string;
};
type SprintItem = { situacion: string; correcta: string; otras: string[] };
type DragItem = { text: string; cat: string };
type QuizItem = { prompt: string; tecnica: string; opts: string[]; correct: number; explain: string };

// ---------- Datos ----------
const COMPARE_ONESHOT: CompareItem = {
  tarea: "Escribe un título atractivo para un artículo de blog",
  sinEj: { prompt: "Escribe un título atractivo para un artículo sobre productividad estudiantil.", resp: "10 consejos para mejorar tu productividad como estudiante" },
  conEj: { prompt: "Escribe un título atractivo para un artículo sobre productividad estudiantil. Ejemplo del estilo que quiero: 'Por qué estudiar 8 horas seguidas destruye tu memoria (y qué hacer en su lugar)'", resp: "El error que comete el 90% de estudiantes antes de un examen — y cómo evitarlo" },
  q: "¿Qué aportó el ejemplo al resultado?",
  opts: ["Hizo el prompt más largo", "Definió tono, formato y estilo concreto", "Activó un modo especial de creatividad", "Dio más información sobre el tema"],
  correct: 1,
  explain: "El ejemplo no explica el estilo — lo muestra. El modelo captura el patrón y lo replica."
};

const MATCHING_SHOTS: MatchItem[] = [
  { situacion: "Quieres que la IA genere tweets en tu estilo personal exacto", tecnica: "Few-shot (3+ ejemplos)", razon: "Tu estilo es imposible de describir — hay que mostrarlo con ejemplos reales." },
  { situacion: "Preguntas cuándo fue la Revolución Francesa", tecnica: "Zero-shot", razon: "Dato factual claro, sin necesidad de ejemplos." },
  { situacion: "Quieres que clasifique emails como urgente/normal/spam", tecnica: "Few-shot (3+ ejemplos)", razon: "Criterios subjetivos — sin ejemplos la IA usa criterios genéricos." },
  { situacion: "Le pides que traduzca una frase al inglés", tecnica: "Zero-shot", razon: "Tarea estándar bien definida." },
  { situacion: "Generar nombres de marca con un sonido específico que describes vagamente", tecnica: "One-shot", razon: "Un ejemplo ancla tono y estética mejor que una descripción." }
];

const FILL_ROLES: FillRole[] = [{
  incompleto: "Actúa como experta en marketing digital.",
  campos: ["Años de experiencia y especialidad", "Industria o tipo de cliente", "Estilo de comunicación o enfoque"],
  correcto: "Actúa como una estratega de marketing digital con 12 años de experiencia especializada en startups B2B de tecnología en América Latina. Tu enfoque es data-driven pero con storytelling. Eres directa, evitas marketing genérico y conectas tácticas con negocio real."
}];

const COMPARE_SHOTS: ShotsCompare = {
  tarea: "Genera un feedback constructivo para un trabajo escolar",
  cero: { label: "Zero-shot", prompt: "Da feedback constructivo sobre este ensayo: [texto]", resp: "El ensayo tiene buenas ideas pero puede mejorar en claridad, estructura y desarrollo." },
  uno: { label: "One-shot", prompt: "Da feedback... Ejemplo del tono: 'Tu tesis es sólida. El segundo párrafo pierde el hilo...' Ensayo: [texto]", resp: "Tu argumento central es claro. El tercer párrafo introduce datos interesantes pero sin análisis." },
  tres: { label: "Few-shot (3 ejemplos)", prompt: "Da feedback... Ejemplos de feedback que me gustan: 1) 'Fortaleza: argumento claro. Mejora: ejemplo contradice tesis.' 2) ... 3) ...", resp: "Fortaleza: tu introducción establece posición original. Mejora: el párrafo 4 introduce contraargumento que no resuelves." },
  q: "¿Cuándo el few-shot (3 ejemplos) justifica el esfuerzo extra?",
  opts: ["Siempre", "Cuando el formato y tono específicos son críticos y difíciles de describir", "Solo si la IA falló dos veces", "Cuando tienes más de 5 minutos"],
  correct: 1,
  explain: "Few-shot vale el esfuerzo cuando el criterio de calidad es tan específico que ninguna descripción verbal lo captura."
};

const SPRINT_TECNICAS: SprintItem[] = [
  { situacion: "Necesitas que la IA escriba correos de seguimiento en tu estilo exacto", correcta: "Few-shot", otras: ["Zero-shot", "System prompt", "One-shot"] },
  { situacion: "Quieres que la IA sea siempre formal y no use jerga, en cualquier conversación", correcta: "System prompt", otras: ["Zero-shot", "Few-shot", "CoT"] },
  { situacion: "Le preguntas cuál es la capital de Perú", correcta: "Zero-shot", otras: ["Few-shot", "CoT", "System prompt"] },
  { situacion: "Necesitas que resuelva un problema de lógica mostrando cada paso", correcta: "CoT", otras: ["Zero-shot", "Few-shot", "One-shot"] },
  { situacion: "Quieres que genere nombres de startup con un estilo similar a uno que ya tienes", correcta: "One-shot", otras: ["Zero-shot", "Few-shot", "System prompt"] }
];

const DD_TECNICAS: DragItem[] = [
  { text: "Escribir código con errores visibles paso a paso", cat: "cot" },
  { text: "Generar respuestas en un idioma específico siempre", cat: "sys" },
  { text: "Clasificar sentimientos con tu criterio propio", cat: "few" },
  { text: "Traducir una frase estándar al inglés", cat: "zero" },
  { text: "Resumir con el mismo tono que usas en tus reportes", cat: "few" },
  { text: "Analizar un dilema ético listando pros y contras primero", cat: "cot" },
  { text: "Limitar las respuestas a máximo 100 palabras siempre", cat: "sys" },
  { text: "Pedir definición de un concepto conocido", cat: "zero" }
];

const QUIZ_TECNICAS: QuizItem[] = [
  { prompt: "Clasifica estas reseñas como positivas o negativas.\nEjemplo 1: 'El producto llegó roto' → Negativa\nEjemplo 2: 'Superó mis expectativas' → Positiva\nEjemplo 3: 'Funciona pero el envío tardó mucho' → Mixta\nAhora clasifica: 'La calidad es excelente pero el precio es alto'", tecnica: "Few-shot", opts: ["Zero-shot", "One-shot", "Few-shot", "Chain-of-Thought"], correct: 2, explain: "3 ejemplos input→output = few-shot." },
  { prompt: "Analiza este problema de ética empresarial: [caso]. Primero lista los stakeholders afectados. Luego identifica los valores en conflicto. Luego pondera cada opción según impacto. Finalmente recomienda con justificación.", tecnica: "Chain-of-Thought", opts: ["Few-shot", "Zero-shot", "Chain-of-Thought", "System prompt"], correct: 2, explain: "Instrucciones secuenciales explícitas: CoT clásico." },
  { prompt: "Eres un asistente de servicio al cliente de TechCorp. Siempre responde en español formal. Nunca menciones a la competencia. Si no sabes algo, di exactamente: 'Déjame verificar eso con nuestro equipo'.", tecnica: "System prompt", opts: ["Few-shot", "System prompt", "Zero-shot", "One-shot"], correct: 1, explain: "Instrucciones globales que aplican a toda la conversación." },
  { prompt: "Escribe el siguiente email de ventas con este estilo:\nEjemplo: 'Hola [nombre], vi que exploraste nuestra herramienta. Me pregunto si encontraste lo que buscabas...'\nAhora escríbelo para: [producto: software de contabilidad, prospecto: dueño de PYME]", tecnica: "One-shot", opts: ["Zero-shot", "Few-shot", "One-shot", "System prompt"], correct: 2, explain: "Exactamente 1 ejemplo ancla el estilo." },
  { prompt: "¿Cuál es el proceso fotosintético en plantas?", tecnica: "Zero-shot", opts: ["One-shot", "Chain-of-Thought", "Few-shot", "Zero-shot"], correct: 3, explain: "Pregunta directa sin ejemplos ni instrucciones." }
];

const TOTAL_STEPS = 20; // 0..19

interface LevelProps { navigation?: any; setAllowBack?: (allow: boolean) => void; }

export default function World2Level6({ navigation: propsNavigation, setAllowBack }: LevelProps) {
  const nav = useNavigation();
  const navigation = propsNavigation || nav;
  const completeLevel = useGameStore(s => s.completeLevel);

  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);

  // One-shot compare
  const [osChoice, setOsChoice] = useState<number | null>(null);
  const [osAnswered, setOsAnswered] = useState(false);

  // Matching shots
  const [matchAns, setMatchAns] = useState<(string | null)[]>(new Array(5).fill(null));
  const [matchChecked, setMatchChecked] = useState(false);

  // Fill role
  const [fillTexts, setFillTexts] = useState<string[]>(['', '', '']);
  const fillComplete = fillTexts.every(t => t.trim().length >= 8);

  // System prompt builder
  const [sysFields, setSysFields] = useState({ rol: '', audiencia: '', tono: '', limites: '', formato: '' });
  const sysComplete = Object.values(sysFields).every(v => v.trim().length >= 5);

  // Shots compare
  const [shChoice, setShChoice] = useState<number | null>(null);
  const [shAnswered, setShAnswered] = useState(false);

  // Auto-refinamiento builder
  const [refBase, setRefBase] = useState('');
  const [refC1, setRefC1] = useState('');
  const [refC2, setRefC2] = useState('');
  const refComplete = refBase.trim().length >= 15 && refC1.trim().length >= 8 && refC2.trim().length >= 8;

  // Desafío maestro
  const [dmTec, setDmTec] = useState('');
  const [dmPrompt, setDmPrompt] = useState('');
  const dmComplete = dmTec.trim().length >= 5 && dmPrompt.trim().length >= 50;

  // Drag-drop técnicas
  const [ddPool, setDdPool] = useState<DragItem[]>([]);
  const [ddCols, setDdCols] = useState<{ [key: string]: DragItem[] }>({ zero: [], one: [], few: [], cot: [], sys: [] });
  const [ddSel, setDdSel] = useState<number | null>(null);

  // Quiz técnicas
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizDone, setQuizDone] = useState(false);
  const [quizAns, setQuizAns] = useState<number | null>(null);

  // Sprint técnicas
  const [spRunning, setSpRunning] = useState(false);
  const [spIdx, setSpIdx] = useState(0);
  const [spSec, setSpSec] = useState(90);
  const [spScore, setSpScore] = useState(0);
  const [spDone, setSpDone] = useState(false);
  const [spAns, setSpAns] = useState<string | null>(null);

  // Reflexión
  const [reflect, setReflect] = useState('');

  // Librería de plantillas
  const [templates, setTemplates] = useState<string[]>(['', '', '', '', '']);
  const templatesComplete = templates.every(t => t.trim().length >= 15);

  // Few-shot builder (módulo 3)
  const [fsTarea, setFsTarea] = useState('');
  const [fsEjemplos, setFsEjemplos] = useState<string[]>(['', '', '']);
  const fsComplete = fsTarea.trim().length >= 5 && fsEjemplos.every(e => e.trim().length >= 10);

  const theorySteps = new Set([0, 1, 4, 8, 9, 10, 13, 14]);
  const canGoBack = theorySteps.has(step);

  useEffect(() => { setAllowBack?.(canGoBack); }, [canGoBack]);
  useEffect(() => {
    const h = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack) { Alert.alert('Actividad en curso', 'Completa la actividad.'); return true; }
      return false;
    });
    return () => h.remove();
  }, [canGoBack]);

  useEffect(() => { if (step === 16) { setDdPool([...DD_TECNICAS]); setDdCols({ zero: [], one: [], few: [], cot: [], sys: [] }); } }, [step]);

  // Sprint timer
  useEffect(() => {
    if (!spRunning || spDone || spAns !== null) return;
    if (spSec <= 0) { setSpDone(true); return; }
    const t = setTimeout(() => setSpSec(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [spRunning, spSec, spDone, spAns]);

  const addXP = (v: number) => setXp(p => p + v);
  const nextStep = () => { if (step < TOTAL_STEPS - 1) setStep(step + 1); };
  const finish = () => {
    let stars = xp >= 200 ? 3 : xp >= 130 ? 2 : xp >= 60 ? 1 : 0;
    completeLevel(2, 6, stars, xp);
    navigation.goBack();
  };

  // Drag-drop
  const placeDd = (item: DragItem, col: string) => {
    setDdPool(p => p.filter(it => it.text !== item.text));
    setDdCols(c => { const n = { ...c }; Object.keys(n).forEach(k => n[k] = n[k].filter(it => it.text !== item.text)); n[col] = [...n[col], item]; return n; });
    setDdSel(null);
  };
  const returnDd = (item: DragItem, col: string) => {
    setDdCols(c => ({ ...c, [col]: c[col].filter(it => it.text !== item.text) }));
    setDdPool(p => [...p, item]);
  };
  const verifyDd = () => {
    let correct = 0;
    DD_TECNICAS.forEach(item => { if (ddCols[item.cat]?.some(it => it.text === item.text)) correct++; });
    addXP(correct * 7);
    Alert.alert('Resultado', `${correct}/${DD_TECNICAS.length} correctas. +${correct * 7} XP`, [{ text: 'OK', onPress: nextStep }]);
  };

  // Quiz
  const checkQuiz = (ans: number) => {
    setQuizAns(ans);
    if (ans === QUIZ_TECNICAS[quizIdx].correct) setQuizScore(s => s + 1);
  };
  const nextQuiz = () => {
    if (quizIdx + 1 < QUIZ_TECNICAS.length) { setQuizIdx(i => i + 1); setQuizAns(null); }
    else { setQuizDone(true); addXP(quizScore * 12); nextStep(); }
  };

  // Sprint
  const startSp = () => { setSpRunning(true); setSpSec(90); setSpIdx(0); setSpScore(0); setSpDone(false); setSpAns(null); };
  const answerSp = (choice: string) => {
    const correct = choice === SPRINT_TECNICAS[spIdx].correcta;
    if (correct) setSpScore(s => s + 1);
    setSpAns(choice);
  };
  const advanceSp = () => {
    setSpAns(null);
    if (spIdx + 1 < SPRINT_TECNICAS.length) { setSpIdx(i => i + 1); setSpSec(90); }
    else { setSpDone(true); addXP(spScore * 8); nextStep(); }
  };

  // Render
  const btn = (label: string, onPress: () => void, disabled = false) => (
    <TouchableOpacity style={[styles.btn, disabled && styles.btnOff]} onPress={onPress} disabled={disabled}>
      <Text style={styles.btnText}>{label}</Text>
    </TouchableOpacity>
  );
  const tag = (label: string) => <Text style={styles.tag}>{label}</Text>;
  const title = (t: string) => <Text style={styles.title}>{t}</Text>;
  const sub = (t: string) => <Text style={styles.subtitle}>{t}</Text>;
  const body = (t: string) => <Text style={styles.body}>{t}</Text>;

  const renderStep = () => {
    switch (step) {
      case 0: return (
        <View style={styles.stepContainer}>
          <View style={styles.iconCircle}><Text style={styles.iconEmoji}>🔑</Text></View>
          {title('Trucos Secretos')}
          {sub('El nivel final del Mundo 2. Técnicas que usan los ingenieros de IA y power users.')}
          {body('Zero-shot / One-shot / Few-shot · System prompts · Temperatura · ReAct · Librería personal.')}
          {btn('¡Empezar! →', nextStep)}
        </View>
      );
      case 1: return (<View style={styles.stepContainer}>{tag('🎯 Módulo 1 · Zero-shot')}{title('Zero-shot: pedir sin ejemplos')}{body('Funciona para tareas estándar (traducir, definir, calcular). Falla cuando el criterio de calidad es subjetivo y la IA no conoce tu estilo.')}{btn('Continuar →', nextStep)}</View>);
      case 2: return (<View style={styles.stepContainer}>{tag('1️⃣ Módulo 2 · One-shot')}{title('Un ejemplo lo cambia todo')}<Text style={styles.body}>{COMPARE_ONESHOT.tarea}</Text><View style={styles.card}><Text style={styles.cardTitle}>Zero-shot</Text><Text style={styles.cardText}>{COMPARE_ONESHOT.sinEj.resp}</Text></View><View style={styles.card}><Text style={styles.cardTitle}>One-shot</Text><Text style={styles.cardText}>{COMPARE_ONESHOT.conEj.resp}</Text></View><Text style={styles.qText}>{COMPARE_ONESHOT.q}</Text>{COMPARE_ONESHOT.opts.map((o, i) => (<TouchableOpacity key={i} style={[styles.quizOpt, osChoice === i && styles.quizOptOn]} onPress={() => { if (!osAnswered) { setOsChoice(i); setOsAnswered(true); if (i === COMPARE_ONESHOT.correct) addXP(12); } }} disabled={osAnswered}><Text>{o}</Text></TouchableOpacity>))}{osAnswered && <Text style={osChoice === COMPARE_ONESHOT.correct ? styles.fbGood : styles.fbBad}>{COMPARE_ONESHOT.explain}</Text>}{osAnswered && btn('Continuar →', nextStep)}</View>);
      case 3: return (<View style={styles.stepContainer}>{tag('📚 Módulo 3 · Few-shot Builder')}{title('Few-shot: tus 3 ejemplos')}<TextInput style={styles.input} placeholder="¿Para qué tarea?" value={fsTarea} onChangeText={setFsTarea} />{fsEjemplos.map((e, i) => (<TextInput key={i} style={styles.textArea} placeholder={`Ejemplo ${i+1} (input→output)`} value={e} onChangeText={t => { const n = [...fsEjemplos]; n[i] = t; setFsEjemplos(n); }} multiline />))}{fsComplete && <View style={styles.codeBox}><Text style={styles.codeText}>[Tarea: {fsTarea}] | Ejs: {fsEjemplos.join(' | ')} | Ahora aplica a: [tu input]</Text></View>}{btn('Continuar →', () => { addXP(15); nextStep(); }, !fsComplete)}</View>);
      case 4: return (<View style={styles.stepContainer}>{tag('⚖️ Módulo 4 · Matching')}{title('¿Cuántos ejemplos necesita?')}{MATCHING_SHOTS.map((item, i) => (<View key={i} style={styles.card}><Text style={styles.cardTitle}>{item.situacion}</Text><View style={styles.row}>{['Zero-shot', 'One-shot', 'Few-shot'].map(t => (<TouchableOpacity key={t} style={[styles.tfBtn, matchAns[i] === t && styles.tfOn]} onPress={() => { const a = [...matchAns]; a[i] = t; setMatchAns(a); }} disabled={matchChecked}><Text>{t}</Text></TouchableOpacity>))}</View>{matchChecked && <Text style={matchAns[i] === item.tecnica ? styles.fbGood : styles.fbBad}>{item.razon}</Text>}</View>))}{!matchChecked ? btn('Verificar', () => { setMatchChecked(true); let c = 0; MATCHING_SHOTS.forEach((item, i) => { if (matchAns[i] === item.tecnica) c++; }); addXP(c * 8); }, matchAns.some(a => a === null)) : btn('Continuar →', nextStep)}</View>);
      case 5: return (<View style={styles.stepContainer}>{tag('🎭 Módulo 5 · Fill-in-blank')}{title('El truco del personaje complejo')}{body(`Rol básico: "${FILL_ROLES[0].incompleto}"`)}{FILL_ROLES[0].campos.map((c, i) => (<View key={i}><Text style={styles.label}>{c}</Text><TextInput style={styles.input} placeholder="Sé específico" value={fillTexts[i]} onChangeText={t => { const n = [...fillTexts]; n[i] = t; setFillTexts(n); }} /></View>))}{btn('Ver personaje completo →', () => { if (fillComplete) { addXP(15); Alert.alert('✅', FILL_ROLES[0].correcto, [{ text: 'OK', onPress: nextStep }]); } }, !fillComplete)}</View>);
      case 6: return (<View style={styles.stepContainer}>{tag('⚙️ Módulo 6 · System Prompt Builder')}{title('Construye tu system prompt')}{Object.entries(sysFields).map(([key, val]) => (<View key={key}><Text style={styles.label}>{key.toUpperCase()}</Text><TextInput style={styles.input} placeholder={`Define ${key}...`} value={val} onChangeText={t => setSysFields(prev => ({ ...prev, [key]: t }))} /></View>))}{sysComplete && <View style={styles.codeBox}><Text style={styles.codeText}>Eres {sysFields.rol}. Audiencia: {sysFields.audiencia}. Tono: {sysFields.tono}. Límites: {sysFields.limites}. Formato: {sysFields.formato}.</Text></View>}{btn('Continuar →', () => { addXP(15); nextStep(); }, !sysComplete)}</View>);
      case 7: return (<View style={styles.stepContainer}>{tag('📊 Módulo 7 · Prompt-compare')}{title('0 / 1 / 3 ejemplos comparados')}{body(COMPARE_SHOTS.tarea)}<View style={styles.card}><Text style={styles.cardTitle}>Zero-shot</Text><Text style={styles.cardText}>{COMPARE_SHOTS.cero.resp}</Text></View><View style={styles.card}><Text style={styles.cardTitle}>One-shot</Text><Text style={styles.cardText}>{COMPARE_SHOTS.uno.resp}</Text></View><View style={styles.card}><Text style={styles.cardTitle}>Few-shot</Text><Text style={styles.cardText}>{COMPARE_SHOTS.tres.resp}</Text></View><Text style={styles.qText}>{COMPARE_SHOTS.q}</Text>{COMPARE_SHOTS.opts.map((o, i) => (<TouchableOpacity key={i} style={[styles.quizOpt, shChoice === i && styles.quizOptOn]} onPress={() => { if (!shAnswered) { setShChoice(i); setShAnswered(true); if (i === COMPARE_SHOTS.correct) addXP(12); } }} disabled={shAnswered}><Text>{o}</Text></TouchableOpacity>))}{shAnswered && <Text style={shChoice === COMPARE_SHOTS.correct ? styles.fbGood : styles.fbBad}>{COMPARE_SHOTS.explain}</Text>}{shAnswered && btn('Continuar →', nextStep)}</View>);
      case 8: return (<View style={styles.stepContainer}>{tag('🌡️ Módulo 8 · Temperatura máxima')}{title('Temperatura alta: modo caótico-creativo')}{body('Alta (0.8-1.0): brainstorming, nombres, ideas. Baja (0.0-0.3): traducciones, código, análisis.')}{btn('Continuar →', nextStep)}</View>);
      case 9: return (<View style={styles.stepContainer}>{tag('🧊 Módulo 9 · Temperatura mínima')}{title('Temperatura baja: modo preciso-factual')}{body('Usa baja para tareas donde hay una respuesta "correcta" objetiva.')}{btn('Continuar →', nextStep)}</View>);
      case 10: return (<View style={styles.stepContainer}>{tag('⚡ Módulo 10 · ReAct')}{title('ReAct: Razón + Acción')}{body('Alterna entre pensamiento y acción en pasos. Base de los agentes de IA actuales.')}{btn('Continuar →', nextStep)}</View>);
      case 11: return (<View style={styles.stepContainer}>{tag('🔄 Módulo 11 · Auto-refinamiento')}{title('El prompt que se refina solo')}<TextInput style={styles.input} placeholder="Instrucción principal" value={refBase} onChangeText={setRefBase} /><TextInput style={styles.input} placeholder="Criterio 1" value={refC1} onChangeText={setRefC1} /><TextInput style={styles.input} placeholder="Criterio 2" value={refC2} onChangeText={setRefC2} />{refComplete && <View style={styles.codeBox}><Text style={styles.codeText}>{refBase} Antes de entregar, evalúa: 1) {refC1} 2) {refC2}. Si falla, corrige y entrega la versión mejorada.</Text></View>}{btn('Continuar →', () => { addXP(12); nextStep(); }, !refComplete)}</View>);
      case 12: return (<View style={styles.stepContainer}>{tag('⚡ Módulo 12 · Sprint')}{title('Tus trucos en acción')}{!spRunning && !spDone ? btn('▶ Iniciar Sprint', startSp) : spDone ? btn('Continuar →', nextStep) : (<><Text style={styles.timer}>{Math.floor(spSec/60)}:{String(spSec%60).padStart(2,'0')}</Text><Text style={styles.qText}>{SPRINT_TECNICAS[spIdx].situacion}</Text><View style={styles.row}>{[SPRINT_TECNICAS[spIdx].correcta, ...SPRINT_TECNICAS[spIdx].otras].sort(() => Math.random() - 0.5).map(o => (<TouchableOpacity key={o} style={[styles.tfBtn, spAns === o && styles.tfOn]} onPress={() => answerSp(o)} disabled={spAns !== null}><Text>{o}</Text></TouchableOpacity>))}</View>{spAns !== null && <Text style={spAns === SPRINT_TECNICAS[spIdx].correcta ? styles.fbGood : styles.fbBad}>{spAns === SPRINT_TECNICAS[spIdx].correcta ? '✅ Correcto' : `❌ Correcta: ${SPRINT_TECNICAS[spIdx].correcta}`}</Text>}{spAns !== null && btn('→ Continuar', advanceSp)}</>)}</View>);
      case 13: return (<View style={styles.stepContainer}>{tag('📦 Módulo 13 · Librería personal')}{title('Tu kit: 5 prompts reutilizables')}{templates.map((t, i) => (<View key={i}><Text style={styles.label}>Plantilla {i+1}</Text><TextInput style={styles.textArea} placeholder="Escribe tu plantilla reutilizable..." value={t} onChangeText={v => { const n = [...templates]; n[i] = v; setTemplates(n); }} multiline /></View>))}{btn('Guardar librería →', () => { addXP(25); Alert.alert('✅', 'Librería guardada.', [{ text: 'OK', onPress: nextStep }]); }, !templatesComplete)}</View>);
      case 14: return (<View style={styles.stepContainer}>{tag('🎓 Módulo 14 · Prompts por materia')}{title('Prompts escolares')}{body('Ciencias (few-shot), Literatura (CoT + System), Matemáticas (CoT + temp baja), Inglés (one-shot).')}{btn('Continuar →', nextStep)}</View>);
      case 15: return (<View style={styles.stepContainer}>{tag('🏆 Módulo 15 · Desafío maestro')}{title('El prompt más complejo que puedas escribir')}<TextInput style={styles.input} placeholder="¿Qué técnicas combinas?" value={dmTec} onChangeText={setDmTec} /><TextInput style={styles.textArea} placeholder="Escribe tu prompt maestro..." value={dmPrompt} onChangeText={setDmPrompt} multiline />{btn('Entregar prompt maestro →', () => { addXP(30); Alert.alert('✅', 'Prompt maestro guardado.', [{ text: 'OK', onPress: nextStep }]); }, !dmComplete)}</View>);
      case 16: return (<View style={styles.stepContainer}>{tag('🗂️ Módulo 16 · Drag-drop')}{title('¿Qué técnica para cada tarea?')}<View style={styles.chipWrap}>{ddPool.map((item, i) => (<TouchableOpacity key={i} style={[styles.chip, ddSel === i && styles.chipOn]} onPress={() => setDdSel(ddSel === i ? null : i)}><Text>{item.text}</Text></TouchableOpacity>))}</View><View style={styles.dropGrid}>{['zero', 'one', 'few', 'cot', 'sys'].map(col => (<TouchableOpacity key={col} style={styles.dropZone} onPress={() => { if (ddSel !== null) placeDd(DD_TECNICAS[ddSel], col); }}><Text style={styles.dropHeader}>{col.toUpperCase()}</Text>{ddCols[col].map((item, i) => (<TouchableOpacity key={i} onPress={() => returnDd(item, col)}><Text style={styles.dropChip}>{item.text} ✕</Text></TouchableOpacity>))}</TouchableOpacity>))}</View>{btn('Verificar', verifyDd, ddPool.length > 0)}</View>);
      case 17: return (<View style={styles.stepContainer}>{tag('🔍 Módulo 17 · Quiz')}{!quizDone ? (<><Text style={styles.qText}>"{QUIZ_TECNICAS[quizIdx].prompt}"</Text>{QUIZ_TECNICAS[quizIdx].opts.map((o, i) => (<TouchableOpacity key={i} style={[styles.quizOpt, quizAns === i && styles.quizOptOn]} onPress={() => checkQuiz(i)} disabled={quizAns !== null}><Text>{o}</Text></TouchableOpacity>))}{quizAns !== null && <Text style={quizAns === QUIZ_TECNICAS[quizIdx].correct ? styles.fbGood : styles.fbBad}>{QUIZ_TECNICAS[quizIdx].explain}</Text>}{quizAns !== null && btn('Siguiente →', nextQuiz)}</>) : btn('Continuar →', nextStep)}</View>);
      case 18: return (<View style={styles.stepContainer}>{tag('💬 Módulo 18 · Reflexión')}{title('¿Eres ya un Prompt Master?')}<TextInput style={styles.textArea} placeholder="¿Qué dominas y qué te falta?" value={reflect} onChangeText={setReflect} multiline />{btn('Completar nivel →', () => { if (reflect.trim().length >= 50) { addXP(15); nextStep(); } else Alert.alert('Muy corto', 'Mínimo 50 caracteres.'); }, reflect.trim().length < 50)}</View>);
      case 19: return (<View style={styles.completeContainer}><View style={styles.completeIcon}><Text style={styles.iconEmoji}>🏅</Text></View><Text style={styles.completeTitle}>¡Nivel 12 completado!</Text><Text style={styles.completeSub}>Badge: 🔑 Prompt Master. Completaste el Mundo 2.</Text><Text style={styles.xpBig}>⭐ {xp} XP ganados</Text>{btn('Volver al mapa', finish)}</View>);
      default: return null;
    }
  };

  const progressPercent = (step / (TOTAL_STEPS - 1)) * 100;

  return (
    <View style={styles.screen}>
      <View style={styles.bar}>
        <TouchableOpacity onPress={() => Alert.alert('Salir', '¿Salir del nivel?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Salir', onPress: () => navigation.goBack() }])}>
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
  fill: { height: '100%', backgroundColor: colors.success, borderRadius: 3 },
  xpChip: { ...typography.bold, fontSize: 14, color: colors.accentDark },
  scrollContent: { padding: 16, paddingBottom: 40 },
  stepContainer: { flex: 1 },
  tag: { fontSize: 11, fontWeight: '600', color: '#065f46', backgroundColor: '#d1fae5', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 12 },
  iconCircle: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#fef9c3', justifyContent: 'center', alignItems: 'center', marginBottom: 14, alignSelf: 'center' },
  iconEmoji: { fontSize: 32 },
  title: { ...typography.extraBold, fontSize: 19, color: colors.textPrimary, marginBottom: 8, textAlign: 'center' },
  subtitle: { ...typography.regular, fontSize: 13, color: colors.textSecondary, marginBottom: 14, lineHeight: 18, textAlign: 'center' },
  body: { ...typography.regular, fontSize: 13, color: colors.textPrimary, lineHeight: 20, marginBottom: 12 },
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  cardTitle: { ...typography.bold, fontSize: 13, color: colors.textPrimary, marginBottom: 4 },
  cardText: { ...typography.regular, fontSize: 12, color: colors.textSecondary },
  btn: { backgroundColor: colors.success, padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  btnText: { ...typography.bold, color: '#fff', fontSize: 15 },
  btnOff: { opacity: 0.4 },
  qText: { ...typography.bold, padding: 10, backgroundColor: '#f8fafc', borderRadius: 8, marginBottom: 6 },
  quizOpt: { padding: 10, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, marginBottom: 4 },
  quizOptOn: { borderColor: '#10b981', backgroundColor: '#d1fae5' },
  fbGood: { color: '#065f46', fontSize: 11, marginTop: 4 },
  fbBad: { color: '#991b1b', fontSize: 11, marginTop: 4 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 10, fontSize: 12, backgroundColor: '#fafafa', marginBottom: 8 },
  textArea: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 12, minHeight: 80, fontSize: 13, backgroundColor: '#fafafa', marginBottom: 10 },
  label: { ...typography.bold, fontSize: 12, marginBottom: 4 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  tfBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  tfOn: { backgroundColor: '#dcfce7', borderColor: colors.success },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 10, backgroundColor: '#f8fafc', borderRadius: 12, marginBottom: 12 },
  chip: { padding: 8, borderRadius: 20, borderWidth: 1, borderColor: '#cbd5e1' },
  chipOn: { borderColor: '#10b981', backgroundColor: '#d1fae5' },
  dropGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  dropZone: { flex: 1, minWidth: '30%', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 8, minHeight: 80 },
  dropHeader: { fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  dropChip: { fontSize: 10, padding: 4, backgroundColor: '#dbeafe', borderRadius: 6 },
  timer: { fontSize: 32, fontWeight: '800', textAlign: 'center', color: '#d97706', marginBottom: 10 },
  codeBox: { backgroundColor: '#1e1e1e', padding: 12, borderRadius: 10, marginTop: 10 },
  codeText: { color: '#d4d4d4', fontFamily: 'monospace', fontSize: 11 },
  completeContainer: { alignItems: 'center', padding: 20 },
  completeIcon: { width: 86, height: 86, borderRadius: 24, backgroundColor: '#fef9c3', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  completeTitle: { ...typography.extraBold, fontSize: 21 },
  completeSub: { ...typography.regular, textAlign: 'center', marginVertical: 8 },
  xpBig: { ...typography.bold, fontSize: 18, color: colors.accentDark, marginBottom: 16 },
});