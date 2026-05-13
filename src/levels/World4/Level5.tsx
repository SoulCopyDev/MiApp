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
type VFItem = { s: string; correct: boolean; fb: string };
type QuizItem = { q: string; opts: string[]; correct: number; fb: string };
type DragItem = { id: string; text: string };
type DragZone = { label: string; correct: string[] };
type SprintAnswer = { q: string; valid: string[] };

// ---------- Datos ----------
const OPEN_SOURCE_QUIZ_POOL: QuizItem[] = [
  { q: 'Laura escuchó en clase que Llama es una IA "open source". Su profesor le pide explicar con sus palabras qué significa eso. ¿Cuál explicación es más correcta?',
    opts: ['Que la IA es gratis pero solo Meta puede modificarla', 'Que cualquier persona o empresa puede descargar el modelo, usarlo, modificarlo y crear versiones propias sin pagar', 'Que está hecha con código abierto de Python', 'Que solo se abre a desarrolladores con certificación oficial'],
    correct: 1, fb: 'Open source = código abierto. Meta publicó el modelo Llama completo y gratis para que cualquiera lo descargue y modifique.' },
  { q: 'Un equipo quiere modificar una IA para su empresa sin pedir permiso a nadie. ¿Qué tipo de IA les conviene?',
    opts: ['ChatGPT por ser la más famosa', 'Una IA open source como Llama que pueden bajar, editar y adaptar libremente', 'Gemini por ser de Google', 'Claude por ser la más nueva'],
    correct: 1, fb: 'Open source permite exactamente eso: bajar el modelo y adaptarlo al caso específico.' },
  { q: 'Juan dice: "Si Llama es open source, entonces es más peligrosa". ¿Tiene razón?',
    opts: ['Sí, al ser abierta es más insegura', 'No — al ser abierta, miles de expertos pueden revisar el código y encontrar problemas', 'Sí, pero solo un poco', 'Depende del país'],
    correct: 1, fb: 'El código abierto permite que muchos ojos lo revisen y mejoren la seguridad.' }
];

const NETFLIX_VF_POOL: VFItem[] = [
  { s: 'La página de inicio de Netflix es distinta para cada usuario. La IA arma el "menú" personalizado según lo que ya viste.', correct: true, fb: 'Cierto. Netflix incluso cambia las miniaturas según qué actor te interese más.' },
  { s: 'La lista "Descubrimiento Semanal" de Spotify está hecha por un equipo humano.', correct: false, fb: 'Falso. Es 100% IA. Un sistema llamado "BaRT" analiza millones de canciones y arma tu lista.' },
  { s: 'YouTube usa IA para decidir qué video te sugiere después del que estás viendo.', correct: true, fb: 'Cierto. La IA de recomendación determina más del 70% del tiempo que la gente pasa en YouTube.' },
  { s: 'Las IAs de recomendación solo funcionan con lo que tú ves — no usan datos de otros usuarios.', correct: false, fb: 'Falso. Usan "recomendación por parecidos": comparan tu historial con el de usuarios similares.' },
  { s: 'TikTok mide cuántos segundos te quedas mirando cada video para aprender tus intereses.', correct: true, fb: 'Cierto. El algoritmo mide segundos de atención, no solo likes.' },
  { s: 'Instagram te muestra los posts en orden cronológico.', correct: false, fb: 'Falso. Desde 2016, Instagram usa IA para ordenar el feed según tus interacciones.' },
  { s: 'Amazon usa IA de recomendación desde hace más de 20 años.', correct: true, fb: 'Cierto. Amazon fue pionera en IA de recomendación desde finales de los años 90.' }
];

const OPEN_SOURCE_VF_POOL: VFItem[] = [
  { s: 'Llama (Meta) se puede descargar gratis y ejecutar en tu propio computador.', correct: true, fb: 'Cierto. Con herramientas como Ollama puedes ejecutarlo en una laptop con tarjeta gráfica.' },
  { s: 'ChatGPT es open source: su código está en GitHub.', correct: false, fb: 'Falso. OpenAI guarda el código bajo total secreto. A pesar del nombre "Open"AI.' },
  { s: 'Las IAs open source son menos seguras porque cualquiera puede modificarlas.', correct: false, fb: 'Falso. Al ser código abierto, miles de investigadores pueden auditarlo.' },
  { s: 'Con Llama local, tus datos nunca salen de tu máquina.', correct: true, fb: 'Cierto. Es una razón clave por la que empresas eligen Llama: privacidad total.' },
  { s: 'Claude (Anthropic) es una IA open source, igual que Llama.', correct: false, fb: 'Falso. Claude es cerrada. Anthropic no publica el código ni los pesos del modelo.' },
  { s: 'Un estudiante con una laptop normal puede correr Llama 3 pequeño sin pagar.', correct: true, fb: 'Cierto. Existen versiones pequeñas que corren en laptops con tarjetas gráficas modernas.' },
  { s: 'Cuando una IA es open source, los resultados que genera también son gratis de usar.', correct: true, fb: 'Cierto, en la mayoría de casos. Conviene leer la licencia específica.' }
];

const ECOSYSTEM_DRAG: DragItem[] = [
  { id: 'a', text: '💬 ChatGPT' }, { id: 'b', text: '💼 Copilot (Word)' },
  { id: 'c', text: '🔎 Perplexity' }, { id: 'd', text: '✨ Gemini' },
  { id: 'e', text: '🟣 Claude' }, { id: 'f', text: '🦙 Llama' },
  { id: 'g', text: '🌑 Grok' }, { id: 'h', text: '💬 Meta AI' }
];

const ECOSYSTEM_ZONES: DragZone[] = [
  { label: '🏢 OpenAI', correct: ['a', 'b'] },
  { label: '🟣 Anthropic', correct: ['e'] },
  { label: '🔵 Google', correct: ['d'] },
  { label: '🟢 Meta', correct: ['f', 'h'] },
  { label: '🟡 xAI (Elon Musk)', correct: ['g'] },
  { label: '🔎 Perplexity AI', correct: ['c'] }
];

const PRIVACY_DRAG: DragItem[] = [
  { id: 'a', text: '🦙 Llama corriendo en Ollama (local)' },
  { id: 'b', text: '💬 Meta AI en WhatsApp' },
  { id: 'c', text: '🟣 Claude con plan Pro' },
  { id: 'd', text: '💼 Copilot empresarial (con contrato)' },
  { id: 'e', text: '🆓 Grok versión gratis en X' },
  { id: 'f', text: '💻 LM Studio offline' }
];

const PRIVACY_ZONES: DragZone[] = [
  { label: '🔒 Más privado (datos NO se usan para entrenar)', correct: ['a', 'd', 'f'] },
  { label: '⚠️ Menos privado (datos pueden usarse)', correct: ['b', 'c', 'e'] }
];

const MAP_DRAG: DragItem[] = [
  { id: 'a', text: '🖼️ Midjourney' }, { id: 'b', text: '🎬 Runway' },
  { id: 'c', text: '🎵 Suno' }, { id: 'd', text: '💬 ChatGPT' },
  { id: 'e', text: '🔎 Perplexity' }, { id: 'f', text: '🟣 Claude' },
  { id: 'g', text: '💻 Cursor' }, { id: 'h', text: '🐙 GitHub Copilot' },
  { id: 'i', text: '📊 NotebookLM' }, { id: 'j', text: '📈 Julius AI' }
];

const MAP_ZONES: DragZone[] = [
  { label: '🎨 Crear contenido visual/audio', correct: ['a', 'b', 'c'] },
  { label: '💬 Conversar / escribir', correct: ['d', 'f'] },
  { label: '🔎 Buscar / investigar', correct: ['e', 'i'] },
  { label: '💻 Programar', correct: ['g', 'h'] },
  { label: '📊 Analizar datos', correct: ['j'] }
];

const SPRINT_ANSWERS: SprintAnswer[] = [
  { q: 'La IA dentro de WhatsApp', valid: ['meta ai', 'meta', 'llama', 'metaai'] },
  { q: 'La IA dentro de Word y Excel', valid: ['copilot', 'microsoft copilot', 'microsoft'] },
  { q: 'La IA para buscar con fuentes citadas', valid: ['perplexity', 'perplexity ai'] },
  { q: 'La IA que puedes descargar gratis a tu PC', valid: ['llama', 'ollama', 'meta', 'llama 3'] },
  { q: 'La IA de X/Twitter (Elon Musk)', valid: ['grok', 'xai', 'x ai'] }
];

const ECOSYSTEM_QUIZ_POOL: QuizItem[] = [
  { q: 'Martín, 15 años, quiere lanzar un canal de YouTube sobre misterios históricos. Necesita investigar, escribir guiones, generar miniaturas y música. ¿Cuál combinación es más eficiente?',
    opts: ['Solo ChatGPT para todo', 'Perplexity para investigar + ChatGPT para guiones + Midjourney para miniaturas + Suno para música', 'Solo Grok', 'Copilot en Word'],
    correct: 1, fb: '¡Exacto! Cada herramienta para lo que hace mejor. "Combinar IAs" es usar la mejor de cada categoría.' },
  { q: 'Valentina vive con internet malo. Quiere usar IA sin depender de la conexión ni enviar datos. ¿Qué le conviene?',
    opts: ['ChatGPT gratis', 'Llama corriendo en Ollama o LM Studio en su PC — sin internet, sin enviar datos', 'Gemini con plan Pro', 'Grok'],
    correct: 1, fb: 'Correcto. Ollama y LM Studio permiten ejecutar Llama 100% en local, con total privacidad.' },
  { q: 'Un abogado quiere analizar contratos confidenciales con IA sin que sus datos se usen para entrenar. ¿Qué opción es correcta?',
    opts: ['ChatGPT versión gratis', 'Meta AI en WhatsApp', 'Un plan empresarial (Copilot Enterprise o Claude for Work) con contrato de protección de datos', 'Grok en X'],
    correct: 2, fb: 'Los planes empresariales incluyen contratos legales que prohíben usar los datos para entrenar.' }
];

const TOTAL_STEPS = 20;
const THEORY_STEPS = new Set([0, 1, 2, 3, 5, 6, 10, 12, 14, 15, 16]);

interface LevelProps { navigation?: any; setAllowBack?: (allow: boolean) => void; }

export default function World4Level5({ navigation: propsNavigation, setAllowBack }: LevelProps) {
  const nav = useNavigation();
  const navigation = propsNavigation || nav;
  const completeLevel = useGameStore(s => s.completeLevel);

  const [current, setCurrent] = useState(0);
  const [xp, setXp] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  // Pools aleatorias
  const [quizItem4] = useState(() => OPEN_SOURCE_QUIZ_POOL[Math.floor(Math.random() * OPEN_SOURCE_QUIZ_POOL.length)]);
  const [vfItems7] = useState(() => [...NETFLIX_VF_POOL].sort(() => Math.random() - 0.5).slice(0, 4));
  const [vfItems9] = useState(() => [...OPEN_SOURCE_VF_POOL].sort(() => Math.random() - 0.5).slice(0, 4));
  const [quizItem18] = useState(() => ECOSYSTEM_QUIZ_POOL[Math.floor(Math.random() * ECOSYSTEM_QUIZ_POOL.length)]);

  // Quiz
  const [quizAns, setQuizAns] = useState<number | null>(null);
  const [quizLocked, setQuizLocked] = useState(false);

  // VF
  const [vfAnswers, setVfAnswers] = useState<{ [key: number]: boolean }>({});
  const [vfLocked, setVfLocked] = useState<Set<number>>(new Set());

  // Drag & Drop
  const [ddPlaced, setDdPlaced] = useState<{ [key: number]: number }>({});
  const [ddSel, setDdSel] = useState<number | null>(null);
  const [ddChecked, setDdChecked] = useState(false);

  // Sprint
  const [sprintSec, setSprintSec] = useState(60);
  const [sprintRunning, setSprintRunning] = useState(false);
  const [sprintDone, setSprintDone] = useState(false);
  const [sprintInputs, setSprintInputs] = useState<string[]>(['', '', '', '', '']);
  const sprintTimer = useRef<NodeJS.Timeout | null>(null);

  const canGoBack = THEORY_STEPS.has(current);

  useEffect(() => { setAllowBack?.(canGoBack); }, [canGoBack]);
  useEffect(() => {
    const h = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack) { Alert.alert('Actividad en curso', 'Completa la actividad.'); return true; }
      return false;
    });
    return () => h.remove();
  }, [canGoBack]);

  // Sprint timer
  useEffect(() => {
    if (!sprintRunning || sprintDone) return;
    if (sprintSec <= 0) { endSprint(); return; }
    sprintTimer.current = setTimeout(() => setSprintSec(s => s - 1), 1000);
    return () => { if (sprintTimer.current) clearTimeout(sprintTimer.current); };
  }, [sprintRunning, sprintSec, sprintDone]);

  // Reset drags on step change
  useEffect(() => {
    setDdPlaced({}); setDdSel(null); setDdChecked(false);
    setQuizAns(null); setQuizLocked(false);
    setVfAnswers({}); setVfLocked(new Set());
    if (sprintTimer.current) clearInterval(sprintTimer.current);
    setSprintRunning(false); setSprintDone(false); setSprintSec(60); setSprintInputs(['','','','','']);
  }, [current]);

  const addXP = (v: number) => setXp(p => p + v);
  const nextModule = () => { if (current < TOTAL_STEPS - 1) setCurrent(c => c + 1); };
  const prevModule = () => { if (current > 0) setCurrent(c => c - 1); };
  const finish = () => {
    let stars = xp >= 200 ? 3 : xp >= 130 ? 2 : 1;
    completeLevel(4, 5, stars, xp);
    router.back();
  };

  // Quiz
  const answerQuiz = (idx: number, correct: number) => {
    if (quizLocked) return;
    setQuizAns(idx); setQuizLocked(true);
    if (idx === correct) { setCorrectCount(c => c + 1); addXP(15); }
  };

  // VF
  const answerVF = (idx: number, ans: boolean, correct: boolean) => {
    if (vfLocked.has(idx)) return;
    setVfLocked(p => new Set(p).add(idx));
    setVfAnswers(p => ({ ...p, [idx]: ans }));
    const m = getCurrentModule();
    const items = m.vfPool || [];
    if (vfLocked.size + 1 >= items.length) {
      let c = 0;
      items.forEach((item: VFItem, i: number) => { if ((vfAnswers[i] ?? ans) === item.correct) c++; });
      setCorrectCount(prev => prev + c);
      addXP(15);
    }
  };

  // Drag & Drop
  const handleDdDrop = (zoneIdx: number) => {
    if (ddSel === null || ddChecked) return;
    setDdPlaced(p => ({ ...p, [ddSel]: zoneIdx }));
    setDdSel(null);
  };
  const removeDd = (itemIdx: number) => {
    if (ddChecked) return;
    setDdPlaced(p => { const n = { ...p }; delete n[itemIdx]; return n; });
  };
  const checkDrag = (xpVal: number) => {
    setDdChecked(true);
    const m = getCurrentModule();
    const items: DragItem[] = m.ddItems || [];
    const zones: DragZone[] = m.ddZones || [];
    let correct = 0;
    zones.forEach((zone, zi) => {
      const placedIds: string[] = [];
      Object.entries(ddPlaced).forEach(([k, v]) => { if (v === zi) placedIds.push(items[parseInt(k)].id); });
      if (zone.correct.every(id => placedIds.includes(id)) && placedIds.every(id => zone.correct.includes(id))) correct++;
    });
    if (correct === zones.length) { setCorrectCount(c => c + 1); addXP(xpVal); }
    Alert.alert(correct === zones.length ? '✅' : '❌', `${correct}/${zones.length} correctas.`);
  };

  // Sprint
  const startSprint = () => { setSprintRunning(true); setSprintSec(60); setSprintInputs(['','','','','']); };
  const endSprint = () => {
    if (sprintTimer.current) clearInterval(sprintTimer.current);
    setSprintRunning(false); setSprintDone(true);
    let correct = 0;
    SPRINT_ANSWERS.forEach((a, i) => {
      const val = sprintInputs[i].trim().toLowerCase();
      if (val.length > 0 && a.valid.some(v => val.includes(v) || v.includes(val))) correct++;
    });
    if (correct >= 3) { setCorrectCount(c => c + 1); addXP(20); }
    Alert.alert('Resultado', `${correct}/5 correctas.\nRespuestas: Meta AI, Copilot, Perplexity, Llama (Ollama), Grok.`);
  };

  // Helper to get current module config
  const getCurrentModule = () => {
    const configs: any = {
      4: { vfPool: OPEN_SOURCE_QUIZ_POOL, type: 'quiz' },
      7: { vfPool: vfItems7, type: 'vf' },
      8: { ddItems: ECOSYSTEM_DRAG, ddZones: ECOSYSTEM_ZONES, type: 'drag' },
      9: { vfPool: vfItems9, type: 'vf' },
      13: { ddItems: PRIVACY_DRAG, ddZones: PRIVACY_ZONES, type: 'drag' },
      17: { ddItems: MAP_DRAG, ddZones: MAP_ZONES, type: 'drag' },
      18: { vfPool: ECOSYSTEM_QUIZ_POOL, type: 'quiz' }
    };
    return configs[current] || { type: 'theory' };
  };

  // ========== RENDER ==========
  const btn = (label: string, onPress: () => void, disabled = false) => (
    <TouchableOpacity style={[styles.btn, disabled && styles.btnOff]} onPress={onPress} disabled={disabled}>
      <Text style={styles.btnText}>{label}</Text>
    </TouchableOpacity>
  );

  const renderTheory = (title: string, body: string, info?: string, cases?: { title: string; text: string }[]) => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>{current === 0 ? '🔍 Introducción' : current === 1 ? '🔎 Herramienta' : current === 2 ? '💼 Herramienta' : current === 3 ? '💬 Herramienta' : current === 5 ? '📱 Conoce las IAs' : current === 6 ? '🎮 Casos reales' : current === 10 ? '📡 Escenarios' : current === 12 ? '💰 Precios' : current === 14 ? '🔄 Reflexión' : current === 15 ? '🎓 Casos reales' : current === 16 ? '🎨 Casos reales' : '📖'}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {info && <View style={styles.infoBox}><Text style={styles.infoText}>{info}</Text></View>}
      {cases?.map((c, i) => (
        <View key={i} style={styles.caseCard}>
          <Text style={styles.caseTitle}>{c.title}</Text>
          <Text style={styles.caseText}>{c.text}</Text>
        </View>
      ))}
    </View>
  );

  const renderQuiz = (q: string, opts: string[], correct: number, fb: string) => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>🎯 Pregunta</Text>
      <Text style={styles.quizQ}>{q}</Text>
      {opts.map((o, i) => (
        <TouchableOpacity key={i} style={[styles.quizOpt, quizAns === i && (i === correct ? styles.optCorrect : styles.optWrong)]}
          onPress={() => answerQuiz(i, correct)} disabled={quizLocked}>
          <Text style={quizAns === i ? styles.optTextActive : styles.optText}>{['🅐','🅑','🅒','🅓'][i]} {o}</Text>
        </TouchableOpacity>
      ))}
      {quizLocked && <Text style={styles.feedback}>{quizAns === correct ? '✅ ' : '❌ '}{fb}</Text>}
    </View>
  );

  const renderVF = (title: string, items: VFItem[]) => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>✓ Verdadero o Falso</Text>
      <Text style={styles.title}>{title}</Text>
      {items.map((item, i) => (
        <View key={i} style={styles.vfCard}>
          <Text style={styles.vfStmt}>{item.s}</Text>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.vfBtn, vfAnswers[i] === true && styles.vfTrue, vfLocked.has(i) && item.correct === true && styles.vfCorrect]}
              onPress={() => answerVF(i, true, item.correct)} disabled={vfLocked.has(i)}>
              <Text>✓ Verdadero</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.vfBtn, vfAnswers[i] === false && styles.vfFalse, vfLocked.has(i) && item.correct === false && styles.vfCorrect]}
              onPress={() => answerVF(i, false, item.correct)} disabled={vfLocked.has(i)}>
              <Text>✗ Falso</Text>
            </TouchableOpacity>
          </View>
          {vfLocked.has(i) && <Text style={styles.feedback}>{item.fb}</Text>}
        </View>
      ))}
    </View>
  );

  const renderDrag = (title: string, items: DragItem[], zones: DragZone[], xpVal: number) => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>↕️ Arrastra y clasifica</Text>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.chipWrap}>
        {items.map((item, i) => ddPlaced[i] === undefined && (
          <TouchableOpacity key={i} style={[styles.chip, ddSel === i && styles.chipOn]} onPress={() => setDdSel(ddSel === i ? null : i)} disabled={ddChecked}>
            <Text style={styles.chipText}>{item.text}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {zones.map((zone, zi) => (
        <View key={zi}>
          <Text style={styles.zoneLabel}>{zone.label}</Text>
          <TouchableOpacity style={[styles.dropZone, ddChecked && styles.dropZoneChecked]} onPress={() => handleDdDrop(zi)} disabled={ddChecked}>
            {Object.entries(ddPlaced).map(([k, v]) => v === zi && (
              <TouchableOpacity key={k} onPress={() => removeDd(parseInt(k))} disabled={ddChecked}>
                <Text style={styles.dropChip}>{items[parseInt(k)].text} ✕</Text>
              </TouchableOpacity>
            ))}
          </TouchableOpacity>
        </View>
      ))}
      {!ddChecked && btn('Verificar clasificación', () => checkDrag(xpVal))}
    </View>
  );

  const renderSprint = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.tag}>⚡ Sprint cronometrado</Text>
      <Text style={styles.title}>Nombra la IA detrás de cada app</Text>
      <View style={styles.sprintBox}>
        <Text style={styles.timer}>{sprintRunning ? `${Math.floor(sprintSec / 60)}:${String(sprintSec % 60).padStart(2, '0')}` : '1:00'}</Text>
      </View>
      {SPRINT_ANSWERS.map((a, i) => (
        <View key={i} style={styles.sprintRow}>
          <Text style={styles.sprintNum}>{i + 1}.</Text>
          <Text style={styles.sprintQ}>{a.q}</Text>
          <TextInput style={[styles.sprintInput, sprintDone && sprintInputs[i].trim().length > 0 && a.valid.some(v => sprintInputs[i].trim().toLowerCase().includes(v)) ? styles.sprintCorrect : sprintDone && sprintInputs[i].trim().length > 0 ? styles.sprintWrong : null]}
            placeholder="escribe aquí..." value={sprintInputs[i]} onChangeText={t => { const n = [...sprintInputs]; n[i] = t; setSprintInputs(n); }}
            editable={sprintRunning && !sprintDone} />
        </View>
      ))}
      {!sprintRunning && !sprintDone && btn('⚡ Iniciar Sprint', startSprint)}
      {sprintRunning && !sprintDone && btn('✅ Terminar ahora', endSprint)}
      {sprintDone && btn('Continuar →', nextModule)}
    </View>
  );

  const renderCompletion = () => (
    <View style={styles.completeContainer}>
      <View style={styles.completeIcon}><Text style={styles.iconEmoji}>🧭</Text></View>
      <Text style={styles.completeTitle}>¡Nivel 23 Completado!</Text>
      <Text style={styles.completeSub}>Ahora conoces el mapa completo del ecosistema de IA.</Text>
      <Text style={styles.xpBig}>⭐ {xp} XP ganados</Text>
      <View style={styles.statsRow}>
        <View style={styles.statItem}><Text style={styles.statNum}>{correctCount}</Text><Text style={styles.statLbl}>Correctas</Text></View>
        <View style={styles.statItem}><Text style={styles.statNum}>19</Text><Text style={styles.statLbl}>Módulos</Text></View>
      </View>
      <View style={styles.badgeBox}>
        <Text style={styles.badgeIcon}>🧭</Text>
        <Text style={styles.badgeTitle}>Insignia: AI Navigator</Text>
        <Text style={styles.badgeSub}>Conoces el mapa entero de la IA moderna</Text>
      </View>
      {btn('Volver al mapa', finish)}
    </View>
  );

  const renderModule = () => {
    switch (current) {
      case 0: return renderTheory('La IA es mucho más que ChatGPT', 'Si le preguntas a alguien "¿conoces alguna IA?", el 90% dirá ChatGPT. Pero hay un ecosistema de más de 50 herramientas serias, cada una con especialidad distinta.', 'Dato real: Hay más de 30,000 herramientas de IA catalogadas. La mayoría son especialistas.');
      case 1: return renderTheory('Perplexity: Google con esteroides', 'Perplexity busca en internet en tiempo real, lee los resultados por ti, y te responde con una síntesis citando las fuentes exactas — con numeritos [1] [2] [3] que puedes clickear para verificar.', 'Cuándo gana: noticias recientes, hechos verificables, investigación para tareas, precios actuales.', [{ title: '🎯 Caso real — Tarea de ciencias', text: 'María investiga el telescopio James Webb. Perplexity le da datos 2024 con fuentes de la NASA verificables.' }]);
      case 2: return renderTheory('Copilot: la IA dentro de Word y Excel', 'Microsoft pagó más de 13 mil millones a OpenAI para meter GPT-4 dentro de Word, Excel, PowerPoint, Teams y Outlook. No es una web aparte — es un botón dentro del programa que ya usas.', '', [{ title: '🎯 Caso real — Oficina', text: 'El papá de Lucas recibe un PDF de 40 páginas. Copilot en Word lo resume en 30 segundos, extrae 3 puntos clave y redacta la respuesta.' }]);
      case 3: return renderTheory('Meta AI: la IA en tu WhatsApp', 'Meta lanzó su propia IA y la metió directamente en el buscador de WhatsApp. En muchos países aparece como un contacto azul. No necesitas descargar nada.', 'Dato: Meta AI usa el modelo Llama, que es open source — cualquiera puede descargarlo y usarlo gratis.');
      case 4: return renderQuiz(quizItem4.q, quizItem4.opts, quizItem4.correct, quizItem4.fb);
      case 5: return renderTheory('Las IAs que viven en tu celular', 'Seguro que ya usas varias IAs sin saberlo: Siri (iPhone, conectada a ChatGPT), Google Assistant (Android, con Gemini), Bixby (Samsung), Meta AI (WhatsApp).', '', [
        { title: '🍎 Siri (iPhone)', text: 'Desde 2024 conectada a ChatGPT. Controla apps con voz.' },
        { title: '🤖 Google Assistant (Android)', text: 'Integrado con Gemini. Ejecuta acciones reales en apps de Google.' },
        { title: '📱 Bixby (Samsung)', text: 'IA propia de Samsung para rutinas del teléfono.' },
        { title: '💬 Meta AI (en WhatsApp)', text: 'Chat de IA gratuito sin descargar apps extras.' }
      ]);
      case 6: return renderTheory('La IA también está en tus juegos', 'Los NPCs ahora usan IA generativa real. Cada jugador tiene una conversación única con el mismo personaje. Minecraft ya tiene mods que generan estructuras con IA.', '', [
        { title: '🎯 NPCs que hablan de verdad', text: 'Estudios como Inworld AI crean personajes conectados a ChatGPT: cada jugador tiene una conversación única.' },
        { title: '🎯 Mundos generados con IA', text: 'Roblox permite crear modelos 3D con descripciones. Los juegos del futuro generarán mundos en tiempo real.' }
      ]);
      case 7: return renderVF('Netflix y Spotify usan IA', vfItems7);
      case 8: return renderDrag('¿Qué IA hay detrás?', ECOSYSTEM_DRAG, ECOSYSTEM_ZONES, 20);
      case 9: return renderVF('Open source vs cerrado', vfItems9);
      case 10: return renderTheory('¿Puedes usar IA sin conexión?', 'Sí. Se llama ejecutar modelos localmente. Con herramientas como Ollama, LM Studio o Jan.ai, descargas modelos como Llama 3 a tu computador y los corres sin internet.', 'Ventaja: privacidad total y cero costo. Desventaja: modelos más pequeños, menos "inteligencia" que GPT-4 en la nube.');
      case 11: return renderSprint();
      case 12: return renderTheory('Los 4 modelos de precio', 'No todas las IAs se pagan igual. Conoce cómo cobra cada una antes de elegir.', '', [
        { title: '🆓 100% gratis', text: 'Meta AI en WhatsApp, Perplexity básico. La empresa gana por otras vías.' },
        { title: '🎁 Freemium', text: 'Gratis con límites. ChatGPT gratis limita mensajes/día. Plus cuesta $20/mes.' },
        { title: '💳 Suscripción mensual', text: '$20-$30/mes por acceso completo. Como Netflix pero para IA.' },
        { title: '🏢 Planes empresa', text: 'Más caros pero protegen datos: la IA no aprende con tus documentos.' }
      ]);
      case 13: return renderDrag('Privacidad: ¿cuál es más segura?', PRIVACY_DRAG, PRIVACY_ZONES, 15);
      case 14: return renderTheory('¿Las IAs se parecen cada vez más?', 'Los 4 grandes (ChatGPT, Claude, Gemini, Grok) hacen casi lo mismo. Se le llama "convergencia". Pero se diferencian en detalles (qué hacen mejor) y en principios (seguridad, código abierto, libertad de expresión).', '1. Diferenciación en detalles: Claude mejor en textos largos, ChatGPT en imágenes/voz, Gemini en ecosistema Google, Grok en datos de X.\n\n2. Diferenciación por principios: Anthropic (seguridad), Meta (open source), xAI (libertad de expresión), OpenAI (producto masivo).');
      case 15: return renderTheory('La mejor combinación para estudiar', 'Si tuvieras que elegir solo 3 herramientas para estudiar mejor:', '', [
        { title: '🔎 Perplexity — para investigar', text: 'Datos reales, actualizados, con fuentes para citar. Nunca inventa, siempre cita.' },
        { title: '📓 NotebookLM — tus propios materiales', text: 'Subes PDFs, apuntes. Responde basándose solo en esos documentos. Genera podcasts de repaso.' },
        { title: '🟣 Claude — para pensar y escribir', text: 'Razonar sobre algo difícil, escribir ensayos, corregir redacción. Respeta tu estilo.' }
      ]);
      case 16: return renderTheory('La mejor combinación para crear contenido', 'Si te dedicas a crear (videos, arte digital, canciones), este es el trío:', '', [
        { title: '💬 ChatGPT — guión e ideas', text: 'Lluvia de ideas, guiones, títulos virales, descripciones, hashtags.' },
        { title: '🖼️ Midjourney — visuales únicos', text: 'La IA con la estética más reconocible. Genera miniaturas, portadas, ilustraciones.' },
        { title: '🎵 Suno — música y jingles', text: 'Música de fondo, jingles para intros, canciones completas con letra.' }
      ]);
      case 17: return renderDrag('Mapa del ecosistema', MAP_DRAG, MAP_ZONES, 20);
      case 18: return renderQuiz(quizItem18.q, quizItem18.opts, quizItem18.correct, quizItem18.fb);
      case 19: return renderCompletion();
      default: return null;
    }
  };

  const progressPercent = (current / (TOTAL_STEPS - 1)) * 100;
  const isCompletion = current === 19;

  return (
    <View style={styles.screen}>
      <View style={styles.bar}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialIcons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.track}><View style={[styles.fill, { width: `${progressPercent}%` }]} /></View>
        <Text style={styles.xpChip}>{xp} XP</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {renderModule()}
        {!isCompletion && (
          <View style={styles.navRow}>
            <TouchableOpacity style={[styles.btnNav, !canGoBack && { opacity: 0 }]} onPress={prevModule} disabled={!canGoBack}>
              <Text style={styles.btnNavText}>← Volver</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnPrimary} onPress={nextModule}>
              <Text style={styles.btnText}>Continuar →</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  bar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  track: { flex: 1, height: 6, backgroundColor: colors.borderLight, borderRadius: 3, marginHorizontal: 12 },
  fill: { height: '100%', backgroundColor: '#06b6d4', borderRadius: 3 },
  xpChip: { ...typography.bold, fontSize: 14, color: '#06b6d4' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  stepContainer: { flex: 1 },
  tag: { fontSize: 11, fontWeight: '600', color: '#06b6d4', backgroundColor: '#ecfeff', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 12, alignSelf: 'flex-start' },
  title: { ...typography.extraBold, fontSize: 19, color: colors.textPrimary, marginBottom: 8, textAlign: 'center' },
  subtitle: { ...typography.regular, fontSize: 13, color: colors.textSecondary, marginBottom: 14, lineHeight: 18 },
  body: { ...typography.regular, fontSize: 13, color: colors.textPrimary, lineHeight: 22, marginBottom: 12 },
  infoBox: { backgroundColor: '#ecfeff', borderLeftWidth: 4, borderLeftColor: '#06b6d4', borderRadius: 4, padding: 14, marginVertical: 10 },
  infoText: { fontSize: 12, color: '#155e75', lineHeight: 20 },
  caseCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  caseTitle: { ...typography.bold, fontSize: 13, color: '#06b6d4', marginBottom: 6 },
  caseText: { fontSize: 12, color: '#475569', lineHeight: 18 },
  quizQ: { ...typography.bold, fontSize: 13, padding: 12, backgroundColor: '#f8fafc', borderRadius: 10, marginBottom: 10 },
  quizOpt: { padding: 14, borderRadius: 11, borderWidth: 2, borderColor: '#e2e8f0', marginBottom: 7, flexDirection: 'row', alignItems: 'center', gap: 10 },
  optText: { fontSize: 12, color: '#334155', flex: 1 },
  optTextActive: { fontSize: 12, color: '#0f172a', fontWeight: '600', flex: 1 },
  optCorrect: { borderColor: '#22c55e', backgroundColor: '#f0fdf4' },
  optWrong: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },
  feedback: { marginTop: 10, padding: 12, borderRadius: 10, fontSize: 12, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#22c55e', color: '#065f46' },
  vfCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  vfStmt: { fontSize: 13, color: colors.textPrimary, marginBottom: 10, lineHeight: 20 },
  row: { flexDirection: 'row', gap: 10 },
  vfBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 2, borderColor: '#e2e8f0', alignItems: 'center' },
  vfTrue: { borderColor: '#22c55e', backgroundColor: '#f0fdf4' },
  vfFalse: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },
  vfCorrect: { borderColor: '#22c55e', backgroundColor: '#dcfce7' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 12, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 },
  chip: { padding: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#cbd5e1', backgroundColor: '#fff' },
  chipOn: { borderColor: '#06b6d4', backgroundColor: '#ecfeff' },
  chipText: { fontSize: 11, color: '#0f172a' },
  zoneLabel: { ...typography.bold, fontSize: 12, color: '#06b6d4', marginBottom: 4, marginTop: 8 },
  dropZone: { minHeight: 45, padding: 10, borderRadius: 10, borderWidth: 2, borderStyle: 'dashed', borderColor: '#cbd5e1', backgroundColor: '#fafafa', flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dropZoneChecked: { borderStyle: 'solid' },
  dropChip: { fontSize: 10, padding: 4, backgroundColor: '#ecfeff', borderRadius: 6, color: '#155e75' },
  sprintBox: { alignItems: 'center', backgroundColor: '#ecfeff', borderRadius: 16, padding: 20, marginBottom: 12, borderWidth: 2, borderColor: '#06b6d4' },
  timer: { fontSize: 40, fontWeight: '800', color: '#06b6d4' },
  sprintRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  sprintNum: { fontSize: 14, fontWeight: '700', color: '#06b6d4', width: 22 },
  sprintQ: { flex: 1, fontSize: 12, color: '#475569' },
  sprintInput: { flex: 1, borderWidth: 2, borderColor: '#cbd5e1', borderRadius: 8, padding: 8, fontSize: 13, backgroundColor: '#fff', color: '#0f172a' },
  sprintCorrect: { borderColor: '#22c55e', backgroundColor: '#f0fdf4' },
  sprintWrong: { borderColor: '#ef4444', backgroundColor: '#fff1f2' },
  btn: { backgroundColor: '#06b6d4', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  btnText: { ...typography.bold, color: '#fff', fontSize: 15 },
  btnOff: { opacity: 0.4 },
  btnSecondary: { backgroundColor: '#fff', padding: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', marginTop: 12 },
  btnSecondaryText: { ...typography.bold, color: '#06b6d4', fontSize: 14 },
  completeContainer: { alignItems: 'center', padding: 20 },
  completeIcon: { width: 90, height: 90, borderRadius: 24, backgroundColor: '#ecfeff', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  iconEmoji: { fontSize: 44 },
  completeTitle: { ...typography.extraBold, fontSize: 22, marginBottom: 4 },
  completeSub: { ...typography.regular, textAlign: 'center', marginVertical: 8, color: colors.textSecondary },
  xpBig: { ...typography.bold, fontSize: 20, color: '#06b6d4', marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 16, marginBottom: 20 },
  statItem: { backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  statNum: { fontSize: 20, fontWeight: '800', color: '#06b6d4' },
  statLbl: { fontSize: 10, color: '#64748b', marginTop: 2 },
  badgeBox: { backgroundColor: '#ecfeff', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#06b6d4' },
  badgeIcon: { fontSize: 42, marginBottom: 8 },
  badgeTitle: { fontSize: 15, fontWeight: '800', color: '#155e75' },
  badgeSub: { fontSize: 11, color: '#06b6d4' },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, gap: 12 },
  btnNav: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  btnNavText: { fontSize: 14, color: '#64748b', fontWeight: '600' },
  btnPrimary: { backgroundColor: '#06b6d4', padding: 14, borderRadius: 12, alignItems: 'center' },
});