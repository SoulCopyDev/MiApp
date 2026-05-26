import { router } from 'expo-router';
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
type QuizItem = { q: string; opts: string[]; correct: number; explain: string };
type ComparePair = { ctx: string; opts: { label: string; text: string }[]; correct: number; explain: string };
type BugItem = { prompt: string; correcto: string; explain: string; modelo: string };

// ---------- Datos ----------
const QUIZ_POOL: QuizItem[] = [
  { q: '¿Qué técnica estás usando si le das a la IA 3 ejemplos de input→output antes de tu pedido real?',
    opts: ['Zero-shot prompting', 'Few-shot prompting', 'Chain-of-Thought', 'System prompt'], correct: 1, explain: 'Few-shot = usar múltiples ejemplos para mostrar el patrón de respuesta deseado.' },
  { q: '¿En qué situación el zero-shot funciona bien sin necesitar ejemplos?',
    opts: ['Cuando quieres que la IA replique tu estilo personal', 'Cuando el criterio de calidad es muy subjetivo', 'Cuando la tarea es estándar y bien definida (traducir, calcular)', 'Cuando necesitas que aprenda un formato muy específico'], correct: 2, explain: 'Zero-shot brilla en tareas estándar: traducciones, cálculos, definiciones.' },
  { q: 'Pedro le pide a la IA: "Genera 5 nombres de startup con este estilo: Doppl". ¿Qué técnica usó?',
    opts: ['Zero-shot', 'One-shot', 'Chain-of-Thought', 'System prompt'], correct: 1, explain: 'One-shot = exactamente 1 ejemplo.' },
  { q: 'Añades al final de tu prompt: "Piénsalo paso a paso". ¿Qué cambio produce?',
    opts: ['El modelo revisa internet para validar cada paso', 'El modelo genera pasos intermedios visibles que aumentan la precisión en problemas lógicos', 'Activa un procesador especial de razonamiento avanzado', 'Responde más lento pero con el mismo contenido'], correct: 1, explain: 'Chain-of-Thought (CoT) mejora precisión en razonamiento.' },
  { q: '¿Por qué mostrar el razonamiento paso a paso es valioso aunque el resultado final sea el mismo?',
    opts: ['Porque hace la respuesta más larga', 'Permite detectar en qué paso exacto hay un error', 'Activa una función premium', 'Los modelos solo razonan correctamente cuando piden pasos explícitos'], correct: 1, explain: 'Sin razonamiento visible no sabes dónde falló.' },
  { q: '¿Cuándo usar prompts en cadena (3 prompts secuenciales) es SOBREINGENIERÍA?',
    opts: ['Análisis complejo con varias fases', 'Problema que requiere razonamiento formal', 'Generar un informe largo con secciones independientes', 'Pregunta factual simple que un solo prompt directo ya responde'], correct: 3, explain: 'Dividir "¿cuándo nació Einstein?" en 3 prompts no mejora nada.' },
  { q: 'Vas a usar la IA para generar 10 nombres creativos de una marca de helados. ¿Qué temperatura es la mejor?',
    opts: ['Muy baja (0.1) para precisión', 'Alta (0.8-1.0) para variedad y sorpresas', 'Exactamente 0.5', 'La temperatura no afecta tareas creativas'], correct: 1, explain: 'Brainstorming = temperatura alta.' },
  { q: 'Tu prompt es: "Traduce este contrato legal al inglés manteniendo los términos técnicos". ¿Qué temperatura usar?',
    opts: ['Muy alta para creatividad', 'Media-alta', 'Baja para máxima precisión sin creatividad inventada', 'Cualquiera'], correct: 2, explain: 'Traducciones legales requieren precisión absoluta → temperatura baja.' },
  { q: 'La IA cita con total seguridad un estudio: "Smith et al. 2019, Nature". ¿Qué debes hacer?',
    opts: ['Confiar y usar la cita', 'Verificar la cita en Google Scholar antes de usarla', 'Preguntarle a la IA si está segura', 'Asumir que es real porque dio autor y revista'], correct: 1, explain: 'Las IAs alucinan citas bibliográficas. Siempre verifica.' },
  { q: '¿Por qué decimos "alucinación" y no "mentira" cuando la IA inventa datos?',
    opts: ['Son errores suaves', 'Las mentiras requieren intención consciente, los LLMs no la tienen', 'Suena más científico', 'Los ingenieros inventaron la palabra para ocultar fallos'], correct: 1, explain: 'Los LLMs generan texto probable sin saber la verdad.' },
  { q: '¿Cuál es el rol del "system prompt" en un asistente de IA personalizado?',
    opts: ['Primer mensaje del usuario', 'Instrucciones base que definen rol, tono y límites antes de cualquier interacción', 'Código fuente del modelo', 'Resumen automático al cerrar conversación'], correct: 1, explain: 'System prompt = configuración invisible que se aplica a toda la conversación.' },
  { q: '"Actúa como experto" vs "Actúa como oncólogo con 15 años en hospitales pediátricos de Colombia". ¿Cuál funciona mejor?',
    opts: ['El primero porque es más corto', 'El segundo porque la especificidad guía a un registro más preciso', 'Ambos funcionan igual', 'El primero porque mucho contexto confunde'], correct: 1, explain: 'Roles específicos activan vocabulario y contexto muy concretos.' },
  { q: 'Tu prompt "Dame más información sobre eso" obtiene una respuesta genérica. ¿Cuál es el problema?',
    opts: ['La IA no quiso dar más información', 'El prompt carece de referente concreto — "eso" es ambiguo', 'La temperatura estaba demasiado baja', 'El modelo tiene límite de respuestas largas'], correct: 1, explain: '"Eso" no define el tema. Sé específico.' },
  { q: '¿Qué es una "prompt injection" y por qué NO funciona en modelos modernos?',
    opts: ['Un truco que "desbloquea" el modelo con frases como "ignora tus instrucciones"', 'Técnica de optimización de contexto', 'Método oficial de Anthropic y OpenAI', 'Un virus que infecta al modelo'], correct: 0, explain: 'Prompt injection intenta manipular al modelo, pero las salvaguardas modernas lo bloquean.' },
  { q: 'Quieres que la IA siempre responda en español formal, nunca mencione a la competencia y se llame "Aura". ¿Dónde pones esas instrucciones?',
    opts: ['En el primer mensaje de cada conversación', 'En el system prompt, porque aplican a toda la conversación', 'En cada prompt individual', 'En un archivo externo'], correct: 1, explain: 'System prompt = reglas globales que no necesitas repetir.' }
];

const COMPARE_PAIRS: ComparePair[] = [
  { ctx: 'Quieres que la IA te ayude a estudiar para un examen de biología sobre el sistema digestivo.',
    opts: [
      { label: 'Prompt A', text: 'Actúa como tutor de biología para 10° grado. Explícame el sistema digestivo en 4 fases: 1) boca y esófago, 2) estómago, 3) intestinos, 4) absorción. Para cada fase: un ejemplo cotidiano + una analogía visual. Termina con 3 preguntas para verificar si entendí.' },
      { label: 'Prompt B', text: 'Explícame el sistema digestivo bien completo para mi examen mañana.' }
    ], correct: 0, explain: 'El Prompt A combina rol, estructura (CoT implícito), formato y checkpoint. El B es demasiado vago.' },
  { ctx: 'Necesitas que la IA clasifique 20 correos en urgente / normal / spam usando tu criterio personal.',
    opts: [
      { label: 'Prompt A', text: 'Clasifica estos 20 correos como urgente, normal o spam. Usa tu mejor criterio.' },
      { label: 'Prompt B', text: 'Clasifica estos correos como urgente / normal / spam. Ejemplos de mi criterio: "Reunión cambió a las 3pm" → urgente · "Newsletter semanal de marketing" → normal · "Reclama tu premio ahora" → spam. Ahora clasifica: [lista]' }
    ], correct: 1, explain: 'Criterio subjetivo = few-shot obligatorio. El B da 3 ejemplos que muestran tu criterio personal.' },
  { ctx: 'Tienes un problema de lógica: 3 amigos dividen una cuenta de restaurante con propina y descuento. Quieres la respuesta correcta.',
    opts: [
      { label: 'Prompt A', text: 'La cuenta es $180.000, hay un 10% de descuento, se suma 8% de propina sobre el total después del descuento, y se divide entre 3 personas. Resuelve paso a paso: primero el descuento, luego la propina, luego la división. Verifica el resultado al final.' },
      { label: 'Prompt B', text: 'Dividimos $180.000 con 10% de descuento y 8% de propina entre 3 personas. ¿Cuánto paga cada uno?' }
    ], correct: 0, explain: 'Problemas de lógica matemática = CoT obligatorio. El A fuerza pasos visibles + verificación.' }
];

const BUG_ITEMS: BugItem[] = [
  { prompt: 'Dame más información sobre eso.', correcto: 'Ambigüedad', explain: 'No hay referente — "eso" no apunta a nada. Tampoco define aspecto ni formato.', modelo: 'Sobre [tema específico], dame 3 aspectos que no suelen mencionarse: [campos].' },
  { prompt: 'Actúa como experto y resuelve mi problema de una vez.', correcto: 'Rol', explain: '"Experto" es demasiado genérico — experto ¿en qué? Falta especialidad concreta.', modelo: 'Actúa como [especialidad] con [años] años en [contexto]. Ayúdame con: [problema definido].' },
  { prompt: 'Necesito ayuda con matemáticas urgente.', correcto: 'Contexto', explain: 'Falta contexto crítico: ¿qué tema? ¿qué nivel? ¿qué ya intentaste?', modelo: 'Soy estudiante de [grado]. Tengo examen de [tema]. Ya entiendo [X], pero no logro [Y]. Explícame con ejemplos.' },
  { prompt: 'Escríbeme algo motivador para mi equipo.', correcto: 'Formato', explain: 'Falta el formato: ¿un email? ¿post de Slack? ¿discurso? ¿extensión?', modelo: 'Escríbeme un mensaje motivador de máximo 80 palabras para enviar por Slack a mi equipo de 12 personas tras cumplir una meta trimestral.' },
  { prompt: 'Hazme una lista.', correcto: 'Instrucción', explain: 'No hay instrucción real: ¿lista de qué? No define el tema ni el objetivo.', modelo: 'Hazme una lista de 7 libros de ciencia ficción publicados después de 2020 que aborden temas de inteligencia artificial.' }
];

const BUG_ERRORES = ['Rol', 'Contexto', 'Instrucción', 'Formato', 'Ambigüedad'];

const TOTAL_STEPS = 8; // intro + p1-p5 + result + badge

interface LevelProps { navigation?: any; setAllowBack?: (allow: boolean) => void; }

export default function World2Level7({ navigation: propsNavigation, setAllowBack }: LevelProps) {
  const nav = useNavigation();
  const navigation = propsNavigation || nav;
  const completeLevel = useGameStore(s => s.completeLevel);

  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);

  // Part 1 - Quiz
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizAnswered, setQuizAnswered] = useState(false);
  const [quizSelected, setQuizSelected] = useState<number | null>(null);

  // Part 2 - Prompt Compare
  const [cmpIdx, setCmpIdx] = useState(0);
  const [cmpScore, setCmpScore] = useState(0);
  const [cmpAnswered, setCmpAnswered] = useState(false);
  const [cmpSelected, setCmpSelected] = useState<number | null>(null);

  // Part 3 - Bug Hunter
  const [bugIdx, setBugIdx] = useState(0);
  const [bugTypeScore, setBugTypeScore] = useState(0);
  const [bugFixScore, setBugFixScore] = useState(0);
  const [bugTypeSel, setBugTypeSel] = useState<string | null>(null);
  const [bugFixVal, setBugFixVal] = useState('');
  const [bugVerified, setBugVerified] = useState(false);

  // Part 4 - Builder cronometrado
  const [p4Started, setP4Started] = useState(false);
  const [p4Sec, setP4Sec] = useState(180);
  const [p4Fields, setP4Fields] = useState({ rol: '', shot: '', cot: '', fmt: '' });
  const [p4Submitted, setP4Submitted] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Part 5 - Reflexión
  const [reflectVal, setReflectVal] = useState('');

  // Scores
  const p1ScoreRef = useRef(0);
  const p2ScoreRef = useRef(0);
  const p3ScoreRef = useRef(0);

  useEffect(() => { setAllowBack?.(true); }, []); // allow back in evaluation

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Timer effect for Part 4
  useEffect(() => {
    if (!p4Started || p4Submitted) return;
    if (p4Sec <= 0) {
      handleP4Timeout();
      return;
    }
    timerRef.current = setTimeout(() => setP4Sec(s => s - 1), 1000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [p4Started, p4Sec, p4Submitted]);

  const addXP = (v: number) => setXp(prev => prev + v);
  const nextStep = () => { if (step < TOTAL_STEPS - 1) setStep(step + 1); };

  // Part 1
  const answerQuiz = (i: number) => {
    if (quizAnswered) return;
    setQuizSelected(i);
    setQuizAnswered(true);
    if (i === QUIZ_POOL[quizIdx].correct) setQuizScore(s => s + 1);
  };
  const nextQuiz = () => {
    if (quizIdx + 1 < QUIZ_POOL.length) {
      setQuizIdx(i => i + 1);
      setQuizAnswered(false);
      setQuizSelected(null);
    } else {
      p1ScoreRef.current = quizScore + (quizSelected === QUIZ_POOL[quizIdx].correct ? 1 : 0); // ensure final score
      addXP(p1ScoreRef.current * 8);
      nextStep();
    }
  };

  // Part 2
  const answerCompare = (i: number) => {
    if (cmpAnswered) return;
    setCmpSelected(i);
    setCmpAnswered(true);
    if (i === COMPARE_PAIRS[cmpIdx].correct) setCmpScore(s => s + 1);
  };
  const nextCompare = () => {
    if (cmpIdx + 1 < COMPARE_PAIRS.length) {
      setCmpIdx(i => i + 1);
      setCmpAnswered(false);
      setCmpSelected(null);
    } else {
      p2ScoreRef.current = cmpScore + (cmpSelected === COMPARE_PAIRS[cmpIdx].correct ? 1 : 0);
      addXP(p2ScoreRef.current * 15);
      nextStep();
    }
  };

  // Part 3
  const verifyBug = () => {
    if (bugVerified) return;
    setBugVerified(true);
    const item = BUG_ITEMS[bugIdx];
    const typeOk = bugTypeSel === item.correcto;
    const fixOk = bugFixVal.trim().length >= 25;
    if (typeOk) setBugTypeScore(s => s + 1);
    if (fixOk) setBugFixScore(s => s + 1);
  };
  const nextBug = () => {
    if (bugIdx + 1 < BUG_ITEMS.length) {
      setBugIdx(i => i + 1);
      setBugTypeSel(null);
      setBugFixVal('');
      setBugVerified(false);
    } else {
      p3ScoreRef.current = bugTypeScore + bugFixScore + (bugTypeSel === BUG_ITEMS[bugIdx].correcto ? 1 : 0) + (bugFixVal.trim().length >= 25 ? 1 : 0); // final
      addXP(p3ScoreRef.current * 6);
      nextStep();
    }
  };

  // Part 4
  const startP4 = () => setP4Started(true);
  const updateP4Field = (field: keyof typeof p4Fields, value: string) => {
    setP4Fields(prev => ({ ...prev, [field]: value }));
  };
  const p4AllFilled = Object.entries(p4Fields).every(([k, v]) => {
    const mins: Record<string, number> = { rol: 15, shot: 20, cot: 15, fmt: 10 };
    return v.trim().length >= mins[k];
  });
  const submitP4 = () => {
    if (p4Submitted) return;
    setP4Submitted(true);
    if (timerRef.current) clearInterval(timerRef.current);
    const timeUsed = 180 - p4Sec;
    const bonus = p4Sec >= 90 ? 15 : p4Sec >= 30 ? 8 : 0;
    addXP(35 + bonus);
  };
  const handleP4Timeout = () => {
    if (p4Submitted) return;
    setP4Submitted(true);
    if (p4AllFilled) {
      addXP(35 + (p4Sec >= 90 ? 15 : p4Sec >= 30 ? 8 : 0));
    } else {
      addXP(15);
    }
  };
  const goToPart5 = () => nextStep();

  // Part 5
  const sealReflection = () => {
    if (reflectVal.trim().length < 80) return;
    addXP(25);
    nextStep();
  };

  // Badge / Finish
  const finishEvaluation = () => {
    const overall = Math.round(((p1ScoreRef.current/15)+(p2ScoreRef.current/3)+(p3ScoreRef.current/10))/3*100);
    let stars = overall >= 85 ? 3 : overall >= 70 ? 2 : 1;
    completeLevel(38, stars, xp);
    router.back();
  };

  // ----- RENDER -----
  const renderPart1 = () => {
    if (quizIdx >= QUIZ_POOL.length) {
      const earned = p1ScoreRef.current * 8;
      return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>✅ Parte 1 completada</Text>
          <Text style={styles.title}>Quiz finalizado</Text>
          <Text style={styles.scoreText}>{p1ScoreRef.current}/{QUIZ_POOL.length} correctas — {earned} XP</Text>
          <TouchableOpacity style={styles.btn} onPress={nextStep}><Text style={styles.btnText}>Ir a Parte 2 →</Text></TouchableOpacity>
        </View>
      );
    }
    const item = QUIZ_POOL[quizIdx];
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.tag}>🧠 Parte 1 · Quiz · {quizIdx+1}/{QUIZ_POOL.length}</Text>
        <Text style={styles.quizQ}>{item.q}</Text>
        {item.opts.map((o, i) => (
          <TouchableOpacity key={i} style={[styles.quizOpt, quizSelected === i && (i === item.correct ? styles.optCorrect : styles.optWrong)]}
            onPress={() => answerQuiz(i)} disabled={quizAnswered}>
            <Text style={quizSelected === i ? styles.optTextActive : styles.optText}>{o}</Text>
          </TouchableOpacity>
        ))}
        {quizAnswered && <Text style={styles.feedback}>{item.explain}</Text>}
        {quizAnswered && <TouchableOpacity style={styles.btn} onPress={nextQuiz}><Text style={styles.btnText}>Siguiente →</Text></TouchableOpacity>}
      </View>
    );
  };

  const renderPart2 = () => {
    if (cmpIdx >= COMPARE_PAIRS.length) {
      const earned = p2ScoreRef.current * 15;
      return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>✅ Parte 2 completada</Text>
          <Text style={styles.title}>Prompt-compare finalizado</Text>
          <Text style={styles.scoreText}>{p2ScoreRef.current}/{COMPARE_PAIRS.length} aciertos — {earned} XP</Text>
          <TouchableOpacity style={styles.btn} onPress={nextStep}><Text style={styles.btnText}>Ir a Parte 3 →</Text></TouchableOpacity>
        </View>
      );
    }
    const pair = COMPARE_PAIRS[cmpIdx];
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.tag}>⚖️ Parte 2 · Compare · {cmpIdx+1}/{COMPARE_PAIRS.length}</Text>
        <Text style={styles.ctxText}>{pair.ctx}</Text>
        {pair.opts.map((o, i) => (
          <TouchableOpacity key={i} style={[styles.compareOpt, cmpSelected === i && (i === pair.correct ? styles.optCorrect : styles.optWrong)]}
            onPress={() => answerCompare(i)} disabled={cmpAnswered}>
            <Text style={styles.compareLabel}>{o.label}</Text>
            <Text style={styles.comparePromptText}>{o.text}</Text>
          </TouchableOpacity>
        ))}
        {cmpAnswered && <Text style={styles.feedback}>{pair.explain}</Text>}
        {cmpAnswered && <TouchableOpacity style={styles.btn} onPress={nextCompare}><Text style={styles.btnText}>Siguiente →</Text></TouchableOpacity>}
      </View>
    );
  };

  const renderPart3 = () => {
    if (bugIdx >= BUG_ITEMS.length) {
      const total = p3ScoreRef.current;
      const earned = total * 6;
      return (
        <View style={styles.stepContainer}>
          <Text style={styles.tag}>✅ Parte 3 completada</Text>
          <Text style={styles.title}>Bug Hunter finalizado</Text>
          <Text style={styles.scoreText}>Tipos: {bugTypeScore}/5 · Reparaciones: {bugFixScore}/5 — {earned} XP</Text>
          <TouchableOpacity style={styles.btn} onPress={nextStep}><Text style={styles.btnText}>Ir a Parte 4 →</Text></TouchableOpacity>
        </View>
      );
    }
    const item = BUG_ITEMS[bugIdx];
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.tag}>🐛 Parte 3 · Bug Hunter · {bugIdx+1}/{BUG_ITEMS.length}</Text>
        <View style={styles.bugCard}>
          <Text style={styles.bugPrompt}>"{item.prompt}"</Text>
          <Text style={styles.bugLabel}>1️⃣ ¿Cuál es el error principal?</Text>
          <View style={styles.chipRow}>
            {BUG_ERRORES.map(e => (
              <TouchableOpacity key={e} style={[styles.chip, bugTypeSel === e && styles.chipSel, bugVerified && item.correcto === e && styles.chipCorrect, bugVerified && bugTypeSel === e && e !== item.correcto && styles.chipWrong]}
                onPress={() => { if (!bugVerified) setBugTypeSel(e); }} disabled={bugVerified}>
                <Text style={styles.chipText}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.bugLabel}>2️⃣ Repara el prompt (tu versión corregida)</Text>
          <TextInput style={styles.bugInput} placeholder="Escribe el prompt reparado..." value={bugFixVal} onChangeText={setBugFixVal} multiline editable={!bugVerified} />
        </View>
        {!bugVerified ? (
          <TouchableOpacity style={[styles.btn, (!bugTypeSel || bugFixVal.trim().length < 25) && styles.btnOff]} onPress={verifyBug} disabled={!bugTypeSel || bugFixVal.trim().length < 25}>
            <Text style={styles.btnText}>Verificar →</Text>
          </TouchableOpacity>
        ) : (
          <>
            <Text style={styles.feedback}>{bugTypeSel === item.correcto ? '✅ Tipo correcto: ' : '❌ Tipo correcto: '}<Text style={styles.bold}>{item.correcto}</Text>. {item.explain}{'\n\n'}Modelo: {item.modelo}</Text>
            <TouchableOpacity style={styles.btn} onPress={nextBug}><Text style={styles.btnText}>Siguiente →</Text></TouchableOpacity>
          </>
        )}
      </View>
    );
  };

  const renderPart4 = () => {
    const mins = Math.floor(p4Sec / 60);
    const secs = String(p4Sec % 60).padStart(2, '0');
    const preview = `Actúa como ${p4Fields.rol || '[rol complejo]'}.\nEjemplos del estilo:\n${p4Fields.shot || '[few-shot]'}\nProceso paso a paso:\n${p4Fields.cot || '[chain-of-thought]'}\nFormato: ${p4Fields.fmt || '[formato]'}`;
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.tag}>⏱️ Parte 4 · Builder cronometrado</Text>
        <Text style={styles.title}>Prompt maestro en 3 minutos</Text>
        {!p4Started && !p4Submitted && (
          <TouchableOpacity style={styles.btn} onPress={startP4}><Text style={styles.btnText}>▶ Iniciar cronómetro (3:00)</Text></TouchableOpacity>
        )}
        {p4Started && !p4Submitted && (
          <>
            <View style={styles.timerBox}>
              <Text style={styles.timerText}>{mins}:{secs}</Text>
              <View style={styles.timerBar}><View style={[styles.timerFill, { width: `${(p4Sec/180)*100}%` }]} /></View>
            </View>
            <Text style={styles.fieldLabel}>🎭 ROL</Text>
            <TextInput style={styles.input} placeholder="Rol complejo..." value={p4Fields.rol} onChangeText={t => updateP4Field('rol', t)} editable />
            <Text style={styles.fieldLabel}>📚 FEW-SHOT</Text>
            <TextInput style={styles.textArea} placeholder="1-3 ejemplos..." value={p4Fields.shot} onChangeText={t => updateP4Field('shot', t)} multiline editable />
            <Text style={styles.fieldLabel}>🔗 COT</Text>
            <TextInput style={styles.input} placeholder="Pasos de razonamiento..." value={p4Fields.cot} onChangeText={t => updateP4Field('cot', t)} editable />
            <Text style={styles.fieldLabel}>📐 FORMATO</Text>
            <TextInput style={styles.input} placeholder="Estructura y extensión..." value={p4Fields.fmt} onChangeText={t => updateP4Field('fmt', t)} editable />
            <Text style={styles.sectionTitle}>Vista previa:</Text>
            <View style={styles.codeBox}><Text style={styles.codeText}>{preview}</Text></View>
            <TouchableOpacity style={[styles.btn, !p4AllFilled && styles.btnOff]} onPress={submitP4} disabled={!p4AllFilled}>
              <Text style={styles.btnText}>Enviar prompt →</Text>
            </TouchableOpacity>
          </>
        )}
        {p4Submitted && (
          <View style={styles.stepContainer}>
            <Text style={styles.feedback}>✅ Prompt maestro enviado. {p4AllFilled ? 'Completaste las 4 técnicas.' : 'Tiempo agotado o incompleto.'}</Text>
            <TouchableOpacity style={styles.btn} onPress={goToPart5}><Text style={styles.btnText}>Ir a Parte 5 →</Text></TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderPart5 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>💬 Parte 5 · Reflexión sellada</Text>
      <Text style={styles.title}>Tu reflexión de cierre</Text>
      <Text style={styles.subtitle}>¿En qué situación de tu vida diaria usarías estas técnicas de prompting?</Text>
      <TextInput style={styles.textArea} placeholder="Escribe tu reflexión (mínimo 80 caracteres)..." value={reflectVal} onChangeText={setReflectVal} multiline />
      <Text style={styles.charCount}>{reflectVal.trim().length} / 80 mínimo</Text>
      <TouchableOpacity style={[styles.btn, reflectVal.trim().length < 80 && styles.btnOff]} onPress={sealReflection} disabled={reflectVal.trim().length < 80}>
        <Text style={styles.btnText}>Sellar reflexión →</Text>
      </TouchableOpacity>
    </View>
  );

  const renderResult = () => {
    const quizPct = Math.round((p1ScoreRef.current/15)*100);
    const cmpPct = Math.round((p2ScoreRef.current/3)*100);
    const bugPct = Math.round((p3ScoreRef.current/10)*100);
    const overall = Math.round((quizPct+cmpPct+bugPct)/3);
    const medal = overall>=85?'🥇':overall>=70?'🥈':'🥉';
    const label = overall>=85?'Excelente — Prompting dominado':overall>=70?'Bien — Base sólida con gaps puntuales':'Aprobado — Repasa niveles con menor puntaje';
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.tag}>🏁 Resultado final</Text>
        <Text style={styles.title}>{medal} {label}</Text>
        <View style={styles.scoreRow}>
          <View style={styles.scoreItem}><Text style={styles.scoreNum}>{quizPct}%</Text><Text style={styles.scoreLbl}>Quiz</Text></View>
          <View style={styles.scoreItem}><Text style={styles.scoreNum}>{cmpPct}%</Text><Text style={styles.scoreLbl}>Compare</Text></View>
          <View style={styles.scoreItem}><Text style={styles.scoreNum}>{bugPct}%</Text><Text style={styles.scoreLbl}>Bug hunter</Text></View>
        </View>
        <Text style={styles.xpEarned}>⭐ {xp} XP acumulados</Text>
        <TouchableOpacity style={styles.btn} onPress={nextStep}><Text style={styles.btnText}>Reclamar mi badge 🏆 →</Text></TouchableOpacity>
      </View>
    );
  };

  const renderBadge = () => {
    const overall = Math.round(((p1ScoreRef.current/15)+(p2ScoreRef.current/3)+(p3ScoreRef.current/10))/3*100);
    return (
      <View style={styles.badgeContainer}>
        <View style={styles.badgeCircle}><Text style={styles.badgeEmoji}>🎯</Text></View>
        <Text style={styles.badgeTitle}>¡Badge desbloqueado!</Text>
        <View style={styles.badgeNameBox}><Text style={styles.badgeName}>🎯 Prompt Master Certificado</Text></View>
        <Text style={styles.badgeDesc}>Completaste el Mundo 2 de IA Explorer. Ahora dominas prompting avanzado.</Text>
        <View style={styles.scoreRow}>
          <View style={styles.scoreItem}><Text style={styles.scoreNum}>{overall}%</Text><Text style={styles.scoreLbl}>Puntaje global</Text></View>
          <View style={styles.scoreItem}><Text style={styles.scoreNum}>{xp}</Text><Text style={styles.scoreLbl}>XP total</Text></View>
        </View>
        <TouchableOpacity style={styles.btn} onPress={finishEvaluation}><Text style={styles.btnText}>Volver al mapa</Text></TouchableOpacity>
      </View>
    );
  };

  const stepContent = () => {
    switch (step) {
      case 0: return (
        <View style={styles.stepContainer}>
          <View style={styles.iconCircle}><Text style={styles.iconEmoji}>🎯</Text></View>
          <Text style={styles.title}>Evaluación Mundo 2</Text>
          <Text style={styles.subtitle}>5 partes · ~18 minutos. Demostremos dominio real de las técnicas de prompting.</Text>
          <Text style={styles.body}>🧠 Quiz (15 preguntas){'\n'}⚖️ Prompt-compare (3 pares){'\n'}🐛 Bug Hunter (repara 5 prompts){'\n'}⏱️ Builder cronometrado (3 min){'\n'}💬 Reflexión sellada</Text>
          <TouchableOpacity style={[styles.btn, { marginTop: 20 }]} onPress={nextStep}><Text style={styles.btnText}>¡Comenzar evaluación! →</Text></TouchableOpacity>
        </View>
      );
      case 1: return renderPart1();
      case 2: return renderPart2();
      case 3: return renderPart3();
      case 4: return renderPart4();
      case 5: return renderPart5();
      case 6: return renderResult();
      case 7: return renderBadge();
      default: return null;
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.bar}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialIcons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${(step/(TOTAL_STEPS-1))*100}%` }]} /></View>
        <Text style={styles.xpChip}>{xp} XP</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>{stepContent()}</ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  bar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  progressTrack: { flex: 1, height: 6, backgroundColor: colors.borderLight, borderRadius: 3, marginHorizontal: 12 },
  progressFill: { height: '100%', backgroundColor: colors.success, borderRadius: 3 },
  xpChip: { ...typography.bold, fontSize: 14, color: colors.accentDark },
  scrollContent: { padding: 16, paddingBottom: 40 },
  stepContainer: { flex: 1 },
  tag: { fontSize: 11, fontWeight: '600', color: '#0f766e', backgroundColor: '#f0fdfa', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 12 },
  title: { ...typography.extraBold, fontSize: 19, color: colors.textPrimary, marginBottom: 8, textAlign: 'center' },
  subtitle: { ...typography.regular, fontSize: 14, color: colors.textSecondary, marginBottom: 14, textAlign: 'center', lineHeight: 20 },
  body: { ...typography.regular, fontSize: 14, color: colors.textPrimary, lineHeight: 22, marginBottom: 12 },
  scoreText: { ...typography.extraBold, fontSize: 18, color: colors.accentDark, textAlign: 'center', marginVertical: 12 },
  quizQ: { ...typography.bold, fontSize: 13, backgroundColor: '#f0fdfa', padding: 12, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#5eead4' },
  quizOpt: { padding: 12, borderRadius: 11, borderWidth: 2, borderColor: '#e2e8f0', marginBottom: 7 },
  optText: { fontSize: 12, color: '#334155' },
  optTextActive: { fontSize: 12, color: '#0f172a', fontWeight: '600' },
  optCorrect: { borderColor: '#10b981', backgroundColor: '#ecfdf5' },
  optWrong: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },
  feedback: { fontSize: 12, marginTop: 6, color: '#065f46', backgroundColor: '#ecfdf5', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#a7f3d0' },
  btn: { backgroundColor: '#0d9488', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  btnText: { ...typography.bold, color: '#fff', fontSize: 15 },
  btnOff: { opacity: 0.4 },
  ctxText: { fontSize: 12, fontStyle: 'italic', color: '#64748b', marginBottom: 10 },
  compareOpt: { borderRadius: 12, padding: 12, marginBottom: 7, borderWidth: 2, borderColor: '#e2e8f0' },
  compareLabel: { fontSize: 10, fontWeight: '700', color: '#0f766e', marginBottom: 4 },
  comparePromptText: { fontSize: 11, color: '#334155', fontFamily: 'monospace' },
  bugCard: { backgroundColor: '#fff7ed', borderWidth: 2, borderColor: '#fdba74', borderRadius: 14, padding: 13, marginBottom: 12 },
  bugPrompt: { fontFamily: 'monospace', fontSize: 11, color: '#431407', backgroundColor: '#fff', padding: 10, borderRadius: 9, borderWidth: 1, borderColor: '#fb923c', marginBottom: 10 },
  bugLabel: { fontSize: 11, fontWeight: '700', color: '#9a3412', marginBottom: 5, marginTop: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 6 },
  chip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 12, borderWidth: 1.5, borderColor: '#fdba74', backgroundColor: '#fff' },
  chipSel: { borderColor: '#c2410c', backgroundColor: '#fdba74' },
  chipCorrect: { borderColor: '#10b981', backgroundColor: '#ecfdf5' },
  chipWrong: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },
  chipText: { fontSize: 10, fontWeight: '700', color: '#9a3412' },
  bugInput: { borderWidth: 1.5, borderColor: '#fdba74', borderRadius: 10, padding: 10, minHeight: 60, fontSize: 12, backgroundColor: '#fff', marginTop: 4 },
  timerBox: { alignItems: 'center', marginBottom: 14 },
  timerText: { fontSize: 36, fontWeight: '800', color: '#0f766e' },
  timerBar: { height: 8, backgroundColor: '#ccfbf1', borderRadius: 4, width: '100%', overflow: 'hidden', marginTop: 8 },
  timerFill: { height: '100%', backgroundColor: '#14b8a6' },
  fieldLabel: { ...typography.bold, fontSize: 12, color: '#0f766e', marginBottom: 4, marginTop: 10 },
  input: { borderWidth: 1.5, borderColor: '#5eead4', borderRadius: 10, padding: 10, fontSize: 12, backgroundColor: '#f0fdfa', marginBottom: 8 },
  textArea: { borderWidth: 1.5, borderColor: '#5eead4', borderRadius: 10, padding: 10, fontSize: 12, backgroundColor: '#f0fdfa', minHeight: 60, marginBottom: 8 },
  codeBox: { backgroundColor: '#042f2e', padding: 13, borderRadius: 12, marginVertical: 8, borderWidth: 1, borderColor: '#134e4a' },
  codeText: { color: '#5eead4', fontFamily: 'monospace', fontSize: 11 },
  sectionTitle: { ...typography.bold, fontSize: 13, marginTop: 10, marginBottom: 6 },
  charCount: { fontSize: 10, color: '#94a3b8', textAlign: 'right', marginTop: 4 },
  scoreRow: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginVertical: 12, flexWrap: 'wrap' },
  scoreItem: { alignItems: 'center' },
  scoreNum: { fontSize: 24, fontWeight: '800', color: '#0d9488' },
  scoreLbl: { fontSize: 10, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase' },
  xpEarned: { ...typography.bold, fontSize: 16, color: colors.accentDark, textAlign: 'center', marginVertical: 10 },
  badgeContainer: { alignItems: 'center', padding: 20 },
  badgeCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#14b8a6', justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
  badgeEmoji: { fontSize: 54 },
  badgeTitle: { ...typography.extraBold, fontSize: 22, marginBottom: 4 },
  badgeNameBox: { backgroundColor: '#f0fdfa', borderWidth: 2, borderColor: '#5eead4', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8, marginBottom: 12 },
  badgeName: { fontSize: 15, fontWeight: '700', color: '#0f766e' },
  badgeDesc: { ...typography.regular, textAlign: 'center', marginBottom: 16, color: colors.textSecondary },
  iconCircle: { width: 80, height: 80, borderRadius: 24, backgroundColor: '#ccfbf1', justifyContent: 'center', alignItems: 'center', marginBottom: 14, alignSelf: 'center' },
  iconEmoji: { fontSize: 42 },
  bold: { fontWeight: '700' },
});