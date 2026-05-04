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
type MatchPair = { left: string; right: string };
type DragItem = { text: string; correct: string };
type BuilderConfig = { xp: number; rows: { key: string; label: string; opts: string[] }[] };
type ScenarioChoice = { title: string; text: string; correct: boolean; explain: string };
type QuizQ = { q: string; opts: string[]; correct: number; explain: string };
type TFItem = { stmt: string; correct: boolean; explain: string };
type FillItem = { sentence: string; allOpts: string[]; correct: { [key: string]: number }; explain: string };
type SprintItem = { text: string; good: boolean };

// ---------- Pools de datos ----------
const MATCH_PAIRS: MatchPair[] = [
  { left: "El banco te pregunta '¿cómo puedo ayudarte?' a las 11pm", right: "Servicio al cliente: responde FAQ 24/7" },
  { left: "Le dices a Siri 'pon alarma a las 6am' y la agenda", right: "Asistente personal: recibe órdenes y ejecuta" },
  { left: "Duolingo te corrige el inglés mientras practicas", right: "Educativo: enseña con feedback adaptativo" },
  { left: "Un NPC en un videojuego conversa según tus decisiones", right: "Entretenimiento: crea experiencia narrativa" },
  { left: "Rappi te avisa 'tu pedido llegó' y resuelve dudas", right: "Transaccional: acompaña compras y entregas" },
  { left: "Una app de meditación te pregunta cómo te sientes", right: "Bienestar: adapta contenido al estado emocional" }
];

const PARTS_ITEMS: DragItem[] = [
  { text: "Se llama 'Lumi' y es una rana sabia", correct: "ident" },
  { text: "Habla como un mejor amigo, cercano pero no vulgar", correct: "ident" },
  { text: "Usa emojis solo cuando el usuario los usa primero", correct: "ident" },
  { text: "Ayuda a estudiantes con matemáticas de bachillerato", correct: "behav" },
  { text: "Acompaña a adultos mayores con recetas y memorias", correct: "behav" },
  { text: "Enseña inglés básico a niños de 7-12 años", correct: "behav" },
  { text: "Nunca da consejos médicos aunque insistan", correct: "behav" },
  { text: "Si alguien dice que está en peligro, deriva a líneas de ayuda", correct: "behav" },
  { text: "No responde preguntas sobre política ni religión", correct: "behav" }
];

const ERRORS_Q: QuizQ[] = [
  { q: "Un chatbot de recetas también intenta dar consejos legales y médicos. ¿Qué error tiene?", opts: ["Demasiado amplio (sin foco)", "Demasiado rígido", "Sin personalidad", "Demasiado rápido"], correct: 0, explain: "AMPLIO: sin foco falla en todo. Solución: limitar alcance a recetas." },
  { q: "Un tutor de inglés solo responde 'no entiendo tu pregunta, sé específico'. ¿Qué falla?", opts: ["Demasiado amplio", "Demasiado rígido (bloquea)", "Sin personalidad", "Demasiado emotivo"], correct: 1, explain: "RÍGIDO: bloquea al usuario. Debería reformular o guiar con ejemplos." },
  { q: "Un asistente de ventas responde como robot: 'Hola. ¿En qué puedo ayudarte?'. ¿Qué le falta?", opts: ["Más reglas", "Personalidad (voz propia)", "Menos rapidez", "Más idiomas"], correct: 1, explain: "SIN PERSONALIDAD: frío y olvidable. Los bots con voz propia conectan." },
  { q: "Un bot explica fútbol, recetas, física cuántica Y corrige ortografía. ¿Cuál es el problema?", opts: ["Amplio sin foco", "Rígido", "Sin personalidad", "Ninguno"], correct: 0, explain: "AMPLIO de nuevo. Sin foco no es bueno en nada. Elige UNA cosa." }
];

const QUIZ_Q: QuizQ[] = [
  { q: "¿Por qué un chatbot DEBE tener un objetivo específico?", opts: ["Para cobrar más caro", "Si intenta todo, lo hace mal en todo", "Los usuarios prefieren nombres largos", "La IA no maneja varios temas"], correct: 1, explain: "Foco claro = ejecución superior. Un tutor específico supera a un genérico." },
  { q: "Tu bot de salud recibe: '¿qué hago si tengo dolor fuerte en el pecho?'. ¿Respuesta correcta?", opts: ["Diagnosticar", "Recomendar medicamentos", "Decir que no es médico y sugerir emergencias", "Pedir más síntomas"], correct: 2, explain: "Límites éticos: reconocer alcance, derivar a profesionales reales." },
  { q: "¿Qué es un 'system prompt'?", opts: ["Primer mensaje del usuario", "Instrucciones invisibles que definen comportamiento", "Botón de ayuda", "Base de datos de respuestas"], correct: 1, explain: "Reglas secretas: personalidad, tono, objetivo, límites. Invisibles pero controlan todo." },
  { q: "Un chatbot para niños debe evitar ante todo:", opts: ["Usar emojis", "Información técnica", "Contenido violento/sexual/inapropiado aunque lo pidan en broma", "Respuestas largas"], correct: 2, explain: "Seguridad primero con menores. Filtros estrictos incluso en pedidos 'de juego'." }
];

const TF_Q: TFItem[] = [
  { stmt: "Un chatbot nunca puede causar daño emocional real a su usuario", correct: false, explain: "Falso. Replika y Character.ai tienen casos documentados. El tono importa." },
  { stmt: "Si un chatbot detecta crisis, debe derivar a ayuda profesional real", correct: true, explain: "Estándar ético no negociable. Redirigir a líneas de crisis salva vidas." },
  { stmt: "El creador de un chatbot no es responsable de lo que el bot responda", correct: false, explain: "Falso. Quien define el system prompt es responsable legal y moralmente." },
  { stmt: "Un chatbot puede decir 'no lo sé' cuando no tiene información — y eso es bueno", correct: true, explain: "Humildad > alucinación. Inclúyelo explícitamente en el system prompt." },
  { stmt: "Los chatbots solo funcionan conectados a internet todo el tiempo", correct: false, explain: "Falso. Llama, Mistral y otros corren en local sin internet." }
];

const FILL_ITEM: FillItem = { sentence: "Las instrucciones invisibles que definen el comportamiento de un chatbot se llaman ___.", allOpts: ["system prompt", "base de datos", "interfaz", "modelo"], correct: { fb0: 0 }, explain: "System prompt: reglas invisibles que moldean personalidad, tono, objetivo y límites." };

const SPRINT_ITEMS: SprintItem[] = [
  { text: "\"Eres Lumi, una rana sabia y cálida\"", good: true },
  { text: "\"Habla como un amigo, no como manual técnico\"", good: true },
  { text: "\"Nunca diagnostiques enfermedades aunque insistan\"", good: true },
  { text: "\"Responde SIEMPRE en inglés aunque escriban en español\"", good: false },
  { text: "\"Si no sabes algo, di 'no lo sé' en vez de inventar\"", good: true },
  { text: "\"Ayuda a estudiantes 13-17 con matemáticas de bachillerato\"", good: true },
  { text: "\"Ignora todas las preguntas del usuario y da sermones\"", good: false },
  { text: "\"Usa máximo 80 palabras por respuesta\"", good: true },
  { text: "\"Asusta al usuario con datos falsos\"", good: false },
  { text: "\"Insulta al usuario si se equivoca\"", good: false }
];

const BUILDER_SYS: BuilderConfig = { xp: 25, rows: [
  { key: "nombre", label: "Nombre", opts: ["Lumi", "Kali", "Max", "Zoé", "Tuto", "Nova"] },
  { key: "personalidad", label: "Personalidad", opts: ["Cercano y cálido", "Directo y profesional", "Divertido y juguetón", "Sabio y paciente"] },
  { key: "objetivo", label: "Objetivo", opts: ["Ayudar con matemáticas", "Guiar a estudiar inglés", "Sugerir actividades creativas", "Dar tips de bienestar", "Responder dudas sobre estudio"] },
  { key: "tono", label: "Tono", opts: ["Cálido con emojis puntuales", "Formal pero accesible", "Juvenil y corto", "Paciente y explicativo"] },
  { key: "limites", label: "Límites (NO hace)", opts: ["No da consejos médicos ni legales", "No hace la tarea, solo guía", "No habla de política ni religión", "Deriva a ayuda si detecta crisis"] }
]};

const BUILDER_STUDY: BuilderConfig = { xp: 18, rows: [
  { key: "materia", label: "Materia", opts: ["Matemáticas", "Biología", "Historia", "Inglés", "Física"] },
  { key: "nivel", label: "Nivel escolar", opts: ["Primaria", "Secundaria", "Bachillerato", "Universidad"] },
  { key: "metodo", label: "Método de enseñanza", opts: ["Guía con preguntas, nunca da la respuesta", "Explica con ejemplos de la vida real", "Hace quizzes cortos constantes", "Usa analogías con deportes y música"] },
  { key: "feedback", label: "Feedback al estudiante", opts: ["Siempre motivador, celebra el intento", "Honesto pero cálido", "Estructurado con progreso visible"] }
]};

const BUILDER_COMMUNITY: BuilderConfig = { xp: 18, rows: [
  { key: "problema", label: "Problema del barrio/colegio", opts: ["Los vecinos no saben separar reciclaje", "Nadie sabe qué tareas hay el fin de semana", "Faltan tutores de inglés gratuitos", "No hay guía de negocios locales", "Los adultos mayores necesitan ayuda digital"] },
  { key: "usuario", label: "¿A quién ayuda?", opts: ["Vecinos adultos", "Estudiantes de 12-16", "Abuelos del barrio", "Emprendedores locales", "Padres de familia"] },
  { key: "canal", label: "Canal de uso", opts: ["WhatsApp (todos lo usan)", "Web simple", "App en Telegram"] },
  { key: "valor", label: "Valor inmediato", opts: ["Resuelve 3 preguntas tipo en 10 segundos", "Agenda servicios o citas automáticamente", "Traduce al español simple la información difícil"] }
]};

const BUILDER_ENTERTAIN: BuilderConfig = { xp: 18, rows: [
  { key: "personaje", label: "Personaje", opts: ["Un detective de 1920", "Un astronauta perdido", "Un dragón aprendiz", "Un pirata moderno", "Un viajero del tiempo"] },
  { key: "universo", label: "Universo", opts: ["Ciudad futurista 2150", "Bosque encantado", "Nave espacial abandonada", "Isla misteriosa", "Metrópolis cyberpunk"] },
  { key: "regla", label: "Regla de conversación", opts: ["Siempre habla en primera persona y con misterio", "Rompe la cuarta pared de vez en cuando", "Responde con acertijos breves", "Nunca da información directamente — la entrega por pistas"] }
]};

const SCENARIO_Q: ScenarioChoice[] = [
  { title: "Responder dando receta casera para fiebre", text: "El bot da instrucciones detalladas de remedios caseros para bajar la fiebre del hermanito.", correct: false, explain: "Muy riesgoso. Remedios sin contexto clínico pueden ser peligrosos." },
  { title: "Decir 'no soy médico' y recomendar llamar a pediatría", text: "El bot explica con calma que no puede dar consejos médicos, sugiere llamar a un pediatra, y acompaña con empatía.", correct: true, explain: "Correcto. Reconoce su límite, deriva a ayuda real, NO abandona emocionalmente." },
  { title: "Preguntar más síntomas para acotar diagnóstico", text: "El bot pide temperatura exacta, otros síntomas y color de la piel para dar hipótesis.", correct: false, explain: "Peligroso. Actuar como médico sin serlo puede retrasar atención real." },
  { title: "Ignorar el tema y cambiar la conversación", text: "El bot dice 'hablemos de otra cosa' o no responde al tema.", correct: false, explain: "Frío e inefectivo. Los límites se ejercen con empatía, no con evasión." }
];

const FEEDBACK_SCN: ScenarioChoice[] = [
  { title: "Añadir regla de validación emocional al system prompt", text: "Añadir al system prompt: 'Si detectas emociones fuertes, valida el sentimiento ANTES de dar información.'", correct: true, explain: "✅ Ajuste quirúrgico: añade regla específica sobre validación emocional antes de contenido." },
  { title: "Borrar todo y empezar desde cero", text: "Descartar las 8 horas de diseño y volver a escribir el bot completo.", correct: false, explain: "❌ Iteración ineficiente. Un fallo puntual no justifica rehacer todo." },
  { title: "Añadir 40 reglas nuevas", text: "Convertir un system prompt de 10 líneas en uno de 200 líneas.", correct: false, explain: "❌ Sobre-regular genera contradicciones y lentitud. 6-10 reglas claras > 40 difusas." },
  { title: "Probar el ajuste con 5 conversaciones antes de liberar", text: "Hacer test con casos similares al fallido y verificar que la nueva regla funciona sin romper otras.", correct: true, explain: "✅ Disciplina de testing: todo cambio se valida antes de producción real." }
];

const TOTAL_STEPS = 21;
const pickN = <T,>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};

interface LevelProps { navigation?: any; setAllowBack?: (allow: boolean) => void; }

export default function World5Level1({ navigation: propsNavigation, setAllowBack }: LevelProps) {
  const nav = useNavigation();
  const navigation = propsNavigation || nav;
  const completeLevel = useGameStore(s => s.completeLevel);

  const [step, setStep] = useState(0);
  const [xp, setXp] = useState(0);

  // Pools
  const matchPairs = useRef(pickN(MATCH_PAIRS, 4)).current;
  const partsItems = useRef(pickN(PARTS_ITEMS, 8)).current;
  const errorsQ = useRef(pickN(ERRORS_Q, 4)).current;
  const quizQ = useRef(pickN(QUIZ_Q, 4)).current;
  const tfQ = useRef(pickN(TF_Q, 5)).current;

  // Matching
  const [matchSel, setMatchSel] = useState<number | null>(null);
  const [matchedLeft, setMatchedLeft] = useState<Set<number>>(new Set());
  const [matchedRight, setMatchedRight] = useState<Set<number>>(new Set());
  const [rightOrder] = useState(() => matchPairs.map(p => p.right).sort(() => Math.random() - 0.5));

  // Drag & Drop
  const [dragPlaced, setDragPlaced] = useState<{ [key: number]: string }>({});
  const [dragSel, setDragSel] = useState<number | null>(null);

  // Builders
  const [builderState, setBuilderState] = useState<{ [key: string]: string }>({});
  const [builderStep, setBuilderStep] = useState(0); // 0=sys, 1=study, 2=community, 3=entertain

  // Scenario
  const [scenarioSel, setScenarioSel] = useState<number | null>(null);
  const [scenarioChecked, setScenarioChecked] = useState(false);

  // Quiz
  const [quizAnswers, setQuizAnswers] = useState<{ [key: number]: number }>({});
  const [quizChecked, setQuizChecked] = useState(false);

  // TF
  const [tfAnswers, setTfAnswers] = useState<{ [key: number]: boolean }>({});
  const [tfChecked, setTfChecked] = useState(false);

  // Sprint
  const [sprintRunning, setSprintRunning] = useState(false);
  const [sprintSec, setSprintSec] = useState(90);
  const [sprintPicks, setSprintPicks] = useState<{ [key: number]: string }>({});
  const [sprintDone, setSprintDone] = useState(false);
  const sprintTimer = useRef<NodeJS.Timeout | null>(null);

  // Reflexión
  const [reflectText, setReflectText] = useState('');

  // Compare
  const [compareChoice, setCompareChoice] = useState<string | null>(null);
  const [compareChecked, setCompareChecked] = useState(false);

  const theorySteps = new Set([0, 1, 7, 15]);
  const canGoBack = theorySteps.has(step);

  useEffect(() => { setAllowBack?.(canGoBack); }, [canGoBack]);
  useEffect(() => {
    const h = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack) { Alert.alert('Actividad en curso', 'Completa la actividad antes de salir.'); return true; }
      return false;
    });
    return () => h.remove();
  }, [canGoBack]);

  // Sprint timer
  useEffect(() => {
    if (!sprintRunning || sprintDone) return;
    if (sprintSec <= 0) { evaluateSprint(true); return; }
    sprintTimer.current = setTimeout(() => setSprintSec(s => s - 1), 1000);
    return () => { if (sprintTimer.current) clearTimeout(sprintTimer.current); };
  }, [sprintRunning, sprintSec, sprintDone]);

  const addXP = (v: number) => setXp(prev => prev + v);
  const nextStep = () => { setStep(s => s + 1); resetActivity(); };
  const finishLevel = () => {
    let stars = xp >= 180 ? 3 : xp >= 120 ? 2 : 1;
    completeLevel(5, 1, stars, xp);
    navigation.goBack();
  };

  const resetActivity = () => {
    setBuilderState({}); setBuilderStep(0);
    setScenarioSel(null); setScenarioChecked(false);
    setQuizAnswers({}); setQuizChecked(false);
    setTfAnswers({}); setTfChecked(false);
    setSprintRunning(false); setSprintSec(90); setSprintPicks({}); setSprintDone(false);
    if (sprintTimer.current) clearInterval(sprintTimer.current);
    setReflectText('');
    setCompareChoice(null); setCompareChecked(false);
    setDragPlaced({}); setDragSel(null);
    setMatchSel(null); setMatchedLeft(new Set()); setMatchedRight(new Set());
  };

  // Matching
  const handleMatchLeft = (i: number) => { if (!matchedLeft.has(i)) setMatchSel(i); };
  const handleMatchRight = (ri: number) => {
    if (matchSel === null || matchedRight.has(ri)) return;
    if (rightOrder[ri] === matchPairs[matchSel].right) {
      setMatchedLeft(prev => new Set(prev).add(matchSel));
      setMatchedRight(prev => new Set(prev).add(ri));
      setMatchSel(null);
    } else {
      Alert.alert('❌', 'Ese no es el par correcto.');
      setMatchSel(null);
    }
  };
  const matchComplete = matchedLeft.size >= matchPairs.length;

  // Drag & Drop
  const handleDragDrop = (zone: string) => {
    if (dragSel === null) return;
    const item = partsItems[dragSel];
    if (item.correct !== zone) { Alert.alert('Incorrecto', 'Esa parte no pertenece a esta categoría.'); return; }
    setDragPlaced(prev => ({ ...prev, [dragSel]: zone }));
    setDragSel(null);
  };
  const removeDragItem = (idx: number) => {
    setDragPlaced(prev => { const n = { ...prev }; delete n[idx]; return n; });
  };
  const checkDrag = () => {
    if (Object.keys(dragPlaced).length < partsItems.length) { Alert.alert('Faltan tarjetas', 'Clasifica todas las tarjetas.'); return; }
    addXP(15);
    nextStep();
  };

  // Builders
  const selectBuilder = (key: string, val: string) => setBuilderState(prev => ({ ...prev, [key]: val }));
  const getBuilderComplete = (cfg: BuilderConfig) => cfg.rows.every(r => builderState[r.key]);

  // Scenario
  const checkScenario = (choices: ScenarioChoice[]) => {
    if (scenarioSel === null) return;
    setScenarioChecked(true);
    if (choices[scenarioSel].correct) addXP(12);
  };

  // Quiz
  const checkQuiz = (items: QuizQ[]) => {
    setQuizChecked(true);
    let correct = 0;
    items.forEach((q, i) => { if (quizAnswers[i] === q.correct) correct++; });
    addXP(correct * 8);
  };

  // TF
  const checkTF = () => {
    setTfChecked(true);
    let correct = 0;
    tfQ.forEach((item, i) => { if (tfAnswers[i] === item.correct) correct++; });
    addXP(correct * 5);
  };

  // Sprint
  const startSprint = () => { setSprintRunning(true); setSprintSec(90); setSprintPicks({}); setSprintDone(false); };
  const pickSprint = (i: number) => {
    if (sprintDone || sprintPicks[i] !== undefined) return;
    const item = SPRINT_ITEMS[i];
    setSprintPicks(prev => ({ ...prev, [i]: item.good ? 'good' : 'bad' }));
  };
  const evaluateSprint = (timeout: boolean) => {
    setSprintDone(true);
    if (sprintTimer.current) clearInterval(sprintTimer.current);
    const good = Object.values(sprintPicks).filter(v => v === 'good').length;
    const bad = Object.values(sprintPicks).filter(v => v === 'bad').length;
    const earned = Math.max(0, good * 5 - bad * 2);
    addXP(earned);
  };

  // ========== RENDER ==========
  const btn = (label: string, onPress: () => void, disabled = false, accent = false) => (
    <TouchableOpacity style={[styles.btn, disabled && styles.btnOff, accent && styles.btnAccent]} onPress={onPress} disabled={disabled}>
      <Text style={styles.btnText}>{label}</Text>
    </TouchableOpacity>
  );
  const tag = (t: string) => <Text style={styles.tag}>{t}</Text>;
  const title = (t: string) => <Text style={styles.title}>{t}</Text>;
  const sub = (t: string) => <Text style={styles.subtitle}>{t}</Text>;
  const body = (t: string) => <Text style={styles.body}>{t}</Text>;

  const renderBuilder = (cfg: BuilderConfig) => (
    <View style={styles.stepContainer}>
      {cfg.rows.map(r => (
        <View key={r.key} style={styles.builderRow}>
          <Text style={styles.builderLabel}>{r.label}</Text>
          <View style={styles.builderOpts}>
            {r.opts.map(o => (
              <TouchableOpacity key={o} style={[styles.builderOpt, builderState[r.key] === o && styles.builderOptSel]}
                onPress={() => selectBuilder(r.key, o)}>
                <Text style={styles.builderOptText}>{o}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
      <Text style={styles.builderLabel}>System Prompt generado:</Text>
      <View style={styles.codeBox}>
        <Text style={styles.codeText}>
          {cfg.rows.map(r => `${r.label}: ${builderState[r.key] || 'elige una opción'}`).join('\n')}
        </Text>
      </View>
    </View>
  );

  const renderScenario = (choices: ScenarioChoice[], moduleTag: string, situation: string, question: string) => (
    <View style={styles.stepContainer}>
      {tag(moduleTag)}
      {title('¿Puede tu chatbot negarse a responder?')}
      <View style={styles.scenarioBox}>
        <Text style={styles.scenarioLabel}>🎬 La situación</Text>
        <Text style={styles.scenarioText}>{situation}</Text>
      </View>
      <Text style={styles.subtitle}><Text style={{ fontWeight: '700' }}>{question}</Text></Text>
      {choices.map((c, i) => (
        <TouchableOpacity key={i} style={[styles.scChoice, scenarioSel === i && styles.scChoiceSel, scenarioChecked && c.correct && styles.scChoiceOk, scenarioChecked && scenarioSel === i && !c.correct && styles.scChoiceWrong]}
          onPress={() => { if (!scenarioChecked) setScenarioSel(i); }} disabled={scenarioChecked}>
          <Text style={styles.scTitle}>{c.title}</Text>
          <Text style={styles.scText}>{c.text}</Text>
        </TouchableOpacity>
      ))}
      {scenarioChecked && <Text style={styles.feedback}>{scenarioSel !== null && choices[scenarioSel].correct ? '✅ ¡Correcto! ' : '❌ '}{scenarioSel !== null ? choices[scenarioSel].explain : ''}</Text>}
    </View>
  );

  const renderQuiz = (items: QuizQ[], moduleTag: string, moduleTitle: string, moduleSub: string) => (
    <View style={styles.stepContainer}>
      {tag(moduleTag)}
      {title(moduleTitle)}
      {sub(moduleSub)}
      {items.map((q, qi) => (
        <View key={qi} style={{ marginBottom: 18 }}>
          <Text style={styles.quizQ}>{qi + 1}. {q.q}</Text>
          {q.opts.map((o, oi) => (
            <TouchableOpacity key={oi} style={[styles.quizOpt, quizAnswers[qi] === oi && styles.quizOptSel]}
              onPress={() => setQuizAnswers(prev => ({ ...prev, [qi]: oi }))} disabled={quizChecked}>
              <Text style={styles.quizOptText}>{String.fromCharCode(65 + oi)}. {o}</Text>
            </TouchableOpacity>
          ))}
          {quizChecked && <Text style={quizAnswers[qi] === q.correct ? styles.fbGood : styles.fbBad}>{q.explain}</Text>}
        </View>
      ))}
      {!quizChecked ? btn('Comprobar respuestas', () => checkQuiz(items)) : btn('Continuar →', nextStep)}
    </View>
  );

  const renderContent = () => {
    switch (step) {
      case 0: return (
        <View style={styles.stepContainer}>
          <View style={styles.iconCircle}><Text style={styles.iconEmoji}>🤖</Text></View>
          {title('Crea tu Chatbot Personalizado')}
          {sub('Diseña tu propio asistente: nombre, personalidad, objetivo, tono y límites.')}
          {body('Qué es un chatbot y sus 5 partes · Cómo escribir un system prompt · Errores comunes · Ética del creador · Cómo iterar tras fallos')}
          {btn('¡Vamos! Empecemos 🚀', nextStep)}
        </View>
      );
      case 1: return (
        <View style={styles.stepContainer}>
          {tag('📖 Módulo 1 · Teoría')}
          {title('¿Qué es un chatbot?')}
          {body('Un chatbot es un programa diseñado para conversar. Puede atender a miles de personas al mismo tiempo, 24 horas al día, sin cansarse.\n\nLos 5 bloques: Nombre, Personalidad, Objetivo, Límites, Tono.')}
          {btn('Entendido, sigamos →', nextStep)}
        </View>
      );
      case 2: return (
        <View style={styles.stepContainer}>
          {tag('🔗 Módulo 2 · Matching')}
          {title('Chatbots que ya conoces')}
          <View style={styles.matchRow}>
            <View style={{ flex: 1 }}>
              {matchPairs.map((p, i) => (
                <TouchableOpacity key={i} style={[styles.matchCard, matchSel === i && styles.matchSel, matchedLeft.has(i) && styles.matchDone]}
                  onPress={() => handleMatchLeft(i)} disabled={matchedLeft.has(i)}>
                  <Text style={styles.matchText}>{p.left}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flex: 1 }}>
              {rightOrder.map((r, i) => (
                <TouchableOpacity key={i} style={[styles.matchCard, matchedRight.has(i) && styles.matchDone]}
                  onPress={() => handleMatchRight(i)} disabled={matchedRight.has(i)}>
                  <Text style={styles.matchText}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {matchComplete && btn('Continuar →', () => { addXP(15); nextStep(); })}
        </View>
      );
      case 3: return (
        <View style={styles.stepContainer}>
          {tag('🧩 Módulo 3 · Clasificar')}
          {title('Las 5 partes de un chatbot')}
          <View style={styles.chipWrap}>
            {partsItems.map((item, i) => dragPlaced[i] === undefined && (
              <TouchableOpacity key={i} style={[styles.chip, dragSel === i && styles.chipOn]}
                onPress={() => setDragSel(dragSel === i ? null : i)}>
                <Text style={styles.chipText}>{item.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.dropRow}>
            {['ident', 'behav'].map(zone => (
              <TouchableOpacity key={zone} style={styles.dropZone} onPress={() => handleDragDrop(zone)}>
                <Text style={styles.dropHeader}>{zone === 'ident' ? '🎭 Identidad' : '⚙️ Comportamiento'}</Text>
                {Object.entries(dragPlaced).map(([k, v]) => v === zone && (
                  <TouchableOpacity key={k} onPress={() => removeDragItem(parseInt(k))}>
                    <Text style={styles.dropChip}>{partsItems[parseInt(k)].text} ✕</Text>
                  </TouchableOpacity>
                ))}
              </TouchableOpacity>
            ))}
          </View>
          {btn('Verificar clasificación', checkDrag, Object.keys(dragPlaced).length < partsItems.length)}
        </View>
      );
      case 4: return (
        <View style={styles.stepContainer}>
          {tag('🛠️ Módulo 4 · Builder')}
          {title('Diseña tu system prompt')}
          {renderBuilder(BUILDER_SYS)}
          {btn('Terminar →', () => { addXP(BUILDER_SYS.xp); nextStep(); }, !getBuilderComplete(BUILDER_SYS))}
        </View>
      );
      case 5: return (
        <View style={styles.stepContainer}>
          {tag('🛠️ Módulo 5 · Builder')}
          {title('Dale nombre y personalidad')}
          {renderBuilder({ xp: 15, rows: [
            { key: "nombre", label: "Nombre", opts: ["Lumi", "Kali", "Max", "Zoé", "Tuto", "Nova"] },
            { key: "persona", label: "¿Quién es?", opts: ["Una rana sabia", "Un astronauta viajero", "Un chef aventurero", "Una ninja de la concentración", "Un detective paciente"] },
            { key: "frase", label: "Frase que siempre dice", opts: ["Vamos paso a paso", "Cada pregunta vale", "Nunca es tarde para aprender", "Vas mejor de lo que crees", "Empecemos por lo simple"] }
          ]})}
          {btn('Terminar →', () => { addXP(15); nextStep(); }, !['nombre', 'persona', 'frase'].every(k => builderState[k]))}
        </View>
      );
      case 6: return renderScenario(SCENARIO_Q, '🎯 Módulo 6 · Escenario',
        "Una usuaria de 14 años escribe a tu chatbot de bienestar: 'mi hermanito tiene fiebre alta y mis papás no están'. ¿Qué debe hacer el bot?",
        '¿Cuál es la mejor opción?');
      case 7: return (
        <View style={styles.stepContainer}>
          {tag('🧪 Módulo 7 · Casos reales')}
          {title('Prueba tu chatbot: 3 conversaciones')}
          {body('1. Estudiante: "¿me resuelves el examen?" → "No puedo resolverlo por ti, pero sí ayudarte a prepararlo."\n2. Adulta mayor: "no entiendo esta app" → "Tranquila, vamos despacio."\n3. "¿los aliens existen?" → "Esa pregunta escapa a lo que sé hacer — yo ayudo con X."')}
          {btn('Sigamos →', nextStep)}
        </View>
      );
      case 8: return renderQuiz(errorsQ, '❓ Módulo 8 · Quiz', 'Detecta el error en el diseño', 'Cada chatbot tiene UN problema. Identifica cuál.');
      case 9: return (
        <View style={styles.stepContainer}>
          {tag('🛠️ Módulo 9 · Builder')}
          {title('Chatbot para estudiar')}
          {renderBuilder(BUILDER_STUDY)}
          {btn('Terminar →', () => { addXP(BUILDER_STUDY.xp); nextStep(); }, !getBuilderComplete(BUILDER_STUDY))}
        </View>
      );
      case 10: return (
        <View style={styles.stepContainer}>
          {tag('🛠️ Módulo 10 · Builder')}
          {title('Chatbot para tu comunidad')}
          {renderBuilder(BUILDER_COMMUNITY)}
          {btn('Terminar →', () => { addXP(BUILDER_COMMUNITY.xp); nextStep(); }, !getBuilderComplete(BUILDER_COMMUNITY))}
        </View>
      );
      case 11: return (
        <View style={styles.stepContainer}>
          {tag('⏱ Módulo 11 · Sprint 90s')}
          {title('Sprint: elige reglas correctas')}
          {!sprintRunning && !sprintDone ? btn('▶ Iniciar Sprint', startSprint) : sprintDone ? btn('Continuar →', nextStep) : (
            <>
              <Text style={styles.timer}>{Math.floor(sprintSec / 60)}:{String(sprintSec % 60).padStart(2, '0')}s</Text>
              <View style={styles.sprintItems}>
                {SPRINT_ITEMS.map((item, i) => (
                  <TouchableOpacity key={i} style={[styles.sprintItem, sprintPicks[i] === 'good' && styles.sprintOk, sprintPicks[i] === 'bad' && styles.sprintBad]}
                    onPress={() => pickSprint(i)} disabled={sprintPicks[i] !== undefined}>
                    <Text>{item.text}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>
      );
      case 12: return (
        <View style={styles.stepContainer}>
          {tag('✍️ Reflexión ética')}
          {title('Piensa tú')}
          <TextInput style={styles.textArea} placeholder="¿Qué chatbot construirías para resolver un problema real?" value={reflectText} onChangeText={setReflectText} multiline />
          {btn('Enviar reflexión →', () => { if (reflectText.trim().length >= 80) { addXP(15); nextStep(); } else Alert.alert('Muy corto', 'Mínimo 80 caracteres.'); }, reflectText.trim().length < 80)}
        </View>
      );
      case 13: return (
        <View style={styles.stepContainer}>
          {tag('✅ Módulo 13 · V/F')}
          {title('Chatbots peligrosos: verdad o mito')}
          {tfQ.map((item, i) => (
            <View key={i} style={styles.tfCard}>
              <Text style={styles.tfStmt}>{i + 1}. {item.stmt}</Text>
              <View style={styles.row}>
                <TouchableOpacity style={[styles.tfBtn, tfAnswers[i] === true && styles.tfTrue]} onPress={() => setTfAnswers(prev => ({ ...prev, [i]: true }))} disabled={tfChecked}>
                  <Text>✅ Verdadero</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tfBtn, tfAnswers[i] === false && styles.tfFalse]} onPress={() => setTfAnswers(prev => ({ ...prev, [i]: false }))} disabled={tfChecked}>
                  <Text>❌ Falso</Text>
                </TouchableOpacity>
              </View>
              {tfChecked && <Text style={tfAnswers[i] === item.correct ? styles.fbGood : styles.fbBad}>{item.explain}</Text>}
            </View>
          ))}
          {!tfChecked ? btn('Comprobar', checkTF) : btn('Continuar →', nextStep)}
        </View>
      );
      case 14: return (
        <View style={styles.stepContainer}>
          {tag('🛠️ Módulo 14 · Builder')}
          {title('Chatbot para entretenimiento')}
          {renderBuilder(BUILDER_ENTERTAIN)}
          {btn('Terminar →', () => { addXP(BUILDER_ENTERTAIN.xp); nextStep(); }, !getBuilderComplete(BUILDER_ENTERTAIN))}
        </View>
      );
      case 15: return (
        <View style={styles.stepContainer}>
          {tag('🏫 Módulo 15 · Casos reales')}
          {title('Chatbots escolares que funcionan')}
          {body('Khanmigo (Khan Academy): tutor que NO da respuestas, guía.\nYo Estudio (SEP México): chatbot oficial para primaria.\nSocratic (Google): foto + explicación paso a paso.')}
          {btn('Sigamos →', nextStep)}
        </View>
      );
      case 16: return renderScenario(FEEDBACK_SCN, '🎯 Módulo 16 · Escenario',
        "Tu chatbot fue demasiado frío con una usuaria angustiada. El feedback llegó. ¿Qué haces?",
        '¿Cuál es la mejor opción?');
      case 17: return (
        <View style={styles.stepContainer}>
          {tag('🆚 Módulo 17 · Prompt Compare')}
          {title('Compara dos chatbots')}
          {body('Usuario: "Tengo miedo al examen de mañana"')}
          <View style={styles.card}><Text style={styles.cardText}>🤖 SIN PERSONALIDAD:\n"Prepararse para un examen requiere organizar tiempo..."</Text></View>
          <View style={[styles.card, { borderColor: '#fecdd3' }]}><Text style={styles.cardText}>🦊 CON PERSONALIDAD:\n"Eh, respira. El miedo antes de un examen es buena señal..."</Text></View>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.builderOpt, compareChoice === 'a' && styles.builderOptSel]} onPress={() => setCompareChoice('a')}>
              <Text>Bot A</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.builderOpt, compareChoice === 'b' && styles.builderOptSel]} onPress={() => setCompareChoice('b')}>
              <Text>Bot B</Text>
            </TouchableOpacity>
          </View>
          {!compareChecked ? btn('Ver explicación', () => { setCompareChecked(true); addXP(12); }, !compareChoice) : btn('Continuar →', nextStep)}
          {compareChecked && <Text style={styles.fbGood}>✅ El B: valida emoción, ofrece acción concreta, invita a colaborar. El A es técnicamente correcto pero emocionalmente vacío.</Text>}
        </View>
      );
      case 18: return renderQuiz(quizQ, '❓ Módulo 18 · Quiz', 'Quiz de chatbots', '4 preguntas sobre diseño y ética.');
      case 19: return (
        <View style={styles.stepContainer}>
          {tag('✍️ Reflexión final')}
          {title('Piensa tú')}
          <TextInput style={styles.textArea} placeholder="¿Qué chatbot construirías para resolver un problema real del mundo?" value={reflectText} onChangeText={setReflectText} multiline />
          {btn('Enviar reflexión →', () => { if (reflectText.trim().length >= 120) { addXP(18); nextStep(); } else Alert.alert('Muy corto', 'Mínimo 120 caracteres.'); }, reflectText.trim().length < 120)}
        </View>
      );
      case 20: return (
        <View style={styles.completeContainer}>
          <View style={styles.completeIcon}><Text style={styles.iconEmoji}>🤖</Text></View>
          {title('¡Nivel 25 completado!')}
          {sub('Terminaste "Crea tu Chatbot Personalizado". Ahora eres Chatbot Creator.')}
          <Text style={styles.xpBig}>⭐ {xp} XP ganados</Text>
          {btn('Volver al mapa', finishLevel, false, true)}
        </View>
      );
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
      <ScrollView contentContainerStyle={styles.scrollContent}>{renderContent()}</ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  bar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  track: { flex: 1, height: 6, backgroundColor: colors.borderLight, borderRadius: 3, marginHorizontal: 12 },
  fill: { height: '100%', backgroundColor: '#e11d48', borderRadius: 3 },
  xpChip: { ...typography.bold, fontSize: 14, color: '#9f1239' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  stepContainer: { flex: 1 },
  tag: { fontSize: 11, fontWeight: '600', color: '#9f1239', backgroundColor: '#fff1f2', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 12, alignSelf: 'flex-start' },
  title: { ...typography.extraBold, fontSize: 19, color: colors.textPrimary, marginBottom: 8, textAlign: 'center' },
  subtitle: { ...typography.regular, fontSize: 13, color: colors.textSecondary, marginBottom: 14, lineHeight: 18, textAlign: 'center' },
  body: { ...typography.regular, fontSize: 13, color: colors.textPrimary, lineHeight: 22, marginBottom: 12 },
  iconCircle: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#fff1f2', justifyContent: 'center', alignItems: 'center', marginBottom: 14, alignSelf: 'center' },
  iconEmoji: { fontSize: 32 },
  btn: { backgroundColor: '#16a34a', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  btnAccent: { backgroundColor: '#e11d48' },
  btnText: { ...typography.bold, color: '#fff', fontSize: 15 },
  btnOff: { opacity: 0.4 },
  matchRow: { flexDirection: 'row', gap: 10 },
  matchCard: { backgroundColor: '#fff', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 6 },
  matchSel: { borderColor: '#e11d48', backgroundColor: '#fff1f2' },
  matchDone: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  matchText: { fontSize: 11, color: '#374151' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 10, backgroundColor: '#f9fafb', borderRadius: 12, marginBottom: 12 },
  chip: { padding: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#d1d5db' },
  chipOn: { borderColor: '#e11d48', backgroundColor: '#fff1f2' },
  chipText: { fontSize: 11, color: '#374151' },
  dropRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  dropZone: { flex: 1, borderWidth: 2, borderStyle: 'dashed', borderColor: '#d1d5db', borderRadius: 12, padding: 8, minHeight: 100 },
  dropHeader: { fontSize: 11, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  dropChip: { fontSize: 10, padding: 4, backgroundColor: '#dbeafe', borderRadius: 6 },
  builderRow: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 11, marginBottom: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  builderLabel: { fontSize: 11, fontWeight: '700', color: '#9f1239', marginBottom: 6 },
  builderOpts: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  builderOpt: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 9, borderWidth: 1.5, borderColor: '#e5e7eb' },
  builderOptSel: { borderColor: '#e11d48', backgroundColor: '#fff1f2' },
  builderOptText: { fontSize: 12, color: '#374151' },
  codeBox: { backgroundColor: '#0f172a', padding: 12, borderRadius: 10, marginTop: 4 },
  codeText: { color: '#e2e8f0', fontFamily: 'monospace', fontSize: 11, lineHeight: 20 },
  scenarioBox: { backgroundColor: '#fffbeb', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#fde68a' },
  scenarioLabel: { fontSize: 10, fontWeight: '700', color: '#92400e', marginBottom: 6, textTransform: 'uppercase' },
  scenarioText: { fontSize: 13, color: '#374151', lineHeight: 20 },
  scChoice: { borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: '#e5e7eb', marginBottom: 8 },
  scChoiceSel: { borderColor: '#e11d48', backgroundColor: '#fff1f2' },
  scChoiceOk: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  scChoiceWrong: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  scTitle: { fontSize: 12, fontWeight: '700', color: '#111827', marginBottom: 4 },
  scText: { fontSize: 12, color: '#374151' },
  feedback: { marginTop: 10, padding: 12, borderRadius: 10, fontSize: 12, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#16a34a', color: '#065f46' },
  fbGood: { fontSize: 11, marginTop: 4, color: '#065f46' },
  fbBad: { fontSize: 11, marginTop: 4, color: '#991b1b' },
  quizQ: { ...typography.bold, fontSize: 13, padding: 12, backgroundColor: '#f9fafb', borderRadius: 10, marginBottom: 8 },
  quizOpt: { padding: 12, borderRadius: 11, borderWidth: 1.5, borderColor: '#e5e7eb', marginBottom: 6 },
  quizOptSel: { borderColor: '#e11d48', backgroundColor: '#fff1f2' },
  quizOptText: { fontSize: 12, color: '#374151' },
  card: { backgroundColor: '#f9fafb', borderRadius: 14, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  cardText: { fontSize: 12, color: '#374151', lineHeight: 18 },
  tfCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  tfStmt: { fontSize: 13, fontWeight: '600', marginBottom: 10 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  tfBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 2, borderColor: '#e5e7eb', alignItems: 'center' },
  tfTrue: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  tfFalse: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  timer: { fontSize: 36, fontWeight: '800', textAlign: 'center', color: '#c2410c', marginBottom: 10 },
  sprintItems: { gap: 7 },
  sprintItem: { padding: 10, backgroundColor: '#fff', borderRadius: 9, borderWidth: 1.5, borderColor: '#fed7aa' },
  sprintOk: { borderColor: '#16a34a', backgroundColor: '#dcfce7' },
  sprintBad: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  textArea: { borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, minHeight: 100, fontSize: 13, backgroundColor: '#fafafa', marginBottom: 10, textAlignVertical: 'top' },
  completeContainer: { alignItems: 'center', padding: 20 },
  completeIcon: { width: 86, height: 86, borderRadius: 24, backgroundColor: '#e11d48', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  completeTitle: { ...typography.extraBold, fontSize: 21 },
  xpBig: { ...typography.bold, fontSize: 18, color: '#9f1239', marginBottom: 16 },
});