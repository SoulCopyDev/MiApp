import { router } from 'expo-router';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, BackHandler,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useGameStore } from '../store/gameStore';
import { colors, typography } from '../theme';

// ---------- Tipos ----------
type QuizPoolItem = {
  q: string;
  opts: string[];
  correct: number;
  fb: string;
};
type VFPoolItem = {
  s: string;
  correct: boolean;
  fb: string;
};
type SprintAnswer = {
  q: string;
  valid: string[];
};
type MatchPairItem = {
  a: string;
  b: string;
};

const TOTAL_STEPS = 20; // 0:intro + 18 módulos + 1:complete
const CONTENT_STEPS = 18;

const pickN = <T,>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};

// ===================== POOLS =====================

const QUIZ_ARBOL_POOL: QuizPoolItem[] = [
  {
    q: 'Sofía tiene 13 años. Su profesora le pidió un trabajo sobre las elecciones presidenciales de Colombia del año pasado, citando al menos 5 fuentes periodísticas de medios distintos. Siguiendo el árbol de decisión, ¿qué herramienta es la más apropiada?',
    opts: ['ChatGPT — es la más famosa y conversacional', 'Claude — para escribir cuidado el ensayo final', 'Perplexity — necesita datos verificables con fuentes citables', 'NotebookLM — para estudiar sus apuntes'],
    correct: 2,
    fb: '¡Exacto! Perplexity es la única que cita fuentes reales con links. Para este tipo de tarea académica con requisito de fuentes, es imbatible.',
  },
  {
    q: 'Tomás tiene examen de biología mañana. Tiene 3 PDFs de capítulos, sus apuntes escaneados y las diapositivas de la profe. Quiere hacerle preguntas a TODO ese material. Siguiendo el árbol, ¿qué herramienta usar?',
    opts: ['ChatGPT — le pega el texto y listo', 'NotebookLM — diseñado exactamente para eso: subes documentos y te responde solo con ellos', 'Perplexity — busca en internet', 'Grok — tiene información reciente'],
    correct: 1,
    fb: 'NotebookLM es la respuesta perfecta. Subes todos tus materiales y te responde citando el documento y la página exacta.',
  },
  {
    q: 'Camila escribe un discurso para la graduación de su curso. Quiere que suene personal, emocional, no cliché. Siguiendo el árbol, ¿qué herramienta usar?',
    opts: ['ChatGPT — la más rápida', 'Claude — la mejor para escritura cuidada con tono personal', 'Perplexity — busca frases bonitas', 'Gemini — porque es de Google'],
    correct: 1,
    fb: 'Claude es famosa por respetar el tono que le pides y evitar los clichés típicos. Ideal para textos donde la voz personal importa mucho.',
  },
];

const VF_POOL: VFPoolItem[] = [
  { s: 'ChatGPT gratis y ChatGPT Plus (USD 20/mes) te dan exactamente los mismos resultados, solo cambia el límite de uso.', correct: false, fb: 'Falso. Plus te da el modelo más potente (GPT-4o), generación de imágenes, modo de voz avanzado y análisis de archivos.' },
  { s: 'Para un estudiante que usa IA 30 min al día en tareas simples, la versión gratis es suficiente.', correct: true, fb: 'Cierto. Las versiones gratis cubren sobradamente dudas, resúmenes cortos y redacción básica.' },
  { s: 'Vale la pena pagar cuando vas a usar la IA para un proyecto largo, creativo o profesional.', correct: true, fb: 'Cierto. Ahí las limitaciones de las versiones gratis se vuelven frustración real.' },
  { s: 'Si pagas una IA, pagar las demás es redundante — todas hacen lo mismo.', correct: false, fb: 'Falso. Cada herramienta especializada rinde en su área: Claude para escritura, Midjourney para imágenes, Suno para música.' },
  { s: 'Perplexity tiene una versión gratis útil que te permite hacer búsquedas con fuentes ilimitadas al día.', correct: true, fb: 'Cierto. Perplexity gratis permite muchas búsquedas básicas.' },
  { s: 'NotebookLM es completamente gratis si tienes cuenta de Google.', correct: true, fb: 'Cierto. Google ofrece NotebookLM gratis con tu cuenta de Gmail.' },
  { s: 'Gastar USD 20 en ChatGPT Plus solo tiene sentido si vas a programar o hacer cosas muy complejas.', correct: false, fb: 'Falso. Muchos estudiantes pagan Plus para acceso sin cortes al mejor modelo, subir PDFs y generar imágenes.' },
];

const QUIZ_MAESTRO_POOL: QuizPoolItem[] = [
  {
    q: 'Eres un estudiante de 13 años. Tu mejor amigo te pregunta: "¿Cuál es la IA que debería usar?". Usando TODO lo que aprendiste, ¿cuál es la mejor respuesta?',
    opts: ['ChatGPT, porque es la más famosa y todo el mundo la usa', 'Depende completamente de para qué la necesite. Una sola IA no es la mejor; lo correcto es armar un kit de 3-5 herramientas según el uso', 'La más cara, porque si paga más, tendrá mejor resultado', 'Claude, porque es la más nueva y avanzada'],
    correct: 1,
    fb: '¡Exactamente! Este es EL aprendizaje del Mundo 4. Responder "depende" no es evasión — es la respuesta correcta de un experto.',
  },
  {
    q: 'Un amigo te dice: "Llevo dos horas peleando con ChatGPT para que me haga una portada para YouTube y las miniaturas quedan horribles". ¿Qué le aconsejas?',
    opts: ['Que siga intentando con ChatGPT, es cuestión de insistir', 'Que cambie a Midjourney — está diseñada específicamente para imágenes artísticas y miniaturas con buena estética', 'Que pague ChatGPT Plus para que le salga mejor', 'Que mejor no use IA y haga la miniatura con Paint'],
    correct: 1,
    fb: 'Exacto. Si la herramienta no es la correcta, por más que insistas no vas a obtener buenos resultados. Cambia de herramienta.',
  },
  {
    q: 'Tu mamá te pregunta si vale la pena pagar Claude Pro o ChatGPT Plus. ¿Qué es más importante saber antes de responder?',
    opts: ['Cuál es la más barata', 'Cuál se parece más a Siri', 'Para qué la quiere usar: investigar con fuentes, escribir cuidado, hacer imágenes, analizar PDFs, etc.', 'Cuál está más de moda en TikTok'],
    correct: 2,
    fb: 'Perfecto. Antes de recomendar herramienta, hay que entender el uso. "Depende del uso" es siempre la respuesta del experto.',
  },
];

const SPRINT_ANSWERS: SprintAnswer[] = [
  { q: 'Investigar datos del cambio climático con fuentes citadas', valid: ['perplexity'] },
  { q: 'Generar miniatura llamativa para YouTube', valid: ['midjourney', 'dall-e', 'dalle', 'dall e', 'firefly'] },
  { q: 'Corregir tu redacción en un ensayo importante', valid: ['claude', 'chatgpt', 'gpt'] },
  { q: 'Preguntarle a tus apuntes de biología', valid: ['notebooklm', 'notebook'] },
  { q: 'Escribir código JavaScript desde cero', valid: ['cursor', 'copilot', 'chatgpt', 'github copilot', 'gpt', 'claude'] },
  { q: 'Crear música de fondo para un reel', valid: ['suno', 'udio'] },
  { q: 'Resumir un PDF de 50 páginas dentro de Word', valid: ['copilot', 'microsoft copilot'] },
  { q: 'Video de 5 segundos para tu historia de Instagram', valid: ['runway', 'sora', 'pika', 'kling'] },
  { q: 'Clonar tu voz para una grabación', valid: ['elevenlabs', 'eleven labs'] },
  { q: 'Saber qué dice Elon Musk en X hoy', valid: ['grok', 'xai'] },
];

// ===================== COMPONENTE =====================
interface LevelProps {
  navigation?: any;
  setAllowBack?: (allow: boolean) => void;
}

export default function World4Level6({ navigation: propsNavigation, setAllowBack }: LevelProps) {
  const nav = useNavigation();
  const navigation = propsNavigation || nav;
  const completeLevel = useGameStore((s) => s.completeLevel);

  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);

  // Pools aleatorios
  const [quizArbolItem] = useState(() => pickN(QUIZ_ARBOL_POOL, 1)[0]);
  const [vfItems] = useState(() => pickN(VF_POOL, 4));
  const [quizMaestroItem] = useState(() => pickN(QUIZ_MAESTRO_POOL, 1)[0]);

  // Estados de módulos
  const [sprintAnswers, setSprintAnswers] = useState<string[]>(Array(10).fill(''));
  const [sprintSec, setSprintSec] = useState(90);
  const [sprintStarted, setSprintStarted] = useState(false);
  const [sprintDone, setSprintDone] = useState(false);
  const sprintTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [quizArbolSel, setQuizArbolSel] = useState<number | null>(null);
  const [quizArbolDone, setQuizArbolDone] = useState(false);

  const [vfAnswers, setVfAnswers] = useState<Record<number, boolean>>({});
  const [vfDone, setVfDone] = useState(false);

  const [quizMaestroSel, setQuizMaestroSel] = useState<number | null>(null);
  const [quizMaestroDone, setQuizMaestroDone] = useState(false);

  const examSteps = new Set([9, 12, 14, 18]);
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
    if (step === 9) { setSprintAnswers(Array(10).fill('')); setSprintSec(90); setSprintStarted(false); setSprintDone(false); if (sprintTimer.current) clearInterval(sprintTimer.current); }
    if (step === 12) { setQuizArbolSel(null); setQuizArbolDone(false); }
    if (step === 14) { setVfAnswers({}); setVfDone(false); }
    if (step === 18) { setQuizMaestroSel(null); setQuizMaestroDone(false); }
  }, [step]);

  const addXP = (n: number) => setXp((p) => p + n);
  const goNext = () => { if (step < TOTAL_STEPS - 1) setStep(step + 1); };
  const handleClose = () => Alert.alert('Salir', '¿Seguro?', [{ text: 'Cancelar' }, { text: 'Salir', onPress: () => router.back() }]);
  const handleFinish = () => {
    let stars = 0;
    if (xp >= 200) stars = 3; else if (xp >= 130) stars = 2; else if (xp >= 60) stars = 1;
    completeLevel(24, stars, xp);
    router.back();
  };

  // Sprint
  const startSprint = () => {
    setSprintStarted(true);
    setSprintSec(90);
    sprintTimer.current = setInterval(() => {
      setSprintSec((prev) => { if (prev <= 1) { clearInterval(sprintTimer.current!); endSprint(); return 0; } return prev - 1; });
    }, 1000);
  };

  const endSprint = () => {
    if (sprintTimer.current) clearInterval(sprintTimer.current);
    if (sprintDone) return;
    setSprintDone(true);
    let correct = 0;
    sprintAnswers.forEach((val, i) => {
      const v = (val || '').trim().toLowerCase();
      if (v.length > 0 && SPRINT_ANSWERS[i].valid.some((a) => v.includes(a) || a.includes(v))) correct++;
    });
    addXP(25);
    Alert.alert('Sprint completado', `${correct}/10 correctas. +25 XP. Respuestas: 1) Perplexity · 2) Midjourney/DALL-E · 3) Claude · 4) NotebookLM · 5) Cursor/Copilot · 6) Suno · 7) Copilot · 8) Runway · 9) ElevenLabs · 10) Grok`);
  };

  // Quiz árbol
  const answerQuizArbol = (i: number) => {
    if (quizArbolDone) return;
    setQuizArbolDone(true);
    setQuizArbolSel(i);
    if (i === quizArbolItem.correct) addXP(15);
    Alert.alert(i === quizArbolItem.correct ? '✅ ¡Correcto! +15 XP' : '❌ Incorrecto', quizArbolItem.fb);
  };

  // VF
  const answerVF = (idx: number, val: boolean) => {
    if (vfDone) return;
    setVfAnswers((p) => ({ ...p, [idx]: val }));
    if (Object.keys({ ...vfAnswers, [idx]: val }).length >= vfItems.length) {
      setVfDone(true);
      addXP(15);
      Alert.alert('✅ Completado', '+15 XP');
    }
  };

  // Quiz maestro
  const answerQuizMaestro = (i: number) => {
    if (quizMaestroDone) return;
    setQuizMaestroDone(true);
    setQuizMaestroSel(i);
    if (i === quizMaestroItem.correct) addXP(25);
    Alert.alert(i === quizMaestroItem.correct ? '✅ ¡Correcto! +25 XP' : '❌ Incorrecto', quizMaestroItem.fb);
  };

  // ============ RENDER ============
  const renderIntro = () => (
    <View>
      <View style={styles.iconCircle}><Text style={{ fontSize: 34 }}>🎯</Text></View>
      <Text style={styles.title}>¿Cuál Herramienta Uso? Elige como un Pro</Text>
      <Text style={styles.subtitle}>El arte de elegir la IA correcta para cada tarea. Como un carpintero tiene martillo, sierra y taladro — no usa el martillo para todo.</Text>
      <View style={[styles.highlight, { backgroundColor: '#f0fdf4' }]}>
        <Text style={{ color: '#065f46', fontSize: 13, lineHeight: 20 }}>
          <Text style={{ fontWeight: 'bold' }}>La regla de oro:</Text> "La herramienta correcta hace la tarea en 10 minutos. La herramienta equivocada tarda 2 horas y da mal resultado". Al final de este nivel podrás mirar cualquier tarea y saber en 5 segundos cuál IA usar.
        </Text>
      </View>
    </View>
  );

  const renderTheory = (title: string, content: React.ReactNode) => (
    <View>
      <Text style={styles.title}>{title}</Text>
      {content}
    </View>
  );

  const renderMapaRapido = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#eef2ff' }]}><Text style={[styles.tagText, { color: '#4338ca' }]}>Nivel 24 · 14 módulos</Text></View>
      <View style={[styles.tag, { backgroundColor: '#f0fdf4' }]}><Text style={[styles.tagText, { color: '#166534' }]}>🗺️ Módulo 1 · Panorama</Text></View>
      <Text style={styles.title}>Cada tarea tiene su herramienta ideal</Text>
      <Text style={styles.bodyText}>Un "cheat sheet" de 10 segundos para decidir:</Text>
      {[
        '📝 Escribir ensayo cuidado → 🟣 Claude',
        '🔎 Buscar con fuentes reales → 🔎 Perplexity',
        '🎨 Imagen artística → 🎨 Midjourney',
        '💻 Corregir código → 💻 Cursor',
        '🎵 Canción con letra → 🎵 Suno',
        '📚 Preguntar a mis apuntes → 📓 NotebookLM',
        '🎬 Clip de video → 🎬 Runway',
        '🗣️ Clonar mi voz → 🎤 ElevenLabs',
      ].map((t, i) => (
        <View key={i} style={styles.card}><Text style={styles.cardText}>{t}</Text></View>
      ))}
    </View>
  );

  const renderComparacion = (title: string, left: { h: string; t: string }, right: { h: string; t: string }, conclusion: string) => (
    <View>
      <Text style={styles.title}>{title}</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <View style={{ flex: 1, backgroundColor: '#f9fafb', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e5e7eb' }}>
          <Text style={{ fontWeight: 'bold', fontSize: 12, marginBottom: 6 }}>{left.h}</Text>
          <Text style={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic' }}>{left.t}</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: '#fdf4ff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e9d5ff' }}>
          <Text style={{ fontWeight: 'bold', fontSize: 12, marginBottom: 6 }}>{right.h}</Text>
          <Text style={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic' }}>{right.t}</Text>
        </View>
      </View>
      <View style={[styles.highlight, { backgroundColor: '#f0fdf4' }]}>
        <Text style={{ color: '#065f46', fontSize: 12 }}><Text style={{ fontWeight: 'bold' }}>Conclusión:</Text> {conclusion}</Text>
      </View>
    </View>
  );

  const renderCaseCards = (cases: { title: string; text: string }[]) => (
    <View>
      {cases.map((c, i) => (
        <View key={i} style={[styles.card, { backgroundColor: '#f9fafb' }]}>
          <Text style={styles.cardTitle}>{c.title}</Text>
          <Text style={styles.cardText}>{c.text}</Text>
        </View>
      ))}
    </View>
  );

  const renderDecisionTree = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#f0fdf4' }]}><Text style={[styles.tagText, { color: '#166534' }]}>🌲 Módulo 11 · Framework</Text></View>
      <Text style={styles.title}>¿Y si no sé cuál usar? Sigue este árbol</Text>
      {[
        'Paso 1: ¿Necesito datos actuales y verificables? → Perplexity',
        'Paso 2: ¿Tengo que analizar documentos MÍOS? → NotebookLM',
        'Paso 3: ¿Es una tarea de escritura cuidada y larga? → Claude',
        'Paso 4: ¿Necesito generar imagen / voz / video / música? → Herramientas específicas (Midjourney, ElevenLabs, Runway, Suno)',
        'Paso 5: ¿Es algo rápido y conversacional? → ChatGPT (o Meta AI en WhatsApp)',
        'Paso 6: ¿Es programación? → Cursor o Copilot',
      ].map((step, i) => (
        <View key={i} style={[styles.highlight, { backgroundColor: '#f5f3ff', borderLeftColor: '#7c3aed', marginBottom: 6 }]}>
          <Text style={{ color: '#5b21b6', fontSize: 13 }}>{step}</Text>
        </View>
      ))}
    </View>
  );

  const renderSprint = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fef3c7' }]}><Text style={[styles.tagText, { color: '#92400e' }]}>⚡ Módulo 9 · Sprint</Text></View>
      <Text style={styles.title}>Sprint: Elige la herramienta correcta en 90 segundos</Text>
      <Text style={{ fontSize: 28, fontWeight: 'bold', textAlign: 'center', color: sprintSec <= 15 ? '#ef4444' : sprintSec <= 30 ? '#f59e0b' : '#7c3aed', marginVertical: 8 }}>
        {Math.floor(sprintSec / 60)}:{String(sprintSec % 60).padStart(2, '0')}
      </Text>
      <View style={{ height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}>
        <View style={{ height: '100%', width: `${(sprintSec / 90) * 100}%`, backgroundColor: '#8b5cf6', borderRadius: 3 }} />
      </View>
      {!sprintStarted && !sprintDone && (
        <TouchableOpacity style={styles.nextBtn} onPress={startSprint}>
          <Text style={styles.nextText}>⚡ Iniciar Sprint</Text>
        </TouchableOpacity>
      )}
      {(sprintStarted || sprintDone) && (
        <View>
          {SPRINT_ANSWERS.map((a, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Text style={{ fontWeight: 'bold', color: '#7c3aed', width: 22 }}>{i + 1}.</Text>
              <Text style={{ flex: 1, fontSize: 11, color: '#6b7280' }}>{a.q}</Text>
              <TextInput
                style={[styles.sprintInput, sprintDone && (sprintAnswers[i]?.trim().toLowerCase().length > 0 && a.valid.some((v) => sprintAnswers[i].trim().toLowerCase().includes(v) || v.includes(sprintAnswers[i].trim().toLowerCase())) ? { borderColor: '#22c55e', backgroundColor: '#f0fdf4' } : { borderColor: '#ef4444', backgroundColor: '#fef2f2' })]}
                placeholder="herramienta..."
                value={sprintAnswers[i]}
                onChangeText={(v) => setSprintAnswers((p) => { const n = [...p]; n[i] = v; return n; })}
                editable={sprintStarted && !sprintDone}
              />
            </View>
          ))}
          {!sprintDone && (
            <TouchableOpacity style={[styles.nextBtn, { backgroundColor: '#f59e0b', marginTop: 8 }]} onPress={endSprint}>
              <Text style={styles.nextText}>✅ Terminar ahora</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );

  const renderQuiz = (item: QuizPoolItem, sel: number | null, done: boolean, onAnswer: (i: number) => void) => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fef3c7' }]}><Text style={[styles.tagText, { color: '#92400e' }]}>🎯 Quiz</Text></View>
      <Text style={styles.title}>{item.q}</Text>
      {item.opts.map((opt, i) => (
        <TouchableOpacity
          key={i}
          style={[styles.optionBtn, sel === i && { borderColor: done ? (i === item.correct ? '#22c55e' : '#ef4444') : '#8b5cf6', backgroundColor: done ? (i === item.correct ? '#f0fdf4' : '#fef2f2') : '#f5f3ff' }]}
          onPress={() => onAnswer(i)}
          disabled={done}
        >
          <Text style={{ fontWeight: 'bold', color: '#7c3aed', marginRight: 8 }}>{String.fromCharCode(65 + i)}</Text>
          <Text style={{ flex: 1, fontSize: 12, color: '#374151' }}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderVF = () => (
    <View>
      <View style={[styles.tag, { backgroundColor: '#fef3c7' }]}><Text style={[styles.tagText, { color: '#92400e' }]}>✓✗ Módulo 14 · V/F</Text></View>
      <Text style={styles.title}>Gratis vs pago</Text>
      {vfItems.map((item, idx) => (
        <View key={idx} style={{ marginBottom: 14 }}>
          <Text style={[styles.card, { fontWeight: '600', fontSize: 13 }]}>{item.s}</Text>
          <View style={{ flexDirection: 'row', gap: 7 }}>
            <TouchableOpacity style={[styles.tfBtn, vfAnswers[idx] === true && { borderColor: '#22c55e', backgroundColor: '#f0fdf4' }]} onPress={() => answerVF(idx, true)} disabled={vfDone}>
              <Text style={{ fontWeight: 'bold' }}>✓ Verdadero</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tfBtn, vfAnswers[idx] === false && { borderColor: '#ef4444', backgroundColor: '#fef2f2' }]} onPress={() => answerVF(idx, false)} disabled={vfDone}>
              <Text style={{ fontWeight: 'bold' }}>✗ Falso</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );

  const renderKit = (title: string, tools: { emoji: string; name: string; desc: string }[], note?: string) => (
    <View>
      <Text style={styles.title}>{title}</Text>
      {tools.map((t, i) => (
        <View key={i} style={[styles.card, { backgroundColor: '#f9fafb' }]}>
          <Text style={styles.cardTitle}>{t.emoji} {t.name}</Text>
          <Text style={styles.cardText}>{t.desc}</Text>
        </View>
      ))}
      {note && (
        <View style={[styles.highlight, { backgroundColor: '#f0fdf4' }]}>
          <Text style={{ color: '#065f46', fontSize: 13, fontWeight: 'bold' }}>{note}</Text>
        </View>
      )}
    </View>
  );

  const renderCompletion = () => (
    <View style={{ alignItems: 'center', padding: 20 }}>
      <Text style={{ fontSize: 56, marginBottom: 16 }}>🎯</Text>
      <Text style={[styles.title, { textAlign: 'center' }]}>¡Nivel 24 Completado!</Text>
      <Text style={[styles.subtitle, { textAlign: 'center' }]}>Ya no eliges IA por moda — eliges por criterio. Sabes cuál herramienta usar para cada tarea, como un profesional.</Text>
      <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#7c3aed', marginVertical: 12 }}>⭐ {xp} XP</Text>
      <View style={[styles.card, { width: '100%', backgroundColor: '#f5f3ff', borderColor: '#c4b5fd' }]}>
        <Text style={{ textAlign: 'center', fontWeight: 'bold', color: '#5b21b6', fontSize: 14 }}>🏆 Insignia: AI Strategist</Text>
        <Text style={{ textAlign: 'center', color: '#6d28d9', fontSize: 12, marginTop: 4 }}>Eliges la IA correcta para cada tarea</Text>
      </View>
      <TouchableOpacity style={styles.finishBtn} onPress={handleFinish}>
        <Text style={{ color: '#fff', fontWeight: 'bold' }}>Volver al mapa</Text>
      </TouchableOpacity>
    </View>
  );

  // ============ RENDER PRINCIPAL ============
  const renderStep = () => {
    switch (step) {
      case 0: return renderIntro();
      case 1: return renderMapaRapido();
      case 2: return renderComparacion(
        'Escribir: ChatGPT vs Claude',
        { h: '💬 ChatGPT', t: '"Queridos compañeros, hoy marcamos el fin de una etapa inolvidable..." (frases estándar de graduación)' },
        { h: '🟣 Claude', t: '"No soy la que más habla en el salón. De hecho, muchos no saben cómo sueno. Pero hoy quería decirles algo real..." (tono personal, respeta la timidez)' },
        'ChatGPT genera volumen rápido pero tiende a sonar genérico. Claude capta mejor el tono personal. Para ensayo largo y cuidado, Claude. Para lluvia de ideas rápida, ChatGPT.'
      );
      case 3: return renderComparacion(
        'Buscar info actualizada: Perplexity vs Gemini',
        { h: '🔎 Perplexity', t: 'Cita fuentes específicas con [1][2][3] y links clickeables. Ideal para trabajos académicos.' },
        { h: '✨ Gemini', t: 'Integrado con Google Maps, Images y YouTube. Ideal para búsquedas visuales y locales.' },
        'Perplexity para fuentes académicas, Gemini para búsquedas visuales del ecosistema Google.'
      );
      case 4: return (
        <View>
          <View style={[styles.tag, { backgroundColor: '#fce7f3' }]}><Text style={[styles.tagText, { color: '#9d174d' }]}>🎨 Módulo 4 · IAs de imagen</Text></View>
          <Text style={styles.title}>Las 4 IAs de imagen que debes conocer</Text>
          {renderCaseCards([
            { title: '🖼️ DALL-E 3 (dentro de ChatGPT)', text: 'La más fácil, ya incluida en ChatGPT. Ideal para imágenes realistas desde descripción simple.' },
            { title: '🎨 Midjourney', text: 'La más artística. Estilo cinematográfico. Ideal para portadas, miniaturas y arte digital.' },
            { title: '🔓 Stable Diffusion', text: 'Open source. La instalas en tu PC. Control total sobre el resultado. Para artistas digitales.' },
            { title: '🖌️ Adobe Firefly (en Photoshop)', text: 'Vive dentro de Photoshop. Edición profesional sin problemas legales de derechos de autor.' },
          ])}
        </View>
      );
      case 5: return renderCaseCards([
        { title: '💬 ChatGPT — el tutor paciente', text: 'Para aprender. Le pegas código, te lo explica línea por línea. Ideal al empezar.' },
        { title: '🐙 GitHub Copilot — el asistente silencioso', text: 'Sugiere la siguiente línea mientras escribes. Para programadores que ya saben y quieren ir rápido.' },
        { title: '🖱️ Cursor — el editor con IA incorporada', text: 'Editor completo con IA. Seleccionas código, Ctrl+K, "reescríbelo mejor". Lo que prefieren los programadores hoy.' },
      ]);
      case 6: return renderTheory('NotebookLM: estudia con tus apuntes', (
        <View>
          <Text style={styles.bodyText}>Subes todos tus materiales (diapositivas, PDFs, apuntes escaneados) y te responde solo con lo que está en tus documentos, citando la página exacta.</Text>
          <View style={[styles.highlight, { backgroundColor: '#f0fdf4' }]}>
            <Text style={{ color: '#065f46', fontSize: 13 }}><Text style={{ fontWeight: 'bold' }}>Función secreta:</Text> Puede generar un podcast de 15 minutos con dos voces IA discutiendo tu material. Ideal para repasar camino al colegio.</Text>
          </View>
        </View>
      ));
      case 7: return renderCaseCards([
        { title: '🔗 Zapier — el más fácil', text: '"Cuando llegue un email con factura, extrae el PDF con ChatGPT, guárdalo en Drive y avísame por WhatsApp". Se configura con clicks, sin programar.' },
        { title: '⚙️ Make — el más poderoso visual', text: 'Similar a Zapier pero con lógica más compleja: condiciones, bucles, filtros. Ideal para negocios pequeños.' },
        { title: '🔧 n8n — el de los programadores', text: 'Open source y autohospedable. Lo corres en tu propio servidor. Control total.' },
      ]);
      case 8: return renderCaseCards([
        { title: '🎬 Runway (Gen-3)', text: 'La más usada en 2026. Calidad cinematográfica, videos de hasta 10 segundos. Ideal para reels profesionales.' },
        { title: '🌟 Sora (de OpenAI)', text: 'La más realista. Videos largos con detalle increíble. Incluida en ChatGPT Pro.' },
        { title: '🎭 Pika Labs', text: 'Orientada a videos cortos para redes sociales. Fácil, rápida, para creadores diarios.' },
        { title: '📽️ Kling AI', text: 'Alternativa china con plan gratuito generoso. Ideal para probar sin pagar.' },
      ]);
      case 9: return renderSprint();
      case 10: return renderCaseCards([
        { title: '❌ Error 1: Abogado de Nueva York, 2023', text: 'Usó ChatGPT para preparar argumentos legales. Inventó 6 casos inexistentes. Multado. Herramienta correcta: IA legal especializada o bases reales.' },
        { title: '❌ Error 2: Estudiante de arquitectura, 2024', text: 'Usó DALL-E para renders de proyecto final. Inconsistencias en física del edificio. Reprobó. Herramienta correcta: software especializado + edición manual.' },
        { title: '❌ Error 3: Periodista colombiano, 2025', text: 'Usó Grok para un reportaje. Dio información con sesgo político. Corrección pública. Herramienta correcta: Perplexity con fuentes plurales + verificación cruzada.' },
      ]);
      case 11: return renderDecisionTree();
      case 12: return renderQuiz(quizArbolItem, quizArbolSel, quizArbolDone, answerQuizArbol);
      case 13: return renderTheory('La técnica Pro: combinar IAs', (
        <View>
          <Text style={styles.bodyText}>Los usuarios avanzados combinan varias IAs en cadena. Ejemplo real: crear un TikTok educativo en 45 minutos.</Text>
          {[
            '1. Perplexity: "Dame 3 datos curiosos verificados sobre el cerebro humano"',
            '2. Claude: "Con estos datos, escribe un guión de 30 segundos, tono informal, para TikTok"',
            '3. ElevenLabs: Clona la voz del estudiante y narra el guión',
            '4. Midjourney: Genera 3 imágenes del cerebro con estilo artístico',
            '5. Runway: Anima las imágenes con leve movimiento',
            '6. CapCut: Junta todo, agrega texto y subtítulos',
          ].map((s, i) => (
            <View key={i} style={[styles.highlight, { backgroundColor: '#f5f3ff', borderLeftColor: '#7c3aed', marginBottom: 4 }]}>
              <Text style={{ color: '#5b21b6', fontSize: 12 }}>{s}</Text>
            </View>
          ))}
        </View>
      ));
      case 14: return renderVF();
      case 15: return renderKit('Arma tu toolkit de estudiante IA (5 herramientas)', [
        { emoji: '🔎', name: 'Perplexity (gratis)', desc: 'Para todas las tareas que requieren datos con fuentes verificables.' },
        { emoji: '🟣', name: 'Claude (gratis)', desc: 'Para ensayos, resúmenes largos, análisis de textos, redacción cuidada.' },
        { emoji: '📓', name: 'NotebookLM (gratis)', desc: 'Subes apuntes, diapositivas, PDFs de clase — te explica basándose solo en eso.' },
        { emoji: '💬', name: 'ChatGPT (gratis)', desc: 'Para dudas rápidas, ideas creativas, explicar conceptos de forma simple.' },
        { emoji: '🎨', name: 'DALL-E dentro de ChatGPT (gratis)', desc: 'Cuando necesites una imagen para un trabajo, presentación o cuento.' },
      ], '💡 Costo total del kit: $0. Todo gratis. Con estas 5, cualquier estudiante hace el 95% de sus tareas mejor que antes.');
      case 16: return renderKit('Arma tu toolkit de creador IA (alternativa)', [
        { emoji: '💬', name: 'ChatGPT', desc: 'Guiones e ideas: títulos virales, hooks, guiones de 30 segundos.' },
        { emoji: '🎨', name: 'Midjourney o DALL-E', desc: 'Miniaturas que destaquen, arte de canal, fondos para clips.' },
        { emoji: '🎵', name: 'Suno', desc: 'Jingle de canal personalizado, música de fondo sin copyright.' },
        { emoji: '🎤', name: 'ElevenLabs', desc: 'Para clonar tu voz o narraciones profesionales.' },
        { emoji: '🎬', name: 'Runway o Pika', desc: 'Transiciones originales, clips imposibles de grabar con cámara.' },
      ]);
      case 17: return renderTheory('Todo esto cambiará en 2 años', (
        <View>
          <Text style={styles.bodyText}>El mapa que aprendiste va a estar desactualizado en 18-24 meses. Pero lo que no va a cambiar es tu habilidad para evaluarlas. El criterio se queda contigo para siempre.</Text>
          <View style={[styles.highlight, { backgroundColor: '#f0fdf4' }]}>
            <Text style={{ color: '#065f46', fontSize: 12, lineHeight: 20 }}>
              <Text style={{ fontWeight: 'bold' }}>Cómo mantenerte actualizado:</Text>{'\n'}
              • Sigue a @simonw o @ethanmollick en X{'\n'}
              • Lee "The Rundown AI" — gratis, 5 minutos{'\n'}
              • Prueba 1 herramienta nueva al mes
            </Text>
          </View>
        </View>
      ));
      case 18: return renderQuiz(quizMaestroItem, quizMaestroSel, quizMaestroDone, answerQuizMaestro);
      case 19: return renderCompletion();
      default: return null;
    }
  };

  const progress = (step / (TOTAL_STEPS - 1)) * 100;
  const handleMain = () => {
    const handlers: Record<number, (() => boolean) | undefined> = {
      9: () => sprintDone,
      12: () => quizArbolDone,
      14: () => vfDone,
      18: () => quizMaestroDone,
    };
    const h = handlers[step];
    if (h) { if (!h()) return; }
    goNext();
  };

  const showNext = step < TOTAL_STEPS - 1 && ![9, 12, 14, 18].includes(step);
  const showCheck = [9, 12, 14, 18].includes(step) && step < TOTAL_STEPS - 1;

  return (
    <View style={styles.screen}>
      <View style={styles.progressBar}>
        <TouchableOpacity onPress={() => router.back()}><MaterialIcons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
        <Text style={styles.xpText}>{xp} XP</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>{renderStep()}</ScrollView>
      {showNext && <TouchableOpacity style={styles.nextBtn} onPress={goNext}><Text style={styles.nextText}>Continuar →</Text></TouchableOpacity>}
      {showCheck && <TouchableOpacity style={styles.nextBtn} onPress={handleMain}><Text style={styles.nextText}>{step === 9 ? (sprintDone ? 'Continuar →' : 'Verificar') : 'Comprobar'}</Text></TouchableOpacity>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  progressBar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  progressTrack: { flex: 1, height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, marginHorizontal: 12 },
  progressFill: { height: '100%', backgroundColor: '#8b5cf6', borderRadius: 3 },
  xpText: { fontWeight: 'bold', fontSize: 14, color: '#854d0e' },
  scroll: { padding: 16, paddingBottom: 40 },
  tag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 12 },
  tagText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  iconCircle: { width: 60, height: 60, borderRadius: 18, backgroundColor: '#f5f3ff', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  title: { ...typography.extraBold, fontSize: 19, color: '#111827', marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#6b7280', marginBottom: 14, lineHeight: 18 },
  bodyText: { fontSize: 13, color: '#374151', lineHeight: 20, marginBottom: 12 },
  card: { backgroundColor: '#f9fafb', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  cardTitle: { fontWeight: 'bold', fontSize: 13, color: '#111827', marginBottom: 4 },
  cardText: { fontSize: 13, color: '#374151', lineHeight: 20 },
  highlight: { borderLeftWidth: 3, borderLeftColor: '#8b5cf6', borderRadius: 4, padding: 11, marginVertical: 8 },
  optionBtn: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 2, borderColor: '#e5e7eb', marginBottom: 8, backgroundColor: '#f9fafb' },
  tfBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 2, borderColor: '#e5e7eb', alignItems: 'center' },
  sprintInput: { borderWidth: 2, borderColor: '#d1d5db', borderRadius: 8, padding: 8, fontSize: 12, width: 100, textAlign: 'center', backgroundColor: '#f9fafb' },
  nextBtn: { backgroundColor: '#8b5cf6', padding: 14, margin: 16, borderRadius: 11, alignItems: 'center' },
  nextText: { fontWeight: 'bold', color: '#fff', fontSize: 15 },
  finishBtn: { backgroundColor: '#8b5cf6', padding: 14, borderRadius: 11, width: '100%', alignItems: 'center', marginTop: 14 },
});