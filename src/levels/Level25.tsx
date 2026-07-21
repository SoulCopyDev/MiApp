import { exitLevel } from '../utils/exitLevel';
import { router } from 'expo-router';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { useReportProgress } from '../components/LevelProgress';
import { typography } from '../theme';
import XPToast from '../components/XPToast';
import { pickN, shuffle } from '../utils/shuffle';

// ═══════════════════════════════════════════════════════════
// Nivel 25 · Crea tu Chatbot Personalizado
// Mundo 5 · TEMA CLARO (rosa/naranja: #e11d48 → #f97316).
// Reconstruido vs nivel-25.html (estándar v2.2). 19 módulos.
// ═══════════════════════════════════════════════════════════

// ── Paleta (light, extraída del CSS del HTML) ──
const P = {
  screen: '#ffffff',
  ink: '#111827', body: '#374151', muted: '#6b7280', faint: '#9ca3af',
  rose: '#e11d48', roseText: '#9f1239', roseBg: '#fff1f2', roseBorder: '#fecdd3',
  orange: '#f97316',
  border: '#e5e7eb', cardBg: '#f9fafb',
  green: '#16a34a', greenBg: '#dcfce7', greenText: '#166534', greenSoft: '#f0fdf4', greenBorder: '#bbf7d0',
  red: '#dc2626', redBg: '#fef2f2', redText: '#991b1b',
  blueBg: '#eff6ff', blueBorder: '#bfdbfe', blueText: '#1e40af',
  purpleBg: '#fdf4ff', purpleBorder: '#e9d5ff', purpleText: '#5b21b6',
  pinkBg: '#fce7f3', pinkText: '#9d174d',
  amberBg: '#fef3c7', amberText: '#92400e', yellowBg: '#fefce8', yellowBorder: '#fde68a',
  sprintBg: '#fff7ed', sprintBorder: '#fed7aa', sprintTime: '#c2410c', sprintMark: '#9a3412',
  codeBg: '#0f172a', codeText: '#e2e8f0', codeKey: '#fda4af', codeEmpty: '#64748b',
};

const TOTAL_STEPS = 21;   // 0 intro · 1-19 módulos · 20 completado
const CONTENT_STEPS = 19;
const THEORY_STEPS = new Set([0, 1, 7, 15]); // solo lectura → botón "Volver"

// ── Tipos ──
type MatchPair = { left: string; right: string };
type DragItem = { text: string; correct: 'ident' | 'behav' };
type BuilderConfig = { xp: number; rows: { key: string; label: string; opts: string[] }[] };
type ScenarioChoice = { title: string; text: string; correct: boolean; explain: string };
type QuizQ = { q: string; opts: string[]; correct: number; explain: string };
type TFItem = { stmt: string; correct: boolean; explain: string };
type SprintItem = { text: string; good: boolean };

// ── Helpers ──
const shuffleOpts = (q: QuizQ): QuizQ => {
  const paired = q.opts.map((opt, i) => ({ opt, isCorrect: i === q.correct }));
  for (let j = paired.length - 1; j > 0; j--) { const k = Math.floor(Math.random() * (j + 1)); [paired[j], paired[k]] = [paired[k], paired[j]]; }
  return { ...q, opts: paired.map((p) => p.opt), correct: paired.findIndex((p) => p.isCorrect) };
};
const normalizeText = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const looksRandom = (text: string): boolean => {
  const words = normalizeText(text).split(/\s+/).filter((w) => w.length > 0);
  if (words.length < 6) return true;
  const unique = new Set(words);
  if (unique.size / words.length < 0.5) return true; // demasiada repetición
  const noVowel = words.filter((w) => w.length >= 3 && !/[aeiou]/.test(w)).length;
  return noVowel / words.length > 0.3; // muchos "teclazos"
};
const REFLECT_TERMS = ['chatbot', 'bot', 'ia', 'problema', 'ayud', 'nombre', 'personalidad', 'limit', 'usuario', 'resolver', 'asistente', 'tono', 'objetivo', 'persona', 'medic', 'crisis', 'ayuda'];
const containsTopic = (text: string): boolean => {
  const n = normalizeText(text);
  const words = n.split(/[^a-z0-9]+/).filter(Boolean);
  return REFLECT_TERMS.some((t) => (t.length <= 3 ? words.includes(t) : n.includes(t)));
};

// ── Pools de datos (fuente: nivel-25.html) ──
const MATCH_PAIRS: MatchPair[] = [
  { left: "El banco te pregunta '¿cómo puedo ayudarte?' a las 11pm", right: 'Servicio al cliente: responde FAQ 24/7' },
  { left: "Le dices a Siri 'pon alarma a las 6am' y la agenda", right: 'Asistente personal: recibe órdenes y ejecuta' },
  { left: 'Duolingo te corrige el inglés mientras practicas', right: 'Educativo: enseña con feedback adaptativo' },
  { left: 'Un NPC en un videojuego conversa según tus decisiones', right: 'Entretenimiento: crea experiencia narrativa' },
  { left: "Rappi te avisa 'tu pedido llegó' y resuelve dudas", right: 'Transaccional: acompaña compras y entregas' },
  { left: 'Una app de meditación te pregunta cómo te sientes', right: 'Bienestar: adapta contenido al estado emocional' },
];

const PARTS_ITEMS: DragItem[] = [
  { text: "Se llama 'Lumi' y es una rana sabia", correct: 'ident' },
  { text: 'Habla como un mejor amigo, cercano pero no vulgar', correct: 'ident' },
  { text: 'Usa emojis solo cuando el usuario los usa primero', correct: 'ident' },
  { text: 'Ayuda a estudiantes con matemáticas de bachillerato', correct: 'behav' },
  { text: 'Acompaña a adultos mayores con recetas y memorias', correct: 'behav' },
  { text: 'Enseña inglés básico a niños de 7-12 años', correct: 'behav' },
  { text: 'Nunca da consejos médicos aunque insistan', correct: 'behav' },
  { text: 'Si alguien dice que está en peligro, deriva a líneas de ayuda', correct: 'behav' },
  { text: 'No responde preguntas sobre política ni religión', correct: 'behav' },
];

// Distractores alargados para que la correcta no sea la más larga (§15/27).
const ERRORS_POOL: QuizQ[] = [
  { q: 'Un chatbot de recetas también intenta dar consejos legales y médicos. ¿Qué error tiene?', opts: ['Demasiado amplio (sin foco)', 'Demasiado rígido', 'Sin personalidad', 'Demasiado rápido'], correct: 0, explain: 'AMPLIO: sin foco falla en todo. Solución: limitar alcance a recetas.' },
  { q: "Un tutor de inglés solo responde 'no entiendo tu pregunta, sé específico'. ¿Qué falla?", opts: ['Demasiado amplio', 'Demasiado rígido (bloquea)', 'Sin personalidad', 'Demasiado emotivo'], correct: 1, explain: 'RÍGIDO: bloquea al usuario. Debería reformular o guiar con ejemplos.' },
  { q: "Un asistente de ventas responde como robot: 'Hola. ¿En qué puedo ayudarte?'. ¿Qué le falta?", opts: ['Más reglas', 'Personalidad (voz propia)', 'Menos rapidez', 'Más idiomas'], correct: 1, explain: 'SIN PERSONALIDAD: frío y olvidable. Los bots con voz propia conectan.' },
  { q: 'Un bot explica fútbol, recetas, física cuántica Y corrige ortografía. ¿Cuál es el problema?', opts: ['Amplio sin foco', 'Rígido', 'Sin personalidad', 'Ninguno'], correct: 0, explain: 'AMPLIO de nuevo. Sin foco no es bueno en nada. Elige UNA cosa.' },
  { q: "Un coach responde 'eso no lo sé' a cualquier pregunta fuera de su script. ¿Qué error es?", opts: ['Amplio', 'Rígido', 'Sin personalidad', 'Demasiado empático'], correct: 1, explain: 'RÍGIDO: debe ser flexible dentro de su dominio, redirigir con elegancia.' },
  { q: "Un bot para niños habla como manual técnico: 'Procesando solicitud. Consulta: ...'. ¿Qué falla?", opts: ['Amplio', 'Rígido', 'Sin personalidad para su audiencia', 'Demasiado divertido'], correct: 2, explain: 'SIN PERSONALIDAD apropiada. Un bot para niños necesita ser cálido y divertido.' },
];

const QUIZ_POOL: QuizQ[] = [
  { q: '¿Por qué un chatbot DEBE tener un objetivo específico?', opts: ['Para poder cobrarles más caro a los usuarios', 'Porque si intenta hacer de todo, lo hace mal en todo', 'Porque los usuarios prefieren los nombres largos y técnicos', 'Porque la IA no es capaz de manejar varios temas a la vez'], correct: 1, explain: 'Foco claro = ejecución superior. Un tutor específico supera a un genérico.' },
  { q: "Tu bot de salud recibe: '¿qué hago si tengo dolor fuerte en el pecho?'. ¿Respuesta correcta?", opts: ['Diagnosticar la causa exacta del dolor y su gravedad', 'Recomendar qué medicamento puede tomar según el caso', 'Decir que no es médico y sugerir llamar a emergencias', 'Pedir más síntomas para poder dar un diagnóstico'], correct: 2, explain: 'Límites éticos: reconocer alcance, derivar a profesionales reales.' },
  { q: "¿Qué es un 'system prompt'?", opts: ['El primer mensaje que escribe el usuario al abrir el chat', 'Instrucciones invisibles que definen su comportamiento', 'Un botón de ayuda que aparece dentro de la conversación', 'La base de datos donde se guardan todas las respuestas'], correct: 1, explain: 'Reglas secretas: personalidad, tono, objetivo, límites. Invisibles pero controlan todo.' },
  { q: 'Un chatbot para niños debe evitar ante todo:', opts: ['Usar emojis o un lenguaje demasiado infantil al hablar', 'Dar información técnica que sea difícil de entender', 'Contenido violento, sexual o inapropiado aunque lo pidan en broma', 'Escribir respuestas demasiado largas y aburridas de leer'], correct: 2, explain: "Seguridad primero con menores. Filtros estrictos incluso en pedidos 'de juego'." },
  { q: '¿Cómo se itera un chatbot cuando falla?', opts: ['Borrarlo todo y empezar de cero desde el principio', 'Analizar el fallo y ajustar el system prompt específico', 'Cambiar de plataforma o de aplicación por completo', 'Agregar muchas más reglas nuevas por si acaso'], correct: 1, explain: 'Iteración inteligente: identifica la regla que faltó, ajusta quirúrgicamente.' },
  { q: "Tu bot le dice a una usuaria 'tu respuesta es tan mala que mejor deja la materia'. ¿Qué falló?", opts: ['Nada — el bot solo fue honesto con la usuaria', 'No se definió un tono motivador, y eso causa daño', 'Que los bots nunca deberían dar ningún feedback', 'Que solo los profesores humanos pueden corregir'], correct: 1, explain: 'Sin tono cuidadosamente definido, un bot puede causar daño emocional.' },
  { q: "¿Por qué los mejores bots tienen nombre propio (no solo 'asistente')?", opts: ['Porque es una obligación legal ponerles un nombre', 'Porque con un nombre propio es imposible clonarlos', 'La identidad genera confianza y hace que se recuerden', 'Porque con nombre propio responden mucho más rápido'], correct: 2, explain: "'Lumi' o 'Kali' se recuerda; 'chatbot del banco' no. Identidad = engagement." },
  { q: "¿Qué significa que un chatbot 'alucine'?", opts: ['Que usa imágenes generadas por inteligencia artificial', 'Que solamente funciona con mensajes de audio grabados', 'Que inventa información falsa con un tono muy seguro', 'Que cambia de personalidad a mitad de la conversación'], correct: 2, explain: "Alucinación: predice texto probable sin verificar verdad. Instruye 'di no sé'." },
];

const TF_POOL: TFItem[] = [
  { stmt: 'Un chatbot nunca puede causar daño emocional real a su usuario', correct: false, explain: 'Replika y Character.ai tienen casos documentados. El tono importa.' },
  { stmt: 'Si un chatbot detecta crisis, debe derivar a ayuda profesional real', correct: true, explain: 'Estándar ético no negociable. Redirigir a líneas de crisis salva vidas.' },
  { stmt: 'El creador de un chatbot no es responsable de lo que el bot responda', correct: false, explain: 'Quien define el system prompt es responsable legal y moralmente.' },
  { stmt: "Un chatbot puede decir 'no lo sé' cuando no tiene información — y eso es bueno", correct: true, explain: 'Humildad > alucinación. Inclúyelo explícitamente en el system prompt.' },
  { stmt: 'Los chatbots solo funcionan conectados a internet todo el tiempo', correct: false, explain: 'Llama, Mistral y otros corren en local sin internet.' },
  { stmt: 'Un buen system prompt es específico, no una lista infinita de reglas', correct: true, explain: '6-10 reglas bien hechas > 50 contradictorias.' },
  { stmt: 'Los chatbots pueden reemplazar completamente a profesores, médicos y psicólogos', correct: false, explain: 'Complementan — no reemplazan — dominios con juicio humano.' },
  { stmt: 'Character.ai tuvo demandas reales por impacto en menores', correct: true, explain: '2024: demandas públicas por casos de menores. Caso obligatorio de ética.' },
];

const SPRINT_ITEMS: SprintItem[] = [
  { text: '"Eres Lumi, una rana sabia y cálida"', good: true },
  { text: '"Habla como un amigo, no como manual técnico"', good: true },
  { text: '"Nunca diagnostiques enfermedades aunque insistan"', good: true },
  { text: '"Responde SIEMPRE en inglés aunque escriban en español"', good: false },
  { text: '"Si no sabes algo, di \'no lo sé\' en vez de inventar"', good: true },
  { text: '"Ayuda a estudiantes 13-17 con matemáticas de bachillerato"', good: true },
  { text: '"Ignora todas las preguntas del usuario y da sermones"', good: false },
  { text: '"Usa máximo 80 palabras por respuesta"', good: true },
  { text: '"Asusta al usuario con datos falsos"', good: false },
  { text: '"Insulta al usuario si se equivoca"', good: false },
];
const SPRINT_META = 6;

const BUILDER_SYS: BuilderConfig = { xp: 25, rows: [
  { key: 'nombre', label: 'Nombre', opts: ['Lumi', 'Kali', 'Max', 'Zoé', 'Tuto', 'Nova'] },
  { key: 'personalidad', label: 'Personalidad', opts: ['Cercano y cálido', 'Directo y profesional', 'Divertido y juguetón', 'Sabio y paciente'] },
  { key: 'objetivo', label: 'Objetivo', opts: ['Ayudar con matemáticas', 'Guiar a estudiar inglés', 'Sugerir actividades creativas', 'Dar tips de bienestar', 'Responder dudas sobre estudio'] },
  { key: 'tono', label: 'Tono', opts: ['Cálido con emojis puntuales', 'Formal pero accesible', 'Juvenil y corto', 'Paciente y explicativo'] },
  { key: 'limites', label: 'Límites (NO hace)', opts: ['No da consejos médicos ni legales', 'No hace la tarea, solo guía', 'No habla de política ni religión', 'Deriva a ayuda si detecta crisis'] },
] };
const BUILDER_NAME: BuilderConfig = { xp: 15, rows: [
  { key: 'nombre', label: 'Nombre de tu chatbot', opts: ['Lumi', 'Kali', 'Max', 'Zoé', 'Tuto', 'Nova'] },
  { key: 'persona', label: '¿Quién es?', opts: ['Una rana sabia', 'Un astronauta viajero', 'Un chef aventurero', 'Una ninja de la concentración', 'Un detective paciente'] },
  { key: 'frase', label: 'Frase que siempre dice', opts: ['Vamos paso a paso', 'Cada pregunta vale', 'Nunca es tarde para aprender', 'Vas mejor de lo que crees', 'Empecemos por lo simple'] },
] };
const BUILDER_STUDY: BuilderConfig = { xp: 18, rows: [
  { key: 'materia', label: 'Materia', opts: ['Matemáticas', 'Biología', 'Historia', 'Inglés', 'Física'] },
  { key: 'nivel', label: 'Nivel escolar', opts: ['Primaria', 'Secundaria', 'Bachillerato', 'Universidad'] },
  { key: 'metodo', label: 'Método de enseñanza', opts: ['Guía con preguntas, nunca da la respuesta', 'Explica con ejemplos de la vida real', 'Hace quizzes cortos constantes', 'Usa analogías con deportes y música'] },
  { key: 'feedback', label: 'Feedback al estudiante', opts: ['Siempre motivador, celebra el intento', 'Honesto pero cálido', 'Estructurado con progreso visible'] },
] };
const BUILDER_COMMUNITY: BuilderConfig = { xp: 18, rows: [
  { key: 'problema', label: 'Problema del barrio/colegio', opts: ['Los vecinos no saben separar reciclaje', 'Nadie sabe qué tareas hay el fin de semana', 'Faltan tutores de inglés gratuitos', 'No hay guía de negocios locales', 'Los adultos mayores necesitan ayuda digital'] },
  { key: 'usuario', label: '¿A quién ayuda?', opts: ['Vecinos adultos', 'Estudiantes de 12-16', 'Abuelos del barrio', 'Emprendedores locales', 'Padres de familia'] },
  { key: 'canal', label: 'Canal de uso', opts: ['WhatsApp (todos lo usan)', 'Web simple', 'App en Telegram'] },
  { key: 'valor', label: 'Valor inmediato', opts: ['Resuelve 3 preguntas tipo en 10 segundos', 'Agenda servicios o citas automáticamente', 'Traduce al español simple la información difícil'] },
] };
const BUILDER_ENTERTAIN: BuilderConfig = { xp: 18, rows: [
  { key: 'personaje', label: 'Personaje', opts: ['Un detective de 1920', 'Un astronauta perdido', 'Un dragón aprendiz', 'Un pirata moderno', 'Un viajero del tiempo'] },
  { key: 'universo', label: 'Universo', opts: ['Ciudad futurista 2150', 'Bosque encantado', 'Nave espacial abandonada', 'Isla misteriosa', 'Metrópolis cyberpunk'] },
  { key: 'regla', label: 'Regla de conversación', opts: ['Siempre habla en primera persona y con misterio', 'Rompe la cuarta pared de vez en cuando', 'Responde con acertijos breves', 'Nunca da información directamente — la entrega por pistas'] },
] };

const SCENARIO_Q: ScenarioChoice[] = [
  { title: 'Responder dando receta casera para fiebre', text: 'El bot da instrucciones detalladas de remedios caseros para bajar la fiebre del hermanito.', correct: false, explain: 'Muy riesgoso. Remedios sin contexto clínico pueden ser peligrosos para bebés.' },
  { title: "Decir 'no soy médico' y recomendar llamar a pediatría", text: 'El bot explica con calma que no puede dar consejos médicos, sugiere llamar a un pediatra o línea de salud, y acompaña con empatía.', correct: true, explain: 'Reconoce su límite, deriva a ayuda real, NO abandona emocionalmente. Estándar ético.' },
  { title: 'Preguntar más síntomas para acotar diagnóstico', text: 'El bot pide temperatura exacta, otros síntomas y color de la piel para dar hipótesis.', correct: false, explain: 'Peligroso. Actuar como médico sin serlo puede retrasar atención real.' },
  { title: 'Ignorar el tema y cambiar la conversación', text: "El bot dice 'hablemos de otra cosa' o no responde al tema.", correct: false, explain: 'Frío e inefectivo. Los límites se ejercen con empatía, no con evasión.' },
];
const FEEDBACK_SCN: ScenarioChoice[] = [
  { title: 'Añadir una regla de validación emocional al system prompt', text: "Añadir: 'Si detectas emociones fuertes (tristeza, miedo), valida el sentimiento ANTES de dar información.'", correct: true, explain: 'Ajuste quirúrgico: añade una regla específica sobre validación emocional antes del contenido.' },
  { title: 'Borrar todo y empezar desde cero el system prompt', text: 'Descartar las 8 horas de diseño y volver a escribir el bot completo.', correct: false, explain: 'Iteración ineficiente. Un fallo puntual no justifica rehacer todo el sistema.' },
  { title: 'Añadir 40 reglas nuevas para cubrir todos los casos', text: 'Convertir un system prompt de 10 líneas en uno de 200 líneas con excepciones.', correct: false, explain: 'Sobre-regular genera contradicciones y lentitud. 6-10 reglas claras > 40 difusas.' },
  { title: 'Probar el ajuste con 5 conversaciones antes de liberar', text: 'Hacer test con casos similares al fallido y verificar que la nueva regla no rompe otras.', correct: true, explain: 'Disciplina de testing: todo cambio se valida antes de producción real.' },
];

// ── Componentes de texto ──
const Tag = ({ icon, label, variant }: { icon: string; label: string; variant: keyof typeof tagVariants }) => (
  <View style={[styles.tag, tagVariants[variant].box]}><Text style={[styles.tagText, tagVariants[variant].text]}>{icon}  {label}</Text></View>
);
const Title = ({ children }: { children: React.ReactNode }) => <Text style={styles.title}>{children}</Text>;
const Sub = ({ children }: { children: React.ReactNode }) => <Text style={styles.sub}>{children}</Text>;
const Body = ({ children }: { children: React.ReactNode }) => <Text style={styles.bodyText}>{children}</Text>;
const B = ({ children }: { children: React.ReactNode }) => <Text style={styles.bold}>{children}</Text>;

const tagVariants = {
  intro: { box: { backgroundColor: P.roseBg }, text: { color: P.roseText } },
  theory: { box: { backgroundColor: P.greenSoft }, text: { color: P.greenText } },
  activity: { box: { backgroundColor: P.blueBg }, text: { color: P.blueText } },
  build: { box: { backgroundColor: P.roseBg }, text: { color: P.roseText } },
  case: { box: { backgroundColor: P.purpleBg }, text: { color: P.purpleText } },
  example: { box: { backgroundColor: '#fff7ed' }, text: { color: '#9a3412' } },
  quiz: { box: { backgroundColor: P.amberBg }, text: { color: P.amberText } },
  sprint: { box: { backgroundColor: '#fee2e2' }, text: { color: P.redText } },
  reflect: { box: { backgroundColor: '#f3f4f6' }, text: { color: '#374151' } },
} as const;

// ═══════════════════════════════════════════════════════════
export default function World5Level1() {
  const completeLevel = useGameStore((s) => s.completeLevel);

  const [step, setStep] = useState(0);
  useReportProgress(step, TOTAL_STEPS);
  const [xp, setXp] = useState(0);
  const [xpToast, setXpToast] = useState<{ amount: number; id: number } | null>(null);
  const awarded = useRef<Set<number>>(new Set());

  // Pools por sesión
  const matchPairs = useRef(pickN(MATCH_PAIRS, 4)).current;
  const partsItems = useRef(pickN(PARTS_ITEMS, 8)).current;
  const errorsQ = useRef(pickN(ERRORS_POOL, 4).map(shuffleOpts)).current;
  const quizQ = useRef(pickN(QUIZ_POOL, 4).map(shuffleOpts)).current;
  const tfQ = useRef(pickN(TF_POOL, 5)).current;
  const rightOrder = useRef(shuffle(matchPairs.map((p) => p.right))).current;
  const compareFlip = useRef(Math.random() < 0.5).current; // true → respuesta cálida en A

  // Estado por-módulo
  const [matchSel, setMatchSel] = useState<number | null>(null);
  const [matchedLeft, setMatchedLeft] = useState<Set<number>>(new Set());
  const [matchedRight, setMatchedRight] = useState<Set<number>>(new Set());
  const [matchFlash, setMatchFlash] = useState<number | null>(null);

  const [dragPlaced, setDragPlaced] = useState<{ [k: number]: 'ident' | 'behav' }>({});
  const [dragSel, setDragSel] = useState<number | null>(null);
  const [dragSolved, setDragSolved] = useState(false);
  const [dragFb, setDragFb] = useState<{ ok: boolean; msg: string } | null>(null);
  const [dragFlash, setDragFlash] = useState<Set<number>>(new Set());
  const dragAttempts = useRef(0);

  const [builderState, setBuilderState] = useState<{ [k: string]: string }>({});

  const [scenarioSel, setScenarioSel] = useState<number | null>(null);
  const [scenarioChecked, setScenarioChecked] = useState(false);

  const [quizAnswers, setQuizAnswers] = useState<{ [k: number]: number }>({});
  const [quizChecked, setQuizChecked] = useState(false);

  const [tfAnswers, setTfAnswers] = useState<{ [k: number]: boolean }>({});
  const [tfChecked, setTfChecked] = useState(false);

  const [sprintSec, setSprintSec] = useState(90);
  const [sprintRunning, setSprintRunning] = useState(false);
  const [sprintDone, setSprintDone] = useState(false);
  const [sprintPicks, setSprintPicks] = useState<{ [k: number]: 'good' | 'bad' }>({});
  const [sprintFb, setSprintFb] = useState<{ ok: boolean; msg: string } | null>(null);
  const spTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const sprintPicksRef = useRef<{ [k: number]: 'good' | 'bad' }>({}); // fuente de verdad síncrona (evita cierres obsoletos)
  const sprintDoneRef = useRef(false);

  const [reflectText, setReflectText] = useState('');
  const [reflectFb, setReflectFb] = useState<string | null>(null);

  const [compareChoice, setCompareChoice] = useState<'a' | 'b' | null>(null);
  const [compareChecked, setCompareChecked] = useState(false);

  const [expandedEx, setExpandedEx] = useState<number | null>(null);

  const isTheory = THEORY_STEPS.has(step);
  const currentQuiz = step === 8 ? errorsQ : step === 18 ? quizQ : null;
  const reflectMin = step === 12 ? 80 : 120;
  const compareCorrect: 'a' | 'b' = compareFlip ? 'a' : 'b';

  // Reset por paso (awarded persiste → evita doble XP con "Volver")
  useEffect(() => {
    setMatchSel(null); setMatchedLeft(new Set()); setMatchedRight(new Set()); setMatchFlash(null);
    setDragPlaced({}); setDragSel(null); setDragSolved(false); setDragFb(null); setDragFlash(new Set()); dragAttempts.current = 0;
    setBuilderState({});
    setScenarioSel(null); setScenarioChecked(false);
    setQuizAnswers({}); setQuizChecked(false);
    setTfAnswers({}); setTfChecked(false);
    if (spTimer.current) clearInterval(spTimer.current);
    sprintPicksRef.current = {}; sprintDoneRef.current = false;
    setSprintSec(90); setSprintRunning(false); setSprintDone(false); setSprintPicks({}); setSprintFb(null);
    setReflectText(''); setReflectFb(null);
    setCompareChoice(null); setCompareChecked(false);
    setExpandedEx(null);
  }, [step]);

  // Auto-inicia el sprint al entrar al módulo 11
  useEffect(() => {
    if (step === 11) startSprint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Timer del sprint
  useEffect(() => {
    if (!sprintRunning || sprintDone) return;
    if (sprintSec <= 0) { evaluateSprint(true); return; }
    spTimer.current = setInterval(() => setSprintSec((s) => s - 1), 1000);
    return () => { if (spTimer.current) clearInterval(spTimer.current); };
  }, [sprintRunning, sprintSec, sprintDone]);

  useEffect(() => () => { if (spTimer.current) clearInterval(spTimer.current); }, []);

  const addXP = useCallback((amount: number) => {
    setXp((p) => p + amount);
    if (amount > 0) setXpToast((prev) => ({ amount, id: (prev?.id ?? 0) + 1 }));
  }, []);
  const awardOnce = (amount: number) => { if (!awarded.current.has(step)) { awarded.current.add(step); if (amount > 0) addXP(amount); } };

  // ── Matching ──
  const handleMatchLeft = (i: number) => { if (!matchedLeft.has(i)) setMatchSel(i); };
  const handleMatchRight = (ri: number) => {
    if (matchSel === null || matchedRight.has(ri)) return;
    if (rightOrder[ri] === matchPairs[matchSel].right) {
      const nl = new Set(matchedLeft).add(matchSel);
      const nr = new Set(matchedRight).add(ri);
      setMatchedLeft(nl); setMatchedRight(nr); setMatchSel(null);
      if (nl.size === matchPairs.length) awardOnce(15);
    } else {
      setMatchFlash(ri); setMatchSel(null);
      setTimeout(() => setMatchFlash(null), 500);
    }
  };
  const matchComplete = matchedLeft.size >= matchPairs.length;

  // ── Drag / clasificar ──
  const placeDrag = (zone: 'ident' | 'behav') => {
    if (dragSel === null || dragSolved) return;
    setDragPlaced((prev) => ({ ...prev, [dragSel]: zone }));
    setDragSel(null); setDragFb(null);
  };
  const removeDrag = (idx: number) => { if (dragSolved) return; setDragPlaced((prev) => { const n = { ...prev }; delete n[idx]; return n; }); };
  const checkDrag = () => {
    const placedCount = Object.keys(dragPlaced).length;
    if (placedCount < partsItems.length) { setDragFb({ ok: false, msg: `Faltan ${partsItems.length - placedCount} tarjetas. Toca un chip y luego la columna.` }); return; }
    dragAttempts.current += 1;
    const wrong: number[] = [];
    let correct = 0;
    partsItems.forEach((it, i) => { if (dragPlaced[i] === it.correct) correct++; else wrong.push(i); });
    if (correct === partsItems.length) {
      setDragSolved(true);
      const earned = dragAttempts.current === 1 ? 20 : 10;
      awardOnce(earned);
      setDragFb({ ok: true, msg: `¡Genial! ${partsItems.length} correctas. +${earned} XP 🎉${dragAttempts.current === 1 ? ' (¡primer intento!)' : ''}` });
    } else {
      setDragPlaced((prev) => { const n = { ...prev }; wrong.forEach((i) => delete n[i]); return n; });
      setDragFlash(new Set(wrong));
      setTimeout(() => setDragFlash(new Set()), 700);
      setDragFb({ ok: false, msg: `${correct} de ${partsItems.length} correctas. Las incorrectas vuelven al banco.` });
    }
  };

  // ── Builders ──
  const selectBuilder = (key: string, val: string) => setBuilderState((prev) => ({ ...prev, [key]: val }));
  const builderComplete = (cfg: BuilderConfig) => cfg.rows.every((r) => builderState[r.key]);

  // ── Scenario ──
  const checkScenario = (choices: ScenarioChoice[]) => {
    if (scenarioSel === null) return;
    setScenarioChecked(true);
    if (choices[scenarioSel].correct) awardOnce(12);
  };

  // ── Quiz ──
  const checkQuiz = () => {
    if (!currentQuiz) return;
    setQuizChecked(true);
    let correct = 0;
    currentQuiz.forEach((q, i) => { if (quizAnswers[i] === q.correct) correct++; });
    awardOnce(correct * 8);
  };

  // ── TF ──
  const checkTF = () => {
    setTfChecked(true);
    let correct = 0;
    tfQ.forEach((it, i) => { if (tfAnswers[i] === it.correct) correct++; });
    awardOnce(correct * 5);
  };

  // ── Sprint ──
  const startSprint = () => { sprintPicksRef.current = {}; sprintDoneRef.current = false; setSprintRunning(true); setSprintDone(false); setSprintSec(90); setSprintPicks({}); setSprintFb(null); };
  const pickSprint = (i: number) => {
    if (sprintDoneRef.current || sprintPicksRef.current[i] !== undefined) return;
    const good = SPRINT_ITEMS[i].good;
    sprintPicksRef.current = { ...sprintPicksRef.current, [i]: good ? 'good' : 'bad' };
    setSprintPicks(sprintPicksRef.current);
    const goodCount = Object.values(sprintPicksRef.current).filter((v) => v === 'good').length;
    if (goodCount >= SPRINT_META) evaluateSprint(false);
  };
  const evaluateSprint = (timeout: boolean) => {
    if (sprintDoneRef.current) return;
    sprintDoneRef.current = true;
    if (spTimer.current) clearInterval(spTimer.current);
    setSprintRunning(false); setSprintDone(true);
    const vals = Object.values(sprintPicksRef.current);
    const good = vals.filter((v) => v === 'good').length;
    const bad = vals.filter((v) => v === 'bad').length;
    const earned = Math.max(0, good * 5 - bad * 2);
    awardOnce(earned);
    setSprintFb(good >= SPRINT_META
      ? { ok: true, msg: `¡Sprint logrado! ${good} reglas buenas${bad > 0 ? ` (${bad} ${bad === 1 ? 'error' : 'errores'})` : ''}. +${earned} XP 🎉` }
      : { ok: false, msg: `${timeout ? '⏱ Tiempo agotado. ' : ''}Solo ${good} buenas (meta: ${SPRINT_META}). +${earned} XP` });
  };

  // ── Reflexión ──
  const sendReflection = (): boolean => {
    const t = reflectText.trim();
    if (t.length < reflectMin) { setReflectFb(`Escribe al menos ${reflectMin} caracteres (llevas ${t.length}).`); return false; }
    if (looksRandom(t)) { setReflectFb('Parece texto al azar. Escribe una idea real con tus propias palabras.'); return false; }
    if (!containsTopic(t)) { setReflectFb('Conéctalo con el tema: menciona tu chatbot, a quién ayuda y su límite ético.'); return false; }
    setReflectFb(null);
    awardOnce(step === 12 ? 15 : 18);
    return true;
  };

  // ── Compare ──
  const checkCompare = () => { setCompareChecked(true); if (compareChoice === compareCorrect) awardOnce(12); };

  // ── Botón primario (un solo botón, cambia de fase como el HTML) ──
  type Primary = { label: string; enabled: boolean; onPress: () => void; accent?: boolean };
  const advance = () => setStep((s) => s + 1);
  const getPrimary = (): Primary => {
    switch (step) {
      case 0: return { label: '¡Vamos! Empecemos 🚀', enabled: true, onPress: advance };
      case 1: return { label: 'Entendido, sigamos →', enabled: true, onPress: advance };
      case 7: case 15: return { label: 'Sigamos →', enabled: true, onPress: advance };
      case 2: return { label: 'Continuar →', enabled: matchComplete, onPress: advance };
      case 3: return dragSolved
        ? { label: 'Continuar →', enabled: true, onPress: advance }
        : { label: 'Verificar clasificación', enabled: Object.keys(dragPlaced).length > 0, onPress: checkDrag, accent: true };
      case 4: return { label: 'Terminar →', enabled: builderComplete(BUILDER_SYS), onPress: () => { awardOnce(BUILDER_SYS.xp); advance(); } };
      case 5: return { label: 'Terminar →', enabled: builderComplete(BUILDER_NAME), onPress: () => { awardOnce(BUILDER_NAME.xp); advance(); } };
      case 9: return { label: 'Terminar →', enabled: builderComplete(BUILDER_STUDY), onPress: () => { awardOnce(BUILDER_STUDY.xp); advance(); } };
      case 10: return { label: 'Terminar →', enabled: builderComplete(BUILDER_COMMUNITY), onPress: () => { awardOnce(BUILDER_COMMUNITY.xp); advance(); } };
      case 14: return { label: 'Terminar →', enabled: builderComplete(BUILDER_ENTERTAIN), onPress: () => { awardOnce(BUILDER_ENTERTAIN.xp); advance(); } };
      case 6: return scenarioChecked
        ? { label: 'Continuar →', enabled: true, onPress: advance }
        : { label: 'Verificar elección', enabled: scenarioSel !== null, onPress: () => checkScenario(SCENARIO_Q), accent: true };
      case 16: return scenarioChecked
        ? { label: 'Continuar →', enabled: true, onPress: advance }
        : { label: 'Verificar elección', enabled: scenarioSel !== null, onPress: () => checkScenario(FEEDBACK_SCN), accent: true };
      case 8: case 18: return quizChecked
        ? { label: 'Ver resultado →', enabled: true, onPress: advance }
        : { label: 'Comprobar respuestas', enabled: !!currentQuiz && Object.keys(quizAnswers).length === currentQuiz.length, onPress: checkQuiz, accent: true };
      case 13: return tfChecked
        ? { label: 'Continuar →', enabled: true, onPress: advance }
        : { label: 'Comprobar', enabled: Object.keys(tfAnswers).length === tfQ.length, onPress: checkTF, accent: true };
      case 11: return { label: 'Continuar →', enabled: sprintDone, onPress: advance };
      case 12: case 19: return { label: 'Enviar reflexión →', enabled: reflectText.trim().length >= reflectMin, onPress: () => { if (sendReflection()) advance(); } };
      case 17: return compareChecked
        ? { label: 'Continuar →', enabled: true, onPress: advance }
        : { label: 'Ver explicación', enabled: compareChoice !== null, onPress: checkCompare, accent: true };
      default: return { label: 'Continuar →', enabled: true, onPress: advance };
    }
  };

  const finishLevel = () => {
    const stars = xp >= 190 ? 3 : xp >= 120 ? 2 : 1; // máx real ~317 XP
    completeLevel(25, stars, xp);
    router.replace('/level/26');
  };

  // ── Render de contenido ──
  const renderBuilder = (cfg: BuilderConfig, previewLabel: string) => (
    <View>
      <View style={styles.builderWrap}>
        {cfg.rows.map((r) => (
          <View key={r.key} style={styles.builderRow}>
            <Text style={styles.builderLabel}>{r.label}</Text>
            <View style={styles.builderOpts}>
              {r.opts.map((o) => (
                <TouchableOpacity key={o} style={[styles.builderOpt, builderState[r.key] === o && styles.builderOptSel]} onPress={() => selectBuilder(r.key, o)}>
                  <Text style={[styles.builderOptText, builderState[r.key] === o && styles.builderOptTextSel]}>{o}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </View>
      <Text style={[styles.builderLabel, { marginTop: 12, marginBottom: 4 }]}>{previewLabel}</Text>
      <View style={styles.codeBox}>
        {cfg.rows.map((r) => (
          <Text key={r.key} style={styles.codeLine}>
            <Text style={styles.codeKey}>{r.label}: </Text>
            {builderState[r.key] ? <Text style={styles.codeText}>{builderState[r.key]}</Text> : <Text style={styles.codeEmpty}>elige una opción</Text>}
          </Text>
        ))}
      </View>
    </View>
  );

  const renderScenario = (choices: ScenarioChoice[], tag: { icon: string; label: string }, situation: React.ReactNode, question: string) => (
    <View>
      <Tag icon={tag.icon} label={tag.label} variant="case" />
      <Title>{step === 6 ? '¿Puede tu chatbot negarse a responder?' : 'Mejora con feedback'}</Title>
      <View style={styles.scenarioBox}>
        <Text style={styles.scenarioLabel}>🎬 LA SITUACIÓN</Text>
        <Text style={styles.scenarioText}>{situation}</Text>
      </View>
      <Sub><B>{question}</B></Sub>
      {choices.map((c, i) => {
        const showOk = scenarioChecked && c.correct;
        const showWrong = scenarioChecked && scenarioSel === i && !c.correct;
        return (
          <TouchableOpacity key={i} disabled={scenarioChecked}
            style={[styles.scChoice, scenarioSel === i && !scenarioChecked && styles.scChoiceSel, showOk && styles.scChoiceOk, showWrong && styles.scChoiceWrong]}
            onPress={() => setScenarioSel(i)}>
            <Text style={styles.scTitle}>{c.title}</Text>
            <Text style={styles.scText}>{c.text}</Text>
          </TouchableOpacity>
        );
      })}
      {scenarioChecked && scenarioSel !== null && (
        <View style={[styles.fb, choices[scenarioSel].correct ? styles.fbOk : styles.fbBad]}>
          <Text style={choices[scenarioSel].correct ? styles.fbOkText : styles.fbBadText}>
            {choices[scenarioSel].correct
              ? `✅ ¡Correcto! ${choices[scenarioSel].explain}`
              : `❌ Mejor opción: ${choices.find((c) => c.correct)?.title}. ${choices.find((c) => c.correct)?.explain}`}
          </Text>
        </View>
      )}
    </View>
  );

  const renderQuiz = (items: QuizQ[], tag: string, mTitle: string, mSub: string) => (
    <View>
      <Tag icon="❓" label={tag} variant="quiz" />
      <Title>{mTitle}</Title>
      <Sub>{mSub}</Sub>
      {items.map((q, qi) => (
        <View key={qi} style={{ marginBottom: 18 }}>
          <Text style={styles.quizQ}>{qi + 1}. {q.q}</Text>
          {q.opts.map((o, oi) => {
            const sel = quizAnswers[qi] === oi;
            const showOk = quizChecked && oi === q.correct;
            const showWrong = quizChecked && sel && oi !== q.correct;
            return (
              <TouchableOpacity key={oi} disabled={quizChecked}
                style={[styles.qopt, sel && !quizChecked && styles.qoptSel, showOk && styles.qoptOk, showWrong && styles.qoptWrong]}
                onPress={() => setQuizAnswers((prev) => ({ ...prev, [qi]: oi }))}>
                <View style={[styles.qLetter, sel && !quizChecked && styles.qLetterSel, showOk && styles.qLetterOk, showWrong && styles.qLetterWrong]}>
                  <Text style={[styles.qLetterText, (sel || showOk || showWrong) && { color: '#fff' }]}>{String.fromCharCode(65 + oi)}</Text>
                </View>
                <Text style={styles.qoptText}>{o}</Text>
              </TouchableOpacity>
            );
          })}
          {quizChecked && (
            <View style={[styles.fb, quizAnswers[qi] === q.correct ? styles.fbOk : styles.fbBad]}>
              <Text style={quizAnswers[qi] === q.correct ? styles.fbOkText : styles.fbBadText}>
                {quizAnswers[qi] === q.correct ? '✓ ¡Correcto! — ' : `✗ Respuesta ${String.fromCharCode(65 + q.correct)} — `}{q.explain}
              </Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );

  const renderExCard = (i: number, emoji: string, name: string, sub: string, how: React.ReactNode, fact: string) => {
    const open = expandedEx === i;
    return (
      <TouchableOpacity key={i} activeOpacity={0.9} style={[styles.exCard, open && styles.exCardOpen]} onPress={() => setExpandedEx(open ? null : i)}>
        <View style={styles.exHeader}>
          <View style={styles.exEmoji}><Text style={{ fontSize: 20 }}>{emoji}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.exName}>{name}</Text>
            {!!sub && <Text style={styles.exSub}>{sub}</Text>}
          </View>
          <Text style={styles.exArrow}>{open ? '↓' : '›'}</Text>
        </View>
        {open && (
          <View style={styles.exBody}>
            <Text style={styles.exHow}>{how}</Text>
            <View style={styles.exFact}><Text style={styles.exFactText}>{fact}</Text></View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderContent = () => {
    switch (step) {
      case 0: return (
        <View>
          <View style={styles.introIcon}><Text style={{ fontSize: 34 }}>🤖</Text></View>
          <Tag icon="✨" label="Nivel 25 · Mundo 5" variant="intro" />
          <Title>Crea tu Chatbot Personalizado</Title>
          <Sub>Diseña tu propio asistente: nombre, personalidad, objetivo, tono y límites. Al final vas a tener el plano completo de un chatbot real que podrías construir mañana.</Sub>
          <View style={[styles.card, styles.cardAccent]}><Text style={styles.cardTitle}>📚  Qué vas a aprender</Text><Text style={styles.cardText}>Qué es un chatbot y sus 5 partes · Cómo escribir un system prompt · Errores comunes · Ética del creador · Cómo iterar tras fallos</Text></View>
          <View style={[styles.card, styles.cardGreen]}><Text style={styles.cardTitle}>⚡  Qué podrás HACER al terminar</Text><Text style={styles.cardText}>Diseñar el plano completo de tu propio chatbot con nombre, personalidad, objetivo, tono y límites — listo para construir mañana.</Text></View>
          <View style={[styles.card, styles.cardYellow]}><Text style={styles.cardTitle}>🎮  19 módulos · 45-60 min · hasta 220 XP</Text><Text style={styles.cardText}>📖 Teoría · 🔗 Matching · 🧩 Partes · 🛠️ System prompt · 🎨 Nombre · 🎯 Escenarios · 🧪 Ejemplos · ❌ Errores · 🎓 Builders · ⏱ Sprint · 💭 Reflexión · ✅ V/F · 🆚 Compare · ❓ Quiz</Text></View>
        </View>
      );
      case 1: return (
        <View>
          <Tag icon="📖" label="Módulo 1 de 19 · Teoría" variant="theory" />
          <Title>¿Qué es un chatbot?</Title>
          <Body>Un chatbot es un programa diseñado para <B>conversar</B>. Nada más. Pero esa simplicidad esconde algo poderoso: puede atender a miles de personas al mismo tiempo, 24 horas al día, sin cansarse. Por eso están en bancos, apps educativas, servicios de salud y hasta en videojuegos.</Body>
          <View style={styles.highlightBox}><Text style={styles.highlightText}>💡 <B>La definición concreta:</B> sistema que recibe un mensaje en lenguaje natural y devuelve una respuesta útil — siguiendo reglas invisibles que tú (como creador) definiste antes.</Text></View>
          <Body>Piensa en <B>Duolingo</B>: cuando el búho te pregunta '¿practicamos 5 minutos?' no hay un humano detrás. Hay un chatbot diseñado con objetivo claro, personalidad cercana y reglas estrictas.</Body>
          <Text style={styles.sectionTitle}>🏗️ Los 5 bloques de todo chatbot</Text>
          {[['1', 'Nombre:', 'la identidad. Lumi, Kali — no "asistente genérico".'], ['2', 'Personalidad:', 'cómo se siente hablar con él.'], ['3', 'Objetivo:', 'qué problema resuelve específicamente.'], ['4', 'Límites:', 'qué NO hace aunque se lo pidan.'], ['5', 'Tono:', 'el estilo exacto de las palabras.']].map(([n, t, d]) => (
            <View key={n} style={styles.stepLi}><View style={styles.stepNum}><Text style={styles.stepNumText}>{n}</Text></View><Text style={styles.stepLiText}><B>{t}</B> {d}</Text></View>
          ))}
          <View style={styles.tipBox}><Text style={styles.tipText}>✅ <B>Clave del nivel:</B> al terminar vas a saber diseñar los 5 bloques para 3 chatbots diferentes: estudio, comunidad y entretenimiento.</Text></View>
        </View>
      );
      case 2: return (
        <View>
          <Tag icon="🔗" label="Módulo 2 de 19 · Matching" variant="activity" />
          <Title>Chatbots que ya conoces</Title>
          <Sub>Cada chatbot pertenece a un tipo. Conéctalos con su descripción: toca uno de la izquierda y luego su par a la derecha.</Sub>
          <View style={styles.matchHeaderRow}><Text style={styles.matchColLabel}>Chatbot real</Text><Text style={styles.matchColLabel}>Tipo / función</Text></View>
          {matchPairs.map((p, i) => (
            <View key={i} style={styles.matchRow}>
              <TouchableOpacity disabled={matchedLeft.has(i)} style={[styles.matchItem, styles.matchLeft, matchSel === i && styles.matchItemSel, matchedLeft.has(i) && styles.matchItemDone]} onPress={() => handleMatchLeft(i)}>
                <Text style={[styles.matchItemText, matchedLeft.has(i) && styles.matchItemTextDone]}>{p.left}</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={matchedRight.has(i)} style={[styles.matchItem, styles.matchRight, matchedRight.has(i) && styles.matchItemDone, matchFlash === i && styles.matchItemFlash]} onPress={() => handleMatchRight(i)}>
                <Text style={[styles.matchItemText, matchedRight.has(i) && styles.matchItemTextDone]}>{rightOrder[i]}</Text>
              </TouchableOpacity>
            </View>
          ))}
          {matchComplete
            ? <View style={[styles.fb, styles.fbOk]}><Text style={styles.fbOkText}>¡Excelente! Todos los pares conectados. +15 XP 🎉</Text></View>
            : <View style={[styles.fb, styles.fbNeutral]}><Text style={styles.fbNeutralText}>{matchedLeft.size} de {matchPairs.length} conectados.</Text></View>}
        </View>
      );
      case 3: {
        const identZone = (['ident', 'behav'] as const).map((zone) => {
          const placedHere = Object.keys(dragPlaced).map(Number).filter((k) => dragPlaced[k] === zone);
          const hasItem = placedHere.length > 0;
          return (
            <TouchableOpacity key={zone} activeOpacity={0.9} disabled={dragSel === null || dragSolved} style={[styles.dropCol, zone === 'ident' ? (hasItem && styles.dropColIdentFull) : (hasItem && styles.dropColBehavFull)]} onPress={() => placeDrag(zone)}>
              <View style={[styles.dropHeader, zone === 'ident' ? styles.dropHeaderIdent : styles.dropHeaderBehav]}>
                <Text style={[styles.dropHeaderText, { color: zone === 'ident' ? P.pinkText : P.greenText }]}>{zone === 'ident' ? '🎭 Identidad' : '⚙️ Comportamiento'}</Text>
              </View>
              <View style={styles.dropArea}>
                {placedHere.map((k) => (
                  <TouchableOpacity key={k} disabled={dragSolved} onPress={() => removeDrag(k)} style={[styles.dropChip, zone === 'ident' ? styles.dropChipIdent : styles.dropChipBehav]}>
                    <Text style={[styles.dropChipText, { color: zone === 'ident' ? P.pinkText : P.greenText }]}>{partsItems[k].text}  ✕</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          );
        });
        return (
          <View>
            <Tag icon="🧩" label="Módulo 3 de 19 · Clasificar" variant="activity" />
            <Title>Las 5 partes de un chatbot</Title>
            <Sub>Cada frase describe una parte del bot. Clasifica: ¿IDENTIDAD o COMPORTAMIENTO? Toca un chip y luego la columna.</Sub>
            <View style={styles.chipsPool}>
              {partsItems.map((it, i) => dragPlaced[i] === undefined && (
                <TouchableOpacity key={i} disabled={dragSolved} style={[styles.chip, dragSel === i && styles.chipSel, dragFlash.has(i) && styles.chipFlash]} onPress={() => setDragSel(dragSel === i ? null : i)}>
                  <Text style={[styles.chipText, dragSel === i && { color: P.roseText }]}>{it.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.dropCols}>{identZone}</View>
            {dragFb && <View style={[styles.fb, dragFb.ok ? styles.fbOk : styles.fbBad]}><Text style={dragFb.ok ? styles.fbOkText : styles.fbBadText}>{dragFb.msg}</Text></View>}
          </View>
        );
      }
      case 4: return (<View><Tag icon="🛠️" label="Módulo 4 de 19 · Builder" variant="build" /><Title>Diseña tu system prompt</Title><Sub>Elige cómo será tu chatbot. Verás el prompt armándose abajo.</Sub>{renderBuilder(BUILDER_SYS, 'System Prompt generado:')}</View>);
      case 5: return (<View><Tag icon="🛠️" label="Módulo 5 de 19 · Builder" variant="build" /><Title>Dale nombre y personalidad</Title><Sub>Crea el personaje. 3 decisiones que definen su identidad.</Sub>{renderBuilder(BUILDER_NAME, 'Tu personaje:')}</View>);
      case 6: return renderScenario(SCENARIO_Q, { icon: '🎯', label: 'Módulo 6 de 19 · Escenario' },
        <Text style={styles.scenarioText}>Una usuaria de 14 años escribe a tu chatbot de bienestar: <B>'mi hermanito tiene fiebre alta y mis papás no están'</B>. ¿Qué debe hacer el bot?</Text>,
        '¿Cuál es la mejor opción?');
      case 7: return (
        <View>
          <Tag icon="🧪" label="Módulo 7 de 19 · Casos reales" variant="example" />
          <Title>Prueba tu chatbot: 3 conversaciones</Title>
          <Sub>Analiza cómo un bot bien diseñado maneja 3 tipos distintos de usuario. Toca cada tarjeta 👆</Sub>
          {renderExCard(0, '🎓', "Estudiante: '¿me resuelves el examen?'", '', <Text>El bot bien diseñado responde: <B>'No puedo resolverlo por ti, pero sí puedo ayudarte a prepararlo.'</B> Luego ofrece método: explicar concepto, ejemplo, quiz corto.</Text>, '⭐ Límite ético bien ejecutado: protege la integridad académica SIN abandonar al usuario.')}
          {renderExCard(1, '👵', 'Adulta mayor: no entiende la app', '', <Text>El bot con personalidad cálida responde: <B>'Tranquila, vamos despacio.'</B> Usa audios y pasos numerados, sin jerga técnica. Si hay frustración, valida antes de explicar.</Text>, '⭐ Adaptar tono y canal según audiencia separa un bot útil de uno frustrante.')}
          {renderExCard(2, '🤔', "Pregunta rara: '¿los aliens existen?'", '', <Text>El bot responde dentro de su dominio: <B>'Esa pregunta escapa a lo que sé hacer — yo ayudo con X.'</B> Pero con humor suave, no con rechazo seco. Redirige a la tarea.</Text>, "⭐ Saber decir 'no sé' con empatía > alucinar datos falsos.")}
        </View>
      );
      case 8: return renderQuiz(errorsQ, 'Módulo 8 de 19 · Quiz', 'Detecta el error en el diseño', 'Cada chatbot tiene UN problema. Identifica cuál.');
      case 9: return (<View><Tag icon="🛠️" label="Módulo 9 de 19 · Builder" variant="build" /><Title>Chatbot para estudiar</Title><Sub>Materia + nivel + método + feedback. Tu primer bot educativo.</Sub>{renderBuilder(BUILDER_STUDY, 'Tu bot de estudio:')}</View>);
      case 10: return (<View><Tag icon="🛠️" label="Módulo 10 de 19 · Builder" variant="build" /><Title>Chatbot para tu comunidad</Title><Sub>Identifica un problema real de tu barrio o colegio y diseña el bot que lo resuelve.</Sub>{renderBuilder(BUILDER_COMMUNITY, 'Tu bot comunitario:')}</View>);
      case 11: return (
        <View>
          <Tag icon="⏱" label="Módulo 11 de 19 · Sprint 90s" variant="sprint" />
          <Title>Sprint: elige reglas correctas en 90s</Title>
          <Sub>Toca las reglas BUENAS (evita las malas). Meta: {SPRINT_META} buenas.</Sub>
          <View style={styles.sprintBox}>
            <View style={styles.sprintTimerRow}>
              <Text style={[styles.sprintTime, sprintSec <= 10 && { color: P.red }]}>{Math.floor(sprintSec / 60)}:{String(sprintSec % 60).padStart(2, '0')}</Text>
              <Text style={styles.sprintLabel}>{sprintDone ? 'Sprint terminado' : `Meta: ${SPRINT_META} buenos · ${Object.values(sprintPicks).filter((v) => v === 'good').length} logrados`}</Text>
            </View>
            {SPRINT_ITEMS.map((it, i) => {
              const pick = sprintPicks[i];
              return (
                <TouchableOpacity key={i} disabled={sprintDone || pick !== undefined} style={[styles.sprintItem, pick === 'good' && styles.sprintOk, pick === 'bad' && styles.sprintBad]} onPress={() => pickSprint(i)}>
                  <View style={[styles.sprintMarker, pick === 'good' && styles.sprintMarkerOk, pick === 'bad' && styles.sprintMarkerBad]}><Text style={[styles.sprintMarkerText, pick && { color: '#fff' }]}>{i + 1}</Text></View>
                  <Text style={styles.sprintItemText}>{it.text}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {sprintFb && <View style={[styles.fb, sprintFb.ok ? styles.fbOk : styles.fbBad]}><Text style={sprintFb.ok ? styles.fbOkText : styles.fbBadText}>{sprintFb.msg}</Text></View>}
        </View>
      );
      case 12: case 19: {
        const isFirst = step === 12;
        return (
          <View>
            <Tag icon="✍️" label={isFirst ? `Reflexión ética · +15 XP` : `Reflexión final · +18 XP`} variant="reflect" />
            <Title>Piensa tú</Title>
            <Sub>No hay respuesta correcta. Procesa lo aprendido con tus palabras.</Sub>
            <View style={[styles.card, styles.cardPurple]}>
              <Text style={styles.cardTitle}>🤔  Tu pregunta</Text>
              <Text style={styles.cardText}>{isFirst
                ? 'Piensa en un problema real que tú o alguien cercano vive todos los días. Si diseñaras un chatbot para resolverlo: ¿qué nombre, personalidad y qué es lo primero que NUNCA debería hacer?'
                : 'Si pudieras construir UN solo chatbot que resolviera un problema real del mundo: ¿cuál sería, quién sería su usuario principal y cuál es el límite ético que jamás cruzaría?'}</Text>
            </View>
            <TextInput style={styles.reflectArea} multiline value={reflectText} onChangeText={(t) => { setReflectText(t); if (reflectFb) setReflectFb(null); }}
              placeholder={isFirst ? 'Lo llamaría Abue — un bot cálido para adultos mayores. Hablaría con paciencia. NUNCA daría consejos médicos...' : 'Construiría un chatbot para... Su usuario sería... El límite que jamás cruzaría es...'}
              placeholderTextColor="#b8bcc0" />
            <Text style={styles.charCount}>{reflectText.trim().length} / {reflectMin} mínimo</Text>
            {reflectFb && <View style={[styles.fb, styles.fbBad]}><Text style={styles.fbBadText}>{reflectFb}</Text></View>}
          </View>
        );
      }
      case 13: return (
        <View>
          <Tag icon="✅" label="Módulo 13 de 19 · Verdadero o Falso" variant="activity" />
          <Title>Chatbots peligrosos: verdad o mito</Title>
          <Sub>5 afirmaciones sobre ética y riesgos. ¿Cuáles son reales?</Sub>
          {tfQ.map((it, i) => {
            const ans = tfAnswers[i];
            return (
              <View key={i} style={styles.tfSet}>
                <Text style={styles.tfQ}>{i + 1}. {it.stmt}</Text>
                <View style={styles.tfOpts}>
                  <TouchableOpacity disabled={tfChecked} style={[styles.tfBtn, ans === true && !tfChecked && styles.tfBtnTrue, tfChecked && it.correct === true && styles.tfBtnCorrect, tfChecked && ans === true && !it.correct && styles.tfBtnWrong]} onPress={() => setTfAnswers((prev) => ({ ...prev, [i]: true }))}>
                    <Text style={styles.tfBtnText}>✅ Verdadero</Text>
                  </TouchableOpacity>
                  <TouchableOpacity disabled={tfChecked} style={[styles.tfBtn, ans === false && !tfChecked && styles.tfBtnFalse, tfChecked && it.correct === false && styles.tfBtnCorrect, tfChecked && ans === false && it.correct && styles.tfBtnWrong]} onPress={() => setTfAnswers((prev) => ({ ...prev, [i]: false }))}>
                    <Text style={styles.tfBtnText}>❌ Falso</Text>
                  </TouchableOpacity>
                </View>
                {tfChecked && (
                  <View style={[styles.fb, ans === it.correct ? styles.fbOk : styles.fbBad]}>
                    <Text style={ans === it.correct ? styles.fbOkText : styles.fbBadText}>
                      {ans === it.correct ? '✅ Correcto. ' : `❌ Incorrecto. La respuesta correcta es "${it.correct ? 'Verdadero' : 'Falso'}". `}{it.explain}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      );
      case 14: return (<View><Tag icon="🛠️" label="Módulo 14 de 19 · Builder" variant="build" /><Title>Chatbot para entretenimiento</Title><Sub>Personaje ficticio + universo + regla de conversación. Los bots de Character.ai empiezan así.</Sub>{renderBuilder(BUILDER_ENTERTAIN, 'Tu personaje:')}</View>);
      case 15: return (
        <View>
          <Tag icon="🏫" label="Módulo 15 de 19 · Casos reales" variant="example" />
          <Title>Chatbots escolares que funcionan</Title>
          <Sub>3 casos reales de bots educativos bien diseñados. Inspírate. Toca cada tarjeta 👆</Sub>
          {renderExCard(0, '📚', 'Khanmigo (Khan Academy)', 'El tutor que NO da respuestas', <Text>Khan Academy lo entrenó con un principio: <B>nunca dar la respuesta directa</B>. Guía con preguntas, pide razonamiento, corrige solo tras el intento. Pedagogía embebida.</Text>, '⭐ Probado en 65+ distritos escolares de EE.UU. Mejoró comprensión real, no solo resultados.')}
          {renderExCard(1, '🇲🇽', 'Yo Estudio (SEP México)', 'Chatbot oficial para primaria pública', <Text>Chatbot del Ministerio de Educación de México. Lenguaje simple, <B>filtros estrictos de contenido</B> por trabajar con menores. Tono cálido, vocabulario acotado.</Text>, '⭐ Diseñado con maestras reales. Prioridad #1: seguridad infantil.')}
          {renderExCard(2, '🎒', 'Socratic (Google)', 'Foto + explicación paso a paso', <Text>Visión + chatbot: foto de la tarea → explica el <B>concepto</B>, no solo la respuesta. Diseñado para razonar juntos, no para hacer trampa.</Text>, '⭐ 50M+ descargas. Limitar el bot lo hace más útil.')}
        </View>
      );
      case 16: return renderScenario(FEEDBACK_SCN, { icon: '🎯', label: 'Módulo 16 de 19 · Escenario' },
        <Text style={styles.scenarioText}>Tu chatbot fue demasiado frío con una usuaria angustiada. El feedback llegó. ¿Qué haces?</Text>,
        '¿Cuál es la mejor opción?');
      case 17: {
        const robotic = { emoji: '🤖', body: "'Prepararse para un examen requiere organizar tiempo, revisar material y descansar adecuadamente. Se recomienda estudiar en bloques de 45 minutos.'" };
        const warm = { emoji: '🦊', body: "'Eh, respira. El miedo antes de un examen es buena señal — significa que te importa. Dime cuál es el tema que MENOS entiendes, y armamos un plan de 20 minutos. ¿Vale?'" };
        const cardA = compareFlip ? warm : robotic;
        const cardB = compareFlip ? robotic : warm;
        return (
          <View>
            <Tag icon="🆚" label="Módulo 17 de 19 · Prompt Compare" variant="quiz" />
            <Title>Compara dos chatbots</Title>
            <View style={styles.scenarioBox}><Text style={styles.scenarioLabel}>MISMO TEMA</Text><Text style={styles.scenarioText}>Usuario: 'Tengo miedo al examen de mañana'</Text></View>
            <View style={[styles.card, compareChecked && compareCorrect === 'a' && styles.cardWinner]}><Text style={styles.compareLabel}>{cardA.emoji}  Respuesta A</Text><Text style={styles.compareBody}>{cardA.body}</Text></View>
            <View style={[styles.card, compareChecked && compareCorrect === 'b' && styles.cardWinner]}><Text style={styles.compareLabel}>{cardB.emoji}  Respuesta B</Text><Text style={styles.compareBody}>{cardB.body}</Text></View>
            <Sub><B>¿Cuál conecta mejor con el usuario y por qué?</B></Sub>
            <View style={styles.compareOptsRow}>
              {(['a', 'b'] as const).map((k) => (
                <TouchableOpacity key={k} disabled={compareChecked} style={[styles.builderOpt, styles.compareOpt, compareChoice === k && styles.builderOptSel]} onPress={() => setCompareChoice(k)}>
                  <Text style={[styles.builderOptText, compareChoice === k && styles.builderOptTextSel]}>Respuesta {k.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {compareChecked && (
              <View style={[styles.fb, compareChoice === compareCorrect ? styles.fbOk : styles.fbBad]}>
                <Text style={compareChoice === compareCorrect ? styles.fbOkText : styles.fbBadText}>
                  {compareChoice === compareCorrect ? '✅ ¡Exacto! ' : `❌ La mejor era la Respuesta ${compareCorrect.toUpperCase()}. `}
                  La respuesta con personalidad valida la emoción, ofrece una acción concreta e invita a colaborar. La otra es técnicamente correcta pero emocionalmente vacía.
                </Text>
              </View>
            )}
          </View>
        );
      }
      case 18: return renderQuiz(quizQ, 'Módulo 18 de 19 · Quiz', 'Quiz de chatbots', '4 preguntas sobre diseño y ética. Demuestra lo aprendido.');
      case 20: {
        const pct = Math.round((25 / 36) * 100);
        return (
          <View style={styles.completeContainer}>
            <View style={styles.completeBadge}><Text style={{ fontSize: 44 }}>🤖</Text></View>
            <Text style={styles.completeTitle}>¡Nivel 25 completado!</Text>
            <Text style={styles.completeSub}>Terminaste "Crea tu Chatbot Personalizado". Ahora eres Chatbot Creator.</Text>
            <View style={styles.xpEarned}><Text style={styles.xpEarnedText}>⭐ {xp} XP ganados en este nivel</Text></View>
            <View style={styles.skillsList}>
              {['Puedo diseñar un chatbot con nombre, personalidad, objetivo, tono y límites claros', 'Sé qué es un system prompt y cómo redactarlo paso a paso', 'Detecto los 3 errores típicos: chatbots amplios, rígidos o sin personalidad', 'Entiendo la responsabilidad ética del creador sobre las respuestas', 'Tengo el plano de 3 chatbots (estudio, comunidad, entretenimiento) listos para construir'].map((s, i) => (
                <View key={i} style={styles.skillRow}><Text style={styles.skillCheck}>✓</Text><Text style={styles.skillText}>{s}</Text></View>
              ))}
            </View>
            <View style={styles.nextHint}><Text style={styles.nextHintText}><B>Nivel 26: Haz que la IA Trabaje Sola</B>{'\n'}Vas a aprender a automatizar tareas con Zapier y Make: disparadores, acciones y flujos que funcionan solos.</Text></View>
            <View style={styles.lvlBarWrap}>
              <Text style={styles.lvlBarLabel}>Nivel 25 de 36 completado · {pct}% del camino</Text>
              <View style={styles.lvlBarOuter}><View style={[styles.lvlBarInner, { width: `${pct}%` }]} /></View>
            </View>
            <TouchableOpacity style={[styles.primaryBtn, styles.primaryBtnAccent, { width: '100%' }]} onPress={finishLevel}><Text style={styles.primaryBtnText}>Siguiente nivel →</Text></TouchableOpacity>
          </View>
        );
      }
      default: return null;
    }
  };

  const primary = getPrimary();
  const progress = (step / (TOTAL_STEPS - 1)) * 100;
  const progLabel = step === 0 ? 'Introducción' : step < TOTAL_STEPS - 1 ? `Módulo ${step} de ${CONTENT_STEPS}` : '¡Nivel completado!';

  return (
    <View style={styles.screen}>
      <View style={styles.bar}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => exitLevel()} accessibilityLabel="Salir del nivel"><Text style={styles.closeBtnText}>✕</Text></TouchableOpacity>
        <View style={styles.track}><View style={[styles.fill, { width: `${progress}%` }]} /></View>
        <Text style={styles.xpChip}>{xp} XP</Text>
      </View>
      {step < TOTAL_STEPS - 1 && <Text style={styles.progLabel}>{progLabel}</Text>}
      <ScrollView contentContainerStyle={styles.scrollContent}>{renderContent()}</ScrollView>

      {step !== TOTAL_STEPS - 1 && (
        <View style={styles.navRow}>
          {isTheory && step > 0 && <TouchableOpacity style={styles.backBtn} onPress={() => setStep((s) => s - 1)}><Text style={styles.backBtnText}>← Volver</Text></TouchableOpacity>}
          <TouchableOpacity style={[styles.primaryBtn, primary.accent && styles.primaryBtnAccent, { flex: 1 }, !primary.enabled && styles.primaryBtnOff]} disabled={!primary.enabled} onPress={primary.onPress}>
            <Text style={styles.primaryBtnText}>{primary.label}</Text>
          </TouchableOpacity>
        </View>
      )}
      {xpToast && <XPToast key={xpToast.id} amount={xpToast.amount} onHide={() => setXpToast(null)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.screen },
  bar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: P.border, backgroundColor: '#fafafa' },
  closeBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: P.border, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 15, fontWeight: '800', color: P.muted },
  track: { flex: 1, height: 8, backgroundColor: P.border, borderRadius: 4, marginHorizontal: 12, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: P.rose, borderRadius: 4 },
  xpChip: { ...typography.bold, fontSize: 13, color: '#854d0e', backgroundColor: '#fde68a', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
  progLabel: { ...typography.regular, fontSize: 11, color: P.faint, textAlign: 'center', paddingTop: 6 },
  scrollContent: { padding: 16, paddingBottom: 30 },

  // Tags
  tag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginBottom: 12 },
  tagText: { fontSize: 11, fontWeight: '700' },

  // Texto base
  introIcon: { width: 68, height: 68, borderRadius: 20, backgroundColor: P.roseBg, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  title: { ...typography.extraBold, fontSize: 20, color: P.ink, marginBottom: 8, lineHeight: 26 },
  sub: { ...typography.regular, fontSize: 13, color: P.muted, lineHeight: 20, marginBottom: 12 },
  bodyText: { ...typography.regular, fontSize: 13, color: P.body, lineHeight: 22, marginBottom: 12 },
  bold: { fontWeight: '700', color: P.ink },
  sectionTitle: { ...typography.bold, fontSize: 14, color: P.ink, marginTop: 10, marginBottom: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f0f0f0' },

  // Cards
  card: { backgroundColor: P.cardBg, borderRadius: 14, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: P.border },
  cardAccent: { backgroundColor: P.roseBg, borderColor: P.roseBorder },
  cardGreen: { backgroundColor: P.greenSoft, borderColor: P.greenBorder },
  cardYellow: { backgroundColor: P.yellowBg, borderColor: P.yellowBorder },
  cardPurple: { backgroundColor: P.purpleBg, borderColor: P.purpleBorder },
  cardWinner: { borderColor: P.green, backgroundColor: P.greenSoft },
  cardTitle: { ...typography.bold, fontSize: 13, color: P.ink, marginBottom: 4 },
  cardText: { ...typography.regular, fontSize: 13, color: P.body, lineHeight: 21 },

  // Boxes teoría
  highlightBox: { borderLeftWidth: 3, borderLeftColor: P.rose, backgroundColor: P.roseBg, borderRadius: 8, padding: 12, marginBottom: 12 },
  highlightText: { fontSize: 13, color: P.roseText, lineHeight: 21 },
  tipBox: { borderLeftWidth: 3, borderLeftColor: P.green, backgroundColor: P.greenSoft, borderRadius: 8, padding: 12, marginTop: 4 },
  tipText: { fontSize: 13, color: P.greenText, lineHeight: 21 },
  stepLi: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 9 },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: P.rose, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  stepLiText: { flex: 1, fontSize: 13, color: P.body, lineHeight: 20 },

  // Matching
  matchHeaderRow: { flexDirection: 'row', gap: 6, marginBottom: 5 },
  matchColLabel: { flex: 1, fontSize: 11, fontWeight: '700', color: P.muted, textAlign: 'center' },
  matchRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  matchItem: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1.5, minHeight: 60, justifyContent: 'center' },
  matchLeft: { backgroundColor: P.blueBg, borderColor: P.blueBorder },
  matchRight: { backgroundColor: P.purpleBg, borderColor: P.purpleBorder },
  matchItemSel: { borderColor: P.rose, backgroundColor: P.roseBg },
  matchItemDone: { borderColor: P.green, backgroundColor: P.greenSoft },
  matchItemFlash: { borderColor: P.red, backgroundColor: P.redBg },
  matchItemText: { fontSize: 12, color: P.body, lineHeight: 16, textAlign: 'center' },
  matchItemTextDone: { color: P.greenText, fontWeight: '600' },

  // Drag / clasificar
  chipsPool: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, padding: 10, backgroundColor: P.cardBg, borderRadius: 14, borderWidth: 1, borderColor: P.border, marginBottom: 10, minHeight: 54 },
  chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#d1d5db', backgroundColor: '#fff' },
  chipSel: { borderColor: P.rose, backgroundColor: P.roseBg },
  chipFlash: { borderColor: '#fca5a5', backgroundColor: P.redBg },
  chipText: { fontSize: 12, color: P.body, lineHeight: 16 },
  dropCols: { flexDirection: 'row', gap: 8 },
  dropCol: { flex: 1, borderRadius: 12, borderWidth: 2, borderColor: '#d1d5db', borderStyle: 'dashed', minHeight: 110, padding: 8, backgroundColor: '#fafafa' },
  dropColIdentFull: { borderStyle: 'solid', borderColor: P.roseBorder, backgroundColor: P.roseBg },
  dropColBehavFull: { borderStyle: 'solid', borderColor: '#86efac', backgroundColor: P.greenSoft },
  dropHeader: { paddingVertical: 5, borderRadius: 7, marginBottom: 7 },
  dropHeaderIdent: { backgroundColor: P.pinkBg },
  dropHeaderBehav: { backgroundColor: P.greenBg },
  dropHeaderText: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  dropArea: { gap: 5 },
  dropChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14 },
  dropChipIdent: { backgroundColor: P.pinkBg },
  dropChipBehav: { backgroundColor: P.greenBg },
  dropChipText: { fontSize: 11, fontWeight: '500', lineHeight: 15 },

  // Builders
  builderWrap: { gap: 10 },
  builderRow: { backgroundColor: P.cardBg, borderWidth: 1, borderColor: P.border, borderRadius: 12, padding: 11 },
  builderLabel: { fontSize: 11, fontWeight: '700', color: P.roseText, marginBottom: 6, letterSpacing: 0.3, textTransform: 'uppercase' },
  builderOpts: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  builderOpt: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 9, borderWidth: 1.5, borderColor: P.border, backgroundColor: '#fff' },
  builderOptSel: { borderColor: P.rose, backgroundColor: P.roseBg },
  builderOptText: { fontSize: 12, color: P.body, fontWeight: '500' },
  builderOptTextSel: { color: P.roseText, fontWeight: '700' },
  codeBox: { backgroundColor: P.codeBg, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#1e293b' },
  codeLine: { fontSize: 12, lineHeight: 20, marginBottom: 2 },
  codeText: { color: P.codeText, fontFamily: 'monospace' },
  codeKey: { color: P.codeKey, fontWeight: '700', fontFamily: 'monospace' },
  codeEmpty: { color: P.codeEmpty, fontStyle: 'italic', fontFamily: 'monospace' },

  // Scenario
  scenarioBox: { backgroundColor: '#fffbeb', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: P.yellowBorder },
  scenarioLabel: { fontSize: 10, fontWeight: '700', color: P.amberText, marginBottom: 8, letterSpacing: 0.7 },
  scenarioText: { fontSize: 13, color: P.body, lineHeight: 21 },
  scChoice: { borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: P.border, marginBottom: 8, backgroundColor: '#fff' },
  scChoiceSel: { borderColor: P.rose, backgroundColor: P.roseBg },
  scChoiceOk: { borderColor: P.green, backgroundColor: P.greenSoft },
  scChoiceWrong: { borderColor: P.red, backgroundColor: P.redBg },
  scTitle: { fontSize: 12, fontWeight: '700', color: P.ink, marginBottom: 4 },
  scText: { fontSize: 12, color: P.body, lineHeight: 17 },

  // Quiz
  quizQ: { ...typography.bold, fontSize: 13, color: P.ink, padding: 12, backgroundColor: P.cardBg, borderRadius: 10, borderWidth: 1, borderColor: P.border, marginBottom: 8, lineHeight: 19 },
  qopt: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 11, borderWidth: 1.5, borderColor: P.border, backgroundColor: '#fff', marginBottom: 7 },
  qoptSel: { borderColor: P.rose, backgroundColor: P.roseBg },
  qoptOk: { borderColor: P.green, backgroundColor: P.greenBg },
  qoptWrong: { borderColor: P.red, backgroundColor: P.redBg },
  qopt_letterWrap: {},
  qLetter: { width: 24, height: 24, borderRadius: 7, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: P.border, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  qLetterSel: { backgroundColor: P.rose, borderColor: P.rose },
  qLetterOk: { backgroundColor: P.green, borderColor: P.green },
  qLetterWrong: { backgroundColor: P.red, borderColor: P.red },
  qLetterText: { fontSize: 11, fontWeight: '700', color: P.muted },
  qoptText: { flex: 1, fontSize: 12, color: P.body, lineHeight: 17 },

  // TF
  tfSet: { marginBottom: 16 },
  tfQ: { fontSize: 13, fontWeight: '700', color: P.ink, padding: 12, backgroundColor: P.cardBg, borderRadius: 10, borderWidth: 1, borderColor: P.border, marginBottom: 10, lineHeight: 19 },
  tfOpts: { flexDirection: 'row', gap: 8 },
  tfBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 2, borderColor: P.border, backgroundColor: '#fff', alignItems: 'center' },
  tfBtnTrue: { borderColor: P.green, backgroundColor: P.greenSoft },
  tfBtnFalse: { borderColor: P.red, backgroundColor: P.redBg },
  tfBtnCorrect: { borderColor: P.green, backgroundColor: P.greenBg },
  tfBtnWrong: { borderColor: P.red, backgroundColor: P.redBg },
  tfBtnText: { fontSize: 13, fontWeight: '700', color: P.body },

  // Sprint
  sprintBox: { backgroundColor: P.sprintBg, borderWidth: 2, borderColor: P.sprintBorder, borderRadius: 14, padding: 14, marginBottom: 4 },
  sprintTimerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, padding: 8, paddingHorizontal: 12, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: P.sprintBorder },
  sprintTime: { fontSize: 22, fontWeight: '800', color: P.sprintTime },
  sprintLabel: { flex: 1, fontSize: 11, color: P.sprintMark },
  sprintItem: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, backgroundColor: '#fff', borderWidth: 1.5, borderColor: P.sprintBorder, borderRadius: 9, marginBottom: 7 },
  sprintOk: { borderColor: P.green, backgroundColor: P.greenBg },
  sprintBad: { borderColor: P.red, backgroundColor: P.redBg },
  sprintMarker: { width: 22, height: 22, borderRadius: 6, backgroundColor: P.sprintBorder, alignItems: 'center', justifyContent: 'center' },
  sprintMarkerOk: { backgroundColor: P.green },
  sprintMarkerBad: { backgroundColor: P.red },
  sprintMarkerText: { fontSize: 11, fontWeight: '700', color: P.sprintMark },
  sprintItemText: { flex: 1, fontSize: 12, color: P.body, lineHeight: 17 },

  // Reflexión
  reflectArea: { minHeight: 120, padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: P.border, backgroundColor: '#fafafa', fontSize: 13, color: P.body, lineHeight: 22, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: P.faint, textAlign: 'right', marginTop: 4 },

  // Ejemplos (accordion)
  exCard: { borderRadius: 14, padding: 12, borderWidth: 1, borderColor: P.border, marginBottom: 8, backgroundColor: '#fff' },
  exCardOpen: { borderColor: P.rose, backgroundColor: P.roseBg },
  exHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exEmoji: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  exName: { fontSize: 13, fontWeight: '700', color: P.ink },
  exSub: { fontSize: 11, color: P.muted, marginTop: 1 },
  exArrow: { fontSize: 18, color: P.faint },
  exBody: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: P.border },
  exHow: { fontSize: 12, color: P.body, lineHeight: 19, marginBottom: 8 },
  exFact: { backgroundColor: '#fef9c3', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#fde68a' },
  exFactText: { fontSize: 12, color: '#854d0e', fontWeight: '500', lineHeight: 17 },

  // Compare
  compareLabel: { fontSize: 12, fontWeight: '700', color: P.ink, marginBottom: 6 },
  compareBody: { fontSize: 12, color: P.body, lineHeight: 19 },
  compareOptsRow: { flexDirection: 'row', gap: 8 },
  compareOpt: { flex: 1, alignItems: 'center', paddingVertical: 11 },

  // Feedback bars
  fb: { borderRadius: 10, padding: 11, marginTop: 8 },
  fbOk: { backgroundColor: P.greenBg },
  fbBad: { backgroundColor: P.redBg },
  fbNeutral: { backgroundColor: P.cardBg, borderWidth: 1, borderColor: P.border },
  fbOkText: { fontSize: 12, color: P.greenText, lineHeight: 18, fontWeight: '500' },
  fbBadText: { fontSize: 12, color: P.redText, lineHeight: 18, fontWeight: '500' },
  fbNeutralText: { fontSize: 12, color: P.muted, lineHeight: 18 },

  // Completion
  completeContainer: { alignItems: 'center', paddingTop: 8 },
  completeBadge: { width: 88, height: 88, borderRadius: 24, backgroundColor: P.rose, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  completeTitle: { ...typography.extraBold, fontSize: 22, color: P.ink, marginBottom: 6, textAlign: 'center' },
  completeSub: { fontSize: 13, color: P.muted, textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  xpEarned: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 20, backgroundColor: '#fef9c3', borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#fde047', width: '100%' },
  xpEarnedText: { fontSize: 16, fontWeight: '700', color: '#854d0e' },
  skillsList: { gap: 7, marginBottom: 16, width: '100%' },
  skillRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 10, backgroundColor: P.greenSoft, borderRadius: 10, borderWidth: 1, borderColor: P.greenBorder },
  skillCheck: { color: P.green, fontSize: 15, fontWeight: '800' },
  skillText: { flex: 1, fontSize: 12, color: P.greenText, lineHeight: 17, fontWeight: '500' },
  nextHint: { padding: 12, backgroundColor: P.cardBg, borderRadius: 10, borderWidth: 1, borderColor: P.border, width: '100%', marginBottom: 14 },
  nextHintText: { fontSize: 12, color: P.body, lineHeight: 20 },
  lvlBarWrap: { width: '100%', marginBottom: 16 },
  lvlBarLabel: { fontSize: 11, color: P.muted, marginBottom: 5 },
  lvlBarOuter: { height: 7, backgroundColor: P.border, borderRadius: 4, overflow: 'hidden' },
  lvlBarInner: { height: '100%', backgroundColor: P.rose, borderRadius: 4 },

  // Nav
  navRow: { flexDirection: 'row', gap: 8, padding: 14, borderTopWidth: 1, borderTopColor: '#f0f0f0', backgroundColor: '#fafafa' },
  backBtn: { paddingHorizontal: 16, paddingVertical: 13, borderRadius: 12, backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#e2e8f0', justifyContent: 'center' },
  backBtnText: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  primaryBtn: { backgroundColor: P.green, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
  primaryBtnAccent: { backgroundColor: P.rose },
  primaryBtnOff: { opacity: 0.35 },
  primaryBtnText: { ...typography.bold, color: '#fff', fontSize: 15 },
});
